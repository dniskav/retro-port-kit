# Reference runs

One row per captured reference. Captures live in `reference/` (git-ignored); only this table is tracked.

| date | game version / sha256 | emulator + version | config | scenario | capture |
|---|---|---|---|---|---|
| | | | `dosbox.conf` @ <sha> | title screen | `reference/title.png` |

Rules:
- Same emulator build + config + starting snapshot for every comparison.
- Record the CPU speed (`cycles`), mixer rate, DOS version and any non-default setting.
- A screenshot is only evidence together with the state (VRAM + palette + registers) captured at the same moment.
