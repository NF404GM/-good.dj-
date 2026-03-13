import { ipcMain, BrowserWindow, app } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { AudioContext } from 'node-web-audio-api';
import { separateStems } from './stemSeparator.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

let handlersRegistered = false;

function toTrackCreateData(track: any) {
    return {
        id: track.id,
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Imported',
        genre: track.genre || 'Unknown',
        bpm: Number(track.bpm ?? 120),
        key: track.key || '1A',
        duration: Number(track.duration ?? 0),
        rating: Number(track.rating ?? 0),
        dateAdded: track.dateAdded ? new Date(track.dateAdded) : undefined,
        analyzed: Boolean(track.analyzed),
        beatsJson: Array.isArray(track.beats) ? JSON.stringify(track.beats) : (track.beatsJson ?? null),
        filePath: track.filePath ?? null,
    };
}

function toTrackUpdateData(updates: any) {
    const data: Record<string, any> = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.artist !== undefined) data.artist = updates.artist;
    if (updates.album !== undefined) data.album = updates.album;
    if (updates.genre !== undefined) data.genre = updates.genre;
    if (updates.bpm !== undefined) data.bpm = Number(updates.bpm);
    if (updates.key !== undefined) data.key = updates.key;
    if (updates.duration !== undefined) data.duration = Number(updates.duration);
    if (updates.rating !== undefined) data.rating = Number(updates.rating);
    if (updates.dateAdded !== undefined) data.dateAdded = new Date(updates.dateAdded);
    if (updates.analyzed !== undefined) data.analyzed = Boolean(updates.analyzed);
    if (updates.filePath !== undefined) data.filePath = updates.filePath;
    if (updates.beats !== undefined) data.beatsJson = Array.isArray(updates.beats) ? JSON.stringify(updates.beats) : null;
    if (updates.beatsJson !== undefined) data.beatsJson = updates.beatsJson;
    return data;
}

async function migrateLegacyJson(dbFile: string) {
    if (!fs.existsSync(dbFile)) {
        return;
    }

    console.log('[Electron Main] Found legacy db.json. Migrating...');

    try {
        const data = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
        const trackCount = await prisma.track.count();

        if (trackCount === 0) {
            if (Array.isArray(data.tracks) && data.tracks.length > 0) {
                await prisma.track.createMany({
                    data: data.tracks.map((track: any) => toTrackCreateData(track)),
                    skipDuplicates: true,
                });
            }

            if (Array.isArray(data.playlists) && data.playlists.length > 0) {
                await prisma.playlist.createMany({
                    data: data.playlists.map((playlist: any) => ({
                        id: playlist.id,
                        name: playlist.name,
                    })),
                    skipDuplicates: true,
                });

                const playlistTracks = data.playlists.flatMap((playlist: any) =>
                    (playlist.tracks ?? []).map((playlistTrack: any, idx: number) => ({
                        playlistId: playlist.id,
                        trackId: playlistTrack.trackId,
                        order: idx,
                    }))
                );

                if (playlistTracks.length > 0) {
                    await prisma.playlistTrack.createMany({
                        data: playlistTracks,
                        skipDuplicates: true,
                    });
                }
            }

            if (Array.isArray(data.recordings) && data.recordings.length > 0) {
                await prisma.recording.createMany({
                    data: data.recordings.map((recording: any) => ({
                        id: recording.id,
                        title: recording.title,
                        duration: Number(recording.duration ?? 0),
                        filePath: recording.filePath,
                        dateRecorded: recording.dateRecorded ? new Date(recording.dateRecorded) : new Date(),
                    })),
                    skipDuplicates: true,
                });
            }
        }

        fs.renameSync(dbFile, `${dbFile}.bak`);
        console.log('[Electron Main] Migration successful.');
    } catch (err) {
        console.error('[Electron Main] Migration failed:', err);
    }
}

function registerIpcHandlers(uploadsDir: string) {
    if (handlersRegistered) {
        return;
    }

    handlersRegistered = true;

    ipcMain.handle('library:getTracks', async () => {
        return prisma.track.findMany({
            include: { cuePoints: true },
            orderBy: { dateAdded: 'desc' },
        });
    });

    ipcMain.handle('library:getTrackById', async (_event, id: string) => {
        return prisma.track.findUnique({
            where: { id },
            include: { cuePoints: true },
        });
    });

    ipcMain.handle('library:readTrackFile', async (_event, filePath: string) => {
        return new Uint8Array(fs.readFileSync(filePath));
    });

    ipcMain.handle('library:saveTrack', async (_event, track) => {
        const created = await prisma.track.create({
            data: toTrackCreateData(track),
            include: { cuePoints: true },
        });
        return created;
    });

    ipcMain.handle('library:updateTrack', async (_event, id: string, updates: any) => {
        return prisma.track.update({
            where: { id },
            data: toTrackUpdateData(updates),
            include: { cuePoints: true },
        });
    });

    ipcMain.handle('library:getPlaylists', async () => {
        return prisma.playlist.findMany({
            include: {
                tracks: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    });

    ipcMain.handle('library:savePlaylist', async (_event, name: string, id?: string) => {
        return prisma.playlist.create({
            data: {
                ...(id ? { id } : {}),
                name,
            },
            include: {
                tracks: {
                    orderBy: { order: 'asc' },
                },
            },
        });
    });

    ipcMain.handle('library:addTracksToPlaylist', async (_event, playlistId: string, trackIds: string[]) => {
        const existing = await prisma.playlistTrack.findMany({
            where: { playlistId },
            orderBy: { order: 'asc' },
        });

        const seen = new Set(existing.map((track) => track.trackId));
        const nextOrder = existing.length;
        const additions = trackIds
            .filter((trackId) => !seen.has(trackId))
            .map((trackId, idx) => ({
                playlistId,
                trackId,
                order: nextOrder + idx,
            }));

        if (additions.length > 0) {
            await prisma.playlistTrack.createMany({ data: additions });
        }

        return { success: true };
    });

    ipcMain.handle('library:deletePlaylist', async (_event, id: string) => {
        await prisma.playlist.delete({ where: { id } });
        return { success: true };
    });

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
                    console.error('Keyfinder execution error:', error);
                    reject(new Error('Key detection failed.'));
                    return;
                }

                resolve(stdout.trim());
            });
        });
    });

    ipcMain.handle('audio:saveRecording', async (_event, sourcePath: string, title: string, duration: number) => {
        const originalExt = path.extname(sourcePath) || '.webm';
        const newFilename = `mix_${Date.now()}_${Math.random().toString(36).substring(7)}${originalExt}`;
        const finalPath = path.join(uploadsDir, newFilename);

        try {
            fs.renameSync(sourcePath, finalPath);
        } catch {
            fs.copyFileSync(sourcePath, finalPath);
            const srcStat = fs.statSync(sourcePath);
            const dstStat = fs.statSync(finalPath);

            if (dstStat.size !== srcStat.size) {
                fs.unlinkSync(finalPath);
                throw new Error('Recording copy verification failed - source preserved.');
            }

            fs.unlinkSync(sourcePath);
        }

        const recording = await prisma.recording.create({
            data: {
                id: `rec_${Date.now()}`,
                title: title || `DJ Mix - ${new Date().toLocaleString()}`,
                duration: duration || 0,
                filePath: `/audio/${newFilename}`,
                dateRecorded: new Date(),
            },
        });

        return recording;
    });

    ipcMain.handle('library:getRecordings', async () => {
        return prisma.recording.findMany({
            orderBy: { dateRecorded: 'desc' },
        });
    });

    ipcMain.handle('stems:separate', async (_event, filePath: string) => {
        console.log('[Electron] Starting stem separation for:', filePath);

        const ctx = new AudioContext({ sampleRate: 44100 });

        try {
            const fileBytes = fs.readFileSync(filePath);
            const arrayBuffer = fileBytes.buffer.slice(
                fileBytes.byteOffset,
                fileBytes.byteOffset + fileBytes.byteLength
            ) as ArrayBuffer;

            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
            const stems = await separateStems(left, right, audioBuffer.sampleRate);

            return {
                drums: Array.from(stems.drums),
                bass: Array.from(stems.bass),
                other: Array.from(stems.other),
                vocals: Array.from(stems.vocals),
                sampleRate: stems.sampleRate,
            };
        } finally {
            await ctx.close();
        }
    });

    ipcMain.handle('app:getUploadsDir', () => uploadsDir);
}

export function setupIpcHandlers(mainWindow: BrowserWindow): () => void {
    const userDataPath = app.getPath('userData');
    const uploadsDir = path.join(userDataPath, 'uploads');

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    registerIpcHandlers(uploadsDir);

    const dbFile = path.join(userDataPath, 'db.json');
    void migrateLegacyJson(dbFile);

    const safeSend = (channel: string, payload: any) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
        }
    };

    let prolinkCleanup: (() => void) | null = null;
    let cleanedUp = false;

    const cleanup = () => {
        if (cleanedUp) {
            return;
        }

        cleanedUp = true;
        prolinkCleanup?.();
        prolinkCleanup = null;
    };

    const initProlink = async () => {
        try {
            const prolink = await import('prolink-connect');
            const network = await prolink.bringOnline();
            console.log('[Electron Main] ProLink network online.');

            const onConnected = (device: any) => {
                safeSend('prolink:device', { type: 'DEVICE_ADDED', device });
            };
            const onDisconnected = (device: any) => {
                safeSend('prolink:device', { type: 'DEVICE_REMOVED', device });
            };
            const onStatus = (state: any) => {
                const isPlaying = state.playState === 3 || state.playState === 4;
                const bpm = state.trackBPM || 120;
                safeSend('prolink:status', {
                    deviceId: state.deviceId,
                    trackId: state.trackId,
                    isPlaying,
                    tempo: bpm,
                    pitch: state.sliderPitch,
                    effectiveTempo: bpm * (1 + state.sliderPitch),
                    beat: state.beat,
                });
            };

            network.deviceManager.on('connected', onConnected);
            network.deviceManager.on('disconnected', onDisconnected);
            network.statusEmitter?.on('status', onStatus);

            prolinkCleanup = () => {
                network.deviceManager.off('connected', onConnected);
                network.deviceManager.off('disconnected', onDisconnected);
                network.statusEmitter?.off('status', onStatus);
            };
        } catch (err) {
            console.warn('[Electron Main] ProLink hardware integration failed:', err);
        }
    };

    void initProlink();
    mainWindow.once('closed', cleanup);

    return cleanup;
}
