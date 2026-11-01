# Pixel fonts

`font5x7.ts` is the glyph source for `pixelfont.ts` (accented Latin-1 + CP437 symbols) and `fontbuild.ts` (TTF/WOFF/WOFF2, no dependencies).

## Provenance

The 5×7 table is the classic public-domain bitmap font of the `glcdfont` lineage, widely redistributed for small displays. It is **not** derived from any game, and it contains no third-party code. It ships as a convenience: if your clean-room policy requires a fully original typeface, replace `font5x7.ts` (it is data, not code) and keep the same `glyphRows(code) → number[7]` contract.

`pixelfont.ts` adds accents, descenders and code-page symbols on top of the base table; those additions are original.

## Contract

- `glyphRows(code)` returns 7 rows of 5 bits (bit 4 = leftmost column) for ASCII 32..126; out-of-range returns blank rows.
- `pixelfont.ts` returns `{ rows, y0 }`; `y0 < 0` means the glyph starts above the cap line, `y0 = 7` is the descender row.
- Every glyph must be exactly 5 columns × 7 rows; `tests/tools.test.mjs` checks the table length and width.

## Build

```sh
node --experimental-strip-types tools/pixel-fonts/fontbuild.ts   # Node >= 22.6 (type stripping)
```

The generated WOFF2 is padded to a multiple of 4 bytes (browsers reject it otherwise).
