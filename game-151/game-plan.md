# One Shot

**Genre:** Space shooter × match-3, with a hangar upgrade loop
**Engine:** three.js r165 (the 3D battle) + Canvas 2D (the resonance board) + DOM (HUD and screens)
**Media:** 3D models by Meshy, art, music, effects and voices by ElevenLabs (see [dev/meshy](dev/meshy/README.md), [dev/art](dev/art/README.md), [dev/audio](dev/audio/README.md))
**Status:** v1.0.2

---

## Concept

The fleet is gone. The **Solitaire**, a lone fighter-cruiser flown by **Juno Arakawa** with her ship's AI **MIRA**,
carries the **Lance**: an experimental beam that can destroy a mothership in one shot, if it is tuned right. It is
charged by *resonance*: the pilot matches energy tiles on the resonance board. Six motherships of the Choir stand
between Juno and home.

Each mothership is a level. Its **escort waves** are fought as **match-3 rounds**: every match charges the Lance and
fires missiles at the escorts, while they swoop in and shoot back. When a wave is down, the seconds you saved are
routed into one system of your choice. After the last wave the mothership is **exposed**: a short final charge,
then **FIRE**. The Lance fires **once**: speed against its evasion, the elements against its barrier (minus its
resistances), power against its armor. It must reach all three to destroy the ship, and the further it overshoots,
the better the grade (C, B, A, S) and the more scrap you earn for upgrades.

The look is a 1990s space anime: cel-shaded Meshy models with ink outlines, a painted nebula, a film pass with grain,
scanlines and a slight chromatic fringe, a pilot cut-in as the Lance fires, chunky slanted titles. It riffs on
match-3 battlers (Puzzle Quest, Puzzle & Dragons) and on every anime where the last ship charges the one big gun.

## Core loop

1. **Hangar**: pick a sortie (the next mothership, or any beaten one to replay for a better grade) and spend scrap on
   upgrades.
2. **Briefing**: MIRA reads the mothership's defenses: evasion, barrier and its resistances, armor, escort waves, and
   whether it shifts its barrier or jams the board.
3. **Rounds** (2–4 per mothership): match tiles; missiles fly at the escorts; the escorts aim (a red telegraph) and
   shoot; the deflector blocks shots, the hull takes the rest and leaks charge. The round ends when the wave is
   down, or when the clock runs out (then the survivors make one last pass).
4. **Route**: MIRA patches 20 hull and routes `40 + 10 × seconds left` into the stat you pick (she suggests the weakest).
5. **Final window** (12 s): no escorts, one last charge, FIRE when ready (or it fires itself at zero).
6. **The shot**: the cut-in, the beam, three readouts, the verdict, the grade, the scrap.

## Mechanics

### The resonance board (`js/sim/board.js`)
- 7 × 7 tiles of six kinds: **Power**, **Speed**, **Thermal**, **Cryo**, **Volt**, **Shield**; plus **Static** (jammer junk).
- Swap two neighbours; a swap that makes no run of 3+ swaps back. A swap made while the board settles is queued
  and played the moment it settles (never lost).
- Runs clear; the board falls and refills from above; new runs cascade. Long runs leave specials at the swapped
  cell: **4 → line** (clears its row or column), **5 → nova** (clears every tile of its kind), **L or T → cross**
  (row and column). Specials caught in a clear go off and can chain.
- Static never matches and cannot be swapped; it shatters when a tile next to it clears.
- A board with no move is reshuffled (kinds only, ids kept). Fresh boards have no runs and always a move.

### Charge (`js/sim/game.js` `onClear`)
- Each tile: `10 × (1 + 0.25 × cascade depth) × rush × (1 + 0.15 × its upgrade level)` to its stat; shield tiles give
  5 (× deflector) to the deflector, capped at 60 (+15 per Deflector level).
- **Rush**: a match made within 1.7 s of the board settling adds a link: `rush = 1 + 0.08 × (links − 1)`, up to 2×.
- Every clear fires `floor(tiles / 3)` missiles (at least one) plus one per special set off, at the most dangerous
  escort the missiles in flight won't already finish (aiming first, then nearest). Each missile does 1 damage
  (+50% per Point Defense level) after 0.45 s.

### Escorts
- Each wave has `count` escorts, at most `max` flying at once, launching 1.2 s apart.
- An escort flies in (2.8 s), holds, **aims** (1.1 s telegraph), fires `dmg`, and refires every 3.2 s.
- A shot hits the deflector first; what gets through hits the hull and **leaks** `1.5 × damage` from the Lance's
  biggest stat. Hull 0 → the **desperate shot**: the Lance fires at once at 75%.

### The shot
- `speed / req.speed`, `Σ element × (1 − resist) / req.barrier`, `power / req.armor`. All three ≥ 1 destroys it.
- Grade by the weakest: **S ≥ 2.0**, **A ≥ 1.6**, **B ≥ 1.3**, **C ≥ 1.0**, else **F**.
- Scrap: `reward × grade multiplier (C 1, B 1.35, A 1.7, S 2.2) + 4 per escort down`, +10% per medal; half on a
  replay that doesn't improve the grade. A failed shot pays `60% × reward × weakest ratio + 2 per escort`.
- Medals: **Flawless** (no hull damage), **Quick Draw** (fired with 6+ s left in the final window), **Ace** (every
  wave shot down, no desperate shot).

### Barriers
- Resistances per element: 0.8 soaks 80%, −0.5 takes 150%.
- **Shifting** barriers (Prism Cathedral, the Throne) rotate their three resistances between the elements every
  11–12 s, through the rounds and the final window. The HUD shows the countdown and which element comes up weak:
  firing at the right moment is the skill.
- **Jammers** (Storm Lattice, the Throne) turn a tile to static every 7–8 s of a round, up to 5.

## Content

| # | Mothership | Evasion | Barrier | Armor | Resists (Thermal / Cryo / Volt) | Waves | Special |
|---|---|---:|---:|---:|---|---|---|
| 1 | Picket Ark | 240 | 600 | 320 | 0 / 0 / 0 | 3, 4 | the tutorial |
| 2 | Ember Citadel | 650 | 1400 | 800 | 0.8 / −0.5 / 0.2 | 4, 5, 5 | weak to Cryo |
| 3 | Glacier Maw | 800 | 2000 | 1050 | −0.5 / 0.85 / 0 | 4, 5, 6 | weak to Thermal, heavy armor |
| 4 | Storm Lattice | 1250 | 2100 | 1050 | 0.2 / −0.3 / 0.85 | 5, 6, 6 | very evasive; jams the board |
| 5 | Prism Cathedral | 1250 | 2700 | 1400 | rotates 0.9 / 0.2 / −0.5 | 5, 6, 7 | shifting barrier |
| 6 | Throne of the Choir | 1800 | 4000 | 2100 | rotates 0.75 / 0.3 / −0.3 | 6, 7, 7, 8 | shifting and jamming |

Numbers live in [js/sim/data.js](js/sim/data.js); every mothership's `art` line is the prompt its reference picture
and Meshy model were made from.

**Upgrades** (5 levels, 40 / 75 / 120 / 180 / 260 scrap): Lance Capacitor (+25% Power), Velocity Coils (+25% Speed),
Thermal, Cryo and Volt Lenses (+25% each), Deflector (+25% shield, +15 capacity), Reactor Core (+3 s every round and
the final window), Point Defense (+50% missile damage).

## Story

Two voices, both ElevenLabs: **Juno** (bold, fired up) and **MIRA** (calm, precise). MIRA opens the campaign
("Fleet signal lost. We are the last ship, Juno."), briefs every mothership, calls the barrier shifts, low hull and
the exposure; Juno launches, calls for the rush, shouts the shot and calls the kill. After the Throne falls, the
ending screen ("The Choir is silent... We're going home, Mira."), then every mothership can be flown again for an S.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Swap tiles | Arrows move the cursor, Space picks up, an arrow swaps | D-pad / stick, A, d-pad | Drag a tile onto its neighbour, or tap two |
| Fire (final window) | F / Enter | X or Y | FIRE button |
| Skip the shot | Space / Enter | A | Skip, or tap the screen |
| Pause | P / Esc | Start | ❚❚ |
| Menus | Arrows, Enter, Esc | D-pad, A, B | Tap |

## Look and sound

- **3D**: the Solitaire low in frame, escorts flying in from the mothership ahead, the mothership turned three-quarters
  inside its fresnel/hex barrier (tinted by the element it resists most). Meshy models in a three-step toon shade
  with inverted-hull ink outlines. Speed lines, star points, the painted nebula as the background.
- **Post**: RenderPass → sanitize (non-finite → black, capped at 6) → bloom (threshold 1.05) → film (grain, scanlines,
  vignette, chromatic fringe, white flash) → output.
- **The shot**: the board steps aside, the camera swings to three-quarters, the anime cut-in (Juno shouting, "ONE
  SHOT!!"), the charge, a braided beam in the colours of the charge, the mothership dodging a slow beam, the barrier
  shattering, explosions along the hull, and either a chain of blasts and a white-out or a fizzle.
- **Board**: Canvas 2D tiles drawn once per kind: a distinct shape and a glyph per kind (circle burst for Power,
  diamond chevrons for Speed, square flame, hexagon snowflake, octagon bolt, shield), ink outline, hard cel highlight.
- **Sound**: three ElevenLabs music themes (title, battle, the final charge), two stingers, eighteen effects (two cannon volleys,
  impacts and kills with a synth sub-bass under them), 21 voice lines normalised to -15 LUFS and ducking the music; a Web Audio synth stands in for anything that fails to load.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the title/play modes, screens that follow the sim, the fixed-step loop, input routing, comms, cloud saves, debug hooks |
| `js/sim/game.js` | The rules: missions, rounds, escorts, missiles, charge, routing, the shot, grades, rewards, the hangar; `act`, `step`, `evaluate`, `serialize` |
| `js/sim/board.js` | The match-3 board: generation, runs, specials, blasts, gravity, shuffles |
| `js/sim/data.js` | The six motherships and every line of dialogue |
| `js/sim/bot.js` | The auto-player: needs-weighted swaps, routing, the fire decision, timing a shifting barrier, the hangar |
| `js/view/stage.js` | Renderer, camera framed into the screen region the board leaves, the post chain |
| `js/view/view.js` | The ship, drones, missiles, enemy fire, barrier, the Lance and the explosions |
| `js/view/models.js` | Meshy GLBs in toon shading with outlines, procedural stand-ins |
| `js/view/board.js` | The board in Canvas 2D: tweened tiles, bursts, flashes, drag/tap/key input |
| `js/ui.js` | Screens (hangar, briefing, route, result), HUD, gauges, comms, the cut-in, readouts, layout |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound, key/pad queue, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (95 checks) covers purity, the board, every rule, determinism and a
mid-round save round trip, and whole campaigns by the bot at two skills with asserted bands. `browsertest.mjs` plays
the real game on desktop by mouse drags and keys from the title to a graded shot and back through Save & Quit,
touch-only phones in both orientations by finger swipes, and blocked storage.

## Balance notes

The bot plays whole campaigns (hangar, briefing, rounds, routing, the shot) on four seeds:

| Bot | Sorties to win | Grades |
|---|---|---|
| skill 1 (0.45 s a move, always the most-needed swap, waits for the best barrier tuning) | 6 | S/A on the first three, B/C on the last three |
| skill 0.6 (a move a second, a random swap a third of the time) | 6 | B/C |
| skill 0.25, casual (a move every 1.5 s, the best one only a fifth of the time) | 7–10 | B/C; a retry or two on a few motherships, never more than three |

Asserted bands: the perfect bot wins in ≤ 9 sorties, the 0.6 bot in ≤ 14, the casual bot in ≤ 20 with at most two tries at the Ember Citadel and at most five at any mothership. Changes the bot forced: escort HP
was raised (2 → 5–12) because escorts died before firing; requirements were rescaled after the rounds structure
tripled the charge; the Prism Cathedral's barrier and armor came down (4300 → 3500, 2000 → 1800) after the 0.6 bot
failed it fifty times in a row with every upgrade maxed.

**v1.0.2, tuned for human pace.** A player reported failing the Ember Citadel every time, even after an upgrade. The
two bots above were both much faster and sharper than a person; a casual-pace bot beat it in 1 of 6 tries with one
upgrade (power against armor always short). Requirements jumped 3.3× from mothership 1 to 2 while the charge only
doubled, and +15% upgrades barely registered. From mothership 3 on, the casual bot was also shot down before the last
round, which no amount of charge fixes. Changes: the Ember Citadel eased to 650 / 1400 / 800 and the rest 10–20%,
upgrades +25% a level, a failed shot pays 60%, softer and fewer late escorts, 20 hull patched between rounds.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- An endless "Choir Gauntlet" mode after the ending, with a leaderboard of ratios.
- A combo voice bark per element (Juno calling "Cryo!" on a big cold match).

## Changelog

### v1.0.2 (2026-11-27)
- Rebalanced for human pace: the Ember Citadel no longer fails every time. Easier requirements from mothership 2 on,
  upgrades +25% a level, a failed shot pays more, softer late escorts, and MIRA patches 20 hull between rounds.

### v1.0.1 (2026-11-27)
- The round shots sound like space cannons: one heavy plasma volley per missile burst (two takes), deep impacts and
  kills, a sub-bass thump under each, instead of a rocket hiss per missile and a pitched-up hull hit that sounded
  like a slap.
- Voices are heard: every line normalised to -15 LUFS (MIRA's came back at -33), the music lower, and music and
  effects ducked under any line; a line that hasn't decoded yet waits instead of being skipped.

### v1.0.0 (2026-11-27)
- First release: six motherships, match-3 rounds against escort waves, routing, the final window and the One Shot
  graded C–S, medals, scrap and eight upgrades; Meshy models, ElevenLabs art, music, effects and voices; cloud saves;
  sim and browser test harnesses.
