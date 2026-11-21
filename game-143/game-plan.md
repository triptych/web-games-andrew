# Doom & Doilies: The Sugar Siege

**Genre:** Town-building tycoon with castle-defence sieges, and a story
**Engine:** Vanilla JS, Canvas 2D. Generated art (fal) and audio (ElevenLabs), with code fallbacks
**Status:** v1.2.0

---

## Concept

The sequel to [Doom & Doilies](../game-110/). At the end of the first game, Lady Noxia, the Dread Lady who would
rather be baking, was found out. Instead of torches and pitchforks, the village of **Thistlegloom** voted her
**mayor**: it turns out she had been feeding half of them anonymously for a year, and the doilies were a clue.

Now **King Crumbleton**, the Gingerbread Zombie King, is marching from the Stale Lands with the Crumb Horde. Each
phase gives the Mayor a few days to build up the town's shops and facilities and meet a readiness checklist. Then the
game changes: she commands the wall on the left while gingerbread zombies and other sweet, whimsical creatures come in
from the right. Hold the wave and she wins time to go back and build again.

All the while she is secretly preparing the **Grand Bake** in the Great Oven. In the fourth wave the King himself
comes, and he can't be beaten. Instead she reveals the **Cookie Queen**, Queen Honeysnap, a gingerbread girl baked
just for him. She crosses the battlefield and they kiss, and like a frog prince the stale old zombie King is baked fresh
again: young, golden and handsome. The war ends. After that comes an endless **epilogue**:
keep building and fend off the leftovers who never heard the news.

It riffs on village tycoons (Townsmen, Kingdom Two Crowns' build-and-hold rhythm), wall defence (Defend Your Castle,
Grow Castle), and the first game's cosy-spooky household.

### The undercurrent: nobody is what the rumours say
The whole story is about not judging people by what they look like or what everyone says about them, told gently and
never as a lecture:
- The village assumed the Dread Lady was a monster; she was a baker. Now she is their mayor.
- Sir Tobias, the hero who besieged her castle "because everyone said you were a monster", comes back to apologise.
- Gerald the gingerbread golem is shunned because the invaders are gingerbread too. Tansy throws him a tea party so
  everyone meets him properly ("The Golem Who Wasn't").
- Madame Silkwhistle, the spider seamstress people cross the street to avoid, opens a knitting circle; the woman who
  used to scream at her joins it.
- The "wicked" ghost in the end cottage was just cold ("The Ghost Who Was Just Cold").
- Ottilie points out that most witches are nice; it's only the loud ones who get the stories.
- Even the enemy: beaten invaders don't die, they curl up for a nap. The King isn't evil, he's lonely: he was baked
  alone for a contest nobody came to judge. The war ends with a kiss, and the gingerfolk who stay get houses.
- The cast is varied (Granny Hollyhock, Hilde the stonemason, Brother Fennel, Lark, Moss), and nobody's job,
  temperament or role is a joke about how they look.

## Core loop

1. **Town (real time, days of 40 s, ×1/×2/×3 or pause).** Build on plots, staff buildings, keep villagers housed and
   hopeful, take quests, upgrade the wall, hire adventurers, keep the Great Oven fed.
2. **The countdown.** Phase 1 gives 7 days, then 8, 9 and 10. The Siege panel lists what the town should have.
3. **The siege (real time).** Aim and throw doilies, use staff abilities, watch the wall. Win: the next phase begins,
   with gold and sugar from the field. Lose: the wave comes back in 3 days, smaller. The King's wave: reveal the Queen,
   or he withdraws for 3 days.
4. **Epilogue.** Leftover waves every 6 days, tougher each time; the count held is the score.

## State (`G`, all plain data; ids, never references)

`mode` (town | battle), `phase` (0–3, 4 epilogue), `day`, `dayT`, `daysLeft`, `today` (the day's happening),
`res` {gold, flour, sugar, stone}, `pop`, `hope`, `hopeBonus`, `plots[12]` ({b: {kind, lvl, build, up, ripe}} or empty),
`hall`, `wall` {lvl, build, hp, max}, `oven` {lit, starved}, `bake` {pct, ings[], honey}, `unlocks`, `staff`
{id: {joined, at: plot}}, `advs` {id: {hired, lvl}}, `quests` {active[], done{}, paid{}}, `battle` (below),
`retries`, `ended`, `epi` {waves, best}, `stats`, `flags`, `speed`, `rngState`.

`battle`: `wave`/`epi`/`n`, `t` (negative during the brace), `sched` [{t, kind}] and `si`, `enemies` [{id, kind, x, y,
hp, max, atk, nap, sit, block, push}], `shots` [{kind, target, tx, ty, dmg, t, dur, r}], `aim`, `cd`, `wall`, `armor`,
`doilyDmg`, `towers`, `advs`, `knight`, `abil`, `webT`, `morale`, `king`/`kingStopT`/`queen`/`canQueen`, `result`.

## Commands and input

`act(G, cmd)`: `build {plot, kind}`, `upgrade {plot}`, `demolish {plot}`, `assign {staff, plot}`, `hall`, `wall`,
`hire {adv}`, `train {adv}`, `oven {on}`, `deliver {id}`, `collect {plot}`, `collectAll`, `nextDay`, `speed {v}`, and in a siege `ability {id}` and
`queen`. `step(G, {ax, aim, fire}, dt)`: the siege reads the aim (drift with keys, absolute from a pointer) and
whether a doily is being thrown.

## Events

`scene`, `questNew`, `questDone`, `delivered`, `day`, `build`, `built`, `demolish`, `assign`, `hired`, `trained`,
`oven`, `ovenStarved`, `bakeMilestone`, `ripe`, `collect`, `refused`, `invasion`, `throw`, `hit`, `calm`, `splash`, `arrow`, `wallHit`,
`ability`, `knightDown`, `knightUp`, `kingArrives`, `kingLooms`, `queen`, `kiss`, `battleOver`, `battleEnd`.

## Mechanics

### Town
- **Plots:** 12; 8 open at Town Hall level 1, 10 at 2, 12 at 3. Hall level 2 costs gold only, so a town short of stone
  can always grow.
- **Buildings** (`js/sim/data.js`): Cottage (housing 6/level), Windmill (flour), Sugarbeet Patch (sugar), Quarry (stone),
  Bakery (flour + sugar → gold and hope), Market (gold per villager), Knitting Circle (hope, wall armour 8%/level),
  The Grinning Gourd (adventurer rooms 2/4/5), Watchtower (a crossbow in a siege), Belfry (hope, siege morale),
  Witch's Kitchen (doily damage +30%/level), The Great Oven (unique), Gingerfolk Cottage (epilogue; housing 8).
  New buildings take 0.15 day (six seconds), upgrades 0.4 day; levels ×1, ×1.8, ×2.8; each level costs 2.4× the last.
- **Harvest bubbles:** every building but the oven fills a bubble over 10 s. A tap (or `C` for all) collects 8 s of
  what it makes (at least 4 of each), or 6 gold per level from a building that makes nothing (rent, tavern tips, a
  sold cozy). The town always has something to tap, and the attentive player earns about twice the idle rate early on.
  The view also floats a small "+N" over each building every 2.2 s for what it actually made (taxes rise from the hall).
- **Workers:** every building needs villagers (more per level); with too few, everything runs at `pop / needed`.
- **Hope** drifts toward a target: base 38, plus building hope, quest rewards and the day's happening, minus fear over
  the last four days before a siege. Output × (0.6 + 0.8 × hope/100). Villagers arrive when hope ≥ 30 and there is room,
  and leave below 18.
- **Staff** assigned to a building: +60% where they belong (★), +25% elsewhere.
- **Daily happenings** (55% of mornings): rain, a pumpkin festival, Pudding the moon cat, scouts, fog, a candy
  merchant, Granny's pies.

### The Grand Bake
The Great Oven, while lit, burns 0.22 flour and 0.22 sugar per second per level and bakes 0.1%/s × level × staffing ×
hope (×1.3 with honey). It can only reach 25% per ingredient: **Mother's Recipe Card** (The Great Oven), **Moonlight
Vanilla** (Granny Hollyhock, at 20%), **Royal Icing** (Madame Silkwhistle, at 45%), **A Spark of Life** (Lord Vellum and
Wick, at 70%). Honey comes from "Bees in the Belfry".

### The siege
- The field runs from x 0 (the wall) to 100. Enemies arrive in packs of 3–5 and walk left; at the wall they batter it
  (damage × (1 − armour)).
- **The Mayor's doilies:** 6 damage, splash radius 3, every 0.6 s (faster with morale), thrown up to x 62, so anything
  further must be left to the towers and archers. Hold to keep throwing.
- **Watchtowers:** 6 damage/s each × level (+25% with Grizelda), range 75, nearest first.
- **Adventurers:** Sir Tobias holds ground enemies at x 12 (flyers go over him); he goes down for 12 s (6 with Brother
  Fennel) when beaten. Moss shoots arrows (range 90). Ottilie's potions splash. Lark makes everyone faster. Brother
  Fennel mends the wall. Training: +40% per level, up to 5.
- **Staff abilities:** Sticky Web (Silkwhistle, everything at half speed 6 s), Candle Flare (Wick, 70 around the aim),
  Gerald Stomp (knocks the near ground troops back), Bun Barrage (Pip, five buns on the five nearest).
- **Beaten enemies nap** (2.2 s), then wander off; gumdrop slimes split in two first.
- **Readiness:** meeting every checklist item gives the wall +15%.
- **Lose:** one building loses a level, stores ×0.85, hope −10, the wave returns in 3 days with 15% less HP per retry
  (up to 45%).
- **The King** (4,000 HP) walks to x 34 and looms. He can't be beaten below half and regenerates. With the bake at
  100% and the King standing still mid-field, the Queen button appears: the horde sits down, Queen Honeysnap walks
  out, they kiss, and 1.6 s into the kiss the King transforms into his young, freshly baked self (a flash, golden
  sparkles and hearts). The war is over; in the epilogue the royal couple stroll around town.
  Without it, he withdraws 60 s after he stops: three more days.
- **Epilogue waves:** 28 × (1 + 0.22n) enemies from the pool, HP × (1 + 0.15n), a golem for every two waves held.

## Content

| Siege | Name | Enemies | HP × |
|---|---|---|---|
| 1 | The First Crumbs | 22 zombies, 8 candy-corn imps | 1.2 |
| 2 | The Gumdrop Push | + slimes, marshmallow ghosts, licorice spiders, 2 peppermint brutes | 1.7 |
| 3 | The Sugar Storm | + sugar-skull bats, cupcake mimics, 4 brutes, a jawbreaker golem | 2.15 |
| 4 | The Cookie King | everything, 2 golems, and King Crumbleton at 30 s | 2.9 |

Eighteen quests (`QUESTS`), from "Somewhere to Sleep" to "Tansy's Drawing". The main-story ones always arrive; others
queue up to five at a time.

## Story

`SCENES` in `js/sim/data.js`: the election, the King's march, the regroups between waves, the napping scout who explains
the King's loneliness, the King's arrival, the reveal, the ending. Quest introductions and thanks carry most of the
character work. Voiced lines (ElevenLabs) are marked with `[speaker, n]`.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Throw a doily (hold to keep throwing) | Space / Z | A / X | tap or hold on the field |
| Aim | ← → / A D | stick / d-pad | where you tap |
| Abilities | 1 – 4 | LB, RB, LT, RT | the round buttons |
| The Queen | Q | Y | the big pink button |
| Build / inspect | — | — | tap a plot (drag to pan the town) |
| Panels | Q S H G B in town | — | the dock |
| Time | 0 – 3, N sleeps until morning | — | ⏸ 1× 2× 3× ☾ |
| Menu | P / Esc | Start / B | ❚❚ |

## Look and sound

- **Art** (`art/`, fal nano-banana-2): HD-2D pixel art. Portraits and sprites of the household were made from
  game-110's sprites with the edit endpoint, so they look like themselves (Lord Vellum keeps his party hat). Buildings in a
  three-quarter view, enemies facing left, heroes facing right, three backdrops. `dev/art/README.md` has the prompts
  and the pipeline.
- **Town view:** the painted village green with plots in three rows in depth, the Town Hall with the Mayor on the steps,
  villagers and staff strolling, smoke from the oven, a dusk tint with lit windows, drifting fog. Wider than a phone:
  drag to pan.
- **Siege view:** the side-on battlefield, the wall sprite by level, towers behind it, adventurers on the walkway, the
  Mayor throwing, Sir Tobias holding the line, packs of enemies with walk bobs, napping sprites, doilies spinning on an
  arc, splash rings, a web over the field, hearts for the kiss, a pink sky for the ending.
- **Sound** (`audio/`, ElevenLabs): a spooky-cosy waltz for the town, a whimsical march for sieges, a pipe-organ theme
  for the King, a love theme for the ending; 17 effects; 31 voice lines for nine characters. A Web Audio synth covers UI
  blips and anything that fails to load. `dev/audio/README.md` has the prompts and the cast.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, canvas and key input, events → dialogue/toasts/screens, debug hooks |
| `js/sim/game.js` | `newGame`, `step`, `act`, the day cycle, quests, invasion hand-off, battle results, saves |
| `js/sim/town.js` | Buildings, workers, hope, production, the oven, town commands |
| `js/sim/battle.js` | Readiness, waves, enemies, shots, the knight, abilities, the King and the Queen |
| `js/sim/data.js` | Every table: buildings, staff, abilities, adventurers, enemies, waves, quests, cast, scenes, gossip |
| `js/sim/advice.js` | `nextGoals(G)`: Lord Vellum's ranked suggestions (what to build and why, what's short, where "Show me" goes) for the tip card and the What next? window |
| `js/sim/bot.js` | Whole-game bot with a skill dial (town planning and siege aim) |
| `js/view/view.js`, `assets.js` | Canvas 2D town and siege, particles; image loading |
| `js/ui.js` | DOM HUD, panels, dialogue, siege HUD, result and ending sheets |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (≈340 checks): purity, every rule, harvest bubbles and the advisor (following the tips through the first phase), content cross-references (every
portrait, sprite and voice clip the data names exists), determinism and a save round trip in the middle of a siege,
siege calibration bands, and the bot finishing the story at skill 1 and 0.3. `browsertest.mjs` drives the real game on
desktop, two touch-only phones and with storage blocked, through building, panels, a siege, Save & Quit, the King,
the Queen, the ending and the epilogue.

## The helper (v1.1.0)

A first player didn't know what to do and sat waiting for money. Now:
- **Tutorial:** after the intro, Lord Vellum explains building, bubbles, his tip card and speeding time up; before the
  first siege, how the wall works.
- **Tip card** (bottom left, above the dock): the advisor's top goal with **Show me**, which scrolls the town to the
  plot, drops a bouncing arrow on it and opens it with the suggested building first and outlined (or opens the right
  panel). ✕ hides it until the next story step; the 💡 **Next** dock button (or `T`) opens **What next?**: the top six
  goals, each with Show me, and a short guide to how the town works.
- **The advisor** ranks: a first lesson in bubbles; quests ready to hand in; homes when jobs outnumber villagers; the
  bakery as soon as there's flour and sugar; the story quests' buildings and the producers every town needs; lighting the
  oven; the siege checklist (jumping the queue four days out); idle staff; side quests; the cheapest useful upgrade;
  and finally "speed up time". A goal short of a resource nobody makes yet points at the maker first, and one that
  can't be afforded says how much is missing and to tap bubbles.
- **Locked buildings** show in the build list with the quest that unlocks them.
- **A faster start:** 300 gold, 100 stone, 40 flour, 30 sugar; quarry 0.5 stone/s; watchtower 50 stone; bigger
  rewards on the first side quests. `simtest` follows the tips through the first phase on three seeds: never more than
  25 s with nothing doable, the story quests done and the first checklist met.

## Modes, time away and polish (v1.2.0)

From a play session's notes:
- **Three modes**, picked on New Game: **Story** (`story`): the bot's town half (`storyTurn` in [bot.js](js/sim/bot.js),
  every 2.5 s) builds, upgrades, delivers, hires and staffs; the player only holds the wall, and the tip card says so
  with a Speed up button. **Normal** (`normal`): unchanged. **Hard** (`hard`): a lost siege ends the game
  (`G.over`, a `battleEnd` with `result: 'over'` and a `legacy`); the save is deleted and the legacy (`HARD.keep` of
  the stores, `HARD.refund` of every level's cost of the standing buildings) waits in storage for the next new game,
  whatever its mode. `G.diff` holds the mode; old saves load as normal.
- **Time away**: `act({ t: 'idle', sec })` pays `IDLE.share` of the town's positive net production for one town day per
  `IDLE.perDay` real seconds, between `minDays` and `maxDays`, with a gold floor; nothing under `IDLE.min`. main.js
  claims it on Continue (from the save's timestamp) and when a hidden tab comes back. The UI shows a toast, then
  Lord Vellum's tally and three villagers' lines on the tip card (Next ▸ skips), and the ticker repeats them.
- **Notes on the tip card**: the card can be taken over for a few seconds by a note: the time-away news, and Lady
  Noxia's cheers (one when the tip changes and 30 s have passed since the last, or after 60 s on the same tip).
  The test harnesses turn the cheers off unless `&cheer=1`.
- **Bubble timers**: `ripe` per building kind in data.js, times `RIPE_JITTER[plot]`, stored on the building as `rt`;
  the harvest scales with `rt / HARVEST.ripe`, so a slow bubble pays more and the rate is unchanged.
- **The "!" badge**: `canUpgrade` / `canUpgradeHall` in town.js.
- **Facing**: the sprites that face right (zombie, corn, slime, ghost, bat, the young King) are mirrored in a siege.
- **Steady HUD**: fixed-width boxes for the wall's number and the resource counts.

Story mode with a fair or sloppy wall bot (skill 0.6 and 0.3, three seeds each) wins every siege first time and reaches
the Queen in about 30 minutes.

## Balance notes

From `dev/balance.mjs` (whole games) and `dev/siege.mjs` (one siege against a town that exactly meets the checklist):

| Siege, ready town | No aim | Sloppy (0.3) | Fair (0.6) | Sharp (1) |
|---|---|---|---|---|
| 2 The Gumdrop Push | lost | won, 100% wall | won, 100% | won, 100% |
| 3 The Sugar Storm | lost | won, 66–81% | won, 86–98% | won, 100% |
| 4 The King (no Queen) | lost | held, 99–100% | held, 88–100% | held, 95–100% |

Whole games: every bot finishes in 38–50 minutes. The Sugar Storm is the hard wave: the bot's towns are usually under the
checklist and lose it once or twice before winning; the King is usually resolved on his first or second visit.

v1.1.0 (bubbles and the faster start): the per-siege bands above are unchanged (they use a town that exactly meets the
checklist), but whole-game towns are richer and usually beat the checklist, so every bot now finishes in 34–35 minutes,
the King meets the Queen on his first visit, and the Sugar Storm is won first time with 44–100% of the wall left at
skill 0.3 and 60–100% at 0.6. The bot found one more trap: with plenty of flour it filled every plot with bakeries and
never built a tower or an oven; extra bakeries now wait until the story's buildings are in.

What the bot found along the way:
- Bun Barrage was 256 damage every 22 s (more than a tower) and Pip joins on day one: the first two sieges were won by
  doing nothing. Now five buns of 22.
- Enemies trickling in one at a time died at the edge of the field: zero wall hits for every skill. Packs and the
  doily's 62 range fixed it.
- A town that filled its six plots before building a quarry could never afford the stone for the Town Hall: a soft-lock.
  Now 8 plots to start and the first hall upgrade costs gold only.
- Losing knocked three levels off and took 25% of the stores: a death spiral the bot never escaped. Now one level and
  15%, and each retry makes the wave 15% weaker.
- The bake at 0.06%/s meant five or six King visits; at 0.1%/s it's one or two.

## Open questions / next steps

- A human pass on real hardware: the balance is bot-tuned, and the bot aims better than most people.
- More quests and town events for the epilogue; seasonal decorations.

## Changelog

### v1.2.0 (2026-11-21)
- Three modes: Story (Lord Vellum runs the town), Normal, Hard (a fallen wall ends the game; the next starts with a head
  start).
- Time away pays out part of the town's production, with news on the tip card and the ticker.
- Lady Noxia's cheers between the tips; a gold "!" over affordable upgrades; bubbles ripen at each building's own pace.
- Fixed: five enemy kinds walked backwards; the siege bars twitched as the wall's number changed width.

### v1.1.0 (2026-11-20)
- Lord Vellum's helper: a tutorial after the intro and before the first siege, a tip card with Show me, a What next?
  window (💡 Next, `T`), and locked buildings in the build list with how to unlock them.
- Harvest bubbles on every building (tap, or `C` for all, or the ✨ button) and rising "+N" numbers for what each
  building makes.
- A faster, richer start: more starting gold and stone, six-second builds, more stone from the quarry, cheaper
  watchtowers, bigger early quest rewards. The town view sits above the tip row so no plot hides behind it.

### v1.0.0 (2026-11-19)
- First release: Thistlegloom's town (13 buildings, workers, hope, staff), four sieges and an endless epilogue, 18 quests
  and the story scenes, the Grand Bake and the Cookie Queen; generated art and audio with code fallbacks; sim, balance
  and browser harnesses.
