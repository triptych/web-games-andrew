# Homeward Hop

**Genre:** 3D platformer (Crash Bandicoot's camera and crates, Sly Cooper's cheek and gadgets)
**Engine:** three.js r165 via an import map, no asset files: every model, texture and sound is made in code
**Status:** v1.0.0

---

## Concept

Pinch is a young hermit crab and a budding inventor. On Shell Swap Day, when every crab in Tide Pool Seven
trades up to a roomier shell, his one-second shell-swapping gadget goes bang, a very big wave comes, and Pinch
is washed far from Ma, Pa, little Dot and Granny Whelk. Home Reef is five worlds away. He has his toolbox,
a goofy pair of goggles, and a habit of picking up anything that might be useful.

The player runs, jumps and spins through fourteen short levels in five worlds, smashing crates, collecting
pearls and hunting three hidden found-things in every level. The found-things are the parts for the
gadgets Pinch builds in his workshop between levels. Along the way he finds five shells; swapping between
them is the whole toolkit: roll, block, pound, glide and boing. Every world teaches one, and every boss
falls only to the one its world taught.

The tone is warm, silly and never scary: nobody is ever really hurt, there are no lives to lose, the
villains are lonely (a coconut crab who wants a game of catch, a sand knight who lost his permit, a gull who
loves shiny things), and a hit is a heart, an oopsie is a trip back to the last flag.

## Core loop

A level takes one to three minutes. Run along a path of slabs over the sea, over gaps, past baddies; break
crates, collect pearls (50 pearls heal a heart), find the found-things, touch the goal arch (or beat the boss).
The results screen tallies pearls, found-things, time and oopsies, awards four badges, and reads out a
message in a bottle from the family. The map opens the next level; the workshop turns found-things into
gadgets; the next world opens with a new shell.

## Mechanics

### Moving (js/sim/game.js, world.js)
- Fixed step 1/120 s. Camera-relative movement: the sim holds the camera's yaw, so the stick means the same on screen everywhere.
- Run 7.2 m/s, ground accel 62, air accel 30. A jump is 2.1 m high and about 5 m long. Hold jump to go higher (a tap cuts the jump to 42%).
- Coyote time 0.11 s, jump buffer 0.13 s, step-up for ledges up to 0.34 m, stand-on-box collision resolved one axis at a time against axis-aligned boxes.
- Spin (X): 0.42 s, reach 1.75 m: breaks crates, kills most baddies, catches a little air.
- Hurt: lose a heart, 1.7 s of grace, knocked back; three hearts, so three hits is an oopsie (back to the last flag, hearts full).
- Water: falling in costs a heart and puts him back on the last safe slab (a spot stood on for 0.2 s, 0.9 m from the edge).

### The five shells (Q/E or 1–5; the Power button, C)
| Shell | Power | Rules |
|---|---|---|
| Spiral 🐚 | Roll | 12.2 m/s for 0.72 s on the ground; jump out of it for a roll-jump that keeps 10.2 m/s. Breaks crates and baddies. |
| Coconut 🥥 | Brace (hold) | Shield up: from the front (±75°) a coconut, rock or fish is sent back at its thrower, a cannonball just breaks. 42% run speed. |
| Peach-Can 🥫 | Ground pound | Ground press hops and pounds, air press dives at 33 m/s. Radius 3.4 m: breaks iron crates, presses big switches, knocks out knights, fleas and starfish, dazes bosses. 90% run speed, 93% jump. |
| Sail ⛵ | Glide | Jump again in the air (or hold Power): fall at 2.1 m/s, steer at up to 9.2 m/s. Bubble vents lift gliders at 7.5 m/s. |
| Spring 🌀 | Super hop | Hold Power on the ground to squash for up to 0.75 s, release for 10.5–18.6 m/s straight up. |

A world hands out its shell on arrival: world 1 has Spiral only, 2 adds Coconut, 3 Peach-Can, 4 Sail, 5 Spring.
The level builder refuses a hop that needs a shell its world has not given out yet.

### Things in levels
- **Pearls** (+1, magnet range with the Button Magnet), **crates** (wood: two pearls; pearl: eight; iron: pound only; check: a checkpoint; heart: a heart), **sponges** (bounce 19.5 m/s), **barrels** (fire the player along a fixed arc to a linked slab), **crumbling slabs** (give way 0.62 s after a foot, return after 3.6 s), **moving rafts** (carry the player), **bubble vents**, **big switches and their gates**, **spinning bars**, **found-things** (three a level, each a part kind).
- **Baddies:** flea (hops, stompable), starfish (spiky, spin or roll or pound), jelly (bobs, spin), monkey (throws coconuts at a lead), cannon (iron ball every 3 s), gull (circles, warns, dives), sand knight (armoured: spin and stomp clink off; a pound kills).
- **The chase** (5-1): a grumpy wave 20 m behind at 5 m/s; the camera films it from the front, so Pinch runs toward the screen with the wave looming behind him.
- **Bosses** (state machines in `sim/boss.js`):
  - *Big Coco* (3 hearts): throws single coconuts and fans, and stomps rings you must hop. Only a coconut you reflected hurts him.
  - *Sir Sandy* (3): walks, smashes rings, and from phase 2 throws rocks. A ground pound near him dazes him for 4.5 s; then spin the crown.
  - *Captain Squawk* (4): marks a spot, dives and sticks in the sand (spin her), tosses fans of fish (reflect them), and a ground pound beneath her knocks her out of the air.

### Inventions (wear three)
Ten gadgets built from the found-things; the levels hold 42 and the gadgets cost 23. Each one also appears on Pinch.

| Gadget | Parts | Effect |
|---|---|---|
| Bottle-Cap Boater | cap, string | +1 heart |
| Button Magnet | button, magnet | pearls come to you from 4.2 m |
| Rubber-Band Boots | string, spring | jump 10% higher |
| Cork Lifebuoy | cork ×2 | one free rescue from the water per level |
| Spoon Spinner | spoon, gear | spin reach ×1.4 |
| Sea-Glass Specs | glass ×2 | an arrow to the nearest hidden found-thing |
| Tick-Tock Watch | gear ×2, glass | crumbling slabs last 1.9× longer |
| Parasol Pop | string, glass, cork | glide fall 30% slower, 6% faster |
| Boing Springs | spring ×2, cork | bounces ×1.25 |
| Swap Sparkler | bulb, button | a second of grace after swapping shells |

### Progress and badges
A level opens when the one before it is cleared. Four badges per level: all three found-things, 90% of the pearls,
no oopsies, under the par time. A world's shell is handed out when its predecessor is cleared. Progress is saved
after every clear, craft and equip; there is no mid-level save (levels are minutes long).

## Content

### Worlds and levels
| | World | Levels | Teaches |
|---|---|---|---|
| 1 | Sunny Shallows | 1-1 Hello, Tide Pool · 1-2 Sandbar Scramble | run, hop, spin, sponges, roll-jump, a raft |
| 2 | Coconut Cove | 2-1 Monkey Business · 2-2 Barrel Bounce Bay · 2-3 Big Coco's Beach Bash (boss) | the Coconut Shell, barrels, crumbling slabs |
| 3 | Rustwater Docks | 3-1 Plank Walk Blues · 3-2 Crate Expectations | the Peach-Can Shell, cannons, spinners, gates, iron crates, gulls |
| 4 | Sandcastle Kingdom | 4-1 Moat Mischief · 4-2 Turret Terrace · 4-3 Sir Sandy's Keep (boss) | the Sail Shell, vents, knights |
| 5 | Stormbreak Point | 5-1 Wave Chaser · 5-2 Lighthouse Hop · 5-3 Captain Squawk's Roost (boss) · 5-4 Home Sweet Reef | the Spring Shell, a chase, a climb, everything |

Levels are written as scripts: `L.ground(len, width)` lays a slab at the cursor and runs on; `L.gap(n)` leaves water;
`L.corner(±1)` turns a quarter turn; `L.mover`, `L.crumble`, `L.branch` build the set pieces. `s.crate`,
`s.enemy`, `s.pearls`, `s.curio`, `s.switch` place things in slab-local metres.

### The proof
Every hop between two slabs is checked in `levels.js` against the body's physics (`reach(mode, rise)`):
walk, jump (≈4.2 m flat), roll-jump (≈5.9), glide (≈9.7), spring hop (rise ≤ 5 m), sponge bounce, vent, barrel.
A level that asks for more, or for a shell its world has not handed out, does not build. Sponges and vents a hop
leans on must be on the slab it leaves from.

## Story
Opening: the Shell Swap, the gadget, the wave. A short scene on the first arrival in each world (the shell Pinch
finds there). Pre- and post-fight scenes for the three bosses. A message in a bottle from the family after the
first clear of most levels. An ending at Home Reef with every character, a credits card with the player's totals.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Run | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Jump | Space / Z / K | A | Jump |
| Spin | X / J / F | X | Spin |
| Power | C / L / Shift (hold where noted) | B / RT | Power |
| Swap shell | Q / E / Tab, 1–5 | LB / RB / Y | the 🐚 button, or tap a shell in the dock |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound
- **Look:** toon materials with a four-step ramp; characters get an ink outline (the mesh pushed out along its normals and drawn inside out); scenery is merged into one vertex-coloured mesh; a shader sky and sea per world; soft shadow blobs under everything plus a real directional shadow; particles in two draw calls; shock rings; squash and stretch; a camera that eases, clamps so Pinch never leaves the frame, leans into rolls and glides, shakes on slams, circles on the title and swings to a far, high view in boss arenas. Six moods: sunny beach, jungle cove, sunset pier, pastel sandcastle, purple storm, rosy reef.
- **Sound:** a look-ahead sequencer with a seeded motif and a different band per world (ukulele and marimba, toms and wood blocks, squeezebox and pluck, harp and bell, a pulse and pads, warm pads); heavier percussion in boss fights; effects that answer sim events; wind while gliding or falling; scuttling steps.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, map, workshop, play, win, cutscene), the fixed-step loop, input routing, debug hooks |
| `js/sim/game.js` | newGame, step, the player (shells, jump, hurt), pickups, camera yaw, serialize |
| `js/sim/world.js` | Box collision, movers, crumbles, solid queries |
| `js/sim/levels.js`, `scripts.js` | The builder and its proofs; the fourteen level scripts |
| `js/sim/enemies.js`, `boss.js` | Baddies, shots, hazards; the three fights |
| `js/sim/data.js`, `progress.js` | Shells, parts, inventions, worlds, story; clears, workshop |
| `js/sim/bot.js` | A route-following bot with a tactic for each boss |
| `js/view/` | `stage` (renderer, sky, sea), `view` (camera, events), `world3d` (the level as a scene), `models`, `props`, `decor`, `fx`, `kit`, `themes` |
| `js/ui.js`, `input.js`, `audio.js`, `save.js` | DOM, input merge, sound, guarded storage |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the level proofs, every rule, the bosses,
determinism and save round trips, and has the bot play every level and boss; `browsertest.mjs` plays the real game on
desktop, on touch-only phones in both orientations, and with storage blocked.

## Balance notes

- The immortal bot clears every level in 18–36 s and the mortal bot in about the same, with no oopsies; a person takes
  two to four times as long because of the found-things, the signs and the shell swaps. Par times (100–220 s) are set
  well above the bot's.
- Early bot runs found: a crate dead ahead on a one-slab-wide path stopped the bot (and would stop a player who
  does not spin: wood crates now break on a spin or a stomp, iron ones can be jumped); Sir Sandy fell in 4 s to a
  pound-then-spin loop, so a hit now gives him 3.4 s of immunity to being dazed again; the first Sandy and Squawk
  fights were over in under 15 s for the same reason.
- Fifty pearls heal a heart, so a player who plays well is rarely in danger, which suits a game that is meant to be
  light.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- Camera comfort at the quarter-turn corners and in the chase level (filmed from the front).
- More levels per world; time-trial ghosts; a second pass on the boss pacing for people.

## Changelog

### v1.0.0 (2026-10-24)
- First release: five worlds and fourteen levels, five shells, ten gadgets, three bosses, a chase, barrels, crumbling
  slabs, rafts, vents, gates; a story with an ending; a workshop, a map, badges and a results tally; touch, mouse,
  keyboard and gamepad; a generative band per world; and the sim, browser and bot harnesses.
