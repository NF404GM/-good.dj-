import { AudioDeck, EqState, EffectType, StemSeparationResult, StemType } from '../types';
import SignalsmithStretch from 'signalsmith-stretch';
import { EffectsEngine } from './effects_engine';
import { SERVER_BASE } from './config';
import { generateImpulseResponse } from './audioUtils';

type RealStemName = 'drums' | 'bass' | 'other' | 'vocals';

interface RealStemDeck {
    enabled: boolean;
    buffers: Record<RealStemName, AudioBuffer> | null;
    sources: Record<RealStemName, AudioBufferSourceNode | null>;
    gains: Record<RealStemName, GainNode>;
    active: Record<RealStemName, boolean>;
    volumes: Record<RealStemName, number>;
}

class AudioEngineService {
    private ctx: AudioContext;
    private masterGain: GainNode;
    private isReady: boolean = false;
    private isInitializing: boolean = false;
    private readyPromise: Promise<void>;

    private decks: Record<string, AudioDeck>;
    public onTrackEnd: ((deckId: string) => void) | null = null;
    private impulseBuffer: AudioBuffer | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private recordingDestination: MediaStreamAudioDestinationNode | null = null;
    private levelBuffers: Record<string, Uint8Array> = {};
    private keyShiftByDeck: Record<string, number> = { A: 0, B: 0 };
    private animationFrameId: number | null = null;
    private tunaFx: EffectsEngine;
    private stemDecks: Record<string, RealStemDeck> = {};

    constructor() {
        this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 44100 });
        this.tunaFx = new EffectsEngine(this.ctx);
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        // Pre-generate Reverb IR
        this.impulseBuffer = generateImpulseResponse(this.ctx, 2.0, 2.0);

        this.decks = {};
        this.readyPromise = this.initWorklet();
    }

    private async ensureReady() {
        await this.readyPromise;
    }

    private async initWorklet() {
        if (this.isReady || this.isInitializing) return;
        this.isInitializing = true;
        try {
            console.log("[AudioEngine] Initializing SignalsmithStretch engine...");
            
            // Note: SignalsmithStretch registers its own worklet module.
            // We create the decks now.
            const deckA = await this.createDeckNode('A');
            const deckB = await this.createDeckNode('B');

            this.decks = {
                A: deckA,
                B: deckB
            };

            this.stemDecks = {
                A: this.createRealStemDeck('A'),
                B: this.createRealStemDeck('B'),
            };

            this.levelBuffers = {
                A: new Uint8Array(this.decks.A.analyser.frequencyBinCount),
                B: new Uint8Array(this.decks.B.analyser.frequencyBinCount)
            };

            this.isReady = true;
            this.isInitializing = false;
            console.log("[AudioEngine] Full engine ready.");
        } catch (err) {
            this.isInitializing = false;
            console.error("[AudioEngine] Initialization failed:", err);
            // Re-throw to ensure the readyPromise reflects the failure if anyone is awaiting it
            throw err;
        }
    }

    // --- DSP GRAPH CREATION ---

    private async createDeckNode(deckId: string): Promise<AudioDeck> {
        // DSP Chain:
        // Source -> Trim -> StemFilters(Bass/Mid/High) -> ColorFilter -> EQ(High/Mid/Low) -> FX Split -> [Dry / Wet] -> Merge -> Volume -> Crossfader -> Analyser -> Master

        const trimNode = this.ctx.createGain();

        // Stem Simulation Filters
        const stemBass = this.ctx.createBiquadFilter();
        stemBass.type = 'lowshelf'; stemBass.frequency.value = 200; stemBass.gain.value = 0;

        const stemMid = this.ctx.createBiquadFilter();
        stemMid.type = 'peaking'; stemMid.frequency.value = 1000; stemMid.Q.value = 0.5; stemMid.gain.value = 0;

        const stemHigh = this.ctx.createBiquadFilter();
        stemHigh.type = 'highshelf'; stemHigh.frequency.value = 3000; stemHigh.gain.value = 0;

        const drumsKick = this.ctx.createBiquadFilter();
        drumsKick.type = 'peaking'; drumsKick.frequency.value = 60; drumsKick.Q.value = 1.5; drumsKick.gain.value = 0;

        const drumsHigh = this.ctx.createBiquadFilter();
        drumsHigh.type = 'peaking'; drumsHigh.frequency.value = 8000; drumsHigh.Q.value = 0.8; drumsHigh.gain.value = 0;

        // Color Filter
        const colorFilter = this.ctx.createBiquadFilter();
        colorFilter.type = 'lowpass'; // Default open state (but high freq) or allpass
        colorFilter.frequency.value = 24000;
        colorFilter.Q.value = 0.7;

        // Mixer EQ
        const highNode = this.ctx.createBiquadFilter();
        const midNode = this.ctx.createBiquadFilter();
        const lowNode = this.ctx.createBiquadFilter();

        // --- FX ROUTING (PARALLEL) ---
        const fxDry = this.ctx.createGain(); // Renamed from dryNode
        const fxWet = this.ctx.createGain(); // Renamed from wetNode
        fxWet.gain.value = 0; // Wet amount controlled by UI

        // FX Inputs (Selectors)
        const delayInput = this.ctx.createGain();
        const reverbInput = this.ctx.createGain();

        const tunaDelay = this.tunaFx.createDelay();
        const tunaReverb = this.tunaFx.createReverb('Standard');

        delayInput.connect(tunaDelay.input);
        tunaDelay.connect(fxWet);

        reverbInput.connect(tunaReverb.input);
        tunaReverb.connect(fxWet);

        // Volume / Crossfader / Metering
        const volumeNode = this.ctx.createGain(); // Channel Volume Fader
        const crossfaderNode = this.ctx.createGain(); // Crossfader Attenuation
        const analyser = this.ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;

        // --- CONNECTIONS ---
        trimNode.connect(stemBass);
        stemBass.connect(stemMid);
        stemMid.connect(stemHigh);
        stemHigh.connect(drumsKick);
        drumsKick.connect(drumsHigh);

        // Insert Color Filter
        drumsHigh.connect(colorFilter);
        colorFilter.connect(highNode);

        highNode.connect(midNode);
        midNode.connect(lowNode);

        // Split at LowNode output
        lowNode.connect(fxDry); // Dry Path
        lowNode.connect(delayInput); // Wet Path Input for Delay
        lowNode.connect(reverbInput); // Wet Path Input for Reverb

        // Dry and Wet paths merge into volumeNode
        fxDry.connect(volumeNode);
        fxWet.connect(volumeNode);

        // Post-Fader chain
        volumeNode.connect(crossfaderNode);
        crossfaderNode.connect(analyser);
        analyser.connect(this.masterGain);

        // Configure EQ Filters
        highNode.type = 'highshelf'; highNode.frequency.value = 2500; highNode.gain.value = 0;
        midNode.type = 'peaking'; midNode.frequency.value = 1000; midNode.Q.value = 1; midNode.gain.value = 0;
        lowNode.type = 'lowshelf'; lowNode.frequency.value = 250; lowNode.gain.value = 0;

        // Initialize the Signalsmith Stretch node using the library factory
        // NOTE: This will be a "placeholder" node until we load a track
        // Actually, we create a real node and we'll reuse it.
        const stretchNode = await (async () => {
            try {
                // SignalsmithStretch is an async factory that registers the worklet and returns the node
                const node = await SignalsmithStretch(this.ctx);
                node.connect(trimNode);
                return node;
            } catch (e) {
                console.error(`[AudioEngine] CRITICAL: Failed to create SignalsmithStretch node for deck ${deckId}.`, e);
                return null;
            }
        })();

        return {
            source: null,
            stretchNode,
            isKeyLockEnabled: false,
            isLooping: false,
            loopStart: 0,
            loopEnd: 0,
            volumeNode,
            crossfaderNode,
            trimNode,
            filters: { high: highNode, mid: midNode, low: lowNode },
            stemFilters: { bass: stemBass, mid: stemMid, high: stemHigh, drumsKick, drumsHigh },
            fxNodes: { dry: fxDry, wet: fxWet, delayInput, reverbInput, tunaReverb, tunaDelay },
            analyser,
            pannerNode: null,
            buffer: null,
            isPlaying: false,
            startTime: 0,
            pauseTime: 0,
            pitch: 1.0,
            cuePoint: 0,
            gridOffset: 0,
            colorFilter,
        };
    }

    private createRealStemDeck(deckId: string): RealStemDeck {
        const stemNames: RealStemName[] = ['drums', 'bass', 'other', 'vocals'];
        const gains = {} as Record<RealStemName, GainNode>;
        for (const name of stemNames) {
            const gain = this.ctx.createGain();
            gain.connect(this.decks[deckId].volumeNode);
            gains[name] = gain;
        }
        return {
            enabled: false,
            buffers: null,
            sources: { drums: null, bass: null, other: null, vocals: null },
            gains,
            active: { drums: true, bass: true, other: true, vocals: true },
            volumes: { drums: 1, bass: 1, other: 1, vocals: 1 },
        };
    }

    // --- PUBLIC API ---

    async initialize(): Promise<void> {
        await this.ensureReady();
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(console.error);
        }
    }

    // --- PLAYBACK ---

    play(deckId: string) {
        const deck = this.decks[deckId];
        if (!deck || !deck.buffer) return;

        // Disconnect old source if any
        if (deck.source) {
            try { deck.source.disconnect(); } catch (_) { /* ignore */ }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = deck.buffer;

        if (deck.stretchNode) {
            source.connect(deck.stretchNode);
        } else {
            source.connect(deck.trimNode);
        }

        // Apply playback rate (used when key lock is off)
        source.playbackRate.value = deck.pitch;

        const offset = Math.max(0, Math.min(deck.pauseTime, deck.buffer.duration));
        source.start(0, offset);

        source.onended = () => {
            if (deck.source === source && !deck.isLooping) {
                deck.isPlaying = false;
                this.onTrackEnd?.(deckId);
            }
        };

        deck.source = source;
        deck.startTime = this.ctx.currentTime - offset;
        deck.isPlaying = true;
    }

    pause(deckId: string) {
        const deck = this.decks[deckId];
        if (!deck || !deck.source) return;

        const elapsed = this.ctx.currentTime - deck.startTime;
        deck.pauseTime = Math.max(0, Math.min(elapsed, deck.buffer?.duration ?? 0));
        deck.isPlaying = false;

        try {
            deck.source.stop();
        } catch (_) { /* ignore */ }
        deck.source = null;
    }

    seek(deckId: string, normalizedPosition: number) {
        const deck = this.decks[deckId];
        if (!deck || !deck.buffer) return;

        const wasPlaying = deck.isPlaying;
        if (wasPlaying) this.pause(deckId);

        deck.pauseTime = normalizedPosition * deck.buffer.duration;

        if (wasPlaying) this.play(deckId);
    }

    jumpToCue(deckId: string, cueTimeSeconds: number) {
        const deck = this.decks[deckId];
        if (!deck || !deck.buffer) return;

        const wasPlaying = deck.isPlaying;
        if (wasPlaying) this.pause(deckId);
        deck.pauseTime = cueTimeSeconds;
        if (wasPlaying) this.play(deckId);
    }

    beatJump(deckId: string, beats: number, bpm: number) {
        const deck = this.decks[deckId];
        if (!deck || !deck.buffer) return;

        const secondsPerBeat = 60.0 / bpm;
        const jumpSeconds = beats * secondsPerBeat;
        const wasPlaying = deck.isPlaying;
        if (wasPlaying) this.pause(deckId);
        deck.pauseTime = Math.max(0, Math.min((deck.pauseTime + jumpSeconds), deck.buffer.duration));
        if (wasPlaying) this.play(deckId);
    }

    getCurrentTime(deckId: string): number {
        const deck = this.decks[deckId];
        if (!deck) return 0;
        if (!deck.isPlaying) return deck.pauseTime;
        return this.ctx.currentTime - deck.startTime;
    }

    getProgress(deckId: string): number {
        const deck = this.decks[deckId];
        if (!deck || !deck.buffer) return 0;
        const time = this.getCurrentTime(deckId);
        return Math.min(time / deck.buffer.duration, 1);
    }

    getLevel(deckId: string): number {
        const deck = this.decks[deckId];
        const buffer = this.levelBuffers[deckId];
        if (!deck || !buffer) return 0;
        deck.analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
        }
        return Math.sqrt(sum / buffer.length) * 2;
    }

    // --- LOOPING ---

    setLoop(deckId: string, start: number | null, end: number | null) {
        const deck = this.decks[deckId];
        if (!deck) return;

        if (start === null || end === null) {
            deck.isLooping = false;
            if (deck.source) {
                deck.source.loop = false;
            }
        } else {
            deck.isLooping = true;
            deck.loopStart = start;
            deck.loopEnd = end;
            if (deck.source) {
                deck.source.loop = true;
                deck.source.loopStart = start;
                deck.source.loopEnd = end;
            }
        }
    }

    setBeatLoop(deckId: string, beats: number, bpm: number) {
        const deck = this.decks[deckId];
        if (!deck || !deck.buffer) return;

        const secondsPerBeat = 60.0 / bpm;
        const loopLength = beats * secondsPerBeat;
        const currentTime = this.getCurrentTime(deckId);
        const loopStart = currentTime;
        const loopEnd = Math.min(loopStart + loopLength, deck.buffer.duration);

        this.setLoop(deckId, loopStart, loopEnd);
    }

    getLoopBoundaries(deckId: string): { start: number; end: number } | null {
        const deck = this.decks[deckId];
        if (!deck || !deck.isLooping) return null;
        return { start: deck.loopStart, end: deck.loopEnd };
    }

    // --- PITCH / KEY ---

    setPitch(deckId: string, pitchFader: number, pitchRange: number, keyLock: boolean, keyShift: number) {
        const deck = this.decks[deckId];
        if (!deck) return;

        const tempoRatio = 1 + pitchFader * pitchRange;
        this.keyShiftByDeck[deckId] = keyShift;

        if (keyLock && deck.stretchNode) {
            // Key lock: change tempo without pitch change using SignalsmithStretch
            try {
                deck.stretchNode.tempo = tempoRatio;
                // Apply semitone shift
                const keyShiftRatio = Math.pow(2, keyShift / 12);
                deck.stretchNode.tonality = keyShiftRatio;
            } catch (e) {
                console.warn('[AudioEngine] setPitch: stretchNode failed', e);
            }
            // Don't change source playbackRate when key lock is active
        } else {
            // No key lock: pitch and tempo change together (vinyl behavior)
            deck.pitch = tempoRatio;
            if (deck.source) {
                deck.source.playbackRate.value = tempoRatio;
            }
            if (deck.stretchNode) {
                try {
                    deck.stretchNode.tempo = 1.0;
                    deck.stretchNode.tonality = 1.0;
                } catch (e) { /* ignore */ }
            }
        }
    }

    // --- LOADING ---

    loadFile(
        deckId: string,
        file: File,
        onComplete: (track: { id: string; title: string; artist: string; bpm: number; key: string; duration: number }) => void
    ) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            this.ctx.decodeAudioData(arrayBuffer, (buffer) => {
                const deck = this.decks[deckId];
                if (!deck) return;

                if (deck.isPlaying) this.pause(deckId);

                deck.buffer = buffer;
                deck.pauseTime = 0;
                deck.isPlaying = false;

                const name = file.name.replace(/\.[^/.]+$/, '');
                const parts = name.split(' - ');
                const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : name;
                const artist = parts.length > 1 ? parts[0].trim() : 'Unknown Artist';

                onComplete({
                    id: `${Date.now()}-${file.name}`,
                    title,
                    artist,
                    bpm: 120,
                    key: '?',
                    duration: buffer.duration,
                });
            }, (err) => {
                console.error('[AudioEngine] decodeAudioData failed:', err);
            });
        };
        reader.readAsArrayBuffer(file);
    }

    unloadDeck(deckId: string) {
        const deck = this.decks[deckId];
        if (!deck) return;
        if (deck.isPlaying) this.pause(deckId);
        deck.buffer = null;
        deck.pauseTime = 0;
    }

    copyDeck(sourceDeckId: string, targetDeckId: string) {
        const sourceDeck = this.decks[sourceDeckId];
        const targetDeck = this.decks[targetDeckId];
        if (!sourceDeck || !targetDeck || !sourceDeck.buffer) return;

        targetDeck.buffer = sourceDeck.buffer;
        targetDeck.pauseTime = sourceDeck.pauseTime;
    }

    // --- EQ / FX ---

    setEq(deckId: string, band: keyof EqState, value: number) {
        const deck = this.decks[deckId];
        if (!deck) return;

        // Map 0-1 range to dB gain
        // Center (0.75) = 0dB, full up (1.0) = +12dB, full down (0.0) = -inf (mute)
        const mapToGain = (v: number) => {
            if (v < 0.01) return -40;
            const normalized = (v - 0.75) / 0.25;
            return normalized * 12;
        };

        switch (band) {
            case 'trim': deck.trimNode.gain.value = value * 2; break;
            case 'high': deck.filters.high.gain.value = mapToGain(value); break;
            case 'mid': deck.filters.mid.gain.value = mapToGain(value); break;
            case 'low': deck.filters.low.gain.value = mapToGain(value); break;
        }
    }

    setColorFilter(deckId: string, value: number) {
        const deck = this.decks[deckId];
        if (!deck) return;

        const center = 0.5;
        const range = value - center;

        if (Math.abs(range) < 0.02) {
            // Near center: open filter
            deck.colorFilter.type = 'lowpass';
            deck.colorFilter.frequency.value = 24000;
        } else if (range < 0) {
            // Below center: low-pass filter
            deck.colorFilter.type = 'lowpass';
            const normalized = (-range) / 0.5; // 0 to 1
            deck.colorFilter.frequency.value = 20000 * Math.pow(1 - normalized * 0.995, 2);
        } else {
            // Above center: high-pass filter
            deck.colorFilter.type = 'highpass';
            const normalized = range / 0.5; // 0 to 1
            deck.colorFilter.frequency.value = 20 * Math.pow(1000, normalized);
        }
    }

    setFxWet(deckId: string, value: number) {
        const deck = this.decks[deckId];
        if (!deck) return;
        deck.fxNodes.wet.gain.value = value;
        deck.fxNodes.dry.gain.value = 1 - value * 0.5; // Slight dry reduction when wet increases
    }

    setFxParam(deckId: string, knob: 1 | 2, value: number) {
        const deck = this.decks[deckId];
        if (!deck) return;

        const { tunaDelay, tunaReverb } = deck.fxNodes;

        if (knob === 1) {
            // Knob 1: Delay time / Reverb decay
            try {
                if (tunaDelay) tunaDelay.delayTime = value * 2.0; // 0-2s
                if (tunaReverb) tunaReverb.roomSize = value;
            } catch (e) { /* ignore */ }
        } else {
            // Knob 2: Feedback / Reverb dampening
            try {
                if (tunaDelay) tunaDelay.feedback = value * 0.85;
                if (tunaReverb) tunaReverb.dampening = (1 - value) * 20000;
            } catch (e) { /* ignore */ }
        }
    }

    setCrossfader(value: number) {
        const deckA = this.decks['A'];
        const deckB = this.decks['B'];
        if (!deckA || !deckB) return;

        // Value 0-100; 50 = center
        const normalized = value / 100;

        // Equal power crossfade
        const angleA = (1 - normalized) * (Math.PI / 2);
        const angleB = normalized * (Math.PI / 2);

        deckA.crossfaderNode.gain.value = Math.cos(angleA);
        deckB.crossfaderNode.gain.value = Math.cos(angleB);
    }

    setChannelVolume(deckId: string, value: number) {
        const deck = this.decks[deckId];
        if (!deck) return;
        deck.volumeNode.gain.value = value;
    }

    // --- STEMS ---

    setStemVolume(deckId: string, stemType: StemType, value: number) {
        const deck = this.decks[deckId];
        if (!deck) return;

        const stemDeck = this.stemDecks[deckId];
        const DB_FLOOR = -40;
        const mapToGain = (v: number) => {
            if (v < 0.01) return DB_FLOOR;
            return (v - 0.75) * 16;
        };

        switch (stemType) {
            case StemType.LOW:
                deck.stemFilters.bass.gain.value = mapToGain(value);
                deck.stemFilters.drumsKick.gain.value = mapToGain(value);
                break;
            case StemType.BASS:
                deck.stemFilters.bass.gain.value = mapToGain(value);
                break;
            case StemType.MID:
                deck.stemFilters.mid.gain.value = mapToGain(value);
                break;
            case StemType.HIGH:
                deck.stemFilters.high.gain.value = mapToGain(value);
                deck.stemFilters.drumsHigh.gain.value = mapToGain(value);
                break;
        }

        if (stemDeck?.enabled && stemDeck.gains) {
            const stemMap: Record<StemType, RealStemName | null> = {
                [StemType.LOW]: 'drums',
                [StemType.BASS]: 'bass',
                [StemType.MID]: 'other',
                [StemType.HIGH]: 'vocals',
            };
            const realStemName = stemMap[stemType];
            if (realStemName) {
                stemDeck.gains[realStemName].gain.value = value;
            }
        }
    }

    setStemParam(deckId: string, stemType: StemType, value: number) {
        const deck = this.decks[deckId];
        if (!deck) return;

        switch (stemType) {
            case StemType.LOW:
                deck.stemFilters.bass.frequency.value = 100 + (value * 200);
                break;
            case StemType.BASS:
                deck.stemFilters.bass.frequency.value = 150 + (value * 100);
                break;
            case StemType.MID:
                deck.stemFilters.mid.frequency.value = 500 + (value * 1500);
                break;
            case StemType.HIGH:
                deck.stemFilters.high.frequency.value = 2000 + (value * 6000);
                break;
        }
    }

    // --- AI STEMS (NOT AVAILABLE IN WEB MODE) ---
    // AI-powered stem separation is not available in the web build.
    // EQ-based filtering is used instead.

    // --- WAVEFORM GENERATION ---

    async generateWaveformData(deckId: string, file: File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                // Clone the array buffer since decodeAudioData may detach it
                const cloned = arrayBuffer.slice(0);
                this.ctx.decodeAudioData(cloned, (buffer) => {
                    const channelData = buffer.getChannelData(0);
                    const numSamples = 1200;
                    const blockSize = Math.floor(channelData.length / numSamples);
                    const waveformData = [];

                    for (let i = 0; i < numSamples; i++) {
                        const blockStart = blockSize * i;
                        let min = Infinity;
                        let max = -Infinity;
                        let rms = 0;

                        for (let j = 0; j < blockSize; j++) {
                            const sample = channelData[blockStart + j] ?? 0;
                            if (sample < min) min = sample;
                            if (sample > max) max = sample;
                            rms += sample * sample;
                        }

                        waveformData.push({
                            min,
                            max,
                            rms: Math.sqrt(rms / blockSize),
                        });
                    }

                    resolve(waveformData);
                }, reject);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // --- ANALYSIS ---

    async analyzeTrack(deckId: string, file: File): Promise<{ bpm: number; key: string; beats: number[] } | null> {
        // Essentia.js is loaded dynamically
        try {
            // @ts-ignore
            const EssentiaWASM = await import('essentia.js/dist/essentia-wasm.es.js');
            // @ts-ignore
            const { Essentia } = await import('essentia.js');
            const essentia = new Essentia(await EssentiaWASM.default());

            const reader = new FileReader();
            const arrayBuffer: ArrayBuffer = await new Promise((res, rej) => {
                reader.onload = (e) => res(e.target?.result as ArrayBuffer);
                reader.onerror = rej;
                reader.readAsArrayBuffer(file);
            });

            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
            const channelData = audioBuffer.getChannelData(0);
            const vectorData = essentia.arrayToVector(channelData);

            const bpmResult = essentia.PercivalBpmEstimator(vectorData, audioBuffer.sampleRate);
            const bpm = bpmResult.bpm as number;

            const tonal = essentia.KeyExtractor(vectorData, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', audioBuffer.sampleRate, 0.0001, 440, 'cosine', 'hann');
            const key = `${tonal.key} ${tonal.scale === 'major' ? 'maj' : 'min'}`;

            const beatResult = essentia.BeatTrackerMultiFeature(vectorData, audioBuffer.sampleRate);
            const beats: number[] = Array.from(essentia.vectorToArray(beatResult.ticks) as Float32Array);

            return { bpm, key, beats };
        } catch (e) {
            console.warn('[AudioEngine] analyzeTrack failed:', e);
            return null;
        }
    }

    // --- RECORDING ---

    startRecording() {
        if (this.mediaRecorder) return;

        this.recordingDestination = this.ctx.createMediaStreamDestination();
        this.masterGain.connect(this.recordingDestination);

        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream);
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `good-dj-mix-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.recordedChunks = [];
            if (this.recordingDestination) {
                try { this.masterGain.disconnect(this.recordingDestination); } catch (_) { /* ignore */ }
            }
            this.recordingDestination = null;
            this.mediaRecorder = null;
        };
        this.mediaRecorder.start();
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    // --- UTILITIES ---

    getLevel_rms(deckId: string): number {
        const deck = this.decks[deckId];
        const buffer = this.levelBuffers[deckId];
        if (!deck || !buffer) return 0;
        deck.analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        const data = buffer;
        for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
        }
        return Math.sqrt(sum / data.length) * 2.5;
    }
}

export const AudioEngine = new AudioEngineService();







