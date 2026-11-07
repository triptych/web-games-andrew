// Walking bodies: what you stand on, what you bump into, and one physics step. Pure.

import { PLAYER } from '../config.js';
import { worldOf } from './util.js';

const angDist = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

/** Is a flag-gated collider or platform currently open? */
const isOpen = (G, key) => !!G.flags[key];

/** The highest thing you could be standing on at (x, z) with your feet at feetY. */
export function supportAt(G, x, z, feetY = Infinity, frost = false) {
    const W = worldOf(G);
    let g = W.height(x, z);
    for (const p of W.platforms) {
        if (p.open && !isOpen(G, p.open)) continue;
        if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && feetY >= p.top - 0.6) g = Math.max(g, p.top);
    }
    const w = W.water(x, z, g);
    if (w) {
        // ice: a frost-walk ward, or a floe set down by a Rime seal
        if (frost && w.kind !== 'boil' && w.kind !== 'hot') g = Math.max(g, w.level);
        for (const s of G.seals) if (s.kind === 'floe' && Math.hypot(s.x - x, s.z - z) < s.r) g = Math.max(g, s.level);
    }
    return g;
}

/** Water depth above whatever you would stand on, and the body of water. */
export function waterAt(G, x, z, feetY = Infinity, frost = false) {
    const W = worldOf(G);
    const g = supportAt(G, x, z, feetY, frost);
    const w = W.water(x, z, W.height(x, z));
    if (!w) return { depth: 0, w: null };
    return { depth: w.level - g, w };
}

/** Push a circle of radius r at (x, z) out of every solid thing. */
export function collide(G, x, z, r, y = 0) {
    const W = worldOf(G);
    for (let pass = 0; pass < 2; pass++) {
        for (const c of W.circlesNear(x, z)) {
            const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
            if (d < m && d > 1e-6) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; }
        }
        for (const s of W.segs) {
            if (s.open && isOpen(G, s.open)) continue;
            const ex = s.x2 - s.x1, ez = s.z2 - s.z1, l2 = ex * ex + ez * ez || 1;
            const t = Math.max(0, Math.min(1, ((x - s.x1) * ex + (z - s.z1) * ez) / l2));
            const px = s.x1 + ex * t, pz = s.z1 + ez * t;
            const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz), m = s.r + r;
            if (d < m) {
                if (d > 1e-6) { x = px + (dx / d) * m; z = pz + (dz / d) * m; }
                else { x += -ez / Math.sqrt(l2) * m; z += ex / Math.sqrt(l2) * m; }
            }
        }
        for (const ring of W.rings) {
            const dx = x - ring.x, dz = z - ring.z, d = Math.hypot(dx, dz);
            const half = ring.w / 2 + r;
            if (Math.abs(d - ring.r) >= half || d < 1e-6) continue;
            const a = Math.atan2(dz, dx);
            if (ring.gaps.some((gp) => isOpen(G, gp.open) && angDist(a, gp.a) < gp.half)) continue;
            const nd = d < ring.r ? ring.r - half : ring.r + half;
            x = ring.x + (dx / d) * nd; z = ring.z + (dz / d) * nd;
        }
    }
    return { x, z };
}

/**
 * One physics step for a walking body b = { x, y, z, vx, vz, vy, ground }.
 * want = { vx, vz } the walking velocity asked for; opts = { frost, glide, jump, lift }.
 * Returns what happened: { blocked, landed, plunged }.
 */
export function moveBody(G, b, want, dt, opts = {}) {
    const out = { blocked: false, landed: false, plunged: null };
    const r = opts.radius ?? PLAYER.radius;
    // horizontal: snappy on the ground, drifting in the air
    const k = b.ground ? 1 : Math.min(1, dt * 2.2);
    b.vx += (want.vx - b.vx) * k;
    b.vz += (want.vz - b.vz) * k;
    if (opts.push) { b.vx += opts.push.x * (b.ground ? 1 : 0.35); b.vz += opts.push.z * (b.ground ? 1 : 0.35); }
    const px = b.x, pz = b.z;
    const tryMove = (nx, nz) => {
        const c = collide(G, nx, nz, r, b.y);
        const g = supportAt(G, c.x, c.z, b.y + 0.05, opts.frost);
        const rise = g - b.y;
        const run = Math.hypot(c.x - px, c.z - pz);
        if (rise > PLAYER.stepUp && rise > PLAYER.maxSlope * Math.max(run, 1e-3) * (b.ground ? 1 : 0.4)) return null;
        if (b.ground && !opts.frost) {
            const { depth } = waterAt(G, c.x, c.z, b.y + 0.05, false);
            const { depth: here } = waterAt(G, px, pz, b.y + 0.05, false);
            if (depth > PLAYER.wade && depth > here + 1e-4) return null;
        }
        return c;
    };
    const nx = px + b.vx * dt, nz = pz + b.vz * dt;
    let c = tryMove(nx, nz);
    if (!c) { c = tryMove(nx, pz) || tryMove(px, nz); out.blocked = true; }
    if (c) {
        if (b.ground && opts.slopeStick !== false) {
            // when the slide went nowhere useful, stop instead of jittering
        }
        b.x = c.x; b.z = c.z;
    } else { b.vx = 0; b.vz = 0; }

    // vertical
    if (opts.jump && b.ground) { b.vy = opts.jump; b.ground = false; }
    b.vy -= PLAYER.gravity * dt;
    if (opts.lift != null) {
        // an updraft: rise toward the lift height and hover there
        const up = (opts.lift - b.y) * 3;
        b.vy = Math.max(b.vy, Math.min(9, up));
        if (b.y > opts.lift - 0.4) b.vy = Math.min(b.vy, up);
    }
    if (opts.glide && b.vy < -2.6) b.vy = -2.6;
    b.y += b.vy * dt;
    const g = supportAt(G, b.x, b.z, b.y + Math.max(0.6, -b.vy * dt + 0.05), opts.frost);
    const was = b.ground;
    if (b.y <= g) {
        if (!was && b.vy < -6) out.landed = -b.vy;
        b.y = g; b.vy = 0; b.ground = true;
    } else if (b.y - g < 0.25 && b.vy <= 0 && was) {
        b.y = g; b.vy = 0;      // stick to the ground walking downhill
    } else b.ground = false;

    // standing in deep water you could only have fallen into
    if (b.ground) {
        const { depth, w } = waterAt(G, b.x, b.z, b.y + 0.05, opts.frost);
        if (depth > PLAYER.wade + 0.35) out.plunged = w;
        out.wading = depth > 0.05 ? w : null;
    }
    return out;
}
