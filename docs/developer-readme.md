# good.dj - Technical Overview & Architecture

## 1. Introduction & Vision

**good.dj** is a professional, browser-native DJ application designed to provide a rich, hardware-like tactile experience without the need for desktop installation. It pairs precise Web Audio API timing with a stunning, strictly monochrome / "hardware sand" UI that leverages fluid animations and a heavily physics-based, "springy" interaction model.

The goal of the app is **believability and performance**. Buttons don't just change color; they depress (`framer-motion`). Faders don't just slide; they snap over the 0 threshold and feature custom resistance behavior. It is designed for modern browsers, particularly Chromium-based ones, utilizing high-performance web standards to do things that traditionally required heavy C++ implementations like Serato or Rekordbox.

## 2. Technology Stack

- **Core Framework:** React 19 (Strict Mode, Concurrent Mode ready)
- **Build Tooling:** Vite (for fast HMR and optimized production bundles)
- **Language:** TypeScript 5+ (Strict, interface-heavy typing across the application)
- **Styling:** Tailwind CSS (configured dynamically via an injection in `index.html` avoiding large node build steps, utilizing custom heavily-opinionated design tokens like `#0f0f0f` canvas, `#10b981` signal greens, etc.)
- **Animations:** `framer-motion` (used specifically for layout shifts and physical button "squash and stretch" feedback)
- **Audio Engine:** Native Web Audio API (`AudioContext`, `BiquadFilterNode`, `GainNode`, etc.)

## 3. Project Structure & Key Files

The project follows a flattened, component-heavy architecture:

```text
good.dj/
├── index.html                  # Entry point, houses Tailwind config and global css
├── index.tsx                   # React Root, mounts App inside ErrorBoundary
├── App.tsx                     # Main layout shell, handles View State (Mixer vs Library)
├── types.ts                    # Global TypeScript interfaces for State, Audio, Tracks
├── constants.ts                # Mock data and Architecture strings
├── services/
│   ├── audio.ts                # AudioEngineService: Web Audio API Graph & Logic
│   └── midi.ts                 # Web MIDI API Service
├── hooks/
│   └── useDjState.ts           # The Brain. A massive useReducer managing global state
└── components/
    ├── CentralMixer.tsx        # EQ, FX, and Crossfader layout
    ├── Crossfader.tsx          # Custom draggable crossfader component
    ├── Deck.tsx                # The main Deck (A/B) housing Waveform, Stems, Pads, Pitch
    ├── ErrorBoundary.tsx       # Catches React render errors to prevent white screens
    ├── LibraryView.tsx         # Unified File/Track browser and Playlist Maker
    ├── StemControl.tsx         # Custom inputs: HorizontalBar, VerticalFader, VUMeter
    └── Waveform.tsx            # HTML5 Canvas real-time visualizer
```

## 4. State Management (`useDjState.ts`)

Instead of Redux or Zustand, good.dj uses a singular, highly complex `useReducer` housed locally inside `useDjState.ts`.
This acts as the central nervous system.

**Why `useReducer`?**
DJing involves high-frequency, interconnected state changes. For example, moving a pitch fader changes the UI state, but must also immediately instruct the `AudioEngine` to change playback rate. The reducer handles both the UI state mutation *and* the side-effect (calling the AudioEngine) synchronously.

The state tree (`GlobalDjState`) encompasses:

- `decks`: Record containing state for Deck A and Deck B (playing status, loaded track, EQs, Stem volumes, Cue Points).
- `library`: Loaded tracks, playlists, etc.
- `crossfader`: Global crossfader position.

**Action Flow:**

1. User clicks a button in `Deck.tsx` (e.g., `dispatch({ type: 'TOGGLE_PLAY', deckId: id })`).
2. `useDjState` receives it.
3. It calls the `AudioEngine` to actually start playback.
4. It updates the state (`draft.decks[action.deckId].isPlaying = true`).
5. React re-renders the necessary components.

## 5. The Audio Engine (`services/audio.ts`)

The `AudioEngineService` is a singleton class managing the raw `AudioContext`. It constructs a complex DSP graph for each deck upon initialization.

### Signal Flow per Deck

1. `SourceNode` (The MP3/WAV file buffer)
2. `TrimNode` (Input Gain)
3. **Stem Layer** (`bass`, `mid`, `high` BiquadFilters by default, with optional real Demucs stem playback in Electron when a local model is installed)
4. `ColorFilter` (DJM-style single knob LowPass/HighPass filter)
5. **Mixer EQ** (`highNode`, `midNode`, `lowNode` BiquadFilters)
6. **Split Path**:
   - -> `DryNode`
   - -> `WetNode` -> FX Chain (Delay, Reverb)
7. Merge -> `VolumeNode` (Channel Fader)
8. `CrossfaderNode` (Attenuation based on global crossfader position)
9. `AnalyserNode` (For the Waveform and VU Meters)
10. `MasterGain` -> `Destination` (Speakers)

**Important Note on Pitch & Time:** Currently, the pitch fader adjusts `playbackRate`, which changes *both* tempo and pitch (like a vinyl turntable). Traditional CDJs use complex time-stretching algorithms to change tempo without affecting pitch (Key Lock/Master Tempo).

## 6. The UI & Component Philosophy

The UI is built with a strictly enforced monochrome palette ("Hardware Sand" `#d6cfc6`, "Olive" `#8a8b7f`, etc.) against deep blacks (`#000`, `#050505`, `#0f0f0f`), punctuated only by specific signal colors (Green `#10b981` for active, Red `#ef4444` for clipping/eject).

**Key Components to understand:**

- **`Deck.tsx`**: The largest component. Contains the waveform canvas wrapper, transport controls (now using `framer-motion` for springy tactile feedback), pitch fader, and stem controls.
- **`Waveform.tsx`**: Uses `requestAnimationFrame` and HTML5 Canvas to draw the waveform. It polls the `AudioEngine`'s progress rather than relying on React state updates to guarantee 60fps rendering without thrashing the React DOM.
- **`StemControl.tsx`**: Contains incredibly complex, custom-built form inputs (`HorizontalBar`, `VerticalFader`, `VUMeter`). We do *not* use standard `<input type="range">` visual styling. Instead, the inputs are invisible (`opacity-0`) and overlay a `div` that visually scales via GPU-accelerated `transform: scaleY()` for maximum performance.

## 7. Known Quirks, Hacks, and Considerations

1. **Stem Separation is Conditional:** Without a local Demucs ONNX model in `resources/models`, the stem controls fall back to frequency-band filtering. In Electron, the "Stem Separation" action can switch a deck into real Demucs-based stem playback when the model is installed.
2. **Event Propagation:** When building complex layered buttons (like the `X` to delete a cue point sitting *inside* the Cue Pad button that triggers playback), strict `e.stopPropagation()` and `e.preventDefault()` are required to stop the browser from firing the parent's `onMouseDown` events.
3. **Crossfader Math:** The crossfader employs equal power or linear panning math depending on implementation. Currently, it attenuates the `crossfaderNode.gain` of Deck A as it moves towards B.
4. **File Inputs:** Tracks are loaded purely locally via a hidden `<input type="file" />` that the user is forced to click via a ref. This is because modern browsers strictly prohibit auto-playing or accessing local files without direct user interaction to prevent security/spam issues.

## 8. Development Workflow

- Run `npm run dev` to start Vite.
- Any changes to `types.ts` often require a restart of the dev server if strict typing errors get stuck.
- When creating new UI components, always look at `index.html` for the Tailwind color tokens (e.g., `bg-surface-idle`, `text-signal-nominal`); avoid using arbitrary hex codes inside components to maintain the "good.dj" aesthetic.
