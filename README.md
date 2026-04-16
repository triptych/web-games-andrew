# Web Games Collection

A collection of browser-based games built with HTML5, CSS3, and JavaScript. Play classic arcade games directly in your browser!

## Author

**Andrew Wooldridge**

## Games Included

### 1. Space Shooter
Classic arcade space shooter game where you control a spaceship to battle waves of enemies.

**Features:**
- Keyboard controls (Arrow keys for movement, Space bar to shoot)
- Progressive difficulty with enemy waves
- Score tracking
- Responsive canvas-based graphics

**Location:** [game-001/](game-001/)

### 2. Match-3 Puzzle
Strategic gem-matching puzzle game where you match three or more gems of the same color.

**Features:**
- 30 moves limit gameplay
- Color-coded gems with automatic match detection
- Score tracking system
- Built with Kaplay framework
- Smooth animations and visual effects

**Location:** [game-002/](game-002/)

### 3. NetHack Roguelike
Classic dungeon crawler with procedurally generated levels, turn-based combat, and ASCII graphics.

**Features:**
- **Procedural Dungeon Generation**: Infinite depth with room-and-corridor algorithm
- **Complete RPG Systems**: Combat, leveling, inventory, equipment, and magic
- **Multiple Enemy Types**: 5 monster types with unique stats and AI pathfinding
- **Item System**: Weapons, armor, potions, scrolls, and food with rarity levels
- **Magic & Ranged Combat**: Fireball spells and bow-based arrow shooting
- **Advanced Features**: Field of View (FOV), fog of war, multi-level dungeons
- **NPC System**: Talk to merchants, guards, wizards, hermits, and healers
- **Save/Load System**: Full game persistence with localStorage
- **8-Directional Movement**: Arrow keys, WASD, and diagonal controls
- Built with modular ES6 architecture

**Location:** [game-003/](game-003/)

### 19. Synthwave Breakout
Neon brick-breaker with synthwave aesthetics, escalating ball speed, powerups, and visual effects.

**Features:**
- Paddle controlled by mouse or arrow keys
- Ball speed escalates on every brick hit, capped at max
- 8 rows × 14 columns of bricks with HP tiers and neon row colors
- Combo multiplier resets on ball loss
- Powerup drops: wide paddle, slow ball, multiball, laser cannon
- Perspective grid background with horizon glow
- Tron-style light trail on the ball (28-point segmented glow ribbon)
- Screen shake on brick destruction, scaling with brick HP tier
- CRT / old colour TV raster overlay: rolling scanline band, chromatic fringing, vignette, flicker
- Built with Phaser 4.0.0 (ESM) and modular ES6 architecture

**Location:** [game-019/](game-019/)

### 20. The River
Narrative RPG / roguelite — sail down the river on your last adventure, gathering companions and ingredients for a feast at the dark lord's tower.

**Features:**
- 10-stop river journey with seeded encounter queue (different every run)
- 12 companion archetypes (common / uncommon / rare) each contributing unique skills: cooking, decorating, music, stories, wisdom, strength
- 8 ingredient types across cooking and decorating categories
- Incompatible companion pairs — some travelers clash, reducing your dinner score
- 7 river event types including foraging stops that grant bonus ingredients
- Dinner evaluation: weighted score yields six outcomes from Catastrophe to Legendary Feast
- Tower news broadcasts hinting at the lord's preferences mid-journey, order tied to run seed
- 3-layer scrolling water parallax animation
- Procedural ambient drone music (Web Audio API)
- Built with Phaser 4.0.0 (ESM) and modular ES6 architecture

**Location:** [game-020/](game-020/)

---

### 4. Tower Defense
Strategic tower defense game with 5 unique tower types, 5 enemy varieties, 20 progressive waves, and complete sound system.

**Features:**
- **5 Unique Tower Types**:
  - Archer: Fast attacks, medium range (balanced starter tower)
  - Cannon: Slow, powerful splash damage with explosions
  - Mage: Magic attacks that slow enemies
  - Tesla: Chain lightning hitting multiple enemies
  - Sniper: Long-range armor-piercing shots
- **5 Enemy Types with Unique Mechanics**:
  - Scout: Fast, low HP (basic enemy)
  - Soldier: Medium stats with armor
  - Tank: Heavily armored, requires anti-armor strategies
  - Speedster: Very fast, dodges through defenses
  - Boss: Massive HP and armor (appears every 5 waves)
- **Armor System**: Damage reduction mechanics with sniper armor pierce
- **20 Progressive Waves**: Escalating difficulty with mixed enemy compositions
- **Boss Waves**: Special encounters every 5 waves with warning banners
- **Wave Preview**: See upcoming enemy composition in HUD
- **Special Attack Patterns**: Splash damage, slow effects, chain lightning
- **Visual Effects**: Explosions, lightning bolts, slow indicators, impact flashes, boss banners
- **Complete Sound System**: Procedurally generated audio using Web Audio API
  - 10 unique sound effects for combat, waves, and UI interactions
  - In-game sound toggle button for audio control
  - Splash screen with animated start button
- **Strategic Gameplay**: Grid-based tower placement with range indicators
- **Resource Management**: Gold economy and life system
- **Hotkeys 1-5**: Quick tower selection
- Built with Kaplay framework and modular ES6 architecture

**Location:** [game-004/](game-004/)

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

You can also play games directly by opening their respective `index.html` files:
- Space Shooter: `game-001/index.html`
- Match-3 Puzzle: `game-002/index.html`
- NetHack Roguelike: `game-003/index.html`
- Tower Defense: `game-004/index.html`

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
- **[docs/generic/](docs/generic/)** — Cross-game learnings, sound design patterns, and game ideas

When building or modifying games, consult these docs for framework APIs, confirmed working patterns, and architectural guidance. See [docs/README.md](docs/README.md) for the full index.

## Project Structure

```
web-games-andrew/
├── index.html              # Game browser/launcher
├── css/                    # Shared stylesheets
├── js/                     # Shared JavaScript modules
│   ├── main.js
│   └── gamedata.js
├── game-001/              # Space Shooter
│   ├── index.html
│   ├── gemcore.config.json
│   └── manifest.json
├── game-002/              # Match-3 Puzzle
│   ├── index.html
│   ├── kaplay.js
│   ├── gemcore.config.json
│   └── manifest.json
├── game-003/              # NetHack Roguelike
│   ├── index.html
│   ├── styles.css
│   └── js/                # Modular game code
├── game-004/              # Tower Defense
│   ├── index.html
│   ├── game-plan.md
│   ├── js/                # Modular game code
│   └── lib/kaplay/        # Kaplay framework
├── CHANGELOG.md           # Version history
├── LICENSE                # MIT License
└── README.md              # This file
```

## Technologies Used

- **HTML5 Canvas** - For game graphics and rendering
- **JavaScript** - Game logic and interactivity
- **CSS3** - Styling and responsive design
- **Kaplay Framework** - Game development framework (games 002–018)
- **Phaser 4.0.0** - Game framework used for Synthwave Breakout (game-019)
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

**Current Version:** 3.0.0

---

Made with ❤️ by Andrew Wooldridge
