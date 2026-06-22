/**
 * ui.js — DOM HUD for Phase 3 Exploration HUD.
 *
 * Owns all DOM. Gameplay modules only emit events; this module reacts.
 *
 * Public API:
 *   initUI()       — wire everything up; call once after DOM is ready
 *   hideSplash()   — hide the center splash overlay
 *   showDamage()   — trigger edge-vignette + camera shake
 *   showPickup()   — trigger score-counter gold flash
 *   logMessage(s)  — push a line to the message log (also callable directly)
 */

import { state }  from './state.js';
import { events } from './events.js';
import { MINIMAP_CELL, DIRS } from './config.js';
import { grid, gridW, gridH, tileAt } from './dungeon.js';
import { getVisited } from './player.js';

// ── DOM refs ────────────────────────────────────────────────
let $message, $vignette;
let $hpNums, $hpFill;
let $depthVal;
let $scoreVal;
let $compassDir;
let $minimapWrap, $minimapCanvas, $minimapCtx;
let $automapOverlay, $automapCanvas, $automapCtx;
let $hintSearch;
let $messageLog;

// Combat DOM refs
let $combatLayer;
let $combatTurnBanner;
let $enemyNameplate, $enemyIcon, $enemyName, $enemyStatus;
let $enemyHpFill, $enemyHpNums;
let $combatTurnOrder, $turnYou, $turnEnemy;
let $combatActionBar;
let $combatLog;
let _combatLogPool = [];
let _combatLogNext = 0;
const COMBAT_LOG_POOL = 4;
const COMBAT_LOG_DUR  = 5000;

// ── HP animation state ─────────────────────────────────────
let _hpDisplayed = 1.0;    // fraction (0–1) currently shown in bar
let _hpTarget    = 1.0;
let _hpAnimId    = null;

// ── Log pool ────────────────────────────────────────────────
const LOG_POOL_SIZE = 3;
const LOG_DURATION  = 4000;  // ms before a message fades
const _logPool = [];
let _logNext = 0;            // round-robin index

// ── Compass directions ──────────────────────────────────────
const COMPASS_LABELS = ['N', 'E', 'S', 'W'];

// ── Minimap / automap state ─────────────────────────────────
let _minimapVisible  = false;
let _automapVisible  = false;

// ============================================================
// Init
// ============================================================

export function initUI() {
    $message        = document.getElementById('message');
    $vignette       = document.getElementById('vignette');
    $hpNums         = document.getElementById('hp-nums');
    $hpFill         = document.getElementById('hp-bar-fill');
    $depthVal       = document.getElementById('depth-val');
    $scoreVal       = document.getElementById('score-val');
    $compassDir     = document.getElementById('compass-dir');
    $minimapWrap    = document.getElementById('minimap-wrap');
    $minimapCanvas  = document.getElementById('minimap-canvas');
    $automapOverlay = document.getElementById('automap-overlay');
    $automapCanvas  = document.getElementById('automap-canvas');
    $hintSearch     = document.getElementById('hint-search');
    $messageLog     = document.getElementById('message-log');

    // Build canvas contexts
    $minimapCtx = $minimapCanvas.getContext('2d');
    $automapCtx = $automapCanvas.getContext('2d');

    // Build log pool
    for (let i = 0; i < LOG_POOL_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'log-entry';
        $messageLog.appendChild(el);
        _logPool.push(el);
    }

    // Initial render from current state
    _renderHP(state.hp, state.hpMax);
    _renderDepth(state.depth);
    _renderScore(state.score);
    _renderCompass(state.facing);

    // Subscribe to events
    events.on('hpChanged',      ({ cur, max }) => _renderHP(cur, max));
    events.on('depthChanged',   d  => _renderDepth(d));
    events.on('scoreChanged',   s  => _renderScore(s));
    events.on('playerMoved',    ({ facing }) => _renderCompass(facing));
    events.on('tileRevealed',   () => _drawMinimap());
    events.on('playerMoved',    () => _drawMinimap());
    events.on('logMessage',     s  => logMessage(s));
    events.on('damageTaken',    () => showDamage());
    events.on('pickupGold',     () => showPickup());
    events.on('gameOver',       _showGameOver);

    // Wire combat DOM
    $combatLayer       = document.getElementById('combat-layer');
    $combatTurnBanner  = document.getElementById('combat-turn-banner');
    $enemyIcon         = document.getElementById('enemy-icon');
    $enemyName         = document.getElementById('enemy-name');
    $enemyStatus       = document.getElementById('enemy-status');
    $enemyHpFill       = document.getElementById('enemy-hp-bar-fill');
    $enemyHpNums       = document.getElementById('enemy-hp-nums');
    $turnYou           = document.getElementById('turn-you');
    $turnEnemy         = document.getElementById('turn-enemy');
    $combatActionBar   = document.getElementById('combat-action-bar');
    $combatLog         = document.getElementById('combat-log');

    // Build combat log pool
    for (let i = 0; i < COMBAT_LOG_POOL; i++) {
        const el = document.createElement('div');
        el.className = 'combat-log-entry';
        $combatLog.appendChild(el);
        _combatLogPool.push(el);
    }

    // Action button clicks
    if ($combatActionBar) {
        $combatActionBar.querySelectorAll('.combat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                events.emit('combatAction', { action });
            });
        });
    }

    // Combat events
    events.on('combatStarted',     _onCombatStarted);
    events.on('combatEnded',       _onCombatEnded);
    events.on('combatLog',         _addCombatLog);
    events.on('enemyHpChanged',    _updateEnemyHp);
    events.on('combatTurnChanged', _updateCombatTurn);
    events.on('combatPlayerAttack', ({ dmg, isCrit }) => _spawnFloatText(dmg, isCrit ? 'crit' : 'player'));
    events.on('combatEnemyAttack',  ({ dmg }) => _spawnFloatText(dmg, 'enemy'));

    // M = toggle minimap, Tab = toggle automap
    document.addEventListener('keydown', e => {
        if (e.key === 'm' || e.key === 'M') _toggleMinimap();
        if (e.key === 'Tab') { e.preventDefault(); _toggleAutomap(); }
    });
}

// ============================================================
// Splash / overlays
// ============================================================

export function hideSplash() {
    if ($message) $message.classList.add('hidden');
    _showMinimap(true);
}

function _showGameOver() {
    if (!$message) return;
    $message.innerHTML = `
        <h1 style="color:#ff5050">YOU DIED</h1>
        <p>The crypt keeps another soul.</p>
        <p>Final Score: ${state.score}</p>
        <p style="opacity:0.6">Press R to restart &middot; ESC for menu</p>
    `;
    $message.classList.remove('hidden');
}

// ============================================================
// HP bar
// ============================================================

function _renderHP(cur, max) {
    if (!$hpNums) return;
    $hpNums.textContent = `${cur}/${max}`;
    const frac = max > 0 ? cur / max : 0;
    const isLow = frac <= 0.25;
    $hpNums.style.color = isLow ? 'var(--danger)' : '';

    // Animate bar toward target
    _hpTarget = frac;
    if (!_hpAnimId) _animateHP();

    // Low-HP vignette persistent pulse
    if ($vignette) {
        if (isLow) $vignette.classList.add('low-hp');
        else       $vignette.classList.remove('low-hp');
    }
}

function _animateHP() {
    const SPEED = 3.0;  // fraction per second
    let last = performance.now();
    function step(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const diff = _hpTarget - _hpDisplayed;
        if (Math.abs(diff) < 0.001) {
            _hpDisplayed = _hpTarget;
            _hpAnimId = null;
            _applyHPBar();
            return;
        }
        _hpDisplayed += diff * Math.min(SPEED * dt * 8, 1);
        _applyHPBar();
        _hpAnimId = requestAnimationFrame(step);
    }
    _hpAnimId = requestAnimationFrame(step);
}

function _applyHPBar() {
    if (!$hpFill) return;
    $hpFill.style.transform = `scaleX(${_hpDisplayed.toFixed(4)})`;
    const isLow = _hpTarget <= 0.25;
    if (isLow) $hpFill.classList.add('low');
    else       $hpFill.classList.remove('low');
}

// ============================================================
// Depth
// ============================================================

function _renderDepth(d) {
    if (!$depthVal) return;
    $depthVal.textContent = String(d);
    $depthVal.classList.remove('pop');
    // Force reflow to restart animation
    void $depthVal.offsetWidth;
    $depthVal.classList.add('pop');
}

// ============================================================
// Score (count-up)
// ============================================================

let _scoreDisplayed = 0;
let _scoreTarget    = 0;
let _scoreAnimId    = null;

function _renderScore(s) {
    _scoreTarget = s;
    if (!_scoreAnimId) _animateScore();
}

function _animateScore() {
    let last = performance.now();
    function step(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const diff = _scoreTarget - _scoreDisplayed;
        if (Math.abs(diff) < 1) {
            _scoreDisplayed = _scoreTarget;
            _scoreAnimId = null;
            if ($scoreVal) $scoreVal.textContent = String(_scoreDisplayed);
            return;
        }
        _scoreDisplayed += diff * Math.min(8 * dt, 1);
        if ($scoreVal) $scoreVal.textContent = String(Math.round(_scoreDisplayed));
        _scoreAnimId = requestAnimationFrame(step);
    }
    _scoreAnimId = requestAnimationFrame(step);
}

// ============================================================
// Compass
// ============================================================

function _renderCompass(facing) {
    if (!$compassDir) return;
    $compassDir.textContent = COMPASS_LABELS[facing] || 'N';
    // Rotate the compass label to reflect facing
    const rotMap = { 0: 0, 1: 90, 2: 180, 3: 270 };
    $compassDir.style.transform = `rotate(${rotMap[facing] || 0}deg)`;
}

// ============================================================
// Minimap / automap
// ============================================================

const MM_CELL  = MINIMAP_CELL;      // px per tile in minimap
const AM_CELL  = 14;                // px per tile in automap

function _showMinimap(show) {
    _minimapVisible = show;
    if ($minimapWrap) {
        if (show) $minimapWrap.classList.remove('hidden');
        else      $minimapWrap.classList.add('hidden');
    }
    if (show) _drawMinimap();
}

function _toggleMinimap() {
    _showMinimap(!_minimapVisible);
}

function _toggleAutomap() {
    _automapVisible = !_automapVisible;
    if ($automapOverlay) {
        if (_automapVisible) {
            $automapOverlay.classList.remove('hidden');
            _drawAutomap();
        } else {
            $automapOverlay.classList.add('hidden');
        }
    }
}

function _drawMinimap() {
    if (!_minimapVisible || !$minimapCtx || !grid.length) return;

    const w = gridW * MM_CELL;
    const h = gridH * MM_CELL;
    $minimapCanvas.width  = w;
    $minimapCanvas.height = h;
    _drawMap($minimapCtx, MM_CELL);
}

function _drawAutomap() {
    if (!$automapCtx || !grid.length) return;
    const w = gridW * AM_CELL;
    const h = gridH * AM_CELL;
    $automapCanvas.width  = w;
    $automapCanvas.height = h;
    _drawMap($automapCtx, AM_CELL);
}

function _drawMap(ctx, cell) {
    const visited = getVisited();
    const px = state.playerTile;
    const facing = state.facing;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let z = 0; z < gridH; z++) {
        for (let x = 0; x < gridW; x++) {
            const key = `${x},${z}`;
            const ch  = grid[z][x];
            const seen = visited.has(key);

            if (!seen) {
                // Fog of war — don't draw
                continue;
            }

            const rx = x * cell;
            const rz = z * cell;

            if (ch === '#') {
                ctx.fillStyle = 'rgba(120,110,100,0.9)';
            } else if (ch === '>') {
                ctx.fillStyle = 'rgba(100,200,255,0.9)';
            } else if (ch === 'S') {
                ctx.fillStyle = 'rgba(80,220,100,0.7)';
            } else {
                ctx.fillStyle = 'rgba(50,45,60,0.9)';
            }
            ctx.fillRect(rx, rz, cell, cell);

            // Tile outline
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(rx + 0.25, rz + 0.25, cell - 0.5, cell - 0.5);

            // Glyph markers
            if (cell >= 10) {
                ctx.font = `${Math.floor(cell * 0.55)}px Courier New`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                if (ch === '>') {
                    ctx.fillStyle = '#fff';
                    ctx.fillText('>', rx + cell / 2, rz + cell / 2);
                }
            }
        }
    }

    // Player arrow
    if (px) {
        const cx = px.x * cell + cell / 2;
        const cz = px.z * cell + cell / 2;
        const r  = cell * 0.38;

        ctx.save();
        ctx.translate(cx, cz);
        // facing: 0=N(-z)=up, 1=E(+x)=right, 2=S(+z)=down, 3=W(-x)=left
        const angleDeg = [270, 0, 90, 180][facing] || 0;
        ctx.rotate((angleDeg * Math.PI) / 180);

        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.6,  r * 0.7);
        ctx.lineTo(-r * 0.6, r * 0.7);
        ctx.closePath();
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
    }
}

// ============================================================
// Message log
// ============================================================

export function logMessage(text) {
    if (!$messageLog) return;
    const el = _logPool[_logNext % LOG_POOL_SIZE];
    _logNext++;
    el.textContent = text;
    el.classList.remove('show');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('show');

    // Auto-fade after LOG_DURATION
    clearTimeout(el._fadeTimer);
    el._fadeTimer = setTimeout(() => el.classList.remove('show'), LOG_DURATION);
}

// ============================================================
// Context-sensitive action hint
// ============================================================

export function updateActionHint(interactableAhead) {
    if (!$hintSearch) return;
    if (interactableAhead) $hintSearch.classList.add('visible');
    else                   $hintSearch.classList.remove('visible');
}

// ============================================================
// Juice: damage vignette & pickup flash
// ============================================================

export function showDamage() {
    if (!$vignette) return;
    $vignette.classList.remove('flash');
    void $vignette.offsetWidth;
    $vignette.classList.add('flash');
}

export function showPickup() {
    if (!$scoreVal) return;
    $scoreVal.classList.remove('flash');
    void $scoreVal.offsetWidth;
    $scoreVal.classList.add('flash');
}

// ============================================================
// Combat UI
// ============================================================

function _onCombatStarted({ monster }) {
    if (!$combatLayer) return;

    // Populate enemy nameplate
    $enemyIcon.textContent  = monster.icon || '☠';
    $enemyName.textContent  = monster.name.toUpperCase();
    $enemyStatus.textContent = '';
    _updateEnemyHp({ cur: monster.curHp, max: monster.hp, name: monster.name });

    // Turn order labels
    if ($turnEnemy) $turnEnemy.textContent = monster.name.toUpperCase();
    _updateCombatTurn({ turn: 'player' });

    // Show combat layer; hide exploration hints
    $combatLayer.classList.remove('hidden');
    if ($minimapWrap)  $minimapWrap.classList.add('hidden');
    if ($hintSearch)   $hintSearch.classList.remove('visible');

    // Enable buttons
    _setCombatButtonsEnabled(true);
}

function _onCombatEnded({ result }) {
    if (!$combatLayer) return;
    $combatLayer.classList.add('hidden');

    // Restore exploration HUD
    if (_minimapVisible && $minimapWrap) $minimapWrap.classList.remove('hidden');

    // Clear combat log pool
    _combatLogPool.forEach(el => { el.classList.remove('show'); clearTimeout(el._fadeTimer); });
    _combatLogNext = 0;

    if (result === 'win') {
        logMessage('You are victorious!');
    } else if (result === 'flee') {
        logMessage('You escape into the darkness...');
    }
}

function _updateEnemyHp({ cur, max }) {
    if (!$enemyHpFill) return;
    const frac = max > 0 ? cur / max : 0;
    $enemyHpFill.style.transform = `scaleX(${frac.toFixed(4)})`;
    if ($enemyHpNums) $enemyHpNums.textContent = `♥ ${cur}/${max}`;

    // Status word
    if ($enemyStatus) {
        if (frac <= 0)        $enemyStatus.textContent = 'dead';
        else if (frac < 0.25) $enemyStatus.textContent = 'critical';
        else if (frac < 0.55) $enemyStatus.textContent = 'hurt';
        else                  $enemyStatus.textContent = '';
    }
}

function _updateCombatTurn({ turn }) {
    if (!$combatTurnBanner) return;
    if (turn === 'player') {
        $combatTurnBanner.textContent = '✦ YOUR TURN ✦';
        $combatTurnBanner.classList.remove('enemy-turn');
        if ($turnYou)   $turnYou.classList.add('active');
        if ($turnEnemy) $turnEnemy.classList.remove('active');
        _setCombatButtonsEnabled(true);
    } else {
        $combatTurnBanner.textContent = 'ENEMY TURN';
        $combatTurnBanner.classList.add('enemy-turn');
        if ($turnYou)   $turnYou.classList.remove('active');
        if ($turnEnemy) $turnEnemy.classList.add('active');
        _setCombatButtonsEnabled(false);
    }
}

function _setCombatButtonsEnabled(enabled) {
    if (!$combatActionBar) return;
    $combatActionBar.querySelectorAll('.combat-btn').forEach(btn => {
        if (enabled) btn.classList.remove('disabled');
        else         btn.classList.add('disabled');
    });
}

function _addCombatLog(text) {
    if (!$combatLog) return;
    const el = _combatLogPool[_combatLogNext % COMBAT_LOG_POOL];
    _combatLogNext++;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(el._fadeTimer);
    el._fadeTimer = setTimeout(() => el.classList.remove('show'), COMBAT_LOG_DUR);
}

function _spawnFloatText(dmg, kind) {
    // Position roughly in the center of the screen (where the enemy is in view)
    const el = document.createElement('div');
    el.className = 'float-text';
    if (kind === 'crit')   el.classList.add('crit');
    else if (kind === 'enemy') el.classList.add('enemy');
    el.textContent = kind === 'crit' ? `CRIT ${dmg}!` : `-${dmg}`;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    el.style.left = `${vw / 2 - 30 + (Math.random() - 0.5) * 80}px`;
    el.style.top  = `${vh * 0.38 + (Math.random() - 0.5) * 40}px`;

    document.getElementById('ui-overlay').appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}
