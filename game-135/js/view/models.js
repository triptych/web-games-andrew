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
 * onLoad(obj) is called once the real model is in.
 */
export function model(name, fit, stand, { yaw = 0, onLoad = null } = {}) {
    const g = new THREE.Group();
    if (stand) g.add(stand);
    if (!useModels || !MODEL_FILES.has(name)) return g;
    load(name).then((m) => {
        if (!m) return;
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
