# NEON ARCANA

**Genre:** Block-placement puzzle with a campaign (Restoration) and an endless mode
**Engine:** three.js r165, no asset files
**Status:** v1.0.0

---

## Concept

The magic has gone out of the world. The twenty-two Major Arcana hang dark in the sky, and the only way to rekindle them is the Lattice: an 8×8 grid of neon glass. Drag glyphs from your hand onto it and fill whole rows and columns; each line bursts into light, and enough light rekindles the next card. High-tech neon over dark tarot magic: glass blocks with glowing edges, beams, shattering glass, bloom and a lens that ripples, a nebula that comes back to colour as the world is restored.

It belongs to the block-placement family (hands of three fixed polyominoes, rows and columns clear, the game ends when nothing fits) and adds a campaign of 22 chapters with their own omens, tarot powers paid for with sparks, and progress that is never lost between readings.

## Core loop

1. You hold three glyphs. Place each on empty cells; a full row or column clears.
2. When all three are placed, three more are dealt.
3. Light from placing and clearing fills the current arcanum. When it is full the card is rekindled: a cinematic, a spark, perhaps a power, and the next card's omens arrive on the lattice.
4. The reading ends when nothing in the hand fits and no power can help. Rekindled cards stay lit; the light gathered toward the next card is kept as embers and the next reading starts there.
5. Rekindle The World (XXI) to finish the Restoration; the reading plays on in the afterglow.

## Mechanics

### Glyphs and the deal
- 39 fixed shapes ([pieces.js](js/sim/pieces.js)), each with a weight and the arcanum it first appears at: 1–4 cells from the start, S/Z from the Magician, five-cell lines and corners from the Empress (III), 2×3 slabs and the 3×3 block from the Chariot (VII), diagonals from Justice (XI).
- A deal draws three weighted shapes, never three of the same. Mercy redraws up to `mercyFor(arc) = max(1, 10 − ⌊arc/2⌋)` times looking for a hand where every glyph fits somewhere, keeping the best try.
- Glyphs never rotate, except by the Wheel's Turn.

### Clearing and scoring
- Every full row and column clears at once; a cross shares its cell.
- Light: 1 per cell placed. A clear of L lines scores `100·L + 50·L·(L−1)` plus 60 per sigil inside, plus harmony (from the Lovers) of 100 × min(rows, cols), all × the resonance multiplier `1 + 0.5·r`. Emptying the lattice adds 300.
- **Resonance** rises by one per clearing move (max 8) and falls by one per move that clears nothing.
- **Sparks** (max 9, start 2): +1 per arcanum rekindled, +1 for three or more lines at once, +1 for emptying the lattice.

### Omens ([arcana.js](js/sim/arcana.js) `omensFor`)
| From | Omen |
|---|---|
| I The Magician | Sigils: golden floor marks, topped up to 1–4 on arrival; a clear through one consumes it for +60 |
| III The Empress | Five-cell glyphs |
| IV The Emperor | Blight: 1–5 stones planted on arrival (never completing a line, at most 8 on the board). They count as filled; a clear cracks them (2 hits; 3 from the Devil on) |
| VI The Lovers | Harmony bonus for rows and columns together |
| VII The Chariot | Slabs and the 3×3 block |
| XI Justice | Diagonal pairs |
| XIII Death | The creeping Void: every 7 moves in a row without a clear, a blight stone is planted |
| all | Mercy falls by one try every two arcana |

### Powers
| Power | Cost | From | Effect |
|---|---|---|---|
| Transmute | ✦1 | I The Magician | Redeal the whole hand |
| Lantern | ✦1 | IX The Hermit | Place a single light on any empty cell (it can complete lines) without using a glyph |
| Turn | ✦1 | X Wheel of Fortune | Rotate a glyph a quarter turn |
| Tower Strike | ✦2 | XVI The Tower | Empty a 3×3, blight and all |
| Starfall | ✦2 | XVII The Star | Wash away every blight stone |

When no glyph fits but a power could help, the reading is **stuck** (the powers pulse, a banner offers to end the reading); it is **over** only when no rescue is left.

### Goals
`goalFor(i) = 500 + 150·i + 6·i²`: 500 for the Fool, 2,084 for Strength, 6,296 for The World; 65,516 light for the whole Restoration.

## Content

The 22 Major Arcana in order, each with a numeral, a hue (the plate and the music lean toward it), an omen line, and (for five of them) a power. Every card is painted in code ([cardart.js](js/view/cardart.js)) as neon line art: the Fool's step off a cliff under the sun, the Magician's ∞ and wand over the four suits, the Priestess's pillars and moon, the Empress's ♀ in wheat, the Emperor's ram horns, the Hierophant's triple cross and keys, the Lovers' hearts, the Chariot, Strength's lion, the Hermit's lantern, the Wheel, Justice's scales and sword, the Hanged Man, Death's scythe before a rising sun, Temperance's cups, the Devil's pentagram and chains, the Tower struck by lightning, the Star over water, the Moon over two towers, the Sun, Judgement's trumpet and the World's wreath. A dormant card is drawn in ash with a faint ember.

## Story

There is no dialogue, only the cards. The world has gone dark; each rekindled card returns to its place in the wheel around the lattice and the nebula and stars regain a little colour. Rekindling The World ends the Restoration with a short ending, and the reading can go on in the afterglow (every refill a spark, the omens of The World). After that, Free Readings remain for score.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Choose a glyph | 1 2 3, Tab | X (next) | Tap it |
| Move it | Arrows / WASD | D-pad, stick | Drag it (it floats above a finger) |
| Place it | Space / Enter | A | Drop it, or tap the lattice after choosing |
| Powers | T L R B F | LB (Transmute), Y (Turn), RB (Strike) | The powers bar |
| Cancel / pause | Esc, P | B, Start | ❚❚ |

## Look and sound

- Palette: magenta, cyan, gold, violet, emerald, ember and starlight glyphs on near-black; blight is bruised purple with sick green veins.
- The board group is tilted 0.2 rad away from a straight-on perspective camera (fov 30). The content (lattice plus hand) is fitted into the screen rectangle left by the HUD and the powers with `setViewOffset`; portrait puts the hand below, landscape to the right, whichever gives bigger cells.
- Post: RenderPass → UnrealBloom (half resolution, threshold 0.62) → a lens pass (aberration, ripple, flash, vignette, scanlines, grain) → OutputPass. No tone mapping: ACES bleached the neon.
- Music: a look-ahead sequencer in D minor (Dm–B♭–F–C, 84 bpm) with a detuned saw pad through a lowpass that opens as the world is restored, a bass, an arpeggio that grows denser with resonance and play, and high bells once the world is more than half back. Effects answer sim events.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title with an attract bot, play, over, ending), the loop, input routing, events, progress (meta), debug hooks |
| `js/sim/game.js` | The rules: `newGame`, `act`, `step`, queries for the controller and the bot, `concede`, saves |
| `js/sim/pieces.js`, `js/sim/arcana.js` | Shapes and their unlocks; the 22 arcana, powers and omens |
| `js/sim/bot.js` | A one-move-lookahead bot with a skill dial and rescue logic |
| `js/play.js` | The controller: drag, tap-tap, keys and pad → commands; what the view previews |
| `js/view/` | `stage.js` renderer and post; `board.js` plate, blocks, sigils, ghost, hand; `fx.js` particles, shards, beams, rings, words; `backdrop.js` nebula, stars, rune rings, the wheel of cards; `cardart.js` the card painter; `view.js` layout, picking, events, the rekindling |
| `js/ui.js` | Screens, HUD, powers bar, banners, the deck, toasts, settings |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Key and pad queue, sound, guarded storage (reading, meta, settings), seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every shape, every rule, determinism and saves, and has bots at three skills play whole campaigns (readings until all 22 are rekindled, carrying embers). `browsertest.mjs` drives the real game by real mouse, keys and touches on desktop, touch-only phones in both orientations, and with storage blocked. `cards.html` shows every card on a neutral background.

## Balance notes

Bot table (`SEEDS=8`), readings to finish the Restoration / arcana rekindled in the first reading:

| Bot | Readings | First reading |
|---|---|---|
| skill 1 (best move, one-move lookahead) | 2.3 | 20.1 |
| skill 0.7 | 8.9 | 15.4 |
| skill 0.4 | 10.8 | 12.9 |

- Without embers the weak bot needed 52 readings: its first reading reached the 13th card, then every later goal had to be met from an empty board. Embers fixed the wall without making the early game easier.
- The perfect bot rekindles about 20 cards in one reading, so a strong human can nearly finish in one long sitting (an hour or more); most will take several readings. The Fool takes about a dozen moves, so the first rekindling comes quickly.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU (bloom and the lens pass have not been seen on a real GPU or a phone).
- Nobody has heard the music.
- Possible: a daily reading with a shared seed; a high-score table per arcanum.

## Changelog

### v1.0.0 (2026-10-30)
- First release: the lattice, 39 glyphs, resonance, sigils, blight, harmony, the creeping Void, sparks and five powers; the Restoration of 22 arcana with embers, an ending and an afterglow; Free Readings; a neon three.js view with bloom, a lens pass, particles, shards, beams, rings, a nebula, rune rings and a wheel of procedurally painted tarot cards; a rekindling cinematic; drag, tap-tap, keyboard and gamepad; a synth score; sim and browser test harnesses.
