// A procedural walker: a leg rig with two-bone IK and a gait, and the player's tiered hexapod built from parts.
// The rig plants each foot on the terrain, steps in alternating groups (a tripod gait for six legs), and the
// body tilts to the plane through its feet. Used for the player, stalkers, tanks and the walking bosses.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { panelTexture } from './textures.js';

const V = THREE.Vector3;
const Y = new V(0, 1, 0);
const _a = new V(), _b = new V(), _c = new V(), _d = new V(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

let PANEL = null;
export function metal(color, rough = 0.38, metalness = 0.85, o = {}) {
    PANEL = PANEL || panelTexture(11);
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness, bumpMap: PANEL, bumpScale: 0.6, envMapIntensity: 1.1, ...o });
}
export function glow(color, intensity = 2.2) {
    return new THREE.MeshStandardMaterial({ color: 0x101418, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.2 });
}

/** Stretch a unit-height cylinder (axis Y) so it runs from a to b. */
function span(mesh, a, b, thick) {
    _a.subVectors(b, a);
    const len = _a.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(_a, 0.5);
    mesh.quaternion.setFromUnitVectors(Y, _a.multiplyScalar(1 / len));
    mesh.scale.set(thick, len, thick);
}

export class LegRig {
    /**
     * cfg: { legs: [{ hip:[x,y,z], foot:[x,z], L1, L2 }], groups: [[ids],[ids]], H (hull height above ground), thick, step (reach threshold),
     *        lift, mats: {leg, joint, foot}, claw, pistons, kneeGlow }
     */
    constructor(body, cfg) {
        this.body = body; this.cfg = cfg; this.H = cfg.H;
        this.legs = [];
        const g = new THREE.Group(); body.add(g); this.group = g;
        const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m; };
        const cyl = new THREE.CylinderGeometry(0.5, 0.42, 1, 10), sph = new THREE.SphereGeometry(1, 12, 10), cone = new THREE.ConeGeometry(0.5, 1, 8), thin = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
        for (const d of cfg.legs) {
            const leg = {
                hip: new V(...d.hip), rest: new V(d.foot[0], -cfg.H, d.foot[1]), L1: d.L1, L2: d.L2, side: Math.sign(d.hip[0]) || 1,
                femur: mk(cyl, cfg.mats.leg), tibia: mk(cyl, cfg.mats.leg), coxa: mk(sph, cfg.mats.joint), knee: mk(sph, cfg.mats.joint), ankle: mk(sph, cfg.mats.joint),
                foot: mk(cone, cfg.mats.foot), piston: cfg.pistons ? mk(thin, cfg.mats.joint) : null, kneeLamp: cfg.kneeGlow ? mk(sph, cfg.kneeGlow) : null,
                planted: new V(), from: new V(), to: new V(), stepping: false, t: 0, dur: 0.25, tuck: 0,
            };
            this.legs.push(leg);
        }
        this.placed = false;
        this.onStep = null;
        this.air = 0;
        // Independent legs: a leg's neighbours are the legs whose hips are close (same side, adjacent; and across the body).
        // Neighbours never lift together, at most `maxStep` legs are in the air, and starts are staggered: a ripple, not a jig.
        const L = this.legs, n = L.length;
        let near = Infinity;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) near = Math.min(near, L[i].hip.distanceTo(L[j].hip));
        this.nb = L.map((a, i) => L.map((b, j) => j).filter((j) => j !== i && a.hip.distanceTo(L[j].hip) <= near * 2.1));
        this.maxStep = n >= 6 ? 3 : n >= 4 ? 2 : 1;
        L.forEach((l, i) => { l.jit = 0.9 + 0.2 * ((i * 0.618 + 0.13) % 1); l.durJit = 0.9 + 0.25 * ((i * 0.37 + 0.2) % 1); l.liftJit = 0.8 + 0.45 * ((i * 0.83 + 0.4) % 1); });
        this.sinceStart = 0; this.idleT = 1.5;
    }

    /** Put every foot on the ground under its rest position (first frame, teleports, landing). */
    plant(h) {
        this.body.updateMatrixWorld(true);
        for (const l of this.legs) {
            _b.copy(l.rest); this.body.localToWorld(_b); _b.y = h(_b.x, _b.z);
            l.planted.copy(_b); l.stepping = false;
        }
        this.placed = true;
    }

    /** Ground plane through the planted feet: returns the mean foot height and the surface normal. */
    footPlane(out) {
        let sy = 0, n = 0, sx = 0, sz = 0;
        for (const l of this.legs) { sy += l.planted.y; sx += l.planted.x; sz += l.planted.z; n++; }
        out.y = sy / n; out.x = sx / n; out.z = sz / n;
        // least-squares plane by cross products of the leg pairs: left minus right x front minus back
        const lf = _a.set(0, 0, 0), ri = _b.set(0, 0, 0), fr = _c.set(0, 0, 0), ba = _d.set(0, 0, 0);
        let nl = 0, nr = 0, nf = 0, nb = 0;
        for (const l of this.legs) {
            if (l.hip.x < -0.01) { lf.add(l.planted); nl++; } else if (l.hip.x > 0.01) { ri.add(l.planted); nr++; }
            if (l.hip.z < -0.01) { fr.add(l.planted); nf++; } else if (l.hip.z > 0.01) { ba.add(l.planted); nb++; }
        }
        const nrm = new V(0, 1, 0);
        if (nl && nr && nf && nb) {
            lf.multiplyScalar(1 / nl); ri.multiplyScalar(1 / nr); fr.multiplyScalar(1 / nf); ba.multiplyScalar(1 / nb);
            const across = ri.sub(lf), along = fr.sub(ba);
            nrm.crossVectors(along, across).normalize();
            if (nrm.y < 0) nrm.negate();
        } else if (nl && nr) {                        // two-legged: only roll from the stance
            const across = ri.sub(lf); nrm.set(-across.y, across.x, 0).normalize(); if (nrm.y < 0) nrm.negate();
        }
        out.n = nrm;
        return out;
    }

    /**
     * Advance the gait. speed is the walker's ground speed (world units/s), vel its velocity,
     * s the body scale (feet reach and lift scale with it), air whether it is off the ground.
     */
    update(dt, h, vel, s, air) {
        const body = this.body, cfg = this.cfg;
        body.updateMatrixWorld(true);
        if (!this.placed) this.plant(h);
        const speed = Math.hypot(vel.x, vel.z);
        const thr = cfg.step * s;
        this.air += ((air ? 1 : 0) - this.air) * Math.min(1, dt * 10);
        this.sinceStart += dt; this.idleT -= dt;
        const legs = this.legs, v = speed / s;
        const lead = Math.min(0.5, 0.12 + speed * 0.03);
        let stepping = 0;
        for (const l of legs) if (l.stepping) stepping++;
        const start = (l, dur, fidget) => { l.stepping = true; l.t = 0; l.from.copy(l.planted); l.dur = dur; l.fidget = !!fidget; this.sinceStart = 0; };
        if (!air && stepping < this.maxStep && this.sinceStart > Math.min(0.09, Math.max(0.035, 0.1 - v * 0.007))) {
            // the most overstretched leg whose neighbours are all planted goes first
            let best = -1, be = 0;
            for (let i = 0; i < legs.length; i++) {
                const l = legs[i]; if (l.stepping) continue;
                _b.copy(l.rest); body.localToWorld(_b);
                // stretch is measured from where the foot will next land (rest point plus lead), so a foot that landed ahead is not 'overstretched'
                const err = Math.hypot(l.planted.x - (_b.x + vel.x * lead), l.planted.z - (_b.z + vel.z * lead)) / (thr * l.jit);
                if (err < (speed > 0.5 ? 1 : 0.8) || err <= be) continue;
                if (err < 2.4 && this.nb[i].some((j) => legs[j].stepping)) continue;
                best = i; be = err;
            }
            if (best >= 0) start(legs[best], Math.max(0.12, Math.min(0.28, 0.26 - v * 0.014)) * legs[best].durJit);
            else if (speed < 0.3 && stepping === 0 && this.idleT <= 0) {
                // a spider fidgets: now and then one leg re-places itself
                const i = Math.floor(Math.random() * legs.length);
                if (!this.nb[i].some((j) => legs[j].stepping)) { start(legs[i], 0.32, true); this.idleT = 1.2 + Math.random() * 2.2; }
            }
        }
        for (const l of this.legs) {
            _b.copy(l.rest); body.localToWorld(_b);
            if (l.stepping) {
                l.t += dt / l.dur;
                l.to.set(_b.x + vel.x * lead, 0, _b.z + vel.z * lead); l.to.y = h(l.to.x, l.to.z);
                if (l.fidget) { l.to.x += Math.sin(l.from.x * 3.1) * 0.4 * s; l.to.z += Math.cos(l.from.z * 2.3) * 0.4 * s; l.to.y = h(l.to.x, l.to.z); }
                const t = Math.min(1, l.t), e = t * t * (3 - 2 * t);
                l.planted.lerpVectors(l.from, l.to, e);
                l.planted.y = Math.max(h(l.planted.x, l.planted.z), l.from.y + (l.to.y - l.from.y) * e) + Math.sin(t * Math.PI) * cfg.lift * s * l.liftJit;
                if (l.t >= 1) {
                    l.stepping = false; l.planted.copy(l.to); l.planted.y = h(l.planted.x, l.planted.z);
                    if (this.onStep && !l.fidget) this.onStep(l);
                }
            } else if (air) {
                // dangle under the hull while jumping
            } else {
                l.planted.y += (h(l.planted.x, l.planted.z) - l.planted.y) * Math.min(1, dt * 20);
            }
        }
        this.solve(s, air);
    }

    solve(s, air) {
        for (const l of this.legs) {
            const hipL = l.hip;
            const foot = _c;
            if (this.air > 0.02) {
                _d.set(l.rest.x * 0.7, -this.H * 0.35, l.rest.z * 0.8);
                this.body.worldToLocal(foot.copy(l.planted));
                foot.lerp(_d, this.air);
            } else this.body.worldToLocal(foot.copy(l.planted));
            // IK in body-local space
            _a.subVectors(foot, hipL);
            let len = _a.length();
            const maxL = l.L1 + l.L2 - 0.02, minL = Math.abs(l.L1 - l.L2) + 0.08;
            const L = Math.min(maxL, Math.max(minL, len));
            _a.multiplyScalar(1 / (len || 1));
            const a = (L * L + l.L1 * l.L1 - l.L2 * l.L2) / (2 * L), hgt = Math.sqrt(Math.max(0, l.L1 * l.L1 - a * a));
            // knee pops up and a little outward
            _b.set(l.side * 1.0, 1, 0);
            _b.addScaledVector(_a, -_b.dot(_a)).normalize();
            const knee = new V().copy(hipL).addScaledVector(_a, a).addScaledVector(_b, hgt);
            const ankle = new V().copy(hipL).addScaledVector(_a, L);
            const th = this.cfg.thick;
            span(l.femur, hipL, knee, th * 1.0);
            span(l.tibia, knee, ankle, th * 0.78);
            l.coxa.position.copy(hipL); l.coxa.scale.setScalar(th * 1.15);
            l.knee.position.copy(knee); l.knee.scale.setScalar(th * 0.85);
            l.ankle.position.copy(ankle); l.ankle.scale.setScalar(th * 0.7);
            // foot claw points from the ankle toward the ground
            const clawLen = this.cfg.claw || 0.6;
            _d.set(0, -1, 0);
            l.foot.quaternion.setFromUnitVectors(Y, _d.negate().negate());
            l.foot.quaternion.setFromUnitVectors(Y, new V(0, -1, 0));
            l.foot.scale.set(th * 1.5, clawLen, th * 1.5);
            l.foot.position.copy(ankle).addScaledVector(new V(0, -1, 0), clawLen * 0.5);
            if (l.piston) { const mid = new V().copy(hipL).lerp(knee, 0.55); const root = new V().copy(hipL).add(new V(-l.side * 0.1, 0.55, 0)); span(l.piston, root, mid, th * 0.38); }
            if (l.kneeLamp) { l.kneeLamp.position.copy(knee).addScaledVector(_b, th * 0.9); l.kneeLamp.scale.setScalar(th * 0.4); }
        }
        void s; void air;
    }
}

// ----------------------------------------------------------------------------------------------- the player's walker
const AMBER = 0xe3a02e, DARK = 0x262b34, STEEL = 0x8f9aa8, CYAN = 0x38e4ff;
const rb = (w, h, d, r = 0.12) => new RoundedBoxGeometry(w, h, d, 3, r);

export function buildMech(upg, quality = 'high') {
    const root = new THREE.Group();
    const hull = new THREE.Group(); hull.scale.setScalar(1.3); root.add(hull);
    const hullMat = metal(AMBER, 0.34, 0.7), darkMat = metal(DARK, 0.45, 0.9), steelMat = metal(STEEL, 0.3, 0.95), glass = new THREE.MeshStandardMaterial({ color: 0x0b2a38, emissive: 0x0a5a78, emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.9 });
    const cyan = glow(CYAN, 2.6), hot = glow(0xff7a20, 2.8);
    const add = (geo, mat, x = 0, y = 0, z = 0, p = hull) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
    const info = { muzzles: [], jets: [], pods: [], barrels: [], flames: [], hull };

    // hull
    add(rb(2.0, 0.85, 2.7, 0.28), hullMat, 0, 0, 0);
    add(rb(1.5, 0.35, 2.3, 0.1), darkMat, 0, -0.55, 0.05);
    add(rb(0.5, 0.12, 2.2, 0.04), cyan, 0, 0.44, 0.1);
    for (const sx of [-1, 1]) add(rb(0.1, 0.1, 1.7, 0.03), cyan, sx * 0.98, 0.05, 0);
    // cockpit
    const canopy = add(new THREE.SphereGeometry(0.62, 18, 14), glass, 0, 0.5, -0.7); canopy.scale.set(1, 0.7, 1.25);
    add(new THREE.TorusGeometry(0.6, 0.06, 6, 20), steelMat, 0, 0.42, -0.7).rotation.x = Math.PI / 2;
    // shoulder legs housings
    for (const sx of [-1, 1]) for (const z of [-1, 0, 1]) add(rb(0.55, 0.5, 0.55, 0.12), darkMat, sx * 0.95, -0.1, z * 0.95);

    // armour tiers
    const A = upg.armor;
    if (A >= 1) add(rb(1.7, 0.16, 2.2, 0.06), hullMat, 0, 0.5, 0.25);
    if (A >= 2) for (const sx of [-1, 1]) add(rb(0.2, 0.6, 2.2, 0.08), hullMat, sx * 1.15, 0.05, 0);
    if (A >= 3) {
        add(rb(1.9, 0.5, 0.35, 0.1), hullMat, 0, -0.1, -1.45).rotation.x = -0.35;
        for (const sx of [-1, 1]) { const p = add(new THREE.SphereGeometry(0.5, 12, 8, 0, 6.3, 0, 1.6), hullMat, sx * 1.15, 0.5, -0.5); p.scale.set(1, 0.8, 1.3); }
    }
    if (A >= 4) {
        add(rb(1.7, 0.7, 0.3, 0.08), hullMat, 0, 0.1, 1.5);
        for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.1, 0.5, 6), steelMat, (i - 2) * 0.32, 0.72, 0.5 + i * 0.05);
    }
    if (A >= 5) {
        for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) add(rb(0.34, 0.07, 0.34, 0.02), steelMat, (i - 2.5) * 0.36, 0.63, -0.1 + j * 0.45);
        add(new THREE.ConeGeometry(0.28, 0.7, 6), steelMat, 0, 0.95, -1.1).rotation.x = -0.6;
    }

    // engine and fuel
    const F = upg.fuel;
    add(rb(1.5, 0.7, 0.7, 0.14), darkMat, 0, 0.1, 1.55);
    const nTanks = 1 + Math.floor((F + 1) / 2);
    for (let i = 0; i < nTanks; i++) {
        const sx = nTanks === 1 ? 0 : (i / (nTanks - 1) - 0.5) * 1.6, r = 0.28 + F * 0.03;
        const t = add(new THREE.CapsuleGeometry(r, 0.55 + F * 0.07, 4, 12), steelMat, sx, 0.62, 1.55); t.rotation.x = 0;
        add(new THREE.TorusGeometry(r, 0.04, 6, 14), hot, sx, 0.72, 1.55).rotation.x = Math.PI / 2;
    }
    for (const sx of nTanks > 1 ? [-0.55, 0.55] : [0]) {
        add(new THREE.CylinderGeometry(0.2 + F * 0.015, 0.28 + F * 0.015, 0.4, 12), darkMat, sx, 0.0, 1.98).rotation.x = Math.PI / 2;
        const nz = add(new THREE.CircleGeometry(0.17 + F * 0.012, 14), hot, sx, 0.0, 2.2); nz.rotation.y = Math.PI;
        info.jets.push(new THREE.Vector3(sx, 0.0, 2.25));
    }
    // guns
    const G = upg.guns;
    const gunTable = [
        { n: 1, len: 1.5, r: 0.08, col: STEEL }, { n: 2, len: 1.7, r: 0.1, col: STEEL }, { n: 2, len: 1.8, r: 0.12, col: 0x66ff99 },
        { n: 2, len: 2.2, r: 0.12, col: 0xff66ee }, { n: 2, len: 2.6, r: 0.13, col: 0xbfe8ff }, { n: 4, len: 2.0, r: 0.1, col: 0xff7733 },
    ][G];
    const gunMount = new THREE.Group(); gunMount.position.set(0, 0.0, -1.35); hull.add(gunMount); info.gunMount = gunMount;
    add(rb(0.9 + G * 0.08, 0.5 + G * 0.04, 0.6, 0.1), darkMat, 0, 0, 0.1, gunMount);
    const accent = glow(gunTable.col, 2.4);
    for (let i = 0; i < gunTable.n; i++) {
        const side = (i - (gunTable.n - 1) / 2) * 0.62;
        const gp = new THREE.Group(); gp.position.set(side, 0.08 - (gunTable.n === 4 && i % 2 ? 0.15 : 0), 0); gunMount.add(gp);
        const bar = add(new THREE.CylinderGeometry(gunTable.r, gunTable.r * 1.15, gunTable.len, 10), steelMat, 0, 0, -gunTable.len / 2, gp); bar.rotation.x = Math.PI / 2;
        add(new THREE.CylinderGeometry(gunTable.r * 1.7, gunTable.r * 1.7, 0.45, 10), darkMat, 0, 0, -0.35, gp).rotation.x = Math.PI / 2;
        if (G >= 2) for (let k = 0; k < G - 1; k++) add(new THREE.TorusGeometry(gunTable.r * 1.9, 0.025, 6, 14), accent, 0, 0, -0.7 - k * 0.3, gp);
        add(new THREE.CylinderGeometry(gunTable.r * 1.35, gunTable.r * 1.1, 0.16, 10), darkMat, 0, 0, -gunTable.len, gp).rotation.x = Math.PI / 2;
        const mz = new THREE.Object3D(); mz.position.set(0, 0, -gunTable.len - 0.1); gp.add(mz);
        info.muzzles.push(mz); info.barrels.push(gp);
    }
    if (G === 5) { add(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 14), darkMat, 0.0, 0.35, 0.0, gunMount).rotation.z = Math.PI / 2; }
    // missiles
    const M = upg.missiles;
    const sides = M === 0 ? [1] : [-1, 1];
    const tubes = [1, 2, 2, 4, 4, 6][M];
    for (const sx of sides) {
        const pod = new THREE.Group(); pod.position.set(sx * 0.95, 0.72, 0.1); hull.add(pod); info.pods.push(pod);
        add(rb(0.5 + M * 0.04, 0.4 + (tubes > 3 ? 0.15 : 0), 0.9 + M * 0.05, 0.08), darkMat, 0, 0.1, 0, pod);
        for (let t = 0; t < tubes; t++) {
            const cols = tubes > 3 ? 3 : 2, tx = (tubes <= 2 ? 0 : ((t % cols) - (cols - 1) / 2) * 0.17), ty = tubes <= 2 ? (t - (tubes - 1) / 2) * 0.17 : 0.1 + Math.floor(t / cols) * 0.2 - 0.0;
            add(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 8), steelMat, tx, 0.1 + ty, -0.12, pod).rotation.x = Math.PI / 2;
            add(new THREE.CircleGeometry(0.06, 8), hot, tx, 0.1 + ty, -0.58, pod).rotation.y = Math.PI;
        }
    }
    if (M >= 2) { add(new THREE.SphereGeometry(0.17, 10, 8), steelMat, 0, 0.78, -0.05); add(new THREE.SphereGeometry(0.07, 8, 6), glow(0xff3030, 3), 0, 0.82, -0.2); }
    if (M >= 5) for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4), steelMat, sx * 0.5, 1.0, 0.6);

    // flames (boost and jets)
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (const j of info.jets) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.28 + F * 0.02, 1.8, 10, 1, true), flameMat); f.rotation.x = -Math.PI / 2; f.position.set(j.x, j.y, j.z + 0.9); f.visible = false; hull.add(f);
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.14 + F * 0.01, 1.1, 8, 1, true), coreMat); c.rotation.x = -Math.PI / 2; c.position.set(j.x, j.y, j.z + 0.55); c.visible = false; hull.add(c);
        info.flames.push(f, c);
    }
    // under-belly jets for jump
    const L = upg.legs;
    const mats = { leg: metal(DARK, 0.4, 0.9), joint: metal(0x4a5260, 0.5, 0.7), foot: metal(0x30343c, 0.5, 0.8) };
    const H = 1.9;
    const rig = new LegRig(root, {
        legs: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]].map(([sx, z]) => ({ hip: [sx * 1.2, -0.15, z * 1.2], foot: [sx * (3.5 + L * 0.12), z * 2.0], L1: 2.2, L2: 2.9 })),
        groups: [[0, 2, 4], [1, 3, 5]], H, thick: 0.3 + L * 0.045, step: 1.7, lift: 0.9, mats, claw: 0.8 + L * 0.07, pistons: L >= 2, kneeGlow: L >= 4 ? cyan : null,
    });
    info.rig = rig; info.H = H;
    root.userData.info = info;
    return { root, info, rig };
}
