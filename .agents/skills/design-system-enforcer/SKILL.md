---
name: design-system-enforcer
description: Use when editing React UI, layout, styling, tokens, component variants, or interface copy in good.DJ. Enforces the repo design system, good. brand rules, token usage, and component reuse before code is written.
---

# Design System Enforcer

Before touching UI code, read:

1. [AGENTS.md](C:\Users\tahme\OneDrive\Desktop\good.dj\AGENTS.md)
2. [docs/design.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\design.md)
3. [docs/gooddj-component-registry.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-component-registry.md)

Then follow this workflow:

1. Audit the existing surface and neighboring components.
2. Reuse or extend an existing component before creating a new primitive.
3. Use tokens or semantic utilities from:
   - [src/styles/tokens.css](C:\Users\tahme\OneDrive\Desktop\good.dj\src\styles\tokens.css)
   - [src/styles/global.css](C:\Users\tahme\OneDrive\Desktop\good.dj\src\styles\global.css)
4. Cover all relevant interaction states.
5. Keep signal color sparse and meaningful.

Rules:

- Do not introduce raw hex, rgb, hsl, or unnamed shadows in component files.
- Do not create generic SaaS cards, gradients, or “cyber DJ” effects.
- Do not add decorative copy, labels, or icons that do not improve use.
- Avoid inline styles unless the value is runtime-driven and cannot live in tokens or utilities.

When a reusable component is added or split, update:

- [docs/gooddj-component-registry.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-component-registry.md)

After broad UI changes, run:

- `npx tsc --noEmit`
- `npm run build`
