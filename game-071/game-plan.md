# FROSTMARCH — Saga of the Stormsworn

**Genre:** Open-world first/third-person action RPG: a big northern province to explore, levelling by doing, crafting, dungeons and dragons
**Engine:** three.js r165 (ES modules via import map), no asset files: every mesh, texture, sound and note is generated in code
**Target:** desktop (keyboard + mouse, gamepad) and phones/tablets (touch), any aspect ratio, portrait or landscape
**Status:** v1.0.0 — see *Phases* at the end

---

## 1. Vision

You come to the Frostmarch as a courier with one sealed letter, riding the last cart of autumn to Hollowmere Keep. You arrive at dusk to find the keep under attack by the risen dead. Then a black dragon splits the sky, a bolt of its storm strikes you, and you live. The lightning leaves a branching scar down your arm, and the scar *remembers* things. From that night the whole province is yours: walk in any direction, climb any mountain you can see, rob a barrow, join a lodge, forge a sword, distil a poison, read a book, fight a bear. And when the dragons return you find you can do what the ancients did: trace the **Storm Sigils** in the air with your bare hand.

FROSTMARCH is about a world that goes on without you, where anything you can see is a place you can reach. It chases that feeling inside a browser tab:

* **A real place.** A 3 × 3 km province, hand-shaped and procedurally detailed: sea cliffs, tundra, pine forests, autumn marshes, hot springs and a mountain you can climb to the summit. It streams with quadtree LOD, so the far peaks are always on the horizon.
* **Any build.** Eighteen skills that improve by *using* them, ninety perks, three pools (Health, Mana, Stamina) and no classes. A sneaking archer, a heavy-armoured axe-swinger and a fire-throwing mage are the same character at different times.
* **Everything is an object.** Every item has weight, value, a 3D model and a use. Loot scales with your level; containers remember what you took; merchants have gold and stock that restocks.
* **An epic you can ignore.** Eleven main quests carry the story of the storm-wyrm from a burning keep to the eye of a frozen thunderstorm. Nothing stops you wandering off for twenty hours first.
* **The best-looking thing we can make with three.js.** Atmospheric scattering, an aurora, volumetric-looking clouds, height fog that catches the sun, PBR materials with procedural normal maps, GPU grass that bends in the wind, water with Fresnel reflections and shoreline foam, bloom, colour grading and filmic tone mapping. Quality tiers keep it running on a phone.

### Pillars

1. **Freedom of movement.** If you can see it you can walk to it (or die trying).
2. **Systems that talk to each other.** Fire burns, frost slows, a dark corner beats a lit room, a stolen sword is still stolen, a thunderstorm refills your Storm Charge, a slain dragon's ember raises its ceiling.
3. **Readable at a glance.** A compass ribbon with markers, three thin bars, a storm gauge, a crosshair, and nothing else until you need it.
4. **Touch is a first-class input.** Twin-stick touch with contextual buttons, auto-target assist, big menus, third-person by default on phones.

---

## 2. Setting and lore

### 2.1 The Frostmarch

The Frostmarch is a northern league of **five free towns** (Brightwater, Hrimvik, Stonecleft, Mirefen and Kelvik) bound by an old charter. Each town elects a **Warden** to keep its walls and roads, and the five Wardens meet at Brightwater once a year. Beyond the walls are fjords, black pines, ash fields and ice. The danger the towns already know comes from the sea: **Saltreavers**, raiders in grey mail who beach their longboats on the north shore and burn what they cannot carry. Each town's militia, the **Hearthguard**, rides out against them. The dragons are new.

Three thousand years ago the **Wyrm-Kings** ruled the north from storm-wreathed temples, worshipped by a priesthood of **hierophants** who wore iron crowns. The greatest of them, **Vyrthax the Ash-Wyrm**, did not breathe fire so much as *weather*. The mortal **Binders** learned to carve the storm into **sigils**: shapes of lightning that answer a trained hand. With them the Binders brought the Wyrm-Kings down. Vyrthax could not be killed, so they tore out his heart-ember and sank it beneath the ice of the Hrimsea, and his body slept. Now the ice is thinning. Vyrthax is waking, and he is calling the dead dragons out of their mounds to give him back their embers.

Once in an age, lightning chooses someone. The storm-scar lets them **absorb a dragon's ember** and learn a sigil's rings in a moment, where a Binder needed a lifetime. The old carvings call them **Stormsworn**. You are one.

### 2.2 Factions

| Faction | Seat | What they want | Player can |
|---|---|---|---|
| **The Wardens of the five towns** | each town's hall | safe roads, full granaries, no dragons | take the bounty board, become a **Shieldfriend** of the town, buy a house, gain a **Sworn Sword** (retainer) |
| **The Skywatch** | Highcairn observatory on Mount Hrimgard | to read the sky and keep the Binders' lore | learn sigil rings, the stargazing trials |
| **The Hunters' Lodge** | Hearthhall, Brightwater | coin and glory for killing what kills people | join, take monster contracts, rise from Tracker to Lodge-Warden |
| **The Frostspire Academy** | Hrimvik | arcane knowledge | enrol, learn spells, excavation quests |
| **The Lampless** | Mirefen undercity | smuggling and secrets | join, run contraband, fence goods, pull a heist |
| **Hearthguard** | town barracks, road patrols | to keep the Saltreavers off the coast | fight beside them |
| **Saltreavers / bandits / necromancers / Gloomkin** | longboat camps, forts, ruins, deep caves | to kill you | be killed by you |
| **Dragons and the Ember Cult** | mounds, Vahlokar Temple | the return of the Wyrm-Kings | be devoured, or take their embers |

### 2.3 The Storm Sigils

A sigil is a shape of lightning traced in the air with an open palm. Each sigil has **three rings**. Holding the **Sigil** key traces one more ring every half-second, and releasing it unleashes as many rings as you traced and can afford. Rings are learned one at a time from **sigil stones**: three leaning slabs around a plinth, found at the hearts of barrows and on high shrines. The scar copies a ring the moment you touch the stone.

Tracing spends **Storm Charge**, a fourth pool shown as a ring around the compass. Charge trickles back on its own (0.8/s). It returns three times faster in rain and storms, and half as fast underground. **Absorbing a dragon's ember** raises the ceiling by 10 (from 100, up to 300) and fills it.

| Sigil | Rings | Effect at 1 / 2 / 3 rings | Cost |
|---|---|---|---|
| **Gale** | gust · gale · tempest | stagger in a 6 m cone · knockdown 9 m · hurl 13 m + 30 dmg | 20 / 40 / 75 |
| **Stride** | step · leap · flight | dash 7 / 13 / 20 m | 15 / 25 / 40 |
| **Embers** | spark · blaze · pyre | fire fan 20 / 40 / 70 dmg + burn | 25 / 45 / 80 |
| **Rime** | chill · frost · winter | frost fan 15 / 30 / 50 dmg + slow | 25 / 45 / 80 |
| **Earthbinding** | root · chain · anchor | a dragon cannot take wing for 8 / 12 / 15 s | 20 / 30 / 45 |
| **Stillness** | hush · pause · stop | world at 0.7 / 0.5 / 0.3× speed for 8 / 12 / 16 s | 30 / 50 / 85 |
| **Veil** | mist · shade · ghost | blades and spells pass through you for 8 / 13 / 18 s (you cannot attack) | 20 / 35 / 55 |

Barrow wights who served the Wyrm-Kings trace sigils too (Gale and Rime), and so do the Skywatch masters during their trials.

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
  |      Coldmarrow Barrow     ^^^^^                MIREFEN     |
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
| **Hrimsea coast** | north edge | snow, ice floes, black rock | none | snow, fog | mudclaws, ice wolves, walruses, Saltreaver camps |
| **Whitewastes** | NW | deep snow, tundra rock | dead pines | snowstorms | ice wolves, snow bears, frost trolls |
| **Greyspine mountains** | W | rock, snow above 350 m | sparse pines | clear/snow | fangcats, trolls, bandits |
| **Brightwater plains** | centre | golden tundra grass, lichen rock | lone pines, shrubs | clear, rain | elk, wolves, giants (east edge) |
| **Southern pinewoods** | S | moss, needles, ferns | dense tall pines | fog, rain | wolves, bears, spiders, bandits |
| **Mount Hrimgard** | S-centre | rock, then permanent snow | pines up to 420 m | snow above 500 m | frost trolls, frost shades, dragons |
| **Emberfields** | E | ash soil, hot springs, sulphur | birches, dead trees | steam haze | mammoths, giants, fangcats |
| **Mirefen marsh** | SE | wet moss, red/orange autumn ground | autumn birches (red, gold) | clear, fog | mudclaws, spiders, giant rats |
| **Northeast icefields** | NE | snow, glacier | none | blizzards | dragons, wights |

Biome colours come from a regional tint texture. The terrain shader blends ground layers (grass, moss, dirt, rock, snow, ash, sand, road) by masks, slope and altitude.

### 3.2 Locations (34)

Every location has a map marker and a compass icon. Undiscovered locations stay hidden until you come within 60 m or someone tells you about them. Once discovered, you can fast-travel there.

**Towns and villages (7):** Brightwater, Hrimvik, Stonecleft, Mirefen, Pinebrook, Kelvik, Hollowmere Keep (ruined after the prologue).

**Main-quest sites (8):** Hollowmere Undercroft, Coldmarrow Barrow, Greywatch Tower (a beacon tower), Highcairn, Grimhallow Crypt, Kalrstead Mound, Deepforge Hold, Hrimgard Summit (the Chained Wyrm), Vahlokar Temple. The *Eye of the Storm* is a separate world above the temple.

**Dungeons (12):** Howlstone Cave, Bramblemaw Den, Frostvein Lair, Cinderdeep Mine, Stillwater Diggings (bandit mine), Fort Saltreave (Saltreaver fort), Rimeholt Barrow, Murkhollow Cavern (Gloomkin), the Twin Tolls (bandit toll towers), Ashmourn Barrow, Oakenrest Barrow, Cleftwater Gorge.

**Landmarks (7):** the Three Totems (Bear, Owl, Fox) near Pinebrook, plus the Elk, Raven and Ox totems elsewhere; Giant's Hearth (a giant camp); Emberfield hot springs; the wreck of the *Winter Gull* on the north shore; sigil-stone shrines on hilltops; the sawmill.

Main roads join every town, and signposts at crossroads name the destinations.

---

## 4. Story — the main quest (11 quests)

Each quest is a chain of **stages**. Each stage has objectives with map and compass markers, and triggers that advance it: enter an area, talk to someone, kill, take an item, read a book, touch a sigil stone. The journal holds the text.

1. **The Night the Sky Split.** You carry a sealed letter to Hollowmere Keep and arrive to find the risen dead at the gate. Sergeant **Halvard Stonehand** pulls you inside just as **Vyrthax** lands on the tower and the storm strikes you. You wake with the scar. Escape through the burning bailey, arm yourself in the armoury, and cut through the **Undercroft** past the dead and a cave bear to the forest. *Tutorial: movement, looting, equipping, melee, block, archery, a first spell (Flames), sneaking past the bear.*
2. **Word to Brightwater.** Halvard's sister **Ragna** in **Pinebrook** reads your undelivered letter: it warned of the thinning ice. Take it on to **Warden Sigrun Ironbrow** at **Wyrmguard Hall** in **Brightwater**.
3. **The Storm Lodestone.** The Warden's sage **Ivo Farran** wants a lodestone of sky-iron from **Coldmarrow Barrow**: it swings toward dragon mounds. Fight bandits and wights. Open the star-dial door by setting its three bronze dials to the constellation on a **Star-Chart Rubbing** taken from a dead treasure hunter. Touch the barrow's sigil stone: your scar flares and you learn **gust** (Sigil of the Gale). Defeat the **Barrow Captain** and bring the lodestone back.
4. **Ember in the Ashes.** The beacon at **Greywatch Tower** is lit: a dragon is coming. Fight it on the tower with the Hearthguard and Sworn Sword **Brenna**. When it dies, its heart-ember pours into your scar and your Storm Charge swells: you are **Stormsworn**. Lightning walks the clouds over Mount Hrimgard; the Skywatch has seen. The Warden names you **Shieldfriend of Brightwater** and gives you Brenna as your Sworn Sword.
5. **The Pilgrim's Stair.** Climb from **Kelvik** to the **Highcairn** observatory. **Master Ostvald** of the Skywatch tests your hand and teaches **gale**, then **step** (Sigil of the Stride). The final trial: on a stormy night, light the three **beacon cairns** on the mountain's shoulders before their flames gutter, striding across gaps the path no longer bridges.
6. **The Rising.** The lodestone spins wildly toward **Kalrstead Mound**. The cartographer **Sela Varr**, who has been mapping the mounds, rides with you. Together you watch Vyrthax call the dragon **Sahlrok** out of its grave, and you fight it.
7. **The First Storm.** Ostvald sends you to **Grimhallow Crypt**, where the Binders carved their history. It is guarded by traps and wights, with a hall of timed gates. The **Chronicle of the First Storm** tells how the Binders chained Vyrthax: the **Sigil of Earthbinding**, whose three rings they split between the machine-city of Deepforge, the summit of Hrimgard and the crypt itself. Learn **root**.
8. **The Orrery Vault.** The second ring lies in **Deepforge Hold**, the drowned machine-city beneath **Stonecleft**. Descend past clockwork spiders, brass sentinels and blind **Gloomkin**, defeat the **Steam Colossus**, and take the **Orrery Core** from the vault. Seat it in the orrery to read the ring **chain** from its turning brass sky.
9. **The Chained Wyrm.** On **Hrimgard Summit** the Binders left one of Vyrthax's own brood, **Thurnvaal**, bound in iron and frost for three thousand years. He knows the last ring. *Choice:* break his chains and he teaches you **anchor** and flies free, or kill him, take his ember, and read **anchor** from his chains. Vyrthax descends in fury. Earthbind him, wound him, and he flees north to **Vahlokar Temple** to drink the embers of his risen brood.
10. **The Cult's Last Rite.** At the five-Warden council, persuade (or shame) the towns into one march. Lead the Hearthguard and the Hunters' Lodge across the **icefields** to **Vahlokar Temple**. Break the three **ember braziers** that feed the ritual, then fight up to the hierophant **Zahrakhul** and take his **Crown**, which opens the stair to the temple's crown.
11. **The Eye of the Storm.** Above the temple, Vyrthax has become half storm. The battle takes place inside a frozen thunderhead: floating rock islands lit by lightning, with sheets of hail between them. Use Earthbinding to pin him to the islands and Stillness to slip his lightning. If you freed Thurnvaal, he comes out of the clouds to fight beside you; if you slew him, his ember makes your sigils stronger. Vyrthax falls, his body burns away to a cage of bones, and the storm breaks into a clear winter sky over the whole Frostmarch. *Credits; the world stays open.*

### 4.1 Side quests (21)

* **Hunters' Lodge (4):** *The Lodge Trial* (track and kill an alpha wolf), *Bear Season* (clear Bramblemaw Den), *Raiders' Roost* (break the Saltreavers at Fort Saltreave), *The Old Hunter's Barrow* (lay the Lodge's founder to rest at Oakenrest).
* **Frostspire Academy (3):** *The Apprentice's Trial* (a ward test with Magister Varo), *The Rimeholt Excavation* (recover the Staff of Hollow Winds), *The Glass in Murkhollow* (cleanse a corrupted spire shard).
* **The Lampless (3):** *Salt and Shadow* (run contraband past a Hearthguard checkpoint), *Old Debts* (collect from three debtors, by any means), *The Gilded Cask* (lift a priceless cask from a Mirefen vintner's vault).
* **Town (8):** *The Lost Ring* (Mirefen), *Giant Trouble* (Brightwater farm), *Wolves at the Door* (Pinebrook), *Hakon's Iron* (smithing tutorial), *The Wounded Elk* (hunting), *Letters Home* (courier), *The Necromancer's Grave* (Ashmourn), *The Wreck of the Winter Gull* (salvage on the north shore).
* **Shieldfriend and house (2):** *Windward Cottage* (buy a house in Brightwater), *Shieldfriend of Brightwater*.
* **Bounty board (endless):** each town's board posts jobs: kill the leader of a random camp, the dragon at a random lair, or the giant troubling a farm; Lodge monster contracts; Lampless smuggling runs.

### 4.2 World events

* **Dragon attacks.** After *Ember in the Ashes*, a dragon appears outdoors roughly every 1–2 in-game days and attacks, often a town, where the guards fight too. Its kind depends on your level: Dragon, Crimson Wyrm, Rime Wyrm or Ancient Wyrm.
* **Random encounters:** Saltreaver raiding parties on the coast, Hearthguard patrols, a trader with a pack horse, a courier with a letter, a fleeing thief, a hunter with a dog, wandering minstrels.
* **Ambient life:** NPCs keep schedules (sleep, work, eat, drink at the inn), guards patrol, smiths hammer, millers saw, children play.

---

## 5. The player

### 5.1 Character creation

* **Name**, **body** (two frames), **skin tone**, **hair** (8 styles × colours), **beard** (6), **eye colour**, **face paint**, **kin**:

| Kin | Looks | Starting skill bonuses | Passive |
|---|---|---|---|
| **Norrhen** | fair, tall fjord-folk | +8 Two-Handed, +6 Archery, Block, Smithing, +4 Sneak | 35% frost resistance; icy water never hurts |
| **Caldaran** | olive, river-city traders | +10 Speech, +6 One-Handed, Mending, +5 Alchemy, Lockpicking | 10% better prices |
| **Aelfen** | golden, tall, pointed ears | +8 Summoning, Runecraft, +6 Glamour, Shaping, +4 Alchemy | +30 Mana |
| **Vael** | brown, small, pointed ears | +8 Archery, Sneak, +6 Light Armor, Alchemy, +4 Pickpocket | 30% poison resistance |
| **Ashen** | ash-grey, red eyes | +8 Evocation, +6 Smithing, Light Armor, Sneak, +4 One-Handed | 35% fire resistance |
| **Orsk** | green-grey, tusks, broad | +8 Heavy Armor, Smithing, +6 Block, Two-Handed, +2 One-Handed | +20 Health, +5% melee damage |

All skills start at 15, plus kin bonuses.

### 5.2 Pools

| Pool | Start | Regen (per s, out of combat ×2) | Used by |
|---|---|---|---|
| **Health** | 100 | 0.7% of max | damage taken; 0 = death |
| **Mana** | 100 | 3% of max | spells |
| **Stamina** | 100 | 5% of max (after 1 s) | sprint (7/s), heavy swings (25 + weight/2), bash (20), holding a drawn bow (after 3 s), jump (10) |
| **Storm Charge** | 60 / 100 | 0.8 per s (×3 in rain or storm, ×0.5 underground) | Storm Sigils; dragon embers raise the ceiling |

**Growth on level-up is automatic and follows how you play.** The pool tied to the path you raised most since the last level grows by 8 (warrior → Health, thief → Stamina, mage → Mana), the other two grow by 4, and carry weight rises by 5. You also gain one **perk point**. Base carry weight is 300; over the limit you can only walk, and cannot fast-travel.

### 5.3 Skills and levelling

18 skills on three paths:

* **Warrior:** One-Handed, Two-Handed, Archery, Block, Heavy Armor, Smithing
* **Thief:** Light Armor, Sneak, Lockpicking, Pickpocket, Speech, Alchemy
* **Mage:** Evocation (elemental attacks), Mending (healing and wards), Shaping (skin-hardening, light, paralysis), Summoning (allies and spectral weapons), Glamour (the mind and invisibility), Runecraft (enchanting)

**Skill XP.** Using a skill earns XP (`useMult × amount`). The XP to go from skill level *L* to *L+1* is a gentle quadratic:

```
xpToNext(L) = 15 + 0.9·L + 0.12·L²        (raw use × 4.5 × per-skill multiplier)
```

It is tuned so a focused player gains a combat skill level every fight or so early on, every 4–6 fights around 50, and every 15–20 near 90. Trainers sell up to 5 levels per character level (price `L × 10 gold`). Skill books give +1 the first time they are read. Being **Refreshed** after sleeping in a bed (+10%) and the **Raven Totem** (+10%) speed all skills.

**Character XP.** Each skill level-up gives `10 + L/2` character XP, and character level *N* needs `60 + 25·N`. Skills cap at 100. Perk points are spent on each skill's perk ladder.

### 5.4 Perks (90 — five per skill)

Each skill has a ladder of five perks, unlocked at skill 0, 20, 40, 60 and 80; each needs the one before it. Examples (full table in `js/sim/stats.js`):

| Skill | Perks |
|---|---|
| One-Handed | Steady Grip (+20% dmg), Light Footwork (−25% heavy-swing stamina), Keen Edge (telling blows), Hewing Stroke, Stunning Riposte |
| Two-Handed | Heavy Hands, Rooted Stance, Cleaving Arc, Earthshaker, Sweeping Reprisal |
| Archery | Strong Pull (+20%), Far Sight (closer aim), Held Breath (slow time while aiming), Heavy Shafts (knockback), Snap Shot (+30% draw speed) |
| Block | Braced Guard (+20% block), Turn the Shaft, Shield Slam, Weathered Boss, Keen Reflexes |
| Heavy Armor | Ironclad (+20% AR), Matched Harness, Unmoved, Padded Fall, Second Skin |
| Smithing | Steelwright, Runed Anvil, Glimmerwright, Crystalwright, Wyrmwright: each unlocks recipes and better honing |
| Light Armor | Supple Leathers, Tailored, Featherweight, Second Wind, Slip Aside |
| Sneak | Soft Tread, Knife in the Dark (6× one-handed), Hunter's Patience (3× bow), Quiet Buckles, Final Whisper (15× dagger) |
| Lockpicking | Simple Wards, Light Touch, Tricky Wards, Treasure Nose, Tempered Picks |
| Pickpocket | Nimble Fingers, Sleepwalker's Bane, Purse-Snatcher, Hidden Linings, Sleight of Hand |
| Speech | Shrewd (+10% prices), Winning Smile, Any Port (sell anything anywhere), Silent Partner, Silver Tongue |
| Alchemy | Steady Still (+20%), Healer's Measure, Kind Tincture, Bitter Draught, Clean Distillation |
| Evocation | Spark/Flame/Storm Discipline (half-cost circles), Fierce Elements (+25%), Concussive Casting |
| Mending | Gentle Hands, Deep Mending (+50% healing), Breath of Life, Wellspring (+50% mana regen), Drinking Ward |
| Shaping | First Shapes, Unarmoured Grace, Spellbreaker, Lasting Forms, Mana Sponge |
| Summoning | First Calling, Far Calling, Spectral Edge, Strong Bonds, Twin Bonds |
| Glamour | First Veils, Beast Whisperer, Crowd Charmer, Silent Gestures, Will of Iron |
| Runecraft | Runecarver (+20%), Storm Runes, Craft Runes, Rich Essence, Twin Runes |

### 5.5 Combat

**Melee.** A light swing (tap) and a heavy swing (hold ≥ 0.32 s, costs stamina). Each swing has a wind-up, a strike window and a recovery. During the strike window, every hostile within the weapon's reach and a 70° arc is hit once. Moving while you swing changes the heavy swing (stepping back gives a riposte), and a heavy swing while sprinting becomes a lunge.

```
damage = (weaponBase + honingBonus) × (1 + skill / 200) × perkMult
       × (heavy ? 2.0 : 1.0) × (unseen ? unseenMult : 1)
armourReduction = min(0.80, AR × 0.0012)       taken = damage × (1 − armourReduction)
```

Unseen-strike multipliers: 3× melee, 6× one-handed with Knife in the Dark, 15× daggers with Final Whisper; bows 2×, or 3× with Hunter's Patience. Heavy swings and shield bashes stagger. Blocking stops `(shield ? 0.35 : 0.25) + block/200` of melee damage (up to 85%) and costs stamina. A block in the first 0.2 s of an enemy swing is a *timed block*, which staggers the attacker.

**Archery.** Hold to draw (1.05 s to full; Snap Shot −30%) and release to loose. Arrows are ballistic projectiles (`v = 55 m/s × draw`, gravity 9.8) that stick in what they hit and can sometimes be picked up again (50%). At full draw you can aim more closely (Far Sight). Bow damage = bow + arrow.

**Magic.** Equip a spell to either hand. Kinds: **channelled** streams (Flames, Rime Touch, Sparks, Mending), **bolts** (Firebolt, Ice Spike, Lightning Bolt, and Fireball with splash), **self** (Barkskin, Wisplight, Hush, Invisibility), **target** (Calm, Rage, Fear, Paralyze), **summons** (Spirit Wolf, Ember and Rime Golems, Spectral Blade, Raise Corpse) and **wards**. The same spell in both hands gives 2.2× power at 2.8× cost.

```
cost = baseCost × (1 − 0.4 × skill/100) × (discipline perk ? 0.5 : 1) × (Owl Totem ? 0.95 : 1)
fire: burns for 3 s (dmg/3 per s)
frost: drains stamina equal to dmg, slows 50% for 3 s
shock: drains mana equal to dmg/2
```

**Storm Sigils.** Z, or the sigil button. Hold to trace more rings (0.45 s → 2 rings, 1.0 s → 3, as charge allows); release to unleash. See §2.3.

**Stagger, knockdown, death.** Actors stagger on heavy hits, and Gale and giants send them flying (a simple ragdoll arc). Corpses persist until the cell resets, and their inventory is a container.

**Damage types and resistance.** Physical (armour), fire, frost, shock, poison and magic (generic). Resistances are percentages from kin, enchantments and potions, capped at 85%.

### 5.6 Sneaking

Crouch with C or the Sneak button. An eye in the crosshair shows your state: closed (hidden), half-open (someone is searching) or open (seen). Each hostile builds **detection** every second:

```
rate = sight × light × (1 − sneakSkill/150) × armourNoise × movement × (in FOV ? 1 : 0.2) / (1 + dist/6) × (Fox Totem ? 0.85 : 1)
light: night outdoors 0.35, day 1.0, interiors use nearby light sources
movement: still 0.4, walking 0.8, running 1.5, sprinting 3; heavy boots +30% unless Quiet Buckles
```

From 0–50% detection an enemy is unaware, from 50–100% it searches (walking toward the noise), and at 100% it attacks. A searcher who loses you for long enough gives up with a line from a shared bank of original barks.

### 5.7 Law and fines

Owned items show a red **Take (owned)** prompt. Theft, pickpocketing, assault, murder and trespass add a **fine** in that town (5, 25, 40, 1000 and 5 gold). A guard who sees the crime, or who later recognises you, stops you with three choices: **pay** the fine (and lose the stolen goods), **work it off** by spending days on the town wall (time passes and a little skill XP is lost), or **refuse**, and the guards draw steel. Fines never expire; pay them to a guard or at the Warden's hall.

### 5.8 Followers

Halvard (prologue only), Brenna (your Sworn Sword), Jorund (a sellsword, 500 gold at the Laughing Mare) and Asta (after joining the Hunters' Lodge). Followers follow you, fight your target, wait or follow on command, carry items (trade), and level with you. They cannot die for good: at 0 Health they kneel, unless you are the one hitting them.

### 5.9 Travel

Walk, sprint, jump and swim. Stamina drains in icy water, and the Hrimsea does freezing damage unless you are Norrhen or well protected from frost. **Ride a horse:** buy one at a town stable, mount with E and gallop with sprint; horses fight back. **Fast travel** from the map to any discovered location; time passes by distance, and you can't fast-travel while over-encumbered, in combat or indoors. **Caravans** at town stables carry you to any town for a fare.

### 5.10 Time, sleep, survival-lite

One real second is 20 game seconds, so a game day lasts 72 minutes. **Wait** (T) 1–24 hours anywhere safe. **Sleep** in a bed to wake **Refreshed** (+10% skill XP for 8 hours), or **Hearth-warmed** in your own house (+15%). Inns rent rooms for 10 gold. Food restores small amounts of health and stamina over time.

---

## 6. Items

### 6.1 Categories

| Category | Examples | Notes |
|---|---|---|
| **Weapons** | dagger, sword, war axe, mace, greatsword, battleaxe, warhammer, bow, staff | 8 types × 9 materials |
| **Armour** | helmet, cuirass, gauntlets, boots, shield | light: hide, leather, lamellar, glimmer, crystal, wyrmscale · heavy: iron, steel, banded steel, deepforged, hillforged, nightsteel, dreadforged, wyrmplate |
| **Clothing / jewellery** | robes, tunics, hoods, boots, rings, amulets, circlets | carry enchantments |
| **Ammunition** | iron / steel / glimmer / crystal / nightsteel / wyrmbone arrows | |
| **Potions / poisons** | restore Health, Mana or Stamina (4 strengths: weak, plain, strong, potent), bolster a skill, resist an element, invisibility, poisons | brewed or bought |
| **Food** | bread, wheel of cheese, apple, salmon steak, venison stew, honey cake, mead, ale | small restore over time |
| **Ingredients** | 40 ingredients, each with a primary *essence* and a secondary *note* | alchemy |
| **Books** | 40 books: lore, letters, journals, 18 skill books, spell tomes | readable in a book view |
| **Scrolls** | single-use spells | |
| **Essences** | faint, minor, fair, major, great | dropped by slain creatures (see §7); runecraft fuel |
| **Crafting** | ore (iron, copper, glimmerstone, verdite, nightiron, cobalt, silver, gold), ingots (iron, steel, bronze, glimmer, verdite, nightiron, cobalt, deepforged), leather, leather strips, pelts, dragon bone, dragon scale, firewood | |
| **Misc / valuables** | gold, gems (garnet, amethyst, ruby, sapphire, emerald, diamond), urns, goblets, idols, keys | |
| **Quest** | Storm Lodestone, Star-Chart Rubbing, Chronicle of the First Storm, Orrery Core, Crown of Zahrakhul | cannot be dropped |

### 6.2 Weapon and armour tables

Materials share a ladder that scales base damage, armour, weight, value and the smithing perk required. Damage per weapon type at **Iron** tier (each tier adds ≈ +1 damage for one-handers and +2 for two-handers; value ×1.6):

| Type | Damage | Speed | Reach | Weight | Skill |
|---|---|---|---|---|---|
| Dagger | 4 | 1.35 | 1.6 m | 2 | One-Handed |
| Sword | 7 | 1.0 | 2.1 m | 9 | One-Handed |
| War axe | 8 | 0.92 | 2.0 m | 11 | One-Handed (bleed) |
| Mace | 9 | 0.82 | 2.0 m | 13 | One-Handed (armour pierce) |
| Greatsword | 15 | 0.72 | 2.6 m | 17 | Two-Handed |
| Battleaxe | 16 | 0.68 | 2.6 m | 20 | Two-Handed |
| Warhammer | 18 | 0.6 | 2.5 m | 24 | Two-Handed |
| Bow | 6 | — | — | 9 | Archery |
| Staff | — | — | — | 8 | casts its enchantment |

Material ladder: Iron (L1) → Steel (L4) → Hillforged (L8) → Deepforged (L12) → Glimmer (L16) → Crystal (L22) → Nightsteel (L28) → Dreadforged (L36) → Wyrmbone (L40). Level-scaled loot only drops a material once you reach its level, with a 10% chance of one tier early.

### 6.3 Enchanted items

Loot can roll an enchantment (8% + 0.5% per level). Weapons get *of Cinders / Rime / Static / Thirst / Unease…*, armour gets *of Health / Mana / Stamina / Carrying / Fire Resistance / …* and skill bonuses. Names are generated (*Steel Sword of the Forge*). Enchanted weapons hold charges; refill them with an essence.

### 6.4 Honing

At a whetstone (weapons) or armourer's bench (armour), spend one material per grade: `Fine (+1) → Superior (+2) → Exquisite (+3) → Flawless (+4) → Epic (+5) → Legendary (+6)`. The highest grade depends on Smithing skill (+1 grade per 20 skill, +1 with the material's perk).

---

## 7. Crafting

* **Smelter:** ore → ingot (2 iron ore → 1 iron ingot; iron ingot + iron ore → steel; 2 copper ore → bronze; etc.).
* **Tanning frame:** pelt → leather; leather → 2 leather strips.
* **Forge:** recipes `item ← ingots + leather strips (+ special)`; materials past Steel need their perk.
* **Whetstone / armourer's bench:** honing (above).
* **Alchemy still — essence and note.** Each ingredient has a primary **essence** (the effect it gives when it leads a brew) and a secondary **note** (the effect it lends when it supports one). A brew takes one *lead* ingredient plus up to two *supports*. The lead's essence is the potion's main effect. A support whose note matches strengthens it (+40% each), and a support whose note differs adds that note as a weaker second effect at 50%. Nothing is learned by tasting: **studying** an ingredient at the still (consuming one) reveals its essence, and brewing with it as a support reveals its note. Magnitude `= base × 3 × (1 + skill/100 × 1.5) × perkMult`. A brew whose effects are all harmful is a poison, which you apply to a weapon.
* **Rune table (Runecraft):** enchantments are learned as **runes**, by studying rune-books (bought from the Academy or found in ruins) or by copying the rune off a **sigil stone's** plinth after reading it. Inscribe a known rune onto an unenchanted weapon or armour piece, burning an **essence**. Magnitude `= base × essenceFactor × (1 + skill/100) × perkMult` (faint 0.3, minor 0.5, fair 0.7, major 0.85, great 1.0).
* **Essences.** Any creature you kill has a chance (25% + Summoning/250, +10% if you struck the killing blow) to leave a stoppered vial of essence in its remains. The tier follows the creature's strength: wolves give faint, bears minor, trolls fair, giants and mammoths major, and dragons always give great. People leave none.
* **Cooking pot:** raw food → stews and steaks.

Every crafting action gives skill XP in proportion to the item's value.

---

## 8. Magic catalogue (36 spells)

| School | First circle | Second circle | Third circle | Fourth circle |
|---|---|---|---|---|
| **Evocation** | Flames, Rime Touch, Sparks | Firebolt, Ice Spike, Lightning Bolt, Fire Rune | Fireball, Ice Storm, Chain Lightning | Immolate, Glacial Lance, Stormspear |
| **Mending** | Mending, Ward | Quick Mending, Mend Other, Turn Undead | Knit Flesh, Bulwark Ward | Dawnflare |
| **Shaping** | Barkskin, Wisplight | Stoneskin | Ironskin | Paralyze |
| **Summoning** | Call Spirit Wolf, Spectral Blade | Call Ember Golem | Call Rime Golem | — |
| **Glamour** | Courage, Calm | Rage, Hush | Fear, Invisibility | — |

Spell tomes are sold by town sages (Ivo, the Frostspire Academy) and found in dungeons. You start with Flames and Mending.

---

## 9. Creatures and NPCs

### 9.1 Bestiary (36)

| Rig | Creatures |
|---|---|
| **Humanoid** | bandits (marauder, archer, hedge mage, chief), Saltreavers, Hearthguard, guards, necromancers, barrow wights (husk, wight, archer, warden, scourge, dreadlord, captain), skeletons, Gloomkin (blind, hunched cave folk), the hierophant Zahrakhul (floating, iron-crowned), giants (×3 scale), trolls and frost trolls (long arms, hunched), brass sentinel, steam colossus, ember and rime golems, every townsperson |
| **Quadruped** | wolf, ice wolf, alpha wolf, bear, cave bear, snow bear, fangcat, snow fangcat, giant rat, fox, elk, deer, goat, cow, mammoth, horse, walrus, spirit wolf (summon), dog |
| **Many-legged** | rime spider, giant rime spider, clockwork spider, mudclaw |
| **Dragon** | dragon, Crimson Wyrm, Rime Wyrm, Ancient Wyrm, Vyrthax (black, red eyes, larger), Thurnvaal (old, grey, chained), Raskhar (red) |
| **Ambient** | birds (crows, hawks), butterflies, dragonflies, fish shadows |

Creature level scales with the player within each creature's range (wolf 1–6, ice wolf 8–14…); encounter zones pick from their lists by level.

### 9.2 AI

States: **idle / sandbox** (schedule activity), **wander**, **patrol** (waypoints), **sleep** (wights in burial niches wake when they detect you), **alert / search**, **combat**, **flee**, **follow** (followers) and **dead**. Combat behaviour depends on archetype:

* *melee:* approach, circle at reach, attack when stamina allows, block when you wind up, and sometimes swing heavy.
* *archer:* keep 10–25 m away, strafe, draw and fire, and switch to melee if you get close.
* *mage:* keep distance, cast bolts, heal itself and summon.
* *beast:* pounce, bite, and retreat when hurt.
* *giant:* a slow overhead smash that launches you.
* *dragon:* below.

**Dragon AI.** `circle` (orbit 40–70 m over the target, roar) → `strafe` (fly a line over the target breathing fire or frost) → `hover` (breathe while hovering) → `land` (when earthbound, wounded below 50%, or at random) → `ground` (bite in front, tail sweep behind, wing buffet, breath cone, slow turns) → `takeoff`. When it dies it falls and burns away to a cage of bones, and its **ember** streams into you if you are Stormsworn. Loot: dragon bones and scales.

**Schedules.** Townsfolk follow variants of `{ 0–6 sleep (home), 6–8 eat (home), 8–18 work (station), 18–22 relax (inn/plaza), 22–24 home }`. Out of your sight, NPCs teleport along their schedule.

### 9.3 Dialogue

Dialogue trees have conditions (quest stage, faction rank, skill, gold, item, persuasion through Speech) and actions (start a quest, set a stage, give or take items or gold, open barter, train a skill, follow). Every named NPC has greetings and topics. Generic NPCs and guards share a bank of a few dozen original barks. Speech checks: *Persuade* succeeds if `speech ≥ difficulty` (or with gold, for *Bribe*); *Intimidate* uses level.

---

## 10. Dungeons and interiors

Interiors are separate **cells** entered through load doors (fade out, then a different scene).

**Generator.** A seeded grid of 4 m cells holds rooms (rectangles of varying size and height), corridors with turns, stairs that change floor height, dead ends with treasure, and a loop back toward the entrance near the end so you don't have to retrace the whole dungeon. Themes:

| Theme | Look | Inhabitants | Features |
|---|---|---|---|
| **Barrow** | grey carved stone, knotwork, burial niches, sarcophagi, urns, iron gates, cobwebs, blue candles | wights, giant rats, rime spiders | star-dial doors, pressure-plate traps, swinging blades, a sigil-stone chamber, boss sarcophagus |
| **Cave** | rough rock, stalactites, moss, waterfalls, glowing mushrooms | wolves, bears, trolls, spiders | narrow passages, underground pools |
| **Mine** | timber shoring, rails, lanterns, ore veins | bandits | mineable ore veins |
| **Fort** | ruined stone courtyards, towers | bandits, Saltreavers | archers on the walls |
| **Deepforge (machine-city)** | brass, pipes, steam vents, gears, green lamps, huge halls | clockwork spiders, brass sentinels, Gloomkin, the Steam Colossus | levers, steam traps, the orrery |
| **Temple (Vahlokar)** | black stone, wyrm statues, ember braziers | wights, the hierophant | the stair to the Eye |
| **Buildings** | timber halls with long hearths, tables, beds, shelves, counters, banners | townspeople | shops, inns, the Warden's high seat |

Every dungeon has an entrance load door, at least one **boss** with a **boss chest**, containers (urns, chests, satchels), loose loot, and a map marker that turns to *Cleared* when the boss dies. Barrows and temples have a **sigil stone**.

**Traps:** pressure plates (darts from the walls), swinging-blade corridors, spike floors, tripwire rockfalls, oil slicks with lanterns.

**Puzzles:**

* **Star-dials:** three bronze rings carry star patterns; set them to the constellation shown on a rubbing, a mural or the night sky above the entrance.
* **Mirror-and-beam rooms:** turn bronze mirrors to carry a shaft of daylight to a sun-lock.
* **Lever sequences.**
* **Grimhallow's timed gates:** beat them with the Sigil of the Stride.

---

## 11. User interface

* **HUD:** a compass ribbon at the top (N/E/S/W, quest markers, discovered and nearby location icons, red dots for enemies in combat) with the **Storm Charge** gauge as a ring at its centre. Mana (left), Health (centre) and Stamina (right) bars fade out when full. A small crosshair (or the sneak eye). The interaction prompt ("E) Take Iron Sword", "E) Talk to Ragna", "E) Enter Coldmarrow Barrow", red "Take (owned)"). Notifications at top-left ("One-Handed rises to 23", "Quest begun", "Discovered: Howlstone Cave"). A boss/enemy health bar and subtitles.
* **Quick menu (Tab):** a ring with Skills, Magic, Items and Map, plus Journal (J), Wait (T) and System (Esc).
* **Inventory:** categories (Favourites, Weapons, Apparel, Potions, Scrolls, Food, Ingredients, Books, Keys, Misc), a sortable list, an item card with stats and a **rotating 3D model**, compare arrows, equip (left/right hand), drop, favourite, weight and gold.
* **Magic:** schools, a spell list with costs, equip to a hand, and a **Sigils** tab showing each sigil's three rings and the charge they cost.
* **Skills:** three carved **rune-pillars** (Warrior, Thief, Mage), each with six skill faces. Pick a face to see its perk ladder as runes climbing the stone, plus perk points and level progress. On level-up a card shows how your pools grew.
* **Map:** the whole province drawn as a parchment hillshade with roads, rivers, towns and markers. Pan and zoom by drag, pinch or wheel; set a custom marker; fast-travel by clicking a discovered marker.
* **Journal:** active and completed quests, objectives and quest text; a system tab (save, load, settings, help, quit).
* **Dialogue:** the speaker's name, lines with typed text and a topic list; the camera frames the speaker.
* **Containers, barter, crafting stations, book reader (parchment pages), wait/sleep dialog, death screen, loading screens with lore tips and a slowly rotating 3D model.**
* **Lockpicking (pin tumblers):** a lock has 3–6 pins; each springs up and down at its own rhythm. Tap to set a pin when it is at the shear line; a miss drops the last set pin and may snap a pick. Harder locks have more, faster pins, and perks slow them down.
* **Touch layout:** the left half is a floating move stick (push to the edge to sprint) and the right half is drag-to-look. Right cluster: **Attack** (right hand; hold for a heavy swing), **Block / left hand**, **Jump**, **Use**, **Sigil**. Left cluster: **Sneak**, **Camera**. Top-right: **Menu** and **Journal**. Buttons appear and hide by context (Use appears when there's something to use). Aim assist pulls the crosshair toward the nearest target in a narrow cone.

---

## 12. Audio

All synthesised with the Web Audio API.

* **Music:** a generative score in D Dorian and A Aeolian.
  * *Exploration:* slow string-like pads (detuned saws through low-pass), a horn melody (filtered saw with vibrato) and harp (Karplus-Strong) arpeggios.
  * *Town:* lute plucks and a hand drum.
  * *Dungeon:* low drones and a distant choir.
  * *Combat:* taiko-style toms, an ostinato on low strings, brass stabs and choir "ah" chords (formant-filtered).
  * *Title:* the main theme, a low choir chant over war drums (an original melody).
  * Music cross-fades by context.
* **Ambience:** wind (filtered noise, stronger with altitude and storms), birdsong by day in forests, crickets and owls at night, waves on the coast, river babble, town murmur, crackling fires, dungeon drips and rumbles, Deepforge steam and machinery.
* **SFX:**
  * Movement: footsteps by surface (snow, grass, stone, wood, water) and armour weight.
  * Combat: weapon whooshes, metal-on-metal blocks, flesh and armour impacts, bow creak and twang, arrow thunks.
  * Magic: fire roar, frost crackle, shock zaps, healing shimmer, summon portal; **sigils** as a rising crackle while tracing (one chime per ring) and a thunderclap on release.
  * Dragons: roars, wing beats, the ember-absorb crescendo.
  * World and UI: door creaks, chest lids, coins, potion gulps, page turns, lockpick clicks, level-up and discovery stings, quest chords.
* **Mix:** master, music, effects, voice and ambience sliders; convolution reverb (a generated impulse), larger in dungeons; audio suspends in a background tab (`lib/page-audio.js`).

---

## 13. Rendering

### 13.1 Pipeline

```
RenderPass(world)  →  RenderPass(viewmodel, clearDepth)  →  Sanitize (kill NaN/Inf)
→ UnrealBloom (half res)  →  Grade pass (god rays from the sun, ACES filmic, colour
grading LUT-less curves, vignette, damage/frost/heal tints, sigil ripple, film grain,
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
| **Structures** | parametric northern architecture generated in code: longhouses (stone footing, log walls, steep shingle or thatch roofs, crossed carved gable beams), halls, towers, palisades, stone city walls with gates, docks on piles, a water-wheel sawmill (animated), bridges, ruins, totems, sigil stones, signposts; merged per settlement into a few draw calls using a shared material atlas |
| **Characters** | rigid-skinned `SkinnedMesh` per actor: body, head (eyes, brows, hair, beard), clothing and armour pieces are separate parametric meshes merged into one geometry with bone indices, so each actor is one draw call (+ one for shadows); a shared PBR atlas (skin, cloth, leather, fur, iron, steel, gold, wood, bone, glass…) with normal and roughness/metal tiles; procedural animation (walk, run, sprint, sneak, idle breathing, attacks per weapon type, block, bow draw, casting, stagger, death fall, sit, sleep, work) |
| **First person** | a viewmodel scene rendered on top with its own depth: arms in the player's armour, the equipped weapons/shield/bow/spell hands, sway and bob, attack animations matched to the simulation's attack phases |
| **FX** | GPU particle pools (one `Points` draw per pool, soft circular sprites): fire, embers, smoke, frost mist, sparks, blood, dust, snow, rain, magic glows, dragon-ember streams; lightning as jagged additive ribbons; fireball explosions with light flashes; sigil shock rings and a screen-space ripple; arrows and decals |
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
│   ├── audio.js           music, ambience, sfx, voice, sigil thunder
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
│   │   ├── magic.js       spells, enchantments and the Storm Sigils
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
  inventory, equipment, spells, storm (rings, embers, charge), effects, fines, gold }, quests: { id: { stage, done, vars } },
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
| Sigil | Z (hold to trace more rings) | RB | Sigil |
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
  * **combat** — damage, armour cap, sneak multipliers, blocking, spells, sigils; a melee bot vs every creature at its level range;
  * **dungeons** — 300 seeds × every theme: connected, boss reachable, sigil stone reachable, no spawn in walls;
  * **quests** — a bot drives the main quest from the prologue to the credits through the real world API (walking, talking, fighting with debug strength, solving puzzles), plus every side quest's stages are reachable;
  * **save** — save → load round-trips the world.
* `dev/browsertest.mjs` (Playwright, real Chromium + SwiftShader WebGL): title → character creation → prologue (dragon, escape) → movement, looting, equipping, combat, a spell, the HUD and compass → every menu (items, magic, skills, map, journal, wait) → a dungeon interior and back → barter → save/reload/continue; then touch-only phones at 390×844 and 844×390: layout fits, canvas matches the viewport, buttons are finger-sized, sticks move and look, Attack swings, menus open and close. Fails on any console or page error.

---

## 17. Phases

### Phase 1 — Engine
- [x] Design document
- [x] Renderer, post chain, quality tiers, resize via `visualViewport`
- [x] Deterministic terrain, quadtree LOD with skirts, splat shader, baked AO
- [x] Sky (scattering, sun, moons, stars, aurora, clouds), lighting, height fog, weather
- [x] Water (sea, lakes, river)
- [x] Player controller, first/third person camera, keyboard/mouse/gamepad/touch input

### Phase 2 — World
- [x] Geography: regions, 34 locations, roads, signposts
- [x] Vegetation (trees, rocks, bushes) with LODs and wind; GPU grass
- [x] Settlements and northern architecture; Wyrmguard Hall; docks; sawmill
- [x] Day/night, weather per region, ambient wildlife

### Phase 3 — Actors and combat
- [x] Rigid-skinned humanoid, quadruped, arachnid and dragon rigs with procedural animation
- [x] AI states, schedules, followers, dragons
- [x] Melee, blocking, archery, magic, storm sigils, sneak, stagger, death, loot

### Phase 4 — RPG systems
- [x] Items, levelled loot, inventory, equipment
- [x] Skills, XP, levels, perks, attributes
- [x] Smithing, tempering, smelting, tanning, alchemy, enchanting, cooking
- [x] Merchants and barter, lockpicking, pickpocketing, crime and bounty

### Phase 5 — Dungeons and interiors
- [x] Generator (barrow, cave, mine, fort, deepforge, temple, buildings)
- [x] Traps, puzzles, sigil stones, boss chests

### Phase 6 — Story
- [x] Quest engine, journal, markers
- [x] Main quest 1–11 including the Eye of the Storm
- [x] Side quests and radiant bounties, dragon attacks

### Phase 7 — Presentation
- [x] HUD and every menu, touch layout
- [x] Music, ambience, SFX, sigil thunder
- [x] Save/load, settings, title, character creation, loading screens

### Phase 8 — Ship
- [x] simtest, browsertest
- [x] Launcher entry, README, CHANGELOG, status, docs learnings

---

## 18. Event catalogue (sim → view/audio/UI)

| Event | Payload | Consumers |
|---|---|---|
| `hit` | attacker, target, dmg, kind, pos, blocked, crit, sneak | view (blood/sparks), audio, HUD (enemy bar) |
| `swing` | actor, weapon, power | audio, viewmodel |
| `death` | actor | view (fall), audio, quests |
| `cast` / `spellHit` | actor, spell, hand / pos | fx, audio |
| `projectile` | id, kind | fx |
| `sigil` | actor, sigil, rings, dir | fx (ripple), audio (thunder) |
| `ember` | dragon pos | fx (streams), audio, HUD |
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

* **Riding** — horses stand in the stables but can't be ridden; mounted movement and combat need their own animation set. Fast travel and carriages cover long distances instead.
* **Werewolves, vampires, marriage, children, homestead building** — each is a system the size of a small game.
* **Voiced dialogue** — the browser's speech synthesis varies too much between devices; subtitles only.
* **Full physics ragdolls** — knockdowns and deaths use a scripted fall.

---

## Changelog

### v1.0.0 — 2026-10-08
- First release: everything listed in *Phases*.
