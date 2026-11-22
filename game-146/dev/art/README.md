# JINGLE POP — the art (ElevenLabs image generation)

Every picture in `../../art/` was generated on 2026-11-22 with **ElevenLabs** (flow "JINGLE POP game art", model
`gemini-nano-banana-2.1`, Google's Nano Banana 2.1), one take each, and cut, sized and exported by `export.py`
(Pillow + numpy, about 15 s):

```bash
python3 -I game-146/dev/art/export.py RAW     # RAW holds the PNGs named in the table, as downloaded
```

The plan was fal (`fal-ai/nano-banana-2`, the repo's usual image model); the fal account had run out of credits, so
the same prompts went to ElevenLabs' Nano Banana 2.1 instead. Spend: 18 images and 2 edits, about 4,600 credits.

## What was generated

| Raw file | Becomes | Size | Notes |
|---|---|---|---|
| `title.png` | `title.webp` | 1920×1072 | 16:9 2K. Juni on a snowy hill aiming the candy-cane launcher; ornaments in the sky; the upper middle kept clear. The title screen's backdrop. |
| `bg-<chapter>.png` ×6 | `bg-<chapter>.webp` | 1376×768 | 16:9 1K: workshop, gingerbread, candy, pond, ridge, hoard. "The center is soft and out of focus, because a puzzle board sits in front of it." CSS `cover` behind the canvas. |
| `elf-base.png` | `elf.webp` | 420 tall | 3:4, full body, three-quarter view to the right, holding an ornament, on magenta. |
| `elf-cheer.png`, `elf-sad.png` | `elf-cheer.webp`, `elf-sad.webp` | 420 | Edits of `elf-base` ("same character, same outfit, same framing, now jumps for joy / looks sheepish"), so she stays the same person. |
| `grimwick-sprite.png` | `grimwick.webp` | 360 | Full body on green (he is pale blue and the bag has purple patches, so magenta was out). Not used in v1.0.0. |
| `por-juni/holly/grimwick.png` | `por-*.webp` | 320 square | Head-and-shoulders dialogue portraits on blurred backdrops. |
| `icons-sheet.png` | `icon-<power>.webp` ×9 | 128 | One 2K 3×3 sheet on magenta: candy-cane ornament, pudding, star, bell, tinsel, cocoa, north star, gingerbread cookie, present. "Ordinary objects, not characters: no faces." Cut per cell. |
| `ending.png` | `ending.webp` | 1376×768 | Juni handing Grimwick an ornament for his own little tree; Mrs. Claus in the doorway. |
| `avatar.png` | `../../avatar/avatar*.webp` | 256, 64 | The Pocket Garden avatar, with the prompt from `dev/avatar-style.json` (through `dev/make-avatars.py`). |
| `game-icon.png` | `../../icons/*.png` | 512…32 | The app icon, with the style from `dev/game-icons.json` (through `dev/make-icons.py`). |

Every scene prompt opened with the same style paragraph:

> Polished storybook illustration for a cozy Christmas puzzle game, in a soft painterly 3D-rendered cartoon look like a
> modern animated holiday film: warm candlelight against cool blue snow, rich cranberry reds, evergreen greens and gold,
> gentle rim light, soft sparkles and bokeh. No text, letters, numbers, logos, watermarks, borders, frames or
> user-interface elements anywhere.

The characters are described the same way in every prompt (Juni: copper-red braids, freckles, green velvet tunic with
gold buttons, red-and-white striped scarf and stockings, curly-toed green boots, floppy green hat with a gold bell;
Grimwick: small, round, fluffy pale blue-white fur, big pointed ears, amber eyes, a long bird-like nose, an icicle
crown askew).

## The cut-outs

The key colour is measured from the image border (the renders came back with a slightly off magenta, about #d040d0),
background connected to the border is removed by region growing, enclosed pockets almost exactly the key colour go
too (inside the tinsel coil, the mug handle), a band at the edge is despilled (magenta: the red and blue excess over
green pulled back; green: green limited to the larger of red and blue), and the alpha is eroded one pixel and softened.
Every sprite was checked on a contact sheet: no fringes worth fixing, no facing problems (Juni faces right, toward the
launcher, in all three poses).

Keep the raw renders out of the repo (≈35 MB). The whole `art/` folder is 1.3 MB.
