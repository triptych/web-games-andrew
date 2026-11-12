# HOLLOWDEEP — the art pipeline (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) on 2026-11-12 (`fal-ai/nano-banana-2`, 23
requests plus a 6-image pilot, about $2.30) and cut, sized and exported by the scripts here. They need Python 3 with
Pillow and numpy; run them with `python3 -I`. The cut-out code is game-126's (EMBERSPIRE).

| Script | What it does |
|---|---|
| `prompts.mjs` | Every request, built from the game's data: each monster's `art` field (`js/sim/data/monsters.js`), each stratum's `art` and `floor`, each portrait (`classes.js`), each townsperson and place (`town.js`), the icon lists. |
| `grab.py RESULT.json` | Downloads the images listed in a saved `wait_for_jobs` result, naming them from a `jobs.txt` of `name request_id` lines. |
| `export.py RAW` | Raw renders → `art/`: cuts sprites out of their key colour, splits sheets into cells, removes grid lines and halos, trims, scales, makes textures tileable, writes WebP. About 3 minutes. |

## What was generated

Grid sheets keep the request count down: a 2K sheet of 2×2 or 3×2 cells comes back with each cell about as large as
a 1K single image.

| Raw file | Becomes | Notes |
|---|---|---|
| `sheet-<stratum>.png` ×8 | `mon/<id>.webp` ×48 | 3×2, 2K, six monsters of a stratum, full body facing the viewer (they face the party in the corridor). Magenta key; green for the Foundry and the Sanctum. |
| `bosses-1.png`, `bosses-2.png` | `mon/<guardian>.webp` ×8 | 2×2, 2K, green key. |
| `reaper.png` | `mon/reaper.webp` | The roaming Lantern Reaper. |
| `tex-1..4.png` | `tex/<stratum>-wall.webp`, `-floor.webp` | 2×2, 2K: wall and floor of two strata each. Made tileable on export (blended with a half-shifted copy). The ceiling reuses the wall, darkened. |
| `portraits-1.png`, `portraits-2.png` | `por/<class>_<a|b>.webp` ×12 | 3×2: two adventurers per class. |
| `portraits-npc.png` | `por/<npc>.webp` ×6 | 3×2. Came back with each role written above the portrait: the top 15% of each cell is cut off. |
| `bgs-1.png`, `bgs-2.png` | `bg/<place>.webp` ×8 | 2×2, 16:9. `bgs-1` came back with a cell number in each corner: a 5% margin is cropped. |
| `bg-title.png` | `bg/title.webp` | The key art. |
| `icons-gear.png`, `icons-misc.png` | `icons/gear.webp`, `icons/misc.webp` | 4×4 atlases of 64 px; the cell order is the `icon` index in `js/sim/data/items.js`. |

Every request shared one system prompt:

> You are the art director of HOLLOWDEEP, a dark-fantasy first-person dungeon-crawler RPG of the PlayStation 2 era
> (2003). Every image is painted, semi-realistic CG-style fantasy illustration like the monster art and character
> portraits of early-2000s Japanese dungeon RPGs: rich painterly detail, dramatic rim lighting, deep shadows, muted
> earthy palettes with glowing accents, a slightly soft finish. Never include any text, letters, numbers, logos,
> watermarks, signatures, borders, frames, grid lines or user-interface elements.

## What went wrong, and what the export does about it

- **Grid lines.** The Frozen Ossuary sheet and the second guardian sheet came back with thin black lines between the
  cells. `scrub_lines` paints over near-black runs near each cell boundary, and a long thin fragment left after the
  cut-out is dropped.
- **Halos.** Glowing creatures (the crypt bat, the wisp, the ice wraith, the glow moth) blend their glow into the
  magenta key and come back with a lavender rim; `dehalo` drops magenta-tinted pixels near their edges. Purple
  monsters are not in that list, so they keep their colour.
- **Text.** The townsfolk sheet captioned each portrait and one backdrop sheet numbered its cells (both cropped). The
  prompt says "no text" and the model wrote it anyway.
- **Order.** Every sheet came back in the order asked, checked on a contact sheet.

## Rebuilding

Keep the raw renders out of the repo (≈140 MB). With them in a folder:

```bash
python3 -I game-129/dev/art/export.py RAW
```
