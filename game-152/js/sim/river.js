// The river: a chain of segments made ahead of the boat as it goes. Pure.
//
// A segment runs from y0 for len metres; its centre line eases from cx0 to cx1 with a wiggle that is zero at both
// ends, and its half-width eases from hw0 to hw1. An 'island' segment has a sandbar in the middle (isl = its peak
// half-width) and is widened so both channels stay open. An 'arena' segment is straight and wide and has no end
// (len = Infinity) until the boss in it is beaten.
//
// Everything is plain data inside G.river, so a save is a JSON round trip. The generator draws from G.river.rng
// (its own saved state), so the shape of the river never shifts with how many shots were fired.

import { SECTOR } from '../config.js';
import { makeRng } from '../rng.js';

const smooth = (t) => t * t * (3 - 2 * t);
const MIN_CHANNEL = 5.2;            // a sandbar's peak leaves at least this much each side
const MIN_GAP = 7.5;                // and never less than this, anywhere along it

export function newRiver(seed, sector, data) {
    return {
        seed, sector,
        rngState: makeRng(seed).state(),
        segs: [],
        endY: -60,
        cx: 0, hw: 15,
        width: data.width, wind: data.wind,
        miniY: Math.round(SECTOR.length * SECTOR.miniAt),
        bossY: SECTOR.length,
        miniPlaced: false, bossPlaced: false, miniArena: false, bossArena: false,
        nextId: 1,
    };
}

/** Find the segment holding y. Segments are few (≤ ~40) and the boat only moves forward: linear scan from the end. */
export function segAt(R, y) {
    const s = R.segs;
    for (let i = s.length - 1; i >= 0; i--) if (y >= s[i].y0) return s[i];
    return s[0];
}

/** Centre, half-width and sandbar half-width at y. */
export function riverAt(R, y) {
    const s = segAt(R, y);
    if (!s) return { cx: 0, hw: 15, isl: 0 };
    if (s.len === Infinity) return { cx: s.cx0, hw: s.hw0, isl: 0 };
    const t = Math.max(0, Math.min(1, (y - s.y0) / s.len));
    const e = smooth(t);
    const cx = s.cx0 + (s.cx1 - s.cx0) * e + s.amp * Math.sin(Math.PI * s.k * t);
    const hw = s.hw0 + (s.hw1 - s.hw0) * e;
    let isl = 0;
    if (s.isl > 0) {
        // the sandbar rises over the middle 70% of the segment
        const u = (t - 0.15) / 0.7;
        if (u > 0 && u < 1) isl = s.isl * Math.sin(Math.PI * u) ** 0.7;
        // never squeeze a channel below MIN_GAP, even where the river is still widening from a chokepoint
        isl = Math.min(isl, hw - MIN_GAP);
        if (isl < 0.6) isl = 0;
    }
    return { cx, hw, isl };
}

/** Where on the water a point is: 'water', 'bank' or 'bar' (the sandbar), and how far it is inside the water. */
export function surface(R, x, y) {
    const r = riverAt(R, y);
    const d = Math.abs(x - r.cx);
    if (d > r.hw) return { kind: 'bank', r, depth: r.hw - d };
    if (r.isl > 0 && d < r.isl) return { kind: 'bar', r, depth: d - r.isl };
    return { kind: 'water', r, depth: Math.min(r.hw - d, r.isl > 0 ? d - r.isl : Infinity) };
}

/** Make segments until the river reaches `toY`. Calls onSeg(seg, rng) for each new one, to place its enemies. */
export function extendRiver(R, toY, onSeg) {
    const rng = makeRng(0);
    rng.setState(R.rngState);
    while (R.endY < toY) {
        const last = R.segs[R.segs.length - 1];
        if (last && last.len === Infinity) break;      // an arena holds the river until its boss falls
        const seg = makeSeg(R, rng);
        R.segs.push(seg);
        R.endY = seg.y0 + seg.len;
        R.cx = seg.cx1; R.hw = seg.hw1;
        onSeg?.(seg, rng);
    }
    R.rngState = rng.state();
    // keep the list short: segments far behind are never looked at again
    while (R.segs.length > 3 && R.segs[1].y0 + R.segs[1].len < toY - 400) R.segs.shift();
}

function makeSeg(R, rng) {
    const y0 = R.endY;
    const [wMin, wMax] = R.width;
    const id = R.nextId++;
    const base = { id, y0, cx0: R.cx, hw0: R.hw, amp: 0, k: 1, isl: 0 };

    // the first stretch is calm and straight
    if (y0 < 60) return { ...base, type: 'straight', len: 140, cx1: 0, hw1: 15 };

    // boss arenas: straight, wide, with an open end
    if (!R.miniPlaced && y0 >= R.miniY - 40) {
        R.miniPlaced = true;
        return { ...base, type: 'lead', len: 70, cx1: R.cx * 0.3, hw1: 18 };
    }
    if (R.miniPlaced && !R.miniArena) {
        R.miniArena = true;
        return { ...base, type: 'arena', boss: 'mini', len: Infinity, cx1: R.cx, hw1: R.hw, hw0: R.hw };
    }
    if (!R.bossPlaced && y0 >= R.bossY - 40) {
        R.bossPlaced = true;
        return { ...base, type: 'lead', len: 80, cx1: R.cx * 0.3, hw1: 19 };
    }
    if (R.bossPlaced && !R.bossArena) {
        R.bossArena = true;
        return { ...base, type: 'arena', boss: 'boss', len: Infinity, cx1: R.cx, hw1: R.hw, hw0: R.hw };
    }
    // after an arena, ease back to a normal width
    const prev = R.segs[R.segs.length - 1];
    if (prev?.type === 'arena') return { ...base, type: 'straight', len: 60, cx1: R.cx, hw1: (wMin + wMax) / 2 };

    const roll = rng();
    const drift = (to) => Math.max(-38, Math.min(38, to));
    if (roll < 0.34) {
        // a winding stretch
        const len = rng.range(110, 170);
        return { ...base, type: 'wind', len, cx1: drift(R.cx + rng.range(-16, 16) * R.wind), hw1: rng.range(wMin, wMax),
            amp: rng.range(4, 9) * R.wind * (rng() < 0.5 ? -1 : 1), k: rng() < 0.5 ? 1 : 2 };
    }
    if (roll < 0.5) {
        // a chokepoint
        return { ...base, type: 'narrow', len: rng.range(70, 100), cx1: drift(R.cx + rng.range(-6, 6)), hw1: rng.range(7.5, 9) };
    }
    if (roll < 0.68) {
        // a sandbar island splits the river; widen first so both channels stay passable
        const hw = rng.range(21, 25);
        const isl = Math.min(rng.range(5, 8), hw - MIN_CHANNEL * 2);
        return { ...base, type: 'island', len: rng.range(120, 160), cx1: drift(R.cx + rng.range(-5, 5)), hw1: hw, isl };
    }
    if (roll < 0.8) {
        // a road bridge crosses the river; tanks drive over it
        return { ...base, type: 'bridge', len: 90, cx1: R.cx, hw1: rng.range(wMin, wMax), bridge: true };
    }
    return { ...base, type: 'straight', len: rng.range(80, 130), cx1: drift(R.cx + rng.range(-10, 10)), hw1: rng.range(wMin, wMax) };
}

/** Narrowest open channel anywhere in a segment (for the proofs in simtest): min over samples of the wider gap. */
export function narrowest(R, seg) {
    let min = Infinity;
    const len = seg.len === Infinity ? 200 : seg.len;
    for (let y = seg.y0; y <= seg.y0 + len; y += SECTOR.sample) {
        const r = riverAt(R, y);
        const gap = r.isl > 0 ? r.hw - r.isl : r.hw * 2;
        if (gap < min) min = gap;
    }
    return min;
}
