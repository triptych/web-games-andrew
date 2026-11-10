# EMBERSPIRE

**Genre:** 16-bit endless-tower JRPG: turn-based party battles, a town of RPG systems, bonds, and idle income
**Engine:** Vanilla JS: Canvas 2D battle stage (640x360, nearest-neighbour) and DOM menus. Art generated with fal, music, effects and voices with ElevenLabs; a Web Audio synth is the fallback for any sound file that fails to load
**Status:** v1.0.1

---

## Concept

A black tower rose over the town of Hearthmere thirty years ago and has no top that anyone has seen. Arin, a young
knight whose father's patrol never came down, climbs it with the cleric Mira and whoever else the tavern can spare.
Every floor is a turn-based battle against monsters that grow steadily stronger; every 5th floor holds a mini boss
and every 10th a true boss. Between climbs: recruit heroes, upgrade and reforge gear, learn skills and evolve classes,
take bounties, spend the evening with a companion, collect the town's tithe for your deeds, and climb again.

It riffs on the SNES-era party RPG (side-view battles, a menu of Attack / Skills / Items / Defend), the idle-tower
genre (endless floors, auto battle, offline income) and the dating-sim evening (bond scenes with choices). Tone: warm,
funny, a little melancholy, never grim.

## Core loop

One in-game day: morning in town (shop, forge, temple, recruit, claim quests) → one climb, starting from the highest
checkpoint, as many floors as you dare (each floor's rest heals a little) → back home in the evening (or carried home
on defeat, losing 30% of the run's gold) → an evening with one companion → rest → the next day (heal, new quests, new
stock). Real time adds the daily bonus and the idle tithe.

## Mechanics

### Battle (`js/sim/battle.js`)
- **Charge-time turns.** Every unit fills a gauge by its speed and acts at 1000; a unit three times as fast acts more
  than twice as often (tested). Haste ×1.5, Slow ×0.6, an enraged boss ×1.35.
- **Commands:** Attack, Skills (MP), Items, Defend (half damage, +6% MP), Flee (65%, never from a mini boss or boss).
- **Damage:** `pow × A² / (A + D)` with A = attack or magic, D = defence or resistance (mixed skills average both).
  Weakness ×1.5, resistance ×0.5, crit 5% + gear ×1.75, ±8% variance, Defend ×0.5, Barrier ×0.6.
- **Statuses:** poison 6%/turn, burn 5%/turn (stops regeneration), stun (lose a turn), slow, haste, might, guard,
  focus, weak, brittle, regen 8%/turn, barrier, taunt (enemies pick you 75% of the time). Bosses shrug off most control
  (stun ×0.15, others ×0.5) and take 40% damage over time.
- **Bosses enrage** below half health (faster, glowing).
- **Auto battle** uses the same brain as the test bot: revive the fallen, heal the hurt (mass heal when two are low),
  set up buffs once in a fight worth buffing, then the best expected damage (weaknesses, groups, finishing blows),
  keeping a healer's MP reserve; potions only when no healer can help.
- **Pacing.** The sim resolves an action whole and emits events; the view plays them as a queue and the AI waits
  (`AI_DELAY`, held while the view is busy), so every action is seen.

### The tower
- 10 strata of 10 floors (Mossy Undercroft, Crystal Grotto, Haunted Library, Ember Forge, Frostbound Gallery, Clockwork
  Halls, Sunken Garden, Astral Observatory, Abyssal Throne, Skyreach Summit), each with 5 monsters, a mini boss and a
  boss. Past 100 they return **Ascended** (recoloured, +25% per cycle on top of the curve): the tower is endless.
- Enemy stats: `base × (1 + 0.1(f−1)) × 1.045^(f−1)` (`enemyMult` in `stats.js`), while heroes grow `(1 + 0.1(L−1)) × 1.022^(L−1)`. Up to 4 enemies,
  elites from floor 4 (up to 25%, +60% HP, double rewards, a core), wanderers from earlier strata from floor 11.
- **Checkpoints** at 1 and every floor after a beaten boss (11, 21, …).

### Heroes, classes, skills (`js/sim/data/heroes.js`)
Nine heroes, each in a base class with two evolutions (level 15) and an ascension (level 40, 5 shards) that adds an
ultimate: Knight → Paladin / Warlord, Cleric → Saint / Oracle, Berserker → Juggernaut / Bloodreaver, Rogue → Assassin /
Shadowdancer, Ranger → Sniper / Beastmaster, Mage → Archmage / Spellblade, Bard → Maestro / Skald, Alchemist →
Bombardier / Apothecary, Warlock → Hexblade / Necromancer. 27 classes, 108 skills. One skill point per level: learning
costs 1, ranking up costs the current rank (rank 5 max, +15% power a rank). Benched heroes learn 35% of each battle's
experience; heroes on errands earn while you're away.

### Gear (`js/sim/data/items.js`, `stats.js`, the Forge)
Weapons by class, armour by weight (plate, jerkin, robe), accessories (ring, amulet, charm). Item level = the floor it
came from; five rarities (rare and epic roll percentage affixes). Upgrades +1…+10 (+15 for uniques), +10% power each,
costing gold, ore and, from +5, Ember Shards. **Reforging** raises an old favourite to your best floor and keeps its
upgrades. 16 boss and mini-boss **uniques** with effects (regen, crit damage, fire attacks, haste at the start, auto-
revive, +20% everything…) and 8 bond **keepsakes**. Three monster cores buy an epic piece; three shards a day can be
bought as a gold sink.

### Town, quests, real time
- **Tavern (Old Bram):** recruit heroes as you reach their floor (Brakka at 2, Sylas 4, Lyra 6, Thorne 8, Pip 12,
  Grimble 16, Nyx 22); they join near the company's level with gear for your floor.
- **Evenings:** one companion per evening. A quiet evening grows the bond; at each rank a scene plays with a choice:
  the right answer ranks the bond up (+3% stats a rank; +2 skill points at Close Friend; a keepsake at Soulbound), the
  wrong one costs a little and the scene waits. 8 companions × 5 scenes, some of them romances.
- **Guild (Corwin):** three daily bounties rolled from 8 templates and scaled to your best floor, plus 13 milestones.
- **Temple (Sister Amaya):** skills, evolution, ascension.
- **Market (Zephyrine):** supplies, six gear pieces a day, shards, core trades, selling.
- **Treasury:** the idle tithe (8-hour cap) and errands, collected by hand; the daily bonus streak (7-day ladder with
  an epic piece on day 7) and the day's blessing (+25% gold, +25% xp, +10% attack…).
- Real time enters the sim only as numbers: `act(G, { t: 'idle', now })`, `act(G, { t: 'daily', day: 'YYYY-MM-DD' })`.

## Story

The Watcher at the gate speaks after each boss (`WATCHER_BOSS`): the Colossus was the tower's root, the Archivist wrote
every climber's name, Malgrath sat on a borrowed throne, and Aurelion, the Ember Dragon at floor 100, burned because it
was afraid — "and yet the tower still climbs." The companions each carry a thread (Mira's fever theory, Brakka's
exile, Sylas who stopped liking people, Lyra's dying forest, Thorne's sister, Pip's mother, Grimble's lost brother,
Nyx's pact) resolved through the bond scenes. There is no ending: the game is endless by design.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Menus | Arrows, Enter / Z, Esc / X | D-pad, A, B | Tap |
| Battle commands | 1–5, arrows + Enter | D-pad + A | Tap; tap a monster to target it |
| Auto battle | A | X | Auto toggle |
| Back / menu | Esc | B / Start | ☰ |

## Look and sound

- 93 fal images (see [dev/art/README.md](dev/art/README.md)): 70 monsters, 18 hero sprites, 15 portraits, 18 backdrops,
  64 icons, all 16-bit pixel art under one style prompt, cut out and downscaled to their native pixel grid.
- The battle canvas draws the backdrop, monsters on the left and the party on the right in a diagonal, with idle bobbing,
  lunges, hit flashes, element-coloured particle bursts and slashes, turn markers, HP bars, golden auras for ascended
  heroes, hue-shifted elites and Ascended strata. Numbers float as DOM text so they stay crisp.
- The UI is classic JRPG windows: navy gradients, gold double borders, Pixelify Sans.
- ElevenLabs audio (see [dev/audio/README.md](dev/audio/README.md)): six music themes (title, town, evening, battle, boss,
  victory), 14 effects (hits per element, heals, revives, coins, anvil, roars, level-up) and 34 voice lines from a cast
  of 15 (battle cries, victory lines, recruit lines, greetings, the Watcher's narration). The original chiptune
  sequencer and synth effects remain as the fallback and for UI blips.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, town, tower), battle pacing against the view's queue, input routing, idle and daily wiring, saving, debug hooks |
| `js/sim/game.js` | `newGame`, `act(G, cmd)` for every command, `step` (AI pacing, auto-climb), saves, shared queries |
| `js/sim/battle.js` | Turn order, actions, damage, statuses, enemy AI and the auto-battle brain |
| `js/sim/loot.js`, `stats.js` | Rewards, gear making, experience; level and floor curves, stat blocks |
| `js/sim/bot.js` | The whole-game bot (town, climb, evening, rest) for tests and balance |
| `js/sim/data/*.js` | Strata and monsters, heroes and classes and skills, monster acts, items, story, quests |
| `js/view/stage.js` | The battle canvas and its animation queue |
| `js/ui.js` | Town, buildings, party and equipment, bestiary, battle commands, rewards, dialogue |
| `js/audio.js` | ElevenLabs music, effects and voices; synth fallback |
| `js/input.js`, `save.js`, `assets.js`, `rng.js`, `config.js` | Keys and gamepad, guarded storage, art paths and icon atlases, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). 880 sim checks (purity, data, rules, determinism, the bot), a browser test on desktop,
two touch-only phones and blocked storage.

## Balance notes

The first bot run found the economy broken: floor 79 on day 5 and hundreds of millions of gold. Gear tracked the floor
while levels lagged, so gear carried the party; errands paid absurd experience; prices didn't track income. Fixes: gear
power ×4 per level (was 6) and +10% a plus (was 12%), the enemy curve steepened to 1.045, enemy base stats raised,
errand and tithe rates cut by about 5×, all prices on `goldScale`, and a daily shard purchase as a gold sink.

Now (30 days, 4 seeds):

| | day 5 | day 10 | day 20 | day 30 |
|---|---|---|---|---|
| Diligent bot (recruits, upgrades, learns, bonds) | 19 | 29–38 | 48–54 | 49–59 |
| Lazy bot (none of that) | 9 | 9 | 9–19 | 9–19 |

Bosses are the walls (floors 49, 59, 69 stall the diligent bot for days). The simtest asserts the bands: the first boss
within five days but not floor 30, between floors 30 and 70 by day 20, the diligent bot well ahead of the lazy one, and
still defeated sometimes.

## Open questions / next steps

- Nobody has played it but the bot; it has only run in headless Chromium. Balance past floor 70 is extrapolated.
- The voice-line split points were checked by length against the text, not by ear.
- More voice lines (evening scenes) and per-stratum battle themes would be the next audio pass.
- The Garden preview image is the title art.

## Changelog

### v1.0.1 (2026-11-10)
- Fixed: in battle the heroes and monsters looked like they were floating above the floor. Their feet were placed as high as y 236 of 360, on the strip of floor at the foot of each backdrop's far wall; they now stand between y 290 and 352 on the near floor, with a two-layer contact shadow, and only flying monsters hover (walkers no longer bob). The floor label moved to the top-right so it no longer covers the back-row hero.

### v1.0.0 (2026-11-10)
- First release: an endless tower of 10 strata (70 monster designs, 10 mini bosses, 10 bosses, Ascended past 100),
  charge-time turn-based battles with elements, statuses, auto battle and auto-climb; 9 recruitable heroes, 27 classes,
  108 skills, evolution and ascension; upgradable and reforgeable gear, 16 uniques and 8 keepsakes; the tavern, forge,
  market, guild, temple and treasury; 40 bond scenes; daily bounties and milestones; daily bonus, blessings, idle tithe
  and errands. Art by fal, audio by ElevenLabs.
