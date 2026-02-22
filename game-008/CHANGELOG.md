# Game 008 — Centipede Tower Defense: Changelog

## v1.0.3 — 2026-02-21

### Added
- **Burned tower slots** — when a tower is destroyed by enemy fire its slot is permanently ruined; no new tower can be placed there for the rest of the game
- **Flame & smoke effect** — destroyed slots show a persistent flickering flame (orange/yellow particles rising upward) with wispy grey smoke drifting above, plus a scorched-tile dark overlay underneath
- Burned slots show red in placement-mode hover (same as other invalid tiles)

---

## v1.0.2 — 2026-02-21

### Added
- **Head shockwave** — when a centipede head dies, a purple shockwave visual + sound fires and damages towers within 2 tiles (`HEAD_SHOCKWAVE_RADIUS`)
- **Per-tower-type shoot sounds** — Blaster, Sniper, Scatter, Freeze, Tesla, and Mortar each now play a distinct fire sound (previously all used the same generic shoot sound)
- **Mortar impact sound** (`playMortarImpact`) — separate explosion boom plays on shell landing
- **Rotating barrels** — Blaster, Sniper, Scatter, and Mortar barrel decorations now track and rotate toward their target tile when firing (centered on tile, uses `atan2` aim)
- **Length-based speed scaling** — centipedes gain +3% speed per lost segment (max cap raised from 2.5× to 3.0× base speed)

### Changed
- Barrel decorations for Blaster, Sniper, Scatter, Mortar are now centered on the tower tile (were offset to simulate a fixed aim direction)
- Sniper beam angle calculation unified to use same `atan2(dx, dy)` convention as barrel rotation
- Tower destruction cleanup now nulls `barrelEnt` / `barrelEnts` references

---

## v1.0.1 — 2026-02-21

### Changed
- Between-wave node march now animates as a left-to-right wave effect: columns drop one at a time (45 ms apart) instead of all at once, matching classic Centipede arcade behaviour.

---

## v1.0.0 — 2026-02-21 — Phase 6: Polish & Game Feel

### Added
- **Particle bursts** on every centipede segment kill (8 colored particles scatter outward)
- **Damage flash** — armored centipede segments flash white when hit without dying
- **Smart Bomb shockwave rings** — two expanding, fading rings emanate from the ship on detonation
- **Node hit/destroy sounds** — `playNodeHit()` on bullet chip, `playNodeDestroy()` on full destruction
- **Tower sell sound** (`playTowerSell`) — descending tones on sell
- **Tower upgrade sound** (`playTowerUpgrade`) — ascending chime with bright top note
- **Scorpion crawl sound** (`playScorpionMove`) — sparse buzzy tones during traversal
- **Node poison sound** (`playNodePoison`) — played each time a scorpion poisons a node
- **Boss wave alert** (`playBossAlert`) — deep dramatic sweep replaces normal wave-start fanfare
- **Game Won fanfare** (`playGameWon`) — rising arpeggio + held chord on clearing all 20 waves
- **Polished end screen** — Game Over and You Win overlays now show: score, wave progress, gold remaining, styled panel with color-coded border
- **Polished splash screen** — improved layout with decorative grid lines, how-to-play card, clearer controls reference, version tag

### Changed
- Splash screen version tag updated from "Phase 5" to "v1.0"
- Game added to root launcher (`js/gamedata.js`)

---

## v0.5.0 — Phase 5: Wave System & Special Enemies

- 20-wave progression with boss waves at waves 5, 10, 15, 20
- Flea, Spider, and Scorpion enemy types with full AI
- Armored and Fast centipede variants
- Giant Centipede boss (20 segments, 3 HP each)
- Between-wave shop with 15-second countdown
- Gold rewards: per-kill, per-wave, no-death bonus, boss bonus
- Wave title card animation on start
- Node march (nodes shift down one row between waves)
- 3-2-1 countdown before each wave

## v0.4.0 — Phase 4: Tower Placement & Auto-Fire

- All 6 tower types: Blaster, Sniper, Scatter, Freeze, Tesla, Mortar
- 3-tier upgrade system per tower
- Tower sell (50% refund)
- Tower range visualization on hover
- Right-HUD tower shop buttons + between-wave DOM overlay
- Upgrade/sell popup on placed tower click
- Placement cancel on ESC
- Tier badge on upgraded towers

## v0.3.0 — Phase 3: Player Ship & Shooting

- Player ship with WASD/Arrow movement in player zone
- Auto-fire bullets (0.25s interval)
- Smart Bomb (3 per wave, Space key)
- Player lives system (3 lives, Game Over on 0)
- Invincibility frames (2s) with flashing
- Centipede and spider collision

## v0.2.0 — Phase 2: Centipede Movement

- Centipede class with head + body segments
- Wall/node collision → descend + reverse
- Depth-based speed scaling
- Segment kill → split centipede + leave node
- Eye entities on head
- Spawn immunity (opacity pulse while growing in)

## v0.1.0 — Phase 1: Scaffolding & Grid

- Kaplay 1280×720 scene setup
- 24×18 grid with zone coloring
- Tower slot highlights with corner markers
- Node seeding (30 nodes in enemy zone) with HP dots
- HUD: lives, wave, gold, score, smart bomb count
- EventBus with cleanup
- Web Audio procedural sounds (stubs)
