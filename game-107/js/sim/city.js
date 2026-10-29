// The city generator: pure and seeded. One seed and a level number rebuild the same streets,
// the same buildings and the same cars. Returns { layout, buildings, things, nextId }.

import { LEVELS, BTYPES, THINGS } from './data.js';
import { makeRng } from '../rng.js';

const BUILD_HP = 2.8;                   // global strength of every building; the bot sets the pace
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const levelSeed = (seed, li) => ((seed >>> 0) ^ Math.imul(li + 1, 0x9E3779B1)) >>> 0;

export function layoutDims(li) {
    const rw = 4 + 0.6 * li;
    return { rw, bw: 13 + 1.2 * li, bd: 12 + li, rwR: rw + 3 };
}

function pickWeighted(rng, list) {
    let total = 0;
    for (const [, w] of list) total += w;
    let r = rng() * total;
    for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
    return list[list.length - 1][0];
}

export function genLevel(seed, li) {
    const L = LEVELS[li];
    const rng = makeRng(levelSeed(seed, li));
    const { rw, bw, bd, rwR } = layoutDims(li);
    const nc = L.cols, nr = L.rows;
    const W = nc * bw + (nc + 1) * rw;

    // ---- streets, top (north) to bottom (south)
    const riverRow = L.river ? Math.floor(nr / 2) : -1;
    const hroads = [], rows = [];
    let y = 0;
    for (let j = 0; j <= nr; j++) {
        const isRiver = j === riverRow;
        const h = isRiver ? rwR : rw;
        hroads.push({ y, h, river: isRiver, cy: y + h / 2 });
        y += h;
        if (j < nr) { rows.push({ y, h: bd }); y += bd; }
    }
    const plaza = { x: 0, y, w: W, h: 14 + 2 * li };
    y += plaza.h;
    const H = y;
    const vroads = [];
    for (let i = 0; i <= nc; i++) vroads.push({ x: i * (bw + rw), w: rw, cx: i * (bw + rw) + rw / 2 });
    const river = riverRow >= 0 ? { y: hroads[riverRow].y, h: rwR } : null;
    const blocks = [];
    for (let j = 0; j < nr; j++) {
        for (let i = 0; i < nc; i++) blocks.push({ x: rw + i * (bw + rw), y: rows[j].y, w: bw, h: bd, ci: i, rj: j });
    }
    const layout = {
        W, H, rw, bw, bd, rwR, hroads, vroads, blocks, plaza, river,
        roadEnd: plaza.y, start: { x: W / 2, y: plaza.y + plaza.h * 0.62 },
    };

    let nid = 1;
    const buildings = [];
    const things = [];

    // ---- buildings
    const addBuilding = (t, cx, cy, lw, ld, extra = {}) => {
        const T = BTYPES[t];
        let shape = 'box', w, d, rad = 0;
        if (T.circle) { shape = 'circle'; rad = T.r; w = d = rad * 2; }
        else {
            w = clamp(extra.w ?? rng.range(T.w[0], T.w[1]), 0.4, lw - 0.3);
            d = clamp(extra.d ?? rng.range(T.d[0], T.d[1]), 0.4, ld - 0.3);
        }
        const x = cx + (T.circle || extra.exact ? 0 : (lw - w) * 0.5 * rng.range(-0.6, 0.6));
        const yy = cy + (T.circle || extra.exact ? 0 : (ld - d) * 0.5 * rng.range(-0.6, 0.6));
        const fl = extra.fl ?? (rng.int(T.fl[0], T.fl[1]) + (T.fl[0] >= 4 ? Math.floor(li / 2) : 0));
        const fhp = Math.round(T.fh * L.hpMul * BUILD_HP);
        const b = {
            id: nid++, t, shape, x, y: yy, w, d, r: rad, fl0: fl, fl, fhp, hp: fl * fhp, hpMax: fl * fhp,
            sc: T.sc, st: rng.int(0, 3), col: rng.int(0, 7), roof: rng.pick(T.roofs),
            lean: !T.circle && !T.low && rng() < 0.3 ? +rng.range(0.4, 1).toFixed(2) : 0,
            dead: false,
        };
        buildings.push(b);
        return b;
    };

    const zoneOf = (bk) => 1 - Math.max(Math.abs(bk.ci - (nc - 1) / 2) / (nc / 2), Math.abs(bk.rj - (nr - 1) / 2) / (nr / 2));
    const pickType = (zone, lw, ld) => {
        const cands = [];
        for (const [t, wt] of Object.entries(L.mix)) {
            const T = BTYPES[t];
            if (lw < T.w[0] + 0.3 || ld < T.d[0] + 0.3) continue;
            const tall = T.fl[0] >= 7;
            cands.push([t, wt * (tall ? 0.3 + zone * 1.4 : 1.3 - zone * 0.7)]);
        }
        return cands.length ? pickWeighted(rng, cands) : 'house';
    };

    let ferrisDone = false;
    const plazaBlock = (bk) => {
        const cx = bk.x + bk.w / 2, cy = bk.y + bk.h / 2;
        if (!ferrisDone && bk.w > 11) { ferrisDone = true; addBuilding('ferris', cx, cy, bk.w, bk.h); }
        else {
            addBuilding('gas', cx - 3, cy - 1, 4, 4);
            addBuilding('statue', cx + 2.5, cy + 1.5, 3, 3);
        }
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + 0.4;
            addThing(rng.pick(['tree', 'tree', 'pine']), cx + Math.cos(a) * (bk.w * 0.38), cy + Math.sin(a) * (bk.h * 0.38));
        }
    };

    function addThing(k, x, yv, mv = null) {
        const T = THINGS[k];
        things.push({
            id: nid++, k, x, y: yv, a: rng.range(0, Math.PI * 2), size: T.size * rng.range(0.92, 1.08),
            c: rng.int(0, 7), mv,
        });
    }

    for (const bk of blocks) {
        const zone = zoneOf(bk);
        const ix = bk.x + 1, iy = bk.y + 1, iw = bk.w - 2, id = bk.h - 2;
        const roll = rng();
        if (roll < 0.1) {                                   // a park
            const cx = ix + iw / 2, cy = iy + id / 2;
            const n = rng.int(7, 11);
            for (let k = 0; k < n; k++) addThing(rng.pick(['tree', 'tree', 'pine', 'oak']), ix + 0.8 + rng() * (iw - 1.6), iy + 0.8 + rng() * (id - 1.6));
            if (rng() < 0.6) addBuilding('statue', cx, cy, 3, 3);
        } else if (roll < 0.2) plazaBlock(bk);
        else if (roll < 0.5) {                              // one big building
            const t = pickType(zone, iw, id);
            addBuilding(t, ix + iw / 2, iy + id / 2, iw, id);
        } else if (roll < 0.76) {                           // two side by side
            const long = iw >= id;
            for (let s = 0; s < 2; s++) {
                const lw = long ? (iw - 0.8) / 2 : iw, ld = long ? id : (id - 0.8) / 2;
                const cx = long ? ix + lw / 2 + s * (lw + 0.8) : ix + iw / 2;
                const cy = long ? iy + id / 2 : iy + ld / 2 + s * (ld + 0.8);
                addBuilding(pickType(zone, lw, ld), cx, cy, lw, ld);
            }
        } else {                                            // four small ones
            const lw = (iw - 0.8) / 2, ld = (id - 0.8) / 2;
            for (let sx = 0; sx < 2; sx++) {
                for (let sy = 0; sy < 2; sy++) {
                    addBuilding(pickType(zone * 0.6, lw, ld), ix + lw / 2 + sx * (lw + 0.8), iy + ld / 2 + sy * (ld + 0.8), lw, ld);
                }
            }
        }
        // street trees and lamps on the sidewalk strip
        for (let k = 0; k < 4; k++) {
            if (rng() < 0.55) addThing(rng.pick(['tree', 'tree', 'pine']), bk.x + 0.5 + rng() * (bk.w - 1), rng() < 0.5 ? bk.y + 0.5 : bk.y + bk.h - 0.5);
        }
        for (let k = 0; k < 3; k++) {
            if (rng() < 0.6) addThing('lamp', rng() < 0.5 ? bk.x + 0.25 : bk.x + bk.w - 0.25, bk.y + 1 + rng() * (bk.h - 2));
        }
    }

    // ---- bridges over the river: low decks you roll over, and pylons you bounce off
    if (river) {
        for (const v of vroads) {
            for (let s = 0; s < 3; s++) {
                const b = addBuilding('deck', v.cx, river.y + (s + 0.5) * river.h / 3, rw, river.h / 3, { w: rw - 0.9, d: river.h / 3 - 0.05, fl: 1, exact: true });
                b.col = 7; b.roof = 'none'; b.lean = 0;
            }
            for (const side of [-1, 1]) {
                const b = addBuilding('pylon', v.cx + side * (rw / 2 - 0.45), river.y + river.h / 2, 1, 1, { exact: true });
                b.col = 7; b.bridge = v.cx;
            }
        }
    }

    // ---- traffic and people. Each follows a lane along a street.
    const lane = (ax, fixed, lo, hi, spd, dir, wrap) => ({ ax, fixed, lo, hi, spd, dir, wrap, t: rng.range(0.5, 4) });
    const addMover = (k, mv, p) => {
        const th = {
            id: nid++, k, x: mv.ax === 'x' ? p : mv.fixed, y: mv.ax === 'x' ? mv.fixed : p, a: 0,
            size: THINGS[k].size, c: rng.int(0, 7), mv,
        };
        th.a = mv.ax === 'x' ? (mv.dir > 0 ? 0 : Math.PI) : (mv.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        things.push(th);
    };
    const carKind = () => { const r = rng(); return r < 0.62 ? 'car' : r < 0.8 ? 'bus' : r < 0.9 ? 'pizza' : 'cart'; };
    for (const hr of hroads) {
        if (hr.river) continue;
        for (const s of [-1, 1]) {
            const n = Math.round(W / 26);
            for (let k = 0; k < n; k++) {
                if (rng() < 0.2) continue;
                addMover(carKind(), lane('x', hr.cy + s * rw * 0.22, -2, W + 2, rng.range(2.4, 4.4), -s, true), rng.range(0, W));
            }
            for (let k = 0; k < 2; k++) {
                addMover('person', lane('x', hr.cy + s * (rw / 2 - 0.45), 1, W - 1, 0.6, rng() < 0.5 ? 1 : -1, false), rng.range(1, W - 1));
            }
        }
    }
    for (const vr of vroads) {
        for (const s of [-1, 1]) {
            const n = Math.round(layout.roadEnd / 28);
            for (let k = 0; k < n; k++) {
                if (rng() < 0.2) continue;
                addMover(carKind(), lane('y', vr.cx + s * rw * 0.22, -2, layout.roadEnd + 1, rng.range(2.4, 4.4), s, true), rng.range(0, layout.roadEnd));
            }
            for (let k = 0; k < 2; k++) {
                addMover('person', lane('y', vr.cx + s * (rw / 2 - 0.45), 1, layout.roadEnd - 1, 0.6, rng() < 0.5 ? 1 : -1, false), rng.range(1, layout.roadEnd - 1));
            }
        }
    }
    // the plaza where you start: a car park, a crowd and a few trees
    for (let k = 0; k < 14; k++) {
        addMover('person', lane('x', plaza.y + 1 + rng() * (plaza.h - 2), 1.5, W - 1.5, 0.6, rng() < 0.5 ? 1 : -1, false), rng.range(2, W - 2));
    }
    for (let k = 0; k < 6; k++) {
        addThing(rng.pick(['car', 'car', 'cart', 'pizza']), 4 + k * ((W - 8) / 5), plaza.y + plaza.h * 0.2);
    }
    for (let k = 0; k < 9; k++) addThing(rng.pick(['tree', 'pine', 'tree']), 2 + rng() * (W - 4), plaza.y + 1 + rng() * (plaza.h - 2));

    return { layout, buildings, things, nextId: nid };
}
