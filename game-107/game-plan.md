# Kaiju Roll

**Genre:** arcade destruction: Katamari Damacy × Breakout × Rampage
**Engine:** three.js r165, no asset files (every model, texture, effect, sound and tune is made in code)
**Status:** v1.2.0 complete; balance tuned by a bot, not yet by hand

---

## Concept

You are a kaiju who has curled into a ball. The ball never stops rolling, so a building is a brick and you are the ball: steer to curve your path, bounce off a tower, and watch its floors fall away one at a time. Everything small that you roll over, people, cars, trees, rubble, sticks to you and makes you bigger (Katamari), a bigger ball hits harder and finally rolls straight over houses, and the army (tanks, helicopters, bombers) wants you stopped (Rampage). The cities are toy towns: pastel walls, teapots and donuts on the roofs, balloons on the chimneys, a ferris wheel, a river with red suspension bridges.

The tone is cheerful destruction: a round green monster with a toothy grin, dust puffs, a marimba tune with an oompah bass, and a fanfare for every city. Nobody gets hurt on screen; the people run away squeaking.

## Core loop

Pick a gift, read the city card, roll. Flatten 80–88% of a city's strength (the HUD bar has a goal mark) while surviving the army. A star sheet shows time (par), deaths and totals; choose one of three gifts (perks) and go to the next of five cities. Three lives (balls): at zero health you lose one, come back after two seconds, a bit smaller, with a grace period. Out of lives ends the run (best score is saved); flattening the fifth city wins.

## Mechanics

### The roll
- Steering is acceleration (30 u/s²) on the held direction; speed is capped (13 u/s plus 0.55 per unit of radius above 1.2) and decays slowly while coasting.
- A **minimum speed** (3.8 u/s) is always kept along the last heading: the ball never stops, like a breakout ball.
- Shallow water (the river, unless there is bridge deck under you) slows the ball to 78% of its top speed.
- The sea wall bounces the ball back (92% of the speed).

### Buildings
- A building is a stack of floors with hit points per floor (`fhp`), multiplied by the city's strength and a global ×2.8. Floors = ceil(hp / fhp); when the count falls the floor is lost, rubble flies, and the score for the floors is awarded.
- **Bounce:** a hit with normal speed `v` does `(max(0, v − 2.5) · r² · 2.2 + 2r) · damage multiplier`, and the ball is reflected with 84% of its speed.
- **Crush:** if the building's height is under `0.9 r`, the ball rolls over it and grinds it down at `(28 + 22 r)` hp/s, without bouncing.
- **Fly over:** a jumping ball whose underside is above the roof ignores the building.
- Types: house, shop, block, tower, skyscraper, spire; landmarks: ferris wheel, gas tank (explodes, chain-reacts), statue; bridge decks (low, crushable) and pylons (bricks; their cables go when they fall; a bridge without pylons loses its decks).
- A collapse can drop a power-up (12% houses, 30% mid-rise, 60% towers).

### Growing
- Each swallowed thing adds a volume; radius = cube root of the total volume (capped at 5.2). A thing is swallowed when `size <= 0.9 r`. Too big and slow: it bounces you; too big and fast (past its `tough` speed): it is flattened into rubble.
- Rubble (from floors, smashed trees, wrecked tanks) lies where it falls and is swallowed like anything else. Up to 70 swallowed things stay visible on the ball.
- Food (snack carts, pizza trucks) heals 8 and 14.

### The pounce
- Space / Z / A / the POUNCE button: hop (about a second in the air). The landing is a **slam**: a shockwave of radius `2.2 r + 1.6` damages buildings (`16 + 18 r`, less with distance), swallows small things, flattens big ones, hurts tanks and deflects shells.
- In the air the ball passes over low roofs, under shells, and **swats helicopters** it reaches.
- Cooldown 1.05 s (a gold ground ring shows when it is ready).

### The army
| Unit | Behaviour |
|---|---|
| Tank | Patrols one street, aims a shell at where you will be (accuracy grows by city), 13 damage, 3.4 s apart (faster later). Flattened by speed ≥ 5 or radius ≥ 2, or two slams. |
| Helicopter | Orbits you at 8–12 units, fires a homing missile (14 damage) every few seconds. Swatted by a jump. |
| Bomber | A red strip warns for 1.9 s, then it crosses the city dropping a bomb every 4.4 units (0.85 s fuse, radius 3, 14 to you, 16 to buildings). |
Their own shells and bombs hurt the city. The timetable per city is `LEVELS[i].mil` (`[first at s, every s, max alive]`).

### Power-ups (from fallen buildings, 20 s on the ground)
Atomic Breath 🔥 (12 s: damage ×2.2 and nearby buildings burn), Snack Magnet 🧲 (12 s), Jelly Shield 🛡️ (10 s, soaks hits), Mega Meal 🍔 (+22% volume), Big Hug 💖 (+40 health).

### Score
Floors, collapses, swallowed things, army kills. A **chain** counts every smash within 2.2 s of the last; the multiplier is `1 + chain/10`, up to ×6; taking a hit breaks it. Stars: 1 for flattening the city, +1 under par, +1 for no lost life.

### The three monsters
Chosen on a screen of cards after New Game (pictures drawn from their own models); Play Again keeps the choice and saves remember it. All three can win; the table in `CHARS` (`js/sim/data.js`) is the whole difference.

| Monster | Health | Steering | Top speed | Pounce | Damage | Power-ups |
|---|---|---|---|---|---|---|
| Rexy the Reptile (green, toothy) | 100 | ×1 | ×1 | 1.05 s | ×1 | last ×1.25 |
| Bongo the Monkey (brown, banana, big ears) | 80 | ×1.25 | ×1.08 | 0.79 s | ×0.92 | ×1 |
| Gigabot the Robot (steel, visor eyes, antenna) | 130 | ×0.8 | ×0.93 | 1.21 s | ×1.25 | ×1 |

### Gifts (perks)
Thick Hide (+25 max health), Springy Legs (pounce 25% faster), Big Bones (start +0.12 bigger), Spiky Scales (+20% damage), Long Burps (+35% power-up time). Three are offered after each city, rotating.

## Content: the cities

| # | Name | Grid | Start r | Goal | Par | Look | Army |
|---|---|---|---|---|---|---|---|
| 1 | Pastel Bay | 3 × 4 | 1.2 | 80% | 2:00 | candy daylight | a tank from 8 s |
| 2 | Harbor Town | 3 × 5 | 1.5 | 82% | 2:30 | bright blue day | + helicopters from 30 s |
| 3 | Neon Heights | 4 × 5 | 1.8 | 84% | 3:50 | purple dusk, lit windows | + bombers from 45 s |
| 4 | Frostport | 4 × 5 | 2.1 | 86% | 3:50 | snow | more of everything |
| 5 | Fort Fortissimo | 4 × 6 | 2.4 | 88% | 5:00 | red sunset | the lot |

Streets widen and blocks grow a little each city so the bigger starting ball fits. A city is a river across the middle (a bridge on every north-south street), blocks of one big building, two, four small ones, a park or a plaza, and an open plaza at the south where you start with a car park, a crowd and trees.

## Story

None, only a joke: you are small, round and extremely sure of yourself.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Steer | Arrows / WASD | Stick / d-pad | Drag on the left side |
| Pounce | Space / Z / X | A | POUNCE button (shows the cooldown) |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

- **Models:** a `Kit` merges boxes, spheres and cones into one vertex-coloured geometry with a per-vertex paint mask, so an instance tint colours only the body of a car or the shirt of a person. The reptile kaiju is a green ball with a belly, scales in bands, a spiky back, horns, big eyes, teeth, a tail round the back and feet. See `dev/gallery.html`.
- **Buildings:** a floor-by-floor wall geometry with a window texture in four styles (lit or dark), cut by a draw range as floors fall, plus a roof mesh that drops with it; roofs: flat with air conditioners, pitched, cone, dome, spire, balloons, donut, teapot, awning.
- **Cel shading:** every lit surface uses a four-step toon ramp (`MeshToonMaterial`), and a screen-space pass inks an outline (colour per city) wherever the depth buffer bends, which catches silhouettes and the creases between faces of a building without any extra geometry (`js/view/toon.js`). Solid things are drawn into a multisampled render target with a depth texture; the ink pass copies the depth to the screen; dust, shadows, rings and bubbles (layer 1) are then drawn on top, depth-tested. Settings has an Off switch (a single plain pass) for slow devices.
- **Scene:** sky gradient, fog that follows the camera distance, hemisphere and sun light, soft shadows from one instanced mesh, animated sea and river, drifting clouds, boats, snow in Frostport. The camera hangs south of the ball at 62° and backs off as it grows; it widens on portrait phones. The ball shows through buildings as a gold silhouette and has a ring on the ground.
- **Effects:** billboard dust and fire puffs (one instanced mesh with a tiny shader), chips, shockwave rings, floating score that is summed over a third of a second, a red edge flash on a hit, banners.
- **Sound:** everything in `audio.js`: bloops on a pentatonic ladder for swallowing, thumps by impact speed, crunches, collapse rumble, slam, explosions, a rolling rumble that follows speed, a helicopter chop that follows distance. `music.js` is a look-ahead sequencer: each city has its own tempo, key, mode, chord loop and a seeded melody; layers (bass and drums, offbeat chords, lead, arpeggio, brass) fade in with the share of the city destroyed and the army's presence.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, play, over), fixed-step loop, input routing, the attract-mode bot, debug hooks |
| `js/sim/game.js` | Pure simulation: the ball, buildings, things, rubble, the army, power-ups, phases, save/load |
| `js/sim/city.js` | Seeded city generator (streets, river, bridges, lots, buildings, traffic, people) |
| `js/sim/data.js` | Tables: building types, things, the army, power-ups, perks, the five cities |
| `js/sim/bot.js` | The auto-player |
| `js/view/view.js` | Renderer, camera, pools of instanced things, the ball, event effects |
| `js/view/world.js` | Sea, island, streets, buildings with their floors, bridges, clouds, boats |
| `js/view/models.js` | The model kit, the kaiju, props, army, roofs, landmarks, window textures |
| `js/view/fx.js` | Puffs, chips, rings, floating text |
| `js/view/toon.js` | The toon ramp and material, and the two-pass outline renderer |
| `js/view/themes.js` | Colours per city |
| `js/ui.js`, `js/input.js`, `js/audio.js`, `js/music.js`, `js/save.js`, `js/rng.js`, `js/config.js` | DOM screens and HUD, input merge, sound, music, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, 40 generated cities, the rules, determinism and save round trips, and plays whole games with a bot at three skills. `browsertest.mjs` drives the real game on desktop, two touch-only phones and with storage blocked.

## Balance notes

- First pass: a perfect bot cleared the first city in 30 s with no damage and combo ×8 all the time. Building strength ×2.8, combos from every 6 to every 10 (max ×6), rubble volume cut to 0.1·s², and a stronger army (3 → more tanks, earlier helicopters, 13-damage shells) brought the perfect bot to 45–115 s a city, and a skill-0.3 bot to real trouble from city 3.
- Table (seconds / health lost per city, perfect bot): 45/2, 54/21, 93/83, 84/74, 115/69. A decent bot (0.6) wins most games; a sloppy bot (0.3) wins about 5 in 8.
- Par times are about 2.5× the perfect bot's.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, SwiftShader is not a GPU, and nobody has listened to the audio.
- A boss (a giant mech) for city 5, enemy variety (infantry that shoot, a battleship in the bay), more power-ups, and something to keep between runs.

## Changelog

### v1.2.0 (2026-10-29)
- Choose your monster: a reptile, a monkey or a robot, each with its own model and a few stats; a choose screen with portraits; the choice is saved and kept on Play Again.

### v1.1.0 (2026-10-29)
- Cel shading: toon-ramp materials and depth-based ink outlines (colour per city), with a Settings switch; the model gallery and the Garden picture use it too.

### v1.0.0 (2026-10-29)
- First release: five procedural cities, floor-by-floor demolition, growing by swallowing, the pounce, tanks, helicopters and bombers, power-ups, chains, gifts, saves and best score; procedural models, textures, effects, sound and music; keyboard, gamepad and touch.
