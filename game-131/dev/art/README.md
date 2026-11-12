# Fray & the Spiral Isle — the art (fal)

Everything in `../../art/` was generated on 2026-11-12 with fal `fal-ai/nano-banana-2` (about 50 images, 1K or 2K) and
processed by `export.py` (needs Pillow): `python3 -I game-131/dev/art/export.py RAW`, where RAW holds the originals
named as below. 49 files, 2.2 MB.

| Originals | Become | Notes |
|---|---|---|
| `card-<id>.jpg` (16:9) | `art/card-<id>.webp` 1280×720 | One painting per story card in `js/sim/data/story.js` (`CARDS`). `card-intro1` is also the title screen. |
| `tex-<zone>-<wall or floor>.jpg`, `tex-grass.jpg` (1:1, 1K) | `art/tex-*.webp` 512 px | Tiling surfaces. Drawn with mirrored repeat, so a painting that does not quite tile shows no seam. |
| `icons1.png`, `icons2.png` (2K, magenta key) | `art/icon-*.webp` 128 px | Gems, the pendant, the eight small things and the four items. Cut by flood fill from the border, then by the empty bands between icons (the model does not keep to a grid). |
| `ref-fray.png` | `art/face-fray.webp` | Her portrait for subtitles; the same render is her Meshy reference. |
| `ref-<prop>.png` | (not shipped) | Reference renders for Meshy: see [../assets/README.md](../assets/README.md). |

## Prompts

Three system prompts keep each family coherent:

- **Paintings:** "You are the art director of a peaceful first-person storybook adventure game. Every image is a soft
  hand-painted gouache and watercolour illustration: gentle light, calm and quiet, slightly misty, a muted jewel palette
  of moss green, sea teal, warm gold and lavender, rounded friendly shapes, visible fine brush texture. Nothing
  frightening, no weapons, no people unless the prompt names them. Never any text, letters, numbers, logos, borders,
  frames or user interface."
- **Textures:** "You paint seamless tileable hand-painted game textures: flat, evenly lit, viewed straight on, uniform
  detail across the whole image, no vignette, no border, no text, no single large feature."
- **References:** "You make clean prop reference renders for a 3D modelling team. One subject only, centred, whole
  subject in frame, plain flat light-grey background, soft even lighting, no cast shadow, no text, no logos, no frame."

Each user prompt was written from the game's own data: the card's text, the zone's look, the thing's description.
Fray is always described the same way ("a small moss-green goblin girl with very large pointed ears, messy dark hair,
a strip of pale linen tied over her eyes, a patched russet hooded cloak covered in mismatched buttons").

## Things to know

- **The Cold Hearth card** (`card-hearth`) is not a painting: the image model's content filter declined that prompt,
  and it was not resubmitted. `export.py` composes the card from the hearth's prop render on a warm dark ground.
- Glowing icons on a magenta key keep a faint pink rim (the light gem, the shard, the star-seed). It reads as glow.
- `icons2.png` came back as two rows in the top third of the sheet and split the footprints into two icons, which is
  why the cutter finds icons by empty bands and warns when the count is not what it expects.
