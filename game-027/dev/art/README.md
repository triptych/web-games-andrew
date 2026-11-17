# Alchemist's Lattice — the paintings (fal)

`../../art/` (56 WebP files, 1.8 MB) was made on 2026-11-17 with [fal](https://fal.ai), `fal-ai/nano-banana-2` (PNG), in v2.0.0,
and exported by `export.py`. 22 paid images: seven scenes, five cast sheets, three boss portraits, two foe sheets and five
sheets of elements, items, potions and the coin. Every take was kept; nothing was regenerated.

```bash
node game-027/dev/art/prompts.mjs                  # every job: { group, name, system, prompt, aspect_ratio, resolution }
node game-027/dev/art/prompts.mjs cast             # or: scenes, foes, things
node game-027/dev/art/prompts.mjs sheets > SHEETS.json
python3 -I game-027/dev/art/export.py RAW SHEETS.json   # RAW holds <name>.png
```

Every prompt is built from the game's data: a character's look is `art` in [story.js](../../js/sim/data/story.js) (with the four
expressions their scenes use), a foe's in [foes.js](../../js/sim/data/foes.js), an element's in
[elements.js](../../js/sim/data/elements.js), items and potions in [potions.js](../../js/sim/data/potions.js). `simtest.mjs` checks
that every painting the game asks for is on disk, and that every portrait a scene names exists.

| File | Use | Made |
|---|---|---|
| `title.webp` (1600 px) | The title screen | 2K, 16:9 |
| `workshop.webp` | Behind the lattice in every level (darkened, fitted to cover the screen) | 2K, 16:9, "softly out of focus" |
| `table.webp` (768 px) | The lattice's oak plate (brass grid lines are drawn over it in a shader) | 1K, 1:1, "seen exactly from directly above" |
| `map.webp` | The chapter map | 2K, 16:9 |
| `cauldron.webp`, `shop.webp`, `ending.webp` | The cauldron, Pellerin's stall, the ending | 2K, 16:9 |
| `cast-<id>-<expression>.webp` ×20 (384 px) | The dialog portraits, Pellerin at his stall | one 2K 2x2 sheet per character, the same face in four expressions |
| `foe-warden`, `foe-serpent`, `foe-homunculus` (512 px) | The bosses: their tokens on the lattice, the brief, the map | 1K, 1:1 |
| `foe-<id>.webp` ×6 (384 px) | The other foes (the Serpent Tail uses the Serpent) | two 2K 2x2 sheets |
| `el-<id>.webp` ×6, `item-<id>` ×5, `potion-<id>` ×8, `coin` (256 px) | The elements (also painted on the top of every tile, through a 4×2 atlas), the items, the potion shelf, gold | five 2K 2x2 sheets |

## The system prompt (shared)

"You illustrate ALCHEMIST'S LATTICE, a cozy fantasy alchemy puzzle game. Every image is a rich hand-painted illustration: warm
oil-paint textures over fine ink linework, candlelit amber, brass and honey tones against deep teal and indigo shadows, a soft glow
from potions and embers, gentle storybook whimsy. Every image is one seamless painting that fills the whole canvas edge to edge:
never a page, never a torn or deckled paper edge, never a white or cream border, never a frame. Original characters only. Never
include any text, letters, numbers, runes, symbols, logos, signatures, watermarks or user-interface elements anywhere in the image."

The edge-to-edge sentence comes from CLEAN SLATE's lessons (game-139): "storybook" alone brought paper margins there.

## What to know

- **Sheets.** Four subjects to a 2K sheet keeps the job count (and the size of each fal reply) down, and four expressions of one
  character on one sheet keeps the face identical between them. `export.py` cuts each cell with a 2.5% inset to drop the gutters,
  then `trim()` peels near-uniform light or dark margins, up to 9% a side: `things-5` came back with cream gutters.
- **Short sheets.** The second foe sheet had only two foes; its empty quarters repeat them (`null` in `SHEETS`, skipped by the
  exporter).
- **The table** came back with brass inlay strips and two candle stubs at the corners; the shader darkens it and draws the grid over
  it, and the corners sit under the lattice's rim.
