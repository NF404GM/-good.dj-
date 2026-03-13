import { LibraryTrack, Playlist } from '../types';
import { API_BASE, SERVER_BASE } from './config';

function isAbsoluteTrackPath(filePath?: string) {
    return Boolean(filePath && /^([A-Z]:\\|\/)/i.test(filePath));
}

function isManagedServerTrackPath(filePath?: string) {
    return Boolean(filePath && /^\/?(audio|uploads)\//i.test(filePath));
}

function toServerAssetUrl(filePath: string) {
    return `${SERVER_BASE}/${filePath.replace(/^\//, '')}`;
}

function normalizeTrack(track: any): LibraryTrack {
    const normalizedDateAdded = track.dateAdded instanceof Date
        ? track.dateAdded.toISOString().split('T')[0]
        : typeof track.dateAdded === 'string'
            ? track.dateAdded
            : new Date(track.dateAdded ?? Date.now()).toISOString().split('T')[0];

    return {
        ...track,
        dateAdded: normalizedDateAdded,
        beats: track.beatsJson ? JSON.parse(track.beatsJson) : undefined,
        storageKey: track.id
    };
}

export class LibraryService {
    private inMemoryRekordbox: Record<string, any> = {};

    constructor() { }

    public async init(): Promise<void> {
        return Promise.resolve();
    }

    public async saveTrack(track: LibraryTrack, file?: File): Promise<LibraryTrack> {
        if (window.gooddj) {
            if (file) {
                const filePath = (file as any).path;
                if (filePath) {
                    const saved = await window.gooddj.library.saveTrack({ ...track, filePath });
                    return normalizeTrack(saved);
                }
            } else {
                const updated = await window.gooddj.library.updateTrack(track.id, track);
                return normalizeTrack(updated);
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

            const res = await fetch(`${API_BASE}/tracks/upload`, {
                method: 'POST',
                body: formData,
            });
            return normalizeTrack(await res.json());
        }

        const { fileBlob, ...metadata } = track;
        const res = await fetch(`${API_BASE}/tracks/${track.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata)
        });
        return normalizeTrack(await res.json());
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
            return data.map((track: any) => normalizeTrack(track));
        }

        try {
            const res = await fetch(`${API_BASE}/tracks`);
            if (!res.ok) {
                return [];
            }

            const data = await res.json();
            return data.map((track: any) => normalizeTrack(track));
        } catch (e) {
            console.error('[good.dj] Could not connect to API server:', e);
            return [];
        }
    }

    public async getTrackById(id: string): Promise<LibraryTrack | null> {
        if (window.gooddj) {
            const track = await window.gooddj.library.getTrackById(id);
            return track ? normalizeTrack(track) : null;
        }

        try {
            const res = await fetch(`${API_BASE}/tracks/${id}`);
            if (!res.ok) {
                return null;
            }

            return normalizeTrack(await res.json());
        } catch {
            return null;
        }
    }

    public getTrackUrl(track: LibraryTrack): string {
        const p = track.filePath ?? '';

        if (!p) {
            return '';
        }

        if (p.startsWith('http://') || p.startsWith('https://')) {
            return p;
        }

        if (isManagedServerTrackPath(p)) {
            return toServerAssetUrl(p);
        }

        if (typeof window !== 'undefined' && window.gooddj && isAbsoluteTrackPath(p)) {
            return `gooddj-file://${encodeURIComponent(p)}`;
        }

        return `${SERVER_BASE}/api/file?path=${encodeURIComponent(p)}`;
    }

    public async getTrackBlob(id: string, filePath?: string): Promise<Blob | null> {
        const resolvedPath = filePath ?? (await this.getTrackById(id))?.filePath;
        if (!resolvedPath) {
            return null;
        }

        if (isManagedServerTrackPath(resolvedPath)) {
            const managedUrl = this.getTrackUrl({ id, filePath: resolvedPath } as LibraryTrack);
            if (!managedUrl) {
                return null;
            }

            try {
                const res = await fetch(managedUrl);
                if (!res.ok) {
                    return null;
                }

                return await res.blob();
            } catch (e) {
                console.error('[good.dj] Failed to fetch managed track blob:', e);
                return null;
            }
        }

        if (window.gooddj && isAbsoluteTrackPath(resolvedPath)) {
            try {
                const bytes = await window.gooddj.library.readTrackFile(resolvedPath);
                return new Blob([bytes]);
            } catch (e) {
                console.error('[good.dj] Failed to read local track file:', e);
                return null;
            }
        }

        const url = this.getTrackUrl({ id, filePath: resolvedPath } as LibraryTrack);
        if (!url) {
            return null;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) {
                return null;
            }

            return await res.blob();
        } catch (e) {
            console.error('Failed to fetch track blob:', e);
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
            trackIds: []
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
            return playlists.map((playlist: any) => ({
                id: playlist.id,
                name: playlist.name,
                trackIds: playlist.tracks.map((track: any) => track.trackId)
            }));
        }

        try {
            const res = await fetch(`${API_BASE}/playlists`);
            if (!res.ok) {
                return [];
            }

            const playlists = await res.json();
            return playlists.map((playlist: any) => ({
                id: playlist.id,
                name: playlist.name,
                trackIds: playlist.tracks.map((track: any) => track.trackId)
            }));
        } catch (e) {
            console.error('[good.dj] Could not fetch playlists:', e);
            return [];
        }
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

    public async saveRekordboxCache(entries: Record<string, any>): Promise<void> {
        this.inMemoryRekordbox = { ...this.inMemoryRekordbox, ...entries };
        return Promise.resolve();
    }

    public async getRekordboxEntry(keyPart: string): Promise<any | null> {
        return Promise.resolve(this.inMemoryRekordbox[keyPart] || null);
    }
}

export const goodDB = new LibraryService();
