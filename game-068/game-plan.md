# HAVEN ROAD — design notes

**Genre:** Tower defense, turned around: you heal the people, not hurt the monsters
**Engine:** three.js r165 (ES modules, import map), no asset files
**Status:** v1.0.0, complete

*Every life is worth the walk.*

The dead have come to the valley, and the living are walking out of it. The road runs from the woods to the **Haven**, a camp of tents round a great lantern, and everyone on it is hurt somehow: cut, feverish with the blight, starving, frozen, limping on a broken leg or too frightened to keep going. You can't stop the dead. You can set up aid stations along the road and keep the living walking: bandage them, cure them, feed them, warm them, splint them, sing to them, and carry them when they fall.

It's a tower defense whose "creeps" are the people you're trying to save. The zombies are the weather, a hazard that follows them down the road. Score is lives saved, and the people you save stay with you. They write you letters, and when the great blighted things come for the Haven itself, **they come back out to stand with you**. In those boss levels the volunteers fight back with the cure, and the zombies they reach turn back into people.

## Tone

- Hope over horror. Zombies are grey, hunched and sad, with dim lantern eyes. There's no blood, no gore and no killing. A zombie that loses interest drifts back into the fog. A cured one straightens up, its colour comes back, and it walks to the Haven.
- Every heal says something kind ("We've got you", "Almost there", "Breathe"). Everyone who arrives is greeted. The Haven grows as people arrive: more tents, more lights, a brighter beacon.
- Someone who isn't reached in time is not shown dying. They collapse, and if nobody reaches them their lantern rises into the sky. The Journal remembers their names.
- A failed level says "The gates closed early. Everyone who made it is safe. Take a breath and try again."

## The loop

1. **Choose a level** on the valley map. There are twelve levels in three acts, each a seeded, procedurally generated stretch of road.
2. **Build aid stations** on the grass beside the road with Supplies.
3. **Open the gate.** A wave of people comes down the road, each with their ailments shown above their head. A few seconds later the dead follow.
4. Stations treat whoever is in range automatically. Tap a person to see their name, job, ailments and how they're feeling. Tap a station to upgrade it (three levels) or pack it up.
5. People who reach the Haven bring Supplies. People who arrive **thriving** (healthy and free of every ailment) bring more, and join the **roster** as volunteers of their trade.
6. After the last wave come stars (everyone who started walking made it ★★★, 90% ★★, finished ★) and **letters** from people you saved, written about the care they actually received.
7. Every fourth level is a **boss level**. The Haven is under siege, and you deploy volunteers from your roster beside the road. They cure the dead with what they know: hoses, herb bombs, floodlights, lullabies. Your aid stations heal the volunteers.

## Ailments

| Ailment | Shown | What it does | Treated by |
|---|---|---|---|
| **Wound** (1–3) | red drop | bleeds 1.5 HP/s per level | Medic Tent |
| **Blight** (sickness, 0–100) | green swirl | spreads +0.7/s once caught; above 70 drains 1.2 HP/s, at 100 drains 3 HP/s | Remedy Lab |
| **Hunger** | bowl | 15% slower, takes 40% more damage | Field Kitchen |
| **Cold** (0–100) | snowflake | rises 1.2/s in winter away from a fire; above 50 slows 20% and drains 1.5 HP/s, at 100 drains 4 HP/s | Warming Fire |
| **Fracture** | bone | walks at 55% speed (the dead catch up) | Splint Post |
| **Fear** (0–100) | bolt | rises 6/s near the dead, fades 3/s away from them; above 50, sometimes freezes on the spot | Song Circle, a little from Lanterns |

**Temporary health** (golden, from the Field Kitchen and Song Circle) sits on top of HP. It absorbs every kind of loss (bleeding, scratches, fever) and fades 1 point a second.

At 0 HP a person **collapses**. A Medic Tent or Stretcher Crew can revive them. If nobody reaches them in 14 seconds (much less with the dead standing over them), they're lost and Hope drops by 1. At 0 Hope the level is over.

The dead **scratch** whoever they catch: HP damage, a deeper wound, blight and fear (each only once that ailment has been introduced). The scratched person gets two seconds of adrenaline (1.5× speed) and 2.5 seconds in which nobody else can scratch them, so one slow walker isn't mobbed by every zombie in turn.

The dead only catch someone **they can keep up with**: a walker faster than the zombie beside them slips past, stepping round to the far side of the road. So the dead threaten the limping, the frozen with fear, the cold, the hungry, elders, and anyone who has collapsed; runners threaten everyone. The first wave of a level meets only the older kinds of dead; the harder ones join one wave at a time. Nobody starts with more than two troubles (three deep into Open Road).

## Aid stations (towers)

Each has three levels. Packing a station up returns 70% of what it cost.

| Station | Unlocks | Cost | Does |
|---|---|---|---|
| **Medic Tent** | 1 | 50 | Bandages the most wounded in range: heals HP and closes a wound level. Revives the collapsed. Lv3 treats two at once. |
| **Lantern Post** | 1 | 40 | The dead shy from light: zombies in range move 35/45/55% slower, and the frightened calm a little. Lv3 fires a flare that stuns them. |
| **Remedy Lab** | 2 | 70 | Lobs a cure vial that splashes and clears blight. Lv3 leaves a short immunity. |
| **Field Kitchen** | 3 | 60 | Hands out soup: cures hunger and gives **temporary health** (20/30/45, up to 60). |
| **Warming Fire** | 5 | 55 | An aura that drives out cold and leaves people warm for a while. Lv2+ also heals 2 HP/s. |
| **Stretcher Crew** | 5 | 80 | Runs out to the collapsed and revives them (40/55/70% HP), carrying them a tile or two down the road. Lv2+ also carries limping people forward. |
| **Splint Post** | 6 | 60 | Sets broken bones; the mended get a burst of speed. Lv3 treats two at once. |
| **Song Circle** | 7 | 75 | A musician's aura: clears fear and builds up **courage**, temporary health up to 20/30/40. Lv3 slows the dead (they sway to it). |
| **Signal Bell** | 9 | 70 | Rings every few seconds; the dead in range wander off the road toward it for a while. |

## The dead

| Kind | From | Notes |
|---|---|---|
| Shambler | 1 | slow (0.7 tiles/s): catches only the limping, the frozen and the hungry |
| Spitter | 2 | spits blight at someone up to 2.5 tiles away |
| Runner | 5 | faster than anyone (1.45) |
| Brute | 6 | slow, scratches hard, half as affected by lanterns and bells |
| Howler | 7 | its howl frightens everyone nearby |

Healthy people walk at about 1.1 tiles/s, so a shambler only catches someone the player hasn't looked after. When the people of a wave are all through, the dead still on the road drift back into the fog. The dead who reach the Haven's light in a normal level turn away.

## People

Adults (100 HP), elders (70 HP, slow), children (60 HP, quick, frighten easily) and carriers pushing a handcart (120 HP, slow, +10 Supplies). Families walk together. Everyone has a seeded name, a look (skin, hair, clothes, hat) and, for adults, a trade. Elders are storytellers. Children don't volunteer; they go to the Haven school and draw you pictures.

## Volunteers (boss levels)

A thriving arrival joins the roster; any other arrival counts as saved but doesn't volunteer. Each trade's power grows by 3% for every extra person of that trade on the roster (thriving ones count double), up to +60%. Zombies in boss levels have **blight**, a cure meter. Bring it to zero and they straighten up into people, walk to the Haven and join the roster mid-fight.

| Trade | Cure |
|---|---|
| Firefighter | a hose spray in a cone that pushes the dead back |
| Nurse | cure darts, and patches up volunteers nearby |
| Gardener | herb bombs that splash |
| Athlete | quick, accurate tosses |
| Musician | a lullaby aura: slows and cures everything in range, calms volunteers |
| Mechanic | a floodlight beam that pierces a line and stuns |
| Storyteller (elders) | rallies volunteers in range (+30% speed, no fear) and cures a little |
| Neighbour | always available (three of them), so a boss level is never empty-handed |

Volunteers stand on the grass beside the road. The dead stop to scratch any volunteer in reach, so volunteers hold the line, and they take on the same ailments as anyone else, which your aid stations treat. A volunteer at 0 HP collapses. Revived, they keep going. Otherwise they go back to the Haven to rest and can be sent out again 20 seconds later. Nobody is lost in a boss level. Deploy slots are 6, 8 and 10.

## Bosses

| Level | Boss | Blight | Does |
|---|---|---|---|
| 4 | **The Hollow Giant** | 2200 | slams volunteers near it (heavy wound and fear), calls shamblers |
| 8 | **The Winter Wailer** | 3800 | wails: fear and cold on every volunteer within 3 tiles, calls runners |
| 12 | **The Blight Heart** | 5000 | three phases: spits blight globs, calls brutes and spitters, speeds up at the end |

A boss reaching the Haven ends the level. Any other zombie that reaches it costs Hope (brutes two). Volunteers can be called back and sent out again, so a good player leapfrogs them ahead of the boss; the balance bot does exactly that. A cured boss shrinks in a burst of light into a very confused, very grateful person, and every zombie still on the road is cured with it.

## Levels

| # | Name | Act | Notes |
|---|---|---|---|
| 1 | The First Morning | I · Maple Hollow (autumn) | wounds only; Medic Tent and Lantern; gentle hints |
| 2 | Orchard Lane | I | blight; Remedy Lab; spitters |
| 3 | Market Square | I | hunger; Field Kitchen; a second road joins the first |
| 4 | **The Hollow Giant** | I | boss |
| 5 | Snow on the Bridge | II · Frostford (winter) | cold; Warming Fire, Stretcher Crew; runners |
| 6 | The Frozen Mill | II | fractures; Splint Post; brutes |
| 7 | Candles in the Chapel | II | fear; Song Circle; howlers; dusk; two roads |
| 8 | **The Winter Wailer** | II | boss |
| 9 | Rain on Ash Street | III · Lantern City (night, rain) | Signal Bell; everything |
| 10 | The Long Bridge | III | two roads |
| 11 | Last Train Yard | III | two roads, nine waves |
| 12 | **The Blight Heart** | III | final boss, then the epilogue |

Finishing level 12 opens **Open Road**, an endless mode on a fresh random map each time, with the seasons turning every five waves. You score by how many you save.

Waves are generated from each level's settings (difficulty, the ailments and dead it has introduced, number of waves) with a seeded RNG, so a level plays the same every time and the balance bot can play it.

## Map generation

A level's map is a 24 × 15 grid. The Haven fills the right-hand three columns.
- **The road** is a chain of waypoints with strictly increasing x (at least two columns apart), joined by L-shaped legs that go horizontal-first or vertical-first at random. A candidate is kept only if the road is a simple path, no road tile touches the road anywhere except its neighbours along it, and it's at least 34 tiles long. Otherwise the generator tries the next sub-seed.
- **A second road** (levels 3, 7, 10, 11) comes in from the top or bottom edge, jogs once, and joins the main road at a T, under the same no-touching rule.
- **Scenery** is placed by theme with value noise: farmhouses, barns, orchards and hay bales in autumn; snowy pines, cabins, a frozen pond and a mill in winter; terraces, shopfronts, street lamps and abandoned cars in the city. It never goes on road tiles, and at most a fifth of the tiles beside the road are blocked, so there's always room to build.
- The ground is painted into a canvas texture: grass or snow noise, a dirt, cobble or asphalt road with worn edges and ruts, and the Haven's trampled square.

## Look

Everything is built in code from primitives, merged per model with vertex colours and a per-vertex glow for windows, lanterns and fires (one patched `MeshStandardMaterial`), in the style of game-067.
- **People and the dead** are instanced parts (legs, torso, arms, head, eleven hats and hairstyles (each trade has its own: helmet, nurse's cap, straw hat, beret…)) posed every frame. The dead are hunched, arms forward, grey-green, in torn colourless clothes, with two glowing eyes. Bosses are giant merged models with glowing blight veins.
- **Overhead**: a billboard bar (HP, golden temporary health, a blight band) and up to four ailment icons from a canvas-drawn atlas, all instanced, two draw calls in all.
- **Effects** (one points system, sized in world units and capped, per the game-066 lesson): rising plus signs, hearts, music notes, steam, sparks, snowflakes, a golden burst for every cure, and a lantern that rises for every life lost. Projectiles are bandage rolls, cure vials and soup bowls in arcs.
- **Weather** by act: falling leaves; snow and frost; night rain with puddle glints. Fireflies in the evening.
- **The Haven**: a palisade, tents in many colours, washing lines, a fire, and the great beacon on a tower, whose light grows with every arrival. More tents go up as people arrive.
- **Post**: soft bloom, with a sanitize pass in front of it that blacks out any NaN pixel (the game-065 lesson), and a warm vignette. The low quality tier has no post.

## Controls

| | Desktop | Touch |
|---|---|---|
| Build | pick a station (1–9), click a tile | pick a station, tap a tile |
| Select | click a station, person or volunteer | tap |
| Pan / zoom | drag, wheel | one-finger drag, pinch |
| Open the gate / next wave | Space or the button | the button |
| Speed | F (1× / 2× / 3×) | the speed button |
| Pause | P | the pause button |
| Cancel / menu | Esc | ✕ |
| Mute | M | sound button |

The camera fits the whole map at any aspect. On a portrait phone it turns 90° so the long side of the map runs up the screen. Placement acts on a tap only: a drag pans and builds nothing (the game-067 lesson). The canvas is sized in px from the visible viewport, and every tap maps through its bounding box (the game-058/067 100vh lesson).

## Architecture

```
js/config.js        grid size, timing, theme palettes
js/rng.js           seeded RNG and value noise (no Math.random anywhere in the sim)
js/sim/             pure simulation — no three.js, no DOM
  data.js           ailments, stations, the dead, people kinds, trades, volunteers, bosses
  levels.js         the twelve levels and Open Road, and the seeded wave generator
  mapgen.js         road and second road, validation, scenery, buildable tiles, routes
  names.js          names, encouragements, and letters built from the care each person got
  world.js          one level being played: people, the dead, stations, volunteers, waves, events
  bot.js            a player for the balance tests: places, upgrades, deploys
js/view/            three.js
  stage.js          renderer, camera fit and rig, lights, sky, bloom + sanitize, quality tiers
  builder.js        primitives merged into one geometry with colour and glow
  materials.js      the shared vertex-colour material with per-vertex glow (brighter at night)
  terrain.js        the painted ground, the scenery, the Haven and its growth
  models.js         stations at three levels, bosses, props
  actors.js         instanced people, volunteers and dead; overhead bars and icons
  fx.js             particles, projectiles, beams, range rings
  weather.js        leaves, snow, rain, fireflies
js/ui.js            DOM: title, valley map, briefing, HUD, trays, cards, results, journal, settings
js/input.js         mouse, touch and keys
js/audio.js         synthesised music, ambience and effects
js/save.js          progress, roster, letters and settings in localStorage (guarded)
js/main.js          boot, the frame loop, glue, debug hooks
```

Behind the title and the valley map a demo level plays itself with the balance bot.

`main.js` runs the simulation on a fixed 1/30 s step (1×, 2× or 3× per frame) and drains `world.events` (heals, arrivals, collapses, cures, waves) for sounds, words and particles. The view only reads the world.

## Balance

`dev/simtest.mjs` plays every level with the balance bot (`js/sim/bot.js`): it keeps a mix of stations in proportion to the level's ailments, puts the first of each kind where the people need it most along the road and the second one early on the road, upgrades once the mix is in place, and in boss levels deploys a mix of trades beside the road and leapfrogs them ahead of the boss. Carrying its roster from level to level it wins all twelve, with three stars in Act I and two or three after that; a player who builds nothing loses every level. Every boss level is also won with an empty roster (three neighbours and everyone cured mid-fight). What the first runs found, and fixed:
- **The dead were spawned among the people**, so later walkers walked through them and were scratched from behind. Now only those the dead can keep up with are caught, and walkers step round the dead.
- **One limping walker was mobbed** by every passing zombie in turn: the post-scratch safety window.
- **Stacked ailments were a death spiral** (a broken leg, a fever and fear at once): at most two troubles each, and the hardest dead join a level from its second wave.
- **Bosses were out of reach** of six volunteers standing still; their blight came down, and leapfrogging proved the intended play.

## Phases

### Phase 1 — Simulation
- [x] Map generator with validation, second roads, scenery and routes
- [x] Ailments, stations, the dead, people, volunteers and bosses
- [x] Waves from level settings with a seeded RNG, and Open Road
- [x] Letters from the care actually given
- [x] `dev/simtest.mjs`: purity, maps on many seeds, mechanics, a bot that wins every level, doing nothing loses later levels

### Phase 2 — The valley in 3D
- [x] Painted ground, scenery per act, the growing Haven
- [x] Stations at three levels, people, the dead and bosses, overhead bars and icons
- [x] Particles, projectiles, weather, bloom with a NaN guard

### Phase 3 — Play
- [x] Title, valley map, briefings, HUD, trays, cards, results with letters, journal, settings
- [x] Touch, portrait camera, pinch, pause on a hidden tab
- [x] Music and sound
- [x] `dev/browsertest.mjs`: desktop and touch phones

## Open questions
- Not yet played on a real phone GPU (SwiftShader only).
- Open Road has no bosses.

## Changelog

### 1.0.0 (2026-10-07)
- First release: twelve levels in three acts with three bosses, nine aid stations, six ailments, five kinds of dead, eight volunteer trades, letters, the journal and Open Road.
