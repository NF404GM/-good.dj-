---
name: accessibility-enforcer
description: Use when touching interactive UI, forms, transport controls, modal flows, or dark-theme surfaces in good.DJ. Enforces keyboard, focus, contrast, semantics, and honest state communication with WCAG 2.2 in mind.
---

# Accessibility Enforcer

Read:

1. [AGENTS.md](C:\Users\tahme\OneDrive\Desktop\good.dj\AGENTS.md)
2. [docs/gooddj-interaction-states.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-interaction-states.md)

Checklist:

- Every interactive element has a visible focus state.
- Keyboard navigation works through the full interaction loop.
- Color is not the sole carrier of state.
- Core control contrast meets AA, and aim for AAA where practical on transport.
- Buttons, toggles, and tabs expose clear labels and state semantics.
- Audio-related controls use explicit labels rather than visual implication.
- Disabled controls stay readable and do not disappear.

When reviewing or editing, call out:

- weak focus treatment
- inaccessible dark-on-dark contrast
- ambiguous labels
- missing ARIA or button semantics
- hover-only affordances
