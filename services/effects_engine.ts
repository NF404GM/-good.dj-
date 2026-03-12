import Tuna from 'tunajs';

export class EffectsEngine {
    private tuna: any;
    private ctx: AudioContext;

    constructor(ctx: AudioContext) {
        this.ctx = ctx;
        this.tuna = new Tuna(ctx);
    }

    private reverbPresets: Record<string, { duration: number; decay: number }> = {
        'Standard': { duration: 2.0, decay: 2.0 },
        'Cathedral': { duration: 5.0, decay: 3.5 },
        'Room': { duration: 0.8, decay: 1.2 },
        'Tunnel': { duration: 3.5, decay: 1.8 }
    };

    createReverb(presetName: string = 'Standard') {
        const reverb = new this.tuna.Convolver({
            highCut: 22000,
            lowCut: 200,
            dryLevel: 0,
            wetLevel: 1,
            level: 1,
            impulse: 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==',
            bypass: false
        });

        this.applyReverbPreset(reverb, presetName);
        return reverb;
    }

    public applyReverbPreset(reverb: any, presetName: string) {
        const preset = this.reverbPresets[presetName] || this.reverbPresets['Standard'];
        if (reverb.convolver) {
            reverb.convolver.buffer = this.generateImpulseResponse(preset.duration, preset.decay);
        }
    }

    createDelay() {
        return new this.tuna.PingPongDelay({
            wetLevel: 1,
            level: 1,
            leftDelay: 375,
            rightDelay: 375,
            feedback: 0.5,
            bypass: false
        });
    }

    createMoogFilter() {
        return new this.tuna.MoogFilter({
            cutoff: 0.065,
            resonance: 0.5,
            bufferSize: 4096
        });
    }

    private generateImpulseResponse(duration: number, decay: number): AudioBuffer {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = length - i;
            left[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
            right[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
        }
        return impulse;
    }
}
