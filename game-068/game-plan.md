# DIRT CROWN — a backroads racing saga

**Genre:** Dirt-track racing × light RPG (career, upgrades, story, a rival and a final)
**Engine:** three.js r165 (import map, ES modules). No asset files: every car, track, prop, portrait, texture, tune and engine note is made in code.
**Target:** desktop (keyboard, gamepad) and phones (touch, portrait and landscape)
**Status:** v1.0.0

---

## 1. Pitch

You pull a tarp off your grandfather's first racer, **the Bucket**: a tiny, primer-grey off-roader without a single feature. Win dirt races for coins, spend the coins on parts, and watch the car grow exhausts, a hood scoop, a blower, wings, big tyres, coil springs, a roll cage, a light bar, armour and nitro bottles. Seven circuits later you line up against your rival, Colt Ravenwood, for **the Dirt Crown**.

Racing is third person and arcade: loose, sliding dirt physics, drifts that fill a nitro tank, big airs off tabletops and kickers, mud that bogs you down, ice that doesn't hold you up, and AI that races (not trains) through the field.

### Design pillars
1. **The driving feels good on its own.** Sliding through a bend, catching it, nitro out of it. Jumps that send you flying and landings you can feel.
2. **Every upgrade shows.** The car you finish with looks nothing like the one you started with, and you can point to every part you bought.
3. **Every place drives differently.** Farm dust, forest loam and mud, canyon jumps, bayou water and planks, snow and ice, stadium supercross, and a final track with all of it.
4. **A story worth finishing.** Short scenes, a real rival, stakes (the Crown's winner decides who races in the county) and an ending.
5. **Phones are first class.** Touch buttons, auto-accelerate, layouts for both orientations.

---

## 2. Story

Thirty years ago **Gus Halloway** lost the Dirt Crown when **Victor Ravenwood** cut the infield on the last lap and the judges looked away. Gus never raced again. Now Ravenwood Motors has bought every dirt track in the county and says the Crown is "by invitation only". An old charter says whoever wins the Crown sets the rules for every track, which is why Victor needs his son **Colt** to win it.

| Character | Role |
|---|---|
| **You** (name and number chosen) | Gus's grandkid, a rookie |
| **Grandpa Gus Halloway** | Retired legend, owns Halloway's Garage |
| **June Ortiz** | Mechanic. Runs the garage and fits your parts |
| **Rowdy Rex** | The voice of the dirt: radio, PA, pre-race lines |
| **Colt Ravenwood** | The rival. Smug at first; turns out he wants to win fair |
| **Victor Ravenwood** | Owner of Ravenwood Motors. The real villain |
| **Big Earl Pruitt** | Champion of Dustwater Flats (pickup) |
| **Fern Calloway** | Ranger, champion of Pinecrest Woods (rally hatch) |
| **"Sidewinder" Sal** | Daredevil, champion of Redrock Canyon (dune buggy) |
| **Gator Boudreaux** | Mud King of Gatorback Bayou (swamp buggy with an airboat fan) |
| **Ivanka Volkova** | The Ice Queen of Frostbite Pass (ice racer) |
| **Max Volt** | Showman of the Thunderdome (neon trophy truck) |

Beats: the tarp comes off (prologue) → Colt mocks the Bucket → each champion, before and after their race → someone loosens the Bucket's fuel line → Colt practising alone at night in the bayou → Victor's bribe ("everything is for sale") → every champion on one grid at the Crown Qualifier → Colt warns you that his father's crew has oiled the bends of the Crown Run → the Dirt Crown → the ending (every track opens to everyone, even Ravenwoods). Losing the final has its own scene. Scenes play once and can be replayed from the Career page.

---

## 3. Racing

### 3.1 Tracks
A track is a closed centreline (a wobbly polar loop, a Catmull-Rom through points, or a figure eight whose crossing is a bridge), resampled every ~2 m and relaxed so no bend is tighter than a car can follow. Elevation comes from whole-lap hills plus **features**: tabletops, kickers, crests, dips and whoops. Banking raises the outside of bends. **Patches** change the surface for a stretch: mud, water, gravel, sand, planks, ice, snow and (on the Crown Run) oil. Coins sit on the road in short lines.

Twenty tracks in seven environments, and events also run some backwards:

| Environment | Look | Tracks |
|---|---|---|
| Dustwater Flats | Noon, wheat, barns, silos, windmills, cows | Barnyard Oval, Cornfield Loop, Windmill Run |
| Pinecrest Woods | Misty morning, pines, birches, ferns, cabins | Pinecone Trail, Ridgeback Run, Hollow Creek |
| Redrock Canyon | Sunset, mesas, hoodoos, a stone arch, cacti | Mesa Loop, Rattlesnake Gulch, Sunset Arch |
| Gatorback Bayou | Dusk, cypress and moss, lanterns, fireflies, water with gators | Gator Bend, Stilt-Shack Sprint, Crossroads Bayou (figure eight) |
| Frostbite Pass | Snowfall, snowy pines, a frozen lake | Frozen Lake Loop, Avalanche Pass, Summit Circuit |
| The Thunderdome | Night stadium, 20,000 fans, floodlights, neon, jumbotron | Supercross Snake, Thunder Eight (figure eight), Ring of Fire |
| Ravenwood Mesa | Golden hour, Ravenwood billboards and tower | Ravenwood Speedway, The Crown Run |

### 3.2 The car (js/sim/car.js)
A point with a heading, a horizontal velocity, a height and a vertical speed, stepped at 120 Hz.
- **Steering** sets a yaw rate, capped by the cornering force the tyres have at this speed (understeer when you ask too much).
- **Grip**: the velocity is left behind in world space as the body turns; the tyres bleed off its sideways part at a rate set by grip. Loose surfaces, and the **drift** button, let the slide linger. Sliding scrubs speed.
- **Nitro** fills while sliding and after clean landings; burning it adds thrust and top speed.
- **Slipstream**: tucked in behind another car you lose drag and gain a little top speed.
- **Jumps**: the car follows the ground until the ground falls away faster than gravity can pull it down. Within the suspension's travel the tyres keep biting through small hops; bigger airs mean no steering until you land. A hard landing costs speed (less with good suspension); a clean one tops up the nitro.
- **Barriers** push you back and cost speed (less with armour). **Cars** bump by mass.
- **Launch**: throttle in the last half second of the countdown for a boost; too early bogs you down.
- **Reset** (R, or automatic when stuck) puts you back on the racing line.

### 3.3 Surfaces
| Surface | Grip | Drag | Rough | Where |
|---|---|---|---|---|
| Dirt / clay / red clay / loam | ~1.0 | – | low | the roads |
| Packed snow | 0.82 | low | low | Frostbite Pass |
| Mud / bog | 0.72 | heavy | medium | puddles, the bayou |
| Water | 0.80 | very heavy | low | creek fords, the bayou |
| Gravel | 0.84 | low | high | washes |
| Sand | 0.78 | heavy | medium | the canyon, the mesa |
| Ice | 0.42 | – | – | frozen lakes |
| Oil | 0.40 | – | – | the Crown Run's bends |
| Grass / snow / bog run-off | low | heavy | high | beyond the road |

Better tyres win back part of what a loose surface takes away; better suspension soaks up roughness.

### 3.4 AI (js/sim/ai.js)
Each driver aims at a point down its racing line, plans its speed from the curvature ahead and the grip there (ice and mud included), commits to a passing side when blocked, and fires nitro on straights and during passes. Skill sets how close to the limit it brakes and how tidy its line is. Grids are seeded like a handicap (slowest at the front), the rookie starts fifth, and a champion lines up third so they have traffic too. A gentle rubber band works in ordinary races only.

### 3.5 Race types
- **Race**: finish top three to move on; first pays the full purse.
- **Elimination**: whoever is last when the leader finishes a lap is out.
- **Time Trial**: alone against gold, silver and bronze times (set by a bot driving the field's car, +2%, +7%, +13%).
- **Duel**: one on one with a champion. Only a win counts.
- **Champion races**: only first place counts.

---

## 4. The RPG

### 4.1 Upgrades (js/sim/parts.js)
Six lines of five levels: **Engine** (top speed), **Drivetrain** (acceleration), **Tyres** (grip and loose surfaces), **Suspension** (bumps and landings), **Body & Armour** (weight in shoves, speed kept along walls), **Nitro** (capacity, kick, refill). Levels cost 120, 300, 650, 1200 and 2000 coins. **Rating** = 100 + 30 per level (100 to 1000), the same scale every event and every opponent's car is built on.

Every level adds visible parts (js/view/carmodel.js): exhausts → twin pipes → hood scoop → supercharger → chrome blower; mud flaps → tow hook → ducktail → wing → wing with end plates; bigger tyres → five-spoke rims → beadlocks → racing rims → gold; ride height → coil springs → long-travel arms → twin shocks → gold coilovers; bull bar → roll cage → nerf bars → light bar → riveted armour; one nitro bottle → two → purge → three → glowing tanks.

### 4.2 Paint shop
15 body colours (two metallic), 7 liveries (stripes, flames, checkered tail, lightning bolt, mud splatter, number roundels, and the Halloway Heritage livery for champions), 8 free trim colours, and your race number. Liveries are painted into one canvas whose regions are mapped onto the left side, right side and roof, so numbers read the right way round on both sides.

### 4.3 Career (js/sim/career.js)
Seven circuits of four events (the last has two), 26 events in all. An event opens when the one before it is cleared (a podium, a medal, or a win against a champion); a circuit opens when the champion before it is beaten. Purses pay by position (100/60/40/25/15/10%), medals 100/60/40%, a first win or first gold adds 50%, and coins picked up on the road are kept. Every event can be re-run for coins.

**Balance** (dev/simtest.mjs, "career"): a bot that races every event with its own car, buys the cheapest upgrade it can afford and retries what it loses, finishes the career in about 45–60 races at three skill levels, and no event needs more than a dozen tries. The final is meant to be the hardest: with a fully built car an average bot beats Colt about 40% of the time.

---

## 5. Presentation

- **Third-person chase camera** (three distances, C to cycle) that swings with your drift, widens with speed, shakes on impacts and keeps above the ground. A swoop round the grid during the countdown, an orbit after the finish, cinematic cuts behind the title.
- **Post-processing**: a sanitize pass (no NaN pixel can ever reach the bloom), bloom (strong at night), a grade per time of day (warmth, saturation, vignette) and a radial blur while boosting.
- **Environment maps** baked from each sky, so paint and chrome reflect it.
- **Particles**: wheel dust tinted by surface, mud and water spray, landing bursts, sparks off barriers, nitro, coin sparkles, confetti and fireworks; tyre marks; weather (dust motes, pollen, fireflies, snow, confetti).
- **UI**: a dusty western racing look (Bungee and Rubik), a painted county map, upgrade cards with stat bars, a paint shop, event cards with a track preview, a HUD with standings, a minimap, a speedometer with a nitro ring, and the Rex ticker.
- **Audio**: a five-gear synthesised engine for you and the nearest rival, tyre scrub, surface rumble, wind, nitro hiss, and a step-sequencer score with a style per place (country shuffle, driving rock, spaghetti western, swamp blues, cold synths, synthwave, epic minor).

---

## 6. Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Steer | A / D, ← / → | left stick, d-pad | ◀ ▶ |
| Throttle | W, ↑ | right trigger | GAS (or auto-accelerate) |
| Brake / reverse | S, ↓ | left trigger | BRAKE |
| Drift | Space | A, right bumper | DRIFT |
| Nitro | Shift, N, X | X, B | N₂O |
| Reset to track | R | Back | (automatic) |
| Camera | C | Y | Settings |
| Pause | Esc, P | Start | ❚❚ |
| Mute | M | | Settings |

---

## 7. Module overview

| File | Responsibility |
|---|---|
| `js/main.js` | Modes, the race loop, events → view/audio/HUD, story flow, saving, debug hooks |
| `js/config.js` | Shared constants |
| `js/rng.js` | Seeded random, noise |
| `js/input.js` | Keyboard, touch buttons, gamepads |
| `js/audio.js` | Engine, beds, one-shots, music |
| `js/save.js` | Guarded localStorage |
| `js/sim/track.js` | Track geometry, lookups, surfaces |
| `js/sim/tracks.js` | Every track and environment |
| `js/sim/surfaces.js` | Surface table |
| `js/sim/car.js` | Car physics and contact |
| `js/sim/ai.js` | Computer drivers |
| `js/sim/race.js` | Grid, countdown, laps, positions, race types, results |
| `js/sim/parts.js` | Upgrades, rating, paint shop |
| `js/sim/career.js` | Circuits, events, drivers, fields, payouts, unlocks |
| `js/sim/story.js` | Cast, scenes, triggers, Rex's lines |
| `js/view/stage.js` | Renderer, sky, light, post, cameras |
| `js/view/envs.js` | How each environment looks |
| `js/view/world.js` | Terrain, road, patches, bridges, barriers, start gantry, stands, coins, water, stadium, props |
| `js/view/props.js` | Scenery models |
| `js/view/carmodel.js` | Procedural cars and liveries |
| `js/view/fx.js` | Particles, tyre marks, weather |
| `js/view/garage.js` | The garage hub scene |
| `js/view/textures.js` | Canvas-painted textures |
| `js/ui/hud.js` | Race HUD |
| `js/ui/screens.js` | Menus, hub, story player, results |
| `js/ui/portraits.js` | Painted character portraits |

`js/sim` never imports three.js, touches the DOM or calls `Math.random`, so the whole game can be raced headlessly in Node.

---

## 8. Changelog

### v1.0.0 (2026-10-07)
- First release: 20 tracks in 7 environments, 26 events across 7 circuits, 6 champions and a rival, 6 upgrade lines that all show on the car, a paint shop, a story with 19 scenes and an ending, desktop, gamepad and touch controls, `dev/simtest.mjs` and `dev/browsertest.mjs`.
