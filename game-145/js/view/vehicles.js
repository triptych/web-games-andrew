// The vehicles: Meshy text-to-3D models (models/*.glb, see dev/meshy/README.md), drawn as instanced meshes, one batch
// per model per city block or garage floor. Each model is fitted once when it loads: its long axis turned onto local
// z (the way the sim lays cars out), scaled to a real length, its wheels put on y = 0. Each instance gets a slight
// colour tint and, when the sim says its tyres are flat, a sag and a lean. Until a model loads, or if it fails to,
// the code-built vehicle in props.js is drawn instead.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** model → length in metres (front bumper to back) */
const LEN = { sedan: 4.6, hatchback: 3.9, wagon: 4.9, pickup: 5.1, van: 4.7, truck: 4.9, bus: 9.6 };
/** sim prop kind → the models it may be drawn as */
const KINDS = { car: ['sedan', 'hatchback', 'wagon', 'pickup'], pcar: ['sedan', 'hatchback', 'wagon'], van: ['van'], truck: ['truck'], bus: ['bus'] };
/** faded paint tints, multiplied over the model's own texture */
const TINT = [[1, 1, 1], [0.86, 0.9, 1], [1, 0.9, 0.8], [0.82, 0.88, 0.8], [0.74, 0.74, 0.76], [0.98, 0.86, 0.86], [0.92, 0.92, 0.86], [0.8, 0.8, 0.9]];

export const vehicles = { models: {}, loaded: 0, failed: 0, promise: null };

const hash = (a, b, k = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233 + k * 37.719) * 43758.5453; return h - Math.floor(h); };

/** Load and fit every model (once). Resolves when all have loaded or failed; never rejects. */
export function loadVehicles() {
    if (vehicles.promise) return vehicles.promise;
    const loader = new GLTFLoader();
    vehicles.promise = Promise.all(Object.keys(LEN).map((name) => loader.loadAsync(new URL(`../../models/${name}.glb`, import.meta.url).href).then((gltf) => {
        vehicles.models[name] = fit(name, gltf.scene);
        vehicles.loaded++;
    }, () => { vehicles.failed++; })));
    return vehicles.promise;
}

function fit(name, scene) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const alongX = size.x > size.z;
    const long = alongX ? size.x : size.z;
    const s = LEN[name] / long;
    // fit = scale · turn · (move the box centre to the origin, its floor to y = 0)
    const m = new THREE.Matrix4().makeScale(s, s, s)
        .multiply(new THREE.Matrix4().makeRotationY(alongX ? Math.PI / 2 : 0))
        .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
    const parts = [];
    scene.traverse((o) => {
        if (!o.isMesh) return;
        const mat = o.material;
        // weathered: no mirror shine, and emissive kept low so the bloom never catches a whole car
        if (mat.isMeshStandardMaterial) { mat.roughness = Math.max(mat.roughness ?? 0.5, 0.55); mat.envMapIntensity = 0.4; if (mat.emissive) mat.emissiveIntensity = Math.min(mat.emissiveIntensity ?? 1, 0.3); }
        parts.push({ geo: o.geometry, mat, matrix: new THREE.Matrix4().multiplyMatrices(m, o.matrixWorld) });
    });
    return { name, parts, size: [size.x * s, size.y * s, size.z * s] };
}

/** Which model a vehicle prop is drawn as (stable for its position), or null to draw the code-built one. */
export function modelFor(p) {
    if (p.model && vehicles.models[p.model]) return p.model;
    const list = KINDS[p.k]?.filter((n) => vehicles.models[n]);
    if (!list?.length) return null;
    return list[Math.floor(hash(p.x, p.z, 3) * list.length)];
}

const tmpA = new THREE.Matrix4(), tmpB = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();

/** Add the vehicles in list ({ k, x, y, z, r, c, flat }, world metres) to group as instanced meshes. */
export function addVehicles(group, list) {
    const by = new Map();
    for (const p of list) {
        const name = modelFor(p);
        if (!name) continue;
        if (!by.has(name)) by.set(name, []);
        by.get(name).push(p);
    }
    const col = new THREE.Color();
    for (const [name, ps] of by) {
        const M = vehicles.models[name];
        for (const part of M.parts) {
            const im = new THREE.InstancedMesh(part.geo, part.mat, ps.length);
            ps.forEach((p, i) => {
                const flat = p.flat ? 1 : 0;
                // a car on flat tyres sits low and leans toward a corner
                tmpE.set(flat * (hash(p.x, p.z, 7) - 0.5) * 0.06, p.r ?? 0, flat * (hash(p.z, p.x, 8) - 0.5) * 0.08, 'YXZ');
                tmpQ.setFromEuler(tmpE);
                at.set(p.x, (p.y ?? 0) - flat * 0.07, p.z);
                tmpA.compose(at, tmpQ, one);
                tmpB.multiplyMatrices(tmpA, part.matrix);
                im.setMatrixAt(i, tmpB);
                const t = TINT[(p.c ?? Math.floor(hash(p.x, p.z) * 8)) % TINT.length];
                const dust = 0.82 + (1 - (p.rust ?? 0.5)) * 0.18;
                im.setColorAt(i, col.setRGB(t[0] * dust, t[1] * dust, t[2] * dust));
            });
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            im.castShadow = true; im.receiveShadow = true;
            im.computeBoundingSphere();
            im.name = 'veh-' + name;
            im.userData.shared = true;
            group.add(im);
        }
    }
}

export const VEHICLE_KINDS = new Set(Object.keys(KINDS));
