# Hard Hat Harbor — the pictures (fal)

`../../art/` (about 360 KB) was made on 2026-11-13 with [fal](https://fal.ai) (`fal-ai/nano-banana-2`, PNG) and exported to WebP by `export.py`. Ten paid images (eight kept), under a dollar.

```bash
node game-135/dev/art/prompts.mjs portraits    # prints the jobs: { name, system_prompt, prompt, aspect_ratio, resolution }
python3 -I game-135/dev/art/export.py RAW MESHY_WORK
```

Every prompt is built from the game's data (`GIVERS[].art` in `js/sim/data/jobs.js`), so the pictures match the game and can be regenerated.

| File | Use | From |
|---|---|---|
| `por-<giver>.webp` ×6 (256 px) | The townsfolk: job board, dialogue, the clipboard | group `portraits`, system prompt `toon`, 1K |
| `title.webp` (1600 px) | Behind the title screen | group `title`, system prompt `scene`, 2K, 16:9 |
| `badge.webp` (384 px, cut out) | The Golden Hard Hat on the certificate | group `title`, on flat magenta, cut out by flood fill from the border |
| `veh-<id>.webp` ×8 (128 px) | The toy-box buttons | Meshy's thumbnails of the models (no fal call) |

## The system prompts

- **toon** (people): "a 1990s children's CD-ROM edutainment cartoon: bold clean black outlines, flat bright primary colours with simple two-tone cel shading, friendly rounded shapes, big expressive eyes. No text, letters, logos, frames or UI."
- **scene** (the title and the badge): the same style, without "big expressive eyes", plus "The vehicles and objects are ordinary toys, NOT characters: they have no faces, no eyes, no mouths, no eyebrows anywhere on them."

## What went wrong

**The first title had trucks with two faces.** With the `toon` prompt ("big expressive eyes") and "friendly headlights" in the prompt, the dump truck and the crane came back with eyes in the windscreen *and* eyes for headlights, and the bulldozer with a second face on its blade. They also did not match the in-game models, which have no faces. The owner spotted it. The fix was a second system prompt for anything that is not a person, and saying what each part *is* in the prompt ("simple round yellow headlights that are just lamps", "empty dark glass cab windows with nobody inside"). The badge had grown a face the same way and was redone with it. The sun kept a small smile despite "not the sun"; it was left.
