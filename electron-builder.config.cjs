/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const modelDir = path.join(projectRoot, 'resources', 'models');
const bundleStemModel = process.env.GOODDJ_BUNDLE_STEM_MODEL === '1';
const bundledStemModelExists = ['demucsv4.onnx', 'htdemucs_ft.onnx']
  .some((fileName) => fs.existsSync(path.join(modelDir, fileName)));

if (bundleStemModel && !bundledStemModelExists) {
  console.warn('[electron-builder] GOODDJ_BUNDLE_STEM_MODEL=1 was set, but no local ONNX model was found in resources/models.');
}

const extraResources = [
  {
    from: 'LICENSES-THIRD-PARTY.md',
    to: 'LICENSES-THIRD-PARTY.md',
  },
];

if (bundleStemModel && bundledStemModelExists) {
  extraResources.push({
    from: 'resources/models',
    to: 'models',
    filter: ['**/*.onnx', '**/*.onnx.data', '**/*.ort'],
  });
}

module.exports = {
  appId: 'com.goodcompany.gooddj',
  productName: 'good.DJ',
  copyright: 'Copyright (c) 2026 good. Company',
  files: [
    'dist/**/*',
    'server-dist/**/*',
    'electron-dist/**/*',
    'bin/**/*',
    'package.json',
  ],
  asarUnpack: [
    'bin/**/*.exe',
  ],
  extraResources,
  toolsets: {
    winCodeSign: '1.1.0',
  },
  npmRebuild: true,
  directories: {
    buildResources: 'assets',
    output: 'release',
  },
  mac: {
    target: ['dmg'],
    icon: 'assets/icon.png',
  },
  win: {
    target: ['nsis'],
    icon: 'assets/icon.ico',
    signAndEditExecutable: false,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'good.DJ',
  },
};
