/**
 * props.js — pickups, explosive barrels and set dressing, all built from
 * vertex-coloured primitives for the actor shader.
 *
 * Pickups bob and spin over a coloured halo. Static decor for a whole level
 * is merged into one mesh; fires, flickers and drips are spawned by the game
 * from the emitters list this returns.
 */
import * as THREE from 'three';
import { prim, hexToRgb } from './models.js';
import { actorMaterial, glowMaterial, GLOW_GEO } from '../render/materials.js';
import { PICKUPS, KEY_COLORS } from '../config.js';

const { T, sphere, box, cyl, cone, torus, merge, finish } = prim;
const RED = [0.9, 0.08, 0.06], WHITE = [0.92, 0.92, 0.9], BRASS = [0.85, 0.65, 0.25], DARK = [0.12, 0.12, 0.14], STEEL = [0.45, 0.47, 0.5];

function cross(s, color, glow, z) {
    return [T(box(s * 0.7, s * 0.22, 0.02, color, glow), [0, 0, z]), T(box(s * 0.22, s * 0.7, 0.02, color, glow), [0, 0, z])];
}

function weaponShape(id) {
    const p = [];
    switch (id) {
        case 'shotgun': p.push(box(0.12, 0.12, 0.9, DARK), T(cyl(0.035, 0.035, 0.9, STEEL), [0, 0.07, 0.15], [Math.PI / 2, 0, 0]), T(box(0.1, 0.16, 0.25, [0.4, 0.25, 0.12]), [0, -0.03, 0.15]), T(box(0.1, 0.18, 0.3, [0.4, 0.25, 0.12]), [0, -0.05, -0.5])); break;
        case 'ssg': for (const s of [-1, 1]) p.push(T(cyl(0.04, 0.04, 0.8, STEEL), [s * 0.045, 0.05, 0.2], [Math.PI / 2, 0, 0])); p.push(T(box(0.16, 0.12, 0.35, [0.45, 0.28, 0.12]), [0, -0.02, -0.3]), T(box(0.16, 0.1, 0.3, DARK), [0, 0, -0.05])); break;
        case 'chaingun': for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; p.push(T(cyl(0.025, 0.025, 0.8, STEEL), [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.3], [Math.PI / 2, 0, 0])); } p.push(T(box(0.25, 0.25, 0.4, DARK), [0, 0, -0.15]), T(torus(0.09, 0.02, [0.8, 0.6, 0.1]), [0, 0, 0.55])); break;
        case 'rocket': p.push(T(cyl(0.11, 0.11, 1.0, [0.3, 0.32, 0.28]), [0, 0, 0], [Math.PI / 2, 0, 0]), T(box(0.12, 0.25, 0.2, DARK), [0, -0.18, -0.1]), T(cyl(0.13, 0.13, 0.1, [0.8, 0.5, 0.1]), [0, 0, 0.5], [Math.PI / 2, 0, 0])); break;
        case 'plasma': p.push(box(0.18, 0.2, 0.8, [0.25, 0.28, 0.35]), T(cyl(0.06, 0.06, 0.5, [0.3, 0.8, 1], 1), [0, 0.12, 0.05], [Math.PI / 2, 0, 0]), T(torus(0.09, 0.025, [0.3, 0.8, 1], 1), [0, 0, 0.42])); break;
        case 'rail': p.push(box(0.14, 0.14, 1.1, [0.2, 0.2, 0.25]), T(box(0.04, 0.04, 1.0, [0.5, 0.4, 1], 1), [0, 0.09, 0.05]), T(box(0.16, 0.25, 0.25, DARK), [0, -0.12, -0.35])); break;
        case 'bfg': p.push(T(sphere(0.32, [0.25, 0.22, 0.3], 0, 12), [0, 0, 0]), T(sphere(0.18, [0.6, 0.35, 1], 1, 10), [0, 0, 0.22]), T(torus(0.34, 0.04, [0.6, 0.35, 1], 1), [0, 0, 0.05]), T(box(0.2, 0.2, 0.5, DARK), [0, -0.1, -0.35])); break;
        default: p.push(box(0.2, 0.2, 0.6, DARK));
    }
    return p;
}

export function pickupParts(id) {
    const P = PICKUPS[id];
    const c = P.color ? hexToRgb(P.color) : WHITE;
    let p = [];
    switch (id) {
        case 'stim': p = [box(0.32, 0.22, 0.22, WHITE), ...cross(0.22, RED, 0.6, 0.115)]; break;
        case 'medkit': p = [box(0.6, 0.36, 0.3, WHITE), ...cross(0.3, RED, 0.6, 0.16), T(box(0.25, 0.06, 0.05, DARK), [0, 0.21, 0])]; break;
        case 'vial': p = [cyl(0.08, 0.08, 0.3, [0.25, 0.5, 1], 0.5), T(cyl(0.05, 0.05, 0.08, STEEL), [0, 0.19, 0])]; break;
        case 'soul': p = [sphere(0.34, [0.25, 0.5, 1], 0.42, 16), T(sphere(0.16, [0.8, 0.95, 1], 0.9, 10), [0, 0, 0]), T(torus(0.46, 0.02, [0.6, 0.85, 1], 0.7), [0, 0, 0], [Math.PI / 2, 0, 0])]; break;
        case 'shard': p = [T(finish(new THREE.OctahedronGeometry(0.17, 0), [0.35, 0.9, 0.35], 0.45), [0, 0, 0], [0, 0, 0], [1, 1.6, 1])]; break;
        case 'vest': case 'mega': {
            const col = id === 'vest' ? [0.25, 0.75, 0.3] : [0.25, 0.5, 1.0];
            p = [box(0.55, 0.6, 0.25, col), T(box(0.22, 0.18, 0.27, col), [-0.2, 0.36, 0]), T(box(0.22, 0.18, 0.27, col), [0.2, 0.36, 0]), T(box(0.4, 0.08, 0.27, [0.2, 0.2, 0.2]), [0, -0.1, 0.01]), T(box(0.1, 0.1, 0.02, col.map((v) => Math.min(1, v * 1.5)), 1), [0, 0.12, 0.135])];
            break;
        }
        case 'clip': p = [box(0.12, 0.25, 0.06, DARK), T(box(0.06, 0.04, 0.04, BRASS), [0, 0.14, 0])]; break;
        case 'ammobox': p = [box(0.5, 0.25, 0.3, [0.3, 0.35, 0.22]), T(box(0.4, 0.04, 0.25, BRASS), [0, 0.14, 0])]; break;
        case 'shells': p = [0, 1, 2, 3].map((k) => T(cyl(0.035, 0.035, 0.16, RED), [(k - 1.5) * 0.08, 0, 0])); break;
        case 'shellbox': p = [box(0.5, 0.22, 0.28, [0.5, 0.12, 0.08]), T(box(0.3, 0.08, 0.02, [0.95, 0.8, 0.4]), [0, 0, 0.15])]; break;
        case 'rocket1': p = [0, 1].map((k) => T(cyl(0.06, 0.06, 0.55, [0.35, 0.36, 0.3]), [(k - 0.5) * 0.15, 0, 0], [0, 0, Math.PI / 2])).concat([0, 1].map((k) => T(cone(0.06, 0.12, RED), [(k - 0.5) * 0.15 + 0.33, 0, 0], [0, 0, -Math.PI / 2]))); break;
        case 'rocketbox': p = [box(0.8, 0.3, 0.4, [0.3, 0.32, 0.22]), T(box(0.6, 0.06, 0.02, [1, 0.6, 0.1], 0.5), [0, 0.05, 0.21])]; break;
        case 'cell': p = [cyl(0.1, 0.1, 0.3, [0.2, 0.22, 0.25]), T(cyl(0.07, 0.07, 0.31, [0.3, 0.85, 1], 1), [0, 0, 0])]; break;
        case 'cellpack': p = [box(0.45, 0.45, 0.3, [0.2, 0.22, 0.25]), T(box(0.35, 0.08, 0.02, [0.3, 0.85, 1], 1), [0, 0.1, 0.16]), T(box(0.35, 0.08, 0.02, [0.3, 0.85, 1], 1), [0, -0.05, 0.16])]; break;
        case 'backpack': p = [box(0.45, 0.55, 0.25, [0.4, 0.3, 0.15]), T(box(0.35, 0.22, 0.12, [0.35, 0.25, 0.12]), [0, -0.1, 0.17]), T(box(0.4, 0.06, 0.27, DARK), [0, 0.15, 0])]; break;
        case 'berserk': p = [box(0.5, 0.36, 0.3, [0.08, 0.08, 0.08]), ...cross(0.3, [1, 0.1, 0.05], 1, 0.16)]; break;
        case 'overdrive': p = [finish(new THREE.IcosahedronGeometry(0.3, 0), [0.6, 0.25, 0.95], 0.45), T(torus(0.42, 0.022, [0.85, 0.55, 1], 0.7), [0, 0, 0], [0.6, 0, 0])]; break;
        case 'haste': p = [T(cone(0.18, 0.38, [0.2, 0.85, 0.8], 0.45), [0, 0.19, 0]), T(cone(0.18, 0.38, [0.2, 0.85, 0.8], 0.45), [0, -0.19, 0], [Math.PI, 0, 0]), T(torus(0.3, 0.02, [0.6, 1, 1], 0.7), [0, 0, 0], [Math.PI / 2, 0, 0])]; break;
        case 'invuln': p = [sphere(0.3, [0.4, 0.85, 0.3], 0.4, 14), T(torus(0.42, 0.022, [0.75, 1, 0.55], 0.7), [0, 0, 0], [Math.PI / 2, 0, 0]), T(torus(0.42, 0.022, [0.75, 1, 0.55], 0.7), [0, 0, 0], [0, 0, Math.PI / 2])]; break;
        case 'cloak': p = [sphere(0.3, [0.45, 0.55, 0.9], 0.25, 14), T(sphere(0.11, [0.9, 0.95, 1], 0.8, 8), [0, 0, 0])]; break;
        case 'suit': p = [T(cyl(0.2, 0.18, 0.55, [0.75, 0.85, 0.2]), [0, -0.05, 0]), T(sphere(0.17, [0.75, 0.85, 0.2], 0, 10), [0, 0.33, 0]), T(box(0.18, 0.1, 0.05, [0.3, 0.9, 0.9], 1), [0, 0.34, 0.15])]; break;
        case 'surveyor': p = [sphere(0.2, STEEL, 0, 12), T(torus(0.3, 0.03, [1, 0.9, 0.3], 1), [0, 0, 0], [Math.PI / 2, 0, 0]), T(sphere(0.07, [1, 0.9, 0.3], 1, 8), [0, 0, 0.18])]; break;
        default:
            if (id.startsWith('key_')) {
                const kc = hexToRgb(KEY_COLORS[id.slice(4)]);
                p = [box(0.3, 0.42, 0.03, kc, 0.8), T(box(0.2, 0.06, 0.035, [1, 1, 1], 1), [0, 0.1, 0]), T(box(0.08, 0.08, 0.04, DARK), [0, -0.1, 0])];
            } else if (id.startsWith('w_')) {
                p = weaponShape(id.slice(2));
            } else p = [box(0.3, 0.3, 0.3, c)];
    }
    return p;
}

const pickupGeo = new Map();
const pickupMats = new Map();

export function makePickup(id) {
    if (!pickupGeo.has(id)) pickupGeo.set(id, merge(pickupParts(id)));
    const P = PICKUPS[id];
    const glowCol = P.kind === 'key' ? KEY_COLORS[P.key] : P.color ?? (P.kind === 'ammo' ? 0xffd080 : 0xffffff);
    const big = P.kind === 'power' || P.kind === 'weapon' || P.kind === 'key' || P.power || P.kind === 'map' || P.kind === 'backpack';
    const matKey = id;
    if (!pickupMats.has(matKey)) {
        const m = actorMaterial({ glow: glowCol, rim: 0.5, noise: 6, transparent: id === 'cloak' });
        m.userData.shared = true;
        pickupMats.set(matKey, m);
    }
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(pickupGeo.get(id), pickupMats.get(matKey));
    g.add(mesh);
    const halo = new THREE.Mesh(GLOW_GEO, glowMaterial(new THREE.Color(glowCol).multiplyScalar(big ? 0.28 : 0.16), 0x000000, 1, 1.8));
    halo.scale.setScalar(big ? 1.6 : 0.9);
    halo.renderOrder = 15;
    g.add(halo);
    g.userData = { mesh, halo, big, spin: P.kind !== 'health' || id === 'soul' };
    return g;
}

// ------------------------------------------------------------------ barrels

const BARREL_GOO = { station: [0.3, 1, 0.2], foundry: [1, 0.55, 0.1], hell: [1, 0.15, 0.1], throne: [0.7, 0.4, 1] };
let barrelGeo = null, barrelTheme = null;
export function makeBarrel(theme) {
    if (!barrelGeo || barrelTheme !== theme) {
        barrelTheme = theme;
        const goo = BARREL_GOO[theme] ?? BARREL_GOO.station;
        const body = theme === 'hell' ? [0.35, 0.2, 0.15] : theme === 'foundry' ? [0.45, 0.25, 0.12] : [0.3, 0.35, 0.3];
        barrelGeo = merge([
            T(cyl(0.38, 0.38, 1.05, body, 0, 14), [0, 0.525, 0]),
            T(torus(0.385, 0.025, DARK), [0, 0.25, 0], [Math.PI / 2, 0, 0]),
            T(torus(0.385, 0.025, DARK), [0, 0.8, 0], [Math.PI / 2, 0, 0]),
            T(cyl(0.3, 0.3, 0.04, goo, 1, 14), [0, 1.06, 0]),
            T(box(0.3, 0.3, 0.01, [0.95, 0.8, 0.1], 0.3), [0, 0.55, 0.385]),
        ]);
    }
    const goo = BARREL_GOO[theme] ?? BARREL_GOO.station;
    const m = new THREE.Mesh(barrelGeo, actorMaterial({ glow: new THREE.Color(goo[0], goo[1], goo[2]).getHex(), rim: 0.3 }));
    return m;
}

// ------------------------------------------------------------------ decor

const DECOR = {
    console: (c) => [box(0.9, 0.9, 0.5, [0.25, 0.27, 0.3]), T(box(0.8, 0.45, 0.05, [0.2, 0.9, 0.7], 0.9), [0, 0.6, 0.15], [-0.5, 0, 0]), T(box(0.7, 0.05, 0.3, DARK), [0, 0.46, 0.1])].map((g) => T(g, [0, 0.45, 0])),
    pipe: (c, h) => [T(cyl(0.22, 0.22, h, [0.4, 0.38, 0.35], 0, 10), [0, h / 2, 0]), T(torus(0.24, 0.04, DARK), [0, 0.6, 0], [Math.PI / 2, 0, 0]), T(torus(0.24, 0.04, DARK), [0, h - 0.6, 0], [Math.PI / 2, 0, 0]), T(cyl(0.08, 0.08, 0.3, [0.8, 0.1, 0.05]), [0.25, 1.2, 0], [0, 0, Math.PI / 2])],
    lamp: (c) => [T(cyl(0.05, 0.08, 1.8, DARK), [0, 0.9, 0]), T(cyl(0.25, 0.25, 0.08, DARK), [0, 0.04, 0]), T(sphere(0.18, [1, 0.9, 0.7], 1, 10), [0, 1.85, 0])],
    debris: () => [0, 1, 2, 3, 4].map((k) => T(box(0.2 + (k % 3) * 0.1, 0.12, 0.25, [0.35, 0.33, 0.3]), [Math.sin(k * 2.3) * 0.5, 0.06, Math.cos(k * 1.7) * 0.5], [0, k, 0])),
    body: () => [T(box(0.45, 0.22, 1.1, [0.25, 0.3, 0.22]), [0, 0.11, 0]), T(sphere(0.15, [0.65, 0.55, 0.45], 0, 8), [0, 0.15, 0.7]), T(box(0.12, 0.1, 0.6, [0.25, 0.3, 0.22]), [0.32, 0.06, 0.1], [0, 0.4, 0]), T(box(0.9, 0.01, 0.8, [0.35, 0.02, 0.02]), [0, 0.01, 0])],
    chain: (c, h) => [T(cyl(0.03, 0.03, h * 0.6, STEEL), [0, h * 0.7, 0]), T(cone(0.12, 0.3, STEEL), [0, h * 0.38, 0], [Math.PI, 0, 0])],
    brazier: () => [T(cyl(0.35, 0.18, 0.35, [0.25, 0.22, 0.2]), [0, 0.95, 0]), T(cyl(0.06, 0.12, 0.8, DARK), [0, 0.4, 0]), T(cyl(0.3, 0.3, 0.05, [1, 0.5, 0.1], 1), [0, 1.1, 0])],
    spike: () => [T(cone(0.07, 2.2, [0.3, 0.25, 0.22]), [0, 1.1, 0]), T(sphere(0.17, [0.85, 0.8, 0.68], 0, 8), [0, 1.55, 0]), T(sphere(0.05, [1, 0.3, 0.1], 1, 6), [0.06, 1.58, 0.14]), T(sphere(0.05, [1, 0.3, 0.1], 1, 6), [-0.06, 1.58, 0.14])],
    bones: () => [0, 1, 2, 3, 4, 5].map((k) => T(cyl(0.035, 0.035, 0.5, [0.85, 0.8, 0.68]), [Math.sin(k * 2.1) * 0.35, 0.04, Math.cos(k * 1.3) * 0.35], [Math.PI / 2, k * 1.1, 0])).concat([T(sphere(0.14, [0.85, 0.8, 0.68], 0, 8), [0.1, 0.12, 0.05])]),
    tree: () => {
        const p = [T(cyl(0.12, 0.25, 2.6, [0.35, 0.12, 0.1]), [0, 1.3, 0])];
        for (let k = 0; k < 5; k++) p.push(T(cyl(0.03, 0.08, 1.1, [0.35, 0.12, 0.1]), [Math.sin(k * 1.3) * 0.3, 2.2 + k * 0.12, Math.cos(k * 1.3) * 0.3], [Math.cos(k * 1.3) * 0.9, 0, -Math.sin(k * 1.3) * 0.9]));
        for (let k = 0; k < 4; k++) p.push(T(sphere(0.09, [1, 0.3, 0.15], 0.8, 6), [Math.sin(k * 1.9) * 0.7, 2.6 + (k % 2) * 0.3, Math.cos(k * 1.9) * 0.7]));
        return p;
    },
    candles: () => [0, 1, 2, 3, 4].flatMap((k) => { const x = Math.sin(k * 2.4) * 0.25, z = Math.cos(k * 2.4) * 0.25, h = 0.15 + (k % 3) * 0.1; return [T(cyl(0.035, 0.035, h, [0.9, 0.85, 0.7]), [x, h / 2, z]), T(sphere(0.035, [1, 0.7, 0.3], 1, 6), [x, h + 0.04, z])]; }),
    crystal: () => [0, 1, 2, 3].map((k) => T(cone(0.12 + k * 0.03, 0.8 + (k % 2) * 0.5, [0.65, 0.45, 1], 0.7, 5), [Math.sin(k * 1.7) * 0.2, 0.4, Math.cos(k * 1.7) * 0.2], [Math.sin(k) * 0.3, 0, Math.cos(k) * 0.3])),
};

/** Build all decor for a level into one mesh; returns {mesh, emitters, solids}. */
export function buildDecor(L, cellSize) {
    const parts = [];
    const emitters = [];
    for (const t of L.things) {
        if (t.type !== 'decor') continue;
        const f = DECOR[t.d];
        if (!f) continue;
        const i = t.cell;
        const h = L.ceil[i] - L.floor[i];
        const x = t.x * cellSize, z = t.z * cellSize, y = L.floor[i];
        const rot = t.rot ?? 0;
        for (const g of f(null, h)) parts.push(T(g, [x, y, z], [0, rot, 0]));
        if (t.d === 'brazier') emitters.push({ kind: 'fire', x, y: y + 1.15, z, scale: 1 });
        if (t.d === 'candles') emitters.push({ kind: 'candle', x, y: y + 0.3, z });
        if (t.d === 'lamp') emitters.push({ kind: 'light', x, y: y + 1.85, z, color: 0xffe0b0 });
    }
    if (!parts.length) return { mesh: null, emitters };
    const geo = merge(parts);
    geo.userData.shared = false;
    const mesh = new THREE.Mesh(geo, actorMaterial({ glow: 0xffaa55, rim: 0.15, noise: 5 }));
    mesh.matrixAutoUpdate = false;
    return { mesh, emitters };
}
