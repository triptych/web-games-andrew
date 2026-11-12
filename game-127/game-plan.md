# The First Dragon Prince — game plan

**Genre:** raising sim with visual novel scenes, in the tradition of the "raise a child for eight years" games.
**Engine:** vanilla HTML/CSS/JS, DOM rendering (no canvas except the title embers). Sim/view split per the
scaffold skill: a pure seeded simulation in `js/sim/`, the UI only reads `G` and drains `G.events`.
**Media:** every image generated with fal, every sound, track and voice with ElevenLabs.

## The story

For three hundred years Aurelmere and the dragons of the Peaks were at war. Prince Aldric walked unarmed into the
dragons' camp to ask for peace and fell in love with Ysolde, the Ember Queen. He died defending the treaty; she
poured her fire into the Heartstone to end the war, and did not wake. Their egg hatched ten years later.

The old King gives the boy to **you**, the Warden of Cinderford, to raise. On his eighteenth hatch-day the court
will judge what he has become.

## The month

1. **Free Day** (3 actions): visit a friend at their place (with a gift), talk with the prince (praise, scold, ask
   how he feels, talk about his mother, ask about the future), gossip or petition at court, pray or donate, a
   play, feed the Rookery orphans, consult the Archmage. Shopping and the quest board cost no action.
2. **Plan** three ten-day periods from 12 lessons (cost gold), 13 jobs (earn gold), 3 kinds of rest (one a summer
   holiday), accepted quests (29 on the Guild Hall board) and expeditions to 6 regions.
3. **Run** each period: a vignette, a result line, stat changes. Stress above 50 spoils lessons; above 62 he may
   run off; at 100 he falls ill; above 60 it feeds his Draconity.
4. Yearly: the hatch-day, the spring audience with the King, the **Harvest Festival** (5 contests against named
   rivals) and **Starfall Night** (watch the stars with a friend).

**Expeditions** are four encounters (three of five per region, then its master). Each offers approaches (Fight,
Spellcraft, Talk, Sneak, Dragonfire, Pray), each rolled on its own stat mix against the region's difficulty.
Each danger and master has its own painted creature (`art/foe/<region>-<n|boss>.webp`), shown above the choices.

## Stats

Strength, Vitality, Combat · Intellect, Magic, Eloquence · Grace, Charm, Artistry · Morality, Faith, Bond ·
Commerce, Cunning · Renown, Royal Favor · Draconity, Stress. Trained gains shrink as a stat grows
(`gain × max(0.12, 1 − v/135)`); Renown, Favor, Morality, Draconity and Faith climb freely to 50 and slowly past it.

## The heart

Six childhood friends, each met in a story scene, each with a place, tastes (loves/likes/hates among 16 gifts),
stats they admire, and **four heart scenes** opening at affection 15/35/55/72 and ages 11/13/15/17. The fourth is a
confession; accepting it betroths them (one partner). Plus a Starfall scene per friend (young and grown).

- **Isolde Varre**, the Duke's daughter: sharp, proud, the best young fencer in the capital.
- **Rowan Hale**, the Captain's son: a squire who wants to be a knight from the songs.
- **Pip Thistlewood**, a Rookery thief who looks after eleven orphans.
- **Theo Marchbank**, the Spire's youngest apprentice.
- **Saffi al-Rashid**, the Qasiri envoy's daughter: dancer, trader, traveller.
- **Lumi of the Frostpeaks**, a young frost dragon.

## Story

15 story scenes from 10 to 17 (the meetings, the first flame, the Duke's petition, the wings, the assassin's
test, the Elder Wyrm, the Heartstone, the King's illness, war at the border, the Duke's plot), with choices that
set flags and stats. Then the coming of age, the ending, and an epilogue with the betrothed (a royal wedding if
he becomes King).

## Endings (18)

The First Dragon King (needs a partner), The Crown Prince of Two Bloods, Archmage of the Spire, Ambassador of Two
Worlds, Knight-Commander of Aurelmere, Merchant Prince of the Golden Harbor, Star of the Moonlit Stage, The Dragon
Overlord, The Hush's Blade, Saint of the Ember Flame, The Royal Sage, Lord of the Dragon Peaks, The Wandering Hero,
Warden of the Wild, The Dragonfire Smith, A Quiet Hearth, and two bad endings: The Caged Ember (the tower) and
The Empty Nest (he runs away). Every
career ending has stat minimums (some maximums, counts or flags); the best-cleared one wins.

## Balance (the bot)

`sim/bot.js` plays one route per ending. With 3 seeds each, every route reaches its own ending 3/3 except the
diplomat (1/3: the other two seeds reach King and Crown Prince, which share most of its requirements).

| route | hits | | route | hits |
|---|---|---|---|---|
| king | 3/3 | | assassin | 3/3 |
| crown | 3/3 | | priest | 3/3 |
| archmage | 3/3 | | scholar | 3/3 |
| diplomat | 1/3 | | dragonlord | 3/3 |
| warrior | 3/3 | | adventurer | 3/3 |
| merchant | 3/3 | | ranger | 3/3 |
| entertainer | 3/3 | | smith | 3/3 |
| overlord | 3/3 | | quiet | 3/3 |

Early runs saturated every stat by 15 (all routes ended King); the fixes were a global gain scale of 0.45, a lower
stipend, softer reputation above 50, halved quest reputation and smaller expedition purses.

## Modules

| File | Role |
|---|---|
| `js/sim/game.js` | `newGame`, `act(G, cmd)` for every phase, `serialize`/`deserialize` |
| `js/sim/scene.js` | the scene script runner (`@bg @cg @music @sfx @show @hide @fx @if @goto`, choices) |
| `js/sim/scenes.js` | builds any scene from its id and arguments (so saves hold only a pointer) |
| `js/sim/rules.js` | gains, effects, conditions, checks, ending selection |
| `js/sim/bot.js` | the route bot |
| `js/sim/data/*.js` | cast, activities, items, quests, regions, places, story, hearts, events, endings |
| `js/vn.js` | stage (backdrop, CG, portraits) and dialogue box: typing, voice, auto, history |
| `js/ui.js` | HUD, every phase panel, status, album, save slots |
| `js/main.js` | boot, commands, events, replays, input, debug hooks |
| `js/audio.js` | music, effects, voices, synth fallback |
| `js/save.js` | autosave + 3 slots, settings, the album (kept across games) |

## Album

Every story, heart, grown Starfall, festival-win and ending scene is recorded when it finishes. The album replays
any of them on a sandbox copy of the game (`replay: true` skips effects), so watching never changes a save.
It also has the CG gallery (68), the endings list (18, with hints for locked careers) and a music room.

## Testing

See [dev/README.md](dev/README.md): `simtest.mjs` (807 checks), `browsertest.mjs` (desktop, two touch phones,
blocked storage), `play.mjs`.

## Changelog

- **1.0.0** First release.
- **1.0.1** The dialogue box shows after the month's last result: Continue into a month that opens with a story scene left a blank backdrop.
- **1.1.0** Expedition creatures: a painted cutout for each of the 30 dangers and 6 masters, reacting to each outcome.
- **1.1.1** Round portraits frame the face (some, like Isolde's, were cut off at the top).
