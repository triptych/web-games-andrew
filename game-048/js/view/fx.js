/**
 * fx.js — the juice. Particles, beams, lightning, rings, projectiles with
 * trails, damage numbers, screen shake (trauma), flashes, hit-stop, slow-mo
 * and a ghosting "aberration" pass.
 *
 * A budget caps how much can spawn per frame and how much can be alive, so a
 * ten-link chain reads as a storm rather than a white screen (game-045's lesson).
 */

import { hexA } from './art.js';

const TAU = Math.PI * 2;

export const fx = {
    parts: [], beams: [], bolts: [], rings: [], texts: [], shots: [], slashes: [],
    trauma: 0, sx: 0, sy: 0,
    flashA: 0, flashC: '#ffffff',
    vignette: 0, vignetteC: '#ff0030',
    aberr: 0,
    hitstop: 0,
    slowT: 0, slowK: 1,
    zoom: 0,
    spawned: 0,
    maxParts: 1100,
    timers: [],
    clock: 0,
};

export function setFxQuality(q) {
    fx.maxParts = q >= 2 ? 1100 : q === 1 ? 650 : 320;
}

export function resetFx() {
    fx.parts.length = 0; fx.beams.length = 0; fx.bolts.length = 0; fx.rings.length = 0;
    fx.texts.length = 0; fx.shots.length = 0; fx.slashes.length = 0;
    fx.trauma = 0; fx.flashA = 0; fx.vignette = 0; fx.aberr = 0; fx.hitstop = 0; fx.slowT = 0; fx.zoom = 0;
    for (const tm of fx.timers) tm.res();
    fx.timers.length = 0;
}

const rnd = (a, b) => a + Math.random() * (b - a);

/** Game-time wait: respects hit-stop and slow-mo. */
export function wait(sec) {
    return new Promise((res) => fx.timers.push({ at: fx.clock + Math.max(0, sec), res }));
}

// ------------------------------------------------------------------ spawners

function canSpawn(n) {
    const room = fx.maxParts - fx.parts.length;
    const frameRoom = 260 - fx.spawned;
    return Math.max(0, Math.min(n, room, frameRoom));
}

export function burst(x, y, color, n = 16, speed = 220, o = {}) {
    n = canSpawn(n);
    fx.spawned += n;
    for (let i = 0; i < n; i++) {
        const a = o.dir !== undefined ? o.dir + rnd(-(o.spread ?? 0.6), o.spread ?? 0.6) : rnd(0, TAU);
        const v = speed * rnd(0.3, 1);
        fx.parts.push({
            x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            life: 0, max: rnd(0.25, 0.6) * (o.life ?? 1), size: rnd(1.5, 3.5) * (o.size ?? 1),
            color, kind: o.kind ?? 'spark', drag: o.drag ?? 3.2, grav: o.grav ?? 0, rot: rnd(0, TAU), vr: rnd(-12, 12),
        });
    }
}

export function smoke(x, y, n = 6, color = '#555a6a') {
    n = canSpawn(n);
    fx.spawned += n;
    for (let i = 0; i < n; i++) {
        fx.parts.push({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-30, 30), vy: rnd(-50, -10), life: 0, max: rnd(0.5, 1.1), size: rnd(6, 14), color, kind: 'smoke', drag: 1.2, grav: 0 });
    }
}

export function shards(x, y, color, n = 10, speed = 260) {
    n = canSpawn(n);
    fx.spawned += n;
    for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), v = speed * rnd(0.4, 1);
        fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0, max: rnd(0.6, 1.1), size: rnd(3, 7), color, kind: 'shard', drag: 1.0, grav: 520, rot: rnd(0, TAU), vr: rnd(-14, 14) });
    }
}

export function explosion(x, y, size = 1, color = '#ffa53a') {
    burst(x, y, '#fff3c0', Math.round(10 * size), 260 * size, { size: 1.6 });
    burst(x, y, color, Math.round(22 * size), 380 * size, { size: 1.3 });
    smoke(x, y, Math.round(5 * size));
    ring(x, y, color, 70 * size, 0.35);
    glow(x, y, color, 60 * size, 0.3);
}

export function glow(x, y, color, r, life = 0.25) {
    if (!canSpawn(1)) return;
    fx.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: life, size: r, color, kind: 'glow', drag: 0, grav: 0 });
}

export function ring(x, y, color, r = 60, life = 0.4, w = 3) {
    if (fx.rings.length > 24) return;
    fx.rings.push({ x, y, r0: r * 0.15, r, life: 0, max: life, color, w });
}

export function beam(x1, y1, x2, y2, color, w = 6, life = 0.22) {
    if (fx.beams.length > 30) return;
    fx.beams.push({ x1, y1, x2, y2, color, w, life: 0, max: life });
}

export function bolt(x1, y1, x2, y2, color = '#d8c0ff', life = 0.28, w = 3) {
    if (fx.bolts.length > 30) return;
    fx.bolts.push({ x1, y1, x2, y2, color, life: 0, max: life, w, pts: jag(x1, y1, x2, y2) });
}

function jag(x1, y1, x2, y2) {
    const pts = [x1, y1];
    const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 22));
    const nx = -(y2 - y1), ny = x2 - x1;
    const nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < n; i++) {
        const u = i / n;
        const off = rnd(-1, 1) * 18 * Math.sin(u * Math.PI);
        pts.push(x1 + (x2 - x1) * u + (nx / nl) * off, y1 + (y2 - y1) * u + (ny / nl) * off);
    }
    pts.push(x2, y2);
    return pts;
}

export function slash(x, y, size, color, dir = 1) {
    fx.slashes.push({ x, y, size, color, dir, life: 0, max: 0.22, a0: rnd(-0.6, -0.2) });
}

export function text(x, y, str, o = {}) {
    if (fx.texts.length > 60) fx.texts.shift();
    fx.texts.push({
        x: x + rnd(-8, 8), y, vy: o.vy ?? -70, str, size: o.size ?? 22, color: o.color ?? '#ffffff',
        life: 0, max: o.life ?? 0.9, pop: 0, stroke: o.stroke ?? '#000000', weight: o.weight ?? 900,
    });
}

/**
 * A projectile from (x0,y0) to (x1,y1) along a curve. kind: orb | missile | shell | blade.
 * Resolves when it arrives.
 */
export function shoot(x0, y0, x1, y1, o = {}) {
    return new Promise((res) => {
        const arc = o.arc ?? 0.25;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const nx = -(y1 - y0), ny = x1 - x0;
        const side = o.side ?? (Math.random() < 0.5 ? -1 : 1);
        fx.shots.push({
            x0, y0, x1, y1, cx: mx + nx * arc * side * rnd(0.5, 1), cy: my + ny * arc * side * rnd(0.5, 1) - (o.lift ?? 0),
            t: 0, dur: o.dur ?? 0.35, color: o.color ?? '#ffffff', size: o.size ?? 6, kind: o.kind ?? 'orb',
            trail: [], res, x: x0, y: y0, delay: o.delay ?? 0,
        });
    });
}

let calm = false;
/** Reduced effects: a third of the shake, softer flashes, no aberration. */
export function setCalm(v) { calm = !!v; }
export function shake(amount) { fx.trauma = Math.min(1, fx.trauma + amount * (calm ? 0.3 : 1)); }
export function flash(color = '#ffffff', a = 0.5) { fx.flashC = color; fx.flashA = Math.max(fx.flashA, a * (calm ? 0.3 : 1)); }
export function vignette(color, a) { fx.vignetteC = color; fx.vignette = Math.max(fx.vignette, a); }
export function hitstop(sec) { fx.hitstop = Math.max(fx.hitstop, sec); }
export function slowmo(sec, k = 0.35) { fx.slowT = Math.max(fx.slowT, sec); fx.slowK = k; }
export function aberrate(a) { if (!calm) fx.aberr = Math.max(fx.aberr, a); }
export function punch(z) { fx.zoom = Math.max(fx.zoom, z); }

// ------------------------------------------------------------------ update

/** Returns the effective dt the world should advance by (0 during hit-stop). */
export function updateFx(rawDt) {
    fx.spawned = 0;
    let dt = rawDt;
    if (fx.hitstop > 0) { fx.hitstop -= rawDt; dt = 0; }
    else if (fx.slowT > 0) { fx.slowT -= rawDt; dt = rawDt * fx.slowK; }
    fx.clock += dt;
    for (let i = fx.timers.length - 1; i >= 0; i--) {
        if (fx.timers[i].at <= fx.clock) { const tm = fx.timers[i]; fx.timers.splice(i, 1); tm.res(); }
    }
    // screen effects decay in real time
    fx.trauma = Math.max(0, fx.trauma - rawDt * 1.6);
    const sh = fx.trauma * fx.trauma * 22;
    fx.sx = rnd(-1, 1) * sh; fx.sy = rnd(-1, 1) * sh;
    fx.flashA = Math.max(0, fx.flashA - rawDt * 3);
    fx.vignette = Math.max(0, fx.vignette - rawDt * 1.4);
    fx.aberr = Math.max(0, fx.aberr - rawDt * 2.5);
    fx.zoom = Math.max(0, fx.zoom - rawDt * 1.8);

    for (let i = fx.parts.length - 1; i >= 0; i--) {
        const p = fx.parts[i];
        p.life += dt;
        if (p.life >= p.max) { fx.parts[i] = fx.parts[fx.parts.length - 1]; fx.parts.pop(); continue; }
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy = p.vy * d + p.grav * dt;
        if (p.kind === 'coin' && p.tx !== undefined) {
            const u = p.life / p.max;
            if (u > 0.35) {
                const k = Math.min(1, (u - 0.35) / 0.65);
                p.x += (p.tx - p.x) * k * 0.25; p.y += (p.ty - p.y) * k * 0.25;
            }
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.rot !== undefined) p.rot += (p.vr ?? 0) * dt;
    }
    for (const arr of [fx.beams, fx.bolts, fx.rings, fx.slashes]) {
        for (let i = arr.length - 1; i >= 0; i--) { arr[i].life += dt; if (arr[i].life >= arr[i].max) arr.splice(i, 1); }
    }
    for (const b of fx.bolts) if (Math.random() < 0.5) b.pts = jag(b.x1, b.y1, b.x2, b.y2);
    for (let i = fx.texts.length - 1; i >= 0; i--) {
        const t = fx.texts[i];
        t.life += rawDt;
        t.y += t.vy * rawDt;
        t.vy *= Math.exp(-2.5 * rawDt);
        if (t.life >= t.max) fx.texts.splice(i, 1);
    }
    for (let i = fx.shots.length - 1; i >= 0; i--) {
        const s = fx.shots[i];
        if (s.delay > 0) { s.delay -= dt; continue; }
        s.t += dt / s.dur;
        const u = Math.min(1, s.t);
        const e = s.kind === 'missile' ? u * u : u;
        const a = 1 - e;
        s.x = a * a * s.x0 + 2 * a * e * s.cx + e * e * s.x1;
        s.y = a * a * s.y0 + 2 * a * e * s.cy + e * e * s.y1;
        s.trail.push(s.x, s.y);
        if (s.trail.length > 24) s.trail.splice(0, 2);
        if (s.kind === 'missile' && Math.random() < 0.6) smoke(s.x, s.y, 1, '#6a6070');
        if (u >= 1) { fx.shots.splice(i, 1); s.res(); }
    }
    return dt;
}

// ------------------------------------------------------------------ draw

export function drawFx(ctx) {
    ctx.save();
    // smoke under everything (normal blend)
    for (const p of fx.parts) {
        if (p.kind !== 'smoke') continue;
        const u = p.life / p.max;
        ctx.globalAlpha = 0.35 * (1 - u);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + u * 1.5), 0, TAU); ctx.fill();
    }
    for (const p of fx.parts) {
        if (p.kind !== 'shard' && p.kind !== 'coin') continue;
        const u = p.life / p.max;
        ctx.globalAlpha = Math.min(1, (1 - u) * 2);
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.kind === 'coin') {
            ctx.fillStyle = '#ffd36a';
            ctx.scale(Math.abs(Math.cos(p.rot * 2)) * 0.8 + 0.2, 1);
            ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
            ctx.fillStyle = '#a8742a'; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.45, 0, TAU); ctx.fill();
        } else {
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.moveTo(-p.size, -p.size * 0.4); ctx.lineTo(p.size, 0); ctx.lineTo(-p.size * 0.3, p.size * 0.6); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of fx.parts) {
        const u = p.life / p.max;
        if (p.kind === 'spark') {
            ctx.globalAlpha = 1 - u;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size * (1 - u * 0.5);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
        } else if (p.kind === 'glow') {
            ctx.globalAlpha = (1 - u) * 0.9;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            g.addColorStop(0, hexA(p.color, 0.9)); g.addColorStop(1, hexA(p.color, 0));
            ctx.fillStyle = g;
            ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        } else if (p.kind === 'dot') {
            ctx.globalAlpha = 1 - u;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
        }
    }
    for (const r of fx.rings) {
        const u = r.life / r.max;
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.w * (1 - u) + 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r - r.r0) * (1 - (1 - u) * (1 - u)), 0, TAU); ctx.stroke();
    }
    for (const b of fx.beams) {
        const u = b.life / b.max;
        ctx.globalAlpha = 1 - u;
        ctx.lineCap = 'round';
        ctx.strokeStyle = b.color; ctx.lineWidth = b.w * (1 - u * 0.6) * 2.4;
        ctx.globalAlpha = (1 - u) * 0.35;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.w * (1 - u * 0.6) * 0.5;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
    for (const b of fx.bolts) {
        const u = b.life / b.max;
        for (const [w, c, a] of [[b.w * 3, b.color, 0.3], [b.w, '#ffffff', 1]]) {
            ctx.globalAlpha = (1 - u) * a;
            ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(b.pts[0], b.pts[1]);
            for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
            ctx.stroke();
        }
    }
    for (const s of fx.slashes) {
        const u = s.life / s.max;
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = s.color;
        ctx.lineCap = 'round';
        const a0 = s.a0 + u * 0.4;
        for (const [w, c] of [[s.size * 0.22, s.color], [s.size * 0.07, '#ffffff']]) {
            ctx.strokeStyle = c; ctx.lineWidth = w * (1 - u * 0.7);
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, a0 - 1.2 * u - 0.5, a0 + 1.4 * Math.min(1, u * 3)); ctx.stroke();
        }
    }
    for (const s of fx.shots) {
        if (s.delay > 0) continue;
        const tr = s.trail;
        if (tr.length >= 4) {
            ctx.lineCap = 'round';
            for (let i = 2; i < tr.length; i += 2) {
                const k = i / tr.length;
                ctx.globalAlpha = k * 0.8;
                ctx.strokeStyle = s.color;
                ctx.lineWidth = s.size * k * 1.4;
                ctx.beginPath(); ctx.moveTo(tr[i - 2], tr[i - 1]); ctx.lineTo(tr[i], tr[i + 1]); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2.4);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, hexA(s.color, 0.9)); g.addColorStop(1, hexA(s.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 2.4, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // numbers
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of fx.texts) {
        const u = t.life / t.max;
        const pop = u < 0.12 ? 0.6 + (u / 0.12) * 0.7 : u < 0.22 ? 1.3 - ((u - 0.12) / 0.1) * 0.3 : 1;
        ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
        ctx.font = `${t.weight} ${Math.round(t.size * pop)}px "Trebuchet MS", system-ui, sans-serif`;
        ctx.lineWidth = Math.max(3, t.size * 0.16);
        ctx.strokeStyle = t.stroke;
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
}

/** Full-screen overlays: flash, vignette. Call after everything else. */
export function drawScreenFx(ctx, W, H) {
    if (fx.vignette > 0.01) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, hexA(fx.vignetteC, 0)); g.addColorStop(1, hexA(fx.vignetteC, fx.vignette * 0.6));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
    if (fx.flashA > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = hexA(fx.flashC, fx.flashA * 0.6);
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
    }
}

/** Coins that burst out and then home in on (tx, ty) — the scrap counter. */
export function coins(x, y, n, tx, ty) {
    n = canSpawn(Math.min(n, 40));
    fx.spawned += n;
    for (let i = 0; i < n; i++) {
        fx.parts.push({ x, y, vx: rnd(-220, 220), vy: rnd(-340, -120), life: 0, max: rnd(0.8, 1.1), size: rnd(3.5, 5.5), color: '#ffd36a', kind: 'coin', drag: 1.6, grav: 420, rot: rnd(0, TAU), vr: rnd(-10, 10), tx, ty });
    }
}

/** Soft dots rising (repairs) or orbiting (shield). */
export function motes(x, y, color, n = 10, spread = 40, vy = -80) {
    n = canSpawn(n);
    fx.spawned += n;
    for (let i = 0; i < n; i++) fx.parts.push({ x: x + rnd(-spread, spread), y: y + rnd(-spread * 0.6, spread * 0.6), vx: rnd(-15, 15), vy: vy * rnd(0.5, 1.2), life: 0, max: rnd(0.5, 0.9), size: rnd(2, 4), color, kind: 'dot', drag: 0.8, grav: 0 });
}
