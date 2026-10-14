# CUE VICE

**Genre:** Stealth tactics × billiards (story campaign)
**Engine:** three.js r165 (ES modules, import map) — no asset files
**Target Resolution:** any; the camera fits the map to the window (desktop, tablet, phone in either orientation)
**Status:** v1.0.1 — complete: ten episodes, seven playable characters, story, upgrades, saves

---

## Concept

Miami, 1986. Detective Rico Vega's partner Benny Ortiz died on a bust somebody sold out. Working off the books with Lt. Dana Price on the radio, Rico follows Benny's last cassette from the Coconut Grove marina to a cartel kingpin who calls himself **the Shark** — and who turns out to be Rico's own captain.

It plays like **Metal Gear on a pool table**. Every member of the squad is a round, rolling character: you **pull back and let go** like a slingshot or a cue, and they slide, bank off walls, rebound off bumpers and clack into each other with real billiard physics. Guards patrol with vision cones. Hit one **from behind** and he goes down; hit him head-on and you need real speed or you just start a fight. Knock him into the bay or an open manhole and he is gone for good; leave him lying there and his friends will find the body.

Everything — the cars, palms, characters, portraits, neon signs, music and sound — is generated in code at load, in a pastel-and-neon 80s TV-cop-show style: sunsets, palm-lined causeways, Testarossa-style wedges, synthwave drums and gated snares.

---

## Core Mechanics

### 1. Pull back and release
Drag back from a teammate; the farther you pull, the harder the shot. The **aim guide** follows the shot through one cushion (more with the *Pool Shark's Eye* upgrade), shows a ghost ball where it will first touch another ball and the line the struck ball will take, and marks a red diamond where it would drop into water. Keyboard (arrows + Space) and gamepad (stick + triggers + A) aim the same shot.

### 2. Time moves only while something rolls
The world is frozen while you line up a shot. Release, and guards walk, look, notice and shoot until every ball has stopped (at least 0.9 s, at most 7 s). **WAIT** lets 1.5 s pass without moving. Each shot is therefore also a turn in a game of timing against the patrols — a stealth puzzle with billiard moves.

### 3. Stealth
- **Vision cones** are ray-cast against the map every frame and drawn on the floor (white → amber when suspicious → red on alert). Glass is see-through; walls, crates, doors and pillars are not. Dogs smell you from behind at short range. Cameras sweep. Lasers blink.
- **Suspicion** builds faster up close and when you are moving. At 30 % a guard stops with a **?** and goes to look; at 100 % it is **ALERT**.
- **Alarm phases**, Metal Gear style: ALERT (they chase the last sighting and shoot) → EVASION (they search around it) → CAUTION (wider cones, back on patrol) → INFILTRATION.
- **Noise**: hard hits against walls, shattering glass, explosions and takedowns make noise; guards nearby come to investigate. A soft bank is silent.
- **Hedges** hide a ball that has come to rest in them.
- **Bodies**: knocked-out guards wake after ~30 s, and a patrolling guard who sees one goes to wake him and puts everyone on CAUTION. Sink them to be safe.

### 4. Billiard takedowns
- Unaware guard + speed ≥ 3 → **TAKEDOWN**. Aware guard needs ≥ 7.5 (Rico 5, Tito 2).
- Cushions before the hit score **BANK SHOT / DOUBLE BANK / TRICK SHOT**; several knockouts in one shot score **DOUBLE / TRIPLE**.
- A knocked guard is a ball too: send him into another unaware guard for a **COMBO**.
- **Pockets**: the bay, pools and open manholes. A guard who goes in is gone; a teammate climbs out where the shot started, a heart lighter.
- **Bosses** (Nico Valente, the Shark) take several hits, then lie dazed until you sink them.

### 5. The squad (one active ability each, tapped mid-roll)

| Who | Role | Ability (tap while rolling) | Passive |
|---|---|---|---|
| Rico Vega | Detective | **Bank On It** — stop dead and take a free shot from there | KOs from any side at speed |
| Lola Reyes | Sharpshooter | **Tranq Darts** — up to three per shot, bank once, sleep unaware guards, break cameras, hit switches | |
| Dr. Marisol "Doc" Santos | Medic | **Triage** — heal everyone close by | Bumping a teammate heals or revives them; unaware guards she hits are sedated |
| Dex Monroe | Demolitions | **Detonate** — blast that throws everything, flattens guards, breaks crates, cracked walls, glass, cameras, wrecks target cars and safes | Blast-proof |
| Jinx | Hacker | **Ghost** — invisible to guards, cameras and lasers until she stops | Hacks terminals (secure ones only open for her) and switches off cameras she passes |
| Big Tito Fuentes | Heavy (3× mass) | **Anchor** — stop dead, shockwave shoves and stuns | Smashes crates and cracked walls; any hit knocks out |
| Roxy Starr | Decoy | **Boombox** — guards within 9 tiles go and dance for 10 s | Starstruck guards take twice as long to raise the alarm |

### 6. Objectives and extraction
Recover intel, free recruits, escort the witness (an object ball you knock to the ambulance), wreck cars, photograph shipments, plant bugs, hack mainframes, open safes, sink bosses. The getaway vehicle only takes the squad once the job is done; **everyone** must reach it — downed teammates can be revived by Doc or knocked into the exit like any other ball.

### 7. Instant Replay
Three VHS rewinds per episode (more with the *Spare Tape* upgrade) undo the last shot, including a loss. Unused tapes score.

---

## Game Loop

Story scene over the 3D causeway → **briefing** (objectives, par, pick the squad) → episode: line up, shoot, use abilities, wait, rewind → **Case Closed**: grade (S/A/B/C), score, Rep → **Garage** (spend Rep) → next story scene.

Grades: **S** no alarms, at or under par, no bodies found · **A** ≤ 1 alarm and ≤ par + 4 · **B** ≤ 3 alarms · **C** otherwise. Score adds style, Vice Tapes (hidden bonus collectibles) and a Ghost bonus, and subtracts alarms, bodies found and shots over par.

---

## The Ten Episodes

| # | Title | Place | Teaches | Squad |
|---|---|---|---|---|
| 1 | Night Moves | Dinner Key Marina | shooting, banks, takedowns from behind, the bay as a pocket | Rico |
| 2 | Club Flamingo | Ocean Drive | neon bumpers, glass, switch-and-door, a recruit (Lola) | Rico (+Lola) |
| 3 | Code Blue | Mercy General | escorting the witness as an object ball, healing, cameras, laundry chutes | Rico, Lola, Doc |
| 4 | Hot Wheels | Sunshine Motors, Hialeah | explosions, target cars, oil slicks, dogs | 3 of 4, Dex required |
| 5 | Static | Channel 7 / WJNX tower | lasers, terminals, a secure mainframe, recruit Jinx | 3 of 4 (+Jinx) |
| 6 | Port of Call | Port of Miami | cracked containers, heavies, Tito | 3, Tito required |
| 7 | Velvet Rope | Star Island | bugs, the boombox, first boss (Nico) and the pool | 4, Roxy required |
| 8 | The Leak | Metro-Dade Vice | no alarms allowed; cops are not enemies | 3, Rico required |
| 9 | Shark Week | Rickenbacker Causeway | four lanes of traffic that keep moving while you roll | 4 |
| 10 | Isla Tiburón | the Shark's island, in a hurricane | everything; sink the Shark in his own tank | 4 |

---

## Player Controls

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Aim + shoot | drag back from a teammate, let go | ←/→ aim (Shift fine), ↑/↓ power, Space | left stick, RT/LT power, A |
| Ability | click / tap anywhere while rolling, ABILITY button | Space / F | A |
| Pick teammate | click them or their card | 1–4, Tab, Q/E | LB/RB |
| Wait | WAIT (hold) | T (hold) | X |
| Instant Replay | REPLAY | R | Y |
| Camera | wheel / pinch zoom, drag empty floor to pan, + − buttons | + − , C reset | d-pad zoom, right stick pan |
| Pause | ❚❚ | P / Esc | Start |

---

## Progression

Episodes unlock in order; any cleared episode can be replayed for a better grade or the Vice Tapes. **Rep** (score / 10) buys upgrades in the Garage: per teammate *Kevlar* (+1 heart, ×2) and *Gear* (+1 ability charge, +3 darts for Lola, ×2); for the squad *Pool Shark's Eye* (the guide follows more cushions, ×2) and *Spare Tape* (+1 Instant Replay, ×2).

---

## UI / HUD

Top left: episode and objective checklist. Top right: alarm phase with its countdown bar, shots / par, Vice Tapes. Bottom: squad cards (portrait, hearts, ability charges; click to select) and ABILITY / WAIT / REPLAY / ❚❚. Radio chatter from Dana and the squad slides in when something happens for the first time. Floating neon popups for every takedown, bank, pickup and splash.

---

## Sound Design (Web Audio, no files)

A small sequencer plays seven tracks — title theme (D minor, gated snares, saw pads, a delayed lead), stealth, tense (the precinct), club (four on the floor), alert (138 bpm), finale and story pads — built from a kick, gated noise snare, hats, rim, toms, a filtered saw bass, detuned saw pads, a two-operator FM "DX bell" and a saw/square lead through a delay and a noise-impulse reverb. The alert track takes over while the alarm is up.

| Sound | Trigger |
|---|---|
| Ball clack, wall thud | collisions (by impact speed) |
| Bumper boing | neon bumpers |
| "!" sting | alarm |
| Rising "?" | suspicion |
| Bonk + birdies | takedown |
| Splash | anything into water |
| Boom | Dex |
| Pfft / gunshot / ricochet | darts, guards' guns |
| VHS squeal | Instant Replay |
| Typewriter ticks, radio static | story text, radio |

---

## Architecture

```
game-077/
├── index.html, style.css
├── js/
│   ├── main.js        mode machine, frame loop, pointer/keyboard/gamepad aiming, event → sound/radio/music
│   ├── config.js      physics, vision, alarm and guard tunables; palettes per time of day
│   ├── save.js        localStorage (guarded), roster per episode
│   ├── audio.js       synthwave sequencer + SFX
│   ├── ui.js          DOM screens, HUD, radio, briefing, garage, dossiers
│   ├── portraits.js   canvas-painted character portraits
│   ├── sim/           PURE (no DOM, no three.js, no Math.random)
│   │   ├── physics.js   circles vs tiles/circles/oriented boxes, pockets, DDA rays, A*
│   │   ├── level.js     ASCII map parser and objectives
│   │   ├── levels.js    the ten episodes
│   │   ├── world.js     rules: shots, abilities, takedowns, alarm, objectives, rewind, aim prediction
│   │   ├── ai.js        guard state machine, senses, noise, dancing
│   │   ├── data.js      the squad, the opposition, upgrades
│   │   └── story.js     scenes and radio lines
│   └── view/
│       ├── renderer.js  WebGL + bloom + grade/VHS pass
│       ├── view.js      tactical camera, event → effects, per-frame sync
│       ├── board.js     floor atlas, merged walls with neon trim, glass, water, props, street/sea
│       ├── actors.js    characters, cars, darts, bullets, boomboxes
│       ├── overlay.js   vision cones, patrol routes, aim guide
│       ├── fx.js        particles, rings, popups, debris
│       ├── models.js    procedural characters, vehicles, palms, props
│       ├── textures.js  canvas textures
│       └── cinema.js    the causeway at sunset/night/dawn/hurricane
└── dev/  simtest.mjs, browsertest.mjs, play.mjs, shoot.mjs
```

All mutable game state is one plain object (`World.S`), so Instant Replay is a `structuredClone` snapshot per shot. The view reads the state and an event queue; it never writes to the sim.

### Map legend (levels.js)

`.` `,` `;` floor styles · `:` sand · `#` wall · `H` alt wall (containers, brick) · `=` glass · `%` cracked wall · `X` crate · `r` railing · `~` water · `o` manhole · `"` hedge · `_` oil · `T` palm · `O` pillar · `B` bumper · `1`–`4` doors · `S` start · `E` extraction · `I` intel · `$` Vice Tape · `K` terminal · `W` floor switch · `G` target.

---

## Event Catalog (sim → main/view)

`shoot wait turn clack wall bumper break pocket takedown bossHit stun bounce alarm evasion caution sneak suspicious bodyFound wake noise pickup objective allClear switch door hack secure target dart dartHit ricochet spark camBroken camOff laser gunshot bulletHit hurt downed heal revive pulse boom ghost unghost anchor boombox rebank ability noCharge join extract exitLocked carHit rewind won lost`

---

## Changelog

### v1.0.1 (2026-10-14)
- Warmer music mix: a short snare with a pitched body instead of held noise, a smoothed reverb impulse, quiet hats, rounder bass/lead/bell, darker echoes and a lowpass on the music bus.
- Cars sit on a soft contact shadow with a pink or teal underglow instead of a hard slab in the paint colour.
- The story scenes, briefing and title keep the car in frame: the cinema camera aims at the car and places it on a fixed spot of the screen, pulling back on portrait phones.

### v1.0.0 (2026-10-14)
- Ten episodes, seven playable characters, story with painted portraits, garage upgrades, grades and Vice Tapes, Instant Replay, keyboard/gamepad/touch, saves.
- `dev/simtest.mjs` (615 checks: purity, level validity and reachability, physics invariants, every rule, every episode winnable, fair starts, patrols) and `dev/browsertest.mjs`.
