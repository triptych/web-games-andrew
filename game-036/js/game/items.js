/**
 * items.js — procedural collectible placement: books (scattered across
 * the island, returned to the library) and artifacts (scattered, returned
 * to the museum). Placement is deterministic per seed: weighted toward
 * "flavorful" regions (books lean forest/cemetery/ruins/garden; artifacts
 * lean cave/ruins/lighthouse/shore) but with island-wide spread so players
 * have to explore everywhere.
 */

import { makeMesh, mergeMesh, buildBox, buildBlob, buildCylinder, buildCone } from '../engine/mesh.js';
import { makeRng } from '../world/noise.js';
import { BOOK_COUNT, ARTIFACT_COUNT, PICKUP_RADIUS } from '../config.js';
import { events } from '../events.js';
import { state } from '../state.js';
import { playPickupBook, playPickupArtifact } from '../sounds.js';

const BOOK_TITLES = [
    'Tidewrack Almanac', 'The Keeper\'s Log', 'Cairn & Compass', 'Leaves of the Grove',
    'A History of Silt', 'Lighthouse Watches', 'Names for the Dead', 'The Garden Ledger',
    'Cave Songs', 'Charts of a Small Sea', 'The Last Harvest', 'Notes on Migration',
];
const ARTIFACT_NAMES = [
    'Corroded Sextant', 'Bone Needle', 'Shattered Sundial', 'Tide-worn Coin',
    'Carved Antler', 'Fogged Lens', 'Iron Ring', 'Sea-glass Idol',
    'Fragment of a Bell', 'Clay Tally Stone',
];

const BOOK_REGION_WEIGHTS = { forest: 3, cemetery: 3, ruins: 2, garden: 2, meadow: 2, shore: 1, cave: 1, lighthouse: 1 };
const ARTIFACT_REGION_WEIGHTS = { cave: 3, ruins: 3, lighthouse: 2, shore: 2, cemetery: 1, forest: 1, garden: 1 };

function buildBookMesh(rng) {
    const colors = [[176, 40, 40], [40, 76, 150], [150, 120, 30], [70, 110, 60]];
    const color = colors[Math.floor(rng() * colors.length)];
    return buildBox(0.28, 0.36, 0.06, color);
}

function buildArtifactMesh(rng) {
    const t = rng();
    const color = [206, 176, 96];
    if (t < 0.33) return buildCylinder(0.16, 0.05, 8, color, true, true);
    if (t < 0.66) return buildBlob(0.22, 0, color, 0.2, rng);
    return buildCone(0.16, 0.4, 6, color);
}

/**
 * Places books and artifacts across the island. Requires the RegionMap
 * (for weighted region sampling) and Heightmap (to drop items on the ground).
 * Returns { books: [...], artifacts: [...] } with world positions + meshes.
 */
export function generateItems(seed, regionMap, heightmap) {
    const rng = makeRng(seed + 90210);
    const books = _placeSet(rng, regionMap, heightmap, BOOK_COUNT, BOOK_REGION_WEIGHTS, 'book', BOOK_TITLES, buildBookMesh);
    const artifacts = _placeSet(rng, regionMap, heightmap, ARTIFACT_COUNT, ARTIFACT_REGION_WEIGHTS, 'artifact', ARTIFACT_NAMES, buildArtifactMesh);
    return { books, artifacts };
}

function _weightedRegionPick(rng, weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    for (const [type, w] of entries) {
        if (r < w) return type;
        r -= w;
    }
    return entries[0][0];
}

function _placeSet(rng, regionMap, heightmap, count, weights, kind, names, meshBuilder) {
    const items = [];
    let attempts = 0;
    while (items.length < count && attempts < count * 40) {
        attempts++;
        const wantType = _weightedRegionPick(rng, weights);
        const seedPoint = regionMap.points.find(p => p.type === wantType);
        if (!seedPoint) continue;
        const angle = rng() * Math.PI * 2;
        const dist = rng() * 16 + 3;
        const x = seedPoint.x + Math.cos(angle) * dist;
        const z = seedPoint.z + Math.sin(angle) * dist;
        const y = heightmap.heightAt(x, z);
        if (y < 0.2) continue; // no items in water
        if (heightmap.slopeAt(x, z) > 0.55) continue;

        items.push({
            id: `${kind}_${items.length}`,
            kind,
            name: names[items.length % names.length],
            pos: [x, y, z],
            mesh: meshBuilder(rng),
            collected: false,
            bobPhase: rng() * Math.PI * 2,
        });
    }
    return items;
}

/**
 * Runtime pickup manager: checks player distance each frame, fires collection
 * events + sounds, and hides collected items from the render list.
 */
export class ItemManager {
    constructor(books, artifacts) {
        this.books = books;
        this.artifacts = artifacts;
        this.all = [...books, ...artifacts];
    }

    update(playerPos, dt, time) {
        for (const item of this.all) {
            if (item.collected) continue;
            const dx = item.pos[0] - playerPos[0];
            const dz = item.pos[2] - playerPos[2];
            const dy = (item.pos[1] + 0.3) - playerPos[1];
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq < PICKUP_RADIUS * PICKUP_RADIUS) {
                this._collect(item);
            }
        }
    }

    _collect(item) {
        item.collected = true;
        if (item.kind === 'book') {
            state.collectBook(item.id);
            playPickupBook();
        } else {
            state.collectArtifact(item.id);
            playPickupArtifact();
        }
        events.emit('itemCollected', { id: item.id, kind: item.kind, name: item.name });
    }

    /** Instances ready for the renderer: gentle bob + spin, skip collected. */
    getInstances(time) {
        const out = [];
        for (const item of this.all) {
            if (item.collected) continue;
            const bob = Math.sin(time * 1.6 + item.bobPhase) * 0.12;
            out.push({
                mesh: item.mesh,
                pos: [item.pos[0], item.pos[1] + 0.5 + bob, item.pos[2]],
                rotY: time * 0.8 + item.bobPhase,
                scale: 1,
            });
        }
        return out;
    }

    nearestUncollected(playerPos) {
        let best = null, bestD = Infinity;
        for (const item of this.all) {
            if (item.collected) continue;
            const d = Math.hypot(item.pos[0] - playerPos[0], item.pos[2] - playerPos[2]);
            if (d < bestD) { bestD = d; best = item; }
        }
        return best;
    }
}
