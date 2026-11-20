# Echoes of Aethermoor — art

Every picture was generated with **fal** (`fal-ai/nano-banana-2`, and `fal-ai/nano-banana-2/edit` with the base
portrait as a reference wherever a character has to stay recognisable) and exported with [export.py](export.py).
Every prompt is in [prompts.mjs](prompts.mjs), written from the game's data. Nothing is drawn by hand. About 75 images,
roughly $6.

| Folder | Count | Size | What |
|---|---|---|---|
| `art/por/` | 21 | 760 px tall, alpha | The cast at three-quarter length, plus expressions (Lyra happy, sad, fierce; Orin angry; Sera smiling; Thane ashamed; Varec worried; Sylvara in pain). Korvas and Vaelthas also stand in battle as their portraits. |
| `art/chibi/` | 11 | 150 px tall, alpha | Map sprites, `/edit`s of each portrait, facing right (mirrored in code). |
| `art/bg/` | 9 | 1280×720 | The places, as backdrops for scenes and battles. |
| `art/cg/` | 5 | 1280×720 | Story illustrations: the prologue, Korvas's end, the seal breaking, the two endings. The title painting is `art/title.webp` (1600×900). |
| `art/enemy/` | 7 | ≤ 460 px, alpha | Battle sprites, facing the viewer. |
| `art/prop/` | 33 | ≤ 420 px, alpha | Buildings and the World Tree one per image; 27 smaller props cut from three 3×3 sheets. |
| `art/item/` | 20 | 96 px, alpha | Item icons cut from one 5×4 sheet. |
| `art/tex/` | 8 | 384 px | Ground textures, made seamless in export.py; the map spreads one over four tiles. |

## How they were made

1. A pilot of five (Lyra, the village, a slime, grass, the nature sheet) to fix the style before the set.
2. **Portraits** on a flat key colour: green (`#00ff00`) for most, magenta for anything green (Sera, Sylvara, Holt).
   Expressions are `/edit`s: "same character, same clothes, same pose and framing, same background: now …".
3. **Map sprites**: `/edit`s of the portrait into a chibi figure facing right. Varec's first came back as pixel art and
   was redone with Lyra's sprite as a second reference and "NOT pixel art".
4. **Illustrations** that show the cast are `/edit`s with their portraits as references and "use the reference images
   only for the faces, hair and clothing; paint a new full scene" so no key colour leaks in. The "release" ending was
   redone with all four heroes as references after the first showed strangers.
5. **Textures**: the first wall texture came back as a photo of a castle wall in perspective; the prompt now asks for
   "the flat top surface of a thick old stone wall seen from straight above".

## export.py

```bash
node game-028/dev/art/ids.mjs                          # sheet cell names → prompts_ids.py
python3 -I game-028/dev/art/export.py RAW_DIR [names]  # RAW_DIR holds <kind>-<id>.png
```

Keying (from game-140): the key is the median of the border, alpha ramps with the distance to it, only background
connected to the border is keyed (plus enclosed pockets of near-pure key), part-key pixels are unmixed, and a 3 px edge
band is despilled (green or magenta, whichever the key is). Sheets are keyed whole, the opaque blobs found, and each
cell keeps the blobs whose centres fall in it. Textures are blended with a half-offset copy of themselves through a soft
cross mask so they tile.
