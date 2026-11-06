// The Canvas 2D view: reads G every frame and answers sim events with effects. Never changes G.
//
// Layers, back to front: the carriage wall and lamp, the window frame, the scene outside (with
// rain falling past it), the mist (a blurred, frosted copy of the scene masked by the sim's mist
// grid), the little beads a wiping drop leaves behind, the rain beads and the drop (each one a
// tiny upside-down lens of the scene, as real drops are), the sill with its mug and postcards,
// and film grain over everything.

import { FIELD, FOG } from '../config.js';
import { STATIONS } from '../sim/scenes.js';
import { wipeRadius, beadRadius } from '../sim/game.js';
import { paintScene, SW, SH, U } from './painter.js';

const HAND = "'Caveat', 'Segoe Print', 'Bradley Hand', cursive";
const TOP = 58;                          // room for the HUD and the back link

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export class View {
    constructor(el) {
        this.canvas = el;
        this.ctx = el.getContext('2d');
        this.mask = canvas(FOG.gw, FOG.gh);
        this.mctx = this.mask.getContext('2d');
        this.maskData = this.mctx.createImageData(FOG.gw, FOG.gh);
        for (let i = 0; i < this.maskData.data.length; i += 4) { this.maskData.data[i] = 255; this.maskData.data[i + 1] = 255; this.maskData.data[i + 2] = 255; }
        this.fogBase = canvas(SW, SH);
        this.fogComp = canvas(SW, SH);
        this.trail = canvas(SW * 2, SH * 2);
        this.tctx = this.trail.getContext('2d');
        this.condense = makeCondensation();
        this.grain = makeGrain();
        this.sceneKey = '';
        this.fogVer = -1;
        this.labels = [];
        this.ripples = [];
        this.lastDrop = null;
        this.flowGlow = 0;
        this.reveal = 0;
        this.rain = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
        this.grainOn = true;
        this.reduced = !!window.A11Y?.reducedMotion;
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
        // CSS size in px, never 100vw/100vh; backing store at device pixels.
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        // the pane (4:3), its frame and the sill under it
        const portrait = h > w;
        const bottom = portrait ? 110 : 14;
        const availH = h - TOP - bottom, availW = w - 24;
        const ph = Math.max(60, Math.min(availH / 1.24, availW / (4 / 3 + 0.1)));
        const pw = ph * 4 / 3;
        const f = ph * 0.05, sill = ph * 0.15;
        const block = ph + f + sill;
        const px = (w - pw) / 2;
        const py = TOP + f + Math.max(0, (availH - block) * (portrait ? 0.35 : 0.5));
        this.pane = { x: px, y: py, w: pw, h: ph, f, sill, s: pw / FIELD.w };
        this.vignette = null;
    }

    /** Screen (client) px → world units, through the canvas's own rect. */
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const p = this.pane;
        return { x: (clientX - r.left - p.x) / p.s, y: (clientY - r.top - p.y) / p.s };
    }
    toScreen(x, y) { const p = this.pane; return { x: p.x + x * p.s, y: p.y + y * p.s }; }

    // ------------------------------------------------------------------ per pane
    setScene(G) {
        const key = `${G.station}:${G.late}:${G.paneSeed}`;
        if (key === this.sceneKey) return;
        this.sceneKey = key;
        this.scene = paintScene(G.station, G.late, (G.paneSeed % 97) + 1);
        this.theme = STATIONS[G.station].theme;
        // the mist: the scene blurred (down to a few pixels and back up), frosted, with condensation
        const tiny = canvas(40, 30);
        const t = tiny.getContext('2d');
        t.imageSmoothingEnabled = true;
        t.drawImage(this.scene, 0, 0, 40, 30);
        const b = this.fogBase.getContext('2d');
        b.imageSmoothingEnabled = true;
        b.clearRect(0, 0, SW, SH);
        b.drawImage(tiny, 0, 0, SW, SH);
        b.fillStyle = G.late ? 'rgba(150,160,196,0.5)' : 'rgba(206,214,232,0.52)';
        b.fillRect(0, 0, SW, SH);
        b.drawImage(this.condense, 0, 0);
        this.tctx.clearRect(0, 0, this.trail.width, this.trail.height);
        this.fogVer = -1;
        this.labels = [];
        this.ripples = [];
        this.lastDrop = null;
        this.reveal = 0;
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'spot') {
                this.labels.push({ text: e.name, x: e.x, y: e.y, t: 0, self: e.self, fresh: e.fresh, rare: e.rare });
                this.ripples.push({ x: e.x, y: e.y, t: 0, r: 1.2, col: e.rare ? '255,220,140' : '255,255,255' });
            } else if (e.type === 'merge') this.ripples.push({ x: e.x, y: e.y, t: 0, r: 0.35, col: '255,255,255' });
            else if (e.type === 'tap') this.ripples.push({ x: e.x, y: e.y, t: 0, r: 2.4, col: '220,235,255' });
            else if (e.type === 'drop') this.lastDrop = null;
            else if (e.type === 'pane') this.sceneKey = '';
        }
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.resize();
        this.setScene(G);
        const { ctx, pane: p } = this;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.flowGlow += ((G.phase === 'play' ? G.flowLevel : 3) - this.flowGlow) * Math.min(1, dt * 1.5);
        if (G.phase !== 'play') this.reveal = Math.min(1, this.reveal + dt * 0.6);

        this.drawWall(time);
        this.drawFrame();

        ctx.save();
        ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.scene, p.x, p.y, p.w, p.h);
        this.drawWeather(dt, time);
        if (G.phase !== 'done' || G.fogSum > 0) this.drawMist(G);
        this.trailFrom(G);
        ctx.globalAlpha = G.phase === 'play' ? 1 : Math.max(0, 1 - this.reveal * 1.5);
        ctx.drawImage(this.trail, p.x, p.y, p.w, p.h);
        ctx.globalAlpha = 1;
        for (const b of G.beads) this.droplet(b.x, b.y, beadRadius(b.m), 0, 0, b.roll ? Math.sin(time * 40) * 0.6 : 0, Math.min(1, b.age * 4));
        const d = G.drop;
        if (d.alive) {
            const r = 0.13 + 0.12 * Math.sqrt(Math.max(0.2, d.m));
            this.droplet(d.x, d.y, r * Math.min(1, 0.4 + d.age * 3), d.vx, d.vy, 0, 1, true);
        }
        this.drawRipples(dt);
        this.drawGlass();
        ctx.restore();

        this.drawLabels(dt);
        this.drawSill(G, time);
        this.drawGrain(time);
    }

    drawWall(time) {
        const { ctx, w, h } = this;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#2b2030'); g.addColorStop(1, '#16101a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // panelling
        ctx.fillStyle = 'rgba(255,220,180,0.035)';
        for (let x = (w / 2) % 46; x < w; x += 46) ctx.fillRect(x, 0, 1.5, h);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, h * 0.82, w, 2);
        // the reading lamp, warmer as the flow builds
        const k = 0.16 + this.flowGlow * 0.06 + (this.reduced ? 0 : Math.sin(time * 0.7) * 0.01);
        const lg = ctx.createRadialGradient(w * 0.08, -20, 10, w * 0.08, -20, Math.max(w, h) * 0.8);
        lg.addColorStop(0, `rgba(255,180,110,${k * 2})`); lg.addColorStop(0.5, `rgba(255,150,90,${k * 0.6})`); lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, w, h);
    }

    drawFrame() {
        const { ctx, pane: p } = this;
        // light from outside spills onto the wall
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        const sg = ctx.createRadialGradient(cx, cy, p.h * 0.4, cx, cy, p.w * 0.95);
        sg.addColorStop(0, 'rgba(170,190,230,0.10)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, this.w, this.h);
        const f = p.f;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(ctx, p.x - f + 4, p.y - f + 6, p.w + f * 2, p.h + f * 2, f * 0.8); ctx.fill();
        const wg = ctx.createLinearGradient(0, p.y - f, 0, p.y + p.h + f);
        wg.addColorStop(0, '#6a4630'); wg.addColorStop(1, '#4a3022');
        ctx.fillStyle = wg;
        roundRect(ctx, p.x - f, p.y - f, p.w + f * 2, p.h + f * 2, f * 0.8); ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,180,0.18)'; ctx.lineWidth = 1;
        roundRect(ctx, p.x - f + 1.5, p.y - f + 1.5, p.w + f * 2 - 3, p.h + f * 2 - 3, f * 0.7); ctx.stroke();
        ctx.fillStyle = '#2a1a12';
        ctx.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
    }

    drawWeather(dt, time) {
        const { ctx, pane: p } = this;
        const snow = this.theme === 'snow';
        ctx.strokeStyle = 'rgba(210,220,255,0.16)';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        for (const r of this.rain) {
            if (!this.reduced) {
                r.y += dt * (snow ? 0.06 : 0.9) * r.s;
                r.x += dt * (snow ? Math.sin(time + r.s * 9) * 0.01 : -0.06) * r.s;
                if (r.y > 1) { r.y -= 1; r.x = Math.random(); }
                if (r.x < 0) r.x += 1;
            }
            const x = p.x + r.x * p.w, y = p.y + r.y * p.h;
            if (snow) { ctx.beginPath(); ctx.arc(x, y, 1.2 * r.s, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.h * 0.004, y + p.h * 0.05 * r.s); ctx.stroke(); }
        }
    }

    drawMist(G) {
        if (this.fogVer !== G.fogVer) {
            this.fogVer = G.fogVer;
            const d = this.maskData.data, fog = G.fog;
            for (let i = 0; i < fog.length; i++) d[i * 4 + 3] = fog[i];
            this.mctx.putImageData(this.maskData, 0, 0);
            const c = this.fogComp.getContext('2d');
            c.globalCompositeOperation = 'source-over';
            c.clearRect(0, 0, SW, SH);
            c.drawImage(this.fogBase, 0, 0);
            c.globalCompositeOperation = 'destination-in';
            c.imageSmoothingEnabled = true;
            c.drawImage(this.mask, 0, 0, SW, SH);
            c.globalCompositeOperation = 'source-over';
        }
        const p = this.pane;
        this.ctx.drawImage(this.fogComp, p.x, p.y, p.w, p.h);
    }

    /** As the drop moves it leaves a scatter of tiny beads behind it on the cleared glass. */
    trailFrom(G) {
        const d = G.drop;
        if (!d.alive || G.phase !== 'play') { this.lastDrop = null; return; }
        if (!this.lastDrop) { this.lastDrop = { x: d.x, y: d.y }; return; }
        const dist = Math.hypot(d.x - this.lastDrop.x, d.y - this.lastDrop.y);
        if (dist < 0.08) return;
        this.lastDrop = { x: d.x, y: d.y };
        const R = wipeRadius(d.m), t = this.tctx, k = U * 2;
        const n = Math.random() < 0.6 ? 1 : 2;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * R * 0.85;
            const x = (d.x + Math.cos(a) * rr) * k, y = (d.y + Math.sin(a) * rr) * k, r = 0.8 + Math.random() * 2.2;
            t.fillStyle = 'rgba(10,14,24,0.35)';
            t.beginPath(); t.arc(x, y + r * 0.25, r, 0, Math.PI * 2); t.fill();
            t.fillStyle = 'rgba(235,245,255,0.55)';
            t.beginPath(); t.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2); t.fill();
        }
    }

    /**
     * One drop of water on the glass: a small, upside-down lens of the scene behind it, with a dark
     * rim, a bright catchlight and a little caustic below. vx, vy stretch it as it runs.
     */
    droplet(x, y, r, vx, vy, jiggle, grow, main = false) {
        const { ctx, pane: p } = this;
        const sx = p.x + (x + jiggle * 0.03) * p.s, sy = p.y + y * p.s, rs = Math.max(1.5, r * p.s * grow);
        const sp = Math.hypot(vx, vy);
        const st = Math.min(0.45, sp * 0.12);
        if (main) {
            const h = ctx.createRadialGradient(sx, sy, rs * 0.8, sx, sy, rs * 2.4);
            h.addColorStop(0, 'rgba(255,240,215,0.28)'); h.addColorStop(1, 'rgba(255,240,215,0)');
            ctx.fillStyle = h;
            ctx.fillRect(sx - rs * 2.4, sy - rs * 2.4, rs * 4.8, rs * 4.8);
        }
        ctx.save();
        ctx.translate(sx, sy);
        if (st > 0.02) { ctx.rotate(Math.atan2(vy, vx)); ctx.scale(1 + st, 1 - st * 0.45); }
        ctx.beginPath(); ctx.arc(0, 0, rs, 0, Math.PI * 2);
        ctx.save();
        ctx.clip();
        // the lens: what is behind the drop, flipped and squeezed
        const span = r * U * 3.2;
        ctx.scale(1, -1);
        ctx.drawImage(this.scene, x * U - span, y * U - span, span * 2, span * 2, -rs * 1.05, -rs * 1.05, rs * 2.1, rs * 2.1);
        ctx.restore();
        const g = ctx.createRadialGradient(-rs * 0.2, -rs * 0.25, rs * 0.1, 0, 0, rs);
        g.addColorStop(0, 'rgba(255,255,255,0.10)');
        g.addColorStop(0.7, 'rgba(20,30,50,0.05)');
        g.addColorStop(1, 'rgba(10,15,30,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, rs, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.ellipse(-rs * 0.35, -rs * 0.4, rs * 0.26, rs * 0.17, -0.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(0.8, rs * 0.08);
        ctx.beginPath(); ctx.arc(0, 0, rs * 0.78, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
        if (main) {
            ctx.strokeStyle = 'rgba(255,248,230,0.75)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(0, 0, rs + 1, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.beginPath(); ctx.arc(rs * 0.3, rs * 0.45, rs * 0.09, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    drawRipples(dt) {
        const { ctx, pane: p } = this;
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.t += dt;
            const k = r.t / 0.9;
            if (k >= 1) { this.ripples.splice(i, 1); continue; }
            ctx.strokeStyle = `rgba(${r.col},${0.5 * (1 - k)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(p.x + r.x * p.s, p.y + r.y * p.s, r.r * p.s * (0.3 + k * 0.7), 0, Math.PI * 2); ctx.stroke();
        }
    }

    drawGlass() {
        const { ctx, pane: p } = this;
        // depth: the pane is set into the frame
        const e = p.h * 0.05;
        for (const [x0, y0, x1, y1, x, y, w, h] of [
            [p.x, 0, p.x + e, 0, p.x, p.y, e, p.h], [p.x + p.w, 0, p.x + p.w - e, 0, p.x + p.w - e, p.y, e, p.h],
            [0, p.y, 0, p.y + e, p.x, p.y, p.w, e],
        ]) {
            const g = ctx.createLinearGradient(x0, y0, x1, y1);
            g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, w, h);
        }
        // a faint sheen across the glass
        const sg = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
        sg.addColorStop(0.18, 'rgba(255,255,255,0)'); sg.addColorStop(0.24, 'rgba(255,255,255,0.05)'); sg.addColorStop(0.32, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    drawLabels(dt) {
        const { ctx, pane: p } = this;
        const fs = Math.max(15, Math.min(26, p.h * 0.05));
        ctx.font = `600 ${fs}px ${HAND}`;
        ctx.textAlign = 'center';
        for (let i = this.labels.length - 1; i >= 0; i--) {
            const L = this.labels[i];
            L.t += dt;
            const life = 4.2;
            if (L.t > life) { this.labels.splice(i, 1); continue; }
            const a = Math.min(1, L.t * 3) * Math.min(1, (life - L.t) * 1.5);
            const sx = Math.max(p.x + 60, Math.min(p.x + p.w - 60, p.x + L.x * p.s));
            const sy = Math.max(p.y + fs, p.y + L.y * p.s - fs * 1.4 - L.t * 6);
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(20,14,24,0.55)';
            const tw = ctx.measureText(L.text).width;
            roundRect(ctx, sx - tw / 2 - 10, sy - fs * 0.9, tw + 20, fs * 1.3, fs * 0.6); ctx.fill();
            ctx.fillStyle = L.rare ? '#ffe2a0' : '#fff6e8';
            ctx.fillText(L.text, sx, sy);
            ctx.globalAlpha = 1;
        }
    }

    drawSill(G, time) {
        const { ctx, pane: p } = this;
        const f = p.f, y = p.y + p.h + 2, sh = p.sill;
        // ledge top
        const tg = ctx.createLinearGradient(0, y, 0, y + sh * 0.45);
        tg.addColorStop(0, '#8a5e40'); tg.addColorStop(1, '#6a462e');
        ctx.fillStyle = tg;
        ctx.beginPath(); ctx.moveTo(p.x - f, y); ctx.lineTo(p.x + p.w + f, y); ctx.lineTo(p.x + p.w + f * 2.2, y + sh * 0.45); ctx.lineTo(p.x - f * 2.2, y + sh * 0.45); ctx.closePath(); ctx.fill();
        // front edge
        ctx.fillStyle = '#4a2e1e';
        ctx.fillRect(p.x - f * 2.2, y + sh * 0.45, p.w + f * 4.4, sh * 0.22);
        ctx.fillStyle = 'rgba(255,220,180,0.25)';
        ctx.fillRect(p.x - f * 2.2, y + sh * 0.45, p.w + f * 4.4, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(p.x - f * 2.2, y + sh * 0.67, p.w + f * 4.4, sh * 0.12);
        const base = y + sh * 0.36, s = sh / 60;
        // a mug of tea, steaming
        const mx = p.x + p.w * 0.12;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(mx, base + 3 * s, 16 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8c8b0';
        ctx.fillRect(mx - 13 * s, base - 30 * s, 26 * s, 30 * s);
        ctx.beginPath(); ctx.ellipse(mx, base, 13 * s, 4 * s, 0, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = '#d8c8b0'; ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.arc(mx + 15 * s, base - 16 * s, 7 * s, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        ctx.fillStyle = '#5a3a28'; ctx.beginPath(); ctx.ellipse(mx, base - 30 * s, 12 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b05a4a'; ctx.fillRect(mx - 13 * s, base - 20 * s, 26 * s, 5 * s);
        for (let i = 0; i < 3; i++) {
            const ph = (time * 0.35 + i / 3) % 1;
            const sx = mx + Math.sin(time * 1.2 + i * 2) * 4 * s, sy = base - 34 * s - ph * 40 * s;
            ctx.strokeStyle = `rgba(240,240,250,${0.22 * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 3 * s;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 6 * s, sy - 8 * s, sx, sy - 16 * s); ctx.stroke();
        }
        // the postcards so far, in a little stack
        const n = Math.min(12, G.panes);
        const cx = p.x + p.w * 0.5;
        for (let i = 0; i < n; i++) {
            ctx.save();
            ctx.translate(cx + Math.sin(i * 2.3) * 3 * s, base - i * 1.8 * s);
            ctx.rotate(Math.sin(i * 1.7) * 0.08);
            ctx.fillStyle = i % 2 ? '#f0e6d2' : '#e8dcc4';
            ctx.fillRect(-22 * s, -4 * s, 44 * s, 4 * s);
            ctx.restore();
        }
        // a small plant
        const px = p.x + p.w * 0.86;
        ctx.fillStyle = '#b0644a';
        ctx.beginPath(); ctx.moveTo(px - 11 * s, base - 18 * s); ctx.lineTo(px + 11 * s, base - 18 * s); ctx.lineTo(px + 8 * s, base); ctx.lineTo(px - 8 * s, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a8a5a';
        for (let i = 0; i < 6; i++) {
            const a = -Math.PI / 2 + (i - 2.5) * 0.4 + (this.reduced ? 0 : Math.sin(time * 0.8 + i) * 0.03);
            ctx.save(); ctx.translate(px, base - 18 * s); ctx.rotate(a);
            ctx.beginPath(); ctx.ellipse(12 * s, 0, 12 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }

    drawGrain(time) {
        const { ctx, w, h } = this;
        if (!this.vignette) {
            const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
            this.vignette = g;
        }
        ctx.fillStyle = this.vignette;
        ctx.fillRect(0, 0, w, h);
        if (!this.grainOn) return;
        const ox = this.reduced ? 0 : Math.floor(Math.random() * 64), oy = this.reduced ? 0 : Math.floor(Math.random() * 64);
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.translate(-ox, -oy);
        ctx.fillStyle = ctx.createPattern(this.grain, 'repeat');
        ctx.fillRect(0, 0, w + 64, h + 64);
        ctx.restore();
    }

    /** A fully revealed scene for a postcard or the album. */
    sceneFor(station, late) { return paintScene(station, late, 1); }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Thousands of tiny condensation beads, baked once. */
function makeCondensation() {
    const c = canvas(SW, SH), t = c.getContext('2d');
    for (let i = 0; i < 2600; i++) {
        const x = Math.random() * SW, y = Math.random() * SH, r = 0.3 + Math.random() ** 3 * 1.6;
        t.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.2})`;
        t.beginPath(); t.arc(x, y, r, 0, Math.PI * 2); t.fill();
        if (r > 0.9) { t.fillStyle = 'rgba(40,50,70,0.12)'; t.beginPath(); t.arc(x, y + r * 0.4, r * 0.8, 0, Math.PI); t.fill(); }
    }
    return c;
}

function makeGrain() {
    const c = canvas(128, 128), t = c.getContext('2d');
    const img = t.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
    }
    t.putImageData(img, 0, 0);
    return c;
}

