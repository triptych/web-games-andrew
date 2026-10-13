# The Talewright's Manual

*A handbook for apprentices of the Atelier of Unwritten Worlds.*

TALEWRIGHT is an RPG maker that is also a game. You build a real role-playing game, with maps, characters, dialogue, items, monsters and battles, and while you build it the Atelier's story unfolds, quests guide you to each tool, and you earn Ink, ranks, achievements and new assets. When you are done, you can export your game as one HTML file that anybody can play in a browser.

This manual covers everything. Quillon (the quill in the side panel) will teach you the same things in a friendlier voice, one at a time.

---

## Getting started

1. **Choose a mode.** *Story Mode* starts with a blank page and a pencil; every chapter restores more tools. *Free Mode* unlocks everything at once (quests and achievements still count, marked ✦). You can switch to Free Mode later in ⚙ Settings.
2. **Paint.** Pick a tile in the palette on the left and draw on the map. Ground first, then Decor (trees, rocks, furniture).
3. **Place the start.** Choose the ⚑ Start tool and click where the hero begins.
4. **Playtest.** Press ▶ Playtest (or F5) to play what you have made. Press ✕ Close (or F5 again) to return to the editor. Inside the game, Esc opens the game's own menu.

Your project autosaves to this browser a few seconds after each change. Use **Project ▸ Download** to keep a copy as a file.

---

## The screen

| Area | What it holds |
|---|---|
| Top bar | Project menu, Database, Forge, Playtest, Export, your Ink ✒, your Maker Rank, the Trophy Case 🏆, the Emporium 🛍, the Journal 📖, Settings ⚙ |
| Left | The map list (click to open, ⋯ for properties) and the tile palette |
| Centre | The map, with the tool bar and the layer switch above it |
| Right | Quillon and the chapter's quests |
| Bottom (phones) | Buttons to open the left and right panels as drawers |

---

## Painting maps

### Layers
- **Ground** — the floor of the world: grass, water, sand, floors, walls. Every cell has a ground tile.
- **Decor** — things that stand on the ground: trees, bushes, rocks, fences, furniture. Many of them block movement.
- **Over** — things drawn *above* the hero: treetops, roof edges, archways. Over tiles never block.
- **Events** — the people and things that do something (see below).

Click a layer name to make it current. *Dim others* fades the layers you are not editing.

### Tools
| Tool | Key | Use |
|---|---|---|
| ✎ Pencil | B | Paint the selected tile (or block of tiles). Drag to paint a line. |
| ▭ Rectangle | R | Drag a box; it fills with the selected tile. |
| ◉ Fill | G | Fill the connected area of matching tiles on the current layer. |
| ⌫ Eraser | E | Clear Decor or Over tiles (on Ground it paints the first tile of the set). |
| 💧 Eyedropper | I | Pick the tile under the cursor on the current layer. Alt+click does this with any tool. |
| ★ Event | V | Click an empty cell to create an event, click an event to select it, drag to move it, double-click to edit. |
| ⚑ Start | — | Set where the party starts a new game. |

**Blocks of tiles:** drag across the palette to select a rectangle of tiles and stamp it in one go (great for houses).

**Zoom** with the − / + buttons or Ctrl+wheel. **Pan** with the scroll bars, the middle mouse button, by holding Space and dragging, or with two fingers. **Undo** Ctrl+Z, **Redo** Ctrl+Y (or Ctrl+Shift+Z).

**Right-click** (long-press on touch) on the map for quick event templates, *Set start here* and *Playtest from here*.

### Map properties (⋯ next to a map)
Name, size (10–120 on each side; resizing keeps the top-left), tileset, music, battle background, whether its name shows on entry, and **random encounters**: add troops with weights, and set how many steps on average pass between fights (0 turns them off).

---

## Events

An event is anything on the map that does something: a villager, a chest, a door, a sign, an invisible trigger in front of a bridge.

### Pages
Every event has at least one page. The game shows the **last page whose conditions are all true**. That is how a chest opens: page 1 is a closed chest that gives an item and turns its self switch A on; page 2 needs self switch A and shows an open, empty chest.

**Conditions** (all optional): a switch is ON (two slots), a variable is at least a value (or another comparison), the party has an item, one of the event's own self switches (A–D) is ON.

**Graphic:** nothing (an invisible event), a character (any preset or a Forge sprite) facing a direction, or an object (chest, door, sign, crystal…).

**Trigger:**
- *Action* — when the hero faces it and presses Confirm (or stands on it, if it is below the hero).
- *Touch* — when the hero walks into it, or it walks into the hero.
- *Autorun* — as soon as this page is active. The hero can't move until it finishes, so make sure it changes a switch or erases itself, or it will run forever.

A page with **no graphic and no commands** makes the event vanish: it neither shows nor blocks. That is the usual way to remove a guard or a gate once a switch is on: give it an empty last page that needs the switch.
- *Parallel* — runs in the background over and over, without stopping the hero.

**Priority:** *Below hero* (walk over it, like a floor switch), *Same as hero* (blocks, like a person), *Above hero* (drawn over the hero).

**Movement:** *Fixed*, *Random* (wanders), *Approach* (walks toward the hero). Speed 1–5. *Through* lets it walk through walls and others.

### The command list
Commands run top to bottom when the event triggers. Every list ends with a ◆ row.

- Select a row (or a ◆) and press **Insert** (or double-click the ◆) to add a command *above* it.
- **Double-click** a command (or select it and press Enter) to edit it. **Delete** removes it. **↑ / ↓** move it. **Ctrl+C / Ctrl+V** copy and paste.
- Branching commands (Show Choices, Conditional Branch, Battle Processing) have their own indented lists with their own ◆ rows.

### Quick templates
Right-click the map (or use the template menu in the Event tool): **NPC**, **Sign**, **Chest**, **Door** (transfer), **Shopkeeper**, **Inn**, **Monster** (touch to fight, disappears when beaten), **Healing Spring**, **Save Crystal**. Each one creates a ready-made event that you can edit.

---

## Command reference

### Message
- **Show Text** — a dialogue box. *Speaker* is shown in a name tag; *Face* shows any sprite's face beside the text; *Position* is bottom, middle or top. Use several Show Text commands for several boxes.
- **Show Choices** — two to four options. Each option has its own branch. *On cancel* says which branch the Cancel button takes (or "not allowed").
- **Comment** — a note to yourself. Ignored by the game.

### Flow
- **Conditional Branch** — runs *Then* if a condition is true, otherwise *Else* (if you turned Else on). Conditions: a switch is ON/OFF; a variable compared with a number or another variable; a self switch; the party has an item; gold is at least an amount; a hero is in the party.
- **Wait** — pause for some seconds.
- **Erase Event** — the event disappears until the map is entered again.

### Game state
- **Control Switch** — turn a switch ON, OFF or toggle it. Switches are flags shared by the whole game ("Talked to the elder", "Bridge repaired").
- **Control Variable** — set, add, subtract, multiply, divide or take the remainder; the value can be a number, another variable or a random number in a range. Variables are numbers shared by the whole game ("Apples collected").
- **Control Self Switch** — this event's own A–D flags. Two chests can both use self switch A without interfering.

### Party
- **Change Gold**, **Change Items** — positive gives, negative takes.
- **Change Party** — add or remove a hero.
- **Change EXP** — give EXP to one hero or the whole party (heroes level up as usual).
- **Recover All** — full HP and MP for everyone, and revives the fallen.

### Movement
- **Transfer Player** — move the party to a map and tile, facing a direction, with or without a fade. Pick the spot by clicking on a small map.
- **Set Move Route** — make the hero or an event move: step up/down/left/right, turn, wait, jump. *Wait for completion* holds the event until the route finishes.

### Scene
- **Battle Processing** — fight a troop. *Can escape*, and *If defeated*: game over, or continue (the Lose branch runs). The Win branch runs after a victory.
- **Shop Processing** — open a shop selling the goods you list. Players can also sell their items for half price.
- **Game Over** — show the game over screen and return to the title.
- **The End** — show your closing text and the credits, then return to the title.

### Screen and sound
- **Fade Out / Fade In** — to and from black.
- **Flash Screen** — a quick flash of a colour.
- **Shake Screen** — power and duration.
- **Tint Screen** — tint the whole screen (dusk, night, a cave), and back to normal with a transparent colour.
- **Play Sound** — one of 24 sound effects.
- **Play Music** — change the music; *(none)* stops it. Map music plays automatically when a map is entered.

### Text codes
Write these inside Show Text:

| Code | Becomes |
|---|---|
| `\v[3]` | the value of variable 3 |
| `\n[1]` | hero 1's name |
| `\p` | the party leader's name |
| `\g` | the party's gold |
| `\i[2]` | item 2's name |
| `\c[2]` … `\c[0]` | colour the text (0 normal, 1 blue, 2 red, 3 green, 4 yellow, 5 purple, 6 orange, 7 grey) |
| `\.` / `\|` | a short / long pause |
| `\!` | wait for a key press |
| `\>` | show the rest of the box at once |

---

## The database

Open with **Database** (or F9).

- **Heroes** — the party members. Name, class, sprite, starting level, base stats (HP, MP, ATK, DEF, MAG, SPD) and how much each grows per level, skills and the level they are learned at, starting equipment.
- **Items** — consumables (heal HP or MP by an amount or a percentage, revive, or damage an enemy in battle), key items (can't be used or sold), and equipment (weapons, armour, accessories that raise stats). Price is the shop price; selling pays half.
- **Skills** — MP cost, kind (damage, heal, revive, raise ATK, raise DEF), power, element, scope (one or all enemies, one or all allies, self) and the animation.
- **Enemies** — the battle sprite (family, colours, size), stats, EXP and gold, up to three item drops with chances, skills, and weaknesses (×1.5 damage) and resistances (×0.5).
- **Troops** — groups of enemies that fight together. Drag them to arrange the battlefield.
- **Switches & Variables** — give your switches and variables names, so commands read like sentences.
- **System** — your game's title and subtitle, title screen style and music, starting party and gold, currency name, window skin, battle and victory music, game over text.

### How battles work
Each round, every hero chooses **Attack**, **Skill**, **Item**, **Guard** (halves damage taken this round) or **Escape**. Then everyone acts in order of SPD, with a little randomness. Physical damage is about ATK × 2 − DEF; magic is about MAG × 2 + power − DEF ÷ 2. One hit in twenty is critical (×2). Defeating the troop gives EXP, gold and any drops. A hero who reaches 0 HP is down until revived; if everyone is down, the battle is lost.

**Level curve:** a hero needs about 10 × level² EXP for each level, and gains their per-level stat growth on each level up.

---

## The Sprite Forge

Open with **Forge**. Make your own characters from parts: body, skin tone, hair style and colour, eyes, outfit and its two colours, headgear and an accessory. The preview walks in all four directions. Saved sprites appear in every sprite picker, in the Hero tab and in Show Text faces. Some parts come from the Emporium.

---

## Saving, downloading and exporting

- **Project ▸ Save** (Ctrl+S) saves to this browser. Autosave does it for you a few seconds after each change.
- **Project ▸ Open** lists your projects and the **Sample Game**, *The Lantern of Fernhollow*. Open it to see how a complete game is put together.
- **Project ▸ New** starts a new project.
- **Project ▸ Download** saves `your-game.talewright.json` to your computer. **Import** opens one.
- **Export** (unlocked in Chapter 8, or in Free Mode):
  - **Standalone game** — one `.html` file with the engine and your game inside. Double-click it to play, put it on any web host, or upload it to itch.io as an HTML game.
  - **Runtime player** — `talewright-player.html`, the engine alone. Open it and pick any `.talewright.json` file to play it. Hosted on a website, `talewright-player.html?game=my-game.talewright.json` loads that file directly.

Browser storage can be cleared or blocked. If it is, the Atelier tells you, keeps working, and Download still saves your work. Download your project now and then.

### Playing an exported game
| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | stick or d-pad | the d-pad, or tap a tile |
| Confirm, talk, open | Z / Enter / Space | A | A |
| Cancel, menu | X / Esc | B | B |
| Run | hold Shift | hold X | — |

The in-game menu (Cancel on the map) has Items, Skills, Equip, Status, Save and Quit. There are three save slots per game.

---

## The Atelier (the game around the maker)

- **Chapters** — nine chapters, each restoring a Glyph and its tools. Finish a chapter's quests to finish the chapter.
- **Quests** — shown on the right. Each quest checks your real project, or something that really happened while you playtested. *Show me* points at the tool you need.
- **Ink ✒** — earned by building: painting, making events and database entries, playtesting, finishing quests and earning achievements. Spend it in the Emporium.
- **Maker Rank** — twenty ranks from Blank Page to Worldsmith, from the Ink you have ever earned.
- **Trophy Case 🏆** — forty achievements, some hidden.
- **Inkwell Emporium 🛍** — Mott's shop. Tilesets, sprite parts, monster packs, music themes, window skins for your games, themes for the Atelier, and a hat for Quillon. Never tools: those you earn.
- **Journal 📖** — replay any story scene you have seen.
- **Settings ⚙** — sound, music, volume, the Atelier's theme, reduced motion, Free Mode, and resetting progress (your projects are kept).

---

## Keyboard shortcuts (editor)

| Keys | Action |
|---|---|
| Ctrl+S | Save |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| F5 or Ctrl+Enter | Playtest |
| F9 | Database |
| B R G E I V | Pencil, Rectangle, Fill, Eraser, Eyedropper, Event tool |
| 1 2 3 4 | Ground, Decor, Over, Events layer |
| + / − | Zoom |
| Delete | Delete the selected event |
| Ctrl+C / Ctrl+V | Copy / paste the selected event (or command, in the event editor) |
| Esc | Close a dialog |

---

## Tips from Quillon

- *"Begin small. A village of three houses, finished, is worth more than a kingdom of empty fields."*
- *"Name your switches. 'Switch 7' means nothing to you in a month; 'Bridge repaired' always will."*
- *"An autorun event that never turns itself off will hold your hero forever. Turn on a switch, then make a second page that waits for it."*
- *"Playtest often. The game you imagine and the game you made are different games until you play them."*
- *"Download your project. Browsers forget. Files remember."*
