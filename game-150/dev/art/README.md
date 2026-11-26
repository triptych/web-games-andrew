# Folio & Fable — the art (ElevenLabs)

Every picture in `../../art/` was generated on 2026-11-26 with **ElevenLabs** (flow "Folio & Fable game art"), model
`gemini-nano-banana-2.1` (Nano Banana 2.1), one take each, and exported by `export.py` (Pillow, numpy):

```bash
python3 -I game-150/dev/art/export.py RAW     # RAW holds the PNGs named below, as downloaded
```

Sprite sheets were painted on plain light grey and cut out by ElevenLabs' **BiRefNet v2** background-removal node
(`birefnet-v2-bg-removal`, ~30 credits each), which keeps real alpha. `export.py` then finds each figure as a connected
blob of alpha (the model's grids are never even) and names them in reading order. BiRefNet dropped the shop counter
from the furniture sheet (it kept what it took for the subject), so `export.py` keys that one out of the grey itself
(flood fill from the border). Spend: 15 paintings and 4 cut-outs, about 3,900 credits. The `art/` folder is 2.2 MB.

| Raw file | Becomes | Notes |
|---|---|---|
| `title.png` | `title.webp` 1920 | 16:9 2K. Tam in a rainy lane looking up at Old Vellum, open and pouring out light and paper birds, the bookshop glowing at the end of the lane; the upper middle kept clear. |
| `bg-shop.png` | `bg-shop.webp` 2400 | 21:9 2K. The empty shop "seen straight on like a doll's house cross-section": teal wainscot, plaster, three arched windows, beams, lanterns, a plank floor, *no furniture*. The view tiles it along the room and puts its floor line (86% down) on the wall base. |
| `furniture.png` → `cut-furniture.png` | `furn-{shelf,table,armchair,lamp,fern,cat,painting,ivy}.webp` | 3×3 sheet at 2K, every piece "perfectly straight on, flat orthographic front view, no floor, no shadows", the bookshelf with "four completely EMPTY shelves": the view draws each book's spine into it (`SHELF` in `js/view/shop.js` holds the measured row positions). |
| `furniture.png` (keyed here) | `furn-counter.webp` | The counter, cut out of the grey by `key_grey`. |
| `customers.png` → `cut-customers.png` | `folk-{adventurer,noble,actor,cook,shopkeeper,scholar,farmer,child}.webp` | 4×2 sheet of chibi townsfolk, full body, facing the viewer. |
| `cast.png` → `cut-cast.png` | `cast-tam.webp`, `cast-vellum.webp` | Tam (full body) and Old Vellum (floating) for the counter. |
| `por-{tam,vellum,ottoline,elowen}.png` | `por-*.webp` 384² | 1:1 1K story portraits. |
| `adventurers.png` | `hero-{rook,fen,juniper,maris}.webp` 384² | 2×2 portraits with their own backgrounds, sliced with a 1% inset. |
| `materials.png` → `cut-materials.png` | `mats.webp` 512² | 4×4 icons, packed into a 4×4 sheet of 128 px cells (CSS sprites at 40 px). Order: paper, leather, oak, dragon scale; midnight, ember, honey, rose ink; moonlight ink, gold leaf, silver clasp, pressed violet; star fragment, phoenix feather, silver thread, wax seal. |
| `places.png` | `place-{woods,market,archive,scriptorium,attic,observatory}.webp` 640 | 3×2 scene panels for the expeditions. |
| `town.png` | `town-{guild,school,bakery,theatre,tower,garden}.webp` 640 | 3×2 scene panels for the town's inspirations. |
| `bindery.png` | `bindery.webp` 1376 | The bindery's back-room workbench, "the centre soft because a crafting panel sits in front of it". |
| `ending.png` | `ending.webp` 1920 | The festival in the square: Tam holding up the bound Book of Larkspur, Old Vellum, Elowen's smiling spirit, the townsfolk. |

Every prompt opened with the same style paragraph:

> Cozy storybook illustration for a gentle fantasy bookshop game, in a warm painterly gouache style like a modern
> hand-painted animated film: honey-gold lamplight, deep teal and burgundy accents, soft shadows, drifting dust motes,
> inviting and whimsical. No text, letters, numbers, logos, watermarks, borders, frames or user-interface elements
> anywhere; any book spine, page or sign is plain, with no lettering.

Tam is described the same way everywhere: an orphan girl about twelve with a round freckled face, bright hazel eyes,
messy short chestnut hair under a too-big patched brown newsboy cap, a long mustard-yellow scarf and a patched brown
wool coat with mismatched buttons. Old Vellum: a thick oxblood-red leather tome with worn gold corners and a brass
clasp, two round brass-rimmed spectacle lenses for eyes, bushy tooled-leather eyebrows, a stitched smile, loose
gold-edged pages for wings and a green ribbon tail. Furniture and materials were told "ordinary objects, NOT
characters: no faces, no eyes".

**The books are not paintings.** Every book (its cover, spine, page edges, title page and 3D model) is drawn in code
from the procedural `look` (`js/sim/books.js` → `js/view/covers.js`, `js/view/book3d.js`), so there are endless
different books. One emblem had to change after a look: a cauldron with three bubbles over it read as a smiling face
on a cover, so it got curls of steam instead.

Keep the raw renders out of the repo (≈70 MB).
