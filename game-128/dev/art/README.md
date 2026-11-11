# Gemheart Saga — the art pipeline (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) (`fal-ai/nano-banana-2`) on 2026-11-11 and cut,
sized and exported by the scripts here: 46 images (44, plus 2 re-renders), about 5.5 MB once exported. They need
Python 3 with Pillow and numpy; run them with `python3 -I`.

| Script | What it does |
|---|---|
| `prompts.mjs` | Writes every request from the game's own data (`js/sim/data/*.js`: each hero, foe, NPC, building and item carries an `art` description). `node prompts.mjs names` lists them, `node prompts.mjs one NAME` prints one request. |
| `export.py RAW` | Raw renders → `art/`: cuts sprites out of their key colour, splits sheets into cells, mirrors the sprites that face the wrong way, trims, box-filters down to the art's own pixel grid, writes WebP. The cut-out code is game-126's. |

## The style

Every request shared one system prompt:

> You are the art director of GEMHEART SAGA, a fantasy role-playing game in the tradition of the great 32-bit era:
> late-1990s Sega Saturn and Sony PlayStation 2D RPGs. Every image is premium 32-bit era pixel art: crisp visible square
> pixels on a fine grid, rich large palettes with smooth hue-shifted shading and soft highlights, clean dark outlines,
> subtle dithering, lush hand-placed detail and warm storybook lighting. Never include any text, letters, numbers,
> logos, watermarks, signatures, borders, frames or user-interface elements.

"32-bit" is read as the 32-bit console era: bigger sprites and richer palettes than 16-bit, still drawn and shown as
pixels. Since v1.1.0 the battle art is exported at more than it is drawn (foes 300 px, elites 360, bosses 440, heroes
320 tall; board gems 128 px cells; battle backdrops 1024x576) and the view scales it *down* with smoothing: v1.0.0
exported small sprites and blew them up with nearest-neighbour scaling, which looked zoomed and blocky at battle size.

## What was generated

| Raw file | Becomes | Notes |
|---|---|---|
| `bg-title`, `bg-village` (16:9, 2K) | `bg/title.webp`, `bg/village.webp` (1280x720) | Title: the Gemheart over Briarwick, Gloamspire on the horizon. |
| `bg-<region>` ×5 (16:9, 1K) | `bg/<region>.webp` (1024x576) | Battle backdrops with open ground in the lower half; the `art` of each region. |
| `sheet-<region>` ×5 (3x2, 2K) | `mon/<id>.webp` ×30 | Five monsters and the region's elite ("drawn noticeably larger"). Gloamspire on green, the rest on magenta. |
| `boss-<id>` ×9 (1K) | `mon/<id>.webp` | Four region bosses, the Gloam Sovereign and the four nemeses. |
| `spr-<hero>` ×4, `por-<hero>` ×4 | `hero/<id>.webp`, `por/<id>.webp` (256 px) | Battle sprites face right; portraits on a blurred lantern-lit background. |
| `npc-<id>` ×6 | `por/<id>.webp` | The six villagers. |
| `sheet-buildings` (3x3, 2K) | `buildings.webp` (3x3 atlas of 168 px) | Isometric, one per cell, in `icon` order (`data/village.js`). |
| `icons-gems/gear/goods/misc` (4x4, 2K) | `icons/*.webp` (4x4 atlases of 64 px; `gems` and `misc` 128 px) | The board pieces are in `gems` (sword, heart, ruby, sapphire, amethyst, prism, stone, doom, chains…); the emerald is cell 5 of `misc` (see below). |
| `skills-<hero>` ×4 (3x3, 2K) | `skills/<hero>.webp` (3x3 atlas of 96 px) | Painted square tiles, no cut-out; one per skill-tree node in tree order. The prompts are `SKILL_ART` in `prompts.mjs`. |

## What went wrong, and what the export does about it

- **Key colours vs gem colours.** A magenta key eats violet and pink; a green key eats emerald. So the gem sheet went on
  green with the emerald moved to the magenta `misc` sheet, the gear sheet on magenta (the violet mantle was redescribed
  as midnight blue), and the charms split between the two sheets by colour. The marsh leech was redescribed from
  "black and purple" to "black and olive-brown" before its sheet was generated.
- **The Sovereign came back on near-white**, not the green asked for. The cut-out's generic branch (distance from the
  border colour) handles it.
- **Text in the art.** The first Odo and Sela skill sheets came back with each skill's name written on the tile (big
  captions on Odo's). Both were re-rendered with "Absolutely no words, names, labels or captions anywhere in the image";
  the re-renders are clean. Don't quote skill names in a prompt: the model writes them.
- **Facing.** Heroes stand on the left and face right; foes stand on the right and face left. The model got it wrong for
  the wolf, hound, kobold, leech, hornet, lizardfolk, troll and toad; they are mirrored on export (`FLIP`). Sela was
  mirrored by mistake in the first export (her body leans one way, her face the other); judge facing at full size.
- **Floating details** (the Mage Tower's runes) are dropped by the stray-fragment filter. That reads fine.

## Rebuilding

Keep the raw renders out of the repo (about 110 MB). With them in a folder named as in `prompts.mjs`:

```bash
python3 -I game-128/dev/art/export.py RAW
```
