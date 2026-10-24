# Hollow Gambit

**Genre:** Gothic tactics RPG: fairy-chess movement, Fire Emblem duels, gacha party
**Engine:** three.js r165, no asset files
**Status:** v1.0.0 shipped. Six chapters, sixteen summonable pieces, a bot that plays the lot.

---

## Concept

A tactics game on an 8×8 board where every piece in your party moves like a different chess piece, and every capture is settled in a Fire Emblem-style duel instead of a coin flip. Your party is a handful of strange pieces you summon from the Hollow, each with its own movement, its own special ability and an elemental affinity. A Rook slides, a Knight leaps, a Grasshopper vaults a piece and lands beyond it, a Cannon fires only over a screen, a Nightrider keeps riding a knight line, a Queen goes anywhere. The dead who hold the crypts move the same way against you.

It borrows from three places. **Chess** (and the fairy-chess pieces: grasshopper, nightrider, camel, zebra, xiangqi cannon) for the board and the moves. **Fire Emblem** for the duel: the board gives way to a side-on cut-in, the two pieces trade strikes with hit, crit and follow-up speed, and an element triangle decides who has the edge. **Gacha RPGs** for the party: summon pieces with soul shards, duplicates raise a Bond, a pity counter guarantees the rare ones, and levels carry from battle to battle.

The tone is gothic dark fantasy: candlelit crypts, a rose window behind every fight, bone-on-black and antique gold, tolling bells and a cold organ pad. Nothing is gory; the dead are chess pieces who forgot they were people.

## Core loop

1. In the **Sanctum**, spend soul shards to summon pieces, set the party (up to five, deployed in order) and pick a chapter.
2. A **battle** is two phases a round. In yours, every piece acts once: move, capture, use its ability, or wait. Then the enemy plays.
3. A **capture** is a duel. You see a forecast first (damage, hit, crit, who strikes twice), then confirm. The winner takes the square.
4. Win a chapter by routing the enemy, or by slaying the marked lord. Earn shards and XP; bosses of the crypts can join you.
5. Spend the shards, level the party, go deeper. The last chapter is a wall that you come back to with a stronger roster.

## Mechanics

### Movement
A unit's move is a list of rules (`js/sim/data.js` → `MOVES`). Directions are written for the player's side (forward is up the board); the enemy's are flipped.

| Rule | What it does | Example |
|---|---|---|
| `leap` | Jump to each offset, over anything. A one-square leap is a step. | Knight, King, Camel, Alfil, Dabbaba |
| `slide` | Run along a line up to *r* squares, stopped by pieces and terrain. `m: 'move'` or `'cap'` limits it to moving or capturing. | Rook, Bishop, Queen |
| `slide` + `phase` | Passes over walls and chasms, but cannot stand on them. | Kharon, the Wraith |
| `ride` | Leap again and again in the same direction (a nightrider). | Vesna |
| `hop` | Jump over exactly one piece on a line and land just past it, capturing if an enemy is there. | Hob |
| `cannon` | Capture by jumping over exactly one screen along a line (xiangqi). | Ludovic |
| pawn | One square forward (move only), diagonally forward (capture only), and sideways (move only). | Maren, the Bone Thrall |

Walls (`#`) and chasms (`~`) stop slides and cannot be landed on; leaps and hops cross chasms. **Altars** (`+`) give the piece standing on them +2 defence and +10 avoid.

### The duel
Taking a piece starts a duel. The attacker strikes, the defender counters, and a piece at least 4 speed faster than its opponent strikes a second time. Stats are HP, ATK, DEF, SPD, SKL.

- **Damage** = ATK × element multiplier − DEF − terrain defence (at least 1).
- **Hit** = 70 + 2·SKL − 2·SPD(foe) − terrain avoid ± 15 for an element edge, clamped 10–100. Rolled as the average of two dice ("true hit"), so a high chance lands more often than it says and a low one less.
- **Crit** = SKL/2 − 1 %, triple damage.
- **Element**: Ember burns Thorn, Thorn chokes Tide, Tide douses Ember; Umbra and Lumen each have the edge over the other. Edge: +25% damage and +15 hit; at a disadvantage −20% damage and −15 hit.
- **Outcome**: the winner takes the square. A survivor drives the attacker back to the square before it (a slide stops adjacent; a leap returns home). A piece that falls leaves the board.

### Abilities
One per piece, in place of an action, then it rests (cooldown in rounds). Spells always hit and ignore half the defence.

| Ability | Rests | Effect |
|---|---|---|
| Sanctuary Prayer (heal) | 3 | An ally within 3 regains 45% health (min 8) |
| Soul Arrow (smite) | 2 | Bolt along a line of up to 4; hits the first piece; no counter |
| Aegis Sigil (ward) | 3 | Ally within 2: +5 DEF for 2 rounds |
| War Hymn (rally) | 4 | You and allies within 2: +4 ATK for 2 rounds |
| Shadowstep (blink) | 3 | Teleport to any empty square within 3 |
| Chain Hook (hook) | 3 | Drag the first enemy on a line next to you; 3 damage |
| Gravebreaker (shove) | 2 | Push an adjacent enemy 2 squares: walls hurt, chasms are fatal, pieces collide |
| Mirror Step (swap) | 2 | Trade places with an ally on a line of 5 |
| Withering Hex (hex) | 3 | Enemy within 3: −4 DEF, −3 SPD for 3 rounds |
| Hellfire (flame) | 4 | 3×3 blast within 3; enemies only |
| Dance of Dusk (encore) | 5 | An ally who has acted may act again |
| Crimson Kiss (drain) | 3 | Bite an adjacent enemy and heal the damage |
| Iron Vigil (bulwark) | 3 | +6 DEF for 2 rounds and 6 health |

### The party
- **XP and levels.** Fighting earns XP (more for a kill and for a higher-level foe); 100 XP is a level, up to 20. Each stat rises with its own growth chance (HP by 2), rolled when you level. Pieces are never lost for good.
- **Summoning.** 100 shards for one, 900 for ten. 70% 3★, 25% 4★, 5% 5★, plus **pity**: a 5★ at least every 40 summons, a 4★ or better at least every 10.
- **Bond.** A duplicate raises the piece's Bond by one: +5% to every stat, up to five. Past that it pays 30 shards.
- **New arrivals** join one level below the party's average, so a fresh 5★ is usable at once.
- **Recruits.** The boss of chapter 3 (Bram) and chapter 5 (Corwin) join your roster when slain.

### Chapters

| # | Chapter | Objective | Enemy lv | Deploys | What it teaches |
|---|---|---|---|---|---|
| 1 | The Chapel Yard | Rout | 1 | 3 | Moving, capturing, the duel |
| 2 | Ossuary Stairs | Rout | 2 | 4 | A hex-caster and a heavy rook that outlasts you |
| 3 | The Drowned Crypt | Slay Bram | 3–4 | 4 | Chasms, altars, a king that does not move until you come |
| 4 | Gargoyle Terrace | Rout | 5 | 4 | A board of chasms: only leapers and phasers cross |
| 5 | The Bell Tower Nave | Slay Corwin | 7–8 | 5 | Two Colossi in the middle and a crowd of hexers |
| 6 | The Vesper Throne | Slay the Count | 9–10 | 5 | The wall: a queen who drains, a warden, a hundred lanes |

Replaying a cleared chapter pays 40% of its shards. Chapters unlock in order.

## Content

### The roster (summonable)

| Piece | ★ | Element | Moves like | Ability |
|---|---|---|---|---|
| Maren Ashwick, Candle Squire | 3 | Ember | pawn (and sideways) | Cinder Bolt (smite) |
| Brother Gideon, Penitent Rook | 3 | Ember | rook, 3 | Penance Sigil (ward) |
| Sister Ilse, Lantern Bishop | 3 | Lumen | bishop, 3 | Sanctuary Prayer (heal) |
| Corwin Vale, Hollow Knight | 3 | Umbra | knight | Gravebreaker (shove) |
| Bram the Gaunt, Grave King | 3 | Thorn | king | Iron Vigil (bulwark) |
| Tilda Quill, Ratcatcher | 3 | Tide | wazir + two-square leap | Mirror Step (swap) |
| Osric Pale, Crow Herald | 3 | Thorn | alfil (2,2) + step | Carrion Curse (hex) |
| Vesna Nightbloom, Moonlit Rider | 4 | Umbra | nightrider, 3 | Shadowstep (blink) |
| Ludovic Marrow, Bone Cannoneer | 4 | Ember | cannon | Hellfire (flame) |
| Seraphine Vael, Cathedral Dancer | 4 | Lumen | camel (1,3) + diagonal step | Dance of Dusk (encore) |
| Hob the Unlit, Grave Hopper | 4 | Thorn | grasshopper | Chain Hook (hook) |
| Rue Thornwick, Briar Witch | 4 | Tide | zebra (2,3) + step | Withering Hex (hex) |
| Lady Morrigan, Blood Queen | 5 | Umbra | queen, 5 | Crimson Kiss (drain) |
| Aurelian Dawn, Sun-Sworn Champion | 5 | Lumen | king + knight | Hymn of Dawn (rally) |
| Kharon, Drowned Archbishop | 5 | Tide | phasing bishop, 5 + step | Tollbell (smite) |
| Ysolde of the Deep, Tidecaller | 5 | Tide | rook, 4 + knight | Tidal Ward (ward) |

The starting party is Maren, Gideon and Ilse. Every summonable piece moves differently from every other (the data test checks this), and the roster screen draws each pattern on a 9×9 grid.

### The dead

Bone Thrall (pawn), Grave Ghoul (king), Crypt Hound (knight), Wraith (phasing bishop), Ashen Cultist (wazir, hex), Bone Colossus (short rook, heavy), Gargoyle (alfil), The Drowned (king), Crypt Warden (rook+, bulwark), Count Vesperine (queen, drain). Bosses hold their square until someone comes within 4 or they are hurt.

## Story

You wake in the Sanctum, the one room of the old abbey that the dead cannot enter, with three pieces of a set that was never finished. The crypts below keep a game going that has no players left: every night the dead set up and move. The pieces you summon are not people exactly. They are what a person becomes when they are loved enough to be remembered as a piece. Count Vesperine, last of the abbey's lords, keeps the board at the bottom. Beat him and the game can end. The story is told through the chapter blurbs and the pieces' bios; there is no ending beyond the Count, only more levels and more summons.

## Controls

| Action | Mouse / keyboard | Gamepad | Touch |
|---|---|---|---|
| Select, move, capture | Click · Arrows + Enter/Space | D-pad + A | Tap |
| Confirm a capture | Click the target again · Strike button | A | Tap again · Strike |
| Ability · Wait · End turn | E · W · T | Y · X · Start | Buttons |
| Next piece · threat map | Tab · D | LB/RB (next piece) | ☠ button |
| Cancel · pause | Esc · Esc/P | B | Right-click / tap off the board · ❚❚ |

## Look and sound

- **Board.** Instanced flagstone tiles on a gilt plinth, spiked finials around the rim, pillar-and-spire walls, chasms with a glowing void, altars with a rune circle and candles. Corner candelabra light the room and flicker; embers drift upward. Behind everything: a rose window in the chapter's glass colours and pointed-arch windows. Six lighting themes (moon, candle, flood, wind, bell, crimson).
- **Pieces.** A gothic chess set made of lathes and boxes: eighteen silhouettes (pawn, rook, bishop, knight, king, queen, wazir, alfil, nightrider, cannon, dancer, grasshopper, witch, archbishop, empress, champion, wraith, gargoyle). A gold ring marks yours and a crimson ring the dead; an element gem floats above each head; a health bar and a greyed look mark who has acted.
- **The duel.** A cut to a separate arena: the rose window glows in the attacker's element, braziers light the floor, both pieces stand twice their board size. Strikes lunge, sparks fly, numbers float, a crit flashes and shakes, a death drops the loser. Fire Emblem panels at the top show HP, damage, hit and crit for both sides. The view shifts the camera down to clear them on a phone.
- **Sound.** All Web Audio: a cold detuned-saw pad over a bell-picked i–VI–iv–V loop in A harmonic minor (heavier, with a drum, in battle), a stone-hall reverb, bells for the phase tolls, summons and level-ups (richer for rarer pulls), steel and stone for strikes. Calm mode stops flicker, embers and flashes.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, sanctum, battle), the fixed-step loop, input routing, debug hooks |
| `js/play.js` | The battle controller: selection, targeting, the forecast, the keyboard cursor |
| `js/sim/data.js` | Elements, movement rules, abilities, the roster, the dead, the chapters |
| `js/sim/moves.js` | Legal moves for every rule; threat map; movement diagrams |
| `js/sim/battle.js` | The duel: element edge, forecast, true hit, the fight |
| `js/sim/abilities.js` | Targets and effects of the 13 abilities |
| `js/sim/core.js` | Building units, killing them, XP and level-ups |
| `js/sim/ai.js` | One brain for both sides: scores every move and ability one action ahead |
| `js/sim/game.js` | New game, commands (`act`), phases, the enemy turn, rewards, summoning, saves |
| `js/sim/bot.js` | Plays the whole campaign through `act()` |
| `js/view/stage.js` | Renderer, camera fit, lights, the board and cathedral, the duel arena |
| `js/view/models.js` | The procedural pieces |
| `js/view/fx.js` | A promise timeline, particle bursts, floating numbers |
| `js/view/view.js` | Plays the sim's events as animation; highlights; picking |
| `js/ui.js` | Screens, the HUD, the unit card, forecast, roster, summoning, results |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Keys and pad, sound, guarded storage, seeded RNG, tuning |

The sim is **turn-based, so its input is a command** rather than a stick: `act(G, { t: 'move' | 'ability' | 'wait' | 'end' | 'start' | 'summon' | ... })`. It resolves everything at once and pushes events (`move`, `battle`, `ability`, `death`, `levelup`, `phase`, `win`). The view queues them and plays them one at a time; `step()` takes `hold` so the enemy waits while the view animates.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the tables, every movement rule, the duel maths, every ability, the command flow, the gacha's rates and pity, determinism and save round trips, and has a bot play the whole campaign on several seeds with per-action invariants. `browsertest.mjs` drives the real game with a real mouse and keys on desktop, with real touches on a phone both ways up, and with storage blocked.

## Balance notes

The bot plays the real game through `act()` (summon, party, chapter, every piece) with the same brain the dead use. What it found:

- **Stalemates.** Both sides stood still at the edge of each other's reach and the fight ran to the turn limit. The enemy now plays recklessly (a quarter of the bot's caution about threatened squares) and the bot's caution decays every round.
- **Local minima.** Distance by Manhattan metric trapped pieces behind chasms; approach is now scored by a walking-distance field. A rider next to a king cannot take it and every move seemed to be "further away", so it also scores the captures it would have from each square.
- **Result.** On 8 seeds the starting party clears chapters 1–2 first try and 3–5 almost always; fights last 7–14 rounds; chapter 6 is won on about one attempt in four and takes farming and a stronger party, which is the point of a last chapter.
- **A data bug.** A chapter 6 gargoyle spawned inside a chasm; the data test now checks every start square.

## Open questions / next steps

- A human pass: the bot is not a person. Pacing of the duel cut-in, the cost of the summon, the difficulty of chapters 4 and 6, and how the touch controls feel are all unproven.
- No permadeath, no weapon durability, no terrain costs: the chess movement carries the tactics. Easy next features: more pieces (a Bishop-and-Knight "archbishop", a Lion), a second ability slot unlocked by Bond 3, and endless crypts after the Count.
- Enemy AI is one action ahead. It does not plan a two-piece trap.
- Only run under SwiftShader, never on a real GPU or touchscreen.

## Changelog

### v1.0.0 (2026-10-24)
- First release: six chapters, sixteen summonable pieces with unique movement, abilities and elements, Fire Emblem duels with a cut-in arena, a summoning altar with pity and Bond, XP and levels, a gothic three.js board, a bot that plays the campaign, and the sim and browser harnesses.
