# GIANT'S VAULT — the painted art (fal)

Everything in `../../art/` was made on 2026-11-12 with [fal](https://fal.ai) (`fal-ai/nano-banana-2`, PNG; 2K for the
title and the icon sheets, 1K for the rest) and exported to WebP by `export.py`. About 50 images in all, roughly $4.
The 3D world uses Meshy models (see [../assets/README.md](../assets/README.md)); these images are the title, the story
cards, the portraits, the icons and the floor and wall textures.

Every prompt is built from the game's data tables by `prompts.mjs`, so the art matches the game and can be regenerated:

```bash
node game-132/dev/art/prompts.mjs cards        # prints the jobs: { name, system_prompt, prompt, aspect_ratio, resolution }
python3 -I game-132/dev/art/export.py RAW      # RAW holds <name>.png for each job
```

## The four shared system prompts

They are what make fifty separate renders read as one set. All begin "You are the … of GIANT'S VAULT, a dark mythic
action RPG: gothic-mythic fusion of ruined Greek temples, drowned marshes, shadow-drenched crypts and giant forges of
bronze and fire."

| Kind | The rest of the system prompt |
|---|---|
| paint (title, cards, portraits) | lush painterly dark-fantasy concept art: deep shadows, dramatic rim light, saturated accent glows (teal, violet, molten orange) against dark stone … no text, letters, logos, frames or UI |
| icon (5 sheets) | a perfectly even 4 by 4 grid of 16 square icons filling the image edge to edge, each a bold painted emblem centred on a dark smoky background … no grid lines, no text, no numbers, no captions |
| ref (Meshy references) | a stylised hand-painted 3D game model render … ONE subject, whole subject visible, three-quarter front view, plain flat light-grey background, no shadow, no floor |
| tex (7 textures) | a seamless tileable texture seen straight from above, flat even lighting, no objects standing up |

## Files

| File | Use | Size |
|---|---|---|
| `title.webp` | Title screen | 1920 wide |
| `card-intro`, `card-act1`, `card-act2`, `card-act3`, `card-victory`, `card-rifts` | Story cards (the art lines of `CARDS` in `js/sim/data/world.js`) | 1280 wide |
| `portrait-ironsworn`, `-stormcaller`, `-shadebinder` | Class choice | 512 wide |
| `portrait-ysolde`, `portrait-heron`, `portrait-pet` | The merchant and chronicler panels; Ember's HUD chip | 512 wide |
| `icons-skills-a`, `icons-skills-b` | 21 skills, 3 mastery emblems, potion, portal, pet spells, gold, scroll, bag | 512 (4×4 × 128) |
| `icons-items` | 11 item bases, 4 gems, a rift shard | 512 |
| `icons-legendary` | 12 legendaries, Aster's Bulwark (4) | 512 |
| `icons-sets` | Raiment of the Sky-Thief (4), 3 hybrid emblems, keys, orbs | 512 |
| `tex-town`, `-wilds`, `-temple`, `-crypt`, `-vault`, `-rift`, `-wall` | Floors (world-space UVs, 6 m a tile) and walls | 512 |

The title was generated twice: the first asked for "empty sky for the logo" and the model painted a literal black
box there. Asking for "the shadowy cavern ceiling far above, dim and calm" worked.

`icons-sets` came back with a caption under most icons despite "no captions". `export.py` cuts that sheet from the
top 70% of each cell, squared about its centre; the other sheets are cut with a 3.5% margin, which also drops the
thin dark lines the model draws between cells.
