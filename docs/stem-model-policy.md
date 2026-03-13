# Stem Model Distribution Policy

good.dj supports two stem-model release paths.

## Default public build

```bash
npm run electron:build
```

This build does not bundle a stem model by default. Users can install a local ONNX model from the in-app Settings panel.

## Free noncommercial build with bundled stems

```bash
npm run stems:download-test-model
npm run electron:build:free-with-stem-model
```

Use this only when you are intentionally distributing a free noncommercial release and you are comfortable with the model attribution and license terms.

That build also copies these release-side docs automatically:

- `release/LICENSES-THIRD-PARTY.md`
- `release/STEM-MODEL-POLICY.md`

## Working rule

- Paid or monetized releases: do not bundle the current test model.
- Free noncommercial giveaway releases: bundling is an explicit build choice.
- Local development and internal testing: keep the model in `resources/models/` or install it from Settings.
