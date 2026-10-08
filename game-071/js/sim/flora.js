/**
 * flora.js — where every tree, rock, boulder and bush stands. Deterministic, and shared by the
 * view (instanced meshes) and physics (trunk and rock colliders).
 *
 * Instances are packed in Float32Arrays of stride 6: x, y, z, scale, rotation, type.
 */
import { WORLD, REGIONS, regionAt } from './geography.js';
import { hash01, smoothstep, clamp } from './rng.js';

export const TREE_TYPES = ['pine', 'fir', 'birch', 'autumn', 'dead', 'shrub'];
export const ROCK_TYPES = ['rock', 'boulder', 'crag'];

/** Keep-out discs (settlements, buildings, dungeon mouths) the scatter must avoid. */
export function makeFlora(terrain, keepOut = []) {
    const H = WORLD.HALF;
    const trees = [], rocks = [], bushes = [];
    const blocked = (x, z, pad = 0) => {
        for (const k of keepOut) { const dx = x - k.x, dz = z - k.z; if (dx * dx + dz * dz < (k.r + pad) ** 2) return true; }
        return false;
    };
    // ---- trees on a jittered 6 m grid
    const TS = 6;
    for (let gz = -H + TS / 2; gz < H; gz += TS) {
        for (let gx = -H + TS / 2; gx < H; gx += TS) {
            const ix = Math.round(gx), iz = Math.round(gz);
            const x = gx + (hash01(ix, iz, 1) - 0.5) * TS * 0.9, z = gz + (hash01(ix, iz, 2) - 0.5) * TS * 0.9;
            if (Math.abs(x) > WORLD.BORDER + 30 || Math.abs(z) > WORLD.BORDER + 30) continue;
            const forest = terrain.maskAt(x, z, 3);
            const r = hash01(ix, iz, 3);
            const lone = forest < 0.05 && r < 0.006;
            if (!lone && r > forest * forest * 0.75) continue;
            if (terrain.roadAt(x, z) > 0.05 || terrain.padAt(x, z) > 0.1) continue;
            const y = terrain.heightAt(x, z);
            if (y < 2.5 || terrain.waterAt(x, z) > y - 0.5) continue;
            if (terrain.slopeAt(x, z) > 0.42) continue;
            if (blocked(x, z, 2)) continue;
            const reg = REGIONS[regionAt(x, z)];
            const pickR = hash01(ix, iz, 4);
            let type = reg.trees[Math.floor(pickR * reg.trees.length)];
            if (type === 'shrub') type = pickR < 0.5 ? 'pine' : 'shrub';
            if (y > 360 && type !== 'dead') type = 'fir';
            const snow = terrain.maskAt(x, z, 1);
            if (snow > 0.6 && type === 'birch') type = 'fir';
            const s = (type === 'shrub' ? 0.7 : 0.75) + hash01(ix, iz, 5) * 0.6 + forest * 0.25;
            trees.push(x, y, z, s, hash01(ix, iz, 6) * Math.PI * 2, TREE_TYPES.indexOf(type));
        }
    }
    // ---- rocks: scattered stones everywhere, big boulders and crags on the steep and high ground
    const RS = 9;
    for (let gz = -H + RS / 2; gz < H; gz += RS) {
        for (let gx = -H + RS / 2; gx < H; gx += RS) {
            const ix = Math.round(gx * 3), iz = Math.round(gz * 3);
            const x = gx + (hash01(ix, iz, 11) - 0.5) * RS, z = gz + (hash01(ix, iz, 12) - 0.5) * RS;
            if (Math.abs(x) > H - 10 || Math.abs(z) > H - 10) continue;
            const slope = terrain.slopeAt(x, z);
            const y = terrain.heightAt(x, z);
            const r = hash01(ix, iz, 13);
            let type = -1, s = 1;
            if (slope > 0.32 && r < smoothstep(0.32, 0.6, slope) * 0.22) { type = y > 150 && r < 0.09 ? 2 : 1; s = type === 2 ? 5 + hash01(ix, iz, 14) * 9 : 1.6 + hash01(ix, iz, 14) * 3.5; }
            else if (r < 0.012 + terrain.maskAt(x, z, 3) * 0.01) { type = 0; s = 0.5 + hash01(ix, iz, 14) * 1.1; }
            else if (r > 0.997 && slope < 0.3) { type = 1; s = 1.8 + hash01(ix, iz, 14) * 2.2; }
            if (type < 0) continue;
            if (terrain.roadAt(x, z) > 0.02 || terrain.padAt(x, z) > 0.05) continue;
            if (blocked(x, z, s + 1)) continue;
            if (terrain.waterAt(x, z) > y + 2) continue;
            rocks.push(x, y - s * 0.25, z, s, hash01(ix, iz, 15) * Math.PI * 2, type);
        }
    }
    // ---- bushes and ferns in the undergrowth and along forest edges
    const BS = 5;
    for (let gz = -H + BS / 2; gz < H; gz += BS) {
        for (let gx = -H + BS / 2; gx < H; gx += BS) {
            const ix = Math.round(gx * 7), iz = Math.round(gz * 7);
            const x = gx + (hash01(ix, iz, 21) - 0.5) * BS, z = gz + (hash01(ix, iz, 22) - 0.5) * BS;
            const forest = terrain.maskAt(x, z, 3), grass = terrain.maskAt(x, z, 0), snow = terrain.maskAt(x, z, 1);
            const p = (forest * (1 - forest) * 1.2 + grass * 0.02) * (1 - snow);
            if (hash01(ix, iz, 23) > p) continue;
            if (terrain.roadAt(x, z) > 0.02 || terrain.padAt(x, z) > 0.05 || terrain.slopeAt(x, z) > 0.45) continue;
            const y = terrain.heightAt(x, z);
            if (y < 2 || terrain.waterAt(x, z) > y - 0.3) continue;
            if (blocked(x, z, 1)) continue;
            bushes.push(x, y, z, 0.6 + hash01(ix, iz, 24) * 0.8, hash01(ix, iz, 25) * Math.PI * 2, hash01(ix, iz, 26) < 0.55 ? 0 : 1);
        }
    }
    return { trees: new Float32Array(trees), rocks: new Float32Array(rocks), bushes: new Float32Array(bushes) };
}

/** Add trunk and rock colliders for every instance. */
export function addFloraColliders(flora, colliders) {
    const t = flora.trees;
    for (let i = 0; i < t.length; i += 6) {
        const type = TREE_TYPES[t[i + 5]];
        if (type === 'shrub') continue;
        const s = t[i + 3];
        colliders.add({ t: 'c', x: t[i], z: t[i + 2], r: (type === 'birch' || type === 'autumn' ? 0.18 : 0.3) * s, y0: t[i + 1] - 1, y1: t[i + 1] + 12 * s, tree: true });
    }
    const r = flora.rocks;
    for (let i = 0; i < r.length; i += 6) {
        const s = r[i + 3];
        if (s < 0.9) continue;
        colliders.add({ t: 'c', x: r[i], z: r[i + 2], r: s * 0.78, y0: r[i + 1] - s, y1: r[i + 1] + s * 0.9, rock: true });
    }
}

export function floraStats(f) {
    return { trees: f.trees.length / 6, rocks: f.rocks.length / 6, bushes: f.bushes.length / 6 };
}
export { clamp };
