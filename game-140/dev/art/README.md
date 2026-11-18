# The Last Apprentice — art

Every image was generated with **fal** (`fal-ai/nano-banana-2` at 2K, and `fal-ai/nano-banana-2/edit` with
reference images to keep the cast consistent) and exported with [export.py](export.py). Every prompt is in
[prompts.mjs](prompts.mjs). Nothing is drawn by hand.

| Folder | Count | Size | What |
|---|---|---|---|
| `art/bg/` | 27 | 1280×720 WebP q80 | Places: Ravenmoor and its library and stair, the road, Hollowmere, Edda's house, the drowned chapel, Cinderhold, the forge and the Great Forge, Merrowgate, the tavern, the ship, the lighthouse, the Eldwood and the heart-tree, Aurelfield, the abbey and its crypt, Starfall and the observatory, Vael, the nave (grey and in colour), the camp, the map |
| `art/cg/` | 35 | 1280×720 WebP q80 | Illustrations: the book and the geas, the lanterns, the seven seals seen from above (the ward-lock is drawn over them), the seven colour-returns, the Hierarch, Caius at the forge and in the gold, the storm, Ione waking, the confession, the bridge, the throne, the Codex burning, the finale, the epilogue's festival and six endings for the cast, the last page |
| `art/por/` | 13 | 900 px tall WebP with alpha | Portraits: the Codex (a gold ghost on black, drawn with additive light), Edda (+ happy), Aldwin (+ sad), Kestrel (+ happy), Ione, Caius (+ soft), Odrane, Tilly, a Cinerite knight |
| `art/title.webp` | 1 | 1600×900 | The title painting |

## Painted in colour, greyed in code

The game takes the colour away itself ([js/view/stage.js](../../js/view/stage.js)), band of hue by band of hue,
so **every picture is painted in full colour**, and the style prompt asks for jewel-tone accents (crimson, amber,
gold, emerald, sapphire, indigo, violet) glowing against deep shadow and "never monochrome". A picture that was
painted grey would stay grey when its colours came back. The two pictures that show the world after the last ward
(`nave-colour`, `sanctum-colour`) and the epilogue CGs are simply more colourful; the shader shows them in full
because by then every band is open.

## How they were made

1. **Portraits first**, full figure on a plain magenta background (`PORTRAIT_STYLE`). The expressions are
   `/edit`s of the base portrait ("same pose and framing, same magenta background, now …"), so they line up.
2. **Backdrops** with "no people" in each prompt (the portraits stand in front of them).
3. **CGs** that show cast members pass their portraits (and the title painting, for the hooded apprentice) as
   references to `/edit`, with "use the reference images only for the faces, hair and clothing; paint a new full
   scene, with no magenta and no plain background" so the magenta does not leak into the scene.
4. The seven **seal** CGs end "viewed from directly above, the seal centred in the frame and filling its middle
   third", so the ward-lock's rings sit over the painted seal.
5. The **map** was fitted afterwards: each chapter's `map: [x, y]` in
   [chapters.js](../../js/sim/data/chapters.js) is where its place landed in the painting.

## export.py

```bash
python3 -I game-140/dev/art/export.py RAW_DIR [names...]
```

`RAW_DIR` holds `bg-<id>.png`, `cg-<id>.png`, `por-<id>.png` and `title.png`. Backdrops and CGs are cover-cropped
to 16:9. Portraits are keyed out of their magenta: the key is the median of the border (the model paints
`#d040c0`-ish, not `#ff00ff`); alpha ramps with the distance to the key (30–90); only the background connected to
the border is keyed, plus enclosed pockets of near-pure key; part-key pixels are unmixed, and a 3 px band at the
edge is despilled (red and blue both above green pulled back), which removed the lilac cast on the grey robes.
The Codex is exported without keying.
