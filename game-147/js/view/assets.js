// Meshy models in toon shading. Every character, monster, item and piece of furniture is a Meshy GLB (models/); this
// module loads them once, turns their materials into a three-step cel shade with an ink outline (an inverted hull
// that follows the skin of rigged characters), and makes Actors that play Meshy's animation clips.
//
// Rigged characters (RIGGED) have clips in models/anim/<name>-<clip>.glb, bound to the character by bone name.
// Creatures without a skeleton (blobs, a snail, a bat, a hedgehog) get procedural motion with the same clip names:
// idle bob, a hop-forward attack, a squash on hit, a flattening faint.
//
// Until a model has loaded, or if one fails to, a simple coloured capsule stands in, so the game never waits.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();          // name → Promise<gltf | null>
const clipCache = new Map();      // name-clip → Promise<AnimationClip | null>

// Which models are rigged, and which clips each has (walk and run come with every rig).
const HERO_CLIPS = ['idle', 'battleIdle', 'walk', 'run', 'attack', 'skill', 'chain', 'hit', 'victory', 'faint', 'wave'];
const MON_CLIPS = ['battleIdle', 'walk', 'run', 'attack', 'hit', 'faint'];
export const RIGGED = {
    maple: HERO_CLIPS, ember: HERO_CLIPS, kit: HERO_CLIPS, fern: HERO_CLIPS, bru: HERO_CLIPS,
    goldmaw: ['idle', 'walk', 'run', 'wave'],
    'guest-merchant': ['idle', 'walk', 'run', 'wave'], 'guest-noble': ['idle', 'walk', 'run', 'wave'], 'guest-adventurer': ['idle', 'walk', 'run', 'wave'],
    pebblegolem: MON_CLIPS, grandmorel: [...MON_CLIPS, 'skill'], molequeen: [...MON_CLIPS, 'skill'],
};

// A three-step toon ramp, shared.
const RAMP = (() => {
    const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
})();
const INK = 0x3b2a33;

export function loadModel(name) {
    if (!cache.has(name)) {
        cache.set(name, loader.loadAsync(`models/${name}.glb`).catch((e) => { console.warn('[model]', name, e.message); return null; }));
    }
    return cache.get(name);
}

function loadClip(name, clip) {
    const key = `${name}-${clip}`;
    if (!clipCache.has(key)) {
        clipCache.set(key, loader.loadAsync(`models/anim/${key}.glb`).then((g) => {
            const c = g.animations[0];
            if (!c) return null;
            c.name = clip;
            // keep the character where the game puts it: drop root translation on the hips except up/down
            for (const tr of c.tracks) {
                if (/Hips\.position$/i.test(tr.name) && clip !== 'faint') {
                    const v = tr.values, x0 = v[0], z0 = v[2];
                    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
                }
            }
            return c;
        }).catch(() => null));
    }
    return clipCache.get(key);
}

/** Toon materials and an outline on every mesh under root. thickness is in the model's own units. */
export function toonify(root, thickness) {
    const meshes = [];
    root.traverse((o) => { if (o.isMesh && !o.userData.outline) meshes.push(o); });
    for (const o of meshes) {
        const old = o.material;
        const map = old.map || null;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
        o.material = new THREE.MeshToonMaterial({ map, color: map ? 0xffffff : (old.color || new THREE.Color(0xdddddd)), gradientMap: RAMP });
        o.castShadow = true;
        const mat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
        mat.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `transformed += normalize(normal) * ${thickness.toFixed(5)};\n#include <project_vertex>`);
        };
        let ol;
        if (o.isSkinnedMesh) { ol = new THREE.SkinnedMesh(o.geometry, mat); ol.bind(o.skeleton, o.bindMatrix); }
        else ol = new THREE.Mesh(o.geometry, mat);
        ol.userData.outline = true;
        ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
        ol.renderOrder = -1;
        o.parent.add(ol);
    }
}

/** A coloured stand-in while a model loads. */
function placeholder(color = 0xffc0cb, h = 1) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.22, h * 0.5, 4, 10), new THREE.MeshToonMaterial({ color, gradientMap: RAMP }));
    m.position.y = h * 0.47;
    g.add(m);
    return g;
}

/** Fit a model: height h, feet on y = 0, centred on x/z. Returns the scale used. */
function fit(obj, h) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const s = h / Math.max(1e-3, size.y);
    obj.scale.multiplyScalar(s);
    obj.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    return s;
}

/**
 * A character or creature on stage. actor.root is added to the scene at once (a placeholder first); the model and
 * its clips arrive when loaded. play(name) crossfades to a clip; a one-shot returns to the base pose after.
 */
export class Actor {
    constructor(name, { height = 1, color, face = 0 } = {}) {
        this.name = name;
        this.height = height;
        this.root = new THREE.Group();
        this.holder = new THREE.Group();          // procedural motion goes here, never on root (the game moves root)
        this.root.add(this.holder);
        this.holder.rotation.y = face;
        this.ph = placeholder(color, height);
        this.holder.add(this.ph);
        this.mixer = null;
        this.actions = {};
        this.base = 'idle';
        this.cur = null;
        this.proc = { t: 0, kind: 'idle', k: 0, dur: 0 };
        this.rigged = !!RIGGED[name];
        this.flash = 0;
        this.ready = this._load();
    }

    async _load() {
        const g = await loadModel(this.name);
        if (!g) return false;
        const model = this.rigged ? skClone(g.scene) : g.scene.clone(true);
        const s = fit(model, this.height);
        toonify(model, 0.016 * this.height / s);
        this.holder.remove(this.ph);
        this.holder.add(model);
        this.model = model;
        this.mats = [];
        model.traverse((o) => { if (o.isMesh && !o.userData.outline) this.mats.push(o.material); });
        if (this.rigged) {
            this.mixer = new THREE.AnimationMixer(model);
            this.mixer.addEventListener('finished', (e) => { if (e.action === this.oneShot) { this.oneShot = null; this._fadeTo(this.base); } });
            const names = RIGGED[this.name];
            await Promise.all(names.map(async (c) => {
                const clip = await loadClip(this.name, c);
                if (clip) this.actions[c] = this.mixer.clipAction(clip);
            }));
            this._fadeTo(this.base, 0);
        }
        return true;
    }

    has(clip) { return !!this.actions[clip]; }

    _fadeTo(clip, dur = 0.2) {
        const a = this.actions[clip] || this.actions.idle || this.actions.battleIdle;
        if (!a || a === this.cur) return;
        a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.play();
        if (this.cur) this.cur.crossFadeTo(a, dur, false);
        this.cur = a;
    }

    /** Set the looping pose: 'idle', 'battleIdle', 'walk' or 'run'. */
    setBase(clip) {
        this.base = clip;
        if (!this.oneShot) this._fadeTo(clip);
        if (!this.rigged) this.proc.kind = clip === 'walk' || clip === 'run' ? 'walk' : 'idle';
    }

    /** A one-shot: 'attack', 'skill', 'chain', 'hit', 'victory', 'faint', 'wave'. Returns its length in seconds. */
    play(clip, { hold = false } = {}) {
        const a = this.actions[clip];
        if (a) {
            a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play();
            if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, 0.12, false);
            this.cur = a;
            this.oneShot = hold ? null : a;
            return a.getClip().duration;
        }
        // procedural stand-ins
        const dur = { attack: 0.55, skill: 0.7, chain: 0.7, hit: 0.35, victory: 1.0, faint: 0.6, wave: 0.8 }[clip] || 0.5;
        this.proc = { t: 0, kind: clip, dur, hold, k: 0 };
        return dur;
    }

    hitFlash() { this.flash = 1; }

    update(dt) {
        if (this.mixer) this.mixer.update(dt);
        const p = this.proc;
        p.t += dt;
        const h = this.holder;
        h.position.set(0, 0, 0); h.scale.set(1, 1, 1); h.rotation.x = 0; h.rotation.z = 0;
        if (!this.rigged || !this.model) {
            const u = p.dur ? Math.min(1, p.t / p.dur) : 0;
            const bob = Math.sin(p.t * 3.2) * 0.04;
            if (p.kind === 'idle' || (p.dur && u >= 1 && !p.hold)) {
                h.scale.set(1 + bob * 0.6, 1 - bob, 1 + bob * 0.6);
                if (p.dur && u >= 1 && !p.hold) this.proc = { t: 0, kind: this.base === 'walk' || this.base === 'run' ? 'walk' : 'idle', dur: 0, k: 0 };
            } else if (p.kind === 'walk') {
                h.position.y = Math.abs(Math.sin(p.t * 9)) * 0.12 * this.height;
                h.rotation.z = Math.sin(p.t * 9) * 0.08;
            } else if (p.kind === 'attack' || p.kind === 'skill' || p.kind === 'chain') {
                const k = Math.sin(u * Math.PI);
                h.position.z = k * 0.45 * this.height;
                h.position.y = k * 0.25 * this.height;
                h.scale.set(1 + k * 0.15, 1 - k * 0.1, 1 + k * 0.15);
            } else if (p.kind === 'hit') {
                const k = Math.sin(u * Math.PI);
                h.scale.set(1 + k * 0.25, 1 - k * 0.3, 1 + k * 0.25);
                h.position.z = -k * 0.15;
            } else if (p.kind === 'faint') {
                h.scale.set(1 + u * 0.4, Math.max(0.12, 1 - u * 0.88), 1 + u * 0.4);
            } else if (p.kind === 'victory' || p.kind === 'wave') {
                h.position.y = Math.abs(Math.sin(u * Math.PI * 3)) * 0.3 * this.height;
            }
        }
        if (this.mats) {
            this.flash = Math.max(0, this.flash - dt * 4);
            for (const m of this.mats) m.emissive?.setScalar(this.flash * 0.6);
        }
    }
}

/** A static prop (an item or furniture), fitted to a height and toon shaded. Returns a group at once. */
export function prop(name, height, { color = 0xd8c3a5 } = {}) {
    const g = new THREE.Group();
    const ph = new THREE.Mesh(new THREE.BoxGeometry(height * 0.6, height, height * 0.6), new THREE.MeshToonMaterial({ color, gradientMap: RAMP }));
    ph.position.y = height / 2;
    g.add(ph);
    g.userData.ready = loadModel(name).then((gl) => {
        if (!gl) return false;
        const m = gl.scene.clone(true);
        const s = fit(m, height);
        toonify(m, 0.012 * height / s);
        g.remove(ph);
        g.add(m);
        return true;
    });
    return g;
}

export { RAMP, fit };
