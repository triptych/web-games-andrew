// The city, built in CHUNK-metre slices of road as you drive.
//
// A chunk is a pure function of (seed, chunk index): road surface, sidewalks,
// lamps, buildings, signs, lights and any stop set piece that starts in it.
// Each chunk is a few merged meshes (one per material) positioned at the
// road point where it starts, with geometry in chunk-local coordinates.

import * as THREE from 'three';
import {
    CHUNK, ROAD_HALF, WALK_OUT, FRONT_ROW, CURB_H, AHEAD, BEHIND, STOP_LEN, LAMP_SPACING,
} from './config.js';
import { Geo, PointGeo, LineGeo, hexToRgb } from './geo.js';
import { makeRand, hash2 } from './rng.js';
import { buildStop } from './stops.js';

export const LAYER_REFLECTIVE = 1;   // not drawn into the reflection pass
export const LAYER_NO_REFLECT = 2;

const ELEV = 0.3;                     // above this the road is a viaduct

class RoadGeo {
    constructor() { this.pos = []; this.uv = []; this.info = []; }
    tri(a, b, c, ua, ub, uc, info) {
        // Every road-ish surface faces up; fix the winding numerically.
        const e1x = b[0] - a[0], e1z = b[2] - a[2], e2x = c[0] - a[0], e2z = c[2] - a[2];
        if (e1z * e2x - e1x * e2z < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; }
        this.pos.push(...a, ...b, ...c);
        this.uv.push(...ua, ...ub, ...uc);
        for (let i = 0; i < 3; i++) this.info.push(info[0], info[1]);
    }
    quad(p0, p1, p2, p3, t0, t1, t2, t3, info) {
        this.tri(p0, p1, p2, t0, t1, t2, info);
        this.tri(p0, p2, p3, t0, t2, t3, info);
    }
    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('info', new THREE.Float32BufferAttribute(this.info, 2));
        g.computeBoundingSphere();
        return g;
    }
}

export class City {
    constructor(scene, road, mats, tex, seed) {
        this.scene = scene;
        this.road = road;
        this.M = mats;
        this.tex = tex;
        this.seed = seed;
        this.chunks = new Map();
        this.group = new THREE.Group();
        scene.add(this.group);

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mats.ground);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.8;
        ground.layers.set(LAYER_REFLECTIVE);
        ground.renderOrder = -5;
        scene.add(ground);
        this.ground = ground;
        this.builtCount = 0;
    }

    /** Build missing chunks around s (at most `budget` this call) and drop far ones. */
    update(s, budget = 1) {
        const first = Math.floor((s - BEHIND) / CHUNK);
        const last = Math.floor((s + AHEAD) / CHUNK);
        this.road.ensure(s + 2400);
        for (const [i, ch] of this.chunks) {
            if (i < first - 1 || i > last + 1) {
                this.group.remove(ch.group);
                ch.dispose();
                this.chunks.delete(i);
            }
        }
        // nearest first
        for (let i = first; i <= last && budget > 0; i++) {
            if (!this.chunks.has(i)) { this.chunks.set(i, this.build(i)); budget--; }
        }
        const f = this.road.frame(s);
        this.ground.position.set(f.x, -0.8, f.z);
        return last - first + 1 === this.countIn(first, last);
    }

    countIn(a, b) {
        let n = 0;
        for (let i = a; i <= b; i++) if (this.chunks.has(i)) n++;
        return n;
    }

    vents(s, range) {
        const out = [];
        for (const ch of this.chunks.values()) {
            for (const v of ch.vents) if (Math.abs(v.s - s) < range) out.push(v);
        }
        return out;
    }

    // ------------------------------------------------------------------
    build(index) {
        const road = this.road, M = this.M;
        const s0 = index * CHUNK, s1 = s0 + CHUNK;
        road.ensure(s1 + 2400);
        const d = road.districtAt(s0 + 1);
        const def = d.def;
        const R = makeRand(hash2(this.seed, index));
        const O = road.frame(s0, {});
        const ox = O.x, oz = O.z;
        const fr = {};
        const P = (s, u, y) => { road.frame(s, fr); return [fr.x + fr.rx * u - ox, y, fr.z + fr.rz * u - oz]; };
        const neon = def.neon.map(hexToRgb);
        const lamp = def.lamp;

        const G = {
            road: new RoadGeo(),
            bld: new Geo(true),
            flat: new Geo(false),
            sign: new Geo(true),
            signF: new Geo(true),
            bb: M.billboards.map(() => new Geo(true)),
            pts: new PointGeo(),
            lines: new LineGeo(),
        };
        const vents = [];
        const extra = [];       // meshes owned by this chunk with their own resources
        const stops = road.stopsIn(s0 - 60, s1 + 60);
        const inBay = (s) => stops.some((st) => s >= st.s - 4 && s <= st.s + STOP_LEN + 4);
        const inStopZone = (a, b) => stops.some((st) => b > st.s - 10 && a < st.s + STOP_LEN + 12);
        const crossBlocks = (a, b) => road.crossNear(a - 4, b + 4);
        const harborWater = d.type === 'harbor';

        // ---------------- road surface ----------------
        const STEP = 4;
        for (let s = s0; s < s1; s += STEP) {
            const sa = s, sb = s + STEP;
            const ya = road.elevation(sa), yb = road.elevation(sb);
            const elevated = Math.max(ya, yb) > ELEV;
            const cross = road.crossAt(s + STEP / 2) !== null;
            const lampU = elevated ? 6.4 : 9.8;
            const rq = (ua, ub, dy, kind, lu) => {
                G.road.quad(P(sa, ua, ya + dy), P(sa, ub, ya + dy), P(sb, ub, yb + dy), P(sb, ua, yb + dy),
                    [ua, sa - s0], [ub, sa - s0], [ub, sb - s0], [ua, sb - s0], [kind, lu]);
            };
            rq(-ROAD_HALF, ROAD_HALF, 0, 0, lampU);
            if (!elevated) {
                const curb = (u, facing) => {
                    const n = facing;  // +1 faces +r
                    const a = P(sa, u, ya), b = P(sb, u, yb);
                    G.flat.quad(a, b, [b[0], yb + CURB_H, b[2]], [a[0], ya + CURB_H, a[2]], [0.09, 0.085, 0.1], null,
                        [fr.rx * n, 0, fr.rz * n]);
                };
                if (cross) {
                    rq(-WALK_OUT, -ROAD_HALF, 0, 2, 0);
                    rq(ROAD_HALF, WALK_OUT, 0, 2, 0);
                } else {
                    rq(-WALK_OUT - 1, -ROAD_HALF, CURB_H, 1, lampU);
                    curb(-ROAD_HALF, 1);
                    const bay = inBay(s + STEP / 2);
                    const outer = harborWater ? 13 : WALK_OUT + 1;
                    if (bay) {
                        rq(ROAD_HALF, 11.4, 0, 2, 0);
                        rq(11.4, Math.max(outer, 15.5), CURB_H, 1, 0);
                        curb(11.4, -1);
                    } else {
                        rq(ROAD_HALF, outer, CURB_H, 1, lampU);
                        curb(ROAD_HALF, -1);
                    }
                }
            } else {
                // viaduct: deck edges, barriers, pillars
                for (const side of [-1, 1]) {
                    if (side > 0 && inBay(s + STEP / 2)) continue;   // the overlook deck opens here
                    const ue = side * (ROAD_HALF + 0.45);
                    const a = P(sa, ue, ya), b = P(sb, ue, yb);
                    const n = [fr.rx * side, 0, fr.rz * side];
                    G.flat.quad([a[0], ya - 1.5, a[2]], [b[0], yb - 1.5, b[2]], [b[0], yb + 1.0, b[2]], [a[0], ya + 1.0, a[2]],
                        [0.07, 0.065, 0.08], null, n);
                    const ui = side * (ROAD_HALF + 0.05);
                    const c = P(sa, ui, ya), e = P(sb, ui, yb);
                    G.flat.quad(c, e, [e[0], yb + 1.0, e[2]], [c[0], ya + 1.0, c[2]], [0.12, 0.11, 0.14], null,
                        [-n[0], 0, -n[2]]);
                    G.flat.quad([c[0], ya + 1.0, c[2]], [e[0], yb + 1.0, e[2]], [b[0], yb + 1.0, b[2]], [a[0], ya + 1.0, a[2]],
                        [0.16, 0.15, 0.18], null, [0, 1, 0]);
                    if (((s - s0) % 8) === 0) {
                        const q = P(sa, side * (ROAD_HALF + 0.25), ya + 1.08);
                        G.pts.add(q[0], q[1], q[2], neon[(index + (side > 0 ? 1 : 0)) % neon.length], 0.32);
                    }
                }
                // the deck's underside, seen from cross streets and below
                G.flat.quad(P(sa, -ROAD_HALF - 0.45, ya - 1.5), P(sa, ROAD_HALF + 0.45, ya - 1.5),
                    P(sb, ROAD_HALF + 0.45, yb - 1.5), P(sb, -ROAD_HALF - 0.45, yb - 1.5), [0.05, 0.045, 0.06], null, [0, -1, 0]);
                if (((s - s0) % LAMP_SPACING) === 16 && ya > 4) {
                    road.frame(sa, fr);
                    const c = P(sa, 0, 0);
                    G.flat.box(c[0], c[2], -0.8, ya - 1.5, fr.tx, fr.tz, 1.3, 2.4, [0.1, 0.095, 0.12]);
                }
            }

            // ---- lamps every 32 m ----
            if (((s - s0) % LAMP_SPACING) === 16) {
                for (const side of [-1, 1]) {
                    if (side > 0 && inBay(s)) continue;
                    if (cross) continue;
                    road.frame(sa, fr);
                    if (elevated) {
                        const base = P(sa, side * (ROAD_HALF + 0.3), ya + 1);
                        const head = P(sa, side * 6.4, ya + 7.8);
                        G.flat.box(base[0], base[2], ya + 1, ya + 8, fr.tx, fr.tz, 0.12, 0.12, [0.12, 0.12, 0.14]);
                        const arm = P(sa, side * 6.9, ya + 7.9);
                        G.flat.box(arm[0], arm[2], ya + 7.8, ya + 8.0, fr.tx, fr.tz, 0.1, 0.9, [0.12, 0.12, 0.14]);
                        G.pts.add(head[0], head[1], head[2], lamp, 2.2);
                    } else {
                        const base = P(sa, side * 11.2, ya);
                        G.flat.box(base[0], base[2], ya, ya + 7.6, fr.tx, fr.tz, 0.13, 0.13, [0.1, 0.1, 0.12]);
                        const arm = P(sa, side * 10.5, ya);
                        G.flat.box(arm[0], arm[2], ya + 7.45, ya + 7.65, fr.tx, fr.tz, 0.1, 0.8, [0.1, 0.1, 0.12]);
                        const head = P(sa, side * 9.8, ya + 7.35);
                        G.pts.add(head[0], head[1], head[2], lamp, 2.1);
                    }
                }
            }
        }

        // ---------------- cross streets ----------------
        for (let s = s0; s < s1; s += 4) {
            const c = road.crossAt(s);
            if (c !== s) continue;
            road.frame(c, fr);
            const tx = fr.tx, tz = fr.tz, rx = fr.rx, rz = fr.rz;
            const cy = road.elevation(c);
            const cx0 = fr.x - ox, cz0 = fr.z - oz;
            const at = (along, u, dy = 0) => [cx0 + tx * along + rx * u, cy + dy, cz0 + tz * along + rz * u];
            for (const side of [-1, 1]) {
                const u0 = side * WALK_OUT, u1 = side * 170;
                G.road.quad(at(-9, u0), at(-9, u1), at(9, u1), at(9, u0),
                    [u0, 0], [u1, 0], [u1, 18], [u0, 18], [2, 0]);
                // corner traffic light
                const pole = at(-10.5, side * 10.5);
                G.flat.box(pole[0], pole[2], cy, cy + 6.4, tx, tz, 0.14, 0.14, [0.1, 0.1, 0.12]);
                const arm = at(-10.5, side * 6.8);
                G.flat.box(arm[0], arm[2], cy + 6.2, cy + 6.4, tx, tz, 0.08, 3.6, [0.1, 0.1, 0.12]);
                const head = at(-10.5, side * 3.4);
                G.flat.box(head[0], head[2], cy + 5.0, cy + 6.3, tx, tz, 0.25, 0.3, [0.05, 0.05, 0.06]);
                const L0 = at(-10.8, side * 3.4);
                // our light runs green / amber / red on a 24 s cycle
                G.pts.add(L0[0], cy + 6.05, L0[2], [1, 0.15, 0.1], 0.7, 1 / 24, -0.55, 0.45);
                G.pts.add(L0[0], cy + 5.65, L0[2], [1, 0.65, 0.1], 0.7, 1 / 24, -0.45, 0.1);
                G.pts.add(L0[0], cy + 5.25, L0[2], [0.2, 1, 0.55], 0.7, 1 / 24, 0, 0.45);
                // street lamps down the side street fade into the haze
                for (let k = 1; k < 6; k++) {
                    const q = at(side * 7, side * (WALK_OUT + k * 28));
                    G.pts.add(q[0], cy + 6.8, q[2], lamp, 1.8);
                }
            }
            // crosswalk stripes
            for (const off of [-12.5, 12.5]) {
                for (let u = -ROAD_HALF + 0.5; u < ROAD_HALF - 0.4; u += 1.3) {
                    G.flat.quad(at(off - 1.6, u, 0.02), at(off - 1.6, u + 0.65, 0.02), at(off + 1.6, u + 0.65, 0.02), at(off + 1.6, u, 0.02),
                        [0.26, 0.26, 0.28], null, [0, 1, 0]);
                }
            }
        }

        // ---------------- buildings ----------------
        const ctx = {
            road, R, G, P, fr, ox, oz, s0, s1, d, def, neon, lamp, index, M, extra, vents,
            signs: this.tex.signs, billboardCount: M.billboards.length, city: this,
        };
        const rightIsWater = harborWater;
        for (const side of [-1, 1]) {
            if (side > 0 && rightIsWater) continue;
            this._row(ctx, side, inStopZone, crossBlocks);
        }
        for (const side of [-1, 1]) {
            if (side > 0 && rightIsWater) continue;
            this._backRow(ctx, side);
        }
        if (rightIsWater) this._harbor(ctx, inStopZone);
        if (d.type === 'market') this._lanterns(ctx);
        if (d.type === 'skyway') this._below(ctx);

        // steam vents in the road
        const nv = d.type === 'market' ? R.int(1, 3) : R.int(0, 2);
        for (let k = 0; k < nv; k++) {
            const s = R.range(s0, s1), u = R.pick([-5.4, -1.8, 1.8, 5.4, 9.5, -9.5]) + R.range(-0.6, 0.6);
            if (road.elevation(s) > ELEV) continue;
            road.frame(s, fr);
            vents.push({ s, x: fr.x + fr.rx * u, y: road.elevation(s) + 0.1, z: fr.z + fr.rz * u, rate: R.range(0.6, 1.4) });
        }

        // ---------------- stops ----------------
        for (const st of stops) {
            if (st.s >= s0 && st.s < s1) buildStop(ctx, st);
        }

        return this._assemble(index, ox, oz, G, vents, extra);
    }

    _assemble(index, ox, oz, G, vents, extra) {
        const M = this.M;
        const group = new THREE.Group();
        group.position.set(ox, 0, oz);
        const meshes = [];
        const add = (obj, layer = 0, order = 0) => {
            obj.layers.set(layer);
            obj.renderOrder = order;
            obj.matrixAutoUpdate = false;
            obj.updateMatrix();
            group.add(obj);
            meshes.push(obj);
        };
        add(new THREE.Mesh(G.road.build(), M.road), LAYER_REFLECTIVE, -2);
        if (!G.bld.empty) add(new THREE.Mesh(G.bld.build(), M.building));
        if (!G.flat.empty) add(new THREE.Mesh(G.flat.build(), M.flat));
        if (!G.sign.empty) add(new THREE.Mesh(G.sign.build(), M.sign), 0, 2);
        if (!G.signF.empty) add(new THREE.Mesh(G.signF.build(), M.signFlicker), 0, 2);
        G.bb.forEach((g, k) => { if (!g.empty) add(new THREE.Mesh(g.build(), M.billboards[k])); });
        if (!G.pts.empty) add(new THREE.Points(G.pts.build(), M.points), 0, 3);
        if (!G.lines.empty) add(new THREE.LineSegments(G.lines.build(), M.lines));
        for (const e of extra) add(e.mesh, e.layer || 0, e.order || 0);
        this.group.add(group);
        this.builtCount++;
        return {
            index, group, vents,
            dispose() {
                for (const m of meshes) m.geometry.dispose();
                for (const e of extra) {
                    if (e.texture) e.texture.dispose();
                    if (e.material) e.material.dispose();
                }
            },
        };
    }

    // ------------------------------------------------------------------
    // Front row: lots along the sidewalk, each a building with a shopfront,
    // signs, and whatever is on the roof.
    _row(ctx, side, inStopZone, crossBlocks) {
        const { road, R, s0, s1, def, d } = ctx;
        let s = s0 + R.range(0, 2);
        while (s < s1 - 4) {
            let w = R.range(def.width[0], def.width[1]);
            if (s + w > s1) w = s1 - s;
            if (w < 5) break;
            if (crossBlocks(s, s + w) || (side > 0 && inStopZone(s, s + w))) { s += 4; continue; }
            this._building(ctx, s + w / 2, w, side);
            s += w + (d.type === 'market' ? R.range(0, 0.4) : R.range(0.5, 4));
        }
        void road;
    }

    _building(ctx, sm, w, side) {
        const { road, R, G, fr, ox, oz, def, d, neon } = ctx;
        road.frame(sm, fr);
        const roadY = road.elevation(sm);
        const ax = fr.tx, az = fr.tz, rx = fr.rx, rz = fr.rz;
        const depth = R.range(def.depth[0], def.depth[1]);
        const extraSet = d.type === 'skyway' ? 11 : roadY > ELEV ? 3 : 0;
        const setback = FRONT_ROW + extraSet + R.range(0, 1.2);
        const uc = side * (setback + depth / 2);
        const cx = fr.x + rx * uc - ox, cz = fr.z + rz * uc - oz;
        const h = Math.max(roadY + 6, def.height[0] + (def.height[1] - def.height[0]) * Math.pow(R.next(), 1.6));
        const tintBase = R.pick(def.tint), tk = R.range(0.6, 1.0);
        const tint = [tintBase[0] * tk, tintBase[1] * tk, tintBase[2] * tk];
        const dense = d.type === 'heights';
        const warehouse = d.type === 'harbor' && R.chance(0.6);
        const win = warehouse ? null : { cw: dense ? 2.6 : 3.2, ch: dense ? 3.0 : 3.6, ou: R.int(0, 31) / 32, ov: R.int(0, 31) / 32 };
        const hw = w / 2 - 0.1, hd = depth / 2;
        const frontFace = side > 0 ? 3 : 2;          // face index whose normal points at the road
        const fnx = -side * rx, fnz = -side * rz;     // that normal
        const facadeU = side * setback;
        const fx = fr.x + rx * facadeU - ox, fz = fr.z + rz * facadeU - oz;   // facade centre (local)

        const shop = roadY < ELEV && R.chance(def.storefront);
        const shopH = 4.2;
        if (shop) {
            G.flat.box(cx, cz, 0, shopH, ax, az, hw, hd, [0.05, 0.045, 0.06], null, { top: false });
            // lit window glass on the shopfront
            const shut = R.chance(0.22);
            const glow = shut ? [0.11, 0.1, 0.12] : R.chance(0.5) ? R.pick(neon).map((v) => 0.3 + v * 0.5) : R.pick([[1, 0.72, 0.42], [0.75, 0.88, 1], [1, 0.85, 0.6]]);
            const k = shut ? 1 : R.range(0.32, 0.68);
            const top = [glow[0] * k * 0.6, glow[1] * k * 0.6, glow[2] * k * 0.6];
            const bot = [glow[0] * k, glow[1] * k, glow[2] * k];
            const gw = hw - 0.7;
            const ex = fx + fnx * 0.04, ez = fz + fnz * 0.04;
            const rr = [fnz, -fnx];    // viewer's right
            const p0 = [ex - rr[0] * gw, 0.35, ez - rr[1] * gw], p1 = [ex + rr[0] * gw, 0.35, ez + rr[1] * gw];
            G.flat.quad(p0, p1, [p1[0], 3.5, p1[2]], [p0[0], 3.5, p0[2]], [bot, bot, top, top], null, [fnx, 0, fnz]);
            // mullions
            for (let m = -gw + 2.2; m < gw - 0.5; m += R.range(2.0, 3.2)) {
                const mx = ex + fnx * 0.02 + rr[0] * m, mz = ez + fnz * 0.02 + rr[1] * m;
                G.flat.box(mx, mz, 0.35, 3.5, rr[0], rr[1], 0.07, 0.03, [0.03, 0.03, 0.04], null, { top: false });
            }
            if (R.chance(0.55)) {
                const ac = R.pick(neon).map((v) => v * 0.4);
                const awx = fx + fnx * 0.8, awz = fz + fnz * 0.8;
                G.flat.box(awx, awz, 3.7, 3.95, ax, az, hw - 0.3, 0.85, ac, null, { bottom: true });
            }
            if (!shut) ctx.G.pts.add(fx + fnx * 0.6, 3.6, fz + fnz * 0.6, bot, 1.2);
        }
        const y0 = shop ? shopH : 0;
        G.bld.box(cx, cz, y0, h, ax, az, hw, hd, tint, win);

        // setback tiers on tall towers
        let top = h, thw = hw, thd = hd;
        if (h > 55 && R.chance(0.55)) {
            const tiers = R.int(1, 2);
            for (let t = 0; t < tiers; t++) {
                thw *= R.range(0.55, 0.8); thd *= R.range(0.55, 0.85);
                const nh = top + h * R.range(0.12, 0.35);
                G.bld.box(cx, cz, top, nh, ax, az, thw, thd, tint, win);
                top = nh;
            }
        }
        this._roof(ctx, cx, cz, top, ax, az, thw, thd, h);

        // vertical neon on the front corners
        if (h > 30 && R.chance(0.22)) {
            const c = R.pick(neon);
            for (const e of [-1, 1]) {
                const ex = fx + fnx * 0.12 + ax * e * (hw - 0.1), ez = fz + fnz * 0.12 + az * e * (hw - 0.1);
                G.flat.box(ex, ez, y0 + 1, h - 0.5, ax, az, 0.12, 0.12, c, null, { flat: true });
            }
        }

        // ---- signs ----
        const S = def.signs;
        // blade signs hanging off the facade, readable from up the street
        const blades = R.next() < S * 0.6 ? 1 + (R.next() < S * 0.3 ? 1 : 0) : 0;
        for (let b = 0; b < blades; b++) {
            const along = (b === 0 ? -1 : 1) * (hw - 1.2) * R.range(0.5, 1);
            const hgt = R.range(4.5, Math.min(12, Math.max(5, h - 6)));
            const y0s = shop ? R.range(4.4, 6) : R.range(3, 7);
            const halfW = hgt / 8;
            const bx = fx + ax * along + fnx * (halfW + 0.2), bz = fz + az * along + fnz * (halfW + 0.2);
            this._blade(ctx, bx, bz, ax, az, halfW, y0s, y0s + hgt);
            G.flat.box(fx + ax * along + fnx * 0.1, fz + az * along + fnz * 0.1, y0s + hgt * 0.15, y0s + hgt * 0.17, fnx, fnz, 0.3, 0.04, [0.08, 0.08, 0.1], null, { top: false });
        }
        // flat facade signs
        const flats = Math.floor(S * R.range(0.3, 1.8));
        let yCursor = shop ? 4.5 : R.range(3, 8);
        for (let k = 0; k < flats && yCursor < h - 3; k++) {
            const width = Math.min(w * 0.85, R.range(4, 11));
            const hgt = width / 4;
            if (yCursor + hgt > h - 1) break;
            const along = R.range(-(hw - width / 2 - 0.2), hw - width / 2 - 0.2);
            const sx = fx + ax * along + fnx * 0.14, sz = fz + az * along + fnz * 0.14;
            this._flatSign(ctx, sx, sz, fnx, fnz, width / 2, yCursor, yCursor + hgt);
            yCursor += hgt + R.range(1.5, 7);
        }
        // big billboard high on a tall tower
        if (h > 45 && R.chance(0.33)) {
            this._billboard(ctx, fx, fz, fnx, fnz, Math.min(w - 2, R.range(12, 24)), R.range(16, Math.max(17, h * 0.6)), h);
        }
        // a sign standing on a low roof
        if (h < 30 && R.chance(0.3 * S)) {
            const width = Math.min(w * 0.9, R.range(5, 12));
            const ex = fx + fnx * -1.5, ez = fz + fnz * -1.5;
            this._flatSign(ctx, ex, ez, fnx, fnz, width / 2, h + 0.4, h + 0.4 + width / 4, true);
            G.flat.box(ex - fnx * 0.3, ez - fnz * 0.3, h, h + 0.5, ax, az, width / 2 - 0.4, 0.1, [0.06, 0.06, 0.07]);
        }
        void frontFace;
    }

    _roof(ctx, cx, cz, top, ax, az, hw, hd, h) {
        const { R, G, neon } = ctx;
        if (R.chance(0.45)) {
            const ah = R.range(5, 24);
            G.flat.box(cx, cz, top, top + ah, ax, az, 0.18, 0.18, [0.12, 0.11, 0.13]);
            G.pts.add(cx, top + ah + 0.3, cz, [1, 0.12, 0.1], 1.5, R.range(0.35, 0.7), R.next(), 0.22);
        }
        if (R.chance(0.5)) {
            const n = R.int(1, 3);
            for (let i = 0; i < n; i++) {
                const ox = R.range(-hw * 0.6, hw * 0.6), oz = R.range(-hd * 0.6, hd * 0.6);
                const px = cx + ax * ox - az * oz, pz = cz + az * ox + ax * oz;
                G.flat.box(px, pz, top, top + R.range(1, 2.6), ax, az, R.range(0.8, 2), R.range(0.8, 1.6), [0.09, 0.085, 0.1]);
            }
        }
        if (h > 40 && R.chance(0.3)) {
            const c = R.pick(neon);
            const bx = -az, bz = ax;
            const edge = (a0x, a0z, a1x, a1z) => {
                const len = Math.hypot(a1x - a0x, a1z - a0z), n = Math.max(2, Math.floor(len / 4));
                for (let i = 0; i <= n; i++) {
                    const t = i / n;
                    G.pts.add(a0x + (a1x - a0x) * t, top + 0.2, a0z + (a1z - a0z) * t, c, 0.9);
                }
            };
            const c00 = [cx - ax * hw - bx * hd, cz - az * hw - bz * hd], c10 = [cx + ax * hw - bx * hd, cz + az * hw - bz * hd];
            const c11 = [cx + ax * hw + bx * hd, cz + az * hw + bz * hd], c01 = [cx - ax * hw + bx * hd, cz - az * hw + bz * hd];
            edge(...c00, ...c10); edge(...c10, ...c11); edge(...c11, ...c01); edge(...c01, ...c00);
        }
    }

    // Vertical blade sign, two single-sided faces so neither reads mirrored.
    _blade(ctx, x, z, ax, az, halfW, y0, y1) {
        const { R, G, signs } = ctx;
        const rect = R.pick(signs.vertical);
        const geo = R.chance(0.12) ? G.signF : G.sign;
        for (const dir of [-1, 1]) {
            const nx = ax * dir, nz = az * dir;
            const rx = nz, rz = -nx;
            const cx = x + nx * 0.03, cz = z + nz * 0.03;
            const p0 = [cx - rx * halfW, y0, cz - rz * halfW], p1 = [cx + rx * halfW, y0, cz + rz * halfW];
            geo.quad(p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], [1, 1, 1],
                [[rect.u0, rect.v0], [rect.u1, rect.v0], [rect.u1, rect.v1], [rect.u0, rect.v1]], [nx, 0, nz]);
        }
        // dark backing between the two faces
        G.flat.box(x, z, y0 + 0.1, y1 - 0.1, -az, ax, halfW * 0.92, 0.025, [0.03, 0.025, 0.04], null, { top: false });
    }

    _flatSign(ctx, x, z, nx, nz, halfW, y0, y1, twoSided = false) {
        const { R, G, signs } = ctx;
        const rect = R.pick(signs.horizontal);
        const geo = R.chance(0.12) ? G.signF : G.sign;
        const faces = twoSided ? [1, -1] : [1];
        for (const dir of faces) {
            const fnx = nx * dir, fnz = nz * dir;
            const rx = fnz, rz = -fnx;
            const cx = x + fnx * 0.03, cz = z + fnz * 0.03;
            const p0 = [cx - rx * halfW, y0, cz - rz * halfW], p1 = [cx + rx * halfW, y0, cz + rz * halfW];
            geo.quad(p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], [1, 1, 1],
                [[rect.u0, rect.v0], [rect.u1, rect.v0], [rect.u1, rect.v1], [rect.u0, rect.v1]], [fnx, 0, fnz]);
        }
    }

    _billboard(ctx, x, z, nx, nz, width, y0, h) {
        const { R, G } = ctx;
        const animated = R.chance(0.45);
        const height = animated ? width / 2 : width / 4;
        if (y0 + height > h - 2) y0 = Math.max(6, h - 2 - height);
        const rx = nz, rz = -nx, hw = width / 2;
        const cx = x + nx * 0.25, cz = z + nz * 0.25;
        const p0 = [cx - rx * hw, y0, cz - rz * hw], p1 = [cx + rx * hw, y0, cz + rz * hw];
        const p2 = [p1[0], y0 + height, p1[2]], p3 = [p0[0], y0 + height, p0[2]];
        if (animated) {
            const k = R.int(0, ctx.billboardCount - 1);
            G.bb[k].quad(p0, p1, p2, p3, [0.95, 0.95, 0.95], [[0, 0], [1, 0], [1, 1], [0, 1]], [nx, 0, nz]);
        } else {
            const rect = R.pick(ctx.signs.horizontal);
            G.sign.quad(p0, p1, p2, p3, [1, 1, 1],
                [[rect.u0, rect.v0], [rect.u1, rect.v0], [rect.u1, rect.v1], [rect.u0, rect.v1]], [nx, 0, nz]);
        }
        // frame
        G.flat.box(cx - nx * 0.15, cz - nz * 0.15, y0 - 0.4, y0 + height + 0.4, -nz, nx, hw + 0.4, 0.12, [0.04, 0.04, 0.05]);
        // a few spotlights along the bottom edge
        for (let i = -1; i <= 1; i++) G.pts.add(cx + rx * hw * 0.7 * i + nx * 0.6, y0 - 0.3, cz + rz * hw * 0.7 * i + nz * 0.6, [1, 0.95, 0.8], 0.6);
    }

    // Towers behind the front row, checked against the whole visible road so
    // nothing ever stands in the way when the road curves round.
    _backRow(ctx, side) {
        const { road, R, G, fr, ox, oz, s0, s1, d, def, neon } = ctx;
        const t = d.type;
        const count = t === 'downtown' ? R.int(2, 4) : t === 'skyway' ? R.int(2, 4) : t === 'heights' ? R.int(2, 3) : t === 'market' ? R.int(1, 3) : R.int(0, 1);
        const hRange = { downtown: [90, 330], skyway: [80, 300], heights: [60, 150], market: [25, 80], harbor: [20, 60] }[t];
        const tries = count + (R.chance(t === 'downtown' || t === 'skyway' ? 0.4 : 0.15) ? 1 : 0);
        for (let i = 0; i < tries; i++) {
            const mega = i === count;
            const sb = R.range(s0, s1);
            const u = side * (mega ? R.range(230, 430) : R.range(52, 175));
            road.frame(sb, fr);
            const wx = fr.x + fr.rx * u, wz = fr.z + fr.rz * u;
            const w = mega ? R.range(55, 90) : R.range(18, 46), dp = mega ? R.range(55, 90) : R.range(18, 40);
            const clear = road.clearance(wx, wz, sb - 1200, sb + 1200);
            if (clear < Math.hypot(w, dp) / 2 + 18) continue;
            const h = mega ? R.range(320, 520) : hRange[0] + (hRange[1] - hRange[0]) * Math.pow(R.next(), 1.4);
            const tint = R.pick(def.tint).map((v) => v * R.range(0.55, 0.95));
            const win = { cw: t === 'heights' ? 2.6 : 3.4, ch: 3.6, ou: R.int(0, 31) / 32, ov: R.int(0, 31) / 32 };
            const ax = fr.tx, az = fr.tz;
            const cx = wx - ox, cz = wz - oz;
            G.bld.box(cx, cz, 0, h, ax, az, w / 2, dp / 2, tint, win);
            let top = h, hw = w / 2, hd = dp / 2;
            if (R.chance(0.6)) {
                hw *= R.range(0.5, 0.8); hd *= R.range(0.5, 0.8);
                const nh = h + h * R.range(0.1, 0.3);
                G.bld.box(cx, cz, top, nh, ax, az, hw, hd, tint, win);
                top = nh;
            }
            this._roof(ctx, cx, cz, top, ax, az, hw, hd, 99);
            // big sign facing the road
            if (R.chance(mega ? 0.8 : 0.35)) {
                const fnx = -side * fr.rx, fnz = -side * fr.rz;
                const fx = cx + fnx * dp / 2, fz = cz + fnz * dp / 2;
                this._billboard(ctx, fx, fz, fnx, fnz, Math.min(w - 4, R.range(18, 36)), R.range(30, h * 0.7), h);
            }
            if (R.chance(0.3)) {
                const c = R.pick(neon);
                const fnx = -side * fr.rx, fnz = -side * fr.rz;
                for (const e of [-1, 1]) {
                    const ex = cx + fnx * (dp / 2 + 0.1) + ax * e * (w / 2 - 0.2), ez = cz + fnz * (dp / 2 + 0.1) + az * e * (w / 2 - 0.2);
                    G.flat.box(ex, ez, 2, h, ax, az, 0.25, 0.25, c, null, { flat: true });
                }
            }
        }
    }

    // Harbour: water to the right, a seawall, piers, cranes, ships.
    _harbor(ctx, inStopZone) {
        const { road, R, G, fr, P, s0, s1, lamp } = ctx;
        for (let s = s0; s < s1; s += 4) {
            const ya = road.elevation(s), yb = road.elevation(s + 4);
            G.road.quad(P(s, 13, -0.5), P(s, 330, -0.5), P(s + 4, 330, -0.5), P(s + 4, 13, -0.5),
                [13, s - s0], [330, s - s0], [330, s + 4 - s0], [13, s + 4 - s0], [3, 0]);
            if (Math.max(ya, yb) <= ELEV) {
                const a = P(s, 13, -0.5), b = P(s + 4, 13, -0.5);
                road.frame(s, fr);
                G.flat.quad(a, b, [b[0], yb + CURB_H, b[2]], [a[0], ya + CURB_H, a[2]], [0.08, 0.08, 0.09], null, [fr.rx, 0, fr.rz]);
                const r0 = P(s, 12.6, ya + 1.1), r1 = P(s + 4, 12.6, yb + 1.1);
                G.lines.seg(r0, r1, [0.25, 0.25, 0.3]);
                if (((s - s0) % 8) === 0) G.flat.box(r0[0], r0[2], ya + CURB_H, ya + 1.1, fr.tx, fr.tz, 0.06, 0.06, [0.15, 0.15, 0.18]);
            }
        }
        // piers
        if (R.chance(0.45)) {
            const sp = R.range(s0 + 8, s1 - 8);
            if (!inStopZone(sp - 6, sp + 6) && road.elevation(sp) <= ELEV) {
                road.frame(sp, fr);
                const len = R.range(30, 75);
                const c = P(sp, 13 + len / 2, 0);
                G.flat.box(c[0], c[2], -0.5, 0.15, fr.tx, fr.tz, 3, len / 2, [0.09, 0.07, 0.06]);
                for (let k = 8; k < len; k += 10) {
                    const q = P(sp, 13 + k, 0);
                    G.pts.add(q[0] + fr.tx * 2.6, 3.4, q[2] + fr.tz * 2.6, lamp, 1.2);
                    G.flat.box(q[0] + fr.tx * 2.6, q[2] + fr.tz * 2.6, 0.15, 3.3, fr.tx, fr.tz, 0.06, 0.06, [0.1, 0.1, 0.11]);
                }
                this._boat(ctx, P(sp, 13 + len + 7, 0), fr.tx, fr.tz, R.range(9, 16));
            }
        }
        // cranes
        if (R.chance(0.4)) {
            const sc = R.range(s0, s1), uc = R.range(30, 60);
            road.frame(sc, fr);
            const col = [0.28, 0.13, 0.05];
            const tx = fr.tx, tz = fr.tz, rx = fr.rx, rz = fr.rz;
            const base = P(sc, uc, 0);
            for (const a of [-6, 6]) for (const b of [-4, 4]) {
                G.flat.box(base[0] + tx * a + rx * b, base[2] + tz * a + rz * b, -0.5, 32, tx, tz, 0.5, 0.5, col);
            }
            G.flat.box(base[0], base[2], 32, 34, tx, tz, 6.5, 4.5, col);
            const bm = P(sc, uc + 18, 0);
            G.flat.box(bm[0], bm[2], 34.5, 36, tx, tz, 0.9, 34, col);
            G.flat.box(base[0] + rx * -3, base[2] + rz * -3, 34, 37, tx, tz, 2, 2, [0.1, 0.09, 0.1]);
            G.pts.add(base[0], 38.5, base[2], [1, 0.1, 0.1], 1.6, 0.5, R.next(), 0.25);
            const tip = P(sc, uc + 52, 36.5);
            G.pts.add(tip[0], tip[1], tip[2], [1, 0.1, 0.1], 1.6, 0.5, R.next(), 0.25);
            G.pts.add(base[0], 31.5, base[2], [1, 0.8, 0.5], 2.2);
        }
        // ships out on the water
        if (R.chance(0.35)) {
            const ss = R.range(s0, s1), us = R.range(140, 300);
            road.frame(ss, fr);
            const c = P(ss, us, 0);
            this._ship(ctx, c, fr.tx, fr.tz);
        }
        // buoys
        for (let k = 0; k < R.int(0, 3); k++) {
            const q = P(R.range(s0, s1), R.range(40, 260), 0.4);
            G.pts.add(q[0], q[1], q[2], R.chance(0.5) ? [1, 0.15, 0.1] : [0.1, 1, 0.3], 1.0, R.range(0.25, 0.5), R.next(), 0.3);
        }
    }

    _boat(ctx, c, tx, tz, len) {
        const { G, R } = ctx;
        G.flat.box(c[0], c[2], -0.8, 0.6, tx, tz, len / 2, 2.4, [0.12, 0.12, 0.15]);
        G.flat.box(c[0] - tx * len * 0.15, c[2] - tz * len * 0.15, 0.6, 2.6, tx, tz, len * 0.18, 1.6, [0.18, 0.17, 0.2]);
        G.pts.add(c[0] - tx * len * 0.15, 2.2, c[2] - tz * len * 0.15, [1, 0.75, 0.4], 1.6);
        G.pts.add(c[0] + tx * len * 0.45, 1.2, c[2] + tz * len * 0.45, R.pick([[1, 0.2, 0.6], [0.2, 0.9, 1]]), 0.9);
    }

    _ship(ctx, c, tx, tz) {
        const { G, R } = ctx;
        const L = R.range(60, 120);
        G.flat.box(c[0], c[2], -0.5, 7, tx, tz, L / 2, 8, [0.07, 0.07, 0.09]);
        G.flat.box(c[0] - tx * L * 0.35, c[2] - tz * L * 0.35, 7, 20, tx, tz, 6, 7, [0.12, 0.12, 0.14]);
        for (let i = 0; i < 14; i++) {
            const a = R.range(-L / 2, L / 2);
            G.pts.add(c[0] + tx * a, 7.6, c[2] + tz * a, [1, 0.8, 0.5], 0.9);
        }
        G.pts.add(c[0] - tx * L * 0.35, 21.5, c[2] - tz * L * 0.35, [1, 1, 1], 1.4, 0.4, R.next(), 0.2);
        G.pts.add(c[0] + tx * L / 2, 8, c[2] + tz * L / 2, [0.2, 1, 0.3], 1.2);
    }

    // Market streets: strings of paper lanterns across the road.
    _lanterns(ctx) {
        const { road, R, G, P, s0, s1 } = ctx;
        for (let s = s0 + 8; s < s1; s += 16) {
            if (!R.chance(0.7) || road.elevation(s) > ELEV) continue;
            const y = road.elevation(s) + R.range(7, 9);
            const n = 14;
            let prev = null;
            const cols = [[1, 0.2, 0.1], [1, 0.5, 0.15], [1, 0.25, 0.5], [1, 0.75, 0.3]];
            const c0 = R.pick(cols);
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const u = -12.6 + 25.2 * t;
                const sag = Math.sin(t * Math.PI) * 1.6;
                const q = P(s + Math.sin(t * Math.PI) * 0.5, u, y - sag);
                if (prev) G.lines.seg(prev, q, [0.18, 0.12, 0.1]);
                if (i > 0 && i < n && i % 1 === 0) G.pts.add(q[0], q[1] - 0.45, q[2], R.chance(0.8) ? c0 : R.pick(cols), 0.8);
                prev = q;
            }
        }
    }

    // Under the skyway: the lit grid of streets far below.
    _below(ctx) {
        const { R, G, P, s0, s1, lamp } = ctx;
        for (let k = 0; k < 60; k++) {
            const side = R.chance(0.5) ? -1 : 1;
            const q = P(R.range(s0, s1), side * R.range(14, 190), R.range(0.5, 3));
            const c = R.chance(0.7) ? lamp : R.chance(0.5) ? [1, 0.2, 0.15] : [0.9, 0.95, 1];
            G.pts.add(q[0], q[1], q[2], c, R.range(0.8, 2.2));
        }
    }
}
