# Oathstones

**Genre:** Fantasy match-3 RPG with gacha recruiting
**Engine:** three.js r165, no asset files
**Status:** v1.0.0

---

## Concept

A match-3 board where **every token keeps its own rule for being matched**. Most stones swear plain
Kinship and match their own colour, but some match by shape, some only with every colour at once,
some need two matches beside them before they wake. Heroes, the characters you are recruiting, stand
on the board as tokens with the strangest oaths of all, and when one arrives it imposes its rule on
the stones around it, so the board changes under you. Fulfil a hero's oath and they are **bound**:
they join your roster for good and fight in your party.

It riffs on Puzzle Quest (match-3 as the RPG battle), the gacha recruiting loop of Summoners War and
Fire Emblem Heroes (summon, pity, duplicates raise a rank), and the "every piece is its own rule"
feel of a deck-builder. The summon twist is the core idea: a pull does not hand you the hero. It
calls them to your next board, and you have to earn them there.

Tone: storybook high fantasy at dusk. A floating island of rock above the clouds, a gilded rune
board, braziers, a monster on a dais beyond the far edge.

## Core loop

1. **Camp.** Pick a stage on the Journey list, spend crystals at the Calling Stone, choose up to four
   heroes for the party.
2. **Battle.** A 7 × 7 board; the enemy's waves stand on the dais. Each swap that makes a line is a
   turn: lines clear, everything above falls, new stones drop in from the far edge, cascades follow.
   Every cleared stone strikes the enemy. The enemy counts down and acts on zero.
3. **Heroes arrive** on the board: the first one waiting in the calling comes with the board, more
   every few turns (two on the board at most), and now and then a wanderer from the region turns up.
   Each arrival changes the stones around it. Bind them before the battle ends; any called hero you
   don't bind goes back to the calling for the next battle.
4. **Result.** Crystals (more for a first win, a boss, and a swift win), XP and level-ups for the
   party, the heroes bound. On to the next stage, or back to camp to summon.

## Mechanics

### Tokens
A token has a colour (Ember, Tide, Grove, Sun, Shade), a shape (Orb, Spire, Keep, Star) and an oath.
Heroes are tokens too, standing on a pedestal gem of their own colour and shape. Rubble (an enemy
petrified a stone) has no colour and no oath. A frozen token can't be moved.

### Lines and oaths
A line is three or more tokens in a row or column. It clears only if **every** token in it accepts
it under its own oath. Lines are found as every window of 3+ consecutive tokens that is valid; a
token in any valid window is matched. `js/sim/board.js` `fits()` is the whole rulebook:

| Oath | Icon | Rule |
|---|---|---|
| Kinship | ● | All others share my colour. (Every plain stone in the first region.) |
| Form | ◆ | All others share my shape, any colours. |
| Twinned | ♊ | All others share my colour and my shape. |
| Prism | ◈ | All share my shape, and every colour in the line is different. |
| Motley | ✣ | All share my colour, and every shape in the line is different. |
| Host | ⚑ | Kinship, but the line must be four or more. |
| Cascade | ⛓ | Joins lines of its colour, but only leaves in a cascade (combo ≥ 2), never from your own swap. Its partners still clear. |
| Crossroads | ✚ | Joins lines of its colour, but only leaves where a valid row and a valid column cross on it. |
| Ring | ◎ | Never joins a line. Leaves when every neighbour (at least two) is a token sharing one colour. |
| Vigil | ☾ | Sleeps and blocks lines. Each clearing step with a cleared cell beside it lowers its count; at zero it wakes and leaves. |
| Fool | ✧ | Joins any line and counts as any colour and any shape for the others. |

Mixed lines are where the puzzle lives: a Form stone in a line of red Kinship stones needs them all
to share its shape too; a Prism stone can only sit in a line of one shape and different colours.

### Clearing, cascades, damage
- A swap must clear something, or it snaps back and costs no turn.
- Each clearing step: matched tokens and satisfied Rings leave; rubble beside a cleared cell breaks;
  ice beside one thaws; each sleeping Vigil beside one loses a point. Then gravity, then refill.
  Combo counts 1 for your swap's own matches, 2+ for cascades.
- Damage per stone = (4 + party power in that colour) × element × (1 + 0.25 × (combo − 1)).
  Party power in a colour is the sum of the ATK of party heroes of that colour, so the party you
  bring decides which colours hit hard. A bound hero hits for 25 × rarity × combo × element.
- Elements: Ember beats Grove beats Tide beats Ember (×1.5 / ×0.6); Sun and Shade each beat the
  other.
- If no move is left, the stones (not the heroes) reshuffle until there is one and nothing is waiting.

### Heroes
21 heroes in ten classes, three rarities (★3 Rare, ★4 Epic, ★5 Legend). Each has:
- **An oath** (how to bind them on the board).
- **An arrival** that changes the board when they land: paint stones their colour, mould stones to
  their shape, **bind** a row, column or ring of stones to their own oath (Nyx turns her row into
  Prism stones, Thalos his into Twinned ones, Ysolde the stones around her into Motley ones), free
  stones of their oaths, make Fool stones, shuffle, break rubble and ice, delay the enemy, charge
  the party.
- **A skill** used from the party bar, charged by clearing stones of the hero's colour: strikes,
  heals, shields, delays, painting the board, a row-shattering quake, a cleanse.
- Stats from rarity × level (to 30, XP from battles) × rank (+12% per duplicate bound, to +5).

### The calling (summons)
- 100 crystals for one call, 450 for five. ★5 4%, ★4 26%, ★3 70%; a ★5 is certain within 30 calls.
- Called heroes queue in the calling (ten at most). The first arrives with the next board; after that
  one arrives every four turns while fewer than two heroes stand on the board.
- Unbound called heroes return to the front of the queue when the battle ends (win, loss or flee).
- Wanderers: once a battle, a random ★3 (sometimes ★4) hero of the region can wander onto the board.
- Guests: some stages bring a set hero on turn 2 until you have bound them (Bram on the first stage
  teaches the Form oath, Mara the Ring, Odo the Vigil, Pip the Fool).

### The enemy
Each enemy has HP, ATK, a countdown and a pattern of turns it cycles through. Strikes hit the party
(shields absorb first). The rest change the board: petrify stones to rubble, freeze tokens, hex
stones with the Twinned oath, stain stones its own colour, bind stones to the region's oath, heal,
drain skill charge, scramble the board, grow enraged (+25% damage). Board changes that happen to
make lines resolve straight away, as cascades.

## Content

### Regions and stages
| Region | Stones swear | Stages |
|---|---|---|
| Emberfall Vale | Kinship | The Smouldering Road (Cinder Imp, guest Bram), Cinder Fields (+ guest Mara), Kiln Pass, **The Pyre Nest** (Pyre Drake) |
| Tidewrack Coast | 22% Form | Saltglass Shore (guest Odo), The Sunken Barrow, Wrackwater Rocks, **Leviathan’s Deep** |
| Thornwood Deep | 16% Form, 14% Motley | Bramble Gate (guest Pip), The Hag’s Bog, Mossfallen Keep, **Heartwood** (Elder Treant) |
| Sunspire Heights | Form, Twinned, Prism | The Gilded Stair, Griffin’s Rest, Hall of Fallen Light, **The Sun Forge** (Sun Colossus) |
| The Hollow Throne | every oath | Hollow Approach, **The Hollow Throne** (The Oathbreaker) |

Enemy stats live in `js/sim/data.js` `ENEMIES`; `FOE` in `js/config.js` scales them all.

### Heroes
| ★ | Heroes (oath) |
|---|---|
| 3 | Rowan (Kinship), Lyra (Form), Bram (Form), Tess (Kinship), Brother Odo (Vigil 2), Pip (Fool), Mara (Ring), Kel (Cascade) |
| 4 | Seraphine (Twinned), Nyx (Prism), Corin (Host), Ysolde (Motley), Gorm (Vigil 3), Wren (Crossroads), Fennick (Fool), Ilse (Form) |
| 5 | Aurelia (Prism), Morrigan (Crossroads), Thalos (Twinned), Vesper (Host), Elowen (Ring) |

Rowan and Lyra start in the party.

## Story

The Oathkeeper wanders a land where somebody broke every oath at once: the Oathbreaker, on the
Hollow Throne. Heroes are scattered and only half-remember their vows; the Calling Stone can reach
them, but they only stay with someone who honours their oath. Five regions, each with a boss; the
Oathbreaker's defeat is the ending ("The Oaths Hold"), after which every stage stays open for more
crystals and heroes (replays get 6% tougher per win, up to 30%).

## Controls

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Select / swap | Tap a token, tap a neighbour; or drag a token toward a neighbour | Arrows move the cursor, Space/Enter pick up, an arrow swaps | D-pad / stick, A |
| Read a token's oath | Tap it (the info line explains it) | Move the cursor onto it | — |
| Party skill | Tap the hero in the party bar | 1–4 | LB, RB, LT, RT |
| Hint | (after 9 s idle, if on) | H | X |
| Pause | ❚❚ | P / Esc | Start / B |

## Look and sound

- **Sky:** one full-screen shader per region: gradient, fbm nebula, twinkling stars, a moon or sun
  with a halo, three ridges of fbm mountains with mist pooling in the valleys.
- **Board:** a rounded slab with a canvas-painted top (two stone tones, grooves, rosettes, a gold
  border with runes, bump-mapped), a gilded lip, on a flat-shaded floating island; the enemy's dais
  with an additive rune ring that pulses when it acts; two braziers with flickering point lights.
- **Gems:** four real cuts (round brilliant, trillion, emerald, star) lofted in code with pavilion,
  girdle and crown facets, drawn as four `InstancedMesh`es with a patched `MeshPhysicalMaterial`:
  inner glow, fresnel rim, rainbow "fire" on the facets, per-instance flash/glow/dim and a pearly
  rainbow for Fool stones. Oath seals are an instanced canvas atlas: a ring per oath with its glyph
  on the near edge, rarity-tinted under heroes.
- **Characters:** chibi heroes from primitives, one look per hero (helmets, hats, hoods, antlers,
  beards, wings, a crow, a lantern, spectacles…); six monster bodies with variants and idle, lunge,
  hit-flash and death animations. Portraits for the UI are rendered from the same figures into a
  corner of the main canvas and copied out.
- **Effects:** sparks (one `Points` draw), tumbling crystal shards, bolts that arc from cleared stones
  to the enemy (the damage lands with the last), light pillars, ripples, DOM damage numbers.
- **Post:** sky pass → scene pass → UnrealBloom (half resolution, threshold 1.5 so only emissive
  glows and gem glints bloom) → a grade pass (vignette, hit flash, chromatic kick) → OutputPass
  (ACES). Calm effects (setting, defaulting to `prefers-reduced-motion`) cuts shake and flashes.
- **Sound:** all Web Audio: bell-like chimes climbing a pentatonic scale with the cascade, shatter
  noise, choir chords when a hero is bound, a harp glissando on arrival, heavy hits, dark swells for
  curses, summon jingles by rarity. Music is generated: pad chords, harp arpeggios, bass and a lead
  over a four-chord progression per mood (title, camp, a battle mode per region, boss), with drums
  in battle.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, camp, battle), routing taps/keys to commands, the attract board, debug hooks |
| `js/sim/board.js` | The rulebook: `fits`, `findClears`, `findMoves`, areas (pure) |
| `js/sim/battle.js` | A battle: setup, clearing steps, gravity and refill, arrivals and effects, the enemy, skills (pure) |
| `js/sim/game.js` | `act(G, cmd)`, the roster, the calling, rewards, saves (pure) |
| `js/sim/data.js` | Colours, shapes, oaths, heroes, enemies, regions, stages |
| `js/sim/bot.js` | The auto-player: cascade-aware swap scoring, skills, camp choices (pure) |
| `js/view/stage.js` | Renderer, post chain, sky shader, board, island, dais, lights, camera fit, picking |
| `js/view/tokens.js` | Instanced gems, seals, rubble, ice, hero figures |
| `js/view/models.js` | Gem cuts, hero figures, monsters |
| `js/view/fx.js` | Sparks, shards, bolts, beams, ripples, floating numbers |
| `js/view/view.js` | Plays sim events back one at a time; `busy` while anything plays; portraits |
| `js/ui.js` | DOM screens: camp tabs, brief, hero sheet, summon reveal, result, battle HUD |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input queue and board gestures, sound and music, guarded storage, seeded RNG, tuning |

The sim is turn-based (see the scaffold's "A turn-based or tactics game in this layout"): every
command resolves completely and pushes events; the view plays them back and the board ignores input
while the view is busy or events are undrained.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every oath, the rules (swaps,
binding and ranks, the calling and its pity, arrivals, the enemy, shields, skills, waves, rewards,
defeats), 540 dealt boards, determinism and a mid-battle save round trip, and has the bot play the
whole campaign on several seeds at two skills with invariants after every command.
`browsertest.mjs` drives the real game with mouse clicks, keys and CDP touches on desktop and on
touch-only phones in both orientations, and with storage blocked.

## Balance notes

Tuned against the bot (8 seeds, `SEEDS=8 ONLY=campaign node game-108/dev/simtest.mjs`):

- The good bot (cascade-aware, one swap ahead, no peeking at refills) beats the Oathbreaker on every
  seed in about 21 battles with about 2.3 defeats, mostly on the last two stages. A bot making
  random legal moves also finishes, in about 22 battles with 3.5 defeats, grinding a few stages.
- The first pass had enemies hitting far too softly (both bots finished with no defeats and 90% HP),
  then a wall at Sunspire: the Storm Griffin attacked every two turns and scrambled the board. It
  now attacks every three, and the Gilded Sentinel that opens the region is weaker.
- A fast player used to bind fewer heroes (fewer turns, fewer arrivals) and so fell behind late. A
  swift-victory bonus (up to 50% more crystals for finishing well under a par of 10 + 2 × stage
  turns) pays for extra summons.
- The tutorial imp has a lot of HP and a weak hit so the guest hero (Bram, turn 2) has time to be
  bound: the good bot binds him about half the time, aiming players more often; he comes back on
  replays until he is.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU (bloom and
  the gem shader especially).
- More stages after the ending (an endless tower with mixed-oath boards).
- Hero levels come only from XP; a way to spend duplicates or crystals on levels would help a party
  catch up after a summon.

## Changelog

### v1.0.0 (2026-10-29)
- First release: eleven oaths, 21 heroes with arrivals and skills, the calling with pity, 18 stages
  in five regions with 18 enemies, a procedural soundtrack, saves, touch, keyboard and gamepad.
