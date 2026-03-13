---
name: frontend-refactor-discipline
description: Use when doing broad UI cleanup, production polish, or component refactors in good.DJ. Enforces tokenization, naming consistency, dead-code cleanup, and post-change hygiene so the UI matures instead of drifting.
---

# Frontend Refactor Discipline

Read:

1. [AGENTS.md](C:\Users\tahme\OneDrive\Desktop\good.dj\AGENTS.md)
2. [docs/gooddj-component-registry.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-component-registry.md)

Before refactoring:

- identify duplicated patterns
- identify raw visual values
- identify dead branches and legacy naming
- confirm which surfaces are canonical

During refactoring:

- replace hardcoded visual values with tokens
- remove unused props and dead variants
- keep component responsibilities sharper after the change
- do not merge unrelated concerns into one patch

After refactoring:

- update registry docs if reusable surfaces changed
- run `npx tsc --noEmit`
- run `npm run build` for renderer-wide changes
