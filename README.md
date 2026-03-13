# good.DJ

> The first fully web-native DJ application from the good. company.

good.DJ is a professional two-deck performance environment that runs entirely in your browser — no downloads, no installs. Built with Web Audio API, Web MIDI, and modern web technologies.

## Features

- Two-deck DJ interface with real-time waveform rendering
- EQ-based stem filtering (AI stem separation coming soon)
- Beat analysis and BPM detection via Essentia.js
- Web MIDI controller support
- Key-lock pitch shifting via SignalSmith Stretch
- Mix recording with browser download
- Drag-and-drop track loading from your computer
- Cue points, looping, and beat jumping
- Crossfader with adjustable curve
- Effects: reverb, delay, filter

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build

```bash
npm run build
npm run preview
```

## Deploy

The app deploys as a fully static site to Vercel (or any static host).

```bash
npx vercel deploy
```

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Web Audio API + AudioWorklet
- SignalSmith Stretch (pitch shifting)
- Essentia.js (audio analysis)
- Framer Motion (UI animations)
- TunaJS (audio effects)

## License

See [LICENSE.md](LICENSE.md)

---

good.DJ 2026 — built by the good. company
