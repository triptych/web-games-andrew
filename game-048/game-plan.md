# SPINFRAME — game plan

A turn-based sci-fi RPG whose combat is a slot machine. You are a cadet at the Halcyon
Flight Academy, piloting a training mech ("frame") whose weapons are driven by a
**Probability Engine**: every turn you spin its reels and every symbol that lands fires.
Paylines chain into combos, cores trigger Overdrive, and five cores hit the Jackpot.
The enemy is the **Determinant**, a machine intelligence that hates chance: its units jam
your reels, corrupt your strips with Glitches and drain the energy you use to cheat fate.

Vanilla HTML/CSS/JS. No libraries, no asset files: every symbol, mech, portrait, backdrop
and sound is generated in code.

## Pillars

1. **Every symbol fires.** A spin with no lines still does something. Lines multiply.
2. **Your mech *is* the slot machine.** Upgrading the frame changes the machine:
   more reels (3 → 5), more rows (3 → 4), more paylines (3 → 16), new weapon symbols on
   the strips, bigger reactors (energy for nudges, respins, holds), more wilds and cores.
3. **Juice is the reward.** Anticipation slow-downs, line traces, chain counters,
   lightning that jumps between enemies, cascades, hit-stop, shake, big-win overlays.
   One director maps sim events to effects, with a per-frame budget.
4. **The numbers go up.** Exponential weapon levels, facilities that produce scrap while
   you are away, an endless Sim Ladder and Threat levels after the campaign.

## Architecture (the game-040/045/047 split)

- `js/sim/` — pure, seeded, no DOM, no `Math.random`. Combat resolves instantly and returns
  an event list. Profile, sector maps, quests, facilities and story are plain data.
- `js/battle.js` — the director: plays combat events one at a time with timings, then
  syncs the view to the true state. Input only while the queue is empty.
- `js/view/` — one Canvas2D stage: backdrop, arena (mechs, HP, intents), reels, FX.
- `js/ui/` — DOM screens: title, story, carrier hub (deploy, mech, pilot, quests,
  facilities, ladder), sector map, rewards, depot, repair bay, events.
- `js/audio.js` — synthesised SFX and a generative synthwave score.
- `dev/simtest.mjs` — purity, invariants, a bot that plays the whole campaign, balance table.
- `dev/browsertest.mjs` — Playwright walk on desktop and phones.

## Combat

Grid of `cols × rows`. Each reel has a **strip** built from the frame's loadout
(weapon hardpoints installed, Probability Core level, skills, modules). Spinning picks an
offset per reel; the window shows `rows` symbols.

Turn: **SPIN** → reels land, projected lines preview → optionally spend energy:
**Nudge** (1⚡, shift a reel one step), **Respin** a reel (2⚡), **Hold** a reel for the next
spin (1⚡), **Purge** a jammed reel (2⚡) → **ENGAGE** → resolve → enemies act.

Symbols: Blade (target), Cannon (target, pierces armor), Missile (all enemies), Arc (target
then chains), Shield, Repair, Energy, Scrap, Overclock (wild), Core (scatter), Glitch (dead,
inserted by enemies).

Resolution: winning lines (3+ from the left, wilds substitute) fire in sequence with a rising
chain multiplier; symbols in no line fire loose at base power; 3+ cores start Overdrive
(bonus spins at ×2 with no enemy turn), 5 cores is a Jackpot.

## Progression

- **Pilot**: XP, levels, skill points; three trees (Gunner, Guardian, Gambler).
- **Frame systems**: Reel Array, Targeting Matrix, Reactor, Servos, Probability Core,
  Chassis (module slots), Armor, and per-weapon power levels.
- **Modules** (enhancements): loot with rarity; mechanic-changers (Cascade Feed, Expanding
  Overclock, Mirror Logic, Arc Conductor, Cluster Protocol…) plus a rolled stat bonus;
  upgrade with scrap.
- **Boosters** (power-ups): consumables, also dropped mid-battle by destroyed enemies.
- **Quests**: a board of procedurally generated contracts tracked from battle stats.
- **Facilities** (incremental): Refinery (scrap/s, accrues offline), Drone Bay, Archive,
  Core Forge.
- **Sim Ladder**: endless floors; **Threat** levels after graduation.

## Campaign — "The Graduating Class"

Seven chapters, each a procedural sector map (battles, elites, salvage, events, depots,
repair bays, boss). Story told in comm-scenes between the cadet, the mech AI KISMET,
Commander Varga, rival cadet Juno "Halo" Okafor, Chief Engineer Dace, and the Determinant.

0. Simulation — training against holo drones.
1. Live Fire — the academy's exercise is interrupted. Boss: Lancer Prime "Verdict".
2. The Rust Belt — scavenging the drifting shipyards. Boss: Grinder Matriarch.
3. Glasswater — evacuating an ocean moon. Varga is taken. Boss: Tidelock Leviathan.
4. The Silent Front — Varga returns, rewritten. Boss: VARGA//NULL.
5. Probability Storm — into the nebula. Boss: The Arbiter.
6. Zero Variance — the Determinant's heart. Final boss: THE DETERMINANT (3 phases).
