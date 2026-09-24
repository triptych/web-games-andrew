# STARCADET — Game Design Document

**Game:** game-040 · **Working title:** STARCADET
**Genre:** Vertical scrolling shoot-'em-up (shmup) with bullet-hell waves and a rescue mechanic
**Engine:** three.js r165 (CDN import map) · ES modules · no build step · no asset files
**Target:** Desktop keyboard/mouse first, playable on touch. 60 fps on integrated graphics.
**Session length:** ~35–50 minutes for a full six-level run; ~5–8 minutes per level.

---

## 1. One-paragraph pitch

You are **Cadet Theo Vance, callsign Sparrow** — nineteen years old, two weeks from your flight
certification, and the worst shot in your class. When the Chorus arrives at Halcyon Flight Academy,
the instructors die in the first ninety seconds and the only thing left flying is a *trainer*: an
unarmoured Kestrel with practice cannons and a cargo hook meant for towing target drones. Two
hundred and eleven of your classmates are in escape pods falling through the dark. The hook still
works. **STARCADET is a vertical shmup where shooting things is how you survive and hooking pods is
how you win** — a bullet hell in which the score that matters is a headcount.

---

## 2. Design pillars

1. **The rescue is the game.** Every level rains escape pods. Pods drift downward, enemies shoot
   them, and a pod that leaves the bottom of the screen is gone for the rest of the run. Killing
   things is the means; the headcount is the end, and the ending you get is the headcount.
2. **Fair bullet hell.** Tiny visible hitbox, focus mode, telegraphed attacks, bullets that are
   readable against the backdrop at all times, and a bomb that always works. Every pattern in the
   game can be dodged by a player who reads it.
3. **Rescued cadets change your ship.** Each named survivor takes a station on the Kestrel and gives
   you a permanent, mechanical ability. The story's stakes and the build progression are the same
   system.
4. **Escalation you can see.** Six levels, each with a distinct backdrop, palette, enemy roster and
   pattern vocabulary. The Kestrel gets visibly more crowded with crew, drones and guns as it goes.
5. **Nothing is an asset file.** Every ship, bullet, starfield, explosion, portrait, and sound is
   generated in code — consistent with the rest of this repo.

---

## 3. Story

### 3.1 Premise

Halcyon Flight Academy orbits **Ashgate**, a banded amber gas giant at the edge of settled space.
It trains four hundred cadets a year, none of whom have ever seen combat, because there has not
been a war in the lifetime of anyone aboard.

**The Chorus** arrives at 06:41 station time, mid-examination. It is not a fleet. It is a single
kilometres-long tether hung between Ashgate and its moon, and everything that comes off it — the
drones, the weavers, the great singing seeder-hulks — moves to the same rhythm, like parts of one
animal keeping time. The Chorus does not destroy the station. It *collects* it: cadets, instructors,
whole dormitory modules, drawn up the tether to be added to the song.

Sparrow survives because he was in the practice hangar, flunking a gunnery retake.

### 3.2 The protagonist

**Cadet Theo Vance ("Sparrow")** — a good pilot and a bad shooter. His marks are excellent in
towing, docking, and rescue handling: the unglamorous certificates. He is on record with three
written reprimands for "unauthorised flight manoeuvres in the pod yard", which turn out to be the
only relevant training anyone at Halcyon received.

His ship, the **Kestrel T-3**, is a trainer. It carries practice cannons (reduced yield), a tow hook
rated for inert target drones, and a flare launcher for range safety. That is the entire loadout,
and the game never lets him trade up to a warship — he upgrades by *filling it with people*.

### 3.3 The cadets (the reason to keep playing)

Five named classmates are captured rather than killed, one held at the end of each of the first five
levels. Rescuing one gives a permanent Wing Ability; each is also a voice on the comms for the rest
of the run, so the cockpit gets louder and less lonely as you go.

| Cadet | Rescued in | Personality | Wing Ability (permanent) |
|---|---|---|---|
| **Juno Fairweather** | L1 — Hangar Ring | Deadpan engineer, chews a stylus | **Patchwork** — your shield regenerates one segment every 25 s out of combat damage |
| **Piotr "Bastion" Marek** | L2 — Ashgate Descent | Huge, gentle, terrified, does it anyway | **Bastion Drone** — a drone option that mirrors your fire and blocks one bullet every 6 s |
| **Isla Chen** | L3 — Ring Yards | Gunnery top of class, insufferable about it | **Overcharge** — graze fills the Overdrive meter 60% faster |
| **Dahlia "Six" Rook** | L4 — Choir Field | Sixth-year washout, flies like she's angry | **Magnet Wake** — pods and pickups are drawn to you from 3× the distance |
| **Instructor Kel Aramaki** | L5 — Tethercore | Your flight instructor. Taken. Sings on approach | **Second Flare** — bomb capacity +1 and bombs leave a lingering damage field |

Plus **up to 211 unnamed cadets** in pods across the run. The headcount is tracked permanently in the
HUD and decides the ending.

### 3.4 Act structure

| Level | Place | Story beat | Boss |
|---|---|---|---|
| **1** | **Hangar Ring** — the academy's shattered dock ring | The invasion happens around you; you learn the hook on people you know. | **TARPON** — a hijacked cargo loader, claw arms, slow and telegraphed. A tutorial boss with real teeth. |
| **2** | **Ashgate Descent** — into the gas giant's banded cloud deck | Pods are falling *into the atmosphere* and will burn. A timer with a face on it. | **NIMBUS** — a harvester that hides in cloud layers; you fight it through the murk by its lightning. |
| **3** | **Ring Yards** — the shipbreaker yards in Ashgate's rings | Salvage crews have been pressed into the Chorus. The first enemies that used to be people. | **IRONMAW** — a scav-built battleship, four destructible turrets, three phases, no pity. |
| **4** | **Choir Field** — open space thick with seeder-hulks | The bullet-hell level. The Chorus is *singing* and the patterns are the song. | **THE CHOIRMASTER** — conducts; every attack has a visible downbeat you can dodge on. |
| **5** | **Tethercore** — inside the tether itself | Kel is at the core, voice intact, flying against you. The emotional low point. | **WARDEN KEL** — your instructor, in a Chorus-grown shell, using drills he taught you. |
| **6** | **The Long Fall** — the ascent to the Heart, whole station burning below | Everyone you saved flies with you. Final climb. | **THE CHORUS HEART** — four phases, each one a reprise of an earlier boss's signature, then something new. |

### 3.5 Endings (by headcount, evaluated at the Heart's death)

- **< 60 rescued — "Ashes"**: You win. The Chorus dies. Halcyon graduates a class of eleven.
- **60–139 — "Muster"**: Enough cadets to crew one ship. Kel reads the roll and gets through it.
- **140–199 — "Wing"**: The academy reforms in exile. They name the wing after the trainer.
- **200+ — "Every Name"**: All 211. The full roll is read, and the last name on it is yours.

Endings are presented as a post-boss scroll over the burning station with the roll of saved names.

---

## 4. Core mechanics

### 4.1 Movement and the hitbox

- Playfield is a fixed-width vertical arena, **20 × 28 world units**, in the XY plane.
- Ship speed 11 u/s normal, **4.4 u/s focused**. Movement is direct (no inertia) — shmup standard.
- **Hitbox is 0.17 u** (the cockpit dot), against a ship model ~1.6 u wide. Holding focus renders the
  dot as a bright pulsing core plus a ring, so the player can *see* what actually collides.
- Bullets have radii of 0.12–0.45; collision is circle-vs-circle in the sim, with no reliance on
  rendering scale.

### 4.2 Guns

Four weapon types, five power levels each. The current weapon is shown in the HUD with pips.

| Weapon | Feel | L1 | L5 |
|---|---|---|---|
| **Vulcan** (default) | Reliable forward DPS — the yardstick, 60 → 130 dps | 2 streams | 4 streams + 2 angled |
| **Spread** | Crowd clear, 49 → 135 dps but only 1–2 bullets land on one target | 3-way fan | 7-way fan, wider |
| **Lance** | Pierces everything in a line; the boss-killer, 56 → 150 dps | 1 beamlet | 3 beamlets, deeper pierce |
| **Seeker** | Fire-and-forget homing, 50 → 120 dps; every shot lands, lowest ceiling | 2 slow seekers | 6 seekers, faster turn |

Those DPS figures are the actual table in `core/config.js`, and `dev/check.mjs` asserts every
weapon's curve rises strictly with power level.

- **Power items (P)** raise the current weapon one level. **Weapon crystals (V/S/L/K)** swap type and
  keep level (minus one if swapping at max, to discourage spam).
- Dying drops the weapon one level and scatters two power items — a chance to recover, not a spiral.
- **Focus** narrows Vulcan/Spread into a tighter column (higher effective DPS on a single target).

### 4.3 Flares (bombs)

- Start with **2**, max **4** (5 with Kel). A flare:
  - erases every enemy bullet inside a 9 u radius and converts each to score confetti,
  - deals 200 damage in that radius (about 1.5 s of full-power fire), and
  - grants **1.6 s of invulnerability**, starting instantly on the input.
- **Death-bomb window:** 0.2 s after being hit, a flare still saves you. Standard genre courtesy.
- With Kel rescued, the flare leaves a 3 s damage field where it detonated.

### 4.4 Graze and Overdrive

- Passing within **0.75 u** of an enemy bullet without being hit is a **graze**: +30 score each, and
  it fills the **Overdrive** meter.
- Full meter → press **Overdrive**: 6 s of double fire rate, +25% move speed, and all pickups magnetise.
  This is the game's risk-reward dial: the safest way to play is the slowest way to fill it.

### 4.4a Timed power-ups

Four green pickups that drop from the ordinary kill table (and are guaranteed from a midboss).
Each **refreshes rather than stacks**, so the ceiling is knowable, and a death **strips all of
them** — they are power, and power is what a death costs. Every one is announced with its own
sound motif, an on-ship visual, and a HUD chip whose bar drains as the timer runs out (flashing
under 1.5 s, so running out is never a surprise mid-dodge).

| Pickup | Silhouette | Effect |
|---|---|---|
| **SHIELD** | sphere | Absorbs a hit outright instead of costing a life, pops one layer, clears nearby bullets and grants 0.8 s of recovery i-frames. Stacks to **2** layers — the only one that stacks. |
| **INVULN** | dodecahedron | **5 s** where hits are simply refused. Drawn as two counter-rotating rings, deliberately a different shape from the shield bubble so you can tell at a glance which you have. |
| **2x SPEED** | tetrahedron | **8 s** of 1.7× move speed (normal *and* focus) plus a 1.25× fire-rate bump, so it reads as fast rather than just slippery. |
| **ROCKETS** | cone | **12 s** of a rocket pod firing a hard-homing pair every 0.42 s *alongside* your main gun, alternating sides. Each rocket detonates for splash — the answer to a tight formation. |

### 4.5 The rescue loop (the signature system)

- **116 pods across the campaign carry exactly 211 cadets** — each level has a pod budget and a
  cadet budget, and the world distributes that level's cadets across its pods so a full sweep of
  every level returns the whole roll and never one more. A pod:
  - drifts downward at 2.2 u/s (slower than the scroll, so it lingers),
  - has **3 HP** and can be *shot by enemies* — a destroyed pod is dead cadets and a red HUD flash,
  - is collected by flying into it (the tow hook auto-latches within 1.2 u, or 3.6 u with Six),
  - awards 1–4 cadets, +500 score each, and 12% of the time a power item.
- **Pods lost off the bottom of the screen are gone permanently.** The HUD shows `SAVED / LOST`.
- Levels 2 and 6 add **burn timers**: a pod in the atmosphere has 12 s before it is lost regardless,
  with a visible heat ring closing around it.

This creates the central tension: the safe lane is the bottom of the screen, and the pods are
everywhere else.

### 4.6 Lives, continues, and difficulty

- 3 lives (Cadet: 5 / Ace: 2), 3 continues. A continue resets the level's rescue tally but keeps the
  run's headcount — you can never lose cadets you already saved.
- **Cadet / Pilot / Ace** difficulty scales enemy bullet speed (×0.82 / ×1.0 / ×1.18), pattern density
  (−1 arm / base / +1 arm on ring patterns), and enemy HP (×0.85 / ×1.0 / ×1.15).
- Checkpoints: each level starts fresh and is unlocked permanently once cleared (level select on the
  title screen), so nobody has to replay level 1 to practise the Choirmaster.

---

## 5. Enemies

### 5.1 Pattern vocabulary (the shared emitter library)

Every enemy and boss attack is one of these, parameterised. All are deterministic functions of
`(emitter, targetPos, time, rng)` in `js/sim/patterns.js` so they can be unit-tested headlessly.

| Pattern | Shape | Counter-play |
|---|---|---|
| `aimed` | n shots straight at the player | Move perpendicular; it only leads where you *were* |
| `fan` | n-way spread around a heading | Stand in the gap between arms |
| `ring` | n shots evenly around a circle | Move out radially before it expands |
| `spiral` | ring with a rotating offset per volley | Walk with the rotation, never against it |
| `whip` | dense arc swept across an angle | Dodge to the side the whip started from |
| `wall` | line of bullets across the arena with a gap | Read the gap early, commit early |
| `rain` | slow bullets from the top edge at random x | Keep moving laterally; never stop under a column |
| `homing` | slow seekers with a turn cap | Turn tighter than they can — they're dodgeable by circling |
| `laser` | telegraphed beam: 0.8 s warn line, then fire | Leave the line during the warning |
| `nova` | ring that pauses mid-flight then accelerates | Wait out the pause; don't panic into it |
| `flower` | petals of 3 that splay outward as they travel | The gaps widen as it grows — move outward, not inward |
| `cluster` | shells that burst into small rings on a timer | Kill the space between the bursts |

### 5.2 Enemy roster (14 types, introduced progressively)

| # | Enemy | Intro | HP | Behaviour | Fires |
|---|---|---|---|---|---|
| 1 | **Drone** | L1 | 3 | Straight down, fast | — |
| 2 | **Skimmer** | L1 | 5 | Sine sweep across the arena | `aimed` ×1 |
| 3 | **Lancer** | L1 | 8 | Dives at the player's x, then peels away | `fan` 3 |
| 4 | **Turret** | L1 | 14 | Static, mounted on scenery | `spiral` 6 |
| 5 | **Weaver** | L2 | 10 | Figure-eight loop | `ring` 8 |
| 6 | **Popper** | L2 | 6 | Drifts; splits into 3 Drones on death | `nova` on death |
| 7 | **Shieldbearer** | L2 | 24 | Frontal shield absorbs shots from below | `aimed` ×3 |
| 8 | **Sniper** | L3 | 9 | Holds at the top edge, tracks slowly | `laser` |
| 9 | **Carrier** | L3 | 40 | Slow hulk, spawns Drones, **drops 2 pods on death** | `rain` |
| 10 | **Minelayer** | L3 | 12 | Drops dormant mines that nova after 2.5 s | `cluster` |
| 11 | **Reaver** | L4 | 16 | Charges the player at high speed, overshoots | `whip` on pass |
| 12 | **Bloom** | L4 | 18 | Hovers, opens, fires | `flower` |
| 13 | **Choirling** | L4 | 11 | Moves on the Chorus's beat (all in sync) | `spiral` 5, beat-locked |
| 14 | **Seraph** | L5 | 55 | Elite mid-boss-lite, two attack modes | `wall` + `fan` 7 |

Progression rule: **a level introduces at most two new enemy types**, and each new type gets one
low-density wave to itself before it appears in combination. That is the whole difficulty curve.

### 5.3 Bosses

Bosses are data-driven: an ordered list of **phases**, each with an HP threshold, a movement script,
and a cycle of **attacks** (pattern + windup + duration + cooldown). Every attack has a **visible
windup** (the boss flares, a warning shape draws) of at least 0.5 s.

| Boss | HP | Phases | Signature |
|---|---|---|---|
| **TARPON** | 1,700 | 2 | Claw sweep (physical hazard), `fan` volleys, slow `rain`. Teaches windup-reading. |
| **NIMBUS** | 2,500 | 3 | Vanishes into cloud, only lightning shows position; `laser` cross, `wall` with two gaps |
| **IRONMAW** | 3,400 (+360–420 per turret) | 3 + 4 destructible turrets | Each turret killed removes one attack from the cycle — the fight literally gets easier if you aim |
| **THE CHOIRMASTER** | 4,200 | 3 | Everything is beat-locked to the music: `spiral`+`ring` counterpoint, `flower` chorus, a `whip` crescendo |
| **WARDEN KEL** | 4,800 | 4 | Uses *player* mechanics: focus-fire, a flare that erases your bullets, a dodge roll |
| **THE CHORUS HEART** | 6,800 | 4 | Reprises Tarpon/Nimbus/Ironmaw/Choirmaster signatures, then "Every Name": a 24-arm spiral that opens one safe lane per rescued named cadet |

**The Heart's final phase is literally gated on the story**: the number of safe lanes in its last
pattern equals the named cadets you rescued. With all five, it is hard. With none, it is a wall.

---

## 6. Level design

Each level is a **timeline** of cues (`t`, `spawn`), a midboss at roughly 60%, a boss, and a fixed
pod budget. Approximate shapes:

| L | Measured length | New enemies | Pods / cadets | Backdrop |
|---|---|---|---|---|
| 1 | ~3:30 | Drone, Skimmer, Lancer, Turret | 14 / 24 | Hangar ring: wrecked dock trusses, station glow, slow-tumbling debris |
| 2 | ~5:00 | Weaver, Popper, Shieldbearer | 18 / 32 | Ashgate cloud deck: amber bands, lightning in the layers, heat shimmer |
| 3 | ~5:00 | Sniper, Carrier, Minelayer | 21 / 38 | Ring yards: ice-and-rock rings, cut-open hulls, sodium work lights |
| 4 | ~5:00 | Reaver, Bloom, Choirling | 22 / 40 | Choir field: deep violet void, organic seeder hulks, drifting spores |
| 5 | ~6:30 | Seraph | 22 / 41 | Tethercore: a vertical shaft of woven alien cable, lit from inside |
| 6 | ~5:00 | (all, remixed) | 19 / 36 | The Long Fall: the whole station burning below, Ashgate filling the sky |

**Cadet budgets total 211** — the exact number of names on the academy roll. Lengths above are
measured by `dev/balance.mjs` driving a scripted pilot, not estimated; a full campaign runs about
30 minutes.

---

## 7. Presentation

### 7.1 Camera and playfield

Perspective camera at a slight tilt above the plane (not pure top-down) so ships have visible
geometry and the backdrop has parallax. The camera **leans** with the player (±0.6 u) and adds a
small dolly during boss phase transitions. Screen shake on flares, boss deaths, and player death.

### 7.2 Rendering

- **Bloom** (`UnrealBloomPass`, threshold ~0.82) over emissive/additive materials — bullets, engines,
  explosions glow; the backdrop stays crisp.
- **Bullets are instanced.** One `InstancedMesh` per visual kind (orb, dart, petal, shard, laser,
  mine, wave) with per-instance colour, holding 2,000 instances each. No per-bullet meshes ever.
- **Ships are procedural meshes** assembled from primitives + emissive trim, built once per archetype
  and cloned.
- **Backdrops are `ShaderMaterial` planes**, one per level, animated by a `uTime` uniform: nebula FBM,
  banded atmosphere with lightning flashes, debris parallax, organic pulsing veins, tether cables.
- **Three parallax star layers** as `Points`, scrolling at different rates, recycled at the top.
- **Explosions**: three staged layers so a blast reads as a detonation rather than a puff of smoke —
  a white-hot core that cools to the enemy's colour (per-vertex colour, so the middle is genuinely
  overexposed and the bloom pass catches it), a slower ring of gravity-affected debris, and two
  shockwave rings of different colour and timing giving the blast a front and a wake. Plus a light
  flash and a hit-stop of 0.06 s on big kills.

### 7.3 Readability rules (non-negotiable)

1. Enemy bullets are **always warm** (amber → magenta → white-hot); player bullets are **always cool**
   (cyan/mint). No level palette may break this.
2. **Pickups are always green, and nothing that can hurt you ever is.** The hue wheel is split three
   ways — warm = danger (enemy fire, beams, claws, enemy hulls), green = collectable, cyan = you.
   Because hue no longer distinguishes one pickup from another, **shape does**: each pickup type has
   its own silhouette (cone = rockets, tetrahedron = speed, torus = 1UP, sphere = shield, …).
   `dev/check.mjs` enforces this against the real colour values: every pickup must be green-dominant,
   no enemy-fire or hazard colour may be, and the two sets may not share a single hex.
3. Bullets render on top of everything (`depthTest: false`, high `renderOrder`).
4. The backdrop never exceeds 45% brightness of the dimmest bullet.
5. Every windup is a distinct colour flash on the emitter plus a ground-truth warning shape.
6. **A boss never teleports** unless it is a declared ability that announces itself (Kel's blink,
   Nimbus leaving the cloud). Movement curves are eased onto, never assigned.


### 7.4 Audio

Fully procedural Web Audio: a pulse-wave lead for the Chorus's motif, filtered-noise explosions,
a rising saw for boss windups, a soft chime for pod rescue (major third — the only pure-consonance
sound in the game), and a detuned drone bed per level. Music is beat-synced to level 4's patterns:
the Choirmaster's attacks land on the downbeat by construction.

### 7.5 UI

- Top-left: score, headcount `SAVED 41 / LOST 3`. Top-right: lives, flares, weapon + power pips.
- Bottom: Overdrive meter. Boss: a segmented HP bar per phase at the top.
- Comms: a small portrait panel (procedurally drawn helmet + visor colour per cadet) with one or two
  lines, during play, never blocking the playfield centre.
- Between levels: a briefing screen with the roll so far, the new Wing Ability, and the next objective.

---

## 8. Controls

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Pointer (ship follows) | Drag anywhere, **relative** |
| Fire | Auto (or Z / Space) | Auto | Auto (forced on) |
| Focus | Shift | Right button held | FOCUS button, or two-finger hold |
| Flare | X | Left button | FLARE button |
| Overdrive | C | Middle button | OD button |
| Pause | Esc / P | — | Pause button (top-right) |

Auto-fire is on by default; manual fire exists for players who want it. Every action is rebindable
in the options panel. Touching a movement key hands control back from the pointer, so a stray mouse
movement never strands a keyboard player.

### 8.1 Touch, specifically

The phone build is not the desktop build with bigger buttons; the control scheme is different where
it needs to be:

- **Dragging is relative, not absolute.** The ship moves *by* the finger's travel, not *to* the
  finger. A thumb anywhere on the glass flies the ship, the ship never teleports to a new touch, and
  the hand is never parked on top of the bullets it is dodging. Overshoot at the arena wall is
  absorbed into the anchor, so dragging back is immediate rather than dead for the first centimetre.
- **Two thumbs, two corners.** FOCUS / OVERDRIVE / FLARE stack in the bottom-left for the left
  thumb; the right thumb flies. Pause sits top-right, away from where a thumb rests.
- **Auto-fire is forced on touch** — there is no fire button by design, so the option cannot strand
  a player with a ship that will not shoot.
- **Every control is at least 44px**, including the menu buttons and the launcher link.
- **Quality tiers.** Touch devices start one tier down (a smaller pixel ratio, softer bloom, three
  FBM octaves in the backdrop instead of five) and drop another automatically if the frame rate
  will not hold for three consecutive samples. Options → GRAPHICS overrides it.

---

## 9. Technical architecture

```
game-040/
  index.html            import map, HUD DOM, overlays
  js/
    core/     config · rng (mulberry32) · events · state · input · save
    sim/      PURE LOGIC, no three.js import anywhere:
              patterns · enemies · bosses · levels · player · pods · powerups · world · collide
    view/     scene · backdrop · models · bullets (instanced) · fx · text3d · render
    ui/       hud · menus · comms · briefing
    audio/    sounds (Web Audio)
    main.js   state machine + loop
  dev/        fake-three shim + Node harnesses (check/simtest/rendertest/balance)
```

**The hard rule that makes this testable:** `js/sim/**` never imports `three` and never touches
`document`. The world is a plain object of arrays; the view reads it each frame and syncs meshes.
This is what lets the Node harnesses run the *real* game logic — full levels, full boss fights — with
no browser, and lets `rendertest.mjs` run the *real* render layer against a fake three.js that throws
on NaN positions and undefined materials.

**Determinism:** the sim takes a seeded RNG and a fixed timestep (`1/120 s` accumulator), so a level
replays identically given the same input trace. Balance numbers in this document are produced by
`dev/balance.mjs` running scripted bots, not by guesswork.

---

## 10. Build plan

See [game-plan.md](game-plan.md) for the phase checklist and status.

## 10a. Measured balance (dev/balance.mjs, "pilot" difficulty)

Three scripted bots with different priorities play every level. The spread between them is the
skill gradient the design claims to have — you can buy cadets with risk:

| Bot | Priorities | Deaths across the campaign | Cadets recovered |
|---|---|---|---|
| **scared** | dodges first, collects only what comes to it | 17 | 133 / 211 (63%) |
| **pilot** | balances dodging and pods, focuses under fire | 16 | 152 / 211 (72%) |
| **greedy** | goes for every pod, barely dodges | 98 | 206 / 211 (98%) |

Peak on-screen enemy bullets per level, same harness: 87 · 81 · 153 · 221 · 178 · 219. Boss HP is
set from *measured* effective DPS (a dodging pilot lands 35–45% of nominal), not from perfect
uptime, which is why a boss fight lands around 50–80 seconds rather than 15.

## 11. Open questions

- Should losing every pod in a level fail it outright? *(Current answer: no — the headcount already
  punishes it, and a fail state would push players toward restarting rather than living with it.)*
- Does the Heart's lane-gating feel like a reward or a lockout for a player who saved nobody?
  *(Mitigation: the phase is beatable with zero lanes, just brutally; a 45 s soft timer opens one.)*
