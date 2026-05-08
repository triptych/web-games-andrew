/**
 * player.js — Player ship, bullets, input.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import {
    PLAYER_Z, PLAYER_SPEED, PLAYER_X_LIMIT,
    BULLET_SPEED, BULLET_COOLDOWN,
    COLORS,
} from './config.js';

export let playerMesh;
export let playerBullets = [];

const _keys = { left: false, right: false, shoot: false };
let _shootCooldown = 0;
let _invincibleTimer = 0; // blink after hit
let _blinkTimer = 0;

export function initPlayer() {
    playerMesh = _makePlayerMesh();
    scene.add(playerMesh);
}

function _makePlayerMesh() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const color = '#00ffff';
    ctx.clearRect(0, 0, size, size);
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = color;

    // Pixel art ship (top-down/front view)
    const px = size / 11;
    const pattern = [
        '     #     ',
        '     #     ',
        '    ###    ',
        '   #####   ',
        '  #######  ',
        ' ######### ',
        '###########',
        '  #     #  ',
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
    const geo = new THREE.PlaneGeometry(1.2, 1.2);
    const mat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.1,
        color:       COLORS.player,
        side:        THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -0.3, PLAYER_Z);
    return mesh;
}

export function initInput() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowLeft'  || e.code === 'KeyA') _keys.left  = true;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') _keys.right = true;
        if (e.code === 'Space')                            _keys.shoot = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft'  || e.code === 'KeyA') _keys.left  = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') _keys.right = false;
        if (e.code === 'Space')                            _keys.shoot = false;
    });
}

export function updatePlayer(dt, onShoot) {
    // Movement
    if (_keys.left) {
        playerMesh.position.x = Math.max(playerMesh.position.x - PLAYER_SPEED * dt, -PLAYER_X_LIMIT);
    }
    if (_keys.right) {
        playerMesh.position.x = Math.min(playerMesh.position.x + PLAYER_SPEED * dt,  PLAYER_X_LIMIT);
    }

    // Slight tilt when moving
    const targetTilt = (_keys.right ? -0.3 : 0) + (_keys.left ? 0.3 : 0);
    playerMesh.rotation.z += (targetTilt - playerMesh.rotation.z) * 6 * dt;

    // Shooting
    _shootCooldown -= dt;
    if (_keys.shoot && _shootCooldown <= 0) {
        _shootCooldown = BULLET_COOLDOWN;
        _fireBullet();
        if (onShoot) onShoot();
    }

    // Move bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const b = playerBullets[i];
        b.mesh.position.z -= BULLET_SPEED * dt;
        if (b.mesh.position.z < -40) {
            scene.remove(b.mesh);
            playerBullets.splice(i, 1);
        }
    }

    // Invincibility blink
    if (_invincibleTimer > 0) {
        _invincibleTimer -= dt;
        _blinkTimer      += dt;
        playerMesh.visible = Math.sin(_blinkTimer * 20) > 0;
        if (_invincibleTimer <= 0) {
            playerMesh.visible = true;
        }
    }
}

function _fireBullet() {
    const geo  = new THREE.PlaneGeometry(0.1, 0.45);
    const mat  = new THREE.MeshBasicMaterial({ color: COLORS.bullet, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(playerMesh.position.x, playerMesh.position.y + 0.5, PLAYER_Z - 0.5);
    scene.add(mesh);
    playerBullets.push({ mesh });
}

export function makeInvincible(duration = 2.0) {
    _invincibleTimer = duration;
    _blinkTimer      = 0;
}

export function isInvincible() {
    return _invincibleTimer > 0;
}

export function resetPlayer() {
    playerMesh.position.set(0, -0.3, PLAYER_Z);
    playerMesh.rotation.z = 0;
    playerMesh.visible    = true;
    _invincibleTimer      = 0;
    playerBullets.forEach(b => scene.remove(b.mesh));
    playerBullets = [];
}
