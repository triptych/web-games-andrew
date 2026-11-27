# HAYATE RIVER STRIKE — the art (ElevenLabs)

Every picture was generated on 2026-11-27 with **ElevenLabs** (flow "HAYATE RIVER STRIKE — game art & audio", model
`gemini-nano-banana-2.1`, 2K), one take each, and cut up by [export.py](export.py) (Pillow + numpy):

```bash
python3 -I game-152/dev/art/export.py RAW game-152/art REF
```

Keep the raw renders out of the repo (about 28 MB). The `art/` folder is under 700 KB.

| Raw file | Grid | Use |
|---|---|---|
| `sheet-a` (3:2) | 3×2 | hayate, patrol, gunboat, raider, barge, tank |
| `sheet-b` (1:1) | 2×2 | turret, mine, kabuto, torii |
| `sheet-c` (1:1) | 2×2 | souen, raijin, tetsuren, zero |
| `portraits` (16:9) | 3 across, magenta key | `art/por-rin`, `por-tomo`, `por-kurogane` (comms box, dock) |
| `title` (16:9) | | `art/title.webp`, the title screen |

Each sheet cell becomes a **Meshy image-to-3D reference** (`REF/<name>.png`: on white, square, 1024 px; see
[../meshy](../meshy/README.md)) and a UI cut-out (`art/unit-<name>.webp`). Cells are found by splitting the sheet
evenly; the background is a white flood fill from the cell border, and any piece touching the cell border that isn't
the biggest is dropped (the first export had slivers of the neighbouring vehicle in three cells). The portraits are a
magenta flood fill with the pink fringe removed.

The vehicle sheets share one style paragraph:

> Mechanical design reference sheet in the style of a 1990s action anime: bold clean ink outlines, flat cel shading
> with crisp two-tone shadows, vivid saturated colors, retro mecha design. [N] separate vehicles arranged in a neat
> [grid], each one alone in the centre of its own cell with a wide empty margin around it, nothing touching, every
> vehicle shown complete in a clean three-quarter view from above and in front, all facing the same way (bow toward
> the lower left). Plain flat pure white background everywhere, no grid lines, no borders, no water, no waves, no
> splashes, no ground, no shadows, no text, letters, numbers, captions or logos. They are ordinary machines: no faces,
> no eyes, no mouths.

followed by one line per cell (the hero speedboat "a sleek white hull with a bright cyan stripe and red accents …",
the bosses "an enormous twin-hull river fortress …", "an enormous storm hydrofoil warship …", "an enormous flagship
river battleship … a big iron lotus-flower emblem on the bow …"). "No water, no ground" kept Meshy from modelling a
sea under each boat. All five came back clean on the first take.

The Pocket Garden avatar (`../../avatar/avatar.webp`) is a `gemini-nano-banana-2.1` 1K painting with the shared style
in `dev/avatar-style.json`; the Lounge sprite is `recraft-v4.1-flash` with `dev/sprite-style.json`. The first sprite
request ("a 19-year-old … girl") was blocked by the provider's filter; "an adult speedboat racing pilot" went through.

**Spend:** 5 images at 2K (305 credits each), the avatar (204), two sprite requests (48 each, one blocked):
about 1,830 credits.
