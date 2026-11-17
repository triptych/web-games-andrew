# Alchemist's Lattice

**Genre:** Block-placement puzzle (the *1010!* family) inside a light alchemy RPG with a three-chapter story
**Engine:** three.js r165, vanilla JS modules, the sim/view layout; fal paintings, procedural Web Audio
**Status:** v2.0.0 (a reset of the v1 Phaser 4 game to the standards of the recent games)

---

## Concept

You are an apprentice alchemist with a cracked cauldron. Your workbench is the *lattice*, a 9×9 grid: drag tiles from a hand of
three onto it, fill a row or a column, and it clears. That much is the classic block puzzle. What makes it Alchemist's Lattice is
what lies under and on the lattice, and what you do between levels:

- **Explore**: elements lie buried under stone slabs. A clear through a deposit peels off a layer; bare, it is harvested.
- **Refine**: brew a potion by clearing the lines its recipe asks for (rich in one element, never in another, with a streak or a
  double), raising its quality through the crucible's golden rings.
- **Battle**: foes sit on the lattice, grow, harden and strike every few placements. Clear lines through them to cut them back.
- **Between levels**: spend harvested elements at the **cauldron** to learn new tile types, XP on a **skill tree**, gold at
  **Pellerin's stall**; walk a branching **chapter map** (Slay-the-Spire style) to a boss; and follow a short visual-novel story
  with Madame Voss of the Assembly, your rival Casimir, the Lattice Spirit and Pellerin the merchant.

The design is the v1 game's ([game-plan v1, in git history](https://github.com/triptych/web-games-andrew/blob/main/game-027/game-plan.md)):
its two intertwined loops, three level types, run map, cauldron tiers, consumables, skill tree, cast and its chapter 1–2 scripts.
v2 rebuilt it from scratch and finished what v1 left open (chapter 3, the ending, the power-up the plan deferred as Tile Swap).

## The two loops

- **The puzzle loop (in a level):** a finite, pre-made supply of tiles is dealt three at a time; place all three to get the next
  three. A level is lost when the supply runs out before the goal (*out of tiles*), when nothing in the hand fits and nothing can
  help (*jammed*), or when a battle's foes wear you down (*defeated*).
- **The alchemy loop (between levels):** harvest elements → learn tile types at the cauldron → richer supplies. A boss raises the
  cauldron's tier, which unlocks rarer types. The cauldron never mints tiles into a live hand.

## Mechanics

### Tiles and the supply ([shapes.js](js/sim/data/shapes.js), [levelgen.js](js/sim/levelgen.js))
- 21 tile types, fixed orientations: five starting ones (1–3 cells), four bends and the Ingot (uncommon, learned with salt and
  ember), tetrominoes (rare, need the Tin cauldron, dew and root), the Coil, Twist and Slab (exotic, Brass, ash), and the Span, Mast
  and Star (aether, Gold).
- A level's supply is drawn from the types you know, weighted by rarity (60/25/12/6/3), with at least 40% one- or two-cell tiles. It
  is sized for the *starting* tiles (about two cells each): every bigger type you have learned makes the same supply go further.
- Each tile carries an element (its colour and its painted icon), drawn from the chapter's palette; a refinement's supply leans
  toward its recipe's elements.
- The deal takes the next three from the supply. The lattice is a little kind: a tile that can't fit anywhere is swapped for one a
  few places down that can (3 looks in chapter 1, 2 in chapter 2, then 1).

### Clearing and scoring ([level.js](js/sim/level.js))
- Every full row and column clears at once. 2 points per cell placed; 10 per cell cleared × the lines cleared at once (the combo);
  +25 per step of the **streak** (placements in a row that clear). Overflow adds 60 a line past the second.

### Exploration
- 1–4 deposits of 2–4 cells under 1–3 layers of slab. **One clear through a deposit peels one layer off the whole deposit**, however
  many lines cross it. (v1 peeled cell by cell; the bot showed that almost no player could finish a harvest that way, and a slab
  that wears as one reads better.) Objectives: clear N lines, reach a score, or harvest every deposit.

### Refinement
- A recipe (one of eight potions) asks for N lines holding 3+ of its element (two elements from chapter 2), a streak of 2 (and, from
  chapter 2, a double clear), and no line with 3+ of its forbidden element. Lines through the crucible's golden rings double the
  quality they add; the grade (Crude, Fine, Pure, Masterwork) sets the gold. Enhancements bought with elements before the level:
  Stabilizer (combo and streak one easier), Potency Dust (a grade finer), Dew Buffer (forgives a forbidden line).

### Battle ([foes.js](js/sim/data/foes.js))
- Foes occupy cells (they fill lines like tiles). A clear through one does 8 per cell × the combo, minus armour, and the cells it
  crossed fall away (the first cell stays while it lives). Every 4 placements (3 for elites and bosses) each foe takes the next step
  of its pattern: **advance** into an empty neighbour (toward the middle), **harden** (+1 armour; a foe struck that turn strikes
  instead), **attack** your health. Six foes and three bosses: the Ember Warden, the Dew Serpent (and its tail) and the Ashen
  Homunculus (with two Soot Wisps).

### Items and skills
- Items (Pellerin's stall, two of each per visit, or caches): Dissolvent (a filled cell), Catalyst (a fresh hand), Transmute Vial (a
  tile becomes a Mote), Reveal Salts (a layer off a deposit), Hearth Tonic (+10 health).
- Skills (XP, three branches): Tile Swap (turn a tile; 6-placement cooldown), Steady Hand (a small tile in every hand), Catalyst
  Affinity (a free redraw a level); Deep Sight (see what deposits hold), Surveyor (see the next hand), Vein Sense (deposits one clear
  from harvest glow; +1 per harvest); Surge (+5 XP per combo, +2 battle damage a line), Overflow, Reclaim (a hand back to the supply).
- When nothing fits but an item or a skill could help, the level is **stuck**, not lost: a banner offers them, or to give up.

### The map ([map.js](js/sim/map.js)) and the run ([game.js](js/sim/game.js))
- A chapter is an exploration, five layers of 2–3 nodes (explore, refine, battle, shop, cache, elite) and a boss. Chapter 1 offers a
  refinement and a battle on its second step. No elite in the first two layers or straight after another; a shop on every map.
- **Resolve:** a chapter takes three lost levels; the third redraws its map (you keep every type, skill, element, item and coin).
- A boss raises the cauldron (Cracked → Tin → Brass → Gold). Chapter 3's boss ends the story; chapter 4 on is the open road
  (scaled foes, aether everywhere).

## Story ([story.js](js/sim/data/story.js))

The cast and chapters 1–2 are v1's scripts unchanged (the intro, the first harvest, two boss taunts and clears, two chapter ends,
Pellerin's introduction, nine cache scenes). v2 adds short explanations the first time you meet the cauldron, a refinement and a
battle; chapter 3 (Casimir's homunculus has got loose under the Assembly, and he asks for help); the Homunculus's taunt and fall;
the ending (the guild mark and the Gold cauldron); and the open road. Scenes are queued by the sim and played by the UI with the
fal portraits, one of four expressions per line.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Choose a tile | 1 2 3, Tab | X | Tap it |
| Move it | Arrows / WASD | D-pad, stick | Drag it (it floats above a finger) |
| Place it | Space / Enter | A | Drop it, or tap the lattice after choosing |
| Items | 4 5 6 7 8 | | The tool bar |
| Skills | R (turn), Q (redraw), E (reclaim) | Y, LB, RB | The tool bar |
| Cancel / pause | Esc, P | B, Start | ❚❚ |
| Map | Arrows choose a node, Enter travels, C cauldron, K skills, J journal | | Tap a node, then Travel |

## Look and sound

- A candlelit apothecary. The lattice is an oak plate (a fal painting) with brass grid lines, tilted 0.22 rad from a fov-30 camera
  fitted into the space the HUD leaves, over a darkened painting of the workshop. Tiles are glazed, brass-rimmed blocks with their
  element's painted icon on top (a 4×2 atlas of the fal element paintings); deposits are dark slabs with a glowing rune and seam;
  foes are dark veined blocks under a portrait token whose ring is their health; the crucible is a set of turning golden rings.
- Post: RenderPass → UnrealBloom (half resolution, threshold 0.88) → a lens pass (aberration, ripple, flash, warm vignette, grain).
- The board, the stage, the effects (particles, shards, beams, rings, floating words), the input queue and the play controller are
  NEON ARCANA's (game-111) adapted: the same tested drag, tap-tap, keyboard and pad handling.
- Music: a look-ahead sequencer in D dorian (Dm–C–G–Dm, 76 bpm), lute-like plucks over a pad whose filter opens as the chapters
  pass; effects answer every sim event.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, map, level, shop, ending), the loop, input routing, scenes, saves, debug hooks |
| `js/sim/game.js` | The campaign: `newGame`, `act` (go, finish, buy, leave, learn, train, seen; level commands forwarded), saves |
| `js/sim/level.js` | One level: `newLevel`, `actLevel` (place, item, skill, concede), queries for the controller, the view and the bot |
| `js/sim/levelgen.js`, `js/sim/map.js` | Building a level from a node; the chapter map |
| `js/sim/bot.js` | A one-move-lookahead bot with a skill dial that plays levels and whole campaigns |
| `js/sim/data/` | Elements, tile types and cauldrons, foes, potions, items and enhancements, skills, the cast and the scenes |
| `js/play.js` | The controller: drag, tap-tap, keys and pad → commands; what the view previews |
| `js/view/` | `stage.js` renderer, backdrop and post; `board.js` plate, tiles, slabs, ore, rings, foes, ghost, hand; `fx.js` effects; `view.js` layout, picking, events |
| `js/ui.js`, `style.css` | Screens, HUD, tool bar, banners, toasts, the dialog |
| `js/art.js`, `js/audio.js`, `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Paintings, sound, key and pad queue, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md): `simtest.mjs` (purity, data, map, generated levels, every rule, the campaign, determinism and
saves, bot campaigns with the balance table) and `browsertest.mjs` (desktop by real mouse and keys from the title to the ending;
touch-only phones in both orientations; blocked storage).

## Balance notes

Bot table (`SEEDS=6`): every campaign at both skills earns the guild mark in about 16 levels (five or six a chapter).

| Bot | Won | Levels | Lost a run | Maps redrawn |
|---|---|---|---|---|
| skill 1 (best move, learns the biggest tile types it can) | 6/6 | 16.3 | 0.7 | 0 |
| skill 0.3 (noisy, blunders, learns nothing) | 6/6 | 16.3 | 1.2 | 0 |

- The supply was first sized from the average size of the tiles you know, which made learning bigger types a *penalty* (fewer,
  harder-to-fit tiles); the bot lost more the more it learned. Sizing it from the starting tiles fixed that.
- Refinements first asked for a double clear in chapter 1 and a triple at elites: the bot brewed half of them and almost no elite.
  Chapter 1 now asks for a streak of two, chapter 2 adds a double, and elites ask for more lines rather than a triple.
- The supply's slack is 1.55× a clean solve (1.3 elite, 1.4 boss), 0.1 tighter each chapter (to 0.3); the first level has 2.2×.

## Open questions / next steps

- Nobody has played v2 by hand or heard its music, and it has only run under SwiftShader, not a real GPU or phone.
- The bot is a good placer; a human may find the later chapters harder than the table says. Easy knobs: the slack, mercy, foe damage.
- Possible: ElevenLabs voices for the cast (the scenes are short enough), more potions, a daily seed.

## Changelog

### v2.0.0 (2026-11-17)
- Reset to the recent games' standards: Phaser 4 removed; a pure seeded sim (`js/sim/`) driven by commands and a three.js r165 view
  reusing NEON ARCANA's (game-111) board, stage, effects and input; DOM screens; 56 fal paintings; procedural audio; save and resume
  mid-level; Node and Chromium test harnesses with a bot.
- Kept from v1: the lattice, the finite supply, the three level types, deposits, the cauldron and its tiers, the run map, the shop
  and its items, the skill tree, the cast and the chapter 1–2 scripts. New: chapter 3 and the ending, the open road, Tile Swap (the
  deferred rotation power-up), Hearth Tonic, the Dew Buffer, the potion shelf, Resolve.

### v1.0.0 – v1.10.0 (2026-06-14 – 2026-06-28)
- The Phaser 4 game: phases 1–10 (the core puzzle, deposits, the cauldron, levels and objectives, refinement and battle, story and
  VN dialog, the run map, consumables and the shop, XP and the skill tree, polish). See git history for its full plan.
