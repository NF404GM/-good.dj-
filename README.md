# good.DJ

![good.DJ hero](assets/readme/hero.png)

good.DJ is a premium Electron DJ instrument from the good. company: a two-deck performance environment with an integrated library, tactile transport, recording, analysis, MIDI support, and an evolving neural-stems pipeline.

[Code](https://github.com/NF404GM/-good.dj-) | [Issues](https://github.com/NF404GM/-good.dj-/issues)

## What It Is

good.DJ is built around a simple idea: creative software should feel like a well-made instrument.

The product direction is:

- calm, premium, and performance-first
- tactile without fake-hardware cosplay
- creator-first instead of feature-bloated
- visually restrained, with signal color only for meaning

This repo currently contains:

- a desktop Electron shell
- a React + TypeScript renderer
- a local Express + Prisma + SQLite backend
- a Web Audio performance engine
- waveform, BPM, and key analysis
- integrated collection and recordings workflows
- MIDI and ProLink groundwork
- an ONNX-based stem separation foundation for Electron

## Current Product Focus

The current build is in an active production-polish phase.

Primary areas of focus:

- UI/UX facelift toward a ship-ready good. company design language
- deck transport and performance-surface refinement
- library workflow polish
- stem-model readiness and runtime hardening
- desktop packaging and release discipline

## Core Capabilities

- Two-deck performance workflow
- Integrated library and inspector workspace
- Recording and playback inside the app
- BPM and key analysis
- Waveform rendering and overview
- MIDI controller support
- Electron file access and local backend integration
- Optional bundled free noncommercial ONNX stem-model release path

## Tech Stack

- Electron 40
- React 19
- TypeScript 5
- Vite 6
- Tailwind CSS 4
- Framer Motion
- Prisma 6 + SQLite
- Express 5
- Essentia.js
- onnxruntime-node

## Getting Started

Prerequisites:

- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run electron:dev
```

Run the renderer only in the browser:

```bash
npm run dev
```

Run the embedded backend by itself:

```bash
npm run backend
```

## Build Commands

Build the renderer:

```bash
npm run build
```

Build the Electron main/preload output:

```bash
npm run build:electron
```

Build the packaged desktop app:

```bash
npm run electron:build
```

Build the free noncommercial release with the bundled stem model:

```bash
npm run electron:build:free-with-stem-model
```

## Stem Model Notes

The Electron stem pipeline is designed to support a local ONNX model.

Helpful commands:

```bash
npm run stems:download-test-model
```

Important note:

- the bundled-model release path is intended for the free noncommercial build flow
- check [LICENSES-THIRD-PARTY.md](LICENSES-THIRD-PARTY.md) and the model policy docs before distribution

## Repo Design System

This repo now includes a local product-system layer for Codex and contributors.

Start here:

- [AGENTS.md](AGENTS.md)
- [docs/design.md](docs/design.md)
- [docs/gooddj-design-language.md](docs/gooddj-design-language.md)
- [docs/gooddj-layout-system.md](docs/gooddj-layout-system.md)
- [docs/gooddj-interaction-states.md](docs/gooddj-interaction-states.md)
- [docs/gooddj-component-registry.md](docs/gooddj-component-registry.md)

Repo-local Codex skills live in:

- [\.agents\skills](.agents/skills)

These documents define the current good.DJ design language, component rules, layout system, motion expectations, accessibility standards, and UI review discipline.

## Quality Checks

Typecheck:

```bash
npx tsc --noEmit
```

Full check:

```bash
npm run check
```

## Product Principle

Strip it down until it is good, then make it better through craft.

good.DJ should feel fast, inevitable, and trustworthy. The software should disappear and the mix should stay in focus.
