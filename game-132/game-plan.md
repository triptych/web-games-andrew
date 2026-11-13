# GIANT'S VAULT

**Genre:** isometric action RPG (loot hunt), single player
**Engine:** three.js r165, sim/view layout. Art by fal, 3D models by Meshy, music, effects and voices by ElevenLabs; every
asset has a code-made stand-in, so the game runs (and the tests pass) with any of them missing.
**Status:** v1.0.0 in progress

This file is the game design document. Sections 1–6 are the six pillars of the brief; everything after them is how
this repo builds and tests the game. Every number quoted here is in `js/config.js` or `js/sim/data/*.js`, which are the
source of truth: if the two disagree, the code is right and this file has a bug.

---

## 0. The pitch in one paragraph

Before the gods left the world they chained the Giants beneath it and set wardens to watch them. The gods are gone,
the wardens are few, and under the mountain Kolossar has begun to pull. You are a Vaultwarden. You pick one of three
oaths (**Ironsworn** steel, **Stormcaller** lightning, **Shadebinder** shadow), take a second at level 6 and become one
of three hybrids, and fight down through a drowned marsh, a city of tombs and a giant's forge to bind Kolossar again.
Then the Vault cracks open and the endless **Rifts** begin. It plays like Diablo II's dread wearing Greek
mythology at Torchlight II's speed: big packs, loud colours on dark stone, loot that fountains, and a lynx-wolf who
carries your junk to town.

**Design pillars, in priority order** (when two collide, the higher one wins):
1. **The next drop could be the one.** Every kill is a lottery ticket; every legendary changes how a skill plays.
2. **Readable chaos.** Thirty monsters and a screen of lightning, and you can still see the red ring that will kill you.
3. **Two oaths, one hero.** No build is a single tree; the interesting decisions are where trees touch.
4. **Never wait.** The pet sells, the potion refills, the portal is one button. Friction exists only where it makes a
   decision (death costs gold, potions have a cooldown).

---

## 1. Setting, tone and narrative

### 1.1 The look: gothic-mythic

Three ingredients, always mixed:

| Ingredient | From | In the game |
|---|---|---|
| **Classical ruin** | Greek myth | Fluted columns, meander friezes, bronze and marble, hoplite helmets, Greek names |
| **Gothic dread** | Diablo II | Darkness as the default, tombs, bone, candle-pools of light, monsters that were once people |
| **Saturated readability** | Torchlight II | Teal, violet and molten orange accent glows; rarity beams; chunky silhouettes |

The palette rule is *dark ground, bright danger, brighter loot*. Floors are desaturated (fal textures at ~70% value),
monsters sit one step brighter, enemy attacks are red/orange, the player's spells are their mastery colour, and loot
is the only thing that glows straight up. Each area has its own fog, sky and key-light colour (`AREAS` in
`data/world.js`), so a screenshot says which act it is.

### 1.2 Structure: three acts, a town and an endless end

| Act | Areas (monster levels) | Boss | Key | Mood |
|---|---|---|---|---|
| — | **Lantern's Rest** (town) | — | — | Warm lanterns in a cold night. Merchant, chronicler, waystone, stash, rift obelisk. |
| I | **The Drowned Wilds** (1–5) → **Temple of the Tide-Eye** (5–8) | Skyllith, Maw of the Drowned Temple | the Tide-Key | Marsh, reeds, half-sunk colonnades. Teal and green. |
| II | **The Ashen Necropolis** (9–13) → **The Ossuary Depths** (13–17) | Morwen, the Ossuary Queen | the Soul-Key | Tombs under a violet sky, ash falling like snow. |
| III | **The Bronze Halls** (18–22) → **The Giant's Vault** (22–26) | Kolossar, the Chained Giant | the Flame-Key | Forge-halls, bronze plates, furnace light. |
| ∞ | **Vault Rifts**, tier 1, 2, 3… (26 + tier) | a Rift Guardian | — | Every biome at once, violet and gold. |

A first playthrough is about 60–90 minutes for a person (the bot does it in about 25 minutes of game time at full
speed; see Balance). Each act ends in a boss whose fight teaches one thing: Skyllith teaches **telegraphs** (step out of
the ring), Morwen teaches **target priority** (kill the summons or be buried), Kolossar teaches **phases** (the fight
changes at 66% and 33%).

### 1.3 The plot

- **Intro card:** the chains are rusting. Old Heron the Chronicler sends you down the road to the Vault.
- **Act I:** the sea-god of the Tide-Eye temple is dead, but something is still answering the prayers. Skyllith, a
  hydra that ate the god's last priests, holds the first of three keys.
- **Act II:** Morwen was a warden for sixty years. Kolossar spoke to her through the stone and promised the dead would
  never have to sleep; she has been forging a key out of fallen wardens' souls ever since. She is the warning: this is
  what listening to him does.
- **Act III:** the Bronze Halls are the forge that made the chains. At the bottom, Kolossar. You can't kill a giant
  (a scorched letter in the halls says so); you **bind** him with his own broken chains, which is what the boss fight's
  final phase is.
- **Ending card:** the chains hold, but the fight cracked the Vault, and through the cracks are rifts into everywhere
  the giants ever touched. The endgame is not a postscript; it is the story's last line.

### 1.4 Environmental storytelling

The story is told mostly by the places, not by cutscenes:
- **Lore tablets** (`LORE` in `data/world.js`): 2–3 per area, placed by the seed in dead-end rooms so exploring pays.
  Each is one or two sentences; most are funny-sad (a gravedigger complaining that old Corvin keeps getting up).
- **Set dressing that argues**: defaced warden statues in the Necropolis, sarcophagi cracked from inside, chain links
  "large as a cart" with the gods' names scratched out *from the inside*.
- **Monsters as history**: Bone Thralls wear rusted *warden* armour; Bronze Sentinels still carve GUARD into their
  order-stones; the Grave Hag raises thralls from the corpses you leave.
- **The Chronicler's book**: the Hint button reads the current quest from Old Heron's book, in his voice.

---

## 2. Core mechanics and pacing (the loop)

### 2.1 The minute-to-minute loop

```
see a pack ──> engage (primary skill builds resource) ──> spend (big skill) ──> pack dies in a burst
   ^                                                                                    │
   └── pick up what glows <── the loot fountain (beams, sounds, filter) <── kill rewards ┘
```

Target rhythm: a normal pack (4–8 monsters) dies in **3–6 seconds**; an elite pack in **10–20**; a boss in **60–120**.
The gap between packs is short (density 2.2–3.4 packs per 100 floor cells) so that the "kill → loot → next" beat
repeats every 15–25 seconds. These are asserted as bands in `dev/simtest.mjs` (see Balance).

### 2.2 Control feel

- **Two movement schemes, both always on.** Click (or hold) the ground to walk there (Diablo); WASD/stick to move
  directly (Torchlight II's controller mode). The two never fight: a WASD press cancels a click-move.
- **Attack-move.** Clicking a monster walks into range and uses the primary skill (slot 1). Holding the mouse button on
  a monster keeps attacking; Shift holds you in place (attack without moving, the D2 "stand still" key).
- **Aim.** Skills aim at the mouse on desktop; on a stick they aim where you face, and **auto-target** the nearest
  enemy in a 70° cone (the touch deck's convenience). Ground-target skills (Leap, Thunderstrike, Frailty, Shadow Step)
  land on the aimed point, clamped to their range.
- **Fixed step.** The simulation runs at 120 Hz with an accumulator, so a 30 fps phone and a 144 Hz monitor play the
  same game; presses are latched until a step consumes them, so a fast tap is never lost.

### 2.3 Weight: hit-stun, poise and telegraphs

- **Poise / stagger.** Every monster has a `poise` (a fraction of its max life). A single hit bigger than
  `poise × maxLife` **staggers** it for 0.45 s: its attack wind-up is cancelled and it is knocked back a little. Small
  monsters (poise 0.08–0.12) stagger from most big skills; Sentinels (0.25) and bosses (0.5–0.6) almost never do from
  one hit. This makes big skills *feel* big and makes interrupting a charging Sentinel a skill.
- **Stagger stat.** Maces have +20% stagger; `staggerPct` rolls on weapons. Leap Slam and Thunderstrike have explicit
  stagger. Stun (Giant's Wrath, 1.5 s) is a separate, longer state capped at 2 s.
- **Telegraphs.** Every attack that can take more than ~30% of the player's life is preceded by a red ground ring for
  0.6 s (`MON.telegraph`): boss slams, Sentinel charges, the Thunderous elite nova, the Molten death blast. If it was
  in a ring, it was fair.
- **Hit feedback (view only):** hit-flash on the struck model, a lunge on every attack, sparks in the element's colour,
  camera shake scaled by damage, floating numbers. None of it changes the rules.

### 2.4 Screen-clearing AoE, on purpose

The ultimates (Giant's Wrath, Tempest, Harvest) clear a screen. That is the point: AoE is the payoff for building and
managing a resource, and the 24–28 s cooldowns keep it a beat, not a state. The density table is tuned so an
ultimate usually catches 6–12 monsters.

### 2.5 Resources: three loops that stop button-mashing

Each mastery has its own resource and its own rhythm. A hybrid has **two bars** and has to feed both.

| Resource | Gain | Loss | What it asks of you |
|---|---|---|---|
| **Rage** (Warfare) | +5 per Cleave, +2 per enemy hit, +1 per hit with Bloodlust, +taking damage | Leaks 7/s after 3 s out of combat | *Stay in the fight.* Rage is momentum: pull the next pack before it drains. |
| **Mana** (Storm) | Regenerates 7/s (+Conduit, +Spirit, +gear) | Spent by spells | *Pace yourself.* Spark Bolt is cheap; Thunderstrike and Tempest are not. |
| **Essence** (Umbra) | +4 per kill, +5 per Soul Rend, slow regen 1.5/s | Spent by spells | *Kill to cast.* Essence snowballs in big packs and starves on a lone boss. |

Every mastery has a **free primary** (Cleave, Spark Bolt at 5 mana, Soul Rend) that builds or barely costs, so you
are never stuck with nothing to press, and **spenders** with costs and cooldowns. The decision each second is "build
or spend", and the hybrids make it "which bar do I build?" A Reaver (Warfare + Umbra) wants Cleave to feed Rage and
kills to feed Essence; Blood Pact pays both on every kill.

### 2.6 Life, potions and globes

- **Potion:** 4 charges, heals 40% over 1 s, 2.5 s cooldown. Charges refill one per 9 kills and fully in town. You can
  never chain-drink, and you never run dry if you're killing (Diablo IV's rule).
- **Health globes:** 7% of kills (60% of elites) drop a red orb that heals 20% when touched (Diablo III). Fighting
  *forward* is how you heal; standing back and kiting is how you starve.

### 2.7 Death, checkpoints and the town portal

- **Waystones** stand near each area's entrance. Touching one saves it; from any waystone you can travel to any other
  you have touched, and to town.
- **Death** costs 10% of the gold you carry and 3 seconds. You wake at the last waystone you touched (or town) at full
  life. Monsters keep the damage you did them; elites heal 50%. No corpse run, no item loss: the penalty is time and
  gold, enough to make you care and not enough to make you quit.
- **Town Portal** is a skill, not a scroll: a 1.2 s channel that a hit interrupts, then a door appears where you stand
  and another in town. Walking through the town door returns you to the spot. Rifts allow it too, but the rift timer
  keeps running.
- **Rift deaths** add 15 s to the rift clock instead of costing gold.

---

## 3. Classes and the dual-mastery system

### 3.1 The three starting oaths

| Class | Mastery (resource) | Starting weapon | Attributes (Might / Cunning / Spirit / Vitality) | Plays like |
|---|---|---|---|---|
| **Ironsworn** | Warfare (Rage) | Sword | 14 / 10 / 6 / 12 | Leaps into the crowd and doesn't leave. Tankiest start. |
| **Stormcaller** | Storm (Mana) | Staff | 7 / 11 / 15 / 9 | Glass cannon. Chains, shocks, calls the sky down from range. |
| **Shadebinder** | Umbra (Essence) | Wand | 8 / 13 / 12 / 9 | Mid-range drain-tank with a small army. Gets stronger the more things die. |

**Attributes.** Might: +1% physical damage and +0.5% armour per point. Cunning: +0.2% critical chance and +0.5%
attack speed. Spirit: +1% lightning and shadow damage and +1 mana. Vitality: +4 life. 3 points per level.

### 3.2 How dual mastery works (the classic dual-mastery rule, tightened)

1. You start with your class's mastery. At **level 6** a shrine in town offers the other two; you take one, forever.
2. **Skill points**: 2 per level (78 by level 40). Each mastery has a **mastery bar** (ranks 0–10) and 7 skills
   (ranks 0–5). Investing in the bar does two things: it gives passive stats every rank (Warfare +3% life and +2%
   armour, Storm +3% lightning and +6 mana, Umbra +3% shadow and +4 essence) and it **unlocks tiers**: tier 1 at bar
   rank 1, tier 2 at 4, tier 3 at 7, tier 4 (the ultimate) at 10.
3. Maxing everything costs 2×10 + 14×5 = 90 points against 78 earned: **you cannot have it all**, so every build skips
   something. A typical hybrid at 40 has both bars at 10 (20 points), its ultimate(s), a primary, two spenders and a
   passive per tree.
4. The two masteries together name the **hybrid** and switch on its **synergy**, a passive neither tree has:

| Hybrid | Masteries | Synergy (always on) |
|---|---|---|
| **Thunderborn** | Warfare + Storm | *Galvanic Edge*: melee hits have a 20% chance to arc a Chain Lightning for 60% of its damage; every lightning crit gives 3 Rage. |
| **Reaver** | Warfare + Umbra | *Blood Pact*: every kill gives 4 Rage and 3 Essence; Leap Slam raises a Shade where you land. |
| **Eclipse Seer** | Storm + Umbra | *Void Current*: Shades cast Spark Bolt every 2 s; shadow damage against Shocked enemies is +25%. |

5. **Respec** is free in town at the Chronicler for the first 10 levels and costs gold after (100 × level). Undoing the
   second mastery is not allowed: the oath is the identity.

### 3.3 The skill trees (all 21)

Damage is a multiple of **weapon damage** (Diablo III's rule): one gear number scales every build, so a hybrid never
falls behind a pure class. `per` = added each rank above 1. Full text in `data/masteries.js`.

**Warfare (Rage)**

| Tier | Skill | Kind | Rank 1 → rank 5 | Cost / cooldown |
|---|---|---|---|---|
| 1 | Cleave | primary | 145% → 201% in a 120° arc, 2.6 m | builds 5 + 2/hit |
| 1 | Leap Slam | spender | 230% → 330% in 2.8 m, stagger | 22 Rage / 4 s |
| 1 | Iron Skin | passive | +12% → +60% armour, +4% → +20% life | — |
| 2 | War Cry | buff | +22% → +42% damage 7 s; taunts and breaks armour | 30 Rage / 14 s |
| 2 | Bloodlust | passive | +4% → +16% attack speed, life on hit | — |
| 3 | Whirlwind | channel | 85% → 125% every 0.3 s while moving | 16 Rage/s |
| 4 | Giant's Wrath | ultimate | 600% → 920% in 6.5 m, 1.5 s stun, +1.2%/Rage over 50 | all Rage (≥ 50) / 24 s |

**Storm (Mana)**

| Tier | Skill | Kind | Rank 1 → rank 5 | Cost / cooldown |
|---|---|---|---|---|
| 1 | Spark Bolt | primary | 125% → 177% lightning projectile; pierces 0 → 1 | 5 mana |
| 1 | Chain Lightning | spender | 170% → 230%, 3 → 5 jumps | 16 mana |
| 1 | Static Charge | passive | +3% → +11% crit; lightning hits Shock (+6% → +14% damage taken, ×3) | — |
| 2 | Storm Shield | buff | absorbs 22% → 42% of max life 8 s; zaps attackers 90% → 150% | 24 mana / 12 s |
| 2 | Conduit | passive | +8% → +32% lightning, +10% → +42% mana regen | — |
| 3 | Thunderstrike | ground AoE | 380% → 560% after 0.55 s in 3 m, stagger | 28 mana / 3 s |
| 4 | Tempest | ultimate | a bolt every 0.35 s for 8 s, 160% → 240% each | 45 mana / 28 s |

**Umbra (Essence)**

| Tier | Skill | Kind | Rank 1 → rank 5 | Cost / cooldown |
|---|---|---|---|---|
| 1 | Soul Rend | primary | 135% → 187% shadow at 7 m, heals 12% → 20% of it | builds 5 |
| 1 | Bone Spear | spender | 260% → 380% shadow, pierces everything | 18 essence |
| 1 | Shadow Step | movement | blink 8 m; 30% → 50% damage reduction for 1.5 s | 10 essence / 5 s |
| 2 | Raise Shade | summon | a Shade for 28 s, 70% → 110% a blow, 2 → 4 at once | 28 essence / 1 s |
| 2 | Grave Pact | passive | 3% → 7% shadow leech; +12% → +52% minion damage | — |
| 3 | Curse of Frailty | curse | +20% → +40% damage taken, 30% slow, 8 s, 4.2 m | 16 essence / 6 s |
| 4 | Harvest | ultimate | 460% → 700% shadow in 8 m; each kill heals 5% | 50 essence / 24 s |

### 3.4 A sample hybrid at level 30: the Thunderborn

*Ironsworn who took Storm at level 6. Points spent: 58 of 58.*

```
WARFARE  ██████████ 10                        STORM  ███████░░░ 7
 T1  Cleave ●●●●● 5   (primary; Galvanic arcs)  T1  Spark Bolt ○○○○○ 0   (skipped: Cleave is the primary)
     Leap Slam ●●●○○ 3 (gap closer)                 Chain Lightning ●●○○○ 2 (Galvanic Edge scales with it)
     Iron Skin ●●○○○ 2 (enough armour)              Static Charge ●●●●● 5 (crit → Shock → Galvanic Rage)
 T2  War Cry ●●●○○ 3   (the burst window)       T2  Storm Shield ●●●○○ 3 (the panic button)
     Bloodlust ●●●○○ 3 (speed → more arcs)          Conduit ●○○○○ 1
 T3  Whirlwind ○○○○○ 0 (skipped)               T3  Thunderstrike ●●●●○ 4 (big hit on elites)
 T4  Giant's Wrath ●●○○○ 2                      T4  Tempest (locked: bar 7)
```

**How it plays:** Leap into a pack → War Cry → Cleave. Every Cleave hit has a 20% chance to arc a Chain Lightning
(Galvanic Edge); Static Charge's crits Shock the pack and each lightning crit pays 3 Rage back, so Cleave on a big pack
is self-sustaining. Thunderstrike deletes the elite, Giant's Wrath clears the room when Rage tops out. The Storm tree
is there to turn melee hits into lightning, not to cast from range: that is the hybrid's identity. Its chase item is
**Thunderguard's Edge** (Cleave becomes lightning and arcs to 2 more), which makes every Cleave a Galvanic trigger *and*
a lightning crit source.

---

## 4. Loot, economy and itemisation

### 4.1 Rarity tiers

| Rarity | Colour | Random affixes | Drop weight (MF 0) | Notes |
|---|---|---|---|---|
| Common | white | 0 | 600 | vendor food (and the loot filter's first victim) |
| Magic | blue | 1–2 | 300 | early upgrades; a good 2-affix magic ring can beat a bad rare |
| Rare | yellow | 3–5 | 85 | the backbone of a build until legendaries |
| Set | green | fixed | 7 | 4-piece sets with 2- and 4-piece bonuses |
| Legendary | orange | 3–4 + a **power** | 7 | changes how a skill works |
| Mythic | red | 4 perfect rolls + a power + a socket | 0.6 | rift tier 5+ only; the "perfect" chase |

Magic find multiplies the weights of magic and above (with diminishing returns: `mf' = mf × 100 / (mf + 100)`).
A **legendary pity timer** forces one after 260 kills without, so a bad streak is never a dry hour.

### 4.2 Affixes and rolled ranges

An item is `{ base, rarity, ilvl, affixes: [{ k, v }], sockets }`. Each affix has a base range `[lo, hi]` multiplied by
the **item-level tier** `1 + (ilvl − 1) / 12` (a level-25 ring rolls three times a level-1 ring). Prefixes are offensive
or defensive bulk (Cruel = +% physical, Crackling = +% lightning, Hale = + life, Swift = attack speed…); suffixes are
attributes and utility (of the Bear = Might, of Warding = all resist, of Haste = cooldown reduction, of Fortune = magic
find…). An item has at most 3 prefixes and 3 suffixes; slots restrict what can roll where (movement speed only on
boots, attack speed never on chests). Some stats are **capped** (attack speed 30, crit 12, CDR 25, move 20): caps keep
one stat from eating a build. The rarest suffix, **of the Giant** (+1 to all skills of a mastery), only rolls on
amulets, helms and weapons. Full table: `AFFIXES` in `data/items.js`.

The tooltip shows each roll's **quality** (how far between lo and hi it landed) as a small bar, so "is this a good
roll?" is answerable at a glance. Comparing to the equipped item shows ▲/▼ per stat and a one-line DPS/toughness
delta.

### 4.3 Itemisation philosophy

- **Weapons scale everything.** Skills deal % weapon damage, so the weapon is the biggest single upgrade and every
  class wants a better one. Weapon *type* matters through implicits: sword +crit, axe +crit damage, mace +stagger,
  staff +lightning, wand +shadow.
- **Legendaries change verbs, not adjectives.** None of the 12 powers is "+20% damage". They make Cleave chain
  lightning, Thunderstrike fall three times, Leap Slam free, Shadow Step leave an exploding decoy. A legendary is a
  build-around, and a build is often "my two legendaries" (e.g. Grasp of the Drowned + Eye of the Tide: a pure Storm
  build where Chain Lightning jumps 6 times and Spark splits). Table: `LEGENDARIES`.
- **Sets are a commitment.** Aster's Bulwark (helm, chest, gloves, boots) turns War Cry into a 40% damage-reduction
  panic button that resets Leap; Raiment of the Sky-Thief makes Shadow Step cast Chain Lightning twice. Four slots for
  one power is a real trade against four rares.
- **Gems are the steady lever.** Four gems × four grades; in a weapon they add damage (Ruby +phys%, Topaz +lightning%,
  Amethyst +shadow%, Emerald +crit damage), in armour they add defence or utility (life, magic find, regen, resist).
  Three of a grade combine into the next at the merchant. Sockets roll on weapons (≤ 2), chests (≤ 2), helms and
  amulets (≤ 1).

### 4.4 Economy

Gold comes from the floor (35% of kills), from selling, and from the pet's town runs. Potions are free (they refill).
Gold goes to **gem combining** (50 × the next grade), **socketing** (adding a socket to an item that can have one:
500 × ilvl / 10, the main sink), **respec** (100 × level after level 10), and **gambling** at the merchant (an unknown
item of a chosen kind for 150 × level: 50% magic, 40% rare, 8% legendary, 2% set). Selling pays 25% of an item's price.
Death takes 10% of carried gold. The economy bot in `simtest.mjs` reports gold earned and spent per act.

### 4.5 The endgame chase: Vault Rifts

After Kolossar, the rift obelisk in town opens **Vault Rifts**:
- A rift is one generated level (any of the five biomes' tile sets, mixed) with 1–2 **modifiers** (Swarming, Brutal,
  Hardy, Elite, Bountiful, Hasty).
- Killing fills the **rift bar** (normal 1, champion 3, elite 6; 120 to fill). Full bar → the **Rift Guardian** (a
  boss from the campaign, rift-touched: +tier scaling, violet). Kill it for a boss drop and **tier + 1** unlocked.
- **Tiers never end.** Monster level is 26 + tier; life ×1.16 and damage ×1.08 per tier. Gear gets you to tier ~10,
  then your build has to be *good*. From tier 5, mythics can drop.
- **Ascension** (paragon) after level 40: every level's worth of XP gives 1 Ascension point, which is a free attribute
  point. It never stops, so a long rift session always moves a number.
- **Seasons / ladder resets (design only, not built):** every season starts a fresh character pool with one seasonal
  legendary power available to everyone, and a leaderboard of highest rift tier per class combination. The pure,
  seeded sim makes the leaderboard verifiable: a run submits its seed and input log, and the server replays it.

---

## 5. Companion and quality of life

### 5.1 The companion: Ember, the lynx-wolf

A Torchlight-style pet that is half fighter, half pack mule.
- **Fights.** Follows a few steps behind; attacks what you attack (or the nearest threat to you) for 55% of your weapon
  damage per bite; has 60% of your max life. When it would die it is **downed** for 8 s and then gets up. It never
  dies, because losing a pet is not fun.
- **Carries.** 16 slots. Items can be moved to it from the inventory (or picked up straight into it when your bag is
  full: Torchlight's best idea).
- **Runs to town.** "Send to town" makes Ember leave (a 22 s trip, during which it does not fight), sell everything it
  carries at the normal price, refill your potion charges, and come back with the gold. A full bag in the Ossuary is
  a button, not a walk.
- **Pet spells** unlock with your level, and cast themselves: **Howl** (level 1, taunts enemies around the pet for 3 s,
  16 s cooldown), **Mend** (level 8, heals you 25% when you drop under half life, 20 s), **Pounce** (level 14, leaps
  onto a far enemy, staggering it, 9 s). The Cinderheart legendary doubles its damage and makes bites burn; Grave Pact
  and minion affixes scale it.

### 5.2 Readability under a fountain of loot

- **Rarity beams.** Rare and better drops shoot a light column in their colour for 3 s and a small ground glow while
  they lie; legendaries and mythics get a sound (`sfx-legendary`) and a toast.
- **Labels on Alt.** Holding Alt (or the 🏷 button) shows every item's name above it, coloured, sorted so labels do not
  overlap; clicking a label picks it up from range.
- **The loot filter.** One setting, four steps: *All*, *Magic+*, *Rare+*, *Legendary+*. Items below the filter still
  drop and can be seen with Alt, but have no glow and no label. In addition gold and globes are always auto-picked up.
  The bot plays on *Rare+*.
- **Floating combat text.** Damage numbers rise from the struck enemy, coloured by element (white phys, blue lightning,
  violet shadow, orange fire), **bigger and yellow on crits**, merged when many land at once (a single number per
  enemy per 0.15 s). Damage to the player is red and drifts the other way. Heals are green on the player.
- **Elites read as elites**: a name plate with their affixes ("Fast Vampiric Bone Thrall"), a coloured ring under
  them (blue champion, yellow rare), and a health bar always shown.
- **Boss bar** across the top with phase ticks and the boss's name; its taunt lines appear as it changes phase.
- **Danger is red, only.** No player effect uses the red-orange ring colour reserved for telegraphs.

### 5.3 Other quality of life

Auto-pickup of gold and globes; "Sell all junk" (all commons and magics) at the merchant; compare tooltips with the
change in damage, toughness and life; a **stash** in town (60 slots); waystone travel; potions refilled in town and by
Ember's trips; the chronicle line under the area name always says what is next; full keyboard, gamepad and touch.

---

## 6. Technical blueprint

### 6.1 Architecture (as built)

```
index.html ── style.css
js/main.js            boot, modes (title → class choice → play ↔ screens), fixed-step loop, input routing
                      (mouse → aim, attack-move, click-to-move, labels, town features), event fan-out, debug hooks
js/config.js          every tuning number (shared by the sim, the view and the tests)
js/rng.js             seeded mulberry32 with saveable state, hash3, childSeed, weighted
js/sim/               PURE: no DOM, no three.js, no Math.random, no clock, no storage (grepped by simtest)
    game.js           newGame(seed, cls), step(G, inp, dt), serialize / deserialize; movement, potion, portal, pickups
    act.js            act(G, cmd): every non-real-time action (inventory, merchant, skills, travel, rifts…)
    world.js          area generators (town, wilds caves, rooms & corridors), collision, sight, clear paths, flow fields,
                      and the reachability proof
    areas.js          entering areas, features and decor, the portal snapshot, bosses killed, quests, rifts
    combat.js         damage, crits, armour and resists, stagger, kills, experience, levels, death
    skills.js         the 21 skills over 12 effect types; projectiles, ground zones, shades and decoys
    monsters.js       packs, champions and rares, AI (melee, ranged, caster, charger), bosses and phases
    loot.js           drops, item generation, names, prices, gems
    stats.js          derived stats from level, attributes, masteries, passives, gear, gems and sets
    pet.js            Ember: follow, fight, spells, town trips
    bot.js            the auto-player (tests, balance, ?debug=1 autoplay)
    data/             masteries, monsters, items, world: tables only
js/view/              three.js: reads G, never writes it
    view.js           renderer, camera, lights, fog, picking, screenOf
    level.js          floor (one merged mesh) and walls (instanced) from the grid; features and decor props
    models.js         Meshy GLBs with code stand-ins; rigged ones get an AnimationMixer
    actors.js         player, pet, monsters, shades: walk clips or a code gait, lunges, hit flashes, deaths
    fx.js             projectiles, telegraph rings, arcs, beams, novas, sparks, loot on the floor with rarity beams
    overlay.js        2D canvas: floating numbers, health bars, elite names, item labels
js/ui/                DOM: ui.js (screens, HUD, cards, toasts, touch deck), panels.js (inventory, skills, character,
                      merchant, chronicler, waystone, stash, obelisk, shrine), icons.js (the fal icon sheets)
js/input.js           keyboard + mouse + gamepad + touch → one raw state; latched presses; menu queue
js/audio.js           ElevenLabs music and effects with Web Audio synth fallbacks; theme crossfades
js/save.js            guarded localStorage, versioned saves
```

### 6.2 State: plain data, ids not references

```js
G = {
  v: 1, seed, rngState, t,
  mode: 'play' | 'dead' | 'won',
  area: { id, tier, w, h, grid: Uint8 (as array), seed, explored: bitset, waystone: {x,y}, exits: [...] },
  player: { cls, masteries: ['warfare', 'storm'|null], level, xp, gold, attrs: {...}, unspent: {attr, skill},
            bar: { warfare: 0..10, ... }, ranks: { cleave: 0..5, ... }, slots: [skillId × 5],
            x, y, face, vx, vy, life, res: { rage, mana, essence }, cds: { skillId: s }, buffs: [...],
            potion: { charges, cd, kills }, equip: { weapon: itemId, ... }, bag: [itemId|null × 40],
            stats: {...derived, recomputed on change...}, waystones: [areaId], quest: n },
  pet: { x, y, life, state, bag: [itemId × 16], tripT, cds },
  mons: [{ id, kind, x, y, life, max, lvl, elite: null|{ tier, affixes }, ai: {...}, cd, stagger, stun, shock }],
  shots: [...], zones: [...], drops: [{ id, item|gold|globe, x, y }], items: { [id]: Item },
  rift: null | { tier, mods, progress, guardian, t },
  nextId, events: []                                   // events are never saved
}
```

Every item lives once in `G.items` and is referred to by id from the bag, the equipment, the pet and the floor, so a
save is a JSON round trip and an item can never be duplicated by a bug in a move.

### 6.3 Input and commands

Real-time input is a record each step: `{ mx, my (move stick), tx, ty (click-move target or null), ax, ay (aim point),
skills: [held × 5], press: [edge × 5], potion, portal, cmd }`. Everything that is not real-time is a **command**
through `act(G, cmd)`, used by the UI, the bot and the tests alike: `equip`, `unequip`, `move` (bag ↔ pet ↔ stash),
`sell`, `sellJunk`, `buy`/`gamble`, `socket`, `combine`, `learn` (skill or bar rank), `attr`, `slot`, `pickMastery`,
`travel`, `petTown`, `filter`, `riftOpen`. Every command validates and either changes `G` and pushes an event or pushes
a `denied` event with a reason.

### 6.4 Item generation (data structures and the roll)

```js
function rollItem(G, ilvl, { mf = 0, forceRarity, base } = {}) {
  const rarity = forceRarity ?? pickWeighted(G.rng, RARITY_WEIGHTS(mf, G.rift?.tier));  // pity timer can force
  const baseId = base ?? pickWeighted(G.rng, BASE_WEIGHTS);
  const item = { id: G.nextId++, base: baseId, rarity, ilvl, affixes: [], sockets: [] };
  if (rarity === 'legendary' || rarity === 'mythic') item.uniq = pickLegendaryFor(G.rng, baseId);
  if (rarity === 'set') Object.assign(item, pickSetPiece(G.rng));                          // fixed base and name
  const [lo, hi] = RARITIES[rarity].affixes;
  for (let n = G.rng.int(lo, hi), tries = 0; item.affixes.length < n && tries < 40; tries++) {
    const k = pickAffixFor(G.rng, slotOf(baseId), item.affixes);    // respects slot lists, 3 pre + 3 suf, no dupes
    const a = AFFIXES[k], t = a.flat ? 1 : ITEM.tier(ilvl);
    const q = rarity === 'mythic' ? 1 : G.rng();                    // roll quality 0..1, shown in the tooltip
    item.affixes.push({ k, v: round(lerp(a.lo, a.hi, q) * t), q });
  }
  item.sockets = Array(rollSockets(G.rng, slotOf(baseId), rarity)).fill(null);
  return item;
}
```

Everything random takes `G.rng`, so a seed and an input log reproduce every drop exactly.

### 6.5 Multiplayer synchronisation (blueprint; the shipped game is single-player)

The sim was written so that co-op is a transport problem, not a rewrite:

1. **Deterministic lockstep for up to 4 players.** All clients run the same `step(G, inputs[], dt)` at 120 Hz with
   `inputs` indexed by player. Each client sends its input record for tick *n + 6* (a 50 ms input delay); a tick
   advances when every player's input for it has arrived. Because the sim is pure (the purity grep enforces it) and
   uses only `G.rng`, every client computes the same state. **Desync detection**: every 60 ticks each client hashes
   `serialize(G)` (FNV-1a) and sends it; a mismatch triggers a full-state resync from the host
   (`deserialize(hostSnapshot)`), which the save round-trip test already proves works mid-fight.
2. **Why lockstep and not server snapshots:** an ARPG has hundreds of monsters and projectiles; sending inputs (≈ 40
   bytes a tick per player) is far cheaper than sending state, and the sim is already deterministic. The cost is input
   latency, which 50 ms of delay plus client-side **prediction of the local player's movement only** (re-simulated
   from the confirmed tick, a standard rollback of one entity) hides.
3. **Floats.** All rules use `+ − × ÷` and `Math.hypot/atan2/sin/cos`, which are deterministic within one JS engine but
   not guaranteed across engines. A cross-browser build must either quantise positions to 1/256 m every tick
   (cheap, already safe for this game) or move the sim to fixed-point. This is the main known risk.
4. **Loot.** Personal loot (D3 style): each player rolls their own drops from `hash(seed, monsterId, playerIndex)`,
   so nobody steals anything and no extra sync is needed.
5. **Trust.** For a ladder, the server replays the submitted seed + input log headless (the `simtest` harness is
   that replayer) and rejects any run whose final hash differs.

### 6.6 Assets and fallbacks

| Kind | Made with | Files | Fallback |
|---|---|---|---|
| Title, story cards, portraits | fal `nano-banana-2` | `art/*.webp` | CSS gradients |
| 80 icons (skills, items, legendaries, sets) | fal, 4×4 sheets | `art/icons-*.webp` | a coloured glyph |
| Floor and wall textures | fal | `art/tex-*.webp` | flat colours |
| Heroes, pet, monsters, bosses, NPCs, props | Meshy image-to-3D (smart topology) from fal / Meshy references | `assets/models/*.glb` | code-built shapes |
| Music, effects | ElevenLabs | `audio/*.mp3` | Web Audio synthesis |

---

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, debug hooks |
| `js/sim/` | Pure simulation (see 6.1) |
| `js/view/` | Reads the sim and answers its events |
| `js/ui/` | DOM screens, HUD, panels, touch deck |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | Click / hold on the ground, or WASD | Left stick | Left thumb |
| Primary skill | Left click on a monster, or 1 | A | Skill button 1 |
| Skills 2–5 | 2 3 4 5 (aim at the mouse); right click = 2 | X Y B RB | Skill buttons |
| Stand still | Shift | LB (held) | — |
| Potion | Q | LT | ❤ |
| Town portal | T | Back | ⌂ |
| Show item labels | Alt (hold) | — | 🏷 |
| Inventory / Skills / Character | I / K / C | LB opens the inventory | the HUD buttons |
| Pause | P / Esc | Start | ❚❚ |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (432 checks): purity, data, world proofs on 60 seeds per generator,
every rule, every active skill, legendary powers and synergies, loot, determinism and save round trips (mid-fight and
through a portal), and a bot that plays the whole campaign and three rift tiers with every class at skill 1 and 0.4,
with per-step invariants and asserted balance bands. `browsertest.mjs` drives the real page with real keys, mouse and
clicks on desktop, real touches on two phones, and with storage blocked; it also checks that the narrator reads the
first card and stops when it closes.

## Balance notes

The bot (`js/sim/bot.js`) plays through the same input and commands a person uses. Table from `SEEDS=2` (median of
the perfect bot, all three classes; game time, at the bot's pace):

| | Skyllith (Act I) | Morwen (Act II) | Kolossar (Act III) | Rift tier 3 |
|---|---|---|---|---|
| Time | ~145 s | ~325 s | ~1,000 s | ~1,500 s |
| Player level | 9 (boss 9) | 15 (boss 18) | 24–28 (boss 27) | 32–34 |

What the bot found and what changed because of it:
- **Experience was a third of what it needed.** With 8 + 3.2 × level per kill the bot met Morwen at level 10 against
  level-17 monsters and still won, so levels meant nothing. Kill experience is 20 + 9 × level now (`combat.js`).
- **It was too easy.** Even a skill-0.3 bot finished with no deaths. Monster base damage went from 4 to 6.5
  (`MON.dmg`); deaths are now 0–9 a run (median 2–3).
- **The skill dial barely moved deaths** at first, because most damage in an ARPG is not telegraphed. v1.1.0 added
  more that can be dodged: every third swing of an elite melee monster is a heavy blow behind a red ring (2.2×), and
  slow projectiles (orbs, bone rings, the hydra's spray, at most 11 m/s) can be sidestepped. The bot now sidesteps
  them too, and steps out of a ring in the open direction that gets furthest from its centre. `simtest` measures
  the share of damage taken that was dodgeable: about 44% for the perfect bot and 56% for a skill-0.4 bot. The
  perfect bot's share stays high because a ring that appears while it is locked in a 0.5–0.7 s cast lands before it
  can move, which is the rule for a person too.
- **Areas were skipped.** A bot that took the exit as soon as it was level enough met Kolossar at 14–17; clearing
  three quarters of each area (as a person does) put it at 24–28.
- **Stalls** (a mover catching corners, bolts clipping walls, loot in walls, dithering, unfillable rift bars, a
  Guardian inside a wall) were all real bugs that would have stopped a person too; see docs/generic/learnings.md.

Bands asserted in `simtest.mjs`: the perfect bot binds Kolossar with every class on every seed and clears rift tier
3; a skill-0.4 bot usually finishes; the median level at Kolossar is 18–28; the median campaign is 400–1,800 s of
game time; the perfect bot's median deaths ≤ 6; the weak bot takes a larger share of dodgeable damage (by 15% or
more) and dies at least as often.

## Open questions / next steps

- A human pass on real hardware: it has only run under SwiftShader. Pacing, hit feel, readability in a big fight and
  whether the loot loop is moreish are unjudged by a person.
- The humanoids, Ember and the Gorehounds are rigged; the wraiths, gorgons, Skyllith and Morwen (no legs, a
  serpent tail, a hydra, a floating gown) move with a code gait and lunge to attack.
- No barks (short lines for the hero, the pet and townsfolk); only the narrator and the bosses speak.
- The wall cut-away sinks the walls just south of the player; a monster or a drop behind a wall elsewhere on screen
  can still be hidden.
- Multiplayer (§6.5) and seasons and ladders (§4.5) are written designs only. They are not planned: the game is
  single-player.

## Changelog

### v1.2.0 (2026-11-13)
- Ember and the Gorehounds are rigged. Meshy's auto-rigger only takes humanoids, so `dev/assets/rig-quadruped.mjs` fits a 15-bone
  quadruped skeleton (hips, spine, chest, neck, head, a two-bone tail, two bones a leg) to the static Meshy model at
  landmarks read off its side profile, skins each vertex to its nearest bones (legs kept apart by side and end), and
  bakes two clips: a trot (diagonal legs together, knees folding on the forward swing, tail sway) and a lunging bite.
  She trots at a speed measured from how far she moved, and bites when the sim says she does. The Gorehound has its
  own landmarks (a hyena: shoulders far above the hips, the head slung low, legs splayed) and a quicker, bouncier
  0.9 s trot, and plays its bite on every monster attack.

### v1.1.1 (2026-11-13)
- Town on a phone: nothing in town could be opened by touch on a portrait phone. The "Tap: talk" prompt sat under the
  skill buttons, and tapping a person did nothing on touch (only a mouse click worked). The prompt is now its own
  layer above the touch controls, just under the hero, at least 44 px tall; a tap on a person, the stash, the shrine,
  the obelisk or a waystone walks over and opens it, including a quick tap inside the walking stick's zone.

### v1.1.0 (2026-11-13)
- Renamed for its Giants: the game is GIANT'S VAULT, Kolossar is the Chained Giant, and the items, affixes and
  skills carry the new name (Giant's Wrath, Giant's Tread, "of the Giant", Gigantic).
  The three narrator lines that said the word were re-recorded. Saves start fresh (a new storage key).
- Voices: the narrator reads the six story cards, and the three bosses speak when they see you, at each phase and as
  they die, with a Voices volume slider and the music ducking underneath. The rifts have their own music.
- Meshy attack clips for the ten rigged models (a sword slash, a spell cast, a ground slam, a strike), played at the
  attack's own speed.
- Wall cut-away: walls between the camera and the player sink to a stub and rise again when you've passed.
- More to dodge: elite melee monsters wind up a telegraphed heavy blow every third swing, and slow projectiles can be
  sidestepped; the bot's skill dial now changes how much of that it eats.
- Tests: the browser test no longer leaves an unkillable training dummy for the bot to fight, or rare packs next to
  a level-1 hero on the phones (both caused intermittent failures, including the landscape phone one), and a timed-
  out check now prints the game's mode, screens, life, level and area.

### v1.0.0 (2026-11-12)
- First release: three classes and three hybrids, 21 skills, three acts and six generated areas, three bosses, elites,
  loot from common to mythic with gems, sets and legendary powers, Ember the loot pet, town, waystones, the portal,
  endless rifts; fal art, Meshy models, ElevenLabs music and effects; simtest and browsertest.
