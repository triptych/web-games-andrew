# Sigilborn — Overlord of the Endless Spire

**Genre:** Fantasy gacha auto-battler / hero collector with idle, crafting and life-sim layers
**Lineage:** Summoners War (ATB turns, runes, evolution), AFK Arena / Idle Heroes (idle treasury, portrait UI),
Epic Seven (turn-order bar, manual skill play), Raid (gear-set hunting), Legends of Idleon (mining/farming side-loops)
**Engine:** three.js r165 (ES modules via import map), toon shading with inverted-hull outlines, vanilla JS/HTML/CSS, no build step
**Target:** phones first (portrait, touch, ≥ 44 px targets, ≥ 14 px text), scales to desktop
**Assets:** none — every model, face, texture, icon and sound is generated in code
**Status:** v1.0 — design below, implementation in `js/`

---

## 1. Research — what the best of the genre get right

| Quality | Who does it best | How Sigilborn uses it |
|---|---|---|
| **A collection you want to complete** — visible rarity, stars, a big roster with distinct looks | Summoners War (1000+ monsters, 5 elements each) | Every hero is *procedurally generated*: race, class, element, rarity, rolled stats with a grade, traits, a skill kit and a full 3D look. No two recruits are the same; a 1-in-50 *Radiant* variant is the shiny. |
| **The pull is an event** — anticipation, colour-coded tease, pity so bad luck ends | Genshin / Epic Seven portals | A 3D sigil portal that charges blue → purple → gold before the reveal; soft pity from pull 60, hard pity at 90; a featured element and class rotate weekly. |
| **Speed is king** — an ATB system where turn order is a stat you can build | Summoners War | SW's attack-bar model (SPD × 0.07 % per tick), turn-order bar on screen, ATB push/pull skills, slows. |
| **Gear is the endgame** — slot main stats, random substats, set bonuses, risky upgrades | SW runes, Raid artifacts | 6 slots, 5 rarities, +0 → +15 with falling success odds, a substat roll every +3, 12 sets (2- and 4-piece), reforging. |
| **Elements and roles matter** | SW, Epic7 | Fire › Wind › Water › Fire, Light ⇄ Dark. Advantage = +25 % damage and +15 % crit; disadvantage = glancing hits. Twelve classes across Attack / Defense / HP / Support. |
| **Auto battle that is fun to watch, manual play that is better** | Epic7, SW | Auto with 1×/2×/3× speed, or tap skills and targets yourself. Overlord spells are the player's own hand in every fight. |
| **Progress while away** | AFK Arena | The Treasury fills with gold, XP and loot by the minute based on your furthest stage (12 h cap, upgradable). Farms grow, miners dig, trainees level and expeditions run in real time. A "While you were away" summary on return. |
| **A reason to log in daily** | All of them | Dailies + activity chest, weeklies, a free Fortune Wheel spin, rotating shop, arena tickets, crops ripening. |
| **An endless mountain to climb** | SW Trial of Ascension, AFK King's Tower | The Endless Spire: infinite floors, a boss every 10th, a roguelite Blessing pick every 5th. |
| **Sinks for duplicates and junk** | SW fodder evolution | Evolve with same-star fodder, fuse same-class heroes for skill-ups, release for Soul Dust. |
| **Your own avatar** | Many | The Overlord: built in a deep character creator, levels up, spends talent points, and casts spells in every battle. The same creator restyles any hero (Wardrobe). |

---

## 2. Pitch

The Sigil Throne was shattered and its heroes scattered across the planes. You are the **Overlord**
who claims the broken throne on a floating citadel. Through the Summoning Circle you call heroes out
of the sigil-light — every one of them unique — and lead them across eight regions, into elemental
rifts, through the Arena and up the **Endless Spire**. Between battles, your citadel works: the mine
digs, the farm grows, the kitchen cooks, the forge hammers, expeditions roam.

---

## 3. Heroes (procedural)

Every hero is a seed plus a few rolled facts; the seed rebuilds the same hero forever.

- **Rarity / stars:** 1★ Common · 2★ Uncommon · 3★ Rare · 4★ Epic · 5★ Legendary · 6★ Mythic (reached by evolving).
  Natural rarity scales base stats (×0.80 … ×1.10), trait count, skill quality and leader skill.
- **Races (10):** Human, Elf, Dwarf, Orc, Beastkin, Undead, Demonkin, Fae, Dragonkin, Golem — each with stat leanings,
  name phonology, skin palettes and anatomy (ears, horns, tails, wings, height, head size).
- **Classes (12):** Knight, Berserker, Ranger, Mage, Assassin, Cleric, Bard, Necromancer, Paladin, Monk, Druid, Warlock —
  each with a stat template, weapon family, outfit family and a pool of basic / active / ultimate / passive skill templates.
- **Elements (5):** Fire, Water, Wind, Light, Dark — tint the outfit palette and flavour every skill name.
- **Stats:** HP, ATK, DEF, SPD, Crit Rate, Crit Damage, Resistance, Accuracy. HP/ATK/DEF each roll 85–115 %, SPD ±4;
  the average sets a **grade** S / A / B / C.
- **Traits (24):** 0–3 by rarity — Swift, Brutal, Stalwart, Hale, Keen, Deadly, Resolute, Precise, Vampiric, Thorned,
  Last Stand, Opener, Vengeful, Regenerator, Glass Cannon, Bulwark, Elementalist, Executioner, Guardian Angel, Scholar,
  Miner, Green Thumb, Explorer, Lucky.
- **Radiant:** 1 in 50 — alternate palette, sparkles, +10 % all stats.
- **Skills:** Basic (no cooldown), Active (CD 3–4), Ultimate (CD 5–6), Passive (3★+), Leader (4★+). Names generated from
  element adjective + class noun ("Cinder Volley", "Umbral Requiem"). Skill level 1–5.
- **Progression:** level (cap 15/20/25/30/35/40 by star), Evolve (max level + N same-star fodder → +1★),
  Awaken (essences → +15 % stats, aura, upgraded ultimate, epithet), Skill-up (tomes or fusing a same-class hero),
  Gear, Wardrobe (full appearance editor).

Stat formula: `stat = base × natMult × G[star] × (1 + 0.03 × (level − 1))`, with `G` chosen so a fresh evolve keeps
~90 % of the previous star's max-level power.

## 4. Battle

- Teams of up to 5 vs. 3 waves (bosses on the last wave of boss stages).
- **ATB**: every tick each unit gains SPD × 0.07 % of its bar; at 100 % it acts and resets.
- **Damage**: `mult × stat × 1000 / (1140 + 3.5 × DEF)`, × element (×1.25 adv / ×0.85 dis), × crit (1 + CD),
  glancing ×0.7, ±5 % variance, × buffs/debuffs/marks.
- **Debuff landing**: chance × (1 − max(15 %, RES − ACC)).
- **Statuses**: ATK↑ DEF↑ SPD↑ Crit↑ Shield Immunity Regen Counter Endure / ATK↓ DEF↓ Slow Stun Silence Burn Poison
  Heal Block Mark Provoke Blind.
- **Overlord spells**: mana fills as allies act; two equipped spells (Smite, Rally, Haste, Meteor, Aegis, Doom).
- **Modes**: Auto (AI picks skills and targets) or Manual (tap a skill, tap a target). 1×/2×/3× speed.
- **Rewards**: gold, hero XP, Overlord XP, gear drops, sigil shards, essences, first-clear gems.

## 5. Gear ("Sigilstones")

6 slots (Weapon, Helm, Armor, Gloves, Boots, Amulet). Weapon = ATK, Helm = HP, Armor = DEF flat mains; Gloves,
Boots, Amulet roll a % main (Boots can roll SPD). Rarity Common → Legendary = 0–4 starting substats. Upgrade +0 → +15
for gold with falling success odds; every +3 adds a substat or boosts one. 12 sets: Vigor, Guard, Blade, Focus, Endure
(2-pc) and Swift, Rage, Fatal, Vampire, Despair, Violent-style Fervor, Revenge (4-pc). Reforge rerolls one substat.
Crafted at the Forge from ores, dropped in battle, found on expeditions and in mine chests.

## 6. Summoning

| Sigil | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Common | 55 % | 35 % | 9 % | 0.9 % | 0.1 % |
| Mystic | – | – | 87 % | 11 % | 2 % (soft pity 60+, hard pity 90) |
| Elemental (fire/water/wind) | – | – | 87 % | 11 % | 2 % (element locked) |
| Light & Dark | – | – | 80 % | 17 % | 3 % |
| Legendary | – | – | – | – | 100 % |

Weekly featured element + class: half of all 4★/5★ Mystic results roll inside the featured pair.
50 Sigil Shards craft 1 Mystic Sigil. Ten-pull guarantees at least one 4★. Gems buy Mystic Sigils.

## 7. Modes

- **Campaign** — 8 regions × 8 stages (boss on stage 8), each region its own biome and element bias; 3 stars per stage.
- **Rifts** (dungeons) — Essence Halls per element (essences), Gilded Vault (gold), Armory (gear); 10 tiers each, stamina.
- **Endless Spire** — infinite floors; enemies scale ~6.5 % per floor; boss each 10th; a pick-1-of-3 Spire Blessing every
  5th (persists for the climb); token rewards and milestone gems.
- **Arena** — async PvP against procedurally generated rival Overlords near your power; tickets regenerate; ranks
  Bronze → Legend; tokens.
- **Expeditions** (exploration) — a board of procedurally named locations with durations 15 m – 8 h, element/class bonuses,
  success chance from party power, random events and loot rolls, great-success crits.

## 8. Citadel (idle hub)

A floating island rendered in 3D with day/night from the real clock; heroes from your roster wander it. Tap a building:

| Building | Job | Upgrades |
|---|---|---|
| Throne | Overlord: talents, spells, appearance | — |
| Summoning Circle | Summons | — |
| Treasury | Idle loot (gold/XP/gear/shards) | rate +10 %/lvl, cap 12 → 24 h |
| Mine | Interactive dig + idle miners | richer ores, more pick energy, more miner slots |
| Farm | Real-time crops, watering, golden mutations | plots 4 → 12, growth speed |
| Kitchen | Cook crops into XP elixirs and timed feasts | — |
| Forge | Craft / upgrade / reforge gear | better craft odds, cheaper upgrades |
| Training Grounds | Passive hero XP in training slots | slots, XP/min |
| Tavern | Quests, expedition board | expedition slots |
| Market | Daily rotating shop, gem shop, token shops, Fortune Wheel | — |
| Spire, Arena | Entry points | — |

## 9. Mining

A 3D rock face, 7 columns × endless depth. Tap a block next to open space to strike it with your pick; blocks have
hardness by tier. Ores: Copper, Iron, Silver, Gold, Mithril, Adamant, Starmetal; gems: Ruby, Sapphire, Emerald,
Topaz, Amethyst, Diamond. Random specials: geodes (gem burst), treasure chests, fossils (sell for gold), essence
crystals, and rare sigil caches. Pick energy regenerates. Clearing to the bottom row descends a layer; deeper layers
change the ore table. Assigned miner heroes (Miner trait doubles) produce ore while you are away.

## 10. Farming & cooking

Plots grow Wheat (5 m), Carrot (10 m), Pumpkin (30 m), Sunberry (1 h), Moonbloom (2 h), Dragonfruit (4 h), Starmelon (8 h).
Watering each growth stage cuts 20 % of the remaining time. 6 % golden mutation (×3 yield + gem). Farmer heroes boost
yield (Green Thumb doubles). Seed packs roll random seeds. Kitchen recipes: Hero Snack, Hearty Stew, Sunberry Tart
(+25 % gold 30 m), Moonbloom Tea (+25 % XP 30 m), Dragon Feast (+10 % ATK 30 m), Starmelon Ambrosia (huge XP).

## 11. Quests

Main questline (guided onboarding, 30 steps); 8 dailies drawn from a pool + 100-point activity chest; weeklies;
tiered achievements that award gems and Overlord titles.

## 12. Overlord

Built in the **character creator** (also used for any hero as the Wardrobe):

- Body: race, build, height, head size, skin tone (palette + free colour)
- Face: eye style (10), eye colour, brows, mouth (8), blush, markings (8), scar
- Hair: 16 styles, base + tip colour
- Features: ears (5), horns (7), tail (5), wings (5), horn/wing colour
- Outfit: 10 armour styles, primary/secondary/accent colours, cape (4), headwear (8), shoulders
- Weapon: 14 types, metal colour, glow colour
- Aura: 6 effects
- Name generator by race, presets, randomize all / per tab with locks

Account level 1–60 grants talent points: Might, Fortitude, Bastion, Celerity, Fortune, Sovereignty (10 ranks each).
Spells unlock by level; two are equipped for battle.

## 13. RNG mechanics (summary)

Summons with pity and featured pairs · hero stat grades, traits and Radiants · gear mains, substats, upgrade success,
reforge · battle crits, glancing, debuff landing · drop tables with rarity tiers · Treasury rolls · Fortune Wheel ·
rotating shop stock · Spire Blessings (pick 1 of 3) · mine block contents and specials · crop mutations and seed packs ·
expedition success, great success and events · arena opponents.

The run's RNG stream is part of the save, so reloading does not re-roll a pull.

## 14. Presentation

- **Toon look:** `MeshToonMaterial` with a 3-step gradient, a fresnel rim term injected via `onBeforeCompile`, and
  inverted-hull outlines. Characters are chibi: big heads, painted canvas faces (anime eyes, brows, mouths, blush),
  merged per-limb geometry with vertex colours so each limb is one draw call + one outline.
- **Scenes:** title/citadel, showcase (hero detail, creator, team), summon portal, battle arenas (8 biomes + rifts + spire),
  mine, farm, spire.
- **FX:** pooled additive particle system (one draw call), slash arcs, projectiles, rings, shields, floating numbers in DOM,
  camera shake and ultimate zooms, element-coloured flashes.
- **UI:** DOM over the canvas; Cinzel headings, Nunito body, 16 px base, 14 px minimum, high-contrast outlined numbers.
  Bottom tab bar (Citadel · Heroes · Summon · Adventure · Quests), top currency bar. Generated SVG icons.
- **Mobile:** DPR capped at 2 with adaptive quality, blob shadows instead of shadow maps, portrait-first layouts,
  safe-area insets.
- **Audio:** WebAudio synthesised SFX and a generative ambient score.

## 15. Architecture

```
js/
  main.js            boot, router, frame loop, autosave
  core/              rng, state + save/load + offline catch-up, event bus, formatting
  data/              tables: elements, races, classes, skills, traits, gear, crops, ores, regions, quests…
  sim/               pure logic, no DOM / three: heroes, stats, gear, summon, battle, enemies, idle, mine,
                     farm, kitchen, quests, expeditions, spire, arena, overlord, shop, wheel
  view/              three.js: renderer, toon materials, character + monster builders, scenes, fx, portraits
  ui/                DOM screens and widgets
  audio.js
dev/
  simtest.mjs        node: sim invariants, distributions, determinism, battle balance bots
  browsertest.mjs    playwright: desktop + phone flows, no console errors, screenshots
```

## 16. Build checklist

- [x] Design (this document)
- [x] Core: rng, state, save/load, offline catch-up
- [x] Hero generator, stats, traits, skills, names, lore
- [x] Gear generator, upgrade, reforge, sets
- [x] Summoning with pity and featured pairs
- [x] Battle simulation (ATB, skills, statuses, AI, manual hooks, overlord spells)
- [x] Campaign, rifts, spire, arena content
- [x] Idle treasury, training, mine, farm, kitchen, expeditions, quests, shop, wheel, overlord
- [x] Toon renderer, character/monster builders, all scenes, FX, portraits
- [x] UI screens for every system, mobile layout
- [x] Character creator
- [x] Audio
- [x] Node sim tests + Playwright browser tests
