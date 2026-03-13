# good.DJ Layout System

## Shell Anatomy

The desktop shell should read in four bands:

1. Top control rail
2. Performance field
3. Crossfader strip
4. Collection workspace

The user should understand this structure instantly.

## Recommended Vertical Rhythm

On a standard desktop window:

- Top rail: `56px` to `64px`
- Performance field: `52vh` to `60vh`
- Crossfader strip: `72px` to `92px`
- Collection workspace: `28vh` to `36vh`
- Bottom status rail: `24px` to `28px`

Avoid over-compressing the performance field just to show more library rows.

## Horizontal Balance

Recommended performance split on wide windows:

- Deck A: `5fr`
- Mixer spine: `4fr`
- Deck B: `5fr`

On tighter widths:

- Deck A: `4fr`
- Mixer spine: `3fr`
- Deck B: `4fr`

The center must still feel authoritative, not pinched.

## Deck Structure

Each deck should be built from four internal zones:

1. Header
2. Wave zone
3. Performance panel
4. Transport

Recommended deck rhythm:

- Header: `96px` to `116px`
- Wave zone: `220px` to `300px`
- Performance panel: `180px` to `260px`
- Transport: `92px` to `116px`

## Deck Header

The header should contain:

- deck badge
- track identity
- remain/time
- key
- BPM
- pitch
- sync/master state

Utility actions should not visually overpower transport or waveform.

## Wave Zone

The waveform is the visual anchor of the deck.

Rules:
- it should own horizontal attention
- playhead should be unmistakable
- empty state should still feel premium and ready
- overview and main waveform should read as one system

## Performance Panel

The mid panel is mode-based:

- Cues
- Loop
- Stems

The active mode should be visually clear without becoming loud.
The panel should never look like dead filler beneath the waveform.

## Transport Cluster

Transport should be the clearest action cluster on the deck.

Recommended weight:

1. Play / Pause
2. Cue
3. Sync

Do not give all three equal visual importance.

## Mixer Spine

The center column should feel like one continuous control object.

It should contain:
- trim / EQ / filter
- FX
- channel faders
- master metering
- central system status

The eye should feel pulled inward to the mixer, then back out to the decks.

## Collection Workspace

The lower field should have three clear sub-zones:

1. Sidebar
2. Table / list workspace
3. Inspector

Recommended width rhythm:

- Sidebar: `220px` to `260px`
- Inspector: `280px` to `340px`
- Table workspace: flexible remainder

Search and sort should live in a dedicated toolbar row above the table.

## Resizing Rules

- Preserve deck and mixer identity as the window narrows
- Reduce decorative and secondary UI before shrinking transport
- Keep primary actions visible at all desktop widths
- Avoid layout jumps that break spatial memory
