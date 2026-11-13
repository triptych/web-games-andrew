# HOLLOWDEEP — the art pipeline (fal, Meshy)

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

## Models (Meshy)

The dungeon's props are textured low-poly models made with [Meshy](https://www.meshy.ai) on 2026-11-12 (CLI
`meshy-cli@0.4.0`, text-to-3d: a preview with `should_remesh`, `topology: triangle` and a `target_polycount`, then a
refine with `--enable-pbr false --texture-resolution 2k` and a short texture prompt). Seven models, 30 credits each:
210 credits. The prompts are in `meshy-prompts.json` (`[target triangles, prompt]`).

| Model | Triangles | Used for | Task (refine) |
|---|---|---|---|
| `chest_closed` | 2.6k | every unopened chest | `01a1d170-7e9b-7366-b516-b6cf3b507e99` |
| `chest_open` | 2.9k | swapped in, with a hop, when a chest is opened | `01a1d170-8b4d-7670-bba1-a30b8690ab85` |
| `sconce` | 1.6k | wall torches (the flickering flame is still an additive sprite on top) | `01a1d170-9874-7352-ab23-5e1c64212b46` |
| `fountain` | 4.1k | healing fountains | `01a1d170-a3a5-7157-b56b-859a7f8bad0e` |
| `stairs_up` | 2.0k | the stairs up, and sunk in a hole in the floor as the stairs down | `01a1d170-bbb9-75f8-b2bc-70d7870d6b10` |
| `delver` | 6.0k | the lost delver of a rescue quest, slumped against the dead end's wall | `01a1d170-d4a0-7726-a33d-24387884e6b9` |
| (`stairs_down`) | 2.5k | not used: it came back as a walled stairwell whose walls hide its steps when it is sunk in the floor | `01a1d170-af6f-727b-b4e9-d0b0d81d0a25` |

The downloads were 2.6–3.9 MB each (2K JPEG textures). Each was shrunk with
[glTF Transform](https://gltf-transform.dev) to 100–370 KB (1.1 MB for all six):

```bash
npx @gltf-transform/cli resize IN.glb a.glb --width 512 --height 512   # 1024 for the delver
npx @gltf-transform/cli webp a.glb b.glb --quality 82
npx @gltf-transform/cli quantize b.glb c.glb
npx @gltf-transform/cli prune c.glb game-129/art/models/NAME.glb
```

`EXT_texture_webp` and `KHR_mesh_quantization` are read by three's GLTFLoader without a decoder. The game swaps each
model's material for a plain Lambert with the painted map (like the walls), and `js/view/models.js` fits every model
to the grid from its bounding box (`MODELS`: which axis gets which size, which way is the front). Check a change with
`node game-129/dev/models.mjs`, which screenshots `dev/modelview.html` (each model from the front, the side, above
and the edge of its cell, on a 2 × 2 cell grid). If a model can't load, the old box version is built in its place.
