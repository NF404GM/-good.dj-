import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { trackQueries, playlistQueries, recordingQueries } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WSS_PORT = 3001;
const HTTP_PORT = 3003;

const app = express();
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3003',
        'app://.' // Electron app protocol
    ]
}));
app.use(express.json());

const UPLOADS_DIR = process.env.USER_DATA_PATH
    ? path.join(process.env.USER_DATA_PATH, 'uploads')
    : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_FILE = process.env.USER_DATA_PATH
    ? path.join(process.env.USER_DATA_PATH, 'db.json')
    : path.join(process.cwd(), 'db.json');

function migrateData() {
    if (fs.existsSync(DB_FILE)) {
        console.log("[good.dj Backend] Found legacy db.json. Migrating to SQLite...");
        try {
            const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
            if (trackQueries.getAll.all().length === 0) {
                data.tracks.forEach((t: any) => trackQueries.insert.run(t));
                data.playlists.forEach((p: any) => {
                    playlistQueries.insert.run({ id: p.id, name: p.name });
                    p.tracks.forEach((pt: any, idx: number) => {
                        playlistQueries.addTrack.run({ playlistId: p.id, trackId: pt.trackId, position: idx });
                    });
                });
                if (data.recordings) {
                    data.recordings.forEach((r: any) => recordingQueries.insert.run(r));
                }
                console.log("[good.dj Backend] Migration successful.");
            }
            fs.renameSync(DB_FILE, `${DB_FILE}.bak`);
        } catch (err) {
            console.error("[good.dj Backend] Migration failed:", err);
        }
    }
}

// Serve audio files statically
app.use('/audio', express.static(UPLOADS_DIR));

const upload = multer({ dest: 'temp_uploads/' });

async function startServer() {
    console.log("Starting good.dj Backend Proxy & API Server (SQLite Storage)");
    migrateData();

    const wss = new WebSocketServer({ port: WSS_PORT, host: '127.0.0.1' });
    const clients: Set<WebSocket> = new Set();

    console.log(`[good.dj WSS] Listening on 127.0.0.1:${WSS_PORT}`);

    wss.on('connection', (ws, req) => {
        console.log(`[good.dj WSS] New connection from ${req.socket.remoteAddress}`);
        clients.add(ws);
        ws.on('close', () => {
            console.log(`[good.dj WSS] Connection closed from ${req.socket.remoteAddress}`);
            clients.delete(ws);
        });
    });

    const broadcast = (data: any) => {
        const msg = JSON.stringify(data);
        for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) client.send(msg);
        }
    };

    try {
        const prolink = await import('prolink-connect');
        const network = await prolink.bringOnline();
        console.log("PROLINK network is listening for CDJs...");

        network.deviceManager.on('connected', (device: any) => broadcast({ type: 'DEVICE_ADDED', device }));
        network.deviceManager.on('disconnected', (device: any) => broadcast({ type: 'DEVICE_REMOVED', device }));
        network.statusEmitter?.on('status', (state: any) => {
            const isPlaying = state.playState === 3 || state.playState === 4; // Playing or Looping
            const bpm = state.trackBPM || 120;
            broadcast({
                type: 'PLAYER_STATUS',
                deviceId: state.deviceId,
                trackId: state.trackId,
                isPlaying,
                tempo: bpm,
                pitch: state.sliderPitch,
                effectiveTempo: bpm * (1 + state.sliderPitch),
                beat: state.beat,
            });
        });
    } catch (err) {
        console.warn("⚠️ ProLink Hardware integration disabled (safe to ignore):", err);
    }

    app.post('/api/analyze-key', upload.single('audio'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
        const filePath = req.file.path;

        let keyfinderCmd = 'keyfinder-cli'; // Global default for dev/linux

        if (process.env.ELECTRON_RUN_AS_NODE && process.platform === 'win32') {
            // Reconstruct path to unpacked exe when inside the Electron builder on Windows
            const resourcesPath = path.join(process.execPath, '..', 'resources');
            keyfinderCmd = `"${path.join(resourcesPath, 'app.asar.unpacked', 'bin', 'win', 'keyfinder-cli.exe')}"`;
        } else if (process.platform === 'win32') {
            // Dev environment fallback for Windows
            keyfinderCmd = `"${path.join(__dirname, '..', 'bin', 'win', 'keyfinder-cli.exe')}"`;
        }

        exec(`${keyfinderCmd} "${filePath}"`, (error, stdout) => {
            fs.unlink(filePath, () => { });
            if (error) {
                console.error("Keyfinder execution error:", error);
                return res.status(500).json({ error: 'Key detection failed. Ensure keyfinder-cli.exe is in bin/win.' });
            }
            res.json({ key: stdout.trim() });
        });
    });

    app.use((req, res, next) => {
        console.log(`[good.dj API] ${req.method} ${req.url}`);
        next();
    });

    app.get('/api/tracks', (req, res) => {
        res.json(trackQueries.getAll.all());
    });

    app.post('/api/tracks/upload', upload.single('audio'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const originalExt = path.extname(req.file.originalname);
        const newFilename = `${Date.now()}_${Math.random().toString(36).substring(7)}${originalExt}`;
        const finalPath = path.join(UPLOADS_DIR, newFilename);

        fs.renameSync(req.file.path, finalPath);

        const { title, artist, album, genre, bpm, key, duration, rating, analyzed } = req.body;

        const track = {
            id: `trk_${Date.now()}`,
            title: title || req.file.originalname.replace(originalExt, ''),
            artist: artist || 'Unknown Artist',
            album: album || 'Imported',
            genre: genre || 'Unknown',
            bpm: parseFloat(bpm) || 120,
            key: key || '1A',
            duration: parseFloat(duration) || 0,
            rating: parseInt(rating) || 0,
            analyzed: analyzed === 'true' ? 1 : 0,
            filePath: `/audio/${newFilename}`,
            dateAdded: new Date().toISOString()
        };

        trackQueries.insert.run(track);
        res.json(track);
    });

    app.post('/api/tracks', (req, res) => {
        const track = { id: `trk_${Date.now()}`, ...req.body };
        trackQueries.insert.run(track);
        res.json(track);
    });

    app.put('/api/tracks/:id', (req, res) => {
        const updates = req.body;
        const current = trackQueries.getById.get(req.params.id) as any;
        if (current) {
            const updated = { ...current, ...updates };
            trackQueries.update.run(updated);
            res.json(updated);
        } else {
            res.status(404).json({ error: 'Track not found' });
        }
    });

    app.get('/api/playlists', (req, res) => {
        const playlists = playlistQueries.getAll.all() as any[];
        const enriched = playlists.map(pl => ({
            ...pl,
            tracks: playlistQueries.getTracksForPlaylist.all(pl.id)
        }));
        res.json(enriched);
    });

    app.post('/api/playlists', (req, res) => {
        const pl = { id: req.body.id || `pl_${Date.now()}`, name: req.body.name };
        playlistQueries.insert.run(pl);
        res.json({ ...pl, tracks: [] });
    });

    app.post('/api/playlists/:id/tracks', (req, res) => {
        const playlistId = req.params.id;
        const trackIds = req.body.trackIds;
        trackIds.forEach((trackId: string, idx: number) => {
            playlistQueries.addTrack.run({ playlistId, trackId, position: idx });
        });
        res.json({ success: true });
    });

    app.delete('/api/playlists/:id', (req, res) => {
        playlistQueries.delete.run(req.params.id);
        res.json({ success: true });
    });

    // --- RECORDINGS API ---
    app.get('/api/recordings', (req, res) => {
        res.json(recordingQueries.getAll.all());
    });

    app.post('/api/recordings', upload.single('audio'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No recording file uploaded' });

        const originalExt = path.extname(req.file.originalname) || '.webm';
        const newFilename = `mix_${Date.now()}_${Math.random().toString(36).substring(7)}${originalExt}`;
        const finalPath = path.join(UPLOADS_DIR, newFilename);

        fs.renameSync(req.file.path, finalPath);

        const { title, duration } = req.body;

        const recording = {
            id: `rec_${Date.now()}`,
            title: title || `DJ Mix - ${new Date().toLocaleString()}`,
            duration: parseFloat(duration) || 0,
            filePath: `/audio/${newFilename}`,
            dateRecorded: new Date().toISOString()
        };

        recordingQueries.insert.run(recording);
        res.json(recording);
    });

    app.delete('/api/recordings/:id', (req, res) => {
        recordingQueries.delete.run(req.params.id);
        res.json({ success: true });
    });

    app.listen(HTTP_PORT, '0.0.0.0', () => {
        console.log(`[good.dj API] HTTP API ready on 0.0.0.0:${HTTP_PORT}`);
    });
}

startServer();
