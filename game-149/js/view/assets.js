// Meshy models in toon shading (from game-147). Every character and creature is a Meshy GLB (models/); this module
// loads them once, turns their materials into a three-step cel shade with an ink outline (an inverted hull that
// follows the skin of rigged characters), and makes Actors that play Meshy's animation clips.
//
// Rigged characters (RIGGED) have clips in models/anim/<name>-<clip>.glb, bound to the character by bone name.
// Creatures without a skeleton (Mochi, the wisps, the gargoyles) get procedural motion with the same clip names:
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
const HERO = ['idle', 'battleIdle', 'walk', 'run', 'attack', 'skill', 'hit', 'victory', 'faint', 'wave'];
export const RIGGED = {
    kai: HERO, hana: HERO, lys: HERO, pip: HERO, ren: HERO,
    veymont: ['idle', 'walk', 'run', 'wave'],
    hollow: ['battleIdle', 'walk', 'run', 'attack', 'skill', 'hit', 'faint', 'victory'],
    graves: ['idle', 'battleIdle', 'walk', 'run', 'attack', 'hit', 'victory'],
    theo: ['idle', 'walk', 'run', 'wave', 'faint'], yuki: ['idle', 'walk', 'run', 'wave', 'faint'],
    acolyte: ['battleIdle', 'walk', 'run', 'attack', 'hit', 'faint'], armor: ['battleIdle', 'walk', 'run', 'attack', 'hit', 'faint'],
};

// A three-step toon ramp, shared.
const RAMP = (() => {
    const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
})();
const INK = 0x3b2a33;

// A soft round contact shadow under characters, so they sit on the floor even where the sun's shadow falls behind them.
const BLOB = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(40,24,40,0.55)'); g.addColorStop(0.6, 'rgba(40,24,40,0.28)'); g.addColorStop(1, 'rgba(40,24,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
})();
const BLOB_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function blobShadow(r) {
    const m = new THREE.Mesh(BLOB_GEO, new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false }));
    m.scale.set(r * 2, 1, r * 2);
    m.position.y = 0.015;
    m.renderOrder = 1;
    return m;
}

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
            if (['attack', 'skill', 'chain'].includes(clip)) c.userData = { impact: impactTime(c) };
            return c;
        }).catch(() => null));
    }
    return clipCache.get(key);
}

/**
 * When a strike lands in an attack clip: the moment the arms and spine turn fastest (summed angular speed of their
 * bones, lightly smoothed, ignoring the first 8% and the last 10%). Meshy's library clips run 1.5–7 s with the blow
 * anywhere from 0.5 s to 2.4 s in, so a fixed delay put the damage before most swings connected.
 */
function impactTime(clip) {
    const tracks = clip.tracks.filter((t) => /(Arm|ForeArm|Hand|Spine\d*)\.quaternion$/.test(t.name));
    const base = tracks[0];
    if (!base) return clip.duration * 0.4;
    const n = base.times.length, sp = new Float32Array(n - 1);
    for (const t of tracks) {
        if (t.times.length !== n) continue;
        const v = t.values;
        for (let i = 0; i < n - 1; i++) {
            const d = Math.min(1, Math.abs(v[i * 4] * v[i * 4 + 4] + v[i * 4 + 1] * v[i * 4 + 5] + v[i * 4 + 2] * v[i * 4 + 6] + v[i * 4 + 3] * v[i * 4 + 7]));
            sp[i] += 2 * Math.acos(d) / Math.max(1e-4, t.times[i + 1] - t.times[i]);
        }
    }
    let best = -1, bt = clip.duration * 0.4;
    for (let i = 1; i < n - 2; i++) {
        const tm = (base.times[i] + base.times[i + 1]) / 2;
        if (tm < clip.duration * 0.08 || tm > clip.duration * 0.9) continue;
        const v = (sp[i - 1] + sp[i] + sp[i + 1]) / 3;
        if (v > best) { best = v; bt = tm; }
    }
    return bt;
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
        this.shadow = blobShadow(height * 0.3);
        this.root.add(this.shadow);
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

    /**
     * A one-shot: 'attack', 'skill', 'chain', 'hit', 'victory', 'faint', 'wave'. Returns its length in seconds and sets
     * lastImpact (when the blow lands, in seconds from now). maxImpact speeds a slow clip up so its blow lands by then.
     */
    play(clip, { hold = false, maxImpact = 0 } = {}) {
        const a = this.actions[clip];
        if (a) {
            const c = a.getClip(), impact = c.userData?.impact ?? c.duration * 0.4;
            const ts = maxImpact && impact > maxImpact ? impact / maxImpact : 1;
            a.reset(); a.timeScale = ts; a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play();
            if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, 0.12, false);
            this.cur = a;
            this.oneShot = hold ? null : a;
            this.lastImpact = impact / ts;
            return c.duration / ts;
        }
        // procedural stand-ins (the lunge is furthest forward half way through)
        const dur = { attack: 0.55, skill: 0.7, chain: 0.7, hit: 0.35, victory: 1.0, faint: 0.6, wave: 0.8 }[clip] || 0.5;
        this.proc = { t: 0, kind: clip, dur, hold, k: 0 };
        this.lastImpact = dur * 0.5;
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
        m.traverse((o) => { if (o.isMesh && !o.userData.outline) o.receiveShadow = true; });
        g.remove(ph);
        g.add(m);
        return true;
    });
    return g;
}

export { RAMP, fit };
