# Phaser 4.0.0 API Documentation

**Version:** 4.0.0
**Source:** https://docs.phaser.io/api-documentation/api-documentation

---

## Table of Contents

- [Core](#core)
- [Animation System](#animation-system)
- [Cache Management](#cache-management)
- [Camera System](#camera-system)
- [Curves](#curves)
- [Data Management](#data-management)
- [Display](#display)
- [DOM](#dom)
- [Events](#events)
- [Filters](#filters)
- [Game Objects](#game-objects)
- [Geometry](#geometry)
- [Input System](#input-system)
- [Loader](#loader)
- [Math](#math)
- [Physics - Arcade](#physics---arcade)
- [Physics - Matter](#physics---matter)
- [Plugins](#plugins)
- [Renderer - Canvas](#renderer---canvas)
- [Renderer - WebGL](#renderer---webgl)
- [Scale Management](#scale-management)
- [Scenes](#scenes)
- [Sound](#sound)
- [Structures](#structures)
- [Textures](#textures)
- [Tilemaps](#tilemaps)
- [Time](#time)
- [Tweens](#tweens)

---

## Core

- `Phaser.Game` — Main game entry point; instantiate with a config object
- `Phaser.Core.Config` — Game configuration (renderer, physics, scenes, scale, etc.)
- `Phaser.Core.TimeStep` — Controls the main game loop and delta time

---

## Animation System

- `Phaser.Animations.Animation` — A single animation definition (frames, frame rate, repeat)
- `Phaser.Animations.AnimationFrame` — A single frame within an animation
- `Phaser.Animations.AnimationManager` — Global manager; create/get/remove animations
- `Phaser.Animations.AnimationState` — Per-sprite animation state tracker

---

## Cache Management

- `Phaser.Cache.BaseCache` — Generic key/value cache store
- `Phaser.Cache.CacheManager` — Central manager for all asset caches (images, audio, JSON, etc.)

---

## Camera System

### Scene2D Cameras
- `Phaser.Cameras.Scene2D.BaseCamera` — Base class for cameras
- `Phaser.Cameras.Scene2D.Camera` — Full camera with lerp, bounds, zoom, rotation
- `Phaser.Cameras.Scene2D.CameraManager` — Manages multiple cameras per scene

### Camera Effects
- `Phaser.Cameras.Scene2D.Effects.Fade` — Fade in/out effect
- `Phaser.Cameras.Scene2D.Effects.Flash` — Flash effect
- `Phaser.Cameras.Scene2D.Effects.Pan` — Pan to a target point
- `Phaser.Cameras.Scene2D.Effects.RotateTo` — Rotate to an angle
- `Phaser.Cameras.Scene2D.Effects.Shake` — Shake effect
- `Phaser.Cameras.Scene2D.Effects.Zoom` — Zoom to a value

### Camera Controls
- `Phaser.Cameras.Controls.FixedKeyControl` — Move camera with fixed speed keys
- `Phaser.Cameras.Controls.SmoothedKeyControl` — Move camera with acceleration/drag

---

## Curves

- `Phaser.Curves.CubicBezier` — Cubic bezier curve
- `Phaser.Curves.Curve` — Base curve class
- `Phaser.Curves.Ellipse` — Elliptical arc curve
- `Phaser.Curves.Line` — Straight line curve
- `Phaser.Curves.MoveTo` — Move-to point (non-drawing segment)
- `Phaser.Curves.Path` — A compound path made of multiple curves
- `Phaser.Curves.QuadraticBezier` — Quadratic bezier curve
- `Phaser.Curves.Spline` — Catmull-Rom spline through control points

---

## Data Management

- `Phaser.Data.DataManager` — Key/value store on game objects; emits change events
- `Phaser.Data.DataManagerPlugin` — Scene plugin that attaches a DataManager to each scene

---

## Display

- `Phaser.Display.Color` — Color class with RGB/HSL/hex conversions and manipulation
- `Phaser.Display.ColorBand` — A gradient band between two colors
- `Phaser.Display.ColorMatrix` — 5x4 matrix for color transformations
- `Phaser.Display.ColorRamp` — Multi-stop color ramp
- `Phaser.Display.RGB` — Simple RGB container
- `Phaser.Display.BaseShader` — Base class for GLSL shader definitions
- `Phaser.Display.Masks.GeometryMask` — Mask using a Graphics object

---

## DOM

- `Phaser.DOM.RequestAnimationFrame` — rAF/setTimeout polyfill used by the game loop

---

## Events

- `Phaser.Events.EventEmitter` — Base event emitter (on, off, once, emit); all Phaser objects extend this

---

## Filters

A library of 24+ post-processing filter effects (WebGL only):

| Filter | Description |
|--------|-------------|
| `Phaser.Filters.Barrel` | Barrel distortion |
| `Phaser.Filters.Blend` | Blend mode filter |
| `Phaser.Filters.Blocky` | Pixel-block effect |
| `Phaser.Filters.Blur` | Gaussian blur |
| `Phaser.Filters.Bokeh` | Depth-of-field bokeh |
| `Phaser.Filters.ColorMatrix` | Color matrix transform |
| `Phaser.Filters.CombineColorMatrix` | Chained color matrix |
| `Phaser.Filters.Controller` | Base filter controller |
| `Phaser.Filters.Displacement` | Displacement map distortion |
| `Phaser.Filters.Glow` | Glow/bloom effect |
| `Phaser.Filters.GradientMap` | Map luminance to a gradient |
| `Phaser.Filters.ImageLight` | Image-based lighting |
| `Phaser.Filters.Key` | Chroma key (green screen) |
| `Phaser.Filters.Mask` | Apply a texture mask |
| `Phaser.Filters.NormalTools` | Normal map utilities |
| `Phaser.Filters.PanoramaBlur` | Radial panorama blur |
| `Phaser.Filters.ParallelFilters` | Apply multiple filters in parallel |
| `Phaser.Filters.Pixelate` | Pixelate effect |
| `Phaser.Filters.Quantize` | Color quantization |
| `Phaser.Filters.Sampler` | Generic texture sampler |
| `Phaser.Filters.Shadow` | Drop shadow |
| `Phaser.Filters.Threshold` | Luminance threshold |
| `Phaser.Filters.Vignette` | Darkened edge vignette |
| `Phaser.Filters.Wipe` | Wipe transition |

---

## Game Objects

### Core Infrastructure
- `Phaser.GameObjects.GameObject` — Base class for all game objects
- `Phaser.GameObjects.GameObjectFactory` — `scene.add.*` factory methods
- `Phaser.GameObjects.GameObjectCreator` — `scene.make.*` creator methods
- `Phaser.GameObjects.DisplayList` — Ordered list of renderable objects in a scene
- `Phaser.GameObjects.UpdateList` — List of objects receiving update ticks
- `Phaser.GameObjects.Group` — Logical group for managing sets of game objects
- `Phaser.GameObjects.Layer` — A sub-display list for grouping rendering order
- `Phaser.GameObjects.Container` — Spatial container; children transform relative to parent

### Renderable Objects
- `Phaser.GameObjects.Image` — Static texture (no animation)
- `Phaser.GameObjects.Sprite` — Texture with animation support
- `Phaser.GameObjects.SpriteGPULayer` — GPU-instanced sprite layer for high-count sprites
- `Phaser.GameObjects.Text` — Canvas-rendered text
- `Phaser.GameObjects.BitmapText` — Bitmap font text
- `Phaser.GameObjects.DynamicBitmapText` — BitmapText with per-character callbacks
- `Phaser.GameObjects.TextStyle` — Text style configuration
- `Phaser.GameObjects.TileSprite` — Scrolling/repeating texture
- `Phaser.GameObjects.RenderTexture` — Off-screen render target you can draw to
- `Phaser.GameObjects.Graphics` — Immediate-mode vector drawing (lines, shapes, fills)
- `Phaser.GameObjects.Shader` — GLSL shader as a game object
- `Phaser.GameObjects.Video` — HTML5 video element as a game object
- `Phaser.GameObjects.DOMElement` — HTML element positioned in game space
- `Phaser.GameObjects.NineSlice` — Scale-aware 9-slice/3-slice image
- `Phaser.GameObjects.Rope` — Mesh strip along a set of points
- `Phaser.GameObjects.PathFollower` — Sprite that follows a `Phaser.Curves.Path`
- `Phaser.GameObjects.Blitter` / `Bob` — High-performance static image renderer
- `Phaser.GameObjects.CaptureFrame` — Single captured WebGL frame
- `Phaser.GameObjects.Stamp` — Stamp texture onto a RenderTexture
- `Phaser.GameObjects.Gradient` — Gradient-filled rectangle
- `Phaser.GameObjects.Extern` — Hook for custom external renderers
- `Phaser.GameObjects.Zone` — Invisible hit area / input zone
- `Phaser.GameObjects.PointLight` — Dynamic point light source
- `Phaser.GameObjects.Light` / `LightsManager` / `LightsPlugin` — Normal-map lighting system

### Shapes
- `Phaser.GameObjects.Shape` — Base shape class
- `Phaser.GameObjects.Arc` — Arc / circle shape
- `Phaser.GameObjects.Curve` — Drawn curve shape
- `Phaser.GameObjects.Ellipse` — Ellipse shape
- `Phaser.GameObjects.Grid` — Grid pattern shape
- `Phaser.GameObjects.IsoBox` — Isometric box
- `Phaser.GameObjects.IsoTriangle` — Isometric triangle
- `Phaser.GameObjects.Line` — Line shape
- `Phaser.GameObjects.Polygon` — Polygon shape
- `Phaser.GameObjects.Rectangle` — Rectangle shape
- `Phaser.GameObjects.Star` — Star shape
- `Phaser.GameObjects.Triangle` — Triangle shape

### Particles
- `Phaser.GameObjects.Particles.ParticleEmitter` — Main particle emitter; configure via config object
- `Phaser.GameObjects.Particles.Particle` — Individual particle instance
- `Phaser.GameObjects.Particles.EmitterOp` — Animated numeric property on emitter
- `Phaser.GameObjects.Particles.EmitterColorOp` — Animated color property
- `Phaser.GameObjects.Particles.GravityWell` — Attractor/repulsor for particles
- `Phaser.GameObjects.Particles.ParticleBounds` — Bounding box for particle reflection
- `Phaser.GameObjects.Particles.ParticleProcessor` — Custom particle processing hook
- `Phaser.GameObjects.Particles.Zones.DeathZone` — Kill particles entering/leaving a zone
- `Phaser.GameObjects.Particles.Zones.EdgeZone` — Emit from shape edges
- `Phaser.GameObjects.Particles.Zones.RandomZone` — Emit from random points in a shape

### Components
- `Phaser.GameObjects.Components.FilterList` — Per-object filter list
- `Phaser.GameObjects.Components.TransformMatrix` — 2D affine transform matrix

### Noise
- `Phaser.GameObjects.Noise` — Noise generator base
- `Phaser.GameObjects.NoiseCell2D/3D/4D` — Cellular noise variants
- `Phaser.GameObjects.NoiseSimplex2D/3D` — Simplex noise variants

---

## Geometry

Pure math geometry objects (no rendering):

- `Phaser.Geom.Circle` — Circle with contains, intersection helpers
- `Phaser.Geom.Ellipse` — Ellipse geometry
- `Phaser.Geom.Line` — Line segment with midpoint, angle, length helpers
- `Phaser.Geom.Polygon` — Polygon with contains check
- `Phaser.Geom.Rectangle` — Rectangle with inflate, contains, intersection
- `Phaser.Geom.Triangle` — Triangle with contains, centroid helpers

---

## Input System

- `Phaser.Input.InputManager` — Global input manager
- `Phaser.Input.InputPlugin` — Per-scene input (`scene.input`)
- `Phaser.Input.Pointer` — Mouse/touch pointer with position, buttons, velocity

### Keyboard
- `Phaser.Input.Keyboard.KeyboardManager` — Global keyboard manager
- `Phaser.Input.Keyboard.KeyboardPlugin` — Per-scene keyboard (`scene.input.keyboard`)
- `Phaser.Input.Keyboard.Key` — Individual key state with isDown, isUp, duration
- `Phaser.Input.Keyboard.KeyCombo` — Multi-key combo detection

### Gamepad
- `Phaser.Input.Gamepad.GamepadPlugin` — Per-scene gamepad access
- `Phaser.Input.Gamepad.Gamepad` — Single gamepad device
- `Phaser.Input.Gamepad.Axis` — Analog stick axis
- `Phaser.Input.Gamepad.Button` — Gamepad button

### Mouse / Touch
- `Phaser.Input.Mouse.MouseManager` — Raw mouse event handling
- `Phaser.Input.Touch.TouchManager` — Raw touch event handling

---

## Loader

- `Phaser.Loader.LoaderPlugin` — Per-scene loader (`scene.load.*`)
- `Phaser.Loader.File` — Base file type
- `Phaser.Loader.MultiFile` — Multi-part file (e.g., atlas = image + JSON)

### File Types

| Method | File Type Class |
|--------|----------------|
| `load.image()` | `ImageFile` |
| `load.spritesheet()` | `SpriteSheetFile` |
| `load.atlas()` | `AtlasJSONFile` |
| `load.atlasXML()` | `AtlasXMLFile` |
| `load.unityAtlas()` | `UnityAtlasFile` |
| `load.multiatlas()` | `MultiAtlasFile` |
| `load.animation()` | `AnimationJSONFile` |
| `load.aseprite()` | `AsepriteFile` |
| `load.audio()` | `AudioFile` |
| `load.audioSprite()` | `AudioSpriteFile` |
| `load.html5Audio()` | `HTML5AudioFile` |
| `load.video()` | `VideoFile` |
| `load.bitmapFont()` | `BitmapFontFile` |
| `load.font()` | `FontFile` |
| `load.json()` | `JSONFile` |
| `load.xml()` | `XMLFile` |
| `load.text()` | `TextFile` |
| `load.binary()` | `BinaryFile` |
| `load.script()` | `ScriptFile` |
| `load.scripts()` | `MultiScriptFile` |
| `load.css()` | `CSSFile` |
| `load.glsl()` | `GLSLFile` |
| `load.html()` | `HTMLFile` |
| `load.htmlTexture()` | `HTMLTextureFile` |
| `load.svg()` | `SVGFile` |
| `load.tilemapCSV()` | `TilemapCSVFile` |
| `load.tilemapTiledJSON()` | `TilemapJSONFile` |
| `load.tilemapImpact()` | `TilemapImpactFile` |
| `load.plugin()` | `PluginFile` |
| `load.scenePlugin()` | `ScenePluginFile` |
| `load.scene()` | `SceneFile` |
| `load.pack()` | `PackFile` |
| `load.compressedTexture()` | `CompressedTextureFile` |
| `load.pctAtlas()` | `PCTAtlasFile` |

---

## Math

- `Phaser.Math.Vector2` — 2D vector with add, scale, dot, normalize, etc.
- `Phaser.Math.Vector3` — 3D vector
- `Phaser.Math.Vector4` — 4D vector
- `Phaser.Math.Matrix3` — 3x3 matrix
- `Phaser.Math.Matrix4` — 4x4 matrix (for 3D transforms)
- `Phaser.Math.Quaternion` — Quaternion for 3D rotation
- `Phaser.Math.Euler` — Euler angles
- `Phaser.Math.RandomDataGenerator` — Seeded random number generator

### Key Math Functions (on `Phaser.Math` namespace)
- `Clamp(value, min, max)`
- `Between(min, max)` — random integer
- `FloatBetween(min, max)` — random float
- `DegToRad(deg)` / `RadToDeg(rad)`
- `Distance.Between(x1, y1, x2, y2)`
- `Angle.Between(x1, y1, x2, y2)`
- `Lerp(v1, v2, t)`
- `Snap.To(value, gap)` / `Snap.Floor` / `Snap.Ceil`
- `Wrap(value, min, max)`

---

## Physics - Arcade

Simple AABB physics suitable for most 2D games.

- `Phaser.Physics.Arcade.ArcadePhysics` — Scene plugin (`scene.physics`)
- `Phaser.Physics.Arcade.World` — Physics world; gravity, bounds, step
- `Phaser.Physics.Arcade.Body` — Dynamic physics body
- `Phaser.Physics.Arcade.StaticBody` — Non-moving physics body
- `Phaser.Physics.Arcade.Sprite` — Sprite with a dynamic body
- `Phaser.Physics.Arcade.Image` — Image with a dynamic body
- `Phaser.Physics.Arcade.Group` — Group with physics bodies
- `Phaser.Physics.Arcade.StaticGroup` — Group with static bodies
- `Phaser.Physics.Arcade.Collider` — Collider/overlap pair
- `Phaser.Physics.Arcade.Factory` — Factory for arcade physics objects

### Key Methods
- `scene.physics.add.sprite(x, y, key)` — Physics sprite
- `scene.physics.add.collider(a, b, callback)` — Solid collision
- `scene.physics.add.overlap(a, b, callback)` — Overlap detection
- `body.setVelocity(x, y)` / `setVelocityX(v)` / `setVelocityY(v)`
- `body.setGravityY(value)`
- `body.setBounce(x, y)`
- `body.setCollideWorldBounds(true)`
- `body.setImmovable(true)` — for static-like dynamic bodies

---

## Physics - Matter

Full rigid-body physics via Matter.js integration.

- `Phaser.Physics.Matter.MatterPhysics` — Scene plugin (`scene.matter`)
- `Phaser.Physics.Matter.World` — Matter world; gravity, bounds, debug rendering
- `Phaser.Physics.Matter.Sprite` — Sprite with a Matter body
- `Phaser.Physics.Matter.Image` — Image with a Matter body
- `Phaser.Physics.Matter.TileBody` — Tilemap tile with a Matter body
- `Phaser.Physics.Matter.BodyBounds` — Utility to get body bounds
- `Phaser.Physics.Matter.Factory` — Factory for Matter objects
- `Phaser.Physics.Matter.PointerConstraint` — Drag objects with mouse/touch

---

## Plugins

- `Phaser.Plugins.BasePlugin` — Base class for global plugins
- `Phaser.Plugins.ScenePlugin` — Base class for per-scene plugins
- `Phaser.Plugins.PluginManager` — Manages plugin registration and lifecycle

---

## Renderer - Canvas

- `Phaser.Renderer.Canvas.CanvasRenderer` — Fallback 2D canvas renderer

---

## Renderer - WebGL

- `Phaser.Renderer.WebGL.WebGLRenderer` — Main WebGL renderer
- `Phaser.Renderer.WebGL.DrawingContext` — Encapsulates a WebGL drawing state
- `Phaser.Renderer.WebGL.DrawingContextPool` — Pool of drawing contexts
- `Phaser.Renderer.WebGL.ProgramManager` — Manages WebGL shader programs
- `Phaser.Renderer.WebGL.ShaderProgramFactory` — Creates shader programs

### WebGL Wrappers
Thin wrappers around raw WebGL objects: buffers, framebuffers, programs, shaders, textures.

### RenderNodes
Internal pipeline nodes for batching, filtering, submitting, and transforming draw calls. Generally not used directly.

---

## Scale Management

- `Phaser.Scale.ScaleManager` — Controls how the game canvas scales to fit the window

### Scale Modes
- `Phaser.Scale.NONE` — No scaling
- `Phaser.Scale.FIT` — Fit within bounds, preserve aspect ratio
- `Phaser.Scale.ENVELOP` — Fill bounds, preserve aspect ratio (may crop)
- `Phaser.Scale.WIDTH_CONTROLS_HEIGHT` — Width is fixed, height scales
- `Phaser.Scale.HEIGHT_CONTROLS_WIDTH` — Height is fixed, width scales
- `Phaser.Scale.RESIZE` — Canvas resizes to match parent

---

## Scenes

- `Phaser.Scene` — Base scene class; extend this for your scenes
- `Phaser.Scenes.SceneManager` — Manages all scenes (start, stop, sleep, wake, switch)
- `Phaser.Scenes.ScenePlugin` — Per-scene control (`scene.scene.*`)
- `Phaser.Scenes.Systems` — Scene system plugins collection

### Scene Lifecycle
```
init(data) → preload() → create(data) → update(time, delta)
```

### Scene Methods (via `scene.scene`)
- `start(key, data)` — Start a scene (stops current)
- `launch(key, data)` — Start a scene in parallel
- `stop(key)` — Stop a scene
- `sleep(key)` — Pause rendering/updating without destroy
- `wake(key, data)` — Resume a sleeping scene
- `switch(key)` — Sleep current, start target
- `pause()` / `resume()` — Pause/resume current scene
- `restart(data)` — Restart current scene

---

## Sound

- `Phaser.Sound.WebAudioSoundManager` — Web Audio API sound manager (default)
- `Phaser.Sound.HTML5AudioSoundManager` — HTML5 Audio fallback
- `Phaser.Sound.NoAudioSoundManager` — Silent fallback
- `Phaser.Sound.WebAudioSound` — A Web Audio sound instance
- `Phaser.Sound.HTML5AudioSound` — An HTML5 Audio sound instance
- `Phaser.Sound.BaseSound` — Base sound class
- `Phaser.Sound.BaseSoundManager` — Base sound manager

### Key Methods
- `scene.sound.add(key, config)` — Create a sound instance
- `scene.sound.play(key, config)` — Play immediately
- `sound.play()` / `sound.stop()` / `sound.pause()` / `sound.resume()`
- `sound.setVolume(v)` / `sound.setLoop(bool)` / `sound.setRate(r)`

---

## Structures

- `Phaser.Structs.List` — Ordered list with add/remove/get helpers
- `Phaser.Structs.Map` — Key/value map with iteration helpers
- `Phaser.Structs.ProcessQueue` — Queue with pending add/remove for safe mid-loop mutation
- `Phaser.Structs.RTree` — Spatial R-tree for fast region queries
- `Phaser.Structs.Size` — Width/height container with aspect ratio management

---

## Textures

- `Phaser.Textures.TextureManager` — Global texture store (`scene.textures`)
- `Phaser.Textures.Texture` — A texture (wraps one or more source images)
- `Phaser.Textures.TextureSource` — The underlying image/canvas/video source
- `Phaser.Textures.Frame` — A sub-region of a texture (sprite frame)
- `Phaser.Textures.CanvasTexture` — Texture backed by a canvas; paintable at runtime
- `Phaser.Textures.DynamicTexture` — WebGL render-target texture; draw game objects into it

---

## Tilemaps

- `Phaser.Tilemaps.Tilemap` — The main tilemap object (`scene.make.tilemap()`)
- `Phaser.Tilemaps.Tileset` — A tileset image with tile properties
- `Phaser.Tilemaps.TilemapLayer` — A rendered layer of tiles
- `Phaser.Tilemaps.TilemapGPULayer` — GPU-instanced tile layer for large maps
- `Phaser.Tilemaps.TilemapLayerBase` — Base for tilemap layer classes
- `Phaser.Tilemaps.Tile` — Individual tile with index, properties, physics
- `Phaser.Tilemaps.ImageCollection` — Collection of image objects from Tiled
- `Phaser.Tilemaps.ObjectHelper` — Helper for Tiled object layer data
- `Phaser.Tilemaps.MapData` — Raw map data structure
- `Phaser.Tilemaps.LayerData` — Raw layer data structure
- `Phaser.Tilemaps.ObjectLayer` — Object layer data from Tiled

### Key Methods
```javascript
const map = scene.make.tilemap({ key: 'map' });
const tiles = map.addTilesetImage('tileset', 'tilesetKey');
const layer = map.createLayer('LayerName', tiles, 0, 0);
layer.setCollisionByProperty({ collides: true });
scene.physics.add.collider(player, layer);
```

---

## Time

- `Phaser.Time.Clock` — Per-scene timer (`scene.time`)
- `Phaser.Time.TimerEvent` — A scheduled callback (delay, repeat, loop)
- `Phaser.Time.Timeline` — Sequence of timed events with a fluent API

### Key Methods
- `scene.time.addEvent({ delay, callback, callbackScope, repeat, loop })`
- `scene.time.delayedCall(delay, callback, args, scope)`
- `scene.time.removeAllEvents()`

---

## Tweens

- `Phaser.Tweens.TweenManager` — Per-scene tween manager (`scene.tweens`)
- `Phaser.Tweens.Tween` — A single tween animating one or more properties
- `Phaser.Tweens.TweenChain` — A sequence of tweens that play one after another
- `Phaser.Tweens.BaseTween` — Base class for tweens
- `Phaser.Tweens.TweenData` — Numeric property tween data
- `Phaser.Tweens.TweenFrameData` — Texture frame tween data
- `Phaser.Tweens.BaseTweenData` — Base tween data class

### Key Methods
```javascript
scene.tweens.add({
  targets: sprite,
  x: 400,
  alpha: 0,
  duration: 1000,
  ease: 'Power2',
  yoyo: true,
  repeat: -1,
  onComplete: () => {}
});

scene.tweens.chain({
  targets: sprite,
  tweens: [ { x: 100 }, { y: 200 } ]
});
```

### Common Easing Functions
`Linear`, `Quad.easeIn/Out/InOut`, `Cubic.easeIn/Out/InOut`, `Quart`, `Quint`, `Sine`, `Expo`, `Circ`, `Elastic`, `Back`, `Bounce`

---

## Notes

This documentation covers the Phaser 4.0.0 public API. Phaser 4 introduces:
- **GPU-instanced layers** (`SpriteGPULayer`, `TilemapGPULayer`) for high-performance rendering
- **Noise game objects** (Simplex/Cellular) built into the framework
- **Expanded filter library** (24+ post-processing effects)
- **RenderNode pipeline** for flexible WebGL batching
- **Timeline** for sequenced time events

Full interactive API reference: https://docs.phaser.io/api-documentation/api-documentation
