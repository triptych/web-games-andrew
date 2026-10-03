// Visual effects: particles, dynamic lights, shockwaves, screen shake and
// hitstop. Fed by the simulation's event stream (see consume()), so the
// sim never knows explosions are pretty. Everything here uses its own RNG
// stream (Math.random is fine: it is never read back by the sim).

import { WATER, LAVA } from '../sim/terrain.js';

const TAU = Math.PI * 2;
const R = Math.random;
const rr = (a, b) => a + (b - a) * R();

export const PALETTE = [
    [1.0, 0.22, 0.28], [1.0, 0.55, 0.12], [1.0, 0.9, 0.2], [0.35, 1.0, 0.45], [0.2, 0.9, 1.0],
    [0.3, 0.5, 1.0], [0.72, 0.35, 1.0], [1.0, 0.35, 0.8], [0.95, 0.95, 1.0],
];

// ramps
const CONST = 0, FIRE = 1, SMOKE = 2, SPARK = 3, DEBRIS = 4, FLASH = 5, RING = 6, WRECK = 7, POP = 8, BOLT = 9;

export class FX {
    constructor() {
        this.parts = [];
        this.pool = [];
        this.lights = [];
        this.shocks = [];
        this.stamps = [];
        this.trauma = 0;
        this.hitstop = 0;
        this.slowmo = 0;
        this.slowmoScale = 1;
        this.flash = [1, 1, 1, 0];
        this.flashDecay = 4;
        this.ca = 0;
        this.hitPulse = 0;
        this.lightning = 0;
        this.reduce = false;   // reduced flashing
        this.quality = 1;
        this.maxParts = 3000;
    }

    p(o) {
        if (this.parts.length >= this.maxParts * this.quality) return null;
        const q = this.pool.pop() || {};
        q.x = o.x; q.y = o.y; q.vx = o.vx || 0; q.vy = o.vy || 0; q.drag = o.drag ?? 2;
        q.t = 0; q.life = o.life || 1; q.rot = o.rot ?? R() * TAU; q.vr = o.vr || 0;
        q.s0 = o.s0 ?? 1; q.s1 = o.s1 ?? q.s0; q.r = o.r ?? 1; q.g = o.g ?? 1; q.b = o.b ?? 1; q.a = o.a ?? 1;
        q.ramp = o.ramp || 0; q.mode = o.mode ?? 0; q.layer = o.layer || 'fx'; q.spr = o.spr;
        q.z = o.z || 0; q.vz = o.vz || 0; q.grav = o.grav || 0; q.scroll = o.scroll || 0; q.stretch = o.stretch || 0;
        q.trail = o.trail || 0; q.trailT = 0; q.onEnd = o.onEnd || null; q.data = o.data || null; q.w = o.w; q.h = o.h;
        this.parts.push(q);
        return q;
    }

    light(x, y, r, i, c, life = 0.25) { this.lights.push({ x, y, r, i, c, life, t: 0, i0: i }); }
    shock(x, y, maxR, str, life = 0.7) { if (this.shocks.length < 12) this.shocks.push({ x, y, maxR, str, life, t: 0 }); }
    shake(a) { this.trauma = Math.min(1.2, this.trauma + a); }
    flashScreen(r, g, b, a, decay = 4) {
        if (this.reduce) a *= 0.25;
        if (a > this.flash[3]) { this.flash = [r, g, b, a]; this.flashDecay = decay; }
    }

    // ---------------------------------------------------------------- recipes

    explosion(x, y, size, o = {}) {
        const S = { s: 0.6, m: 1, l: 1.6, xl: 2.4 }[size] || 1;
        const layer = o.ground ? 'gfx' : 'fx';
        const scroll = o.ground ? 1 : 0;
        const tint = o.tint || null;
        this.p({ spr: 'glow', x, y, life: 0.12 + S * 0.05, s0: 1.2 * S, s1: 2.6 * S, r: 1, g: 0.9, b: 0.7, a: 1, ramp: FLASH, mode: 7, layer: 'fx', scroll });
        this.p({ spr: 'flare', x, y, life: 0.16 + S * 0.05, s0: 0.6 * S, s1: 1.4 * S, r: 1, g: 0.95, b: 0.8, ramp: FLASH, mode: 7, layer: 'top', scroll, rot: R() * TAU });
        const nf = Math.round(6 * S * S + 2);
        for (let i = 0; i < nf; i++) {
            const a = R() * TAU, s = rr(20, 120) * S;
            this.p({ spr: 'fire' + (i & 3), x: x + Math.cos(a) * 4 * S, y: y + Math.sin(a) * 4 * S, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3.5, life: rr(0.35, 0.7) * (0.8 + S * 0.25), s0: rr(0.35, 0.6) * S, s1: rr(0.9, 1.5) * S, vr: rr(-2, 2), ramp: FIRE, mode: 4, layer, scroll });
        }
        const ns = Math.round(2.5 * S * S + 1);
        for (let i = 0; i < ns; i++) {
            const a = R() * TAU, s = rr(10, 60) * S;
            const g = tint ? null : rr(0.22, 0.34);
            this.p({ spr: 'smoke' + (i & 3), x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, drag: 1.6, life: rr(1.0, 1.9) * (0.7 + S * 0.3), s0: rr(0.35, 0.55) * S, s1: rr(1.0, 1.6) * S, vr: rr(-0.6, 0.6), r: tint ? tint[0] : g, g: tint ? tint[1] : g, b: tint ? tint[2] : g * 0.95, a: 0.55, ramp: SMOKE, mode: 0, layer: o.ground ? 'gsmoke' : 'smoke', scroll });
        }
        const nk = Math.round(8 * S + 4);
        for (let i = 0; i < nk; i++) {
            const a = R() * TAU, s = rr(150, 420) * Math.sqrt(S);
            this.p({ spr: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3, life: rr(0.2, 0.5), s0: rr(0.5, 0.9), r: 1, g: rr(0.6, 0.9), b: 0.3, ramp: SPARK, mode: 7, layer: 'top', stretch: 1, scroll });
        }
        const nd = Math.round(3 * S + 1);
        for (let i = 0; i < nd; i++) {
            const a = R() * TAU, s = rr(40, 160) * Math.sqrt(S);
            this.p({ spr: 'debris' + (i & 3), x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.8, life: 2, s0: rr(0.6, 1.3) * Math.sqrt(S), vr: rr(-9, 9), ramp: DEBRIS, mode: 0, layer: 'debris', z: 4, vz: rr(80, 200), grav: 420, trail: size !== 's' && R() < 0.4 ? 1 : 0, scroll });
        }
        if (S >= 1) {
            this.p({ spr: 'ring', x, y, life: 0.45, s0: 0.15 * S, s1: 1.4 * S, r: 1, g: 0.8, b: 0.5, a: 0.6, ramp: RING, mode: 7, layer: 'fx', scroll });
            this.shock(x, y, 70 * S, 0.012 * S, 0.5 + S * 0.15);
        }
        for (let i = 0; i < Math.round(4 * S); i++) {
            this.p({ spr: 'soft', x: x + rr(-10, 10) * S, y: y + rr(-10, 10) * S, vx: rr(-40, 40), vy: rr(-90, -20), drag: 1, life: rr(0.8, 1.6), s0: rr(0.08, 0.16), r: 1, g: 0.6, b: 0.2, ramp: CONST, mode: 7, layer: 'top', scroll });
        }
        this.light(x, y, 110 * S + 40, 1.6 + S * 0.5, [1.0, 0.6, 0.25], 0.2 + S * 0.12);
        this.shake(0.05 * S * S);
        if (S >= 1.5) { this.ca = Math.max(this.ca, 0.01 * S); this.hitstop = Math.max(this.hitstop, 0.035); }
    }

    splash(x, y, S = 1) {
        this.p({ spr: 'splash', x, y, life: 0.7, s0: 0.3 * S, s1: 1.3 * S, a: 0.9, ramp: RING, mode: 0, layer: 'gfx', scroll: 1 });
        this.p({ spr: 'ring', x, y, life: 1.1, s0: 0.2 * S, s1: 1.1 * S, a: 0.5, ramp: RING, mode: 0, layer: 'gfx', scroll: 1 });
        for (let i = 0; i < 10 * S; i++) {
            const a = R() * TAU, s = rr(30, 110) * S;
            this.p({ spr: 'smoke' + (i & 3), x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 2.5, life: rr(0.6, 1.1), s0: 0.25 * S, s1: 0.8 * S, r: 0.92, g: 0.96, b: 1, a: 0.8, ramp: SMOKE, layer: 'gsmoke', scroll: 1 });
        }
        this.light(x, y, 90 * S, 0.8, [1, 0.6, 0.3], 0.15);
    }

    /** An aircraft falls out of the sky, trailing smoke, and hits the ground. */
    wreck(x, y, spr, rot, vx, vy, size, terrainKind) {
        this.p({
            spr, x, y, vx: vx * 0.5, vy: vy * 0.3 + 30, drag: 0.6, life: size === 'l' ? 1.4 : 0.9, rot, vr: rr(-5, 5), s0: 1, s1: 0.55,
            r: 0.45, g: 0.42, b: 0.4, ramp: WRECK, mode: 0, layer: 'air', trail: 2, scroll: 0.6,
            onEnd: (q) => {
                const k = terrainKind(q.x, q.y);
                if (k === WATER) this.splash(q.x, q.y, size === 'l' ? 1.4 : 0.8);
                else {
                    this.explosion(q.x, q.y, size === 'l' ? 'm' : 's', { ground: true });
                    if (k !== LAVA) this.scorch(q.x, q.y, size === 'l' ? 1.1 : 0.6, true);
                }
            },
        });
    }

    scorch(x, y, s, crater) {
        this.stamps.push({ name: crater ? 'crater' : 'scorch' + ((R() * 3) | 0), x, y, rot: R() * TAU, s: s * rr(0.8, 1.2), a: crater ? 0.85 : rr(0.55, 0.8) });
    }

    hitSpark(x, y, crit, kind) {
        const n = crit ? 6 : 2;
        for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + rr(-1.6, 1.6) + Math.PI;
            const s = rr(120, 300);
            this.p({ spr: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 5, life: rr(0.08, 0.18), s0: 0.4, r: 1, g: crit ? 0.4 : 0.85, b: crit ? 0.3 : 0.5, ramp: SPARK, mode: 7, layer: 'top', stretch: 1 });
        }
        this.p({ spr: 'glow', x, y, life: 0.06, s0: crit ? 0.6 : 0.3, s1: crit ? 0.9 : 0.45, r: 1, g: 0.85, b: 0.5, ramp: FLASH, mode: 7, layer: 'top' });
    }

    pop(x, y, color, s = 0.4) {
        this.p({ spr: 'glow', x, y, life: 0.25, s0: s, s1: s * 0.2, r: color[0], g: color[1], b: color[2], ramp: FLASH, mode: 7, layer: 'top' });
    }

    /** A puff about `size` world units across (the smoke sprites are 48 units). */
    smokePuff(x, y, size, a = 0.5, layer = 'smoke', scroll = 0, dark = 0.3) {
        const k = size / 48;
        this.p({ spr: 'smoke' + ((R() * 4) | 0), x, y, vx: rr(-8, 8), vy: rr(-8, 8), drag: 1, life: rr(0.6, 1.1), s0: k * 0.6, s1: k * 1.6, r: dark, g: dark, b: dark, a, ramp: SMOKE, layer, scroll });
    }

    bolt(x0, y0, x1, y1, color = [0.75, 0.85, 1], width = 1, life = 0.18) {
        const segs = 9;
        let px = x0, py = y0;
        const dx = (x1 - x0) / segs, dy = (y1 - y0) / segs;
        const len = Math.hypot(dx, dy);
        const nx = -dy / (len || 1), ny = dx / (len || 1);
        for (let i = 1; i <= segs; i++) {
            const j = i === segs ? 0 : rr(-1, 1) * len * 0.5;
            const qx = x0 + dx * i + nx * j, qy = y0 + dy * i + ny * j;
            const mx = (px + qx) / 2, my = (py + qy) / 2;
            const ang = Math.atan2(qy - py, qx - px) + Math.PI / 2;
            const l = Math.hypot(qx - px, qy - py);
            this.p({ spr: 'spark', x: mx, y: my, rot: ang, life, s0: 1, w: 6 * width, h: l * 1.3, r: color[0], g: color[1], b: color[2], ramp: BOLT, mode: 7, layer: 'top' });
            this.p({ spr: 'spark', x: mx, y: my, rot: ang, life, s0: 1, w: 18 * width, h: l * 1.5, r: color[0] * 0.5, g: color[1] * 0.5, b: color[2], a: 0.5, ramp: BOLT, mode: 7, layer: 'fx' });
            px = qx; py = qy;
        }
    }

    popup(x, y, text, color = [1, 0.9, 0.4], scale = 1) {
        this.p({ x, y, vy: -40, drag: 2, life: 0.9, s0: scale, r: color[0], g: color[1], b: color[2], ramp: POP, layer: 'top', data: String(text), spr: null });
    }

    // ---------------------------------------------------------------- update

    update(dt, scrollSpeed) {
        const P = this.parts;
        for (let i = P.length - 1; i >= 0; i--) {
            const q = P[i];
            q.t += dt;
            if (q.t >= q.life) {
                if (q.onEnd) q.onEnd(q);
                P[i] = P[P.length - 1]; P.pop(); this.pool.push(q);
                continue;
            }
            const k = Math.exp(-q.drag * dt);
            q.vx *= k; q.vy *= k;
            q.x += q.vx * dt; q.y += (q.vy + scrollSpeed * q.scroll) * dt;
            q.rot += q.vr * dt;
            if (q.ramp === DEBRIS) {
                q.vz -= q.grav * dt;
                q.z += q.vz * dt;
                if (q.z <= 0) {
                    q.z = 0;
                    if (q.vz < -60) { q.vz *= -0.3; q.vx *= 0.5; q.vy *= 0.5; q.vr *= 0.5; }
                    else { q.vz = 0; q.vx *= 0.8; q.vy *= 0.8; q.vr = 0; q.scroll = 1; }
                }
            }
            if (q.trail) {
                q.trailT -= dt;
                if (q.trailT <= 0) {
                    q.trailT = q.trail === 2 ? 0.03 : 0.06;
                    this.smokePuff(q.x, q.y - q.z * 0.6, q.trail === 2 ? 14 : 8, q.trail === 2 ? 0.6 : 0.4, 'smoke', 0, q.trail === 2 ? 0.18 : 0.25);
                    if (q.trail === 2 && R() < 0.5) this.p({ spr: 'fire' + ((R() * 4) | 0), x: q.x, y: q.y, life: 0.3, s0: 0.3, s1: 0.1, ramp: FIRE, mode: 4, layer: 'fx' });
                }
            }
        }
        for (let i = this.lights.length - 1; i >= 0; i--) {
            const l = this.lights[i];
            l.t += dt;
            l.i = l.i0 * Math.max(0, 1 - l.t / l.life);
            if (l.t >= l.life) this.lights.splice(i, 1);
        }
        for (let i = this.shocks.length - 1; i >= 0; i--) {
            const s = this.shocks[i];
            s.t += dt;
            s.y += scrollSpeed * dt * 0.5;
            if (s.t >= s.life) this.shocks.splice(i, 1);
        }
        this.trauma = Math.max(0, this.trauma - dt * 1.6);
        this.flash[3] = Math.max(0, this.flash[3] - dt * this.flashDecay);
        this.ca = Math.max(0, this.ca - dt * 0.05);
        this.hitPulse = Math.max(0, this.hitPulse - dt * 2.5);
        this.lightning = Math.max(0, this.lightning - dt * 5);
    }

    /** Push every live particle into the batch. */
    draw(B, layerMap) {
        const digits = {};
        for (const q of this.parts) {
            const u = q.t / q.life;
            const layer = layerMap[q.layer] || q.layer;
            let s = q.s0 + (q.s1 - q.s0) * u;
            let r = q.r, g = q.g, b = q.b, a = q.a;
            const spr = q.spr ? B.spr(q.spr) : null;
            switch (q.ramp) {
                case CONST: a *= 1 - u * u; break;
                case FIRE: {
                    // white → yellow → orange → deep red
                    if (u < 0.15) { const k = u / 0.15; r = 1; g = 1 - 0.1 * k; b = 0.85 - 0.55 * k; }
                    else if (u < 0.45) { const k = (u - 0.15) / 0.3; r = 1; g = 0.9 - 0.4 * k; b = 0.3 - 0.22 * k; }
                    else { const k = (u - 0.45) / 0.55; r = 1 - 0.55 * k; g = 0.5 - 0.42 * k; b = 0.08; }
                    const bright = 1.6 - u * 1.1;
                    r *= bright; g *= bright; b *= bright;
                    a = (1 - u) * (1 - u) * 1.2;
                    break;
                }
                case SMOKE: a *= Math.min(1, u * 6) * (1 - u); break;
                case SPARK: a *= 1 - u; break;
                case FLASH: a *= (1 - u) * (1 - u); break;
                case RING: a *= (1 - u); break;
                case BOLT: a *= (1 - u) * (0.6 + 0.4 * Math.sin(q.t * 90)); break;
                case DEBRIS: if (u > 0.75) a *= (1 - u) / 0.25; break;
                case WRECK: break;
            }
            if (q.ramp === POP) {
                const text = q.data;
                const sz = q.s0 * (u < 0.15 ? 0.6 + u / 0.15 * 0.6 : 1.2 - (u - 0.15) * 0.3);
                const al = u > 0.6 ? (1 - u) / 0.4 : 1;
                const w = 7 * sz;
                let x = q.x - (text.length - 1) * w / 2;
                for (const ch of text) {
                    const d = digits[ch] || (digits[ch] = B.spr('d_' + ch));
                    if (d) B.push('top', d, x, q.y, 0, sz, sz, r, g, b, al, 0, 0);
                    x += w;
                }
                continue;
            }
            if (!spr) continue;
            if (q.ramp === DEBRIS) {
                const zs = 1 + q.z * 0.01;
                B.push('debris', spr, q.x + q.z * 0.25, q.y + q.z * 0.35, q.rot, s * 0.9, s * 0.9, 1, 1, 1, a * 0.35, 0, 1);
                B.push('debris', spr, q.x, q.y, q.rot, s * zs, s * zs, 1, 1, 1, a, 0, 0);
                continue;
            }
            if (q.ramp === WRECK) {
                B.push('shadow', spr, q.x + 14 * s, q.y + 20 * s, q.rot, s, s, 1, 1, 1, 0.35, 0, 1);
                B.push(layer, spr, q.x, q.y, q.rot, s, s, r, g, b, 1, 0, 0);
                continue;
            }
            if (q.w) { B.pushWH(layer, spr, q.x, q.y, q.rot, q.w * s, q.h * s, r, g, b, a, 0, q.mode); continue; }
            if (q.stretch) {
                const v = Math.hypot(q.vx, q.vy);
                const ang = Math.atan2(q.vy, q.vx) + Math.PI / 2;
                B.pushWH(layer, spr, q.x, q.y, ang, spr.w * s, Math.max(4, v * 0.05) * s * 1.4, r, g, b, a, 0, q.mode);
                continue;
            }
            B.push(layer, spr, q.x, q.y, q.rot, s, s, r, g, b, a, 0, q.mode);
        }
    }
}
