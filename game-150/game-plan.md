# Folio & Fable

**Genre:** cozy fantasy shop management (bookshop) with light RPG systems: quests, crafting, a story
**Engine:** vanilla HTML/CSS/JS modules, sim/view layout. The shop is Canvas 2D, the sheets are DOM, and every book is
procedurally generated and drawn in 3D with three.js r165 (import map). Art, music, effects and voices by ElevenLabs;
the books themselves are made in code.
**Status:** v1.0.0

---

## Concept

Tam is an orphan who reads the shop signs in the rain because no one ever gave her a book. One evening a book finds
her: **Old Vellum**, an ancient talking tome with brass spectacle eyes, who leads her to **Folio & Fable**, the shop his
late owner **Elowen Inkwright** kept for forty years in the little town of **Larkspur**. The shop is hers now.

It is a low-stakes, cozy game about books and what they do to the people who read them. Tam arranges the shop like a
doll's house, sells books to adventurers, nobles, actors, bakers, scholars, farmers and children, grants their wishes,
sends adventurers out to find more books, binds her own at the bindery, and watches the town come alive: a baker tries
a recipe, a playhouse stages a novel, a guild of young heroes quotes a bestiary. Nothing can be lost. A customer who
waits too long wanders off; a commission that lapses costs nothing; a poor expedition still brings something home.

Riffs on: shop sims like Recettear and Moonlighter (sell what adventurers bring back), cozy decoration games (place
furniture for coziness), RPG smithing (the bindery), and Stardew-style town progress (the inspirations).

## Core loop: one day

1. **Morning.** Overnight, adventurers come home with loot, the donation basket leaves a few old books on the step,
   commissions lapse quietly, and every third morning Ottoline the travelling badger trader arrives. Tam arranges
   furniture, shelves books, gives adventurers books to carry and sends them out, binds books and shops the trader.
2. **Open.** The shop clock runs 9:00–17:00 (80 s at 1×; 2× and 3× speeds). Customers come in, browse a shelf chosen
   by its appeal and their taste, and pay at the counter, or bring a wish to the counter and wait (with a patience
   ring). The clock stops while Tam serves. "Close early" sends nobody else in.
3. **Evening.** A summary of the day, Old Vellum's tip, and one book to read by lamplight. Skill manuals teach Tam
   skills that stay. Sleep → the next morning.

## Mechanics

All numbers live in `js/config.js` and `js/sim/data.js`; the rules are in `js/sim/game.js`.

### The shop (arranging)
- A row of `width` spots (6, renovated to 8, 10, 12 for 120 / 260 / 480 gold). Each spot has a **wall** cell and a
  **floor** cell.
- Wall: **Bookshelf** (12 books), Dragon Painting, Hanging Ivy. Floor: **Display Table** (3 books, featured),
  Reading Armchair, Fringed Lamp, Potted Fern, Cat Basket (one cat).
- **Coziness** = the sum of each piece's cozy value (a third copy of a type counts half) + 4 with Cozy Keeping. It adds
  visitors (`3 + cozy/6 + renown/15`, max 12, plus the bakery's), browsing tries and the chance to buy.
- **Appeal** of a shelf or table: 1 (1.4 for a table), +0.35 for wall decor beside it, +0.45 for a floor piece in front
  (+0.25 beside), +0.6 for a **section** (four or more books of one kind). Customers choose shelves weighted by appeal ×
  how much of the shelf they like.

### Customers
- Eight kinds (adventurer, noble, actor, baker, shopkeeper, scholar, farmer, child) with favourite kinds of book,
  favourite virtues and a budget (nobles pay more, children less).
- A browser buys the shelf's best book for them with `p = 0.22 + 0.28·taste + 0.012·cozy (+section, +table, +armchair,
  +lamp)`, clamped to [0.05, 0.9]. Taste = likes the kind (1) + shares a virtue (0.5) + 0.1·rarity.
- About a third (more from chapter 4) bring a **wish**: a kind, a virtue at a minimum, both, or "a book that teaches a
  skill". A wish is always answerable by some book the game can make (`simtest` checks every one over 240 days). Serve
  it (1.5× price, +2 renown, double inspiration), take it as a **commission** (board of 4, lapses after 5 days, pays
  1.9×, +3 renown), or decline.
- Price = value × (1 + 0.4% per renown, up to +40%) × 1.15 with Silver Tongue × √budget.

### The procedural book engine (`js/sim/books.js`)
- One integer seed + constraints → a book. Eight **kinds** (cookbook, novel, poetry, skill manual, bestiary, atlas,
  almanac, grimoire) × five **rarities** (common → legendary: 2, 4, 6, 9, 13 virtue points in 1–3 virtues).
- **Virtues:** Valor, Wit, Hearth, Charm, Wonder. The main virtue comes from the kind (or the ink when bound).
- **Skills** (a manual always, others by rarity): adventurer skills work while carried (Pathfinding −1 day, Lockpicking
  +1 find, Swimming/Dragon-Tongue/Starlore for their places, Campfire Cooking +2 power); Tam's skills are learned by
  reading (Appraisal, Silver Tongue, Fine Binding, Gilding, Whispering, Cozy Keeping).
- **Talking books:** grimoires often, other rare books sometimes; six personalities (grumpy, poetic, giggly, pompous,
  sleepy, salty) with their own lines.
- **Titles and authors** from grammars per kind ("Honey Buns of Thimbledown", "On the Habits of Glass Snails",
  "Liber Noctis", "A Practical Guide to Lockpicking"), a year, and a **look**: size by kind, cover material (cloth,
  leather, oak board, dragon scale), a colour from the main virtue's palette, a metal (gold, silver, brass, copper),
  a tooling pattern (border, corners, diamond, vines, filigree, stars, runes; richer with rarity), an emblem, raised
  spine bands, page edges (cream, marbled, sprayed, gilt), corners, clasp, ribbon, wear, and a glow for the
  legendary.
- Value = rarity base × points × (1 + 25% per rebinding) × 1.25 for a skill × 1.3 talking × 1.3 gilt.

### Adventurers and expeditions
- **Rook** (knight) joins with chapter 1; **Fen** (ranger, Pathfinding) from day 3; **Juniper** (rogue, Lockpicking)
  with the guild's inspiration or day 10; **Maris** (tidecaller, Swimming) from chapter 5 or day 14.
- Each carries one book. Power at a place = level + its main virtue + half its second (hero + book), + skill bonuses.
  Party power + 1 (+2 more) from the guild's inspirations. Chance of a full haul = 0.25 + 0.6·power/need (0.1–0.97).
- Six places: Whispering Woods (need 4, 1 day), Lantern Market (6, 1), Sunken Archive (10, 2; renown 6), Moonlit
  Scriptorium (14, 2; renown 16), Dragon's Attic (19, 3; renown 30), Starfall Observatory (26, 3; chapter 6). A full
  haul is 3 finds (+1 Lockpicking, +1 for power ≥ 1.4× need); a poor one 1. Finds are 62% materials, 38% books of the
  place's kinds and rarity range. XP levels heroes to 10.

### The bindery (crafting like an RPG smithy)
- **Pattern** (the kind; start with cookbook, novel, almanac; manual, bestiary, atlas, poetry and grimoire are learned
  through the story and the town). **Cover** = the blade: paper → common, leather → uncommon, oak → rare, dragon scale
  → epic. **Ink** = the element: the main virtue. **Accents** = gems, up to two: gold leaf and star fragment may each
  lift the rarity one step (55% + 5% per binding level, +20% Fine Binding, +15% "The Sky Remembers"); silver clasp +2
  main; pressed violet +2 Charm; star +3 Wonder; phoenix feather +3 Valor and a skill; wax seal seals in a skill;
  silver thread +1 to every virtue.
- **Rebinding** = tempering: +1 to every virtue, up to +3, for a silver thread and 12 gold × the new level (free with
  Gilding).
- Binding XP: 1 per book, 2 for epic or better; level = 1 + √XP; every two levels add a point to the main virtue.

### The town of Larkspur
- Every sale adds the book's virtue points to the town (wishes ×2). Ten **inspirations** at 70 and 200 of a virtue:
  the guild (Juniper, the Bestiary pattern, +1 expedition power), the schoolhouse (children, the Atlas pattern), the
  bakery (+1 visitor a day), the playhouse (+1 renown a day, the Poetry pattern), the stargazer's tower (Ottoline brings
  a rare book more), and the second tier: heroes (+2 power), the little library (+1 to crafted books), the feast (+2
  visitors), the Duchess's garden party (15 gold every morning), the sky (better rarity rolls).

### Renown
- +⅓ per ordinary sale, +1 for a rare, +2 for an epic, +2 per wish, +3 per commission, +5 for chapter 4, +1 a day
  with the playhouse. It unlocks places, raises prices and visitors, and makes Ottoline's books rarer.

## Story: Old Vellum's seven chapters

| # | Chapter | Goal | Reward |
|---|---|---|---|
| — | Prologue | Tam in the rain; "A shop? For me?" | — |
| 1 | Dust and Daylight | sell 3 books | 30 gold; Rook joins; expeditions |
| 2 | Words That Wander | an expedition comes home | the bindery wakes; paper, leather, inks |
| 3 | The Bindery Wakes | bind a book | the Skill Manual pattern; leather, a wax seal |
| 4 | A Town That Reads | grant 4 wishes or commissions | Ottoline visits every third morning; +5 renown |
| 5 | Whispers in the Margins | talk with a talking book (Ottoline always has one until Tam does) | the Grimoire pattern; Whispering |
| 6 | Larkspur Awakens | 3 inspirations | Starfall Observatory |
| 7 | The Last Chapter | bind **The Book of Larkspur** (dragon scale, moonlight ink, a star fragment, gold leaf) | the ending: the festival in the square, Elowen's spirit smiles; the shop goes on |

Progress is counted from the start of each chapter (except inspirations and the masterwork). The star fragment for
the masterwork only comes from the Observatory; dragon scale from the Dragon's Attic or, now and then, Ottoline.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Choose, place, serve | Tab / arrows + Enter | d-pad + A | tap |
| Open / close / sleep | O | — | the big dock button |
| Books, Furnish, Bindery, Quests, Town, Trader | 1–6 | — | the dock |
| Close a sheet / menu | Esc / P | B / Start | Done, ✕ |
| Look along the shop | — | — | drag the shop |
| Turn a book | — | — | drag in the inspector; pinch or wheel to zoom |

## Look and sound

- **The shop** (`js/view/shop.js`): a side-on doll's house: the ElevenLabs back wall tiled along the room, furniture
  sprites in two rows, every shelved book drawn as a spine in its own colours and gilt (and a glow for the legendary),
  customers walking with a bob and a patience ring over a wish, Tam and Old Vellum behind the counter, coins and
  sparkles, dust motes in the light, evening dusk. It pans on narrow screens; a beamed ceiling fills a tall phone.
- **The books** (`js/view/covers.js`, `js/view/book3d.js`): covers, spines, page edges and a title page painted from the
  look (grain per material, tooled borders and patterns, an emblem in a ring, a title in a cartouche, wear), with
  matching metalness, roughness and bump maps, so the gilt shines and the tooling catches the light in three.js (room
  environment, a warm key light with soft shadows, a cool rim). The inspector orbits and opens the cover; the 3D shelf
  view stands every shelf as a bookcase (with candles, plants and globes in half-empty rows) and opens a tapped book.
- **Sound**: ElevenLabs music (title, shop, evening, a chapter sting), 16 effects and voices for Old Vellum and Tam
  (see `dev/audio/README.md`), with a Web Audio music-box fallback.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the shop clock (fixed step), input routing, events → beats, sheets and sounds, saves, cloud saves, debug hooks |
| `js/sim/data.js` | Every content table: virtues, kinds, rarities, skills, materials, furniture, folk, heroes, places, inspirations, chapters, voices |
| `js/sim/books.js` | The procedural book engine (pure) |
| `js/sim/game.js` | The rules: `newGame`, `act(G, cmd)`, `step(G, dt)`, lookups, `serialize`/`deserialize` (pure) |
| `js/sim/bot.js` | A whole-game bot through the same commands (pure) |
| `js/view/shop.js` | The 2D shop |
| `js/view/covers.js` | 2D covers, spines, edges, title pages, list thumbnails |
| `js/view/book3d.js` | three.js books, the inspector and the 3D shelves |
| `js/ui.js` | The DOM: HUD, dock, every sheet, story beats, toasts |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound, the key queue, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the book engine over every kind and rarity, every rule
and chapter reward, determinism and a save in the middle of an open day, that every wish can be answered, and has the
bot play the whole story at two skills. `browsertest.mjs` drives the real game by clicks, keys and touches.

## Balance notes

- The first bot finished the story in 13–16 days: too fast, and it sold the shop bare. Renown from ordinary sales went
  from 1 to ⅓, visitors from `cozy/4 + renown/10` to `cozy/6 + renown/15` (max 12), the inspirations from 18 to 70
  and 200, the star fragment was taken off Ottoline's cart (fetch it from the Observatory), and the **donation basket**
  (1–3 old books every morning) keeps the shelves from going bare.
- Now (6 seeds): the good bot ends the story on day ~23 (median), a careless one on ~25; chapters 1–4 take a day or two
  each as the tutorial, chapter 6 (three inspirations) about ten days, the Observatory hunt a few more. `simtest`
  holds every run to ≤ 45 days and the good bot's median to ≥ 15.
- Gold piles up late (thousands by the end) with little to spend it on; that is fine for a cozy game, but a late gold
  sink is an open idea.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- A gold sink for the late game (a second floor? commissions of furniture? funding the town?).
- Drag-and-drop furniture and books on the shop floor, as well as tap-to-place.

## Changelog

### v1.0.0 (2026-11-26)
- First release: the shop (two rows of furniture, sections, coziness, renovation), customers and wishes,
  commissions, the procedural book engine, the 2D covers and the three.js inspector and shelves, four adventurers and
  six places, the trader, the bindery and rebinding, reading and skills, talking books, ten inspirations, seven
  chapters and an ending, ElevenLabs art, music, effects and voices, cloud saves.
