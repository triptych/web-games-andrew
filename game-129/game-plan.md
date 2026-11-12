# HOLLOWDEEP

**Genre:** first-person dungeon crawler (blobber), in the tradition of Wizardry and Etrian Odyssey
**Engine:** three.js r165 for the dungeon, DOM for the town, menus and the battle sprites. Art generated with fal
(`fal-ai/nano-banana-2`); music, sound effects and every voice generated with ElevenLabs. A Web Audio synth stands in
for any audio file that fails to load.
**Status:** v1.0.1

---

## Concept

Forty years ago the ground beneath the mountain town of Brindlemoor split open. The hole is the Hollowdeep, and it
has no bottom anyone has found. You run a company of delvers: hire them at the guild, gear them at Odo's, rest them at
Marta's inn, raise them at the Temple of the Dawn, take work from the townsfolk and Pell's board at the tavern, and
walk them through Old Ansel's gate, one grid square at a time, into a first-person maze lit by a single lantern.

The look is a PS2-era dungeon RPG: painted walls under Gouraud torchlight in a low-resolution buffer smoothed up to
the screen, fog closing the corridor, and monsters as large painted 2D sprites standing in front of you, as in
Etrian Odyssey and the PS2 Wizardry games. Tone: lonely, a little melancholy, warm in town.

## Core loop

Town (rest, shop, hire, take quests) → the gate (B1F, or warp to a floor past a beaten guardian) → explore a floor
square by square, filling in the automap; random encounters fill a danger gauge; open chests, drink from fountains,
pick up quest items, dodge or fight the roaming Lantern Reaper → find the stairs down, or turn home when HP and MP run
low (stairs up, or an Ariadne Thread) → every fifth floor a guardian stands in the only cell before the stairs. Beat it
and the warp stone to the floor below lights. Repeat, deeper.

## The simulation (`js/sim/`, pure)

Everything the player does is a command to `act(G, cmd)`; the UI, the bot and the tests all use it.

| Mode | Commands |
|---|---|
| town | `rest`, `buy {id}`, `sell {inv}`, `hire {i}`, `dismiss {cid}`, `party {ids}`, `revive {cid}`, `cure {cid}`, `talk {npc}`, `take {qid}`, `turnin {qid}`, `enter {floor}` |
| dungeon | `move {dir: f b l r}`, `turn {d: -1 1 2}`, `stairs` |
| battle | `cmd {a: attack/skill/defend/item, skill, target, item}`, `back`, `auto`, `flee` |
| any (not battle) | `use {inv, target}`, `equip {cid, inv}`, `unequip {cid, slot}`, `field {cid, skill, target}`, `discard {inv}` |

State `G`: roster (heroes with class, level, xp, hp, mp, statuses, gear), party (ids, first 3 are the front row),
inventory, gold, day, deepest floor, warps, beaten guardians, per-floor state (cells seen as a bitset, chests opened,
the reaper's position), the battle, quests, stats, and the RNG state. Floors are **not** saved: a floor is a pure
function of `(seed, floor)` (`dungeon.js`), so saves stay a few KB.

Events (the view, the sound and the UI react to these): `floor enter town step turn bump chest trap disarm fountain
found rescued reaper_move guardian battle round act hit miss heal dot status resist skip down revive summon flee steal
stolen won wipe battle_end levelup warp rescue_party rest buy sell hire revived quest reward deny full`.

### Floors (`dungeon.js`)
- A recursive-backtracker maze on the odd cells, 2–5 rooms carved over it, a few walls opened for loops. Floors grow
  from 15×15 to 31×31.
- Up stairs in the dead end nearest a corner; down stairs in the farthest dead end. On a guardian floor (every 5th)
  the guardian stands in the one cell next to the down stairs, so **the only way down is through it** (proved).
- The farthest remaining dead end is the quest spot (a fetch item glints there, or a lost delver waits); 2–6 chests in
  other dead ends; a 40% chance of a healing fountain in a room; from floor 6 a 35% chance of the Lantern Reaper.

### Battles (`battle.js`)
- Wizardry rounds: every able hero gets a command, then everyone acts in initiative order (speed × 0.8–1.2, Defend
  first). Flee is a party command (never from a guardian); a failed flee gives the monsters a free round.
- Damage `pow × A² / (A + D)` ±10%; weakness ×1.5, resistance ×0.5, holy ×2 on the undead; crits ×1.6.
- **Rows:** monsters aim at the front row three times as often; the back row takes ×0.7 physical damage and deals
  ×0.55 with melee (bows, Backstab, Assassinate and arrows are ranged).
- Statuses: poison, sleep, paralyze, stun, blind, curse, slow, charm; buffs might, guard, regen, taunt, haste, and
  the Ranger's mark. Guardians shrug off most control (×0.25).
- Monster special actions (`MONSTER_ACTS`, 33 of them) from breath and curses to healing allies and raising the dead.

### Classes (`data/classes.js`)
Fighter, Knight, Thief, Mage, Priest, Ranger; 5–7 skills each, learned by level. Two portraits (and two voices) per
class, so recruits vary. Starting party: a Fighter, a Priest and a Mage.

### The dungeon's strata (`data/monsters.js`)
Eight strata of five floors: Mossy Catacombs, Glimmer Grotto, Drowned Halls, Ember Foundry, Frozen Ossuary, Thornwood
Hollow, Clockwork Vault, Starsunk Sanctum. Six monsters and a guardian each (48 monsters, 8 guardians), plus the Lantern
Reaper. Past B40F the strata return as **Echoes** (×3.4 per pass, recoloured, "Echoing …"): the dungeon is endless.
Monster strength: `(1 + 0.07 (floor − 1)) × 3.4^cycle`, attack and magic to the 0.9, defence to the 0.8.

### Town, quests, items
- Inn: full rest for `6 + 2 × levels` gold; if you can't pay, the stables give half back for free (no softlock).
- Temple: raise for `20 + 15 × level`; the first of a broken party is raised free.
- Guild: four recruits a day near the party's level; up to 12 members.
- Shop: consumables and the equipment tiers the party has reached (10 kinds × 8 tiers + accessories).
- Story: 16 quests from the six townsfolk (slay each guardian; fetch a locket, a moonpetal, star iron…; rescue a
  delver who then joins you). Pell's board: three bounties a day (hunt, survey a floor, fetch a satchel, rescue).
- A wipe carries the party home and costs 30% of the gold; the fallen stay fallen until the Temple.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Step forward / back | W / S, ↑ / ↓ | d-pad up / down | ▲ ▼ |
| Turn | A / D, ← / → | d-pad left / right | ↺ ↻ |
| Step sideways | Q / E | — | ⇠ ⇢ |
| Stairs / confirm | Enter, Space | A | the prompt button |
| Camp menu | Esc, Tab | Start | ☰ |
| Map | M | — | 🗺 |
| Battle | 1–6, arrows, Enter, Esc (back) | d-pad, A, B | tap a command, tap a monster |

## Look and sound

- Dungeon: walls, floors and ceilings are the stratum's fal textures (made tileable on export), Lambert lighting with
  baked corner darkening, a flickering warm torch, exponential fog in the stratum's colour, wall torches as additive
  sprites, a 448-line buffer (the "PS2 picture" setting), a vignette and faint scanlines.
- Town: six painted backdrops (fal), voiced townsfolk with portraits.
- Battles: painted fal sprites over the dungeon with idle breathing, hit flashes, lunges, element flashes, floating
  numbers; guardians speak.
- Music (ElevenLabs): title, town, three dungeon themes by depth, battle, guardian, victory and defeat stings.
  24 effects and a looping dungeon ambience. 95 voice lines: the narrator, the six townsfolk, 12 heroes, 8 guardians
  and the Reaper. See `dev/audio/README.md`.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, screens, input (keys, touch pad, gamepad), event routing, music by area, saves, debug hooks |
| `js/sim/` | Pure rules: `game.js` (commands), `dungeon.js` (floors), `battle.js`, `quests.js`, `stats.js`, `bot.js`, `data/*` |
| `js/view/dungeon3d.js` | three.js first-person view; reads G |
| `js/ui/` | `hud.js` (party bar, minimap, map), `battle.js` (event playback, command menu), `town.js`, `camp.js`, `common.js` |
| `js/audio.js`, `js/voices.js` | ElevenLabs music/effects/voices with crossfade, ducking and subtitles; the voiced script |
| `js/save.js`, `js/rng.js`, `js/config.js` | Guarded storage, seeded RNG, tuning |
| `dev/art/`, `dev/audio/` | The fal and ElevenLabs pipelines (prompts from the data tables, export scripts) |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs`: purity, every asset present, 2,700 floors proved (stairs, chests,
quest spots reachable; guardians sufficient and necessary), the rules, determinism and save round trips (mid-battle
too), and a careful and a reckless bot each playing four games of 16,000 commands with per-command invariants and
balance bands. `browsertest.mjs`: desktop with real keys, two touch-only phones with real touches, blocked storage.

## Balance notes (from the bot)

| Bot | Deepest (16k commands) | Wipes | Notes |
|---|---|---|---|
| careful (skill 1, waits for the level) | B15–B25, median B20 | 0–5 | always beats B5's guardian in ~50–90 battles |
| reckless (skill 0.4, dives early, fights hurt) | B10–B20 | 8–16 | wipes more, which is the point |

- First pass: monsters had flat stats across depth and the party lost 2–3% HP a fight. Monster scaling now follows the
  absolute floor, with ×3 health; the party now needs its priest's MP to keep going, and turns home after ~15–20 fights.
- The bot found a softlock: a broke party with hurt members could neither rest nor earn. The stables fixed it.
- Guardians fall at the first attempt at about level 9 (B5), 13 (B10), 17–25 (B15). The gap between B15 and B20 is
  the slowest stretch.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- More floor variety (doors, one-way walls, dark zones, traps on the map) in the Etrian style.
- Class changes and a skill-point tree; more guardians past the Echoes.

## Changelog

### v1.0.1 (2026-11-12)
- Camp → Items: a draught can be used on one hero after another without leaving the list (the second tap did nothing before); heroes an item can't help are greyed out.

### v1.0.0 (2026-11-12)
- First release: town of six places, 6 classes with 33 skills, recruiting, 8 strata × 7 monsters + the Lantern Reaper,
  endless Echo floors, guardians every 5th floor with warp stones, 16 story quests and daily bounties, automap,
  three.js dungeon with fal textures and sprites, ElevenLabs music, effects and 95 voice lines, saves, touch and gamepad.
