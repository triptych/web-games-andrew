// The elements' models. Each kind has a Meshy GLB in assets/models/ (dev/assets/README.md) and a code-built
// stand-in, which is what shows until the GLB arrives (and always with ?models=0, or if a file fails to load).
// Both are reduced to { geo, mat, fit } prototypes: one geometry and one material, so a level draws every instance of
// a kind in one InstancedMesh.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ELEMENTS, ELEMENT_IDS } from '../sim/data/elements.js';

export const useModels = new URLSearchParams(location.search).get('models') !== '0';
export const modelState = { wanted: 0, loaded: 0, failed: 0, ready: !useModels };

const protos = {};          // kind → { geo, mat, glb: bool }

// ------------------------------------------------------------------ stand-ins
function part(geo, color, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], rot = [0, 0, 0]) {
    const g = geo.clone().toNonIndexed();
    g.scale(sx, sy, sz);
    g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]);
    g.translate(x, y, z);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => [c.r, c.g, c.b][i % 3]), 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
}
const SPH = new THREE.SphereGeometry(0.5, 14, 10), BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14), CONE = new THREE.ConeGeometry(0.5, 1, 12);
const TOR = new THREE.TorusGeometry(0.4, 0.08, 6, 14);

/** Each stand-in is built about 1 unit tall, standing on y = 0 (scaled like the GLBs). */
const STAND = {
    slime: () => [part(SPH, 0x8ee8c8, [0, 0.42, 0], [1, 0.85, 1]), part(SPH, 0xf2fff8, [0, 0.36, 0.3], [0.55, 0.5, 0.3]), part(SPH, 0xc8a070, [0.05, 0.92, 0], [0.18, 0.08, 0.3], [0, 0, 0.6])],
    mushfolk: () => [part(CYL, 0xf4e6d6, [0, 0.3, 0], [0.4, 0.6, 0.4]), part(SPH, 0xd8443a, [0, 0.72, 0], [0.9, 0.5, 0.9]), part(SPH, 0xffffff, [0.2, 0.86, 0.15], [0.14, 0.1, 0.14]), part(BOX, 0xffc860, [0.25, 0.35, 0.2], [0.12, 0.16, 0.12])],
    golem: () => [part(SPH, 0x8c8a86, [0, 0.35, 0], [1, 0.7, 0.8]), part(SPH, 0x9a9890, [0, 0.8, 0], [0.55, 0.45, 0.5]), part(SPH, 0x6a9a4a, [0, 0.98, 0], [0.5, 0.15, 0.45]), part(SPH, 0x8c8a86, [0.48, 0.3, 0.1], [0.3, 0.45, 0.3]), part(SPH, 0x8c8a86, [-0.48, 0.3, 0.1], [0.3, 0.45, 0.3])],
    goblin: () => [part(CYL, 0xf2e8d4, [0, 0.3, 0], [0.45, 0.6, 0.35]), part(SPH, 0x7ab060, [0, 0.72, 0], [0.42, 0.4, 0.4]), part(CONE, 0x7ab060, [0.28, 0.76, 0], [0.12, 0.3, 0.1], [0, 0, -1.3]), part(CONE, 0x7ab060, [-0.28, 0.76, 0], [0.12, 0.3, 0.1], [0, 0, 1.3]), part(CYL, 0xffffff, [0, 0.98, 0], [0.38, 0.16, 0.38])],
    dragon: () => [part(SPH, 0xe08a3a, [0, 0.35, 0], [1.6, 0.7, 1.1]), part(SPH, 0xf2c98a, [0, 0.3, 0.3], [1.1, 0.4, 0.6]), part(SPH, 0xe08a3a, [0.8, 0.45, 0.3], [0.5, 0.42, 0.45]), part(CONE, 0xe08a3a, [-0.9, 0.25, -0.2], [0.25, 0.9, 0.25], [0, 0, 1.4]), part(CONE, 0xc8702a, [0, 0.75, -0.1], [0.6, 0.35, 0.2], [0.4, 0, 0])],
    gold: () => [part(CONE, 0xf2c240, [0, 0.35, 0], [1.4, 0.7, 1.2]), part(SPH, 0xd84a5a, [0.2, 0.55, 0.2], [0.12, 0.12, 0.12]), part(SPH, 0x4a7ad8, [-0.25, 0.45, 0.1], [0.12, 0.12, 0.12]), part(CYL, 0xffd860, [0.1, 0.78, 0], [0.16, 0.16, 0.16])],
    chest: () => [part(BOX, 0x7a4a2a, [0, 0.3, 0], [1, 0.6, 0.65]), part(CYL, 0x8a5a32, [0, 0.62, 0], [0.32, 1, 0.65], [0, 0, Math.PI / 2]), part(BOX, 0x8a8478, [0, 0.45, 0.34], [0.14, 0.2, 0.04]), part(BOX, 0xffd860, [0, 0.66, 0], [0.9, 0.06, 0.5])],
    brazier: () => [part(CYL, 0x4a3a34, [0, 0.45, 0], [0.12, 0.9, 0.12]), part(CYL, 0x4a3a34, [0, 0.95, 0], [1, 0.18, 1]), part(SPH, 0xff7a2a, [0, 1.02, 0], [0.8, 0.12, 0.8]), part(TOR, 0x4a3a34, [0, 0.1, 0], [1, 1, 1], [Math.PI / 2, 0, 0])],
    candles: () => [part(CYL, 0x9a948a, [0, 0.05, 0], [1, 0.1, 0.8]), part(CYL, 0xf4ead6, [0, 0.45, 0], [0.2, 0.8, 0.2]), part(CYL, 0xf4ead6, [0.25, 0.3, 0.1], [0.18, 0.5, 0.18]), part(CYL, 0xf4ead6, [-0.22, 0.35, -0.05], [0.18, 0.6, 0.18]), part(CYL, 0xf4ead6, [0.05, 0.22, 0.28], [0.16, 0.35, 0.16])],
    campfire: () => [part(TOR, 0x8c8a86, [0, 0.06, 0], [1, 1, 1.6], [Math.PI / 2, 0, 0]), part(CYL, 0x6a4424, [0, 0.12, 0], [0.12, 0.8, 0.12], [0, 0, 1.2]), part(CYL, 0x6a4424, [0, 0.12, 0], [0.12, 0.8, 0.12], [1.2, 0, 0]), part(CYL, 0xb04a3a, [-0.75, 0.12, 0.2], [0.24, 0.6, 0.24], [Math.PI / 2, 0, 0]), part(CYL, 0x4a7aa0, [0.75, 0.12, 0.2], [0.24, 0.6, 0.24], [Math.PI / 2, 0, 0])],
    bookshelf: () => [part(BOX, 0x6b4528, [0, 0.5, 0], [0.75, 1, 0.3]), part(BOX, 0xb5473a, [-0.15, 0.7, 0.05], [0.3, 0.18, 0.22]), part(BOX, 0x3f6e9a, [0.15, 0.42, 0.05], [0.32, 0.18, 0.22]), part(BOX, 0xd9a441, [-0.05, 0.16, 0.05], [0.5, 0.16, 0.22])],
    barrels: () => [part(CYL, 0x8a5a32, [-0.3, 0.4, 0], [0.55, 0.8, 0.55]), part(CYL, 0x8a5a32, [0.32, 0.4, -0.05], [0.55, 0.8, 0.55]), part(BOX, 0x9a6a3a, [0, 0.16, 0.42], [0.5, 0.32, 0.35]), part(SPH, 0xd84a3a, [0, 0.36, 0.42], [0.2, 0.12, 0.15])],
    cauldron: () => [part(SPH, 0x2e2a2a, [0, 0.42, 0], [1, 0.8, 1]), part(CYL, 0x8adc5a, [0, 0.76, 0], [0.8, 0.04, 0.8]), part(CYL, 0x8a5a32, [0.2, 0.9, 0], [0.05, 0.6, 0.05], [0, 0, 0.4])],
    table: () => [part(CYL, 0x9a6a3a, [0, 0.55, 0], [0.9, 0.08, 0.9]), part(CYL, 0x7a4a2a, [0, 0.27, 0], [0.12, 0.55, 0.12]), part(CYL, 0x9a6a3a, [0.65, 0.2, 0.1], [0.3, 0.4, 0.3]), part(CYL, 0x9a6a3a, [-0.62, 0.2, -0.1], [0.3, 0.4, 0.3]), part(SPH, 0x4a7ad8, [0, 0.7, 0], [0.22, 0.2, 0.22])],
    glowcaps: () => [part(SPH, 0x6a8a4a, [0, 0.06, 0], [0.9, 0.15, 0.8]), part(CYL, 0xc8f0ff, [0, 0.35, 0], [0.08, 0.6, 0.08]), part(SPH, 0x6ad8ff, [0, 0.66, 0], [0.4, 0.18, 0.4]), part(CYL, 0xc8f0ff, [0.22, 0.22, 0.1], [0.06, 0.4, 0.06]), part(SPH, 0x6ad8ff, [0.22, 0.44, 0.1], [0.28, 0.13, 0.28])],
    crystals: () => [part(SPH, 0x8c8a86, [0, 0.12, 0], [0.9, 0.3, 0.8]), part(CONE, 0xb48cff, [0, 0.55, 0], [0.3, 0.9, 0.3]), part(CONE, 0x9a6aff, [0.2, 0.4, 0.1], [0.22, 0.6, 0.22], [0, 0, -0.4]), part(CONE, 0xd0b0ff, [-0.2, 0.38, -0.05], [0.2, 0.55, 0.2], [0, 0, 0.45])],
    statue: () => [part(CYL, 0x9a968e, [0, 0.15, 0], [0.9, 0.3, 0.9]), part(SPH, 0xaaa69c, [0, 0.55, 0], [0.75, 0.5, 0.6]), part(SPH, 0xaaa69c, [0.25, 0.75, 0.1], [0.3, 0.28, 0.3]), part(CONE, 0xaaa69c, [0.32, 0.95, 0.1], [0.1, 0.18, 0.1])],
};

const standMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });

function standIn(kind) {
    const g = mergeGeometries((STAND[kind] || STAND.chest)());
    g.computeBoundingBox();
    return { geo: g, mat: standMat, glb: false };
}

// ------------------------------------------------------------------ GLBs
const loader = new GLTFLoader();

function loadGlb(kind) {
    const name = ELEMENTS[kind].model;
    modelState.wanted++;
    return new Promise((res) => {
        loader.load(new URL(`../../assets/models/${name}.glb`, import.meta.url).href, (gltf) => {
            gltf.scene.updateMatrixWorld(true);
            const geos = [];
            let mat = null;
            gltf.scene.traverse((o) => {
                if (!o.isMesh) return;
                const g = o.geometry.clone();
                g.applyMatrix4(o.matrixWorld);
                for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
                geos.push(g);
                mat ||= o.material;
            });
            if (!geos.length) { modelState.failed++; res(null); return; }
            const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
            geo.computeBoundingBox();
            // Meshy's thin parts are two faces back to back: one side only, or they flicker (game-131)
            mat.side = THREE.FrontSide;
            mat.roughness = Math.max(0.55, mat.roughness ?? 1);
            mat.metalness = Math.min(0.15, mat.metalness ?? 0);
            if (kind === 'slime') { mat.transparent = true; mat.opacity = 0.92; }
            modelState.loaded++;
            res({ geo, mat, glb: true });
        }, undefined, () => { modelState.failed++; res(null); });
    });
}

/** Start loading every model. onReady() runs once all have loaded or failed (the view then rebuilds its elements). */
export function loadModels(onReady) {
    for (const k of ELEMENT_IDS) protos[k] = standIn(k);
    if (!useModels) return;
    Promise.all(ELEMENT_IDS.map((k) => loadGlb(k).then((p) => { if (p) protos[k] = p; }))).then(() => {
        modelState.ready = true;
        onReady?.();
    });
}

/**
 * The prototype for a kind, with the scale that fits it to its element's size: models are 1 unit tall standing on
 * y = 0; scale so the height is the element's h, unless that makes the footprint wider than its size.
 */
export function proto(kind) {
    const p = protos[kind] || (protos[kind] = standIn(kind));
    if (p.fit === undefined) {
        const e = ELEMENTS[kind];
        const bb = p.geo.boundingBox, h = bb.max.y - bb.min.y || 1, foot = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) || 1;
        p.fit = Math.min(e.h / h, e.size / foot);
        p.minY = bb.min.y;
    }
    return p;
}

/** A small thumbnail URL for the stamp palette (Meshy's own render). */
export const thumbUrl = (kind) => new URL(`../../assets/thumbs/${ELEMENTS[kind].model}.webp`, import.meta.url).href;
