/**
 * rig.js — a 2D side-view skeleton that turns a pose (a handful of joint
 * angles) into palette-indexed pixel art.
 *
 * Rig space: x points the way the fighter faces, y points up, origin on the
 * ground under the hips, units are pixels at scale 1. Angles are degrees:
 *   lean        torso tilt from vertical, + leans forward
 *   head        head tilt relative to the torso
 *   fsh / bsh   front / back upper arm, measured from "hanging along the
 *               torso"; 90 points straight ahead
 *   fel / bel   elbow: forearm relative to the upper arm, + folds forward/up
 *   fhip / bhip thigh from straight down, + forward
 *   fkn / bkn   knee bend, + folds the shin backward
 *   spin        whole-body rotation about the waist, + is counter-clockwise
 *               (a fighter knocked onto their back is spin 90)
 *   dx, dy      offset applied after grounding; air: don't ground the feet
 *   hair        extra swing for hair/scarf chains
 *
 * Draw order is back-to-front by layer, each layer its own outline group, so
 * a front arm gets a dark line where it crosses the body but the elbow joint
 * of one arm does not.
 */

import { capsule, ellipse, polygon, dot, matBase, OUTLINE } from './raster.js';

const D2R = Math.PI / 180;
const LAYERS = ['back', 'barm', 'bleg', 'torso', 'fleg', 'head', 'farm', 'top'];
const GROUP = { back: 7, barm: 1, bleg: 2, torso: 3, fleg: 4, head: 5, farm: 6, top: 8 };

const v = (x, y) => ({ x, y });
const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const dirUp = (deg) => ({ x: Math.sin(deg * D2R), y: Math.cos(deg * D2R) });      // 0 = up
const dirDown = (deg) => ({ x: Math.sin(deg * D2R), y: -Math.cos(deg * D2R) });   // 0 = down

/** Solve joint positions and bone frames for a pose (ungrounded, hip at 0,0). */
export function solve(body, pose) {
    const lean = pose.lean || 0;
    const H = v(0, 0);
    const up = dirUp(lean);
    const C = add(H, up, body.torso);
    const hdir = dirUp(lean + (pose.head || 0));
    const N = add(C, up, body.neck * 0.5);
    const HC = add(N, hdir, body.neck * 0.5 + body.headR * 0.85);
    const fwd = { x: up.y, y: -up.x };   // torso's forward perpendicular
    const S = add(C, up, -body.shoulderDrop);
    const Sf = add(S, fwd, 0.6), Sb = add(S, fwd, -0.9);

    const arm = (Sx, sh, el) => {
        const a1 = lean + sh, a2 = a1 + el;
        const u1 = dirDown(a1), u2 = dirDown(a2);
        const E = add(Sx, u1, body.upperArm);
        const Hd = add(E, u2, body.foreArm);
        return { S: Sx, E, Hd, u1, u2 };
    };
    const leg = (Hx, hip, kn) => {
        const u1 = dirDown(hip), u2 = dirDown(hip - kn);
        const K = add(Hx, u1, body.thigh);
        const A = add(K, u2, body.shin);
        // foot points forward, perpendicular to the shin
        const fu = { x: -u2.y, y: u2.x };
        const T = add(A, fu, body.foot);
        return { H: Hx, K, A, T, u1, u2, fu };
    };
    const Hf = add(H, fwd, 0.8), Hb = add(H, fwd, -0.8);
    const af = arm(Sf, pose.fsh ?? 0, pose.fel ?? 0);
    const ab = arm(Sb, pose.bsh ?? 0, pose.bel ?? 0);
    const lf = leg(Hf, pose.fhip ?? 0, pose.fkn ?? 0);
    const lb = leg(Hb, pose.bhip ?? 0, pose.bkn ?? 0);

    const bones = {
        hip:    { p: H, u: up },
        torso:  { p: H, u: up },
        chest:  { p: C, u: up },
        head:   { p: HC, u: hdir },
        neck:   { p: C, u: hdir },
        uarmF:  { p: af.S, u: af.u1 }, farmF: { p: af.E, u: af.u2 }, handF: { p: af.Hd, u: af.u2 },
        uarmB:  { p: ab.S, u: ab.u1 }, farmB: { p: ab.E, u: ab.u2 }, handB: { p: ab.Hd, u: ab.u2 },
        thighF: { p: lf.H, u: lf.u1 }, shinF: { p: lf.K, u: lf.u2 }, footF: { p: lf.A, u: lf.fu },
        thighB: { p: lb.H, u: lb.u1 }, shinB: { p: lb.K, u: lb.u2 }, footB: { p: lb.A, u: lb.fu },
    };
    return { H, C, N, HC, af, ab, lf, lb, bones, up };
}

// Bone frame: `along` follows the bone, `side` is the bone rotated clockwise
// (for an upright bone that's forward; for a hanging limb it's backward).
function bp(bone, at) {
    const u = bone.u, s = { x: u.y, y: -u.x };
    return { x: bone.p.x + u.x * at[0] + s.x * at[1], y: bone.p.y + u.y * at[0] + s.y * at[1] };
}
const boneAng = (bone) => Math.atan2(bone.u.y, bone.u.x);

/**
 * Build the ordered draw-op list for a character in a pose (rig space,
 * grounded). Returns { ops, hand: {x,y,ang}, head: {x,y} }.
 */
export function buildOps(ch, pose, idleHip, scale = 1) {
    const B = ch.body, W = ch.w, M = ch.m;
    const sol = solve(B, pose);
    const bones = sol.bones;
    const mi = (name) => ch.matIndex[name] ?? 0;
    const byLayer = {};
    for (const L of LAYERS) byLayer[L] = [];
    const push = (L, op) => byLayer[L].push(op);

    // --- base body ---
    const limb = (L, a, b, r1, r2, m, mode) => push(L, { t: 'cap', a, b, r1, r2, m: mi(m), mode });
    // back limbs a touch darker for depth
    const BK = ch.flatBack ? 'back' : undefined;
    if (!ch.noArms) {
        limb('barm', sol.ab.S, sol.ab.E, W.uarm[0], W.uarm[1], M.arm, BK);
        limb('barm', sol.ab.E, sol.ab.Hd, W.farm[0], W.farm[1], M.forearm || M.arm, BK);
        push('barm', { t: 'ell', c: sol.ab.Hd, rx: W.hand, ry: W.hand * 0.9, rot: 0, m: mi(M.hand), mode: BK });
    }
    if (!ch.noLegs) {
        limb('bleg', sol.lb.H, sol.lb.K, W.thigh[0], W.thigh[1], M.leg, BK);
        limb('bleg', sol.lb.K, sol.lb.A, W.shin[0], W.shin[1], M.shin || M.leg, BK);
        limb('bleg', sol.lb.A, sol.lb.T, W.foot, W.foot * 0.85, M.foot, BK);
    }
    if (!ch.noTorso) {
        // waist -> chest, plus a pelvis blob
        const chestC = add(sol.H, sol.up, B.torso * 0.62);
        limb('torso', add(sol.H, sol.up, 1), chestC, W.waist, W.chest, M.torso);
        push('torso', { t: 'ell', c: add(sol.H, sol.up, B.torso * 0.66), rx: W.chest * 1.05, ry: W.chest * (W.chestY || 0.95), rot: boneAng(bones.torso), m: mi(M.chest || M.torso) });
        push('torso', { t: 'ell', c: add(sol.H, sol.up, 0.5), rx: W.hips * 0.8, ry: W.hips, rot: boneAng(bones.torso), m: mi(M.pelvis || M.leg) });
    }
    if (!ch.noLegs) {
        limb('fleg', sol.lf.H, sol.lf.K, W.thigh[0], W.thigh[1], M.leg);
        limb('fleg', sol.lf.K, sol.lf.A, W.shin[0], W.shin[1], M.shin || M.leg);
        limb('fleg', sol.lf.A, sol.lf.T, W.foot, W.foot * 0.85, M.foot);
    }
    if (!ch.noHead) {
        push('head', { t: 'cap', a: sol.C, b: add(sol.HC, bones.head.u, -B.headR * 0.4), r1: W.neck, r2: W.neck, m: mi(M.neck || M.skin) });
        push('head', { t: 'ell', c: sol.HC, rx: B.headR, ry: B.headR * (W.headY || 0.86), rot: boneAng(bones.head), m: mi(M.head || M.skin) });
    }
    if (!ch.noArms) {
        limb('farm', sol.af.S, sol.af.E, W.uarm[0], W.uarm[1], M.arm);
        limb('farm', sol.af.E, sol.af.Hd, W.farm[0], W.farm[1], M.forearm || M.arm);
        push('farm', { t: 'ell', c: sol.af.Hd, rx: W.hand, ry: W.hand * 0.9, rot: 0, m: mi(M.hand) });
    }

    // --- extras ---
    for (const ex of ch.extras) {
        if (ex.when && !ex.when(pose)) continue;
        if (ex.minScale && scale < ex.minScale) continue;
        const targets = [];
        if (ex.limb) {
            // duplicated onto both sides: F to the front layer, B to the back layer
            const isArm = /arm|hand/.test(ex.limb);
            targets.push({ bone: ex.limb + 'F', L: isArm ? 'farm' : 'fleg', back: false });
            targets.push({ bone: ex.limb + 'B', L: isArm ? 'barm' : 'bleg', back: true });
        } else targets.push({ bone: ex.b, L: ex.L, back: false });
        for (const tg of targets) {
            const bone = bones[tg.bone];
            if (!bone) continue;
            const m = mi(ex.m);
            const mode = ex.mode || (tg.back && ch.flatBack ? 'back' : undefined);
            const ring = ex.ring;
            if (ex.t === 'cap') {
                push(tg.L, { t: 'cap', a: bp(bone, ex.p1), b: bp(bone, ex.p2), r1: ex.r1, r2: ex.r2 ?? ex.r1, m, mode, ring });
            } else if (ex.t === 'ell') {
                push(tg.L, { t: 'ell', c: bp(bone, ex.at), rx: ex.rx, ry: ex.ry, rot: boneAng(bone) + (ex.rot || 0) * D2R, m, mode, ring });
            } else if (ex.t === 'poly') {
                push(tg.L, { t: 'poly', pts: ex.pts.map((q) => bp(bone, q)), m, mode, ring });
            } else if (ex.t === 'dot') {
                const p = bp(bone, ex.at);
                push(tg.L, { t: 'dot', c: p, index: ex.outline ? OUTLINE : matBase(m) + (ex.tone ?? 1), size: ex.size || 1 });
            } else if (ex.t === 'chain') {
                // hair / scarf: segments trailing from a point, swinging with pose.hair
                let p = bp(bone, ex.at);
                let ang = (ex.ang - (pose.hair || 0) * (ex.swing ?? 1) - (pose.lean || 0) * (ex.follow ?? 0.5) - (pose.head || 0) * 0.5 - (pose.spin || 0) * (ex.gravity ?? 0.85)) * D2R;
                for (let k = 0; k < ex.segs.length; k++) {
                    const [len, r1, r2] = ex.segs[k];
                    const q = { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len };
                    push(tg.L, { t: 'cap', a: p, b: q, r1, r2, m, mode, ring, noGround: true });
                    p = q;
                    ang += (ex.curl || 0) * D2R;
                }
            }
        }
    }

    // --- flatten in layer order, spin, ground ---
    const ops = [];
    for (const L of LAYERS) for (const op of byLayer[L]) { op.g = GROUP[L]; ops.push(op); }

    const handRaw = { x: sol.af.Hd.x, y: sol.af.Hd.y, ang: Math.atan2(sol.af.u2.y, sol.af.u2.x) };
    const headRaw = { x: sol.HC.x, y: sol.HC.y };

    const spin = (pose.spin || 0) * D2R;
    const pivot = add(sol.H, sol.up, B.torso * 0.4);
    const rot = (p) => {
        if (!spin) return p;
        const c = Math.cos(spin), s = Math.sin(spin);
        const x = p.x - pivot.x, y = p.y - pivot.y;
        return { x: pivot.x + x * c - y * s, y: pivot.y + x * s + y * c };
    };
    for (const op of ops) {
        if (op.a) { op.a = rot(op.a); op.b = rot(op.b); }
        if (op.c) op.c = rot(op.c);
        if (op.pts) op.pts = op.pts.map(rot);
        if (op.rot !== undefined) op.rot += spin;
    }
    const hand = rot(handRaw); hand.ang = handRaw.ang + spin;
    const head = rot(headRaw);

    let shiftY;
    if (pose.air) {
        shiftY = idleHip;   // hips where they'd be standing; the sim supplies height
    } else {
        let minY = 1e9;
        for (const op of ops) {
            if (op.noGround) continue;
            if (op.t === 'cap') minY = Math.min(minY, op.a.y - op.r1, op.b.y - op.r2);
            else if (op.t === 'ell') minY = Math.min(minY, op.c.y - Math.max(op.rx, op.ry) * 0.9);
            else if (op.t === 'poly') for (const q of op.pts) minY = Math.min(minY, q.y);
        }
        shiftY = -minY;
    }
    shiftY += pose.dy || 0;
    const sx = pose.dx || 0;
    const mv = (p) => ({ x: p.x + sx, y: p.y + shiftY });
    for (const op of ops) {
        if (op.a) { op.a = mv(op.a); op.b = mv(op.b); }
        if (op.c) op.c = mv(op.c);
        if (op.pts) op.pts = op.pts.map(mv);
    }
    return { ops, hand: { x: hand.x + sx, y: hand.y + shiftY, ang: hand.ang }, head: mv(head), hipY: shiftY };
}

/** Rasterize ops into an IndexBuffer with origin (ox, oy) in buffer pixels. */
export function rasterOps(buf, ops, scale, ox, oy) {
    const X = (p) => ox + p.x * scale, Y = (p) => oy - p.y * scale;
    for (const op of ops) {
        const o = { mode: op.mode, ring: op.ring, group: op.g };
        if (op.t === 'cap') capsule(buf, X(op.a), Y(op.a), X(op.b), Y(op.b), op.r1 * scale, op.r2 * scale, op.m, o);
        else if (op.t === 'ell') ellipse(buf, X(op.c), Y(op.c), op.rx * scale, op.ry * scale, -op.rot, op.m, o);
        else if (op.t === 'poly') polygon(buf, op.pts.map((p) => [X(p), Y(p)]), op.m, o);
        else if (op.t === 'dot') dot(buf, X(op.c), Y(op.c), op.index, Math.max(1, Math.round(op.size * scale)));
    }
}
