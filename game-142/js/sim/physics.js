// 3D rigid bodies for Kaboom Keep: boxes and spheres on an infinite ground plane (y = 0).
//
// Pure, like the rest of js/sim: no clock, no randomness, no DOM. A world is plain data,
//   W = { bodies: [...], cache: { pairKey: [{ lp, jn, jt }] }, nextId }
// so a save is JSON and a seed replays exactly. stepWorld() mutates W and returns this step's impacts.
//
// The scheme is the usual one (Box2D, Bullet): separating axis tests for box-box with the
// incident face clipped against the reference face; sequential impulses with accumulated clamping,
// warm-started from the previous step through a cache matched by contact position; Coulomb friction
// on two tangents; Baumgarte position correction with a slop. Bodies sleep by island (a body can
// only sleep when everything it touches sleeps with it), and a sleeping body is static to the
// solver until something moving touches it or the game wakes it.
//
// Vectors are [x, y, z] arrays and quaternions [x, y, z, w]. Fields starting with "_" are
// recomputed every step from the saved state and are stripped by serialize().
// Normals point from body A to body B; A always has the smaller id, and the ground is B = null.

export const PHYS = {
    gravity: 11,
    iterations: 10,
    beta: 0.2,             // how much overlap is pushed out per step
    slop: 0.006,           // overlap tolerated, so resting contacts stay put
    maxBias: 3,            // the push-out never exceeds this speed (no pops)
    margin: 0.012,         // contacts are made a little before touching, so stacks keep theirs
    bounceMin: 1.4,        // approach speeds below this never bounce
    linDamp: 0.02,
    angDamp: 0.12,
    sleepV: 0.14, sleepW: 0.22, sleepT: 0.5,
    wakeV: 0.45, wakeW: 1.4,
    stackScale: 0.3,       // see 'Shock propagation' below
    matchTol2: 0.07 * 0.07, // a cached contact within 7 cm (in A's frame) warm-starts the new one
};

// ------------------------------------------------------------------ vector helpers
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0]; };
/** column k of a row-major 3×3 */
const axis = (R, k) => [R[k], R[3 + k], R[6 + k]];
const mulR = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
const mulRT = (R, v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];
export const vec = { dot, cross, sub, add, scale, len, norm, mulR, mulRT, axis };

export function quatToMat(q) {
    const [x, y, z, w] = q;
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    return [
        1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
        2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
        2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy),
    ];
}
export function quatFromAxisAngle(ax, ang) {
    const s = Math.sin(ang / 2);
    const a = norm(ax);
    return [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)];
}
export function quatMul(a, b) {
    return [
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
}
/** The body's local up axis in world space (y column of its rotation). */
export function upOf(b) {
    const [x, y, z, w] = b.q;
    return [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)];
}

// ------------------------------------------------------------------ bodies
export function makeWorld() { return { bodies: [], cache: {}, nextId: 1 }; }

/**
 * Add a body. o: { shape: 'box', h: [hx, hy, hz] } or { shape: 'sphere', r }, plus p, q, v, w,
 * density, fr (friction), re (restitution), st (static), and any game fields (kept as they are).
 */
export function addBody(W, o) {
    const b = {
        id: W.nextId++, shape: 'box', h: [0.5, 0.5, 0.5], r: 0.5,
        p: [0, 0, 0], q: [0, 0, 0, 1], v: [0, 0, 0], w: [0, 0, 0],
        density: 1, fr: 0.6, re: 0.05, st: false, sl: false, slT: 0,
        ...o,
    };
    b.p = [...b.p]; b.q = [...b.q]; b.v = [...b.v]; b.w = [...b.w];
    if (b.shape === 'box') b.h = [...b.h];
    setMass(b);
    W.bodies.push(b);
    return b;
}

export function setMass(b) {
    if (b.st) { b.m = 0; b.im = 0; b.ii = [0, 0, 0]; b.sl = false; return; }
    if (b.shape === 'sphere') {
        b.m = (4 / 3) * Math.PI * b.r ** 3 * b.density;
        const I = 0.4 * b.m * b.r * b.r;
        b.ii = [1 / I, 1 / I, 1 / I];
    } else {
        const [x, y, z] = b.h;
        b.m = 8 * x * y * z * b.density;
        b.ii = [3 / (b.m * (y * y + z * z)), 3 / (b.m * (x * x + z * z)), 3 / (b.m * (x * x + y * y))];
    }
    b.im = 1 / b.m;
}

export function wake(b) {
    if (b.st || !b.sl) return;
    b.sl = false; b.slT = 0;
}

export function removeBody(W, b) {
    const i = W.bodies.indexOf(b);
    if (i >= 0) W.bodies.splice(i, 1);
}

/** Radius of a sphere that holds the body. */
export const boundR = (b) => (b.shape === 'sphere' ? b.r : Math.hypot(b.h[0], b.h[1], b.h[2]));

function prepare(b) {
    b._R = quatToMat(b.q);
    const R = b._R;
    if (b.shape === 'sphere') {
        b._ex = [b.r, b.r, b.r];
    } else {
        const h = b.h;
        b._ex = [
            Math.abs(R[0]) * h[0] + Math.abs(R[1]) * h[1] + Math.abs(R[2]) * h[2],
            Math.abs(R[3]) * h[0] + Math.abs(R[4]) * h[1] + Math.abs(R[5]) * h[2],
            Math.abs(R[6]) * h[0] + Math.abs(R[7]) * h[1] + Math.abs(R[8]) * h[2],
        ];
    }
    prepInertia(b);
}

function prepInertia(b) {
    if (b.st || b.sl) { b._dyn = false; b._I = null; return; }
    b._dyn = true;
    const R = b._R, ii = b.ii;
    const I = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        I[r * 3 + c] = R[r * 3] * ii[0] * R[c * 3] + R[r * 3 + 1] * ii[1] * R[c * 3 + 1] + R[r * 3 + 2] * ii[2] * R[c * 3 + 2];
    }
    b._I = I;
}

// ------------------------------------------------------------------ narrowphase
// Each returns null or { n: A→B normal, pts: [{ p, d }] } with d > 0 meaning overlap.

function sphereGround(a) {
    const d = a.r - a.p[1];
    if (d < -PHYS.margin) return null;
    return { n: [0, -1, 0], pts: [{ p: [a.p[0], a.p[1] - a.r + d * 0.5, a.p[2]], d }] };
}

function boxGround(a) {
    const R = a._R, h = a.h;
    const pts = [];
    for (let i = 0; i < 8; i++) {
        const l = [(i & 1 ? 1 : -1) * h[0], (i & 2 ? 1 : -1) * h[1], (i & 4 ? 1 : -1) * h[2]];
        const c = add(a.p, mulR(R, l));
        if (c[1] < PHYS.margin) pts.push({ p: [c[0], c[1] * 0.5, c[2]], d: -c[1] });
    }
    if (!pts.length) return null;
    if (pts.length > 4) { pts.sort((x, y) => y.d - x.d); pts.length = 4; }
    return { n: [0, -1, 0], pts };
}

function sphereSphere(a, b) {
    const D = sub(b.p, a.p);
    const dist = len(D);
    const d = a.r + b.r - dist;
    if (d < -PHYS.margin) return null;
    const n = dist > 1e-9 ? scale(D, 1 / dist) : [0, 1, 0];
    return { n, pts: [{ p: add(a.p, scale(n, a.r - d * 0.5)), d }] };
}

/** sphere s against box x; normal from the sphere to the box */
function sphereBox(s, x) {
    const R = x._R, h = x.h;
    const c = mulRT(R, sub(s.p, x.p));
    const q = [Math.max(-h[0], Math.min(h[0], c[0])), Math.max(-h[1], Math.min(h[1], c[1])), Math.max(-h[2], Math.min(h[2], c[2]))];
    const delta = sub(c, q);
    const dist = len(delta);
    if (dist > s.r + PHYS.margin) return null;
    let nOut, d, pLocal;
    if (dist > 1e-7) {
        nOut = scale(delta, 1 / dist);          // box surface → sphere centre, box frame
        d = s.r - dist;
        pLocal = q;
    } else {
        // the centre is inside: push out through the nearest face
        let k = 0, best = Infinity;
        for (let i = 0; i < 3; i++) { const g = h[i] - Math.abs(c[i]); if (g < best) { best = g; k = i; } }
        nOut = [0, 0, 0]; nOut[k] = c[k] >= 0 ? 1 : -1;
        d = s.r + best;
        pLocal = [...c]; pLocal[k] = nOut[k] * h[k];
    }
    const nw = mulR(R, nOut);
    const pw = add(x.p, mulR(R, pLocal));
    return { n: scale(nw, -1), pts: [{ p: add(pw, scale(nw, d * 0.5)), d }] };
}

function clipPoly(poly, n, off) {
    // keep the part of poly with dot(n, x) <= off
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const da = dot(n, a) - off, db = dot(n, b) - off;
        if (da <= 0) out.push(a);
        if ((da <= 0) !== (db <= 0)) {
            const t = da / (da - db);
            out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        }
    }
    return out;
}

function reduce4(pts) {
    if (pts.length <= 4) return pts;
    let i0 = 0;
    for (let i = 1; i < pts.length; i++) if (pts[i].d > pts[i0].d) i0 = i;
    const far = (pick) => {
        let bi = -1, bv = -1;
        for (let i = 0; i < pts.length; i++) {
            if (pick.includes(i)) continue;
            let m = Infinity;
            for (const j of pick) { const e = sub(pts[i].p, pts[j].p); m = Math.min(m, dot(e, e)); }
            if (m > bv) { bv = m; bi = i; }
        }
        return bi;
    };
    const pick = [i0];
    while (pick.length < 4) pick.push(far(pick));
    return pick.map((i) => pts[i]);
}

function boxBox(A, B) {
    const RA = A._R, RB = B._R, hA = A.h, hB = B.h;
    const T = sub(B.p, A.p);
    const a = [axis(RA, 0), axis(RA, 1), axis(RA, 2)];
    const b = [axis(RB, 0), axis(RB, 1), axis(RB, 2)];
    const C = [];          // C[i][j] = a_i · b_j
    for (let i = 0; i < 3; i++) C.push([dot(a[i], b[0]), dot(a[i], b[1]), dot(a[i], b[2])]);
    const M = PHYS.margin;

    let best = -Infinity, bestKind = 0, bestI = 0, bestJ = 0, bestN = null;
    // faces of A
    for (let i = 0; i < 3; i++) {
        const t = dot(T, a[i]);
        const s = Math.abs(t) - (hA[i] + hB[0] * Math.abs(C[i][0]) + hB[1] * Math.abs(C[i][1]) + hB[2] * Math.abs(C[i][2]));
        if (s > M) return null;
        if (s > best) { best = s; bestKind = 1; bestI = i; bestN = t >= 0 ? a[i] : scale(a[i], -1); }
    }
    // faces of B
    for (let j = 0; j < 3; j++) {
        const t = dot(T, b[j]);
        const s = Math.abs(t) - (hB[j] + hA[0] * Math.abs(C[0][j]) + hA[1] * Math.abs(C[1][j]) + hA[2] * Math.abs(C[2][j]));
        if (s > M) return null;
        // prefer A's faces a little, so a face pair doesn't flip reference every step
        if (s > 0.95 * best + 0.01 * Math.min(hA[0], hA[1], hA[2], hB[0], hB[1], hB[2])) { best = s; bestKind = 2; bestI = j; bestN = t >= 0 ? b[j] : scale(b[j], -1); }
    }
    const faceBest = best;
    // edge-edge
    let edgeBest = -Infinity, eI = 0, eJ = 0, eN = null;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        let L = cross(a[i], b[j]);
        const l = len(L);
        if (l < 1e-4) continue;
        L = scale(L, 1 / l);
        const t = dot(T, L);
        const rA = hA[0] * Math.abs(dot(a[0], L)) + hA[1] * Math.abs(dot(a[1], L)) + hA[2] * Math.abs(dot(a[2], L));
        const rB = hB[0] * Math.abs(dot(b[0], L)) + hB[1] * Math.abs(dot(b[1], L)) + hB[2] * Math.abs(dot(b[2], L));
        const s = Math.abs(t) - (rA + rB);
        if (s > M) return null;
        if (s > edgeBest) { edgeBest = s; eI = i; eJ = j; eN = t >= 0 ? L : scale(L, -1); }
    }

    if (edgeBest > faceBest + 0.02) {
        // edge contact: closest points of the two edges
        const n = eN;
        const pa = [...A.p], pb = [...B.p];
        for (let k = 0; k < 3; k++) {
            if (k !== eI) { const s = dot(a[k], n) > 0 ? 1 : -1; pa[0] += a[k][0] * hA[k] * s; pa[1] += a[k][1] * hA[k] * s; pa[2] += a[k][2] * hA[k] * s; }
            if (k !== eJ) { const s = dot(b[k], n) > 0 ? -1 : 1; pb[0] += b[k][0] * hB[k] * s; pb[1] += b[k][1] * hB[k] * s; pb[2] += b[k][2] * hB[k] * s; }
        }
        const da = a[eI], db = b[eJ];
        const r = sub(pa, pb);
        const aa = dot(da, da), bb = dot(db, db), ab = dot(da, db), ar = dot(da, r), br = dot(db, r);
        const den = aa * bb - ab * ab;
        let s = den > 1e-9 ? (ab * br - bb * ar) / den : 0;
        s = Math.max(-hA[eI], Math.min(hA[eI], s));
        let t = (ab * s + br) / bb;
        t = Math.max(-hB[eJ], Math.min(hB[eJ], t));
        const ca = add(pa, scale(da, s)), cb = add(pb, scale(db, t));
        return { n, pts: [{ p: scale(add(ca, cb), 0.5), d: -edgeBest }] };
    }

    // face contact
    const n = bestN;                                   // A → B
    const refIsA = bestKind === 1;
    const ref = refIsA ? A : B, inc = refIsA ? B : A;
    const Rr = refIsA ? a : b, Ri = refIsA ? b : a;
    const hr = ref.h, hi = inc.h;
    const nRef = refIsA ? n : scale(n, -1);            // out of the reference face, toward the incident box
    const k = bestI;
    // incident face: the face of inc most opposed to nRef
    let ik = 0, iv = 0;
    for (let j = 0; j < 3; j++) { const d = dot(Ri[j], nRef); if (Math.abs(d) > Math.abs(iv)) { iv = d; ik = j; } }
    const inN = scale(Ri[ik], iv > 0 ? -1 : 1);
    const ic = add(inc.p, scale(inN, hi[ik]));
    const u1 = (ik + 1) % 3, u2 = (ik + 2) % 3;
    const e1 = scale(Ri[u1], hi[u1]), e2 = scale(Ri[u2], hi[u2]);
    let poly = [
        add(add(ic, e1), e2), add(sub(ic, e1), e2), sub(sub(ic, e1), e2), sub(add(ic, e1), e2),
    ];
    const rc = add(ref.p, scale(nRef, hr[k]));
    const s1 = (k + 1) % 3, s2 = (k + 2) % 3;
    const S1 = Rr[s1], S2 = Rr[s2];
    const o1 = dot(S1, ref.p), o2 = dot(S2, ref.p);
    poly = clipPoly(poly, S1, o1 + hr[s1]);
    if (poly.length) poly = clipPoly(poly, scale(S1, -1), -o1 + hr[s1]);
    if (poly.length) poly = clipPoly(poly, S2, o2 + hr[s2]);
    if (poly.length) poly = clipPoly(poly, scale(S2, -1), -o2 + hr[s2]);
    const pts = [];
    const refOff = dot(nRef, rc);
    for (const x of poly) {
        const d = refOff - dot(nRef, x);
        if (d > -M) pts.push({ p: add(x, scale(nRef, d * 0.5)), d });
    }
    if (!pts.length) return null;
    return { n, pts: reduce4(pts) };
}

function collide(A, B) {
    if (A.shape === 'sphere' && B.shape === 'sphere') return sphereSphere(A, B);
    if (A.shape === 'sphere') return sphereBox(A, B);
    if (B.shape === 'sphere') {
        const c = sphereBox(B, A);
        if (c) c.n = scale(c.n, -1);
        return c;
    }
    return boxBox(A, B);
}

// ------------------------------------------------------------------ step
/**
 * Advance the world by dt. Returns the impacts of this step, one per touching pair:
 *   { a, b (null = ground), j: total normal impulse, vn: fastest approach speed, p: a contact point }
 * opts.filter(a, b) → false skips a pair (e.g. a ball and the cannon that fired it).
 */
export function stepWorld(W, dt, opts = {}) {
    const bodies = W.bodies;
    const g = PHYS.gravity;
    for (const b of bodies) prepare(b);

    // forces
    const ld = Math.max(0, 1 - PHYS.linDamp * dt), ad = Math.max(0, 1 - PHYS.angDamp * dt);
    for (const b of bodies) {
        if (!b._dyn) continue;
        b.v[1] -= g * dt * (b.gs ?? 1);
        b.v[0] *= ld; b.v[1] *= ld; b.v[2] *= ld;
        b.w[0] *= ad; b.w[1] *= ad; b.w[2] *= ad;
    }

    // broadphase: sweep and prune along x
    const order = bodies.map((b, i) => i);
    const minX = bodies.map((b) => b.p[0] - b._ex[0] - PHYS.margin);
    order.sort((i, j) => minX[i] - minX[j] || bodies[i].id - bodies[j].id);
    const manifolds = [];
    for (let oi = 0; oi < order.length; oi++) {
        const A0 = bodies[order[oi]];
        const maxX = A0.p[0] + A0._ex[0] + PHYS.margin;
        for (let oj = oi + 1; oj < order.length; oj++) {
            const B0 = bodies[order[oj]];
            if (minX[order[oj]] > maxX) break;
            if (!A0._dyn && !B0._dyn) continue;
            if (Math.abs(A0.p[1] - B0.p[1]) > A0._ex[1] + B0._ex[1] + PHYS.margin) continue;
            if (Math.abs(A0.p[2] - B0.p[2]) > A0._ex[2] + B0._ex[2] + PHYS.margin) continue;
            if (opts.filter && !opts.filter(A0, B0)) continue;
            const [A, B] = A0.id < B0.id ? [A0, B0] : [B0, A0];
            const c = collide(A, B);
            if (c) manifolds.push({ a: A, b: B, n: c.n, pts: c.pts });
        }
    }
    for (const b of bodies) {
        if (!b._dyn || b.p[1] - b._ex[1] > PHYS.margin) continue;
        const c = b.shape === 'sphere' ? sphereGround(b) : boxGround(b);
        if (c) manifolds.push({ a: b, b: null, n: c.n, pts: c.pts });
    }

    // wake sleepers touched by something moving
    for (const m of manifolds) {
        const A = m.a, B = m.b;
        if (!B) continue;
        const moving = (x) => x._dyn && (dot(x.v, x.v) > PHYS.wakeV ** 2 || dot(x.w, x.w) > PHYS.wakeW ** 2);
        if (A.sl && moving(B)) { wake(A); prepInertia(A); }
        else if (B.sl && moving(A)) { wake(B); prepInertia(B); }
    }

    // build contacts
    const contacts = [];
    const newCache = {};
    for (const m of manifolds) {
        const A = m.a, B = m.b;
        const aDyn = A._dyn, bDyn = B ? B._dyn : false;
        if (!aDyn && !bDyn) continue;
        const key = A.id + '_' + (B ? B.id : 0);
        const old = W.cache[key];
        const fr = Math.sqrt(A.fr * (B ? B.fr : 0.8));
        const re = Math.max(A.re, B ? B.re : 0.1);
        const n = m.n;
        const t1 = norm(Math.abs(n[0]) < 0.6 ? cross(n, [1, 0, 0]) : cross(n, [0, 0, 1]));
        const t2 = cross(n, t1);
        let imA = aDyn ? A.im : 0, imB = bDyn ? B.im : 0;
        let IA = aDyn ? A._I : null, IB = bDyn ? B._I : null;
        // Shock propagation, lite: in a mostly vertical contact between two moving bodies, the one
        // underneath answers as if it were heavier. Stacks then settle in a few steps instead of
        // rocking while the solver slowly converges down a tall column.
        if (aDyn && bDyn && Math.abs(n[1]) > 0.7 && PHYS.stackScale < 1) {
            const k = PHYS.stackScale;
            const lowerIsA = n[1] > 0;          // n points from A to B: B is above A
            if (lowerIsA) { imA *= k; IA = IA.map((x) => x * k); } else { imB *= k; IB = IB.map((x) => x * k); }
        }
        const effMass = (dir, rA, rB) => {
            let k = imA + imB;
            if (IA) { const x = cross(rA, dir); k += dot(cross(mulR(IA, x), rA), dir); }
            if (IB) { const x = cross(rB, dir); k += dot(cross(mulR(IB, x), rB), dir); }
            return k > 1e-12 ? 1 / k : 0;
        };
        m.c = [];
        for (const pt of m.pts) {
            const rA = sub(pt.p, A.p);
            const rB = B ? sub(pt.p, B.p) : [0, 0, 0];
            const vrel = relVel(A, B, rA, rB);
            const vn = dot(vrel, n);
            // overlapping: push out (gently); apart (a speculative contact): allow closing the gap this step
            let bias = pt.d < 0 ? pt.d / dt : PHYS.beta / dt * Math.max(0, pt.d - PHYS.slop);
            if (bias > PHYS.maxBias) bias = PHYS.maxBias;
            if (vn < -PHYS.bounceMin && re > 0) bias = Math.max(bias, -re * vn);
            const c = {
                A, B, aDyn, bDyn, n, t1, t2, rA, rB, imA, imB, IA, IB,
                mn: effMass(n, rA, rB), m1: effMass(t1, rA, rB), m2: effMass(t2, rA, rB),
                bias, fr, jn: 0, j1: 0, j2: 0, vn0: -vn,
                lp: mulRT(A._R, rA),
            };
            if (old) {
                let bi = -1, bd = PHYS.matchTol2;
                for (let i = 0; i < old.length; i++) {
                    const e = sub(old[i].lp, c.lp);
                    const d2 = dot(e, e);
                    if (d2 < bd) { bd = d2; bi = i; }
                }
                if (bi >= 0) {
                    const o = old[bi];
                    c.jn = o.jn;
                    c.j1 = dot(o.jt, t1); c.j2 = dot(o.jt, t2);
                }
            }
            m.c.push(c);
            contacts.push(c);
        }
    }

    // warm start
    for (const c of contacts) {
        const P = [c.n[0] * c.jn + c.t1[0] * c.j1 + c.t2[0] * c.j2, c.n[1] * c.jn + c.t1[1] * c.j1 + c.t2[1] * c.j2, c.n[2] * c.jn + c.t1[2] * c.j1 + c.t2[2] * c.j2];
        applyImpulse(c, P);
    }

    // iterate
    for (let it = 0; it < PHYS.iterations; it++) {
        for (const c of contacts) {
            // friction first, bounded by the current normal impulse
            const vr = relVel(c.A, c.B, c.rA, c.rB);
            const lim = c.fr * c.jn;
            let d1 = -dot(vr, c.t1) * c.m1, d2 = -dot(vr, c.t2) * c.m2;
            let n1 = c.j1 + d1, n2 = c.j2 + d2;
            const tl = Math.hypot(n1, n2);
            if (tl > lim) { const k = tl > 1e-12 ? lim / tl : 0; n1 *= k; n2 *= k; }
            d1 = n1 - c.j1; d2 = n2 - c.j2;
            c.j1 = n1; c.j2 = n2;
            applyImpulse(c, [c.t1[0] * d1 + c.t2[0] * d2, c.t1[1] * d1 + c.t2[1] * d2, c.t1[2] * d1 + c.t2[2] * d2]);
            // normal
            const vr2 = relVel(c.A, c.B, c.rA, c.rB);
            const vn = dot(vr2, c.n);
            let dj = (-vn + c.bias) * c.mn;
            const nj = Math.max(0, c.jn + dj);
            dj = nj - c.jn;
            c.jn = nj;
            applyImpulse(c, scale(c.n, dj));
        }
    }

    // integrate positions
    for (const b of bodies) {
        if (!b._dyn) continue;
        const dx = b.v[0] * dt, dy = b.v[1] * dt, dz = b.v[2] * dt;
        // A fast sphere (a cannonball) is swept along its path and stopped at the first thing it
        // would touch, so it can't step through a wall between two frames. The contact next step
        // then does the hitting.
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (b.shape === 'sphere' && dist > b.r * 0.5) {
            const d = [dx / dist, dy / dist, dz / dist];
            let tHit = dist;
            if (d[1] < 0) { const tg = (b.p[1] - b.r) / -d[1]; if (tg >= 0 && tg < tHit) tHit = tg; }
            for (const o of bodies) {
                if (o === b || (opts.filter && !opts.filter(b, o))) continue;
                const reach = dist + b.r + boundR(o);
                const e = sub(o.p, b.p);
                if (dot(e, e) > reach * reach) continue;
                const t = rayBody(o, b.p, d, tHit, b.r);
                if (t < tHit) tHit = t;
            }
            if (tHit < dist) {
                const k = Math.max(0, tHit - 0.01);
                b.p[0] += d[0] * k; b.p[1] += d[1] * k; b.p[2] += d[2] * k;
            } else { b.p[0] += dx; b.p[1] += dy; b.p[2] += dz; }
        } else { b.p[0] += dx; b.p[1] += dy; b.p[2] += dz; }
        const w = b.w;
        const q = b.q;
        const dq = quatMul([w[0], w[1], w[2], 0], q);
        q[0] += 0.5 * dt * dq[0]; q[1] += 0.5 * dt * dq[1]; q[2] += 0.5 * dt * dq[2]; q[3] += 0.5 * dt * dq[3];
        const l = Math.hypot(q[0], q[1], q[2], q[3]);
        q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
    }

    // cache and impacts
    const impacts = [];
    for (const m of manifolds) {
        if (!m.c || !m.c.length) continue;
        const key = m.a.id + '_' + (m.b ? m.b.id : 0);
        let j = 0, vn = 0;
        newCache[key] = m.c.map((c) => {
            j += c.jn; vn = Math.max(vn, c.vn0);
            const jt = [c.t1[0] * c.j1 + c.t2[0] * c.j2, c.t1[1] * c.j1 + c.t2[1] * c.j2, c.t1[2] * c.j1 + c.t2[2] * c.j2];
            return { lp: c.lp.map(r6), jn: r6(c.jn), jt: jt.map(r6) };
        });
        impacts.push({ a: m.a, b: m.b, j, vn, p: m.pts[0].p, n: m.n });
    }
    W.cache = newCache;

    sleepIslands(W, manifolds, dt);
    return impacts;
}

// Cached impulses are rounded so a save (JSON) and the live world agree to the last bit.
// (JSON round-trips doubles exactly; rounding only keeps the cache small.)
const r6 = (x) => Math.round(x * 1e6) / 1e6;

function relVel(A, B, rA, rB) {
    const va = A._dyn ? add(A.v, cross(A.w, rA)) : [0, 0, 0];
    const vb = B && B._dyn ? add(B.v, cross(B.w, rB)) : [0, 0, 0];
    return sub(vb, va);
}

function applyImpulse(c, P) {
    if (c.aDyn) {
        const A = c.A;
        A.v[0] -= P[0] * c.imA; A.v[1] -= P[1] * c.imA; A.v[2] -= P[2] * c.imA;
        const dw = mulR(c.IA, cross(c.rA, P));
        A.w[0] -= dw[0]; A.w[1] -= dw[1]; A.w[2] -= dw[2];
    }
    if (c.bDyn) {
        const B = c.B;
        B.v[0] += P[0] * c.imB; B.v[1] += P[1] * c.imB; B.v[2] += P[2] * c.imB;
        const dw = mulR(c.IB, cross(c.rB, P));
        B.w[0] += dw[0]; B.w[1] += dw[1]; B.w[2] += dw[2];
    }
}

function sleepIslands(W, manifolds, dt) {
    const bodies = W.bodies;
    const idx = new Map();
    bodies.forEach((b, i) => idx.set(b, i));
    const parent = bodies.map((b, i) => i);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (const m of manifolds) {
        if (!m.b || !m.a._dyn || !m.b._dyn) continue;
        const ra = find(idx.get(m.a)), rb = find(idx.get(m.b));
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    }
    const minT = new Map();
    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (!b._dyn) continue;
        if (b.nosleep || dot(b.v, b.v) > PHYS.sleepV ** 2 || dot(b.w, b.w) > PHYS.sleepW ** 2) b.slT = 0;
        else b.slT += dt;
        const r = find(i);
        minT.set(r, Math.min(minT.has(r) ? minT.get(r) : Infinity, b.slT));
    }
    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (!b._dyn) continue;
        if (minT.get(find(i)) >= PHYS.sleepT) {
            b.sl = true; b.slT = 0;
            b.v = [0, 0, 0]; b.w = [0, 0, 0];
        }
    }
}

// ------------------------------------------------------------------ queries
/** Bodies whose bounding sphere is within r of point p. */
export function bodiesNear(W, p, r) {
    const out = [];
    for (const b of W.bodies) {
        const d = len(sub(b.p, p)) - boundR(b);
        if (d < r) out.push(b);
    }
    return out;
}

/** Closest point on body b to point p (world). */
export function closestPoint(b, p) {
    if (b.shape === 'sphere') {
        const d = sub(p, b.p), l = len(d);
        return l <= b.r ? [...p] : add(b.p, scale(d, b.r / l));
    }
    const R = quatToMat(b.q);
    const c = mulRT(R, sub(p, b.p));
    const q = [0, 1, 2].map((i) => Math.max(-b.h[i], Math.min(b.h[i], c[i])));
    return add(b.p, mulR(R, q));
}

/** Apply an impulse P at world point x to body b. */
export function impulseAt(b, P, x) {
    if (b.st) return;
    wake(b);
    const R = quatToMat(b.q);
    b._R = R;
    prepInertia(b);
    b.v[0] += P[0] * b.im; b.v[1] += P[1] * b.im; b.v[2] += P[2] * b.im;
    const dw = mulR(b._I, cross(sub(x, b.p), P));
    b.w[0] += dw[0]; b.w[1] += dw[1]; b.w[2] += dw[2];
}

/**
 * Ray against a body (grown by pad on every side): origin o, unit direction d, up to maxT.
 * Returns t or Infinity.
 */
export function rayBody(b, o, d, maxT, pad = 0) {
    if (b.shape === 'sphere') {
        const m = sub(o, b.p);
        const rr = b.r + pad;
        const B = dot(m, d), C = dot(m, m) - rr * rr;
        if (C > 0 && B > 0) return Infinity;
        const disc = B * B - C;
        if (disc < 0) return Infinity;
        const t = Math.max(0, -B - Math.sqrt(disc));
        return t <= maxT ? t : Infinity;
    }
    const R = quatToMat(b.q);
    const lo = mulRT(R, sub(o, b.p)), ld = mulRT(R, d);
    let t0 = 0, t1 = maxT;
    for (let i = 0; i < 3; i++) {
        const hh = b.h[i] + pad;
        if (Math.abs(ld[i]) < 1e-9) { if (Math.abs(lo[i]) > hh) return Infinity; continue; }
        let a = (-hh - lo[i]) / ld[i], c = (hh - lo[i]) / ld[i];
        if (a > c) { const s = a; a = c; c = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) return Infinity;
    }
    return t0;
}

/** Strip the per-step scratch fields, for a save. */
export function cleanBody(b) {
    const o = {};
    for (const k in b) if (k[0] !== '_') o[k] = b[k];
    return o;
}
