// Meshy models (assets/models/<name>.glb, see dev/assets/README.md) with code-built stand-ins.
// model(name, fit, stand) returns a Group at once with the stand-in inside; when the GLB loads it replaces the
// stand-in. ?models=0 keeps the stand-ins.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_FILES } from '../model-files.js';

const loader = new GLTFLoader();
const cache = {};
export const useModels = new URLSearchParams(location.search).get('models') !== '0';
export const modelState = { wanted: 0, loaded: 0, failed: 0 };

function load(name) {
    if (!cache[name]) {
        modelState.wanted++;
        cache[name] = new Promise((res) => {
            loader.load(new URL(`../../assets/models/${name}.glb`, import.meta.url).href, (g) => {
                modelState.loaded++;
                g.scene.traverse((o) => {
                    if (!o.isMesh) return;
                    o.castShadow = true; o.receiveShadow = false;
                    // Meshy's thin parts are two faces back to back: draw one side only, or they flicker (game-131)
                    if (o.material) { o.material.side = THREE.FrontSide; o.material.roughness = Math.max(0.5, o.material.roughness ?? 1); o.material.metalness = Math.min(0.2, o.material.metalness ?? 0); }
                });
                const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3());
                res({ scene: g.scene, size, minY: box.min.y });
            }, undefined, () => { modelState.failed++; res(null); });
        });
    }
    return cache[name];
}

/**
 * A model group. fit: { len } scales the longest side on the ground to len (vehicles); { w, d } stretches the
 * footprint to w by d (buildings). yaw turns the model inside the group so its front is the group's +Z.
 * onLoad(obj) is called once the real model is in. wheels: [{ x, y, r, z0, z1 }] in the model's own units; each is
 * cut out of the mesh into a part that can turn (see splitWheels).
 */
export function model(name, fit, stand, { yaw = 0, onLoad = null, wheels = null } = {}) {
    const g = new THREE.Group();
    if (stand) g.add(stand);
    if (!useModels || !MODEL_FILES.has(name)) return g;
    load(name).then((m) => {
        if (!m) return;
        if (wheels && !m.split) { m.split = true; splitWheels(m.scene, wheels); }
        const obj = m.scene.clone(true);
        const quarter = Math.abs(Math.sin(yaw)) > 0.5;                 // a quarter turn swaps the footprint's sides
        const sx = quarter ? m.size.z : m.size.x, sz = quarter ? m.size.x : m.size.z;
        const holder = new THREE.Group();
        obj.rotation.y = yaw;
        obj.position.y = -m.minY;
        holder.add(obj);
        if (fit.len) holder.scale.setScalar(fit.len / Math.max(sx, sz));
        else { const kx = fit.w / sx, kz = fit.d / sz; holder.scale.set(kx, (kx + kz) / 2, kz); }
        if (stand) g.remove(stand);
        g.add(holder);
        g.userData.loaded = true;
        onLoad?.(holder);
    });
    return g;
}

export function preload(names) { for (const n of names) if (useModels && MODEL_FILES.has(n)) load(n); }

/**
 * A Meshy model is one solid mesh, wheels and all. Cut each wheel out so it can turn: every triangle that lies wholly
 * inside a wheel's cylinder (centre x, y; radius r; from z0 to z1, the axle being the model's z axis) moves to a new
 * mesh under a pivot at the wheel's centre, named 'wheel' with userData.wheelR. The new meshes share the original's
 * vertex buffers and material; only the index lists are new. The wheel table comes from dev/assets/wheels.mjs.
 */
export function splitWheels(scene, wheels) {
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const v = new THREE.Vector3();
    for (const mesh of meshes) {
        const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count;
        const idx = geo.index ? geo.index.array : Uint32Array.from({ length: n }, (_, i) => i);
        const of = new Int8Array(n).fill(-1);
        for (let i = 0; i < n; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
            for (let k = 0; k < wheels.length; k++) {
                const w = wheels[k];
                if (v.z >= w.z0 - 0.012 && v.z <= w.z1 + 0.012 && Math.hypot(v.x - w.x, v.y - w.y) <= w.r * 1.05) { of[i] = k; break; }
            }
        }
        const body = [], parts = wheels.map(() => []);
        for (let t = 0; t < idx.length; t += 3) {
            const a = idx[t], b = idx[t + 1], c = idx[t + 2], k = of[a];
            (k >= 0 && of[b] === k && of[c] === k ? parts[k] : body).push(a, b, c);
        }
        parts.forEach((list, k) => {
            if (!list.length) return;
            const w = wheels[k], g = new THREE.BufferGeometry();
            for (const name in geo.attributes) g.setAttribute(name, geo.attributes[name]);
            g.setIndex(list);
            g.computeBoundingSphere();
            const pivot = new THREE.Group();
            pivot.name = 'wheel'; pivot.userData.wheelR = w.r;
            pivot.position.set(w.x, w.y, (w.z0 + w.z1) / 2);
            const part = new THREE.Mesh(g, mesh.material);
            part.castShadow = mesh.castShadow;
            part.matrixAutoUpdate = false;
            part.matrix.makeTranslation(-pivot.position.x, -pivot.position.y, -pivot.position.z).multiply(mesh.matrixWorld);
            pivot.add(part);
            scene.add(pivot);
        });
        geo.setIndex(body);
    }
}
