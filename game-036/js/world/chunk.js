/**
 * chunk.js — divides the island into fixed-size square chunks. Each chunk
 * lazily builds ONE merged static mesh (ground triangles + baked-in props:
 * trees, rocks, bushes, grave markers, hedges, etc.) the first time it's
 * needed, then caches it. The world only renders chunks within draw
 * distance of the player, which keeps per-frame triangle counts bounded
 * regardless of total island size.
 *
 * Interactable/collectible items are NOT baked into the static mesh —
 * they're tracked separately (game/items.js) so they can be picked up.
 */

import { mergeMesh, addVert, addTri, makeMesh } from '../engine/mesh.js';
import { makeRng, hashSeedFromString } from './noise.js';
import {
    buildDeciduousTree, buildPineTree, buildBush, buildRock,
    buildFlowerPatch, buildGraveMarker, buildHedge, buildReed,
} from './vegetation.js';
import {
    buildLighthouse, buildRuinedWallSegment, buildStoneArch, buildCemeteryGate,
    buildLibraryShell, buildMuseumShell, buildPier, buildFountain, buildPedestal, buildBookshelf,
} from './structures.js';
import { SEA_LEVEL } from './water.js';

export const CHUNK_SIZE = 24; // world units per chunk edge
export const GROUND_SUBDIV = 4; // ground triangles per chunk edge (subdivisions)

export class ChunkWorld {
    constructor(seed, heightmap, regionMap) {
        this.seed = seed;
        this.heightmap = heightmap;
        this.regionMap = regionMap;
        this.cache = new Map(); // "cx,cz" -> { mesh, structures: [{mesh,pos,rotY}], anchors }
        this._landmarksPlaced = new Set(); // region types already given their one big structure
        this.landmarkAnchors = {}; // type -> {x,z,y}
    }

    key(cx, cz) { return `${cx},${cz}`; }

    worldToChunk(x, z) {
        return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
    }

    /**
     * Get (building if needed) the chunk at chunk-grid coords, at the given
     * level of detail. A cached chunk built at a coarser LOD is rebuilt when the
     * player gets close enough to need the detailed version — and vice versa, so
     * walking away from an area gives its triangles back.
     */
    getChunk(cx, cz, detail = 1) {
        const key = this.key(cx, cz);
        const cached = this.cache.get(key);
        if (cached && cached.detail === detail) return cached;
        const chunk = this._buildChunk(cx, cz, detail);
        this.cache.set(key, chunk);
        return chunk;
    }

    /** Return all chunk keys within `radius` world units of (x,z), nearest first. */
    chunksInRadius(x, z, radius) {
        const [ccx, ccz] = this.worldToChunk(x, z);
        const r = Math.ceil(radius / CHUNK_SIZE) + 1;
        const out = [];
        for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
                const cx = ccx + dx, cz = ccz + dz;
                const wx = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
                const wz = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
                const d = Math.hypot(wx - x, wz - z);
                if (d <= radius) out.push({ cx, cz, d });
            }
        }
        out.sort((a, b) => a.d - b.d);
        return out;
    }

    _buildChunk(cx, cz, detail = 1) {
        // Seeded per chunk coordinate (not per call), so a chunk regenerated at a
        // different LOD — or revisited after being evicted — lays out identically.
        const rng = makeRng(hashSeedFromString(`chunk_${this.seed}_${cx}_${cz}`));
        const ground = makeMesh();
        const props = []; // { mesh, pos:[x,y,z], rotY, scale }

        const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
        const step = CHUNK_SIZE / GROUND_SUBDIV;

        // --- ground mesh: grid of triangles following heightmap, tinted by region ---
        const grid = [];
        for (let gz = 0; gz <= GROUND_SUBDIV; gz++) {
            const row = [];
            for (let gx = 0; gx <= GROUND_SUBDIV; gx++) {
                const wx = x0 + gx * step, wz = z0 + gz * step;
                const wy = this.heightmap.heightAt(wx, wz);
                row.push(addVert(ground, wx, wy, wz));
            }
            grid.push(row);
        }
        for (let gz = 0; gz < GROUND_SUBDIV; gz++) {
            for (let gx = 0; gx < GROUND_SUBDIV; gx++) {
                const wx = x0 + (gx + 0.5) * step, wz = z0 + (gz + 0.5) * step;
                const region = this.regionMap.regionAt(wx, wz);
                const underwater = this.heightmap.heightAt(wx, wz) < 0;
                const color = underwater ? [180, 170, 130] : this.regionMap.groundColorAt(wx, wz);
                const a = grid[gz][gx], b = grid[gz][gx + 1], c = grid[gz + 1][gx + 1], d = grid[gz + 1][gx];
                // Wind counter-clockwise viewed from above so the face normal
                // (e1 x e2) points up; the reverse order makes the whole terrain
                // face downward and get discarded by the renderer's backface cull.
                addTri(ground, a, c, b, color);
                addTri(ground, a, d, c, color);
            }
        }

        // --- scatter props across this chunk based on region type ---
        const centerX = x0 + CHUNK_SIZE / 2, centerZ = z0 + CHUNK_SIZE / 2;
        const region = this.regionMap.regionAt(centerX, centerZ);
        this._scatterProps(props, rng, x0, z0, region, detail);

        // --- one-time landmark structure per region type (placed near its Voronoi seed point) ---
        // Landmarks are always full detail: they're the navigation beacons players
        // steer by from across the island, so they must not degrade at distance.
        this._maybePlaceLandmark(props, rng, cx, cz, region);

        // Bake props into the ground mesh for a single draw batch. Ground verts are
        // already absolute world-space; props carry their own absolute world pos.
        for (const p of props) {
            mergeMesh(ground, p.mesh, p.pos[0], p.pos[1], p.pos[2], p.rotY, p.scale);
        }

        return { mesh: ground, region, cx, cz, detail };
    }

    _scatterProps(props, rng, x0, z0, region, detail = 1) {
        const density = {
            forest: 14, meadow: 4, garden: 6, cemetery: 5,
            cave: 2, lighthouse: 2, ruins: 4, shore: 3, library: 1, museum: 1,
        }[region] ?? 4;

        for (let i = 0; i < density; i++) {
            // Always draw from the rng in the same order regardless of LOD, so a
            // chunk rebuilt at another detail level keeps the same prop layout.
            const wx = x0 + rng() * CHUNK_SIZE;
            const wz = z0 + rng() * CHUNK_SIZE;
            const wy = this.heightmap.heightAt(wx, wz);
            const slope = this.heightmap.slopeAt(wx, wz);
            const pick = rng();
            const rot = rng() * Math.PI * 2;

            if (wy < 0.1) continue;   // don't place on water
            if (slope > 0.6) continue; // avoid steep cliffs

            let mesh = null, scale = 1;
            if (region === 'forest') {
                mesh = pick < 0.6 ? buildDeciduousTree(rng, 1, detail) : buildPineTree(rng);
            } else if (region === 'meadow') {
                mesh = rng() < 0.5 ? buildFlowerPatch(rng) : buildRock(rng, 0.6);
            } else if (region === 'garden') {
                mesh = pick < 0.5 ? buildFlowerPatch(rng) : buildBush(rng);
            } else if (region === 'cemetery') {
                mesh = pick < 0.7 ? buildGraveMarker(rng) : buildBush(rng);
            } else if (region === 'ruins') {
                mesh = pick < 0.6 ? buildRuinedWallSegment(rng) : buildRock(rng, 1.1);
            } else if (region === 'shore') {
                mesh = buildRock(rng, 0.8);
            } else if (region === 'cave') {
                mesh = buildRock(rng, 1.3);
            } else if (region === 'lighthouse') {
                mesh = buildRock(rng, 0.7);
            } else {
                mesh = buildBush(rng);
            }
            if (!mesh) continue;
            props.push({ mesh, pos: [wx, wy, wz], rotY: rot, scale });
        }
    }

    _maybePlaceLandmark(props, rng, cx, cz, region) {
        const landmarkBuilders = {
            lighthouse: buildLighthouse,
            cemetery: buildCemeteryGate,
            garden: buildFountain,
            library: buildLibraryShell,
            museum: buildMuseumShell,
            ruins: buildStoneArch,
            shore: buildPier,
        };
        const builder = landmarkBuilders[region];
        if (!builder || this._landmarksPlaced.has(region)) return;

        // Only place once we're rendering the chunk nearest the region's seed point.
        const seedPoint = this.regionMap.points.find(p => p.type === region);
        if (!seedPoint) return;
        const [scx, scz] = this.worldToChunk(seedPoint.x, seedPoint.z);
        if (scx !== cx || scz !== cz) return;

        this._landmarksPlaced.add(region);
        const wy = this.heightmap.heightAt(seedPoint.x, seedPoint.z);
        const mesh = builder(rng);
        props.push({ mesh, pos: [seedPoint.x, wy, seedPoint.z], rotY: rng() * Math.PI * 2, scale: 1 });
        this.landmarkAnchors[region] = { x: seedPoint.x, y: wy, z: seedPoint.z };

        // Museum/library get interior furniture anchored near the landmark for item placement.
        if (region === 'museum') {
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const px = seedPoint.x + Math.cos(a) * 4.2;
                const pz = seedPoint.z + Math.sin(a) * 3.2;
                props.push({ mesh: buildPedestal(rng), pos: [px, wy, pz], rotY: 0, scale: 1 });
            }
        }
        if (region === 'library') {
            for (let i = 0; i < 5; i++) {
                const px = seedPoint.x - 4 + i * 2;
                const pz = seedPoint.z - 3.5;
                props.push({ mesh: buildBookshelf(rng), pos: [px, wy, pz], rotY: 0, scale: 1 });
            }
        }
    }
}
