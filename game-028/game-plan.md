# Echoes of Aethermoor

**Genre:** Visual novel / fantasy RPG
**Layout:** sim/view, plain HTML, CSS and JavaScript (Canvas 2D for the map and battles, DOM for everything else)
**Version:** 2.0.1
**Status:** Complete: four chapters, two endings, every line voiced

---

## Concept

Three weeks ago the Aethermoor Academy burned. Lyra, an apprentice, ran into the night with a copy of a prophecy about
the Lich sealed beneath the Academy's older ruins, and the prophecy names her as the key: to wake him, or to end him.
She gathers a disgraced knight (Orin), an exiled elf ranger (Sera) and a warlock who broke his demon pact (Thane), and
goes back.

It is the same game as v1 (the Phaser 4 build, phases 1–4): the same cast, places, four chapters, quests, items and
turn-based battles. Version 2 rebuilds it without a framework, finishes Phase 5 (art, portraits, mobile input) and
fixes every mechanic that was broken or missing.

## Core loop

Talk to people (voiced visual-novel scenes with choices) → take quests → walk the painted maps (random battles in the
wilds, fixed fights, chests, story scenes) → fight → level up, loot, buy and equip gear → rest at the inn → the next
chapter opens.

## Mechanics

### Exploration
Tile maps drawn from painted textures with soft edges, props and buildings that block their footprint, trees, chests,
waiting foes and people, sorted by depth. Arrow keys / WASD walk, Space talks or opens; walking into a person or a chest
does too. On a phone: a pad, an action button, or tap where to go (a path is walked; tapping a person walks up and talks).
The party follows the leader. Random battles start after a few safe steps from any map change or battle.

### Guide
`js/sim/guide.js` knows the next main step and the side errands. **H** (or the **?** button) says it, the journal shows
it, and a gold marker floats over the person or place on the current map. It also recommends a party level before each
big fight. The test bot follows the same guide, so a hint can never point at something the bot couldn't do.

### Battles
Everyone acts in order of speed each round (shown at the top). Commands: Attack, Skills (MP), Items (on a chosen ally),
Defend (half damage until your next turn, +8% MP), Flee (not from bosses), Auto (stays on from battle to battle; a Take control bar or Q hands the commands back). Bosses act twice a round.
Statuses: Poison (7% max HP a turn), Stun (lose a turn; bosses resist), Slow (half speed), Weak (−30% attack),
ATK Up (+30%), Taunt (foes must attack the taunter), Guard (half damage), Evade (the next attack misses),
Marked (+30% damage taken). Damage is attack × power − defence × 0.6 (physical) or × 0.3 (magic), ±10%, 6% crits on
physical hits. The Lich telegraphs Void Eclipse a turn ahead and raises his fallen Shards.

### Party and gear
One shared level (HP +11%, MP +7%, ATK/DEF +7%, SPD +3.5% a level); recruits join at the party's level. Each hero has
a weapon and an armour slot; gear says who can use it. New abilities at levels 4–8 (Bulwark, Hunter's Mark, Starfall,
Rallying Cry). Anyone knocked out gets up with 1 HP after a won battle.

### Defeat
Retry the battle exactly as it began, or wake at the Ember Hearth Inn with half your gold.

### Quests
Eight quests; every objective is read from the live state (kills since the quest was taken, items carried, flags,
places visited), so the journal can never disagree with the world.

## What v2 fixed from v1

| v1 | v2 |
|---|---|
| Weapons and armour could be bought but there was no way to equip them, and their stats did nothing | Equipment slots in the Party menu and straight after buying; stats apply everywhere |
| Loot had sell prices and no way to sell | Every shop buys loot and spare gear |
| Frostbind's slow, Provoke, Iron Guard, Shadowstep, Hex, Howl, Flicker, Reanimate and Void Eclipse did nothing | All implemented; Iron Guard became Bulwark (whole party), the Lich telegraphs Void Eclipse |
| Turn order was sorted once, so speed changes never mattered | Re-sorted every round with slow counted |
| Heals, potions and revives picked their own target | You choose |
| Antidotes did nothing | Cure poison, slow and weakness |
| Enemies always picked a random ability and a random target | Abilities by weight with conditions and cooldowns; taunt is obeyed; 40% of attacks go for the weakest |
| Losing sent you to the title screen | Retry, or wake at the inn |
| "Defeat two bandits" was never counted; Borin appeared whether or not you fought | The bandits block the camp; kills are counted |
| One-time events lived on the shared map data and were not saved: chests and anchor roots could be used again after a reload, bosses refought | Events are recorded in the save |
| `not_flag_` conditions were built wrong, so Sylvara re-gave Orin's quest on every visit | Conditions rewritten; she offers it once |
| The Elder Scroll did nothing after Lyra's Past | The seal needs it: Lyra really is the key |
| Slime cores could become impossible to find after chapter 1 | Slimes stay in the Thornwood |
| The ending was one fixed text | A choice: keep the scroll (Remember) or burn it (Release), with epilogues for each companion who joined |
| Emoji portraits and coloured squares | Painted cast, expressions, map sprites, places, foes, items and story illustrations |
| Synth beeps | Voiced script, nine music themes, twenty effects |

## Content

- **Places**: Thornhaven (village, inn, forge), the Thornwood, the Academy Ruins, the World Tree Grove, the Shattered
  Chapel, the Aethermoor Ruins, the Sanctum.
- **Cast**: Lyra, Orin, Sera, Thane; Elder Varec, Farmer Holt, Borin, Marta, Aldric, Sylvara, Scholar Aneth; Korvas and
  Vaelthas, the Lich.
- **Foes**: slime, wolf, bandit, wisp, lich shard, corrupted knight, golem; Korvas; Vaelthas.
- **Quests**: The Missing Merchant, Slime Infestation, Pelts for the Forge, Lyra's Past, Spirit of the Wood, Orin's
  Broken Oath, The Sealed Sanctum, Echoes End.

## Story

1. **The Road to Thornhaven**: the bandits on the Thornwood road answer to "the Lich's hand", and they are watching for
   Lyra. She recovers her copy of the prophecy from the Academy ruins.
2. **Roots and Oaths**: Orin and Sera join; three soul gems cleanse the World Tree's roots; Orin faces Korvas, the
   commander who sold the Solarian Order to the Lich.
3. **The Sealed Sanctum**: in the ruins Lyra finds her old teacher Aneth, and Thane. Two soul gems and the scroll, read
   aloud by the one it names, break the seal.
4. **Echoes End**: Vaelthas wrote the prophecy himself, as a door and a key. When he falls, his memory lives on only in
   the scroll: Lyra keeps it or burns it.

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

Everything is painted with fal `nano-banana-2` from the data's descriptions (dev/art/README.md); everything you hear was
made with ElevenLabs (dev/audio/README.md): the effects directly, the music (Music v2.5) and the 190 voice lines
(Eleven v4, 14 voices) through fal. A Web Audio synth stands in for any music or effect that fails to load.

## Module overview

| File | What |
|---|---|
| `js/sim/data/*.js` | Party, foes and groups, items and shops, quests, maps, the whole script (story.js), cast, barks |
| `js/sim/rules.js` | Conditions, stats and levels, inventory, quests |
| `js/sim/world.js` | What stands where, walkability, paths (also across maps) |
| `js/sim/battle.js` | Battles, statuses, the foes' AI, the auto command |
| `js/sim/game.js` | `newGame`, `act(G, cmd)`, dialogue, exploration, shops, equipment, defeat, saves |
| `js/sim/guide.js` | The next step and the recommended levels |
| `js/sim/bot.js` | A bot that plays the whole game |
| `js/view/map.js`, `js/view/battle.js` | Canvas 2D map and battle stage |
| `js/vn.js`, `js/ui.js` | Dialogue box; HUD, menus, shop, battle menus |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/main.js` | Sound, input, storage, boot and loop |

## Testing

- `node game-028/dev/simtest.mjs`: purity, every map/tree/quest/art/voice reference, every v1 bug above, determinism,
  save round trips, and whole games by the bot at three skills.
- `node game-028/dev/browsertest.mjs`: desktop by real keys and clicks (prologue, walking, talking, choices, menu, hint,
  a battle, the forge, save and continue), two touch-only phones, blocked storage, autoplay in the browser.

## Balance notes

Measured with the bot (12 games per row, recommended levels Korvas 7, gate golems 9, Vaelthas 10):

| Bot | Finished | Battles | Defeats per game | Final level |
|---|---|---|---|---|
| careful (skill 1) | 100% | ~73 | 0 | 10 |
| sloppy (0.6) | 100% | ~78 | ~5 | 10–11 |
| careless (0.3) | 100% | ~100 | ~16 | 10–11 |

Before tuning, Korvas and Vaelthas were never beaten once; doubling their turns (rather than their HP) made them
dangerous without making the fights long. A careful party at the recommended level wins Korvas every time and Vaelthas
about 85%; one level lower drops the Lich to under 50%.

## Open questions / next steps

- Only tested in headless Chromium; check on real phones.
- A New Game+ or harder mode would use the existing balance knobs.

## Changelog

### v2.0.1 (2026-11-20)
- Auto battle shows a Take control bar while it runs (it carries on from battle to battle, and the menu with its Auto button stayed hidden).

### v2.0.0 (2026-11-20)
- Rebuilt without Phaser in the sim/view layout; every mechanic in "What v2 fixed" above; fal art, ElevenLabs music,
  effects and a fully voiced script; the guide, two endings; sim and browser tests; balance by bot.

### v1.4.2 and earlier
- The Phaser 4 build: phases 1–4 (scaffold, systems, story, map overhaul), then the iOS audio fix.
