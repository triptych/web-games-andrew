/**
 * main.js — Hearthbound entry point.
 *
 * This is a hand-built custom engine (no Kaplay/Phaser/three.js):
 * the visual novel layer is DOM+CSS, the light battle layer is <canvas>.
 * Screen flow: title -> story (+ occasional battle overlay) -> ending.
 */

import { state } from './state.js';
import { events } from './events.js';
import { initAudio, playUiClick } from './sounds.js';
import { initDialogueEngine } from './dialogueEngine.js';
import { initVnRenderer } from './vnRenderer.js';
import { initInventory } from './inventory.js';
import { initProgression } from './progression.js';
import { initBattle } from './battle.js';
import { initUI } from './ui.js';
import { initStatsPanel } from './statsPanel.js';
import { initBrewing } from './brewing.js';

let $titleScreen, $gameScreen, $endingScreen, $btnNewGame, $btnContinue, $endingText, $btnRestart;

function initTitleScreen() {
    $titleScreen  = document.getElementById('title-screen');
    $gameScreen   = document.getElementById('game-screen');
    $endingScreen = document.getElementById('ending-screen');
    $btnNewGame   = document.getElementById('btn-new-game');
    $btnContinue  = document.getElementById('btn-continue');
    $endingText   = document.getElementById('ending-text');
    $btnRestart   = document.getElementById('btn-restart');

    if (state.hasSave()) {
        $btnContinue.classList.remove('hidden');
    }

    $btnNewGame.addEventListener('click', () => {
        initAudio();
        playUiClick();
        state.reset();
        startGame();
    });

    $btnContinue.addEventListener('click', () => {
        initAudio();
        playUiClick();
        state.load();
        startGame();
    });

    $btnRestart.addEventListener('click', () => {
        location.reload();
    });

    events.on('storyEnded', showEnding);
}

function startGame() {
    $titleScreen.classList.add('hidden');
    $gameScreen.classList.remove('hidden');
    initDialogueEngine();
}

function showEnding(node) {
    setTimeout(() => {
        $gameScreen.classList.add('hidden');
        $endingScreen.classList.remove('hidden');
        $endingText.textContent = Array.isArray(node.text) ? node.text.join(' ') : node.text;
    }, 400);
}

// ============================================================
// Boot
// ============================================================

initTitleScreen();
initVnRenderer();
initInventory();
initProgression();
initBattle();
initUI();
initStatsPanel();
initBrewing();
