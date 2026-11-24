# Glimmerglade — the art (ElevenLabs)

Every picture in `../../art/` was generated on 2026-11-24 with **ElevenLabs** (flow "Glimmerglade game art"), model
`gemini-nano-banana-2.1` (Nano Banana 2.1), one take each, and exported by `export.py` (Pillow):

```bash
python3 -I game-148/dev/art/export.py RAW     # RAW holds the PNGs named below, as downloaded
```

The sprites (Lumi's three poses, the two creature sheets, the tool icons) were painted on a plain light grey
background and then cut out by ElevenLabs' **BiRefNet v2** background-removal node (`birefnet-v2-bg-removal`, about
30 credits each), which keeps real alpha: Lumi's dragonfly wings stay translucent. No colour key, no despill.
Spend: 18 paintings, 2 edits, 6 cut-outs, about 5,400 credits. The `art/` folder is 1.3 MB.

| Raw file | Becomes | Size | Notes |
|---|---|---|---|
| `title.png` | `title.webp` | 1920×1072 | 16:9 2K. Lumi lifting her lantern among rising wisps, the willow, glass bell-flowers, a fox kit and a frog; upper middle kept clear. |
| `bg-<glade>.png` ×5 | `bg-<glade>.webp` | 1400² | 1:1 2K so it crops well in portrait and landscape: meadow, hollow, moonpond, grotto, canopy. "The whole center is soft, hazy and out of focus, because a puzzle board sits in front of it." |
| `lumi-base.png` → `cut-lumi-base.png` | `lumi.webp` | 420 tall | 3:4, full body, three-quarter view. |
| `lumi-cheer`, `lumi-think` → `cut-*` | `lumi-cheer.webp`, `lumi-think.webp` | 420 | Edits of `lumi-base` ("same character, same outfit, same framing…"), so she stays the same fairy. |
| `creatures-a.png` → `cut-creatures-a.png` | `creature-{rose,gold,lilac,coral,indigo,bramble}.webp` | 256 | 3×2 sheet at 2K: Petal Fox, Amberwing, Moonmoth, Ember Newt, Hush Owlet, Bramble the hedgehog. |
| `creatures-b.png` → `cut-creatures-b.png` | `creature-{mint,sky,teal,pearl}.webp` | 256 | 2×2 sheet: Dewdrop Frog, Cloud Hare, Ripple Otter, Starfoal. |
| `icons.png` → `cut-icons.png` | `icon-{undo,sprout,hint,restart}.webp` | 128 | 2×2 sheet: a feather, an acorn cup with a seedling, a firefly jar, a dandelion clock. "Ordinary small objects, NOT characters: no faces." |
| `por-lumi.png`, `por-willow.png` | `por-*.webp` | 320² | Story and caption portraits. The first Willow prompt ("an ancient kindly willow tree spirit… a gentle elderly face formed in bark") was blocked by the provider's filter; "a kindly old willow tree with a gentle friendly face naturally shaped in its bark, like a storybook tree character for young children" went through. |
| `ending.png` | `ending.webp` | 1600 wide | The glade at night: Lumi dancing, all ten creatures around her. |
| `avatar.png` | `../../avatar/avatar*.webp` | 256, 64 | Pocket Garden avatar, prompt from `dev/avatar-style.json` (through `dev/make-avatars.py`, which labels it `"art": "fal"`; it was painted by ElevenLabs). |
| `game-icon.png` | `../../icons/*.png` | 512…32 | App icon, style from `dev/game-icons.json` (through `dev/make-icons.py`). |

Every scene prompt opened with the same style paragraph:

> Dreamy storybook illustration for a gentle fairy puzzle game, in a soft luminous painterly style like a modern
> animated fantasy film: pastel dawn light, pearly mist, soft lavender, blush pink, mint green and pale gold, glowing
> motes of light and gentle bokeh, delicate translucent textures, airy and ethereal. No text, letters, numbers,
> logos, watermarks, borders, frames or user-interface elements anywhere.

Lumi is described the same way everywhere: a small young fairy girl with a round friendly face, rosy cheeks, big
kind sea-green eyes, short wavy silver-lavender hair with a sprig of tiny white star flowers, translucent iridescent
dragonfly wings shimmering pink, blue and gold, a dress of pale pink and peach rose petals with a leaf-green sash,
barefoot, a small glowing glass lantern on a twig.

The wisps, blossoms, petals, brambles, acorn cups and every effect on the board are drawn in code
(`js/view/view.js`); the creatures are drawn from the sprites above.

Keep the raw renders out of the repo (≈45 MB).
