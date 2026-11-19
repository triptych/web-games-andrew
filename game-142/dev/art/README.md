# Kaboom Keep — the art (fal)

`../../art/` (24 files, about 950 KB) was made on 2026-11-19 with [fal](https://fal.ai) `fal-ai/nano-banana-2` (24 jobs, plus the icon, at about $0.08 each) and exported by `export.py`:

```bash
python3 -I game-142/dev/art/export.py RAW     # RAW holds the downloaded originals, named as below
```

Everything else you see (the castles, the cannon, the people, the trees, every effect) is made in code.

## Shared system prompts

- **Pictures:** "Whimsical storybook game art in a soft painterly 3D toy style, like a cozy cartoon: bright saturated colours, warm sunny light, chunky rounded shapes, gentle soft shadows. Never any text, letters, numbers, logos, UI or watermark."
- **Textures:** "Hand-painted stylised game textures for a cosy cartoon 3D game. Flat, even, shadowless lighting. Fill the whole square edge to edge. Never any text, letters, logos, borders or watermark."
- **Portraits:** "Whimsical storybook character portraits in a soft painterly 3D toy style: chubby rounded proportions, big friendly eyes, rosy cheeks, warm light. Never any text, letters, logos, UI or watermark." Each on a flat magenta (or green, for the red and purple characters) background, cut out by `export.py`'s flood fill.

## The files

| File | Raw | Size | Prompt (abridged) |
|---|---|---|---|
| `title.webp` | `title.jpg` | 1600 × 893 | a chubby bronze cannon on a grassy hill fires at a toy-block castle with pink and blue cone roofs bursting apart, tiny knights tumbling; clear sky in the upper middle |
| `tex-stone.webp` | `stone.png` | 512² | seamless soft cream-grey limestone, mottling, a few tiny cracks, no bricks or grout |
| `tex-brick.webp` | `brick.png` | 512² | seamless smooth coral terracotta, no bricks or grout |
| `tex-wood.webp` | `wood.png` | 512² | seamless honey-orange wood grain, two knots, no planks |
| `tex-ice.webp` | `ice.png` | 512² | seamless pale cyan glacier ice with swirls and bubbles |
| `tex-roof.webp` | `roof.png` | 512² | seamless pastel pink fish-scale roof tiles |
| `tex-tnt.webp` | `tnt.png` | 512² | one face of a red explosives crate with a dark frame and a cartoon bomb, no words |
| `tex-grass.webp`, `tex-snow.webp`, `tex-autumn.webp` | `grass.png`, `snow.png`, `autumn.png` | 512² | the ground of each region seen from above |
| `sky-meadow.webp`, `sky-frost.webp`, `sky-sunset.webp` | `sky.jpg`, `sky-frost.jpg`, `sky-sunset.jpg` | 2048 × 869 | a 21:9 panorama, horizon just below the middle: blue sky and cumulus / pale winter sky over snowy mountains / golden-hour sky over purple hills |
| `region-meadow.webp`, `region-frost.webp`, `region-sunset.webp`, `region-marsh.webp` | `region-*.jpg` | 1200 × 509 | a banner of each region with its castles, for the map |
| `sky-marsh.webp`, `tex-marsh.webp` | `sky-marsh.jpg`, `marsh.png` | 2048 × 869, 512² | v1.1.0: Moonbeam Marsh, a starry violet twilight with a full moon over misty pools and willows; mossy teal ground with glowing flowers (darkened in the view) |
| `cast-knight.webp` | `knight.png` | 257 × 384 | Sir Wobbleton: round silver helmet, red plume, blue tabard with a star, wooden sword, "uh-oh" |
| `cast-king.webp` | `cast-king.png` | 384 × 369 | King Bumble: white moustache, wobbly gold crown, red cape and ermine, "not my castle!" |
| `cast-wizard.webp` | `cast-wizard.png` | 309 × 384 | Mumbleby: tall floppy purple hat with stars, white beard, spectacles, glowing wand |
| `cast-prince.webp` | `cast-prince.png` | 375 × 384 | Prince Pompous: golden circlet, nose in the air, ruff, a teacup with a raised little finger |
| `cast-pip.webp` | `cast-pip.png` | 362 × 384 | Pip the Cannoneer: too-big brass helmet with goggles, freckles, gap-toothed grin, thumbs up |

## Notes

- A pilot of five (title, stone, wood, knight, sky) came back right first time, so the other 16 were made in one go. Nothing was regenerated.
- The skies were asked to wrap seamlessly; they don't quite, so the view mirrors them (`MirroredRepeatWrapping`, twice round the cylinder) and turns the cylinder so the mirror seams sit to the sides.
- Textures are sampled in each block's own frame by the block shader ([../../js/view/blocks.js](../../js/view/blocks.js)), about 0.5 repeats per metre, with an offset per block so neighbours don't match.
