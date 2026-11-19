# The Sugar Siege — the art pipeline

Every picture in `../../art/` was generated with [fal](https://fal.ai) on 2026-11-19 (`fal-ai/nano-banana-2`, 1K, and 2K
for the backdrops), one render each, then cut out and sized by `export.py`. About 65 images, roughly $5.

## How it was made

- **The household looks like itself.** Noxia, Lord Vellum, Pip, Madame Silkwhistle, Gerald, Grizelda, Wick and Mother's
  portrait were made with `fal-ai/nano-banana-2/edit` from game-110's sprites, drawn 4× on magenta
  (`game-110/assets/overlord/cook.png` and `assets/minions/*.png`), with a prompt asking for the same character, now in
  their new job. Noxia's throwing and cheering poses used both the original and the new mayor sprite as references.
  Lord Vellum kept his party hat. Everyone else is plain text-to-image.
- **Four shared system prompts** (`prompts.json` → `systems`): sprites, portraits, buildings ("ordinary objects, NOT
  characters: no faces, no eyes, no mouths") and backdrops ("no characters").
- **Prompts are written from the game's data** (`prompts.json` → `items`), and every one ends with a flat key
  background: magenta, or bright green for pink and purple subjects (Noxia, Pip, Silkwhistle, the Queen, the bat,
  the cupcake mimic, Mother's frame).
- A pilot of six (Noxia's sprite and portrait, Vellum, a zombie, the bakery, the town) was checked by eye first. The
  town backdrop was re-rolled: the first one had lamp posts standing in the middle of the green where the buildings go.
- `grab.py` pulls the URLs out of a saved `wait_for_jobs` result (they overflow the conversation) and downloads them by
  name, from `jobs.txt`.

## What `export.py` does

- Measures the key colour from the border (the model's "magenta" came back anywhere from #ff00ff to a dusty mauve), floods
  the background from the edges, then also removes any enclosed clump of near-key pixels (between a windmill's sails,
  inside a bow, the bell tower's arches) with a tighter threshold so real purples survive, and peels a two-pixel halo.
- Drops specks smaller than 2% of the main figure, trims, box-filters down to the game's size (portraits 220 px tall,
  sprites 80–230 px, buildings 170–250 px, walls 340 px) with a hard alpha edge, and quantises to 256 colours.
- Backdrops go to 1600 px JPEGs.

## What went wrong, and what's still drawn in code

- The model drew the walls in a three-quarter view instead of side-on; they still read well as the left end of the field.
- Nothing came back facing the wrong way, so `FLIP` is empty.
- Drawn in code: the doilies, buns, arrows and potions in flight, the splash rings, the web, crumbs, hearts and the
  sleepy "z"s, the plot lots and the night tint.
- The staff walking around town are game-110's own sprites (`art/staff/`), copied as they are.

## Rebuilding

```bash
python3 -I game-143/dev/art/grab.py RESULT.txt RAW     # after wait_for_jobs; RAW gets <id>.png
python3 -I game-143/dev/art/export.py RAW              # writes game-143/art/ and art/manifest.json
```
