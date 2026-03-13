---
name: storybook-generator
description: Use when the user explicitly wants component stories, isolated previews, or a documented state matrix for good.DJ components. Generates stories only if Storybook is already present; otherwise it proposes a lightweight preview path instead of installing tooling by default.
---

# Storybook Generator

Read:

1. [AGENTS.md](C:\Users\tahme\OneDrive\Desktop\good.dj\AGENTS.md)
2. [docs/gooddj-component-registry.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-component-registry.md)

Workflow:

1. Check whether Storybook is already configured in the repo.
2. If it is configured, add stories covering:
   - default
   - hover / focus where relevant
   - active
   - disabled
   - loading
   - edge states
3. If Storybook is not configured, do not install it automatically.
4. Instead, propose or create a lightweight preview surface only if the user asks for it.

Stories for good.DJ should focus on interaction states and density, not marketing presentation.
