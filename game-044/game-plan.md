# The Story Thief of Greymantle

**Genre:** Point-and-click fairy-tale adventure (King's Quest / Fighting Fantasy)
**Engine:** None — vanilla HTML, CSS and ES modules; Canvas 2D for scenes, DOM for text and menus
**Target Resolution:** 320 × 200 native, scaled up with hard pixels
**Status:** Complete — 10 scenes, 15 items, 3 endings, 8 deaths

---

## Concept

On the longest night of the year, the stories of Brackenford are vanishing. Old Mab
Ashby, the village storyteller, opens her Book of Tales and finds it blank; by
bedtime she has forgotten her grandchild's name. Up on Greymantle a light burns in
the Warlock's tower. Rowan takes the Book, a lucky penny and a honey cake, and goes
to bring the stories home.

It's a Sierra-style adventure in the King's Quest mould: walk-to-click, a verb bar,
a satchel of odd objects, light puzzles, and deaths you can undo. From *The Warlock
of Firetop Mountain* it takes the mountain, the warlock, the second-person voice and
the sense that every choice is being written down. The emphasis is on **story**.
Every hotspot has prose, most puzzles are solved by understanding a character, and
the Warlock isn't a villain. He is a father looking for an ending.

The twist: Corvin Hale's daughter Elsie fell asleep three winters ago waiting for
the end of a bedtime story he stopped telling when her mother died. He has been
bottling every story in the valley and weaving endings from them on the Story Loom,
looking for one that will wake her. None of them is hers.

---

## Core Mechanics

### 1. Walk, Look, Use, Talk
A four-verb bar (Sierra's icon bar, simplified). Right-click cycles verbs and keys
1–4 pick them. Hovering names the hotspot ("Look at the old well"). Rowan walks to
the thing first, then acts; a new click cancels the walk but never a running script.

### 2. The satchel
Click an item to hold it, then click the scene to use it there, or click another
item to combine the two. Look at an item to examine it. Items can be used on Rowan
too (drinking the sleeping draught is a mistake).

### 3. Puzzles
A light chain with two optional branches. Every puzzle is hinted by a character
or by prose:

| Puzzle | Solution | Hinted by |
|---|---|---|
| Glint in the well | Rope on the well | Well description |
| Troll wants a story as toll | Honey cake (he "tastes" one) | Gran ("take something to eat"), Gubbins ("ones with dinners in") |
| Magpie's golden feather | Gran's lucky penny ("loved things shine different") | Pell, Tatters |
| Sleeping draught | Moonbells to Wenna | Wenna, the empty jar on her shelf |
| Brimble the hound | Bone + draught = Drowsy Bone | Wenna's bath-time story |
| Graniteface's three riddles | A book, Sleep, A story | Wenna ("think like a child at bedtime") |
| Gran's bottle on the top shelf | Poker unjams the ladder | Ladder description |
| Tower door | Silver key from the journal's spine | Reading the journal |
| Music box | Brass key from the well | Wenna recognises it |
| The Warlock | Give him the Unfinished Tale **and** the golden quill | Diary, Wenna, the tale itself, trying the quill on the tale |

### 4. Deaths (and turning back a page)
Eight Sierra-style deaths, each a short comic epilogue: the well, the troll, the
river, the cliff edge, the hound, an uncorked bottle, the Warlock and the draught.
Every one asks first ("Climb down anyway / Better not"). The death page offers
**Turn back a page**, which restores the snapshot taken just before the fatal
action, so nothing is lost.

### 5. The Book of Tales (the Chronicle)
Gran's blank book slowly writes Rowan's adventure in a storybook third person as
it happens: sixteen possible entries, opened with 📖 / B. The game's closing line
is "You're reading it now."

### 6. Score and endings
Points in the Sierra style (200 total), each earnable once. Three endings:

| Ending | How | Points |
|---|---|---|
| **The Keeper's Daughter** | Give Corvin the Unfinished Tale and his golden quill; he finishes the story himself and Elsie wakes | 45 |
| **The Gift of Rowan** | Offer the Loom your own story; Elsie wakes, you forget yourself, and Gran tells you who you are | 30 |
| **The Broken Loom** | Smash the Loom with Gran's poker; the stories go home but Elsie sleeps on | 15 |

Endings found are remembered across playthroughs. After an ending, **Continue**
resumes from the autosave taken on entering the sanctum, so the other endings are
one click away.

---

## Game Loop

Explore a scene → look at everything → talk to whoever is there → pick things up →
work out who needs what → move on. A full playthrough is about 45–60 minutes. The
main route is linear (village → bridge → pines → mountain → library → sanctum), and
Wenna's cottage and the tower are side branches you must visit.

---

## Player Controls

| Action | Input |
|--------|-------|
| Walk / Look / Use / Talk | Verb bar, or keys 1–4; right-click cycles |
| Act | Left click / tap on the scene |
| Use an item | Click it in the satchel, then click the scene (or another item) |
| Examine an item | Look verb, then click the item |
| Advance text | Click / tap, Space, Enter |
| Choose in dialogue | Click, or keys 1–9 |
| Book of Tales | 📖 or B |
| Menu (save, load, sound, text speed) | ☰ or Esc (Esc first drops a held item) |

---

## Scenes

| # | Scene | Who's there | What happens |
|---|---|---|---|
| 1 | Gran's Cottage | Gran, Button the cat | Prologue; the Book, the penny, cake, rope, poker |
| 2 | Brackenford Green | Pell | The well (brass key); give Pell an ending; notice board |
| 3 | Grumblewater Bridge | Gubbins the troll | The toll |
| 4 | Whispering Pines | Tatters the magpie | Moonbells; the penny-for-quill trade |
| 5 | Wenna's Cottage | Wenna | Elsie's story; the draught; the soup bone |
| 6 | The Door of Greymantle | Graniteface | Three riddles; the cliff edge |
| 7 | Hall of the Hound | Brimble | The drowsy bone; the lighthouse carving |
| 8 | Library of Bottled Stories | — | Ladder, Gran's bottle, the journal, the silver key |
| 9 | Elsie's Chamber | Elsie (asleep) | Diary; music box; the Unfinished Tale |
| 10 | Heart of the Mountain | Corvin Hale | The Story Loom; all three endings |

---

## Art

- Scenes are **painted in code** at 320×200 with gradients, radial glows and shape
  brushes (`paint.js`). Each is then reduced to a 37-colour palette through a 4×4
  Bayer dither (`palette.js`). Colours already on the palette are left alone, so
  flat shapes stay crisp and only blends dither, which gives the late-80s look.
  Scenes repaint only when a flag they depend on changes (`bgKey`).
- **Rowan** is a paper-doll sprite (`sprites.js`) built per frame from parts and
  cached: four directions, an eight-step walk cycle, a reach pose, and perspective
  scaling by depth.
- **NPCs** are drawn from rectangles each frame (`npcs.js`), with breathing,
  blinking, and mouths that move while they speak.
- **Items and verb icons** are 16×16 shapes, palette-snapped and outlined
  (`items.js`); the cursor becomes the current verb or item.
- No asset files of any kind.

## Sound Design

All Web Audio, no files (`sounds.js`).

| Sound | Trigger | Style |
|-------|---------|-------|
| Ambience beds | Each scene | Filtered noise: hearth crackle, river, wind with a slow swell, cave drone, magic shimmer |
| Elsie's lullaby | Music box; the good ending | Sine music-box bells in 3/4 |
| Points | Score awarded | Rising four-note chime |
| Chronicle | Book writes a line | Pen-scratch noise + high bell |
| Woof, grumble, caw, munch, snore | Characters | Swept oscillators + noise |
| Stone door | Riddles solved | Low rumble |
| Death | Death page | Descending triangle notes |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Engine: scene loading, frame loop, input, walk-then-act, the `G` script API, deaths, endings, title |
| `ui.js` | DOM: narration/dialogue box, choices, verb bar, satchel, toasts, Book of Tales, menu, storybook pages |
| `state.js` | Inventory, flags, score table, chronicle, save/load/snapshot, endings found, prefs |
| `walk.js` | Walkable polygons → 2px grid, A* with string-pulling, hotspot shape tests |
| `paint.js` | Painting brushes: gradients, glows, ridges, mountains, pines, stones, planks, ripples |
| `palette.js` | The palette and the Bayer-dither quantizer |
| `sprites.js` | Rowan's paper-doll frames and dithered shadow |
| `npcs.js` | The cast, drawn per frame |
| `items.js` | Item names, descriptions, icons; verb icons; cursors |
| `art.js` | Title painting; tombstone |
| `sounds.js` | SFX, ambience, lullaby |
| `events.js` | EventBus |
| `scenes/*.js` | One module per location; `common.js` holds combos, self-use and fallbacks |

### The scene contract
See the header of `js/scenes/index.js`. Handlers are strings (spoken as
narration) or `async (G) => {}` scripts:

```js
async use(G) {
    await G.say('You lower yourself into the dark.');
    G.give('brasskey');
    G.award('wellKey');
    G.chron('well', 'Rowan climbed down the Brackenford well…');
}
```

---

## Testing

`dev/walkthrough.mjs` plays the whole game through the real UI: verb clicks,
scene clicks, satchel clicks and dialogue choices, with no teleporting. It checks
every puzzle gate, the perfect 200-point route to the best ending, the other two
endings via Continue, and deaths followed by "Turn back a page". `dev/shots.mjs`
screenshots any scenes. See `dev/README.md`.

---

## Changelog

### v1.0 (2026-09-26)
- Ten painted scenes, eight characters, fifteen items, three endings, eight deaths
- Book of Tales chronicle, Sierra-style score, save/load/autosave, endings memory
- Procedural audio, including Elsie's lullaby
- Walkthrough harness covering every ending
