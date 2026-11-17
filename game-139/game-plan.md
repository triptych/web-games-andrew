# CLEAN SLATE

**Genre:** Roguelike deckbuilder × Pyramid solitaire, with a story
**Engine:** three.js r165 (the card table), DOM screens; art by fal, music, effects and voices by ElevenLabs
**Status:** v1.0.0

---

## Concept

You were **Nightfall**, the deadliest blade in the five cities. You threw the knives in the river, bought a crumbling inn and
painted a fresh sign. Now everyone you ever crossed is coming by, one a night: to settle a score, to see if it's true, and,
mostly, secretly, to ask for a job.

Each night a rival deals **their past** onto your table as a Pyramid-solitaire layout, and you clear it with **your future**:
the deck of staff, food, keys and coin you are building. The game is self-aware (a dry Narrator knows it is in a game and
says so) and its one theme is in the rules: **the old ways work, and they cost you the life you are trying to build.**

Riffs on Pyramid solitaire (pairs that make 13), roguelike deckbuilders (draw a hand, telegraphed enemy intents, a market
between fights) and the "retired killer opens a small business" story.

## Core loop

1. **Letters.** Two rivals from this act write (the boss writes alone after three nights). Pick one to host.
2. **The night.** Their pyramid is dealt; you draw a hand. Pair to 13 until the pyramid is clear, or until your Resolve runs out.
3. **After.** Offer them a room (their signature card joins your deck) if they still trust you, or see them out for tips.
4. **The day.** Buy staff (cards) and one room (a run-long upgrade) with tips; do one chore: Rest, Polish a card, or Let one go.
5. Sometimes an **interlude**: a self-aware little scene with a choice.
6. Three acts (Soft Opening, The Busy Season, The Grand Reopening): three nights and a boss each. The last boss is Mother Thorn, the
   guildmaster who raised you. Win, and the ending depends on who you became.

## Mechanics

### The pyramid
- A rival deals 15 (act I), 21 (act II/III, bosses) or 28 (Mother Thorn) cards in a pyramid; the Grey Choir deals three small
  pyramids. Each card is covered by the two cards below it and is **open** once both are gone (`js/sim/layout.js`).
- The bottom `faceUp` rows start face up (the Notice Board room adds one); a face-down card turns up when it opens.
- Ranks are drawn from the rival's weighting: flat, high (10–K), low (A–4), or the Marrow Twins' sixes and sevens.

### Pairing (the one verb)
- **Two open rival cards** that make **exactly 13** settle together, free.
- **One of your cards + one open rival card** settle if they make **12, 13 or 14** (your cards meet them halfway; a card with
  *flex n* widens that by n). An exact 13 is a **Clean** pair: +1 Composure. The card you used fires its effect and goes to the
  discard pile.
- **Kings** settle alone (a rival King) or play alone for their effect (your King).
- **Tricks** (Old Habit, Hidden Blade) settle any open card alone.
- Each settle pays tips: 1, 1, 2, 2, 2, 3… by this round's streak; a **bounty** card pays 3 more.
- A **tainted** card hurts 2 when settled, unless you used a Hearth card (or a cut).
- Locked cards can't be used until the rival's next turn (a Skeleton Key unlocks them).

### A round
- Draw up to 5 (6 with the Snug). The discard pile reshuffles when the draw pile runs out.
- **Pour one out** once a round (twice with the Quiet Garden): discard a card and draw one. A poured **Grudge** is gone for the night.
- **End round**: a Grudge still in hand hurts 1; the rival does what their intent said (shown all round):
  `hit n` (Composure soaks it first, soothe lowers it), `grudge n` (Grudges shuffled into your draw pile), `lock n`,
  `muddle n` (open cards change rank), `drain n` (tips), `fluster` (one card fewer next round), `restock n` (cards back on the
  bottom row). Then Composure and soothe reset, the rest of the hand is discarded (cards that *stay in hand* are kept) and a new
  hand is drawn.
- Blows scale by act (×1.4, ×1.8, ×2.1, `RUN.hitScale`) and by Notoriety (+1 per 4).

### Blades, Notoriety and trust
- Every **Blade** card you use (Old Habit, Stiletto, Garrote, Throwing Knives, Hidden Blade, Nightshade) adds 1 **Notoriety**.
- Each rival has a **trust**: the most blades you can use on them and still be offered a partnership (0 for the Watch captain
  and the Grey Choir, 2 for Rook, 1 for most). Mother Thorn never stays.
- Captain Varr's **warrant**: each Blade also costs 2 Resolve in her night.
- **Let go** of a Blade on a day and Notoriety drops by 1.

### Endings
- **A Clean Slate**: 6+ partners and at most 2 Blades left in your deck.
- **Nightfall, Innkeeper**: Notoriety 10 or more (you won the old way).
- **Open for Business**: anything else.
- Resolve 0: *the innkeeper picked up the blade again.*

## Content

- **Cards** (`js/sim/data/cards.js`): a 14-card starter (5 Blades, 4 Hearth, 2 Coin, 3 Key), 16 market cards, 14 partner cards
  (one per rival), the Grudge. Polish adds +1 to each number (+2 Composure) or a draw.
- **Rivals** (`js/sim/data/rivals.js`): 15, each with a portrait, a letter, an intent cycle, a trait, a trust and four lines
  (arrive, cleared, accept, refuse).

| Act | Rivals | Boss |
|---|---|---|
| I Soft Opening | Brannoc Vell the Poisoner (taint), Sister Quell the Silent Knife (hidden rows, locks), Gideon Flint the Bounty Hunter (bounties, drain), the Marrow Twins (sixes and sevens) | Lady Corvina Ashgrove, the Critic you were once paid to kill |
| II The Busy Season | Big Moss the gentle muscle (high cards, big slow hits), Rook Daggett "Number Two" (trust 2), Madame Oriel the Cartomancer (muddles), Captain Isolde Varr of the Watch (warrant, trust 0) | The Grey Choir, your old crew (three peaks, trust 0) |
| III The Grand Reopening | Vesper Kane your apprentice, Dr Halvard Mott the Alchemist (taint 4), Penrose Tally the Auditor (drains), Garr Hollins across the street (restocks) | Mother Thorn, the Guildmaster |

- **Rooms** (`js/sim/data/inn.js`): the Snug, Wine Cellar, Big Kitchen, Quiet Garden, Notice Board, Great Fireplace, New Signboard.
- **Interludes**: nine, each with two choices (a sword in a stone in your cellar; a bard; a cat; the Narrator reminding you
  that this is where the mysterious merchant appears).

## Teaching the game

New players couldn't tell what to do on the table, so v1.1.0 teaches by doing ([js/coach.js](js/coach.js)):
- **The first night** runs five coach steps in a small panel at the top of the table: the open cards → a real pair (the cards
  glow gold and bob; [js/sim/hints.js](js/sim/hints.js) picks your own non-Blade card, an exact 13 first) → the rival's intent
  and Composure → pour one out and End round → winning and Blades. Steps that ask for an action advance when it happens, by
  any route; nothing blocks play and taps pass through the panel. Skippable; replayable from Settings.
- **One-time tips** the first time a Blade, Old Habit, a Grudge, your own King, a tainted, bounty or locked card appears, and one
  explanation line on the first letters, partnership offer and day. Remembered in the settings (`tips`, `tutorialDone`).
- **How to Play** in five short steps with a worked example; the ? button or H opens it from the table.

## Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Choose a card, then its partner | Tap / click | Arrows to move, Enter or Space |
| Play a King or a trick | Tap it, then tap again (King) or tap a rival card (trick) | Enter |
| End the round | End round | E |
| Pour one out | Pour one out, then a hand card | Q |
| Deck | Deck | D |
| How to play | ? | H |
| Cancel / pause | ❚❚ | Esc / P |

## Look and sound

- **The table** (`js/view/view.js`): a fal-painted oak tabletop under a warm hemisphere light, a key light and a softly breathing
  candle (slow, small: no flashing). The rival's fal portrait stands framed behind their pyramid. Cards are thin boxes with faces
  drawn into canvases (`js/view/cards.js`): your cards show their fal still life, rank badge, name and rules text; rival cards show
  a huge rank, the rival's sign and taint/bounty marks; backs are fal-painted (teal dagger-and-ladle for yours, oxblood rose for
  theirs). The camera fits the pyramid, the portrait and the hand between the HUD bars at any aspect.
- **Art** (`art/`, `dev/art/`): 51 WebP files, all fal `nano-banana-2`, one shared "antique tarot storybook" style prompt.
- **Audio** (`audio/`, `dev/audio/`): four ElevenLabs music themes (day, night, boss, ending), sixteen effects, and 42 voiced lines
  from sixteen voices (every rival's arrival and acceptance, Mother Thorn's last line, twelve Narrator lines).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, taps and keys → commands, events → view/sound/DOM, saving, debug hooks (`window.__cs`) |
| `js/sim/game.js` | Pure rules: `newGame(seed)`, `act(G, cmd)`, `legalMoves`, `canPair`, `serialize`/`deserialize` |
| `js/sim/bot.js` | The auto-player (skill and blade policy) and `playRun` |
| `js/sim/layout.js` | Pyramids: who covers whom, positions |
| `js/sim/data/*.js` | Cards, rivals, rooms, interludes, the Narrator, endings |
| `js/view/view.js`, `js/view/cards.js` | The three.js table; card face textures |
| `js/ui.js` | DOM screens, HUD, toasts, story dialogs |
| `js/audio.js`, `js/media.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound, the media list, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (570 checks) proves purity, every media file the data names, every rule, determinism
and save round trips, and runs whole runs with the bot at three blade policies and two skills, asserting the balance bands.
`browsertest.mjs` plays the real game in Chromium on desktop, two touch-only phones and with storage blocked.

## Balance notes

The bot plays the real `act()` commands. 24 seeds a row (`SEEDS=24 ONLY=bot node game-139/dev/simtest.mjs`):

| Blades | Skill | Win % | Partners | Rounds a night | Endings |
|---|---|---|---|---|---|
| never | 1 | 96 | 10.7 | 3.6 | all Clean Slate |
| trust | 1 | 92 | 10.6 | 3.1 | all Clean Slate |
| always | 1 | 75 | 0.3 | 2.1 | all Nightfall |
| never / trust | 0.8 | 29 / 33 | ~7.7 | ~5.3 | Clean Slate |
| always | 0.8 | 13 | 0.2 | 3.9 | Nightfall |

- **Exact 13 only was unplayable.** With each rank appearing about once in the starter deck, the first bot sat on two open 4s for
  ten rounds (15 rounds a night). Your cards now meet the rival within one (12–14) and an exact 13 is rewarded as a Clean pair.
- Rival blows were scaled by act until a perfect bot that respects trust wins about 9 in 10 runs and a skill-0.8 bot about 1 in 3.
- Blades are the fastest way through a night (2.1 rounds) but blows grow with Notoriety, partners refuse, and the good ending
  closes: the "always" bot is the only one that ever gets Nightfall.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, SwiftShader is not a GPU, and nobody has listened to the voices in order.
- "Open for Business" is reachable (fewer than six partners, few blades) but the bots never land in it; a mid-skill human probably will.
- The economy floods late (tips pile up); a late-run sink (more rooms, pricier market) would help.

## Changelog

### v1.1.1 (2026-11-17)
- The title painting was a torn-paper picture laid over a strip of sky, so the sky seemed to cut across the houses; it is now one
  seamless painting (regenerated with fal), framed on the innkeeper and the blank sign on a portrait phone.

### v1.1.0 (2026-11-16)
- A first-night tutorial with a glowing suggested pair, one-time tips for new things, phase-screen explanations, a rewritten
  How to Play with a worked example, a ? button and H key, tutorial settings. Tests: the hints section in simtest, the tutorial
  followed and skipped in browsertest.

### v1.0.0 (2026-11-16)
- First release: Pyramid-solitaire nights against 15 rivals over three acts, pairs to 13 within one with Clean pairs, kings and
  cuts, telegraphed intents (hits, Grudges, locks, muddles, drains, fluster, restocks), taint, bounties and warrants; Blades,
  Notoriety and trust; partnerships, the market, seven rooms, three chores, nine interludes and three endings.
- three.js card table with fal art (51 pictures) and ElevenLabs music, effects and 42 voice lines.
- `dev/simtest.mjs`, `dev/browsertest.mjs`, `dev/play.mjs`, `dev/preview.mjs`; art and audio pipelines in `dev/art/`, `dev/audio/`.
