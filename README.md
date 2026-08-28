# Web Games Collection

A collection of browser-based games built with HTML5, CSS3, and JavaScript. Play classic arcade games directly in your browser!

## Author

**Andrew Wooldridge**

## Games Included

31 games, `game-001` through `game-031`, each self-contained with its own `index.html`. Full metadata (title, description, tags) lives in [js/gamedata.js](js/gamedata.js), which drives the launcher at [index.html](index.html).

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

You can also play any game directly by opening its own `index.html` file, e.g. `game-001/index.html` for Space Shooter. See the [table above](#games-included) for the full list of 31 games and their folders.

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
│   └── gamedata.js         # Metadata for all 31 games (drives the launcher)
├── lib/
│   ├── kaplay/              # Shared Kaplay engine (kaplay.mjs / kaplay.js)
│   └── phaser/phaser-4.0.0/ # Shared Phaser 4 engine (ESM build)
├── docs/                   # Framework API references and cross-game learnings
├── game-001/ … game-031/   # One self-contained folder per game
│   ├── index.html
│   ├── js/ (or similarly organized modular game code)
│   └── gemcore.config.json # Optional desktop-build config
├── CHANGELOG.md            # Version history
├── LICENSE                 # MIT License
└── README.md               # This file
```

Note: three.js is not vendored — three.js-based games (e.g. game-024, game-025, game-026, game-029) load it from a CDN via an import map in their `index.html`.

## Technologies Used

- **HTML5 Canvas** - For game graphics and rendering
- **JavaScript** - Game logic and interactivity
- **CSS3** - Styling and responsive design
- **Kaplay Framework** - Game development framework (most games from game-002 onward)
- **Phaser 4.0.0 (ESM)** - Game framework (game-019, game-020, game-027, game-028)
- **three.js (r165)** - 3D/WebGL framework, loaded via CDN import map (game-014, game-018, game-024, game-025, game-026, game-029)
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

See [CHANGELOG.md](CHANGELOG.md) for the current version — 31 games are included as of the latest entry (game-031, Grimhold Abyss).

---

Made with ❤️ by Andrew Wooldridge
