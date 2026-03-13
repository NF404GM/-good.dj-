import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, '..', 'resources', 'models', 'demucsv4.onnx');
const modelUrl = process.env.DEMUCS_MODEL_URL
    ?? 'https://huggingface.co/MansfieldPlumbing/Demucs_v4_TRT/resolve/main/demucsv4.onnx?download=true';

async function main() {
    await mkdir(path.dirname(outputPath), { recursive: true });

    try {
        const existing = await stat(outputPath);
        const sizeMb = Math.round(existing.size / (1024 * 1024));
        console.log(`Stem model already present at ${outputPath} (${sizeMb} MB).`);
        return;
    } catch {
        // File does not exist yet.
    }

    console.warn('Downloading demucsv4.onnx for local evaluation.');
    console.warn('Verify commercial-use rights for the model before shipping it in a paid build.');

    const response = await fetch(modelUrl);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download stem model: ${response.status} ${response.statusText}`);
    }

    try {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));
        const saved = await stat(outputPath);
        const sizeMb = Math.round(saved.size / (1024 * 1024));
        console.log(`Saved stem model to ${outputPath} (${sizeMb} MB).`);
    } catch (error) {
        await rm(outputPath, { force: true });
        throw error;
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
