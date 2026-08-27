# Phase 0 Ground-Truth Reference Extraction & Notes

## Extraction Provenance
- **Source**: `https://andrewtrousdale.com/`
- **Render Engine**: Playwright Chromium Dynamic Fetcher (1440×900 desktop & 390×844 mobile viewports)
- **Extracted Artifacts Saved in `reference/`**:
  - `reference/trousdale_rendered.html` (28,712 bytes fully painted SPA DOM)
  - `reference/css/app.css` (35,458 bytes stylesheet)
  - `reference/trousdale_desktop.png` (Desktop 1440×900 capture)
  - `reference/trousdale_mobile.png` (Mobile 390×844 capture)

---

## Measured Interaction & Motion Parameters

| Property | Measured Value from `app.css` | Implementation Mapping for Cape Plot |
| :--- | :--- | :--- |
| **Primary Motion Easing** | `cubic-bezier(0.16, 1, 0.3, 1)` | Used for all camera transitions (pan/zoom), viewport shifting, and modal dock entrance. |
| **Camera Transform Duration** | `400ms – 800ms` | Smooth spatial repositioning between District Level 0 and Block Level 1. |
| **Hover Opacity Duration** | `100ms – 200ms` | Swift label reveal and peripheral node dimming on mouseover. |
| **Background / Color Transition** | `200ms ease` | Clean color switches between active/idle states and Index rows. |

---

## Typography & Visual Language

- **Type Hierarchy**:
  - High-contrast grotesque sans-serif stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif`.
  - Plot node labels: Small, crisp, geometric (`10px – 11px`, tracking `0.02em`).
  - Index block headers: Quiet, confident, typographic grouping (`14px – 16px`, bold/medium).
  - Detail dock facts: Clear label/value typographic pairs with tabular figures.
- **Color Palette (Cape Plot Product Palette)**:
  - **Paper (Canvas Background)**: `#F3EFE6`
  - **Ink (Text & Major Marks)**: `#1A1916`
  - **Sea (Accent & Focus State)**: `#1F5C57`
  - **Hairline (Subtle Borders & Grid Lines)**: `#E4DDD2`
  - **Muted Ink (Secondary text & inactive nodes)**: `#7A756D`

---

## Architectural Adaptation for Kanyakumari Education

1. **Dual Surface (Plot ↔ Index)**:
   - **Plot Surface**: 2D SVG canvas. Level 0 (District 9-block clusters) → Level 1 (Block nodes packed schematic) → Level 2 (Institution selection). Pan by dragging, zoom with scroll wheel / pinch.
   - **Index Surface**: Typographic list grouped by the 9 canonical blocks, sub-grouped into Schools and Colleges.
   - **Persistence**: Switching between Plot and Index preserves active block filter, search query, and selected institution.
2. **Node Geometry (Shape Only — No Rainbow Colors)**:
   - **Schools**: Small solid discs (`circle`, radius `3.5px`).
   - **Colleges**: Small distinct squares (`rect`, side `7px` or ring).
3. **Mandatory Schematic Disclaimer**:
   - Every view includes the non-GPS disclaimer:
   > *"Node positions are schematic within the block. They are not GPS coordinates."*
