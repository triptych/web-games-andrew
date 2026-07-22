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
        _addTown(group, chunk);
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

const _townGeoCache = {
    building: new THREE.BoxGeometry(1, 1, 1),   // scaled per-building
    roof: new THREE.ConeGeometry(1, 1, 4),      // scaled per-building, rotated 45deg
    wellWall: new THREE.CylinderGeometry(0.9, 0.9, 0.8, 10),
    wellRoofPost: new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6),
    stallTop: new THREE.BoxGeometry(1.8, 0.1, 1.4),
    stallLeg: new THREE.CylinderGeometry(0.05, 0.05, 1, 6),
};

const BUILDING_COLORS = [0x554433, 0x5c4a38, 0x4a3d30, 0x63503c];
const ROOF_COLORS     = [0x7a3030, 0x6b3a28, 0x5a3838];

/**
 * Builds a small village: a couple of houses with peaked roofs flanking
 * the road (count/size/color varied so towns don't all look identical),
 * plus a well centered as a landmark and a market stall for flavor.
 */
function _addTown(group, chunk) {
    const cz = chunk.z0 + CHUNK_LENGTH / 2;
    const perSide = 1 + Math.floor(Math.random() * 2); // 1-2 buildings per side

    for (const side of [-1, 1]) {
        for (let i = 0; i < perSide; i++) {
            const w = 3 + Math.random() * 2;
            const h = 3.5 + Math.random() * 2.5;
            const d = 3 + Math.random() * 2;
            const x = side * (ROAD_WIDTH / 2 + 3 + Math.random() * 4);
            const z = cz + (i - (perSide - 1) / 2) * 7 + (Math.random() - 0.5) * 2;

            const buildingMat = new THREE.MeshStandardMaterial({
                color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
            });
            const building = new THREE.Mesh(_townGeoCache.building, buildingMat);
            building.scale.set(w, h, d);
            building.position.set(x, h / 2, z);
            group.add(building);

            const roofMat = new THREE.MeshStandardMaterial({
                color: ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)],
            });
            const roof = new THREE.Mesh(_townGeoCache.roof, roofMat);
            roof.scale.set(w * 0.8, h * 0.5, d * 0.8);
            roof.rotation.y = Math.PI / 4;
            roof.position.set(x, h + (h * 0.25), z);
            group.add(roof);
        }
    }

    _addWell(group, cz);
    _addStall(group, cz);
}

const WELL_STONE = 0x8a8378;

/** A stone well centered on the road as a small landmark/checkpoint feel. */
function _addWell(group, cz) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: WELL_STONE });
    const wall = new THREE.Mesh(_townGeoCache.wellWall, stoneMat);
    wall.position.set(0, 0.4, cz);
    group.add(wall);

    const woodMat = new THREE.MeshStandardMaterial({ color: COLORS.trunk });
    for (const dx of [-0.7, 0.7]) {
        const post = new THREE.Mesh(_townGeoCache.wellRoofPost, woodMat);
        post.position.set(dx, 1.6, cz);
        group.add(post);
    }
    const roofMat = new THREE.MeshStandardMaterial({ color: ROOF_COLORS[0] });
    const roof = new THREE.Mesh(_townGeoCache.roof, roofMat);
    roof.scale.set(2.2, 0.9, 1.6);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 2.5, cz);
    group.add(roof);
}

/** A simple market stall off to one side — pure flavor, no interaction. */
function _addStall(group, cz) {
    const woodMat = new THREE.MeshStandardMaterial({ color: COLORS.trunk });
    const clothMat = new THREE.MeshStandardMaterial({ color: COLORS.danger });
    const x = ROAD_WIDTH / 2 + 1.2;
    const z = cz + 4 + (Math.random() - 0.5) * 3;

    const top = new THREE.Mesh(_townGeoCache.stallTop, clothMat);
    top.position.set(x, 1.4, z);
    group.add(top);

    for (const [ldx, ldz] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]]) {
        const leg = new THREE.Mesh(_townGeoCache.stallLeg, woodMat);
        leg.position.set(x + ldx, 0.9, z + ldz);
        group.add(leg);
    }
}

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

// Geometries reused across every chunk (trees, hills, town props) must never
// be disposed per-chunk — other still-live chunks reference the same instance.
const _sharedGeometries = new Set([
    _treeGeoCache.trunk, _treeGeoCache.foliage, _hillGeoCache,
    ...Object.values(_townGeoCache),
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
