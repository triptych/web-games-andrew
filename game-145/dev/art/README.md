# VACANCY — the art pipeline (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) (`fal-ai/nano-banana-2`, about $0.08 an image) on
2026-11-21 and cut, made seamless and exported by `export.py` (Python 3 with Pillow and numpy; run with `python3 -I`).
45 images: a pilot of six, then the set, then the Pocket Garden avatar. The whole `art/` folder is 2.6 MB of WebP.

| Raw file | Becomes | Notes |
|---|---|---|
| `t-*` ×26 | `<name>.webp` (512 px) | Surfaces: three wallpapers (yellow, floral, plaster), concrete, white tile, lab panels, brick, rust, carpet, wood, terrazzo, concrete floor, lino, drop ceiling, asphalt, sidewalk, grass, three facades, siding, bark. Made seamless by cross-fading each with itself shifted half a tile, except the grids whose lines were asked to sit on the image edges (ceiling, tile, lino, lab panels, sidewalk), which tile as they are. |
| `d-mold`, `d-stain`, `d-cracks` | same names | On white, drawn with multiply blending; near-white is snapped to pure white so no square shows. |
| `d-graffiti`, `d-leaves` | same names, RGBA | Cut out of a magenta key and despilled. |
| `s-ads` | `poster0..3.webp` | One 2×2 sheet of wordless mall posters, split. |
| `p-*` ×16 (`p-nurse` → `p-ruth`) | `p-<citizen>.webp` (≤360×420) | Faded instant photos pinned to a missing-person board, one per citizen; prompts are the `art` field of each citizen in `js/sim/data/citizens.js`. Cropped to the photo (Lou's came back with a typed slip in its corner). |
| `k-title`, `k-wake`, `k-ending` | 1280×720 | The mall atrium with a tree through the floor (title), waking in the rotting bedroom (intro), the townspeople stepping out of the ring (ending). |
| `s-sky` | `sky.webp` (2048×869) | An equirect overcast twilight on the sky dome. |
| `s-portal`, `s-paper` | `portal.webp`, `paper.webp` | The rift inside the ring (additive), the diary page background. |

Two system prompts. Textures:

> You produce texture maps for VACANCY, a moody first-person walking simulator set in an abandoned, decaying city. Every
> texture is a photoreal, perfectly flat, straight-on orthographic photo of a surface filling the entire frame edge to
> edge, evenly lit with no directional shadows, no vignette, no perspective, no objects in front, seamless and tileable.
> Never include text, letters, numbers, logos, watermarks, borders or frames.

Portraits and key art:

> You are the art director of VACANCY, an eerie first-person walking simulator about decay and liminal spaces: an
> abandoned city whose people vanished into a dimensional rift. Painterly-photographic, cinematic, muted desaturated
> palette of sick fluorescent yellow, teal shadow and rust, heavy atmosphere, film grain. Never include any text,
> letters, numbers, logos, watermarks, signatures, borders or user-interface elements.

## In the game

`js/view/tex.js` makes every texture from a small code-made canvas first and swaps in the photo when it loads, so a
missing file leaves the stand-in. **Dispose the texture before swapping the image**: WebGL2 allocates immutable storage
at the stand-in's size, and a bigger image then fills only its corner (the walls showed 64 px blotches until this).

## Rebuilding

Keep the raw renders out of the repo. With them in a folder named as in the table:

```bash
python3 -I game-145/dev/art/export.py RAW
```
