# Wakeform — game-039

An Atari-2600-shaped science fiction arcade game built around one original mechanic.
Vanilla HTML/CSS/JS. No libraries, no asset files. Every pixel is drawn in code and
every sound is synthesised with the Web Audio API.

## The premise

You are a maintenance probe inside the containment ring of a dying starship reactor.
The reactor core is leaking **motes** — charged fragments of exotic matter that drift
inward. If enough of them reach the core, containment fails.

Your probe has no weapon. It has exactly one capability: it can **invert its own
polarity**.

## The mechanic: the wake

This is the whole game and it is the part that is new.

1. Your probe is always either **positive** or **negative**. One button flips it.
2. As you fly, you continuously shed **echoes** — frozen copies of your probe at the
   position and polarity you had at that instant. Your movement history is physically
   present on the board.
3. Echoes are not decoration. Each echo exerts the *same* polarity force your probe
   does. Motes of like polarity are pushed away; motes of opposite polarity are drawn
   in and, on contact, absorbed for score.
4. Echoes decay over time. The board breathes.
5. Flying back through your own echoes **reclaims** them: you recover the field energy
   and clear the space. This is how you edit your own past.

So the player is not shooting and not dodging. The player is *drawing a machine* — a
standing lattice of polarity that keeps working after they have flown away, composed
entirely out of where they have been and what colour they were when they were there.

Why this is not a clone:
- It is not Ikaruga/Polarity: there is no shooting and polarity is not damage-typed
  bullet immunity; polarity is a field that persists in space after you leave.
- It is not a trail/territory game (Snake, Qix, Tron): the trail is not a wall and not
  an area claim; it is an active force emitter with a state you authored.
- It is not a ghost-replay time game (Braid, The Misadventures of P.B. Winterbottom):
  echoes do not re-enact your actions, they hold a single frozen instant forever.

## Depth: why it takes time to master

The naive player flies at motes and absorbs them by hand. That scores, slowly.

The skilled player learns:
- **Funnels.** A line of same-polarity echoes is a wall that steers motes sideways.
  Two converging walls make a funnel that delivers motes to one point.
- **Traps.** End a funnel in a knot of *opposite* polarity echoes and motes are pulled
  in and held, orbiting, until you come collect them.
- **Chains.** Absorbing motes in rapid succession builds a multiplier. Traps exist so
  you can bank a dozen motes and then harvest them in one pass for a huge chain.
- **Charge economy.** Every echo you shed costs **flux**. Flux regenerates slowly, and
  reclaiming echoes refunds it. So an elaborate lattice you never revisit will starve
  you. Good play is a loop: build, harvest, reclaim, rebuild.
- **Polarity debt.** Flipping polarity costs a little flux too, so a lattice that
  alternates every few pixels is expensive. Efficient shapes are long single-polarity
  strokes — which means planning your route before you fly it.

## Failure and progression

- Motes that reach the core damage **containment** (5 bars). At zero, the run ends.
- Waves escalate: more motes, faster drift, and new mote classes.
- Mote classes (all procedurally drawn, all readable as 2600-era blobs):
  - **Drifter** — plain, drifts inward.
  - **Splitter** — repelled hard enough, it splits into two weaker motes.
  - **Inverter** — flips polarity periodically; your lattice must handle both.
  - **Leech** — attracted to echoes and eats them. Punishes lattices you abandon.
  - **Anchor** — immune to force, must be absorbed by hand. Forces you out of the nest.
- Every 5th wave is a **surge**: a dense burst from one arc of the ring.

## Controls

- Arrows / WASD / left stick region of screen: thrust.
- Space / tap / button: **invert polarity**.
- Hold Shift / second button: **silent running** — stop shedding echoes (saves flux,
  lets you reposition without ruining a lattice).
- P / Esc: pause. Pause is also the save/load screen.

Touch: left half of screen is a virtual thumb-stick, right half taps to invert,
long-press for silent running.

## Presentation (Atari 2600 idiom, procedurally generated)

- Fixed low-res internal buffer (160x192, the actual 2600 resolution) scaled up with
  nearest-neighbour. Everything is drawn into that buffer.
- Hard 8-colour palette drawn from the 2600's NTSC ramp, chosen per-run from a seed.
- Chunky 2:1 pixels, no antialiasing, no gradients, visible scanline overlay.
- Sprites are generated at load time into offscreen canvases from seeded bitmasks, so
  the probe, motes and core look different every run but always read as 2600 sprites.
- Playfield background is a symmetric 2600-style playfield pattern generated from the
  run seed (the 2600 drew mirrored 20-bit playfields; we do the same).
- Score/containment shown in a generated blocky digit font, no web fonts.

## Save / load

Three named slots in localStorage plus an autosave written between waves.
A save captures the full live board: probe position/velocity/polarity/flux, every echo
(x, y, polarity, age), every mote (x, y, velocity, class, polarity), wave number,
score, chain state, containment, and the run seed (so the generated palette, playfield
and sprites are identical on load).

Slot UI lives in the pause overlay and on the title screen.

## Module layout

```
game-039/
  index.html
  styles/base.css
  js/
    main.js            bootstrap, canvas, loop
    core/bus.js        event bus
    core/rand.js       seeded PRNG
    core/util.js       math helpers
    core/input.js      keyboard + touch
    game/constants.js  tunables
    game/state.js      run state singleton
    game/probe.js      player probe + flux
    game/wake.js       echo field: shed, decay, reclaim, force query
    game/motes.js      mote classes, spawning, physics
    game/waves.js      wave composition and escalation
    game/scoring.js    chains and multipliers
    game/save.js       slots, serialise/deserialise
    render/palette.js  seeded 2600 palette
    render/sprites.js  procedural sprite generation
    render/playfield.js seeded background pattern
    render/draw.js     the frame
    render/hud.js      blocky digits, containment bars
    audio.js           synthesised 2600-ish sound
    ui/screens.js      title, pause, save slots, game over
```
