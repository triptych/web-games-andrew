# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
