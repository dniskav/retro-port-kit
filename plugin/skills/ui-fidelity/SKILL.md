---
name: ui-fidelity
description: Reproduce the layout of a reference UI without copying its assets. Use when replicating menus, HUDs and screens. Extract geometry from code hit-areas and reference screenshots, then draw original vector art in that layout.
---
# UI fidelity without asset reuse

1. Dump the **active areas** the code already defines (button/hit rectangles) per screen, by instrumenting the running app. These are authoritative coordinates.
2. Measure panel/frame rectangles on reference screenshots with a script (colour threshold + connected components). Keep numbers, not pixels.
3. Define a small design system (palette roles, border styles, fonts) and write each screen as data: list of rectangles/rows/labels.
4. Render backgrounds as SVG; draw text at run time with the generated vector fonts.
5. Compare screenshots side by side; fix overlaps (line pitch ≥ cap height + gap), overflowing labels, alignment.
6. Do not edit code constants from the original unless the new art requires it; record such changes.
