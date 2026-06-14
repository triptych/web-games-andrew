# Game 027: Alchemist's Lattice

**Genre:** Block-placement puzzle (Tetris-block / *1010!*-style) fused with light RPG / alchemy progression and a story campaign
**Engine:** Kaplay v4000 (ES6 modules, shared `lib/kaplay/kaplay.mjs`)
**Target Resolution:** 1280 × 720 (letterbox, responsive)
**Status:** Planning — not yet scaffolded

---

## Concept

You are a fledgling **alchemist**. Your workbench is a square grid — the *lattice* — onto which
you drag clusters of 1–4 connected blocks. Fill a complete row or column and that line clears,
scoring points and dissolving spent matter back into the aether. So far, this is a classic
drag-and-drop block puzzle in the lineage of *1010!* and *Woodoku*: no gravity, no falling
pieces — you are handed a small tray of shapes and must place all of them, planning ahead so you
never run out of room.

The alchemy layer is what makes it a game-027 and not a clone. The blocks you place are not
abstract tiles — they are **raw elements and ingredients** (salt, ember, dew, root, ash…) that
you slowly acquire and must *convert* into placeable shapes at your **cauldron**. And the lattice
itself is not empty: buried beneath it are **dormant ingredient deposits**. Clearing lines peels
away the layers covering a deposit; reveal the whole deposit (which may span several cells and
take several clears) and you harvest a new, rarer ingredient into your stores — which in turn
unlocks new shapes to brew and place.

Wrapping all of this is a **story campaign**. You begin as an apprentice with a cracked starter
cauldron that can only process the lowest-tier ingredients. Completing a level's objective
upgrades your cauldron, letting you process higher-tier ingredients, brew larger/stranger shapes,
and tackle deeper deposits — and advances the narrative of an alchemist earning their guild mark.

The same block-placement engine drives **three kinds of level** (see §11): **exploration** levels
(harvest deposits, the loop described above), **refinement** levels (use the lattice to *brew a
specific potion* under recipe conditions, with optional enhancement ingredients raising the
quality), and **battle grids** (enemies occupy cells and you clear lines over them to deal damage).
All three share the tray, line-clears, and cauldron economy — they differ in win/lose conditions
and what lives on the grid.

---

## The two intertwined loops

The game is deliberately two loops feeding each other; keeping them legibly separate in the
design (and code) is the whole trick.

- **The puzzle loop (moment-to-moment):** drag shapes from the tray → place on the lattice →
  clear lines → don't get stuck. This is fast, tactile, and never blocks on the RPG layer.
- **The alchemy/RPG loop (session-to-session):** clearing lines reveals deposits → harvested
  ingredients fill your stores → spend ingredients at the cauldron to brew the *next* tray of
  shapes → cauldron upgrades (earned via level objectives) gate which ingredients/shapes exist.

> Design rule: the puzzle loop must be **fully playable** before any alchemy exists. Alchemy is a
> meta-layer that changes *what shapes you get* and *why you clear* — not a dependency the core
> placement loop waits on.

---

## Core Mechanics

### 1. The lattice (placement grid)
A square grid of cells (`GRID_W` × `GRID_H`, start at **9 × 9**; later levels may resize). Each
cell is empty, filled, or part of a **covered deposit** (see §5). The grid never scrolls and
pieces never fall — placement is pure spatial planning.

### 2. The tray (drag-and-drop shapes)
The player is dealt a **set of 3 shapes at a time** (config `TRAY_SIZE = 3`) and **must place all
three before the next set is brewed** — this is the *1010!* cadence, and it's what creates real
pressure: you can't fish for a piece that fits, you have to make room for the hand you hold. A
shape is a small cluster of **1–4 connected blocks** (mono, domino, tromino, tetromino — all the
*1010!*-style polyomino families). **Shapes are placed in fixed orientations — no rotation in v1.**
So planning is about *where* a shape goes, not how you turn it (rotation returns later as a
power-up — see §7). The player drags a shape onto the lattice; it snaps to grid cells and shows a
**ghost preview** (green = fits, red = collision/out-of-bounds). Release on a valid spot to commit.
A shape can only be placed where *all* its cells land on empty lattice cells. The three shapes may
be placed in **any order**. When all three are placed, a new set of 3 is brewed (see §4) — and if
none of the remaining shapes in the current set can fit anywhere, the level ends (see Failure
Conditions).

### 3. Line clears & scoring
After each placement, any **fully filled row or column** clears simultaneously. Scoring:
- Base points per cleared cell.
- **Combo multiplier** for clearing multiple lines in one placement (e.g. an L that completes a
  row *and* a column).
- **Streak bonus** for clearing on consecutive placements.
Cleared cells dissolve with a particle/flash effect and free the space for new shapes.

### 4. The cauldron (ingredients → shapes)
Instead of random shapes, the tray is **brewed** from your ingredient stores. Each shape costs a
small recipe of ingredients (e.g. a 2×2 square = 4× *salt*; an L-tromino = 2× *ember* + 1×
*root*). When a tray slot is consumed you brew a replacement from whatever your **cauldron tier**
allows. Higher-tier cauldrons unlock larger/rarer shape recipes and process higher-tier
ingredients. If you can't afford any shape (stores depleted), low-tier "filler" shapes are always
brewable from the most common ingredient so the puzzle loop never hard-stalls.

> This reframes the classic "you're handed random pieces" as "you *spend resources* to mint
> pieces" — connecting the puzzle economy to the RPG economy.

### 5. Deposits (clearing reveals ingredients)
Beneath the lattice, certain cells hide **deposit fragments**. A deposit is a multi-cell region
(1–6 cells) of a specific ingredient, hidden under one or more **cover layers**. Mechanics:
- Covered deposit cells render with a subtle "buried" overlay; they're still normal lattice cells
  for placement purposes.
- When a line clears and passes over a covered deposit cell, it **strips one cover layer** from
  that cell (deep/rare deposits need multiple passes).
- When **every** fragment of a deposit is fully uncovered, the deposit **harvests**: its
  ingredient is added to your stores (often a higher tier than what you currently brew), with a
  reveal flourish, and that ingredient becomes available to the cauldron.
- A level seeds a known set of deposits; uncovering specific "objective" deposits is often the
  level's win condition.

### 6. RPG / progression layer (the alchemist's story)
- **Cauldron tiers (1→N):** each upgrade widens the ingredient/shape pool and unlocks deeper
  deposits. Earned by completing level objectives, not bought.
- **Ingredient tiers:** common → uncommon → rare → exotic. Higher tiers brew bigger/odder shapes
  and are gated behind cauldron tier.
- **Chapters as run maps:** each chapter is a branching map you traverse to a boss (see §9); the
  boss is the cauldron-tier gate.
- **Story beats:** short narrated interstitials between chapters (apprentice → journeyman → guild
  mark). The narrative motivates each new mechanic ("the guild grants you a tin cauldron — it can
  finally boil ember").
- **Stuck = level fail (soft):** if no tray shape can be placed anywhere, the level ends; retry
  the node (default) — see §9 for the run-failure open question.

### 7. Power-ups *(future enhancement — not v1)*
The core game ships with **fixed-orientation placement only**. Power-ups are a planned later layer
that adds occasional "get out of a jam" tools without changing the core promise of careful spatial
planning. Candidate power-ups:
- **Line-breaker** — destroy a chosen full or partial row (clears it like a line-clear, scoring the
  occupied cells and stripping any deposit covers it passes over).
- **Column-breaker** — same, for a column.
- **Rotate** — temporarily allow rotating the held shape before placing it (the one time you get to
  turn a piece).
Open design choices for when this lands: how power-ups are *earned* (brewed from rare ingredients?
awarded for big combos? bought between levels?), whether they're consumable one-shots or a charged
meter, and how a line/column-breaker interacts with deposit cover-stripping. Tracked in Open
Questions; out of scope until Phase 5+.

### 8. Items & the shop (consumables, bought with currency)
The game has **two completely separate acquisition tracks**, and keeping them apart is core to the
design:

| | **Consumables** | **Passive power-ups** |
|---|---|---|
| What | One-off tools used during a level | Permanent standing abilities |
| Acquired via | **Shop** — buy with **currency** (*grams*) | **Skill tree** — unlock with **XP** (§10) |
| Lifecycle | Depletes (count → 0) | Permanent once unlocked, cooldown-gated in use |
| Where | Inventory tab of the character screen | Skill-tree tab of the character screen |

This section covers **consumables + the shop**. Passive power-ups, XP, and the skill tree are §10.

**Consumables (one-off use).** Bought at a **shop node** (§9) with **currency** (working title:
*grams* — refined essence) into a finite **item inventory**, consumed when used, gone afterward.
They act *during a level* to dig out of trouble or push a quest over the line. Examples:
- *Dissolvent* — clear a single chosen filled cell.
- *Catalyst* — instantly re-deal the current set of 3 (escape a bad hand).
- *Transmute vial* — convert one held tray shape's ingredient type to another you own.
- *Reveal salts* — strip one cover layer from a chosen deposit cell without a line-clear.

A consumable is selected from the inventory (or in-level item bar), then applied (e.g. click a
target cell/shape). Using one is an optional action that does **not** consume a tray placement.

**The shop** is a **node type on the run map** (§9) — you visit it only when your chosen path lands
on one. It sells **consumables only** (and possibly buys surplus ingredients for currency). It does
**not** sell passives (those are XP-bought in the skill tree) and never sells *progression*
(cauldron tiers stay boss-gated) — so it can't trivialize the campaign.

Economy: **currency** comes from node rewards (and possibly selling surplus ingredients). Prices
and whether the shop's stock expands with cauldron tier are open questions.

### 9. The run map (Slay-the-Spire-style branching path)
A chapter is not a fixed list of levels — it's a **procedurally generated map** the player traverses
left-to-right via **binary (and occasionally trinary) decision points**, exactly in the spirit of
*Slay the Spire*. Structure:

- The map is a layered DAG. The player starts at a single **entry node on the far left** and must
  reach the **boss node on the far right**. Each step, the current node connects forward to **2–3
  candidate nodes**; the player picks one, committing to that branch (you cannot backtrack).
- Branches **diverge and re-converge** across the layers so the map reads as a web of routes, not a
  single line — the *route you choose* is a meta-puzzle (greed vs. safety vs. resources).
- **Node types** (each is an icon on the map):
  - **⚗ Puzzle level** — a standard lattice level with a quest objective (the bulk of nodes).
  - **🛒 Shop** — the apothecary market (§8); spend currency, no puzzle played.
  - **🎁 Cache / event** — a small narrative event or free reward (ingredient bundle, currency, a
    one-off consumable), sometimes a choice with a trade-off.
  - **🔥 Elite** — a harder puzzle level (tighter board / nastier objective) with a richer reward.
  - **💀 Boss** — the chapter finale at the far right: a large, multi-objective set-piece level.
- **Generation:** seeded per chapter so a run is reproducible (retryable). Guarantees keep it fair —
  e.g. at least one shop reachable before the boss, no two elites back-to-back, boss always
  terminal. Exact density/rules are an open question.
- **Story & cauldron tiers** map onto the run: clearing the **boss** completes the chapter, advances
  the narrative beat (apprentice → journeyman → guild mark), and grants the **cauldron-tier upgrade**.
  Mid-chapter puzzle nodes award currency, ingredients, score, and **XP** (§10) but not tiers.
- **Persistence within a chapter:** currency, owned items, unlocked passives, XP, and stores carry
  **across nodes** within a run; whether they persist between chapters is the existing RPG-save
  open question.
- **Failure on the run:** a failed puzzle node (jammed / infeasible) ends that node — open question
  whether it ends the whole run (Spire-like, restart the chapter from a fresh/again-seeded map) or
  just that node with a retry. Default plan: retry the node (campaign game, not a roguelike permadeath),
  but the branching structure makes a roguelike "fail = restart the chapter" mode a natural option.

### 10. XP, passive power-ups & the skill tree
Passive power-ups are **not bought with currency** — they're **earned through play and unlocked in a
skill tree**, giving the alchemist a sense of personal growth distinct from the consumable economy.

- **XP (experience).** Awarded for clearing nodes, line-clears/combos, harvesting deposits, and
  beating elites/bosses. XP is the skill tree's spend resource (it may also drive a *character
  level* for the stats view — open question). XP is shown on the character screen and as a small
  HUD readout.
- **The skill tree (mind-map style).** A node graph of **passive power-ups**, rendered as an
  organic web (think a mind map / constellation, not a rigid grid). Spend accumulated XP to
  **unlock** a node; nodes have **prerequisites** (you must unlock a connecting node first), so the
  tree branches into themes the player invests in:
  - *Efficiency branch* — **Tile Swap** (swap a placed tile's ingredient type, then cooldown),
    *Steady Hand* (every Nth set guarantees an easy shape), *Catalyst Affinity* (faster re-deals).
  - *Insight branch* — *Deep Sight* (see a deposit's hidden ingredient before harvest), *Surveyor*
    (preview the next set), *Vein Sense* (deposits glow when one clear from harvest).
  - *Power branch* — *Surge* (combos charge a bonus meter faster), *Overflow* (occasional 4-line
    clear bonus), *Reclaim* (refund some ingredients on a clear).
- **Passive behavior in-level.** Unlocked passives are **permanent**. *Always-on* passives (e.g.
  Deep Sight) just apply; *activated* passives (e.g. Tile Swap) are **cooldown-gated** — used from
  the in-level item bar, then recharge over a number of **placements/line-clears** (not wall-clock,
  to stay puzzle-paced). The HUD shows each activated passive's ready/charging state.

> The clean split: **currency → consumables (shop, deplete)**; **XP → passives (skill tree,
> permanent)**. They never cross. Both remain distinct from §7 board-altering power-ups, which stay
> a later enhancement. (Naming note: §7 "power-ups" are the destructive board tools; §10 "passive
> power-ups" are the skill-tree perks — an open question flags renaming one to avoid confusion.)

Open questions for §10: does XP also grant a numeric **character level** (and do stats scale with
it, or are stats purely informational)? Is the tree a single campaign-long tree or per-chapter? Can
nodes be **refunded/respec'd**? How big is the v1 tree?

---

## Game Loop

1. **Run map (§9):** view the branching path; pick one of the **2–3 forward nodes** to commit to.
2. **Resolve the chosen node** by type:
   - *Shop* → spend currency, then back to the map. *Cache/event* → take a reward/choice → map.
   - *Puzzle / elite / boss* → enter the level (continue below).
3. **Enter level:** lattice seeded with its deposits + cover layers; objective shown (e.g. "harvest
   the silver vein", "clear 12 lines", "reach 5,000 points").
4. **Puzzle loop:** drag tray shapes → place → clear lines → strip deposit covers.
5. **Harvest:** fully-uncovered deposits add ingredients to stores; cauldron can now brew new shapes.
6. **Objective met → node cleared:** award score/currency/ingredients → advance along the chosen
   branch, back to the map.
7. **Failure (see below) → node failed (soft):** retry the node (default).
8. **Reach & clear the boss (far right):** chapter complete → **upgrade cauldron tier**, story beat,
   next chapter's map. Repeat until the final cauldron and the guild-mark ending.

---

## Failure Conditions

A level is **failed** (soft — always retryable from the same seed, or bail to the map) when either
of these happens. Both are checked after every placement.

### 1. Out of room — a forced piece can't be placed
You're dealt sets of 3 and must place all 3. If, at any point, **a shape still in your hand has no
legal placement anywhere on the lattice**, the level ends — the lattice is jammed.
- Checked after each placement *and* when a fresh set of 3 is brewed: if **no** remaining shape in
  the set fits anywhere, fail immediately (don't make the player hunt for the dead end themselves).
- The HUD should warn before the wall is hit — e.g. flag a shape that has very few legal spots
  left, so a jam feels earned, not arbitrary.
- Result screen: *"The lattice is jammed."* → retry (same seed) / map.

### 2. Out of pieces — quest requirement can't be fulfilled
Every level has a **quest objective**, and a level can be *seeded with a finite amount of the
matter needed to satisfy it*. If it becomes **mathematically impossible to meet the objective with
the pieces/ingredients that remain**, the level ends. Objective types and their failure form:
- **Collect quest** ("harvest all the gems / the silver vein") — fails if a required deposit can no
  longer be fully uncovered (e.g. the cells that would clear over it are permanently blocked, or
  the runs needed can't be formed).
- **Score quest** ("reach 5,000 points") — fails if the maximum score still achievable from the
  remaining pieces/board falls below the target.
- **Spell-component quest** ("complete N rows/columns using the right spell-component blocks") —
  fails if you can no longer form enough qualifying lines from the components you have left.

> Implementation note: condition 2 is a **solvability/feasibility check**, which is harder than
> condition 1's "does any piece fit." For v1, approximate it conservatively — prefer a cheap upper
> bound (e.g. "best-case remaining score < target", "required deposit cells now unreachable") and
> only fail when clearly impossible, rather than attempting a full solver. Better to occasionally
> let a doomed board run one more set than to false-fail a winnable one. Tracked in Open Questions.

Both failures emit `levelFailed {reason}` (`'jammed'` vs `'infeasible'`) so the result screen can
show the right message.

---

## Player Controls

Drag-and-drop first; full keyboard/mouse parity where sensible.

| Action | Input |
|--------|-------|
| Pick up / drag a shape | Left-click + hold on a tray shape (or touch-drag) |
| Place shape | Release over a valid lattice region |
| Cancel placement | Release outside the lattice / right-click while dragging → returns to tray |
| Peek deposit info | Hover a buried cell → tooltip |
| Use consumable / select item | Click an item in the in-level item bar, then click its target |
| Trigger a ready passive | Click the passive's HUD chip (e.g. Tile Swap), then click the target tile |
| Open cauldron / recipes | C |
| Open ingredient stores | I |
| Open character screen (inventory / stats / skill tree) | B |
| Unlock a passive (skill tree) | Open character → Skill Tree tab → select node → UNLOCK (spends XP) |
| Choose a node on the run map | Click a highlighted forward node |
| Open shop | Land on a shop node on the run map |
| Pause | P |
| Restart node | (button in pause) |
| Back to run map | Escape |

---

## Progression / Difficulty

- **Cauldron tier** is the master progression dial — each tier unlocks ingredients, shapes, and
  deposit depth, and is earned by **clearing a chapter's boss node** (§9).
- **Route choice (§9):** the branching run map is itself a strategic layer — chase shops/caches for
  resources, or elites for bigger rewards at higher risk.
- **Objectives escalate by depth into the run:** early nodes = "clear N lines"; mid = "harvest
  deposit X"; the boss = layered, multi-part ("harvest the exotic vein *and* survive 20 placements").
- **Lattice pressure:** later levels seed more covered cells / pre-filled obstacles, shrinking
  workable space; bigger shapes (from higher tiers) demand better planning.
- **Ingredient scarcity:** rare deposits gate rare shapes — the player must choose whether to
  spend a scarce ingredient on a powerful shape now or hoard it.
- **Score** persists per level (stars/medals) to give replay incentive.

---

## UI / HUD

Kaplay-rendered (canvas), following the repo's retro-monospace convention. The screen splits into
three zones: the **lattice** (center, the star), the **tray** (bottom), and the **alchemist
panel** (right rail: cauldron, stores, objective). Story/map/cauldron are separate screens.

### Visual language
- **Aesthetic:** warm apothecary — aged parchment & dark wood, brass/gold accents, glass-vial
  greens and ember-oranges for ingredient tints. Each ingredient has a **distinct color + glyph**
  (never color alone) so blocks read at a glance.
- **Type:** monospace (`Courier New`); uppercase wide-tracked labels, normal-case flavor text.
- **Motion:** placed blocks settle with a tiny squash; cleared lines flash + dissolve into rising
  motes; harvested deposits bloom with a gold ring; score counts up rather than snapping.
- **Feedback:** valid ghost = soft green glow, invalid = red hatch; combo clears pop floating
  multiplier text; cauldron "bubbles" when a new shape is brewable.

### In-level HUD

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚗ ALCHEMIST'S LATTICE          ◷ OBJECTIVE: Harvest the Salt Vein 1/3 │  ← top bar
│                                                                        │
│        ┌─────────────────────────────────┐      ╔════ CAULDRON ═════╗  │
│        │ . . . ▣ ▣ . . . .                │      ║  Tier 1 — Clay     ║  │
│        │ . . . ▣ ▣ . . . .                │      ║  ◉ bubbling…       ║  │
│        │ . . . . . ░ ░ . .   ░ = buried   │      ╠════ STORES ═══════╣  │
│        │ . ▤ ▤ ▤ . ░ ░ . .   deposit      │      ║  ✦ salt   ×12      ║  │
│        │ . . . . . . . . .                │      ║  ⬢ ember  ×3       ║  │
│        │ . . . . . . . . .                │      ║  ❀ dew    ×0       ║  │
│        │ . . . . . . . . .                │      ╠════ SCORE ════════╣  │
│        │ . . . . . . . . .                │      ║  4 820   ▲ x2 combo║  │
│        │ . . . . . . . . .                │      ╚════════════════════╝  │
│        └─────────────────────────────────┘                             │
│                                                                        │
│   TRAY:   ┌──┐   ┌────┐   ┌──┐        ITEMS: 🧪×2  ♺×1  │ ⇄ Tile Swap   │  ← tray + item bar
│          ✦│▣▣│  ⬢│▣   │  ✦│▣ │                         │   ready ●      │
│          ✦│▣▣│  ⬢│▣▣▣ │   │  │        (consumables)    │ (passive)      │
│           └──┘   └────┘   └──┘                                          │
└──────────────────────────────────────────────────────────────────────┘
```

- **Top bar:** title + current **objective** with live progress.
- **Lattice (center):** the grid; empty/filled/buried cells distinct; drag-ghost overlays here.
- **Cauldron panel:** current tier + a "brewing" indicator when a new shape can be minted.
- **Stores panel:** ingredient counts with glyph+color; dims an ingredient at 0.
- **Score panel:** score (counts up) + active combo/streak multiplier + a small **XP** readout
  (XP earned this level).
- **Tray (bottom):** the up-to-3 draggable shapes, each tinted by its dominant ingredient and
  labeled with the ingredient glyph; consumed slots show "brewing…" until refilled.
- **Item bar (bottom-right):** owned **consumables** (bought at shops) with counts (click to select
  → click a target) and **activated-passive** chips (unlocked in the skill tree) showing ready
  (`●`) or charging (a shrinking cooldown ring + remaining-N). A consumable greys out at count 0; a
  passive greys while cooling down. Always-on passives (e.g. Deep Sight) don't appear here — they
  just apply.

### Other screens

| Screen | Contents |
|--------|----------|
| Splash | Title, "press any key / click to start", controls hint, version tag |
| **Run map** | Branching left→right node path to the boss; current node highlighted, reachable forward nodes selectable, taken path/visited nodes marked. Carries currency/items HUD. See below |
| Story beat | Narrated interstitial (apprentice → journeyman → guild mark) between chapters / on boss clear |
| Cache / event | Small narrative event node: a reward or a trade-off choice |
| Cauldron (`C`) | Recipe book: shapes you can brew, their ingredient costs, tier-locked entries greyed |
| Stores (`I`) | Full ingredient inventory with tiers + flavor/lore |
| **Character (`B`)** | Tabbed: **Inventory** (owned consumables), **Stats** (vitals/XP/level), **Skill Tree** (mind-map of passive power-ups, spend XP to unlock). See below |
| **Shop** | A shop *node* on the run map; spend currency on **consumables only**; see below |
| Pause (`P`) | Resume / restart node / abandon run → map or title |
| Node complete | Score, stars, rewards (currency/ingredients), "continue" → back to run map |
| Boss complete | Chapter summary, **cauldron upgraded** flourish → story beat → next chapter's map |
| Node failed | "The lattice is jammed" (no legal placement) **or** "The quest slips away" (objective impossible) → retry node / map (run-end behavior is an open question, §9) |

### Run map screen

A horizontally-scrolling, layered node graph (§9). The player's committed path glows; the **current
node** pulses; the **forward-reachable nodes** are bright/clickable; everything else is dimmed.
Currency and a compact item readout sit in a top bar. Choosing a node commits to it (no backtrack).

```
┌─ CHAPTER I · The Cracked Cauldron ───────────────  ✦ 120 grams   🧪×2 ⇄● ─┐
│                                                                            │
│   START                                                              BOSS  │
│    ⚗ ───── 🛒 ───── ⚗ ╮       ╭─ 🔥 ─────╮                               │
│    │        ╲        ╲ ╲     ╱           ╲                                  │
│    │         ╲        ⚗ ───── 🎁 ───── ⚗ ─────╮                            │
│    ⚗ ───── ⚗ ╳        ╱       ╲        ╱        ╲                          │
│              ╲       ╱         🛒 ───── ⚗ ───── 💀  ← far right            │
│               🎁 ── ⚗                  ╱                                    │
│                                                                            │
│   ⚗ puzzle   🛒 shop   🎁 cache/event   🔥 elite   💀 boss                  │
│   ▸ choose one of the highlighted forward nodes   (no going back)          │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Left→right progression:** every edge advances one layer toward the boss; you pick among the
  2–3 nodes your current node connects to.
- **Legibility:** node icons + labels (never color alone); the path you've taken stays drawn so the
  run reads as a story; locked/unreachable nodes are dimmed.
- **Top bar** carries currency and an at-a-glance item/passive summary so route decisions ("can I
  afford that shop?") are informed.
- Hovering a node previews its type/reward; the boss node is always visually distinct at the far
  right.

### Shop screen

A **shop node** on the run map (§9). Sells **consumables only** (passives come from the skill tree,
§10). Currency up top; each item lists price, effect, and your owned count. Leaving returns to the
run map.

```
┌──── ⚗ THE APOTHECARY MARKET ──────────────────────  ✦ 340 grams ────┐
│                                                                      │
│   ╔═ CONSUMABLES (one-off, used during a level) ═══════════════════╗ │
│   ║ 🧪 Dissolvent     40g   own ×2   "Eats one block clean away." + ║ │
│   ║ ♺ Catalyst        60g   own ×1   "Re-deal the current set."   + ║ │
│   ║ ⟐ Transmute Vial  75g   own ×0   "Convert a held shape's type"+ ║ │
│   ║ ✶ Reveal Salts    50g   own ×0   "Strip one deposit cover."   + ║ │
│   ╚══════════════════════════════════════════════════════════════╝ │
│                                                                      │
│   selected: Dissolvent — clears a single chosen filled cell.         │
│   [ BUY ]   [ SELL surplus ingredients ]              [ LEAVE → ]    │
└────────────────────────────────────────────────────────────────────┘
```

- **Currency (`grams`)** top-right; an unaffordable buy is greyed with the shortfall.
- Each consumable lists name, price, effect, and owned count (stacks to a cap); `+`/BUY purchases one.
- **Sell** surplus ingredients for currency (open question whether this is in v1).
- Buying is only allowed at a shop node — shopping is a run-map beat, not done mid-puzzle.

### Character screen (`B`)

A tabbed modal, openable on the run map and (paused) mid-level. Three tabs: **Inventory**, **Stats**,
**Skill Tree**. This is the home of consumables, the alchemist's stats, and XP-spent passive
unlocks.

```
┌──── ◈ THE ALCHEMIST ◈ ─────────  [ INVENTORY ] [ STATS ] [ SKILL TREE ]──┐
│  ── INVENTORY ──────────────────────────────────────────────────────────│
│   CONSUMABLES (one-off — buy more at a shop)                             │
│   ┌────────────┬────────────┬────────────┬────────────┐                  │
│   │ 🧪 Dissolv. │ ♺ Catalyst │ ⟐ Transmute│  (empty)   │   click an item  │
│   │   ×2       │   ×1       │   ×0 (grey)│            │   to read / use  │
│   └────────────┴────────────┴────────────┴────────────┘                  │
│                                                                          │
│  ── STATS ───────────────────────────────────────────────────────────── │
│   Level 4   ✦ XP 320 / 500 ▓▓▓▓▓▓░░░    Currency: 340 grams              │
│   Cauldron: Tier 2 (Tin)   Chapters cleared: 1                           │
│   Lines cleared 142 · Deposits harvested 9 · Best combo ×4               │
│                                                                          │
│  ── SKILL TREE (mind map) ───────────────────  ✦ 320 XP to spend ──────  │
│            ⇄ Tile Swap●───── ✋ Steady Hand○                              │
│           ╱            ╲                                                  │
│      (START)            ♺ Catalyst Affinity○                             │
│           ╲                                                              │
│            👁 Deep Sight●───── 🔭 Surveyor○───── ✨ Surge○                 │
│                                                                          │
│   ● unlocked   ○ available (costs XP)   · locked (needs prereq)          │
│   selected: Surveyor — "Preview the next set."   cost 120 XP  [ UNLOCK ] │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Inventory tab** — your owned **consumables** as a grid with counts; a 0-count item greys out.
  Click to read its effect (and use it, if a level is open). No passives here — they live in the tree.
- **Stats tab** — character **level + XP bar**, current cauldron tier, currency, and run/career
  tallies (lines cleared, deposits harvested, best combo). Whether stats are purely informational
  or scale anything is an open question (§10).
- **Skill Tree tab** — the **mind-map of passive power-ups** (§10): an organic node web, edges = 
  prerequisites. Nodes show unlocked (`●`) / available (`○`, costs XP) / locked (`·`). Select an
  available node → see cost + effect → **UNLOCK** spends XP and lights it permanently. This is the
  *only* way to gain passives.

### Accessibility & responsiveness
- Letterbox-scaled canvas; HUD reflows but lattice stays centered and square.
- Every ingredient = **glyph + color + label**, never color alone.
- Keyboard fallback for drag (select shape with number key, move with arrows, Enter to place) —
  open question, see below.
- Respect `prefers-reduced-motion`: keep dissolve/clears instant, drop the squash/particle juice.

---

## Sound Design

Web Audio API — procedural, no file assets (see repo `sounds.js` convention).

| Sound | Trigger | Style |
|-------|---------|-------|
| UI click | Menu / button | Short sine blip |
| Pick up shape | Start dragging | Soft pluck |
| Place (valid) | Commit a shape | Wooden tick + tiny thud |
| Invalid | Release on bad spot | Dull buzz |
| Line clear | Row/column clears | Rising glassy arpeggio (pitch ↑ per simultaneous line) |
| Combo | Multi-line clear | Shimmer + higher chime |
| Cover stripped | Deposit layer removed | Gritty scrape |
| Harvest | Deposit fully revealed | Warm bell bloom |
| Brew | New shape minted | Bubbling glug |
| Cauldron upgrade | Tier up | Triumphant chord |
| Purchase | Buy a consumable in shop | Coin clink + register ding |
| Item used | Consumable consumed | Quick fizzy pop |
| XP gained | Earn XP | Soft ascending tick |
| Skill unlocked | Unlock a skill-tree node | Resonant unlock chime + sparkle |
| Passive trigger | Activate a passive (e.g. Tile Swap) | Soft warp/whoosh |
| Passive ready | Cooldown finishes | Tiny rising "ready" chime |
| Level complete | Win | Major arpeggio flourish |
| Jammed | No legal placement for a held shape | Low descending sawtooth |
| Quest lost | Objective became impossible | Hollow detuned fall |

---

## Phases

### Phase 1 — Scaffold & core puzzle (no alchemy yet)
- [ ] Scaffold: `index.html`, `js/{main,config,events,state,sounds,ui}.js` (Kaplay module pattern,
      splash → game → result scenes; `events.clearAll()` on scene leave)
- [ ] `grid.js` — lattice data model, render, cell states (empty/filled/buried)
- [ ] `pieces.js` — polyomino shape definitions (mono→tetromino families)
- [ ] `drag.js` — drag-and-drop with snap + ghost preview (green/red), valid-placement test
- [ ] **Set of 3** **random** shapes (placeholder for cauldron); must place all 3, then re-deal
- [ ] Line-clear detection + scoring + combo/streak; dissolve juice
- [ ] **Failure 1 — jammed:** after each placement / new set, if no held shape has any legal spot →
      `levelFailed {reason:'jammed'}` → result screen; HUD warns when a held shape is nearly stuck
- [ ] Sounds: click, pickup, place, invalid, line clear, combo, jammed

### Phase 2 — Deposits (clearing reveals ingredients)
- [ ] Deposit data: multi-cell regions + cover layers, seeded per level
- [ ] Buried-cell rendering + hover tooltip
- [ ] Line-clear strips cover layers over deposit cells; harvest on full reveal
- [ ] Stores model: ingredient counts; harvest adds to stores
- [ ] Stores HUD panel; harvest flourish; cover-strip + harvest sounds

### Phase 3 — Cauldron (ingredients → shapes)
- [ ] Ingredient & recipe definitions (cost per shape), ingredient tiers
- [ ] Cauldron brews tray shapes from stores instead of pure random; filler-shape fallback
- [ ] Cauldron + recipe-book screen (`C`); brewing indicator; shapes tinted by ingredient
- [ ] Brew sound; stores spent on brew

### Phase 4 — Levels, objectives & progression
- [ ] Level definitions (objective type, grid size, seeded deposits, obstacles)
- [ ] Objective tracking (collect / score / spell-component quests) + node-complete (rewards) /
      cauldron-tier upgrade on **boss** clear
- [ ] Story-beat interstitials between chapters
- [ ] **Failure 2 — infeasible:** conservative feasibility check per objective type (best-case
      remaining score < target; required deposit cells unreachable; not enough qualifying lines
      formable) → `levelFailed {reason:'infeasible'}`; only fail when clearly impossible
- [ ] Cauldron-upgrade & level-complete sounds; save progress (localStorage)
- [ ] **Currency & XP:** award `grams` and `XP` on node completion; track in state
      (`currencyChanged`, `xpChanged`)

### Phase 5 — Run map (Slay-the-Spire branching)
- [ ] `map.js` — seeded procedural map generation: layered DAG, 2–3 forward edges per node,
      diverge/re-converge, boss terminal at far right; fairness guarantees (≥1 shop before boss,
      no back-to-back elites)
- [ ] Node types: puzzle / shop / cache-event / elite / boss, each routing to its screen
- [ ] **Run map screen**: horizontal node graph, current/forward/visited node states, currency +
      item top bar, click-to-commit (no backtrack), node hover preview
- [ ] Run state: carry currency/items/stores across nodes; node-clear advances the branch
- [ ] Cache/event nodes (reward or trade-off choice); boss-clear → chapter complete → next map
- [ ] Decide & implement run-failure behavior (retry-node default vs. roguelike chapter-restart, §9)

### Phase 6 — Consumables, shop & character screen
- [ ] `items.js` — **consumables** model (count, deplete); use logic applying effects to grid/deposits/tray
- [ ] In-level **item bar** (HUD): consumable counts (select → target)
- [ ] First consumables (Dissolvent, Catalyst, Transmute Vial, Reveal Salts)
- [ ] `shop.js` + **shop screen** as a **shop node**: **consumables only**, buy with currency,
      owned-count/greyed states; leaving returns to the run map
- [ ] **Character screen (`B`)** with **Inventory** + **Stats** tabs; persist owned items & currency
- [ ] Sounds: purchase, item use

### Phase 7 — XP, skill tree & passives
- [ ] XP model: award on clears/combos/harvests/elites/bosses; `xpChanged`; (optional) character level
- [ ] `skilltree.js` — passive-power-up node graph (prereqs, XP cost), unlock state, spend logic
- [ ] **Skill Tree tab** on the character screen: mind-map render, node states (unlocked/available/locked),
      select → UNLOCK (spends XP)
- [ ] Passive effects in-level: always-on passives apply; **activated** passives (Tile Swap) added to
      the item bar with placement-based cooldown
- [ ] First passives across branches (Tile Swap, Deep Sight, Surveyor, Steady Hand…); persist unlocks in save
- [ ] Sounds: skill unlock, passive trigger / ready-again

### Phase 8 — Polish & content
- [ ] Full ingredient/recipe roster across all tiers; balance pass on economy + item prices + XP curve
- [ ] More level objectives + obstacle variety; difficulty curve tuning; map-generation tuning; tree tuning
- [ ] Reduced-motion support, keyboard-drag fallback, responsive scaling pass
- [ ] Add to root launcher `js/gamedata.js`

### Phase 9+ — Power-ups *(future enhancement)*
- [ ] Power-up framework (earn/charge/consume model — see §7 open questions)
- [ ] Line-breaker & column-breaker (destroy a row/column; interacts with deposit cover-stripping)
- [ ] Rotate power-up (temporarily allow rotating the held shape before placing)
- [ ] Power-up HUD slot + sounds

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `shapePicked` | {shapeId} | drag | sounds, ui |
| `shapePlaced` | {shapeId, cells} | drag/grid | grid, score, sounds |
| `placeInvalid` | — | drag | sounds |
| `linesCleared` | {rows, cols, cells, combo} | grid | score, deposits, sounds, ui |
| `scoreChanged` | newScore | state | ui |
| `comboChanged` | multiplier | state | ui |
| `coverStripped` | {depositId, cell, layersLeft} | deposits | sounds, ui |
| `depositHarvested` | {ingredientId, qty} | deposits | stores, sounds, ui |
| `storesChanged` | {ingredientId, qty} | state | ui (stores), cauldron |
| `shapeBrewed` | {slot, shapeId, cost} | cauldron | tray, sounds, ui |
| `setDealt` | {shapes} | cauldron | drag, ui |
| `objectiveProgress` | {kind, cur, target} | level | ui |
| `objectiveMet` | {levelId} | level | main, ui |
| `cauldronUpgraded` | {newTier} | state | ui, cauldron, sounds |
| `currencyChanged` | newAmount | state | ui, shop |
| `itemPurchased` | {itemId, cost} | shop | state, sounds |
| `itemUsed` | {itemId} | items | grid/deposits/cauldron, state, sounds |
| `xpChanged` | {xp, level} | state | ui (HUD/stats) |
| `skillUnlocked` | {skillId, xpSpent} | skilltree | state, ui, sounds |
| `passiveTriggered` | {skillId} | items | grid, ui (start cooldown), sounds |
| `passiveCooldownChanged` | {skillId, remaining} | state | ui (item bar) |
| `shapeNearlyStuck` | {shapeId, legalSpots} | grid | ui (jam warning) |
| `noMovesLeft` | {heldShapes} | grid | level (→ `levelFailed 'jammed'`) |
| `objectiveInfeasible` | {kind, reason} | level | level (→ `levelFailed 'infeasible'`) |
| `levelFailed` | {reason: 'jammed' \| 'infeasible'} | level | main, ui, sounds |
| `mapGenerated` | {nodes, edges, seed} | map | ui (run map), main |
| `nodeSelected` | {nodeId, type} | map | main (route to node screen) |
| `nodeCleared` | {nodeId, rewards} | level/shop/event | map (advance branch), state |
| `bossCleared` | {chapter} | level | main, state (→ `cauldronUpgraded`), ui |
| `runEnded` | {result: 'boss' \| 'failed'} | main | ui, state |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Scene state machine (splash/runmap/storybeat/shop/event/game/result), Kaplay init, orchestration |
| `config.js` | Grid size, tray size, colors, ingredient/shape/recipe tables, item/shop/skill-tree tables, level + map-gen defs |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton (score, combo, stores, currency, **XP/level**, owned consumables, **unlocked skills**, passive cooldowns, cauldron tier, progress) |
| `sounds.js` | Web Audio procedural SFX |
| `ui.js` | HUD panels (objective, cauldron, stores, score, XP, tray, item bar) |
| `grid.js` | Lattice data + render, line-clear detection, stuck detection |
| `pieces.js` | Polyomino shape definitions |
| `drag.js` | Drag-and-drop, snap, ghost preview, placement validation |
| `deposits.js` | Buried deposits, cover layers, reveal/harvest logic |
| `cauldron.js` | Ingredient→shape brewing, recipes, tray refill |
| `items.js` | Consumable use + activated-passive cooldown logic; applies effects to grid/deposits/etc. |
| `shop.js` | Shop node screen (consumables only), buy/sell, currency spend |
| `character.js` | Character screen: Inventory / Stats / Skill-Tree tabs |
| `skilltree.js` | Passive-power-up node graph, prereqs, XP unlock/spend logic |
| `map.js` | Seeded run-map generation (branching DAG), node types, run-map screen, route state |
| `level.js` | Level definitions, objectives, win/fail (jammed & infeasible), rewards, node/boss progression |

---

## Open Questions

- [x] **Shape rotation in v1?** — *Resolved: NO.* Fixed orientations only; rotation returns later
      as a power-up (§7).
- [ ] **Power-ups (§7):** how are they earned (brewed from rare ingredients / awarded for big
      combos / bought between levels)? One-shot consumables or a charged meter? How does a
      line/column-breaker interact with deposit cover-stripping?
- [x] **Tray cadence?** — *Resolved:* dealt in **sets of 3**; must place all 3 before the next set
      (the *1010!* model). This is also failure condition 1's trigger.
- [ ] **Infeasibility detection (failure 2):** how aggressive? v1 plan is a *conservative* check
      (only fail when clearly impossible) to avoid false-failing winnable boards — a full solver is
      out of scope. Per-objective heuristics need defining (best-case score bound, deposit
      reachability, qualifying-line count).
- [ ] Do covered deposit cells block placement, or are they placeable-over (current plan: placeable)?
- [ ] Cauldron economy: do shapes *always* cost ingredients (risk of soft-lock), or is there a
      free common-shape stream with paid premium shapes? (current plan: free filler fallback)
- [ ] Keyboard-only drag fallback design, or mouse/touch-first and accept it?
- [ ] Procedural deposit/level seeding vs. hand-authored *individual levels* — note the **run map
      itself is procedural** (§9); the question is now about the puzzle content inside each node.
- [ ] Persist stores/cauldron tier across whole campaign (RPG-save) vs. reset each chapter/run?
- [ ] How much narrative — light flavor text, or a real branching apprentice story?
- [ ] **Run-failure model (§9):** retry-the-node (campaign default) vs. roguelike "fail = restart
      the chapter from a fresh map" (the Spire model the branching structure invites)? Could be a
      mode toggle.
- [ ] **Map shape:** how many layers per chapter, edges-per-node (2 vs 2–3), and generation
      guarantees (min shops, elite spacing, reward distribution)?
- [ ] **Re-convergence rules:** how often branches merge — wide web vs. mostly-parallel lanes?
- [ ] **Shop economy:** currency source — node-completion rewards only, or also **selling surplus
      ingredients**? Consumable prices and whether shop stock restocks/expands as cauldron tier rises.
- [ ] **XP & character level (§10):** does XP also grant a numeric level, and do **stats scale** with
      it or are they purely informational? XP award rates (clears/combos/harvests/elites/bosses)?
- [ ] **Skill tree shape (§10):** one campaign-long tree or per-chapter? Tree size in v1? Are nodes
      **refundable/respec-able**? Do skill nodes have tiers (e.g. Tile Swap with a shorter cooldown)?
- [ ] **Passive cooldown unit:** measured in **placements** vs **line-clears** vs sets dealt — which
      keeps it puzzle-paced and fair? (current plan: placements)
- [ ] **Naming clash:** §7 destructive "power-ups" vs §10 skill-tree "passive power-ups" — rename one
      (e.g. §7 → "board tools" / "spells") to avoid confusion?
- [ ] Should consumables be **usable mid-level only**, or also from the run-map / cache nodes?
- [ ] Currency name — placeholder is **grams** (refined essence); confirm or rename.

---

## Changelog

### Planning (2026-06-14)
- Initial game plan authored: drag-and-drop polyomino placement puzzle fused with an alchemy
  resource loop (deposits revealed by line-clears → ingredients → cauldron-brewed shapes) and a
  cauldron-tier story campaign. Engine: Kaplay v4000. Phases, event catalog, module map, and open
  questions defined; nothing scaffolded yet.
- Locked the core mechanic to **fixed-orientation placement (no rotation in v1)**. Added §7
  Power-ups as a future enhancement (line-breaker, column-breaker, rotate), a Phase 6+ block, and
  resolved the rotation open question accordingly.
- Defined **tray cadence** (dealt in sets of 3, must place all 3) and a dedicated **Failure
  Conditions** section with two soft-fail states: (1) *jammed* — a held piece has no legal
  placement; (2) *infeasible* — the quest objective (collect / score / spell-component) can no
  longer be met. Added `shapeNearlyStuck` / `objectiveInfeasible` events, refined `levelFailed`
  reason values, renamed `trayRefilled`→`setDealt`, split the two checks across Phase 1 (jammed)
  and Phase 4 (infeasible), and noted infeasibility uses a conservative bound, not a full solver.
- Added the **shop & items** layer (§8): a **currency** (placeholder *grams*) earned from levels,
  spent in a **shop screen** on two separate classes — **consumables** (one-off, depleting; e.g.
  Dissolvent, Catalyst, Transmute Vial, Reveal Salts) and **passives** (permanent, cooldown-gated;
  canonical **Tile Swap**). Added an in-level **item bar** to the HUD, a backpack screen (`B`), the
  shop screen mockup, `items.js` + `shop.js` modules, currency/item/passive events, item sounds,
  and a new Shop & items phase. Noted the shop sells tools/conveniences only — never cauldron tiers
  — so it can't trivialize progression.
- Restructured chapters into a **Slay-the-Spire-style branching run map** (§9): a seeded procedural
  layered DAG traversed left→right via binary/trinary choices to a **boss node at the far right**,
  with node types (puzzle / shop / cache-event / elite / boss). The **shop is now a node** on this
  map rather than an always-available menu; **clearing the boss** is what grants the cauldron-tier
  upgrade + story beat. Added the run-map screen + ASCII mockup, `map.js`, map/node events
  (`mapGenerated`, `nodeSelected`, `nodeCleared`, `bossCleared`, `runEnded`), and a dedicated
  **Phase 5 — Run map** (pushing Shop→6, Polish→7, Power-ups→8). Reworked the Game Loop, screens
  table, controls, and progression around node traversal; flagged the run-failure model
  (retry-node vs. roguelike chapter-restart) and map-generation tuning as open questions.
- **Split item acquisition into two tracks** and added a **character screen**: the **shop now sells
  consumables only** (bought with **currency**), while **passive power-ups are unlocked in a
  mind-map skill tree** spending **XP** (new §10). Added a tabbed **Character screen (`B`)** —
  **Inventory** (consumables), **Stats** (level/XP/career tallies), **Skill Tree** (passive node
  web) — with an ASCII mockup; rewrote §8 (now "Items & the shop") and the shop screen to drop
  passives; added XP to node rewards and the HUD. New `character.js` + `skilltree.js` modules,
  `state` now tracks XP/level + unlocked skills; new events (`xpChanged`, `skillUnlocked`, and
  `passive*` keyed by `skillId`); `itemPurchased` is consumable-only; new XP/skill sounds. Split
  the old Shop phase into **Phase 6 (consumables/shop/character)** and **Phase 7 (XP/skill tree/
  passives)**, pushing Polish→8 and Power-ups→9. Flagged XP-level/stat-scaling, tree shape/respec,
  and the §7-vs-§10 "power-up" naming clash as open questions.
