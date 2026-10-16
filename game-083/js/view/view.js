// The view: reads G every frame and draws it as beams of light; answers sim events with effects.
// Never changes G.
//
// Act I is Battlezone: a green world seen from the dragon's eyes, mountains and a smoking
// volcano (home) on the horizon, a crescent moon, standing stones and ruins on the plain.
// Act II is Star Wars: coloured vectors, stars, the ramparts' grid and the gorge's walls,
// with a targeting cross that fire converges on.
//
// Coordinates: on foot the sim's (x, y, z) is three's (x, y, z). In flight the sim flies along
// +z, and three's camera looks down -z, so the sim's (x, y, z) is three's (x, y, -z).

import * as THREE from 'three';
import { GROUND, FLIGHT, TRACKS } from '../config.js';
import { ENEMY, STAGES, BEATS } from '../sim/data.js';
import { obstaclesNear } from '../sim/world.js';
import { hash3 } from '../rng.js';
import { Renderer } from './renderer.js';
import { Fx } from './fx.js';
import { Hud } from './hud.js';
import { MODELS, OB_BASE_R, drawModel, placedSegments, towerModel } from './models.js';

export const COL = {
    green: [0.3, 1, 0.4],
    dim: [0.18, 0.75, 0.28],
    red: [1, 0.25, 0.15],
    amber: [1, 0.72, 0.2],
    fire: [1, 0.55, 0.12],
    flame: [1, 0.85, 0.35],
    white: [0.95, 0.97, 1],
    cyan: [0.3, 0.95, 1],
    blue: [0.3, 0.5, 1],
    violet: [0.75, 0.4, 1],
    gold: [1, 0.85, 0.3],
    magenta: [1, 0.35, 0.85],
    yellow: [1, 1, 0.35],
};

const ENEMY_COL = {
    footman: COL.green, ballista: COL.green, lancer: COL.green, wizard: COL.green, troll: COL.green,
    juggernaut: COL.green, dragonbane: COL.green, wisp: COL.cyan,
    griffon: COL.gold, tower: COL.red, spire: COL.magenta, turret: COL.red, wardstone: COL.magenta,
};

const H_FOV = 70 * Math.PI / 180;      // horizontal field of view on a wide band

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.r = new Renderer(canvas);
        this.fx = new Fx();
        this.hud = new Hud(this);
        this.time = 0;
        this.shakeT = 0; this.shakeAmt = 0;
        this.recoil = 0;
        this.mode = 'ground';
        this.tmpV = new THREE.Vector3();
        this.obs = [];
        this.buildHorizon();
        this.stars = [];
        for (let i = 0; i < 260; i++) {
            const u = hash3(i, 7, 3) * 2 - 1, a = hash3(i, 11, 5) * Math.PI * 2, s = Math.sqrt(1 - u * u);
            this.stars.push({ x: Math.cos(a) * s, y: u, z: Math.sin(a) * s, b: 0.25 + hash3(i, 3, 9) * 0.7, ph: hash3(i, 1, 1) * 10 });
        }
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = window.devicePixelRatio || 1;
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        this.r.resize(w, h, dpr);
        this.setFov();
    }

    setFov() {
        const cam = this.r.camera, a = cam.aspect;
        let v = 2 * Math.atan(Math.tan(H_FOV / 2) / a);
        // the flight cursor must fit: at least ±aimPitch plus a margin
        v = Math.max(v, 2 * FLIGHT.aimPitch + 0.22);
        cam.fov = v * 180 / Math.PI;
        cam.updateProjectionMatrix();
        this.tanH = Math.tan(v / 2) * a;   // tan of half the horizontal fov
        this.tanV = Math.tan(v / 2);
    }

    setCrt(on) { this.r.crt = on; this.r.clearHistory = true; }

    /** A pointer on the screen → the flight cursor it points at (ax, ay in [-1, 1]), through the band. */
    screenToAim(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const B = this.r.layout.cssBand;
        const nx = ((clientX - rect.left - B.left) / B.width) * 2 - 1;
        const ny = -(((clientY - rect.top - B.top) / B.height) * 2 - 1);
        // undo the camera's bank
        const roll = this.r.camera.rotation.z;
        const c = Math.cos(-roll), s = Math.sin(-roll);
        const rx = (nx * c - ny * s * this.tanV / this.tanH), ry = (nx * s * this.tanH / this.tanV + ny * c);
        const yaw = Math.atan(rx * this.tanH), pitch = Math.atan(ry * this.tanV);
        return { x: Math.max(-1, Math.min(1, yaw / FLIGHT.aimYaw)), y: Math.max(-1, Math.min(1, pitch / FLIGHT.aimPitch)) };
    }

    // ------------------------------------------------------------------ coordinates
    /** Sim position → three position (written into out). */
    w3(G, x, y, z, out = this.tmpV) {
        if (G.mode === 'flight') return out.set(x, y, -z);
        return out.set(x, y, z);
    }

    // ------------------------------------------------------------------ horizon
    buildHorizon() {
        // mountains: azimuth → elevation (radians), a jagged ridge with a volcano dead ahead (home)
        // jagged peaks every few degrees, as Battlezone drew its mountains
        const N = 90, ridge = [];
        for (let i = 0; i <= N; i++) {
            const a = (i / N) * Math.PI * 2;
            const k = i % N;
            const peak = i % 2 === 0;
            let e = peak ? 0.03 + hash3(k, 5, 1) * 0.055 : 0.012 + hash3(k, 6, 1) * 0.02;
            if (hash3(k, 7, 1) < 0.2) e *= 0.4;                                    // low passes
            const dv = Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI);       // distance from azimuth 0
            if (dv < 0.2) e = Math.max(e * 0.5, 0.115 - dv * 0.45);                // the volcano's cone, home
            if (dv < 0.04) e = 0.098;                                              // its crater
            ridge.push([a, Math.max(0.004, e)]);
        }
        this.ridge = ridge;
        // the king's castle on a hill, at azimuth 2.1
        const C = [];
        const base = 2.1, s = 0.0045;
        const outline = [[-12, 0], [-12, 6], [-10, 6], [-10, 12], [-9, 14], [-8, 12], [-8, 6], [-5, 6], [-5, 8], [-4, 8], [-4, 6], [-2, 6], [-2, 9], [-1, 9], [-1, 13], [0, 17], [1, 13], [1, 9], [2, 9], [2, 6], [4, 6], [4, 8], [5, 8], [5, 6], [8, 6], [8, 12], [9, 14], [10, 12], [10, 6], [12, 6], [12, 0]];
        for (const [x, y] of outline) C.push([base + x * s, 0.045 + y * s]);
        this.castle = C;
    }

    drawHorizon(b, cx, cy, cz, col, inten, drop = 0) {
        const R = 700;
        const P = (a, e) => [cx + Math.sin(a) * R, cy + (Math.tan(e - drop)) * R, cz - Math.cos(a) * R];
        b.pen(col, inten * 0.8, 1);
        const n = this.ridge.length;
        let prev = P(this.ridge[0][0], this.ridge[0][1]);
        for (let i = 1; i < n; i++) {
            const q = P(this.ridge[i][0], this.ridge[i][1]);
            b.seg3(prev[0], prev[1], prev[2], q[0], q[1], q[2]);
            prev = q;
        }
        // the horizon line itself, and the volcano's crater rim
        b.pen(col, inten * 0.5, 1);
        prev = P(0, 0);
        for (let i = 1; i <= 48; i++) {
            const q = P((i / 48) * Math.PI * 2, 0);
            b.seg3(prev[0], prev[1], prev[2], q[0], q[1], q[2]);
            prev = q;
        }
        b.pen(col, inten * 0.85, 1);
        prev = P(this.castle[0][0], this.castle[0][1]);
        for (let i = 1; i < this.castle.length; i++) {
            const q = P(this.castle[i][0], this.castle[i][1]);
            b.seg3(prev[0], prev[1], prev[2], q[0], q[1], q[2]);
            prev = q;
        }
        // the volcano smokes: rising puffs above the crater
        const t = this.time;
        for (let k = 0; k < 6; k++) {
            const ph = (t * 0.12 + k / 6) % 1;
            const a = Math.sin(k * 2.3 + t * 0.2) * 0.012 * (1 + ph * 2);
            const e = 0.106 + ph * 0.09;
            const r = 0.006 + ph * 0.012;
            b.pen(col, inten * 0.55 * (1 - ph), 1);
            const c0 = P(a - r, e), c1 = P(a, e + r), c2 = P(a + r, e), c3 = P(a, e - r * 0.5);
            b.seg3(...c0, ...c1); b.seg3(...c1, ...c2); b.seg3(...c2, ...c3); b.seg3(...c3, ...c0);
        }
        // a crescent moon
        const ma = -0.5, me = 0.11 - drop, mr = 0.035;
        b.pen(col, inten * 0.9, 1);
        const M = (u, v) => P(ma + u, me + v);
        let p0 = null, q0 = null;
        for (let i = 0; i <= 16; i++) {
            const a = -Math.PI / 2 + (i / 16) * Math.PI;
            const p = M(Math.cos(a) * mr, Math.sin(a) * mr);
            const q = M(Math.cos(a) * mr * 0.45 + mr * 0.15, Math.sin(a) * mr * 0.92);
            if (p0) { b.seg3(...p0, ...p); b.seg3(...q0, ...q); }
            p0 = p; q0 = q;
        }
    }

    drawStars(b, cx, cy, cz, aboveOnly, inten = 1) {
        const R = 650, t = this.time;
        for (const s of this.stars) {
            if (aboveOnly && s.y < 0.04) continue;
            b.pen(COL.white, s.b * inten * (0.7 + 0.3 * Math.sin(t * 2 + s.ph)), 0.9);
            b.dot3(cx + s.x * R, cy + s.y * R, cz + s.z * R);
        }
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) this.event(G, e);
    }

    event(G, e) {
        const fx = this.fx, hud = this.hud;
        const flight = G.mode === 'flight';
        const P = (x, y, z) => { const v = this.w3(G, x, y, z); return [v.x, v.y, v.z]; };
        switch (e.type) {
            case 'kill': {
                const [x, y, z] = P(e.x, e.y, e.z);
                const col = ENEMY_COL[e.kind] || COL.green;
                const big = e.kind === 'dragonbane' ? 3 : e.kind === 'juggernaut' || e.kind === 'wardstone' ? 1.6 : 1;
                const segs = this.segsFor(G, e, x, y, z);
                fx.shatter(segs, x, y + (flight ? 0 : 1), z, col, big * (flight ? 1.6 : 1), flight ? 0 : 16, flight ? 1.2 : 1.8);
                fx.sparks3(x, y + 1, z, COL.fire, 22 * big, 12 * big, 0.8, flight ? 0 : 8);
                fx.ring(x, flight ? y : 0.2, z, flight ? col : COL.fire, 5 * big, 0.6, flight);
                if (e.score) hud.popup(`+${e.score}`, col);
                if (e.kind === 'dragonbane') { this.shake(1.2, 1.2); this.r.flashScreen([1, 0.9, 0.6], 0.6); }
                if (e.kind === 'wisp') hud.popup('WILL-O-WISP', COL.cyan);
                break;
            }
            case 'hit': {
                const [x, y, z] = P(e.x, e.y, e.z);
                fx.sparks3(x, y + (flight ? 0 : 1.5), z, COL.flame, 12, 8, 0.5, flight ? 0 : 6);
                break;
            }
            case 'shotHit': {
                const [x, y, z] = P(e.x, e.y, e.z);
                fx.sparks3(x, y, z, COL.fire, 8, 5, 0.4, flight ? 0 : 6);
                break;
            }
            case 'foeShot': {
                const [x, y, z] = P(e.x, e.y, e.z);
                fx.sparks3(x, y, z, flight ? COL.fire : COL.violet, 16, 9, 0.5, 0);
                fx.ring(x, y, z, COL.flame, 2.5, 0.35, flight);
                if (e.score) hud.popup(`+${e.score}`, COL.flame);
                break;
            }
            case 'foeHit': {
                const [x, y, z] = P(e.x, e.y, e.z);
                fx.sparks3(x, y, z, COL.dim, 6, 4, 0.4, 6);
                break;
            }
            case 'enemyFire': {
                const [x, y, z] = P(e.x, e.y, e.z);
                fx.sparks3(x, y, z, flight ? COL.red : COL.green, 5, 3, 0.3, 0);
                break;
            }
            case 'fire':
                this.recoil = 1;
                hud.flame = 1;
                break;
            case 'hurt':
                this.shake(flight ? 0.5 : 0.35, 0.35);
                this.r.flashScreen(flight ? [1, 0.35, 0.2] : [1, 0.15, 0.08], 0.55);
                hud.hurt(G, e);
                break;
            case 'dead':
                this.shake(1.2, 0.8);
                hud.crack();
                break;
            case 'teleport':
                fx.ring(e.x0, 0.2, e.z0, COL.violet, 3, 0.5);
                fx.ring(e.x, 0.2, e.z, COL.violet, 3, 0.5);
                fx.sparks3(e.x0, 1.5, e.z0, COL.violet, 12, 4, 0.6, -2);
                break;
            case 'wispGone':
                fx.ring(e.x, e.y, e.z, COL.cyan, 3, 0.5, true);
                break;
            case 'smash':
                this.shake(0.6, 0.3);
                break;
            case 'crash': {
                const [x, y, z] = P(e.x, e.y, e.z);
                fx.sparks3(x, y, z, COL.flame, 26, 10, 0.6, flight ? 0 : 8);
                this.shake(0.6, 0.4);
                break;
            }
            case 'bonus':
                hud.popup(e.text, COL.yellow, 2.2);
                hud.popup(`+${e.score}`, COL.yellow, 2.2);
                break;
            case 'clear':
                if (e.bonus) hud.popup(`BONUS +${e.bonus}`, flight ? COL.yellow : COL.red, 2.2);
                break;
            case 'stage':
                this.fx.reset();
                this.r.clearHistory = true;
                hud.reset();
                if (e.mode === 'flight' && STAGES[e.stage].id === 'sky') this.r.flashScreen([1, 1, 1], 0.9);
                break;
            case 'ascend':
                this.r.flashScreen([1, 0.8, 0.4], 0.7);
                break;
            case 'gate': {
                const fl = G.fl;
                const [x, y, z] = P(0, 10, fl.len);
                fx.sparks3(x, y, z, COL.magenta, 80, 30, 1.4, 0);
                fx.sparks3(x, y, z, COL.white, 50, 22, 1.2, 0);
                fx.ring(x, y, z, COL.magenta, 26, 1.2, true);
                this.r.flashScreen([1, 0.85, 1], 0.8);
                this.shake(1, 1);
                break;
            }
            case 'missed':
                hud.popup('MISSED! THE WARD HOLDS', COL.magenta, 2.6);
                hud.popup('BACK DOWN THE GORGE', COL.magenta, 2.6);
                this.r.flashScreen([1, 0.4, 1], 0.7);
                break;
            case 'swoop':
                break;
        }
    }

    /** The model segments of a killed enemy, placed where it died, for its explosion. */
    segsFor(G, e, x, y, z) {
        const flight = G.mode === 'flight';
        if (e.kind === 'griffon') return this.griffonSegs(x, y, z, this.time, 0);
        if (e.kind === 'tower' || e.kind === 'spire') return placedSegments(MODELS.crystal, x, y, z, 0, e.kind === 'spire' ? 1.6 : 1.1);
        if (e.kind === 'turret') return placedSegments(MODELS.turret, x, y, z, Math.PI, 1);
        if (e.kind === 'wardstone') return this.runeSegs(x, y, z);
        if (e.kind === 'wisp') return this.wispSegs(x, y, z, 1.4);
        const m = MODELS[e.kind];
        if (!m) return [];
        const segs = placedSegments(m, x, flight ? y : 0, z, e.h || 0, 1);
        if (e.kind === 'dragonbane') segs.push(...placedSegments(MODELS.dragonbaneTurret, x, 0, z, e.h || 0));
        return segs;
    }

    shake(amt, dur) { this.shakeAmt = Math.max(this.shakeT > 0 ? this.shakeAmt : 0, amt); this.shakeT = Math.max(this.shakeT, dur); }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.resize();
        this.time = time;
        const r = this.r, cam = r.camera;
        r.sky.begin(); r.world.begin(); r.hud.begin();
        if (G.mode !== this.mode) { this.mode = G.mode; this.fx.reset(); }

        let sx = 0, sy = 0;
        if (this.shakeT > 0) {
            this.shakeT -= dt;
            const k = Math.min(1, this.shakeT * 4) * this.shakeAmt;
            sx = (Math.random() - 0.5) * k; sy = (Math.random() - 0.5) * k;
        }
        this.recoil = Math.max(0, this.recoil - dt * 6);
        r.fade = 1;

        if (G.mode === 'ground') this.drawGround(G, dt, sx, sy);
        else this.drawFlight(G, dt, sx, sy);

        this.fx.step(dt);
        this.fx.draw(r.world);
        this.hud.draw(G, dt);
        r.sky.end(); r.world.end(); r.hud.end();
        cam.updateMatrixWorld();
        r.render(dt, time);
    }

    // ------------------------------------------------------------------ Act I
    drawGround(G, dt, sx, sy) {
        const r = this.r, cam = r.camera, b = r.world, p = G.player, t = this.time;
        r.world.setFar(GROUND.radar + 40);
        // the dragon's gait: a heavy sway when it walks
        const walk = Math.min(1, Math.abs(p.speed) / GROUND.speed);
        this.gait = (this.gait || 0) + dt * Math.abs(p.speed) * 0.7;
        const bob = Math.sin(this.gait) * 0.12 * walk;
        let ey = GROUND.eye + bob + sy, pitch = -this.recoil * 0.012, fwd = 0;
        let ascend = 0;
        if (G.phase === 'ascend') {
            ascend = 1 - G.phaseT / BEATS.ascend;
            const k = Math.min(1, Math.max(0, (ascend - 0.12) / 0.88));
            ey += k * k * 70;
            pitch += -Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35 + k * k * 0.25;
            fwd = k * k * k * 40;
            r.fade = ascend > 0.85 ? Math.max(0, 1 - (ascend - 0.85) / 0.15) : 1;
        }
        const cx = p.x + Math.sin(p.h) * fwd + Math.cos(p.h) * sx, cz = p.z - Math.cos(p.h) * fwd + Math.sin(p.h) * sx;
        cam.position.set(cx, ey, cz);
        cam.rotation.order = 'YXZ';
        cam.rotation.set(pitch, -p.h, Math.sin(this.gait * 0.5) * 0.006 * walk);

        // horizon (no distance fade), then the plain
        const sk = r.sky;
        this.drawHorizon(sk, cx, ey * 0.98, cz, COL.green, 0.9);
        if (ascend > 0.3) this.drawStars(sk, cx, ey, cz, true, (ascend - 0.3) * 1.4);

        // ground specks give the walk a sense of speed
        const S = 6, n = 9;
        const gx0 = Math.round(p.x / S), gz0 = Math.round(p.z / S);
        b.pen(COL.dim, 0.35, 0.8);
        for (let i = -n; i <= n; i++) {
            for (let j = -n; j <= n; j++) {
                const h = hash3(gx0 + i, gz0 + j, 77);
                if (h > 0.3) continue;
                const x = (gx0 + i + hash3(gx0 + i, gz0 + j, 78) - 0.5) * S, z = (gz0 + j + hash3(gx0 + i, gz0 + j, 79) - 0.5) * S;
                if (h < 0.06) b.seg3(x - 0.3, 0, z, x + 0.3, 0, z);
                else b.dot3(x, 0, z);
            }
        }

        // obstacles
        obstaclesNear(G.seed, p.x, p.z, GROUND.radar + 30, this.obs);
        b.pen(COL.dim, 0.85, 1);
        for (const o of this.obs) drawModel(b, MODELS[o.kind], o.x, 0, o.z, o.rot, o.r / OB_BASE_R[o.kind]);

        // enemies
        for (const e of G.enemies) this.drawGroundEnemy(b, G, e, t);

        // the dragon's fireballs
        for (const s of G.shots) {
            const k = 0.6;
            b.pen(COL.fire, 1.1, 1.8);
            b.seg3(s.x - s.vx * 0.012, s.y, s.z - s.vz * 0.012, s.x, s.y, s.z);
            b.pen(COL.flame, 1.3, 1.3);
            const a = t * 20;
            b.seg3(s.x - Math.cos(a) * k, s.y - Math.sin(a) * k, s.z, s.x + Math.cos(a) * k, s.y + Math.sin(a) * k, s.z);
            b.seg3(s.x, s.y - k, s.z - Math.cos(a) * k, s.x, s.y + k, s.z + Math.cos(a) * k);
        }
        // their missiles
        for (const f of G.foes) {
            const sp = Math.hypot(f.vx, f.vz) || 1, ux = f.vx / sp, uz = f.vz / sp;
            if (f.kind === 'spear') {
                b.pen(COL.green, 1, 1);
                b.seg3(f.x - ux * 2.2, f.y + 0.1, f.z - uz * 2.2, f.x, f.y, f.z);
                b.seg3(f.x - uz * 0.2, f.y, f.z + ux * 0.2, f.x + ux * 0.4, f.y, f.z + uz * 0.4);
                b.seg3(f.x + uz * 0.2, f.y, f.z - ux * 0.2, f.x + ux * 0.4, f.y, f.z + uz * 0.4);
            } else if (f.kind === 'bolt') {
                b.pen(COL.green, 1.3, 1.3);
                b.seg3(f.x - ux * 2.6, f.y, f.z - uz * 2.6, f.x, f.y, f.z);
                b.seg3(f.x - ux * 2.6 - uz * 0.35, f.y, f.z - uz * 2.6 + ux * 0.35, f.x - ux * 2.2, f.y, f.z - uz * 2.2);
                b.seg3(f.x - ux * 2.6 + uz * 0.35, f.y, f.z - uz * 2.6 - ux * 0.35, f.x - ux * 2.2, f.y, f.z - uz * 2.2);
                b.pen(COL.white, 1.3, 1.5);
                b.dot3(f.x, f.y, f.z);
            } else if (f.kind === 'orb') {
                const a = t * 6;
                b.pen(COL.violet, 1.3, 1.2);
                for (let i = 0; i < 6; i++) {
                    const a0 = a + (i / 6) * Math.PI * 2, a1 = a + ((i + 1) / 6) * Math.PI * 2;
                    b.seg3(f.x + Math.cos(a0) * 0.8, f.y + Math.sin(a0) * 0.8, f.z, f.x + Math.cos(a1) * 0.8, f.y + Math.sin(a1) * 0.8, f.z);
                }
                b.pen(COL.white, 1.6, 2);
                b.dot3(f.x, f.y, f.z);
            }
        }
    }

    drawGroundEnemy(b, G, e, t) {
        const flash = e.hurtT > 0 && Math.floor(t * 30) % 2 === 0;
        const col = flash ? COL.white : ENEMY_COL[e.kind];
        const inten = 1.15;
        if (e.kind === 'wisp') {
            const segs = this.wispSegs(e.x, e.y, e.z, 1.1 + 0.2 * Math.sin(t * 9));
            b.pen(COL.cyan, 1.2, 1.2);
            for (const s of segs) b.seg3(...s);
            return;
        }
        b.pen(col, inten, 1.1);
        if (e.kind === 'dragonbane') {
            drawModel(b, MODELS.dragonbane, e.x, 0, e.z, e.h);
            drawModel(b, MODELS.dragonbaneTurret, e.x, 0, e.z, e.ta);
            // its ward-eye glows red
            const fx = Math.sin(e.h), fz = -Math.cos(e.h);
            b.pen(COL.red, 1.4 + 0.4 * Math.sin(t * 5), 2);
            b.dot3(e.x + fx * 3.05, 5.9, e.z + fz * 3.05);
            return;
        }
        // walkers bob as they go
        const bob = e.speed ? Math.abs(Math.sin(e.t * (e.kind === 'lancer' ? 9 : 6))) * (e.kind === 'lancer' ? 0.3 : 0.12) : 0;
        drawModel(b, MODELS[e.kind], e.x, (e.y || 0) + bob, e.z, e.h);
        if (e.kind === 'wizard') {
            const ox = e.x + Math.cos(e.h) * 0.7 + Math.sin(e.h) * 0.2, oz = e.z + Math.sin(e.h) * 0.7 - Math.cos(e.h) * 0.2;
            const pulse = e.cd < 0.8 ? 1.8 : 1.1;
            b.pen(COL.violet, pulse + 0.3 * Math.sin(t * 8), 2.2);
            b.dot3(ox, e.y + 2.55, oz);
        }
    }

    wispSegs(x, y, z, s) {
        const t = this.time, out = [];
        for (let i = 0; i < 4; i++) {
            const a = t * 3 + (i / 4) * Math.PI;
            const dx = Math.cos(a) * s, dz = Math.sin(a) * s;
            out.push([x - dx, y, z - dz, x + dx, y, z + dz]);
        }
        out.push([x, y - s, z, x, y + s, z]);
        for (let i = 0; i < 6; i++) {
            const a0 = (i / 6) * Math.PI * 2 - t * 2, a1 = ((i + 1) / 6) * Math.PI * 2 - t * 2;
            out.push([x + Math.cos(a0) * s * 0.6, y + Math.sin(t * 5 + i) * 0.2, z + Math.sin(a0) * s * 0.6, x + Math.cos(a1) * s * 0.6, y + Math.sin(t * 5 + i + 1) * 0.2, z + Math.sin(a1) * s * 0.6]);
        }
        return out;
    }

    // ------------------------------------------------------------------ Act II
    drawFlight(G, dt, sx, sy) {
        const r = this.r, cam = r.camera, b = r.world, sk = r.sky, p = G.player, fl = G.fl, t = this.time;
        const T = TRACKS[fl.track];
        r.world.setFar(270);
        const cz = -fl.dist;
        const roll = Math.max(-0.1, Math.min(0.1, -p.vx * 0.008));
        cam.position.set(p.px + sx, p.py + sy, cz);
        cam.rotation.order = 'YXZ';
        cam.rotation.set(Math.max(-0.06, Math.min(0.06, p.vy * 0.004)), 0, roll);
        if (G.phase === 'intro' && fl.track === 'sky') r.fade = Math.min(1, 0.25 + (BEATS.intro - G.phaseT) / BEATS.intro);

        // the sky: stars all round in open sky, above the horizon over the kingdom
        const sky = fl.track === 'sky';
        this.drawStars(sk, p.px, p.py, cz, !sky, sky ? 1 : 0.7);
        this.drawHorizon(sk, p.px, p.py, cz, sky ? COL.blue : COL.cyan, sky ? 0.5 : 0.7, sky ? 0.22 : 0);

        if (sky) this.drawSpeedDust(b, G);
        else if (fl.track === 'ramparts') this.drawRamparts(b, G);
        else this.drawGorge(b, G);

        for (const e of G.enemies) this.drawFlightEnemy(b, G, e, t);

        // the dragon's fire: darts of flame
        for (const s of G.shots) {
            const z = -s.z;
            b.pen(COL.flame, 1.3, 1.5);
            b.seg3(s.x, s.y, z, s.x - s.vx * 0.018, s.y - s.vy * 0.018, z + (s.vz - FLIGHT.speed) * 0.018);
            b.pen(COL.fire, 0.9, 2.2);
            b.seg3(s.x - s.vx * 0.012, s.y - s.vy * 0.012, z + (s.vz - FLIGHT.speed) * 0.012, s.x - s.vx * 0.03, s.y - s.vy * 0.03, z + (s.vz - FLIGHT.speed) * 0.03);
        }
        // firebolts: spinning stars of fire, as Star Wars drew its fireballs
        for (const f of G.foes) {
            const z = -f.z, a = t * 7 + f.id;
            const s = 1.3 + 0.25 * Math.sin(t * 20 + f.id);
            b.pen(COL.red, 1.4, 1.6);
            for (let i = 0; i < 4; i++) {
                const q = a + (i / 4) * Math.PI;
                b.seg3(f.x - Math.cos(q) * s, f.y - Math.sin(q) * s, z, f.x + Math.cos(q) * s, f.y + Math.sin(q) * s, z);
            }
            b.pen(COL.yellow, 1.3, 1.2);
            const q = -a * 1.3;
            const d = s * 0.6;
            b.seg3(f.x + Math.cos(q) * d, f.y + Math.sin(q) * d, z, f.x - Math.sin(q) * d, f.y + Math.cos(q) * d, z);
            b.seg3(f.x - Math.sin(q) * d, f.y + Math.cos(q) * d, z, f.x - Math.cos(q) * d, f.y - Math.sin(q) * d, z);
            b.seg3(f.x - Math.cos(q) * d, f.y - Math.sin(q) * d, z, f.x + Math.sin(q) * d, f.y - Math.cos(q) * d, z);
            b.seg3(f.x + Math.sin(q) * d, f.y - Math.cos(q) * d, z, f.x + Math.cos(q) * d, f.y + Math.sin(q) * d, z);
        }
    }

    drawSpeedDust(b, G) {
        const p = G.player, d = G.fl.dist;
        const SPAN = 240;
        b.pen(COL.blue, 0.55, 0.8);
        for (let i = 0; i < 90; i++) {
            const x = (hash3(i, 1, 9) - 0.5) * 120 + p.px * 0.2;
            const y = (hash3(i, 2, 9) - 0.5) * 80;
            const z0 = hash3(i, 3, 9) * SPAN;
            const z = z0 - ((d % SPAN) + SPAN) % SPAN;
            const rz = z < 0 ? z + SPAN : z;
            if (rz < 4) continue;
            const wz = -(d + rz);
            b.seg3(x, y, wz, x, y, wz + 2.5);
        }
    }

    drawRamparts(b, G) {
        const d = G.fl.dist;
        // the ground: a grid rushing under the dragon
        b.pen(COL.blue, 0.6, 0.9);
        const z0 = Math.floor(d / 16) * 16;
        for (let z = z0; z < d + 260; z += 16) b.seg3(-90, 0, -z, 90, 0, -z);
        for (let x = -90; x <= 90; x += 15) b.seg3(x, 0, -(d - 4), x, 0, -(d + 260));
        // the outer walls, crenellated, on both sides
        b.pen(COL.cyan, 0.75, 1);
        for (const side of [-1, 1]) {
            const X = side * 70;
            b.seg3(X, 6, -(d - 4), X, 6, -(d + 260));
            b.seg3(X, 0, -(d - 4), X, 0, -(d + 260));
            const mz = Math.floor(d / 8) * 8;
            for (let z = mz; z < d + 260; z += 8) {
                b.seg3(X, 6, -z, X, 7.5, -z);
                b.seg3(X, 7.5, -z, X, 7.5, -(z + 4));
                b.seg3(X, 7.5, -(z + 4), X, 6, -(z + 4));
                if (Math.round(z / 8) % 4 === 0) b.seg3(X, 0, -z, X, 6, -z);
            }
        }
    }

    drawGorge(b, G) {
        const fl = G.fl, d = fl.dist, T = TRACKS.gorge, W = T.wall, H = T.top, t = this.time;
        const far = Math.min(d + 260, fl.len + 2);
        // the walls: long rails and ribs that stream past, as in the trench
        b.pen(COL.blue, 0.75, 1);
        for (const side of [-1, 1]) {
            const X = side * W;
            for (const y of [0, 7, 14, 21, H]) b.seg3(X, y, -(d - 4), X, y, -far);
            const mz = Math.ceil(d / 12) * 12;
            for (let z = mz; z < far; z += 12) b.seg3(X, 0, -z, X, H, -z);
            // the rim, opening out to the plain above
            b.seg3(X, H, -(d - 4), X + side * 30, H, -(d - 4));
        }
        b.pen(COL.blue, 0.45, 0.9);
        const fz = Math.ceil(d / 12) * 12;
        for (let z = fz; z < far; z += 12) b.seg3(-W, 0, -z, W, 0, -z);
        b.seg3(0, 0, -(d - 4), 0, 0, -far);

        // the chain bridges
        for (const w of fl.walks) {
            const rz = w.z - d;
            if (rz < -4 || rz > 265) continue;
            const z = -w.z;
            b.pen(COL.yellow, 1.1, 1.2);
            b.seg3(-W, w.y + 0.7, z - 0.8, W, w.y + 0.7, z - 0.8);
            b.seg3(-W, w.y - 0.7, z - 0.8, W, w.y - 0.7, z - 0.8);
            b.seg3(-W, w.y + 0.7, z + 0.8, W, w.y + 0.7, z + 0.8);
            b.seg3(-W, w.y - 0.7, z + 0.8, W, w.y - 0.7, z + 0.8);
            for (let x = -W; x <= W; x += 2.5) b.seg3(x, w.y - 0.7, z - 0.8, x, w.y - 0.7, z + 0.8);
            b.pen(COL.amber, 0.7, 0.9);
            for (const s of [-1, 1]) {
                b.seg3(s * W, w.y + 0.7, z, s * W * 0.4, H, z);
                b.seg3(s * W * 0.4, H, z, 0, w.y + 0.7, z);
            }
        }

        // the ward gate at the end
        if (fl.len - d < 270) {
            const z = -(fl.len + 6);
            const stone = G.enemies.find((e) => e.kind === 'wardstone');
            b.pen(COL.magenta, stone ? 0.9 : 0.35, 1.1);
            b.seg3(-W, 0, z, W, 0, z); b.seg3(-W, H, z, W, H, z);
            b.seg3(-W, 0, z, -W, H, z); b.seg3(W, 0, z, W, H, z);
            for (let y = 4; y < H; y += 4) b.seg3(-W, y, z, W, y, z);
            for (let x = -W + 3; x < W; x += 3) b.seg3(x, 0, z, x, H, z);
        }
    }

    griffonSegs(x, y, z, t, bank) {
        // a griffon knight seen nose-on: an eagle's head and beak, a lion's body behind, beating wings, a rider and his lance
        const out = [];
        const flap = Math.sin(t * 7) * 0.7;
        const S = (ax, ay, az, bx, by, bz) => out.push([x + ax, y + ay, z + az, x + bx, y + by, z + bz]);
        const c = Math.cos(bank), s = Math.sin(bank);
        const R = (px, py) => [px * c - py * s, px * s + py * c];
        const L = (ax, ay, az, bx, by, bz) => { const [a1, a2] = R(ax, ay), [b1, b2] = R(bx, by); S(a1, a2, az, b1, b2, bz); };
        // body: a diamond running away from the viewer
        L(0, 0.6, 0, 0.7, 0, -0.6); L(0.7, 0, -0.6, 0, -0.6, 0); L(0, -0.6, 0, -0.7, 0, -0.6); L(-0.7, 0, -0.6, 0, 0.6, 0);
        L(0, 0.6, 0, 0, 0, -2.8); L(0, -0.6, 0, 0, 0, -2.8); L(0.7, 0, -0.6, 0, 0, -2.8); L(-0.7, 0, -0.6, 0, 0, -2.8);
        // head and beak, toward the viewer
        L(0, 0.6, 0, 0, 1.1, 0.9); L(0, 1.1, 0.9, 0, 0.55, 1.5); L(0, 0.55, 1.5, 0, 0.6, 0.6);
        L(-0.3, 0.9, 0.5, 0.3, 0.9, 0.5);
        // wings
        for (const sd of [-1, 1]) {
            const wy = flap * 1.6, tip = [sd * 5.2, wy + 0.6], mid = [sd * 2.6, wy * 0.5 + 0.7];
            L(sd * 0.6, 0.2, -0.4, mid[0], mid[1], -0.6);
            L(mid[0], mid[1], -0.6, tip[0], tip[1], -1.2);
            L(tip[0], tip[1], -1.2, sd * 3.6, wy * 0.6 - 0.2, -1.5);
            L(sd * 3.6, wy * 0.6 - 0.2, -1.5, sd * 2.2, wy * 0.3 - 0.1, -1.6);
            L(sd * 2.2, wy * 0.3 - 0.1, -1.6, sd * 0.6, 0, -1.2);
        }
        // the rider and his lance
        L(0, 0.6, -0.9, 0, 1.6, -0.9); L(-0.3, 1.3, -0.9, 0.3, 1.3, -0.9);
        L(0.35, 1.0, -1.5, 0.35, 0.8, 2.2);
        return out;
    }

    runeSegs(x, y, z) {
        const out = [], t = this.time;
        const ring = (r, n, a0) => {
            for (let i = 0; i < n; i++) {
                const a = a0 + (i / n) * Math.PI * 2, b2 = a0 + ((i + 1) / n) * Math.PI * 2;
                out.push([x + Math.cos(a) * r, y + Math.sin(a) * r, z, x + Math.cos(b2) * r, y + Math.sin(b2) * r, z]);
            }
        };
        ring(2.6, 16, t * 0.5);
        ring(1.7, 6, -t);
        for (let i = 0; i < 3; i++) {
            const a = t * 0.8 + (i / 3) * Math.PI * 2;
            out.push([x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, z, x - Math.cos(a) * 1.7, y - Math.sin(a) * 1.7, z]);
        }
        out.push([x, y + 0.9, z, x + 0.7, y, z], [x + 0.7, y, z, x, y - 0.9, z], [x, y - 0.9, z, x - 0.7, y, z], [x - 0.7, y, z, x, y + 0.9, z]);
        return out;
    }

    drawFlightEnemy(b, G, e, t) {
        const fl = G.fl;
        const rz = e.z - fl.dist;
        if (rz < -10 || rz > 280) return;
        const flash = e.hurtT > 0 && Math.floor(t * 30) % 2 === 0;
        const z = -e.z;
        if (e.kind === 'griffon') {
            const bank = Math.max(-0.7, Math.min(0.7, -(e.vx || 0) * 0.03));
            b.pen(flash ? COL.white : COL.gold, 1.15, 1.1);
            for (const s of this.griffonSegs(e.x, e.y, z, t + e.id * 0.37, bank)) b.seg3(...s);
            return;
        }
        if (e.kind === 'tower' || e.kind === 'spire') {
            const big = e.kind === 'spire';
            b.pen(big ? COL.magenta : COL.red, 0.95, 1.1);
            drawModel(b, towerModel(e.th), e.x, 0, z, 0, big ? 1.35 : 1);
            b.pen(flash ? COL.white : COL.yellow, 1.3 + 0.3 * Math.sin(t * 6 + e.id), 1.2);
            drawModel(b, MODELS.crystal, e.x, e.y + Math.sin(t * 2 + e.id) * 0.2, z, t * 1.5, big ? 1.6 : 1.1);
            return;
        }
        if (e.kind === 'turret') {
            b.pen(flash ? COL.white : COL.red, 1.1, 1.1);
            drawModel(b, MODELS.turret, e.x, e.y, z, Math.PI, 1);
            return;
        }
        if (e.kind === 'wardstone') {
            b.pen(flash ? COL.white : COL.magenta, 1.4 + 0.4 * Math.sin(t * 5), 1.4);
            for (const s of this.runeSegs(e.x, e.y, z)) b.seg3(...s);
        }
    }

    /** Where a sim point lands in HUD units, or null if it is behind the camera. */
    toHud(G, x, y, z) {
        const v = this.w3(G, x, y, z, this.tmpV).project(this.r.camera);
        if (v.z > 1 || v.z < -1) return null;
        const L = this.r.layout;
        return { x: L.bx + (v.x + 1) / 2 * L.bw, y: L.by + (v.y + 1) / 2 * L.bh };
    }
}
