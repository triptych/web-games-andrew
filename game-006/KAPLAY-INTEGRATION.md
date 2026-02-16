# Kaplay Integration Improvements

## Overview
Refactored the raycasting engine to use Kaplay's architecture and drawing API, making it more integrated with Kaplay's component system and more similar to the official Kaplay raycasting example.

## Changes Made

### 1. Texture System ([textures.js](js/textures.js))
**NEW MODULE**
- Loads wall textures using Kaplay's sprite loading system
- Pre-slices textures into vertical strips for raycasting
- Uses Kaplay's `Quad` system for UV mapping
- Provides textured walls instead of solid colors

**How it works:**
```javascript
// Load sprite
k.loadSprite("wall", "sprites/brick_wall.png");

// Slice into vertical strips
for (let i = 0; i < width; i++) {
    const quad = new k.Quad(i / width, 0, 1 / width, 1);
    slices.push(sprite.frames[0].scale(quad));
}

// Render with UV mapping
k.drawUVQuad({
    tex: wallTexture,
    quad: slice,
    ...
});
```

### 2. Renderer ([renderer.js](js/renderer.js))
**COMPLETE REWRITE**
- Removed separate Canvas 2D API usage
- Now uses only Kaplay's drawing functions:
  - `k.drawRect()` for ceiling/floor/UI
  - `k.drawUVQuad()` for textured walls
  - `k.drawCircle()` for explosions/effects
  - `k.drawLine()` for spark effects
  - `k.drawText()` for weapon names
- Removed separate canvas element
- Uses `k.pushTransform()` / `k.popTransform()` for camera shake
- Better color handling with `k.rgb()`, `k.rgba()`, `k.BLACK.lerp(k.WHITE, brightness)`

**Benefits:**
- Cleaner API
- Better integration with Kaplay
- No canvas management overhead
- Consistent rendering pipeline

### 3. Player System ([player.js](js/player.js))
**ARCHITECTURAL CHANGE**
- Player is now a proper Kaplay game object created with `k.add()`
- Uses Kaplay components:
  - `k.pos()` for position
  - `k.rotate()` for angle
  - `k.z(-1)` for depth sorting  - `k.opacity(0)` to hide in 2D view
- Custom `draw()` function that renders the entire raycasting view
- Custom `update()` function to sync position

**Benefits:**
- Better integration with Kaplay's component system
- Player is a proper game entity
- Follows Kaplay architecture patterns
- Could easily add more components (health bar, sprite, etc.)

### 4. Raycaster ([raycaster.js](js/raycaster.js))
**ENHANCEMENT**
- Added hit coordinates (`hitX`, `hitY`) to ray data
- Added normal vectors (`normalX`, `normalY`) for lighting
- Required for proper texture UV mapping

### 5. Main ([main.js](js/main.js))
**SIMPLIFIED**
- Added texture initialization
- Removed manual `render()` call in `onDraw()`
- Player's `draw()` function now handles all rendering
- Cleaner separation of concerns

## Comparison with Kaplay Example

### What We Adopted:
✅ Sprite slicing for textures
✅ `drawUVQuad()` for textured rendering
✅ Player/camera as Kaplay game object with custom `draw()`
✅ Kaplay's drawing API throughout
✅ UV mapping with `Quad` system

### What's Different:
- Example uses ASCII grid, we use numeric tile map
- Example has simpler objects (bean sprite), we have weapons/projectiles/effects
- Example is a demo, ours is a full game with combat system

## Future Enhancements

### When you add more sprites:
1. Load them in `textures.js`:
   ```javascript
   k.loadSprite("enemy", "sprites/enemy.png");
   ```

2. Slice them if needed for billboarding:
   ```javascript
   for (let i = 0; i < enemySprite.width; i++) {
       enemySlices.push(...);
   }
   ```

3. Render with `drawUVQuad()` in the renderer

### Sprite-based Enemies (Phase 3):
When you add enemies, render them as billboards using the same technique as the example:
```javascript
// Transform enemy position to camera space
const transformX = invDet * (player.dirY * dx - player.dirX * dy);
const transformY = invDet * (-player.planeY * dx + player.planeX * dy);

// Calculate screen position
const screenX = (SCREEN_WIDTH / 2) * (1 + transformX / transformY);

// Render sprite slice
k.drawUVQuad({
    width: spriteWidth,
    height: spriteHeight,
    pos: k.vec2(screenX, screenY),
    tex: enemyTexture,
    quad: enemySlices[sliceIndex],
});
```

## Asset Requirements

### Current:
- `sprites/brick_wall.png` - Wall texture (16x16 or larger)

### Recommended to Add:
- `sprites/pistol.png` - Pistol weapon sprite
- `sprites/machinegun.png` - Machine gun sprite
- `sprites/shotgun.png` - Shotgun sprite
- `sprites/rocket.png` - Rocket launcher sprite
- `sprites/enemy.png` - Enemy sprite for Phase 3
- Additional wall textures for variety

## Performance Notes

- Texture slicing is done once on load, not per frame
- `drawUVQuad()` is efficient for vertical slice rendering
- Kaplay handles all canvas operations internally
- No significant performance difference from previous implementation
- Could actually be faster due to Kaplay's optimizations

## Testing

To test the changes:
1. Start server: `cd game-006 && python -m http.server 8080`
2. Open browser: `http://localhost:8080`
3. Check:
   - Walls should have brick texture
   - All weapons should work
   - Movement should be smooth
   - No console errors
   - Projectiles and effects render correctly

## Files Modified

- ✨ **NEW**: `js/textures.js`
- 🔄 **REWRITTEN**: `js/renderer.js`
- 🔄 **REWRITTEN**: `js/player.js`
- ✏️ **MODIFIED**: `js/raycaster.js`
- ✏️ **MODIFIED**: `js/main.js`

## Summary

The raycasting engine now follows Kaplay's architecture much more closely:
- Uses Kaplay's component system for the player
- Uses Kaplay's drawing API exclusively
- Supports textured walls with UV mapping
- Ready for sprite-based enemies when Phase 3 begins
- Cleaner, more maintainable code
- Better integration with Kaplay ecosystem
