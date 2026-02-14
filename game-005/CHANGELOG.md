# Changelog - Game 005: Bullet Heaven Shmup

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed - Critical Bug Fixes (2026-02-14)
- **CRITICAL:** Fixed behavior component override bug that broke enemy functionality
  - Behavior components were replacing `onUpdate` instead of adding to it
  - This caused collision detection, HP bars, shadows, and boundaries to fail
  - Fixed all behavior functions (orbit, shoot, teleport, swarm) to add callbacks properly
- **Wave Tracking System Overhaul:**
  - Implemented tag-based tracking using `wave_1`, `wave_2` tags instead of counters
  - Bonus enemies (from splitters) now marked separately, don't interfere with wave completion
  - Off-screen enemy cleanup: automatically kills enemies >100 pixels beyond bounds
  - Wave completion now checks actual living enemies, not just counters
- **Spawn Rate Optimization:**
  - Reduced spawn interval from 2.0s to 0.8s to prevent empty screens
  - 5 enemies now spawn in 4 seconds instead of 10 seconds
- **Enemy Visibility Improvements:**
  - Swarm enemies increased from size 9 to 12 for better visibility
  - Changed to bright magenta color [255, 100, 255] with pink outline
  - Added bright white pulsing core with rapid animation

### Added - Phase 5: Upgrade System (2026-02-13)
- **Upgrade System**: Full progression system with 5 distinct upgrades
  - Power Shot: Increases damage by 25% per level
  - Rapid Fire: Increases fire rate by 20% per level
  - Swift Boots: Increases movement speed by 20% per level
  - Vitality Boost: Adds 20 max HP and heals 20 HP per level
  - Magnetism: Increases pickup attraction radius by 30% per level
- **Upgrade UI**: Interactive level-up screen with 3 random upgrade choices
  - Game pauses when player levels up
  - Beautiful upgrade cards with icons, names, descriptions, and level indicators
  - Hover effects and click selection
  - Smooth transition back to gameplay
- **Player Stat System**: Multiplier-based stat system for scaling
  - Damage, fire rate, move speed, max HP, and pickup radius
  - Stats persist across upgrades and apply dynamically
- **upgrades.js Module**: Centralized upgrade management system
  - Upgrade definitions with max levels (5 per upgrade)
  - Random upgrade selection algorithm
  - Upgrade tracking and application system
  - Event-driven architecture for level-up handling

### Added - RPG Classes & Advanced Enemies (2026-02-14)
- **Player Class System**: 3 distinct RPG archetypes with unique playstyles
  - Warrior: High HP (150), slow fire rate, powerful damage (15)
  - Ranger: Balanced stats, rapid fire (0.35s), high mobility (220 speed)
  - Mage: Glass cannon, low HP (70), highest damage (18)
  - Each class has unique colors, RPG stats (STR/DEX/INT/VIT), and visual design
- **Interactive Class Selection UI**: Beautiful card-based selection screen
  - Displays class stats, descriptions, and RPG attributes
  - Hover effects with dynamic glow
  - Smooth transitions between screens
- **8 Diverse Enemy Types** with unique behaviors:
  - Charger: Basic rush enemy (unlocked wave 1)
  - Fast: Speed demon (wave 1)
  - Swarm: Erratic movement, small (wave 1)
  - Tank: High HP, slow (wave 2)
  - Circler: Orbits around player (wave 3)
  - Shooter: Ranged attacks, keeps distance (wave 4)
  - Teleporter: Blinks around unpredictably (wave 6)
  - Splitter: Splits into 3 fast enemies on death (wave 8)
- **Component-Based Behavior System**:
  - Modular behavior components (orbit, shoot, teleport, swarm)
  - Reusable and composable AI patterns
  - Each behavior isolated in its own function
- **Visual Enemy Distinctions**:
  - Unique colors and shapes for each type
  - Special effects (teleporter fade, shooter barrel, splitter segments)
  - Distinct sizes and outlines
- **Weighted Spawn System**:
  - Progressive enemy unlocks create natural difficulty curve
  - Weighted probabilities prevent overwhelming compositions
  - Swarm common (12), Splitter rare (2)
- **Wave Number Tagging**:
  - Enemies tagged with wave number for accurate tracking
  - Splitter-spawned enemies marked as bonus (don't affect wave completion)

### Added - Health System & Bug Fixes (2026-02-13)
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
- XP collection now properly triggers level-up through upgrade system

### Changed
- Waves now require killing all enemies before advancing
- Wave difficulty scales: 30% more enemies per wave
- Spawn intervals decrease between waves
- Health pickups drop at 15% chance from enemies
- All modules now properly clean up on scene restart
- XP collection refactored to work with upgrade system (level-up logic moved to upgrades.js)
- Pickup radius now scales dynamically with Magnetism upgrade

### Technical
- Added `unsubscribeCallbacks` arrays in: waves.js, enemies.js, player.js, projectiles.js, ui.js, upgrades.js
- Improved event catalog with `healthGained` and `upgradeSelected` events
- Better state management between game sessions
- Event listeners properly removed and re-added on restart
- Integrated upgrade initialization into main game loop
- Extended state.js with upgrade tracking and player stat multipliers

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
