/**
 * combat.js — Turn-based combat loop for Phase 5.
 *
 * Flow:
 *   startCombat(monsterId)  — called from main.js on tileEntered with 'M' tile
 *   Player chooses ATTACK(1) / DEFEND(2) / ITEM(3) / FLEE(4)
 *   Combat resolves: player acts → enemy acts → repeat until one side is dead/fled
 *
 * Events emitted:
 *   combatStarted  { monster }         — UI shows combat layer
 *   combatEnded    { result, monster }  result: 'win'|'lose'|'flee'
 *   combatLog      string               — floating combat text / message
 *   hpChanged      { cur, max }         — forwarded from state changes
 *   enemyHpChanged { cur, max, name }   — enemy HP for UI bar
 *
 * Events consumed:
 *   combatAction   { action }           action: 'attack'|'defend'|'item'|'flee'
 *
 * The module is self-contained: call initCombat() once in main.js to wire it up,
 * then call startCombat(monsterId) when entering an 'M' tile.
 */

import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { state }   from './state.js';
import { events }  from './events.js';
import { MONSTERS, ITEMS, TILE_SIZE, DIRS } from './config.js';
import { playSwordSwing, playMonsterHit, playCombatStart, playSuccess, playFailure, playUiClick } from './sounds.js';

// ── Combat state ─────────────────────────────────────────────

let _active  = false;    // true while in combat
let _monster = null;     // current monster instance { ...def, curHp }
let _defending = false;  // player chose Defend last turn
let _turn = 'player';    // 'player' | 'enemy'

// Billboard sprite
let _billboard = null;   // { mesh, mat, canvas, ctx, hitT }

export function isInCombat() { return _active; }

// ── Billboard helpers ────────────────────────────────────────

const SPRITE_PX = 256;   // canvas texture resolution

// Draws the monster sprite onto the canvas. hit=true flashes red.
function _drawMonsterSprite(ctx, monster, hpFrac, hit) {
    const S = SPRITE_PX;
    ctx.clearRect(0, 0, S, S);

    // Background — subtle dark panel
    ctx.fillStyle = hit ? 'rgba(200,40,40,0.25)' : 'rgba(10,8,20,0.55)';
    ctx.fillRect(0, 0, S, S);

    // Silhouette shape varies by monster type
    const id = monster.id;
    const bodyColor = hit ? '#ff7070'
                   : id === 'wraith'   ? '#8090c8'
                   : id === 'skeleton' ? '#d8d0b8'
                   : '#a88060';          // ghoul

    if (id === 'skeleton') {
        _drawSkeleton(ctx, S, bodyColor);
    } else if (id === 'wraith') {
        _drawWraith(ctx, S, bodyColor);
    } else {
        _drawGhoul(ctx, S, bodyColor);
    }

    // HP bar along the bottom of the sprite (matches nameplate bar)
    const barH = 10, barY = S - barH - 6, barX = 20, barW = S - 40;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpFrac > 0.5 ? '#dc5050' : hpFrac > 0.25 ? '#e08030' : '#ff3030';
    ctx.fillRect(barX, barY, barW * hpFrac, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
}

function _drawSkeleton(ctx, S, c) {
    // Skull
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(S/2, 68, 38, 42, 0, 0, Math.PI*2); ctx.fill();
    // Eye sockets
    ctx.fillStyle = 'rgba(10,8,20,0.9)';
    ctx.beginPath(); ctx.ellipse(S/2 - 14, 64, 10, 13, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S/2 + 14, 64, 10, 13,  0.2, 0, Math.PI*2); ctx.fill();
    // Nose cavity
    ctx.beginPath(); ctx.moveTo(S/2, 82); ctx.lineTo(S/2 - 5, 92); ctx.lineTo(S/2 + 5, 92); ctx.closePath(); ctx.fill();
    // Jaw teeth
    ctx.fillStyle = c;
    ctx.fillRect(S/2 - 22, 100, 44, 14);
    ctx.fillStyle = 'rgba(10,8,20,0.9)';
    for (let i = 0; i < 5; i++) ctx.fillRect(S/2 - 20 + i * 9, 100, 4, 14);
    // Ribcage body
    ctx.fillStyle = c;
    ctx.fillRect(S/2 - 24, 120, 48, 62);
    ctx.fillStyle = 'rgba(10,8,20,0.75)';
    for (let r = 0; r < 4; r++) {
        ctx.beginPath(); ctx.ellipse(S/2, 134 + r * 14, 22, 5, 0, 0, Math.PI); ctx.fill();
    }
    // Arms
    ctx.fillStyle = c;
    ctx.fillRect(S/2 - 48, 122, 20, 52);
    ctx.fillRect(S/2 + 28, 122, 20, 52);
    // Leg bones
    ctx.fillRect(S/2 - 22, 182, 16, 48);
    ctx.fillRect(S/2 + 6,  182, 16, 48);
}

function _drawGhoul(ctx, S, c) {
    // Hunched body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(S/2, 105, 44, 58, 0.15, 0, Math.PI*2);
    ctx.fill();
    // Head (bigger, more bestial)
    ctx.beginPath(); ctx.ellipse(S/2 - 6, 56, 36, 40, -0.2, 0, Math.PI*2); ctx.fill();
    // Sunken eyes — glowing
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.ellipse(S/2 - 18, 50, 9, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S/2 + 8,  52, 9, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(10,8,20,0.8)';
    ctx.beginPath(); ctx.ellipse(S/2 - 18, 50, 5, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S/2 + 8,  52, 5, 6, 0, 0, Math.PI*2); ctx.fill();
    // Clawed arms
    ctx.fillStyle = c;
    ctx.fillRect(S/2 - 58, 98, 18, 56);
    ctx.fillRect(S/2 + 40, 102, 18, 50);
    // Claws
    for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(S/2 - 58 + i * 7, 154); ctx.lineTo(S/2 - 62 + i * 7, 172); ctx.lineTo(S/2 - 54 + i * 7, 154); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(S/2 + 40 + i * 7, 152); ctx.lineTo(S/2 + 36 + i * 7, 170); ctx.lineTo(S/2 + 44 + i * 7, 152); ctx.closePath(); ctx.fill();
    }
    // Legs
    ctx.fillRect(S/2 - 26, 158, 20, 52);
    ctx.fillRect(S/2 + 6,  162, 20, 48);
}

function _drawWraith(ctx, S, c) {
    // Wispy ghostly form — semi-transparent layers
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(S/2, 140, 58, 90, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.ellipse(S/2, 120, 44, 72, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1.0;
    // Core cowl / hood
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(S/2, 72, 34, 40, 0, 0, Math.PI*2); ctx.fill();
    // Deep void eyes
    ctx.fillStyle = '#64c8ff';
    ctx.shadowColor = '#64c8ff'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.ellipse(S/2 - 12, 68, 9, 11, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S/2 + 12, 68, 9, 11, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Trailing wispy tendrils at bottom
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
        const tx = S/2 - 40 + i * 20;
        ctx.beginPath(); ctx.moveTo(tx, 180); ctx.quadraticCurveTo(tx + 8, 210, tx + 4, 230); ctx.lineTo(tx - 4, 230); ctx.quadraticCurveTo(tx - 8, 210, tx, 180); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    // Arms — dark sweeping wings
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(S/2 - 30, 100); ctx.quadraticCurveTo(S/2 - 80, 120, S/2 - 72, 160); ctx.lineTo(S/2 - 48, 148); ctx.quadraticCurveTo(S/2 - 52, 120, S/2 - 26, 110); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(S/2 + 30, 100); ctx.quadraticCurveTo(S/2 + 80, 120, S/2 + 72, 160); ctx.lineTo(S/2 + 48, 148); ctx.quadraticCurveTo(S/2 + 52, 120, S/2 + 26, 110); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1.0;
}

function _spawnBillboard(monster) {
    const canvas = document.createElement('canvas');
    canvas.width  = SPRITE_PX;
    canvas.height = SPRITE_PX;
    const ctx = canvas.getContext('2d');

    _drawMonsterSprite(ctx, monster, 1.0, false);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.04,
        depthWrite:  false,
        side:        THREE.DoubleSide,
    });

    // Sprite size: 2.2 × 2.2 world units. At the placement distance of 1.8 units this fills
    // ~55% of view height at FOV 75 — a visible looming figure without overfilling the screen.
    const geo  = new THREE.PlaneGeometry(2.2, 2.2);
    const mesh = new THREE.Mesh(geo, mat);

    // The player just stepped onto the monster's tile. Place billboard 1.8 units in front
    // of the player — safely within the current tile (half-tile boundary = 2.0 units).
    const { dx, dz } = DIRS[state.facing];
    mesh.position.set(
        state.playerTile.x * TILE_SIZE + dx * 1.8,
        1.6,   // eye height
        state.playerTile.z * TILE_SIZE + dz * 1.8
    );

    scene.add(mesh);
    _billboard = { mesh, mat, tex, canvas, ctx, hitT: 0 };
}

function _removeBillboard() {
    if (!_billboard) return;
    scene.remove(_billboard.mesh);
    _billboard.mesh.geometry.dispose();
    _billboard.mat.dispose();
    _billboard.tex.dispose();
    _billboard = null;
}

// Call each frame to keep billboard facing the camera and handle hit-flash.
export function updateCombat(dt) {
    if (!_billboard) return;
    // Always face the camera (billboard)
    _billboard.mesh.quaternion.copy(camera.quaternion);

    // Hit-flash decay
    if (_billboard.hitT > 0 && _monster) {
        _billboard.hitT = Math.max(0, _billboard.hitT - dt / 0.18);
        const hpFrac = _monster.curHp / _monster.hp;
        _drawMonsterSprite(_billboard.ctx, _monster, hpFrac, _billboard.hitT > 0);
        _billboard.tex.needsUpdate = true;
    }
}

// ── Public API ───────────────────────────────────────────────

export function initCombat() {
    events.on('combatAction', ({ action }) => {
        if (!_active || _turn !== 'player') return;
        _playerAction(action);
    });
}

export function startCombat(monsterId) {
    if (_active) return;
    const def = MONSTERS[monsterId];
    if (!def) return;

    _monster   = { ...def, curHp: def.hp };
    _defending = false;
    _turn      = 'player';
    _active    = true;

    _spawnBillboard(_monster);
    events.emit('combatStarted', { monster: _monster });
    playCombatStart();
    events.emit('combatLog', `A ${_monster.name} blocks your path!`);
    events.emit('enemyHpChanged', { cur: _monster.curHp, max: _monster.hp, name: _monster.name });
}

// ── Player action ────────────────────────────────────────────

function _playerAction(action) {
    _defending = false;

    if (action === 'attack') {
        _playerAttack();
    } else if (action === 'defend') {
        _defending = true;
        events.emit('combatLog', 'You brace for the attack. (DEF +3)');
        _scheduleEnemyTurn();
    } else if (action === 'item') {
        const healPotion = state.inventory.find(id => {
            const def = ITEMS[id];
            return def && def.type === 'consumable' && def.heal > 0;
        });
        if (healPotion) {
            const def = ITEMS[healPotion];
            const heal = Math.min(def.heal, state.hpMax - state.hp);
            if (heal > 0) {
                state.hp += heal;
                state.removeItem(healPotion);
                events.emit('combatLog', `Used ${def.name}: +${heal} HP`);
            } else {
                events.emit('combatLog', 'Already at full HP!');
            }
        } else {
            events.emit('combatLog', 'No usable items!');
        }
        _scheduleEnemyTurn();
    } else if (action === 'flee') {
        // 50% chance to flee
        if (Math.random() < 0.5) {
            events.emit('combatLog', 'You flee into the dark!');
            _endCombat('flee');
        } else {
            events.emit('combatLog', 'You cannot escape!');
            _scheduleEnemyTurn();
        }
    }
}

function _playerAttack() {
    const raw    = state.atk + Math.floor(Math.random() * 4);   // ATK + d4
    const dmg    = Math.max(1, raw - _monster.def);
    _monster.curHp = Math.max(0, _monster.curHp - dmg);

    const isCrit = dmg >= state.atk + 3;
    if (isCrit) {
        events.emit('combatLog', `CRITICAL HIT! You deal ${dmg} damage!`);
    } else {
        events.emit('combatLog', `You strike the ${_monster.name} for ${dmg} damage.`);
    }
    playSwordSwing();
    // Flash the billboard red on hit; it will redraw with updated HP during the flash
    if (_billboard) {
        _billboard.hitT = 1.0;
        _drawMonsterSprite(_billboard.ctx, _monster, _monster.curHp / _monster.hp, true);
        _billboard.tex.needsUpdate = true;
    }
    events.emit('enemyHpChanged', { cur: _monster.curHp, max: _monster.hp, name: _monster.name });
    events.emit('combatPlayerAttack', { dmg, isCrit });

    if (_monster.curHp <= 0) {
        _endCombat('win');
    } else {
        _scheduleEnemyTurn();
    }
}

// ── Enemy turn ───────────────────────────────────────────────

function _scheduleEnemyTurn() {
    _turn = 'enemy';
    // Short delay so the player can read the combat log before enemy acts
    setTimeout(_enemyTurn, 900);
}

function _enemyTurn() {
    if (!_active) return;
    const raw = _monster.atk + Math.floor(Math.random() * 3);   // ATK + d3
    const def = state.def + (_defending ? 3 : 0);
    const dmg = Math.max(0, raw - def);

    if (dmg === 0) {
        events.emit('combatLog', `${_monster.name} attacks — you block it!`);
    } else {
        events.emit('combatLog', `${_monster.name} hits you for ${dmg} damage!`);
        state.hp -= dmg;
        playMonsterHit();
        events.emit('damageTaken');
        events.emit('combatEnemyAttack', { dmg });
    }

    if (state.hp <= 0) {
        _endCombat('lose');
    } else {
        _turn = 'player';
        events.emit('combatTurnChanged', { turn: 'player' });
    }
}

// ── End combat ───────────────────────────────────────────────

function _endCombat(result) {
    _active = false;

    if (result === 'win') {
        state.addScore(_monster.xp);
        playSuccess();
        events.emit('combatLog', `Victory! +${_monster.xp} XP`);
    } else if (result === 'flee') {
        playUiClick();
    } else if (result === 'lose') {
        playFailure();
    }

    _removeBillboard();
    const monster = _monster;
    _monster = null;
    events.emit('combatEnded', { result, monster });
}
