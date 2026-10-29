# INTRUDER ALERT '84

**Genre:** Arcade bullet heaven (survivors-like) in a Berzerk maze
**Engine:** Vanilla JS: Canvas 2D, no asset files
**Status:** v1.0.0

---

## Concept

A neon, 16-bit reimagining of Atari's Berzerk as a bullet-heaven survivor: your laser fires on its own while killer robot hordes pour into an electrified maze, you scoop up data chips, stack upgrades, and outrun the grinning bouncer.

Minute to minute you only *move*: thread between robots, stay off the walls, sweep up the chips your laser leaves behind, and dash through trouble. The aiming is done for you (Vampire Survivors), the room is a Berzerk room (posts, one wall each, four doors, robots that steer round the electrified walls, and fry if you knock them into one), and the look is what Berzerk might have been on a 1990 16-bit cabinet: pixel sprites, a synthwave grid floor, neon bloom, scanlines. The tone is arcade-loud and a little silly — the robots still shout at you.

Riffs on: *Berzerk* (1980) and its *Frenzy* sequel, *Vampire Survivors*, *Robotron: 2084*, *Smash TV*.

## Core loop

One run is five sectors of 60 seconds (`ROUND.seconds = 300`).

1. "INTRUDER ALERT!" — you start in the middle of a fresh maze. Robots stream in through the four doors.
2. The laser auto-fires at the nearest robot. Wrecks drop gold data chips; the chip magnet pulls nearby ones in.
3. Chips fill the XP bar. Each level pauses the game on three upgrade cards; pick one.
4. Late in each sector (from sector 2, at 38 s) the **Grinner** bounces in: it can't be destroyed, only knocked back.
5. At 60 s the sector is **purged**: every robot in the room blows (score, chips), the maze is rebuilt around you, the music gets a layer busier.
6. Survive the fifth sector to escape (bonus 5000 + 20 × HP left). HP 0 ends the run. Best score is kept.

## Mechanics

All numbers live in [js/config.js](js/config.js); the rules in [js/sim/game.js](js/sim/game.js).

### Movement and the dash
- Speed `PLAYER.speed` (7.2 u/s), diagonals normalised. Facing follows the last real input.
- Action button: dash `PLAYER.dash` s at ×2.6 speed, in the input direction (or facing if standing still), cooldown 1.2 s. **Untouchable while dashing**: no contact, bolt or wall damage.
- After a hit: `PLAYER.iframes` (0.7 s) of invulnerability; the sprite blinks.

### The maze
- 32 × 18 room. Outer wall with a 3.2-unit door in the middle of each side; the player can't leave.
- Berzerk's algorithm: a 5 × 3 cell grid has 8 interior posts; each gets one wall segment a cell long in a seeded random direction. A direction that would touch a keep-clear circle (the player) is skipped.
- A room in which the player can't reach all four doors (flood fill with a player-sized body) is thrown away and rolled again ([maze.js](js/sim/maze.js)); simtest proves it on 200 seeds.
- Inner walls are **electrified**: touching one costs `WALL.touch` HP (12) and knocks you away. Robots steer round them (straight at you when the way is clear, otherwise down a flood-fill of walking distance from you, `js/sim/nav.js`), so they only touch one when knocked into it (laser hits, pulse, the crowd) — then they take `WALL.robotTouch` (15) every 0.5 s and drones (10 HP) fry outright. Outer walls are solid but harmless to robots.

### The laser and other weapons
- Auto-fire every `laserCool` s at the nearest robot in line of sight within 14 units (falling back to the nearest in range). With the Grinner within 7 units it takes priority. No target, no shot.
- Laser: 10 damage, speed 26, life 0.9 s, stopped by walls, `pierce` extra robots, spread of 0.16 rad between beams. Hits shove robots a little.
- Neon Disc: discs orbit at radius 2, each hit 6 dmg (+15%/Overcharge), per-robot cooldown 0.35 s.
- Shock Pulse: every 3.2 s (×0.88 per extra level) a ring of radius 3.2 (+25%/level): 14 dmg (+20%/level), strong knockback, deletes bolts, shoves the Grinner twice as hard.

### Robots
Spawn in bursts at a random door at least 5 units from the player. Interval 0.75 s × 0.86^(sector−1), shrinking another 35% across a sector, floor 0.2 s. Burst size 3 + (sector − 1), at most one brute per burst, never more than 160 alive. HP × (1 + 0.35 × (sector − 1)). Crowds separate through a coarse spatial grid.

### Chips, levels, upgrades
- Chips carry the robot's `xp`. Within the magnet radius (2.2, +60%/Chip Magnet) they fly to you. Each is worth 10 × value points.
- Past 120 chips on the floor, a new drop merges into the nearest chip within 2.5 units, so long runs never carry hundreds.
- Level n needs round(5 × 1.32^(n−1)) chips. Several levels at once queue (`G.pending`); the cards come one set at a time and the sim does not step while `G.choice` is set.
- Three distinct cards from the upgrades not yet maxed; Repair Kit fills empty slots once everything is maxed.

### Sectors and the purge
At `SECTOR.seconds` the sector ends: every robot is destroyed (scores and drops chips; the view skips their rings), bolts and lasers are cleared, the Grinner leaves, the maze is rebuilt with the player kept clear, spawning pauses 2 s.

### The Grinner (our Evil Otto)
From sector 2, at 38 s into the sector, it enters at the door farthest from you. It chases straight through walls at 3.4 u/s, +0.07 u/s per second alive, capped at 6.2. A bite costs 20 HP; then it backs off (recoils) for 1.2 s, cackling. Lasers and pulses knock it back; nothing destroys it. It leaves at the purge.

### Endings
HP 0 → "Game Over". Five sectors survived → "You Escaped!" with the bonus.

## Content

| Robot | Colour | HP | Speed | Contact | Chips | Score | From | Notes |
|---|---|---|---|---|---|---|---|---|
| Drone | amber | 10 | 2.4 | 8 | 1 | 50 | 1 | fries if knocked into an inner wall |
| Hunter | red | 20 | 3.6 | 10 | 2 | 100 | 2 | fast chaser |
| Gunner | violet | 26 | 1.9 | 8 | 3 | 150 | 2 | holds ~6 units off, strafes, fires a 6-dmg bolt every 2.4 s with line of sight |
| Brute | pink | 110 | 1.5 | 20 | 8 | 400 | 3 | drawn at 2× |
| Grinner | yellow face | ∞ | 3.4→6.2 | 20 | — | — | 2 (late) | see above |

| Upgrade | Max | Effect |
|---|---|---|
| Rapid Fire | 6 | laser cooldown × 0.82 per level |
| Split Beam | 4 | +1 laser in the spread |
| Piercer | 3 | +1 robot per beam |
| Overcharge | 5 | +30% laser damage (+15% disc damage) |
| Neon Disc | 4 | +1 orbiting disc |
| Shock Pulse | 4 | periodic shockwave; bigger, stronger, faster per level |
| Turbo Boots | 3 | +10% move speed |
| Chip Magnet | 3 | +60% pickup range |
| Armor Plate | 4 | +25 max HP and heal 25 |
| Repair Kit | — | heal 40 (filler once everything is maxed) |

## Story

Endless in spirit, finite in v1: the humanoid has broken into the robot complex and has to survive five sector purges to reach the exit. The robots' voice lines are Berzerk's own spirit — "Intruder alert!", "Chicken! Fight like a robot!" — spoken by the browser's speech synthesis at the lowest pitch it allows.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Dash | Space / Z / J | A | DASH button |
| Pick an upgrade | 1 2 3, or arrows + Enter/Space | d-pad + A | Tap a card |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

- **Screen:** a 512 × 288 buffer (16 px per unit), smoothing off, scaled to fit with nearest-neighbour. Landscape shows the whole room; **portrait phones** show the room's full height but 14 units of its width, panned after the player, with arrows on the edges for robots off camera, and leave the lower screen to the thumbs.
- **Palette:** midnight floor in checkered 16 px tiles with a dither and a synthwave grid (violet, brighter every 4 tiles); electric-blue walls with cyan edges and a white-hot core; magenta door frames; a magenta-to-cyan neon frame round the room. Hero green, drones amber, hunters red, gunners violet, brutes pink, chips gold, lasers hot pink with a white core, bolts orange.
- **Sprites:** string maps + palettes baked once ([js/view/sprites.js](js/view/sprites.js)): the Berzerk humanoid (2-frame walk), the Berzerk robot with a scanning eye (2 frames), a gunner with antenna and arm cannon, the Grinner face (grin / cackle). White silhouettes for hit flashes. See `dev/gallery.html`.
- **Effects:** pixel-particle bursts, rings (capped at 64), dash afterimages, wall crackle, screen shake (off under `prefers-reduced-motion`), one white flash per purge, a red flash on hits.
- **CRT:** bloom computed *inside* the buffer (half- and quarter-size copies added back with `lighter`), scanlines every 3 screen px, a vignette.
- **UI:** Press Start 2P (monospace fallback), a chrome-and-sunset gradient logo with a cyan '84, magenta neon buttons, three level-up cards (side by side on short landscape phones).
- **Music:** a look-ahead synthwave sequencer at 112 BPM in A minor (Am F C G): sawtooth octave bass, kick and snare from sector 1; hats and a square arpeggio through a slap-back echo from sector 2; a gated triangle pad from 3; a saw lead hook from 4. Ducks out on pause, title and game over.
- **Effects audio:** laser zaps (throttled), hits, noise-burst explosions, rising chip blips, hurt/zap, dash sweep, pulse thump, level-up and pick arpeggios, purge rumble, Grinner jingle and cackle, win/lose fanfares. **Robot voice** via `speechSynthesis` (toggle in Settings).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title with attract demo, play, over), the fixed-step loop, level-up flow, input routing, music ducking, best score, debug hooks |
| `js/sim/game.js` | Pure rules: player, robots, weapons, chips, levels, sectors, the Grinner, endings, `choose()`, save/load |
| `js/sim/maze.js` | Pure maze generation, reachability, circle/rect/segment geometry |
| `js/sim/bot.js` | Pure auto-player (potential field) and upgrade picker |
| `js/view/view.js` | 512×288 buffer, layers, sprites, effects, bloom, portrait camera, CRT composite |
| `js/view/sprites.js` | Procedural pixel sprites |
| `js/ui.js` | DOM screens (z-index from the open stack), HUD, banners, level-up cards, stats |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound and music, guarded storage (save, settings, best), seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule above, 200 mazes, determinism and save round trips (including mid-level-up), and has the bot play whole runs. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations and with storage blocked. `dev/gallery.html` shows every sprite on neutral grey.

## Balance notes

The bot steers by a potential field (robots, bolts, walls, edges and the Grinner push; the nearest chip pulls) and picks upgrades from a fixed preference list, taking repairs when low.

- First pass: no robot ever touched the bot, then the Grinner killed every run at 1:40 (it was faster than the bot could escape in a walled room). Fix: a slower Grinner (3.4 → 6.2 u/s) that recoils after a bite, and lasers that knock it back — so firepower holds it off. Robot waves made far denser and tougher per sector.
- Second pass: bolts did most of the damage (gunners multiply in later sectors); bolt damage 9 → 6.
- Third pass: robots now path round the walls instead of frying on them, which took away a lot of free kills and the bot died around 3:00; the spawn interval floor `SPAWN.min` 0.2 → 0.55 brings it back.
- Now (8 seeds): the perfect bot survives about 4:00 on average and escapes roughly one run in four; a bot at 0.6 speed that ignores bolts lasts about 2:00. Nobody dies in sector 1.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. The win rate may want loosening for people.
- More of a survivors-like's long tail: weapon evolutions (e.g. Split Beam + Piercer → a sweeping beam), more robot types (Berzerk's later colour waves), elites and a boss for the final purge, an endless mode after the escape.
- Persistent unlocks between runs (a "credits" meta-currency), a run seed to share.
- A low-effects setting (`view.fx`) for weak phones, exposed in Settings.
- The portrait camera hides half the room; an option to see it all (tiny) might suit some players.

## Changelog

### v1.0.0 (2026-10-28)
- First release: an auto-firing laser in a Berzerk maze with electrified walls; four robot types and the Grinner; chips, levels and ten upgrades; five one-minute sectors with purges; a 16-bit neon look with bloom and scanlines, a portrait camera for phones; a synthwave sequencer and a robot voice; keyboard, gamepad and touch; save, continue and best score; sim and browser harnesses.
