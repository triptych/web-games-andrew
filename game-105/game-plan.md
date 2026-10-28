# SOLDER & RAIN

**Genre:** repair-bench sim with a mystery (Assemble With Care × Blade Runner)
**Engine:** three.js r165, no asset files. Plain ES modules, no build step.
**Status:** v1.0.0 in progress

---

## Concept

You inherit your missing father's repair shop on Perihelion Reach, a space station where the climate machines broke eleven years ago and it has rained ever since. Customers bring blasters, hover-coils, drones, cyborg arms and ocular implants. You open each one at a bench under a work lamp, find what is wrong, fix it by hand and put every screw back. Inside the machines you find what Dad hid there, and why Meridian Cybernetics wants it.

Minute to minute it is calm, tactile work: hold a driver on a screw until it spins out into the dish, lift a cover, follow the coloured cables, probe a part with the meter, solder a joint with the heat in the green, swap a burnt capacitor for the right one from a drawer of near-misses, then close it all up and press **Test**. Between jobs the shop, the rain and a one-wheeled bench bot called Spanner carry a six-day story.

## Core loop

One job: a customer arrives and describes the fault → the work order → at the bench: diagnose, open, repair, close → the power test (the power travels along the cables and stops at the first fault) → marks and pay → the customer's reply, sometimes a clue. A day is two or three jobs; at closing time you spend credits on upgrades.

## Mechanics

### Devices are built from slots, parts and cables
A device (`js/sim/device.js`) is a tray with **slots** at four layers: modules and the board (1), parts on the board (2), brackets (3), cover panels (4). A part can leave its slot only when **nothing is fastening it** (every screw out), **nothing is plugged into it**, and **nothing is covering it** (no occupied higher-layer slot overlaps its footprint). A board carries its parts with it when lifted. The same rule decides what can be dropped back in. Ten kinds × five tiers; the generator sizes the tray to its contents, packs modules, wires them with unique-coloured, lettered cables, adds covers and brackets, picks the faults and writes a spares drawer containing the right part and decoys.

### Faults and their remedies
| Fault | How it looks | Fix |
|---|---|---|
| burnt / cracked | visibly charred or cracked | replace from the spares drawer; the spec on the label must match |
| dead | looks fine; only the **meter** shows it (tier 3+) | replace |
| corroded, clogged | green crust, grey fuzz on a fan | **brush**, with movement |
| seized | stiff servo, gears, actuator; rust | **oil** |
| rusted bolt | orange head | oil it first |
| bad solder joint, severed cable | dull joint, bare copper | **iron**: keep the heat gauge in the sweet spot; too hot burns |
| unplugged cable | a plug lying loose | plug it into the socket with the same colour and letter |

### Tools
Hands, driver (Phillips/slotted), ratchet (8/10/13 mm), pry tool (clips), tweezers (small parts), iron, brush, oil, meter. **Smart tools** (default) pick the right tool, bit and socket for what you touch; *Choose my own bits* in Settings makes a wrong bit slip. Hold a tool on something to work; slide to the next screw with the button held to chain them. A quick tap on a part lifts it and **sticks it to the cursor**; tap again to put it down (it snaps to its slot when close; a ghost shows where it goes).

### The test and the marks
**Test** evaluates the whole device: every part present, sound, clean, free, fastened; every cable plugged and whole. The power then lights the flow in order and stops at the first failure with a hint about the *stage* (power, motion, optics...), never the part. ★ it works · ★★ a tidy bench (nothing loose) with at most two failed tests · ★★★ the job's extra (a clean) done, no burns, few slips. Pay = fee × (0.8 / 1 / 1.18) − spare parts, plus a tip and 10 cr for anything hidden that you found.

### The governor
From day 3 some machines carry a **Meridian governor chip** ("the leash"). You can pull it with tweezers (it goes in the bin) or leave it. It changes dialogue, Corwith's audit on day 5, and the ending text.

## Content

- **Devices:** noodle-bot arm, tube radio, hover-coil unit, courier drone, service blaster, nav console, cybernetic arm, service-bot head, ocular implant, Spanner himself (tier 5).
- **Modules:** cell, fuse, capacitor, chip, servo, gear train, fan, lens, relay, coil, speaker, actuator, display, switch, board, governor chip.
- **Upgrades:** power driver, fine-tip iron, ultrasonic brush, autoranging meter, wholesale account; a fern, a robot cat, a holo-frame.

## Story

Six days. Day 1 *Open for Business* (Mama Okoye's noodle-bot; Dad's note). Day 2 *Static* (Dex's hover-coil; a locker tag hidden under the controller board; Corwith's visit). Day 3 *Blue Division* (Takeda's blaster; the first governor). Day 4 *The Hush* (Dr. Sól's arm). Day 5 *Lantern* (Lila-9's eye holds Dad's shunt; Barnacle says Dad is alive; Spanner confesses the resonator is in him). Day 6 *The Key* (you open Spanner; Dad's message; Corwith at the door). Three endings, chosen at the end: broadcast the Unhush, hide the Key and keep fixing, or hand it over. Fourteen clues on the case board; every one is reachable.

## Controls

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Work a tool | hold the button on a thing | hold a finger |
| Lift / put down | click, click | tap, tap |
| Orbit / pan / zoom | drag bare bench / right-drag / wheel, Q E Z X | drag bare bench / two fingers |
| Tools | 1–9 | the tool bar |
| Test / hint / reverse | T / H / R | buttons |
| Pause | P / Esc | ☰ |

## Look and sound

Neon noir: a dark shop with a bench lit by one work lamp (real shadow), a rain-streaked window onto a layered neon skyline, flying cars, a holographic Meridian ad, a pegboard and shelves. A PMREM environment generated from a tiny neon scene gives the metal something to reflect. Post: bloom → grade (aberration, grain, vignette) → output. Every texture is drawn on a canvas; every model is built from merged primitives. Portraits are drawn on a 2D canvas. Sound is all Web Audio: a generated D-minor score (pads, bass, a lone lead), rain and thunder, and a recipe per event (ratchet ticks, screw pings, the *clunk* of a part seating, solder sizzle, the meter, the power-up flow).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the loop, input routing, pointer → sim commands, debug hooks |
| `js/sim/modules.js`, `kinds.js` | The parts catalogue and the ten device kinds |
| `js/sim/device.js` | The generator and `validate` |
| `js/sim/rules.js` | Covering, lifting, snapping, tools, `evaluate` |
| `js/sim/job.js` | A repair on the bench: commands (`jobAct`) and held tools (`jobStep`), the test, the marks |
| `js/sim/plan.js`, `bot.js` | The planner (hints and bot) and the auto-player |
| `js/sim/shop.js`, `story.js` | Days, customers, dialogue, pay, upgrades; all the words |
| `js/sim/game.js` | `newGame`, `act`, `step`, save/load |
| `js/view/` | `view.js` (renderer, camera, picking, sync), `models.js`, `wires.js`, `room.js`, `fx.js`, `tools3d.js`, `portraits.js`, `textures.js`, `kit.js` |
| `js/ui.js`, `input.js`, `audio.js`, `save.js` | DOM screens, input merge, sound, guarded storage |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the generator over many seeds, every rule, that the bot can repair every generated job and play the whole story to each ending, and that hints are always possible. `browsertest.mjs` drives the real game with a real mouse on desktop and real touches on phones in both orientations, and with storage blocked.

## Balance notes

The bot (which always finds the faults, an oracle) earns 2–3 stars on every job; 153 of 216 sweep jobs reach three. A whole campaign takes it about five minutes of sim time and ends with ~1350 credits, enough for every upgrade, so credits are a comfort not a gate. A human takes roughly a minute per screw-heavy job step-by-step, around 45–75 minutes overall.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU (bloom and shadows especially).
- More device kinds and a night-market shop for rare spares.

## Changelog

### v1.0.0
- First release: six-day campaign, Free Bench, ten procedural device kinds, nine tools, the case board, upgrades, three endings.
