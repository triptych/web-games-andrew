# Kaboom Keep

**Genre:** casual physics cannon game (third person; castle demolition)
**Engine:** three.js r165, sim/view layout. A 3D rigid-body engine written for the game. Art by fal (`nano-banana-2`), music, effects and voices by ElevenLabs; every model is code, and a Web Audio synth stands in for any sound that fails to load.
**Status:** v1.1.0

---

## Concept

A physics shooting game where you blast whimsical castles, towers and buildings with various cannonballs. You stand behind a chunky bronze cannon on a grassy hill; across the meadow stand toy-block castles with pink and blue cone roofs, and on their battlements stand little round-faced knights, a pompous prince, a sleepy wizard and King Bumble. Aim, fire, watch the ball fly, and enjoy the castle coming apart block by block.

It is about **the joy of breaking down complex assemblies of blocks**: every block is a real rigid body, so walls topple, floors drop, towers lean and crash, stone cracks, wood splinters, ice shatters and crates go off in chains. The tone is a toy box: bright, round, silly, never violent (people are "bonked", see stars and go *poof*). It riffs on slingshot-at-a-structure puzzle games and on toy-block demolition, in third person and in 3D.

## Core loop

One castle: read the intro card (who lives there, what is in the rack) → aim (drag, keys, stick; a dotted arc shows where the ball lands) → pick a ball → fire → the camera rides the ball in, watches the landing, comes back → repeat until everyone is bonked (won: stars, spare-ball bonus, next castle) or the rack is empty (lost: try again). A castle takes one to three minutes.

## State, input, events (the sim contract)

**State `G`** (plain data; a save is `serialize(G)`, JSON):
`level`, `W` (the physics world: `bodies`, the contact `cache`, `nextId`), `state` (`aim` → `clearing` → `won`, or `lost`), `stateT`, `aim {yaw, pitch}`, `reload`, `ammo {kind: count}`, `sel`, `score`, `shots`, `targets`, `bonked`, `stats {broken, knocked, booms, total}`, `follow` (the ball the camera follows), `lastShot`, `fuses` (crates about to go off), `flags` (decor riding a block id), `over`, `won`, `stars`, `rngState`. Bodies carry `kind` (`block`, `rock`, `char`, `ball`) and game fields (`mat`, `dmg`, `s0`, `knocked`, `role`, `bonked`, `ammo`, `live`, `tricked`). Everything refers to bodies by id.

**Input** (one per fixed step; the bot and the tests use the same): `{ x, y, a, aim, ammo }`: aim rates from keys or a stick, a direct aim from a drag, a ball to load, and `a`, a fire press that is also the in-flight trick.

**Events:** `fire`, `select`, `impact` (a ball's first touch), `hit` (the strongest contacts of a step), `break`, `boom`, `split`, `bonk`, `poof`, `allbonked`, `over`.

## Mechanics

### Physics ([js/sim/physics.js](js/sim/physics.js))
- Boxes and spheres on an infinite ground plane (y = 0); static boxes for cliffs. Fixed step 1/60 s, gravity 11.
- Box-box contact by the separating axis test over 15 axes (face axes preferred within a tolerance, so the reference face does not flip), the incident face clipped against the reference face's side planes, at most 4 points. Sphere-box, sphere-sphere, box-ground and sphere-ground directly.
- Sequential impulses, 10 iterations, friction on two tangents inside the Coulomb cone, warm-started from the previous step through a cache matched by contact position in body A's frame (saved with the game, so a save round trip is exact).
- **Speculative contacts:** contacts are made up to 12 mm apart, and a gap may close in one step (bias = gap/dt). Without that, a stack hovers on millimetres of air and rocks.
- **Shock propagation, lite:** in a mostly vertical contact between two moving bodies, the lower one answers with its inverse mass scaled by 0.3. A 12-slab column settles in a few steps instead of rocking itself apart while the solver converges.
- **Sleeping by island:** a body sleeps only when everything it touches is still too; a sleeper is static to the solver until something moving touches it, a neighbour breaks or a blast reaches it. Castles are built asleep.
- **Swept spheres:** a fast ball is marched in steps of half its radius and bisected back to the last free spot before a true overlap, so it can't tunnel through a wall. (The first version swept against boxes grown by the radius; that box is fatter than the real shape at its corners, and a grazing ball froze in mid-air, never touching. The simtest checks both.)

### Damage, breaking, bonking ([js/sim/game.js](js/sim/game.js))
- Each step, every touching pair's total normal impulse `j` gives each body a velocity change `j / m` (× the ball's punch). Above the material's threshold it adds damage; at `hp` the block breaks.
- A broken block splits in two across its longest side (pieces start with 55% hp and count as knocked); below 11 cm or past 520 bodies it turns to dust. Ice shatters to nothing. A crate's fuse lights for 0.12 s, then it explodes: neighbours get an impulse at their closest point and damage that falls off with distance, so crates set each other off in chains.
- Removing a body wakes everything within reach, so nothing is left floating.
- A block first knocked 1.2 m from where it was built scores half its value.
- A character is bonked when its up axis tips below 60°, when it takes `hp` of damage, or when it lands 2 m below where it stood; it sees stars for 1.4 s and goes poof.
- Won: the last bonk starts a 1.6 s beat, then +1000 per spare ball and stars. Lost: no balls left, none in flight, no fuse burning, and the castle still (or 5 s since the last shot).

### Aiming ([js/sim/aim.js](js/sim/aim.js))
- Yaw ±0.62 rad, pitch −0.08 to 1.25 rad. `predict()` integrates exactly like the physics step (same gravity, damping and step) and ray-tests every body grown by the ball's radius, so the dotted arc lands where the ball lands (simtest: within 0.6 m).
- `solveAim()` gives the low and high arcs to a point; the bot refines them with `predict()`.

## Content

### Cannonballs ([js/config.js](js/config.js))
| Ball | Radius | Speed | Trick (tap in flight) |
|---|---|---|---|
| Iron Ball | 0.30 | 30 | — |
| Boom Ball | 0.34 | 28 | explodes on contact (radius 3.8); tap to go off early |
| Triple Trouble | 0.25 | 31 | split into three, ±0.085 rad |
| Big Bertha | 0.62 | 23 | — (huge and heavy) |
| Boing Ball | 0.34 | 30 | — (restitution 0.86: ricochets) |

### Materials
| Material | Threshold (m/s) | hp | Points | Note |
|---|---|---|---|---|
| stone | 3.0 | 9 | 10 | the walls |
| brick | 3.0 | 7 | 10 | warmer walls |
| wood | 2.2 | 6 | 15 | floors, forts |
| ice | 1.6 | 2.5 | 25 | shatters |
| roof | 2.5 | 6 | 20 | carries a cone roof |
| tnt | 1.8 | 2 | 50 | explodes (radius 3.4) |
| rock | — | — | — | static cliffs |

### People
| Role | Size (m) | Points | Voice |
|---|---|---|---|
| knight | 0.4 × 0.68 × 0.36 | 500 | Álfwyn (squeaky, nervous) |
| king (and the prince) | 0.52 × 0.84 × 0.44 | 1500 | Grampa Werthers (cranky) |
| wizard | 0.4 × 0.84 × 0.36 | 800 | Potato (earthy, wrinkled) |

### Castles ([js/sim/levels.js](js/sim/levels.js), [js/sim/castlegen.js](js/sim/castlegen.js))

**48 castles, 12 per region** (Greenmeadow, Frostpeak, Sunset Shire, Moonbeam Marsh). In the first three regions the hand-made castles below sit at positions 1, 4, 8 and 12; the generator fills the rest, and all of Moonbeam Marsh. Difficulty (the generator's tier) climbs from 0.06 to 1 across the 48; the last marsh castle is tier 1.

**The generator** lays a row of modules across the meadow (square towers 2 or 3 wide, round towers, walls in running bond, a keep with a floor on columns inside, a spire, a crate shelf, a colonnade), sometimes a big keep behind and a cliff underneath, then wooden bridges between neighbouring towers whose plain tops are level. Rules that each came from a castle that fell over on its own:
- every module reports its **perches** (surfaces it built); people are only seated on perches, and each seat is checked against the real parts (a bridge landing on a tower top, a crenel, a roof);
- a wall at either end becomes a tower and steps 0.3 m outward, because its neighbour sits flush and a round tower or a spire's slab pokes 0.2 m past its footprint; the crate shelf's plank is exactly its footprint;
- a **block budget** (340 before the next module) keeps a castle under about 520 bodies, the most a phone should have to collapse;
- the rack always holds one ball more than there are people (added without a random draw, so it never changes the castle); star lines come from what there is to win (`starLines()` in game.js).
Names ("The Wobblewick Bastion"), the knights' names and the intro line are drawn from the same seed.

**Endless Siege** opens once the first twelve castles are cleared: castle *n* of a run is generated with tier 0.22 + 0.06 *n* (capped at 1), cycling through the four regions; the run's total score carries over, and the best run (castles cleared, then score) is kept.

The hand-made twelve:

| # | Castle | Region | Rack | Idea |
|---|---|---|---|---|
| 1 | The Wobbly Watchtower | Greenmeadow | 4 iron | one tower, one knight: learn to aim |
| 2 | Sir Grumble's Gatehouse | Greenmeadow | 3 iron, 1 boom | two roofed towers and a wall walk |
| 3 | The Timber Fort | Greenmeadow | 2 iron, boom, triple | wood towers, crates inside |
| 4 | The Twin Towers of Toot | Greenmeadow | 2 iron, triple, bertha, boom | round towers and a bridge |
| 5 | Icicle Keep | Frostpeak | 3 iron, triple | ice upper walls, a knight inside on columns |
| 6 | Snowcap Citadel | Frostpeak | 2 iron, 2 boom, boing | a round citadel with ice bands |
| 7 | The Wizard's Spire | Frostpeak | 3 iron, bertha | a 10 m spire, the wizard in a gazebo on top |
| 8 | Frostbite Bastion | Frostpeak | 2 iron, 2 boom, triple, boing | knights in a walled courtyard: lob |
| 9 | Bertha's Bluff | Sunset Shire | 2 bertha, 2 iron, boom | a castle on a static cliff |
| 10 | The TNT Treasury | Sunset Shire | 2 iron, triple | a shelf of crates under the knights |
| 11 | Palace of Prince Pompous | Sunset Shire | 3 iron, 2 boom, triple, bertha | a keep and four round towers |
| 12 | King Bumble's Grand Castle | Sunset Shire | 3 iron, 2 boom, triple, bertha, boing | the finale: 520 bodies |

A castle opens when the one before has a star.

Moonbeam Marsh is lit by the moon (a dim blue hemisphere, a pale blue "sun" at 1.5, exposure 1.15), so fire and flashes glow.

## Controls

| Action | Keyboard | Gamepad | Mouse / touch |
|---|---|---|---|
| Aim | Arrows / WASD | stick / d-pad | drag anywhere on the view |
| Fire / trick | Space / Z | A | tap the view, or FIRE |
| Pick a ball | 1–5, Q / E | LB / RB | tap the rack |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

- Bright toy-box palette; ACES tone mapping, one shadowed sun, a painted sky panorama wrapped (mirrored) round a cylinder, a tiled painted ground per region, code trees.
- Blocks: one InstancedMesh per material; the shader samples the fal texture in the block's own frame (it tumbles with the block, same density on a brick or a beam) and darkens a thin band along every edge so each block reads as a separate toy. Cone roofs and flags ride their blocks.
- Code models: the cannon on a stone plinth with a recoiling barrel, Pip, chibi knights (helmet, plume, tabard in a colour from their name), the king (crown, cape, moustache), the wizard (hat, beard, glowing wand); dizzy stars and crossed eyes when bonked; panic when a ball is incoming.
- Effects: pooled chips in the material's colours, dust and smoke puffs, fire puffs cooling yellow → red, a white-hot core, a ground shockwave ring, one pooled flash light, screen shake (off for reduced motion), slow motion on explosions and the last bonk, floating score text.
- Camera: over the shoulder while aiming; rides the ball; watches the landing for 2 s; circles the wreck at the end; the title shows the fal key art.
- Sound: ElevenLabs music (title jig, play loop, win fanfare, lose "wah wah"), 15 effects, 18 voiced lines; one voice at a time, the music ducks under speech; a synth fallback for every effect.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title with an attract demo, map, intro, play, results), the fixed-step loop and slow motion, drag-to-aim, ball picking, debug hooks |
| `js/sim/physics.js` | Rigid bodies, contacts, solver, sleeping, sweeps, queries |
| `js/sim/game.js` | Rules: firing, tricks, damage, breaking, explosions, bonks, winning |
| `js/sim/levels.js` | The building kit and the twelve castles |
| `js/sim/aim.js` | Muzzle, predicted flight, ballistic solutions |
| `js/sim/bot.js` | The auto-player (tests, balance, attract demo) |
| `js/view/view.js` | Scene, regions, camera, aim arc, syncing models, event effects |
| `js/view/blocks.js` | Instanced blocks and their shader; cone roofs |
| `js/view/models.js` | Cannon, people, balls, flags, trees |
| `js/view/fx.js` | Chips, puffs, fire, rings, flash, shake, popups |
| `js/ui.js`, `js/audio.js`, `js/media.js`, `js/input.js`, `js/save.js`, `js/config.js`, `js/rng.js` | DOM screens and HUD, sound, the clip list, input merge, saves and progress, tuning, seeded RNG |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity; the physics (stacks and walls stand awake, no tunnelling, no frozen grazing ball, determinism); every rule; that every castle stands on its own with every block awake; determinism and a save round trip taken mid-collapse; and the bot clearing every castle at two skills with asserted bands. `browsertest.mjs` drives the real game on desktop (keys, mouse drags and clicks), two touch-only phones (real drags and taps) and with storage blocked.

## Balance notes

From `ONLY=bot node game-142/dev/simtest.mjs` (the perfect bot aims at the lowest standing person, smashing the block in front if one is in the way; skill 0.5 adds up to ±0.03 rad of yaw error):

| Castle | Perfect: score, stars, shots | Skill 0.5: wins |
|---|---|---|
| watchtower | 3520, 2, 1 | 2/2 |
| gatehouse | 6210, 2, 1 | 2/2 |
| timberfort | 2268, 1, 4 | 1/2 |
| twintowers | 6330, 2, 1 | 2/2 |
| iciclekeep | 4063, 2, 2 | 2/2 |
| snowcap | 5214, 2, 3 | 2/2 |
| spire | 3753, 2, 3 | 2/2 |
| bastion | 8695, 2, 1 | 2/2 |
| bluff | 7740, 2, 1 | 2/2 |
| treasury | 13894, 2, 1 | 2/2 |
| palace | 8953, 2, 3 | 2/2 |
| grandcastle | 15782, 2, 2 | 2/2 |

- The game is meant to be casual, and it is: a perfect shot often clears a castle at once. Two stars sit a little below the perfect bot's score and three a little above it, so the third star asks for more demolition, not more accuracy.
- The Timber Fort's perfect bot picks knights off one by one (2268) while a sloppy bot that hits a crate scores 11000+: the crates are the point, and the three-star line (9000) says so.
- Bots found two building bugs before any human could: a knight placed inside a roof and crates floating in mid-air (both fixed; the "castles" simtest now proves every castle stands fully awake).
- Bots also found the frozen-ball bug (above) and a bot bug: refining the arc lifted shots over a wall onto the roof; it now accepts a hit on a block just in front of the target.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. A 500-body collapse may cost frames on a phone; the next step would be a cheaper solver loop (no per-contact allocation) or fewer iterations for sleeping-adjacent contacts.
- Nobody has listened to the music and voices in order.
- More castles (the kit makes them quick), a sandbox mode with unlimited balls.

## Changelog

### v1.2.0 (2026-11-26)
- Added: cloud saves. **☁️ Cloud Save** on the title screen and in the menu opens the shared dialog
  ([lib/core/cloud-ui.js](../lib/core/cloud-ui.js)): sign in with an emailed link (one sign-in for every game on the
  site), save this game online and load it on another device. Everything stored under the game's save key goes up
  (settings stay on the device); loading writes it back and restarts the game. It also saves to the cloud by itself
  while signed in. See [docs/generic/cloud-saves.md](../docs/generic/cloud-saves.md).

### v1.1.0 (2026-11-19)
- 48 castles in four regions (36 from the new castle generator), Moonbeam Marsh, Endless Siege.
- Fixed: Next Castle or Castles, then Back, left the screen with no menu (the title screen had been closed underneath).

### v1.0.0 (2026-11-19)
- First release: a rigid-body engine, twelve castles in three regions, five cannonballs, bonkable knights, prince, wizard and kings, fal art and ElevenLabs audio, map, intro cards, stars and saves, simtest and browsertest.
