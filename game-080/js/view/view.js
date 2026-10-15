// The view: a small pixel canvas scaled up crisp to fill the window, showing either the world or
// a battle. It reads G and answers sim events with effects; it never writes G.
// The canvas is sized in px from visualViewport (never 100vw / 100vh: on phones 100vh is taller
// than what you can see, and taps would land below the finger).

import { TILE } from '../config.js';
import { getWorld } from '../sim/worldgen.js';
import { GRIMOIRE } from '../sim/data/books.js';
import { WorldView } from './world.js';
import { BattleView } from './battle.js';

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.world = new WorldView();
        this.battle = new BattleView();
        this.fade = 0;
        this.flash = 0;
        this.flashCol = '#ffffff';
        this.shake = 0;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        // about 13 tiles across the short side, at a whole-number pixel scale
        const s = Math.max(2, Math.floor(Math.min(w, h) / 205));
        this.scale = s;
        this.vw = Math.ceil(w / s);
        this.vh = Math.ceil(h / s);
        this.canvas.width = this.vw;
        this.canvas.height = this.vh;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.imageSmoothingEnabled = false;
    }

    /** Pixel-canvas coordinates → CSS px on screen (for the DOM overlays). */
    toScreen(x, y) {
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + x * r.width / this.vw, y: r.top + y * r.height / this.vh };
    }
    /** World tile coordinates → CSS px. */
    tileToScreen(tx, ty) { return this.toScreen(this.world.ox + tx * TILE, this.world.oy + ty * TILE); }
    wickScreen() { const w = this.world.wickScreen; return w ? this.toScreen(w.x, w.y) : null; }
    foeScreen(n) { const p = this.battle.foePos(n, this.vw, this.vh); return { ...this.toScreen(p.x, p.y - p.s / 2), size: p.s * this.scale }; }
    youScreen() { const p = this.battle.youPos(this.vw, this.vh); return this.toScreen(p.x, p.y - 20); }

    onEvents(G, events) {
        const M = getWorld().maps[G.map];
        for (const e of events) {
            switch (e.type) {
                case 'warpStart': this.fadeDir = 1; break;
                case 'warp': this.fadeDir = -1; this.fade = 1; break;
                case 'b_start': this.battle.begin(G, M); this.flash = 0.5; this.flashCol = '#ffffff'; break;
                case 'power': {
                    const col = GRIMOIRE[e.book]?.colour || '#ffffff';
                    for (const [x, y] of e.tiles.slice(0, 24)) this.world.burst(x + 0.5, y + 0.5, col, 6, 2.2);
                    this.flash = 0.25; this.flashCol = col;
                    break;
                }
                case 'chest': this.world.burst(e.x + 0.5, e.y + 0.3, '#ffe08a', 18, 2.6); break;
                case 'unlock': this.world.burst(e.x + 0.5, e.y + 0.5, '#e8c040', 14, 2); break;
                case 'levelUp': this.world.burst(G.p.x, G.p.y - 1, '#fff4c0', 24, 3); break;
                case 'restore': this.flash = 0.6; this.flashCol = GRIMOIRE[e.id].colour; this.world.burst(G.p.x, G.p.y - 1, GRIMOIRE[e.id].colour, 30, 3.5); break;
                case 'rest': this.flash = 0.5; this.flashCol = '#fff4c0'; break;
                case 'shelve': this.world.burst(G.p.x, G.p.y - 1, '#c8a060', 20, 2.4); break;
                case 'ending': this.flash = 1.2; this.flashCol = '#ffffff'; break;
                case 'overwhelmed': this.flash = 0.6; this.flashCol = '#ffe0c0'; break;
                default: break;
            }
        }
    }

    frame(G, dt, opts = {}) {
        this.resize();
        const ctx = this.ctx;
        const { vw, vh } = this;
        if (G.mode === 'battle' && this.battle.disp) {
            this.battle.draw(ctx, vw, vh, dt);
        } else {
            if (this.battle.disp && G.mode !== 'battle') this.battle.end();
            const M = getWorld().maps[G.map];
            this.world.draw(ctx, G, vw, vh, dt, { map: M, shake: this.shake > 0 ? 2 : 0 });
        }
        if (this.shake > 0) this.shake -= dt;
        // warp fade
        if (this.fadeDir === 1) this.fade = Math.min(1, this.fade + dt / 0.3);
        else if (this.fadeDir === -1) { this.fade = Math.max(0, this.fade - dt / 0.35); if (!this.fade) this.fadeDir = 0; }
        if (G.fade && G.fade.t < 0.32) this.fade = Math.max(this.fade, G.fade.t / 0.32);
        if (this.fade > 0) { ctx.fillStyle = `rgba(14,10,18,${this.fade.toFixed(3)})`; ctx.fillRect(0, 0, vw, vh); }
        if (this.flash > 0) {
            ctx.globalAlpha = Math.min(0.7, this.flash);
            ctx.fillStyle = this.flashCol;
            ctx.fillRect(0, 0, vw, vh);
            ctx.globalAlpha = 1;
            this.flash -= dt * 1.6;
        }
        if (opts.dim) { ctx.fillStyle = `rgba(14,10,24,${opts.dim})`; ctx.fillRect(0, 0, vw, vh); }
    }
}
