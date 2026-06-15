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
abstract tiles — they are **tile types made of elements** (salt, ember, dew, root, ash…). At your
**cauldron** — a *between-levels* workbench, never opened mid-puzzle — you combine the **primordial
elements** you've gathered to **define and unlock new tile types**. The cauldron is *crafting*, not
piece-minting: it decides *which kinds of tile exist* in your repertoire, and unlocking a richer
type widens what a level can hand you. And the lattice itself is not empty: buried beneath it are
**dormant element deposits**. Clearing lines peels away the layers covering a deposit; reveal the
whole deposit (which may span several cells and take several clears) and you harvest a new, rarer
element into your stores — fuel for unlocking the next tile type at the cauldron.

Inside a level there is **no brewing**: you are given a **preset, finite supply** of each tile type
the level stocks, dealt to the tray a few at a time. The cauldron stays back at the workbench. The
two layers connect *between* levels — harvest elements in the field, then spend them at the cauldron
to unlock the tile types future levels can stock.

Wrapping all of this is a **story campaign**. You begin as an apprentice with a cracked starter
cauldron that can only process the lowest-tier elements. Completing a level's objective upgrades
your cauldron, letting you process higher-tier elements, unlock larger/stranger tile types, and
tackle deeper deposits — and advances the narrative of an alchemist earning their guild mark.

The same block-placement engine drives **three kinds of level** (see §11): **exploration** levels
(harvest deposits, the loop described above), **refinement** levels (use the lattice to *brew a
specific potion* under recipe conditions, with optional enhancement ingredients raising the
quality), and **battle grids** (enemies occupy cells and you clear lines over them to deal damage).
All three share the tray, line-clears, and the preset tile supply — they differ in win/lose
conditions and what lives on the grid. (Only refinement levels "brew" anything, and that's the
*potion objective on the grid*, §11b — distinct from the meta cauldron.)

---

## The two intertwined loops

The game is deliberately two loops feeding each other; keeping them legibly separate in the
design (and code) is the whole trick.

- **The puzzle loop (moment-to-moment, in a level):** you're given a preset finite supply of tile
  types; drag shapes from the tray → place on the lattice → clear lines → don't get stuck or run
  out. This is fast, tactile, and never blocks on the RPG layer — the cauldron is not opened here.
- **The alchemy/RPG loop (between levels, at the workbench):** clearing lines reveals deposits →
  harvested elements fill your stores → at the **cauldron** you spend elements to **unlock new tile
  types** → cauldron upgrades (earned via level objectives) gate which elements/tile types exist.
  Unlocking a type widens what *future* levels can stock; it does **not** mint pieces into a live
  tray.

> Design rule: the puzzle loop must be **fully playable** before any alchemy exists. Alchemy is a
> meta-layer that changes *which tile types exist* and *why you clear* — not a dependency the core
> placement loop waits on. The cauldron lives between levels, never inside one.

---

## Core Mechanics

### 1. The lattice (placement grid)
A square grid of cells (`GRID_W` × `GRID_H`, start at **9 × 9**; later levels may resize). Each
cell is empty, filled, or part of a **covered deposit** (see §5). The grid never scrolls and
pieces never fall — placement is pure spatial planning.

### 2. The tray (drag-and-drop shapes)
A level stocks a **preset, finite supply** of tile types (§4): a fixed pool of shapes the level was
authored/seeded with. From that pool the player is dealt a **set of 3 shapes at a time** (config
`TRAY_SIZE = 3`) and **must place all three before the next set is dealt** — this is the *1010!*
cadence, and it's what creates real pressure: you can't fish for a piece that fits, you have to make
room for the hand you hold. A shape is a small cluster of **1–4 connected blocks** (mono, domino,
tromino, tetromino — all the *1010!*-style polyomino families). **Shapes are placed in fixed
orientations — no rotation in v1.** So planning is about *where* a shape goes, not how you turn it
(rotation returns later as a power-up — see §7). The player drags a shape onto the lattice; it snaps
to grid cells and shows a **ghost preview** (green = fits, red = collision/out-of-bounds). Release
on a valid spot to commit. A shape can only be placed where *all* its cells land on empty lattice
cells. The three shapes may be placed in **any order**. When **all three** are placed, the next set
of 3 is **drawn from the level's remaining supply** — *not* refilled slot-by-slot as each piece is
placed. (This whole-set cadence is the *1010!* model and is what makes the jam check well-defined:
you only re-deal once the hand is empty.) If none of the shapes currently in hand can fit anywhere,
the level ends (see Failure Conditions); if the level's supply runs out before the objective is met,
that is the *out-of-pieces* failure (§Failure 2). There is **no cauldron/brewing inside a level** —
the supply is fixed when the level begins.

### 3. Line clears & scoring
After each placement, any **fully filled row or column** clears simultaneously. Scoring:
- Base points per cleared cell.
- **Combo** = the number of lines cleared by a *single* placement (an L that completes a row *and* a
  column is a ×2 combo). Combo is computed per-placement and is the multiplier referenced by
  refinement quality (§11b) and battle damage (§11c: `damage = base × combo`). A placement that
  clears nothing is combo 0/×1.
- **Streak** = consecutive *placements that each clear at least one line*; it adds a separate, gently
  ramping bonus and **resets to zero on any placement that clears nothing**. (Combo is within one
  placement; streak is across placements — they stack but are tracked independently.)
Cleared cells dissolve with a particle/flash effect and free the space for new shapes.

### 4. The cauldron (elements → tile types) — a *between-levels* workbench
The cauldron is **not** opened during a level and does **not** mint the tray. It is a meta-screen,
visited at the workbench between levels (and from the run map / pause), where you **combine
primordial elements from your stores to unlock new tile types** — *crafting recipes*, not pieces.
Each tile type has an unlock recipe of elements (e.g. unlocking the *ember L-tromino* type costs
2× *ember* + 1× *root*, paid **once**); once unlocked, that type is permanently in your repertoire
and becomes eligible to appear in the **preset supply** of future levels. Your **cauldron tier**
gates which elements it can process and which tile types it can unlock — higher tiers unlock
larger/rarer types and accept higher-tier elements. Tier is earned by clearing a chapter boss (§6/§9),
never bought.

> **Repertoire → level supply.** Unlocking a tile type widens the *pool a level can draw from*; it
> does not place pieces into a live tray. When a level (or run map node) is generated, it is **seeded
> with a finite supply** of tiles chosen from the types you've unlocked (plus level-authored
> additions), and that supply is fixed for the duration of the level (§2). So the cauldron's effect
> is felt across runs ("now that I've unlocked the dew square, levels can stock it"), not within a
> single placement.

> **No in-level economy / no soft-lock.** Because tiles are a preset supply rather than purchased
> per-set, a level can never "run out of money to brew" mid-puzzle. The only supply-side failure is
> the authored finite pool being exhausted before the objective (§Failure 2). Level seeding
> guarantees a baseline of common, flexible tiles so the opening is always playable.

> This reframes the classic loop as **harvest elements (in levels) → unlock tile types (at the
> cauldron) → richer levels** — keeping the puzzle economy (preset tiles) cleanly separate from the
> RPG economy (elements + cauldron crafting).

> **Supply defaults (v1 — tunable in Phase 9).** A level's supply is **objective-driven**, sized so a
> competent player clears with comfortable margin and *out-of-pieces* (§Failure 2) is a real but rare
> backstop — **jamming is the primary fail; exhaustion is the safety net.** Concretely:
> - **Size.** Estimate the placements a clean solve needs, then grant slack. Default
>   `SUPPLY_SLACK = 1.6×`: `supply_tiles = ceil( (objective_workload / avg_tile_cells) × 1.6 )`,
>   rounded **up to a whole multiple of `TRAY_SIZE` (3)** so the last set is never a partial hand.
>   `avg_tile_cells ≈ 2.5`. *Worked example, 9×9, "clear 6 lines":* a line is 9 cells but clears
>   reuse space, so empirically ~3–4 placed tiles per line cleared → ~21 tiles of real work →
>   `ceil(21 × 1.6) = 34 → round to 36 tiles (12 sets)`. Elite/boss nodes use a **tighter
>   `SUPPLY_SLACK = 1.25×`** (scarcity is the difficulty); early/tutorial nodes `2.0×`.
>   Refinement/battle objectives convert to a workload estimate the same way (clears needed to meet
>   conditions / to kill the enemy HP pool).
> - **Mix by rarity.** Draw tile types with **geometric tier weights** so commons dominate and the
>   opening is always playable: **common 60% / uncommon 25% / rare 12% / exotic 3%** (un-unlocked
>   tiers contribute 0 and their weight redistributes to commons). A type only appears if unlocked
>   (§4) or level-authored.
> - **Floors & shape guarantees.** Regardless of the roll: **≥40% of the supply is 1–2-cell tiles**
>   (mono/domino — the flexible "filler" that prevents lock-ups), and **every level includes ≥1
>   monomino** so a single-cell gap is always fillable. Authored levels may pin specific types
>   (e.g. a refinement recipe needing ember tiles seeds a minimum count of them).
> - **Determinism.** The supply list **and its deal order** are derived from the level/run **seed**
>   (§9), so a retried level re-deals the identical sequence — fair retries, no re-rolling into an
>   easier hand. The deal-fairness reordering (§Failure 1) operates within that seeded sequence.
>
> Config knobs: `SUPPLY_SLACK` (per node-class), `TIER_WEIGHTS`, `SMALL_TILE_FLOOR = 0.4`,
> `MIN_MONOMINOES = 1`. All live in `config.js` and are the main Phase 9 economy dials.

### 5. Deposits (clearing reveals ingredients)
Beneath the lattice, certain cells hide **deposit fragments**. A deposit is a multi-cell region
(1–6 cells) of a specific ingredient, hidden under one or more **cover layers**. Mechanics:
- Covered deposit cells render with a subtle "buried" overlay; they're still normal lattice cells
  for placement purposes — you place blocks on top of them exactly as on any empty cell. (The
  "do buried cells block placement?" open question is **resolved: no, placeable-over**.)
- A cover layer is only stripped when a deposit cell is **part of a line that clears** — i.e. that
  cell was filled by a block and its whole row or column completed. Each qualifying clear strips
  **one** layer; deep/rare deposits need multiple separate clears over the same cell. (A clear that
  doesn't include a given buried cell does nothing to it — covers are stripped per-cell, not per
  whole deposit.) When the line clears, the block on the deposit cell dissolves like any other; the
  cell returns to empty-but-buried (now one layer shallower) and can be filled and cleared again.
- When **every** fragment of a deposit is fully uncovered, the deposit **harvests**: its
  element is added to your stores (often a higher tier than you can currently process), with a
  reveal flourish, and that element becomes available to spend at the cauldron.
- A level seeds a known set of deposits; uncovering specific "objective" deposits is often the
  level's win condition.

### 6. RPG / progression layer (the alchemist's story)
- **Cauldron tiers (1→N):** each upgrade widens which elements it can process and which **tile types**
  it can unlock, and unlocks deeper deposits. Earned by completing level objectives, not bought.
- **Element tiers:** common → uncommon → rare → exotic. Higher tiers let the cauldron unlock
  bigger/odder tile types and are gated behind cauldron tier.
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
- **Node types** (each is an icon on the map). Puzzle nodes come in the three **level types** of
  §11, so a node icon also signals its mode:
  - **⚗ Exploration level** (§11a) — harvest deposits / hit a quest objective (the bulk of nodes).
  - **🜲 Refinement level** (§11b) — brew a target potion by meeting recipe conditions; quality graded.
  - **⚔ Battle grid** (§11c) — enemies on the lattice; clear lines over them to deal damage.
  - **🛒 Shop** — the apothecary market (§8); spend currency, no puzzle played.
  - **🎁 Cache / event** — a small narrative event or free reward (ingredient bundle, currency, a
    one-off consumable), sometimes a choice with a trade-off.
  - **🔥 Elite** — a harder puzzle level of any type (tighter board / nastier objective) with a richer reward.
  - **💀 Boss** — the chapter finale at the far right: usually a large multi-phase **battle grid** (§11c).
- **Generation:** seeded per chapter so a run is reproducible (retryable). Guarantees keep it fair —
  e.g. at least one shop reachable before the boss, no two elites back-to-back, boss always
  terminal. Exact density/rules are an open question.
- **Story & cauldron tiers** map onto the run: clearing the **boss** completes the chapter, advances
  the narrative beat (apprentice → journeyman → guild mark), and grants the **cauldron-tier upgrade**.
  Mid-chapter puzzle nodes award currency, ingredients, score, and **XP** (§10) but not tiers.
- **Persistence within a chapter:** currency, owned items, unlocked passives, XP, and stores carry
  **across nodes** within a run; whether they persist between chapters is the existing RPG-save
  open question.
- **Save scope & timing (what localStorage actually holds).** To survive quitting mid-run, the save
  must persist the **run state**, not just career totals: the chapter **seed**, the generated map,
  the **current node + committed path**, and the carried currency/items/XP/stores/passives/cauldron
  tier. Write the save **on every node resolution** (and on skill unlock / shop purchase) so a
  crash/quit resumes at the last node boundary — mid-puzzle state is *not* saved (a level in
  progress restarts from its seed on resume, consistent with retry-from-seed). One save slot for v1;
  whether a failed run is wiped or resumable depends on the run-failure model (open question §9).
- **Failure on the run:** a failed puzzle node (jammed / infeasible / defeated, §Failure) ends that node — open question
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

### 11. Level types (the same engine, three win conditions)
A "puzzle node" on the run map (§9) is **one of three level types**. All three use the identical
core — the lattice, the set-of-3 tray, fixed-orientation placement, line-clears, the cauldron, and
the §8/§10 items/passives. What differs is **what occupies the grid** and **how you win/lose**. A
node's icon on the map signals its type; the level intro states the objective.

#### 11a. Exploration levels *(the default — §5)*
The loop described throughout: clear lines to strip **deposit** covers and **harvest ingredients**.
Win by meeting the quest objective (collect / score / spell-component). This is the baseline; the
other two are variations on the same engine.

#### 11b. Refinement levels (brew a potion on the grid)
Here the lattice *is* the cauldron's working surface, and the goal isn't to harvest — it's to
**refine a specific potion** by satisfying its **recipe conditions** through how you clear lines.
Instead of a free "clear any line for points" objective, a refinement level prescribes a target:

- **Conditions to meet.** The recipe demands particular clears — e.g. *"clear 3 rows made entirely
  of ember"*, *"clear an N-line combo to reach a rolling boil"*, *"fill the central crucible cells
  in order"*, or *"clear X lines without ever clearing a dew line"* (a constraint/forbidden
  ingredient). Meeting all conditions = the potion brews → level complete.
- **Quality tiers.** A refinement isn't just pass/fail — it produces a potion at a **quality grade**
  (e.g. *crude → fine → pure → masterwork*) driven by how cleanly you hit the conditions: bigger
  combos, fewer wasted placements, hitting bonus targets. Higher quality = better reward (more
  currency/XP, a stronger consumable, or a higher-grade ingredient for stores).
- **Enhancement ingredients.** Optional **enhancement ingredients** (spent from stores *before or
  during* the brew) raise the ceiling or ease the conditions — e.g. a *stabilizer* widens the combo
  window, a *potency dust* bumps the quality grade if conditions are met, a *flux* lets one
  off-ingredient line still count. Using them is a risk/reward economy choice: spend rare matter for
  a masterwork, or brew crude and bank the ingredients.
- **Failure** is the usual jammed/infeasible (the recipe can no longer be satisfied), or — if a
  level imposes it — running out of a required matter before conditions are met.

#### 11c. Battle grids (clear lines over enemies to damage them)
A combat variant: **enemies occupy cells on the lattice**, and you fight by **clearing rows/columns
that pass over them**.

- **Enemies on the grid.** Each enemy sits on one or more cells with an **HP** value shown on it.
  Clearing a line **through** an enemy's cell deals damage (e.g. damage = base × combo multiplier);
  reduce an enemy to 0 HP to destroy it. Enemy cells are **obstacles** for placement (you must build
  *around* them, then clear over them), making them spatial threats as well as targets.
- **Enemy turns / threat.** Between your placements (or every N placements), enemies act: they may
  **advance** (occupy more cells, shrinking your space), **harden** (gain armor so a single clear
  isn't enough), **spawn adds**, or **attack you** — chipping a **player HP / focus** bar that, at
  zero, fails the level. This gives battle grids their own loss condition beyond jammed/infeasible.
  - **Advance into an occupied cell:** an enemy can only spread into **empty** cells (it cannot
    overwrite a block you've placed); if it would have no empty cell to advance into it does its
    next-preferred action instead. This keeps advance from silently deleting the player's work.
  - **Enemy-caused jams:** because advancing shrinks the playable region, a battle can become jammed
    *by the enemy turn* rather than by the player's placement. A jam detected immediately after an
    enemy turn must still read as a fair loss — the **turn timer** (below) exists precisely so the
    player can see the squeeze coming and clear space first. (It's still reported as `'jammed'`; the
    HUD message can note it was the enemy advance.)
- **Win condition.** Defeat all enemies (or the wave/boss-enemy) before your HP runs out or the
  board jams. **Boss nodes** (§9) are typically large battle grids with a multi-phase enemy.
- **Shared economy.** Items/passives matter most here — a *Dissolvent* can clear a blocking cell, a
  line-breaker power-up (§7, future) becomes a real weapon. Battle grids are where the consumable
  and passive layers pay off.

> Implementation note: all three reuse `grid.js` / `drag.js` / `pieces.js` / line-clear logic. The
> differences are **what seeds the grid** (deposits vs. recipe-crucible cells vs. enemies) and the
> **objective/fail module** that watches clears. Plan: a `levelType` field on each level def routes
> to the right overlay module (`refine.js` / `battle.js`) layered over the shared puzzle core.

---

## Game Loop

1. **Run map (§9):** view the branching path; pick one of the **2–3 forward nodes** to commit to.
2. **Resolve the chosen node** by type:
   - *Shop* → spend currency, then back to the map. *Cache/event* → take a reward/choice → map.
   - *Exploration / refinement / battle / elite / boss* → enter the level (continue below).
3. **Enter level:** lattice seeded for its **type** (§11) — deposits (exploration), a recipe crucible
   + enhancement choice (refinement), or enemies (battle) — *and* seeded with a **finite tile supply**
   drawn from your unlocked tile types (§4); the objective shown. No cauldron is opened here.
4. **Puzzle loop (shared):** drag tray shapes (dealt 3 at a time from the supply) → place → clear
   lines. The clears do type-specific work: strip deposit covers / satisfy recipe conditions / damage
   enemies.
5. **Resolve the type's goal:** harvest elements; or brew the potion at a **quality grade**
   (optionally spending enhancement ingredients); or destroy all enemies before your HP runs out.
6. **Objective met → node cleared:** award score/currency/**harvested elements**/XP (refinement
   reward scales with quality) → advance along the chosen branch, back to the map.
7. **Between levels (workbench/run map):** optionally open the **cauldron** (`C`) to spend harvested
   elements **unlocking new tile types** for future levels (§4) — never mid-level.
8. **Failure (see below) → node failed (soft):** retry the node (default).
9. **Reach & clear the boss (far right):** chapter complete → **upgrade cauldron tier**, story beat,
   next chapter's map. Repeat until the final cauldron and the guild-mark ending.

---

## Failure Conditions

A level is **failed** (soft — always retryable from the same seed, or bail to the map) when any of
these happens. All are checked after every placement (and #3 also on the enemy turn). The first two
apply to **every** level type; #3 is specific to **battle grids** (§11c).

### 1. Out of room — a forced piece can't be placed
You're dealt sets of 3 and must place all 3. If, at any point, **a shape still in your hand has no
legal placement anywhere on the lattice**, the level ends — the lattice is jammed.
- Checked after each placement *and* when a fresh set of 3 is dealt from the level's supply: if
  **no** shape now in hand fits anywhere, fail immediately (don't make the player hunt for the dead
  end themselves).
- **Deal-fairness rule:** because the next set is only *seen* once it's dealt, a jam triggered the
  instant a set lands feels arbitrary (the player never had a move). The deal should therefore, when
  the remaining supply allows it, **prefer a set containing at least one placeable shape** — order
  the draw so an obviously-dead hand isn't forced while a workable one is still available. A
  deal-time jam should only happen when the board is genuinely so full that *no* remaining tile fits
  anywhere — a real dead end, not an unlucky draw order.
- The HUD should warn before the wall is hit — e.g. flag a shape *currently in hand* that has very
  few legal spots left, so a jam feels earned. (The warning applies to the held set; you can't
  preview the next hand absent the *Surveyor* passive, §10.)
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
>
> For **refinement** levels, condition 2 reads as "the recipe conditions can no longer all be met";
> for **battle** levels it reads as "the remaining enemies can no longer be killed" (rare, but e.g.
> nowhere left to build a clearing line).

### 3. Defeated — player HP reaches zero *(battle grids only)*
On a **battle grid** (§11c), enemies attack on their turn and chip a **player HP / focus** bar. If
it hits zero, the level ends.
- Shown as an HP bar in the battle HUD; low-HP warning pulse.
- Result screen: *"You were overwhelmed."* → retry (same seed) / map.

Failures emit `levelFailed {reason}` (`'jammed'` / `'infeasible'` / `'defeated'`) so the result
screen can show the right message.

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
| Open cauldron (between levels) / view recipes | C — at the workbench it's the crafting screen; mid-level it's read-only (tile-type recipe book, no crafting) |
| Open element stores | I |
| Open character screen (inventory / stats / skill tree) | B |
| Unlock a passive (skill tree) | Open character → Skill Tree tab → select node → UNLOCK (spends XP) |
| Choose a node on the run map | Click a highlighted forward node |
| Open shop | Land on a shop node on the run map |
| Pause | P |
| Restart node | (button in pause) |
| Back to run map | Escape |

---

## Progression / Difficulty

- **Cauldron tier** is the master progression dial — each tier widens which elements it can process
  and which **tile types** it can unlock, plus deposit depth, and is earned by **clearing a
  chapter's boss node** (§9).
- **Route choice (§9):** the branching run map is itself a strategic layer — chase shops/caches for
  resources, or elites for bigger rewards at higher risk.
- **Objectives escalate by depth into the run:** early nodes = "clear N lines"; mid = "harvest
  deposit X"; the boss = layered, multi-part ("harvest the exotic vein *and* survive 20 placements").
- **Lattice pressure:** later levels seed more covered cells / pre-filled obstacles, shrinking
  workable space; bigger shapes (from higher tiers) demand better planning.
- **Element scarcity:** rare deposits gate rare tile types — at the cauldron the player must choose
  whether to spend a scarce element unlocking a powerful tile type now or hoard it for a costlier one.
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
  multiplier text; a deposit "shivers" as its last cover layer is about to strip.

### In-level HUD — Exploration (§11a, the base layout)

The three level types share this skeleton (lattice center, tray + item bar bottom, side panels);
refinement and battle **swap the objective/side panels** for type-specific readouts (below).

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚗ ALCHEMIST'S LATTICE          ◷ OBJECTIVE: Harvest the Salt Vein 1/3 │  ← top bar
│                                                                        │
│        ┌─────────────────────────────────┐      ╔════ SUPPLY ═══════╗  │
│        │ . . . ▣ ▣ . . . .                │      ║  ✦ square  ×4 left ║  │
│        │ . . . ▣ ▣ . . . .                │      ║  ⬢ L-trio  ×2 left ║  │
│        │ . . . . . ░ ░ . .   ░ = buried   │      ║  ✦ mono    ×6 left ║  │
│        │ . ▤ ▤ ▤ . ░ ░ . .   deposit      │      ╠══ HARVESTED ══════╣  │
│        │ . . . . . . . . .                │      ║  ✦ salt   +12      ║  │
│        │ . . . . . . . . .                │      ║  ⬢ ember  +3       ║  │
│        │ . . . . . . . . .                │      ║  ❀ dew    +0       ║  │
│        │ . . . . . . . . .                │      ╠════ SCORE ════════╣  │
│        │ . . . . . . . . .                │      ║  4 820   ▲ x2 combo║  │
│        └─────────────────────────────────┘      ╚════════════════════╝  │
│                                                                        │
│   TRAY:   ┌──┐   ┌────┐   ┌──┐        ITEMS: 🧪×2  ♺×1  │ ⇄ Tile Swap   │  ← tray + item bar
│          ✦│▣▣│  ⬢│▣   │  ✦│▣ │                         │   ready ●      │
│          ✦│▣▣│  ⬢│▣▣▣ │   │  │        (consumables)    │ (passive)      │
│           └──┘   └────┘   └──┘                                          │
└──────────────────────────────────────────────────────────────────────┘
```

- **Top bar:** title + current **objective** with live progress.
- **Lattice (center):** the grid; empty/filled/buried cells distinct; drag-ghost overlays here.
- **Supply panel:** the level's **remaining tile supply** by type ("×N left") — the finite pool the
  tray draws from (§4); a type dims/disappears when exhausted, telegraphing the *out-of-pieces* wall.
- **Harvested panel:** elements harvested *this level* (glyph+color), which bank to your stores on
  completion for later cauldron unlocks; an element at +0 dims.
- **Score panel:** score (counts up) + active combo/streak multiplier + a small **XP** readout
  (XP earned this level).
- **Tray (bottom):** the up-to-3 draggable shapes, each tinted by its tile type and labeled with its
  glyph; once all three are placed the next set is dealt from the supply (consumed slots briefly
  empty until the set re-deals).
- **Item bar (bottom-right):** owned **consumables** (bought at shops) with counts (click to select
  → click a target) and **activated-passive** chips (unlocked in the skill tree) showing ready
  (`●`) or charging (a shrinking cooldown ring + remaining-N). A consumable greys out at count 0; a
  passive greys while cooling down. Always-on passives (e.g. Deep Sight) don't appear here — they
  just apply.

### In-level HUD — Refinement (§11b)

The right rail becomes a **recipe panel**: the target potion, its conditions (checked off as met),
the live **quality meter**, and an **enhancement** tray of ingredients you can spend.

```
┌──────────────────────────────────────────────────────────────────────┐
│  🜲 REFINING: Draught of Embers              QUALITY ▓▓▓▓░░  FINE       │  ← top bar
│        ┌─────────────────────────────────┐    ╔══ RECIPE ════════════╗ │
│        │            (lattice)            │    ║ ✓ clear 3 ember rows  ║ │
│        │   crucible cells highlighted ◇  │    ║ ◻ reach a ×3 combo    ║ │
│        │                                 │    ║ ◻ no dew lines        ║ │
│        │                                 │    ╠══ ENHANCEMENTS ══════╣ │
│        │                                 │    ║ + stabilizer  (×1)    ║ │
│        │                                 │    ║ + potency dust(×2)    ║ │
│        └─────────────────────────────────┘    ╚════════════════════════╝│
│   TRAY: …                              ITEMS: …                         │
└──────────────────────────────────────────────────────────────────────┘
```

- **Quality meter** (top) climbs with clean play and bonus targets; it sets the reward grade.
- **Recipe panel** lists conditions (✓ met, ◻ pending) and any forbidden-ingredient constraints.
- **Enhancements** are spendable ingredients that ease conditions / raise the ceiling (§11b); spent
  counts deplete from stores.

### In-level HUD — Battle (§11c)

Adds a **player HP / focus** bar and **enemy nameplates** on-grid; each enemy cell shows its HP and
a damage-on-clear hint.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚔ BATTLE: Cinder Imps        ❤ HP 14/20 ▓▓▓▓▓░░     ✦ x2 combo        │  ← top bar
│        ┌─────────────────────────────────┐    ╔══ THREATS ═══════════╗ │
│        │ . . 👹6 . . . . . .              │    ║ 👹 Cinder Imp  HP 6   ║ │
│        │ . . . . . 👹4 . . .   👹 = enemy │    ║ 👹 Cinder Imp  HP 4   ║ │
│        │ . ▣ ▣ . . . . . .   (obstacle +  │    ║ next enemy turn in 2  ║ │
│        │ . . . . . . . . .    target)     │    ╠══ STORES / SCORE ════╣ │
│        │ . . . . . . . . .                │    ║  …                    ║ │
│        └─────────────────────────────────┘    ╚════════════════════════╝│
│   TRAY: …                              ITEMS: 🧪×2 (clear a blocker)     │
└──────────────────────────────────────────────────────────────────────┘
```

- **Player HP bar** (top): drains on enemy attacks; zero = defeat (Failure §3); low-HP pulse.
- **Enemy cells** show HP; clearing a line through one deals damage (× combo); destroyed at 0.
- **Threats panel** lists enemies + a **turn timer** (placements until enemies act) so attacks aren't
  a surprise. Consumables/passives shine here (e.g. Dissolvent to open a clearing lane).

### Other screens

| Screen | Contents |
|--------|----------|
| Splash / title | Title, version tag, controls hint, and the run entry: **Continue** (resume a saved run — only if a save exists) and **New Run** (generates Chapter I's map from a fresh seed, wiping any prior run after a confirm). Plus a brief "press any key / click" on first boot |
| **Run map** | Branching left→right node path to the boss; current node highlighted, reachable forward nodes selectable, taken path/visited nodes marked. Carries currency/items HUD. See below |
| Story beat | Narrated interstitial (apprentice → journeyman → guild mark) between chapters / on boss clear |
| Cache / event | Small narrative event node: a reward or a trade-off choice |
| Cauldron (`C`) | **Between-levels crafting screen**: combine elements to **unlock new tile types**; lists each type's unlock recipe + element cost, tier-locked entries greyed, owned/unlocked types marked. Mid-level it opens **read-only** (recipe reference, no crafting) |
| Stores (`I`) | Full **element** inventory with tiers + flavor/lore (the fuel spent at the cauldron) |
| **Character (`B`)** | Tabbed: **Inventory** (owned consumables), **Stats** (vitals/XP/level), **Skill Tree** (mind-map of passive power-ups, spend XP to unlock). See below |
| **Shop** | A shop *node* on the run map; spend currency on **consumables only**; see below |
| Pause (`P`) | Resume / restart node / abandon run → map or title |
| Node complete | Score, stars, rewards (currency/ingredients/XP); **refinement** also shows the potion's **quality grade**; "continue" → back to run map |
| Boss complete | Chapter summary, **cauldron upgraded** flourish → story beat → next chapter's map |
| Node failed | Type-specific message — "The lattice is jammed" / "The quest slips away" / "You were overwhelmed" — → retry node / map (run-end behavior is an open question, §9) |

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
| Set dealt | New set of 3 drawn from supply | Soft triple shuffle/clack |
| Tile type unlocked | Cauldron unlocks a new tile type (between levels) | Bubbling glug + soft chime |
| Cauldron upgrade | Tier up | Triumphant chord |
| Purchase | Buy a consumable in shop | Coin clink + register ding |
| Item used | Consumable consumed | Quick fizzy pop |
| XP gained | Earn XP | Soft ascending tick |
| Skill unlocked | Unlock a skill-tree node | Resonant unlock chime + sparkle |
| Passive trigger | Activate a passive (e.g. Tile Swap) | Soft warp/whoosh |
| Passive ready | Cooldown finishes | Tiny rising "ready" chime |
| Condition met | Refinement recipe condition satisfied | Soft confirming bell |
| Quality up | Refinement quality grade rises | Brightening shimmer |
| Potion brewed | Refinement complete | Warm cork-pop + sparkle |
| Enemy hit | Clear a line over an enemy | Crunchy impact (pitch ↓ with HP) |
| Enemy defeated | Enemy destroyed | Shatter + descending puff |
| Player hurt | Enemy attacks the player | Dull thud + low warble |
| Defeated | Player HP → 0 (battle) | Heavy minor-chord collapse |
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
- [ ] `supply.js` — per-level finite tile pool (Phase 1 placeholder: a flat list; real sizing/mix
      from §4 "Supply defaults" lands with the cauldron in Phase 3); deal **sets of 3** from it; must
      place all 3, then deal the next set; **deal-fairness** ordering (prefer a set with ≥1 placeable
      shape when the pool allows); `setDealt`/`supplyChanged`
- [ ] Line-clear detection + scoring + combo/streak; dissolve juice
- [ ] **Failure 1 — jammed:** after each placement / new set, if no held shape has any legal spot →
      `levelFailed {reason:'jammed'}` → result screen; HUD warns when a held shape is nearly stuck
- [ ] Sounds: click, pickup, place, invalid, line clear, combo, jammed

### Phase 2 — Deposits (clearing reveals elements)
- [ ] Deposit data: multi-cell regions + cover layers, seeded per level
- [ ] Buried-cell rendering + hover tooltip
- [ ] Line-clear strips cover layers over deposit cells (per-cell, on a clearing line); harvest on
      full reveal
- [ ] Stores model: **element** counts; harvest adds to stores (banked on level complete)
- [ ] Harvested/stores HUD panel; harvest flourish; cover-strip + harvest sounds

### Phase 3 — Cauldron (elements → tile types, *between levels*)
- [ ] Element & tile-type definitions; **tile-type unlock recipes** (element cost per type), tiers
- [ ] **Cauldron crafting screen (`C`)**, opened between levels: spend elements to **unlock tile
      types**; tier-gated/greyed entries; `tileTypeUnlocked`; read-only recipe view mid-level
- [ ] **Supply now seeds from unlocked tile types** (level def can add authored types) using the §4
      **Supply defaults**: objective-driven size (`SUPPLY_SLACK`, rounded to whole sets), geometric
      `TIER_WEIGHTS` mix, `SMALL_TILE_FLOOR` + `MIN_MONOMINOES`, all seed-deterministic; shapes tinted
      by tile type
- [ ] Unlock sound; elements spent on unlock

### Phase 4 — Levels, objectives & progression
- [ ] Level definitions with a **`levelType`** field (exploration default) + objective type, grid
      size, seeded deposits, obstacles
- [ ] Objective tracking (collect / score / spell-component quests) + node-complete (rewards) /
      cauldron-tier upgrade on **boss** clear
- [ ] Story-beat interstitials between chapters
- [ ] **Failure 2 — infeasible:** conservative feasibility check per objective type (best-case
      remaining score < target; required deposit cells unreachable; not enough qualifying lines
      formable) → `levelFailed {reason:'infeasible'}`; only fail when clearly impossible
- [ ] Cauldron-upgrade & level-complete sounds; **save/load (localStorage)** — persist run state
      (seed, map, current node + path, carried currency/items/XP/stores/tier) on each node
      resolution, resume at last node boundary (§9 "Save scope & timing"); mid-puzzle state is not
      saved (level restarts from seed on resume)
- [ ] **Currency & XP:** award `grams` and `XP` on node completion; track in state
      (`currencyChanged`, `xpChanged`)

### Phase 5 — Level types: refinement & battle (§11)
*(The shared puzzle core stays in `grid`/`drag`/`pieces`; each type is an overlay module keyed off
`levelType`.)*
- [ ] `refine.js` — refinement levels: recipe conditions (incl. forbidden-ingredient constraints),
      crucible cells, **quality grading**, optional **enhancement-ingredient** spend; events
      `recipeConditionMet` / `qualityChanged` / `potionBrewed` / `enhancementUsed`
- [ ] Refinement HUD overlay: recipe panel (conditions ✓/◻), quality meter, enhancement tray
- [ ] `battle.js` — battle grids: enemies on cells with HP, **damage-on-clear** (× combo), enemy
      **turn** logic (advance/harden/spawn/attack), **player HP**; events `enemyDamaged` /
      `enemyDefeated` / `enemyTurn` / `playerDamaged`
- [ ] **Failure 3 — defeated:** player HP → 0 on a battle grid → `levelFailed {reason:'defeated'}`
- [ ] Battle HUD overlay: player HP bar, on-grid enemy HP, threats panel + turn timer
- [ ] Refinement reward scales with quality grade; bosses authored as battle grids
- [ ] Sounds: condition-met, quality-up, potion-brewed; enemy-hit, enemy-defeated, player-hurt, defeat

### Phase 6 — Run map (Slay-the-Spire branching)
- [ ] `map.js` — seeded procedural map generation: layered DAG, 2–3 forward edges per node,
      diverge/re-converge, boss terminal at far right; fairness guarantees (≥1 shop before boss,
      no back-to-back elites)
- [ ] Node types: puzzle (exploration/refine/battle, §11) / shop / cache-event / elite / boss, each routing to its screen
- [ ] **Run map screen**: horizontal node graph, current/forward/visited node states, currency +
      item top bar, click-to-commit (no backtrack), node hover preview
- [ ] Run state: carry currency/items/stores across nodes; node-clear advances the branch
- [ ] Cache/event nodes (reward or trade-off choice); boss-clear → chapter complete → next map
- [ ] Decide & implement run-failure behavior (retry-node default vs. roguelike chapter-restart, §9)

### Phase 7 — Consumables, shop & character screen
- [ ] `items.js` — **consumables** model (count, deplete); use logic applying effects to grid/deposits/tray
- [ ] In-level **item bar** (HUD): consumable counts (select → target)
- [ ] First consumables (Dissolvent, Catalyst, Transmute Vial, Reveal Salts)
- [ ] `shop.js` + **shop screen** as a **shop node**: **consumables only**, buy with currency,
      owned-count/greyed states; leaving returns to the run map
- [ ] **Character screen (`B`)** with **Inventory** + **Stats** tabs; persist owned items & currency
- [ ] Sounds: purchase, item use

### Phase 8 — XP, skill tree & passives
- [ ] XP model: award on clears/combos/harvests/elites/bosses; `xpChanged`; (optional) character level
- [ ] `skilltree.js` — passive-power-up node graph (prereqs, XP cost), unlock state, spend logic
- [ ] **Skill Tree tab** on the character screen: mind-map render, node states (unlocked/available/locked),
      select → UNLOCK (spends XP)
- [ ] Passive effects in-level: always-on passives apply; **activated** passives (Tile Swap) added to
      the item bar with placement-based cooldown
- [ ] First passives across branches (Tile Swap, Deep Sight, Surveyor, Steady Hand…); persist unlocks in save
- [ ] Sounds: skill unlock, passive trigger / ready-again

### Phase 9 — Polish & content
- [ ] Full element / tile-type-unlock-recipe roster across all tiers; balance pass on economy + item
      prices + XP curve
- [ ] **Tile-supply tuning (§4):** validate `SUPPLY_SLACK` (1.6×/1.25×/2.0×), `TIER_WEIGHTS`
      (60/25/12/3), `SMALL_TILE_FLOOR` (0.4), `MIN_MONOMINOES` and the per-objective workload
      estimate against playtests across grid sizes
- [ ] More level objectives + obstacle variety; difficulty curve tuning; map-generation tuning; tree tuning;
      refinement-recipe & enemy roster
- [ ] Reduced-motion support, keyboard-drag fallback, responsive scaling pass
- [ ] Add to root launcher `js/gamedata.js`

### Phase 10+ — Power-ups *(future enhancement)*
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
| `comboChanged` | {combo} (lines cleared this placement) | state | ui |
| `streakChanged` | {streak} (consecutive clearing placements) | state | ui |
| `coverStripped` | {depositId, cell, layersLeft} | deposits | sounds, ui |
| `depositHarvested` | {elementId, qty} | deposits | stores, sounds, ui |
| `storesChanged` | {elementId, qty} | state | ui (stores), cauldron |
| `setDealt` | {shapes:[{slot,shapeId}]} | supply (level) | drag, ui, sounds |
| `supplyChanged` | {tileTypeId, remaining} | supply (level) | ui (supply panel) |
| `tileTypeUnlocked` | {tileTypeId, elementCost} | cauldron | state, ui, sounds |
| `objectiveProgress` | {kind, cur, target} | level | ui |
| `objectiveMet` | {levelId} | level | main, ui |
| `cauldronUpgraded` | {newTier} | state | ui, cauldron, sounds |
| `currencyChanged` | newAmount | state | ui, shop |
| `itemPurchased` | {itemId, cost} | shop | state, sounds |
| `itemUsed` | {itemId} | items | grid/deposits/tray, state, sounds |
| `xpChanged` | {xp, level} | state | ui (HUD/stats) |
| `skillUnlocked` | {skillId, xpSpent} | skilltree | state, ui, sounds |
| `passiveTriggered` | {skillId} | items | grid, ui (start cooldown), sounds |
| `passiveCooldownChanged` | {skillId, remaining} | state | ui (item bar) |
| `shapeNearlyStuck` | {shapeId, legalSpots} | grid | ui (jam warning) |
| `noMovesLeft` | {heldShapes} | grid | level (→ `levelFailed 'jammed'`) |
| `objectiveInfeasible` | {kind, reason} | level | level (→ `levelFailed 'infeasible'`) |
| `levelFailed` | {reason: 'jammed' \| 'infeasible' \| 'defeated'} | level | main, ui, sounds |
| `recipeConditionMet` | {conditionId} | refine | ui (recipe panel), sounds |
| `qualityChanged` | {grade, value} | refine | ui (quality meter) |
| `potionBrewed` | {potionId, grade} | refine | level (→ node cleared), state, sounds |
| `enhancementUsed` | {ingredientId} | refine | stores, ui |
| `enemyDamaged` | {enemyId, dmg, hpLeft} | battle | ui (nameplate), sounds |
| `enemyDefeated` | {enemyId} | battle | level, ui, sounds |
| `enemyTurn` | {actions} | battle | grid, ui |
| `playerDamaged` | {dmg, hpLeft} | battle | ui (HP bar), sounds (→ `levelFailed 'defeated'` at 0) |
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
| `config.js` | Grid size, tray size, colors, element/tile-type tables, **tile-type unlock-recipe** tables, item/shop/skill-tree tables, **level-type/recipe/enemy** tables, per-level **tile-supply** + map-gen defs |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton (score, combo/streak, **element stores**, **unlocked tile types**, currency, **XP/level**, owned consumables, **unlocked skills**, passive cooldowns, cauldron tier, **player HP in battle**, run/save state, progress) |
| `sounds.js` | Web Audio procedural SFX |
| `ui.js` | HUD panels — shared skeleton + type overlays (exploration objective / refine recipe+quality / battle HP+threats), tray, item bar |
| `grid.js` | Lattice data + render, line-clear detection, stuck detection |
| `pieces.js` | Polyomino shape definitions + tile-type definitions |
| `supply.js` | Per-level **finite tile supply**: seed the pool from unlocked types, deal sets of 3 (deal-fairness ordering), track remaining, emit `setDealt`/`supplyChanged` |
| `drag.js` | Drag-and-drop, snap, ghost preview, placement validation |
| `deposits.js` | Buried deposits, cover layers, reveal/harvest logic *(exploration §11a)* |
| `refine.js` | Refinement levels (§11b): recipe conditions, quality grading, enhancement spend |
| `battle.js` | Battle grids (§11c): enemies on cells, damage-on-clear, enemy turns, player HP |
| `cauldron.js` | **Between-levels** crafting screen: combine elements → **unlock tile types** (unlock recipes, tier gating, spend logic); read-only recipe view mid-level. Does *not* feed the in-level tray |
| `items.js` | Consumable use + activated-passive cooldown logic; applies effects to grid/deposits/etc. |
| `shop.js` | Shop node screen (consumables only), buy/sell, currency spend |
| `character.js` | Character screen: Inventory / Stats / Skill-Tree tabs |
| `skilltree.js` | Passive-power-up node graph, prereqs, XP unlock/spend logic |
| `map.js` | Seeded run-map generation (branching DAG), node types, run-map screen, route state |
| `level.js` | Level defs incl. **`levelType`** (exploration/refine/battle); routes to the type overlay (`deposits`/`refine`/`battle`); objectives, win/fail, rewards, node/boss progression |

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
- [x] **Do covered deposit cells block placement?** — *Resolved: no, placeable-over* (§5). They are
      normal lattice cells; a cover layer strips only when the cell is part of a line that clears.
- [x] **In-level economy / brewing?** — *Resolved: there is none.* The cauldron is a **between-levels**
      element→tile-type crafting station (§4); inside a level the tray draws from a **preset finite
      tile supply** seeded from unlocked types. No per-set brewing, so no mid-puzzle soft-lock.
- [~] **Level tile-supply composition (§4):** *defaults proposed* — objective-driven size
      (`SUPPLY_SLACK` 1.6× normal / 1.25× elite-boss / 2.0× early, rounded to whole sets), geometric
      rarity mix (60/25/12/3), a 40% small-tile floor + ≥1 monomino, all seed-deterministic. Remaining
      to validate in Phase 9: the per-objective **workload estimate** (placements-per-line ≈ 3–4 is a
      guess), and whether the slack multipliers feel right across grid sizes.
- [ ] **Tile-type unlock recipes (§4):** element cost per tile type, and the **unlock order / tree**
      (which types each cauldron tier exposes). Are unlocks permanent (current plan: yes, one-time)?
- [ ] **Grid size vs. tile size scaling:** higher tiers unlock bigger tile types; on a 9×9 with
      seeded obstacles, large tiles can make jams near-certain. Does the grid grow with tier, do
      obstacle budgets shrink, or are big tiles rate-limited in a level's supply? (A balance risk.)
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
- [ ] **Refinement recipes (§11b):** what's the v1 set of condition types (ingredient-specific lines,
      combos, ordered crucible fills, forbidden ingredients)? How are **quality grades** scored
      (combos? wasted-placement penalty? bonus targets?) and what does each grade reward?
- [ ] **Enhancement ingredients (§11b):** spent **before** the brew, **during**, or both? Are they a
      separate item class or just regular stores ingredients tagged as enhancers?
- [ ] **Battle grids (§11c):** do enemies take a **turn every placement** or every N? Player-HP
      source — a per-level pool, or a persistent run-wide HP that carries between battle nodes (more
      Spire-like)? Enemy behaviors in v1 (advance / harden / spawn / attack — which ship first)?
- [ ] **Damage formula (§11c):** flat per-clear, or scaled by combo / line length / shape size?
- [ ] **Are all three level types in v1**, or is exploration the v1 scope with refinement/battle as
      fast-follow phases? (current plan: all three, exploration first — Phase 5 adds the others)

---

## Changelog

### Evaluation pass (2026-06-14)
- **Corrected the core cauldron model (the plan had conflated two systems).** The original §2/§4
  described the cauldron as **minting the in-level tray** ("brewed from your stores", per-set), which
  was self-contradictory (§2 said whole-set re-deal; §4 said per-slot) and wrong. Recast per the
  intended design: the **cauldron is a *between-levels* workbench** where you **combine primordial
  elements to unlock new tile types** (crafting recipes, paid once), and **inside a level the tray
  draws from a *preset finite tile supply*** seeded from your unlocked types — **no brewing/minting
  mid-puzzle**. Rewrote Concept, the two-loops, §2, §4, the Game Loop, the exploration HUD (CAULDRON
  panel → **SUPPLY** + **HARVESTED** panels), the Cauldron/Stores screens, Progression, Phases 1–3,
  Module Overview (new **`supply.js`**, recast `cauldron.js`), and the controls (`C` = between-levels
  crafting, read-only mid-level).
- **Reworked events for the corrected model.** Dropped per-slot `shapeBrewed`; `setDealt` now emits
  from the **level supply** (no cost); added **`supplyChanged {tileTypeId, remaining}`** and
  **`tileTypeUnlocked {tileTypeId, elementCost}`** (cauldron). Renamed the in-level "Brew" sound to a
  **set-dealt** shuffle + a between-levels **tile-type-unlocked** glug; field names `ingredientId`→
  `elementId`.
- **Replaced the bootstrap/brew open questions** (now moot — no in-level economy) with: **level
  tile-supply composition**, **tile-type unlock recipes/order**, and **grid vs. tile-size scaling**;
  marked "in-level economy/brewing?" resolved (none).
- **Proposed concrete tile-supply defaults (§4 "Supply defaults").** Objective-driven size with
  `SUPPLY_SLACK` (1.6× normal / 1.25× elite-boss / 2.0× early, rounded to whole sets of 3, worked
  example for "clear 6 lines on 9×9" → 36 tiles); geometric rarity mix `TIER_WEIGHTS` 60/25/12/3;
  `SMALL_TILE_FLOOR = 0.4` + `MIN_MONOMINOES = 1` so the board stays unstickable; fully
  seed-deterministic. Wired the knobs into `config.js`, Phase 3 (real seeding) and Phase 9 (tuning);
  downgraded the supply open question to *defaults proposed, validate in playtest*.
- **Added a deal-fairness rule to Failure §1.** Since the next set is unseen until dealt, the deal
  should **prefer a set with ≥1 placeable shape** when the remaining supply allows, so a deal-time
  jam only fires on a genuinely full board. Jam HUD warning applies to the *held* set.
- **Disambiguated deposit cover-stripping (§5)** — a layer strips only when a buried cell is *part of
  a clearing line*, per-cell not per-deposit; resolved the "do buried cells block placement?" open
  question (no, placeable-over) and spelled out the block-dissolves / cell-stays-buried behavior.
- **Defined enemy advance vs. existing blocks and enemy-caused jams (§11c)** — enemies spread only
  into empty cells (can't overwrite placed blocks) and a jam right after an enemy turn is a fair
  loss the turn-timer telegraphs.
- **Specified save scope & timing (§9 + Phase 4)** — persist *run state* (seed, map, current node +
  path, carried resources) on each node resolution; mid-puzzle restarts from seed. Added a
  **Continue / New Run** entry flow to the splash screen (previously no resume path existed).
- **Separated combo vs. streak (§3)** — combo = lines per single placement (the multiplier §11b/§11c
  cite), streak = consecutive clearing placements (resets on a no-clear). Split `comboChanged` and
  added `streakChanged`.

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
- **Generalized "levels" into three level types** sharing one engine (new §11), each a run-map node
  type: **§11a exploration** (the existing deposit-harvest loop), **§11b refinement** (use the
  lattice to *brew a target potion* by meeting **recipe conditions**, with a **quality grade** and
  optional **enhancement ingredients** that ease/raise the brew), and **§11c battle grids**
  (enemies occupy cells, clear lines over them to **deal damage × combo**; enemies take turns and
  chip a **player HP** bar — bosses are typically battle grids). Added a **third failure condition**
  (HP→0, `'defeated'`), refinement & battle **HUD overlay** mockups, `refine.js` + `battle.js`
  modules and a `levelType` field on `level.js`, new events (`recipeConditionMet`, `qualityChanged`,
  `potionBrewed`, `enhancementUsed`, `enemyDamaged`, `enemyDefeated`, `enemyTurn`, `playerDamaged`),
  refinement/battle **sounds**, and a new **Phase 5 — Level types** (renumbering Run map→6, Shop→7,
  XP→8, Polish→9, Power-ups→10). Flagged recipe/quality scoring, enhancement timing, enemy
  turn cadence, player-HP model, damage formula, and v1 scope as open questions.
