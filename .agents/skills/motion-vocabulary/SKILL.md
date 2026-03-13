---
name: motion-vocabulary
description: Use when adding or changing animation, transitions, micro-interactions, or Framer Motion behavior in good.DJ. Enforces the product's motion language so it feels like an instrument with mass instead of generic app animation.
---

# Motion Vocabulary

Read:

1. [AGENTS.md](C:\Users\tahme\OneDrive\Desktop\good.dj\AGENTS.md)
2. [docs/gooddj-interaction-states.md](C:\Users\tahme\OneDrive\Desktop\good.dj\docs\gooddj-interaction-states.md)

Preferred timing tiers:

- instant: `80ms` to `120ms`
- fast: `120ms` to `180ms`
- medium: `180ms` to `240ms`
- panel / layout shift: `220ms` to `320ms`

Preferred motion behavior:

- critical controls: immediate and tactile
- hover: slight lift, brightness, or compression
- panel changes: calm spring or eased transition
- live states: subtle and continuous only when meaningful

Rules:

- Animate state change, not decoration.
- Avoid constant movement on high-frequency work surfaces.
- Use one motion idea consistently across similar elements.
- Respect reduced motion.

When using Framer Motion, prefer a shared vocabulary over one-off easing curves.
