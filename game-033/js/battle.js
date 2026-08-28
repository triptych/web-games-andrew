/**
 * battle.js — light turn-based encounter system.
 * Rendered on a <canvas> overlay (the one part of this "custom engine"
 * that isn't DOM, per the game-plan's split between VN-as-DOM and
 * battle-as-canvas). Resolves in a handful of turns based on stats.
 *
 * Flow: dialogueEngine emits 'battleRequested' -> this module takes over
 * the screen, then emits 'battleWon' / 'battleLost' so dialogueEngine can
 * branch the story to node.onWin / node.onLose.
 */

import { state } from './state.js';
import { events } from './events.js';
import { ENEMY_DEFS, ITEM_DEFS } from './config.js';
import { playHit, playSuccess, playFailure, playUiClick } from './sounds.js';
import { goToNode } from './dialogueEngine.js';

let canvas, ctx;
let $screen, $log, $menu;
let enemy = null;
let onWinNode = null;
let onLoseNode = null;
let playerHp, playerMaxHp, enemyHp, enemyMaxHp;
let busy = false;

export function initBattle() {
    $screen = document.getElementById('battle-screen');
    canvas  = document.getElementById('battle-canvas');
    ctx     = canvas.getContext('2d');
    $log    = document.getElementById('battle-log');
    $menu   = document.getElementById('battle-menu');

    events.on('battleRequested', startBattle);
}

function startBattle({ enemyId, onWin, onLose }) {
    enemy = { ...ENEMY_DEFS[enemyId] };
    onWinNode = onWin;
    onLoseNode = onLose;

    playerMaxHp = state.effectiveStats.maxHp;
    playerHp = state.stats.hp > 0 ? state.stats.hp : playerMaxHp;
    enemyMaxHp = enemy.hp;
    enemyHp = enemy.hp;
    busy = false;

    $screen.classList.remove('hidden');
    logLine(`A wild ${enemy.name} appears!`);
    buildMenu();
    draw();
}

function buildMenu() {
    $menu.innerHTML = '';
    $menu.appendChild(makeBtn('Attack', () => playerTurn('attack')));
    $menu.appendChild(makeBtn('Use Honey Tonic', () => playerTurn('item'), !state.hasItem('honey_tonic')));
    if (enemy.fleeable) {
        $menu.appendChild(makeBtn('Flee', () => playerTurn('flee')));
    }
}

function makeBtn(label, onClick, disabled = false) {
    const btn = document.createElement('button');
    btn.className = 'battle-menu-btn';
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => {
        if (busy || disabled) return;
        playUiClick();
        onClick();
    });
    return btn;
}

function playerTurn(action) {
    busy = true;
    const stats = state.effectiveStats;

    if (action === 'attack') {
        const dmg = 3 + Math.floor(stats.strength * 1.5) + Math.floor(Math.random() * 3);
        enemyHp = Math.max(0, enemyHp - dmg);
        logLine(`You strike the ${enemy.name} for ${dmg} damage.`);
        playHit();
    } else if (action === 'item') {
        const def = ITEM_DEFS.honey_tonic;
        state.removeItem('honey_tonic', 1);
        playerHp = Math.min(playerMaxHp, playerHp + def.heal);
        logLine(`You drink a Honey Tonic and recover ${def.heal} HP.`);
    } else if (action === 'flee') {
        const fleeChance = 0.4 + stats.wit * 0.05;
        if (Math.random() < fleeChance) {
            logLine('You slip away safely.');
            draw();
            setTimeout(() => endBattle(false, true), 700);
            return;
        } else {
            logLine('You couldn’t get away!');
        }
    }

    draw();

    if (enemyHp <= 0) {
        setTimeout(() => onEnemyDefeated(), 500);
        return;
    }

    setTimeout(enemyTurn, 700);
}

function enemyTurn() {
    const dmg = Math.max(1, enemy.strength + Math.floor(Math.random() * 2) - 1);
    playerHp = Math.max(0, playerHp - dmg);
    logLine(`The ${enemy.name} hits you for ${dmg} damage.`);
    playHit();
    draw();

    if (playerHp <= 0) {
        setTimeout(() => onPlayerDefeated(), 500);
        return;
    }
    busy = false;
}

function onEnemyDefeated() {
    logLine(`The ${enemy.name} is defeated!`);
    playSuccess();
    state.setHp(playerHp);
    if (enemy.xp) state.addXp(enemy.xp);
    setTimeout(() => endBattle(true), 900);
}

function onPlayerDefeated() {
    logLine('You can’t continue...');
    playFailure();
    state.setHp(0);
    setTimeout(() => endBattle(false), 900);
}

function endBattle(won, fled = false) {
    $screen.classList.add('hidden');
    if (!fled) state.setHp(Math.max(1, playerHp)); // never store 0 permanently; light-stakes cozy game
    events.emit(won ? 'battleWon' : 'battleLost', enemy);
    const nextId = won ? onWinNode : onLoseNode;
    if (nextId) goToNode(nextId);
    enemy = null;
}

function logLine(text) {
    const line = document.createElement('div');
    line.textContent = text;
    $log.appendChild(line);
    $log.scrollTop = $log.scrollHeight;
}

function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#14101c';
    ctx.fillRect(0, 0, w, h);

    // Enemy
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(enemy.icon, w * 0.7, h * 0.45);
    drawBar(w * 0.7 - 60, h * 0.55, 120, 14, enemyHp / enemyMaxHp, '#d1495b');
    ctx.fillStyle = '#f0e9da';
    ctx.font = '14px monospace';
    ctx.fillText(enemy.name, w * 0.7, h * 0.62);

    // Player
    ctx.font = '56px sans-serif';
    ctx.fillText('🧑', w * 0.25, h * 0.5);
    drawBar(w * 0.25 - 60, h * 0.58, 120, 14, playerHp / playerMaxHp, '#7fb069');
    ctx.fillStyle = '#f0e9da';
    ctx.font = '14px monospace';
    ctx.fillText(`HP ${playerHp}/${playerMaxHp}`, w * 0.25, h * 0.65);
}

function drawBar(x, y, w, h, pct, color) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
    ctx.strokeStyle = '#f0e9da';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
}
