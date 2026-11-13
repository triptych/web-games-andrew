# Lanternhall — art

Every picture was generated with **fal** (`fal-ai/nano-banana-2`) and exported with [export.py](export.py).
Nothing is drawn by hand. Prompts are written from the game's data: each character's `art` line in
[cast.js](../../js/sim/data/cast.js), each place's in `PLACES`, each ending's in
[endings.js](../../js/sim/data/endings.js) (and `CGS` there for the four story pictures).

| Folder | Count | Size | What |
|---|---|---|---|
| `art/bg/` | 12 | 1280×720 WebP | Backdrops: the hall, your desk, the Tankard, the yard, the Map Room, the infirmary, the rooftops, the palace gardens, the Thornwood, the Lark, the Hollowdeep, Brightmoor |
| `art/por/<id>-<expr>.webp` | 56 | 900 px tall, alpha | 14 characters × neutral, happy, sad, angry |
| `art/por/adv-<id>.webp` | 6 | 420 px, alpha | The six adventurers without a story role |
| `art/giv/<kind>-<n>.webp` | 24 | 420 px, alpha | Petitioners: six each of townsfolk, road folk, court and wild folk |
| `art/cg/` | 20 | 1280×720 WebP | The lantern, the dragon, the descent, the relit lantern, and the sixteen endings (`end-<id>`) |
| `art/title.webp` | 1 | 1600×900 | The title painting |

## How they were made

One shared style on every request: *"Cosy fantasy visual novel art. Hand-painted storybook anime illustration,
clean linework, soft cel shading, warm lamplight palette of amber, gold, teal and plum. No text, no letters, no
signs with writing, no captions, no UI, no borders, no watermark."*

1. **A pilot of four** (one character sheet, one backdrop, one story picture, one petitioner sheet), looked at
   before the rest.
2. **Character sheets**, 1:1 at 2K: *"Character expression sheet: the same character four times in a 2x2 grid,
   waist-up, facing the viewer in slight three-quarter view, identical outfit and framing in every cell, clear
   empty space between the figures. Top-left neutral; top-right happy; bottom-left sad; bottom-right angry.
   Character: {art}. Background: flat solid magenta #ff00ff everywhere…"* (pure green for characters with purple
   or plum in them: Sera, Nyx, Orla, Tamsin, Malvane, Vesperax). One image gives four consistent expressions.
3. **Bust sheets**, 3:2 at 2K: six different people in a 3×2 grid. A petitioner's name picks their face by its
   place in the list in [quests.js](../../js/sim/data/quests.js), so keep those lists in sheet order.
4. **Backdrops**, 16:9 at 1K: *"Background painting, no people, no writing: {art}"*.
5. **Story and ending pictures**, 16:9 at 1K, with the character sheets passed as `context` images (*"keep her
   design from the reference"*) so Kael, Vesperax, Pell and the rest look like themselves. The clerk is only
   ever shown from behind, or as a pair of hands, because the player chooses who they are.

## export.py

```bash
python3 -I game-133/dev/art/export.py RAW_DIR [names...]
```

Each sheet is cut into cells and **each cell is keyed on its own border colour**: the model painted magenta,
green, a dusty pink, and once plain white behind the figures, and sometimes white lines between cells. Pixels near
the key that connect to the cell's edge go transparent, small enclosed pockets of key colour too (the gaps in a
lantern chain), the cut is shrunk a pixel and feathered, and key-coloured spill on the rim is pulled to grey.
Figures are trimmed and scaled. Backdrops and pictures are cover-cropped to 16:9. Raw files are named
`sheet-<id>.png`, `roster.png`, `givers-<kind>.png`, `bg-<id>.png`, `cg-<id>.png`, `title.png`;
[grab.py](grab.py) downloads them from a saved `wait_for_jobs` result.

Known flaws: the dragon's whiskers were drawn as outlines filled with the key colour, so they are hollow loops;
the hall backdrop has a sign with lettering on it despite "no writing".
