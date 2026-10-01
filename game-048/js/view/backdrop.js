/**
 * backdrop.js — per-chapter space: a cached sky (gradient, nebula, planet),
 * live twinkling stars, a synthwave perspective floor under the arena, and
 * chapter specials (sim grid, ocean shimmer, storm lightning, the red core).
 */

import { CHAPTER_INFO } from '../sim/story.js';
import { makeRng } from '../sim/rng.js';
import { hexA } from './art.js';

const skyCache = new Map();

function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }

function buildSky(ch, W, H, dpr) {
    const info = CHAPTER_INFO[ch];
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, info.sky[0]); g.addColorStop(1, info.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rng = makeRng(1000 + ch);
    // nebula: many soft blobs
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
        const x = rng.range(-0.1, 1.1) * W, y = rng.range(-0.1, 0.7) * H, r = rng.range(0.12, 0.42) * Math.max(W, H);
        const hue = info.neb + rng.range(-35, 35);
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, hsl(hue, 80, 50, 0.08)); rg.addColorStop(1, hsl(hue, 80, 40, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // faint dust stars baked in
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rng.range(0.05, 0.3)})`;
        ctx.fillRect(rng.next() * W, rng.next() * H, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (info.planet) {
        const p = info.planet;
        const pr = Math.min(W, H) * (p.core ? 0.22 : 0.28);
        const px = W * 0.78, py = H * 0.2;
        if (p.ring) {
            ctx.strokeStyle = hsl(p.hue, 60, 70, 0.25); ctx.lineWidth = pr * 0.08;
            ctx.beginPath(); ctx.ellipse(px, py, pr * 1.7, pr * 0.32, -0.25, Math.PI, Math.PI * 2); ctx.stroke();
        }
        const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
        if (p.core) { pg.addColorStop(0, '#fff0f0'); pg.addColorStop(0.25, '#ff4a5a'); pg.addColorStop(1, '#2a0008'); }
        else { pg.addColorStop(0, hsl(p.hue, 50, 62)); pg.addColorStop(0.6, hsl(p.hue, 55, 30)); pg.addColorStop(1, hsl(p.hue, 60, 8)); }
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
        // bands
        ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
        for (let i = 0; i < 7; i++) {
            ctx.fillStyle = hsl(p.hue + rng.range(-20, 20), 40, rng.range(20, 60), p.ocean ? 0.12 : 0.1);
            ctx.fillRect(px - pr, py - pr + rng.next() * pr * 2, pr * 2, rng.range(2, pr * 0.15));
        }
        ctx.restore();
        // atmosphere rim
        ctx.strokeStyle = hsl(p.hue, 90, 70, 0.35); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py, pr + 1, Math.PI * 0.9, Math.PI * 1.7); ctx.stroke();
        if (p.ring) {
            ctx.strokeStyle = hsl(p.hue, 60, 75, 0.4); ctx.lineWidth = pr * 0.08;
            ctx.beginPath(); ctx.ellipse(px, py, pr * 1.7, pr * 0.32, -0.25, 0, Math.PI); ctx.stroke();
        }
    }
    return c;
}

const starCache = new Map();
function starsFor(ch) {
    if (starCache.has(ch)) return starCache.get(ch);
    const rng = makeRng(77 + ch);
    const s = [];
    for (let i = 0; i < 120; i++) s.push({ x: rng.next(), y: rng.next() * 0.75, z: rng.range(0.2, 1), p: rng.range(0, 6.28), c: rng.pick(['#ffffff', '#cfe8ff', '#ffe8cf', '#ffd0f0']) });
    starCache.set(ch, s);
    return s;
}

/**
 * Draw the backdrop. arena: rect where mechs stand (floor drawn under it).
 * fx: { od (0..1 overdrive tint), flash, storm (0..1) }
 */
export function drawBackdrop(ctx, W, H, dpr, ch, t, arena, fx = {}) {
    ch = Math.max(0, Math.min(6, ch));
    const key = `${ch}|${W}|${H}|${dpr}`;
    let sky = skyCache.get(key);
    if (!sky) { skyCache.clear(); sky = buildSky(ch, W, H, dpr); skyCache.set(key, sky); }
    ctx.drawImage(sky, 0, 0, W, H);
    const info = CHAPTER_INFO[ch];
    // stars drift slowly
    for (const s of starsFor(ch)) {
        const x = ((s.x * W - t * 6 * s.z) % W + W) % W;
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1 + s.z * 2) + s.p));
        ctx.globalAlpha = a * s.z;
        ctx.fillStyle = s.c;
        const r = s.z * 1.6;
        ctx.fillRect(x, s.y * H, r, r);
    }
    ctx.globalAlpha = 1;
    if (info.storm) {
        const flick = Math.max(0, Math.sin(t * 0.7) * Math.sin(t * 3.1) * Math.sin(t * 11.3));
        if (flick > 0.3) {
            ctx.fillStyle = `rgba(255,180,255,${(flick - 0.3) * 0.25})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
    if (!arena) return;
    // floor
    const hz = arena.y + arena.h * 0.6;
    const bottom = arena.y + arena.h;
    const fg = ctx.createLinearGradient(0, hz, 0, bottom);
    const hue = info.neb;
    fg.addColorStop(0, hsl(hue, 70, 8, 0.0));
    fg.addColorStop(0.15, hsl(hue, 70, 6, 0.85));
    fg.addColorStop(1, hsl(hue, 60, 4, 1));
    ctx.fillStyle = fg;
    ctx.fillRect(arena.x, hz, arena.w, bottom - hz);
    // horizon glow
    const hg = ctx.createLinearGradient(0, hz - 30, 0, hz + 10);
    hg.addColorStop(0, hsl(hue, 90, 60, 0)); hg.addColorStop(0.75, hsl(hue, 95, 65, 0.28 + 0.2 * (fx.od ?? 0))); hg.addColorStop(1, hsl(hue, 90, 60, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(arena.x, hz - 30, arena.w, 40);
    // perspective grid
    ctx.save();
    ctx.beginPath(); ctx.rect(arena.x, hz, arena.w, bottom - hz); ctx.clip();
    const gc = fx.od ? '#ff4dff' : info.grid ? '#45f3ff' : hsl(hue, 90, 65);
    ctx.strokeStyle = gc.startsWith('#') ? hexA(gc, 0.35) : gc;
    ctx.lineWidth = 1;
    const cx = arena.x + arena.w / 2;
    for (let i = -14; i <= 14; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * arena.w * 0.02, hz); ctx.lineTo(cx + i * arena.w * 0.16, bottom); ctx.stroke();
    }
    const speed = fx.od ? 1.8 : 0.35;
    for (let i = 0; i < 9; i++) {
        const u = ((i + (t * speed) % 1) / 9);
        const y = hz + (bottom - hz) * u * u;
        ctx.globalAlpha = 0.25 + 0.75 * u;
        ctx.beginPath(); ctx.moveTo(arena.x, y); ctx.lineTo(arena.x + arena.w, y); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (info.planet?.ocean) {
        ctx.fillStyle = 'rgba(140,230,255,0.08)';
        for (let i = 0; i < 6; i++) {
            const y = hz + 4 + i * 6;
            ctx.fillRect(arena.x + ((t * 20 + i * 90) % arena.w), y, 60, 1);
        }
    }
}

/** The console under the reels: dark metal with a faint hex pattern, cached. */
const consoleCache = new Map();
export function drawConsole(ctx, x, y, w, h, dpr, ch) {
    const key = `${Math.round(w)}|${Math.round(h)}|${dpr}|${ch}`;
    let c = consoleCache.get(key);
    if (!c) {
        consoleCache.clear();
        c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
        const k = c.getContext('2d');
        k.scale(dpr, dpr);
        const g = k.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(6,8,16,0.55)'); g.addColorStop(0.08, 'rgba(6,8,16,0.88)'); g.addColorStop(1, 'rgba(3,4,10,0.97)');
        k.fillStyle = g;
        k.fillRect(0, 0, w, h);
        k.strokeStyle = 'rgba(80,120,200,0.06)';
        const R = 14;
        for (let yy = 0; yy < h + R; yy += R * 1.5) {
            for (let xx = 0; xx < w + R; xx += R * 1.732) {
                const ox = (Math.round(yy / (R * 1.5)) % 2) * R * 0.866;
                k.beginPath();
                for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; k.lineTo(xx + ox + Math.cos(a) * R * 0.9, yy + Math.sin(a) * R * 0.9); }
                k.closePath(); k.stroke();
            }
        }
        k.fillStyle = hsl(CHAPTER_INFO[ch].neb, 90, 60, 0.5);
        k.fillRect(0, 0, w, 2);
        c._w = w; c._h = h;
        consoleCache.set(key, c);
    }
    ctx.drawImage(c, x, y, w, h);
}
