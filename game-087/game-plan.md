# Quillsworn

**Genre:** Writing tool and RPG: “RPG Maker, for novels”, about fantasy novels
**Engine:** Vanilla JS: DOM, SVG and Canvas 2D, no asset files, no build step
**Status:** v1.0.0

---

## Concept

A web-based tool for writing a fantasy novel that is also a complete RPG. You are a beginning storyteller who
climbs the stair to the Guild of the Quillsworn in the hill city of Vellmere, where Master Thalion Silverquill,
a handsome (and slightly vain) six-hundred-year-old elf, teaches you the craft. Every lamp in Vellmere is lit by a
finished story; half of them have gone dark, because the Hollow (the silence that eats unfinished tales) takes
the stories their tellers abandon. The guild fights it by finishing.

The tool is real: chapters and scenes, a character codex, a world codex with a generated map, plot structures
and subplot threads, prose analysis, drafts, find and replace, and binding to HTML, EPUB 3 and print-ready
PDF. The game is real too: levels and ranks from the words you write, a calling (class), five attributes, a
talent tree that unlocks tools, relics you wear, quests that walk you through writing a novel, daily bounties,
laurels, and timed “ink duels” against the foes of every writer. RPG Maker gave people the parts of an RPG and a
reason to finish one; Quillsworn does that for a novel.

## Core loop

1. **Write.** Every new word in the Scriptorium is experience (deleted and retyped words don’t count twice;
   pasted ones go in the book but earn nothing). A daily goal lights the day’s fire and builds a streak.
2. **Build.** Characters, places, magic and beats earn one-off XP when they are actually fleshed out.
3. **Fight.** Ink duels are timed sprints: a foe’s health is the words you must write before time runs out.
   The words land in your book either way.
4. **Learn.** Thalion teaches a lesson in each room when asked; quests teach the rest.
5. **Spend.** Levels give talent points; quests and foes give relics. Talents open tools (the Lens, drafts,
   focus mode, more oracles, bindery ornaments).
6. **Bind.** At any point, bind the book and hold it.

## The guild’s road (main quests)

| # | Quest | Asks for | Opens / gives |
|---|---|---|---|
| 1 | The Spark | A title, a logline (12+ words) and a premise (40+) in the Novel Charter | Scriptorium, Quest Board, Library; Thalion’s Ribbon |
| 2 | First Ink | 150 words | Hall of Faces, Proving Grounds; Heron Quill |
| 3 | Faces in the Firelight | A fleshed-out protagonist; an antagonist with a want | Plot Loom, Muse’s Well |
| 4 | The Shape of the Tale | A structure and three beats | Cartographer’s Loft; Elvenwood Inkwell |
| 5 | Where the Road Goes | Two places, a magic with cost and limits, a kept draw | a talent point |
| 6 | Steel and Ink | Two duels won | Midnight Inkwell; wakes the Golem |
| 7 | A Thousand Words | 1,000 words across 3 scenes and 2 chapters | The Bindery |
| 8 | The First Binding | Bind the book once | a talent point; wakes the Hydra |
| 9 | The Sagging Middle | 10,000 words and the Mire-Hydra | a talent point; wakes the Wyrm and the Critic |
| 10 | The Inner Critic | 25,000 words and the Critic | Moonsilver Inkwell |
| 11 | Revision’s Fire | 5 scenes revised, 3 snapshots | a talent point |
| 12 | The Last Page | 40,000 words, marked complete | The Lamp of Vellmere, the finale |

Each quest has a start and an end scene with Thalion. His own story runs underneath: at the Sagging Middle he
admits he has had a half-finished novel, *The Lark Beneath the Hill*, in his desk for 290 years; at the Critic he
admits his Critic won; at the finale your book lights a lamp that has been dark for a century, and he takes his
manuscript out of the drawer. After the road, the Hall stays open: every finished book lights another lamp.

Side quests (21) are posted on the Quest Board as the road opens them: a scene from the antagonist’s point of
view, a scene with no dialogue, one that is mostly dialogue, a named artifact, a pantheon, an atlas of five
pins, three woven threads, every beat of a structure, ten chapters, a seven-day streak, five foes, twenty
lessons, an EPUB, a PDF, a prophecy, dawn and night writing, and a second book. Three bounties a day are chosen
from the seed and the date (the first is always the daily goal).

## Systems

- **XP and levels.** `50(L-1)² + 100(L-1)` XP for level L: level 2 at 150, 10 at 4,950, 30 at 44,950. Ranks:
  Inkling, Apprentice (3), Scribe (6), Journeyman (10), Taleweaver (15), Loremaster (20), Master Talewright (26),
  Grand Bard (33), Legend of Vellmere (40). A 40,000-word novel with its quests lands around level 34.
- **Callings.** Bard (+10% word XP; Dialogue Lantern), Heartseer (double character XP; Quirk Oracle), Loremaster
  (double world XP; Arcanist’s Oracle), Weaver (double beat and loom XP; Twist Oracle).
- **Attributes.** Voice (words), Empathy (characters fleshed, bonds), Imagination (world entries, pins, draws),
  Craft (beats, summaries, revisions, woven cells), Discipline (best streak, duels won). Derived, 1–10.
- **Talents** (20, five branches). The Quill: Focus Trance, Session Vow, Dialogue Lantern, Chronicle of Drafts,
  Seeker’s Glass. The Lens: Scribe’s Lens → Lens of Echoes → Lens of Rhythm. The Oracle: Twist, Quirk, Arcanist’s,
  Prophecy Engine, Title. The Binding: Illuminator, Appendices, Map Plate, Agent’s Format. The Blade: Patient
  Hourglass, Ward of Momentum → Ink Surge. One point per level plus six from the road.
- **Relics** (15): a quill, an inkwell and a charm are worn. Inkwells colour the writing desk (Parchment,
  Elvenwood, Midnight, Dragonfire, Moonsilver).
- **Foes.** Procrastination Imp (100 words / 5 min), Wraith of the Blank Page (250/10), Doubt Goblin (400/12),
  Writer’s Block Golem (600/15), Mire-Hydra of the Sagging Middle (1,000/25), the Infodump Wyrm (1,200/30), the
  Inner Critic (1,667/40, a NaNoWriMo day), and the Straw Scribe (your words, your minutes). After 15 s of
  silence a foe recovers and taunts.
- **The Scribe’s Lens.** Adverbs, filter words, hedges, said-bookisms; then passive voice, echoes, fantasy
  clichés; then sentence rhythm, the five senses, dialogue share and reading ease, each with Thalion’s verdict.
- **The Muse’s Well.** Names for eight peoples, places with a strangeness, story seeds, twists, quirks, magic
  systems (source, cost, limit), prophecies and titles; seeded by the game seed and a counter, so a reload never
  reshuffles. Kept draws go into the codex where they belong.
- **Free Pen** (Settings): every room, talent and foe open at once, for writers who want the tools without the
  climb. XP, quests and laurels still count.

## The tool

- **Scriptorium.** A binder of chapters and scenes (add, rename, move across chapters, delete), a parchment page
  with light markup (`*italic*`, `**bold**`, `* * *` breaks, `> ` quotations), Ctrl+B / Ctrl+I, a Reading view,
  word counts per scene, chapter, book, day and sitting; an inspector with point of view, place, status, summary
  and notes, the Lens, drafts with compare and restore, a session vow, focus mode, and find and replace.
- **Hall of Faces.** Fifteen fields per character (six core plus a 40-word backstory to count as fleshed out),
  each with Thalion’s hint; bonds between characters and a web of them; a heraldic device per character.
- **Plot Loom.** Six structures (Three Acts, the Hero’s Journey, Save the Cat, Seven Points, Kishōtenketsu and
  the guild’s own Fellowship Road), beats with guidance, notes and chapter links; threads woven across chapters,
  with a warning for a thread that vanishes for four chapters.
- **Cartographer’s Loft.** Seven kinds of entry (place, faction, magic, creature, artifact, lore, culture) and a
  parchment map from the novel’s seed (coast by marching squares, mountains, hills, forests, a compass, a
  cartouche), with pins placed by tapping; PNG download.
- **Bindery.** Author, dedication, epigraph; chapter heading style, fleuron, typeface, page size, contents,
  typographer’s quotes, scene titles, drop caps and ornaments, Dramatis Personae and Glossary from the codex,
  the map plate; a live preview. Outputs: one self-contained HTML page (dark-mode aware), an EPUB 3 with an EPUB 2
  NCX and a generated SVG cover (EPUBCheck 5.1 clean), a print proof with page numbers for Save as PDF, a standard
  manuscript (Times 12, double spaced, header, word count) and Markdown.
- **Saving.** Every change autosaves to localStorage: the apprentice under one key, each novel under its own.
  Backups download and import as JSON. With storage blocked, a banner says so and offers a backup.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Advance Thalion | Enter / Space / → | Continue |
| Bold, italic | Ctrl+B, Ctrl+I | B, I on the toolbar |
| Save now | Ctrl+S | (autosaves) |
| Close a dialog, leave focus mode | Esc | × or tap outside |
| Rooms | Tab through the dock | the dock (bottom on phones, left on desktop) |

## Look and sound

A candlelit guild hall: dark slate and green, gold leaf, Cinzel for titles and EB Garamond for everything else,
drifting embers on a canvas behind it all, and parchment for the page. Thalion is an SVG portrait built in code
with eight moods and blinking lids; the foes, sigils (four shields, twelve charges, eight fields, five metals) and
room emblems are SVG too, the map is Canvas 2D. Sound is Web Audio: a plucked lute for the guild (pentatonic),
soft quill scratches while typing, page turns, a fanfare for quests, thuds for duels.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, title and prologue, the room router, saving, events → toasts/sounds/scenes, keys, debug hooks |
| `js/sim/state.js` | The state shape, ids, days and streaks, save (core and per-novel) |
| `js/sim/actions.js` | Every change, each ending in `settle()` (awards, attributes, bounties, laurels, ready quests) |
| `js/sim/progress.js` | XP, levels, ranks, bonuses, talents, relics, rooms, lessons, the day, fleshed-out checks, laurels |
| `js/sim/quests.js` | Main, side quests and bounties as pure checks |
| `js/sim/duel.js`, `oracle.js`, `text.js` | Ink duels; the Well; word counts, markup, the Lens |
| `js/sim/data/` | Guild data (rooms, callings, talents, relics, foes, genres, structures), lessons, scenes |
| `js/book/` | `book.js` (HTML, EPUB, print, manuscript, Markdown, cover), `zip.js` (store-only zip and reader) |
| `js/view/` | `portrait.js` (Thalion), `art.js` (foes, sigils, icons), `map.js`, `motes.js` |
| `js/ui/` | `dom.js` helpers, `dialogue.js`, one module per room, `settings.js` |
| `js/save.js`, `js/audio.js`, `js/rng.js`, `js/config.js` | Guarded storage and backups, sound, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the prose tools, every rule, the data, the
book formats, saves and a bot that writes its way through the whole road. `browsertest.mjs` drives the real game
on desktop, two touch-only phones, the endgame and blocked storage. The exported EPUB passes EPUBCheck 5.1.

## Balance notes

The bot writes a fixed number of words a day and does whatever the current quest asks. At 1,700 words a day it
walks the road in 22 days (First Ink on day 1, the Middle on day 6, the Critic on day 14) and ends at level 34;
at 800 a day, 47 days and level 35. The level curve was chosen so that the novel lands in the Master Talewright
band and the last ranks need a second book.

## Open questions / next steps

- A human pass with a real novel: a bot is not a writer, and nobody has written 40,000 words in it yet.
- Drag and drop in the binder (moving is by arrows now).
- Optional sync to a file on disk (the File System Access API) for writers who don’t trust browser storage.

## Changelog

### v1.0.0 (2026-10-19)
- First release: the guild and its twelve-quest road with Thalion’s scenes; the Scriptorium, Hall of Faces,
  Plot Loom, Cartographer’s Loft (with a generated map), Muse’s Well, Proving Grounds, Quest Board, Library,
  Bindery and Sheet; levels, ranks, callings, attributes, 20 talents, 15 relics, 8 foes, 21 side quests, daily
  bounties, 31 laurels and 39 lessons; HTML, EPUB 3, PDF, manuscript and Markdown binding; autosave and backups.
