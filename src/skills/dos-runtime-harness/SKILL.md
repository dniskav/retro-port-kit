---
name: dos-runtime-harness
description: Run a DOS game reproducibly as a reference oracle: emulator choice, fixed configuration, input automation, screenshots, save states, timing and capture hygiene. Use before recon, whenever the original must be observed, and when two runs disagree.
---
# DOS runtime harness

Goal: turn the original into a **reproducible oracle**, not a thing you poke by hand.

## Emulator choice
- **DOSBox-X**: debugger, save states, many machines, good for analysis and captures.
- **DOSBox Staging**: best default for "how it looked/sounded"; sane defaults.
- **86Box / PCem**: cycle-accurate hardware when timing bugs matter (speed-sensitive loops, raster effects).
- **QEMU/FreeDOS**: only for building DOS tools; not a reference for timing.

## Pin the configuration (commit it)
```ini
[dosbox]
machine=svga_s3
memsize=16
[cpu]
core=normal
cputype=386_slow
cycles=fixed 20000
[render]
aspect=false
scaler=none
frameskip=0
[mixer]
rate=48000
nosound=false
[sblaster]
sbtype=sb16
```
- One config per reference run; record emulator name/version and every non-default value.
- `cycles=fixed` is the single most important knob: many DOS games change speed with the CPU. If the game is speed-sensitive, capture at the speed the design assumes (often a 386/33 or 486/66) and say so.
- Disable frameskip, scalers and shaders: they hide timing and pixel-level facts.

## Automate the run
- Start from a known state: `-c "mount c ." -c "c:" -c "GAME.EXE"`, scripted keys via `autotype`/`-c` where supported, or an input recorder.
- Capture: screenshots (built-in capture or CDP-like automation), save states at labelled moments, and audio/video recordings for animation and sound.
- Name captures by scenario + tick/frame + config hash. Store them **outside the repo** (or in a git-ignored `reference/`), never in tracked files.

## Determinism checklist
- Same emulator build, config, DOS version, and starting snapshot.
- Fixed cycles, no frameskip, fixed mixer rate.
- Record the RNG seed if the game exposes one; otherwise replay the same input log.
- Two runs must produce the same screenshot hash for a static screen. If not, find what varies (time, RNG, file order) before trusting any capture.

## Observation discipline
- Capture **states**, not just final screens: menus, first frame, mid-animation, collision, death.
- Dump memory/palette at the same moment as the screenshot so both describe one state.
- Write down what the game *does* (behaviour), then find where it is implemented. Do not infer rules from a single frame.
- Every fact that lands in a spec gets `[source: run/config/scenario, confidence]`.

## Safety
- Emulators that grab the mouse/keyboard need an idle, unlocked desktop session: ask before running; never while the user works.
- Reference binaries and captures are inputs, not deliverables: the clean-room gate applies to the repo.
