/**
 * mapstate.js — the overmap's data layer: what the player has actually seen.
 *
 * The map is a coarse grid over the island's bounding square. Each cell holds
 * one byte of exploration state, and walking around sets the cells within
 * sight radius. Nothing is pre-revealed, so the map fills in as a record of
 * where you have been rather than as a readout of the generator's output —
 * which is the whole point of having it be a *discovered* map.
 *
 * Terrain colour per cell is sampled once, lazily, on the frame the cell is
 * first revealed. Sampling is the expensive part (groundColorAt runs several
 * octaves of noise plus height and slope lookups), so it must never happen for
 * a cell the player hasn't earned, and never twice for the same cell.
 *
 * Two kinds of annotation ride alongside the grid:
 *   - regions: labelled once enough of the terrain around their anchor is
 *     revealed, so a name appears when you've seen the place, not when you've
 *     clipped its outermost cell;
 *   - items: books and artifacts, each tracked through
 *     unknown -> spotted (seen from a distance) -> collected.
 *
 * Exploration is emitted as a single 0..1 fraction so the HUD can show
 * progress without the UI layer needing to know the grid exists.
 */

import { events } from '../events.js';
import { REGION_GROUND_COLOR } from '../world/regions.js';
import { ISLAND_RADIUS } from '../config.js';

// World units per map cell. 6 gives a ~94x94 grid over the island bounds:
// fine enough that the coastline reads as a coastline rather than a staircase,
// coarse enough that a full redraw stays cheap and walking a straight line
// visibly paints a trail rather than a smooth smear.
export const MAP_CELL = 6;

// How far from the player cells get revealed, in world units. Deliberately
// well short of the 260-unit draw distance: the map should reward walking the
// island, not standing on the summit once. Roughly "the ground you have had a
// proper look at".
export const REVEAL_RADIUS = 34;

// Items get pinned on the map when seen from noticeably further than they can
// be picked up (PICKUP_RADIUS is 2), so the map can tell you "there's a book
// over there" and be useful for navigation rather than just a record of
// pickups. Still inside REVEAL_RADIUS so a pin never lands on black.
export const ITEM_SPOT_RADIUS = 26;

// Sharpness of the region-tint blend in _blendedGroundColor(). Weights are
// 1/(d^2)^falloff, so larger values pull each cell harder toward its own
// region's colour and narrow the transition band.
//
// Tuned by measuring two things across the island at map resolution: colour
// variety (per-channel standard deviation, i.e. "do regions still read as
// different places") and the largest colour step between adjacent cells
// (i.e. "how hard is the seam"). The unblended lookup scores 39 variety with a
// 188 seam; too low a falloff trades away far too much variety for very little
// extra seam softening:
//
//   falloff   variety        seam jump
//   1.1       22  (56%)      37  (19%)
//   1.7       29  (73%)      35  (19%)
//   2.4       32  (83%)      46  (24%)
//   3.5       35  (89%)      61  (33%)
//
// 2.4 is the knee: it keeps most of the region identity while still turning the
// Voronoi edges into gradients, and past it the seams grow faster than the
// variety recovers.
const BLEND_FALLOFF = 2.4;

// Fraction of the cells around a region anchor that must be revealed before
// its name is written on the map.
const REGION_LABEL_THRESHOLD = 0.34;
// Radius (world units) of the disc sampled for that threshold.
const REGION_LABEL_SAMPLE_R = 22;

export const CELL_UNKNOWN = 0;
export const CELL_SEEN = 1;

export class MapState {
    /**
     * @param world World instance — supplies heightmap (land/water + relief
     *              shading) and regionMap (per-cell ground tint and anchors).
     */
    constructor(world) {
        this.world = world;

        // The grid spans the island plus a margin of open water, so the
        // coastline is drawn with sea around it instead of running off the edge.
        this.halfExtent = ISLAND_RADIUS * 1.08;
        this.size = Math.ceil((this.halfExtent * 2) / MAP_CELL);

        this.cells = new Uint8Array(this.size * this.size);
        // Packed 0xRRGGBB per revealed cell; 0 doubles as "not yet sampled"
        // because a real sampled colour is never pure black.
        this.colors = new Uint32Array(this.size * this.size);

        this._seenCount = 0;
        // Only cells whose centre is inside the grid's disc count toward the
        // exploration percentage — otherwise the four corners of the square,
        // which are open ocean the player can never stand on, would cap it
        // somewhere well below 100%.
        this._reachableCount = this._countReachable();

        this.regions = this._initRegions();
        this.items = new Map(); // id -> { kind, name, pos, spotted, collected }

        this._pendingEmit = false;
        // Suppresses `mapAnnotation` (the toast-driving event) without suppressing
        // the reveal itself — see updateSilent().
        this._quiet = false;
    }

    // ---------- grid geometry ----------

    /** Cell column/row containing world (x,z), unclamped. */
    cellOf(x, z) {
        return [
            Math.floor((x + this.halfExtent) / MAP_CELL),
            Math.floor((z + this.halfExtent) / MAP_CELL),
        ];
    }

    /** World-space centre of cell (cx,cz). */
    cellCenter(cx, cz) {
        return [
            cx * MAP_CELL - this.halfExtent + MAP_CELL / 2,
            cz * MAP_CELL - this.halfExtent + MAP_CELL / 2,
        ];
    }

    inBounds(cx, cz) {
        return cx >= 0 && cz >= 0 && cx < this.size && cz < this.size;
    }

    isSeen(cx, cz) {
        return this.inBounds(cx, cz) && this.cells[cz * this.size + cx] === CELL_SEEN;
    }

    /** Packed colour of a revealed cell, or 0 if unknown. */
    colorAt(cx, cz) {
        if (!this.inBounds(cx, cz)) return 0;
        return this.colors[cz * this.size + cx];
    }

    _countReachable() {
        let n = 0;
        const r = this.halfExtent;
        for (let cz = 0; cz < this.size; cz++) {
            for (let cx = 0; cx < this.size; cx++) {
                const [wx, wz] = this.cellCenter(cx, cz);
                if (wx * wx + wz * wz <= r * r) n++;
            }
        }
        return n || 1;
    }

    get exploredFraction() {
        return Math.min(1, this._seenCount / this._reachableCount);
    }

    // ---------- reveal ----------

    /**
     * Reveal the disc of cells around the player and spot any nearby items.
     * Called every frame, so the common case — standing still inside an
     * already-revealed disc — has to cost almost nothing: the loop is a few
     * dozen array reads with an early `continue` per cell, and no colour
     * sampling happens once a cell is known.
     */
    update(playerPos) {
        const px = playerPos[0], pz = playerPos[2];
        const [c0x, c0z] = this.cellOf(px, pz);
        const span = Math.ceil(REVEAL_RADIUS / MAP_CELL);
        const rSq = REVEAL_RADIUS * REVEAL_RADIUS;
        let newly = 0;

        for (let cz = c0z - span; cz <= c0z + span; cz++) {
            for (let cx = c0x - span; cx <= c0x + span; cx++) {
                if (!this.inBounds(cx, cz)) continue;
                const idx = cz * this.size + cx;
                if (this.cells[idx] === CELL_SEEN) continue;
                const [wx, wz] = this.cellCenter(cx, cz);
                const dx = wx - px, dz = wz - pz;
                if (dx * dx + dz * dz > rSq) continue;
                this.cells[idx] = CELL_SEEN;
                this.colors[idx] = this._sampleColor(wx, wz);
                newly++;
            }
        }

        if (newly > 0) {
            this._seenCount += newly;
            this._pendingEmit = true;
        }

        this._spotItems(px, pz);
        this._updateRegionLabels(px, pz);

        if (this._pendingEmit) {
            this._pendingEmit = false;
            events.emit('mapExplored', {
                fraction: this.exploredFraction,
                seen: this._seenCount,
                total: this._reachableCount,
            });
        }
    }

    /**
     * Reveal exactly as update() does, but without firing `mapAnnotation`.
     *
     * Used for the pre-game reveal around the spawn point: those cells should be
     * charted (the minimap should not open on black), but the regions and items
     * they happen to cover are not discoveries the player made, and announcing
     * them would stack toasts behind the title screen before the first step.
     */
    updateSilent(playerPos) {
        this._quiet = true;
        try {
            this.update(playerPos);
        } finally {
            this._quiet = false;
        }
    }

    _announce(payload) {
        if (!this._quiet) events.emit('mapAnnotation', payload);
    }

    /**
     * Map colour for one cell: the region's ground tint for land, a depth-faded
     * blue for sea, with a cheap hillshade so relief reads at map scale. Without
     * the shading the island is a flat blob of green and you cannot tell a ridge
     * from a valley, which is most of what you want a map for.
     */
    _sampleColor(wx, wz) {
        const hm = this.world.heightmap;
        const h = hm.heightAt(wx, wz);

        let r, g, b;
        if (h < 0) {
            // Deeper water reads darker and bluer; the shelf stays pale so the
            // beach-to-sea transition is legible.
            const depth = Math.min(1, -h / 6);
            r = 96 - depth * 62;
            g = 150 - depth * 84;
            b = 186 - depth * 52;
        } else {
            const base = this._blendedGroundColor(wx, wz);
            // Light from the north-west, the usual cartographic convention, so
            // slopes facing up-left brighten and the opposite faces darken.
            const n = hm.normalAt(wx, wz, MAP_CELL * 0.6);
            const shade = 1 + (n[0] * -0.5 + n[2] * -0.5) * 0.85;
            const k = Math.max(0.55, Math.min(1.45, shade));
            r = base[0] * k; g = base[1] * k; b = base[2] * k;
        }

        return (Math.max(0, Math.min(255, r | 0)) << 16)
             | (Math.max(0, Math.min(255, g | 0)) << 8)
             |  Math.max(0, Math.min(255, b | 0));
    }

    /**
     * Region tint at (x,z), softened across region borders.
     *
     * regionAt() is a hard nearest-seed lookup, which is right for the 3D world
     * — ground triangles are small, and vegetation and relief hide the seams.
     * Seen from above at map scale those seams become the straight edges of the
     * Voronoi cells, and the island reads as a political map of flat-coloured
     * territories rather than as terrain.
     *
     * Blending the nearest few seeds by inverse distance dissolves the borders
     * into gradients while leaving each region's core at its own colour. The
     * exponent sets the sharpness: high enough that a region still reads as
     * itself, low enough that the boundary is a transition rather than a line.
     *
     * The per-quad noise, altitude and slope modifiers still come from
     * groundColorAt(), so the map keeps agreeing with the ground underfoot.
     */
    _blendedGroundColor(x, z) {
        const rm = this.world.regionMap;
        // Ask groundColorAt for the full treatment at this point, then re-tint it
        // by the difference between the blended base and the hard base. This
        // keeps every modifier (noise, hillside greying, bare-earth slopes)
        // without duplicating any of it here.
        const exact = rm.groundColorAt(x, z);
        const hard = REGION_GROUND_COLOR[rm.regionAt(x, z)];
        if (!hard) return exact;

        let wr = 0, wg = 0, wb = 0, wsum = 0;
        for (const p of rm.points) {
            const dx = p.x - x, dz = p.z - z;
            const d2 = dx * dx + dz * dz;
            const base = REGION_GROUND_COLOR[p.type];
            if (!base) continue;
            // +1 guards the singularity at a seed point itself.
            const w = 1 / Math.pow(d2 + 1, BLEND_FALLOFF);
            wr += base[0] * w; wg += base[1] * w; wb += base[2] * w; wsum += w;
        }
        if (wsum === 0) return exact;

        // exact - hard is everything groundColorAt added on top of the flat
        // region colour; carry it over onto the blended base.
        return [
            wr / wsum + (exact[0] - hard[0]),
            wg / wsum + (exact[1] - hard[1]),
            wb / wsum + (exact[2] - hard[2]),
        ];
    }

    // ---------- item annotations ----------

    /**
     * Register the generated collectibles. Positions are known to the map layer
     * from the start (they are needed to test proximity) but nothing is drawn
     * until `spotted` flips, so knowing them leaks nothing to the player.
     */
    registerItems(items) {
        for (const it of items) {
            this.items.set(it.id, {
                id: it.id,
                kind: it.kind,
                name: it.name,
                pos: [it.pos[0], it.pos[2]],
                spotted: false,
                collected: false,
            });
        }
        events.on('itemCollected', ({ id }) => {
            const entry = this.items.get(id);
            if (!entry) return;
            // Picking something up implies having seen it, which matters for the
            // rare case of walking into an item from behind a rise.
            entry.spotted = true;
            entry.collected = true;
            this._pendingEmit = true;
        });
    }

    _spotItems(px, pz) {
        const rSq = ITEM_SPOT_RADIUS * ITEM_SPOT_RADIUS;
        for (const entry of this.items.values()) {
            if (entry.spotted) continue;
            const dx = entry.pos[0] - px, dz = entry.pos[1] - pz;
            if (dx * dx + dz * dz <= rSq) {
                entry.spotted = true;
                this._pendingEmit = true;
                this._announce({
                    kind: entry.kind,
                    name: entry.name,
                    // Plain text, matching the region toast: the book/vase emoji
                    // render at inconsistent sizes and can fall back to tofu.
                    label: 'SPOTTED — ' + entry.name,
                });
            }
        }
    }

    /** Items worth drawing: anything spotted, collected or not. */
    visibleItems() {
        const out = [];
        for (const e of this.items.values()) if (e.spotted) out.push(e);
        return out;
    }

    get spottedCount() {
        let n = 0;
        for (const e of this.items.values()) if (e.spotted) n++;
        return n;
    }

    // ---------- region annotations ----------

    /**
     * One label per *named place*, not per Voronoi seed: regions.js seeds several
     * forest and shore points (plus filler seeds near the centre) and writing
     * "The Forest" four times across the map would read as noise. The unique
     * landmark regions each get their own label; the repeated scenery types get
     * one label, at whichever of their seeds the player reveals first.
     */
    _initRegions() {
        const NAMES = {
            shore: 'The Shore', forest: 'The Forest', cave: 'The Cave',
            lighthouse: 'The Lighthouse', cemetery: 'The Cemetery',
            garden: 'The Garden', ruins: 'Ancient Ruins', library: 'The Library',
            museum: 'The Museum', meadow: 'The Meadow',
        };
        // Landmark regions are one-of-a-kind and always worth their own pin.
        const UNIQUE = new Set(['cave', 'lighthouse', 'cemetery', 'garden', 'ruins', 'library', 'museum']);

        const out = [];
        for (const p of this.world.regionMap.points) {
            out.push({
                type: p.type,
                name: NAMES[p.type] || p.type,
                x: p.x, z: p.z,
                unique: UNIQUE.has(p.type),
                discovered: false,
            });
        }
        return out;
    }

    /**
     * Flip region labels on once a decent share of the ground around their
     * anchor is revealed. Only regions near the player are re-tested, since a
     * region's coverage cannot change unless the player is inside the disc that
     * would add to it.
     *
     * Non-unique types (forest, shore, meadow, and the filler seeds) are capped
     * at one discovered label each, claimed by whichever seed the player reaches
     * first — several "The Forest" labels across one map read as noise.
     */
    _updateRegionLabels(px, pz) {
        const nearCutoff = (REGION_LABEL_SAMPLE_R + REVEAL_RADIUS) ** 2;
        for (const reg of this.regions) {
            if (reg.discovered) continue;
            const dx = reg.x - px, dz = reg.z - pz;
            if (dx * dx + dz * dz > nearCutoff) continue;
            if (!reg.unique && this.regions.some(r => r.discovered && r.type === reg.type)) continue;
            if (this._coverageAround(reg.x, reg.z, REGION_LABEL_SAMPLE_R) >= REGION_LABEL_THRESHOLD) {
                reg.discovered = true;
                this._pendingEmit = true;
                this._announce({
                    kind: 'region',
                    name: reg.name,
                    // Plain text rather than a map emoji: U+1F5FA has patchy font
                    // coverage and falls back to a tofu box on some systems.
                    label: 'MAPPED — ' + reg.name,
                });
            }
        }
    }

    /** Fraction of revealed cells within `radius` world units of (x,z). */
    _coverageAround(x, z, radius) {
        const [c0x, c0z] = this.cellOf(x, z);
        const span = Math.ceil(radius / MAP_CELL);
        const rSq = radius * radius;
        let total = 0, seen = 0;
        for (let cz = c0z - span; cz <= c0z + span; cz++) {
            for (let cx = c0x - span; cx <= c0x + span; cx++) {
                if (!this.inBounds(cx, cz)) continue;
                const [wx, wz] = this.cellCenter(cx, cz);
                const dx = wx - x, dz = wz - z;
                if (dx * dx + dz * dz > rSq) continue;
                total++;
                if (this.cells[cz * this.size + cx] === CELL_SEEN) seen++;
            }
        }
        return total === 0 ? 0 : seen / total;
    }

    discoveredRegions() {
        return this.regions.filter(r => r.discovered);
    }

    // ---------- persistence ----------

    /**
     * Adopt a revealed/unrevealed grid from a save and re-sample the colour of
     * every revealed cell.
     *
     * The colours are re-derived rather than stored because they are a pure
     * function of the seed — the same heightmap and region lookups that produced
     * them the first time produce them again. That does mean one bulk sampling
     * pass here, which is the expensive operation the incremental reveal exists
     * to avoid: a fully-charted island is ~8800 cells, each running several
     * octaves of noise. It costs a fraction of a second once, at load, on a
     * frame where the player is still looking at the title screen — which is a
     * better trade than carrying a 4x larger save forever.
     *
     * The exploration count is recomputed from the grid rather than trusted from
     * the save, so a hand-edited or truncated save cannot desync the percentage.
     */
    restoreCells(cells) {
        if (!cells || cells.length !== this.cells.length) return;
        let seen = 0;
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] !== CELL_SEEN) {
                this.cells[i] = CELL_UNKNOWN;
                this.colors[i] = 0;
                continue;
            }
            this.cells[i] = CELL_SEEN;
            seen++;
            const cx = i % this.size, cz = (i - (i % this.size)) / this.size;
            const [wx, wz] = this.cellCenter(cx, cz);
            this.colors[i] = this._sampleColor(wx, wz);
        }
        this._seenCount = seen;
        events.emit('mapExplored', {
            fraction: this.exploredFraction,
            seen: this._seenCount,
            total: this._reachableCount,
        });
    }
}
