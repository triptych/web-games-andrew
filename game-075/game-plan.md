# CHROME CHALICE — Quest of the Neon Square

**Genre:** Arcade action-adventure. Atari *Adventure* (1979) reimagined as a 1988 coin-op.
**Engine:** none. Vanilla ES modules, Canvas 2D for the game, hand-written WebGL for the CRT, DOM and CSS for the cabinet, Web Audio for every sound and note.
**Target:** any screen from a 360 px phone to a desktop monitor; keyboard, gamepad or touch.
**Status:** v1.0.0, complete: six realms, a boss, an ending and endless loops.

---

## Concept

*Adventure* put a square on a screen, gave it a sword, a key and three dragons, and asked it to carry a chalice home. Ten years later the arcades are full of neon and chrome, the music is a drum machine and a detuned synth, and every game has a boss. **CHROME CHALICE** is what *Adventure* might have become if it had been remade for that arcade.

You are **SQUIRE**, a square of light. The **Chrome Chalice**, the cup that keeps the sun rising over the Grid, has been stolen by **CHROMAGON**, a dragon of liquid metal, and hidden at the top of his Citadel. Six realms lie between you and it. In each, a chalice (a shard of the real one) is locked inside a keep, and you must carry it back to your own keep, the **Sunset Keep**. Dragons hunt you, a bat steals what you carry, and if you dawdle the realm starts to **glitch**.

The rules are *Adventure*'s rules. You carry **one thing at a time**, held where you picked it up. Keys open castles. The sword kills dragons. The magnet pulls things to it. The bridge crosses what you can't. A dragon that catches you swallows you whole. The bat swaps what it carries for what you hold. Somewhere there is a grey pixel.

What a decade of arcade games adds:

- **Score, lives, extra lives, high scores with initials, attract mode, credits and continues.**
- **Six realms** with their own look, music and mechanics: open fields, a blue labyrinth, dark catacombs, data rivers, teleporters and laser gates, and a citadel.
- **Combat.** A sword slash, a dash with invulnerability frames, dragons with health that breathe fire and ice, and a three-phase boss.
- **New tools:** the lamp, the crystal shield and the plasma charge, plus gems, batteries, 1UPs, chrome shards and a hidden cassette in every realm.
- **THE NULL.** Stay too long in a realm and a hole of static starts hunting you through the walls.
- **A minimap**, room names and an objective line, so the puzzle is about routing, not getting lost.

It should look and sound like a cabinet in a dark arcade in 1988: a curved, glowing CRT in a cabinet with sunset side art, a lit marquee, a joystick that tilts when you move, other machines glowing in the dark around it, and a synthwave soundtrack under the hum of the room.

No image or audio files. Every sprite, letter, room, sound and note is generated in code.

---

## The look

### The screen
- **A 320 × 240 arcade monitor**, drawn at three times that resolution (960 × 720; twice on phones and slow machines) so the pixel art is crisp and the effects have fine detail: thin glow lines, sub-pixel particles, soft light.
- **Pixel art, 16-colour style.** Sprites are hand-drawn as character grids with four to six shades each and a dark outline, the way late-80s arcade sprites were. Dragons share one 24 × 24 body that is palette-swapped and given a per-type crest, tail and breath. CHROMAGON is a 40 × 40 sprite with a liquid-metal palette that shifts every frame.
- **Neon walls.** Each realm has a wall style: chunky blocks with a bright edge where wall meets floor, a bevel, a faint inner grid and a baked glow. Each room's static layer is drawn once into an offscreen canvas, so a frame is mostly one `drawImage`.
- **Synthwave floors.** A dim perspective grid and a horizon glow under every room, pulsing on the kick drum of the music.
- **The chalice flashes**, cycling through the palette, as it did in 1979.
- **Effects:** additive particles, pixel debris when a dragon dies, motion trails, a dash streak, screen shake, hit-pause, flashes and chromatic smear on room transitions.
- **Darkness.** Catacomb rooms are black except for a small circle around SQUIRE, a large one around the lamp, and the glow of fireballs and lasers.
- **The CRT** (hand-written WebGL): barrel curvature, scanlines on the 240 native rows, a slot mask, bloom from a bright-pass and blur, chromatic aberration, vignette, noise, a little flicker and phosphor persistence. It can be switched off; without WebGL the plain canvas is shown with a CSS scanline overlay.
- **All text** is a 5 × 7 pixel font drawn into the screen, so it glows and scanlines like everything else. The logo is the same font scaled up, filled with a chrome gradient and outlined in pink.

### The cabinet and the arcade
- The screen sits in a **DOM/CSS arcade cabinet**: a lit marquee with the chrome logo, a bezel, a control panel with a joystick and three buttons, a 1P START button that blinks when there is a credit, and a coin door with two glowing coin slots. The side art is a sunset with a grid.
- **The joystick and buttons move with your input**, whether it comes from the keyboard, a gamepad or a finger.
- The light from the screen spills into the room: the realm's palette (dimmer in a dark room, the flash colour during a flash) tints the glow the arcade canvas draws around the cabinet. It is derived from the game state, never read back from the screen (see learnings).
- Behind the cabinet is the **arcade**, drawn on its own canvas: rows of other cabinets with flickering screens and marquees, neon signs on the back wall (ARCADE, a palm tree, OPEN 24 HRS), a ceiling of tube lights, a blacklight carpet in perspective and haze.
- **View modes:** CABINET (the default on a desktop) and SCREEN (the monitor fills the window). Portrait phones get the cabinet with the control panel as the touch deck. Landscape phones get the screen with the stick and buttons on either side.

---

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | stick / d-pad | the cabinet joystick (drag) |
| **USE** (slash with the sword, lay the bridge, arm a charge, flare the lamp) | Z / J / Space | A | A button |
| **DROP** what you hold | X / K | B | B button |
| **DASH** | C / L / Shift | X / RB | C button |
| Insert coin | 5 or click the coin slot | Back | tap the coin slot |
| Start | Enter / 1 | Start | 1P START |
| Pause | P / Esc | Start (in play) | ❚❚ |
| Mute | M | | in Options |
| Cabinet / screen view | V | | in Options |

Picking things up is automatic, as in *Adventure*: touch an item and you are holding it. Touching another item swaps them.

---

## Core mechanics

### SQUIRE
- An 8 × 8 square. 80 px/s, eight-way. Facing follows the last direction moved (it is drawn as two eye pixels and decides where a slash or dash goes).
- **Three shield pips.** Fireballs, ice, lasers, a charge's blast, CHROMAGON's body and his glitchlings cost one. Zero pips costs a life. A **bite** costs a life outright, and so do THE NULL and the Citadel's collapse.
- **Dash:** 0.16 s at 270 px/s, 0.65 s cooldown, invulnerable while dashing. It stops at walls.
- **Lives:** three. Extra lives at 20 000, 60 000 and every 60 000 after. Losing a life drops what you held where you fell; you reappear in the Sunset Keep's courtyard with full pips and two seconds of invulnerability. Everything else stays where it is.

### Carrying
- One item at a time, held at the offset where you touched it (clamped so it stays against you). Held items pass through walls, as they always did.
- DROP leaves it where it is; it can't be picked up again until you step off it.
- The **bat** can take it from you.

### Items
| Item | What it does |
|---|---|
| **Sword** | Kills dragons it touches. USE swings it in a 0.2 s arc in front of you for extra reach. |
| **Keys** (gold, onyx, pearl, neon, violet) | Carry one into its castle's portcullis to raise it (touching the portcullis while you hold the key is enough). Gates stay open. |
| **Chalice** | Carry it into the Sunset Keep to clear the realm. It flashes. |
| **Magnet** | Pulls every loose item in its room toward itself, through walls, whether held or dropped. The way to reach things sealed in walls. |
| **Bridge** | Drop it (or USE) near a data river and it snaps across, the right way round. Walk down the deck: you lift a bridge by touching its rails, as in 1979, so crossing doesn't pick it up. It only spans rivers, so it can't break a castle's walls. |
| **Lamp** | Lights a wide circle in dark rooms, held or dropped. USE flares it, which scares dragons for a moment. |
| **Crystal shield** | Blocks fireballs and ice that touch it. It is held where you grabbed it, so where you hold it matters. |
| **Plasma charge** | USE arms it and drops it: it blows up 2 s later, breaking cracked walls and hurting dragons and you. A new one appears on its dispenser. |
| **Grey pixel** | Barely visible. Carry it into the right wall. |

### Pickups (collected on touch, not carried)
Gem (100), big gem (500), battery (+1 pip), 1UP, chrome shard (Realm 6), cassette (one hidden per realm; unlocks its track in the Sound Test, 2 500).

### Castles
A castle's courtyard has the castle at the top and its portcullis in the middle. Behind the portcullis is the castle's **vault**, a room with one way in. The **Sunset Keep** is home: its gate is always open, and the chalice must reach its vault.

### Dragons
| Dragon | Colour | HP | Speed | Behaviour |
|---|---|---|---|---|
| **AURIX** | gold | 1 | slow | chases you; flees from the chalice (as Yorgle did) |
| **VERDOX** | green | 2 | medium | guards an item (stays near it until you come close), spits fireballs |
| **SCARLAX** | red | 3 | fast | a hunter: follows you between rooms, lunges |
| **CRYOVEX** | cyan | 3 | medium, skates | breathes a cone of ice shards that slow you |
| **LUMA & NOX** | magenta, violet | 3 each | medium | twins: when one is hit the other blinks next to you |
| **CHROMAGON** | chrome | 18 (3 phases) | — | the boss (below) |

- Every dragon chases you when you are in its room (or adjacent, for hunters), using a flow field over the whole realm, so it follows you round corners and through doors.
- **Bite:** a dragon in reach opens its jaws (a 0.4 s tell, 0.3 s on EXPERT), then snaps. If you are still in reach, you are swallowed.
- **Fear:** AURIX keeps away from the chalice, and every dragon flees a flared lamp for a couple of seconds. Nothing fears the sword: you have to use it.
- **The sword** costs a dragon one HP per touch (0.5 s of invulnerability after), with knockback. A dead dragon bursts into pixels and leaves a gem.
- Lasers and charges hurt dragons too.

### BYTE, the glitch bat
From Realm 2 (every realm in Loop 2). A glitch, it flutters through walls between rooms on an erratic path. Every few seconds it picks an item near it, preferring the one in your hands, flies to it, takes it and drops what it carried. Whatever it drops lands on floor you can reach (it never takes things from places you can't reach yet either), so it can make a realm harder but never unwinnable. Hit it with the sword and it drops what it holds and reboots for ten seconds (eight on EXPERT).

### THE NULL
Each realm has a par time (3–7 minutes). Thirty seconds before it, the HUD warns you; at par, a hole of static appears in the room farthest from you and drifts toward you **through walls**, at 16 px/s at first and 7 px/s faster every minute (to 58). It can't be killed; the sword stuns it for three seconds. If it touches you, you lose a life and it reappears far away. In Realm 6 it appears the moment you lift the Chrome Chalice. The music stutters and the CRT tears as it gets close.

### Room types
- **Open field:** pillars and decor, wide doors.
- **Labyrinth:** a maze of three-tile corridors with a few loops.
- **Catacomb:** a labyrinth in the dark.
- **River:** a band of flowing data four tiles wide. Nothing walks across it without the bridge.
- **Lasers:** beams across the room on a timer, with a flicker before they fire.
- **Teleporter:** a pad that sends you (and what you hold) to its twin when you stand on it.
- **Cracked:** walls that only a plasma charge breaks.
- **Castle courtyard** and **vault**, the **secret room** and the **arena**.

---

## The six realms

Each realm is a grid of rooms, written in the code as a small character map with connectors between rooms. The rooms themselves are generated from the realm's seed and checked by flood fill. A planner proves every realm solvable, and a bot plays each one to the end in the tests.

| # | Realm | Size | Locked keep | Teaches | Dragons | New |
|---|---|---|---|---|---|---|
| 1 | **SUNSET GATE** | 3 × 3 | Gold Keep (chalice inside) | carrying, keys, gates, the sword | AURIX | — |
| 2 | **GRIDLOCK LABYRINTH** | 4 × 4 | Onyx Keep (chalice), Gold Keep (onyx key inside) | chains of keys, the magnet | AURIX, VERDOX | BYTE |
| 3 | **STATIC CATACOMBS** | 4 × 4 | Pearl Keep (chalice) | the lamp, darkness | SCARLAX, VERDOX, AURIX | the grey pixel, the secret room |
| 4 | **CHROME RIVERS** | 4 × 4 | Neon Keep (chalice) | the bridge, lasers, the shield | CRYOVEX, VERDOX | data rivers |
| 5 | **VAPOR VAULT** | 5 × 4 | Violet Keep (chalice), Gold Keep (violet key) | teleporters, cracked walls, the plasma charge | LUMA & NOX, SCARLAX | — |
| 6 | **THE CHROME CITADEL** | 4 × 4 + arena | the Citadel (three chrome shards open it) | everything | AURIX, VERDOX, SCARLAX (each carries a shard), CHROMAGON | the boss, the escape |

**Realm 6.** The three revived dragons each carry a chrome shard; kill them to collect the shards and the Citadel gate opens. Inside, CHROMAGON waits in the arena, and the gate shuts behind you. When he falls, the Chrome Chalice drops; lift it and the Citadel begins to collapse. THE NULL wakes at once and you have 90 seconds to carry the Chalice home; if the count runs out you lose a life and get another 60.

**CHROMAGON** has 18 HP over three phases of six. He can only be hurt with the sword while his chrome is dull: the window after an attack.
1. **Phase 1:** circles the arena and fires fans of five fireballs, then dives at you (a long, flashing tell). Dull after each dive.
2. **Phase 2:** adds a sweeping laser breath across the arena (the floor line glows before it fires).
3. **Phase 3:** calls glitchlings (tiny null-fragments that chase you) and alternates all three attacks faster.

**After the ending**, the game loops: Loop 2 is the same six realms with dragons 15% faster and one HP tougher, a par time 20% shorter, BYTE in every realm, and realm bonuses multiplied by the loop.

### Modes and skill
- **ARCADE:** the realms as designed, the same every time, learnable.
- **REMIX:** *Adventure*'s game 3. The items, dragons and room interiors are shuffled from a seed, and the planner rejects any shuffle it can't solve.
- **Skill** follows the 2600's difficulty switches: **NOVICE (B)** and **EXPERT (A)**. On EXPERT dragons are 20% faster, bite sooner, and the par time is 20% shorter.
- **Realm select:** you can start from any realm you have reached; the score table marks where a run began.

---

## Scoring and juice

| Event | Points |
|---|---|
| Gem / big gem | 100 / 500 |
| Dragon slain | 1 000 × its HP × the combo (up to ×4); CHROMAGON 50 000 |
| Gate opened | 500 |
| Realm clear | 10 000 × realm × loop, + time bonus (50 per second under par), + 5 000 for no lives lost |
| Cassette | 2 500 |
| Secret room | 25 000, once per run |
| BYTE stunned | 300 |

- **Hit-pause** of 60 ms on a sword hit, 120 ms on a kill; screen shake scaled by the event; pixel-burst deaths; a combo meter for kills chained within three seconds (×2, ×3…).
- Every gem pickup plays the next note of a rising pentatonic run if you pick them up in quick succession.

---

## Screens and flow

```
attract: TITLE → STORY → HOW TO PLAY → CAST (meet the dragons) → HALL OF FAME → DEMO (the bot plays Realm 1) → …
coin → 1P START → GAME SELECT (mode, skill, realm) → REALM INTRO → PLAY ⇄ PAUSE (resume / options / quit)
PLAY → REALM CLEAR (tally) → next REALM INTRO …  → ENDING → LOOP 2
PLAY (no lives) → CONTINUE? (10 s countdown, needs a credit) → GAME OVER → NAME ENTRY (if a high score) → attract
```

- **Credits.** Insert a coin with 5, or click the coin slot. Free play: START with no credit inserts one for you. A continue costs a credit; you keep your score.
- **Options:** sound, music, arcade noise, volume, CRT on/off, view (auto, cabinet or screen), screen shake, graphics (auto, high, low), Sound Test (the jukebox: the title and name-entry songs at first, each realm's song when you find its cassette, the boss theme once you reach the Citadel, the ending once you have seen it).
- **Pause on a hidden tab**, and audio suspends.

---

## Sound (Web Audio, all generated)

### Music
A look-ahead sequencer on the AudioContext clock (25 ms timer, 120 ms horizon) plays 16th-note steps.

- **Instruments:** a two-oscillator saw bass with a filter envelope; a three-oscillator detuned saw pad; a square arpeggio; a saw-and-square lead with vibrato and glide; kick, a gated-reverb snare, hats, clap and toms.
- **The synthwave pump:** bass and pad run through one gain node that ducks on every kick.
- **Space:** a generated stereo reverb impulse and a dotted-eighth feedback delay, as sends.
- **Every melody is generated.** Each song has a key, a tempo, a chord progression and a seed. A motif generator writes two-bar phrases from chord tones on strong steps and scale tones between them, with a constrained contour, and arranges them A A′ B A.
- **Songs:** CHROME HORIZON (title), one per realm (SUNSET GATE, GRIDLOCK, STATIC, CHROME RIVERS, VAPOR VAULT, CITADEL), CHROMAGON (boss), NAME ENTRY, DAWN DRIVE (ending), plus jingles for start, realm clear, extra life, continue and game over.
- **Layers follow the game:** pad and bass in vaults and catacombs; drums, arpeggio and lead in the open; extra percussion when a dragon is chasing you. When THE NULL is near, the music detunes and stutters.

### Sound effects
Square-wave and noise SFX in the 8-bit idiom: pick-up arpeggios, drop, slash, dash whoosh, dragon roar, jaw snap, swallow, gate ratchet, fireball, ice, laser hum, teleport sweep, charge beeps and blast, bat flaps, gem chimes on a rising scale, 1UP, coin drop, room transition, NULL static.

### The arcade
An optional ambience bed: filtered crowd murmur, and every few seconds a quiet, panned burst of another machine's bleeps, a distant explosion, or a coin dropping.

---

## Module overview

```
game-075/
├── index.html          cabinet DOM, back link, boot
├── style.css           arcade cabinet, layout modes, touch deck
├── game-plan.md        this file
├── js/
│   ├── main.js         boot, fixed-step loop, mode machine, attract, menus
│   ├── config.js       sizes, speeds, scoring, skill table
│   ├── rng.js          seeded PRNG (mulberry32) and hash
│   ├── save.js         settings, high scores, unlocks (guarded storage)
│   ├── input.js        keyboard, gamepad, cabinet joystick/buttons and touch
│   ├── audio.js        Web Audio graph, SFX, ambience, the sequencer
│   ├── music.js        song table and the melody generator
│   ├── sim/            pure simulation: no DOM, no Math.random
│   │   ├── realms.js   the six realm maps, items, dragons, names
│   │   ├── build.js    realm data → tile grid, rooms, entities (seeded)
│   │   ├── world.js    the rules: movement, carrying, gates, dragons, bat, NULL, boss
│   │   ├── nav.js      flow fields and A* on the realm grid
│   │   ├── plan.js     reachability and the lock planner (solvability)
│   │   └── bot.js      a player that executes the plan (demo and tests)
│   └── view/
│       ├── font.js     5 × 7 pixel font
│       ├── sprites.js  pixel-art grids and palettes, baked with glow
│       ├── render.js   rooms, entities, darkness, HUD
│       ├── fx.js       particles, shake, flashes
│       ├── screens.js  attract, menus, intro, tally, ending
│       ├── crt.js      WebGL CRT and bloom
│       └── arcade.js   the arcade room behind the cabinet
└── dev/
    ├── README.md
    ├── simtest.mjs     purity, realm checks, rules, the bot clears every realm, balance
    ├── browsertest.mjs desktop flow, every realm, the boss, the ending, phones, blocked storage
    ├── play.mjs        open the game, run a snippet, screenshot
    ├── mapdump.mjs     print a realm's tile map as text
    ├── sprites.html    every baked sprite on one sheet (shot.mjs screenshots it)
    └── shot.mjs
```

The simulation follows the repo's rule (game-040 onward): `js/sim/` imports nothing from the view, touches no DOM and never calls `Math.random`, so a Node script can play the real game. The world announces events on a bounded queue; the frame loop drains it into the renderer, the effects and the audio.

---

## Testing

- `node game-075/dev/simtest.mjs`: purity grep; every realm builds and every room's doors are joined; the planner solves every realm in ARCADE and 12 REMIX seeds; 35 rule checks (pick up, swap, drop, gate, magnet, bridge, charge, grey pixel, bite, sword, bat, NULL, boss phases, collapse, extra lives, winning); a god-mode bot clears every realm in both modes and a whole campaign on one session; then a balance table with a mortal bot.
- `node game-075/dev/browsertest.mjs`: real Chromium. Boot with no errors, the attract cycle, coin and start, game select, play, pause and options, a realm clear, continue, game over, name entry, the ending; touch-only phones in portrait and landscape (stick, buttons, 44 px targets, no sideways scroll); blocked storage.

---

## Open questions / next steps

- Balance is tuned by a bot, not by human players.
- Not yet played on a real phone or GPU (SwiftShader only in the tests).
- A two-player alternating mode would be in keeping with the cabinet.

---

## Changelog

### v1.0.0 (2026-10-13)
- First release: six realms, CHROMAGON, the ending and loops; ARCADE and REMIX modes; the cabinet, the arcade and the CRT; the generated soundtrack; keyboard, gamepad and touch.
