---
name: screenshot-qa
description: Use when reviewing screenshots, visual regressions, or live UI polish for good.DJ. Compares the rendered app against the repo design language, hierarchy, spacing, and interaction-state expectations instead of only checking functionality.
---

# Screenshot QA

Read:

1. [AGENTS.md](C:\Users\tahme\OneDrive\Desktop\good.dj\AGENTS.md)
2. [docs/gooddj-design-language.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-design-language.md)
3. [docs/gooddj-layout-system.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-layout-system.md)

When a screenshot is available:

1. Audit the image before proposing code changes.
2. Check hierarchy, alignment, spacing rhythm, contrast, density, and state honesty.
3. Call out what feels prototype-level versus production-level.
4. Tie visual findings back to the actual files that likely own the issue.

Focus on:

- deck readability
- shell cohesion
- mixer spine authority
- library integration
- signal-color discipline
- transport clarity

If visual capture tooling exists later, use it. Until then, screenshots from the user are valid review surfaces.
