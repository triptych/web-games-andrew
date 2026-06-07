/**
 * ui.js — DOM HUD bindings. The HUD lives in index.html as fixed DOM elements;
 * this module hooks up event listeners and shows/hides the centered message.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { CLASSES } from './config.js';

let $score, $health, $keys, $level, $class, $message;

export function initUI() {
    $score   = document.getElementById('score-val');
    $health  = document.getElementById('health-val');
    $keys    = document.getElementById('keys-val');
    $level   = document.getElementById('level-val');
    $class   = document.getElementById('class-val');
    $message = document.getElementById('message');

    _render();

    events.on('scoreChanged',  _render);
    events.on('healthChanged', _render);
    events.on('keysChanged',   _render);
    events.on('levelChanged',  _render);
    events.on('classChosen',   _render);
    events.on('gameOver',      _showGameOver);
    events.on('gameWon',       _showGameWon);
}

function _classDisplayName() {
    if (!state.classKey) return '—';
    const def = Object.values(CLASSES).find(c => c.key === state.classKey);
    return def ? def.name : '—';
}

function _render() {
    if ($score)  $score.textContent  = String(state.score);
    if ($health) $health.textContent = String(state.health);
    if ($keys)   $keys.textContent   = String(state.keys);
    if ($level)  $level.textContent  = String(state.level);
    if ($class)  $class.textContent  = _classDisplayName();
}

/** Hide the splash / class-select message. */
export function hideSplash() {
    if ($message) $message.classList.add('hidden');
}

/** Re-show a centered message (used for level transitions). */
export function showMessage(title, sub = '') {
    if (!$message) return;
    $message.innerHTML = `<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}`;
    $message.classList.remove('hidden');
}

function _showGameOver() {
    if (!$message) return;
    $message.innerHTML = `
        <h1 style="color:#ff5050">GAME OVER</h1>
        <p>You reached level ${state.level}</p>
        <p>Final Score: ${state.score}</p>
        <p style="opacity:0.6">Press R to restart</p>
    `;
    $message.classList.remove('hidden');
}

function _showGameWon() {
    if (!$message) return;
    $message.innerHTML = `
        <h1 style="color:#ffd700">VICTORY</h1>
        <p>You escaped the crypt!</p>
        <p>Final Score: ${state.score}</p>
        <p style="opacity:0.6">Press R to play again</p>
    `;
    $message.classList.remove('hidden');
}
