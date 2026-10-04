# Web Games Collection

A collection of browser-based games built with HTML5, CSS3, and JavaScript. Play classic arcade games directly in your browser!

## Author

**Andrew Wooldridge**

## Games Included

58 games, `game-001` through `game-058`, each self-contained with its own `index.html`. Full metadata (title, description, tags, genre) lives in [js/gamedata.js](js/gamedata.js), which drives the launcher at [index.html](index.html).

### The Garden of Games (launcher)

[index.html](index.html) is a walkable three.js island in the spirit of *Myst*. You arrive on a wooden dock and climb to a hub where a **holographic carousel** cycles through every game, newest first, with brass arrow buttons that press in. One flagstone path per genre leads out from the hub, through a named gate, past a **statue for every game** and on to a pavilion. Each statue's bronze plaque shows the game's icon and title. Hover a statue for its description and click it to play (on a phone, tap for a card with a Play button). Everything is generated in code: the island and its granite cliffs, paths, gazebos (dome, onion, cone, pagoda and crystal roofs), statues sculpted per genre, pines, cypresses, hedges, grass, flowers, vines that grow as you approach, a day/night cycle with stars and an aurora, an ocean shader, and a generative ambient score with surf, birds and crickets. Set pieces sit between the paths: a great gear, an observatory, a lighthouse, a moon fountain, standing stones and a clock tower on its own islet. There's a map, a searchable Library list, a time-of-day panel, and touch controls with a joystick.

The garden grows with the collection. A game's `genre` field picks its path (a game without one is placed by its tags), newer games stand nearer the hub, and paths lengthen and the island widens as games are added. The original card grid is still at [classic.html](classic.html). Code lives in [garden/](garden/), and [garden/dev/browsertest.mjs](garden/dev/browsertest.mjs) drives it in real Chromium on desktop and on touch-only phones.

| # | Game | Genre | Engine |
|---|------|-------|--------|
| 001 | [Space Shooter](game-001/) | Arcade shooter | Canvas |
| 002 | [Match-3 Puzzle](game-002/) | Puzzle | Kaplay |
| 003 | [NetHack Roguelike](game-003/) | Roguelike dungeon crawler | Kaplay |
| 004 | [Tower Defense](game-004/) | Strategy / tower defense | Kaplay |
| 005 | [Bullet Heaven](game-005/) | Survivors-like action RPG | Kaplay |
| 006 | [Dungeon Crawler FPS](game-006/) | Raycasting FPS | Kaplay |
| 007 | [The Forgotten Temple](game-007/) | Interactive fiction | Vanilla JS |
| 008 | [Centipede Tower Defense](game-008/) | Arcade / tower defense hybrid | Kaplay |
| 009 | [Chronicles of the Ember Crown](game-009/) | Turn-based RPG | Kaplay |
| 010 | [Tiny Town](game-010/) | City builder / sandbox | Kaplay |
| 011 | [Nonogram Fleet](game-011/) | Puzzle | Kaplay |
| 012 | [Arcana Pull](game-012/) | Gacha auto battler | Kaplay |
| 013 | [Petal & Purse](game-013/) | Cozy idle sim | Kaplay |
| 014 | [Trackrunner](game-014/) | Endless runner | three.js |
| 015 | [Tamagoji](game-015/) | Virtual pet | Kaplay |
| 016 | [Crate Pusher](game-016/) | Sokoban puzzle | Kaplay |
| 017 | [Pixel Picross](game-017/) | Nonogram puzzle | Kaplay |
| 018 | [Village of the Wandering Blade](game-018/) | Action RPG / village builder | three.js |
| 019 | [Synthwave Breakout](game-019/) | Arcade breakout | Phaser 4 |
| 020 | [The River](game-020/) | Narrative RPG / roguelite | Phaser 4 |
| 021 | [Dungeon Blobber](game-021/) | First-person dungeon crawler | Kaplay |
| 022 | [Depths Unknown](game-022/) | Motherload-style mining | Phaser 4 |
| 023 | [Synthwave Invaders](game-023/) | Space Invaders clone | Kaplay |
| 024 | [Neon Vanguard](game-024/) | Top-down shmup | three.js |
| 025 | [Crypt Crawler](game-025/) | Gauntlet-style dungeon crawler | three.js |
| 026 | [Crypt of the Forgotten](game-026/) | First-person blobber | three.js |
| 027 | [Alchemist's Lattice](game-027/) | Block-placement puzzle (1010!-style) | Phaser 4 |
| 028 | [Echoes of Aethermoor](game-028/) | Visual novel fantasy RPG | Phaser 4 |
| 029 | [Wayfarer's Path](game-029/) | Procedural road RPG | three.js |
| 030 | [Coppergate Lane](game-030/) | Cozy-fantasy RPG-Maker-style adventure | Kaplay |
| 031 | [Grimhold Abyss](game-031/) | Retro DOS-style dungeon crawler | Custom software renderer |
| 032 | [Ironhollow Depths](game-032/) | 8-bit top-down dungeon crawler | Kaplay |
| 033 | [Hearthbound](game-033/) | Cozy fantasy visual novel | Vanilla JS (DOM + Canvas) |
| 034 | [Idle Delve](game-034/) | Idle / incremental dungeon crawler | Vanilla JS (Canvas 2D) |
| 035 | [N2 Overdrive](game-035/) | Neon tube shooter | Phaser 4 |
| 036 | [Island Walker](game-036/) | First-person procedural walking simulator | Custom software 3D rasterizer |
| 037 | [Lanternwake](game-037/) | Turn-based roguelike / Zelda-like fusion | Vanilla JS, no dependencies |
| 038 | [Emberbrood](game-038/) | Procedural dragon battler / turn-based RPG | Vanilla JS, no dependencies |
| 039 | [Wakeform](game-039/) | Atari-2600-style arcade / field-drawing | Vanilla JS, no dependencies |
| 040 | [Starcadet](game-040/) | Vertical bullet-hell shmup | three.js |
| 041 | [Burrowguard](game-041/) | Dig / tower defence / maze-chase arcade fusion | Vanilla JS + hand-written WebGL |
| 042 | [Popgun Pip](game-042/) | 8-bit platformer with Metroid-style unlocks | Vanilla JS (Canvas 2D), no dependencies |
| 043 | [Glimmerglen](game-043/) | Cozy village builder / farming sim / Zelda-like adventure with turn-based battles | Vanilla JS (Canvas 2D + DOM), no dependencies |
| 044 | [The Story Thief of Greymantle](game-044/) | Point-and-click fairy-tale adventure (King's Quest / Warlock of Firetop Mountain) | Vanilla JS (Canvas 2D + DOM), no dependencies |
| 045 | [PINBREAK '86](game-045/) | Synthwave pinball × breakout synthesis | three.js |
| 046 | [Quiverspire](game-046/) | Archero-style roguelite archer | three.js |
| 047 | [Ashes & Aces](game-047/) | Deck-building roguelite × poker solitaire | three.js |
| 048 | [SPINFRAME](game-048/) | Slot-machine mech RPG with incremental systems | Vanilla JS (Canvas 2D + DOM), no dependencies |
| 049 | [Lanterndeep](game-049/) | Turn-based 3D roguelike, 100 floors | three.js |
| 050 | [Tomebound](game-050/) | Match-3 fantasy RPG with an idle village | three.js |
| 051 | [Sigilborn](game-051/) | Gacha auto-battler with idle citadel | three.js |
| 052 | [Nightline](game-052/) | Lo-fi synthwave night-drive simulator | three.js |
| 053 | [Legend of the Jade Wyrm](game-053/) | Legend of the Green Dragon-style RPG with a simulated online realm | three.js |
| 054 | [Pale Engine](game-054/) | DOOM-style FPS with procedural levels and monsters | three.js |
| 055 | [Rotorstorm](game-055/) | Top-down helicopter bullet-hell shooter with a skill tree | Vanilla JS + hand-written WebGL2 |
| 056 | [Keepfire](game-056/) | Castle defence × Plants vs. Zombies lanes × incremental | three.js |
| 057 | [Hivebreaker](game-057/) | Twin-stick bug-swarm shooter with a five-sector campaign | three.js |
| 058 | [Bumble Basket](game-058/) | Casual fruit puzzle: trails where each hop shares a kind, colour, size or family | three.js |

### Highlights

**[Space Shooter](game-001/)** — Classic arcade space shooter, the repo's first game. Arrow keys or A/D to move and hold Space to fire, or drag to steer on a phone; progressive enemy waves and a saved best score.

**[NetHack Roguelike](game-003/)** — Procedurally generated infinite-depth dungeons, full RPG systems (combat, leveling, inventory, magic), FOV/fog of war, NPCs, and save/load — all in modular ES6.

**[Tower Defense](game-004/)** — 5 tower types (Archer, Cannon, Mage, Tesla, Sniper) with splash damage, slows, and chain lightning vs. 5 enemy types across 20 escalating waves, including boss waves every 5th wave. Full procedural sound system via Web Audio API.

**[Bullet Heaven](game-005/)** — Survivors-style bullet heaven with 3 RPG classes, 8 enemy types with distinct AI (orbiting, teleporting, splitting), auto-shoot, XP, and level-up upgrades.

**[Chronicles of the Ember Crown](game-009/)** — Final Fantasy-style turn-based RPG. Four-hero party through 12 battles, MP, status effects, leveling, and a Lich King boss fight.

**[Synthwave Breakout](game-019/)** — Neon brick-breaker: escalating ball speed, 8×14 bricks with HP tiers, 4 powerups, Tron-style light trail, CRT scanline overlay. Built in Phaser 4.

**[The River](game-020/)** — Narrative roguelite: a 10-stop seeded river journey gathering companions and ingredients for a feast, with tower hints, companion synergies/clashes, and procedural ambient music.

**[Neon Vanguard](game-024/)** — Top-down shmup in three.js with custom shaders, real bloom post-processing, choreographed enemy movement patterns, and a glowing animated grid floor.

**[Grimhold Abyss](game-031/)** — Retro first-person dungeon crawler in the style of early-90s DOS shareware, rendered by a **from-scratch software 3D engine**: a 320×200 palette-indexed framebuffer, perspective-correct textured walls, dithered EGA shading, and billboard sprites — no WebGL, no 3D library. Every floor is procedurally generated with zero asset files; all textures, sprites, and sounds are generated at runtime.

**[Ironhollow Depths](game-032/)** — 80's-style top-down 8-bit dungeon crawler in the vein of classic CRT-era action-RPGs. Guide a pixel-art knight down ten procedurally generated floors (each checked by flood fill) past slimes, erratic bats and bone-throwing skeletons; clear a floor to open its stairs, and claim the Hollow Crown at the bottom. Touch controls on phones.

**[Hearthbound](game-033/)** — Cozy fantasy visual novel built on a **hand-crafted vanilla JS engine** (no game library) — DOM for the story layer, canvas for battles. Inherit a rundown countryside apothecary and spend a season running it: brew remedies to order for your neighbours, forage, trade with a travelling peddler, and work out why the wood at the edge of the village has gone so quiet since your aunt died. About an hour of story across 195 branching nodes and 13 endings, with inventory, equippable trinkets and charms, leveling, a quest journal, and affinity-gated branches that decide who walks into the dark with you.

**[Idle Delve](game-034/)** — Idle/incremental dungeon crawler, **fully vanilla JS with zero image assets** — a raw Canvas 2D renderer draws every room, hero, and monster as procedural shapes. A party auto-battles room by room through a procedurally generated dungeon, even while the tab is closed (offline catch-up simulation on reload); bank the gold to recruit heroes and buy permanent stat/gold-find/deeper-floor upgrades in the Town panel between runs.

**[Island Walker](game-036/)** — First-person walking simulator on a wholly procedural island, rendered by a **3D engine written from scratch — no three.js, no WebGL**: JavaScript transforms, culls, lights and depth-sorts every triangle into a 2D canvas. Terrain, trees, streams, a sea cave, clouds and buildings all generate from one seed, so every reload is a new island. Wander the forest, lighthouse point, cemetery, garden and ancient ruins to recover 10 lost books and 8 artifacts, then carry them home — the Library's shelves and the Museum's pedestals visibly fill with everything you return. No enemies, no fail state. Engine notes and gotchas in [docs/software3d/](docs/software3d/software3d-api.md).

**[Lanternwake](game-037/)** — Turn-based roguelike / Zelda-like fusion about a lantern-keeper walking a country where the lights have been going out. **Vanilla JS with no dependencies, no build step and no asset files whatsoever** — every sprite is drawn in code from declarative recipes, every sound is synthesised, and the whole 1536×1536 world is a pure function of one seed string. The overworld persists and remembers what you did to it; the Hollows underneath re-knit themselves on every descent, generated mission-first (a graph of keys, locks, puzzles and a boss, embedded into one of five layout algorithms). People come before quests: needs are generated from who somebody is, and a quest whose object cannot be resolved to a real thing is discarded rather than faked. You cannot die — you wake, and lose the light you had and the hours you had left. Design decisions and deviations from the spec are in [game-037/DECISIONS.md](game-037/DECISIONS.md); the test harness runs with no tooling at [game-037/test/harness.html](game-037/test/harness.html).

**[Emberbrood](game-038/)** — An 8-bit **procedurally generated dragon battler**: fight them, bind them, raise them, breed them. Battles are Final Fantasy-shaped (a party of three, turn order by speed, MP, eleven statuses, an eight-element chart with real ×4 and ×0.25 matchups, a shared Ember Surge meter), but every wild fight can also end in a capture, and the odds are shown before you commit. Every dragon in the game — including the ones you hatch — comes out of a genome that decides its stats, skills, temperament **and its 32×32 sprite**, so a dragon you bred visibly resembles its parents, and each generation is measurably better than the last. Grey, nameless "ashbound" dragons can be cleansed mid-battle and get their real names back. 87 items, a forge, roost dungeons, 18 main quests across five acts, generated notice-board work, and three endings gated on what your brood can actually prove. **Vanilla HTML/CSS/JS, no libraries, no build step and no asset files at all** — every sprite is drawn in code, every sound synthesised, and the whole country grows from one seed. Design doc in [game-038/GDD.md](game-038/GDD.md); the test harness runs with no tooling at [game-038/test/harness.html](game-038/test/harness.html).

**[Burrowguard](game-041/)** — An **8-bit arcade fusion of a digging game, a tower defence and a maze chase**, where the three genres are one system rather than three modes. Monsters walk in off the surface and head for a crystal core at the bottom of the dig site, and they walk *only through tunnels* — tunnels you dig. The round starts with a pre-dug, pellet-filled maze (the maze chase), every cell of dirt you carve pays gold (the digging game), and gold buys towers you build into the dirt beside their route (the tower defence). The catch is that your tunnels are their maze: dig a shortcut between two corridors and the whole horde takes it. So good play is digging dead ends — to harvest ore, to reach the four power gems, and to get under the boulders — without ever connecting two parts of their route. Up close you fight it out by hand: a harpoon pumps monsters until they pop, boulders you undermine fall and crush whatever is beneath, and a power gem turns every monster blue so you can chase them down for 200-400-800-1600. Five enemy types each break a different rule — drakes breathe fire through dirt, stalkers hunt *you* and phase through solid ground as a pair of eyes, borers drill brand-new shortcuts to the core — plus a crowned king every sixth wave. **Vanilla JS and a hand-written WebGL renderer**: one sprite batcher, a sharp-bilinear filter so 16px pixel art stays crisp at any scale, neon vector-style tunnel edges, and a bloom + scanline post pass; every sprite, glyph and sound is generated in code. Built for a phone first (relative thumbstick, a PUMP button, a build tray, ≥44px targets, portrait and landscape layouts); the pure simulation and the phone layout are verified by the harnesses in [game-041/dev/](game-041/dev/README.md).

**[Popgun Pip](game-042/)** — A **light-hearted 8-bit platformer that crosses Mario-shaped worlds with Metroid-style unlocks**, and the collection's first proper platformer. Pip hops, stomps and pops (a cork popgun, aimable up and diagonally) across five islands of four levels and a castle each, all **procedurally generated from one save seed**: ? blocks and bricks, pipes with chompers, springs, lifts over pits, firebars, crushers and lava, twelve enemy types (shell-kicking snails, swooping bats, slimes that split, clouds that rain on you) and five multi-phase bosses. Each boss hands back one of Grandma's stolen gadgets — Spring Boots, a Frost Ray that turns enemies and bubble blocks into ice you can stand on, Sticky Mitts for wall-jumping, a Rocket Popper that blasts red rock — and **every level is generated with pockets you can see but can't reach yet** (high shelves, bubble stairs, tall shafts, sealed vaults, basements under cracked floors) holding Sun Shards, heart containers, a Spread Shot and power chips, so each new gadget reopens the map. The generator's promise is checked, not assumed: `js/validate.js` runs the **real player physics** from every standable cell with a set of input programs and a BFS, proving each level's route is beatable with the moves that world assumes and that every gate needs exactly its gadget (verified over 250 generated levels). Graphics are NES-palette pixel art — hand-drawn character strings plus procedurally generated tiles and parallax backdrops — rendered into a canvas whose backing store is the game's own pixel buffer, scaled by a whole number of device pixels. Music comes from a small chiptune composer (pulse channels via `PeriodicWave`, triangle bass, noise drums) that writes every level its own AABA song. Plays on a phone as a handheld in portrait or with floating controls in landscape, and on keyboard or gamepad; see [game-042/GDD.md](game-042/GDD.md) and [game-042/dev/](game-042/dev/README.md).

**[The Story Thief of Greymantle](game-044/)** — A **point-and-click fairy-tale adventure** in the King's Quest mould, with the mountain, the warlock and the second-person voice of *The Warlock of Firetop Mountain*. On the longest night of the year the stories of a village are vanishing, and the thief turns out to be a father looking for the ending of a bedtime story. Ten scenes painted in code and reduced to a 37-colour palette through an ordered dither; a Walk/Look/Use/Talk verb bar, a satchel of fifteen items to combine and use, a riddling stone door, eight Sierra-style deaths undone by *turning back a page*, a Book of Tales that writes your adventure as you play, a 200-point score and three endings. Vanilla JS, no libraries, no asset files; `dev/walkthrough.mjs` plays every ending through the real UI.

**[Glimmerglen](game-043/)** — A **cozy village builder crossed with a Zelda-style adventure**: Stardew Valley's days, seasons, crops, animals, foraging, mining, cooking and shipping bin, wrapped around an overworld of five regions whose dungeons each hold a Heart Shard and the relic that opens the next region's gate. You inherit an overgrown glen, a split and leafless Heartwood tree and a Mayor with a village of one. Rebuild the Job Board and **travellers of twelve trades apply to live there**; each needs a home-and-shop that fits their job (a Forge, a Café, a Watchtower…) on a lot you clear yourself, and **every villager contributes** — daily goods in the Storehouse, a shop or refining station, a passive boost, a three-chapter personal story, a companion who fights beside you, and hands for job-board postings you can **assign to them** instead of doing yourself. Coziness levels the village, which breaks the dungeon seals; returning shards grows the Heartwood and wakes the land's **faded magic** — shrines, fairy rings, moonwells, heart acorns and caches that are invisible (just a shimmer) until then. **Turn-based battles** show every monster's next move (guard the 💢 wind-ups) with elements, skills, items and companions. **Everything is generated from one seed** chosen in the character creator: the land and its regions and names, roads and secret pockets, dungeon and cave floors, monster species, villagers' faces, personalities and stories, the job board, the weather, every pixel-art sprite and a seeded AABA composer's music for each place. Three save slots plus autosave and save-file export/import. Phone-first (floating joystick, smart A button, pixel-perfect scaling); Node harnesses play the whole main quest with a bot and prove every region opens exactly when it should across 80 seeds. See [game-043/GDD.md](game-043/GDD.md) and [game-043/dev/](game-043/dev/README.md).

**[Starcadet](game-040/)** — A **vertical bullet-hell shmup in three.js built around a rescue mechanic**, with a story attached to the scoreboard. The Chorus takes Halcyon Flight Academy mid-examination, the instructors die in the first ninety seconds, and the only thing left flying is a *trainer*: practice cannons and a tow hook rated for towing target drones. Two hundred and eleven of your classmates are in escape pods. **Shooting is how you survive, hooking pods is how you win** — pods drift down, enemies shoot them, and one that falls past you is gone for the rest of the run, so the safe lane at the bottom of the screen is exactly where the cadets aren't. Six levels, each with its own animated shader backdrop and palette; 14 enemy archetypes that each own a shooting pattern from a 12-pattern emitter library (aimed, fan, ring, spiral, whip, wall-with-a-gap, rain, homing, telegraphed laser, hanging nova, flower, cluster); four weapons at five power levels; flares with a death-bomb window; graze-fed Overdrive; and six multi-phase bosses — a battleship whose four destructible turrets each remove an attack from its cycle, your own flight instructor using the drills he taught you, and a finale that literally opens one safe lane per named classmate you brought back. Five rescued cadets each give a permanent ship ability, so the story and the build progression are the same system, and the headcount at the end decides which of four endings you get. Built for a phone as much as a desktop: **relative** touch dragging (the ship moves by your thumb's travel instead of teleporting to it, so your hand never covers what you are dodging), a two-corner control layout, forced auto-fire on touch, and quality tiers that step down automatically if the frame rate will not hold. Real bloom, instanced bullet rendering (200+ live bullets in one draw call), and **no asset files at all** — every ship, bullet, starfield, explosion, comms portrait and sound is generated in code. The simulation is a pure module that imports neither three.js nor the DOM, which is what let the Node harnesses in [game-040/dev/](game-040/dev/README.md) play whole levels, whole boss fights and a full six-level campaign with no browser.

**[Wakeform](game-039/)** — An **Atari-2600-shaped arcade game built on one original mechanic**, and the whole game is in that mechanic: you have no weapon. Your probe can do exactly one thing — invert its own polarity — and as you fly it continuously sheds **echoes**, frozen copies of itself holding whatever polarity you had at that instant. The echoes are not a trail and not a wall; each one exerts the same force you do, so like-polarity motes are shoved away and opposite ones are drawn in and absorbed. You defend the reactor core by *drawing a working machine out of your own movement history* — lay a stroke to steer motes, funnel them into a knot of opposite echoes that holds them orbiting, then fly in and harvest the cluster in one enormous chain. Every echo and every flip costs flux, and flying back through your own past reclaims it, so good play is a loop: build, harvest, reclaim, rebuild. Five mote classes each attack a different weakness in a lattice (the leech eats echoes you abandoned; the anchor ignores force entirely and has to be fetched by hand). **Vanilla HTML/CSS/JS, no libraries and no asset files** — a 160×192 internal buffer scaled nearest-neighbour, an 8-colour palette sampled from the real 2600 NTSC ramp, sprites and playfield generated per run seed, all audio synthesised. Difficulty was tuned against scripted bots rather than guesswork; the Node harnesses that verified it without a browser are in [game-039/dev/](game-039/dev/README.md).

**[PINBREAK '86](game-045/)** — A **flashy synthwave pinball table whose upper half is a breakout brick wall**. It plays like pinball — hold-and-release plunger, flippers, pop bumpers, slingshots, nudging and TILT — but you win like breakout: clear every brick to finish the wave. The genres meet in the middle: bricks drop power-ups that fall down the table and are **caught with the flippers**, which double as the breakout paddle (multiball, a fireball that ploughs through the wall, lasers fired from the flipper tips, a drain shield, wide flippers, double score), and explosive bricks detonate in cascading chains. Five layouts that loop tougher, a combo multiplier whose brick sounds climb a pentatonic scale, ball save, extra balls. Built to be juicy: real bloom plus a CRT pass (chromatic aberration that spikes on impacts, scanlines, vignette, colour flashes), chrome balls reflecting a neon environment, ribbon trails, pooled sparks, tumbling instanced shards, shockwave rings, a table-surface shader lit by every explosion, screen shake, FOV punches, hit-stop and slow-motion, all under a striped retro sun, wireframe mountains and a scrolling grid floor that pulse with a sequenced synthwave soundtrack (it grows layers as the combo climbs). The physics is a pure 480 Hz simulation with no three.js or DOM in it, so [game-045/dev/](game-045/dev/README.md) has a bot play thousands of balls headlessly and fail on any ball that leaves the table; an attract-mode demo of that same bot plays behind the title screen.

**[Quiverspire](game-046/)** — An **Archero-style roguelite archer** in three.js. Your archer fires automatically at the nearest enemy, but only while standing still — moving stops the bow — so every room is a rhythm of dodge, plant your feet, loose arrows, dodge again. Climb ten chapters of twelve rooms (**120 procedurally generated rooms**, plus an **Endless** mode whose difficulty curve steepens as it climbs): mirrored layouts of rock, water, lava, acid, chasms and spike traps, validated so every room's door and every spawn is reachable on foot. Twelve enemy types that all telegraph their attacks (laser sights, charge lanes, marked landing circles, lobbed bombs you can watch arc in), elite champions, angels, devil's bargains that cost a slice of max HP forever, and five multi-phase bosses who return **Ascended** in the later chapters. Level-ups offer three of 29 stacking abilities — Multishot, Front/Diagonal/Side/Rear arrows, Ricochet, Piercing, Bouncy Wall, fire/frost/poison/lightning arrows, orbiting flame and frost circles, spirit wisps, Aegis, an Extra Life — and coins buy six permanent talents between runs. **Everything is generated in code**: floor textures painted per biome from a recipe, a seven-look liquid/chasm shader, obstacles, props, the hero, every enemy and boss modelled from primitives and hue-shifted per chapter, and a music sequencer that composes each chapter its own loop. Keyboard, gamepad, or a one-thumb floating joystick on a phone. The simulation is pure and seeded, so [game-046/dev/](game-046/dev/README.md) has a bot play every chapter headlessly (checking every tick that nothing leaves the room or stands in a wall) and a Playwright harness walk the real game on desktop and touch-only phones.

**[Ashes & Aces](game-047/)** — **Slay the Spire meets poker solitaire** in a dark high-fantasy three.js roguelite. Every fight is played on a 5×5 table: place cards from your hand (three Deals a turn), and whenever a row, column or diagonal fills it fires as a **poker hand** — the hand sets the multiplier, and each card's chips flow into its suit: ♠ Blades damage your target, ♣ Staves hit every enemy, ♦ Coins raise Ward, ♥ Hearts heal. One card that finishes two lines is a **Cross** (×1.5 each). Monsters telegraph their intents and fight the table itself — sealing cells, stealing your best card, frosting cells so they score nothing, scrambling rows, shuffling dead Ash into your deck — and ten scripted **Crowned Wardens** add rising tides, erased columns, mirages and phase changes. Build a deck from ten enchantments, 22 Arcana spells, 52 relics and 8 elixirs across **10 realms × 10 levels = 100 levels** of branching Slay-the-Spire maps (battles, elites, mysteries, merchants, campfires, treasure). An authored epic, *The Last Hand*, with a chapter, interlude and Warden scene per realm and three endings, plus a Chronicle the run writes about you. **Everything is generated in code**: card faces painted at 512×720 with normal and foil maps (J/Q/K get generated portraits), eleven monster body plans grown from genomes with shader veins, rim light and dissolve deaths, ten realm backdrops (sky shaders, parallax ridges, props, GPU weather, god rays), heroes with generated names and looks, and a generative soundtrack (Karplus–Strong harp, FM bells, taiko, formant choir, convolution reverb) that composes each realm its own map, battle and Warden themes. The simulation is pure and seeded: [game-047/dev/](game-047/dev/README.md) has a bot play whole 100-level runs headlessly to balance the curve, and a Playwright harness walk the real game on desktop and touch-only phones.

**[SPINFRAME](game-048/)** — A **turn-based sci-fi mech RPG whose combat is a slot machine**. You are a cadet at the Halcyon Flight Academy, flying a training frame powered by a **Probability Engine**: every turn you spin its reels and **every symbol that lands fires** — Blades and Cannons at your target, Missiles at every enemy, Arcs that chain lightning between them, Shields, Repairs, Energy and Scrap. Three or more of a kind from the left on a payline hit far harder, every extra line in the same spin is a link in a multiplying **chain**, Overclock wilds stand in for anything, three Cores start an **Overdrive** (bonus spins at ×2 while the enemy is frozen) and five hit the **Jackpot**. After the reels land you can spend energy to nudge, respin, hold or purge a reel, with the lines you are about to hit previewed as dashed traces — because the enemy, the **Determinant**, a machine mind that cannot bear an outcome it did not predict, jams your reels and writes dead Glitch symbols into your strips. **Upgrading the mech rewrites the machine**: the Reel Array goes from 3 to 5 reels, the Targeting Matrix from 3 to 16 paylines and a fourth row, new hardpoints add Missile and Arc symbols to every strip, the reactor, servos and Probability Core change how much you can cheat fate, and the frame visibly changes with each install (a mini-slot window on its chest shows one reel per reel). 18 modules bend the rules (cascades, expanding and sticky wilds, mirror lines, clusters, echo lines, overheat vents…), three skill trees shape the pilot, and boosters drop mid-fight. Seven procedurally generated sectors (skirmishes, elites with affixes, Signals, salvage, depots, repair bays, a boss each), an authored story — *The Graduating Class* — told in comm scenes with a wry mech AI, a rival cadet and an instructor the enemy takes and rewrites, a contract board, and **incremental** systems: a Refinery that earns while you are away, drone bays, an archive and a core forge, exponential upgrade curves, an endless Sim Ladder and Threat levels after graduation. Built for juice: staggered reel stops with anticipation, chasing marquee bulbs, line traces, chain counters, cascades, orbs flying from the reels into the mech, lightning chains, missiles, hit-stop, slow-mo, shake, coin showers and BIG / MEGA / EPIC WIN banners. **Vanilla HTML/CSS/JS, no libraries and no asset files** — every symbol, mech, enemy, portrait and backdrop is drawn in code and every sound synthesised. The simulation is pure and seeded: [game-048/dev/](game-048/dev/README.md) has a bot play the whole campaign headlessly to balance it, and a Playwright harness walk the real game on desktop and touch-only phones.

**[Lanterndeep](game-049/)** — A **turn-based 3D roguelike** in three.js, in the Pixel Dungeon / DCSS line. The lamps of Lastlight are going out; your teacher Maren went down to tend the First Lantern a year ago and never came back. Take her spare lantern and descend **the Hundred Stairs: 100 procedurally generated floors in ten worlds** (rootcellars, a bioluminescent grotto, a drowned library, a dwarven forge split by lava, crystal hollows, an ossuary, a clockwork machine, a frozen abyss, a vault among the stars, the Heart of Night), each built by one of four generators (rooms, caves, halls, mixed) with liquids, pillars, props, traps, braziers and sealed vaults, and validated so the stairs are always reachable. Every 10th floor is a **Warden**: ten multi-phase bosses whose area attacks are telegraphed on the grid and land after your next move. **Your lantern is your light radius and your clock** — it burns oil every turn, braziers and torches light rooms you can see from across the dark, and when the oil runs out the Hush gathers. Three heroes (Warden, Ranger, Emberwitch) with four skills each and a perk choice every level; **procedural loot** (Common/Magic/Rare with 25 affixes, plus nine Warden relics), chests, mimics, shrines, fountains and merchants; **procedural quests** from Wayfarers — bounties, culls, lost heirlooms, rescues whose freed captive fights beside you, nests to purge, braziers to relight; **70 monster species** on eleven behaviour archetypes with elite affixes and generated names; and an authored story told through chapter cards, Warden scenes and **Maren's ten journal pages**, which unlock the best of three endings. **Everything is generated in code**: painted floor and wall textures per world, a fog-of-war texture every level material samples (the dark peels back smoothly, remembered rooms fall to a cold grey), walls cut away in the vertex shader so the hero is never hidden, animated water, lava and void, procedural props, monsters and Wardens, bloom and a graded post pass, and a generative score per world that swells for fights and Wardens. Tap-to-move with auto-explore and big buttons on phones (portrait or landscape), keyboard on desktop. The simulation is pure and seeded: [game-049/dev/](game-049/dev/README.md) has a bot play all 100 floors with each hero to balance the curve, and a Playwright harness walk the real game on desktop and touch-only phones.

**[Sigilborn](game-051/)** — A **fantasy gacha auto-battler** in the Summoners War / AFK Arena line, in three.js with toon shading and inverted-hull outlines. You are the **Overlord** who claims the shattered Sigil Throne — built in a **deep character creator** (10 races, 10 eye styles, 16 hairstyles, horns, tails, wings, 10 outfits, 13 headwear, 14 weapons, auras, free colours, per-group randomize locks) that doubles as every hero's Wardrobe. **Every hero is procedurally generated**: race, class (12), element (5), natural rarity from Common to Mythic, stat rolls with an S–C grade, 0–3 traits, a skill kit drawn from class pools with generated names, leader skills, a painted anime face and a chibi 3D body — and a one-in-fifty **Radiant**. Summoning has pity (soft from 60, hard at 90), a guaranteed 4★ per ten-pull and a weekly featured element+class, revealed by a 3D portal that charges blue → purple → gold. Battles use **Summoners War's attack-bar turns** (speed is a stat you build), element advantage and glancing hits, 20 statuses, a live turn-order bar, auto play at 1×–3× or manual skill-and-target play, and **Overlord spells** cast from mana. Content: **8 campaign regions × 8 stages** with bosses (a treant, a cinder wyrm, a kraken queen, a sun colossus, a lich king, a winter alpha, a crystal spider matriarch and the Usurper), **elemental Rifts**, the **Endless Spire** with pick-1-of-3 roguelite blessings, and an **Arena** of generated rival Overlords. **Sigilstones** (6 slots, 12 sets, random substats, +0 → +15 with falling odds, reforging, ore-and-jewel crafting), evolution with fodder, awakening with essences, skill-ups and release for Soul Dust. Between fights the **floating citadel** — day and night follow your clock, your heroes wander it — keeps working: the Treasury fills while you're away, the Training Grounds level heroes, a **diggable 3D mine** (ore veins, jewels, geodes, chests, fossils, sigil caches, deeper layers) with idle miners, a **real-time farm** with watering and golden mutations feeding a Kitchen of XP elixirs and timed feasts, a Forge, an expedition board with stories, dailies/weeklies/feats and a 31-step main questline, a rotating Market and a Fortune Wheel. Everything — models, faces, icons, music and sound — is generated in code. [game-051/dev/](game-051/dev/README.md) has a progression bot that plays three weeks to tune the curve, and a Playwright harness that plays the real game on desktop and touch-only phones.

**[Nightline](game-052/)** — A **lo-fi synthwave night drive** through an endless, rain-soaked, Blade Runner-style city. No goals and no crashes: you set a cruise speed, ask for a lane (the blinker waits for a gap that grows with the closing speed, so nothing can ever hit anything), and pull over when something looks good. The city is built in 96 m chunks as you drive — five districts with their own palettes (neon downtown with cross streets and animated billboards, a paper-lantern night market, a skyway viaduct above the lit grid, a harbour of cranes, piers and ships, residential heights), and every kilometre or so a stop with a pull-in bay: noodle bar, diner, charging station, overlook, konbini, record shop, arcade, motel, laundromat, pier. Parked, the camera frames the place and lines of description drift past while the rain falls; each stop has one small thing to do, and visits go in a night log. Every sign, lamp and tail light shows up in the wet road through a mirrored reflection pass, the street-lamp pools and your headlights are painted analytically in the road shader, and the frame is rendered at 240 lines with bloom, dithering and scanlines. Three **generative radio stations** (synthwave, lo-fi hip-hop, slow analogue ambient) invent their own tracks, under rain, tyre hiss, thunder, spinner fly-bys and a distant siren. Drift mode lets the car drive itself, with cinema cameras. [game-052/dev/](game-052/dev/README.md) fast-forwards a 40 km drive checking every step that nobody overlaps anybody.

**[Legend of the Jade Wyrm](game-053/)** — A **Legend of the Green Dragon-style browser RPG** that recreates the whole online experience with no server. Each day you get a handful of forest fights in the Gloamwood (about a hundred creatures, 24 forest events), beat your master at the Proving Yard to level up, and at level 15 face the Jade Wyrm — slay it and you start over at level 1 with a permanent gift and a new title. The village has everything the original did: shops whose stock is renamed as you earn respect, a bank, a healer, an inn with drinks, a bard, flirting and marriage, a safe room and a bounty broker, stables, a fortune teller, gardens, the Wyrmslayers' stone, guilds, a lodge of deeds, the Herald, the Hall of Heroes and raven mail; die and you torment souls on the Pale Shore for the Ferryman's favour. **The other players are simulated**: 60 of them with personalities and real-clock schedules log in and out, chat in the square and answer you, level up, die, slay the Wyrm, marry and form guilds, and attack you if you sleep in the fields. The text-first pages (LoGD colour codes, a hotkey on every action) sit in a three.js frame: an oak beam with crossed swords and a painted shield, a timber window onto a low-poly village the camera flies around, torches, a sky that follows the game clock, and 3D foes that lunge and fall. Three save slots with export/import, two day-pacing modes, phone layout with drawers. [game-053/dev/](game-053/dev/README.md) plays the whole game in Playwright and balances the curve with a headless bot.

**[Pale Engine](game-054/)** — A **DOOM-style first-person shooter** on Io, 2291: the station's Pale Engine drilled through the bottom of everything, and you are the last Warden, with the station AI VESPER in your ear and its own reasons for wanting you at the bottom. Ten levels in three episodes are generated from a seed — rooms, stairs, lava pits, crates and open-air courtyards from per-cell heights, keycard doors, secret walls, barrels, ambushes and data logs — and every level is played by a validator (and, in the tests, walked by a bot through the real collision code) before you see it. Each run rolls its own monster species across ten archetypes (hitscan thralls, fireball imps, lunging hounds, flying skulls and eyes, spider turrets, brutes, missile revenants, a necromancer that calls down fire, a rocket juggernaut) that see and hear you, follow a flow field, infight, stagger and can be executed with the blade for health, plus three guardians ending with the Archon and its pylon shields. Nine weapons modelled in code up to a Rail Driver and a Singularity Cannon, six powerups including DOOM's inverted-colour invulnerability, baked lightmaps lit live by every muzzle flash, procedural bump-mapped textures, four skies, a post pass per powerup, a generative industrial-metal score, an automap, intermission tallies with par times, Endless Descent, and full touch controls. [game-054/dev/](game-054/dev/README.md) has a headless generator/bot test and a Playwright run on desktop and phones.

**[Rotorstorm](game-055/)** — A **top-down helicopter bullet-hell shooter** in vanilla JavaScript and hand-written WebGL2, with no libraries or asset files. On the Shattered Coast in 2061 a storm-steering AI, MERIDIAN, has turned on the cities it protected, and you fly the AH-77 Kestrel through six operations over procedural terrain: archipelago, jungle river, desert highway, ice shelf, neon city and volcano. The CPU and the GPU share one noise function, so gunboats spawn on the water the shader paints. A director places the waves where the ground suits them (tanks on land, boats on water, convoys on the highway), with elite waves, a mid-boss, salvage caches and civilians to winch up. Six multi-phase bosses fight with named spell cards: rings, curving and accelerating bullets, bullets that stop and re-aim, splitting orbs, telegraphed lightning and sweeping lasers. Graze to charge Overdrive, wipe the screen with an EMP, chain kills, and spend salvage on a 28-node skill tree between operations. Terrain baked by shaders with animated water and lava, craters and treads stamped into the ground, falling wrecks, layered explosions, shockwaves, HDR bloom, weather, a generative soundtrack, radio portraits, an ending shaped by the survivors you saved, the endless Stormfront mode, and relative-drag touch controls. [game-055/dev/](game-055/dev/README.md) plays every operation headlessly with a god bot and a dodging bot, and drives the whole game in Chromium on desktop and phones.

**[Keepfire](game-056/)** — A **castle-defence take on Plants vs. Zombies** with an incremental heart, in three.js. The last keep in Aldmere starts as one tower with one archer; procedurally generated monsters march down five lanes and every kill pays gold, spent mid-wave on party members placed on stepped tower platforms (safe from melee) or out in the bailey: archers, gold-brewing alchemists, knights, palisades, pyromancers, a frost witch, dwarf bombardiers with exploding barrels, clerics, a ballista, a thorn-rooting druid and a storm caller, each levelling to 10 with perks. The castle model is rebuilt from its upgrades, so you watch it grow: towers rise tier by tier, walls go from logs to banded stone, the keep sprouts turrets and the Keepfire beacon, which burns a whole lane when you call it. Ember motes and powerup orbs to tap, a relic choice after every wave (procedural names, affixes and canvas-drawn icons, eight slots), six biomes with day-to-night progression across each region's ten waves, six multi-phase bosses (Bramblejaw the Warg King, the Mire Mother, Warlord Skarn, the Rime Colossus, Morvane the Lich, Vael the Black Sun) and the endless Long Night. Every species is rolled per run from body plans (bipeds, quadrupeds, flyers, slimes, wraiths, siege engines) with names, palettes, features and elite affixes. Failing a wave keeps its gold for a retry, and Rekindling trades the run for Embers on a permanent Ember Tree. Generative medieval music; portrait phones get a camera behind the castle with the lanes running up the screen. [game-056/dev/](game-056/dev/README.md) balances the 60-wave campaign with a bot headlessly and drives every flow in Chromium on desktop and touch-only phones.

**[Hivebreaker](game-057/)** — A **twin-stick shooter** in the spirit of Enter the Gungeon and Alien Breed, in three.js with no asset files. A black-site base under the ice of Erebus has gone silent with the President's daughter inside, and one Colonial Marine goes down through five procedurally generated sectors to get her out. Rooms seal behind you while the bug-like Brood pours out of the vents in waves and swarms of hundreds (ten bug types, glowing alphas, one instanced draw call per type with legs and wings animated in the vertex shader). Dodge-roll through bullet patterns, grenade the crowds, erase bullets with the Shock Pulse, and carry four of nine guns upgraded to Mk III. Five multi-phase bosses, a field upgrade after each, a supply depot, data logs and radio chatter tell the story, and the campaign ends in a timed escape with Ellie at your side. A procedural deck-plate and hive-creep floor shader, a baked lightmap, a shadowed flashlight, GPU particles, noise fireballs, bloom and chromatic aberration; a generative synth score; Horde Mode; keyboard and mouse, gamepad, or touch twin-sticks in portrait and landscape. [game-057/dev/](game-057/dev/README.md) plays the whole campaign headlessly with a perfect bot and a fallible one, and drives every flow in Chromium on desktop and touch-only phones.

**[Bumble Basket](game-058/)** — A **cosy fruit-picking puzzle** with a matching rule of its own, in three.js with no asset files. Drag a bumblebee along a trail across a picnic blanket. Each fruit you hop to only has to share one trait with the last (kind, colour, size or family), so trails wander like a word ladder instead of needing identical pieces. The bee learns those traits as **senses**, one per garden: a Set level at the end of each garden teaches the next, as more kinds, colours and sizes of fruit arrive. Matching fruit pours into a jar for each sense, and a full set earns a power-up (Honey Dipper, Paint Pollen, Buzz Bomb, Rainbow Wings). Trails of seven grow golden fruit that links to anything, and leaf piles and frost get in the way. Thirty levels in four gardens, an endless Picnic mode and an 81-stamp Fruit Album. Sixteen kinds of fruit with faces that blink and beam, all modelled in code, plus generative ukulele-style music. Touch or mouse, portrait or landscape. [game-058/dev/](game-058/dev/README.md) checks the rules headlessly, gates every level on bot win rates, and drives the game in Chromium on desktop and touch-only phones.

See each game's own README/folder for full details, or browse the descriptions live in the [launcher](index.html).

## Getting Started

### Playing the Games

1. Open [index.html](index.html) in your web browser (serve the folder over HTTP: the garden uses ES modules)
2. Click **Enter the Garden**, walk up from the dock and wander the paths, or open the 📚 Library for a searchable list
3. Click a statue (tap, then **Play**, on phones) to open its game in a new tab
4. Prefer a plain list? [classic.html](classic.html) is the original card launcher

### Running Locally

Simply open the `index.html` file in any modern web browser:

```bash
# Using Python's built-in server (Python 3)
python -m http.server 8000

# Or using Python 2
python -m SimpleHTTPServer 8000

# Then open http://localhost:8000 in your browser
```

### Playing Individual Games

You can also play any game directly by opening its own `index.html` file, e.g. `game-001/index.html` for Space Shooter. See the [table above](#games-included) for the full list of 58 games and their folders.

## Building Desktop Versions

This project includes GemCore/GemShell configuration files for building standalone desktop applications.

### Configuration Files
Each game includes a `gemcore.config.json` file for customizing the build:
- Window size and settings
- Application name and icon
- Platform targets (Windows, Mac, Linux)
- Build optimizations

### Building
Refer to the GemCore documentation for build instructions.

## Developer Documentation

The [docs/](docs/) directory contains reference material for AI-assisted development:

- **[docs/kaplay/](docs/kaplay/)** — Kaplay v4000 API reference and patterns
- **[docs/phaser/](docs/phaser/)** — Phaser 4.0.0 full API reference
- **[docs/threejs/](docs/threejs/)** — three.js r165 patterns (import map, render loop, bloom, gotchas)
- **[docs/generic/](docs/generic/)** — Cross-game learnings, sound design patterns, and game ideas

- **[docs/refresh-plan.md](docs/refresh-plan.md)** — the conventions the later games share, an audit of games 001–036 against them, what was fixed, and a ranked backlog
- **[dev/](dev/README.md)** — `dev/smoketest.mjs` loads every game in Chromium on desktop and on a touch-only phone and fails on console errors, failed requests, a broken back link, or a layout that doesn't fit; `NOSTORAGE=1` also checks that games survive blocked `localStorage`. Many games also have their own `game-NNN/dev/` harness.

When building or modifying games, consult these docs for framework APIs, confirmed working patterns, and architectural guidance. **When you learn something reusable, fold it back into the matching doc** — see [docs/README.md](docs/README.md) for the full index and the "Maintaining these docs" guide on what to write and where.

## Project Structure

```
web-games-andrew/
├── index.html              # 3D garden launcher (three.js)
├── classic.html            # The original card-grid launcher
├── garden/                 # Garden launcher code (js/, css/, dev/browsertest.mjs)
├── css/                    # Shared stylesheets
├── js/                     # Shared JavaScript modules
│   ├── main.js
│   └── gamedata.js         # Metadata for every game (drives both launchers)
├── lib/
│   ├── kaplay/              # Shared Kaplay engine (kaplay.mjs / kaplay.js)
│   ├── phaser/phaser-4.0.0/ # Shared Phaser 4 engine (ESM build)
│   └── page-audio.js        # Silences a game's audio while its tab is hidden (games 001–036)
├── dev/                    # Repo-wide smoke test (dev/smoketest.mjs)
├── docs/                   # Framework API references and cross-game learnings
├── reference/              # Standalone reference snippets (e.g. rpg.js)
├── dist/                   # Packaged build output (e.g. game-019 desktop build)
├── game-001/ … game-058/   # One self-contained folder per game
│   ├── index.html
│   ├── js/ (or similarly organized modular game code)
│   └── gemcore.config.json # Optional desktop-build config
├── CHANGELOG.md            # Version history
├── status.md               # Snapshot of current project status
├── LICENSE                 # MIT License
└── README.md               # This file
```

Note: three.js is not vendored — three.js-based games (e.g. game-014, game-018, game-024, game-025, game-026, game-029, game-040, game-045, game-046, game-047, game-049, game-050, game-051) load it from a CDN via an import map in their `index.html`.

## Technologies Used

- **HTML5 Canvas** - For game graphics and rendering
- **JavaScript** - Game logic and interactivity
- **CSS3** - Styling and responsive design
- **Kaplay Framework (v4000 alpha)** - Game development framework (most games from game-002 onward, including game-032)
- **Phaser 4.0.0 (ESM)** - Game framework (game-019, game-020, game-027, game-028, game-035)
- **three.js (r165)** - 3D/WebGL framework, loaded via CDN import map (game-014, game-018, game-024, game-025, game-026, game-029, game-040, game-045, game-046, game-047, game-049, game-050, game-051)
- **Vanilla JS (no library)** - Hand-crafted DOM + Canvas engine (game-007, game-033, game-034, game-037, game-038, game-039, game-048)
- **Custom software 3D** - Hand-written 3D renderers with no engine: a palette-indexed framebuffer (game-031) and a triangle rasterizer on Canvas2D (game-036)
- **GemCore/GemShell** - Desktop application packaging

## Attributions

### Game Assets

- **Wall Tiles** - Pixel texture pack by [jestan](https://jestan.itch.io/pixel-texture-pack)
  - Support the creator: [Ko-fi](https://ko-fi.com/jestan)

## Browser Compatibility

These games work best on modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Contributing

Feel free to fork this project and add your own games! Follow the existing structure:
1. Create a new `game-###` folder
2. Include an `index.html` file with your game
3. Add a `manifest.json` with game metadata
4. Add an entry (with a `genre`) to `js/gamedata.js`; both launchers pick it up, and the garden gives it a statue

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed version history.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Version

See [CHANGELOG.md](CHANGELOG.md) for the current version — 58 games are included as of the latest entries (game-055 Rotorstorm, game-056 Keepfire, game-057 Hivebreaker, game-058 Bumble Basket).

---

Made with ❤️ by Andrew Wooldridge
