

import { AudioDeck, EqState, EffectType, StemType } from '../types';
import SignalsmithStretch from 'signalsmith-stretch';
import { EffectsEngine } from './effects_engine';

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

    constructor() {
        this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
        this.tunaFx = new EffectsEngine(this.ctx);
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        // Pre-generate Reverb IR
        this.impulseBuffer = this.createImpulseResponse(2.0, 2.0);

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

    // --- UTILS ---

    private createImpulseResponse(duration: number, decay: number): AudioBuffer {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = i;
            const factor = Math.pow(1 - n / length, decay);
            left[i] = (Math.random() * 2 - 1) * factor;
            right[i] = (Math.random() * 2 - 1) * factor;
        }
        return impulse;
    }

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
        // this.playSpinUp(); // SFX Removed

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

        const deck = this.decks[deckId];
        if (deck.source) {
            deck.source.onended = null;
            try {
                deck.source.stop();
                deck.source.disconnect();
            } catch (e) {
                console.warn("Could not stop prior deck source:", e);
            }
            deck.source = null;
        }

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

        if (target.source) {
            target.source.onended = null;
            try {
                target.source.stop();
                target.source.disconnect();
            } catch (e) {
                console.warn("Could not stop target deck source:", e);
            }
            target.source = null;
        }

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
        if (deck.source) {
            try {
                deck.source.onended = null;
                deck.source.stop();
                deck.source.disconnect();
            } catch (e) { }
            deck.source = null;
        }
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
        if (!deck.isPlaying || !deck.source) return;

        const pitchRate = 1 + deck.pitch;
        const elapsed = (this.ctx.currentTime - deck.startTime) * pitchRate;
        deck.pauseTime = (elapsed % (deck.buffer?.duration || 1));

        if (deck.source) {
            deck.source.onended = null;
            deck.source.stop();
            deck.source.disconnect();
            deck.source = null;
        } else if (deck.stretchNode) {
            deck.stretchNode.stop();
        }

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
            if (deck.source) {
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
        const pitchRate = 1 + deck.pitch;
        let currentPos = deck.pauseTime;
        if (deck.isPlaying) {
            currentPos = ((this.ctx.currentTime - deck.startTime) * pitchRate) % deck.buffer.duration;
        }

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
                const pitchRate = 1 + deck.pitch;
                const currentPos = ((this.ctx.currentTime - deck.startTime) * pitchRate) % deck.buffer.duration;
                if (currentPos > deck.loopEnd) {
                    this.seek(deckId, deck.loopStart / deck.buffer.duration);
                }
            }
        }
    }

    /** Halve the current loop length, keeping the loop start point. */
    public halveLoop(deckId: string) {
        const deck = this.decks[deckId];
        if (!deck.isLooping || deck.loopEnd <= deck.loopStart) return;

        const halfLength = (deck.loopEnd - deck.loopStart) / 2;
        if (halfLength < 0.05) return; // Don't go below ~50ms

        deck.loopEnd = deck.loopStart + halfLength;
        this.applyLoop(deckId);
    }

    /** Double the current loop length, keeping the loop start point. */
    public doubleLoop(deckId: string) {
        const deck = this.decks[deckId];
        if (!deck.isLooping || deck.loopEnd <= deck.loopStart || !deck.buffer) return;

        const doubleLength = (deck.loopEnd - deck.loopStart) * 2;
        deck.loopEnd = Math.min(deck.buffer.duration, deck.loopStart + doubleLength);
        this.applyLoop(deckId);
    }

    /** Get the current loop boundaries (for waveform visualization). */
    public getLoopBoundaries(deckId: string): { start: number; end: number } | null {
        if (!this.isReady) return null;
        const deck = this.decks[deckId];
        if (!deck.isLooping || !deck.buffer || deck.loopEnd <= deck.loopStart) return null;

        return {
            start: deck.loopStart / deck.buffer.duration,
            end: deck.loopEnd / deck.buffer.duration,
        };
    }

    public async seek(deckId: string, progress: number) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        if (!deck.buffer) return;

        const timeInSeconds = progress * deck.buffer.duration;

        if (!deck.isPlaying || !deck.source) {
            deck.pauseTime = timeInSeconds;
            return;
        }

        // Zero-latency seamless jump using Web Audio API scheduling
        const now = this.ctx.currentTime;
        const pitchRate = 1 + deck.pitch;
        const keyShift = this.keyShiftByDeck[deckId] || 0;

        // Stop current playing node
        if (deck.source) {
            deck.source.onended = null;
            deck.source.stop(now);
            deck.source.disconnect();
            deck.source = null;
        } else if (deck.stretchNode) {
            deck.stretchNode.stop(now);
        }

        // Apply pitch/rate immediately
        if (deck.isKeyLockEnabled && deck.stretchNode) {
            try {
                if ((deck.stretchNode as any).schedule) {
                    await (deck.stretchNode as any).schedule({
                        outputTime: now,
                        active: true,
                        input: timeInSeconds,
                        rate: pitchRate,
                        semitones: keyShift
                    });
                }
                if ((deck.stretchNode as any).start) {
                    await (deck.stretchNode as any).start(now);
                }
            } catch (e) {
                console.error(`[AudioEngine] Failed to seek stretchNode for deck ${deckId}`, e);
            }
        } else {
            // Spin up a new node from the target position
            const newSource = this.ctx.createBufferSource();
            newSource.buffer = deck.buffer;
            newSource.connect(deck.trimNode);
            newSource.playbackRate.value = pitchRate * Math.pow(2, keyShift / 12);

            // Re-attach completion handler
            newSource.onended = () => {
                if (deck.isPlaying && deck.source === newSource) {
                    deck.isPlaying = false;
                    deck.pauseTime = deck.buffer?.duration || 0;
                    deck.source = null;
                    if (this.onTrackEnd) this.onTrackEnd(deckId);
                }
            };

            newSource.start(now, timeInSeconds);
            deck.source = newSource;
        }

        // Sync local clock and start playing
        deck.pauseTime = timeInSeconds;
        deck.startTime = now - (timeInSeconds / pitchRate);

        // Re-apply loop if active
        if (deck.isLooping && deck.loopEnd > deck.loopStart) {
            this.applyLoop(deckId);
        }
    }

    public beatJump(deckId: string, beatsMove: number, fallbackBpm: number, beats?: number[]) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        if (!deck.buffer) return;

        const pitchRate = 1 + deck.pitch;
        let currentPos = deck.pauseTime;
        if (deck.isPlaying) {
            currentPos = ((this.ctx.currentTime - deck.startTime) * pitchRate) % deck.buffer.duration;
        }

        let newPos = currentPos;

        if (beats && beats.length > 0) {
            let beatIndex = 0;
            for (let i = 0; i < beats.length; i++) {
                if (beats[i] > currentPos) {
                    beatIndex = Math.max(0, i - 1);
                    break;
                }
            }
            const targetIndex = Math.max(0, Math.min(beats.length - 1, beatIndex + beatsMove));
            newPos = beats[targetIndex];

            if (targetIndex === 0 && beatsMove < 0 && beatIndex === 0) {
                newPos = Math.max(0, currentPos + (beatsMove * (60 / fallbackBpm)));
            } else if (targetIndex === beats.length - 1 && beatsMove > 0 && beatIndex === beats.length - 1) {
                newPos = Math.min(deck.buffer.duration, currentPos + (beatsMove * (60 / fallbackBpm)));
            }
        } else {
            const beatDuration = 60 / fallbackBpm;
            newPos = Math.max(0, Math.min(deck.buffer.duration, currentPos + (beatsMove * beatDuration)));
        }

        this.seek(deckId, newPos / deck.buffer.duration);
    }

    // --- TRANSPORT LOGIC ---

    public handleCue(deckId: string) {
        if (!this.isReady) return;
        this.resume();
        const deck = this.decks[deckId];
        if (deck.isPlaying) {
            this.pause(deckId);
            deck.pauseTime = deck.cuePoint;
        } else {
            deck.cuePoint = deck.pauseTime;
        }
    }

    public setGridOffset(deckId: string, offset: number) {
        if (!this.isReady) return;
        if (this.decks[deckId]) {
            this.decks[deckId].gridOffset = offset;
        }
    }

    // --- SYNC ENGINE ---

    public syncDecks(targetDeckId: string, masterDeckId: string, masterEffectiveBpm: number) {
        if (!this.isReady) return;
        const target = this.decks[targetDeckId];
        const master = this.decks[masterDeckId];

        const targetPitchRate = 1 + target.pitch;

        if (!target.buffer || !master.isPlaying) return;

        const masterElapsed = (this.ctx.currentTime - master.startTime) * (1 + master.pitch);

        const beatDuration = 60 / masterEffectiveBpm;
        // Apply Grid Offset to Master phase
        const masterPhase = ((masterElapsed - master.gridOffset) % beatDuration) / beatDuration;

        const targetDuration = target.buffer.duration;
        let targetPos = target.pauseTime;

        if (target.isPlaying) {
            targetPos = (this.ctx.currentTime - target.startTime) * targetPitchRate;
        }

        // Apply Grid Offset to Target phase
        const currentTargetPhase = ((targetPos - target.gridOffset) % beatDuration) / beatDuration;

        let phaseDiff = masterPhase - currentTargetPhase;
        if (phaseDiff > 0.5) phaseDiff -= 1;
        if (phaseDiff < -0.5) phaseDiff += 1;

        const timeShift = phaseDiff * beatDuration;
        const newPos = (targetPos + timeShift + targetDuration) % targetDuration;

        if (target.isPlaying) {
            this.pause(targetDeckId);
            target.pauseTime = newPos;
            this.play(targetDeckId);
        } else {
            target.pauseTime = newPos;
        }
    }

    // --- FX & MIXING ---

    public setPitch(deckId: string, pitchRatio: number) {
        if (!this.isReady) return;
        this.updatePitch(deckId, pitchRatio);
    }

    private updatePitch(deckId: string, pitchRatio: number) {
        const deck = this.decks[deckId];
        const newRate = 1 + pitchRatio;
        const oldRate = 1 + deck.pitch;
        const keyShift = this.keyShiftByDeck[deckId] || 0;

        deck.pitch = pitchRatio;

        if (deck.isPlaying) {
            const currentCtxTime = this.ctx.currentTime;
            const playedTime = (currentCtxTime - deck.startTime) * oldRate;
            deck.startTime = currentCtxTime - (playedTime / newRate);

        if (deck.isKeyLockEnabled && deck.stretchNode) {
            try {
                if ((deck.stretchNode as any).setTransposeFactor) {
                    (deck.stretchNode as any).setTransposeFactor(newRate);
                }
                if ((deck.stretchNode as any).setTransposeSemitones) {
                    (deck.stretchNode as any).setTransposeSemitones(keyShift);
                }
            } catch (e) {
                console.error(`[AudioEngine] Failed to update pitch for stretchNode ${deckId}`, e);
            }
        } else if (deck.source) {
            const semitoneMultiplier = Math.pow(2, keyShift / 12);
            deck.source.playbackRate.value = newRate * semitoneMultiplier;
        }
        }
    }

    public setChannelGain(deckId: string, volume: number) {
        if (!this.isReady) return;
        // Logarithmic/Square curve for more natural fader response (UI-UX Pro Max rule)
        const curveVolume = volume * volume;
        this.decks[deckId].volumeNode.gain.setTargetAtTime(curveVolume, this.ctx.currentTime, 0.02);
    }

    public setCrossfader(value: number) {
        if (!this.isReady) return;
        const val = value / 100;
        // Equal Power Crossfade
        const gainA = Math.cos(val * 0.5 * Math.PI);
        const gainB = Math.cos((1 - val) * 0.5 * Math.PI);

        this.decks['A'].crossfaderNode.gain.setTargetAtTime(gainA, this.ctx.currentTime, 0.02);
        this.decks['B'].crossfaderNode.gain.setTargetAtTime(gainB, this.ctx.currentTime, 0.02);
    }

    public setStemState(deckId: string, stem: StemType, volume: number, active: boolean) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        const val = active ? volume : 0;
        const gain = val > 0.01 ? 20 * Math.log10(val) : -60;

        if (stem === StemType.BASS) {
            deck.stemFilters.bass.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
        } else if (stem === StemType.VOCALS) {
            deck.stemFilters.mid.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
        } else if (stem === StemType.HARMONIC) {
            deck.stemFilters.high.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
        } else if (stem === StemType.DRUMS) {
            // High-fidelity drum emulation:
            // Use specialized peaking filters for kick body (60Hz) and hi-hat clarity (8kHz)
            deck.stemFilters.drumsKick.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
            deck.stemFilters.drumsHigh.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
        }
    }

    public setEq(deckId: string, band: keyof EqState, value: number) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        // Increased range for true "Kill" (down to -60dB)
        const db = value < 0.05 ? -60 : (value - 0.5) * 36;

        if (band === 'high') deck.filters.high.gain.setTargetAtTime(db, this.ctx.currentTime, 0.05);
        if (band === 'mid') deck.filters.mid.gain.setTargetAtTime(db, this.ctx.currentTime, 0.05);
        if (band === 'low') deck.filters.low.gain.setTargetAtTime(db, this.ctx.currentTime, 0.05);
        if (band === 'trim') deck.trimNode.gain.setTargetAtTime(value * 2, this.ctx.currentTime, 0.05);
    }

    public setFx(deckId: string, type: EffectType, wetAmount: number, active: boolean = true) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        const effectiveWet = active ? wetAmount : 0;
        deck.fxNodes.dry.gain.setTargetAtTime(1 - effectiveWet, this.ctx.currentTime, 0.02);
        deck.fxNodes.wet.gain.setTargetAtTime(effectiveWet, this.ctx.currentTime, 0.02);

        // Select Active FX Route
        if (type === EffectType.DELAY || type === EffectType.ECHO) {
            deck.fxNodes.delayInput.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
            deck.fxNodes.reverbInput.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        } else {
            // Reverb Default
            deck.fxNodes.delayInput.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
            deck.fxNodes.reverbInput.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
        }
    }

    public setFxParam(deckId: string, knob: 1 | 2, value: number, effectType: EffectType) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        if (effectType === EffectType.DELAY || effectType === EffectType.ECHO) {
            const timeRange = effectType === EffectType.ECHO ? 2000 : 1000;
            if (knob === 1) deck.fxNodes.tunaDelay.delayTime = 50 + (value * timeRange);
            if (knob === 2) deck.fxNodes.tunaDelay.feedback = value * 0.95;
        } else if (effectType === EffectType.REVERB) {
            if (knob === 1) deck.fxNodes.tunaReverb.wetLevel = value;
            if (knob === 2) deck.fxNodes.tunaReverb.highCut = 400 + (value * 21600);
        }
    }

    public startRecording() {
        if (!this.isReady) return;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') return;

        if (!this.recordingDestination) {
            this.recordingDestination = this.ctx.createMediaStreamDestination();
        }

        this.recordedChunks = [];
        this.masterGain.connect(this.recordingDestination);
        this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream);
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };
        this.mediaRecorder.onstop = async () => {
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            this.recordedChunks = [];

            if (this.recordingDestination) {
                try {
                    this.masterGain.disconnect(this.recordingDestination);
                } catch {
                    // Already disconnected.
                }
            }
            this.mediaRecorder = null;

            const title = `DJ Mix - ${new Date().toLocaleString()}`;

            // --- ELECTRON NATIVE SAVE ---
            if (window.gooddj) {
                try {
                    console.log("[AudioEngine] Saving recording natively via IPC...");
                    // We need a path. MediaRecorder gives a blob. 
                    // In Electron, we can't easily get a "path" for a blob without writing it first.
                    // But our ipcHandler expects a path. 
                    // Let's modify the IPC handler later to accept buffers, or for now, use the REST API 
                    // which is still running in the background of our Electron main process (as a fallover).
                    // Actually, let's stick to the rest API for the blob upload since it works perfectly.
                } catch (e) {
                    console.error("IPC recording save failed:", e);
                }
            }

            // Upload the blob to the backend (Works in both Browser and Electron)
            const formData = new FormData();
            formData.append('audio', blob, `mix_${Date.now()}.webm`);
            formData.append('title', title);
            formData.append('duration', '0'); 

            try {
                console.log("[AudioEngine] Uploading recording to backend...");
                const res = await fetch('http://127.0.0.1:3003/api/recordings', {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    console.log("[AudioEngine] Recording uploaded successfully.");
                } else {
                    console.error("[AudioEngine] Failed to upload recording.", await res.text());
                }
            } catch (err) {
                console.error("[AudioEngine] Network error while uploading recording:", err);
            }
        };
        this.mediaRecorder.start();
    }

    public stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    public setColorFilter(deckId: string, value: number) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        if (Math.abs(value - 0.5) < 0.02) {
            deck.colorFilter.type = 'allpass';
            deck.colorFilter.Q.value = 0;
        } else if (value < 0.5) {
            deck.colorFilter.type = 'lowpass';
            const norm = value * 2;
            const freq = 20 * Math.pow(1000, norm);
            deck.colorFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
            deck.colorFilter.Q.value = 2 * (1 - norm);
        } else {
            deck.colorFilter.type = 'highpass';
            const norm = (value - 0.5) * 2;
            const freq = 20 * Math.pow(1000, norm);
            deck.colorFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
            deck.colorFilter.Q.value = 2 * norm;
        }
    }

    public setKeyLock(deckId: string, enabled: boolean) {
        if (!this.isReady) return;
        const deck = this.decks[deckId];
        if (deck.isKeyLockEnabled === enabled) return;

        deck.isKeyLockEnabled = enabled;

        if (deck.isPlaying) {
            // Swap engines seamlessly
            const rate = 1 + deck.pitch;
            const elapsed = (this.ctx.currentTime - deck.startTime) * rate;
            const timeInSeconds = elapsed % (deck.buffer?.duration || 1);
            this.seek(deckId, timeInSeconds / (deck.buffer?.duration || 1));
        } else {
            this.updatePitch(deckId, deck.pitch);
        }
    }

    public setKeyShift(deckId: string, semitones: number) {
        if (!this.isReady) return;
        this.keyShiftByDeck[deckId] = semitones;
        const deck = this.decks[deckId];
        if (deck.isPlaying) {
            this.updatePitch(deckId, deck.pitch);
        }
        if (deck.stretchNode) {
            (deck.stretchNode as any).port.postMessage({
                type: 'SET_SEMITONES',
                semitones: semitones
            });
        }
    }

    public getProgress(deckId: string): number {
        if (!this.isReady) return 0;
        const deck = this.decks[deckId];
        if (!deck.buffer) return 0;

        if (deck.isPlaying) {
            const pitchRate = 1 + deck.pitch;
            const elapsed = (this.ctx.currentTime - deck.startTime) * pitchRate;

            if (deck.isLooping && deck.loopEnd > deck.loopStart) {
                // Progress within loop region
                const loopLen = deck.loopEnd - deck.loopStart;
                const posInTrack = deck.loopStart + ((elapsed - deck.loopStart) % loopLen);
                return Math.min(posInTrack / deck.buffer.duration, 1.0);
            }

            const progress = elapsed / deck.buffer.duration;
            return Math.min(progress, 1.0);
        } else {
            return Math.min(deck.pauseTime / deck.buffer.duration, 1.0);
        }
    }

    public getLevel(deckId: string): number {
        if (!this.isReady) return 0;
        const deck = this.decks[deckId];
        const data = this.levelBuffers[deckId] ?? new Uint8Array(deck.analyser.frequencyBinCount);
        this.levelBuffers[deckId] = data;
        deck.analyser.getByteTimeDomainData(data as any);

        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
        }
        return Math.sqrt(sum / data.length) * 2.5;
    }
}

export const AudioEngine = new AudioEngineService();







