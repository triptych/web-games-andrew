# Pinch & Place

**Genre:** Cozy decorating / light puzzle (isometric diorama builder)
**Engine:** three.js r165 (procedural clay models and shader); art by fal, music and effects by ElevenLabs
**Status:** v1.0.1

---

## Concept

An isometric room creator with a clay aesthetic. You pinch furniture, toys, rugs, pictures and lamps out of plasticine at a little Clay Bench (an easy build: pick a thing, a size, a shape and two colours), then place them in cut-away isometric rooms to make dioramas. Each room is for somebody (Pip moving out of the cot, Mo who reads three books a week, Grandma Clay who taught everyone to pinch clay) and has a short brief of needs and wishes. Finish a room and you are rated: a star for meeting every need, more for the wishes and for a room with colour harmony, balance, the right fullness, variety and cosiness. A full photo mode turns the diorama, changes the light, adds a filter and a miniature blur, and saves, shares or links the result; a link rebuilds the diorama for whoever opens it.

The look is Aardman-ish claymation: every model is lumpy rounded primitives with thumbprints, a waxy rim of light, soft shadows. The touchstones are Animal Crossing's room rating, Unpacking's little rooms, and the "build a diorama" toys of plasticine kits.

## Core loop

1. Pick a room from the list (each opens once the one before has a star). Read the brief.
2. Pinch things at the Clay Bench. Each costs clay; squishing a thing on the shelf gives it all back.
3. Place them: floor things on tiles, rugs under furniture, small things on the floor or on top of tables, desks, shelves and mantels, pictures and clocks on the walls. Move, turn, put back on the shelf, undo.
4. Watch the brief tick as goals are met. Finish when you like: the rating shows each goal, a style breakdown, a score and stars.
5. Photograph it. Next room.

The Free Studio is the same with no brief and a lump of clay that never runs out.

## Mechanics

### Things (`js/sim/data/catalog.js`)

16 kinds × 3 sizes × 3–5 shapes × 16 colours in two slots, plus motifs (6 fal-painted pictures, 4 rug patterns) and lamp glow (warm or cool).

| Layer | Kinds | Rules |
|---|---|---|
| floor | bed, sofa, armchair, chair, table, desk, bookshelf, nightstand, fireplace, floor lamp | Footprint w×d by size; turn swaps it. Never on another floor thing, a post or the door tile. |
| rug | rug | Under furniture; rugs don't overlap. |
| small | table lamp, plant, toy | 1×1. On bare floor it stands on the floor; pointed at a surface (table, desk, bookshelf, nightstand, fireplace) it goes on top, one per tile of the surface. |
| wall | picture, clock | Cells along a back wall (u) and up it (v, 3 rows). Never over the door (rows 0–1) or a window (rows 1–2). |

Moving or stowing a surface takes whatever stands on it back to the shelf; turning one drops only the riders it no longer covers. Clay: crafting costs `cost[size]`; squishing refunds it all (gifts refund nothing, they were free). The shelf holds 24.

### Goals (`js/sim/rate.js`)

`count` (of a kind or tag), `near` (Chebyshev distance 1, so diagonals count), `on` (a small thing on top of something), `onrug`, `against` (a floor thing touching a back wall), `window` (on or beside a window's floor tiles), `colors` (distinct colours in both slots), `family` (primary colour in warm/cool/green), `walk` (flood the free floor from the door tile; every floor thing must have a reached tile beside it), `cosy`, `clay` (left over). Each is required (a need) or not (a wish).

### Rating

Score = 50 × needs met + 20 × wishes met + 30 × style. Style is the mean of harmony (3–6 colours best), balance (how many quarters of the room have something in them), fullness (20–50 % of the floor covered), variety (five kinds or more) and cosiness (soft things, rugs, lights (warm ones more), art, plants and fire, less for clutter). Stars: none unless every need is met; then 1, 2 at 72, 3 at 88. The best score and stars are kept.

## Content

| # | Room | For | Size | Clay | Needs | Wishes |
|---|---|---|---|---|---|---|
| 1 | Pip's First Room | Pip | 5×5 | 22 (+ a gift bed) | bed, lamp, rug | bed on the rug, save 6 clay, walkable |
| 2 | Mo's Reading Nook | Mo | 5×6 | 26 | armchair, lamp by it, bookshelf against a wall | two pictures, plant by the window, walkable |
| 3 | The Twins' Playroom | Ada & Otto | 6×6 | 28 | four toys, a rug, walkable | five colours, two toys on the rug, a toy up on a surface |
| 4 | Nonna's Kitchen Corner | Nonna Rosa | 6×5 | 30 | a table, two chairs at it | flowers on the table, three warm things, a picture, save 6 |
| 5 | Mr. Biscuit's Living Room | Mr. Biscuit | 7×6 | 40 | sofa, table on a rug, two lights | table by the sofa, cosiness 70, two pictures, walkable |
| 6 | Juno's Starlight Studio | Juno | 6×6 (a post) | 30 | desk, chair at it, lamp on it | three cool things, bookshelf on a wall, a clock |
| 7 | Fern's Greenhouse Parlour | Fern | 7×7 (two windows) | 40 | five plants, two seats | two plants by a window, four greens, a plant up high, walkable |
| 8 | Grandma's Cabin | Grandma Clay | 8×7 (a post) | 50 | bed, fireplace on a wall, armchair by the fire, a rug, three lights | cosiness 85, three pictures, walkable |
| – | Free Studio | you | 9×8 | 400, refilled | – | – |

## Controls

| Action | Mouse / keys | Touch | Gamepad |
|---|---|---|---|
| Pick up from the shelf | click it, or 1–9 | tap it | – |
| Put down | click a tile / wall | tap where (the ghost moves), tap again or ✓ Put here | A |
| Move the held thing | the mouse; arrows | drag, or tap | d-pad |
| Select / pick up a placed thing | click it / click again; arrows + Enter | tap / tap again | d-pad + A |
| Turn | R | ⟳ Turn | X |
| Back to the shelf | Delete | ⤓ Shelf | – |
| Undo | Z | ↶ | LB |
| Zoom / pan | wheel; right or middle drag | pinch; two-finger drag | – |
| Clay Bench | B or ＋ | ＋ | – |
| Photo, finish, pause | C, F, Esc | 📷, ✓, ❚❚ | Y, RB, Start |
| Photo mode | drag to turn, wheel to zoom, Space shoots, T cycles the light | drag, pinch, shutter | – |

## Look and sound

- **Clay**: `js/view/clay.js`. Geometry is rounded boxes, lathed pucks with rounded rims, spheres, capsules and tori, each pushed about by smooth 3D value noise and re-normalled on merged vertices (soft wobble, no seams). The material is a patched `MeshStandardMaterial`: object-space noise drives a derivative bump (lumps, smudges and a few thumbprint whorls), a mottled tint, rougher dents, and a waxy rim term added to the indirect light.
- **Rooms**: plinth with a name plate (text measured to fit), lumpy floor tiles (one instanced mesh), two back walls cut around the door and windows, skirting, curtains, a doormat, posts.
- **Light**: hemisphere + a shadow-casting sun + a fill; four times of day; a pool of six point lights lent to lamps and fires (a fixed pool, because changing the number of lights recompiles every material). Lamp shades and flames glow more as the light falls.
- **Photo mode**: orthographic "diorama" lens or a perspective "toy camera"; seven filters in a grade pass; a two-pass tilt-shift blur whose sharp band follows the room; instant-photo and postcard frames drawn in a 2D canvas.
- **fal art** (`art/`): the title painting, the eight clients' portraits, and six clay-relief paintings that hang in every picture frame. See `dev/art/README.md`.
- **ElevenLabs sound** (`audio/`): a title theme and two building tunes that take turns; 17 effects (clay squish and plop, shutter, star chimes pitched up one by one, fanfare, cheering, a fire crackle loop under any room with a fireplace). Everything falls back to a Web Audio synth. See `dev/audio/README.md`.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, build, photo, visit), pointer/keyboard/gamepad routing into commands, placing, photo flow, share links, debug hooks |
| `js/sim/game.js` | Pure rules: `newGame`, `act(G, cmd)`, `serialize`/`deserialize`, unlocks |
| `js/sim/room.js` | Footprints, occupancy, `placementFor`, near / against / window / on a rug, walkability |
| `js/sim/rate.js` | Goals, cosiness, style, score and stars |
| `js/sim/share.js` | Pack a diorama into small arrays and back, re-checking every placement |
| `js/sim/bot.js` | The decorator bot (planner + greedy placement + improvement), for tests, balance and the title demo |
| `js/sim/data/` | The catalogue and the rooms |
| `js/view/clay.js`, `models.js`, `shell.js` | The clay look, every model, the room shell |
| `js/view/view.js`, `post.js`, `bench.js` | Stage, camera fit, picking, ghost, lights, photo mode and capture; tilt-shift and grade; bench turntable and shelf icons |
| `js/ui.js`, `js/photo.js`, `js/share-link.js` | DOM screens; photo frames, saving, sharing, album thumbnails; `#d=` links |
| `js/audio.js`, `js/media.js`, `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound, the list of media files, key queue, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the catalogue, every rule and goal type, determinism, save round trips and share links, and has the bot decorate every room. `browsertest.mjs` drives the real game by mouse and keys on desktop, by touch on two phones, and with storage blocked.

## Balance notes

- The first bot placed things greedily by score and missed goals that need two things ("two chairs at the table": one chair earns nothing yet). It now adds partial credit per goal to its own measure, and an improvement pass tries extra decor and re-placing each thing; three stars in all eight rooms on every seed.
- Clay budgets leave slack: the perfect bot uses small sizes and finishes with 9–28 lumps left, so a player using the bench's default Medium still fits.
- A sloppy bot (required goals only, random colours and sizes, best spot only half the time) averages about 1.6 stars; it misses needs like "a lamp right by the armchair", which is the point of the brief card.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. Nobody has listened to the audio.
- Walls only on the two back sides: the photo orbit is limited to ±43° so the cut-away always faces the camera.
- More things: a television, a bathtub, a kitchen counter; wallpaper and floor choices per room.

## Changelog

### v1.1.0 (2026-11-26)
- Added: cloud saves. **☁️ Cloud Save** on the title screen and in the menu opens the shared dialog
  ([lib/core/cloud-ui.js](../lib/core/cloud-ui.js)): sign in with an emailed link (one sign-in for every game on the
  site), save this game online and load it on another device. Everything stored under the game's save key goes up
  (settings stay on the device); loading writes it back and restarts the game. It also saves to the cloud by itself
  while signed in. See [docs/generic/cloud-saves.md](../docs/generic/cloud-saves.md).

### v1.0.1 (2026-11-14)
- Fixed: a medium or large rug was hidden inside the Clay Bench's turntable, which grew in height as well as width for big things. It grows sideways only now; the browser test checks every floor thing at every size stands on it.

### v1.0.0 (2026-11-14)
- First release: the Clay Bench (16 kinds, 3 sizes, 3–5 shapes, 16 colours, patterns, painted pictures, warm or cool lamps), eight rooms with briefs and the Free Studio, placing on floors, rugs, surfaces and walls, ratings with stars, photo mode with four lights, seven filters, two lenses, a miniature blur and three frames, saving, sharing, links that rebuild the diorama, and an album. Art by fal, music and effects by ElevenLabs.
