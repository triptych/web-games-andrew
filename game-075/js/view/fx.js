// Particles, screen shake, flashes and floating score text. View-side only:
// it may use Math.random, because nothing here feeds back into the game.

const R = Math.random;

export class FX {
    constructor() {
        this.parts = [];
        this.texts = [];
        this.rings = [];
        this.trauma = 0;
        this.flashA = 0; this.flashC = '#fff';
        this.quality = 1;
        this.max = 900;
    }

    clear() { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; this.trauma = 0; this.flashA = 0; }

    shake(n) { this.trauma = Math.min(1, this.trauma + n); }
    flash(color, a = 0.6) { this.flashC = color; this.flashA = Math.max(this.flashA, a); }

    /** A burst of square sparks. */
    burst(x, y, color, n = 12, speed = 60, life = 0.6, size = 1.5) {
        n = Math.ceil(n * this.quality);
        for (let i = 0; i < n && this.parts.length < this.max; i++) {
            const a = R() * Math.PI * 2, s = speed * (0.3 + R() * 0.9);
            this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + R() * 0.7), max: life, color, size: size * (0.6 + R() * 0.8), drag: 2.5 });
        }
    }

    /** Pixel debris from a sprite: each lit pixel flies off. */
    shatter(img, x, y, flip, speed = 70) {
        const w = img.width, h = img.height;
        const g = img.getContext('2d');
        const data = g.getImageData(0, 0, w, h).data;
        const step = this.quality < 0.8 ? 2 : 1;
        for (let j = 0; j < h; j += step) for (let i = 0; i < w; i += step) {
            const k = (j * w + i) * 4;
            if (data[k + 3] < 128 || this.parts.length >= this.max) continue;
            const px = x + (flip ? w - 1 - i : i), py = y + j;
            const dx = px - (x + w / 2), dy = py - (y + h / 2);
            const l = Math.hypot(dx, dy) || 1;
            const s = speed * (0.4 + R() * 0.9);
            this.parts.push({ x: px, y: py, vx: dx / l * s + (R() - 0.5) * 20, vy: dy / l * s + (R() - 0.5) * 20, life: 0.6 + R() * 0.8, max: 1.4, color: `rgb(${data[k]},${data[k + 1]},${data[k + 2]})`, size: step, drag: 1.6, square: true });
        }
    }

    ring(x, y, color, r1 = 30, life = 0.45, width = 1.5) { this.rings.push({ x, y, color, r: 0, r1, life, max: life, width }); }

    text(x, y, str, color = '#fff') { this.texts.push({ x, y, str: String(str), color, life: 1.0, max: 1.0 }); }

    trail(x, y, color, n = 2, spread = 3) {
        for (let i = 0; i < n * this.quality && this.parts.length < this.max; i++) {
            this.parts.push({ x: x + (R() - 0.5) * spread, y: y + (R() - 0.5) * spread, vx: (R() - 0.5) * 10, vy: (R() - 0.5) * 10, life: 0.3, max: 0.3, color, size: 1, drag: 1 });
        }
    }

    update(dt) {
        for (const p of this.parts) {
            p.life -= dt;
            const d = Math.exp(-p.drag * dt);
            p.vx *= d; p.vy *= d;
            p.x += p.vx * dt; p.y += p.vy * dt;
        }
        this.parts = this.parts.filter((p) => p.life > 0);
        for (const t of this.texts) { t.life -= dt; t.y -= 14 * dt; }
        this.texts = this.texts.filter((t) => t.life > 0);
        for (const r of this.rings) { r.life -= dt; r.r = r.r1 * (1 - r.life / r.max); }
        this.rings = this.rings.filter((r) => r.life > 0);
        this.trauma = Math.max(0, this.trauma - dt * 1.6);
        this.flashA = Math.max(0, this.flashA - dt * 2.5);
    }

    offset(on) {
        if (!on || this.trauma <= 0) return [0, 0];
        const s = this.trauma * this.trauma * 6;
        return [(R() * 2 - 1) * s, (R() * 2 - 1) * s];
    }

    /** Draw in native coordinates (the caller's transform scales them). */
    draw(ctx, drawText) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.parts) {
            ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
            ctx.fillStyle = p.color;
            const s = p.size;
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
        for (const r of this.rings) {
            ctx.globalAlpha = r.life / r.max;
            ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        for (const t of this.texts) {
            ctx.globalAlpha = Math.min(1, t.life * 2);
            drawText(ctx, t.str, t.x, t.y, t.color, { align: 'center', shadow: '#000' });
        }
        ctx.globalAlpha = 1;
    }
}
