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
            trimNode,
            filters: { high: highNode, mid: midNode, low: lowNode },
            stemFilters: { 
                bass: stemBass, 
                mid: stemMid, 
                high: stemHigh, 
                drumsKick: drumsKick, 
                drumsHigh: drumsHigh 
            },
            fxNodes: {
                dry: fxDry,
                wet: fxWet,
                delayInput,
                reverbInput,
                tunaReverb,
                tunaDelay,
            },
            volumeNode,
            crossfaderNode,
            analyser,
            pannerNode: null,
            buffer: null,
            isPlaying: false,
            startTime: 0,
            pauseTime: 0,
            pitch: 0,
            cuePoint: 0,
            gridOffset: 0,
            colorFilter
        };
    }

    private createRealStemDeck(deckId: string): RealStemDeck {
        const createGain = () => {
            const gainNode = this.ctx.createGain();
            gainNode.gain.value = 1;
            gainNode.connect(this.decks[deckId].trimNode);
            return gainNode;
        };

        return {
            enabled: false,
            buffers: null,
            sources: {
                drums: null,
                bass: null,
                other: null,
                vocals: null,
            },
            gains: {
                drums: createGain(),
                bass: createGain(),
                other: createGain(),
                vocals: createGain(),
            },
            active: {
                drums: true,
                bass: true,
                other: true,
                vocals: true,
            },
            volumes: {
                drums: 1,
                bass: 1,
                other: 1,
                vocals: 1,
            },
        };
    }

    private hasRealStemPlayback(deckId: string) {
        const stemDeck = this.stemDecks[deckId];
        return Boolean(stemDeck?.enabled && stemDeck.buffers);
    }

    private getDeckDuration(deckId: string) {
        const stemDuration = this.stemDecks[deckId]?.buffers?.drums.duration;
        return stemDuration ?? this.decks[deckId]?.buffer?.duration ?? 0;
    }

    private getCurrentPositionSeconds(deckId: string) {
        const deck = this.decks[deckId];
        const duration = this.getDeckDuration(deckId) || 1;

        if (!deck.isPlaying) {
            return Math.min(deck.pauseTime, duration);
        }

        const pitchRate = 1 + deck.pitch;
        return ((this.ctx.currentTime - deck.startTime) * pitchRate) % duration;
    }

    private stemTypeToRealStem(stem: StemType): RealStemName {
        if (stem === StemType.DRUMS) return 'drums';
        if (stem === StemType.BASS) return 'bass';
        if (stem === StemType.OTHER) return 'other';
        return 'vocals';
    }

    private updateRealStemGain(deckId: string, stemName: RealStemName) {
        const stemDeck = this.stemDecks[deckId];
        const gain = stemDeck.active[stemName] ? stemDeck.volumes[stemName] : 0;
        stemDeck.gains[stemName].gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }

    private clearRealStemSources(deckId: string, when?: number) {
        const stemDeck = this.stemDecks[deckId];
        for (const stemName of Object.keys(stemDeck.sources) as RealStemName[]) {
            const source = stemDeck.sources[stemName];
            if (!source) {
                continue;
            }

            source.onended = null;
            try {
                source.stop(when);
            } catch {
                // BufferSourceNodes are one-shot and may already be stopped.
            }
            source.disconnect();
            stemDeck.sources[stemName] = null;
        }
    }

    private clearRealStems(deckId: string) {
        this.clearRealStemSources(deckId);
        const stemDeck = this.stemDecks[deckId];
        stemDeck.enabled = false;
        stemDeck.buffers = null;
    }

    private startRealStemPlayback(deckId: string, offsetSeconds: number, when = this.ctx.currentTime) {
        const deck = this.decks[deckId];
        const stemDeck = this.stemDecks[deckId];
        if (!stemDeck.buffers) {
            return;
        }

        const pitchRate = 1 + deck.pitch;
        const keyShift = this.keyShiftByDeck[deckId] || 0;
        const playbackRate = pitchRate * Math.pow(2, keyShift / 12);
        const duration = this.getDeckDuration(deckId);
        const safeOffset = Math.max(0, Math.min(offsetSeconds, Math.max(duration - 0.001, 0)));

        this.clearRealStemSources(deckId, when);

        for (const stemName of Object.keys(stemDeck.buffers) as RealStemName[]) {
            const source = this.ctx.createBufferSource();
            source.buffer = stemDeck.buffers[stemName];
            source.playbackRate.value = playbackRate;
            source.connect(stemDeck.gains[stemName]);

            if (deck.isLooping && deck.loopEnd > deck.loopStart) {
                source.loop = true;
                source.loopStart = deck.loopStart;
                source.loopEnd = deck.loopEnd;
            }

            if (stemName === 'drums') {
                source.onended = () => {
                    if (deck.isPlaying && stemDeck.sources.drums === source) {
                        this.clearRealStemSources(deckId);
                        deck.isPlaying = false;
                        deck.pauseTime = duration;
                        if (this.onTrackEnd) this.onTrackEnd(deckId);
                    }
                };
            }

            source.start(when, safeOffset);
            stemDeck.sources[stemName] = source;
            this.updateRealStemGain(deckId, stemName);
        }
    }

    private stopCurrentPlayback(deckId: string, when?: number) {
        const deck = this.decks[deckId];

        if (this.hasRealStemPlayback(deckId)) {
            this.clearRealStemSources(deckId, when);
            return;
        }

        if (deck.source) {
            deck.source.onended = null;
            try {
                deck.source.stop(when);
            } catch {
                // Already stopped.
            }
            deck.source.disconnect();
            deck.source = null;
            return;
        }

        if (deck.stretchNode) {
            deck.stretchNode.stop(when);
        }
    }

    private createStemBuffer(data: Float32Array | number[], sampleRate: number) {
        // SB-5 fix: Create stereo buffer.
        // If data arrives as interleaved stereo (L,R,L,R,...), deinterleave.
        // If data is mono, duplicate to both channels.
        const isStereo = data.length % 2 === 0;
        const frameCount = isStereo ? Math.floor(data.length / 2) : data.length;
        const buffer = this.ctx.createBuffer(2, frameCount, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        if (isStereo && data.length > frameCount) {
            // Deinterleave stereo data
            for (let i = 0; i < frameCount; i++) {
                left[i] = data[i * 2];
                right[i] = data[i * 2 + 1];
            }
        } else {
            // Mono fallback: duplicate to both channels
            const monoData = data instanceof Float32Array ? data : new Float32Array(data);
            left.set(monoData);
            right.set(monoData);
        }
        return buffer;
    }

    // --- UTILS ---

    public async resume() {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
    }

    public hasBuffer(deckId: string): boolean {
        return !!this.decks[deckId]?.buffer;
    }

    /** Get the raw AudioBuffer for a deck (used by track analyzer). */
    public getBuffer(deckId: string): AudioBuffer | null {
        return this.decks[deckId]?.buffer || null;
    }

    public async setAudioOutput(deviceId: string) {
        // @ts-expect-error -- setSinkId is a newer API not yet in all TS lib definitions
        if (typeof this.ctx.setSinkId === 'function') {
            try {
                // @ts-expect-error -- setSinkId is a newer API
                await this.ctx.setSinkId(deviceId);
                console.log(`Audio output set to ${deviceId}`);
            } catch (err) {
                console.error("Failed to set audio output", err);
            }
        }
    }



    public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
        return await this.ctx.decodeAudioData(arrayBuffer);
    }

    public async loadFile(deckId: string, file: File): Promise<{ duration: number; waveform: any[] }> {
        await this.ensureReady();
        await this.resume();

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

        const deck = this.decks[deckId];
        this.stopCurrentPlayback(deckId);
        this.clearRealStems(deckId);

        deck.buffer = audioBuffer;
        deck.pauseTime = 0;
        deck.startTime = 0;
        deck.cuePoint = 0;
        deck.isPlaying = false;

        // Initialize Signalsmith Stretch via Worklet if not already ready
        if (deck.stretchNode) {
            // Node is already initialized in createDeckNode
        }

        // Load decoded buffers into the stretch node using library API
        if (deck.stretchNode) {
            try {
                const channels = [];
                for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                    channels.push(audioBuffer.getChannelData(i));
                }

                // addBuffers is the library's way to load the source audio
                if ((deck.stretchNode as any).addBuffers) {
                    await (deck.stretchNode as any).dropBuffers();
                    await (deck.stretchNode as any).addBuffers(channels);
                    console.log(`[AudioEngine] Loaded ${channels.length} channels into SignalsmithStretch for deck ${deckId}`);
                }
            } catch (e) {
                console.error(`[AudioEngine] Failed to load buffers into stretchNode for deck ${deckId}`, e);
            }
        }

        return {
            duration: audioBuffer.duration,
            waveform: await this.processWaveform(audioBuffer)
        };
    }

    public cloneDeck(sourceId: string, targetId: string) {
        if (!this.isReady) return;
        const source = this.decks[sourceId];
        const target = this.decks[targetId];

        if (!source.buffer) return;

        this.stopCurrentPlayback(targetId);
        this.clearRealStems(targetId);

        target.buffer = source.buffer;
        target.isPlaying = false;
        target.pauseTime = 0;
        target.startTime = 0;
        target.cuePoint = 0;
        target.pitch = source.pitch;
        target.gridOffset = source.gridOffset;
        target.isKeyLockEnabled = source.isKeyLockEnabled;
        target.isLooping = source.isLooping;
        target.loopStart = source.loopStart;
        target.loopEnd = source.loopEnd;

        if (target.stretchNode && target.buffer) {
            const channels = [];
            for (let i = 0; i < target.buffer.numberOfChannels; i++) {
                channels.push(target.buffer.getChannelData(i));
            }
            target.stretchNode.dropBuffers();
            target.stretchNode.addBuffers(channels);
        }

        this.updatePitch(targetId, source.pitch);
    }

    public eject(deckId: string) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        this.stopCurrentPlayback(deckId);
        this.clearRealStems(deckId);
        deck.buffer = null;
        if (deck.stretchNode) deck.stretchNode.dropBuffers();
        deck.isPlaying = false;
        deck.isLooping = false;
        deck.loopStart = 0;
        deck.loopEnd = 0;
        deck.pauseTime = 0;
        deck.startTime = 0;
        deck.cuePoint = 0;
        deck.pitch = 0;
        deck.gridOffset = 0;
        this.updatePitch(deckId, 0);
    }

    private async processWaveform(buffer: AudioBuffer): Promise<any[]> {
        const points = 1000;
        const offlineCtx = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
        
        // --- SPECTRAL SPLIT ---
        // Separate audio into 3 bands: Low (< 200Hz), Mid (200Hz - 2.5kHz), High (> 2.5kHz)
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;

        const lowFilter = offlineCtx.createBiquadFilter();
        lowFilter.type = 'lowpass';
        lowFilter.frequency.value = 200;

        const midFilter = offlineCtx.createBiquadFilter();
        midFilter.type = 'bandpass';
        midFilter.frequency.value = 1350; // Center of 200 and 2500
        midFilter.Q.value = 0.5;

        const highFilter = offlineCtx.createBiquadFilter();
        highFilter.type = 'highpass';
        highFilter.frequency.value = 2500;

        // Peak Analysis Nodes
        const lowGain = offlineCtx.createGain();
        const midGain = offlineCtx.createGain();
        const highGain = offlineCtx.createGain();

        source.connect(lowFilter).connect(lowGain).connect(offlineCtx.destination);
        source.connect(midFilter).connect(midGain).connect(offlineCtx.destination);
        source.connect(highFilter).connect(highGain).connect(offlineCtx.destination);

        // We run 3 parallel offline renders for each band
        // Actually, we can just render once and use Analysers if we were doing it real-time.
        // For offline, we'll run 3 separate passes to get specific buffers for each band.
        
        const renderBand = async (filter: BiquadFilterNode) => {
            const innerCtx = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
            const innerSource = innerCtx.createBufferSource();
            innerSource.buffer = buffer;
            const innerFilter = innerCtx.createBiquadFilter();
            innerFilter.type = filter.type;
            innerFilter.frequency.value = filter.frequency.value;
            innerFilter.Q.value = filter.Q.value;
            
            innerSource.connect(innerFilter).connect(innerCtx.destination);
            innerSource.start();
            const rendered = await innerCtx.startRendering();
            return rendered.getChannelData(0);
        };

        console.log(`[AudioEngine] Starting Spectral Analysis for ${buffer.duration.toFixed(2)}s track...`);
        const [lowData, midData, highData] = await Promise.all([
            renderBand(lowFilter),
            renderBand(midFilter),
            renderBand(highFilter)
        ]);

        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL('./waveform.worker.ts', import.meta.url), { type: 'module' });
            
            worker.onmessage = (e) => {
                const { result } = e.data;
                console.log(`[AudioEngine] Spectral Analysis complete.`);
                worker.terminate();
                resolve(result);
            };
 
            worker.onerror = (err) => {
                console.error('[AudioEngine] Waveform Worker Error:', err);
                worker.terminate();
                reject(err);
            };
 
            // Use transferables for zero-copy data passing
            worker.postMessage({
                lowData,
                midData,
                highData,
                points,
                sampleRate: buffer.sampleRate
            }, [lowData.buffer, midData.buffer, highData.buffer]);
        });
    }

    // --- PLAYBACK CONTROL ---

    public setReverbPreset(deckId: string, presetName: string) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        if (deck) {
            this.tunaFx.applyReverbPreset(deck.fxNodes.tunaReverb, presetName);
        }
    }

    public async play(deckId: string) {
        if (!this.isReady) return;
        this.resume(); // Ensure context is running
        const deck = this.decks[deckId];
        if (!deck.buffer || deck.isPlaying) return;

        const pitchRate = 1 + deck.pitch;
        const keyShift = this.keyShiftByDeck[deckId] || 0;

        if (this.hasRealStemPlayback(deckId)) {
            this.startRealStemPlayback(deckId, deck.pauseTime);
            deck.startTime = this.ctx.currentTime - (deck.pauseTime / pitchRate);
            deck.isPlaying = true;
            return;
        }

        if (deck.isKeyLockEnabled && deck.stretchNode) {
            try {
                // start(when, offset, duration, rate, semitones)
                if ((deck.stretchNode as any).start) {
                    await (deck.stretchNode as any).start(this.ctx.currentTime, deck.pauseTime, undefined, pitchRate, keyShift);
                }
            } catch (e) {
                console.error(`[AudioEngine] Failed to start stretchNode for deck ${deckId}`, e);
            }
        } else {
            // KeyLock OFF: Standard playback — tempo AND key shift both applied
            deck.source = this.ctx.createBufferSource();
            deck.source.buffer = deck.buffer;
            deck.source.connect(deck.trimNode);
            // Apply tempo pitch change PLUS manual key shift
            const semitoneMultiplier = Math.pow(2, keyShift / 12);
            deck.source.playbackRate.value = pitchRate * semitoneMultiplier;
            deck.source.onended = () => {
                if (deck.isPlaying) {
                    deck.isPlaying = false;
                    deck.pauseTime = deck.buffer?.duration || 0;
                    deck.source = null;
                    if (this.onTrackEnd) this.onTrackEnd(deckId);
                }
            };
            deck.source.start(0, deck.pauseTime);
        }
        deck.startTime = this.ctx.currentTime - (deck.pauseTime / pitchRate);
        deck.isPlaying = true;
    }

    public pause(deckId: string) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        if (!deck.isPlaying) return;

        deck.pauseTime = this.getCurrentPositionSeconds(deckId);
        this.stopCurrentPlayback(deckId);

        deck.isPlaying = false;
    }

    public async setLoop(deckId: string, beatsLength: number | null, fallbackBpm: number, beats?: number[]) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        deck.isLooping = beatsLength !== null;

        if (!deck.buffer) return;

        // If disabling loop
        if (beatsLength === null) {
            deck.loopStart = 0;
            deck.loopEnd = 0;
            if (this.hasRealStemPlayback(deckId)) {
                for (const source of Object.values(this.stemDecks[deckId].sources)) {
                    if (!source) continue;
                    source.loop = false;
                    source.loopStart = 0;
                    source.loopEnd = 0;
                }
            } else if (deck.source) {
                deck.source.loop = false;
                deck.source.loopStart = 0;
                deck.source.loopEnd = 0;
            }
            if ((deck.stretchNode as any).stop) {
                await (deck.stretchNode as any).stop(this.ctx.currentTime);
            }
            return;
        }

        // Calculate loop points
        const currentPos = this.getCurrentPositionSeconds(deckId);

        let loopStart = currentPos;
        let loopEnd = currentPos;

        if (beats && beats.length > 0) {
            let beatIndex = 0;
            for (let i = 0; i < beats.length; i++) {
                if (beats[i] > currentPos) {
                    beatIndex = Math.max(0, i - 1);
                    break;
                }
            }

            loopStart = beats[beatIndex];
            const targetEndIndex = Math.min(beats.length - 1, beatIndex + beatsLength);
            loopEnd = beats[targetEndIndex];

            if (loopEnd <= loopStart) {
                loopEnd = loopStart + (beatsLength * (60 / fallbackBpm));
            }
        } else {
            const beatDuration = 60 / fallbackBpm;
            loopStart = currentPos - (currentPos % beatDuration);
            loopEnd = loopStart + (beatsLength * beatDuration);
        }

        // Store loop boundaries for persistence
        deck.loopStart = loopStart;
        deck.loopEnd = loopEnd;

        // Apply the loop
        this.applyLoop(deckId);
    }

    /** Apply the stored loop boundaries to the current playback node. */
    private applyLoop(deckId: string) {
        const deck = this.decks[deckId];
        if (!deck.isLooping || deck.loopEnd <= deck.loopStart) return;

        if (this.hasRealStemPlayback(deckId)) {
            for (const source of Object.values(this.stemDecks[deckId].sources)) {
                if (!source) continue;
                source.loop = true;
                source.loopStart = deck.loopStart;
                source.loopEnd = deck.loopEnd;
            }

            if (deck.isPlaying && this.getCurrentPositionSeconds(deckId) > deck.loopEnd) {
                this.seek(deckId, deck.loopStart / (this.getDeckDuration(deckId) || 1));
            }
            return;
        }

        if (deck.isKeyLockEnabled && deck.stretchNode) {
            (deck.stretchNode as any).schedule({
                outputTime: this.ctx.currentTime,
                active: true,
                loopStart: deck.loopStart,
                loopEnd: deck.loopEnd
            });
        } else if (deck.source) {
            deck.source.loopStart = deck.loopStart;
            deck.source.loopEnd = deck.loopEnd;
            deck.source.loop = true;

            // If we are already PAST the new loop end, jump back immediately
            if (deck.isPlaying && deck.buffer) {
                const currentPos = this.getCurrentPositionSeconds(deckId);
                if (currentPos > deck.loopEnd) {
                    this.seek(deckId, deck.loopStart / deck.buffer.duration);
                }
            }
        }
    }

    public seek(deckId: string, position: number) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        const duration = this.getDeckDuration(deckId);
        const seekTime = position * duration;

        const wasPlaying = deck.isPlaying;

        if (wasPlaying) {
            this.stopCurrentPlayback(deckId);
            deck.isPlaying = false;
        }

        deck.pauseTime = seekTime;

        if (wasPlaying) {
            if (this.hasRealStemPlayback(deckId)) {
                this.startRealStemPlayback(deckId, seekTime);
            } else if (deck.isKeyLockEnabled && deck.stretchNode) {
                const pitchRate = 1 + deck.pitch;
                const keyShift = this.keyShiftByDeck[deckId] || 0;
                (deck.stretchNode as any).start(this.ctx.currentTime, seekTime, undefined, pitchRate, keyShift);
            } else {
                deck.source = this.ctx.createBufferSource();
                deck.source.buffer = deck.buffer!;
                deck.source.connect(deck.trimNode);
                const pitchRate = 1 + deck.pitch;
                const keyShift = this.keyShiftByDeck[deckId] || 0;
                const semitoneMultiplier = Math.pow(2, keyShift / 12);
                deck.source.playbackRate.value = pitchRate * semitoneMultiplier;
                deck.source.onended = () => {
                    if (deck.isPlaying) {
                        deck.isPlaying = false;
                        deck.pauseTime = deck.buffer?.duration || 0;
                        deck.source = null;
                        if (this.onTrackEnd) this.onTrackEnd(deckId);
                    }
                };

                if (deck.isLooping && deck.loopEnd > deck.loopStart) {
                    deck.source.loop = true;
                    deck.source.loopStart = deck.loopStart;
                    deck.source.loopEnd = deck.loopEnd;
                }

                deck.source.start(0, seekTime);
            }

            deck.startTime = this.ctx.currentTime - (seekTime / (1 + deck.pitch));
            deck.isPlaying = true;
        }
    }

    public setVolume(deckId: string, value: number) {
        if (!this.isReady) return;
        this.decks[deckId].volumeNode.gain.value = value;
    }

    public setCrossfader(deckId: string, value: number) {
        if (!this.isReady) return;
        this.decks[deckId].crossfaderNode.gain.value = value;
    }

    public setEq(deckId: string, band: keyof EqState, value: number) {
        if (!this.isReady) return;
        const filter = this.decks[deckId].filters[band];
        if (filter) {
            filter.gain.value = value;
        }
    }

    public setColorFilter(deckId: string, value: number) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        const BYPASS_FREQ = 24000;

        if (value === 0) {
            deck.colorFilter.frequency.value = BYPASS_FREQ;
            deck.colorFilter.type = 'lowpass';
            return;
        }

        const range = 0.4; // ±40% range for Color knob
        const lp_start = 200;
        const lp_end = 18000;
        const hp_start = 18000;
        const hp_end = 200;

        if (value < 0) { // LPF Side
            const t = (-value) / 1;
            const freq = lp_start + (lp_end - lp_start) * (1 - t);
            deck.colorFilter.type = 'lowpass';
            deck.colorFilter.frequency.value = freq;
        } else { // HPF Side
            const t = value / 1;
            const freq = hp_start * Math.pow(hp_end / hp_start, t);
            deck.colorFilter.type = 'highpass';
            deck.colorFilter.frequency.value = freq;
        }
    }

    public setTrim(deckId: string, value: number) {
        if (!this.isReady) return;
        this.decks[deckId].trimNode.gain.value = value;
    }

    public setFxAmount(deckId: string, fxType: EffectType, amount: number) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        switch(fxType) {
            case EffectType.REVERB:
                deck.fxNodes.wet.gain.value = amount;
                deck.fxNodes.dry.gain.value = 1 - amount;
                deck.fxNodes.reverbInput.gain.value = 1;
                deck.fxNodes.delayInput.gain.value = 0;
                break;
            case EffectType.DELAY:
                deck.fxNodes.wet.gain.value = amount;
                deck.fxNodes.dry.gain.value = 1 - amount;
                deck.fxNodes.delayInput.gain.value = 1;
                deck.fxNodes.reverbInput.gain.value = 0;
                break;
            default:
                deck.fxNodes.wet.gain.value = 0;
                deck.fxNodes.dry.gain.value = 1;
                deck.fxNodes.delayInput.gain.value = 0;
                deck.fxNodes.reverbInput.gain.value = 0;
        }
    }

    public updatePitch(deckId: string, semitones: number) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        const oldPitch = deck.pitch;

        if (oldPitch === semitones) return;

        const wasPlaying = deck.isPlaying;
        const currentPos = wasPlaying ? this.getCurrentPositionSeconds(deckId) : deck.pauseTime;

        deck.pitch = semitones;

        if (wasPlaying) {
            this.stopCurrentPlayback(deckId);
            deck.isPlaying = false;

            if (this.hasRealStemPlayback(deckId)) {
                this.startRealStemPlayback(deckId, currentPos);
            } else if (deck.isKeyLockEnabled && deck.stretchNode) {
                const pitchRate = 1 + semitones;
                const keyShift = this.keyShiftByDeck[deckId] || 0;
                (deck.stretchNode as any).start(this.ctx.currentTime, currentPos, undefined, pitchRate, keyShift);
            } else {
                deck.source = this.ctx.createBufferSource();
                deck.source.buffer = deck.buffer!;
                deck.source.connect(deck.trimNode);
                const pitchRate = 1 + semitones;
                const keyShift = this.keyShiftByDeck[deckId] || 0;
                const semitoneMultiplier = Math.pow(2, keyShift / 12);
                deck.source.playbackRate.value = pitchRate * semitoneMultiplier;
                deck.source.onended = () => {
                    if (deck.isPlaying) {
                        deck.isPlaying = false;
                        deck.pauseTime = deck.buffer?.duration || 0;
                        deck.source = null;
                        if (this.onTrackEnd) this.onTrackEnd(deckId);
                    }
                };
                if (deck.isLooping && deck.loopEnd > deck.loopStart) {
                    deck.source.loop = true;
                    deck.source.loopStart = deck.loopStart;
                    deck.source.loopEnd = deck.loopEnd;
                }
                deck.source.start(0, currentPos);
            }

            deck.startTime = this.ctx.currentTime - (currentPos / (1 + semitones));
            deck.isPlaying = true;
        }
    }

    public setKeyShift(deckId: string, semitones: number) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        const wasPlaying = deck.isPlaying;
        const currentPos = wasPlaying ? this.getCurrentPositionSeconds(deckId) : deck.pauseTime;

        this.keyShiftByDeck[deckId] = semitones;

        if (wasPlaying) {
            this.stopCurrentPlayback(deckId);
            deck.isPlaying = false;

            if (this.hasRealStemPlayback(deckId)) {
                this.startRealStemPlayback(deckId, currentPos);
            } else if (deck.isKeyLockEnabled && deck.stretchNode) {
                const pitchRate = 1 + deck.pitch;
                (deck.stretchNode as any).start(this.ctx.currentTime, currentPos, undefined, pitchRate, semitones);
            } else {
                deck.source = this.ctx.createBufferSource();
                deck.source.buffer = deck.buffer!;
                deck.source.connect(deck.trimNode);
                const pitchRate = 1 + deck.pitch;
                const semitoneMultiplier = Math.pow(2, semitones / 12);
                deck.source.playbackRate.value = pitchRate * semitoneMultiplier;
                deck.source.onended = () => {
                    if (deck.isPlaying) {
                        deck.isPlaying = false;
                        deck.pauseTime = deck.buffer?.duration || 0;
                        deck.source = null;
                        if (this.onTrackEnd) this.onTrackEnd(deckId);
                    }
                };
                if (deck.isLooping && deck.loopEnd > deck.loopStart) {
                    deck.source.loop = true;
                    deck.source.loopStart = deck.loopStart;
                    deck.source.loopEnd = deck.loopEnd;
                }
                deck.source.start(0, currentPos);
            }

            deck.startTime = this.ctx.currentTime - (currentPos / (1 + deck.pitch));
            deck.isPlaying = true;
        }
    }

    public getLevel(deckId: string): number {
        if (!this.isReady) return 0;
        const analyser = this.decks[deckId]?.analyser;
        if (!analyser) return 0;

        const buffer = this.levelBuffers[deckId];
        if (!buffer) return 0;
        analyser.getByteFrequencyData(buffer);
        const sum = buffer.reduce((a, b) => a + b, 0);
        return sum / (buffer.length * 255);
    }

    public getWaveformSlice(deckId: string, centerPosition: number, windowSeconds: number): Float32Array | null {
        const deck = this.decks[deckId];
        if (!deck?.buffer) return null;

        const buffer = deck.buffer;
        const sampleRate = buffer.sampleRate;
        const channelData = buffer.getChannelData(0);
        const totalSamples = channelData.length;

        const halfWindow = windowSeconds / 2;
        const startSample = Math.max(0, Math.floor((centerPosition - halfWindow) * sampleRate));
        const endSample = Math.min(totalSamples, Math.ceil((centerPosition + halfWindow) * sampleRate));
        
        return channelData.slice(startSample, endSample);
    }

    // --- STEM CONTROL ---

    public setStemVolume(deckId: string, stem: StemType, value: number) {
        if (!this.isReady) return;
        const stemName = this.stemTypeToRealStem(stem);
        const stemDeck = this.stemDecks[deckId];
        stemDeck.volumes[stemName] = value;
        this.updateRealStemGain(deckId, stemName);
    }

    public toggleStem(deckId: string, stem: StemType) {
        if (!this.isReady) return;
        const stemName = this.stemTypeToRealStem(stem);
        const stemDeck = this.stemDecks[deckId];
        stemDeck.active[stemName] = !stemDeck.active[stemName];
        this.updateRealStemGain(deckId, stemName);
    }

    public isStemActive(deckId: string, stem: StemType): boolean {
        const stemName = this.stemTypeToRealStem(stem);
        return this.stemDecks[deckId]?.active[stemName] ?? true;
    }

    public getStemVolume(deckId: string, stem: StemType): number {
        const stemName = this.stemTypeToRealStem(stem);
        return this.stemDecks[deckId]?.volumes[stemName] ?? 1;
    }

    public async loadStems(deckId: string, result: StemSeparationResult): Promise<void> {
        await this.ensureReady();
        const stemDeck = this.stemDecks[deckId];
        const deck = this.decks[deckId];
        const wasPlaying = deck.isPlaying;
        const currentPos = wasPlaying ? this.getCurrentPositionSeconds(deckId) : deck.pauseTime;

        if (wasPlaying) {
            this.stopCurrentPlayback(deckId);
            deck.isPlaying = false;
        }

        stemDeck.buffers = {
            drums: this.createStemBuffer(result.stems[StemType.DRUMS].data, result.stems[StemType.DRUMS].sampleRate),
            bass:  this.createStemBuffer(result.stems[StemType.BASS].data,  result.stems[StemType.BASS].sampleRate),
            other: this.createStemBuffer(result.stems[StemType.OTHER].data, result.stems[StemType.OTHER].sampleRate),
            vocals: this.createStemBuffer(result.stems[StemType.VOCALS].data, result.stems[StemType.VOCALS].sampleRate),
        };
        stemDeck.enabled = true;

        if (wasPlaying) {
            this.startRealStemPlayback(deckId, currentPos);
            deck.startTime = this.ctx.currentTime - (currentPos / (1 + deck.pitch));
            deck.isPlaying = true;
        }
    }

    // --- RECORDING ---

    public startRecording() {
        if (!this.isReady) return;
        this.recordingDestination = this.ctx.createMediaStreamDestination();
        this.masterGain.connect(this.recordingDestination);

        this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        this.recordedChunks = [];
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };

        this.mediaRecorder.start(100);
    }

    public stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                reject(new Error('Not recording'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                this.recordedChunks = [];

                if (this.recordingDestination) {
                    this.masterGain.disconnect(this.recordingDestination);
                    this.recordingDestination = null;
                }

                resolve(blob);
            };

            this.mediaRecorder.stop();
        });
    }
}

export const audioEngine = new AudioEngineService();
