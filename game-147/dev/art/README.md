# Inn Over My Head — the art (ElevenLabs)

Every picture was generated on 2026-11-23 with **ElevenLabs** (flow "Inn Over My Head — game art & audio", model
`gemini-nano-banana-2.1`), one take each, and exported by the scripts here (Pillow + numpy):

```bash
python3 -I game-147/dev/art/cut.py RAW ITEMS        # the item sheets → single-object pictures (Meshy references)
python3 -I game-147/dev/art/tex.py RAW/sheet-textures.png game-147/art/tex   # v1.1.0: 16 tileable surface textures
python3 -I game-147/dev/art/export.py RAW game-147/art   # title, ending, backdrops, portraits
node game-147/dev/icons.mjs                        # item icons, rendered from the Meshy models (server on 8147)
```

Keep the raw renders out of the repo (about 60 MB). The `art/` folder is 1.2 MB.

## What was generated

| Raw file | Use | Size |
|---|---|---|
| `ref-<who>.png` ×18 | **Meshy image-to-3D references** for the heroes, Goldmaw, the guests and the monsters; also cut out into the dialogue and UI portraits (`por-<who>.webp`) | 3:4 or 1:1, 1K |
| `ref-ember.png` (edit) | Ember again, same pose, without glasses or the soot smudge, after the first model's face came out distorted | 16:9 1K, re-centred |
| `sheet-ingredients`, `sheet-meals-gear`, `sheet-decor` (4×4), `sheet-furniture` (3×3) | 57 objects on white, cut by `cut.py` into Meshy references | 1:1 2K |
| `sheet-furniture2` (4×4, v1.1.0) | 16 more props for the rebuilt inn (fireplace, sofa, clock, coat rack, kitchen shelf, barrel, crates, chair, nightstand, floor lamp, tree, hedge, lamp post, bench, flower bush, pumpkins); Meshy flattened the flower bush and split the crates, so those two are unused | 1:1 2K |
| `sheet-textures.png` (4×4, v1.1.0) | 16 flat surface swatches cut by `tex.py` into `art/tex/*.webp` (512 px): honey and walnut planks, terracotta tiles, five wallpapers, plaster, shingles, fieldstone, grass, moss, cave flagstones, cliff, a rug. Organic ones are made seamless by offset-and-blend; regular patterns (planks, tiles, stripes, damask, flagstones) ghost when blended, so they are cut as they are and tile mirrored in the game | 1:1 2K |
| `title-v2.png` | The title screen: the inn, the five heroes waving, Goldmaw peeking with her ledger (an edit of `title.png` removing Ember's glasses) | 16:9 2K |
| `ending-v2.png` | The ending: the deed, a cake, confetti, Goldmaw with tea (edited the same way) | 16:9 1K |
| `bg-meadow`, `bg-grove`, `bg-cave` | Battle backdrops behind the 3D arena ("the lower half soft and out of focus") | 16:9 1K |
| `bg-hotel` | The valley behind the inn | 16:9 1K |
| `avatar.png` | The Pocket Garden avatar (Maple with a room key), style from `dev/avatar-style.json` | 1:1 1K |
| `game-icon.png` | The app icon, style from `dev/game-icons.json` | 1:1 1K |

The character references share one style paragraph:

> Character reference art for a cozy, whimsical 3D anime RPG: one single stylized chibi 3D figure (head about one third
> of the body height, big expressive eyes), rendered like a polished cel-shaded toy figurine with clean simple shapes,
> soft toon shading and bright sunny pastel colors. Full body, centered, standing in a neutral A-pose facing the
> viewer, arms held slightly away from the body, feet slightly apart, the whole figure visible with a margin around it.
> Plain flat pure white background, no ground, no shadow. No text, letters, logos, watermarks, borders or user-interface
> elements.

Monsters use a "cute, slightly mischievous chibi monster rendered like a polished cel-shaded vinyl toy … never scary"
version; item sheets say "ordinary objects, NOT characters: no faces, no eyes, no mouths", which kept every jar and
kettle faceless.

**Spend:** 34 images and 4 edits, about 8,800 credits.
