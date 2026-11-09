# Crystal Crescendo: the art pipeline

The pictures in `../../assets/` were made with [fal](https://fal.ai), then cut and sliced by the scripts here. The scripts need
only Python 3 with Pillow and numpy; run them with `python3 -I`. They take a folder of raw renders and write `assets/`.

## Models

| Use | Endpoint | Notes |
|---|---|---|
| monsters, portraits, tile sheets, props | `fal-ai/nano-banana-2` | text to image, `output_format: png`, `resolution: 1K` (2K for tile sheets) |
| walk sheets, pose sheets | `fal-ai/nano-banana-2/edit` | `image_urls: [the person's portrait]`, `resolution: 2K` |

(`google/nano-banana-2.1` made the first pilot crab; it is listed without a per-image price, so the rest used `nano-banana-2` at $0.08 an image.)

## Prompt templates

Everything is asked for on a **flat solid magenta (#ff00ff) background**, which `cutout.py` keys out, and "no text, no border, no shadow".

- **Monster** (1:1, or 4:3 for the dragon and the Colossus): `HD-2D pixel art game monster sprite: <name>, <description>. Full body, centered, facing left. Crisp pixels, dark violet outline, cool-to-warm shading. Plain flat solid magenta (#ff00ff) background, no shadow, no text, no border.`
- **Portrait** (4:5): `HD-2D pixel art dialogue portrait, head and shoulders, facing forward, in the style of Octopath Traveler. <name>, <skin, hair, eyes, crown, dress colours, expression>. ... Plain flat solid magenta background filling the whole image edge to edge, no frame, no text, no border.`
- **Walk sheet** (1:1, edit, portrait as reference): `make a game character sprite sheet of this exact same character (same face, hair and clothes colours) as a small full-body chibi HD-2D pixel art sprite, 3 columns by 3 rows on a plain flat solid magenta background, ... Row 1: facing the camera (front view): standing, left foot stepping forward, right foot stepping forward. Row 2: facing away (back view) ... Row 3: facing right (side view) ...`
- **Pose sheet** (3:2, edit): `... side view facing right, 3 columns by 2 rows ... Row 1: idle (<holding the instrument>), playing, hurt. Row 2: knocked out (lying flat on the ground), cheering (both arms raised), empty cell left blank. ... no music notes, no hearts, no sparkles, no effects.`
- **Tile sheet** (1:1, 2K): `A 3 by 3 grid of nine seamless tileable square texture swatches for a top-down 3D RPG block world, HD-2D pixel art style, flat even lighting, no shadows, no perspective, each swatch fills its cell edge to edge, no borders, no gaps, no text. Theme: <place>. Row 1: <ground>; <ground2>; <flagstone path>. Row 2: <dock planks>; <wall blocks>; <cliff strata>. Row 3: <house wall with one small window>; <roof tiles>; <wall-top cap>.`
- **Prop** (3:4, or 3:2 for flowers and grass): `HD-2D pixel art game prop sprite: <thing>, standing upright, full ... centered. ... magenta background ...`

## What the scripts cope with

The model draws what it likes, so the exporters are forgiving: `export_people.py` finds the figures by the empty gaps between them
(not by fixed thirds), removes the dark grid lines some sheets come with, drops a pasted-in copy of the reference portrait and
stray notes and sparkles, scales a whole sheet by one factor so a character keeps its size from view to view, and has a small
override table (`POSE_OVERRIDES`) for a sheet whose layout has to be read by eye. Three pose sheets (Ingrid, `choir2`, `choir3`)
were declined by the model's content filter. Ingrid's and `choir3`'s were regenerated with gentler wording (startled instead of
in pain, fast asleep instead of knocked out). `choir2`'s was declined again and is not in `assets/poses/`; the game derives her
poses from the walk sprites.

## Rebuilding

```bash
python3 -I game-113/dev/assets/export_monsters.py RAW      # RAW holds monster-<id>.png, portrait-<id>.png, walk-<id>.png, ...
python3 -I game-113/dev/assets/export_portraits.py RAW
python3 -I game-113/dev/assets/export_people.py RAW
python3 -I game-113/dev/assets/export_tiles_props.py RAW
python3 -I game-113/dev/assets/optimize.py                 # last: it quantises the PNGs, so re-exporting afterwards undoes it
```
