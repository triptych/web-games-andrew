// The three.js view. Reads G every frame, answers sim events, never writes G.
//
// Streaming: the city is built a block (chunk) at a time around the walker; interiors a building level at a time for
// the buildings nearby, all of them for the one you are in. The window panes in the shells turn clear as the rooms
// behind them come into being. One chunk or one level is built per frame, nearest first.

import * as THREE from 'three';
import { TILE, PLAYER, LEVERS } from '../config.js';
import { Stage } from './stage.js';
import { buildChunk, CHUNK, markBuilt, clearBuilt, panes, fence } from './citymesh.js';
import { buildLevel } from './interiormesh.js';
import { interiorOf } from '../sim/interior.js';
import { tileAt } from '../sim/world.js';
import { Fx } from './fx.js';
import { Kit, disposeGroup } from './kit.js';
import { plain } from './tex.js';
import { buildProp } from './props.js';

const LEVER_RGB = { amber: [1.4, 0.75, 0.1], violet: [0.7, 0.25, 1.3], green: [0.25, 1.2, 0.35], white: [1.3, 1.3, 1.25] };

export class View {
    constructor(canvas, quality = 'medium') {
        this.canvas = canvas;
        this.stage = new Stage(canvas, quality);
        this.scene = this.stage.scene;
        this.camera = this.stage.camera;
        this.fx = new Fx(this.scene);
        this.world = new THREE.Group(); this.scene.add(this.world);
        this.chunks = new Map(); this.levels = new Map(); this.things = new Map();
        this.G = null;
        this.camY = 0; this.bob = 0; this.bobAmp = 0; this.shake = 0; this.flashOn = true;
        this.lastLights = 0; this.lastInterior = 0;
        this.lightList = [];
        const onResize = () => this.stage.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    /** Throw away everything from the last city and get ready for G's. */
    setGame(G) {
        for (const c of this.chunks.values()) disposeGroup(c.group);
        for (const l of this.levels.values()) disposeGroup(l.group);
        for (const t of this.things.values()) disposeGroup(t);
        this.chunks.clear(); this.levels.clear(); this.things.clear();
        clearBuilt();
        this.G = G;
        this.camY = G.p.y + PLAYER.eye;
        const hall = G.city.buildings[G.city.lab.hall], HI = interiorOf(G.city, hall);
        const ring = HI.levels[0].ring;
        this.ringPos = new THREE.Vector3(HI.x0 + (ring.x + 0) * TILE, 5.2, HI.z0 + (ring.z + 0.5) * TILE);
        this.fx.setRing(this.ringPos.x, this.ringPos.y, this.ringPos.z);
        this.gateBuilt = null;
        this.pending = true;
    }

    /** Build what is near the walker right now, all at once (behind a loading screen). */
    warm(G, budgetMs = 2500) {
        const t0 = performance.now();
        this.update(G, 0, true);
        while (performance.now() - t0 < budgetMs && this.streamOne(G, true)) { /* build */ }
        this.pending = false;
    }

    // ------------------------------------------------------------------ streaming

    wanted(G) {
        const p = G.p, C = G.city;
        const ci = Math.floor(p.x / TILE / CHUNK), cj = Math.floor(p.z / TILE / CHUNK);
        const chunks = [];
        const span = Math.ceil((C.n + CHUNK - 1) / CHUNK);
        for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
            const i = ci + di, j = cj + dj;
            if (i < 0 || j < 0 || i >= span || j >= span) continue;
            const cx = (i + 0.5) * CHUNK * TILE, cz = (j + 0.5) * CHUNK * TILE;
            const d = Math.hypot(cx - p.x, cz - p.z);
            if (d < 230) chunks.push({ key: i + ',' + j, i, j, d });
        }
        chunks.sort((a, b) => a.d - b.d);
        // interiors
        const here = tileAt(C, p.L, Math.floor(p.x / TILE), Math.floor(p.z / TILE))?.b;
        const levels = [];
        const R = 46;
        const tx = p.x / TILE, tz = p.z / TILE;
        for (const b of C.buildings) {
            const dx = Math.max(b.x0 - tx, 0, tx - (b.x0 + b.w)), dz = Math.max(b.z0 - tz, 0, tz - (b.z0 + b.d));
            const d = Math.hypot(dx, dz) * TILE;
            if (d > R && b !== here) continue;
            let Ls;
            if (b === here) { Ls = []; for (let L = 0; L < b.floors; L++) if (b.floors <= 3 || Math.abs(L - p.L) <= 2) Ls.push(L); }
            else if (d < 16) Ls = [...Array(Math.min(b.floors, 3)).keys()];
            else Ls = [0];
            for (const L of Ls) levels.push({ key: b.id + ':' + L, b, L, d: d + Math.abs(L - p.L) * 6 });
        }
        levels.sort((a, b) => a.d - b.d);
        return { chunks, levels };
    }

    update(G, dt, force = false) {
        const now = performance.now();
        if (!force && now - this.lastInterior < 250) return;
        this.lastInterior = now;
        const w = this.want = this.wanted(G);
        const keepC = new Set(w.chunks.map((c) => c.key));
        for (const [k, c] of this.chunks) if (!keepC.has(k)) { disposeGroup(c.group); this.chunks.delete(k); }
        const keepL = new Set(w.levels.map((l) => l.key));
        for (const [k, l] of this.levels) {
            if (keepL.has(k)) continue;
            // a little hysteresis: keep a level a while after it leaves the wanted set
            l.idle = (l.idle ?? 0) + 1;
            if (l.idle > 8) { disposeGroup(l.group); markBuilt(l.b.id, l.L, false); this.levels.delete(k); }
        }
        for (const l of this.levels.values()) if (keepL.has(l.b.id + ':' + l.L)) l.idle = 0;
    }

    /** Build the most wanted missing piece. Returns false when nothing is left to build. */
    streamOne(G, all = false) {
        const w = this.want;
        if (!w) return false;
        // levels of the building you are in come first, then chunks and nearby levels by distance
        const nextL = w.levels.find((l) => !this.levels.has(l.key));
        const nextC = w.chunks.find((c) => !this.chunks.has(c.key));
        let doLevel = nextL && (!nextC || nextL.d < 30 || nextL.d < nextC.d * 0.6);
        if (!nextL && !nextC) return false;
        if (doLevel) {
            const I = interiorOf(G.city, nextL.b);
            const { group, lamps } = buildLevel(G, I, nextL.L);
            const g = group ?? new THREE.Group();
            this.world.add(g);
            this.levels.set(nextL.key, { group: g, lamps, b: nextL.b, L: nextL.L, idle: 0 });
            markBuilt(nextL.b.id, nextL.L, true);
            this.addInteriorThings(G, I, nextL.L, g);
        } else {
            const { group, lights } = buildChunk(G, nextC.i, nextC.j);
            this.world.add(group);
            this.chunks.set(nextC.key, { group, lights });
        }
        return true;
    }

    /** Rebuild one building level (a door was unlocked, the power came on). */
    rebuildLevel(G, bid, L) {
        const k = bid + ':' + L, l = this.levels.get(k);
        if (!l) return;
        disposeGroup(l.group);
        this.levels.delete(k);
        for (const [id, t] of this.things) if (t.userData.level === k) this.things.delete(id);
    }

    // ------------------------------------------------------------------ things you can pick up or use

    addInteriorThings(G, I, L, group) {
        const add = (t) => {
            if (t.L !== L || G.gotSet.has(t.id) || this.things.has(t.id)) return;
            const m = thingMesh(G, t);
            if (!m) return;
            m.userData.level = I.b.id + ':' + L;
            m.userData.thing = t;
            group.add(m);
            this.things.set(t.id, m);
        };
        for (const t of I.things) add(t);
        for (const t of G.story.things) if (t.b === I.b.id) add(t);
    }

    removeThing(id) {
        const m = this.things.get(id);
        if (!m) return;
        disposeGroup(m);
        this.things.delete(id);
    }

    // ------------------------------------------------------------------ events

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'diary') this.removeThing(`diary${e.k}`);
            else if (e.type === 'item') this.removeThing(`item_${e.item}`);
            else if (e.type === 'fragment' && e.id) this.removeThing(e.id);
            else if (e.type === 'unlock') {
                // rebuild every built level that has this lock's door on it
                if (e.lock === 'gate') this.gateBuilt = null;
                else {
                    const bid = +e.lock.slice(1);
                    for (const l of [...this.levels.values()]) if (l.b.id === bid && l.L === 0) this.rebuildLevel(G, bid, 0);
                }
                this.shake = Math.max(this.shake, 0.15);
            } else if (e.type === 'power') {
                this.shake = 0.6;
                const hall = G.city.lab.hall;
                this.rebuildLevel(G, hall, 0);
            } else if (e.type === 'fall') this.shake = 0.3;
            else if (e.type === 'land') this.shake = Math.max(this.shake, Math.min(1, (e.v ?? 4) / 8));
            else if (e.type === 'portal') this.shake = 1;
            else if (e.type === 'dial' || e.type === 'lever' || e.type === 'leverReset') this.consoleDirty = true;
        }
    }

    // ------------------------------------------------------------------ the frame

    frame(G, dt, time, look) {
        const st = this.stage;
        st.resize();
        if (!G) { st.render(time); return; }
        this.update(G, dt);
        if (!this.pending) {
            const t0 = performance.now();
            while (this.streamOne(G) && performance.now() - t0 < 6) { /* stream */ }
        }
        const p = G.p;
        // camera: smooth over stair steps, bob while walking, shake on landings
        const target = p.y + PLAYER.eye;
        this.camY = p.air ? target : this.camY + (target - this.camY) * Math.min(1, dt * 12);
        if (Math.abs(target - this.camY) > 2) this.camY = target;
        const moved = this.lastP ? Math.hypot(p.x - this.lastP[0], p.z - this.lastP[1]) : 0;
        this.lastP = [p.x, p.z];
        const speed = dt > 0 ? moved / dt : 0;
        this.bobAmp += ((speed > 0.5 && !p.air ? Math.min(1, speed / 5) : 0) - this.bobAmp) * Math.min(1, dt * 6);
        this.bob += moved * 2.1;
        this.shake = Math.max(0, this.shake - dt * 1.5);
        const sh = this.shake * this.shake;
        const cam = this.camera;
        cam.position.set(p.x + (Math.random() - 0.5) * sh * 0.1, this.camY + Math.sin(this.bob * 2) * 0.035 * this.bobAmp + (Math.random() - 0.5) * sh * 0.1, p.z);
        cam.rotation.order = 'YXZ';
        cam.rotation.y = -p.yaw + Math.sin(this.bob) * 0.004 * this.bobAmp;
        cam.rotation.x = (look?.pitch ?? 0) + (Math.random() - 0.5) * sh * 0.02;
        cam.rotation.z = Math.sin(this.bob) * 0.006 * this.bobAmp;
        st.follow(p.x, this.camY, p.z);

        // indoors or out: ambient, fog
        const here = tileAt(G.city, p.L, Math.floor(p.x / TILE), Math.floor(p.z / TILE));
        const inside = !!here?.b;
        this.inside = (this.inside ?? 0) + ((inside ? 1 : 0) - (this.inside ?? 0)) * Math.min(1, dt * 1.5);
        const k = this.inside;
        st.hemi.intensity = 0.95 * (1 - k) + 0.3 * k;
        st.scene.fog.density = 0.0105 * (1 - k) + 0.03 * k;
        st.scene.fog.color.copy(st.fogOut).lerp(st.fogIn, k);
        st.flash.visible = this.flashOn;
        // the flashlight sways a little behind the view
        st.flash.target.position.set(0.05 + Math.sin(this.bob) * 0.04 * this.bobAmp, -0.1 + Math.cos(this.bob * 2) * 0.03 * this.bobAmp, -4);

        this.updateLights(G, time, dt);
        this.updateDynamic(G, time);
        const fx = this.fx.update(dt, time, cam.position, !inside, G.portal, G.power);
        void fx;

        // the grade: closer to the ring, the stranger things look
        const ringD = this.ringPos ? cam.position.distanceTo(this.ringPos) : 999;
        const near = G.power ? Math.max(0, 1 - ringD / 30) * 0.35 : 0;
        st.grade.uniforms.fear.value = (G.portal > 0 ? Math.min(1.5, G.portal / 4) : 0) + near;
        st.grade.uniforms.white.value = G.portal > 0 ? Math.max(0, (G.portal - 6) / 3) : 0;
        st.grade.uniforms.sick.value = k * 0.3;
        panes().uniforms.glow.value = 0;
        st.render(time);
    }

    updateLights(G, time, dt) {
        const pool = this.stage.pool;
        const cam = this.camera.position;
        if (performance.now() - this.lastLights > 300) {
            this.lastLights = performance.now();
            const cands = [];
            for (const l of this.levels.values()) for (const lp of l.lamps) cands.push(lp);
            for (const c of this.chunks.values()) for (const lp of c.lights) cands.push(lp);
            for (const [id, m] of this.things) if (m.userData.thing?.kind === 'diary') { const t = m.userData.thing; cands.push({ x: t.x, y: t.L * G.city.buildings[t.b].h + 0.6, z: t.z, diary: true }); }
            for (const c of cands) c.d = (c.x - cam.x) ** 2 + (c.y - cam.y) ** 2 * 4 + (c.z - cam.z) ** 2;
            cands.sort((a, b) => a.d - b.d);
            this.lightList = cands.slice(0, pool.length);
        }
        const hall = G.power;
        for (let i = 0; i < pool.length; i++) {
            const L = pool[i], c = this.lightList[i];
            if (!c) { L.visible = false; continue; }
            L.visible = true;
            L.position.set(c.x, c.y, c.z);
            let I, col, dist;
            if (c.diary) { I = 1.6 + Math.sin(time * 2 + c.x) * 0.4; col = 0xffcf8a; dist = 4; }
            else if (c.neon) { I = 9 * (Math.random() < 0.02 ? 0.2 : 1); col = c.color; dist = 14; }
            else if (c.street) { I = 26; col = 0xffb46a; dist = 24; }
            else { I = c.back ? 5.5 : 4.5; col = c.back ? 0xffe6a0 : 0xf2f0dc; dist = 10; }
            if (c.flick) {
                // a dying tube: long steady stretches, then a stutter
                const f = Math.sin(time * 1.3 + c.x * 7.1) + Math.sin(time * 0.71 + c.z * 3.3);
                if (f > 1.55) I *= Math.random() < 0.5 ? 0.05 : 0.6;
            }
            L.intensity = I; L.distance = dist; L.color.setHex(col);
        }
        void hall;
    }

    updateDynamic(G, time) {
        // the gate opens once its chain is cut
        const gateOpen = G.openSet.has('gate');
        if (this.gateBuilt !== gateOpen) {
            if (this.gateMesh) disposeGroup(this.gateMesh);
            const K = new Kit();
            const g = G.city.lab.gate, d = [[0, -1], [1, 0], [0, 1], [-1, 0]][g.dir];
            for (let k = 0; k < 2; k++) {
                const tx = g.x + (d[0] ? 0 : k), tz = g.z + (d[0] ? k : 0);
                const ex = d[0] > 0 ? (tx + 1) * TILE : d[0] < 0 ? tx * TILE : null, ez = d[1] > 0 ? (tz + 1) * TILE : d[1] < 0 ? tz * TILE : null;
                const a = ex != null ? [ex, tz * TILE] : [tx * TILE, ez], b = ex != null ? [ex, (tz + 1) * TILE] : [(tx + 1) * TILE, ez];
                if (!gateOpen) fence(K, 'chain', a, b, 0);
                else { const swing = [a[0] + d[0] * 1.6, a[1] + d[1] * 1.6]; fence(K, 'chain', k ? b : a, k ? [b[0] + d[0] * 1.8, b[1] + d[1] * 1.8] : swing, 0); }
            }
            if (!gateOpen) { const mx = (g.x + (d[0] ? 0.5 : 1)) * TILE + d[0] * TILE / 2, mz = (g.z + (d[0] ? 1 : 0.5)) * TILE + d[1] * TILE / 2; K.tube(plain('metal'), [mx - 0.5 * Math.abs(d[1]), 1.2, mz - 0.5 * Math.abs(d[0])], [mx + 0.5 * Math.abs(d[1]), 1.3, mz + 0.5 * Math.abs(d[0])], 0.035, 5, [0.6, 0.6, 0.55]); }
            this.gateMesh = K.build({ name: 'gate' });
            if (this.gateMesh) this.scene.add(this.gateMesh);
            this.gateBuilt = gateOpen;
        }
        // the console: dial knobs, conduit levers, the master switch
        for (const [id, m] of this.things) {
            const t = m.userData.thing;
            if (!t) continue;
            if (t.kind === 'dial') m.children[0] && (m.children[0].rotation.y = -(G.dials[t.i] / 9) * Math.PI * 1.6);
            if (t.kind === 'lever') {
                const color = G.story.leverColors[t.i];
                const on = G.levers.includes(color);
                if (m.userData.on !== on) { m.userData.on = on; m.children[0].rotation.x = on ? 0.9 : -0.6; }
            }
            if (t.kind === 'diary' || t.kind === 'item') m.position.y = m.userData.y0 + Math.sin(time * 1.5 + t.x) * 0.0;
        }
    }

    setFlashlight(on) { this.flashOn = on; }
}

// ------------------------------------------------------------------ meshes for things

function thingMesh(G, t) {
    const K = new Kit();
    const b = G.city.buildings[t.b];
    const y = t.L * (b?.h ?? 3);
    const g = new THREE.Group();
    g.position.set(t.x, y, t.z);
    g.userData.y0 = y;
    const m = plain('paint'), metal = plain('metal'), glow = plain('glow');
    switch (t.kind) {
        case 'diary': {
            K.at(0, 0, 0, t.r ?? 0, () => {
                K.box(m, 0, 0.0, 0, 0.26, 0.05, 0.34, [0.25, 0.12, 0.08]);
                K.box(plain('paper'), 0.01, 0.05, 0, 0.23, 0.012, 0.31, [0.85, 0.8, 0.65]);
                K.box(m, 0.12, 0.0, 0, 0.03, 0.065, 0.35, [0.2, 0.1, 0.07]);
            });
            // a little warm shimmer so it can be spotted in the dark
            K.flat(glow, 0, 0.004, 0, 0.9, 0.9, 0, [0.22, 0.14, 0.05]);
            break;
        }
        case 'item': {
            K.at(0, 0, 0, t.r ?? 0, () => {
                if (t.item === 'crowbar') { K.tube(metal, [-0.4, 0.03, 0], [0.35, 0.03, 0], 0.018, 6, [0.45, 0.2, 0.15]); K.tube(metal, [0.35, 0.03, 0], [0.45, 0.03, 0.08], 0.018, 6, [0.45, 0.2, 0.15]); }
                else if (t.item === 'cutters') { for (const s of [-1, 1]) K.tube(m, [-0.4, 0.03, s * 0.05], [0.15, 0.03, s * 0.015], 0.02, 6, [0.6, 0.1, 0.08]); K.box(metal, 0.25, 0.01, 0, 0.2, 0.04, 0.05, [0.5, 0.5, 0.5]); }
                else if (t.item === 'badge' || t.item === 'labcard') { K.box(m, 0, 0, 0, 0.09, 0.006, 0.055, t.item === 'badge' ? [0.85, 0.85, 0.85] : [0.15, 0.2, 0.3]); K.tube(m, [0, 0.003, 0.03], [0.05, 0.003, 0.3], 0.005, 4, [0.1, 0.2, 0.5]); }
                else if (t.item === 'fuse') { K.at(0, 0.05, 0, 0, () => K.tube(m, [-0.12, 0, 0], [0.12, 0, 0], 0.045, 10, [0.85, 0.82, 0.75])); for (const s of [-1, 1]) K.at(0, 0.05, 0, 0, () => K.tube(metal, [s * 0.12, 0, 0], [s * 0.16, 0, 0], 0.05, 10, [0.6, 0.55, 0.4])); }
            });
            K.flat(glow, 0, 0.004, 0, 0.7, 0.7, 0, [0.16, 0.12, 0.06]);
            break;
        }
        case 'fragment': K.flat(plain('paper'), 0, 0.012, 0, 0.32, 0.42, (t.t ?? 0) % 6, [0.78, 0.74, 0.62]); K.flat(plain('paper'), 0.05, 0.016, 0.03, 0.28, 0.36, ((t.t ?? 0) % 7) + 1, [0.72, 0.7, 0.6]); break;
        case 'radio': K.box(m, 0, 0, 0, 0.42, 0.24, 0.16, [0.35, 0.25, 0.18]); K.box(metal, -0.08, 0.05, 0.081, 0.18, 0.14, 0.01, [0.2, 0.2, 0.2]); K.tube(metal, [0.15, 0.24, 0], [0.3, 0.7, 0], 0.005, 4, [0.6, 0.6, 0.6]); K.box(glow, 0.12, 0.13, 0.081, 0.06, 0.03, 0.005, [0.8, 0.5, 0.1]); break;
        case 'dial': {
            const knob = new Kit();
            knob.cyl(metal, 0, 0, 0, 0.09, 0.06, 12, [0.55, 0.5, 0.4]);
            knob.box(glow, 0.0, 0.06, 0.06, 0.012, 0.012, 0.05, [1.2, 0.8, 0.2]);
            const kg = knob.build() ?? new THREE.Group();
            kg.position.set(0, 1.2, -0.2);
            g.add(kg);
            break;
        }
        case 'lever': {
            const color = G.story.leverColors[t.i];
            const arm = new Kit();
            arm.tube(metal, [0, 0, 0], [0, 0.42, 0], 0.02, 6, [0.5, 0.5, 0.5]);
            arm.cyl(glow, 0, 0.42, 0, 0.05, 0.1, 10, LEVER_RGB[color]);
            const ag = arm.build() ?? new THREE.Group();
            ag.position.set(0, 1.18, -0.15);
            ag.rotation.x = -0.6;
            g.add(ag);
            K.box(m, 0, 1.08, -0.15, 0.16, 0.1, 0.16, [0.15, 0.15, 0.15]);
            break;
        }
        case 'master': K.box(m, 0, 1.12, -0.1, 0.35, 0.22, 0.25, [0.5, 0.08, 0.06]); K.box(glow, 0, 1.34, -0.1, 0.12, 0.04, 0.08, [1.2, 0.2, 0.1]); break;
        case 'breaker': K.box(glow, -0.06, 1.6, 0, 0.02, 0.06, 0.06, G.power ? [0.2, 1.4, 0.3] : [1.4, 0.1, 0.05]); break;
        default: return null;
    }
    const built = K.build({ cast: false });
    if (built) g.add(...built.children);
    return g;
}
