/**
 * anim.js — procedural animation. Bind poses have identity bone rotations, so poses are written
 * in model space: hand and foot targets solved with two-bone IK, torso angles, and hand
 * orientations (what a held blade, bow or shield points at). Nothing is keyframed.
 *
 * Model space: the character faces -z, +x is its right, y is up, the origin is between the feet.
 */
import * as THREE from 'three';

const V = () => new THREE.Vector3();
const Q = () => new THREE.Quaternion();
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _f = V();
const _q1 = Q(), _q2 = Q(), _q3 = Q();
const _m = new THREE.Matrix4();
const _eul = new THREE.Euler();
const ZERO = new THREE.Vector3();
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const ease = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

/**
 * Bone bookkeeping in model space. Every animated mesh gets a Pose: model-space quaternions and
 * positions for each bone, computed top-down while the pose is written.
 */
export class Pose {
    constructor(mesh) {
        this.mesh = mesh;
        this.b = mesh.userData.bones;
        this.names = Object.keys(this.b);
        this.rest = {};   // local rest offsets
        mesh.userData.rest.forEach((p, i) => { this.rest[this.names[i]] = p.clone(); });
        this.mq = {}; this.mp = {};   // model-space rotation and position
        for (const n of this.names) { this.mq[n] = Q(); this.mp[n] = V(); }
        this.order = Object.fromEntries(this.names.map((n, i) => [n, i]));
        this.len = {};
        for (const n of this.names) this.len[n] = this.rest[n].length();
    }
    parentName(n) { const p = this.b[n].parent; return p && p.isBone ? p.name : null; }
    /** Set a bone's local rotation from an Euler (applied in its parent's frame) and update model space. */
    rot(n, x = 0, y = 0, z = 0, order = 'YXZ') {
        _eul.set(x, y, z, order);
        this.b[n].quaternion.setFromEuler(_eul);
        this.syncFrom(n);
    }
    /** Set a bone's model-space rotation directly. */
    setModelQ(n, q) {
        const p = this.parentName(n);
        this.mq[n].copy(q);
        if (p) this.b[n].quaternion.copy(_q3.copy(this.mq[p]).invert().multiply(q));
        else this.b[n].quaternion.copy(q);
        this.syncPos(n);
    }
    sync(n) {
        const p = this.parentName(n);
        if (p) this.mq[n].copy(this.mq[p]).multiply(this.b[n].quaternion);
        else this.mq[n].copy(this.b[n].quaternion);
        this.syncPos(n);
    }
    syncPos(n) {
        const p = this.parentName(n);
        if (p) this.mp[n].copy(this.b[n].position).applyQuaternion(this.mq[p]).add(this.mp[p]);
        else this.mp[n].copy(this.b[n].position);
    }
    reset() {
        for (const n of this.names) { this.b[n].position.copy(this.rest[n]); this.b[n].quaternion.identity(); }
        for (const n of this.names) this.sync(n);
    }
    /** Re-derive model-space transforms for a bone and everything parented under it (in creation order). */
    syncFrom(n) {
        const i0 = this.order[n];
        for (let i = i0; i < this.names.length; i++) this.sync(this.names[i]);
    }
    /** Aim bone `n` (whose child `c` sits along its rest offset) so the child lies along dir (model space). */
    aim(n, c, dir) {
        const p = this.parentName(n);
        const pq = p ? this.mq[p] : _q1.identity();
        _a.copy(this.rest[c]).normalize().applyQuaternion(_q2.copy(pq).multiply(this.b[n].quaternion));
        _q3.setFromUnitVectors(_a, _b.copy(dir).normalize());
        this.setModelQ(n, _q3.multiply(this.mq[n]));
    }
    /**
     * Two-bone IK: upper bone u, lower bone l, end bone e. Target in model space; pole is the
     * direction the middle joint should point to (elbow back, knee forward).
     */
    ik(u, l, e, target, pole, stretch = 0.999) {
        const S = this.mp[u];
        const L1 = this.len[l], L2 = this.len[e];
        _c.copy(target).sub(S);
        let d = _c.length();
        if (d < 1e-4) return;
        const dir = _c.divideScalar(d);
        d = Math.min(d, (L1 + L2) * stretch);
        d = Math.max(d, Math.abs(L1 - L2) + 1e-3);
        const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
        _d.copy(pole).addScaledVector(dir, -pole.dot(dir));
        if (_d.lengthSq() < 1e-6) _d.set(0, 0, 1).addScaledVector(dir, -dir.z);
        _d.normalize();
        const E = _e.copy(S).addScaledVector(dir, a).addScaledVector(_d, h);
        _f.copy(E).sub(S);
        this.aim(u, l, _f);
        this.sync(l);
        _f.copy(S).addScaledVector(dir, d).sub(this.mp[l]);
        this.aim(l, e, _f);
        this.sync(e);
    }
    /** Orient bone n so its local -z points along fwd and local +y toward up (model space). */
    orient(n, fwd, up) {
        _m.lookAt(ZERO, _a.copy(fwd), _b.copy(up));
        _q1.setFromRotationMatrix(_m);
        this.setModelQ(n, _q1);
    }
}

export function v3(x, y, z) { return new THREE.Vector3(x, y, z); }
const tmpT = V(), tmpT2 = V(), tmpF = V(), tmpU = V(), tmpP = V();

// ------------------------------------------------------------------ humanoid
/**
 * Per-actor animation memory: gait phase, smoothed speed and local velocity, blend weights.
 */
export function humanoidState() {
    return { phase: Math.random() * 6, speed: 0, lvx: 0, lvz: 0, crouch: 0, drawn: 0, fall: 0, fallDir: 1, air: 0, swim: 0, block: 0, lookY: 0, lookP: 0, breathe: Math.random() * 6, footL: 0, footR: 0, pel: 0, cast: 0, idleT: Math.random() * 20 };
}

const POLE_ELBOW_R = v3(0.35, -0.2, 1), POLE_ELBOW_L = v3(-0.35, -0.2, 1), POLE_KNEE = v3(0, 0, -1);

/**
 * Write a humanoid pose.
 * ctx: { a (actor), dt, speed, lvx, lvz (local velocity, m/s), aimPitch, look (model-space yaw/pitch to look at),
 *        ground(dx, dz) -> foot height offset, rightItem, leftItem, drawn }
 */
export function animateHumanoid(P, st, ctx) {
    const a = ctx.a, dt = ctx.dt;
    const s = P.mesh.userData.s || 1;
    const pr = P.mesh.userData.p || { arm: 1, shoulder: 0.2, hip: 0.1 };
    const act = a.act || { kind: 'idle', t: 0 };
    P.reset();

    // ---- smoothed drivers
    const k = 1 - Math.exp(-dt * 10);
    st.speed = lerp(st.speed, ctx.speed, k);
    st.lvx = lerp(st.lvx, ctx.lvx, k); st.lvz = lerp(st.lvz, ctx.lvz, k);
    st.crouch = lerp(st.crouch, a.sneaking && !a.swim ? 1 : 0, 1 - Math.exp(-dt * 6));
    st.drawn = lerp(st.drawn, ctx.drawn ? 1 : 0, 1 - Math.exp(-dt * 7));
    st.block = lerp(st.block, a.blocking ? 1 : 0, 1 - Math.exp(-dt * 14));
    st.swim = lerp(st.swim, a.swim ? 1 : 0, 1 - Math.exp(-dt * 4));
    st.air = lerp(st.air, !a.onGround && !a.swim && !a.float ? 1 : 0, 1 - Math.exp(-dt * 8));
    st.breathe += dt * (1.4 + Math.min(1, st.speed / 6));
    const down = a.dead || act.kind === 'knock' || a.bleedout > 0;
    st.fall = down ? Math.min(1, st.fall + dt * 1.8) : Math.max(0, st.fall - dt * 1.2);
    const sp = st.speed;
    const run = clamp01((sp - 2.2) / 3);
    const stride = (0.55 + run * 0.65 + st.crouch * -0.15) * s;
    st.phase += (sp * dt) / Math.max(0.3, stride) * Math.PI;
    const ph = st.phase;
    const moveAmt = clamp01(sp / 1.2);

    // ---- torso
    const bob = Math.abs(Math.sin(ph)) * (0.025 + run * 0.04) * moveAmt * s;
    const crouchDrop = st.crouch * 0.28 * s;
    let pelvisY = -crouchDrop - (1 - Math.abs(Math.sin(ph))) * 0.02 * moveAmt * s + bob * 0.5 + Math.sin(st.breathe) * 0.004;
    const lean = -(run * 0.18 + st.crouch * 0.42) * (st.lvz <= 0.1 ? 1 : -0.4) - st.swim * 1.2;
    let twist = 0, chestPitch = 0, chestYaw = 0, chestRoll = 0, headPitch = 0, headYaw = 0;
    const sway = Math.sin(ph) * 0.05 * moveAmt;
    // look
    headYaw = THREE.MathUtils.clamp(ctx.lookYaw || 0, -1.1, 1.1);
    headPitch = THREE.MathUtils.clamp(ctx.lookPitch || 0, -0.6, 0.6);
    // aim pitch bends the chest when fighting
    const aimP = ctx.aimPitch || 0;
    chestPitch += aimP * 0.5 * st.drawn;

    // action-specific torso
    let rightT = null, leftT = null, rightF = null, rightU = null, leftF = null, leftU = null;
    const sh = (side) => P.mp[`arm${side}`];
    const chestY = 1.3 * s;
    const rItem = ctx.rightItem, lItem = ctx.leftItem;
    const two = rItem && (rItem.two || rItem.bow);
    const bow = rItem && rItem.bow;
    const staff = rItem && rItem.wtype === 'staff';

    const wobble = (n) => Math.sin(st.idleT * n) * 0.01;
    st.idleT += dt;

    // pelvis and spine
    P.b.pelvis.position.y += pelvisY;
    P.rot('pelvis', 0, -sway * 0.6, Math.sin(ph) * 0.03 * moveAmt);

    let spineX = lean * 0.5, chestX = lean * 0.5 + chestPitch;
    let spineY = sway * 1.2, chestY2 = twist;

    // --- per action
    const fight = st.drawn > 0.01;
    let phaseT = 0;   // attack progress in a normalised timeline
    if (act.kind === 'attack') {
        const w = act.wind || 0.2, sk = act.strike || 0.1, rc = act.recover || 0.3;
        phaseT = act.phase === 'wind' ? (act.t / w) * 0.4 : act.phase === 'strike' ? 0.4 + (act.t / sk) * 0.25 : 0.65 + (act.t / rc) * 0.35;
        const pw = act.power ? 1.5 : 1;
        if (phaseT < 0.4) chestY2 = -0.5 * ease(phaseT / 0.4) * pw;
        else if (phaseT < 0.65) chestY2 = lerp(-0.5 * pw, 0.55 * pw, ease((phaseT - 0.4) / 0.25));
        else chestY2 = lerp(0.55 * pw, 0, ease((phaseT - 0.65) / 0.35));
        if (act.power) chestX += phaseT > 0.4 && phaseT < 0.8 ? -0.3 : 0;
        if (act.hand === 'left') chestY2 *= -1;
    } else if (act.kind === 'bash') {
        const tt = act.phase === 'wind' ? act.t / act.wind * 0.4 : act.phase === 'strike' ? 0.4 + act.t / act.strike * 0.3 : 0.7 + act.t / act.recover * 0.3;
        chestY2 = tt < 0.4 ? -0.35 * ease(tt / 0.4) : tt < 0.7 ? lerp(-0.35, 0.25, ease((tt - 0.4) / 0.3)) : lerp(0.25, 0, ease((tt - 0.7) / 0.3));
        chestX -= 0.15;
    } else if (act.kind === 'draw') {
        chestY2 = -0.75; spineY -= 0.2;
    } else if (act.kind === 'sigil') {
        // tracing: a slight turn into the drawing hand; release: lean into the thrust
        chestY2 = -0.2;
        chestX -= act.charging ? 0.05 : 0.2 * Math.max(0, 1 - act.t * 3);
        headPitch += 0.05;
    } else if (act.kind === 'stagger') {
        const e = Math.sin(clamp01(act.t / (act.dur || 0.6)) * Math.PI);
        chestX += 0.35 * e; spineX += 0.2 * e; headPitch += 0.2 * e;
    } else if (act.kind === 'cast') {
        st.cast = Math.min(1, st.cast + dt * 4);
    }
    if (act.kind !== 'cast') st.cast = Math.max(0, st.cast - dt * 4);
    if (st.block > 0.01) chestX -= 0.05 * st.block;

    P.rot('spine', spineX, spineY, 0);
    P.rot('chest', chestX, chestY2 * 0.65, chestRoll);
    P.rot('neck', -chestX * 0.4 + headPitch * 0.4, headYaw * 0.4 - chestY2 * 0.3, 0);
    P.rot('head', headPitch * 0.6 - lean * 0.3, headYaw * 0.6 - chestY2 * 0.3, 0);

    // chest-relative helpers: positions expressed in the chest's frame (so twisting carries the arms)
    const cq = P.mq.chest, cp = P.mp.chest;
    const inChest = (out, x, y, z) => out.set(x * s, y * s, z * s).applyQuaternion(cq).add(cp);
    const dirChest = (out, x, y, z) => out.set(x, y, z).normalize().applyQuaternion(cq);
    // aim: rotate forward vectors by aim pitch
    const pitchQ = _q2.setFromAxisAngle(_a.set(1, 0, 0), aimP);

    // ---- arms
    const armLen = (0.53 * pr.arm) * s;
    const swingA = Math.sin(ph) * (0.16 + run * 0.18) * moveAmt;
    for (const side of ['R', 'L']) {
        const sx = side === 'R' ? 1 : -1;
        const S = sh(side);
        // relaxed hanging arm, swinging with gait, a little out from the body
        tmpT.set(S.x + sx * (0.05 + 0.04 * pr.girth) * s, S.y - armLen * 0.97, S.z + sx * swingA * -1 * s + 0.02 * s);
        if (st.crouch > 0) tmpT.lerp(tmpT2.set(S.x + sx * 0.06 * s, S.y - armLen * 0.8, S.z - 0.15 * s), st.crouch * 0.6);
        if (st.swim > 0) { const sw = Math.sin(st.idleT * 3 + (side === 'R' ? 0 : Math.PI)); tmpT.lerp(tmpT2.set(S.x + sx * 0.3 * s, S.y - 0.1 * s + sw * 0.1, S.z - 0.35 * s + sw * 0.2), st.swim); }
        if (side === 'R') rightT = tmpT.clone(); else leftT = tmpT.clone();
    }
    // default hand orientation: weapon tip forward and down
    rightF = v3(0, -0.6, -0.8); rightU = v3(1, 0, 0);
    leftF = v3(0, -0.6, -0.8); leftU = v3(-1, 0, 0);

    // combat ready stance
    if (fight && !bow && !staff) {
        const blend = st.drawn;
        if (two) {
            const T = inChest(tmpP, 0.12, -0.32, -0.28);
            rightT.lerp(T, blend); leftT.lerp(inChest(tmpT2, 0.05, -0.36, -0.24), blend);
            rightF.lerp(dirChest(tmpF, -0.25, 0.85, -0.45), blend); rightU.lerp(v3(0, 0, 1), blend);
        } else {
            rightT.lerp(inChest(tmpP, 0.24, -0.3, -0.24), blend);
            rightF.lerp(dirChest(tmpF, -0.1, 0.55, -0.82), blend); rightU.lerp(v3(1, 0, 0), blend);
            if (lItem?.slot === 'shield') { leftT.lerp(inChest(tmpT2, -0.2, -0.28, -0.24), blend); leftF.lerp(dirChest(tmpF, -0.4, 0, -1), blend); leftU.lerp(v3(0, 1, 0), blend); }
            else if (lItem) { leftT.lerp(inChest(tmpT2, -0.24, -0.3, -0.22), blend); leftF.lerp(dirChest(tmpF, 0.1, 0.55, -0.82), blend); }
            else leftT.lerp(inChest(tmpT2, -0.2, -0.32, -0.16), blend * 0.6);
        }
    } else if (fight && bow) {
        // bow held low, ready
        leftT.lerp(inChest(tmpT2, -0.2, -0.38, -0.2), st.drawn);
        leftF.lerp(v3(0.2, 1, -0.3), st.drawn); leftU.lerp(v3(0, 0, -1), st.drawn);
    } else if (staff && fight) {
        rightT.lerp(inChest(tmpP, 0.24, -0.36, -0.18), st.drawn);
        rightF.lerp(v3(0, 1, -0.12), st.drawn); rightU.lerp(v3(0, 0, -1), st.drawn);
    }
    // bow carried unready: in the left hand pointing down
    if (bow) { leftF.lerp(v3(0, -1, -0.15), 1 - st.drawn); leftU.lerp(v3(0, 0, -1), 1 - st.drawn); }

    // attacks
    if (act.kind === 'attack') {
        const pw = act.power ? 1 : 0;
        const handR = act.hand !== 'left';
        const sx = handR ? 1 : -1;
        let T, F;
        const W = inChest(V(), sx * (0.32 + pw * 0.05), 0.12 + pw * 0.2, 0.08 + pw * 0.06);
        const WF = dirChest(V(), sx * 0.35, 0.8, 0.45);
        const K = inChest(V(), sx * -0.28, -0.35 - pw * 0.1, -0.5);
        const KF = dirChest(V(), sx * -0.75, -0.3, -0.6);
        const R0 = inChest(V(), sx * 0.24, -0.3, -0.24);
        const R0F = dirChest(V(), sx * -0.1, 0.55, -0.82);
        if (phaseT < 0.4) { const e = ease(phaseT / 0.4); T = R0.clone().lerp(W, e); F = R0F.clone().lerp(WF, e); }
        else if (phaseT < 0.65) { const e = ease((phaseT - 0.4) / 0.25); T = W.clone().lerp(K, e); F = WF.clone().lerp(KF, e); }
        else { const e = ease((phaseT - 0.65) / 0.35); T = K.clone().lerp(R0, e); F = KF.clone().lerp(R0F, e); }
        if (two) {
            T.x -= 0.1 * s;
            if (handR) { rightT = T; rightF = F; rightU = v3(0, 0, 1); leftT = T.clone().addScaledVector(F, -0.12 * s); }
        } else if (handR) { rightT = T; rightF = F; rightU = v3(1, 0, 0); }
        else { leftT = T; leftF = F; leftU = v3(-1, 0, 0); }
    } else if (act.kind === 'bash') {
        const tt = act.phase === 'wind' ? act.t / act.wind * 0.4 : act.phase === 'strike' ? 0.4 + act.t / act.strike * 0.3 : 0.7 + act.t / act.recover * 0.3;
        const out = tt < 0.4 ? 0 : tt < 0.7 ? ease((tt - 0.4) / 0.3) : 1 - ease((tt - 0.7) / 0.3);
        if (lItem?.slot === 'shield') { leftT = inChest(V(), -0.12, -0.18, -0.25 - out * 0.3); leftF = dirChest(V(), 0, 0, -1); leftU = v3(0, 1, 0); }
        else { rightT = inChest(V(), 0.1, -0.15, -0.25 - out * 0.3); rightF = dirChest(V(), -0.6, 0.6, -0.4); }
    } else if (st.block > 0.01 && act.kind === 'idle') {
        const b = st.block;
        if (lItem?.slot === 'shield') { leftT.lerp(inChest(V(), -0.1, -0.12, -0.36), b); leftF.lerp(dirChest(V(), 0, 0, -1), b); leftU.lerp(v3(0, 1, 0), b); }
        else { rightT.lerp(inChest(V(), 0.12, -0.04, -0.38), b); rightF.lerp(dirChest(V(), -1, 0.35, -0.15), b); rightU.lerp(v3(0, 1, 0), b); if (two) leftT.lerp(inChest(V(), -0.08, -0.08, -0.36), b); }
    } else if (act.kind === 'draw' || (bow && act.kind === 'idle' && act.t < 0 && fight)) {
        const draw = act.kind === 'draw' ? clamp01(act.t / (act.full || 1)) : 0;
        // bow arm extended toward the aim, string hand pulls to the cheek
        const fwd = v3(0.3, 0, -1).normalize().applyQuaternion(pitchQ);
        const shL = sh('L');
        leftT = shL.clone().addScaledVector(fwd, armLen * 0.97);
        leftF = v3(0, 1, 0).applyQuaternion(pitchQ).add(v3(0.25, 0, 0)).normalize(); leftU = v3(0, 0, -1).applyQuaternion(pitchQ);
        const nock = leftT.clone().add(v3(0.1 * s, 0, 0.12 * s));
        const cheek = P.mp.head.clone().add(v3(0.08 * s, -0.08 * s, -0.04 * s));
        rightT = nock.lerp(cheek, ease(draw));
        rightF = v3(-0.2, -0.3, -1); rightU = v3(0, 1, 0);
    } else if (act.kind === 'cast' || st.cast > 0) {
        const hands = act.kind === 'cast' ? (act.hand === 'both' ? ['R', 'L'] : [act.hand === 'left' ? 'L' : 'R']) : [];
        for (const side of hands) {
            const sx = side === 'R' ? 1 : -1;
            const charge = act.conc ? 1 : clamp01(act.t / 0.5);
            const T = inChest(V(), sx * 0.22, -0.12 + charge * 0.06, -0.38 - (act.fired ? 0.1 : 0));
            const F = v3(0, 0.5, -1).applyQuaternion(pitchQ);
            if (side === 'R') { rightT.lerp(T, st.cast); rightF.lerp(F, st.cast); } else { leftT.lerp(T, st.cast); leftF.lerp(F, st.cast); }
        }
    } else if (act.kind === 'sigil') {
        // the right hand traces one ring per circuit in the air; on release the open palm thrusts out
        const a2 = act.t * 7.5;
        const r = 0.07 + 0.035 * (act.rings || 1);
        rightT = act.charging ? inChest(V(), 0.12 + Math.cos(a2) * r, -0.08 + Math.sin(a2) * r, -0.42) : inChest(V(), 0.08, -0.06, -0.5);
        rightF = v3(0, 1, -0.2); rightU = v3(0, 0, 1);
        leftT = inChest(V(), -0.24, -0.4, -0.08);
    } else if (act.kind === 'stagger') {
        const e = Math.sin(clamp01(act.t / (act.dur || 0.6)) * Math.PI);
        rightT.lerp(inChest(V(), 0.45, -0.15, -0.1), e); leftT.lerp(inChest(V(), -0.45, -0.15, -0.1), e);
    }
    if (a.float) { const f = Math.sin(st.idleT * 1.2) * 0.04; rightT.y += f; leftT.y += f; }

    P.ik('armR', 'foreR', 'handR', rightT, POLE_ELBOW_R);
    P.ik('armL', 'foreL', 'handL', leftT, POLE_ELBOW_L);
    // hands: the held item's axis along F, the back of the wrist toward the elbow
    if (ctx.rightItem || act.kind === 'attack' || act.kind === 'sigil') P.orient('handR', rightF, _e.copy(P.mp.foreR).sub(P.mp.handR).lerp(rightU, 0.25));
    else P.rot('handR', 0.4, 0, 0);
    if (ctx.leftItem || bow) P.orient('handL', leftF, _e.copy(P.mp.foreL).sub(P.mp.handL).lerp(leftU, 0.25));
    else P.rot('handL', 0.4, 0, 0);

    // ---- legs: gait in the direction of travel, feet planted on the ground
    const mv = Math.hypot(st.lvx, st.lvz) > 0.05 ? [st.lvx / Math.hypot(st.lvx, st.lvz), st.lvz / Math.hypot(st.lvx, st.lvz)] : [0, -1];
    const lift = (0.12 + run * 0.1) * s * moveAmt;
    const hipY = P.mp.thighR.y;
    let lowest = 0;
    const footOffs = [0, 0];
    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 'R' : 'L';
        const sx = i === 0 ? 1 : -1;
        const fp = ph + (i === 0 ? 0 : Math.PI);
        const c = Math.cos(fp), sn = Math.sin(fp);
        const along = -c * stride * 0.5 * moveAmt;
        const up = Math.max(0, sn) * lift;
        const fx = sx * pr.hip * s * (1 + st.crouch * 0.6) + mv[0] * along;
        const fz = mv[1] * along + (st.crouch * -0.02);
        const g = ctx.ground ? ctx.ground(fx, fz) : 0;
        footOffs[i] = g;
        lowest = Math.min(lowest, g);
        const T = side === 'R' ? tmpT : tmpT2;
        T.set(fx, 0.08 * s + up + g, fz);
        if (st.swim > 0) T.lerp(V().set(fx, hipY - 0.8 * s, 0.3 * s + Math.sin(st.idleT * 5 + i * 3) * 0.15 * s), st.swim);
        if (st.air > 0) T.lerp(V().set(fx, hipY - 0.6 * s, -0.12 * s * (i === 0 ? 1 : -0.5)), st.air * 0.7);
    }
    // drop the pelvis to reach the lower foot on slopes
    if (lowest < 0) { P.b.pelvis.position.y += Math.max(lowest, -0.35 * s); P.syncFrom('pelvis'); }
    P.ik('thighR', 'shinR', 'footR', tmpT, POLE_KNEE);
    P.ik('thighL', 'shinL', 'footL', tmpT2, POLE_KNEE);
    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 'R' : 'L';
        const fp = ph + (i === 0 ? 0 : Math.PI);
        const toe = Math.sin(fp) > 0 ? -Math.cos(fp) * 0.35 * moveAmt : 0;
        P.orient(`foot${side}`, v3(0, -toe, -1), v3(0, 1, toe));
    }

    // ---- fall (death, knockdown, bleedout): the whole figure rotates down onto its back
    const root = P.b.root;
    if (st.fall > 0) {
        const f = ease(st.fall);
        const bleed = a.bleedout > 0 && !a.dead;
        const ang = bleed ? 0 : f * Math.PI * 0.5 * 0.97;
        root.rotation.set(ang * st.fallDir, 0, 0);
        root.position.set(0, (bleed ? -0.45 * s : 0.1 * s) * f, 0);
        if (bleed) { P.b.pelvis.position.y = P.rest.pelvis.y - 0.4 * s * f; }
    } else { root.rotation.set(0, 0, 0); root.position.set(0, 0, 0); }
}

/** Movement for attached props: return the current hand-held item defs. */
export function heldItems(a, ITEMS) {
    const r = a.equip?.right ? ITEMS[a.equip.right.id] : null;
    const l = a.equip?.left ? ITEMS[a.equip.left.id] : null;
    return { r, l };
}
