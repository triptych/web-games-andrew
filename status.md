# Game Status

Completion audit of all games in this repo, based on each game's own game-plan.md / CHANGELOG.md / PHASE-COMPLETE docs cross-checked against code. Ratings reflect feature completeness against each game's own stated scope, not code quality or bugs.

**Launcher note:** game-030 (Coppergate Lane) was built but missing from `js/gamedata.js` — this has been fixed, so it now appears on the home page.

| Game | Title | Rating | Notes |
|---|---|---|---|
| [game-001](game-001/index.html) | Space Shooter | Solid | Single-file HTML, no docs to verify beyond playable core loop |
| [game-002](game-002/index.html) | Match-3 Puzzle | Solid | Single-file HTML, playable core loop, no docs |
| [game-003](game-003/index.html) | NetHack Roguelike | Near-Complete | Phases 1–4 done; only Phase 5 polish (monster/item variety, hunger, sound) open |
| [game-004](game-004/index.html) | Tower Defense | Near-Complete | Core (5 towers, 5 enemies, economy) fully done; Phase 5 polish wishlist open |
| [game-005](game-005/index.html) | Bullet Heaven | Solid | Phases 1–6 done; advanced patterns/meta-progression (7–11) not built |
| [game-006](game-006/index.html) | Dungeon Crawler FPS | Solid | Phases 1–3 confirmed done via PHASE-COMPLETE docs; plan.md itself is stale/unchecked despite this |
| [game-007](game-007/index.html) | The Forgotten Temple | Playable-but-partial | Only text engine + inventory phases confirmed; no combat.js/puzzles.js; several phases unbuilt |
| [game-008](game-008/index.html) | Centipede Tower Defense | **Complete** | Explicitly "v1.0 shipped," all 6 phases done — most finished game in the repo |
| [game-009](game-009/index.html) | Chronicles of the Ember Crown | Solid | Phases 1–4 + bonus (journey map, NG+) done; polish/endgame phases unchecked |
| [game-010](game-010/index.html) | Tiny Town | **Complete** | All 4 phases checked off, no open TODOs |
| [game-011](game-011/index.html) | Nonogram Fleet | **Complete** | Self-declared complete, all phases done; shipped extra unplanned content (intro/briefing scenes) |
| [game-012](game-012/index.html) | Arcana Pull | Solid | Phases 1–5 done; Phase 6 polish (elites, final boss, art, balance) mostly stale — elites/boss already exist in code, only art/sound/balance genuinely outstanding |
| [game-013](game-013/index.html) | Petal & Purse | Near-Complete | All 3 phases essentially done; stale status header, minor open questions |
| [game-014](game-014/index.html) | Trackrunner | Solid | Code is ahead of its own (stale) plan doc; playable and enhanced beyond baseline |
| [game-015](game-015/index.html) | Tamagoji | Solid | Phase 1 (full core pet sim) done; Phases 2–3 stretch goals unbuilt |
| [game-016](game-016/index.html) | Crate Pusher | **Complete** | No docs, but fully realized 8-level Sokoban with undo/win flow |
| [game-017](game-017/index.html) | Pixel Picross | Near-Complete | Core (5 puzzles) done; only polish pass (timer, more packs) open |
| [game-018](game-018/index.html) | Village of the Wandering Blade | Near-Complete | All 3 phases done and confirmed in code, but own "Open Questions" (win condition, endless scaling, permadeath) still undecided |
| [game-019](game-019/index.html) | Synthwave Breakout | Solid | Phase 1 core loop complete; polish/boss phases (2–3) unbuilt |
| [game-020](game-020/index.html) | The River | **Complete** | "Phase 3 Complete," all features (companions, crafting, endings) verified in code |
| [game-021](game-021/index.html) | Dungeon Blobber | **Complete** | All 3 phases done, no TODOs found |
| [game-022](game-022/index.html) | Depths Unknown | Playable-but-partial | Core mining loop works, but **no win condition exists yet** — hostile enemies/ending/minimap (Phase 2–3) all unbuilt |
| [game-023](game-023/index.html) | Synthwave Invaders | **Complete** | "Phase 2 Complete," everything checked off |
| [game-024](game-024/index.html) | Neon Vanguard | Near-Complete | Explicitly "feature-complete," only a balance pass open; endless design is intentional |
| [game-025](game-025/index.html) | Crypt Crawler | **Complete** | Phases 1–5 done, no open TODOs |
| [game-026](game-026/index.html) | Crypt of the Forgotten | Near-Complete | Phase 6 complete/playable; a couple of design "open questions" never formally closed |
| [game-027](game-027/index.html) | Alchemist's Lattice | Near-Complete | All 10 phases done with substantial real code; only explicitly deferred Phase 11 power-ups (out of v1 scope) missing |
| [game-028](game-028/index.html) | Echoes of Aethermoor | Solid | Phases 1–4 done (full 4-chapter story); Phase 5 polish (art, portraits, mobile input) entirely unstarted |
| [game-029](game-029/index.html) | Wayfarer's Path | Solid (active dev) | Phases 1–3 done and playable; **currently mid-edit** — new fx.js (particles/screen-shake), monster archetypes, and a real town/shop pass just landed but are not yet verified live in a browser this session |
| [game-030](game-030/index.html) | Coppergate Lane | Playable-but-partial | Full playable story arc to a boss fight, but no save/load, single hero only, uniform enemy AI — was missing from the launcher, now added |

## Key takeaways

- **Most finished:** game-008, 010, 011, 016, 020, 021, 023, 025 — all self-declared complete and verified against code with no meaningful gaps.
- **Real functional gap (not just polish):** game-022 (Depths Unknown) has no win condition — the only game that's genuinely unfinished at a functional level, not just missing stretch polish.
- **Doc/code mismatches worth knowing about:** game-006, game-009, game-012, game-014, and game-019 have plan docs that *understate* real progress — the code is further along than the checklists suggest.
- **In-flight right now:** game-029 has uncommitted local changes (new `fx.js`, monster archetypes, town/shop rework) — active work, not a stalled game. Its own plan doc flags this batch as not yet visually verified in a browser.
