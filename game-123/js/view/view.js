// The Canvas 2D view: reads G every frame and turns sim events into effects. Never changes G.
// It draws only what the cartographer has charted: the player's own sheet (G.ink), the features they have
// found, the quill and the client's journey. It never reads the true terrain.
//
// Two baked layers at device resolution: the parchment, and the ink (redrawn only when a spell lands).

import { WORLD, T, SCRY } from '../config.js';
import { hash3 } from '../rng.js';
import { current, scryRadius } from '../sim/game.js';

const W = WORLD.w, H = WORLD.h;
const TOP = 56, BOTTOM = 8, MIN_SCALE = 12, MAX_S = 28;
const INK = '#3a2412';
const PARCH = [238, 224, 184];

// watercolour washes, by terrain code
const COL = [
    null, [74, 108, 146], [104, 148, 182], [160, 200, 204], [236, 218, 164], [200, 212, 128], [120, 160, 96],
    [190, 160, 108], [150, 138, 128], [128, 144, 104], [236, 204, 132], [92, 150, 204], [96, 152, 200],
];
const isSea = (t) => t === T.DEEP || t === T.SEA || t === T.SHOAL;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sheet = document.createElement('canvas');
        this.inkCv = document.createElement('canvas');
        this.inkKey = '';
        this.lastG = null;
        this.cx = W / 2; this.cy = H / 2;
        this.snapCam = true;
        this.ripples = [];
        this.popups = [];
        this.routeT = 0;
        this.w = 0; this.h = 0; this.dpr = 0; this.S = 0;
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
        const fit = Math.min((w - 12) / W, (h - TOP - BOTTOM) / H);
        this.scale = Math.max(fit, clamp(w / 28, MIN_SCALE, 16));   // on a phone the sheet is bigger than the screen and the camera follows the quill
        this.viewH = h - TOP - BOTTOM;
        const S = Math.min(this.scale * dpr, MAX_S);
        if (Math.abs(S - this.S) > 0.01) { this.S = S; this.bakeSheet(); this.inkKey = ''; }
        this.snapCam = true;
    }

    snap() { this.snapCam = true; this.ripples = []; this.popups = []; }

    // ------------------------------------------------------------------ baked layers
    bakeSheet() {
        const S = this.S, pw = Math.round(W * S), ph = Math.round(H * S);
        const cv = this.sheet; cv.width = pw; cv.height = ph;
        const c = cv.getContext('2d');
        const g = c.createRadialGradient(pw / 2, ph / 2, ph * 0.2, pw / 2, ph / 2, pw * 0.7);
        g.addColorStop(0, 'rgb(244,232,194)'); g.addColorStop(1, 'rgb(214,192,146)');
        c.fillStyle = g; c.fillRect(0, 0, pw, ph);
        // soft blotches, like paper that has been rained on and dried
        for (let n = 0; n < 420; n++) {
            const a = hash3(n, 1, 91), b = hash3(n, 2, 91), r = (1 + hash3(n, 3, 91) * 3.5) * S, x = a * pw, y = b * ph;
            const bl = c.createRadialGradient(x, y, 0, x, y, r);
            const warm = hash3(n, 4, 91) < 0.6;
            bl.addColorStop(0, warm ? 'rgba(150,115,60,0.075)' : 'rgba(255,250,232,0.1)'); bl.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = bl; c.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // a faint graticule
        c.strokeStyle = 'rgba(110,80,40,0.13)'; c.lineWidth = Math.max(1, S * 0.05); c.setLineDash([S * 0.3, S * 0.35]);
        for (let x = 6; x < W; x += 6) { c.beginPath(); c.moveTo(x * S, 0); c.lineTo(x * S, ph); c.stroke(); }
        for (let y = 6; y < H; y += 6) { c.beginPath(); c.moveTo(0, y * S); c.lineTo(pw, y * S); c.stroke(); }
        c.setLineDash([]);
        const v = c.createRadialGradient(pw / 2, ph / 2, ph * 0.5, pw / 2, ph / 2, pw * 0.62);
        v.addColorStop(0, 'rgba(90,60,20,0)'); v.addColorStop(1, 'rgba(90,60,20,0.38)');
        c.fillStyle = v; c.fillRect(0, 0, pw, ph);
        this.inkCv.width = pw; this.inkCv.height = ph;
    }

    redrawInk(G) {
        const S = this.S, c = this.inkCv.getContext('2d');
        c.clearRect(0, 0, this.inkCv.width, this.inkCv.height);
        const { ink, conf } = G;
        const lw = Math.max(1, S * 0.07);
        // 1. washes
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x, t = ink[i];
            if (!t) continue;
            const col = COL[t], k = 0.93 + hash3(x, y, 5) * 0.14;
            c.fillStyle = `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`;
            c.fillRect(x * S - 0.5, y * S - 0.5, S + 1, S + 1);
            const sure = clamp((conf[i] - 1) / 100, 0, 1);
            if (sure < 0.95) {                                 // a rushed cast is pale and smudged
                c.fillStyle = `rgba(${PARCH[0]},${PARCH[1]},${PARCH[2]},${(1 - sure) * 0.62})`;
                c.fillRect(x * S - 0.5, y * S - 0.5, S + 1, S + 1);
            }
        }
        // 2. symbols
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x, t = ink[i];
            if (!t) continue;
            const sure = clamp((conf[i] - 1) / 100, 0.25, 1);
            const px = x * S, py = y * S, a = hash3(x, y, 17), b = hash3(x, y, 29);
            c.globalAlpha = 0.85 * sure;
            c.strokeStyle = INK; c.lineWidth = lw;
            if (t === T.MOUNTAIN) {
                c.beginPath();
                c.moveTo(px + S * 0.08, py + S * 0.88); c.lineTo(px + S * (0.4 + a * 0.2), py + S * 0.12); c.lineTo(px + S * 0.92, py + S * 0.88);
                c.moveTo(px + S * (0.4 + a * 0.2), py + S * 0.12); c.lineTo(px + S * (0.5 + a * 0.15), py + S * 0.88);
                c.stroke();
            } else if (t === T.HILLS) {
                if (a < 0.75) { c.beginPath(); c.arc(px + S * (0.3 + b * 0.4), py + S * 0.75, S * 0.3, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
            } else if (t === T.FOREST) {
                c.fillStyle = 'rgba(40,86,44,0.95)';
                for (let k = 0; k < 2; k++) {
                    if ((k ? b : a) < 0.3) continue;
                    const tx = px + S * (0.28 + k * 0.42 + (k ? a : b) * 0.1), ty = py + S * (0.35 + k * 0.28);
                    c.beginPath(); c.arc(tx, ty, S * 0.2, 0, Math.PI * 2); c.fill();
                    c.beginPath(); c.moveTo(tx, ty + S * 0.18); c.lineTo(tx, ty + S * 0.34); c.stroke();
                }
            } else if (t === T.SWAMP) {
                c.strokeStyle = 'rgba(40,70,50,0.9)';
                c.beginPath(); c.moveTo(px + S * 0.2, py + S * 0.6); c.lineTo(px + S * 0.5, py + S * 0.6); c.moveTo(px + S * 0.55, py + S * 0.8); c.lineTo(px + S * 0.85, py + S * 0.8);
                c.moveTo(px + S * 0.35, py + S * 0.6); c.lineTo(px + S * 0.33, py + S * 0.3); c.moveTo(px + S * 0.7, py + S * 0.8); c.lineTo(px + S * 0.72, py + S * 0.5);
                c.stroke();
            } else if (t === T.DESERT) {
                c.fillStyle = INK;
                for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(px + S * hash3(x, y, 40 + k), py + S * hash3(x, y, 50 + k), S * 0.04, 0, Math.PI * 2); c.fill(); }
            } else if (t === T.SEA || t === T.DEEP) {
                if (a < (t === T.DEEP ? 0.1 : 0.14)) {
                    c.strokeStyle = t === T.DEEP ? 'rgba(220,235,250,0.5)' : 'rgba(40,70,110,0.55)';
                    c.beginPath(); c.moveTo(px + S * 0.2, py + S * 0.55); c.quadraticCurveTo(px + S * 0.38, py + S * 0.3, px + S * 0.5, py + S * 0.55); c.quadraticCurveTo(px + S * 0.62, py + S * 0.8, px + S * 0.8, py + S * 0.55);
                    c.stroke();
                }
            } else if (t === T.SHOAL) {
                c.fillStyle = 'rgba(40,70,110,0.5)';
                if (a < 0.5) { c.beginPath(); c.arc(px + S * a, py + S * b, S * 0.04, 0, Math.PI * 2); c.fill(); }
            } else if (t === T.PLAINS) {
                if (a < 0.12) { c.strokeStyle = 'rgba(70,96,40,0.8)'; c.beginPath(); c.moveTo(px + S * 0.4, py + S * 0.7); c.lineTo(px + S * 0.4, py + S * 0.5); c.moveTo(px + S * 0.5, py + S * 0.7); c.lineTo(px + S * 0.55, py + S * 0.47); c.stroke(); }
            } else if (t === T.RIVER) {
                c.strokeStyle = 'rgba(30,76,130,0.8)'; c.lineWidth = lw * 1.4;
                c.beginPath(); c.moveTo(px + S * 0.15, py + S * 0.5); c.quadraticCurveTo(px + S * 0.5, py + S * (0.2 + a * 0.6), px + S * 0.85, py + S * 0.5); c.stroke();
            }
        }
        // 3. coastlines, drawn where sea meets land
        c.globalAlpha = 1; c.strokeStyle = INK; c.lineWidth = lw * 1.5;
        const edge = (x1, y1, x2, y2, x, y) => {
            const j = (n) => (hash3(x, y, n) - 0.5) * S * 0.18;
            c.beginPath(); c.moveTo(x1 * S + j(1), y1 * S + j(2)); c.lineTo(x2 * S + j(3), y2 * S + j(4)); c.stroke();
        };
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const t = ink[y * W + x];
            if (!t) continue;
            const r = x + 1 < W ? ink[y * W + x + 1] : 0, d = y + 1 < H ? ink[(y + 1) * W + x] : 0;
            if (r && (isSea(t) !== isSea(r))) { c.globalAlpha = 0.5 + 0.5 * clamp((Math.min(G.conf[y * W + x], G.conf[y * W + x + 1]) - 1) / 100, 0, 1); edge(x + 1, y, x + 1, y + 1, x, y); }
            if (d && (isSea(t) !== isSea(d))) { c.globalAlpha = 0.5 + 0.5 * clamp((Math.min(G.conf[y * W + x], G.conf[(y + 1) * W + x]) - 1) / 100, 0, 1); edge(x, y + 1, x + 1, y + 1, x, y); }
        }
        c.globalAlpha = 1;
    }

    // ------------------------------------------------------------------ icons
    icon(ctx, kind, x, y, s) {
        ctx.save();
        ctx.translate(x, y);
        ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = INK;
        const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); };
        if (kind === 'town') {
            poly([[-0.6, 0.35], [-0.6, -0.05], [-0.3, -0.35], [0, -0.05], [0, 0.35]], '#efe0b8');
            poly([[0, 0.35], [0, -0.2], [0.2, -0.5], [0.45, -0.2], [0.45, 0.35]], '#e6d2a0');
            poly([[-0.25, 0.35], [-0.25, 0.1], [-0.1, 0.1], [-0.1, 0.35]], '#8a5a30');
        } else if (kind === 'harbor') {
            ctx.beginPath(); ctx.arc(0, -0.42 * s, 0.12 * s, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -0.3 * s); ctx.lineTo(0, 0.42 * s); ctx.moveTo(-0.25 * s, -0.12 * s); ctx.lineTo(0.25 * s, -0.12 * s);
            ctx.moveTo(-0.42 * s, 0.1 * s); ctx.quadraticCurveTo(-0.38 * s, 0.45 * s, 0, 0.42 * s); ctx.quadraticCurveTo(0.38 * s, 0.45 * s, 0.42 * s, 0.1 * s); ctx.stroke();
        } else if (kind === 'farm') {
            poly([[-0.5, 0.4], [-0.5, -0.1], [0, -0.5], [0.5, -0.1], [0.5, 0.4]], '#b8643e');
            poly([[-0.14, 0.4], [-0.14, 0.05], [0.14, 0.05], [0.14, 0.4]], '#f0dcb0');
        } else if (kind === 'ruin') {
            poly([[-0.5, 0.4], [-0.5, -0.35], [-0.28, -0.35], [-0.28, 0.4]], '#d8c9a8');
            poly([[0.1, 0.4], [0.1, -0.05], [0.32, -0.15], [0.32, 0.4]], '#cdbd9a');
            ctx.fillStyle = INK;
            for (const [dx, dy] of [[-0.05, 0.38], [0.45, 0.38], [0.52, 0.3]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, 0.05 * s, 0, Math.PI * 2); ctx.fill(); }
        } else if (kind === 'ore') {
            poly([[0, -0.5], [0.4, -0.05], [0, 0.45], [-0.4, -0.05]], '#6f86d4');
            ctx.beginPath(); ctx.moveTo(-0.4 * s, -0.05 * s); ctx.lineTo(0.4 * s, -0.05 * s); ctx.moveTo(0, -0.5 * s); ctx.lineTo(-0.12 * s, -0.05 * s); ctx.lineTo(0, 0.45 * s); ctx.stroke();
        } else if (kind === 'shrine') {
            poly([[0, -0.55], [0.14, -0.14], [0.55, 0], [0.14, 0.14], [0, 0.55], [-0.14, 0.14], [-0.55, 0], [-0.14, -0.14]], '#f2cf5a');
        } else if (kind === 'reef') {
            poly([[-0.5, 0.35], [-0.32, -0.3], [-0.12, 0.2], [0.05, -0.45], [0.25, 0.2], [0.42, -0.2], [0.55, 0.35]], '#cf4a36');
        } else if (kind === 'lighthouse') {
            poly([[-0.2, 0.45], [-0.12, -0.25], [0.12, -0.25], [0.2, 0.45]], '#f2e8d0');
            poly([[-0.16, -0.25], [0, -0.55], [0.16, -0.25]], '#c8503a');
            ctx.beginPath(); ctx.moveTo(0.2 * s, -0.3 * s); ctx.lineTo(0.6 * s, -0.45 * s); ctx.moveTo(-0.2 * s, -0.3 * s); ctx.lineTo(-0.6 * s, -0.45 * s); ctx.stroke();
        }
        ctx.restore();
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        // a burst of events (a fast-forward, a slow frame) must not bury the map in labels
        if (events.length > 6) events = events.filter((e) => e.type !== 'scry' && e.type !== 'found').concat(events.filter((e) => e.type === 'scry' || e.type === 'found').slice(-3));
        for (const e of events) {
            if (e.type === 'scry') this.ripples.push({ x: e.x, y: e.y, r: e.r, focus: e.focus, t: 0 });
            else if (e.type === 'found') this.popups.push({ text: e.kind === 'reef' ? 'a reef!' : e.name, x: e.x + 0.5, y: e.y - 0.8, t: 0 });
            else if (e.type === 'result') this.routeT = 0;
            if (this.popups.length > 4) this.popups.shift();
            if (this.ripples.length > 6) this.ripples.shift();
            else if (e.type === 'commission') this.snapCam = true;
        }
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.resize();
        const { ctx, scale, dpr } = this;
        const key = `${G.seed}|${G.idx}|${G.casts}`;
        if (this.lastG !== G || key !== this.inkKey) {
            if (this.lastG !== G) this.snapCam = true;
            this.lastG = G; this.inkKey = key;
            this.redrawInk(G);
        }
        const c = current(G);
        const q = G.q;
        const res = G.phase === 'result' ? G.result : null;

        // camera: the whole sheet if it fits, else follow the quill (or the client's journey)
        let tx = q.x, ty = q.y;
        if (res?.path) {
            const head = res.path[Math.min(res.path.length - 1, Math.floor(this.progress(res) * (res.path.length - 1)))];
            tx = head[0] + 0.5; ty = head[1] + 0.5;
        }
        const halfW = this.w / 2 / scale, halfH = this.viewH / 2 / scale;
        const gx = W <= halfW * 2 ? W / 2 : clamp(tx, halfW, W - halfW);
        const gy = H <= halfH * 2 ? H / 2 : clamp(ty, halfH, H - halfH);
        const k = this.snapCam ? 1 : 1 - Math.exp(-dt * 5);
        this.cx += (gx - this.cx) * k; this.cy += (gy - this.cy) * k;
        this.snapCam = false;
        const ox = this.w / 2 - this.cx * scale, oy = TOP + this.viewH / 2 - this.cy * scale;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const bg = ctx.createRadialGradient(this.w / 2, this.h / 2, 40, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.8);
        bg.addColorStop(0, '#34251a'); bg.addColorStop(1, '#150e0a');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, this.w, this.h);

        ctx.save();
        ctx.translate(ox, oy);
        // sheet shadow, parchment, ink
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#d6c08e'; ctx.fillRect(0, 0, W * scale, H * scale);
        ctx.shadowColor = 'transparent';
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.sheet, 0, 0, W * scale, H * scale);
        ctx.drawImage(this.inkCv, 0, 0, W * scale, H * scale);

        this.drawRegion(ctx, G, c, scale, time);
        this.drawFeatures(ctx, G, scale);
        if (res?.path) this.drawJourney(ctx, G, res, c, scale, time);
        this.drawFx(ctx, dt, scale);
        if (G.phase === 'work') this.drawQuill(ctx, G, scale, time);

        // frame and compass
        ctx.strokeStyle = 'rgba(58,36,18,0.85)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W * scale - 2, H * scale - 2);
        ctx.lineWidth = 1; ctx.strokeRect(5, 5, W * scale - 10, H * scale - 10);
        this.compass(ctx, (W - 4.5) * scale, (H - 4.5) * scale, scale * 2.2);
        ctx.restore();
    }

    progress(res) { return clamp(this.routeT / (1.2 + res.path.length * 0.05), 0, 1); }

    drawRegion(ctx, G, c, s, time) {
        const r = c.region;
        ctx.save();
        ctx.fillStyle = 'rgba(176,74,42,0.07)'; ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
        ctx.strokeStyle = 'rgba(160,52,28,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([s * 0.7, s * 0.45]); ctx.lineDashOffset = -time * 8;
        ctx.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s);
        ctx.setLineDash([]);
        const fs = clamp(s * 1.05, 13, 20);
        ctx.font = `700 ${fs}px Caveat, 'Segoe Script', cursive`;
        this.label(ctx, c.start != null ? 'rumoured hereabouts' : c.client.name + '’s country', (r.x + 0.4) * s, (r.y - 0.35) * s, 'left');
        ctx.restore();
    }

    label(ctx, text, x, y, align = 'center') {
        ctx.textAlign = align; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(244,232,196,0.92)';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = INK; ctx.fillText(text, x, y);
    }

    drawFeatures(ctx, G, s) {
        const fs = clamp(s * 0.95, 12, 17), is = s * 1.45;
        ctx.save();
        ctx.font = `700 ${fs}px Caveat, 'Segoe Script', cursive`;
        for (const id of G.found) {
            const f = G.world.features[id];
            const x = (f.x + 0.5) * s, y = (f.y + 0.5) * s;
            ctx.fillStyle = 'rgba(244,232,196,0.7)';
            ctx.beginPath(); ctx.arc(x, y, is * 0.62, 0, Math.PI * 2); ctx.fill();
            this.icon(ctx, f.kind, x, y, is);
            if (f.kind !== 'reef') this.label(ctx, f.name, x, y + is * 0.8);
        }
        ctx.restore();
    }

    drawJourney(ctx, G, res, c, s, time) {
        const p = res.path, prog = this.progress(res);
        const n = Math.max(1, Math.floor(prog * (p.length - 1)));
        const ship = c.kind === 'sail';
        ctx.save();
        ctx.strokeStyle = 'rgba(150,30,20,0.95)'; ctx.lineWidth = Math.max(2, s * 0.22); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.setLineDash([s * 0.5, s * 0.5]);
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const [x, y] = p[i]; (i ? ctx.lineTo((x + 0.5) * s, (y + 0.5) * s) : ctx.moveTo((x + 0.5) * s, (y + 0.5) * s)); }
        ctx.stroke();
        ctx.setLineDash([]);
        const [hx, hy] = p[n], X = (hx + 0.5) * s, Y = (hy + 0.5) * s + Math.sin(time * 6) * s * 0.06;
        // the traveller
        ctx.fillStyle = INK; ctx.strokeStyle = '#f4e8c4'; ctx.lineWidth = 2;
        if (ship) {
            ctx.beginPath(); ctx.moveTo(X - s * 0.8, Y); ctx.lineTo(X + s * 0.8, Y); ctx.lineTo(X + s * 0.45, Y + s * 0.5); ctx.lineTo(X - s * 0.45, Y + s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - s * 1.1); ctx.lineTo(X + s * 0.6, Y - s * 0.2); ctx.closePath(); ctx.fillStyle = '#f4e8c4'; ctx.fill(); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(X, Y - s * 0.7, s * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(X, Y - s * 0.45); ctx.lineTo(X - s * 0.35, Y + s * 0.3); ctx.lineTo(X + s * 0.35, Y + s * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        if (prog >= 1 && res.outcome !== 'ok') {
            ctx.strokeStyle = '#b01c10'; ctx.lineWidth = Math.max(3, s * 0.3);
            ctx.beginPath(); ctx.moveTo(X - s, Y - s); ctx.lineTo(X + s, Y + s); ctx.moveTo(X + s, Y - s); ctx.lineTo(X - s, Y + s); ctx.stroke();
        }
        ctx.restore();
    }

    drawFx(ctx, dt, s) {
        this.routeT += dt;
        ctx.save();
        for (const r of this.ripples) {
            r.t += dt;
            const k = r.t / 0.7;
            const R = r.r * s * (0.35 + 0.65 * Math.min(1, k * 1.6));
            ctx.globalAlpha = Math.max(0, 1 - k);
            ctx.lineWidth = 3; ctx.strokeStyle = r.focus >= SCRY.featureFocus ? '#e0b050' : '#b9a583';
            ctx.beginPath(); ctx.arc(r.x * s, r.y * s, R, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(224,176,80,0.18)'; ctx.fill();
        }
        this.ripples = this.ripples.filter((r) => r.t < 0.7);
        ctx.font = `700 ${clamp(s * 1.3, 16, 24)}px Caveat, 'Segoe Script', cursive`;
        for (const p of this.popups) {
            p.t += dt;
            ctx.globalAlpha = Math.max(0, 1 - p.t / 1.6);
            this.label(ctx, '✦ ' + p.text, p.x * s, (p.y - p.t * 0.9) * s);
        }
        this.popups = this.popups.filter((p) => p.t < 1.6);
        ctx.restore();
    }

    drawQuill(ctx, G, s, time) {
        const q = G.q, x = q.x * s, y = q.y * s, ch = G.channel;
        ctx.save();
        if (ch) {
            const f = ch.focus, R = scryRadius(f) * s, Rmax = scryRadius(1) * s;
            // a dotted ring at full size, so you can see what you are working towards
            ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(58,36,18,0.4)';
            ctx.beginPath(); ctx.arc(x, y, Rmax, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
            // the spell: its edge shakes when the focus is poor
            const g = ctx.createRadialGradient(x, y, 0, x, y, R);
            g.addColorStop(0, 'rgba(255,230,140,0.05)'); g.addColorStop(1, `rgba(255,214,100,${0.18 + f * 0.2})`);
            ctx.fillStyle = g; ctx.strokeStyle = f >= SCRY.featureFocus ? 'rgba(224,160,40,0.95)' : 'rgba(120,100,80,0.9)'; ctx.lineWidth = 2.5;
            ctx.beginPath();
            const wob = (1 - f) * s * 0.35;
            for (let i = 0; i <= 48; i++) {
                const a = (i / 48) * Math.PI * 2, rr = R + Math.sin(a * 7 + time * 18) * wob + Math.sin(a * 3 - time * 11) * wob * 0.6;
                const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
                i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // focus meter around the nib
            ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(58,36,18,0.35)';
            ctx.beginPath(); ctx.arc(x, y, s * 1.1, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = f >= SCRY.featureFocus ? '#e0a020' : '#8a7a68';
            ctx.beginPath(); ctx.arc(x, y, s * 1.1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
            if (f >= 0.999) { ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s * 1.4, 0, Math.PI * 2); ctx.stroke(); }
        } else {
            ctx.strokeStyle = 'rgba(58,36,18,0.5)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, Math.PI * 2); ctx.stroke();
        }
        // the quill itself
        ctx.translate(x, y + Math.sin(time * 3) * s * 0.08);
        ctx.rotate(0.38);
        const L = s * 3.8, w = s * 0.95;
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.3, s * 0.6, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.fillStyle = '#f7efe0';
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.bezierCurveTo(w * 1.15, -L * 0.3, w * 0.9, -L * 0.85, 0, -L);
        ctx.bezierCurveTo(-w * 0.45, -L * 0.75, -w * 0.3, -L * 0.3, 0, -s * 0.5);
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -s * 0.15); ctx.lineTo(0, -L * 0.96);
        for (let k = 1; k < 5; k++) { const yy = -L * (0.2 + k * 0.14); ctx.moveTo(0, yy); ctx.lineTo(w * 0.55, yy - s * 0.5); }
        ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.5); ctx.lineTo(0, 0); ctx.lineTo(s * 0.1, -s * 0.5); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    compass(ctx, x, y, r) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 4; i++) {
            ctx.save(); ctx.rotate((i * Math.PI) / 2);
            ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.16, -r * 0.16); ctx.lineTo(0, 0); ctx.lineTo(-r * 0.16, -r * 0.16); ctx.closePath();
            i === 0 ? ctx.fill() : ctx.stroke();
            ctx.restore();
        }
        ctx.font = `700 ${r * 0.55}px 'IM Fell English', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('N', 0, -r * 1.25);
        ctx.restore();
    }
}
