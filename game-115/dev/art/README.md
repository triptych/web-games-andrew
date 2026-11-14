# Hearthwick — the art pipeline (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) (`fal-ai/nano-banana-2`, 2K, PNG) on 2026-11-14 and cut,
sized and exported by `export.py` (Python 3 with Pillow, numpy and scipy; run with `python3 -I`):

```bash
python3 -I game-115/dev/art/export.py RAW      # RAW holds one PNG per sheet: b-hall.png, n-oak.png, c-mage.png ...
```

The raw sheets (about 120 MB) are not kept in the repo. [prompts.json](prompts.json) has every sheet's prompt, grid, aspect ratio
and the sprite names it is cut into, and the three shared system prompts:

- **B** (buildings and props): warm hand-painted storybook style, thin dark-brown outline, *strict front elevation* (the front wall
  parallel to the picture, seen slightly from above so the roof shows; not isometric, not a corner view), windows glowing with
  lamplight, on flat magenta, no ground, no shadow, no smoke, no text.
- **N** (nature): the same style, front and slightly above.
- **C** (people): the same style, chibi proportions, full body, standing three-quarter front, no magenta clothing.

## What was generated

42 sheets from 50 requests (a six-image pilot and four redone), roughly $4–6: 28 for buildings, 6 for nature, 8 for people.
The oak and the warrior sheets are the pilot's.

| Sheets | Becomes |
|---|---|
| one per building type, all its upgrade stages on one sheet (2×2, 3×1, 3×2 or 2×1) | `art/b/<type><level>.webp`, 95 stages; a building keeps its colours and its sign as it grows |
| decorations (3×2), extras (3×1: windmill sails, scaffold, merchant's wagon) | `art/b/flowerbed.webp` ... `sails`, `scaffold`, `cart` |
| one per tree kind, the same tree in spring, summer, autumn and winter (2×2) | `art/n/tree<kind>-<season>.webp` |
| rocks and stump (3×2), wild plants full and picked (4×2) | `art/n/rock0-3`, `stump`, `bush1`/`bush0` ... |
| one per hero class: the same man and woman in three gear tiers (3×2) | `art/c/<class>-<a|b><0-2>.webp` |
| two sheets of six villagers, one of the six special folk | `art/c/folk0-11`, `brenna`, `thorne`, `pip`, `tuck`, `orla`, `fenn` |

`art/manifest.json` lists each sprite's file, its size in tiles, its night-glow map (`-e.webp`), the chimney tops of buildings
that smoke, and the windmills' sail hubs.

## What went wrong, and what the export does about it

- **Redone (4):** the library came back isometric on a dark grid with captions, the fir trees as photographs on white cards, the
  item shop with drawn grid lines and numbers, and the middle quarry stages as whole rectangles of cliff. Second prompts named
  what to avoid ("no labels, captions, grid lines", "NOT a photograph", "a free-standing object with magenta all around").
- **Grids are not even.** Cells are cut at the emptiest line near where an even grid would put it. Two sheets are split by their
  real gaps instead: the guild's second row holds two wide halls, and the alchemist sheet came back with five subjects for three
  stages (its columns are given by hand in `SEGMENT`). The archer and rogue sheets came back 4×2 for 3×2; columns 0, 2 and 3 are
  used (`GRID`). Two townhouses in one cell and two huts in another keep only the biggest piece (`LARGEST_ONLY`).
- **Drawn grid lines and captions.** Dark straight lines that cross 85% of a sheet and have light on both sides are removed;
  inside a cell, thin long pieces, pieces wholly below the subject (captions) and specks are dropped; a narrow stripe at a sprite's
  edge joined to it only by a smudge is trimmed.
- **Key colour.** The magenta drifts between renders (one sheet is dusky pink), so the key is the median of each sheet's border.
  Glows and soft edges blended into the key are un-mixed near the edges; anything still magenta-tinted there (painted smoke the
  prompt asked not to have) is dropped. The archers' glowing bows keep a pink tinge.
- **Night glow** is found, not painted: warm bright blobs (lit windows, forge fire, lamps) with a dark frame around them. Thatch,
  wheat and plaster are warm and bright too but have no dark frame, so they stay dark at night.
- **Chimneys** are narrow peaks on the roof line of the types that smoke. A few land on a roof ridge instead; the puffs still read
  as smoke from the roof.
- **Sizes.** Each building's sprite is as wide as the code painter's (so footprints line up), its height follows the painting,
  capped for the windmill, the watchtower, the lantern and the statue. Trees are 2.25 tiles tall (at most 1.95 wide), people 1.2.
  Picked plants share their full twin's scale.

## In the game

[js/view/art.js](../../js/view/art.js) loads the manifest and every picture in the background. Each painter asks for its picture
first (`paintBuilding`, `tree`, `rock`, `plant`, `stump`, `paintScaffold`, `millSails`, `charStrip`) and draws the old code sprite
while it is missing. When the last picture lands, `ART.v` goes up and the town drops its texture cache and picks every sprite
again. Night glow goes into the sprite shader's emissive input, as the code painters' glow layers did.
