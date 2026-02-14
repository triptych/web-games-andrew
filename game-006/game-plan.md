# Game 006: Wolfenstein-like Raycasting FPS

## Genre Definition
A classic first-person shooter using raycasting technology to create a 3D perspective from a 2D grid-based map, inspired by Wolfenstein 3D. Built with Kaplay for modern web browsers.

## Core Concept
Players navigate through maze-like levels from a first-person perspective, fighting enemies, collecting items, and finding the exit. The raycasting engine creates the illusion of 3D by calculating wall heights and distances, while keeping the underlying game logic in 2D.

---

## Phase 1: Raycasting Engine Foundation

### Raycasting Basics
- **DDA Algorithm** (Digital Differential Analysis)
  - Cast rays from player position for each vertical screen column
  - Calculate intersections with grid walls
  - Determine wall distance and height for perspective
  - Handle both horizontal and vertical wall hits

- **Camera System**
  - Player position (x, y coordinates on 2D grid)
  - Player direction vector (facing angle)
  - Camera plane (FOV perpendicular to direction)
  - Field of view: 60-90 degrees (adjustable)

- **Wall Rendering**
  - Calculate wall slice height based on distance
  - Draw vertical strips for each ray
  - Apply simple shading (darker = farther)
  - Maintain 60 FPS performance target

### Map System
- **Grid-Based Map**
  - 2D array representing the level (0 = empty, 1+ = wall types)
  - Multiple wall types for visual variety
  - Minimum map size: 16x16
  - Maximum map size: 64x64

- **Collision Detection**
  - Grid-based collision for player movement
  - Simple circle/box collision for player vs walls
  - Sliding along walls (not stopping dead)

### Player Movement
- **Basic Controls**
  - W/S or Up/Down: Move forward/backward
  - A/D: Strafe left/right
  - Left/Right Arrows or Mouse: Rotate camera
  - Shift: Sprint (1.5x speed)
  - Space: Action/Open doors

- **Movement Mechanics**
  - Smooth acceleration and deceleration
  - Movement speed: 3-5 units per second
  - Sprint speed: 5-7.5 units per second
  - Rotation speed: 120 degrees per second
  - Mouse sensitivity: Adjustable

### Visual Design
- **Color Palette**
  - Stone walls: Grays and browns
  - Different wall types: Varied colors/patterns
  - Floor: Darker shade (constant color initially)
  - Ceiling: Lighter shade (constant color initially)
  - Distance fog: Optional fade to black

- **Rendering Layers**
  - Background (floor/ceiling)
  - Walls (raycasted 3D)
  - Sprites (enemies, items, decorations)
  - HUD overlay
  - Minimap (optional)

---

## Phase 2: Weapons & Combat System

### Weapon System
- **Base Weapons**
  - **Pistol**
    - Starting weapon, infinite ammo
    - Moderate damage (15-25 HP)
    - Fast fire rate (3 shots/second)
    - Medium range (8 units)

  - **Machine Gun**
    - High fire rate (8 shots/second)
    - Lower damage per shot (10-15 HP)
    - Uses ammo (clip: 50, max: 200)
    - Medium range (10 units)

  - **Shotgun**
    - High damage (40-60 HP close, 15-30 far)
    - Slow fire rate (1 shot/1.5 seconds)
    - Spread pattern (3-5 rays)
    - Short-medium range (6 units effective)

  - **Rocket Launcher**
    - Massive damage (80-100 HP + splash)
    - Very slow fire rate (1 shot/2.5 seconds)
    - Splash damage radius (2 units)
    - Long range (15 units)

### Weapon Mechanics
- **Firing System**
  - Mouse click or Ctrl to shoot
  - Hitscan weapons (instant hit)
  - Projectile weapons (rockets)
  - Muzzle flash effect
  - Screen shake on fire

- **Ammo Management**
  - Pistol: Infinite ammo
  - Other weapons: Limited ammo
  - Ammo pickups scattered in levels
  - Ammo types: Bullets, shells, rockets

- **Weapon Switching**
  - Number keys 1-4 to select weapons
  - Mouse wheel to cycle
  - Auto-switch on pickup (optional)
  - Weapon switch animation (0.3 seconds)

### Combat Feedback
- **Visual Feedback**
  - Bullet impact sprites on walls
  - Blood splatter on enemy hit
  - Damage numbers (optional)
  - Screen flash on player damage (red tint)

- **Audio Feedback**
  - Weapon firing sounds (Web Audio API)
  - Enemy hit sounds
  - Enemy death sounds
  - Player hurt sounds
  - Shell casing sounds

---

## Phase 3: Enemy System & AI

### Enemy Types
- **Guard (Basic)**
  - HP: 50
  - Damage: 5-10 per shot
  - Speed: Slow (2 units/sec)
  - Range: 8 units
  - Fire rate: 1 shot/second
  - Behavior: Patrol → Alert → Chase → Attack

- **Officer (Medium)**
  - HP: 75
  - Damage: 10-15 per shot
  - Speed: Medium (3 units/sec)
  - Range: 10 units
  - Fire rate: 1.5 shots/second
  - Behavior: More aggressive pursuit

- **SS Trooper (Hard)**
  - HP: 100
  - Damage: 15-25 per shot
  - Speed: Fast (4 units/sec)
  - Range: 12 units
  - Fire rate: 2 shots/second
  - Behavior: Flanking and aggressive

- **Dog (Fast Melee)**
  - HP: 30
  - Damage: 15-20 per bite
  - Speed: Very fast (5 units/sec)
  - Range: Melee only (0.5 units)
  - Behavior: Rush player on sight

- **Boss Enemy**
  - HP: 500-1000
  - Damage: 25-50 per shot
  - Speed: Slow (2 units/sec)
  - Special: Multiple attack patterns
  - Behavior: Phase-based combat

### AI Behaviors
- **Patrol State**
  - Walk between waypoints
  - Turn at corners
  - Check for player in FOV (60 degrees, 10 units)
  - Alert if player spotted or hears gunfire

- **Alert State**
  - Investigate last known player position
  - Play alert sound
  - Transition to chase if player found
  - Return to patrol after timeout (5 seconds)

- **Chase State**
  - Pathfinding toward player using A* or simple line-of-sight
  - Try to maintain line of sight
  - Enter attack state when in range
  - Lost player → return to alert/patrol

- **Attack State**
  - Stop moving
  - Face player
  - Fire weapon with accuracy variance
  - Strafe occasionally
  - Chase if player escapes range

### Pathfinding
- **Simple Pathfinding**
  - A* algorithm for optimal paths
  - Pre-computed navigation graph
  - Dynamic obstacle avoidance
  - Wall sliding for enemies

- **Enemy Spawning**
  - Pre-placed enemies in map
  - Spawn points marked in map data
  - Optional reinforcement spawns
  - Maximum active enemies: 20

---

## Phase 4: Advanced Rendering

### Texture Mapping
- **Wall Textures**
  - Apply repeating patterns to walls
  - Calculate texture coordinates per ray
  - Support multiple wall textures (4-8 types)
  - Generated procedurally or simple patterns

- **Texture Implementation**
  - Store textures as arrays or canvas patterns
  - UV mapping for correct perspective
  - Texture filtering: Nearest neighbor (for retro look)

### Sprite Rendering
- **Billboard Sprites**
  - Always face the camera
  - Scale based on distance
  - Z-sorting (draw far to near)
  - Clip sprites behind walls

- **Sprite Types**
  - Enemies (animated)
  - Items (static or bobbing)
  - Decorations (pillars, lights, barrels)
  - Projectiles (rockets, fireballs)

- **Sprite Animation**
  - Multiple frames per sprite
  - Directional sprites (8 directions for enemies)
  - Idle, walk, attack, death animations
  - Frame timing: 100-150ms per frame

### Floor & Ceiling Rendering
- **Basic Mode** (Phase 1-3)
  - Solid colors for floor and ceiling
  - Simple and fast

- **Advanced Mode** (Phase 4+)
  - Textured floors and ceilings
  - Distance-based shading
  - Performance impact: Optional toggle

### Lighting Effects
- **Distance Shading**
  - Linear or exponential fog
  - Adjustable fog distance (8-16 units)
  - Darker = farther

- **Sector Lighting** (Optional)
  - Different light levels per area
  - Flashlight mechanic
  - Flickering lights

---

## Phase 5: Level Design & Progression

### Map Format
- **2D Array Structure**
```javascript
const level1 = {
  width: 24,
  height: 24,
  playerStart: { x: 2, y: 2, angle: 0 },
  grid: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    // ... more rows
  ],
  enemies: [
    { type: 'guard', x: 5, y: 5, angle: 90 },
    // ... more enemies
  ],
  items: [
    { type: 'ammo_bullets', x: 8, y: 3 },
    // ... more items
  ],
  doors: [
    { x: 10, y: 5, vertical: true },
    // ... more doors
  ]
};
```

### Level Elements
- **Wall Types**
  - 0: Empty space
  - 1: Stone wall (gray)
  - 2: Brick wall (red)
  - 3: Wood wall (brown)
  - 4: Metal wall (silver)
  - 5: Door (special handling)

- **Doors**
  - Sliding doors (horizontal or vertical)
  - Open/close animation (0.5 seconds)
  - Triggered by player proximity or action key
  - Locked doors requiring keys

- **Secret Areas**
  - Pushable walls revealing hidden rooms
  - Bonus items and power-ups
  - Achievement tracking

### Collectibles
- **Health Items**
  - Small health (+10 HP, max 100)
  - Med kit (+25 HP)
  - Large health (+50 HP)

- **Ammo Pickups**
  - Bullet box (+20 bullets)
  - Shell box (+8 shells)
  - Rocket crate (+4 rockets)

- **Power-ups**
  - Armor vest (50% damage reduction)
  - Invincibility (10 seconds)
  - Quad damage (20 seconds)

- **Keys**
  - Gold key (yellow door)
  - Silver key (blue door)
  - Bronze key (red door)

### Level Progression
- **Level Structure**
  - 5-10 levels total
  - Increasing difficulty
  - Larger maps, more enemies
  - Boss fight on final level

- **Level Goals**
  - Find the exit door
  - Collect all treasures (optional)
  - Kill all enemies (optional)
  - Speed run times (leaderboard)

- **End Level**
  - Victory screen with stats
  - Time taken
  - Enemies killed
  - Secrets found
  - Accuracy percentage

---

## Phase 6: UI & Game Flow

### HUD Elements
- **Bottom HUD Bar**
  - Health indicator (0-100)
  - Ammo counter (current/max)
  - Current weapon icon
  - Armor indicator
  - Face portrait (changes with health)

- **Weapon Display**
  - Weapon sprite at bottom center
  - Firing animation
  - Reloading animation (if implemented)

- **Minimap** (Optional)
  - Top-right corner
  - Shows explored areas
  - Player position and direction
  - Enemy dots (if detected)
  - Toggle with M key

### Menu System
- **Main Menu**
  - New Game
  - Continue (if save exists)
  - Level Select (unlocked levels)
  - Settings
  - Credits

- **Pause Menu**
  - Resume
  - Restart Level
  - Settings
  - Quit to Main Menu

- **Settings**
  - Mouse sensitivity slider
  - Audio volume (master, SFX, music)
  - Render quality (high/low)
  - Controls remapping

### Game States
- **State Machine**
  - MainMenu
  - Loading
  - Playing
  - Paused
  - LevelComplete
  - GameOver

---

## Technical Implementation

### Technology Stack
- **Kaplay** - Game framework (from `../lib/kaplay/kaplay.mjs`)
- **ES6 Modules** - Modular JavaScript
- **Canvas Rendering** - 2D context for raycasting
- **Web Audio API** - Sound effects
- **LocalStorage** - Save data and settings

### Performance Optimization
- **Rendering**
  - Only render visible columns (screen width)
  - Draw order: Floor/ceiling → walls → sprites → HUD
  - Limit ray distance (max 20 units)
  - Sprite culling (don't render offscreen)

- **Game Logic**
  - Entity pooling for projectiles
  - Spatial grid for collision detection
  - LOD for distant enemies (reduce AI complexity)
  - Max 60 FPS with dt-based movement

### Project Structure
```
game-006/
├── index.html              # Entry point
├── lib/
│   └── kaplay/
│       └── kaplay.mjs      # Kaplay framework
├── js/
│   ├── main.js             # Initialization and game loop
│   ├── config.js           # Constants and settings
│   ├── raycaster.js        # Raycasting engine
│   ├── player.js           # Player movement and state
│   ├── weapons.js          # Weapon system
│   ├── enemies.js          # Enemy AI and behaviors
│   ├── renderer.js         # Wall, sprite, HUD rendering
│   ├── map.js              # Map data and collision
│   ├── items.js            # Collectibles and pickups
│   ├── sounds.js           # Web Audio API sound generation
│   ├── ui.js               # Menu and HUD systems
│   └── utils.js            # Helper functions
├── assets/
│   └── maps/
│       ├── level1.js       # Level 1 map data
│       ├── level2.js       # Level 2 map data
│       └── ...
└── game-plan.md            # This file
```

---

## Raycasting Technical Deep Dive

### Core Algorithm
```javascript
// Pseudo-code for raycasting
function castRays(player, map, screenWidth) {
  const rays = [];

  for (let x = 0; x < screenWidth; x++) {
    // Calculate ray direction
    const cameraX = 2 * x / screenWidth - 1; // x in camera space
    const rayDirX = player.dirX + player.planeX * cameraX;
    const rayDirY = player.dirY + player.planeY * cameraX;

    // DDA setup
    let mapX = Math.floor(player.x);
    let mapY = Math.floor(player.y);

    // Length of ray from current position to next x or y-side
    const deltaDistX = Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(1 / rayDirY);

    // Calculate step and initial sideDist
    let stepX, sideDistX;
    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (player.x - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - player.x) * deltaDistX;
    }

    let stepY, sideDistY;
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (player.y - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - player.y) * deltaDistY;
    }

    // DDA loop
    let hit = 0;
    let side; // 0 = x-side, 1 = y-side

    while (hit === 0) {
      // Jump to next map square
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      // Check if ray hit a wall
      if (map[mapY][mapX] > 0) hit = 1;
    }

    // Calculate distance to wall
    let perpWallDist;
    if (side === 0) {
      perpWallDist = (mapX - player.x + (1 - stepX) / 2) / rayDirX;
    } else {
      perpWallDist = (mapY - player.y + (1 - stepY) / 2) / rayDirY;
    }

    // Calculate wall height
    const lineHeight = Math.floor(screenHeight / perpWallDist);

    rays.push({
      wallType: map[mapY][mapX],
      distance: perpWallDist,
      height: lineHeight,
      side: side,
      column: x
    });
  }

  return rays;
}
```

### Sprite Rendering
```javascript
// Pseudo-code for sprite rendering
function renderSprites(player, sprites, rays) {
  // Calculate sprite distances and angles
  const spritesWithDist = sprites.map(sprite => {
    const dx = sprite.x - player.x;
    const dy = sprite.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return {
      ...sprite,
      distance: distance,
      dx: dx,
      dy: dy
    };
  });

  // Sort by distance (far to near)
  spritesWithDist.sort((a, b) => b.distance - a.distance);

  // Render each sprite
  for (const sprite of spritesWithDist) {
    // Transform sprite position to camera space
    const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
    const transformX = invDet * (player.dirY * sprite.dx - player.dirX * sprite.dy);
    const transformY = invDet * (-player.planeY * sprite.dx + player.planeX * sprite.dy);

    // Check if sprite is in front of camera
    if (transformY <= 0) continue;

    // Calculate screen position
    const spriteScreenX = Math.floor((screenWidth / 2) * (1 + transformX / transformY));

    // Calculate sprite dimensions
    const spriteHeight = Math.abs(Math.floor(screenHeight / transformY));
    const spriteWidth = Math.abs(Math.floor(screenHeight / transformY));

    // Check depth buffer (only draw if not behind wall)
    for (let x = startX; x < endX; x++) {
      if (transformY < rays[x].distance) {
        // Draw this column of the sprite
        drawSpriteColumn(sprite, x, spriteHeight);
      }
    }
  }
}
```

---

## Development Roadmap

### Phase 1: Raycasting Foundation (Week 1)
- [x] Project setup with Kaplay
- [ ] Implement basic raycasting engine
- [ ] Draw walls with distance shading
- [ ] Player movement (WASD)
- [ ] Camera rotation (arrows/mouse)
- [ ] Simple collision detection
- [ ] Create test map (16x16)
- [ ] Basic rendering optimization

### Phase 2: Weapons & Combat (Week 2)
- [ ] Weapon system architecture
- [ ] Implement pistol (hitscan)
- [ ] Add machine gun and shotgun
- [ ] Muzzle flash effects
- [ ] Ammo management
- [ ] Weapon switching
- [ ] Screen shake and hit feedback
- [ ] Web Audio sound effects

### Phase 3: Enemy AI (Week 3)
- [ ] Enemy sprite system
- [ ] Basic enemy (Guard) implementation
- [ ] AI state machine (patrol, alert, chase, attack)
- [ ] Enemy shooting and damage
- [ ] Enemy death animations
- [ ] Add 2-3 more enemy types
- [ ] Simple pathfinding
- [ ] Enemy spawning system

### Phase 4: Advanced Rendering (Week 2)
- [ ] Wall texture mapping
- [ ] Sprite rendering system
- [ ] Z-sorting for sprites
- [ ] Sprite animations (4-8 frames)
- [ ] Directional sprites for enemies
- [ ] Floor/ceiling textures (optional)
- [ ] Distance fog implementation

### Phase 5: Level Design (Week 1)
- [ ] Door system (sliding doors)
- [ ] Collectible items (health, ammo)
- [ ] Key and locked door system
- [ ] Create 3-5 levels
- [ ] Secret areas
- [ ] Level progression logic
- [ ] End-level stats screen

### Phase 6: Polish & UI (Week 1)
- [ ] HUD design and implementation
- [ ] Health/armor/ammo displays
- [ ] Weapon sprite display
- [ ] Main menu
- [ ] Pause menu
- [ ] Settings screen
- [ ] Minimap (optional)
- [ ] Game over and victory screens
- [ ] Save/load system

---

## Design Pillars

1. **Authentic Retro Feel**: Capture the essence of Wolfenstein 3D with modern improvements
2. **Smooth Performance**: Maintain 60 FPS with efficient raycasting
3. **Responsive Controls**: Tight, precise movement and shooting
4. **Clear Visuals**: Readable enemies and environment despite simple graphics
5. **Progressive Challenge**: Easy to learn, difficult to master

---

## Raycasting Resources

### Technical References
- [Lode's Raycasting Tutorial](https://lodev.org/cgtutor/raycasting.html) - Comprehensive guide
- [Ray-Casting Tutorial For Game Development](https://permadi.com/1996/05/ray-casting-tutorial-table-of-contents/)
- [Wolfenstein 3D Source Code](https://github.com/id-Software/wolf3d) - Original implementation
- [JavaScript Raycaster](https://github.com/hunterloftis/playfuljs-demos) - Modern JS example

### Game Design
- [Wolfenstein 3D Design Analysis](https://www.gamedeveloper.com/design/postmortem-id-software-s-wolfenstein-3d)
- [Classic FPS Level Design](https://www.gamedeveloper.com/design/the-level-design-of-doom)

---

## Success Metrics

- Raycaster renders at 60 FPS with 320x200 or 640x400 resolution
- Smooth player movement with no wall clipping
- Enemy AI responds intelligently to player
- Combat feels responsive and satisfying
- Level progression provides challenge curve
- Players complete first level in 3-5 minutes

---

## Next Steps

1. Set up project structure and Kaplay initialization
2. Implement basic raycaster with single wall color
3. Add player movement and rotation
4. Create test map and verify rendering
5. Begin iterative development following roadmap

**Let's build a classic FPS! 🎮**
