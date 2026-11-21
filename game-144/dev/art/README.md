# NEBULA REQUIEM — the art pipeline (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) on 2026-11-21 and cut and sized by `export.py`
(Python 3 with Pillow and numpy; run it with `python3 -I`). Every 3D model, bullet and effect in the game is made in
code; these are the painted backdrops, cutscenes, portraits and cards.

| Script | What it does |
|---|---|
| `prompts.mjs` | Builds every request from the game's data tables (`js/sim/data/pilots.js`, `world.js`), so the art matches the game and can be regenerated. `node prompts.mjs names` lists them. |
| `export.py RAW` | Raw renders → `art/`: cuts portraits out of their green key (flood fill from the border, so green inside the figure survives; despills the edge), trims and scales them to 560 px tall; cover-crops cutscenes to 1280×720 (title 1600×900), backdrops to 1600×900 and boss cards to 960×540; writes WebP. About 45 s; 4.3 MB out. |
| `jobs.txt` | `name request_id` for every job, for re-downloading a result while fal still holds it. |

## What was generated

All with `fal-ai/nano-banana-2` (39 images), except the three "fierce" battle expressions and Sora's green re-key,
which are `fal-ai/nano-banana-2/edit` of the base portrait so the face stays the same person.

| Raw file | Becomes | Notes |
|---|---|---|
| `por-<id>` ×7 | `por/<id>.webp` | Pilots and cast, head and shoulders, 3:4, on a green key. The `art` field of each in `pilots.js` / `CAST`. |
| `por-<pilot>-fierce` ×3 | `por/<pilot>-fierce.webp` | Edits: the same pilot mid-battle. Used for lines before bosses and in the big scenes. |
| `cs-*` ×13 | `cs/cs-*.webp` | 16:9 anime film stills at 2K: the opening, the launch, each pilot's introduction, mid-story scene and ending, the mothership and the Heart. |
| `bg-<stage>` ×7 | `bg/<stage>.webp` | Wide painted space backdrops at 2K, one per stage plus survival. The `art` field of each stage in `world.js`. |
| `boss-<key>` ×6 | `boss/<key>.webp` | Warning cards, 16:9 at 1K. The `art` field of each boss. |
| `title` | `cs/title.webp` | The key visual behind the title screen. |
| `avatar` | `avatar/avatar.webp` | The Pocket Garden contact picture (style from `dev/avatar-style.json`). |

Every request shared one system prompt:

> You are the art director of NEBULA REQUIEM, a premium anime space-opera shoot-em-up. Every image is a high-end
> Japanese anime key visual: clean confident line art, cel shading with soft gradients, luminous glowing light effects,
> dramatic rim lighting, rich saturated colours against deep space blacks, in the tradition of late-90s and 2000s mecha
> and space-opera anime films. Cinematic composition. Never include any text, letters, numbers, logos, captions, speech
> bubbles, watermarks, signatures, borders, frames, panels or user-interface elements.

## What went wrong, and what was done about it

- **Ignored key.** The pilot portrait of Sora came back on white, not green; white on her white flight suit can't be
  keyed. Rather than regenerate (and get a different face), an edit replaced the background ("same character, same
  pose… replace the white background with green"), and the export uses that one (`RENAME`). The key instruction was
  moved to the *start* of the portrait prompt for the rest; all of them then came back on green.
- **A prop in a portrait prompt.** Mei's description said "the bridge of a carrier behind her", which fights a plain
  key. It was removed from her portrait prompt.
- **Lettering.** The launch still has a small "AETERNA" painted on the carrier's hull; it reads as a ship's name and
  was kept.
- **Brightness in play.** The backdrops are painted at full brightness; the game dims each one (`sky.dim` per stage in
  `world.js`, the Heart's to 42 %) so the bullets stay the brightest things on screen.

## Rebuilding

Keep the raw renders out of the repo (≈170 MB). With them in a folder:

```bash
python3 -I game-144/dev/art/export.py RAW
```
