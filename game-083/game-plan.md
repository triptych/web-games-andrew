# WYRMZONE

**Genre:** First-person vector arcade shooter: Battlezone on foot, then Star Wars on the wing
**Engine:** three.js r165, no asset files: everything is drawn as beams of light by one instanced shader
**Status:** v1.1.0

---

## Concept

You are a lone dragon who has lost the power of flight, trying to get home through a kingdom at war with dragons. Warriors, wizards, monsters and war machines stand in the way.

The Kingdom of Varn has warred on dragons for a hundred years. Its wizards bound your wings with an iron ward and left you in the lowlands. Your home is the smoking volcano on the horizon. Act I is Atari's *Battlezone* (1980) with the tank swapped for a dragon on foot: a green vector world seen through the dragon's eyes, a radar with a sweep, "ENEMY IN RANGE", standing stones to hide behind, things coming at you from every side. Halfway, you break the engine that holds the ward, the camera rises off the plain, and Act II is Atari's *Star Wars* (1983): coloured vectors, a targeting cross that fire converges on, griffon knights in place of TIE fighters, mage towers in place of the Death Star's laser towers, and a gorge run to a ward stone in place of the trench and its exhaust port.

The tone is the arcade cabinet: terse banners in a stroke font, phosphor trails, a curved glass screen, a score and a high score. The story is told in the banners and the How to Play sheet.

## Core loop

One game is the road home, about five minutes for a good player:

1. **Four marches on foot.** Each has a quota of foes to destroy (7, 9, 11, 12). Up to two to four are on the field at once, spawned around the dragon (the first of each march in front of it). Clearing a march gives a bonus and regrows a scale.
2. **The Dragonbane.** A siege tower on wheels with a giant crossbow turret: volleys of three bolts (five when it is half broken), footmen summoned from its doors, a body that crushes. 18 hit points.
3. **The ascent.** The camera rises off the plain into the stars over six seconds; the scales grow back. "THE IRON WARD BREAKS · YOUR WINGS REMEMBER THE SKY".
4. **The Open Sky.** Bring down 20 griffon knights. They swoop in, hold station weaving, throw firebolts, then dive past the dragon and wheel round.
5. **The Ramparts.** Fly low over the castle grounds for 1800 units; mage towers throw firebolts; shoot the crystal atop each one. Burning every tower is a 10,000 bonus.
6. **The Gorge of Chains.** A trench run 2000 units long. Chain bridges cross it high, low or in the middle (climb or dive), wall ballistae fire from the sides, and the ward stone stands on the gate at its end. Miss it and the ward throws you back down the gorge for a scale.
7. **Home.** A bonus for every scale left (5,000 × cycle). Then "Fly the Kingdom Again": a second cycle, 30% fiercer, keeping the score, endlessly.

Lose every scale and the dragon falls. Continue retries the stage with full scales and the score it started with.

## Mechanics

### On foot (Act I)
- Tank controls. Forward/back walks at 10 / 6 u/s; left/right turns at 1.6 rad/s. Heading 0 faces −z, and heading grows turning right.
- Fireballs fly straight at 78 u/s for 96 units, at most **two** in the air (Battlezone allowed one shell), 0.42 s apart. Standing stones, cairns, ruins, pines and barrows block them, and block the dragon and every walker.
- The plain is endless: at most one obstacle per 26-unit cell, placed by hashing the cell with the seed (40% of cells). Nothing about it is stored.
- A missile that reaches the dragon costs one scale; then 1.3 s of grace. Six scales.
- The radar (radius 90) shows every foe; a sweep brightens each blip as it passes. "ENEMY IN RANGE" when the nearest foe is in view and within 72; otherwise "ENEMY TO LEFT / RIGHT / REAR". The gunsight closes when a foe is in the line of fire.

### On the wing (Act II)
- The dragon flies along +z at 42 u/s. The cursor (ax, ay in [−1, 1]) aims ±0.46 rad sideways and ±0.32 rad up and down. Keys push the cursor (it drifts home when let go); a touch stick, a gamepad stick or the mouse place it, and the stick springs it home.
- The body drifts toward the cursor: x = ax · latX, y = base + ay · latY, per track (sky 18 / 0 / 9, ramparts 26 / 12 / 8.5, gorge 6.5 / 10 / 7.5). Aiming is steering, as in Star Wars.
- Fire leaves the snout every 0.15 s at 280 u/s and passes through the point 70 units out under the cursor. Hits are swept segment tests, so nothing tunnels.
- Firebolts are aimed in the dragon's frame and home a little (0.5 rad/s); every one can be shot down for 50.

### Rules both acts share
- `G.phase`: intro (2.6 s banner) → play → clear (2.6 s) → the next stage; the boss's clear leads to `ascend` (6.5 s); a dragon with no scales is `dead` for 2.4 s, then the game is over.
- Each cycle multiplies enemy speed and fire rate by 1 + 0.3 × cycle; from the second cycle missiles lead the target.

## Content

### Act I foes (Battlezone's tanks, super tanks, missiles and saucer)
| Foe | HP | Score | Attack | Riffs on |
|---|---|---|---|---|
| Footman | 1 | 100 | Walks to 21, throws spears (17 u/s) | Battlezone's slow tank |
| Ballista | 1 | 1000 | Turns to face you, drives to range, alternates aiming and strafing, bolts at 30 u/s | the tank |
| Lancer | 1 | 2000 | Charges at 15 u/s in a zig-zag; spent on contact | the guided missile |
| Wizard | 1 | 1500 | Teleports every 5.5–8 s; casts homing orbs you can shoot down | — |
| Troll | 3 | 1200 | Lumbers in and smashes, knocked back 4 units each time | — |
| War wagon | 2 | 3000 | A fast ballista with a ram, fires bolts in pairs | the super tank |
| Will-o-wisp | 1 | 5000 | Harmless; drifts and vanishes after 15 s; appears every 40–70 s | the saucer |
| The Dragonbane | 18 (+4/cycle) | 20000 | Volleys, summons, crushes | — |

### Act II foes (Star Wars' TIE fighters, towers, trench turrets and exhaust port)
| Foe | HP | Score | Where |
|---|---|---|---|
| Griffon knight | 1 | 1000 | The Open Sky; up to five at once |
| Mage tower (crystal) | 1 | 500 | The Ramparts; every seventh is a Great Spire (3 HP, 1500, fires faster) |
| Wall ballista | 1 | 250 | The Gorge, on both walls |
| Ward stone | 1 | 25000 | The gate at the end of the gorge |

Numbers live in [js/config.js](js/config.js) and [js/sim/data.js](js/sim/data.js).

## Story

- **Title:** a wingless dragon's road home.
- **Marches:** "THE KING'S PATROLS HUNT THE WINGLESS", "KNIGHTS RIDE OUT TO MEET YOU", "THE ORDER OF THE IRON WARD CASTS ITS NETS", "THE WAR ENGINES ROLL".
- **The Dragonbane:** "THE ENGINE THAT BOUND YOUR WINGS". When it falls: "THE IRON WARD BREAKS · YOUR WINGS REMEMBER THE SKY".
- **Flight:** "THE GRIFFON KNIGHTS RISE TO MEET YOU", "BURN THE MAGE TOWERS", "SHATTER THE WARD STONE AT ITS END".
- **Ending:** the ward stone shatters and the kingdom's barrier breaks; beyond the mountains the volcano of your homeland smoulders, and you fly home. The game then offers endless further cycles for score.

## Controls

| Action | Keyboard | Mouse | Gamepad | Touch |
|---|---|---|---|---|
| Walk / turn (on foot) | ↑↓ / WS, ←→ / AD | Click the view to capture it; moving it turns | Stick / d-pad | Drag on the left side |
| Aim (in flight) | Arrows / WASD push the cross | Captured, moving it steers the cross; free, the cross sits under the pointer | Stick places the cross | Drag on the left side places it |
| Fire (hold for more) | Space / Z / J / F / Ctrl | Left button | A / RB / RT | FIRE |
| Pause | P / Esc | ❚❚; letting go of a captured mouse (Esc) pauses | Start | ❚❚ |

Settings: sound, music, CRT glass and phosphor trails, mouse look speed, invert flight up/down, touch controls (auto / always / never), delete the save.

## Look and sound

- **One primitive.** [js/view/beams.js](js/view/beams.js) (from game-070) draws every line: an instanced quad per segment, shaded by distance to the segment, a white-hot core in a coloured glow, additive. This version clips each segment against the near plane in the vertex shader (the camera walks *through* the world, so segments pass beside and behind it), keeps widths constant on screen as a vector monitor does, and fades segments out toward a far distance. A second instance (`sky`) never fades, for the horizon, moon and stars; a third, in HUD units, draws the HUD.
- **The monitor** ([js/view/renderer.js](js/view/renderer.js)): phosphor persistence, two-size bloom, curved glass, vignette, a faint reflection.
- **The periscope.** On a portrait phone the world is drawn through a 1.2 : 1 slot with the HUD above and the touch deck below, framed like Battlezone's viewer; on a landscape screen the band is the whole screen. The HUD is laid out in units where the shorter side is 300.
- **Act I** is Battlezone green with a red radar and red text: a jagged mountain ridge all round, the volcano of home dead ahead at the start (it smokes), the king's castle on a hill, a crescent moon, specks on the ground for speed, the dragon's snout at the bottom of the view breathing fire. Destroyed foes fly apart into their own lines and bounce. The last scale cracks the glass.
- **Act II** is Star Wars colour: blue speed streaks and stars, gold griffons, red towers with yellow crystals, a blue grid over the ramparts, the gorge's blue walls streaming past with yellow chain bridges, magenta ward stone; firebolts are spinning stars of fire. The dragon's wings beat at the edges of the view.
- **Sound** (all Web Audio, [js/audio.js](js/audio.js)): heavy footfalls on a sweep of the gait, Battlezone's radar ping once a sweep, a low wind; on the wing, rushing air and wingbeats. Fire is a roar of filtered noise and a growl; ballistae twang, orbs shimmer, firebolts hiss. A look-ahead sequencer plays a slow war march on foot, a harder theme for the Dragonbane, a fast heroic theme in the air, a rising chord for the ascent and a fanfare for home.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title with attract demo, play, over), the fixed-step loop, input routing, debug hooks |
| `js/sim/game.js` | `newGame`, `step`, stage flow, `continueGame`, `nextCycle`, save format |
| `js/sim/ground.js` | Act I: walking, fireballs, the six foes, the wisp, the Dragonbane, spawning, the quota |
| `js/sim/flight.js` | Act II: the cursor and body, fire, griffons, towers, the gorge's chains and turrets, the ward stone |
| `js/sim/world.js` | The endless plain's obstacles, hashed from the seed |
| `js/sim/common.js`, `util.js`, `data.js` | Hurt, damage and kill; angles and segment tests; the tables |
| `js/sim/bot.js` | The auto-player for tests, balance and the attract demo |
| `js/view/view.js` | Cameras, the horizon and stars, the plain, the ramparts and gorge, every enemy, effects for events |
| `js/view/hud.js` | Radar, gunsight, targeting cross, wings, snout, scales, banners, cracks |
| `js/view/beams.js`, `renderer.js`, `models.js`, `fx.js` | The beam primitive, the monitor, wireframe models, explosions |
| `js/art/font.js` | The stroke font (from game-070) |
| `js/ui.js`, `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | DOM screens and deck, input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the plain, every rule of both acts, determinism and save round trips, and has the bot play whole games. `browsertest.mjs` drives the real game on desktop (keys, mouse, menus, the ascent, the ending), on touch-only phones in both orientations and with storage blocked.

## Balance notes

The bot plays whole games (`ONLY=bot node game-083/dev/simtest.mjs`):

| Skill | Gets home | Avg score | Avg hits | Avg time |
|---|---|---|---|---|
| 1 (perfect) | 5 / 6 | ~241,000 | 4 | 260 s |
| 0.6 | 4 / 6 | ~188,000 | 9 | 241 s |

- The first pass had the bot clearing each march in 25 s untouched and flying all of Act II without a hit. Quotas went up (6/8/10/10 → 7/9/11/12), the Dragonbane went from 16 to 18 HP, griffons fire every 1.9–3.4 s instead of 2.8–4.6 s and from further out, towers and wall ballistae fire more often, and firebolts got faster and home a little more.
- A skill-0.3 bot dies in marches 3–4: the bolts of a ballista you aren't watching are what kill it, which is the radar's job to warn of.
- The bot shoots down nearly every firebolt in flight; a person will not, so Act II is harder for people than the table says.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- High-score initials, as the cabinets had.
- A two-speed walk (Battlezone's treads let you turn on the spot faster than you could walk).

## Changelog

### v1.1.0 (2026-10-16)
- Mouse look. A click on the view captures the mouse (Pointer Lock): on foot, moving it sideways turns the dragon (handed to the sim as `turn`, an angle, kept until a step uses it and capped at 0.6 rad a step); in flight, moving it steers the targeting cross from where it is. The left button fires. Letting the mouse go (Esc) pauses. A hint at the bottom offers it while the mouse is free, and a Mouse look speed setting scales it. Where the browser refuses the lock (a sandboxed frame), the free pointer's own movement looks instead.

### v1.0.1 (2026-10-16)
- Fixed: the game-over sheet's **Title** button did nothing, by mouse, touch or keyboard. It shared the id `over-title` with the sheet's heading, so `getElementById` returned the heading and the handler went there. The button is now `over-to-title`; `dev/browsertest.mjs` checks every id in the page is unique and leaves the game-over sheet by Title with a real mouse click and with Down, Enter.

### v1.0.0 (2026-10-16)
- First release: four marches on foot and the Dragonbane in Battlezone style; the ascent; the Open Sky, the Ramparts and the Gorge of Chains in Star Wars style; the homecoming and endless cycles.
- Beams with near-plane clipping, a periscope band for portrait phones, phosphor and CRT glass; jagged mountains, the volcano of home, the king's castle and a crescent moon on the horizon.
- Keyboard, mouse aiming, gamepad and a touch deck that walks on foot and aims in the air.
- Procedural sound and a look-ahead score; saves, continues and a best score.
- `dev/simtest.mjs`, `dev/browsertest.mjs`, `dev/play.mjs`.
