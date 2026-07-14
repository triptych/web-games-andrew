/**
 * path.js — procedural endless path: chunk streaming, road width, town layout.
 *
 * The path runs along +Z. Chunks are generated ahead of the player's
 * distance and disposed once they fall far enough behind. Each chunk is
 * either 'road' (monster spawns, plain ground) or 'town' (safe, distinct
 * color, no monster spawns) — town chunks recur every CHUNKS_BETWEEN_TOWNS
 * road chunks.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { events } from './events.js';
import {
    CHUNK_LENGTH, CHUNKS_BETWEEN_TOWNS, ROAD_WIDTH,
    CHUNKS_AHEAD, CHUNKS_BEHIND, COLORS,
} from './config.js';

const TOWN_COLOR = 0x3a3322;

// Worn dirt/cobblestone road texture (tiled along the road's length) so the
// path reads as a fantasy trail, not painted asphalt with lane markings.
let _roadTexture = null;
function _getRoadTexture() {
    if (_roadTexture) return _roadTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Base dirt tone.
    ctx.fillStyle = '#5a4a34';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scattered cobblestones — irregular blotches, not a grid, so it reads
    // as packed dirt/stone rather than a tiled brick pattern.
    for (let i = 0; i < 90; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 3 + Math.random() * 6;
        const shade = 40 + Math.random() * 50;
        ctx.fillStyle = `rgb(${shade + 40}, ${shade + 28}, ${shade + 12})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.6 + Math.random() * 0.4), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dark grooves/ruts worn into the path by travel.
    ctx.strokeStyle = 'rgba(30, 22, 14, 0.5)';
    ctx.lineWidth = 2;
    for (const x of [canvas.width * 0.3, canvas.width * 0.7]) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.random() - 0.5) * 10, canvas.height);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    _roadTexture = tex;
    return tex;
}

let _chunks = [];       // { index, type, z0, z1, mesh, monsterSpawned }
let _nextIndex = 0;
let _roadChunksSinceTown = 0;
let _inTown = false;

export function initPath() {
    _chunks.forEach(_disposeChunk);
    _chunks = [];
    _nextIndex = 0;
    _roadChunksSinceTown = 0;
    _inTown = false;

    for (let i = 0; i < CHUNKS_AHEAD; i++) _spawnNextChunk();
}

/** Call every frame with the player's current distance along the path. */
export function updatePath(playerDistance) {
    // Keep generating ahead of the player.
    while (_chunks.length === 0 || _lastChunk().z1 < playerDistance + CHUNKS_AHEAD * CHUNK_LENGTH) {
        _spawnNextChunk();
    }

    // Dispose chunks far behind the player.
    while (_chunks.length > 0 && _chunks[0].z1 < playerDistance - CHUNKS_BEHIND * CHUNK_LENGTH) {
        _disposeChunk(_chunks.shift());
    }

    // Detect town enter/exit based on which chunk the player currently occupies.
    const current = _chunks.find((c) => playerDistance >= c.z0 && playerDistance < c.z1);
    if (current) {
        if (current.type === 'town' && !_inTown) {
            _inTown = true;
            events.emit('townEntered', current);
        } else if (current.type !== 'town' && _inTown) {
            _inTown = false;
            events.emit('townExited');
        }
    }
}

/** Returns the road-edge clamp (world X) at a given distance — constant for now. */
export function getRoadHalfWidth() {
    return ROAD_WIDTH / 2;
}

/** Returns the chunk (if any) the given distance falls within. */
export function getChunkAt(distance) {
    return _chunks.find((c) => distance >= c.z0 && distance < c.z1) ?? null;
}

function _lastChunk() {
    return _chunks[_chunks.length - 1];
}

function _spawnNextChunk() {
    const z0 = _nextIndex * CHUNK_LENGTH;
    const z1 = z0 + CHUNK_LENGTH;

    let type = 'road';
    if (_nextIndex > 0 && _roadChunksSinceTown >= CHUNKS_BETWEEN_TOWNS) {
        type = 'town';
        _roadChunksSinceTown = 0;
    } else {
        _roadChunksSinceTown++;
    }

    const chunk = {
        index: _nextIndex,
        type,
        z0, z1,
        monsterSpawned: false,
        mesh: null,
    };
    chunk.mesh = _buildChunkMesh(chunk);
    scene.add(chunk.mesh);

    _chunks.push(chunk);
    _nextIndex++;
    events.emit('chunkSpawned', chunk);
    return chunk;
}

// Wide backdrop strip so the ground reads as continuous terrain rather than
// stopping dead at the road's edge (the actual road plane sits on top).
const TERRAIN_WIDTH = ROAD_WIDTH + 60;

function _buildChunkMesh(chunk) {
    const group = new THREE.Group();
    const cz = chunk.z0 + CHUNK_LENGTH / 2;

    // Grass/dirt terrain strip flanking the road, so the world doesn't cut
    // off into the void past the road edges.
    const terrain = new THREE.Mesh(
        new THREE.PlaneGeometry(TERRAIN_WIDTH, CHUNK_LENGTH),
        new THREE.MeshStandardMaterial({ color: chunk.type === 'town' ? 0x3a3a28 : 0x1c2e1a }),
    );
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(0, -0.02, cz);
    group.add(terrain);

    // Road chunks get a worn dirt/cobblestone texture; town chunks keep a
    // flat packed-earth color so the safe zone still reads as distinct.
    const groundMat = chunk.type === 'town'
        ? new THREE.MeshStandardMaterial({ color: TOWN_COLOR })
        : new THREE.MeshStandardMaterial({ map: _getRoadTexture() });
    if (chunk.type !== 'town') {
        const tex = groundMat.map;
        groundMat.map = tex.clone();
        groundMat.map.needsUpdate = true;
        groundMat.map.repeat.set(1, CHUNK_LENGTH / 8);
    }

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LENGTH),
        groundMat,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, cz);
    group.add(ground);

    // Low stone curb along the road's edges — reads as a worn trail border,
    // not a painted/reflective modern lane marking.
    const edgeGeo = new THREE.BoxGeometry(0.3, 0.3, CHUNK_LENGTH);
    const edgeMat = new THREE.MeshStandardMaterial({
        color: chunk.type === 'town' ? COLORS.gold : 0x6b6558,
    });
    for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(side * (ROAD_WIDTH / 2), 0.15, cz);
        group.add(edge);
    }

    if (chunk.type === 'town') {
        // Placeholder "buildings" flanking the safe zone so towns read distinctly.
        const buildingGeo = new THREE.BoxGeometry(4, 5, 4);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x554433 });
        for (const side of [-1, 1]) {
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.position.set(side * (ROAD_WIDTH / 2 + 3), 2.5, cz);
            group.add(b);
        }
    } else {
        _addForest(group, chunk);
    }

    _addBackgroundHills(group, chunk);

    return group;
}

const _treeGeoCache = {
    trunk: new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6),
    foliage: new THREE.ConeGeometry(1.1, 2.2, 7),
};

/** Scatters a handful of simple cone-and-trunk trees on both sides of a road chunk. */
function _addForest(group, chunk) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.trunk });
    const perSide = 3 + Math.floor(Math.random() * 3);
    for (const side of [-1, 1]) {
        for (let i = 0; i < perSide; i++) {
            const x = side * (ROAD_WIDTH / 2 + 2 + Math.random() * 22);
            const z = chunk.z0 + Math.random() * CHUNK_LENGTH;
            const scale = 0.8 + Math.random() * 0.9;
            const foliageMat = new THREE.MeshStandardMaterial({
                color: Math.random() < 0.5 ? COLORS.foliage : COLORS.foliageDark,
            });

            const trunk = new THREE.Mesh(_treeGeoCache.trunk, trunkMat);
            trunk.scale.setScalar(scale);
            trunk.position.set(x, 0.8 * scale, z);
            group.add(trunk);

            const foliage = new THREE.Mesh(_treeGeoCache.foliage, foliageMat);
            foliage.scale.setScalar(scale);
            foliage.position.set(x, 1.9 * scale, z);
            group.add(foliage);
        }
    }
}

const _hillGeoCache = new THREE.ConeGeometry(1, 1, 8);

/** Low-detail hill silhouettes far off both sides of the road for depth/backdrop. */
function _addBackgroundHills(group, chunk) {
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.hills });
    const cz = chunk.z0 + CHUNK_LENGTH / 2;
    for (const side of [-1, 1]) {
        const count = 2;
        for (let i = 0; i < count; i++) {
            const hill = new THREE.Mesh(_hillGeoCache, mat);
            const width = 18 + Math.random() * 20;
            const height = 10 + Math.random() * 14;
            hill.scale.set(width, height, width);
            hill.position.set(
                side * (45 + Math.random() * 25),
                0,
                cz + (Math.random() - 0.5) * CHUNK_LENGTH,
            );
            group.add(hill);
        }
    }
}

// Geometries reused across every chunk (trees, hills) must never be disposed
// per-chunk — other still-live chunks reference the same instance.
const _sharedGeometries = new Set([
    _treeGeoCache.trunk, _treeGeoCache.foliage, _hillGeoCache,
]);

function _disposeChunk(chunk) {
    scene.remove(chunk.mesh);
    chunk.mesh.traverse((obj) => {
        if (obj.geometry && !_sharedGeometries.has(obj.geometry)) obj.geometry.dispose();
        if (obj.material) {
            // material.dispose() does NOT dispose textures attached to it —
            // the road ground material clones its own texture per chunk
            // (see _buildChunkMesh), so that clone must be freed explicitly
            // or every passed chunk leaks a 128x128 canvas texture on the GPU.
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    });
}
