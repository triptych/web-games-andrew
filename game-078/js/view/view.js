// The Canvas 2D view: reads G every frame and turns sim events into effects. Never changes G.
// The jar is fitted to the window under the HUD, with the merge ladder beside it (landscape)
// or under it (portrait). Everything is drawn at device resolution; treats are baked into
// sprites once per size and rotated with drawImage.

import { JAR, ITEMS, DANGER } from '../config.js';
import { landing, bodyRadius } from '../sim/game.js';
import { drawTreat, TREAT_COLORS } from './items.js';

const TAU = Math.PI * 2;
// the world box drawn around the jar: room for the hook above, the glass at the sides and bottom
const BOX = { x0: -0.55, x1: JAR.w + 0.55, y0: -1.0, y1: JAR.h + 0.55 };
const HUD_H = 62;

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.parts = [];
        this.texts = [];
        this.shake = 0;
        this.flash = 0;
        this.snowOn = true;
        this.sprites = [];
        this.spriteScale = 0;
        this.flakes = [];
        for (let i = 0; i < 90; i++) this.flakes.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 2.2, v: 0.02 + Math.random() * 0.05, p: Math.random() * TAU });
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

        const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
        const top = HUD_H + 4;
        this.landscape = w / h > 0.9;
        let availW, availH;
        if (this.landscape) { availW = w - 2 * 76 - 16; availH = h - top - 10; }
        else { availW = w - 12; availH = h - top - 56; }
        this.scale = Math.max(4, Math.min(availW / bw, availH / bh));
        const s = this.scale;
        this.ox = Math.round((w - bw * s) / 2 - BOX.x0 * s);
        this.oy = Math.round(top + (availH - bh * s) / 2 - BOX.y0 * s);
        // the merge ladder
        const icon = Math.max(18, Math.min(40, this.landscape ? (bh * s) / 12.5 : (w - 16) / 11.6));
        this.ladder = { icon, landscape: this.landscape };
        if (this.landscape) {
            this.ladder.x = this.ox + (BOX.x1 + 0.3) * s + icon * 0.8;
            this.ladder.y = this.oy + BOX.y1 * s - icon * 0.6;
        } else {
            this.ladder.x = (w - icon * 11 - 10 * 2) / 2 + icon / 2;
            this.ladder.y = Math.min(h - icon * 0.7 - 6, this.oy + BOX.y1 * s + icon * 0.75 + 4);
        }
        this.bg = null;
    }

    /** Screen (client) px → world units, through the canvas's own rect. */
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
    }

    /** The jar's glass in client px, for the tests. */
    jarRect() {
        const r = this.canvas.getBoundingClientRect();
        return { left: r.left + this.ox, top: r.top + this.oy, right: r.left + this.ox + JAR.w * this.scale, bottom: r.top + this.oy + JAR.h * this.scale };
    }

    // ------------------------------------------------------------------ sprites
    sprite(tier) {
        const px = this.scale * this.dpr;
        if (this.spriteScale !== px) { this.sprites = []; this.spriteScale = px; }
        let sp = this.sprites[tier];
        if (!sp) {
            const R = ITEMS[tier].r * px;
            const size = Math.ceil(R * 2.24) + 4;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const ctx = c.getContext('2d');
            ctx.translate(size / 2, size / 2);
            drawTreat(ctx, tier, R);
            sp = this.sprites[tier] = { c, size: size / this.dpr, R: ITEMS[tier].r * this.scale };
        }
        return sp;
    }

    /** A treat baked at a fixed size in px (the merge ladder), whatever its size in the jar. */
    iconSprite(tier, rPx) {
        const key = Math.round(rPx * this.dpr);
        if (this.iconKey !== key) { this.icons = []; this.iconKey = key; }
        if (!this.icons[tier]) {
            const size = Math.ceil(key * 2.24) + 4;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const ctx = c.getContext('2d');
            ctx.translate(size / 2, size / 2);
            drawTreat(ctx, tier, key);
            this.icons[tier] = { c, size: size / this.dpr };
        }
        return this.icons[tier];
    }

    drawSprite(ctx, tier, x, y, rPx, angle = 0) {
        const sp = this.sprite(tier);
        const k = rPx / sp.R;
        ctx.save();
        ctx.translate(x, y);
        if (angle) ctx.rotate(angle);
        ctx.drawImage(sp.c, (-sp.size / 2) * k, (-sp.size / 2) * k, sp.size * k, sp.size * k);
        ctx.restore();
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'merge' || e.type === 'miracle') {
                const tier = e.type === 'miracle' ? 10 : e.tier;
                const n = 10 + tier * 3;
                const col = TREAT_COLORS[tier];
                for (let i = 0; i < n; i++) {
                    const a = Math.random() * TAU, v = (2 + Math.random() * 5) * (1 + tier * 0.12);
                    this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 0, max: 0.5 + Math.random() * 0.5, size: 0.06 + Math.random() * 0.1, col: i % 3 ? col : '#ffffff', star: i % 4 === 0 });
                }
                this.parts.push({ ring: true, x: e.x, y: e.y, life: 0, max: 0.4, r0: ITEMS[Math.min(tier, 10)].r, col });
                const label = e.type === 'miracle' ? `Christmas Miracle! +${e.pts}` : `+${e.pts}`;
                this.texts.push({ x: e.x, y: e.y - (ITEMS[tier].r + 0.2), text: label, life: 0, max: e.type === 'miracle' ? 2.2 : 0.9, big: e.type === 'miracle' || tier >= 7 });
                if (e.chain > 1) this.texts.push({ x: e.x, y: e.y - ITEMS[tier].r + 0.45, text: `Chain ×${e.chain}`, life: 0, max: 1.0, chain: true });
                if (tier >= 6) this.shake = Math.min(1, this.shake + 0.15 + (tier - 6) * 0.08);
                if (e.type === 'miracle') { this.flash = 1; this.shake = 1; }
            } else if (e.type === 'drop') {
                for (let i = 0; i < 5; i++) {
                    this.parts.push({ x: e.x + (Math.random() - 0.5) * 0.6, y: JAR.dropY, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 0, max: 0.35, size: 0.05, col: '#ffffff' });
                }
            }
        }
        if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
        if (this.texts.length > 8) this.texts.splice(0, this.texts.length - 8);
    }

    // ------------------------------------------------------------------ the frame
    frame(G, dt, time) {
        this.resize();
        const { ctx, scale: s } = this;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.drawBackground(ctx);
        if (this.snowOn) this.drawSnow(ctx, dt, time);
        this.drawLights(ctx, time);

        this.shake = Math.max(0, this.shake - dt * 2.5);
        const sx = this.shake ? (Math.random() - 0.5) * this.shake * 6 : 0;
        const sy = this.shake ? (Math.random() - 0.5) * this.shake * 6 : 0;
        ctx.save();
        ctx.translate(this.ox + sx, this.oy + sy);

        this.drawJarBack(ctx);
        this.drawLine(ctx, G, time);
        this.drawDropper(ctx, G, time);
        for (const b of G.bodies) {
            const r = bodyRadius(b);
            const pop = b.grow < 1 ? 1 + Math.sin(b.grow * Math.PI) * 0.12 : 1;
            this.drawSprite(ctx, b.tier, b.x * s, b.y * s, r * s * pop, b.a);
        }
        this.drawJarFront(ctx);
        this.drawParticles(ctx, dt);
        ctx.restore();

        this.drawLadder(ctx, G);
        // danger vignette and miracle flash
        const dz = Math.min(1, G.danger / DANGER.limit);
        if (dz > 0) {
            const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
            g.addColorStop(0, 'rgba(255,0,30,0)');
            g.addColorStop(1, `rgba(255,20,50,${0.18 + dz * 0.35 * (0.6 + 0.4 * Math.sin(time * 10))})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, this.w, this.h);
        }
        if (this.flash > 0) {
            this.flash = Math.max(0, this.flash - dt * 1.5);
            ctx.fillStyle = `rgba(255,236,160,${this.flash * 0.5})`;
            ctx.fillRect(0, 0, this.w, this.h);
        }
    }

    drawBackground(ctx) {
        if (!this.bg) {
            const c = document.createElement('canvas');
            c.width = this.canvas.width; c.height = this.canvas.height;
            const b = c.getContext('2d');
            b.scale(this.dpr, this.dpr);
            const w = this.w, h = this.h;
            const sky = b.createLinearGradient(0, 0, 0, h);
            sky.addColorStop(0, '#141a38');
            sky.addColorStop(0.55, '#2c3a72');
            sky.addColorStop(1, '#5a6fae');
            b.fillStyle = sky;
            b.fillRect(0, 0, w, h);
            // stars
            for (let i = 0; i < 120; i++) {
                const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * w, y = (Math.sin(i * 37.3) * 0.5 + 0.5) * h * 0.6;
                b.fillStyle = `rgba(255,255,240,${0.25 + (i % 5) * 0.12})`;
                b.fillRect(x, y, 1.2 + (i % 3) * 0.5, 1.2 + (i % 3) * 0.5);
            }
            // moon
            const mx = w * 0.82, my = h * 0.16, mr = Math.min(w, h) * 0.06;
            const mg = b.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 3);
            mg.addColorStop(0, 'rgba(255,250,220,0.35)');
            mg.addColorStop(1, 'rgba(255,250,220,0)');
            b.fillStyle = mg;
            b.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
            b.beginPath(); b.arc(mx, my, mr, 0, TAU); b.fillStyle = '#fff8dc'; b.fill();
            // snowy hills with pines
            const hill = (base, amp, col, seed) => {
                b.beginPath();
                b.moveTo(0, h);
                for (let x = 0; x <= w; x += 8) b.lineTo(x, base + Math.sin(x * 0.006 + seed) * amp + Math.sin(x * 0.017 + seed * 2) * amp * 0.4);
                b.lineTo(w, h);
                b.closePath();
                b.fillStyle = col;
                b.fill();
            };
            hill(h * 0.72, h * 0.04, '#9fb4dc', 1);
            for (let i = 0; i < 26; i++) {
                const x = ((i * 137) % 100) / 100 * w, y = h * 0.74 + Math.sin(x * 0.006 + 1) * h * 0.04;
                const t = 14 + (i % 4) * 6;
                b.fillStyle = '#25456b';
                b.beginPath(); b.moveTo(x, y - t * 2); b.lineTo(x + t * 0.6, y); b.lineTo(x - t * 0.6, y); b.fill();
                b.fillStyle = 'rgba(255,255,255,0.8)';
                b.beginPath(); b.moveTo(x, y - t * 2); b.lineTo(x + t * 0.22, y - t * 1.3); b.lineTo(x - t * 0.22, y - t * 1.3); b.fill();
            }
            hill(h * 0.84, h * 0.03, '#d9e6f7', 3);
            // a warm cabin window glow on the far hill
            b.fillStyle = 'rgba(255,200,110,0.9)';
            b.fillRect(w * 0.12, h * 0.705, 8, 6);
            this.bg = c;
        }
        ctx.drawImage(this.bg, 0, 0, this.w, this.h);
    }

    drawSnow(ctx, dt, time) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const f of this.flakes) {
            f.y += f.v * dt;
            if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
            const x = (f.x + Math.sin(time * 0.6 + f.p) * 0.01) * this.w, y = f.y * this.h;
            ctx.beginPath();
            ctx.arc(x, y, f.s, 0, TAU);
            ctx.fill();
        }
    }

    drawLights(ctx, time) {
        const n = Math.max(8, Math.round(this.w / 46));
        const cols = ['#ff4d5e', '#ffd23f', '#3fcf7f', '#5fb0ff', '#ff7fc0'];
        ctx.strokeStyle = '#1d2a1d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const x = (i / n) * this.w;
            const y = 4 + Math.sin((i / n) * Math.PI * 6) * 2 + 10;
            if (i === 0) ctx.moveTo(x, y); else ctx.quadraticCurveTo(x - this.w / n / 2, y + 12, x, y);
        }
        ctx.stroke();
        for (let i = 0; i < n; i++) {
            const x = ((i + 0.5) / n) * this.w, y = 24 + Math.sin(((i + 0.5) / n) * Math.PI * 6) * 2;
            const on = 0.55 + 0.45 * Math.sin(time * 2 + i * 1.7);
            const col = cols[i % cols.length];
            ctx.globalAlpha = 0.25 * on;
            ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fillStyle = col; ctx.fill();
            ctx.globalAlpha = 0.6 + 0.4 * on;
            ctx.beginPath(); ctx.ellipse(x, y, 3.2, 4.6, 0, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    drawJarBack(ctx) {
        const s = this.scale, W = JAR.w * s, H = JAR.h * s;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, H - s * 0.5); ctx.quadraticCurveTo(0, H, s * 0.5, H);
        ctx.lineTo(W - s * 0.5, H); ctx.quadraticCurveTo(W, H, W, H - s * 0.5); ctx.lineTo(W, 0);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(210,235,255,0.20)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
        g.addColorStop(1, 'rgba(210,235,255,0.20)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
    }

    drawJarFront(ctx) {
        const s = this.scale, W = JAR.w * s, H = JAR.h * s, t = Math.max(3, s * 0.22);
        ctx.save();
        // glass walls
        ctx.lineWidth = t;
        ctx.strokeStyle = 'rgba(225,242,255,0.55)';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-t / 2, -s * 0.1); ctx.lineTo(-t / 2, H - s * 0.4); ctx.quadraticCurveTo(-t / 2, H + t / 2, s * 0.4, H + t / 2);
        ctx.lineTo(W - s * 0.4, H + t / 2); ctx.quadraticCurveTo(W + t / 2, H + t / 2, W + t / 2, H - s * 0.4); ctx.lineTo(W + t / 2, -s * 0.1);
        ctx.stroke();
        // shine streaks
        ctx.lineWidth = Math.max(2, s * 0.1);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.moveTo(s * 0.35, s * 0.8); ctx.lineTo(s * 0.35, H * 0.55); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.moveTo(W - s * 0.35, s * 1.4); ctx.lineTo(W - s * 0.35, H * 0.35); ctx.stroke();
        // rim, with a ribbon
        for (const x of [-t / 2, W + t / 2]) {
            ctx.beginPath();
            ctx.ellipse(x, -s * 0.12, t * 0.9, t * 0.6, 0, 0, TAU);
            ctx.fillStyle = 'rgba(240,250,255,0.85)';
            ctx.fill();
        }
        ctx.fillStyle = '#e8394a';
        ctx.strokeStyle = '#9e1f2e';
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.translate(-t / 2, s * 0.35);
        for (const k of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(k * s * 0.32, 0, s * 0.32, s * 0.18, k * 0.35, 0, TAU);
            ctx.fill(); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(k * s * 0.22, s * 0.6); ctx.lineTo(k * s * 0.38, s * 0.52); ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(0, 0, s * 0.11, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    drawLine(ctx, G, time) {
        const s = this.scale, W = JAR.w * s, y = JAR.line * s;
        const dz = Math.min(1, G.danger / DANGER.limit);
        const seg = Math.max(6, s * 0.4);
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.6 * dz * (0.5 + 0.5 * Math.sin(time * 12)) + (G.danger > 0 ? 0.2 : 0);
        ctx.lineWidth = Math.max(2, s * 0.1);
        for (let x = 0, i = 0; x < W; x += seg, i++) {
            ctx.strokeStyle = i % 2 ? '#ffffff' : '#ff3048';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(Math.min(W, x + seg), y);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawDropper(ctx, G, time) {
        const s = this.scale, d = G.dropper;
        const r = ITEMS[d.tier].r;
        const x = d.x * s, y = JAR.dropY * s;
        if (G.over) return;
        // candy-cane hook from above
        const hookTop = BOX.y0 * s + 4, hookBot = y - r * s - s * 0.05;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(4, s * 0.2);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, hookBot);
        ctx.lineTo(x, hookTop + s * 0.3);
        ctx.arc(x - s * 0.28, hookTop + s * 0.3, s * 0.28, 0, Math.PI, true);
        ctx.stroke();
        ctx.setLineDash([Math.max(3, s * 0.14), Math.max(3, s * 0.14)]);
        ctx.strokeStyle = '#e22a3d';
        ctx.stroke();
        ctx.restore();
        // the guide
        const ready = d.cool <= 0;
        const land = landing(G, d.x, r);
        if (land.y > JAR.dropY) {
            ctx.save();
            ctx.setLineDash([2, Math.max(5, s * 0.25)]);
            ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(2, s * 0.07);
            ctx.strokeStyle = ready ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.moveTo(x, y + r * s);
            ctx.lineTo(x, land.y * s + r * s);
            ctx.stroke();
            ctx.restore();
        }
        // the treat, popping in once the cooldown is over
        const k = ready ? 1 : Math.max(0.15, 1 - d.cool / 0.5);
        ctx.globalAlpha = ready ? 1 : 0.6;
        this.drawSprite(ctx, d.tier, x, y, r * s * k, Math.sin(time * 2) * 0.08);
        ctx.globalAlpha = 1;
    }

    drawParticles(ctx, dt) {
        const s = this.scale;
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.life += dt;
            if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
            const k = 1 - p.life / p.max;
            if (p.ring) {
                ctx.beginPath();
                ctx.arc(p.x * s, p.y * s, (p.r0 * (1 + (1 - k) * 0.8)) * s, 0, TAU);
                ctx.lineWidth = Math.max(1, s * 0.12 * k);
                ctx.strokeStyle = `rgba(255,255,255,${k * 0.8})`;
                ctx.stroke();
                continue;
            }
            p.vy += 9 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            ctx.globalAlpha = k;
            ctx.fillStyle = p.col;
            const sz = p.size * s;
            if (p.star) {
                ctx.save();
                ctx.translate(p.x * s, p.y * s);
                ctx.rotate(p.life * 6);
                ctx.fillRect(-sz * 1.4, -sz * 0.3, sz * 2.8, sz * 0.6);
                ctx.fillRect(-sz * 0.3, -sz * 1.4, sz * 0.6, sz * 2.8);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(p.x * s, p.y * s, sz, 0, TAU);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        // floating text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life += dt;
            if (t.life >= t.max) { this.texts.splice(i, 1); continue; }
            const k = t.life / t.max;
            const size = t.big ? Math.max(18, s * 0.75) : Math.max(13, s * 0.48);
            ctx.font = `700 ${size}px Fredoka, 'Trebuchet MS', system-ui, sans-serif`;
            ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
            const x = Math.max(size * 2, Math.min(JAR.w * s - size * 2, t.x * s));
            const y = (t.y - k * 0.9) * s;
            ctx.lineWidth = Math.max(3, size * 0.2);
            ctx.strokeStyle = 'rgba(60,10,25,0.85)';
            ctx.strokeText(t.text, x, y);
            ctx.fillStyle = t.chain ? '#7dffc5' : t.big ? '#ffe066' : '#ffffff';
            ctx.fillText(t.text, x, y);
        }
        ctx.globalAlpha = 1;
    }

    drawLadder(ctx, G) {
        const L = this.ladder, n = ITEMS.length;
        for (let i = 0; i < n; i++) {
            const x = L.landscape ? L.x : L.x + i * (L.icon + 2);
            const y = L.landscape ? L.y - i * (L.icon + 2) : L.y;
            const made = i <= G.topTier || i < 5;
            ctx.globalAlpha = made ? 1 : 0.28;
            ctx.beginPath();
            ctx.arc(x, y, L.icon * 0.52, 0, TAU);
            ctx.fillStyle = 'rgba(16,22,48,0.55)';
            ctx.fill();
            if (i === G.topTier && G.topTier >= 5) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffd23f';
                ctx.stroke();
            }
            const ic = this.iconSprite(i, L.icon * 0.46);
            ctx.drawImage(ic.c, x - ic.size / 2, y - ic.size / 2, ic.size, ic.size);
        }
        ctx.globalAlpha = 1;
    }
}
