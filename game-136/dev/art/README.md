# Pinch & Place — the pictures (fal)

`../../art/` (about 460 KB) was made on 2026-11-14 with [fal](https://fal.ai) (`fal-ai/nano-banana-2`, PNG) and exported to WebP by `export.py`. Fifteen paid images, all kept, about $1.20. The 3D clay models and the clay shader are not generated: they are code (`js/view/`).

```bash
node game-136/dev/art/prompts.mjs            # the jobs: { name, system_prompt, prompt, aspect_ratio, resolution }
node game-136/dev/art/prompts.mjs pilot      # one of each kind (title, por-pip, motif-sun)
python3 -I game-136/dev/art/export.py RAW    # RAW holds title.png, por-<room>.png, motif-<m>.png
```

Every prompt is built from the game's data: a client's look is `art` in `js/sim/data/levels.js`, a painting's subject is `motifArt` in `js/sim/data/catalog.js`.

| File | Use | Made |
|---|---|---|
| `title.webp` (1600 px) | Behind the title screen | 2K, 16:9, system prompt THINGS |
| `por-<room>.webp` ×8 (320 px, cut out) | Each room's client on the brief card, the room list and the rating | 1K on flat magenta, system prompt PEOPLE |
| `motif-<m>.webp` ×6 (512 px) | The painting inside every clay picture frame on the walls | 1K, system prompt THINGS, centre 84 % kept |

## The system prompts

- **CLAY** (shared): "Claymation stop-motion style: everything is hand-sculpted from smooth matte plasticine modelling clay, with soft visible thumbprints and gentle tool marks, rounded chunky shapes, bright cheerful colours, warm soft studio lighting … No text, letters, numbers, logos, signatures, frames, borders or UI anywhere in the image."
- **PEOPLE** = CLAY + "Characters have simple friendly clay faces with small round black bead eyes."
- **THINGS** = CLAY + "The objects are ordinary things, NOT characters: no faces, no eyes, no mouths on any object, the sun or the clouds." (game-135's trucks grew eyes without it; this time the sun came back faceless.)

## What went wrong

- **Four of six paintings came with a margin.** Despite "fills the whole square edge to edge", boat, cat, flower and hills came back as a clay tile lying on a table. `export.py` keeps the centre 84 % of every painting; the clay frame in the game covers the edge anyway.
- **Magenta pockets.** The border flood fill can't reach backdrop enclosed by the figure (between Fern's braids, between the twins, under Pip's arm). A second pass removes strict magenta anywhere (r > 160, b > 140, g < 125); lilac hair and rosy cheeks are well outside it.
- The backdrop came back pink-magenta (about 205, 80, 190), not #ff00ff; the key test is a hue test, not a distance to #ff00ff.
