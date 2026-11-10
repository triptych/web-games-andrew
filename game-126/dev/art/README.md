# EMBERSPIRE — the art pipeline (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) on 2026-11-10 and cut, sized and exported by the
scripts here. They need Python 3 with Pillow and numpy; run them with `python3 -I`.

| Script | What it does |
|---|---|
| `export.py RAW` | Raw renders → `art/`: cuts sprites out of their key colour, splits sheets into cells, mirrors the sprites that face the wrong way, trims, box-filters down to the art's own pixel grid, writes WebP. About 3 minutes. |
| `grab.py RESULT.json` | Downloads the images listed in a saved `wait_for_jobs` result, naming them from a `jobs.txt` of `name request_id` lines. |

## What was generated

All with `fal-ai/nano-banana-2` (about $0.08 an image; 84 images, plus 9 edits), except the nine evolved-class sprites, which are
`fal-ai/nano-banana-2/edit` of each hero's base sprite so the face and pose stay the same person.

| Raw file | Becomes | Notes |
|---|---|---|
| `sheet-<stratum>.png` ×10 | `mon/<id>.webp` ×60 | One 3x2 sheet per stratum, 2K: five monsters and the stratum's mini boss "drawn larger". Prompts are the `art` field of each monster in `js/sim/data/biomes.js`. |
| `boss-<id>.png` ×10 | `mon/<id>.webp` | One per boss, 1K, "imposing". |
| `spr-<hero>.png`, `evo-<hero>.png` ×9 each | `hero/<id>.webp`, `hero/<id>-evo.webp` | Facing left, full body. `evolved` field of each hero in `js/sim/data/heroes.js`. |
| `por-<hero>.png` ×9, `npc-<id>.png` ×6 | `por/<id>.webp` (256 px) | Head-and-shoulders dialogue portraits on a blurred tavern, forge, hall or temple glow. |
| `bg-<stratum>.png` ×10 | `bg/<stratum>.webp` (640x360) | Battle backdrops with an empty floor in the lower half. `art` field of each stratum. |
| `bg-title/town/tavern/tavern-night/smithy/shop/guild/temple.png` | `bg/*.webp` (960x540; title 1280x720) | |
| `icons-gear/goods/uniques/misc.png` | `icons/*.webp` (4x4 atlases of 48 px) | 4x4 grids, 2K. Cell order is the `icon` index in `js/sim/data/items.js`. |

Every request shared one system prompt:

> You are the art director of EMBERSPIRE, a 16-bit fantasy JRPG in the tradition of the great SNES-era role-playing
> games. Every image is premium 16-bit pixel art: crisp visible square pixels, rich limited palettes with hue-shifted
> shading, clean dark outlines, subtle dithering in shadows, warm torchlight against cool shadow. Never include any
> text, letters, numbers, logos, watermarks, signatures, borders, frames or user-interface elements.

Sprites ended with "Plain flat solid magenta (#ff00ff) background, no shadow, no ground, no text": green (#00ff00)
for purple subjects (the library, the forge, the astral and abyss sheets, Nyx), blue for Mother Bloom and Aurelion.

## What went wrong, and what the export does about it

- **Facing.** Heroes stand on the right and must face left; monsters stand on the left and must face right. The
  model ignored the direction for Arin, Grimble, Lyra, Pip and Thorne (both forms) and for Grubnak and Celestine.
  They were found by eye on a labelled contact sheet and are mirrored on export (`FLIP`). Check any new sprite the
  same way.
- **Spill.** Big mini bosses (the Pit Warden, the Hydra's tail) reach past their grid cell. Each cell is searched
  with a 22% margin into its neighbours and the figure whose centre lies in the cell is kept.
- **Captions.** The Sunken Garden sheet came back with each creature's name written under it; that strip is blanked
  before cutting (`CROP_BOTTOM`).
- **Key colour drift.** Cells come back in two shades of the key; it is measured from the border and matched by hue
  family, enclosed pockets of key colour (inside a necklace, between wings) are removed, and edge pixels are
  despilled a few pixels deep so glows don't keep a green fringe. A faint fringe remains on Celestine's wings.
- **Text in the art.** The model still painted a sign on the town's tavern ("The Frothy Mug") and "B" / "STR" on two
  potion icons. The tavern was renamed to match.
- **Size.** Normal monsters export at 124 px on their long side, mini bosses 172, bosses 228, heroes 92 tall
  (Pip 78%, Grimble 86%). The battle canvas is 640x360, scaled up with nearest-neighbour, so these read as true
  16-bit pixels. The whole art folder is 3.5 MB.

## Rebuilding

Keep the raw renders out of the repo (≈170 MB). With them in a folder:

```bash
python3 -I game-126/dev/art/export.py RAW
```
