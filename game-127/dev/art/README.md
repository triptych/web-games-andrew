# The First Dragon Prince — art

Every image was generated with **fal** (`fal-ai/nano-banana-2`, and `/edit` with reference images to keep the cast
consistent) and exported with [export.py](export.py). Nothing is drawn by hand.

| Folder | Count | Size | What |
|---|---|---|---|
| `art/bg/` | 28 | 1280×720 WebP | Backdrops: Emberhold Manor, the throne room, market, yard, Spire, temple, harbor, the Peaks, the Rookery, the expedition regions… |
| `art/cg/` | 68 | 1280×720 WebP | Cutscene illustrations: the prologue, every story beat, 12 heart scenes (two per friend), six Starfall Nights, five festival wins, 18 endings, six epilogues and six weddings |
| `art/act/` | 28 | 960×540 WebP | Period vignettes: one per lesson, job and rest |
| `art/por/` | 41 | 960 px tall WebP with alpha | Portraits: the prince at 10, 13 and 16 in four expressions; each friend as a child and grown (plus a happy grown face); 11 adults |
| `art/foe/` | 36 | longest side 720 px, WebP with alpha | Expedition creatures: each region's five dangers (`<region>-0` … `-4`) and its master (`<region>-boss`) |
| `art/title.webp` | 1 | 1600×900 | The title painting |

## How they were made

1. **Character sheets first.** One sheet per character (the prince at three ages, each friend, three NPC groups),
   full body, on a plain magenta background, all in one shared style prompt. Each later image that shows a
   character passes that sheet as a reference to
   `/edit`, which keeps faces, horns, colours and clothes the same across 68 CGs.
2. **Backdrops and vignettes** are prompted from the data: each activity's `art` field in
   [activities.js](../../js/sim/data/activities.js) is its vignette prompt.
3. **CGs** are prompted from the scene they illustrate. Two prompts were declined by the content filter and
   reworded: the hatching (now a glowing egg and a kneeling knight) and the first flame (now the smoky aftermath).

## export.py

```bash
python3 -I game-127/dev/art/export.py RAW_DIR [names...]
```

Sheets are keyed out (a soft chroma key on the border colour, a second key from the floor corners, pockets of
magenta inside loops of tail or arm, and white divider columns), split into figures at the emptiest columns,
trimmed and scaled to 960 px. Backdrops, CGs and vignettes are cover-cropped to 16:9 and written as WebP.
Expedition creatures (`foe-*.png`, one subject each, 1K square) are keyed the same way, then get two more passes
(`finish_foe`): a pixel whose hue is near the key is **unmixed** (the model paints steam, mist and sparks as subject
blended with the magenta behind it; the key's share becomes transparency and the colour goes neutral, so the cook's
steam is translucent instead of lilac), and the alpha fades out within 40 px of the frame, so the avalanche the
model ran off the image ends softly. Then they are trimmed to the figure and scaled to 720 px on the longest side.

Round portraits (the friends list, places, Starfall) zoom in on the face. Portraits are trimmed to the figure, so
their widths differ, and [faces.py](faces.py) finds each head and writes `js/faces.js`; after adding or redoing a
portrait, run `python3 -I game-127/dev/art/faces.py SHEET.png` and look at the sheet of circles it draws, adding an
entry to its `OVERRIDES` where wings, a staff, a hat or tall hair pull the crop off the face.

The sim test checks every id the scripts name has a file here, that every expedition danger has a creature, and that
every portrait has a face position.
