# ARCANA WAGON: painted art

The pictures in this folder were made with [fal](https://fal.ai) (`fal-ai/nano-banana-2`, 2K, PNG) on 2026-11-09 and
exported to WebP. The 3D wagon, the cards and the symbols are still drawn in code; these images are only used by the
DOM layer. Every image shares one system prompt, which is what makes them read as one set:

> You are the art director of ARCANA WAGON, a cosy tarot-fortune-teller game. Every image is a lush hand-painted storybook
> illustration with the same look as its stylised 3D characters: jewel colours (plum, magenta, teal, gold), soft glowing
> candle light, gentle bloom, rich painterly texture. Never include any text, letters, logos, watermarks, frames or
> user-interface elements.

| File | Where it shows | Size |
|---|---|---|
| `title.webp` | The title screen's backdrop (a gradient over it keeps the logo and menu readable). 16:9, the sky left empty for the logo | 1920 wide |
| `end-oracle.webp`, `end-quiet.webp`, `end-narrow.webp`, `end-black.webp` | The top of the ending screen: The Crown's Oracle, A Quiet Victory, A Near Thing, The Black Feast. Each prompt is the ending's own text in `js/sim/data/story.js` boiled down to one scene | 1280 wide |
| `portrait-<name>.webp` (11) | The speaker's portrait on the dialogue box. Each is a 256 px crop of that character's full-body fal reference (the image the Meshy model was made from, see [dev/assets/README.md](../dev/assets/README.md)), so a face on the box and the model across the table are the same person | 256×256 |

The portraits are cropped, not generated: the figure's bounding box is found from the grey background, and a square a quarter of
its height wide is cut from the top (Wren, whose hat is wider than their head, needed a wider square by hand).

Villagers made from the day's seed have no portrait and the dialogue box looks as it did. The images are optional in the
code: `ui.js` shows an `<img>` only once it has loaded, and hides it if the file is missing.

Both art sets are about 0.7 MB in total. To regenerate one, keep the system prompt, reuse the subject description, and export
with `cwebp` or Pillow (`quality=80`, resize to the widths above).
