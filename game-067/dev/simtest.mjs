/**
 * simtest.mjs — headless tests of the pure simulation (js/sim). No browser, no three.js.
 *
 *   node game-067/dev/simtest.mjs            # all suites
 *   ONLY=track,trains node game-067/dev/simtest.mjs
 *
 * Suites:
 *   purity   js/sim never imports three, touches the DOM or calls Math.random
 *   geometry traversal points join up at tile edges, tangents are unit length, curves are ¼ arcs
 *   track    drawing straights, curves, crossings and switches; ends turning to meet a new line;
 *            strokes that rewind; erase refused under a train; stations only on straights
 *   islands  every preset on several seeds: land, a beach, no specks, the starter loop is closed,
 *            its station exists and its train runs
 *   trains   loops, switches, dead ends (stop then reverse), two trains never share a tile,
 *            nose-to-nose trains back off, stations stop trains, placement refuses short track
 *   people   residents spawn from homes, walk only on walkable tiles, board and leave trains
 *   save     serialize → JSON → deserialize gives the same island, trains keep running
 *   soak     every preset with four extra trains for ten simulated minutes: no NaN, no overlap
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(HERE, '../js');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);

const { N, T } = await import(path.join(JS, 'config.js'));
const G = await import(path.join(JS, 'sim/grid.js'));
const { World } = await import(path.join(JS, 'sim/world.js'));
const { generateIsland, PRESETS } = await import(path.join(JS, 'sim/islands.js'));
const { DEFAULT_SETS, trainLength } = await import(path.join(JS, 'sim/trainsets.js'));
const { ITEMS } = await import(path.join(JS, 'sim/catalog.js'));
const { STICKERS } = await import(path.join(JS, 'sim/stickers.js'));

let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log(`  ✗ ${m}`); } };
const suite = async (name, fn) => {
    if (ONLY.length && !ONLY.includes(name)) return;
    const f0 = fails, p0 = passes;
    await fn();
    console.log(`${fails === f0 ? '✓' : '✗'} ${name} (${passes - p0} checks${fails > f0 ? `, ${fails - f0} failed` : ''})`);
};

/** Flat grass world for hand-built test layouts. */
function flat() {
    const w = new World();
    w.tiles.fill(T.GRASS);
    return w;
}
const bits = (w, x, z) => w.track[G.idx(x, z)];
const B = (...segs) => segs.reduce((m, s) => m | (1 << s), 0);
const line = (pts) => { const out = []; for (let k = 0; k + 1 < pts.length; k++) { const seg = G.tileLine(...pts[k], ...pts[k + 1]); out.push(...(k ? seg.slice(1) : seg)); } return out; };
const loopPath = (x, z, w, h) => {
    const ring = [];
    for (let i = x; i < x + w; i++) ring.push([i, z]);
    for (let j = z + 1; j < z + h; j++) ring.push([x + w - 1, j]);
    for (let i = x + w - 2; i >= x; i--) ring.push([i, z + h - 1]);
    for (let j = z + h - 2; j > z; j--) ring.push([x, j]);
    const s = Math.floor(w / 2);
    const l = ring.slice(s).concat(ring.slice(0, s));
    return l.concat([l[0], l[1]]);
};
function run(w, secs, dt = 1 / 30, each) {
    for (let t = 0; t < secs; t += dt) { w.step(dt); if (each) each(t); }
}

await suite('purity', () => {
    const dir = path.join(JS, 'sim');
    for (const f of fs.readdirSync(dir)) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        ok(!/Math\.random\s*\(/.test(src), `${f} calls Math.random`);
        ok(!/from ['"]three/.test(src), `${f} imports three`);
        ok(!/\b(document|window)\./.test(src), `${f} touches the DOM`);
    }
});

await suite('geometry', () => {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        if (a === b) continue;
        const p0 = G.travPoint(a, b, 0), p1 = G.travPoint(a, b, 1);
        const mid = [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]];
        ok(Math.hypot(p0.x - mid[a][0], p0.z - mid[a][1]) < 1e-9, `trav ${a}->${b} starts at edge ${a}`);
        ok(Math.hypot(p1.x - mid[b][0], p1.z - mid[b][1]) < 1e-9, `trav ${a}->${b} ends at edge ${b}`);
        // numeric length matches travLen, tangent is unit and points along the motion
        let L = 0, prev = G.travPoint(a, b, 0);
        for (let k = 1; k <= 200; k++) { const p = G.travPoint(a, b, k / 200); L += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p; }
        ok(Math.abs(L - G.travLen(a, b)) < 1e-3, `trav ${a}->${b} length ${L} vs ${G.travLen(a, b)}`);
        const q = G.travPoint(a, b, 0.5), q2 = G.travPoint(a, b, 0.51);
        ok(Math.abs(Math.hypot(q.dx, q.dz) - 1) < 1e-9 || (a ^ b) === 2, `unit tangent ${a}->${b}`);
        ok((q2.x - q.x) * q.dx + (q2.z - q.z) * q.dz > 0, `tangent forward ${a}->${b}`);
    }
});

await suite('track', () => {
    let w = flat();
    w.layTrack(line([[5, 5], [10, 5]]));
    ok(bits(w, 5, 5) === B(1) && bits(w, 7, 5) === B(1) && bits(w, 10, 5) === B(1), 'straight E–W line');
    w = flat();
    w.layTrack(line([[5, 5], [8, 5], [8, 8]]));
    ok(bits(w, 8, 5) === B(4), `corner piece W–S at the bend (got ${bits(w, 8, 5)})`);
    ok(bits(w, 8, 8) === B(0), 'vertical end');
    // an end turns to meet a new line
    w = flat();
    w.layTrack(line([[5, 5], [8, 5]]));
    w.layTrack(line([[8, 5], [8, 9]]));
    ok(bits(w, 8, 5) === B(4), `loose straight end becomes a curve (got ${bits(w, 8, 5)})`);
    // a loop drawn from a corner closes cleanly (no stray straight left at the corner)
    w = flat();
    w.layTrack(line([[5, 5], [10, 5], [10, 9], [5, 9], [5, 5], [6, 5]]));
    ok(bits(w, 5, 5) === B(3), `corner-start loop closes with a single curve (got ${bits(w, 5, 5)})`);
    w = flat();
    w.layTrack(line([[5, 5], [10, 5], [10, 9], [5, 9], [5, 5]]));
    ok(bits(w, 5, 5) === B(3), `loop ending on its first tile closes too (got ${bits(w, 5, 5)})`);
    // starting a drag beside a straight branches off it toward the hinted end
    w = flat();
    w.layTrack(line([[5, 8], [11, 8]]));
    w.layTrack(line([[8, 8], [8, 4]]), 1);
    ok(bits(w, 8, 8) === B(1, 2), `branch toward the east end (got ${bits(w, 8, 8)})`);
    ok(w.isSwitch(8, 8), 'the branch is a switch');
    w = flat();
    w.layTrack(line([[5, 8], [11, 8]]));
    w.layTrack(line([[8, 8], [8, 4]]));
    ok(bits(w, 8, 8) === B(0, 1), 'without a hint it is a crossing');
    // crossing
    w = flat();
    w.layTrack(line([[5, 8], [11, 8]]));
    w.layTrack(line([[8, 5], [8, 11]]));
    ok(bits(w, 8, 8) === B(0, 1), 'crossing');
    ok(!w.isSwitch(8, 8), 'a crossing is not a switch');
    // switch: branch off the middle of a straight
    w = flat();
    w.layTrack(line([[5, 8], [11, 8]]));
    w.layTrack(line([[7, 8], [8, 8], [8, 11]]));
    ok(bits(w, 8, 8) === B(1, 4), `switch E–W + W–S (got ${bits(w, 8, 8)})`);
    ok(w.isSwitch(8, 8), 'switch detected');
    ok(w.route(8, 8, 3) === 1, 'switch default goes straight');
    w.toggleSwitch(8, 8);
    ok(w.route(8, 8, 3) === 2, 'toggled switch turns');
    // strokes rewind
    w = flat();
    w.place('tree_round', 7, 5, 0);
    w.beginStroke();
    w.layTrack(line([[5, 5], [8, 5]]));
    ok(!w.objectAt(7, 5), 'track clears a tree');
    w.rewindStroke();
    ok(bits(w, 6, 5) === 0 && w.objectAt(7, 5)?.type === 'tree_round', 'rewind restores track and tree');
    w.layTrack(line([[5, 5], [8, 5], [8, 7]]));
    w.endStroke();
    ok(bits(w, 8, 5) === B(4), 'rewound stroke re-lays with the bend');
    // buildings block track
    w = flat();
    w.place('house_red', 8, 5, 0);
    ok(w.layTrack(line([[5, 5], [10, 5]])) === 3, 'track stops at a house');
    // stations
    w = flat();
    w.layTrack(line([[5, 5], [10, 5]]));
    ok(w.setStation(7, 5, true) && w.setStation(8, 5, true), 'station on straight');
    ok(w.stationNames.get(G.idx(7, 5)) === w.stationNames.get(G.idx(8, 5)), 'adjacent platforms share a name');
    ok(w.stationBlock(G.idx(7, 5)).length === 2, 'station block of two');
    w.layTrack(line([[8, 5], [8, 8]]));
    ok(!w.station[G.idx(8, 5)], 'branching a platform tile removes its platform');
    // erase refused under a train
    w = flat();
    w.layTrack(loopPath(4, 4, 8, 6));
    const t = w.trains.place(DEFAULT_SETS[0], 5, 4, 1);
    ok(typeof t === 'object', 'train placed on loop');
    const under = w.trains.bodyTiles(t)[0];
    ok(w.eraseTrack(under % N, (under / N) | 0) === 'train', 'cannot erase under a train');
    // terrain
    w = flat();
    w.layTrack(line([[5, 5], [10, 5]]));
    w.paintTerrain(7, 5, T.WATER);
    ok(bits(w, 7, 5) === B(1) && w.tile(7, 5) === T.WATER, 'track survives as a bridge');
    w.place('house_red', 3, 3, 0);
    ok(!w.paintTerrain(3, 3, T.WATER), 'water does not drown a house');
    ok(w.canPlace('ferris', 20, 20, 0) === '' && w.place('ferris', 20, 20, 0) > 0 && w.objectAt(21, 21)?.type === 'ferris', '2×2 footprint');
    ok(w.canPlace('house_red', 21, 20, 0) === 'taken', 'footprint occupied');
    ok(w.canPlace('sailboat', 20, 25, 0) === 'needs water', 'boats need water');
    ok(ITEMS.every((it) => it.w >= 1 && it.d >= 1), 'catalog footprints');
});

await suite('islands', () => {
    for (const P of PRESETS) for (const seed of [1, 2, 3, 4]) {
        const w = generateIsland({ preset: P.id, seed, starter: true });
        let land = 0, sand = 0;
        for (let i = 0; i < N * N; i++) { if (w.tiles[i] !== T.WATER) land++; if (w.tiles[i] === T.SAND) sand++; }
        ok(land > 300, `${P.id}/${seed}: land ${land}`);
        if (P.id !== 'plate') ok(sand > 20, `${P.id}/${seed}: beach ${sand}`);
        for (let x = 0; x < N; x++) ok(w.tiles[G.idx(x, 0)] === T.WATER && w.tiles[G.idx(0, x)] === T.WATER, `${P.id}: water border`);
        const c = w.counts();
        ok(c.stations === 2, `${P.id}/${seed}: starter station (${c.stations})`);
        ok(w.trains.list.length === 1, `${P.id}/${seed}: starter train`);
        // every track tile's edges connect to a neighbour that connects back (a closed loop)
        let dangling = 0;
        for (let i = 0; i < N * N; i++) {
            if (!w.track[i]) continue;
            const m = G.edgeMask(w.track[i]);
            for (let e = 0; e < 4; e++) if (m & (1 << e) && !w.connectsBack(i % N, (i / N) | 0, e)) dangling++;
        }
        ok(dangling === 0, `${P.id}/${seed}: starter loop closed (${dangling} loose ends)`);
        const t = w.trains.list[0];
        const odo0 = t.odo;
        run(w, 40);
        ok(t.odo - odo0 > 20, `${P.id}/${seed}: starter train runs (${(t.odo - odo0).toFixed(1)} tiles)`);
        ok(w.people.list.length > 4, `${P.id}/${seed}: people (${w.people.list.length})`);
        const blank = generateIsland({ preset: P.id, seed, starter: false });
        ok(blank.trains.list.length === 0 && blank.counts().track === 0, `${P.id}: blank island has no track`);
    }
});

await suite('trains', () => {
    // a loop: keeps going round, tiles never shared
    let w = flat();
    w.layTrack(loopPath(4, 4, 10, 7));
    const a = w.trains.place(DEFAULT_SETS[1], 6, 4, 1);
    const b = w.trains.place(DEFAULT_SETS[0], 10, 10, 3);
    ok(typeof a === 'object' && typeof b === 'object', 'two trains on a loop');
    let overlap = 0;
    run(w, 120, 1 / 30, () => {
        const s = new Set(w.trains.bodyTiles(a));
        for (const i of w.trains.bodyTiles(b)) if (s.has(i)) overlap++;
    });
    ok(overlap === 0, `trains never share a tile (${overlap})`);
    ok(a.odo > 50 && b.odo > 50, `both trains keep moving (${a.odo.toFixed(0)}, ${b.odo.toFixed(0)})`);
    // dead end: stops, reverses, comes back
    w = flat();
    w.layTrack(line([[3, 10], [20, 10]]));
    const c = w.trains.place(DEFAULT_SETS[3], 6, 10, 1);
    let reversed = 0, minX = 99, maxX = -99;
    run(w, 60, 1 / 30, () => {
        for (const e of w.events.splice(0)) if (e.type === 'reverse') reversed++;
        const p = w.trains.pointAt(c, 0);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    });
    ok(reversed >= 2, `shuttles between buffers (${reversed} reversals)`);
    ok(maxX <= G.tileX(20) + 0.5 && minX >= G.tileX(3) - 0.5, `stays on the line (${minX.toFixed(2)}..${maxX.toFixed(2)})`);
    // nose to nose on a line: no deadlock
    w = flat();
    w.layTrack(line([[2, 10], [30, 10]]));
    const d = w.trains.place(DEFAULT_SETS[3], 8, 10, 1);
    const e = w.trains.place(DEFAULT_SETS[3], 24, 10, 3);
    ok(typeof d === 'object' && typeof e === 'object', 'two trains on a line');
    let ov = 0;
    const d0 = d.odo, e0 = e.odo;
    run(w, 90, 1 / 30, () => { const s = new Set(w.trains.bodyTiles(d)); for (const i of w.trains.bodyTiles(e)) if (s.has(i)) ov++; });
    ok(ov === 0, 'nose-to-nose never overlap');
    ok(d.odo - d0 > 15 && e.odo - e0 > 15, `nose-to-nose keep moving (${(d.odo - d0).toFixed(0)}, ${(e.odo - e0).toFixed(0)})`);
    // station stop
    w = flat();
    w.layTrack(loopPath(4, 4, 10, 7));
    w.setStation(8, 10, true); w.setStation(9, 10, true);
    const s = w.trains.place(DEFAULT_SETS[0], 6, 4, 1);
    let arrivals = 0;
    run(w, 60, 1 / 30, () => { for (const ev of w.events.splice(0)) if (ev.type === 'arrive') arrivals++; });
    ok(arrivals >= 2, `train stops at the station (${arrivals})`);
    s.stopStations = false;
    // switch routing: a loop with a siding
    w = flat();
    w.layTrack(loopPath(4, 4, 10, 7));
    w.layTrack(line([[6, 4], [7, 4], [7, 1], [12, 1]]));
    ok(w.isSwitch(7, 4), 'siding makes a switch');
    const sw = w.trains.place(DEFAULT_SETS[3], 5, 4, 1);
    w.toggleSwitch(7, 4);
    let visited = false;
    run(w, 20, 1 / 30, () => { if (w.trains.bodyTiles(sw).includes(G.idx(10, 1))) visited = true; });
    ok(visited, 'train takes the siding when the switch is set');
    // too short
    w = flat();
    w.layTrack(line([[5, 5], [7, 5]]));
    ok(w.trains.place(DEFAULT_SETS[1], 6, 5) === 'short', 'refuse a train longer than the track');
    ok(w.trains.place(DEFAULT_SETS[0], 30, 30) === 'notrack', 'refuse without track');
    ok(trainLength(DEFAULT_SETS[1]) > trainLength(DEFAULT_SETS[3]), 'lengths');
    // reverse keeps the train on the same tiles
    w = flat();
    w.layTrack(loopPath(4, 4, 10, 7));
    const r = w.trains.place(DEFAULT_SETS[1], 6, 4, 1);
    run(w, 3);
    const before = new Set(w.trains.bodyTiles(r));
    const p0 = w.trains.pointAt(r, r.len);
    w.trains.reverse(r);
    const p1 = w.trains.pointAt(r, 0);
    const after = new Set(w.trains.bodyTiles(r));
    ok([...after].every((i) => before.has(i)), 'reverse keeps the body tiles');
    ok(Math.hypot(p0.x - p1.x, p0.z - p1.z) < 1e-6, 'new head is the old tail');
});

await suite('people', () => {
    const w = generateIsland({ preset: 'plate', seed: 5, starter: true });
    run(w, 30);
    const n0 = w.people.list.length;
    ok(n0 >= 8, `residents spawned (${n0})`);
    let badTile = 0, boarded = 0, offed = 0;
    run(w, 400, 1 / 20, () => {
        for (const p of w.people.list) {
            if (p.state === 'ride') continue;
            const x = Math.floor(p.x), z = Math.floor(p.z);
            const t = w.tile(x, z);
            if (t === T.WATER || t === T.ROCK) badTile++;
        }
        for (const ev of w.events.splice(0)) if (ev.type === 'board') { boarded += ev.on; offed += ev.off; }
    });
    ok(badTile === 0, `nobody walks on water or hills (${badTile})`);
    ok(boarded > 0, `people board trains (${boarded})`);
    ok(offed > 0, `people get off trains (${offed})`);
    const t = w.trains.list[0];
    ok(t.riders <= t.cap && t.riders >= 0, `riders within capacity (${t.riders}/${t.cap})`);
    // removing all homes empties the island
    for (const o of [...w.objs.values()]) if (o.type.startsWith('house') || o.type === 'cottage' || o.type === 'townhouse') w.removeObject(o.id);
    w.trains.remove(t.id);
    run(w, 60);
    const left = w.people.list.length;
    let res = 0;
    for (const o of w.objs.values()) res += (ITEMS.find((it) => it.id === o.type).res || 0);
    ok(left <= res, `people leave with their homes (${left} ≤ ${res})`);
});

await suite('save', () => {
    const w = generateIsland({ preset: 'maple', seed: 9, starter: true });
    w.trains.place(DEFAULT_SETS[4], ...(() => { for (let i = 0; i < N * N; i++) if (w.track[i] && !w.trains.usesTile(i)) return [i % N, (i / N) | 0]; })());
    run(w, 10);
    const json = JSON.stringify(w.serialize());
    const w2 = World.deserialize(JSON.parse(json));
    ok(!!w2, 'deserializes');
    ok(JSON.stringify(w2.serialize().tiles) === JSON.stringify(w.serialize().tiles), 'terrain round trip');
    ok(w2.counts().track === w.counts().track && w2.objs.size === w.objs.size, 'track and objects round trip');
    ok(w2.trains.list.length === w.trains.list.length, `trains round trip (${w2.trains.list.length})`);
    ok(json.length < 60000, `save is small (${json.length} bytes)`);
    const odo = w2.trains.list.map((t) => t.odo);
    run(w2, 10);
    ok(w2.trains.list.every((t, k) => t.odo > odo[k] + 3), 'trains keep running after load');
    ok(World.deserialize({ v: 99 }) === null && World.deserialize(null) === null, 'rejects junk');
    // undo snapshot
    const snap = w.snapshot();
    w.paintTerrain(20, 20, T.WATER);
    w.place('castle', 10, 10, 0);
    w.restore(snap);
    ok(JSON.stringify(w.snapshot()) === JSON.stringify(snap), 'snapshot restore');
    ok(STICKERS.length >= 20 && new Set(STICKERS.map((s) => s.id)).size === STICKERS.length, 'stickers unique');
});

await suite('soak', () => {
    for (const P of PRESETS) {
        const w = generateIsland({ preset: P.id, seed: 77, starter: true });
        // add more trains wherever they fit
        let placed = 0;
        for (let i = 0; i < N * N && placed < 4; i += 7) {
            if (!w.track[i]) continue;
            const r = w.trains.place(DEFAULT_SETS[(placed + 2) % DEFAULT_SETS.length], i % N, (i / N) | 0);
            if (typeof r === 'object') placed++;
        }
        let bad = 0, overlap = 0;
        for (let s = 0; s < 600 * 15; s++) {
            w.step(1 / 15);
            if (s % 15) continue;
            const seen = new Map();
            for (const t of w.trains.list) {
                if (!Number.isFinite(t.h) || !Number.isFinite(t.v)) bad++;
                for (const i of w.trains.bodyTiles(t)) { if (seen.has(i) && seen.get(i) !== t.id) overlap++; seen.set(i, t.id); }
                for (const p of w.trains.poses(t)) if (!Number.isFinite(p.x + p.z + p.yaw)) bad++;
            }
            for (const p of w.people.list) if (!Number.isFinite(p.x + p.z)) bad++;
            w.events.length = 0;
        }
        ok(bad === 0, `${P.id}: no NaN`);
        ok(overlap === 0, `${P.id}: ${w.trains.list.length} trains never overlap (${overlap})`);
        const moving = w.trains.list.filter((t) => t.odo > 30).length;
        ok(moving === w.trains.list.length, `${P.id}: every train got somewhere (${moving}/${w.trains.list.length})`);
    }
});

console.log(fails ? `\n${fails} failed, ${passes} passed` : `\nall ${passes} checks passed`);
process.exit(fails ? 1 : 0);
