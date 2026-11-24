# Inn Over My Head: Game Design Document

> *A cozy inn, a fussy dragon banker, and 40,000 gold to go.*

A cozy, whimsical 3D anime RPG crossed with inn management, built in three.js with plain HTML, CSS and JavaScript
modules (no build step). Every 3D character, monster, item, weapon and piece of furniture is a **Meshy** model, built by
image-to-3D from reference art painted with **ElevenLabs**. ElevenLabs also made the title, backdrops, portraits, music,
sound effects and voices. The heroes, guests, Madame Goldmaw and the two-legged monsters are **rigged by Meshy** and play
Meshy library animations.

This document follows the five requested deliverables:

1. [High-level GDD](#1-high-level-game-design-document): title, world, protagonist, creditor, pillars and loops
2. [Starter cast](#2-starter-cast): arrival hooks, staff specialties, combat classes, chain attacks
3. [Core system formulas and progression](#3-core-system-formulas-and-progression)
4. [UI/UX layout wireframes](#4-uiux-layout-wireframes)
5. [Technical implementation plan and prototype](#5-technical-implementation-plan-and-playable-prototype)

---

## 1. High-level game design document

### Title

**Inn Over My Head** (chosen). Other titles considered: *Debt & Breakfast*, *The Drowsy Dragonfly*, *Check-In Quest*,
*Room, Board & Battles*, *Five-Star Adventurers*.

### Tone and look

Lighthearted, hopeful and sunny. Pastel skies, honey wood, lush greenery, golden afternoon light. Chibi characters
(heads about a third of their height) in three-step cel shading with ink outlines. Monsters are mischievous, never
scary: they faint with a squeak and puff away in a cloud of dust. Nobody dies, and the worst a defeat does is send the
party home to wake up tucked in with a hot water bottle.

### The world: Honeymeadow Vale

A sunny valley of patchwork fields, a winding river and a red-roofed village called Puddlebrook. On the hill above it
stands the **Drowsy Dragonfly Inn**: three storeys of honey timber and white plaster, a crooked blue roof with a patch,
flower boxes, a courtyard garden and a dragonfly sign. For forty years Great-Aunt **Marigold Hearthwood** ran it as the
friendliest inn in the vale. Then she retired to the seaside, the roof leaked, the East Wing was boarded up, and the
dust bunnies moved in.

Three places lie within a day's walk:

| Region | Mood | Monsters | Boss |
|---|---|---|---|
| **Sunny Meadow** | buttercups, a windmill, honeybees | Dust Bunny, Honey Slime | **Sir Thistlehog**, a grumpy hedgehog-boar in a dented helmet |
| **Mushroom Grove** | giant glowing toadstools, fireflies | Puffcap, Moss Snail, Honey Slime | **The Grand Morel**, a very old, very sleepy mushroom king |
| **Crystal Cave** | singing crystals, an underground waterfall | Crystal Bat, Pebble Golem, Puffcap | **Queen Gemma**, a mole queen with a geode crown |

### The protagonist: Maple Hearthwood

Seventeen, freckled and stubborn, with a messy bun and a wooden spoon stuck through it. Maple grew up baking in
Marigold's kitchen every summer. When the inn and its debt pass to her, she takes up Marigold's rolling pin and pot lid
and becomes, as the townsfolk put it, a **Pastry Paladin**. She is the innkeeper (always at the desk when home) and
always in the party.

### The creditor: Madame Goldmaw

A small, plump, lavender dragon in a burgundy velvet waistcoat, with a gold monocle, a quill and a ledger the size of a
door. She runs **Goldmaw & Daughters Savings and Loan** and holds the inn's debt of **40,000 gold**, due in five
installments. She is fussy, theatrical and unfailingly polite, and charges late fees with a sigh rather than a threat.
She is not a villain: the twist (Chapter 5) is that Marigold *asked* for the loan, so the inn would pass to someone
willing to fight for it. Goldmaw was her best friend all along, and her reward for being paid in full is a permanent
reservation in the Sunroom Suite.

### Story in five chapters

| Chapter | Goals | Installment |
|---|---|---|
| 1 · A Dusty Inheritance | shoo the first dust bunnies, check in the first guest, cook a meal, help the soot-faced stranger (Ember) | 1,500 G by day 6 |
| 2 · Room for One More | find the lost suitcase for the bellhop (Kit), defeat Sir Thistlehog, give the gardener a sunny room (Fern) | 3,500 G by day 13 |
| 3 · The Grand Reopening | win over the knight who hates dust (Bru), wake the Grand Morel | 7,000 G by day 21 |
| 4 · Marigold's Secret | defeat Queen Gemma and find Marigold's diary in the Crystal Cave | 12,000 G by day 30 |
| 5 · The Deed | pay the last installment; the ending | 16,000 G by day 40 |

Each paid installment unlocks something: a better stove and the Mushroom Grove; the East Wing and the Crystal Cave;
another stove upgrade, a third decor shelf and the Cloud Soufflé; the Sunroom Suite (double rate); the deed.

### Design pillars

1. **The inn powers the adventure.** Meals become buffs, clean rooms become Fresh Linens, staff earn while you fight,
   and the people you shelter become your party.
2. **The adventure powers the inn.** Battles drop the ingredients the kitchen needs, bosses drop the gear, and gold
   pays the debt.
3. **Everyone gets closer.** Every shared chore, meal and fight builds bonds, and bonds unlock scenes, stat synergies
   and duo and trio chain attacks.
4. **Never punishing.** Late payments add a fee and more time; defeat sends you home; time away earns money.

### The two loops and how they feed each other

```
            ┌──────────────── the inn (real-time clock: 1 day = 3 minutes) ────────────────┐
            │ guests ─► rooms ─► tips, checkout pay, reputation                            │
            │ dust bunnies ─► sweep ─► Sparkle ─► bigger tips · Fresh Linens buff           │
            │ ingredients ─► kitchen (stir mini-game) ─► meals ─► sell to guests | EAT      │
            │ herbs (garden) · forage (gardener) ─► ingredients                            │
            │ staff (Cook, Concierge, Gardener, Housekeeper) keep working while you're away │
            └──────┬─────────────────────────────────────────────────────▲─────────────────┘
       meal buffs, │ Fresh Linens, party                                  │ ingredients, gold,
       staff idle  ▼                                                      │ gear, quest items, EXP
            ┌──────────────── adventures (turn-based, 3/4 isometric) ─────┴─────────────────┐
            │ explore battles ─► drops · boss ─► story · weapons                           │
            │ combos & chains ─► bonds ─► duo/trio chains · synergy                        │
            └───────────────────────────────────────────────────────────────────────────────┘
                     gold ─► Goldmaw's ledger ─► installments ─► new rooms, regions, recipes
```

---

## 2. Starter cast

Each of the four recruitable heroes arrives at the front desk as a **stranger** with a request. To win one over:
(1) give them a room (some insist on a clean one), (2) serve their favourite meal, (3) do their personal task. Then they
choose a role: **Party** (adventures only), **Staff** (works their specialty full-time, even during adventures) or
**Both** (adventures with you, works whenever at home).

### Maple Hearthwood · the protagonist

| | |
|---|---|
| Hook | Inherits the inn and its debt in the opening scene. |
| Staff | 🛎️ **Innkeeper**: always at the desk; never a staff slot. |
| Class | **Pastry Paladin** · ✨ Sugar · tank and support. HP 120, ATK 14, DEF 12. |
| Skills | *Sugar Rush* (1.45 ATK Sugar) · *Pot-Lid Guard* (DEF +40% and taunt, 2 turns) · *Warm Welcome* (heal the party: 1.1 MAG + 18) |
| Chain | **Rolling Thunder**: three rolling-pin blows (0.9 / 0.9 / 1.1 ATK, Sugar), then party DEF +20% for 2 turns. |
| Favourite | Honey Tart · decor: Sunflower Vase |

### Ember Pell · the cook

| | |
|---|---|
| Hook | Turns up soot-faced at the desk: *"Is there any room with a stove I'm allowed to use?"* Fired from the Royal Kitchens after the Great Soufflé Explosion. |
| Win her over | Any room · bring a **Fire Pepper** from the Sunny Meadow. She cooks her grandmother's **Ember Stew** with it and leaves it in your pantry, and you serve it back to her. |
| Staff | 🍳 **Cook**: meals +0.15 quality (+0.04 per bond level with Maple), a 40% wider stir zone, and cooking together builds the bond. Unlocks Ember Stew and Puffcap Pie when she arrives. |
| Class | **Hearth Mage** · 🔥 Spice · magic damage. MAG 16, SPD 11. |
| Skills | *Sizzle* (1.55 MAG Spice) · *Flash Fry* (0.9 MAG Spice to all) · *Simmer* (an ally's ATK and MAG +20%, 3 turns) |
| Chain | **Flambé Finale**: 2.1 MAG Spice to every enemy. |
| Favourite | Ember Stew · decor: Copper Kettle |

### Kit Quickstep · the concierge

| | |
|---|---|
| Hook | *"Evening! Carry your bags? Legally, I mean."* A reformed pickpocket whose last client's suitcase went missing in the Mushroom Grove. |
| Win him over | Any room · serve a Honey Tart · find the **Lost Suitcase** in the Mushroom Grove (it turns up within two wins there). |
| Staff | 🧳 **Concierge**: checks waiting guests into the cleanest free room by himself, and tips +25%. |
| Class | **Bellhop Rogue** · 🍃 Breeze · fast physical striker and stagger specialist. SPD 15, CRIT 12, EVA 10. |
| Skills | *Express Jab* (1.2 ATK Breeze, +2 poise damage) · *Pickpocket Tip* (0.8 ATK, steals an ingredient or gold) · *Double Trouble* (2 × 0.75 ATK Breeze, crit +20%) |
| Chain | **Express Delivery**: five quick hits (4 × 0.55, 1 × 0.7 ATK) on random enemies, +1 poise damage each. |
| Favourite | Honey Tart · decor: Antique Luggage Cart |

### Fern Willowbloom · the gardener

| | |
|---|---|
| Hook | Arrives after Sir Thistlehog falls, with a wilted sapling: *"Do you have a room with a sunny window?"* |
| Win her over | A **clean** room (one dust bunny at most) · serve **Glowmoss Tea** · harvest 6 herbs from the courtyard. |
| Staff | 🌻 **Gardener**: herbs grow twice as fast and are picked for you, and every 90 s she forages a wild ingredient (honey, herbs, peppers; puffcaps and glow moss after the Grove opens; crystal sugar after the Cave). |
| Class | **Botanist Bard** · 🌿 Bloom · healer and controller. MAG 14, MP 42. |
| Skills | *Thorn Ballad* (1.4 MAG Bloom) · *Lullaby Bloom* (heal an ally 2.0 MAG + 30, then 5% a turn for 3 turns) · *Pollen Waltz* (every enemy SPD −25%, 3 turns) |
| Chain | **Overture of Blossoms**: 1.4 MAG Bloom to every enemy, then heals the party 20%. |
| Favourite | Glowmoss Tea · decor: Potted Fern |

### Brunhilde "Bru" Mopsworth · the housekeeper

| | |
|---|---|
| Hook | Read a review (*"Dust bunnies attacked my luggage"*) and declared war: *"UNACCEPTABLE!"* A retired knight of the Order of the Spotless Shield. |
| Win her over | A **clean** room · serve **Puffcap Pie** · get the inn to a **4★ Sparkle** rating. |
| Staff | 🧹 **Housekeeper**: shoos a dust bunny from the dirtiest room every 7 s (5 s with the Turbo Broom); cleaning alongside her builds your bond. |
| Class | **Broom Knight** · 💧 Suds · armoured tank. HP 140, DEF 15. |
| Skills | *Suds Splash* (1.35 ATK Suds) · *Spin Mop* (0.8 ATK Suds to all) · *Sparkle Shield* (party DEF +25%, 3 turns) |
| Chain | **Spring Cleaning**: 1.75 ATK Suds to every enemy, and washes every debuff off the party. |
| Favourite | Puffcap Pie · decor: Polished Armour Stand |

### Duo and trio chains (bonds)

| Chain | Heroes | Needs | Effect |
|---|---|---|---|
| **Breakfast in Bed** | Maple + Ember | bond 3 | 1.9 ATK Sugar + 2.0 MAG Spice on one enemy; party regen 6%/turn for 3 turns |
| **Room Service Rush** | Maple + Kit | bond 3 | five alternating blows on one enemy |
| **Turndown Service** | Kit + Bru | bond 3 | 1.2 Suds + 1.2 Breeze to all, +3 poise damage |
| **Garden Barbecue** | Ember + Fern | bond 3 | 1.3 Bloom + 1.5 Spice to all; heal the party 15% |
| **Rain & Shine** | Fern + Bru | bond 3 | 1.3 Suds + 1.3 Bloom to all; party regen |
| **Full Course Banquet** | Maple + Ember + Fern | bond 4 with Maple | three waves to all; heal 30%; ATK and MAG +20% |
| **Five-Star Service** | Maple + Kit + Bru | bond 4 with Maple | three waves to all; +2 poise; refills 30 chain |

---

## 3. Core system formulas and progression

All the numbers live in [`js/config.js`](js/config.js) and [`js/sim/data.js`](js/sim/data.js); the rules in
[`js/sim/`](js/sim/). These are the formulas the code uses.

### The clock

One in-game day is **180 s** of real time (06:00 to 24:00). Everything at the inn runs on this clock, at home and on
the expedition map between fights; it **stands still during a battle** (v1.1.1), so a long fight never eats the day. **Time away** (a closed tab) runs the inn on for up to **2 days**, and the welcome-back card lists the earnings.

### Debt tiers

| Tier | Amount | Due | Unlocks |
|---|---:|---:|---|
| 1 · Dust & Dreams | 1,500 | day 6 | kitchen level 2, Mushroom Grove |
| 2 · Fresh Linens | 3,500 | day 13 | rooms 3–4 (East Wing), Crystal Cave, Crystal Parfait |
| 3 · Grand Reopening | 7,000 | day 21 | kitchen level 3, third decor shelf, Cloud Soufflé |
| 4 · The Sunroom Suite | 12,000 | day 30 | room 5 (×2 rate) |
| 5 · The Deed | 16,000 | day 40 | the ending |

- Pay any amount, any time. When a tier is paid: `tier += 1`, reputation +5, and the next tier is due at
  `max(T.due, today + 4)`.
- **Late**: at the start of a day after the due date, `fee = round(0.10 × owed)` is added and the due date moves to
  `today + 5`. No game over, ever.

### Guests, tips and reputation

- **Arrivals** every `48 s × (1 − min(0.5, (rep + decorRep) / 200)) × U(0.8, 1.2)`, if a room is free and fewer than 3
  wait. Walk-ins who wait more than 0.6 of a day leave at midnight.
- Archetypes: Sleepy Adventurer (30 G/night, 1–2 nights, any rep), Travelling Merchant (45 G, 1–3, rep ≥ 5), Noble Lady
  (80 G, 2–3, rep ≥ 25). Requests: 40% *a spotless room*, 35% *a meal of type X*, 25% none.
- **Nightly rate** = `base × roomMul × (1 + rep / 200)`.
- **Satisfaction** starts at `55 + 5 × Sparkle` at check-in. A meal: `+sat` (×2 if it's what they asked for). At
  checkout a spotless-room request gives ±20 (1 bunny or fewer); an unmet meal request −10.
- **Checkout pay** = `rate × nights stayed`. **Tip** = `pay × (sat − 50) / 100` if positive.
  **Reputation** `+= clamp(round((sat − 55) / 8), −3, +6)`.
- **Idle tips** while they stay: `rate × 0.004 × Sparkle / 5` per second per occupied room (×1.25 with a concierge).
  This is the "+N/min" on the gold chip.

### Housekeeping

- Dust rises `0.4/s` in an occupied room and `0.1/s` in an empty one (×0.75 with Sparkle Spray), capped at 100.
- **Dust bunnies** = `ceil(dust / 20)`. A sweep removes 20 dust and drops Bunny Fluff 35% of the time (+20% with the
  Turbo Broom; 25% for staff sweeps).
- **Sparkle** = `round(10 × (1 − mean(dust of open rooms) / 100)) / 2` stars (0–5 in halves).
- **Fresh Linens**: if every open room has at most 1 bunny when the party sets off, every hero gets
  **SPD +10% and EVA +10** for the whole expedition.

### Cooking

```
needle(t) = triangle wave 0 → 1 → 0 at 0.8 cycles/s
zones:  perfect |p − 0.5| ≤ 0.07 × k,  good ≤ 0.18 × k,  k = (cook on staff ? 1.4 : 1) × (Golden Whisk ? 1.3 : 1)
quality q = 1 + 0.1 × (kitchenLevel − 1) + 0.1 [Copper Pot] + {0.2 perfect | 0.1 good | 0}
          + (cook on staff ? 0.15 + 0.04 × bondLevel(Maple, cook) : 0)
stars   = q ≥ 1.5 ? 3 : q ≥ 1.2 ? 2 : 1
```

A pot left for 8 s stirs itself (no bonus). **Selling to a guest** pays `price × q` (×1.5 for the requested meal).
**Eating before an adventure** applies the recipe's buff × q for the whole trip:

| Meal | Needs | Price | Party buff (× q) |
|---|---|---:|---|
| Honey Tart | honey, flour | 42 | regen 4% max HP per turn |
| Garden Salad | herbs ×2 | 30 | +3 MP per turn |
| Ember Stew | pepper, herbs, flour | 58 | ATK & MAG +15% |
| Puffcap Pie | puffcap ×2, flour | 72 | DEF +15% |
| Glowmoss Tea | glow moss, herbs | 55 | elemental damage taken −25% |
| Crystal Parfait | crystal sugar, honey | 120 | crit +15 |
| Cloud Soufflé | crystal sugar, flour, honey | 160 | SPD +15%, EVA +10 |

### Affinity and bonds

- Points per pair; **levels** at 0 / 40 / 100 / 180 / 280 points (Lv 1–5).
- Gains: under one roof +2/day (every pair) · favourite decor on display +3/day with Maple · cooking together +6
  (+9 on a perfect stir) · cleaning while the housekeeper works +1 per sweep · battle won together +4 (every standing
  pair) · combo link +3 · chain attack together +5 (every pair in it) · joining +10.
- Payoffs:
  - **Lv 2** and **Lv 4** with Maple: a slice-of-life vignette.
  - **Lv 3**: duo chain unlocked; the hero's favourite decor is revealed; synergy begins.
  - **Lv 4** with Maple for both others: trio chain.
- **Synergy** (in battle): each hero gets `+3% × (bondLevel − 2)` ATK, DEF and MAG for every bonded partner in the
  party, plus **+5%** if their favourite decor is on display.

### Battle

- **Turn order** is a timeline: every unit has `next`; the lowest acts and then `next += 100 / SPD`. The timeline bar
  shows the next 8 turns, recomputed when speed buffs change.
- **Damage**:

  ```
  base  = stat (ATK or MAG, with buffs and synergy) × skillPower × 2 × 50 / (50 + targetDEF)
  × element:  1.5 weak · 0.5 resist · 1 otherwise
  × crit 1.5   (chance = CRIT% + skill bonus + meal)
  × 1.3 if the target is Staggered    × 0.5 if it's Defending
  × (1 − 0.25) for elemental hits on heroes who ate Glowmoss Tea
  × U(0.9, 1.1), rounded, minimum 1
  miss (physical only): chance = target EVA% × 0.8
  ```

- **Elements**: 🔥 Spice, 💧 Suds, 🌿 Bloom, 🍃 Breeze, ✨ Sugar. Every monster lists its weaknesses under its name.
- **Poise and Stagger**: every enemy has poise pips (2–11). A weakness hit removes 2, any other hit 1, plus a skill's
  bonus. At 0 the enemy is **Staggered**: it loses its next turn (its poise refills then), takes ×1.3 damage, and opens
  one **free Chain Attack**.
- **Chain gauge** (0–100, shared): +6 per hero hit, +6 more on a weakness, +8 on a crit, +15 on a stagger, +15 on a
  combo. Half the gauge carries over to the next battle of the expedition.
- **Chain Attack triggers**: (a) any enemy Staggered and not yet chained → free; (b) gauge = 100 → spend it all. The
  acting hero picks from their solo chain, any duo chain with a standing partner at bond 3, and trio chains at bond 4.
- **Combo links** (skill combinations): when a hero hits an enemy with element **B** after a *different* hero hit it
  with element **A**, before that enemy's next turn, a combo fires for +50% of the hit as bonus damage, +15 chain and +3
  bond:

  | A → B | Combo | Extra |
  |---|---|---|
  | 🔥 → 🍃 | Firestorm | a lingering burn |
  | 💧 → 🔥 | Steam Burst | target DEF −25% for 2 turns |
  | 🌿 → 💧 | Overgrowth | party heals 8% |
  | 🍃 → 🌿 | Petal Gale | −2 poise |
  | ✨ → 🔥 | Caramelize | target ATK −20% |
  | 💧 → ✨ | Bubble Glaze | +15 more chain |

- **Flee**: `p = clamp(0.6 + 0.25 × (partySPD / enemySPD − 1) + 0.15 × failedTries, 0.3, 0.95)`; impossible against a
  boss. Success is a comic scramble off the island (someone trips); failure is a trip and a lost turn.
- **Defend**: DEF ×2 for incoming hits until the hero's next turn, and 8% MP back.
- **Monster scaling** at level L: HP ×(1 + 0.16 (L − 1)); ATK, DEF, MAG ×(1 + 0.12 (L − 1)).
- **EXP** to next level = `round(18 × L^1.5)`. Party members take the full reward (half if fainted); staff at home learn
  40%. Recruits join at Maple's level − 1.

### Auto-battle presets ([`js/sim/ai.js`](js/sim/ai.js))

| Preset | Heals at | Keeps MP | Chains | Damage choice |
|---|---|---|---|---|
| 🔥 Aggressive | 30% HP | 0% | as soon as ready | highest expected damage, MP almost free |
| ⚖️ Balanced | 45% HP | 30% | as soon as ready | best damage per MP; buffs early; revives with salts |
| 💧 Conserve MP | 30% HP | 50% | only free (stagger) chains | basic attacks unless an MP skill hits a weakness |

Every option is scored as `Σ min(targetHP, expected damage)`, ×1.15 for a finishing blow, ×1.1 for breaking poise on a
weakness, minus an MP cost weight. Enemy turns use weighted random skill tables (healers only heal below 60%). The same
brain plays the test bot, so the balance numbers measure the AI the player can switch on.

### Balance (measured, not guessed)

A whole-game bot ([`js/sim/bot.js`](js/sim/bot.js)) plays through `act()` exactly like the UI: it cleans, checks in,
cooks for requests, serves, recruits, shops, pays and goes on one expedition a day with auto-battle. Over 8 seeds at two
skill levels, every run pays off the debt by **days 28–36** (deadline day 40). The attentive bot is never late; the
distracted bot sometimes pays one or two late fees. The sim test asserts these bands.

---

## 4. UI/UX layout wireframes

### The inn (hotel view)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ← Games            ☀ Day 3 · 2:40 pm │ 🪙 840 (+12/min) │ ⭐ 18 │ ✨ 3.5 │ 📒 Owe 660 · due 6 ▰▰▱ │☰│
│ ┌───────────────────┐                                                            │
│ │ Chapter 1         │          ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔╲      sunlit valley backdrop    │
│ │ Cook a meal       │         ╱   SUNROOM SUITE    ╲     (ElevenLabs painting)     │
│ │ [Kitchen]         │        ┌──────┬──────┬──────┬──────┐                         │
│ ├───────────────────┤   stair│ R1 🐰│ R2   │ R3 ╳ │ R4 ╳ │  ← click a bunny to      │
│ │ Ember (stranger)  │     ╱  │ Free │🛌Rowan│boarded│     │    shoo it; click a room │
│ │ ✅ room ⬜ stew    │    ╱   ├──────┴──┬───┴──────┼──────┘    to open its panel     │
│ │ ⬜ bring a pepper  │   ╱    │ LOBBY   │ KITCHEN  │ COURTYARD 🌱                   │
│ ├───────────────────┤        │ desk 🧑 │ stove 🍳 │ planters, bath                 │
│ │ Today's errands   │        └─────────┴──────────┴────────────                    │
│ └───────────────────┘                                                            │
│      ┌──────────────────────────────────────────────────────────────────┐        │
│      │ 🛎Desk 🍳Kitchen 🛏Rooms 🌻Garden 👥Team 💞Bonds 🎒Bag 📒Ledger ⚔Adventure │        │
│      └──────────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Top bar**: day and clock (the light warms toward evening and the lamps come on at night), gold with the live tip
  rate, reputation, the Sparkle rating, and the debt (amount, due day, progress bar; it wiggles when the due day is
  close). It opens the Ledger.
- **Left tracker**: the story goal with a shortcut button, each stranger's checklist, the stir bar when a pot is on, and
  today's errands (collapsible).
- **Dock**: nine panels (keys 1–9). Badges show waiting guests, very dusty rooms, ripe herbs, a pot to stir and an
  affordable installment.
- **Panels** are sheets with a pinned header (✕) and scrollable body: *Desk* (queue with room buttons, staying guests,
  the peddler's shop), *Kitchen* (recipes with ingredient pills, the stir game, the pantry with "Serve to…", the
  workshop), *Rooms* (dust meters, guests, requests), *Garden*, *Team* (roles Party/Both/Staff, party toggles, gear,
  stats, synergy), *Bonds* (every pair: hearts, progress, duo chain, decor hint, vignettes), *Bag* (category tabs,
  sort by name/quantity/value, auto-equip, sell, display decor), *Ledger*, *Adventure* (region cards with weaknesses
  and boss status, a meal to eat, the buffs it will give, the party, who minds the inn).

### The 3/4 battle HUD

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ← Games      ( ◉Kit )( Dust )( Maple )( Ember )( Slime )( Bru )…      [Auto: Off] │
│              [▰▰▰▰▰▰▱▱▱▱ CHAIN ▱▱▱]  ← glows when ready             [⚖ Balanced ▾]│
│                                                     Queen Gemma Lv15              │
│          🧑‍🍳  🧹                                       ▰▰▰▰▰▱▱▱  ▮▮▮▮▮▯▯ poise  │
│       🧑  ◯Kit           floating diorama island        💧🍃 weak                 │
│     🍰                                              👑🐭      🪨 Pebble Golem      │
│ ┌──────────────────┐                                     ┌────────────────────────┐│
│ │🍰 Maple ▰▰▰▰▱ MP │                                     │ Kit's turn · HP 90 MP30 ││
│ │🔥 Ember ▰▰▰▰▰ MP │                                     │ [🗡 Attack] [✨ Skills] ││
│ │🍃 Kit   ▰▰▰▰▰ MP │◄ current                            │ [⚡ Chain ] [🧪 Items ] ││
│ │💧 Bru   ▰▰▰▰▰ MP │                                     │ [🛡 Defend] [💨 Flee  ] ││
│ └──────────────────┘                                     └────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Camera**: a fixed orthographic 3/4 view; heroes lower-left, monsters upper-right; a gold ring under the actor.
- **Timeline**: portraits of the next 8 turns, blue rims for heroes, red for monsters; the current one is larger.
- **Enemy labels**: name and level, an HP bar that drops when the blow *lands* (the view keeps the shown HP), poise
  pips, weakness icons, 💫 when staggered. Tap one (or the monster itself) to target it.
- **Party cards**: portrait, HP and MP bars, buffs (ATK↑, 🛡️ guard, 🎯 taunt), greyed when fainted.
- **Commands**: Attack · Skills (cost and element) · Chain (lists solo, duo and trio chains; glows when free or full) ·
  Items · Defend · Flee. Targeting shows ▼ on the chosen enemy, with Confirm and Back. Keys: A S C I D F, ←→ to target,
  Enter to confirm, T for Auto.
- **Feedback**: floating numbers (crit, WEAK!, combo names, STAGGER!), element particle bursts, a full-width chain
  banner ("DUO CHAIN · Breakfast in Bed"), the camera zooming in for chains, voice barks, victory and defeat cards.

### Relationship and menu screens

```
┌─ 💞 Bonds ──────────────────────────────────────────────── ✕ ┐
│ Bonds grow from living, cooking, cleaning and fighting…        │
│ ┌──────────────────────────┐ ┌──────────────────────────┐      │
│ │ 🍰🔥 Maple & Ember        │ │ 🍰🍃 Maple & Kit          │      │
│ │ ❤️❤️❤️🤍🤍  34 to next      │ │ ❤️❤️🤍🤍🤍  12 to next      │      │
│ │ ▰▰▰▰▰▰▱▱▱▱               │ │ ▰▰▰▱▱▱▱▱▱▱               │      │
│ │ ⚡ Duo: Breakfast in Bed  │ │ 🔒 Duo: Room Service Rush │      │
│ │ 💡 loves the Copper Kettle│ │ 📖 Lv2 🔒 Lv3 🔒 Lv4      │      │
│ └──────────────────────────┘ └──────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
┌─ 🧑‍🤝‍🧑 Team ──────────────────────────────────────────── ✕ ┐       ┌─ ☰ Menu ────────── ✕ ┐
│ ⚙ Auto-equip everyone                                    │       │ [Back to the inn]    │
│ ┌──────────────────────────────┐                         │       │ [📜 Story & dailies] │
│ │ 🔥 Ember · Lv 6 ▰▰▰▱          │                         │       │ [How to Play]        │
│ │ Hearth Mage · 🔥 · 🍳 Cook     │                         │       │ [Settings]           │
│ │ HP 130 · MAG 29 · 💞 +6%       │                         │       │ [Save & Quit]        │
│ │ [⚔ Party] [🔁 Both] [🛎 Staff] │                         │       └──────────────────────┘
│ │ Weapon: Star Ladle ▾          │                         │
│ └──────────────────────────────┘                         │
└───────────────────────────────────────────────────────────┘
```

Story scenes and bond vignettes play in a **dialogue box**: the speaker's portrait (cut out of the ElevenLabs reference
art), name, text, Next. Lines with a recorded voice play it.

---

## 5. Technical implementation plan and playable prototype

### Architecture (sim/view split, no build step)

```
game-147/
├── index.html · style.css           screens, HUDs, sheets; phone first, every control ≥ 44 px
├── js/main.js                       boot, fixed-step loop (1/30 s), input routing, story scenes, idle catch-up, debug hooks
├── js/config.js                     tuning shared by the sim, view and tests
├── js/sim/                          PURE: no DOM, no three.js, no Math.random, no clock, no storage
│   ├── data.js                      heroes, skills, chains, combos, monsters, regions, items, recipes, guests, tiers, story
│   ├── game.js                      newGame(seed) · step(G, dt, {hold}) · act(G, cmd) · serialize / deserialize
│   ├── hotel.js                     rooms, dust, guests, kitchen, garden, staff, tips, shop, decor, debt, dailies, the day
│   ├── battle.js                    timeline, damage, elements, poise/stagger, chain gauge, chains, combos, items, flee
│   ├── bonds.js · quests.js         affinity and its payoffs · story goals, strangers, boss gates
│   ├── ai.js                        auto-battle brain (3 presets), also used by the bot
│   └── bot.js                       a whole-game player for tests and balance
├── js/view/                         three.js r165; reads G, answers events, never writes G
│   ├── assets.js                    Meshy GLB loading, toon materials + skinned ink outlines, Actor (Meshy clips or procedural)
│   ├── stage.js                     renderer, scenes, orthographic 3/4 cameras, ElevenLabs backdrop behind a transparent canvas
│   ├── hotel3d.js                   the dollhouse inn, furniture, dust bunnies, walking staff and guests, day/night light
│   ├── battle3d.js                  the diorama arenas and the battle event player (run in, swing, numbers, chains, flee)
│   └── fx.js                        element particle bursts, rings
├── js/ui.js · audio.js · save.js    DOM panels and HUDs · ElevenLabs music/effects/voices + synth fallback · guarded storage
├── models/                          75 Meshy GLBs (12 rigged) + models/anim/ (90 Meshy animation clips, stripped to keyframes)
├── art/                             ElevenLabs title, ending, backdrops, portraits; art/icons/ = renders of the Meshy items
├── audio/                           ElevenLabs music, jingles, effects, voice lines
└── dev/                             simtest, browsertest, play, rigshot, icons, and the media pipelines (meshy/, art/, audio/)
```

**Why this shape.** The pure simulation lets a bot play the whole 40-day game in Node in under a second, makes a seed
replay exactly, and makes a save a JSON round trip. Turn-based combat follows the repo's command pattern: `act()`
resolves a whole action at once and pushes events; the view plays them as a queue and reports `busy`; `step()` only
paces enemy turns and the auto-battle while the view is not busy.

### Rendering

- **Cel shading**: every Meshy material is replaced with `MeshToonMaterial` (the model's own baked texture as the map,
  a three-step gradient ramp). **Outlines** use an inverted hull: a back-face copy pushed out along the normals in the
  vertex shader, which for rigged characters is a `SkinnedMesh` bound to the same skeleton, so the ink follows the
  animation.
- **Animation**: Meshy auto-rigging gives each humanoid a 24-bone skeleton plus walk and run; nine more clips per hero
  come from Meshy's animation library. Each animation GLB is stripped to its keyframes (3 MB → 30–120 KB, `dev/meshy/clip.py`)
  and bound to the character by bone name. Horizontal hip motion is removed so the game, not the clip, places characters.
  Creatures that can't take a humanoid rig (Dust Bunny, Honey Slime, Puffcap, Moss Snail, Crystal Bat, Sir Thistlehog)
  get procedural motion with the same clip names: a breathing squash, a hop-forward attack, a hit squash, a flattening faint.
- **Scenes**: an orthographic 3/4 camera that always fits the diorama's width (portrait phones included) with a minimum
  height on wide screens; a painted ElevenLabs backdrop behind a transparent canvas; sunlight and soft shadows; the inn's
  sun colour and lamp lights follow the clock.

### Media pipeline (repeatable, all scripts in `dev/`)

1. **ElevenLabs** paints a full-body reference for each character and monster (Nano Banana 2.1, white background,
   A-pose), and 4×4 item sheets cut into single objects (`dev/art/cut.py`).
2. **Meshy** image-to-3D (smart topology, 1,800–9,000 triangles, textured) turns every reference into a GLB
   (`dev/meshy/pipeline.mjs`, resumable), then **rigging and animation** for the humanoids (`dev/meshy/rig.mjs`).
3. `dev/meshy/shrink.py` re-encodes textures for the web (1024 px heroes, 512 px monsters and furniture, 256 px items).
4. `dev/icons.mjs` renders every Meshy item model as a 128 px toon icon for the UI.
5. **ElevenLabs** music (Music v2.5), effects (Sound Effects v2) and voices (v4, one take per character, split at the
   pauses by `dev/audio/process.py`).

### Testing

- [`dev/simtest.mjs`](dev/simtest.mjs) (Node): purity of `js/sim/`; every rule (dust, check-in, tips, cooking zones and
  quality, serving, recruits, debt and late fees, bonds and synergy, damage, elements, stagger, chains, combos, flee,
  presets); determinism and save round trips; whole-game bot runs over many seeds, with the balance band asserted.
- [`dev/browsertest.mjs`](dev/browsertest.mjs) (Chromium + SwiftShader): desktop by real mouse and keys (title, intro
  scene, sweeping a bunny by clicking it in 3D, check-in, cooking with a real stir, an expedition, a manual battle with
  targeting, auto-battle, a chain attack, flee, save and continue), touch-only phones in both orientations, blocked
  storage, and every Meshy model and clip loading.

### Scope of this prototype

Everything in the brief is in and playable: the debt loop and its five tiers, guest-to-party recruitment for four
strangers with role choice, cooking with collaboration and buffs, housekeeping with Fresh Linens, idle income during
battles and time away, 3/4 turn-based combat with a timeline, skills, items, defend, flee, auto-battle presets, staggers,
combo links and solo/duo/trio chain attacks, bonds with vignettes, synergy and decor preferences, a five-chapter story
with dailies, and a categorized inventory with sorting and auto-equip.

**Next steps**: more regions and bosses past Chapter 5 (an endless "Five-Star Season" of rotating guests), per-room
decoration, a guest-request variety pass, controller support for the 3D picking, and a gallery page of every model and
clip (`dev/rigshot.mjs` covers single models).

## Changelog

### v1.1.1 (2026-11-24)

- Fixed: the last dust bunny in a room came straight back (any dust at all was a bunny); bunnies now appear past a
  little dust, and the last one shooed takes the leftover dust with it.
- Fixed: dialogue portraits were cut off at the chin; people have a taller head-and-shoulders portrait.
- Fixed: the inn's clock ran during battles; time now stands still mid-battle (it still runs between fights).
- Added: a 3D model viewer from the Team panel's portraits (turn, zoom, play each animation clip).

### v1.1.0 (2026-11-24)

- Changed: the inn rebuilt as a readable, textured dollhouse seen almost head on (thick timbered walls, wallpapers,
  windows, lamps, a shingled roof); closed rooms dimmed behind a plaque.
- Added: zoom to a room by click or tap (a room card, a second click opens the panel), wheel and pinch zoom, drag
  pan, and Esc, a double tap or **Whole inn** to go back.
- Added: 16 ElevenLabs surface textures; 14 more Meshy props; sharper sun shadows, contact shadows, corner shading,
  tone mapping; textured battle islands with a closer camera; a fade between inn and battle; styled dropdowns.
- Fixed: the stir needle in the Kitchen panel updated only every 0.3 s (about three positions a sweep); it now moves
  every frame.
- Fixed: battle damage landed before the swing connected; each clip's moment of impact is now found from its bones,
  and slow clips are sped up so blows land within 0.8 s.
- Added: where to find each missing ingredient (shop, courtyard, monster drops by region, foraging, workshop).
- Changed: the inn's architecture merged into one mesh per material, lamp lights replaced by glows, darker nights.

### v1.0.1 (2026-11-23)

- Fixed: the quest tracker's shortcut buttons (Desk, Kitchen, Ledger, Adventure) did nothing; they now open their panels.
- Fixed: two guests could share a name and look like one person booking two rooms; names are now unique at the inn.

### v1.0.0 (2026-11-23)

First release: the full loop described above, all media generated with ElevenLabs and Meshy.
