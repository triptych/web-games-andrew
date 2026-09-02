/**
 * ui.js — persistent HUD chrome: level/HP readout, save button, mute button.
 */

import { state } from './state.js';
import { events } from './events.js';
import { xpToNextLevel } from './config.js';
import { toggleSound, playUiClick } from './sounds.js';

let $level, $hpFill, $hpLabel, $xpFill, $saveBtn, $muteBtn, $day, $coin;

export function initUI() {
    $level   = document.getElementById('hud-level');
    $hpFill  = document.getElementById('hud-hp-fill');
    $hpLabel = document.getElementById('hud-hp-label');
    $xpFill  = document.getElementById('hud-xp-fill');
    $saveBtn = document.getElementById('hud-save');
    $muteBtn = document.getElementById('hud-mute');
    $day     = document.getElementById('hud-day');
    $coin    = document.getElementById('hud-coin');

    $saveBtn.addEventListener('click', () => {
        playUiClick();
        state.save();
        flashSaved();
    });

    $muteBtn.addEventListener('click', () => {
        const enabled = toggleSound();
        $muteBtn.textContent = enabled ? '🔊' : '🔇';
    });

    events.on('dayChanged', renderDay);
    events.on('coinChanged', renderCoin);
    events.on('gameLoaded', renderAll);
    events.on('hpChanged', renderHp);
    events.on('statsChanged', renderAll);
    events.on('levelUp', renderAll);
    events.on('xpChanged', renderXp);

    renderAll();
}

function renderAll() {
    renderHp(state.stats.hp, state.stats.maxHp);
    renderXp(state.stats.xp);
    renderDay(state.day);
    renderCoin(state.coin);
    $level.textContent = `Lv. ${state.stats.level}`;
}

// Phase 6: the season runs on days, and the shop runs on coin — both live
// in the HUD so the player can see the two resources a long game spends.
function renderDay(day) {
    if ($day) $day.textContent = `Day ${day}`;
}

function renderCoin(coin) {
    if ($coin) $coin.textContent = `${coin}c`;
}

function renderHp(hp, maxHp) {
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    $hpFill.style.width = `${pct * 100}%`;
    $hpLabel.textContent = `${hp}/${maxHp}`;
}

function renderXp(xp) {
    const needed = xpToNextLevel(state.stats.level);
    const pct = Math.max(0, Math.min(1, xp / needed));
    $xpFill.style.width = `${pct * 100}%`;
}

function flashSaved() {
    $saveBtn.textContent = 'Saved!';
    setTimeout(() => { $saveBtn.textContent = '💾 Save'; }, 1200);
}
