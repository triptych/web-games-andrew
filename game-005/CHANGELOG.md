# Changelog - Game 005: Bullet Heaven Shmup

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Health pickup system with red pickups that heal 25 HP
- Wave completion UI notifications
- Wave counter display in HUD (top-right)
- Proper wave progression system that tracks kills
- 2-second break between waves
- Health pickup sound effect
- Event listener cleanup system for all modules

### Fixed
- **Critical:** Wave progress now properly updates on enemy kills
- **Critical:** Game state resets correctly when restarting (R key)
- **Critical:** Event listeners no longer accumulate on restart, fixing:
  - Multiple enemy deaths from single hit
  - Multiple pickups dropping from single enemy
  - Incorrect damage calculations
- Manual collision detection for improved reliability

### Changed
- Waves now require killing all enemies before advancing
- Wave difficulty scales: 30% more enemies per wave
- Spawn intervals decrease between waves
- Health pickups drop at 15% chance from enemies
- All modules now properly clean up on scene restart

### Technical
- Added `unsubscribeCallbacks` arrays in: waves.js, enemies.js, player.js, projectiles.js, ui.js
- Improved event catalog with `healthGained` event
- Better state management between game sessions
- Event listeners properly removed and re-added on restart

---

## [0.1.0] - 2026-02-13 - Initial Phase 1 Implementation

### Added
- Core game infrastructure with Kaplay framework
- EventBus system for cross-module communication
- Player entity with 8-directional movement (WASD/Arrow keys)
- Auto-shooting mechanic targeting nearest enemy
- Three enemy types: Charger (basic), Fast (speedy), Tank (tanky)
- Enemy spawning system with wave-based timing
- XP gem collection with magnetic attraction
- Level-up system with XP thresholds
- Player health system with invincibility frames
- Enemy HP bars
- HUD with health bar, XP bar, timer, and kill counter
- Game over screen with stats
- Restart functionality (R key)
- Web Audio API procedural sound effects:
  - Player shooting
  - Enemy hit/death
  - XP collection
  - Level up
  - Player hurt
  - Health pickup
- Splash screen with game start
- Manual collision detection for entities

### Technical
- ES6 module architecture
- Component-based entity system using Kaplay
- Prefab pattern for reusable game objects
- Global state management
- Event-driven architecture
- Zero-asset sound generation
- Proper TypeScript-style imports

### Game Configuration
- 3 enemy types with distinct stats
- Starting player HP: 100
- Player movement speed: 200
- Auto-fire rate: 0.5s
- Base damage: 10
- Initial wave: 5 enemies
- Spawn interval: starts at 2.0s, minimum 0.5s
