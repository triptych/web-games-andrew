// What each thing looks like. Every `look` has a small code-built shape; the important ones are replaced by a
// Meshy model (assets/models/<name>.glb, see dev/assets/README.md) once it has loaded. ?models=0 keeps the shapes.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rune } from './tex.js';
import { MODEL_FILES } from '../model-files.js';

const mats = {};
const mat = (color, opt = {}) => {
    const k = color + JSON.stringify(opt);
    return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opt }));
};
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const box = (w, h, d, c, x = 0, y = h / 2, z = 0, o) => mesh(new THREE.BoxGeometry(w, h, d), mat(c, o), x, y, z);
const cyl = (r0, r1, h, c, x = 0, y = h / 2, z = 0, o, seg = 10) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat(c, o), x, y, z);
const ball = (r, c, x = 0, y = r, z = 0, o) => mesh(new THREE.IcosahedronGeometry(r, 1), mat(c, o), x, y, z);
const cone = (r, h, c, x = 0, y = h / 2, z = 0, o) => mesh(new THREE.ConeGeometry(r, h, 8), mat(c, o), x, y, z);
const group = (...kids) => { const g = new THREE.Group(); for (const k of kids) g.add(k); return g; };
const glowMat = (c, i = 1.4) => ({ emissive: c, emissiveIntensity: i, roughness: 0.4 });

const STONE = 0x8d8f8a, MOSS = 0x5d7a45, WOOD = 0x7a5a3a, DARK = 0x2a2622, GOLD = 0xd9b45a, MARBLE = 0xdfe6ea;

function standingStone(h = 2.2, tint = '#7fffe0') {
    const g = group(cyl(0.32, 0.5, h, STONE, 0, h / 2, 0, undefined, 6), ball(0.55, MOSS, 0, -0.25, 0));
    const r = mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: rune(tint), transparent: true, depthWrite: false }), 0, h * 0.62, 0.44);
    g.add(r);
    return g;
}
function goblin(skin = 0x7c9a5a, cloak = 0xa5552d, h = 1) {
    const g = group(cone(0.3 * h, 0.75 * h, cloak, 0, 0.375 * h), ball(0.2 * h, skin, 0, 0.72 * h));
    for (const s of [-1, 1]) { const e = cone(0.07 * h, 0.3 * h, skin, s * 0.27 * h, 0.94 * h); e.rotation.z = -s * 1.2; g.add(e); }
    g.add(box(0.36 * h, 0.06 * h, 0.1 * h, 0xe8e0cc, 0, 0.93 * h, 0.17 * h));        // the cloth over her eyes
    return g;
}
function golem(h = 4.2) {
    const g = group(ball(h * 0.3, STONE, 0, h * 0.42), ball(h * 0.17, STONE, 0, h * 0.82), ball(h * 0.2, MOSS, 0, h * 0.95));
    for (const s of [-1, 1]) {
        g.add(cyl(h * 0.09, h * 0.12, h * 0.55, STONE, s * h * 0.4, h * 0.4), cyl(h * 0.11, h * 0.13, h * 0.25, STONE, s * h * 0.16, h * 0.02));
        g.add(ball(h * 0.025, 0xffc46b, s * h * 0.06, h * 0.82, h * 0.15, glowMat(0xffb040, 2)));
    }
    return g;
}

/** Build the code-made shape for a look. Returns a Group standing on y = 0, facing +z. */
const SHAPES = {
    stone: () => standingStone(),
    pillar: () => group(cyl(0.9, 1.2, 4.4, STONE, 0, 2.2, 0, undefined, 7), ball(1.1, MOSS, 0, 4.2)),
    rootdoor: () => group(cyl(1.2, 1.5, 4.6, 0x77796f, 0, 2.3, 0, undefined, 7), mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: rune('#9dff8a'), transparent: true, depthWrite: false }), -1.36, 2.2, 0)),
    cairn: () => group(...[0.7, 0.58, 0.47, 0.38, 0.3, 0.22, 0.15].map((r, i) => cyl(r, r * 1.08, 0.22, i % 2 ? 0x9c9a92 : 0x86857e, 0, 0.11 + i * 0.22, 0, undefined, 9))),
    boat: () => { const hull = mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(WOOD, { side: THREE.DoubleSide }), 0, 0.75, 0); hull.scale.set(0.9, 0.75, 2.3); return group(hull, cyl(0.05, 0.05, 2.6, WOOD, 0.9, 0.5, 0.4)); },
    ruin: () => group(box(3.6, 0.5, 0.8, STONE, 0, 2.3, 0), box(0.8, 2.3, 0.8, STONE, -1.4), box(0.8, 1.5, 0.8, STONE, 1.4), box(2.2, 0.6, 0.9, 0x9a9c96, 1.2, 0.3, 1.3), ball(0.5, MOSS, -1.4, 2.5)),
    burrow: () => { const ring = mesh(new THREE.TorusGeometry(0.55, 0.2, 6, 12), mat(0x6a5a44), 0, 0.5, 0); return group(ring, mesh(new THREE.CircleGeometry(0.52, 12), new THREE.MeshBasicMaterial({ color: 0x080604 }), 0, 0.5, -0.02), ball(0.5, MOSS, 0.7, -0.2), ball(0.4, MOSS, -0.7, -0.15)); },
    pipe: () => { const p = cyl(0.55, 0.55, 1.4, 0x6f8f86, 0, 0.6, -0.5, { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.6 }, 12); p.rotation.x = Math.PI / 2; return group(p, mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0x06090a }), 0, 0.6, 0.15)); },
    darkway: () => group(box(1.8, 1.7, 0.3, 0x05040a, 0, 0.85, 0, { emissive: 0x150a2a, emissiveIntensity: 0.6 }), box(2.4, 0.4, 0.5, 0x4a3a2c, 0, 1.9, 0), box(0.35, 1.9, 0.5, 0x4a3a2c, -1.05), box(0.35, 1.9, 0.5, 0x4a3a2c, 1.05)),
    well: () => group(cyl(1.2, 1.2, 0.9, STONE, 0, 0.45, 0, undefined, 12), cyl(1.0, 1.0, 0.05, 0x10202a, 0, 0.8, 0, { roughness: 0.1 }, 12), box(0.15, 2.2, 0.15, WOOD, -1.1), box(0.15, 2.2, 0.15, WOOD, 1.1), box(2.6, 0.15, 0.5, WOOD, 0, 2.2)),
    pedestal: () => group(cyl(0.6, 0.75, 0.25, STONE, 0, 0.125), cyl(0.38, 0.45, 0.8, STONE, 0, 0.65), cyl(0.62, 0.45, 0.2, STONE, 0, 1.15)),
    vine: () => { const g = group(); for (let i = 0; i < 5; i++) g.add(cyl(0.09, 0.12, 16, 0x6b5a3a, (i - 2) * 0.5, 8, -0.4 - i * 0.1, undefined, 5)); g.userData.vine = true; return g; },
    vinetop: () => group(cyl(0.2, 0.25, 1.2, WOOD, -0.8, 0.6), cyl(0.2, 0.25, 1.2, WOOD, 0.8, 0.6), ball(0.5, 0x4e8a3e, 0, 0.3)),
    golem: () => golem(4.2),
    golemfallen: () => { const g = golem(3.6); g.rotation.z = Math.PI / 2; g.position.y = 1.1; return group(g, ball(0.9, 0x7fa860, 1.6, -0.3)); },
    golemsmall: () => golem(1.3),
    cavemouth: () => group(box(1.4, 5, 2, 0x6c6e6a, -3.1, 2.5), box(1.4, 5, 2, 0x6c6e6a, 3.1, 2.5), box(7.6, 1.6, 2.2, 0x62645f, 0, 5.2), mesh(new THREE.PlaneGeometry(4.8, 4.6), new THREE.MeshBasicMaterial({ color: 0x05070c }), 0, 2.3, -0.6)),
    boulder: () => ball(2.9, 0x7b7d78, 0, 1.9),
    tower: () => group(cyl(3.0, 3.4, 11, 0xcdb98a, 0, 5.5, 0, undefined, 12), cyl(3.3, 3.0, 0.7, 0xbfa977, 0, 11.2, 0, undefined, 12), ball(1.4, 0x4f8040, 1.5, 11.6)),
    wall: () => group(box(2.7, 3.2, 1.6, 0xcdb98a, 0, 1.6), box(1.2, 0.8, 1.6, 0xbfa977, -0.6, 3.6)),
    throne: () => group(box(1.5, 0.6, 1.2, 0xcdb98a, 0, 0.3), box(1.5, 2.4, 0.3, 0xcdb98a, 0, 1.2, -0.5), ball(0.9, 0x5a8c46, 0.4, 2.6, -0.4), ball(0.12, 0xd8c94a, 0.2, 2.1, 0.2), ball(0.12, 0xd8c94a, 0.8, 2.5, 0.2)),
    stair: () => group(box(3.4, 0.5, 3.4, 0xbfa977, 0, 0.25), mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ color: 0x04040a }), 0, 0.52, 0).rotateX(-Math.PI / 2), box(0.4, 1.6, 0.4, 0xcdb98a, -1.5, 0.8, -1.5), box(0.4, 1.6, 0.4, 0xcdb98a, 1.5, 0.8, -1.5)),
    perch: () => group(cyl(2.4, 2.8, 0.5, MARBLE, 0, 0.25, 0, undefined, 16), mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: rune('#bfe9ff'), transparent: true, depthWrite: false }), 0, 0.52, 0).rotateX(-Math.PI / 2)),
    arch: () => group(box(0.8, 3.6, 0.8, MARBLE, -1.5, 1.8), box(0.8, 3.6, 0.8, MARBLE, 1.5, 1.8), box(4.2, 0.7, 0.9, MARBLE, 0, 3.9)),
    hut: () => group(box(3.6, 2.2, 0.4, 0x9a8a72, 0, 1.1, -1.5), cyl(0.7, 0.8, 0.8, STONE, -1, 0.4, 0.2), box(0.1, 1.8, 0.1, WOOD, 1.2, 0.9, 0.6), box(0.1, 1.8, 0.1, WOOD, 2.6, 0.9, 0.6), box(1.6, 1.2, 0.03, 0xb9c4b0, 1.9, 1.1, 0.6, { transparent: true, opacity: 0.6 })),
    tidestair: () => group(...[0, 1, 2, 3, 4, 5].map((i) => box(3.6, 0.3, 1.1, MARBLE, 0, 0.3 - i * 0.28, -i * 1.1)), box(0.5, 2.2, 0.5, MARBLE, -2.1, 1.1, 0.6), box(0.5, 2.2, 0.5, MARBLE, 2.1, 1.1, 0.6)),
    moondoor: () => group(cyl(1.25, 1.25, 0.35, 0x8a8f9c, 0, 1.2, 0, undefined, 20).rotateX(Math.PI / 2), mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: rune('#d9c8ff'), transparent: true, depthWrite: false }), 0, 1.2, 0.2), ball(1.6, MOSS, -1.9, 0.2), ball(1.9, MOSS, 1.9, 0.4), ball(2.4, 0x55703f, 0, 1.5, -2.2)),
    exit: () => group(box(0.4, 3.2, 0.4, 0xd8d2c0, -1.1, 1.6), box(0.4, 3.2, 0.4, 0xd8d2c0, 1.1, 1.6), box(2.8, 0.4, 0.5, 0xd8d2c0, 0, 3.3), mesh(new THREE.PlaneGeometry(1.8, 3), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), 0, 1.5, 0)),
    crystal: () => group(cone(0.35, 1.7, 0xffd98a, 0, 0.85, 0, glowMat(0xffb84a, 0.9)), cone(0.25, 1.1, 0x9ae6ff, 0.35, 0.55, 0.1, glowMat(0x4ac8ff, 0.9)), cone(0.22, 0.9, 0xffd98a, -0.3, 0.45, -0.1, glowMat(0xffb84a, 0.9)), ball(0.5, 0x3a3550, 0, -0.1)),
    chime: () => group(cone(0.32, 1.5, 0xbfe9ff, 0, 0.75, 0, { ...glowMat(0x66ccff, 0.5), transparent: true, opacity: 0.9 }), ball(0.4, 0x3a3550, 0, -0.12)),
    cart: () => group(box(1.6, 0.8, 1.0, WOOD, 0, 0.75), box(1.4, 0.2, 0.8, 0xc9b79a, 0, 1.2), cyl(0.25, 0.25, 0.1, DARK, -0.6, 0.25, 0.55).rotateX(Math.PI / 2), cyl(0.25, 0.25, 0.1, DARK, 0.6, 0.25, 0.55).rotateX(Math.PI / 2)),
    crystalgate: () => group(...[-1, -0.35, 0.3, 0.95].map((x, i) => cone(0.55, 3.8 + (i % 2) * 0.6, 0x9ae6ff, x, 1.9 + (i % 2) * 0.3, 0, { ...glowMat(0x4ac8ff, 0.6), transparent: true, opacity: 0.85 }))),
    barrel: () => group(cyl(0.5, 0.5, 1.1, WOOD, 0, 0.55), cyl(0.5, 0.5, 1.1, WOOD, 0.9, 0.55, 0.3), cyl(0.07, 0.07, 0.1, 0xb03030, 0, 1.15)),
    portcullis: () => group(...[-1.2, -0.6, 0, 0.6, 1.2].map((x) => cyl(0.07, 0.07, 4, 0x3b3f44, x, 2, 0, { metalness: 0.6, roughness: 0.5 })), box(3, 0.15, 0.15, 0x3b3f44, 0, 1.2), box(3, 0.15, 0.15, 0x3b3f44, 0, 2.8)),
    organ: () => group(box(2.6, 1.2, 1.0, WOOD, 0, 0.6), ...[...Array(9)].map((_, i) => cyl(0.1, 0.1, 1.2 + Math.sin(i * 0.9) * 0.6 + 1, 0x6fae9a, -1 + i * 0.25, 1.9, -0.3, { metalness: 0.5, roughness: 0.5 }))),
    telescope: () => group(cyl(0.08, 0.08, 1.2, GOLD, 0, 0.6), cyl(0.12, 0.18, 1.4, GOLD, 0, 1.3, 0.3, { metalness: 0.6, roughness: 0.4 }).rotateX(1.0)),
    nest: () => group(mesh(new THREE.TorusGeometry(1.0, 0.35, 6, 14), mat(0xcfd6dc), 0, 0.3, 0).rotateX(Math.PI / 2), box(0.08, 0.02, 1.1, 0xf4f6f8, 0.2, 0.5, 0)),
    vane: () => group(cyl(0.06, 0.06, 2.2, 0xb8c2c8, 0, 1.1), box(1.0, 0.25, 0.04, GOLD, 0, 2.2, 0, { metalness: 0.7, roughness: 0.3 }), cone(0.12, 0.3, GOLD, 0, 2.5)),
    cistern: () => group(cyl(1.5, 1.6, 0.9, MARBLE, 0, 0.45, 0, undefined, 16), cyl(1.3, 1.3, 0.06, 0x2a3a48, 0, 0.5, 0, undefined, 16)),
    mosaic: () => mesh(new THREE.CircleGeometry(1.3, 24), mat(0x2f78b8, { roughness: 0.3 }), 0, 0.03, 0).rotateX(-Math.PI / 2),
    bell: () => group(cone(0.7, 1.1, 0x4f9a86, 0, 1.25, 0, { metalness: 0.5 }), box(0.15, 2, 0.15, 0x8a9aa0, -0.9, 1), box(0.15, 2, 0.15, 0x8a9aa0, 0.9, 1), box(2.1, 0.15, 0.2, 0x8a9aa0, 0, 2)),
    tidemother: () => group(cone(1.2, 1.4, MARBLE, 0, 0.7), ball(0.42, MARBLE, 0, 1.75), cyl(0.5, 0.6, 0.25, MARBLE, 0, 1.1, 0.7)),
    loom: () => group(box(0.12, 1.8, 0.12, WOOD, -0.8, 0.9), box(0.12, 1.8, 0.12, WOOD, 0.8, 0.9), box(1.8, 0.12, 0.12, WOOD, 0, 1.75), box(1.5, 1.3, 0.03, 0xb85c38, 0, 0.95)),
    goblinold: () => group(goblin(0x8a9a7a, 0x6a5a7a, 0.95), box(0.9, 0.5, 0.8, WOOD, 0, 0.1, -0.2)),
    elder: () => goblin(0x8fa07e, 0x5a4a3a, 1.15),
    fray: () => goblin(),
    hearth: () => group(cyl(1.6, 1.8, 0.45, 0x4a3a30, 0, 0.225, 0, undefined, 18), cyl(0.8, 0.8, 0.1, 0x2a1a14, 0, 0.47, 0, { emissive: 0xff5a1a, emissiveIntensity: 0.25 }, 14), cyl(0.04, 0.04, 2.3, WOOD, -0.7, 1.1).rotateZ(-0.35), cyl(0.04, 0.04, 2.3, WOOD, 0.7, 1.1).rotateZ(0.35)),
};

/** Which looks take a Meshy model, how tall it stands (m), and a turn if the model faces the wrong way. */
export const MODELS = {
    fray: { file: 'fray', h: 1.0 },
    elder: { file: 'elder', h: 1.15 }, goblinold: { file: 'elder', h: 0.9 },
    golem: { file: 'golem', h: 4.2 }, golemsmall: { file: 'golem', h: 1.3 }, golemfallen: { file: 'golem', h: 3.6, lie: true },
    stone: { file: 'stone', h: 2.3 }, pillar: { file: 'stone', h: 4.6 }, rootdoor: { file: 'stone', h: 4.8 },
    pedestal: { file: 'pedestal', h: 1.25 },
    crystal: { file: 'crystal', h: 1.9 }, chime: { file: 'crystal', h: 1.5 },
    tower: { file: 'tower', h: 12 },
    organ: { file: 'organ', h: 3.2 },
    tidemother: { file: 'tidemother', h: 3.2 },
    hearth: { file: 'hearth', h: 2.2 },
    ruin: { file: 'ruin', h: 3.6 }, boat: { file: 'boat', h: 1.5 }, cairn: { file: 'cairn', h: 1.7 }, burrow: { file: 'burrow', h: 1.6 },
    well: { file: 'well', h: 2.9 }, cavemouth: { file: 'cavemouth', h: 6.2 }, boulder: { file: 'boulder', h: 3.4 }, wall: { file: 'wall', h: 3.9 },
    throne: { file: 'throne', h: 3.3 }, stair: { file: 'stair', h: 1.0 }, perch: { file: 'perch', h: 0.9 }, arch: { file: 'arch', h: 4.2 },
    exit: { file: 'arch', h: 3.7 }, hut: { file: 'hut', h: 3.0 }, tidestair: { file: 'tidestair', h: 2.3 }, moondoor: { file: 'moondoor', h: 2.7 },
    cart: { file: 'cart', h: 1.3 }, barrel: { file: 'barrel', h: 1.25 }, telescope: { file: 'telescope', h: 1.9 }, nest: { file: 'nest', h: 1.0 },
    vane: { file: 'vane', h: 2.7 }, cistern: { file: 'cistern', h: 1.05 }, bell: { file: 'bell', h: 2.4 }, loom: { file: 'loom', h: 1.8 },
    pipe: { file: 'pipe', h: 1.6 }, darkway: { file: 'darkway', h: 2.3 }, vine: { file: 'vine', h: 15 }, crystalgate: { file: 'crystal', h: 4.4 },
};

const gltf = new GLTFLoader();
const loads = {};
export const useModels = new URLSearchParams(location.search).get('models') !== '0';
export const modelState = { wanted: 0, loaded: 0, failed: 0 };

export function loadModel(file) {
    if (!MODEL_FILES.has(file)) return Promise.resolve(null);
    if (!loads[file]) {
        modelState.wanted++;
        loads[file] = new Promise((res) => gltf.load(`assets/models/${file}.glb`, (g) => { modelState.loaded++; res(g); }, undefined, () => { modelState.failed++; res(null); }));
    }
    return loads[file];
}

/**
 * A thing's look as a Group on y = 0. The code-made shape shows at once; the model takes its place when ready.
 * `onModel(root, gltf)` is called when a model has been put in (the view uses it to find Fray's skeleton).
 */
export function makeProp(look, onModel) {
    const holder = new THREE.Group();
    const shape = (SHAPES[look] || SHAPES.stone)();
    holder.add(shape);
    const m = MODELS[look];
    if (m && useModels) {
        loadModel(m.file).then((g) => {
            if (!g) return;
            const root = look === 'fray' ? g.scene : g.scene.clone(true);
            if (!g.userData.matte) {
                g.userData.matte = true;
                // Single-sided: Meshy closes thin parts with two faces back to back in one plane, and its materials ask
                // for both sides to be drawn, so each pair fights for the same pixels (the oak's leaves flickered).
                g.scene.traverse((o) => { if (o.material) { o.material.metalness = 0; o.material.roughness = Math.max(0.8, o.material.roughness); o.material.side = THREE.FrontSide; } });
            }
            const b = new THREE.Box3().setFromObject(root), size = b.getSize(new THREE.Vector3());
            const s = m.h / (size.y || 1);
            root.scale.multiplyScalar(s);
            root.position.y = -b.min.y * s;
            const inner = new THREE.Group();
            inner.add(root);
            if (m.lie) { inner.rotation.z = Math.PI / 2; inner.position.y = m.h * 0.28; }
            holder.remove(shape);
            holder.add(inner);
            onModel?.(root, g);
        });
    }
    return holder;
}

/** A gem: a bright faceted stone that turns slowly. */
export function makeGem(color) {
    const c = new THREE.Color(color);
    return mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, roughness: 0.2 }));
}
