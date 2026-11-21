// Meshy models (models/<name>.glb, made by dev/meshy/): loaded once at boot, normalised (centred, turned to face the
// way the game needs, scaled to a set length) and cloned per entity. Until a model has loaded, or if it fails to,
// the procedural model in models.js is used instead, so the game never waits on them and never breaks without them.
//
// Meshy returns each model in its own orientation. FIT says how to turn each one: `rot` (radians, a three.js Euler,
// order `order` or XYZ) so that the nose points +x for ships and -x for enemies, and `len` is its size in world units
// along x (`h` instead fixes the height, for tall things).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const Y = Math.PI / 2, B = Math.PI;
// Meshy's native facings vary (dev/models.html?rot=0 shows them): many hulls already point -x, creatures face +z
// (toward the game camera). Creatures that read best from the front get Q, a three-quarter turn that points them at
// the player (-x) while still showing their face to the camera.
const Q = -Y * 0.6;
export const FIT = {
    'ship-sora': { len: 2.6, rot: [0, B, 0] },
    'ship-kaito': { len: 2.8, rot: [0, B, 0] },
    'ship-lyra': { len: 2.4, rot: [0, Y, 0] },
    mote: { len: 1.2, rot: [0, Q, 0] },
    dart: { len: 1.6, rot: [0, 0, 0] },
    pod: { len: 1.8, rot: [0, Q, 0] },
    mine: { len: 1.5, rot: [0, Q, 0] },
    gunship: { len: 2.8, rot: [0, 0, 0] },
    carrier: { len: 5.0, rot: [0, 0, 0] },
    cruiser: { len: 6.0, rot: [0, 0, 0] },
    manta: { len: 2.4, rot: [0, -Y, 0] },
    shard: { h: 1.9, rot: [0, 0, 0] },
    squid: { h: 2.4, rot: [0, Q, 0] },
    sentinel: { h: 2.6, rot: [0, Q, 0] },
    eye: { len: 2.8, rot: [0, Q, 0] },
    serpentHead: { len: 2.4, rot: [0, -Y, 0] },
    segment: { h: 1.5, rot: [0, -0.5, 0] },     // a ring made facing +z: its glowing core turned mostly to the camera
    kamikaze: { len: 1.4, rot: [0, 0, 0] },
    // the shield sits on top of the hull as made: roll it to face the player, then turn it a little toward the camera
    bearer: { h: 2.6, rot: [0, 0.6, Y] },
    angel: { h: 3.0, rot: [0, Q, 0] },
    egg: { h: 1.3, rot: [0, 0, 0] },
    turret: { len: 1.5, rot: [0, 0, 0] },
    bigturret: { len: 2.0, rot: [0, 0, 0] },
    engine: { len: 2.4, rot: [0, 0, 0] },
    // bosses: `off` centres the model on the sim's hull (world x, y from the boss origin; world y is up)
    'boss-bellwether': { len: 15, rot: [0, 0, 0], off: [1.4, 0] },
    'boss-wyrm': { len: 5.5, rot: [0, -1.25, 0], off: [0.6, 0] },   // made snout to +z: yaw it to -x, a little to the camera
    'boss-organ': { h: 19, rot: [0, 0, 0], off: [3.2, 0] },
    'boss-titan': { h: 10, rot: [0, Q, 0], off: [0.6, -0.6] },
    'boss-mother': { h: 9, rot: [0, Q * 0.6, 0], off: [0.8, 0] },
    'boss-heart': { h: 9, rot: [0, Q * 0.6, 0], off: [0.4, -0.4] },
};
// procedural model kinds that use another Meshy model
export const ALIAS = { shardlet: ['shard', 0.5], tentacleEye: ['eye', 0.55], crystalSegment: ['segment', 1.1] };

const templates = new Map();
let loading = null;

/** Start loading every model. Resolves when all have loaded or failed; failures just leave the fallback in place. */
export function loadMeshy(base = 'models/') {
    if (loading) return loading;
    const loader = new GLTFLoader();
    loading = Promise.all(Object.keys(FIT).map((name) => new Promise((done) => {
        loader.load(`${base}${name}.glb`, (gltf) => { templates.set(name, normalise(gltf.scene, FIT[name])); done(true); }, undefined, () => done(false));
    }))).then((r) => r.filter(Boolean).length);
    return loading;
}

function normalise(scene, fit) {
    scene.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = false;
            const m = o.material;
            if (m) {
                // keep the painted look under bloom: Meshy's emission maps can be very bright
                if (m.emissiveIntensity != null) m.emissiveIntensity = Math.min(m.emissiveIntensity, 1.2);
                m.envMapIntensity = 0.9;
            }
        }
    });
    const turn = new THREE.Group();
    turn.add(scene);
    turn.rotation.set(...fit.rot, fit.order || 'XYZ');
    turn.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(turn);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const k = fit.h ? fit.h / Math.max(1e-3, size.y) : fit.len / Math.max(1e-3, size.x);
    const holder = new THREE.Group();
    turn.position.sub(centre);
    holder.add(turn);
    holder.scale.setScalar(k);
    return holder;
}

/** A clone of a loaded model (sharing geometry and materials), or null if it isn't loaded. */
export function meshyClone(name, scale = 1) {
    const a = ALIAS[name];
    const t = templates.get(a ? a[0] : name);
    if (!t) return null;
    const c = t.clone(true);
    c.scale.multiplyScalar(scale * (a ? a[1] : 1));
    return c;
}

export function meshyCount() { return templates.size; }

// Procedural pieces kept on top of a boss's Meshy body: they animate gameplay (an eye that opens, a sword that
// breaks, tentacles that reach to their parts, the weak-point core) or are effects a mesh can't do (wings of light).
const KEEP = {
    bellwether: ['core', 'glows'], wyrm: [], organ: ['eye', 'lidTop', 'lidBot'], titan: ['core', 'blade', 'glows'],
    mother: ['eyeObj', 'tentacles', 'glows'], heart: ['wings', 'spin', 'glows'],
};

/** Swap a procedural group's body for a Meshy model, keeping the parts listed (by userData.parts key) and flames. */
export function dressShip(group, name) {
    const m = meshyClone(name);
    if (!m) return group;
    const s = group.scale.x || 1;
    for (const c of group.children) if (!c.userData.flame) c.visible = false;
    m.scale.divideScalar(s);
    group.add(m);
    const tail = -(FIT[name].len / 2) / s;
    for (const f of group.userData.parts.flames || []) f.position.x = Math.min(f.position.x, tail + 0.1);
    group.userData.meshy = m;
    return group;
}

export function dressEnemy(group, model) {
    const m = meshyClone(model);
    if (!m) return group;
    for (const c of group.children) if (!c.userData.flame) c.visible = false;
    group.add(m);
    const P = group.userData.parts;
    P.spin = ['pod', 'mine', 'shard', 'shardlet', 'egg'].includes(model) ? [m] : [];
    P.eye = null;
    group.userData.barrel = null;
    group.userData.meshy = m;
    return group;
}

export function dressBoss(group, key) {
    const name = 'boss-' + key;
    const m = meshyClone(name);
    if (!m) return group;
    const P = group.userData.parts, X = P.extra;
    const keep = new Set();
    const mark = (o) => { if (!o) return; if (Array.isArray(o)) o.forEach(mark); else { keep.add(o); let p = o.parent; while (p && p !== group) { keep.add(p); p = p.parent; } } };
    for (const k of KEEP[key] || []) {
        if (k === 'core') mark(P.core);
        else if (k === 'glows') mark(P.glows);
        else if (k === 'spin') mark(P.spin);
        else if (k === 'eye') mark(P.core);
        else if (k === 'eyeObj') mark(P.core);
        else mark(X[k]);
    }
    for (const c of group.children) if (!keep.has(c)) c.visible = false;
    if (key === 'wyrm') X.jaw = null;
    const off = FIT[name].off || [0, 0];
    m.position.set(off[0], off[1], -0.6);
    group.add(m);
    group.userData.meshy = m;
    return group;
}
