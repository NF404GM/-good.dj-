import { LibraryTrack, Playlist } from '../types';

const API_BASE = 'http://127.0.0.1:3003/api';

export class LibraryService {
    private inMemoryRekordbox: Record<string, any> = {};

    constructor() { }

    public async init(): Promise<void> {
        // No local DB init required anymore, we use the REST API
        return Promise.resolve();
    }

    public async saveTrack(track: LibraryTrack, file?: File): Promise<void> {
        if (window.gooddj) {
            if (file) {
                // In Electron, we can use the native path
                const filePath = (file as any).path;
                if (filePath) {
                    await window.gooddj.library.saveTrack({ ...track, filePath });
                    return;
                }
            } else {
                await window.gooddj.library.updateTrack(track.id, track);
                return;
            }
        }

        if (file) {
            const formData = new FormData();
            formData.append('audio', file);
            formData.append('title', track.title);
            formData.append('artist', track.artist);
            formData.append('album', track.album);
            formData.append('genre', track.genre);
            formData.append('bpm', track.bpm.toString());
            formData.append('key', track.key);
            formData.append('duration', track.duration.toString());
            formData.append('rating', track.rating.toString());
            formData.append('analyzed', track.analyzed.toString());

            await fetch(`${API_BASE}/tracks/upload`, {
                method: 'POST',
                body: formData,
            });
        } else {
            // Update metadata
            const { fileBlob, ...metadata } = track;
            await fetch(`${API_BASE}/tracks/${track.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metadata)
            });
        }
    }

    public async setTrackRating(trackId: string, rating: number): Promise<void> {
        await fetch(`${API_BASE}/tracks/${trackId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating })
        });
    }

    public async getAllTracks(): Promise<LibraryTrack[]> {
        if (window.gooddj) {
            const data = await window.gooddj.library.getTracks();
            return data.map((t: any) => ({
                ...t,
                beats: t.beatsJson ? JSON.parse(t.beatsJson) : undefined,
                storageKey: t.id
            }));
        }

        console.log(`[good.dj INFO] Fetching tracks from ${API_BASE}/tracks`);
        try {
            const res = await fetch(`${API_BASE}/tracks`);
            if (!res.ok) {
                console.warn(`[good.dj WARN] Server returned not-ok: ${res.status}`);
                return [];
            }
            const data = await res.json();
            console.log(`[good.dj INFO] Successfully loaded ${data.length} tracks`);
            return data.map((t: any) => ({
                ...t,
                beats: t.beatsJson ? JSON.parse(t.beatsJson) : undefined,
                storageKey: t.id // Map ID to storageKey for legacy compatibility
            }));
        } catch (e) {
            console.error(`[good.dj ERROR] Could not connect to API server:`, e);
            return [];
        }
    }

    public getTrackUrl(track: LibraryTrack): string {
        // Now returns the route pointing to our proxy API
        const url = `http://127.0.0.1:3003${track.filePath}`;
        return url;
    }

    public async getTrackBlob(id: string): Promise<Blob | null> {
        // We need the filePath. Since we only have the ID here, we fetch track metadata first
        const tracks = await this.getAllTracks();
        const track: any = tracks.find(t => t.id === id);

        if (!track || !track.filePath) return null;

        const url = this.getTrackUrl(track); // Use the new helper
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.blob();
        } catch (e) {
            console.error("Failed to fetch track audio blob from server:", e);
            return null;
        }
    }

    public async createPlaylist(name: string, id?: string): Promise<Playlist> {
        if (window.gooddj) {
            const data = await window.gooddj.library.savePlaylist(name, id);
            return {
                id: data.id,
                name: data.name,
                trackIds: []
            };
        }

        const res = await fetch(`${API_BASE}/playlists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        return {
            id: data.id,
            name: data.name,
            trackIds: [] // freshly created
        };
    }

    public async deletePlaylist(id: string): Promise<void> {
        if (window.gooddj) {
            await window.gooddj.library.deletePlaylist(id);
            return;
        }
        await fetch(`${API_BASE}/playlists/${id}`, { method: 'DELETE' });
    }

    public async getAllPlaylists(): Promise<Playlist[]> {
        if (window.gooddj) {
            const playlists = await window.gooddj.library.getPlaylists();
            return playlists.map((pl: any) => ({
                id: pl.id,
                name: pl.name,
                trackIds: pl.tracks.map((pt: any) => pt.trackId)
            }));
        }

        const res = await fetch(`${API_BASE}/playlists`);
        if (!res.ok) return [];
        const playlists = await res.json();
        return playlists.map((pl: any) => ({
            id: pl.id,
            name: pl.name,
            trackIds: pl.tracks.map((pt: any) => pt.trackId)
        }));
    }

    public async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
        return this.addTracksToPlaylist(playlistId, [trackId]);
    }

    public async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
        if (window.gooddj) {
            await window.gooddj.library.addTracksToPlaylist(playlistId, trackIds);
            return;
        }
        await fetch(`${API_BASE}/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackIds })
        });
    }

    // --- REKORDBOX CACHE (Keep in memory for transient sessions) ---

    public async saveRekordboxCache(entries: Record<string, any>): Promise<void> {
        this.inMemoryRekordbox = { ...this.inMemoryRekordbox, ...entries };
        return Promise.resolve();
    }

    public async getRekordboxEntry(keyPart: string): Promise<any | null> {
        return Promise.resolve(this.inMemoryRekordbox[keyPart] || null);
    }
}

export const goodDB = new LibraryService();
