# Sister Circuit

**Genre:** Side-scrolling beat-'em-up (Double Dragon, Streets of Rage, Turtles in Time)
**Engine:** three.js r165 (ES modules, import map), Web Audio
**Render:** a 3D scene drawn into a 240 px tall render target, nearest-neighbour upscale, bloom, optional CRT scanlines
**Status:** v1.0.0 — complete, seven stages

---

## Concept

Port Solace, 2089, a city owned outright by Aurex Dynamics. Juno Vega's little sister Mika, a prodigy hacker, has been taken: her mind is the only one compatible with VANTA, Aurex's neural-link program. Juno steals the VANTA-7 prototype combat suit and fights north to the Aurex Spire to bring her home.

The suit's AI, ECHO, coaches and teases her the whole way. Halfway up the city it learns the truth about itself: it was trained on Mika's own brain scans, which is why the suit unlocked for a sibling. In the Spire, Juno has to beat Mika, mind-controlled inside the VANTA-8, and ECHO gives itself up to break the control link. The sisters fight the CEO, Magnus Hale, together on the roof at dawn.

No image or audio files: every sprite, portrait, texture and note is generated in code.

---

## The look

- **Fighters** are pixel art generated from a 2D side-view skeleton (`js/art/rig.js`). A pose is a dozen joint angles; each character supplies proportions, materials and attachments (hair chains, armour, visors, swords, a mech's cannons). `js/art/raster.js` fills shapes per pixel centre into a **palette-index buffer**: outline ring, dark / mid / light tones from hue-shifted ramps, dithering on large shapes, and outlines that separate overlapping limbs but not the joints of one limb. Frames are baked once into an index atlas; the GPU looks indices up in a palette texture, so grunt variants, boss rage colours and Juno's Overdrive glow are palette swaps.
- **Timing lives in the sim.** Attacks are `startup / active / recovery` data; the view picks the frame for the current phase, so the art never drifts from the hitboxes.
- **The street** is real three.js geometry (floors, storefront walls, protruding neon signs, containers, specimen tanks, water towers) with procedural pixel textures. A second scene with a level camera holds the sky, three skyline layers and 3D towers for parallax, drawn first; the pitched street camera draws over it after a depth clear.
- **Portraits** are frontal busts drawn with the same rasterizer and ramps.

## Core mechanics

### Attacks and combos
| Input | Move |
|---|---|
| ATK ×4 | jab, cross, elbow, roundhouse (knockdown) |
| ATK ATK, then JUMP after a hit | launcher uppercut (juggle) |
| back + ATK | backfist (turns around) |
| run + ATK | dash knee |
| JUMP, ATK | flying kick (or a jumping knee from standing) |
| air, down + ATK | dive stomp (bounces off) |

### Grabs
Walk into a dazed or idle foe to grab. ATK knees (third is a headbutt), toward + ATK throws, back + ATK suplexes, JUMP vaults over. Thrown bodies knock down every enemy they hit. Big enemies and bosses can grab you; mash to escape.

### Weapons
Steel pipe, mono-katana, shock baton (extra stun) and throwing knives, from props and drops. Limited uses; SPECIAL throws the weapon; getting knocked down drops it.

### Suit specials and Overdrive
- **Arc Burst** (SPECIAL): invulnerable 360° knockdown. 20 energy, or 8 health when the battery is flat (never fatal).
- **Rail Dash** (direction + SPECIAL): multi-hit dash ending in an uppercut. 25 energy.
- **Meteor Drop** (SPECIAL in the air): dive and shockwave. 20 energy.
- **Overdrive** (meter fills from dealing and taking damage): 8 s of faster, 1.5× damage, free specials.
- Safehouse unlocks: Pulse Shot (hold and release SPECIAL), Rising Arc (SPECIAL mid-combo), Counter Burst (SPECIAL while being hit), air combo.

### Hit reactions
Hitstop on every hit, flinch / heavy flinch / knockdown / launch, juggles capped at four hits, a bounce on hard landings, invulnerable get-up. Big enemies and bosses have **poise**: they flash gold and shrug off hits until it breaks.

### Crowd AI
Attack tokens (1 / 2 / 3 by difficulty) limit how many enemies engage at once; the rest hover, strafe in depth and flank. Enemies line up on your depth and telegraph (long startup, a red "!" on heavy moves). Nobody hits you while you're down.

---

## Enemies

| Enemy | Behaviour |
|---|---|
| Street Rat (punk) | jab / punch / kick combos, occasional flying kick; five colour variants |
| Shiv (knife punk) | fast slashes, lunges, throws knives along your lane |
| Bulk (bruiser) | poise, slams, charges across the screen, grabs and throws |
| Aurex Sec | riot shield blocks from the front; bashes after blocking twice |
| Enforcer | keeps its distance, laser-sight aim, pistol shots |
| Kunoichi | reads your startup and backflips away, jump slashes, shuriken |
| Ripper | claw combos and long pounces |
| Synth Trooper | fast three-hit combos, dash punches, blocks what it sees coming |
| Husk | lab mutant with poise; acid that leaves burning puddles |
| Hornet Drone | hovers out of reach of low attacks, fires lasers |
| Tick Mine | runs at you and explodes; kick it into its friends |

## Stages and bosses

| # | Stage | Hazards | Boss |
|---|---|---|---|
| 1 | Neon Row — rain, storefronts, alley, garage | ion barrels | **Jackhammer Malone** — hydraulic arms, ground-pound shockwaves, rush, grab; summons punks |
| 2 | Line 9 — inside the maglev, then the roof | signal gantries (jump) | **Viper** — fast slashes, knife fans, dashes, evasion; Venom Mirage clones |
| 3 | Lantern Market — stalls, lanterns, rooftops | — | **Kuroda, the Oni** — nodachi reach, counter stance, sword waves, blink strikes; Thousand Cuts |
| 4 | Ironwharf — container docks, Warehouse 9 | forklifts, steam vents | **Bulwark** — mech: missile reticles, flamethrower (overheats in phase 2), smash, charge |
| 5 | Biolabs — sublevel 4, the vault | laser gates | **Specimen G-7** — huge reach, grab, acid spread, leaping crush on a tracking shadow |
| 6 | The Spire — lobby, express elevator | waves dropping in | **Mika (VANTA-8)** — Juno's own moves, punishes combo spam with Arc Burst; summons drones |
| 7 | Zenith — penthouse in the storm, helipad at dawn | — | **Magnus Hale** — cane-sword, counter stance, board security; then **Ascendant**: flight, z-band beams, dive slams, homing orbs, with Mika assisting |

## Modes and progression

- **Story** (dialogue, safehouse upgrades between stages, saved progress, stage select once reached), **Arcade** (no story, no shop), **Boss Rush** and **Survival** (unlocked by clearing Story), **play as Mika** (unlocked).
- Difficulties: Story (5 lives, unlimited continues, gentler), Arcade (3 lives, 3 continues), Mania (tougher, angrier, more enemies, 1 continue).
- Per-stage results with time / no-damage bonuses and an S–D rank. Extra life every 50 000 points.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move (up = into the street) | WASD / arrows | stick / d-pad | floating stick, left side |
| Run | double-tap left/right | LB / full stick | push the stick all the way |
| Attack | J / Z | X | ATK |
| Jump | K / X / Space | A | JMP |
| Special | L / C | B | SP |
| Overdrive | I / V / F | Y / RB / RT | OVR |
| Pause | Esc / P | Start | ❚❚ |

Phones in portrait get the game on top and the controls below; landscape overlays them.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | boot, modes, the fixed 60 Hz loop, screen flow, debug hooks |
| `js/sim/` | pure simulation (no three.js, no DOM): `fighter` physics, phases, hits, reactions; `moves` / `player`; `enemies` (defs + AI); `bosses`; `items`; `levels`; `world` (camera locks, waves, projectiles, hazards, pickups); `bot` |
| `js/art/` | `raster`, `rig`, `poses`, `chars`, `bake` (index atlases), `objects` (props, items, FX), `portraits` |
| `js/view/` | `scene` (renderer, render target, bloom, CRT, cameras), `stages` (15 segment builders), `textures`, `actors` (palette-swap sprite shader), `fx`, `view` |
| `js/ui.js`, `js/story.js`, `js/audio.js`, `js/input.js`, `js/save.js` | DOM layer, script, synthesis and sequencer, input merge, storage |

## Testing

See [dev/README.md](dev/README.md). The bot clears every stage headlessly; the browser test drives the real game on desktop and touch-only phones.

## Open questions / next steps

- Hand-tuning: balance is bot-tested, not yet human-tested on every stage and difficulty; Zenith is deliberately the hardest.
- Two-player local co-op would suit the genre; the sim already supports multiple player-team fighters (Mika's assist uses it).
- Portraits are frontal busts; a few characters (Rourke, Varga) appear only in portraits.

## Changelog

### v1.0.0 (2026-10-05)
- First release: seven stages, eleven enemy types, seven bosses (eight fights), story with ending, four modes, safehouse, touch controls.
