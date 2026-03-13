import essentiaWasmBinaryUrl from 'essentia.js/dist/essentia-wasm.web.wasm?url';
import PQueue from 'p-queue';

/**
 * Track Analysis Service - Powered by Essentia.js (WASM)
 * 
 * Provides BPM detection, Key estimation, and beat tracking
 * using industry-standard MIR algorithms from the Music Technology
 * Group at Universitat Pompeu Fabra.
 * 
 * IMPORTANT: Essentia.js is loaded lazily via dynamic import() to avoid
 * blocking the React app mount. The WASM module is only fetched when
 * the first track analysis is triggered.
 */

export interface TrackAnalysisResult {
    bpm: number;
    key: string;
    scale: string;
    beats: number[];  // Beat positions in seconds
    keyConfidence: number;
}

interface AnalyzeTrackOptions {
    mode?: 'direct' | 'worker';
}

let essentiaInstance: any = null;
let initPromise: Promise<any> | null = null;

/** Initialize the Essentia WASM module (singleton, lazy via dynamic import). */
async function ensureEssentia(): Promise<any> {
    if (essentiaInstance) return essentiaInstance;

    if (!initPromise) {
        initPromise = (async () => {
            try {
                // Dynamic imports — only loads WASM when actually needed
                const [wasmModule, coreModule] = await Promise.all([
                    import('essentia.js/dist/essentia-wasm.web.js'),
                    import('essentia.js/dist/essentia.js-core.es.js')
                ]);

                const EssentiaWASM = (wasmModule as any).default ?? (wasmModule as any).EssentiaWASM ?? wasmModule;
                const EssentiaJS = (coreModule as any).default ?? coreModule;

                const wasm = await EssentiaWASM({
                    locateFile: () => essentiaWasmBinaryUrl,
                });
                essentiaInstance = new EssentiaJS(wasm, false);
                console.log('[TrackAnalyzer] Essentia.js initialized — version:', essentiaInstance.version);
            } catch (err) {
                console.error('[TrackAnalyzer] Failed to initialize Essentia.js WASM:', err);
                initPromise = null;
                throw err;
            }
        })();
    }

    await initPromise;
    return essentiaInstance;
}

/**
 * Convert an AudioBuffer to a mono Float32Array signal.
 * Downmixes stereo to mono via averaging.
 */
function audioBufferToMono(buffer: AudioBuffer): Float32Array {
    if (buffer.numberOfChannels === 1) {
        return buffer.getChannelData(0);
    }

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const mono = new Float32Array(left.length);

    for (let i = 0; i < left.length; i++) {
        mono[i] = (left[i] + right[i]) * 0.5;
    }

    return mono;
}

/**
 * Estimate BPM using Essentia's PercivalBpmEstimator.
 * This is a fast, single-pass algorithm well-suited for DJ tracks.
 */
function estimateBPM(essentia: any, signal: any): number {
    try {
        const result = essentia.PercivalBpmEstimator(signal);
        const bpm = result.bpm;

        // DJ convention: constrain BPM to a reasonable range (70-180)
        // by halving or doubling if needed
        let normalizedBpm = bpm;
        while (normalizedBpm > 180) normalizedBpm /= 2;
        while (normalizedBpm < 70 && normalizedBpm > 0) normalizedBpm *= 2;

        return Math.round(normalizedBpm * 10) / 10; // One decimal place
    } catch (err) {
        console.warn('[TrackAnalyzer] BPM estimation failed, falling back to BeatTracker:', err);
        return 120; // Safe fallback
    }
}

/**
 * Detect beat positions using BeatTrackerDegara.
 * Returns an array of beat timestamps in seconds.
 */
function detectBeats(essentia: any, vectorSignal: any): number[] {
    let result: any = null;
    try {
        result = essentia.BeatTrackerDegara(vectorSignal);
        const ticks = essentia.vectorToArray(result.ticks);
        return Array.from(ticks);
    } catch (err) {
        console.warn('[TrackAnalyzer] Beat detection failed:', err);
        return [];
    } finally {
        result?.ticks?.delete?.();
    }
}

/**
 * Estimate musical key using Essentia's frame-by-frame HPCP → Key pipeline.
 * Uses spectral analysis to compute pitch class profiles and then
 * determines the overall key and scale.
 */
function estimateKey(essentia: any, vectorSignal: any, sampleRate: number): { key: string; scale: string; strength: number } {
    let frames: any = null;
    try {
        // Use frame-based analysis for more robust key detection
        const frameSize = 4096;
        const hopSize = 2048;

        // Windowing and spectrum for each frame
        frames = essentia.FrameGenerator(vectorSignal, frameSize, hopSize);
        const numFrames = frames.size();

        if (numFrames === 0) {
            return { key: 'C', scale: 'major', strength: 0 };
        }

        // Accumulate HPCP across all frames
        const hpcpAccumulator = new Float32Array(12).fill(0);
        let validFrames = 0;

        for (let i = 0; i < numFrames; i++) {
            let frame: any = null;
            let windowed: any = null;
            let spectrum: any = null;
            let peaks: any = null;
            let hpcp: any = null;

            try {
                frame = frames.get(i);
                windowed = essentia.Windowing(frame, true, frameSize, 'hann', 0, true);
                spectrum = essentia.Spectrum(windowed.frame, frameSize);
                peaks = essentia.SpectralPeaks(
                    spectrum.spectrum,
                    5000,  // maxFrequency
                    60,    // maxPeaks
                    0,     // magnitudeThreshold
                    100,   // minFrequency
                    'height', // orderBy
                    sampleRate
                );

                if (peaks.frequencies.size() > 0) {
                    hpcp = essentia.HPCP(
                        peaks.frequencies,
                        peaks.magnitudes,
                        true,   // harmonics
                        500,    // bandPreset
                        0.5,    // bandSplitFrequency — not relevant with split=false
                        4,      // harmonicsNumber
                        5000,   // maxFrequency
                        true,   // maxShifted
                        40,     // minFrequency
                        'unitMax', // normalize
                        440,    // referenceFrequency
                        12,     // size
                        0.5,    // weightType (use 'cosine')
                        'cosine' // windowSize
                    );
                    const hpcpArray = essentia.vectorToArray(hpcp.hpcp);
                    for (let j = 0; j < 12; j++) {
                        hpcpAccumulator[j] += hpcpArray[j] || 0;
                    }
                    validFrames++;
                }
            } finally {
                // Cleanup frame-level vectors
                frame?.delete?.();
                windowed?.frame?.delete?.();
                spectrum?.spectrum?.delete?.();
                peaks?.frequencies?.delete?.();
                peaks?.magnitudes?.delete?.();
                hpcp?.hpcp?.delete?.();
            }
        }

        if (validFrames === 0) {
            return { key: 'C', scale: 'major', strength: 0 };
        }

        // Average the HPCP
        for (let j = 0; j < 12; j++) {
            hpcpAccumulator[j] /= validFrames;
        }

        let hpcpVector: any = null;
        try {
            hpcpVector = essentia.arrayToVector(hpcpAccumulator);
            const keyResult = essentia.Key(hpcpVector);

            return {
                key: keyResult.key,
                scale: keyResult.scale,
                strength: keyResult.strength
            };
        } finally {
            if (hpcpVector) hpcpVector.delete();
        }
    } catch (err) {
        console.warn('[TrackAnalyzer] Key estimation failed:', err);
        return { key: 'C', scale: 'major', strength: 0 };
    } finally {
        if (frames) frames.delete();
    }
}

/**
 * Convert key/scale to Camelot notation (DJ-standard wheel).
 */
function toCamelotKey(key: string, scale: string): string {
    const camelotMap: Record<string, string> = {
        'C major': '8B', 'G major': '9B', 'D major': '10B',
        'A major': '11B', 'E major': '12B', 'B major': '1B',
        'F# major': '2B', 'Gb major': '2B',
        'Db major': '3B', 'C# major': '3B',
        'Ab major': '4B', 'G# major': '4B',
        'Eb major': '5B', 'D# major': '5B',
        'Bb major': '6B', 'A# major': '6B',
        'F major': '7B',
        'A minor': '8A', 'E minor': '9A', 'B minor': '10A',
        'F# minor': '11A', 'Gb minor': '11A',
        'Db minor': '12A', 'C# minor': '12A',
        'Ab minor': '1A', 'G# minor': '1A',
        'Eb minor': '2A', 'D# minor': '2A',
        'Bb minor': '3A', 'A# minor': '3A',
        'F minor': '4A',
        'C minor': '5A', 'G minor': '6A', 'D minor': '7A',
    };

    const lookup = `${key} ${scale}`;
    return camelotMap[lookup] || `${key}${scale === 'minor' ? 'm' : ''}`;
}

/**
 * Determines if two Camelot keys are harmonically compatible.
 * Rules: Exact match, +/- 1 hour, or same hour different scale (A/B swap).
 */
export function isHarmonicMatch(key1: string, key2: string): boolean {
    if (!key1 || !key2 || key1 === '?' || key2 === '?') return false;

    const m1 = key1.match(/^(\d+)([AB])$/i);
    const m2 = key2.match(/^(\d+)([AB])$/i);

    if (!m1 || !m2) return false;

    const n1 = parseInt(m1[1], 10);
    const s1 = m1[2].toUpperCase();

    const n2 = parseInt(m2[1], 10);
    const s2 = m2[2].toUpperCase();

    if (s1 === s2) {
        const diff = Math.abs(n1 - n2);
        return diff === 0 || diff === 1 || diff === 11;
    } else {
        return n1 === n2;
    }
}

/**
 * Shifts a Camelot key by a given number of semitones.
 * +1 semitone = +7 hours on the Camelot wheel.
 */
export function shiftCamelotKey(key: string, semitones: number): string {
    if (!key || key === '?') return key;
    const match = key.match(/^(\d+)([AB])$/i);
    if (!match) return key;

    let num = parseInt(match[1], 10);
    const scale = match[2].toUpperCase();

    let shifts = (semitones * 7) % 12;
    if (shifts < 0) shifts += 12;

    num = ((num - 1 + shifts) % 12) + 1;

    return `${num}${scale}`;
}

/**
 * Analyze a loaded AudioBuffer and return BPM, Key, and Beat positions.
 * This is the main entry point for track analysis.
 */

// Singleton Worker & Queue to prevent resource exhaustion
let worker: Worker | null = null;
const queue = new PQueue({ concurrency: 1 });
const pendingAnalyses: Map<string, (result: TrackAnalysisResult) => void> = new Map();

/** Initialize the Analysis Worker (Singleton). */
function ensureWorker(): Worker {
    if (worker) return worker;

    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
        const { id, success, bpm, key, scale, beats, keyConfidence, error } = e.data;
        const resolver = pendingAnalyses.get(id);
        if (resolver) {
            if (success) {
                resolver({
                    bpm,
                    key,
                    scale,
                    beats: beats || [],
                    keyConfidence: keyConfidence ?? 0
                });
            } else {
                console.error(`[TrackAnalyzer] Worker error for ${id}:`, error);
                resolver({ bpm: 120, key: '8B', scale: 'major', beats: [], keyConfidence: 0 });
            }
            pendingAnalyses.delete(id);
        }
    };

    return worker;
}

async function analyzeTrackDirect(buffer: AudioBuffer): Promise<TrackAnalysisResult> {
    const essentia = await ensureEssentia();
    const monoSignal = audioBufferToMono(buffer);
    const vectorSignal = essentia.arrayToVector(monoSignal);

    try {
        const bpm = estimateBPM(essentia, vectorSignal);
        const beats = detectBeats(essentia, vectorSignal);
        const keyResult = estimateKey(essentia, vectorSignal, buffer.sampleRate);

        return {
            bpm,
            key: toCamelotKey(keyResult.key, keyResult.scale),
            scale: keyResult.scale,
            beats,
            keyConfidence: keyResult.strength
        };
    } finally {
        vectorSignal.delete();
    }
}

async function analyzeTrackInWorker(buffer: AudioBuffer): Promise<TrackAnalysisResult> {
    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const analysisWorker = ensureWorker();
    const monoSignal = audioBufferToMono(buffer);

    return new Promise((resolve) => {
        pendingAnalyses.set(analysisId, resolve);

        console.log(`[TrackAnalyzer] Queueing analysis in worker: ${analysisId}`);
        analysisWorker.postMessage({
            id: analysisId,
            sampleRate: buffer.sampleRate,
            audioData: monoSignal.buffer
        }, [monoSignal.buffer]);
    });
}

/**
 * Analyze a loaded AudioBuffer and return BPM and Key.
 * Limiting to 1 concurrent analysis via p-queue.
 */
export async function analyzeTrack(buffer: AudioBuffer, filePath?: string, options?: AnalyzeTrackOptions): Promise<TrackAnalysisResult> {
    return queue.add(async () => {
        if (options?.mode === 'worker') {
            return analyzeTrackInWorker(buffer);
        }

        return analyzeTrackDirect(buffer);
    }) as Promise<TrackAnalysisResult>;
}
