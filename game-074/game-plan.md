# CINDERWING — An Angel's Ascent from the Pit

**Genre:** Horizontal scrolling shooter (R-Type / Gradius lineage) with a told story
**Engine:** three.js r165 (ES modules via import map); everything else vanilla JS, DOM and Web Audio
**Target:** any screen from a 360 px phone to a desktop monitor; keyboard, gamepad or touch
**Status:** Complete — v1.0.1

---

## Concept

When the war in Heaven ended, the last star of the morning fell burning into the Pit. Where it struck, in the Cradle of Cinders at the bottom of the ninth circle, a child opened his eyes: **Cael**, a young angel with white wings in a place where nothing has white wings. The demons can smell his light and want it. A chained fallen angel, **Vesper**, tells him the only thing that matters: *fly up*. Through every circle and every gate, until there is sky.

Cael learns to fight on the way. He finds a broken halo that sings in his hands, wins it back from the demons who carry halo shards in cages, and learns to send it ahead of him like a shield and a weapon. Seven circles, seven wardens, and at the rim of the Pit the Lord of the house himself — **Malphas**, who wants the light of a morning star to open the Gate of Dawn from below.

Every model, sky, terrain, sound and note is generated in code when the page loads. There are no image, model or audio files.

---

## Core mechanics

### 1. Flight and feathers
- Eight-way flight in a 32 × 18 field that scrolls right at 2.4 units/s. **Focus** (Shift) slows you to 55% for threading bullets.
- **Feathers** (hold Z/Space): twin light-darts, 11 shots a second.
- A tiny hitbox (radius 0.26, marked by the glowing heart-light at Cael's chest), as the genre expects.
- **Terrain is solid.** Floors, ceilings and pillars are deadly on Seraph and Archangel; on Pilgrim they push you away and cost a feather of health.

### 2. Radiance (the wave cannon)
Hold X to gather light (1.15 s to a full charge) — your feathers stop while you charge. Release for a beam that pierces every enemy in its path, damage 10 → 52 by charge. Below 30% a release is just a dart. A HUD gauge shows the charge; a full charge pulses.

### 3. The Halo (the Force)
- The first crystal from a **reliquary bearer** (the power-up carrier) brings the Halo flying in from behind; it attaches to Cael's front.
- Attached, it **absorbs every small bullet** that touches it, burns anything it touches (34 dps) and fires its own weapon with you.
- **Cast** (C) sends it forward (or backward, if it's on your back) at 24 u/s, burning hard as it goes (70 dps); it comes to rest ahead and holds your height on its own, still firing. **Call** (C again) brings it home; it attaches to whichever side touches you — the R-Type front/back trick.
- Three songs, two levels each. A second crystal of the same colour raises the level; another colour changes the song and keeps the level:

| Crystal | Name | Level 1 | Level 2 |
|---|---|---|---|
| Red | Seraph Flame | 3-way fan of fire | 5-way, bigger, harder |
| Blue | Lance of Dawn | piercing laser bolts | + diagonal bolts that ricochet off terrain |
| Gold | Choir of Wings | 2 homing motes | 4 homing motes, faster |

### 4. Other relics
| Relic | Effect |
|---|---|
| Wing | +1 speed level (5 levels, start at 2) |
| Echo | A ghost of Cael that trails his path and copies his shots and seekers (Gradius options, up to 2) |
| Seeker Feathers | Homing feathers every 0.75 s from Cael and each Echo |
| Aegis | Absorbs three hits |
| Extra life | One hidden in each of the last two circles |
| Soul shard | 200 points, dropped by big enemies |

Relics come from reliquary bearers and from **squadrons**: kill every member of a marked formation and the last one leaves its relic (+1000).

### 5. Lives, checkpoints, difficulty
| Trial | Lives | Health | Bullets | Death |
|---|---|---|---|---|
| **Pilgrim** | 4 | 3 hearts per life | 0.78× speed, 0.75× rate | respawn where you fell, keep your relics |
| **Seraph** | 3 | one touch | normal | back to the last checkpoint; relics reset (the Halo keeps its colour) |
| **Archangel** | 3 | one touch | 1.18× speed, 1.25× rate, revenge embers | as Seraph, score ×1.6 |

Each stage has checkpoints at its start, about a third and two-thirds in, and at the boss. Extra lives at 30k, 100k, 200k, 350k, 550k, 800k. Infinite continues reset the score to zero (arcade rules).

---

## The seven circles

Every circle is a fixed script keyed by scroll distance — the same waves, in the same places, every time, so they can be learned.

| # | Circle | Terrain | Signature threats | Warden |
|---|---|---|---|---|
| 1 | **The Cradle of Cinders** (9th) | a lava sea, rock islands, a cave throat | imp squadrons, turrets, hellhounds, lava geysers that bubble before they blow, a Watcher eye | **Gorrmaw**, Warden of the Cradle — a demon skull rising from the lava; its jaw opens to breathe a sweeping fire stream, which is the only time its core can be hit |
| 2 | **The Bone Orchard** (8th) | a corridor of bone with pillars and breakable bone gates | bone worms from floor and ceiling, wraiths from behind, hanging mines | **The Ossuary Wyrm** — fourteen vertebrae on a fixed figure-eight; each ripple runs down its spine as bullets |
| 3 | **The Weeping Foundry** (7th) | iron floors, pipes, low ceilings | crushers that keep time, spiked wheels, lancers' telegraphed beams, charging bulls with edge warnings | **The Iron Penitent** — break its two armour plates to open the furnace core; piston fists aimed at you after a warning line |
| 4 | **The Drowned Choir** (6th) | the Styx (deadly water), drowned cathedral vaults | drowned hands that rise where you are (a ripple warns), soul lanterns, fallen seraphs | **The Ferryman** — the lantern is the heart; his scythe sends a wall of needles with one gap, opened at the height you were when it was raised |
| 5 | **The Flesh Labyrinth** (5th) | living walls, membranes you must burn through | brood pods, tentacles, eyes, worms | **The Brood Mother** — a heart that beats; on the beat the eye opens and the veins fire lasers at fixed heights with safe lanes between |
| 6 | **The Frozen Betrayal** (4th) | ice caves, a bottomless abyss, ice walls | crystals that shatter into shards (break them far away), frozen gargoyles that wake as you pass | **Sammael**, the Frost-Crowned — dashes along a warned line at your height, summons prisms, a blizzard, a frenzy spiral below 25% |
| 7 | **The Gate of Dawn** (the rim) | ruins of the gate, open sky | everything, remixed | **Malphas**, Lord of the Pit — three phases: two hands that sweep the screen at your height after a wind-up; the crown of black fire with tracking eye-beams; the heart, while chains drag you toward him. When the crown breaks, Vesper's light reaches Cael and the Halo becomes the **Dawn Halo** |

## Story
Told in staged 3D scenes between circles (the real models in front of each circle's sky; the speaker is lit) and in Vesper's voice during flight.

- **Prologue — The Fallen Star.** Cael wakes in the ashes; Vesper, in chains, tells him to fly.
- **A Halo That Sings.** The halo remembers an angel who fell; now it has chosen him.
- **The Lord of the House.** Malphas speaks for the first time and offers a bargain.
- **The Evening Star.** Vesper admits she was an angel once.
- **The Last Coin.** The dying Ferryman remembers carrying a falling star — and what she carried.
- **What a Star Carries.** Vesper is the star that fell; she gave her light so that Cael would wake.
- **The Traitor.** Sammael, who gave her up to Malphas, asks Cael to tell her he's sorry.
- **Epilogue — Home.** The Gate breaks open. Vesper's chains broke when Malphas fell; two lights rise into the morning.

---

## Rendering (all procedural)
- **Models** (`js/view/lib.js`, `models.js`, `bossmodels.js`): a Builder merges lathes, tapered tubes, displaced spheres, feathers, bat-wing membranes and primitives into one geometry per rigid part with per-vertex colour and **glow**. One MeshStandardMaterial variant reads the glow, adds a camera-facing rim light in the circle's colour and flashes white on hits. Cael's wings are ~60 individual feathers on shoulder and hand joints that flap about the body axis.
- **Terrain** (`terrain.js`): built in chunks from the sim's own terrain functions as a rounded ridge whose crest sits exactly on the collision line. A shader paints stone, bone, iron, flesh or ice with glowing veins in patches, lit by the stage and by Cael's own light. Lava and Styx seas are animated planes to the horizon.
- **Skies** (`backgrounds.js`): one fragment shader with a branch per circle (smoke and embers, a bone moon, furnace sparks, a soul aurora, pulsing veins, a frozen aurora, the dawn with rays and clouds) plus scenery layers at depth.
- **Sprites** (`sprites.js`): one instanced quad batch, shapes as SDFs, premultiplied so "add" and "cover" share a blend mode. Enemy bullets have a white core, a colour body and a dark rim, tinted per circle for contrast.
- **Effects** (`fx.js`): layered explosions (flash, flame, streak sparks, shock ring, smoke, tumbling 3D debris, a point light).
- **Post** (`renderer.js`): UnrealBloom → heat shimmer, chromatic aberration on hits, grade, vignette, grain, flashes → ACES + sRGB.

## Audio (all synthesised)
A lookahead sequencer plays a track per circle (bass, a formant-filtered choir or organ pad, arpeggios, bells, drums and a melody), a boss theme, Malphas's theme, a title hymn and the ending. SFX: feathers, Radiance charge (a rising loop) and release, explosions by size, the Halo's chimes, pick-up arpeggios, warnings, crushers, the Brood Mother's heartbeat.

---

## Architecture

```
js/
  config.js      constants and difficulty table
  rng.js save.js input.js ui.js audio.js main.js
  sim/           pure simulation — no three.js, no DOM, no Math.random
    world.js     player, Halo, Echoes, weapons, collisions, checkpoints, events
    enemies.js   22 enemy kinds        bosses.js  7 bosses
    stages.js    terrain + scripts     terrain.js shared floor/ceiling functions
    story.js     scenes and cast       bot.js     the autopilot
  view/          three.js
    renderer.js backgrounds.js terrain.js sprites.js fx.js
    lib.js models.js bossmodels.js view.js cinema.js
dev/
  simtest.mjs    purity, data, every stage cleared by a god bot, rules, a balance table
  browsertest.mjs  real Chromium: desktop flow, every stage and boss, the ending, phones, blocked storage
  play.mjs       one-off screenshots
```

The sim announces everything through a bounded event queue (`w.fxq`) that main.js drains once a frame into the view, the audio and the UI. A fixed 1/120 s step keeps patterns identical at any refresh rate; edge inputs (Halo) only fire on the first sub-step.

## Controls
| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Fly | Arrows / WASD | stick / d-pad | drag anywhere (relative) |
| Feathers | Z / J / Space | A / RT | automatic |
| Radiance | hold X / K | X / LT | hold BEAM |
| Halo | C / L | Y / B | HALO |
| Focus | Shift | LB / RB | — |
| Pause | P / Esc | Start | ❚❚ |
| Music | M | | |

## Balance
The dodging bot (`js/sim/bot.js`) clears every circle on every trial without dying; it sees every bullet and reacts every frame, so that is a floor, not a human estimate. What the bot did find were real traps: a Foundry stretch where a pipe, two crushers and charging bulls left no exit (rebuilt), and a boss hand too fast to dodge without a wind-up (it has one). Boss HP is set so the god bot needs 50–80 s per warden; a dodging human lands perhaps 40% of that damage, so expect fights of one and a half to three minutes.

## Changelog
### v1.0.1 — 2026-10-13
- The angels are rebuilt as clothed, robed figures with faces, hair, sleeves, belts and skirts over their feet, and wings without visible bones; Cael no longer looks naked or washes out to white.

### v1.0.0 — 2026-10-12
- First release: seven circles, seven bosses, the Halo, Radiance, Echoes and five other relics, three trials, a staged story with prologue, six interludes and an ending, procedural models, skies, terrain, effects, music and sound, touch and gamepad, saves and a Hall of Light.
