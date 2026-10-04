# Hivebreaker — game plan

**Genre:** top-down twin-stick shooter (Enter the Gungeon × Alien Breed × Alien Swarm), roguelite-lite campaign
**Engine:** three.js r165 (importmap from unpkg), vanilla JS modules, DOM UI, Web Audio. No asset files: every model, texture, portrait, sound and song is generated in code.
**Targets:** desktop (mouse + keyboard, or a gamepad) and phones (touch only, twin virtual sticks, portrait and landscape).

## Pitch

Fort Kessler is a black-site military research base buried in the ice of
Erebus, a moon nobody is supposed to know about. Seventy-two hours ago it went
silent. Its last transmission was a scream and a sound like a thousand
fingernails on steel. Among the staff was **Ellie Calder**, nineteen, an intern
in the xenobiology division and the President's daughter.

Command could have sent a battalion. A battalion would take nine days. You are
**Warden**, a lone Colonial Marine dropped onto the landing pad with a pulse
rifle, a flashlight and a voice in your ear. Go down through five sectors of
an infested base, burn out the bug-like Brood that nests in it, find Ellie and
get her out before the base's self-destruct takes the whole moon's crust with
it.

It plays like Enter the Gungeon's rooms (doors seal, waves pour in, the room
clears, loot drops) with the mass swarms of Alien Breed and Alien Swarm:
hundreds of skittering bugs flooding out of vents towards your flashlight.

## Core loop

1. **Explore** a procedurally generated sector: rooms joined by corridors,
   drawn on a minimap as you go.
2. **Enter a combat room**: the blast doors slam shut, vents and hive breaches
   glow, and two or three waves pour out. Kill everything; the doors open and
   the room drops its reward.
3. **Loot**: salvage (currency), ammo, medkits, armour plates, grenades,
   Shock Pulse charges, timed power-ups, weapon crates and Mod Chips that
   upgrade the gun in your hands.
4. **Spend** salvage at the Supply Depot terminal, heal once at the Med Bay,
   read data logs on terminals (the story).
5. **Boss**: each sector ends in a sealed arena with a multi-phase boss that
   fires dodgeable bullet patterns. Beat it, pick one of three **Field
   Upgrades** (permanent perks for the run), and take the elevator down.
6. Sector V ends with the Brood Mother and Ellie, then a timed **escape** to
   the dropship with Ellie following you.

Death sends you back to the start of the sector with the loadout you had when
you arrived (the save is taken at each elevator). Difficulty decides how
forgiving that is.

## Moment to moment

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | left stick | left virtual stick (floating) |
| Aim | mouse | right stick | right virtual stick (floating) |
| Fire | left mouse (hold) | RT, or push the right stick (setting) | push the right stick past 40% |
| Dodge roll | Space / Shift | A / LB | ROLL button |
| Grenade | right mouse / G | LT | GRENADE button (thrown along aim) |
| Shock Pulse | Q | B | PULSE button |
| Interact | E / F | X | contextual USE button |
| Reload | R | X (hold) / auto | automatic on empty |
| Swap weapon | wheel / Tab / 1–4 | Y / RB | tap the weapon panel |
| Map | M | Back | tap the minimap |
| Pause | Esc / P | Start | ❚❚ button |

- **Dodge roll** (Gungeon): 0.32 s of 13 m/s movement with invulnerability
  frames, 0.55 s cooldown. Rolling through bullets is the core skill.
- **Shock Pulse** (Gungeon's blank): erases every enemy bullet within 9 m,
  knocks back and stuns nearby bugs. Two per sector, carry up to three.
- **Hit invulnerability**: 0.7 s after a hit, so a swarm cannot nibble you to
  death in one frame.
- **Armour** absorbs two-thirds of incoming damage until it is gone.
- **Aim assist** on touch and gamepad: the aim snaps to the nearest enemy
  inside a 22° cone.

## Weapons (carry four)

Every weapon has three marks. A **Mod Chip**, or finding a gun you already
carry, raises the current gun's mark: Mk II is +30% damage and +15% rate,
Mk III also adds the weapon's special.

| Weapon | Feel | Mk III special |
|---|---|---|
| M41 Pulse Rifle | starter, infinite reserve, 40-round mag | every 6th shot is a micro-grenade |
| Scattergun | 8 pellets, heavy knockback | pellets ricochet once |
| Flamethrower | short cone, pierces, sets bugs burning | blue flame: double burn, longer reach |
| Smartgun | fast homing bullets | bullets fork on kill |
| Arc Caster | chain lightning, 3 jumps | 6 jumps, stuns |
| Rail Lance | charge 0.6 s, piercing hitscan beam | the beam detonates where it ends |
| Grenade Launcher | bouncing grenades | each splits into 4 bomblets |
| M56 Minigun | spins up, 26 rounds/s | incendiary rounds |
| Plasma Cannon | slow orb that ploughs through swarms, big blast | the orb arcs lightning as it flies |

## The Brood (enemies)

Bug-like aliens, every one a merged procedural mesh drawn in a single
instanced draw call per type, legs and mandibles animated in the vertex shader
so hundreds can be on screen at once.

| Bug | Role |
|---|---|
| Skitter | tiny, fast, comes in swarms of 30–80 from vents |
| Drone | the warrior: stalks, rears back, lunges |
| Spitter | keeps its distance, fires spreads of acid bullets |
| Bloater | slow; bursts into acid and a lingering pool |
| Burrower | dives under the deck plating, erupts under you in a ring of spines |
| Brute | armoured front, charges in a line; stunned against walls (double damage) |
| Husk | an infested soldier: shambles, fires aimed bursts of slow rounds |
| Wasp | flies erratically, swoops |
| Stalker | cloaked shimmer until close, then fast slashes |
| Brood Sac | a pulsing nest that births skitters until destroyed |

**Alphas** (larger, glowing, triple HP, better drops) appear from Sector II and
grow common. Enemies arrive from telegraphed vents and breaches (0.7 s glow
before they can act), so a swarm is never an unfair spawn on top of you.

## Sectors and bosses

| # | Sector | Look | New threats | Boss |
|---|---|---|---|---|
| I | Hangar Deck | blue steel, hazard stripes, cargo | skitters, drones, spitters | **Ravager** — a giant charging beetle: telegraphed charges, stomp rings, skitter calls |
| II | Barracks & Armory | amber, lockers, sandbags | husks, brutes, burrowers | **Goliath** — an infested walker mech: minigun sweeps, missile volleys, then its armour breaks |
| III | Bio-Research Labs | white and teal, specimen tanks | bloaters, wasps, brood sacs | **Specimen Zero** — blinks, spirals, splits off clones at 66% and 33% |
| IV | Reactor Core | orange, coolant, red alarms | stalkers | **Magma Widow** — a fire spider: fireball fans, egg sacs, eruptions, a burning ring |
| V | The Hive | organic purple creep over everything | everything, many alphas | **The Brood Mother** — three phases of spirals, egg barrages and endless swarms |

After the Brood Mother: **Escape**. Ellie is freed and follows you (she picks
up a sidearm and helps), the base self-destruct counts down from 2:30 and the
swarm pours out of every vent along a long route to the landing pad.

## Sector generation

- A sector is a 5×4 grid of macro cells (24 tiles each, 1 tile = 1 m). A
  random spanning tree over the cells, plus a few loops, gives the room graph.
- Each room is a rectangle inside its cell (11–18 tiles a side; the boss
  arena 20×18). Corridors are 4 tiles wide, L-shaped when rooms do not line up,
  and meet rooms through blast doors.
- Room roles: Start (elevator arrival), Combat (most), Treasure (weapon crate),
  Supply Depot (shop terminal), Med Bay, Archive (data log + loot), Boss
  (farthest from the start by graph distance, with the exit elevator).
- Props per theme: crates, explosive barrels, pillars, consoles, lockers,
  server racks, specimen tanks (breakable, they release a bug), cocoons,
  coolant pipes. Destructible props drop salvage and ammo.
- Wave budgets scale with sector, room area and difficulty; a "swarm wave" is
  mostly skitters.

## Pickups, power-ups and the economy

- **Salvage** from bugs and crates, spent at the Supply Depot (medkits,
  armour, ammo, grenades, a Shock Pulse, a Mod Chip, a weapon, a random
  power-up stim).
- **Timed power-ups** (holograms): Overdrive (double damage), Hyperfire
  (+60% rate, no reloads), Aegis (invulnerable bubble), Sentry Drone (an
  orbiting gun drone), Stim (speed and faster rolls), Cryo (all bugs slowed),
  Nova (instant blast).
- **Field Upgrades** after every boss (choose 1 of 3, 16 in the pool):
  plating, kinetic rounds, quickhands, ricochet, combat roll, scavenger,
  leech, demolitions, volatile biology, crit optics, companion drone,
  adrenal gland, pulse capacitor, magnet, thick hide, second wind.

## Story

Told by radio, data logs and short sector cards (all text in `js/story.js`).

- **OVERWATCH** (Major Adaeze Okoye, aboard the frigate *Valkyrie* in orbit)
  talks you down, reacts to the bosses and gets increasingly worried.
- **Ellie Calder** transmits on an emergency band: hiding in the labs, then
  taken, then a weak signal from deep in the hive.
- **Dr. Silas Harrow**, head of xenobiology, in recovered logs: the queen was
  brought here on purpose, to be weaponised; the containment "accident" was
  not one.
- Five sector cards set each act; the ending crawl changes with difficulty
  and a few run stats.

## Modes and difficulty

- **Campaign**: five sectors + escape. Recruit (more HP, slower bullets,
  more drops), Marine, Nightmare (more bugs, faster bullets, alphas
  everywhere).
- **Horde Mode** ("Infestation Protocol"): one big arena, endless escalating
  waves, a weapon crate every five waves; high score saved.
- Saves at each elevator; Continue restarts the current sector with that
  loadout.

## Presentation

- **Camera**: perspective, ~58° pitch, follows the marine with a lead toward
  the aim; zoom fits ~22 m across landscape, more height in portrait.
  Screen shake, hit-stop on big kills.
- **Lighting**: a per-sector baked lightmap (lamps per room, traced with line
  of sight, alarm and flicker flags animated in the shader) applied to floors,
  walls, props and bugs; the marine's flashlight (shadowed on high quality);
  a pool of dynamic lights for muzzle flashes and explosions.
- **Shaders**: a procedural deck-plate floor (panels, rivets, grates, hazard
  stripes at doors, hive creep with pulsing veins, a fog of unexplored rooms),
  procedural wall panels with light strips that fade around the marine so
  walls never hide you, vertex-animated bug legs, hit flash and glowing eyes,
  a persistent decal canvas for acid, blood and scorch marks, GPU particles
  (sparks, fire, smoke, gibs, embers), noise-displaced fireballs, shockwave
  rings, tracers, glowing bullet orbs, a beam shader, and a post stack of
  bloom, chromatic aberration on blasts, damage vignette, low-health
  desaturation, film grain and scanlines.
- **Audio**: synthesised weapons (each its own voice), explosions with a sub
  thump, chitters and screeches, door hiss, radio static, and a generative
  dark-synth score per sector that adds drums when the doors lock and a
  distorted lead for bosses.
- **HUD**: segmented health and armour, weapon panel with ammo, mag and
  reload ring, slot strip, grenades and pulses, salvage, minimap, boss bar,
  radio box with procedural portraits, objective line, banners.

## Architecture

```
game-057/
  index.html  style.css  game-plan.md
  js/config.js        tuning: player, weapons, enemies, sectors, perks, power-ups, shop
  js/story.js         every line of story text
  js/sim/rng.js       mulberry32 + hash (no Math.random in the sim)
  js/sim/level.js     procedural sector / arena / escape generation
  js/sim/world.js     the simulation: player, bullets, rooms, waves, pickups, events
  js/sim/enemies.js   bug behaviours
  js/sim/bosses.js    five boss behaviours
  js/sim/bot.js       an auto-player (tests, balance, title attract mode)
  js/sim/meta.js      save / load
  js/view/scene.js    renderer, camera, post stack, quality
  js/view/level.js    floor/wall/prop meshes, lightmap, decals
  js/view/actors.js   marine, bug instancing, bosses, Ellie
  js/view/fx.js       GPU particles, bullets, explosions, beams, light pool
  js/view/view.js     sim → scene sync, events → effects
  js/view/portraits.js procedural radio portraits and weapon icons
  js/audio.js         SFX + generative music
  js/ui.js            DOM HUD, menus, touch controls
  js/main.js          boot, state machine, loop, input, saves
  dev/simtest.mjs     headless: purity, invariants, determinism, generation, bot campaign
  dev/browsertest.mjs Playwright: desktop flows + touch-only phones, no console errors
```

`js/sim/` never imports three.js, never touches the DOM and never calls
`Math.random`, so a sector replays exactly from its seed and the bot can play
the campaign in Node.

## Testing

- `simtest.mjs`: purity scan; many seeds of every sector generate connected
  maps with every room role; per-tick invariants (finite numbers, nothing
  inside walls, HP ≤ max); determinism; save round-trip; every weapon fires
  and every enemy and boss acts and dies; a bot campaign through all five
  sectors and the escape, with a damage-taken table per sector.
- `browsertest.mjs`: title → new campaign → intro → move, aim, fire, roll,
  grenade, pulse → a locked room cleared → pickups → shop → boss (debug jump)
  → field upgrade → elevator → escape → victory; horde mode; touch-only phones
  in portrait and landscape; zero console errors.
