# Pale Engine

**Genre:** First-person shooter (DOOM-style), with a story campaign and an endless mode
**Engine:** three.js r165 (ES modules via import map); everything else vanilla JS + DOM, no build step
**Target:** any screen size, desktop (mouse + keyboard) and phones/tablets (touch)
**Status:** Playable — v1.0.0

---

## Concept

Io, Jupiter's volcanic moon, 2291. The Hadal Consortium's deep-mantle station TARTARUS built a gravitational drill called the Pale Engine, and it didn't drill into the mantle. It drilled through the bottom of everything, into a place that has been hungry since before there were stars. You are a Warden — the people the Consortium sends when the lawyers have given up — and you're the only one of your fireteam left. The station AI, VESPER, is very glad to see you. It has reasons.

The game is a love letter to DOOM: fast movement, keycards and coloured doors, secret walls, exploding barrels, infighting monsters, a status bar with a face, an automap, intermission tallies with a par time. It plays to its own strengths too: every level, every monster species and every texture is generated in code, the lighting is baked into a lightmap and lit up live by every muzzle flash and rocket, and there's a story told through briefings, data logs and a voice in your ear.

What it borrows from earlier games in this repo:

- **game-031 Grimhold Abyss / game-006** — the raycaster-era FPS feel; this time on the GPU with real heights.
- **game-040 / game-049 / game-052** — debug hooks behind `?debug=1`, Playwright on desktop and touch-only phones, fail on any console error; relative touch dragging; quality tiers that move pixels, not features.
- **game-045 PINBREAK '86** — the post chain ending in `OutputPass`, half-res bloom, effects driven from gameplay events.
- **game-047 Ashes & Aces** — patching lighting into monster shaders (rim, hit flash, dissolve) and sharing uniform objects.

---

## Core systems

### 1. Levels (`js/level/gen.js`)

A level is a grid of 2 m cells, each with its own floor and ceiling height. That's all DOOM needed, and it's enough here: stairs, raised daises, lava pits, crates you can shoot over, balconies and open-air courtyards all fall out of per-cell heights.

1. Scatter rectangular rooms with a 3-cell margin (boss levels force one big room; the finale forces a 20×20 arena).
2. Minimum spanning tree over room centres; carve each edge with A*. Corridors may not touch any other room or corridor, so the room graph is *exactly* the tree.
3. Start = one end of the tree's diameter, exit = the other (or the big room on boss levels).
4. Lock 0–3 tree edges on the start→exit path (blue, yellow, red). Zones are the components after removing the locks; each key goes in the zone before its lock, preferring dead-end rooms off the main path.
5. Heights by walking the tree; each corridor turns its height difference into a staircase whose steps are ≤ 0.25 m, which is why corridor length limits how far a room can rise or fall.
6. Extra loop corridors, only within one zone, so loops never bypass a lock.
7. Room features — pillars, sunken liquid pits (sometimes bridged), two-tier daises, crates, raised platforms with stairs, open sky — each reverted if it cuts the room's entrances off from each other.
8. Secret closets behind fake walls (push into them or press Use).
9. Lights, monsters (a per-room budget from the level's roster and difficulty), ambushes (teleport in when you take the key, or when you first walk into the exit room), pickups, barrels, data terminals, decor.
10. **Validated by playing it:** flood fill from the start, collecting keys and opening the doors they unlock, until nothing changes. The exit, every key, every pickup and every terminal must be reached, or the next attempt seed is tried.

`dev/simtest.mjs` then walks a bot through every level with the real collision code.

### 2. Rendering (`js/render/`, `js/level/build.js`, `js/level/lightmap.js`)

- **Geometry:** one merged mesh per surface type (≈15 draw calls for a whole level), world-space UVs so textures run on across faces.
- **Textures:** about 40 painters that compute colour, height and emission per pixel on a periodic lattice (seamless). Tech panels with indicator lights, hazard stripes, rusted plate, lava with a cooling crust, flesh with glowing veins, bone brick with skulls, cracked hellstone, gold-veined marble, an EXIT sign in a 5×5 block font, terminals with scan lines.
- **World shader:** derivative bump mapping from the height channel; a baked lightmap sampled by world XZ (RGB light, A = ambient occlusion); a second lightmap for flickering lamps and glowing liquids, with a per-light phase; up to 8 dynamic point lights from the pool; specular sheen; animated liquids; fog.
- **Lightmap:** each light floods the grid with hard line-of-sight shadows, then a blur, a soft clip so stacked lights saturate instead of blowing out, and a dilation into the walls so sampling next to a wall never pulls in black.
- **Actor shader:** monsters, pickups and props — vertex colours, 3D-noise skin detail, the same lightmap and dynamic lights, rim light, hit flash, and a noise dissolve for deaths, summons and resurrections.
- **Sky:** one shader with four skies: Jupiter over black space, Io's sulphur haze with Jupiter huge and low, a red vortex with lightning, and the void with a pale ring.
- **Post:** world pass, viewmodel pass (depth cleared), half-res bloom, then a final pass for grade, vignette, damage and pickup flashes, chromatic-aberration kicks, low-health desaturation, heat shimmer, film grain, and the powerup looks: Berserk red, Overdrive purple, Aegis inverted (DOOM's invulnerability), Haste speed lines and radial smear, Cloak ripple, Hazard Suit green. `OutputPass` does ACES + sRGB last.
- **Effects:** additive and alpha particle clouds, camera-facing beams (tracers, the rail's spiral, lightning tethers, the Archon's beam), an instanced decal ring buffer (bullet holes, scorch, blood), instanced debris with floor bounces (gibs, shell casings), pooled flashes and shockwave rings.
- **Quality tiers:** High / Medium / Low move pixel ratio, render scale, bloom, dynamic light count and particle budget. Touch devices start on Medium; Auto drops a tier after three slow samples. Optional retro pixels.

### 3. Monsters (`js/game/species.js`, `models.js`, `monsters.js`, `bestiary.js`)

Ten archetypes plus three guardians and the Archon's pylons. Each run rolls a **species** for every archetype: a name ("Vexmaw", "Ulrakthul"…), a palette, proportions, horns, eye count, spikes, tails, tusks, armour plates, tentacle count, a synthesised voice, and small HP/speed variations. The model is a rig of bones; each bone's rigid parts are merged into one geometry with vertex colours and glow, so a monster costs 6–14 draw calls. Geometry is shared per species; materials are per instance.

| Archetype | Class | Behaviour |
|---|---|---|
| husk | Thrall | Hitscan rifle bursts |
| imp | Cinderling | Fireballs, claws |
| hound | Maw Hound | Lunges from range, bites |
| wisp | Wailing Skull | Flying, charges you |
| gazer | Gazer | Flying eye, plasma orbs |
| skitter | Skitterer | Spider turret, acid bursts |
| brute | Brute | Fans of bolts, ground slam |
| revenant | Revenant | Homing shoulder missiles |
| hierophant | Hierophant | Calls fire down on you; raises the dead |
| juggernaut | Juggernaut | Rocket volleys |
| overseer | Guardian (E1M3) | Rotary cannon bursts, rocket pods; speeds up at half health |
| mother | Guardian (E2M3) | Fireball fans, births cinderlings and skulls, jumpable shockwaves |
| archon | Final boss | Orb rings, homing missiles, a sweeping beam, summons; shields itself with Engine pylons at ⅔ and ⅓ health |

AI: idle until it sees you (in front, in range, line of sight; the cloak cuts sight range) or hears gunfire through open space and open doors. Then chase straight at you with line of sight, else down a Dijkstra flow field from your cell (walkers and fliers get separate fields). Wind-up, attack, recover; pain flinches; separation; doors opened on bump. When a monster's shot hurts another species, they fight (infighting). Below ~22% health a monster may **stagger** — it glows and slows, and an Arc Blade hit executes it for 15–25 health. Elites (Burning, Ironhide, Swift, Vampiric, Brood) are tinted, haloed and tougher.

### 4. Weapons (`js/game/weapons.js`, `js/render/viewmodels.js`)

| Slot | Weapon | Ammo | Notes |
|---|---|---|---|
| 1 | Arc Blade | — | Melee; executions; ×8 with Berserk |
| 2 | M-9 Warden | — | Self-charging pistol; accurate first shot |
| 3 | Scattergun | Shells | 8 pellets, pump animation, shells eject |
| 4 | Twin Reaper | Shells ×2 | 20 pellets, break-action reload |
| 5 | Shredder | Bullets | Rotary, spins up |
| 6 | Hellfire RL | Rockets | Splash (and rocket jumps) |
| 7 | Ion Lance | Cells | Rapid ion bolts |
| 8 | Rail Driver | Cells ×6 | Pierces every body in a line |
| 9 | Singularity Cannon | Cells ×40 | Charges, launches a black hole that arcs lightning into everything near it, then collapses |

Viewmodels are modelled in code (slides, pumps, barrels, coils, a glass chamber) with PBR materials, a generated environment map, and lights tinted by the lightmap where you stand. Bob, sway, recoil, switching, muzzle flashes that light the room.

### 5. Pickups and powerups

Stim, Medkit, Vital Vial (+2 to 200), Soul Orb (+100), Armor Shard, Combat Vest (33% absorb), Bulwark Plate (50%), ammo in small and large sizes, the Backpack (double capacity), weapons, keycards, and six powerups: **Berserk** (blade ×8, heal), **Overdrive** (×3 damage), **Haste** (×1.45 speed and fire rate), **Aegis Field** (invulnerable, inverted colours), **Phase Cloak** (monsters see less and miss more; firing wears it down), **Hazard Suit** (lava and acid can't hurt you), plus the **Survey Drone** (maps the whole level and shows monsters on the automap).

### 6. Story (`js/story.js`)

Three episodes, ten levels: **Tartarus Station** (Landing Bay Kappa, Reactor Ring, Security Core — Overseer Kell), **The Sulfur Deep** (Mantle Drill Shafts, The Smelting Halls, The Furnace Cathedral — the Furnace Mother), **The Underneath** (The Breach, Gardens of Teeth, The Choir Halls, The Pale Throne — the Archon). Each episode opens with a crawl; each level has a card with its objective; 27 data logs (three per level) tell the story of Dr. Oduya, Overseer Kell, Corporal Insa and what VESPER knew; VESPER talks to you about new species, keys, secrets, low health and guardians. The ending has a sting.

### 7. Endless Descent (`js/campaign.js`)

Floor after floor with themes cycling every three floors, more rooms, more keys, a growing roster, a new weapon on each of the first seven floors, a guardian every fifth floor (the Archon every tenth). Your deepest floor is saved.

### 8. Audio (`js/audio.js`)

All synthesised. Weapons (distortion and noise layers, pump and break-open foley), explosions, impacts, doors, pickups, footsteps on metal or stone, a formant-filtered voice per species for sight/pain/death/idle/attack, VESPER's terminal beeps. Spatial: stereo pan from your yaw, distance roll-off, a low-pass when the source has no line of sight. Music is a generative industrial-metal score per theme — riff generator (palm-muted chugs and power chords in the theme's mode), drums with fills, bass, a lead that enters when the fight heats up, a drone for exploring and a choir for guardians — crossfaded by how many awake monsters can see you.

---

## Controls

| Action | Keyboard + mouse | Touch |
|---|---|---|
| Move | WASD | Left thumb: floating stick |
| Look | Mouse (Pointer Lock) | Right thumb: drag anywhere |
| Fire | LMB | Hold FIRE (drag from it to aim) |
| Blade / quick melee | F, V, RMB | ⚔ |
| Use | E | USE |
| Jump | Space | ⤒ |
| Weapons | 1–9, wheel, Q (last), [ ] | ◀ ▶ |
| Walk (always-run is on) | Shift | Push the stick less |
| Automap | Tab / M | MAP |
| Pause | Esc / P | ❚❚ |

Doors open as you walk up to them. Secret walls open if you keep pushing into them. Vertical auto-aim is on by default (Strong on touch).

---

## Difficulty

| | Recruit | Warden | Veteran | Nightmare |
|---|---|---|---|---|
| Damage taken | ×0.5 | ×1 | ×1.3 | ×1.7 |
| Monster count | ×0.7 | ×1 | ×1.3 | ×1.55 |
| Monster speed | ×0.9 | ×1 | ×1.05 | ×1.25 (and faster projectiles, leading shots) |
| Ammo pickups | ×2 | ×1 | ×1 | ×1 |

---

## Module overview

| File | Responsibility |
|---|---|
| `js/main.js` | Boot, state machine, screens, saves, options, codex, auto quality, debug hooks |
| `js/config.js` | Weapons, pickups, ammo, difficulties, quality tiers |
| `js/story.js` | Episodes, levels, logs, barks, ending |
| `js/campaign.js` | Campaign arsenal, Endless Descent specs |
| `js/input.js` | Keyboard, Pointer Lock mouse, touch stick/look/buttons |
| `js/audio.js` | SFX, monster voices, generative music |
| `js/level/gen.js` | Pure procedural level generator + validator |
| `js/level/build.js` | Level meshes, doors, light fixtures |
| `js/level/lightmap.js` | Baked lighting |
| `js/level/textures.js` | Per-pixel painters, theme tables |
| `js/render/renderer.js` | Renderer, cameras, post chain, dynamic light pool |
| `js/render/materials.js` | World / actor / glow shaders |
| `js/render/sky.js` | Four skies |
| `js/render/fx.js` | Particles, beams, decals, debris, flashes |
| `js/render/viewmodels.js` | The guns in your hands |
| `js/game/session.js` | One level in play: damage rules, pickups, doors, triggers, ambushes, bosses |
| `js/game/world.js` | Collision, ray casts, doors, flow fields, sound (pure) |
| `js/game/player.js` | Movement and inventory |
| `js/game/weapons.js` | Firing, switching, auto-aim, viewmodel animation |
| `js/game/monsters.js` | Monster AI and attacks |
| `js/game/projectiles.js` | Everything that flies |
| `js/game/species.js` / `models.js` / `bestiary.js` | Procedural species, rigs and data |
| `js/game/props.js` | Pickups, barrels, decor |
| `js/ui/hud.js` | HUD, helmet portrait, damage arcs, automap |

---

## Open questions

- [ ] Not yet played on a real phone or a real GPU — tested in SwiftShader only; auto quality should catch slow phones.
- [ ] Balance is tuned by hand, not by a bot (unlike game-049/050). A combat bot through the real Session would be the next step.
- [ ] Monster pathing uses a flow field from your cell; flanking and cover use would make the later episodes sharper.

---

## Changelog

### v1.0.0 — 2026-10-03
- Initial release: procedural levels with keys, locks, secrets, heights and validation; ten archetypes + three guardians rolled into per-run species; nine weapons with code-modelled viewmodels; powerups; the three-episode campaign with logs and VESPER; Endless Descent; baked + dynamic lighting, custom shaders, post-processing; generative score; touch controls; Playwright and headless tests.
