# WanderQuest — the pictures (fal)

`../../art/` (170 pictures, about 7.5 MB) and `../../icons/` were made on 2026-11-16 with [fal](https://fal.ai)
(`fal-ai/nano-banana-2`, PNG; the map with `fal-ai/nano-banana-2/edit`) and cut out by `export.py`. 48 requests in all,
about $4–5 (sheets at 2K cost a little more than single 1K images).

```bash
node game-085/dev/art/prompts.mjs [group|name ...]          # the jobs: { name, prompt, aspect_ratio, resolution, key, cells, items }
python3 -I game-085/dev/art/map-ref.py mapdata.json map-ref.png   # the colour layout the map is an edit of (see the file)
python3 -I game-085/dev/art/export.py RAW [name ...]       # RAW holds <job name>.png; writes art/, icons/, js/art-files.js
```

The raw renders (about 220 MB) are not kept in the repo. Every prompt is built from the game's own tables
(`FAMILIES`, `REGIONS[].warden`, `CLASSES`, `TOWNS[].blurb`), so the pictures are the game's monsters and places and can be
regenerated. One shared system prompt: *a warm hand-painted storybook illustration in gouache and watercolour: soft painterly
brushwork, gentle rounded shapes, a thin dark-brown ink outline round every subject, warm light from the upper left, charming
rather than frightening; never any text, letters, labels, frames or grid lines.*

| Job | Becomes | Notes |
|---|---|---|
| `s-mon1`…`s-mon5` (3×2, 2×2) | `m-<family>` ×27 | "three-quarter view turned toward the viewer and slightly to the LEFT": they face the caravan from the verge |
| `w-<warden>` ×6 (single, 1K) | `w-<warden>` | singles, for more detail on the bosses |
| `s-people1`, `s-people2` | `t-<class>` ×9, `t-odessa` | turned slightly to the RIGHT |
| `s-carts1`, `s-carts2` | `c-<class>` ×9 | a symmetrical REAR view: the road's camera follows the train |
| `s-things` (3×2, one empty) | `x-ox`, `x-campfire`, `x-gate`, `x-waystone`, `x-waystone-lit` | the ox from behind; the gate's sign blank |
| `p-*` (3×2, 2×2, 3×3) and `w-desert`, `w-lines` (two bands) | `p-<kind>` ×58 | roadside things by region; mesa, dune and the two tree lines as long bands |
| `h-<region>` (2×2) | `h-<region>0`…`3` | houses in strict front elevation |
| `bg-<region>` (21:9) | `bg-<region>` | distant land only, sky flat key colour |
| `s-towns1`…`s-towns5` (2×2, 3×1) | `town-<id>` ×19 | painted edge to edge, no key; cropped square from the bottom middle |
| `title` (16:9), `icon`, `map` | `title.webp`, `icons/*.png`, `map.webp` | the map is an edit of `map-ref.png` so each region lands on its towns |

Key colours: magenta, or green behind anything purple or pink (Starhaven, the Fen Spider asked for as charcoal so the
Mirewood sheet could stay magenta, the alchemist, the bard and Grandmother's purple shawl, the Apothecary and Stage Wagons).

## What went wrong, and what the export does about it

- **The carts came back side-on twice** ("seen from behind and slightly to the right" gave a three-quarter side view). A
  third prompt, "a symmetrical REAR view … its two rear wheels seen edge-on as narrow upright ovals; the front wheels hidden;
  none of the long sides visible", worked first time. The camera is only 260 units right of the train, so a true rear view
  is what it sees; the side-on carts looked as if they were driving across the road.
- **Sheets don't keep their grid.** The meadow ground sheet came back with eight objects in three rows for a 3×2 grid
  (`PICK` keeps the first log and stump), one sheet's magenta came back dusky pink with an uneven wash, and two sheets drew
  white gutters or grid lines. Objects are found by the empty gaps between them (rows, then columns in each row, at quarter
  resolution); when the count doesn't match, the even grid it was asked for is used. White lines and their anti-aliased
  edges are background.
- **Two town sheets wrote each town's name across the top** despite "no text" in the system prompt; `CAPTIONED` crops it off.
- **Key colour:** sampled from a 24-px band of each crop's border (up to three colours, so a white gutter and the key both
  count), flood-filled from the edges at half resolution (pockets of key inside a subject stay), and the rim un-mixed from
  the key (a pixel is subject × a + key × (1 − a)): a 4-px rim normally, 26 px for things that glow, which turns lime or pink
  halos into soft translucent glow.
- **Panoramas:** the land runs off the sides and bottom, so a key sampled from the whole border took the land's own colours
  for background and ate the hills. The key comes from the sky along the top only, the fill starts only from the top edge (the
  frost range's mauve shadows are close to that render's mauve sky), and a painted frame two of them sat inside is trimmed. In
  the game they tile mirrored, so no seam needs to match.

## In the game

[js/view/art.js](../../js/view/art.js) loads every picture in the background and draws each one standing on a point at a
given height. The height is the code sprite's own (measured from the code drawings, see `ART` in
[scenery.js](../../js/view/scenery.js) and `creatureHeight`), so nothing changed size. The first time a picture is drawn small it
gets a chain of halved copies, so a 512-px tree drawn 30 px tall is neither slow nor shimmery; night, the hit flash (a white
overlay) and the scrapbook's not-yet-met silhouettes are tinted copies. Each draw function falls back to its v1.3.0 code
when its picture hasn't arrived; `?art=0` forces that. The scrapbook redraws its portraits once the pictures are in.
