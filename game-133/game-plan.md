# Lanternhall

**Genre:** fantasy visual novel with mini-games and light idle elements: a guild-desk management sim with five romances
**Engine:** vanilla HTML/CSS/JS, DOM rendering. Sim/view split: a pure seeded simulation in `js/sim/`; the UI reads `G` and drains `G.events`
**Media:** every picture painted with fal (`fal-ai/nano-banana-2`); the music, effects and voices by ElevenLabs
**Status:** v1.1.0

---

## Concept

Brightmoor is a city built around a lamp: the brass lantern on the roof of Lanternhall, the Adventurers' Guild, lit
four hundred years ago and never allowed to go out. You arrive as the new **Apprentice Clerk** at the quest desk
(you choose your name and whether people call you she, he or they). Thirty days later the guild needs a new
Guildmaster.

Each day you hear petitioners (townsfolk, other adventurers, the Crown, the Wild Folk), **grade** how dangerous
their trouble is from what they say, **send** the right adventurers (twelve of them, Copper rookies to a Platinum
legend), and spend the afternoon visiting someone or working one of the guild's rooms in a **mini-game**. Good
work earns merit and promotion; four factions decide whether to trust you; a debt, a Chancellor, a dragon and a
grey mist called the Gloam decide what kind of Guildmaster, if any, you become. **Sixteen endings**, five
romances.

It riffs on quest-board anime and desk-job sims (*Papers, Please* without the cruelty), on raising-sim visual
novels (it copies the script engine of [game-127](../game-127/)), and on the repo's own mini-games.

## Core loop: one day

1. **Morning: the desk.** Two petitioners wait (three with a better Notice Board). Each speaks; you grade the job
   Copper to Platinum; it goes on the board. Reports from parties that came home overnight are on the desk.
2. **The board.** For each posted job pick one to three ready adventurers. They are away for the job's days.
3. **Afternoon: the guild.** Two free actions (three as Vice-Guildmaster): visit one of five people, or play a
   mini-game. Collect the tavern till (it fills in real time, up to a daily cap). Improve rooms with gold.
4. **End the day.** Pell's ledger grades the day (S to F) against what he expected. Unheard petitioners and expired jobs cost trust; upkeep goes out, tavern takings and vault
   interest come in, idle adventurers drill in the yard; parties due home resolve.

Story scenes play on set mornings. Reviews on days 7, 13, 19 and 25 promote you if your merit is enough. Day 28 is
the raid on the Hollowdeep, day 29 the vote, day 30 the crossroads, and the thirtieth night an ending.

## Mechanics

### Grading (the Handbook)

A petition's words name a **creature** (five tiers, 0–4), a **number** (one / a few / a great many: 0–2), a
**place** (near town / the wilds / cursed ground: 0–2) and, from day 13, an **omen** (none / ill signs / the
Gloam: 0–2). Threat is the sum; **every two points is a rank** (Copper 0–1 … Platinum 8+). The in-game Handbook
is exactly the data tables. A right grade earns 1 merit. A wrong one costs that petitioner's trust (and merit, if
it is two or more out). You are not told: the party's report says "you posted it Bronze; it was Silver work".

- Posted too **low**: the party walks into a harder job than the odds they were shown.
- Posted too **high**: the client disputes the bill and pays three quarters of the true fee.

### Sending a party

Power = Σ (rank power [6, 10, 16, 25, 38] + 2 × the member's stat for the job's kind: Might, Wits, Arcana,
Stealth). Chance = 0.5 + (power − difficulty[rank]) / (10 + 6 × rank), ±10% for a healing draught, +5% and a day
sooner for a chart, clamped to 5–97%. A roll under the chance is a win (fee, renown, merit, trust with that
kind of petitioner, experience); within 0.25 above it is half done (half fee); otherwise a failure (trust and
renown lost, the party hurt for 2 + rank days, less a day per Infirmary level). Experience raises an
adventurer's rank; a rank-up is merit for you.

### Your ladder

Apprentice Clerk → Desk Clerk (merit 18) → Senior Clerk (42) → Quest Officer (70) → Vice-Guildmaster (100), one
step per review (a missed step can be caught up at the next). **Guildmaster** is by vote on day 29: you must be
Vice-Guildmaster and have three of five voices: Townsfolk, Crown, Wild Folk and Fellowship at trust 50+, and
Orla's own (an honest ledger at 50+).

### Friendship and romance

Kael (Gold swordsman), Seraphine (Silver elven mage), Bram (the tavern's cook), Nyx (a catfolk "courier") and Ren
(the Crown's envoy, they/them). A visit costs an action and raises affection; when affection and the day allow
(6/20/36/54 from days 2/8/14/20) the visit plays that person's next of four heart events. The fourth can end in a
confession; one partner only. A partner adds an epilogue to most endings and opens the Hearth ending.

### The five mini-games (one action each)

| Game | Room | Rules | Reward |
|---|---|---|---|
| **Stamp Rush** | your desk | Eight forms, 45 s: approve only with seal, signature, fee, party rank ≥ job rank, and a countersign on cursed ground. Three mistakes ends it | merit ⌊right/3⌋ − wrong, 2 gold a form |
| **The Cauldron** | Infirmary | Watch a recipe of 3, 4, then 5 ingredients; repeat it | a healing draught per recipe |
| **Cartography** | Map Room | Walk a 6×5 map from start to flag within the supplies (best route + 2) | a chart (two for the best route), 1 merit |
| **Dragon's Hoard** | the Tankard | Three rounds of two dice: each roll adds to the pot, a one loses the pot, two ones lose what you banked | the banked gold (stake 10) |
| **The Sparring Ring** | Training Yard | Five exchanges: read the adventurer's tell, answer strike/guard/feint. Silver and up sometimes give nothing away | experience for them |

### The raid (day 28)

Choose up to five ready adventurers. Strength = Σ [1, 2, 4, 7, 11] by rank + healing draughts (up to 3) +
Vesperax (6, if you kept the compact; −3 if you posted her bounty) + royal lancers (4, Crown trust 55+) + fae
guides (3, Wild 55+) + militia (2, Town 55+) + you (2, if you chose to go down). 36+ relights the Deep Lantern
cleanly; 27+ does it at a cost (the party hurt, Fellowship −10); less is the Ruin ending.

### Light idle elements

The tavern till fills at a coin every three seconds of real time at the desk, up to a daily cap; rooms pay in
every night (tavern takings, vault interest, yard drill); parties are away for days while you do other things.

## Story

Five chapters of six days. **The New Clerk** (meet Orla, Pell, Bram, Kael, Sera, Nyx; Moss the brownie asks the
guild to hear the Wild Folk) · **Copper and Bronze** (first review; the rookies want a Bronze job; the Chancellor
and the envoy; the bell in the mill-race) · **The Audit** (omens begin; Malvane's purse; the 400 gold debt: pay,
ask for time, cook the books) · **The Gloam** (refugees from the wild at the hall doors; Vesperax the dragon
posts a quest and the Crown posts her bounty; Orla falls) · **The Deep Lantern** (last review; the eve; the raid;
the vote; the crossroads).

### Endings (first rule that holds wins)

| # | Ending | Earned by |
|---|---|---|
| 1 | Struck from the Ledger | a bribe or false books, and honesty 32 or less on day 29 |
| 2 | The Lantern Goes Out | losing the raid |
| 3 | Sold for Scrap | asking for time on the debt and not having 500 gold on the last night |
| 4 | Emissary of Embers | the dragon's compact, Wild trust 65+, and saying yes at the crossroads |
| 5 | Legend of the Road | going down yourself, winning, and taking the north road |
| 6 | Hearth and Home | a partner at affection 70+, not Guildmaster, and leaving together |
| 7 | The Iron Charter | Guildmaster, having taken the purse |
| 8 | The Gilded Ledger | 1,200+ gold and honesty under 45 |
| 9 | **The Golden Lantern** | Guildmaster, a clean raid, Town, Crown and Wild all 50+ |
| 10 | Teacher of Heroes | Guildmaster with three Platinum adventurers |
| 11 | Warden of the Wild Accord | Guildmaster, the compact, Wild 75+ |
| 12 | By Royal Charter | Guildmaster, Crown 60+ |
| 13 | The People's Guildmaster | Guildmaster, Town 85+ |
| 14 | Keeper of the Lamp | Guildmaster |
| 15 | The Steady Hand | Vice-Guildmaster (declined, or lost the vote) |
| 16 | The Quiet Desk | anything else |

## Controls

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Next line | Enter / Space | tap the text box or the picture |
| Choose | 1–4 | tap the answer |
| Auto · skip · history | A · Tab · L | the buttons over the box |
| Tabs at the desk | 1–4 | tap |
| Handbook · menu | H · Esc | 📖 · ☰ |
| Stamp Rush | Y / N | Approve / Reject |
| The Cauldron | 1–4 | tap the ingredient |
| Cartography | arrows / WASD | the d-pad |

## Look and sound

Painted storybook-anime art in amber, gold, teal and plum: 12 backdrops, 14 characters in four expressions each
(cut from 2×2 sheets), 30 bust portraits (the six unnamed adventurers and 24 petitioners), 20 story and ending
pictures and a title painting; see [dev/art/README.md](dev/art/README.md). Eight 60-second music tracks, 18
effects and 20 voiced greetings; see [dev/audio/README.md](dev/audio/README.md). A small Web Audio synth stands
in for any sound that fails to load.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, title/game/ending, sends commands, drains events to UI/VN/audio, keys, the frame loop, debug hooks |
| `js/sim/game.js` | `newGame`, `act(G, cmd)`, `step(G, dt)`, the day, quests, visits, the raid, `serialize`/`deserialize` |
| `js/sim/scene.js` | The scene runner (from game-127): walks a script, keeps the stage in `G.scene` |
| `js/sim/rules.js` | Effects, conditions, experience, the vote, the ending rules |
| `js/sim/petition.js` | Deals petitions from the Handbook tables; `readPetition(text)` reads one back |
| `js/sim/minigames.js` | The five mini-games as state machines in `G.mg` |
| `js/sim/bot.js` | An auto-player with one route per ending |
| `js/sim/data/` | `story.js`, `hearts.js`, `endings.js`, `cast.js`, `adventurers.js`, `quests.js`, `media.js` |
| `js/vn.js`, `js/ui.js`, `js/ui/mini.js` | The painted stage and dialogue box; the desk, tabs, sheets; the mini-game screens |
| `js/audio.js`, `js/assets.js`, `js/voices.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound, art paths, the voiced-line list, guarded storage, seeded RNG, tuning |

**Commands** (`act`): `next`, `choose`, `call`, `grade`, `decline`, `assign`, `heal`, `visit`, `play`, `mg`,
`mgclose`, `upgrade`, `till`, `paydebt`, `raid`, `endday`. **Events**: `day`, `night`, `petition`, `posted`,
`declined`, `assigned`, `report`, `rankup`, `promoted`, `partner`, `fx`, `sceneStart`, `sceneEnd`, `music`, `sfx`,
`cg`, `choose`, `mgstart`, `mgdone` (and one per mini-game beat), `upgrade`, `till`, `healed`, `debtpaid`, `raid`, `over`.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (258 checks): purity; every script linted (labels unique,
every backdrop, picture, tune and effect listed and on disk); the rules; 2,000 petitions read back from their
words; 60 route maps solved; determinism and save round trips on four days, mid-scene and mid-mini-game; **every
one of the sixteen endings reached by its route through real play**; whole games at three skills with invariants.
`browsertest.mjs` drives the real page on desktop, two touch-only phones and with storage blocked.

## Balance notes (found by the bot)

| skill | rank | merit | gold | wins | fails |
|---|---|---|---|---|---|
| 1.0 | 5.0 | 264 | 244 | 51 | 0.1 |
| 0.6 | 4.8 | 180 | 138 | 46 | 3.0 |
| 0.3 | 3.9 | 129 | 189 | 41 | 6.0 |

- The first table had the careful bot ending with 3,000–5,000 gold, every trust at 100 and four times the merit
  it needed: fees were cut by a third, upkeep doubled, trust per win cut to 1–3, merit per grade to 1.
- Grading every job two ranks too high made 11,000 gold (the fee followed the posted rank). An overcharged
  client now pays three quarters of the true fee.
- Town trust saturates by sheer volume of townsfolk, so "the faction that trusts you most" always said Town; the
  faction endings use their own thresholds (Wild 75 with the compact, Crown 60, Town 85) in that order.
- The Golden ending first asked for 60 in all three; an honest, compact-keeping clerk reached Crown 47. It now
  asks for 50 (the vote line), the compact costs Crown 5 not 8, and paying the debt earns 8.

## Open questions / next steps

- Balance was tuned by a bot, and the game has only been run in headless Chromium: a person should play a month.
- Only the visit greetings are voiced (20 lines); the story is not.
- The clerk never appears on stage (only from behind in pictures), so the gender choice changes words, not art.

## Changelog

### v1.1.0 (2026-11-13)
- Added: the nightly assessment ("Pell's ledger"). `assessDay` scores the day out of 100 as a weighted average
  (graded true 40, jobs sent 20, parties' results 20, free actions 10, merit against `MERIT_PACE` 10) of the
  parts that applied, and gives a letter (S 95, A 85, B 70, C 55, D 40, F). `G.lastDay` holds it; `G.gradeSum` /
  `G.gradeDays` the month's average.
- Fixed: the Cauldron never lit the first ingredient of a recipe, so the first click always failed. The browser
  test now reads the recipe off the screen.

### v1.0.1 (2026-11-13)
- Fixed: the "spar with" drop-down was an unstyled white box with pale text. All selects and text fields share one style now; the browser test checks it.

### v1.0.0 (2026-11-13)
- First release: thirty days in five chapters (20 story scenes), 12 adventurers, petitions graded from their
  words, parties and reports, five mini-games, five romances with four heart events each, the raid, the vote,
  sixteen endings and five epilogues, three save slots and an autosave, an endings album.
- Art by fal (87 files), audio by ElevenLabs (8 tracks, 18 effects, 20 voiced lines).
