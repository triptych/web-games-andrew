# Wrack & Wonder

**Genre:** First-person survival and research adventure: learn a magic system no one has ever learned, by experiment, then use it to break a curse. A romance, if you earn it.
**Engine:** three.js r165, no asset files: every model, texture, glyph, sound and note of music is made in code
**Status:** v1.0.0

---

## Concept

You wash up on a small island that hums. You are the first person in the world to learn magic, and nobody can teach you: the only clues are a hut on the bluff, full of a stranger's home-made instruments, and the notes she left. You survive the first night, and then you start running experiments.

The hut belonged to **Elowen Vale**, nineteen, who rowed here alone to prove the hum was real. She found the words, half-understood them, and on the night she tried something big at the old castle she spoke two words that hate each other. Everything stopped. She has hung inside one stopped moment for a year, aware and alone, while a curse grew around the castle: a wall of black thorns, a moat of black water, shades that come out at night. As you learn her words you find her pages, then her echoes, and realise she can feel you learning.

**Nib**, a goblin who used to steal her biscuits, is caught in the curse's thorns in Whisperwood. Free him and he becomes your assistant: he follows you, carries what you can't, picks up reagents he passes, drags you home when you collapse, and gives advice that teaches method, never answers.

The magic is **procedurally generated from the seed**. The shapes and names of the glyphs, what each one means, the word order, which reagent carries which essence and how strongly, which essences are opposed, the hour each one waxes, even the colours of the magic: all of it is new each life. What you learned last time is the *method*. It riffs on *Outer Wilds* (knowledge is the progression), *Return of the Obra Dinn* and *Papers, Please* (a notebook that holds you to evidence), *Noita* (spells as written combinations) and *Myst* (a lonely island full of someone else's machines).

## Core loop

1. **Gather.** Reagents glow faintly where they grow: sea glass and shells on the shore, mushrooms and feathers in the wood, pearls in the fen, crystals on the moor. Food too.
2. **Experiment** in the hut: the **alembic** shows what a reagent carries and how strongly; the **bells** show whether two reagents clash; the **orrery** shows the hour a reagent's essence waxes.
3. **Write** a spell in the book (one ringed **shape** and one or two bare **words**, each word fed a reagent) into one of the Focus's three slots.
4. **Cast** it, at the circle of test objects in the hut or out in the world. Failure is information: a *tangle* means the shape is at the wrong end, a *starve* means that reagent doesn't carry that word, *discord* means two words that don't belong together.
5. **Use** what you know on the island's obstacles, and go further.

## The magic (all seeded: `js/sim/laws.js`)

- **Nine glyphs**: six words (**Kindle** heat, **Rime** cold, **Lumen** light, **Bloom** growth, **Gale** wind, **Still** stillness) and three shapes (**Bolt** thrown where you aim, **Ward** worn, **Seal** set on the ground). Shapes are drawn inside a ring; words are bare. Each glyph's strokes and name are generated, so they can't be recognised from another life.
- **Word order**: the shape goes first, or last.
- **Feeding**: each word needs a reagent that carries its essence. Ten reagents; the shore always offers the three words carved over the hut's circle (Kindle, Lumen, Rime); each region offers its own new word; two inland reagents are **strong**.
- **Power** = Σ (reagent potency + 1 if the word is at its **waxing** hour). The same word twice doubles up.
- **Opposition**: the six essences fall into three hating pairs. Two opposed words spoken together **unweave**: they unmake curses.
- **Elowen's pair**: one opposed pair is the one she spoke on the night of her accident.

What each form does with each essence (`js/sim/magic.js`): Kindle bolts burn, wards keep you warm, seals make a fire to rest and cook by; Rime freezes, its ward lets you walk on water, its seal makes an ice floe; Lumen reveals and banishes shades, its seal is a beacon; Bloom grows (the seedbed's vine bridge, bramble bushes), its ward heals; Gale tears and blows, its ward lets you glide, its seal is an updraft that lifts you fifteen metres; Still stops vents, wind and shades.

### The notebook

`G.notes` only ever holds what an experiment or a cast has shown. Successful casts record the order, the glyph's meaning and the shape's form; starved words are crossed off; the bells and the orrery fill in clashes and hours; and links carry essences between reagents and glyphs. The book's **Marks** page is a logic grid: ✓ and ✗ from evidence, and the player's own ? and × pencil marks. The bot that proves the game can be finished plays from the notebook alone.

## The island

```
                    the Highmoor (cliff; storm ring)
                              |
     Whisperwood  ----   the Stilled Castle  ----  Ember Fen (ringed by rock; one gorge)
     (the mere)              (thorns, moat)
                              |
                         the Heath (crossroads)
                              |
                Elowen's hut  ---  Wrack Beach (you wake here)
```

A 400 m island with one height function shared by the sim, the bot's route finder and the terrain mesh. Water deeper than your knees can't be waded; slopes steeper than about 51° can't be climbed. A flood fill in the simtest proves that with no magic you can't reach the islet, the fen, the moor plateau or the castle.

## Story and goals (`js/sim/story.js`, `js/sim/data/text.js`)

| Goal | What it takes |
|---|---|
| Shelter, fire, sleep | Find the hut; three driftwood light the hearth; the bed passes the night |
| The journal, the marks | The Focus is on the desk; six marks are carved over the circle |
| The first spell | One of the three lintel words, fed a shore reagent, in the right order |
| Nib | A Kindle, Rime or Gale bolt at his thorn cage (Lumen only makes the thorns flinch) |
| Whisperwood's stone | Learn the green word (carved on the seedbed post), find what feeds it, cast it strongly at the stone on the islet |
| Ember Fen's stone | Melt the frozen falls with Kindle at strength 2; learn the wind word; cast it strongly at the stone in the boiling pool (the steam vents on the causeway block a straight walk) |
| The Highmoor's stone | A Gale seal's updraft climbs the cliff; learn the quiet word; cast it strongly into the storm ring |
| The thornwall | Unweave it with two opposed words, thrown where the old road meets it |
| The moat | Wear Rime and walk across (or float on Rime seals, or glide on Gale) |
| The gate | Opens on three woken stones |
| The keep | Its door hides from everything but light |
| The gallery | An updraft inside the keep |
| Elowen | Her two words, as a Seal at her feet, at strength 3 |

Ten pages carry the story and some seeded clues (a reagent that feeds the green word, the cold word's hour, a clashing pair that isn't hers, her two words in plain language). Four **echoes**, shown only by Lumen after dark, are Elowen speaking from inside the stop; each heard adds affection.

**The ending**: the bubble cracks, you catch her, and at dawn in the hut you talk. Choices add affection; the last one decides: *stay with her* (a romance, "Two Voices", if affection is 4 or more; a shy, hopeful "We'll See" if not) or *stay and study* (warm either way).

## Survival

Health, warmth and food. Nights outdoors are cold; wading is cold; the moor is windy; fires, the hut, hot springs and a Kindle ward warm you. Berries, clams and chanterelles feed you (cook the last two). At zero warmth or food you lose health; at zero health you collapse and wake in the hut at dawn with half your reagents. Shades roam at night and haunt the courtyard; Lumen drives them off. Resting by a bed or a fire skips to any phase of the day, which is how you reach a word's waxing hour.

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Walk / run / jump | WASD (arrows turn) / Shift / Space | Left stick / LS / A | Left-side stick / double-tap-hold / Jump |
| Look | Mouse (pointer lock; drag without it) | Right stick | Drag the right side |
| Use | E or right click | X | Use |
| Cast | Left click or F | RT | Cast |
| Slots | 1 2 3, wheel | LB / RB | Tap a slot |
| Book (Marks, Map) | Tab or B (J, M) | Y | Book button |
| Eat | Q | | Satchel tab |
| Pause | Esc / P | Start | ❚❚ |

## Look and sound

Low-poly, painterly: flat-shaded trees that sway, card undergrowth, a terrain with grain, water that knows its own depth (foam at the shore, a violet sheen on the cursed moat, bubbles in the boiling pool), a sky shader with sun, moon, stars and clouds through the whole day, fog that follows the hour, soft shadows and bloom kept for magic (threshold above 1). The hut is warm timber and thatch with a working hearth, chimney smoke, jars that glow in the essences you've seen, an alembic, bells and an orrery that move when used, and a chalk circle of test objects that react to their essence. The castle wears a violet veil; three beams of light join it as the stones wake. Glyphs are drawn from their strokes everywhere: the book, the HUD, the carvings, the seal circles.

All audio is Web Audio: a sea that grows near the shore, wind that grows with height and in the storm ring, birdsong by day and crickets by night, the island's hum (a seeded note) louder near the castle, a generative harp in a scale that turns minor at night and strange near the castle, and a sound for each essence, each instrument and each event.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, pointer lock, debug hooks |
| `js/sim/laws.js` | The seeded laws of magic |
| `js/sim/world.js` | Height, water, regions, colliders, trees and rocks, spawn points, the road graph |
| `js/sim/body.js` | Support height, collision, one physics step |
| `js/sim/game.js` | State, step, act, usables and focus, survival, shades, Nib, saving |
| `js/sim/magic.js` | Judging a spell, aiming, casting, what spells do, wards and seals over time |
| `js/sim/research.js` | Instruments, the notebook, what each cast teaches |
| `js/sim/story.js`, `data/text.js` | Goals, dialogue, hints, pages, echoes, the ending |
| `js/sim/nav.js`, `bot.js` | Route finding; the researching bot |
| `js/view/` | `stage` (renderer, sky, light, bloom), `terrain` (ground, water), `nature`, `buildings`, `characters`, `fx`, `tex`, `view` |
| `js/ui/ui.js`, `book.js` | HUD, screens, sheets, dialogue; the book |
| `js/glyphart.js` | Drawing glyphs and icons |
| `js/input.js`, `audio.js`, `save.js`, `rng.js`, `config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). The simtest proves the sim pure, the laws sound on 60 seeds, the gates shut without magic, every rule and puzzle, determinism, and that a bot researching only from its notebook frees Elowen on six seeds. The browser test plays the real game on desktop, two touch-only phones and with storage blocked.

## Balance notes

- The bot finishes in 24–30 game minutes (4–5 in-game days), with 17–22 experiments and 21–24 casts, 1–4 of them fizzles, and never collapses. A first-time player who doesn't know the method should take one to two hours.
- The bot shoots the fen stone from beside the pool, not down the causeway: the vents catch a bolt. People will likely clear the vents first; both work.
- Stocking reagents for the castle has to add up every use of a word (Gale lifts you to the gallery *and* may be one of Elowen's words).
- Survival is meant to colour the days, not to fail runs: a full belly lasts most of two days, and a night outdoors costs about 35 warmth.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- More uses for doubled and opposed words in the open world (a second unweave puzzle).
- Elowen as a companion after the ending, for free play.

## Changelog

### v1.0.0 (2026-11-06)
- First release: a seeded magic system (glyphs, order, feeding, power, waxing, opposition), three instruments, a notebook that keeps evidence, a book with a spell writer, logic grid and map, survival through day and night, Nib, ten pages and four echoes, three regions and the castle, two endings each with a high and low affection version, procedural art and audio throughout, sim and browser tests.
