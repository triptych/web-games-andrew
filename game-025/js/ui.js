/**
 * ui.js — DOM HUD bindings. The HUD lives in index.html as fixed DOM elements;
 * this module hooks up event listeners and shows/hides the centered message.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { CLASSES } from './config.js';
import { getHighScore, submitScore } from './highscore.js';

let $score, $health, $keys, $level, $class, $message, $hurtFlash;

export function initUI() {
    $score   = document.getElementById('score-val');
    $health  = document.getElementById('health-val');
    $keys    = document.getElementById('keys-val');
    $level   = document.getElementById('level-val');
    $class   = document.getElementById('class-val');
    $message = document.getElementById('message');
    $hurtFlash = _makeHurtFlash();

    _showSplashHighScore();
    _render();

    events.on('scoreChanged',  _render);
    events.on('healthChanged', _render);
    events.on('keysChanged',   _render);
    events.on('levelChanged',  _render);
    events.on('classChosen',   _render);
    events.on('playerHurt',    _flashHurt);
    events.on('gameOver',      _showGameOver);
    events.on('gameWon',       _showGameWon);
}

/** Append the best score to the splash panel if one is stored. */
function _showSplashHighScore() {
    const best = getHighScore();
    if (!best || !$message) return;
    const p = document.createElement('p');
    p.style.cssText = 'color:#ffd700; margin-top:16px';
    p.textContent = `Best Score: ${best}`;
    $message.appendChild(p);
}

/**
 * A full-screen red vignette that pulses when the player is hit. Built in JS so
 * index.html stays untouched; it's a sibling of the HUD inside #ui-overlay and
 * never intercepts pointer events.
 */
function _makeHurtFlash() {
    const el = document.createElement('div');
    el.style.cssText = `
        position: absolute; inset: 0; pointer-events: none; opacity: 0;
        box-shadow: inset 0 0 160px 40px rgba(255, 40, 40, 0.85);
        transition: opacity 0.35s ease-out;`;
    (document.getElementById('ui-overlay') || document.body).appendChild(el);
    return el;
}

function _flashHurt() {
    if (!$hurtFlash) return;
    // Snap to full opacity, then let the CSS transition fade it back out.
    $hurtFlash.style.transition = 'none';
    $hurtFlash.style.opacity = '1';
    // Force a reflow so the next style change animates from opacity 1.
    void $hurtFlash.offsetWidth;
    $hurtFlash.style.transition = 'opacity 0.35s ease-out';
    $hurtFlash.style.opacity = '0';
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

/** Score line + best-score / new-record line shared by the end screens. */
function _scoreBlock() {
    const isNew = submitScore(state.score);   // persists if it beats the record
    const best  = getHighScore();
    const recordLine = isNew
        ? `<p style="color:#ffd700">★ NEW HIGH SCORE! ★</p>`
        : `<p style="opacity:0.6">Best: ${best}</p>`;
    return `<p>Final Score: ${state.score}</p>${recordLine}`;
}

function _showGameOver() {
    if (!$message) return;
    $message.innerHTML = `
        <h1 style="color:#ff5050">GAME OVER</h1>
        <p>You reached level ${state.level}</p>
        ${_scoreBlock()}
        <p style="opacity:0.6">Press R to restart</p>
    `;
    $message.classList.remove('hidden');
}

function _showGameWon() {
    if (!$message) return;
    $message.innerHTML = `
        <h1 style="color:#ffd700">VICTORY</h1>
        <p>You escaped the crypt!</p>
        ${_scoreBlock()}
        <p style="opacity:0.6">Press R to play again</p>
    `;
    $message.classList.remove('hidden');
}
