# Arcana Pull — the pictures (fal)

`../../art/` (123 WebP files, 6.5 MB) was made on 2026-11-18 with [fal](https://fal.ai), `fal-ai/nano-banana-2` (PNG), and exported
by `export.py`. 45 paid images (about $4): a pilot of 5, then 39, plus one retake of the title.

```bash
node game-012/dev/art/prompts.mjs                  # every job: { name, system_prompt, prompt, aspect_ratio, resolution }
node game-012/dev/art/prompts.mjs pilot            # title, cardback, cards-1, foes-1, realm-1
node game-012/dev/art/prompts.mjs sheets > SHEETS.json
python3 -I game-012/dev/art/export.py RAW SHEETS.json   # RAW holds <name>.png
```

Every prompt is built from the game's data: a card's picture is `art` in `js/sim/data/cards.js` (the card's traditional image,
posed as a fighter), a Hollow's is `art` in `js/sim/data/enemies.js`, a Threshold's backdrop is `realm` in the same file.

| File | Use | Made |
|---|---|---|
| `card-<id>.webp` ×78 (360×540) | Every card face | `cards-1…19`: four cards to a 2K 2:3 sheet (a 2x2 grid of 2:3 cells), in deck order; `cards-20` the last two side by side (4:3) |
| `foe-<id>.webp` ×29 (360×540) | Every Hollow | `foes-1…7`, four to a sheet; `foe-the_world` alone at 1K |
| `realm-1…10.webp` (1600 px) | Battle backdrops, one per Threshold | 2K 16:9, "the lower third is open ground in soft shadow" so cards can stand on it |
| `title`, `parlour`, `reading`, `ending` (1600 px), `over` (1280 px) | Screens | 2K / 1K 16:9 |
| `cardback.webp` (360×540) | Card backs (the Well's reveal, unknown cards) | 1K 2:3 |

## The system prompt (shared)

"You paint for ARCANA PULL, an original fantasy tarot card-battler. Every image is a luminous Art Nouveau tarot painting: elegant
flowing ink linework, rich gouache with touches of gold leaf, a deep midnight indigo and violet night palette lit by jewel-toned light,
dramatic and heroic. The painting fills the whole canvas edge to edge: no border, no ornamental frame, no card edge, no paper margin.
Original characters only. Never include any text, letters, numbers, roman numerals, captions, labels, logos, signatures or watermarks
anywhere." Card cells add a light by suit (golden starlight for the Majors, ember for Wands, sea teal for Cups, silver for Swords, moss
and gold for Pentacles); the Hollows add a darker clause (cold violet, sickly green and ember against black-indigo, "eerie but not gory").

## What went wrong, and what was done about it

- **The first title had a flat empty band across the top.** It was asked to "keep the upper third calm for a title" and painted a
  plain strip. The retake asks for the night sky and nebula to "rise all the way to the top edge… never a plain band, panel or empty
  strip", and came back as one painting.
- **Gutters of either colour, never on the half line.** Most sheets came back with black gutters, three (cards-14, cards-15, foes-1)
  with white ones. `export.py` finds each split as the most uniform row or column within 7% of the middle, cuts each cell with a 1.2%
  inset, then trims near-uniform edge strips (dark or light) up to 6% a side. All 107 cells came out clean on the first export.
- **A last sheet of two.** 78 cards leave two over; asking a 2x2 grid for two subjects invites a stray painting, so the last two were
  asked as a pair side by side in a 4:3 image and split at the middle gutter.
- **Text that got through.** The High Priestess's pillars carry a B and a J (they do in the traditional card); kept.
- **Context cost.** Every fal submission echoes its full prompt and three long URLs per job (about 3 KB each); 44 jobs in batches of 8
  and two grouped status reads kept it manageable. Request ids went into a scratch file at once.
