// The Cinderpeak mine, inside the mountain: a hand-cut gallery, a molten river
// under a trestle, a spiral drop, a lava tube, a rope bridge over a chasm, the
// glittering gem halls, and at the end a cliff over the lava source. One long
// track carries the cart through all of it (see minepath.js); this file builds
// the rock, the glow and the things along the way, and runs the ride.
//
// Like the Works and the subway it has its own scene, built on the first ride,
// and a stand-in `world` for the walking controls (the cliff at the end).

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import {
    SECTIONS, END_S, WALL_S, CUT_S, pointAt, frameAt, sectionAt, speedAt, curvatureAt, headingAtS, slopeAtS,
} from './minepath.js';
import { buildTube, wallAt, rockMaterial, rockGeometry, spikeGeometry, tubePoint, fbm3, noise3 } from './minegeo.js';
import {
    partMaterials, buildTrack, buildCart, timberFrame, hangingLantern, crate, barrel, pickaxe, skeleton, trestle, cableBridge, trackMatrix,
} from './mine-parts.js';
import { CrystalField, GEMS, gemZone } from './mine-gems.js';
import { buildChamber } from './mine-chamber.js';
import { GlowField, LightPool, lavaMaterial, Embers, Spray, Glints, ribbonGeometry } from './mine-fx.js';
import { smoothstep, clamp, lerp, damp, rng, TAU } from './util.js';

const P = {}, F = {};

/** A cross-section profile from keys [s, a, b, floor, rough, n]; smooth between them. */
function profile(keys) {
    return (s, out) => {
        let i = 0;
        while (i < keys.length - 2 && s > keys[i + 1][0]) i++;
        const A = keys[i], B = keys[i + 1];
        const t = smoothstep(A[0], B[0], s);
        out.a = lerp(A[1], B[1], t);
        out.b = lerp(A[2], B[2], t);
        const floor = lerp(A[3], B[3], t);
        out.cx = lerp(A[6] ?? 0, B[6] ?? 0, t);
        out.cy = out.b + floor;
        out.rough = lerp(A[4], B[4], t);
        out.n = lerp(A[5] ?? 2.6, B[5] ?? 2.6, t);
        return out;
    };
}

// [s, half width, half height, floor level, roughness, exponent, centre offset]
export const GALLERY = profile([[20, 1.9, 2.1, -0.45, 0.4, 2.8], [126, 2.0, 2.2, -0.45, 0.6, 2.8]]);

const lerpKey = (keys, s) => {
    let i = 0;
    while (i < keys.length - 2 && s > keys[i + 1][0]) i++;
    const t = smoothstep(keys[i][0], keys[i + 1][0], s);
    const A = keys[i], B = keys[i + 1];
    return A.map((v, k) => (typeof v === 'number' ? lerp(v, B[k], t) : v));
};

// ambience along the line: [s, fog colour, fog density, hemi sky, hemi ground, hemi intensity, ember amount]
const AMBIENCE = [
    [0, 0x0a0706, 0.012, 0x6a5848, 0x2a1408, 0.1, 0.0],
    [126, 0x120805, 0.014, 0x5a4636, 0x3a1608, 0.12, 0.1],
    [160, 0x2a0e05, 0.011, 0x6a4030, 0x8a2e08, 0.7, 0.6],
    [250, 0x1c0a05, 0.014, 0x4a3430, 0x4a1a08, 0.14, 0.5],
    [346, 0x2a0d04, 0.016, 0x4a3028, 0x7a2a08, 0.22, 0.9],
    [492, 0x1e0a05, 0.014, 0x3a2a30, 0x5a1c08, 0.16, 0.5],
    [570, 0x2a1006, 0.0075, 0x4a3a4a, 0x7a2a0a, 0.3, 0.7],
    [676, 0x0c0a14, 0.01, 0x403a60, 0x201830, 0.45, 0.0],
    [760, 0x0c0a1a, 0.006, 0x5a5aa8, 0x3a2a78, 1.5, 0.0],
    [1090, 0x100a14, 0.007, 0x5a5a98, 0x4a2a60, 1.3, 0.0],
    [1130, 0x2a0e06, 0.014, 0x5a3a30, 0x7a2a08, 0.6, 0.9],
    [1240, 0x4a1807, 0.0075, 0x6a4030, 0x9a3a0a, 1.1, 1.0],
    [1262, 0x5a1d08, 0.0075, 0x6a4030, 0x9a3a0a, 1.2, 1.0],
].map((a) => a.map((v, i) => (i === 1 || i === 3 || i === 4 ? new THREE.Color(v) : v)));

/** The rock for a stretch of the mine: a painter for tube vertices. */
function rockPainter(mine, { base = [0.16, 0.13, 0.11], warm = 0.0, vein = null, veinFrom = 0, veinTo = 0, dark = 0.0 }) {
    return (v) => {
        const n = fbm3(v.x * 0.05, v.y * 0.05, v.z * 0.05, 3);
        const m = 0.8 + 0.45 * n;
        v.r = base[0] * m; v.g = base[1] * m; v.b = base[2] * m;
        // iron-red staining and pale mineral blooms
        const st = smoothstep(0.1, 0.5, noise3(v.x * 0.11 + 3, v.y * 0.3, v.z * 0.11));
        v.r += st * 0.05 * (1 + warm); v.g += st * 0.012; v.b -= st * 0.01;
        // ceilings are blacker with soot
        if (v.ny < -0.2) { const k = 1 - dark * smoothstep(0.2, 0.9, -v.ny); v.r *= k; v.g *= k; v.b *= k; }
        mine.glow.sample(v);
        if (vein) {
            const k = smoothstep(veinFrom, veinTo, v.s);
            v.v0 = vein[0] * k; v.v1 = vein[1] * k; v.v2 = vein[2] * k; v.v3 = k > 0.01 ? (vein[3] ?? 1) : 0;
        }
    };
}

export class Mine {
    /** @param {object} env { renderer, ui, mats, audio, quality } */
    constructor(env) {
        this.env = env;
        this.ui = env.ui;
        this.quality = env.quality;
        this.audio = env.audio;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x030202);
        this.scene.fog = new THREE.FogExp2(0x0a0706, 0.012);
        this.parts = partMaterials(env.mats);
        this.rockMats = [];
        this.rockMat = this.rockMaterial();
        this.cliffColliders = [];
        this.glow = new GlowField();
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.updaters = [];
        this.lavaMats = [];
        this.t = 0;
        this.ambScale = 1;

        // light: a faint sky, a pool of real lights, and a lamp on the cart
        this.hemi = new THREE.HemisphereLight(0x6a5848, 0x2a1408, 0.35);
        this.scene.add(this.hemi);
        this.pool = new LightPool(this.scene, Math.max(4, env.quality.lights + 2));
        this.cartLamp = new THREE.PointLight(0xffb060, 16, 26, 1.5);
        this.scene.add(this.cartLamp);
        this._env();

        // the long build
        this._track();
        this._buildSections();

        this.embers = new Embers(env.quality.tier === 'low' ? 400 : 800);
        this.scene.add(this.embers.points);

        // the ride: the cart is the one waiting at the station (it comes in with us), or a fresh one when testing
        this.cart = env.cart ?? buildCart(this.parts);
        this.state = 'idle';        // idle | boarding | riding | ledge | arrived
        this.s = 0;
        this.dir = 1;
        this.v = 0;
        this.rideT = 0;
        this.sway = 0;
        this.look = { yaw: 0, pitch: 0 };
        this.shake = 0;
        this.zoneId = '';
        this.walk = this._walkWorld();
        this.onEvent = null;        // (name, data) => void, for the host
        this.sky = { color: new THREE.Color(0.5, 0.65, 0.95), amount: 1, flash: 0 };
    }

    // ------------------------------------------------------------ set-up

    /** A rock material that keeps time and pulse with the rest. */
    rockMaterial(opts) {
        const m = rockMaterial(opts);
        this.rockMats.push(m);
        return m;
    }

    /** A dim environment with a few coloured lamps, so gems and wet rock have something to reflect. */
    _env() {
        const e = new THREE.Scene();
        e.background = new THREE.Color(0x0a0606);
        const blob = (c, x, y, z, s) => {
            const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(6) }));
            m.position.set(x, y, z);
            e.add(m);
        };
        blob(0xff6a20, 0, -30, 0, 14);
        blob(0xff3a10, 40, -10, 20, 8);
        blob(0x6a50ff, -40, 10, 30, 9);
        blob(0x20d0ff, 30, 20, -40, 7);
        blob(0xffd890, -20, 30, -30, 6);
        blob(0xff40a0, -50, -5, -20, 7);
        blob(0xffffff, 0, 50, 0, 4);
        const pm = new THREE.PMREMGenerator(this.env.renderer);
        this.envRT = pm.fromScene(e, 0.02);
        this.scene.environment = this.envRT.texture;
        this.scene.environmentIntensity = 0.12;
        pm.dispose();
    }

    _track() {
        this.trackGroup = buildTrack(CUT_S - 6, END_S + 2, this.parts);
        this.root.add(this.trackGroup);
    }

    addRock(tube, name) {
        const m = new THREE.Mesh(tube.geo, this.rockMat);
        m.name = name;
        m.frustumCulled = true;
        this.root.add(m);
        return m;
    }

    /** A static light: glow baked into the rock and a real light handed out by the pool. */
    emit(x, y, z, color, { intensity = 10, dist = 18, bake = 1, radius = 10, flicker = 0, light = true } = {}) {
        const c = new THREE.Color(color);
        if (bake > 0) this.glow.add(x, y, z, c.r * bake, c.g * bake, c.b * bake, radius);
        if (light) this.pool.add({ x, y, z, color: c, intensity, dist, flicker });
    }

    // ------------------------------------------------------------ helpers

    /** Lava as a flat or hanging ribbon, with its glow baked into the rock and (optionally) real lights along it. */
    lava(pts, sides, widths, { flow = [0, 1], scale = [3, 3], speed = 0.06, bright = 2.0, edge = 0.5, vScale = 4, glow = 0.55, radius = 14, lights = 0, lightEvery = 12, intensity = 30, dist = 28, lift = 1.2 } = {}) {
        const g = ribbonGeometry(pts, sides, widths, vScale);
        const m = lavaMaterial({ flow, scale, speed, bright, edge });
        this.lavaMats.push(m);
        const mesh = new THREE.Mesh(g, m);
        mesh.frustumCulled = false;
        this.root.add(mesh);
        if (glow > 0) {
            let acc = 0, accL = 0;
            for (let i = 1; i < pts.length; i++) {
                acc += pts[i].distanceTo(pts[i - 1]);
                accL += pts[i].distanceTo(pts[i - 1]);
                if (acc >= radius * 0.45) {
                    acc = 0;
                    this.glow.add(pts[i].x, pts[i].y + lift, pts[i].z, 0.32 * glow, 0.085 * glow, 0.016 * glow, radius);
                }
                if (lights && accL >= lightEvery) {
                    accL = 0;
                    this.pool.add({ x: pts[i].x, y: pts[i].y + lift + 1.5, z: pts[i].z, color: new THREE.Color(0xff5a1a), intensity, dist, flicker: 0.25 });
                }
            }
        }
        return mesh;
    }

    /** A flat river along the track from s0 to s1 at (lx, ly) from the rail. */
    river(s0, s1, lx, ly, width, opts = {}) {
        const pts = [], sides = [];
        for (let s = s0; s <= s1; s += 1.5) {
            pointAt(s, P);
            frameAt(s, F);
            const { l, u } = F;
            pts.push(new THREE.Vector3(P.x + l.x * lx + u.x * ly, P.y + l.y * lx + u.y * ly, P.z + l.z * lx + u.z * ly));
            sides.push(new THREE.Vector3(l.x, l.y, l.z));
        }
        const w = typeof width === 'function' ? pts.map((_, i) => width(s0 + i * 1.5)) : width;
        return this.lava(pts, sides, w, opts);
    }

    /** A fall of lava down the wall of a tube, hugging it from height yTop to yBottom (relative to the rail). */
    fall(tube, s, side, yTop, yBottom, width, { offset = 0.55, ...opts } = {}) {
        const pts = [], sides = [];
        pointAt(s, P);
        frameAt(s, F);
        const lv = new THREE.Vector3(F.l.x, F.l.y, F.l.z);
        for (let y = yTop; y >= yBottom - 0.01; y -= 1.5) {
            const w = wallAt(tube, s, side, y);
            if (!w) continue;
            const n = new THREE.Vector3(w.nx, w.ny, w.nz).normalize();
            pts.push(new THREE.Vector3(w.x + n.x * offset, w.y + n.y * offset, w.z + n.z * offset));
            // across the fall: horizontal, along the wall
            sides.push(new THREE.Vector3(F.t.x, F.t.y, F.t.z));
        }
        void lv;
        if (pts.length < 2) return null;
        const wid = pts.map((_, i) => width * (1 + 0.5 * (i / pts.length)));
        return this.lava(pts, sides, wid, { flow: [0, -1], scale: [2, 3], speed: 0.16, edge: 0.7, bright: 2.2, vScale: 5, ...opts });
    }

    // ------------------------------------------------------------ the sections

    _buildSections() {
        const r = rng('mine');
        this.props = new Batch();
        this._gallery(r);
        this._crossing(r);
        this._descent(r);
        this._tube(r);
        this._hairpin(r);
        this._rift(r);
        this.crystals = new CrystalField(this);
        this._quiet(r);
        this._gems(r);
        this._passage(r);
        this.chamber = buildChamber(this, r);
        this.crystals.build();
        this.root.add(this.props.build(this.parts));
    }

    // ---- the old gallery

    _gallery(r) {
        const rb = this.props;
        for (let s = 44; s < 124; s += 4.2) timberFrame(rb, s, 1.72, 2.55);
        for (let s = 50, i = 0; s < 124; s += 12, i++) {
            const side = i % 2 ? 1 : -1;
            const p = hangingLantern(rb, s, side * 1.3, 2.7);
            this.emit(p.x, p.y, p.z, 0xffa050, { intensity: 9, dist: 16, bake: 0.16, radius: 8, flicker: 0.12 });
        }
        // things left behind
        crate(rb, 58, 1.5, 0, 0.62, 0.3);
        crate(rb, 58.2, 1.55, 0.7, 0.5, -0.2);
        crate(rb, 58.1, 1.52, 0.2, 0.5, 0.1, 0.22);
        barrel(rb, 72, -1.45, 1);
        barrel(rb, 72.3, -1.3, 1.8);
        pickaxe(rb, 66, 1.6, 0, -0.4, 0.45, 1.6);
        crate(rb, 90, -1.45, 0, 0.7, 0.5);
        barrel(rb, 98, 1.5, 0);
        crate(rb, 110, 1.4, -0.4, 0.6, 0.1);
        pickaxe(rb, 104, -1.5, 0, -0.4, -0.5, 1.5);
        // the first red glow, round the bend ahead
        this.emit(this.at(150, 0, 3).x, this.at(150, 0, 3).y, this.at(150, 0, 3).z, 0xff4a10, { intensity: 20, dist: 34, bake: 0.2, radius: 22, flicker: 0.3 });

        const tube = buildTube({ s0: CUT_S - 14, s1: 128, ds: 1.2, segs: 40, section: GALLERY });
        tube.paint(rockPainter(this, { base: [0.34, 0.28, 0.23], vein: [1.0, 0.25, 0.04, 0.7], veinFrom: 96, veinTo: 126, dark: 0.7 }));
        this.addRock(tube, 'gallery');
    }

    /** World position at s, offset (lx, ly) from the rail. */
    at(s, lx = 0, ly = 0, out = new THREE.Vector3()) {
        pointAt(s, P);
        frameAt(s, F);
        const { l, u } = F;
        return out.set(P.x + l.x * lx + u.x * ly, P.y + l.y * lx + u.y * ly, P.z + l.z * lx + u.z * ly);
    }

    // ---- the molten river

    _crossing(r) {
        const rb = this.props;
        const S0 = 124, S1 = 254, MID = 188;
        const section = profile([
            [S0, 2.0, 2.2, -0.45, 0.6, 2.8],
            [150, 15, 11, -2.5, 1.6, 2.4],
            [170, 17, 13, -9, 1.8, 2.4],
            [212, 17, 13, -9, 1.8, 2.4],
            [232, 13, 10, -3, 1.4, 2.4],
            [S1, 2.0, 2.2, -0.45, 0.6, 2.8],
        ]);
        const carve = (info) => {
            // a channel in the floor under the bridge, where the river runs
            const k = smoothstep(MID - 13, MID - 7, info.s) * (1 - smoothstep(MID + 7, MID + 13, info.s));
            if (k > 0 && info.ly < -6.5) info.p.addScaledVector(info.u, -5.5 * k * smoothstep(-6.5, -8.8, info.ly));
        };
        const tube = buildTube({ s0: S0 - 2, s1: S1 + 2, ds: 1.6, segs: 96, section, shape: carve });
        // lava: a river across the hall, two falls, glow
        const centre = this.at(MID, 0, -9 - 5.5 + 1.9);
        const fr = {}; frameAt(MID, fr);
        const T = new THREE.Vector3(fr.t.x, fr.t.y, fr.t.z), L = new THREE.Vector3(fr.l.x, fr.l.y, fr.l.z);
        const pts = [], sides = [];
        for (let k = -20; k <= 20; k += 2) { pts.push(centre.clone().addScaledVector(L, k)); sides.push(T.clone()); }
        this.lava(pts, sides, 11, { flow: [0, 1], scale: [2.2, 5], speed: 0.07, glow: 0.42, radius: 30, lights: 3, lightEvery: 14, intensity: 420, dist: 80, lift: 2 });
        // the river's ends vanish into black arches in the walls
        for (const side of [-1, 1]) this.glow.add(centre.x + L.x * side * 18, centre.y + 3, centre.z + L.z * side * 18, 0.5, 0.13, 0.02, 14);
        // a fall from the roof on the left, and a thin one on the right
        this.fall(tube, MID - 3, 1, 9, -9.5, 3.4, { glow: 0.3, radius: 20, lights: 2, lightEvery: 10, intensity: 200, dist: 50 });
        this.fall(tube, MID + 7, -1, 6, -9.5, 1.8, { glow: 0.2, radius: 14 });
        // the trestle that carries the track across
        trestle(rb, 148, 232, this.at(MID, 0, 0).y - 12.6, { gaps: [[181, 182.4], [194, 195.2]], seed: 1 });
        // a handrail of rope and a warning sign on the near post
        // stalactites hang from the roof, tips glowing
        this._spikes(tube, r, { count: 46, ceiling: true, len: [2.5, 9], girth: [0.4, 1.1], from: S0 + 20, to: S1 - 20, glowTips: true });
        this._spikes(tube, r, { count: 28, ceiling: false, len: [2, 7], girth: [0.5, 1.3], from: S0 + 20, to: S1 - 20 });
        tube.paint(rockPainter(this, { base: [0.26, 0.2, 0.17], vein: [1.0, 0.2, 0.03, 0.8], veinFrom: 120, veinTo: 140, dark: 0.5, warm: 1 }));
        this.addRock(tube, 'crossing');
        // the river's heat: embers drawn up from it (handled by the ember field), and a sign for the unwary
        this.emit(this.at(160, 0, 4).x, this.at(160, 0, 4).y, this.at(160, 0, 4).z, 0xffa050, { intensity: 10, dist: 16, bake: 0.14, radius: 7, flicker: 0.12 });
    }

    /** Spikes (stalactites hanging from the roof, stalagmites standing on the floor) on a tube, as one instanced mesh. */
    _spikes(tube, r, { count, ceiling, len, girth, from, to, glowTips = false, tint = null, minOff = 0 }) {
        const geo = spikeGeometry(r.int(1, 99));
        const n = geo.attributes.position.count;
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.12), 3));
        geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        geo.setAttribute('aVein', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
        const mesh = new THREE.InstancedMesh(geo, this.rockMat, count);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pt = {};
        let placed = 0;
        const tmp = new THREE.Vector3();
        for (let tries = 0; tries < count * 12 && placed < count; tries++) {
            tubePoint(tube, r, pt);
            if (pt.s < from || pt.s > to) continue;
            if (ceiling ? pt.ny > -0.55 : pt.ny < 0.55) continue;
            // keep clear of the track
            this.at(pt.s, 0, 0, tmp);
            if (tmp.distanceTo(new THREE.Vector3(pt.x, pt.y, pt.z)) < 3.6 + minOff) continue;
            const L = r.range(len[0], len[1]), G = r.range(girth[0], girth[1]);
            // spike geometry hangs along -y from its root at y = 0; flip it for stalagmites
            q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), ceiling ? 0 : Math.PI);
            q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * TAU));
            m.compose(new THREE.Vector3(pt.x - (ceiling ? 0 : 0), pt.y + (ceiling ? 0.4 : -0.4), pt.z), q, new THREE.Vector3(G, L, G));
            mesh.setMatrixAt(placed++, m);
            if (glowTips) {
                const tip = new THREE.Vector3(pt.x, pt.y - L, pt.z);
                this.glow.add(tip.x, tip.y, tip.z, 0.5, 0.14, 0.02, 7);
            }
        }
        mesh.count = placed;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        this.root.add(mesh);
        return mesh;
    }

    // ---- the spiral drop

    _descent(r) {
        const rb = this.props;
        const S0 = 252, S1 = 348;
        const section = profile([[S0, 2.0, 2.2, -0.45, 0.6, 2.8], [262, 1.9, 2.15, -0.45, 0.8, 2.6], [338, 1.9, 2.15, -0.45, 0.8, 2.6], [S1, 2.0, 2.2, -0.45, 0.6, 2.8]]);
        // lava windows: pockets in the left wall that look into the magma
        const windows = [{ s: 284, ly: 1.4, d: 3.0 }, { s: 318, ly: 1.0, d: 3.4 }];
        const tube = buildTube({
            s0: S0, s1: S1, ds: 1.0, segs: 36, section,
            shape: (info) => {
                for (const w of windows) {
                    const ds = (info.s - w.s) / 1.9, dy = (info.ly - w.ly) / 1.4;
                    if (info.lx > 0.8) {
                        const k = Math.exp(-(ds * ds + dy * dy) * 1.5);
                        info.p.addScaledVector(info.l, w.d * k);
                    }
                }
            },
        });
        for (const w of windows) {
            const c = this.at(w.s, 1.9 + w.d + 0.2, w.ly);
            this.emit(c.x, c.y, c.z, 0xff4a10, { intensity: 40, dist: 22, bake: 0.4, radius: 12, flicker: 0.3 });
            // the magma itself, seen through the window
            const fr = {}; frameAt(w.s, fr);
            const g = new THREE.PlaneGeometry(3.2, 2.6);
            const m = lavaMaterial({ flow: [0, 1], scale: [1.4, 1.2], speed: 0.1, bright: 2.4, edge: 0.4 });
            this.lavaMats.push(m);
            const mesh = new THREE.Mesh(g, m);
            mesh.position.copy(c);
            mesh.lookAt(c.x - fr.l.x, c.y - fr.l.y, c.z - fr.l.z);
            this.root.add(mesh);
        }
        // braces, a few lanterns, and a miner who didn't make it
        for (let s = 262; s < 340; s += 7) timberFrame(rb, s, 1.62, 2.35);
        for (let s = 270, i = 0; s < 340; s += 22, i++) {
            const p = hangingLantern(rb, s, (i % 2 ? 1 : -1) * 1.25, 2.45);
            this.emit(p.x, p.y, p.z, 0xff9040, { intensity: 8, dist: 14, bake: 0.14, radius: 7, flicker: 0.2 });
        }
        skeleton(rb, 304, -1.55, 0, 2.5);
        crate(rb, 301.5, -1.5, 0.3, 0.45, 0.4);
        pickaxe(rb, 306.4, -1.6, 0.2, -0.4, 0.5, 1.2);
        tube.paint(rockPainter(this, { base: [0.24, 0.19, 0.16], vein: [1.0, 0.2, 0.03, 1.0], veinFrom: S0, veinTo: S0 + 14, dark: 0.6, warm: 1 }));
        this.addRock(tube, 'descent');
        void r;
    }

    // ---- the lava tube

    _tube(r) {
        const S0 = 346, S1 = 494;
        const section = profile([[S0, 2.0, 2.2, -0.45, 0.6, 2.8], [362, 4.0, 3.6, -0.45, 0.9, 2.1], [478, 4.0, 3.6, -0.45, 0.9, 2.1], [S1, 2.0, 2.2, -0.45, 0.6, 2.8]]);
        const k = (s) => smoothstep(S0 + 18, S0 + 30, s) * (1 - smoothstep(S1 - 30, S1 - 18, s));
        const tube = buildTube({
            s0: S0, s1: S1, ds: 1.2, segs: 44, section,
            shape: (info) => {
                // a trench along the left of the track for the lava
                if (info.ly < -0.2 && info.lx > 1.5) {
                    const t = smoothstep(1.7, 2.3, info.lx) * (1 - smoothstep(3.4, 4.0, info.lx));
                    info.p.addScaledVector(info.u, -1.5 * t * k(info.s));
                }
            },
        });
        this.river(S0 + 24, S1 - 24, 2.85, -1.75, (s) => 1.5 * k(s) + 0.2, { flow: [0, 1], scale: [1, 5], speed: 0.1, glow: 0.3, radius: 10, lights: 1, lightEvery: 11, intensity: 32, dist: 22, edge: 0.6, lift: 0.8, bright: 2.6, vScale: 4 });
        tube.paint(rockPainter(this, { base: [0.2, 0.16, 0.14], vein: [1.0, 0.2, 0.03, 1.2], veinFrom: S0, veinTo: S0 + 10, dark: 0.8, warm: 1.5 }));
        this.addRock(tube, 'tube');
        void r;
    }

    // ---- the switchback

    _hairpin(r) {
        const rb = this.props;
        const S0 = 492, S1 = 562;
        const section = profile([[S0, 2.0, 2.2, -0.45, 0.6, 2.8], [506, 2.3, 2.5, -0.45, 0.8, 2.6], [546, 2.3, 2.5, -0.45, 0.8, 2.6], [S1, 3.0, 3.0, -0.45, 1.0, 2.4]]);
        const tube = buildTube({ s0: S0, s1: S1, ds: 1.0, segs: 40, section });
        for (let s = 500; s < 556; s += 5.5) timberFrame(rb, s, 1.9, 2.5);
        for (let s = 502, i = 0; s < 556; s += 16, i++) {
            const p = hangingLantern(rb, s, (i % 2 ? 1 : -1) * 1.5, 2.65);
            this.emit(p.x, p.y, p.z, 0xffa050, { intensity: 9, dist: 15, bake: 0.14, radius: 7, flicker: 0.14 });
        }
        barrel(rb, 520, 1.7, 0);
        crate(rb, 535, -1.7, 0, 0.6, 0.2);
        tube.paint(rockPainter(this, { base: [0.26, 0.21, 0.18], vein: [1.0, 0.2, 0.03, 0.8], veinFrom: S0, veinTo: S0 + 6, dark: 0.7, warm: 1 }));
        this.addRock(tube, 'hairpin');
        void r;
    }

    // ---- the rift

    _rift(r) {
        const rb = this.props;
        const S0 = 560, S1 = 680;
        const FLOOR = -86;
        const section = profile([
            [S0, 3.0, 3.0, -0.45, 1.0, 2.4],
            [588, 32, 54, FLOOR, 3.4, 2.2],
            [652, 32, 54, FLOOR, 3.4, 2.2],
            [S1, 2.1, 2.3, -0.45, 0.8, 2.8],
        ]);
        const tube = buildTube({ s0: S0, s1: S1, ds: 3, segs: 120, section });
        // the bridge: planks hung between two towers, cables, a rope on each side
        trestle(rb, 573, 667, 0, { legs: false, seed: 5, gaps: [[610, 611.5], [631, 632.2]] });
        cableBridge(rb, 573, 667, 4.6, 1.5);
        // a lantern at each end of the bridge
        for (const s of [570, 670]) {
            const p = hangingLantern(rb, s, 0, 3.4);
            this.emit(p.x, p.y, p.z, 0xffa050, { intensity: 10, dist: 16, bake: 0.1, radius: 7, flicker: 0.14 });
        }
        // the river at the bottom, wide and bright, and the falls that feed it
        this.river(S0 + 24, S1 - 24, 0, FLOOR + 2.4, 16, { flow: [0, 1], scale: [1.6, 9], speed: 0.06, glow: 0.8, radius: 40, lights: 5, lightEvery: 22, intensity: 2200, dist: 160, lift: 4, bright: 2.2, vScale: 8, edge: 0.7 });
        for (const f of [[598, 1, 6, 5.5], [612, -1, 12, 7.5], [628, 1, 2, 4.5], [641, -1, 4, 6], [656, 1, 10, 6.5], [604, -1, -18, 3.5], [648, 1, -22, 3.2]]) {
            this.fall(tube, f[0], f[1], f[2], FLOOR + 1.5, f[3], { glow: 0.28, radius: 34, lights: 1, lightEvery: 40, intensity: 800, dist: 90, vScale: 8 });
        }
        // stalactites hang from the roof; spires stand from the floor, some taller than the bridge is high
        this._spikes(tube, r, { count: 60, ceiling: true, len: [4, 22], girth: [0.8, 2.6], from: S0 + 22, to: S1 - 22, glowTips: true });
        this._spikes(tube, r, { count: 46, ceiling: false, len: [16, 60], girth: [1.8, 5.2], from: S0 + 22, to: S1 - 22, minOff: 6 });
        tube.paint(rockPainter(this, { base: [0.24, 0.19, 0.17], vein: [1.0, 0.2, 0.03, 0.6], veinFrom: S0, veinTo: S0 + 20, dark: 0.5, warm: 1 }));
        this.addRock(tube, 'rift');
    }

    // ---- the quiet seam: the first crystals

    _quiet(r) {
        const S0 = 676, S1 = 742;
        const section = profile([[S0, 2.1, 2.3, -0.45, 0.8, 2.8], [S0 + 10, 2.2, 2.4, -0.45, 1.0, 2.6], [S1 - 10, 2.3, 2.5, -0.45, 1.0, 2.6], [S1, 3.0, 3.2, -0.45, 1.4, 2.5]]);
        const tube = buildTube({ s0: S0, s1: S1, ds: 1.2, segs: 40, section });
        this.crystals.scatter(tube, r, { from: S0 + 8, to: S1, count: 70, size: [0.3, 0.9], minDist: 1.9, rich: 0.35, hero: 0.1, zone: () => ['amethyst', 'sapphire', 'quartz'] });
        for (let s = S0 + 8; s < S1 - 6; s += 14) {
            const p = hangingLantern(this.props, s, (Math.floor(s / 14) % 2 ? 1 : -1) * 1.4, 2.5);
            this.emit(p.x, p.y, p.z, 0xffc890, { intensity: 7, dist: 13, bake: 0.1, radius: 6, flicker: 0.12 });
        }
        tube.paint(rockPainter(this, { base: [0.2, 0.18, 0.22], dark: 0.4 }));
        this.addRock(tube, 'quiet');
    }

    // ---- the glittering deep

    _gems(r) {
        const S0 = 740, S1 = 1102;
        const section = profile([
            [S0, 3.0, 3.2, -0.45, 1.4, 2.5],
            [776, 14, 15, -0.45, 2.4, 2.3],
            [830, 20, 18, -0.45, 2.8, 2.3],
            [900, 25, 22, -0.45, 3.0, 2.3],
            [980, 18, 19, -0.45, 2.8, 2.3],
            [1050, 15, 17, -0.45, 2.6, 2.3],
            [1086, 3.0, 3.2, -0.45, 1.6, 2.5],
            [S1, 2.5, 2.7, -0.45, 1.0, 2.6],
        ]);
        // niches and geodes cut into the walls, and a ravine either side of a causeway
        const niches = [];
        for (let i = 0; i < 34; i++) niches.push({ s: r.range(780, 1060), phi: r() * TAU, size: r.range(5, 10), depth: r.range(5, 13) });
        const angDiff = (a, b) => { let d = a - b; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI; return d; };
        const tube = buildTube({
            s0: S0, s1: S1, ds: 2.6, segs: 150, section,
            shape: (info) => {
                if (info.s > 770 && info.s < 1070) {
                    for (const n of niches) {
                        const ds = (info.s - n.s) / n.size, dv = angDiff(info.phi, n.phi) * info.rho / n.size;
                        const d2 = ds * ds + dv * dv;
                        if (d2 < 6) info.p.x += info.ox * n.depth * Math.exp(-d2 * 1.3), info.p.y += info.oy * n.depth * Math.exp(-d2 * 1.3), info.p.z += info.oz * n.depth * Math.exp(-d2 * 1.3);
                    }
                    // two ravines
                    for (const [a, b] of [[852, 900], [1004, 1040]]) {
                        const k = smoothstep(a, a + 12, info.s) * (1 - smoothstep(b - 12, b, info.s));
                        if (k > 0 && info.ly < -0.5 && Math.abs(info.lx) > 2.6) info.p.addScaledVector(info.u, -11 * k * smoothstep(2.6, 5.5, Math.abs(info.lx)) * smoothstep(-0.5, -2, info.ly));
                    }
                }
            },
        });
        const q = this.quality.tier;
        this.crystals.scatter(tube, r, { from: S0 + 12, to: S1 - 12, count: q === 'high' ? 9000 : q === 'medium' ? 5200 : 2400, size: [0.7, 3.2], minDist: 3.0, rich: 0.8, hero: 0.012, giants: 56, giantSize: [6, 17] });
        // lanterns on short posts at the start, where the miners' work ends; then only the gems light the way
        for (const s of [754, 764]) {
            const p = hangingLantern(this.props, s, s === 754 ? 1.6 : -1.6, 2.7);
            this.emit(p.x, p.y, p.z, 0xffc890, { intensity: 7, dist: 12, bake: 0.1, radius: 6, flicker: 0.12 });
        }
        // a miner's last camp beside the line
        crate(this.props, 770, 1.7, 0, 0.6, 0.4);
        barrel(this.props, 771, 2.4, 0.8);
        skeleton(this.props, 778, -1.8, 0, 2.2);
        tube.paint(rockPainter(this, { base: [0.3, 0.26, 0.36], dark: 0.25 }));
        this.addRock(tube, 'gems');
        this.gemTube = tube;
    }

    // ---- the heat passage

    _passage(r) {
        const S0 = 1098, S1 = 1246;
        const section = profile([
            [S0, 2.5, 2.7, -0.45, 1.0, 2.6],
            [1120, 2.3, 2.6, -0.45, 1.0, 2.6],
            [1196, 2.3, 2.6, -0.45, 1.0, 2.6],
            [1216, 3.4, 3.4, -0.45, 1.2, 2.5],
            [S1, 4.2, 4.2, -0.45, 1.2, 2.4],
        ]);
        const tube = buildTube({ s0: S0, s1: 1238, ds: 1.2, segs: 40, section });
        const nozzle = buildTube({ s0: 1236, s1: S1, ds: 1.0, segs: 40, section });
        this.crystals.scatter(tube, r, { from: S0 + 4, to: 1180, count: 60, size: [0.3, 1.0], minDist: 1.9, rich: 0.4, hero: 0.1, zone: () => ['ruby', 'rose', 'topaz'] });
        for (let s = 1132; s < 1240; s += 6.5) timberFrame(this.props, s, 1.96, 2.7);
        for (let s = 1136, i = 0; s < 1240; s += 15, i++) {
            const p = hangingLantern(this.props, s, (i % 2 ? 1 : -1) * 1.5, 2.8);
            this.emit(p.x, p.y, p.z, 0xff9a40, { intensity: 9, dist: 14, bake: 0.12, radius: 7, flicker: 0.2 });
        }
        // the glare of the chamber ahead
        const e = this.at(1246, 0, 1);
        this.emit(e.x, e.y, e.z, 0xff5a14, { intensity: 14, dist: 40, bake: 0.3, radius: 30, flicker: 0.2 });
        const painter = rockPainter(this, { base: [0.26, 0.19, 0.16], vein: [1.0, 0.2, 0.03, 1.0], veinFrom: S0 + 20, veinTo: 1160, dark: 0.6, warm: 1.5 });
        tube.paint(painter);
        this.addRock(tube, 'passage');
        // the last metres stick out into the chamber, so they are seen from both sides
        nozzle.paint(painter);
        const nm = this.rockMaterial();
        nm.side = THREE.DoubleSide;
        const mesh = new THREE.Mesh(nozzle.geo, nm);
        mesh.name = 'nozzle';
        this.root.add(mesh);
    }

    // ------------------------------------------------------------ the walk at the end

    _walkWorld() {
        const self = this;
        return {
            ui: this.ui, layout: null,
            island: { heightAt: (x, z) => (self.onLedge(x, z) ? 1 : -5) },
            walkHeight: (x, z) => self.ledgeY(x, z),
            onDeck: () => false,
            collidersNear: () => self.cliffColliders,
            onArrive: null,
        };
    }

    /** Local coordinates on the cliff: left of the line and along it. */
    _ledgeLocal(x, z) {
        const L = this.chamber?.ledge;
        if (!L) return null;
        const dx = x - L.o.x, dz = z - L.o.z;
        return { lx: dx * L.l.x + dz * L.l.z, ls: dx * L.t.x + dz * L.t.z, L };
    }

    onLedge(x, z) {
        const q = this._ledgeLocal(x, z);
        if (!q) return false;
        const { lx, ls, L } = q;
        return (lx / (L.hl - 0.4)) ** 2 + (ls / (L.hs - 0.4)) ** 2 < 1 && ls > -5.2;
    }

    ledgeY() {
        return this.chamber?.ledge.y ?? 0;
    }

    /** Somewhere to stand beside the cart, and which way to face (toward the lava). */
    ledgeSpawn() {
        const L = this.chamber.ledge;
        const w = this.at(END_S - 3.2, 2.0, 0);
        return { x: w.x, z: w.z, yaw: Math.atan2(-L.t.x, -L.t.z) };
    }

    // ------------------------------------------------------------ the ride

    /** Where the eye sits in the cart at s, travelling in direction dir: { pos, quat }. */
    seatPose(s, dir = 1) {
        pointAt(s, P);
        frameAt(s, F);
        const { t, l, u } = F;
        const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(l.x, l.y, l.z), new THREE.Vector3(u.x, u.y, u.z), new THREE.Vector3(t.x, t.y, t.z));
        const cq = new THREE.Quaternion().setFromRotationMatrix(m);
        if (dir < 0) cq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
        const pos = new THREE.Vector3(P.x, P.y, P.z).add(this.cart.seat.clone().applyQuaternion(cq));
        const fwd = new THREE.Vector3(t.x * dir, t.y * dir, t.z * dir);
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), fwd, new THREE.Vector3(u.x, u.y, u.z)));
        return { pos, quat: q, cartQuat: cq };
    }

    /** Put the cart (and with it the eye) at s, looking along the line (dir 1) or back along it (dir -1). */
    place(camera, s, dir = 1) {
        const pose = this.seatPose(s, dir);
        const cart = this.cart.group;
        cart.quaternion.copy(pose.cartQuat);
        pointAt(s, P);
        cart.position.set(P.x, P.y, P.z);
        camera.position.copy(pose.pos);
        const q = pose.quat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.look.pitch, this.look.yaw, 0, 'YXZ')));
        camera.quaternion.copy(q);
        frameAt(s, F);
        this.cartLamp.position.copy(cart.position).addScaledVector(new THREE.Vector3(F.u.x, F.u.y, F.u.z), 1.5).addScaledVector(new THREE.Vector3(F.t.x, F.t.y, F.t.z), dir * 0.8);
        for (const w of this.cart.wheels) w.rotation.x = -s * 4.5;
        return pose;
    }

    /** Climb in: the eye glides from where it stands into the seat, then the cart rolls. */
    begin(camera, controls, dir) {
        this.dir = dir;
        this.s = dir > 0 ? 0 : END_S;
        this.v = 0;
        this.state = 'boarding';
        this.boardT = 0;
        this.inside = dir < 0;
        this.from = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
        controls.yaw = 0;
        controls.pitch = 0;
        this.look.yaw = this.look.pitch = 0;
        this.zoneId = '';
        this.onEvent?.('board', { dir });
    }

    /** Glide the eye to a standing pose (for stepping out); calls done() on arrival. */
    stepOut(camera, pos, yaw, done, dur = 1.0) {
        this.state = 'exiting';
        this.exitT = 0;
        this.exitDur = dur;
        this.from = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
        this.to = { pos: pos.clone(), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, yaw, 0, 'YXZ')) };
        this.exitDone = done;
    }

    update(dt, t, camera, controls) {
        this.t = t;
        // the rider's head: whatever the controls have turned it to, within reason
        if (controls && (this.state === 'riding' || this.state === 'boarding')) {
            controls.yaw = clamp(controls.yaw, -2.5, 2.5);
            controls.pitch = clamp(controls.pitch, -1.2, 1.1);
            this.look.yaw = controls.yaw;
            this.look.pitch = controls.pitch;
        }
        if (this.state === 'boarding') {
            this.boardT += dt;
            const k = smoothstep(0, 1, Math.min(1, this.boardT / 1.15));
            const pose = this.place(camera, this.s, this.dir);
            const hop = Math.sin(Math.PI * k) * 0.22;
            camera.position.lerpVectors(this.from.pos, camera.position, k);
            camera.position.y += hop;
            camera.quaternion.copy(this.from.quat).slerp(camera.quaternion, k);
            void pose;
            if (this.boardT >= 1.3) {
                this.state = 'riding';
                this.onEvent?.('roll', { dir: this.dir });
            }
        } else if (this.state === 'riding') {
            // speed follows the profile for the stretch, smoothed; the way home is quicker
            const home = this.dir < 0;
            let target = speedAt(this.s) * (home ? 1.45 : 1);
            target = Math.max(target, home ? 1.4 : 0.9);
            if (this.dir > 0 && this.s > END_S - 8) target = Math.min(target, 0.45 + (END_S - this.s) * 0.45);
            if (this.dir < 0 && this.s < 8) target = Math.min(target, 0.45 + this.s * 0.45);
            this.v = damp(this.v, target, 1.3, dt);
            this.s += this.dir * this.v * dt;
            if (this.dir > 0 && this.s >= END_S - 0.05) {
                this.s = END_S;
                this.v = 0;
                this.state = 'ledge';
                this.place(camera, this.s, this.dir);
                this.onEvent?.('ledge');
            } else if (this.dir < 0 && this.s <= 0.35) {
                this.s = 0.35;
                this.v = 0;
                this.state = 'station';
                this.place(camera, this.s, this.dir);
                this.onEvent?.('station');
            } else {
                if (this.dir > 0 && !this.inside && this.s >= CUT_S) {
                    this.inside = true;
                    this.onEvent?.('enter');
                } else if (this.dir < 0 && this.inside && this.s <= CUT_S) {
                    this.inside = false;
                    this.onEvent?.('leave');
                }
                const pose = this.place(camera, this.s, this.dir);
                // the line: a rattle that grows with speed, a lean, a shudder over joints
                const sp = this.v / 17;
                const k1 = Math.sin(t * 31) * Math.sin(t * 13.7), k2 = Math.sin(t * 47 + 1) * Math.sin(t * 9.1);
                camera.position.addScaledVector(new THREE.Vector3(0, 1, 0), 0.012 * sp * k1);
                camera.position.addScaledVector(pose.pos.clone().sub(camera.position).normalize().multiplyScalar(0), 0);
                camera.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.004 * sp * k2, 0.003 * sp * k1, 0.008 * sp * Math.sin(t * 5.3), 'YXZ')));
                this.cart.lantern.rotation.z = 0.12 * Math.sin(t * 2.3) * sp + curvatureAt(this.s) * 14 * this.dir;
                // which stretch are we in
                const sec = sectionAt(this.s);
                if (sec.id !== this.zoneId) {
                    this.zoneId = sec.id;
                    this.onEvent?.('zone', sec);
                }
            }
        } else if (this.state === 'exiting') {
            this.exitT += dt;
            const k = smoothstep(0, 1, Math.min(1, this.exitT / this.exitDur));
            camera.position.lerpVectors(this.from.pos, this.to.pos, k);
            camera.quaternion.copy(this.from.quat).slerp(this.to.quat, k);
            if (this.exitT >= this.exitDur) {
                const cb = this.exitDone;
                this.exitDone = null;
                this.state = 'free';
                cb?.();
            }
        }

        // ambience by position
        const s = this.s;
        let i = 0;
        while (i < AMBIENCE.length - 2 && s > AMBIENCE[i + 1][0]) i++;
        const A = AMBIENCE[i], B = AMBIENCE[i + 1];
        const k = smoothstep(A[0], B[0], s);
        this.scene.fog.color.copy(A[1]).lerp(B[1], k);
        this.scene.background.copy(this.scene.fog.color);
        this.scene.fog.density = lerp(A[2], B[2], k);
        this.hemi.color.copy(A[3]).lerp(B[3], k);
        this.hemi.groundColor.copy(A[4]).lerp(B[4], k);
        this.hemi.intensity = lerp(A[5], B[5], k) * this.ambScale;
        const pulse = 0.9 + 0.1 * Math.sin(t * 1.7) * Math.sin(t * 0.9 + 1);
        for (const m of this.rockMats) {
            m.userData.uniforms.uPulse.value = pulse;
            m.userData.uniforms.uTime.value = t;
        }
        for (const m of this.lavaMats) m.uniforms.uTime.value = t;
        this.embers.update(t, camera.position, lerp(A[6], B[6], k), this.env.renderer.domElement.height * 0.9);
        this.pool.update(dt, camera.position, t);
        // the sky, seen up the shaft
        const v2 = this.chamber?.vent2;
        if (v2) {
            v2.U.uSky.value.copy(this.sky.color);
            v2.U.uAmount.value = this.sky.amount;
            v2.U.uFlash.value = this.sky.flash;
        }
        for (const u of this.updaters) u(dt, t, camera);
    }

    /** Click picking on the cliff: the cart, or the ground to walk to. */
    pickLedge(ray) {
        const o = ray.ray.origin, d = ray.ray.direction;
        const hit = ray.intersectObject(this.cart.group, true)[0];
        let best = hit && hit.distance < 40 ? { type: 'cart', t: hit.distance } : null;
        const y = this.ledgeY();
        if (d.y < -1e-4) {
            const t = (y - o.y) / d.y;
            if (t > 0 && t < 70) {
                const x = o.x + d.x * t, z = o.z + d.z * t;
                if (this.onLedge(x, z) && (!best || t < best.t)) return { type: 'ground', point: new THREE.Vector3(x, y, z), t };
            }
        }
        return best;
    }

    /** The cart back at the station, as it waits for the next rider. */
    parkCart() {
        this.s = 0;
        this.v = 0;
        this.dir = 1;
        const cart = this.cart.group;
        trackMatrix(0).decompose(cart.position, cart.quaternion, cart.scale);
        for (const w of this.cart.wheels) w.rotation.x = 0;
        this.cart.lantern.rotation.z = 0;
        this.state = 'idle';
        this.inside = false;
    }

    /** Give back everything the mine holds on the GPU (the cart belongs to the cove and stays). */
    dispose() {
        const cart = this.cart.group;
        const seen = new Set();
        this.scene.traverse((o) => {
            if (o === cart || cart.getObjectById(o.id)) return;
            o.geometry?.dispose();
            for (const m of [].concat(o.material ?? [])) {
                if (seen.has(m)) continue;
                seen.add(m);
                for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
                m.dispose();
            }
        });
        this.envRT?.dispose();
        this.pool.lights.forEach((L) => L.l.dispose?.());
    }

    /** What the ears need to know: how fast, how hot, how glittery, how big. Each 0..1. */
    soundState() {
        const s = this.s;
        const band = (a, b, c, d) => smoothstep(a, b, s) * (1 - smoothstep(c, d, s));
        const trestle = band(148, 156, 226, 236) + band(571, 576, 664, 672);
        const lava = Math.min(1, band(130, 160, 240, 258) * 0.9 + band(258, 280, 340, 350) * 0.5 + band(346, 360, 488, 500) + band(556, 570, 676, 690) + band(1100, 1160, 1250, 1300) * 0.8);
        const gems = band(700, 760, 1070, 1110);
        const heart = smoothstep(1196, 1242, s);
        let fountain = 0;
        if (this.chamber && s > 1150) fountain = clamp(1 - (this.chamber.vent.distanceTo(this.cart.group.position) - 20) / 170, 0, 1);
        const open = Math.min(1, band(130, 156, 240, 258) + band(566, 586, 664, 680) + band(750, 790, 1070, 1100) + heart);
        const curve = clamp(Math.abs(curvatureAt(s)) * 40, 0, 1);
        const riding = this.state === 'riding' || this.state === 'boarding';
        return { v: this.v, speed: clamp(this.v / 16, 0, 1), curve, lava, gems, heart, fountain, trestle: Math.min(1, trestle), open, cart: riding };
    }

    /** Tell the mine what the sky is doing, for the shaft of light at the Heartfire. */
    setSky(state, wx) {
        this.sky.color.copy(state.zenith).lerp(state.horizon, 0.35).multiplyScalar(1 + 1.4 * state.day);
        this.sky.amount = 0.18 + 1.0 * state.day * (1 - 0.5 * wx.overcast);
        this.sky.flash = wx.flash;
    }
}
