/**
 * Track Analysis Web Worker
 * 
 * This worker handles the heavy lifting of audio analysis (BPM, Key) using Essentia.js.
 * By running this in a worker, the UI remains responsive (60fps) even when
 * processing large audio files or batch imports.
 */

importScripts('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.es.js');
importScripts('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js');

let essentia;

async function initEssentia() {
    if (essentia) return essentia;
    // EssentiaWASM and Essentia are provided by the importScripts above
    const wasm = await EssentiaWASM();
    essentia = new Essentia(wasm, false);
    return essentia;
}

self.onmessage = async (e) => {
    const { audioData, id } = e.data;

    try {
        const essentiaInstance = await initEssentia();
        const signal = new Float32Array(audioData);
        const vectorSignal = essentiaInstance.arrayToVector(signal);

        // 1. BPM Estimation
        const bpmResult = essentiaInstance.PercivalBpmEstimator(vectorSignal);
        let bpm = bpmResult.bpm;
        while (bpm > 180) bpm /= 2;
        while (bpm < 70 && bpm > 0) bpm *= 2;
        bpm = Math.round(bpm * 10) / 10;

        // 2. Key Estimation
        const profile = essentiaInstance.Key(vectorSignal);
        const key = profile.key;
        const scale = profile.scale;

        // Convert to Camelot (Mapping helper inside worker for speed)
        const camelotMap = {
            'C major': '8B', 'G major': '9B', 'D major': '10B', 'A major': '11B', 'E major': '12B', 'B major': '1B',
            'F# major': '2B', 'Gb major': '2B', 'Db major': '3B', 'C# major': '3B', 'Ab major': '4B', 'G# major': '4B',
            'Eb major': '5B', 'D# major': '5B', 'Bb major': '6B', 'A# major': '6B', 'F major': '7B',
            'A minor': '8A', 'E minor': '9A', 'B minor': '10A', 'F# minor': '11A', 'Gb minor': '11A',
            'Db minor': '12A', 'C# minor': '12A', 'Ab minor': '1A', 'G# minor': '1A', 'Eb minor': '2A', 'D# minor': '2A',
            'Bb minor': '3A', 'A# minor': '3A', 'F minor': '4A', 'C minor': '5A', 'G minor': '6A', 'D minor': '7A'
        };
        const camelotKey = camelotMap[`${key} ${scale}`] || `${key}${scale === 'minor' ? 'm' : ''}`;

        // 3. Beat Tracking for Quantized Looping
        let beats = [];
        try {
            const beatResult = essentiaInstance.BeatTrackerDegara(vectorSignal);
            const ticks = essentiaInstance.vectorToArray(beatResult.ticks);
            beats = Array.from(ticks);
        } catch (err) {
            console.warn("Beat tracking failed in worker", err);
        }

        self.postMessage({
            id,
            success: true,
            bpm,
            key: camelotKey,
            scale,
            beats
        });

        vectorSignal.delete();
    } catch (err) {
        self.postMessage({
            id,
            success: false,
            error: err.message
        });
    }
};
