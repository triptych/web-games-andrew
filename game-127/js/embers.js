// Drifting embers over the title and ending screens: a few dozen glowing motes on a transparent canvas.
// Decoration only; it reads nothing from the game.

export class Embers {
    constructor(canvas) {
        this.c = canvas;
        this.g = canvas.getContext('2d');
        this.on = false;
        this.alpha = 0;
        this.p = [];
        this.resize();
        for (let i = 0; i < 46; i++) this.p.push(this._spawn(true));
    }
    resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = this.c.getBoundingClientRect();
        this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
        this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
        this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    _spawn(any = false) {
        return {
            x: Math.random() * this.w, y: any ? Math.random() * this.h : this.h + 10,
            vy: 14 + Math.random() * 34, vx: -6 + Math.random() * 12, r: 0.8 + Math.random() * 2.4,
            ph: Math.random() * 6.28, life: 0.5 + Math.random() * 0.5,
        };
    }
    update(dt) {
        this.alpha += ((this.on ? 1 : 0) - this.alpha) * Math.min(1, dt * 2.5);
        const g = this.g;
        g.clearRect(0, 0, this.w, this.h);
        if (this.alpha < 0.02) return;
        g.globalCompositeOperation = 'lighter';
        for (const p of this.p) {
            p.ph += dt * 2;
            p.y -= p.vy * dt;
            p.x += (p.vx + Math.sin(p.ph) * 10) * dt;
            if (p.y < -10) Object.assign(p, this._spawn());
            const a = this.alpha * p.life * (0.55 + 0.45 * Math.sin(p.ph * 1.7)) * Math.min(1, p.y / (this.h * 0.25));
            const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
            grd.addColorStop(0, `rgba(255,214,140,${a})`);
            grd.addColorStop(0.4, `rgba(255,120,50,${a * 0.6})`);
            grd.addColorStop(1, 'rgba(255,80,20,0)');
            g.fillStyle = grd;
            g.beginPath(); g.arc(p.x, p.y, p.r * 4, 0, 6.283); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
    }
}
