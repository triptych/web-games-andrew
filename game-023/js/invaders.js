/**
 * invaders.js — Invader formation: creation, movement, shooting, hit detection.
 *
 * Invaders live on a flat Z-plane and advance toward the player (positive Z).
 * They are 2D sprites (PlaneGeometry) rendered in 3D space.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import {
    COLS, ROWS,
    INVADER_SPACING_X, INVADER_SPACING_Y,
    FORMATION_START_Z, FORMATION_ADVANCE, PLAYER_X_LIMIT,
    ENEMY_BULLET_SPEED, ENEMY_SHOOT_INTERVAL_MIN, ENEMY_SHOOT_INTERVAL_MAX,
    COLORS, POINTS_ROW,
} from './config.js';

// Public state
export let invaders        = [];  // { mesh, row, col, alive }
export let enemyBullets    = [];
export const formation     = { x: 0, z: 0, dir: 1 };

let _marchTimer     = 0;
let _marchStep      = 0;
let _shootTimer     = 0;
let _nextShootDelay = 1.2;
let _advanceSpeed   = FORMATION_ADVANCE;

// March state (Space Invaders style)
let _marchInterval  = 0.8;  // seconds between march steps
let _marchSideStep  = 0.55; // X units per march step
let _marchDrop      = 1.2;  // Z units to advance when hitting edge

export function createInvaders(wave) {
    invaders.forEach(inv => scene.remove(inv.mesh));
    invaders = [];
    enemyBullets.forEach(b => scene.remove(b.mesh));
    enemyBullets = [];

    formation.x = 0;
    formation.z = FORMATION_START_Z - wave * 1.5;
    formation.dir = 1;
    _advanceSpeed = FORMATION_ADVANCE + wave * 0.4;
    _marchStep = 0;
    _marchTimer = 0;
    _shootTimer = 0;
    _nextShootDelay = _randShootDelay();
    _marchInterval = Math.max(0.18, 0.8 - wave * 0.08);
    _marchSideStep = 0.55;

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const mesh = _makeInvaderMesh(row);
            scene.add(mesh);
            invaders.push({ mesh, row, col, alive: true });
        }
    }
    _updatePositions();
}

function _makeInvaderMesh(row) {
    // Draw invader shape on a canvas texture
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    let color;
    if (row === 0)              color = '#ff00ff';
    else if (row <= 2)          color = '#00ffff';
    else                        color = '#ff6600';

    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, size, size);

    // Different pixel art sprite per row type
    if (row === 0) {
        _drawOctopus(ctx, color, size);
    } else if (row <= 2) {
        _drawCrab(ctx, color, size);
    } else {
        _drawSquid(ctx, color, size);
    }

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(1.0, 1.0);
    const mat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.1,
        color:       row === 0 ? COLORS.enemyA : (row <= 2 ? COLORS.enemyB : COLORS.enemyC),
        side:        THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
}

function _drawOctopus(ctx, color, s) {
    ctx.fillStyle = color;
    // Classic octopus shape pixel art
    const px = s / 11;
    const pattern = [
        '  #######  ',
        ' ######### ',
        '###########',
        '## ## ## ##',
        '###########',
        '  ## ##    ',
        ' #  # #   ',
        '# #   # # ',
    ];
    _drawPixelArt(ctx, pattern, px, color, s);
}

function _drawCrab(ctx, color, s) {
    const px = s / 11;
    const pattern = [
        '#  #####  #',
        ' #########',
        '###########',
        '## # # ###',
        '###########',
        '# ## ## # ',
        '#  #   #  ',
        ' # ### #  ',
    ];
    _drawPixelArt(ctx, pattern, px, color, s);
}

function _drawSquid(ctx, color, s) {
    const px = s / 11;
    const pattern = [
        '   #####   ',
        ' ######### ',
        '###########',
        '# # ### # #',
        '###########',
        '  ## ##    ',
        ' #     #  ',
        '# #   # # ',
    ];
    _drawPixelArt(ctx, pattern, px, color, s);
}

function _drawPixelArt(ctx, pattern, px, color, s) {
    const rows = pattern.length;
    const cols = pattern[0].length;
    const offsetX = (s - cols * px) / 2;
    const offsetY = (s - rows * px) / 2;
    ctx.fillStyle = color;
    // Draw a subtle glow first
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (pattern[r][c] === '#') {
                ctx.fillRect(offsetX + c * px, offsetY + r * px, px, px);
            }
        }
    }
    ctx.shadowBlur = 0;
}

function _updatePositions() {
    const aliveInvaders = invaders.filter(inv => inv.alive);
    if (aliveInvaders.length === 0) return;

    for (const inv of invaders) {
        if (!inv.alive) continue;
        const localX = (inv.col - (COLS - 1) / 2) * INVADER_SPACING_X;
        // Rows spread in Z (depth) so the grid recedes into the distance
        const localZ = inv.row * INVADER_SPACING_Y;
        inv.mesh.position.set(
            formation.x + localX,
            0.5,
            formation.z + localZ
        );
        // Face camera
        inv.mesh.rotation.x = 0;
        inv.mesh.rotation.y = 0;
        inv.mesh.rotation.z = 0;
    }
}

export function updateInvaders(dt, wave) {
    if (invaders.every(inv => !inv.alive)) return;

    // Advance toward player continuously
    formation.z += _advanceSpeed * dt;

    // Space Invaders march: step sideways on a timer, drop+reverse at edges
    _marchTimer += dt;
    if (_marchTimer >= _marchInterval) {
        _marchTimer = 0;
        _marchStep++;

        formation.x += formation.dir * _marchSideStep;

        // Compute the X extent of the formation (leftmost/rightmost alive column)
        const aliveCols = invaders.filter(i => i.alive).map(i => i.col);
        const minCol    = Math.min(...aliveCols);
        const maxCol    = Math.max(...aliveCols);
        const leftEdge  = formation.x + (minCol - (COLS - 1) / 2) * INVADER_SPACING_X;
        const rightEdge = formation.x + (maxCol - (COLS - 1) / 2) * INVADER_SPACING_X;

        if (formation.dir === 1 && rightEdge > PLAYER_X_LIMIT) {
            formation.dir = -1;
            formation.z  += _marchDrop;
        } else if (formation.dir === -1 && leftEdge < -PLAYER_X_LIMIT) {
            formation.dir = 1;
            formation.z  += _marchDrop;
        }

        // Scale pulse on march step
        const s = 1 + (_marchStep % 2 === 0 ? 0.04 : -0.04);
        for (const inv of invaders) {
            if (inv.alive) inv.mesh.scale.set(s, s, 1);
        }
    }

    _updatePositions();

    // Enemy shooting
    _shootTimer += dt;
    if (_shootTimer >= _nextShootDelay) {
        _shootTimer     = 0;
        _nextShootDelay = _randShootDelay();
        _fireEnemyBullet();
    }

    // Move enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.mesh.position.z += ENEMY_BULLET_SPEED * dt;
        if (b.mesh.position.z > 20) {
            scene.remove(b.mesh);
            enemyBullets.splice(i, 1);
        }
    }
}

function _fireEnemyBullet() {
    // Pick a random alive invader in the bottom-most row of each column
    const alive = invaders.filter(inv => inv.alive);
    if (alive.length === 0) return;

    // Find bottom-most alive per col
    const bottomByCol = new Map();
    for (const inv of alive) {
        const existing = bottomByCol.get(inv.col);
        if (existing === undefined || inv.row > existing.row) {
            bottomByCol.set(inv.col, inv);
        }
    }
    const shooters = Array.from(bottomByCol.values());
    const shooter  = shooters[Math.floor(Math.random() * shooters.length)];

    const geo = new THREE.PlaneGeometry(0.08, 0.35);
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.enemyBullet, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(shooter.mesh.position);
    scene.add(mesh);
    enemyBullets.push({ mesh });
}

export function killInvader(inv) {
    inv.alive = false;
    scene.remove(inv.mesh);
}

export function getPointsForInvader(inv) {
    return POINTS_ROW[inv.row] || 10;
}

export function aliveCount() {
    return invaders.filter(i => i.alive).length;
}

export function getFormationZ() {
    return formation.z;
}

function _randShootDelay() {
    return ENEMY_SHOOT_INTERVAL_MIN + Math.random() * (ENEMY_SHOOT_INTERVAL_MAX - ENEMY_SHOOT_INTERVAL_MIN);
}
