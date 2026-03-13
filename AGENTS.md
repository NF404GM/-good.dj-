# good.DJ Repo Constitution

This file is the persistent operating system for UI/UX work in `good.DJ`.
Every Codex session that touches product surfaces should read this first.

## Identity

`good.DJ` is a browser-native creative instrument built by **The good. company**.
It is not a marketing site, admin dashboard, or cyberpunk skin. It should feel like
a calm, premium, pro-grade instrument with tactile logic and invisible complexity.

Core brand values:
- Craft over novelty
- Quiet confidence
- Creator-first defaults
- Precision craftsmanship
- Motion with purpose
- Spatial memory over visual tricks

## Source Of Truth

Read these before touching UI, styling, interaction, or product copy:

1. [docs/design.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\design.md)
2. [docs/gooddj-design-language.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-design-language.md)
3. [docs/gooddj-layout-system.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-layout-system.md)
4. [docs/gooddj-interaction-states.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-interaction-states.md)
5. [docs/gooddj-component-registry.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-component-registry.md)

## Product Laws

- The performance surface is the hero.
- The library is integrated, not secondary-class.
- Signal color is only for meaning.
- Primary actions must be obvious without being loud.
- Critical states must be readable at performance distance.
- Motion must communicate state, mass, and confidence.
- Empty, loading, ready, active, synced, recording, separating, and error states must all be honest.

## UI Workflow

Before editing a UI file:

1. Audit the existing surface and nearby components.
2. Reuse an existing component or variant if possible.
3. Use tokens or semantic utility classes, not raw values.
4. Cover `default`, `hover`, `focus`, `active`, `disabled`, and `loading` when relevant.
5. Check that the change improves hierarchy, flow, and state clarity.
6. Update the component registry if you introduce or split a reusable surface.

After substantial UI edits:

1. Run `npx tsc --noEmit`
2. Run `npm run build` for broad renderer changes
3. Visually verify deck, mixer, crossfader, and library cohesion

## Component Rules

- Prefer composition over monoliths.
- Prefer explicit props over hidden coupling.
- Keep state close to where it is consumed unless shared behavior requires lifting.
- Extract a component when one of these becomes true:
  - it is used in 3+ places
  - it has a stable visual contract
  - its internal logic obscures the parent surface
- Do not create a new primitive if an existing one can be extended with variants.

## Styling Rules

- No new raw hex, rgb, hsl, or unnamed shadows in JSX or component files.
- Add new visual values to [src/styles/tokens.css](C:\Users\tahme\OneDrive\Desktop\good.dj\src\styles\tokens.css) first.
- Add reusable structural patterns to [src/styles/global.css](C:\Users\tahme\OneDrive\Desktop\good.dj\src\styles\global.css).
- Avoid inline styles unless the value is genuinely runtime-driven:
  - geometry
  - dynamic transforms
  - dynamic gradients
  - CSS custom property handoff
- When inline style is necessary, prefer CSS custom properties and document the reason in nearby code.

## Motion Rules

- Critical controls should feel immediate.
- High-frequency interactions should generally stay under 200ms.
- Panel and layout transitions may use springs, but must stay calm and purposeful.
- Do not animate everything.
- No decorative pulsing, floating, wobbling, or constant motion on important work surfaces.
- Respect reduced motion.

## Accessibility Rules

- Aim for WCAG AA across the app and AAA where practical for core transport and input surfaces.
- Every interactive element needs a visible focus state.
- Keyboard navigation must remain intact on core workflow surfaces.
- Color must never be the only carrier of state.
- Audio controls must be labeled clearly and honestly.

## Copy Rules

- Use direct, calm, specific language.
- Favor plain verbs and nouns.
- Avoid hype, AI language, exclamation points, and generic onboarding fluff.
- UI copy should sound like a confident instrument, not a campaign.

## Forbidden Patterns

- No copied Serato, rekordbox, or Traktor styling
- No generic SaaS cards or dashboards
- No unbounded neon or glow spam
- No decorative fake-hardware labels that do not improve use
- No hidden primary controls
- No fake states that imply capability not actually available

## Protected Areas

During UI/UX work, do not modify these unless explicitly requested:

- `api/`
- [vercel.json](C:\Users\tahme\OneDrive\Desktop\good.dj\vercel.json)

## Core Files

- [src/styles/tokens.css](C:\Users\tahme\OneDrive\Desktop\good.dj\src\styles\tokens.css): canonical visual tokens
- [src/styles/global.css](C:\Users\tahme\OneDrive\Desktop\good.dj\src\styles\global.css): reusable structural and tactile primitives
- [src/App.tsx](C:\Users\tahme\OneDrive\Desktop\good.dj\src\App.tsx): application shell
- [src/components/Deck.tsx](C:\Users\tahme\OneDrive\Desktop\good.dj\src\components\Deck.tsx): primary performance surface
- [src/components/CentralMixer.tsx](C:\Users\tahme\OneDrive\Desktop\good.dj\src\components\CentralMixer.tsx): control spine
- [src/components/Crossfader.tsx](C:\Users\tahme\OneDrive\Desktop\good.dj\src\components\Crossfader.tsx): transition strip
- [src/components/LibraryView.tsx](C:\Users\tahme\OneDrive\Desktop\good.dj\src\components\LibraryView.tsx): collection workspace

When these evolve structurally, update the design docs.
