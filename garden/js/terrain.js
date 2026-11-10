// The island: a signed-distance coastline grown around the paths, a baked
// height field (paths and plazas flattened into it, granite cliffs at the
// shore), the terrain mesh and fast height/shore queries for everything else.

import * as THREE from 'three';
import { fbm2, ridged2, smoothstep, clamp, lerp, angleDiff } from './util.js';
import { PLAZA_R, PATH_HALF, PAVILION_PLAZA, GATE_S, FIRST_STATUE } from './layout.js';
import { terrainDetail } from './textures.js';

const smin = (a, b, k) => {
    const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
    return lerp(b, a, h) - k * h * (1 - h);
};

function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
    return { d: Math.hypot(px - ax - dx * t, pz - az - dz * t), t };
}

/** Low-frequency ground level that paths follow. */
export const lowGround = (x, z) => 3.6 + 1.5 * fbm2(x * 0.011 + 3.1, z * 0.011 - 7.3, 2);
export const HUB_Y = lowGround(0, 0) + 0.3;
/** The ground before paths, plazas and the shore have their way with it. */
const landAt = (x, z) => lowGround(x, z) + Math.pow(fbm2(x * 0.03 + 11, z * 0.03 - 4, 4) * 0.5 + 0.5, 1.6) * 6.5 + ridged2(x * 0.05, z * 0.05, 3) * 1.4;
const PIER_Y = 1.55;      // the fishing pier's deck, a little above the dock's
const PIER_SLOPE = 0.22;  // how steeply its gangway comes down from the shore
const ISLET_R = 11;
// the pirate wharf below the Delvers' Descent: a wide deck on pilings with a galleon moored along it
// the paved apron round the glowing well beside the Hearthgarden pavilion
export const WELL_APRON = 3.4;
// the crashed rocket in a grove: its hull's length and radius, and the scorched crater it dug
export const CRASH = { len: 21, r: 2.6, crater: 10 };
export const WHARF = { y: 2.0, slope: 0.2, half: 3.2, ramp: 2.1, head: 5.2, berthLx: 7.5, shipLen: 25, bowRoom: 3, tail: 1.6, headLen: 7 };

/** Uniform-grid index of line segments for nearest-path queries. */
class SegmentGrid {
    constructor(cell) {
        this.cell = cell;
        this.map = new Map();
    }
    key(i, j) {
        return i * 73856 + j;
    }
    add(seg, reach) {
        const c = this.cell;
        const i0 = Math.floor((Math.min(seg.ax, seg.bx) - reach) / c), i1 = Math.floor((Math.max(seg.ax, seg.bx) + reach) / c);
        const j0 = Math.floor((Math.min(seg.az, seg.bz) - reach) / c), j1 = Math.floor((Math.max(seg.az, seg.bz) + reach) / c);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const k = this.key(i, j);
            if (!this.map.has(k)) this.map.set(k, []);
            this.map.get(k).push(seg);
        }
    }
    near(x, z) {
        return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) || [];
    }
}

export class Island {
    constructor(layout, resolution = 0.8) {
        this.layout = layout;
        this._prepare();
        this.half = layout.islandR + 34;
        this.n = Math.min(360, Math.ceil((this.half * 2) / resolution) + 1);
        this.step = (this.half * 2) / (this.n - 1);
        this._bake();
    }

    _prepare() {
        const L = this.layout;
        // give every path point a target height
        for (const sp of L.spokes) {
            for (const p of sp.pts) p.y = lerp(HUB_Y, lowGround(p.x, p.z) + 0.25, smoothstep(0, 18, p.s));
            const end = sp.pts[sp.pts.length - 1];
            sp.pavilion.y = end.y;
            for (const st of sp.statues) st.y = samplePathY(sp.pts, st.s);
            sp.gate.y = samplePathY(sp.pts, sp.gate.s);
        }
        const dl = L.dock.pts[L.dock.pts.length - 1].s;
        for (const p of L.dock.pts) p.y = lerp(HUB_Y, L.dock.y - 0.12, smoothstep(0, dl - 3, p.s));

        // coarse capsules for the coastline
        this.capsules = [];
        for (const sp of L.spokes) {
            const step = 8;
            for (let i = 0; i + step < sp.pts.length; i += step) {
                const a = sp.pts[i], b = sp.pts[Math.min(i + step, sp.pts.length - 1)];
                this.capsules.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, ra: 13, rb: 13 });
            }
            this.capsules.push({ ax: sp.pavilion.x, az: sp.pavilion.z, bx: sp.pavilion.x, bz: sp.pavilion.z, ra: PAVILION_PLAZA + 8, rb: 0 });
        }
        for (const f of L.features) {
            const r = f.type === 'lighthouse' ? 9 : f.type === 'grove' ? 11 : 13;
            this.capsules.push({ ax: f.x, az: f.z, bx: f.x, bz: f.z, ra: r, rb: 0 });
        }

        // the clock-tower islet: out past the shore on the dock side
        const a = (Math.PI / L.slots) * 0.75;
        let r = L.hubR;
        while (this.coast(Math.sin(a) * r, Math.cos(a) * r) < ISLET_R + 13 && r < 400) r += 2;
        L.islet = { x: Math.sin(a) * r, z: Math.cos(a) * r, r: ISLET_R };
        this._isletCrossing();
        this._fishingPier();
        this._pirateWharf();
        this._gardenWell();
        this._crashSite();

        // fine segments for flattening, carrying their heights
        this.paths = new SegmentGrid(12);
        const addLine = (pts, stride) => {
            for (let i = 0; i < pts.length - 1; i += stride) {
                const a = pts[i], b = pts[Math.min(i + stride, pts.length - 1)];
                this.paths.add({ ax: a.x, az: a.z, bx: b.x, bz: b.z, ay: a.y, by: b.y }, 14);
            }
        };
        for (const sp of L.spokes) addLine(sp.pts, 3);
        addLine(L.dock.pts, 3);
        addLine(L.trail.pts, 3);
        addLine(L.pier.trail.pts, 2);
        addLine(L.wharf.trail.pts, 2);

        this.plazas = [{ x: 0, z: 0, r: PLAZA_R + 0.5, y: HUB_Y, fall: 9 }];
        for (const sp of L.spokes) this.plazas.push({ x: sp.pavilion.x, z: sp.pavilion.z, r: PAVILION_PLAZA + 0.3, y: sp.pavilion.y, fall: 7 });
        this.mounds = L.features
            .filter((f) => ['gear', 'tower', 'stones', 'tree', 'lighthouse'].includes(f.type))
            .map((f) => ({ x: f.x, z: f.z, h: f.type === 'lighthouse' ? 2.5 : f.type === 'tree' ? 1.2 : 3, r: 9 }));
        for (const f of L.features) {
            if (f.type === 'fountain') this.plazas.push({ x: f.x, z: f.z, r: 6.5, y: lowGround(f.x, f.z) + 0.3, fall: 6 });
            // the carousel's paved ring: wide enough to walk all the way round the machine
            if (f.type === 'carousel') this.plazas.push({ x: f.x, z: f.z, r: 9.6, y: lowGround(f.x, f.z) + 0.3, fall: 7 });
        }
        this.plazas.push({ x: L.islet.x, z: L.islet.z, r: 6.2, y: L.islet.y, fall: 2.5 });
        // the well beside the Hearthgarden: its paved apron is level with the pavilion's plaza
        if (L.well) this.plazas.push({ x: L.well.x, z: L.well.z, r: WELL_APRON + 0.3, y: L.well.y, fall: 5 });
        // the crashed rocket's crater: a shallow dish a little below the ground round it
        if (L.crash) {
            this.plazas.push({ x: L.crash.x, z: L.crash.z, r: CRASH.crater, y: L.crash.y, fall: 9 });
            for (const g of L.crash.gouge) this.plazas.push({ x: g.x, z: g.z, r: g.r, y: g.y, fall: 8 });
        }

    }

    /**
     * A trail from the nearest garden path to the shore facing the islet, and
     * a stone bridge from there over the strait to the islet's flat top.
     */
    _isletCrossing() {
        const L = this.layout, is = L.islet;
        const toHub = Math.atan2(-is.x, -is.z);
        // the shortest way back to solid ground, roughly toward the hub
        let best = null;
        for (let th = toHub - 1.3; th <= toHub + 1.3; th += 0.04) {
            const dx = Math.sin(th), dz = Math.cos(th);
            for (let d = is.r; d < 80; d += 0.5) {
                if (this.coast(is.x + dx * d, is.z + dz * d) < -8) {
                    if (!best || d < best.d) best = { d, dx, dz };
                    break;
                }
            }
        }
        const { dx, dz } = best;
        const ax = is.x + dx * best.d, az = is.z + dz * best.d;
        // the trail joins the nearest stretch of path with no statues beside it:
        // anywhere on the dock path, a path just past its gate, or a pavilion plaza's edge
        let join = null;
        const consider = (pts, s0, s1) => {
            for (const p of pts) {
                if (p.s < s0 || p.s > s1) continue;
                const d = Math.hypot(p.x - ax, p.z - az);
                if (!join || d < join.d) join = { x: p.x, z: p.z, d, y: p.y };
            }
        };
        consider(L.dock.pts, 0, Infinity);
        for (const sp of L.spokes) {
            consider(sp.pts, GATE_S + 1.5, FIRST_STATUE - 2.5);
            consider(sp.pts, sp.length - PAVILION_PLAZA, sp.length - PAVILION_PLAZA + 0.5);
        }
        const ay = lowGround(ax, az) + 0.25;
        const pts = [];
        const len = join.d;
        for (let s = 0; s <= len + 0.01; s += 0.5) {
            const t = Math.min(1, s / len);
            pts.push({ x: lerp(join.x, ax, t), z: lerp(join.z, az, t), s, y: lerp(join.y, ay, smoothstep(0, 1, t)) });
        }
        L.trail = { pts, length: len };
        this.capsules.push({ ax: join.x, az: join.z, bx: ax, bz: az, ra: 5, rb: 5 });

        // the islet's top is levelled a little above the bridge's landing
        is.y = ay + 0.6;
        is.dir = { x: dx, z: dz }; // from the islet toward the bridge
        const bx = is.x + dx * 4.6, bz = is.z + dz * 4.6;
        L.bridge = { ax, az, ay, bx, bz, by: is.y, half: 1.25, arch: 1.4, length: Math.hypot(bx - ax, bz - az) };
    }

    /** How far out from a pavilion, straight away from the hub, its waterline lies. */
    _shoreFrom(pv, dx, dz) {
        let shore = PAVILION_PLAZA;
        while (this.coast(pv.x + dx * shore, pv.z + dz * shore) < 0 && shore < 150) shore += 0.25;
        return shore;
    }

    /**
     * Where a deck out from a pavilion (the fishing pier, the wharf) leaves the
     * land: six metres short of the waterline, or further back if the granite
     * cliffs (see _height) have already started to drop the ground there, so the
     * trail ends on solid ground at its own height and you step straight from it
     * on to the planks. `half` is half the width of the deck where it starts.
     */
    _deckStart(pv, dx, dz, s0, shore, half) {
        // the cliff is smoothstep(-7, 0.6, sdf + rough * 2.2): below about -6 it has hardly begun
        const cliffAt = (s, lx) => {
            const x = pv.x + dx * s + dz * lx, z = pv.z + dz * s - dx * lx;
            return this.coast(x, z) + ridged2(x * 0.12, z * 0.12, 3) * 2.2;
        };
        // the height field is baked on a grid over a metre apart, so the bank must
        // also hold a little way past where the deck starts
        const solid = (s) => [-half, 0, half].every((lx) => cliffAt(s, lx) < -6.5) && cliffAt(s + 1, 0) < -5.5;
        let s1 = Math.max(s0 + 2, shore - 6);
        while (s1 > s0 + 2 && !solid(s1)) s1 -= 0.25;
        return s1;
    }

    /**
     * The fishing pier, on the far side of the island from the dock: a trail
     * from the pavilion standing most nearly opposite the dock down to the
     * shore, and from there a plank deck straight out over the sea.
     */
    _fishingPier() {
        const L = this.layout;
        // the dock points along +z, so "opposite" is the path nearest angle PI
        const off = (sp) => Math.abs(angleDiff(sp.angle, Math.PI));
        const sp = L.spokes.reduce((a, b) => (off(b) < off(a) ? b : a));
        const pv = sp.pavilion;
        const l = Math.hypot(pv.x, pv.z) || 1;
        const dx = pv.x / l, dz = pv.z / l;
        // out from the plaza to the waterline, and back to where the bank still holds the trail
        const shore = this._shoreFrom(pv, dx, dz);
        const s0 = PAVILION_PLAZA - 0.5;
        const s1 = this._deckStart(pv, dx, dz, s0, shore, 1.2);
        // the trail runs gently downhill and the deck's gangway takes the rest of the drop
        const ay = Math.max(PIER_Y + 0.3, pv.y - (s1 - s0) * 0.2);
        const pts = [];
        const n = Math.ceil((s1 - s0) / 0.5);
        for (let i = 0; i <= n; i++) {
            const s = s0 + ((s1 - s0) * i) / n;
            pts.push({ x: pv.x + dx * s, z: pv.z + dz * s, s: s - s0, y: lerp(pv.y, ay, smoothstep(0, 1, i / n)) });
        }
        const ramp = (ay - PIER_Y) / PIER_SLOPE;
        const length = Math.max(shore - s1 + 12, ramp + 7);
        L.pier = {
            spoke: sp, dx, dz, trail: { pts, length: s1 - s0 },
            ax: pv.x + dx * s1, az: pv.z + dz * s1, ay, y: PIER_Y, slope: PIER_SLOPE, length,
            bx: pv.x + dx * (s1 + length), bz: pv.z + dz * (s1 + length),
        };
    }


    /**
     * The pirate wharf, off the end of the Delvers' Descent: a trail from the
     * pavilion to the cliff and a wide deck on pilings out over deep water, long
     * enough for a galleon to lie along it, bow to the shore.
     */
    _pirateWharf() {
        const L = this.layout;
        const sp = L.spokes.find((s) => s.genre.id === 'dungeon') || L.spokes.filter((s) => s !== L.pier.spoke).reduce((a, b) => (b.length > a.length ? b : a));
        const pv = sp.pavilion;
        const l = Math.hypot(pv.x, pv.z) || 1;
        const dx = pv.x / l, dz = pv.z / l;
        const shore = this._shoreFrom(pv, dx, dz);
        const s0 = PAVILION_PLAZA - 0.5;
        const s1 = this._deckStart(pv, dx, dz, s0, shore, 2.4);
        const W = WHARF;
        const ay = Math.max(W.y + 0.3, pv.y - (s1 - s0) * 0.2);
        const pts = [];
        const n = Math.ceil((s1 - s0) / 0.5);
        for (let i = 0; i <= n; i++) {
            const s = s0 + ((s1 - s0) * i) / n;
            pts.push({ x: pv.x + dx * s, z: pv.z + dz * s, s: s - s0, y: lerp(pv.y, ay, smoothstep(0, 1, i / n)) });
        }
        const ramp = (ay - W.y) / W.slope;
        // the ship lies along the flat part: bow room, its length, a tail, then the head of the wharf
        const shipC = ramp + W.ramp + W.bowRoom + W.shipLen / 2;
        const headStart = ramp + W.ramp + W.bowRoom + W.shipLen + W.tail;
        const length = headStart + W.headLen;
        const ax = pv.x + dx * s1, az = pv.z + dz * s1;
        // wharf coordinates: lz runs out to sea, lx across (+x on the left looking out, the ship's side)
        const toW = (lx, lz) => ({ x: ax + dx * lz + dz * lx, z: az + dz * lz - dx * lx });
        const c = toW(W.berthLx, shipC);
        L.wharf = {
            spoke: sp, dx, dz, trail: { pts, length: s1 - s0 }, ax, az, ay, y: W.y, slope: W.slope, length, ramp, rampEnd: ramp + W.ramp,
            headStart, shipC, toW,
            bx: pv.x + dx * (s1 + length), bz: pv.z + dz * (s1 + length),
            // the ship lies bow to the shore: heading against the wharf's outward direction
            berth: { x: c.x, z: c.z, yaw: Math.atan2(dx, dz) },
        };
    }

    /**
     * The glowing well, a few metres past the edge of the Hearthgarden's plaza
     * (the cozy & sims pavilion): a stone well on a paved apron level with the
     * plaza. It takes the first spot, beside the pavilion and a little way out,
     * that is clear of the paths, the set pieces, the trails and the shore, and
     * holds a patch of land for itself so a ragged coast can't take it.
     */
    _gardenWell() {
        const L = this.layout;
        const sp = L.spokes.find((s) => s.genre.id === 'cozy') || L.spokes[L.spokes.length - 1];
        if (!sp) return;
        const pv = sp.pavilion;
        const out = Math.atan2(pv.x, pv.z);          // away from the hub
        const D = PAVILION_PLAZA + WELL_APRON + 1.6;
        const clear = (x, z, maxCoast) => {
            if (this.coast(x, z) > maxCoast) return false;
            // every path: keep the apron, the well and room to walk round it off them
            for (const s of L.spokes) for (const p of s.pts) if (Math.hypot(x - p.x, z - p.z) < PATH_HALF + WELL_APRON + 1.5) return false;
            for (const p of L.dock.pts) if (Math.hypot(x - p.x, z - p.z) < PATH_HALF + WELL_APRON + 1.5) return false;
            for (const s of L.spokes) {
                if (s !== sp && Math.hypot(x - s.pavilion.x, z - s.pavilion.z) < PAVILION_PLAZA + WELL_APRON + 3) return false;
                if (s.statues.some((st) => Math.hypot(x - st.x, z - st.z) < WELL_APRON + 4)) return false;
                if (s.lamps.some((l) => Math.hypot(x - l.x, z - l.z) < WELL_APRON + 2)) return false;
            }
            for (const f of L.features) if (f.type !== 'grove' && Math.hypot(x - f.x, z - f.z) < 22) return false;
            for (const t of [L.trail, L.pier.trail, L.wharf.trail]) for (const p of t.pts) if (Math.hypot(x - p.x, z - p.z) < WELL_APRON + 3) return false;
            return !(L.islet && Math.hypot(x - L.islet.x, z - L.islet.z) < 20);
        };
        // The pavilion stands at the end of its path, often close to the shore, so how far
        // inland the well can be varies with every layout (adding a game reshuffles the
        // coast). Prefer a spot well inland, and fall back to ones nearer the water: the
        // well brings a patch of land of its own, so it only needs the apron to end up on
        // dry land (checked below), not to start there.
        const patch = { ax: 0, az: 0, bx: 0, bz: 0, ra: WELL_APRON + 8, rb: 0 };
        const held = (x, z) => {
            patch.ax = patch.bx = x;
            patch.az = patch.bz = z;
            this.capsules.push(patch);
            let ok = this.coast(x, z) < -6;
            for (let k = 0; ok && k < 12; k++) {
                const t = (k / 12) * Math.PI * 2;
                ok = this.coast(x + Math.sin(t) * (WELL_APRON + 1.4), z + Math.cos(t) * (WELL_APRON + 1.4)) < -2;
            }
            if (!ok) this.capsules.pop();
            return ok;
        };
        // beside the pavilion first (either hand), then round the back, then further out
        let best = null;
        for (const maxCoast of [-9, -5, -1, 3]) {
            for (const dist of [D, D + 2, D + 4, D + 7]) {
                for (const off of [75, -75, 105, -105, 50, -50, 135, -135, 25, -25, 0, 160, -160]) {
                    const a = out + (off * Math.PI) / 180;
                    const x = pv.x + Math.sin(a) * dist, z = pv.z + Math.cos(a) * dist;
                    if (clear(x, z, maxCoast) && held(x, z)) {
                        best = { x, z, a };
                        break;
                    }
                }
                if (best) break;
            }
            if (best) break;
        }
        if (!best) return;
        // the doorway side faces the pavilion's plaza, where people come from
        L.well = { x: best.x, z: best.z, y: pv.y, r: WELL_APRON, face: Math.atan2(pv.x - best.x, pv.z - best.z), spoke: sp };
    }

    /**
     * The crashed rocket: it came down past one of the groves between the paths,
     * nose first, and lies on its belly in a crater it dug for itself, on a
     * headland of its own (the island has no open ground left that is big enough,
     * so the site holds a patch of land the way the well and the wharf do). The
     * site is the spot nearest the hub, out along the middle of a gap between two
     * paths (a grove's first), where the hull, the crater and room to walk round
     * it keep clear of the paths, statues, set pieces, trails, pier, wharf and
     * islet; the hull is turned to fit.
     */
    _crashSite() {
        const L = this.layout;
        const pathPts = [...L.spokes.flatMap((s) => s.pts), ...L.dock.pts];
        const trailPts = [L.trail, L.pier.trail, L.wharf.trail].flatMap((t) => t.pts);
        const seg = (x, z, ax, az, bx, bz) => segDist(x, z, ax, az, bx, bz).d;
        const ok = (x, z) => {
            if (Math.hypot(x, z) < PLAZA_R + 10) return false;
            for (const p of pathPts) if (Math.hypot(x - p.x, z - p.z) < PATH_HALF + 4) return false;
            for (const p of trailPts) if (Math.hypot(x - p.x, z - p.z) < 6) return false;
            for (const s of L.spokes) {
                if (Math.hypot(x - s.pavilion.x, z - s.pavilion.z) < PAVILION_PLAZA + 4) return false;
                if (s.statues.some((st) => Math.hypot(x - st.x, z - st.z) < 4.5)) return false;
                if (s.lamps.some((l) => Math.hypot(x - l.x, z - l.z) < 3.5)) return false;
            }
            for (const f of L.features) if (f.type !== 'grove' && Math.hypot(x - f.x, z - f.z) < 16) return false;
            if (L.well && Math.hypot(x - L.well.x, z - L.well.z) < 12) return false;
            if (seg(x, z, L.pier.ax, L.pier.az, L.pier.bx, L.pier.bz) < 24) return false;
            if (seg(x, z, L.wharf.ax, L.wharf.az, L.wharf.bx, L.wharf.bz) < 30) return false;
            if (seg(x, z, L.bridge.ax, L.bridge.az, L.bridge.bx, L.bridge.bz) < 16) return false;
            return !(L.islet && Math.hypot(x - L.islet.x, z - L.islet.z) < 32);
        };
        // the hull's footprint, the hatch's ramp on its +z side and the crater's rim
        const fits = (x, z, yaw) => {
            const c = Math.cos(yaw), s = Math.sin(yaw);
            for (let lx = -CRASH.len / 2 - 3; lx <= CRASH.len / 2 + 3; lx += 2.5) {
                for (const lz of [-4, 0, 4.5, 7.5]) if (!ok(x + lx * c + lz * s, z - lx * s + lz * c)) return false;
            }
            return true;
        };
        const gaps = L.features.filter((f) => !f.nearDock).sort((a, b) => (b.type === 'grove') - (a.type === 'grove'));
        let best = null;
        for (const g of gaps) {
            for (let r = g.r; r < L.hubR + 60 && !best; r += 2) {
                for (const da of [0, 0.03, -0.03, 0.06, -0.06]) {
                    const a = g.angle + da;
                    const x = Math.sin(a) * r, z = Math.cos(a) * r;
                    // lie across the gap first (along the ring round the hub), then any way
                    for (const off of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.2, -1.2, Math.PI / 2]) {
                        const yaw = a + Math.PI / 2 + off;
                        if (fits(x, z, yaw)) {
                            best = { x, z, yaw };
                            break;
                        }
                    }
                    if (best) break;
                }
            }
            if (best) break;
        }
        if (!best) return;
        // turn her round if that leaves the gouge behind her on land rather than heading out to sea
        const tail = (yaw) => this.coast(best.x - (CRASH.len / 2 + 18) * Math.cos(yaw), best.z + (CRASH.len / 2 + 18) * Math.sin(yaw));
        if (fits(best.x, best.z, best.yaw + Math.PI) && tail(best.yaw + Math.PI) < tail(best.yaw)) best.yaw += Math.PI;
        // the crater floor sits a little below the lie of the land round it, and the gouge
        // behind the ship climbs gently out of it
        const c = Math.cos(best.yaw), sn = Math.sin(best.yaw);
        let sum = 0, n = 0;
        for (let lx = -CRASH.len / 2 - 4; lx <= CRASH.len / 2 + 4; lx += 3) for (const lz of [-6, 0, 6]) {
            sum += landAt(best.x + lx * c + lz * sn, best.z - lx * sn + lz * c);
            n++;
        }
        const y = sum / n - 0.5;
        L.crash = { x: best.x, z: best.z, yaw: best.yaw, y };
        L.crash.gouge = [[-CRASH.len / 2 - 6, 6.5, 0.35]].map(([lx, r, dy]) => ({ x: best.x + lx * c, z: best.z - lx * sn, r, y: y + dy }));
        // land under it all, out to a little past the crater's rim
        this.capsules.push({ ax: best.x, az: best.z, bx: best.x, bz: best.z, ra: CRASH.len / 2 + 13, rb: 0 });
    }

    /** Coastline distance without the islet (negative on land). */
    coast(x, z) {
        const L = this.layout;
        let d = Math.hypot(x, z) - L.hubR;
        for (const c of this.capsules) {
            const { d: sd, t } = segDist(x, z, c.ax, c.az, c.bx, c.bz);
            d = smin(d, sd - lerp(c.ra, c.rb || c.ra, t), 9);
        }
        // keep the dock cove clean, wobble everything else
        const dockQuiet = 1 - smoothstep(14, 4, Math.abs(x)) * smoothstep(L.hubR - 20, L.hubR - 8, z);
        d += (fbm2(x * 0.028, z * 0.028, 3) * 6 + fbm2(x * 0.09, z * 0.09, 2) * 1.6) * (0.35 + 0.65 * dockQuiet);
        return d;
    }

    /** Coastline distance of the islet alone. */
    isletSdf(x, z) {
        const is = this.layout.islet;
        return Math.hypot(x - is.x, z - is.z) - is.r + fbm2(x * 0.2, z * 0.2) * 1.2;
    }

    sdfAt(x, z) {
        const L = this.layout;
        let d = this.coast(x, z);
        if (L.islet) d = Math.min(d, this.isletSdf(x, z));
        return d;
    }

    /** Nearest path flatten target: { w, y, d }. */
    flatten(x, z) {
        let best = { w: 0, y: 0, d: 99 };
        for (const s of this.paths.near(x, z)) {
            const { d, t } = segDist(x, z, s.ax, s.az, s.bx, s.bz);
            if (d < best.d) best = { d, y: lerp(s.ay, s.by, t), w: 0 };
        }
        best.w = 1 - smoothstep(PATH_HALF + 5.4, PATH_HALF + 12, best.d);
        for (const p of this.plazas) {
            const d = Math.hypot(x - p.x, z - p.z) - p.r;
            const w = 1 - smoothstep(0, p.fall, d);
            if (w > best.w || (w > 0.999 && d < best.d)) best = { w, y: p.y, d: Math.min(best.d, Math.max(d, 0)) };
        }
        return best;
    }

    _height(x, z, sdf) {
        let land = landAt(x, z);
        for (const m of this.mounds) land += m.h * Math.exp(-((x - m.x) ** 2 + (z - m.z) ** 2) / (m.r * m.r));
        const f = this.flatten(x, z);
        land = lerp(land, f.y, f.w);
        // granite cliffs drop into the sea; the islet's are sheer, to leave
        // its top flat enough for the tower
        const rough = ridged2(x * 0.12, z * 0.12, 3);
        const islet = this.layout.islet && this.isletSdf(x, z) <= sdf;
        const cliff = islet ? smoothstep(-2.8, 0.6, sdf + rough * 0.8) : smoothstep(-7, 0.6, sdf + rough * 2.2);
        const sea = -1.6 - Math.max(sdf, 0) * 0.32 - rough * 1.2;
        let h = lerp(land, Math.max(sea, -15), Math.pow(cliff, 1.4));
        if (sdf > -1 && sdf < 6) h -= rough * 0.6; // tumbled rock at the waterline
        return { h, flat: f.w, pathD: f.d, rough };
    }

    _bake() {
        const { n, half, step } = this;
        this.height = new Float32Array(n * n);
        this.sdf = new Float32Array(n * n);
        this.flat = new Float32Array(n * n);
        this.pathD = new Float32Array(n * n);
        this.rough = new Float32Array(n * n);
        for (let j = 0; j < n; j++) {
            const z = -half + j * step;
            for (let i = 0; i < n; i++) {
                const x = -half + i * step;
                const k = j * n + i;
                const d = this.sdfAt(x, z);
                this.sdf[k] = d;
                if (d > 30) {
                    this.height[k] = -15;
                    this.pathD[k] = 99;
                    continue;
                }
                const r = this._height(x, z, d);
                this.height[k] = r.h;
                this.flat[k] = r.flat;
                this.pathD[k] = r.pathD;
                this.rough[k] = r.rough;
            }
        }
        // edge of the grid goes deep so it hides under the water
        for (let i = 0; i < n; i++) {
            for (const k of [i, (n - 1) * n + i, i * n, i * n + n - 1]) this.height[k] = -15;
        }
    }

    _sample(arr, x, z) {
        const { n, half, step } = this;
        const fx = clamp((x + half) / step, 0, n - 1.001), fz = clamp((z + half) / step, 0, n - 1.001);
        const i = Math.floor(fx), j = Math.floor(fz);
        const u = fx - i, v = fz - j;
        const k = j * n + i;
        return lerp(lerp(arr[k], arr[k + 1], u), lerp(arr[k + n], arr[k + n + 1], u), v);
    }

    heightAt(x, z) {
        return this._sample(this.height, x, z);
    }
    shoreAt(x, z) {
        return this._sample(this.sdf, x, z);
    }
    flatAt(x, z) {
        return this._sample(this.flat, x, z);
    }
    pathDistAt(x, z) {
        return this._sample(this.pathD, x, z);
    }
    normalAt(x, z, out = new THREE.Vector3()) {
        const e = 0.6;
        return out.set(this.heightAt(x - e, z) - this.heightAt(x + e, z), 2 * e, this.heightAt(x, z - e) - this.heightAt(x, z + e)).normalize();
    }

    /** Terrain mesh with baked colours and a triplanar detail shader. */
    buildMesh() {
        const { n, half, step } = this;
        const pos = new Float32Array(n * n * 3);
        const col = new Float32Array(n * n * 3);
        const rock = new Float32Array(n * n);
        const c = new THREE.Color();
        const grassA = new THREE.Color('#4c7a2a'), grassB = new THREE.Color('#87a03c'), grassC = new THREE.Color('#2f5e2a');
        const soil = new THREE.Color('#7a6446'), sand = new THREE.Color('#cdb88d'), wetSand = new THREE.Color('#8f7e5d');
        const granite = new THREE.Color('#8a7f78'), graniteDark = new THREE.Color('#5d5652'), seabed = new THREE.Color('#5d6b55');
        const nrm = new THREE.Vector3();
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                const k = j * n + i;
                const x = -half + i * step, z = -half + j * step, h = this.height[k];
                pos.set([x, h, z], k * 3);
                this.normalAt(x, z, nrm);
                const slope = 1 - nrm.y;
                const g1 = fbm2(x * 0.05, z * 0.05, 3) * 0.5 + 0.5, g2 = fbm2(x * 0.18 + 5, z * 0.18, 2) * 0.5 + 0.5;
                c.copy(grassA).lerp(grassB, g1 * 0.8).lerp(grassC, g2 * 0.35);
                // worn soil along path edges
                const pd = this.pathD[k];
                c.lerp(soil, (1 - smoothstep(PATH_HALF, PATH_HALF + 1.2, pd)) * 0.55);
                const sd = this.sdf[k];
                const beach = smoothstep(-4, -0.5, sd) * (1 - smoothstep(1.4, 2.6, h));
                c.lerp(sand, beach);
                if (h < 0.4) c.lerp(wetSand, smoothstep(0.4, -0.4, h));
                if (h < -1.5) c.lerp(seabed, smoothstep(-1.5, -5, h));
                let r = smoothstep(0.32, 0.6, slope) + smoothstep(-6, -1, sd) * smoothstep(0.15, 0.35, slope) + this.rough[k] * 0.3 * smoothstep(-10, -2, sd);
                r = clamp(r * (1 - this.flat[k] * 0.9), 0, 1);
                c.lerp(granite, r).lerp(graniteDark, r * g2 * 0.5);
                rock[k] = r;
                col.set([c.r, c.g, c.b], k * 3);
            }
        }
        const idx = new Uint32Array((n - 1) * (n - 1) * 6);
        let t = 0;
        for (let j = 0; j < n - 1; j++) {
            for (let i = 0; i < n - 1; i++) {
                const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
                // skip quads deep under the sea
                if (this.height[a] < -14 && this.height[d] < -14 && this.height[b] < -14 && this.height[cc] < -14) continue;
                idx.set([a, cc, b, b, cc, d], t);
                t += 6;
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
        geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
        geo.computeVertexNormals();
        geo.computeBoundingSphere();

        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
        const detail = terrainDetail();
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uDetail = { value: detail };
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nattribute float aRock;\nvarying float vRock;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;\nvWPos = (modelMatrix * vec4(position,1.0)).xyz;\nvWNrm = normal;');
            sh.fragmentShader = sh.fragmentShader
                .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying float vRock;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
                .replace(
                    '#include <color_fragment>',
                    `#include <color_fragment>
                    vec3 bw = pow(abs(normalize(vWNrm)), vec3(4.0));
                    bw /= (bw.x + bw.y + bw.z);
                    vec2 g0 = texture2D(uDetail, vWPos.xz * 0.21).rg;
                    vec2 g1 = texture2D(uDetail, vWPos.xz * 0.037).rg;
                    float rockT = texture2D(uDetail, vWPos.zy * 0.12).g * bw.x + texture2D(uDetail, vWPos.xz * 0.12).g * bw.y + texture2D(uDetail, vWPos.xy * 0.12).g * bw.z;
                    float grassT = g0.r * mix(0.85, 1.15, g1.r);
                    float d = mix(grassT, rockT * 1.05, vRock);
                    diffuseColor.rgb *= d * 1.05;
                    // strata in the cliffs
                    diffuseColor.rgb *= 1.0 - vRock * 0.18 * smoothstep(0.6, 1.0, sin(vWPos.y * 3.1 + rockT * 4.0));`
                );
        };
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.name = 'terrain';
        return mesh;
    }

    /**
     * Data texture for the water shader: R = water depth (0..12 m),
     * G = shore proximity, B = path-free land mask (unused by water, handy for debug).
     */
    buildWaterData() {
        const { n } = this;
        const data = new Uint8Array(n * n * 4);
        for (let k = 0; k < n * n; k++) {
            const depth = clamp(-this.height[k] / 12, 0, 1);
            const shore = 1 - smoothstep(-2, 26, this.sdf[k]);
            data[k * 4] = depth * 255;
            data[k * 4 + 1] = shore * 255;
            data[k * 4 + 2] = 0;
            data[k * 4 + 3] = 255;
        }
        const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return tex;
    }
}

/** Path height at arc length s (path points carry y once the island is built). */
export function samplePathY(pts, s) {
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (pts[mid].s <= s) lo = mid; else hi = mid;
    }
    const a = pts[lo], b = pts[hi];
    const t = b.s > a.s ? clamp((s - a.s) / (b.s - a.s), 0, 1) : 0;
    return lerp(a.y, b.y, t);
}
