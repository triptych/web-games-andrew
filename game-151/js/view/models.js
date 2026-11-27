// Meshy models in cel shading. The Solitaire, the escort drone and the six motherships are Meshy GLBs (models/);
// this module loads each once, swaps its materials for a three-step toon shade with the Meshy texture as the map,
// and adds an ink outline (an inverted hull). Until a model loads, or if one fails to, a procedural stand-in of
// the same size and colour takes its place, so the game never waits on a file.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

export const RAMP = (() => {
    const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
})();
const INK = 0x14101c;

export function loadModel(name) {
    if (!cache.has(name)) cache.set(name, loader.loadAsync(new URL(`../../models/${name}.glb`, import.meta.url).href).catch((e) => { console.warn('[model]', name, e.message); return null; }));
    return cache.get(name);
}

/** Toon materials and an ink outline on every mesh under root. thickness is in the model's own units. */
export function toonify(root, thickness, emissive = 0x000000, tint = 0xffffff) {
    const meshes = [];
    root.traverse((o) => { if (o.isMesh && !o.userData.outline) meshes.push(o); });
    for (const o of meshes) {
        const old = o.material;
        const map = old.map || null;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
        o.material = new THREE.MeshToonMaterial({ map, color: map ? tint : (old.color || new THREE.Color(0xdddddd)), gradientMap: RAMP, emissive, emissiveIntensity: 0.25 });
        const mat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
        mat.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `transformed += normalize(normal) * ${thickness.toFixed(5)};\n#include <project_vertex>`);
        };
        const ol = new THREE.Mesh(o.geometry, mat);
        ol.userData.outline = true;
        ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
        o.parent.add(ol);
    }
}

/** Centre a model on its bounding box and scale its longest side to `size`. */
function fitSize(obj, size) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const s = box.getSize(new THREE.Vector3());
    const k = size / Math.max(s.x, s.y, s.z, 1e-3);
    obj.scale.multiplyScalar(k);
    const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
    obj.position.sub(c);
    return k;
}

const toon = (color, emissive = 0) => new THREE.MeshToonMaterial({ color, gradientMap: RAMP, emissive, emissiveIntensity: emissive ? 1 : 0 });

/** Procedural stand-ins, roughly the shape of what Meshy made. */
function standIn(kind, hue) {
    const g = new THREE.Group();
    if (kind === 'solitaire') {
        const hull = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 8).rotateX(-Math.PI / 2), toon(0xeef2ff));
        const wing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.9), toon(0x24346e));
        wing.position.z = 0.5;
        const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2, 8).rotateX(Math.PI / 2), toon(0xd8b04a));
        lance.position.z = -2;
        g.add(hull, wing, lance);
    } else if (kind === 'drone') {
        g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.6), toon(0x7a62b8, 0x2a1850)));
        for (let i = 0; i < 3; i++) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.35), toon(0x55407e));
            b.rotation.z = (i / 3) * Math.PI * 2;
            g.add(b);
        }
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3fd0 }));
        eye.position.z = -0.55;
        g.add(eye);
    } else {
        const c = new THREE.Color(hue);
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(4, 14, 6, 12).rotateX(Math.PI / 2), toon(c.clone().multiplyScalar(0.45)));
        const core = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: c }));
        core.position.set(0, 0.5, -8);
        for (let i = 0; i < 5; i++) {
            const sp = new THREE.Mesh(new THREE.ConeGeometry(0.8, 5, 6), toon(c.clone().multiplyScalar(0.3)));
            sp.position.set((i - 2) * 1.8, 4.5, (i % 2) * 2);
            g.add(sp);
        }
        g.add(body, core);
    }
    return g;
}

/**
 * A model slot: root is in the scene at once with a stand-in; the Meshy model replaces it when it loads.
 * size is the longest side in world units. yaw turns the model so its nose points down -Z.
 */
export class Craft {
    constructor(name, { size = 3, yaw = 0, kind = name, hue = 0xffffff, outline = 0.012, emissive = 0x000000 } = {}) {
        this.name = name;
        this.root = new THREE.Group();
        this.holder = new THREE.Group();
        this.root.add(this.holder);
        this.stand = standIn(kind, hue);
        fitSize(this.stand, size);
        this.holder.add(this.stand);
        this.model = null;
        this.ready = loadModel(name).then((gltf) => {
            if (!gltf) return false;
            const m = gltf.scene.clone(true);
            m.rotation.y = yaw;
            const wrap = new THREE.Group();
            wrap.add(m);
            const k = fitSize(wrap, size);
            toonify(m, outline * size / Math.max(k, 1e-3), emissive);
            this.holder.remove(this.stand);
            this.holder.add(wrap);
            this.model = wrap;
            return true;
        });
    }
}

/** A copy of a loaded craft for instancing many drones cheaply (shares geometry and materials). */
export function cloneCraft(src) {
    const c = new THREE.Group();
    c.add((src.model || src.stand).clone(true));
    return c;
}
