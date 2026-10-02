# Nightline

**Genre:** Ambient driving / night-drive simulator (no goals, no fail state)
**Engine:** three.js r165 (ES modules via import map), everything else vanilla JS + DOM
**Target resolution:** any; the 3D view renders at 240 lines by default and is scaled up with hard pixel edges
**Status:** Playable — v1.0.0

---

## Concept

A lo-fi synthwave night drive through an endless, rain-soaked, Blade Runner-style city. There is nothing to win and nothing to hit: you pick a speed and a lane, the radio plays, the city slides past, and every kilometre or so there is somewhere to pull over — a noodle bar, an all-night diner, a skyway overlook — where you can sit in the rain for a while before driving on.

What it borrows from earlier games in this repo:

- **game-014 Trackrunner / game-029 Wayfarer's Path** — a road described by arc length and built in chunks ahead of you.
- **game-024 Neon Vanguard / game-045 PINBREAK '86** — synthwave palette, additive glow, "fake lights painted onto a surface shader" (here the street-lamp pools and your headlights are computed in the road shader, not by real lights).
- **game-036 Island Walker** — chunk lifecycle, determinism per chunk, keeping draw distance inside the fog.
- **game-040 / game-049 / game-051** — the dev-harness pattern: debug hooks behind `?debug=1`, a fast-forward sim, Playwright in real Chromium on desktop and touch-only phones, fail on any console error.

---

## Core systems

### 1. The road
`js/road.js`. Heading is an analytic sum of four slow sines (so the road wanders but can never loop back — |heading| stays well under 90°), position is its integral sampled every 2 m. Everything is placed in road coordinates: *s* along, *u* across (+ is the driver's right). Four lanes, two each way; we drive in the right-hand pair.

Districts come in 1.3–2.1 km stretches that end on chunk boundaries: **downtown** (towers, billboards, cross streets with traffic lights), **night market** (low dense buildings, stacked signs, paper-lantern strings over the road), **skyway** (the road climbs onto a 19 m viaduct between towers, with the lit city far below), **harbour** (warehouses on one side, black water, piers, cranes and ships on the other), **heights** (dense residential blocks). Each has its own fog, sky and lamp colour, which the renderer eases between.

### 2. The city
`js/city.js`. Built in 96 m chunks (a multiple of the 12 m dash and 32 m lamp spacing, so road markings line up across chunks). A chunk is a pure function of (seed, index): road surface, sidewalks and curbs, lamps, a front row of buildings with shopfronts, awnings, blade signs, flat signs and billboards, a back row of towers (each checked for clearance against 2.4 km of road so a curve never runs into one), roof clutter and aviation lights, and whatever set piece belongs to the district. A chunk is ~8 merged meshes, one per material, in chunk-local coordinates; building one takes ~3 ms.

### 3. Stops
`js/stops.js`. Every 0.8–1.5 km there is a stop on the right with a pull-in bay: noodle bar, diner, charging station, skyway overlook, konbini, record shop, arcade, motel, laundromat or pier, chosen by district. Each has generated names, a set piece, a camera framing, seven-ish lines of description that drift past while you sit there, and one small action (order a bowl, play one credit…) with a few possible outcomes. Visits go into the night log.

### 4. Driving without crashing
`js/car.js`, `js/traffic.js`. You don't steer: you set a cruise speed, ask for a lane, and ask to pull over. Lane changes put the blinker on and wait until there's a gap — and the gap needed grows with the closing speed of anything coming up behind or anything you'd be closing on. You and all traffic follow whatever is ahead in your lane with the same adaptive-cruise rule, and traffic never changes lanes. The browser test drives ~40 km in drift mode checking every step that nobody ever overlaps anybody.

### 5. Wet streets
`js/render.js`, `js/materials.js`. Each frame the scene is drawn once from a camera mirrored in the road plane (clipped to above the road) into a half-size target. The road shader projects into it, ripples it with animated noise, smears it vertically with a five-tap blur and weights it by a Fresnel term and a puddle mask — so every sign, lamp, tail light and spinner shows up in the asphalt. Street-lamp pools and your headlight beams are computed analytically in the same shader.

### 6. Lo-fi output
The main pass renders to a low-resolution half-float target (240/360/540 lines). A post pass adds a cheap two-ring bloom, slight chromatic aberration, a purple-lifted grade, vignette, film grain and 4×4 ordered dithering to ~30 levels per channel, then writes to a canvas of the same size that CSS scales up with `image-rendering: pixelated`. Scanlines are a CSS overlay at screen resolution. "Retro filter" and the resolution preset are settings.

### 7. The radio
`js/audio.js`. Three generative stations and an off switch, all synthesised:

| Station | Style | Tempo | Instruments |
|---|---|---|---|
| 88.3 NIGHTWAVE | synthwave | 86 | gated kick/snare, 8th-note saw bass ducked by the kick, detuned saw pads, a square arpeggio through a dotted-8th delay, a vibrato lead |
| 101.9 RAIN FM | lo-fi hip-hop | 74, swung | dusty kick/rim, tremolo electric piano with 7th chords, sub bass, a breathy sine flute, vinyl crackle |
| 76.0 STATIC DREAMS | ambient | 58 | slow-swelling detuned "brass" polysynth with filter sweeps and vibrato, a sub drone, bells into a long reverb |

Each "track" picks a key and a progression, plays 24–32 bars and gets an invented title and artist. Everything goes through a broadcast chain: tape wow on every oscillator's detune, a band-limited filter, convolution reverb and delay. Under the radio: rain (heavier on the roof in the hood camera), tyre hiss that rises with speed and wetness, an electric motor whine, city hum, the blinker, thunder after lightning, spinner fly-bys and a distant siren when a patrol spinner sweeps the street.

---

## Controls

| Action | Keys | Touch |
|---|---|---|
| Speed up / slow down (sets cruise) | W S / ↑ ↓ | + − |
| Brake (hold) | Space | ■ |
| Change lane | A D / ← → | ◀ ▶ |
| Pull over · drive on | E / Enter | tap the prompt · Drive on |
| Radio next · previous | R · Shift+R | Radio |
| Camera (chase, hood, low, cinema) | C | Chase |
| Drift mode (the car drives itself) | Z | Drift |
| Photo (4× PNG) | P | Photo |
| Hide the dash | H | — |
| Menu | Esc / M | Menu |

---

## Atmosphere checklist

- Rain streaks computed in the vertex shader, wrapped round the camera and raked along their velocity relative to you; intensity drifts between clear, drizzle and downpour (or lock it in settings). Lightning doubles in the sky and the skyline, thunder follows.
- Steam from manholes and the noodle stall.
- Spinners (flying cars) crossing the sky and cruising sky-lanes above the road; now and then a patrol spinner hovers over the street sweeping a searchlight.
- Animated billboards (an eye that looks around and blinks, koi, a cola ad, a face), flickering signs, chasing marquee bulbs, crown lights, edge neon, gas flares on the horizon, a pyramid arcology on the skyline.
- An attract mode drives itself behind the title screen.

---

## Phases

### Phase 1 — Drive (done)
- [x] Road, districts, chunked city, signs, lamps
- [x] Car, lanes, traffic, spinners
- [x] Reflection pass, lo-fi post, rain, steam, sky, skyline, flares
- [x] Radio stations and ambience
- [x] Stops, parked card, night log
- [x] Camera modes, drift mode, photos, settings, touch controls
- [x] Browser test: desktop + phones, 40 km fast-forward drive

### Ideas (not built)
- A passenger who talks sometimes.
- Turning off at cross streets onto a different route.
- A dawn that never quite arrives.

---

## Module overview

| File | Responsibility |
|---|---|
| `main.js` | Boot, frame loop, input, stops flow, drift autopilot, debug hooks |
| `config.js` | Road cross-section, distances, speeds, district palettes |
| `road.js` | Centreline, districts, elevation, cross streets, stop placement |
| `city.js` | Chunk building: road surface, buildings, signs, lamps, harbour, skyway |
| `stops.js` | Stop types, names, lines, actions, set pieces, camera framing |
| `geo.js` | Merged-geometry builders (boxes, hexahedra, quads, glow points, lines) |
| `textures.js` | Window sheet, neon sign atlas, skyline, glow/steam, animated billboards |
| `materials.js` | Shared materials and shaders (road, points, sky, skyline, beams) |
| `models.js` | Vehicle models |
| `car.js` | Your car: cruise, lanes, blinker, pull-in / pull-out |
| `traffic.js` | Road traffic, spinners, patrol searchlight, all vehicle lights |
| `camera.js` | Chase / hood / low / cinema shots, parked framing |
| `weather.js` | Rain, lightning, steam |
| `sky.js` | Sky dome, skyline band, flares |
| `render.js` | Reflection pass, low-res main pass, post |
| `audio.js` | Radio stations, ambience, sound effects |
| `ui.js` | DOM HUD, parked card, menu, touch controls |

---

## Changelog

### 1.0.0 (2026-10-02)
- First release.
