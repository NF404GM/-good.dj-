let essentia: any = null;

const CAMELOT_MAP: Record<string, string> = {
    'C major': '8B', 'G major': '9B', 'D major': '10B', 'A major': '11B',
    'E major': '12B', 'B major': '1B', 'F# major': '2B', 'Gb major': '2B',
    'Db major': '3B', 'C# major': '3B', 'Ab major': '4B', 'G# major': '4B',
    'Eb major': '5B', 'D# major': '5B', 'Bb major': '6B', 'A# major': '6B',
    'F major': '7B', 'A minor': '8A', 'E minor': '9A', 'B minor': '10A',
    'F# minor': '11A', 'Gb minor': '11A', 'Db minor': '12A', 'C# minor': '12A',
    'Ab minor': '1A', 'G# minor': '1A', 'Eb minor': '2A', 'D# minor': '2A',
    'Bb minor': '3A', 'A# minor': '3A', 'F minor': '4A', 'C minor': '5A',
    'G minor': '6A', 'D minor': '7A'
};

async function initEssentia() {
    if (essentia) {
        return essentia;
    }

    const wasmModule = await import('essentia.js/dist/essentia-wasm.es.js');
    const coreModule = await import('essentia.js/dist/essentia.js-core.es.js');
    const EssentiaWASM = (wasmModule as any).default ?? wasmModule;
    const EssentiaCore = (coreModule as any).default ?? coreModule;
    const wasm = await EssentiaWASM();
    essentia = new EssentiaCore(wasm, false);
    return essentia;
}

function resampleTo44100(signal: Float32Array, sampleRate: number) {
    if (sampleRate === 44100) {
        return signal;
    }

    const ratio = 44100 / sampleRate;
    const nextLength = Math.max(1, Math.round(signal.length * ratio));
    const output = new Float32Array(nextLength);

    for (let i = 0; i < nextLength; i += 1) {
        const sourceIndex = Math.min(Math.round(i / ratio), signal.length - 1);
        output[i] = signal[sourceIndex];
    }

    return output;
}

self.onmessage = async (e: MessageEvent) => {
    const { audioData, sampleRate, id } = e.data;

    try {
        const essentiaInstance = await initEssentia();
        const signal = resampleTo44100(new Float32Array(audioData), sampleRate);
        const vectorSignal = essentiaInstance.arrayToVector(signal);

        try {
            const bpmResult = essentiaInstance.PercivalBpmEstimator(vectorSignal);
            let bpm = bpmResult.bpm;
            while (bpm > 180) bpm /= 2;
            while (bpm < 70 && bpm > 0) bpm *= 2;
            bpm = Math.round(bpm * 10) / 10;

            const frameSize = 4096;
            const hopSize = 2048;
            const hpcpAccum = new Float32Array(12);
            let frameCount = 0;

            for (let i = 0; i + frameSize < signal.length; i += hopSize) {
                let frameVec: any = null;
                let windowed: any = null;
                let spectrum: any = null;
                let peaks: any = null;
                let hpcp: any = null;

                try {
                    const frame = signal.slice(i, i + frameSize);
                    frameVec = essentiaInstance.arrayToVector(frame);
                    windowed = essentiaInstance.Windowing(frameVec, true, frameSize, 'hann', 0, true);
                    spectrum = essentiaInstance.Spectrum(windowed.frame, frameSize);
                    peaks = essentiaInstance.SpectralPeaks(
                        spectrum.spectrum,
                        10000,
                        5000,
                        0,
                        40,
                        'height',
                        44100
                    );

                    if (peaks.frequencies.size() > 0) {
                        hpcp = essentiaInstance.HPCP(
                            peaks.frequencies,
                            peaks.magnitudes,
                            true,
                            500,
                            0.5,
                            4,
                            5000,
                            true,
                            40,
                            'unitMax',
                            440,
                            12,
                            0.5,
                            'cosine'
                        );

                        const hpcpArr = essentiaInstance.vectorToArray(hpcp.hpcp);
                        for (let j = 0; j < 12; j += 1) {
                            hpcpAccum[j] += hpcpArr[j] || 0;
                        }
                        frameCount += 1;
                    }
                } catch {
                    // Skip malformed frames and continue analysis.
                } finally {
                    frameVec?.delete?.();
                    windowed?.frame?.delete?.();
                    spectrum?.spectrum?.delete?.();
                    peaks?.frequencies?.delete?.();
                    peaks?.magnitudes?.delete?.();
                    hpcp?.hpcp?.delete?.();
                }
            }

            let key = '1A';
            let scale = 'minor';

            if (frameCount > 0) {
                for (let j = 0; j < 12; j += 1) {
                    hpcpAccum[j] /= frameCount;
                }

                const avgHpcpVec = essentiaInstance.arrayToVector(hpcpAccum);
                try {
                    const keyResult = essentiaInstance.Key(avgHpcpVec);
                    scale = keyResult.scale;
                    key = CAMELOT_MAP[`${keyResult.key} ${keyResult.scale}`]
                        || `${keyResult.key}${keyResult.scale === 'minor' ? 'm' : ''}`;
                } finally {
                    avgHpcpVec.delete();
                }
            }

            let beats: number[] = [];
            try {
                const beatResult = essentiaInstance.BeatTrackerDegara(vectorSignal);
                beats = Array.from(essentiaInstance.vectorToArray(beatResult.ticks) as Float32Array);
                beatResult.ticks?.delete?.();
            } catch {
                beats = [];
            }

            self.postMessage({ id, success: true, bpm, key, scale, beats });
        } finally {
            vectorSignal.delete();
        }
    } catch (err: any) {
        self.postMessage({
            id,
            success: false,
            error: err?.message ?? 'Unknown analysis worker error',
        });
    }
};
