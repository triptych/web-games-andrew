/**
 * world.js — top-level world orchestration. Builds the one-time global
 * pieces (heightmap, regions, ocean, streams, clouds, fauna spawns) and
 * exposes a single `getVisibleInstances()` used by main.js every frame,
 * pulling chunk meshes from ChunkWorld based on player distance.
 */

import { Heightmap } from './heightmap.js';
import { RegionMap } from './regions.js';
import { ChunkWorld, CHUNK_SIZE } from './chunk.js';
import { buildOceanMesh, buildStreamMesh, traceStream } from './water.js';
import { buildCloud } from './sky.js';
import { buildBird, buildGroundCritter, Bird, Critter } from './fauna.js';
import { generateCavePath, buildCaveTunnel, buildCrystalCluster } from './cave.js';
import { makeRng, hashSeedFromString } from './noise.js';
import { ISLAND_RADIUS, OCEAN_OUTER_RADIUS, DRAW_DISTANCE, LOD_DISTANCE, CHUNK_UNLOAD_DISTANCE } from '../config.js';

export class World {
    constructor(seed) {
        this.seed = seed;
        this.heightmap = new Heightmap(seed, ISLAND_RADIUS);
        // RegionMap needs the heightmap so it can keep landmark anchors out of the water.
        this.regionMap = new RegionMap(seed, ISLAND_RADIUS, this.heightmap);
        this.chunks = new ChunkWorld(seed, this.heightmap, this.regionMap);

        this.oceanMesh = buildOceanMesh(ISLAND_RADIUS, OCEAN_OUTER_RADIUS);

        this._buildStreams();
        this._buildClouds();
        this._buildCave();
        this._buildFauna();

        this._lastCullCenter = null;
        this._visibleCache = [];
    }

    _buildStreams() {
        const rng = makeRng(this.seed + 555);
        this.streamMeshes = [];
        const sources = 3;
        for (let i = 0; i < sources; i++) {
            const a = rng() * Math.PI * 2;
            const d = 0.15 + rng() * 0.1;
            const sx = Math.cos(a) * d * ISLAND_RADIUS;
            const sz = Math.sin(a) * d * ISLAND_RADIUS;
            const pts = traceStream(this.heightmap, sx, sz, rng);
            if (pts.length > 2) this.streamMeshes.push(buildStreamMesh(pts));
        }
    }

    _buildClouds() {
        const rng = makeRng(this.seed + 999);
        this.clouds = [];
        for (let i = 0; i < 14; i++) {
            const a = rng() * Math.PI * 2;
            const d = rng() * ISLAND_RADIUS * 1.3;
            this.clouds.push({
                mesh: buildCloud(rng),
                pos: [Math.cos(a) * d, 34 + rng() * 14, Math.sin(a) * d],
                rotY: rng() * Math.PI * 2,
                speed: 0.4 + rng() * 0.5,
            });
        }
    }

    _buildCave() {
        // Find the cave region seed point, dig a tunnel into the hillside from there.
        const rng = makeRng(this.seed + 2024);
        const caveSeed = this.regionMap.points.find(p => p.type === 'cave');
        if (!caveSeed) { this.caveMesh = null; return; }
        const entranceY = this.heightmap.heightAt(caveSeed.x, caveSeed.z) + 0.5;
        const dirToCenter = [-caveSeed.x, -caveSeed.z];
        const dLen = Math.hypot(dirToCenter[0], dirToCenter[1]) || 1;
        const dir = [dirToCenter[0] / dLen, dirToCenter[1] / dLen];
        const { path, radii } = generateCavePath(rng, { x: caveSeed.x, y: entranceY, z: caveSeed.z }, dir);
        this.caveMesh = buildCaveTunnel(path, radii);
        this.caveCrystals = [];
        for (let i = 0; i < 8; i++) {
            const idx = Math.floor((0.3 + rng() * 0.65) * path.length);
            const p = path[idx];
            this.caveCrystals.push({
                mesh: buildCrystalCluster(rng),
                pos: [p.x + (rng() - 0.5) * 1.5, p.y - radii[idx] * 0.5, p.z + (rng() - 0.5) * 1.5],
                rotY: rng() * Math.PI * 2,
                scale: 1,
            });
        }
        this.caveChamberEnd = path[path.length - 1];
        // Retained for isInsideCave(): the renderer has no depth buffer, so being
        // "inside" has to be an explicit query rather than something depth sorting
        // works out on its own.
        this.cavePath = path;
        this.caveRadii = radii;
    }

    /**
     * True when the camera is within the cave tube. Used to swap the whole scene
     * over to interior-only rendering: with painter's-algorithm sorting, distant
     * terrain drawn after the near tunnel wall paints straight over it, so the
     * outside world has to be excluded rather than depth-tested away.
     */
    isInsideCave(pos) {
        return this._nearestCaveSegment(pos) !== null;
    }

    /**
     * Build the library/museum interiors if their chunks haven't been generated
     * yet. Containment can be queried before the player has ever been near the
     * building — the chunk at the draw-distance edge may not exist on the frame
     * the query runs — and an unregistered interior would read as "not inside",
     * so the exclusive-interior swap would never happen. Registering from the
     * region seed point (the same source chunk.js places the landmark from) keeps
     * the two in agreement whether or not the chunk is resident.
     */
    _ensureBuildingInteriors() {
        // Called from a per-frame query, so short-circuit once both are known.
        if (this._interiorsReady) return;
        let missing = 0;
        for (const type of ['library', 'museum']) {
            if (this.chunks.buildingInteriors[type]) continue;
            const p = this.regionMap.points.find(q => q.type === type);
            if (!p) continue; // this seed has no such region — nothing to wait for
            // Force the landmark's own chunk to generate, which registers the
            // interior through the normal path rather than duplicating the
            // furniture layout here.
            const [cx, cz] = this.chunks.worldToChunk(p.x, p.z);
            this.chunks.getChunk(cx, cz, 1);
            if (!this.chunks.buildingInteriors[type]) missing++;
        }
        if (missing === 0) this._interiorsReady = true;
    }

    /**
     * The enterable building containing `pos`, or null. Same reasoning as
     * isInsideCave(): with no depth buffer, "inside" has to be an explicit
     * spatial query so the scene can be swapped to interior-only geometry.
     *
     * Buildings are axis-aligned (chunk.js keeps their rotY at 0), so this is a
     * plain AABB test inset by the wall thickness — the player counts as inside
     * once they're past the inner wall face, not while still in the doorway.
     */
    buildingContaining(pos) {
        this._ensureBuildingInteriors();
        const interiors = this.chunks.buildingInteriors;
        for (const type in interiors) {
            const b = interiors[type];
            const [bx, by, bz] = b.pos;
            const t = b.footprint.wallT;
            const lx = pos[0] - bx, lz = pos[2] - bz;
            const hw = b.w / 2 - t, hd = b.d / 2 - t;
            const withinHeight = pos[1] > by - 1 && pos[1] < by + b.wallH;
            if (!withinHeight) continue;
            if (lx > -hw && lx < hw && lz > -hd && lz < hd) return { type, ...b };
            // Also count the doorway itself as inside. The opening spans the wall's
            // full thickness, so a player mid-stride through it is past the
            // containment box but not yet in the room — without this they'd get a
            // few frames of the outdoor scene framed by the door before it snaps.
            if (Math.abs(lx) < b.footprint.doorW / 2 && lz >= hd && lz <= b.d / 2) {
                return { type, ...b };
            }
        }
        return null;
    }

    /** True when the camera is inside the library or museum. */
    isInsideBuilding(pos) {
        return this.buildingContaining(pos) !== null;
    }

    /**
     * Floor height of the tunnel at (x,z), or null if that column isn't inside
     * the cave. Used by the player controller: the tunnel is the one place with
     * terrain overhead, so walking in has to override the heightmap or the
     * player gets pushed back up through the roof.
     *
     * `currentY` disambiguates the case where the tunnel passes under its own
     * entrance slope — we want the segment nearest the player's elevation.
     */
    caveFloorAt(x, z, currentY) {
        const seg = this._nearestCaveSegment([x, currentY, z], true);
        if (!seg) return null;
        return seg.p.y - seg.r * 0.82; // floor sits just inside the tube's bottom
    }

    /**
     * Nearest cave centreline point containing the given position, or null.
     * With `horizontalOnly`, the containment test ignores height — used when
     * resolving the floor for a player who may currently be above it.
     */
    _nearestCaveSegment(pos, horizontalOnly = false) {
        if (!this.cavePath) return null;
        let best = null, bestD = Infinity;
        for (let i = 0; i < this.cavePath.length; i++) {
            const p = this.cavePath[i];
            // Slightly inside the wall so transitions happen under cover rather
            // than out in the open where the pop would be visible.
            const r = this.caveRadii[i] * 0.9;
            const dx = pos[0] - p.x, dz = pos[2] - p.z;
            const dy = pos[1] - p.y;
            const horizD = dx * dx + dz * dz;
            const inRange = horizontalOnly
                // Allow standing anywhere in the tube's vertical span, plus head-room.
                ? (horizD < r * r && Math.abs(dy) < r + 2.5)
                : (horizD + dy * dy < r * r);
            if (inRange && horizD < bestD) { bestD = horizD; best = { p, r, i }; }
        }
        return best;
    }

    _buildFauna() {
        const rng = makeRng(this.seed + 3033);
        this.birds = [];
        for (let i = 0; i < 10; i++) {
            const a = rng() * Math.PI * 2;
            const d = rng() * ISLAND_RADIUS * 0.7;
            this.birds.push(new Bird(
                buildBird(rng),
                [Math.cos(a) * d, 0, Math.sin(a) * d],
                6 + rng() * 10,
                14 + rng() * 8,
                0.3 + rng() * 0.4,
                rng() * Math.PI * 2,
            ));
        }

        this.critters = [];
        for (let i = 0; i < 12; i++) {
            const a = rng() * Math.PI * 2;
            const d = rng() * ISLAND_RADIUS * 0.55;
            const home = [Math.cos(a) * d, 0, Math.sin(a) * d];
            if (this.heightmap.heightAt(home[0], home[2]) < 0.5) continue;
            this.critters.push(new Critter(buildGroundCritter(rng), home, 6, this.heightmap, rng));
        }
    }

    update(dt, time) {
        for (const b of this.birds) b.update(dt);
        for (const c of this.critters) c.update(dt);
    }

    /** Evict cached chunks far from the player to bound memory over a long session. */
    pruneChunks(playerX, playerZ) {
        for (const [key, chunk] of this.chunks.cache) {
            const wx = chunk.cx * CHUNK_SIZE + CHUNK_SIZE / 2;
            const wz = chunk.cz * CHUNK_SIZE + CHUNK_SIZE / 2;
            if (Math.hypot(wx - playerX, wz - playerZ) > CHUNK_UNLOAD_DISTANCE) {
                this.chunks.cache.delete(key);
            }
        }
    }

    /** Build the instance list for the renderer this frame (static chunks + dynamic fauna/clouds). */
    getVisibleInstances(playerPos, time) {
        const [px, , pz] = playerPos;
        const out = [];

        // Inside the cave, draw the interior and nothing else. Without a depth
        // buffer the outside world would paint over the tunnel walls and the
        // player would appear to stand in open air inside solid rock.
        if (this.isInsideCave(playerPos)) {
            out.push({ mesh: this.caveMesh, pos: [0, 0, 0], rotY: 0, scale: 1, doubleSided: true, noFogFade: true });
            for (const c of this.caveCrystals) out.push({ ...c, noFogFade: true });
            return out;
        }

        // Same story indoors: the ground quads around a building average nearer
        // than its wall triangles and paint over them, so the interior is drawn
        // as its own scene with the outside world excluded entirely. Walls are
        // submitted double-sided because the interior panels are built from boxes
        // whose outward winding would otherwise cull them from within.
        const building = this.buildingContaining(playerPos);
        if (building) {
            out.push({
                mesh: building.mesh, pos: building.pos, rotY: 0, scale: 1,
                doubleSided: true, noFogFade: true,
            });
            return out;
        }

        const nearby = this.chunks.chunksInRadius(px, pz, DRAW_DISTANCE);

        // Ocean + clouds are backdrop: exempt from the far-plane cull so the horizon
        // always reads as water and sky rather than the edge of the loaded chunks.
        out.push({ mesh: this.oceanMesh, pos: [0, 0, 0], rotY: 0, scale: 1, noFarCull: true, doubleSided: true });
        // Streams are double-sided: a traced ribbon follows arbitrary headings, so
        // its winding isn't consistent enough to rely on backface culling.
        for (const s of this.streamMeshes) out.push({ mesh: s, pos: [0, 0, 0], rotY: 0, scale: 1, doubleSided: true });
        // The cave mouth stays visible from outside so the entrance reads as a hole
        // in the hillside; only the deep interior is swapped out above.
        if (this.caveMesh) out.push({ mesh: this.caveMesh, pos: [0, 0, 0], rotY: 0, scale: 1, doubleSided: true });
        for (const c of this.caveCrystals) out.push(c);

        // Chunks past LOD_DISTANCE build their vegetation at reduced detail. Trees
        // are the bulk of the island's triangles, and beyond ~45 units only their
        // silhouette survives on screen, so the extra faces buy nothing.
        for (const { cx, cz, d } of nearby) {
            // Hysteresis band around LOD_DISTANCE: a chunk only upgrades once it's
            // clearly inside the threshold and only downgrades once clearly outside.
            // Switching on a single distance would rebuild every frame for a player
            // standing right at the boundary.
            const key = this.chunks.key(cx, cz);
            const current = this.chunks.cache.get(key);
            let detail;
            if (d < LOD_DISTANCE * 0.85) detail = 1;
            else if (d > LOD_DISTANCE * 1.15) detail = 0;
            else detail = current ? current.detail : (d > LOD_DISTANCE ? 0 : 1);

            const chunk = this.chunks.getChunk(cx, cz, detail);
            out.push({ mesh: chunk.mesh, pos: [0, 0, 0], rotY: 0, scale: 1 });
        }

        for (const cloud of this.clouds) {
            out.push({
                mesh: cloud.mesh,
                pos: [
                    cloud.pos[0] + Math.cos(time * cloud.speed * 0.05) * 6,
                    cloud.pos[1],
                    cloud.pos[2] + Math.sin(time * cloud.speed * 0.05) * 6,
                ],
                rotY: cloud.rotY,
                scale: 1,
                noFarCull: true,
                noFogFade: true,
            });
        }

        for (const b of this.birds) {
            if (Math.hypot(b.pos[0] - px, b.pos[2] - pz) > DRAW_DISTANCE) continue;
            out.push({ mesh: b.mesh, pos: b.pos, rotY: b.rotY, scale: 1 });
        }
        for (const c of this.critters) {
            if (Math.hypot(c.pos[0] - px, c.pos[2] - pz) > DRAW_DISTANCE) continue;
            out.push({ mesh: c.mesh, pos: c.pos, rotY: c.rotY, scale: 1 });
        }

        return out;
    }
}
