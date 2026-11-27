# One Shot — the art (ElevenLabs)

Every picture was generated on 2026-11-27 with **ElevenLabs** (flow "One Shot — game art & audio", model
`gemini-nano-banana-2.1`), one take each, and exported by [export.py](export.py) (Pillow + numpy):

```bash
python3 -I game-151/dev/art/export.py RAW game-151/art
```

Keep the raw renders out of the repo (about 25 MB). The `art/` folder is 480 KB.

## What was generated

| Raw file | Use | Size |
|---|---|---|
| `ref-solitaire`, `ref-drone`, `ref-<mothership>` ×6 | **Meshy image-to-3D references** ([../meshy](../meshy/README.md)); also cut out (white flood fill) into `art/ship-<id>.webp` for the hangar list | 1:1 1K |
| `por-juno`, `por-mira` | The comms portraits (magenta key flood-filled out) | 1:1 1K |
| `cut-juno` | The firing cut-in: Juno shouting, lit gold from below, speed lines | 16:9 1K |
| `title` | The title screen: the Solitaire charging the Lance at the Throne, a drone swarm | 16:9 2K |
| `sky` | The nebula behind the 3D battle (`scene.background`) | 16:9 2K |

A pilot of three (the ship, the Ember Citadel, Juno) was checked before the rest were made.

The ship references share one style paragraph:

> Mechanical design reference art for a 1990s space anime: one single spacecraft drawn like a hand-painted 90s anime
> cel (bold clean ink outlines, flat cel shading with crisp two-tone shadows, airbrushed metal highlights, retro mecha
> design), shown as a clean three-quarter view from above and in front, the entire craft visible with a wide margin
> around it. Plain flat pure white background, no ground, no shadow, no stars, no space backdrop, no text, letters,
> numbers, logos, watermarks, borders or user-interface elements. It is an ordinary machine: no face, no eyes, no
> mouth. Subject: …

The motherships say "one single enormous alien mothership" instead. "No face, no eyes" mattered: the first drafts of
the Glacier Maw ("an enormous fanged maw") and the Throne ("a huge glowing pink eye-like core") were rewritten to "a
wide jagged intake mouth" and "a spherical core" before anything was generated. Portraits use "Character portrait cel
from a 1990s space anime … Plain flat solid pure magenta (#ff00ff) background".

**Spend:** 12 images at 1K (204 credits each) and 2 at 2K (305), about 3,060 credits.
