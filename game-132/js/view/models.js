// Meshy models (assets/models/<name>.glb, see dev/assets/README.md) with code-built stand-ins.
// model(name, h, stand) returns a Group at once with the stand-in inside; when the GLB loads it replaces the
// stand-in, scaled to stand h metres tall with its feet on y = 0. Rigged models get an AnimationMixer and their walk.
// ?models=0 keeps the stand-ins.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { MODEL_FILES, ANIM_FILES } from '../model-files.js';

const loader = new GLTFLoader();
const cache = {};
export const useModels = new URLSearchParams(location.search).get('models') !== '0';
export const modelState = { wanted: 0, loaded: 0, failed: 0 };

function load(name) {
    if (!cache[name]) {
        modelState.wanted++;
        cache[name] = new Promise((res) => {
            loader.load(`assets/models/${name}.glb`, (g) => {
                modelState.loaded++;
                g.scene.traverse((o) => {
                    if (o.isMesh) {
                        o.castShadow = false; o.receiveShadow = false;
                        if (o.material) { o.material.roughness = Math.max(0.55, o.material.roughness ?? 1); o.material.metalness = Math.min(0.3, o.material.metalness ?? 0); }
                        o.frustumCulled = !o.isSkinnedMesh;
                    }
                });
                const box = new THREE.Box3().setFromObject(g.scene);
                res({ scene: g.scene, anims: g.animations, h: box.max.y - box.min.y || 1, minY: box.min.y, skinned: g.animations.length > 0 });
            }, undefined, () => { modelState.failed++; res(null); });
        });
    }
    return cache[name];
}

const clips = {};
/** An attack clip from assets/anims/<name>.glb (bones only; played on the model already loaded). */
function loadClip(name) {
    clips[name] ||= new Promise((res) => loader.load(`assets/anims/${name}.glb`, (g) => res(g.animations[0] || null), undefined, () => res(null)));
    return clips[name];
}

/**
 * A model group. opts: { stand: () => Object3D (the stand-in), tint: hex (a ghost colour), opacity }.
 * The group's userData gets { mixer, walk } once a rigged model loads.
 */
export function model(name, h, opts = {}) {
    const g = new THREE.Group();
    const stand = opts.stand ? opts.stand() : capsule(h, opts.color ?? 0x888888);
    g.add(stand);
    g.userData.h = h;
    if (!useModels || !MODEL_FILES.has(name)) return g;
    load(name).then((m) => {
        if (!m || g.userData.disposed) return;
        const obj = m.skinned ? SkeletonUtils.clone(m.scene) : m.scene.clone(true);
        const s = h / m.h;
        obj.scale.setScalar(s);
        obj.position.y = -m.minY * s;
        // each copy gets its own materials, so a hit flash on one monster doesn't light up all of its kind
        obj.traverse((o) => { if (o.isMesh && o.material) o.material = o.material.clone(); });
        if (opts.tint != null) {
            obj.traverse((o) => {
                if (!o.isMesh) return;
                o.material = new THREE.MeshStandardMaterial({ color: opts.tint, emissive: opts.tint, emissiveIntensity: 0.6, transparent: true, opacity: opts.opacity ?? 0.55, depthWrite: false });
                o.material.userData.ghost = true;
            });
        }
        g.remove(stand);
        g.add(obj);
        g.userData.loaded = true;
        if (m.skinned) {
            const mixer = new THREE.AnimationMixer(obj);
            const walk = mixer.clipAction(m.anims[0]);
            walk.play();
            g.userData.mixer = mixer; g.userData.walk = walk; g.userData.clipLen = m.anims[0].duration;
            if (ANIM_FILES.has(name)) loadClip(name).then((clip) => {
                if (!clip || g.userData.disposed) return;
                const atk = mixer.clipAction(clip);
                atk.setLoop(THREE.LoopOnce, 1);
                atk.clampWhenFinished = false;
                g.userData.attack = atk; g.userData.attackLen = clip.duration;
            });
        }
    });
    return g;
}

export function capsule(h, color) {
    const g = new THREE.Group();
    const r = Math.max(0.2, h * 0.18);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.1, h - 2 * r), 4, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    body.position.y = h / 2;
    g.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    eye.position.set(0, h * 0.8, r * 0.85);
    g.add(eye);
    return g;
}

export function preload(names) { for (const n of names) if (useModels && MODEL_FILES.has(n)) load(n); }
