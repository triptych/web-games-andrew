# Echoheart Academy — the art (fal)

Every picture in `art/` was painted with **fal** `fal-ai/nano-banana-2` (and `/edit` for variations) on 2026-11-25,
about 70 images at $0.08 each (≈ $5.70). The shared style prompts are in [style.json](style.json).

| Set | How | Files |
|---|---|---|
| Character references | `nano-banana-2`, 2:3, 1K: full body in an A-pose on flat light grey, one per character (Kai, Hana, Lys, Pip, Ren, Veymont, Hollow Veymont, Graves, Theo, Yuki, the acolyte, the armor; Mochi, the wisp and the gargoyle at 1:1). They are the identity for everything else, and Meshy's input. | not shipped (in the scratch folder) |
| Expression sprites | `nano-banana-2/edit` from each reference: "redraw this exact character as a waist-up visual novel sprite … expression and pose: …", 3:4. 32 sprites. | `art/spr/<who>-<expr>.webp` (960 px tall), `art/spr/mochi.webp` |
| Backgrounds | `nano-banana-2`, 16:9, 1K, the background style prompt ("never draw any people"). 17 places. | `art/bg/*.webp` |
| CGs | `nano-banana-2/edit` with the characters' references as inputs (the title used six, the ending eight): the title, four heart events, the reveal, the ending. The Hana CG came back with two Chinese characters on the chestnut bag; one more edit removed them. | `art/cg/*.webp` |
| Item icons | two 4 × 4 sheets at 2K (`icons-a`, `icons-b`), cut per cell. | `art/icons/*.webp` (128 px) |

## Rebuild

```bash
python3 game-149/dev/art/export.py RAW_DIR      # needs Pillow, numpy, scipy
```

`export.py` cuts the sprites and icons out by flood-filling the light, colourless background from the border (anime
line art closes every outline). Two things it learned:

- **Light shirts and silver hair are close to the backdrop grey.** The first version also removed every pocket of
  near-background colour inside the figure and punched holes in Kai's shirt and Lys's hair. Now only *big* pockets
  of almost exactly the backdrop colour go (between an arm and the body), and the fill counts as background only
  pixels that are light *and* colourless.
- **Waist-up sprites run off the bottom of the picture**, so the bottom edge is not a seed for the fill (a white
  shirt touching it would leak away).
- Icon sheets sometimes draw a grey rounded tile behind each item; it is light and colourless too, so the same fill
  removes it.
