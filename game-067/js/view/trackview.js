/**
 * trackview.js — draws the railway from the world's track bitmasks.
 *
 * Each of the six pieces (two straights, four curves) is one merged geometry of ballast, sleepers
 * and rails, drawn as an InstancedMesh with one instance per tile that has it. Extra pieces:
 *   bridges   a plank deck on stone piers wherever track crosses water
 *   portals   a stone arch where track enters a hill
 *   platforms station platforms with a canopy on both sides of straight station tiles
 *   buffers   red buffer stops at the loose ends of lines
 *   switches  a lever beside every set of points and a glowing arrow along the route it is set to
 */

import * as THREE from 'three';
import { N, T, LAND_H } from '../config.js';
import { SEGS, travPoint, edgeMask, idx, inb, DX, DZ, opp } from '../sim/grid.js';
import { Builder } from './builder.js';
import { toyMat } from './materials.js';
import { C } from './models.js';

const BALLAST = 0x9d968b, SLEEPER = 0x6b4a33, RAIL = 0x8c939c;

/** Ribbon along a traversal from edge a to edge b: offset from the centre line, width, height, base y. */
function ribbon(a, b, off, w, h, y, steps = 10) {
    const pos = [];
    const p = {};
    const pts = [];
    const n = (a ^ b) === 2 ? 1 : steps;
    for (let k = 0; k <= n; k++) {
        travPoint(a, b, k / n, p);
        const nx = p.dz, nz = -p.dx;   // right-hand normal
        const L = Math.hypot(nx, nz) || 1;
        pts.push([p.x + (nx / L) * (off - w / 2), p.z + (nz / L) * (off - w / 2), p.x + (nx / L) * (off + w / 2), p.z + (nz / L) * (off + w / 2)]);
    }
    const q = (A, B, Cc, D) => pos.push(...A, ...B, ...Cc, ...A, ...Cc, ...D);
    for (let k = 0; k < n; k++) {
        const [ax, az, bx, bz] = pts[k], [cx, cz, dx, dz] = pts[k + 1];
        const t = y + h;
        // top, then the inner and outer sides
        q([ax, t, az], [cx, t, cz], [dx, t, dz], [bx, t, bz]);
        q([ax, y, az], [cx, y, cz], [cx, t, cz], [ax, t, az]);
        q([bx, t, bz], [dx, t, dz], [dx, y, dz], [bx, y, bz]);
    }
    // Winding: with n = (dz, −dx) the top faces up and each side faces away from the ribbon.
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
}

function pieceGeo(s) {
    const [a, b] = SEGS[s];
    const bl = new Builder();
    bl.add(ribbon(a, b, 0, 0.6, 0.03, 0), BALLAST);
    // sleepers
    const n = (a ^ b) === 2 ? 4 : 3;
    const p = {};
    for (let k = 0; k < n; k++) {
        travPoint(a, b, (k + 0.5) / n, p);
        bl.box(0.5, 0.028, 0.085, SLEEPER, p.x, 0.03, p.z, { ry: Math.atan2(p.dx, p.dz) });
    }
    // rails sit on the sleepers, each its own ribbon with a narrow foot
    for (const off of [-0.15, 0.15]) {
        bl.add(ribbon(a, b, off, 0.036, 0.04, 0.058), RAIL);
    }
    return bl.geometry();
}

function portalGeo() {
    // A stone arch facing +z. Its dark mouth sits exactly on the tile edge (z = 0), in front of the
    // hillside, which rises steeply behind it; the stones stand just outside.
    const b = new Builder();
    const S = 0xb3ada2, D = 0x948e84, K = 0xd9cfa8, Z = 0.09;
    for (const x of [-0.4, 0.4]) {
        b.box(0.2, 0.5, 0.2, S, x, 0, Z);
        b.box(0.24, 0.06, 0.24, D, x, 0, Z);
    }
    const n = 7;
    for (let k = 0; k < n; k++) {
        const a = Math.PI * (k + 0.5) / n;
        b.box(0.13, 0.14, 0.2, k % 2 ? S : D, Math.cos(a) * 0.4, 0.5 + Math.sin(a) * 0.4, Z, { rz: a - Math.PI / 2, centre: true });
    }
    b.box(0.16, 0.18, 0.22, K, 0, 0.9, Z, { centre: true });
    b.box(0.6, 0.5, 0.01, 0x141212, 0, 0, 0.004);
    b.cyl(0.3, 0.01, 0x141212, 0, 0.5, 0.004, { rx: Math.PI / 2, centre: true, seg: 14, ts: -Math.PI / 2, tl: Math.PI });
    for (const s of [-1, 1]) b.box(0.2, 0.36, 0.12, D, s * 0.6, 0, 0.04, { ry: s * 0.3 });
    return b.geometry();
}

function bridgeGeo(rails = true) {
    const b = new Builder();
    b.box(1.0, 0.06, 0.92, 0xa77a4a, 0, -0.07, 0);
    for (let i = 0; i < 6; i++) b.box(0.012, 0.061, 0.92, 0x8a5f34, -0.42 + i * 0.17, -0.07, 0);
    b.cyl(0.13, 0.62, 0xb5afa4, 0, -0.68, 0, { seg: 10 });
    b.cyl(0.18, 0.06, 0xa49d92, 0, -0.13, 0, { seg: 10 });
    if (rails) for (const z of [-0.45, 0.45]) {
        b.box(1.0, 0.03, 0.03, C.white, 0, 0.12, z);
        for (const x of [-0.4, 0, 0.4]) b.box(0.03, 0.14, 0.03, C.white, x, -0.01, z);
    }
    return b.geometry();
}

function platformGeo() {
    // for an N–S station tile: platforms on both sides (x = ±0.4), canopy on the east side
    const b = new Builder();
    for (const s of [-1, 1]) {
        b.box(0.2, 0.1, 1.0, 0xd6d1c7, s * 0.4, 0, 0);
        b.box(0.03, 0.101, 1.0, C.yellow, s * 0.315, 0, 0);
    }
    for (const z of [-0.3, 0.3]) b.box(0.03, 0.42, 0.03, C.white, 0.45, 0.1, z);
    b.box(0.22, 0.03, 0.9, C.red, 0.42, 0.52, 0, { rz: -0.15 });
    b.box(0.05, 0.03, 0.18, C.dkbrown, 0.45, 0.2, 0);
    b.box(0.03, 0.08, 0.14, C.dkbrown, 0.47, 0.23, 0);
    b.cyl(0.012, 0.36, C.black, -0.45, 0.1, 0.35, { seg: 5 });
    b.sphere(0.03, 0xfff1b8, -0.45, 0.47, 0.35, { glow: 2 });
    return b.geometry();
}

function signGeo() {
    const b = new Builder();
    for (const z of [-0.12, 0.12]) b.box(0.02, 0.32, 0.02, C.dkgrey, 0, 0, z);
    b.box(0.03, 0.12, 0.34, 0x1f4fa8, 0, 0.3, 0);
    b.box(0.035, 0.08, 0.3, C.white, 0, 0.32, 0);
    return b.geometry();
}

function bufferGeo() {
    // at the loose end of a line, facing −z (the track comes from +z)
    const b = new Builder();
    for (const x of [-0.15, 0.15]) b.box(0.04, 0.2, 0.18, C.dkgrey, x, 0.05, 0.02, { rx: 0.4 });
    b.box(0.44, 0.1, 0.06, C.red, 0, 0.16, 0);
    for (const x of [-0.12, 0.12]) b.box(0.08, 0.1, 0.061, C.white, x, 0.16, 0);
    b.cyl(0.03, 0.03, C.ltgrey, -0.15, 0.2, 0.04, { rx: Math.PI / 2, centre: true, seg: 8 });
    b.cyl(0.03, 0.03, C.ltgrey, 0.15, 0.2, 0.04, { rx: Math.PI / 2, centre: true, seg: 8 });
    b.sphere(0.025, 0xff4030, 0, 0.3, 0, { glow: 1.6 });
    return b.geometry();
}

export class TrackView {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.pieceGeos = [0, 1, 2, 3, 4, 5].map(pieceGeo);
        this.extraGeos = { portal: portalGeo(), bridge: bridgeGeo(), bridgeC: bridgeGeo(false), platform: platformGeo(), buffer: bufferGeo(), sign: signGeo() };
        this.meshes = [];
        this.v = -1;
        this.switchMesh = null;
    }

    _inst(geo, mats) {
        const m = new THREE.InstancedMesh(geo, toyMat, Math.max(1, mats.length));
        m.count = mats.length;
        mats.forEach((mt, i) => m.setMatrixAt(i, mt));
        m.instanceMatrix.needsUpdate = true;
        m.castShadow = true; m.receiveShadow = true;
        this.group.add(m);
        this.meshes.push(m);
        return m;
    }

    sync(world) {
        if (world.trackV === this.v && world.terrainV === this.tv) return;
        this.v = world.trackV; this.tv = world.terrainV;
        for (const m of this.meshes) { this.group.remove(m); m.dispose(); }
        this.meshes = [];
        const per = [[], [], [], [], [], []];
        const ex = { portal: [], bridge: [], bridgeC: [], platform: [], buffer: [], sign: [] };
        const m4 = (x, y, z, ry) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
        for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
            const i = idx(x, z), bits = world.track[i];
            if (!bits) continue;
            const wx = x - N / 2 + 0.5, wz = z - N / 2 + 0.5;
            const t = world.tiles[i];
            for (let s = 0; s < 6; s++) if (bits & (1 << s)) per[s].push(m4(wx, LAND_H, wz, 0));
            if (t === T.WATER) (bits === 1 || bits === 2 ? ex.bridge : ex.bridgeC).push(m4(wx, LAND_H, wz, bits === 1 ? Math.PI / 2 : 0));
            if (world.station[i]) {
                const ns = bits === 1;
                ex.platform.push(m4(wx, LAND_H, wz, ns ? 0 : Math.PI / 2));
                // a sign on the first tile of each platform
                const prevE = ns ? 0 : 3;
                const px = x + DX[prevE], pz = z + DZ[prevE];
                if (!(inb(px, pz) && world.station[idx(px, pz)])) ex.sign.push(m4(wx + (ns ? -0.42 : -0.3), LAND_H + 0.1, wz + (ns ? -0.3 : -0.42), ns ? 0 : Math.PI / 2));
            }
            const em = edgeMask(bits);
            for (let e = 0; e < 4; e++) {
                if (!(em & (1 << e))) continue;
                const nx = x + DX[e], nz = z + DZ[e];
                const back = world.connectsBack(x, z, e);
                const ry = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][e];
                const ox = DX[e] * 0.5, oz = DZ[e] * 0.5;
                if (t === T.ROCK && !(inb(nx, nz) && world.tiles[idx(nx, nz)] === T.ROCK)) ex.portal.push(m4(wx + ox, LAND_H, wz + oz, ry));
                if (!back && t !== T.ROCK) ex.buffer.push(m4(wx + ox * 0.72, LAND_H, wz + oz * 0.72, ry + Math.PI));
            }
        }
        per.forEach((mats, s) => { if (mats.length) this._inst(this.pieceGeos[s], mats); });
        for (const k of Object.keys(ex)) if (ex[k].length) this._inst(this.extraGeos[k], ex[k]);
        this.buildSwitches(world);
    }

    buildSwitches(world) {
        const b = new Builder();
        let any = false;
        for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
            const e = world.switchEntry(x, z);
            if (e < 0) continue;
            any = true;
            const wx = x - N / 2 + 0.5, wz = z - N / 2 + 0.5;
            const ex = world.route(x, z, e);
            const straight = ex === opp(e);
            // arrow along the active route
            const g = ribbon(e, ex, 0, 0.07, 0.012, 0.105, 12);
            g.translate(wx, LAND_H, wz);
            b.add(g, 0xffd84a, { glow: 0.9 });
            const tip = {};
            travPoint(e, ex, 0.82, tip);
            const yaw = Math.atan2(tip.dx, tip.dz);
            b.cone(0.07, 0.14, 0xffd84a, wx + tip.x, LAND_H + 0.11, wz + tip.z, { rx: Math.PI / 2, ry: yaw, order: 'YXZ', glow: 0.9 });
            // lever beside the entry
            const sx = -DZ[e] * 0.38 + DX[e] * 0.32, sz = DX[e] * 0.38 + DZ[e] * 0.32;
            b.box(0.12, 0.06, 0.12, C.dkgrey, wx + sx, LAND_H, wz + sz);
            b.box(0.025, 0.2, 0.025, C.ltgrey, wx + sx, LAND_H + 0.06, wz + sz, { rx: straight ? 0.35 : -0.35, ry: Math.atan2(DX[e], DZ[e]) + Math.PI / 2 });
            b.sphere(0.045, straight ? 0x4ccf5a : 0xf57d1f, wx + sx, LAND_H + 0.27, wz + sz, { glow: 0.6 });
        }
        if (this.switchMesh) { this.group.remove(this.switchMesh); this.switchMesh.geometry.dispose(); this.switchMesh = null; }
        if (!any) return;
        this.switchMesh = new THREE.Mesh(b.geometry(), toyMat);
        this.group.add(this.switchMesh);
    }
}
