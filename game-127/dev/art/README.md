# The First Dragon Prince — art

Every image was generated with **fal** (`fal-ai/nano-banana-2`, and `/edit` with reference images to keep the cast
consistent) and exported with [export.py](export.py). Nothing is drawn by hand.

| Folder | Count | Size | What |
|---|---|---|---|
| `art/bg/` | 28 | 1280×720 WebP | Backdrops: Emberhold Manor, the throne room, market, yard, Spire, temple, harbor, the Peaks, the Rookery, the expedition regions… |
| `art/cg/` | 68 | 1280×720 WebP | Cutscene illustrations: the prologue, every story beat, 12 heart scenes (two per friend), six Starfall Nights, five festival wins, 18 endings, six epilogues and six weddings |
| `art/act/` | 28 | 960×540 WebP | Period vignettes: one per lesson, job and rest |
| `art/por/` | 41 | 960 px tall WebP with alpha | Portraits: the prince at 10, 13 and 16 in four expressions; each friend as a child and grown (plus a happy grown face); 11 adults |
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
The sim test checks every id the scripts name has a file here.
