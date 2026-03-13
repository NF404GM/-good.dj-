/**
 * audioUtils.ts
 * Shared audio DSP utility functions used by audio.ts and effects_engine.ts.
 */

/**
 * Generates a stereo impulse response buffer for convolution reverb.
 * Produces a decaying white noise tail - starts at full amplitude and
 * decays exponentially to silence.
 *
 * @param audioCtx - The AudioContext to create the buffer in
 * @param duration - Length of the reverb tail in seconds (default 2.0)
 * @param decay - Decay exponent: higher = faster decay (default 2.0)
 */
export function generateImpulseResponse(
    audioCtx: AudioContext,
    duration: number = 2.0,
    decay: number = 2.0
): AudioBuffer {
    const sampleRate = audioCtx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = audioCtx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < length; i += 1) {
        const envelope = Math.pow(1 - i / length, decay);
        left[i] = (Math.random() * 2 - 1) * envelope;
        right[i] = (Math.random() * 2 - 1) * envelope;
    }

    return buffer;
}
