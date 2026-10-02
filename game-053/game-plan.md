# Legend of the Jade Wyrm

**Genre:** Browser-game RPG in the *Legend of the Green Dragon* / *LORD* tradition: turn-limited days, text adventure pages, a village hub, a forest, a dragon at level 15, and a "server" full of other players
**Engine:** three.js r165 (import map, CDN) for the living backdrop and the carved wooden frame; everything else is vanilla HTML, CSS and JS modules
**Target:** any screen, phone to ultrawide; keyboard hotkeys on desktop, big tap targets on phones
**Status:** Playable — v1.0.0

---

## Concept

*Legend of the Green Dragon* (2002–) was a PHP/MySQL web game: you logged in once or twice a day, spent your forest fights, chatted in the village square, slept at the inn so nobody could kill you overnight, and after weeks of play slew the Green Dragon, reset to level 1 and started again a little stronger. What made it work wasn't the combat, which was a few lines of arithmetic. It was the **ritual and the crowd**: the daily turn budget, the rows of hotkeyed links, the commentary box full of strangers, the Daily News reporting who died to what, the Hall of Fame, and the knowledge that someone might come for you if you slept in the fields.

*Legend of the Jade Wyrm* recreates that experience entirely in the browser. There's no server. The "server" is simulated: 60 other players with their own personalities, schedules, levels and grudges live inside your save, log on and off on a real clock, chat in the square, fight in the forest, kill and get killed, slay the Wyrm, marry, form clans and write you mail. Everything they do is visible through the same channels a real player's actions would be: commentary, news, rankings, PvP, mail.

The presentation keeps the text-first design (every interaction is a page of prose with a column of hotkeyed choices), but frames it in a three.js scene: a carved oak header beam with crossed steel swords and a painted shield, a timber-framed "scene window" over a low-poly diorama of the village that the camera flies around as you move (smithy, inn, bank, forest, graveyard, the Wyrm's mountain), torches that light the wood, a day/night sky driven by the in-game clock, and 3D foes in the forest clearing that lunge, flinch and fall as the fight log scrolls below.

---

## Pillars

1. **Authentic loop.** Ten forest fights a day, one master challenge, three PvP attacks, healers that cost more each level, death that takes your gold, level 15 then the Wyrm, Wyrm kills that reset you with permanent bonuses and a new title.
2. **A crowd that feels real.** People log in and out, greet you by name, ask newbie questions, give tips, brag, react to *your* news, attack you if you sleep in the fields, and answer your mail. Tuned so the square is lively but not noisy.
3. **Text you want to read.** LoGD-style backtick colour codes (`` `@ `` green, `` `$ `` red, `` `^ `` yellow…) in narration *and* chat, original prose for every location, ~100 creatures each with a weapon and a death line, 25 forest events.
4. **Modern sensibilities.** Auto-fight, animated combat with damage numbers, a stat panel that always shows what matters, toasts, deeds (achievements), a choice of day pacing, he/she/they, flirting with anyone, three save slots, file export/import, keyboard and touch parity, reduced motion, low-power mode.

---

## The world: Hollowmere

| LoGD original | Jade Wyrm | Notes |
|---|---|---|
| Degolburg village square | **Hollowmere Village Square** | Hub. Commentary channel `village`. |
| The Forest | **The Gloamwood** | Fight (normal / slumming −1 / thrill-seeking +1 level), events, healer, the Wyrm at level 15. |
| Healer's Hut (Golinda) | **Mother Nettle's Hut** | Cost `ln(level+1) × (missing HP + 10)`; full or partial heals. |
| Bluspring's Warrior Training | **The Proving Yard** | 14 masters, one challenge per day, ask the master how close you are. |
| MightyE's Weaponry | **Grimbold's Arms** | 15 weapons, names change with Wyrm kills (tiers), 75% trade-in. |
| Pegasus Armor | **The Gilded Gauntlet** (Pell) | 15 armours, same rules. |
| Ye Olde Bank | **Quill & Ledger Counting House** (Ezra Quill, a gnome) | Deposit, withdraw, borrow against future levels, transfer to players, daily interest. |
| Boar's Head Inn (Cedrik, Violet, Seth) | **The Crooked Antler** (Brannoc, Willa, Corwin) | Drinks + drunkenness, gossip, gem potions, flirt and marry Willa or Corwin (anyone can flirt with either), the bard's song, rent a room (safe sleep), Dagny's bounty table, commentary `inn`. |
| Merick's Stables | **Odric's Stables** | 7 mounts (gold + gems) with forest-turn and combat buffs; feed for a refill. |
| Ze Gypsy Tent | **Madame Zorya's Tent** | Speak with the dead (read the shades channel), fortunes (real hints), gem trade. |
| The Gardens | **The Moonlit Gardens** | Stroll once a day (charm), commentary `garden`. |
| Curious Looking Rock / Veteran's Club | **The Standing Stone** | Wyrm slayers only: a daily boon and commentary `stone`. |
| Ramius, Graveyard, Shades | **Vorgath the Ferryman, the Barrow Field, the Pale Shore** | When dead: torment restless souls (10 grave fights/day) for favour; 100 favour buys resurrection. Commentary `shades`. |
| Dag Durnick | **Dagny Grael** | Place bounties on players; collect by killing them in PvP. NPCs place bounties too (including on you). |
| Daily News | **The Hollowmere Herald** | Every day's deaths, kills, level-ups, marriages, Wyrm slayings. |
| Hall of Fame | **Hall of Heroes** | Rankings by Wyrm kills, level, gold, gems, charm, PvP wins. |
| List Warriors / Who's online | **The Roll of Warriors** | Everyone, with online status and where they sleep. |
| Ye Olde Mail | **The Rookery** | Raven mail with NPCs; replies arrive later; gifts; system notices. |
| Hunter's Lodge | **The Deedkeeper's Lodge** | Spend renown from **deeds** (achievements) on name colours, a custom title, permanent extra forest fights. |
| Clan Halls | **Guildhall Row** | Five NPC guilds with tags shown in chat; apply or found your own (10,000 gold + 5 gems); guild channel and a daily perk. |
| Fields (log out) | **The Fields** | Sleep outdoors (free, but you can be attacked overnight) — or rent a room. |
| Slay Other Players | **Hunt Other Warriors** | Targets from level −1 to +2 who are sleeping in the fields; 3 a day; win their gold and some XP. |

---

## Core rules

### Character
- **Name**, **pronouns** (he / she / they — titles use the matching word), **race**, **specialty**.
- Races: **Human** (+2 forest fights a day), **Elf** (+1 defence, +1 charm), **Dwarf** (+20% gold from fights), **Troll** (+1 attack, regenerate 1 HP per round), **Halfling** (forest events twice as often, +2 charm).
- Specialties, each with four skills unlocked at skill levels 1/3/6/10 and costing 1/2/3/5 uses:
  - **Shadow Arts** — Bone Servants (minions for 5 rounds), Hex of Rot (enemy attack ×0.6 and rot damage), Withering Curse (enemy defence ×0.4), Soulrend (heavy hit that heals).
  - **Arcane Lore** — Mending Light (regenerate), Stonefist (attack ×2), Lifedrain (strikes heal you), Storm Aegis (defence ×1.5 and reflect damage).
  - **Thievery** — Cutting Taunt (enemy attack and defence ×0.8), Venom Blade (attack ×1.6 and poison), Vanish (enemy attack ×0.3), Backstab (a huge single blow).
  - Uses per day = 1 + ⌊skill/2⌋. Skill +1 on every level-up, and from some forest events.

### Numbers (LoGD-faithful)
- Start: level 1, 10 HP, attack 1, defence 1, Fists (0) and Rags (0), 50 gold.
- Level up: +10 max HP, +1 attack, +1 defence, full heal, +1 specialty skill.
- XP to reach the next level, from level 1 to 15: 100, 400, 1002, 1912, 3140, 4707, 6641, 8985, 11795, 15143, 19121, 23840, 29437, 36071 (×(1 + 0.04 × Wyrm kills)).
- Creatures at level *L*: HP ≈ 11L − 1, attack ≈ 2L − 1, defence ≈ 1.5L, gold ≈ LoGD's table (36 … 784), XP from LoGD's table (14 … 207). ±10% per creature.
- Combat round: your blow = bell(0..attack) − bell(0..enemy defence); ≤ 0 is a miss. The same in reverse. 1 in 20 rounds the enemy fumbles and you land a **power move** (×2–3). Buffs multiply attack and defence, add regen, minions, damage shields, damage over time.
- Flawless fight (no damage taken): +1 forest fight. Thrill-seeking: +1 level, +25% XP. Slumming: −1 level, −25% XP.
- Death in the forest: lose all gold on hand and 10% of XP; you go to the Pale Shore until a new day or until you buy resurrection with favour.
- Master: one challenge per day, needs the XP threshold; losing costs nothing but the day's try (you're patched up).
- **The Jade Wyrm** (level 15 only): level 18, 300 HP, attack 45, defence 25, and it breathes fire every few rounds. Win: Wyrm kill +1, pick a permanent bonus (+5 max HP / +1 forest fight / +1 attack / +1 defence), reset to level 1 with basic gear and 50 gold, keep gems, charm, deeds and spouse. New title from a 25-step ladder (Farmhand → Page → Squire → … → Immortal).

### Days
A day is the turn budget. Two pacing modes (Preferences):
- **Adventurer** (default): sleep at the inn or in the fields whenever you like; the night passes, the server simulates a day, and you wake to a new day.
- **Classic**: a new day dawns every 6 real hours (4 a day, LoGD's default), whether you played or not. You can still sleep (log out); waking before dawn just shows you the night.

The **clock** advances with what you do (a forest fight is 40 minutes, shopping 5…), from 06:00 dawn. The sky follows it: dawn, noon, golden hour, dusk, night. In Classic mode the clock follows real time.

**New day:** forest fights reset (10 + race + mount + Wyrm bonuses + Lodge), PvP 3, specialty uses, master challenge, bard, garden, drinks; bank interest (2–5%, capped per level); a random "spirits" modifier (−1 … +2 fights); resurrection if dead; buffs expire; mount buff renews; spouse bonus; report of what happened overnight.

### PvP
Hunt targets are players within level −1…+2 sleeping in the fields (the inn protects them, and you). Win: their gold on hand and XP = 10% of theirs (capped by your level), news, any bounty on them. Lose: they take your gold, you lose 5% XP and die. Overnight, aggressive simulated players may attack you if you slept in the fields; you wake to a report.

---

## The simulated server

`js/engine/world.js`. Each character slot has its own world: a seed, 60 players, five guilds, chat channels, news, bounties, mail.

- **Players** have a handle (a mix of fantasy names and online handles like *xXGrimTuskXx*, *bob the brave*, *Kaz*), pronouns, race, level, Wyrm kills, gear tiers, gold, gems, charm, guild, spouse, a personality (newbie, veteran, roleplayer, braggart, bard, merchant, lurker), chattiness, aggression, skill, and an **online schedule** on the real clock (local hours, so evenings are busier).
- **Each simulated day** an active player fights a number of forest battles, gains XP, might die (news: "*Kaz was slain in the Gloamwood by a Barrow Wight*"), levels up after beating their master, attempts the Wyrm at 15, attacks someone in the fields, marries, joins or leaves a guild, places bounties.
- **Online**: who is online is recomputed every minute from the schedules (8–20 at a time). The Roll shows a green dot and their current location.
- **Commentary**: in any page with a channel, a chatty online player posts every 12–50 seconds. Lines come from templates by personality and context: greetings, newbie questions answered by veterans, real gameplay tips, roleplay emotes (`:polishes a blade`), brags, reactions to the latest news ("grats Kaz on the wyrm!!"), reactions to *you* (your level-ups, deaths, Wyrm kills, gear). Drunk players slur. When you post, someone usually answers within a few seconds — greetings get greetings, questions get answers, mentions of a name get that player.
- **Mail**: a welcome letter from the server admin; system notices; veterans who send a newbie a little gold; guild invitations; replies to your letters in each player's voice; petition answers.

---

## Presentation

### Layout
- **Desktop (≥ 1100 px):** 3D header beam across the top (title plaque left, shield and crossed swords centre, mail / save / sound / menu right). Three columns underneath: **navigation** (left), **scene window + page text** (centre), **vital info + commentary** (right).
- **Tablet (760–1100):** navigation drops under the page text; vital info and commentary become tabs on the right.
- **Phone (< 760):** short header; scene window (30 vh) with the location banner; page text; navigation as a two-column grid of big buttons; a bottom bar with HP / gold / gems / turns and buttons for the **Vitals**, **Chat** and **Mail** drawers.

### three.js scene (`js/scene/`)
Two layers rendered each frame by one renderer:
1. **World** (perspective camera): a low-poly diorama on a painted ground disc. Village square with a well, cottages with lit windows, the Crooked Antler with its sign and chimney smoke, Grimbold's forge glowing, the Counting House with columns, the Proving Yard's dummies, Odric's stables, Zorya's striped tent, the Moonlit Gardens and pond, the Standing Stone with runes, Guildhall Row's banners, the Herald's notice board, the Barrow Field with mist and wisps, the Gloamwood (thousands of instanced pines) with a clearing for fights, Mother Nettle's hut, the fields with hay and a campfire, and the Wyrm's mountain with glowing eyes in its cave. Each page names a **view**; the camera eases there in ~1.4 s, and `setViewOffset` centres it in the DOM scene window wherever that is on screen. Sky dome, sun, moon, stars and lights follow the game clock. Dead: everything goes cold blue and the camera moves to the Pale Shore.
2. **Frame** (perspective camera where 1 unit = 1 CSS pixel at z = 0, so 3D geometry lines up with DOM rectangles): the oak header beam with iron straps, two crossed steel swords (extruded blades, brass guards, leather grips) behind a heater shield painted with a jade wyrm, the timber frame around the scene window with iron corner brackets and rivets, two torches with shader flames, flickering point lights and rising embers. Rebuilt to fit on every resize.
3. **Foes**: in the clearing, a procedural 3D creature built from its kind (beast, humanoid, brute, slime, flyer, spirit, serpent, plant, dragon) and colour, with glowing eyes; it bobs, lunges when it hits you, flashes and recoils when hit, and sinks away when it dies. Damage numbers float over it in DOM.

### CSS
Dark stained-wood panels with a gold hairline, leather insets, parchment-coloured body text in Alegreya, headings in Cinzel, LoGD colour codes remapped for a dark background, engraved section labels, hotkey letters in iron badges, a gold XP bar and red HP bar, translucent glass-blur panels where the GPU can afford it, `prefers-reduced-motion` support.

### Audio (`js/audio.js`)
Web Audio, no files: a gentle generative lute-and-drone tune per area (village major, forest Dorian, inn livelier, shades minor and slow), forest ambience, fire crackle; SFX for clicks, sword hits, misses, power moves, coins, gems, level-up fanfare, death bell, new-day chime, chat blip, mail raven.

---

## Saving
- Three character slots in `localStorage` (`jadewyrm.slot.N`), each holding the player and their whole world. Autosave after every page and on hiding the tab.
- The title screen is a "realm login": slot cards with name, title, level, Wyrm kills, day and last played; *Enter*, *Export*, *Delete*; *Create new warrior*; *Import* a `.json` save.
- In game: *Save now*, *Export save*, *Load…* (back to the login), *Log out*.

---

## Controls
- Every navigation link has a hotkey (the highlighted letter); press it anywhere outside a text field. `Esc` closes drawers and menus. `Enter` sends chat.
- Combat: **F**ight, **R**un, **5** auto-fight five rounds, **A**uto to the end, **1–4** specialty skills.
- Touch: everything is a button ≥ 44 px; drawers slide up from the bottom bar.

---

## Module overview

| File | Purpose |
|---|---|
| `index.html` | Shell, import map, DOM regions |
| `style.css` | All styling, responsive layout |
| `js/main.js` | Boot, title/login screen, wiring |
| `js/rng.js` | Seeded RNG, bell curve, helpers |
| `js/colors.js` | Backtick colour codes → HTML |
| `js/audio.js` | Generative music and SFX |
| `js/data/*.js` | Creatures, items, mounts, races, specialties, titles, masters, events text, names and chat templates |
| `js/engine/state.js` | New player, derived stats, save slots, export/import |
| `js/engine/ui.js` | Page builder, navigation and hotkeys, vitals, commentary, drawers, toasts, modals |
| `js/engine/combat.js` | Fight engine, buffs, skills |
| `js/engine/world.js` | Simulated players, day simulation, online schedule, chat generation, news, mail |
| `js/engine/game.js` | The game object pages talk to: navigation, clock, day roll-over, deeds |
| `js/pages/*.js` | One module per area |
| `js/scene/*.js` | three.js: renderer and layers, textures, frame, world diorama, foes, effects |
| `dev/browsertest.mjs` | Playwright: creation, every page, fights, death, Wyrm, save/export/import, phones |
