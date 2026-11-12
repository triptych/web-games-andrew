# Fray & the Spiral Isle

**Genre:** peaceful first-person exploration adventure
**Engine:** three.js r165, sim/view layout. Art by fal, 3D models by Meshy, audio by ElevenLabs; every asset has a code-made stand-in
**Status:** v1.1.0

---

## Concept

A chill, meditative first-person journey. You are a new mage, called to an island that is not on the maps. Seven peoples
lived there; none of them died and none were driven out. They finished what they came to do, tidied up and went on,
and left their places behind: a shrine an oak lifted into a ring, sleeping golems, crystal caves, a castle with no
gates, a castle in the sky, a city that went swimming, and a goblin warren whose hearth is going out.

Each place has a story and a gem for your spiral pendant, and each gem is the key to the next place. Your companion is
Fray, a goblin you find hurt on the shore and heal; the quartz dust has taken her sight. She goes where you cannot,
through goblin-sized ways, and you guide her by voice. At the end you help her walk the one road that only someone who
does not rely on eyes can walk, and her tribe gives her back her name.

Nothing can hurt you. There is no timer, no score and no way to fail.

## Core loop

Walk → read what the place left behind → pick up small things → find the goblin-sized way in and guide Fray →
do the place's one gentle puzzle → take the gem → a story card → the gem opens the next way.

## The chain

| # | Gem (virtue) | Where | How you get it | What it opens |
|---|---|---|---|---|
| 0 | — | Driftwood Shore | Find Fray under the Tidewatch lintel; bring three sprigs of moonmint | Fray follows you |
| 1 | Leaf (Patience) | The Rootshrine, in the Mosswood | The ring of stones has no way in; Fray takes the root-way and pulls the lever | The vine up the northern cliff |
| 2 | Stone (Memory) | The Golem Fields | Grandfather Lichen wants his three heart-runes: two in the meadow, one under the golem who lay down (Fray) | The boulder at Glimmerdeep |
| 3 | Light (Truth) | Glimmerdeep | Fray opens the crystal gate; strike four singing stones in the order of the Tuning Verse | The dark stair under Castle Hollowmere |
| 4 | Wind (Freedom) | The Underkeep | Fray raises the portcullis; return the organ's three wandering pipes | The wind perch: up to the Aerie |
| 5 | Water (Mercy) | The Aerie | Fray turns the rain-pipe valve; turn four weather vanes in the order of the Weather Rhyme | The white stairs into the sea |
| 6 | Moon (Rest) | Thalune | Three pearls for Tide Mother: two lying about, one down a dry pipe (Fray) | The goblin moon door |
| 7 | Heart (Belonging) | Underhome | Speak to Elder Grusk, set six gems in the Cold Hearth, guide Fray through the Listening Dark | The ending; you may walk on |

## Mechanics (each has a line in `dev/simtest.mjs`)

- **Walking.** `step(G, inp, dt)` with `inp = { x, y, turn, dyaw, a, run, cmd }`. Walk 4.6 m/s, run 7.4, turn 2.4 rad/s;
  a mouse or finger turn arrives as radians (`dyaw`). A body stands where the ground is dry, not steep and not in a
  tree (the island), or on an open cell (grid zones), and never inside a solid thing. Movement slides.
- **The island** is `rawHeight(x, z)` baked to a 1 m grid: a dome, a 14 m shelf north of z ≈ −20 with a cliff band,
  a castle hill, 420 trees kept off the paths and landmarks. The cliff is not a wall; it is ground too steep to stand on.
- **Things** come from data (`js/sim/data/zones.js`): `portal`, `lore`, `item`, `tunnel`, `npc`, `offer`, `chime`,
  `pedestal`, `door`, `hearth`. The nearest usable thing within reach and roughly in front is `G.prompt`; the button uses it.
- **Cards.** `G.cards` is a queue of story cards, inscriptions and notes. While one is up nothing moves; the button closes it.
- **Fray** follows a trail of crumbs a few steps behind. At a tunnel you send her in: `G.tun = { id, x, y, seen, hum }`
  and you stand still while commands (`go n/e/s/w`, `feel`, `back`) move her through a text map. She reports a wall,
  a find, the goal, and whether the hum (steps to the goal) is warmer or colder. `feel` at the goal pulls the lever or
  takes the thing. Going back out of the mouth, or `back`, brings her out.
- **Offerings** take N of an item and give a gem. **Chimes** must be used in the zone's `seq.order`; a wrong one starts over.
  **Pedestals** wait for their flags. **Portals** need their gem. **Doors** are walls until their flag.
- **Small things.** Twelve of each kind per place, scattered by the seed on reachable ground; all twelve earn a keepsake
  and a line from Fray. Fray's own finds are the baubles in the tunnels' dead ends.
- **Hints.** `nextGoal(G)` names the next story step; the Hint button shows it in Fray's words and the bot walks to it.

State is plain data with ids; `serialize`/`deserialize` are a JSON round trip (version 1).

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Walk, strafe | W A S D (↑ ↓ also walk) | Left stick | Left thumb |
| Turn, look | ← →, or click the view and move the mouse | Right stick | Right thumb drag |
| Hurry | Shift | RT / RB | Push the stick to its edge |
| Use, read, continue | E / Space | A | ✋, or the card's Continue |
| Guide Fray | Arrows; Space feels about; Esc calls her back | D-pad, A, B | The panel's buttons |
| Hint | H | X | ? |
| Journal | J | Y | ✦ |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

First person, no bloom, no shadows; fog and a hemisphere light set each place's mood, with a soft lamp you carry
underground. The island's ground colours are painted from the height data and multiplied by a tiling detail texture.
Grid zones are quads built from the text maps with fal textures (mirrored repeat hides seams). Things are small
code-built shapes that are replaced by Meshy models as they load. Story cards are fal paintings. See
[dev/art/README.md](dev/art/README.md), [dev/assets/README.md](dev/assets/README.md) and [dev/audio/README.md](dev/audio/README.md).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, title/play, the fixed-step loop, input routing, debug hooks |
| `js/sim/terrain.js` | The island's height function, trees, landmarks and paths (pure) |
| `js/sim/world.js` | Zones compiled from data, collision, movement, the walking lattice, tunnels (pure) |
| `js/sim/game.js` | `newGame`, `step`, interactions, tunnels, `nextGoal`, saving (pure) |
| `js/sim/bot.js` | The auto-player: story mode and a completionist (pure) |
| `js/sim/data/zones.js`, `story.js` | Places, things, tunnels; gems, cards, lines, hints |
| `js/view/view.js`, `build.js`, `props.js`, `tex.js` | The three.js view: camera, zones, props and model swap-in, textures |
| `js/ui.js` | Screens, HUD, cards, the tunnel panel, the journal, toasts |
| `js/input.js`, `js/audio.js`, `js/audio-files.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, the list of clips, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). 488 sim checks and a browser run on desktop, two phones and blocked storage.

## What the bot found

| Run | Game time to the ending | Inscriptions | Keepsakes |
|---|---|---|---|
| Story bot (runs everywhere, reads nothing), 4 seeds | 389 s | 0 | 0 |
| Completionist bot, 2 seeds | 880–930 s | 39 of 39 | 8 of 8 |

A person who walks and reads should take 40 to 60 minutes. The bot also found two bugs that were its own and one that
was the world's (a tree could pinch a path the lattice thought open); see docs/generic/learnings.md, "Game 131".

## Open questions / next steps

- A human pass on real hardware: it has only run under SwiftShader. Whether the walk is restful, the pacing and the
  look speed are right, and the voices suit, nobody has judged.
- The tide stairs model climbs rather than descends into the sea, and the castle wall is one segment repeated.
- Full quality draws about 560,000 triangles of trees; only SwiftShader has drawn it. `&q=low` halves the trees.
- The golem does not stand up when woken, and the vine appears rather than grows.
- The Cold Hearth card is composed from the hearth's prop render (the image model declined that painting).

## Changelog

### v1.1.0 (2026-11-12)
- The trees and every remaining code-built prop are Meshy models (28 new, 38 in all); trees are instanced.
- Island landmarks face the path that leads to them; brighter fill light; smooth clouds and coral.
- `js/model-files.js`: the game only requests models that exist.

### v1.0.0 (2026-11-12)
- First release: the island and five grid zones, seven gems, Fray and seven tunnels, 39 inscriptions, eight keepsake
  sets, the journal and hints, generated art, models and audio, and the test harnesses.
