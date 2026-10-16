// The HUD, drawn in beams over the world in HUD units (the shorter side of the screen is 300,
// origin at the centre, y up). On foot it is Battlezone's: a radar with a sweep, "ENEMY IN
// RANGE", a gunsight that closes on a target, cracked glass when the dragon falls. On the wing
// it is Star Wars': a targeting cross, a shield count, and the distance to the ward stone.
// Both show the dragon's own snout at the bottom of the view, breathing fire when it shoots.

import { GROUND, FLIGHT, SCALES, TRACKS } from '../config.js';
import { ENEMY, STAGES, BEATS } from '../sim/data.js';
import { bearing } from '../sim/util.js';
import { drawText, textWidth } from '../art/font.js';

const RED = [1, 0.25, 0.15], GREEN = [0.3, 1, 0.4], AMBER = [1, 0.72, 0.2], YELLOW = [1, 1, 0.35];
const CYAN = [0.3, 0.95, 1], WHITE = [0.95, 0.97, 1], FIRE = [1, 0.55, 0.12], MAGENTA = [1, 0.35, 0.85];

export class Hud {
    constructor(view) {
        this.view = view;
        this.pops = [];
        this.flame = 0;
        this.cracks = null;
        this.hurtMarks = [];
        this.best = 0;
        this.demo = false;
    }

    reset() { this.pops.length = 0; this.cracks = null; this.hurtMarks.length = 0; }

    popup(text, col, life = 1.4) {
        this.pops.push({ text, col, t: 0, life });
        if (this.pops.length > 5) this.pops.shift();
    }

    hurt(G) {
        // a few short cracks at a random point of the glass, which heal away
        const L = this.view.r.layout;
        const cx = L.bx + L.bw * (0.25 + Math.random() * 0.5), cy = L.by + L.bh * (0.3 + Math.random() * 0.4);
        this.hurtMarks.push({ segs: this.crackAt(cx, cy, 5, 40), t: 0, life: 1.1 });
    }

    crack() {
        const L = this.view.r.layout;
        const cx = L.bx + L.bw * (0.35 + Math.random() * 0.3), cy = L.by + L.bh * (0.35 + Math.random() * 0.3);
        this.cracks = this.crackAt(cx, cy, 11, Math.max(L.bw, L.bh));
    }

    crackAt(cx, cy, n, reach) {
        const segs = [];
        for (let i = 0; i < n; i++) {
            let a = (i / n) * Math.PI * 2 + Math.random() * 0.4, x = cx, y = cy;
            const len = reach * (0.25 + Math.random() * 0.5);
            let gone = 0;
            while (gone < len) {
                const step = 8 + Math.random() * 18;
                const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
                segs.push([x, y, nx, ny]);
                if (Math.random() < 0.18) {
                    const b = a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
                    segs.push([nx, ny, nx + Math.cos(b) * step * 0.8, ny + Math.sin(b) * step * 0.8]);
                }
                x = nx; y = ny; gone += step;
                a += (Math.random() - 0.5) * 0.6;
            }
        }
        // the ring of shattered glass round the impact
        for (let i = 0; i < 10; i++) {
            const a0 = (i / 10) * Math.PI * 2, a1 = ((i + 1) / 10) * Math.PI * 2, r = 10 + Math.random() * 6;
            segs.push([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]);
        }
        return segs;
    }

    text(str, x, y, size, col, inten = 1, align = 'left', w = 1) {
        const b = this.view.r.hud;
        b.pen(col, inten, w);
        drawText(b, str, x, y, size, align);
    }

    /** A size that fits str into width (HUD units), no bigger than max. */
    fit(str, width, max) { return Math.min(max, width / Math.max(1, str.length * 6 - 2)); }

    draw(G, dt) {
        const b = this.view.r.hud, L = this.view.r.layout, t = this.view.time;
        this.flame = Math.max(0, this.flame - dt * 6);
        const flight = G.mode === 'flight';
        const top = L.H / 2, right = L.W / 2, left = -L.W / 2;
        const bandTop = L.by + L.bh;

        // the periscope frame, when the world is seen through a slot
        if (L.bh < L.H - 2) {
            b.pen(flight ? CYAN : RED, 0.55, 1);
            b.seg(left + 4, L.by, right - 4, L.by);
            b.seg(left + 4, bandTop, right - 4, bandTop);
            for (const x of [left + 4, right - 4]) { b.seg(x, L.by, x, L.by + 10); b.seg(x, bandTop, x, bandTop - 10); }
        }

        const hudCol = flight ? YELLOW : RED;
        // score and best, top right (clear of the pause button)
        const sx = right - 50, sy = top - 16;
        const small = Math.min(1.05, L.W / 250);
        this.text(String(G.score).padStart(6, '0'), sx, sy - 6 * small, small * 1.15, hudCol, 1.1, 'right');
        this.text('HIGH ' + String(Math.max(this.best, G.score)).padStart(6, '0'), sx, sy - 6 * small - 14 * small, small * 0.75, hudCol, 0.7, 'right');

        // the dragon's armour: one scale per hit point
        const scy = sy - 6 * small - 30 * small;
        for (let i = 0; i < SCALES; i++) {
            const x = sx - i * 10 * small, on = i < G.scales;
            const pulse = on && G.scales <= 2 ? 0.6 + 0.6 * Math.abs(Math.sin(t * 6)) : 1;
            b.pen(flight ? CYAN : GREEN, on ? 1.1 * pulse : 0.2, 1);
            const s = 3.4 * small;
            b.poly([x, scy + s, x + s * 0.8, scy, x, scy - s, x - s * 0.8, scy], true);
            if (on) b.seg(x, scy + s * 0.5, x, scy - s * 0.5);
        }
        if (L.W > 420) this.text(flight ? 'SHIELD' : 'SCALES', sx - SCALES * 10 * small - 4, scy - 3 * small * 0.7, small * 0.7, flight ? CYAN : GREEN, 0.75, 'right');

        // stage and progress, top left under the ← Games link
        const def = STAGES[G.stageIdx];
        const lx = left + 10, ly = top - 34 * small - 10;
        this.text(stageTag(G), lx, ly, small * 0.75, hudCol, 0.8);
        this.text(progressText(G), lx, ly - 12 * small, small * 0.75, hudCol, 0.8);

        if (G.mode === 'ground') this.drawGround(G, b, L, t, small);
        else this.drawFlight(G, b, L, t, small);

        this.drawSnout(G, b, L, t);

        // hurt cracks heal; death cracks stay
        for (let i = this.hurtMarks.length - 1; i >= 0; i--) {
            const m = this.hurtMarks[i];
            m.t += dt;
            if (m.t >= m.life) { this.hurtMarks.splice(i, 1); continue; }
            b.pen(WHITE, 0.9 * (1 - m.t / m.life), 0.8);
            for (const s of m.segs) b.seg(s[0], s[1], s[2], s[3]);
        }
        if (this.cracks && G.phase === 'dead') {
            b.pen(WHITE, 0.9, 0.9);
            for (const s of this.cracks) b.seg(s[0], s[1], s[2], s[3]);
        }

        // score popups under the score
        let py = scy - 22 * small;
        for (let i = this.pops.length - 1; i >= 0; i--) {
            const p = this.pops[i];
            p.t += dt;
            if (p.t >= p.life) { this.pops.splice(i, 1); continue; }
            const k = 1 - p.t / p.life;
            const sz = this.fit(p.text, L.W * 0.55, small * 0.95);
            this.text(p.text, sx, py + (1 - k) * 4, sz, p.col, 0.4 + k, 'right');
            py -= 12 * small;
        }

        if (!this.demo) this.drawBanner(G, L, t, small, def);
    }

    // ------------------------------------------------------------------ Battlezone
    drawGround(G, b, L, t, small) {
        const p = G.player, top = L.H / 2;
        const R = Math.min(30, L.W * 0.1);
        const cx = 0, cy = top - R - 12;
        // radar
        b.pen(RED, 0.85, 1);
        b.circle(cx, cy, R, 28);
        b.pen(RED, 0.35, 0.8);
        b.circle(cx, cy, R * 0.5, 20);
        b.seg(cx, cy + R + 3, cx, cy + R - 3);
        const half = Math.atan(this.view.tanH);
        b.seg(cx, cy, cx + Math.sin(-half) * R, cy + Math.cos(-half) * R);
        b.seg(cx, cy, cx + Math.sin(half) * R, cy + Math.cos(half) * R);
        const sweep = (t * 2.2) % (Math.PI * 2);
        b.pen(RED, 0.9, 1);
        b.seg(cx, cy, cx + Math.sin(sweep) * R, cy + Math.cos(sweep) * R);
        let nearest = null, nd = Infinity;
        for (const e of G.enemies) {
            const d = Math.hypot(e.x - p.x, e.z - p.z);
            const br = bearing(p.x, p.z, p.h, e.x, e.z);
            if (ENEMY[e.kind].quota || e.kind === 'dragonbane') { if (d < nd) { nd = d; nearest = { e, d, br }; } }
            if (d > GROUND.radar) continue;
            let diff = ((sweep - br) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            const glow = Math.max(0.25, 1.3 - diff * 0.5);
            b.pen(e.kind === 'wisp' ? CYAN : RED, glow, e.kind === 'dragonbane' ? 2.6 : 1.6);
            b.dot(cx + Math.sin(br) * (d / GROUND.radar) * R, cy + Math.cos(br) * (d / GROUND.radar) * R);
        }
        // the warnings under the radar
        let msg = null;
        if (nearest && G.phase === 'play') {
            if (Math.abs(nearest.br) < half && nearest.d < GROUND.inRange) msg = 'ENEMY IN RANGE';
            else if (Math.abs(nearest.br) > 2.3) msg = 'ENEMY TO REAR';
            else if (nearest.br < 0) msg = 'ENEMY TO LEFT';
            else msg = 'ENEMY TO RIGHT';
        }
        if (msg && Math.floor(t * 3) % 2 === 0) this.text(msg, 0, cy - R - 14 * small, small * 0.9, RED, 1.1, 'center');

        // the boss's strength
        const boss = G.enemies.find((e) => e.kind === 'dragonbane');
        if (boss) {
            const bw = Math.min(160, L.W * 0.5), by = cy - R - 30 * small;
            this.text('THE DRAGONBANE', 0, by + 4, small * 0.7, RED, 0.9, 'center');
            b.pen(RED, 0.8, 1);
            b.poly([-bw / 2, by, bw / 2, by, bw / 2, by - 6, -bw / 2, by - 6], true);
            const k = Math.max(0, boss.hp / boss.maxHp);
            b.pen(RED, 1.2, 2.2);
            b.seg(-bw / 2 + 2, by - 3, -bw / 2 + 2 + (bw - 4) * k, by - 3);
        }

        // the gunsight: Battlezone's ticks, which close in when a target is in the line of fire
        const gx = 0, gy = L.by + L.bh / 2;
        let onTarget = false;
        for (const e of G.enemies) {
            const d = Math.hypot(e.x - p.x, e.z - p.z);
            if (d > GROUND.shotRange) continue;
            if (Math.abs(bearing(p.x, p.z, p.h, e.x, e.z)) < Math.atan2(ENEMY[e.kind].r, d)) { onTarget = true; break; }
        }
        const gap = onTarget ? 4 : 9, len = 14;
        b.pen(onTarget ? WHITE : GREEN, onTarget ? 1.3 : 0.9, 1);
        b.seg(gx, gy + gap, gx, gy + gap + len);
        b.seg(gx, gy - gap, gx, gy - gap - len);
        b.seg(gx - 12, gy + gap + len, gx + 12, gy + gap + len);
        b.seg(gx - 12, gy - gap - len, gx + 12, gy - gap - len);
        b.seg(gx - 12, gy + gap + len, gx - 12, gy + gap + len - 4);
        b.seg(gx + 12, gy + gap + len, gx + 12, gy + gap + len - 4);
        b.seg(gx - 12, gy - gap - len, gx - 12, gy - gap - len + 4);
        b.seg(gx + 12, gy - gap - len, gx + 12, gy - gap - len + 4);
        if (onTarget) { b.seg(gx - 20, gy, gx - 15, gy); b.seg(gx + 15, gy, gx + 20, gy); }
    }

    // ------------------------------------------------------------------ Star Wars
    drawFlight(G, b, L, t, small) {
        const p = G.player, fl = G.fl, top = L.H / 2;
        // the targeting cross, where fire converges
        const a = this.aimHud(G);
        if (a) {
            let onTarget = false;
            for (const e of G.enemies) {
                const h = this.view.toHud(G, e.x, e.y, e.z);
                if (h && Math.hypot(h.x - a.x, h.y - a.y) < 12) { onTarget = true; break; }
            }
            for (const f of G.foes) {
                const h = this.view.toHud(G, f.x, f.y, f.z);
                if (h && Math.hypot(h.x - a.x, h.y - a.y) < 10) { onTarget = true; break; }
            }
            const s = onTarget ? 7 : 10, g = 3;
            b.pen(onTarget ? RED : YELLOW, 1.3, 1.1);
            b.seg(a.x - s - g, a.y, a.x - g, a.y); b.seg(a.x + g, a.y, a.x + s + g, a.y);
            b.seg(a.x, a.y - s - g, a.x, a.y - g); b.seg(a.x, a.y + g, a.x, a.y + s + g);
            if (onTarget) {
                b.poly([a.x - 12, a.y, a.x, a.y + 12, a.x + 12, a.y, a.x, a.y - 12], true);
            }
        }

        // the wings, at either side of the view, beating slowly: an arm bone, finger bones, and
        // the membrane scalloped between their tips
        const ws = Math.min(1, L.bw / 560);
        const flap = Math.sin(t * 2.4) * 8 * ws, roll = this.view.r.camera.rotation.z;
        for (const sd0 of [-1, 1]) {
            const sd = sd0 * ws;
            const ex = sd0 * L.W / 2, y0 = L.by + L.bh * 0.3 + flap - sd0 * roll * 60;
            const wrist = [ex - sd * 40, y0 + 46 * ws];
            b.pen(CYAN, 0.8, 1.2);
            b.seg(ex, y0 - 10 * ws, wrist[0], wrist[1]);
            const tips = [[ex - sd * 70, y0 + 10 * ws], [ex - sd * 62, y0 - 22 * ws], [ex - sd * 44, y0 - 46 * ws], [ex - sd * 18, y0 - 60 * ws]];
            b.pen(CYAN, 0.6, 1);
            for (const tp of tips) b.seg(wrist[0], wrist[1], tp[0], tp[1]);
            b.pen(CYAN, 0.45, 0.9);
            let prev = [wrist[0] - sd * 4, wrist[1] + 6 * ws];
            for (const tp of [...tips, [ex, y0 - 64 * ws]]) {
                const mx = (prev[0] + tp[0]) / 2 + sd * 7, my = (prev[1] + tp[1]) / 2 + 4 * ws;
                b.seg(prev[0], prev[1], mx, my); b.seg(mx, my, tp[0], tp[1]);
                prev = tp;
            }
        }

        // what the stage asks
        const T = TRACKS[fl.track];
        if (fl.track === 'gorge') {
            const left = Math.max(0, fl.len - fl.dist);
            const bw = Math.min(170, L.W * 0.55), by = L.bh < L.H - 2 ? L.by + L.bh + 18 : top - 22;
            this.text('WARD STONE', 0, by + 3, small * 0.7, MAGENTA, 0.9, 'center');
            b.pen(MAGENTA, 0.8, 1);
            b.poly([-bw / 2, by - 2, bw / 2, by - 2, bw / 2, by - 8, -bw / 2, by - 8], true);
            const k = 1 - left / fl.len;
            b.pen(MAGENTA, 1.2, 2.2);
            b.seg(-bw / 2 + 2, by - 5, -bw / 2 + 2 + (bw - 4) * k, by - 5);
            // warn of the chain bridges
            for (const w of fl.walks) {
                const rz = w.z - fl.dist;
                if (rz < 0 || rz > 95) continue;
                const pass = w.y < 7 ? 'CLIMB' : w.y > 12 ? 'DIVE' : (p.py > w.y ? 'CLIMB' : 'DIVE');
                if (Math.floor(t * 4) % 2 === 0) this.text(`CHAINS AHEAD  ${pass}`, 0, L.by + L.bh * 0.78, small * 0.95, YELLOW, 1.2, 'center');
                break;
            }
            const stone = G.enemies.find((e) => e.kind === 'wardstone');
            if (stone && left < 320 && G.phase === 'play' && Math.floor(t * 3) % 2 === 0) this.text('SHOOT THE WARD STONE', 0, L.by + L.bh * 0.7, small * 0.9, MAGENTA, 1.2, 'center');
        }
        // altitude ladder, for the gorge and the ramparts
        if (fl.track !== 'sky') {
            const x = L.W / 2 - 16, y0 = L.by + L.bh * 0.25, h = L.bh * 0.5;
            b.pen(CYAN, 0.5, 0.9);
            b.seg(x, y0, x, y0 + h);
            const k = (p.py - (T.base - T.latY)) / (2 * T.latY);
            b.pen(CYAN, 1.1, 1.2);
            b.poly([x - 6, y0 + h * k, x - 1, y0 + h * k + 3, x - 1, y0 + h * k - 3], true);
            if (fl.track === 'gorge') {
                for (const w of fl.walks) {
                    const rz = w.z - fl.dist;
                    if (rz < 0 || rz > 95) continue;
                    const kw = (w.y - (T.base - T.latY)) / (2 * T.latY);
                    b.pen(YELLOW, 1, 1.4);
                    b.seg(x - 4, y0 + h * kw, x + 4, y0 + h * kw);
                    break;
                }
            }
        }
    }

    aimHud(G) {
        const p = G.player, fl = G.fl, d = 70;
        return this.view.toHud(G, p.px + Math.tan(p.ax * FLIGHT.aimYaw) * d, p.py + Math.tan(p.ay * FLIGHT.aimPitch) * d, fl.dist + d);
    }

    // ------------------------------------------------------------------ the snout
    drawSnout(G, b, L, t) {
        if (G.phase === 'ascend' && G.phaseT < 1) return;
        const flight = G.mode === 'flight';
        const y0 = L.by, w = Math.min(L.bw * 0.16, 62);
        const breathe = Math.sin(t * 1.3) * 1.5;
        const col = flight ? CYAN : GREEN;
        b.pen(col, 0.8, 1.1);
        // two ridges of the long snout meeting at the nose
        const ny = y0 + w * 0.55 + breathe;
        b.poly([-w, y0, -w * 0.62, y0 + w * 0.32, -w * 0.28, ny - 4, -w * 0.12, ny, w * 0.12, ny, w * 0.28, ny - 4, w * 0.62, y0 + w * 0.32, w, y0]);
        b.poly([-w * 0.45, y0, -w * 0.3, y0 + w * 0.25, -w * 0.14, ny - 6]);
        b.poly([w * 0.45, y0, w * 0.3, y0 + w * 0.25, w * 0.14, ny - 6]);
        // a row of small spikes down the ridge of the snout
        for (let i = 0; i < 3; i++) {
            const yy = y0 + 6 + i * w * 0.14, hw = w * 0.05 * (1 - i * 0.2);
            b.poly([-hw, yy, 0, yy + hw * 2.2, hw, yy]);
        }
        // nostrils, smoking a little
        b.circle(-w * 0.13, ny - 7, 3, 8);
        b.circle(w * 0.13, ny - 7, 3, 8);
        // fire when the dragon breathes
        if (this.flame > 0) {
            const k = this.flame;
            b.pen(FIRE, 1.4 * k, 1.6);
            for (let i = 0; i < 5; i++) {
                const a = -0.5 + i * 0.25 + Math.sin(t * 40 + i) * 0.1;
                const len = (18 + i % 2 * 10) * (0.5 + k);
                b.seg(0, ny + 2, Math.sin(a) * len * 0.5, ny + 2 + Math.cos(a) * len);
            }
            b.pen(YELLOW, 1.6 * k, 1.2);
            b.seg(-4, ny + 2, 0, ny + 18 * k); b.seg(4, ny + 2, 0, ny + 18 * k);
        } else if (Math.floor(t * 0.7) % 3 === 0) {
            const ph = (t * 0.7) % 1;
            b.pen(col, 0.3 * (1 - ph), 0.8);
            for (const sd of [-1, 1]) b.seg(sd * w * 0.13, ny - 4 + ph * 14, sd * w * 0.13 + Math.sin(t * 3) * 3, ny + 2 + ph * 18);
        }
    }

    // ------------------------------------------------------------------ banners
    drawBanner(G, L, t, small, def) {
        const flight = G.mode === 'flight';
        const col = flight ? YELLOW : RED;
        const cy = L.by + L.bh * 0.36;
        const width = L.W * 0.86;
        if (G.phase === 'intro') {
            const k = 1 - G.phaseT / BEATS.intro;
            const reveal = Math.min(1, k * 2.2);
            const b = this.view.r.hud;
            const s1 = this.fit(def.name, width, 3 * small);
            b.pen(col, 1.2, 1.3);
            drawText(b, def.name, 0, cy, s1, 'center', reveal);
            const s2 = this.fit(def.line, width, 1.2 * small);
            if (k > 0.3) this.text(def.line, 0, cy - 10 * s2 - 6, s2, col, 0.85, 'center');
            const sub = stageSub(G);
            if (k > 0.45) this.text(sub, 0, cy - 22 * s2 - 10, this.fit(sub, width, 1.1 * small), col, 0.85, 'center');
        } else if (G.phase === 'clear') {
            const msg = def.boss ? 'THE DRAGONBANE FALLS' : flight ? 'WELL FLOWN' : 'MARCH CLEARED';
            this.text(msg, 0, cy, this.fit(msg, width, 2.6 * small), col, 1.2, 'center', 1.3);
            const sub = 'A SCALE GROWS BACK';
            this.text(sub, 0, cy - 26 * small, this.fit(sub, width, 1.1 * small), flight ? CYAN : GREEN, 0.85, 'center');
        } else if (G.phase === 'ascend') {
            const k = 1 - G.phaseT / BEATS.ascend;
            const l1 = 'THE IRON WARD BREAKS', l2 = 'YOUR WINGS REMEMBER THE SKY';
            if (k > 0.05) this.text(l1, 0, cy + 10, this.fit(l1, width, 2 * small), AMBER, 1.2, 'center', 1.2);
            if (k > 0.35) this.text(l2, 0, cy - 14 * small, this.fit(l2, width, 1.5 * small), CYAN, 1.2, 'center', 1.2);
        } else if (G.phase === 'dead') {
            const l = 'THE DRAGON FALLS';
            this.text(l, 0, cy, this.fit(l, width, 2.6 * small), RED, 1.2, 'center', 1.3);
        }
    }
}

function stageTag(G) {
    const def = STAGES[G.stageIdx];
    const cyc = G.loop ? ` CYCLE ${G.loop + 1}` : '';
    if (def.mode === 'ground') return def.boss ? `BOSS${cyc}` : `MARCH ${G.stageIdx + 1} OF 4${cyc}`;
    return `FLIGHT ${G.stageIdx - 4} OF 3${cyc}`;
}

function progressText(G) {
    const def = STAGES[G.stageIdx];
    if (def.boss) return 'BREAK THE ENGINE';
    if (def.quota) return `${def.mode === 'ground' ? 'FOES' : 'GRIFFONS'} ${G.stageKills}/${def.quota}`;
    if (def.track === 'ramparts') return `TOWERS ${G.fl.towersDown}/${G.fl.towers}`;
    return 'FLY THE GORGE';
}

function stageSub(G) {
    const def = STAGES[G.stageIdx];
    if (def.boss) return 'BREAK IT AND FLY';
    if (def.quota) return def.mode === 'ground' ? `DESTROY ${def.quota} FOES` : `BRING DOWN ${def.quota} GRIFFON KNIGHTS`;
    if (def.track === 'ramparts') return 'SHOOT THE CRYSTALS ATOP THE TOWERS';
    return 'MIND THE CHAINS';
}

export { textWidth };
