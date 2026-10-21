// Scenery and buildings for Emberwyld Isle, all from painted primitives.
//
// Geometry builders (tree, pine, palm, rock...) return one merged, vertex-coloured BufferGeometry
// with its base at y = 0, so the island can scatter hundreds of them as instanced meshes.
// Building builders return a THREE.Group (toon meshes with outlines), with anything that moves
// (windmill sails, a lighthouse beam, a portal swirl) listed in group.userData.spin.

import * as THREE from 'three';
import { part, merge, toonMesh, toonMat, sph, cyl, cone, box, caps, tor, lathe, ico, dodec, shade, glowMat, paintGrad } from './toon.js';
import { hash3 } from '../rng.js';

const PI = Math.PI;

// ================================================================== scatter geometry

/** A round broadleaf tree: a trunk and three or four puffs. */
export function treeGeo(leaf = '#5cc04a', trunk = '#8a5a34', seed = 1) {
    const g = [part(cyl(0.12, 0.2, 1.3, 7), trunk, [0, 0.65, 0])];
    const n = 3 + Math.floor(hash3(seed, 1) * 2);
    g.push(part(ico(0.85, 1), leaf, [0, 1.75, 0], [0, 0, 0], [1, 0.85, 1]));
    for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + seed;
        g.push(part(ico(0.55, 1), shade(leaf, i % 2 ? 0.12 : -0.08), [Math.cos(a) * 0.55, 1.45 + hash3(seed, i) * 0.4, Math.sin(a) * 0.55]));
    }
    g.push(part(ico(0.45, 1), shade(leaf, 0.2), [0.1, 2.35, 0.05]));
    return merge(g);
}

/** An apple tree: a broadleaf with red dots. */
export function appleTreeGeo(seed = 1) {
    const g = [treeGeo('#62c84e', '#8a5a34', seed)];
    for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + seed, r = 0.75 + hash3(seed, i, 3) * 0.2;
        g.push(part(sph(0.11, 6, 5), '#ff3a3a', [Math.cos(a) * r, 1.5 + hash3(seed, i, 4) * 0.7, Math.sin(a) * r]));
    }
    return merge(g);
}

/** A pine: stacked cones, optionally snow-capped. */
export function pineGeo(color = '#2f8a5a', snow = false, seed = 1) {
    const g = [part(cyl(0.1, 0.16, 0.8, 6), '#6a4a30', [0, 0.4, 0])];
    for (let i = 0; i < 4; i++) {
        const r = 0.95 - i * 0.2, y = 0.8 + i * 0.55;
        g.push(part(cone(r, 0.95, 9), shade(color, i * 0.06), [0, y + 0.45, 0], [0, seed + i, 0]));
        if (snow) g.push(part(cone(r * 0.78, 0.42, 9), '#f4f9ff', [0, y + 0.72, 0], [0, seed + i, 0]));
    }
    return merge(g);
}

/** A palm tree with a curving trunk and drooping fronds (double-sided via a second, flipped set). */
export function palmGeo(seed = 1) {
    const g = [];
    const lean = 0.35 + hash3(seed, 2) * 0.3;
    let x = 0, y = 0;
    for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const nx = Math.sin(t * 1.4) * lean * 1.6, ny = (i + 1) * 0.5;
        g.push(part(cyl(0.13 - t * 0.04, 0.15 - t * 0.04, 0.55, 7), i % 2 ? '#a8763e' : '#c08a4a', [(x + nx) / 2, (y + ny) / 2, 0], [0, 0, -Math.atan2(nx - x, ny - y)]));
        x = nx; y = ny;
    }
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2 + seed;
        const leaf = new THREE.ConeGeometry(0.28, 1.7, 4, 1);
        leaf.scale(1, 1, 0.25);
        leaf.translate(0, 0.85, 0);
        g.push(part(leaf, i % 2 ? '#3fb04a' : '#5ac85a', [x, y + 0.05, 0], [0, -a, 1.9 + hash3(seed, i) * 0.4]));
    }
    for (let i = 0; i < 3; i++) g.push(part(sph(0.12, 6, 5), '#7a5a2a', [x + Math.cos(i * 2.1) * 0.14, y - 0.12, Math.sin(i * 2.1) * 0.14]));
    return merge(g);
}

/** A giant glowing-cap mushroom (the cap's underside is pale). */
export function mushroomGeo(cap = '#ff5a6a', seed = 1) {
    const g = [
        part(cyl(0.16, 0.22, 1.2, 9), '#fff2dc', [0, 0.6, 0]),
        part(new THREE.SphereGeometry(0.8, 14, 8, 0, PI * 2, 0, PI * 0.5), cap, [0, 1.15, 0], [0, 0, 0], [1, 0.7, 1]),
        part(cyl(0.78, 0.5, 0.08, 14), '#fff0f0', [0, 1.13, 0]),
    ];
    for (let i = 0; i < 6; i++) {
        const a = i * 1.9 + seed, r = 0.3 + hash3(seed, i) * 0.35;
        g.push(part(sph(0.1, 6, 5), '#ffffff', [Math.cos(a) * r, 1.15 + 0.52 * Math.sqrt(1 - (r / 0.8) ** 2) * 0.95, Math.sin(a) * r], [0, 0, 0], [1, 0.5, 1]));
    }
    return merge(g);
}

export function bushGeo(color = '#4aa840', flowers = null, seed = 1) {
    const g = [];
    for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + seed;
        g.push(part(ico(0.38 + hash3(seed, i) * 0.12, 1), shade(color, (i % 3) * 0.07), [Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3]));
    }
    if (flowers) for (let i = 0; i < 6; i++) {
        const a = i * 2.3 + seed;
        g.push(part(sph(0.08, 5, 4), flowers, [Math.cos(a) * 0.45, 0.45 + hash3(seed, i, 5) * 0.25, Math.sin(a) * 0.45]));
    }
    return merge(g);
}

export function rockGeo(color = '#9a9aa8', snow = false, seed = 1) {
    const g = [part(dodec(0.6, 0), color, [0, 0.35, 0], [seed, seed * 2, 0], [1.2, 0.8, 1])];
    g.push(part(dodec(0.35, 0), shade(color, 0.08), [0.5, 0.2, 0.2], [seed * 3, 0, seed]));
    if (snow) g.push(part(new THREE.SphereGeometry(0.62, 8, 5, 0, PI * 2, 0, PI * 0.35), '#f4f9ff', [0, 0.45, 0], [0, 0, 0], [1.15, 0.8, 1]));
    return merge(g);
}

export function crystalGeo(color = '#8ae0ff', seed = 1) {
    const g = [];
    for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + seed, t = 0.25 + i * 0.12;
        const c = new THREE.CylinderGeometry(0, 0.2 + i * 0.03, 1 + hash3(seed, i) * 0.9, 5);
        c.translate(0, 0.5, 0);
        g.push(part(c, shade(color, (i % 2) * 0.25), [Math.cos(a) * t * 0.6, 0, Math.sin(a) * t * 0.6], [Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35]));
    }
    return merge(g);
}

/** Flowers on stalks, in a small clump. */
export function flowersGeo(colors = ['#ff6a9a', '#ffd84a', '#ffffff', '#a07aff'], seed = 1) {
    const g = [];
    for (let i = 0; i < 6; i++) {
        const a = i * 2.2 + seed, r = 0.15 + hash3(seed, i) * 0.35;
        const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.25 + hash3(seed, i, 2) * 0.2;
        g.push(part(cyl(0.015, 0.015, h, 4), '#3a8a3a', [x, h / 2, z]));
        g.push(part(sph(0.07, 6, 4), colors[i % colors.length], [x, h, z], [0, 0, 0], [1, 0.6, 1]));
    }
    return merge(g);
}

export function grassGeo(color = '#6ac84a', seed = 1) {
    const g = [];
    for (let i = 0; i < 5; i++) {
        const a = i * 1.3 + seed;
        g.push(part(cone(0.05, 0.35 + hash3(seed, i) * 0.2, 3), shade(color, i * 0.05), [Math.cos(a) * 0.12, 0.17, Math.sin(a) * 0.12], [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3]));
    }
    return merge(g);
}

export function hayGeo() {
    return merge([part(cyl(0.45, 0.45, 0.7, 12), '#f0c850', [0, 0.45, 0], [PI / 2, 0, 0]), part(tor(0.45, 0.04, 4, 14), '#c89a3a', [0, 0.45, 0.2]), part(tor(0.45, 0.04, 4, 14), '#c89a3a', [0, 0.45, -0.2])]);
}

export function fenceGeo(len = 2) {
    const g = [];
    const n = Math.max(2, Math.round(len / 0.7));
    for (let i = 0; i <= n; i++) g.push(part(box(0.1, 0.6, 0.1), '#c8a070', [-len / 2 + (i / n) * len, 0.3, 0]));
    g.push(part(box(len, 0.07, 0.05), '#d8b080', [0, 0.45, 0]), part(box(len, 0.07, 0.05), '#d8b080', [0, 0.25, 0]));
    return merge(g);
}

export function sheepGeo(seed = 1) {
    const g = [];
    for (let i = 0; i < 6; i++) g.push(part(ico(0.25, 1), '#ffffff', [Math.cos(i) * 0.2, 0.5 + (i % 2) * 0.08, Math.sin(i) * 0.12]));
    g.push(part(sph(0.17, 8, 6), '#2a2a32', [0.38, 0.58, 0], [0, 0, 0], [1.2, 1, 0.9]));
    for (const x of [-0.15, 0.15]) for (const z of [-0.1, 0.1]) g.push(part(cyl(0.04, 0.04, 0.3, 5), '#2a2a32', [x, 0.15, z]));
    return merge(g);
}

export function shellGeo(color = '#ffb0c8') {
    return merge([part(new THREE.SphereGeometry(0.2, 10, 6, 0, PI * 2, 0, PI / 2), color, [0, 0, 0], [0, 0, 0], [1, 0.5, 1.2])]);
}

/** A soft cartoon cloud. */
export function cloudGeo(seed = 1) {
    const g = [];
    const n = 5 + Math.floor(hash3(seed, 9) * 3);
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        g.push(part(ico(1 + hash3(seed, i) * 0.8, 1), i % 2 ? '#ffffff' : '#f2f6ff', [t * 5, Math.sin(i * 1.7) * 0.4 + 0.6, hash3(seed, i, 2) * 1.2 - 0.6]));
    }
    g.push(part(cyl(2.6, 2.6, 0.5, 12), '#e4ecfa', [0, 0, 0], [0, 0, 0], [1, 1, 0.45]));
    return merge(g);
}

// ================================================================== buildings
// Each returns a THREE.Group, front facing +z, base at y = 0.

const mk = (geos, ol = 0.035, extra = {}) => toonMesh(geos, { outline: ol, ...extra });

/** A cosy cottage: walls, a pitched roof, door, windows, chimney. */
export function cottage(opts = {}) {
    const w = opts.w ?? 1.6, d = opts.d ?? 1.3, h = opts.h ?? 1.0;
    const wall = opts.wall ?? '#fff2d8', roof = opts.roof ?? '#e86a4a', trim = opts.trim ?? '#8a5a3a';
    const g = [
        part(box(w, h, d), wall, [0, h / 2, 0]),
        part(box(w + 0.08, 0.12, d + 0.08), trim, [0, 0.06, 0]),
    ];
    // roof: a prism from a 3-sided cylinder
    const rf = new THREE.CylinderGeometry(d * 0.72, d * 0.72, w + 0.3, 3, 1);
    rf.rotateZ(PI / 2);
    g.push(part(rf, roof, [0, h + d * 0.32, 0], [0, 0, 0], [1, 1, 1]));
    g.push(part(box(0.32, 0.55, 0.06), trim, [0, 0.3, d / 2 + 0.02]));
    g.push(part(sph(0.03, 5, 4), '#ffd84a', [0.09, 0.3, d / 2 + 0.06]));
    for (const s of [-1, 1]) {
        g.push(part(box(0.28, 0.28, 0.05), '#7ac8ff', [s * w * 0.3, h * 0.6, d / 2 + 0.02]));
        g.push(part(box(0.34, 0.05, 0.08), trim, [s * w * 0.3, h * 0.6 - 0.17, d / 2 + 0.04]));
        g.push(part(box(0.05, 0.3, 0.06), trim, [s * w * 0.3, h * 0.6, d / 2 + 0.04]));
    }
    if (opts.chimney !== false) g.push(part(box(0.22, 0.6, 0.22), '#b8a090', [w * 0.28, h + d * 0.45, -d * 0.12]));
    if (opts.flowers) for (let i = 0; i < 5; i++) g.push(part(sph(0.07, 5, 4), ['#ff6a9a', '#ffd84a', '#ffffff'][i % 3], [-w * 0.42 + i * 0.12, 0.18, d / 2 + 0.12]));
    const grp = new THREE.Group();
    grp.add(mk(g));
    return grp;
}

/** A windmill with turning sails (userData.spin). */
export function windmill() {
    const grp = new THREE.Group();
    grp.add(mk([
        part(cyl(0.6, 0.9, 2.6, 10), '#fff2dc', [0, 1.3, 0]),
        part(cone(0.85, 0.9, 10), '#c8503a', [0, 3.05, 0]),
        part(box(0.36, 0.6, 0.08), '#8a5a3a', [0, 0.3, 0.86], [-0.15, 0, 0]),
        part(box(0.28, 0.28, 0.06), '#7ac8ff', [0, 1.8, 0.66], [-0.15, 0, 0]),
        part(cyl(0.95, 0.95, 0.1, 12), '#a87a4a', [0, 0.05, 0]),
    ]));
    const hub = new THREE.Group();
    hub.position.set(0, 2.5, 0.75);
    const sails = [part(cyl(0.12, 0.12, 0.2, 8), '#6a4a30', [0, 0, 0], [PI / 2, 0, 0])];
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2;
        sails.push(part(box(0.08, 1.6, 0.04), '#8a5a3a', [Math.sin(a) * 0.8, Math.cos(a) * 0.8, 0.08], [0, 0, -a]));
        sails.push(part(box(0.42, 1.25, 0.02), i % 2 ? '#fff8e8' : '#ffe8c8', [Math.sin(a) * 0.9 + Math.cos(a) * 0.22, Math.cos(a) * 0.9 - Math.sin(a) * 0.22, 0.1], [0, 0, -a]));
    }
    hub.add(mk(sails, 0.02));
    grp.add(hub);
    grp.userData.spin = [{ obj: hub, axis: 'z', speed: 0.8 }];
    return grp;
}

/** A lighthouse with a turning beam. */
export function lighthouse() {
    const grp = new THREE.Group();
    const g = [part(cyl(1.1, 1.2, 0.5, 12), '#a8a0a0', [0, 0.25, 0])];
    for (let i = 0; i < 5; i++) g.push(part(cyl(0.72 - i * 0.07, 0.8 - i * 0.07, 0.9, 14), i % 2 ? '#ffffff' : '#e83a3a', [0, 0.95 + i * 0.9, 0]));
    g.push(part(cyl(0.75, 0.75, 0.12, 14), '#3a3a4a', [0, 5.0, 0]));
    g.push(part(cyl(0.45, 0.45, 0.7, 10), '#bfe8ff', [0, 5.42, 0]));
    g.push(part(cone(0.6, 0.6, 12), '#e83a3a', [0, 6.07, 0]));
    g.push(part(box(0.3, 0.5, 0.06), '#5a3a2a', [0, 0.75, 0.79]));
    grp.add(mk(g));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glowMat('#fff2a0', 2.2));
    lamp.position.y = 5.42;
    grp.add(lamp);
    const beamPivot = new THREE.Group();
    beamPivot.position.y = 5.42;
    const bg = new THREE.ConeGeometry(1.4, 9, 16, 1, true);
    bg.translate(0, -4.5, 0);
    bg.rotateZ(PI / 2);
    const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beamPivot.add(beam);
    grp.add(beamPivot);
    grp.userData.spin = [{ obj: beamPivot, axis: 'y', speed: 0.9 }];
    return grp;
}

/** A wooden pier with a moored sailboat. */
export function docks() {
    const grp = new THREE.Group();
    const g = [];
    for (let i = 0; i < 6; i++) g.push(part(box(1.4, 0.1, 0.4), i % 2 ? '#b8885a' : '#a87a4a', [0, 0.5, i * 0.42]));
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) g.push(part(cyl(0.07, 0.07, 1.4, 6), '#7a5a3a', [s * 0.62, 0, i * 0.8]));
    g.push(part(box(0.5, 0.4, 0.5), '#c8a070', [0.3, 0.75, 0.2]), part(cyl(0.2, 0.2, 0.45, 8), '#9a6a3a', [-0.3, 0.78, 0.6]));
    grp.add(mk(g));
    const boat = new THREE.Group();
    boat.position.set(1.4, 0.05, 1.4);
    boat.add(mk([
        part(lathe([[0.001, 0], [0.5, 0.05], [0.6, 0.35], [0.001, 0.36]], 10), '#e8f0ff', [0, 0, 0], [0, 0, 0], [1, 1, 2.2]),
        part(box(1.0, 0.08, 2.2), '#3a6ad8', [0, 0.36, 0]),
        part(cyl(0.04, 0.05, 2.0, 6), '#8a5a3a', [0, 1.35, 0]),
    ], 0.025));
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 3, 1), toonMat({ color: '#ffffff' }));
    sail.scale.set(1, 1, 0.05);
    sail.position.set(0, 1.4, 0.3);
    sail.rotation.y = PI / 2;
    boat.add(sail);
    grp.add(boat);
    grp.userData.bob = [boat];
    return grp;
}

/** A crystal mine: a timber-framed tunnel mouth in a rocky mound, a cart and glowing crystals. */
export function mine() {
    const grp = new THREE.Group();
    grp.add(mk([
        part(dodec(1.6, 1), '#8a8090', [0, 0.6, -0.4], [0, 0, 0], [1.2, 0.8, 1]),
        part(box(1.1, 1.0, 0.3), '#2a2230', [0, 0.5, 0.75]),
        part(box(0.14, 1.2, 0.18), '#8a5a34', [-0.6, 0.6, 0.85]),
        part(box(0.14, 1.2, 0.18), '#8a5a34', [0.6, 0.6, 0.85]),
        part(box(1.4, 0.16, 0.2), '#8a5a34', [0, 1.2, 0.85]),
        part(box(0.7, 0.35, 0.45), '#7a5a3a', [1.2, 0.3, 1.2]),
        ...[-1, 1].flatMap((s) => [-1, 1].map((z) => part(cyl(0.12, 0.12, 0.06, 8), '#3a3a40', [1.2 + s * 0.3, 0.1, 1.2 + z * 0.2], [0, 0, PI / 2]))),
    ]));
    const cr = new THREE.Mesh(crystalGeo('#7ae0ff', 3), toonMat({ vertexColors: true, emissive: '#2a7aa8', emissiveIntensity: 0.6 }));
    cr.position.set(-1.1, 0.3, 0.6);
    cr.scale.setScalar(0.8);
    grp.add(cr);
    const cr2 = new THREE.Mesh(crystalGeo('#d08aff', 5), toonMat({ vertexColors: true, emissive: '#6a2aa8', emissiveIntensity: 0.6 }));
    cr2.position.set(1.2, 0.6, 1.2);
    cr2.scale.setScalar(0.4);
    grp.add(cr2);
    return grp;
}

/** A log lodge by a steaming hot spring. */
export function lodge() {
    const grp = cottage({ w: 1.8, d: 1.4, h: 1.0, wall: '#b8784a', roof: '#f4f9ff', trim: '#6a4a30' });
    const pool = new THREE.Group();
    pool.position.set(1.6, 0, 1.0);
    pool.add(mk([part(tor(0.7, 0.18, 6, 14), '#a8a0a8', [0, 0.1, 0], [PI / 2, 0, 0])], 0.02));
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), toonMat({ color: '#7ae0e8', emissive: '#1a6a7a', emissiveIntensity: 0.5 }));
    water.rotation.x = -PI / 2;
    water.position.y = 0.16;
    pool.add(water);
    grp.add(pool);
    grp.userData.steam = [new THREE.Vector3(1.6, 0.3, 1.0)];
    return grp;
}

/** A mushroom cottage for Glowcap Grove. */
export function mushroomHouse() {
    const grp = new THREE.Group();
    grp.add(mk([
        part(cyl(0.7, 0.85, 1.3, 12), '#fff0d8', [0, 0.65, 0]),
        part(new THREE.SphereGeometry(1.3, 16, 10, 0, PI * 2, 0, PI * 0.5), '#e83a5a', [0, 1.25, 0], [0, 0, 0], [1, 0.75, 1]),
        part(cyl(1.28, 0.8, 0.1, 16), '#ffe8e8', [0, 1.22, 0]),
        part(box(0.38, 0.6, 0.06), '#8a5a3a', [0, 0.32, 0.8]),
        part(box(0.26, 0.26, 0.05), '#ffd27a', [0.4, 0.9, 0.66], [0, 0.45, 0]),
        ...[0, 1, 2, 3, 4, 5, 6].map((i) => part(sph(0.13, 6, 5), '#ffffff', [Math.cos(i * 0.9) * 0.75, 1.62 + (i % 2) * 0.08, Math.sin(i * 0.9) * 0.75], [0, 0, 0], [1, 0.45, 1])),
    ]));
    return grp;
}

/** A treehouse: a huge trunk with a round hut and a ladder. */
export function treehouse() {
    const grp = new THREE.Group();
    grp.add(mk([
        part(cyl(0.35, 0.6, 3.4, 9), '#7a5434', [0, 1.7, 0]),
        part(ico(1.7, 1), '#3fa456', [0, 4.1, 0], [0, 0, 0], [1, 0.75, 1]),
        part(ico(1.0, 1), '#56c06a', [1.0, 4.4, 0.3]),
        part(ico(1.0, 1), '#2f8a4a', [-1.0, 4.3, -0.2]),
        part(cyl(1.2, 1.2, 0.12, 14), '#b8885a', [0, 2.6, 0]),
        part(cyl(0.75, 0.75, 0.8, 12), '#f4e0b0', [0, 3.05, 0.4]),
        part(cone(0.95, 0.7, 12), '#c86a3a', [0, 3.8, 0.4]),
        part(box(0.26, 0.42, 0.05), '#6a4a30', [0, 2.9, 1.14]),
        part(box(0.05, 2.6, 0.05), '#8a6a40', [-0.25, 1.3, 1.25], [0.12, 0, 0]),
        part(box(0.05, 2.6, 0.05), '#8a6a40', [0.25, 1.3, 1.25], [0.12, 0, 0]),
        ...[0, 1, 2, 3, 4, 5].map((i) => part(box(0.5, 0.04, 0.05), '#8a6a40', [0, 0.25 + i * 0.42, 1.25 - i * 0.05])),
    ]));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowMat('#ffd27a', 2.0));
    lamp.position.set(0.85, 2.85, 0.9);
    grp.add(lamp);
    return grp;
}

/** An orchard plot: a fence with apple trees and a basket. */
export function orchard() {
    const grp = new THREE.Group();
    const trees = [];
    for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(appleTreeGeo(i + 3), toonMat({ vertexColors: true }));
        t.position.set((i % 2 ? 0.9 : -0.9), 0, (i < 2 ? -0.7 : 0.7));
        t.scale.setScalar(0.7);
        t.castShadow = true;
        trees.push(t);
        grp.add(t);
    }
    grp.add(mk([
        part(cyl(0.2, 0.16, 0.25, 10), '#c8904a', [0, 0.13, 1.4]),
        ...[0, 1, 2, 3].map((i) => part(sph(0.08, 6, 5), '#ff3a3a', [Math.cos(i * 1.6) * 0.08, 0.27, 1.4 + Math.sin(i * 1.6) * 0.08])),
    ], 0.02));
    return grp;
}

// ------------------------------------------------------------------ the four towns

export function town(id) {
    const grp = new THREE.Group();
    const place = (o, x, z, ry = 0, s = 1) => { o.position.set(x, 0, z); o.rotation.y = ry; o.scale.setScalar(s); grp.add(o); return o; };
    if (id === 'brookhollow') {
        place(cottage({ roof: '#e86a4a', flowers: true }), -1.3, 0.2, 0.2);
        place(cottage({ roof: '#4a8ae8', wall: '#ffe8c8', w: 1.4 }), 1.3, -0.3, -0.25);
        place(cottage({ roof: '#e8b03a', w: 1.2, d: 1.1, h: 0.9 }), 0.1, -1.6, 0);
        grp.add(mk([
            part(cyl(0.38, 0.42, 0.45, 12), '#b8b0a8', [0, 0.22, 1.2]),
            part(cyl(0.3, 0.3, 0.05, 12), '#5ab0f0', [0, 0.44, 1.2]),
            part(box(0.06, 0.8, 0.06), '#7a5a3a', [-0.32, 0.6, 1.2]), part(box(0.06, 0.8, 0.06), '#7a5a3a', [0.32, 0.6, 1.2]),
            part(cone(0.5, 0.35, 4), '#c8503a', [0, 1.15, 1.2], [0, PI / 4, 0]),
        ], 0.025));
    } else if (id === 'fernwick') {
        place(treehouse(), -1.0, -0.6, 0.3, 0.75);
        place(treehouse(), 1.4, -0.2, -0.4, 0.6);
        place(mushroomHouse(), 0.2, 1.0, 0, 0.55);
        grp.add(mk([part(box(2.4, 0.06, 0.4), '#b8885a', [0.2, 2.05, -0.4], [0, -0.17, 0])], 0.015));
    } else if (id === 'saltbreeze') {
        place(cottage({ roof: '#3a8ad8', wall: '#ffffff', trim: '#3a5a8a', w: 1.4 }), -1.2, -0.4, 0.15);
        place(cottage({ roof: '#e8a03a', wall: '#fff2e0', trim: '#8a5a3a', w: 1.2, h: 1.4 }), 0.6, -1.2, -0.1);
        place(cottage({ roof: '#3ac0a8', wall: '#ffe8f0', w: 1.1, d: 1.0 }), 1.5, 0.5, -0.4, 0.9);
        grp.add(mk([
            part(cyl(0.05, 0.05, 2.2, 6), '#8a5a3a', [-0.2, 1.1, 1.0]),
            part(box(0.9, 0.5, 0.03), '#ffffff', [0.25, 1.75, 1.0]),
            part(cyl(0.3, 0.3, 0.5, 10), '#9a6a3a', [-0.9, 0.25, 1.2], [PI / 2, 0, 0.3]),
        ], 0.02));
    } else if (id === 'hammerhold') {
        // a dwarven hall: a carved stone gate in a snowy cliff with two glowing braziers
        grp.add(mk([
            part(dodec(2.2, 1), '#8a8aa0', [0, 1.1, -1.0], [0, 0.4, 0], [1.3, 1.0, 0.9]),
            part(new THREE.SphereGeometry(2.25, 12, 6, 0, PI * 2, 0, PI * 0.3), '#f4f9ff', [0, 1.6, -1.0], [0, 0.4, 0], [1.3, 0.9, 0.9]),
            part(box(1.8, 2.0, 0.5), '#6a6a80', [0, 1.0, 0.6]),
            part(box(1.0, 1.4, 0.2), '#2a2030', [0, 0.7, 0.86]),
            part(box(2.2, 0.3, 0.6), '#9a9ab0', [0, 2.1, 0.6]),
            part(cone(0.35, 0.4, 4), '#9a9ab0', [0, 2.45, 0.6], [0, PI / 4, 0]),
            ...[-1, 1].flatMap((s) => [part(cyl(0.18, 0.24, 0.9, 8), '#5a5a6a', [s * 1.2, 0.45, 1.2]), part(cyl(0.3, 0.2, 0.2, 8), '#3a3a48', [s * 1.2, 1.0, 1.2])]),
            part(box(0.5, 0.5, 0.06), '#d8a03a', [0, 1.6, 0.88]),
        ]));
        for (const s of [-1, 1]) {
            const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), glowMat('#ff8a2a', 2.2));
            f.position.set(s * 1.2, 1.3, 1.2);
            grp.add(f);
            (grp.userData.flames ||= []).push(f);
        }
    }
    return grp;
}

// ------------------------------------------------------------------ dungeon entrances

export function dungeon(id) {
    const grp = new THREE.Group();
    if (id === 'warren') {
        // a grassy mound with a round goblin door and a skull totem
        grp.add(mk([
            part(new THREE.SphereGeometry(1.9, 16, 10, 0, PI * 2, 0, PI * 0.5), '#6ac04a', [0, 0, -0.4], [0, 0, 0], [1, 0.75, 1]),
            part(cyl(0.7, 0.7, 0.3, 16), '#5a3a24', [0, 0.7, 1.2], [PI / 2 - 0.25, 0, 0]),
            part(cyl(0.55, 0.55, 0.32, 16), '#1a1214', [0, 0.7, 1.24], [PI / 2 - 0.25, 0, 0]),
            part(cyl(0.06, 0.06, 1.8, 6), '#7a5a3a', [1.1, 0.9, 1.1]),
            part(sph(0.22, 10, 8), '#f4f0e0', [1.1, 1.9, 1.1]),
            part(cone(0.08, 0.3, 6), '#f4f0e0', [1.25, 2.1, 1.1], [0, 0, -0.6]),
            part(cone(0.08, 0.3, 6), '#f4f0e0', [0.95, 2.1, 1.1], [0, 0, 0.6]),
            part(box(0.7, 0.4, 0.06), '#c8a070', [-1.1, 0.8, 1.0], [0, 0.4, 0.1]),
            part(cyl(0.05, 0.05, 0.8, 5), '#7a5a3a', [-1.1, 0.4, 0.95]),
        ]));
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), glowMat('#ff9a3a', 1.2, { transparent: true, opacity: 0.6 }));
        glow.position.set(0, 0.7, 1.42);
        glow.rotation.x = -0.25;
        grp.add(glow);
    } else if (id === 'crypt') {
        // a hollow ancient oak swallowing a stone archway
        grp.add(mk([
            part(cyl(1.0, 1.6, 2.8, 10), '#5a3a2a', [0, 1.4, -0.3]),
            part(ico(2.2, 1), '#2f6a4a', [0, 3.6, -0.3], [0, 0, 0], [1, 0.7, 1]),
            part(ico(1.2, 1), '#3f8a5a', [1.4, 3.3, 0]),
            part(ico(1.2, 1), '#2a5a3a', [-1.3, 3.5, -0.4]),
            part(box(1.0, 1.4, 0.4), '#8a8a98', [0, 0.7, 1.1]),
            part(box(0.7, 1.1, 0.42), '#140e18', [0, 0.55, 1.12]),
            part(tor(0.5, 0.12, 6, 12, PI), '#9a9aa8', [0, 1.3, 1.25]),
            ...[0, 1, 2, 3].map((i) => part(caps(0.12, 1.2, 6), '#4a2e22', [Math.cos(i * 1.6) * 1.4, 0.15, Math.sin(i * 1.6) * 1.4 - 0.3], [PI / 2, 0, i * 1.6])),
        ]));
        const eyes = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), glowMat('#7aff9a', 1.5, { transparent: true, opacity: 0.55 }));
        eyes.position.set(0, 0.6, 1.34);
        grp.add(eyes);
    } else if (id === 'grotto') {
        // a sea cave: a rock arch over glowing water, with a chest peeking out
        grp.add(mk([
            part(dodec(1.4, 1), '#7a7a90', [-1.2, 1.0, 0], [0.3, 0, 0], [0.8, 1.4, 1]),
            part(dodec(1.4, 1), '#6a6a80', [1.2, 1.0, 0], [0, 0.5, 0], [0.8, 1.4, 1]),
            part(tor(1.2, 0.5, 8, 14, PI), '#7a7a90', [0, 1.6, 0], [0, 0, 0]),
            part(box(0.5, 0.35, 0.35), '#a8743a', [0.2, 0.25, -0.3]),
            part(box(0.52, 0.08, 0.37), '#ffd25a', [0.2, 0.36, -0.3]),
            part(cone(0.25, 0.6, 6), '#ff8ab0', [-1.6, 0.3, 1.1], [0.3, 0, 0.2]),
            part(cone(0.18, 0.5, 6), '#ffb07a', [-1.3, 0.25, 1.3], [-0.2, 0, -0.3]),
        ]));
        const pool = new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), glowMat('#3ae0f0', 1.1, { transparent: true, opacity: 0.7 }));
        pool.rotation.x = -PI / 2;
        pool.position.set(0, 0.06, 0.2);
        grp.add(pool);
    } else if (id === 'caverns') {
        // an ice cave mouth with icicles
        grp.add(mk([
            part(dodec(2.0, 1), '#bfe0ff', [0, 1.0, -0.5], [0, 0.3, 0], [1.3, 1.0, 1]),
            part(new THREE.SphereGeometry(2.05, 12, 6, 0, PI * 2, 0, PI * 0.3), '#ffffff', [0, 1.4, -0.5], [0, 0.3, 0], [1.3, 0.9, 1]),
            part(new THREE.SphereGeometry(0.9, 14, 10, 0, PI * 2, 0, PI * 0.5), '#1a2a4a', [0, 0, 1.05], [PI / 2 - 0.2, 0, 0], [1, 1, 0.3]),
            ...[0, 1, 2, 3, 4].map((i) => part(cone(0.1, 0.5, 5), '#e0f4ff', [-0.6 + i * 0.3, 1.0 - (i % 2) * 0.1, 1.15], [PI, 0, 0])),
        ]));
        const cr = new THREE.Mesh(crystalGeo('#8ae8ff', 7), toonMat({ vertexColors: true, emissive: '#2a8ac8', emissiveIntensity: 0.7 }));
        cr.position.set(1.4, 0, 1.0);
        cr.scale.setScalar(0.9);
        grp.add(cr);
    }
    return grp;
}

// ------------------------------------------------------------------ the corners

export function hearthstone() {
    const grp = new THREE.Group();
    // a village green: a hearth-stone monument with a fire bowl, bunting and two houses
    grp.add(mk([
        part(cyl(1.2, 1.4, 0.3, 12), '#c8b8a0', [0, 0.15, 0]),
        part(cyl(0.45, 0.6, 1.3, 8), '#e8dcc0', [0, 0.95, 0]),
        part(cyl(0.7, 0.5, 0.3, 12), '#8a6a4a', [0, 1.7, 0]),
        part(tor(0.7, 0.06, 6, 16), '#ffd25a', [0, 1.85, 0], [PI / 2, 0, 0]),
    ]));
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10), glowMat('#ff8a2a', 2.0));
    fire.position.y = 2.25;
    grp.add(fire);
    const fire2 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8), glowMat('#ffe07a', 2.4));
    fire2.position.y = 2.1;
    grp.add(fire2);
    grp.userData.flames = [fire, fire2];
    const h1 = cottage({ roof: '#e86a4a', flowers: true }); h1.position.set(-2.2, 0, -1.6); h1.rotation.y = 0.6; h1.scale.setScalar(0.85); grp.add(h1);
    const h2 = cottage({ roof: '#7a5ad8', wall: '#fff8e8' }); h2.position.set(1.8, 0, -2.2); h2.rotation.y = -0.4; h2.scale.setScalar(0.8); grp.add(h2);
    // bunting from the hearth to the houses
    const flags = [];
    for (const [tx, tz] of [[-2.2, -1.6], [1.8, -2.2]]) {
        for (let i = 1; i < 8; i++) {
            const t = i / 8;
            const x = tx * t, z = tz * t, y = 2.0 - Math.sin(t * PI) * 0.4 + t * 0.2;
            const f = new THREE.ConeGeometry(0.1, 0.22, 3);
            f.rotateX(PI);
            flags.push(part(f, ['#ff5a5a', '#ffd84a', '#5ab0ff', '#7ae06a'][i % 4], [x, y - 0.1, z], [0, Math.atan2(tx, tz), 0], [1, 1, 0.3]));
        }
    }
    grp.add(mk(flags, 0.012));
    return grp;
}

export function shrine() {
    const grp = new THREE.Group();
    grp.add(mk([
        part(cyl(1.4, 1.6, 0.25, 14), '#c8c0b0', [0, 0.12, 0]),
        ...[-1, 1].map((s) => part(cyl(0.12, 0.15, 2.4, 8), '#e8402a', [s * 1.0, 1.3, -0.6])),
        part(box(2.8, 0.18, 0.28), '#e8402a', [0, 2.55, -0.6]),
        part(box(3.2, 0.14, 0.34), '#2a1a1a', [0, 2.72, -0.6], [0, 0, 0]),
        part(box(2.2, 0.12, 0.2), '#e8402a', [0, 2.15, -0.6]),
        ...[-1, 1].flatMap((s) => [
            part(cyl(0.12, 0.18, 0.7, 6), '#a8a098', [s * 1.1, 0.5, 0.8]),
            part(box(0.38, 0.32, 0.38), '#b8b0a8', [s * 1.1, 1.0, 0.8]),
            part(cone(0.32, 0.3, 4), '#8a8278', [s * 1.1, 1.32, 0.8], [0, PI / 4, 0]),
        ]),
        part(sph(0.45, 14, 10), '#9ad0ff', [0, 0.9, -0.6]),
    ]));
    for (const s of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.24), glowMat('#ffd27a', 2.0));
        l.position.set(s * 1.1, 1.0, 0.8);
        grp.add(l);
    }
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), glowMat('#bfe8ff', 1.6));
    orb.position.set(0, 0.9, -0.6);
    grp.add(orb);
    grp.userData.bob = [orb];
    return grp;
}

export function fountain() {
    const grp = new THREE.Group();
    grp.add(mk([
        part(cyl(1.5, 1.6, 0.4, 18), '#e8e0d0', [0, 0.2, 0]),
        part(tor(1.5, 0.15, 6, 24), '#d8c8a8', [0, 0.4, 0], [PI / 2, 0, 0]),
        part(cyl(0.2, 0.3, 1.2, 10), '#e8e0d0', [0, 0.9, 0]),
        part(cyl(0.8, 0.3, 0.25, 14), '#ffd25a', [0, 1.5, 0]),
        part(cyl(0.12, 0.15, 0.6, 8), '#ffd25a', [0, 1.85, 0]),
        part(sph(0.22, 12, 10), '#ffe07a', [0, 2.25, 0]),
        // coins on the basin floor and water well clear of it (they were a hair apart and flickered)
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => part(cyl(0.1, 0.1, 0.05, 8), '#ffd84a', [Math.cos(i * 0.7) * (0.5 + (i % 3) * 0.25), 0.43, Math.sin(i * 0.7) * (0.5 + (i % 3) * 0.25)])),
    ]));
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.42, 24), toonMat({ color: '#5ad0f0', emissive: '#1a6a8a', emissiveIntensity: 0.4, transparent: true, opacity: 0.7 }));
    water.rotation.x = -PI / 2;
    water.position.y = 0.5;
    grp.add(water);
    grp.userData.fountain = new THREE.Vector3(0, 2.3, 0);
    return grp;
}

export function portal() {
    const grp = new THREE.Group();
    const stones = [part(cyl(1.6, 1.7, 0.2, 16), '#7a7090', [0, 0.1, 0])];
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2;
        stones.push(part(box(0.35, 1.4 + (i % 2) * 0.4, 0.3), '#8a80a0', [Math.cos(a) * 1.4, 0.8, Math.sin(a) * 1.4], [0, -a, 0]));
        stones.push(part(box(0.2, 0.2, 0.05), '#b07aff', [Math.cos(a) * 1.25, 1.1, Math.sin(a) * 1.25], [0, -a + PI / 2, 0]));
    }
    grp.add(mk(stones));
    const ring = new THREE.Group();
    ring.position.y = 1.4;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ color: '#c08aff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.add(disc);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 8, 32), glowMat('#e0b0ff', 1.8));
    ring.add(halo);
    for (let i = 0; i < 3; i++) {
        const arm = new THREE.Mesh(new THREE.TorusGeometry(0.5 - i * 0.12, 0.035, 6, 24, PI * 1.2), glowMat('#ffffff', 1.4, { transparent: true, opacity: 0.8 }));
        arm.rotation.z = i * 2.1;
        ring.add(arm);
    }
    grp.add(ring);
    grp.userData.spin = [{ obj: ring, axis: 'z', speed: 1.4 }];
    grp.userData.face = ring;
    return grp;
}

/** A banner on a pole in an owner's colour (deeds show who owns them). */
export function banner(color = '#ffd25a') {
    const grp = new THREE.Group();
    grp.add(mk([part(cyl(0.04, 0.05, 1.6, 6), '#7a5a3a', [0, 0.8, 0]), part(sph(0.07, 6, 5), '#ffd25a', [0, 1.62, 0])], 0.015));
    const flagGeo = new THREE.PlaneGeometry(0.6, 0.4, 6, 2);
    flagGeo.translate(0.3, 0, 0);
    const flag = new THREE.Mesh(flagGeo, toonMat({ color, side: THREE.DoubleSide }));
    flag.position.y = 1.35;
    flag.castShadow = true;
    grp.add(flag);
    grp.userData.flag = flag;
    grp.userData.flagBase = flagGeo.attributes.position.array.slice();
    return grp;
}

/** Little stars round a deed showing its level (1–3). */
export function levelStars(n) {
    const g = [];
    for (let i = 0; i < n; i++) {
        const s = new THREE.OctahedronGeometry(0.16, 0);
        s.scale(1, 1, 0.45);
        g.push(part(s, '#ffd84a', [(i - (n - 1) / 2) * 0.38, 0, 0]));
    }
    return g.length ? toonMesh(g, { outline: 0.015, emissive: '#6a4a00', emissiveIntensity: 0.6 }) : new THREE.Group();
}

export { paintGrad };
