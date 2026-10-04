/**
 * board.js — fruit on the blanket. Keeps one view per fruit id, animates
 * idle life (bobbing, blinking, expressions), and plays the sim's events
 * back as a timeline of tweens: pops and flights into the basket, raking,
 * thawing, painting, golden growth, falling and refilling.
 *
 * After every timeline, sync() reconciles the views with the sim, so a
 * missed animation can never leave the picture out of step with the rules.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SIZES, COLOURS } from '../config.js';
import { makeFruitMesh, setFruitLook, mouthGeometry } from './fruit.js';
import { boardRoot, cellToWorld, BASKET_POS, addToBasket, bumpBasket } from './scene.js';

const LEAN = -0.5;
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeInOut = (k) => k * k * (3 - 2 * k);
const bounce = (k) => {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
};
const backOut = (k) => { const s = 2.2; k -= 1; return k * k * ((s + 1) * k + s) + 1; };

const iceMat = [
    new THREE.MeshStandardMaterial({ color: 0xd4f2ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }),
    new THREE.MeshStandardMaterial({ color: 0xeefaff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.68, depthWrite: false }),
];
const iceGeo = new RoundedBoxGeometry(0.9, 0.9, 0.9, 3, 0.16);
const leafCols = [0xd9822b, 0xe8b13a, 0xb8552a, 0x9aae3a, 0xe0682a];

function makeLeafPile(layers) {
    const g = new THREE.Group();
    const n = layers > 1 ? 11 : 7;
    for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 5), new THREE.MeshStandardMaterial({ color: leafCols[i % leafCols.length], roughness: 0.85 }));
        const a = i * 2.4, d = 0.12 + (i % 3) * 0.1;
        m.scale.set(1.25, 0.22, 0.7);
        const tier = i >= 7 ? 1 : 0;
        m.position.set(Math.cos(a) * d, 0.06 + (i % 3) * 0.05 + tier * 0.12, Math.sin(a) * d);
        m.rotation.set((i % 2 ? 0.3 : -0.2), a, (i % 3) * 0.2);
        m.castShadow = true;
        g.add(m);
    }
    // A cheeky acorn on top.
    const acorn = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0x9a6a32 }));
    acorn.position.set(0.05, layers > 1 ? 0.36 : 0.24, 0.05);
    acorn.scale.set(1, 1.2, 1);
    g.add(acorn);
    return g;
}

export class BoardView {
    constructor(fx) {
        this.fx = fx;
        this.views = new Map();      // id -> view
        this.leafMeshes = new Map(); // r*cols+c -> group
        this.iceMeshes = new Map();  // fruit id -> mesh
        this.tweens = [];
        this.time = 0;
        this.hooks = {};
        this.trail = new Set();
        this.cands = new Set();
        this.hint = null;
        this.hintT = 0;
        this.gentle = false;
        this.cols = 7;
        this._done = [];
        this._plays = [];
    }

    // ------------------------------------------------------------
    // Build & sync
    // ------------------------------------------------------------

    clear() {
        for (const v of this.views.values()) boardRoot.remove(v.root);
        for (const m of this.leafMeshes.values()) boardRoot.remove(m);
        for (const m of this.iceMeshes.values()) m.parent?.remove(m);
        this.views.clear();
        this.leafMeshes.clear();
        this.iceMeshes.clear();
        this.tweens.length = 0;
        this.trail.clear();
        this.cands.clear();
        this.hint = null;
        const done = [...this._done, ...this._plays];
        this._done = [];
        this._plays = [];
        done.forEach(fn => fn());
    }

    build(game, { dropIn = true } = {}) {
        this.clear();
        this.cols = game.cols;
        this.sync(game);
        if (dropIn) {
            for (const v of this.views.values()) {
                const delay = (game.rows - v.r) * 0.04 + v.c * 0.02 + Math.random() * 0.05;
                this._dropIn(v, delay, 3.5);
            }
        }
    }

    _makeView(fruit, r, c) {
        const scale = SIZES[fruit.size].scale;
        const fv = makeFruitMesh(fruit, scale);
        const v = {
            ...fv, id: fruit.id, r, c, scale, kind: fruit.kind, colour: fruit.colour, golden: fruit.golden,
            baseY: 0.43 * scale, phase: Math.random() * 6, blinkAt: this.time + 1 + Math.random() * 4, blinkT: 0,
            lift: 0, wobble: 0, pop: 0, mood: 'smile', moodOverride: null, flying: false, hold: false,
        };
        v.model.rotation.x = LEAN;
        v.model.position.y = v.baseY;
        cellToWorld(r, c, v.root.position);
        boardRoot.add(v.root);
        this.views.set(fruit.id, v);
        return v;
    }

    /** Make the views match the sim exactly (positions, looks, ice, leaves). */
    sync(game) {
        const seen = new Set();
        for (let r = 0; r < game.rows; r++) {
            for (let c = 0; c < game.cols; c++) {
                const cell = game.cells[r][c];
                const key = r * game.cols + c;
                // Leaves
                let lm = this.leafMeshes.get(key);
                if (cell.leaf > 0) {
                    if (!lm || lm.userData.layers !== cell.leaf) {
                        if (lm) boardRoot.remove(lm);
                        lm = makeLeafPile(cell.leaf);
                        lm.userData.layers = cell.leaf;
                        cellToWorld(r, c, lm.position);
                        boardRoot.add(lm);
                        this.leafMeshes.set(key, lm);
                    }
                } else if (lm) {
                    boardRoot.remove(lm);
                    this.leafMeshes.delete(key);
                }
                // Fruit
                const f = cell.fruit;
                if (!f) continue;
                seen.add(f.id);
                let v = this.views.get(f.id);
                if (!v) v = this._makeView(f, r, c);
                if (!v.flying) {
                    v.r = r; v.c = c;
                    cellToWorld(r, c, v.root.position);
                    v.root.visible = true;
                    v.model.scale.setScalar(v.scale);
                }
                if (v.colour !== f.colour || v.golden !== f.golden) {
                    setFruitLook(v, f);
                    v.colour = f.colour; v.golden = f.golden;
                }
                this._setIce(v, f.frost);
            }
        }
        for (const [id, v] of this.views) {
            if (!seen.has(id) && !v.flying) {
                boardRoot.remove(v.root);
                this.views.delete(id);
                const ice = this.iceMeshes.get(id);
                if (ice) { ice.parent?.remove(ice); this.iceMeshes.delete(id); }
            }
        }
    }

    _setIce(v, layers) {
        let ice = this.iceMeshes.get(v.id);
        if (layers > 0) {
            if (!ice) {
                ice = new THREE.Mesh(iceGeo, iceMat[0]);
                ice.position.y = 0.45;
                ice.renderOrder = 1;
                v.root.add(ice);
                this.iceMeshes.set(v.id, ice);
            }
            ice.material = iceMat[Math.min(1, layers - 1)];
            ice.scale.setScalar(layers > 1 ? 1.04 : 0.98);
        } else if (ice) {
            ice.parent?.remove(ice);
            this.iceMeshes.delete(v.id);
        }
    }

    viewAt(r, c) {
        for (const v of this.views.values()) if (!v.flying && v.r === r && v.c === c) return v;
        return null;
    }

    // ------------------------------------------------------------
    // Tweens
    // ------------------------------------------------------------

    tween(delay, dur, fn, { start, done } = {}) {
        this.tweens.push({ t: -delay, dur: Math.max(0.0001, dur), fn, start, done, started: false });
    }

    get busy() { return this.tweens.length > 0; }

    /** Resolve when the current tweens finish. */
    idle() {
        if (!this.busy) return Promise.resolve();
        return new Promise(res => this._done.push(res));
    }

    _stepTweens(dt) {
        for (let i = 0; i < this.tweens.length; i++) {
            const tw = this.tweens[i];
            tw.t += dt;
            if (tw.t < 0) continue;
            if (!tw.started) { tw.started = true; tw.start?.(); }
            const k = Math.min(1, tw.t / tw.dur);
            tw.fn?.(k);
            if (k >= 1) {
                tw.done?.();
                this.tweens.splice(i, 1);
                i--;
            }
        }
        if (!this.tweens.length && this._done.length) {
            const done = this._done;
            this._done = [];
            done.forEach(fn => fn());
        }
    }

    /** Run every pending tween to completion right now (tests, skipping). */
    fastForward() {
        let guard = 0;
        while (this.tweens.length && guard++ < 4000) this.update(1 / 30);
    }

    // ------------------------------------------------------------
    // Event playback
    // ------------------------------------------------------------

    /** Schedule a whole event list; resolves after sync() once animations end. */
    play(events, game) {
        let t = 0;
        const H = this.hooks;
        const world = new THREE.Vector3();
        for (const ev of events) {
            switch (ev.type) {
                case 'harvest': {
                    const n = ev.items.length;
                    let order = ev.items;
                    let stagger = Math.min(0.075, 0.9 / Math.max(1, n));
                    if (ev.source !== 'chain') {
                        const cx = ev.c ?? 3, cr = ev.r ?? 3.5;
                        order = [...ev.items].sort((a, b) => Math.hypot(a.r - cr, a.c - cx) - Math.hypot(b.r - cr, b.c - cx));
                        stagger = ev.source === 'bomb' ? 0.025 : Math.min(0.05, 0.7 / Math.max(1, n));
                    }
                    if (ev.source === 'chain') H.chainStart?.(ev, stagger, t);
                    if (ev.source === 'bomb') {
                        cellToWorld(ev.r, ev.c, world);
                        const w = world.clone();
                        this.tween(t, 0.01, null, { start: () => { this.fx.shockwave(w, 0xfff2a0, 3.2); H.bomb?.(); } });
                    }
                    if (ev.source === 'honey') this.tween(t, 0.01, null, { start: () => H.honey?.() });
                    order.forEach((it, i) => this._harvestOne(it, t + i * stagger, i, n, ev.source));
                    t += n * stagger + 0.12;
                    break;
                }
                case 'leaf': {
                    const key = ev.r * this.cols + ev.c;
                    const left = ev.left;
                    this.tween(t, 0.3, (k) => {
                        const lm = this.leafMeshes.get(key);
                        if (!lm) return;
                        const s = left > 0 ? 1 - 0.25 * Math.sin(k * Math.PI) : 1 - k;
                        lm.scale.set(s, s, s);
                    }, {
                        start: () => { cellToWorld(ev.r, ev.c, world); this.fx.leaves(world.clone(), left > 0 ? 8 : 16); H.leaf?.(left); },
                        done: () => {
                            const lm = this.leafMeshes.get(key);
                            if (!lm) return;
                            if (left <= 0) { boardRoot.remove(lm); this.leafMeshes.delete(key); }
                            else {
                                boardRoot.remove(lm);
                                const nm = makeLeafPile(left); nm.userData.layers = left;
                                nm.position.copy(lm.position); boardRoot.add(nm); this.leafMeshes.set(key, nm);
                            }
                        },
                    });
                    break;
                }
                case 'thaw': {
                    const id = ev.id, left = ev.left;
                    this.tween(t, 0.28, (k) => {
                        const ice = this.iceMeshes.get(id);
                        if (!ice) return;
                        ice.scale.setScalar(left > 0 ? 1 + 0.12 * Math.sin(k * Math.PI) : 1 + k * 0.3);
                        if (left <= 0) ice.material.opacity = 0.5 * (1 - k);
                    }, {
                        start: () => {
                            cellToWorld(ev.r, ev.c, world); this.fx.ice(world.clone(), left > 0 ? 8 : 16); H.thaw?.(left);
                            const ice = this.iceMeshes.get(id);
                            if (ice && left <= 0) ice.material = ice.material.clone();
                        },
                        done: () => {
                            const v = this.views.get(id);
                            if (v) { this._setIce(v, left); if (left <= 0) v.wobble = 1; }
                        },
                    });
                    break;
                }
                case 'paint': {
                    cellToWorld(ev.r, ev.c, world);
                    const center = world.clone();
                    this.tween(t, 0.01, null, { start: () => { this.fx.splash(center, COLOURS[ev.colour].hex, 22, 1.3); H.paint?.(); } });
                    ev.items.forEach((it, i) => {
                        this.tween(t + 0.08 + i * 0.04, 0.3, (k) => {
                            const v = this.views.get(it.id);
                            if (v) v.wobble = 1 - k;
                        }, {
                            start: () => {
                                const v = this.views.get(it.id);
                                if (!v) return;
                                setFruitLook(v, { kind: v.kind, colour: it.colour, golden: false });
                                v.colour = it.colour;
                                const p = new THREE.Vector3(); cellToWorld(it.r, it.c, p);
                                this.fx.splash(p, COLOURS[it.colour].hex, 6, 0.6);
                            },
                        });
                    });
                    t += 0.15 + ev.items.length * 0.04;
                    break;
                }
                case 'golden': {
                    const f = ev.fruit;
                    this.tween(t, 0.45, (k) => {
                        const v = this.views.get(f.id);
                        if (v) v.model.scale.setScalar(v.scale * backOut(k));
                    }, {
                        start: () => {
                            const v = this._makeView(f, ev.r, ev.c);
                            v.model.scale.setScalar(0.001);
                            cellToWorld(ev.r, ev.c, world);
                            this.fx.sparkle(world.clone(), 0xffe066, 22, 0.8);
                            H.golden?.();
                        },
                    });
                    t += 0.3;
                    break;
                }
                case 'settle': {
                    let longest = 0;
                    for (const m of ev.moves) {
                        const dist = m.r - m.fromR;
                        const dur = 0.2 + dist * 0.045;
                        longest = Math.max(longest, dur);
                        const from = new THREE.Vector3(), to = new THREE.Vector3();
                        this.tween(t, dur, (k) => {
                            const v = this.views.get(m.id);
                            if (!v || v.flying) return;
                            const e = bounce(k);
                            v.root.position.lerpVectors(from, to, e);
                        }, {
                            start: () => {
                                const v = this.views.get(m.id);
                                if (!v) return;
                                from.copy(v.root.position); cellToWorld(m.r, m.c, to);
                                v.r = m.r; v.c = m.c;
                            },
                        });
                    }
                    for (const s of ev.spawns) {
                        const delay = t + (-1 - s.fromR) * 0.07 + s.c * 0.015;
                        const dur = 0.38;
                        longest = Math.max(longest, delay - t + dur);
                        this.tween(delay, 0.001, null, {
                            start: () => {
                                if (this.views.has(s.fruit.id)) return;
                                const v = this._makeView(s.fruit, s.r, s.c);
                                this._dropIn(v, 0, 3.2, dur);
                            },
                        });
                    }
                    t += longest;
                    break;
                }
                case 'shuffle': {
                    this.tween(t, 0.01, null, { start: () => H.shuffle?.() });
                    for (const it of ev.items) {
                        const from = new THREE.Vector3(), to = new THREE.Vector3();
                        this.tween(t, 0.6, (k) => {
                            const v = this.views.get(it.id);
                            if (!v) return;
                            const e = easeInOut(k);
                            v.root.position.lerpVectors(from, to, e);
                            v.root.position.y = Math.sin(k * Math.PI) * 1.4;
                        }, {
                            start: () => {
                                const v = this.views.get(it.id);
                                if (!v) return;
                                from.copy(v.root.position); cellToWorld(it.r, it.c, to);
                                v.r = it.r; v.c = it.c;
                            },
                        });
                    }
                    t += 0.65;
                    break;
                }
                case 'basket': {
                    this.tween(t, 0.01, null, { start: () => { this.fx.confetti(BASKET_POS.clone().setZ(0), 70); H.basket?.(ev.n); } });
                    break;
                }
                default: break;
            }
        }
        return new Promise(res => {
            const finish = () => {
                const i = this._plays.indexOf(finish);
                if (i < 0) return;
                this._plays.splice(i, 1);
                res();
            };
            this._plays.push(finish);
            this.tween(t, 0.01, null, { done: () => { this.sync(game); finish(); } });
        });
    }

    _dropIn(v, delay, height, dur = 0.45) {
        v.root.visible = false;
        const to = new THREE.Vector3();
        this.tween(delay, dur, (k) => {
            v.root.position.y = (1 - bounce(k)) * height;
        }, {
            start: () => { v.root.visible = true; cellToWorld(v.r, v.c, to); v.root.position.set(to.x, height, to.z); },
            done: () => { v.root.position.y = 0; v.wobble = 0.6; this.hooks.land?.(); },
        });
    }

    _harvestOne(it, delay, i, n, source) {
        const v = this.views.get(it.id);
        if (!v) return;
        v.flying = true;
        const start = new THREE.Vector3();
        const ctrl = new THREE.Vector3();
        const end = BASKET_POS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.6, (Math.random() - 0.5) * 0.3));
        const colour = v.golden ? 0xffd040 : COLOURS[v.colour]?.hex ?? 0xffffff;
        // Pop: swell and say "oh!"
        this.tween(delay, 0.1, (k) => {
            v.model.scale.setScalar(v.scale * (1 + 0.3 * Math.sin(k * Math.PI * 0.5)));
        }, {
            start: () => {
                v.mouth.geometry = mouthGeometry('oh');
                v.eyes.scale.y = 1;
                start.copy(v.root.position);
                ctrl.set((start.x + end.x) / 2, 3.2, (start.z + end.z) / 2 - 0.5);
                const p = start.clone();
                this.fx.splash(p, colour, source === 'chain' ? 10 : 7, 0.9);
                if (v.golden) this.fx.sparkle(p, 0xffe066, 14, 0.6);
                this.hooks.pop?.(i, n, it.fruit, source);
            },
        });
        // Fly into the basket.
        const flight = 0.5 + Math.random() * 0.12;
        this.tween(delay + 0.1, flight, (k) => {
            const e = easeInOut(k);
            const a = 1 - e;
            v.root.position.set(
                a * a * start.x + 2 * a * e * ctrl.x + e * e * end.x,
                a * a * start.y + 2 * a * e * ctrl.y + e * e * end.y,
                a * a * start.z + 2 * a * e * ctrl.z + e * e * end.z,
            );
            v.model.scale.setScalar(v.scale * (1.3 - 0.75 * e));
            v.model.rotation.z = e * 4;
        }, {
            done: () => {
                boardRoot.remove(v.root);
                this.views.delete(v.id);
                const ice = this.iceMeshes.get(v.id);
                if (ice) { ice.parent?.remove(ice); this.iceMeshes.delete(v.id); }
                v.model.rotation.set(0, 0, 0);
                v.model.position.y = 0;
                v.mouth.geometry = mouthGeometry('happy');
                addToBasket(v.model);
                bumpBasket(1);
                if (i === n - 1 || i % 3 === 0) this.hooks.land?.(true);
            },
        });
    }

    // ------------------------------------------------------------
    // Selection & hint
    // ------------------------------------------------------------

    setTrail(path, cands) {
        this.trail.clear();
        this.cands.clear();
        for (const [r, c] of path) { const v = this.viewAt(r, c); if (v) this.trail.add(v.id); }
        for (const [r, c] of cands) { const v = this.viewAt(r, c); if (v) this.cands.add(v.id); }
    }

    clearTrail() { this.trail.clear(); this.cands.clear(); }

    setHint(path) {
        this.hint = path ? path.map(([r, c]) => this.viewAt(r, c)?.id).filter(Boolean) : null;
        this.hintT = 0;
    }

    nudge(r, c) {
        const v = this.viewAt(r, c);
        if (v) { v.wobble = 1; v.moodOverride = 'worried'; v.moodUntil = this.time + 0.5; }
    }

    // ------------------------------------------------------------
    // Per-frame
    // ------------------------------------------------------------

    update(dt) {
        this.time += dt;
        this._stepTweens(dt);
        const t = this.time;
        const gentle = this.gentle ? 0.35 : 1;
        this.hintT += dt;
        for (const v of this.views.values()) {
            if (v.flying) continue;
            const inTrail = this.trail.has(v.id);
            const isCand = this.cands.has(v.id);
            const frozen = this.iceMeshes.has(v.id);
            let hintLift = 0;
            if (this.hint) {
                const idx = this.hint.indexOf(v.id);
                if (idx >= 0) {
                    const ph = (this.hintT * 2.2 - idx * 0.35) % (this.hint.length * 0.35 + 1.4);
                    if (ph > 0 && ph < 0.6) hintLift = Math.sin((ph / 0.6) * Math.PI) * 0.25;
                }
            }
            const liftTarget = inTrail ? 0.18 : hintLift;
            v.lift += (liftTarget - v.lift) * Math.min(1, dt * 14);
            v.wobble = Math.max(0, v.wobble - dt * 2.2);
            const bob = frozen ? 0 : Math.sin(t * 2.2 + v.phase) * 0.025 * gentle;
            v.model.position.y = v.baseY + bob + v.lift;
            const sq = frozen ? 1 : 1 + Math.sin(t * 2.2 + v.phase + 1) * 0.02 * gentle;
            const sel = inTrail ? 1.13 : isCand ? 1.04 : 1;
            v.model.scale.set(v.scale * sel * (2 - sq), v.scale * sel * sq, v.scale * sel * (2 - sq));
            v.model.rotation.z = Math.sin(t * 22) * 0.18 * v.wobble + (isCand ? Math.sin(t * 6 + v.phase) * 0.06 : 0);
            v.model.rotation.x = LEAN + (inTrail ? 0.15 : 0);

            // Blink
            if (t > v.blinkAt) { v.blinkT = 0.13; v.blinkAt = t + 2 + Math.random() * 4; }
            if (v.blinkT > 0) v.blinkT -= dt;
            v.eyes.scale.y = v.blinkT > 0 ? 0.15 : 1;
            // Mood
            if (v.moodUntil && t > v.moodUntil) { v.moodOverride = null; v.moodUntil = 0; }
            const mood = v.moodOverride ?? (frozen ? 'worried' : inTrail ? 'happy' : 'smile');
            if (mood !== v.mood) { v.mood = mood; v.mouth.geometry = mouthGeometry(mood); }
        }
    }
}
