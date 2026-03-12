import path from 'path';
import fs from 'fs';

/**
 * Robust JSON Database Fallback
 * 
 * Since Electron v40/Node v25 are extremely cutting-edge, native 
 * modules like better-sqlite3 often fail to build without a full
 * C++ toolchain. This implementation provides a stable JSON-based
 * storage engine that emulates the necessary query interface.
 */

const DB_DIR = process.env.USER_DATA_PATH || process.cwd();
const JSON_PATH = path.join(DB_DIR, 'gooddj_store.json');

// Initial state
const initialState = {
    tracks: [] as any[],
    playlists: [] as any[],
    playlist_tracks: [] as any[],
    recordings: [] as any[]
};

// Persistent storage loader
let data = initialState;
if (fs.existsSync(JSON_PATH)) {
    try {
        const raw = fs.readFileSync(JSON_PATH, 'utf-8');
        data = JSON.parse(raw);
    } catch (e) {
        console.error("[Database] Failed to load JSON store, starting fresh.", e);
    }
}

function save() {
    try {
        fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("[Database] Critical: Failed to save JSON store.", e);
    }
}

// Emulate better-sqlite3 statement object
class Statement {
    constructor(private query: string, private dataRef: typeof data) { }

    all(params?: any): any[] {
        if (this.query.includes('FROM tracks')) return [...this.dataRef.tracks];
        if (this.query.includes('FROM playlists')) {
            return this.dataRef.playlists.map(pl => ({
                ...pl,
                tracks: this.dataRef.playlist_tracks
                    .filter(pt => pt.playlistId === pl.id)
                    .map(pt => ({ trackId: pt.trackId }))
            }));
        }
        if (this.query.includes('FROM recordings')) return [...this.dataRef.recordings];
        return [];
    }

    get(id: string): any {
        if (this.query.includes('FROM tracks')) return this.dataRef.tracks.find(t => t.id === id);
        return null;
    }

    run(params: any): { changes: number } {
        const paramsObj = Array.isArray(params) ? { id: params[0] } : params;

        if (this.query.includes('INSERT INTO tracks')) {
            this.dataRef.tracks.push(params);
        } else if (this.query.includes('UPDATE tracks')) {
            const idx = this.dataRef.tracks.findIndex(t => t.id === params.id);
            if (idx !== -1) this.dataRef.tracks[idx] = { ...this.dataRef.tracks[idx], ...params };
        } else if (this.query.includes('DELETE FROM tracks')) {
            this.dataRef.tracks = this.dataRef.tracks.filter(t => t.id !== params[0]);
        } else if (this.query.includes('INSERT INTO playlists')) {
            this.dataRef.playlists.push({ ...params, tracks: [] });
        } else if (this.query.includes('INSERT OR IGNORE INTO playlist_tracks')) {
            const exists = this.dataRef.playlist_tracks.some(pt => pt.playlistId === params.playlistId && pt.trackId === params.trackId);
            if (!exists) this.dataRef.playlist_tracks.push(params);
        } else if (this.query.includes('INSERT INTO recordings')) {
            this.dataRef.recordings.push(params);
        } else if (this.query.includes('DELETE FROM recordings')) {
            this.dataRef.recordings = this.dataRef.recordings.filter(r => r.id !== params[0]);
        } else if (this.query.includes('DELETE FROM playlists')) {
            this.dataRef.playlists = this.dataRef.playlists.filter(p => p.id !== params[0]);
            this.dataRef.playlist_tracks = this.dataRef.playlist_tracks.filter(pt => pt.playlistId !== params[0]);
        }

        save();
        return { changes: 1 };
    }
}

export const trackQueries = {
    getAll: new Statement('SELECT * FROM tracks', data),
    getById: new Statement('SELECT * FROM tracks WHERE id = ?', data),
    insert: new Statement('INSERT INTO tracks ...', data),
    update: new Statement('UPDATE tracks ...', data),
    delete: new Statement('DELETE FROM tracks WHERE id = ?', data),
};

export const playlistQueries = {
    getAll: new Statement('SELECT * FROM playlists', data),
    getTracksForPlaylist: {
        all: (id: string) => data.playlist_tracks
            .filter(pt => pt.playlistId === id)
            .map(pt => data.tracks.find(t => t.id === pt.trackId))
            .filter(Boolean)
    },
    insert: new Statement('INSERT INTO playlists ...', data),
    delete: new Statement('DELETE FROM playlists WHERE id = ?', data),
    addTrack: new Statement('INSERT OR IGNORE INTO playlist_tracks ...', data),
    removeTrack: {
        run: (pId: string, tId: string) => {
            data.playlist_tracks = data.playlist_tracks.filter(pt => !(pt.playlistId === pId && pt.trackId === tId));
            save();
            return { changes: 1 };
        }
    },
};

export const recordingQueries = {
    getAll: new Statement('SELECT * FROM recordings', data),
    insert: new Statement('INSERT INTO recordings ...', data),
    delete: new Statement('DELETE FROM recordings WHERE id = ?', data),
};

export default { exec: () => { }, pragma: () => { }, prepare: (q: string) => new Statement(q, data) };
