/**
 * battleRenderer.js — Draw party sprites, enemy sprites, HP bars,
 * floating damage numbers, and hit-flash animations.
 *
 * Call initBattleRenderer(k) once in 'game' scene setup.
 * Listens for events: battleStart, animateAction, combatantDied,
 *                     clearOverlay, battleStart (re-draw on new battle)
 */

import { events }  from './events.js';
import { state }   from './state.js';
import { COLORS, BATTLE, GAME_WIDTH, GAME_HEIGHT, ENCOUNTERS } from './config.js';

let _k = null;

// Sprite entity maps  classId/id → entity
const _partySprites  = new Map();
const _enemySprites  = new Map();
const _enemyHpBars   = new Map();   // id → { bg, fill, label }
const _overlayEnts   = [];          // victory overlay entities for cleanup

// ----------------------------------------------------------------
// Init
// ----------------------------------------------------------------

export function initBattleRenderer(kaplay) {
    _k = kaplay;

    const off1 = events.on('battleReady',    _onBattleReady);
    const off2 = events.on('animateAction',  _onAnimateAction);
    const off3 = events.on('combatantDied',  _onCombatantDied);
    const off4 = events.on('clearOverlay',   _clearOverlayEnts);

    _k.onSceneLeave(() => { off1(); off2(); off3(); off4(); });
}

// ----------------------------------------------------------------
// Background / region panel
// ----------------------------------------------------------------

function _drawBackground(region, isBoss) {
    _k.destroyAll('battleBg');

    // Main battlefield area (above the bottom panels)
    const bgColor = isBoss ? [0, 0, 0] : [0, 0, 0];
    _k.add([
        _k.pos(0, 36),
        _k.rect(GAME_WIDTH, BATTLE.PANEL_Y - 36),
        _k.color(...bgColor),
        _k.z(1),
        'battleBg',
    ]);

    // Region label
    _k.add([
        _k.pos(GAME_WIDTH / 2, 52),
        _k.text(region, { size: 14 }),
        _k.color(100, 90, 150),
        _k.anchor('center'),
        _k.z(5),
        'battleBg',
    ]);

    // Ground line
    _k.add([
        _k.pos(60, BATTLE.PANEL_Y - 20),
        _k.rect(GAME_WIDTH - 120, 2),
        _k.color(60, 50, 80),
        _k.z(5),
        'battleBg',
    ]);
}

// ----------------------------------------------------------------
// Party sprites (left side, fixed positions)
// ----------------------------------------------------------------

// Per-hero config: natural aspect ratio (w/h) and whether to flip to face right.
// Images have black JPEG backgrounds; additive blend makes black invisible.
// Height is fixed at HERO_H; width is derived from the natural aspect ratio.
// Front row (warrior, rogue) are larger to convey depth
const HERO_DEFS = {
    warrior: { sprite: 'warrior', ratio: 562 / 423, flip: true,  h: 130 },
    mage:    { sprite: 'mage',    ratio: 550 / 583, flip: true,  h: 105 },
    healer:  { sprite: 'healer',  ratio: 472 / 634, flip: false, h: 105 },
    rogue:   { sprite: 'rogue',   ratio: 654 / 519, flip: true,  h: 130 },
};

function _drawPartySprites() {
    _k.destroyAll('partySprite');
    _partySprites.clear();

    state.party.forEach((member, i) => {
        const x    = BATTLE.PARTY_X[i];
        const y    = BATTLE.PARTY_Y[i];
        const def   = HERO_DEFS[member.classId];
        const heroH = def.h;
        const heroW = Math.round(heroH * def.ratio);

        // Hero image — additive blend makes the black JPEG background invisible.
        // flip: k.scale(-1, 1) mirrors on X so characters face right toward enemies.
        const sprite = _k.add([
            _k.pos(x, y),
            _k.sprite(def.sprite, { width: heroW, height: heroH }),
            _k.color(255, 255, 255),
            _k.scale(def.flip ? -1 : 1, 1),
            _k.anchor('center'),
            _k.opacity(member.isKO ? 0.3 : 1),
            _k.blend('add'),
            _k.z(10),
            'partySprite',
        ]);

        // Name label beneath
        _k.add([
            _k.pos(x, y + heroH / 2 + 4),
            _k.text(member.name, { size: 10 }),
            _k.color(...member.color),
            _k.anchor('top'),
            _k.z(11),
            'partySprite',
        ]);

        _partySprites.set(member.classId, sprite);
    });
}

// ----------------------------------------------------------------
// Enemy sprites (right side)
// ----------------------------------------------------------------

// Natural image dimensions (w×h px) — used to preserve aspect ratio.
// Height is fixed at BATTLE.ENEMY_H; width is derived from ratio.
const ENEMY_RATIOS = {
    goblin:    617 / 499,
    skeleton:  528 / 526,
    orc:       598 / 449,
    darkElf:   654 / 540,
    golem:     780 / 651,
    dragon:    854 / 790,
    lichKing:  867 / 677,
};

function _drawEnemySprites() {
    _k.destroyAll('enemySprite');
    _enemySprites.clear();
    _enemyHpBars.clear();

    state.enemies.forEach((enemy, i) => {
        const x     = BATTLE.ENEMY_X[i] ?? (BATTLE.ENEMY_X[0] + i * 160);
        const y     = BATTLE.ENEMY_Y[i] ?? BATTLE.ENEMY_Y[0];
        const h     = BATTLE.ENEMY_H;
        const ratio = ENEMY_RATIOS[enemy.type] ?? 1;
        const w     = Math.round(h * ratio);
        // Per-enemy tag so all its entities can be destroyed together on death
        const etag = `enemySlot_${enemy.id}`;

        // Body — sprite image with additive blend (makes black JPEG background invisible)
        const sprite = _k.add([
            _k.pos(x, y),
            _k.sprite(enemy.type, { width: w, height: h }),
            _k.color(255, 255, 255),
            _k.anchor('center'),
            _k.opacity(1),
            _k.blend('add'),
            _k.z(10),
            'enemySprite',
            etag,
        ]);

        // Name label beneath sprite
        _k.add([
            _k.pos(x, y + h / 2 + 6),
            _k.text(enemy.name, { size: 10 }),
            _k.color(...enemy.color),
            _k.anchor('top'),
            _k.z(11),
            'enemySprite',
            etag,
        ]);

        // HP bar (always visible for enemies)
        const hpBarY = y - h / 2 - 14;
        const hpBarW = w + 20;

        _k.add([
            _k.pos(x, hpBarY),
            _k.rect(hpBarW, 8),
            _k.color(40, 10, 10),
            _k.anchor('center'),
            _k.z(11),
            'enemySprite',
            etag,
        ]);

        const fill = _k.add([
            _k.pos(x - hpBarW / 2, hpBarY - 4),
            _k.rect(hpBarW, 8),
            _k.color(...COLORS.danger),
            _k.anchor('topleft'),
            _k.z(12),
            'enemySprite',
            etag,
        ]);

        const label = _k.add([
            _k.pos(x, hpBarY - 14),
            _k.text(`${enemy.hp}/${enemy.maxHp}`, { size: 9 }),
            _k.color(...COLORS.text),
            _k.anchor('center'),
            _k.z(12),
            'enemySprite',
            etag,
        ]);

        _enemySprites.set(enemy.id, sprite);
        _enemyHpBars.set(enemy.id, { fill, label, maxW: hpBarW, maxHp: enemy.maxHp });
    });
}

// ----------------------------------------------------------------
// Update enemy HP bar
// ----------------------------------------------------------------

function _refreshEnemyHpBar(enemyId) {
    const enemy = state.enemies.find(e => e.id === enemyId);
    const bar   = _enemyHpBars.get(enemyId);
    if (!enemy || !bar) return;

    const frac = Math.max(0, enemy.hp / bar.maxHp);
    bar.fill.width = Math.round(bar.maxW * frac);
    bar.label.text = `${Math.max(0, enemy.hp)}/${bar.maxHp}`;
}

// ----------------------------------------------------------------
// Battle start handler
// ----------------------------------------------------------------

// Called after battle.js has populated state.enemies
function _onBattleReady() {
    const enc = ENCOUNTERS[state.encounterIndex] ?? { region: 'Battle', isBoss: false };
    _drawBackground(enc.region, enc.isBoss ?? false);
    _drawPartySprites();
    _drawEnemySprites();
}

// ----------------------------------------------------------------
// Animate action handler
// ----------------------------------------------------------------

function _onAnimateAction(data) {
    if (data.type === 'hit' || data.type === 'magic') {
        // Slide the actor forward toward their target
        const actorSprite = _partySprites.get(data.actorId) ??
                            _enemySprites.get(data.actorId);
        if (actorSprite) {
            const isParty = _partySprites.has(data.actorId);
            _slideSprite(actorSprite, isParty ? 40 : -40);
        }

        // Shudder + flash the target
        const targetSprite = _enemySprites.get(data.targetId) ??
                             _partySprites.get(data.targetId);
        if (targetSprite) {
            _flashSprite(targetSprite);
            _shudderSprite(targetSprite);
        }

        // Floating damage number
        const pos = _getSpritePos(data.targetId);
        if (pos) _floatNumber(data.value, pos.x, pos.y, COLORS.danger);

        // Refresh HP bar if enemy
        _refreshEnemyHpBar(data.targetId);
    }

    if (data.type === 'enemyHit') {
        _refreshEnemyHpBar(data.targetId);
    }
}

// ----------------------------------------------------------------
// Combatant died handler
// ----------------------------------------------------------------

function _onCombatantDied(combatant) {
    if (combatant.isEnemy) {
        // Brief delay then destroy all entities belonging to this enemy
        _k.wait(0.4, () => {
            _k.destroyAll(`enemySlot_${combatant.id}`);
            _enemySprites.delete(combatant.id);
            _enemyHpBars.delete(combatant.id);
        });
    } else {
        // Party member KO — dim sprite
        const sprite = _partySprites.get(combatant.classId);
        if (sprite) sprite.opacity = 0.25;
    }
}

// ----------------------------------------------------------------
// Hit flash helper
// ----------------------------------------------------------------

function _flashSprite(sprite) {
    let timer  = 0;
    let done   = false;
    const orig = [sprite.color.r, sprite.color.g, sprite.color.b];
    // For sprite entities tinted white (255,255,255), flash red; otherwise flash white
    const isWhiteTint = orig[0] === 255 && orig[1] === 255 && orig[2] === 255;
    const flashColor = isWhiteTint ? [255, 80, 80] : [255, 255, 255];

    const handle = sprite.onUpdate(() => {
        if (done) return;
        timer += _k.dt();
        const t = Math.min(timer / 0.15, 1);
        if (t < 0.5) {
            sprite.color = _k.rgb(...flashColor);
        } else {
            sprite.color = _k.rgb(orig[0], orig[1], orig[2]);
            done = true;
            handle.cancel();
        }
    });
}

// ----------------------------------------------------------------
// Attack slide helper — slides sprite dx pixels forward then back
// ----------------------------------------------------------------

function _slideSprite(sprite, dx) {
    const origin = { x: sprite.pos.x, y: sprite.pos.y };
    let timer = 0;
    let done  = false;
    const DUR = 0.18; // total duration seconds

    const handle = sprite.onUpdate(() => {
        if (done) return;
        timer += _k.dt();
        const t = Math.min(timer / DUR, 1);
        // ease out-in: go forward first half, return second half
        const offset = t < 0.5
            ? dx * (t / 0.5)
            : dx * (1 - (t - 0.5) / 0.5);
        sprite.pos = _k.vec2(origin.x + offset, origin.y);
        if (t >= 1) {
            sprite.pos = _k.vec2(origin.x, origin.y);
            done = true;
            handle.cancel();
        }
    });
}

// ----------------------------------------------------------------
// Hit shudder helper — rapid left/right shake
// ----------------------------------------------------------------

function _shudderSprite(sprite) {
    const origin = { x: sprite.pos.x, y: sprite.pos.y };
    let timer = 0;
    let done  = false;
    const DUR = 0.25;
    const AMP = 6; // px

    const handle = sprite.onUpdate(() => {
        if (done) return;
        timer += _k.dt();
        const t = Math.min(timer / DUR, 1);
        const decay = 1 - t;
        const offset = Math.sin(timer * 80) * AMP * decay;
        sprite.pos = _k.vec2(origin.x + offset, origin.y);
        if (t >= 1) {
            sprite.pos = _k.vec2(origin.x, origin.y);
            done = true;
            handle.cancel();
        }
    });
}

// ----------------------------------------------------------------
// Floating damage number
// ----------------------------------------------------------------

function _floatNumber(value, x, y, color) {
    const label = _k.add([
        _k.pos(x, y - 20),
        _k.text(`${value}`, { size: 18 }),
        _k.color(...color),
        _k.anchor('center'),
        _k.opacity(1),
        _k.z(50),
    ]);

    let timer = 0;
    label.onUpdate(() => {
        timer += _k.dt();
        label.pos = _k.vec2(x, y - 20 - timer * 50);
        label.opacity = Math.max(0, 1 - timer / 0.8);
        if (timer > 0.8) _k.destroy(label);
    });
}

// ----------------------------------------------------------------
// Overlay entity cleanup (between battles)
// ----------------------------------------------------------------

function _clearOverlayEnts() {
    for (const e of _overlayEnts) {
        if (e.exists()) _k.destroy(e);
    }
    _overlayEnts.length = 0;
    // Also re-draw party sprites in case any were dimmed from prior battle
    if (state.inBattle === false) {
        _drawPartySprites();
    }
}

// ----------------------------------------------------------------
// Helper: get screen position of a combatant sprite
// ----------------------------------------------------------------

function _getSpritePos(id) {
    const s = _enemySprites.get(id) ?? _partySprites.get(id);
    return s ? { x: s.pos.x, y: s.pos.y } : null;
}

// ----------------------------------------------------------------
// Public: redraw party sprites (e.g. after level-up)
// ----------------------------------------------------------------

export function redrawPartySprites() {
    _drawPartySprites();
}
