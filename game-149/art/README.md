# Hurray LA's Fairy Lamp Adventure — art

Painted sprites of the eight fairy lamps in [`js/sim/data/lamps.js`](../js/sim/data/lamps.js), painted from a
reference photo of a real collection of antique pressed-glass fairy lamps. Painterly game art, not photographs.

## Files (`art/lamps/`)

Four per lamp, transparent WebP, 1.3 MB for all 32:

| File | What it is | Used for |
|---|---|---|
| `ID-shade.webp` | the top glass dome alone | a face-up "top" tile |
| `ID-base.webp` | the bottom cup alone, unlit candle inside | a face-up "bottom" tile |
| `ID-unlit.webp` | the whole lamp, candle out | the shelf before a match |
| `ID-lit.webp` | the whole lamp, candle glowing through the glass | the shelf after a match, the win screen |

Lamp ids: `cobalt-hobnail`, `amber-hobnail`, `clear-diamond`, `green-starburst`, `amber-star`, `blue-moonstar`,
`pink-blossom`, `amethyst-diamond`.

**All four sprites of a lamp are the same size and pixel-aligned**: drawn at the same spot, the shade sits where it
sits on the whole lamp and the base where it sits under it. Use that for the "put it back together" animation, then
swap to `ID-unlit` / `ID-lit` (for the moon-and-star and blossom lamps the shade's hem goes *inside* the cup, so a
shade simply drawn over its base hides the cup's front rim).

## How they are made

Two passes, both `google/nano-banana-2.1/edit` on fal, 1:1, 2K, PNG.

1. **Masters** ([`dev/art/prompts.mjs`](../dev/art/prompts.mjs)): one painting of each whole lamp, with the reference
   photo in `image_urls` and the prompt written from the lamp's `ref` (where it is in the photo) and `art` fields. One
   shared system prompt holds the painterly style, one centred object, no text, a flat key background.
2. **Parts** ([`dev/art/edits.mjs`](../dev/art/edits.mjs)): every other sprite is an *edit of that master*: remove the
   shade (base), remove the base (shade), light or blow out the candle. "Keep the camera, framing and scale exactly the
   same" keeps the parts aligned and the bottoms the same height in every state. The first try painted each part
   separately and the stand-alone bases came out taller, different cups from the ones under the shades.

The master is the unlit lamp, except `pink-blossom`, whose master is the lit one (its unlit painting let the key colour
show through the glass). Two parts needed a second, more specific prompt: the moon-and-star shade (it grew longer)
and the blossom base (a scrap of the shade's hem was left floating); both are in `dev/art/edits.mjs`'s git history and
quoted in the game's changelog.

**Cut-out** ([`dev/art/export.py`](../dev/art/export.py), Pillow + numpy): the key is measured from the border (the
model's "magenta" drifts from #fe1ff8 to #d72dcb, its green from #04fa03 to #05c721), background is flood-filled from
the edges, alpha is feathered, and the key's tint is despilled everywhere (it shows through glass). All four parts of a
lamp share one crop box and one scale.

```bash
node game-149/dev/art/prompts.mjs                      # master requests (JSON)
node game-149/dev/art/edits.mjs                        # part edits (JSON), from the masters' fal URLs
python3 -I game-149/dev/art/export.py RAW_DIR          # RAW_DIR/ID-PART.png -> art/lamps/ID-PART.webp
```

The 2K paintings live in `dev/art/raw/` (git-ignored, ~130 MB). The reference photo is the owner's and is not kept in
the repo.

## Known nits

- `clear-diamond-lit`: the candlelight warms the whole clear glass to a pale amber.
- `cobalt-hobnail-lit`: a faint glow above the top opening.
