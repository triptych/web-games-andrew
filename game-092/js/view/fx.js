// Particles and the small effects that make hits land: dust, sparks, bubbles, rings, afterimages and
// lightning. Everything lives in the 320×180 screen space of the low-res canvas. The view feeds it
// from sim events; nothing here feeds back into the sim.

import { px, line, disc, C } from './draw.js';

export class Fx {
    constructor() {
        this.parts = [];
        this.rings = [];
        this.ghosts = [];
        this.bolts = [];
        this.seed = 12345;            // effects only: a tiny LCG so the view never touches Math.random
    }

    rnd() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    range(a, b) { return a + this.rnd() * (b - a); }

    add(p) { if (this.parts.length < 700) this.parts.push(p); }

    /** n particles from (x, y). o: color (or array), speed, ang (centre, rad), spread (rad), life, size, grav, glow */
    burst(x, y, n, o = {}) {
        const cols = Array.isArray(o.color) ? o.color : [o.color || C.white];
        for (let i = 0; i < n; i++) {
            const a = (o.ang ?? -Math.PI / 2) + (this.rnd() - 0.5) * (o.spread ?? Math.PI * 2);
            const s = this.range((o.speed ?? 40) * 0.4, o.speed ?? 40);
            this.add({
                x: x + this.range(-(o.jx || 0), o.jx || 0), y: y + this.range(-(o.jy || 0), o.jy || 0),
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: this.range((o.life ?? 0.5) * 0.6, o.life ?? 0.5), max: o.life ?? 0.5,
                size: o.size ?? 1, grav: o.grav ?? 0, drag: o.drag ?? 0.5,
                color: cols[i % cols.length], glow: !!o.glow,
            });
        }
    }

    dust(x, y, dir = 0, n = 4) {
        this.burst(x, y - 1, n, { color: ['#ffb3e6', '#c58cff', '#ffd9f5'], speed: 22, ang: dir ? (dir > 0 ? Math.PI : 0) - 0.3 : -Math.PI / 2, spread: dir ? 0.8 : 2.4, life: 0.35, size: 1, grav: -10, drag: 2 });
    }

    ring(x, y, color, r0 = 2, vr = 90, life = 0.35) { this.rings.push({ x, y, r: r0, vr, life, max: life, color }); }

    ghost(g) { this.ghosts.push({ ...g, max: g.life }); if (this.ghosts.length > 24) this.ghosts.shift(); }

    bolt(x, y, x1, y1, color = C.white, life = 0.18) {
        const pts = [[x, y]];
        const n = 6;
        for (let i = 1; i < n; i++) {
            const t = i / n;
            pts.push([x + (x1 - x) * t + this.range(-5, 5), y + (y1 - y) * t + this.range(-5, 5)]);
        }
        pts.push([x1, y1]);
        this.bolts.push({ pts, life, max: life, color });
    }

    update(dt) {
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.life -= dt;
            if (p.life <= 0) { this.parts.splice(i, 1); continue; }
            p.vy += p.grav * dt;
            const d = Math.max(0, 1 - p.drag * dt);
            p.vx *= d; p.vy *= d;
            p.x += p.vx * dt; p.y += p.vy * dt;
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.life -= dt; r.r += r.vr * dt;
            if (r.life <= 0) this.rings.splice(i, 1);
        }
        for (let i = this.ghosts.length - 1; i >= 0; i--) { this.ghosts[i].life -= dt; if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1); }
        for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1); }
    }

    /** Ghosts are drawn by the view (they need Harry's drawing); this draws the rest. */
    draw(g) {
        for (const p of this.parts) {
            g.globalAlpha = Math.min(1, (p.life / p.max) * 1.4);
            g.fillStyle = p.color;
            g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        g.globalAlpha = 1;
        for (const r of this.rings) {
            g.globalAlpha = Math.max(0, r.life / r.max);
            g.strokeStyle = r.color;
            g.lineWidth = 1;
            g.beginPath();
            g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            g.stroke();
        }
        g.globalAlpha = 1;
        for (const b of this.bolts) {
            g.globalAlpha = Math.max(0, b.life / b.max);
            for (let i = 1; i < b.pts.length; i++) line(g, b.pts[i - 1][0], b.pts[i - 1][1], b.pts[i][0], b.pts[i][1], b.color, 1);
        }
        g.globalAlpha = 1;
    }
}

export { px, disc };
