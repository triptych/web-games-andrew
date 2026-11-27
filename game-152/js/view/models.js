// The Meshy models: loaded once, re-materialled in cel shading with an ink outline, fitted to a size and turned
// to face downriver. Until a model arrives (or if it fails) a procedural stand-in of the same size is shown, and a
// Craft swaps it out the moment the real one is ready.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toon, toonGradient, addOutlines } from './toon.js';

/**
 * len = the model's longest side in metres once fitted. yaw = the turn that points its bow downriver (−Z in
 * the world), found on dev/models.html. lift = metres above the water line. glow = emissive tint.
 */
export const MODELS = {
    hayate:   { len: 4.6, yaw: -Math.PI / 2, lift: 0.05, color: 0xf4f6ff },
    patrol:   { len: 4.2, yaw: -Math.PI / 2, lift: 0.0, color: 0x6c7280 },
    gunboat:  { len: 5.6, yaw: -Math.PI / 2, lift: 0.0, color: 0x55643d },
    raider:   { len: 3.2, yaw: -Math.PI / 2, lift: 0.05, color: 0xff7a1a },
    barge:    { len: 6.4, yaw: -Math.PI / 2, lift: 0.0, color: 0x8a3b26 },
    tank:     { len: 3.6, yaw: -Math.PI / 2, lift: 0.0, color: 0x50545e },
    turret:   { len: 4.2, yaw: -Math.PI / 2, lift: 0.0, color: 0x6a6a70 },
    mine:     { len: 2.0, yaw: 0, lift: -0.35, color: 0xc0262e },
    kabuto:   { len: 16, yaw: -Math.PI / 2, lift: 0.0, color: 0x5a5f6b },
    torii:    { len: 28, yaw: 0, lift: 0.0, color: 0xb02a2a },
    zero:     { len: 10, yaw: -Math.PI / 2, lift: 0.6, color: 0x22232a },
    souen:    { len: 20, yaw: -Math.PI / 2, lift: 0.0, color: 0x7b808e },
    raijin:   { len: 18, yaw: -Math.PI / 2, lift: 0.4, color: 0x1d2547 },
    tetsuren: { len: 22, yaw: -Math.PI / 2, lift: 0.0, color: 0x1b1a1f },
};

const protos = {};
const waiting = {};
let base = '';

/** Start loading every model. `url` is the folder (game-152/models/). */
export function loadModels(url = 'models/', only = null) {
    base = url;
    const loader = new GLTFLoader();
    for (const name of Object.keys(MODELS)) {
        if (only && !only.includes(name)) continue;
        loader.load(base + name + '.glb', (gltf) => {
            protos[name] = prepare(name, gltf.scene);
            for (const cb of waiting[name] || []) cb(protos[name]);
            waiting[name] = [];
        }, undefined, (err) => console.warn('[models] could not load', name, err?.message || err));
    }
}

export function modelReady(name) { return !!protos[name]; }
export function modelCount() { return Object.keys(protos).length; }

function prepare(name, scene) {
    const spec = MODELS[name];
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const k = spec.len / Math.max(size.x, size.z);
    scene.traverse((o) => {
        if (!o.isMesh) return;
        const old = o.material;
        o.material = new THREE.MeshToonMaterial({
            map: old.map || null, color: old.map ? 0xffffff : (old.color?.getHex?.() ?? spec.color),
            gradientMap: toonGradient(),
        });
        if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
        old.dispose?.();
    });
    // outline thickness in the model's own units, so it is the same on screen whatever the model's scale
    addOutlines(scene, 0.035 / k);
    const holder = new THREE.Group();
    const yaw = new THREE.Group();
    yaw.rotation.y = spec.yaw;
    scene.position.set(-centre.x, -box.min.y, -centre.z);
    yaw.add(scene);
    yaw.scale.setScalar(k);
    holder.add(yaw);
    holder.userData.height = size.y * k;
    return holder;
}

/** A procedural stand-in the same size as the model: a hull and a cabin. */
function standIn(name) {
    const spec = MODELS[name];
    const g = new THREE.Group();
    const L = spec.len;
    if (name === 'mine') {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(L * 0.45, 1), toon(spec.color));
        m.position.y = L * 0.2;
        g.add(m);
    } else if (name === 'turret' || name === 'tank') {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.4, L * 0.48, L * 0.35, 8), toon(spec.color));
        b.position.y = L * 0.17;
        const t = new THREE.Mesh(new THREE.BoxGeometry(L * 0.12, L * 0.12, L * 0.6), toon(0x33343a));
        t.position.set(0, L * 0.42, -L * 0.3);
        g.add(b, t);
    } else if (name === 'torii') {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(L * 0.7, L * 0.16, L * 0.06), toon(spec.color));
        wall.position.y = L * 0.08;
        g.add(wall);
        for (const s of [-1, 1]) {
            const tw = new THREE.Mesh(new THREE.BoxGeometry(L * 0.12, L * 0.3, L * 0.12), toon(0x8a8d96));
            tw.position.set(s * L * 0.36, L * 0.15, 0);
            g.add(tw);
        }
    } else {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(L * 0.38, L * 0.14, L), toon(spec.color));
        hull.position.y = L * 0.07;
        const cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.24, L * 0.14, L * 0.3), toon(0xdde3ee));
        cab.position.set(0, L * 0.2, L * 0.05);
        g.add(hull, cab);
    }
    addOutlines(g, 0.035);
    g.userData.height = L * 0.3;
    return g;
}

/** A thing on screen built from a model: starts as the stand-in, swaps to the real model when it is in. */
export class Craft {
    constructor(name) {
        this.name = name;
        this.group = new THREE.Group();
        this.body = new THREE.Group();          // banking and bobbing happen here
        this.group.add(this.body);
        this.real = false;
        this.inner = null;
        const lift = MODELS[name]?.lift || 0;
        this.body.position.y = lift;
        if (protos[name]) this._set(protos[name].clone(), true);
        else {
            this._set(standIn(name), false);
            (waiting[name] ||= []).push((p) => { if (!this.real && !this.disposed) this._set(p.clone(), true); });
        }
    }
    _set(obj, real) {
        if (this.inner) this.body.remove(this.inner);
        this.inner = obj;
        this.real = real;
        this.body.add(obj);
    }
    get height() { return this.inner?.userData.height || 1; }
    /** Tint the whole craft (a white hit flash): sets emissive on every toon material. Materials are per clone. */
    flash(amount, color = 0xffffff) {
        if (!this._mats) {
            this._mats = [];
            this.inner.traverse((o) => {
                if (o.isMesh && !o.userData.isOutline && o.material?.isMeshToonMaterial) {
                    o.material = o.material.clone();
                    this._mats.push(o.material);
                }
            });
            this._matsFor = this.inner;
        }
        if (this._matsFor !== this.inner) { this._mats = null; return this.flash(amount, color); }
        for (const m of this._mats) { m.emissive.setHex(color); m.emissiveIntensity = amount; }
    }
    dispose() { this.disposed = true; }
}
