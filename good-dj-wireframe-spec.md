# good.DJ — Wireframe & Layout Specification
**For:** Antigravity AI Coding Agent  
**Project:** good.DJ  
**Version:** 1.0.0  
**Purpose:** Layout implementation reference — read this before touching any UI file

---

## HOW TO USE THIS DOCUMENT

This document is your single source of truth for the good.DJ layout. It contains:
1. ASCII wireframes showing exact spatial relationships
2. Per-component specs with token values
3. Change callouts (what is being updated and why)
4. A DO NOT TOUCH list

When a spec here conflicts with existing code, **this document wins.**  
When something isn't covered here, **don't invent — ask.**

---

## DESIGN TOKEN REFERENCE

Use these CSS variable names throughout. Do not hardcode hex values in component files — reference tokens only.

```css
/* Backgrounds */
--matte-black:  #0f0f0f;   /* page bg, deepest layer */
--charcoal:     #1f1f1f;   /* panel bg, elevated surfaces */
--charcoal-mid: #171717;   /* center column bg */

/* Text */
--off-white:    #f7f5f3;   /* primary text, active labels */
--soft-gray:    #e9e6e2;   /* secondary text */

/* Structure / chrome */
--warm-gray:    #bfb7ad;   /* borders, inactive labels, structure */
--sand:         #d6cfc6;   /* hover state, secondary highlight */
--olive:        #8a8b7f;   /* active/on states, status labels */

/* Signal — use ONLY for semantic meaning, never decoration */
--signal-green: #10b981;   /* synced / success / connected */
--signal-red:   #ef4444;   /* record / live / destructive */
--signal-amber: #f59e0b;   /* warning / unsaved changes */
--signal-blue:  #3b82f6;   /* info / cue points / links */

/* Stem domain colors */
--stem-drums:    #3b82f6;
--stem-bass:     #8b5cf6;
--stem-vocals:   #f59e0b;
--stem-harmonic: #10b981;
```

### Font Rules
```
Interface labels, copy, buttons  → Inter (700 or 800 weight)
ALL numeric data                 → JetBrains Mono or Roboto Mono
  Applies to: BPM, KEY, REMAIN, Hz, dB, timecode, sample rate
  No exceptions.
```

---

## FULL LAYOUT WIREFRAME

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  VIEWPORT: 100vw × 100vh  │  3-column grid: [1fr] [200px] [1fr]                    │
│                                                                                      │
│ ┌──────────────────────────┬──────────┬──────────────────────────┐                  │
│ │        DECK A            │  CENTER  │        DECK B            │  ← 420px tall    │
│ │                          │  200px   │                          │                  │
│ │  [HEADER]                │          │  [HEADER — EMPTY STATE]  │                  │
│ │  [WAVEFORM — 100px]      │ [OUTPUT] │  [WAVEFORM — DROP ZONE]  │                  │
│ │  [RULER]                 │  METERS  │  [RULER]                 │                  │
│ │  [TABS]                  │          │  [TABS]                  │                  │
│ │  [MIXER CONTROLS]        │[XFADER]  │  [MIXER CONTROLS]        │                  │
│ │    [KNOBS] [EQ] [KILLS]  │ [MASTER] │    [KNOBS] [EQ] [KILLS]  │                  │
│ │    [HOT CUE GRID 4×2]    │          │    [HOT CUE GRID 4×2]    │                  │
│ │  [TRANSPORT]             │          │  [TRANSPORT]             │                  │
│ ├──────────────────────────┴──────────┴──────────────────────────┤                  │
│ │  LIBRARY                                                        │  ← flex:1        │
│ │  [SIDEBAR 160px] │ [SEARCH + TABLE]                            │                  │
│ ├─────────────────────────────────────────────────────────────────┤                  │
│ │  STATUS BAR                                                     │  ← 26px          │
│ └─────────────────────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## COMPONENT WIREFRAMES

### 1. DECK HEADER

```
┌──────────────────────────────────────────────────────────────────┐  height: 38px
│ [DECK A]  TRACK TITLE (uppercase, bold)         REMAIN  KEY  BPM │  bg: --charcoal
│           Artist name (smaller, warm-gray)      5:45.00  4A  128.0│  border-b: warm-gray 20%
└──────────────────────────────────────────────────────────────────┘

DECK LABEL:     9px Inter 700 | uppercase | letter-spacing 0.12em
                border: 1px solid warm-gray 30% | padding: 2px 6px | radius: 2px

TRACK TITLE:    12px Inter 700 | uppercase | letter-spacing 0.05em | color: --off-white
ARTIST:         9px Inter 400 | color: --warm-gray | letter-spacing 0.08em

STAT LABELS:    8px Inter 700 | uppercase | letter-spacing 0.1em | color: --olive
STAT VALUES:    16px JetBrains Mono 600 | color: --off-white    ← CHANGE 8
  REMAIN, KEY, BPM — all monospaced, no exceptions

DECK B EMPTY:   track name area shows italic non-uppercase text in --warm-gray 50% opacity
                "No track loaded — click to browse"
```

---

### 2. WAVEFORM  ← CHANGE 5

```
┌──────────────────────────────────────────────────────────────────┐  height: 100px (was ~40px)
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▓▒▒▓▓▒▓▒▒▒▒▓▒▒▓▒▒▒▓▒▒▒▒▓▓▒▒▒▓▒▒▒▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│                              │                                    │  ← red playhead line
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▓▒▒▓▓▒▓▒▒▒▒▓▒▒▓▒▒▒▓▒▒▒▒▓▓▒▒▒▓▒▒▒▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
└──────────────────────────────────────────────────────────────────┘
  ├──── played (blue 12% tint) ──┤

Waveform container:
  height: 100px (minimum 80px)
  bg: #0a0a0a
  overflow: hidden
  border-bottom: 1px solid warm-gray 10%
  NO padding — full bleed

Played region overlay:
  position: absolute | left:0 top:0 bottom:0
  width: [playback position %]
  bg: signal-blue at 12% opacity
  pointer-events: none

Playhead:
  position: absolute | top:0 bottom:0
  left: [playback position %]
  width: 1px
  bg: --signal-red (#ef4444)
  z-index: 2
  pointer-events: none

Loop region (when active):
  bg: --signal-blue at 20% opacity
  no border needed

Waveform bars/canvas:
  Must fill full 100px height
  If canvas-rendered: call resize/redraw after height change
  If CSS bars: height: 100% on container, bar heights are % of container
```

---

### 2b. DECK B WAVEFORM — EMPTY DROP ZONE  ← CHANGE 6

```
┌──────────────────────────────────────────────────────────────────┐  height: 100px
│                                                                  │  bg: #0a0a0a
│   ┌ - - - - - - - - - - - - - - - - - - - - - - - - - - - ┐    │
│   ╎   Drop a track or click to browse                      ╎    │  ← dashed border
│   └ - - - - - - - - - - - - - - - - - - - - - - - - - - - ┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Drop zone:
  position: absolute | inset: 8px
  border: 1px dashed warm-gray at 50% opacity
  border-radius: 4px
  display: flex | align-items: center | justify-content: center
  transition: border 200ms

Drop zone text:
  "Drop a track or click to browse"
  9px Inter | color: --warm-gray | letter-spacing: 0.08em
  pointer-events: none

On hover (no drag):
  border opacity: 80%

On dragover:
  border: 1px solid --signal-green (solid, not dashed)
  text changes to: "Drop to load"
  text color: --signal-green

On dragleave / drop:
  restore default dashed state
```

---

### 3. RULER

```
┌──────────────────────────────────────────────────────────────────┐  height: ~18px
│ 1/2          1           2           4           8              │
└──────────────────────────────────────────────────────────────────┘

Font: JetBrains Mono | 8px | color: --olive
Padding: 3px 10px
bg: --matte-black
border-bottom: 1px solid warm-gray 10%
```

---

### 4. TABS  ← CHANGE 4

```
┌──────────────────────────────────────────────────────────────────┐
│  [MIXER ▔▔▔▔]  FX  STEMS                                        │  bg: --matte-black
└──────────────────────────────────────────────────────────────────┘
     active ↑        ↑ inactive

ACTIVE tab:
  color: --off-white
  border-bottom: 2px solid --off-white
  background: rgba(247,245,243,0.04)
  margin-bottom: -1px (overlaps panel border)

INACTIVE tab:
  color: --warm-gray
  border-bottom: 2px solid transparent
  background: transparent

HOVER (inactive):
  color: --soft-gray
  transition: all 150ms

Tab padding: 6px 14px
Font: 9px Inter 700 | uppercase | letter-spacing: 0.12em
Container padding: 0 10px | gap: 2px
border-bottom: 1px solid warm-gray 15%
```

---

### 5. MIXER CONTROLS

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────┐  ┌──────────────────────────────────────┐              │
│ │      │  │  [HIGH ◉]   [MID ◉]   [LOW ◉]        │              │
│ │TRIM  │  │  HIGH       MID       LOW             │              │
│ │ cell │  ├──────────────────────────────────────┤              │
│ │      │  │  [KILL]     [KILL]    [KILL]          │              │
│ ├──────┤  ├──────────────────────────────────────┤              │
│ │      │  │ [1▌][2▌][3▌][4 ]   ← hot cues row 1 │              │
│ │FILTER│  │ [5 ][6 ][7 ][8 ]   ← hot cues row 2 │              │
│ │ cell │  └──────────────────────────────────────┘              │
│ └──────┘                                                         │
└──────────────────────────────────────────────────────────────────┘

Left column: knob cells (see KNOB CELL spec below)
Right column: flex:1, EQ knobs + kill buttons + hot cue grid
Outer padding: 8px 10px | gap: 8px
```

---

### 5a. KNOB CELL  ← CHANGE 2

```
┌────────────┐   border: 1px solid --warm-gray
│            │   border-radius: 4px
│    [◎]     │   bg: --charcoal
│            │   padding: 8px 12px
│    75      │   min-width: 70px
│   TRIM     │   display: flex | flex-direction: column | align-items: center
└────────────┘   gap: 4px
     ↑ hover: border → --sand (transition 150ms)

KNOB VISUAL (circle):
  width: 34px | height: 34px | border-radius: 50%
  border: 2px solid warm-gray 30%
  bg: radial-gradient(circle at 35% 35%, #2a2a2a, #111)
  box-shadow: 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)
  Indicator mark: 2px wide line, top-center, rotated per value, color: --warm-gray

  TRIM knob when non-default:
    border-color: signal-red 50%
    box-shadow adds: 0 0 8px rgba(239,68,68,0.2)

VALUE DISPLAY:
  JetBrains Mono | 10px | color: --sand
  Always visible (not on-hover-only)

LABEL:
  Inter 700 | 8px | uppercase | letter-spacing: 0.12em | color: --warm-gray
```

---

### 5b. EQ KNOBS

```
[◎ HIGH]  [◎ MID]  [◎ LOW]

Each knob:
  knob visual: 28px × 28px circle
  border: 1px solid warm-gray 20%
  bg: radial-gradient(circle at 35% 35%, #252525, #0e0e0e)
  label below: 7px Inter | uppercase | letter-spacing 0.1em | color: --warm-gray

Arranged in a flex row with gap:6px, filling available width
```

---

### 5c. KILL BUTTONS

```
[  KILL  ]  [  KILL  ]  [  KILL  ]

Each button:
  flex: 1 | height: 22px
  bg: --charcoal
  border: 1px solid warm-gray 20%
  border-radius: 2px
  8px Inter 700 | uppercase | letter-spacing 0.12em | color: --warm-gray
  Flex row, gap: 4px
```

---

### 5d. HOT CUE GRID  ← CHANGE 3

```
┌─────┬─────┬─────┬─────┐
│  1▌ │  2▌ │  3▌ │  4  │  Row 1: slots 1-4
├─────┼─────┼─────┼─────┤       ▌= colored left border = assigned
│  5  │  6  │  7  │  8  │  Row 2: slots 5-8 (all empty in this example)
└─────┴─────┴─────┴─────┘

Grid: grid-template-columns: repeat(4, 1fr) | grid-template-rows: repeat(2, 1fr)
gap: 3px | padding: 0

EMPTY SLOT:
  bg: --matte-black
  border: 1px solid rgba(191,183,173, 0.18)
  color: --warm-gray | opacity: 0.6
  text: slot number | JetBrains Mono | 9px | centered
  border-radius: 3px
  On hover: border opacity → 40%, opacity → 0.9

ASSIGNED SLOT:
  bg: --charcoal
  border: 1px solid warm-gray 15%
  border-left: 3px solid --signal-blue  (default cue color)
    → use stem color if cue is stem-linked:
      drums: --stem-drums (#3b82f6)
      bass:  --stem-bass  (#8b5cf6)
      vocals:--stem-vocals(#f59e0b)
  color: --off-white | JetBrains Mono | 9px
  text: cue number (+ name if available)
  On hover: bg → #252525 | border → --sand

ACTIVE/TRIGGERED SLOT (on keypress):
  bg flashes --signal-blue at 80% opacity
  duration: 150ms | no easing — snap on, quick linear decay
  Do not use CSS transition for this — use JS timeout or keyframe
  snap-to: @keyframes cue-flash { 0%{opacity:0.8} 100%{opacity:0} }
  animation-duration: 150ms | animation-fill-mode: forwards
```

---

### 6. TRANSPORT ROW  ← CHANGE 1

```
┌───────────┬───────────────────────┬───────────┐
│           │                       │           │
│   CUE     │        PLAY           │   SYNC    │  CUE/SYNC: height 38px
│           │                       │           │  PLAY: height 48px (30% taller)
└───────────┴───────────────────────┴───────────┘
  flex:1         flex:2                flex:1

Container: display:flex | gap:3px | padding: 6px 10px 8px

CUE button:
  bg: --charcoal | border: 1px solid warm-gray 20%
  color: --warm-gray | border-radius: 3px
  font: 10px Inter 800 | uppercase | letter-spacing: 0.14em
  On hover: border-color → --sand | color → --off-white

PLAY button (DOMINANT — the most visually prominent element in this row):
  bg: --off-white (#f7f5f3)
  color: --matte-black (#0f0f0f)
  height: 48px (vs 38px for CUE/SYNC)
  font: 13px Inter 800 | uppercase | letter-spacing: 0.18em
  border: none
  box-shadow: 0 0 20px rgba(247,245,243,0.10)
  On hover: bg → --soft-gray | box-shadow intensifies

PLAY button WHEN PLAYING:
  label: "■ STOP" or just "■"
  bg: --signal-red (#ef4444)
  color: --off-white
  box-shadow: 0 0 20px rgba(239,68,68,0.20)

SYNC button: identical styling to CUE button

TRANSITION: 150ms for all state changes
```

---

### 7. CENTER COLUMN  ← CHANGE 7

```
┌──────────┐  border-left:  1px solid rgba(191,183,173,0.22)
│ OUTPUT ▰▰│  border-right: 1px solid rgba(191,183,173,0.22)
│          │  bg: --charcoal-mid (#171717)
│  ║    ║  │  width: 200px (fixed)
│  ║    ║  │
│  ║    ║  │  ← output meters (two channels)
│  ║    ║  │
│──────────│
│CROSSFADER│
│ A  ═══ B │  ← xfader with A/B dots
│──────────│
│  MASTER  │
│  < ─── >│
└──────────┘

CONTAINER:
  border-left: 1px solid rgba(191,183,173,0.22)
  border-right: 1px solid rgba(191,183,173,0.22)
  bg: #171717
  display: flex | flex-direction: column
  position: relative | z-index: 2

SECTION LABELS ("OUTPUT", "CROSSFADER", "MASTER"):
  Inter 700 | 8px | uppercase | letter-spacing: 0.14em | color: --warm-gray
  All sections use consistent label style

OUTPUT METERS:
  Two side-by-side meter bars
  Each: 28px wide | full available height | bg: #0a0a0a
  border: 1px solid warm-gray 15% | border-radius: 2px
  Fill: gradient(to top, signal-green 0%, signal-green 70%, signal-amber 85%, signal-red 100%)
  Mechanically driven by audio engine — do not restyle the meter fill logic

CROSSFADER TRACK:
  height: 3px | bg: warm-gray 20% | border-radius: 2px | margin: 10px 4px
  Handle: 16px × 24px | bg: --sand | border: 1px solid --warm-gray | radius: 2px

A/B INDICATOR DOTS:
  6px circles | bg: --olive
  Do not change — these are existing feature markers
```

---

### 8. LIBRARY

```
┌────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────────────────────┐ │
│ │COLLECTION│ │ [Search library…                              ]   │ │
│ │          │ ├──────────────────────────────────────────────────┤ │
│ │All Tracks│ │ ADD │ TITLE          │ ARTIST  │BPM│KEY│★★★│TIME│ │
│ │          │ ├──────────────────────────────────────────────────┤ │
│ │+Import   │ │ [+] │ All I Do       │ Unk.Art.│120│1A │★★★│3:45│ │
│ │          │ │ [+] │ Beautiful—(PM) │ Unk.Art.│120│1A │★★★│3:09│ │
│ │PLAYLISTS │ │                                                  │ │
│ │+New      │ │                                                  │ │
│ └──────────┘ └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

SIDEBAR (160px):
  bg: --charcoal | border-right: 1px solid warm-gray 15%
  Section labels: 8px Inter 700 | uppercase | letter-spacing 0.14em | color: --warm-gray | padding: 0 12px 6px
  Items: 10px Inter | color: --warm-gray | padding: 5px 12px
  Active item: color --off-white | bg: rgba(247,245,243,0.04)
  Add items: color --olive | 9px

SEARCH INPUT:
  width: 280px | bg: --charcoal
  border: 1px solid warm-gray 20% | radius: 3px
  padding: 5px 10px | 10px Inter
  On focus: border → --sand

TABLE HEADER:
  grid: 32px 1fr 200px 80px 60px 80px 50px
  8px Inter 700 | uppercase | letter-spacing 0.12em | color: --warm-gray
  bg: --charcoal | sticky top | z-index: 1
  border-bottom: 1px solid warm-gray 12%

TABLE ROW:
  same grid as header
  padding: 6px 12px | border-bottom: 1px solid warm-gray 6%
  On hover: bg rgba(247,245,243,0.03)

  ADD button: 18px circle | border: 1px solid warm-gray 25%
              "+" | 12px | color: --warm-gray
              Hover: border → --sand | color → --off-white

  BPM, KEY, TIME values: JetBrains Mono | 10px  ← CHANGE 8
  BPM color: --signal-green
  KEY, TIME: --warm-gray

  RATING stars: --olive | 9px | letter-spacing: 1px
```

---

### 9. STATUS BAR

```
┌────────────────────────────────────────────────────────────────────┐  height: 26px
│  CORE: v1.0.0 // WEB MIDI: IDLE // 48kHz                good.DJ  │
└────────────────────────────────────────────────────────────────────┘

DO NOT CHANGE THIS COMPONENT.

Left text: JetBrains Mono | 8px | color: --olive | letter-spacing 0.08em
Right mark: "good." (Inter 800, --warm-gray) + "DJ" (Inter 800, --off-white)
bg: --charcoal | border-top: 1px solid warm-gray 12%
padding: 4px 12px
```

---

## CHANGE SUMMARY TABLE

| # | Component | What Changes | Priority |
|---|-----------|--------------|----------|
| 1 | Transport row | PLAY button: larger (48px), white bg, red when playing | HIGH |
| 2 | TRIM / FILTER knobs | Wrap in bordered cell with value display | HIGH |
| 3 | Hot cue grid | Empty vs assigned vs triggered visual states | HIGH |
| 4 | MIXER/FX/STEMS tabs | Active state: white text + 2px white underline | MEDIUM |
| 5 | Waveform | Height → 100px, red playhead, blue loop region | MEDIUM |
| 6 | Deck B empty state | Drop zone with dashed border + drag interaction | MEDIUM |
| 7 | Center column | Left/right 1px borders, consistent section labels | LOW |
| 8 | BPM/KEY/REMAIN/Hz/dB | Enforce JetBrains Mono on all numeric displays | LOW |

---

## DO NOT CHANGE

The following must not be altered under any circumstances:

- `good.DJ` wordmark and its position (bottom right, status bar)
- `CORE: v1.0.0 // WEB MIDI: IDLE // 48kHz` status text
- Crossfader A/B dot indicators (position, behavior, color)
- Volume fader and output meter audio mechanics
- Overall 3-column layout (deck / center / deck)
- Library panel grid position (bottom, below decks)
- Any existing color token values not listed in the change specs above
- Audio engine connections or MIDI bindings

---

## IMPLEMENTATION ORDER

Work in this sequence to minimize risk of conflicts:

```
Step 1 → Change 8   Mono font enforcement        → global CSS find/replace, zero risk
Step 2 → Change 4   Tab active states             → isolated presentational component
Step 3 → Change 1   PLAY button dominance         → transport row only, no logic change
Step 4 → Change 5   Waveform height               → may need canvas redraw — test first
Step 5 → Change 2   Knob cell grouping            → wrap existing knob, preserve events
Step 6 → Change 3   Hot cue states                → add conditional class logic to grid
Step 7 → Change 7   Center column spine           → container-level CSS only
Step 8 → Change 6   Deck B empty state            → add drag events, conditional render
```

---

## COMPONENT CHECKLIST (mark off as you complete)

- [ ] Change 8 — Mono font on all numeric displays
- [ ] Change 4 — Tab active state (Deck A)
- [ ] Change 4 — Tab active state (Deck B)
- [ ] Change 1 — PLAY dominant (Deck A)
- [ ] Change 1 — PLAY playing state → red (Deck A)
- [ ] Change 1 — PLAY dominant (Deck B)
- [ ] Change 1 — PLAY playing state → red (Deck B)
- [ ] Change 5 — Waveform height 100px (Deck A)
- [ ] Change 5 — Red playhead (Deck A)
- [ ] Change 5 — Waveform height 100px (Deck B)
- [ ] Change 2 — TRIM knob cell (Deck A)
- [ ] Change 2 — FILTER knob cell (Deck A)
- [ ] Change 2 — TRIM knob cell (Deck B)
- [ ] Change 2 — FILTER knob cell (Deck B)
- [ ] Change 3 — Hot cue empty state
- [ ] Change 3 — Hot cue assigned state
- [ ] Change 3 — Hot cue triggered flash
- [ ] Change 7 — Center column borders
- [ ] Change 7 — Section labels consistent
- [ ] Change 6 — Deck B drop zone render
- [ ] Change 6 — Deck B drag-over state

---

*End of wireframe specification. If anything is ambiguous, reference good-DJ-UI-improvements.md for detailed token-level instructions on each change.*
