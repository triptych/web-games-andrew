# TALEWRIGHT — The Atelier of Unwritten Worlds

**Genre:** A game about making games. An RPG Maker-style editor that is itself a story game with chapters, quests, achievements, a currency and unlockable assets.
**Engine:** none. Vanilla HTML, CSS and JavaScript. Canvas 2D for maps, sprites and the RPG runtime, DOM and CSS for the editor, Web Audio for every sound and note.
**Target:** desktop first (it is an editor), fully usable on a tablet and workable on a phone; keyboard, mouse, touch and gamepad (in the runtime).
**Status:** v1.0.0. Every system below is built. Open questions are at the end.

No image or audio files. Every tile, character, monster, icon, window, song and sound effect is generated in code, which is also why an exported game is a single small HTML file.

---

## 1. Concept

RPG Maker taught a generation to make games by giving them a tile palette, an event editor and a database. It is also a blank page, and a blank page is the hardest thing in the world to face.

**TALEWRIGHT** turns learning the tool into the game. You are the new apprentice at the **Atelier of Unwritten Worlds**, the workshop at the edge of the world where every story was once made. Something called **the Blot**, a grey nothing, has soaked into the Atelier and scattered its tools. Your mentor **Quillon**, an old enchanted quill, teaches you to use each tool as it comes back, and every tool you master pushes the Blot back. By the end you have built a complete RPG of your own, and you can export it as one HTML file that runs anywhere.

Three things are always true:

1. **The editor is real.** There are no fake tutorial levels. Everything you make in the story is your own project, saved, downloadable and exportable. The quests are checks against the real project (and against what really happens when you playtest it).
2. **Nothing is ever taken away.** Unlocks only add. A project made in Free Mode opens in Story Mode and the other way round; locked tools just can't be used to *add* new things until they unlock.
3. **The output stands alone.** An exported game is one `.html` file containing the runtime, the generated-asset code and your data. No server, no network, no files next to it.

---

## 2. The two layers

| Layer | What it is | Where it lives |
|---|---|---|
| **The maker** (the editor) | Map editor, tile palette, event editor, database, Sprite Forge, project files, playtest, export | `js/editor/*.js`, ES modules |
| **The meta-game** | Story chapters and scenes, quests, achievements, Ink (currency), Maker Rank, the Inkwell Emporium (shop), unlocks, the Blot | `js/meta/*.js`, ES modules |
| **The runtime** | The RPG engine that plays a project: title screen, maps, events, dialogue, menus, battles, shops, saves | `js/runtime/*.js`, classic scripts in a module registry (§ 9) |

The editor and the meta-game never touch the runtime's internals. The runtime reports what happens during a playtest through **hooks** (§ 9.6), and the meta-game listens to those hooks and to the editor's **edit events** (§ 11.2).

---

## 3. Story

### Cast
- **The Apprentice** — you. Never named, never drawn; you are the hand holding the pen.
- **Quillon** — an enchanted quill, centuries old, fussy, warm and proud. Writes in a neat copperplate. He is the mentor and talks in the side panel and in story scenes. Has a drop of ink for a heart.
- **Mott** — a small ink-moth who lives in the Atelier's lamp. Excitable, forgetful, loves shiny things. Asks for side things ("make me a chest! a big one!") and gets most of the jokes.
- **The Blot** — a grey stain that speaks in faint italics. It does not shout. It says things like *"…why bother. it has all been done."* It is the fear of the blank page.
- **The First Talewright** — the Atelier's founder, long gone, who left notes in the margins. Heard only in the last chapter.

### Arc
The Blot has soaked into the great **Worldbook**, the Atelier's master volume, and the tools have scattered into **Glyphs**. Each chapter restores one Glyph: Quillon explains it, you use it on your own project, and the Blot loses ground (the grey vignette around the workspace shrinks chapter by chapter). In the last chapter the Blot makes its case directly: nothing you make will matter. Quillon tells you the First Talewright felt the same, and wrote on anyway, and that the Blot is not an enemy to be beaten but a feeling to be finished in spite of. You bind your project into a book (export it), the Worldbook fills, and the Blot becomes the margin: the clean white space around the words, which every page needs.

### Chapters

| # | Glyph | Title | What it restores (unlocks) | Quests |
|---|---|---|---|---|
| 0 | — | **The Blank Page** | Pencil, eraser, Meadow tileset, ground + decor layers, hero start, playtest, save/open/new | Paint 40 tiles · use 5 different tiles · place the hero's start · playtest |
| 1 | Glyph of Voices | **Words** | Events, Show Text, Comment, villager sprites, the NPC and Sign templates | Make an event with a character graphic · a Show Text with a speaker name · write 3 messages · talk to someone in a playtest |
| 2 | Glyph of Keeping | **Things** | Database (Items), Change Items, Change Gold, event pages and self switches, Chest template, rectangle and fill tools, Village tileset | Create an item · a chest that gives an item · get an item in a playtest · give gold with a command |
| 3 | Glyph of Thresholds | **Places** | More maps, Transfer Player, Door template, map properties and resizing, the Over layer, eyedropper, Interior tileset | Create a second map · a transfer to another map · travel between maps in a playtest · use the Interior tileset |
| 4 | Glyph of Forks | **Choices** | Show Choices, Switches, Variables, Conditional Branch, page conditions, Wait, the Switches & Variables tab | A Show Choices · a page conditioned on a switch that a command turns on · use a variable · a conditional branch · pick a choice in a playtest |
| 5 | Glyph of Strife | **Conflict** | Heroes, Enemies, Skills and Troops tabs, Battle Processing, random encounters, Recover All, Dungeon tileset, the Monster template | Create an enemy · start a battle (command or encounters) · win a battle in a playtest · give a hero a skill |
| 6 | Glyph of Trade | **Commerce & Care** | Shop Processing, Inn template, weapons/armour/accessories and equipping, Change Party, Change EXP, Castle tileset | A shop with 3 goods · buy something in a playtest · a weapon and an armour · a party of two |
| 7 | Glyph of Motion | **The Living World** | Autorun and parallel triggers, movement types, Set Move Route, fade/flash/shake/tint, sound effects and music, map music, Sprite Forge, Snow tileset | An autorun event · a wandering NPC · a screen shake · music on two maps · a custom sprite |
| 8 | Glyph of Binding | **The Worldbook** | Export (standalone HTML and the runtime player), System tab (title, title screen, window skin, terms), Game Over, The End, Desert tileset | Name the game · a The End command · reach the ending in a playtest · export |
| ★ | — | **Epilogue: Worldsmith** | Everything left, the Sky tileset, the title Worldsmith | (free play; the remaining achievements) |

Each chapter opens with a **story scene** (Quillon and Mott talk; the Blot interrupts) and ends with a **restoration scene** (the Glyph lights, the Blot recedes, unlocks are listed). Scenes can be replayed from the **Journal**.

### Free Mode
Chosen on first launch (or at any time from Settings): everything is unlocked, quests and achievements still track, the story can still be read. Story Mode is the default. Switching to Free Mode is one-way per save of the meta-game, because it changes what "earned" means for achievements (an achievement is marked ✦ if it was earned in Free Mode).

---

## 4. The meta-game

### Ink
The Atelier's currency. Earned for making things:

| Action | Ink |
|---|---|
| Every 20 tiles painted | 1 (at most 30 a minute) |
| Create an event | 4 |
| Add a command | 1 |
| Create a database entry or a map | 5 |
| Playtest | 6 (at most once every two minutes) |
| Finish a quest | 40 |
| Earn an achievement | 15–100 by tier |
| Export a game | 25 |
| Finish a chapter | 150 |

Ink is spent at the **Inkwell Emporium** (§ 4.4). Total Ink *earned* (not current Ink) sets the **Maker Rank**.

### Maker Rank
Twenty ranks, each a title shown on the toolbar badge: Blank Page, Doodler, Scribbler, Sketcher, Drafter, Storyteller, Mapmaker, Tilesmith, Eventsmith, Lorekeeper, Questgiver, Dungeonwright, Worldweaver, Bard, Chronicler, Mythmaker, Loremaster, Archmage of Ink, Grand Talewright, **Worldsmith**. Thresholds grow roughly geometrically (0, 30, 80, 150 … ≈ 9 000). Rank-ups pop a toast with a quill flourish.

### Achievements
Forty achievements in four tiers (bronze 15, silver 30, gold 60, platinum 100 Ink). They are listed (with progress bars where it makes sense) in the **Trophy Case**. Hidden ones show as "???" until earned. The full list is in `js/meta/achievements.js`; the shape is:

```js
{ id: 'painter', name: 'Painter', tier: 'silver', desc: 'Paint 1,000 tiles.', stat: 'painted', goal: 1000 }
{ id: 'firstblood', name: 'First Blood', tier: 'bronze', desc: 'Win a battle in a playtest.', hook: 'battleWin' }
{ id: 'bigmap', name: 'Vast Lands', tier: 'silver', desc: 'Make a map at least 60×60.', check: (p) => p.maps.some((m) => m.w * m.h >= 3600) }
{ id: 'nightowl', name: 'Night Owl', tier: 'bronze', hidden: true, desc: 'Work in the Atelier after midnight.' }
```

`stat` achievements read lifetime counters, `hook` achievements fire on a playtest hook, `check` achievements inspect the current project.

### The Inkwell Emporium
A shop run by Mott (he takes payment in Ink, which he drinks). Everything it sells is an **asset or a cosmetic** — never a tool, so nobody can buy their way past the tutorial. Stock:

- **Tilesets:** Spooky Hollow, Starship, Sky Isles (also free in the Epilogue).
- **Sprite part packs:** Royal Headgear (crown, tiara, circlet, plumed hat), Critters (cat, slime, ghost and robot bodies for NPCs), Adventurer Kit (capes, scarves, goggles).
- **Monster packs:** Dragonkin (drake, wyvern, dragon), Constructs (golem, sentinel, mimic), Undead (skeleton, wraith, lich).
- **Music themes:** Haunted, Frost, Dunes, Starlight, Festival, Heroic.
- **Window skins** (for your game's dialogue boxes): Parchment, Midnight, Forest, Rose, Neon.
- **Editor themes** (the Atelier itself): Parchment, Midnight Ink, Synthwave.
- **Quillon's wardrobe:** top hat, monocle, scarf (shown in his portrait).

### Quests
Quests come four or five to a chapter (§ 3), 38 in all. Each one is a pure function `check(project, stats, flags) → { done, progress, goal }` re-evaluated after every edit and after every playtest hook, so a quest can never be "lost" by an undo of something it already counted (once done, a quest stays done). The Quest panel shows the chapter's quests with checkboxes and progress, a hint from Quillon for the current one, and a **Show me** button that highlights the tool to use.

### The Blot
A CSS vignette of grey, noisy ink around the workspace whose size is `--blot` (1 at chapter 0, 0 after the Epilogue). Grey ink drips appear on locked tools. In each chapter the Blot comments once or twice in the mentor panel when you hesitate (no edit for 90 s): faint italic lines that Quillon then answers.

---

## 5. The maker (editor)

### Layout (desktop)
```
┌────────────────────────────────────────────────────────────────────────────────┐
│ TALEWRIGHT  [Project ▾] [Database] [Forge] [▶ Playtest] [Export]  ✒ 312  Rank  │
├───────────────┬───────────────────────────────────────────────┬────────────────┤
│ MAPS          │  [✎][▭][◉][⌫][💧][★][⚑]  Layer: Ground Decor Over Events     │
│  ▸ Meadow     │  ┌─────────────────────────────────────────┐   │ QUILLON       │
│  ▸ House      │  │                                         │   │ (portrait)    │
│ TILESET       │  │            map canvas                   │   │ "Now, dear…"  │
│  [palette]    │  │                                         │   │ QUESTS        │
│               │  └─────────────────────────────────────────┘   │ ☑ ☐ ☐ ☐        │
└───────────────┴───────────────────────────────────────────────┴────────────────┘
```
On a narrow screen the left and right columns become drawers opened from a bottom bar (Maps, Tiles, Map, Quests).

### Maps
- Up to 64 maps (1 until Chapter 3). Size 10×10 to 120×120. Each map has a name, tileset, three tile layers (Ground, Decor, Over), events, music, battle background, random-encounter troops with weights and an average step count, and a "show name on entry" flag.
- **Layers:** *Ground* is always filled. *Decor* sits on it and may block (trees, rocks, furniture). *Over* is drawn above characters and never blocks (treetops, roof edges, arches). Passability is per tile; a cell is blocked if its ground or decor tile is solid. Counter tiles let you talk across them.
- **Tools:** Pencil (stamps the palette selection, which may be a rectangle of tiles), Rectangle, Fill (flood fill on the current layer), Eraser, Eyedropper, Event (create / select / drag / edit events), Start (place the party's starting position).
- **View:** zoom 1–4×, grid, dim-other-layers, pan by scrolling, middle-drag, space-drag or two fingers.
- **Undo/redo** (Ctrl+Z / Ctrl+Y) for every committed change: strokes, event edits, database edits, map changes. 60 steps.
- **Right-click on the map** (or long-press): quick event templates (NPC, Sign, Chest, Door, Shopkeeper, Inn, Monster, Healing Spring, Save Crystal), "Playtest from here", "Set start here".

### Event editor
An event is a thing on a map: a character, an object, an invisible trigger. It has one or more **pages**; the runtime shows the *last* page whose conditions are all met (as RPG Maker does), so later pages override earlier ones.

| Page field | Values |
|---|---|
| Conditions | switch is ON (up to two), variable ≥ value, party has item, self switch A–D is ON |
| Graphic | none, a character sprite (with facing), or an object sprite (chest, door, sign, crystal, …) |
| Trigger | **Action** (press confirm facing it), **Touch** (walk into it, or it walks into you), **Autorun** (runs as soon as the page is active, blocking the player), **Parallel** (runs in the background) |
| Priority | Below hero (walk over), Same as hero (blocks), Above hero (drawn over) |
| Movement | Fixed, Random, Approach the hero; speed 1–5; walk animation on/off; Through |

The **command list** is a tree. Every list ends in a ◆ row; selecting a ◆ row and pressing Insert adds a command at that point, so branches (choices, conditional branches) are edited the same way as the main list. Commands are added from a picker grouped by category; locked ones show the chapter that unlocks them. Rows can be edited (double-click / Enter), deleted, moved up/down, copied and pasted (Ctrl+C / Ctrl+V within the list).

### Event commands

| Category | Command | Fields |
|---|---|---|
| Message | **Show Text** | speaker, face (any sprite), text (multi-line), position (bottom/middle/top) |
| | **Show Choices** | 2–4 options, a branch per option, which option Cancel picks |
| | **Comment** | text (ignored at run time) |
| Flow | **Conditional Branch** | switch / variable (=, ≠, ≥, ≤, >, <) / self switch / item / gold / hero in party; a Then branch and an optional Else |
| | **Wait** | seconds |
| | **Erase Event** | — (until the map is re-entered) |
| Game state | **Control Switch** | switch, ON/OFF/toggle |
| | **Control Variable** | variable, set/add/subtract/multiply/divide/modulo/random, value or another variable |
| | **Control Self Switch** | A–D, ON/OFF |
| Party | **Change Gold** | ± amount |
| | **Change Items** | item, ± amount |
| | **Change Party** | hero, add/remove |
| | **Change EXP** | hero or whole party, amount |
| | **Recover All** | — |
| Movement | **Transfer Player** | map, x, y, facing, fade |
| | **Set Move Route** | hero or an event; steps (move/turn/wait/jump), wait for completion |
| Scene | **Battle Processing** | troop, can escape, defeat continues (or game over), a Win branch and a Lose branch |
| | **Shop Processing** | goods |
| | **Game Over** | — |
| | **The End** | closing text; shows the credits and returns to the title |
| Screen & sound | **Fade Out / Fade In**, **Flash Screen** (colour, seconds), **Shake Screen** (power, seconds), **Tint Screen** (colour, seconds) | |
| | **Play Sound** | one of 24 sound effects |
| | **Play Music** | a music theme or silence |

### Text codes
`\v[n]` variable n · `\n[n]` hero n's name · `\p` the party leader's name · `\g` gold · `\c[n]` colour 0–7 (0 = normal) · `\i[n]` item n's name · `\.` short pause · `\|` long pause · `\!` wait for a key · `\>` show the rest instantly.

### Database
Tabs: **Heroes**, **Items**, **Skills**, **Enemies**, **Troops**, **Switches & Variables**, **System**. Each tab is a list on the left (add, duplicate, delete) and a form on the right with a live preview (the hero's walking sprite, the item's icon, the enemy's battle sprite, a troop as it will stand in battle).

- **Heroes:** name, class name, sprite, starting level, base HP/MP/ATK/DEF/MAG/SPD and gain per level, skills learned at levels, starting weapon/armour/accessory.
- **Items:** name, icon, kind (consumable, key item, weapon, armour, accessory), price, description; consumables: heal HP / MP (flat or %), revive, damage an enemy (with an element), usable in battle and/or menu; equipment: ATK/DEF/MAG/SPD bonuses.
- **Skills:** name, MP cost, kind (damage, heal, revive, buff ATK/DEF), power, element (none, fire, ice, bolt, holy, dark, wind), scope (one enemy, all enemies, one ally, all allies, self), animation.
- **Enemies:** name, battle sprite (family, palette, size), HP/MP/ATK/DEF/MAG/SPD, EXP, gold, up to three drops with chances, skills, weaknesses and resistances.
- **Troops:** a name and 1–6 enemies with their positions on the battlefield.
- **Switches & Variables:** names for switches 1–100 and variables 1–100.
- **System:** game title, subtitle, title screen style and music, starting party, starting gold, currency name, window skin, battle and victory music, "show game over" text.

### Sprite Forge
Build character sprites from parts: body (human, or the critter bodies), skin, hair style and colour, eyes, outfit (tunic, robe, armour, dress, coat, rags), outfit colours, headgear, accessory (cape, beard, scarf, glasses), and see all four facings walking. Forge sprites are saved in the project (as parts, not pixels) and appear everywhere a sprite can be chosen.

### Projects and files
- **Save** (Ctrl+S) writes the project to the browser (`localStorage`); there are any number of projects. **Autosave** runs 3 s after the last change.
- **Open** lists the saved projects with their size and date, and the **Sample Game** (*The Lantern of Fernhollow*, which uses every feature).
- **Download** writes `name.talewright.json`. **Import** reads one back (validated and migrated).
- **Export** (Chapter 8):
  - **Standalone game** — `name.html`: the runtime, the asset generators and the project in one file.
  - **Runtime player** — `talewright-player.html`: the runtime alone, which opens any `.talewright.json` by file picker, drag and drop, or `?game=url`.
  - **Project file** — the same as Download.

---

## 6. The runtime (an RPG)

### Screen
- A **320 × 240** pixel layer (tiles, characters, battle sprites) scaled to fit with `image-rendering: pixelated` (an integer scale when there is room), and a **UI layer** above it at full device resolution for windows and text, so any language and emoji in dialogue stay crisp.
- 16 × 16 tiles, characters 16 × 20 standing on their tile, 20 × 15 tiles on screen; the camera follows the hero and clamps to the map.

### Controls
| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | stick, d-pad | d-pad, or tap a tile to walk there |
| Confirm / talk | Z, Enter, Space | A | A button, or tap the event next to you |
| Cancel / menu | X, Esc | B | B button |
| Run | Shift (hold) | X (hold) | — |

### Map play
- Grid movement at 4 tiles/s (6 running), with tile-to-tile tweening and a three-frame walk.
- Events with Random and Approach movement walk on their own; Through events ignore collision.
- Random encounters count steps; the troop is chosen by weight.
- Map names show on entry when enabled.

### Interpreter
- One **main** interpreter runs action, touch and autorun events and blocks the hero while it runs. Each parallel event has its own interpreter.
- Commands run until one has to wait (a message, a choice, a wait, a move route, a battle, a shop, a fade). The interpreter is a stack of `{ list, index }` frames, so branches are just pushed lists.
- After any switch, variable, self switch, item or party change, every event on the map re-evaluates its page.
- A safety limit stops an autorun that loops 10 000 commands in one frame without waiting, with a message in playtest.

### Menu
Items (use, with a target), Skills (heal in the field), Equip, Status, Save (3 slots), Quit to title. Each in a window in the chosen skin.

### Battles
- Front-view, *Dragon Quest* style: the troop stands on a backdrop chosen by the map's battle background; the party is a status window.
- Each round every living hero picks **Attack / Skill / Item / Guard / Escape**, then everyone acts in order of SPD (±15 %).
- Damage: `max(1, (ATK × 2 − DEF) × (0.9…1.1))`, ×2 on a critical (5 %), ×1.5 to a weakness, ×0.5 to a resistance, halved by Guard. Magic uses MAG × 2 − DEF/2 + power. Heals: power + MAG.
- Enemies pick a skill (40 %, if they have MP) or attack, and target a random living hero.
- Victory gives EXP, gold and drops; level-ups raise stats by the hero's gains and teach skills. Defeat is Game Over unless the battle says defeat continues.
- Effects: hit flash, shake, floating damage numbers, an animation per skill (slash, fire, ice, bolt, holy, dark, wind, heal) made of particles.

### Saves
Three slots per game, in `localStorage` under a key made from the game's id. A save stores the map, position, facing, party (with HP, MP, EXP and equipment), inventory, gold, switches, variables, self switches, play time and steps. Playtests save under a separate key so they never touch the real game's saves. Every access is wrapped in try/catch: with storage blocked the game plays, it just can't save.

---

## 7. Generated assets

All asset code lives in the runtime, so the editor and an exported game draw exactly the same pixels.

### Tiles
A tile is a recipe: a painter and its colours, plus flags.
```js
{ n: 'Grass', p: ['grass', '#5aa03c', '#3f8130', '#7cc35a'], g: 'grass' }       // ground, edge group 'grass'
{ n: 'Water', p: ['water', '#2e6fc2', '#5fa0ea'], s: 1, a: 3, g: 'water' }      // solid, 3 animation frames
{ n: 'Oak',   p: ['tree', '#2f7a2a', '#1f5a1e', '#6b4423'], s: 1 }              // decor, solid
{ n: 'Counter', p: ['counter', '#9a6a3a', '#6e4826'], s: 1, c: 1 }              // talk across it
```
Painters (≈ 60: grass, flowers, water, lava, sand, path, cobble, plank floor, brick wall, roof, door, window, tree, pine, bush, rock, fence, bridge, stairs, table, bed, shelf, barrel, torch, pillar, throne, grave, cactus, cloud, console, …) draw into a 16 × 16 canvas with a seeded hash noise per tile, so tiles look hand-varied but identical every time. Tiles in an edge group draw a darker border on any side whose neighbour is in a different group, which gives shorelines, path edges and wall tops without a full autotile system.

Tilesets (≈ 40–48 tiles each): **Meadow**, **Village**, **Interior**, **Dungeon**, **Castle**, **Snow**, **Desert**, **Spooky Hollow**, **Starship**, **Sky Isles**.

Maps are baked into one offscreen canvas per layer group and animation frame (water and lava have three), so drawing a map is three `drawImage` calls.

### Characters
`spriteSheet(parts) → canvas` draws 4 facings × 3 walk frames at 16 × 20 from a parts object (`body, skin, hair, hairColor, eyes, outfit, c1, c2, head, acc`). The left facing is the right facing mirrored. About 30 presets (hero, heroine, knight, mage, priest, thief, elder, merchant, child, guard, king, queen, farmer, sailor, nun, bard, …) plus whatever the Forge makes.

**Objects** (chest closed/open, door closed/open, sign, crystal, barrel, pot, lever, campfire, spring, statue, gravestone, bed, book, star) are sprites with frames too, so a chest opens by switching pages.

### Monsters
`monster(spec) → canvas` draws a battle sprite from a family (slime, bat, wolf, goblin, skeleton, eye, mushroom, ghost, snake, imp, plant, drake, golem, wraith, mimic, dragon), a palette (eight swaps), and a size (S 32, M 48, L 64). Each is painted with canvas shapes at native resolution, then **pixelised**: alpha snapped to 0 or 1, a light/dark pass by neighbour (top-lit, bottom-shaded) and a one-pixel dark outline, so they read as pixel art at any scale.

### Icons
32 item icons at 12 × 12 (potion, ether, elixir, herb, bread, key, gem, coin, scroll, book, sword, axe, spear, bow, staff, dagger, shield, helmet, armour, robe, ring, amulet, boots, feather, bomb, crystal, map, letter, lantern, flower, bone, star), same pixelise pass.

### Window skins
Classic (navy gradient, white frame), Parchment, Midnight, Forest, Rose, Neon; each is a fill, a frame, a cursor colour and a text colour set drawn by the UI layer.

### Sound
- **Sound effects** (24): cursor, confirm, cancel, buzzer, open (chest), door, coin, item, heal, save, hit, critical, miss, slash, fire, ice, bolt, holy, dark, wind, level up, escape, encounter, step.
- **Music themes** (16): Village, Field, Dungeon, Castle, Battle, Boss, Victory (a jingle), Title, Mystery, Sorrow, and the Emporium's Haunted, Frost, Dunes, Starlight, Festival, Heroic. Each theme is a tempo, a mode, a chord progression, an instrument set and a seed; a look-ahead sequencer (25 ms tick, 100 ms window) generates bass, chords, an arpeggio, a lead melody from the chords and drums. The same theme always plays the same song.

---

## 8. Data formats

### Project (`*.talewright.json`)
```js
{
  format: 'talewright', version: 1,
  id: 'p_k3j9x', meta: { title, author, created, modified },
  system: {
    title: 'My Tale', subtitle: '', titleStyle: 'starfield', titleMusic: 'title',
    startMap: 1, startX: 9, startY: 7, startDir: 2,  // dir: 2 down, 4 left, 6 right, 8 up
    party: [1], gold: 100, currency: 'G', windowSkin: 'classic',
    battleMusic: 'battle', victoryMusic: 'victory', gameOverText: 'The tale ends here…',
  },
  maps: [{ id: 1, name: 'Meadow', w: 20, h: 15, tileset: 'meadow',
           layers: [[/* ground, w*h tile numbers, 1-based */], [/* decor, 0 = empty */], [/* over */]],
           events: [Event], music: 'field', battleBg: 'grass', encounters: [{ troop: 1, weight: 5 }],
           encRate: 30, showName: true }],
  actors:  [{ id, name, cls, sprite, level, stats: { hp, mp, atk, def, mag, spd }, gain: {…}, skills: [{ skill, level }], equip: { weapon, armor, acc } }],
  items:   [{ id, name, icon, kind, price, desc, hp, mp, pct, revive, dmg, element, battle, menu, atk, def, mag, spd }],
  skills:  [{ id, name, mp, kind, power, element, scope, anim }],
  enemies: [{ id, name, look: { family, palette, size }, stats: {…}, exp, gold, drops: [{ item, chance }], skills: [], weak: [], resist: [] }],
  troops:  [{ id, name, members: [{ enemy, x, y }] }],
  switches: ['', 'Met the elder', …], variables: ['', 'Apples', …],
  sprites: [{ id: 'f1', name: 'Wren', parts: {…} }],   // Forge sprites
}
```

### Event
```js
{ id: 3, name: 'Elder', x: 5, y: 4, pages: [{
    cond: { sw1: 0, sw2: 0, var: 0, varOp: '>=', varVal: 0, item: 0, self: '' },
    gfx: { kind: 'char', id: 'elder', dir: 2 },   // kind: 'none' | 'char' | 'obj'
    trigger: 'action',                              // 'action' | 'touch' | 'autorun' | 'parallel'
    priority: 'same',                               // 'below' | 'same' | 'above'
    move: 'fixed', speed: 3, walkAnim: true, through: false,
    list: [Command, …] }] }
```

### Commands
Each command is `{ t: type, …fields }`. Branching commands hold child lists: `choice.branches[i]`, `if.then`, `if.else`, `battle.win`, `battle.lose`.
```js
{ t: 'text', speaker: 'Elder', face: 'elder', text: 'Welcome, \\p!', pos: 'bottom' }
{ t: 'choice', options: ['Yes', 'No'], cancel: 1, branches: [[…], […]] }
{ t: 'if', cond: { kind: 'switch', id: 3, value: true }, then: […], else: […] }  // else: null = no Else
{ t: 'switch', id: 3, value: 'on' }                 // 'on' | 'off' | 'toggle'
{ t: 'var', id: 2, op: 'add', src: 'const', value: 1 }  // src: 'const' | 'var' | 'rand' (value..max)
{ t: 'self', key: 'A', value: true }
{ t: 'gold', amount: 50 }   { t: 'item', item: 2, amount: 1 }   { t: 'party', actor: 2, op: 'add' }
{ t: 'exp', actor: 0, amount: 30 }  { t: 'heal' }
{ t: 'transfer', map: 2, x: 4, y: 9, dir: 8, fade: true }
{ t: 'route', target: 'player', steps: ['u', 'u', 'tl', 'w'], wait: true }  // u d l r, t* turn, w wait, j jump
{ t: 'battle', troop: 1, escape: true, lose: 'gameover', win: […], loseList: […] }
{ t: 'shop', goods: [1, 2, 5] }
{ t: 'wait', sec: 0.5 }   { t: 'erase' }   { t: 'gameover' }   { t: 'end', text: 'Thanks for playing!' }
{ t: 'fadeout', sec: 0.5 }  { t: 'fadein', sec: 0.5 }  { t: 'flash', color: '#ffffff', sec: 0.4 }
{ t: 'shake', power: 4, sec: 0.6 }  { t: 'tint', color: '#00000000', sec: 1 }
{ t: 'sfx', name: 'open' }  { t: 'bgm', name: 'village' }   { t: 'comment', text: '…' }
```
`js/runtime/schema.js` creates every one of these with defaults, validates imported projects (unknown fields are dropped, missing ones filled, numbers clamped) and migrates older versions.

### Meta save (`localStorage['talewright.meta.v1']`)
`{ mode: 'story'|'free', chapter, seenScenes, quests: { id: true }, achievements: { id: { at, free } }, ink, inkEarned, owned: { shopId: true }, stats: { painted, events, commands, playtests, … }, settings: { theme, sound, music, volume, reduceMotion }, lastProject }`

---

## 9. Runtime architecture and the export

### 9.1 Why classic scripts in a registry
The runtime has to run in three places: inside the editor (playtest), inside an exported single HTML file, and inside the runtime player. ES modules can't be inlined into one file without a bundler, and fetching our own source fails on `file://`. So every runtime file is a classic script that registers a function:

```js
(window.TW_MODULES = window.TW_MODULES || []).push(['tiles', function (TW) {
    'use strict';
    // … defines TW.tiles
}]);
```

Booting is `const TW = {}; for (const [, f] of TW_MODULES) f(TW);`. Exporting is `fn.toString()` for each registered function, written into a new `<script>` in the same order, so the exported game runs *exactly* the code the editor ran, without fetch, a server or a bundler. Rules for runtime code that keep this safe:
- No imports, no references to anything outside `TW` and browser globals.
- Never write the characters `</script` in runtime source (the exporter also escapes the project JSON).
- `TW.css` holds the player's stylesheet as a string, so it travels with the code.

### 9.2 Files
| File | Defines |
|---|---|
| `runtime/core.js` | `TW.util` (clamp, hash noise, seeded RNG, colour helpers, deep clone), `TW.version`, `TW.css` |
| `runtime/tiles.js` | `TW.tiles`: painters, tilesets, `tileCanvas(set, n, frame)`, `bakeMap(map, opts)`, `isSolid(map, x, y)` |
| `runtime/sprites.js` | `TW.sprites`: character parts and presets, `sheet(idOrParts)`, objects, monsters, icons, faces |
| `runtime/audio.js` | `TW.audio`: context, sound effects, music themes and the sequencer |
| `runtime/input.js` | `TW.input`: keyboard, gamepad and touch into one button state with edges and a queue |
| `runtime/state.js` | `TW.State`: party, inventory, switches, variables, self switches, actor stats and levels, save/load serialisation |
| `runtime/schema.js` | `TW.schema`: defaults for every record and command, `newProject()`, `validate()` (rebuilds untrusted data field by field), `walk()`, `nextId()`. In the runtime so exported games and the player validate exactly as the editor does |
| `runtime/interp.js` | `TW.Interpreter`: the command interpreter; `TW.activePage()` |
| `runtime/ui.js` | `TW.ui`: window skins, text with codes, the message box, choices, lists, the party panel |
| `runtime/menus.js` | `TW.menus`: the main menu (items, skills, equip, status, save, quit), shops, save slots |
| `runtime/map.js` | `TW.MapScene`: map, characters, movement, collisions, events, encounters, routes, tap-to-walk, the camera, map drawing |
| `runtime/battle.js` | `TW.BattleScene` and the battle maths |
| `runtime/game.js` | `TW.Game`: scenes (title, map, battle, game over, The End), the loop, screen effects, hooks, the DOM and touch controls; `TW.mount()`, `TW.boot()`, `TW.player()` |

### 9.3 `TW.mount(root, project, opts) → game`
`opts`: `{ playtest, startOverride: { map, x, y }, onHook(name, data), saveKey, onExit, debug }`. Returns `{ destroy(), pause(), resume(), state, hooks }`. The editor calls it inside the playtest overlay; the exported file calls it on `document.body`.

### 9.4 The loop
`requestAnimationFrame`; game logic at a fixed 60 Hz step with an accumulator (at most 5 steps per frame), rendering once per frame; paused when the tab is hidden (and audio suspended).

### 9.5 Scenes
`title → map ⇄ (menu, battle, shop) → gameover / end → title`. Battles and shops are pushed over the map and pop back to it. The message box and choices are UI overlays owned by the interpreter, not scenes.

### 9.6 Hooks
`start, text, choice (index), item (id, n), gold (n), transfer (map), battleStart (troop), battleWin, battleLose, escape, shopBuy (id), equip, levelUp (actor, level), save, load, ending, gameover, switch (id, value), variable (id, value), step`. The editor turns these into quest and achievement progress.

### 9.7 The export template
```html
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{{title}}</title><style>{{TW.css}}</style></head>
<body><script>window.TW_MODULES = [];</script>
<script>/* one push per runtime module, from fn.toString() */</script>
<script>window.TW_GAME = {{project JSON, with < escaped as <}};</script>
<script>(function () { var TW = {}; TW_MODULES.forEach(function (m) { m[1](TW); }); TW.mount(document.body, TW_GAME, { saveKey: 'tw.' + TW_GAME.id }); })();</script>
</body></html>
```
The runtime player is the same file without `TW_GAME`; it shows a "Open a .talewright.json" screen.

---

## 10. Editor architecture

| File | Role |
|---|---|
| `js/main.js` | Boot: build `TW`, load the meta save, open the last project, wire the toolbar, keyboard shortcuts |
| `js/editor/store.js` | The open project, undo/redo, dirty flag, autosave, the project library in `localStorage` |
| `js/editor/bus.js` | A tiny event bus (`on`, `off`, `emit`) for edit events |
| `js/editor/mapview.js` | The map canvas: drawing, tools, selection, events on the map, zoom/pan, touch |
| `js/editor/palette.js` | The tile palette with rectangle selection |
| `js/editor/maplist.js` | Map list and map properties dialog |
| `js/editor/eventedit.js` | The event editor: pages, conditions, graphic, trigger, command tree |
| `js/editor/commands.js` | Command catalogue: labels, categories, required unlocks, defaults, `describe(cmd)`, `form(cmd)` |
| `js/editor/database.js` | The database dialog and its tabs |
| `js/editor/forge.js` | Sprite Forge |
| `js/editor/pickers.js` | Sprite, icon, monster, item, map-position, colour, sound and music pickers |
| `js/editor/ui.js` | Modal, form fields, toasts, menus, confirm/prompt |
| `js/editor/playtest.js` | The playtest overlay (mounts the runtime, relays hooks) |
| `js/editor/exporter.js` | Standalone HTML, runtime player and JSON downloads |
| `js/editor/templates.js` | Quick event templates |
| `js/editor/sample.js` | *The Lantern of Fernhollow*, the sample game |
| `js/meta/progress.js` | Meta save, Ink, rank, unlock checks (`has(feature)`), stats |
| `js/meta/story.js` | Chapters, scenes and the Blot's lines |
| `js/meta/quests.js` | Quest definitions and the evaluator |
| `js/meta/achievements.js` | Achievement definitions and the evaluator |
| `js/meta/shop.js` | The Inkwell Emporium |
| `js/meta/mentor.js` | The cast drawn in code (Quillon, Mott, the Blot, the First Talewright's note), the mentor panel and the story scene player |
| `js/meta/atelier.js` | The controller: edit events and playtest hooks → stats and Ink; quests, trophies and chapter changes; the Trophy Case, Emporium, Journal and Settings; the Blot's whispers |

### Feature ids
Unlock checks use ids such as `tool.rect`, `layer.over`, `events`, `cmd.choice`, `db.enemies`, `maps.many`, `export`, `forge`, `tileset.snow`, `sprites.critters`, `music.haunted`, `skin.neon`, `theme.synthwave`. `progress.has(id)` is true in Free Mode, when the chapter that grants it is finished, or when it was bought.

---

## 11. Rules that keep it fair and robust

1. **Quests are checks, not scripts.** A quest is satisfied by the project's state or by a recorded playtest hook. There is no "click here now" railroading.
2. **Once earned, always earned.** Quests and achievements are stored; undo cannot revoke them.
3. **Locks prevent adding, never using.** A locked command already in a project (from Free Mode or an import) still shows, edits and runs; you just can't add another until it unlocks.
4. **Ink can't buy tools.** The Emporium sells assets and cosmetics only.
5. **Storage can fail.** Every `localStorage` access is guarded. With storage blocked the Atelier warns once, keeps working in memory, and Download still saves your work.
6. **Imported data is untrusted.** `validate()` rebuilds a project field by field from defaults, clamps sizes and counts, and drops anything it doesn't know. Text is only ever drawn to a canvas or set with `textContent`, never as HTML.
7. **Exports never depend on the editor.** The exported file is tested by opening it on its own (§ 13).

### 11.2 Edit events (editor → meta)
`paint (count), fill, erase, eventCreate, eventEdit, commandAdd (type), mapCreate, dbCreate (kind), spriteForge, playtest, save, download, import, export (kind), undo, shopBuy, sample`.

---

## 12. Sample game: *The Lantern of Fernhollow*
Available from Open at any time (it is the Atelier's own example; opening it is an achievement). A short complete RPG that uses every feature, so it doubles as the export test fixture:
- **Fernhollow** (village): an elder who gives the quest (choices, switches), an inn, an item shop and a weapon shop, a wandering cat, a sign, a chest, a house interior.
- **Whisperwood** (field): random encounters (slimes, bats, wolves), a healing spring, a lost child (a party member who joins), a switch-gated bridge.
- **Hollow Cave** (dungeon): dark tiles, torches, chests, a lever puzzle with a variable, the Gloom Wisp boss (autorun cutscene, shake, flash).
- The ending: the lantern is relit, The End.

---

## 13. Testing

| Harness | Checks |
|---|---|
| `dev/simtest.mjs` (Node, no browser) | The runtime registry loads in a `vm` sandbox with a fake canvas; export purity; every tile, sprite, object, monster, icon and song builds; `validate()` round-trips the sample and clamps hostile input; the interpreter runs text, codes, choices, switches, variables, self switches, conditionals, items, gold, party, EXP and level-ups, transfers, battles (win, lose-and-continue, game over), shops and The End; chest pages; save/load; the loop guard; the battle maths; every sample event is reachable; every quest and trophy can be earned and none fires on a blank project; a bot plays the sample from the title to The End; a mortal bot's balance runs. About 1,700 checks. |
| `dev/browsertest.mjs` (Playwright) | Story mode through the real UI (mode choice, prologue, painting, undo/redo, start flag, playtest, Chapter 0 finishing, an event built in the event editor and talked to in a playtest); Free Mode with every dialog and Database tab; buying from the Emporium; a full playtest of the sample (intro, menu, battle, shop); **Export, then the exported HTML opened by itself from `file://` and played**; the runtime player opening the project file; Download and Import; a touch-only phone; blocked storage. See [dev/README.md](dev/README.md). |

---

## 14. Build plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Docs: this plan and the player's manual (`MANUAL.md`) | done |
| 2 | Runtime: core, tiles, sprites, audio, input, state | done |
| 3 | Runtime: interpreter, map scene, UI, battle, game, mount | done |
| 4 | Editor: schema, store, map view, palette, map list | done |
| 5 | Editor: event editor and commands, templates | done |
| 6 | Editor: database, Forge, pickers | done |
| 7 | Editor: playtest, export, import/download, sample game | done |
| 8 | Meta: progress, story, quests, achievements, Emporium, mentor | done |
| 9 | Harnesses, repo integration (launcher, README, status, changelog, learnings) | done |

## 15. Open questions
- **Autotiles.** Edge groups give shorelines and wall tops cheaply, but not RPG Maker's 47-piece autotile corners. Worth it later for water and cliffs.
- **Common events and plugins.** Deliberately out of v1. A "Common Events" tab (reusable command lists called from events) is the most-wanted next feature.
- **Image import.** Everything is procedural so exports stay tiny and self-contained; importing PNG tilesets as data URLs would be easy but would bloat saves past `localStorage` limits.
