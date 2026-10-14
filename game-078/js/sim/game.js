// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Treats are discs. The physics is sequential impulses with speculative contacts (a body may
// close a gap but never pass it), Coulomb friction that spins the discs, then a few passes
// that push out any overlap left. After the physics, two touching treats of the same kind
// merge into the next one up; the new one is checked again on the next step, so merges cascade.

import { JAR, PHYS, DROP, DANGER, MERGE, ITEMS, TOP_TIER, MIRACLE_PTS } from '../config.js';
import { makeRng, hash3 } from '../rng.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BROAD_MARGIN = 0.45;      // > maxSpeed * STEP, so a pair can't close a gap unseen

export function newGame(seed = 1) {
    const G = {
        v: 1,                       // save format version
        seed,
        rng: makeRng(seed),
        t: 0,
        score: 0,
        over: false,
        drops: 0,
        merges: 0,
        miracles: 0,
        topTier: 0,                 // the biggest treat made this game
        nextId: 1,
        bodies: [],
        dropper: { x: JAR.w / 2, tier: 0, cool: 0, pending: false },
        next: 0,
        danger: 0,                  // seconds a settled treat has been over the line (drains when clear)
        chain: 0,
        lastMerge: -99,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    G.dropper.tier = rollTier(G);
    G.next = rollTier(G);
    return G;
}

function rollTier(G) { return G.rng.weighted(DROP.weights); }

/** The radius a body has now: a fresh merge swells from its parents' size to its own. */
export function bodyRadius(b) {
    const R = ITEMS[b.tier].r;
    if (b.grow >= 1 || b.tier === 0) return R;
    const from = ITEMS[b.tier - 1].r;
    const k = 1 - (1 - b.grow) * (1 - b.grow);
    return from + (R - from) * k;
}

export function addBody(G, tier, x, y, grow = 1) {
    const id = G.nextId++;
    const b = { id, tier, x, y, vx: 0, vy: 0, a: (hash3(id, G.seed) - 0.5) * 0.8, w: 0, age: 0, grow, r: 0, im: 0, iI: 0 };
    setMass(b);
    G.bodies.push(b);
    return b;
}

function setMass(b) {
    b.r = bodyRadius(b);
    // mass ∝ r^1.5, not r²: a Jingle Bell is still 17× a peppermint, but the solver no longer
    // squeezes small treats into big ones under a heavy pile
    const m = Math.pow(b.r, 1.5);
    b.im = 1 / m;
    b.iI = 1 / (0.5 * m * b.r * b.r);
}

/**
 * Where a disc of radius r dropped at x would first come to rest: { y, hit } with hit the body
 * it lands on, or null for the floor. Used by the aim guide and the bot.
 */
export function landing(G, x, r) {
    let y = JAR.h - r, hit = null;
    for (const b of G.bodies) {
        const R = r + bodyRadius(b), dx = Math.abs(x - b.x);
        if (dx >= R) continue;
        const cy = b.y - Math.sqrt(R * R - dx * dx);
        if (cy < y) { y = cy; hit = b; }
    }
    return { y, hit };
}

/**
 * Advance one fixed step. inp = { dx, aim, drop }:
 * dx in [-1, 1] moves the dropper; aim (world x or null) puts it there; drop = pressed since the last step.
 */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    updateDropper(G, inp, dt);
    physics(G, dt);
    mergeTouching(G);
    checkDanger(G, dt);
}

function updateDropper(G, inp, dt) {
    const d = G.dropper;
    if (inp.aim != null && Number.isFinite(inp.aim)) d.x = inp.aim;
    else if (inp.dx) d.x += clamp(inp.dx, -1, 1) * DROP.speed * dt;
    const r = ITEMS[d.tier].r;
    d.x = clamp(d.x, r, JAR.w - r);
    if (d.cool > 0) d.cool = Math.max(0, d.cool - dt);
    if (inp.drop && d.cool <= DROP.buffer) d.pending = true;
    if (d.pending && d.cool <= 0) dropNow(G);
}

function dropNow(G) {
    const d = G.dropper;
    const b = addBody(G, d.tier, d.x, JAR.dropY);
    b.vy = 2;
    G.events.push({ type: 'drop', tier: d.tier, x: d.x, id: b.id });
    d.tier = G.next;
    G.next = rollTier(G);
    d.cool = DROP.cooldown;
    d.pending = false;
    const r = ITEMS[d.tier].r;
    d.x = clamp(d.x, r, JAR.w - r);
    G.drops++;
}

// ------------------------------------------------------------------ physics

/** Pairs of bodies (index i < j into G.bodies) whose discs are within `margin` of touching. */
function broadphase(B, margin) {
    const order = B.map((b, i) => i).sort((i, j) => (B[i].x - B[i].r) - (B[j].x - B[j].r) || B[i].id - B[j].id);
    const pairs = [];
    for (let p = 0; p < order.length; p++) {
        const A = B[order[p]];
        const reach = A.x + A.r + margin;
        for (let q = p + 1; q < order.length; q++) {
            const C = B[order[q]];
            if (C.x - C.r > reach) break;
            const R = A.r + C.r + margin;
            if (Math.abs(A.y - C.y) > R) continue;
            const dx = C.x - A.x, dy = C.y - A.y;
            if (dx * dx + dy * dy > R * R) continue;
            pairs.push(order[p] < order[q] ? [order[p], order[q]] : [order[q], order[p]]);
        }
    }
    pairs.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
    return pairs;
}

function physics(G, dt) {
    const B = G.bodies;
    if (!B.length) return;
    const ld = 1 / (1 + PHYS.linDamp * dt), ad = 1 / (1 + PHYS.angDamp * dt);
    for (const b of B) {
        b.age += dt;
        if (b.grow < 1) b.grow = Math.min(1, b.grow + dt / MERGE.grow);
        setMass(b);
        b.vy += PHYS.gravity * dt;
        b.vx *= ld; b.vy *= ld; b.w *= ad;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > PHYS.maxSpeed) { const k = PHYS.maxSpeed / sp; b.vx *= k; b.vy *= k; }
        b.impact = 0;
    }

    // Contacts: every close pair, and every wall or floor within reach. Bottom first, which
    // settles a stack in fewer passes.
    const pairs = broadphase(B, BROAD_MARGIN);
    const contacts = [];
    for (const [i, j] of pairs) contacts.push({ A: B[i], B: B[j], nx: 0, ny: 0, gap: 0, jn: 0, jt: 0 });
    for (const b of B) {
        if (b.x - b.r < BROAD_MARGIN) contacts.push({ A: b, B: null, nx: -1, ny: 0, gap: b.x - b.r, jn: 0, jt: 0 });
        if (JAR.w - b.x - b.r < BROAD_MARGIN) contacts.push({ A: b, B: null, nx: 1, ny: 0, gap: JAR.w - b.x - b.r, jn: 0, jt: 0 });
        if (JAR.h - b.y - b.r < BROAD_MARGIN) contacts.push({ A: b, B: null, nx: 0, ny: 1, gap: JAR.h - b.y - b.r, jn: 0, jt: 0 });
    }
    for (const c of contacts) {
        if (!c.B) continue;
        const dx = c.B.x - c.A.x, dy = c.B.y - c.A.y, d = Math.hypot(dx, dy);
        if (d < 1e-9) { c.nx = 0; c.ny = 1; } else { c.nx = dx / d; c.ny = dy / d; }
        c.gap = d - c.A.r - c.B.r;
    }
    const cy = (c) => (c.B ? (c.A.y + c.B.y) / 2 : c.A.y + (c.ny > 0 ? 1 : 0));
    contacts.sort((p, q) => cy(q) - cy(p) || p.A.id - q.A.id || (p.B ? p.B.id : -1) - (q.B ? q.B.id : -1) || p.nx - q.nx);

    for (let it = 0; it < PHYS.velIters; it++) for (const c of contacts) solveContact(c, dt);

    for (const b of B) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.a += b.w * dt;
    }

    // Push out what overlap is left. Positions only: this never adds speed, so a merged treat
    // swelling into its neighbours shoves them aside instead of firing them out of the jar.
    const near = broadphase(B, 0);
    for (let it = 0; it < PHYS.posIters; it++) {
        for (const [i, j] of near) {
            const A = B[i], C = B[j];
            const dx = C.x - A.x, dy = C.y - A.y, d = Math.hypot(dx, dy);
            const over = A.r + C.r - d;
            if (over <= PHYS.slop) continue;
            const nx = d < 1e-9 ? 0 : dx / d, ny = d < 1e-9 ? 1 : dy / d;
            const k = ((over - PHYS.slop) * PHYS.push) / (A.im + C.im);
            A.x -= nx * k * A.im; A.y -= ny * k * A.im;
            C.x += nx * k * C.im; C.y += ny * k * C.im;
        }
        for (const b of B) {
            if (b.x < b.r) b.x = b.r;
            if (b.x > JAR.w - b.r) b.x = JAR.w - b.r;
            if (b.y > JAR.h - b.r) b.y = JAR.h - b.r;
        }
    }

    // A noticeable hit becomes a 'bump' for the sound; one per body per step.
    for (const b of B) {
        if (b.impact > 4 && b.age > 0.05) G.events.push({ type: 'bump', x: b.x, y: b.y, tier: b.tier, power: Math.min(1, b.impact / 20) });
    }
}

/** One pass of one contact: a non-penetration impulse with a speculative gap, then friction. */
function solveContact(c, dt) {
    const A = c.A, C = c.B;
    const nx = c.nx, ny = c.ny, tx = -ny, ty = nx;
    const imB = C ? C.im : 0, iIB = C ? C.iI : 0, rb = C ? C.r : 0;
    const vbx = C ? C.vx : 0, vby = C ? C.vy : 0, wb = C ? C.w : 0;
    const ra = A.r;

    // normal: the pair may close the gap this step, but not pass it
    const vn = (vbx - A.vx) * nx + (vby - A.vy) * ny;
    // a gap may close this step but not be passed; an overlap is pushed apart gently
    const target = c.gap > 0 ? -c.gap / dt : Math.min(-c.gap * PHYS.bias / dt, PHYS.biasMax);
    const kn = A.im + imB;
    let jn = (target - vn) / kn;
    const acc = Math.max(0, c.jn + jn);
    jn = acc - c.jn;
    c.jn = acc;
    if (jn !== 0) {
        A.vx -= jn * nx * A.im; A.vy -= jn * ny * A.im;
        if (C) { C.vx += jn * nx * imB; C.vy += jn * ny * imB; }
        const hit = jn * (A.im + imB);
        if (hit > A.impact) A.impact = hit;
        if (C && hit > C.impact) C.impact = hit;
    }
    if (c.jn <= 0) return;

    // friction at the contact point, which also turns the discs
    const vbx2 = C ? C.vx : 0, vby2 = C ? C.vy : 0;
    const vt = (vbx2 - A.vx) * tx + (vby2 - A.vy) * ty - wb * rb - A.w * ra;
    const kt = A.im + imB + ra * ra * A.iI + rb * rb * iIB;
    const lim = PHYS.friction * c.jn;
    const jtAcc = clamp(c.jt - vt / kt, -lim, lim);
    const jt = jtAcc - c.jt;
    c.jt = jtAcc;
    A.vx -= jt * tx * A.im; A.vy -= jt * ty * A.im;
    A.w -= jt * ra * A.iI;
    if (C) {
        C.vx += jt * tx * imB; C.vy += jt * ty * imB;
        C.w -= jt * rb * iIB;
    }
}

// ------------------------------------------------------------------ merging

function mergeTouching(G) {
    const B = G.bodies;
    if (B.length < 2) return;
    const pairs = broadphase(B, MERGE.touch);
    const gone = new Set();
    const born = [];
    for (const [i, j] of pairs) {
        const A = B[i], C = B[j];
        if (A.tier !== C.tier || gone.has(A) || gone.has(C)) continue;
        if (Math.hypot(C.x - A.x, C.y - A.y) > A.r + C.r + MERGE.touch) continue;
        gone.add(A); gone.add(C);
        const x = (A.x + C.x) / 2, y = (A.y + C.y) / 2;

        if (G.t - G.lastMerge <= MERGE.chainWindow) G.chain++; else G.chain = 1;
        G.lastMerge = G.t;
        G.merges++;

        if (A.tier === TOP_TIER) {
            // two Jingle Bells: a Christmas Miracle, and both are gone
            const pts = MIRACLE_PTS + chainBonus(G, MIRACLE_PTS);
            G.score += pts;
            G.miracles++;
            G.events.push({ type: 'miracle', x, y, pts, chain: G.chain });
            continue;
        }
        const tier = A.tier + 1;
        const base = ITEMS[tier].pts;
        const pts = base + chainBonus(G, base);
        G.score += pts;
        if (tier > G.topTier) {
            G.topTier = tier;
            G.events.push({ type: 'newtop', tier });
        }
        born.push({ tier, x, y, vx: (A.vx + C.vx) / 2, vy: (A.vy + C.vy) / 2, w: (A.w + C.w) / 2 });
        G.events.push({ type: 'merge', tier, x, y, pts, chain: G.chain });
    }
    if (!gone.size) return;
    G.bodies = B.filter((b) => !gone.has(b));
    for (const n of born) {
        const b = addBody(G, n.tier, n.x, n.y, 0);
        // a parent still swelling from its own merge can sit lower than this one's radius allows
        b.x = clamp(b.x, b.r, JAR.w - b.r);
        b.y = Math.min(b.y, JAR.h - b.r);
        b.vx = n.vx; b.vy = n.vy - 1.5; b.w = n.w;
    }
}

function chainBonus(G, base) { return G.chain > 1 ? Math.floor(base * (G.chain - 1) * 0.5) : 0; }

// ------------------------------------------------------------------ the line

function checkDanger(G, dt) {
    let above = false;
    for (const b of G.bodies) {
        if (b.age > DANGER.grace && b.y - b.r < JAR.line) { above = true; break; }
    }
    if (above) {
        if (G.danger === 0) G.events.push({ type: 'warn' });
        G.danger += dt;
    } else G.danger = Math.max(0, G.danger - dt * DANGER.recover);
    if (G.danger >= DANGER.limit) {
        G.over = true;
        G.events.push({ type: 'over', score: G.score, topTier: G.topTier });
    }
}

// ------------------------------------------------------------------ saves

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!Array.isArray(d.bodies) || !d.dropper) throw new Error('malformed save');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    for (const b of G.bodies) {
        if (!(b.tier >= 0 && b.tier <= TOP_TIER) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) throw new Error('malformed body');
        setMass(b);
    }
    return G;
}
