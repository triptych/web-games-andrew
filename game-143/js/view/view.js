// The Canvas 2D view: the town as a little diorama on its painted green, the siege seen from the side, the
// title's key art, and the particles. Reads G and answers events; never changes G.

import { DAY_LEN, FIELD, DOILY, KNIGHT, PLOTS_OPEN } from '../config.js';
import { BUILDINGS, ENEMIES, STAFF, ADVENTURERS } from '../sim/data.js';
import { IMG } from './assets.js';
import { hash3 } from '../rng.js';

// Plot anchors on the town backdrop (fractions of the 1600x900 picture): bottom-centre of each building.
export const PLOT_POS = [
    { x: 0.25, y: 0.965, s: 1 }, { x: 0.47, y: 0.965, s: 1 }, { x: 0.69, y: 0.965, s: 1 },
    { x: 0.21, y: 0.81, s: 0.84 }, { x: 0.39, y: 0.81, s: 0.84 }, { x: 0.57, y: 0.81, s: 0.84 }, { x: 0.75, y: 0.81, s: 0.84 },
    { x: 0.27, y: 0.665, s: 0.68 }, { x: 0.42, y: 0.665, s: 0.68 }, { x: 0.57, y: 0.665, s: 0.68 }, { x: 0.72, y: 0.665, s: 0.68 }, { x: 0.86, y: 0.7, s: 0.7 },
];
const HALL_POS = { x: 0.085, y: 0.66, s: 0.78 };
const BG_W = 1600, BG_H = 900;
const STAFF_SPRITE = Object.fromEntries(Object.entries(STAFF).map(([k, v]) => [k, v.sprite]));
const VILLAGERS = ['vil/tansy', 'vil/hollyhock', 'vil/bram', 'vil/hilde'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.fx = [];
        this.rings = [];
        this.shake = 0;
        this.pan = null;           // town pan in screen px (null = centre on the next frame)
        this.hoverPlot = -1;
        this.selPlot = -1;
        this.throwT = 0;
        this.flash = 0;
        this.love = 0;
        this.web = 0;
        this.time = 0;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.pan = null;
    }

    // ------------------------------------------------------------------ town geometry
    townXf() {
        // the backdrop fills the height between the top bar and the dock; wider than the screen means it pans
        const k = Math.max(this.h / (BG_H * 0.94), this.w / BG_W);
        const sw = BG_W * k;
        if (this.pan == null) this.pan = clamp(this.w / 2 - sw * 0.47, this.w - sw, 0);
        this.pan = clamp(this.pan, Math.min(0, this.w - sw), 0);
        const oy = this.h - 64 - BG_H * k * 0.985;
        return { k, ox: this.pan, oy, sw };
    }
    townPt(p) { const t = this.townXf(); return { x: t.ox + p.x * BG_W * t.k, y: t.oy + p.y * BG_H * t.k, k: t.k * p.s }; }
    panBy(dx) { if (this.pan != null) this.pan += dx; }
    centreOn(i) { const t = this.townXf(); const p = PLOT_POS[i] || HALL_POS; this.pan = this.w / 2 - p.x * BG_W * t.k; }

    /** Client point on a plot's lot (for tests and for centring). */
    plotClient(i) {
        const r = this.canvas.getBoundingClientRect(), q = this.townPt(PLOT_POS[i]);
        return { x: r.left + q.x, y: r.top + q.y - 40 * q.k };
    }

    /** Plot under a client point: index, 'hall', or -1. */
    pickTown(G, cx, cy) {
        const r = this.canvas.getBoundingClientRect();
        const x = cx - r.left, y = cy - r.top;
        let best = -1, bd = Infinity;
        const test = (p, id) => {
            const q = this.townPt(p);
            const hw = 95 * q.k, hh = 190 * q.k;
            if (x > q.x - hw && x < q.x + hw && y > q.y - hh && y < q.y + 12 * q.k) {
                const d = Math.hypot(x - q.x, y - (q.y - hh / 2));
                if (d < bd) { bd = d; best = id; }
            }
        };
        PLOT_POS.forEach((p, i) => { if (i < PLOTS_OPEN[2]) test(p, i); });
        test(HALL_POS, 'hall');
        return best;
    }

    // ------------------------------------------------------------------ battle geometry
    bGeo() {
        const groundY = this.h * 0.82;
        const wallFace = Math.max(70, this.w * 0.14);
        const right = this.w - 8;
        const u = clamp(Math.min(this.w / 1280, this.h / 720), 0.42, 1.4);
        return { groundY, wallFace, right, u };
    }
    fx2s(x) { const g = this.bGeo(); return g.wallFace + (x / FIELD.w) * (g.right - g.wallFace); }
    /** Client x on the field → field x (for aiming). */
    toField(cx) {
        const r = this.canvas.getBoundingClientRect(), g = this.bGeo();
        return ((cx - r.left - g.wallFace) / (g.right - g.wallFace)) * FIELD.w;
    }
    eY(e, g) { return g.groundY - (1 - e.y) * this.h * 0.075; }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (G.mode === 'battle' && G.battle) {
                const g = this.bGeo();
                const sx = e.x != null ? this.fx2s(e.x) : 0, sy = e.y != null ? this.eY(e, g) - (e.fly ? this.h * 0.18 : 0) : g.groundY;
                if (e.type === 'hit') this.burst(sx, sy - 20 * g.u, 4, ['#c98a4b', '#f3d9b0', '#ff9fd2'], 'crumb');
                else if (e.type === 'calm') { this.burst(sx, sy - 25 * g.u, 10, ['#c98a4b', '#7a4a22', '#fff'], 'crumb'); this.fx.push({ kind: 'z', x: sx, y: sy - 40 * g.u, vx: 6, vy: -20, life: 1.8, max: 1.8 }); }
                else if (e.type === 'wallHit') { this.burst(g.wallFace, sy - 30 * g.u, 3, ['#9a8f9e', '#cfc5d4'], 'dust'); this.shake = Math.max(this.shake, 2); }
                else if (e.type === 'splash') this.rings.push({ x: this.fx2s(e.x), y: this.eY(e, g), r: 4, max: (e.kind === 'potion' ? 7 : DOILY.radius) / FIELD.w * (g.right - g.wallFace), life: 0.35, color: e.kind === 'potion' ? '#8cff9a' : '#fff' });
                else if (e.type === 'throw') this.throwT = 0.25;
                else if (e.type === 'ability') {
                    if (e.id === 'flare') { this.rings.push({ x: this.fx2s(e.x), y: g.groundY, r: 6, max: 12 / FIELD.w * (g.right - g.wallFace), life: 0.6, color: '#ffb347' }); this.burst(this.fx2s(e.x), g.groundY - 30, 30, ['#ffd36b', '#ff8a3d', '#fff2a8'], 'spark'); }
                    else if (e.id === 'stomp') { this.shake = 14; this.burst(this.fx2s(14), g.groundY, 26, ['#c98a4b', '#9a8f9e'], 'dust'); }
                    else if (e.id === 'web') this.web = 1;
                    this.flash = 0.25;
                } else if (e.type === 'kiss') { for (let i = 0; i < 40; i++) this.fx.push({ kind: 'heart', x: this.fx2s(e.x), y: g.groundY - 120 * g.u, vx: (Math.random() - 0.5) * 240, vy: -60 - Math.random() * 200, life: 3, max: 3 }); }
                else if (e.type === 'knightDown') this.burst(this.fx2s(KNIGHT.x), g.groundY - 30 * g.u, 10, ['#d8dde8', '#fff'], 'spark');
            }
            if (e.type === 'built' && e.plot != null) { const q = this.townPt(PLOT_POS[e.plot]); this.burst(q.x, q.y - 60 * q.k, 18, ['#ffd36b', '#fff', '#ff9fd2'], 'spark'); }
            if (e.type === 'battleEnd') { this.fx.length = 0; this.rings.length = 0; this.web = 0; this.pan = null; }
            if (e.type === 'invasion') { this.fx.length = 0; this.love = 0; }
        }
    }
    burst(x, y, n, colors, kind) {
        for (let i = 0; i < n && this.fx.length < 500; i++) {
            const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 140;
            this.fx.push({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.6, max: 1.1, c: colors[i % colors.length] });
        }
    }

    // ------------------------------------------------------------------ drawing helpers
    img(key, x, y, h, { flip = false, alpha = 1, rot = 0, sx = 1, sy = 1, anchor = 'bottom', tint = null } = {}) {
        const im = IMG[key];
        const c = this.ctx;
        if (!im) {
            c.save(); c.globalAlpha = alpha * 0.8; c.fillStyle = '#7a5a9a';
            c.beginPath(); c.ellipse(x, y - h / 2, h * 0.3, h / 2, 0, 0, Math.PI * 2); c.fill(); c.restore();
            return;
        }
        const w = (im.width / im.height) * h;
        c.save();
        c.globalAlpha = alpha;
        c.translate(x, y);
        if (rot) c.rotate(rot);
        c.scale((flip ? -1 : 1) * sx, sy);
        const oy = anchor === 'bottom' ? -h : -h / 2;
        if (tint) c.filter = tint;            // a CSS filter, so only the sprite's own pixels change
        c.drawImage(im, -w / 2, oy, w, h);
        c.restore();
    }
    cover(key, fallback, anchorY = 1) {
        const c = this.ctx, im = IMG[key];
        if (!im) { const g = c.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, fallback[0]); g.addColorStop(1, fallback[1]); c.fillStyle = g; c.fillRect(0, 0, this.w, this.h); return; }
        const k = Math.max(this.w / im.width, this.h / im.height);
        const w = im.width * k, h = im.height * k;
        c.drawImage(im, (this.w - w) / 2, (this.h - h) * anchorY, w, h);
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time, mode, input) {
        this.resize();
        this.time = time;
        const c = this.ctx;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.imageSmoothingEnabled = false;
        this.shake = Math.max(0, this.shake - dt * 30);
        if (this.shake > 0.1) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        if (mode === 'title') this.drawTitle(time);
        else if (G.mode === 'battle' && G.battle) this.drawBattle(G, dt, time, input);
        else this.drawTown(G, dt, time);
        this.drawFx(dt);
        this.flash = Math.max(0, this.flash - dt * 2);
        if (this.flash > 0) { c.fillStyle = `rgba(255, 220, 245, ${this.flash * 0.5})`; c.fillRect(0, 0, this.w, this.h); }
    }

    drawTitle(time) {
        const c = this.ctx;
        this.cover('bg/title', ['#1a1030', '#3a1f4a'], 0.35);
        this.fog(time, this.h * 0.75, 0.25);
        // a few bats
        c.fillStyle = 'rgba(20, 8, 30, 0.85)';
        for (let i = 0; i < 6; i++) {
            const x = ((time * (20 + i * 7) + i * 300) % (this.w + 200)) - 100, y = this.h * (0.12 + 0.06 * i) + Math.sin(time * 2 + i) * 12;
            const f = Math.sin(time * 14 + i) * 6;
            c.beginPath(); c.moveTo(x - 10, y - f); c.lineTo(x, y); c.lineTo(x + 10, y - f); c.lineTo(x + 3, y - 2); c.lineTo(x - 3, y - 2); c.closePath(); c.fill();
        }
    }

    fog(time, y, a) {
        const c = this.ctx;
        for (let i = 0; i < 5; i++) {
            const x = ((time * (8 + i * 3) + i * 400) % (this.w + 600)) - 300;
            c.save();
            c.translate(x, y + i * 6);
            c.scale(1, 0.35);
            const g = c.createRadialGradient(0, 0, 10, 0, 0, 260);
            g.addColorStop(0, `rgba(200, 190, 230, ${a})`); g.addColorStop(1, 'rgba(200, 190, 230, 0)');
            c.fillStyle = g;
            c.beginPath(); c.arc(0, 0, 260, 0, Math.PI * 2); c.fill();
            c.restore();
        }
    }

    drawTown(G, dt, time) {
        const c = this.ctx, t = this.townXf();
        c.fillStyle = '#120a20'; c.fillRect(0, 0, this.w, this.h);
        const bg = IMG['bg/town'];
        if (bg) c.drawImage(bg, t.ox, t.oy, BG_W * t.k, BG_H * t.k);
        else this.cover(null, ['#1a1030', '#2f4a3a']);
        c.imageSmoothingEnabled = false;

        // everything stands in depth order: plots, the hall and the walkers
        const items = [];
        const open = PLOTS_OPEN[G.hall.lvl - 1];
        PLOT_POS.forEach((p, i) => items.push({ y: p.y, draw: () => this.drawPlot(G, i, p, i < open, time) }));
        items.push({ y: HALL_POS.y, draw: () => this.drawHall(G, time) });
        for (const w of this.walkers(G, time)) items.push(w);
        items.sort((a, b) => a.y - b.y);
        for (const it of items) it.draw();

        // dusk and dawn
        const p = G.dayT / DAY_LEN;
        const night = p > 0.72 ? (p - 0.72) / 0.28 : p < 0.08 ? (1 - p / 0.08) * 0.5 : 0;
        if (night > 0) {
            c.fillStyle = `rgba(16, 8, 48, ${night * 0.42})`; c.fillRect(0, 0, this.w, this.h);
            c.globalCompositeOperation = 'lighter';
            G.plots.forEach((pl, i) => {
                if (!pl.b || pl.b.build > 0) return;
                const q = this.townPt(PLOT_POS[i]);
                const g = c.createRadialGradient(q.x, q.y - 70 * q.k, 4, q.x, q.y - 70 * q.k, 120 * q.k);
                g.addColorStop(0, `rgba(255, 190, 100, ${0.22 * night})`); g.addColorStop(1, 'rgba(255, 190, 100, 0)');
                c.fillStyle = g; c.fillRect(q.x - 130 * q.k, q.y - 200 * q.k, 260 * q.k, 260 * q.k);
            });
            c.globalCompositeOperation = 'source-over';
        }
        this.fog(time, t.oy + BG_H * t.k * 0.5, 0.12);
    }

    drawPlot(G, i, p, open, time) {
        const c = this.ctx, q = this.townPt(p), b = G.plots[i].b;
        const sel = i === this.selPlot, hov = i === this.hoverPlot;
        // the lot itself
        c.save();
        c.globalAlpha = open ? 0.55 : 0.22;
        c.fillStyle = '#4a3326';
        c.beginPath(); c.ellipse(q.x, q.y - 6 * q.k, 100 * q.k, 24 * q.k, 0, 0, Math.PI * 2); c.fill();
        if (sel || hov) { c.globalAlpha = 0.9; c.strokeStyle = sel ? '#ffd36b' : '#ffb3dc'; c.lineWidth = 3; c.stroke(); }
        c.restore();
        if (!b) {
            c.save(); c.textAlign = 'center'; c.font = `${Math.round(30 * q.k)}px Fredoka, sans-serif`;
            c.globalAlpha = open ? 0.85 + Math.sin(time * 3 + i) * 0.15 : 0.45;
            c.fillStyle = open ? '#ffe9f6' : '#bba'; c.fillText(open ? '＋' : '🔒', q.x, q.y - 4 * q.k);
            c.restore();
            return;
        }
        const def = BUILDINGS[b.kind];
        const building = b.build > 0 && !b.up;
        const h = (building ? 160 : (b.kind === 'oven' || b.kind === 'tower' || b.kind === 'bell' ? 225 : b.kind === 'beets' || b.kind === 'quarry' || b.kind === 'market' ? 165 : 200)) * q.k * (1 + 0.06 * (b.lvl - 1));
        this.img(building ? 'bld/site' : 'bld/' + b.kind, q.x, q.y + 4 * q.k, h);
        // smoke from the oven while it bakes
        if (b.kind === 'oven' && G.oven.lit && !building) {
            for (let s = 0; s < 3; s++) {
                const ph = (time * 0.5 + s / 3) % 1;
                c.fillStyle = `rgba(230, 220, 240, ${0.35 * (1 - ph)})`;
                c.beginPath(); c.arc(q.x - 30 * q.k + s * 30 * q.k + Math.sin(time + s) * 6, q.y - h - ph * 60 * q.k, (8 + ph * 16) * q.k, 0, Math.PI * 2); c.fill();
            }
        }
        // level stars and progress
        c.save(); c.textAlign = 'center'; c.font = `${Math.round(15 * q.k + 4)}px Fredoka, sans-serif`;
        if (b.build > 0) {
            const tot = (b.up ? 0.4 : 0.25) * DAY_LEN, f = 1 - b.build / tot;
            c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(q.x - 40 * q.k, q.y + 8 * q.k, 80 * q.k, 8 * q.k);
            c.fillStyle = '#ffd36b'; c.fillRect(q.x - 40 * q.k, q.y + 8 * q.k, 80 * q.k * clamp(f, 0, 1), 8 * q.k);
        } else if (b.lvl > 1) { c.fillStyle = '#ffd36b'; c.fillText('★'.repeat(b.lvl), q.x, q.y + 20 * q.k); }
        c.restore();
        // the staff member working here
        for (const id in G.staff) {
            if (G.staff[id].at !== i) continue;
            const bob = Math.abs(Math.sin(time * 4 + i)) * 4 * q.k;
            this.img(STAFF_SPRITE[id], q.x + 78 * q.k, q.y + 6 * q.k - bob, 58 * q.k);
        }
        if (def.unique && b.kind === 'oven' && G.bake.pct > 0) {
            c.save(); c.textAlign = 'center'; c.font = `bold ${Math.round(14 * q.k + 5)}px Fredoka, sans-serif`;
            c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3;
            const txt = `${Math.floor(G.bake.pct)}%`;
            c.strokeText(txt, q.x, q.y - h - 6); c.fillText(txt, q.x, q.y - h - 6); c.restore();
        }
    }

    drawHall(G, time) {
        const q = this.townPt(HALL_POS);
        const sel = this.selPlot === 'hall' || this.hoverPlot === 'hall';
        if (sel) { const c = this.ctx; c.save(); c.strokeStyle = '#ffd36b'; c.lineWidth = 3; c.beginPath(); c.ellipse(q.x, q.y - 6 * q.k, 110 * q.k, 26 * q.k, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
        this.img('bld/hall', q.x, q.y + 6 * q.k, 250 * q.k * (1 + 0.08 * (G.hall.lvl - 1)));
        // the Mayor herself, on the steps
        const bob = Math.sin(time * 2) * 2 * q.k;
        this.img('spr/noxia', q.x + 105 * q.k, q.y + 8 * q.k + bob, 120 * q.k);
    }

    /** Villagers and staff strolling between the plots: view-only, from the clock. */
    walkers(G, time) {
        const out = [];
        const n = clamp(Math.floor(G.pop / 6), 1, 8);
        const who = [];
        for (let i = 0; i < n; i++) who.push(VILLAGERS[i % VILLAGERS.length]);
        for (const id in G.staff) if (G.staff[id].joined && G.staff[id].at == null) who.push(STAFF_SPRITE[id]);
        who.push('staff/mimic', 'staff/skeleton');
        who.forEach((key, i) => {
            const period = 9 + (i % 4) * 2;
            const ph = (time + i * 3.7) / period;
            const seg = Math.floor(ph), f = ph - seg;
            const pt = (s) => ({ x: 0.12 + hash3(i, s, 1) * 0.74, y: 0.7 + hash3(i, s, 2) * 0.28 });
            const a = pt(seg), b = pt(seg + 1);
            const walk = clamp((f - 0.35) / 0.65, 0, 1);         // stand a while, then walk
            const x = lerp(a.x, b.x, walk), y = lerp(a.y, b.y, walk);
            const s = 0.55 + (y - 0.66) * 1.4;
            out.push({ y, draw: () => {
                const q = this.townPt({ x, y, s });
                const bob = walk > 0 && walk < 1 ? Math.abs(Math.sin(time * 9 + i)) * 3 * q.k : 0;
                const h = (key.startsWith('vil/') ? (key === 'vil/tansy' ? 62 : 80) : 66) * q.k;
                this.img(key, q.x, q.y - bob, h, { flip: b.x < a.x });
            } });
        });
        return out;
    }

    // ------------------------------------------------------------------ the siege
    drawBattle(G, dt, time, input) {
        const c = this.ctx, B = G.battle, g = this.bGeo();
        const S = this.S = Math.min(this.h, this.w * 1.25);   // sprite scale: a portrait phone mustn't get giants
        this.cover('bg/field', ['#2a1840', '#3a2a20'], 0.62);
        // pinkening sky once the Queen appears
        if (B.queen) this.love = Math.min(1, this.love + dt * 0.25);
        if (this.love > 0) { c.fillStyle = `rgba(255, 170, 215, ${this.love * 0.3})`; c.fillRect(0, 0, this.w, this.h); }
        // the throwing range and the reticle
        const rx = this.fx2s(DOILY.range);
        c.save();
        c.strokeStyle = 'rgba(255, 220, 245, 0.25)'; c.setLineDash([6, 8]); c.lineWidth = 2;
        c.beginPath(); c.moveTo(rx, g.groundY - this.h * 0.1); c.lineTo(rx, g.groundY + 8); c.stroke();
        c.restore();

        const wallLvl = G.wall.lvl, wallKey = wallLvl >= 4 ? 'wall/5' : wallLvl === 3 ? 'wall/3' : 'wall/1';
        const wallH = Math.min(this.h * 0.5, S * 0.62), wallImg = IMG[wallKey];
        const wallW = wallImg ? (wallImg.width / wallImg.height) * wallH : wallH * 0.45;
        // towers stand behind the wall
        B.towers.forEach((tw, i) => this.img('bld/tower', g.wallFace - wallW * 0.55 - i * 46 * g.u, g.groundY - 6, S * (0.3 + 0.03 * tw.lvl), { alpha: 0.95 }));
        // the wall, cracked as it weakens
        const hpf = B.wall.hp / B.wall.max;
        this.img(wallKey, g.wallFace - wallW / 2, g.groundY + 10 * g.u, wallH, { tint: hpf < 0.35 ? 'sepia(0.5) saturate(1.6) hue-rotate(-25deg) brightness(0.85)' : null });
        const top = g.groundY + 10 * g.u - wallH * 0.86;

        // adventurers on the walkway behind the Mayor
        const onWall = ['fennel', 'lark', 'ottilie', 'moss'].filter((id) => B.advs[id]);
        onWall.forEach((id, i) => this.img(ADVENTURERS[id].sprite, g.wallFace - wallW * 0.15 - (i + 1) * 30 * g.u, top + 4, S * 0.12, { sy: 1 + Math.sin(time * 3 + i) * 0.02 }));
        // the Mayor
        this.throwT = Math.max(0, this.throwT - dt);
        const nx = g.wallFace - wallW * 0.08, nh = S * 0.17;
        if (B.result === 'win' || B.result === 'love') this.img('spr/noxia-cheer', nx, top + 6, nh * 1.05, { sy: 1 + Math.abs(Math.sin(time * 6)) * 0.05 });
        else this.img(this.throwT > 0 ? 'spr/noxia-throw' : 'spr/noxia', nx, top + 6, nh);
        this.handX = nx + nh * 0.3; this.handY = top - nh * 0.6;

        // the knight in front of the wall
        if (B.knight) {
            const kx = this.fx2s(KNIGHT.x);
            if (B.knight.down > 0) this.img('spr/tobias', kx, g.groundY, S * 0.14, { rot: -1.3, alpha: 0.5, anchor: 'centre' });
            else {
                const hit = B.enemies.some((e) => e.block && e.nap <= 0) ? Math.sin(time * 16) * 0.05 : 0;
                this.img('spr/tobias', kx, g.groundY + 2, S * 0.15, { rot: hit });
                this.bar(kx, g.groundY - S * 0.16, 36 * g.u, B.knight.hp / B.knight.max, '#9ff5d0');
            }
        }

        // enemies, far ones first
        const list = B.enemies.slice().sort((a, b) => a.y - b.y);
        for (const e of list) this.drawEnemy(e, g, time);

        // the Queen
        if (B.queen) {
            const qx = this.fx2s(B.queen.x);
            const walking = B.queen.state === 'walk';
            this.img('spr/queen', qx, g.groundY - (walking ? Math.abs(Math.sin(time * 7)) * 5 : 0), S * 0.2);
            if (!walking && Math.random() < 0.3) this.fx.push({ kind: 'heart', x: qx + 20, y: g.groundY - S * 0.22, vx: (Math.random() - 0.5) * 60, vy: -60, life: 1.6, max: 1.6 });
        }

        // shots
        for (const s of B.shots) this.drawShot(s, g, B);
        // web over the field
        this.web = B.webT > 0 ? Math.min(1, this.web + dt * 3) : Math.max(0, this.web - dt * 2);
        if (this.web > 0) this.drawWeb(g);
        // rings
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.life -= dt;
            if (r.life <= 0) { this.rings.splice(i, 1); continue; }
            r.r = lerp(r.r, r.max, 0.25);
            c.save(); c.globalAlpha = clamp(r.life * 3, 0, 1); c.strokeStyle = r.color; c.lineWidth = 3;
            c.beginPath(); c.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, Math.PI * 2); c.stroke(); c.restore();
        }
        // the reticle
        if (!B.queen && !B.result) {
            const ax = this.fx2s(B.aim), ar = (DOILY.radius / FIELD.w) * (g.right - g.wallFace);
            c.save(); c.strokeStyle = 'rgba(255, 245, 255, 0.85)'; c.lineWidth = 2; c.setLineDash([5, 5]);
            c.lineDashOffset = -time * 20;
            c.beginPath(); c.ellipse(ax, g.groundY - this.h * 0.035, ar, ar * 0.32, 0, 0, Math.PI * 2); c.stroke();
            c.restore();
        }
        // "here they come"
        if (B.t < 0) {
            c.save(); c.textAlign = 'center'; c.font = `${Math.round(40 * g.u + 10)}px Creepster, Fredoka, sans-serif`;
            c.fillStyle = '#ffb3dc'; c.strokeStyle = '#2a0b22'; c.lineWidth = 6;
            const txt = B.epi ? B.name : `Here they come: ${B.name}`;
            c.strokeText(txt, this.w / 2, this.h * 0.4); c.fillText(txt, this.w / 2, this.h * 0.4); c.restore();
        }
    }

    drawEnemy(e, g, time) {
        const def = ENEMIES[e.kind];
        const key = 'en/' + (def.sprite || e.kind);
        const depth = 0.82 + 0.18 * e.y;
        let h = (def.boss ? this.S * 0.44 : this.S * 0.13 * def.size) * depth;
        const x = this.fx2s(e.x);
        let y = this.eY(e, g);
        if (def.fly) y -= this.S * 0.18 + Math.sin(time * 4 + e.id) * 8;
        if (e.nap > 0 || (e.hp <= 0)) {
            const a = clamp(e.nap / 0.6, 0, 1);
            this.img(key, x, y, h * 0.9, { rot: -1.4, alpha: a, anchor: 'centre', tint: 'saturate(0.35) brightness(1.15)' });
            return;
        }
        if (e.sit) { this.img(key, x, y, h * 0.85, { sy: 0.85, sx: 1.08 }); return; }
        const walk = !e.block && e.x > FIELD.reach;
        const bob = walk ? Math.abs(Math.sin(time * (def.spd + 4) + e.id)) * 4 * g.u : 0;
        const lean = walk ? Math.sin(time * (def.spd + 4) + e.id) * 0.06 : Math.sin(time * 10 + e.id) * 0.12;
        this.img(key, x, y - bob, h, { rot: lean });
        if (e.hp < e.max && !def.boss) this.bar(x, y - h - 6, 30 * g.u * def.size, e.hp / e.max, '#ff7aa8');
        if (def.boss) this.bar(x, y - h - 10, 120 * g.u, (e.hp - e.max * 0.5) / (e.max * 0.5), '#ffd36b');
    }

    drawShot(s, g, B) {
        const c = this.ctx;
        const f = clamp(s.t / s.dur, 0, 1);
        let tx = this.fx2s(s.tx), ty = g.groundY - this.h * 0.04;
        const tgt = s.target != null ? B.enemies.find((e) => e.id === s.target) : null;
        if (tgt) { tx = this.fx2s(tgt.x); ty = this.eY(tgt, g) - this.h * (ENEMIES[tgt.kind].fly ? 0.2 : 0.05); }
        const sx = s.kind === 'doily' ? this.handX : s.kind === 'bolt' ? g.wallFace - 30 : g.wallFace - 20;
        const sy = s.kind === 'doily' ? this.handY : g.groundY - this.h * 0.36;
        const x = lerp(sx, tx, f), y = lerp(sy, ty, f) - Math.sin(f * Math.PI) * this.h * (s.kind === 'doily' || s.kind === 'potion' || s.kind === 'bun' ? 0.12 : 0.03);
        c.save();
        c.translate(x, y);
        if (s.kind === 'doily') {
            c.rotate(this.time * 14);
            const r = 9 * g.u + 3;
            c.fillStyle = '#fffaf4'; c.strokeStyle = '#d9c8e8'; c.lineWidth = 1;
            c.beginPath();
            for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2, rr = r * (i % 2 ? 0.8 : 1); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
            c.fill(); c.stroke();
            c.fillStyle = '#ff9fd2'; c.beginPath(); c.arc(0, 0, r * 0.3, 0, Math.PI * 2); c.fill();
        } else if (s.kind === 'potion') {
            c.rotate(this.time * 8); c.fillStyle = '#6cff9a'; c.beginPath(); c.arc(0, 0, 6 * g.u + 2, 0, Math.PI * 2); c.fill();
        } else if (s.kind === 'bun') {
            c.fillStyle = '#c98a4b'; c.beginPath(); c.arc(0, 0, 7 * g.u + 3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.fillRect(-4, -1, 8, 2);
        } else {
            const ang = Math.atan2(ty - sy, tx - sx);
            c.rotate(ang); c.strokeStyle = s.kind === 'bolt' ? '#ff6f9a' : '#f3e2c0'; c.lineWidth = 3;
            c.beginPath(); c.moveTo(-12, 0); c.lineTo(6, 0); c.stroke();
        }
        c.restore();
    }

    drawWeb(g) {
        const c = this.ctx;
        c.save(); c.globalAlpha = this.web * 0.35; c.strokeStyle = '#f0f0ff'; c.lineWidth = 1.5;
        const cx = (g.wallFace + g.right) / 2, cy = g.groundY - this.h * 0.18;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * this.w, cy + Math.sin(a) * this.h * 0.6); c.stroke(); }
        for (let r = 40; r < this.w; r += 60) { c.beginPath(); c.ellipse(cx, cy, r, r * 0.45, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
    }

    bar(x, y, w, f, color) {
        const c = this.ctx;
        c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
        c.fillStyle = color; c.fillRect(x - w / 2, y, w * clamp(f, 0, 1), 4);
    }

    drawFx(dt) {
        const c = this.ctx;
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const p = this.fx[i];
            p.life -= dt;
            if (p.life <= 0) { this.fx.splice(i, 1); continue; }
            p.x += p.vx * dt; p.y += p.vy * dt;
            const a = clamp(p.life / (p.max || 1), 0, 1);
            if (p.kind === 'heart') {
                p.vy += 20 * dt;
                c.save(); c.globalAlpha = a; c.fillStyle = '#ff6fae'; c.font = '22px sans-serif'; c.fillText('♥', p.x, p.y); c.restore();
            } else if (p.kind === 'z') {
                c.save(); c.globalAlpha = a; c.fillStyle = '#d8d0ff'; c.font = 'bold 18px Fredoka, sans-serif'; c.fillText('z', p.x, p.y); c.restore();
            } else {
                p.vy += (p.kind === 'spark' ? 60 : 420) * dt;
                c.globalAlpha = a; c.fillStyle = p.c;
                const s = p.kind === 'dust' ? 5 : 3;
                c.fillRect(p.x, p.y, s, s);
                c.globalAlpha = 1;
            }
        }
    }
}
