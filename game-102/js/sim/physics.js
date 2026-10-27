// 2D rigid bodies: boxes and circles, sequential impulses, warm starting, sleeping.
// Pure, like the rest of js/sim: no clock, no randomness, no DOM. A world is any object with
// { bodies, cache, wells }; stepWorld() mutates it and returns the impacts of this step.
//
// The box-box contact generator follows Box2D-lite (separating axis, then clipping the incident
// edge against the reference face). Normals always point from body A to body B.

import { GRAVITY } from '../config.js';

const ITERATIONS = 10;
const BIAS = 0.2;            // how hard overlap is pushed out
const SLOP = 0.01;          // overlap we tolerate, so resting contacts stay put
const SLEEP_AFTER = 0.6;    // seconds of stillness before a body falls asleep
const IMPACT_MIN = 2.0;     // approach speed below this is not an impact (settling jitter in a tall stack reaches ~1.5)

export function makeBody(o) {
    const b = {
        id: 0, kind: 'box', mat: 'hull', tag: '', ammo: '',
        x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0,
        hx: 0.5, hy: 0.5, r: 0.5,
        density: 1, fric: 0.6, rest: 0, punch: 1,
        hp: 1, maxHp: 1, value: 0,
        asleep: true, sleepT: 0, touched: false, idle: 0, spent: false, fuse: 0,
        static: false,
        ...o,
    };
    b.rad = b.kind === 'circle' ? b.r : Math.hypot(b.hx, b.hy);
    if (b.static) {
        b.mass = 0; b.invMass = 0; b.invI = 0; b.hp = 0; b.maxHp = 0; b.asleep = false;
    } else {
        const area = b.kind === 'circle' ? Math.PI * b.r * b.r : 4 * b.hx * b.hy;
        b.mass = area * b.density;
        b.invMass = 1 / b.mass;
        const I = b.kind === 'circle' ? 0.5 * b.mass * b.r * b.r : b.mass * (b.hx * b.hx + b.hy * b.hy) / 3;
        b.invI = 1 / I;
    }
    return b;
}

export function wake(b) { if (b.invMass > 0) { b.asleep = false; b.sleepT = 0; } }

/** Wake every body within r of a point: a support has just been removed or something blew up. */
export function wakeNear(bodies, x, y, r) {
    for (const b of bodies) if (b.asleep && Math.hypot(b.x - x, b.y - y) < r + b.rad) wake(b);
}

const moving = (b) => b.vx * b.vx + b.vy * b.vy > 0.04 || Math.abs(b.w) * b.rad > 0.5
    || b.tag === 'proj' || b.tag === 'shard';

// ---------------------------------------------------------------------- contact generation

function circleCircle(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy), rr = A.r + B.r;
    if (d > rr) return null;
    const nx = d > 1e-9 ? dx / d : 0, ny = d > 1e-9 ? dy / d : 1;
    return [{ x: A.x + nx * A.r, y: A.y + ny * A.r, nx, ny, sep: d - rr }];
}

/** Closest feature of a box to a circle centre: { nx, ny } point from the box towards the circle. */
function circleVsBox(C, X) {
    const c = Math.cos(X.a), s = Math.sin(X.a);
    const rx = C.x - X.x, ry = C.y - X.y;
    const px = c * rx + s * ry, py = -s * rx + c * ry;       // circle centre in the box's frame
    const qx = Math.max(-X.hx, Math.min(X.hx, px)), qy = Math.max(-X.hy, Math.min(X.hy, py));
    let lx, ly, sep;
    if (Math.abs(px) < X.hx && Math.abs(py) < X.hy) {
        // centre inside the box: leave by the nearest face
        const dx = X.hx - Math.abs(px), dy = X.hy - Math.abs(py);
        if (dx < dy) { lx = Math.sign(px) || 1; ly = 0; sep = -(dx + C.r); }
        else { lx = 0; ly = Math.sign(py) || 1; sep = -(dy + C.r); }
    } else {
        const ex = px - qx, ey = py - qy, d = Math.hypot(ex, ey);
        if (d > C.r) return null;
        lx = ex / d; ly = ey / d; sep = d - C.r;
    }
    const wx = c * qx - s * qy + X.x, wy = s * qx + c * qy + X.y;      // closest point, world
    return { nx: c * lx - s * ly, ny: s * lx + c * ly, sep, x: wx, y: wy };
}

function clip(v0, v1, nx, ny, offset) {
    const d0 = nx * v0.x + ny * v0.y - offset, d1 = nx * v1.x + ny * v1.y - offset;
    const out = [];
    if (d0 <= 0) out.push(v0);
    if (d1 <= 0) out.push(v1);
    if (d0 * d1 < 0) {
        const t = d0 / (d0 - d1);
        out.push({ x: v0.x + t * (v1.x - v0.x), y: v0.y + t * (v1.y - v0.y) });
    }
    return out;
}

function incidentEdge(h, pos, c, s, fnx, fny) {
    // the edge of the other box most facing the reference face
    const nx = -(c * fnx + s * fny), ny = -(-s * fnx + c * fny);
    let e0, e1;
    if (Math.abs(nx) > Math.abs(ny)) {
        if (nx > 0) { e0 = [h.x, -h.y]; e1 = [h.x, h.y]; } else { e0 = [-h.x, h.y]; e1 = [-h.x, -h.y]; }
    } else if (ny > 0) { e0 = [h.x, h.y]; e1 = [-h.x, h.y]; } else { e0 = [-h.x, -h.y]; e1 = [h.x, -h.y]; }
    const w = (e) => ({ x: pos.x + c * e[0] - s * e[1], y: pos.y + s * e[0] + c * e[1] });
    return [w(e0), w(e1)];
}

function boxBox(A, B) {
    const ca = Math.cos(A.a), sa = Math.sin(A.a), cb = Math.cos(B.a), sb = Math.sin(B.a);
    const dpx = B.x - A.x, dpy = B.y - A.y;
    const dAx = ca * dpx + sa * dpy, dAy = -sa * dpx + ca * dpy;
    const dBx = cb * dpx + sb * dpy, dBy = -sb * dpx + cb * dpy;
    // C = RotA^T RotB
    const c11 = Math.abs(ca * cb + sa * sb), c12 = Math.abs(-ca * sb + sa * cb);
    const c21 = Math.abs(-sa * cb + ca * sb), c22 = Math.abs(sa * sb + ca * cb);

    const fAx = Math.abs(dAx) - A.hx - (c11 * B.hx + c12 * B.hy);
    const fAy = Math.abs(dAy) - A.hy - (c21 * B.hx + c22 * B.hy);
    if (fAx > 0 || fAy > 0) return null;
    const fBx = Math.abs(dBx) - (c11 * A.hx + c21 * A.hy) - B.hx;
    const fBy = Math.abs(dBy) - (c12 * A.hx + c22 * A.hy) - B.hy;
    if (fBx > 0 || fBy > 0) return null;

    // pick the axis of least penetration, preferring A's faces a little (keeps contacts stable)
    let axis = 0, sep = fAx;
    let nx = dAx > 0 ? ca : -ca, ny = dAx > 0 ? sa : -sa;
    if (fAy > 0.95 * sep + 0.01 * A.hy) { axis = 1; sep = fAy; nx = dAy > 0 ? -sa : sa; ny = dAy > 0 ? ca : -ca; }
    if (fBx > 0.95 * sep + 0.01 * B.hx) { axis = 2; sep = fBx; nx = dBx > 0 ? cb : -cb; ny = dBx > 0 ? sb : -sb; }
    if (fBy > 0.95 * sep + 0.01 * B.hy) { axis = 3; sep = fBy; nx = dBy > 0 ? -sb : sb; ny = dBy > 0 ? cb : -cb; }

    let fnx, fny, front, snx, sny, negSide, posSide, inc;
    if (axis === 0) {
        fnx = nx; fny = ny; front = A.x * fnx + A.y * fny + A.hx;
        snx = -sa; sny = ca;
        const side = A.x * snx + A.y * sny; negSide = -side + A.hy; posSide = side + A.hy;
        inc = incidentEdge({ x: B.hx, y: B.hy }, B, cb, sb, fnx, fny);
    } else if (axis === 1) {
        fnx = nx; fny = ny; front = A.x * fnx + A.y * fny + A.hy;
        snx = ca; sny = sa;
        const side = A.x * snx + A.y * sny; negSide = -side + A.hx; posSide = side + A.hx;
        inc = incidentEdge({ x: B.hx, y: B.hy }, B, cb, sb, fnx, fny);
    } else if (axis === 2) {
        fnx = -nx; fny = -ny; front = B.x * fnx + B.y * fny + B.hx;
        snx = -sb; sny = cb;
        const side = B.x * snx + B.y * sny; negSide = -side + B.hy; posSide = side + B.hy;
        inc = incidentEdge({ x: A.hx, y: A.hy }, A, ca, sa, fnx, fny);
    } else {
        fnx = -nx; fny = -ny; front = B.x * fnx + B.y * fny + B.hy;
        snx = cb; sny = sb;
        const side = B.x * snx + B.y * sny; negSide = -side + B.hx; posSide = side + B.hx;
        inc = incidentEdge({ x: A.hx, y: A.hy }, A, ca, sa, fnx, fny);
    }

    const c1 = clip(inc[0], inc[1], -snx, -sny, negSide);
    if (c1.length < 2) return null;
    const c2 = clip(c1[0], c1[1], snx, sny, posSide);
    if (c2.length < 2) return null;

    const out = [];
    for (const p of c2) {
        const s = fnx * p.x + fny * p.y - front;
        if (s <= 0) out.push({ x: p.x - s * fnx, y: p.y - s * fny, nx, ny, sep: s });
    }
    return out.length ? out : null;
}

function collide(A, B) {
    if (A.kind === 'circle') {
        if (B.kind === 'circle') return circleCircle(A, B);
        const k = circleVsBox(A, B);                       // normal: box → circle, so flip for A → B
        return k ? [{ x: k.x, y: k.y, nx: -k.nx, ny: -k.ny, sep: k.sep }] : null;
    }
    if (B.kind === 'circle') {
        const k = circleVsBox(B, A);
        return k ? [{ x: k.x, y: k.y, nx: k.nx, ny: k.ny, sep: k.sep }] : null;
    }
    return boxBox(A, B);
}

// ---------------------------------------------------------------------- the step

/**
 * Advance one fixed step. Returns [{ a, b, impact, speed, mred, x, y }] for every contact that hit hard
 * enough: speed is the approach speed, mred the reduced mass, impact their product.
 */
export function stepWorld(W, dt) {
    const bodies = W.bodies;
    const n = bodies.length;

    // forces and velocity damping
    const lin = Math.exp(-0.04 * dt), ang = Math.exp(-0.5 * dt);
    for (const b of bodies) {
        if (b.invMass === 0 || b.asleep) continue;
        b.vy -= GRAVITY * dt;
        if (W.wells && (b.tag === 'proj' || b.tag === 'shard')) {
            for (const well of W.wells) {
                const dx = well.x - b.x, dy = well.y - b.y, d2 = dx * dx + dy * dy + 4;
                const f = well.k / (d2 * Math.sqrt(d2));
                b.vx += dx * f * dt; b.vy += dy * f * dt;
            }
        }
        b.vx *= lin; b.vy *= lin; b.w *= ang;
    }

    // contacts
    const pairs = [];
    for (let i = 0; i < n; i++) {
        const A = bodies[i];
        for (let j = i + 1; j < n; j++) {
            const B = bodies[j];
            if (A.invMass === 0 && B.invMass === 0) continue;
            const aInert = A.invMass === 0 || A.asleep, bInert = B.invMass === 0 || B.asleep;
            if (aInert && bInert) continue;
            const dx = B.x - A.x, dy = B.y - A.y, rr = A.rad + B.rad;
            if (dx * dx + dy * dy > rr * rr) continue;
            const cs = collide(A, B);
            if (!cs) continue;
            if (A.asleep && A.invMass > 0 && moving(B)) wake(A);
            if (B.asleep && B.invMass > 0 && moving(A)) wake(B);
            pairs.push({ A, B, cs, key: A.id + ',' + B.id });
        }
    }

    // a sleeping body is as good as static for this step
    for (const b of bodies) {
        const live = b.invMass > 0 && !b.asleep;
        b.im = live ? b.invMass : 0;
        b.ii = live ? b.invI : 0;
    }

    const oldCache = W.cache || {};
    const contacts = [];
    for (const p of pairs) {
        const { A, B } = p;
        const old = oldCache[p.key];
        const fric = Math.sqrt(A.fric * B.fric), rest = Math.max(A.rest, B.rest);
        for (const c of p.cs) {
            c.A = A; c.B = B; c.pair = p;
            c.r1x = c.x - A.x; c.r1y = c.y - A.y; c.r2x = c.x - B.x; c.r2y = c.y - B.y;
            const rn1 = c.r1x * c.nx + c.r1y * c.ny, rn2 = c.r2x * c.nx + c.r2y * c.ny;
            const kn = A.im + B.im + A.ii * (c.r1x * c.r1x + c.r1y * c.r1y - rn1 * rn1)
                + B.ii * (c.r2x * c.r2x + c.r2y * c.r2y - rn2 * rn2);
            c.massN = kn > 0 ? 1 / kn : 0;
            c.tx = c.ny; c.ty = -c.nx;
            const rt1 = c.r1x * c.tx + c.r1y * c.ty, rt2 = c.r2x * c.tx + c.r2y * c.ty;
            const kt = A.im + B.im + A.ii * (c.r1x * c.r1x + c.r1y * c.r1y - rt1 * rt1)
                + B.ii * (c.r2x * c.r2x + c.r2y * c.r2y - rt2 * rt2);
            c.massT = kt > 0 ? 1 / kt : 0;
            c.bias = -BIAS / dt * Math.min(0, c.sep + SLOP);
            c.fric = fric;

            // approach speed before anything is solved: the impact, and the bounce
            const dvx = B.vx - B.w * c.r2y - A.vx + A.w * c.r1y;
            const dvy = B.vy + B.w * c.r2x - A.vy - A.w * c.r1x;
            const vn0 = dvx * c.nx + dvy * c.ny;
            c.vn0 = vn0;
            c.bounce = vn0 < -2 ? -rest * vn0 : 0;

            c.pn = 0; c.pt = 0;
            if (old) {
                for (const o of old) {
                    if ((o.x - c.x) ** 2 + (o.y - c.y) ** 2 < 0.0064) { c.pn = o.pn; c.pt = o.pt; break; }
                }
            }
            // warm start
            const px = c.pn * c.nx + c.pt * c.tx, py = c.pn * c.ny + c.pt * c.ty;
            A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (c.r1x * py - c.r1y * px);
            B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (c.r2x * py - c.r2y * px);
            contacts.push(c);
        }
    }

    for (let it = 0; it < ITERATIONS; it++) {
        for (const c of contacts) {
            const { A, B } = c;
            let dvx = B.vx - B.w * c.r2y - A.vx + A.w * c.r1y;
            let dvy = B.vy + B.w * c.r2x - A.vy - A.w * c.r1x;
            const vn = dvx * c.nx + dvy * c.ny;
            let dPn = c.massN * (-vn + c.bias + c.bounce);
            const pn0 = c.pn;
            c.pn = Math.max(pn0 + dPn, 0);
            dPn = c.pn - pn0;
            let px = dPn * c.nx, py = dPn * c.ny;
            A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (c.r1x * py - c.r1y * px);
            B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (c.r2x * py - c.r2y * px);

            dvx = B.vx - B.w * c.r2y - A.vx + A.w * c.r1y;
            dvy = B.vy + B.w * c.r2x - A.vy - A.w * c.r1x;
            const vt = dvx * c.tx + dvy * c.ty;
            let dPt = c.massT * -vt;
            const maxPt = c.fric * c.pn, pt0 = c.pt;
            c.pt = Math.max(-maxPt, Math.min(maxPt, pt0 + dPt));
            dPt = c.pt - pt0;
            px = dPt * c.tx; py = dPt * c.ty;
            A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (c.r1x * py - c.r1y * px);
            B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (c.r2x * py - c.r2y * px);
        }
    }

    // remember impulses for the next step, and collect the impacts
    const cache = {};
    const hits = [];
    for (const c of contacts) {
        (cache[c.pair.key] ||= []).push({ x: c.x, y: c.y, pn: c.pn, pt: c.pt });
        if (c.vn0 < -IMPACT_MIN) {
            const m = 1 / (c.A.invMass + c.B.invMass);          // reduced mass, sleepers included
            const p = c.pair;
            const impact = -c.vn0 * m;
            if (!p.hit || impact > p.hit.impact) {
                if (!p.hit) { p.hit = { a: c.A, b: c.B, impact, speed: -c.vn0, mred: m, x: c.x, y: c.y }; hits.push(p.hit); }
                else { p.hit.impact = impact; p.hit.speed = -c.vn0; p.hit.x = c.x; p.hit.y = c.y; }
            }
        }
    }
    W.cache = cache;

    // move, and put the still ones to sleep
    for (const b of bodies) {
        if (b.invMass === 0 || b.asleep) continue;
        b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
        const still = b.vx * b.vx + b.vy * b.vy < 0.0225 && Math.abs(b.w) * b.rad < 0.3;
        b.sleepT = still ? b.sleepT + dt : 0;
        if (b.sleepT > SLEEP_AFTER) { b.asleep = true; b.vx = b.vy = b.w = 0; }
    }
    return hits;
}
