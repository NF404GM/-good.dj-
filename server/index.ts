import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const WSS_PORT = 3001;
const HTTP_PORT = 3003;

const app = express();
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3003',
        'app://.'
    ]
}));
app.use(express.json());

const UPLOADS_DIR = process.env.USER_DATA_PATH
    ? path.join(process.env.USER_DATA_PATH, 'uploads')
    : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use('/audio', express.static(UPLOADS_DIR));

const upload = multer({ dest: 'temp_uploads/' });

let serverStartPromise: Promise<void> | null = null;

export async function startServer() {
    if (serverStartPromise) {
        return serverStartPromise;
    }

    serverStartPromise = (async () => {
        console.log('[good.dj] Starting backend (Neon PostgreSQL via Prisma)');

        const wss = new WebSocketServer({ port: WSS_PORT, host: '127.0.0.1' });
        const clients: Set<WebSocket> = new Set();

        wss.on('connection', (ws) => {
            clients.add(ws);
            ws.on('close', () => clients.delete(ws));
        });

        const broadcast = (data: any) => {
            const message = JSON.stringify(data);
            for (const client of clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            }
        };

        try {
            const prolink = await import('prolink-connect');
            const network = await prolink.bringOnline();
            console.log('[good.dj] PROLINK network active.');

            network.deviceManager.on('connected', (device: any) => broadcast({ type: 'DEVICE_ADDED', device }));
            network.deviceManager.on('disconnected', (device: any) => broadcast({ type: 'DEVICE_REMOVED', device }));
            network.statusEmitter?.on('status', (state: any) => {
                const isPlaying = state.playState === 3 || state.playState === 4;
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
            console.warn('[good.dj] Hardware integration disabled.');
        }

        app.post('/api/analyze-key', upload.single('audio'), (req, res) => {
            if (!req.file) {
                res.status(400).json({ error: 'No audio file provided' });
                return;
            }

            const filePath = req.file.path;
            let keyfinderCmd = 'keyfinder-cli';

            if (process.env.ELECTRON_RUN_AS_NODE && process.platform === 'win32') {
                const resourcesPath = path.join(process.execPath, '..', 'resources');
                keyfinderCmd = `"${path.join(resourcesPath, 'app.asar.unpacked', 'bin', 'win', 'keyfinder-cli.exe')}"`;
            } else if (process.platform === 'win32') {
                keyfinderCmd = `"${path.join(__dirname, '..', 'bin', 'win', 'keyfinder-cli.exe')}"`;
            }

            exec(`${keyfinderCmd} "${filePath}"`, (error, stdout) => {
                fs.unlink(filePath, () => { });
                if (error) {
                    console.error('Keyfinder error:', error);
                    res.status(500).json({ error: 'Key detection failed.' });
                    return;
                }

                res.json({ key: stdout.trim() });
            });
        });

        app.get('/api/tracks', async (_req, res) => {
            try {
                const tracks = await prisma.track.findMany({
                    include: { cuePoints: true }
                });
                res.json(tracks);
            } catch (err) {
                res.status(500).json({ error: 'Failed to fetch tracks' });
            }
        });

        app.get('/api/tracks/:id', async (req, res) => {
            try {
                const track = await prisma.track.findUnique({
                    where: { id: req.params.id },
                    include: { cuePoints: true }
                });

                if (!track) {
                    res.status(404).json({ error: 'Not found' });
                    return;
                }

                res.json(track);
            } catch (err) {
                res.status(500).json({ error: 'Failed to fetch track' });
            }
        });

        app.post('/api/tracks/upload', upload.single('audio'), async (req, res) => {
            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            const originalExt = path.extname(req.file.originalname);
            const newFilename = `${Date.now()}_${Math.random().toString(36).substring(7)}${originalExt}`;
            const finalPath = path.join(UPLOADS_DIR, newFilename);
            fs.renameSync(req.file.path, finalPath);

            const { title, artist, album, genre, bpm, key, duration, rating, analyzed } = req.body;

            try {
                const track = await prisma.track.create({
                    data: {
                        title: title || req.file.originalname.replace(originalExt, ''),
                        artist: artist || 'Unknown Artist',
                        album: album || 'Imported',
                        genre: genre || 'Unknown',
                        bpm: parseFloat(bpm) || 120,
                        key: key || '1A',
                        duration: parseFloat(duration) || 0,
                        rating: parseInt(rating, 10) || 0,
                        analyzed: analyzed === 'true',
                        filePath: `/audio/${newFilename}`,
                    }
                });
                res.json(track);
            } catch (err) {
                console.error('Track upload error:', err);
                res.status(500).json({ error: 'Failed to save track' });
            }
        });

        app.put('/api/tracks/:id', async (req, res) => {
            try {
                const updated = await prisma.track.update({
                    where: { id: req.params.id },
                    data: req.body
                });
                res.json(updated);
            } catch (err) {
                res.status(404).json({ error: 'Track not found' });
            }
        });

        app.get('/api/playlists', async (_req, res) => {
            try {
                const playlists = await prisma.playlist.findMany({
                    include: {
                        tracks: {
                            include: { track: true },
                            orderBy: { order: 'asc' }
                        }
                    }
                });
                res.json(playlists);
            } catch (err) {
                res.status(500).json({ error: 'Failed to fetch playlists' });
            }
        });

        app.post('/api/playlists', async (req, res) => {
            try {
                const playlist = await prisma.playlist.create({
                    data: { name: req.body.name }
                });
                res.json({ ...playlist, tracks: [] });
            } catch (err) {
                res.status(500).json({ error: 'Failed to create playlist' });
            }
        });

        app.post('/api/playlists/:id/tracks', async (req, res) => {
            const { trackIds } = req.body;
            try {
                await prisma.playlistTrack.deleteMany({ where: { playlistId: req.params.id } });
                await prisma.playlistTrack.createMany({
                    data: trackIds.map((trackId: string, idx: number) => ({
                        playlistId: req.params.id,
                        trackId,
                        order: idx
                    }))
                });
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: 'Failed to add tracks' });
            }
        });

        app.delete('/api/playlists/:id', async (req, res) => {
            try {
                await prisma.playlist.delete({ where: { id: req.params.id } });
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: 'Failed to delete playlist' });
            }
        });

        app.get('/api/recordings', async (_req, res) => {
            res.json(await prisma.recording.findMany({ orderBy: { dateRecorded: 'desc' } }));
        });

        app.post('/api/recordings', upload.single('audio'), async (req, res) => {
            if (!req.file) {
                res.status(400).json({ error: 'No recording file uploaded' });
                return;
            }

            const originalExt = path.extname(req.file.originalname) || '.webm';
            const newFilename = `mix_${Date.now()}_${Math.random().toString(36).substring(7)}${originalExt}`;
            const finalPath = path.join(UPLOADS_DIR, newFilename);
            fs.renameSync(req.file.path, finalPath);

            const { title, duration } = req.body;

            try {
                const recording = await prisma.recording.create({
                    data: {
                        title: title || `DJ Mix - ${new Date().toLocaleString()}`,
                        duration: parseFloat(duration) || 0,
                        filePath: `/audio/${newFilename}`,
                    }
                });
                res.json(recording);
            } catch (err) {
                res.status(500).json({ error: 'Failed to save recording' });
            }
        });

        app.delete('/api/recordings/:id', async (req, res) => {
            try {
                await prisma.recording.delete({ where: { id: req.params.id } });
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: 'Failed to delete recording' });
            }
        });

        await new Promise<void>((resolve) => {
            app.listen(HTTP_PORT, '127.0.0.1', () => {
                console.log(`[good.dj] API ready on port ${HTTP_PORT}`);
                resolve();
            });
        });
    })();

    return serverStartPromise;
}

const entryPointHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === entryPointHref) {
    startServer().catch((err) => {
        console.error('[good.dj] Server failed to start:', err);
        process.exit(1);
    });
}
