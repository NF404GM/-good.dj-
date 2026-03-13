import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const releaseDir = path.join(projectRoot, 'release');

const filesToCopy = [
  ['LICENSES-THIRD-PARTY.md', 'LICENSES-THIRD-PARTY.md'],
  [path.join('docs', 'stem-model-policy.md'), 'STEM-MODEL-POLICY.md'],
];

async function main() {
  await mkdir(releaseDir, { recursive: true });

  for (const [sourceRelativePath, targetFileName] of filesToCopy) {
    const sourcePath = path.join(projectRoot, sourceRelativePath);
    const targetPath = path.join(releaseDir, targetFileName);
    await copyFile(sourcePath, targetPath);
    console.log(`Copied ${sourceRelativePath} -> release/${targetFileName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
