---
name: dos-audio-opl
description: Handle DOS audio: AdLib/OPL2/OPL3 register model, Sound Blaster DSP and PCM, PC speaker, MIDI/XMI, tracker formats, capture and re-synthesis. Use for music, sound effects, and when audio is silent or wrong.
---
# DOS audio

## Identify the hardware path
- **AdLib / OPL2** (YM3812): ports `388h` (status/index) / `389h` (data).
- **OPL3** (YMF262): adds `38Ah`/`38Bh` (second bank); Sound Blaster FM often at `228h`/`229h`.
- **Sound Blaster DSP**: base `220h`; reset `226h`, read `22Ah`, write `22Ch`, DMA channel 1.
- **PC speaker**: PIT channel 2 (`42h`/`43h`) gated by port `61h` bits 0–1.
- **MPU-401 MIDI**: `330h`/`331h`. **Covox/Disney**: parallel-port DAC.
- Detect by probing in the emulator and by the strings/ports in the binary; do not assume Sound Blaster.

## OPL register model (what a patch actually is)
- `20h–35h` AM/VIB/EGT/KSR/MULT · `40h–55h` KSL/TL · `60h–75h` AR/DR · `80h–95h` SL/RR · `A0h–A8h` F-Num low · `B0h–B8h` key-on/block/F-Num high · `C0h–C8h` feedback/connection · `BDh` rhythm and depth · `E0h–F5h` waveform (OPL2).
- Two operators per channel (modulator + carrier), 9 channels (OPL2) or 18 (OPL3). Operator register offset is not `channel * 2`: derive it from the slot table, do not guess.
- Instruments are small register sets (11-byte OPL2 lineage, tracker `.ADL`/`.HSC`, IMF port/value streams). Dump the writes, do not retype patches.

## Capture
- Log **port writes with timestamps** (emulator debugger or an I/O trace), then replay the log through an OPL core; compare the rendered PCM with the emulator recording.
- Record PCM at a fixed rate (48 kHz), mono/stereo as the game outputs; keep the config hash.
- `.VOC`: `Creative Voice File\x1Ah`, block types 1/2/8/9 (sound data, continuation, extended, new format). `.WAV`/RIFF is the modern container.
- XMI is Miles XMIDI (`FORM XDIR` → `XMID` → `EVNT`/`TIMB`), not plain MIDI: convert with loop/velocity semantics preserved.

## Reproduce on the web
- **Web Audio** only after a user gesture (`AudioContext.resume()`); one context, one master gain, explicit mute.
- FM: either port an OPL core you have the right to use, or pre-render **original** compositions. Check the licence of any emulator core; GPL cores are not shippable in an MIT project.
- Schedule with `AudioContext.currentTime`, not `setTimeout`; render offline with `OfflineAudioContext` for tests.
- Deterministic synthesis: integer phase accumulators, fixed sample rate, no `Math.random`; hash the rendered PCM in CI.
- Never ship original `.VOC`/`.XMI`/`.HSC`/`.ADL` files: re-synthesize or write new music (clean-room gate).

## Failure signatures
- Silence: no user gesture, wrong sample rate, muted master, or the game never enabled the card.
- Clicks/pops: scheduling drift, no envelope, buffer underrun.
- Wrong instruments: OPL slot offset guessed, or 4-op/OPL3 bank selected on OPL2.
- Music too fast/slow: timer-driven playback tied to CPU cycles (see `dos-runtime-harness`).
