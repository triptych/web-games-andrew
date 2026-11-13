# UFOops! — the art pipeline (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) on 2026-11-13 and cut, sized and exported by
`export.py` (Python 3 with Pillow and numpy; run with `python3 -I`):

```bash
python3 -I game-134/dev/art/export.py RAW      # RAW holds the renders below as <name>.png
```

## What was generated

All with `fal-ai/nano-banana-2` (1K sprites and portraits, 2K backdrops and the icon sheet; 31 images, about $2.50), except
`ufo-crash`, `mother-joy` and `mother-cross`, which are `fal-ai/nano-banana-2/edit` of the saucer and of Mother's portrait so they
stay the same characters. Every request shared one system prompt:

> You are the art director of UFOops!, a 2D arcade game drawn exactly like a 1980s Saturday-morning TV cartoon: hand-inked cel
> animation, bold clean black outlines of even weight, flat saturated cel colours with a single hard-edged shadow tone, cheerful
> goofy expressions, rubbery squash-and-stretch proportions. Never include any text, letters, numbers, logos, watermarks,
> signatures, borders, frames or user-interface elements.

| Raw file | Becomes | Prompt (abridged) |
|---|---|---|
| `cow`, `chicken`, `pig`, `sheep`, `golden` | `spr/*.webp` | side view, full body, walking to the RIGHT; the pig on green (#00ff00), the rest on magenta (#ff00ff) |
| `farmer`, `townie` | `spr/*.webp` | a farmer in overalls and a straw hat running in panic; a moustached townie in an orange flowered shirt with an ice cream |
| `gunner`, `agent`, `tinfoil` | `spr/*.webp` | standing, facing RIGHT, aiming up and to the right: a double-barrelled shotgun, a silver net-launcher, an old flash camera |
| `tank`, `laser`, `boss`, `jet` | `spr/*.webp` | a toy-like army tank; a laser emplacement pointing straight up; a barn-sized triple-barrelled tank with a mustached general in the hatch; a fighter jet flying right |
| `ufo`, `ufo-crash` | `spr/*.webp` | Zib's dented, duct-taped saucer with the one-eyed pilot; the same, sooty, cracked and dizzy |
| `mothership` | `spr/mothership.webp` | a huge purple saucer, on green, with Mother waving in the dome |
| `mother`, `mother-joy`, `mother-cross` | `por/mother-0`, `mother-1`, `mother--1` | head and shoulders on blue (#0000ff): lime skin, purple beehive with star antennae, pink cat-eye glasses, pearls |
| `pickups` | `icons/*.webp` | a 4×2 sheet on magenta: wrench, duct tape, rocket, ray-gun, force-field bubble, alarm clock, gold star, heart (unused) |
| `bg-farm`, `bg-night`, `bg-corn`, `bg-town`, `bg-base`, `bg-desert`, `bg-finale` | `bg/*.webp` (1697×720) | 21:9, flat side-on, the top two thirds empty sky, "the bottom tenth a plain flat strip of ground with nothing on it" |

## What went wrong, and what the export does about it

- **Blocked twice.** The safety filter refused the first townie ("running in comic panic, eyes bugging out") and the first stern
  Mother ("furious"). Gentler wording ("hurrying along with a surprised O-shaped mouth"; "stern and unimpressed, one eyebrow
  raised") went through.
- **Key colour drift.** The magenta comes back in several shades (the sheep's, the tinfoil dude's and the laser's are paler). The
  key is measured from each image's border, flood-filled away from the edges, enclosed pockets are removed and rim pixels despilled.
- **Facing.** Every sprite came back facing the way it was asked to, checked by eye on a contact sheet. The saucer's smoke trails
  to the right, so the game mirrors it to keep the smoke behind it.
- **Ground lines.** `export.py` finds where each backdrop's flat strip starts so the game can stand walkers on it. On the desert it
  caught a drawn line inside the sand; that one is set by hand in `js/view/art.js` (`BACKDROPS`).
- **Scale.** Drawn the full height of the screen, the farm's fence posts were as big as the saucer. The game draws backdrops 19
  world units tall (the view is about 23) with the sampled sky colour above, at 0.35 parallax, mirrored on every other tile.

The raw renders (about 40 MB) are not kept in the repo.
