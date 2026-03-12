import { ipcMain, BrowserWindow, app } from 'electron';
import { trackQueries, playlistQueries, recordingQueries } from '../server/database.ts';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
    const userDataPath = app.getPath('userData');
    const uploadsDir = path.join(userDataPath, 'uploads');

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // ── LIBRARY HANDLERS ──

    ipcMain.handle('library:getTracks', async () => {
        return trackQueries.getAll.all();
    });

    ipcMain.handle('library:saveTrack', async (_event, track) => {
        trackQueries.insert.run(track);
        return track;
    });

    ipcMain.handle('library:updateTrack', async (_event, id, updates) => {
        const current = trackQueries.getById.get(id) as any;
        if (current) {
            const updated = { ...current, ...updates };
            trackQueries.update.run(updated);
            return updated;
        }
        throw new Error('Track not found');
    });

    ipcMain.handle('library:getPlaylists', async () => {
        const playlists = playlistQueries.getAll.all() as any[];
        return playlists.map(pl => ({
            ...pl,
            tracks: playlistQueries.getTracksForPlaylist.all(pl.id)
        }));
    });

    ipcMain.handle('library:savePlaylist', async (_event, name, id) => {
        const pl = { id: id || `pl_${Date.now()}`, name };
        playlistQueries.insert.run(pl);
        return { ...pl, tracks: [] };
    });

    ipcMain.handle('library:addTracksToPlaylist', async (_event, playlistId, trackIds) => {
        trackIds.forEach((trackId: string, idx: number) => {
            playlistQueries.addTrack.run({ playlistId, trackId, position: idx });
        });
        return { success: true };
    });

    ipcMain.handle('library:deletePlaylist', async (_event, id) => {
        playlistQueries.delete.run(id);
        return { success: true };
    });

    // ── AUDIO / DSP HANDLERS ──

    ipcMain.handle('audio:analyzeKey', async (_event, filePath: string) => {
        return new Promise((resolve, reject) => {
            let keyfinderCmd = 'keyfinder-cli';

            if (app.isPackaged && process.platform === 'win32') {
                const resourcesPath = path.join(process.execPath, '..', 'resources');
                keyfinderCmd = `"${path.join(resourcesPath, 'app.asar.unpacked', 'bin', 'win', 'keyfinder-cli.exe')}"`;
            } else if (process.platform === 'win32') {
                keyfinderCmd = `"${path.join(__dirname, '..', 'bin', 'win', 'keyfinder-cli.exe')}"`;
            }

            exec(`${keyfinderCmd} "${filePath}"`, (error, stdout) => {
                if (error) {
                    console.error("Keyfinder execution error:", error);
                    return reject(new Error('Key detection failed.'));
                }
                resolve(stdout.trim());
            });
        });
    });

    ipcMain.handle('audio:saveRecording', async (_event, sourcePath: string, title: string, duration: number) => {
        const originalExt = path.extname(sourcePath) || '.webm';
        const newFilename = `mix_${Date.now()}_${Math.random().toString(36).substring(7)}${originalExt}`;
        const finalPath = path.join(uploadsDir, newFilename);

        fs.copyFileSync(sourcePath, finalPath);
        fs.unlinkSync(sourcePath);

        const recording = {
            id: `rec_${Date.now()}`,
            title: title || `DJ Mix - ${new Date().toLocaleString()}`,
            duration: duration || 0,
            filePath: finalPath, // Note: For Electron, we might want absolute paths or a custom protocol
            dateRecorded: new Date().toISOString()
        };

        recordingQueries.insert.run(recording);
        return recording;
    });

    ipcMain.handle('library:getRecordings', async () => {
        return recordingQueries.getAll.all();
    });

    // ── DATA MIGRATION ──
    const dbFile = path.join(userDataPath, 'db.json');
    if (fs.existsSync(dbFile)) {
        console.log("[Electron Main] Found legacy db.json. Migrating...");
        try {
            const data = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
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
                console.log("[Electron Main] Migration successful.");
            }
            fs.renameSync(dbFile, `${dbFile}.bak`);
        } catch (err) {
            console.error("[Electron Main] Migration failed:", err);
        }
    }

    // ── PROLINK HARDWARE INTEGRATION ──
    const initProlink = async () => {
        try {
            const prolink = await import('prolink-connect');
            const network = await prolink.bringOnline();
            console.log("[Electron Main] ProLink network online.");

            network.deviceManager.on('connected', (device: any) => {
                mainWindow.webContents.send('prolink:device', { type: 'DEVICE_ADDED', device });
            });
            network.deviceManager.on('disconnected', (device: any) => {
                mainWindow.webContents.send('prolink:device', { type: 'DEVICE_REMOVED', device });
            });
            network.statusEmitter?.on('status', (state: any) => {
                const isPlaying = state.playState === 3 || state.playState === 4;
                const bpm = state.trackBPM || 120;
                mainWindow.webContents.send('prolink:status', {
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
            console.warn("[Electron Main] ProLink hardware integration failed:", err);
        }
    };

    initProlink();

    // ── APP HANDLERS ──
    ipcMain.handle('app:getUploadsDir', () => uploadsDir);
}
