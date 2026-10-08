// Sim → beams. Everything on screen is drawn here each frame: stars, the planet's
// mountains, colonists, enemies, bosses, the ship, lasers and shots, plus the
// effects that sim events trigger (explosions, rings, flashes, shake).

import { VIEW_W, FIELD, COL, LASER, WORLD_W } from '../config.js';
import { wdx, wrap } from '../sim/util.js';
import { NEAR, FAR, STEP, SAMPLES } from '../sim/terrain.js';
import { SHAPES, HIVE, rock, drawShape, drawWire, ICO } from '../art/shapes.js';
import { drawText } from '../art/font.js';
import { Renderer } from './renderer.js';
import { Fx } from './fx.js';
import { Hud } from './hud.js';
import { hash01 } from '../rng.js';

const CX = VIEW_W / 2;
const TAU = Math.PI * 2;
const LASER_COLS = [[1, 1, 1], [0.4, 1, 1], [1, 0.95, 0.35], [1, 0.45, 0.9], [0.5, 1, 0.5], [0.6, 0.6, 1]];

const KIND_COL = {
    snatcher: COL.snatcher, ravager: COL.ravager, minelayer: COL.minelayer, mine: COL.mine, hive: COL.hive,
    stinger: COL.stinger, hunter: COL.hunter, dart: COL.dart, meteor: COL.meteor,
    pod: COL.boss, core: COL.bossCore, seg: COL.boss, head: COL.pink, plate: COL.cyan, eye: COL.bossCore,
};

export class View {
    constructor(canvas) {
        this.r = new Renderer(canvas);
        this.fx = new Fx();
        this.hud = new Hud(this.r.hud);
        this.camX = 0;
        this.t = 0;
        this.stars = [];
        for (let layer = 0; layer < 3; layer++) {
            const n = [50, 50, 40][layer];
            for (let i = 0; i < n; i++) {
                // the period of each layer is the world's width at that parallax, so the wrap seam can't be seen
                const p = [0.25, 0.375, 0.5][layer], period = WORLD_W * p;
                this.stars.push({ u: hash01(i * 7 + layer * 1000) * period, period, y: 30 + hash01(i * 13 + layer * 977) * 218, p, b: [0.25, 0.45, 0.75][layer], ph: hash01(i + layer * 50) * 10, layer });
            }
        }
    }

    reset() { this.fx.reset(); this.r.clearHistory = true; }

    beginFrame() {
        this.r.world.begin();
        this.r.hud.begin();
        this.hud.begin();
    }

    endFrame(dt, t) {
        this.t = t;
        this.fx.step(dt);
        this.fx.draw(this.r.world, this.camX, drawText);
        this.hud.end();
        this.r.world.end();
        this.r.hud.end();
        this.r.render(dt, t);
    }

    sx(x) { return CX + wdx(x, this.camX); }

    // ================================================================== backdrop
    drawStars(t, camX = this.camX) {
        const b = this.r.world;
        for (const s of this.stars) {
            const x = ((s.u - camX * s.p) % s.period + s.period) % s.period - (s.period - VIEW_W) / 2;
            if (x < -5 || x > VIEW_W + 5) continue;
            const tw = 0.6 + 0.4 * Math.sin(t * (1.5 + s.layer) + s.ph);
            b.pen(COL.star, s.b * tw * 0.7, 0.55 + s.layer * 0.15);
            b.dot(x, s.y);
        }
    }

    drawTerrain(camX, alive = true, t = 0) {
        const b = this.r.world;
        if (!alive) return;
        // far range: parallax at half speed, dim purple
        const layer = (prof, cam, col, inten, yOff, n = SAMPLES) => {
            const x0 = Math.floor((cam - CX - STEP) / STEP);
            let px = 0, py = 0;
            b.pen(col, inten, 0.9);
            for (let i = 0; i <= Math.ceil(VIEW_W / STEP) + 2; i++) {
                const k = x0 + i;
                const idx = ((k % n) + n) % n;
                const x = CX + (k * STEP - cam), y = FIELD.ground + yOff + prof[idx];
                if (i > 0) b.seg(px, py, x, y);
                px = x; py = y;
            }
        };
        // the far range repeats twice around the world so half-speed parallax wraps cleanly
        layer(FAR, camX * 0.5, COL.mountainFar, 0.38, 0, SAMPLES / 2);
        layer(NEAR, camX, COL.mountain, 0.72, 0);
        // the surface: a faint line with ticks that scroll with the ground
        b.pen(COL.ground, 0.32, 0.7);
        b.seg(0, FIELD.ground - 1, VIEW_W, FIELD.ground - 1);
        const off = ((camX % 40) + 40) % 40;
        b.pen(COL.ground, 0.4, 0.7);
        for (let x = -off; x < VIEW_W; x += 40) b.seg(x, FIELD.ground - 1, x, FIELD.ground - 4);
    }

    // ================================================================== world
    drawWorld(w, t) {
        const b = this.r.world;
        this.camX = w.camX;
        this.drawStars(t);
        this.drawTerrain(w.camX, w.planetAlive, t);
        for (const c of w.colonists) this.drawColonist(c, t);
        for (const e of w.enemies) if (!e.boss) this.drawEnemy(e, t);
        if (w.boss && !w.boss.dead) this.drawBoss(w.boss, t);
        this.drawShip(w.ship, t, w);
        // lasers
        for (const L of w.lasers) {
            const tail = Math.max(0, L.head - LASER.maxLen);
            const n = 7;
            for (let i = 0; i < n; i++) {
                const a = tail + (L.head - tail) * (i / n), c = tail + (L.head - tail) * ((i + 0.82) / n);
                const ax = this.sx(L.ox + L.dir * a), cx = this.sx(L.ox + L.dir * c);
                if (Math.abs(ax - cx) > 300) continue;
                const col = LASER_COLS[(Math.floor(L.hue * 6 + i + t * 30)) % LASER_COLS.length];
                b.pen(col, 0.35 + (i / n) * 1.0, 0.85);
                b.seg(ax, L.y, cx, L.y);
            }
        }
        // enemy shots: little spinning crosses
        for (const s of w.shots) {
            const x = this.sx(s.x);
            if (x < -10 || x > VIEW_W + 10) continue;
            const a = t * 14 + s.x;
            const flick = (Math.floor(t * 20 + s.y) & 1) ? COL.white : COL.shot;
            b.pen(flick, 1.1, 0.8);
            const c = Math.cos(a) * 2.4, d = Math.sin(a) * 2.4;
            b.seg(x - c, s.y - d, x + c, s.y + d);
            b.seg(x + d, s.y - c, x - d, s.y + c);
        }
    }

    drawColonist(c, t) {
        const x = this.sx(c.x);
        if (x < -10 || x > VIEW_W + 10) return;
        const b = this.r.world;
        const y = c.y;
        const panic = c.state !== 'walk';
        b.pen(panic && (t * 8) % 1 < 0.5 ? COL.white : COL.colonist, 1, 0.75);
        const sw = panic ? Math.sin(t * 22 + c.id) * 1.6 : Math.sin(t * 8 + c.id) * 1.4;
        b.seg(x, y + 5.5, x, y + 2.2);
        b.seg(x, y + 2.2, x - 1.4 - sw * 0.4, y);
        b.seg(x, y + 2.2, x + 1.4 + sw * 0.4, y);
        if (panic) { b.seg(x, y + 4.5, x - 2, y + 7 + sw * 0.3); b.seg(x, y + 4.5, x + 2, y + 7 - sw * 0.3); }
        else { b.seg(x - 1.8, y + 4 + sw * 0.2, x + 1.8, y + 4 - sw * 0.2); }
        b.pen(COL.colonist, 1.2, 1.5);
        b.dot(x, y + 7);
    }

    drawEnemy(e, t) {
        const x = this.sx(e.x);
        if (x < -40 || x > VIEW_W + 40) return;
        const b = this.r.world;
        const col = e.hitT > 0 ? COL.white : KIND_COL[e.kind] || COL.white;
        if (e.kind === 'dart' && e.state === 'wait') return;
        if (e.warp > 0) {
            // materialising: sparks spiral in, the outline fades up
            const k = Math.min(1, e.warp / 0.9);
            b.pen(col, 1.1, 0.8);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TAU + t * 5;
                const r = 4 + k * 34;
                b.dot(x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.8);
            }
            b.pen(col, (1 - k) * 0.6, 0.7);
            this.drawBody(e, x, t, b);
            return;
        }
        b.pen(col, 1, 0.9);
        this.drawBody(e, x, t, b);
    }

    drawBody(e, x, t, b) {
        const y = e.y;
        switch (e.kind) {
            case 'snatcher': {
                drawShape(b, SHAPES.snatcher, x, y, 1, 1, Math.sin(t * 2 + e.id) * 0.08);
                b.pen(COL.snatcherEye, 0.8 + 0.6 * Math.sin(t * 9 + e.id), 1.6);
                b.dot(x, y + 3.5);
                if (e.state === 'lift' && e.carry) {
                    b.pen(COL.snatcher, 0.35, 0.6);
                    b.seg(x - 6, y - 5, x, y - 9); b.seg(x + 6, y - 5, x, y - 9);
                }
                break;
            }
            case 'ravager': {
                const s = 1 + Math.sin(t * 17 + e.id) * 0.12;
                drawShape(b, SHAPES.ravager, x, y, s, s, t * 3 + e.id);
                b.pen(COL.red, 1.2, 1.3);
                b.dot(x - 2, y + 1); b.dot(x + 2, y + 1);
                break;
            }
            case 'minelayer':
                drawShape(b, SHAPES.minelayer, x, y, e.dir || 1, 1);
                b.pen(COL.yellow, 0.6 + 0.5 * Math.sin(t * 6), 1.2);
                b.dot(x + (e.dir || 1) * 6, y + 1);
                break;
            case 'mine': {
                const a = t * 3 + e.id, r = 4;
                const blink = e.life < 1.2 ? ((t * 10) % 1 < 0.5 ? 0.3 : 1.2) : 1;
                b.pen(COL.mine, blink, 0.85);
                for (let i = 0; i < 3; i++) {
                    const q = a + (i / 3) * Math.PI;
                    b.seg(x - Math.cos(q) * r, y - Math.sin(q) * r, x + Math.cos(q) * r, y + Math.sin(q) * r);
                }
                break;
            }
            case 'hive':
                drawWire(b, HIVE, x, y, 0, 11, t * 0.9 + e.rot, t * 1.3, t * 0.5);
                break;
            case 'stinger':
                drawShape(b, SHAPES.stinger, x, y, Math.sign(e.vx || 1), 1 + 0.25 * Math.sin(t * 30 + e.id));
                break;
            case 'hunter':
                drawShape(b, SHAPES.hunter, x, y, 1, 1);
                b.pen(COL.white, 0.6 + 0.6 * Math.sin(t * 15 + e.id), 1.2);
                b.dot(x + Math.sin(t * 7) * 7, y);
                break;
            case 'dart': {
                const moving = e.state !== 'form';
                const rot = moving ? Math.atan2(e.vy, e.vx) : -Math.PI / 2 + Math.sin(t * 3 + e.slot) * 0.15;
                drawShape(b, SHAPES.dart, x, y, 1, 1, rot);
                b.pen(COL.dartWing, 1, 0.9);
                drawShape(b, SHAPES.dartWing, x, y, 1, 1, rot);
                break;
            }
            case 'meteor':
                drawWire(b, rock(e.seed), x, y, 0, e.r * 1.05, e.spin * 0.7, e.spin * 1.1, e.spin * 0.35);
                break;
        }
    }

    drawShip(s, t, w) {
        if (!s.alive) return;
        const b = this.r.world;
        const x = this.sx(s.x);
        const blink = s.inv > 0 && (t * 14) % 1 < 0.45;
        const k = blink ? 0.3 : 1;
        b.pen(COL.ship, 1.05 * k, 1);
        drawShape(b, SHAPES.ship, x, s.y, s.face, 1);
        b.pen(COL.shipTrim, 1.1 * k, 0.9);
        drawShape(b, SHAPES.shipTrim, x, s.y, s.face, 1);
        if (s.thrusting) {
            const len = 6 + Math.random() * 7;
            b.pen(COL.flame, 1.2, 0.9);
            b.seg(x - s.face * 9, s.y + 1.5, x - s.face * (9 + len), s.y);
            b.seg(x - s.face * (9 + len), s.y, x - s.face * 9, s.y - 2);
            b.pen(COL.yellow, 1.2, 0.7);
            b.seg(x - s.face * 9, s.y, x - s.face * (9 + len * 0.5), s.y - 0.3);
        }
    }

    // ================================================================== bosses
    drawBoss(B, t) {
        const b = this.r.world;
        const x = this.sx(B.x);
        if (x < -300 || x > VIEW_W + 300) return;
        const enter = Math.max(0, B.enter || 0);
        const fade = 1 - Math.min(1, enter / 1.8) * 0.7;
        if (B.kind === 'harvester') this.drawHarvester(B, x, t, b, fade);
        else if (B.kind === 'leviathan') this.drawLeviathan(B, t, b, fade);
        else if (B.kind === 'overseer') this.drawOverseer(B, x, t, b, fade);
    }

    drawHarvester(B, x, t, b, fade) {
        const y = B.y;
        const hurt = B.phase === 2;
        // rims: two rings rotating in 3D (seen from slightly below)
        for (const [ry, rr, inten] of [[-4, 64, 1], [2, 52, 0.7], [-10, 40, 0.6]]) {
            b.pen(hurt && (t * 6) % 1 < 0.3 ? COL.red : COL.boss, inten * fade, 1);
            const n = 32;
            for (let i = 0; i < n; i++) {
                const a1 = B.rot + (i / n) * TAU, a2 = B.rot + ((i + 1) / n) * TAU;
                b.seg3(x + Math.cos(a1) * rr, y + ry + Math.sin(a1) * rr * 0.2, Math.sin(a1) * rr * 0.5, x + Math.cos(a2) * rr, y + ry + Math.sin(a2) * rr * 0.2, Math.sin(a2) * rr * 0.5);
            }
        }
        // dome
        b.pen(COL.cyan, 0.8 * fade, 0.9);
        let px = x - 26, py = y + 2;
        for (let i = 1; i <= 12; i++) {
            const a = Math.PI - (i / 12) * Math.PI;
            const qx = x + Math.cos(a) * 26, qy = y + 2 + Math.sin(a) * 18;
            b.seg(px, py, qx, qy); px = qx; py = qy;
        }
        for (let i = 0; i < 6; i++) {
            const a = B.rot * 2 + i;
            b.pen(COL.yellow, (0.4 + 0.6 * Math.max(0, Math.sin(t * 5 + i))) * fade, 1.4);
            b.dot(x + Math.cos(a) * 18, y + 10 + Math.sin(a) * 3);
        }
        // pods
        for (const p of B.parts) {
            if (p.kind !== 'pod') continue;
            const px2 = this.sx(p.x), d = p.depth ?? 0;
            if (!p.alive) { b.pen(COL.orange, 0.3 + 0.3 * Math.random(), 0.8); b.dot(px2, p.y); continue; }
            b.pen(p.hitT > 0 ? COL.white : COL.pink, (0.75 + 0.35 * d) * fade, 1);
            const r = 6 + d;
            b.poly([px2 - r, p.y, px2, p.y + r * 0.8, px2 + r, p.y, px2, p.y - r * 0.8], true);
            b.dot(px2, p.y);
            b.pen(COL.boss, 0.3 * fade, 0.6);
            b.seg(x, y - 4, px2, p.y);
        }
        // core
        const c = B.core;
        const cx = this.sx(c.x);
        const pulse = 0.7 + 0.4 * Math.sin(t * (c.shielded ? 3 : 9));
        b.pen(c.hitT > 0 ? COL.white : COL.bossCore, pulse * fade, 1.3);
        b.circle(cx, c.y, 8, 16, t);
        b.dot(cx, c.y);
        if (c.shielded) {
            b.pen(COL.cyan, (0.5 + 0.3 * Math.sin(t * 7)) * fade, 0.8);
            b.circle(cx, c.y, 14, 6, t * 0.8);
        }
        // tractor beam
        if (B.beam) {
            const bx = this.sx(B.x);
            const k = B.beam.lift ? 1 : Math.min(1, B.beam.t / 1.6);
            for (let i = -2; i <= 2; i++) {
                b.pen(COL.green, (0.25 + 0.25 * Math.sin(t * 20 + i)) * k, 0.8);
                const top = c.y - 10, bot = FIELD.ground;
                b.seg(bx + i * 3, top, bx + i * (6 + Math.sin(t * 4) * 2), bot);
            }
            for (let yy = FIELD.ground + ((t * 60) % 20); yy < c.y - 10; yy += 20) {
                b.pen(COL.green, 0.45 * k, 0.7);
                b.seg(bx - 8, yy, bx + 8, yy);
            }
        }
    }

    drawLeviathan(B, t, b, fade) {
        const segs = B.parts.filter((p) => p.kind === 'seg' && p.alive);
        // spine
        let prev = B.head;
        for (const s of segs) {
            const ax = this.sx(prev.x), bx = this.sx(s.x);
            if (Math.abs(ax - bx) < 60) { b.pen(COL.boss, 0.45 * fade, 0.8); b.seg(ax, prev.y, bx, s.y); }
            prev = s;
        }
        segs.forEach((s, i) => {
            const x = this.sx(s.x);
            if (x < -20 || x > VIEW_W + 20) return;
            const k = i / Math.max(1, segs.length - 1);
            const col = s.hitT > 0 ? COL.white : [0.9 - k * 0.3, 0.3 + k * 0.2, 1.0 - k * 0.2];
            b.pen(col, fade, 1);
            const a = t * 2 + i * 0.6;
            const pts = [];
            for (let j = 0; j < 6; j++) { const q = a + (j / 6) * TAU; pts.push(x + Math.cos(q) * 7.5, s.y + Math.sin(q) * 7.5); }
            b.poly(pts, true);
            b.pen(COL.pink, (0.5 + 0.5 * Math.sin(t * 6 + i)) * fade, 1.2);
            b.dot(x, s.y);
            // fins
            b.pen(col, 0.6 * fade, 0.8);
            b.seg(x, s.y + 7.5, x - 3, s.y + 12 + Math.sin(t * 5 + i) * 2);
            b.seg(x, s.y - 7.5, x - 3, s.y - 12 - Math.sin(t * 5 + i) * 2);
        });
        // head
        const h = B.head, hx = this.sx(h.x);
        const ang = h.ang ?? Math.PI;
        const jaw = 0.25 + 0.25 * Math.abs(Math.sin(t * 4)) + (B.lunge > 0 ? 0.35 : 0);
        b.pen(h.hitT > 0 ? COL.white : COL.pink, fade * 1.1, 1.2);
        const pts = [[-8, 0], [-4, 9], [8, 7], [16, 2 + jaw * 8], [6, 1], [6, -1], [16, -2 - jaw * 8], [8, -7], [-4, -9]];
        const c = Math.cos(ang), s = Math.sin(ang);
        const flat = [];
        for (const [px, py] of pts) flat.push(hx + px * c - py * s, h.y + px * s + py * c);
        b.poly(flat, true);
        b.pen(COL.yellow, 1.3 * fade, 1.5);
        for (const ey of [-4, 4]) b.dot(hx + 4 * c - ey * s, h.y + 4 * s + ey * c);
        if (h.shielded) {
            b.pen(COL.cyan, (0.4 + 0.3 * Math.sin(t * 8)) * fade, 0.8);
            b.circle(hx, h.y, 15, 8, t);
        }
    }

    drawOverseer(B, x, t, b, fade) {
        const y = B.y;
        // the cage
        b.pen(COL.boss, 0.35 * fade, 0.7);
        drawWire(b, ICO, x, y, 0, 30, t * 0.4, t * 0.6, 0);
        // plates: arcs on the orbit
        for (const p of B.parts) {
            if (p.kind !== 'plate' || !p.alive) continue;
            b.pen(p.hitT > 0 ? COL.white : COL.cyan, fade, 1.3);
            const a = p.ang;
            const n = 5;
            for (let i = 0; i < n; i++) {
                const a1 = a - 0.32 + (i / n) * 0.64, a2 = a - 0.32 + ((i + 1) / n) * 0.64;
                for (const r of [40, 48]) b.seg(x + Math.cos(a1) * r, y + Math.sin(a1) * r, x + Math.cos(a2) * r, y + Math.sin(a2) * r);
            }
            b.seg(x + Math.cos(a - 0.32) * 40, y + Math.sin(a - 0.32) * 40, x + Math.cos(a - 0.32) * 48, y + Math.sin(a - 0.32) * 48);
            b.seg(x + Math.cos(a + 0.32) * 40, y + Math.sin(a + 0.32) * 40, x + Math.cos(a + 0.32) * 48, y + Math.sin(a + 0.32) * 48);
        }
        // the eye
        const e = B.eye, o = B.open;
        const hit = e.hitT > 0;
        const lid = 1 + o * 10;
        b.pen(hit ? COL.white : B.phase === 2 ? COL.red : COL.boss, fade * 1.1, 1.3);
        let px = x - 22, pu = y, pl = y;
        for (let i = 1; i <= 12; i++) {
            const u = -22 + (i / 12) * 44;
            const h = Math.sqrt(Math.max(0, 1 - (u / 22) ** 2)) * lid;
            b.seg(px, pu, x + u, y + h);
            b.seg(px, pl, x + u, y - h);
            px = x + u; pu = y + h; pl = y - h;
        }
        if (o > 0.15) {
            b.pen(hit ? COL.white : COL.bossCore, fade * (0.6 + o), 1.2);
            b.circle(x, y, 7.5 * o, 14, t);
            b.pen(COL.red, fade * 1.4, 2.2);
            b.dot(x + Math.sin(t * 1.3) * 2, y);
        }
        // beams
        for (const bm of B.beams) {
            const c = Math.cos(bm.ang), s = Math.sin(bm.ang);
            if (bm.warn > 0) {
                b.pen(COL.red, 0.5 + 0.5 * Math.sin(t * 40), 0.5);
                for (let d = 20; d < 560; d += 24) b.seg(x + c * d, y + s * d, x + c * (d + 12), y + s * (d + 12));
            } else {
                b.pen(COL.red, 1.4, 3.2 + Math.sin(t * 50) * 0.6);
                b.seg(x + c * 14, y + s * 14, x + c * 600, y + s * 600);
                b.pen(COL.white, 1.2, 1.2);
                b.seg(x + c * 14, y + s * 14, x + c * 600, y + s * 600);
            }
        }
    }

    // ================================================================== events → effects
    onEvent(e, w) {
        const fx = this.fx, r = this.r;
        switch (e.type) {
            case 'explode': {
                const col = KIND_COL[e.kind] || COL.white;
                const sz = e.size ?? 1;
                if (e.kind === 'meteor') {
                    const m = rock(e.seed || 1), s = sz * 14;
                    fx.shatter3(m.e.map(([a, c]) => [m.v[a][0] * s, m.v[a][1] * s, m.v[a][2] * s, m.v[c][0] * s, m.v[c][1] * s, m.v[c][2] * s]), e.x, e.y, col, 0.8);
                } else if (e.kind === 'hive') {
                    fx.shatter3(HIVE.e.map(([a, c]) => [HIVE.v[a][0] * 11, HIVE.v[a][1] * 11, HIVE.v[a][2] * 11, HIVE.v[c][0] * 11, HIVE.v[c][1] * 11, HIVE.v[c][2] * 11]), e.x, e.y, col, 1.2);
                    r.shake(2.5, 0.2);
                } else if (SHAPES[e.kind]) {
                    fx.shatter(SHAPES[e.kind], e.x, e.y, col, { power: sz, scale: 1 });
                } else {
                    // boss parts: a burst of short lines
                    const segs = [];
                    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; segs.push([Math.cos(a) * 4, Math.sin(a) * 4, 0, Math.cos(a) * 9, Math.sin(a) * 9, 0]); }
                    fx.shatter3(segs, e.x, e.y, col, 1.3);
                    r.shake(3, 0.2);
                }
                if (!e.quiet) {
                    fx.sparks1(e.x, e.y, col, Math.round(10 + sz * 10), 110 * sz);
                    fx.sparks1(e.x, e.y, COL.white, 5, 70);
                    fx.ring(e.x, e.y, col, 18 + sz * 16, 0.35);
                }
                break;
            }
            case 'playerDie': {
                fx.shatter(SHAPES.ship, e.x, e.y, COL.ship, { power: 1.8, life: 2.2, face: w.ship.face, w: 1.2 });
                fx.shatter(SHAPES.shipTrim, e.x, e.y, COL.shipTrim, { power: 1.6, life: 2, face: w.ship.face });
                fx.sparks1(e.x, e.y, COL.white, 60, 220, 1.4);
                fx.sparks1(e.x, e.y, COL.cyan, 40, 160, 1.6);
                fx.ring(e.x, e.y, COL.white, 80, 0.8, 1.5);
                fx.ring(e.x, e.y, COL.cyan, 140, 1.2, 1);
                r.flashScreen([1, 1, 1], 0.55); r.shake(7, 0.5); r.aberrate(4);
                break;
            }
            case 'bomb':
                r.flashScreen([1, 1, 1], 0.85); r.shake(6, 0.4); r.aberrate(5);
                fx.ring(e.x, e.y, COL.white, 320, 0.5, 2);
                fx.ring(e.x, e.y, COL.cyan, 240, 0.6, 1.2);
                break;
            case 'hyper':
                fx.sparks1(e.fx, e.fy, COL.cyan, 30, 160, 0.6);
                fx.ring(e.fx, e.fy, COL.cyan, 40, 0.4);
                fx.ring(e.x, e.y, COL.white, 50, 0.5);
                fx.sparks1(e.x, e.y, COL.white, 24, 120, 0.5);
                r.flashScreen([0.4, 0.8, 1], 0.3);
                this.r.clearHistory = true;
                break;
            case 'mutate':
                fx.sparks1(e.x, e.y, COL.ravager, 24, 120);
                fx.ring(e.x, e.y, COL.ravager, 40, 0.5);
                break;
            case 'colonistDie':
                fx.sparks1(e.x, e.y, COL.colonist, 18, 70);
                fx.shatter(SHAPES.colonist, e.x, e.y, COL.colonist, { power: 0.6 });
                break;
            case 'catch': case 'setDown': case 'softLand':
                fx.ring(e.x, e.y + 3, COL.green, 20, 0.4);
                break;
            case 'planetDie': this.explodePlanet(w); break;
            case 'impact':
                fx.sparks1(e.x, FIELD.ground + 2, COL.orange, 30, 140);
                fx.ring(e.x, FIELD.ground, COL.orange, 40, 0.5);
                r.shake(2, 0.2);
                break;
            case 'score':
                fx.text(e.n, e.x, e.y + 10, e.n >= 1000 ? COL.yellow : COL.text, e.n >= 1000 ? 1.4 : 1.1, 1.1);
                break;
            case 'bossHit':
                fx.sparks1(e.x, e.y, COL.white, 3, 70, 0.3);
                break;
            case 'ting':
                fx.sparks1(e.x, e.y, COL.cyan, 4, 60, 0.25);
                break;
            case 'bossPhase':
                r.flashScreen([1, 0.2, 0.3], 0.35); r.shake(4, 0.4);
                break;
            case 'bossDie': {
                for (let i = 0; i < 6; i++) fx.ring(e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 40, i % 2 ? COL.pink : COL.yellow, 60 + i * 30, 0.6 + i * 0.15, 1.4);
                fx.sparks1(e.x, e.y, COL.yellow, 120, 260, 1.8);
                fx.sparks1(e.x, e.y, COL.boss, 100, 200, 1.6);
                const segs = [];
                for (let i = 0; i < 70; i++) {
                    const a = Math.random() * TAU, rr = 10 + Math.random() * 60, l = 4 + Math.random() * 10;
                    segs.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.6, 0, Math.cos(a) * (rr + l), Math.sin(a) * (rr + l) * 0.6, (Math.random() - 0.5) * 20]);
                }
                fx.shatter3(segs, e.x, e.y, COL.boss, 1.6, 2.2);
                r.flashScreen([1, 0.95, 0.7], 0.9); r.shake(12, 0.9); r.aberrate(6);
                break;
            }
            case 'hiveBurst':
                fx.ring(e.x, e.y, COL.stinger, 50, 0.4);
                break;
            case 'beamFire':
                r.shake(3, 0.3); r.aberrate(2);
                break;
            case 'respawn':
                fx.ring(e.x, e.y, COL.cyan, 60, 0.6);
                fx.sparks1(e.x, e.y, COL.cyan, 20, 90, 0.6);
                break;
            case 'extra':
                fx.ring(e.x, e.y, COL.yellow, 70, 0.7);
                break;
        }
    }

    explodePlanet(w) {
        const fx = this.fx, r = this.r;
        const cam = this.camX;
        // the mountains on screen (and a little beyond) shatter and fly up
        const x0 = Math.floor((cam - 360) / STEP);
        for (let i = 0; i < 720 / STEP; i++) {
            const k = x0 + i;
            const a = ((k % SAMPLES) + SAMPLES) % SAMPLES, bI = (((k + 1) % SAMPLES) + SAMPLES) % SAMPLES;
            const wx = wrap(k * STEP);
            const ya = FIELD.ground + NEAR[a], yb = FIELD.ground + NEAR[bI];
            fx.shatter3([[0, ya - FIELD.ground, 0, STEP, yb - FIELD.ground, 0]], wx, FIELD.ground, COL.mountain, 1.5, 3);
            fx.sparks1(wx, FIELD.ground + 5, COL.orange, 6, 180, 1.6);
        }
        fx.ring(w.ship.x, FIELD.ground, COL.orange, 400, 1.2, 2.2);
        r.flashScreen([1, 0.6, 0.2], 0.85); r.shake(12, 1.2); r.aberrate(6);
    }
}
