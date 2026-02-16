# Changelog - Game 006: Wolfenstein-like Raycasting FPS

## [Unreleased] - 2025-02-15

### Added
- **Items/Pickup System** (`js/items.js`)
  - Health pickups: Small (+10 HP), Medium (+25 HP), Large (+50 HP)
  - Ammo pickups: Bullets (+20), Shells (+8), Rockets (+4)
  - Bobbing animation for all pickups
  - Automatic pickup detection with sound effects
  - Visual glint/highlight effect on items

- **Splash Screen/Menu** (`js/menu.js`)
  - Complete help screen with controls guide
  - Movement, combat, weapons, and pickups information
  - Pulsing "CLICK ANYWHERE TO START" prompt
  - Scene-aware click handlers to prevent gameplay interference

- **Item Spawning Configuration** (`config.js`)
  - 10 strategically placed items in test map
  - 4 health pickups of varying sizes
  - 6 ammo pickups (2 each for bullets, shells, rockets)
  - Items placed to encourage exploration

- **Item Rendering** (`renderer.js`)
  - 3D billboard sprites for items
  - Proper depth sorting with enemies and walls
  - Spherical appearance with highlight effect
  - Bobbing animation synced with item state

- **Sound Effects** (`sounds.js`)
  - Health pickup sound (700Hz)
  - Ammo pickup sound (600Hz)

- **Debug Logging** (`enemies.js`)
  - Player position logging on damage for debugging

### Fixed
- **Critical Bug**: Menu click handlers persisting into game scene
  - Added scene name checks to prevent menu handlers from triggering during gameplay
  - Fixed issue where shooting would restart the game scene

- **Texture Loading**: Fixed textures not loading when transitioning from menu to game
  - Added texture reuse when already loaded
  - Added immediate processing fallback for cached sprites
  - Added comprehensive debug logging for texture loading

### Changed
- Main game now starts with splash screen instead of jumping directly to gameplay
- Items system integrated into main game loop with update cycle
- Shotgun and rocket launcher now have pickups available (started with 0 ammo)

### Technical Details
- Items use billboard sprite rendering with depth buffer checks
- Menu handlers now check `k.getSceneName()` before executing
- Texture loading uses both `onLoad` callback and immediate processing with timeout fallback
- All pickups stored in global state for renderer access

## Previous Releases

### Phase 3 Complete - Enemy System
- Full AI system with patrol, alert, chase, and attack states
- 5 enemy types with varying behaviors
- Line of sight and pathfinding
- Combat with player damage

### Phase 2 Complete - Weapons & Combat
- 4 weapons: Pistol, Machine Gun, Shotgun, Rocket Launcher
- Hitscan and projectile weapons
- Muzzle flash and screen shake
- Ammo management

### Phase 1 Complete - Raycasting Engine
- DDA raycasting algorithm
- Textured walls with distance shading
- Player movement and rotation
- Collision detection
