# Tomebound — Gems of the Lost Library

**Genre:** Match-3 fantasy RPG (Puzzle Quest-style duels) + idle town builder
**Engine:** three.js r165 (import map, ES modules, no build step, no asset files)
**Target:** desktop (mouse / keyboard) and phones (touch, portrait and landscape)
**Status:** Playable — v1.0

---

## Concept

The Great Library of Lumenhall has been *unwritten*. A smudge of living ink called **the Unwriter**
blotted its thirteen greatest books and flung them into the Library's wings, which grew wild without
their stories. You arrive as a brand-new **Mage** or **Warrior** — fresh from the academy, slightly
over-prepared, very enthusiastic — and the Library's last keeper, **Professor Hootsworth** (an owl
with strong opinions about shelving), sends you in after them.

Every fight is a **gem duel**: you and a monster take turns on the same 8×8 board. Match fire, water,
leaf and spark gems to fill your mana, match skulls to hit, coins for gold and stars for XP — and
every gem you take is a gem your opponent can't. Spend mana on spells, chain cascades, make line,
bomb and prism gems, and drink potions you brewed back home.

Back home, the village around the Library rebuilds itself while you are away. Lumber camps, quarries,
herb gardens and crystal mines fill their baskets in real time (and while the tab is closed). Gold,
wood and stone build and upgrade buildings; the buildings forge gear, brew potions, rank up spells,
train you while you sleep and study the books you bring back. **Every book returned to its shelf
grants a permanent unlock** — a stat, a spell, a new building, a rule change on the board — and
raises the level cap of every building in town.

Tone: vivid, upbeat, a little silly, sincerely epic by the end.

---

## How the systems feed each other

```
          ┌──────────── gold, XP, items, quest progress ────────────┐
          │                                                          ▼
   GEM DUELS (wings) ──── books ────▶ LIBRARY ──── unlocks ────▶ HERO + TOWN
          ▲                               │  (stats, spells, board rules,   │
          │                               │   buildings, building level cap)│
          └── potions, gear, spell ranks, XP, blessings ◀── TOWN (idle) ◀──┘
```

* **Hero level** unlocks buildings and spells, and gives stat points.
* **Books** unlock buildings and board rules, and raise the building level cap (3 + books).
* **Buildings** turn time into resources, and resources into power (gear, potions, spell ranks,
  passive XP, book study).
* **Quests** ask for things from every system (slay, match, combo, gather, build, cast, flawless)
  so a session naturally touches all of them.

---

## Gem duel rules

| Gem | Effect when matched by the side whose turn it is |
|---|---|
| Fire / Water / Leaf / Spark | +1 mana of that colour per gem (more with gear) |
| Skull | Damage per skull = the side's skull damage (Might, gear, buffs; crits from Fortune) |
| Coin | Gold (player only; monsters "pocket" it — you lose it) |
| Star | XP (player only) |

* **Match 4+** → extra turn. **4 in a line** → a **Line gem** (clears its row or column).
  **L/T shape** → a **Bomb** (3×3). **5 in a line** → a **Prism** (swap it with any gem to clear every gem of that type).
* Cascades from refills count for whoever moved.
* No moves left → the board reshuffles. Idle for a few seconds → a hint glows.
* **Spells** cost mana and normally end your turn; *quick* spells and potions don't.
* Shield absorbs damage first. Stun skips a turn. Burn ticks at the start of the victim's turn.
* After a stun wears off, the victim shrugs off stuns for its next two turns (no stun-lock).
* HP and mana reset between battles. Losing costs nothing but time (you keep gold/XP picked up at 50%).
* Reloading mid-battle returns you to town; only that battle is lost.

The monster plays the same board with the same rules, choosing moves by its own priorities
(skulls, its spell colours, extra turns, denying your mana) with a level-scaled chance of a sloppy move.

---

## Hero

| Stat | Effect |
|---|---|
| Might | +skull damage (1 per 3, warriors 1 per 3.3), warrior spell power |
| Arcana | mage spell power (+7% each) |
| Vitality | +6 max HP each |
| Focus | +1 mana cap per colour each |
| Fortune | +3% gold, +2% XP, +1.5% skull crit each |

Two classes, nine class spells each (unlocked by level), plus a spell taught by a book (19 in all).
Four spell slots (a fifth from *The Star Chart*). Three stat points per level. Spell ranks 1–5 at the
Mage Tower (+15% each). The Mage starts every battle behind a *Mana Ward* (a shield of 20% max HP);
the Warrior has more HP and skull damage. Both also gain a little skull damage and spell power per level.

**Gear** — Weapon, Armor, Charm, Tome. Procedural: base by class/slot, item level, rarity
(Common → Legendary = 0–4 affixes) from 17 affixes (five stats, max HP, ward, skull %, spell %,
gold %, XP %, crit, lifesteal, thorns, extra-turn chance, mana per match, starting mana). Drops, chests, quests and the Forge.

**Potions** (Alchemist) — Healing Draught, Mana Tonic, Bomb Flask, Prism Phial, Swiftness Brew,
Skull Oil. Quick to use; carry three into a battle (more with Alchemist levels).

**Blessings** — shrine nodes grant a buff for the next few battles (starting mana, skull damage,
shield, gold, XP).

---

## The Library wings (procedural)

Six wings plus the finale. Each wing has a seeded layered map (7 rows, 2–3 nodes per row): battles,
elites, treasure, shrines and events, a **Keeper** in the middle (book one) and a **Guardian** at the
end (book two). Cleared battle nodes become patrols for grinding.

| # | Wing | Levels | Flavour |
|---|---|---|---|
| 1 | Sunlit Atrium | 1–5 | leafy, sunny, slimes and sprites |
| 2 | Ember Archives | 5–10 | lava lamps and imps |
| 3 | Tidal Stacks | 10–15 | flooded shelves, crabs and eels |
| 4 | Storm Gallery | 15–20 | thunder, wisps and gargoyles |
| 5 | Clockwork Scriptorium | 20–26 | gears, golems and mimics |
| 6 | Starlit Observatory | 26–32 | starlight, specters and dragons |
| ★ | The Blank Margin | 34 | the Unwriter |

**Monsters** are generated from 14 families (slime, sprite, imp, crab, eel, wisp, gargoyle, golem,
mimic-tome, mushroom, specter, drake, owlbear, inkling) × modifiers (Giant, Swift, Arcane, Armored,
Greedy, Frenzied, Ancient…) × syllable names, each with a body plan, palette, colour affinity and
2–3 spells from the family pool. The 3D model is assembled from parts (body, eyes, horns, ears,
wings, tails, spikes) with the same seed.

---

## Town

Thirteen plots around the Library. Build each building once on a plot of your choice; upgrade up to
the level cap (3 + books returned, max 12).

| Building | Unlock | Does |
|---|---|---|
| Lumber Camp | start | wood |
| Market | Lv 2 | gold |
| Quarry | Lv 3 | stone |
| Guild Hall | Lv 4 | +1 quest slot per level, better rewards |
| Herb Garden | book 2 | herbs |
| Forge | book 3 | craft gear |
| Training Yard | Lv 7 | XP over time |
| Alchemist | book 5 | brew potions, +carry |
| Storehouse | Lv 9 | +1h basket capacity per level |
| Crystal Mine | Lv 11 | crystal |
| Mage Tower | book 7 | spell ranks |
| Scriptorium | Lv 14 | ink; study books (bonus tiers 2–3) |
| Clocktower | book 9 | +8% all production per level |

Producers fill a basket in real time (rate × level) up to *capacity hours* (2h + Storehouse +
*Atlas of Winds*). Tap a building or **Collect All**. Returning after a break shows a
"while you were away" summary.

---

## The thirteen books

| Book | Where | Unlock |
|---|---|---|
| Primer of Sparks | Atrium Keeper | +1 Spark mana per Spark match |
| Gardener's Almanac | Atrium Guardian | Herb Garden; Leaf matches heal 1 per gem |
| Ember Codex | Archives Keeper | Forge; fire spells +20% |
| Bestiary of Bright Beasts | Archives Guardian | +15% XP; shows monster weakness |
| Tide Tables | Stacks Keeper | Alchemist; +3 mana cap |
| Ledger of Lost Coins | Stacks Guardian | +25% gold |
| Thunder Psalter | Gallery Keeper | Mage Tower; start battles with 4 Spark mana |
| Atlas of Winds | Gallery Guardian | +4h basket capacity |
| Clockmaker's Manual | Scriptorium Keeper | Clocktower |
| Grimoire of Gears | Scriptorium Guardian | spell *Clockwork Bomb* |
| Star Chart | Observatory Keeper | +1 spell slot |
| Lexicon of Light | Observatory Guardian | +20% max HP |
| The First Book | the Unwriter | the ending, and the Endless Stacks |

Studying a book at the Scriptorium raises its tier (bonus × 1.5, × 2).

---

## Quests (procedural)

Notice board (2 slots) + Guild Hall levels. Kinds: slay N of a family, defeat a named bounty,
match N gems of a colour, make N 4+ matches, make N cascades, collect N resource, upgrade a
building, cast N spells, win above X% HP, use N potions. Progress counts from a baseline taken when
accepted. Rewards: gold, XP, resources, gear, potions.

---

## Architecture

```
js/sim/    pure simulation — no three.js, no DOM, no Math.random, no Date
  rng.js data.js board.js battle.js ai.js monsters.js items.js regions.js
  quests.js town.js books.js story.js game.js bot.js
js/view/   three.js — scene.js (renderer, post, layout), gems.js, board3d.js,
           monster3d.js, town3d.js, backdrop.js, fx.js
js/ui/     DOM — hud.js, screens.js, map.js
js/        main.js (mode machine + battle director), audio.js, save.js
dev/       simtest.mjs (bot plays the campaign, invariants, balance table), browsertest.mjs
```

The board resolves a move instantly and returns an event list (`swap`, `clear`, `special`,
`fall`, `spawn`, `gain`, `damage`, `extraTurn`, `shuffle`…); the view's director plays them back
one by one and finally re-syncs from the true board, so a flourish can never desync the game.

---

## Controls

| Action | Mouse / keys | Touch |
|---|---|---|
| Swap gems | drag a gem, or click two neighbours | swipe a gem |
| Spells | click a spell, or 1–5 | tap a spell |
| Potions | click, or Q/W/E | tap |
| Hint | H | — |
| Menu | Esc | ☰ |

---

## Balance

Tuned against a bot that plays the whole campaign (see [dev/README.md](dev/README.md)):
every run of both classes reaches the ending in ~80–125 battles, finishing near level 33–35.
Monster HP and damage are near-linear in level, with a per-wing trim (`WING_HP`, `WING_DMG`)
that absorbs the power of books, spell ranks and forged gear. Normal fights run ~12–25 turns
and cost ~20–35% HP; the bot loses a Keeper or Guardian roughly one try in five, and the
Observatory Guardian is the hardest fight in the game.

---

## Changelog

### v1.0.0 — 2026-10-01
- First release.
