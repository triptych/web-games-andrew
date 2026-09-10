/**
 * heightmap.js — procedural island elevation.
 * Height = radial falloff (island shape) + fbm noise (hills/roughness),
 * with a few carved features (crater lake, cave-mouth cliff) layered on.
 * Everything else (regions, vegetation, structures, water) queries
 * `heightAt(x,z)` rather than storing its own copy of elevation.
 */

import { ValueNoise2D } from './noise.js';

export class Heightmap {
    /**
     * @param seed        numeric seed
     * @param islandRadius world-unit radius of the island (coastline ~ this)
     */
    constructor(seed, islandRadius = 260) {
        this.seed = seed;
        this.radius = islandRadius;
        this.noise = new ValueNoise2D(seed, 256);
        this.detailNoise = new ValueNoise2D(seed + 777, 256);
    }

    /** Raw radial falloff in [0,1], 1 at center, 0 at/after coastline. */
    _falloff(x, z) {
        const d = Math.sqrt(x * x + z * z) / this.radius;
        // smooth shoulder so the coast isn't a perfect circle — bias with noise below
        const shoreNoise = (this.noise.fbm(x, z, 3, 0.006, 0.5) - 0.5) * 0.35;
        const dd = d - shoreNoise;
        if (dd >= 1) return 0;
        if (dd <= 0) return 1;
        const t = 1 - dd;
        return t * t * (3 - 2 * t);
    }

    /**
     * World-space height (Y) at (x,z).
     *
     * Vertical scale matters a lot here: the island is ~260 units across, so a
     * peak of only ~15 units makes the whole place read as a flat sheet from eye
     * level (1.7 units up). The terms below are tuned to reach ~70 units at the
     * summit — roughly a 1:4 height-to-radius ratio — so ridgelines actually
     * occlude each other and the regions feel separated by real landform.
     */
    heightAt(x, z) {
        const shape = this._falloff(x, z);
        if (shape <= 0) return -3.5; // seabed below water

        const hills = this.noise.fbm(x, z, 5, 0.012, 0.52);
        const detail = this.detailNoise.fbm(x, z, 3, 0.08, 0.5);

        // Raising `shape` to a power >1 keeps the coastal shelf gentle (good for
        // beaches and the shore region) while letting the interior climb steeply.
        const dome = Math.pow(shape, 1.35);
        let h = dome * 62 - 7;
        h += (hills - 0.5) * 30 * shape;   // large-scale hills and valleys
        h += (detail - 0.5) * 3.0 * shape; // fine surface roughness

        // Central highland massif — the island's spine, and what the lighthouse
        // headland and cave hillside get carved out of.
        const distCenter = Math.sqrt(x * x + z * z);
        const massifR = this.radius * 0.42;
        if (distCenter < massifR) {
            const t = 1 - distCenter / massifR;
            h += t * t * 22;
        }
        return h;
    }

    /** Approximate surface normal via finite differences (for shading ground chunks / slope checks). */
    normalAt(x, z, eps = 1) {
        const hL = this.heightAt(x - eps, z);
        const hR = this.heightAt(x + eps, z);
        const hD = this.heightAt(x, z - eps);
        const hU = this.heightAt(x, z + eps);
        const nx = (hL - hR) / (2 * eps);
        const nz = (hD - hU) / (2 * eps);
        const ny = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return [nx / len, ny / len, nz / len];
    }

    /** Slope steepness (0 = flat, larger = steeper) — used to keep trees off cliffs, place cliff rock, etc. */
    slopeAt(x, z, eps = 1.5) {
        const n = this.normalAt(x, z, eps);
        return 1 - n[1]; // 0 flat .. ~1 vertical
    }

    isUnderwater(x, z) {
        return this.heightAt(x, z) < 0;
    }
}
