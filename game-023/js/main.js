/**
 * main.js — Synthwave Invaders entry point.
 *
 * Phase 2: shields, UFO, boss waves, high score, touch controls.
 */

import * as THREE from 'three';

import { initScene, renderer, scene, camera, clock } from './scene.js';
import { initPlayer, initInput, updatePlayer, playerMesh, playerBullets, resetPlayer, makeInvincible, isInvincible } from './player.js';
import { createInvaders, updateInvaders, invaders, enemyBullets, killInvader, getPointsForInvader, aliveCount, getFormationZ } from './invaders.js';
import { spawnExplosion, updateEffects, clearEffects } from './effects.js';
import { initAudio, playShoot, playInvaderHit, playPlayerHit, playExplosion, playGameOver, playWaveClear, playUFOHit, playShieldHit, playBossHit, playBossAppear } from './sounds.js';
import { PLAYER_Z, STARTING_LIVES, COLORS, BOSS_WAVE_INTERVAL } from './config.js';
import { createShields, clearShields, checkBulletVsShields } from './shields.js';
import { updateUFO, checkBulletVsUFO, resetUFO } from './ufo.js';
import { createBoss, updateBoss, checkBulletVsBoss, clearBoss, hasBoss, getBossZ, bossEnemyBullets } from './boss.js';

// ── DOM refs ──────────────────────────────────────────────────
const $message  = document.getElementById('message');
const $score    = document.getElementById('score-val');
const $wave     = document.getElementById('wave-val');
const $lives    = document.getElementById('lives-val');
const $hud      = document.getElementById('hud');
const $hiscore  = document.getElementById('hiscore-val');

// ── High score ────────────────────────────────────────────────
let highScore = parseInt(localStorage.getItem('synthwave_hiscore') || '0', 10);
$hiscore.textContent = String(highScore).padStart(6, '0');

function _saveHighScore(s) {
    if (s > highScore) {
        highScore = s;
        localStorage.setItem('synthwave_hiscore', String(highScore));
        $hiscore.textContent = String(highScore).padStart(6, '0');
    }
}

// ── Game state ────────────────────────────────────────────────
let state          = 'splash';
let score          = 0;
let lives          = STARTING_LIVES;
let wave           = 1;
let waveClearTimer = 0;
let isBossWave     = false;

// ── Init ──────────────────────────────────────────────────────
initScene();
initPlayer();
initInput();
_initTouchControls();

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
    updateEffects(dt);
    updateUFO(dt, true);

    if (isBossWave) {
        updateBoss(dt);
        _checkBulletVsBoss();
        _checkBossEnemyBulletsVsShields();
        _checkBossEnemyBulletsVsPlayer();
        _checkBossReached();
        if (!hasBoss()) _waveClear();
    } else {
        updateInvaders(dt, wave);
        _checkBulletVsInvaders();
        _checkEnemyBulletsVsShields();
        _checkEnemyBulletsVsPlayer();
        _checkFormationReached();
    }

    _checkBulletVsUFO();
    _checkBulletVsShields();
}

// ── Player bullets vs UFO ─────────────────────────────────────
function _checkBulletVsUFO() {
    for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
        const b   = playerBullets[bi];
        const pts = checkBulletVsUFO(b.mesh.position.x, b.mesh.position.z);
        if (pts > 0) {
            playUFOHit();
            spawnExplosion(b.mesh.position.x, 1.2, b.mesh.position.z, COLORS.ufo, 22);
            score += pts;
            $score.textContent = String(score).padStart(6, '0');
            _showFloatingText(pts, b.mesh.position.x, b.mesh.position.z);
            scene.remove(b.mesh);
            playerBullets.splice(bi, 1);
        }
    }
}

// ── Player bullets vs shields ─────────────────────────────────
function _checkBulletVsShields() {
    for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
        const b = playerBullets[bi];
        if (checkBulletVsShields(b.mesh.position.x, b.mesh.position.z)) {
            playShieldHit();
            scene.remove(b.mesh);
            playerBullets.splice(bi, 1);
        }
    }
}

// ── Enemy bullets vs shields ──────────────────────────────────
function _checkEnemyBulletsVsShields() {
    for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
        const b = enemyBullets[bi];
        if (checkBulletVsShields(b.mesh.position.x, b.mesh.position.z)) {
            playShieldHit();
            scene.remove(b.mesh);
            enemyBullets.splice(bi, 1);
        }
    }
}

function _checkBossEnemyBulletsVsShields() {
    for (let bi = bossEnemyBullets.length - 1; bi >= 0; bi--) {
        const b = bossEnemyBullets[bi];
        if (checkBulletVsShields(b.mesh.position.x, b.mesh.position.z)) {
            playShieldHit();
            scene.remove(b.mesh);
            bossEnemyBullets.splice(bi, 1);
        }
    }
}

// ── Player bullets vs invaders ────────────────────────────────
function _checkBulletVsInvaders() {
    for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
        const b  = playerBullets[bi];
        const bx = b.mesh.position.x;
        const bz = b.mesh.position.z;

        for (const inv of invaders) {
            if (!inv.alive) continue;
            const dx = Math.abs(inv.mesh.position.x - bx);
            const dz = Math.abs(inv.mesh.position.z - bz);
            if (dx < 0.65 && dz < 0.65) {
                killInvader(inv);
                spawnExplosion(inv.mesh.position.x, inv.mesh.position.y, inv.mesh.position.z,
                    inv.row === 0 ? COLORS.enemyA : (inv.row <= 2 ? COLORS.enemyB : COLORS.enemyC));
                playInvaderHit();
                score += getPointsForInvader(inv);
                $score.textContent = String(score).padStart(6, '0');

                scene.remove(b.mesh);
                playerBullets.splice(bi, 1);
                return;
            }
        }
    }
}

// ── Player bullets vs boss ────────────────────────────────────
function _checkBulletVsBoss() {
    for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
        const b      = playerBullets[bi];
        const result = checkBulletVsBoss(b.mesh.position.x, b.mesh.position.z);
        if (result.hit) {
            scene.remove(b.mesh);
            playerBullets.splice(bi, 1);
            if (result.killed) {
                spawnExplosion(result.x, result.y, result.z, COLORS.boss, 60);
                playExplosion();
                score += result.points;
                $score.textContent = String(score).padStart(6, '0');
                _showFloatingText(result.points, result.x, result.z);
            } else {
                playBossHit();
                spawnExplosion(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, COLORS.boss, 10);
            }
            return;
        }
    }
}

// ── Enemy bullets vs player ───────────────────────────────────
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

function _checkBossEnemyBulletsVsPlayer() {
    if (isInvincible()) return;
    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;

    for (let i = bossEnemyBullets.length - 1; i >= 0; i--) {
        const b  = bossEnemyBullets[i];
        const dx = Math.abs(b.mesh.position.x - px);
        const dz = Math.abs(b.mesh.position.z - pz);
        if (dx < 0.6 && dz < 0.7) {
            scene.remove(b.mesh);
            bossEnemyBullets.splice(i, 1);
            _playerHit();
            return;
        }
    }
}

function _checkFormationReached() {
    if (getFormationZ() >= PLAYER_Z - 2) _gameOver();
}

function _checkBossReached() {
    if (getBossZ() >= PLAYER_Z - 2) _gameOver();
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
    wave       = w;
    state      = 'playing';
    isBossWave = (w % BOSS_WAVE_INTERVAL === 0);
    $wave.textContent = isBossWave ? `${w}!!` : w;
    $message.classList.add('hidden');

    clearBoss();
    clearShields();

    if (isBossWave) {
        createBoss();
        playBossAppear();
    } else {
        createInvaders(w);
        createShields();
    }
    resetPlayer();
    resetUFO();
}

function _waveClear() {
    state = 'waveclear';
    playWaveClear();
    waveClearTimer = 2.0;
    wave++;
    _saveHighScore(score);

    const nextIsBoss = (wave % BOSS_WAVE_INTERVAL === 0);
    $message.innerHTML = `
        <h1>WAVE<br>CLEARED</h1>
        <p>NEXT WAVE: ${wave}${nextIsBoss ? ' &mdash; BOSS!' : ''}</p>
    `;
    $message.classList.remove('hidden');
}

function _gameOver() {
    state = 'gameover';
    _saveHighScore(score);
    playExplosion();
    playGameOver();
    spawnExplosion(playerMesh.position.x, playerMesh.position.y, playerMesh.position.z, COLORS.player, 40);
    clearBoss();

    $message.innerHTML = `
        <h1>GAME<br>OVER</h1>
        <p>SCORE: ${String(score).padStart(6, '0')}</p>
        <p>BEST: &nbsp;${String(highScore).padStart(6, '0')}</p>
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
    score      = 0;
    lives      = STARTING_LIVES;
    wave       = 1;
    isBossWave = false;
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

// ── Floating bonus score text ─────────────────────────────────
function _showFloatingText(pts, wx, wz) {
    const v = new THREE.Vector3(wx, 1.5, wz);
    v.project(camera);
    const sx = (v.x *  0.5 + 0.5) * window.innerWidth;
    const sy = (v.y * -0.5 + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = 'float-score';
    el.textContent = `+${pts}`;
    el.style.left = `${sx}px`;
    el.style.top  = `${sy}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

// ── Touch controls ────────────────────────────────────────────
function _initTouchControls() {
    const container = document.getElementById('touch-controls');
    if (!container) return;

    const btnLeft  = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnFire  = document.getElementById('btn-fire');

    function setKey(code, down) {
        window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    }

    function addTouch(el, code) {
        el.addEventListener('touchstart',  e => { e.preventDefault(); setKey(code, true);  }, { passive: false });
        el.addEventListener('touchend',    e => { e.preventDefault(); setKey(code, false); }, { passive: false });
        el.addEventListener('touchcancel', e => { e.preventDefault(); setKey(code, false); }, { passive: false });
    }

    addTouch(btnLeft,  'ArrowLeft');
    addTouch(btnRight, 'ArrowRight');
    addTouch(btnFire,  'Space');

    // Only show on actual touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        container.style.display = 'flex';
    }
}
