// The board in 3D: a lit dance-floor grid with a chrome-and-neon frame and a ring of marquee
// bulbs, and one 3D object per token that follows the sim's positions every frame (the sim does
// the falling, sliding and clearing; this only draws it, with squash, spin and pop on top).
//
// Reads G, never writes it. Sim events become effects: bursts, rings, lasers and bolts, queued
// with a delay so a beam's sparks arrive when the beam does.

import * as THREE from 'three';
import { W, H, KINDS, SP, ST, TIMING, ROOMS } from '../config.js';
import { TokenKit } from './tokens.js';

const BOARD_HALF = 4;
const tmpC = new THREE.Color();

export class BoardView {
    constructor(scene, stage, fx, envMap) {
        this.scene = scene;
        this.stage = stage;
        this.fx = fx;
        this.root = new THREE.Group();
        this.root.rotation.x = -0.1;
        scene.add(this.root);
        this.clip = new THREE.Plane();
        this.kit = new TokenKit(envMap, this.clip);

        // ---- backing, frame, tiles
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8d4e8, metalness: 1, roughness: 0.18, envMap, envMapIntensity: 1.4 });
        const neonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.4, 1.1), toneMapped: false });
        this.neonMat = neonMat;
        for (const [w, h, x, y] of [[9.5, 0.22, 0, 4.62], [9.5, 0.22, 0, -4.62], [0.22, 9.0, -4.62, 0], [0.22, 9.0, 4.62, 0]]) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.32), chromeMat);
            bar.position.set(x, y, 0.0);
            this.root.add(bar);
        }
        for (const [w, h, x, y] of [[8.9, 0.07, 0, 4.47], [8.9, 0.07, 0, -4.47], [0.07, 8.9, -4.47, 0], [0.07, 8.9, 4.47, 0]]) {
            const tube = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), neonMat);
            tube.position.set(x, y, 0.1);
            this.root.add(tube);
        }
        // marquee bulbs round the frame
        const bulbPos = [];
        for (let i = 0; i < 18; i++) { const x = -4.5 + (i + 0.5) * 0.5; bulbPos.push([x, 4.62], [-x, -4.62]); }
        for (let i = 0; i < 18; i++) { const y = -4.5 + (i + 0.5) * 0.5; bulbPos.push([4.62, y], [-4.62, -y]); }
        this.bulbOrder = bulbPos.map((p, i) => ({ p, a: Math.atan2(p[1], p[0]), i })).sort((a, b) => a.a - b.a).map((b) => b.p);
        this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), this.bulbOrder.length);
        const o = new THREE.Object3D();
        this.bulbOrder.forEach(([x, y], i) => { o.position.set(x, y, 0.2); o.updateMatrix(); this.bulbs.setMatrixAt(i, o.matrix); this.bulbs.setColorAt(i, tmpC.set(0xffffff)); });
        this.root.add(this.bulbs);

        const tileGeo = new THREE.BoxGeometry(1, 1, 0.1);
        // each tile is a dark glass panel with a glowing edge made of four thin bars
        this.glow = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), W * H * 4);
        this.cover = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.74, depthWrite: false }), W * H);
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const i = r * W + c;
                const bars = [[0, 0.475, 0.97, 0.05], [0, -0.475, 0.97, 0.05], [-0.475, 0, 0.05, 0.97], [0.475, 0, 0.05, 0.97]];
                bars.forEach(([bx, by, bw, bh], k) => {
                    o.position.set(c - 3.5 + bx, 3.5 - r + by, 0.0); o.scale.set(bw, bh, 1); o.updateMatrix();
                    this.glow.setMatrixAt(i * 4 + k, o.matrix);
                    this.glow.setColorAt(i * 4 + k, tmpC.set(0x000000));
                });
                o.position.set(c - 3.5, 3.5 - r, 0.0); o.scale.set(0.93, 0.93, 1); o.updateMatrix();
                this.cover.setMatrixAt(i, o.matrix);
                this.cover.setColorAt(i, tmpC.set(0x000000));
            }
        }
        this.root.add(this.glow, this.cover);
        this.flash = new Float32Array(W * H);
        this.flashCol = Array.from({ length: W * H }, () => new THREE.Color());

        // ---- tokens, cursor, hint
        this.tokens = new THREE.Group();
        this.root.add(this.tokens);
        this.entries = new Map();
        const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false, transparent: true, depthTest: false });
        this.cursor = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 40), ringMat);
        this.cursor.position.z = 0.4; this.cursor.visible = false; this.cursor.renderOrder = 15;
        this.root.add(this.cursor);
        this.hintMeshes = [0, 1].map(() => {
            const m = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 1.2), toneMapped: false, transparent: true, depthTest: false }));
            m.position.z = 0.4; m.visible = false; m.renderOrder = 15;
            this.root.add(m);
            return m;
        });
        this.cur = { r: 3, c: 3, on: false, grabbed: false };
        this.hint = null;

        this.queue = [];
        this.pops = new Map();
        this.show = 0;
        this.showTo = 0;
        this.fever = 0;
        this.room = 0;
        this.beat = 0;
        this.hue = 0;
    }

    // ------------------------------------------------------------------ geometry helpers
    local(r, c, z = 0.2, out = new THREE.Vector3()) { return out.set(c - 3.5, 3.5 - r, z); }
    cellWorld(r, c, z = 0.25, out = new THREE.Vector3()) {
        this.root.updateMatrixWorld(true);
        return this.root.localToWorld(this.local(r, c, z, out));
    }

    setVisible(v) { this.showTo = v ? 1 : 0; }
    setCursor(r, c, on, grabbed = false) { this.cur.r = r; this.cur.c = c; this.cur.on = on; this.cur.grabbed = grabbed; }
    setHint(h) { this.hint = h; }

    later(at, fn) { this.queue.push({ at, fn }); }

    // ------------------------------------------------------------------ events → effects
    onEvents(G, events, now) {
        const fx = this.fx;
        const w = new THREE.Vector3(), w2 = new THREE.Vector3();
        for (const e of events) {
            switch (e.type) {
                case 'land': { const en = this.entries.get(e.id); if (en) en.squash = Math.min(1, 0.25 + e.v * 0.05); break; }
                case 'clear': {
                    const k = KINDS[e.col]?.hex ?? 0xffffff;
                    const r = e.r, c = e.c, sp = e.sp;
                    this.later(now + e.delay, () => {
                        this.cellWorld(r, c, 0.3, w);
                        fx.burst(w, k, sp ? 26 : 12, sp ? 4 : 3, 0.3);
                        const i = r * W + c;
                        this.flash[i] = 1; this.flashCol[i].set(k);
                    });
                    break;
                }
                case 'wave': {
                    this.cellWorld(e.r, e.c, 0.3, w);
                    fx.ring(w, e.fever ? 0xffd21f : 0xffffff, 1.6 + Math.min(e.n, 12) * 0.18, 0.45);
                    this.stage.kick(Math.min(0.32, 0.04 + e.combo * 0.02), 0);
                    break;
                }
                case 'make': { this.pops.set(e.id, now); this.cellWorld(e.r, e.c, 0.4, w); fx.ring(w, 0xffffff, 3.2, 0.6); fx.glitter(w, 0xffffff, 18, 1.2); break; }
                case 'morph': {
                    this.later(now + (e.delay || 0), () => { this.pops.set(e.id, now + (e.delay || 0)); this.cellWorld(e.r, e.c, 0.4, w); fx.glitter(w, 0xffffff, 10, 0.9); });
                    break;
                }
                case 'beam': {
                    const dir = e.dir;
                    this.later(now + (e.delay || 0), () => {
                        if (dir === 'h') { this.local(e.r, 0, 0.5, w); w.x = -5.2; this.local(e.r, 0, 0.5, w2); w2.x = 5.2; }
                        else { this.local(0, e.c, 0.5, w); w.y = 5.2; this.local(0, e.c, 0.5, w2); w2.y = -5.2; }
                        this.root.localToWorld(w); this.root.localToWorld(w2);
                        fx.laser(w, w2, 0xffffff, 0.45, e.fat ? 0.8 : 0.3);
                        this.cellWorld(e.r, e.c, 0.4, w);
                        fx.ring(w, 0xffe9a0, 3, 0.5);
                    });
                    this.stage.kick(0.18, 0);
                    break;
                }
                case 'blast': {
                    this.later(now + (e.delay || 0), () => {
                        this.cellWorld(e.r, e.c, 0.4, w);
                        fx.ring(w, 0xffa040, 4 + e.radius * 3, 0.6);
                        fx.ring(w, 0xffffff, 2.6 + e.radius * 2, 0.4);
                        fx.burst(w, 0xffb060, 36, 5.5, 0.4);
                    });
                    this.stage.kick(0.3 + e.radius * 0.1, 0);
                    break;
                }
                case 'mirror': {
                    const src = this.cellWorld(e.r, e.c, 0.4).clone();
                    fx.ring(src, 0xffffff, 4, 0.7);
                    fx.glitter(src, 0xffffff, 26, 1.4);
                    const hue = KINDS[e.col]?.hex ?? 0xffffff;
                    e.targets.forEach(([r, c], k) => {
                        const to = this.cellWorld(r, c, 0.4).clone();
                        fx.bolt(src, to, hue, 0.5, (e.delay || 0) + 0.06 + k * 0.03);
                    });
                    this.stage.kick(0.25, 0);
                    break;
                }
                case 'combo': {
                    this.cellWorld(e.r, e.c, 0.4, w);
                    fx.ring(w, 0xffffff, 9, 0.9); fx.ring(w, 0xff2fa8, 7, 1.0, 0.1); fx.ring(w, 0x2de2ff, 11, 1.1, 0.2);
                    fx.shower(70);
                    this.stage.kick(0.5, 0.5);
                    break;
                }
                case 'fever': {
                    w.set(0, 0, 1); this.root.localToWorld(w);
                    fx.ring(w, 0xffd21f, 12, 1.0); fx.ring(w, 0xff2fa8, 9, 1.1, 0.12);
                    fx.shower(110);
                    this.stage.kick(0.45, 0.6);
                    break;
                }
                case 'level': { fx.shower(90); w.set(0, 0, 1); this.root.localToWorld(w); fx.ring(w, 0x9dff3a, 10, 1.0); break; }
                case 'shuffle': { for (const en of this.entries.values()) en.spinT = 0.001; break; }
                case 'badswap': {
                    for (const [r, c] of [[e.r, e.c], [e.r2, e.c2]]) { const i = r * W + c; this.flash[i] = 0.7; this.flashCol[i].set(0xff2040); }
                    break;
                }
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ per frame
    sync(G, dt, time, { beat = 0, fever = 0, room = 0, calm = false } = {}) {
        this.calm = calm;
        this.beat = beat * (calm ? 0.2 : 1);
        this.fever += (fever - this.fever) * Math.min(1, dt * 4);
        this.room = room;
        // entrance and exit
        this.show += (this.showTo - this.show) * Math.min(1, dt * 5);
        if (Math.abs(this.showTo - this.show) < 0.002) this.show = this.showTo;
        const vis = this.show > 0.01;
        this.root.visible = vis;
        const e = this.show * this.show * (3 - 2 * this.show);
        this.root.scale.setScalar(0.55 + 0.45 * e);
        this.root.rotation.y = (1 - e) * 0.9;
        if (!vis) { this.flushQueue(time); return; }

        // clip plane: keep everything below the top edge of the board
        this.root.updateMatrixWorld(true);
        const n = new THREE.Vector3(0, -1, 0).transformDirection(this.root.matrixWorld);
        const p = new THREE.Vector3(0, BOARD_HALF + 0.02, 0).applyMatrix4(this.root.matrixWorld);
        this.clip.setFromNormalAndCoplanarPoint(n, p);

        this.flushQueue(time);
        this.syncTokens(G, dt, time, calm);
        this.syncTiles(dt, time);
        this.syncCursor(time, G);
    }

    flushQueue(time) {
        for (let i = this.queue.length - 1; i >= 0; i--) {
            if (this.queue[i].at <= time) { const q = this.queue.splice(i, 1)[0]; q.fn(); }
        }
    }

    syncTokens(G, dt, time, calm) {
        const seen = new Set();
        const hintIds = new Set();
        if (this.hint) for (const h of this.hint) { const t = G.grid[h.r * W + h.c]; if (t) hintIds.add(t.id); }
        const selected = this.cur.on && this.cur.grabbed ? G.grid[this.cur.r * W + this.cur.c] : null;
        const pulse = 1 + this.beat * 0.07;                 // (this.beat is already softened in calm mode)
        for (let i = 0; i < G.grid.length; i++) {
            const t = G.grid[i];
            if (!t) continue;
            seen.add(t.id);
            let en = this.entries.get(t.id);
            if (!en || en.sp !== t.sp || en.col !== t.col) {
                if (en) this.tokens.remove(en.obj);
                const obj = this.kit.make(t.col, t.sp);
                this.tokens.add(obj);
                const prev = en;
                en = { obj, sp: t.sp, col: t.col, squash: prev ? prev.squash : 0, phase: prev ? prev.phase : Math.random() * 6.28, spinT: 0, born: time };
                this.entries.set(t.id, en);
            }
            const o = en.obj;
            o.position.set((t.c + t.ox) - 3.5, 3.5 - (t.r + t.oy), 0.2);
            let s = 1;
            if (t.st === ST.CLEAR) {
                const k = (G.t - t.clearFrom) / TIMING.clear;
                if (k < 0) s = 1 + Math.sin(time * 40) * 0.04;
                else s = k < 0.3 ? 1 + k * 1.4 : Math.max(0, 1.42 * (1 - (k - 0.3) / 0.7));
            }
            en.squash = Math.max(0, en.squash - dt * 6);
            let sx = 1 + 0.14 * en.squash, sy = 1 - 0.22 * en.squash;
            if (t === selected) s *= 1.14 + Math.sin(time * 14) * 0.03;
            else if (hintIds.has(t.id)) s *= 1.06 + Math.sin(time * 9) * 0.06;
            const popAt = this.pops.get(t.id);
            if (popAt !== undefined) {
                const k = (time - popAt) / 0.5;
                if (k >= 1) this.pops.delete(t.id);
                else if (k >= 0) s *= 1 + Math.sin(k * Math.PI) * 0.7;
            }
            if (en.spinT > 0) { en.spinT += dt; if (en.spinT > 0.4) en.spinT = 0; }
            const spin = en.spinT > 0 ? en.spinT / 0.4 : 0;
            s *= pulse * (1 - Math.sin(spin * Math.PI) * 0.35);
            o.scale.set(s * sx, s * sy, s);
            const h = o.userData.holder, ph = en.phase;
            switch (o.userData.spin) {
                case 'disc': h.rotation.z = time * 1.4 + ph; break;
                case 'ball': h.rotation.y = time * 0.9 + ph; break;
                default: h.rotation.y = Math.sin(time * 1.5 + ph) * 0.55; h.rotation.z = Math.sin(time * 1.1 + ph) * 0.1;
            }
            if (spin) h.rotation.y += spin * Math.PI * 2;
            const sp = o.userData.special;
            if (sp) {
                if (t.sp === SP.BOMB) { sp.rotation.z = time * 1.6; sp.children[0].rotation.y = time * 2.2; sp.children[1].rotation.x = time * 1.8; }
                else sp.scale.setScalar(1 + Math.sin(time * 6 + ph) * 0.06);
            }
            const halo = o.userData.halo;
            if (halo) halo.material.opacity = 0.55 + 0.35 * Math.sin(time * 5 + ph) + this.beat * 0.2;
            // specials shed glints
            if (t.sp && !calm && Math.random() < dt * 3.5 && t.st !== ST.CLEAR) {
                this.fx.glitter(this.root.localToWorld(o.position.clone()), t.sp === SP.MIRROR ? 0xffffff : KINDS[t.col].hex, 1, 0.7);
            }
        }
        for (const [id, en] of this.entries) {
            if (!seen.has(id)) { this.tokens.remove(en.obj); this.entries.delete(id); this.pops.delete(id); }
        }
    }

    syncTiles(dt, time) {
        const room = ROOMS[this.room % ROOMS.length];
        const a = tmpC.set(room.sky[1]).clone(), b = new THREE.Color(room.sky[2]);
        const fev = this.fever;
        const glow = this.glow, cover = this.cover;
        const c1 = new THREE.Color(), c2 = new THREE.Color();
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const i = r * W + c;
                const checker = (r + c) & 1;
                const wave = 0.5 + 0.5 * Math.sin(time * (this.calm ? 0.8 : 2.4) - (r + c) * 0.75);
                const lit = 0.12 + 0.2 * wave * wave + this.beat * 0.1;
                c1.copy(checker ? a : b).multiplyScalar(0.38 + 0.6 * lit);
                if (fev > 0.01) {
                    const hue = (time * (this.calm ? 0.08 : 0.35) + (r + c) * 0.07 + (r - c) * 0.03) % 1;
                    c2.setHSL(hue, 0.95, 0.5);
                    c1.lerp(c2, fev * 0.8).multiplyScalar(0.8 + fev * 0.5 * wave);
                }
                if (this.flash[i] > 0) {
                    this.flash[i] = Math.max(0, this.flash[i] - dt * 3.2);
                    c1.lerp(this.flashCol[i], Math.min(1, this.flash[i] * 1.2)).multiplyScalar(1 + this.flash[i] * 0.9);
                }
                for (let k = 0; k < 4; k++) glow.setColorAt(i * 4 + k, c1);
                c2.copy(c1).multiplyScalar(0.035 + lit * 0.12);
                c2.r += 0.006; c2.g += 0.003; c2.b += 0.02;
                cover.setColorAt(i, c2);
            }
        }
        glow.instanceColor.needsUpdate = true;
        cover.instanceColor.needsUpdate = true;
        // the neon tube cycles slowly round the palette; the bulbs chase
        this.hue = (this.hue + dt * (this.calm ? 0.02 : 0.05 + fev * 0.25)) % 1;
        this.neonMat.color.setHSL(this.hue, 0.9, 0.55).multiplyScalar(1.5);
        const n = this.bulbOrder.length;
        const speed = 7 + fev * 6;
        for (let i = 0; i < n; i++) {
            const k = (i - time * speed) % 8;
            const on = this.calm ? 0.75 : ((k + 8) % 8) < 2.2 ? 1 : 0.18;       // calm: the bulbs glow steadily, they don't chase
            if (fev > 0.01) c1.setHSL((i / n + time * (this.calm ? 0.05 : 0.3)) % 1, 0.9, 0.55); else c1.setHex(i % 2 ? 0xffe2a8 : 0xffb0e0);
            this.bulbs.setColorAt(i, c1.multiplyScalar(on * 1.5));
        }
        this.bulbs.instanceColor.needsUpdate = true;
    }

    syncCursor(time, G) {
        const cur = this.cur;
        this.cursor.visible = cur.on;
        if (cur.on) {
            this.local(cur.r, cur.c, 0.45, this.cursor.position);
            const k = cur.grabbed ? 1.12 + Math.sin(time * 12) * 0.05 : 1 + Math.sin(time * 5) * 0.04;
            this.cursor.scale.setScalar(k);
            this.cursor.material.color.setRGB(cur.grabbed ? 2.6 : 1.8, cur.grabbed ? 2.0 : 1.8, cur.grabbed ? 0.4 : 2.2);
        }
        for (let i = 0; i < 2; i++) {
            const m = this.hintMeshes[i], h = this.hint && this.hint[i];
            m.visible = !!h;
            if (h) {
                this.local(h.r, h.c, 0.45, m.position);
                m.scale.setScalar(1 + Math.sin(time * 8) * 0.08);
            }
        }
        void G;
    }
}
