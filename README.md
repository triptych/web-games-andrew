# Web Games Collection

A collection of browser-based games built with HTML5, CSS3, and JavaScript. Play classic arcade games directly in your browser!

## Author

**Andrew Wooldridge**

## Games Included

43 games, `game-001` through `game-043`, each self-contained with its own `index.html`. Full metadata (title, description, tags) lives in [js/gamedata.js](js/gamedata.js), which drives the launcher at [index.html](index.html).

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
| 022 | [Depths Unknown](game-022/) | Motherload-style mining | Kaplay |
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

### Highlights

**[Space Shooter](game-001/)** — Classic arcade space shooter. Arrow keys to move, space bar to shoot, progressive enemy waves.

**[NetHack Roguelike](game-003/)** — Procedurally generated infinite-depth dungeons, full RPG systems (combat, leveling, inventory, magic), FOV/fog of war, NPCs, and save/load — all in modular ES6.

**[Tower Defense](game-004/)** — 5 tower types (Archer, Cannon, Mage, Tesla, Sniper) with splash damage, slows, and chain lightning vs. 5 enemy types across 20 escalating waves, including boss waves every 5th wave. Full procedural sound system via Web Audio API.

**[Bullet Heaven](game-005/)** — Survivors-style bullet heaven with 3 RPG classes, 8 enemy types with distinct AI (orbiting, teleporting, splitting), auto-shoot, XP, and level-up upgrades.

**[Chronicles of the Ember Crown](game-009/)** — Final Fantasy-style turn-based RPG. Four-hero party through 12 battles, MP, status effects, leveling, and a Lich King boss fight.

**[Synthwave Breakout](game-019/)** — Neon brick-breaker: escalating ball speed, 8×14 bricks with HP tiers, 4 powerups, Tron-style light trail, CRT scanline overlay. Built in Phaser 4.

**[The River](game-020/)** — Narrative roguelite: a 10-stop seeded river journey gathering companions and ingredients for a feast, with tower hints, companion synergies/clashes, and procedural ambient music.

**[Neon Vanguard](game-024/)** — Top-down shmup in three.js with custom shaders, real bloom post-processing, choreographed enemy movement patterns, and a glowing animated grid floor.

**[Grimhold Abyss](game-031/)** — Retro first-person dungeon crawler in the style of early-90s DOS shareware, rendered by a **from-scratch software 3D engine**: a 320×200 palette-indexed framebuffer, perspective-correct textured walls, dithered EGA shading, and billboard sprites — no WebGL, no 3D library. Every floor is procedurally generated with zero asset files; all textures, sprites, and sounds are generated at runtime.

**[Ironhollow Depths](game-032/)** — 80's-style top-down 8-bit dungeon crawler in the vein of classic CRT-era action-RPGs. Guide a pixel-art knight through torch-lit brick dungeons, hack down slimes, grab gold, and survive escalating depths under a chunky retro status-bar HUD.

**[Hearthbound](game-033/)** — Cozy fantasy visual novel built on a **hand-crafted vanilla JS engine** (no game library) — DOM for the story layer, canvas for battles. Inherit a rundown countryside apothecary and spend a season running it: brew remedies to order for your neighbours, forage, trade with a travelling peddler, and work out why the wood at the edge of the village has gone so quiet since your aunt died. About an hour of story across 195 branching nodes and 13 endings, with inventory, equippable trinkets and charms, leveling, a quest journal, and affinity-gated branches that decide who walks into the dark with you.

**[Idle Delve](game-034/)** — Idle/incremental dungeon crawler, **fully vanilla JS with zero image assets** — a raw Canvas 2D renderer draws every room, hero, and monster as procedural shapes. A party auto-battles room by room through a procedurally generated dungeon, even while the tab is closed (offline catch-up simulation on reload); bank the gold to recruit heroes and buy permanent stat/gold-find/deeper-floor upgrades in the Town panel between runs.

**[Island Walker](game-036/)** — First-person walking simulator on a wholly procedural island, rendered by a **3D engine written from scratch — no three.js, no WebGL**: JavaScript transforms, culls, lights and depth-sorts every triangle into a 2D canvas. Terrain, trees, streams, a sea cave, clouds and buildings all generate from one seed, so every reload is a new island. Wander the forest, lighthouse point, cemetery, garden and ancient ruins to recover 10 lost books and 8 artifacts, then carry them home — the Library's shelves and the Museum's pedestals visibly fill with everything you return. No enemies, no fail state. Engine notes and gotchas in [docs/software3d/](docs/software3d/software3d-api.md).

**[Lanternwake](game-037/)** — Turn-based roguelike / Zelda-like fusion about a lantern-keeper walking a country where the lights have been going out. **Vanilla JS with no dependencies, no build step and no asset files whatsoever** — every sprite is drawn in code from declarative recipes, every sound is synthesised, and the whole 1536×1536 world is a pure function of one seed string. The overworld persists and remembers what you did to it; the Hollows underneath re-knit themselves on every descent, generated mission-first (a graph of keys, locks, puzzles and a boss, embedded into one of five layout algorithms). People come before quests: needs are generated from who somebody is, and a quest whose object cannot be resolved to a real thing is discarded rather than faked. You cannot die — you wake, and lose the light you had and the hours you had left. Design decisions and deviations from the spec are in [game-037/DECISIONS.md](game-037/DECISIONS.md); the test harness runs with no tooling at [game-037/test/harness.html](game-037/test/harness.html).

**[Emberbrood](game-038/)** — An 8-bit **procedurally generated dragon battler**: fight them, bind them, raise them, breed them. Battles are Final Fantasy-shaped (a party of three, turn order by speed, MP, eleven statuses, an eight-element chart with real ×4 and ×0.25 matchups, a shared Ember Surge meter), but every wild fight can also end in a capture, and the odds are shown before you commit. Every dragon in the game — including the ones you hatch — comes out of a genome that decides its stats, skills, temperament **and its 32×32 sprite**, so a dragon you bred visibly resembles its parents, and each generation is measurably better than the last. Grey, nameless "ashbound" dragons can be cleansed mid-battle and get their real names back. 87 items, a forge, roost dungeons, 18 main quests across five acts, generated notice-board work, and three endings gated on what your brood can actually prove. **Vanilla HTML/CSS/JS, no libraries, no build step and no asset files at all** — every sprite is drawn in code, every sound synthesised, and the whole country grows from one seed. Design doc in [game-038/GDD.md](game-038/GDD.md); the test harness runs with no tooling at [game-038/test/harness.html](game-038/test/harness.html).

**[Burrowguard](game-041/)** — An **8-bit arcade fusion of a digging game, a tower defence and a maze chase**, where the three genres are one system rather than three modes. Monsters walk in off the surface and head for a crystal core at the bottom of the dig site, and they walk *only through tunnels* — tunnels you dig. The round starts with a pre-dug, pellet-filled maze (the maze chase), every cell of dirt you carve pays gold (the digging game), and gold buys towers you build into the dirt beside their route (the tower defence). The catch is that your tunnels are their maze: dig a shortcut between two corridors and the whole horde takes it. So good play is digging dead ends — to harvest ore, to reach the four power gems, and to get under the boulders — without ever connecting two parts of their route. Up close you fight it out by hand: a harpoon pumps monsters until they pop, boulders you undermine fall and crush whatever is beneath, and a power gem turns every monster blue so you can chase them down for 200-400-800-1600. Five enemy types each break a different rule — drakes breathe fire through dirt, stalkers hunt *you* and phase through solid ground as a pair of eyes, borers drill brand-new shortcuts to the core — plus a crowned king every sixth wave. **Vanilla JS and a hand-written WebGL renderer**: one sprite batcher, a sharp-bilinear filter so 16px pixel art stays crisp at any scale, neon vector-style tunnel edges, and a bloom + scanline post pass; every sprite, glyph and sound is generated in code. Built for a phone first (relative thumbstick, a PUMP button, a build tray, ≥44px targets, portrait and landscape layouts); the pure simulation and the phone layout are verified by the harnesses in [game-041/dev/](game-041/dev/README.md).

**[Popgun Pip](game-042/)** — A **light-hearted 8-bit platformer that crosses Mario-shaped worlds with Metroid-style unlocks**, and the collection's first proper platformer. Pip hops, stomps and pops (a cork popgun, aimable up and diagonally) across five islands of four levels and a castle each, all **procedurally generated from one save seed**: ? blocks and bricks, pipes with chompers, springs, lifts over pits, firebars, crushers and lava, twelve enemy types (shell-kicking snails, swooping bats, slimes that split, clouds that rain on you) and five multi-phase bosses. Each boss hands back one of Grandma's stolen gadgets — Spring Boots, a Frost Ray that turns enemies and bubble blocks into ice you can stand on, Sticky Mitts for wall-jumping, a Rocket Popper that blasts red rock — and **every level is generated with pockets you can see but can't reach yet** (high shelves, bubble stairs, tall shafts, sealed vaults, basements under cracked floors) holding Sun Shards, heart containers, a Spread Shot and power chips, so each new gadget reopens the map. The generator's promise is checked, not assumed: `js/validate.js` runs the **real player physics** from every standable cell with a set of input programs and a BFS, proving each level's route is beatable with the moves that world assumes and that every gate needs exactly its gadget (verified over 250 generated levels). Graphics are NES-palette pixel art — hand-drawn character strings plus procedurally generated tiles and parallax backdrops — rendered into a canvas whose backing store is the game's own pixel buffer, scaled by a whole number of device pixels. Music comes from a small chiptune composer (pulse channels via `PeriodicWave`, triangle bass, noise drums) that writes every level its own AABA song. Plays on a phone as a handheld in portrait or with floating controls in landscape, and on keyboard or gamepad; see [game-042/GDD.md](game-042/GDD.md) and [game-042/dev/](game-042/dev/README.md).

**[Glimmerglen](game-043/)** — A **cozy village builder crossed with a Zelda-style adventure**: Stardew Valley's days, seasons, crops, animals, foraging, mining, cooking and shipping bin, wrapped around an overworld of five regions whose dungeons each hold a Heart Shard and the relic that opens the next region's gate. You inherit an overgrown glen, a split and leafless Heartwood tree and a Mayor with a village of one. Rebuild the Job Board and **travellers of twelve trades apply to live there**; each needs a home-and-shop that fits their job (a Forge, a Café, a Watchtower…) on a lot you clear yourself, and **every villager contributes** — daily goods in the Storehouse, a shop or refining station, a passive boost, a three-chapter personal story, a companion who fights beside you, and hands for job-board postings you can **assign to them** instead of doing yourself. Coziness levels the village, which breaks the dungeon seals; returning shards grows the Heartwood and wakes the land's **faded magic** — shrines, fairy rings, moonwells, heart acorns and caches that are invisible (just a shimmer) until then. **Turn-based battles** show every monster's next move (guard the 💢 wind-ups) with elements, skills, items and companions. **Everything is generated from one seed** chosen in the character creator: the land and its regions and names, roads and secret pockets, dungeon and cave floors, monster species, villagers' faces, personalities and stories, the job board, the weather, every pixel-art sprite and a seeded AABA composer's music for each place. Three save slots plus autosave and save-file export/import. Phone-first (floating joystick, smart A button, pixel-perfect scaling); Node harnesses play the whole main quest with a bot and prove every region opens exactly when it should across 80 seeds. See [game-043/GDD.md](game-043/GDD.md) and [game-043/dev/](game-043/dev/README.md).

**[Starcadet](game-040/)** — A **vertical bullet-hell shmup in three.js built around a rescue mechanic**, with a story attached to the scoreboard. The Chorus takes Halcyon Flight Academy mid-examination, the instructors die in the first ninety seconds, and the only thing left flying is a *trainer*: practice cannons and a tow hook rated for towing target drones. Two hundred and eleven of your classmates are in escape pods. **Shooting is how you survive, hooking pods is how you win** — pods drift down, enemies shoot them, and one that falls past you is gone for the rest of the run, so the safe lane at the bottom of the screen is exactly where the cadets aren't. Six levels, each with its own animated shader backdrop and palette; 14 enemy archetypes that each own a shooting pattern from a 12-pattern emitter library (aimed, fan, ring, spiral, whip, wall-with-a-gap, rain, homing, telegraphed laser, hanging nova, flower, cluster); four weapons at five power levels; flares with a death-bomb window; graze-fed Overdrive; and six multi-phase bosses — a battleship whose four destructible turrets each remove an attack from its cycle, your own flight instructor using the drills he taught you, and a finale that literally opens one safe lane per named classmate you brought back. Five rescued cadets each give a permanent ship ability, so the story and the build progression are the same system, and the headcount at the end decides which of four endings you get. Built for a phone as much as a desktop: **relative** touch dragging (the ship moves by your thumb's travel instead of teleporting to it, so your hand never covers what you are dodging), a two-corner control layout, forced auto-fire on touch, and quality tiers that step down automatically if the frame rate will not hold. Real bloom, instanced bullet rendering (200+ live bullets in one draw call), and **no asset files at all** — every ship, bullet, starfield, explosion, comms portrait and sound is generated in code. The simulation is a pure module that imports neither three.js nor the DOM, which is what let the Node harnesses in [game-040/dev/](game-040/dev/README.md) play whole levels, whole boss fights and a full six-level campaign with no browser.

**[Wakeform](game-039/)** — An **Atari-2600-shaped arcade game built on one original mechanic**, and the whole game is in that mechanic: you have no weapon. Your probe can do exactly one thing — invert its own polarity — and as you fly it continuously sheds **echoes**, frozen copies of itself holding whatever polarity you had at that instant. The echoes are not a trail and not a wall; each one exerts the same force you do, so like-polarity motes are shoved away and opposite ones are drawn in and absorbed. You defend the reactor core by *drawing a working machine out of your own movement history* — lay a stroke to steer motes, funnel them into a knot of opposite echoes that holds them orbiting, then fly in and harvest the cluster in one enormous chain. Every echo and every flip costs flux, and flying back through your own past reclaims it, so good play is a loop: build, harvest, reclaim, rebuild. Five mote classes each attack a different weakness in a lattice (the leech eats echoes you abandoned; the anchor ignores force entirely and has to be fetched by hand). **Vanilla HTML/CSS/JS, no libraries and no asset files** — a 160×192 internal buffer scaled nearest-neighbour, an 8-colour palette sampled from the real 2600 NTSC ramp, sprites and playfield generated per run seed, all audio synthesised. Difficulty was tuned against scripted bots rather than guesswork; the Node harnesses that verified it without a browser are in [game-039/dev/](game-039/dev/README.md).

See each game's own README/folder for full details, or browse the descriptions live in the [launcher](index.html).

## Getting Started

### Playing the Games

1. Open [index.html](index.html) in your web browser
2. Browse the game collection
3. Click "Play Now" on any game to launch it in a modal player
4. Use ESC key or click the close button to return to the game browser

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

You can also play any game directly by opening its own `index.html` file, e.g. `game-001/index.html` for Space Shooter. See the [table above](#games-included) for the full list of 40 games and their folders.

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

When building or modifying games, consult these docs for framework APIs, confirmed working patterns, and architectural guidance. **When you learn something reusable, fold it back into the matching doc** — see [docs/README.md](docs/README.md) for the full index and the "Maintaining these docs" guide on what to write and where.

## Project Structure

```
web-games-andrew/
├── index.html              # Game browser/launcher
├── css/                    # Shared stylesheets
├── js/                     # Shared JavaScript modules
│   ├── main.js
│   └── gamedata.js         # Metadata for all 40 games (drives the launcher)
├── lib/
│   ├── kaplay/              # Shared Kaplay engine (kaplay.mjs / kaplay.js)
│   └── phaser/phaser-4.0.0/ # Shared Phaser 4 engine (ESM build)
├── docs/                   # Framework API references and cross-game learnings
├── reference/              # Standalone reference snippets (e.g. rpg.js)
├── dist/                   # Packaged build output (e.g. game-019 desktop build)
├── game-001/ … game-043/   # One self-contained folder per game
│   ├── index.html
│   ├── js/ (or similarly organized modular game code)
│   └── gemcore.config.json # Optional desktop-build config
├── CHANGELOG.md            # Version history
├── status.md               # Snapshot of current project status
├── LICENSE                 # MIT License
└── README.md               # This file
```

Note: three.js is not vendored — three.js-based games (e.g. game-014, game-018, game-024, game-025, game-026, game-029) load it from a CDN via an import map in their `index.html`.

## Technologies Used

- **HTML5 Canvas** - For game graphics and rendering
- **JavaScript** - Game logic and interactivity
- **CSS3** - Styling and responsive design
- **Kaplay Framework (v4000 alpha)** - Game development framework (most games from game-002 onward, including game-032)
- **Phaser 4.0.0 (ESM)** - Game framework (game-019, game-020, game-027, game-028, game-035)
- **three.js (r165)** - 3D/WebGL framework, loaded via CDN import map (game-014, game-018, game-024, game-025, game-026, game-029, game-040)
- **Vanilla JS (no library)** - Hand-crafted DOM + Canvas engine (game-007, game-033, game-034, game-037, game-038, game-039)
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
4. Update the main `index.html` to include your game card

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed version history.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Version

See [CHANGELOG.md](CHANGELOG.md) for the current version — 43 games are included as of the latest entries (game-040 Starcadet, game-041 Burrowguard, game-042 Popgun Pip, game-043 Glimmerglen).

---

Made with ❤️ by Andrew Wooldridge
