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

const ROAD_COLOR = 0x223322;
const TOWN_COLOR = 0x3a3322;

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

function _buildChunkMesh(chunk) {
    const group = new THREE.Group();
    const color = chunk.type === 'town' ? TOWN_COLOR : ROAD_COLOR;

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LENGTH),
        new THREE.MeshStandardMaterial({ color }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, chunk.z0 + CHUNK_LENGTH / 2);
    group.add(ground);

    // Simple edge markers so the road width reads visually.
    const edgeGeo = new THREE.BoxGeometry(0.3, 0.3, CHUNK_LENGTH);
    const edgeMat = new THREE.MeshStandardMaterial({
        color: chunk.type === 'town' ? COLORS.gold : COLORS.accent,
    });
    for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(side * (ROAD_WIDTH / 2), 0.15, chunk.z0 + CHUNK_LENGTH / 2);
        group.add(edge);
    }

    if (chunk.type === 'town') {
        // Placeholder "buildings" flanking the safe zone so towns read distinctly.
        const buildingGeo = new THREE.BoxGeometry(4, 5, 4);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x554433 });
        for (const side of [-1, 1]) {
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.position.set(side * (ROAD_WIDTH / 2 + 3), 2.5, chunk.z0 + CHUNK_LENGTH / 2);
            group.add(b);
        }
    }

    return group;
}

function _disposeChunk(chunk) {
    scene.remove(chunk.mesh);
    chunk.mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    });
}
