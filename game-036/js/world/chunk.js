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
    buildFlowerPatch, buildGraveMarker, buildHedge, buildReed, buildGrassTuft,
} from './vegetation.js';
import {
    buildLighthouse, buildRuinedWallSegment, buildStoneArch, buildCemeteryGate,
    buildLibraryShell, buildMuseumShell, buildPier, buildFountain, buildPedestal, buildBookshelf,
} from './structures.js';
import { SEA_LEVEL } from './water.js';

export const CHUNK_SIZE = 24; // world units per chunk edge

/**
 * Ground grid resolution per LOD level, indexed by detail (0 = coarsest).
 * At detail 2 a chunk edge is cut into 12, giving 2-unit quads — fine enough
 * that hillsides read as curved surfaces rather than the faceted 6-unit steps
 * the old flat subdivision of 4 produced.
 *
 * Each level is a divisor of the next so LOD seams line up: a coarse chunk's
 * verts are a strict subset of its detailed neighbour's grid positions, and
 * since every vert samples heightAt() directly they agree exactly on the shared
 * edge. Mismatched resolutions would leave cracks showing sky between chunks.
 */
export const GROUND_SUBDIV_BY_DETAIL = [3, 6, 12];
export const GROUND_SUBDIV = GROUND_SUBDIV_BY_DETAIL[2]; // finest, for callers that need the max

export class ChunkWorld {
    constructor(seed, heightmap, regionMap) {
        this.seed = seed;
        this.heightmap = heightmap;
        this.regionMap = regionMap;
        this.cache = new Map(); // "cx,cz" -> { mesh, structures: [{mesh,pos,rotY}], anchors }
        this._landmarksPlaced = new Set(); // region types already given their one big structure
        this.landmarkAnchors = {}; // type -> {x,z,y}
        // Enterable buildings (library/museum): interior mesh + footprint, kept out
        // of the chunk mesh so it can be drawn as an exclusive scene from inside.
        this.buildingInteriors = {}; // type -> { mesh, pos, footprint, w, d, wallH }
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
        const subdiv = GROUND_SUBDIV_BY_DETAIL[detail] ?? GROUND_SUBDIV_BY_DETAIL[0];
        const step = CHUNK_SIZE / subdiv;

        // --- ground mesh: grid of triangles following heightmap, tinted by region ---
        const grid = [];
        for (let gz = 0; gz <= subdiv; gz++) {
            const row = [];
            for (let gx = 0; gx <= subdiv; gx++) {
                const wx = x0 + gx * step, wz = z0 + gz * step;
                const wy = this.heightmap.heightAt(wx, wz);
                row.push(addVert(ground, wx, wy, wz));
            }
            grid.push(row);
        }
        for (let gz = 0; gz < subdiv; gz++) {
            for (let gx = 0; gx < subdiv; gx++) {
                const wx = x0 + (gx + 0.5) * step, wz = z0 + (gz + 0.5) * step;
                const underwater = this.heightmap.heightAt(wx, wz) < 0;
                const color = underwater ? [180, 170, 130] : this.regionMap.groundColorAt(wx, wz);
                const a = grid[gz][gx], b = grid[gz][gx + 1], c = grid[gz + 1][gx + 1], d = grid[gz + 1][gx];
                // Wind counter-clockwise viewed from above so the face normal
                // (e1 x e2) points up; the reverse order makes the whole terrain
                // face downward and get discarded by the renderer's backface cull.
                //
                // Split each quad along its shorter diagonal. A fixed diagonal makes
                // ridgelines and stream cuts look like staircases, because half the
                // time the split runs across the slope instead of along it; picking
                // the diagonal whose endpoints differ least in height keeps the two
                // triangles closer to the real surface. Now that quads are small,
                // this is what makes hillsides read as smooth.
                if (Math.abs(ground.verts[a][1] - ground.verts[c][1]) <=
                    Math.abs(ground.verts[b][1] - ground.verts[d][1])) {
                    addTri(ground, a, c, b, color);
                    addTri(ground, a, d, c, color);
                } else {
                    addTri(ground, a, d, b, color);
                    addTri(ground, b, d, c, color);
                }
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

        // A chunk whose every vertex sits below sea level is pure seabed: the
        // ocean disc covers it completely, so it contributes nothing but cost.
        // Worse, with painter's-algorithm sorting and no depth buffer, a seabed
        // chunk nearer than the ocean's average depth is painted *after* the
        // water and shows through it as a spike along the horizon. Flagging it
        // here lets world.js drop it from the instance list — which both fixes
        // the artifact and removes ~40% of the loaded chunks at this draw
        // distance, since most of the draw radius is open sea.
        let maxY = -Infinity;
        for (const v of ground.verts) if (v[1] > maxY) maxY = v[1];
        const submerged = maxY < SEA_LEVEL;

        return { mesh: ground, region, cx, cz, detail, submerged };
    }

    /**
     * Scatter this chunk's props.
     *
     * Density is the count *considered*, not the count placed — candidates on
     * water or steep ground are skipped. The full set is always evaluated in the
     * same rng order regardless of LOD (see the loop comment), so a chunk keeps
     * its layout across detail changes; coarser levels simply drop the props
     * whose index falls past their share, which makes distant chunks thin out
     * consistently instead of reshuffling when the player walks toward them.
     */
    _scatterProps(props, rng, x0, z0, region, detail = 2) {
        // Tuned against measured per-chunk triangle cost, not by eye. Forest is
        // both the most common region and the only one whose props are full
        // trees (~180 tris each at top detail), so its count has to stay well
        // below the others or a single forest chunk costs more than the twenty
        // around it combined.
        const density = {
            forest: 22, meadow: 20, garden: 22, cemetery: 18,
            cave: 10, lighthouse: 10, ruins: 16, shore: 16, library: 6, museum: 6,
        }[region] ?? 16;

        // Fraction of the candidate set each LOD builds at all, thinning the
        // scatter with distance.
        const keepFraction = [0.3, 0.5, 1][detail] ?? 1;
        const keepCount = Math.ceil(density * keepFraction);

        // Ground clutter — grass, flowers, reeds — is under half a metre tall and
        // collapses to sub-pixel noise well before the far LOD band, but it is
        // also the bulk of the prop budget (measured: ~95% of a distant forest
        // chunk's triangles). Keeping it past the near band measured at a third
        // of the frame rate on an open vista for a difference that is hard to
        // see, so it stays near-band only; the ground tint variation in
        // regions.js is what carries the mid distance instead.
        const clutterOk = detail >= 2;
        // Mid-size filler (bushes, small rocks) survives one band further out.
        const fillerOk = detail >= 1;

        for (let i = 0; i < density; i++) {
            // Always draw from the rng in the same order regardless of LOD, so a
            // chunk rebuilt at another detail level keeps the same prop layout.
            const wx = x0 + rng() * CHUNK_SIZE;
            const wz = z0 + rng() * CHUNK_SIZE;
            const pick = rng();
            const rot = rng() * Math.PI * 2;
            const extra = rng(); // consumed unconditionally to keep the stream aligned

            if (i >= keepCount) continue; // thinned out at this LOD

            const wy = this.heightmap.heightAt(wx, wz);
            const slope = this.heightmap.slopeAt(wx, wz);
            if (wy < 0.1) continue;   // don't place on water
            if (slope > 0.6) continue; // avoid steep cliffs

            // Small props resolve to null past their LOD band and are simply not
            // placed; the candidate slot is spent either way, which is what keeps
            // the layout stable across detail changes.
            const clutter = (fn) => clutterOk ? fn() : null;
            const filler = (fn) => fillerOk ? fn() : null;

            let mesh = null, scale = 1;
            if (region === 'forest') {
                // Weighted toward undergrowth rather than more trunks: grass and
                // bushes are 8-32 triangles against a tree's ~180, and filling the
                // empty floor between trees is what actually makes a forest read
                // as dense at eye level. Raising the tree share instead just costs
                // triangles for canopy the player is standing underneath.
                if (pick < 0.26) mesh = buildDeciduousTree(rng, 1, detail);
                else if (pick < 0.42) mesh = buildPineTree(rng, 1, detail);
                else if (pick < 0.78) mesh = clutter(() => buildGrassTuft(rng));
                else mesh = filler(() => buildBush(rng));
            } else if (region === 'meadow') {
                if (pick < 0.45) mesh = clutter(() => buildGrassTuft(rng));
                else if (pick < 0.75) mesh = clutter(() => buildFlowerPatch(rng));
                else if (pick < 0.9) mesh = filler(() => buildRock(rng, 0.6));
                else mesh = buildDeciduousTree(rng, 0.8, detail);
            } else if (region === 'garden') {
                if (pick < 0.4) mesh = clutter(() => buildFlowerPatch(rng));
                else if (pick < 0.7) mesh = filler(() => buildBush(rng));
                else if (pick < 0.88) mesh = clutter(() => buildGrassTuft(rng));
                else mesh = buildHedge(1.8 + extra * 1.6, rng);
            } else if (region === 'cemetery') {
                if (pick < 0.55) mesh = buildGraveMarker(rng);
                else if (pick < 0.75) mesh = filler(() => buildBush(rng));
                else if (pick < 0.9) mesh = clutter(() => buildGrassTuft(rng));
                else mesh = buildDeciduousTree(rng, 0.9, detail);
            } else if (region === 'ruins') {
                if (pick < 0.5) mesh = buildRuinedWallSegment(rng);
                else if (pick < 0.78) mesh = filler(() => buildRock(rng, 1.1));
                else mesh = clutter(() => buildGrassTuft(rng));
            } else if (region === 'shore') {
                // Reeds cluster in the damp margin just above the waterline.
                if (wy < 1.2 && pick < 0.45) mesh = clutter(() => buildReed(rng));
                else if (pick < 0.8) mesh = filler(() => buildRock(rng, 0.8));
                else mesh = clutter(() => buildGrassTuft(rng));
            } else if (region === 'cave') {
                mesh = pick < 0.7 ? buildRock(rng, 1.3) : clutter(() => buildGrassTuft(rng));
            } else if (region === 'lighthouse') {
                mesh = pick < 0.6 ? filler(() => buildRock(rng, 0.7)) : clutter(() => buildGrassTuft(rng));
            } else {
                mesh = pick < 0.5 ? filler(() => buildBush(rng)) : clutter(() => buildGrassTuft(rng));
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
        const built = builder(rng);

        // The library and museum are enterable, so their builders return
        // { exterior, interior, footprint } instead of a bare mesh. Only the
        // exterior is baked into the chunk; the interior is registered separately
        // and drawn as its own exclusive scene when the player steps inside
        // (the renderer has no depth buffer — see structures.js).
        const enterable = built && built.exterior !== undefined;
        const mesh = enterable ? built.exterior : built;

        // Buildings are axis-aligned so the containment test can stay a cheap AABB;
        // rotating them would need the yaw folded into every query. Everything else
        // still gets a random spin.
        const rotY = enterable ? 0 : rng() * Math.PI * 2;
        props.push({ mesh, pos: [seedPoint.x, wy, seedPoint.z], rotY, scale: 1 });
        this.landmarkAnchors[region] = { x: seedPoint.x, y: wy, z: seedPoint.z };

        // Museum/library get interior furniture anchored near the landmark for item
        // placement. It lives in the interior mesh, not the chunk, so it's only ever
        // drawn alongside the walls that are supposed to contain it.
        if (enterable) {
            const interior = { verts: [], tris: [] };
            mergeMesh(interior, built.interior, 0, 0, 0, 0, 1);
            const { w, d, wallH } = built.footprint;

            if (region === 'museum') {
                // Ring of pedestals, inset from the walls and clear of the doorway.
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    mergeMesh(interior, buildPedestal(rng), Math.cos(a) * 4.2, 0, Math.sin(a) * 3.2);
                }
            } else if (region === 'library') {
                // Shelves along the back wall, facing the door.
                for (let i = 0; i < 5; i++) {
                    mergeMesh(interior, buildBookshelf(rng), -4 + i * 2, 0, -d / 2 + 1.2);
                }
            }

            this.buildingInteriors[region] = {
                mesh: interior,
                pos: [seedPoint.x, wy, seedPoint.z],
                footprint: built.footprint,
                w, d, wallH,
            };
        }
    }
}
