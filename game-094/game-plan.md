# THE LONG HELIX

**Genre:** Text adventure / interactive fiction, with a small RPG layer (attributes, dice checks, a pack, a journal)
**Engine:** Vanilla JavaScript. A DOM terminal plus a 1-bit Canvas 2D picture, no asset files, no library
**Status:** v1.0.0

---

## Concept

An old-school text adventure that looks like it is running on a Hercules monochrome card: 720×348, one phosphor colour on black, a status bar in inverse video, double-line boxes, a block cursor, scanlines and a flicker. Text is typed one character at a time to the clack of a keyboard; every new scene "loads from disk A:" with the chatter of a floppy drive; choices are numbered menus, as in a Choose-Your-Own-Adventure book that has been ported to a PC in 1987.

You are Dr. Alix Navarro, the only person left at Halcyon Outpost on Vesper, a planet sixty-one light-years from help. Your four colleagues drove north to survey the Spires nine days ago and have stopped answering. The supply ship Ardent is due on day 60. The sequencer has just finished a run: twenty-four samples from every kingdom of life on the planet, and they are 99.97% the same genome. The game is the slow discovery that the whole biosphere is one distributed organism with a purpose, and then a choice about what to do with that knowledge.

It riffs on Infocom-era adventures (the transcript, the terse prompts), on Roadside-Picnic and Solaris-style first contact (the thing you meet is neither hostile nor friendly, and is very old), and on *Annihilation*'s landscape.

## Core loop

One scene: read a passage as it types out (any key or tap finishes it), look at the picture, pick a numbered choice. Choices may roll 2d6 + an attribute against a target. Results print, the pack, the sheet and the journal update, and the next scene loads. About 40 to 80 choices make a run; a run takes 20 to 40 minutes. The game saves after every choice and has seven endings.

## Mechanics

### Attributes and checks
Four attributes, ten points in total, set by the discipline you pick on the first screen:

| Discipline | ANALYSIS | FIELDCRAFT | INTUITION | WILL |
|---|---|---|---|---|
| Computational genomicist | 4 | 2 | 1 | 3 |
| Field geneticist | 2 | 4 | 2 | 2 |
| Neurogeneticist | 2 | 1 | 4 | 3 |

A check is `2d6 + attribute (+1 per listed item carried) >= target`. Targets run from 7 to 9. The dice are drawn from `G.rng`, so a seed replays exactly; the tests can force a pass or a fail. A failed check costs something (clarity, health) and usually allows a retry, so nothing is a dead end, but the cost is real.

### Health, clarity, and the clock
Health 10 and clarity 10. Health at 0 ends the game ("The Quiet"). Clarity at 0 ends the game ("The Chorus"). Sleeping at camp restores 2 of each once per visit; stims restore 4 health, focus tablets 3 clarity. The clock runs from day 41, 06:12; on **day 60 the Ardent arrives and the story ends** ("The Pickup") whatever you have decided, which is the only time pressure.

### Genome decoded (0–100%)
Every real discovery adds to it. It is the mystery meter, and the one number the last choices care about: co-authoring the missing gene needs 60%.

### The pack
Six slots. The equipment locker offers seven items, so the first real decision is what to leave behind; two key items (Osei's tuner, the lattice shard) are found later and need room. Click an item in the PACK panel to use (stim, tablets) or drop it; key items cannot be dropped. Each item opens something specific:

| Item | What it does |
|---|---|
| Handheld sequencer | Records the dusk chorus (the biggest reveal), +1 to measuring the Spires |
| Sample kit | Takes living samples, +1 to freeing the crew |
| UV lamp | Reads the index on the Sump wall |
| Cutting torch | Cuts through thorns and the lattice door, +1 to freeing the crew, and is the only way to burn the Seed |
| Stim injector / Focus tablets | One-shot healing |
| Spore mask | Skips the clarity cost of the Sump |
| Osei's tuner (found) | Answers the chorus, opens the lattice door, and is needed for the best ending |
| Lattice shard (found) | Opens the lattice door |

Every gate has more than one way through, and one that needs no item at all (palm on the recess, WILL 9), so a pack with nothing useful in it still finishes the game.

### The journal
Thirteen entries (`js/sim/data/codex.js`), unlocked by story beats. The title screen counts the endings found, across runs.

## Story

Five acts, about 55 nodes (`js/sim/story.js`):

1. **Halcyon Outpost.** Read the results (one genome, everywhere), run the deeper alignment (a repeat every 4,096 bases: the genome is numbered), play Osei's last log (three rising notes), pack, go out.
2. **The valley.** A hub with three sites, any two of which open the way north. *The Moss Flats* (the moss learns by copying you; the survey camp and Osei's tuner). *The Sump* (a luminous lake whose walls are an index of every organism, with a blank at the end; the lattice shard on the lake floor). *The Chorus Ridge* (at dusk the whole valley pulses; if you record it, it plays back your own genome; if you hum the notes back, a road of light opens). Camp between: sleep, dream, watch.
3. **The Spires.** Nineteen four-hundred-metre columns tilted at one point in the sky. Not trees: launch stacks. The thorn curtain, and the Root Cathedral behind it with the crew's rover and Osei's last recording ("ASK IT WHAT IT'S MISSING").
4. **The Lattice.** A mycelial computer under the roots; a door you can open four ways; and the Helix itself, which answers up to six questions: what it is, what it is for (a seed, and this world is its pod), what it is missing (one gene, a signature), where your crew is (filed, being read), who came before (three visitors, one of whom signed), and whether you can refuse (yes).
5. **The Cradle.** The Seed, the four sleeping crew, and the recess for a hand. Free the crew (a check), then choose.

### Endings

| Ending | How |
|---|---|
| **The Signature** | Lay your palm in the recess. The Seed launches carrying human genes; you and your crew are changed |
| **The Co-Author** | 60% decoded, the tuner, and the question about the gap asked: write the last gene together, a greeting rather than a signature. The best ending |
| **The Fire** | Burn the Seed (needs the torch, asks first). The valley goes silent for good; the crew live only if you freed them |
| **The Report** | Walk away and report. Quarantine; the moss on Earth turns to face you |
| **The Quiet** | Health reaches 0 |
| **The Chorus** | Clarity reaches 0; the Helix writes the gene itself, badly, from what it has learned of you |
| **The Pickup** | Day 60: the Ardent arrives before you have decided |

## Controls

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Choose | 1–9, or ↑↓ and Enter / Space | Click | Tap |
| Finish the typing | Any key | Click the story | Tap the story |
| Journal / sheet / pack | J / C / I | Buttons and tabs | JOURNAL button, SHEET and PACK tabs |
| Menu | Esc | MENU | MENU |

## Look and sound

**Look.** One phosphor colour (amber by default; green and paper-white are settings) on black, in a monospace stack that falls back to `Courier New`. A status bar in inverse video, boxes with `3px double` borders, selected choices in inverse video, a blinking block cursor on the line being typed, scanlines and a vignette and a slow flicker (all switchable, and off under `prefers-reduced-motion`). Each scene has a **1-bit picture** (`js/view/art.js`): a brightness function of position, drawn through a 4×4 Bayer ordered dither into 240×116 pixels, which is 720×348 divided by three, and revealed row by row. 14 scenes, all procedural. The pictures are the only graphics; everything else is characters.

**Sound** (`js/audio.js`, Web Audio, no files). A keyboard click and thud for every character typed (rate-limited), a lower thunk for spaces. The PC speaker: square-wave beeps for menus, items, journal entries, dice (a rattle, then up for success, down for failure), and a short tune per ending. The floppy drive: a spindle rumble that spins up and down, a train of head-step clicks, and a settling thunk, longer for the boot and slower and heavier for a save. A faint 60 Hz hum under it all. Everything respects two volume sliders and is suspended in a hidden tab by `lib/page-audio.js`.

**Boot.** Power on (so the browser gets its gesture) → a BIOS test with a counting memory check → "INSERT SYSTEM DISK IN DRIVE A:" and a long floppy seek → the title. Any key skips it.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot show, modes (power, boot, title, play, over), key routing, autosave, debug hooks |
| `js/sim/game.js` | Pure story machine: `newGame(seed)`, `choicesFor`, `choose`, `useItem`, `dropItem`, `serialize`, `deserialize`; emits events |
| `js/sim/story.js` | All the prose and every choice, as data, with the DSL documented at the top |
| `js/sim/data/` | Items and the journal |
| `js/sim/bot.js` | An auto-player, for tests, balance and the debug `autoplay` |
| `js/view/terminal.js` | The transcript: echo, rolls, notices, typewriter, picture reveal, choice buttons, end card |
| `js/view/art.js` | The 1-bit scenes and the dither |
| `js/ui.js` | Screens, status bar, character sheet, pack, journal, settings |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound, key queue, guarded storage, seeded RNG, tuning |

The shape is the sim/view split of the sim/view scaffold, minus the fixed-step loop: the sim is turn-based, so there is no `dt`. `choose()` is the only thing that moves the story, and everything the player sees is an *event* that `choose()` appended to `G.events`.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the story graph, the rules, determinism and save round trips, and has a bot play the whole game on many seeds toward each ending (with the dice forced both ways) while checking that nothing is ever a dead end. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations, and with storage blocked.

## Balance notes

- With the genomicist the 8-target check passes 92% of the time and the 9-target one 83%; with the others, 72% and 58%. The first check you meet tells you which kind of player you are.
- A bot with lucky dice finishes in about 105 actions and about 5 in-game days, at 6 health and 3 clarity, having decoded 97%. A bot with bad dice dies of clarity at about step 60: clarity is the scarcest resource, the one the dice and the spores and the chorus all drain, and the one to spend carefully.
- Clarity costs: unmasked spores 2, a failed deep alignment 1, watching the moss fail 1, recording the chorus 2, listening to it 2 (3 on a failure), asking the Helix about your crew 1, cutting the lattice door 2. Rest is the only free source (2 per night).

## Open questions / next steps

- The prose has been read only by its author and a bot. A human pass for pacing, and for the clues that point at the three optional sites, would help.
- A second planet or a New Game+ with the endings you have seen would give the endings counter somewhere to go.
- The monospace stack falls back to whatever the system has; a bundled bitmap face would look more like a Hercules card but would be the game's only asset file.

## Changelog

### v1.0.0 (2026-10-23)
- First release: a Hercules-style text adventure with five acts, seven endings, a character sheet, a six-slot pack and a journal; 1-bit dithered pictures; typewriter text with keyboard clacks; floppy-drive and PC-speaker sound; a boot show; autosave and Continue; a bot that plays the whole game; sim, browser and phone tests.
