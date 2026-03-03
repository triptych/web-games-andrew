/**
 * battle.js — Auto-battler scene for Arcana Pull.
 *
 * Layout (1280 × 720):
 *   Top bar     y=0..50      — wave title + gems + lives
 *   Party lane  x=0..480     — 4 card slots with HP bars (left)
 *   Enemy lane  x=480..960   — enemy roster with HP bars (center)
 *   Log panel   x=960..1280  — last 6 action lines (right)
 *   Bottom bar  y=670..720   — hint / status
 *
 * Battle is fully automatic (tick-based). One "cycle" = BATTLE_TICK_S seconds.
 * Each card/enemy acts SPD times per cycle in round-robin order.
 *
 * Ability triggers implemented:
 *   Party abilities:   cups=heal, swords=slow, pentacles=shield, major=special
 *   Enemy abilities:   passive, onHit, onTick, onEngage, onDeath
 */

import { state }   from './state.js';
import { events }  from './events.js';
import { COLORS, BATTLE_TICK_MS, GEMS_PER_WIN, GEMS_PER_LOSS, MAX_ENEMY_WAVES, GEMS_PER_WAVE } from './config.js';
import { WAVE_BY_NUMBER } from './enemies.js';
import { saveCollection } from './gacha.js';
import {
    playAttack, playSpell, playHeal,
    playEnemyHit, playPartyHit, playWaveCleared, playFailure, playGameOver,
} from './sounds.js';
import { initNavBar } from './ui.js';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const W = 1280;
const H = 720;

const TOP_H    = 50;
const BOT_H    = 50;
const LOG_X    = 960;
const LOG_W    = W - LOG_X;
const PARTY_X  = 0;
const PARTY_W  = 480;
const ENEMY_X  = 480;
const ENEMY_W  = 480;

const BATTLE_TICK_S = BATTLE_TICK_MS / 1000;

const CARD_W   = 100;
const CARD_H   = 150;
const HP_BAR_W = 100;
const HP_BAR_H = 10;

// ----------------------------------------------------------------
// initBattle(k)  — called from the 'battle' scene
// ----------------------------------------------------------------

export function initBattle(k) {

    // ----------------------------------------------------------------
    // Build combat snapshots from state
    // ----------------------------------------------------------------

    initNavBar(k, 'battle');
    k.add([k.pos(0, 0), k.rect(W, H), k.color(...COLORS.bg), k.z(0)]);

    const waveDef = WAVE_BY_NUMBER[state.wave];
    if (!waveDef) {
        _showError(k, `No wave definition found for wave ${state.wave}`);
        k.onSceneLeave(() => events.clearAll());
        return;
    }

    // If party is empty, bail out gracefully
    if (state.party.length === 0) {
        _showError(k, 'Your party is empty!\nAdd cards in the Collection screen first.');
        k.onKeyPress('escape', () => { events.clearAll(); k.go('game'); });
        k.onSceneLeave(() => events.clearAll());
        return;
    }

    // Deep-copy party cards into mutable combatants
    const partyCombatants = state.party.map(card => _makePartyCombatant(card));

    // Deep-copy enemies
    const enemyCombatants = waveDef.enemies.map(e => _makeEnemyCombatant(e, state.wave));

    // ----------------------------------------------------------------
    // Battle state
    // ----------------------------------------------------------------

    let battleOver     = false;
    let battleStarted  = false;
    let tickTimer      = 0;
    let tickCount      = 0;
    let phase          = 'fighting';  // 'fighting' | 'won' | 'lost' | 'result'
    let resultTimer    = 0;

    // Action log (last 6 lines)
    const logLines = [];
    function addLog(msg, color) {
        logLines.push({ msg, color: color || COLORS.text });
        if (logLines.length > 6) logLines.shift();
        _rebuildLog();
    }

    // ----------------------------------------------------------------
    // Background layers
    // ----------------------------------------------------------------

    // Party lane background
    k.add([k.pos(PARTY_X, TOP_H), k.rect(PARTY_W, H - TOP_H - BOT_H), k.color(10, 6, 22), k.z(1)]);
    k.add([k.pos(PARTY_X + 14, TOP_H + 8), k.text('PARTY', { size: 13 }), k.color(...COLORS.accent), k.anchor('topleft'), k.z(2)]);

    // Enemy lane background
    k.add([k.pos(ENEMY_X, TOP_H), k.rect(ENEMY_W, H - TOP_H - BOT_H), k.color(12, 5, 18), k.z(1)]);
    k.add([k.pos(ENEMY_X + ENEMY_W / 2, TOP_H + 8), k.text(`Wave ${state.wave}  —  ${waveDef.name}`, { size: 13 }), k.color(...COLORS.danger), k.anchor('top'), k.z(2)]);

    // Dividers
    k.add([k.pos(PARTY_W, TOP_H), k.rect(2, H - TOP_H - BOT_H), k.color(30, 20, 60), k.z(2)]);
    k.add([k.pos(LOG_X, TOP_H), k.rect(2, H - TOP_H - BOT_H), k.color(30, 20, 60), k.z(2)]);

    // Log panel background
    k.add([k.pos(LOG_X, TOP_H), k.rect(LOG_W, H - TOP_H - BOT_H), k.color(8, 5, 18), k.z(1)]);
    k.add([k.pos(LOG_X + 12, TOP_H + 8), k.text('BATTLE LOG', { size: 12 }), k.color(...COLORS.silver), k.anchor('topleft'), k.z(2)]);

    // Top bar
    k.add([k.pos(0, 0), k.rect(W, TOP_H), k.color(...COLORS.bgPanel), k.z(3)]);
    const waveLabel  = k.add([k.pos(14, 13), k.text(`Wave ${state.wave}  —  ${waveDef.theme}`, { size: 16 }), k.color(...COLORS.gold), k.anchor('topleft'), k.z(4)]);
    const gemsLabel  = k.add([k.pos(W / 2, 13), k.text(`Gems  ${state.gems}`, { size: 14 }), k.color(...COLORS.gold), k.anchor('top'), k.z(4)]);
    const livesLabel = k.add([k.pos(W - 14, 13), k.text(`Lives  ${state.lives}`, { size: 14 }), k.color(...COLORS.danger), k.anchor('topright'), k.z(4)]);

    const offGems  = events.on('gemsChanged',  v => { gemsLabel.text  = `Gems  ${v}`; });
    const offLives = events.on('livesChanged', v => { livesLabel.text = `Lives  ${v}`; });
    k.onSceneLeave(() => { offGems(); offLives(); });

    // Bottom hint (above the nav bar)
    const bottomHint = k.add([k.pos(W / 2, H - BOT_H - 2), k.text('(ESC) Hub', { size: 12 }), k.color(80, 60, 130), k.anchor('bot'), k.z(4)]);

    // ----------------------------------------------------------------
    // Combatant card renderers
    // ----------------------------------------------------------------

    const partyRenderEntities = [];   // array of { root-ents } per slot
    const enemyRenderEntities = [];

    // ----------------------------------------------------------------
    // Card animations — wiggle (attacker) and flash (target)
    // ----------------------------------------------------------------

    // Damped sine wiggle on attacker card. Duration ~0.28s.
    function _wiggleCard(entity) {
        if (!entity || !entity.exists()) return;
        const originX = entity.pos.x;
        const originY = entity.pos.y;
        let timer = 0;
        const DUR = 0.28;
        const AMP = 9;
        let done = false;
        const handle = entity.onUpdate(() => {
            if (done) return;
            timer += k.dt();
            const t = Math.min(timer / DUR, 1);
            const decay = 1 - t;
            const offset = Math.sin(timer * 75) * AMP * decay;
            entity.pos = k.vec2(originX + offset, originY);
            if (t >= 1) {
                entity.pos = k.vec2(originX, originY);
                done = true;
                handle.cancel();
            }
        });
    }

    // Brief red flash on the target card when hit. Duration ~0.18s.
    function _flashCard(entity) {
        if (!entity || !entity.exists()) return;
        const origR = entity.color.r;
        const origG = entity.color.g;
        const origB = entity.color.b;
        let timer = 0;
        let done = false;
        const handle = entity.onUpdate(() => {
            if (done) return;
            timer += k.dt();
            if (timer < 0.09) {
                entity.color = k.rgb(200, 30, 30);
            } else {
                entity.color = k.rgb(origR, origG, origB);
                done = true;
                handle.cancel();
            }
        });
    }

    function _buildPartyRender() {
        for (const row of partyRenderEntities) row.forEach(e => e.destroy());
        partyRenderEntities.length = 0;

        const count = partyCombatants.length;
        const spacing = (H - TOP_H - BOT_H - CARD_H) / Math.max(count, 1);

        partyCombatants.forEach((c, i) => {
            const cx = PARTY_X + PARTY_W / 2;
            const cy = TOP_H + 35 + i * (CARD_H + 14) + CARD_H / 2;

            const ents = [];

            // Card border
            const isAlive = c.currentHp > 0;
            const rc = _rarityRgb(k, c.rarity);
            const bg = k.add([
                k.pos(cx, cy),
                k.rect(CARD_W, CARD_H, { radius: 6 }),
                k.color(isAlive ? 18 : 8, isAlive ? 10 : 5, isAlive ? 40 : 18),
                k.outline(isAlive ? 1 : 0, rc),
                k.anchor('center'),
                k.opacity(isAlive ? 1 : 0.4),
                k.z(2),
            ]);
            ents.push(bg);
            c._bgEnt = bg;  // store for wiggle

            // Sprite
            try {
                const sp = k.add([
                    k.pos(cx, cy - CARD_H / 2 + 4),
                    k.sprite(c.img, { width: CARD_W - 8, height: CARD_H - 50 }),
                    k.anchor('top'),
                    k.opacity(isAlive ? 1 : 0.25),
                    k.z(3),
                ]);
                ents.push(sp);
            } catch (_) {}

            // Name label
            ents.push(k.add([
                k.pos(cx, cy + CARD_H / 2 - 34),
                k.text(c.name.replace('The ', ''), { size: 9 }),
                k.color(...(isAlive ? _rarityArr(c.rarity) : [70, 55, 90])),
                k.anchor('center'),
                k.z(3),
            ]));

            // HP bar background
            const hpBg = k.add([
                k.pos(cx - HP_BAR_W / 2, cy + CARD_H / 2 - 22),
                k.rect(HP_BAR_W, HP_BAR_H, { radius: 3 }),
                k.color(40, 15, 20),
                k.anchor('topleft'),
                k.z(3),
            ]);
            ents.push(hpBg);

            // HP bar fill
            const hpFrac = Math.max(0, c.currentHp / c.maxHp);
            const hpFill = k.add([
                k.pos(cx - HP_BAR_W / 2, cy + CARD_H / 2 - 22),
                k.rect(Math.max(1, HP_BAR_W * hpFrac), HP_BAR_H, { radius: 3 }),
                k.color(..._hpColor(hpFrac)),
                k.anchor('topleft'),
                k.z(4),
            ]);
            ents.push(hpFill);

            // HP text
            ents.push(k.add([
                k.pos(cx, cy + CARD_H / 2 - 8),
                k.text(`${Math.max(0, c.currentHp)} / ${c.maxHp}`, { size: 9 }),
                k.color(...COLORS.silver),
                k.anchor('center'),
                k.z(4),
            ]));

            // Shield indicator
            if (c.shield > 0) {
                ents.push(k.add([
                    k.pos(cx - CARD_W / 2 + 4, cy - CARD_H / 2 + 4),
                    k.text(`SH ${c.shield}`, { size: 8 }),
                    k.color(200, 170, 80),
                    k.anchor('topleft'),
                    k.z(5),
                ]));
            }

            // Status icon (debuff)
            if (c.debuff) {
                ents.push(k.add([
                    k.pos(cx + CARD_W / 2 - 4, cy - CARD_H / 2 + 4),
                    k.text(c.debuff.slice(0, 4).toUpperCase(), { size: 7 }),
                    k.color(...COLORS.danger),
                    k.anchor('topright'),
                    k.z(5),
                ]));
            }

            // Knocked-out overlay
            if (!isAlive) {
                ents.push(k.add([
                    k.pos(cx, cy),
                    k.text('KO', { size: 28 }),
                    k.color(...COLORS.danger),
                    k.anchor('center'),
                    k.opacity(0.6),
                    k.z(5),
                ]));
            }

            partyRenderEntities.push(ents);
        });
    }

    function _buildEnemyRender() {
        for (const row of enemyRenderEntities) row.forEach(e => e.destroy());
        enemyRenderEntities.length = 0;

        const count = enemyCombatants.length;
        const ENEMY_CARD_W = 130;
        const ENEMY_CARD_H = 140;
        const startY = TOP_H + 45;
        const spacingY = (H - TOP_H - BOT_H - 50) / Math.max(count, 1);

        enemyCombatants.forEach((e, i) => {
            const ex = ENEMY_X + ENEMY_W / 2;
            const ey = startY + i * (ENEMY_CARD_H + 12) + ENEMY_CARD_H / 2;

            const ents = [];
            const isAlive = e.currentHp > 0;

            const bg = k.add([
                k.pos(ex, ey),
                k.rect(ENEMY_CARD_W, ENEMY_CARD_H, { radius: 5 }),
                k.color(isAlive ? 24 : 8, isAlive ? 6 : 4, isAlive ? 18 : 10),
                k.outline(isAlive ? 1 : 0, k.rgb(...COLORS.danger.map(c => Math.floor(c * 0.6)))),
                k.anchor('center'),
                k.opacity(isAlive ? 1 : 0.3),
                k.z(2),
            ]);
            ents.push(bg);
            e._bgEnt = bg;  // store for wiggle

            // Name
            ents.push(k.add([
                k.pos(ex, ey - ENEMY_CARD_H / 2 + 8),
                k.text(e.name, { size: 11 }),
                k.color(...(isAlive ? COLORS.danger : [70, 40, 50])),
                k.anchor('top'),
                k.z(3),
            ]));

            // Stats row
            ents.push(k.add([
                k.pos(ex, ey - ENEMY_CARD_H / 2 + 26),
                k.text(`ATK ${e.atk}  SPD ${e.spd}  DEF ${e.def}`, { size: 9 }),
                k.color(...COLORS.silver),
                k.anchor('top'),
                k.z(3),
            ]));

            // Elite/Boss badge
            if (e.isElite) {
                ents.push(k.add([
                    k.pos(ex - ENEMY_CARD_W / 2 + 4, ey - ENEMY_CARD_H / 2 + 4),
                    k.text('ELITE', { size: 8 }),
                    k.color(...COLORS.gold),
                    k.anchor('topleft'),
                    k.z(4),
                ]));
            }
            if (e.isBoss) {
                ents.push(k.add([
                    k.pos(ex - ENEMY_CARD_W / 2 + 4, ey - ENEMY_CARD_H / 2 + 4),
                    k.text('BOSS', { size: 8 }),
                    k.color(...COLORS.gold),
                    k.anchor('topleft'),
                    k.z(4),
                ]));
            }

            // Ability name
            if (e.ability) {
                ents.push(k.add([
                    k.pos(ex, ey - 10),
                    k.text(e.ability.name, { size: 9 }),
                    k.color(160, 110, 220),
                    k.anchor('center'),
                    k.z(3),
                ]));
            }

            // HP bar bg
            ents.push(k.add([
                k.pos(ex - HP_BAR_W / 2, ey + ENEMY_CARD_H / 2 - 22),
                k.rect(HP_BAR_W, HP_BAR_H, { radius: 3 }),
                k.color(40, 15, 20),
                k.anchor('topleft'),
                k.z(3),
            ]));

            // HP bar fill
            const hpFrac = Math.max(0, e.currentHp / e.maxHp);
            ents.push(k.add([
                k.pos(ex - HP_BAR_W / 2, ey + ENEMY_CARD_H / 2 - 22),
                k.rect(Math.max(1, HP_BAR_W * hpFrac), HP_BAR_H, { radius: 3 }),
                k.color(..._hpColor(hpFrac)),
                k.anchor('topleft'),
                k.z(4),
            ]));

            // HP text
            ents.push(k.add([
                k.pos(ex, ey + ENEMY_CARD_H / 2 - 8),
                k.text(`${Math.max(0, e.currentHp)} / ${e.maxHp}`, { size: 9 }),
                k.color(...COLORS.silver),
                k.anchor('center'),
                k.z(4),
            ]));

            // Shield indicator
            if (e.shield > 0) {
                ents.push(k.add([
                    k.pos(ex - ENEMY_CARD_W / 2 + 4, ey + 4),
                    k.text(`SH ${e.shield}`, { size: 8 }),
                    k.color(200, 170, 80),
                    k.anchor('left'),
                    k.z(5),
                ]));
            }

            // Dead overlay
            if (!isAlive) {
                ents.push(k.add([
                    k.pos(ex, ey),
                    k.text('DEFEATED', { size: 16 }),
                    k.color(...COLORS.danger),
                    k.anchor('center'),
                    k.opacity(0.5),
                    k.z(5),
                ]));
            }

            enemyRenderEntities.push(ents);
        });
    }

    // ----------------------------------------------------------------
    // Log panel
    // ----------------------------------------------------------------

    const logTextEntities = [];
    for (let i = 0; i < 6; i++) {
        logTextEntities.push(k.add([
            k.pos(LOG_X + 12, TOP_H + 32 + i * 26),
            k.text('', { size: 11 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(4),
        ]));
    }

    function _rebuildLog() {
        for (let i = 0; i < 6; i++) {
            if (i < logLines.length) {
                const line = logLines[logLines.length - 1 - (5 - i)];
                if (line) {
                    logTextEntities[i].text  = line.msg;
                    logTextEntities[i].color = k.rgb(...line.color);
                } else {
                    logTextEntities[i].text = '';
                }
            } else {
                logTextEntities[i].text = '';
            }
        }
    }

    // Tick progress bar
    const tickBg = k.add([
        k.pos(LOG_X + 12, H - BOT_H - 18),
        k.rect(LOG_W - 24, 8, { radius: 3 }),
        k.color(30, 20, 50),
        k.anchor('topleft'),
        k.z(4),
    ]);
    const tickFill = k.add([
        k.pos(LOG_X + 12, H - BOT_H - 18),
        k.rect(1, 8, { radius: 3 }),
        k.color(...COLORS.accent),
        k.anchor('topleft'),
        k.z(5),
    ]);
    k.add([k.pos(LOG_X + 12, H - BOT_H - 6), k.text('TICK', { size: 9 }), k.color(60, 50, 100), k.anchor('topleft'), k.z(5)]);

    // ----------------------------------------------------------------
    // Result overlay (shown after battle ends)
    // ----------------------------------------------------------------

    let resultOverlay = null;

    function _showResult(won) {
        if (resultOverlay) return;

        const CX = W / 2;
        const CY = H / 2;
        const ents = [];

        // Dim overlay
        ents.push(k.add([k.pos(0, 0), k.rect(W, H), k.color(0, 0, 0), k.opacity(0.65), k.z(10)]));

        // Result box
        ents.push(k.add([
            k.pos(CX, CY),
            k.rect(500, won ? 300 : 260, { radius: 10 }),
            k.color(won ? 14 : 20, won ? 20 : 8, won ? 40 : 16),
            k.outline(2, won ? k.rgb(...COLORS.success) : k.rgb(...COLORS.danger)),
            k.anchor('center'),
            k.z(11),
        ]));

        ents.push(k.add([
            k.pos(CX, CY - 110),
            k.text(won ? 'WAVE CLEARED!' : 'PARTY DEFEATED', { size: 32 }),
            k.color(...(won ? COLORS.success : COLORS.danger)),
            k.anchor('center'),
            k.z(12),
        ]));

        if (won) {
            const omen = state.activeOmen;
            const baseGems = waveDef.gemReward || GEMS_PER_WIN;
            const gemsEarned = (omen && omen.id === 'hexed') ? Math.floor(baseGems * 0.5) : baseGems;
            ents.push(k.add([k.pos(CX, CY - 60), k.text(`+${gemsEarned} Gems earned`, { size: 18 }), k.color(...COLORS.gold), k.anchor('center'), k.z(12)]));
            // state.wave was already incremented in _resolveBattle, so clearedWave = state.wave - 1
            const clearedWave = state.wave - 1;
            ents.push(k.add([k.pos(CX, CY - 32), k.text(`Wave ${clearedWave} complete`, { size: 14 }), k.color(...COLORS.silver), k.anchor('center'), k.z(12)]));

            if (state.wave > MAX_ENEMY_WAVES) {
                ents.push(k.add([k.pos(CX, CY), k.text('YOU CONQUERED THE WORLD!', { size: 20 }), k.color(...COLORS.gold), k.anchor('center'), k.z(12)]));
            }

            // Reading waves: prompt goes to reading scene
            const isReadingWave = state.isReadingWave(clearedWave);

            // Next Wave / Reading button
            function _doNextWave() {
                const dest = isReadingWave ? 'reading' : 'battle';
                events.clearAll();
                k.go(dest);
            }

            const btnLabel = isReadingWave ? 'The Reading awaits...' : `Wave ${state.wave} — Next Wave`;
            const btnClr = isReadingWave ? COLORS.accent : COLORS.success;
            const nextBtn = k.add([
                k.pos(CX, CY + 42),
                k.rect(340, 50, { radius: 6 }),
                k.color(isReadingWave ? 20 : 12, isReadingWave ? 14 : 30, isReadingWave ? 50 : 22),
                k.outline(2, k.rgb(...btnClr)),
                k.anchor('center'),
                k.area(),
                k.z(12),
            ]);
            ents.push(nextBtn);
            ents.push(k.add([k.pos(CX, CY + 42), k.text(btnLabel, { size: 16 }), k.color(...btnClr), k.anchor('center'), k.z(13)]));

            nextBtn.onClick(_doNextWave);
            nextBtn.onHover(()    => { nextBtn.color = k.rgb(isReadingWave ? 40 : 20, isReadingWave ? 28 : 55, isReadingWave ? 90 : 40); });
            nextBtn.onHoverEnd(() => { nextBtn.color = k.rgb(isReadingWave ? 20 : 12, isReadingWave ? 14 : 30, isReadingWave ? 50 : 22); });

            ents.push(k.add([k.pos(CX, CY + 100), k.text('(ENTER) Next Wave   (ESC) Hub', { size: 12 }), k.color(80, 70, 120), k.anchor('center'), k.z(12)]));
            if (isReadingWave) {
                ents.push(k.add([k.pos(CX, CY + 120), k.text('A card shall be drawn from your collection...', { size: 11 }), k.color(...COLORS.silver), k.anchor('center'), k.z(12)]));
            }
        } else {
            ents.push(k.add([k.pos(CX, CY - 30), k.text(`Lives remaining: ${state.lives}`, { size: 16 }), k.color(...COLORS.danger), k.anchor('center'), k.z(12)]));
            if (state.lives <= 0) {
                ents.push(k.add([k.pos(CX, CY + 10), k.text('GAME OVER', { size: 22 }), k.color(...COLORS.danger), k.anchor('center'), k.z(12)]));
                ents.push(k.add([k.pos(CX, CY + 70), k.text('(R) New Run   (ESC) Title', { size: 14 }), k.color(...COLORS.text), k.anchor('center'), k.z(12)]));
            } else {
                ents.push(k.add([k.pos(CX, CY + 70), k.text('(ENTER) Retry   (ESC) Hub', { size: 14 }), k.color(...COLORS.text), k.anchor('center'), k.z(12)]));
            }
        }

        resultOverlay = ents;
    }

    // ----------------------------------------------------------------
    // Initial render
    // ----------------------------------------------------------------

    _buildPartyRender();
    _buildEnemyRender();

    // ----------------------------------------------------------------
    // Start Battle button (shown before battle begins)
    // ----------------------------------------------------------------

    const MIN_PARTY_SIZE = 1;
    const canStart = state.party.length >= MIN_PARTY_SIZE;

    const CX = W / 2;
    const CY = (TOP_H + (H - BOT_H)) / 2;

    const startOverlay = k.add([
        k.pos(0, 0), k.rect(W, H), k.color(0, 0, 0), k.opacity(0.55), k.z(20),
    ]);

    const startBox = k.add([
        k.pos(CX, CY),
        k.rect(480, 220, { radius: 10 }),
        k.color(14, 8, 36),
        k.outline(2, k.rgb(...COLORS.accent)),
        k.anchor('center'),
        k.z(21),
    ]);

    k.add([
        k.pos(CX, CY - 72),
        k.text(`Wave ${state.wave}  —  ${waveDef.name}`, { size: 20 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.z(22),
        'startOverlayEnt',
    ]);

    k.add([
        k.pos(CX, CY - 38),
        k.text(`${partyCombatants.length} card${partyCombatants.length !== 1 ? 's' : ''} vs ${enemyCombatants.length} ${enemyCombatants.length !== 1 ? 'enemies' : 'enemy'}`, { size: 14 }),
        k.color(...COLORS.silver),
        k.anchor('center'),
        k.z(22),
        'startOverlayEnt',
    ]);

    // Warning if party too small (shouldn't normally show since we already error-returned above,
    // but guards future config changes)
    if (!canStart) {
        k.add([
            k.pos(CX, CY + 10),
            k.text(`Need at least ${MIN_PARTY_SIZE} card in your party!\nGo to Collection to set your party.`, { size: 13 }),
            k.color(...COLORS.danger),
            k.anchor('center'),
            k.z(22),
            'startOverlayEnt',
        ]);
    }

    const btnColor = canStart ? [60, 35, 130] : [35, 20, 40];
    const btnOutline = canStart ? k.rgb(...COLORS.success) : k.rgb(80, 40, 60);
    const startBtn = k.add([
        k.pos(CX, CY + 66),
        k.rect(280, 52, { radius: 6 }),
        k.color(...btnColor),
        k.outline(canStart ? 2 : 1, btnOutline),
        k.anchor('center'),
        k.area(),
        k.z(22),
        'startOverlayEnt',
    ]);
    k.add([
        k.pos(CX, CY + 66),
        k.text(canStart ? '(Space) Start Battle' : 'Party too small', { size: 17 }),
        k.color(...(canStart ? COLORS.success : COLORS.danger)),
        k.anchor('center'),
        k.z(23),
        'startOverlayEnt',
    ]);

    function _doStartBattle() {
        if (!canStart || battleStarted) return;
        battleStarted = true;

        // Remove start overlay
        startOverlay.destroy();
        startBox.destroy();
        for (const e of k.get('startOverlayEnt')) e.destroy();

        // Update bottom hint
        bottomHint.text = '(ESC) Hub  —  Auto battle in progress...';

        // Trigger onEngage abilities
        _triggerEngage();

        addLog(`Wave ${state.wave}: ${waveDef.name}`, COLORS.gold);
        addLog(`${partyCombatants.length} fighters vs ${enemyCombatants.length} enemies`, COLORS.silver);
    }

    if (canStart) {
        startBtn.onClick(_doStartBattle);
        startBtn.onHover(()    => { startBtn.color = k.rgb(90, 55, 170); });
        startBtn.onHoverEnd(() => { startBtn.color = k.rgb(...btnColor); });
        k.onKeyPress('space', _doStartBattle);
    }

    // ----------------------------------------------------------------
    // Battle tick — turn-based step sequencer
    // ----------------------------------------------------------------

    // True while we are stepping through actions — blocks the tick timer
    let steppingActions = false;

    function _runTick() {
        if (battleOver) return;
        tickCount++;

        events.emit('battleTick', { tick: tickCount });

        // --- Omen: Poisoned — party loses 5% max HP each tick ---
        if (state.activeOmen && state.activeOmen.id === 'poisoned') {
            for (const c of partyCombatants) {
                if (c.currentHp <= 0) continue;
                const loss = Math.max(1, Math.floor(c.maxHp * 0.05));
                c.currentHp = Math.max(0, c.currentHp - loss);
            }
            addLog('Poisoned: party takes 5% HP damage!', COLORS.danger);
        }

        // --- Passive / onTick enemy abilities (instant, before steps) ---
        for (const enemy of enemyCombatants) {
            if (enemy.currentHp <= 0) continue;
            _enemyTickAbility(enemy);
        }

        // Boss phase checks & boss heal (also instant)
        for (const e of enemyCombatants) {
            if (e.isBoss) _checkBossPhases(e);
        }
        for (const e of enemyCombatants) {
            if (e.isBoss && tickCount % 5 === 0) {
                e.currentHp = Math.min(e.maxHp, e.currentHp + 40);
                addLog(`The World heals 40 HP (Integration)`, [160, 110, 220]);
            }
        }

        // Reset shell-hit flags for this round
        for (const e of enemyCombatants) e._shellHit = false;

        const aliveParty   = partyCombatants.filter(c => c.currentHp > 0);
        const aliveEnemies = enemyCombatants.filter(e => e.currentHp > 0);

        if (aliveParty.length === 0 || aliveEnemies.length === 0) {
            _resolveBattle();
            return;
        }

        // Build ordered action queue: party then enemies, interleaved by spd
        // Each combatant contributes `spd` slots; we interleave them so faster
        // units don't just dump all their hits in a row.
        const partySlots  = [];
        for (const card of aliveParty) {
            for (let i = 0; i < card.spd; i++) partySlots.push({ type: 'party', actor: card });
        }
        const enemySlots  = [];
        for (const enemy of aliveEnemies) {
            if (enemy.currentHp <= 0) continue;
            for (let i = 0; i < enemy.spd; i++) enemySlots.push({ type: 'enemy', actor: enemy });
        }

        // Interleave: alternate party / enemy slots
        const actionQueue = [];
        const maxLen = Math.max(partySlots.length, enemySlots.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < partySlots.length)  actionQueue.push(partySlots[i]);
            if (i < enemySlots.length)  actionQueue.push(enemySlots[i]);
        }

        steppingActions = true;
        _stepActions(actionQueue, 0);
    }

    // Timing constants for action animation sequence
    const WIGGLE_TO_HIT_S = 0.22;   // delay from wiggle start to damage resolution + flash
    const HIT_TO_REBUILD_S = 0.18;  // delay from hit to rebuilding renders
    const BETWEEN_STEPS_S = 0.55;   // pause between combatant turns

    function _stepActions(queue, idx) {
        if (battleOver) { steppingActions = false; return; }

        if (idx >= queue.length) {
            // All actions done — tick down debuffs, re-render, check end
            for (const c of partyCombatants) {
                if (c.debuffTicks > 0) { c.debuffTicks--; if (c.debuffTicks <= 0) c.debuff = null; }
            }
            for (const e of enemyCombatants) {
                if (e.debuffTicks > 0) { e.debuffTicks--; if (e.debuffTicks <= 0) e.debuff = null; }
            }
            _buildPartyRender();
            _buildEnemyRender();
            steppingActions = false;

            const stillAliveParty   = partyCombatants.filter(c => c.currentHp > 0);
            const stillAliveEnemies = enemyCombatants.filter(e => e.currentHp > 0);
            if (stillAliveEnemies.length === 0 || stillAliveParty.length === 0) {
                _resolveBattle();
            }
            return;
        }

        const { type, actor } = queue[idx];

        // Determine target now (before any state changes) so we can flash it
        let targetEnt = null;

        if (type === 'party') {
            if (actor.currentHp <= 0) {
                // Skip dead card, move on
                k.wait(0, () => _stepActions(queue, idx + 1));
                return;
            }
            const livingEnemies = enemyCombatants.filter(e => e.currentHp > 0);
            if (livingEnemies.length === 0) {
                k.wait(0, () => _stepActions(queue, idx + 1));
                return;
            }
            targetEnt = livingEnemies[0]._bgEnt;

            // 1. Wiggle attacker
            _wiggleCard(actor._bgEnt);

            // 2. After wiggle peak — resolve damage + flash target
            k.wait(WIGGLE_TO_HIT_S, () => {
                if (battleOver) return;
                _flashCard(targetEnt);
                _partyAct(actor, enemyCombatants.filter(e => e.currentHp > 0));

                // 3. After flash settles — rebuild renders
                k.wait(HIT_TO_REBUILD_S, () => {
                    if (battleOver) return;
                    _buildPartyRender();
                    _buildEnemyRender();

                    // 4. Check for battle end, then advance queue
                    const ap = partyCombatants.filter(c => c.currentHp > 0);
                    const ae = enemyCombatants.filter(e => e.currentHp > 0);
                    if (ae.length === 0 || ap.length === 0) {
                        steppingActions = false;
                        _resolveBattle();
                        return;
                    }
                    k.wait(BETWEEN_STEPS_S, () => _stepActions(queue, idx + 1));
                });
            });

        } else {
            if (actor.currentHp <= 0) {
                k.wait(0, () => _stepActions(queue, idx + 1));
                return;
            }
            const livingParty = partyCombatants.filter(c => c.currentHp > 0);
            if (livingParty.length === 0) {
                k.wait(0, () => _stepActions(queue, idx + 1));
                return;
            }
            targetEnt = livingParty[0]._bgEnt;

            // 1. Wiggle attacker
            _wiggleCard(actor._bgEnt);

            // 2. After wiggle peak — resolve damage + flash target
            k.wait(WIGGLE_TO_HIT_S, () => {
                if (battleOver) return;
                _flashCard(targetEnt);
                playPartyHit();
                _enemyAct(actor, partyCombatants.filter(c => c.currentHp > 0));

                // 3. After flash settles — rebuild renders
                k.wait(HIT_TO_REBUILD_S, () => {
                    if (battleOver) return;
                    _buildPartyRender();
                    _buildEnemyRender();

                    // 4. Check for battle end, then advance queue
                    const ap = partyCombatants.filter(c => c.currentHp > 0);
                    const ae = enemyCombatants.filter(e => e.currentHp > 0);
                    if (ae.length === 0 || ap.length === 0) {
                        steppingActions = false;
                        _resolveBattle();
                        return;
                    }
                    k.wait(BETWEEN_STEPS_S, () => _stepActions(queue, idx + 1));
                });
            });
        }
    }

    function _resolveBattle() {
        if (battleOver) return;
        battleOver = true;
        phase = 'result';

        const aliveEnemies = enemyCombatants.filter(e => e.currentHp > 0);
        const won = aliveEnemies.length === 0;

        if (won) {
            const clearedWave = state.wave;
            // Apply gem halving if Hexed omen is active
            const omen = state.activeOmen;
            const baseGems = waveDef.gemReward || GEMS_PER_WIN;
            const gemsEarned = (omen && omen.id === 'hexed') ? Math.floor(baseGems * 0.5) : baseGems;
            state.earnGems(gemsEarned);
            state.addScore(gemsEarned * 10);
            state.wave = Math.min(state.wave + 1, MAX_ENEMY_WAVES + 1);
            // Tick the active omen down one wave
            state.tickOmen();
            saveCollection();
            events.emit('waveCleared', clearedWave);
            playWaveCleared();
            addLog('VICTORY! Wave cleared.', COLORS.success);
            addLog(`+${gemsEarned} gems`, COLORS.gold);
            if (omen && omen.id === 'hexed') addLog('Hexed: gems halved!', COLORS.danger);
            // Check if this wave triggers a reading
            if (state.isReadingWave(clearedWave)) {
                events.emit('readingTriggered');
            }
        } else {
            state.earnGems(GEMS_PER_LOSS);
            state.loseLife();
            playFailure();
            addLog('DEFEAT — party wiped.', COLORS.danger);
            addLog(`+${GEMS_PER_LOSS} consolation gems`, COLORS.silver);
            if (state.lives <= 0) {
                playGameOver();
                events.emit('gameOver');
            }
        }

        events.emit('battleEnd', { won });
        _buildPartyRender();
        _buildEnemyRender();
        k.wait(0.6, () => _showResult(won));
    }

    // ----------------------------------------------------------------
    // Party action resolver
    // ----------------------------------------------------------------

    function _partyAct(card, enemies) {
        // Target: first alive enemy
        const target = enemies[0];
        if (!target) return;

        const suit = card.suit;

        if (suit === 'cups') {
            // Cups: heal the lowest-HP ally
            const ally = partyCombatants
                .filter(c => c.currentHp > 0)
                .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
            if (ally) {
                const healAmt = Math.floor(card.atk * 0.8 + 5);
                ally.currentHp = Math.min(ally.maxHp, ally.currentHp + healAmt);
                playHeal();
                addLog(`${card.name} heals ${ally.name} for ${healAmt}`, COLORS.success);
            }
        } else if (suit === 'swords') {
            // Swords: attack + apply slow debuff (SPD -1 for 2 ticks)
            const dmg = _calcDamage(card.atk, target.def);
            _applyDamageToEnemy(target, dmg, card);
            if (!target.debuff) {
                target.debuff     = 'slow';
                target.debuffTicks = 2;
                target._spdMod    = -1;
            }
            playAttack();
            addLog(`${card.name} slashes ${target.name} for ${dmg} (slow)`, COLORS.mana);
        } else if (suit === 'pentacles') {
            // Pentacles: attack + grant self a small shield
            const dmg = _calcDamage(card.atk, target.def);
            _applyDamageToEnemy(target, dmg, card);
            if (card.shield === 0) {
                card.shield = Math.floor(card.def * 0.5 + 8);
            }
            playAttack();
            addLog(`${card.name} strikes ${target.name} for ${dmg} (shield)`, [200, 170, 80]);
        } else if (suit === 'major') {
            // Major Arcana: use special ability
            _majorArcanaAbility(card, target, enemies);
        } else {
            // Wands or default: plain attack, highest damage
            const atkBonus = suit === 'wands' ? Math.floor(card.atk * 0.3) : 0;
            const dmg = _calcDamage(card.atk + atkBonus, target.def);
            _applyDamageToEnemy(target, dmg, card);
            playAttack();
            addLog(`${card.name} attacks ${target.name} for ${dmg}`, COLORS.text);
        }
    }

    function _majorArcanaAbility(card, target, enemies) {
        const name = card.name;
        // Simplified per-card ability map (key arcana get unique logic)
        if (name === 'The Fool') {
            // Random target, random damage multiplier
            const rnd = enemies[Math.floor(Math.random() * enemies.length)];
            const mult = 0.5 + Math.random();
            const dmg = Math.floor(_calcDamage(card.atk, rnd.def) * mult);
            _applyDamageToEnemy(rnd, dmg, card);
            playAttack();
            addLog(`The Fool's gambit hits ${rnd.name} for ${dmg}`, COLORS.accent);
        } else if (name === 'The Magician') {
            // AoE small damage
            const dmg = Math.floor(_calcDamage(card.atk * 0.5, 0));
            for (const e of enemies) { _applyDamageToEnemy(e, dmg, card); }
            playSpell();
            addLog(`The Magician blasts all for ${dmg}`, COLORS.accent);
        } else if (name === 'The High Priestess') {
            // Reveal & reduce enemy DEF
            target.def = Math.max(0, target.def - 5);
            playSpell();
            addLog(`The High Priestess weakens ${target.name} DEF`, COLORS.accent);
        } else if (name === 'The Empress') {
            // Heal all allies
            const healAmt = Math.floor(card.atk * 0.4 + 10);
            for (const c of partyCombatants.filter(c => c.currentHp > 0)) {
                c.currentHp = Math.min(c.maxHp, c.currentHp + healAmt);
            }
            playHeal();
            addLog(`The Empress restores ${healAmt} HP to all`, COLORS.success);
        } else if (name === 'The Emperor') {
            // Grant all allies +def buff (shield)
            for (const c of partyCombatants.filter(c => c.currentHp > 0)) {
                c.shield = Math.max(c.shield, 15);
            }
            playSpell();
            addLog(`The Emperor fortifies the party`, [200, 170, 80]);
        } else if (name === 'The Tower') {
            // Massive single target + AoE splash
            const mainDmg = _calcDamage(card.atk * 2, target.def);
            _applyDamageToEnemy(target, mainDmg, card);
            const splash = Math.floor(mainDmg * 0.3);
            for (const e of enemies) { if (e !== target) _applyDamageToEnemy(e, splash, card); }
            playSpell();
            addLog(`The Tower devastates ${target.name} for ${mainDmg}`, COLORS.danger);
        } else if (name === 'The Star') {
            // Fully restore one ally
            const ally = partyCombatants.filter(c => c.currentHp > 0)
                .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
            if (ally) {
                ally.currentHp = ally.maxHp;
                playHeal();
                addLog(`The Star fully restores ${ally.name}`, COLORS.success);
            }
        } else if (name === 'The Moon') {
            // Confuse one enemy — reduce ATK by 30%
            target.atk = Math.floor(target.atk * 0.7);
            playSpell();
            addLog(`The Moon confuses ${target.name} (ATK down)`, COLORS.mana);
        } else if (name === 'The Sun') {
            // Buff all party ATK for 1 tick
            for (const c of partyCombatants.filter(c => c.currentHp > 0)) {
                c._sunBuff = Math.floor(c.atk * 0.5);
                c.atk += c._sunBuff;
            }
            k.wait(BATTLE_TICK_S, () => {
                for (const c of partyCombatants) {
                    if (c._sunBuff) { c.atk -= c._sunBuff; c._sunBuff = 0; }
                }
            });
            playSpell();
            addLog(`The Sun blazes — party ATK +50% this tick`, COLORS.gold);
        } else if (name === 'Judgement') {
            // Revive a fallen ally at 30% HP
            const fallen = partyCombatants.find(c => c.currentHp <= 0);
            if (fallen) {
                fallen.currentHp = Math.floor(fallen.maxHp * 0.3);
                playHeal();
                addLog(`Judgement revives ${fallen.name}!`, COLORS.accent);
            } else {
                const dmg = _calcDamage(card.atk * 1.5, target.def);
                _applyDamageToEnemy(target, dmg, card);
                playSpell();
                addLog(`Judgement smites ${target.name} for ${dmg}`, COLORS.accent);
            }
        } else if (name === 'The World') {
            // AoE heavy damage
            const dmg = _calcDamage(card.atk, 0);
            for (const e of enemies) { _applyDamageToEnemy(e, dmg, card); }
            playSpell();
            addLog(`The World's power strikes all for ${dmg}`, COLORS.gold);
        } else {
            // All other Major Arcana: strong single attack
            const dmg = _calcDamage(Math.floor(card.atk * 1.3), target.def);
            _applyDamageToEnemy(target, dmg, card);
            playSpell();
            addLog(`${card.name} casts arcane force on ${target.name} for ${dmg}`, COLORS.accent);
        }
    }

    // ----------------------------------------------------------------
    // Enemy action resolver
    // ----------------------------------------------------------------

    function _enemyAct(enemy, livingParty) {
        // Default: attack first (lowest-index alive) party member
        const target = livingParty[0];
        if (!target) return;

        // SPD debuff check
        const effectiveSpd = enemy.spd + (enemy._spdMod || 0);
        if (effectiveSpd <= 0) return;  // too slow to act

        const dmg = _calcDamage(enemy.atk, target.shield > 0 ? 0 : target.def);

        if (target.shield > 0) {
            const shieldAbsorb = Math.min(target.shield, dmg);
            target.shield -= shieldAbsorb;
            const remaining = dmg - shieldAbsorb;
            if (remaining > 0) {
                target.currentHp = Math.max(0, target.currentHp - remaining);
                addLog(`${enemy.name} hits ${target.name} for ${remaining} (shield blocked ${shieldAbsorb})`, COLORS.danger);
            } else {
                addLog(`${enemy.name} blocked by ${target.name}'s shield!`, [200, 170, 80]);
            }
        } else {
            target.currentHp = Math.max(0, target.currentHp - dmg);
            addLog(`${enemy.name} attacks ${target.name} for ${dmg}`, COLORS.danger);
        }

        // onHit abilities
        _enemyOnHitAbility(enemy, target, livingParty);

        if (target.currentHp <= 0) {
            addLog(`${target.name} is knocked out!`, COLORS.danger);
        }
    }

    function _triggerEngage() {
        for (const enemy of enemyCombatants) {
            if (enemy.currentHp <= 0) continue;
            if (!enemy.ability || enemy.ability.trigger !== 'onEngage') continue;
            _applyEngageAbility(enemy);
        }
    }

    function _applyEngageAbility(enemy) {
        const id = enemy.id;
        if (id === 'suspension_wraith') {
            const slowest = partyCombatants
                .filter(c => c.currentHp > 0)
                .sort((a, b) => a.spd - b.spd)[0];
            if (slowest) { slowest.spd = Math.max(1, slowest.spd - 1); }
        } else if (id === 'triumph_steed') {
            // Mark for double-damage first hit (handled in _enemyAct via flag)
            enemy._chargeReady = true;
        } else if (id === 'howling_wolf') {
            for (const c of partyCombatants.filter(c => c.currentHp > 0)) {
                c._dreadMod   = Math.floor(c.atk * 0.1);
                c.atk         = Math.max(1, c.atk - c._dreadMod);
                c.debuff      = 'dread';
                c.debuffTicks = 3;
            }
        }
        addLog(`${enemy.name}: ${enemy.ability.name}!`, [160, 110, 220]);
    }

    function _enemyTickAbility(enemy) {
        if (!enemy.ability) return;
        const trigger = enemy.ability.trigger;

        if (trigger === 'onTick') {
            const livingParty = partyCombatants.filter(c => c.currentHp > 0);

            if (enemy.id === 'moonlit_specter') {
                // Veil Step: reduce incoming damage toggle (handled in damage calc via flag)
                enemy._veilActive = !enemy._veilActive;
            } else if (enemy.id === 'war_sphinx') {
                // Trample: 5 splash to all
                for (const c of livingParty) {
                    c.currentHp = Math.max(0, c.currentHp - 5);
                }
                if (livingParty.length > 0) {
                    addLog(`${enemy.name}'s Trample hits party for 5`, COLORS.danger);
                }
            } else if (enemy.id === 'lightning_herald') {
                if (tickCount % 3 === 0) {
                    for (const c of livingParty) {
                        c.currentHp = Math.max(0, c.currentHp - 15);
                    }
                    if (livingParty.length > 0) {
                        addLog(`${enemy.name}'s Overcharge deals 15 lightning to all!`, COLORS.danger);
                    }
                }
            } else if (enemy.id === 'angel_of_doom') {
                if (tickCount % 4 === 0) {
                    for (const c of livingParty) {
                        const lose = Math.floor(c.currentHp * 0.1);
                        c.currentHp = Math.max(0, c.currentHp - lose);
                    }
                    if (livingParty.length > 0) {
                        addLog(`${enemy.name}'s Final Trumpet drains 10% HP!`, COLORS.danger);
                    }
                }
            }
        }

        if (trigger === 'passive') {
            if (enemy.id === 'reaper_shade') {
                // Soul Harvest: handled in _applyDamageToEnemy on ally death
            }
        }
    }

    function _enemyOnHitAbility(enemy, target, livingParty) {
        if (!enemy.ability || enemy.ability.trigger !== 'onHit') return;

        if (enemy.id === 'inverted_echo') {
            if (Math.random() < 0.3) {
                const tmp = target.atk;
                target.atk = target.def;
                target.def = tmp;
                target.debuff      = 'revrs';
                target.debuffTicks = 2;
                addLog(`${target.name}'s ATK and DEF flipped!`, [160, 110, 220]);
            }
        } else if (enemy.id === 'hanged_warden') {
            // Mirror Pain: 15% reflect
            const reflect = Math.floor(enemy.atk * 0.15);
            target.currentHp = Math.max(0, target.currentHp - reflect);
        } else if (enemy.id === 'emperor_avatar') {
            if (!enemy._shieldUsed && enemy.currentHp <= enemy.maxHp * 0.5) {
                enemy.shield    = 40;
                enemy._shieldUsed = true;
                addLog(`${enemy.name} raises Iron Authority shield!`, [200, 170, 80]);
            }
        } else if (enemy.id === 'tower_sentinel') {
            const pct = enemy.currentHp / enemy.maxHp;
            if (!enemy._erupt1 && pct <= 0.66) {
                enemy._erupt1 = true;
                for (const c of livingParty) c.currentHp = Math.max(0, c.currentHp - 30);
                addLog(`${enemy.name}'s Eruption! All take 30 damage!`, COLORS.danger);
            } else if (!enemy._erupt2 && pct <= 0.33) {
                enemy._erupt2 = true;
                for (const c of livingParty) c.currentHp = Math.max(0, c.currentHp - 30);
                addLog(`${enemy.name}'s Eruption again! All take 30!`, COLORS.danger);
            }
        } else if (enemy.id === 'lunar_phantom') {
            // Mirage: dodge handled in damage application
        } else if (enemy.id === 'celestial_judge') {
            if (!enemy._verdictUsed && enemy.currentHp <= enemy.maxHp * 0.5) {
                enemy._verdictUsed = true;
                for (const c of partyCombatants.filter(c => c.currentHp > 0)) {
                    c._atkMalus = Math.floor(c.atk * 0.2);
                    c.atk       = Math.max(1, c.atk - c._atkMalus);
                }
                addLog(`Divine Verdict! Party ATK -20%!`, COLORS.danger);
            }
        }
    }

    // ----------------------------------------------------------------
    // Damage helpers
    // ----------------------------------------------------------------

    function _calcDamage(atk, def) {
        return Math.max(1, atk - def);
    }

    function _applyDamageToEnemy(enemy, rawDmg, _attacker) {
        if (enemy.currentHp <= 0) return;

        let dmg = rawDmg;

        // Mirage dodge (Lunar Phantom)
        if (enemy.id === 'lunar_phantom' && Math.random() < 0.25) {
            addLog(`${enemy.name} dodged!`, [160, 110, 220]);
            return;
        }

        // Shell Fortress (Nightmare Crab) — 50% first hit per tick
        if (enemy.id === 'nightmare_crab' && !enemy._shellHit) {
            dmg = Math.floor(dmg * 0.5);
            enemy._shellHit = true;
        }

        // Veil Step (Moonlit Specter) — 20% reduction every other tick
        if (enemy.id === 'moonlit_specter' && enemy._veilActive) {
            dmg = Math.floor(dmg * 0.8);
        }

        // Shield absorption
        if (enemy.shield > 0) {
            const absorb = Math.min(enemy.shield, dmg);
            enemy.shield -= absorb;
            dmg -= absorb;
        }

        enemy.currentHp = Math.max(0, enemy.currentHp - dmg);
        playEnemyHit();

        // onDeath triggers
        if (enemy.currentHp <= 0) {
            _enemyOnDeath(enemy);
        }
    }

    function _enemyOnDeath(enemy) {
        if (!enemy.ability || enemy.ability.trigger !== 'onDeath') return;

        if (enemy.id === 'bone_strider' && !enemy._revived) {
            enemy._revived = true;
            enemy.currentHp = 20;
            addLog(`${enemy.name} revives from Undying!`, [160, 110, 220]);
        } else if (enemy.id === 'collapse_golem') {
            for (const c of partyCombatants.filter(c => c.currentHp > 0)) {
                c.currentHp = Math.max(0, c.currentHp - 20);
            }
            addLog(`${enemy.name}'s Rubble Fall! 20 dmg to all!`, COLORS.danger);
        } else if (enemy.id === 'risen_knight' && !enemy._revived) {
            enemy._revived = true;
            enemy.currentHp = 40;
            enemy.atk += 10;
            addLog(`${enemy.name} rises again with +10 ATK!`, [160, 110, 220]);
        }

        // Soul Harvest (reaper_shade): heals 8 HP to all alive allies
        for (const e of enemyCombatants) {
            if (e.currentHp > 0 && e.id === 'reaper_shade') {
                e.currentHp = Math.min(e.maxHp, e.currentHp + 8);
            }
        }
    }

    // ----------------------------------------------------------------
    // Boss Phase handling (Wave 10)
    // ----------------------------------------------------------------

    function _checkBossPhases(enemy) {
        if (!enemy.isBoss || !enemy.phases) return;
        const pct = enemy.currentHp / enemy.maxHp;

        for (const phase of enemy.phases) {
            const key = `_phase_${phase.hpPct}`;
            if (!enemy[key] && pct <= phase.hpPct) {
                enemy[key] = true;
                addLog(`The World: ${phase.abilityName}!`, COLORS.gold);

                if (phase.abilityId === 'mirror_suit') {
                    // Copy highest-ATK party member's suit ability for 3 ticks
                    const topCard = partyCombatants
                        .filter(c => c.currentHp > 0)
                        .sort((a, b) => b.atk - a.atk)[0];
                    if (topCard) {
                        addLog(`The World mirrors ${topCard.name}'s power!`, COLORS.gold);
                    }
                } else if (phase.abilityId === 'world_dominion') {
                    enemy.atk += 20;
                    enemy.def += 10;
                    const hpCut = Math.floor(enemy.maxHp * 0.15);
                    for (const c of partyCombatants.filter(c => c.currentHp > 0)) {
                        c.maxHp  = Math.max(1, c.maxHp  - Math.floor(c.maxHp  * 0.15));
                        c.currentHp = Math.min(c.currentHp, c.maxHp);
                    }
                    addLog(`World Dominion — party max HP -15%!`, COLORS.danger);
                }
            }
        }
    }

    // Patch _applyDamageToEnemy to trigger boss phase checks
    const _origApply = _applyDamageToEnemy;
    // (Already integrated — boss phases checked in update loop below)

    // ----------------------------------------------------------------
    // Kaplay update loop
    // ----------------------------------------------------------------

    k.onUpdate(() => {
        if (!battleStarted) return;

        if (battleOver) {
            if (phase === 'result') {
                resultTimer += k.dt();
            }
            return;
        }

        // Don't advance the tick timer while actions are being stepped through
        if (steppingActions) return;

        tickTimer += k.dt();

        // Update tick progress bar
        const frac = Math.min(tickTimer / BATTLE_TICK_S, 1);
        tickFill.pos = k.vec2(LOG_X + 12, H - BOT_H - 18);
        tickFill.width = Math.max(1, (LOG_W - 24) * frac);

        if (tickTimer >= BATTLE_TICK_S) {
            tickTimer -= BATTLE_TICK_S;
            _runTick();
        }
    });

    // ----------------------------------------------------------------
    // Key bindings
    // ----------------------------------------------------------------

    k.onKeyPress('escape', () => {
        events.clearAll();
        k.go('game');
    });

    k.onKeyPress('enter', () => {
        if (!battleOver) return;
        if (state.lives <= 0) return;
        // Check if the completed wave triggers a reading
        const clearedWave = state.wave - 1;
        const dest = state.isReadingWave(clearedWave) ? 'reading' : 'battle';
        events.clearAll();
        k.go(dest);
    });

    k.onKeyPress('r', () => {
        if (!battleOver || state.lives > 0) return;
        state.reset();
        events.clearAll();
        k.go('game');
    });

    k.onSceneLeave(() => events.clearAll());
}

// ----------------------------------------------------------------
// Combatant factories
// ----------------------------------------------------------------

function _makePartyCombatant(card) {
    // Apply star-up stat bonuses (each star = +10% to all base stats)
    const stars = card.stars || 1;
    const mult = 1 + (stars - 1) * 0.10;

    let hp  = Math.floor(card.hp  * mult);
    let atk = Math.floor(card.atk * mult);
    let def = Math.floor(card.def * mult);
    let spd = card.spd;
    let shield = 0;

    // Apply active omen modifiers
    const omen = state.activeOmen;
    if (omen && !omen.instant) {
        if (omen.id === 'blaze')    atk = Math.floor(atk * 1.20);
        if (omen.id === 'clarity')  spd = spd + 1;
        if (omen.id === 'ward')     shield = 30;
        if (omen.id === 'weakened') atk = Math.max(1, Math.floor(atk * 0.80));
        if (omen.id === 'slowed')   spd = Math.max(1, spd - 1);
    }

    return {
        uid:       card.uid,
        id:        card.id,
        name:      card.name,
        img:       card.img,
        suit:      card.suit,
        rarity:    card.rarity,
        stars,
        maxHp:     hp,
        currentHp: hp,
        atk,
        def,
        spd,
        ability:   card.ability || null,
        shield,
        debuff:    null,
        debuffTicks: 0,
    };
}

function _makeEnemyCombatant(enemyDef, wave) {
    // Scale stats +15% per wave beyond enemy's base wave
    const scalingWaves = Math.max(0, wave - enemyDef.wave);
    const mult = Math.pow(1.15, scalingWaves);

    return {
        ...enemyDef,
        maxHp:     Math.floor(enemyDef.hp * mult),
        currentHp: Math.floor(enemyDef.hp * mult),
        atk:       Math.floor(enemyDef.atk * mult),
        def:       Math.floor(enemyDef.def * mult),
        spd:       enemyDef.spd,
        shield:    0,
        debuff:    null,
        debuffTicks: 0,
        _spdMod:   0,
        _veilActive: false,
        _shellHit:   false,
    };
}

// ----------------------------------------------------------------
// Render helpers (pure functions)
// ----------------------------------------------------------------

function _rarityArr(rarity) {
    return {
        COMMON:    [180, 190, 210],
        UNCOMMON:  [100, 220, 120],
        RARE:      [80, 140, 255],
        LEGENDARY: [255, 215, 0],
    }[rarity] || [220, 200, 255];
}

function _rarityRgb(k, rarity) {
    const arr = _rarityArr(rarity);
    return k.rgb(...arr);
}

function _hpColor(frac) {
    if (frac > 0.5) return [80, 220, 100];
    if (frac > 0.25) return [255, 180, 0];
    return [255, 80, 80];
}

// ----------------------------------------------------------------
// Error screen helper
// ----------------------------------------------------------------

function _showError(k, msg) {
    k.add([
        k.pos(640, 360),
        k.text(msg, { size: 20 }),
        k.color(255, 80, 80),
        k.anchor('center'),
        k.z(10),
    ]);
}
