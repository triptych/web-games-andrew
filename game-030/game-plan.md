# Coppergate Lane

**Genre:** Cozy-fantasy RPG (tinker's tale)
**Layout:** sim/view, plain HTML, CSS and JavaScript (Canvas 2D for the map and the battle stage, DOM for everything else)
**Version:** 2.0.0
**Status:** Complete: one story arc to a boss, four quests, a party of three, painted, scored and fully voiced.

---

## Concept

You are Wick, the handy newcomer on Coppergate Lane, a village where the clocks run a little fast and everything with a
spring in it has opinions. Mayor Pilcrow's Golden Gear has gone missing. You run errands for the lane, gather friends, and
fight the clockwork critters of the Whistling Wilds and Gutter Gully, until you walk into Big Bertha's lair and find out
why she took it.

It is the same game as v1 (the Canvas 2D build in git history before 2.0.0): the same three places, cast, quests, items and
turn-based fights. Version 2 rebuilds it in the sim/view layout and does everything v1's own "TODO / expand later" list asked
for, and paints and voices it.

## Core loop

Talk to the lane → take errands → walk the painted maps (random battles in the Wilds and the Gully, a few fixed fights, chests)
→ fight → level up, loot, sell, buy gear → sleep above Bertram's shop to recover and save → gather the party → brief the Mayor
→ beat Bertha → bring the gear home.

## Mechanics

### Exploration
Tile maps with painted ground textures blended at their edges, props and buildings that block their footprint, trees,
chests, waiting foes and people, sorted by depth. Arrow keys / WASD walk, Space talks or opens; walking into a person or a
chest does too. On a phone: a pad, an action button, or tap where to go (a path is walked; tapping a person walks up and
talks). The party follows the leader. Random battles start after a few safe steps from any map change or battle.

### The guide
`js/sim/guide.js` knows the next main step and the side errands. **H** (or **?**) says it, the journal shows it, and a gold
marker floats over the person or place on the current map. It recommends level 6 before Bertha. The test bot follows the
same guide, so a hint can never point at something the bot couldn't do.

### Battles
Everyone acts in order of speed (shown at the top). Commands: Attack, Skills (SP), Items (on a chosen friend), Defend (half
damage and a little SP back), Flee (not from a boss), Auto. Damage is attack × power − defence × 0.6 (physical) or × 0.3
(gadgets), ±10%, 6% crits on physical hits. **Statuses**: Stun (lose a turn; bosses resist), Rust (defence ×0.7), Weak
(−30% attack), ATK Up (+30%), Taunt, Guard (half damage), Evade (the next attack misses).

### Foes that play differently
| Foe | What it does |
|---|---|
| Cog Sprite | Swarms in twos and threes, hits a random friend, skitters (Evade). |
| Rust Crab | Shells up (Guard for two turns), then pinches hard and rusts your armour. |
| Lane Bandit | Goes for your weakest friend; Pickpocket takes a share of your gold and keeps it until it falls (the gold comes back). |
| Gear-Wolf | Hunts the weakest; howls to give the whole pack ATK Up; pounces. |
| Big Bertha | Telegraphs Gear Slam a turn ahead (all friends take heavy damage unless guarded: Mabel's Cosy Blanket or Defend), Steam Blast, Hammer Fist; below half HP calls two Cog Sprites; below 30% loses her temper. Cannot be fled or smoked. |

### The party
One shared level (HP +13%, SP +8%, ATK +8%, DEF +7.5%, SPD +3% a level); recruits join at the party's level.
| Hero | Role | Skills |
|---|---|---|
| Wick | Handy newcomer | Overclock (big single hit), Patch Up (heal a friend), Scatter-Gear (all foes, level 3), Jury-Rig (stuns, level 5) |
| Trina | Lane Tinker (joins with the scrap quest) | Spark Zap, Sprocket Storm (all foes, level 3), Rust Dust (every foe's defence, level 5), Tune-Up (the party hits harder, level 7) |
| Mabel | Baker (joins with the kettle quest) | Tea Time (heal), Pan Clang (stuns, level 3), Warm Scones (heal everyone, level 4), Cosy Blanket (the party takes half damage, level 6) |

Each has a weapon and a gear slot; gear says who can use it. Anyone knocked out gets up with 1 HP after a won battle.

### Defeat
Retry the battle exactly as it began (stolen gold included), or be dragged home to the lane, a quarter of the gold lighter.

### Quests
Four; every objective is read from the live state (kills since taking the quest, items carried, flags), so the journal can
never disagree with the world.

## Content

- **Places**: Coppergate Lane (workshop, bakery, Hall, Bertram's stall), the Whistling Wilds, Gutter Gully, Bertha's Lair.
- **Cast**: Wick; Trina, Mabel, Mayor Pilcrow, Bertram; Big Bertha.
- **Quests**: The Golden Gear (main: hear the Mayor out, get the gear back from Bertha, return it), Spare Parts for Trina
  (five scrap; she joins and gives the Spark Rod), Mabel's Missing Kettle (a crab guards it in a nook of the Gully; Mabel
  joins), Springs for Bertram (three springs; the Tinker Charm).

## Story

1. **Trina** greets you with a crisis: the Golden Gear has gone from the Hall. She sends you to the Mayor.
2. **Mayor Pilcrow** says an oil trail leads to Big Bertha in Gutter Gully, and gives you a brass Lair Pass for the iron door.
3. Gather scrap and springs, find the kettle, get stronger in the Wilds and the Gully.
4. **Big Bertha** took the gear because it hums, and nobody ever talks to her. You win it back; the Mayor invites her to tea.

## Controls

| Action | Keys | Touch |
|---|---|---|
| Walk | Arrows / WASD | Pad, or tap a tile |
| Talk, open, confirm | Space / Enter / Z | A button, tap |
| Menu / journal / hint | M / J / H | ☰ / ? buttons |
| Dialogue | Space next, 1–9 choose, L log, Q auto, E skip | tap |
| Battle | Arrows move between buttons and targets, Enter, Esc back, Q auto | tap |
| Close | Esc | ✕ / Done |

## Look and sound

Everything is painted with fal `nano-banana-2` from the data's descriptions ([dev/art/README.md](dev/art/README.md)). Everything
you hear was made with ElevenLabs ([dev/audio/README.md](dev/audio/README.md)): seven music themes (Music v2.5), 18 sound effects,
and every line of dialogue and every battle shout, in six voices. A Web Audio synth stands in for any music or effect that fails to
load, and a missing voice clip is silent.

## Module overview

```
js/main.js        boot, title, the frame loop, input → act(), event routing, ?debug=1 hooks (window.__cl)
js/config.js      version, save key, tuning
js/rng.js         seeded mulberry32 + hash (pure)
js/sim/           game.js (newGame, act, serialize), battle.js, rules.js, world.js, guide.js, bot.js (all pure)
js/sim/data/      maps, party, enemies, items, quests, story (dialogue trees), barks, cast
js/view/          map.js, battle.js (Canvas 2D), assets.js (every picture id)
js/ui.js, vn.js   DOM screens, battle menus, the dialogue box
js/input.js, audio.js, save.js, audio-files.js, voicekey.js
dev/              simtest, browsertest, play, shots, preview, serve; art/ and audio/ pipelines
```

## Testing

- `node game-030/dev/simtest.mjs`: 965 checks. Purity, every map/person/event reachable, every dialogue reference, every quest
  given and completed, every picture and audio file, a test for each v1 gap, whole games by the bot at skill 1, 0.6 and 0.3.
- `node game-030/dev/browsertest.mjs`: 44 checks. Chromium, desktop by real keys and clicks, two touch-only phones, blocked storage, and
  the bot autoplaying in the page. Screenshots in `dev/shots/`.

## Balance notes

The bot at skill 1 finishes every game with no defeats at about level 7–8 in about 38 fights; a careless bot (0.3) falls
about twice a game. Bertha (640 HP) against a party of three with supplies: level 4 wins about one time in five, level 5
about half, level 6 reliably, which is what the guide recommends.

## Open questions / next steps

- Listen to the voice clips: each take was cut at its longest pauses and the counts matched, but a clip that starts or ends a word early would only be heard by ear.
- One more companion, or a second boss, would suit the Gully's closed corner better than more random encounters.

## Changelog

### v2.0.0 (2026-11-21)
Rebuilt without a framework in the sim/view layout. Saves; a party of three; status effects; enemies with their own AI; a bed
above the shop; the Golden Gear sequence fixed; a fourth quest; a hint arrow, tap-to-walk and a touch pad; 41 painted images,
seven music themes, 18 sound effects and every line voiced (86 clips); a bot, a sim test and a browser test. See the root CHANGELOG.

### v1.1.3
Dialogs pinned (PR #369). v1 (v1.0.0) was the Kaplay-free Canvas 2D prototype with a solo hero, no saves and emoji art.
