import { LibraryTrack } from '../types';

export interface RekordboxCacheEntry {
    title: string;
    artist: string;
    bpm: number;
    key: string;
    duration: number;
    markers: { start: number; type: number; num: number }[];
}

export async function parseRekordboxXml(file: File): Promise<Record<string, RekordboxCacheEntry>> {
    const text = await file.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');

    const cache: Record<string, RekordboxCacheEntry> = {};

    const tracks = xml.getElementsByTagName('TRACK');
    for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        const name = t.getAttribute('Name') || '';
        const artist = t.getAttribute('Artist') || '';
        const bpm = parseFloat(t.getAttribute('AverageBpm') || '0');
        const key = t.getAttribute('Tonality') || '';
        const duration = parseInt(t.getAttribute('TotalTime') || '0', 10);

        // Parse Hot Cues and Memory Cues
        const markers: { start: number; type: number; num: number }[] = [];
        const children = t.children;
        for (let j = 0; j < children.length; j++) {
            const child = children[j];
            if (child.tagName === 'POSITION_MARK') {
                const start = parseFloat(child.getAttribute('Start') || '0');
                const type = parseInt(child.getAttribute('Type') || '0', 10);
                const num = parseInt(child.getAttribute('Num') || '-1', 10);
                markers.push({ start, type, num });
            }
        }

        // Create a normalized key mapping to match filenames easily
        // e.g. "Some Artist - Some Song"
        const normalizedKey = `${artist.toLowerCase().trim()} - ${name.toLowerCase().trim()}`;
        const simplifiedKey = name.toLowerCase().trim(); // Fallback key

        const entry = {
            title: name,
            artist,
            bpm,
            key,
            duration,
            markers
        };

        if (artist) {
            cache[normalizedKey] = entry;
        }
        cache[simplifiedKey] = entry;
    }

    return cache;
}
