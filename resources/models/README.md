This directory is used for local development and optional noncommercial bundle builds.

Supported local model filenames:
- `demucsv4.onnx`
- `htdemucs_ft.onnx`

The repo does not commit large model binaries. For local evaluation, run:

```bash
npm run stems:download-test-model
```

That script downloads `demucsv4.onnx` into this folder for local testing.

Important:
- The default download source currently uses a third-party Demucs v4 ONNX artifact.
- The default production build does not bundle ONNX stem models automatically.
- If you intentionally want a free noncommercial build with a bundled model, use:

```bash
npm run electron:build:free-with-stem-model
```

- That build also copies `LICENSES-THIRD-PARTY.md` into `release/`.
- Keep attribution and license notes with any public giveaway build.
