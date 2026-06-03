/**
 * ui.js — DOM HUD bindings. The HUD lives in index.html as fixed DOM elements;
 * this module just hooks up event listeners and shows/hides overlays.
 */

import { state }  from './state.js';
import { events } from './events.js';

let $score, $lives, $wave, $message;

export function initUI() {
    $score   = document.getElementById('score-val');
    $lives   = document.getElementById('lives-val');
    $wave    = document.getElementById('wave-val');
    $message = document.getElementById('message');

    _render();

    events.on('scoreChanged', _render);
    events.on('livesChanged', _render);
    events.on('waveChanged',  _render);
    events.on('gameOver',     _showGameOver);
}

function _render() {
    if ($score) $score.textContent = String(state.score);
    if ($lives) $lives.textContent = String(state.lives);
    if ($wave)  $wave.textContent  = String(state.wave);
}

export function hideSplash() {
    if ($message) $message.classList.add('hidden');
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
