// Explosions and other eye candy: palette-cycling fireballs, shockwave rings, pixel debris, score
// popups, screen shake and flash, and the scrolling starfield. All of it is view-only: it answers
// sim events, may use Math.random (effects are not part of the game), and never touches G.
//
// An explosion is built in layers so it reads as colourful at any size: a fireball whose colour walks
// down a ramp (white → yellow → orange → red → dark), a ring that races outward, debris that cools as
// it flies, and a few delayed secondary pops.

import { FIELD } from '../config.js';
import { drawText } from './font.js';

const W = FIELD.w, H = FIELD.h;
const R = Math.random;

/** Colour ramps from white-hot to cold. */
export const RAMPS = {
    fire:    ['#ffffff', '#ffec27', '#ffa300', '#ff004d', '#7e2553', '#1d2b53'],
    ice:     ['#ffffff', '#b4f0ff', '#29adff', '#1d5fd1', '#4a1fa0', '#1d2b53'],
    toxic:   ['#ffffff', '#d8ffb0', '#4cdc4c', '#1a9a3a', '#0b5a24', '#102a2a'],
    plasma:  ['#ffffff', '#ecb8ff', '#b04dff', '#ff5ec8', '#7a24c8', '#1d2b53'],
    gold:    ['#ffffff', '#fff6a0', '#ffc400', '#e07800', '#a02000', '#2a1230'],
    rainbow: ['#ff004d', '#ff8a00', '#ffec27', '#4cdc4c', '#29e5ff', '#b04dff'],
};
// the colour family of the thing that blew up (TYPES[..].c) → its main ramp
const FAMILY = ['ice', 'toxic', 'gold', 'plasma', 'fire', 'fire', 'ice'];

const pick = (a) => a[(R() * a.length) | 0];
const ramp = (c) => RAMPS[FAMILY[c] ?? 'fire'];

/** A filled disc, drawn as pixel rows so its edge stays crisp. */
export function disc(g, cx, cy, r, color) {
    g.fillStyle = color;
    const ri = Math.round(r);
    for (let dy = -ri; dy <= ri; dy++) {
        const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
        g.fillRect(Math.round(cx) - hw, Math.round(cy) + dy, hw * 2 + 1, 1);
    }
}

/** A ring of thickness t. */
export function ring(g, cx, cy, r, t, color) {
    g.fillStyle = color;
    const ro = Math.round(r), ri = Math.max(0, r - t);
    for (let dy = -ro; dy <= ro; dy++) {
        const ho = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
        const inside = Math.abs(dy) < ri ? Math.round(Math.sqrt(Math.max(0, ri * ri - dy * dy))) : -1;
        const y = Math.round(cy) + dy, x = Math.round(cx);
        if (inside < 0) g.fillRect(x - ho, y, ho * 2 + 1, 1);
        else { g.fillRect(x - ho, y, ho - inside, 1); g.fillRect(x + inside + 1, y, ho - inside, 1); }
    }
}

export class Fx {
    constructor() {
        this.parts = [];                       // debris and sparks
        this.balls = [];                       // fireballs
        this.rings = [];                       // shockwaves
        this.pops = [];                        // score popups
        this.timers = [];                      // delayed secondary effects
        this.trail = [];                       // engine sparks
        this.shake = 0;
        this.flash = 0;
        this.flashColor = '#ffffff';
        this.calm = false;                     // reduced flashes, shake and particles
        this.lastFlash = -9;
        this.t = 0;
    }

    reset() { this.parts.length = this.balls.length = this.rings.length = this.pops.length = this.timers.length = 0; this.shake = this.flash = 0; }

    kick(amount) { this.shake = Math.max(this.shake, this.calm ? amount * 0.25 : amount); }
    /** A white-ish flash over the whole screen; never more than twice a second, never in calm mode. */
    flashScreen(a, color = '#ffffff') {
        if (this.calm || this.t - this.lastFlash < 0.5) return;
        this.lastFlash = this.t;
        this.flash = Math.max(this.flash, Math.min(a, 0.4));
        this.flashColor = color;
    }

    // ------------------------------------------------------------------ building blocks
    ball(x, y, r, life, rmp, delay = 0) { if (this.balls.length < 80) this.balls.push({ x, y, r, life, t: -delay, ramp: rmp }); }
    shock(x, y, r, life, rmp, thick = 2, delay = 0) { if (this.rings.length < 40) this.rings.push({ x, y, r, life, t: -delay, ramp: rmp, thick }); }
    debris(x, y, n, speed, life, rmp, grav = 0) {
        n = this.calm ? Math.ceil(n * 0.6) : n;
        for (let i = 0; i < n && this.parts.length < 1100; i++) {
            const a = R() * Math.PI * 2, s = speed * (0.25 + R() * 0.95);
            this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + R() * 0.7), t: 0, ramp: rmp, size: R() < 0.3 ? 2 : 1, grav, drag: 1.6 });
        }
    }
    later(delay, fn) { this.timers.push({ t: -delay, fn }); }

    // ------------------------------------------------------------------ explosions
    /** size 0 small … 3 huge; c is the colour family of whatever blew up. */
    boom(x, y, size, c = 0) {
        const main = ramp(c), alt = R() < 0.35 ? RAMPS[pick(['fire', 'gold', 'plasma', 'ice'])] : main;
        if (size === 0) {
            this.ball(x, y, 7, 0.3, main);
            this.debris(x, y, 9, 70, 0.5, alt);
            this.shock(x, y, 13, 0.22, alt, 1);
        } else if (size === 1) {
            this.ball(x, y, 11, 0.4, main);
            this.ball(x + (R() - 0.5) * 8, y + (R() - 0.5) * 8, 7, 0.34, alt, 0.06);
            this.debris(x, y, 16, 85, 0.6, alt);
            this.debris(x, y, 6, 50, 0.7, RAMPS.fire);
            this.shock(x, y, 22, 0.32, main, 2);
        } else if (size === 2) {
            this.ball(x, y, 17, 0.5, main);
            for (let i = 0; i < 4; i++) this.ball(x + (R() - 0.5) * 22, y + (R() - 0.5) * 22, 7 + R() * 5, 0.38, i & 1 ? alt : main, 0.05 + i * 0.07);
            this.debris(x, y, 30, 110, 0.75, alt);
            this.debris(x, y, 12, 60, 0.9, RAMPS.rainbow);
            this.shock(x, y, 34, 0.4, main, 2);
            this.shock(x, y, 48, 0.5, alt, 1, 0.08);
            this.kick(1.5);
        } else {
            this.ball(x, y, 30, 0.7, RAMPS.fire);
            for (let i = 0; i < 7; i++) this.ball(x + (R() - 0.5) * 50, y + (R() - 0.5) * 36, 9 + R() * 8, 0.5, pick([RAMPS.fire, RAMPS.gold, RAMPS.plasma, RAMPS.ice]), 0.04 + i * 0.06);
            this.debris(x, y, 70, 150, 1.1, RAMPS.rainbow);
            this.debris(x, y, 40, 100, 1.2, RAMPS.fire);
            this.shock(x, y, 80, 0.7, RAMPS.rainbow, 3);
            this.shock(x, y, 110, 0.9, RAMPS.fire, 2, 0.1);
            this.shock(x, y, 140, 1.1, RAMPS.plasma, 2, 0.22);
            this.kick(5);
            this.flashScreen(0.35, '#fff6a0');
        }
    }

    /** The player's ship coming apart. */
    shipDeath(x, y) {
        this.ball(x, y, 18, 0.55, RAMPS.ice);
        this.ball(x, y, 12, 0.45, RAMPS.fire, 0.05);
        this.debris(x, y, 36, 120, 0.9, RAMPS.ice, 0);
        this.debris(x, y, 18, 90, 1.0, RAMPS.fire);
        this.shock(x, y, 40, 0.5, RAMPS.ice, 2);
        this.shock(x, y, 64, 0.7, RAMPS.fire, 1, 0.1);
        this.kick(4);
        this.flashScreen(0.3, '#ffffff');
    }

    hit(x, y, boss = false) {
        const n = boss ? 3 : 2;
        for (let i = 0; i < n && this.parts.length < 1100; i++) {
            const a = -Math.PI / 2 + (R() - 0.5) * 2.4, s = 30 + R() * 50;
            this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25, t: 0, ramp: RAMPS.gold, size: 1, grav: 0, drag: 2 });
        }
    }

    /** A bullet shot down by a bomb or a death: a tiny gold twinkle. */
    cancel(x, y) {
        if (this.parts.length > 900) return;
        this.parts.push({ x, y, vx: (R() - 0.5) * 24, vy: (R() - 0.5) * 24, life: 0.35, t: 0, ramp: RAMPS.gold, size: 1, grav: 0, drag: 2 });
    }

    pickup(x, y, color) {
        const rp = color ? ['#ffffff', color, color, '#1d2b53'] : RAMPS.gold;
        this.shock(x, y, 16, 0.3, rp, 1);
        this.debris(x, y, 10, 55, 0.5, rp);
    }

    bomb(x, y) {
        this.kick(3);
        this.flashScreen(0.3, '#ffffff');
        this.debris(x, y, 24, 120, 0.7, RAMPS.rainbow);
    }

    popup(x, y, text, color = '#ffffff') {
        if (this.pops.length > 30) this.pops.shift();
        this.pops.push({ x: Math.max(14, Math.min(W - 14, x)), y, text, color, t: 0 });
    }

    // ------------------------------------------------------------------ update and draw
    update(dt) {
        this.t += dt;
        for (const q of this.timers) { q.t += dt; if (q.t >= 0 && !q.done) { q.done = true; q.fn(); } }
        this.timers = this.timers.filter((q) => !q.done);
        for (const p of this.parts) {
            p.t += dt;
            p.vy += p.grav * dt;
            const k = Math.max(0, 1 - p.drag * dt);
            p.vx *= k; p.vy *= k;
            p.x += p.vx * dt; p.y += p.vy * dt;
        }
        this.parts = this.parts.filter((p) => p.t < p.life);
        for (const b of this.balls) b.t += dt;
        this.balls = this.balls.filter((b) => b.t < b.life);
        for (const r of this.rings) r.t += dt;
        this.rings = this.rings.filter((r) => r.t < r.life);
        for (const p of this.pops) p.t += dt;
        this.pops = this.pops.filter((p) => p.t < 0.9);
        this.shake = Math.max(0, this.shake - dt * 14);
        this.flash = Math.max(0, this.flash - dt * 1.6);
    }

    draw(g) {
        // fireballs: an outer, cooler disc with a hotter core, walking down the ramp as they age
        for (const b of this.balls) {
            if (b.t < 0) continue;
            const u = b.t / b.life, n = b.ramp.length - 1;
            const r = b.r * (0.35 + 0.65 * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2)) * (u > 0.7 ? 1 - (u - 0.7) * 1.4 : 1);
            const i = Math.min(n, Math.floor(u * n * 1.05));
            disc(g, b.x, b.y, r, b.ramp[Math.min(n, i + 1)]);
            disc(g, b.x, b.y, r * 0.66, b.ramp[i]);
            if (u < 0.5) disc(g, b.x, b.y, r * 0.3, b.ramp[0]);
        }
        for (const r of this.rings) {
            if (r.t < 0) continue;
            const u = r.t / r.life, n = r.ramp.length - 1;
            ring(g, r.x, r.y, r.r * (1 - (1 - u) * (1 - u)), r.thick, r.ramp[Math.min(n, Math.floor(u * n))]);
        }
        for (const p of this.parts) {
            const u = p.t / p.life, n = p.ramp.length - 1;
            g.fillStyle = p.ramp[Math.min(n, Math.floor(u * n * 1.2))];
            g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
    }

    drawPopups(g) {
        for (const p of this.pops) {
            const y = p.y - p.t * 22;
            if (p.t > 0.6 && ((p.t * 30) | 0) % 2) continue;       // blink out
            drawText(g, p.text, p.x, y, p.color, { align: 'c', shadow: '#05051a' });
        }
    }
}

// ------------------------------------------------------------------ the backdrop
/** One star field per sector colour scheme. */
export const SECTORS = [
    { name: 'DEEP SPACE',   top: '#05051a', mid: '#0a0a30', neb: ['#14206a', '#1d3aa8'], stars: ['#ffffff', '#9fd8ff', '#3f8cff'], planet: { base: '#2a6ad8', mid: '#1c449c', dark: '#0e2254', hi: '#9fd8ff', ring: null } },
    { name: 'VIOLET REACH', top: '#10051e', mid: '#220a3a', neb: ['#4a1478', '#7a24c8'], stars: ['#ffffff', '#ecb8ff', '#ff5ec8'], planet: { base: '#c4559e', mid: '#8a2a74', dark: '#481440', hi: '#ffc8ec', ring: '#ffd4a0' } },
    { name: 'EMERALD BELT', top: '#041612', mid: '#08261e', neb: ['#0e5a3a', '#1a9a5a'], stars: ['#ffffff', '#c8ffa8', '#29e5ff'], planet: { base: '#3ab86a', mid: '#1e7a46', dark: '#0e3a24', hi: '#d8ffb0', ring: null } },
    { name: 'EMBER FRONT',  top: '#1a0608', mid: '#32100c', neb: ['#7a1e0a', '#c4501a'], stars: ['#ffffff', '#ffe0a8', '#ff8a2e'], planet: { base: '#e0652a', mid: '#a03a14', dark: '#541c08', hi: '#ffe0a8', ring: '#ffc400' } },
];

function bake(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function bakePlanet(r, p) {
    // a ringed planet is much wider than it is tall: the ring reaches 1.75 radii each side of the centre
    const sw = Math.ceil(p.ring ? r * 3.5 : r * 2) + 4, sh = Math.ceil(r * 2) + 2;
    return bake(sw, sh, (g) => {
        const cx = sw / 2, cy = sh / 2;
        const ringAt = (back) => {
            if (!p.ring) return;
            for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
                const dx = (x + 0.5 - cx) / (r * 1.75), dy = (y + 0.5 - cy) / (r * 0.5);
                const d = Math.hypot(dx, dy);
                // the ring is tilted: its lower half is in front of the planet, the upper half behind
                if (d > 0.82 && d < 1 && (dy > 0) !== back && !(back && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r)) { g.fillStyle = d > 0.92 ? p.ring : '#a07040'; g.fillRect(x, y, 1, 1); }
            }
        };
        ringAt(true);
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            if (d > r) continue;
            // light from the upper left: shade by the surface's tilt away from it, dithered between tones
            const nz = Math.sqrt(Math.max(0, 1 - (d / r) ** 2)), l = (-dx / r) * 0.55 + (-dy / r) * 0.55 + nz * 0.6;
            const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
            const band = l > 0.95 ? 0 : l > 0.62 ? (l - 0.62) / 0.33 < t ? 1 : 0 : l > 0.3 ? (l - 0.3) / 0.32 < t ? 2 : 1 : l > 0.05 ? (l - 0.05) / 0.25 < t ? 3 : 2 : 3;
            g.fillStyle = [p.hi, p.base, p.mid, p.dark][band];
            g.fillRect(x, y, 1, 1);
        }
        ringAt(false);
    });
}

/** A nebula tile that repeats vertically: ordered-dithered blobs in two colours. */
export function bakeNebula(sector) {
    return bake(W, H, (g) => {
        const tau = Math.PI * 2;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const v = Math.sin(x * 0.034 + Math.sin((y / H) * tau * 2) * 1.6) + Math.sin((y / H) * tau * 3 + x * 0.021) + Math.sin(x * 0.07 - (y / H) * tau);
            const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
            const a = (v - 1.2) / 1.1;                      // 0 .. 1 where the cloud is thick
            if (a <= 0) continue;
            g.fillStyle = a > 0.62 ? sector.neb[1] : sector.neb[0];
            if (Math.min(1, a) * 0.8 > t) g.fillRect(x, y, 1, 1);
        }
    });
}

/** The sky: an ordered-dithered gradient (dark at the edges, a little lighter mid-screen). */
export function bakeSky(sector) {
    return bake(W, H, (g) => {
        g.fillStyle = sector.top; g.fillRect(0, 0, W, H);
        g.fillStyle = sector.mid;
        for (let y = 0; y < H; y++) {
            const f = Math.sin((y / H) * Math.PI) ** 1.3 * 1.05;
            for (let x = 0; x < W; x++) if (f > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16) g.fillRect(x, y, 1, 1);
        }
    });
}

export class Starfield {
    constructor() {
        this.layers = [
            { n: 34, speed: 10, size: 1, stars: [] },
            { n: 24, speed: 26, size: 1, stars: [] },
            { n: 14, speed: 62, size: 2, stars: [] },
        ];
        let s = 12345;
        const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (const l of this.layers) for (let i = 0; i < l.n; i++) l.stars.push({ x: (rnd() * W) | 0, y: rnd() * H, c: (rnd() * 3) | 0, tw: rnd() * 6 });
        this.sector = -1;
        this.y = 0;
        this.planetY = -60;
        this.nebula = [];
        this.sky = [];
        this.planets = [];
        this.warp = 1;
    }

    setSector(i) {
        if (i === this.sector) return;
        this.sector = i;
        const sec = SECTORS[i % SECTORS.length];
        if (!this.sky[i % SECTORS.length]) this.sky[i % SECTORS.length] = bakeSky(sec);
        if (!this.nebula[i % SECTORS.length]) this.nebula[i % SECTORS.length] = bakeNebula(sec);
        if (!this.planets[i % SECTORS.length]) this.planets[i % SECTORS.length] = bakePlanet(34, sec.planet);
        this.planetY = -70;
    }

    update(dt, mul) {
        this.warp += (mul - this.warp) * Math.min(1, dt * 2.2);
        this.y += dt * this.warp;
        this.planetY += dt * 5 * this.warp;
        if (this.planetY > H + 80) this.planetY = -90;
    }

    draw(g, time) {
        const i = Math.max(0, this.sector) % SECTORS.length, sec = SECTORS[i];
        if (this.sky[i]) g.drawImage(this.sky[i], 0, 0); else { g.fillStyle = sec.top; g.fillRect(0, 0, W, H); }
        // nebula, scrolling slowly
        const neb = this.nebula[i];
        if (neb) {
            const oy = Math.floor((this.y * 6) % H);
            g.globalAlpha = 0.7;
            g.drawImage(neb, 0, oy); g.drawImage(neb, 0, oy - H);
            g.globalAlpha = 1;
        }
        const pl = this.planets[i];
        if (pl) g.drawImage(pl, Math.round(W * (i % 2 ? 0.28 : 0.7) - pl.width / 2), Math.round(this.planetY - pl.height / 2));
        for (const l of this.layers) {
            for (const s of l.stars) {
                const y = (s.y + this.y * l.speed) % H;
                const streak = this.warp > 1.8 ? Math.min(14, (this.warp - 1) * l.speed * 0.07) : 0;
                g.fillStyle = sec.stars[s.c];
                if (l.speed < 30 && ((time * 2 + s.tw) % 3) < 0.25) g.fillStyle = '#ffffff';
                g.fillRect(s.x, Math.round(y), l.size, l.size + Math.round(streak));
            }
        }
    }
}
