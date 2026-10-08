# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Haven Road** (game-068) v1.0.0: a tower defense turned around, in three.js r165 with no asset files. The dead have taken the valley; the living walk out of it, hurt, and you build aid stations to keep them walking home to the Haven. Design notes in [game-068/game-plan.md](game-068/game-plan.md).
  - **Roads**: twelve levels in three acts (autumn Maple Hollow, winter Frostford, Lantern City at night in the rain), each a seeded map: a road of waypoints joined by L-shaped legs, kept only if no road tile touches another except its neighbours, and on four levels a second road joining at a T. Themed scenery never crowds the roadside; the ground is painted into a canvas texture.
  - **Ailments and care**: wounds, blight, hunger, cold, fractures and fear, each treated by its own station (Medic Tent, Remedy Lab, Field Kitchen, Warming Fire, Splint Post, Song Circle), plus a Stretcher Crew for the collapsed, Lantern Posts that slow the dead and a Signal Bell that lures them off the road. Every station has three visible levels. Temporary health from soup and song soaks up harm first.
  - **The dead** (shamblers, spitters, runners, brutes, howlers) only catch people they can keep up with; a scratched person gets a moment of adrenaline and safety. Collapsed people can be revived; anyone not reached in time is remembered, and their lantern rises over the valley.
  - **Volunteers and bosses**: everyone who arrives thriving joins a roster of eight trades. In three boss levels (the Hollow Giant, the Winter Wailer, the Blight Heart) they stand beside the road and cure the dead with hoses, darts, herb bombs, floodlights, lullabies and stories; the cured walk home and join them, and curing a boss cures everything with it.
  - **Hope**: letters from the people you saved, built from the care they actually got; a journal of letters, the roster, a field guide and the names remembered; kind words over everyone you help; a Haven that grows a tent at a time; hopeful generative music in a different key for each act. Finishing the story opens an endless Open Road.
  - **Tests**: [dev/simtest.mjs](game-068/dev/simtest.mjs) checks purity, 212 maps, every mechanic, waves and letters, and has a balance bot win all twelve levels in a row while a player who builds nothing loses each one; [dev/browsertest.mjs](game-068/dev/browsertest.mjs) plays the game with a real mouse on desktop (including a boss level) and real touches on phones in both orientations.
- **Dirt Crown** (game-069) v1.0.0: a dirt-track racing RPG in three.js r165 with no asset files. You start in Grandpa Gus's first racer, the Bucket (a tiny, featureless primer-grey buggy), win races for coins, upgrade it, and finish against your rival Colt Ravenwood for the Dirt Crown. Design notes in [game-069/game-plan.md](game-069/game-plan.md).
  - **Tracks** ([game-069/js/sim/track.js](game-069/js/sim/track.js), [tracks.js](game-069/js/sim/tracks.js)): a closed centreline (polar loop, Catmull-Rom through points, or a figure eight whose crossing is a bridge), resampled every ~2 m and relaxed so no bend is tighter than the barrier can follow; hills, banking, tabletops, kickers, crests, dips and whoops; surface patches (mud, water, gravel, sand, planks, ice, snow, oil); a racing line; coins. Twenty tracks in seven environments, and events run some of them backwards.
  - **Physics** ([car.js](game-069/js/sim/car.js)): steering sets a yaw rate capped by tyre grip, and the tyres bleed off the sideways part of the velocity at a rate set by grip, so dirt, mud and ice each slide differently and the drift button lets a slide linger. Sliding and clean landings fill the nitro. Jumps when the ground falls away faster than gravity; suspension travel keeps the tyres biting through small hops; hard landings, barriers and shoves cost speed by suspension, armour and mass. Slipstream, perfect-start launches and resets.
  - **AI** ([ai.js](game-069/js/sim/ai.js)): plans speed from the curvature and grip ahead along its racing line, commits to a passing side when blocked, uses nitro on straights and in passes. Grids are seeded slowest-first; champions start third.
  - **Career** ([career.js](game-069/js/sim/career.js), [parts.js](game-069/js/sim/parts.js)): 26 events in seven cups (race, elimination, time trial, duel), six champions and the final; six upgrade lines of five levels, a rating from 100 to 1000 on the same scale as every opponent's car, a paint shop, purses by position, medals and a first-win bonus.
  - **Story** ([story.js](game-069/js/sim/story.js), [portraits.js](game-069/js/ui/portraits.js)): 19 scenes with typed dialogue, per-character voice blips and portraits painted in canvas with moods; scenes play once before and after the champions' races and can be replayed; losing the final has its own scene, winning it the ending and credits.
  - **The look** ([world.js](game-069/js/view/world.js), [props.js](game-069/js/view/props.js), [carmodel.js](game-069/js/view/carmodel.js), [stage.js](game-069/js/view/stage.js)): terrain that bends to meet the road (jumps become earth mounds, the lower road wins under a bridge), a textured road, surface decals, barriers per place (hay bales, tyre stacks, logs, fences, rocks, snowbanks, tuff blocks, Ravenwood's black-and-gold), bridges with railings and pillars, a start gantry with countdown lights, grandstands with bouncing crowds, a stadium bowl with light towers and a jumbotron, water, horizon mountains and ~40 kinds of instanced scenery. Eight car bodies whose upgrades all show; liveries painted per side. Sky shaders with sun and clouds, environment maps baked from the sky, bloom, a grade per time of day, a radial blur while boosting; dust, spray, sparks, nitro, confetti, fireworks, tyre marks and weather. A garage hub with a turntable, pegboard, trophy shelf (the Crown appears when you win it) and neon sign.
  - **Audio** ([audio.js](game-069/js/audio.js)): a five-gear synthesised engine for you and the nearest rival, tyre scrub, rumble, wind and nitro beds, one-shots, and a step-sequencer score with a style per place.
  - **Tests**: [game-069/dev/simtest.mjs](game-069/dev/simtest.mjs) (purity, every track both ways, physics on every track at three ratings, determinism, rules, and a bot that plays the whole career and must win the Crown in under 90 races) and [game-069/dev/browsertest.mjs](game-069/dev/browsertest.mjs) (desktop flow from the title through the final and credits; touch-only phones at 390×844 and 844×390). [game-069/dev/README.md](game-069/dev/README.md) lists what the bots found.
- Launcher: game-069 added to [js/gamedata.js](js/gamedata.js) (genre `rpg`) with a card style in [css/styles.css](css/styles.css); README and [status.md](status.md) updated.

### Fixed
- **Tootle Isles** (game-067) v1.0.1: taps on phones now land where the finger is, and dragging in Build moves the view instead of placing things.
  - The canvas was stretched by CSS to `100vw × 100vh` while the renderer drew at `innerWidth × innerHeight` and taps were mapped against `innerHeight`. On phones with a URL bar `100vh` is taller than the visible area, so the picture was stretched downward and everything was built below the finger (the same bug game-058 had). The renderer now sizes the canvas in px, taps and screen projections go through the canvas's bounding box, and `visualViewport` resizes refit it ([game-067/js/view/stage.js](game-067/js/view/stage.js)).
  - Build now acts on a tap only: a drag (one finger or the mouse) moves the camera and places nothing, and a press that wanders more than a few pixels is never a tap, even if it comes back ([game-067/js/input.js](game-067/js/input.js)). A refused spot now says why for small items too.
  - The browser test checks that the canvas matches the visible viewport, that a tap on a tile's drawn position builds on that tile, and that a drag in Build moves the camera and places nothing, on desktop and both phone orientations.

### Changed — early-games refresh
The later games (037+) share conventions the early ones predate. [docs/refresh-plan.md](docs/refresh-plan.md) lists them, records an audit of games 001–036 against them, and ranks what's left.
- **Repo-wide smoke test** ([dev/smoketest.mjs](dev/smoketest.mjs), [dev/README.md](dev/README.md)): loads every game in Chromium on desktop and on a touch-only phone, clicks, taps and presses keys, and fails on console or page errors, failed requests, a missing or covered back link, sideways scroll or a clipped canvas. `NOSTORAGE=1` makes `localStorage` throw. CDN requests can be served from local npm packages.
- **Blocked storage no longer crashes games**: nine games threw an uncaught `SecurityError` at load when the browser blocks site data (003, 010, 011, 013, 014, 018, 023, 028, 033), and 007, 009 and 012 would throw on save, load or clear. Every access is now guarded; the game plays on without saving.
- **Silent in a background tab**: [lib/page-audio.js](lib/page-audio.js), included by every game from 001 to 036, tracks each `AudioContext` and media element the page creates and suspends them while the tab is hidden. It works the same for Kaplay, Phaser, three.js and plain Web Audio.
- **Phone viewport**: `viewport-fit=cover` and a `theme-color` matching the page on every game from 001 to 036.
- **Layout fixes**: game-002's fixed canvas is scaled to fit with Kaplay's `scale` option, so taps still hit the right gem; game-026's hint bar and message log no longer overflow a phone; game-031's back link is pinned to the corner instead of sitting below the fold; game-005 and game-006 letterbox their fixed Kaplay canvases (1280 and 640 px wide, clipped on phones); game-030 scales its 640×480 frame, canvas and panels together, to fit; game-004 uses the shared `/lib/kaplay` instead of an identical 560 KB copy.
- **Space Shooter** (game-001) v1.3.0: the canvas scales to fit, movement is per second, not per frame (it used to run at double speed on 120 Hz screens), Space can be held to fire, touch steering by relative drag with auto-fire, a title screen, pause (P or a hidden tab) and a saved best score. [dev/browsertest.mjs](game-001/dev/browsertest.mjs).
- **Crate Pusher** (game-016) v1.2.0: swipe or tap beside the pusher to move, Undo, Restart and Menu buttons (bigger on touch), levels unlock in order with best move counts saved, a level picker on the title, and the game's first [design doc](game-016/game-plan.md). [dev/browsertest.mjs](game-016/dev/browsertest.mjs) proves every level solvable with a breadth-first solver, then plays all eight through the real UI.
- **Pixel Picross** (game-017) v1.2.0: a Fill / Mark tool (button or X key) so phones can mark squares without a right click, Restart and Menu buttons, tap to continue after a win, and solved puzzles saved. [dev/browsertest.mjs](game-017/dev/browsertest.mjs).
- **Depths Unknown** (game-022) v1.4.0 gets an ending. It had no win condition: now the first time Singing Vein ore reaches the base, an epilogue plays over the paused base with the run's numbers, and you can keep mining, start a new game or go to the menu. The mission is saved, and the title shows MISSION COMPLETE. [dev/browsertest.mjs](game-022/dev/browsertest.mjs).
- **Ironhollow Depths** (game-032) v1.2.0, Phase 2: it had one room and no way down. Now:
  - ten procedurally generated floors, each rejected unless a flood fill reaches every tile
  - stairs that open once every foe on a floor is dead, and the Hollow Crown on floor 10 to win
  - bats (erratic, fly over pillars) and skeletons (keep their distance, throw bones you can swat)
  - potions, depth-tinted floors, a saved best run
  - touch controls (floating stick, hold-to-swing sword, pause), pause on P or a hidden tab, M for sound
  - fixes: the hit flash never showed (a `color()` component was assigned instead of an `rgb()` value), and the slime wobble did nothing (`scale` set without a `scale()` component)
  - [dev/browsertest.mjs](game-032/dev/browsertest.mjs) checks 60 generated floors, the desktop flow and touch-only phones
- Launcher versions bumped in [js/gamedata.js](js/gamedata.js) for every game with a behaviour change; [status.md](status.md) and the README updated (game-022 is Phaser 4, not Kaplay).

### Changed
- **Launcher remade as the Garden of Games** ([index.html](index.html), code in [garden/](garden/)): a walkable three.js r165 island in the spirit of *Myst*, with no asset files. The previous card grid moved to [classic.html](classic.html), unchanged apart from a link back.
  - **Layout grows with the collection** (`garden/js/layout.js`): one flagstone path per genre radiates from a colonnaded hub, plus a path down to the arrival dock. Statues stand in pairs every 7.5 m, newest nearest the hub, and each path ends at a pavilion. The coastline is a signed-distance union grown around the paths, so adding games lengthens paths and widens the island. Checked headlessly at 50, 100 and 160 games: no overlaps and every statue well inland.
  - **`genre` field in `js/gamedata.js`** for all 51 games (arcade, puzzle, dungeon, rpg, story, strategy, cozy). A game without one is placed by its tags. The scaffold-game command now asks for it.
  - **Statues**: a pedestal with a bronze plaque (icon, title, version) drawn into a shared canvas atlas, topped by a sculpture chosen by genre and varied per game: robed mages and sages, knights, archers, readers, a lantern-bearer, a gardener, orreries, comets, sentinel obelisks with floating crystals, cube towers, torus knots, chess pieces, castle towers, flower-filled urns and giant open books. All statues merge into a few meshes, and an `aId` vertex attribute lets one shader rim-light the hovered statue in its genre colour. Each sits in a curved hedge niche between cypresses, with a ring of flowers and magic motes.
  - **Hub hologram**: a pedestal with turning brass armillary rings and a projector lens. The head turns to face you, and its panel cycles through every game (newest first, every 8 s) with a glitchy chromatic cross-fade. Two brass arrows press in to step it (or `[` `]`). Click the light for the full description with Play / Walk there / Link there.
  - **Architecture**: a colonnade with arched beams, a mosaic plaza with a compass star and genre rays, genre gates with hanging signs, pavilions with dome, onion, cone, pagoda or glowing crystal roofs and a floating genre crystal, lamp posts, benches, a wooden dock and a sunken wreck, plus set pieces between the paths: the Great Gear, an observatory, a lighthouse with a sweeping night beam, the Moon Fountain, standing stones with glowing runes, a great tree of glowing blossom, and a clock tower on its own islet whose hands show the garden's time.
  - **Nature**: Myst-like pines on granite cliffs, broadleaf and blossom trees, wind-swept chunked grass, flower beds and wildflowers, boulders, and vines that grow up columns, arches and the colonnade as you come near (one shader, a growth value per structure).
  - **Sky and sea**: a day/night cycle (8 minutes, adjustable or paused) with an analytic sky, sun, moon, stars, Milky Way, drifting clouds and a night aurora. The sun casts shadows from a box that follows you, and the environment map refreshes as the light changes. A Gerstner-wave ocean reflects the same sky, with turquoise shallows, glints and shore foam. At night lamps, windows, runes and plaques glow (bloom, plus a pool of real point lights near you) and fireflies come out.
  - **Music and sound**: a generative ambient score (detuned pads, a plucked pentatonic melody through delay and reverb, FM bells, bass) that moves to a darker progression at night, plus surf that swells near the shore, wind, birds by day, crickets and owls by night, footsteps on stone, grass and wood, and chimes for hovering, the arrows and linking.
  - **Getting around**: WASD or arrow keys, drag to look, click the ground to walk there. On phones: a floating joystick in the lower left, drag to look, tap to walk, tap a statue for its card. *Walk there* follows the paths through the hub. *Link there* teleports with a white linking flash. A hand-tinted map (tap a statue or a place name), a searchable Library list with Play and Find statue, area banners as you enter each district, a help panel, and a lighter-graphics option. Quality tiers by device, plus adaptive resolution.
  - **Tests**: [garden/dev/browsertest.mjs](garden/dev/browsertest.mjs) (Playwright, real WebGL): desktop enter, walking, both hologram arrows, statue hover tooltip, clicking a statue opens its game in a new tab, library search and Find, Walk there arriving at a statue on another path, map, dusk and night. Touch-only phones at 390×844 and 844×390: joystick walk, tap a statue for its card, 44 px controls. Fails on any console error, page error or failed request.

### Changed
- **Scrapwright** (game-066) v1.0.3: battle gauges sit where their bots are. On portrait phones both gauges were at the top while your bot stood at the bottom, and in landscape your gauge sat over the foe. Now the foe's gauge is top-left (its bot stands top-right) and yours sits just above the command box (your bot stands bottom-left), following the box as menus change its height; a long team or bag list hides it rather than covering the foe. The battle camera also centres the stage in the space above the command box (a view offset of half the box height), so neither bot hides behind it ([game-066/js/ui/battleui.js](game-066/js/ui/battleui.js), [game-066/js/view/battleview.js](game-066/js/view/battleview.js)).
- **Scrapwright** (game-066) v1.0.2: foundries and Boiler Stations no longer roll slowly around one axis (seen on the title flyover and in every town). Each building keeps a reference to its spinning gear or gauge needle, and the overworld spun every object holding such a reference: the building as well as the part. Moving parts are now registered explicitly, so only the gear turns, the needle swings, the propeller spins and the airship bobs ([game-066/js/view/overworld.js](game-066/js/view/overworld.js)). The desktop browser test checks that the buildings hold still while their parts move.
- **Scrapwright** (game-066) v1.0.1: the town no longer disappears behind a grey veil on phones. Particles were sized as `size × 0.9 × screen height ÷ depth`, so a chimney smoke puff could be thousands of pixels wide; SwiftShader caps point sizes, which hid it in testing, but real phone GPUs drew them in full. Particles are now sized from the drawing buffer and the camera's field of view, capped at 30% of the screen, and fade out near the lens ([game-066/js/view/fx.js](game-066/js/view/fx.js)). The phone browser test now compares the scene with particles on and off.
- **Worldroot** (game-065) v1.2.1: no more box blinking over the forest. A shader occasionally produced a NaN pixel. On most GPUs, `pow()` of a value that rounding had pushed a hair below zero returns NaN, and the forest's and bark's rim light did that whenever a face lined up with the camera. The bloom pass then smeared that single pixel into a flashing rectangle. Every such `pow()` is now clamped, and a sanitize pass before the bloom ([game-065/js/view/stage.js](game-065/js/view/stage.js)) turns any NaN or infinite pixel black. `dev/browsertest.mjs` checks that a deliberately NaN quad changes nothing on screen. This, not the panel's backdrop blur, was also behind the v1.1.1 report.
- **Worldroot** (game-065): `node game-065/dev/itch.mjs` builds a self-contained zip for itch.io or any static host. It bundles three.js and `lib/page-audio.js` and drops the link back to the launcher. `ITCH=1 node game-065/dev/browsertest.mjs` plays that build with the three.js CDN blocked.
- **Worldroot** (game-065) v1.2.0: **the Wilds**, ten new systems around the core loop. None is needed to grow the tree, and all of them keep going while you are away ([game-065/js/sim/wilds.js](game-065/js/sim/wilds.js), [game-065/js/sim/wilds-data.js](game-065/js/sim/wilds-data.js), [game-065/js/ui/wilds-ui.js](game-065/js/ui/wilds-ui.js)).
  - **Spirit kinship:** each kind of spirit levels up with time owned, up to 20; +1.5% per level.
  - **Expeditions:** send parties to four Deepwood sites for 10 minutes to 8 hours.
  - **Relics:** 24 to find, in four sets with set blessings.
  - **Moonpetal garden:** eight herbs from 5 minutes to 12 hours, with a 6% glimmering variant.
  - **Whispers:** small rotating goals that pay amber.
  - **Mab's stall:** an amber shop with more parties and beds, faster herbs and trips, Bottled Starlight and four spark colours.
  - **Badges and titles:** fourteen badge tracks in bronze, silver, gold and starlit; 28 titles to wear under the counter.
  - **Feats:** 97 new achievements that pay amber and are counted apart from the 138, so Radiance and the core balance don't move.
  - **The Codex:** three pages of lore per spirit, opened by kinship.
  - **Balance:** the balance bots tend the Wilds too. Over twelve seeds the World Tree comes at 183 minutes for an active player (177 before) and 288 for a casual one (316), and an idle player's first rebirth at 310 (325).
  - **Tests:** `dev/simtest.mjs` gains a section for the Wilds (1,052 checks). `dev/browsertest.mjs` plays the Wilds by click on desktop and by touch on phones.
- **Worldroot** (game-065) v1.1.1: no more box flashing over the right-hand panel. The panel and HUD chips used `backdrop-filter: blur` over the WebGL canvas, which Chrome can drop or show stale for a frame when the panel repaints (hovering its buttons), so a panel-sized box blinked over the scene. They now use a plain, slightly more opaque tint. Hover transitions inside the panel no longer re-run the layout, and the canvas and bloom buffers are only reallocated when the size really changes.
- **Worldroot** (game-065) v1.1.0: every spirit and structure remodelled to match the new Fox Spirit ([game-065/js/view/models.js](game-065/js/view/models.js), shared parts in [game-065/js/view/kit.js](game-065/js/view/kit.js)).
  - **Treant**: a lumbering walking tree with root legs and splayed root toes, a gnarled ridged trunk with moss, a carved face (deep amber eyes, knotted brows, a nose knot, a mossy beard), branching arms with twig fingers and leafy hands, and a crown of short branches carrying separate leaf clusters, blossoms and glowing berries. Rolls from foot to foot as it walks.
  - **White Stag**: a deep-chested deer with jointed legs (knees and hocks that fold on the forward swing), a shaped head with muzzle, nose, ears and soft blue eyes, and silver antlers whose tines grow forward off beams that sweep back. Walks with a four-beat gait, then lowers its head to graze, ears flicking.
  - **Dryad**: a tree-maiden in a bell skirt of leaf petals with a gold hem, leaf hair flowing down her back, a flower crown and leaf hands; she twirls and the skirt swings out.
  - **Moonwell**: a ring of mossy boulders round a carved basin of moonlit water (ripples, a reflected moon, sparkles), lily pads, a glowing lotus, a softer beam and motes rising in it.
  - **Standing stones**: chiselled, tapered monoliths with lichen and moss, runes on the broad faces only, and fallen chips at the foot.
  - **Glowcaps**: lathe-turned mushrooms with a stem skirt, a domed cap with an upturned rim and spots, and fluted glowing gills.
  - **Star Seeds**: a faceted crystal cluster instead of a single octahedron. **Realm islands**: strata bands under the rock, a grassy top with a drooping lip, little trees, a pillared shrine round the realm's crystal and a waterfall of light.
  - Every creature glows faintly in its own colours (emissive × vertex colour), so it reads in fog and away from the tree's light.
  - **Draw calls**: `bake()` merges the rigid parts of each model that share a material, keeping animated joints separate, and eyes, pupils, glints and noses share one unlit vertex-coloured material. A grove with every spirit at its cap now draws 406 calls (548 before the remodel) at 570k triangles (306k before).
  - [game-065/dev/creature.html](game-065/dev/creature.html) shows any model close up (`?c=fox|treant|stag|dryad|well|stone|cap|crystal|island`); `__wr.creatureCost()` and `__wr.screens(kind)` help measure and frame them.
- **Worldroot** (game-065) v1.0.3: a new Fox Spirit ([game-065/js/view/fox.js](game-065/js/view/fox.js)). The old one was a flat-shaded blob with a cone head and stick legs; it is now a stylised kitsune built from smooth tapered tubes in one fur material with vertex colours (russet back, cream belly, chest, cheeks and tail tip, dark socks and ear tips) and a sheen rim, with a shaped muzzle and nose, two-tone ears, glowing slit-pupil eyes, a big bushy tail with foxfire and two little flames circling it. It trots with its legs in diagonal pairs, stops every so often to sit back and look at the tree, twitches its ears and swishes its tail, and glows faintly in its own colours so it reads in fog and away from the tree's light. Foxes, treants and stags also walked sideways round the tree (turned by −a − π instead of −a − π/2); they now face the way they go. [game-065/dev/creature.html](game-065/dev/creature.html) shows the fox close up from any angle.

### Fixed
- **Worldroot** (game-065) v1.0.2: no more frozen cloud of dots above the tree after clicking. Click sparks that finished their life kept their last position and colour with their size set to 0, and many GPUs still draw a size-0 point as one pixel, so every spark left a still dot where it faded; the fade-out was also computed but never applied. Sparks now carry an alpha that fades their colour, and a dead spark (and unripe crown fruit) is moved outside the clip volume so nothing is drawn. The browser test checks that every spark from a burst of clicks dies and none stays visible.
- **Worldroot** (game-065) v1.0.1: the distant forest no longer hovers above the hills. The ground was a `CircleGeometry`, a triangle fan with vertices only at the centre and the rim, so the hills existed only 300 units out and the surface under the forest was a straight slope up to ~5 units below where the trees were placed. It is now a polar grid (90 rings × 160 segments, denser near the tree) that matches the height function within 0.03 units, and trunks on slopes sink by the slope so the downhill side never floats.

### Added
- **Tootle Isles** (game-067) v1.0.0: a cozy toy-train sandbox in the spirit of LEGO Loco, in three.js r165 with no asset files and everything unlocked. Design notes in [game-067/game-plan.md](game-067/game-plan.md).
  - **Islands**: eight presets (Sunny Cove, Pine Peaks, Twin Isles, Coral Ring, Blossom Bay, Maple Hollow, Snowdrop Isle, Big Baseplate), each a seeded shape function cleaned up into beaches, meadows, hills and lakes, with seasonal ground, trees and weather. An optional starter town lays a loop round the biggest clear rectangle near the middle, with a station, homes, shops and a running train.
  - **Track by dragging**: each tile holds up to six segments (two straights, four quarter curves), so crossings and switches fall out of what you draw. A drag is a stroke that rewinds and re-lays on every move; loops close cleanly, loose ends turn to meet new lines, and starting beside a straight branches off it toward the nearer end. Water under track makes a bridge, a hill makes a tunnel with a stone arch.
  - **Trains that never crash**: look-ahead braking for buffers, stations and other trains, one reserved tile ahead so two trains can't step into the same tile, shunting out of dead ends, and nose-to-nose trains taking turns to back off. Vehicles ride on two bogies each through the curves. Train card: go/stop, three speeds, toot, turn round, station stops, ride along, back to the shed.
  - **Workshop and Train Shed**: five engines (steam, a little tank engine with an optional friendly face, diesel, bullet train, tram) and eleven car types in sixteen colours, a turntable preview, thumbnails, and a shed of sets shared by every island.
  - **Town**: 80 pieces in eight categories (homes, town, railway, fun, farm, nature, decor, water), with windmill sails, a Ferris wheel, a carousel and a hot-air balloon that move, boats that bob and a lighthouse beam at night. Homes bring residents who stroll, wait on platforms and ride.
  - **Play**: tap anything for a reaction (toots, waves and hellos, baas, moos, quacks, whirling sails), switch points, undo/redo, time of day with a full cycle, snow, petals and leaves, twenty stickers, and as many saved islands as you like with thumbnails, copies, renames, deletes and share codes. A photo button saves a picture of your island.
  - **Look and sound**: a studded baseplate, toy plastic with per-vertex night glow, minifig people, a sea shader with shore foam from a distance field, flat-shaded hills with snow caps and pines, clouds, gulls, fireflies, a tilt-shift diorama blur and a warm grade; a generative music-box score, sea and seagulls by day, crickets by night, and synthesised clicks, clacks, whistles, horns and bells.
  - **Tests**: [dev/simtest.mjs](game-067/dev/simtest.mjs) (purity, track rules, every preset on four seeds, trains, people, saves and a ten-minute soak) and [dev/browsertest.mjs](game-067/dev/browsertest.mjs) (the desktop flow with a real mouse, and touch-only phones with real touches).
- **Scrapwright** (game-066) v1.0.0: a steampunk COM-bot RPG in three.js r165 with no asset files. Design notes in [game-066/game-plan.md](game-066/game-plan.md).
  - **Midden**: a junk planet under a ring of dead starships. A scrap kid from Cinderwick rises through the Grand Gearworks Circuit to win the Starward Ticket off-world. 64 maps (9 towns, 8 routes, 6 dungeons, interiors and the Brass Crown Arena), 79 trainers, eight Forgemasters, the Rust Syndicate (Sgt. Slag, Madame Verdigris, Baron Oxide), the Furnace Four and rival Vex; tools (Steam Boots, Cutter Torch, Lift Coil, Hover Skiff, Arc Lantern) open the map as you go.
  - **250 COM-bots in 126 lines** and 16 types, each built from 78 procedural parts in seven slots. Parts set the base stats and bring techniques, and `js/view/botgen.js` assembles the 3D model from the same list. Evolution installs new parts and a trait, by level, by an upgrade kit or by sync, and shows what it installed.
  - **Getting bots**: catch wild ones with spikes, weld eleven dormant wrecks back to life in a timing minigame (better welds, better calibration), build eight from blueprints, and wake the titans after the story.
  - **Battles**: turn-based singles with 170 techniques (Kinetic, Energy, Utility), a 16-type chart, five statuses, five atmospheres, 55 traits, held modules and battle chips, and four AI levels. A typeless struggle move means no fight can stall.
  - **Crafting and trade**: materials from heaps and wild bots, 37 workbench recipes, Parts Exchanges with program cards, a 240-bot Locker, cogs (⚙) as currency.
  - **Look and sound**: noise-weathered brass, copper and rust materials, instanced junk piles, swaying wire-weed and oil-film sludge shaders, biome skies, bloom, a sepia grade with grain, fringe and heat haze, a gear-iris transition, particles and per-type technique effects; synthesised music themes, sound and dialogue blips. Four graphics tiers chosen from the frame rate.
  - **Tests**: [dev/simtest.mjs](game-066/dev/simtest.mjs) (purity, data, maps, battles, determinism, saves, and an autoplayer that finishes the story) and [dev/browsertest.mjs](game-066/dev/browsertest.mjs) (the desktop flow from title to Continue, and touch-only phones).
- **Worldroot** (game-065) v1.0.0: an idle clicker in a magical forest, in three.js r165 with no asset files. Design notes and the research behind it in [game-065/game-plan.md](game-065/game-plan.md).
  - **The World Tree grows for real**: one procedural skeleton (a trunk, fifteen limbs, over 300 branches and roots, and juvenile twigs that are shed as it matures) is merged into a single mesh whose segments each carry the tree level they grow at; the vertex shader slides them out, tapers the growing tips and thickens wood over time, so one uniform animates seed → sprout → sapling → World Tree. Instanced leaf clusters, glowing fruit and the camera framing follow on their own schedules. Bark with pulsing light veins, moss and snow.
  - **Twelve spirits, each alive in the clearing**: firefly swarms, glowcap fairy rings, dew sprites, lantern moths (GPU-animated points), fox spirits with foxfire tails, moonwells with light beams, a rune henge, walking treants, white stags that stop to graze, the aurora, a dancing dryad court and star crystals orbiting the crown.
  - **Systems from the best of the genre**: 15% cost growth with buy ×1/×10/×100/max, milestones every fifty owned, 143 upgrades (eight tiers per spirit, synergies, click upgrades, radiance from achievements, wisp and sap upgrades, stage upgrades), golden wisps (Lucky, Wild Bloom ×7, Kinship, Spark Storm ×777, Sap Spring), five sap spells, four seasons with bonuses, 138 achievements.
  - **Prestige**: rebirth for heartwood (more for a taller tree) with thirteen lasting gifts (starting levels, offline efficiency and hours, auto-touch, auto-buy spirits, upgrades and Nourish, a wisp catcher); six trials with permanent rewards; the nine Norse realms bound at the World Tree as floating islands.
  - **Offline progress**: catch-up in chunks through the real `tick()`, at 50–100% efficiency for 8–72 hours, with automation buying and nourishing while you are away and a summary when you return. A hidden tab counts too.
  - **World and polish**: night sky with stars, moon and aurora; wind-blown instanced grass, flowers, ferns and a forest that dissolves near the camera; seasonal palettes and falling petals, leaves and snow; bloom; click bursts, stage-up shockwaves and lore banners; a generative ambient score and synthesised chimes that follow the season's key.
  - **Phones**: a bottom sheet with tabs, a large Nourish button with a progress ring and hold-to-repeat, tap targets ≥ 38 px, the camera framing the tree inside whatever the HUD leaves visible.
  - **Tests**: [game-065/dev/simtest.mjs](game-065/dev/simtest.mjs): purity, data integrity, bulk-cost maths, offline equivalence and caps, save/load determinism, and bots (active, casual, idle) playing 48–72 hours with invariants every minute and pacing windows. [game-065/dev/browsertest.mjs](game-065/dev/browsertest.mjs): the whole desktop flow by real clicks, a two-hour absence, touch-only phones in portrait and landscape, blocked storage. [game-065/dev/pace.mjs](game-065/dev/pace.mjs) prints the balance table.
- **Kraken's Gambit** (game-064) v1.0.0: sea-themed chess in three.js r165 with no asset files. Design notes in [game-064/game-plan.md](game-064/game-plan.md).
  - **The chess is exact**: a 0x88 move generator verified by perft, with castling, en passant, under-promotion, check, mate, stalemate, the fifty-move rule, threefold repetition and insufficient material. SAN move log, undo, hints and autosave.
  - **Opponents**: five AI captains (Cabin Boy to Captain): negamax alpha-beta with iterative deepening, a transposition table, quiescence, killer and history ordering and a check extension, run in a Web Worker so the sea keeps moving while it thinks. Or two captains on one screen, with the board turning to face whoever moves next.
  - **The sea plays too**: after a move there is a chance (Mirror Calm 0%, Calm 12%, Choppy 22%, Tempest 38%) of one of eight events: the Kraken, a mermaid's song, a storm, a whirlpool, dolphins, a ghost ship, salvage divers and a sea serpent. Each can be switched off. Fairness rules reject any outcome that would remove a king, strand a pawn on the back rank, leave the side that just moved in check, or end the game by itself.
  - **Procedural, cel-shaded fleets**: parametric hulls with painted planks, copper and gunports; billowed sails with anchor and skull emblems; rigging, cannons, crowns, a seahorse figurehead, shields; striped lighthouses with glowing lanterns. Toon materials with three tone bands plus ink outlines.
  - **Creatures and weather**: suckered Kraken tentacles rebuilt every frame and a big-eyed head; a mermaid with a scaled tail and coral hair; leaping dolphins; a translucent ghost galleon in mist; a humped, horned sea serpent; a spiral whirlpool shader; storm clouds, rain, wind streaks and lightning, with one weather uniform darkening sky, sea and lights together.
  - **The world**: a chequered toon-water board shader (ripples, caustics, glints, every highlight read from a marks texture), a rope-and-piling dock with brass coordinate plaques, lanterns and cargo, palm islands, sea stacks, a giant lighthouse with a sweeping beam, clouds, gulls and ships on the horizon. Cannon fire, sinking and rising ships.
  - **Sound**: everything is synthesised: surf, gulls, creaks, cannon, a ship's bell for check, a stinger and a voice for each event, and an original D-dorian shanty on squeezebox, bass and tambourine.
  - **Controls**: mouse, touch (phone layouts in portrait and landscape) or keyboard (cursor + Enter, U/H/F/L/M/N/Esc). The HUD reserves its own screen space, so the board is framed around it.
  - **Tests**: [game-064/dev/simtest.mjs](game-064/dev/simtest.mjs): purity, perft, AI checks, 250 Tempest games with invariants after every ply and a mirror replay of what the 3D view does, determinism, undo and save/load. [game-064/dev/browsertest.mjs](game-064/dev/browsertest.mjs): the desktop flow with all eight events forced and played by real clicks, promotion, mate, hotseat, resume after reload; touch-only phones in both orientations; blocked storage.
- **Tee & Sorcery** (game-063) v1.0.0: a fantasy golf RPG in three.js r165 with no asset files. Design notes in [game-063/game-plan.md](game-063/game-plan.md).
  - **Story**: Lord Bogey shatters the Golden Tee and curses every hole; Pip pulls the talking wedge Wedgewick from a stone and wins back five Tee Shards. Nine short scenes with typed dialogue, voice blips and portraits rendered from the 3D characters, plus a mid-hole transformation and an ending with credits.
  - **Golf**: a pure 240 Hz simulation (heightfield ground, bounce and roll per surface, backspin on landing, capsule/sphere/box colliders, soft tree canopies, a cup that can lip out), four clubs, a three-press swing meter with PERFECT strikes, hooks and slices, wind, a preview arc whose length grows with Control, and an overhead view.
  - **Twenty holes in five realms**, painted from layered shapes the physics and the renderer share: Meadowmere (windmill, spring mushrooms, ponds), Sandsea Dunes (quicksand, an island green, a pyramid), Frostpeak (sheet ice, a frozen lake with holes in it), Cinder Caldera (lava rivers, geysers), the Sky Citadel (floating islands, cloud bumpers, a teleport rune, low gravity).
  - **Boss holes**: the cup is sealed until you beat the boss with your ball — Grubbins the Gopher King, Duneborn the sandworm, Big Frosty behind ice walls, the two-headed Double Bogey, and Lord Bogey, who becomes the three-headed Triple Bogey. Each takes a turn after your shot.
  - **RPG**: XP from holes and monsters, levels with stat points (Power, Control, Luck, Magic), the Pro Shop (six club sets, six balls, six charms, five consumables), five spells (Mulligan, Gust Ward, Fireball, Frost Step, Seeker), course pickups and power-up crystals, stars and personal bests, a floating-island world map.
  - **Look and sound**: chibi characters with painted canvas faces and ink outlines, a toon terrain shader (mown stripes, chequered greens, rippled sand, cracked ice, quicksand swirl, inked surface edges), masked water and lava, swaying grass, skies with painted clouds, stars and an aurora, bloom and a storybook grade with tilt-shift on the map; procedural music per realm, boss themes and a full set of effects.
  - **Controls**: keyboard and mouse, or touch (drag to aim, a big SWING button, spell and item buttons), portrait and landscape.
  - **Tests**: [game-063/dev/simtest.mjs](game-063/dev/simtest.mjs) (purity, determinism, content rules, physics invariants over random shots, RPG maths, story, bosses, and a search bot that plays every hole at par plus a noisy bot that finishes every hole) and [game-063/dev/browsertest.mjs](game-063/dev/browsertest.mjs) (desktop flow from title to boss hole, touch-only phones in both orientations, no console errors).
- **Rotten to the Core** (game-062) v1.0.2 (1.0.1 keeps dialogue, the menu and the waypoint list on screen on phones — they slid half off the left edge in portrait and off the top in landscape — and hides the touch buttons while a panel is open; 1.0.2 fixes loot that couldn't be picked up on phones — the invisible joystick area swallowed every tap in the bottom-left of the screen — and makes walking over an item pick it up, and ⚔️ with no enemy near grab the nearest loot or open the nearest chest): a light, silly Diablo with fruit, in three.js r165 with no asset files. Design notes in [game-062/game-plan.md](game-062/game-plan.md).
  - **Heroes**: grow a fruit (sixteen kinds, eight colourways, six eyes, six mouths, twelve hats) with a live 3D preview in town. Three classes, eighteen skills that scale from the weapon's damage: the **Melon Knight** (Slice, Rind Bash, Big Slice, Juice Up!, Pit Leap, Blender), the **Seed Ranger** (Seed Shot, Pomegranate Pop, Pip Spray, Somersault, Peel Trap, Raisin Rain) and the **Citromancer** (Zest Bolt, Caramelize, Brain Freeze, Chain Lime-ning, Peel-port, Melon Meteor). Crunch / Zip / Zest / Pulp attributes, ranks to 20, any skill on any button.
  - **Procedural levels**: three acts of four levels — the Root Cellar (rooms, corridors, pillar halls), the Jam Catacombs (rounded rooms, sticky jam pools) and the Rotten Core (caves, lakes of boiling fruit punch). MST + loop connectivity, flood-fill validation with retries, objects that would seal floor are removed, boss arenas at the far end. Crates, jam jars, cider barrels, exploding soda kegs, picnic-basket chests, Smoothie Shrines, mimic pies and quest objects.
  - **Monsters**: fourteen types with their own brains (zombie grapes, swarming flies, bony banana Peeltons and boomerang pitchers, burrowing Apple Worms in bowler hats, Eggplant Shamans that heal and revive, exploding tomatoes, acid lemons, needle-turret cacti, charging coconut crabs, blinking Jack o' Lanterns, Chili Imps, stinking Durian Brutes, Pie Mimics), champion packs and named uniques with eight affixes, and three bosses with telegraphed attacks and phases: The Juicer, Mangophisto the Chutney Lord and Durian the Diabolical.
  - **Loot**: kitchenware bases in tiers, Common / Juicy / Ripe / Golden rarities, 35 affixes, fourteen Golden uniques (The Big Squeeze, Grandma's Rolling Pin, Melon Collie, Fresh Prince of Bel-Pear…), a nine-slot paper doll, a backpack, a stash, comparison tooltips, identification by Deckard Cane.
  - **Tristrawberry**: Deckard Cane, Granny Smith, Grapeswold, Olivia and Kiwirt (with gibberish voices), shops, gambling, the Wishing Well waypoints, Portal Pies, six quests, three difficulties, autosaves in six slots.
  - **Look and sound**: lathe-built fruit with procedural skins, clearcoat and sheen, blinking faces and floating gloves; cut-away walls, per-vertex AO, a fog-of-war texture, a boiling fruit-punch shader, torches and a pooled light system, juice droplets and floor splats that stay, telegraph rings, frost novas, chain lightning, a watermelon meteor, bloom and a per-act colour grade. A generative score per area and synthesized effects.
  - **Controls**: click to move and attack, right-click and 1–4 for skills, WASD, hotkeys, loot labels; touch has a stick, an auto-target attack button and auto-aimed skill buttons.
  - **Tests**: [game-062/dev/simtest.mjs](game-062/dev/simtest.mjs): purity, 480 generated levels, determinism, 6 000 items, town and combat flow, every skill, and a bot that plays each class to Durian (33–55 simulated minutes, 0–5 deaths). [game-062/dev/browsertest.mjs](game-062/dev/browsertest.mjs): the full desktop flow with real clicks and keys, and touch-only phones in both orientations.

- **STARWRIGHT** (game-061) v1.0.0: a procedurally generated space sim in three.js r165 with no asset files. Design notes in [game-061/game-plan.md](game-061/game-plan.md).
  - **One seed, one universe**: 230 star systems in a four-armed spiral (with a void around the core), planets, belts, stations, points of interest, eight alien species (phoneme-based languages, procedural 2D portraits, temperaments, tastes, taboos), the player's ship design and every mission board come from a seed you can type, share, or pass as `?seed=`. The generator guarantees four Warp-I neighbours with a station, full reachability at Warp III, the core only at Warp V, and story sites within reach of each warp tier.
  - **Gathering**: a cutting mining beam with heat and rock hardness (eight rock compositions, ten raw resources), fuel scooping at stars, Helium-3 skimming at gas giants, planet surveys for data, derelicts, anomalies, caches and nav beacons.
  - **Hearth**: a derelict outpost you rebuild module by module (Command Core, solar, silos, refinery with parallel recipe lines, a raw reserve and a stock cap, fabricator, shipyard, research lab with 11 techs, hydroponics, drone bay, trade depot, defence grid, embassy, warp beacon). Power, storage, and raids while you're away. The 3D station is assembled from the modules you built.
  - **Ship**: five hull classes and eleven components (engine, thrusters, shield, armor, cargo, mining laser, weapons, scanner, warp drive, fuel tank, scoop), paint schemes and design re-rolls, with a showcase camera in the shipyard. Ships are procedural (lathe fuselage, wings, fins, nacelles, greebles) for the player, the Reavers, the hostile Swarm, the Lattice Wardens and NPC traffic.
  - **Trade and quests**: station markets priced by economy, species taste and supply (selling floods a market; prices recover), standing from Hostile to Allied, contraband, alien shipyards. Nine procedural mission types and an eleven-chapter story (the Lattice Signal) with an ending.
  - **Flight**: third-person chase camera, mouse steering, boost, cruise autopilot that routes around stars and planets, interdictions, light combat with aim assist and lead pips, loot with a tractor, death costs the hold but never upgrades.
  - **Look and sound**: per-system FBM nebula skyboxes, animated stars, one planet shader for nine world types (atmospheres, rings, city lights, lava glow), instanced asteroids with glowing crystal veins, bloom and a lens pass, a glassy DOM HUD with an Elite-style 3D scanner, galaxy and system maps, and a generative score with combat and docked layers.
  - **Controls**: keyboard and mouse, gamepad, or touch (relative stick, throttle rail, FIRE / MINE / BOOST / ACT / CRUISE / TGT).
  - **Tests**: [game-061/dev/simtest.mjs](game-061/dev/simtest.mjs): purity, determinism, galaxy rules on 50 seeds, 2 700+ missions, economy, flight, combat and a macro bot that plays the full progression to the ending. [game-061/dev/browsertest.mjs](game-061/dev/browsertest.mjs): the desktop flow from title to warp to death to continue, plus touch-only phones in both orientations.

- **BRICKVADERS** (game-060) v1.0.1 (1.0.1 recolours enemy shots red, pink and magenta and the ball white-and-cyan, so the two can't be confused; the boss orb is now an X-shaped star instead of the ball's shape): Breakout × Space Invaders in a 1983 arcade cabinet, in three.js r165 with no asset files. Design notes in [game-060/game-plan.md](game-060/game-plan.md).
  - **The fusion**: the STRIKER is a Breakout paddle and a laser base at once. Invaders and bricks share one marching formation (16 × 12 px slots that step on every beat and drop at the edges); the ball and lasers both damage them, the ball swats enemy bullets, and every five hits before the ball returns to the paddle add ×1 to a chain multiplier (up to ×5).
  - **Voxel raster**: every sprite pixel, brick, shield cell and logo letter is one instance of a single `InstancedMesh` of boxes, rebuilt each frame into a 240 × 320 render target. A narrow-FOV perspective camera makes z = 0 pixel-exact while debris, the brick logo and the wave assembly fly in real 3D; a shader bevels any box ≥ 3 px from its instance scale. Post: phosphor persistence, bloom, and a CRT pass with curvature, scanlines, an aperture grille, vignette, chromatic aberration and flashes.
  - **Content**: nine original invader types (gloop, buzz, peeper, tank, splitter → minis, mirror, builder, diver, captor with a tractor beam), five brick types (rainbow, silver, gold, TNT chains, prize), pixel-eroding brick-fort shields, drifting asteroids, the mystery ship (with the 23rd-shot 300-point trick), nine capsules and Nova bombs. Five sectors with 3D backdrops (lunar surface and Earth, neon nebula, tumbling asteroids, synthwave Synth City, the mothership's tunnel), 15 waves, five giant brick bosses with cores, gun ports, regenerating armour and phases (King Krabbo, the Saucerator, Rockjaw and its jaw, the Phantom Queen's tractor beam, the Overmind), four Galaga-style challenging stages, an ending and endless loops.
  - **Cabinet**: attract mode (assembling brick logo with a ghost ball, score advance table, capsule table, high scores, bot demo), raster menus, CADET and ARCADE, CONTINUE? countdown, three-letter initials, wave tallies; side art on wide screens.
  - **Sound**: synthesised effects, and music driven by the sim's beat clock (one beat = one formation step), so the march is the bassline and the song speeds up as the Armada thins; a song per sector, boss, challenge stage, title and ending.
  - **Controls**: mouse, keyboard, gamepad, and on phones a control deck (spinner pad, FIRE, NOVA, pause) under the screen in portrait or either side in landscape.
  - **Tests**: [game-060/dev/simtest.mjs](game-060/dev/simtest.mjs) has the bot clear all 48 stages of two loops in Node; [game-060/dev/browsertest.mjs](game-060/dev/browsertest.mjs) drives every flow, all 24 stages and the ending in Chromium, plus touch-only phones, with zero console errors.

- **Sister Circuit** (game-059) v1.0.0: a neon beat-'em-up in three.js r165 with no asset files. Design notes in [game-059/game-plan.md](game-059/game-plan.md).
  - **Story**: Juno Vega steals the VANTA-7 combat suit to rescue her sister Mika from Aurex Dynamics; the suit AI ECHO turns out to be trained on Mika's brain scans. Prologue, per-stage dialogue with 19 generated portraits, boss exchanges, stage epilogues and an ending.
  - **Procedural pixel art**: fighters come from a 2D skeleton rig (`js/art/rig.js`) and a palette-index rasterizer with outline rings, hue-shifted ramps and dithering; frames bake into index atlases and a palette texture, so variants, rage phases and Overdrive are palette swaps. Attack timing lives in the sim, so frames always match hitboxes.
  - **Rendering**: a 3D street (15 segment builders with procedural textures) in a 240 px render target, nearest upscale, bloom, CRT scanlines, and a separate parallax sky/skyline/tower scene drawn behind the pitched street camera.
  - **Combat**: hitstop, flinch / knockdown / launch / juggle / bounce, poise on big enemies and bosses, grabs with knees, throws, suplexes and vaults, thrown bodies as weapons, four pickup weapons, Arc Burst / Rail Dash / Meteor Drop, Overdrive, and four safehouse-unlocked moves. Eleven enemy types with attack-token crowd AI; seven bosses with phase 2s across eight fights.
  - **Stages**: Neon Row, Line 9 (gantries), Lantern Market, Ironwharf (forklifts, steam), Biolabs (laser gates), The Spire (elevator waves), Zenith (Mika assists against Magnus Hale's Ascendant form).
  - **Modes**: Story with saved progress, stage select and a safehouse, Arcade, Boss Rush, Survival, playable Mika; three difficulties, continues, ranks, high scores.
  - **Sound**: synthesised SFX and a generative step sequencer with a theme per stage and boss.
  - **Controls**: keyboard (double-tap run), gamepad, and a floating stick with ATK / JMP / SP / OVR buttons on phones, portrait or landscape.
  - **Tests**: [game-059/dev/simtest.mjs](game-059/dev/simtest.mjs) has a bot clear every stage, Boss Rush and Survival in Node; [game-059/dev/browsertest.mjs](game-059/dev/browsertest.mjs) drives every flow in Chromium on desktop and touch-only phones with zero console errors.

- **Bumble Basket** (game-058) v1.1.0 (1.0.1 fixes phone taps landing one fruit too low; 1.1.0 makes the dragged trail much easier to see: a coloured rope over the fruit, glowing discs, a rubber band to the finger and a count bubble): a light, casual fruit puzzle in three.js r165 with no asset files. Design notes in [game-058/game-plan.md](game-058/game-plan.md).
  - **Trail chains**: drag a bumblebee through neighbouring fruit (diagonals count). Each hop must share one trait the bee can sense with the previous fruit (kind, colour, size or family), so trails wander like a word ladder. Legal next hops glow, dragging back undoes a hop, and a tag names the trait each hop used
  - **Senses as progression**: the bee starts with Kind. Each garden (Sunny Orchard, Berry Patch, Giant's Garden, Tropic Tops) ends on a Set level that teaches the next sense, with a card explaining it. Each garden brings in more kinds, colours and sizes so the puzzles stay tight
  - **Set jars and power-ups**: one jar per sense asks for a set ("8 apples", "10 red", "10 large", "12 citrus"). Filling one earns a charge for the Honey Dipper (collect every fruit of a kind), Paint Pollen (neighbours take a fruit's colour), the Buzz Bomb (3×3) or Rainbow Wings (the next trail links anything). Power-ups never cost a move
  - **Content**: 30 levels with collect, golden, leaf and frost goals; ten blanket shapes; golden fruit from trails of seven; leaf piles and frosted fruit; stars from moves left; a free +5 moves when you run out; endless Picnic mode, where a basket every 40 fruit adds a new kind; a Fruit Album of 81 kind, colour and size stamps
  - **Presentation**: 16 fruit kinds modelled in code as merged vertex-coloured meshes, with faces that blink, beam in a trail and worry when they can't join. A gingham blanket drawn per shape, a meadow per garden (orchard trees, berry bushes, sunflowers, palms), a wicker basket that fills up, the bee, butterflies, juice splashes, sparkles, a pollen trail and DOM thumbnails rendered from the same models. The camera fit keeps the blanket clear of the HUD in portrait and landscape
  - **Sound**: a pentatonic note for every hop, pops, a buzz while drawing, and a plucked I–V–vi–IV tune with bass and shaker
  - **Tests**: [game-058/dev/simtest.mjs](game-058/dev/simtest.mjs) checks that the sim is pure, the level data is consistent, board invariants hold through bot games, every rule, power-up and obstacle, determinism and Picnic, and gates balance per level. [game-058/dev/browsertest.mjs](game-058/dev/browsertest.mjs) runs real Chromium on desktop and touch-only phones
- **Hivebreaker** (game-057) v1.0.0: a twin-stick shooter (Enter the Gungeon × Alien Breed) in three.js r165 with no asset files. Design notes in [game-057/game-plan.md](game-057/game-plan.md).
  - **Campaign**: five procedurally generated sectors (Hangar Deck, Barracks & Armory, Bio-Research Labs, Reactor Core, the Hive), each a tree of rooms on a macro grid joined by corridors and blast doors: combat rooms that seal and pour out two or three waves, armory crates, a Supply Depot, a Med Bay, an archive, and a boss arena. After the Brood Mother, cut Ellie Calder free and escape a timed route with three jammed bulkheads to hold, with Ellie following and shooting. Recruit, Marine and Nightmare difficulties; saves at every elevator
  - **Combat**: Gungeon-style dodge roll with invulnerability, grenades, the Shock Pulse (erases bullets), aim assist on touch and gamepad, nine weapons with three marks each and a Mk III special, seven timed power-ups, sixteen field upgrades
  - **The Brood**: skitter swarms, drones that lunge, acid spitters, bloaters, burrowers, armoured brutes, infested husks, wasps, cloaked stalkers and brood sacs, with alpha variants; bugs follow a flow field, telegraph their spawns at vents and never get pinned (props keep two-tile gaps)
  - **Bosses**: the Ravager (charges, stomp rings), the Goliath walker (minigun sweeps, missiles, armour that breaks), Specimen Zero (blinks, spirals, clones), the Magma Widow (fireball fans, eruptions, egg sacs, a ring of fire) and the Brood Mother (three phases of fans, curtains, double spirals, egg barrages and swarms)
  - **Presentation**: procedural floor shader (deck plates, grates, hazard stripes, vents, hive creep with pulsing veins, fog of unexplored rooms, a decal canvas for acid, blood and scorch), walls with light strips that dither away in front of the marine, a baked per-sector lightmap with alarm lamps, a shadowed flashlight and light shaft, vertex-animated instanced bugs with rim light, GPU particles, noise-eroded fireballs, shockwaves, beams, floor telegraphs, bloom and a grading pass with chromatic aberration, damage vignette and a low-health heartbeat. Synthesised weapons and bugs, a generative score with combat and boss layers, radio portraits, a motion-tracker minimap, a codex with rendered bugs
  - **Horde Mode**: one arena, endless escalating waves, a crate every five waves
  - **Controls**: keyboard and mouse, gamepad (with menu navigation), or touch twin-sticks with ROLL, grenade, pulse and USE buttons in portrait and landscape
  - Tests: [game-057/dev/](game-057/dev/README.md): `simtest.mjs` (purity, 200 generated sectors, determinism, tick invariants, every weapon, bug and boss, save round-trip, bot campaigns) and `browsertest.mjs` (Playwright, every flow on desktop plus touch-only phones in both orientations, no console errors)

- **Keepfire** (game-056) v1.0.0: a castle-defence take on Plants vs. Zombies with an incremental heart, in three.js r165, with no asset files. Design notes in [game-056/game-plan.md](game-056/game-plan.md).
  - **Lanes and the keep**: five lanes (one, then three, then five as the tutorial waves open them), a bailey of field squares in front of the wall (3 columns, up to 6) and per-lane towers whose tiers are stepped fighting platforms safe from melee. The castle model is rebuilt from its upgrades: towers rise tier by tier, the wall goes from a log palisade to stone to banded stone with banners, the keep grows a roof, turrets and a great tower with the Keepfire beacon, and the Forge, Treasury and Spiked Ramparts appear as you buy them
  - **Party**: eleven cards unlocked by wave (Archer, Alchemist, Knight, Palisade, Pyromancer, Frost Witch, Dwarf Bombardier, Cleric, Ballista, Druid, Storm Caller) with PvZ-style recharge, five damage types, levels to 10 and perks at 3, 6 and 10 (piercing and twin arrows, cleave, burning ground, freeze and shatter, bomblets, sanctuary, twin bolts, lane-wide roots, double chain lightning)
  - **Monsters**: thirteen archetypes (grunt, runner, shieldbearer, ranged, flyer, sapper, shaman, leaper, burrower, splitter, brute, siege, treasure carrier) and eight elite affixes; every species rolled per run from body plans (bipeds, quadrupeds and worms, flyers, slimes, wraiths and wisps, siege engines) with proportions, palettes, horns, ears, tusks, armour, helmets, weapons, names and voices
  - **Six regions and bosses**: Greenmarch (Bramblejaw the Warg King), Mirefen (the Mire Mother), Ashen Pass (Warlord Skarn), Frostfell (the Rime Colossus and its ice walls), Gloamhold (Morvane the Lich) and Dragonspire (Vael the Black Sun, who flies until half health), each with its own resistances, procedural battlefield, weather and a morning-to-night progression over its ten waves; then the endless Long Night
  - **Systems**: procedural waves (budget, roster introduced one archetype per wave, groups and a final horde flag, elites, treasure carriers); ember motes and powerup orbs to tap (eight powers in four rarities); the Keepfire lane firestorm; procedural relics after every wave (eight slots, replacing one when full) with legendary uniques; retries that keep the attempt's gold; Rekindling for Embers and a 13-perk Ember Tree; saves at every wave, offline Treasury income, a bestiary, tutorial hints
  - **Presentation**: merged low-poly models with vertex colours, static shadows, instanced HP bars and blob shadows, pooled particles and lights, bloom, budgets that keep big fights readable, synthesised SFX and a generative medieval score per region. The camera is solved to fit the play area; portrait phones see the lanes from behind the castle and landscape phones get a cropped, closer view
  - Tests: [game-056/dev/](game-056/dev/README.md): `simtest.mjs` (purity, per-tick invariants, determinism, save round-trip, every boss, a 60-wave bot campaign with a balance table) and `browsertest.mjs` (Playwright, every flow on desktop plus touch-only phones in both orientations, no console errors)

- **Rotorstorm** (game-055) v1.0.0: a top-down helicopter bullet-hell shooter in vanilla JavaScript and hand-written WebGL2 (no libraries, no asset files), with procedural levels, six bosses, a skill tree and a storyline. Design notes in [game-055/game-plan.md](game-055/game-plan.md).
  - **Campaign**: six operations along the Shattered Coast against MERIDIAN, a storm-steering AI, with briefings (radio lines, procedural portraits, recon map), timed in-flight comms and reactive barks, debriefs, and an epilogue shaped by the civilians you rescued. Cast: Castellan (OVERWATCH), Mbeki (SPARKS, the hangar), Ash (your captured wingman, later the Seraph's pilot, then your ally) and MERIDIAN
  - **Procedural levels**: six biomes (archipelago, jungle river, desert highway with mesas, ice shelf, neon city grid with a canal, lava fields and the Crucible platform) from value noise that runs identically on the CPU and the GPU, so ground waves spawn on the right terrain; open sea forced under the dreadnought. A director builds each operation from 20 biome-weighted wave templates, ramping in heat, with elite waves, three rescues, two salvage caches and a Warhawk mid-boss
  - **Enemies and bosses**: 20 archetypes (drones, jets, gunships, bombers, a carrier, mines, shootable SAM missiles, tanks, flak, SAM sites, bunkers, gunboats, icebreakers, fuel convoys with chain explosions, radars, rooftop turrets, walkers). Six multi-phase bosses with named spell cards: Tidewarden (turrets and silo, then the bridge), Mantis (laser scythes, pollen flowers, hive), Sandwyrm (segments, burrow ambushes, drill), Bastion (orbiting shield plates, snowflake lattices, bullets that stop and re-aim), Seraph (dashes, Gilded Cage, Mirror Dance decoys, a survival card) and MERIDIAN (nodes, Storm Eye lightning, Cleansing Rain, Last Light with Ash on your wing)
  - **Systems**: tiny hitbox and focus mode, graze-charged Overdrive, Thunderclap EMP, kill-chain multiplier, salvage pickups, winch rescues, armour/shield/Phoenix, ranks S–D with salvage bonuses, boss checkpoints, a 28-node skill tree in four branches (Chin Gun up to an Ion Lance, Ordnance up to an Arc Caster, Airframe up to Phoenix Protocol, Systems up to Storm Breaker) with free refunds, three difficulties, and the endless Stormfront mode that cycles biomes behind cloud banks
  - **Look**: terrain baked into chunks via MRT (lit albedo + material, emissive), decorated with sprite trees and huts and scarred live by craters and tank treads; animated water (glints, caustics, shore foam) and lava; cloud shadows, 16 dynamic lights and a night searchlight; one instanced, premultiplied sprite batch where alpha 0 means additive; channel-coded bullet sprites coloured by one shader; HDR bloom, shockwave refraction, chromatic aberration, weather (rain, sand, snow, ash, storm lightning), cloud banks, grading, grain; layered explosions, falling wrecks, debris with shadows, shell casings, rotor downwash, hitstop and slow-mo
  - **Sound**: synthesised rotor wash, guns, explosions, sirens and EMP; a generative soundtrack per operation (drums, bass, arpeggio, pads, a boss lead)
  - **Mobile**: relative-drag flying, FOCUS / EMP / OD buttons placed for portrait or landscape, adaptive quality, safe areas; keyboard, mouse and gamepad too
  - Tests: [game-055/dev/](game-055/dev/README.md): `simtest.mjs` (headless: purity, every operation with a god bot and a mortal dodging bot, endless mode, determinism) and `browsertest.mjs` (Playwright, the whole game on desktop plus touch-only phones, with the GPU terrain checked against the CPU's, and no console errors)

- **Pale Engine** (game-054) v1.0.0: a DOOM-style first-person shooter in three.js with procedural levels and monsters, set on Io in 2291. Design notes in [game-054/game-plan.md](game-054/game-plan.md).
  - **Levels from a seed**: 2 m cells with their own floor and ceiling heights (stairs, two-tier daises, sunken lava/acid/blood pits with bridges, crates, raised platforms, open-air courtyards); rooms joined by a spanning tree of A*-routed corridors that never touch anything else, blue/yellow/red locks on the critical path with keys in the zone before each lock, loops only inside a zone, secret closets behind fake walls, ambushes that teleport in when you take a key or enter the exit room, data terminals, barrels, decor. Every level is validated by flood fill (keys collected, doors opened) before you play it
  - **Monsters**: ten archetypes (hitscan Thralls, fireball Cinderlings, lunging Maw Hounds, Wailing Skulls, Gazers, Skitterer spider-turrets, Brutes with bolt fans and ground slams, Revenants with homing missiles, Hierophants that call down fire and raise the dead, rocket Juggernauts) rolled per run into named species with their own palettes, proportions, horns, eyes, spikes, tails and synthesised voices; sight and hearing, flow-field chasing, infighting, pain, stagger and blade executions, five elite modifiers. Guardians: Overseer Kell's mech, the Furnace Mother (births, fireball fans, jumpable shockwaves) and the Archon (orb rings, homing missiles, a sweeping beam, summons, pylon shields)
  - **Weapons**: Arc Blade, self-charging M-9 pistol, Scattergun, Twin Reaper, Shredder, Hellfire RL, Ion Lance, Rail Driver (pierces), Singularity Cannon (a black hole that arcs lightning before it collapses); viewmodels built in code with PBR and a generated env map, pump and break-action animations, ejected shells, vertical auto-aim
  - **Powerups and pickups**: Berserk, Overdrive, Haste, Aegis Field (inverted colours), Phase Cloak, Hazard Suit, Survey Drone, Soul Orb, two armours, Backpack, keycards
  - **Look**: about 40 per-pixel texture painters with height and emission, derivative bump mapping, baked lightmaps (shadows, AO, flicker map) plus 8 dynamic lights for flashes and projectiles, an actor shader with rim light, hit flash and dissolve, four skies (Jupiter, Io, a hell vortex, the void), particles, beams, decals, gibs, bloom and a final pass for damage, low health, heat shimmer and each powerup
  - **Story**: three episodes and ten levels with crawls, level cards, 27 data logs and VESPER's comms; an ending; Endless Descent with a guardian every fifth floor
  - **Sound**: synthesised weapons, monster voices, doors and pickups with stereo position and occlusion; a generative industrial-metal score that crossfades with the fight and adds a choir for guardians
  - HUD with a helmet portrait that cracks and bleeds, damage arcs, hit markers, an automap, intermission tallies with par times, codex, options (sensitivity, FOV, auto-aim, bob, shake, quality, retro pixels), saves and Continue; touch controls with a floating stick, drag-to-look and aim-while-firing
  - Tests: [game-054/dev/](game-054/dev/README.md) — `simtest.mjs` (headless: purity, every level on many seeds, a bot walking each through the real collision code, determinism) and `browsertest.mjs` (Playwright, the whole game on desktop plus touch-only phones, no console errors)

- **Legend of the Jade Wyrm** (game-053) v1.0.0: a *Legend of the Green Dragon*-style browser RPG that simulates the whole online experience with no server, framed in three.js. Design notes in [game-053/game-plan.md](game-053/game-plan.md).
  - **The LoGD loop**: forest fights as the daily budget (slumming, thrill-seeking, flawless-fight bonus), about 100 creatures across 16 levels each with a weapon and a death line, 24 forest events (fairy, the old man's guessing game, the outhouse, standing stones, mimics, a toll goblin, a golden egg…), 14 masters at the Proving Yard, a healer whose prices rise with level, death that takes your gold and 10% of your XP, and the Jade Wyrm at level 15 (it draws breath, then breathes fire). A Wyrm kill resets you to level 1 with a permanent gift (+5 HP, +1 forest fight, +1 attack or +1 defence) and the next of 25 titles
  - **Hollowmere**: weapon and armour shops whose stock is renamed as the village comes to respect you, a bank (interest, loans, transfers), the Crooked Antler (three drinks and drunkenness, gossip, the bard's daily song, flirting with Willa or Corwin up to marriage and a daily spouse bonus, a room that keeps you safe overnight, Dagny's bounties), stables with seven mounts, Madame Zorya's tent (séances with the dead, fortunes that are real hints, gem trading, five potions including a respec), the Moonlit Gardens, the Standing Stone for Wyrmslayers, Guildhall Row (join one of five guilds or found your own), the Deedkeeper's Lodge (29 deeds paying renown for name colours, a custom title and permanent extra forest fights), the Herald, the Hall of Heroes, the Roll of Warriors and raven mail
  - **The Pale Shore**: when dead, torment restless souls in the Barrow Field for Vorgath the Ferryman's favour, and buy resurrection at 100
  - **A simulated server**: 60 other players with personalities (newbie, veteran, roleplayer, braggart, bard, merchant, lurker), real-clock online schedules and their own progress. Each simulated day they fight, level up, die, slay the Wyrm, marry, join guilds, place bounties and hunt each other — and you, if you sleep in the fields — all reported in the Herald. In real time they log on and off, chat in six commentary channels, answer your posts by keyword, greet newcomers, answer newbie questions with real tips, react to your level-ups, deaths and Wyrm kills, and write back to your letters
  - **Presentation**: LoGD backtick colour codes in narration and chat, hotkeys on every action, auto-fight with a safety stop. The three.js layer draws an oak header beam with crossed steel swords and a painted jade-wyrm shield, a timber frame with iron brackets and torches (shader flames, embers) around a scene window, and behind it a low-poly diorama of Hollowmere — the inn, the forge, the bank, the yard, the stables, the tent, the gardens, guildhall row, a palisade, the fields, an instanced forest, the healer's hut, a misty graveyard on a grey shore and the Wyrm's mountain — with villagers walking about. The camera flies to each page's view, centred on the DOM window with `setViewOffset`; the sky, sun, moon, stars and lamps follow the game clock; procedural foes of nine body kinds lunge, flinch and sink, with floating damage numbers
  - **Saving**: three slots, autosave after every action, export to and import from `.json`; Adventurer pacing (sleep to start a new day) or Classic (a new day every 6 real hours)
  - Desktop three-column layout, tablet, and a phone layout with a bottom status bar and slide-up vitals and online drawers; generative music per area and synthesised SFX
  - Tests: [game-053/dev/](game-053/dev/README.md) — `browsertest.mjs` (Playwright, the whole game on desktop plus touch-only phones, no console errors) and `balance.mjs` (a bot plays the real combat engine; about 27 days to the first Wyrm kill)

- **Nightline** (game-052) v1.0.0: a lo-fi synthwave night-drive simulator in three.js — no goals, no crashes, just driving through a rain-soaked Blade Runner-style city with stops here and there. Design notes in [game-052/game-plan.md](game-052/game-plan.md).
  - **Endless city** built in 96 m chunks from a seed: a wandering road that can't loop back, five districts with their own fog, sky and lamp colours (downtown towers with cross streets and traffic lights, a paper-lantern night market, a skyway viaduct 19 m up with the lit grid below, a harbour with water, piers, cranes and ships, residential heights), shopfronts, blade signs, flat signs, animated billboards, edge neon, crown and aviation lights, steam vents, a skyline band with a pyramid arcology and gas flares
  - **Driving by intent**: cruise speed, lane requests with a blinker that waits for a gap (the gap grows with closing speed), adaptive cruise for you and all traffic, so nothing can collide; oncoming traffic, trucks, taxis, vans; spinners in the sky and a patrol spinner with a sweeping searchlight
  - **Stops** every 0.8–1.5 km: noodle bar, diner, charging station, skyway overlook, konbini, record shop, arcade, motel, laundromat and pier, each with generated names, a set piece, a framed parked shot, drifting description lines, one action and a night log
  - **Look**: a mirrored reflection pass for wet streets, street-lamp pools and headlight beams painted in the road shader, volumetric headlight cones, rain streaks raked by your speed, lightning; rendered at 240/360/540 lines with bloom, chromatic aberration, grain, ordered dithering and CSS scanlines
  - **Radio**: three generative stations (synthwave, lo-fi hip-hop, ambient analogue brass) with invented track titles, tape wow, reverb and vinyl crackle; rain, tyre hiss, motor whine, thunder, fly-bys, a siren, blinker ticks
  - Drift mode (the car drives itself and takes stops), chase / hood / low / cinema cameras, 4× PNG photos, settings, keyboard and touch controls, an attract mode behind the title
  - Tests: [game-052/dev/](game-052/dev/README.md) — `browsertest.mjs` (Playwright, desktop + touch-only phones, a fast-forwarded drift-mode drive checked every step for overlaps, NaNs and leaks, no console errors)

- **Sigilborn** (game-051) v1.0.0: a fantasy gacha auto-battler in three.js with toon shading, in the Summoners War / AFK Arena line. Design and research notes in [game-051/game-plan.md](game-051/game-plan.md).
  - **Procedural heroes**: 10 races, 12 classes, 5 elements, natural rarity 1★–5★ (6★ by evolution), HP/ATK/DEF/SPD rolls with an S–C grade, 24 traits, skill kits drawn from per-class pools with generated names, passives and leader skills, a 1-in-50 Radiant variant, and a full appearance (painted anime face, 16 hairstyles, ears, horns, tails, wings, 10 outfits, headwear, 14 weapons, auras) built into a chibi 3D model with merged vertex-coloured toon meshes and inverted-hull outlines
  - **Summoning**: seven sigils, soft pity from 60 and hard pity at 90, a 4★ floor per ten-pull, a weekly featured element + class, a 3D portal reveal that charges blue → purple → gold; the RNG stream lives in the save so reloads do not re-roll
  - **Battles**: Summoners War-style attack-bar turns, element advantage/glancing, 20 statuses, 125 skill templates with effects (buffs, debuffs, DoTs, ATB push/pull, shields, revives, extra turns), boss enrage, a turn-order bar, auto or manual (skill + target) play at 1×–3×, and Overlord spells from mana; procedural animation and effects (lunges, projectiles, slashes, meteors, pillars, shields, floating numbers)
  - **Content**: 8 campaign regions × 8 stages with eight bosses and biomes, 7 Rifts × 10 tiers, the Endless Spire (power ladder, guardians every 10th floor, pick-1-of-3 blessings every 5th), an Arena of generated rival Overlords with ranks and tokens
  - **Gear**: Sigilstones in 6 slots, 5 rarities, 12 sets, random substats, +0 → +15 enhancing with falling odds, reforging, crafting from mined ore steered by jewels
  - **Idle citadel**: a 3D floating island hub (real-clock day/night, wandering heroes) with the Treasury, Training Grounds, a diggable Mine with idle miners, a real-time Farm with watering and golden mutations, a Kitchen of elixirs and timed feasts, the Forge, an expedition board, upgradeable buildings and a "while you were away" summary
  - **Meta**: dailies + weeklies with activity chests, feats with titles, a 31-step main questline, a rotating Market, token counters, a Fortune Wheel, mystery chests and seed packs; the Overlord's level, talents and spells
  - **Character creator** for the Overlord, reused as every hero's Wardrobe
  - Mobile-first UI: Cinzel/Nunito, 16 px base, ≥ 44 px targets, portrait and landscape battle framings, adaptive render quality; WebAudio sound effects and a generative score
  - Tests: [game-051/dev/](game-051/dev/README.md) — `simtest.mjs` (≈30,800 assertions plus a 21-day progression bot) and `browsertest.mjs` (Playwright, desktop + touch-only phones, no console errors)

### Fixed
- **Lanterndeep** (game-049) v1.0.1: on phones the hero-select screen started above the top of the screen, cutting off the heading and the first hero card with no way to scroll back to them. Every screen was centred with `justify-content: center` inside a scrolling column, which pushes overflow above the scroll origin; screens now centre with auto margins (centred when they fit, scrolled from the top when they don't). On small screens unselected heroes collapse to name and tagline so all three fit, and portrait screens clear the fixed corner buttons. The browser test now asserts the hero select starts on screen on both phone sizes, and its debug spawn picks a tile with a clear line of fire so the targeting check is no longer luck.

### Notes
- **Library version audit (2026-08-27)**: checked vendored/pinned JS libraries against latest upstream. Nothing upgraded — recorded here for future reference.
  - **Kaplay**: pinned at `4000.0.0-alpha.26` (`lib/kaplay/kaplay.mjs` + `.js`); latest is `4000.0.0-alpha.27.1` (`next` dist-tag). Kaplay ships two incompatible tracks — stable `v3001` (`3001.0.19`, `latest` dist-tag) and experimental `v4000` (alphas). All games here use the v4000 API (see [docs/kaplay/](docs/kaplay/)), so stay on v4000 — do **not** move to v3001. Alpha.27 adds config-object RNG init (breaking if any game calls `new RNG()`/`setRNG()` with the old string/custom-rng param), plus `nextFrame()` and gamepad-type additions.
  - **Phaser**: pinned at `4.0.0` (`lib/phaser/phaser-4.0.0/dist/phaser.esm.js`); latest is `4.2.1`. Highest breaking-change risk of the three: removed classes (`Point`, `Mesh`, `BitmapMask`), reworked tint/shader/FX/lighting APIs, `DynamicTexture`/`RenderTexture` now require an explicit `.render()` call, `Shader#setTextures()` semantics changed. Affects game-019, game-020, game-027, game-028.
  - **three.js**: CDN-pinned (not vendored) at `0.165.0` / r165 via import maps in each game's `index.html`; latest is `0.185.1` / r185 — 20 releases behind. Affects game-014, game-018, game-024, game-025, game-026, game-029. Mechanically the easiest bump (just the version string, plus 8 hardcoded jsdelivr URLs in game-018), but r185 has a known breaking change around `updateWorldMatrix` worth checking for before bumping.

### Changed
- **Hearthbound** (game-033): Phase 6 — "The Long Season". The story was cut short in several specific places and its own text said so: every Phase 4 ending closed on *"this is where this slice of your story ends — for now"*, Hollow's *"something in the deep wood is changing what lives there, I don't know what yet"* was never answered, the Cellar Key was handed over and never used again, and "send for the watch" — the safe, sensible choice — ended the game in about six minutes. This pass finishes them.
  - **Story graph quadrupled**: 47 nodes → 195, ~2,200 words of dialogue → ~15,800, and split out of one file into `js/story/*.js` chapter modules merged into `STORY`. A single completionist route reads ~13,500 words over ~160 choices — comfortably over an hour of play before counting battles, brewing and shop days.
  - **The apothecary is finally a job**: a shop counter with brew-to-order customers, coin, a day counter advanced by sleeping and foraging, two forage sites, and a travelling peddler (`trade.js`) to buy materials from and sell brewed goods to
  - **The Cellar Key opens something**: your aunt's sealed workroom, holding her journal — which unlocks a new Journal panel (`journal.js`) of quests and collected lore, the Burn Salve recipe, and the hearth-stone plot the last act turns on
  - **Real hubs** (`shop_hub`, `village_hub`, `whisperwood_gate`, plus one per character) replacing a one-way corridor, and four new characters: Granny Sessily, Tobin, Peddler Ock, and Sergeant Dorne of the county watch
  - **The "called the watch" branch stops being a punishment** — the spears arrive, beating the hedgerows drives something into the village lane, and that is what walks Hollow across a hundred yards of cobbles she hasn't crossed in thirty years; the branch rejoins the main plot with its own scenes
  - **The hedge wolf can be fought, fed, or out-waited**, and has a den and cubs behind it either way; the climax likewise has a brewed and a spoken solution alongside the fight, in keeping with a design doc that calls its own battles "light danger"
  - **Eight new endings** (13 total) turning on whether the boundary hearth got lit, how you met the thing that came for it, and whether anyone was with you — plus a genuine cozy off-ramp for a player who came for the shop. All five Phase 4 endings stay reachable as deliberate early outs
  - Engine additions: `requires` gained `allFlags`/`anyFlags`/`noneFlags`/`minStat`/`minCoin`/`minDay`/`questActive`/`questDone`/`notItem`/`visited`; effects gained coin, day, rest, quest, lore, recipe-learning and trade-opening types
  - **Bug fixed**: losing the cellar slime left the player permanently without the Cellar Key, which once Phase 6 hung the workroom and journal off it would have silently locked out the entire last act. There's now a rematch and a standing route back down, with a test for it
  - Tests: new `game-033/tests/phase6.test.js` (44 cases) and `game-033/tests/smoke-season.playwright.mjs`; the Playwright drivers gained a `PW_CHROMIUM_PATH` override for sandboxes with a preinstalled Chromium

### Added
- **Tomebound** (game-050): a match-3 fantasy RPG with an idle village, in three.js r165 (import map, no build step, **no asset files**). Design doc: [game-050/game-plan.md](game-050/game-plan.md).
  - **Gem duels**: Puzzle Quest-style turns against a monster on one shared 8×8 board of 3D gems, each with its own silhouette (ruby, raindrop, emerald, lightning bolt, skull, coin, star, prism). Fire/Water/Leaf/Spark fill mana, skulls hit, coins are gold (monsters steal them), stars are XP. 4+ matches give extra turns; Line gems, Bombs and Prisms; cascades; reshuffles; an idle hint. The monster plays the same board with its own priorities and level-scaled sloppiness
  - **Hero**: Mage or Warrior, five stats, 19 spells (nine per class plus a book spell) with quick spells, spell ranks, four or five slots; procedural gear (four slots, five rarities, 17 affixes, generated names); six potions; shrine blessings
  - **The Library**: six procedurally mapped wings plus the Blank Margin — battles, elites, treasure, shrines, events, a Keeper and a Guardian per wing, patrols for grinding, bounties, and the Endless Stacks after the ending. Monsters are built from 14 families × 9 modifiers × names, with 23 monster spells, weaknesses and resistances, and a seeded toon-shaded 3D body assembled from parts
  - **The village**: a floating island with 13 plots and 13 buildings that produce in real time (and while the game is closed) into baskets you collect; forge, alchemist, mage tower, scriptorium, training yard, storehouse, clocktower; buildings unlock by hero level and by books, and every returned book raises their level cap. The Library heals visibly as books come home (ink blots vanish, the dome warms, the books orbit the spire)
  - **Thirteen lost books** with permanent unlocks and three study tiers; procedural quests (slay, match, combo, cascade, collect, upgrade, cast, flawless, potions, bounties); an upbeat authored story with Professor Hootsworth and the Unwriter, with three acts' worth of boss banter and an ending
  - **Juice**: mana orbs fly to the HUD, beams and shockwaves for specials, chain counters, hit-stop kicks, bloom; procedural SFX and a generative score (town, battle, boss)
  - **Verified** by `game-050/dev/simtest.mjs` (purity, board invariants with an event-replay mirror, determinism, bots finishing full campaigns with both classes, a per-wing balance table) and `game-050/dev/browsertest.mjs` (desktop flows, every wing's stage, save/reload/away, and touch-only phones in portrait and landscape)

- **Lanterndeep** (game-049): a turn-based 3D roguelike in three.js r165 (import map, no build step, **no asset files**). Design doc: [game-049/game-plan.md](game-049/game-plan.md).
  - **The Hundred Stairs**: 100 procedurally generated floors in ten worlds of ten (Rootcellars, Mirelight Grotto, Drowned Library, Ember Forge, Crystal Hollows, Ossuary, Clockwork Depths, Frostveil Abyss, Starfall Vault, Heart of Night). Four layout generators (rooms + corridors + loops, cellular caves, halls, rooms stamped into caves), liquids that are reverted if they would cut the floor in two, pillars, props, decor, wall torches, glowing decor, traps, braziers and sealed vaults with a key elsewhere on the floor; every floor is validated so the stairs are reachable
  - **Ten Wardens** on floors 10–100 (Gnawbone the Rat King, Mother Mycel, the Archivist, Forgemaster Brann, the Prism Wyrm, Lady Vesper, the Grand Orrery, Queen Isolde, the Watcher Between, the Hush), each a three-phase rotation of grid-telegraphed attacks — slams, burrows, spore rings, rune lines, hammer crosses, molten floors, full-length beams, rotating arms, blizzards, gaze beams, void collapses — that land after the hero's next move
  - **The lantern**: oil burns every turn and sets the light radius; tiles are visible inside the radius or wherever a static light (brazier, torch, lava, glowing fungus) reaches, so lit halls can be seen across the dark; out of oil, the Hush gathers. Each Warden's Ember widens the lantern for good
  - **Heroes**: Warden, Ranger and Emberwitch, four skills each (targeted skills use a tap/Tab/Enter targeting mode) and a choice of three perks every level from a pool of 29 (nine class-only)
  - **Loot**: 9 weapon bases, 4 armours, rings and amulets; Common/Magic/Rare with 25 affixes and generated names; nine authored Warden relics; 14 consumables (potions, scrolls, thrown bombs, vault keys); chests, mimics, shrines, fountains, merchants who buy, sell and refill oil
  - **Monsters**: 70 species on eleven behaviour archetypes (brute, skirmisher, pack, archer, caster, bomber with a telegraphed fuse, tank, summoner, ambusher, charger with a telegraphed charge lane, healer), statuses (burn, poison, bleed, freeze, stun, root, weaken, mark, fear), elites with ten affixes and generated names, and allies
  - **Quests**: Wayfarers offer bounties, culls (counted from a baseline taken on acceptance), lost heirlooms, rescues whose captive then fights beside you to the stairs, kindle-the-braziers and purge-the-nests
  - **Story**: *The Hundred Stairs* — a prologue, a chapter card per world, a scene before and after every Warden, and Maren's ten journal pages (one hidden per world) that unlock *The Long Dawn*, the best of three endings
  - **Rendering**: canvas-painted floor and wall textures with bump maps for every world; instanced tiles; a fog-of-war `DataTexture` every level material samples through one `onBeforeCompile` patch (smooth reveal, desaturated memory); walls cut away in the vertex shader between the camera and the hero; shader water, lava and void; procedural props, decor, doors, stairs, chests, braziers, shrines and people; a hero model per class carrying a flickering lantern light plus an eight-light pool assigned to the nearest seen sources; 70 monster bodies from eleven body plans and ten bespoke Warden models; pooled particles, projectiles, telegraph tiles and ambient motes per world; bloom and a grade pass (vignette, damage flash, low-HP heartbeat, darkness, chromatic shift); quality tiers with auto-downgrade
  - **Audio**: procedural SFX and a generative score per world (exploration bells, combat drums and arpeggio, a Warden lead) with a convolution cave reverb
  - **Phones**: tap a tile to walk there (stops when something new comes into view), tap an enemy to attack or shoot, tap yourself to wait or take the stairs, long-press to inspect, pinch to zoom, auto-explore and travel-to-stairs buttons, a quick-heal button; portrait and landscape layouts with 44 px+ controls
  - **Saves**: the whole run (including the RNG state) after every floor and every few actions; *Lantern* mode rekindles at the start of the world, *Ironwick* is permadeath
  - **Tests**: `dev/simtest.mjs` (bots play all 100 floors with each hero; purity, level validation, save round-trips, invariants and determinism; a per-world balance table) and `dev/browsertest.mjs` (Playwright: every screen and flow, all ten worlds and arenas, touch-only phones). They caught a hero teleported into a sealed vault with no key, blocking objects plugging the only corridor, auto-explore refusing the only path past a known trap, bots dithering at the edge of sight, freeze-lock chains, Warden summons as strong as the Warden, and a story button that lost its id
- **Launcher**: game-049 card, themed button and README entry.

- **SPINFRAME** (game-048): a turn-based sci-fi mech RPG whose combat is a slot machine, in vanilla JS (Canvas 2D + DOM, no libraries, no asset files). Design doc in [game-048/game-plan.md](game-048/game-plan.md).
  - **Every symbol fires**: Blade, Cannon (pierces armor), Missile (all enemies), Arc (chains), Shield, Repair, Energy, Scrap, Overclock wilds, Cores (scatter) and enemy-written Glitches. Paylines of 3+ from the left multiply (×1.5 / ×2.5 / ×4 per symbol), lines in one spin chain (+25% per link), 3 Cores start Overdrive (bonus spins ×2, enemies frozen), 5 hit the Jackpot.
  - **Reel control**: after landing, spend energy to nudge, respin, hold or purge a reel; projected lines preview as dashed traces. Enemies telegraph intents and attack the machine — jams, Glitches, energy drain, a rising tide, CERTAINTY, ZERO VARIANCE.
  - **Mech upgrades change the slot machine**: Reel Array (3→5 reels), Targeting Matrix (3→16 paylines, a fourth row), Reactor, Servos, Probability Core (wild/core density), Chassis (module slots), new Missile/Arc hardpoints, plus levelled weapons, armor, shield and repair. The frame's art shows what is installed.
  - **18 modules** with rarities, levels and rolled stat bonuses (Cascade Feed, Expanding/Sticky Overclock, Mirror Logic, Cluster Protocol, Echo Chamber, Arc Conductor, Overheat Valve…); **three skill trees** (Gunner, Guardian, Gambler, 24 skills); **six boosters**, also dropped mid-fight.
  - **Campaign**: seven chapters of procedural sector maps (skirmish, elite with affixes, Signal events, salvage, depot, repair bay, boss), seven scripted bosses with phases, and an authored story — *The Graduating Class* — in comm scenes with typed dialogue and generated portraits.
  - **Incremental**: a Refinery that banks scrap while you are away (8 h cap), Drone Bay, Sim Archive and Core Forge; exponential costs and K/M/B numbers; a contract board; an endless Sim Ladder; Threat levels after graduation.
  - **Juice**: real strips scrolling with motion blur, staggered stops with bounce and anticipation, chasing marquee bulbs, line traces, chain counters, cascades, orbs from the reels into the mech, slashes, tracers, homing missiles, chain lightning, explosions, shards, coin showers into the HUD, hit-stop, slow-mo, shake, aberration and BIG / MEGA / EPIC WIN banners, all under a per-frame budget; synthesised SFX and a generative synthwave score per chapter.
  - **Tests**: `dev/simtest.mjs` (purity, evaluator, 300 sector maps, a bot that plays the whole campaign with per-step invariants, a balance table, ladder, offline cap, save round-trip, determinism) and `dev/browsertest.mjs` (Playwright walk of every screen and node type, a boss in every chapter, touch-only phones in portrait and landscape).
- **Launcher**: game-048 card and README entry.
- **Ashes & Aces** (game-047): a Slay the Spire × poker solitaire fantasy roguelite in three.js. Design doc in [game-047/game-plan.md](game-047/game-plan.md).
  - **Combat is poker solitaire on a 5×5 table**: three Deals a turn; a filled row, column or diagonal fires as a poker hand whose multiplier scales every suit's chips — ♠ Blades damage the target, ♣ Staves hit all enemies, ♦ Coins give Ward, ♥ Hearts heal. Crosses (one card finishing two lines) and diagonals multiply further. Enemies telegraph intents and attack the table: Seal, Frost, Steal, Scramble, Ash, and Warden-only Flood/Void/Mirage.
  - **100 levels**: ten realms × ten-floor branching maps (battle, elite, mystery, merchant, campfire, treasure, Warden); ten scripted multi-phase Wardens; Ember Checkpoints at every realm gate; autosave after every node.
  - **Deck-building**: ten enchantments, 22 Arcana, 52 relics (procedurally named per run; nine Warden crowns), 8 elixirs, shops with card removal, campfire tempering, 16 templated events plus a hand-written interlude per realm.
  - **Story**: *The Last Hand* — prologue, ten chapters (prologue, interlude, Warden challenge and last words, epilogue) and three endings, one unlocked only by the Harlequin's Joker; plus a generated Chronicle of the run.
  - **Everything procedural**: card faces painted in canvas with normal and gold-foil maps (generated J/Q/K portraits, spirograph aces, Arcana sigils); monsters grown from genomes across eleven body plans with a shader patch for veins, rim light, hit flash and dissolve; Warden signature parts; heroes with generated names and looks; ten realm backdrops; a generative score per realm (map / battle / Warden) with baked Karplus–Strong harp, FM bells and taiko, formant choir and convolution reverb.
  - **Rendering**: two scenes in one composer — the realm with a solved camera, and a pixel-exact card layer — then bloom, a grade pass (vignette, grain, flash, aberration) and ACES tone mapping; quality tiers with auto-downgrade.
  - **Tests**: `dev/simtest.mjs` (bot plays whole 100-level runs; purity, evaluator, map, zone-conservation and determinism checks; a per-world balance table) and `dev/browsertest.mjs` (Playwright walk of every screen, all ten realms, touch-only phones).
- **Launcher**: game-047 card and README entry.
- **Launcher: personalized header**: the main page heading/title is now "Andrew Wooldridge's Games" with an "About me & more links" link to https://linktr.ee/triptych (the footer name links there too). The footer's "Total Games" count now reads `games.length` from `js/gamedata.js` via `#game-count` (the static fallback was a stale `9`).
- **Launcher: per-game versions**: every entry in `js/gamedata.js` now has a `version` field (semver), shown as a small `vX.Y.Z` badge next to the game's title on both the grid cards and the carousel. Initial versions were seeded from git history as `1.<commits touching the folder − 1>.0`. Going forward: new games start at `1.0.0`; bump the minor for new features/phases and the patch for bug fixes.
- **Quiverspire** (game-046): New game &mdash; an **Archero-style roguelite archer** in three.js r165 (import map, no build step, **no asset files**). Design doc: [game-046/game-plan.md](game-046/game-plan.md).
  - **Stand still to shoot**: the archer auto-targets the nearest enemy (preferring line of sight) and fires only while not moving; the first volley after stopping comes early, so stutter-stepping pays
  - **120 procedural rooms**: ten chapters of twelve stages (combat, angel, elite, boss) plus an Endless mode; mirrored layouts from seven patterns (scatter, pillars, bars, pools, lanes, ring, noise) of rock, pits and spike traps, re-rolled until the door and every spawn are reachable, with sealed pockets filled in
  - **12 enemy types** that all telegraph (laser sights, charge lanes, marked leap and bomb circles, tracking beams), elites at stage 6, and **5 multi-phase bosses** &mdash; the Swelling King, Hollow Marksman, Cinder Colossus, Tidecoil Serpent and Unlit Lich &mdash; that return Ascended in chapters 6&ndash;10
  - **29 abilities** (Multishot, Front/Diagonal/Side/Rear arrows, Ricochet, Piercing, Bouncy Wall, Giant Arrows, four elements, orbiting circles, spirit wisps, Aegis, Invincibility Star, Extra Life&hellip;), an opening blessing, angels, and Devil deals that cost 20% max HP forever
  - **Meta progression**: coins buy six ten-level talents; chapters unlock in order; Endless unlocks after chapter 1; best rooms and the Endless record are saved
  - **Procedural art**: per-biome floor painter (checker, grout, bevels, glowing cracks, grass, moss, runes, grain + bump map), a seven-look pit shader (water, lava, acid, ice water, chasm, void, sky), ten obstacle styles, 30 prop builders, per-biome light/fog/particles, and the hero, enemies and bosses modelled from primitives and hue-shifted per chapter
  - **Juice**: hit flashes, knock-back, damage numbers, element-coloured sparks, debris, shockwave rings, lightning arcs, hit-stop, slow motion, screen shake, FOV punch, a low-HP heartbeat vignette, bloom, soft shadows, adaptive quality tiers
  - **Audio**: procedural SFX and a seeded composer that writes each chapter its own loop, layering drums/arpeggio in fights and a lead for bosses
  - **Controls**: keyboard, gamepad, and a one-thumb floating joystick; &ge;44px tap targets; portrait and landscape phones
  - **Tests**: `dev/simtest.mjs` has a bot play every chapter and Endless headlessly, checking every tick that nobody leaves the room or stands in rock or a pit, plus determinism and `js/sim/` purity; `BALANCE=1` prints clear rates by talent level. `dev/browsertest.mjs` walks the real game in Chromium on desktop and touch-only phones. They caught a line-of-sight test that skipped tile corners, flyers parked out of reach over rocks, auto-aim wasting arrows on enemies behind walls, golems and elites trapped in or wedged into gaps too narrow for them (fixed with a wide-body path field and spawn check), a boss double-dipping landing and contact damage, endless summons pinning weak builds, knock-back flinging enemies out of the room, a fade that never lifted after a chapter clear, a stray NaN pixel that bloom smeared into a fully black frame, pits hidden under the ground plane, Headshot ignoring Endless scaling, and an Endless run freezing once every ability was maxed
- **PINBREAK '86** (game-045): New game &mdash; a **flashy synthwave pinball &times; breakout synthesis** in three.js r165 (import map, no build step, no asset files). Design doc: [game-045/game-plan.md](game-045/game-plan.md).
  - **Pinball half**: hold-and-release plunger lane, tapered flippers whose surface velocity (&omega; &times; r) shapes every shot, three pop bumpers, two slingshots, nudge with TILT, ball save, extra balls at 30k / 75k / 150k and every 100k
  - **Breakout half**: five brick layouts (40&ndash;59 bricks) that loop one HP tougher; explosive bricks with cascading chain reactions; power-up bricks whose pickups fall down the table and are **caught with the flippers** &mdash; multiball, fireball, flipper lasers, drain shield, wide flippers, double score; a chain-combo multiplier up to &times;8
  - **Juice**: bloom + a CRT pass (impact-driven chromatic aberration, scanlines, vignette, colour flashes); chrome balls reflecting a generated neon env map; ribbon trails; pooled sparks, tumbling instanced shards, shockwave rings, flares and 3D score popups under a per-frame budget so chains never white out; a table surface shader lit by every explosion; screen shake, FOV punch, hit-stop and slow-motion; glitching DOM banners
  - **World**: striped retro sun, wireframe mountains, twinkling stars and an endless scrolling grid floor, all pulsing on the music's beat; the glass thins toward the top so the sun glows through behind the bricks; the camera fits the table to any aspect ratio, phones included
  - **Audio**: procedural SFX (brick notes climb a pentatonic scale with the combo) and a look-ahead-sequenced 112 BPM synthwave track (Am&ndash;F&ndash;C&ndash;G) with side-chain pump that adds drums, arpeggio and lead as the table heats up
  - **Tests**: the physics is a pure seeded simulation, so `dev/simtest.mjs` has a bot play dozens of games headlessly and checks every 1/480 s sub-step for escaped, tunnelled or trapped balls; `dev/browsertest.mjs` walks the real game in Chromium on desktop and touch phones. They caught a flipper squeezing the ball through the funnel wall, the shield kicking a drained ball up behind a flipper, multiball balls spawning inside bricks, and a new wave materialising bricks around a ball in flight
- **The Story Thief of Greymantle** (game-044): New game &mdash; a **point-and-click fairy-tale adventure** in the spirit of King's Quest and *The Warlock of Firetop Mountain*, with the emphasis on storytelling and light inventory puzzles. Vanilla HTML/CSS/ES modules, Canvas 2D scenes and DOM text, no build step, no libraries, **no asset files**. Design doc: [game-044/game-plan.md](game-044/game-plan.md).
  - **Ten scenes painted in code** at 320&times;200 (gradients, glows, shape brushes) and reduced to a 37-colour palette through a 4&times;4 Bayer dither that leaves on-palette flats alone, so shapes stay crisp and only blends dither. Rowan is a paper-doll sprite with an 8-step walk in four directions and perspective scaling; eight NPCs breathe, blink and lip-sync.
  - **Sierra-style interface**: Walk / Look / Use / Talk bar (keys 1&ndash;4, right-click cycles), verb and item cursors, hover labels, A* walk-to-click with string-pulling, a satchel of 15 items to use on the scene, on each other, or on yourself.
  - **The story**: the stories of Brackenford are vanishing; Gran has forgotten Rowan's name; the Warlock is a father bottling every tale in the valley to find the ending that will wake his daughter. Puzzles are solved by understanding people: a troll who wants a story as a toll, a magpie who only trades for things that have been *loved*, a stone face whose riddles a child taught it.
  - **Eight deaths** with comic epilogues, each confirmed first and each undone by *Turn back a page*; a **Book of Tales** that writes the adventure in storybook prose as you play; a 200-point score; **three endings**, remembered across playthroughs, with Continue resuming just before the finale.
  - Procedural Web Audio: per-scene ambience beds and Elsie's music-box lullaby.
  - `dev/walkthrough.mjs` plays the whole game through the real UI &mdash; the perfect 200-point route, the other two endings, and deaths followed by restores; `dev/shots.mjs` screenshots scenes.
- **Glimmerglen** (game-043): New game &mdash; a **cozy village builder crossed with a Zelda-style adventure** (Stardew Valley meets Zelda). Vanilla HTML/CSS/ES modules, Canvas 2D for the world and DOM for menus, no build step, no libraries, **no asset files**. Design doc: [game-043/GDD.md](game-043/GDD.md).
  - **One seed makes everything**, chosen in the character creator (name, pronouns, skin, 8 hair styles, colours, accessory, village name): a 160&times;160 overworld (the Glen, a ring of ancient thicket, five biome sectors reached through one gate each), road networks, secret pockets, 10 dungeons/caves of 5&ndash;6 floors, 20 monster species and 5 bosses, 12 villagers and the Mayor (faces, personalities, gift tastes, story fill-ins), the job board, the weather, every sprite (tiles, trees, buildings, people, monsters, 200+ item icons) and the music
  - **Farming and animals**: 16 crops over four 12-day seasons with watering, regrowth, out-of-season deaths, sprinklers and a greenhouse; coops and barns with chickens, ducks, cows, goats and sheep, hay, petting and affection-driven produce
  - **The village**: 18 overgrown lots opening with village level; 15 buildings; applicants of 12 trades who each need a matching home/shop; daily Storehouse contributions, shops, refining stations and passive effects from every villager; friendship, gifts and birthdays; a **three-chapter personal story per trade**; five village levels driven by coziness, celebrated by the Mayor
  - **The Job Board**: seeded daily postings (gather, hunt, deliver, delve, expeditions) you take yourself or **assign to 1&ndash;2 villagers** with a success chance from job fit, level and happiness; results arrive in the morning report
  - **Crafting**: a workbench, 8 refining stations (furnace, forge, sawmill, mill, loom, dairy, preserves jar, herbal still), blacksmith tool upgrades, weapon/armour/ring forging, gem sockets for weapon elements, and **32 cooking recipes discovered** in chests, glimmers, stories, the Library and the Café
  - **Adventure**: five regions gated by thornwalls, boulders, shallows and a dark hollow, each opened by the previous dungeon's relic; dungeon seals that break at each village level; **faded magic** (shrines, fairy rings with fast travel, moonwells, heart acorns, star fruit, caches, recipe scrolls) invisible until the Heartwood heals; keys, locked stairs, hidden cave stairs, return runes
  - **Turn-based combat** with visible enemy intents (attack, wind-up, unleash, guard, elemental, heal, curse, summon), elements, five learnable skills, items, first strikes from swinging at a monster, companions with trade skills, and three-phase bosses
  - **Main quest**: prologue + five chapters + a festival finale (the Heartwood blooms), then a post-game
  - **Audio**: a seeded composer writes a 16-bar AABA tune per mood (glen day/night, each biome, dungeon, cave, battle, boss, festival) for pad, music box, flute, reed, bells, bass and soft drums, with crossfades and rain; ~60 synthesised effects
  - **Phone first**: a floating joystick, a context-sensitive A button, B to run, tappable hotbar, big-target DOM panels, a crisp text overlay over a whole-number-scaled pixel canvas; keyboard fully supported
  - **Saving**: three slots + autosave on sleep, save-file export/import; the world is regenerated from the seed and only edits are stored
  - **Harnesses** in `game-043/dev/`: `simtest.mjs` (180 checks incl. a bot playing the whole main quest), `gentest.mjs` (7,320 checks over 80 seeds), `balance.mjs`, `mobiletest.mjs` (51 touch-only checks, portrait and landscape), `flowtest.mjs`, `shots.mjs`, `tour.mjs`, `sprites.mjs`, `perf.mjs` (60fps, ~1.5ms per frame of drawing)
  - **Bugs they caught**: a region made unenterable by roads over natural shallows (you need the Lilypad Charm found *inside* it); a sign, a cave facade or a fairy ring landing on the only road; a cave walled in by cliffs; pressing A at a door facing your own tile; a boss healed for 30% of its own HP every other turn; level-1 players losing 95% of fights to pairs; Glim intercepting the shard hand-in; a dialog timer outliving its dialog
- **Popgun Pip** (game-042): New game &mdash; a **light-hearted 8-bit platformer: Mario-shaped worlds with Metroid-style unlocks and shooting**. Vanilla HTML/CSS/ES modules and Canvas 2D, no build step, no libraries, **no asset files**. Design doc: [game-042/GDD.md](game-042/GDD.md).
  - **Five islands, 25 procedural levels** grown from one save seed: segments (gaps, stairs, pipes with chompers, ? rows, floaters, springs, lifts, spikes, low caves, firebars, crushers, lava pits) chosen per theme and bounded by what Pip can do with the gadgets that world assumes; four levels and a boss castle per island, an overworld map with walking between nodes
  - **Metroid layer**: pockets between segments &mdash; high shelves (Spring Boots), bubble stairs (Frost Ray), 13-tile shafts (Sticky Mitts), red-rock vaults (Rocket Popper), cracked-floor basements (ground pound) and hidden-block shelves &mdash; hold 60 Sun Shards, four heart containers, the Spread Shot and three power chips. The map records the gates you've seen per level and greys the icons you can't open yet; the Keep needs 36 shards
  - **Solvability is tested with the real physics**: `js/validate.js` runs `stepPlayer()` from every standable cell with walks, edge jumps, four jump heights with and without a run-up, timed double jumps, a reactive wall-climb and a ground pound, and BFS over the landings. The generator re-rolls a sub-seed until the exit and the non-gated shards are reachable with the world's baseline gadgets (~115ms median per level); `dev/gentest.mjs` also asserts every gated pocket is unreachable without its gadget and reachable with it (3,423 checks over 250 levels)
  - **Moves & weapons**: variable jump with coyote time and buffering, stomp chains to a 1-UP, ground pound, double jump, wall slide/jump; Pea, Spread, Frost (freezes foes into platforms) and Rocket (splash, breaks red rock and bricks), aimable forward/up/diagonal; Berry, Rainbow Star, Hot Pepper, Bubble Shield and 1-UP power-ups; pits cost a heart rather than a life
  - **Twelve enemies and five bosses**: Chompo, Sir Sandsnake (segmented, only the head is soft), Glimmerjaw (hurt only while its eye is open), Nimbus Grump (telegraphed lightning columns) and three-phase King Grumblewort
  - **Rendering**: the canvas backing store is the game's pixel buffer, sized so CSS scales it by a whole number of device pixels (5&times; on a typical phone); NES 2C02 palette; hand-drawn character strings; procedurally painted tiles in 16 exposure variants per theme; three-layer parallax backdrops; a dithered abyss so bottomless pits never read as ground
  - **Audio**: a chiptune composer (pulse waves at 25%/12.5% duty via `PeriodicWave`, triangle bass, noise drums) writes an AABA song per level from a seed and the world's mood; look-ahead sequencer; ~50 synthesised SFX and fixed jingles
  - **Phone first**: portrait is a handheld (screen on top, D-pad / A / B / SWAP deck below); landscape floats the controls over the corners; every control &ge;44px; the &larr; Games link hides during play and returns in the pause menu
  - **Harnesses** in `game-042/dev/`: `gentest.mjs`, `simtest.mjs` (46 checks on the real sim incl. a bot beating every boss), `mobiletest.mjs` (CDP touch only, 38/38 portrait, 33/33 landscape), `flowtest.mjs` (the whole screen state machine) and `shots.mjs`
  - **Bugs they caught**: a shaft room's ceiling had a hole where its floor did, so the Mitts gate leaked to anyone with Spring Boots; a red-rock bunker five tiles tall that single-jumpers couldn't climb, blocking a World 1 route; the validator's wall-climb program kicked off the room's walls forever and never landed; a stomped snail shell got kicked by the same stomp a frame later; the flagpole only triggered from mid-air, so walking into its base block did nothing
- **Burrowguard** (game-041): New game &mdash; an **8-bit arcade fusion of a digging game, a tower defence and a maze chase**. Vanilla ES modules, no build step, no libraries, **no asset files**.
  - **One system, three genres**: monsters follow distance fields rebuilt whenever the dirt changes, and the walkers' field runs through tunnels only &mdash; so the tunnels the player digs *are* the maze the monsters walk. Digging pays gold (ore in every dirt cell, pellets in every pre-dug tunnel), gold buys towers built into dirt, and a careless shortcut between two corridors reroutes the whole horde past them
  - **Hands-on arcade verbs**: a harpoon that pumps a monster until it pops (more points deeper down, double for a drake from the side), boulders that fall when undermined and crush what's below (1000/2500/4000...), four power gems per board that frighten every monster for a Pac-Man-style eating chain, and a bonus veggie after 60 dots
  - **Five enemies that each break a rule**: grub (baseline), skitter (fast, fragile), drake (stops and breathes fire along a row, through dirt), stalker (hunts the miner, phasing through dirt as a pair of untouchable eyes), borer (armoured, drills its own shortcut to the core when the maze is long enough to be worth it) &mdash; plus a crowned King on every sixth wave that ignores power gems
  - **Four towers, three levels each**: Blaster (homing shots), Frost (slowing aura), Arc (chain lightning), Boomer (lobbed splash shells); rounds of six waves, each on a newly generated board, with tower salvage carried forward
  - **Renderer**: a hand-written WebGL 1 sprite batcher (one atlas, device-pixel quads, rotation/flip/tint/silhouette), a *sharp bilinear* fragment filter so 16px art stays crisp at non-integer scales, atlas extrusion so opaque tiles don't seam, neon vector-style tunnel walls and rings, and a quarter-res bright-pass &rarr; separable blur &rarr; composite with scanlines at the sprite-pixel pitch. HIGH/LOW quality with an automatic one-way drop after three seconds under 40fps
  - **Phone-first controls**: a relative thumbstick that anchors wherever the thumb lands (anywhere off the field and buttons) and drags its anchor along past the rim for quick reversals; a PUMP button for the other thumb; a build tray that becomes UPGRADE/SELL for a selected tower; all targets &ge;44px; separate portrait and landscape layouts; safe-area aware
  - **Harnesses** in `game-041/dev/`: `simtest.mjs` (138 assertions on the real sim &mdash; 200 generated boards, digging, pathing, towers, harpoon, gems, rocks, stalker ghosting, borer drilling, drake fire, a full round, determinism, sim cost), `balance.mjs` (two bots with an invincible miner, which set the HP curve), `mobiletest.mjs` (an emulated phone driven only by CDP touch in portrait and landscape: 65 checks each) and `shots.mjs` (real-Chromium screenshots at three sizes)
  - **Bugs caught by them before shipping**: 52 of 200 generated boards had a shaft that missed the corridor above it, leaving the spawns with no route to the core; the renderer's shader program was stored on `this.sprite`, silently replacing the `sprite()` method; and a 100% round-end refund let a do-nothing tower bot reach round 8
- **Starcadet** (game-040): New game &mdash; a **vertical bullet-hell shmup in three.js r165 whose central system is rescue, not score**. ES modules, no build step, and **no asset files at all**: every ship, bullet, starfield, explosion, comms portrait and sound is generated in code.
  - **The premise is the mechanic.** The Chorus takes Halcyon Flight Academy mid-examination; the instructors die in the first ninety seconds and the only thing left flying is a *trainer* &mdash; practice cannons and a tow hook rated for towing target drones. 211 classmates are in escape pods. Shooting is how you survive; **hooking pods is how you win**. Pods drift down slower than the scroll, enemies shoot them, and one that falls past the bottom of the screen is gone for the rest of the run &mdash; so the safe lane is precisely where the cadets are not. The HUD tracks `SAVED / LOST` next to the score because the headcount is what the ending is based on.
  - **Six levels, each with its own animated `ShaderMaterial` backdrop** (station hangar ring, a banded gas giant with lightning in the cloud deck, shipbreaker rings, an organic seeder field that pulses on the beat, the inside of the alien tether, and the burning station on the final climb), three parallax star layers, real `UnrealBloomPass` bloom, camera lean and shake, and hit-stop on big kills.
  - **14 enemy archetypes over a 12-pattern emitter library** (aimed, fan, ring, spiral, whip, wall-with-a-gap, rain, homing, telegraphed laser, hanging nova, flower, cluster) &mdash; a Shieldbearer whose frontal plate eats anything fired from below, a Popper that splits into three drones and leaves a nova, a Carrier that drops pods when it dies, a Minelayer, a beat-locked Choirling swarm, and an elite Seraph. A level introduces at most two new types and gives each one a wave to itself first.
  - **Six multi-phase bosses**, all data-driven (HP thresholds, movement scripts, attack cycles, and a visible windup on every attack): a hijacked cargo loader with sweeping claws, a harvester that hides in the cloud deck, a scav battleship whose **four destructible turrets each remove an attack from its cycle**, a Choirmaster whose patterns land on the downbeat by construction, your own flight instructor using the drills he taught you (including a flare that erases *your* bullets), and the Chorus Heart &mdash; whose final pattern **opens one safe lane per named classmate you rescued**.
  - **Rescued cadets are the build progression**: five named classmates, one held at the end of each of the first five levels, each granting a permanent ship ability (self-repairing flares, a drone that mirrors your fire and eats a bullet every six seconds, faster Overdrive charge from grazing, a wider pickup magnet, +1 flare capacity with a lingering burn field). Four endings are gated on the final headcount.
  - Shmup fundamentals done properly: a 0.17u cockpit hitbox against a 1.6u ship, a focus mode that halves speed and shows the dot, a 0.2s **death-bomb window**, graze scoring that feeds an Overdrive meter, four weapons at five power levels with a measured DPS curve, three difficulties that scale bullet speed, pattern density and enemy HP, level select with per-level bests, rebindable keys, and touch controls.
  - **Architecture:** `js/sim/` is a pure simulation that imports neither three.js nor the DOM and never calls `Math.random` (it runs on a seeded RNG at a fixed 1/120s timestep); `js/view/` is a thin layer that reads the world each frame and syncs meshes. That split is what let the Node harnesses in [game-040/dev/](game-040/dev/README.md) run real levels, real boss fights and a full six-level campaign with no browser at all &mdash; `check.mjs` (structure, including that every DOM id the code looks up exists in `index.html`), `simtest.mjs` (30 assertions on the real sim), `rendertest.mjs` (the **real** view layer against a deliberately hostile fake three.js that throws on NaN transforms, undefined colours and disposed-but-still-drawn resources), `boottest.mjs` (main.js's state machine, title to level-clear), `balance.mjs` (three scripted bots) and `playthrough.mjs` (a campaign to an ending).
  - **Bugs those harnesses caught before the game ever ran in a browser**: `disposeObject()` was disposing the *shared cached geometries*, so killing one enemy would have freed the GPU buffer out from under every other enemy of that type; the rescue economy could return **357 cadets out of a roll of 211** because pod budgets counted pods while the story counted people; boss HP was set against nominal DPS rather than the 35&ndash;45% a dodging pilot actually lands, so three levels could never be finished; a boss whose HP reached zero by any path other than a bullet sat in its last phase forever; explosions still in flight leaked across a level change; and one stray mouse movement permanently disabled the keyboard.
  - Difficulty is tuned against numbers rather than guesswork: three bots with different priorities play every level, and the gap between them is the intended gradient &mdash; the reckless bot recovers 206 of 211 cadets and dies 98 times, the cautious one dies 17 times and leaves 78 cadets behind.
  - Also verified in a **real browser** &mdash; Chromium, real WebGL, the genuine three.js r165 &mdash; by `dev/browsertest.mjs`, which loads `index.html` unmodified and drives title &rarr; intro &rarr; briefing &rarr; live play &rarr; a boss fight &rarr; flare &rarr; pause &rarr; a 390&times;844 phone viewport, screenshotting each step and failing on any console error, page error or failed request (the CDN is stubbed from a local copy of the same package, because this sandbox blocks unpkg). That pass caught four things no headless harness could: the backdrop plane's edges were visible on screen, the starfield was bright enough to be mistaken for bullets, the launcher link sat on top of the score, and the weapon readout ran off the right edge of a phone.
  - **Built for a phone, and verified as one.** `dev/mobiletest.mjs` runs an emulated iPhone-class device (touch, `isMobile`, dpr 3) driven *only* by touch input through CDP &mdash; tapping through the menus, dragging to fly, firing flares, holding focus, pausing &mdash; in both portrait (390&times;844) and landscape (844&times;390). The mobile build is not the desktop build with bigger buttons:
    - **Dragging is relative, not absolute**: the ship moves by the finger's travel rather than jumping to it, so a thumb anywhere on the glass flies the ship and never covers the bullets it is dodging. Overshoot at the arena wall is absorbed into the anchor, so there is no dead zone dragging back, and the anchor is re-taken on respawn, level start and unpause.
    - **Two thumbs, two corners**: FOCUS / OVERDRIVE / FLARE stack bottom-left, pause sits top-right away from where a thumb rests, and every control &mdash; including the menu buttons and the launcher link &mdash; is at least 44px.
    - **Auto-fire is forced on touch**, because there is no fire button by design and the option would otherwise hand a phone player a ship that cannot shoot.
    - **Quality tiers**: a coarse-pointer device starts one tier down (smaller pixel ratio, softer bloom, three FBM octaves in the backdrop instead of five) and drops another automatically after three consecutive low-frame-rate samples; Options &rarr; GRAPHICS overrides it. The full-screen scanline overlay is dropped on mobile, since it is pure fill rate.
    - Bugs that pass caught: dragging teleported the ship up to 3.3 units on first touch; the on-screen buttons covered the Overdrive and level meters; a CSS specificity slip rendered the pause button at 64px on top of the ship readouts; the top HUD row *overflowed* 390px, and an overflowing flex row with `space-between` silently pushes its last child off to the right; in landscape the menus could not be scrolled by finger at all (`touch-action: none` on `body` also disables scrolling inside overlays), so the LAUNCH button below the fold was simply unreachable; the comms panel sat on top of both the OD button and the player's own ship; tapping a key-rebind button on a phone stuck the options panel on "PRESS A KEY&hellip;" forever; nothing marked the arena walls, which on a landscape phone are the middle ~40% of the glass; and long banner strings were clipped by the text-sprite canvas ("1. HANGAR RING" rendered as "ANGAR RI").
  - `dev/perf.mjs` measures the simulation's own cost per rendered frame &mdash; about 0.1ms p95 with 200 live bullets, against a 16.7ms budget &mdash; which is the part of "will it run on a phone" that can be answered without a phone GPU.
  - **Not yet done:** nobody has hand-*played* it. Pattern difficulty, dodging feel and boss pacing are tuned from bots and screenshots.

- **Wakeform** (game-039): New game &mdash; an **Atari-2600-shaped science fiction arcade game built around one original mechanic**. Vanilla HTML/CSS/JS ES modules, no libraries, no build step and no asset files: a 160&times;192 internal buffer (the real 2600 resolution) scaled with nearest-neighbour at a 2:1 pixel aspect, an 8-colour palette sampled per run from the actual Atari 2600 NTSC ramp, and every sprite, playfield and sound generated in code from the run seed.
  - **The mechanic is the game: you have no weapon.** The probe can do exactly one thing &mdash; invert its own polarity &mdash; and as it flies it continuously sheds **echoes**: frozen copies of the probe holding the position and polarity it had at that instant. Echoes are not decoration and not a trail. Each one exerts the *same* polarity force the probe does, so like-polarity motes are pushed away and opposite ones are drawn in and absorbed for score. Your movement history is physically present on the board and keeps working after you have flown away.
  - **So the player draws a machine rather than shooting or dodging**: a line of same-polarity echoes is a wall that steers motes sideways, two converging walls make a funnel, and a funnel ending in a knot of *opposite* echoes is a trap that holds motes orbiting until you come and harvest the whole cluster in one chain.
  - **A flux economy that forces the loop**: every echo shed and every polarity flip costs flux, flux regenerates slowly, and flying back through your own echoes **reclaims** them for a refund. An elaborate lattice you never revisit starves you, and a lattice that alternates polarity every few pixels is expensive &mdash; so efficient play means long single-polarity strokes, planned before they are flown. A wall spans roughly 26px of a ~540px ring, so the board can never be fully fenced.
  - **Five mote classes, each aimed at a different weakness in a lattice**: the drifter just comes; the splitter divides when repelled too hard; the inverter flips polarity periodically so a single-polarity wall cannot hold it; the leech is attracted to echoes and eats them, punishing lattices you abandoned; and the anchor is immune to force entirely and must be fetched by hand, prising you out of your nest. Every fifth wave is a surge from one arc of the ring.
  - **Deterministic and fully saveable**: three named localStorage slots plus an autosave between waves, capturing the entire live board &mdash; probe, every echo, every mote, wave, chain state, containment and the run seed, so the generated palette, playfield and sprites come back identical.
  - Verified without a browser by Node harnesses under [game-039/dev/](game-039/dev/README.md): `check.mjs` (every import resolves), `simtest.mjs` (the real physics, the flux economy, save/load round-trip, determinism), `rendertest.mjs` (the actual render loop against a strict fake Canvas2D that throws on non-finite coordinates and undefined fills), `forceprobe.mjs` and `balance.mjs`, which runs scripted bots so the curve is tuned against numbers &mdash; the "shepherd" bot that uses the wake as a tool reaches the maximum chain and the best survival rate, confirming the intended skill gradient.
  - Bugs caught by those harnesses before the game ever ran in a browser: the reclaim radius was wider than the echo spacing, so the probe ate its own wake on the following frame and **no lattice could ever form** &mdash; the core mechanic did not work at all; floating-point drift made `time` go slightly negative and JavaScript's sign-preserving `%` handed `drawImage` an `undefined` frame; two keydown listeners fought over Escape so pause reopened itself instantly; a good player could trap motes and stall the run at wave 1 forever; and echoes of opposite polarity could stack on one spot.

- **Emberbrood** (game-038): New game &mdash; an **8-bit procedurally generated dragon battler** where you fight, bind, raise and breed dragons. Vanilla HTML/CSS/JS ES modules, no libraries, no build step, and **no asset files whatsoever**: every dragon is drawn in code from its own genes, every sound is synthesised with WebAudio, and the whole 28-place country is a pure function of one seed string. Built phone-first.
  - **Turn-based battles in the Final Fantasy shape**: a party of three, turn order by speed with a visible queue, MP, Guard, eleven statuses each with its own cure item, an eight-element chart where two-element defenders produce genuine ×4 and ×0.25 matchups, and a shared Ember Surge meter that spends on a per-lineage ultimate. Bosses run phase scripts with a telegraphed wind-up turn, so the big hit is always answerable.
  - **Binding as a second win condition**: every wild fight can end with a capture instead of a kill. The odds are computed from health, status, level gap, lineage rarity, binding tier and Warden rank, and are **shown before you commit** &mdash; a failed throw costs the binding and the Warden's action, so it is a real tempo decision.
  - **Ashbound dragons can be brought back**, which is the emotional core of the capture loop: a grey, nameless, hostile animal hit with a Clearwater Draught or a Radiant cleansing move regains its colour and its true name mid-battle, and afterwards can brood again.
  - **A genome that draws its own sprite**: 12 lineages × body plan, wings, horns, tail, crest, pattern, size and colour genes decide stats, growth, temperament, traits *and* the 32×32 pixel art, which is synthesised from an indexed pixel buffer with pattern, shading and outline passes and cached by gene hash. Two baked frames give idle animation on one shared clock.
  - **Breeding that compounds**: each generation is worth 2% on every stat up to 10%, takes the better of three of its parents' essences, can carry two of their skills, occasionally fuses two elements into a third, and rarely throws back to an Elder lineage that had gone out of the family. Eggs incubate over battles and their shells are drawn from the child's real colours.
  - **87 items** across ten kinds (restoratives, cures, battle items, six binding tiers, food, training essences, 16 equippable relics in two slots, materials, breeding items, key items), a 14-recipe forge, act-gated shop stock, and one effect interpreter so an item behaves identically in battle, in the field menu and in a shop preview.
  - **Story and quests**: five acts from the Guttering Vale to the Hollow Sun, 18 main quests, 19 authored scenes, 12 side quests, procedurally generated notice-board work validated against what each region can actually provide, roost mini-dungeons, 12 field vignettes, and **three endings** gated on what the save can prove &mdash; one of which requires a dragon you bred yourself to third generation.
  - Architecture: `js/game/` and `js/gen/` never touch the DOM, so a complete playthrough (act I to an ending, all five bosses) runs headlessly in node. Tests: `test/run.mjs` (30 assertions covering genome determinism, the damage and binding curves, breeding inheritance, quest predicates and the save round-trip), three simulation drivers, `test/harness.html` for the browser, and two Playwright smoke tests.
  - Bugs caught and fixed during the build, all by those tests: `display:flex` beating the `hidden` attribute left an invisible overlay eating every tap; the `pagehide` autosave wrote an empty save from the title screen so a fresh browser was offered a game that did not exist; a scene ending in a choice rendered no button at all, making the final decision unreachable; levelling up raised max health without granting it; and cleansing an ashbound dragon re-applied the Hollowed trait and left it permanently unable to brood.

- **Lanternwake** (game-037): New turn-based tile game &mdash; a roguelike / Zelda-like fusion built from a 3,800-line design spec. Vanilla HTML/CSS/JS ES modules, zero dependencies, zero build step, and **no asset files at all**: every sprite is drawn in code from declarative recipes, every sound is synthesised with WebAudio, and type is a system-font stack
  - **Determinism substrate**: `xmur3` / `sfc32` / `hashInts` / a sanctioned `RNG` stream object, and a single `deriveRNG(master, domain, ...coords)` with a mandatory 12-call warm-up. Every piece of generated content is a pure function of seed, domain and coordinates &mdash; chunk (13,27) is byte-identical whether it is the first generated or the ten-thousandth. `Math.random` appears nowhere in the gameplay path (enforced by a lint check)
  - **A persistent 1536x1536 overworld**: value-noise elevation with an island falloff, 28 rivers traced by steepest descent with lake overflow, 36 jittered-Voronoi regions with domain-warped boundaries, per-region culture/biome/Quiet profiles, settlement placement by suitability scoring, and a road graph (nearest-three edges unioned with a minimum spanning tree, A* on a 4-tile lattice, Chaikin-smoothed). 32x32 chunks stream in and are evicted; because generation is pure, eviction is free and the world is rebuilt by re-derivation plus a semantic delta log
  - **Hollows that re-knit themselves**: a Hollow has a permanent *identity* (name, theme, depth, boss, its one prize) and a volatile *body* regenerated on every descent. Floors are generated mission-first: a rewrite grammar produces a 4&ndash;11 node DAG of what the floor asks (keys, locks, puzzles, combat, treasure, secrets, a boss), which is then embedded into space produced by one of five layout algorithms &mdash; BSP rooms, cellular caves, ring/spiral, grid vault, warren. Ten themes, ten floor problems (rising water, a sleeping pack, an unlit lantern line, a wanderer, a guest who wants something)
  - **Floor validation F1&ndash;F8** including a traversal proof that every key is reachable *without passing its own lock*. 99.9% of 1,396 generated floors pass; a floor whose stairs do not join is repaired by carving the missing corridor rather than re-rolled
  - **People before quests**: 150&ndash;350 NPCs with derived identities, households, relationship graphs, six schedules, disposition and an eight-entry memory. Needs are generated from who someone is, and quests are generated *from needs* &mdash; a need whose object cannot be resolved to a real entity is discarded, never faked. Dialogue is assembled from fact-bearing templates by warmth tier, and under the Quiet a noun occasionally comes loose mid-sentence
  - **Region Threads and the Long Thread**: ten Thread shapes cast from a region's actual roster, each ending in a cost/cost choice with visible permanent consequences; a six-state world plot about a place that chose to be forgotten, resolvable by fighting or by knowing four specific things, with two endings that both continue into free play
  - **The Wake instead of death**: at 0 HP the world persists and you lose hours, your oil, two fifths of your pack by weight (cheapest first), and 15% of your coin. Tools, capabilities, quest items and map knowledge are never lost
  - **Six Key Capabilities** that gate the world (Ember-jar, Grapple-vine, Bell, Spade, Green Flame, Boat-whistle), each with a blocked affordance placed in the world *before* it can be obtained. A gate solver proves at world creation that all six are obtainable in some order for the given seed, and moves a prize if they are not
  - **Procedural sprite synthesis**: a 14-op recipe language (`blob`, `poly`, `noise`, `shade`, `outline`, `cells`, `strokes`&hellip;) evaluated against per-world perturbed HSL palettes into a packed atlas, with four Quiet variants baked at boot so rising Quiet literally drains the colour and detail out of the world at no per-frame cost
  - **Mobile-first**: a virtual stick, tap-to-path, swipe-to-step, a context button whose label is always the verb it will perform, a long-press verb wheel, four tool slots, and full-screen DOM sheets &mdash; all one-thumbed with 44px targets. Full keyboard support on desktop (arrows/WASD/vi/numpad)
  - **PWA**: IndexedDB autosave with a `localStorage` header for the title screen, service worker, manifest, and a live 192px world-preview thumbnail rendered from the field functions as you type a seed
  - **Test harness**: `test/harness.html` runs in the browser with no tooling; `node test/run.mjs` runs the same 19 acceptance tests, and `node test/lint.mjs` enforces the architecture invariants G1&ndash;G9 (no `Math.random`, no DOM in generators, no file over 500 lines, every event declared)

- **Idle Delve** (game-034): New idle/incremental dungeon crawler — vanilla HTML/CSS/JS, zero image assets, all graphics drawn procedurally on a raw Canvas 2D context
  - **Procedural dungeon generation**: each floor is a linear sequence of combat/treasure/rest rooms, monster count and stats scaling with depth, boss rooms every 5th floor
  - **Auto-battle combat**: turn-order-by-speed resolution with crit chance, damage variance, focus-fire targeting bias, and a healer class that mends the lowest-HP ally — fully automatic, no player input during fights
  - **Idle persistence**: `localStorage` save/load with an offline catch-up simulation on load — fast-forwards through however many rooms/floors would have cleared while the tab was closed (capped at 12h), then shows a "while you were away" summary toast
  - **Town upgrade shop**: spend banked gold on recruiting up to 4 heroes (Fighter/Archer/Mage/Cleric), stat multipliers (ATK/DEF/HP/gold-find), a deeper starting floor, and auto-revive charges — all with idle-game-style exponential cost curves
  - **Procedural visuals**: gradient corridor backgrounds that shift darker/redder with depth, flickering torch lighting via animated radial gradients, geometric hero/monster "sprites" (shape + color per class/tier), floating damage numbers, and particle bursts on hits/deaths
  - Full procedural Web Audio sound set (hits, crits, deaths, gold pickup, room/floor clear, upgrade purchase) gated behind a mute toggle
- **Grimhold Abyss** (game-031): New retro first-person dungeon crawler ("blobber") in the style of early-90s DOS shareware such as The Catacomb Abyss, built on a custom software 3D engine written from scratch for this game — no WebGL, no 3D library
  - **Custom software renderer** (`js/engine/`): 320x200 palette-indexed framebuffer expanded to RGBA in a single present pass; perspective-correct textured wall columns with near-plane clipping and a per-column depth buffer; distance-shaded floor and ceiling; depth-tested billboard sprites; 5x7 bitmap font — everything on screen is rasterised by the game's own code
  - No polygon sorting anywhere: every wall spans the same world height, so within a screen column a nearer wall always contains a farther one, which makes a one-dimensional depth buffer an exact visibility solution
  - **16-colour EGA palette** with hand-authored per-colour darkening chains (EGA has no half brightness, so each colour gets an explicit ramp) and 4x4 Bayer dithering for gradients
  - **Zero asset files**: wall textures, sprites, the font and every sound effect are generated at runtime
  - **Grid-locked blobber movement**: cell-to-cell steps and 90-degree turns, animated, with one-deep input buffering so corridors run fast without ever leaving the grid
  - **Procedural dungeons**: rooms and corridors with extra links so floors loop rather than forming dead-end trees; pillared halls; doors placed where a corridor meets a room; locked gates promoted only where locking genuinely cuts off the stairs, with the key dropped on the reachable side; secret doors hiding treasure vaults behind dead ends; six themes across ten floors
  - **Bestiary**: skeleton, cave bat, ghoul, wraith, gargoyle, pit demon and the Grimhold Lich, all hand-drawn pixel art with a derived second animation frame; real-time grid AI; the lich fights at range down open rows and columns
  - **RPG systems**: melee and a fireball hand, XP and levels, a pack with usable consumables, chests, gold, keys, an automap, and save/load that stores only what the player changed and regenerates each floor from its seed
  - **Feel**: procedural Web Audio effects, EGA palette flashes for damage and level-ups, camera shake, a status-bar portrait that reacts to injury, wall torches and a dithered title screen
  - `?seed=` makes any run reproducible

## [3.0.0] - 2026-04-15

### Added
- **The River** (game-020): New narrative RPG / roguelite — Phase 1 + Phase 2 complete
  - 10-stop river journey with seeded encounter queue (companion, ingredient, or event cards)
  - 12 companion archetypes across common / uncommon / rare rarities, each contributing unique skill sets to the dinner score
  - 8 ingredient types in two categories (cooking / decorating) that stack for flat dinner bonuses
  - Dinner evaluation: weighted score from companion skills + ingredient counts yields six outcomes (Catastrophe → Legendary Feast) with flavor text
  - Tower news broadcasts mid-journey hinting at what the dark lord values each run; order is now deterministically tied to the run seed
  - **Phase 2 — Polish & Depth:**
    - 3-layer scrolling water parallax (far / mid / near strips at different speeds with ripple line details)
    - Unique first-person dialogue quote for every companion archetype on their encounter card
    - 4 incompatible companion pairs (Knight/Merchant, Alchemist/Herbalist, Bard/Troubadour, Oracle/Merchant) — warning shown on card, each clash docks 8 dinner points
    - 7 river event types: Calm Waters, Sudden Storm, Floating Debris, Foraging Stop (grants a bonus ingredient), River Festival, Morning Fog, Tower Raven
    - Procedural ambient drone music: detuned bass sine pair + mid sine + slow-LFO shimmer, fades in on journey start and out on dinner / restart
  - Built with Phaser 4.0.0 (ESM) and modular ES6 architecture

## [2.9.0] - 2026-04-14

### Added
- **Synthwave Breakout** (game-019): Tron-style light trail on the ball
  - Trail buffer extended to 28 points
  - Three-pass render: wide colored glow layer, bright white core line, cyan accent edge near the head
  - All trail segments taper off toward the tail using power curves
  - Ball head upgraded with multi-layer glow halo and white core dot
- **Synthwave Breakout** (game-019): Screen shake on brick destruction
  - Uses Phaser camera shake (`cameras.main.shake`); intensity scales with brick HP tier
- **Synthwave Breakout** (game-019): CRT / old colour TV raster overlay
  - Fullscreen `<canvas>` layered above the game (`pointer-events: none`)
  - Rolling scanline band that drifts down the screen like a real TV refresh bar
  - Static scanline grid (1px dark line every 3px)
  - RGB chromatic fringing — red bleed on the left edge, blue on the right
  - Radial vignette darkening the screen edges
  - Occasional random flicker and horizontal noise lines

### Fixed
- **Synthwave Breakout** (game-019): Migrated from Phaser 3.60 (`lib/phaser/phaser.js`) to Phaser 4.0.0 (`lib/phaser/phaser-4.0.0/dist/phaser.esm.js`)
  - `index.html` no longer loads Phaser via `<script src>` — all loading is through `<script type="module">`
  - `main.js` uses `import * as Phaser from '...phaser.esm.js'` (named-exports-only bundle)
  - Each scene file (`SplashScene`, `GameScene`, `UIScene`) now imports `Scene` (and other needed APIs) directly from the Phaser 4 ESM — eliminates the `Phaser is not defined` error caused by relying on a global set at runtime

## [2.8.0] - 2026-04-14

### Changed
- **Village of the Wandering Blade** (game-018): Code review and refactor pass
  - Extracted `_togglePanel(showFn, hideFn, panelId)` helper in `main.js` — replaces three copies of the repeated open/close panel conditional (Q, I, and E keys)
  - Fixed hardcoded `50` HP value in potion-use message to use the `POTION_HEAL_AMOUNT` constant
  - Campfire flame/flicker animation now captures `Date.now()` once per frame instead of calling it multiple times
  - Extracted `_randRadialPos(minR, maxR)` helper in `world.js` — removes a repeated 4-line radial scatter pattern duplicated across `_spawnTrees`, `_spawnRocks`, `_spawnRockClusters`, `_spawnBushes`, and `_spawnFlowerPatches`
  - Added explanatory comment to the ground vertex displacement pass in `world.js` (intentionally leaves village area flat; local-Z maps to world-Y after rotation)
  - `state.js` now exposes public read-only getters for `inventory`, `activeQuests`, `completedQuests`, and `questProgress` (each returns a shallow copy)
  - `save.js` `saveGame()` updated to use the new public getters instead of directly accessing private `state._` fields
  - Refactored `buildSellSection()` in `ui.js` from returning a raw HTML string (set via `innerHTML`) to building a DOM element with `document.createElement` — consistent with the rest of the file
  - Added detailed JSDoc to `_makeRng` in `monsters.js` (xorshift32 seeded RNG, why it exists for reproducible procedural generation)
  - Added detailed JSDoc to `_addHpBar` in `monsters.js` (params, what it builds, all call sites)

## [2.7.0] - 2026-04-11

### Added
- **Village of the Wandering Blade** (game-018): Game over overlay — when the player dies, a full-screen "YOU DIED" overlay appears with a Restart button that reloads the game

## [2.6.0] - 2026-04-01

### Added
- **Pixel Picross** (game-017): Classic nonogram puzzle game — fill grids using number clues to reveal hidden pixel art
  - 5 hand-crafted puzzles scaling from a 5×5 Heart to a 10×10 Rocket
  - Left-click to fill cells, right-click to mark with X; hold and drag to paint whole rows at once
  - Win detection triggers a celebration overlay and greens out correct cells
  - Scene flow: splash → game → (repeat per puzzle) → complete screen
  - Dynamic layout engine centres each grid with proportional clue margins regardless of puzzle size
  - Procedural Web Audio sounds: fill tick, mark tick, win arpeggio, all-complete fanfare
  - Built with Kaplay v4000; uses shared `lib/kaplay/kaplay.mjs`
- **Game ideas list** (docs/suggestions.md): Checked off Nonogram/Picross entry; promoted Pipe Dream/Flow Puzzle to next-up slot

## [2.5.0] - 2026-03-31

### Added
- **Crate Pusher** (game-016): New Sokoban-style puzzle game — push crates onto targets without getting stuck
  - 8 hand-crafted puzzles with verified solutions, scaling from 1-move tutorial to 20+ move finale
  - Full undo system (U key) with unlimited undo history
  - Move counter per level
  - Smooth scene transitions: splash → puzzle → win overlay → next level → completion screen
  - Dynamic tile sizing so all levels centre cleanly regardless of grid dimensions
  - Colour-coded crates: brown normally, green when placed on a target
  - Built with Kaplay v4000; uses shared `lib/kaplay/kaplay.mjs`
- **Game ideas list** (docs/suggestions.md): Checked off Sokoban entry; promoted Nonogram/Picross to next-up slot

## [2.4.0] - 2026-02-27

### Added
- **Nonogram Fleet** (game-011): Phase 3 complete — full game with intro/briefing scenes, procedural audio, 8-level progression, explosion effects, and level-complete tally overlay
- **Nonogram Fleet** (game-011): Airship sprite on splash and battle screens with bobbing animation; sprite credit (bevouliin.com) on splash

## [2.3.0] - 2026-02-23

### Fixed
- **Launcher**: `h1` header emoji now visible — removed `background-clip: text` / `-webkit-text-fill-color: transparent` gradient technique that caused emoji to render as grey/invisible

### Changed
- **Launcher**: Added subtle `header-pulse` opacity animation (3s ease-in-out loop) to the main "🎮 Game Browser" heading

## [2.2.0] - 2026-02-22

### Changed
- **Chronicles of the Ember Crown** (game-009): Party sprite layout overhaul
  - Warrior and rogue moved to front row; mage and healer to back row (2-column grid)
  - Front row sprites rendered at h=130, back row at h=105 for subtle depth effect
  - Group vertically centered in battlefield area
  - Updated `BATTLE.PARTY_X/Y` in [game-009/js/config.js](game-009/js/config.js) and `HERO_DEFS` in [game-009/js/battleRenderer.js](game-009/js/battleRenderer.js)

## [2.1.0] - 2026-02-21

### Added
- **Centipede Tower Defense** (game-008): Phase 6 — Polish & Game Feel
  - **Particle bursts**: 8 colored particles scatter outward on every centipede segment kill, matching the segment's color (head vs body)
  - **Damage flash**: Segments briefly flash white when hit without dying (visible on armored centipede types with multiple HP)
  - **Smart Bomb shockwave rings**: Two expanding, fading rings (cyan and white) radiate from the ship on Smart Bomb detonation
  - **Node audio feedback**: `playNodeHit()` on bullet chip, `playNodeDestroy()` on full node destruction — wired in `player.js`
  - **Tower economy sounds**: `playTowerSell()` on sell, `playTowerUpgrade()` on upgrade — wired in `towers.js`
  - **Scorpion crawl sound** (`playScorpionMove`): Sparse buzzy tone during scorpion traversal
  - **Node poison sound** (`playNodePoison`): Plays each time a scorpion poisons a node
  - **Boss wave alert** (`playBossAlert`): Deep dramatic sweep replaces normal wave-start fanfare on boss waves (5, 10, 15, 20)
  - **Game Won fanfare** (`playGameWon`): Rising 5-note arpeggio + held chord when all 20 waves are cleared
  - **Polished end screen**: Game Over and You Win overlays now show a styled panel with score, wave progress (or "All X waves cleared!"), gold remaining, and color-coded border (red / green)
  - **Polished splash screen**: Decorative grid lines, how-to-play card, cleaner controls reference, version tag updated to `v1.0`
  - **Launcher entry**: game-008 added to root [js/gamedata.js](js/gamedata.js)
  - **game-008 CHANGELOG**: Created [game-008/CHANGELOG.md](game-008/CHANGELOG.md) with full per-phase version history
  - Updated files: [game-008/js/sounds.js](game-008/js/sounds.js), [game-008/js/centipede.js](game-008/js/centipede.js), [game-008/js/player.js](game-008/js/player.js), [game-008/js/towers.js](game-008/js/towers.js), [game-008/js/waves.js](game-008/js/waves.js), [game-008/js/enemies.js](game-008/js/enemies.js), [game-008/js/ui.js](game-008/js/ui.js), [game-008/js/main.js](game-008/js/main.js), [game-008/game-plan.md](game-008/game-plan.md)

## [2.0.1] - 2026-02-21

### Fixed
- **game-008**: Clicking a placed tower now pauses the game while the upgrade/sell popup is open; game resumes on close, sell, or upgrade ([game-008/js/shop.js](game-008/js/shop.js))

## [2.0.0] - 2026-02-21

### Added
- **Centipede Tower Defense** (game-008): Phase 5 — Wave System & Special Enemies
  - **Wave Sequencer** (`waves.js`): Drives the full 20-wave progression
    - `initWaves(k)` starts wave 1 after a short delay; `startNextWave()` called by shop overlay on Skip / timer expiry
    - Per-wave centipede spawning using `WAVE_DEFS` from `config.js` (type, segment count, spawn position, direction)
    - Boss waves (5, 10, 15, 20) spawn Giant Centipede variants with higher segment counts
    - Schedules Flea, Spider, and Scorpion appearances mid-wave via `k.wait()` timers
    - Wave-completion detection: polls `activeEnemyCount()` each frame; triggers gold reward, score, and shop when all enemies cleared
    - Gold rewards: base `GOLD_PER_WAVE` + `GOLD_NO_DEATH_BONUS` (survived without losing a life) + `GOLD_BOSS_BONUS` on boss waves
    - Score bonuses: `SCORE_WAVE_COMPLETE` + `SCORE_NO_DEATH_BONUS`; smart-bomb restock (`SMART_BOMBS_PER_WAVE`)
    - Emits `waveStarted` and `waveComplete` events consumed by UI and shop
  - **Special Enemies** (`enemies.js`): Flea, Spider, and Scorpion fully implemented
    - **Flea**: Drops straight down from a random column; pauses briefly to place mushroom nodes as it descends; destroyed by one bullet; emits segmentKill sound
    - **Spider**: Erratic movement in the player/buffer zone (random direction changes each step); collides with player ship → emits `playerHitByEnemy`; eats (removes) mushroom nodes it walks over; score scales with how far into the player zone it reached
    - **Scorpion**: Traverses a full row left-to-right or right-to-left; poisons every mushroom node it passes over (`poisonNode`); removed when it exits the grid
    - `hitEnemyAt(col, row)` — unified hit-check used by player bullets and tower projectiles; returns `true` and destroys the enemy on match; awards per-type score/gold
    - All three enemies rendered with Kaplay primitives, tagged for `destroyAll` cleanup on scene leave
  - **Player integration** ([game-008/js/player.js](game-008/js/player.js)): bullets now call `hitEnemyAt` in addition to `hitCentipedeAt`; `playerHitByEnemy` event wired to `_playerHit`
  - **Tower integration** ([game-008/js/towers.js](game-008/js/towers.js)): `_dealDamage` tries `hitCentipedeAt` first, then `hitEnemyAt`, then breaks — supports multi-hit tower abilities against any enemy type
  - **UI — Gold popup** ([game-008/js/ui.js](game-008/js/ui.js)): `_showGoldPopup(goldEarned)` shown on `waveComplete`; floats upward with fade-in / hold / fade-out animation using `onUpdate` timer; uses `k.opacity()` component pattern
  - **Centipede cleanup** ([game-008/js/centipede.js](game-008/js/centipede.js)): removed hard-coded initial spawn from `initCentipede`; spawning is now entirely driven by `waves.js`
  - **main.js** ([game-008/js/main.js](game-008/js/main.js)): imports and calls `initEnemies(k)` and `initWaves(k)` in the `game` scene; splash version tag updated to `Phase 5`
  - **game-plan.md** ([game-008/game-plan.md](game-008/game-plan.md)): Phase 5 tasks checked off; document version bumped to 1.5; status updated to "Phase 6 next"
  - New files: [game-008/js/enemies.js](game-008/js/enemies.js), [game-008/js/waves.js](game-008/js/waves.js)
  - Updated files: [game-008/js/main.js](game-008/js/main.js), [game-008/js/centipede.js](game-008/js/centipede.js), [game-008/js/player.js](game-008/js/player.js), [game-008/js/towers.js](game-008/js/towers.js), [game-008/js/ui.js](game-008/js/ui.js)

## [1.9.0] - 2026-02-21

### Added
- **Centipede Tower Defense** (game-008): Phase 2 - Centipede Movement & Splitting
  - **Centipede Entity System**: Full class-based centipede with trail-following segments
    - `Centipede` class tracks segments as a position array + history trail; each body segment follows the head's exact path
    - Wall/obstacle collision: centipede descends one row and reverses horizontal direction when hitting a grid edge, a mushroom node, or a tower
    - Depth-based speed scaling: centipede accelerates as it descends (`speed × (1 + row × 0.04)`, capped at 2.5× base speed)
    - Player zone detection: emits `centipedeReachedBottom` event when head enters rows 15–17; respawns at top (Phase 3 will deduct lives)
  - **Segment Splitting on Kill**: killing any segment (via `hitAt(col, row)`) splits the centipede in two
    - Front half continues as the current centipede; rear half spawns as a new independent `Centipede` instance
    - A mushroom node is placed at the killed segment's tile (`placeNode` + `spawnNodeEntity`)
    - Score awarded: 10 pts per segment + 25 bonus for head kills
    - Gold awarded: 5 gold per segment kill
  - **Kaplay Rendering**: Kaplay-primitive sprites with per-frame position sync
    - Head rendered as a larger circle (42% of tile); body segments as smaller circles (34%)
    - Two white eye circles on the head; eyes shift horizontally based on movement direction
    - All entities tagged `'centipede'` / `'centipedeEye'` for `destroyAll` cleanup
    - Z-layers: segments at z=10, eyes at z=11
  - **Enemy Definitions** (in `config.js`): 4 centipede variants + 3 special enemies
    - `centipede` — 1 HP, 2.5 t/s, red
    - `centipedeArmored` — 2 HP, 2.5 t/s, purple
    - `centipedeFast` — 1 HP, 5.0 t/s, orange
    - `centipedeGiant` — 3 HP, 2.0 t/s, 20 segments, magenta
    - `flea`, `spider`, `scorpion` stubs also defined for future phases
  - **Public API**: `initCentipede(k)`, `spawnCentipede(k, type, segCount, col, row, dirX)`, `hitCentipedeAt(col, row)`
    - `initCentipede` spawns the initial 12-segment centipede and registers a scene-level `onUpdate` loop
    - `hitCentipedeAt` iterates all active centipedes to find and damage the occupying segment; used by Phase 3 bullets
  - **Version tag** on splash screen updated from `Phase 1` → `Phase 2`
  - New file: [game-008/js/centipede.js](game-008/js/centipede.js)
  - Updated: [game-008/js/main.js](game-008/js/main.js)

## [1.8.0] - 2026-02-21

### Added
- **Centipede Tower Defense** (game-008): Phase 1 - Foundation & Architecture
  - **Game Concept**: Hybrid Centipede / Tower Defense / Space Shooter built with Kaplay v4000
  - **Grid System**: 24×18 tile grid (TILE_SIZE=40), rendered with side margins (GRID_OFFSET_X=160) for HUD panels
    - Enemy zone: rows 0–12 (centipede traversal + tower slots)
    - Buffer zone: rows 13–14 (spider/flea danger zone)
    - Player zone: rows 15–17 (player ship movement)
    - 21 pre-set tower placement slots in the enemy zone with a fast `TOWER_SLOT_SET` for O(1) lookup
  - **Modular Architecture**: ES6 module system with event-driven communication
    - `config.js` — All game constants (grid dimensions, zones, tower slots, colors)
    - `state.js` — Reactive singleton with getters/setters that auto-emit events
    - `events.js` — EventBus singleton for cross-module communication with `clearAll()` cleanup
    - `grid.js` — Grid rendering and tile utilities (`initGrid`, `drawGrid`, `tileToWorld`, `worldToTile`)
    - `ui.js` — HUD panels (left: towers/resources, right: stats/wave info)
    - `sounds.js` — Web Audio API sound stubs for all planned SFX
    - `main.js` — Kaplay init, scene management (`splash` → `game`), `onSceneLeave` cleanup
  - **Kaplay Scenes**: Splash screen → Game scene with proper event bus cleanup on scene transitions
  - **HUD**: Left panel (tower shop) and right panel (lives, score, wave counter) rendered as Kaplay primitives
  - Files: [game-008/index.html](game-008/index.html), [game-008/js/main.js](game-008/js/main.js), [game-008/js/config.js](game-008/js/config.js), [game-008/js/state.js](game-008/js/state.js), [game-008/js/events.js](game-008/js/events.js), [game-008/js/grid.js](game-008/js/grid.js), [game-008/js/ui.js](game-008/js/ui.js), [game-008/js/sounds.js](game-008/js/sounds.js), [game-008/game-plan.md](game-008/game-plan.md)

## [1.7.0] - 2026-02-20

### Added
- **Interactive Fiction Text Adventure** (game-007): Phase 5 - Splash Screen, Save / Load & Restart
  - **Splash Screen**: Full-screen terminal-style title card shown on load
    - ASCII box-art title with green glow, atmospheric tagline
    - Blinking yellow `[ PRESS ANY KEY OR CLICK TO BEGIN ]` prompt
    - `SAVE · LOAD · RESTART · HELP` hint line
    - Fades out smoothly (0.4s) on any key press or click; modifier-only keys (Shift/Ctrl/Alt/Meta) are ignored
  - **Save System** (3 slots, localStorage):
    - `SAVE` — saves to slot 1; `SAVE 2` / `SAVE 3` — saves to a specific slot
    - Captures full game state: current room, all room item/lock/visited/hidden-exit state, inventory (including equipped items), NPC states (talked-to, items given)
    - Save confirmation shows slot number, room name, and timestamp
  - **Load System**:
    - `LOAD` — lists all save slots with room name and save timestamp
    - `LOAD 1` / `LOAD 2` / `LOAD 3` — restores a save and immediately shows the current room description
    - `SAVES` command as a convenient alias for listing slots
  - **Restart Command**: `RESTART` — two-step confirmation (type again within 8 s) then reloads the page
  - **Help Text Updated** with SAVE / LOAD / SAVES / RESTART commands in SYSTEM section
  - New file: [game-007/js/saveload.js](game-007/js/saveload.js)
  - Updated files: [game-007/index.html](game-007/index.html), [game-007/styles.css](game-007/styles.css), [game-007/js/main.js](game-007/js/main.js), [game-007/js/parser.js](game-007/js/parser.js), [game-007/js/world.js](game-007/js/world.js), [game-007/js/npc.js](game-007/js/npc.js)

### Changed
- **Game Browser**: Added **game-007** to the top-level launcher
  - Added entry in [js/gamedata.js](js/gamedata.js)
  - Updated fallback total games count in [index.html](index.html) from `6` to `7`

### Added
- **Interactive Fiction Text Adventure** (game-007): Phase 4 - NPCs & Dialogue
  - **3 Fully-Voiced NPCs** with unique personalities, each in a distinct location:
    - *Ghost of Atem-Ra* (Temple Crypt) — the High Priest who shattered the Crystal; master of celestial lore and the core quest
    - *Scholar's Spirit* (Library) — the ancient librarian; knows the library's secrets and hints about the hidden bookshelf passage and balcony route
    - *Centurion Varro* (Soldiers' Barracks) — gruff temple guard ghost; knows key locations, tunnel routes, and the temple layout
  - **Dialogue System** with keyword-based topic matching:
    - `TALK TO [name]` / `TALK [name]` — initiates conversation, shows greeting and available topics
    - `ASK [name] ABOUT [topic]` — ask about any keyword across topics (e.g. `ASK ATEM-RA ABOUT SHARDS`)
    - Each NPC has 6–9 dialogue topics covering lore, hints, and puzzle clues
    - Auto-greeting on first `ASK` if player hasn't talked to the NPC yet
    - Different greeting on repeat visits
  - **Trading / Item Giving** via `GIVE [item] TO [name]`:
    - Give Stone Tablet to Atem-Ra → receive **Moonfire Charm** (permanent auto-light, no equip needed)
    - Give Old Manuscript to Scholar → confirms the hidden bookshelf passage
    - Give Old Codex to Varro → reveals a hidden secret in the dark alcove north wall
    - Generic "no use for it" response for any other item
  - **NPCs Shown in Room Descriptions** — NPCs appear in the "You can see:" section with a `TALK TO` hint
  - **Moonfire Charm** (new item): permanent light source received from Atem-Ra; provides light automatically without equipping, unlike torches/lanterns
  - **NPC Text Color**: NPC dialogue renders in cyan, distinct from green room text and grey system messages
  - **Help Text Updated** with NPC command section
  - New files: [game-007/data/npcs.js](game-007/data/npcs.js), [game-007/js/npc.js](game-007/js/npc.js)
  - Updated files: [game-007/js/parser.js](game-007/js/parser.js), [game-007/js/main.js](game-007/js/main.js), [game-007/js/world.js](game-007/js/world.js), [game-007/js/textEngine.js](game-007/js/textEngine.js), [game-007/styles.css](game-007/styles.css), [game-007/data/rooms.js](game-007/data/rooms.js), [game-007/data/items.js](game-007/data/items.js)

### Added
- **Interactive Fiction Text Adventure** (game-007): Phase 3 - World Building
  - **20 Rooms** (expanded from 6) across six distinct areas:
    - *Starting Area*: Damp Chamber, Narrow Corridor, Storage Room, Dark Alcove, Temple Entrance, Inner Sanctum
    - *Underground Network*: Underground Stream, Underground Lake (dark)
    - *Military Wing*: Armory, Soldiers' Barracks
    - *Hidden Route*: Collapsed Tunnel (dark), Hidden Passage
    - *Temple Exterior*: Temple Garden, Overgrown Path, Statue Garden
    - *Temple Interior*: Library, Upper Balcony, Ritual Chamber, Bell Tower, Temple Crypt (dark)
  - **Examinable Objects System**: Every room has named scenery items players can examine (carvings, columns, bookshelves, mosaics, sarcophagi, etc.), providing lore and puzzle clues
  - **Hidden Exit Mechanic**: Examining specific objects reveals secret passages — examining the library bookshelf reveals a hidden passage west to the collapsed tunnel network
  - **Locked Exits** (3 distinct lock types):
    - Iron Key → Temple Entrance north door (found in dark alcove)
    - Bronze Key → Inner Sanctum west door / Library (found in collapsed tunnel, dark)
    - Rope with Grappling Hook → Library north window to Upper Balcony (`USE rope_and_hook` in library)
  - **Dark Rooms** (4): Dark Alcove, Collapsed Tunnel, Underground Lake, Temple Crypt — require equipped light source
  - **Custom Lock Messages**: Locked exits display context-appropriate messages (e.g., "The high window is far out of reach. You need something to climb.")
  - **Crystal Shard Puzzle Setup** (for Phase 5/7): Three shards scattered across the world matching lore from manuscript/scroll/codex — Crystal Shard (upper balcony / the heights), Moon Stone (crypt / the depths), Fire Shard (ritual chamber / sacred fire)
  - **11 New Items**: Ancient Lantern (light source), Bronze Key, Old Manuscript (clue), Moon Stone (shard), Fire Shard (shard), Silver Coin (treasure), Ceremonial Dagger (weapon), Old Codex (clue), Rusty Armor (equippable), Crystal Shard (shard), Thick Vine (tool)
  - **Bug Fix**: Key usage now correctly unlocks locked exits — `handleItemUse` was previously dead code for keys due to a flow issue where it was only called when `result.target` was truthy, which never happened for keys without an explicit target
  - **Improved Lock Messages**: Lock messages use item display names instead of raw IDs (e.g., "You need Bronze Key" not "You need bronze_key")
  - Files: Rewritten [game-007/data/rooms.js](game-007/data/rooms.js), Updated [game-007/data/items.js](game-007/data/items.js), [game-007/js/world.js](game-007/js/world.js), [game-007/js/parser.js](game-007/js/parser.js)

### Added
- **Interactive Fiction Text Adventure** (game-007): Phase 2 - Inventory & Items System
  - **Comprehensive Item System**: 10 unique items with rich properties
    - Item types: weapons, tools, keys, consumables, quest items, containers
    - Properties: weight, value, equippable, usable, combinable, provides light
    - Items include: Old Torch (light source), Rusty Sword (weapon), Iron Key, Stone Tablet, Crystal of Light, Wooden Crate (container), Healing Potion, Rope, Grappling Hook
  - **Full-Featured Inventory System**: Weight-based capacity management
    - Weight limit: 50kg with real-time tracking
    - Add/remove items with automatic weight validation
    - Total weight and total value calculations
    - Item count tracking displayed in status bar
    - Map-based storage for efficient item management
  - **Equipment System**: Weapon and tool equipping
    - Equip/unequip items with EQUIP/UNEQUIP commands
    - Auto-unequip same-type items (only one weapon at a time)
    - Visual equipped status in inventory: "Rusty Sword (equipped)"
    - Equipment state preserved in inventory display
  - **Item Combining System**: Create new items from components
    - Combine items using COMBINE [item1] WITH [item2] command
    - Bidirectional combination checking (order doesn't matter)
    - Example: Rope + Grappling Hook = Rope with Grappling Hook
    - Auto-removal of source items, auto-addition of result
  - **Item Usage System**: Context-aware item interactions
    - USE [item] command for general item usage
    - USE [item] ON [target] for targeted interactions
    - Consumables auto-remove on use with effects (healing potions)
    - Custom use cases: sword on crate, key on door
    - Effect system for heal amounts and buffs
  - **Light Source System**: Integrated with dark rooms
    - Items can provide light (Old Torch)
    - Dark rooms require equipped light sources
    - `hasLightSource()` check prevents entering dark areas without light
  - **Enhanced Parser Commands**:
    - TAKE - Now with weight checking and proper item names
    - DROP - Properly handles item objects and auto-unequips
    - EXAMINE - Shows detailed item properties from database
    - INVENTORY - Formatted display with weight/value totals
    - USE/USE ON - Item usage with targets
    - COMBINE - Merge items into new items
    - EQUIP/UNEQUIP - Equipment management
  - **Flexible Item Matching**: Multiple ways to reference items
    - Supports full names: "old torch"
    - Supports IDs: "old_torch"
    - Supports partial matches: "torch" finds "old_torch"
    - Case-insensitive matching throughout
  - **Status Bar Enhancement**: Real-time inventory statistics
    - Item count display: "Items: X"
    - Weight display: "Weight: Ykg / 50kg"
    - Updates automatically as items are added/removed
  - **Module Architecture**: ES6 module system
    - Separate modules: config, textEngine, parser, world, inventory
    - Data modules: rooms, items
    - Clean imports/exports for maintainability
  - **Save/Load Ready**: Serialization infrastructure
    - `serialize()` and `deserialize()` methods in Inventory class
    - Prepared for Phase 8 save/load implementation
  - Files: Created [game-007/data/items.js](game-007/data/items.js), [game-007/js/inventory.js](game-007/js/inventory.js), Updated [game-007/js/parser.js](game-007/js/parser.js), [game-007/js/world.js](game-007/js/world.js), [game-007/js/main.js](game-007/js/main.js), [game-007/index.html](game-007/index.html), Added [game-007/PHASE2-COMPLETE.md](game-007/PHASE2-COMPLETE.md)


### Added
- **Wolfenstein-like Raycasting FPS** (game-006): Phase 4 - Procedural Generation & Themed Textures
  - **Procedural Map Generation**: Complete dungeon generation system
    - Created [game-006/js/procgen.js](game-006/js/procgen.js) for procedural level generation
    - Room-and-corridor algorithm for varied level layouts
    - Configurable dungeon parameters for complexity and variety
  - **Themed Texture System**: Multiple wall texture themes
    - Created [game-006/js/themes.js](game-006/js/themes.js) for theme management
    - Support for multiple texture sets: Bricks, Building Textures, Doors, Industrial, Rocks, Tech, Urban, Wood
    - Dynamic texture loading and application per map theme
  - **Enhanced Door System**: Interactive door mechanics
    - Created [game-006/js/door.js](game-006/js/door.js) for door entities
    - Doors can be opened/closed by player interaction
    - Visual distinction for door states
  - **Advanced Floor Rendering**: Enhanced floor/ceiling rendering
    - Created [game-006/js/floor.js](game-006/js/floor.js) for floor rendering system
    - Improved floor texture mapping and rendering
  - **Wall Texture Assets**: Professional pixel art texture pack
    - Added 9 texture categories with multiple variants:
      - [game-006/sprites/Bricks/](game-006/sprites/Bricks/) - Brick wall textures
      - [game-006/sprites/BuildingTextures/](game-006/sprites/BuildingTextures/) - Building materials
      - [game-006/sprites/Doors/](game-006/sprites/Doors/) - Door sprites
      - [game-006/sprites/Elements/](game-006/sprites/Elements/) - Decorative elements
      - [game-006/sprites/Industrial/](game-006/sprites/Industrial/) - Industrial textures
      - [game-006/sprites/Rocks/](game-006/sprites/Rocks/) - Stone and rock textures
      - [game-006/sprites/Tech/](game-006/sprites/Tech/) - Technology-themed textures
      - [game-006/sprites/Urban/](game-006/sprites/Urban/) - Urban environment textures
      - [game-006/sprites/Wood/](game-006/sprites/Wood/) - Wooden textures
    - **Asset Credit**: Wall tile textures by [jestan](https://jestan.itch.io/pixel-texture-pack)
      - Support the creator at [Ko-fi](https://ko-fi.com/jestan)
  - **Module Updates**: Enhanced existing systems for procedural generation
    - Updated [game-006/js/config.js](game-006/js/config.js) - Added procedural generation settings
    - Updated [game-006/js/enemies.js](game-006/js/enemies.js) - Enemy spawning for procedural maps
    - Updated [game-006/js/input.js](game-006/js/input.js) - Door interaction controls
    - Updated [game-006/js/main.js](game-006/js/main.js) - Procedural map initialization
    - Updated [game-006/js/map.js](game-006/js/map.js) - Procedural map integration
    - Updated [game-006/js/state.js](game-006/js/state.js) - State management for new features
    - Updated [game-006/js/textures.js](game-006/js/textures.js) - Theme texture loading
    - Updated [game-006/js/ui.js](game-006/js/ui.js) - UI updates for new features
  - Files: Created [game-006/js/procgen.js](game-006/js/procgen.js), [game-006/js/themes.js](game-006/js/themes.js), [game-006/js/door.js](game-006/js/door.js), [game-006/js/floor.js](game-006/js/floor.js), Added texture assets in [game-006/sprites/](game-006/sprites/), Updated multiple core modules

- **Attribution**: Added credits for game assets
  - Wall texture pack attribution added to [README.md](README.md)
  - Credit to [jestan](https://jestan.itch.io/pixel-texture-pack) for pixel texture pack
  - Ko-fi support link included

### Changed
- **Game Browser**: Added **game-006** to the top-level launcher data so it appears in the main index card grid
  - Added a new `game-006` entry in [js/gamedata.js](js/gamedata.js)
  - Updated fallback total games count in [index.html](index.html) from `5` to `6`

### Added
- **Wolfenstein-like Raycasting FPS** (game-006): Game Over Screen & Restart System
  - **Game Over Screen**: Professional death screen with stats summary
    - "YOU DIED" title in dramatic red text
    - Final stats display: Time Survived, Enemies Killed, Accuracy percentage
    - Pulsing "Click anywhere to restart" prompt with smooth animation
    - Dark overlay with proper visual hierarchy
  - **Click-to-Restart**: Instant game restart on any click after death
    - No page reload required - seamless restart experience
    - Full state reset: health, stats, enemies, and player position
    - Returns to game scene with fresh spawn
  - Files: Updated [game-006/js/ui.js](game-006/js/ui.js), [game-006/js/input.js](game-006/js/input.js)

### Fixed
- **Wolfenstein-like Raycasting FPS** (game-006): Fixed strafing movement backwards instead of sideways
  - **Issue**: A key moved forward, D key moved backward instead of strafing left/right
  - **Root Cause**: Strafe code was using plane vectors (planeX, planeY) incorrectly, causing movement along the direction vector instead of perpendicular to it
  - **Solution**: Changed to use proper perpendicular direction vectors: A uses (dirY, -dirX) for left strafe, D uses (-dirY, dirX) for right strafe
  - **Result**: Now provides proper FPS-style strafing movement perpendicular to facing direction
  - File: [game-006/js/player.js](game-006/js/player.js#L120-L129)

### Added
- **Wolfenstein-like Raycasting FPS** (game-006): Phase 3 - Enemy System & AI
  - **Enemy System**: Complete AI-driven enemies with 5 distinct types
    - **Guard**: 50 HP, 2 u/s speed, 5-10 damage, green uniform - Basic patrol enemy
    - **Officer**: 75 HP, 3 u/s speed, 10-15 damage, blue uniform - More aggressive pursuit
    - **SS Trooper**: 100 HP, 4 u/s speed, 15-25 damage, dark gray uniform - Fast & flanking
    - **Dog**: 30 HP, 5 u/s speed, 15-20 damage, brown - Melee-only, very fast
    - **Boss**: 500 HP, 2 u/s speed, 25-50 damage, red armor - Tank with high HP
  - **AI State Machine**: Four intelligent states with smooth transitions
    - **PATROL**: Rotates slowly (30°/s) scanning for player, transitions to ALERT when player spotted
    - **ALERT**: Investigates last known player position, rotates faster (60°/s), 5-second timeout returns to PATROL
    - **CHASE**: Actively pursues player with collision avoidance, direct pathfinding, transitions to ATTACK when in range
    - **ATTACK**: Stops moving, faces player, fires weapon, occasional strafing for evasion
  - **Enemy Rendering with Kaplay Drawing API**: Procedurally-generated billboard sprites
    - No sprite assets needed - all enemies rendered using `drawRect()`, `drawCircle()`, `drawEllipse()`
    - Billboard sprites always face camera naturally
    - Each enemy type has distinctive color scheme and body structure
    - Visual components: colored body rectangle, lighter head circle, darker arm rectangles
    - Muzzle flash when shooting (bright yellow circle)
    - Health bars above damaged enemies (green → yellow → red gradient)
    - Dead enemies render as flat ellipse corpses on ground
    - Depth sorting (far to near rendering, painter's algorithm)
    - Z-buffering (doesn't render behind walls, per-column depth testing)
    - Proper 3D perspective scaling based on distance
  - **FOV & Line-of-Sight**: Realistic detection system
    - Field of View detection with customizable angle per enemy type (60°-120°)
    - Line-of-sight raycasting prevents seeing through walls
    - FOV distance ranges from 10-16 units depending on enemy type
    - Checks 8 directions around enemy for player detection
  - **Enemy Combat System**: Distance-based accuracy and damage
    - Enemies shoot at player when in range and line-of-sight available
    - Accuracy decreases with distance (80% base, scales down with range)
    - Fire rate customized per enemy type (1-2.5 shots/second)
    - Damage ranges specific to enemy type
    - Player damage flash effect when hit
    - Game over when player health reaches 0
  - **Weapon Integration**: All weapons work against enemies
    - Pistol, Machine Gun, Shotgun: Hitscan hit detection with raycasting
    - Rocket Launcher: Projectile collision with splash damage to multiple enemies
    - Hit detection using dot product (0.7 threshold) and perpendicular distance (0.8 radius)
    - Generous hit detection balances gameplay vs realism
    - Visual feedback: damage numbers in console, enemy flash on hit
  - **Enemy Spawning System**: Flexible spawn configuration
    - `spawnEnemy(type, x, y, angle)` - Spawn single enemy
    - `spawnEnemiesFromConfig(enemyConfig)` - Spawn from array configuration
    - Test map includes 6 enemies: 2 Guards, 1 Officer, 2 Dogs, 1 SS Trooper
    - Each enemy logs spawn details (position, HP, speed) for debugging
  - **Performance Optimizations**: Efficient enemy handling
    - Maximum 20 active enemies (configurable)
    - Enemies beyond 20 units culled (not rendered or updated)
    - Enemies behind camera skipped entirely
    - Dead enemies removed after 3-second death animation
    - Per-column depth testing prevents overdraw
    - Maintains 60 FPS with 6 active enemies
  - **Debug Features**: Real-time enemy inspection
    - `window.debugEnemies()` helper function for browser console
    - Shows all enemy states, HP, positions, distances from player
    - Extensive console logging for AI state transitions
    - Damage dealt/received logs with HP tracking
    - Kill tracking in game stats
  - **Game Stats**: New tracking metrics
    - `state.enemiesKilled` - Total enemies defeated
    - `state.shotsFired` - Total shots taken (from Phase 2)
    - `state.shotsHit` - Successful hits for accuracy tracking
  - Files: Created [game-006/js/enemies.js](game-006/js/enemies.js), Updated [game-006/js/config.js](game-006/js/config.js), [game-006/js/state.js](game-006/js/state.js), [game-006/js/renderer.js](game-006/js/renderer.js), [game-006/js/main.js](game-006/js/main.js), [game-006/js/raycaster.js](game-006/js/raycaster.js), [game-006/js/input.js](game-006/js/input.js), [game-006/js/weapons.js](game-006/js/weapons.js), Added [game-006/PHASE3-COMPLETE.md](game-006/PHASE3-COMPLETE.md)

### Fixed
- **Wolfenstein-like Raycasting FPS** (game-006): Critical bug - Enemies not taking damage despite hit detection working
  - **Issue**: `checkEnemyHit()` was correctly detecting hits, but `takeDamage()` was never being called on enemies
  - **Root Cause**: In `weapons.js` (lines 310-317), when creating hit objects to return, the `enemy` property was not being copied from the raycast result
  - **Symptom**: Console showed "✅✅✅ RETURNING HIT: Officer at 1.28 units" but no damage logs appeared
  - **Why Silent Failure**: `input.js` tried to call `hit.enemy.takeDamage()` on undefined, which failed silently without throwing an error
  - **Data Flow Bug**: The call chain was raycaster → weapons → input → enemies, and the enemy reference was lost in the middle (weapons.js)
  - **Solution**: Added `enemy: hit.enemy,` to the hit object being pushed in `fireWeapon()` function
  - **Lesson**: Always verify that object properties are being properly copied/forwarded through multi-step data transformations
  - **Prevention**: Use extensive logging at each step of data flow, verify object completeness after copying/transforming
  - File: [game-006/js/weapons.js](game-006/js/weapons.js#L312)

- **Wolfenstein-like Raycasting FPS** (game-006): Fixed hit detection too strict (enemies nearly impossible to hit)
  - **Issue**: Initial dot product threshold of 0.98 required almost perfect aim
  - **Solution**: Reduced to 0.7 for more forgiving gameplay, increased perpendicular distance tolerance from enemy.type.size to 0.8
  - File: [game-006/js/enemies.js](game-006/js/enemies.js#L564-L569)

### Added
- **Wolfenstein-like Raycasting FPS** (game-006): Phase 2 - Complete Shooting System with Effects
  - **Shooting Input**: Multiple firing methods
    - Left mouse click to fire current weapon
    - Ctrl key as alternative firing method
    - Hold mouse for continuous automatic fire (respects fire rate)
    - Fire rate limiting per weapon (pistol: 3 shots/sec, machine gun: 8 shots/sec, shotgun: 1 shot/1.5s, rocket: 1 shot/2.5s)
  - **Bullet Impact System**: Visual wall impact effects
    - Animated sparks radiating from impact point (4-ray pattern)
    - Bullet hole effect with dark center and bright outer ring
    - Fade-out animation over 200ms duration
    - Depth-buffered rendering (only shows on visible walls)
    - Impact position stored as world coordinates for proper 3D projection
  - **Muzzle Flash Effect**: Visual weapon firing feedback
    - Bright yellow-orange flash appears at weapon muzzle when firing
    - 50ms flash duration for quick, satisfying feedback
    - Renders at bottom-center of screen with weapon sprite
  - **Screen Shake**: Weapon-specific camera shake
    - Variable intensity: Pistol/Machine Gun (3px), Shotgun (8px), Rocket Launcher (10px)
    - Exponential decay (90% per frame) for smooth return to center
    - Randomized shake direction for natural feel
    - Applied to entire raycasting view using Kaplay transform stack
  - **Impact Sound Effects**: Audio feedback for hits
    - Metallic ricochet sound (800Hz → 300Hz triangle wave with high-pass filter)
    - Plays on wall hits for hitscan weapons
    - Shotgun plays single impact sound (not per pellet) to avoid audio spam
    - Volume: 15% of master for subtle but noticeable feedback
  - **Weapon Sounds**: All 4 weapons have firing sounds
    - Pistol: Sharp 200Hz crack
    - Machine Gun: Rapid 150Hz buzz
    - Shotgun: Deep 120Hz boom
    - Rocket Launcher: 80Hz whoosh with white noise trail
  - **Hitscan Raycast System**: Instant-hit weapon physics
    - Uses raycasting engine's `castSingleRay()` for hit detection
    - Spread mechanics for shotgun (5 pellets with 0.2 radian spread)
    - Distance-based damage falloff (shotgun effective to 6 units)
    - Range limiting per weapon (8-15 units)
  - **Projectile System**: Rocket launcher projectiles
    - Orange rocket sprites with trailing smoke effect
    - 10 units/second movement speed
    - Wall collision detection with explosion
    - Billboard sprite rendering (always faces camera)
    - Depth-sorting with raycasting wall distances
  - **Explosion Effects**: Rocket launcher detonations
    - Expanding circular explosion (grows 50% over 500ms)
    - Two-layer effect (outer orange, inner bright yellow)
    - Fade-out alpha animation
    - Splash damage radius of 2 units (not yet implemented - Phase 3)
    - Deep explosion sound (50Hz → 20Hz bass + 800Hz crackling)
  - **Weapon State Management**: Complete firing system
    - Muzzle flash tracking with time-based auto-clear
    - Last fire time for rate limiting
    - Ammo consumption for non-infinite weapons
    - Empty click sound when out of ammo
    - Impacts array in state for managing active bullet holes
  - **Visual Polish**:
    - Weapon sprite changes color per weapon type (gray pistol, dark machine gun, brown shotgun, gray rocket)
    - All effects properly depth-sorted (behind walls when appropriate)
    - Smooth 60 FPS performance maintained with effects active
  - **Kaplay v4000 Compatibility Fix**: Fixed rgba color API
    - Replaced all `k.rgba()` calls with array format `[r, g, b, a]`
    - Kaplay v4000 uses array notation for RGBA colors, not function calls
    - Fixed 8 instances in renderer.js (impacts, explosions, trails, damage flash)
    - Documented in learnings.md for future reference
  - Files: Updated [game-006/js/input.js](game-006/js/input.js), [game-006/js/weapons.js](game-006/js/weapons.js), [game-006/js/renderer.js](game-006/js/renderer.js), [game-006/js/sounds.js](game-006/js/sounds.js), Added bullet impact sound and enabled muzzle flash/screen shake

### Fixed
- **Wolfenstein-like Raycasting FPS** (game-006): Fixed Kaplay v4000 RGBA color API usage
  - Issue: `k.rgba()` function does not exist in Kaplay v4000, causing "k.rgba is not a function" errors
  - Solution: Replaced all `k.rgba(r, g, b, a)` calls with array format `[r, g, b, a]`
  - In Kaplay v4000, colors with alpha are represented as arrays, not function calls
  - Fixed 8 instances: bullet impacts, explosions, rocket trails, damage flash, spark effects
  - Files: [game-006/js/renderer.js](game-006/js/renderer.js), [docs/learnings.md](docs/learnings.md)
  - API Reference: https://v4000.kaplayjs.com/docs/api/RGBAValue/

- **Wolfenstein-like Raycasting FPS** (game-006): Fixed HUD direction display showing NaN
  - Issue: DIR attribute in HUD was reading `player.angle` which doesn't exist
  - Solution: Changed to read `player.playerAngle` property which is the correct property name
  - File: [game-006/js/ui.js](game-006/js/ui.js#L50)

### Changed
- **Wolfenstein-like Raycasting FPS** (game-006): Deep Kaplay Integration - Architecture Overhaul
  - **Kaplay-Native Rendering**: Complete migration to Kaplay's drawing API
    - Removed separate Canvas 2D API usage entirely
    - All rendering now uses Kaplay functions: `drawUVQuad()`, `drawRect()`, `drawCircle()`, `drawLine()`, `drawText()`
    - Eliminated dual-canvas system - single Kaplay canvas handles everything
    - Uses Kaplay's transform stack (`pushTransform()`/`popTransform()`) for camera shake
    - Better color handling with `k.rgb()`, `k.rgba()`, `k.BLACK.lerp(k.WHITE, brightness)`
  - **Texture System**: Wall textures with UV mapping (like official Kaplay raycasting example)
    - Created new `js/textures.js` module for sprite loading and slicing
    - Pre-slices wall textures into vertical strips on load
    - Uses Kaplay's `Quad` system for proper UV coordinate mapping
    - Renders textured walls with `drawUVQuad()` instead of solid colors
    - Graceful fallback to solid colors if textures not loaded yet
  - **Player as Kaplay Game Object**: Component-based player entity
    - Player created with `k.add()` as proper Kaplay game object
    - Uses Kaplay components: `pos()`, `z()`, `opacity()`
    - Custom `draw()` function on player object renders entire 3D raycasting view
    - Custom `update()` function syncs position between Kaplay and raycasting systems
    - Follows official Kaplay raycasting example architecture pattern
  - **Enhanced Raycaster**: Better data for texture mapping
    - Added hit coordinates (`hitX`, `hitY`) to ray data for UV calculation
    - Added normal vectors (`normalX`, `normalY`) for lighting/shading
    - Determines which wall face was hit (x-side vs y-side) for proper texture wrapping
  - **Simplified Main Loop**: Cleaner separation of concerns
    - Removed manual `render()` call from `onDraw()`
    - Player's custom `draw()` function handles all rendering automatically
    - Kaplay manages the complete rendering pipeline
  - **Architecture Benefits**:
    - Follows official Kaplay patterns (based on example-raycast.js)
    - Cleaner, more maintainable code using Kaplay conventions
    - Ready for sprite-based enemies using same billboarding technique
    - Easy to add weapon sprites and other textured elements
    - Single unified rendering pipeline through Kaplay
    - Better integration with Kaplay's component system
  - Files: Created [game-006/js/textures.js](game-006/js/textures.js), [game-006/KAPLAY-INTEGRATION.md](game-006/KAPLAY-INTEGRATION.md), Rewritten [game-006/js/renderer.js](game-006/js/renderer.js), [game-006/js/player.js](game-006/js/player.js), Updated [game-006/js/raycaster.js](game-006/js/raycaster.js), [game-006/js/main.js](game-006/js/main.js)

- **Wolfenstein-like Raycasting FPS** (game-006): Refactored to use Kaplay engine architecture
  - **Dual-Canvas Hybrid System**: Integrated Kaplay while preserving custom raycasting renderer
    - Separate Canvas 2D for raycasting rendering (z-index: 0)
    - Transparent Kaplay WebGL canvas for UI overlays (z-index: 1)
    - Both canvases positioned in container div with perfect alignment
  - **Kaplay Integration**: Adopted Kaplay patterns from game-005
    - State management system with `state.js` singleton
    - Event bus system with `events.js` for cross-module communication
    - Kaplay game loop with `k.onUpdate()` for logic and `k.onDraw()` for rendering
    - Input handling using `k.isKeyDown()` for keyboard controls
    - Scene management with `k.scene()` and `k.go()`
  - **New Modular Architecture**:
    - Created `js/state.js` - Centralized game state (player reference, FPS, pause state)
    - Created `js/events.js` - EventBus class for future features (enemies, pickups)
    - Created `js/input.js` - Mouse lock and pointer management
    - Created `js/ui.js` - Kaplay-based HUD overlay (FPS, position, direction, controls)
    - Refactored `js/main.js` - Kaplay initialization with transparent background
    - Refactored `js/player.js` - Uses Kaplay's input system and game loop
    - Refactored `js/renderer.js` - Dual-canvas setup with direct Canvas 2D rendering
    - Simplified `js/index.html` - Kaplay manages canvas creation automatically
  - **Preserved Features**: All original raycasting functionality maintained
    - DDA raycasting algorithm unchanged (640 rays, perpendicular distance)
    - Wall rendering with distance shading and side-based darkening
    - Circular collision detection with wall sliding
    - Mouse look, WASD movement, strafing, sprint
  - **Architecture Benefits**:
    - Consistent with game-005 patterns for easier future development
    - Event-driven communication for adding enemies, weapons, pickups
    - Kaplay handles game loop timing and delta time automatically
    - Clean separation between raycasting engine and UI overlay
    - Foundation for Phase 2 features (enemies, weapons, items)
  - Files: Updated [game-006/js/main.js](game-006/js/main.js), [game-006/js/player.js](game-006/js/player.js), [game-006/js/renderer.js](game-006/js/renderer.js), [game-006/index.html](game-006/index.html), Created [game-006/js/state.js](game-006/js/state.js), [game-006/js/events.js](game-006/js/events.js), [game-006/js/input.js](game-006/js/input.js), [game-006/js/ui.js](game-006/js/ui.js)

### Added
- **Wolfenstein-like Raycasting FPS** (game-006): Phase 1 - Raycasting Engine Foundation
  - **Raycasting Engine**: Complete DDA (Digital Differential Analysis) algorithm implementation
    - One ray per screen column (640 rays at 640×400 resolution)
    - Efficient wall detection with perpendicular distance calculation
    - Prevents fisheye distortion effect
    - Maximum ray distance: 20 units with distance clamping
  - **Player Movement System**: Smooth movement with collision detection
    - Forward/backward movement (W/S or Arrow Up/Down)
    - Strafe left/right (A/D keys)
    - Sprint mode (Hold Shift for 1.67× speed boost)
    - Collision detection with circular radius (0.3 units)
    - Wall sliding mechanic (smooth movement along walls)
  - **Camera System**: First-person view with 60° field of view
    - Arrow keys for rotation (120°/second)
    - Mouse look support (click canvas to lock mouse)
    - Camera plane calculation for proper FOV rendering
    - Direction and plane vectors updated from player angle
  - **Wall Rendering**: Distance-based shading with multiple wall types
    - 4 wall types with distinct colors: Gray stone, Red brick, Brown wood, Silver metal
    - Distance shading: Linear falloff from bright to dark (20%-100% brightness)
    - Vertical vs horizontal wall differentiation (horizontal walls 30% darker)
    - Wall height calculated from distance for 3D perspective
    - Solid color ceiling (dark blue) and floor (darker blue)
  - **Test Map**: 16×16 grid with varied room layouts
    - Outer walls forming perimeter
    - Interior rooms with different wall types
    - Corridors and open spaces
    - Multiple wall types for visual variety
  - **Controls**: Complete keyboard and mouse input
    - W/S or ↑/↓: Move forward/backward
    - A/D: Strafe left/right
    - ←/→ or Mouse: Rotate camera
    - Shift: Sprint
    - Click canvas to enable mouse look
  - **HUD Display**: Real-time stats overlay
    - FPS counter (updates every 0.5 seconds)
    - Player position (X, Y coordinates)
    - Player direction (angle in degrees)
    - Stats panel with semi-transparent background
  - **Technical Implementation**:
    - Modular ES6 architecture (7 modules: main, config, raycaster, player, renderer, map, utils)
    - Pure vanilla JavaScript (no frameworks for raycasting)
    - 640×400 resolution with crisp pixel rendering
    - 60 FPS target with delta-time based movement
    - Efficient collision detection (checks 4 corners of bounding circle)
  - Files: [game-006/index.html](game-006/index.html), [game-006/js/main.js](game-006/js/main.js), [game-006/js/config.js](game-006/js/config.js), [game-006/js/raycaster.js](game-006/js/raycaster.js), [game-006/js/player.js](game-006/js/player.js), [game-006/js/renderer.js](game-006/js/renderer.js), [game-006/js/map.js](game-006/js/map.js), [game-006/js/utils.js](game-006/js/utils.js), [game-006/game-plan.md](game-006/game-plan.md)

### Added
- **Bullet Heaven Shmup** (game-005): Phase 1 - Core Gameplay Foundation
  - **Project Architecture**: Event-driven modular system with ES6 modules
    - EventBus class for cross-module communication without tight coupling
    - Global game state management with stat multipliers for upgrades
    - Prefab pattern for reusable entity creation
    - 8 core modules: main, config, events, state, sounds, prefabs, player, projectiles, enemies, waves, ui
  - **Player Character**: Auto-shooting character with smooth movement
    - 8-directional movement (WASD or Arrow keys)
    - Precise movement without acceleration/friction for tight control
    - Small visible hitbox indicator (3px core)
    - Invincibility frames (1 second) after taking damage with visual feedback
    - Auto-targeting system shoots at nearest enemy
    - Health: 100 HP, Speed: 200, Base damage: 10
  - **Auto-Shooting Mechanic**: Automatic weapon system
    - Shoots automatically toward nearest enemy every 0.5 seconds
    - Blue projectiles with white outline for clear visibility
    - Collision detection with enemies
    - Sound effect on each shot (600Hz square wave)
  - **Enemy System**: Wave-based spawning with basic enemy types
    - 3 enemy types with distinct behaviors:
      - **Charger**: Medium speed (80), 50 HP, 10 damage, 5 XP
      - **Fast**: High speed (150), 30 HP, 5 damage, 8 XP
      - **Tank**: Slow (40), 200 HP, 25 damage, 20 XP
    - Chase AI - enemies move directly toward player
    - HP bars above enemies (green → yellow → red)
    - Shadows for depth perception
    - Enemies spawn from random screen edges
  - **Wave System**: Continuous spawning with difficulty scaling
    - Enemies spawn at regular intervals (2 seconds initially)
    - Spawn rate increases over time (minimum 0.5 seconds)
    - Gradually increasing difficulty as game progresses
    - Spawn position randomization from all four screen edges
  - **XP & Leveling System**: Progression loop with magnetic collection
    - XP gems drop on enemy death (green glowing gems)
    - Magnetic attraction within 100px radius
    - Bob animation for visual appeal
    - Level up system: 10 XP for level 2, scales by 1.5x per level
    - Level-up sound effect (ascending 4-note chord)
  - **Web Audio API Sound System**: Procedurally generated sound effects
    - 8 sound effects: player shoot, enemy hit, enemy death, XP collect, level up, player hurt
    - Master gain node for volume control (30% default)
    - No external audio files required - all procedurally generated
    - Chord-based effects for satisfying feedback
  - **HUD System**: Complete real-time UI display
    - Health bar (top-left): Red bar with text showing HP/MaxHP
    - XP bar (bottom): Green bar showing progress to next level
    - Level display: Current player level
    - Timer: Minutes:seconds format tracking survival time
    - Kill counter: Total enemies defeated (top-right)
    - All UI elements update in real-time with fixed positioning
  - **Visual Design**: High contrast clarity-first approach
    - Player: Blue circle with white hitbox core
    - Enemies: Red/yellow/gray color coding by type
    - Projectiles: Blue (player) with clear visibility
    - XP Gems: Bright green with glowing outline
    - Shadows on all entities for depth
    - Outlined shapes for clear distinction
  - **Game Over System**: Stats display and restart functionality
    - Darkened overlay on game over
    - Final stats: Time survived, total kills, level reached
    - Press R to restart with full state reset
    - Clean game over screen with statistics
  - **Splash Screen**: Professional game entry screen
    - Gradient background with title and subtitle
    - "START GAME" button with hover effects
    - Control instructions displayed on splash
    - Audio context initialization on start (Web Audio API requirement)
    - Smooth fade-out transition to gameplay
  - **Quality of Life Features**:
    - Player stays within screen bounds (20px padding)
    - Safe spawn zones (enemies spawn off-screen)
    - Forgiving hitbox (player hitbox smaller than visual)
    - Smooth 60 FPS gameplay
    - High-DPI display support with crisp rendering
  - Files: [game-005/index.html](game-005/index.html), [game-005/js/main.js](game-005/js/main.js), [game-005/js/config.js](game-005/js/config.js), [game-005/js/events.js](game-005/js/events.js), [game-005/js/state.js](game-005/js/state.js), [game-005/js/sounds.js](game-005/js/sounds.js), [game-005/js/prefabs.js](game-005/js/prefabs.js), [game-005/js/player.js](game-005/js/player.js), [game-005/js/projectiles.js](game-005/js/projectiles.js), [game-005/js/enemies.js](game-005/js/enemies.js), [game-005/js/waves.js](game-005/js/waves.js), [game-005/js/ui.js](game-005/js/ui.js), [game-005/game-plan.md](game-005/game-plan.md)

- **Tower Defense Game** (game-004): Phase 4 - Upgrades & Economy System
  - **Tower Upgrade System**: 3-tier upgrade progression for all tower types
    - Each tower has 3 upgrade levels with increasing costs
    - Upgrades boost damage, range, attack speed, and tower-specific stats
    - Visual level indicators: star display (☆☆☆) showing upgrade progress
    - Upgrade costs scale by tower type (Archer: 80→120→180, Sniper: 250→400→600)
    - Tower name shows current level (e.g., "Archer [Lv 2]")
  - **Dynamic Stat Upgrades**: Tower-specific bonuses per upgrade tier
    - Archer: +5/+8/+12 damage, +20/+30/+40 range, +0.2/+0.3/+0.5 attack speed
    - Cannon: +25/+40/+70 damage, +30/+50/+70 range, +10/+20/+30 splash radius
    - Mage: +10/+15/+25 damage, +25/+35/+50 range, +0.1/+0.15/+0.2 slow amount
    - Tesla: +12/+20/+35 damage, +20/+30/+50 range, +1/+1/+2 chain count
    - Sniper: +50/+80/+150 damage, +50/+80/+100 range, +0.1/+0.15/+0.25 attack speed
  - **Tower Sell System**: Sell towers for strategic repositioning
    - Sell for 75% refund of total investment (base cost + all upgrades)
    - Frees up grid cell for new tower placement
    - Visual feedback with floating gold text showing refund amount
    - Keyboard shortcut: S key to sell selected tower
  - **Tower Targeting Priorities**: 4 strategic targeting modes per tower
    - **First**: Target enemy closest to exit (default) - prevents leaks
    - **Last**: Target enemy furthest from exit - maximize damage time
    - **Strongest**: Target highest HP enemy - focus fire on tanks
    - **Weakest**: Target lowest HP enemy - quick eliminations
    - Easy switching via UI buttons with visual selection indicator
    - Each tower can have independent targeting priority
  - **Tower Info Panel**: Comprehensive stats display when tower selected
    - Shows current damage, range, and attack speed stats
    - Displays upgrade level with filled/empty star indicators
    - Upgrade button shows next upgrade cost and grays out when unaffordable
    - Sell button shows refund amount calculated from total investment
    - 2×2 grid of targeting priority buttons with highlight on current mode
    - Panel appears on left side (220×340px) when clicking any tower
    - Real-time updates when gold changes to show affordability
  - **Visual Upgrade Effects**: Particle burst animation on upgrade
    - 12 golden particles radiate outward from upgraded tower
    - Particles fade out while moving away from center
    - Range indicator updates to show new range after upgrade
  - **Keyboard Shortcuts**: Quick tower management
    - U key: Upgrade selected tower (if affordable and not max level)
    - S key: Sell selected tower (75% refund)
    - Works from anywhere when tower is selected
  - **Centralized Event Delegation System**: Robust UI click handling
    - `UI_BOUNDS` object defines all UI panel dimensions
    - `isClickOnUI()` helper function checks if click is on any UI element
    - Global click handlers respect all UI areas automatically
    - Easy to add new UI elements without breaking click detection
    - Prevents game clicks from interfering with UI buttons
  - **Economic Balance**: Carefully tuned costs for strategic depth
    - Upgrade costs increase exponentially per tier
    - High-tier towers have higher upgrade costs (Sniper most expensive)
    - 75% sell refund allows strategic repositioning without total loss
    - Wave completion bonuses ($25) help fund mid-game upgrades
    - Economy maintains challenge throughout all 20 waves
  - Files: Updated [game-004/js/config.js](game-004/js/config.js) (added upgrade definitions, targeting priorities), [game-004/js/towers.js](game-004/js/towers.js) (upgrade/sell functions, targeting system), [game-004/js/state.js](game-004/js/state.js) (freeCell method), [game-004/js/ui.js](game-004/js/ui.js) (tower info panel, event delegation), [game-004/game-plan.md](game-004/game-plan.md) (Phase 4 completed)

### Fixed
- **Tower Defense Game** (game-004): Fixed tower info panel buttons not clickable
  - Issue: Panel buttons were being intercepted by global click handler before onClick events could fire
  - Solution: Implemented centralized event delegation system with `isClickOnUI()` helper
  - Global click handlers now check UI bounds before processing game clicks
  - Files: [game-004/js/ui.js](game-004/js/ui.js), [game-004/js/towers.js](game-004/js/towers.js)

### Added
- **Tower Defense Game** (game-004): Complete Sound System & Splash Screen
  - **Splash Screen**: Professional game entry screen with start button
    - Gradient background with animated title and subtitle
    - "Start Game" button with hover effects and animations
    - Game instructions displayed on splash (controls and objectives)
    - Audio context initialization on user interaction (required for Web Audio API)
    - Fade-out transition when starting game
  - **Web Audio API Sound System**: Procedurally generated sound effects using oscillators
    - 10 unique sound effects: tower placement, shooting, enemy hits/deaths, coin collection, wave events, game end states, UI interactions
    - Chords and frequency sweeps for rich audio feedback
    - Master volume control (30% default) via gain node
    - No external audio files required - all sounds generated programmatically
  - **Sound Toggle Button**: In-game sound control in HUD
    - Musical note icon (♪/♫) toggles between enabled/disabled states
    - Visual feedback with color change (green when on, gray when off)
    - Sound state persists during session
    - Toggle button positioned in top HUD next to wave button
  - **Complete Audio Feedback**: Sound effects integrated throughout gameplay
    - Tower placement sound (chord: A4, C#5, E5)
    - Shooting sound (frequency sweep from 800Hz to 200Hz)
    - Enemy hit sound (150Hz square wave)
    - Enemy death sound (300Hz to 50Hz sawtooth sweep)
    - Coin collection sound (chord: C5, E5, G5)
    - Wave start sound (200Hz to 600Hz triangle sweep)
    - Wave complete sound (4-note chord)
    - Game over sound (400Hz to 100Hz dramatic fall)
    - Victory sound (ascending 4-note melody: C5, D5, E5, G5)
    - UI click sound (600Hz short beep)
  - Files: Created [game-004/js/sounds.js](game-004/js/sounds.js), updated [game-004/js/main.js](game-004/js/main.js), [game-004/js/enemies.js](game-004/js/enemies.js), [game-004/js/towers.js](game-004/js/towers.js), [game-004/js/ui.js](game-004/js/ui.js)

### Changed
- **Tower Defense Game** (game-004): Improved rendering quality on high-DPI displays
  - Changed `pixelDensity` from fixed value of 1 to `Math.min(window.devicePixelRatio, 2)`
  - Allows sharper rendering on Retina/high-DPI screens while capping at 2x for performance
  - File: [game-004/js/main.js](game-004/js/main.js#L16)

### Technical
- Updated Claude Code permissions in `.claude/settings.local.json`
  - Added PowerShell and Node.js command permissions for development workflow
  - Added localhost WebFetch permission for local testing

### Added
- **Tower Defense Game** (game-004): Phase 3 - Enemy Variety & Waves
  - **5 Enemy Types**: Expanded from 1 to 5 distinct enemy types with strategic diversity
    - **Scout**: Fast movement (90 speed), low HP (40), no armor - Basic early game enemy
    - **Soldier**: Medium speed (70), 100 HP, 5 armor - Standard armored infantry
    - **Tank**: Slow movement (40), high HP (300), heavy armor (20) - Armored tank requiring anti-armor towers
    - **Speedster**: Very fast (140 speed), medium HP (60), no armor - Quick striker that dodges defenses
    - **Boss**: Massive HP (800), heavy armor (30), huge rewards (150 gold) - Epic boss enemy
  - **Armor System**: Complete damage reduction mechanics
    - Armor reduces incoming damage: `finalDamage = max(1, baseDamage - effectiveArmor)`
    - Armor pierce mechanic for Sniper tower (ignores 50% of armor)
    - All damage sources respect armor (projectiles, splash, chain lightning)
    - `calculateDamage()` function handles armor calculations
  - **Unique Enemy Visuals**: Distinctive designs for each enemy type
    - Tank: Square armor plating with layered gray/green design
    - Boss: Purple body with 8 golden crown spikes in radial pattern
    - Speedster: Streamlined yellow design with inner glow
    - Soldier: Green with enhanced details
    - Scout: Red basic design (from Phase 1)
  - **20 Progressive Waves**: Expanded from 10 to 20 waves with strategic variety
    - Waves 1-4: Tutorial waves introducing single enemy types
    - Wave 5: First boss wave
    - Waves 6-9: Mixed enemy compositions (scouts + soldiers, speedsters + scouts, etc.)
    - Wave 10: Boss + soldiers support wave
    - Waves 11-14: Increased difficulty with tanks and speedsters
    - Wave 15: Double boss wave with speedster swarm
    - Waves 16-19: Maximum challenge with 3-type mixed compositions
    - Wave 20: Epic final boss wave (3 bosses + 5 tanks + 10 speedsters)
  - **Boss Wave Features**: Special visual treatment for boss encounters
    - Boss waves trigger every 5 waves (waves 5, 10, 15, 20)
    - Warning banner appears on screen: "⚠ BOSS WAVE X ⚠" with purple/gold styling
    - Banner auto-fades after 3 seconds
    - Wave counter shows "BOSS WAVE" in orange/red color during boss waves
    - `isBoss` flag in wave definitions marks boss waves
  - **Wave Preview UI**: Shows upcoming enemy composition
    - "Next:" label displays upcoming wave enemies in HUD
    - Colored enemy icons with count indicators (e.g., "×8")
    - Boss wave warning indicator (⚠) in preview
    - Updates automatically after each wave completion
    - Helps players plan tower strategy for next wave
  - **Enemy Stat Scaling**: Progressive difficulty curve
    - Early waves: Low HP enemies for learning
    - Mid waves: Armored enemies requiring tower upgrades
    - Late waves: Fast enemies and heavy armor combinations
    - Boss waves: Strategic challenges requiring optimal tower placement
  - Files: Updated [game-004/js/config.js](game-004/js/config.js), [game-004/js/enemies.js](game-004/js/enemies.js), [game-004/js/towers.js](game-004/js/towers.js), [game-004/js/ui.js](game-004/js/ui.js), [game-004/game-plan.md](game-004/game-plan.md)

- **Tower Defense Game** (game-004): Phase 2 - Tower Variety & Special Abilities
  - **5 Unique Tower Types**: Expanded from 1 to 5 distinct towers with different roles
    - **Archer Tower**: Fast attacks, medium range (100 cost, 150 range, 10 DPS)
    - **Cannon Tower**: Slow, powerful splash damage (250 cost, 200 range, 25 DPS, 60px splash)
    - **Mage Tower**: Magic attacks that slow enemies (200 cost, 175 range, 15 DPS, 50% slow for 2s)
    - **Tesla Tower**: Chain lightning hitting up to 3 enemies (300 cost, 100 range, 20 DPS)
    - **Sniper Tower**: Long-range armor-piercing shots (350 cost, 300 range, 40 DPS)
  - **Unique Tower Visuals**: Each tower has distinctive appearance
    - Archer: Green tower with arrow slits and turret
    - Cannon: Gray tower with large barrel and base
    - Mage: Purple tower with glowing crystal and arcane symbols
    - Tesla: Blue coil tower with electric sphere
    - Sniper: Brown tower with long rifle barrel and scope
  - **Special Attack Patterns**:
    - Cannon: Splash damage with orange explosion effects damaging all enemies in radius
    - Mage: Purple projectiles apply slow debuff with visual indicator
    - Tesla: Instant blue lightning chains between nearby enemies
    - Sniper: Fast orange projectiles with impact flash effects
  - **Different Projectile Types**: Each tower has unique projectile color, size, and speed
  - **Hotkeys 1-5**: Quick tower selection for all 5 towers
  - **Enhanced Visual Effects**: Explosions, lightning bolts, slow indicators, impact flashes
  - **Balance Updates**: Starting gold increased to $500 for better early game strategy
  - Files: Updated [game-004/js/config.js](game-004/js/config.js), [game-004/js/towers.js](game-004/js/towers.js), [game-004/js/enemies.js](game-004/js/enemies.js), [game-004/js/ui.js](game-004/js/ui.js), [game-004/game-plan.md](game-004/game-plan.md)

- **Tower Defense Game** (game-004): Phase 1 - Core Tower Defense Mechanics (MVP)
  - **Modular Architecture**: ES6 module system with event-driven communication
    - Custom EventBus for cross-module messaging without tight coupling
    - Reactive game state management with automatic UI updates
    - Separate modules: config, events, state, map, towers, enemies, waves, ui, main
  - **Grid System & Pathfinding**: Tile-based map with pre-computed enemy paths
    - 32×15 grid (1280×720 desktop resolution, 40px tiles)
    - S-shaped path from left to right with spawn/exit indicators
    - Procedural terrain variation using pseudo-random tile coloring
    - Buildable zones (grass) and no-build zones (path)
  - **Tower System**: Strategic tower placement and combat
    - Archer tower: Fast-firing basic tower ($50 cost, 120 range, 12 damage)
    - Click-to-place interface with visual placement ghost
    - Range indicators on hover and selection
    - Projectile system with target tracking and hit detection
    - "First" targeting priority (enemy closest to exit)
  - **Enemy System**: Path-following enemies with health bars
    - Scout enemy type: Fast movement, low HP (40), $10 reward
    - Smooth waypoint-based pathfinding
    - Dynamic HP bars (green → yellow → red)
    - Death particle effects and floating gold rewards
    - Hit flash feedback on damage
  - **Wave System**: Progressive difficulty with 10 waves
    - Manual wave start (Space or button)
    - Increasing enemy counts and spawn rates per wave
    - Wave completion bonus ($25 gold)
    - "In Progress" status during active waves
  - **Economy & Resources**:
    - Starting gold: $200, Starting lives: 20
    - Earn gold by killing enemies
    - Lose lives when enemies reach the exit
    - Real-time HUD updates using onUpdate polling
  - **User Interface**:
    - Top HUD: Gold ($), Lives (♥), Wave counter, Start Wave button
    - Bottom toolbar: Tower selection buttons with cost, name, hotkey, and icon
    - Centered layout optimized for 16:9 desktop screens
    - Manual hit-testing for toolbar buttons (event masking fix)
    - Visual feedback: button highlighting, placement validation
  - **Controls**:
    - [1] - Select Archer tower for placement
    - [Space] - Start next wave
    - [ESC] - Cancel tower placement / Deselect tower
    - [R] - Restart game
    - Left-click - Place tower or select existing tower
    - Right-click - Cancel placement / Deselect
  - **Victory/Defeat System**:
    - Victory overlay when all 10 waves completed
    - Defeat overlay when lives reach zero
    - Stats display and restart option
  - **Technical Implementation**:
    - Built with Kaplay v4000 (ES6 module import)
    - Custom graphics rendered using Kaplay primitives (rects, circles, text)
    - No external sprites - all visuals procedurally generated
    - Fits desktop screen (1280×720 with letterbox/stretch)
  - Files: [game-004/index.html](game-004/index.html), [game-004/js/](game-004/js/), [game-004/game-plan.md](game-004/game-plan.md), [game-004/lib/kaplay/](game-004/lib/kaplay/)

- **NetHack-Style Roguelike** (game-003): Phase 5 - NPC System
  - **NPC System**: Interactive non-player characters with dialogue
    - 5 NPC types: Merchant, Guard, Wizard, Hermit, Healer
    - Each NPC has unique character, color, and 5 dialogue lines
    - NPCs spawn 2-3 per floor throughout the dungeon
    - Collision detection prevents walking through NPCs
    - NPCs respect fog of war (only visible when in view)
  - **Dialogue System**: Talk to NPCs for immersive interaction
    - Press T key to talk to adjacent NPCs (8 directions)
    - NPC speech appears in message log with color-coded text
    - Format: `NPC Name: "Dialogue text"`
    - Dialogue cycles through 5 unique lines per NPC
    - Bump into NPCs for helpful hint to press T
  - **Persistence**: NPCs saved across game sessions
    - NPC positions and dialogue state saved with level data
    - NPCs persist when traveling between dungeon levels
    - Save/load system fully supports NPC data
  - **New Controls**:
    - T - Talk to nearby NPC
  - Files: Created [game-003/js/NPC.js](game-003/js/NPC.js), updated [game-003/js/Game.js](game-003/js/Game.js), [game-003/js/Renderer.js](game-003/js/Renderer.js), [game-003/js/Input.js](game-003/js/Input.js)

- **NetHack-Style Roguelike** (game-003): Phase 4 - Advanced Features Complete
  - **Magic System**: Mana-based spell casting
    - Added MP (Mana Points) stat: starts at 50, increases +5 per level
    - Fireball spell (F key): 10 MP cost, 15 damage, auto-targets nearest visible enemy
    - Mana refund system when no valid targets available
    - Mana fully restored on level up
  - **Ranged Combat**: Bow-based arrow shooting
    - Arrow shooting (R key): requires bow equipped, 8 damage, 12-tile range
    - Auto-targeting system finds nearest visible monster
    - Bow requirement check before allowing ranged attacks
  - **Projectile System**: Animated spell and arrow effects
    - Projectiles move across screen tile-by-tile
    - Wall collision detection
    - Monster hit detection with damage application
    - Visual feedback with ASCII characters and colors
  - **Field of View (FOV)**: Shadowcasting vision system
    - 10-tile vision radius centered on player
    - Shadowcasting algorithm for realistic line-of-sight
    - Only monsters/items in FOV are visible
    - FOV updates dynamically as player moves
  - **Fog of War**: Persistent exploration memory
    - Explored tiles remain visible but dimmed (#333333)
    - Unexplored areas completely hidden (black)
    - FOV state saved with game for persistence
  - **Multiple Dungeon Levels**: Infinite depth progression
    - Stairs down (>) and stairs up (<) for level navigation
    - Each level procedurally generated
    - Monster difficulty scales with depth (+0.5 monsters per 2 levels)
    - Depth counter in status bar
  - **Level Persistence System**: Visited levels preserved
    - Levels stored by depth number in memory
    - Returning to previous levels restores exact state
    - Map layout, monster positions/HP, items, and fog of war all persist
    - Save/load system handles all visited levels
  - **Enhanced ASCII Graphics**: Colorful varied terrain
    - Floor tiles: 4 character variants (`.`, `·`, `°`, `∙`) with 4 color shades
    - Wall tiles: Textured appearance using `█`, `▓`, `▒` characters
    - Bright yellow stairs for easy visibility
    - Position-based pseudo-random tile selection for organic look
    - Clear visual distinction between walkable and non-walkable tiles
  - **New Controls**:
    - F - Cast Fireball spell (costs 10 MP)
    - R - Shoot Arrow (requires bow equipped)
    - > or Shift+. - Descend stairs
    - < or Shift+, - Ascend stairs
  - **UI Enhancements**:
    - MP display added to status bar
    - Updated controls help with new abilities
    - Spell casting and ranged combat messages
  - Files: Created [game-003/js/FOV.js](game-003/js/FOV.js), [game-003/js/Projectile.js](game-003/js/Projectile.js), updated [game-003/js/Player.js](game-003/js/Player.js), [game-003/js/Map.js](game-003/js/Map.js), [game-003/js/Renderer.js](game-003/js/Renderer.js), [game-003/js/Game.js](game-003/js/Game.js), [game-003/js/Input.js](game-003/js/Input.js), [game-003/index.html](game-003/index.html), [game-003/game-plan.md](game-003/game-plan.md)

- **NetHack-Style Roguelike** (game-003): Phase 4 - Save/Load System Complete
  - **Splash Screen**: Professional menu system for game entry
    - New Game, Load Game, and Quit buttons
    - Styled with gradient background and animated buttons
    - Load Game button enabled only when save data exists
    - Instructions and game description displayed on splash
  - **Save/Load System**: Complete game state persistence using localStorage
    - Save game with Ctrl+S keyboard shortcut
    - Auto-save every 30 seconds during gameplay
    - Load saved game from splash screen menu
    - Confirmation messages for save operations
  - **Serialization System**: Full state preservation
    - Player serialization: position, stats, inventory, equipped items
    - Monster serialization: position, type, HP, status
    - Item serialization: all properties including position and stats
    - Map serialization: tiles, rooms, and dungeon layout
    - Game state serialization: turn count, depth, game state
  - **UI Enhancements**:
    - Equipment bar showing currently equipped weapon and armor
    - Improved status bar layout with better spacing
    - Save confirmation messages in message log
    - Updated help text with save/load instructions
  - Files: Updated [game-003/js/Game.js](game-003/js/Game.js), [game-003/js/Player.js](game-003/js/Player.js), [game-003/js/Monster.js](game-003/js/Monster.js), [game-003/js/Item.js](game-003/js/Item.js), [game-003/js/Map.js](game-003/js/Map.js), [game-003/js/Input.js](game-003/js/Input.js), [game-003/js/main.js](game-003/js/main.js), [game-003/index.html](game-003/index.html), [game-003/styles.css](game-003/styles.css)

- **NetHack-Style Roguelike** (game-003): Phase 3 - Items & Inventory System Complete
  - **Item System**: Comprehensive item types and equipment
    - 5 item types: Weapons, Armor, Potions, Scrolls, Food
    - 4 rarity levels: Common, Uncommon, Rare, Legendary
    - Item templates with 13+ different items (daggers, swords, axes, armor, potions, etc.)
    - Items spawn on dungeon floor (8-12 per level) with rarity based on depth
    - Each item has unique stats: attack/defense bonuses, healing amounts, weight, value
    - ASCII characters and colors for each item type
  - **Inventory System**: Full inventory management
    - 20-slot inventory with pickup/drop mechanics
    - Press G to pick up items, D to drop items, I to toggle inventory screen
    - Stackable consumables (potions, food)
    - Full inventory screen with item list and descriptions
  - **Equipment System**: Weapon and armor slots
    - Equip/unequip weapons and armor from inventory (press 1-9)
    - Equipment bonuses dynamically update player stats
    - Visual equipment display in status bar
    - Attack and Defense stats shown in UI
  - **Consumables**: Usable items with effects
    - Healing potions (Minor: 20 HP, Regular: 40 HP, Greater: 60 HP)
    - Food items (Bread, Rations) for healing
    - Consumables removed from inventory after use
  - Files: Added [game-003/js/Item.js](game-003/js/Item.js), updated Player.js, Game.js, Input.js, Renderer.js, index.html, game-plan.md

- **NetHack-Style Roguelike** (game-003): Phase 2 - Combat & Monster System Complete
  - **Monster System**: 5 different monster types (rat, goblin, snake, orc, troll)
    - Each monster has unique stats: HP, attack, defense, XP rewards
    - ASCII characters and colors for visual distinction
    - Monster AI with pathfinding and chase behavior (10-tile range)
    - Smart movement that routes around walls and obstacles
  - **Combat System**: Turn-based combat mechanics
    - Attack by moving into monsters (bump-to-attack)
    - Monsters retaliate and chase player
    - Damage calculation with defense stats
    - Color-coded combat messages in log
  - **Experience & Leveling System**:
    - XP tracking and level progression
    - Level-up rewards: +10 HP, +2 ATK, +1 DEF, full heal
    - Scaling XP requirements (1.5x per level)
    - XP display in status bar
  - **Monster Spawning**: 5-10 monsters per dungeon level with weighted distribution
  - Files: Added [game-003/js/Monster.js](game-003/js/Monster.js), updated Game.js, Player.js, Renderer.js, index.html
  
- **NetHack-Style Roguelike** (game-003): Phase 1 - Core Dungeon Crawler
  - Procedural dungeon generation using room-and-corridor algorithm
  - 8-directional player movement (Arrow keys, WASD, Q/E/Z/C for diagonals)
  - ASCII-style rendering on HTML5 canvas
  - Turn-based gameplay system
  - Camera following player with smooth scrolling
  - Message log with color-coded events
  - Status bar tracking HP, Level, XP, Depth, and Turn count
  - Collision detection and wall boundaries
  - Modular ES6 architecture
  - Files: [game-003/index.html](game-003/index.html), [game-003/styles.css](game-003/styles.css), [game-003/js/](game-003/js/)

### Fixed
- **Tower Defense Game** (game-004): Fixed Kaplay styled text error with square brackets
  - Issue: Kaplay interprets square brackets `[` `]` as styled text tags, causing "unclosed tags" errors
  - Solution: Changed hotkey display from `[1]` to `(1)` format and updated instruction text to remove brackets
  - Files: [game-004/js/ui.js](game-004/js/ui.js)
- **Tower Defense Game** (game-004): Fixed tower panel height calculation
  - Issue: Panel background was too short, cutting off tower buttons beyond the first one
  - Solution: Added titleSpace constant (32px) to panel height calculation to account for "Towers" title
  - Files: [game-004/js/ui.js](game-004/js/ui.js)
- **Tower Defense Game** (game-004): Fixed tower panel not clickable
  - Issue: Tower buttons in the right panel were not responding to clicks
  - Solution: Added `k.area()` component to tower buttons and attached `onClick()` handlers directly to each button
  - Removed manual hit-testing in favor of Kaplay's built-in area-based click detection
  - Files: [game-004/js/ui.js](game-004/js/ui.js)
- **Tower Defense Game** (game-004): Improved UI text update reliability
  - Issue: Text objects not updating consistently in some Kaplay versions
  - Solution: Recreate text objects on state changes instead of modifying existing text properties
  - Stored text positions for reliable recreation
  - Files: [game-004/js/ui.js](game-004/js/ui.js)
- **Tower Defense Game** (game-004): Fixed click detection overlapping with UI panel
  - Issue: Clicking on the right tower panel would also place towers on the map behind it
  - Solution: Added exclusion zone for right panel area (130px width + 20px margin) in click detection
  - Files: [game-004/js/towers.js](game-004/js/towers.js)
- **NetHack-Style Roguelike** (game-003): Fixed level persistence - levels now remember their state
  - Issue: Descending and returning to previous levels generated new random maps each time
  - Solution: Implemented level storage system that saves/restores level state (map, monsters, items, FOV) by depth
  - Levels are now fully persistent - monsters stay dead, items stay where dropped, map layout unchanged
  - File: [game-003/js/Game.js](game-003/js/Game.js)
- **NetHack-Style Roguelike** (game-003): Fixed status bar not updating after closing inventory screen
  - Issue: Equipment stats would not display properly when returning from inventory view
  - Solution: Added `updateUI()` call after rendering to ensure status bar reflects current equipment state
  - File: [game-003/js/Game.js](game-003/js/Game.js#L270)
- **NetHack-Style Roguelike** (game-003): Fixed message log inconsistent height
  - Changed message log from `max-height` to fixed `height` for consistent display
  - File: [game-003/styles.css](game-003/styles.css#L103)

### Changed
- **Game Browser Refactoring**: Restructured main index.html into modular components
  - Separated HTML, CSS, and JavaScript into dedicated files
  - Created [css/styles.css](css/styles.css) for all styling
  - Created [js/main.js](js/main.js) with modular ES6 classes
  - Created [js/gamedata.js](js/gamedata.js) for centralized game configuration
  - Implemented `GameRenderer` class for dynamic card generation from data
  - Implemented `GameLauncher` class for game launch handling
  - Replaced hard-coded HTML game cards with template-based dynamic rendering
  - Added event-driven architecture using `addEventListener` instead of inline handlers
  - Improved maintainability and scalability for future game additions

## [1.0.0] - 2026-02-03

### Added
- **Space Shooter Game** (game-001): Classic arcade space shooter with keyboard controls
  - Arrow keys for movement, space bar to shoot
  - Score tracking and enemy waves
  - Responsive canvas-based gameplay
- **Match-3 Puzzle Game** (game-002): Strategic gem-matching puzzle game
  - 30 moves limit gameplay
  - Color-coded gems with match detection
  - Score tracking system
  - Built with Kaplay framework
- **Game Browser**: Central hub to browse and launch games
  - Modal-based game player
  - Game cards with descriptions and tags
  - Responsive design
- **GemCore Integration**: Build configuration for desktop deployment
  - Windows build support
  - Customizable app settings
  - Build optimization options

### Fixed
- **Match-3 Game**: Fixed scoring bug where score would continuously increase after the first match
  - Issue: Destroyed gems were not being removed from the grid array, causing them to be counted multiple times in subsequent match checks
  - Solution: Added `grid[gem.gridY][gem.gridX] = null;` in `removeMatches()` function to properly clear grid positions when gems are destroyed
  - File: [game-002/index.html](game-002/index.html#L205)

[1.0.0]: https://github.com/awooldridge/web-games-andrew/releases/tag/v1.0.0
