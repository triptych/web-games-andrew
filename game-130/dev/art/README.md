# Starbase Spooky: the art pipeline (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) on 2026-11-12 with `fal-ai/nano-banana-2`
(24 images, about $0.08 each). The prompts are built from the game's own data tables by `prompts.mjs`:
- the `art` field of each room in `js/sim/data/rooms.js`
- the `art` field of each character in `js/sim/data/cast.js`

Every request shared one system prompt:

> You are the art director of Starbase Spooky, a 1990s 16-bit edutainment adventure game for young children, in
> the tradition of classic SNES and Amiga point-and-click games. Every image is premium 16-bit pixel art: crisp
> visible square pixels, bright cheerful saturated colours with soft hue-shifted shading, clean dark outlines,
> gentle dithering, and a cozy, silly, only-a-little-bit-spooky retro-future space station. Characters are cute,
> round and friendly, with big expressive eyes. Never include any text, letters, numbers, logos, watermarks,
> signatures, borders, frames or user-interface elements.

| Raw file | Becomes | Notes |
|---|---|---|
| `bg-<room>.png` ×8, `bg-station.png` | `bg/<room>.webp` (640×360) | 16:9 at 1K. Room prompts end with "The room is empty: no people, no characters…". The first command deck came with an alien in the captain's chair and a robot on the floor. |
| `bg-title.png` | `bg/title.webp` (1280×720) | 2K. A little ghost peeks out of a window. |
| `spr-<id>.png` ×12 | `spr/<id>.webp` | On flat magenta, or flat green for the pink, purple and blue-glow characters (Gloobella, Quasar, Wisp, Mama). Cut out by flood fill from the border, trimmed, and box-filtered to their height in game pixels (`h` in `cast.js`). |
| `icons-items.png` | `icons/items.webp` (4×4 of 40 px) | 2K. Cell order is the `icon` index in `story.js` (clues 0–5, items 6–8, decoration 9–15). |
| `icons-planets.png` | `icons/planets.webp` (3×3 of 56 px) | 2K. Sun, Mercury … Neptune. |

## What went wrong, and what the export does about it

- **Captions.** The item sheet came back with a name under every icon, so the bottom fifth of each cell is blanked
  before cutting (`CAPTION`).
- **Letters on the map.** The station map came back with a letter beside each module. Each one is painted over with
  the median colour of a ring around it (`SCRUB`), which is sky in six places and the Earth under "D".
- **Text on screens.** "Starbase Spooky" was painted on the first deck's map screen. The room prompts now ask for
  "simple shapes and glowing graphs, never any writing".
- **Hotspots.** The rooms' tappable spots were placed by eye on a 40 px grid drawn over each export. If you
  regenerate a backdrop, place them again in `rooms.js`; `simtest` only checks that they're on the canvas.

## Rebuilding

Keep the raw renders out of the repo. With them in a folder:

```bash
python3 -I game-130/dev/art/export.py RAW
```

The export needs Python 3 with Pillow and numpy. The cut-out helpers are copied from game-126's `export.py`.
