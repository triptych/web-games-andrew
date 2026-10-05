# BRICKVADERS

**Genre:** Arcade: Breakout × Space Invaders (with nods to Arkanoid and Galaga)
**Engine:** three.js r165 (ES modules, import map), Web Audio
**Render:** a 3D scene drawn into a 240 × 320 render target (a vertical arcade monitor), nearest-neighbour upscale, bloom, CRT shader
**Status:** v1.0.0, complete: five sectors, 24 stages per loop, endless loops

---

## Concept

It is 1983 and the **Brick Armada** is coming: an invasion fleet of aliens built out of living bricks, marching down on Earth in formation. Earth's last defence is the **STRIKER**, a paddle-ship that is half Breakout bat and half laser base. Bounce the **plasma ball** into the formation to smash invaders and their brick armour, shoot lasers between bounces, catch the capsules that fall out, and stop the Armada before it lands.

It should feel like a cabinet in a 1983 arcade: a vertical monitor glowing in the dark, a pulsing march you can feel in your chest that speeds up as the formation thins, chunky pixels that shatter into tumbling 3D debris, an attract mode that cycles title → score table → high scores → demo, and three-letter initials on the high-score table.

No image or audio files. Every sprite, letter, explosion, backdrop and note is generated in code.

---

## The look

- **Everything is a voxel pixel.** Invaders, bricks, the paddle, bullets, capsules, letters in the logo: every pixel is one instance of a single `InstancedMesh` of boxes, drawn at the exact pixel grid of a 240 × 320 render target. A box at least 3 px wide gets a 1 px bevel in the shader (light top-left edge, dark bottom-right), so every brick looks like a brick and single pixels stay flat.
- **Pixels are physical.** When an invader is hit, pixels break off it and tumble toward the glass as real 3D cubes, growing in perspective. Killing it bursts the rest. Waves begin with the Armada's pixels flying in from all over the screen and snapping into formation.
- **Perspective camera, pixel-exact plane.** The camera is far back with a narrow field of view, so z = 0 maps to the 240 × 320 grid exactly, but anything with depth (debris, backdrops, the logo assembling) really is 3D. Shakes roll the camera slightly, so you glimpse the side faces of the voxels.
- **Five 3D backdrops**, one per sector, drawn into the same low-res target behind the playfield, kept dim so the action pops: a lunar surface with Earth rising, a neon nebula, an asteroid belt with tumbling rocks, a synthwave sun over a grid, and the inside of the mothership (a tunnel of rings). The starfield is 1-pixel points scrolling at three depths.
- **CRT:** slight barrel curvature, scanlines on the low-res rows, an aperture-grille mask when the screen is large, bloom, vignette, chromatic aberration and colour flashes on big hits. Can be switched off.
- **Readable at a glance.** The ball is the only white-and-cyan thing in play. Every enemy shot is a hot colour: red zigzags, pink plungers, magenta star-orbs, red-and-yellow bombs.
- **Raster HUD and menus.** All text is a hand-made 5 × 7 pixel font drawn into the same render target, so it glows and scanlines like the rest. The only DOM is the cabinet around the screen (side art on wide screens, a control deck on phones) and the back link.

---

## Controls

| Action | Keyboard | Mouse | Touch | Gamepad |
|---|---|---|---|---|
| Move | ← → / A D | move the mouse | drag on the screen or the spinner pad | stick / d-pad |
| Launch ball / fire | Space / Z / ↑ | click | tap the screen, or the FIRE button (hold to auto-fire) | A |
| Nova bomb | X / Shift / B | right click | BOMB button | B / X |
| Pause | P / Esc | | ❚❚ | Start |
| Mute | M | | in the pause menu | |
| Start / confirm | Enter / Space | click | tap | A / Start |

The touch deck: on a portrait phone the screen sits on top and an arcade control panel fills the space underneath (a ridged **spinner pad** you drag across, a big red FIRE button and a yellow BOMB button). On a landscape phone the pad goes on the left and the buttons on the right. Dragging moves the paddle relative to where your finger started, so your finger never covers it.

---

## Core mechanics

### The STRIKER
- A paddle at the bottom (26 px wide, 40 expanded). The ball bounces off it Arkanoid-style: the angle depends on where it lands (up to 60° from vertical), and every paddle hit speeds the ball up a little, to a cap.
- **Lasers:** one shot on screen at a time (as in Space Invaders). The LASER capsule gives twin rapid-fire cannons.
- **Nova bomb:** wipes every enemy bullet off the screen and blasts everything. You start with one and hold up to three.
- You lose a ship if the last ball falls past the ground line, or if an enemy bullet, bomb or diver hits you. Extra ships at 20 000, 60 000 and every 60 000 after.

### The ball
- Bounces off walls, the ceiling, invaders, bricks, shields, asteroids and bosses, and swats enemy bullets out of the air.
- **Chain:** every hit before the ball returns to the paddle adds to the chain. Every five chain links add ×1 to the score multiplier, up to ×5. Brick hits play a rising pentatonic run, so a long chain sounds like one.
- Safety: the ball never flies flatter than about 17°. If the paddle hasn't touched it for 20 seconds, it gets nudged.

### The formation
- Invaders and bricks share one grid of 16 × 12 px slots that marches as one block: left and right, dropping 8 px at each edge. It moves one step per beat of the music, and the beat speeds up as the formation thins. The four-note march is the bassline.
- Invaders shoot from the bottom of their columns and favour the one above you. Bullets come in three kinds: zigzag, plunger, and big bombs that blast craters in shields.
- **Invasion:** if the formation reaches the ground line you lose a ship and it is pushed back up.
- Clear a wave by destroying every invader. The remaining bricks then detonate in a cascade for a bonus, and BRICK SWEEP pays extra if you cleared them all yourself.

### Invaders
| Invader | HP | Points | Behaviour |
|---|---|---|---|
| GLOOP | 1 | 10 | a one-eyed goo blob that drips as it marches; the basic grunt |
| BUZZ | 1 | 20 | a shelled space beetle on six legs |
| PEEPER | 1 | 30 | a bat-winged eyeball; fires the fast plunger shot |
| TANK | 4 | 60 | armoured; drops bombs that crater shields |
| SPLITTER | 2 | 40 | splits into two MINIs (15 pts) that zigzag down and shoot |
| MIRROR | 2 | 50 | crystal: lasers bounce off it and come back at you, so only the ball hurts it |
| BUILDER | 2 | 50 | lays new bricks in empty slots around it and repairs damaged ones |
| DIVER | 2 | 50 (100 diving) | breaks formation Galaga-style, loops and swoops at you, shoots, and rejoins from the top. It kills on contact |
| CAPTOR | 3 | 150 (400 holding a ball) | dives to mid-screen and shines a tractor beam that captures balls. Shoot it to free the ball, which comes back as a bonus extra ball. If it takes your last ball, you get a new one free |

Multi-HP invaders shed pixels with every hit, so you can see how hurt they are.

### Bricks
| Brick | Behaviour |
|---|---|
| `#` brick | 1 hit, rainbow-coloured by row (Breakout!) |
| `=` silver | 3 hits, cracks as it weakens |
| `G` gold | only a fireball or a Nova bomb breaks it |
| `X` TNT | explodes and damages its eight neighbours. Chains! |
| `?` prize | always drops a capsule |

### Shields, asteroids, bosses: cell grids
Shields are little brick forts (battlements on top, a gateway underneath) in 22 × 16 grids of 1 px cells with mortar lines, eroded pixel by pixel by bullets, bombs and the ball. Asteroids (sector 3) are round grids of 2 px cells that drift across the middle of the screen, and they block shots in both directions. Bosses are big grids of 3 px cells: armour to dig through, steel that won't break, gun ports that shoot (break them to silence them) and a pulsing **core** that is the only thing that kills the boss. Bosses rebuild armour around the core over time, so you have to keep digging. A ball that breaks a boss cell cracks a neighbour a third of the time, so tunnels open up. Gun ports, every 22nd cell and each phase change drop capsules. At a quarter core health the boss hits **CORE EXPOSED!**: every hard and steel cell crumbles to 1-hit armour for the finish.

### Capsules (Arkanoid-style)
| Capsule | Effect |
|---|---|
| **L** LASER | 12 s of twin rapid-fire lasers |
| **E** EXPAND | 15 s of a wide paddle |
| **C** CATCH | 15 s of a sticky paddle (fire to release; it releases itself after 2.5 s) |
| **M** MULTI | every ball splits into three |
| **F** FIRE | 10 s fireball: smashes through invaders and bricks (gold too) and explodes |
| **S** SLOW | slows the ball right down |
| **B** BARRIER | an energy floor that saves the ball three times |
| **N** NOVA | +1 Nova bomb |
| **P** 1UP | extra ship (rare) |

Drops: prize bricks and the mystery ship always drop one, specials drop 12% of the time, everything else 6%. At most two capsules fall at once.

### Mystery ship
A delta-winged raider with a bubble cockpit. It crosses the top every 18–28 seconds with a warbling siren. It is worth 50–300 points (double with the ball) and always drops a capsule. As in the original, your 23rd laser shot, and every 15th after it, scores the full 300.

---

## Stages

24 stages per loop: five **sectors** of three waves and a boss, with a **challenge stage** after each of the first four bosses.

| Sector | Look | New threat | Boss |
|---|---|---|---|
| 1 LUNAR OUTPOST | grey moonscape, Earth rising, craters | the basics: shields, prize bricks, TNT, tanks | **KING KRABBO**: a giant crab of bricks with claw cannons, spread shots and summoned minis; faster in phase 2 |
| 2 NEON NEBULA | pink/purple nebula clouds | brick fortresses (silver, gold, TNT walls), splitters, builders | **THE SAUCERATOR**: a huge saucer with a spinning light ring; ring bursts, a telegraphed death beam, dashes, drops invaders |
| 3 ASTEROID ALLEY | tumbling 3D rocks | drifting asteroids as cover, mirrors, tank bombs | **ROCKJAW**: an asteroid skull whose steel jaw opens and shuts over its core; rockfall and bombs |
| 4 SYNTH CITY | synthwave sun and grid over Earth | divers and captors (Galaga) | **PHANTOM QUEEN**: a flagship with wings, a giant tractor beam, escorts of divers, aimed fans |
| 5 THE HIVE | inside the mothership: a tunnel of rings | everything at once, regenerating brick walls | **THE OVERMIND**: a brain in a brick skull. Phase 1: eye beams and builders repairing the skull. Phase 2: the skull cracks open, ring and spiral fire. Phase 3: desperation spirals |

**Challenge stages** (Galaga homage): five squadrons of eight invaders fly scripted loops across the screen without shooting. You have rapid twin lasers and a ball that respawns for free. Each hit scores 100, and all 40 is PERFECT!! for 10 000.

After the Overmind: an ending with brick fireworks and credits, then **LOOP 2**. Invaders are tougher and faster and shoot more, and the loop number shows on the HUD.

### Difficulty
- **CADET** (for younger players): 5 ships, slower bullets and march, fewer shooters, and a free one-save barrier at the start of every life.
- **ARCADE**: 3 ships, the real deal.
- Continues are unlimited: CONTINUE? counts down from 9. The score is kept, and continues used are shown on the high-score table.

---

## Scoring and juice
- Hit-stop on kills, screen shake scaled to the blast, camera roll, white/red/gold flashes, chromatic aberration, a shockwave ring per explosion, sparks, and debris that flies at the glass.
- Raster score popups, CHAIN ×N callouts, and big banners: READY!, WAVE CLEAR, WARNING!!, PERFECT!!, EXTRA SHIP!, INVASION!, BALL CAPTURED!
- End-of-wave tally: wave bonus, no-miss bonus, brick sweep and time bonus, counted up with a ticking sound.

---

## Attract mode and screens
Title (the logo is made of bricks that fly in and assemble, and a ghost ball knocks bricks out of it) → MEET THE ARMADA (every invader with its points) → CAPSULE TABLE → HIGH SCORES → DEMO PLAY (the bot plays a random early stage) → title… Press start: a coin drop, then a raster menu (START, DIFFICULTY, START SECTOR once reached, SOUND, CRT). Pause has RESUME / SOUND / CRT / QUIT. Game over → CONTINUE? 9…0 → name entry (three initials) if you made the table → title.

---

## Sound (Web Audio, all generated)
- **Music is driven by the march.** The sim owns a beat clock (one beat = one formation step = one eighth note) and emits `beat` events stamped with sim time; the audio maps them onto the AudioContext clock with a fixed latency, so notes land sample-accurate. Each beat plays the four-note march bassline (shifted to the sector's chord), drums, and a per-sector pulse-wave lead through a delay. As the formation thins, the whole song speeds up.
- Bosses, challenge stages, the title and the ending have their own fixed-tempo songs on the same machinery.
- Sound effects: paddle blip (pitched by where it hit), wall tick, brick notes up a pentatonic scale with the chain, silver clink, gold clank, invader crunch and death sweep, laser pew, enemy shot, big and TNT explosions, player death, capsule arpeggios, 1UP jingle, mystery-ship siren loop, tractor beam warble, Nova bomb whoosh and boom, boss siren, coin drop, menu blips, tally ticks, fanfares. A per-sound rate limiter and a compressor keep chain reactions from clipping.

---

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | boot, the fixed 120 Hz loop, the mode machine (attract, menu, play, pause, continue, name entry, ending), debug hooks |
| `js/config.js` | field size, tunables, difficulty tables |
| `js/rng.js` | seeded PRNG (mulberry32) |
| `js/sim/world.js` | the game: paddle, balls, shots, bullets, formation, divers, captors, minis, grids, boss, UFO, capsules, scoring, beat clock. Pure: no three.js, no DOM. Emits events for the view and audio |
| `js/sim/grid.js` | cell-grid objects (shields, asteroids, bosses): collision, erosion, regeneration |
| `js/sim/levels.js` | sectors, formations (ASCII), challenge paths, stage list |
| `js/sim/bosses.js` | boss grids (ASCII), cell types, attack patterns, phases |
| `js/sim/bot.js` | the AI pilot for demo mode and tests |
| `js/art/sprites.js` | every bitmap: invaders (two frames), paddle, ball, bullets, capsules, UFO; palettes |
| `js/art/font.js` | 5 × 7 pixel font, text measuring and drawing |
| `js/view/renderer.js` | three.js renderer, low-res target, bloom, CRT pass, shake, flashes |
| `js/view/voxels.js` | the voxel shader and the per-frame instance builder (sim → pixels), the wave assembly effect |
| `js/view/fx.js` | debris cubes, sparks, shockwave rings, explosion bursts |
| `js/view/backdrops.js` | starfield and the five sector backdrops |
| `js/view/hud.js` | the raster HUD, popups, banners and every menu screen (2D canvas → texture) |
| `js/audio.js` | synthesis, sound effects, beat-driven music |
| `js/input.js` | keyboard, mouse, touch (screen and deck) and gamepad merged into one input frame |
| `js/ui.js` | DOM layout: fitting the screen, cabinet side art, touch deck |
| `js/save.js` | high scores and settings in localStorage (guarded) |

## Testing
See [dev/README.md](dev/README.md). `simtest.mjs` has the bot clear every stage of both loops headlessly in Node and checks invariants. `browsertest.mjs` drives the real game in Chromium on desktop and touch-only phones.

## Open questions / next steps
- Balance is bot-tested; a human pass on a real phone would tune the march speed and bullet rates further.
- A two-player alternating mode (1UP / 2UP) would complete the cabinet fantasy.

## Art direction note

The game is an homage to the genre, not a copy of any one game: every alien, the mystery ship and the shields are original designs. The three basic grunts (GLOOP, BUZZ, PEEPER) replaced earlier sprites that were too close to the classic Space Invaders octopus, crab and squid.

## Changelog

### v1.0.0 (2026-10-05)
- First release: five sectors, 15 waves, five bosses, four challenge stages, nine invader types, five brick types, nine capsules, attract mode, high scores with initials, CADET and ARCADE difficulties, endless loops, touch deck.
