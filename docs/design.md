# good.DJ Design System

This is the compact source of truth for the good.DJ product system.
It summarizes the visual doctrine and points to the deeper reference files.

## Read Order

1. [gooddj-design-language.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-design-language.md)
2. [gooddj-layout-system.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-layout-system.md)
3. [gooddj-interaction-states.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-interaction-states.md)
4. [gooddj-component-registry.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-component-registry.md)

## Product Goal

`good.DJ` should feel like a premium creative instrument:
- stage-ready
- calm
- precise
- tactile
- distinctive

It should not feel like:
- a dashboard
- a generic dark SaaS app
- a fake hardware skin
- a copy of competitor DJ software

## Visual Doctrine

- Structural monochrome first
- Signal color only for meaning
- Human interface text in Inter
- Machine data in JetBrains Mono
- Low-contrast structure, high-clarity primary actions
- Premium restraint over noise

## Surface Hierarchy

1. Deck waveform + transport
2. Mixer spine
3. Crossfader strip
4. Library workspace
5. Utility chrome

If a utility surface competes visually with the deck, the hierarchy is wrong.

## Core Tokens

Primary token file:
- [src/styles/tokens.css](C:\Users\tahme\OneDrive\Desktop\good.dj\src\styles\tokens.css)

Shared structural utility file:
- [src/styles/global.css](C:\Users\tahme\OneDrive\Desktop\good.dj\src\styles\global.css)

Rules:
- introduce new palette or spacing values in `tokens.css`
- introduce reusable patterns in `global.css`
- avoid raw visual values in TSX

## UI Review Checklist

Before shipping a UI change, verify:

- hierarchy is clear at a glance
- state is honest
- spacing has rhythm
- controls read at performance distance
- primary actions are obvious
- focus states are visible
- motion is purposeful
- no surface is visually louder than it needs to be

## Related Files

- [AGENTS.md](C:\Users\tahme\OneDrive\Desktop\good.dj\AGENTS.md)
- [gooddj-design-language.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-design-language.md)
- [gooddj-layout-system.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-layout-system.md)
- [gooddj-interaction-states.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-interaction-states.md)
- [gooddj-component-registry.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-component-registry.md)
