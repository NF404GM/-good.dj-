# good.DJ Component Registry

This registry catalogs the current app surfaces and the intended reuse rules.
Update it when new reusable UI components are added or major ones are split.

## Application Shell

- `ActivationGate.tsx`
  - Handles license and dev bypass gating.
- `BootSequence.tsx`
  - App boot choreography and initial readiness wrapper.
- `ErrorBoundary.tsx`
  - Top-level failure containment.
- `SettingsModal.tsx`
  - Global settings and stem model management surface.
- `App.tsx`
  - Shell composition, top rail, performance field, crossfader band, and collection field.

## Performance Surfaces

- `Deck.tsx`
  - Primary performance surface.
  - Contains deck header, waveform, performance tabs, and transport.
  - Also contains current internal sub-primitives:
    - `TechnicalKnob`
    - `DeckStat`
    - `TransportButton`
    - `DeckModeTab`
- `Waveform.tsx`
  - Main interactive waveform renderer.
- `TrackOverview.tsx`
  - Overview / minimap waveform surface.
- `StemControl.tsx`
  - Stem or frequency-band control unit.
- `CentralMixer.tsx`
  - Center control spine.
- `Crossfader.tsx`
  - Crossfader strip and deck-balance surface.

## Collection Surfaces

- `LibraryView.tsx`
  - Sidebar, search, table, selection, playlist, recordings, and inspector workspace.

## Supporting Views

- `ArchitectureView.tsx`
  - Dev-only / optional architecture surface.
- `OptimizedImage.tsx`
  - General image helper.

## Reuse Rules

Before creating a new component, check whether the work belongs inside:

- shell
- performance surface
- collection surface
- tactile control
- feedback / state badge

Prefer:
- extending an existing component with variants
- extracting an internal subcomponent from a large surface

Avoid:
- creating one-off primitives that only duplicate an existing pattern
- burying reusable controls deep inside page-level layouts without reason

## Planned Extractions

When deck work continues, extract these from `Deck.tsx` before it grows further:

- `DeckHeader`
- `DeckWaveZone`
- `DeckPerformancePanel`
- `DeckTransport`

When library work continues, prefer separate internal units for:

- `LibrarySidebar`
- `LibraryToolbar`
- `TrackTable`
- `LibraryInspector`

## Extraction Trigger

Split a component when:

- a section has a stable API
- the parent has become hard to scan
- logic and visuals are tightly coupled but reusable
- the same visual idea appears on multiple surfaces
