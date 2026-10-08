# BRICKVADERS: Breakout Meets Space Invaders in a 1983 Cabinet

*By Andrew Wooldridge*

Game 060 in the collection is [BRICKVADERS](https://triptych.github.io/web-games-andrew/game-060/). The idea is simple: what if the aliens in Space Invaders were made of bricks, and your laser base was also a Breakout paddle?

It's 1983 and the **Brick Armada** is coming, an invasion fleet of aliens built out of living bricks, marching down on Earth in formation. Earth's last defence is the **STRIKER**, a ship that is half Breakout bat and half laser base. You bounce a plasma ball up into the formation to smash invaders and their brick armour, fire lasers between bounces, catch the capsules that fall out, and try to stop the Armada before it lands.

Like every game here, it uses no asset files. Every sprite, letter, explosion, backdrop and note of music is made in code. It's built with three.js and plays on a phone as well as on a desktop.

---

## A cabinet in a dark arcade

The goal was for it to feel like a vertical monitor glowing in the corner of an arcade in 1983. The whole game is drawn into a **240 × 320 render target**, the shape of a vertical arcade screen, then scaled up with nearest-neighbour sampling so the pixels stay chunky. On the way to your screen it goes through phosphor persistence (moving things leave a faint trail, like an old tube), bloom, and a CRT pass with curvature, scanlines, an aperture grille, a vignette and a little chromatic aberration. You can switch the CRT off if you prefer clean pixels.

The fun part is that **every pixel is a real 3D cube**. Invaders, bricks, the paddle, bullets, capsules, even the letters in the logo are instances of one `InstancedMesh` of boxes, lined up exactly on the 240 × 320 grid. The camera sits far back with a narrow field of view, so the flat playfield matches the pixel grid exactly, but anything with depth really is 3D.

That gives the game its look:

- When you hit an invader, pixels **break off and tumble toward the glass** as cubes, growing in perspective. Killing it bursts the rest.
- Each wave starts with the Armada's pixels flying in from all over the screen and **snapping into formation**.
- Bigger boxes get a one-pixel bevel in the shader, so bricks look like bricks while single pixels stay flat.
- Screen shakes roll the camera slightly, so for a moment you can see the sides of the voxels.

Behind the playfield, each of the five sectors has its own dim 3D backdrop: a lunar surface with Earth rising, a neon nebula, an asteroid belt, a synthwave sun over a grid, and finally the inside of the mothership. Even the HUD and menus are drawn in a hand-made 5 × 7 pixel font into the same low-res screen, so they glow and scanline like everything else.

## The march is the music

My favourite detail is the sound. In Space Invaders the march speeds up as the aliens thin out. BRICKVADERS takes that literally: **one beat of the music is one step of the formation**. The simulation owns a beat clock and sends out timestamped `beat` events, and the Web Audio code schedules notes against the audio clock so they land sample-accurately.

Each beat plays the four-note march bassline, shifted into the current sector's chord, along with drums and a pulse-wave lead through a delay. Clear out the formation and the whole song speeds up with it. Brick hits play a rising pentatonic run, so a long chain of ball hits sounds like one melody.

Bosses, challenge stages, the title screen and the ending have their own songs on the same machinery, and there's a full set of generated sound effects, from the paddle blip (pitched by where the ball lands) to the warbling mystery-ship siren.

## How it plays

The ball bounces Arkanoid-style: the angle depends on where it hits the paddle, and it speeds up a little with each hit. Your laser works like the original Space Invaders cannon, with one shot on screen at a time. Every hit the ball makes before it comes back to the paddle adds to your **chain**, and every five links add ×1 to your score multiplier, up to ×5.

The formation marches left and right and drops at each edge, the way you'd expect. If it reaches the ground, you lose a ship and it gets pushed back up. Mixed in with the invaders are bricks: rainbow bricks (it's Breakout, after all), silver bricks that crack, gold bricks only a fireball can break, TNT bricks that chain-react, and prize bricks that always drop a capsule.

There are **nine kinds of invader**, and the later ones change how you play:

- **MIRROR** is made of crystal, so your lasers bounce off it and come back at you. Only the ball hurts it.
- **BUILDER** lays new bricks in empty slots around it and repairs damaged ones.
- **DIVER** breaks formation Galaga-style, loops down at you, and rejoins from the top.
- **CAPTOR** dives to mid-screen and shines a tractor beam that steals your ball. Shoot it to free the ball, which comes back as a bonus extra ball.

Capsules work the way Arkanoid fans will expect: Laser, Expand, Catch, Multi-ball, Fireball, Slow, Barrier, Nova bomb and the rare 1UP. The Nova bomb wipes every enemy bullet off the screen and blasts everything. There's also a mystery ship that crosses the top of the screen, and yes, the old trick still works: your 23rd laser shot always scores the full 300.

## Five sectors, five brick bosses

A loop is 24 stages: five sectors of three waves and a boss, with a challenge stage after the first four bosses.

| Sector | Boss |
|---|---|
| 1 · Lunar Outpost | **King Krabbo**, a giant crab of bricks with claw cannons |
| 2 · Neon Nebula | **The Saucerator**, a huge saucer with a spinning light ring and a death beam |
| 3 · Asteroid Alley | **Rockjaw**, an asteroid skull whose steel jaw opens and shuts over its core |
| 4 · Synth City | **Phantom Queen**, a flagship with a giant tractor beam and diver escorts |
| 5 · The Hive | **The Overmind**, a brain in a brick skull, in three phases |

The bosses are big grids of cells, and you have to **dig through them**. There's armour to break, steel that won't break, gun ports that shoot until you knock them out, and a pulsing core that is the only thing that can kill the boss. Bosses rebuild armour around the core over time, so you have to keep at it. Breaking a cell sometimes cracks its neighbour, so tunnels open up. At a quarter of the core's health the boss hits **CORE EXPOSED!** and its hard armour crumbles for the finish.

The **challenge stages** are a nod to Galaga: five squadrons of eight invaders fly scripted loops without shooting back. You get rapid twin lasers and a ball that respawns for free. Hit all 40 for a PERFECT!! and 10,000 points.

Beat the Overmind and you get brick fireworks and credits, then Loop 2, where everything is tougher and faster, and it keeps going from there.

## The arcade extras

I wanted the full cabinet experience, not just the game:

- An **attract mode** that cycles title → "Meet the Armada" → capsule table → high scores → a demo where the bot plays an early stage. The logo is made of bricks that fly in and assemble, then a ghost ball knocks bricks out of it.
- A coin-drop sound when you press start.
- A high-score table with **three-letter initials**.
- A CONTINUE? countdown from 9. Continues are unlimited, and the table records how many you used.
- **CADET** mode for younger players (five ships, slower bullets, a free barrier every life) and **ARCADE** mode for the real thing.

## On a phone

On a phone, the screen sits on top and an **arcade control panel** fills the space underneath: a ridged spinner pad you drag across, a big red FIRE button and a yellow BOMB button. Turn the phone sideways and the pad moves to the left with the buttons on the right. Dragging moves the paddle relative to where your finger started, so your finger never covers it. It also works with a keyboard, a mouse or a gamepad.

## Tested by a bot

As with the other recent games, the `dev/` folder has its own test harnesses:

- `simtest.mjs` has the AI pilot **clear every stage of two full loops** headlessly in Node, on both difficulties, in about ten seconds. It fails on any exception, any NaN, or a ball that escapes the field.
- `browsertest.mjs` drives the real game in Chromium: the attract mode, menus, a game over and initials entry, all 24 stages, the ending and Loop 2, then touch-only phones in portrait and landscape. It fails on any console error.

The same bot that runs the tests also plays the demo in the attract mode. The whole game is about 5,500 lines of plain JavaScript modules with no build step.

## A note on the art

BRICKVADERS is a tribute to the genre, not a copy of any one game. Every alien, the mystery ship and the shields are original designs. The three basic grunts (GLOOP, a one-eyed goo blob; BUZZ, a shelled space beetle; and PEEPER, a bat-winged eyeball) replaced earlier sprites that looked too much like the classic octopus, crab and squid.

## Play it

[Play BRICKVADERS](https://triptych.github.io/web-games-andrew/game-060/), or find its statue in the [Garden of Games](https://triptych.github.io/web-games-andrew/) with the rest of the collection. If you want to see how it's built, the [design doc](https://github.com/triptych/web-games-andrew/blob/main/game-060/game-plan.md) covers everything from the voxel shader to the boss phases.

Insert coin. Have fun!
