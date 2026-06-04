/**
 * ui.js — DOM HUD bindings. The HUD lives in index.html as fixed DOM elements;
 * this module just hooks up event listeners and shows/hides overlays.
 */

import { state }  from './state.js';
import { events } from './events.js';

let $score, $lives, $wave, $message, $pause, $buffs;

// A transient on-screen note shown when a power-up is collected.
const BUFF_LABEL = {
    spread: 'SPREAD SHOT',
    shield: 'SHIELD UP',
    life:   '+1 LIFE',
};
let _buffTimer = 0;

export function initUI() {
    $score   = document.getElementById('score-val');
    $lives   = document.getElementById('lives-val');
    $wave    = document.getElementById('wave-val');
    $message = document.getElementById('message');
    $pause   = document.getElementById('pause');
    $buffs   = document.getElementById('buffs');

    _render();

    events.on('scoreChanged', _render);
    events.on('livesChanged', _render);
    events.on('waveChanged',  _render);
    events.on('gameOver',     _showGameOver);
    events.on('powerup',      _showBuff);
}

function _render() {
    if ($score) $score.textContent = String(state.score);
    if ($lives) $lives.textContent = String(state.lives);
    if ($wave)  $wave.textContent  = String(state.wave);
}

export function hideSplash() {
    if ($message) $message.classList.add('hidden');
}

export function showPause() {
    if ($pause) $pause.classList.remove('hidden');
}

export function hidePause() {
    if ($pause) $pause.classList.add('hidden');
}

// Flash a short "POWER-UP" note when a pickup is collected. It auto-clears on a
// timer driven by a tiny self-scheduling timeout (cheap; fires only on pickup).
function _showBuff(p) {
    if (!$buffs) return;
    const label = BUFF_LABEL[p.kind] || 'POWER-UP';
    $buffs.textContent = label;
    $buffs.classList.remove('hidden');
    _buffTimer++;
    const mine = _buffTimer;
    setTimeout(() => {
        // Only clear if no newer buff has been shown since.
        if (mine === _buffTimer && $buffs) $buffs.classList.add('hidden');
    }, 1500);
}

function _showGameOver() {
    if (!$message) return;
    $message.innerHTML = `
        <h1 style="color:#ff5050;text-shadow:0 0 20px rgba(255,80,80,0.9)">GAME OVER</h1>
        <p>Reached Wave ${state.wave} &nbsp;•&nbsp; Final Score: ${state.score}</p>
        <p style="opacity:0.6">Press R to restart  |  ESC for menu</p>
    `;
    $message.classList.remove('hidden');
}
