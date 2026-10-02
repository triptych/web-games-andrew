// The road: one endless centreline, described by arc length s.
//
// Heading is an analytic sum of slow sines, so the road wanders but can never
// loop back on itself (|heading| stays well under 90 degrees). Position is the
// integral of heading, stored in sample arrays every SAMPLE metres. Elevation
// comes from the district list: the skyway sits SKYWAY_H up, everything else
// at ground level, with a RAMP-long climb at each change.
//
// Frame convention: tangent t = (sin h, cos h) in (x, z); right r = (-cos h, sin h).
// A point at lateral offset u is centre + r * u.

import {
    SAMPLE, SKYWAY_H, RAMP, DISTRICTS, DISTRICT_ORDER, STOP_GAP_MIN, STOP_GAP_MAX, STOP_LEN, CHUNK,
} from './config.js';
import { makeRand, smooth, lerp } from './rng.js';
import { nameStop } from './stops.js';

export class Road {
    constructor(seed) {
        this.seed = seed;
        const r = makeRand(seed ^ 0x51a7);
        this.p = [r.range(0, 6.28), r.range(0, 6.28), r.range(0, 6.28), r.range(0, 6.28)];
        this.xs = [0];
        this.zs = [0];
        this.districts = [];
        this.stops = [];
        this._drand = makeRand(seed ^ 0xd157);
        this._srand = makeRand(seed ^ 0x5700);
        this._nextStop = 520;
        this._lastStopType = '';
    }

    heading(s) {
        const p = this.p;
        return 0.55 * Math.sin(s / 760 + p[0])
             + 0.32 * Math.sin(s / 330 + p[1])
             + 0.14 * Math.sin(s / 150 + p[2])
             + 0.06 * Math.sin(s / 71 + p[3]);
    }

    /** Make sure samples, districts and stops exist up to s. */
    ensure(s) {
        const need = Math.ceil(s / SAMPLE) + 2;
        const xs = this.xs, zs = this.zs;
        for (let i = xs.length; i <= need; i++) {
            const h = this.heading((i - 0.5) * SAMPLE);
            xs.push(xs[i - 1] + Math.sin(h) * SAMPLE);
            zs.push(zs[i - 1] + Math.cos(h) * SAMPLE);
        }
        // Stops are placed up to 1200 m past s and need to know their district.
        this._ensureDistricts(s + 3000);
        this._ensureStops(s);
    }

    _ensureDistricts(s) {
        const ds = this.districts, r = this._drand;
        while (!ds.length || ds[ds.length - 1].end < s) {
            const prev = ds[ds.length - 1];
            let type;
            if (!prev) type = 'downtown';
            else {
                do type = r.pick(DISTRICT_ORDER); while (type === prev.type);
            }
            const start = prev ? prev.end : -CHUNK * 4;
            // Districts end on a chunk boundary, which keeps every chunk single-district.
            const len = Math.round(r.range(1300, 2100) / CHUNK) * CHUNK;
            const def = DISTRICTS[type];
            ds.push({
                index: ds.length,
                type, start, end: start + len,
                name: r.pick(def.names),
                def,
                elev: type === 'skyway' ? SKYWAY_H : 0,
                prevElev: prev ? prev.elev : (type === 'skyway' ? SKYWAY_H : 0),
            });
        }
    }

    _ensureStops(s) {
        const r = this._srand;
        while (this._nextStop < s + 1200) {
            let at = this._nextStop;
            let placed = false;
            for (let tries = 0; tries < 12 && !placed; tries++) {
                const d = this.districtAt(at);
                const ok = at > d.start + (d.prevElev !== d.elev ? RAMP + 40 : 40)
                    && at + STOP_LEN + 40 < d.end
                    && !this.crossNear(at - 14, at + STOP_LEN + 14);
                if (ok) {
                    let type, n = 0;
                    do { type = r.pick(d.def.stops); n++; } while (type === this._lastStopType && n < 8);
                    this._lastStopType = type;
                    const st = { id: this.stops.length, s: at, type, district: d, seed: (r.next() * 1e9) | 0 };
                    nameStop(st);
                    this.stops.push(st);
                    placed = true;
                } else {
                    at += 64;
                }
            }
            this._nextStop = at + r.range(STOP_GAP_MIN, STOP_GAP_MAX);
        }
    }

    districtAt(s) {
        const ds = this.districts;
        // Walk from the end: queries are almost always near the newest districts.
        for (let i = ds.length - 1; i >= 0; i--) if (s >= ds[i].start) return ds[i];
        return ds[0];
    }

    elevation(s) {
        const d = this.districtAt(s);
        if (d.prevElev === d.elev) return d.elev;
        return lerp(d.prevElev, d.elev, smooth((s - d.start) / RAMP));
    }

    /** Cross streets: every `crossEvery` metres in districts that have them. */
    crossAt(s) {
        const d = this.districtAt(s);
        const every = d.def.crossEvery;
        if (!every) return null;
        const c = Math.round((s - every / 2) / every) * every + every / 2;
        if (Math.abs(s - c) > 9) return null;
        if (c < d.start + 60 || c > d.end - 40) return null;
        if (this.elevation(c) > 0.3) return null;
        return c;
    }

    crossNear(a, b) {
        for (let s = a; s <= b; s += 4) if (this.crossAt(s) !== null) return true;
        return false;
    }

    /** Stops whose bay overlaps [a, b). */
    stopsIn(a, b) {
        return this.stops.filter((st) => st.s + 50 > a && st.s - 30 < b);
    }

    nextStop(s) {
        for (const st of this.stops) if (st.s > s) return st;
        return null;
    }

    /** Fills `out` with the frame at arc length s. */
    frame(s, out = {}) {
        const i = Math.max(0, Math.floor(s / SAMPLE));
        const f = s / SAMPLE - i;
        const xs = this.xs, zs = this.zs;
        if (i + 1 >= xs.length) this.ensure(s + 50);
        const h = this.heading(s);
        out.x = xs[i] + (xs[i + 1] - xs[i]) * f;
        out.z = zs[i] + (zs[i + 1] - zs[i]) * f;
        out.y = this.elevation(s);
        out.h = h;
        out.tx = Math.sin(h); out.tz = Math.cos(h);
        out.rx = -Math.cos(h); out.rz = Math.sin(h);
        return out;
    }

    /** Minimum distance from (x, z) to the centreline between s0 and s1. */
    clearance(x, z, s0, s1) {
        const xs = this.xs, zs = this.zs;
        const i0 = Math.max(0, Math.floor(s0 / SAMPLE));
        const i1 = Math.min(xs.length - 1, Math.ceil(s1 / SAMPLE));
        let best = Infinity;
        for (let i = i0; i <= i1; i += 3) {
            const dx = xs[i] - x, dz = zs[i] - z;
            const d = dx * dx + dz * dz;
            if (d < best) best = d;
        }
        return Math.sqrt(best);
    }
}
