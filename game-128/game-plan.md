# Gemheart Saga

**Genre:** match-3 fantasy RPG with a village builder and idle production
**Engine:** Vanilla JS, Canvas 2D for battles, DOM for everything else. Art generated with fal, music, effects and voices with ElevenLabs.
**Status:** v1.0.0

---

## Concept

The light of the Vale is going out: something in the east is drinking the Gemheart, the crystal under the hills whose
light is in every jewel, harvest and lantern. Choose one of four heroes and walk the Vale in real-time match-3 battles,
grow a skill tree, gear up, and build up Briarwick, the village that takes you in and backs you with gold, materials and
blessings, even while you're away.

It riffs on the puzzle-RPG family (gem battles where colours are mana and skills spend it) and on village-builder idle
games, with 32-bit-era pixel art in the spirit of late-1990s Saturn and PlayStation RPGs. The tone is warm and
storybook, with a bittersweet nemesis in every tale.

## Core loop

1. **Briarwick**: collect what the village produced while you were away, claim the daily gift, upgrade a building,
   spend skill points, buy and upgrade gear, claim villagers' requests.
2. **Adventure**: the next chapter of your hero's tale (a scene, two to four battles with scenes between, a scene), or a
   **patrol** (two quick fights near your level in a region you've reached) for gold, XP and materials.
3. A **battle**: a real-time match-3 board against one foe at a time. Health carries over between the fights of a quest.
4. Back home with the spoils. Repeat until the Gloam Sovereign falls; then patrols, requests and the village go on.

## Battles (`js/sim/board.js`, `js/sim/battle.js`)

### The board
- 8x8, six kinds: **sword** (hits the foe for 0.5× attack a gem), **heart** (heals 3% of max health a gem), and four
  coloured gems (**ruby, sapphire, emerald, amethyst**) that each fill a mana pool (1 a gem, cap 24) and chip the foe for
  0.18× attack a gem, doubled when the colour is the foe's **weakness**.
- **Real time and fluid.** Gems fall under gravity (60 rows/s², max 26 rows/s); a match forms the moment gems rest; the
  player may swap any two resting gems at any time, even while other columns are still falling or clearing. A swap
  takes 0.14 s; a swap that makes no match bounces back. Matched gems take 0.2 s to vanish.
- **Cascades**: each match resolved before the board settles is one step of the chain; damage and healing grow 25% a
  step past the first (more with Kael's Valor).
- **Special gems**: 4 in a line → a **line gem** (clears its row or column when matched); an L or T → a **bomb** (3x3);
  5 in a line → a **prism**, which matches nothing but, swapped with any gem, clears every gem of that colour (two prisms
  clear the board). Swapping two specials sets both off. Everything a blast clears counts as collected.
- **Stone** never matches and breaks when a match lands next to it. **Chained** gems can't be swapped (matching them
  frees them). **Doom gems** count down 9 s and burst for 2× the foe's attack unless a match lands next to them first.
- No move left → the board reshuffles. 6 s without a move → the best move pulses as a hint.

### The foe
- Attacks on its own timer (3.2–5.6 s), paused during a 1 s "Ready" and while frozen. Damage taken is
  `atk × 100 / (100 + defence) × (1 − damage reduction)`, shields absorb first.
- **Abilities** cycle with its attacks: `stone` (3 gems to stone), `lock` (chain 3), `doom` (plant a doom gem, at most
  2), `drain` (6 mana from the fullest pool), `heal` (every third attack, 12%), `shield` (every other attack, 15% of its
  health), `poison` (5 s, 1.2% a second); passives `enrage` (below half health, 30% faster) and `haste`.
- Stats from the level: `hp = 320 · (1 + 0.25(lv−1)) · m · rank`, `atk = 18 · (1 + 0.2(lv−1)) · m` (rank factor 1 /
  0.75 / 0.62 for normal / elite / boss, which have larger multipliers to start with).

### The hero
- Three **active skills** (the first node of each branch) on buttons under the scene (keys 1–3), each costing mana of
  one or two colours: damage, shields, gem conversion, freezes, column waves, a wolf companion, healing. A skill whose
  cost includes the foe's weakness hits 1.5×.
- **Items** (keys 4–6, 2.5 s cooldown): potions, mana tonic, fire bomb, shuffle scroll (also clears stone and doom).
  A Phoenix Feather in the bag revives at 50% when you fall; a level 5 Temple does it once a quest at 30%.
- Winning pays gold, XP, the region's material and a share of wood/ore/grain; elites and bosses pay double and
  quadruple and bosses always drop gear. A loss sends you home; nothing earned is lost.

## The heroes and their tales (`js/sim/data/heroes.js`, `story.js`)

| Hero | Class | Tale | Order of the Vale | Nemesis | Shape |
|---|---|---|---|---|---|
| Kael Ashborne | Ashen Knight: sword +10%, tanky | The Broken Oath | Greenmarch → Emberdeep → Frostfang → Mirefen → Gloamspire | Sir Varek the Oathbreaker | oath |
| Sela Moonbrook | Tide Mage: skills +20%, blue/violet mana +20% | The Drowned Library | Mirefen → Greenmarch → Frostfang → Emberdeep → Gloamspire | Magister Quell, her drowned master | oath |
| Fenn Quickfoot | Thornwood Ranger: 8% crit | The Withering Wood | Greenmarch → Mirefen → Emberdeep → Frostfang → Gloamspire | Rotroot, the oak who raised him | hunt |
| Brother Odo | Lantern Monk: hearts +20%, most health | The Dimming | Frostfang → Greenmarch → Mirefen → Emberdeep → Gloamspire | Vesper, his fellow novice | hunt |

Ten chapters each, 40 different scenes. **Oath** tales meet the nemesis in the third region, which then gets two
chapters, and the last chapter fights the nemesis and the Sovereign back to back. **Hunt** tales meet the nemesis
before the third region's boss, fight them for good in chapter 9 and the Sovereign alone in chapter 10. Foe levels run
1, 3, 5 … 19 by chapter (finale foes +1), whatever the region, so each order plays fair. Each tale ends with its own
epilogue; the Sovereign's last words and every nemesis's first and last lines are voiced.

**Skill trees**: three branches of three nodes (active, passive, passive), three ranks each; a tier needs a rank in the
tier above it and the last tier needs level 6. One point a level (cap 30). The four trees are in `heroes.js`.

## Briarwick (`js/sim/village.js`, `data/village.js`)

| Building | Villager | Does | Levels |
|---|---|---|---|
| Town Hall | Elder Maren | caps every other building at its level; idle stores hold 4 + 2 h a level; daily gift ×level; requests board | 1→5 |
| The Gilded Goose (inn) | Bess Tallow | 15–110 gold an hour; +5% XP a level | 1→5 |
| Market | Pell Farthing | sells consumables and gear up to tier = level, 4% off a level; buys spare gear | 1→5 |
| Temple of the Lantern | Mother Ilse | hearts +10% a level; +5 starting mana at 3; revive once a quest at 5 | 0→5 |
| Armory | Garrick Ironhand | upgrades gear (+15% of base stats a step) to +2 per level; +2 attack a level | 0→5 |
| Thistledown Farm | Tobin | 10–75 grain an hour; +5% max health a level | 1→5 |
| Lumber Mill | | 10–75 wood an hour | 0→5 |
| Copperhill Mine | | 8–60 ore an hour | 0→5 |
| Mage Tower | | 2–16 crystal an hour; +6% skill damage a level | 0→5 |

**Idle**: production runs on the real clock while the game is closed, capped by the hall's storage hours; collect it
from the village. **Daily gift**: once a calendar day, gold (80 × hall + 40 × streak), 30 × hall of each common
material and 4 × hall crystal; a streak of consecutive days (to 7) grows it, and the gift starts a two-hour **harvest
festival** that doubles all production. Time is never read inside the sim: `now` and the local `day` are passed in.

**Requests**: sixteen villagers' tasks (kills by region, cascades, special gems, buildings, levels, upgrades, doom gems
defused, gold spent, a daily streak), each paying once.

## Content

- 5 regions × 6 foes (5 + an elite), 4 region bosses, 4 nemeses, the Gloam Sovereign: 39 foes with art.
- 24 pieces of gear in 3 slots and 5 tiers, 6 consumables.
- 4 heroes × 9 skill nodes.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Swap gems | arrows move the cursor, Space picks up, an arrow swaps | d-pad, A | drag a gem onto its neighbour, or tap one then the other |
| Skills | 1 2 3 | X Y B | tap the skill button |
| Items | 4 5 6 | | tap the item button |
| Pause | P / Esc | Start | ❚❚ |
| Menus | arrows, Enter, Esc | d-pad, A, B | tap |

## Look and sound

32-bit-era pixel art from fal (see [dev/art/README.md](dev/art/README.md)): painted backdrops for the title, the village
and each region, battle sprites cut from key colours and drawn with nearest-neighbour scaling, portraits, isometric
buildings, gem and item atlases and painted skill tiles. Battles: the scene on top (phones) or left (wide screens), the
board below or right; gem-coloured orbs fly from each match to the foe or (hearts) the hero; numbers, banners, shakes
and flashes, all toned down by Reduce motion or `prefers-reduced-motion`.

Music, effects and 37 voice lines from ElevenLabs (see [dev/audio/README.md](dev/audio/README.md)); Web Audio tones
stand in for anything that fails to load.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step battle loop, input routing, events to view/audio/UI, saving, debug hooks |
| `js/sim/board.js` | The real-time match-3 board: swaps, gravity, matching, specials, curses |
| `js/sim/battle.js` | Gems → effects, the foe and its abilities, skills, items, winning and losing |
| `js/sim/village.js` | Buildings, idle production, the daily gift, the Market, the Armory, requests |
| `js/sim/game.js` | `newGame`, `act`, `step`, tales, quests, scenes, levels, save format |
| `js/sim/stats.js` | Hero stats and modifiers from tree, gear and village; foe stats |
| `js/sim/bot.js` | The auto-player: battles, the village, whole campaigns |
| `js/sim/data/` | Heroes, the world, items, the village, the four tales |
| `js/view/battle.js` | Canvas battle: scene, board, particles; board pointer and keyboard cursor |
| `js/ui.js` | DOM: title, hero choice, scenes, village, panels, skill tree, HUD, results |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/assets.js`, `js/rng.js`, `js/config.js` | Sound, presses, guarded storage, art paths, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the board, the battle, the village, the tales, the media
on disk, determinism and save round trips, and has the bot play all four tales at two skill levels. `browsertest.mjs`
drives the real game on desktop, touch-only phones in both orientations and with storage blocked.

## Balance notes

Tuned against the bot (`runCampaign`: village between quests, the next chapter when the hero is within a level of it,
patrols otherwise; 15 minutes of village clock a quest). Skill 1 reacts in about 0.7 s and plays the best move it can
see; skill 0.6 takes about 1.5 s and plays a random legal move a third of the time, roughly a human pace.

| | Skill 1 | Skill 0.6 |
|---|---|---|
| Seconds a fight | 8–9 | 19–25 |
| Falls in a whole tale | 0 | 0–4 |
| Quests to finish (10 chapters + patrols) | 35–38 | 35–41 |
| Level at the end | 18–19 | 18–19 |

What changed because of it:
- The first pass had 70 hp foes: fights lasted 3 s. Foe health went to 320 base and attack to 18, which put a human-speed
  bot at about 25 s a fight, and gave elites and bosses rank factors so they don't drag.
- Every building stalled on wood: battles now pay a share of wood, ore and grain whatever the region, not just the
  region's own material, and crystal was cut back (it piled up unused).
- Fenn and Odo fell far more than Kael at skill 0.6; Fenn got +15 health and +2 defence, Odo +1 attack and +1 defence,
  Sela +5 health and +1 defence.
- v1.1.0: players found foe attacks too quick. Every foe's attack interval is 1.6× longer (none attacks more often than
  every 4 s; simtest checks it) and base attack went 18 → 22 so a hit still matters. Falls at skill 0.6 dropped.
- v1.1.1: a player lost chapter 1's Bandit Captain every time, with most of its health left. It was the chapter's
  finale, so it fought a level up (660 health, 34-damage blows), and the hero arrived with what the first two fights
  left. Now only real bosses fight a level up, the first two chapters' foes have 65%/85% health and 75%/90% attack
  (`STORY_EASE`), and the hero gets a quarter of their health back between the fights of a quest (`QUEST_REST`).
  A skill-0 bot (85% random moves, 2.8 s apart) clears chapter 1 with every hero; simtest checks it. At skill 0.25 a
  whole tale costs 7–20 falls, mostly late.
- The village reaches Town Hall 3–4 by the end of a tale; levels 4–5 of the other buildings are the post-story goal.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. In particular, how the board's
  fluid swapping feels under a finger, and whether 25-second fights feel right.
- More foes per battle (a pack), or a second board mechanic per region, if fights feel samey by chapter 10.
- New Game+ with a second hero keeping the village would use the four tales better.

## Changelog

### v1.2.1 (2026-11-11)
- The ticker said the same hint three times running when it was the only one due: the chatter turn fell back to it.
  Now a hint comes round only every 45 s, a chatter turn is always chatter, and no line repeats within the last 12.
  Every hint has three to five phrasings from different villagers; chatter grew to eight lines a villager plus lines
  about the hero, the tale, wins, best chain, level, the village, the streak, gold, the festival and the time of day.

### v1.2.0 (2026-11-11)
- Foe abilities are telegraphed: "Next: Chains" under the attack timer, a boxed "Chains incoming!" warning at 70% of
  the timer, a boxed alert saying what happened and what to do when it lands, rings on the gems it touched, and a status
  line (chained, stone, doom countdown, foe shield, poison). `abilityOn`/`nextAbility` in `sim/battle.js` drive both
  the attack and the label.
- A skill bounces when a match feeds mana it needs.
- Line gems: a beam in the gem's colour with gold arrowheads pointing the way they clear, instead of a white bar.
- The village ticker (`js/ticker.js`): every 7 s a villager speaks, hints and chatter in turn; a hint (skill points,
  better gear, daily gift, collect, full stores, finished requests, the next chapter or patrols, a building or an
  Armory upgrade you can afford, low potions) is a button that takes you there.
- Resource chips are buttons: a tip says where more comes from (the building that makes it, the region whose foes
  pay it, battles, the daily gift), built from the data.
- Gear tab: Equip best and Remove all (`equipBest`, `unequipAll`, `unequip` commands); worn gear can be taken off.
- The Collect button fills toward the next whole unit, with "Next: +1 gold in 3:12" under it, or "Stores full!".
- A "Battle 2/3" card at the start of each fight of a quest (the final one says so).
- Fixed: a new tale's idle production never started until the game was reloaded (the first collect came during the
  opening scene and was ignored); it now starts on reaching Briarwick.

### v1.1.2 (2026-11-11)
- One rule for every button: pressable buttons have a gold edge and lift on hover; actions in list rows (buy, sell,
  equip, upgrade, claim, patrol) are gold-filled; unavailable ones are flat, dashed and dim with the reason as a tooltip,
  and a price you can't pay is red. The panel's title bar is opaque with a divider, so scrolled text no longer shows
  through it.

### v1.1.1 (2026-11-11)
- Chapter 1's finale (the Bandit Captain for Kael and Fenn) was a wall for new players. The first two chapters are
  gentler, only real bosses fight a level up, and the hero catches their breath (+25% health) between fights.

### v1.1.0 (2026-11-11)
- Battle sprites are drawn smaller (hero 45% of the stage height, foes 42/52/64% by rank) from art exported at twice
  the size and scaled down smoothly, so they no longer look zoomed and blocky; gems and backdrops sharper too.
- Foes attack 1.6× less often (attack 18 → 22).
- Green badges on buttons with something to do: unspent skill points (and better gear) on Hero & Skills and its tabs,
  learnable skill nodes outlined in green, finished requests on Requests, "!" on Adventure when the next chapter is in
  reach; Collect lights up when there is something to collect.
- Board gems have a bold black outline.
- Battle HUD labels have a dark outline and a soft dark band behind them, so the coloured "Weak:" label reads over sky.
- Performance under software rendering: battle art is scaled down once to its drawn size and cached instead of filtered
  every frame; the village swaps in only the parts that changed on its once-a-second refresh (and not under the ending);
  the idle canvas is cleared once, not every frame; the village backdrop is darkened with a gradient, not a CSS filter.

### v1.0.0 (2026-11-11)
- First release: a real-time fluid match-3 battle (line, bomb and prism gems, cascades, stone, chains, doom gems), four
  heroes with their own ten-chapter tales, nemeses and endings, three-branch skill trees, gear with upgrades, nine
  upgradable village buildings with idle production, a daily gift with a streak and a harvest festival, villagers'
  requests, patrols; 46 fal images, 6 music tracks, 20 effects and 37 voice lines from ElevenLabs.
