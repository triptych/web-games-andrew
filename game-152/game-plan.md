# HAYATE RIVER STRIKE

**Genre:** 3D top-down arcade river shooter with a jump, fuel and a roguelite skill tree
**Engine:** three.js r165 (CDN import map), plain HTML / CSS / ES modules, no build step
**Media:** 14 Meshy models, ElevenLabs art, music, effects and voices (see [dev/meshy](dev/meshy/README.md), [dev/art](dev/art/README.md), [dev/audio](dev/audio/README.md))
**Status:** v1.0.0

---

## Concept

Commodore Kurogane's Iron Lotus fleet has dammed the rivers of the valley. **Rin Kazamatsuri**, a speedboat ace, takes
the armed assault boat **Hayate** downriver to break it, with her mechanic **Tomo Ishida** on the radio. Three
sectors, each a long procedurally generated stretch of river with a mid-boss halfway and a multi-phase boss at the
end: **Sakura Gorge** (cherry blossoms), **Jade Torrent** (jungle) and **Kurogane Dam** (a dusk canyon).

It riffs on *River Raid* (a narrowing, winding river; fuel you refill by sailing over depots, which you can also
shoot by mistake; bridges to blow up) and on 90s shoot-'em-ups like *Raiden* and *Metal Slug* (telegraphed enemy
fire, mid-bosses, three-phase bosses with phase banners, bullet cancels, hit-stop and big explosions), all in a
1990s anime look: cel-shaded models with ink outlines, banded turquoise water, bold slanted type, speed lines and
voiced comms with portraits.

## Core loop

1. **Title**: New Run, Continue, the Skill Tree (spend cores), How to Play, Settings. A bot plays a demo behind it.
2. **A sector** (~2.5 minutes): the river unrolls ahead; shoot, dodge, jump, refuel. Halfway a mid-boss blocks the
   river in a wide arena; at the end the sector boss.
3. **The dock**: the sector's stats, cores banked, Tomo patches the boat (+40% hull, full fuel and missiles). Spend
   cores on the Skill Tree, then launch the next sector with the new skills.
4. **The end**: after the third boss (victory) or when the hull reaches 0. Everything earned is banked; Run Again.

## State (plain data, in `G`)

`G = { seed, rng, t, sector, phase: 'run'|'boss'|'clear'|'dock', over, won, ranks, stats, score, cores, coresBanked,
kills, combo, comboT, mult, bestCombo, jumps, log[], boat, river, spawnQ[], enemies[], shots[], bullets[], lanes[],
emitters[], pickups[], bridges[], boss, bossDone, nextId, events[] }`

- `boat = { x, y, vx, speed, z, vz, hull, fuel, iframes, shield, shieldT, charge, missiles, missileT, missileCd, gunT,
  weapon, weaponT, overdriveT, magnetT, onDepot, throttle, airT }`
- `river = { seed, sector, rngState, segs[], endY, cx, hw, width, wind, miniY, bossY, flags }`: segments
  `{ y0, len, type, cx0, cx1, hw0, hw1, amp, k, isl, bridge, boss }`. Everything refers to other things by id.
- `stats` is derived from `ranks` (`statsFor`) and rebuilt on load; the RNG states live in `G` (`rngState`,
  `river.rngState`).

## Input

`step(G, { x, y, fire, jump, missile }, dt)`: steer −1…1, throttle (−1 full, +1 brake), fire held (latched),
jump and missile edges. Between sectors `nextSector(G, ranks)`. The bot, the tests and the player all use these.

## Events

`sector, shoot, missile, jump, land, hit, kill, boom, spark, deflect, hurt, shieldhit, pickup, boostend, tele, btele,
efire, lane, raider, bridge, miniboss, boss, phase, partdown, bossdown, bosskill, cancel, hitstop, dock, victory,
over`. The view draws them, the audio plays them, `main.js` turns some into banners and voiced comms.

## Mechanics (each one has a check in `dev/simtest.mjs`)

### The boat
- Steering eases toward `x × lateralMax` (17 m/s); throttle raises the speed toward 24 m/s, brake lowers it to 10,
  cruise is 16. Banks push the boat back and scrape 6 hull (i-frames 0.7 s); never an instant kill.
- **Cannons**: 9 volleys a second, one shell per barrel (2 → 4 with skills), range 62 m. **Missiles**: 6 (more with
  skills), regenerating, homing on a boss part or the nearest enemy ahead, with splash.
- **Jump**: costs one charge (1 → 3 with skills), recharging every 7 s (faster with skills) and +12% per kill. Above
  0.9 m the boat clears mines, booms, sandbars, every water-level bullet and laser lanes. Landing can fire a
  shockwave (6/12 damage, 7/9 m, cancels bullets) and a 14-shell barrage.
- **Fuel**: 100, draining 1/s at cruise (more with throttle). Depots refuel 32/s while you are over them (brake on
  them); shots destroy them. Energy cells +30, fuel barges drop two. An empty tank drops to minimum speed and drains
  5 hull a second.

### Enemies (data in `js/sim/data.js`)
| Kind | HP | Behaviour |
|---|---:|---|
| Patrol boat | 4 | sways, aimed shot every 2.4 s (0.55 s telegraph) |
| Gunboat | 11 | 3-way fan every 2.8 s |
| Speed raider | 3 | waits, then charges and rams; often in pairs |
| Mine | 2 | 20 damage on contact; shooting it blasts everything near |
| Fuel barge | 14 | aimed pairs; drops two energy cells |
| River tank | 8 | on the bank or a bridge; paints a 1 s laser sight, then a fast shell |
| Cliff turret | 12 | 5-way fan |
| Boom | 16 | across the river, sometimes with a gap; ramming breaks it for 12 hull, jumping is free |
| Fuel depot | 6 | refuels; can be shot (River Raid) |

Every shot is aimed when its telegraph starts, and the view draws that aim line, so a dodge is always possible.
Enemies get 15% more hp and fire 8% faster per sector.

### Bosses
A boss rides 34 m ahead in a wide open-ended arena; the arena closes when it dies and the river carries on.
| Boss | Sector | Phases |
|---|---|---|
| KABUTO (mid) | 1 | two turrets and an open core: fans, aimed pairs, a sweep |
| TORII GATE (mid) | 2 | two towers, three gun ports, a core that fires laser lanes |
| ZERO (mid) | 3 | two cannon pods, missiles, rings |
| SOUEN | 1 | TWIN HULLS (core shielded, sweeps) → CORE EXPOSED (aimed volleys, missiles, fans) → OVERDRIVE (rings, lanes) |
| RAIJIN | 2 | STORM PYLONS (four rods, lanes) → CORE EXPOSED → OVERDRIVE |
| TETSUREN | 3 | BROADSIDE (batteries and bow tower) → LOTUS CORE → IRON OVERDRIVE |

Phase changes: 1.8 s invulnerable, every bullet cancelled into score, a banner, a hit-stop. Bosses drop fuel cells
every 9 s.

### Boosts
Overdrive (6 s: ×1.55 speed, invulnerable, rams kill), Spread (10 s, 6-way), Plasma (9 s, piercing 5× shells),
Rapid (10 s, double rate), Barrier (3 hits, 16 s), Magnet (12 s, 16 m), Jump cell, Repair (+30), Energy cell. Placed
on the river and dropped by 8% of kills; Boost Amplifier makes them last longer.

### Score, combo, cores
Kills within 2.5 s chain a combo; every 5 adds ×0.5 to the multiplier (max ×4); a hit resets it. Cores drop from
kills (1–2), bridges (3) and bosses (14–70) and are banked into the meta save at every dock, every pause/quit and at
the end of a run.

### Skill tree (`js/sim/skills.js`)
Three branches of five nodes, each needing the one above it; 1–3 ranks; 1,270 cores for everything.
- **Hull & Jump**: Reinforced Hull (+20 ×3), Spring Hydrofoils (+15% jump ×3), Twin Charge (+1 charge ×2),
  Shockwave Landing (×2), Landing Barrage.
- **Weapons & Ordnance**: Hot Rounds (+20% ×3), Missile Racks (+2 missiles, −20% reload ×3), Extra Barrels (3, 4),
  Piercing Shells (1, 2), Seeker Rounds (×2).
- **Systems & Boosts**: Fuel Efficiency (−15% ×3), Boost Amplifier (+20% ×3), Starting Barrier (2 / 4 hits), Core
  Magnet (+4 / +9 m), Jump Capacitor (−25% recharge ×2).
Refund the top rank of a node (right-click) or respec everything.

## The river generator (`js/sim/river.js`)
Segments are made ahead of the boat from the river's own RNG: a calm opening, then winding stretches, chokepoints
(7.5–9 m half-width), sandbar islands (the river widens first; a channel never drops under 7.5 m), road bridges with
tanks, straights, and at 50% and 100% of the sector a lead-in and an open-ended arena. Spawns are queued per segment
(enemy mix weighted per sector; a depot every ~190 m; a floating pickup 45% of the time). Proved in the simtest over
60 seeds × 3 sectors: every channel ≥ 7.2 m, both arenas exist, boats spawn on water and tanks on the bank.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Steer | ← → / A D | stick / d-pad | drag the left half |
| Throttle / brake | ↑ / ↓, W / S | stick | drag up / down |
| Fire | J / Z / Enter (hold) | X / RB / RT | hold FIRE (auto-fire on by default) |
| Missile | K / X | B / LB | MSL |
| Jump | Space / Shift | A | JUMP |
| Pause | P / Esc | Start | ❚❚ |
| Mute | M | | ♪ |

## Look and sound

Sim (x, y) is world (x, −y); a chase camera sits behind and above the boat and backs off until ~38 m of river (26 m
in portrait) fits. The water is one shader (three depth bands, swirls, ripple streaks, foam lines at every shore,
glints). Banks are toon terrain with sand, grass and cliffs; instanced trees per palette. Models are Meshy GLBs in a
three-step `MeshToonMaterial` with an inverted-hull outline. Effects: point-sprite sparks, splashes, smoke and wake;
flash balls and shockwave rings; instanced bullets and shells; aim lines; laser lanes; speed lines and a hurt
vignette on a 2D canvas; DOM popups, banners and a comms box. Music crossfades title → river → boss; jingles at the
dock and the end; voices duck the music; the engine is a synth that follows the speed.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, hit-stop, input routing, comms, banking, debug hooks (`window.__hrs`) |
| `js/sim/game.js` | Rules: the boat, weapons, collisions, pickups, sectors, save |
| `js/sim/river.js`, `enemies.js`, `patterns.js`, `bosses.js`, `skills.js`, `data.js` | The river generator, enemy placement and behaviour, bullet patterns, bosses, the skill tree, tables |
| `js/sim/bot.js` | The auto-player |
| `js/view/view.js`, `terrain.js`, `fx.js`, `models.js`, `toon.js` | three.js view |
| `js/ui.js`, `js/lines.js` | DOM screens, HUD, skill tree, comms lines |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md).

## Balance notes

Measured with `ONLY=bot SEEDS=8 node dev/simtest.mjs` (median over 8 seeds):

| Skills | Bot skill | Wins | Sectors | Notes |
|---|---:|---:|---:|---|
| none | 1.0 | 67% | 3 | the game can be won with nothing |
| none | 0.6 | 0% | 2 | |
| none | 0.3 | 0% | 1 | earns ~160 cores |
| ~200 cores | 0.3–1.0 | 100% | 3 | two weak runs of upgrades finish the game |
| all | 0.3–0.6 | 100% | 3 | |

What the bot found: fuel killed the perfect bot in 5 of 8 runs at first (drain 1.25/s, depots every 210 m) → drain
1.0, depots every 190 m, cells +30, boss supply drops every 9 s. A 132-core build made even the weak bot unbeatable,
mostly from one cheap rank of Extra Barrels (+50% firepower for 14 cores) → barrels moved to tier 3 of Weapons, all
prices ×1.5, Hot Rounds +20% instead of +25%, bullets 9 damage, the dock repairs 40% instead of 50%. Tetsuren's
bridge tower sat behind its shielded core and could never be hit (the fight stalled) → moved to the bow; a simtest
line now checks no part hides behind a shielded core.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU (frame rate on phones is
  unmeasured).
- Endless mode after the credits; a boss rush.

## Changelog

### v1.0.0 (2026-11-27)
- First release: three sectors, 8 enemy kinds, 3 mid-bosses, 3 three-phase bosses, the jump, fuel, six boosts, combos,
  a 15-node skill tree, Meshy models, ElevenLabs art, music, effects and voices, touch, gamepad and keyboard.
