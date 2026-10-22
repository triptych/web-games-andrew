// The view: reads G every frame, turns sim events into juice, and never writes G.
//
// The scene is drawn into a 320×180 canvas (one pixel per Atari-ish pixel) and then shown through
// game-075's hand-written WebGL CRT (phosphor persistence, bloom, curvature, aberration, scanlines).
// With no WebGL it is blitted with nearest-neighbour scaling instead.
//
// Layers, back to front: striped sun, stars, two mountain ranges, a neon grid floor, palm
// silhouettes, near tree trunks and canopy, the vine, the jungle floor with its pits, the earth slab
// and the tunnel under it, then logs, snakes, fire, crocodiles, scorpions, treasure, Harry, particles.

import {
    W, H, SURF, CEIL, TF, HORIZON, N_SCREENS, LX, HOLE_HW, WALL_X, VINE, CROC, LOG, TIME_LIMIT,
} from '../config.js';
import { hash3 } from '../rng.js';
import { getWorld } from '../sim/world.js';
import { logX, scorpPos, vineTheta, crocOpen, crocWarn, crocPhase } from '../sim/game.js';
import {
    C, px, disc, line, drawHarry, drawLog, drawCobra, drawFire, drawCroc, drawScorpion, drawTreasure,
    drawVine, drawLadder, drawWall, tri,
} from './draw.js';
import { Fx } from './fx.js';
import { makeCRT } from './crt.js';
import { drawText } from './font.js';

const TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.crt = null;
        try { this.crt = makeCRT(canvas); } catch { this.crt = null; }
        this.ctx2d = this.crt ? null : canvas.getContext('2d');

        this.lo = mk(W, H);
        this.g = this.lo.getContext('2d');
        this.g.imageSmoothingEnabled = false;

        this.fx = new Fx();
        this.base = 0;                 // unwrapped screen offset, so the parallax never jumps at the ring seam
        this.time = 0;
        this.trauma = 0;
        this.flash = { a: 0, c: '#fff' };
        this.glitch = 0;
        this.punch = 0;
        this.sq = { sx: 1, sy: 1 };
        this.runPh = 0;
        this.ghostT = 0;
        this.pops = [];
        this.hitstop = 0;
        this.tunnelAmt = 0;
        this.calm = false;
        this.crtOn = true;
        this.lastG = null;
        this.rect = { x: 0, y: 0, w: 1, h: 1 };

        this.buildArt();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    // ------------------------------------------------------------------ baked art
    buildArt() {
        // sky: posterised bands from midnight to a hot horizon
        const sky = this.sky = mk(W, HORIZON + 2);
        const sg = sky.getContext('2d');
        const stops = [[0, [8, 2, 26]], [28, [40, 8, 84]], [52, [118, 20, 130]], [70, [232, 58, 140]], [HORIZON + 2, [255, 150, 90]]];
        for (let y = 0; y < HORIZON + 2; y += 3) {
            let i = 1; while (i < stops.length - 1 && y > stops[i][0]) i++;
            const [y0, c0] = stops[i - 1], [y1, c1] = stops[i];
            sg.fillStyle = rgb(mix(c0, c1, Math.min(1, (y - y0) / (y1 - y0))));
            sg.fillRect(0, y, W, 3);
        }
        // a striped retro sun
        const sun = this.sun = mk(80, 80);
        const sc = sun.getContext('2d');
        for (let y = 0; y < 80; y++) {
            const t = y / 80;
            sc.fillStyle = rgb(mix([255, 238, 120], [255, 42, 157], Math.min(1, t * 1.15)));
            const dy = y - 40, w = Math.floor(Math.sqrt(Math.max(0, 34 * 34 - dy * dy)));
            sc.fillRect(40 - w, y, w * 2, 1);
        }
        for (let y = 44; y < 80; y++) if (((y - 44) % 7) < ((y - 44) / 8 + 1)) sc.clearRect(0, y, 80, 1);
        // mountains: periodic in x (whole cycles per 320 px), so they tile
        const range = (h, f, col, edge) => {
            const c = mk(W, 46), g = c.getContext('2d');
            for (let x = 0; x < W; x++) {
                const hh = Math.round(h(x));
                g.fillStyle = col; g.fillRect(x, 46 - hh, 1, hh);
                g.fillStyle = edge; g.fillRect(x, 46 - hh, 1, 1);
            }
            g.globalAlpha = 0.22; g.fillStyle = edge;
            for (let y = 6; y < 46; y += 6) g.fillRect(0, y, W, 1);
            g.globalAlpha = 1;
            return c;
        };
        const P = (x, k, ph = 0) => Math.sin((x / W) * TAU * k + ph);
        this.mFar = range((x) => 26 + 9 * P(x, 2, 1) + 6 * P(x, 5, 2) + 3 * P(x, 11), 1, '#2c0b55', '#8a4dff');
        this.mNear = range((x) => 17 + 8 * P(x, 3) + 5 * P(x, 7, 1) + 2 * P(x, 13), 1, '#1a0638', '#ff2a9d');
        // palm silhouettes
        const pal = this.palms = mk(W, 72);
        const pg = pal.getContext('2d');
        [[20, 52], [74, 62], [131, 46], [190, 58], [243, 66], [296, 50]].forEach(([x, h], k) => {
            for (const ox of [-W, 0, W]) {
                const lean = (k % 2 ? 1 : -1) * 4;
                const topX = x + ox + lean, topY = 72 - h;
                line(pg, x + ox, 72, topX, topY, '#14062e', 3);
                for (let a = 0; a < 7; a++) {
                    const ang = -Math.PI + (a / 6) * Math.PI, len = 15 + (a % 2) * 4;
                    const ex = topX + Math.cos(ang) * len, ey = topY + Math.sin(ang) * len * 0.5 + len * 0.45;
                    line(pg, topX, topY, ex, ey, '#14062e', 2);
                    line(pg, topX, topY - 1, ex, ey - 1, 'rgba(255,42,157,0.55)', 1);
                }
            }
        });
        // glow sprites
        this.glows = {};
        for (const [name, col] of [['gold', '255,210,80'], ['cyan', '37,244,238'], ['pink', '255,42,157'], ['green', '61,255,154']]) {
            const c = mk(48, 48), g = c.getContext('2d');
            const gr = g.createRadialGradient(24, 24, 1, 24, 24, 24);
            gr.addColorStop(0, `rgba(${col},0.8)`); gr.addColorStop(1, `rgba(${col},0)`);
            g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
            this.glows[name] = c;
        }
        // a red edge for the last minute
        const vg = this.vig = mk(W, H);
        const vc = vg.getContext('2d');
        const rg = vc.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 190);
        rg.addColorStop(0, 'rgba(255,40,60,0)'); rg.addColorStop(1, 'rgba(255,40,60,0.9)');
        vc.fillStyle = rg; vc.fillRect(0, 0, W, H);
    }

    // ------------------------------------------------------------------ canvas sizing
    resize() {
        const vv = window.visualViewport;
        const vw = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const vh = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (vw === this.vw && vh === this.vh) return;
        this.vw = vw; this.vh = vh;
        const portrait = vh > vw * 1.15;
        // portrait phones: the picture sits at the top, the thumbs get the rest
        const topPad = portrait ? 84 : 0;
        const aw = vw, ah = Math.max(1, vh - topPad);
        let s = Math.min(aw / W, ah / H);
        if (s >= 2) s = Math.floor(s * 2) / 2;
        const w = Math.round(W * s), h = Math.round(H * s);
        const x = Math.round((vw - w) / 2);
        const y = portrait ? topPad + Math.round(Math.min(10, (ah - h) / 2)) : Math.round((vh - h) / 2);
        this.rect = { x, y, w, h, s };
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const c = this.canvas;
        c.style.position = 'fixed';
        c.style.left = x + 'px'; c.style.top = y + 'px';
        c.style.width = w + 'px'; c.style.height = h + 'px';
        c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
        if (this.ctx2d) this.ctx2d.imageSmoothingEnabled = false;
    }

    /** Screen pixel in the 320×180 space → client px (for DOM overlays). */
    toClient(x, y) {
        const r = this.rect;
        return { x: r.x + (x / W) * r.w, y: r.y + (y / H) * r.h };
    }

    takeHitstop() { const h = this.hitstop; this.hitstop = 0; return h; }

    // ------------------------------------------------------------------ sim events → juice
    shake(n) { this.trauma = Math.min(1, this.trauma + n * (this.calm ? 0.3 : 1)); }
    flashScreen(c, a) { this.flash.c = c; this.flash.a = Math.max(this.flash.a, a * (this.calm ? 0.35 : 1)); }
    jolt(a) { if (!this.calm) this.glitch = Math.max(this.glitch, a); }
    pop(text, x, y, color, scale = 1, life = 1.1) { if (this.pops.length > 6) this.pops.shift(); this.pops.push({ text, x: Math.max(30, Math.min(W - 30, x)), y: Math.max(14, y), color, scale, life, max: life }); }

    onEvents(G, events) {
        const fx = this.fx;
        const p = G.p;
        for (const e of events) {
            switch (e.type) {
                case 'jump': fx.dust(e.x, e.y, 0, 5); this.sq = { sx: 0.82, sy: 1.22 }; break;
                case 'land': {
                    const k = Math.min(1, e.impact / 300);
                    fx.dust(e.x, e.y, 0, 3 + Math.round(k * 6));
                    if (e.impact > 120) { this.sq = { sx: 1 + k * 0.4, sy: 1 - k * 0.3 }; fx.ring(e.x, e.y, 'rgba(255,190,240,0.8)', 2, 40, 0.2); }
                    break;
                }
                case 'step': fx.dust(e.x - p.face * 2, e.y, -p.face, 1); break;
                case 'grab':
                    fx.ring(e.x, e.y, C.cyan, 2, 70, 0.3);
                    fx.burst(e.x, e.y, 10, { color: [C.cyan, C.white], speed: 60, life: 0.4, glow: true });
                    this.shake(0.12);
                    break;
                case 'release': fx.burst(e.x, e.y, 6, { color: [C.cyan, C.ice], speed: 40, life: 0.3 }); break;
                case 'hit':
                    fx.burst(e.x, e.y - 6, 14, { color: [C.wood, C.woodL, C.orange], speed: 90, spread: Math.PI * 1.2, life: 0.6, grav: 220, size: 2 });
                    this.shake(0.45); this.jolt(0.14); this.hitstop += 70;
                    this.pop('-50', e.x, e.y - 24, C.red);
                    break;
                case 'death': this.onDeath(e); break;
                case 'respawn':
                    fx.ring(24, e.layer === 'tunnel' ? TF - 8 : SURF - 8, C.cyan, 2, 90, 0.4);
                    fx.burst(24, e.layer === 'tunnel' ? TF - 8 : SURF - 8, 16, { color: [C.cyan, C.ice, C.pink], speed: 80, life: 0.5, glow: true });
                    this.flashScreen(C.cyan, 0.18);
                    break;
                case 'treasure': {
                    const col = [C.yellow, C.gold, C.white, C.cyan, C.pink];
                    fx.burst(e.x, e.y - 8, 34, { color: col, speed: 120, life: 0.9, grav: 60, size: 2, glow: true });
                    fx.ring(e.x, e.y - 8, C.yellow, 3, 120, 0.5); fx.ring(e.x, e.y - 8, C.white, 1, 70, 0.35);
                    this.flashScreen(C.yellow, 0.32); this.shake(0.28); this.punch = 1; this.hitstop += 90;
                    this.pop('+' + e.value, e.x, e.y - 26, C.yellow, 2, 1.5);
                    if (e.mult > 1) this.pop('STREAK +' + Math.round((e.mult - 1) * 100) + '%', e.x, e.y - 40, C.pink, 1, 1.5);
                    break;
                }
                case 'life': this.pop('1UP', p.x, p.y - 34, C.cyan, 2, 1.6); fx.burst(p.x, p.y - 10, 20, { color: [C.cyan, C.ice], speed: 90, life: 0.8, glow: true }); break;
                case 'screen': this.base += e.dir * W; this.jolt(0.1); this.ghostT = 0; break;
                case 'ladder': fx.dust(e.x, p.y, 0, 5); break;
                case 'rung': fx.burst(e.x, e.y - 6, 2, { color: C.orange, speed: 20, life: 0.2 }); break;
                case 'hurry': this.pop('HURRY!', W / 2, 52, C.red, 2, 2); this.flashScreen(C.red, 0.25); this.shake(0.2); break;
                case 'over':
                    if (e.reason === 'won') for (let i = 0; i < 80; i++) fx.add({ x: fx.range(0, W), y: fx.range(-20, 0), vx: fx.range(-20, 20), vy: fx.range(30, 80), life: 2.5, max: 2.5, size: 2, grav: 20, drag: 0.2, color: [C.yellow, C.pink, C.cyan, C.green][i % 4] });
                    break;
                default: break;
            }
        }
    }

    onDeath(e) {
        const fx = this.fx;
        const { x, y } = e;
        this.shake(0.8); this.jolt(0.35); this.hitstop += 130;
        if (e.kind === 'sink') {
            fx.burst(x, y, 20, { color: ['#3a1a6e', '#8a4dff', '#0a0316'], speed: 50, ang: -Math.PI / 2, spread: 1.6, life: 0.8, grav: 160, size: 2 });
            this.pitFlash = '#8a4dff';
        } else if (e.kind === 'drown') {
            fx.burst(x, y, 28, { color: [C.cyan, C.ice, '#0aa5c8'], speed: 100, ang: -Math.PI / 2, spread: 1.8, life: 0.8, grav: 220, size: 2 });
            fx.ring(x, y, C.cyan, 2, 60, 0.4);
        } else if (e.kind === 'chomp') {
            fx.ring(x, y - 6, C.red, 2, 110, 0.35);
            fx.burst(x, y - 6, 16, { color: [C.red, C.white, C.green], speed: 90, life: 0.5, size: 2 });
            this.flashScreen(C.red, 0.3);
        } else {
            for (let i = 0; i < 4; i++) fx.bolt(x, y - 10, x + fx.range(-24, 24), y - 10 + fx.range(-24, 12), i % 2 ? C.cyan : C.white, 0.3);
            fx.burst(x, y - 8, 24, { color: [C.white, C.cyan, C.magenta], speed: 130, life: 0.6, glow: true });
            this.flashScreen(C.magenta, 0.3);
        }
    }

    // ------------------------------------------------------------------ the frame
    frame(G, dt, time, o = {}) {
        this.lastG = G;
        this.time = time;
        this.resize();
        const p = G.p, g = this.g;
        const world = getWorld(G.seed);
        const scr = world.screens[G.screen];

        // smooth view-side state
        this.fx.update(dt);
        this.trauma = Math.max(0, this.trauma - dt * 1.6);
        this.flash.a = Math.max(0, this.flash.a - dt * 2.2);
        this.glitch = Math.max(0, this.glitch - dt * 1.4);
        this.punch = Math.max(0, this.punch - dt * 4);
        this.sq.sx += (1 - this.sq.sx) * Math.min(1, dt * 14);
        this.sq.sy += (1 - this.sq.sy) * Math.min(1, dt * 14);
        this.tunnelAmt += ((p.layer === 'tunnel' ? 1 : 0) - this.tunnelAmt) * Math.min(1, dt * 5);
        this.runPh += Math.abs(p.vx) * dt / 9 * Math.PI;
        for (const q of this.pops) { q.life -= dt; q.y -= 14 * dt; }
        this.pops = this.pops.filter((q) => q.life > 0);

        const cam = this.base + p.x;
        const z = 1 + this.punch * 0.03;
        const sh = this.trauma * this.trauma * 5;
        const ox = Math.round((this.fx.rnd() - 0.5) * 2 * sh), oy = Math.round((this.fx.rnd() - 0.5) * 2 * sh);

        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.fillStyle = C.ink; g.fillRect(0, 0, W, H);
        g.save();
        g.translate(W / 2 + ox, H / 2 + oy); g.scale(z, z); g.translate(-W / 2, -H / 2);

        this.drawBackdrop(g, cam, time);
        this.drawScreen(g, G, scr, time, dt);
        this.drawPlayer(g, G, p, time, dt);
        this.fx.draw(g);
        g.restore();

        // tint the layer Harry is not in
        g.fillStyle = '#000';
        g.globalAlpha = 0.34 * this.tunnelAmt; g.fillRect(0, 0, W, CEIL);
        g.globalAlpha = 0.2 * (1 - this.tunnelAmt); g.fillRect(0, CEIL, W, H - CEIL);
        g.globalAlpha = 1;

        // the clock: red edges pulse in the last minute
        if (G.left < 60 && !G.over) {
            g.globalAlpha = (0.18 + 0.22 * tri(time * (G.left < 20 ? 2.4 : 1.2))) * (this.calm ? 0.5 : 1);
            g.drawImage(this.vig, 0, 0);
            g.globalAlpha = 1;
        }
        if (this.flash.a > 0) { g.globalAlpha = this.flash.a; g.fillStyle = this.flash.c; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
        for (const q of this.pops) {
            g.globalAlpha = Math.min(1, q.life / q.max * 2.5);
            drawText(g, q.text, q.x, q.y, q.color, { align: 'center', scale: q.scale, shadow: '#000' });
        }
        g.globalAlpha = 1;

        this.present(time);
    }

    present(time) {
        const calm = this.calm;
        if (this.crt) {
            this.crt.render(this.lo, {
                time, glitch: this.glitch, persist: calm ? 0.25 : 0.5, bloom: 1.1, curv: this.crtOn ? 0.55 : 0,
                scan: this.crtOn ? 1 : 0, rows: H,
            });
        } else {
            const c = this.ctx2d;
            c.imageSmoothingEnabled = false;
            c.drawImage(this.lo, 0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // ------------------------------------------------------------------ backdrop
    drawBackdrop(g, cam, time) {
        g.drawImage(this.sky, 0, 0);
        // stars
        for (let i = 0; i < 46; i++) {
            const sx = (hash3(i, 1) * W + 0.3 * -cam * 0.02) % W, sy = hash3(i, 2) * 52;
            const a = 0.35 + 0.65 * tri(time * (0.4 + hash3(i, 3)) + i);
            g.globalAlpha = a; px(g, (sx + W) % W, sy, 1, 1, i % 5 ? C.white : C.cyan);
        }
        g.globalAlpha = 1;
        // sun, drifting a little with the walk
        g.drawImage(this.sun, 198 - Math.sin(cam * 0.002) * 14 - 40, 62 - 40 + Math.sin(time * 0.2) * 1);
        // mountains
        const wrap = (v) => ((v % W) + W) % W;
        for (const [img, par, y] of [[this.mFar, 0.08, HORIZON - 46], [this.mNear, 0.2, HORIZON - 38]]) {
            const o = -wrap(cam * par);
            g.drawImage(img, Math.round(o), y); g.drawImage(img, Math.round(o + W), y);
        }
        // the neon grid floor between the horizon and the running line
        px(g, 0, HORIZON, W, SURF - HORIZON, '#12062c');
        g.globalAlpha = 0.5;
        const off = wrap(cam * 0.9) % 36;
        for (let k = -12; k <= 12; k++) {
            const bx = 160 + k * 36 - off, tx = 160 + (bx - 160) * 0.1;
            line(g, tx, HORIZON, bx, SURF, k % 2 ? '#ff2a9d' : '#b02cff', 1);
        }
        for (let i = 0; i < 7; i++) {
            const u = (i + ((time * 0.5) % 1)) / 7;
            px(g, 0, HORIZON + (SURF - HORIZON) * u * u, W, 1, '#ff2a9d');
        }
        g.globalAlpha = 1;
        px(g, 0, HORIZON, W, 1, C.pink);
        // palms
        const po = -wrap(cam * 0.42);
        g.drawImage(this.palms, Math.round(po), SURF - 72 - 4); g.drawImage(this.palms, Math.round(po + W), SURF - 72 - 4);
    }

    // ------------------------------------------------------------------ the screen itself
    drawScreen(g, G, scr, time, dt) {
        const seed = G.seed, i = scr.i;
        // near trunks
        for (let k = 0; k < 3; k++) {
            const x = Math.round(14 + hash3(seed, i, k) * 292);
            if (scr.vine && Math.abs(x - scr.vine.x) < 14) continue;
            px(g, x - 3, 0, 7, SURF, '#0e0522');
            px(g, x - 3, 0, 1, SURF, 'rgba(61,255,154,0.55)'); px(g, x + 3, 0, 1, SURF, 'rgba(255,42,157,0.5)');
            for (let y = 8; y < SURF; y += 12) px(g, x - 2, y + ((x + y) % 5), 3, 1, '#1e0b3c');
            px(g, x - 6, SURF - 3, 3, 3, '#0e0522'); px(g, x + 4, SURF - 3, 3, 3, '#0e0522');
        }
        // the vine hangs below the canopy
        let vineHand = null;
        if (scr.vine) {
            const th = vineTheta(scr.vine, G.t);
            vineHand = drawVine(g, scr.vine, th, time);
        }
        // canopy fringe
        for (let x = 0; x < W; x += 6) {
            const h = 4 + Math.floor(hash3(seed, i, x + 50) * 9);
            px(g, x, 0, 6, h, '#08031a'); px(g, x + 1, h, 4, 2, '#08031a'); px(g, x + 2, h + 2, 2, 2, '#08031a');
            px(g, x + 2, h + 3, 2, 1, 'rgba(61,255,154,0.8)');
        }

        // ---- the earth slab and the tunnel
        px(g, 0, SURF, W, CEIL - SURF, '#24104f');
        px(g, 0, SURF + 7, W, 1, '#2f1763'); px(g, 0, SURF + 14, W, 1, '#1d0c40');
        for (let k = 0; k < 40; k++) px(g, hash3(seed, i, k + 100) * W, SURF + 2 + hash3(seed, i, k + 200) * 16, 2, 1, k % 3 ? '#3a1a6e' : '#18082f');
        px(g, 0, CEIL, W, TF - CEIL, '#0d0322');
        px(g, 0, CEIL + 3, W, 10, '#120530');
        px(g, 0, CEIL, W, 3, '#26115a');
        g.globalAlpha = 0.17;
        for (let x = -((this.base + G.p.x) % 24); x < W; x += 24) px(g, x, CEIL + 3, 1, TF - CEIL - 3, C.cyan);
        g.globalAlpha = 1;
        px(g, 0, TF, W, H - TF, '#12062c');
        px(g, 0, TF, W, 1, C.magenta); px(g, 0, TF + 1, W, 1, 'rgba(255,42,157,0.35)');
        for (let k = 0; k < 30; k++) px(g, hash3(seed, i, k + 300) * W, TF + 3 + hash3(seed, i, k + 400) * 4, 2, 1, '#1d0c40');

        // ---- pits and the ladder hole cut the slab
        for (const pit of scr.pits) this.drawPit(g, pit, time);
        if (scr.ladder) {
            px(g, LX - HOLE_HW, SURF, HOLE_HW * 2 + 1, CEIL - SURF, '#000');
            px(g, LX - HOLE_HW - 1, SURF, 1, CEIL - SURF, C.orange); px(g, LX + HOLE_HW + 1, SURF, 1, CEIL - SURF, C.orange);
            drawLadder(g, SURF, TF, LX);
            // a pulsing arrow shows the way down
            if (G.p.layer === 'surface') { g.globalAlpha = 0.5 + 0.5 * tri(time * 2); px(g, LX - 1, SURF - 10, 3, 4, C.orange); px(g, LX - 3, SURF - 7, 7, 1, C.orange); px(g, LX - 2, SURF - 6, 5, 1, C.orange); px(g, LX - 1, SURF - 5, 3, 1, C.orange); g.globalAlpha = 1; }
        }
        // surface edge: a bright line with a pink glow under it, broken by pits
        const gaps = [...scr.pits.map((q) => [q.x0, q.x1]), ...(scr.ladder ? [[LX - HOLE_HW, LX + HOLE_HW]] : [])].sort((a, b) => a[0] - b[0]);
        let cx = 0;
        for (const [a, b] of [...gaps, [W, W]]) {
            if (a > cx) { px(g, cx, SURF, a - cx, 1, C.cyan); px(g, cx, SURF + 1, a - cx, 1, 'rgba(255,42,157,0.7)'); }
            cx = b;
        }

        // ---- tunnel contents
        if (scr.tunnel.wall) drawWall(g, WALL_X, CEIL, TF);
        if (scr.tunnel.scorp) { const sp = scorpPos(scr.tunnel.scorp, G.t); drawScorpion(g, sp.x, TF, sp.dir, time); }
        // ---- surface hazards
        for (const L of scr.logs) {
            const lx = logX(L, G.t + (G.logShift || 0));
            if (lx > -10 && lx < W + 10) drawLog(g, lx, SURF, -lx / 6);
        }
        scr.cobras.forEach((c, k) => drawCobra(g, c.x, SURF, time, k));
        scr.fires.forEach((f, k) => {
            drawFire(g, f.x, SURF, time, k);
            if (this.fx.rnd() < dt * 18) this.fx.add({ x: f.x + this.fx.range(-4, 4), y: SURF - 12, vx: this.fx.range(-6, 6), vy: this.fx.range(-40, -18), life: 0.7, max: 0.7, size: 1, grav: -10, drag: 0.5, color: this.fx.rnd() < 0.5 ? C.orange : C.yellow });
        });
        scr.crocs.forEach((c) => {
            const m = crocPhase(c, G.t);
            let open = 0;
            if (m >= CROC.closed) open = Math.min(1, (m - CROC.closed) / 0.12) * (m > CROC.period - 0.12 ? (CROC.period - m) / 0.12 : 1);
            else if (m >= CROC.closed - CROC.warn) open = 0.18 + 0.1 * tri(time * 10);
            drawCroc(g, { x: c.x, sy: SURF }, open, crocWarn(c, G.t), time);
            if (open > 0.9 && this.fx.rnd() < dt * 3) this.fx.add({ x: c.x + this.fx.range(-8, 8), y: SURF - 6, vx: 0, vy: -20, life: 0.5, max: 0.5, size: 1, grav: -4, drag: 1, color: C.ice });
        });
        // treasure
        const tr = scr.treasure;
        if (tr && !G.got[tr.id]) {
            const y = tr.layer === 'tunnel' ? TF : SURF;
            const gl = this.glows[['green', 'cyan', 'gold', 'pink'][tr.kind]];
            g.globalAlpha = 0.55 + 0.35 * tri(time * 1.5 + tr.id);
            g.globalCompositeOperation = 'lighter';
            g.drawImage(gl, tr.x - 24, y - 30);
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = 1;
            drawTreasure(g, tr.kind, tr.x, y, time, tr.id);
            if (this.fx.rnd() < dt * 5) this.fx.add({ x: tr.x + this.fx.range(-6, 6), y: y - this.fx.range(2, 14), vx: 0, vy: -12, life: 0.7, max: 0.7, size: 1, grav: 0, drag: 0.2, color: C.white });
        }
        // swing trail
        if (vineHand && G.p.st === 'vine') {
            this.ghostT -= dt;
            if (this.ghostT <= 0) { this.ghostT = 0.04; this.fx.ghost({ x: G.p.x, y: G.p.y, face: G.p.face, pose: 'vine', ph: this.runPh, life: 0.28, color: C.cyan }); }
        } else if (G.p.st === 'air' && (Math.abs(G.p.vx) > 70 || G.p.cool > 0)) {
            this.ghostT -= dt;
            if (this.ghostT <= 0) { this.ghostT = 0.05; this.fx.ghost({ x: G.p.x, y: G.p.y, face: G.p.face, pose: 'air', ph: 0, life: 0.2, color: C.magenta }); }
        }
        for (const gh of this.fx.ghosts) {
            drawHarry(g, gh.x, gh.y, { face: gh.face, pose: gh.pose, ph: gh.ph, tint: gh.color, alpha: (gh.life / gh.max) * 0.45, t: time });
        }
        // bubbles in the pits
        for (const pit of scr.pits) {
            if (this.fx.rnd() < dt * 2.5) this.fx.add({ x: this.fx.range(pit.x0 + 4, pit.x1 - 4), y: SURF + 8, vx: 0, vy: -14, life: 0.5, max: 0.5, size: 1, grav: 0, drag: 0.2, color: pit.type === 'water' ? C.ice : pit.type === 'sand' ? C.yellow : C.pink });
        }
    }

    drawPit(g, pit, time) {
        const { x0, x1, type } = pit, w = x1 - x0, hgt = CEIL - SURF;
        if (type === 'tar') {
            px(g, x0, SURF, w, hgt, '#07020f');
            for (let k = 0; k < w; k += 5) px(g, x0 + k + ((time * 14) % 5), SURF + 3 + (k * 7) % 11, 3, 1, '#2a1055');
            px(g, x0, SURF, w, 2, '#2d1260');
            const hx = x0 + ((time * 30) % w);
            px(g, hx, SURF, 6, 1, '#b79bff');
        } else if (type === 'sand') {
            px(g, x0, SURF, w, hgt, '#9a4a00');
            px(g, x0, SURF, w, 6, '#e07a00'); px(g, x0, SURF, w, 2, '#ffb347');
            for (let k = 0; k < w; k += 6) { const o = Math.sin(time * 2 + k) * 1.5; px(g, x0 + k, SURF + 4 + o + 3, 4, 1, '#c25f00'); }
            for (let k = 0; k < 6; k++) if (tri(time * 3 + k * 1.7) > 0.8) px(g, x0 + ((k * 37 + 11) % w), SURF + 1 + (k % 3) * 3, 1, 1, C.white);
        } else {
            px(g, x0, SURF, w, hgt, '#07587a');
            px(g, x0, SURF, w, 7, '#0a7fa8');
            for (let x = x0; x < x1; x += 2) {
                const y = SURF + Math.round(Math.sin(x * 0.35 + time * 3) * 1);
                px(g, x, y, 2, 1, '#7dfaff'); px(g, x, y + 1, 2, 1, '#0aa5c8');
            }
        }
        px(g, x0 - 1, SURF, 1, hgt, C.cyan); px(g, x1 + 1, SURF, 1, hgt, C.cyan);
    }

    // ------------------------------------------------------------------ Harry
    drawPlayer(g, G, p, time) {
        const tint = null;
        let pose = 'stand';
        if (p.st === 'vine') pose = 'vine';
        else if (p.st === 'ladder') pose = 'ladder';
        else if (p.stun > 0) pose = 'stun';
        else if (p.st === 'air') pose = p.vy < 0 ? 'air' : 'fall';
        else if (Math.abs(p.vx) > 12) pose = 'run';
        const ph = pose === 'ladder' ? p.y * 0.5 : pose === 'vine' ? time * 6 : this.runPh;
        const o = { face: p.face, pose, ph, t: time, vx: p.vx, sx: this.sq.sx, sy: this.sq.sy };
        const y = p.y;

        if (p.st === 'dead') {
            if (p.dk === 'sink' || p.dk === 'drown') {
                g.save();
                g.beginPath(); g.rect(0, 0, W, SURF + 1); g.clip();
                drawHarry(g, p.x, y, { ...o, pose: 'stun' });
                g.restore();
                // the hat floats
                px(g, p.x - 4, SURF - 1, 9, 1, C.magenta);
            } else if (p.dk === 'chomp') {
                px(g, p.x - 4, SURF - 3 + Math.round(tri(time * 6)), 9, 1, C.magenta);
            } else {
                const flick = Math.floor(time * 24) % 2;
                drawHarry(g, p.x + (flick ? 1 : -1), y, { ...o, pose: 'stun', tint: flick ? C.white : C.cyan });
            }
            return;
        }
        // a dark outline keeps him readable on the bright grid
        if (!(p.inv > 0 && Math.floor(time * 18) % 2)) {
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawHarry(g, p.x + dx, y + dy, { ...o, tint: '#07020f', alpha: 0.85 });
            drawHarry(g, p.x, y, { ...o, tint });
        }
        // a stunned Harry sees stars
        if (p.stun > 0) for (let k = 0; k < 3; k++) { const a = time * 9 + k * 2.1; px(g, p.x + Math.cos(a) * 7, y - 24 + Math.sin(a) * 2, 2, 2, C.yellow); }
    }
}
