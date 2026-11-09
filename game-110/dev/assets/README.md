# Doom & Doilies: the art pipeline

The pictures in `../../assets/` were made with [fal](https://fal.ai), then cut and sliced by the scripts here. The scripts need
only Python 3 with Pillow and numpy; run them with `python3 -I`. They take a folder of raw renders and write `assets/`.

## How it was made

Every picture started from the sprite the game used to paint in code. `render_refs` (a throwaway Playwright script, not kept)
drew each painted sprite from `js/view/art.js` at 6 to 24 times its size on flat magenta, and each reference went to fal's
**`fal-ai/nano-banana-2/edit`** with a short prompt asking for the same character, pose and colours redrawn as polished HD-2D pixel
art. That keeps every minion, visitor, pet and centrepiece recognisably the one in the shop and the castle, instead of an
invention. Two pictures came from plain text-to-image (`fal-ai/nano-banana-2`): the greyscale texture sheet and the five pet accessories.

| Use | Endpoint | Reference | Notes |
|---|---|---|---|
| the Overlord, one sheet per tool | `.../edit` | her three painted poses side by side, 21:9 | `resolution: 2K` |
| 12 minions, 4 visitors, the henchman | `.../edit` | the painted sprite, 1:1 | `resolution: 1K` |
| 4 centrepieces | `.../edit` | the four painted tiers side by side, 4:1 | `2K`; "each a bigger, fancier version" |
| 7 Skull Swap tokens, scissors and paw icons | `.../edit` | the painted 16x16 token, 1:1 | |
| 6 pets, idle frame | `.../edit` | the painted pet (a sheet, asking for "only the first figure") | `1K`, 1:1 |
| 6 pets, other frames | `.../edit` | **the generated idle frame**, "change only the expression" (happy, sad, blink; the bat's wings raised, the dog's tail raised) | `1K`, 1:1, one picture per frame |
| texture sheet | text to image | none | "3 by 3 grid of nine seamless tileable swatches ... strictly greyscale", 2K |
| pet accessories | text to image | none | "five small game accessories in a row", 4:1 |

All prompts end with `Plain flat solid magenta (#ff00ff) background, no shadow, no text, no border, no grid lines.`, which
`cutout.py` keys out. At about $0.08 a 1K picture and a little more at 2K, the whole set, retries included, cost a few dollars.

## What the scripts cope with

- **`cutout.py`** measures the key colour from the image border (the model does not hold #ff00ff exactly: some sheets come back
  salmon, orchid or lavender). On a near-pure magenta it keys by colour-to-alpha with a hard cut-off, so the ghosting and smears the
  model sometimes leaves in a neighbouring cell vanish; this game's palette is all purples and pinks, so only pixels that are
  mostly background go. On a washed-out background it flood-fills from the border instead, so a lavender bunny with a dark
  outline survives a lavender background. Specks that float away from the main figure are dropped, sheets are cut into cells at
  the empty gaps between figures (touching figures are cut at the thinnest column), and a figure is placed bottom-centre in a box.
- **`export_sprites.py`** sizes each picture to the logical size of the sprite it replaces (6x for sprites, 8x for tokens), so
  the game sizes it exactly as before. The Overlord's cells are 1.7x wider than her painted sprite so her raised arms and her tools
  never set her scale; she, and each centrepiece sheet, share one scale across all their frames. Fully transparent pixels are
  given the outline's violet so a filtered texture has no magenta halo. `PET_GEOM` says where accessories sit on a pet whose head and neck are not where the painted pet's were, `PET_MAP` can point a mood at another cell, and the bat's cells are wider (`PET_WIDE`) so raised wings fit.
  The Overlord's hair drifted brown in two of the duster frames; `recolour_hair` pulls it back to black-violet.
- **`export_tiles.py`** trims each swatch, stretches its levels so the median is mid-grey (the palette's base colour), and
  cross-fades the edges so it repeats without a hard seam (not the strictly regular check, marble and carpet, which would only blur).
  The swatches stay greyscale: `js/view/assets.js` colours them per lair with a gradient map from the palette.
- **`optimize.py`** quantises the PNGs to 256 colours where that makes them smaller (3.8 MB to 1.0 MB). Run it last: re-exporting
  afterwards undoes it.

## What the model declined or got wrong

The gingerbread golem was declined once under the content policy (gingerbread *golem*, reworded as a gingerbread *cookie
character* it was fine). **Sheets of several frames in one picture were the weak spot.** Asked for a pet in four expressions side
by side, the model smeared and ghosted the neighbouring cells into each other: a cat missing a foot and its tail, a bat with a chopped wing, a
bunny with a floating ear, a toad with a clipped side. Re-rolling did not fix it reliably, and cutting the sheet in different places did not help
because the damage was in the picture. The fix was to generate every pet frame as its own picture: first a clean idle frame
from the painted pet, then each other frame from that idle frame with "change only the expression". Frames stay consistent, nothing can bleed, and
`export_sprites.py` reads `pet-<id>-<frame>.png`. (The Overlord, minions, visitors and centrepieces were not affected: their sheets
came back clean.) The spider seamstress came back with glasses and the loom as a bookshelf with a ghost; both are charming and stayed.

## What is still painted in code

Curl Up & Dye draws its client chair in Canvas 2D and paints hair over the client's own sprite pixel by pixel, which needs
each client's head, eyes and mouth at known pixel positions, so that sprite (and the dirt, bubbles and stickers) stays painted; the
gallery of clients and the wish icons use the new art. The wall banners, the window sky and backdrop, the 3D décor pieces, the heart
and note particles and the grave's carved icon are unchanged.

## Rebuilding

```bash
python3 -I game-110/dev/assets/export_sprites.py RAW   # RAW holds overlord-cook.png, minion-imp.png, station-sew.png, pet-cat.png, token-skull.png, accessories.png ...
python3 -I game-110/dev/assets/export_tiles.py RAW     # RAW/textures.png
python3 -I game-110/dev/assets/optimize.py             # last
```
