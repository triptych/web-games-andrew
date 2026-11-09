# ARCANA WAGON

**Genre:** First-person narrative adventure: a fortune-teller sim with a mystery plot and a romance subplot
**Engine:** three.js r165. Sound, cards, symbols and the wagon are made in code; the eleven named characters are rigged Meshy models and the title, ending and portrait art is fal-generated (v1.1.0, see dev/assets/README.md and art/README.md)
**Status:** v1.1.0 complete: seven days, 21 readings, four endings, three romances

---

## Concept

You are a new fortune-teller who has inherited Madame Orla Vesper's wagon. From your seat at a round table you meet
the people of Hollowmere as they come to the door. The crystal ball shows three visions, a **symbol** in a **colour**;
you lay three tarot cards to answer them, and say what you see. You must *learn the language of the universe*:
what the symbols mean, what the colours promise, what an omen in the room is telling you. Over seven days the Second
Prince comes to you in secret, because his brother Aldric is plotting to kill the King at the Harvest Moon Fair, and
the clues are in the worries of ordinary people: an apothecary, a courier, a captain, a cupbearer, a veiled lady.

It riffs on *Papers, Please* (the desk, the line of people, the rules you learn), *Coffee Talk* (small stories told
across a table), *Persona* (a calendar of evenings and relationships) and the tarot itself.

The look: a first-person view across a round table in a barrel-vaulted wagon, jewel colours (plum, magenta, teal,
gold) under a striped canopy, candle and lantern light, bloom, dust motes, a window onto a village sky that changes
from dawn to night. The cards, symbols and faces are all drawn in code.

## Core loop (one guest, about three minutes)

1. **Arrive.** A knock, the door, steps; they sit. They speak. What they say is a clue: their worry is *what is now*,
   and the way they ask hints at how they want to hear it.
2. **Gaze.** The ball shows **Past, Present, Future**, each a symbol in a colour. A clouded vision shows only its
   colour. An **omen** follows (petals, a raven, thunder...); it speaks for the first clouded vision.
3. **Focus** (optional). A charge clears a clouded vision. You have 1 to 3 a day, by rank.
4. **Draw.** Six cards: a perfect answer for each vision, a false lead or two (the right matter the wrong way up), and
   fillers.
5. **Lay** three cards, one per vision. 6. **Speak** in one of three styles. 7. **Result**: 0-3 stars, what you learned,
   insight, a clue, affection. The guest reacts and leaves.

After the last guest of the day comes **dusk**: one evening to **study** (three new meanings, +15 insight) or to
spend with someone. On the nights of days 2, 4 and 6 the Second Prince comes, after your evening.

## Mechanics

### The language

- **12 themes**: love, loss, wealth, betrayal, journey, health, family, ambition, secrets, danger, change, hope.
- **24 symbols**, two per theme, each drawn as a glowing glyph (heart, twin rings, teardrop, wilted rose, coin, gem,
  dagger, two-faced mask, ship, compass, leaf, serpent staff, house, rooted tree, crown, mountain, key, eye,
  lightning, wildfire, hourglass, moth, star, rainbow).
- **8 colours**: four **boon** (Gold, Emerald, Azure, Pearl) and four **bane** (Crimson, Ember, Umbra, Bile).
- **12 omens**, one per theme (drifting petals, gutter and sigh, bright chimes, the raven, the creaking road, green smoke,
  the old clock, the tall flame, whispering curtains, far thunder, the turning page, the sunbeam), each with its own
  effect in the room and its own sound.
- **22 cards** (the Major Arcana), each carrying two themes. **Upright is a boon, reversed a bane.**
- Orla's journal starts you off with one symbol for every theme, three colours and four omens. The rest is learned:
  after each reading the symbols, colours and omen you met are written into the **Codex**.

### A reading

The fate is three **beats** `{ theme, tone }` (past, present, future); a guest's *worry* is always one of them.
A card scores **2** on a beat if it carries the theme and lies the right way up, **1** if only the theme, **0**
otherwise. Total 0-6, stars: 0 / 1-2 / 3-4 / 5-6 = 0 / 1 / 2 / 3. (A reading of the hand's design is checked in
`simtest.mjs`: a perfect spread is always in the hand, along with a false lead.)

### Style

Guests prefer to hear it **plainly**, **gently** or as **a grand show**, and hint at which in their opening words.
Matching earns +4 insight, +1 renown, a warmer reply and, for the three villagers, a heart.

### Rank and Focus

| Rank | XP | Name | Focus/day | Perk |
|---|---|---|---|---|
| 1 | 0 | Fledgling Seer | 1 | |
| 2 | 50 | Wagon Seer | 2 | |
| 3 | 150 | Reader of Veils | 2 | every omen is understood |
| 4 | 290 | Oracle of the Road | 3 | one fewer false lead in the hand |
| 5 | 460 | Arcanist Royal | 3 | all the colours of fate are known |

XP per reading: 8 + 6 per star + 4 for a matched style + 3 per new meaning; +15 for an evening of study.

### Clouded visions

A clouded vision hides its symbol (its colour still glows). Three ways in: the **omen** (always the first clouded
beat's theme), the guest's **worry** (always a beat), or a **Focus**. Villagers have 0 clouded visions on day 1, 1 on
days 2-5, 2 on days 6-7. The grand reading is clouded in proportion to the clues you are missing.

### The plot

Five clues, each a reading with a stars-2 threshold:

| Clue | From | Also from |
|---|---|---|
| The Nightshade Ledger | Mirabel Fenn, day 2 | her third evening |
| Secret Orders | Oswin Pike the courier, day 3 | Elias's third evening |
| The Hollow Watch | Captain Hester Crowe, day 4 | Wren's third evening |
| The Cupbearer's Purse | Bram Ottley, day 5 | |
| The Envoy's Gold | Lady Seraphine Vane, day 6 | |

On day 7 the Prince asks for a **grand reading**. `plot = clues + grand stars` (0-8):
**7+** The Crown's Oracle · **5-6** A Quiet Victory · **3-4** A Near Thing · **0-2** The Black Feast.

### The romance

Three people you can spend evenings with: **Elias Thorne** (blacksmith-poet, gruff and shy), **Mirabel Fenn**
(apothecary, sceptical and tender), **Wren Quill** (minstrel, they/them, restless and charming). Each has four evening
scenes (three answers worth 0, 1 or 2 hearts-halves; the best is the one that suits them), plus a quiet evening, plus
their readings (a three-star reading is +2, a matched style +1). You get six evenings, minus whatever you spend
studying, so loving one person means choosing. At the festival you pick who to watch the fireworks with. Affection
`>= 9` is a sweetheart, `>= 13` is love; less is a friend. The third scene of each carries a clue.

## Content

### Guests

Day 1 (only what Orla taught you, no clouds): Granny Marta (loss / family / hope), Pip Dunmore (change / journey /
danger), Elias Thorne. Day 2: Mirabel, a villager, **the Hooded Stranger** (Prince Caspian in disguise). Day 3: Oswin,
Wren, a villager. Day 4: Captain Hester, Elias again, a villager. Day 5: Bram, Wren again, a villager. Day 6: Mirabel
again, Lady Seraphine, a villager. Day 7: two villagers, then **the grand reading**. Villagers are made from the day's
seed: a name, a trade, a look, a worry (two openers a theme), a favourite style and four reactions.

### Prince Caspian

Three night visits (days 2, 4, 6). Your answers move his **trust** (0-8), which only colours the ending screen.

## Look and sound

- **Palette:** plum `#2e1658`, magenta `#a31f5a`, teal `#17737c`, gold `#e8c14a`, each colour of fate glows in the ball.
- **Camera:** your seat. It leans to the guest, to the ball (the face of a vision), to the cards. Portrait phones get a
  wider fov and a camera that sits back.
- **Models** (`view/people.js`, `view/stage.js`): a lathe-turned robe, arms, a head with eyes that blink, brows and a
  mouth that follow a mood, six hairstyles, seven hats (kerchief, cap, wide-brimmed with a feather, helm, veil, hood,
  circlet), a beard and glasses; walk-in along a curve from the door, a sit, a head that tracks you. The wagon: barrel
  vault with ribs, wallpaper, shelves of glowing jars, crystals, a hung tapestry, a back wall with a real door that
  swings and an arched window onto a sky that is redrawn for dawn, day, dusk and night (and strung with lanterns on
  festival day), a round table with an embroidered cloth, three card sigils, candles, incense, the journal, the deck.
- **The crystal ball** is a shader (fresnel rim, swirling noise tinted by the latest vision) with sprite glyphs inside.
- **The cards** (`view/art.js`) are drawn in 360×620 canvas: an ornate frame, numeral, a picture window with a scene
  for each of the 22 (a sun with a face, a hanged man, a tower struck by lightning...), the name and its two themes.
- **Omens** each have a visible effect in the room and a sound.
- **Sound** (`audio.js`): a look-ahead score (pad, bass, plucked arpeggio, glass bells, a soft drum) in five moods
  (calm, ball, night, tense, festival, title); effects for knocks, doors, steps, visions (boon rings clean, bane rings
  dissonant), every omen, cards, stars, clues, hearts, fireworks.

## Controls

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Continue | click or tap the box | Space / Enter | A |
| Choose / lay a card | click or tap | 1-9 | d-pad, A |
| Take a card back | click its place | Backspace | |
| Focus a clouded vision | the Focus button | F | |
| Codex | the book | C | Y |
| Pause | ❚❚ | Esc / P | Start |

A click or tap on the dialogue box first finishes the typing, and only then goes on. Choices appear after the line
has been typed and ignore a tap for half a second, so a tap that finished the typing cannot also answer.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the title/play modes, the clock, input routing, saves, debug hooks |
| `js/sim/game.js` | The story machine: phases, `act(G, cmd)`, `step(G, dt)`, serialize |
| `js/sim/reading.js` | Pure: fate, visions, the hand, scoring, lessons |
| `js/sim/bot.js` | Auto-player: perfect, learner, random |
| `js/sim/data/lexicon.js` | Themes, symbols, colours, omens, the 22 cards, ranks of knowledge |
| `js/sim/data/story.js` | Prologue, days, guests, clues, the Prince, the grand reading, the endings, villager text |
| `js/sim/data/romance.js` | The three candidates, their scenes and festival nights |
| `js/view/view.js` | The three.js view: camera, people, ball, cards, hands, lights, omens, fireworks |
| `js/view/stage.js` | The wagon and its props, the particle system |
| `js/view/people.js` | Procedural guests with faces, moods, hair, hats |
| `js/view/art.js` | Every glyph and card face, drawn in canvas |
| `js/view/textures.js` | Wallpaper, floor, rug, cloth, canopy, tapestry, the sky |
| `js/ui.js` | Dialogue, visions, the hand, results, evening and ending screens, Codex, HUD |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Key/pad queue, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the lexicon, readings, every story file, the rules,
determinism and save round trips, random-command fuzzing, and has three bots play whole games. `browsertest.mjs` drives
the real game on desktop, two touch-only phones and with storage blocked, reading pixels back so a black canvas fails.

## Balance notes

The bot, at three skill levels, set the numbers (`node game-121/dev/simtest.mjs`, 12 seeds):

| | clues | grand | rank | 3-star readings |
|---|---|---|---|---|
| perfect | 5.0 | 3.0 | 4.0 | 21 / 21 |
| learner | ~4.9 | 3.0 | 4.0 | ~18 / 21 |
| random | 1.0 | 0.6 | 3.1 | ~1 / 21 |

- A first draft had ranks at 40 / 110 / 210 / 340 and a perfect seer reached the top at reading 12; they are 50 / 150
  / 290 / 460 now, so the Arcanist rank arrives around day 5.
- Affection first granted "sweetheart" at 6, and a perfect seer earned it with all three villagers from readings alone;
  the thresholds are 9 and 13, so only someone you spent evenings with can reach them.
- The learner is nearly as good as the perfect seer by day 3 because it studies every evening and every reading teaches
  three meanings. The challenge for a person is reading the clouded visions, the guests, and choosing who to love.
- Random play finds two clues by luck (the clue threshold is two stars, and a random hand sometimes gets there) and
  ends in `A Near Thing` or `The Black Feast`.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU (bloom is off there).
- Minor Arcana and a longer campaign; more guests per day; a fourth candidate.
- The Prince's trust only changes the ending screen's stat; it could decide a late scene.

## Changelog

### v1.0.0 (2026-11-06)
- First release: seven days, 21 readings, 22 hand-drawn cards, 24 glyphs, 8 colours, 12 omens with effects, the grand
  reading, four endings, three romances with four scenes each and a festival night, the Codex, ranks, Focus, a bot, and
  simulation and browser tests.
