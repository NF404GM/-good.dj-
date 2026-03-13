# good.DJ Interaction States

## State Philosophy

Every interactive element must tell the truth immediately.
State must be legible without relying on color alone.

Core states:
- default
- hover
- focus
- active
- disabled
- loading
- live
- warning

## Global Rules

- Hover: small lift, brightness, or border clarification
- Focus: unmistakable ring or outline
- Active: stronger contrast and tighter visual lock
- Disabled: lower contrast, still readable, never invisible
- Loading: communicate progress or busy state honestly

## Transport States

### Play / Pause

- Default: most visually dominant transport control
- Ready: strong readability even before playback
- Playing: clear live state, but not screaming
- Paused: still primary, visibly halted
- Disabled: obvious that the deck is not armed

### Cue

- Empty cue: available and precise
- Cue set: armed
- Holding preview: live but tactical
- Returning to cue: immediate and exact

### Sync

- Off
- Available
- Synced
- Master

The user should never wonder whether sync is merely enabled, truly locked, or currently master.

## Performance Panel States

### Cues

- Empty pads should look usable, not dead
- Set cues should feel stored and dependable
- Active cue should feel instant and tactical

### Loop

- Inactive loop sizes should remain scannable
- Active loop length should be obvious
- Loop adjust controls should feel secondary but available

### Stems

The stems surface must clearly separate:
- unavailable
- checking model
- ready
- separating
- loaded
- failed

Do not show live stem performance controls when real stems are not ready.

## Library States

Tracks, playlists, and inspector actions need honest visibility for:
- selected
- hovered
- loading
- unavailable
- load target
- dragging

## Feedback Timing

- Critical hardware-feel actions: `80ms` to `160ms`
- Hover and focus refinements: `100ms` to `180ms`
- Panel changes: `180ms` to `280ms`
- Large layout shifts: spring-based, restrained, under `320ms`

## Reduced Motion

When reduced motion is preferred:
- keep state changes instant or near-instant
- preserve contrast and layout hierarchy
- remove flourish, not clarity
