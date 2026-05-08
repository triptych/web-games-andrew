/**
 * main.js — Synthwave Invaders entry point.
 *
 * Three.js loaded via importmap (see index.html).
 * Game loop: splash → game → game-over → splash
 */

import * as THREE from 'three';

import { initScene, renderer, scene, camera, clock } from './scene.js';
import { initPlayer, initInput, updatePlayer, playerMesh, playerBullets, resetPlayer, makeInvincible, isInvincible } from './player.js';
import { createInvaders, updateInvaders, invaders, enemyBullets, killInvader, getPointsForInvader, aliveCount, getFormationZ } from './invaders.js';
import { spawnExplosion, updateEffects, clearEffects } from './effects.js';
import { initAudio, playShoot, playInvaderHit, playPlayerHit, playExplosion, playGameOver, playWaveClear } from './sounds.js';
import { PLAYER_Z, STARTING_LIVES, COLORS } from './config.js';

// ── DOM refs ──────────────────────────────────────────────────
const $message  = document.getElementById('message');
const $score    = document.getElementById('score-val');
const $wave     = document.getElementById('wave-val');
const $lives    = document.getElementById('lives-val');
const $hud      = document.getElementById('hud');

// ── Game state ────────────────────────────────────────────────
let state       = 'splash'; // splash | playing | gameover | waveclear
let score       = 0;
let lives       = STARTING_LIVES;
let wave        = 1;
let waveClearTimer = 0;

// ── Init ──────────────────────────────────────────────────────
initScene();
initPlayer();
initInput();

_showSplash();
_startAnyKeyListener();

// ── Render loop ───────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (state === 'playing') {
        _updateGame(dt);
    } else if (state === 'waveclear') {
        waveClearTimer -= dt;
        if (waveClearTimer <= 0) _startWave(wave);
    }

    renderer.render(scene, camera);
}
animate();

// ── Game update ───────────────────────────────────────────────
function _updateGame(dt) {
    updatePlayer(dt, playShoot);
    updateInvaders(dt, wave);
    updateEffects(dt);

    _checkBulletVsInvaders();
    _checkEnemyBulletsVsPlayer();
    _checkFormationReached();
}

function _checkBulletVsInvaders() {
    for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
        const b   = playerBullets[bi];
        const bx  = b.mesh.position.x;
        const bz  = b.mesh.position.z;

        for (const inv of invaders) {
            if (!inv.alive) continue;
            const dx = Math.abs(inv.mesh.position.x - bx);
            const dz = Math.abs(inv.mesh.position.z - bz);
            if (dx < 0.65 && dz < 0.65) {
                // Hit!
                killInvader(inv);
                spawnExplosion(inv.mesh.position.x, inv.mesh.position.y, inv.mesh.position.z,
                    inv.row === 0 ? COLORS.enemyA : (inv.row <= 2 ? COLORS.enemyB : COLORS.enemyC));
                playInvaderHit();
                score += getPointsForInvader(inv);
                $score.textContent = String(score).padStart(6, '0');

                // Remove bullet
                scene.remove(b.mesh);
                playerBullets.splice(bi, 1);

                if (aliveCount() === 0) _waveClear();
                return;
            }
        }
    }
}

function _checkEnemyBulletsVsPlayer() {
    if (isInvincible()) return;

    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b  = enemyBullets[i];
        const dx = Math.abs(b.mesh.position.x - px);
        const dz = Math.abs(b.mesh.position.z - pz);
        if (dx < 0.6 && dz < 0.7) {
            scene.remove(b.mesh);
            enemyBullets.splice(i, 1);
            _playerHit();
            return;
        }
    }
}

function _checkFormationReached() {
    if (getFormationZ() >= PLAYER_Z - 2) {
        _gameOver();
    }
}

function _playerHit() {
    lives--;
    _updateLivesHUD();
    playPlayerHit();
    spawnExplosion(playerMesh.position.x, playerMesh.position.y, playerMesh.position.z, COLORS.player, 24);

    if (lives <= 0) {
        _gameOver();
    } else {
        makeInvincible(2.0);
    }
}

// ── State transitions ─────────────────────────────────────────
function _startWave(w) {
    wave  = w;
    state = 'playing';
    $wave.textContent = w;
    $message.classList.add('hidden');
    createInvaders(w);
    resetPlayer();
}

function _waveClear() {
    state = 'waveclear';
    playWaveClear();
    waveClearTimer = 2.0;
    wave++;

    $message.innerHTML = `
        <h1>WAVE<br>CLEARED</h1>
        <p>NEXT WAVE: ${wave}</p>
    `;
    $message.classList.remove('hidden');
}

function _gameOver() {
    state = 'gameover';
    playExplosion();
    playGameOver();
    spawnExplosion(playerMesh.position.x, playerMesh.position.y, playerMesh.position.z, COLORS.player, 40);

    $message.innerHTML = `
        <h1>GAME<br>OVER</h1>
        <p>SCORE: ${String(score).padStart(6, '0')}</p>
        <p class="sub">PRESS ANY KEY TO RESTART</p>
    `;
    $message.classList.remove('hidden');

    _startAnyKeyListener();
}

function _showSplash() {
    $message.innerHTML = `
        <h1>SYNTHWAVE<br>INVADERS</h1>
        <p>&#8592; &#8594; MOVE &nbsp;|&nbsp; SPACE FIRE</p>
        <p class="sub">PRESS ANY KEY TO START</p>
    `;
    $message.classList.remove('hidden');
    $hud.style.display = 'none';
}

function _startGame() {
    score = 0;
    lives = STARTING_LIVES;
    wave  = 1;
    $score.textContent = '000000';
    $hud.style.display = 'flex';
    clearEffects();
    _startWave(1);
}

function _startAnyKeyListener() {
    function onKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        if (state === 'splash' || state === 'gameover') {
            window.removeEventListener('keydown', onKey);
            initAudio();
            _startGame();
        }
    }
    window.addEventListener('keydown', onKey);
}

function _updateLivesHUD() {
    const hearts = Array(Math.max(0, lives)).fill('♥').join(' ');
    $lives.textContent = hearts || '—';
}
