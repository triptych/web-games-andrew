# FROSTMARCH — Saga of the Stormsworn

**Genre:** Open-world first/third-person action RPG (in the tradition of *The Elder Scrolls V: Skyrim*)
**Engine:** three.js r165 (ES modules via import map), no asset files: every mesh, texture, sound and note is generated in code
**Target:** desktop (keyboard + mouse, gamepad) and phones/tablets (touch), any aspect ratio, portrait or landscape
**Status:** v1.0.0 — see *Phases* at the end

---

## 1. Vision

You arrive in the Frostmarch in chains. Before the axe falls, a black dragon tears the sky open over Hollowmere Keep, and in the smoke and screaming you run. From that moment the whole province is yours: walk in any direction, climb any mountain you can see, rob a tomb, join a guild, forge a sword, brew a poison, read a book, fight a bear, and when the dragons come back you discover that you can do what they do — you can *Shout*.

Skyrim's magic is the feeling that the world goes on without you and that everything you see is a place you can go. FROSTMARCH chases that feeling inside a browser tab:

* **A real place.** A 3 × 3 km hand-shaped, procedurally detailed province — sea cliffs, tundra, pine forests, autumn marshes, hot springs and a mountain you can climb to the summit — streamed with quadtree LOD so the far peaks are always on the horizon.
* **Any build.** Eighteen skills that improve by *using* them, ninety perks, three attributes, and no classes. A sneaking archer, a heavy-armoured axe-swinger and a fire-throwing mage are all the same character at different times.
* **Everything is an object.** Every item has weight, value, a 3D model and a use. Loot is levelled; containers remember what you took; merchants have gold and stock that restocks.
* **An epic you can ignore.** Eleven main quests carry a dragon-war story from the execution block to the halls of the dead, but nothing stops you wandering off for twenty hours first.
* **The best-looking thing we can make with three.js.** Atmospheric scattering, an aurora, volumetric-looking clouds, height fog that catches the sun, PBR materials with procedural normal maps, GPU grass that bends in the wind, water with Fresnel reflections and shoreline foam, bloom, colour grading and filmic tone mapping — with quality tiers so it still runs on a phone.

### Pillars

1. **Freedom of movement.** If you can see it you can walk to it (or die trying).
2. **Systems that talk to each other.** Fire burns, frost slows, sneaking in shadow beats a lit room, a stolen sword is still stolen, a dragon's soul makes your Shout stronger.
3. **Readable at a glance.** The Skyrim HUD idiom: a compass with markers, three thin bars, a crosshair and nothing else until you need it.
4. **Touch is a first-class input.** Twin-stick touch with contextual buttons, auto-target assist, big menus, third-person by default on phones.

---

## 2. Setting and lore

### 2.1 The Frostmarch

The northernmost province of the fading **Aldermere Empire**: a land of fjords, black pines and ice, ruled by five Jarls under a High King who died two winters ago. The province is split between Jarls loyal to the Empire and those who want the north free (the *Stormcloaks* analogue are the **Hearthguard**; the Empire's legion is the **Grey Legion**). That civil war is the background; the dragons are the foreground.

Thousands of years ago dragons ruled the land as god-kings through a cult of **dragon priests**. Mortals learned the dragons' own weapon — the **Voice**, the speaking of words of power in the dragon tongue — and cast them down. The greatest of the dragons, **Vyrthax the Ash-Wyrm**, firstborn of the Sky-Father, could not be killed, so the heroes of that war read a **Sky Scroll** and cast him *forward in time*. The time has come round. Vyrthax is back, and he is raising the dead dragons from their burial mounds.

Rarely, a mortal is born with a dragon's soul. They can take the souls of slain dragons and learn words of power in moments that take others a lifetime. The old prophecies call them **Stormsworn**. You are one.

### 2.2 Factions

| Faction | Seat | What they want | Player can |
|---|---|---|---|
| **Jarls of the five holds** | each city's hall | order, taxes, safety from dragons | do bounties, become Thane, buy a house |
| **The Elders of Highcairn** | Highcairn monastery on Mount Hrimgard | to study the Voice in peace | learn Shouts, follow the Way of the Voice |
| **The Wyrmwatch** | hidden | to kill every dragon (Blades analogue) | ally in the main quest |
| **The Shieldkin** | Hearthhall, Brightwater | honour in battle (Companions analogue) | join, do contracts, rise in rank |
| **The Frostspire** | Hrimvik | arcane knowledge (College analogue) | join, learn spells, side quests |
| **The Quiet Hand** | Mirefen undercity | coin (Thieves Guild analogue) | join, steal, fence goods |
| **Bandits / Necromancers / Gloomkin** | camps, ruins, deep caves | to kill you | be killed by you |
| **Dragons and the cult** | mounds, Vahlokar Temple | the return of dragon rule | be devoured, or devour souls |

### 2.3 Dragon tongue (Words of Power)

Shouts are three words. The language is invented for this game; word walls display the glyphs and the transliteration.

| Shout | Words (meaning) | Effect at 1 / 2 / 3 words | Cooldown |
|---|---|---|---|
| **Unrelenting Force** | VOL (push) · KAR (break) · TUM (storm) | stagger 6 m cone · knockdown 9 m · ragdoll 12 m + 30 dmg | 15 / 20 / 45 s |
| **Whirlwind Sprint** | RHAV (wind) · ESH (swift) · SIL (gone) | dash 7 / 13 / 20 m | 20 / 25 / 35 s |
| **Fire Breath** | YRR (fire) · MOK (flame) · TAAL (sun) | cone fire 20 / 40 / 70 dmg + burn | 30 / 50 / 100 s |
| **Frost Breath** | KHEL (frost) · NIIR (cold) · VOS (death) | cone frost 15 / 30 / 50 dmg + stamina drain + slow | 30 / 50 / 100 s |
| **Skybreak** (Dragonrend) | DRAAN (mortal) · VUK (cut) · ZEHL (sky) | forces dragons to land for 8 / 12 / 15 s | 10 / 12 / 15 s |
| **Slow Time** | TIIM (time) · AZUL (sand) · VEHN (stand) | world 0.7 / 0.5 / 0.3× speed for 8 / 12 / 16 s | 30 / 45 / 60 s |
| **Become Ethereal** | SOH (spirit) · LUN (mist) · DREY (fade) | invulnerable 8 / 13 / 18 s (cannot attack) | 20 / 30 / 40 s |

Each word must be *learned* (read from a word wall or taught) and *unlocked* (spend one dragon soul). The Elders and the main quest teach some words directly.

---

## 3. The world map

3 072 m × 3 072 m, x east, z south, y up (north = −z). The terrain grid is 1 025 × 1 025 samples at 3 m. Sea level is y = 0.

```
            N   (Hrimsea — the frozen northern sea)
  +---------------------------------------------------------+
  |  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~[Frostspire] ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ |
  | whitewastes  Grimhallow   HRIMVIK        icefields  [Vahlokar|
  |  (snow)       Crypt        (port)                    Temple]|
  |  ^^^^                                     pinewoods         |
  | ^Grey^   Greywatch      BRIGHTWATER       (Ember-           |
  | ^spine^  Tower       (Wyrmguard Hall)      fields,          |
  | ^STONE-^              plains, river        hot springs,     |
  | ^CLEFT ^ [Deepforge]       |               giants)          |
  |  ^^^^                 Kalrstead Mound                       |
  |      Bleakfang Barrow      ^^^^^                MIREFEN     |
  |          (peak)      ^ MOUNT HRIMGARD ^      (autumn marsh, |
  |   PINEBROOK village   ^ Highcairn  ^ Kelvik    Lake Mirrow) |
  |   river, sawmill        ^^^^^^^^                            |
  |       HOLLOWMERE KEEP (start)     pinewoods                 |
  +---------------------------------------------------------+
            S   (impassable border mountains)
```

### 3.1 Regions and biomes

| Region | Area | Ground | Trees | Weather | Wildlife / foes |
|---|---|---|---|---|---|
| **Hrimsea coast** | north edge | snow, ice floes, black rock | none | snow, fog | mudcrabs, ice wolves, horkers (seals) |
| **Whitewastes** | NW | deep snow, tundra rock | dead pines | snowstorms | ice wolves, snow bears, frost trolls |
| **Greyspine mountains** | W | rock, snow above 350 m | sparse pines | clear/snow | sabre cats, trolls, bandits |
| **Brightwater plains** | centre | golden tundra grass, lichen rock | lone pines, shrubs | clear, rain | elk, wolves, giants (east edge) |
| **Southern pinewoods** | S | moss, needles, ferns | dense tall pines | fog, rain | wolves, bears, spiders, bandits |
| **Mount Hrimgard** | S-centre | rock, then permanent snow | pines up to 420 m | snow above 500 m | frost trolls, ice wraiths, dragons |
| **Emberfields** | E | ash soil, hot springs, sulphur | birches, dead trees | steam haze | mammoths, giants, sabre cats |
| **Mirefen marsh** | SE | wet moss, red/orange autumn ground | autumn birches (red, gold) | clear, fog | mudcrabs, spiders, skeevers |
| **Northeast icefields** | NE | snow, glacier | none | blizzards | dragons, draugr |

Biome colours are a regional tint texture; ground layers (grass, moss, dirt, rock, snow, ash, sand, road) are blended in the terrain shader by masks, slope and altitude.

### 3.2 Locations (34)

Every location has a map marker (undiscovered = hidden until you are within 60 m or told about it), a compass icon, and once discovered can be fast-travelled to.

**Cities and villages (7):** Brightwater, Hrimvik, Stonecleft, Mirefen, Pinebrook, Kelvik, Hollowmere Keep (ruined after the prologue).

**Main-quest sites (8):** Hollowmere Undercroft, Bleakfang Barrow, Greywatch Tower, Highcairn, Grimhallow Crypt, Kalrstead Mound, Deepforge Hold, Hrimgard Summit (the Time-Wound), Vahlokar Temple; plus Valhold (the realm of the dead, a separate world).

**Dungeons (12):** Wolfskull Cave, Brokenfang Den, Silverdrift Lair, Embershard Mine, Halted Stream Camp (bandit mine), Fort Greymoor (bandit fort), Rimeholt Barrow, Gloomreach Cavern (Gloomkin), Valtheim Towers (bandit toll towers), Shroud Hearth Barrow, Ironbind Barrow, Sunderstone Gorge.

**Landmarks (7):** the Guardian Stones (Warrior, Mage, Thief) near Pinebrook, the Lord, Lover and Steed stones elsewhere; Brightwater giant camp (Bleakwind Bluff); Emberfield hot springs; a shipwreck on the north shore; word wall shrines on hilltops; the Sawmill.

Main roads join every city; signposts at crossroads name the destinations.

---

## 4. Story — the main quest (11 quests)

Each quest is a chain of **stages**; each stage has objectives with map/compass markers, and triggers (enter area, talk to, kill, take item, read book, learn word) that advance it. The journal holds the text.

1. **Ashes of Hollowmere** — You wake in a cart beside the rebel **Halvard Stonehand**. At the block in Hollowmere Keep the headsman raises the axe; **Vyrthax** lands on the tower. In the chaos Halvard cuts your bonds and you flee through the burning bailey into the keep, take gear from the armoury, fight Grey Legion soldiers and a cave bear in the **Undercroft**, and emerge into the forest as the dragon flies north. *Tutorial: movement, looting, equipping, melee, block, archery, a first spell (Flames), sneaking past the bear.*
2. **Before the Storm** — Halvard leads you to **Pinebrook**, where his sister **Gerda** asks you to warn the Jarl. Ride the road north to **Brightwater** and speak with **Jarl Sigrun Ironbrow** in **Wyrmguard Hall**.
3. **The Dragonstone** — Court wizard **Ysolde Farran** needs an ancient tablet from **Bleakfang Barrow**, high on the peak above Pinebrook. Fight bandits and draugr, solve the rotating pillar puzzle, use the **Golden Claw** on the claw door (rings: *bear, moth, owl* — shown on the claw), learn the word **VOL** at the word wall, defeat the **Draugr Overlord**, and bring the Dragonstone back.
4. **Dragon Rising** — A dragon is attacking **Greywatch Tower**. Fight it with Housecarl **Brenna** and the guards. When it dies its soul pours into you: you are **Stormsworn**. The sky rumbles: the Elders call you. The Jarl names you Thane and gives you Brenna as housecarl.
5. **The Way of the Voice** — Climb the **Thousand Steps** from **Kelvik** to **Highcairn**. **Master Ostvald** tests your Voice, teaches **KAR**, then **RHAV** (Whirlwind Sprint) with a timed gate trial. Final trial: retrieve the **Horn of Hroth** from **Grimhallow Crypt** (traps, a sprint-through gate puzzle, the word **ESH**).
6. **Wyrmwatch** — The horn has been taken; a note sends you to the **Sleeping Elk** in Pinebrook, where **Sela Varr** of the Wyrmwatch reveals herself. Together you watch Vyrthax **resurrect** the dragon **Sahlrok** at **Kalrstead Mound** and fight it.
7. **The Lost Lore** — Sela sends you to find the old loremaster **Torvik** hiding in the Frostspire library at **Hrimvik**. He tells you of **Skybreak**, the Shout the ancient heroes used to bring Vyrthax down, learned from the memory left in the **Time-Wound** on the summit — and only with the **Sky Scroll**.
8. **The Sky Scroll** — The last Sky Scroll lies in **Deepforge Hold**, the drowned machine-city beneath **Stonecleft**. Descend past clockwork spiders, brass sentinels and blind **Gloomkin**, defeat the **Steam Colossus**, and take the scroll from the orrery vault.
9. **The Time-Wound** — On **Hrimgard Summit** the ancient dragon **Thurnvaal**, who taught mortals the Voice, greets you and teaches **YRR** in a Shout duel. Read the scroll: the past plays out around you and you learn **DRAAN VUK ZEHL**. Vyrthax descends — use Skybreak to ground him; he flees to Valhold to feed on the souls of the dead.
10. **The Fallen** — Convince the Jarl to let you trap a dragon in **Wyrmguard Hall**. Shout **Raskhar** down onto the porch and close the yoke. Beaten, he reveals Vyrthax's portal at **Vahlokar Temple** and carries you there (cutscene). Fight up through the temple to the dragon priest **Zahrakhul**, take his mask, step through the portal.
11. **Valhold** — The misted realm of the dead: a golden-green sky, lost souls in the fog, the Whale-Bone Bridge and its keeper **Hrothvald**. Join the three heroes of old — **Eydis Wolfheart**, **Brand the Unbowed** and **Solveig of the Long Spear** — Shout the mist away and use Skybreak to bring **Vyrthax** down for the last time. He dies, his body burns away, and you return to Hrimgard Summit as dragons circle in salute. *Credits; the world stays open.*

### 4.1 Side quests (21)

* **Shieldkin (4):** *Proving Honour* (spar with Torbjorn), *Take Up Arms* (clear Brokenfang Den), *The Silver Hand* (bandit hunters at Fort Greymoor), *Glory of the Dead* (the Harbinger's barrow, Ironbind).
* **Frostspire (3):** *First Lessons* (ward trial, the Magister), *Under Rimeholt* (recover the Staff of Hollow Winds), *The Spire's Eye* (cleanse the Gloomreach shard).
* **Quiet Hand (3):** *A Chance Arrangement* (plant a ring on a merchant), *Taking Care of Business* (collect debts), *Loud and Clear* (steal the Golden Mare from a meadery vault).
* **Town (8):** *The Golden Claw* (Pinebrook trader's claw, intertwined with MQ3), *A Night to Remember*-style *The Lost Ring* (Mirefen), *Giant Trouble* (Brightwater farm), *Wolves at the Door* (Pinebrook), *Hakon's Iron* (smithing tutorial), *The Wounded Elk* (hunting), *Letters Home* (courier), *The Necromancer's Grave* (Shroud Hearth).
* **Thane and house (2):** *Windward Cottage* (buy a house in Brightwater), *Thane of Brightwater*.
* **Radiant (endless):** Jarls' bounties — kill the bandit leader of a random camp, the dragon at a random lair, or the giant troubling a farm; Shieldkin contracts; Quiet Hand fencing jobs.

### 4.2 World events

* **Dragon attacks** after *Dragon Rising*: roughly every 1–2 in-game days outdoors, a dragon (Dragon, Blood, Frost, Elder or Ancient by level) appears and attacks — often a town, where the guards fight too.
* **Random encounters:** Grey Legion and Hearthguard patrols, a trader with a pack horse, a courier with a letter, a fleeing thief, a hunter with a dog, wandering bards.
* **Ambient life:** NPCs keep schedules (sleep, work, eat, drink at the inn), guards patrol, smiths hammer, millers saw, children play.

---

## 5. The player

### 5.1 Character creation

* **Name**, **body** (two frames), **skin tone**, **hair** (8 styles × colours), **beard** (6), **eye colour**, **face paint**, **kin** (race):

| Kin | Looks | Starting skill bonuses | Passive |
|---|---|---|---|
| **Norrhen** (Nord) | fair, tall | +10 Two-Handed, +5 One-Handed, Block, Smithing, Speech, Light Armor | 50% frost resistance |
| **Caldaran** (Imperial) | olive, average | +10 Restoration, +5 Heavy Armor, Block, One-Handed, Destruction, Enchanting | find more gold |
| **Aelfen** (High Elf) | golden, tall, pointed ears | +10 Illusion, +5 Conjuration, Destruction, Restoration, Alteration, Enchanting | +50 magicka |
| **Vael** (Wood Elf) | brown, slight, pointed ears | +10 Archery, +5 Sneak, Lockpicking, Pickpocket, Light Armor, Alchemy | 50% poison/disease resistance |
| **Ashen** (Dark Elf) | grey-blue, red eyes | +10 Destruction, +5 Sneak, Light Armor, Alteration, Illusion, Alchemy | 50% fire resistance |
| **Orsk** (Orc) | green-grey, tusks, broad | +10 Heavy Armor, +5 Block, Two-Handed, One-Handed, Smithing, Enchanting | +10% melee damage |

All skills start at 15 (plus kin bonuses).

### 5.2 Attributes

| Attribute | Start | Regen (per s, out of combat ×2) | Used by |
|---|---|---|---|
| **Health** | 100 | 0.7% of max | damage taken; 0 = death |
| **Magicka** | 100 | 3% of max | spells |
| **Stamina** | 100 | 5% of max (after 1 s) | sprint (7/s), power attacks (25+weight/2), bash (20), bow hold (after 3 s), jump (10) |

Level-up: choose +10 Health, +10 Magicka, or +10 Stamina (+5 carry weight), and gain one **perk point**. Carry weight 300 (+5 per stamina choice); over-encumbered = walk only, no fast travel.

### 5.3 Skills and leveling

18 skills in three constellations:

* **Warrior:** One-Handed, Two-Handed, Archery, Block, Heavy Armor, Smithing
* **Thief:** Light Armor, Sneak, Lockpicking, Pickpocket, Speech, Alchemy
* **Mage:** Destruction, Restoration, Alteration, Conjuration, Illusion, Enchanting

**Skill XP.** Using a skill earns XP (`useMult × baseValue`). XP needed to go from skill level *L* to *L+1* is

```
xpToNext(L) = 1.0 × L^1.95 + 30        (Skyrim: skillImproveMult × L^1.95 + offset)
```

with per-skill use multipliers tuned so a focused player gains a combat skill level every 2–4 fights at level 20. Trainers sell up to 5 levels per character level (price `L × 10 gold`); skill books give +1 the first time they are read. Being *Well Rested* (+10%) and the Guardian Stones (+20% to their group) multiply skill XP.

**Character XP.** Each skill level-up gives character XP equal to the new skill level. Character level *N* needs

```
charXpToNext(N) = (N + 3) × 25
```

Skill caps at 100. Perk points are spent on the constellations.

### 5.4 Perks (90 — five per skill)

Each skill has five perks unlocked at skill thresholds (0, 20, 40, 60, 80) and chained in its constellation. Selected examples (full table in `js/sim/perks.js`):

| Skill | Perks |
|---|---|
| One-Handed | Armsman (+20% dmg), Fighting Stance (−25% power attack stamina), Bladesman (crits), Savage Strike, Paralyzing Strike |
| Two-Handed | Barbarian, Champion's Stance, Deep Wounds, Devastating Blow, Warmaster |
| Archery | Overdraw (+20%), Eagle Eye (zoom), Steady Hand (slow time when zoomed), Power Shot (stagger), Quick Shot (+30% draw) |
| Block | Shield Wall (+20% block), Deflect Arrows, Power Bash, Elemental Protection, Quick Reflexes |
| Heavy Armor | Juggernaut (+20% AR), Well Fitted, Tower of Strength, Cushioned, Conditioning |
| Smithing | Steel, Arcane Blacksmith, Elven, Glass, Daedric/Dragon smithing — unlocks recipes and tempering |
| Light Armor | Agile Defender, Custom Fit, Unhindered, Wind Walker, Deft Movement |
| Sneak | Stealth, Backstab (6× dagger), Deadly Aim (3× bow), Muffled Movement, Assassin's Blade (15× dagger) |
| Lockpicking | Novice→Master locks (easier), Quick Hands, Wax Key, Golden Touch, Unbreakable |
| Pickpocket | Light Fingers, Night Thief, Cutpurse, Extra Pockets, Misdirection |
| Speech | Haggling (+10% prices), Allure, Merchant (sell any type), Investor, Persuasion |
| Alchemy | Alchemist (+20%), Physician, Benefactor, Poisoner, Purity |
| Destruction | Novice→Expert Destruction (−50% cost), Augmented Flames/Frost/Shock (+25%), Impact (stagger), Intense Flames, Deep Freeze |
| Restoration | cost perks, Regeneration (+50% healing), Respite (heals stamina), Recovery (+magicka regen), Ward Absorb |
| Alteration | cost perks, Mage Armor (×2 armour spells), Magic Resistance, Stability, Atronach |
| Conjuration | cost perks, Summoner (range), Twin Souls (two summons), Mystic Binding, Elemental Potency |
| Illusion | cost perks, Dual Casting, Animage, Kindred Mage, Quiet Casting |
| Enchanting | Enchanter (+20%), Fire/Frost/Storm Enchanter, Insightful, Extra Effect |

### 5.5 Combat

**Melee.** Light attack (tap) and power attack (hold ≥ 0.35 s, stamina). Each attack has wind-up, strike window, recovery; during the strike window every hostile within the weapon's reach and a 70° arc is hit once. Directional power attacks while moving. Sprinting power attack = lunge.

```
damage = (weaponBase + temperBonus) × (1 + skill / 200) × perkMult
       × (power ? 2.0 : 1.0) × (sneakAttack ? sneakMult : 1) × (dualWield ? 1.0 : 1.0)
armourReduction = min(0.80, AR × 0.0012)       taken = damage × (1 − armourReduction)
```

Sneak attack multipliers: 3× melee/bow, 6× dagger with Backstab, 15× with Assassin's Blade; bows 2× → 3× with Deadly Aim. Power attacks and shield bashes stagger. Blocking negates `(shield ? 0.35 : 0.25) + block/200` of melee damage (up to 85%) and costs stamina; blocking an attack in its first 0.2 s is a *timed block* that staggers the attacker.

**Archery.** Hold to draw (1.1 s to full; Quick Shot −30%), release to loose. Arrows are ballistic projectiles (`v = 55 m/s × draw`, gravity 9.8) that stick in what they hit and can be picked up again (50%). Zoom on full draw (Eagle Eye). Bow damage = bow + arrow.

**Magic.** Two hands: equip a spell to either hand. Kinds: **concentration** (stream; Flames, Frostbite, Sparks, Healing), **fire-and-forget** projectiles (Firebolt, Ice Spike, Lightning Bolt, Fireball with splash), **self** (Oakflesh, Candlelight, Muffle, Invisibility), **target-actor** (Calm, Fury, Fear, Paralyze), **summon** (Familiar, Flame/Frost Atronach, Bound Sword, Raise Zombie) and **wards**. Both hands with the same spell and the Dual Casting perk = 2.2× power at 2.8× cost.

```
cost = baseCost × (1 − 0.4 × skill/100) × (perk ? 0.5 : 1)
fire: +burn 3 s (dmg/3 per s), sets oil alight
frost: drains stamina = dmg, slows 50% for 3 s
shock: drains magicka = dmg/2
```

**Shouts.** Z (or the Shout button). Tap = 1 word, hold to 0.6 s = 2 words, hold 1.2 s = all words learned and unlocked.

**Stagger, knockdown, death.** Actors stagger on power hits; Force and giants send them flying (simple ragdoll arc). Corpses persist until the cell resets; their inventory is a container.

**Damage types and resistance.** Physical (armour), fire, frost, shock, poison, magic (generic). Resistances are percentages from kin, enchantments and potions, capped at 85%.

### 5.6 Sneaking

Crouch (C, or the Sneak button). An eye appears in the crosshair: closed (hidden), half-open (someone is searching), open (detected). Each hostile accumulates **detection** per second:

```
rate = sight × light × (1 − sneakSkill/150) × armourNoise × movement × (in FOV ? 1 : 0.2) / (1 + dist/6)
light: night outdoors 0.35, day 1.0, interior uses nearby light sources
movement: still 0.4, walking 0.8, running 1.5, sprinting 3; heavy boots +30% unless Muffled
```

Detection 0–50% = unaware, 50–100% = searching (walks toward the noise), 100% = combat. Out of sight long enough, a searcher gives up ("Must have been the wind…").

### 5.7 Crime

Owned items show red **Steal** prompts. Stealing, pickpocketing, assault, murder and trespass add **bounty** to the hold (5, 25, 40, 1000, 5 gold). A guard who sees you, or who later spots someone with a bounty, confronts you: **pay** (lose stolen goods), **go to jail** (time passes, lose some skill XP), or **resist** (guards turn hostile). Bounty decays never; pay it off with a guard or the steward.

### 5.8 Followers

Halvard (prologue only), Brenna (housecarl), Jorund (sellsword, 500 gold at the Laughing Mare) and Asta (after joining the Shieldkin). Followers follow, fight your target, wait/follow on command, carry items (trade), level with you, can't die permanently (they kneel at 0 HP unless you hit them).

### 5.9 Travel

Walk, sprint, jump, swim (stamina drains in icy water: freezing damage in the Hrimsea), **ride a horse** (buy one at Brightwater Stables; mount with E, gallop with sprint; horses fight back), **fast travel** from the map to any discovered location (time passes by distance, not while over-encumbered, in combat or indoors), carriages at city stables (pay to ride to any city).

### 5.10 Time, sleep, survival-lite

One real second = 20 game seconds (a game day is 72 minutes). **Wait** (T) 1–24 hours anywhere safe; **sleep** in a bed for the *Well Rested* bonus (or *Rested* in your own house: +15%). Inns rent rooms for 10 gold. Food restores small amounts of health and stamina over time.

---

## 6. Items

### 6.1 Categories

| Category | Examples | Notes |
|---|---|---|
| **Weapons** | dagger, sword, war axe, mace, greatsword, battleaxe, warhammer, bow, staff | 9 types × 9 materials |
| **Armour** | helmet, cuirass, gauntlets, boots, shield | light: hide, leather, scaled, glimmer (elven), crystal (glass), dragonscale · heavy: iron, steel, steel plate, deepforged (dwarven), nightsteel (ebony), dreadforged (daedric), dragonplate |
| **Clothing / jewellery** | robes, tunics, hoods, boots, rings, amulets, circlets | carry enchantments |
| **Ammunition** | iron/steel/glimmer/crystal/nightsteel/dragonbone arrows | |
| **Potions / poisons** | restore H/M/S (4 strengths), fortify skill, resist element, invisibility, poisons | crafted or bought |
| **Food** | bread, cheese wheel, apple, salmon steak, venison stew, mead, ale | small restore over time |
| **Ingredients** | 36 ingredients, 4 effects each | alchemy |
| **Books** | 40 books: lore, letters, journals, 18 skill books, spell tomes | readable in a book view |
| **Scrolls** | single-use spells | |
| **Soul gems** | petty, lesser, common, greater, grand, black | filled by Soul Trap |
| **Crafting** | ore (iron, corundum, moonstone, malachite, ebony, orichalcum), ingots, leather, leather strips, pelts, dragon bone, dragon scale, firewood | |
| **Misc / valuables** | gold, gems (garnet, amethyst, sapphire, emerald, diamond), urns, goblets, claws, keys | |
| **Quest** | Dragonstone, Golden Claw, Horn of Hroth, Sky Scroll, Zahrakhul's Mask | cannot drop |

### 6.2 Weapon and armour tables

Materials share a ladder that scales base damage, armour, weight, value and the smithing perk required. Damage per weapon type at **Iron** tier (each tier ≈ +1 damage for one-handers, +2 for two-handers; value ×1.6):

| Type | Damage | Speed | Reach | Weight | Skill |
|---|---|---|---|---|---|
| Dagger | 4 | 1.3 | 1.6 m | 2 | One-Handed |
| Sword | 7 | 1.0 | 2.0 m | 9 | One-Handed |
| War axe | 8 | 0.9 | 2.0 m | 11 | One-Handed (bleed) |
| Mace | 9 | 0.8 | 2.0 m | 13 | One-Handed (armour pierce) |
| Greatsword | 15 | 0.7 | 2.5 m | 17 | Two-Handed |
| Battleaxe | 16 | 0.7 | 2.5 m | 20 | Two-Handed |
| Warhammer | 18 | 0.6 | 2.5 m | 24 | Two-Handed |
| Bow | 6 | — | — | 9 | Archery |
| Staff | — | — | — | 8 | casts its enchantment |

Material ladder: Iron (L1) → Steel (L4) → Hillforged/Orcish (L8) → Deepforged/Dwarven (L12) → Glimmer/Elven (L16) → Crystal/Glass (L22) → Nightsteel/Ebony (L28) → Dreadforged/Daedric (L36) → Dragonbone (L40). Levelled lists only drop a material once the player reaches its level (with a 10% chance one tier early).

### 6.3 Enchanted items

Loot can roll an enchantment (chance 8% + 0.5%/level): weapons get *of Burning / Frost / Shocks / Draining / Soul Snares / Fear*, armour gets *of Health / Magicka / Stamina / the Ox (carry) / Fire Resistance / …* and a skill fortify. Names are generated (*Steel Sword of Scorching*). Charges on weapons; recharge with a soul gem.

### 6.4 Tempering

At a grindstone (weapons) or workbench (armour) spend one material: `Fine (+1) → Superior (+2) → Exquisite (+3) → Flawless (+4) → Epic (+5) → Legendary (+6)`, max grade by Smithing skill (+1 grade per 20 skill, +1 with the material's perk).

---

## 7. Crafting

* **Smelter:** ore → ingot (2 iron ore → 1 iron ingot; iron + corundum → steel; etc.).
* **Tanning rack:** pelt → leather; leather → 2 leather strips.
* **Forge:** recipes `item ← ingots + leather strips (+ special)`; materials past Steel require their perk.
* **Grindstone / workbench:** tempering (above).
* **Alchemy lab:** combine 2–3 ingredients. The potion has every effect shared by at least two ingredients. You know an ingredient's first effect by eating it, the rest by successfully brewing. Magnitude `= base × 4 × (1 + skill/100 × 1.5) × perkMult`. Potions with only harmful effects are poisons (apply to a weapon).
* **Arcane enchanter:** **disenchant** an enchanted item to learn its enchantment (destroys it); **enchant** an unenchanted weapon/armour with a known enchantment and a filled soul gem. Magnitude `= base × soulFactor × (1 + skill/100) × perkMult` (soulFactor: petty 0.3, lesser 0.5, common 0.7, greater 0.85, grand/black 1.0).
* **Cooking pot:** raw food → stews and steaks.

Every crafting action gives skill XP proportional to the item's value.

---

## 8. Magic catalogue (30 spells)

| School | Novice | Apprentice | Adept | Expert |
|---|---|---|---|---|
| **Destruction** | Flames, Frostbite, Sparks | Firebolt, Ice Spike, Lightning Bolt, Fire Rune | Fireball, Ice Storm, Chain Lightning | Incinerate, Icy Spear, Thunderbolt |
| **Restoration** | Healing, Lesser Ward | Fast Healing, Heal Other, Turn Undead | Close Wounds, Steadfast Ward | Grand Healing, Sunfire |
| **Alteration** | Oakflesh, Candlelight | Stoneflesh | Ironflesh, Magelight | Paralyze, Ebonyflesh |
| **Conjuration** | Conjure Familiar, Bound Sword, Raise Zombie | Conjure Flame Atronach, Bound Bow | Conjure Frost Atronach | Conjure Storm Atronach |
| **Illusion** | Courage, Calm (Clam) | Fury, Muffle | Fear, Invisibility | Mayhem |

Spell tomes are sold by court wizards (Ysolde, the Frostspire) and found in dungeons. The player starts with Flames and Healing.

---

## 9. Creatures and NPCs

### 9.1 Bestiary (36)

| Rig | Creatures |
|---|---|
| **Humanoid** | bandits (marauder, archer, mage, chief), Grey Legion and Hearthguard soldiers, guards, necromancers, draugr (restless, draugr, wight, scourge, deathlord, overlord), skeletons, Gloomkin (blind cave folk, hunched), dragon priest (floating, masked), giants (×3 scale), trolls & frost trolls (long arms, hunched), brass sentinel, steam colossus, flame / frost / storm atronachs, the heroes of Valhold, every townsperson |
| **Quadruped** | wolf, ice wolf, bear, cave bear, snow bear, sabre cat, snowy sabre cat, skeever, fox, elk, deer, goat, cow, mammoth, horse, horker, spectral wolf (familiar), dog |
| **Arachnid** | frostbite spider, giant frostbite spider, clockwork spider, mudcrab |
| **Dragon** | dragon, blood dragon, frost dragon, elder dragon, ancient dragon, Vyrthax (black, red eyes, larger), Thurnvaal (old, grey), Raskhar (red) |
| **Ambient** | birds (crows, hawks), butterflies, dragonflies, fish shadows |

Creature level scales with the player within each creature's range (wolf 1–6, ice wolf 8–14…); encounter zones pick from their lists by level.

### 9.2 AI

States: **idle / sandbox** (schedule activity), **wander**, **patrol** (waypoints), **sleep** (draugr in burial niches wake on detection), **alert / search**, **combat**, **flee**, **follow** (followers), **dead**. Combat behaviours by archetype: *melee* (approach, circle at reach, attack when stamina allows, block when the player winds up, power-attack sometimes), *archer* (keep 10–25 m, strafe, draw and fire, switch to melee if close), *mage* (keep distance, cast projectiles, heal self, summon), *beast* (pounce, bite, retreat when hurt), *giant* (slow overhead smash that launches), *dragon* (below).

**Dragon AI.** `circle` (orbit 40–70 m over the target, roar) → `strafe` (fly a line over the target breathing fire or frost) → `hover` (breathe while hovering) → `land` (when Skybroken, wounded below 50%, or randomly) → `ground` (bite in front, tail sweep behind, wing buffet, breath cone, turn slowly) → `takeoff`. Dies → falls, burns away to a skeleton, its **soul** streams into the player (if Stormsworn), loot: dragon bones and scales.

**Schedules.** Townsfolk have `{ 0–6 sleep (home), 6–8 eat (home), 8–18 work (station), 18–22 relax (inn/plaza), 22–24 home }` variants. Out of the player's sight, NPCs teleport along their schedule.

### 9.3 Dialogue

Dialogue trees with conditions (quest stage, faction rank, skill, gold, item, persuasion via Speech) and actions (start quest, set stage, give/take item/gold, open barter, train skill, follow). Every named NPC has greetings and topics; generic NPCs and guards use a shared bank of barks (a few dozen original guard lines). Speech checks: *Persuade* succeeds if `speech ≥ difficulty` (or with gold for *Bribe*); *Intimidate* uses level.

---

## 10. Dungeons and interiors

Interiors are separate **cells** entered through load doors (fade, then a different scene).

**Generator.** A seeded grid of 4 m cells. Rooms (rectangles of varying size and height), corridors with turns, stairs that change floor height, dead ends with treasure, a loop back to the entrance near the end (Skyrim's "shortcut out"). Themes:

| Theme | Look | Inhabitants | Features |
|---|---|---|---|
| **Barrow (Nordic crypt)** | grey carved stone, knotwork, burial niches, sarcophagi, urns, iron gates, cobwebs, blue candles | draugr, skeevers, frostbite spiders | rotating pillar puzzles, claw doors, pressure-plate traps, swinging blades, a word wall chamber, boss sarcophagus |
| **Cave** | rough rock, stalactites, moss, waterfalls, glowing mushrooms | wolves, bears, trolls, spiders | narrow passages, underground pools |
| **Mine** | timber shoring, rails, lanterns, ore veins | bandits | mineable ore veins |
| **Fort** | ruined stone courtyards, towers | bandits, soldiers | archers on walls |
| **Deepforge (dwarven)** | brass, pipes, steam vents, gears, green lamps, huge halls | clockwork spiders, brass sentinels, gloomkin, the Steam Colossus | levers, steam traps, the orrery |
| **Temple (Vahlokar)** | black stone, dragon statues, braziers | draugr, dragon priest | portal |
| **Buildings** | timber halls with long hearths, tables, beds, shelves, counters, banners | townspeople | shops, inns, the Jarl's throne |

Every dungeon has: an entrance load door, at least one **boss** with a **boss chest**, containers (urns, chests, satchels), loose loot, and a map marker that becomes *Cleared* when the boss dies. Barrows and temples have a **word wall**.

**Traps:** pressure plates (darts from the walls), swinging blade corridors, spike floors, tripwire rockfalls, oil slicks with lanterns.

**Puzzles:** rotating three-sided pillars (animal glyphs: snake, whale, eagle, bear, owl, moth, wolf, dragon) whose solution is carved nearby; claw doors (three rings that rotate to the glyphs on the claw's palm); lever sequences; Grimhallow's timed gates (beat them with Whirlwind Sprint).

---

## 11. User interface

* **HUD (Skyrim idiom):** compass bar at the top (N/E/S/W, quest markers, discovered and nearby location icons, enemies as red dots in combat), magicka (left) / health (centre) / stamina (right) bars that fade out when full, a small crosshair (or the sneak eye), the interaction prompt ("E) Take Iron Sword", "E) Talk to Gerda", "E) Open Bleakfang Barrow", red "Steal"), notifications at top-left ("Skill increase: One-Handed 23", "Quest started", "Location discovered"), a boss/enemy health bar, a Shout cooldown arc, subtitles.
* **Tween menu (Tab):** four directions — Skills (up), Magic (left), Items (right), Map (down) — plus Journal (J), Wait (T), System (Esc).
* **Inventory:** categories (Favourites, Weapons, Apparel, Potions, Scrolls, Food, Ingredients, Books, Keys, Misc), sortable list, item card with stats and a **rotating 3D model**, compare arrows, equip (left/right hand), drop, favourite, weight and gold.
* **Magic:** schools, spell list with cost, equip to hand, Shouts and Powers tab.
* **Skills:** a night sky of eighteen constellations; pick one to zoom in and see its perks as stars joined by lines; perk points and level progress. Level-up dialogue to pick Health/Magicka/Stamina.
* **Map:** the whole province rendered as a parchment hillshade with roads, rivers, towns and markers; pan/zoom by drag/pinch/wheel; set a custom marker; fast travel by clicking a discovered marker.
* **Journal:** active/completed quests, objectives, quest text; system tab (save, load, settings, help, quit).
* **Dialogue:** the speaker's name, lines with typed text, topic list; camera frames the speaker.
* **Containers, barter, crafting stations, lockpicking (rotating pick + turning lock), book reader (parchment pages), wait/sleep dialog, death screen, loading screens with lore tips and a slowly rotating 3D model.**
* **Touch layout:** left half = floating move stick (push to edge to sprint), right half = drag to look; right cluster buttons **Attack** (R hand; hold = power), **Block/L hand**, **Jump**, **Use**, **Shout**; left cluster **Sneak**, **Camera**; top-right **Menu** and **Journal**; buttons hide/appear by context (Use appears when there's something to use). Aim assist pulls the crosshair toward the nearest target in a narrow cone.

---

## 12. Audio

All synthesised with the Web Audio API.

* **Music:** a generative score in D Dorian / A Aeolian. *Exploration*: slow string-like pads (detuned saws through low-pass), a horn melody (filtered saw with vibrato), harp (Karplus-Strong) arpeggios; *town*: lute plucks and a hand drum; *dungeon*: low drones, distant choir; *combat*: taiko-style toms, ostinato low strings, brass stabs, choir "ah" chords (formant-filtered); *title*: the main theme — a male-choir chant over war drums (an original melody). Music cross-fades by context.
* **Ambience:** wind (filtered noise, stronger with altitude and storms), birdsong by day in forests, crickets and owls at night, waves on the coast, river babble, town murmur, crackling fires, dungeon drips and rumbles, Deepforge steam and machinery.
* **SFX:** footsteps by surface (snow, grass, stone, wood, water) and armour weight, weapon whooshes, metal-on-metal blocks, flesh and armour impacts, bow creak and twang, arrow thunks, spells (fire roar, frost crackle, shock zaps, healing shimmer, summon portal), Shouts (the three words as layered formant growls with a pitch drop and a huge reverb tail), dragon roars and wing beats, the soul-absorb crescendo, door creaks, chest lids, coins, potion gulps, page turns, lockpick clicks, level-up and discovery stings, quest chords.
* **Mix:** master, music, effects, voice, ambience sliders; convolution reverb (generated impulse) — larger in dungeons; audio suspends in a background tab (`lib/page-audio.js`).

---

## 13. Rendering

### 13.1 Pipeline

```
RenderPass(world)  →  RenderPass(viewmodel, clearDepth)  →  Sanitize (kill NaN/Inf)
→ UnrealBloom (half res)  →  Grade pass (god rays from the sun, ACES filmic, colour
grading LUT-less curves, vignette, damage/frost/heal tints, shout ripple, film grain,
underwater)  →  FXAA (when no MSAA)  →  OutputPass (sRGB)
```

### 13.2 Systems

| System | Technique |
|---|---|
| **Sky** | single-scattering atmosphere (Rayleigh + Mie, analytic, in a sky-dome fragment shader); sun disc and halo; two moons (Hrim, large and pale; Vala, small and blue) with phases; twinkling star field; **aurora borealis** — ray-marched curtains of noise in a band, green to violet; clouds as a fbm layer on the dome lit by the sun (silver lining), animated by wind, density by weather |
| **Lighting** | sun/moon `DirectionalLight` with a texel-snapped shadow box following the camera (2048 / 1024 / off by tier); hemisphere sky/ground light tinted by time of day; a pool of 6 point lights assigned each frame to the nearest torches, fires and spells (constant count = no shader recompiles) |
| **Fog** | three's fog chunks replaced globally with height + distance exponential fog that takes the sky colour toward the horizon and an orange/white glow toward the sun (in-scattering), denser in valleys and weather |
| **Terrain** | CPU quadtree of 33×33-vertex nodes (96 m … 3 072 m), skirts to hide LOD cracks, baked vertex ambient occlusion from the height field; a patched `MeshStandardMaterial` that blends grass, moss, dirt, rock, snow, ash, sand and road layers by masks, slope and altitude, rock triplanar on cliffs, two-scale texture sampling to hide tiling, procedural normal maps, snow sparkle, wetness in rain |
| **Water** | sea and lakes as flat sheets: two scrolling procedural normal maps, Fresnel reflection of the sky colour, sun specular, depth from the height-field texture for colour absorption and shoreline foam, gentle vertex waves on the sea; rivers as spline ribbons with flow-aligned scrolling |
| **Vegetation** | pines, firs, birches (green and autumn), dead trees, bushes, ferns, rocks and boulders as instanced meshes in 3 LODs per type, placed by a seeded scatter per 64 m cell from the biome masks; wind sway in the vertex shader; **GPU grass**: a ring of instanced blade clumps around the camera whose heights, colour and density are read from the height and biome textures in the vertex shader, bending with wind and away from the player |
| **Structures** | parametric Nordic architecture generated in code: longhouses (stone footing, log walls, steep shingle or thatch roofs, crossed carved gable beams), halls, towers, palisades, stone city walls with gates, docks on piles, a water-wheel sawmill (animated), bridges, ruins, standing stones, word walls, signposts; merged per settlement into a few draw calls using a shared material atlas |
| **Characters** | rigid-skinned `SkinnedMesh` per actor: body, head (eyes, brows, hair, beard), clothing and armour pieces are separate parametric meshes merged into one geometry with bone indices, so each actor is one draw call (+ one for shadows); a shared PBR atlas (skin, cloth, leather, fur, iron, steel, gold, wood, bone, glass…) with normal and roughness/metal tiles; procedural animation (walk, run, sprint, sneak, idle breathing, attacks per weapon type, block, bow draw, casting, stagger, death fall, sit, sleep, work) |
| **First person** | a viewmodel scene rendered on top with its own depth: arms in the player's armour, the equipped weapons/shield/bow/spell hands, sway and bob, attack animations matched to the simulation's attack phases |
| **FX** | GPU particle pools (one `Points` draw per pool, soft circular sprites): fire, embers, smoke, frost mist, sparks, blood, dust, snow, rain, magic glows, the dragon-soul streams; lightning as jagged additive ribbons; fireball explosions with light flashes; shout shock rings and a screen-space ripple; arrows and decals |
| **Weather** | clear / cloudy / fog / rain / snow / blizzard, per region; changes over hours; drives cloud cover, fog density, light, wetness, particles and ambience |
| **Interiors** | merged per-dungeon geometry from the generator; baked vertex lighting from torches and braziers; flickering dynamic lights from the pool; dust motes; volumetric light shafts from ceiling holes (additive cones) |

### 13.3 Quality tiers

| | Ultra (desktop) | High | Medium (default on phones) | Low |
|---|---|---|---|---|
| pixel ratio | min(dpr, 2) | 1.5 | 1.0 | 0.75 |
| shadows | 2048, 140 m | 2048, 100 m | 1024, 60 m | off |
| grass ring | 70 m, dense | 55 m | 35 m | 20 m sparse |
| tree LOD distances | 120 / 450 / 1500 | 100 / 380 / 1200 | 70 / 260 / 900 | 50 / 180 / 700 |
| terrain split factor | 2.2 | 2.0 | 1.6 | 1.3 |
| bloom | full | full | half | off |
| MSAA | 4× | 4× | FXAA | none |
| clouds/aurora steps | 6 | 5 | 3 | 2 |

The game starts on High (desktop) or Medium (coarse pointer) and drops a tier after 3 consecutive samples under 30 fps; a dynamic resolution scale nudges the pixel ratio between tiers.

---

## 14. Architecture

`js/sim/` is a **pure simulation**: no three.js, no DOM, no `Math.random` (one seeded RNG), no imports from `view/` or `ui/`. The view reads it every frame; the sim announces things through a bounded event queue drained once per frame by the view, audio and UI. Node tests import the sim directly.

```
game-071/
├── index.html, style.css, game-plan.md
├── js/
│   ├── main.js            boot, modes, fixed-step loop, event drain, glue
│   ├── config.js          tunables, quality tiers
│   ├── save.js            slots, autosave, quicksave (guarded localStorage)
│   ├── input.js           keyboard/mouse (pointer lock), gamepad, touch → one action snapshot
│   ├── audio.js           music, ambience, sfx, voice (Shouts)
│   ├── sim/
│   │   ├── rng.js         mulberry32, hashes, value/simplex noise, fbm
│   │   ├── terrain.js     height grid, masks, biome tint, roads/flatten, heightAt/normalAt/water
│   │   ├── geography.js   regions, locations, roads, settlements, encounter zones
│   │   ├── items.js       item database and generators
│   │   ├── loot.js        levelled lists
│   │   ├── stats.js       skills, XP, levels, derived stats
│   │   ├── perks.js       perk definitions and effects
│   │   ├── inventory.js   add/remove/equip/weights
│   │   ├── magic.js       spells, enchantments, active effects
│   │   ├── shouts.js      words of power
│   │   ├── actors.js      actor templates, creatures, NPC roster
│   │   ├── ai.js          behaviour state machines (incl. dragons)
│   │   ├── combat.js      attacks, projectiles, damage
│   │   ├── physics.js     movement, collision (terrain, colliders, interior grids)
│   │   ├── colliders.js   spatial hash of static colliders
│   │   ├── settlements.js town layouts (buildings, stations, NPC homes)
│   │   ├── dungeon.js     interior generator
│   │   ├── crafting.js    smithing, tempering, smelting, tanning, cooking, alchemy, enchanting
│   │   ├── dialogue.js    dialogue trees
│   │   ├── quests.js      quest definitions and engine
│   │   ├── crime.js       bounty, ownership
│   │   ├── lockpick.js    the lock model
│   │   └── world.js       the World: time, weather, cells, spawning, tick, events
│   ├── view/
│   │   ├── renderer.js    renderer, composer, post shaders, quality, resize
│   │   ├── textures.js    procedural textures and atlases
│   │   ├── sky.js, terrain.js, water.js, vegetation.js, grass.js, structures.js
│   │   ├── interior.js, characters.js, creatures.js, dragon.js, viewmodel.js
│   │   ├── fx.js, lights.js, camera.js
│   │   └── worldview.js   owns the scene and syncs it to the sim
│   └── ui/
│       ├── hud.js, menus.js, inventory.js, magic.js, skills.js, map.js, journal.js
│       ├── dialogue.js, barter.js, crafting.js, lockpick.js, book.js
│       ├── title.js       title, character creation, loading
│       └── touch.js
└── dev/  simtest.mjs, browsertest.mjs, shot.mjs, README.md
```

### 14.1 The loop

```
frame(dt):
  input → action snapshot (edge-triggered actions consumed on the first sub-step)
  accumulate dt; while acc ≥ 1/60: world.tick(1/60, actions)   (max 4 steps)
  drain world.events → view.onEvent, audio.onEvent, ui.onEvent
  view.sync(world, alpha); camera; renderer.render
  ui.update (HUD every frame, menus on change)
```

### 14.2 Cells and streaming

The exterior is always loaded as data; the *view* streams terrain nodes, vegetation cells and structure groups around the camera. Actors outside 160 m of the player are frozen (or advanced cheaply along schedules); encounter zones spawn their creatures when the player comes within 200 m and despawn them past 300 m unless they are persistent. Interiors are generated on entry from `(seed, dungeonId)` and cached; their *state* (looted containers, dead bosses, opened gates, pulled levers) is saved by id.

### 14.3 Save data

```
{ version, seed, time, weather, player: { name, look, kin, pos, cell, hp…, skills, xp, perks, attributes,
  inventory, equipment, spells, shouts, souls, effects, bounty, gold }, quests: { id: { stage, done, vars } },
  discovered, cleared, containers: { id: [items] | 'looted' }, uniqueDead, followers, horse, flags, stats }
```

Three manual slots, an autosave on every location change and quest stage, a quicksave (F5/F9). All `localStorage` access is guarded; the game runs without storage.

---

## 15. Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD | left stick | left stick (floating) |
| Look | mouse (pointer lock) | right stick | drag right half |
| Sprint | Shift (hold) | L3 | push stick to the edge |
| Walk/run toggle | Caps Lock | — | stick distance |
| Jump | Space | A | Jump |
| Sneak | C / Ctrl | B | Sneak |
| Activate / talk / take | E | X | Use (contextual) |
| Right hand attack / cast | left mouse (hold = power) | RT | Attack (hold = power) |
| Left hand block / cast | right mouse | LT | Block |
| Shout | Z (hold for more words) | RB | Shout |
| Draw/sheathe | R | Y | (auto) |
| First / third person | V (wheel zooms 3rd) | R3 | Camera |
| Menus | Tab (tween), I items, M map, J journal, P magic, K skills, T wait, Esc system | Start/Back | Menu, Journal |
| Favourites | Q, 1–8 hotkeys | D-pad | in the menu |
| Quicksave / quickload | F5 / F9 | — | System menu |

---

## 16. Testing

* `dev/simtest.mjs` (Node, pure sim):
  * **purity** — `js/sim` imports no three/DOM/`Math.random`/view;
  * **terrain** — determinism, every settlement and dungeon entrance above water and on walkable ground, roads have climbable grades, the summit is reachable by the Thousand Steps;
  * **items** — every item valid, every recipe's inputs exist, every material reachable by levelled lists, enchanted names unique;
  * **alchemy/enchanting/smithing** — formulas, learnable effects, every potion craftable from sold ingredients;
  * **leveling** — XP curves, perks unlock in order, a level-30 character's numbers;
  * **combat** — damage, armour cap, sneak multipliers, blocking, spells, shouts; a melee bot vs every creature at its level range;
  * **dungeons** — 300 seeds × every theme: connected, boss reachable, word wall reachable, no spawn in walls;
  * **quests** — a bot drives the main quest from the prologue to the credits through the real world API (walking, talking, fighting with debug strength, solving puzzles), plus every side quest's stages are reachable;
  * **save** — save → load round-trips the world.
* `dev/browsertest.mjs` (Playwright, real Chromium + SwiftShader WebGL): title → character creation → prologue (dragon, escape) → movement, looting, equipping, combat, a spell, the HUD and compass → every menu (items, magic, skills, map, journal, wait) → a dungeon interior and back → barter → save/reload/continue; then touch-only phones at 390×844 and 844×390: layout fits, canvas matches the viewport, buttons are finger-sized, sticks move and look, Attack swings, menus open and close. Fails on any console or page error.

---

## 17. Phases

### Phase 1 — Engine
- [x] Design document
- [ ] Renderer, post chain, quality tiers, resize via `visualViewport`
- [ ] Deterministic terrain, quadtree LOD with skirts, splat shader, baked AO
- [ ] Sky (scattering, sun, moons, stars, aurora, clouds), lighting, height fog, weather
- [ ] Water (sea, lakes, river)
- [ ] Player controller, first/third person camera, keyboard/mouse/gamepad/touch input

### Phase 2 — World
- [ ] Geography: regions, 34 locations, roads, signposts
- [ ] Vegetation (trees, rocks, bushes) with LODs and wind; GPU grass
- [ ] Settlements and Nordic architecture; Wyrmguard Hall; docks; sawmill
- [ ] Day/night, weather per region, ambient wildlife

### Phase 3 — Actors and combat
- [ ] Rigid-skinned humanoid, quadruped, arachnid and dragon rigs with procedural animation
- [ ] AI states, schedules, followers, dragons
- [ ] Melee, blocking, archery, magic, shouts, sneak, stagger, death, loot

### Phase 4 — RPG systems
- [ ] Items, levelled loot, inventory, equipment
- [ ] Skills, XP, levels, perks, attributes
- [ ] Smithing, tempering, smelting, tanning, alchemy, enchanting, cooking
- [ ] Merchants and barter, lockpicking, pickpocketing, crime and bounty

### Phase 5 — Dungeons and interiors
- [ ] Generator (barrow, cave, mine, fort, deepforge, temple, buildings)
- [ ] Traps, puzzles, word walls, boss chests

### Phase 6 — Story
- [ ] Quest engine, journal, markers
- [ ] Main quest 1–11 including Valhold
- [ ] Side quests and radiant bounties, dragon attacks

### Phase 7 — Presentation
- [ ] HUD and every menu, touch layout
- [ ] Music, ambience, SFX, Shout voices
- [ ] Save/load, settings, title, character creation, loading screens

### Phase 8 — Ship
- [ ] simtest, browsertest
- [ ] Launcher entry, README, CHANGELOG, status, docs learnings

---

## 18. Event catalogue (sim → view/audio/UI)

| Event | Payload | Consumers |
|---|---|---|
| `hit` | attacker, target, dmg, kind, pos, blocked, crit, sneak | view (blood/sparks), audio, HUD (enemy bar) |
| `swing` | actor, weapon, power | audio, viewmodel |
| `death` | actor | view (fall), audio, quests |
| `cast` / `spellHit` | actor, spell, hand / pos | fx, audio |
| `projectile` | id, kind | fx |
| `shout` | actor, shout, words | fx (ripple), audio (voice) |
| `soul` | dragon pos | fx (streams), audio, HUD |
| `skillUp` / `levelUp` | skill, level | HUD, audio |
| `quest` | id, stage, kind (start/update/done) | HUD, audio, journal |
| `discover` | location | HUD, audio |
| `pickup` / `gold` | item, count | HUD, audio |
| `say` | actor, line | subtitles, audio |
| `door` | from, to | main (cell change, fade) |
| `crime` | kind, bounty | HUD |
| `dragon` | phase (arrive, land, takeoff) | audio (music), HUD |
| `trap`, `lever`, `puzzle` | id | view, audio |
| `time` | hour, day | sky |

---

## 19. Open questions / out of scope

Out of scope for v1, with reasons:

* **The civil war questline** — it is background and patrols only; its battles would double the AI work.
* **Werewolves, vampires, marriage, children, homestead building** — each is a system the size of a small game.
* **Voiced dialogue** — the browser's speech synthesis varies too much between devices; subtitles and Shout voices only.
* **Full physics ragdolls** — knockdowns and deaths use a scripted fall.

---

## Changelog

### v1.0.0 — 2026-10-08
- First release: everything listed in *Phases*.
