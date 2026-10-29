// The Canvas 2D view: reads G every frame and turns sim events into effects. Never changes G.
//
// Everything is drawn at 16 px per world unit into a 512×288 buffer — the "16-bit" screen — with
// smoothing off, and a cheap bloom is added inside that buffer (see bloom()). The buffer is then
// scaled up (pixelated) to fit the window; scanlines and a vignette finish the CRT look. The view may use Math.random: effects
// are not part of the game.

import { FIELD, PX, PLAYER, ROBOTS, ORBIT, GRINNER, MAZE } from '../config.js';
import { makeSprites } from './sprites.js';

const BW = FIELD.w * PX, BH = FIELD.h * PX;
const HUD_H = 56;
const PORTRAIT_W = 14;                     // world units shown across a portrait phone

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export class View {
    constructor(el) {
        this.canvas = el;
        this.ctx = el.getContext('2d');
        this.buf = canvas(BW, BH);
        this.b = this.buf.getContext('2d');
        this.b.imageSmoothingEnabled = false;
        this.g1 = canvas(BW / 2, BH / 2);
        this.g2 = canvas(BW / 4, BH / 4);
        this.sprites = makeSprites();
        this.floor = this.makeFloor();
        this.wallLayer = canvas(BW, BH);
        this.wallsFor = null;
        this.parts = [];                       // pixel particles
        this.rings = [];                       // expanding rings: pulses, kills, level ups
        this.trail = [];                       // dash afterimages
        this.shake = 0;
        this.flash = 0;                        // white flash (sector purge)
        this.hurtFlash = 0;
        this.fx = { bloom: true, scan: true, vignette: true };   // the dev harness toggles these
        this.calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
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
        // Landscape: the whole room fitted under the HUD, letterboxed. Portrait: the room's full
        // height but only PORTRAIT_W units of its width, panned to follow the player, sitting at
        // the top so the thumbs have the space below.
        this.portrait = h > w * 1.1;
        if (this.portrait) {
            this.scale = Math.min(w / (PORTRAIT_W * PX), (h - HUD_H - 8) / BH);
            this.srcW = Math.min(BW, Math.round(w / this.scale));
            this.dw = Math.round(this.srcW * this.scale);
            this.dh = Math.round(BH * this.scale);
            this.ox = Math.round((w - this.dw) / 2);
            this.oy = HUD_H + 10;
        } else {
            this.scale = Math.min((w - 8) / BW, (h - HUD_H - 8) / BH);
            this.srcW = BW;
            this.dw = Math.round(BW * this.scale);
            this.dh = Math.round(BH * this.scale);
            this.ox = Math.round((w - this.dw) / 2);
            this.oy = Math.round(HUD_H + (h - HUD_H - this.dh) / 2);
        }
        this.camX = this.camX ?? 0;
        this.scan = null;
    }

    /** Screen (client) px → world units, through the canvas's own rect. */
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const k = this.scale * PX;
        return { x: (clientX - r.left - this.ox) / k + this.camX / PX, y: (clientY - r.top - this.oy) / k };
    }

    // ------------------------------------------------------------------ static layers
    makeFloor() {
        const c = canvas(BW, BH), g = c.getContext('2d');
        g.fillStyle = '#090320';
        g.fillRect(0, 0, BW, BH);
        // checkered 16 px tiles with a two-tone dither: the 16-bit floor
        for (let ty = 0; ty < BH / PX; ty++) for (let tx = 0; tx < BW / PX; tx++) {
            g.fillStyle = (tx + ty) & 1 ? '#0c0428' : '#0a0322';
            g.fillRect(tx * PX, ty * PX, PX, PX);
            g.fillStyle = '#120636';
            for (let y = 1; y < PX; y += 4) for (let x = (y >> 2) & 1 ? 2 : 0; x < PX; x += 4) g.fillRect(tx * PX + x, ty * PX + y, 1, 1);
        }
        // the synthwave grid
        g.fillStyle = '#1e0b4a';
        for (let x = 0; x < BW; x += PX) g.fillRect(x, 0, 1, BH);
        for (let y = 0; y < BH; y += PX) g.fillRect(0, y, BW, 1);
        g.fillStyle = '#3a1173';
        for (let x = 0; x < BW; x += PX * 4) g.fillRect(x, 0, 1, BH);
        for (let y = 0; y < BH; y += PX * 4) g.fillRect(0, y, BW, 1);
        return c;
    }

    drawWalls(walls) {
        const g = this.wallLayer.getContext('2d');
        g.clearRect(0, 0, BW, BH);
        for (const w of walls) {
            const x = Math.round(w.x * PX), y = Math.round(w.y * PX), ww = Math.round(w.w * PX), hh = Math.round(w.h * PX);
            g.fillStyle = '#2342ff'; g.fillRect(x, y, ww, hh);
            g.fillStyle = '#0c1a9e'; g.fillRect(x, y + hh - 2, ww, 2); g.fillRect(x + ww - 2, y, 2, hh);
            g.fillStyle = '#7ff0ff'; g.fillRect(x, y, ww, 1); g.fillRect(x, y, 1, hh);
            g.fillStyle = '#4fc8ff';
            if (ww > hh) g.fillRect(x + 1, y + (hh >> 1) - 1, ww - 2, 3); else g.fillRect(x + (ww >> 1) - 1, y + 1, 3, hh - 2);
            g.fillStyle = '#ffffff';
            if (ww > hh) g.fillRect(x + 1, y + (hh >> 1), ww - 2, 1); else g.fillRect(x + (ww >> 1), y + 1, 1, hh - 2);
        }
        // the door frames
        const d = (MAZE.door / 2) * PX, t = Math.round(MAZE.thick * PX);
        g.fillStyle = '#ff2bd6';
        for (const [x, y, w, h] of [
            [BW / 2 - d - 3, 0, 3, t + 3], [BW / 2 + d, 0, 3, t + 3], [BW / 2 - d - 3, BH - t - 3, 3, t + 3], [BW / 2 + d, BH - t - 3, 3, t + 3],
            [0, BH / 2 - d - 3, t + 3, 3], [0, BH / 2 + d, t + 3, 3], [BW - t - 3, BH / 2 - d - 3, t + 3, 3], [BW - t - 3, BH / 2 + d, t + 3, 3],
        ]) g.fillRect(Math.round(x), Math.round(y), w, h);
        this.wallsFor = walls;
    }

    // ------------------------------------------------------------------ events
    burst(x, y, color, n, speed = 60, life = 0.5) {
        if (this.parts.length > 900) return;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
            this.parts.push({ x: x * PX, y: y * PX, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.8), color, size: Math.random() < 0.3 ? 2 : 1 });
        }
    }
    ring(x, y, r, color, life = 0.35) {
        if (this.rings.length >= 64) this.rings.shift();     // a purge blows 150 robots at once
        this.rings.push({ x: x * PX, y: y * PX, r: r * PX, color, life, max: life });
    }

    onEvents(G, events) {
        // a fast-forward drains minutes of events at once: only the last few hundred are worth drawing
        if (events.length > 400) events = events.slice(-400);
        for (const e of events) {
            switch (e.type) {
                case 'kill': {
                    const col = this.sprites.colors[e.kind] || '#fff';
                    this.burst(e.x, e.y, col, e.kind === 'brute' ? 40 : 16, e.kind === 'brute' ? 90 : 70);
                    this.burst(e.x, e.y, '#ffffff', 5, 40, 0.25);
                    if (e.by !== 'purge') this.ring(e.x, e.y, ROBOTS[e.kind].r * 1.6, col, 0.25);
                    if (e.kind === 'brute') this.shake = Math.max(this.shake, 4);
                    break;
                }
                case 'hit': this.burst(e.x, e.y, '#ffffff', 3, 40, 0.15); break;
                case 'spark': this.burst(e.x, e.y, '#7ffcff', 4, 50, 0.2); break;
                case 'ping': this.burst(e.x, e.y, '#ffe14d', 4, 60, 0.2); break;
                case 'chip': this.burst(e.x, e.y, '#ffe14d', 3, 30, 0.2); break;
                case 'hurt': this.shake = Math.max(this.shake, e.cause === 'grinner' ? 7 : 4); this.hurtFlash = 1; this.burst(e.x, e.y, '#39ff88', 10, 60); break;
                case 'pulse': this.ring(e.x, e.y, e.r, '#7ffcff', 0.4); break;
                case 'levelup': this.ring(G.player.x, G.player.y, 3, '#ffe14d', 0.6); break;
                case 'sector': this.flash = 1; this.shake = Math.max(this.shake, 6); break;
                case 'grinner': this.ring(e.x, e.y, 2.5, '#ff2bd6', 0.6); break;
                case 'dash': this.trail.length = 0; break;
            }
        }
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.resize();
        this.t = time;
        const b = this.b, S = this.sprites, p = G.player;
        if (this.wallsFor !== G.walls) this.drawWalls(G.walls);

        b.drawImage(this.floor, 0, 0);
        b.drawImage(this.wallLayer, 0, 0);
        // electricity crawling along the inner walls
        b.fillStyle = '#e8ffff';
        for (const w of G.walls) {
            if (w.outer) continue;
            for (let k = 0; k < 3; k++) {
                const u = Math.random();
                const x = w.w > w.h ? w.x + u * w.w : w.x + w.w / 2, y = w.w > w.h ? w.y + w.h / 2 : w.y + u * w.h;
                b.fillRect(Math.round(x * PX) + ((Math.random() * 5) | 0) - 2, Math.round(y * PX) + ((Math.random() * 5) | 0) - 2, 2, 1);
            }
        }

        // chips
        const chip = S.chip.frames[0];
        for (const c of G.chips) {
            const tw = Math.sin(time * 8 + c.x * 3) > 0.6;
            b.drawImage(tw ? S.chip.white[0] : chip, Math.round(c.x * PX - 3), Math.round(c.y * PX - 3));
        }

        // robots, back to front
        const sorted = G.robots.slice().sort((a, c) => a.y - c.y);
        for (const r of sorted) {
            const spr = S[r.kind], big = r.kind === 'brute' ? 2 : 1;
            const f = ((time * 6 + r.id * 0.37) | 0) & 1;
            const left = (p.x < r.x) !== (r.kind === 'gunner');     // the gunner's cannon is drawn pointing left
            const img = r.hitT > 0 ? spr.white[f] : (left ? spr.flipped[f] : spr.frames[f]);
            const w = img.width * big, h = img.height * big;
            b.drawImage(img, Math.round(r.x * PX - w / 2), Math.round(r.y * PX - h / 2 - 2), w, h);
        }

        // robot bolts
        for (const o of G.bolts) {
            b.fillStyle = (time * 20) & 1 ? '#ff9f1c' : '#ffffff';
            b.fillRect(Math.round(o.x * PX) - 2, Math.round(o.y * PX) - 2, 4, 4);
            b.fillStyle = '#ff5a00';
            b.fillRect(Math.round(o.x * PX) - 1, Math.round(o.y * PX) - 1, 2, 2);
        }

        // the player: afterimages while dashing, blink while invulnerable
        if (p.dash > 0) this.trail.push({ x: p.x, y: p.y, life: 0.2 });
        for (const t of this.trail) {
            t.life -= dt;
            b.globalAlpha = Math.max(0, t.life / 0.2) * 0.5;
            b.drawImage(S.hero.white[0], Math.round(t.x * PX - 6), Math.round(t.y * PX - 9));
        }
        b.globalAlpha = 1;
        this.trail = this.trail.filter((t) => t.life > 0);
        const moving = Math.hypot(p.vx, p.vy) > 0.5;
        const hf = moving ? ((time * 8) | 0) & 1 : 0;
        if (!(p.inv > 0 && ((time * 20) | 0) & 1)) {
            const img = p.fx < 0 ? S.hero.flipped[hf] : S.hero.frames[hf];
            b.drawImage(img, Math.round(p.x * PX - 6), Math.round(p.y * PX - 9));
        }

        // orbiting discs (positions follow the sim's own formula)
        const discs = G.up.orbit;
        for (let k = 0; k < discs; k++) {
            const a = G.t * ORBIT.spin + (k * Math.PI * 2) / discs;
            const x = Math.round((p.x + Math.cos(a) * ORBIT.radius) * PX), y = Math.round((p.y + Math.sin(a) * ORBIT.radius) * PX);
            b.fillStyle = '#2de2ff'; b.fillRect(x - 3, y - 2, 7, 5); b.fillRect(x - 2, y - 3, 5, 7);
            b.fillStyle = '#eaffff'; b.fillRect(x - 1, y - 1, 3, 3);
        }

        // lasers: a hot pink beam with a white core
        b.lineCap = 'square';
        for (const l of G.lasers) {
            const x1 = l.x * PX, y1 = l.y * PX, x0 = (l.x - l.vx * 0.03) * PX, y0 = (l.y - l.vy * 0.03) * PX;
            b.strokeStyle = '#ff2bd6'; b.lineWidth = 3;
            b.beginPath(); b.moveTo(x0, y0); b.lineTo(x1, y1); b.stroke();
            b.strokeStyle = '#ffffff'; b.lineWidth = 1;
            b.beginPath(); b.moveTo(x0, y0); b.lineTo(x1, y1); b.stroke();
        }

        // the Grinner bounces
        if (G.grinner) {
            const g = G.grinner, img = S.grinner.frames[g.recoil > 0 ? 1 : 0];
            const hop = Math.abs(Math.sin(g.age * 7)) * 10;
            b.fillStyle = 'rgba(0,0,0,0.45)';
            b.fillRect(Math.round(g.x * PX - 7), Math.round(g.y * PX + GRINNER.r * PX - 2), 14, 3);
            b.drawImage(img, Math.round(g.x * PX - 11), Math.round(g.y * PX - 11 - hop));
        }

        // particles and rings
        for (const q of this.parts) {
            q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt;
            b.fillStyle = q.color;
            b.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
        }
        this.parts = this.parts.filter((q) => q.life > 0);
        for (const r of this.rings) {
            r.life -= dt;
            const k = 1 - Math.max(0, r.life) / r.max;
            b.globalAlpha = Math.max(0, 1 - k);
            b.strokeStyle = r.color; b.lineWidth = 2;
            b.beginPath(); b.arc(r.x, r.y, Math.max(1, r.r * (0.3 + 0.7 * k)), 0, Math.PI * 2); b.stroke();
        }
        b.globalAlpha = 1;
        this.rings = this.rings.filter((r) => r.life > 0);

        if (this.fx.bloom) this.bloom();
        // the portrait camera eases after the player, never past the room's ends
        const want = Math.max(0, Math.min(BW - this.srcW, p.x * PX - this.srcW / 2));
        this.camX += (want - this.camX) * Math.min(1, dt * 6);
        if (Math.abs(want - this.camX) > BW / 2) this.camX = want;
        this.composite(dt, G);
    }

    composite(dt, G) {
        const { ctx, dpr } = this;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#05010f';
        ctx.fillRect(0, 0, this.w, this.h);

        this.shake = Math.max(0, this.shake - dt * 30);
        const sh = this.calm ? 0 : this.shake;
        const sx = this.ox + Math.round((Math.random() - 0.5) * sh * this.scale * 0.5);
        const sy = this.oy + Math.round((Math.random() - 0.5) * sh * this.scale * 0.5);

        // a magenta-to-cyan neon frame around the room
        const grd = ctx.createLinearGradient(sx, sy, sx + this.dw, sy + this.dh);
        grd.addColorStop(0, '#ff2bd6'); grd.addColorStop(1, '#2de2ff');
        ctx.fillStyle = grd;
        ctx.fillRect(sx - 3, sy - 3, this.dw + 6, this.dh + 6);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.buf, Math.round(this.camX), 0, this.srcW, BH, sx, sy, this.dw, this.dh);

        if (this.fx.scan) this.scanlines(ctx, sx, sy);
        if (this.fx.vignette) {
            const v = ctx.createRadialGradient(sx + this.dw / 2, sy + this.dh / 2, this.dh * 0.35, sx + this.dw / 2, sy + this.dh / 2, this.dw * 0.62);
            v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
            ctx.fillStyle = v;
            ctx.fillRect(sx, sy, this.dw, this.dh);
        }
        if (G) this.edgeArrows(ctx, sx, sy, G, this.t || 0);
        this.flashes(ctx, sx, sy, dt);
    }

    /** Bloom inside the 512×288 buffer: the buffer shrunk to half and quarter size with smoothing,
     *  added back with 'lighter'. Done at buffer resolution it costs almost nothing, and the glow
     *  is scaled up with the pixels — a soft but stepped 16-bit halo. (At screen resolution the
     *  same two passes took a software-rendered page from 60 fps to 13.) */
    bloom() {
        const b = this.b;
        const g1 = this.g1.getContext('2d'), g2 = this.g2.getContext('2d');
        g1.imageSmoothingEnabled = true; g2.imageSmoothingEnabled = true;
        g1.clearRect(0, 0, this.g1.width, this.g1.height);
        g1.drawImage(this.buf, 0, 0, this.g1.width, this.g1.height);
        g2.clearRect(0, 0, this.g2.width, this.g2.height);
        g2.drawImage(this.g1, 0, 0, this.g2.width, this.g2.height);
        b.imageSmoothingEnabled = true;
        b.globalCompositeOperation = 'lighter';
        b.globalAlpha = 0.4;
        b.drawImage(this.g1, 0, 0, BW, BH);
        b.globalAlpha = 0.55;
        b.drawImage(this.g2, -BW * 0.02, -BH * 0.02, BW * 1.04, BH * 1.04);
        b.globalCompositeOperation = 'source-over';
        b.globalAlpha = 1;
        b.imageSmoothingEnabled = false;
    }

    scanlines(ctx, sx, sy) {
        // one per buffer row when the pixels are big enough to carry them
        if (this.scale >= 1.5) {
            if (!this.scan) {
                const c = canvas(1, 3), g = c.getContext('2d');
                g.fillStyle = 'rgba(0,0,0,0.3)';
                g.fillRect(0, 2, 1, 1);
                this.scan = ctx.createPattern(c, 'repeat');
            }
            ctx.save();
            ctx.translate(sx, sy);
            ctx.fillStyle = this.scan;
            ctx.fillRect(0, 0, this.dw, this.dh);
            ctx.restore();
        }
    }

    /** Portrait only: little arrows on the edges for robots off camera, so nothing comes from nowhere. */
    edgeArrows(ctx, sx, sy, G, time) {
        if (this.srcW >= BW) return;
        const k = this.scale, l = this.camX, r = this.camX + this.srcW;
        const blink = ((time * 4) | 0) & 1;
        for (const o of [...G.robots, ...(G.grinner ? [{ ...G.grinner, kind: 'grinner' }] : [])]) {
            const bx = o.x * PX;
            if (bx >= l && bx <= r) continue;
            const left = bx < l, y = sy + o.y * PX * k;
            const x = left ? sx + 4 : sx + this.dw - 4;
            ctx.fillStyle = o.kind === 'grinner' ? (blink ? '#ffe14d' : '#ff2bd6') : (this.sprites.colors[o.kind] || '#fff');
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (left ? 9 : -9), y - 6);
            ctx.lineTo(x + (left ? 9 : -9), y + 6);
            ctx.fill();
        }
    }

    flashes(ctx, sx, sy, dt) {
        // full-screen flashes, never more than one per event and never strobing
        if (this.flash > 0) {
            ctx.globalAlpha = (this.calm ? 0.3 : 0.75) * this.flash;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx, sy, this.dw, this.dh);
            this.flash = Math.max(0, this.flash - dt * 2.5);
        }
        if (this.hurtFlash > 0) {
            ctx.globalAlpha = 0.3 * this.hurtFlash;
            ctx.fillStyle = '#ff0040';
            ctx.fillRect(sx, sy, this.dw, this.dh);
            this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);
        }
        ctx.globalAlpha = 1;
    }
}
