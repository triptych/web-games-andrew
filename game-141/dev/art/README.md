# SANDSUNK — the art (fal)

Every picture in `../../art/` was generated with [fal](https://fal.ai) (`fal-ai/nano-banana-2`, 2026-11-18; 28 images, about $2.30) and cut, keyed and packed by `export.py` (Pillow + numpy; `python3 -I game-141/dev/art/export.py RAW`). The raw renders (≈45 MB) are not in the repo.

Every request shared one system prompt:

> You are the art director of SANDSUNK, a light-fantasy desert archaeology game. Every image is a painterly storybook illustration: confident hand-inked line art with clean dark-brown outlines, coloured in with warm watercolour and gouache washes, soft painterly shading and gentle texture. Sun-baked desert palette of ochre, sand gold, terracotta and rose, with accents of turquoise, lapis blue and polished gold. Friendly, whimsical, readable at small sizes. Never include any text, letters, numbers, logos, watermarks, signatures, borders, frames or user-interface elements.

| Raw | Becomes | Notes |
|---|---|---|
| `blocks.png` (2K, 4×4) | `tiles.webp` 4×4 × 256 px | Sand, packed sand, sandstone, mud brick, granite, obsidian, crystal, rune block, bronze door, sun panel, three floors, star chamber floor, pillar capital, hatch seal. Cut 4% inside each cell: the model paints thin gutters between cells despite "no grid lines". |
| `mon.png` (2K, 3×2, green key) | `monsters.webp` 3×2 × 256 px | Scarab, sand wraith, mummy jackal, cobra, clay golem, sphinx moth. |
| `mon-boss.png` (green key) | `boss.webp` 384 px | The Sphinx Warden. |
| `icons-items.png`, `icons-skills.png` (2K, 4×4, magenta key) | `items.webp`, `skills.webp` 4×4 × 128 px | Cell order is the `icon` index in `js/sim/data/items.js` / `skills.js` (chest closed 12, open 13, scroll 14, museum 15). |
| `art-<id>.png` ×16 (1K, light grey) | `arts.webp` 4×4 × 256 px | The artifact pictures; also the input of each Meshy model. Prompted as "a compact solid object with no chains, strings or thin dangling parts, standing upright on its own": the pilot scarab came back on a long gold chain, which a 3D model cannot do well. |
| `por-sela/quill/zahra.png` | `por-*.webp` 384 px | Zahra's came back inside a painted frame: cut 4.5% inside. |
| `bg-title/camp/ending.png` (2K, 16:9) | `bg-*.webp` 1600 px | The title came back with a thin inked border: cut inside it. |

Keying: the backdrop colour is measured from the border, flood-filled from the edges (enclosed pockets of pure key go too), the rim alpha follows distance from the key, and the key's dominant channel is pulled down on the rim (despill). The compass came out with N/E/S letters on its dial, the only text in the set; it reads as part of the object, so it stayed.
