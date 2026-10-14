// The view: owns the renderer, the episode scene and the cinema scene, the
// tactical camera, and turns sim events into effects. It reads the world;
// it never changes it.

import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { buildBoard } from './board.js';
import { Actors } from './actors.js';
import { Overlay } from './overlay.js';
import { FX } from './fx.js';
import { Cinema } from './cinema.js';
import { T } from '../sim/physics.js';
import { TIMES } from '../config.js';
import { CREW } from '../sim/data.js';

const PITCH = (57 * Math.PI) / 180;
const FOV = 38;

export class View {
    constructor(canvas) {
        this.r = new Renderer(canvas);
        this.cinema = new Cinema();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 400);
        this.mode = 'cinema';
        this.board = null;
        this.W = null;
        this.root = null;
        this.cam = { tx: 0, tz: 0, d: 30, fit: 30, zoom: 1, px: 0, pz: 0, cx: 0, cz: 0, cd: 30, yaw: 0 };
        this.vhs = 0;
        this.t = 0;
        this.shakeOn = true;
        this.ray = new THREE.Raycaster();
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.w = 1280; this.h = 720;
        this.cinemaOpts = {};
    }

    resize(w, h) {
        this.w = w; this.h = h;
        this.r.resize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.cinema.resize(w / h);
        if (this.W) this.fit(true);
        this.fx?.setScale(h * this.r.r.getPixelRatio());
    }

    setMode(m) { this.mode = m; }

    // ------------------------------------------------------------------ episode
    load(W) {
        this.unload();
        this.W = W;
        const def = W.def, L = W.L, S = W.S;
        const T0 = TIMES[def.time] ?? TIMES.night;
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.scene.background = new THREE.Color(T0.fog);
        this.scene.fog = new THREE.Fog(T0.fog, 40, 110);
        this.hemi = new THREE.HemisphereLight(T0.amb, new THREE.Color(T0.fog).lerp(new THREE.Color(0x404060), 0.5), T0.ambI * 2.2 + 0.4);
        this.root.add(this.hemi);
        // a soft fill from the camera side so faces and props always read
        this.fill = new THREE.DirectionalLight(0xfff0f8, 0.35 + T0.night * 0.45);
        this.fill.position.set(L.w / 2, 20, L.h + 30);
        this.fill.target.position.set(L.w / 2, 0, L.h / 2);
        this.root.add(this.fill, this.fill.target);
        this.sunL = new THREE.DirectionalLight(T0.sun, T0.sunI * 1.25 + 0.3);
        this.sunL.position.set(L.w / 2 - 12, 24, L.h / 2 + 14);
        this.sunL.target.position.set(L.w / 2, 0, L.h / 2);
        this.sunL.castShadow = true;
        const sc = this.sunL.shadow.camera;
        const ext = Math.max(L.w, L.h) * 0.75;
        sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 80;
        this.sunL.shadow.mapSize.set(2048, 2048);
        this.sunL.shadow.bias = -0.0008;
        this.root.add(this.sunL, this.sunL.target);
        this.board = buildBoard(L, S, def);
        this.root.add(this.board.group);
        this.actors = new Actors(this.root);
        this.actors.build(W);
        this.overlay = new Overlay(this.root);
        this.overlay.setPatrols(W);
        this.fx = new FX(this.root, this.camera);
        this.fx.setScale(this.h * this.r.r.getPixelRatio());
        this.fx.quality = this.r.tier === 2 ? 0.5 : this.r.tier === 1 ? 0.75 : 1;
        this.lightning = 0;
        this.fit(true);
        this.mode = 'board';
    }

    unload() {
        if (this.root) {
            this.scene.remove(this.root);
            this.root.traverse((o) => {
                if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
                const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                for (const m of ms) m.dispose();
            });
        }
        this.root = null; this.W = null; this.board = null;
    }

    // ------------------------------------------------------------------ camera
    _camPos(tx, tz, d, out = new THREE.Vector3()) {
        const y = this.cam.yaw, h = d * Math.cos(PITCH);
        return out.set(tx + Math.sin(y) * h, d * Math.sin(PITCH), tz + Math.cos(y) * h);
    }

    /** Screen-right and screen-up directions on the floor, in sim (x, y). */
    screenAxes() {
        const y = this.cam.yaw;
        return { rx: Math.cos(y), ry: -Math.sin(y), ux: -Math.sin(y), uy: -Math.cos(y) };
    }

    _project(tx, tz, d, x, z) {
        const cam = this.camera;
        this._camPos(tx, tz, d, cam.position);
        cam.lookAt(tx, 0, tz);
        cam.updateMatrixWorld();
        return new THREE.Vector3(x, 0, z).project(cam);
    }

    /** Fit the whole map in view (leaving room for the HUD). */
    fit(snap = false) {
        const L = this.W.L;
        const corners = [[0, 0], [L.w, 0], [0, L.h], [L.w, L.h]];
        // On a portrait screen, turn the camera so a wide map runs down the phone.
        const portrait = this.h > this.w * 1.15;
        this.cam.yaw = portrait && L.w > L.h * 1.1 ? -Math.PI / 2 : 0;
        let top = this.h < 560 ? 0.74 : 0.8, bot = this.h < 560 ? -0.62 : -0.72;
        const side = 0.96;
        if (portrait) { top = 0.76; bot = this.w < 500 ? -0.56 : -0.64; }
        let tx = L.w / 2, tz = L.h / 2, d = 30;
        for (let it = 0; it < 7; it++) {
            let lo = 4, hi = 200;
            for (let k = 0; k < 26; k++) {
                const m = (lo + hi) / 2;
                const ok = corners.every(([x, z]) => { const p = this._project(tx, tz, m, x, z); return p.x > -side && p.x < side && p.y < top && p.y > bot; });
                if (ok) hi = m; else lo = m;
            }
            d = hi;
            // re-centre vertically: put the projected box mid-way between bot and top
            const ys = corners.map(([x, z]) => this._project(tx, tz, d, x, z).y);
            const mid = (Math.max(...ys) + Math.min(...ys)) / 2, want = (top + bot) / 2;
            const ax = this.screenAxes();
            tx -= ax.ux * (want - mid) * d * 0.3;
            tz -= ax.uy * (want - mid) * d * 0.3;
        }
        this.cam.fit = d; this.cam.fitTx = tx; this.cam.fitTz = tz;
        if (snap) { this.cam.zoom = Math.min(this.cam.zoom, 1); this.cam.px = 0; this.cam.pz = 0; this.cam.cd = d * this.cam.zoom; this.cam.cx = tx; this.cam.cz = tz; }
    }

    zoomBy(k, sx, sy) {
        const before = sx != null ? this.groundAt(sx, sy) : null;
        this.cam.zoom = Math.max(0.32, Math.min(1, this.cam.zoom * k));
        if (before && this.cam.zoom < 1) {
            // keep the point under the cursor roughly still
            const d = this.cam.fit * this.cam.zoom;
            const after = this._groundFrom(sx, sy, this.cam.fitTx + this.cam.px, this.cam.fitTz + this.cam.pz, d);
            if (after) { this.cam.px += before.x - after.x; this.cam.pz += before.y - after.y; }
        }
        this._clampPan();
    }

    panBy(dxPx, dyPx) {
        const k = (this.cam.fit * this.cam.zoom * Math.tan((FOV * Math.PI) / 360) * 2) / this.h;
        const a = this.screenAxes();
        const sx = -dxPx * k, su = dyPx * k / Math.sin(PITCH);
        this.cam.px += a.rx * sx + a.ux * su;
        this.cam.pz += a.ry * sx + a.uy * su;
        this._clampPan();
    }

    _clampPan() {
        const L = this.W?.L;
        if (!L) return;
        const z = this.cam.zoom;
        const mx = (L.w / 2) * (1 - z) + 1, mz = (L.h / 2) * (1 - z) + 1.5;
        this.cam.px = Math.max(-mx, Math.min(mx, this.cam.px));
        this.cam.pz = Math.max(-mz, Math.min(mz, this.cam.pz));
        if (z >= 0.999) { this.cam.px = 0; this.cam.pz = 0; }
    }

    focus(x, y) {
        if (this.cam.zoom > 0.95) return;
        this.cam.px = x - this.cam.fitTx; this.cam.pz = y - this.cam.fitTz;
        this._clampPan();
    }

    resetCamera() { this.cam.zoom = 1; this.cam.px = 0; this.cam.pz = 0; }

    _groundFrom(sx, sy, tx, tz, d) {
        const cam = this.camera.clone();
        this._camPos(tx, tz, d, cam.position);
        cam.lookAt(tx, 0, tz);
        cam.updateMatrixWorld();
        this.ray.setFromCamera(new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1), cam);
        const p = new THREE.Vector3();
        return this.ray.ray.intersectPlane(this.plane, p) ? { x: p.x, y: p.z } : null;
    }

    /** Screen pixel (relative to the canvas) to sim coordinates on the floor. */
    groundAt(sx, sy) {
        this.ray.setFromCamera(new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1), this.camera);
        const p = new THREE.Vector3();
        return this.ray.ray.intersectPlane(this.plane, p) ? { x: p.x, y: p.z } : null;
    }

    /** Sim point to screen pixels. */
    screenOf(x, y, h = 0) {
        const p = new THREE.Vector3(x, h, y).project(this.camera);
        return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h, z: p.z };
    }

    /** Pixels per world unit at a point (for touch slop and drag scaling). */
    pxPerUnit(x, y) {
        const a = this.screenOf(x, y), b = this.screenOf(x + 1, y);
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    _updateCamera(dt, ctx) {
        const c = this.cam, W = this.W;
        // follow the rolling ball when zoomed in
        if (ctx.follow && c.zoom < 0.95) {
            const p = this.screenOf(ctx.follow.x, ctx.follow.y);
            const mx = this.w * 0.2, my = this.h * 0.22;
            if (p.x < mx || p.x > this.w - mx || p.y < my || p.y > this.h - my) {
                c.px += (ctx.follow.x - (c.fitTx + c.px)) * Math.min(1, dt * 2.5);
                c.pz += (ctx.follow.y - (c.fitTz + c.pz)) * Math.min(1, dt * 2.5);
                this._clampPan();
            }
        }
        const k = Math.min(1, dt * 7);
        c.cx += (c.fitTx + c.px - c.cx) * k;
        c.cz += (c.fitTz + c.pz - c.cz) * k;
        c.cd += (c.fit * c.zoom - c.cd) * k;
        this._camPos(c.cx, c.cz, c.cd, this.camera.position);
        let sx = 0, sz = 0;
        if (this.shakeOn && this.fx?.shake > 0) { const s = this.fx.shake * 0.35; sx = (Math.random() - 0.5) * s; sz = (Math.random() - 0.5) * s; }
        this.camera.position.x += sx; this.camera.position.z += sz;
        this.camera.lookAt(c.cx + sx, 0, c.cz + sz);
        void W;
    }

    // ------------------------------------------------------------------ events
    on(e) {
        const W = this.W, fx = this.fx;
        if (!W || !fx) return;
        const x = e.x, z = e.y;
        switch (e.type) {
            case 'shoot': fx.ring(x, z, 0x6ff8ff, { r1: 1.1, life: 0.35 }); fx.sparks(x, z, 0x6ff8ff, 8); break;
            case 'clack': fx.sparks(x, z, 0xffffff, Math.min(16, 3 + e.v * 1.2)); if (e.v > 8) fx.shake = Math.max(fx.shake, 0.12); break;
            case 'wall': if (e.v > 4) fx.sparks(x, z, 0xfff0d0, Math.min(10, e.v)); break;
            case 'bumper': {
                fx.ring(x, z, 0xff3fa4, { r1: 1.2, life: 0.3 });
                fx.burst(x, 0.4, z, 14, 0xff9ad0, { speed: 5, size: 0.18, life: 0.4 });
                const b = this.board.bumpers.find((q) => Math.hypot(q.x - x, q.y - z) < 0.1);
                if (b) b.flash = 1;
                break;
            }
            case 'break': {
                const col = e.tile === T.GLASS ? 0x9af4ff : e.tile === T.CRATE ? 0xc09060 : W.def.walls?.a ?? 0xf3c9b4;
                fx.shatter(x, z, col);
                fx.shake = Math.max(fx.shake, 0.18);
                break;
            }
            case 'pocket':
                if (e.where === 'water') fx.splash(x, z); else { fx.ring(x, z, 0x202028, { r1: 0.9 }); fx.burst(x, 0.1, z, 12, 0x8a8a9a, { speed: 2, size: 0.2 }); }
                if (e.kind === 'foe') fx.popup(x, z, e.where === 'water' ? 'SPLASH! +400' : 'SUNK +400', '#2ff2e0');
                else if (e.kind === 'crew') fx.popup(x, z, 'SPLASH −♥', '#ff5f8a', 0.4);
                break;
            case 'takedown': {
                const col = e.cop ? '#ff2e3e' : e.style >= 500 ? '#ff3fa4' : '#ffe45c';
                fx.popup(x, z, `${e.tag} ${e.style >= 0 ? '+' : ''}${e.style}`, col, e.style >= 500 ? 0.6 : 0.48);
                fx.burst(x, 0.6, z, 22, 0xffe45c, { speed: 4, up: 3, size: 0.2, life: 0.6 });
                fx.ring(x, z, 0xffe45c, { r1: 1.6, life: 0.4 });
                fx.shake = Math.max(fx.shake, 0.22);
                break;
            }
            case 'bossHit': fx.popup(x, z, e.hp > 0 ? `HIT! ${e.hp} LEFT` : 'DAZED!', '#ff8a3a', 0.55); fx.burst(x, 0.6, z, 30, 0xff8a3a, { speed: 6, size: 0.25 }); fx.shake = 0.35; break;
            case 'stun': fx.burst(x, 0.8, z, 8, 0xffe45c, { speed: 2, size: 0.15, life: 0.4 }); break;
            case 'alarm': fx.ring(x, z, 0xff2e3e, { r1: 6, life: 0.8, width: 0.05 }); fx.flash = 0.18; fx.flashColor.set(1, 0.1, 0.2); fx.shake = 0.3; break;
            case 'bodyFound': fx.popup(x, z, 'BODY FOUND', '#ff8a3a', 0.45); break;
            case 'pickup':
                fx.burst(x, 0.5, z, 30, e.kind === 'intel' ? 0xffe45c : 0xff3fa4, { speed: 4, up: 4, size: 0.2, life: 0.8 });
                fx.ring(x, z, e.kind === 'intel' ? 0xffe45c : 0xff3fa4, { r1: 1.5 });
                fx.popup(x, z, e.kind === 'intel' ? 'EVIDENCE!' : 'VICE TAPE +1500', e.kind === 'intel' ? '#ffe45c' : '#ff3fa4', 0.5);
                break;
            case 'switch': fx.ring(x, z, 0x8dff8a, { r1: 1 }); fx.popup(x, z, 'CLICK', '#8dff8a', 0.35); break;
            case 'hack': fx.ring(x, z, 0x4dff8a, { r1: 1.4 }); fx.popup(x, z, 'ACCESS GRANTED', '#4dff8a', 0.4); break;
            case 'secure': fx.popup(x, z, 'SECURE — NEEDS JINX', '#ff4a5a', 0.38); break;
            case 'target': {
                const txt = { car: 'TORCHED!', bug: 'BUGGED', photo: 'SNAP!', safe: 'CRACKED!' }[e.kind] ?? 'DONE';
                fx.popup(x, z, txt, '#b44cff', 0.6);
                fx.ring(x, z, 0xb44cff, { r1: 2 });
                if (e.kind === 'photo') { fx.flash = 0.5; fx.flashColor.set(1, 1, 1); }
                break;
            }
            case 'door': break;
            case 'dart': fx.sparks(x, z, 0x6affd8, 5); break;
            case 'dartHit': fx.burst(x, 0.6, z, 12, 0x6affd8, { speed: 3, size: 0.14, life: 0.4 }); break;
            case 'ricochet': fx.sparks(x, z, 0x6affd8, 6); break;
            case 'camBroken': fx.sparks(x, z, 0xffd060, 18); fx.popup(x, z, 'CAMERA DOWN', '#ffd060', 0.35); break;
            case 'camOff': fx.popup(x, z, 'CAMERA OFF', '#b44cff', 0.35); break;
            case 'gunshot': {
                const dx = Math.cos(e.a), dz = Math.sin(e.a);
                fx.burst(x + dx * 0.5, 0.45, z + dz * 0.5, 8, 0xffe080, { speed: 3, up: 0.5, size: 0.2, life: 0.15, grav: 0 });
                break;
            }
            case 'bulletHit': fx.burst(x, 0.5, z, 14, 0xff2e3e, { speed: 3, size: 0.16, life: 0.4 }); fx.shake = Math.max(fx.shake, 0.2); break;
            case 'spark': fx.sparks(x, z, e.kind === 'dart' ? 0x6affd8 : 0xffd060, 5); break;
            case 'hurt': if (!e.vip) fx.popup(x, z, '−♥', '#ff3f6a', 0.45); fx.burst(x, 0.6, z, 12, 0xff3f6a, { speed: 3, size: 0.18 }); fx.flash = Math.max(fx.flash, 0.1); fx.flashColor.set(1, 0, 0.2); break;
            case 'downed': fx.popup(x, z, 'DOWN!', '#ff2e3e', 0.55); break;
            case 'heal': fx.burst(x, 0.6, z, 12, 0x8dff8a, { speed: 2, up: 3, size: 0.2, life: 0.7, grav: -1 }); fx.popup(x, z, '+♥', '#8dff8a', 0.4); break;
            case 'revive': fx.popup(x, z, 'BACK UP!', '#8dff8a', 0.5); fx.ring(x, z, 0x8dff8a, { r1: 1.4 }); break;
            case 'pulse': fx.ring(x, z, 0x8dff8a, { r1: 2.8, life: 0.6, width: 0.1 }); break;
            case 'boom': fx.explosion(x, z, e.r); break;
            case 'ghost': fx.ring(x, z, 0xb44cff, { r1: 1.4 }); fx.burst(x, 0.5, z, 20, 0xb44cff, { speed: 2, size: 0.2 }); break;
            case 'anchor': fx.ring(x, z, 0x4fd8ff, { r1: 2.6, life: 0.5, width: 0.15 }); fx.burst(x, 0.2, z, 30, 0x4fd8ff, { speed: 7, up: 1, size: 0.2 }); fx.shake = 0.4; break;
            case 'boombox': fx.ring(x, z, 0xffe45c, { r1: 9, life: 1, width: 0.03 }); fx.popup(x, z, 'DANCE!', '#ffe45c', 0.5); break;
            case 'rebank': fx.ring(x, z, 0x2ff2e0, { r1: 1.3 }); fx.popup(x, z, 'BANK ON IT', '#2ff2e0', 0.42); break;
            case 'extract': fx.burst(x, 0.5, z, 26, 0xff3fa4, { speed: 3, up: 4, size: 0.22 }); fx.popup(x, z, e.vip ? 'DELIVERED!' : 'OUT!', '#ff3fa4', 0.5); break;
            case 'exitLocked': { const ex = W.L.exits[0]; fx.popup(ex.x, ex.y, 'FINISH THE JOB FIRST', '#ff2e3e', 0.38); break; }
            case 'join': fx.burst(x, 0.6, z, 30, CREW[e.who]?.look.ring ?? 0xffffff, { speed: 3, up: 3, size: 0.22 }); fx.popup(x, z, `${CREW[e.who]?.short ?? ''} JOINS!`, '#ff4fa8', 0.55); break;
            case 'carHit': fx.sparks(x, z, 0xffffff, 14); fx.shake = 0.3; break;
            case 'laser': fx.burst(x, 0.4, z, 10, 0xff2040, { speed: 2, size: 0.15 }); break;
            case 'noise': if (e.r > 2.6) fx.ring(x, z, 0xffffff, { r1: e.r, life: 0.6, width: 0.025, opacity: 0.35 }); break;
            case 'wake': fx.popup(x, z, 'WOKE UP', '#ff8a3a', 0.35); break;
        }
        this.actors.on(e, W, this.board.getaway);
    }

    // ------------------------------------------------------------------ frame
    frame(dt, ctx = {}) {
        this.t += dt;
        this.vhs = Math.max(ctx.vhsHold ? this.vhs : 0, this.vhs - dt * 1.4);
        const g = this.r.grade.uniforms;
        g.uVhs.value = Math.max(this.vhs, ctx.vhsHold ?? 0);
        if (this.mode === 'cinema' || !this.W) {
            this._bloom(0.8, 0.5, 0.78);
            this.cinema.update(dt, this.cinemaOpts);
            g.uFlash.value = this.cinema.flash * 0.15; g.uFlashColor.value.set(0.8, 0.9, 1);
            this.r.render(this.cinema.scene, this.cinema.camera, this.t);
            return;
        }
        const W = this.W, S = W.S, B = this.board;
        const BL = { night: [0.85, 0.45, 0.7], dusk: [0.7, 0.45, 0.8], storm: [0.75, 0.45, 0.75], sunset: [0.45, 0.35, 0.9], dawn: [0.35, 0.3, 0.94], day: [0.3, 0.3, 0.95] }[W.def.time] ?? [0.7, 0.45, 0.8];
        this._bloom(...BL);
        ctx.camYaw = this.cam.yaw;
        this.actors.sync(W, dt, ctx);
        this.overlay.update(W, dt, ctx.aim, ctx.showPatrols);
        this._syncBoard(dt);
        // trails behind anything rolling
        for (const b of S.bodies) {
            if (b.gone || b.ctl) continue;
            const sp = Math.hypot(b.vx, b.vy);
            if (sp < 1.5) continue;
            const col = b.kind === 'crew' ? CREW[b.who]?.look.ring ?? 0x2ff2e0 : 0xff6070;
            if (Math.random() < Math.min(1, sp / 8)) this.fx.trail(b.x, b.y, col, 0.12 + Math.min(0.2, sp * 0.012));
        }
        for (const bb of S.boomboxes) if (Math.random() < dt * 5) this.fx.burst(bb.x, 0.6, bb.y, 1, [0xffe45c, 0xff3fa4, 0x2ff2e0][Math.floor(Math.random() * 3)], { speed: 0.6, up: 2.5, size: 0.3, life: 1, grav: -0.5 });
        this.fx.update(dt);
        this._updateCamera(dt, ctx);
        // storm lightning
        if (W.def.time === 'storm') {
            if (Math.random() < dt * 0.12) this.lightning = 1;
            this.lightning = Math.max(0, this.lightning - dt * 2.5);
            const fl = this.lightning > 0.6 || (this.lightning > 0.2 && this.lightning < 0.35) ? this.lightning : 0;
            this.hemi.intensity = (TIMES.storm.ambI * 2.2 + 0.4) + fl * 2.5;
            if (B.rain) {
                const p = B.rain.geometry.attributes.position.array;
                for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 18; p[i + 4] -= dt * 18; if (p[i + 1] < 0) { p[i + 1] += 12; p[i + 4] += 12; } }
                B.rain.geometry.attributes.position.needsUpdate = true;
            }
            g.uFlash.value = Math.max(this.fx.flash, fl * 0.12); g.uFlashColor.value.set(0.8, 0.85, 1);
        } else {
            g.uFlash.value = this.fx.flash;
            g.uFlashColor.value.copy(this.fx.flashColor);
        }
        this.r.render(this.scene, this.camera, this.t);
    }

    _bloom(strength, radius, threshold) {
        const b = this.r.bloom;
        b.strength = strength; b.radius = radius; b.threshold = threshold;
    }

    _syncBoard(dt) {
        const W = this.W, S = W.S, L = W.L, B = this.board, t = this.t;
        if (B.water) B.water.uniforms.uTime.value = t;
        // breakables follow the tiles (so Instant Replay puts them back)
        for (const [i, m] of B.breakables) m.visible = S.tiles[i] === L.tilesInit[i];
        for (const [g, list] of Object.entries(B.doors)) {
            const open = !!S.doors[g];
            for (const d of list) { d.t += ((open ? 1 : 0) - d.t) * Math.min(1, dt * 4); d.g.position.y = -d.t * 0.92; d.g.visible = d.t < 0.98; }
        }
        B.intel.forEach((it, i) => this._syncPickup(it, S.intel[i], dt));
        B.tapes.forEach((it, i) => this._syncPickup(it, S.tapes[i], dt));
        B.switches.forEach((s, i) => { const on = S.switches[i]; s.btn.position.y = on ? 0.04 : 0.08; if (on) s.lit.color.set(0x40ff80).multiplyScalar(1.6); else s.lit.color.copy(s.base); });
        B.terms.forEach((tm, i) => {
            if (!tm || tm.done === S.terms[i]) return;
            tm.done = S.terms[i];
            tm.base ??= { trim: tm.trim.material.color.clone(), scr: tm.scrMat.color.clone() };
            if (tm.done) { tm.trim.material.color.set(0x40fff0); tm.scrMat.color.set(0x80fff0); }
            else { tm.trim.material.color.copy(tm.base.trim); tm.scrMat.color.copy(tm.base.scr); }
        });
        B.targets.forEach((tg, i) => {
            const done = S.targets[i];
            tg.ring.material.opacity = done ? 0.15 : 0.55 + 0.35 * Math.sin(t * 5 + i);
            tg.ring.material.color.set(done ? 0x40ff80 : tg.kind === 'bug' ? 0xd070ff : tg.kind === 'photo' ? 0xffe45c : 0xff4060);
            if (tg.g.userData.door && done) tg.g.userData.door.rotation.y = -0.6;
        });
        S.cams.forEach((c, i) => {
            const v = B.cams[i];
            if (!v) return;
            v.head.rotation.y = Math.PI / 2 - c.a;
            v.head.rotation.x = c.broken ? 0.7 : 0;
            v.led.material.color.set(c.broken || c.off ? 0x101010 : (Math.sin(t * 6) > 0 ? 0xff2030 : 0x400008));
        });
        S.lasers.forEach((l, i) => { const v = B.lasers[i]; if (!v) return; v.beam.visible = !l.cut; v.beamMat.opacity = l.live ? 0.9 : 0.06; });
        for (const b of B.bumpers) { b.flash = Math.max(0, b.flash - dt * 4); b.ringMat.color.copy(b.base).multiplyScalar(1.6 + b.flash * 3); b.cap.scale.y = 1 - b.flash * 0.4; }
        for (const bl of B.blink) {
            const m = bl.mat;
            const on = bl.sign ? (Math.sin(t * 0.7 + bl.seed) > -0.97 || Math.sin(t * 23) > 0) : Math.sin(t * 5 + bl.seed) > 0;
            if (bl.sign) m.opacity = on ? 1 : 0.35;
            else if (m.emissiveIntensity !== undefined) m.emissiveIntensity = on ? 2.5 : 0.3;
        }
        for (const s of B.spin) s.rotation.y += dt * 3;
        for (const m of B.signs ?? []) m.rotation.y = this.cam.yaw;
        for (const f of B.flutter) f.rotation.y = Math.sin(t * 3) * 0.2;
        for (const r of B.rotors) r.rotation.y += dt * (W.S.phase === 'won' ? 30 : 2);
        if (W.def.danceFloor && B.floorMat) B.floorMat.emissiveIntensity = 0.75 + 0.35 * Math.sin(t * 8.4);
        if (B.exitArrow) { B.exitArrow.position.y = 1.6 + Math.sin(t * 3) * 0.2; B.exitArrow.material.opacity = W.objectivesLeft() === 0 ? 1 : 0.35; }
        // palm canopies fade when something is under them
        for (const p of B.palms) {
            let near = false;
            for (const b of S.bodies) if (!b.gone && Math.hypot(b.x - p.x, b.y - (p.y + 1.4)) < 2) { near = true; break; }
            const mat = p.obj.userData.leafMat;
            mat.opacity += ((near ? 0.3 : 1) - mat.opacity) * Math.min(1, dt * 5);
            mat.depthWrite = mat.opacity > 0.9;
            p.obj.userData.crown.rotation.y = Math.sin(t * (W.def.time === 'storm' ? 3 : 0.8) + p.x) * (W.def.time === 'storm' ? 0.25 : 0.05);
        }
    }

    _syncPickup(it, got, dt) {
        if (got) {
            it.t = Math.min(1, it.t + dt * 3);
            it.g.scale.setScalar(Math.max(0.001, 1 - it.t));
            it.g.visible = it.t < 1;
        } else {
            it.t = 0; it.g.visible = true; it.g.scale.setScalar(1);
            it.p.rotation.y += dt * 2;
            it.p.position.y = 0.45 + Math.sin(this.t * 3 + it.g.position.x) * 0.08;
        }
    }
}
