---
name: dos-video-modes
description: Decode and reproduce DOS video output: mode 13h, Mode X planar, EGA/CGA and text modes, VGA palettes and pixel aspect, VRAM dumps, FLIC animation. Use when extracting art, matching a screen, or debugging "it renders but looks wrong".
---
# DOS video modes

## Know which mode you are in
Read `INT 10h AH=0Fh` (current mode) and the CRTC/sequencer registers, or the mode set call in the code.

| mode | resolution | colours | memory |
|---|---|---|---|
| 03h/07h | 80×25 / 80×25 mono | text | `B800:0000` / `B000:0000` |
| 04h/05h | 320×200 | 4 | 2 bits/px, interleaved |
| 06h | 640×200 | 2 | 1 bit/px |
| 0Dh/0Eh | 320×200 / 640×200 | 16 | 4 planes |
| 10h | 640×350 | 16 | 4 planes |
| **13h** | **320×200** | **256** | linear `A000:0000`, 64 000 bytes, chain4 |
| **Mode X** | **320×240** | **256** | 4 planes, 19 200 bytes each, unchained |
| VESA | varies | 256/15/16/24/32 | `INT 10h AX=4F00/4F01/4F02`, linear FB |

## Planar vs linear
- Mode 13h: one byte per pixel, rows of 320 bytes; palette index direct.
- Mode X / EGA: four planes selected with the **Map Mask** (`3C4h` index 2) and **Read Map Select** (`3C4h` index 4); row offset is 80 bytes (320/4), not 320.
- Latches (`3CEh` index 4/5/6) make naive reads return the wrong plane. Read one plane at a time.
- Page flipping and "Mode Y" (320×400) change the row offset; derive it from the CRTC, do not hardcode 320.

## Palette
- DAC is **6-bit** (0..63) on ports `3C8h` (write index) / `3C9h` (data). Expand with `v * 255 / 63` (or `v << 2 | v >> 4`); do not treat it as 8-bit.
- Dump all 256 entries at the same moment as the VRAM dump; games fade and cycle palettes.
- `.PAL` may be raw 768 bytes, RIFF PAL, or JASC text: detect, do not assume.

## Pixel aspect
- 320×200 fills a 4:3 screen by stretching vertically (~1.2×; often shown as 320×240 or 640×480). Pixels are not square.
- 320×240 (Mode X) and 640×480 are square. Decide the target once, put it in the policy, and never "fix" it per screen.
- Web: render to a low-res offscreen buffer, scale by an **integer** factor, `imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`, letterbox the rest.

## Extracting art without copying it
1. Freeze a known screen (title, HUD, one sprite frame) and dump VRAM + palette + registers together.
2. Decode planes/chain according to the mode; verify by re-rendering the dump and comparing its hash with the screenshot.
3. For sprites/tiles, find the blitter and its source rectangle rather than slicing screenshots by eye.
4. Keep the dump as *reference* outside the repo; the shipped art is regenerated or redrawn (clean-room gate).

## Animation
- FLIC (`.FLI`/`.FLC`): header magic `AF11h`/`AF12h`, frame chunks (colour, delta, black, copy, LC/SS2). Decode to frames + palettes; 320×200 is the common size.
- Verify a decoded frame against the emulator screenshot before using it as a spec.

## Failure signatures
- Diagonal/sheared image: wrong row offset or plane stride.
- Wrong colours only: palette not dumped, or 6-bit treated as 8-bit.
- Half the image missing: only one plane read.
- Stretched/squashed: pixel aspect ignored or applied twice.
