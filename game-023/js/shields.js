/**
 * shields.js — Destructible bunkers between player and invaders.
 *
 * Each bunker is a 4×3 grid of blocks. Blocks are hit-tested against
 * both player bullets and enemy bullets. Three hits destroy a block.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { COLORS, PLAYER_Z, PLAYER_X_LIMIT } from './config.js';

// Shield bunker constants
const BUNKER_COUNT   = 4;
const BLOCK_W        = 0.38;
const BLOCK_H        = 0.38;
const BUNKER_COLS    = 6;
const BUNKER_ROWS    = 4;
const BUNKER_Z       = PLAYER_Z - 3.5; // between player and formation
const MAX_HITS       = 3;

// Colors by damage level
const BLOCK_COLORS = [
    0x00ff88, // 0 hits — bright green
    0xaaff44, // 1 hit  — yellow-green
    0xff8800, // 2 hits  — orange
];

export let shieldBlocks = []; // { mesh, hits, bunker }

export function createShields() {
    // Clear old
    shieldBlocks.forEach(b => scene.remove(b.mesh));
    shieldBlocks = [];

    const spacing = (PLAYER_X_LIMIT * 2 - 1.5) / (BUNKER_COUNT - 1);
    const startX  = -PLAYER_X_LIMIT + 0.75;

    for (let bi = 0; bi < BUNKER_COUNT; bi++) {
        const cx = startX + bi * spacing;

        for (let row = 0; row < BUNKER_ROWS; row++) {
            for (let col = 0; col < BUNKER_COLS; col++) {
                // Classic bunker arch: skip top-center blocks (arch opening)
                if (row === BUNKER_ROWS - 1 && (col === 2 || col === 3)) continue;

                const x = cx + (col - (BUNKER_COLS - 1) / 2) * BLOCK_W;
                const z = BUNKER_Z + (row - (BUNKER_ROWS - 1) / 2) * BLOCK_H;

                const geo  = new THREE.PlaneGeometry(BLOCK_W * 0.85, BLOCK_H * 0.85);
                const mat  = new THREE.MeshBasicMaterial({
                    color:       BLOCK_COLORS[0],
                    transparent: true,
                    opacity:     0.9,
                    side:        THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, 0.0, z);
                scene.add(mesh);
                shieldBlocks.push({ mesh, hits: 0, bunker: bi });
            }
        }
    }
}

export function clearShields() {
    shieldBlocks.forEach(b => scene.remove(b.mesh));
    shieldBlocks = [];
}

// Returns true if the bullet at (bx, bz) hit a shield block, and removes the bullet.
// Also damages the block. Mutates the bullet arrays passed in.
export function checkBulletVsShields(bx, bz) {
    for (let i = shieldBlocks.length - 1; i >= 0; i--) {
        const blk = shieldBlocks[i];
        const dx  = Math.abs(blk.mesh.position.x - bx);
        const dz  = Math.abs(blk.mesh.position.z - bz);
        if (dx < BLOCK_W * 0.6 && dz < BLOCK_H * 0.6) {
            _damageBlock(i);
            return true;
        }
    }
    return false;
}

function _damageBlock(i) {
    const blk = shieldBlocks[i];
    blk.hits++;
    if (blk.hits >= MAX_HITS) {
        scene.remove(blk.mesh);
        shieldBlocks.splice(i, 1);
    } else {
        blk.mesh.material.color.setHex(BLOCK_COLORS[blk.hits]);
        blk.mesh.material.opacity = 0.9 - blk.hits * 0.2;
    }
}
