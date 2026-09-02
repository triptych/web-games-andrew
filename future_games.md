# Future Games — Rounding Out the Collection

A thematic look at the 33 games in this collection (`game-001` through `game-033`) and ideas for what to build next to fill the gaps. Unlike [docs/generic/suggestions.md](docs/generic/suggestions.md), which tracks missing **mechanics/genres** (Solitaire, Wordle, idle clicker, etc.), this doc looks at the **themes, settings, and subject matter** already established across the collection and proposes new games that either round out an underused theme cluster or remix a proven mechanic into a fresh setting.

## Theme clusters already well-covered

Looking across all 33 games, several strong clusters have emerged:

- **Dungeon crawlers** (huge cluster): game-003 (NetHack roguelike), game-006 (raycasting FPS), game-008 (centipede hybrid), game-021 (blobber), game-025/026 (three.js Gauntlet-style + blobber), game-030 (RPG-Maker style), game-031 (DOS-shareware software renderer), game-032 (8-bit top-down)
- **Cozy / low-stakes sims**: game-010 (Tiny Town), game-013 (Petal & Purse), game-015 (Tamagoji), game-020 (The River), game-033 (Hearthbound)
- **Synthwave/neon retro arcade**: game-019 (Synthwave Breakout), game-023 (Synthwave Invaders), game-024 (Neon Vanguard)
- **Turn-based / party RPGs**: game-009 (Ember Crown), game-028 (Echoes of Aethermoor), game-030 (Coppergate Lane)
- **Procedural/roguelite RPG journeys**: game-020 (The River), game-029 (Wayfarer's Path)
- **Puzzle**: game-002, game-011, game-016, game-017, game-027 — nonograms, match-3, sokoban, block-placement
- **Three.js action/adventure**: game-014, game-018, game-024, game-025, game-026, game-029
- **Visual novel / branching narrative**: game-007 (text-only), game-028 (Phaser VN), game-033 (DOM/canvas VN)
- **Gacha / collection meta-games**: game-012 (Arcana Pull) is the only one

## Gaps and remix opportunities

### 1. Cozy sim: seasonal farm/orchard
A **farming sim** (Stardew-lite) is the obvious hole in the cozy cluster — game-010 (town), game-013 (flower shop), game-015 (pet), game-020 (river journey), and game-033 (apothecary) all touch adjacent cozy subjects, but nothing does crop-planting/seasons/harvest. Kaplay, top-down grid, day/night or season cycle, simple relationship/gifting mechanic to echo game-033's affinity system.

### 2. Dungeon crawler: isometric loot-focused hack-and-slash
The dungeon cluster has raycasting FPS, blobber, top-down, and software-rendered first-person — but no **isometric** view (Diablo-lite). Would pair well with game-022's loot/upgrade economy and game-029's gear-comparison panel pattern. Kaplay or three.js orthographic camera.

### 3. Synthwave: racer
The synthwave trio (019/023/024) covers breakout, invaders, and shmup — a **synthwave outrun-style racer** (endless neon highway, lane-dodging, checkpoint boosts) would complete the retrowave aesthetic set and could reuse game-014's endless-runner three-lane skeleton with a neon reskin plus the perspective-grid backdrop already built for game-019/023.

### 4. Turn-based RPG: monster-taming / collection battler
game-009, game-028, and game-030 are all "control a fixed party" turn-based RPGs. A **creature-collection battler** (catch/tame/train monsters, turn-based 1v1 or team battles) would be a fresh structural take reusing game-012's gacha/collection meta-loop and game-009's turn-based combat engine, aimed at a Pokémon-adjacent subject not yet touched.

### 5. Procedural roguelite: dungeon deckbuilder
game-012 (gacha auto-battler) and game-020/029 (procedural journeys) suggest an opening for a **roguelike deckbuilder** (Slay the Spire-lite): climb a procedurally generated node map, build a combat deck, turn-based card battles against escalating enemies. Bridges the card-game gap noted in `docs/generic/suggestions.md` (#10 Blackjack/Card Battler) with the roguelite journey structure already proven in game-020/029.

### 6. Visual novel: sci-fi/space setting
Both VN-style games (game-028, game-033) are fantasy. A **sci-fi visual novel** (space station, crew management, branching dialogue with an AI or alien cast) would extend the branching-narrative + light-combat template from game-033 into an unexplored setting, and could reuse game-024/029's three.js/sci-fi visual language for cutscenes or an overworld map.

### 7. City builder: full simulation depth
game-010 (Tiny Town) is an intentionally small sandbox. A **deeper city builder** — zoning, traffic/pathing, resource chains, disasters — would round out the sim cluster the way game-031/032 rounded out dungeon crawlers (i.e., a bigger, more systemic take on an already-proven small idea).

### 8. Idle/incremental: dungeon or crafting theme
`docs/generic/suggestions.md` already flags idle clickers as a missing *mechanic*; themed through this collection's lens, an **idle dungeon** (auto-battling heroes delve while you're away, spend currency on upgrades between runs) would tie the idle-genre gap directly to the dungeon-crawler subject cluster instead of a generic clicker, giving it a stronger identity alongside game-022's tiered-upgrade shop pattern.

### 9. Three.js: cozy/exploration (non-combat)
Every three.js game so far (014/018/024/025/026/029) is action- or combat-focused. A **low-stakes three.js exploration/walking sim** (wander a small 3D valley, collect seasonal items, talk to a few NPCs — no combat) would extend the cozy cluster into 3D and prove three.js isn't just for shooters/crawlers in this repo.

### 10. Puzzle: physics-based
The puzzle cluster (002/011/016/017/027) is entirely grid-logic. A **physics puzzle** (Angry-Birds-style trajectory, or a marble/pipe-flow puzzle per `docs/generic/suggestions.md` #1) using Kaplay's built-in physics/body components (not yet exercised by any current game) would diversify the puzzle mechanic beyond grid logic.

## Suggested priority

If picking the next 2-3 games to build, the strongest picks for filling actual thematic holes (rather than just adding another entry to an already-full cluster) are:

1. **Farming/orchard cozy sim** (#1) — cozy cluster is popular but missing the genre's most iconic form
2. **Roguelike deckbuilder** (#5) — closes both a mechanic gap (cards) and a subject gap (deck-based combat) at once
3. **Sci-fi visual novel** (#6) — VN cluster is 2-for-2 fantasy; a setting swap is low-risk and high-differentiation

## Notes

- Check [docs/generic/suggestions.md](docs/generic/suggestions.md) before starting any of these — that doc tracks genre/mechanic ideas independent of theme and should stay in sync (mark items off in both docs when completed).
- Follow the standard scaffold: pick an engine per the patterns in [docs/kaplay/](docs/kaplay/), [docs/phaser/](docs/phaser/), or [docs/threejs/](docs/threejs/); write a `game-plan.md` in the new `game-0##/` folder; update [js/gamedata.js](js/gamedata.js) and [README.md](README.md) on completion.
