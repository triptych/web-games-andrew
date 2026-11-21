# Coppergate Lane — art

Every picture was generated with **fal** (`fal-ai/nano-banana-2`, and `fal-ai/nano-banana-2/edit` with a portrait as the
reference for the map sprites and Trina's expression) and exported with [export.py](export.py). Every prompt is in
[prompts.mjs](prompts.mjs), written from the game's data. Nothing is drawn by hand. 41 images, roughly $3.5.

| Folder | Count | Size | What |
|---|---|---|---|
| `art/por/` | 7 | 760 px tall, alpha | Wick, Trina (and excited), Mabel, Pilcrow, Bertram, Big Bertha, three-quarter length. |
| `art/chibi/` | 5 | 150 px tall, alpha | Map sprites, `/edit`s of each portrait, facing right (mirrored in code). |
| `art/bg/` | 4 | 1280×720 | The lane, the Wilds, the Gully and the lair: battle backdrops and scene paintings. |
| `art/cg/`, `art/title.webp` | 2 + 1 | 1280×720, 1600×900 | The title and ending paintings (the title is the same picture with the painted lettering covered; the game puts its own logo on it). |
| `art/enemy/` | 5 | ≤ 460 px, alpha | Battle sprites facing the viewer. Big Bertha fights as her portrait. |
| `art/prop/` | 24 | ≤ 420 px, alpha | Six buildings and set pieces one per image (workshop, bakery, Hall, Bertram's stall, the lair gate, the kettle); 18 smaller props cut from two 3×3 sheets. |
| `art/item/` | 21 | 96 px, alpha | Item icons cut from two sheets. |
| `art/tex/` | 9 | 384 px | Ground textures made seamless in export.py; the map spreads one over four tiles. |

## How they were made

1. A pilot of six (Trina's portrait, a crab, the workshop, grass, the nature sheet, the lane) to fix the style before the set.
   One shared `system_prompt` per kind keeps the set coherent: portraits, sprites, props and places each have their own.
2. **Portraits and sprites** on a flat key colour: green for most, magenta for what is green (Bertram's coat) or copper
   (Bertha, the Cog Sprite's brass is fine on either). **Chibi sprites** are `/edit`s of the portrait.
3. **Sheets** (3×3 props, item icons) save calls. The first item sheet came back as ragged rows instead of the 4×3 grid
   asked for, so its icons are picked by blob in reading order (`ITEMS_A_BLOBS` in export.py) instead of by grid cell.
4. **Textures**: the wall texture asks for "the flat top surface of a thick old craggy rock cliff seen from straight above"
   (game-028 learned this the hard way).
5. The title painting came back with "COPPERGATE LANE" painted into the sky despite "no text"; export.py covers it with the
   sky on either side (`TITLE_BOX`).

## export.py

```bash
python3 -I game-030/dev/art/export.py RAW_DIR [names]   # RAW_DIR holds <kind>-<id>.png
```

Keying (from game-140 and game-028): the key is the median of the border, alpha ramps with the distance to it, only
background connected to the border is keyed (plus enclosed pockets of near-pure key), part-key pixels are unmixed, and a 3 px
edge band is despilled. For magenta, pixels near the edge that are still clearly magenta-tinted are dropped, because a pink
rim shows against grass. Sheets are keyed whole, the opaque blobs found, and each cell keeps the blobs whose centres fall in
it. Textures are blended with a half-offset copy of themselves through a soft cross mask so they tile.

Regenerate a set with `node game-030/dev/art/prompts.mjs <set>` (portraits, enemies, bg, cg, tex, buildings, sheets, items),
which prints the `fal-ai/nano-banana-2` requests as JSON.
