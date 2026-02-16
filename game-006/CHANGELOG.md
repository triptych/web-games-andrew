# Changelog - Game 006: Wolfenstein-like Raycasting FPS

## [Unreleased] - 2026-02-16

### Added
- **Enemies Left Counter** (`ui.js`)
  - Real-time display of remaining enemies on current floor
  - Color-coded: Red when enemies remain, Green when all defeated
  - Helps players track progress toward exit door spawn

- **Enemy Spawn Validation** (`enemies.js`, `items.js`)
  - Validates spawn positions are walkable before placing enemies/items
  - Prevents spawning inside walls
  - Detailed logging of successful vs failed spawns
  - Improved spawn success rate reporting

- **Enhanced Enemy Distribution** (`procgen.js`)
  - Guaranteed nearby enemies (50% spawn within 50 units of player)
  - Minimum 5 nearby enemies for immediate action
  - 30% bonus enemies in larger rooms
  - Reduced minimum spawn distance (3 units) for closer encounters

### Changed
- **Map Size Optimization** (`config.js`)
  - Reduced from 160x160 to 80x80 for better gameplay pacing
  - More manageable level sizes with better enemy-to-space ratio

- **View Distance** (`config.js`)
  - Increased MAX_RAY_DISTANCE from 20 to 100 units
  - Players can now see across almost entire map
  - Enemies visible from much farther away

- **Enemy Spawning** (`config.js`, `procgen.js`)
  - Increased BASE_ENEMY_COUNT: 6 → 15 (2.5x more enemies)
  - Increased ENEMY_SCALING: 3 → 5 per floor
  - Increased MAX_ENEMIES: 40 → 60
  - Nearby spawn threshold: 15 → 50 units (Manhattan distance)

- **Item Spawning** (`config.js`, `procgen.js`)
  - Increased ITEM_SPAWN_RATE: 20% → 65% per room
  - Multiple items per room (1-3 items via ITEMS_PER_ROOM_MAX)
  - 3x more health and ammo scattered throughout levels

### Fixed
- **Enemy Visibility Issue**
  - Diagnosed and fixed enemies spawning beyond view distance
  - Enemies now spawn within visible range
  - Immediate combat encounters guaranteed on floor start

- **Spawn Distribution**
  - Fixed enemies spawning too far from player on large maps
  - Improved room-based spawn distribution
  - Better spread across accessible areas

### Technical Details
- Debug logging added to renderer showing enemy render stats
  - Tracks enemies filtered by: distance, camera position, screen bounds, wall occlusion
  - Real-time distance calculations between player and enemies
- Manhattan distance used for spawn calculations (|dx| + |dy|)
- Spawn validation returns null on failure, preventing invalid entity creation

## Previous Update - 2025-02-15

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
