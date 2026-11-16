# CLEAN SLATE — the pictures (fal)

`../../art/` (51 WebP files, 1.9 MB) was made on 2026-11-16 with [fal](https://fal.ai), `fal-ai/nano-banana-2` (PNG), and
exported by `export.py`. 30 paid images, all kept (about $2.50): 6 in a pilot, then 24.

```bash
node game-139/dev/art/prompts.mjs                  # every job: { name, system_prompt, prompt, aspect_ratio, resolution }
node game-139/dev/art/prompts.mjs pilot            # title, table, cardback, rival-brannoc, card-stew, card-habit
node game-139/dev/art/prompts.mjs sheets > SHEETS.json
python3 -I game-139/dev/art/export.py RAW SHEETS.json   # RAW holds <name>.png
```

Every prompt is built from the game's data: a rival's look is `art` in `js/sim/data/rivals.js`, a card's still life is `art` in
`js/sim/data/cards.js`.

| File | Use | Made |
|---|---|---|
| `title.webp` (1600 px) | The title screen and the day | 2K, 16:9 |
| `table.webp` (1600 px) | The tabletop texture under the cards | 2K, 16:9, "seen exactly from directly above" |
| `cardback.webp`, `rivalback.webp` (360×540) | The backs of your cards and of the rival's | 1K, 2:3 |
| `rival-<id>.webp` ×15 (384×512) | The portrait behind the pyramid, letters, stories, partner cards | 1K, 3:4 |
| `card-<id>.webp` ×28 (320 px) | The picture on each card | `sheet-1…7`: four cards to a 2K 2x2 sheet, cut apart; `card-habit`, `card-stew` single 1K pilots |
| `ending.webp`, `over.webp` (1280 px) | The ending and the loss screens | 1K, 16:9 |

## The system prompt (shared)

"You illustrate CLEAN SLATE, a cosy, wry fantasy card game about a retired assassin who opens a tavern. Every image is a rich
hand-painted storybook illustration in the manner of an antique tarot deck: warm oil-paint textures over confident ink linework,
candlelit amber and honey tones against deep teal and plum shadows, soft painterly edges, a gentle sense of humour. The painting
always fills the entire canvas to every edge: no paper margin, no torn or deckled paper edges, no white border. Original
characters only. Never include any text, letters, numbers, runes, logos, signatures, watermarks, borders, frames, card edges or
user-interface elements anywhere in the image."

## What went wrong, and what was done about it

- **A storybook paper margin.** "Storybook illustration" brought cream, torn-paper borders on the pilot's title and Brannoc's
  portrait. The edge-to-edge sentence was added to the system prompt (only Quell's portrait still had one), and `export.py`
  `trim()` peels near-uniform rows and columns that are much lighter or darker than the picture, up to 9% a side. The title keeps
  a little torn edge at its corners; the title screen covers with it.
- **Sheet gutters.** Two of the seven 2x2 card sheets came back with cream gutters and margins instead of thin dark ones; each
  cell is cut with a 2.5% inset and then trimmed.
- **Text that got through.** Penrose Tally's portrait has a small "CLEAN SLATE" sign in the background, and the Grudge card's
  wanted poster says WANTED. Both fit the game and were kept.
- **Cost of the job lists.** Every fal submission echoes its full prompt back, so 28 single card pictures would have filled the
  agent's context; the sheets cut 28 card jobs to 7 and the seven room paintings were dropped (rooms show as text in the market).
