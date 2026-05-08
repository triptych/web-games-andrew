/**
 * boss.js — Boss invader for every BOSS_WAVE_INTERVAL wave.
 *
 * A large single enemy that takes multiple hits to kill and shoots
 * in 3-round bursts. Returns boss state via exported getters.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { COLORS, PLAYER_Z, PLAYER_X_LIMIT, ENEMY_BULLET_SPEED, BOSS_HP, BOSS_POINTS } from './config.js';

const BOSS_Y           =  0.5;
const BOSS_Z_START     = -8;
const BOSS_SPEED       =  2.8;   // horizontal patrol speed
const BOSS_ADVANCE     =  0.05;  // slow creep toward player per second
const BOSS_SHOOT_DELAY =  1.2;
const BOSS_BULLET_COUNT = 3;
const BOSS_HIT_W       =  1.6;
const BOSS_HIT_H       =  1.2;

let _boss   = null; // { mesh, hp, dir, shootTimer, hpBar }
let _bBullets = [];  // enemy bullets from boss (same format as invaders)

export let bossEnemyBullets = _bBullets;

function _makeBossMesh() {
    const size   = 128;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx    = canvas.getContext('2d');

    const color = '#ff00aa';
    ctx.clearRect(0, 0, size, size);
    ctx.shadowColor = color;
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = color;

    const px = size / 11;
    const pattern = [
        '#    ###    #',
        ' # ####### # ',
        '  #########  ',
        ' ########### ',
        '#############',
        '## # # # # ##',
        '#############',
        ' # ####### # ',
        '#  ## # ##  #',
    ];
    const rows = pattern.length;
    const cols = pattern[0].length;
    const offX = (size - cols * (px * 0.8)) / 2;
    const offY = (size - rows * (px * 0.8)) / 2;
    const bpx  = px * 0.8;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (pattern[r][c] === '#') {
                ctx.fillRect(offX + c * bpx, offY + r * bpx, bpx, bpx);
            }
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(2.8, 2.2);
    const mat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.1,
        color:       COLORS.boss,
        side:        THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
}

function _makeHPBar() {
    const group = new THREE.Group();
    // Background
    const bgGeo = new THREE.PlaneGeometry(3.0, 0.22);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x330022, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(bgGeo, bgMat));
    // Fill (we scale X on update)
    const fillGeo = new THREE.PlaneGeometry(3.0, 0.18);
    const fillMat = new THREE.MeshBasicMaterial({ color: COLORS.boss, side: THREE.DoubleSide });
    const fill    = new THREE.Mesh(fillGeo, fillMat);
    fill.position.z = 0.01;
    group.add(fill);
    return { group, fill };
}

export function createBoss() {
    clearBoss();
    const mesh    = _makeBossMesh();
    const hpBar   = _makeHPBar();
    mesh.position.set(0, BOSS_Y, BOSS_Z_START);
    hpBar.group.position.set(0, BOSS_Y + 1.6, BOSS_Z_START);
    scene.add(mesh);
    scene.add(hpBar.group);
    _boss = { mesh, hpBar, hp: BOSS_HP, dir: 1, shootTimer: 0 };
}

export function hasBoss() { return _boss !== null; }

export function getBossZ() {
    return _boss ? _boss.mesh.position.z : -999;
}

// Returns 0 (miss) or points (kill/hit) and a flag isBossAlive after hit.
export function checkBulletVsBoss(bx, bz) {
    if (!_boss) return { hit: false };
    const dx = Math.abs(_boss.mesh.position.x - bx);
    const dz = Math.abs(_boss.mesh.position.z - bz);
    if (dx < BOSS_HIT_W && dz < BOSS_HIT_H) {
        _boss.hp--;
        _updateHPBar();
        if (_boss.hp <= 0) {
            const px = _boss.mesh.position.x;
            const py = _boss.mesh.position.y;
            const pz = _boss.mesh.position.z;
            clearBoss();
            return { hit: true, killed: true, x: px, y: py, z: pz, points: BOSS_POINTS };
        }
        // Flash white briefly
        _boss.mesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if (_boss) _boss.mesh.material.color.setHex(COLORS.boss);
        }, 80);
        return { hit: true, killed: false };
    }
    return { hit: false };
}

function _updateHPBar() {
    if (!_boss) return;
    const t = Math.max(0, _boss.hp / BOSS_HP);
    _boss.hpBar.fill.scale.x = t;
    _boss.hpBar.fill.position.x = -(3.0 * (1 - t)) / 2;
}

export function updateBoss(dt) {
    if (!_boss) return;

    // Patrol left/right
    _boss.mesh.position.x += _boss.dir * BOSS_SPEED * dt;
    if (_boss.mesh.position.x > PLAYER_X_LIMIT - 1) {
        _boss.mesh.position.x = PLAYER_X_LIMIT - 1;
        _boss.dir = -1;
    } else if (_boss.mesh.position.x < -(PLAYER_X_LIMIT - 1)) {
        _boss.mesh.position.x = -(PLAYER_X_LIMIT - 1);
        _boss.dir = 1;
    }

    // Slow advance
    _boss.mesh.position.z += BOSS_ADVANCE * dt;
    _boss.hpBar.group.position.x = _boss.mesh.position.x;
    _boss.hpBar.group.position.z = _boss.mesh.position.z;

    // Scale pulse
    const s = 1 + Math.sin(Date.now() * 0.005) * 0.03;
    _boss.mesh.scale.set(s, s, 1);

    // Shooting — burst of BOSS_BULLET_COUNT
    _boss.shootTimer -= dt;
    if (_boss.shootTimer <= 0) {
        _boss.shootTimer = BOSS_SHOOT_DELAY;
        _fireBossBurst();
    }

    // Move boss bullets
    for (let i = _bBullets.length - 1; i >= 0; i--) {
        const b = _bBullets[i];
        b.mesh.position.z += ENEMY_BULLET_SPEED * dt;
        if (b.mesh.position.z > 20) {
            scene.remove(b.mesh);
            _bBullets.splice(i, 1);
        }
    }
}

function _fireBossBurst() {
    const bx  = _boss.mesh.position.x;
    const bz  = _boss.mesh.position.z;
    const offsets = [-0.6, 0, 0.6];
    offsets.forEach(ox => {
        const geo  = new THREE.PlaneGeometry(0.1, 0.4);
        const mat  = new THREE.MeshBasicMaterial({ color: 0xff44ff, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(bx + ox, 0.5, bz + 0.5);
        scene.add(mesh);
        _bBullets.push({ mesh });
    });
}

export function clearBoss() {
    if (_boss) {
        scene.remove(_boss.mesh);
        scene.remove(_boss.hpBar.group);
        _boss = null;
    }
    _bBullets.forEach(b => scene.remove(b.mesh));
    _bBullets.length = 0;
}
