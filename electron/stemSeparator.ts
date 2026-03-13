import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const TARGET_SAMPLE_RATE = 44100;
const CHUNK_SIZE = TARGET_SAMPLE_RATE * 10;
const OVERLAP = TARGET_SAMPLE_RATE;

type RealStemName = 'drums' | 'bass' | 'other' | 'vocals';

export interface StemBuffers {
    drums: Float32Array;
    bass: Float32Array;
    other: Float32Array;
    vocals: Float32Array;
    sampleRate: number;
}

let session: ort.InferenceSession | null = null;

function resolveModelPath() {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'models', 'htdemucs_ft.onnx')
        : path.join(__dirname, '..', 'resources', 'models', 'htdemucs_ft.onnx');
}

async function getSession() {
    if (session) {
        return session;
    }

    const modelPath = resolveModelPath();
    if (!fs.existsSync(modelPath)) {
        throw new Error(`Missing stem model at ${modelPath}. Export htdemucs_ft.onnx into resources/models first.`);
    }

    session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        executionMode: 'sequential',
    });

    return session;
}

function resampleChannel(channel: Float32Array, sourceRate: number) {
    if (sourceRate === TARGET_SAMPLE_RATE) {
        return channel;
    }

    const ratio = TARGET_SAMPLE_RATE / sourceRate;
    const nextLength = Math.max(1, Math.round(channel.length * ratio));
    const output = new Float32Array(nextLength);

    for (let i = 0; i < nextLength; i += 1) {
        const src = Math.min(Math.round(i / ratio), channel.length - 1);
        output[i] = channel[src];
    }

    return output;
}

function buildChunkInput(left: Float32Array, right: Float32Array, start: number, chunkLength: number) {
    const inputData = new Float32Array(2 * chunkLength);
    inputData.set(left.subarray(start, start + chunkLength), 0);
    inputData.set(right.subarray(start, start + chunkLength), chunkLength);
    return inputData;
}

function getWriteWindow(chunkIndex: number, chunkLength: number, chunkCount: number) {
    const trimStart = chunkIndex === 0 ? 0 : Math.floor(OVERLAP / 2);
    const trimEnd = chunkIndex === chunkCount - 1 ? chunkLength : chunkLength - Math.floor(OVERLAP / 2);
    return { trimStart, trimEnd };
}

function writeMonoStemChunk(
    output: Float32Array,
    stemData: Float32Array,
    stemIndex: number,
    stemSamples: number,
    readStart: number,
    readEnd: number,
    writeStart: number
) {
    const channelOffset = stemIndex * 2 * stemSamples;

    for (let i = readStart; i < readEnd; i += 1) {
        const targetIndex = writeStart + (i - readStart);
        if (targetIndex >= output.length) {
            break;
        }

        output[targetIndex] = stemData[channelOffset + i];
    }
}

export async function separateStems(
    left: Float32Array,
    right: Float32Array,
    sampleRate: number
): Promise<StemBuffers> {
    const model = await getSession();
    const leftChannel = resampleChannel(left, sampleRate);
    const rightChannel = resampleChannel(right, sampleRate);
    const totalSamples = leftChannel.length;
    const step = CHUNK_SIZE - OVERLAP;
    const chunkCount = Math.max(1, Math.ceil(totalSamples / step));

    const outputs: Record<RealStemName, Float32Array> = {
        drums: new Float32Array(totalSamples),
        bass: new Float32Array(totalSamples),
        other: new Float32Array(totalSamples),
        vocals: new Float32Array(totalSamples),
    };

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
        const start = Math.max(0, chunkIndex * step);
        const end = Math.min(totalSamples, start + CHUNK_SIZE);
        const chunkLength = end - start;
        const inputData = buildChunkInput(leftChannel, rightChannel, start, chunkLength);
        const inputTensor = new ort.Tensor('float32', inputData, [1, 2, chunkLength]);
        const result = await model.run({ mix: inputTensor });
        const stemTensor = result.stems;

        if (!stemTensor) {
            throw new Error('Stem model returned no "stems" tensor.');
        }

        const stemData = stemTensor.data as Float32Array;
        const { trimStart, trimEnd } = getWriteWindow(chunkIndex, chunkLength, chunkCount);
        const writeStart = start + trimStart;

        writeMonoStemChunk(outputs.drums, stemData, 0, chunkLength, trimStart, trimEnd, writeStart);
        writeMonoStemChunk(outputs.bass, stemData, 1, chunkLength, trimStart, trimEnd, writeStart);
        writeMonoStemChunk(outputs.other, stemData, 2, chunkLength, trimStart, trimEnd, writeStart);
        writeMonoStemChunk(outputs.vocals, stemData, 3, chunkLength, trimStart, trimEnd, writeStart);
    }

    return {
        drums: outputs.drums,
        bass: outputs.bass,
        other: outputs.other,
        vocals: outputs.vocals,
        sampleRate: TARGET_SAMPLE_RATE,
    };
}
