import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_SAMPLE_RATE = 44100;
const DEFAULT_CHUNK_SIZE = 343980;
const DEFAULT_STEM_COUNT = 4;
const MODEL_FILENAMES = ['htdemucs_ft.onnx', 'demucsv4.onnx'] as const;
const INSTALLED_MODEL_DIRNAME = 'models';
const TRACKED_STEMS = [
    { name: 'drums', index: 0 },
    { name: 'bass', index: 1 },
    { name: 'other', index: 2 },
    { name: 'vocals', index: 3 },
] as const;

type RealStemName = typeof TRACKED_STEMS[number]['name'];
type StemModelSource = 'environment' | 'user-installed' | 'bundled' | 'dev-resource';

interface StemModelCandidate {
    path: string;
    fileName: string;
    source: StemModelSource;
}

interface StemModelInspection {
    candidate: StemModelCandidate;
    inputName: string;
    outputName: string;
    inputShape: Array<string | number | null | undefined>;
    outputShape: Array<string | number | null | undefined>;
    chunkSize: number;
    stemCount: number;
}

interface StemModelRuntime extends StemModelInspection {
    session: ort.InferenceSession;
    overlap: number;
}

export interface StemBuffers {
    drums: Float32Array;
    bass: Float32Array;
    other: Float32Array;
    vocals: Float32Array;
    sampleRate: number;
}

export interface StemModelStatus {
    available: boolean;
    source: StemModelSource | null;
    path: string | null;
    fileName: string | null;
    inputName: string | null;
    outputName: string | null;
    inputShape: Array<string | number | null | undefined>;
    outputShape: Array<string | number | null | undefined>;
    message: string;
}

let runtime: StemModelRuntime | null = null;

function resetRuntime() {
    runtime = null;
}

/** SB-2 fix: Release the cached ONNX runtime session on app quit. */
export async function disposeRuntime() {
    if (runtime?.session) {
        try {
            await runtime.session.release();
        } catch (e) {
            console.warn('[StemSeparator] Error releasing ONNX session:', e);
        }
    }
    runtime = null;
}

function getBundledModelDirectory() {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'models')
        : path.join(__dirname, '..', 'resources', 'models');
}

function getInstalledModelDirectory() {
    return path.join(app.getPath('userData'), INSTALLED_MODEL_DIRNAME);
}

function getUserInstalledCandidates(): StemModelCandidate[] {
    const installedDir = getInstalledModelDirectory();
    if (!fs.existsSync(installedDir)) {
        return [];
    }

    return fs.readdirSync(installedDir)
        .filter((fileName) => fileName.toLowerCase().endsWith('.onnx'))
        .sort()
        .map((fileName) => ({
            path: path.join(installedDir, fileName),
            fileName,
            source: 'user-installed' as const,
        }));
}

function getBundledCandidates(): StemModelCandidate[] {
    const modelDir = getBundledModelDirectory();
    return MODEL_FILENAMES
        .map((fileName) => ({
            path: path.join(modelDir, fileName),
            fileName,
            source: app.isPackaged ? 'bundled' as const : 'dev-resource' as const,
        }))
        .filter((candidate) => fs.existsSync(candidate.path));
}

function getEnvironmentCandidate(): StemModelCandidate[] {
    const configuredPath = process.env.GOODDJ_STEM_MODEL_PATH;
    if (!configuredPath || !fs.existsSync(configuredPath)) {
        return [];
    }

    return [{
        path: configuredPath,
        fileName: path.basename(configuredPath),
        source: 'environment',
    }];
}

function getModelCandidates() {
    return [
        ...getEnvironmentCandidate(),
        ...getUserInstalledCandidates(),
        ...getBundledCandidates(),
    ];
}

function getFixedAxis(shape: readonly (string | number | null | undefined)[] | undefined, axis: number, fallback: number) {
    const value = shape?.[axis];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

async function inspectModel(candidate: StemModelCandidate): Promise<StemModelInspection> {
    const session = await ort.InferenceSession.create(candidate.path, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        executionMode: 'sequential',
    });

    try {
        const inputName = session.inputNames[0];
        const outputName = session.outputNames[0];
        const inputShape = [...(session.inputMetadata[inputName]?.shape ?? [])];
        const outputShape = [...(session.outputMetadata[outputName]?.shape ?? [])];
        const chunkSize = getFixedAxis(inputShape, inputShape.length - 1, DEFAULT_CHUNK_SIZE);
        const stemCount = getFixedAxis(outputShape, 1, DEFAULT_STEM_COUNT);

        if (chunkSize <= 0) {
            throw new Error('Stem model input shape is missing a valid sample axis.');
        }

        if (stemCount < DEFAULT_STEM_COUNT) {
            throw new Error(`Stem model only exposes ${stemCount} stems. good.dj requires at least ${DEFAULT_STEM_COUNT}.`);
        }

        return {
            candidate,
            inputName,
            outputName,
            inputShape,
            outputShape,
            chunkSize,
            stemCount,
        };
    } finally {
        await session.release();
    }
}

async function getModelRuntime() {
    if (runtime) {
        return runtime;
    }

    const candidates = getModelCandidates();
    if (candidates.length === 0) {
        throw new Error(
            `No compatible stem model is installed. Add a local ONNX model in Settings, or set GOODDJ_STEM_MODEL_PATH.`
        );
    }

    let lastError: Error | null = null;

    for (const candidate of candidates) {
        try {
            const session = await ort.InferenceSession.create(candidate.path, {
                executionProviders: ['cpu'],
                graphOptimizationLevel: 'all',
                executionMode: 'sequential',
            });

            const inputName = session.inputNames[0];
            const outputName = session.outputNames[0];
            const inputShape = [...(session.inputMetadata[inputName]?.shape ?? [])];
            const outputShape = [...(session.outputMetadata[outputName]?.shape ?? [])];
            const chunkSize = getFixedAxis(inputShape, inputShape.length - 1, DEFAULT_CHUNK_SIZE);
            const stemCount = getFixedAxis(outputShape, 1, DEFAULT_STEM_COUNT);

            if (stemCount < DEFAULT_STEM_COUNT) {
                throw new Error(`Model "${candidate.fileName}" only exposes ${stemCount} stems.`);
            }

            runtime = {
                candidate,
                session,
                inputName,
                outputName,
                inputShape,
                outputShape,
                chunkSize,
                overlap: Math.max(1, Math.floor(chunkSize * 0.25)),
                stemCount,
            };

            return runtime;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError ?? new Error('Unable to load any installed stem model.');
}

export async function getStemModelStatus(): Promise<StemModelStatus> {
    const candidates = getModelCandidates();
    if (candidates.length === 0) {
        return {
            available: false,
            source: null,
            path: null,
            fileName: null,
            inputName: null,
            outputName: null,
            inputShape: [],
            outputShape: [],
            message: 'No local stem model is installed. Public good.dj builds do not bundle one by default.',
        };
    }

    let lastError: Error | null = null;

    for (const candidate of candidates) {
        try {
            const inspected = await inspectModel(candidate);
            return {
                available: true,
                source: candidate.source,
                path: candidate.path,
                fileName: candidate.fileName,
                inputName: inspected.inputName,
                outputName: inspected.outputName,
                inputShape: inspected.inputShape,
                outputShape: inspected.outputShape,
                message: candidate.source === 'user-installed'
                    ? 'User-installed stem model is ready.'
                    : candidate.source === 'bundled'
                        ? 'Bundled stem model is ready.'
                        : candidate.source === 'environment'
                            ? 'Stem model loaded from GOODDJ_STEM_MODEL_PATH.'
                            : 'Development stem model is ready.',
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    return {
        available: false,
        source: null,
        path: null,
        fileName: null,
        inputName: null,
        outputName: null,
        inputShape: [],
        outputShape: [],
        message: lastError?.message ?? 'A local stem model was found, but it is not compatible with good.dj.',
    };
}

export async function installStemModel(sourcePath: string): Promise<StemModelStatus> {
    if (!sourcePath || path.extname(sourcePath).toLowerCase() !== '.onnx') {
        throw new Error('Please choose a single-file ONNX stem model.');
    }

    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Selected model does not exist: ${sourcePath}`);
    }

    const sourceDir = path.dirname(sourcePath);
    const sourceFileName = path.basename(sourcePath);
    const siblingDataPath = `${sourcePath}.data`;
    const hasSiblingData = fs.existsSync(siblingDataPath);
    const installedDir = getInstalledModelDirectory();
    const tempDir = path.join(path.dirname(installedDir), `${INSTALLED_MODEL_DIRNAME}.installing`);
    const tempModelPath = path.join(tempDir, sourceFileName);

    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
    fs.copyFileSync(sourcePath, tempModelPath);

    if (hasSiblingData) {
        fs.copyFileSync(siblingDataPath, path.join(tempDir, `${sourceFileName}.data`));
    }

    try {
        await inspectModel({
            path: tempModelPath,
            fileName: sourceFileName,
            source: 'user-installed',
        });
    } catch (error) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw error;
    }

    fs.rmSync(installedDir, { recursive: true, force: true });
    fs.renameSync(tempDir, installedDir);
    resetRuntime();

    const status = await getStemModelStatus();
    if (!status.available) {
        throw new Error(status.message);
    }

    return status;
}

export async function removeInstalledStemModel(): Promise<StemModelStatus> {
    const installedDir = getInstalledModelDirectory();
    fs.rmSync(installedDir, { recursive: true, force: true });
    resetRuntime();
    return getStemModelStatus();
}

function resampleChannel(channel: Float32Array, sourceRate: number) {
    if (sourceRate === TARGET_SAMPLE_RATE) {
        return channel;
    }

    const ratio = TARGET_SAMPLE_RATE / sourceRate;
    const nextLength = Math.max(1, Math.round(channel.length * ratio));
    const output = new Float32Array(nextLength);

    for (let i = 0; i < nextLength; i += 1) {
        const src = i / ratio;
        const lo = Math.floor(src);
        const hi = Math.min(lo + 1, channel.length - 1);
        const frac = src - lo;
        output[i] = channel[lo] * (1 - frac) + channel[hi] * frac;
    }

    return output;
}

function computeNormalization(left: Float32Array, right: Float32Array) {
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < left.length; i += 1) {
        const mono = (left[i] + right[i]) * 0.5;
        sum += mono;
        sumSquares += mono * mono;
    }

    const mean = left.length > 0 ? sum / left.length : 0;
    const variance = left.length > 0 ? Math.max((sumSquares / left.length) - (mean * mean), 1e-8) : 1;
    return {
        mean,
        std: Math.sqrt(variance),
    };
}

function normalizeChannel(channel: Float32Array, mean: number, std: number) {
    const output = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i += 1) {
        output[i] = (channel[i] - mean) / std;
    }
    return output;
}

function buildChunkInput(left: Float32Array, right: Float32Array, start: number, chunkSize: number) {
    const inputData = new Float32Array(2 * chunkSize);
    const end = Math.min(left.length, start + chunkSize);
    const validLength = Math.max(0, end - start);

    if (validLength > 0) {
        inputData.set(left.subarray(start, end), 0);
        inputData.set(right.subarray(start, end), chunkSize);
    }

    return { inputData, validLength };
}

function getChunkWeight(sampleIndex: number, validLength: number, chunkIndex: number, chunkCount: number, overlap: number) {
    if (chunkCount === 1 || overlap <= 0 || validLength <= 0) {
        return 1;
    }

    let weight = 1;
    const fadeSpan = Math.min(overlap, validLength);

    if (chunkIndex > 0 && sampleIndex < fadeSpan) {
        weight = Math.min(weight, sampleIndex / fadeSpan);
    }

    if (chunkIndex < chunkCount - 1 && sampleIndex >= validLength - fadeSpan) {
        weight = Math.min(weight, (validLength - sampleIndex) / fadeSpan);
    }

    return Math.max(weight, 0);
}

function sampleStem(stemData: Float32Array, stemIndex: number, sampleIndex: number, chunkSize: number) {
    const baseOffset = stemIndex * 2 * chunkSize;
    const left = stemData[baseOffset + sampleIndex];
    const right = stemData[baseOffset + chunkSize + sampleIndex] ?? left;
    return (left + right) * 0.5;
}

function finalizeOutputs(outputs: Record<RealStemName, Float32Array>, weights: Float32Array, std: number) {
    for (const stemName of Object.keys(outputs) as RealStemName[]) {
        const output = outputs[stemName];
        for (let i = 0; i < output.length; i += 1) {
            const weight = weights[i];
            output[i] = weight > 0 ? (output[i] / weight) * std : 0;
        }
    }
}

export async function separateStems(
    left: Float32Array,
    right: Float32Array,
    sampleRate: number,
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal
): Promise<StemBuffers> {
    const model = await getModelRuntime();
    const leftChannel = resampleChannel(left, sampleRate);
    const rightChannel = resampleChannel(right, sampleRate);
    const { mean, std } = computeNormalization(leftChannel, rightChannel);
    const normalizedLeft = normalizeChannel(leftChannel, mean, std);
    const normalizedRight = normalizeChannel(rightChannel, mean, std);
    const totalSamples = normalizedLeft.length;

    const outputs: Record<RealStemName, Float32Array> = {
        drums: new Float32Array(totalSamples),
        bass: new Float32Array(totalSamples),
        other: new Float32Array(totalSamples),
        vocals: new Float32Array(totalSamples),
    };

    if (totalSamples === 0) {
        return {
            drums: outputs.drums,
            bass: outputs.bass,
            other: outputs.other,
            vocals: outputs.vocals,
            sampleRate: TARGET_SAMPLE_RATE,
        };
    }

    const weights = new Float32Array(totalSamples);
    const step = Math.max(1, model.chunkSize - model.overlap);
    const chunkCount = totalSamples <= model.chunkSize
        ? 1
        : Math.ceil((totalSamples - model.chunkSize) / step) + 1;

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
        if (signal?.aborted) {
            throw new DOMException('Stem separation aborted', 'AbortError');
        }

        const start = chunkCount === 1
            ? 0
            : Math.min(chunkIndex * step, Math.max(totalSamples - model.chunkSize, 0));
        const { inputData, validLength } = buildChunkInput(normalizedLeft, normalizedRight, start, model.chunkSize);
        const inputTensor = new ort.Tensor('float32', inputData, [1, 2, model.chunkSize]);
        const result = await model.session.run({ [model.inputName]: inputTensor });
        const stemTensor = result[model.outputName];

        if (!stemTensor) {
            throw new Error(`Stem model returned no "${model.outputName}" tensor.`);
        }

        const stemData = stemTensor.data as Float32Array;

        for (let i = 0; i < validLength; i += 1) {
            const targetIndex = start + i;
            if (targetIndex >= totalSamples) {
                break;
            }

            const weight = getChunkWeight(i, validLength, chunkIndex, chunkCount, model.overlap);
            weights[targetIndex] += weight;

            for (const trackedStem of TRACKED_STEMS) {
                if (trackedStem.index >= model.stemCount) {
                    continue;
                }

                outputs[trackedStem.name][targetIndex] += sampleStem(
                    stemData,
                    trackedStem.index,
                    i,
                    model.chunkSize
                ) * weight;
            }
        }

        onProgress?.(chunkIndex + 1, chunkCount);
    }

    finalizeOutputs(outputs, weights, std);

    return {
        drums: outputs.drums,
        bass: outputs.bass,
        other: outputs.other,
        vocals: outputs.vocals,
        sampleRate: TARGET_SAMPLE_RATE,
    };
}
