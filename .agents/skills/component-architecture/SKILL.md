---
name: component-architecture
description: Use when creating, refactoring, or splitting React components in good.DJ. Enforces component boundaries, prop hygiene, reusable surface extraction, and sane ownership of UI logic.
---

# Component Architecture

Read:

1. [AGENTS.md](C:\Users\tahme\OneDrive\Desktop\good.dj\AGENTS.md)
2. [docs/gooddj-component-registry.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-component-registry.md)

Classify work into one of these buckets before coding:

- Shell layout
- Performance surface
- Collection surface
- Tactile control
- Feedback / status

Rules:

- Keep page and shell components focused on orchestration.
- Keep controls responsible for rendering and local interaction only.
- Lift state only when multiple surfaces truly need it.
- Avoid prop drilling by over-passing unrelated state.
- Prefer explicit, typed props over “options” bags.

Extraction triggers:

- the parent file becomes hard to scan
- a section has a stable API
- the same pattern appears in multiple places
- an internal helper deserves standalone tests or stories

When splitting a reusable surface, update the registry doc.
