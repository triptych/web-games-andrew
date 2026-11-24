# Hurray LA's Fairy Lamp Adventure — art

Painted sprites of the eight fairy lamps in [`js/sim/data/lamps.js`](../js/sim/data/lamps.js), painted from a
reference photo of a real collection of antique pressed-glass fairy lamps. Painterly game art, not photographs.

## Files (`art/lamps/`)

Four per lamp, transparent PNG:

| File | What it is | Used for |
|---|---|---|
| `ID-shade.png` | the top glass dome alone | a face-up "top" tile |
| `ID-base.png` | the bottom cup alone, unlit candle inside | a face-up "bottom" tile |
| `ID-unlit.png` | the whole lamp, candle out | the shelf before a match |
| `ID-lit.png` | the whole lamp, candle glowing through the glass | the shelf after a match, the win screen |

Lamp ids: `cobalt-hobnail`, `amber-hobnail`, `clear-diamond`, `green-starburst`, `amber-star`, `blue-moonstar`,
`pink-blossom`, `amethyst-diamond`.

## How they are made

- **Model**: `google/nano-banana-2.1/edit` on fal, 1:1, 2K, PNG, with the reference photo in `image_urls`.
- **Prompts**: built from the lamp table by [`dev/art/prompts.mjs`](../dev/art/prompts.mjs), so each lamp's
  `art` description is the single source of truth. One shared system prompt (the painterly style, one object,
  no text, flat key background) keeps the set coherent.
- **Background key**: flat magenta `#ff00ff`, or green `#00ff00` for the pink and amethyst lamps. Cut out by
  flood fill from the border, trimmed, scaled down (as `game-126/dev/art/export.py` does).
- **Reference photo**: the owner's photo of their collection; it is not kept in the repo.

```bash
node game-149/dev/art/prompts.mjs                         # every request as JSON
ONLY=cobalt-hobnail node game-149/dev/art/prompts.mjs      # one lamp
```

Pilot first (one lamp, all four parts), look at it, then paint the rest.

## Status

Not painted yet: the fal account needs credit. Until then the view draws code-made glass silhouettes in each
lamp's `glass` colour.
