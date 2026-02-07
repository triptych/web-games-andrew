# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
