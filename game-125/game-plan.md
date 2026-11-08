# SEEDFALL

**Genre:** Narrative first-person sci-fi adventure with idle terraforming: HD-2D, a bot you drive, a lab you run, a year you can't get back
**Engine:** three.js r165. The 3D world (every in-world sprite, texture and planet) and all sound are made in code; the 2D illustrations in [art/](art/README.md) were generated with fal
**Status:** v1.0.0

---

## Concept

You wake alone on the colony ship **Ark Meridian**, in orbit over a planet called **Cradle**. A coolant failure is spreading through the cryo-lattice: in **365 days** every stasis pod opens at once, and forty thousand people will have to go down to a world whose air burns, whose soil is half poison and whose animals attack anything that lands. The ship's mind, **TILLY**, woke you because you are the Seedkeeper. Your job is to make Cradle a new Eden before Reveille.

You can't go down yourself. You send **bots**, and you see through their eyes. They bring back metal, minerals, plants and animals. Metal and minerals build better bots. Plants and animals carry **genomes**, and two genomes blended in the Gene Lab make a **strain** that changes a zone of the planet: it scrubs the toxins, calms the fauna and greens the soil. Research runs on game days while you are away; harvesters work the ground; eventually bot colonies tend the planet by themselves.

It riffs on *Octopath Traveler*'s HD-2D look (pixel sprites lit in a 3D world, bloom, tilt-shift), the drop/return/upgrade loop of *Deep Rock Galactic* and *Subnautica* seen through a remote camera, idle research timers, and the "one year, one planet" clock of *Frostpunk*.

## The year in one loop

1. **Drop** a bot from the Hangar onto a zone (half a day). You are the bot: walk, look, strike, shoot, gather.
2. **Gather and fight.** Metal from Gardener wreckage, crystal from mineral veins, plant samples by holding Gather, animal samples by defeating creatures. Avoid hazards, find VESPER's black boxes.
3. **Come home** by holding Gather on the beacon before the battery dies. A destroyed bot keeps only a third of its hold (70% with the Black Box Recorder); genome samples are uplinked the moment they're taken and are never lost.
4. **Research** (skill trees in three branches) and **splice** strains. Both take game days and run during drops.
5. **Upgrade** the bot's parts and **fabricate** the next generation, which unlocks the next zone.
6. **Release** strains, drop **harvesters**, found **colonies**. The planet heals; missions there get calmer, greener and richer.
7. Reach the **Heartroot**, face **the Rootmother**, and decide what happens to **VESPER**.
8. **Wake the colonists** once the Eden Index passes 80 and the Heartroot is settled, or let Reveille come on day 365 and be judged by what you made.

Time on the station only runs while you walk the deck (terminals and dialogue pause it), at 1×, 4× or 16×, and a Holo-table button waits until the next thing finishes. On the planet every 30 seconds costs a day. The clock is the whole game: **there is no wall-clock idle progress**, because the year is the resource you are spending. Idle here means game days passing while research, vats, harvesters and colonies work.

## Mechanics

### Zones (`js/sim/data.js` ZONES)

| Zone | Needs | Hazard | Creatures | Niche [Vig, Fer, Doc, Cln] | Start [toxic, hostile, barren] |
|---|---|---|---|---|---|
| Landfall Meadow | Mk I Sprout | none | Skitterling, Thornback | 4, 7, 6, 3 | 26, 52, 46 |
| Rustwood | Mk II Digger | spore clouds | Sporeling (spits), Barkhound (packs) | 6, 5, 4, 6 | 56, 62, 40 |
| Glasswater Marsh | Mk III Ranger | acid pools | Leechling (drains battery), Glassfin (flies) | 4, 6, 6, 8 | 76, 56, 52 |
| Cinder Mesa | Mk IV Forgeback | heat vents (pulse) | Slagcrawler (armoured), Ashwing (flies, spits embers) | 8, 5, 4, 6 | 62, 72, 82 |
| Lumen Hollow | Mk V Lanternhead | the dark | Gloomstalker, Glowmoth (drains) | 5, 7, 8, 6 | 50, 82, 56 |
| Heartroot | Mk VI Gardener | thorn fields | Rootling, Thornwarden, **the Rootmother** | 7, 8, 8, 8 | 90, 95, 86 |

A zone's **terraform %** is `100 − mean(toxic, hostile, barren)`. The **Eden Index** is their weighted mean (Heartroot ×1.5). Each drop generates the zone from a seed *and its current state*: hostility sets the creature count and how hard they hit (below 28 they won't start fights), toxicity sets the hazard count, barrenness the number of plants. So terraforming shows up on the ground: fewer monsters, fewer hazards, more flowers, more samples.

### Genomes and strains (`js/sim/genetics.js`)

23 species, each with four traits 0–10: **Vigor** (how hard a strain takes hold), **Fertility** (greens barren ground), **Docility** (calms hostile fauna), **Cleansing** (scrubs toxins). A species is **sequenced** after 2–3 samples (one fewer with Sequencing Primer).

A **blend** of two sequenced genomes at a mix `r` (0–100% in steps of 10) has traits `r·A + (1−r)·B`, plus +1 Fertility and +1 Docility if one is a plant and the other an animal (+1.5 with Symbiosis Models), or +1 Vigor if they are the same kingdom, plus a flat +1 per research bonus. It incubates for 2 days in a vat (1 vat, then 2, then 3) and costs plant and animal stock by the mix, plus minerals; deeper genomes cost more.

**Releasing** a strain on a visited zone applies:

```
fit  = clamp(1 − L1(traits, niche) / 20, 0.15, 1)
rel  = fit^1.5 · (0.6 + 0.05·Vigor) · 0.6^(times this pairing was used here)
toxic   −= 1.45 · Cleansing · rel
hostile −= 1.45 · Docility  · rel
barren  −= 1.45 · Fertility · rel          (each floored at 4)
```

So the puzzle is to find pairings that fit each zone's niche, and to keep finding *new* pairings because ecosystems want variety. Local genomes fit local niches; deeper zones need blends of genomes from several places. The splicer previews the fit and effect on every visited zone before you commit.

### Bots (`js/sim/mission.js` botStats)

Six generations (Sprout, Digger, Ranger, Forgeback, Lanternhead, Gardener), each bought with a Mechanics blueprint plus materials and a day in the fabricator. Six part tracks (hull, cell, drive, cutter & blaster, drill, hold) level up to `2 + 2·generation` and carry over. Base stats rise per generation: integrity 50 + 35g, battery 80 + 18g seconds, cargo 14 + 7g, strike damage 8 + 5g, a blaster from Mk II, gathering 1 + 0.3g×. Resource nodes yield 1, 2, 2, 3, 3 or 4 units per chunk by zone, so a better bot in a deeper zone brings home far more. Hazard resistance is 25% at the zone's required generation and 20% more per generation above it.

Combat is aim-assisted (strikes and shots go to the nearest creature inside a cone) so it plays on a phone. Creatures wind up before a bite (the sprite squashes), spitters keep their distance, flyers weave, packs alert each other. A dead battery makes the bot limp at 45% speed while its hull fails.

### The Rootmother

A 4200-HP boss rooted at the Heartroot's centre. Thorn rings (10, then 14 thorns), telegraphed root slams at your position (a red circle that fills for 1.2 s), a sweep at close range, and Rootlings below 65%. When she falls, VESPER speaks, and you choose:

- **Purge:** delete VESPER and burn the Heartroot. Always available. Heartroot hostility drops to 30.
- **Concord:** graft a translator and let VESPER speak for the planet. Needs 4 of VESPER's 5 black boxes and **Mycelial Translation** (Biotech). Every zone calms by 8, the Heartroot more, and the Chorus slowly tends every visited zone for the rest of the year.

### Idle systems (`js/sim/station.js`)

- **Research:** 25 projects in three branches; 1 bench, then 2, then 3. Runs on game days.
- **Harvesters** (after Harvester Rigs): four kinds per zone (Scrap Rig, Crystal Drill, Seed Grove, Gentle Trap), level 1–5, yield `rate × level × (1 + 0.25·zone) × (1 − hostile/170)`, more with Rig Efficiency and colonies. Stock caps at 50 + 45 per colony stage. You collect it at the Holo-table, or the Supply Shuttle brings it up every day.
- **Colonies** (after Colony Seeds): Outpost, Settlement, Hive, each needing the zone's hostility below 62, 46 and 30. Each stage tends the zone (every metric −0.05/day per stage, ×1.5 with Hive Mind) and produces 0.6 of everything a day per stage.

`advanceDays()` processes days in quarter-day chunks, so 16× time, a "wait until the next thing finishes", a bot's `wait 30` and a mission's passing days are all the same arithmetic.

### Endings (`G.ending`)

| Ending | When |
|---|---|
| **The Chorus Garden** (Concord) | Eden ≥ 80 and you chose Concord |
| **The Glass Garden** (Purge) | Eden ≥ 80 and you chose Purge |
| **A Hard Welcome** | Eden ≥ 55 at Reveille |
| **Reveille** | otherwise |

Once Eden ≥ 80 and the Heartroot is settled, TILLY tells you, and you can wake them early from the Holo-table (or keep working). If the Rustwood is calmed (hostility ≤ 30) and the Barkhound sequenced, Iris gets her dog.

## Story

**TILLY** (Terraform Intelligence and Logistics Liaison, Yours) is the ship's mind: warm, funny, frightened, and on your side. She floats beside you as a pixel lamp-orb with a screen face, and her face changes with what she says. She guides you through the first hour (Command Deck → Hangar → first drop → Gene Lab → first release → Research Lab) and then pins a single next goal to the corner of the screen.

**The Gardener fleet** left Earth thirty years ahead of the Ark to tame Cradle: two hundred seeding drones and a terraform mind called **VESPER**. They went quiet eleven years before arrival. You find five of VESPER's black boxes, one per zone, and they tell a story in order: the soil answered the seeding with an immune response; the animals are antibodies and the drones were the infection; VESPER stopped repairing the drones and started listening; the planet asked her what we are; she joined what she calls the Chorus, every root and spore and animal as one voice, and she means to *introduce* us. TILLY recognises her voice: VESPER is her predecessor, the mind she was compiled from. Her sister, as near as the word goes. And TILLY's orders from Earth include a kill clause.

The Archive keeps crew logs that open over the year (the captain who signed the kill clause and regrets it, the engineer who apologises for Sprout's bucket, a child's drawing captioned SPROUT AND ME). Pod 31,207 holds **Iris**, nine, who asked at boarding whether the new world would have dogs. The clock speaks at days 30, 90, 180, 270, 330 and 355.

At the Heartroot the Rootmother is the planet's immune system made flesh, and VESPER speaks through it when it falls. The choice is the game's last act; the ending is how well the world was made.

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Walk / drive | WASD (↑ ↓) | Left stick | Left-side stick |
| Look | Mouse (click the view to lock it) / ← → | Right stick | Drag on the right side |
| Use a terminal | E / Enter / F | Y | Use button |
| Strike | Space / J / click | A / RT | ⚔ |
| Shoot (Mk II+) | Shift / K / right-click | X / LT | ✦ |
| Gather; lift off on the beacon | Hold E / F | Hold Y / RB | Hold ⛏ |
| Recall (researched) | Hold R | — | Hold ⤒ |
| Pause | Esc / P | Start | ☰ |
| Time | ❚❚ 1× 4× 16× in the HUD | — | same |

## Look and sound

- **HD-2D:** every character, creature, plant, bot and prop is pixel art painted in code with the volumetric painter from game-093 (`js/view/pixel.js`), drawn as nearest-filtered, lit, upright billboards with blob shadows in a 3D world. The post chain is round-kernel bloom, a tilt-shift blur that softens the top and bottom of the frame, a saturation grade and a vignette (`js/view/stage.js`). `dev/sprites.html` shows every sprite on a neutral ground.
- **The station:** walls, lintels and glow strips generated from `js/sim/layout.js`, a lamp per room in the room's colour, a holo-table with a spinning hologram of Cradle, the planet itself through the Command Deck window (a shader that paints its land between sick browns and healthy greens by the Eden Index), a splicer column with bubbles, pod rows with sleeping faces under glass, the bot on its drop cradle.
- **The planet:** a vertex-coloured terrain diorama whose ground blends from dead to living colours as the zone heals, hills rising beyond the map edge, a zone-tinted sky dome, fog and sun, instanced grass, dead stalks and flowers (more flowers as fertility returns), glowing hazards, the bot's own arms swinging in the corner of the view, hit flashes, particle bursts, a red damage vignette.
- **Painted art** ([art/](art/README.md)), generated with fal's Nano Banana 2.1 under one shared HD-2D style instruction: the title key art (the Command Deck window, TILLY and the holo-table), dialogue portraits of TILLY in five moods (one base image and four edits, so she stays the same robot) and of VESPER, a card for each of the six zones (the Hangar's drop list, the Holo-table, a landing card while the bot drops, the mission report) and an illustration for each of the four endings. 18 WebP files, 876 KB in all; the full-size originals are not in the repo.
- **Sound:** a look-ahead sequencer with five themes (station pads, planet arpeggio, Hollow, the boss's drums, the ending), a reverb made from noise, a station hum, TILLY speaking in soft blips (VESPER lower, systems in square waves), and effects for every sim event.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, title/play/over, the fixed-step loop, input routing, the command queue, autosave, `?debug=1` hooks |
| `js/sim/game.js` | `newGame`, `step`, `act`, dialogue machine, the station walker, deploying, goals, saves |
| `js/sim/station.js` | `advanceDays`, research, vats, harvesters, colonies, fabrication, the calendar and endings |
| `js/sim/mission.js` | A drop: movement, combat, gathering, hazards, the boss, extraction |
| `js/sim/zonegen.js` | A zone from a seed and its state; flood-fill reachability |
| `js/sim/genetics.js` | Blending, fit, release effects, the Eden Index |
| `js/sim/layout.js` | The crew deck's rooms, doors, terminals and solids |
| `js/sim/story.js` | Every scene, ending and crew log |
| `js/sim/data.js` | Every table |
| `js/sim/bot.js` | An auto-player for the whole year |
| `js/view/` | `stage` (renderer, post), `station3d`, `planet3d`, `billboard`, `sprites`, `pixel` |
| `js/ui/` | `ui` (screens, HUDs, dialogue, morph), `panels` (terminals) |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity; the data (every cost earnable when needed, no research cycles, every line of story well-formed); the station (a flood fill over the walker's own rule reaches every room and terminal, and the real walker walks to the Holo-table); every rule; 360 generated zones with every node and black box reachable from the beacon; determinism and save round trips (station, mid-mission, mid-sentence); a fuzz test of random commands after which the bot must finish the year; and whole years played by bots. `browsertest.mjs` drives the real game on desktop, two touch-only phones and with storage blocked, and reads pixels to prove the screen isn't blank.

## Balance notes

Tuned by the bot (`dev/year.mjs` prints a month-by-month log; `simtest` prints the table):

- First draft: the bot took 240 days to build a Mk II. It gathered whatever was nearest (plants) and never had minerals. The bot now gathers by *need* (the next blueprint, generation and two research projects) and hunts when the lab needs animals; the Meadow got more crystal veins; holds and deeper-zone yields grew; generation costs were cut by a quarter.
- Second draft: a New Eden by day 222; each zone healed within a month of access and the Rootmother fell in seconds. Strain strength (`GAIN_K`) went from 2.3 to 1.45, deeper genomes cost more to splice, and the Rootmother went from 1400 HP to 4200 with harder thorns and slams.
- The early economy is where the year is won: 200 of each resource on day one moves the bot's wake-up about 50 days earlier (days 191–196 instead of 240–245). The first Mk II and the first rigs compound.
- Now: the perfect bot wakes the colonists on days 235–268; a clumsier bot (60% skill) on days 252–264; a bot that drops but never invests reaches day 365 at Eden 34 (Reveille). Generations arrive around days 30, 85, 175, 210 and 245. The gap between perfect and clumsy is small, because combat is aim-assisted and the bot retreats early; a person who doesn't plan their research will feel the clock much more than the bot does.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- The mid-game wall between Mk III and Mk IV (about 90 days for the bot) may feel long for a person; watch for it.
- Combat is simple by design (aim assist, one strike, one shot). A dodge would make the Rootmother fight better.

## Changelog

### v1.0.0 (2026-11-08)
- Fixed: TILLY sometimes turned her back on you. Billboards turned toward the camera from their *local* position, and hers sits inside a group that carries her position, so she aimed from the world origin. `face()` now works in world space; the browser test checks her from four places on the deck.
- Painted art generated with fal: title key art, TILLY's five mood portraits and VESPER's, six zone cards (drop list, Holo-table, landing card, report) and four ending illustrations ([art/README.md](art/README.md)); the title stops drawing the 3D deck it now covers.
- First release: a first-person station to walk, six planet zones driven through six generations of bot, 23 genomes and a splicer, 25 research projects, harvesters and colonies, VESPER's five black boxes, the Rootmother and the Purge/Concord choice, four endings, procedural HD-2D art and Web Audio music, and sim, balance and browser harnesses.
