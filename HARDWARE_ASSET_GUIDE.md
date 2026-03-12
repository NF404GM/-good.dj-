# good.DJ Hardware Asset Engineering & Design Bible

This document is the supreme authority on the generation, processing, and implementation of hardware assets for the **good.DJ** ecosystem. It codifies our goals for "Tactile Realism" and provide the technical blueprint for the **Deterministic Hardware Engine**.

> [!IMPORTANT]
> **The good. Company Brand Bible** is the supreme authority. This document operationalizes its directives for hardware. When any technical implementation conflicts with the Brand Bible, the Brand Bible wins — always.

---

## 1. High-Level Vision & Design DNA

Our goal is not to build a "music app," but a **Virtual Boutique-Hardware Instrument**. The software should feel like a physical unit you can reach out and touch.

### A. The Core Aesthetic: "Tactile Realism"

We combine **Glass-morphism**, **Modern Typography**, and **Deterministic 3D Renders** to create a premium, high-end studio feel.

### B. Theme Guidelines

* **Default Theme (Hardware Warm)**:
  * *Vibe*: Utility, High Contrast, Precision-focused studio hardware.
  * *Color Palette*: Deep blacks, warm grays, signal-green accents.
  * *Materials*: Knurled metal, soft-touch rubber, matte finishes.
  * *Rounding*: Minimal (2px - 4px).

### C. Design Principles

Every element reflects a unified organic style. No element should feel flat or lifeless.

* **Goal**: Make pixels feel like real hardware you can reach out and touch.

---

## 2. Motion Strategy: The Principles of Animation

We utilize the **12 Principles of Animation** to transform pixels into hardware:

1. **Squash and Stretch**: Buttons deform slightly on press (`scale(0.96)`) to imply mass.
2. **Anticipation (The Reveal)**: Hover states use a subtle "lift" shadow or glow to prepares the user for interaction.
3. **Staging**: When a panel opens (e.g., FX), the animation guides the eye to the primary control first, dimming secondary elements.
4. **Slow In & Slow Out**: All hardware movements (faders/knobs) use custom Cubic-Bezier easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) for mechanical authenticity.
5. **Solid Drawing**: We use CSS perspective and 3D transforms to maintain the illusion of volume.

---

## 3. The Deterministic Hardware Engine

To ensure zero visual drift, every asset must pass through this deterministic pipeline.

### A. Phase 1: Generation Directives (Nano Banana 2)

Force the AI into an **Orthographic State** via strict prompt engineering:

* **Positive Prompt Base**: `Orthographic 2D UI asset, dead-on perfectly flat front view, stark solid #FFFFFF background, symmetrical, sharp vector-like edges, flat GUI lighting.`
* **Negative Prompt (Strict)**: `isometric, perspective, 3D depth, drop shadows, floor reflections, cast shadows, gradients on the background, angled views, tilted axes.`

### B. Phase 2: Post-Processing (`scripts/process_asset.py`)

Raw assets are cleaned through our Python pipeline:

1. **rembg Isolation**: background removal via U2-Net.
2. **Alpha Clipping (10% Threshold)**: Any pixel below ~25 opacity is deleted. This **ERASES** all AI-generated checkerboard artifacts and ghosting.
3. **Strict BBox Trimming**: The image is cropped to its exact physical bounds.
4. **Deterministic Scaling/Centering**: The unit is placed on an integer-centered transparent canvas of the target dimensions.

---

## 4. Technical Integration & "The Skeleton Principle"

### A. The Skeleton Principle (Fail-Safe UI)

Assets must be layered. If a 3D asset fails to load, the UI must remain functional and beautiful using CSS-only fallback skins.

* **Layer 1**: Semantic HTML / Interactive Logic.
* **Layer 2**: CSS Background Color / Border (The Skeleton).
* **Layer 3**: The Deterministic 3D Render Asset (The Tactile Skin).

### B. Precision Scaling (1:1 Rule)

* `background-size: 100% 100%` is mandatory.
* We no longer use CSS-masking or 160% overscan hacks, as the **Deterministic Engine** pre-masks the assets.

### C. Hardware Bounding Box Index

| Component       | Dimensions  | View  | Material                  |
|:----------------|:------------|:------|:--------------------------|
| **Play Button** | 80 x 48 px  | Front | Backlit Gloss Acrylic     |
| **Cue Button**  | 60 x 38 px  | Front | Backlit Gloss Acrylic     |
| **Knob Top**    | 32 x 32 px  | Top   | Dark Knurled Metal        |
| **Fader Cap**   | 44 x 28 px  | Front | Soft-touch Matte Rubber   |
| **Jog Platter** | 160 x 160 px| Top   | Brushed Aluminum          |
| **Stem Toggle** | 28 x 12 px  | Front | Chrome Mechanical Switch  |

---
*Created for good.DJ Engineering. Strictly follows The good. Company Brand Bible.*
