---
name: dos-binary-analysis
description: Analyse DOS executables and memory: MZ/LE/NE headers, overlays and packers, real-mode segmentation, interrupts, memory models, DPMI. Use to locate routines, tables and file loaders before writing a spec.
---
# DOS binary analysis

## Read the container first
- **MZ**: `MZ` at 0, `e_cparhdr` (header paragraphs), `e_cs:e_ip` entry, `e_ss:e_sp` stack, `e_lfarlc` relocations, `e_lfanew` at 0x3C.
- `e_lfanew` points to **LE/LX** (DOS4GW/Watcom, 32-bit protected mode), **NE** (segmented Windows/OS2) or nothing (plain real-mode).
- **Overlays**: code swapped from `.OVL`/`.DAT` at runtime; find the loader, dump each overlay as it is loaded, analyse per overlay.
- **Packers**: PKLITE, LZEXE, EXEPACK, DIET, custom. Unpack first (`unp`, `unlzexe`, or emulate until the original entry point) and verify the unpacked image runs. Never analyse a packer stub as if it were the game.

## Real mode model
- Address = `segment * 16 + offset`, wraps at 1 MiB (A20). IVT at `0000:0000` (256 vectors); PSP at the program segment (`DS`/`ES` at entry).
- Common interrupts: `INT 21h` DOS, `INT 10h` video, `INT 16h` keyboard, `INT 33h` mouse, `INT 67h` EMS, `INT 2Fh` multiplex/XMS, `INT 31h` DPMI, `INT 8h` timer.
- Memory models (tiny/small/compact/medium/large/huge) decide whether pointers are near (16-bit) or far (`seg:off`). Get this wrong and every table looks like noise.
- Segment registers: `DS` data, `ES` extra/string ops, `SS:SP` stack, `CS:IP` code. Functions often return far pointers in `DX:AX`.

## Tools and workflow
- Disassemble as 16-bit (`rizin -a x86 -b 16`, objdump, IDA DOS loader, Ghidra MZ/raw loader, or REA).
- Load the image at `PSP + 0x100` and start at `CS:IP`; mark the PSP and IVT hooks.
- Find file I/O by `INT 21h` calls (`3D/3F/40/42`), not by guessing filenames.
- Find the main loop by the timer tick (`INT 8h` hook or port `0x40`) and the keyboard poll.
- Name routines by behaviour (`load_tile_table`, `update_entities`); keep raw addresses only in provenance docs.
- Watch for self-modifying code, undocumented opcodes, `INT 3` hooks, and anti-debug checks; note them in the unknowns ledger.

## Extract data mechanically
- Strings: CP437/CP850, often length-prefixed or NUL-terminated; dump with the right code page.
- Tables: locate by xref from the routine that indexes them; extract with a script and verify with checksums and count/range invariants.
- Compression: RLE, LZSS, Huffman, proprietary; write a standalone decoder with self-checks and test vectors.
- Every extracted table needs source (file/offset or routine), method and confidence.

## Deliverable
Inventory entries, decoders with tests, extracted tables, named routines, and a list of what is still unknown. A decompiler listing is evidence, not a spec.
