---
name: fault-bisect
description: Systematically isolate opaque failures (a decoder or browser rejects a generated file, a hash differs, a test flips). Use when the error message gives no cause. Vary one factor at a time against a known-good artifact.
---
# Bisecting opaque failures

1. Obtain a **known-good** artifact and a **known-bad** one (or create the smallest bad one).
2. Read every diagnostic the target offers (logs, validator output, hex dump of headers). Compare headers/lengths field by field first.
3. Change ONE factor per experiment (subset of inputs, a constant, a flag); keep a table of results in `docs/EXPERIMENTS.md`.
4. Beware correlated factors: file size parity, alignment, ordering, length fields. Test the cheap structural hypotheses (alignment, padding, endianness, limits) before content ones.
5. When a fix works, write a regression test and a one-line note in the format docs.
