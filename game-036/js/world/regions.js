/**
 * regions.js — assigns a named region to any (x,z) via nearest-seed-point
 * (Voronoi-style) lookup. Region seed points are placed procedurally from
 * the world seed, biased so each named region type gets a sensible spot
 * on the island (e.g. lighthouse near the coast, cave into a hillside).
 *
 * Regions drive: ground tint, vegetation density/type, structure spawns,
 * and item-placement weighting.
 */

import { makeRng, ValueNoise2D } from './noise.js';

export const REGION_TYPES = [
    'shore', 'forest', 'cave', 'lighthouse', 'cemetery',
    'garden', 'ruins', 'library', 'museum', 'meadow',
];

// Base tint applied to ground triangles per region (flat-shaded low-poly palette).
export const REGION_GROUND_COLOR = {
    shore:      [214, 202, 158],
    forest:     [58, 96, 46],
    cave:       [70, 66, 64],
    lighthouse: [142, 138, 118],
    cemetery:   [86, 92, 74],
    garden:     [92, 132, 68],
    ruins:      [120, 112, 96],
    library:    [110, 118, 96],
    museum:     [124, 118, 108],
    meadow:     [110, 150, 74],
};

export class RegionMap {
    /**
     * @param seed          numeric seed
     * @param islandRadius  world-unit radius of the island
     * @param heightmap     Heightmap, used to keep seed points on viable land.
     *                      Optional; without it points land wherever the plan says.
     */
    constructor(seed, islandRadius, heightmap = null) {
        const rng = makeRng(seed + 12345);
        this.radius = islandRadius;
        this.heightmap = heightmap;
        this.points = [];
        // Drives the per-quad ground tint variation in groundColorAt().
        this._tintNoise = new ValueNoise2D(seed + 8191, 256);

        // Hand-biased placement: pick an angle+distance band per region type so the
        // island reads as distinct areas rather than random noise soup.
        const plan = [
            { type: 'lighthouse', angle: 0.15, dist: 0.92 },
            { type: 'cave',       angle: 0.55, dist: 0.80 },
            { type: 'cemetery',   angle: 1.05, dist: 0.68 },
            { type: 'garden',     angle: 1.65, dist: 0.62 },
            { type: 'library',    angle: 2.15, dist: 0.55 },
            { type: 'museum',     angle: 2.65, dist: 0.58 },
            { type: 'ruins',      angle: 3.35, dist: 0.75 },
            { type: 'shore',      angle: 3.95, dist: 0.95 },
            { type: 'forest',     angle: 4.6,  dist: 0.5 },
            { type: 'meadow',     angle: 5.3,  dist: 0.35 },
            { type: 'forest',     angle: 0.85, dist: 0.35 },
            { type: 'shore',      angle: 1.4,  dist: 0.97 },
            { type: 'forest',     angle: 2.9,  dist: 0.4 },
            { type: 'shore',      angle: 5.9,  dist: 0.96 },
            { type: 'meadow',     angle: 4.1,  dist: 0.28 },
        ];

        for (const p of plan) {
            const jAngle = p.angle + (rng() - 0.5) * 0.3;
            const jDist = p.dist + (rng() - 0.5) * 0.12;
            const placed = this._placeOnLand(jAngle, jDist, p.type, islandRadius);
            this.points.push({ x: placed.x, z: placed.z, type: p.type });
        }
        // A few extra forest/meadow filler seeds near center for variety
        for (let i = 0; i < 6; i++) {
            const a = rng() * Math.PI * 2, d = rng() * 0.3;
            this.points.push({
                x: Math.cos(a) * d * islandRadius,
                z: Math.sin(a) * d * islandRadius,
                type: rng() < 0.5 ? 'forest' : 'meadow',
            });
        }
    }

    /**
     * Walk a seed point inland along its ray until the terrain under it is high
     * enough to build on. The plan above places regions at fixed fractions of the
     * island radius, but the coastline is noise-displaced, so a nominally-inland
     * fraction can still land in the water for some seeds — which would sink the
     * lighthouse, cemetery, or garden below sea level.
     *
     * Coastal regions only need to clear the waterline; inland ones want enough
     * height that their buildings sit clearly above the shore.
     */
    _placeOnLand(angle, distFrac, type, islandRadius) {
        // Preferred standing height per region, in world units above sea level.
        // Walking inland from the coast the terrain climbs steeply, so rather than
        // accepting the first spot that clears the waterline (which always lands
        // right at the shelf edge) each region aims for the elevation that suits
        // it: the lighthouse and shore want to be low and near the water, the
        // cemetery and ruins want a bit of prominence, gardens want gentle ground.
        const TARGET = {
            shore: 1.5, lighthouse: 6, cave: 10,
            cemetery: 16, ruins: 20, garden: 12, library: 12, museum: 10,
        };
        const target = TARGET[type] ?? 12;
        const maxSlope = (type === 'garden' || type === 'library' || type === 'museum') ? 0.25 : 0.45;

        const toXZ = (frac) => ({
            x: Math.cos(angle) * frac * islandRadius,
            z: Math.sin(angle) * frac * islandRadius,
        });

        if (!this.heightmap) return toXZ(distFrac);

        // Scan inland along the ray and keep whichever point best matches the
        // target height while staying buildable (not on a cliff face).
        let best = null, bestCost = Infinity;
        for (let frac = distFrac; frac > 0.05; frac -= 0.015) {
            const p = toXZ(frac);
            const h = this.heightmap.heightAt(p.x, p.z);
            if (h < 1.0) continue; // underwater or tidal
            const slope = this.heightmap.slopeAt(p.x, p.z);
            const cost = Math.abs(h - target) + (slope > maxSlope ? 40 : 0);
            if (cost < bestCost) { bestCost = cost; best = p; }
        }
        return best ?? toXZ(0.1); // centre massif is always well above water
    }

    /** Region type at world (x,z). Falls back to 'shore' beyond the island edge influence. */
    regionAt(x, z) {
        let best = null, bestD = Infinity;
        for (const p of this.points) {
            const dx = p.x - x, dz = p.z - z;
            const d = dx * dx + dz * dz;
            if (d < bestD) { bestD = d; best = p; }
        }
        return best ? best.type : 'meadow';
    }

    /**
     * Ground tint at (x,z): the region's base colour, varied per-quad.
     *
     * A single flat colour per region makes large open slopes read as untextured
     * plastic — the terrain mesh is dense enough now that big areas share one
     * exact RGB and the eye reads them as a single surface rather than ground.
     * Three cheap modifiers break it up without any texturing:
     *
     *   - two octaves of noise, one broad (patchiness across a hillside) and one
     *     tight (per-quad grain), so neighbouring triangles differ slightly;
     *   - altitude, cooling and greying the palette toward the tops of ridges;
     *   - slope, exposing brown earth where the ground is too steep to hold turf,
     *     which also makes cliffs read as cliffs rather than tilted lawn.
     */
    groundColorAt(x, z) {
        const base = REGION_GROUND_COLOR[this.regionAt(x, z)] || [100, 130, 80];
        if (!this._tintNoise) return base;

        // Three scales, because one doesn't read as ground: a wide sweep that
        // gives a whole hillside lighter and darker regions, a mid band for
        // patchiness within that, and a tight per-quad grain so no two adjacent
        // triangles match exactly.
        const sweep = this._tintNoise.fbm(x, z, 2, 0.008, 0.5) - 0.5;
        const patch = this._tintNoise.fbm(x, z, 2, 0.04, 0.5) - 0.5;
        const grain = this._tintNoise.get(x * 0.45, z * 0.45) - 0.5;
        const v = sweep * 30 + patch * 18 + grain * 9;

        let r = base[0] + v, g = base[1] + v * 1.15, b = base[2] + v * 0.8;

        if (this.heightmap) {
            const h = this.heightmap.heightAt(x, z);
            // Above ~28 units the turf thins out: desaturate toward cool grey.
            const alt = Math.max(0, Math.min(1, (h - 28) / 34));
            if (alt > 0) {
                r += (150 - r) * alt * 0.55;
                g += (152 - g) * alt * 0.55;
                b += (146 - b) * alt * 0.55;
            }
            // Steep faces show bare earth rather than grass.
            const slope = this.heightmap.slopeAt(x, z, 2.5);
            const bare = Math.max(0, Math.min(1, (slope - 0.22) / 0.4));
            if (bare > 0) {
                r += (124 - r) * bare * 0.7;
                g += (104 - g) * bare * 0.7;
                b += (80 - b) * bare * 0.7;
            }
        }

        return [
            r < 0 ? 0 : (r > 255 ? 255 : r),
            g < 0 ? 0 : (g > 255 ? 255 : g),
            b < 0 ? 0 : (b > 255 ? 255 : b),
        ];
    }
}
