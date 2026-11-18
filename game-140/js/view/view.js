// The Canvas 2D view: reads G every frame and turns sim events into effects. Never changes G.
// The field is fitted to the window, letterboxed, and drawn at device resolution.

import { FIELD, PLAYER, PICKUP } from '../config.js';

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.flash = 0;
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
        // world units → CSS px, with a margin for the HUD
        this.scale = Math.min(w / (FIELD.w + 2), (h - 56) / (FIELD.h + 2));
        this.ox = (w - FIELD.w * this.scale) / 2;
        this.oy = 56 + (h - 56 - FIELD.h * this.scale) / 2;
    }

    /** Screen (client) px → world units, through the canvas's own rect. */
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
    }

    onEvents(G, events) {
        for (const e of events) if (e.type === 'pickup') this.flash = 1;
    }

    frame(G, dt, time) {
        this.resize();
        const { ctx, scale: s } = this;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = '#0b0d14';
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.translate(this.ox, this.oy);
        ctx.fillStyle = '#1d2440';
        ctx.fillRect(0, 0, FIELD.w * s, FIELD.h * s);

        ctx.fillStyle = '#ffcc4d';
        G.pickups.forEach((c, i) => {
            const r = PICKUP.radius * s * (1 + Math.sin(time * 4 + i) * 0.12);
            ctx.beginPath();
            ctx.moveTo(c.x * s, c.y * s - r); ctx.lineTo(c.x * s + r, c.y * s);
            ctx.lineTo(c.x * s, c.y * s + r); ctx.lineTo(c.x * s - r, c.y * s);
            ctx.fill();
        });

        this.flash = Math.max(0, this.flash - dt * 4);
        const p = G.player;
        ctx.fillStyle = '#6fe0ff';
        ctx.beginPath();
        ctx.arc(p.x * s, p.y * s, PLAYER.radius * s * (1 + this.flash * 0.3), 0, Math.PI * 2);
        ctx.fill();
    }
}
