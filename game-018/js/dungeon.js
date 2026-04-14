/**
 * dungeon.js — Procedural dungeon generation, rendering, monsters, torches, and treasure.
 *
 * Each dungeon has:
 *  - A stone-floor room grid (corridors connecting rectangular rooms)
 *  - Wall torches that flicker (PointLights on wall segments)
 *  - Stronger dungeon monsters patrolling corridors/rooms
 *  - A boss monster in the final chamber
 *  - Treasure chests scattered through rooms (collect with E)
 *
 * Dungeons exist at fixed world positions (entrance markers visible on overworld).
 * Press E near an entrance to enter; press E near the exit portal to leave.
 *
 * Exports:
 *   initDungeons(scene) → { dungeonEntrances, update(dt, playerPos, camera), enterDungeon(idx), exitDungeon() }
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    DUNGEON_COUNT, DUNGEON_MIN_DIST, DUNGEON_MAX_DIST,
    DUNGEON_MONSTER_DEFS, DUNGEON_BOSS_DEF, TREASURE_DEFS,
    WORLD_SIZE,
} from './config.js';
import { playMonsterHit, playMonsterDie, playPlayerHurt, playPickup, playGoldPickup, playMonsterGrunt, startDungeonAmbient, stopDungeonAmbient } from './sounds.js';
import { generateProceduralMonster, makeSkinTexture } from './monsters.js';

// ============================================================
// Constants
// ============================================================

const TILE       = 4;          // world units per dungeon tile
const DUNGEON_W  = 25;         // tiles wide
const DUNGEON_H  = 25;         // tiles tall
const WALL_H           = 3.5;   // wall height
const DUNGEON_OFFSET_Y = -0.5;  // visual offset keeps dungeon flush with ground

// Dungeon is rendered in a separate area offset far from the playfield
// so it never visually overlaps the overworld. We teleport the player group
// to this staging area when entering a dungeon.
// Each dungeon index offsets by DUNGEON_SPACING along X.
const DUNGEON_BASE_X  = 400;
const DUNGEON_BASE_Z  = 400;
const DUNGEON_SPACING = DUNGEON_W * TILE + 20;  // spacing between dungeon staging slots

// Torch flicker config
const TORCH_BASE_INT  = 1.8;
const TORCH_FLICKER   = 0.7;
const TORCH_RANGE     = 8;

// Monster aggro/lose ranges inside dungeon (tighter than overworld)
const AGGRO_RANGE = 22;
const LOSE_RANGE  = 30;

const _DUNGEON_SKIN_STYLES = ['scales', 'spots', 'stripes', 'cracked', 'fur'];

/**
 * Build a creature mesh for a dungeon monster def.
 * Uses the same limb logic as the overworld procedural system,
 * plus a generated skin texture (makeSkinTexture imported from monsters.js).
 */
function _buildCreatureMesh(def, isBoss) {
    const s     = def.scale;
    const group = new THREE.Group();

    // Pick texture style deterministically from color
    const styleIdx  = def.color % _DUNGEON_SKIN_STYLES.length;
    const skinStyle = _DUNGEON_SKIN_STYLES[styleIdx];
    const accentHex = def.accentColor ?? (def.color ^ 0x333333);
    const skinTex   = makeSkinTexture(def.color, accentHex, skinStyle);

    // color: 0xffffff so the canvas texture isn't tinted/darkened by the material color
    const bodyMat   = new THREE.MeshLambertMaterial({ color: 0xffffff, map: skinTex, transparent: true });
    const accentMat = new THREE.MeshLambertMaterial({ color: accentHex });
    const eyeColor  = def.eyeColor ?? 0xff2222;
    const eyeMat    = new THREE.MeshBasicMaterial({ color: eyeColor });

    // --- Body ---
    const bodyH   = 0.9 * s;
    const legCount = def.legCount ?? 2;
    const armCount = def.armCount ?? 2;
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.75 * s, bodyH, 0.7 * s),
        bodyMat.clone()
    );
    body.position.y = bodyH * 0.55 + (legCount > 0 ? 0.35 * s : 0);
    body.name = 'body';
    body.castShadow = true;
    group.add(body);
    const bodyTopY = body.position.y + bodyH * 0.5;

    // --- Head ---
    const headSize = 0.42 * s;
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(headSize * 1.1, headSize, headSize),
        bodyMat.clone()
    );
    head.position.set(0, bodyTopY + headSize * 0.55, -0.05 * s);
    group.add(head);
    const headTopY = head.position.y + headSize * 0.5;

    // --- Eyes ---
    for (const ox of [-0.12 * s, 0.12 * s]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 6, 6), eyeMat);
        eye.position.set(ox, head.position.y, head.position.z - headSize * 0.5 - 0.02);
        group.add(eye);
    }

    // --- Horns (bosses always, others if def says so or every other type) ---
    const hasHorns = def.hasHorns ?? (isBoss || (def.color & 1) === 1);
    if (hasHorns) {
        const hornGeo = new THREE.ConeGeometry(0.07 * s, 0.35 * s, 5);
        for (const ox of [-0.12 * s, 0.12 * s]) {
            const horn = new THREE.Mesh(hornGeo, accentMat.clone());
            horn.position.set(ox, headTopY + 0.15 * s, head.position.z);
            horn.rotation.z = ox < 0 ? 0.25 : -0.25;
            group.add(horn);
        }
    }

    // --- Tail ---
    const hasTail = def.hasTail ?? ((def.color >> 4) & 1) === 1;
    if (hasTail) {
        const tail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06 * s, 0.02 * s, 0.6 * s, 5),
            accentMat.clone()
        );
        tail.position.set(0, body.position.y - 0.05 * s, 0.45 * s);
        tail.rotation.x = 0.7;
        group.add(tail);
    }

    // --- Arms (always at least 2) ---
    const armH   = 0.5 * s;
    const armGeo = new THREE.CylinderGeometry(0.07 * s, 0.05 * s, armH, 5);
    const armYOffsets = armCount === 4 ? [0, -0.2 * s] : [0];
    for (const yOff of armYOffsets) {
        for (const side of [-1, 1]) {
            const arm = new THREE.Mesh(armGeo, bodyMat.clone());
            arm.position.set(side * (0.5 * s + 0.06 * s), body.position.y + yOff, 0);
            arm.rotation.z = side * 0.6;
            arm.castShadow = true;
            group.add(arm);
        }
    }

    // --- Legs ---
    if (legCount > 0) {
        const legH   = 0.35 * s;
        const legGeo = new THREE.CylinderGeometry(0.09 * s, 0.06 * s, legH, 5);
        const legXPositions = legCount === 4
            ? [-0.22 * s, -0.08 * s, 0.08 * s, 0.22 * s]
            : [-0.2 * s, 0.2 * s];
        for (const lx of legXPositions) {
            const leg = new THREE.Mesh(legGeo, bodyMat.clone());
            leg.position.set(lx, legH * 0.5, 0);
            group.add(leg);
        }
    }

    // --- Wings (bosses + high-tier defs) ---
    const hasWings = def.hasWings ?? isBoss;
    if (hasWings) {
        const wingW   = 0.85 * s;
        const wingGeo = new THREE.BoxGeometry(wingW, 0.05 * s, 0.5 * s);
        const wingMat = new THREE.MeshLambertMaterial({ color: accentHex, transparent: true, opacity: 0.82 });
        const shoulderX = 0.38 * s;
        const shoulderY = body.position.y + 0.15 * s;
        for (const sx of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(sx * shoulderX, shoulderY, 0.05 * s);
            pivot.rotation.z = sx * 0.35;
            pivot.userData.isWing = true;
            const wingMesh = new THREE.Mesh(wingGeo, wingMat.clone());
            wingMesh.position.set(sx * wingW * 0.5, 0, 0);
            pivot.add(wingMesh);
            group.add(pivot);
        }
    }

    // --- Boss extras: robe + aura ---
    if (isBoss) {
        const robeMat = new THREE.MeshLambertMaterial({ color: accentHex });
        const robe = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 1.0 * s, 0.5 * s), robeMat);
        robe.position.y = 0.3 * s;
        group.add(robe);

        const auraMat = new THREE.MeshBasicMaterial({
            color: accentHex, transparent: true, opacity: 0.22, side: THREE.BackSide,
        });
        const aura = new THREE.Mesh(new THREE.SphereGeometry(1.4 * s, 10, 10), auraMat);
        aura.position.y = 0.9 * s;
        aura.name = 'aura';
        group.add(aura);
    }

    // --- HP bar — placed 0.3 units above the actual creature top ---
    const creatureTopY = hasHorns
        ? headTopY + 0.15 * s + 0.35 * s   // horn centre + half horn height
        : headTopY;
    const hpBarGeo = new THREE.PlaneGeometry(0.8 * s, 0.1 * s);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x44cc44, side: THREE.DoubleSide });
    const hpBar    = new THREE.Mesh(hpBarGeo, hpBarMat);
    hpBar.position.y = creatureTopY + 0.3;
    hpBar.name = 'hpBar';
    group.userData.hpBar = hpBar;
    group.add(hpBar);

    group.userData.wingTimer = 0;
    return group;
}

// ============================================================
// Helpers
// ============================================================

function _rng(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

/** Place a point at a random world location in the monster zone, away from village */
function _randomWorldPos(minDist, maxDist, existingPositions) {
    for (let attempt = 0; attempt < 100; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const r     = minDist + Math.random() * (maxDist - minDist);
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        // Keep inside world bounds
        if (Math.abs(x) > WORLD_SIZE - 10 || Math.abs(z) > WORLD_SIZE - 10) continue;
        // Separation from other dungeons
        let ok = true;
        for (const ep of existingPositions) {
            if (Math.hypot(x - ep.x, z - ep.z) < 25) { ok = false; break; }
        }
        if (ok) return new THREE.Vector3(x, 0, z);
    }
    // Fallback
    const angle = Math.random() * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * minDist, 0, Math.sin(angle) * minDist);
}

// ============================================================
// Procedural dungeon layout (BSP-lite room + corridor)
// ============================================================

/**
 * Returns a 2D grid (DUNGEON_H × DUNGEON_W) where:
 *   0 = wall, 1 = floor
 * Also returns rooms array and entryTile / exitTile positions.
 */
function _generateLayout() {
    const grid = Array.from({ length: DUNGEON_H }, () => new Uint8Array(DUNGEON_W));

    const rooms = [];

    function _carveRoom(rx, ry, rw, rh) {
        for (let y = ry; y < ry + rh; y++) {
            for (let x = rx; x < rx + rw; x++) {
                if (y >= 0 && y < DUNGEON_H && x >= 0 && x < DUNGEON_W) grid[y][x] = 1;
            }
        }
        rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw / 2), cy: ry + Math.floor(rh / 2) });
    }

    function _carveCorridor(x1, y1, x2, y2) {
        // L-shaped corridor
        let cx = x1, cy = y1;
        while (cx !== x2) {
            if (cx >= 0 && cx < DUNGEON_W && cy >= 0 && cy < DUNGEON_H) grid[cy][cx] = 1;
            cx += cx < x2 ? 1 : -1;
        }
        while (cy !== y2) {
            if (cx >= 0 && cx < DUNGEON_W && cy >= 0 && cy < DUNGEON_H) grid[cy][cx] = 1;
            cy += cy < y2 ? 1 : -1;
        }
        if (cx >= 0 && cx < DUNGEON_W && cy >= 0 && cy < DUNGEON_H) grid[cy][cx] = 1;
    }

    // Place 7-10 rooms randomly across the grid
    const roomCount = _rng(7, 10);
    let attempts = 0;
    while (rooms.length < roomCount && attempts < 200) {
        attempts++;
        const rw = _rng(3, 7);
        const rh = _rng(3, 6);
        const rx = _rng(1, DUNGEON_W - rw - 1);
        const ry = _rng(1, DUNGEON_H - rh - 1);

        // Check overlap (with a 1-tile gap)
        let overlaps = false;
        for (const r of rooms) {
            if (rx < r.x + r.w + 1 && rx + rw > r.x - 1 &&
                ry < r.y + r.h + 1 && ry + rh > r.y - 1) {
                overlaps = true; break;
            }
        }
        if (!overlaps) _carveRoom(rx, ry, rw, rh);
    }

    // Connect rooms with corridors (chain in order)
    for (let i = 1; i < rooms.length; i++) {
        _carveCorridor(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
    }

    // Widen corridors slightly (add 1 extra tile beside each floor cell that is
    // surrounded mostly by walls) — makes corridors 2-wide
    const widened = Array.from({ length: DUNGEON_H }, (_, y) => new Uint8Array(grid[y]));
    for (let y = 1; y < DUNGEON_H - 1; y++) {
        for (let x = 1; x < DUNGEON_W - 1; x++) {
            if (grid[y][x] === 1) {
                widened[y][x] = 1;
                widened[y + 1][x] = 1;
                widened[y][x + 1] = 1;
            }
        }
    }

    // Entry = center of first room, Exit = center of last room
    const entryTile = { x: rooms[0].cx, y: rooms[0].cy };
    const exitTile  = { x: rooms[rooms.length - 1].cx, y: rooms[rooms.length - 1].cy };

    return { grid: widened, rooms, entryTile, exitTile };
}

// ============================================================
// Procedural canvas textures
// ============================================================

/**
 * Draw a stone-block pattern onto a canvas and return a THREE.CanvasTexture.
 * @param {number} pw  canvas pixel width
 * @param {number} ph  canvas pixel height
 * @param {object} opts  { baseR, baseG, baseB, mortarR, mortarG, mortarB,
 *                         blockW, blockH, variation, crackChance }
 */
function _makeStoneTexture(pw, ph, opts = {}) {
    const {
        baseR = 55, baseG = 52, baseB = 44,
        mortarR = 22, mortarG = 20, mortarB = 16,
        blockW = 64, blockH = 32,
        variation = 18,
        crackChance = 0.35,
    } = opts;

    const canvas = document.createElement('canvas');
    canvas.width  = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d');

    // Fill background with mortar colour
    ctx.fillStyle = `rgb(${mortarR},${mortarG},${mortarB})`;
    ctx.fillRect(0, 0, pw, ph);

    // Draw stone blocks row by row
    const rows = Math.ceil(ph / blockH) + 1;
    const cols = Math.ceil(pw / blockW) + 2;
    const mortar = 3;  // mortar gap in pixels

    for (let row = 0; row < rows; row++) {
        const offsetX = (row % 2 === 0) ? 0 : blockW / 2;
        const y0 = row * blockH;

        for (let col = -1; col < cols; col++) {
            const x0 = col * blockW - offsetX;

            // Random brightness variation per block
            const v  = Math.floor((Math.random() - 0.5) * variation);
            const r  = Math.max(0, Math.min(255, baseR + v));
            const g  = Math.max(0, Math.min(255, baseG + v));
            const b  = Math.max(0, Math.min(255, baseB + v));

            // Block fill
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x0 + mortar, y0 + mortar, blockW - mortar, blockH - mortar);

            // Subtle inner shadow on top/left edges (depth illusion)
            ctx.fillStyle = `rgba(0,0,0,0.18)`;
            ctx.fillRect(x0 + mortar, y0 + mortar, blockW - mortar, 3);
            ctx.fillRect(x0 + mortar, y0 + mortar, 3, blockH - mortar);

            // Subtle highlight on bottom/right edges
            ctx.fillStyle = `rgba(255,255,255,0.07)`;
            ctx.fillRect(x0 + mortar, y0 + blockH - mortar - 2, blockW - mortar, 2);
            ctx.fillRect(x0 + blockW - mortar - 2, y0 + mortar, 2, blockH - mortar);

            // Occasional crack
            if (Math.random() < crackChance) {
                ctx.strokeStyle = `rgba(0,0,0,0.25)`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                const cx1 = x0 + mortar + Math.random() * (blockW - mortar * 2);
                const cy1 = y0 + mortar + Math.random() * (blockH - mortar * 2);
                ctx.moveTo(cx1, cy1);
                ctx.lineTo(cx1 + (Math.random() - 0.5) * 14, cy1 + (Math.random() - 0.5) * 10);
                ctx.stroke();
            }
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

/** Draw a flagstone floor pattern. */
function _makeFloorTexture(pw, ph) {
    return _makeStoneTexture(pw, ph, {
        baseR: 60, baseG: 56, baseB: 48,
        mortarR: 28, mortarG: 26, mortarB: 20,
        blockW: 48, blockH: 48,
        variation: 14,
        crackChance: 0.2,
    });
}

/** Draw a ceiling texture (darker, less variation). */
function _makeCeilTexture(pw, ph) {
    return _makeStoneTexture(pw, ph, {
        baseR: 30, baseG: 28, baseB: 24,
        mortarR: 14, mortarG: 12, mortarB: 10,
        blockW: 64, blockH: 32,
        variation: 8,
        crackChance: 0.15,
    });
}

// Build textures once (shared across all dungeons).
// Wall: TILE wide × WALL_H tall in world units → repeat to keep ~0.5 unit per pixel.
// We use 256×128 canvas and set repeat so one stone ≈ 0.6 world units.
const _WALL_TEX_SCALE = 1.5;  // UV repeats per TILE unit
const _wallTex  = _makeStoneTexture(256, 128);
_wallTex.repeat.set(TILE * _WALL_TEX_SCALE / 4, WALL_H * _WALL_TEX_SCALE / 4);

const _floorTex = _makeFloorTexture(256, 256);
_floorTex.repeat.set(TILE / 4, TILE / 4);

const _ceilTex  = _makeCeilTexture(256, 128);
_ceilTex.repeat.set(TILE / 4, TILE / 4);

// ============================================================
// Build Three.js geometry for dungeon
// ============================================================

const _floorMat = new THREE.MeshLambertMaterial({ map: _floorTex });
const _wallMat  = new THREE.MeshLambertMaterial({ map: _wallTex  });
const _ceilMat  = new THREE.MeshLambertMaterial({ map: _ceilTex  });

function _tileToWorld(tx, ty, stageX, stageZ) {
    return new THREE.Vector3(
        stageX + tx * TILE - (DUNGEON_W * TILE) / 2,
        DUNGEON_OFFSET_Y,
        stageZ + ty * TILE - (DUNGEON_H * TILE) / 2,
    );
}

/** Build all floor, wall, ceiling meshes and return them + torch data */
function _buildDungeonMeshes(scene, grid, stageX, stageZ) {
    const meshes   = [];
    const torches  = [];

    // Pre-build geometries
    const floorGeo = new THREE.PlaneGeometry(TILE, TILE);
    const ceilGeo  = new THREE.PlaneGeometry(TILE, TILE);
    const wallGeoN = new THREE.PlaneGeometry(TILE, WALL_H);  // north/south wall face
    const wallGeoE = new THREE.PlaneGeometry(TILE, WALL_H);  // east/west

    // Torchlight geometry (small box on wall)
    const torchGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    const torchMat = new THREE.MeshBasicMaterial({ color: 0xff7722 });
    const flameGeo = new THREE.SphereGeometry(0.18, 5, 5);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9933 });

    function _addWall(x, y, side) {
        // side: 'N' | 'S' | 'E' | 'W'
        const geo  = (side === 'N' || side === 'S') ? wallGeoN : wallGeoE;
        const wall = new THREE.Mesh(geo, _wallMat);
        const wp   = _tileToWorld(x, y, stageX, stageZ);
        const hy   = DUNGEON_OFFSET_Y + WALL_H / 2;

        if (side === 'N') { wall.position.set(wp.x, hy, wp.z - TILE / 2); }
        if (side === 'S') { wall.position.set(wp.x, hy, wp.z + TILE / 2); wall.rotation.y = Math.PI; }
        if (side === 'W') { wall.position.set(wp.x - TILE / 2, hy, wp.z); wall.rotation.y = Math.PI / 2; }
        if (side === 'E') { wall.position.set(wp.x + TILE / 2, hy, wp.z); wall.rotation.y = -Math.PI / 2; }

        wall.receiveShadow = true;
        scene.add(wall);
        meshes.push(wall);

        // Occasionally add a torch to this wall face (~15% chance per wall)
        if (Math.random() < 0.15) {
            const torchBody = new THREE.Mesh(torchGeo, torchMat.clone());
            const flame     = new THREE.Mesh(flameGeo, flameMat.clone());
            const light     = new THREE.PointLight(0xff8844, TORCH_BASE_INT, TORCH_RANGE, 2);

            const tp = wall.position.clone();
            // Offset slightly away from wall into room
            const offset = 0.25;
            if (side === 'N') { tp.z += offset; }
            if (side === 'S') { tp.z -= offset; }
            if (side === 'W') { tp.x += offset; }
            if (side === 'E') { tp.x -= offset; }
            tp.y = DUNGEON_OFFSET_Y + 1.8;

            torchBody.position.copy(tp);
            flame.position.set(tp.x, tp.y + 0.22, tp.z);
            light.position.set(tp.x, tp.y + 0.3,  tp.z);

            scene.add(torchBody);
            scene.add(flame);
            scene.add(light);
            meshes.push(torchBody, flame);

            torches.push({ light, flame, phase: Math.random() * Math.PI * 2 });
        }
    }

    for (let ty = 0; ty < DUNGEON_H; ty++) {
        for (let tx = 0; tx < DUNGEON_W; tx++) {
            if (grid[ty][tx] !== 1) continue;

            const wp = _tileToWorld(tx, ty, stageX, stageZ);

            // Floor tile
            const floor = new THREE.Mesh(floorGeo, _floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(wp.x, DUNGEON_OFFSET_Y + 0.01, wp.z);
            floor.receiveShadow = true;
            scene.add(floor);
            meshes.push(floor);

            // Ceiling tile
            const ceil = new THREE.Mesh(ceilGeo, _ceilMat);
            ceil.rotation.x = Math.PI / 2;
            ceil.position.set(wp.x, DUNGEON_OFFSET_Y + WALL_H, wp.z);
            scene.add(ceil);
            meshes.push(ceil);

            // Wall faces: add a face wherever a neighbor tile is a wall (or OOB)
            const neighbors = [
                { dx: 0,  dy: -1, side: 'N' },
                { dx: 0,  dy:  1, side: 'S' },
                { dx: -1, dy:  0, side: 'W' },
                { dx:  1, dy:  0, side: 'E' },
            ];
            for (const nb of neighbors) {
                const nx = tx + nb.dx, ny = ty + nb.dy;
                const isWall = nx < 0 || ny < 0 || nx >= DUNGEON_W || ny >= DUNGEON_H || grid[ny][nx] === 0;
                if (isWall) _addWall(tx, ty, nb.side);
            }
        }
    }

    return { meshes, torches };
}

// ============================================================
// Dungeon monsters (separate from overworld monsters)
// ============================================================

const _invParentQ = new THREE.Quaternion();

function _buildDungeonArcMesh() {
    const segments  = 12;
    const range     = 2.4;
    const halfAngle = Math.PI * 0.4;
    const vertices  = [];
    const indices   = [];

    vertices.push(0, 0.05, 0);
    for (let i = 0; i <= segments; i++) {
        const t   = i / segments;
        const ang = -halfAngle + t * halfAngle * 2;
        vertices.push(Math.sin(ang) * range, 0.05, Math.cos(ang) * range);
    }
    for (let i = 0; i < segments; i++) indices.push(0, i + 1, i + 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);

    const mat = new THREE.MeshBasicMaterial({
        color: 0xcc0066,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    return mesh;
}

class DungeonMonster {
    constructor(scene, type, worldPos, isBoss = false) {
        this.type      = type;
        this.def       = isBoss ? DUNGEON_BOSS_DEF : DUNGEON_MONSTER_DEFS[type];
        this.isBoss    = isBoss;
        this.hp        = this.def.hp;
        this.maxHp     = this.def.hp;
        this.alive     = true;
        this.dying     = false;
        this.deathTimer = 0;
        this.scene     = scene;
        this.atkCd     = 0;
        this.flashTimer= 0;
        this.state     = 'idle';
        this.arcMesh   = null;
        this.arcTimer  = 0;
        this.knockVx   = 0;
        this.knockVz   = 0;

        this.mesh = this._buildMesh();
        this.mesh.position.copy(worldPos);
        this.mesh.position.y = DUNGEON_OFFSET_Y;
        scene.add(this.mesh);
    }

    _buildMesh() {
        return _buildCreatureMesh(this.def, this.isBoss);
    }

    takeDamage(amount, fromPos) {
        if (!this.alive) return;
        this.hp = Math.max(0, this.hp - amount);

        const pct = this.hp / this.maxHp;
        const bar = this.mesh.userData.hpBar;
        if (bar) {
            bar.scale.x = pct;
            bar.position.x = -(1 - pct) * 0.4 * this.def.scale;
            bar.material.color.setHex(pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffaa00 : 0xee2222);
        }

        playMonsterHit();
        playMonsterGrunt(this.def.scale);

        // Knockback
        if (fromPos) {
            const kx = this.mesh.position.x - fromPos.x;
            const kz = this.mesh.position.z - fromPos.z;
            const klen = Math.sqrt(kx * kx + kz * kz) || 1;
            const force = 4.0 / Math.max(0.5, this.def.scale);
            this.knockVx = (kx / klen) * force;
            this.knockVz = (kz / klen) * force;
        }

        if (this.state === 'idle') this.state = 'chase';

        this.flashTimer = 0.14;
        const bodyMesh = this.mesh.children.find(c => c.name === 'body');
        if (bodyMesh) bodyMesh.material.color.setHex(0xffffff);

        events.emit('message', `Hit ${this.def.label} for ${amount} dmg!`, '#ffcc88');
        if (this.hp <= 0) this._die();
    }

    _die() {
        this.alive = false;
        this.dying = true;
        this.deathTimer = 0.8;
        if (this.arcMesh) { this.scene.remove(this.arcMesh); this.arcMesh = null; }
        this.arcTimer = 0;
        playMonsterDie();

        state.addXp(this.def.xp);
        state.addGold(this.def.gold);
        events.emit('playerGoldChanged', state.gold);

        for (const [res, amt] of Object.entries(this.def.drops)) {
            if (amt > 0) state.addResource(res, amt);
        }

        const dropStr = Object.entries(this.def.drops)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');

        if (this.isBoss) {
            // Award huge bonus resources to village
            const vr = this.def.villageReward;
            state.addGold(vr.gold);
            for (const [res, amt] of Object.entries(vr)) {
                if (res !== 'gold' && amt > 0) state.addResource(res, amt);
            }
            const bonusStr = Object.entries(vr).map(([k, v]) => `${v} ${k}`).join(', ');
            events.emit('message', `DUNGEON LORD DEFEATED! Village rewarded: +${bonusStr}!`, '#ffcc00');
            events.emit('message', `${this.def.label} slain! +${this.def.xp} XP, +${this.def.gold} gold, ${dropStr}.`, '#ffcc00');
            events.emit('dungeonBossKilled');
        } else {
            events.emit('message',
                `${this.def.label} slain! +${this.def.xp} XP, +${this.def.gold} gold${dropStr ? ', +' + dropStr : ''}.`,
                '#88ddff');
        }

        events.emit('monsterKilled', this.type);
    }

    updateDeath(dt) {
        this.deathTimer -= dt;
        const progress = Math.max(0, 1 - this.deathTimer / 0.8);
        const bodyMesh = this.mesh.children.find(c => c.name === 'body');
        if (bodyMesh) {
            bodyMesh.material.opacity = 1 - progress;
            bodyMesh.material.color.setHex(this.def.color);
        }
        this.mesh.scale.setScalar(1 - progress * 0.5);
        if (this.deathTimer <= 0) {
            this.scene.remove(this.mesh);
            this.dying = false;
        }
    }

    update(dt, playerPos, camera) {
        if (!this.alive) return;

        const dist = this.mesh.position.distanceTo(playerPos);

        if (this.state === 'idle') {
            if (dist < AGGRO_RANGE) this.state = 'chase';
            // Wraith: drift/bob
            if (this.type === 'dungeon_wraith') {
                this.mesh.position.y = DUNGEON_OFFSET_Y + Math.sin(Date.now() * 0.002) * 0.3 + 0.2;
            }
        } else if (this.state === 'chase') {
            if (dist > LOSE_RANGE) { this.state = 'idle'; return; }

            const dir = new THREE.Vector3()
                .subVectors(playerPos, this.mesh.position)
                .setY(0)
                .normalize();

            const speed = this.def.speed * dt;
            this.mesh.position.x += dir.x * speed;
            this.mesh.position.z += dir.z * speed;
            // +PI so the mesh's -Z face points toward the player
            this.mesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;

            if (this.type === 'dungeon_wraith') {
                this.mesh.position.y = DUNGEON_OFFSET_Y + Math.sin(Date.now() * 0.002) * 0.3 + 0.2;
            }

            if (dist < 1.6) this.state = 'attack';
        } else if (this.state === 'attack') {
            if (dist > 2.5) { this.state = 'chase'; return; }

            // Always face player while attacking
            const dir2 = new THREE.Vector3()
                .subVectors(playerPos, this.mesh.position)
                .setY(0)
                .normalize();
            this.mesh.rotation.y = Math.atan2(dir2.x, dir2.z) + Math.PI;

            this.atkCd -= dt;
            if (this.atkCd <= 0) {
                this.atkCd = 1.0 + Math.random() * 0.8;
                const dmg  = this.def.atk + Math.floor(Math.random() * 8);
                state.takeDamage(dmg);
                playPlayerHurt();
                events.emit('message', `${this.def.label} hit you for ${dmg} damage!`, '#ff6666');

                // Spawn attack swish arc
                if (this.arcMesh) { this.scene.remove(this.arcMesh); this.arcMesh = null; }
                this.arcMesh = _buildDungeonArcMesh();
                this.arcMesh.position.set(
                    this.mesh.position.x,
                    this.mesh.position.y + 0.05,
                    this.mesh.position.z
                );
                this.arcMesh.rotation.y = Math.atan2(dir2.x, dir2.z);
                this.scene.add(this.arcMesh);
                this.arcTimer = 0.22;
            }
        }

        // Boss: pulsing aura
        if (this.isBoss) {
            const aura = this.mesh.children.find(c => c.name === 'aura');
            if (aura) {
                aura.material.opacity = 0.15 + Math.sin(Date.now() * 0.003) * 0.12;
                const sc = 1.0 + Math.sin(Date.now() * 0.004) * 0.08;
                aura.scale.setScalar(sc);
            }
        }

        // Knockback decay
        if (this.knockVx !== 0 || this.knockVz !== 0) {
            const decay = Math.exp(-12 * dt);
            this.mesh.position.x += this.knockVx * dt;
            this.mesh.position.z += this.knockVz * dt;
            this.knockVx *= decay;
            this.knockVz *= decay;
            if (Math.abs(this.knockVx) < 0.05 && Math.abs(this.knockVz) < 0.05) {
                this.knockVx = 0; this.knockVz = 0;
            }
        }

        // Wing flap animation
        if (this.def.hasWings) {
            this.mesh.userData.wingTimer = (this.mesh.userData.wingTimer || 0) + dt * 3;
            for (const child of this.mesh.children) {
                if (child.userData.isWing) {
                    const side = child.position.x > 0 ? 1 : -1;
                    child.rotation.z = side * (0.35 + Math.sin(this.mesh.userData.wingTimer) * 0.28);
                }
            }
        }

        // Billboard HP bar
        const bar = this.mesh.userData.hpBar;
        if (bar && camera) {
            this.mesh.getWorldQuaternion(_invParentQ).invert();
            bar.quaternion.multiplyQuaternions(_invParentQ, camera.quaternion);
        }

        // Flash restore
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                const bodyMesh = this.mesh.children.find(c => c.name === 'body');
                if (bodyMesh) bodyMesh.material.color.setHex(this.def.color);
            }
        }

        // Fade out attack arc
        if (this.arcTimer > 0) {
            this.arcTimer -= dt;
            if (this.arcMesh) {
                this.arcMesh.material.opacity = Math.max(0, 0.6 * (this.arcTimer / 0.22));
                if (this.arcTimer <= 0) {
                    this.scene.remove(this.arcMesh);
                    this.arcMesh = null;
                }
            }
        }
    }
}

// ============================================================
// Treasure chest
// ============================================================

const _chestLidGeo  = new THREE.BoxGeometry(0.7, 0.25, 0.6);
const _chestBodyGeo = new THREE.BoxGeometry(0.7, 0.4,  0.6);
const _chestMat     = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
const _chestLidMat  = new THREE.MeshLambertMaterial({ color: 0x7a4a1a });
const _chestGoldMat = new THREE.MeshBasicMaterial({ color: 0xc8a844 });
const _chestLockGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);

class TreasureChest {
    constructor(scene, worldPos, rewardIdx) {
        this.scene     = scene;
        this.pos       = worldPos.clone();
        this.pos.y     = DUNGEON_OFFSET_Y;
        this.reward    = TREASURE_DEFS[rewardIdx % TREASURE_DEFS.length];
        this.collected = false;

        this.mesh = new THREE.Group();

        const body = new THREE.Mesh(_chestBodyGeo, _chestMat.clone());
        body.position.y = 0.2;
        this.mesh.add(body);

        const lid = new THREE.Mesh(_chestLidGeo, _chestLidMat.clone());
        lid.position.y = 0.525;
        this.mesh.add(lid);

        const lock = new THREE.Mesh(_chestLockGeo, _chestGoldMat);
        lock.position.set(0, 0.52, -0.305);
        this.mesh.add(lock);

        // Glow ring around chest
        const ringGeo = new THREE.TorusGeometry(0.55, 0.04, 6, 20);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xc8a844, transparent: true, opacity: 0.7 });
        this.ring = new THREE.Mesh(ringGeo, ringMat);
        this.ring.rotation.x = Math.PI / 2;
        this.ring.position.y = 0.02;
        this.mesh.add(this.ring);

        this.mesh.position.copy(this.pos);
        scene.add(this.mesh);
    }

    collect() {
        if (this.collected) return;
        this.collected = true;

        // Grant rewards
        state.addGold(this.reward.gold);
        for (const [res, amt] of Object.entries(this.reward)) {
            if (res !== 'gold' && amt > 0) state.addResource(res, amt);
        }

        playGoldPickup();

        const rewardStr = Object.entries(this.reward)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
        events.emit('message', `Treasure chest opened! +${rewardStr}`, '#c8a844');

        // Animate lid opening
        const lid = this.mesh.children[1];
        let t = 0;
        const _animOpen = setInterval(() => {
            t += 0.05;
            if (lid) lid.rotation.x = -Math.min(t, 1.2);
            if (t >= 1.2) {
                clearInterval(_animOpen);
                // Fade out after a moment
                setTimeout(() => this.scene.remove(this.mesh), 2000);
            }
        }, 16);

        // Hide ring immediately
        this.ring.visible = false;
    }

    update(dt) {
        if (this.collected) return;
        // Pulse ring
        this.ring.material.opacity = 0.4 + Math.sin(Date.now() * 0.004) * 0.3;
    }
}

// ============================================================
// Overworld entrance marker
// ============================================================

function _buildEntranceMesh(scene, worldPos) {
    const group = new THREE.Group();
    group.position.copy(worldPos);
    group.position.y = 0;

    // Stone archway base (two pillars + lintel)
    const pillarGeo = new THREE.BoxGeometry(0.4, 3.0, 0.4);
    const stoneMat  = new THREE.MeshLambertMaterial({ color: 0x555544 });
    const lintelGeo = new THREE.BoxGeometry(2.2, 0.4, 0.4);

    const pillarL = new THREE.Mesh(pillarGeo, stoneMat.clone());
    pillarL.position.set(-0.9, 1.5, 0);
    pillarL.castShadow = true;
    group.add(pillarL);

    const pillarR = new THREE.Mesh(pillarGeo, stoneMat.clone());
    pillarR.position.set(0.9, 1.5, 0);
    pillarR.castShadow = true;
    group.add(pillarR);

    const lintel = new THREE.Mesh(lintelGeo, stoneMat.clone());
    lintel.position.set(0, 3.0, 0);
    lintel.castShadow = true;
    group.add(lintel);

    // Dark portal fill (rectangle)
    const portalGeo = new THREE.PlaneGeometry(1.6, 2.8);
    const portalMat = new THREE.MeshBasicMaterial({ color: 0x110022, side: THREE.DoubleSide });
    const portal    = new THREE.Mesh(portalGeo, portalMat);
    portal.position.set(0, 1.4, 0.01);
    group.add(portal);

    // Swirling purple point light above portal
    const portalLight = new THREE.PointLight(0x8833cc, 1.5, 10, 2);
    portalLight.position.set(0, 2.0, 0);
    group.add(portalLight);
    group.userData.portalLight = portalLight;

    // Ground circle
    const circleGeo = new THREE.CircleGeometry(2.5, 20);
    const circleMat = new THREE.MeshLambertMaterial({ color: 0x2a2233 });
    const circle    = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.01;
    group.add(circle);

    scene.add(group);
    return group;
}

// ============================================================
// Exit portal (inside dungeon)
// ============================================================

function _buildExitPortal(scene, worldPos) {
    const group = new THREE.Group();
    group.position.copy(worldPos);
    group.position.y = DUNGEON_OFFSET_Y;

    const ringGeo = new THREE.TorusGeometry(1.0, 0.12, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x44aaff });
    const ring    = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    const fillGeo = new THREE.CircleGeometry(0.9, 20);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x113355, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const fill    = new THREE.Mesh(fillGeo, fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.06;
    group.add(fill);

    const light = new THREE.PointLight(0x4488ff, 1.2, 8, 2);
    light.position.y = 1.0;
    group.add(light);
    group.userData.exitLight = light;

    scene.add(group);
    return group;
}

// ============================================================
// Main dungeon class
// ============================================================

class Dungeon {
    constructor(scene, worldPos, index) {
        this.scene      = scene;
        this.worldPos   = worldPos;   // overworld entrance position
        this.index      = index;
        this.cleared    = false;      // boss killed?
        this.active     = false;      // player currently inside?

        // Per-dungeon staging slot (each dungeon gets its own slot in the staging area)
        this.stageX = DUNGEON_BASE_X + index * DUNGEON_SPACING;
        this.stageZ = DUNGEON_BASE_Z;

        // Generate layout
        const { grid, rooms, entryTile, exitTile } = _generateLayout();
        this.grid     = grid;
        this.rooms    = rooms;
        this.entryTile = entryTile;
        this.exitTile  = exitTile;

        // Convert tiles to world positions (in staging area)
        this.entryWorldPos = _tileToWorld(entryTile.x, entryTile.y, this.stageX, this.stageZ);
        this.exitWorldPos  = _tileToWorld(exitTile.x,  exitTile.y,  this.stageX, this.stageZ);

        // Overworld entrance marker (always visible)
        this.entranceMesh = _buildEntranceMesh(scene, worldPos);

        // Dungeon geometry (built once, hidden until entered)
        const { meshes, torches } = _buildDungeonMeshes(scene, grid, this.stageX, this.stageZ);
        this.dungeonMeshes = meshes;
        this.torches       = torches;

        // Exit portal
        this.exitPortal = _buildExitPortal(scene, this.exitWorldPos);

        // Monsters
        this.monsters = [];
        this._spawnMonsters(scene, rooms);

        // Treasure chests
        this.chests = [];
        this._spawnChests(scene, rooms);

        // Hide dungeon geometry by default
        this._setDungeonVisible(false);
    }

    _spawnMonsters(scene, rooms) {
        const types = Object.keys(DUNGEON_MONSTER_DEFS);

        // Regular monsters — skip first room (entry) and last (boss)
        for (let i = 1; i < rooms.length - 1; i++) {
            const room    = rooms[i];
            const count   = _rng(1, 3);
            for (let j = 0; j < count; j++) {
                const type = types[Math.floor(Math.random() * types.length)];
                const tx   = room.x + _rng(1, Math.max(1, room.w - 2));
                const ty   = room.y + _rng(1, Math.max(1, room.h - 2));
                const pos  = _tileToWorld(tx, ty, this.stageX, this.stageZ);
                this.monsters.push(new DungeonMonster(scene, type, pos, false));
            }
        }

        // Boss in last room
        const bossRoom = rooms[rooms.length - 1];
        const bossPos  = _tileToWorld(bossRoom.cx, bossRoom.cy, this.stageX, this.stageZ);
        this.boss = new DungeonMonster(scene, 'boss', bossPos, true);
        this.monsters.push(this.boss);

        events.on('dungeonBossKilled', () => {
            if (this.active) {
                this.cleared = true;
                events.emit('message', 'The dungeon has been cleared!', '#ffee44');
            }
        });
    }

    _spawnChests(scene, rooms) {
        // Place chests in middle rooms
        const midRooms = rooms.slice(1, rooms.length - 1);
        const chestCount = Math.min(midRooms.length, _rng(2, 4));
        const shuffled   = [...midRooms].sort(() => Math.random() - 0.5);

        for (let i = 0; i < chestCount; i++) {
            const room = shuffled[i];
            const tx   = room.x + Math.floor(room.w / 2);
            const ty   = room.y + Math.floor(room.h / 2);
            const pos  = _tileToWorld(tx, ty, this.stageX, this.stageZ);
            this.chests.push(new TreasureChest(scene, pos, i));
        }
    }

    _setDungeonVisible(visible) {
        for (const m of this.dungeonMeshes) m.visible = visible;
        for (const t of this.torches) {
            t.light.visible = visible;
        }
        this.exitPortal.visible = visible;
        for (const m of this.monsters) {
            if (m.mesh) m.mesh.visible = visible;
        }
        for (const c of this.chests) {
            if (c.mesh) c.mesh.visible = visible;
        }
    }

    enter() {
        this.active = true;
        this.entranceMesh.visible = false;  // hide overworld marker while inside
        this._setDungeonVisible(true);
    }

    exit() {
        this.active = false;
        this.entranceMesh.visible = true;
        this._setDungeonVisible(false);
    }

    /** Returns movement bounds for inside the dungeon */
    getStageBounds() {
        const halfW = (DUNGEON_W * TILE) / 2;
        const halfH = (DUNGEON_H * TILE) / 2;
        return {
            minX: this.stageX - halfW + 1,
            maxX: this.stageX + halfW - 1,
            minZ: this.stageZ - halfH + 1,
            maxZ: this.stageZ + halfH - 1,
        };
    }

    /** Returns the world-space player spawn position when entering */
    getEntryPlayerPos() {
        return this.entryWorldPos.clone().add(new THREE.Vector3(0, 0, 1.5));
    }

    /** Returns the world-space player spawn position when exiting back to overworld */
    getExitPlayerPos() {
        return this.worldPos.clone().add(new THREE.Vector3(0, 0, 3));
    }

    update(dt, playerPos, camera) {
        if (!this.active) return;

        // Update monsters
        for (const m of this.monsters) {
            if (m.dying) { m.updateDeath(dt); continue; }
            if (m.alive)  m.update(dt, playerPos, camera);
        }

        // Cleanup dead monsters from array every so often
        // (simple: just filter when all are dead)

        // Update chest animations
        for (const c of this.chests) c.update(dt);

        // Torch flicker
        for (const t of this.torches) {
            t.phase += dt * 5.5;
            t.light.intensity = TORCH_BASE_INT + Math.sin(t.phase) * TORCH_FLICKER * 0.5 + Math.sin(t.phase * 2.3) * TORCH_FLICKER * 0.5;
            if (t.flame) t.flame.material.color.setHex(
                Math.sin(t.phase * 1.7) > 0 ? 0xff9933 : 0xff6611
            );
        }

        // Exit portal pulse
        if (this.exitPortal.userData.exitLight) {
            this.exitPortal.userData.exitLight.intensity = 1.0 + Math.sin(Date.now() * 0.003) * 0.4;
        }

        // Entrance portal flicker (overworld side — update even when not active to animate on map)
    }

    updateOverworld(dt) {
        // Animate the portal light on the entrance even while player is in overworld
        if (this.entranceMesh.userData.portalLight) {
            this.entranceMesh.userData.portalLight.intensity =
                1.2 + Math.sin(Date.now() * 0.0025 + this.index) * 0.5;
        }
    }

    /** Check if player is near a chest and collect it */
    checkChestCollect(playerPos) {
        for (const c of this.chests) {
            if (!c.collected && playerPos.distanceTo(c.pos) < 2.2) {
                c.collect();
                return true;
            }
        }
        return false;
    }

    /** Is the player near the exit portal? */
    isNearExit(playerPos) {
        return playerPos.distanceTo(this.exitWorldPos) < 3.0;
    }

    /** Get alive monsters list (for hit detection by player attack system) */
    get aliveMonsters() {
        return this.monsters.filter(m => m.alive);
    }
}

// ============================================================
// Public init function
// ============================================================

export function initDungeons(scene) {
    const dungeons = [];
    const usedPositions = [];

    for (let i = 0; i < DUNGEON_COUNT; i++) {
        const pos = _randomWorldPos(DUNGEON_MIN_DIST, DUNGEON_MAX_DIST, usedPositions);
        usedPositions.push(pos);
        dungeons.push(new Dungeon(scene, pos, i));
    }

    // Which dungeon the player is currently in (-1 = overworld)
    let activeDungeonIdx = -1;

    function getCurrentDungeon() {
        return activeDungeonIdx >= 0 ? dungeons[activeDungeonIdx] : null;
    }

    /**
     * Call when player presses E near an entrance.
     * Returns true if player was teleported into a dungeon.
     * playerGroup is the Three.js group to reposition.
     */
    function tryEnterDungeon(playerPos, playerGroup) {
        if (activeDungeonIdx >= 0) return false; // already inside

        for (let i = 0; i < dungeons.length; i++) {
            const d = dungeons[i];
            if (playerPos.distanceTo(d.worldPos) < 3.5) {
                activeDungeonIdx = i;
                d.enter();
                const spawnPos = d.getEntryPlayerPos();
                playerGroup.position.copy(spawnPos);
                events.emit('message', `Entered dungeon ${i + 1}. Find the Dungeon Lord and defeat it!`, '#aa66ff');
                return true;
            }
        }
        return false;
    }

    /**
     * Call when player presses E near the exit portal.
     * Returns true if player was teleported back to overworld.
     */
    function tryExitDungeon(playerPos, playerGroup) {
        if (activeDungeonIdx < 0) return false;

        const d = dungeons[activeDungeonIdx];
        if (d.isNearExit(playerPos)) {
            const returnPos = d.getExitPlayerPos();
            d.exit();
            activeDungeonIdx = -1;
            playerGroup.position.copy(returnPos);
            events.emit('message', 'You emerge from the dungeon.', '#88aaff');
            return true;
        }
        return false;
    }

    /**
     * Try collecting a chest (call on E press inside dungeon).
     */
    function tryCollectChest(playerPos) {
        const d = getCurrentDungeon();
        if (!d) return false;
        return d.checkChestCollect(playerPos);
    }

    /**
     * Returns monsters in active dungeon for player attack hit-testing.
     */
    function getActiveDungeonMonsters() {
        const d = getCurrentDungeon();
        return d ? d.aliveMonsters : [];
    }

    function isInDungeon() {
        return activeDungeonIdx >= 0;
    }

    function update(dt, playerPos, camera) {
        for (let i = 0; i < dungeons.length; i++) {
            const d = dungeons[i];
            if (i === activeDungeonIdx) {
                d.update(dt, playerPos, camera);
            } else {
                d.updateOverworld(dt);
            }
        }
    }

    // Expose entrance positions for minimap
    const dungeonEntrances = dungeons.map(d => d.worldPos);

    return {
        dungeons,
        dungeonEntrances,
        update,
        tryEnterDungeon,
        tryExitDungeon,
        tryCollectChest,
        getActiveDungeonMonsters,
        isInDungeon,
        getCurrentDungeon,
    };
}
