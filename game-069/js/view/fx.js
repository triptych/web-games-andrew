// Effects in world space: explosion fragments (the destroyed shape's own line
// segments, flung outward and toward the glass, spinning), sparks, expanding
// rings, and drifting planet debris. Positions are world x (wrapping), y and z;
// they are drawn relative to the camera.

import { wdx, wrap } from '../sim/util.js';
import { segmentsOf } from '../art/shapes.js';

const MAX_FRAG = 2200, MAX_SPARK = 1600;

export class Fx {
    constructor() {
        this.frags = [];
        this.sparks = [];
        this.rings = [];
        this.texts = [];
    }

    reset() { this.frags.length = 0; this.sparks.length = 0; this.rings.length = 0; this.texts.length = 0; }

    /** Shatter a flat shape (polylines) at x,y: every segment flies off on its own. */
    shatter(polys, x, y, col, opts = {}) {
        const scale = opts.scale ?? 1, face = opts.face ?? 1, rot = opts.rot ?? 0, power = opts.power ?? 1, life = opts.life ?? 1.2;
        const c = Math.cos(rot), s = Math.sin(rot);
        for (const [ax, ay, bx, by] of segmentsOf(polys)) {
            if (this.frags.length >= MAX_FRAG) break;
            const lx1 = ax * scale * face, ly1 = ay * scale, lx2 = bx * scale * face, ly2 = by * scale;
            const mx = (lx1 + lx2) / 2, my = (ly1 + ly2) / 2;
            const wx = mx * c - my * s, wy = mx * s + my * c;
            const half = [(lx2 - lx1) / 2, (ly2 - ly1) / 2];
            const ang = Math.atan2(wy, wx) + (Math.random() - 0.5) * 1.2;
            const sp = (40 + Math.random() * 110) * power;
            this.frags.push({
                x: wrap(x + wx), y: y + wy, z: 0,
                vx: Math.cos(ang) * sp + (opts.vx || 0) * 0.4, vy: Math.sin(ang) * sp + 20 * power, vz: (60 + Math.random() * 260) * power,
                hx: half[0] * c - half[1] * s, hy: half[0] * s + half[1] * c,
                spin: (Math.random() - 0.5) * 14, a: 0, col, life: life * (0.6 + Math.random() * 0.6), t: 0, w: opts.w ?? 1,
            });
        }
    }

    /** Shatter raw 3D segments (from a wireframe) — already in world-relative coordinates. */
    shatter3(segs, x, y, col, power = 1, life = 1.4) {
        for (const [ax, ay, az, bx, by, bz] of segs) {
            if (this.frags.length >= MAX_FRAG) break;
            const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
            const ang = Math.atan2(my, mx);
            const sp = (30 + Math.random() * 100) * power;
            this.frags.push({
                x: wrap(x + mx), y: y + my, z: mz,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp + 10, vz: (40 + Math.random() * 220) * power + mz,
                hx: (bx - ax) / 2, hy: (by - ay) / 2, hz: (bz - az) / 2,
                spin: (Math.random() - 0.5) * 10, a: 0, col, life: life * (0.6 + Math.random() * 0.6), t: 0, w: 1,
            });
        }
    }

    sparks1(x, y, col, n = 16, speed = 120, life = 0.7, vx = 0) {
        for (let i = 0; i < n && this.sparks.length < MAX_SPARK; i++) {
            const a = Math.random() * Math.PI * 2, sp = speed * (0.25 + Math.random() * 0.9);
            this.sparks.push({ x: wrap(x), y, vx: Math.cos(a) * sp + vx, vy: Math.sin(a) * sp, col, life: life * (0.5 + Math.random() * 0.7), t: 0, z: Math.random() * 120 });
        }
    }

    ring(x, y, col, r1 = 40, life = 0.45, w = 1.2) {
        this.rings.push({ x: wrap(x), y, col, r1, life, t: 0, w });
    }

    /** Floating text in world space (score popups). */
    text(str, x, y, col, size = 1, life = 0.9) {
        this.texts.push({ str: String(str), x: wrap(x), y, col, size, life, t: 0 });
    }

    step(dt) {
        for (const f of this.frags) {
            f.t += dt;
            f.x = wrap(f.x + f.vx * dt); f.y += f.vy * dt; f.z += f.vz * dt;
            f.vx *= 1 - dt * 0.6; f.vy = f.vy * (1 - dt * 0.6) - 30 * dt;
            f.a += f.spin * dt;
        }
        this.frags = this.frags.filter((f) => f.t < f.life && f.z < 880);
        for (const s of this.sparks) {
            s.t += dt;
            s.x = wrap(s.x + s.vx * dt); s.y += s.vy * dt;
            s.vx *= 1 - dt * 1.4; s.vy = s.vy * (1 - dt * 1.4) - 40 * dt;
        }
        this.sparks = this.sparks.filter((s) => s.t < s.life);
        for (const r of this.rings) r.t += dt;
        this.rings = this.rings.filter((r) => r.t < r.life);
        for (const t of this.texts) { t.t += dt; t.y += dt * 18; }
        this.texts = this.texts.filter((t) => t.t < t.life);
    }

    draw(b, camX, drawText) {
        const CX = 200;
        for (const f of this.frags) {
            const sx = CX + wdx(f.x, camX);
            if (sx < -200 || sx > 600) continue;
            const k = 1 - f.t / f.life;
            const c = Math.cos(f.a), s = Math.sin(f.a);
            const hx = f.hx * c - f.hy * s, hy = f.hx * s + f.hy * c, hz = f.hz || 0;
            b.pen(f.col, 0.25 + 1.1 * k * k, f.w);
            b.seg3(sx - hx, f.y - hy, f.z - hz, sx + hx, f.y + hy, f.z + hz);
        }
        for (const p of this.sparks) {
            const sx = CX + wdx(p.x, camX);
            if (sx < -60 || sx > 460) continue;
            const k = 1 - p.t / p.life;
            b.pen(p.col, 1.4 * k, 0.8);
            b.seg3(sx, p.y, p.z, sx - p.vx * 0.02, p.y - p.vy * 0.02, p.z);
        }
        for (const r of this.rings) {
            const sx = CX + wdx(r.x, camX);
            if (sx < -200 || sx > 600) continue;
            const k = r.t / r.life;
            b.pen(r.col, 1.2 * (1 - k), r.w);
            b.circle(sx, r.y, 4 + r.r1 * Math.sqrt(k), 28, k * 2);
        }
        for (const t of this.texts) {
            const sx = CX + wdx(t.x, camX);
            if (sx < -60 || sx > 460) continue;
            const k = 1 - t.t / t.life;
            b.pen(t.col, 0.5 + k, 0.9);
            drawText(b, t.str, sx, t.y, t.size, 'center');
        }
    }
}
