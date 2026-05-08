/**
 * ufo.js — Mystery UFO that flies across the top of the play field.
 *
 * Spawns on a random timer. Player bullets can hit it for bonus points.
 * Emits a UFO-specific sound while alive.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { COLORS, PLAYER_X_LIMIT } from './config.js';

const UFO_Y        =  1.2;
const UFO_Z        = -4;       // far z-depth, near top of play field
const UFO_SPEED    =  6.5;
const UFO_HIT_W    =  0.9;
const UFO_HIT_H    =  0.7;

export const UFO_POINTS = [50, 100, 150, 300]; // random bucket

let _ufo = null; // { mesh, dir, alive }
let _spawnTimer = 0;
let _nextSpawn  = _randDelay();

function _randDelay() {
    return 15 + Math.random() * 25; // 15–40 s
}

function _makeUFOMesh() {
    const size   = 64;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx    = canvas.getContext('2d');

    const color = '#ff0066';
    ctx.clearRect(0, 0, size, size);
    ctx.shadowColor = color;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = color;

    const px = size / 11;
    const pattern = [
        '    ###    ',
        '  #######  ',
        ' ######### ',
        '###########',
        '  # # # #  ',
    ];
    const rows   = pattern.length;
    const cols   = pattern[0].length;
    const offX   = (size - cols * px) / 2;
    const offY   = (size - rows * px) / 2;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (pattern[r][c] === '#') {
                ctx.fillRect(offX + c * px, offY + r * px, px, px);
            }
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(1.4, 0.8);
    const mat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.1,
        color:       0xff0066,
        side:        THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
}

export function updateUFO(dt, playing, onHit) {
    if (!playing) return;

    if (!_ufo) {
        _spawnTimer += dt;
        if (_spawnTimer >= _nextSpawn) {
            _spawnTimer = 0;
            _nextSpawn  = _randDelay();
            _spawnUFO();
        }
        return;
    }

    // Move
    _ufo.mesh.position.x += _ufo.dir * UFO_SPEED * dt;

    // Exit screen → despawn
    const limit = PLAYER_X_LIMIT + 2;
    if (_ufo.dir === 1 && _ufo.mesh.position.x > limit) {
        _despawnUFO();
        return;
    }
    if (_ufo.dir === -1 && _ufo.mesh.position.x < -limit) {
        _despawnUFO();
        return;
    }
}

function _spawnUFO() {
    const mesh = _makeUFOMesh();
    const dir  = Math.random() < 0.5 ? 1 : -1;
    const startX = dir === 1 ? -(PLAYER_X_LIMIT + 2) : (PLAYER_X_LIMIT + 2);
    mesh.position.set(startX, UFO_Y, UFO_Z);
    scene.add(mesh);
    _ufo = { mesh, dir };
}

function _despawnUFO() {
    if (_ufo) {
        scene.remove(_ufo.mesh);
        _ufo = null;
    }
}

// Returns points if hit, 0 otherwise.
export function checkBulletVsUFO(bx, bz) {
    if (!_ufo) return 0;
    const dx = Math.abs(_ufo.mesh.position.x - bx);
    const dz = Math.abs(_ufo.mesh.position.z - bz);
    if (dx < UFO_HIT_W && dz < UFO_HIT_H) {
        const pts = UFO_POINTS[Math.floor(Math.random() * UFO_POINTS.length)];
        _despawnUFO();
        return pts;
    }
    return 0;
}

export function getUFO() { return _ufo; }

export function resetUFO() {
    _despawnUFO();
    _spawnTimer = 0;
    _nextSpawn  = _randDelay();
}
