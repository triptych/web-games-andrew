// HOLLOWDEEP — the dungeon's props: textured low-poly models generated with Meshy (art/models/*.glb, see
// dev/art/README.md § Models). Each is loaded once and cloned; the clones share geometry and texture.
//
// A model is fitted to the grid by its bounding box: turned so its front faces +Z, scaled so one axis has a set size
// in world units (a dungeon cell is 2 × 2, walls 2.3 high), centred on x/z, and stood on y = 0 (or hung below it).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// fit: the axis that gets `size`; stretch: other axes set to a size of their own; rotY: turn so the front faces +Z
// (0 or π only, so stretch axes stay put); anchor: 'bottom' stands on y = 0, 'top' hangs below it; back: put the back
// (min z) at z = 0 instead of centring (for things fixed to a wall); file: another model's file.
export const MODELS = {
    chest_closed: { fit: 'x', size: 0.95, rotY: 0 },
    chest_open: { fit: 'x', size: 0.95, rotY: 0 },
    sconce: { fit: 'y', size: 0.8, rotY: 0, back: true },
    fountain: { fit: 'x', size: 1.55, rotY: 0 },
    // one flight of steps, rising toward -Z as generated. Up: turned to climb away (+Z, into the back wall of the
    // dead end) and squeezed into the back half of the cell. Down: the same flight sunk in a hole in the floor, its
    // top step level with the floor at the way in.
    stairs_up: { fit: 'z', size: 0.9, rotY: Math.PI, stretch: { x: 1.5, y: 0.7 } },
    stairs_down: { file: 'stairs_up', fit: 'z', size: 2.0, rotY: 0, anchor: 'top', stretch: { x: 1.96, y: 1.05 } },
    delver: { fit: 'y', size: 1.05, rotY: 0 },
};

/** Turn, scale and place a loaded scene inside a new group, as MODELS[id] says. */
export function fitModel(scene, m) {
    const inner = new THREE.Group();
    inner.add(scene);
    inner.rotation.y = m.rotY || 0;
    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const dim = box.getSize(new THREE.Vector3());
    const k = m.size / (dim[m.fit] || 1);
    inner.scale.setScalar(k);
    if (m.stretch) for (const [ax, v] of Object.entries(m.stretch)) inner.scale[ax] = v / (dim[ax] || 1);
    inner.updateMatrixWorld(true);
    box.setFromObject(inner);
    const c = box.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, m.anchor === 'top' ? -box.max.y : -box.min.y, m.back ? -box.min.z : -c.z);
    const g = new THREE.Group();
    g.add(inner);
    return g;
}

/** Plain Lambert with the painted map, like the walls: cheap on phones and lit the same way. */
function lambert(scene) {
    scene.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.material;
        o.material = new THREE.MeshLambertMaterial({ map: src.map || null, color: src.color ? src.color.clone() : 0xffffff, side: src.side });
        if (o.material.map) o.material.map.anisotropy = 2;
        o.userData.shared = true;     // copies share this geometry and material: the floor's clear() leaves them be
        src.dispose();
    });
    return scene;
}

export class Models {
    constructor(base = 'art/models/') {
        this.base = base;
        this.loader = new GLTFLoader();
        this.cache = {};      // id → fitted group (the template)
        this.failed = new Set();
        this.waiting = {};    // id → callbacks
    }

    /** A fitted copy of the model, now if it is loaded (else null; load() it first). */
    get(id) { const t = this.cache[id]; return t ? t.clone() : null; }

    /** Load (once) and call back with a fitted copy; never calls back if the file fails. */
    load(id, cb) {
        if (this.cache[id]) { cb(this.get(id)); return; }
        if (this.failed.has(id)) return;
        (this.waiting[id] ||= []).push(cb);
        if (this.waiting[id].length > 1) return;
        this.loader.load(`${this.base}${MODELS[id].file || id}.glb`, (gltf) => {
            this.cache[id] = fitModel(lambert(gltf.scene), MODELS[id]);
            for (const f of this.waiting[id]) f(this.get(id));
            delete this.waiting[id];
        }, undefined, () => { this.failed.add(id); delete this.waiting[id]; });
    }

    preload() { for (const id of Object.keys(MODELS)) this.load(id, () => {}); }
}
