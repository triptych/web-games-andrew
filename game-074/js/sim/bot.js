// An autopilot that plays the real simulation: it scores a handful of
// candidate moves against predicted bullet, laser, enemy and terrain positions,
// lines up with the most useful target, and charges the Radiance beam when a
// boss or a big enemy is in front of it. dev/simtest.mjs uses it to prove every
// stage can be finished; the title screen uses it for the attract demo.

import { PLAYER, W, H } from '../config.js';

const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [0.7, -0.7], [-0.7, 0.7], [-0.7, -0.7]];

export class Bot {
    constructor(skill = 1) {
        this.skill = skill;
        this.hold = 0;
        this.cool = 0;
        this.pv = new Map();      // boss part → velocity, from last frame
        this.pp = new Map();
    }

    track(w) {
        if (!w.boss) { this.pp.clear(); return; }
        for (const q of w.boss.parts) {
            const prev = this.pp.get(q);
            if (prev) this.pv.set(q, [(q.x - prev[0]) * 120, (q.y - prev[1]) * 120]);
            this.pp.set(q, [q.x, q.y]);
        }
    }

    target(w) {
        const p = w.player;
        let best = null, bs = -1e9;
        for (const e of w.enemies) {
            if (e.dead || e.ghost || e.hp === Infinity || e.x < p.x - 1 || e.x > W) continue;
            const s = (e.kind === 'carrier' ? 30 : 0) + (e.maxHp > 20 ? 6 : 0) - Math.abs(e.y - p.y) * 0.6 - (e.x - p.x) * 0.15;
            if (s > bs) { bs = s; best = e; }
        }
        if (w.boss && w.boss.st === 'fight') {
            for (const q of w.boss.parts) {
                if (!q.alive || q.armor || q.hidden || !(q.hp < Infinity)) continue;
                const s = 20 + (q.core ? 0 : 6) - Math.abs(q.y - p.y) * 0.3;
                if (s > bs) { bs = s; best = q; }
            }
        }
        return best;
    }

    danger(w, x, y, t) {
        let d = 0;
        const pr = PLAYER.r + 0.18;
        for (const b of w.bullets) {
            const bx = b.x + b.vx * t, by = b.y + b.vy * t;
            const dx = bx - x, dy = by - y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) continue;
            const dist = Math.hypot(dx, dy) - b.r - pr;
            if (dist < 0) d += 60; else if (dist < 1.2) d += (1.2 - dist) * 6;
        }
        for (const l of w.lasers) {
            if (l.t + t < l.warn - 0.45) continue;
            const ca = Math.cos(l.a), sa = Math.sin(l.a);
            const px = x - l.x, py = y - l.y;
            const along = px * ca + py * sa;
            if (along < -0.5 || along > l.len) continue;
            const off = Math.abs(px * sa - py * ca) - l.w - pr;
            if (off < 0) d += 80; else if (off < 1.2) d += (1.2 - off) * 8;
        }
        for (const e of w.enemies) {
            if (e.dead) continue;
            if (e.rect) {
                const r = e.rect, m = 0.6;
                if (x > r.x0 - m && x < r.x1 + m && y > r.y0 - m && y < r.y1 + m) d += 70;
                continue;
            }
            if (e.kind === 'crusher' || e.kind === 'geyser') {
                // telegraphed hazards: keep out of the column before it fires
                if (Math.abs(x - e.x) < 1.6) d += e.kind === 'crusher' ? (y > (e.y ?? 0) - 1.5 ? 50 : 14) : 25;
                continue;
            }
            const ex = e.x + (e.vx || 0) * t, ey = e.y + (e.vy || 0) * t;
            const dist = Math.hypot(ex - x, ey - y) - e.r - pr;
            if (!e.noContact && !e.ghost) { if (dist < 0) d += 70; else if (dist < 1.5) d += (1.5 - dist) * 5; }
            if (e.kind === 'bull' && Math.abs(ey - y) < 1.6) d += 30;
            if (e.parts) for (const q of e.parts) if (q.alive) {
                const qd = Math.hypot(q.x - x, q.y - y) - q.r - pr;
                if (qd < 0) d += 60; else if (qd < 1) d += (1 - qd) * 5;
            }
            if (e.kind === 'hand' && Math.abs(e.x - x) < 1.4 && y < (w.terrain.at(e.wx).floor + 6)) d += 30;
        }
        if (w.boss && w.boss.st !== 'dead') {
            for (const q of w.boss.parts) {
                if (!q.alive || !q.body) continue;
                const v = this.pv.get(q) || [0, 0];
                const qd = Math.hypot(q.x + v[0] * t - x, q.y + v[1] * t - y) - q.r - pr;
                if (qd < 0) d += 80; else if (qd < 2) d += (2 - qd) * 6;
            }
        }
        for (const dx of [-0.6, 0, 0.6]) {
            const tr = w.terrain.at(w.scroll + w.speed * t + x + dx);
            const m = Math.min(y - tr.floor, tr.ceil - y) - PLAYER.body;
            if (m < 0) d += 90; else if (m < 1.1) d += (1.1 - m) * 12;
        }
        for (const b of w.blocks) {
            const x0 = b.wx - w.scroll - w.speed * t - b.w / 2;
            if (x > x0 - 1.0 && x < x0 + b.w + 0.6 && y > b.y0 - 0.7 && y < b.y1 + 0.7) d += 60;
            // a pillar coming at us: get out of its rows early
            const ahead = x0 - x;
            if (ahead > 0 && ahead < 6 && y > b.y0 - 0.9 && y < b.y1 + 0.9) d += 10 * (1 - ahead / 6);
        }
        if (x < 1 || x > W - 1 || y < 0.6 || y > H - 0.6) d += 4;
        if (x < 2.4) d += (2.4 - x) * 2.5;          // don't get pinned against the left edge
        return d;
    }

    think(w) {
        const p = w.player;
        this.track(w);
        const out = { ax: 0, ay: 0, fire: true, beam: false, halo: false, focus: false };
        if (!p.alive) { out.fire = false; return out; }
        const tg = this.target(w);
        let ty = tg ? tg.y : 9;
        // gap-seeking: in a corridor aim for its middle unless a target says otherwise
        const tr = w.terrain.at(w.scroll + p.x + 3);
        const mid = (Math.max(0, tr.floor) + Math.min(H, tr.ceil)) / 2;
        if (!tg) ty = mid;
        ty = Math.max(tr.floor + 1.2, Math.min(tr.ceil - 1.2, ty));
        let tx = 7.5;
        if (w.boss && w.boss.kind === 'malphas') tx = 9;
        if (tg && tg.x < p.x + 2 && tg.x > p.x - 1) tx = p.x - 2;   // back off something on top of us

        const sp = PLAYER.speeds[w.S.power.speed];
        let best = null, bestS = 1e9;
        for (const focus of [false, true]) {
            const s = sp * (focus ? PLAYER.focus : 1);
            for (const [dx, dy] of DIRS) {
                let score = 0;
                for (const [t, k] of [[0.08, 1.2], [0.2, 1], [0.38, 0.55]]) {
                    const x = p.x + dx * s * t + w.pull * t, y = p.y + dy * s * t;
                    score += this.danger(w, x, y, t) * k;
                }
                const nx = p.x + dx * s * 0.2, ny = p.y + dy * s * 0.2;
                score += Math.abs(ny - ty) * 0.35 + Math.abs(nx - tx) * 0.12 + (focus ? 0.05 : 0);
                if (score < bestS) { bestS = score; best = [dx, dy, focus]; }
            }
        }
        out.ax = best[0]; out.ay = best[1]; out.focus = best[2];
        if (this.skill < 1 && w.rng() > this.skill) { out.ax = 0; out.ay = 0; }

        // Radiance: charge against a boss or a big target when it's calm
        this.cool -= 1 / 120;
        const big = (w.boss && w.boss.st === 'fight') || (tg && tg.maxHp > 20);
        if (this.hold > 0) {
            this.hold -= 1 / 120;
            out.beam = this.hold > 0 && bestS < 20;
            out.fire = false;
            if (!out.beam) { this.hold = 0; this.cool = 1.2; }
        } else if (big && this.cool <= 0 && bestS < 3 && tg && Math.abs(tg.y - p.y) < 1.5) {
            this.hold = PLAYER.chargeTime + 0.05;
            out.beam = true; out.fire = false;
        }
        const h = w.halo;
        if (h && (h.st === 'free') && w.rng() < 0.02) out.halo = true;
        return out;
    }
}
