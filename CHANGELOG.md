# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **NetHack-Style Roguelike** (game-003): Classic dungeon crawler with procedural generation - Phase 1 Complete
  - Procedural dungeon generation using room-and-corridor algorithm
  - 8-directional player movement (Arrow keys, WASD, Q/E/Z/C for diagonals)
  - ASCII-style rendering on HTML5 canvas
  - Turn-based gameplay system
  - Camera following player with smooth scrolling
  - Message log with color-coded events
  - Status bar tracking HP, Level, Depth, and Turn count
  - Collision detection and wall boundaries
  - Modular ES6 architecture ready for expansion
  - Files: [game-003/index.html](game-003/index.html), [game-003/styles.css](game-003/styles.css), [game-003/js/](game-003/js/)

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
