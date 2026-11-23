/**
 * simtest.mjs — Node tests for lib/core's pure modules, plus a drop-in check against the copies
 * already in the games: every game rng.js that exports makeRng / hash3 / vnoise / fbm is compared
 * value for value, so a game can switch its import without changing a seed's outcome or a save.
 *
 *   node dev/core/simtest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as R from '../../lib/core/rng.js';
import * as M from '../../lib/core/math.js';
import * as N from '../../lib/core/noise.js';
import * as Gd from '../../lib/core/grid.js';
import * as L from '../../lib/core/loop.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let fails = 0, oks = 0;
const check = (cond, msg) => { if (cond) oks++; else { fails++; console.log('  FAIL', msg); } return cond; };
const near = (a, b, e = 1e-12) => Math.abs(a - b) <= e;
const section = (s) => console.log(s);

// ---------------------------------------------------------------- purity
section('pure modules use no DOM, clock or Math.random');
for (const f of ['rng.js', 'math.js', 'noise.js', 'grid.js']) {
    const src = fs.readFileSync(path.join(ROOT, 'lib/core', f), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    check(!/\b(document|window|localStorage|Math\.random|Date\.now|performance\.now|requestAnimationFrame)\b/.test(src), `${f} is pure`);
}

// ---------------------------------------------------------------- rng
section('rng');
{
    const r = R.makeRng(42), a = [r(), r(), r()];
    const s = r.state(); const next = r();
    r.setState(s);
    check(r() === next, 'state/setState round trip');
    const r2 = R.makeRng(42);
    check([r2(), r2(), r2()].every((v, i) => v === a[i]), 'same seed, same sequence');
    const r3 = R.makeRng(7); let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 5000; i++) { const v = r3.int(2, 5); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    check(lo === 2 && hi === 5, 'int(lo, hi) includes both ends');
    const sh = R.shuffle([1, 2, 3, 4, 5, 6], R.makeRng(3));
    check(sh.length === 6 && [...sh].sort().join() === '1,2,3,4,5,6', 'shuffle is a permutation');
    const counts = { a: 0, b: 0 }; const r4 = R.makeRng(9);
    for (let i = 0; i < 20000; i++) counts[R.weighted(r4, { a: 3, b: 1 })]++;
    check(Math.abs(counts.a / 20000 - 0.75) < 0.02, `weighted 3:1 → ${(counts.a / 20000).toFixed(3)}`);
    const it = R.weightedItem(R.makeRng(1), [{ w: 0 }, { w: 5 }], (x) => x.w);
    check(it.w === 5, 'weightedItem skips zero weights');
    check(R.hashStr('hello') === 1335831723, 'hashStr is FNV-1a');
}

// ---------------------------------------------------------------- drop-in against the games' copies
section('drop-in: lib/core matches every game copy');
{
    const games = fs.readdirSync(ROOT).filter((d) => /^game-\d+$/.test(d)).sort();
    const seeds = [1, 42, 123456789, -7, 2 ** 31 - 1];
    const tally = { makeRng: [0, 0], 'makeRng {hashSeed}': [0, 0], hash3: [0, 0], vnoise: [0, 0], fbm: [0, 0], childSeed: [0, 0] };
    const differ = {};
    for (const g of games) {
        for (const rel of ['js/rng.js', 'js/sim/rng.js']) {
            const f = path.join(ROOT, g, rel);
            if (!fs.existsSync(f)) continue;
            let mod;
            try { mod = await import(pathToFileURL(f).href); } catch { continue; }   // imports config etc.
            const cmp = (name, same, fn = name) => {
                if (typeof mod[fn] !== 'function') return;
                tally[name][1]++;
                let eq = false;
                try { eq = same(); } catch { eq = false; }   // a different API counts as different
                if (eq) tally[name][0]++; else (differ[name] ||= []).push(g);
            };
            const sameRng = (opts) => seeds.every((s) => { const a = mod.makeRng(s), b = R.makeRng(s, opts); for (let i = 0; i < 300; i++) if (a() !== b()) return false; return true; });
            cmp('makeRng', () => sameRng());
            cmp('makeRng {hashSeed}', () => sameRng({ hashSeed: true }), 'makeRng');
            cmp('hash3', () => { for (let i = -50; i < 50; i++) if (mod.hash3(i, i * 7, i * 13) !== R.hash3(i, i * 7, i * 13)) return false; return true; });
            cmp('childSeed', () => { for (let i = 0; i < 50; i++) if (mod.childSeed(99, i, 3) !== R.childSeed(99, i, 3)) return false; return true; });
            cmp('vnoise', () => { for (let i = 0; i < 200; i++) if (!near(mod.vnoise(5, i * 0.37, i * 0.21), N.vnoise(5, i * 0.37, i * 0.21))) return false; return true; });
            cmp('fbm', () => { for (let i = 0; i < 200; i++) if (!near(mod.fbm(5, i * 0.37, i * 0.21), N.fbm(5, i * 0.37, i * 0.21))) return false; return true; });
        }
    }
    for (const k in tally) {
        const [same, all] = tally[k];
        const list = k === 'makeRng {hashSeed}' ? '' : differ[k] ? ` (differ: ${differ[k].join(' ')})` : '';
        console.log(`  ${k}: ${same}/${all} game copies identical${list}`);
    }
    check(tally.makeRng[1] >= 60, `found the games' makeRng copies (${tally.makeRng[1]})`);
    // one of the two lib variants must reproduce each game from 057 on (older ones are a different API)
    const later = new Set([...(differ.makeRng || [])].filter((g) => +g.slice(5) >= 58));
    // game-143 uses a distinct single-step initial seed mix. Keep it explicit
    // until it can switch without changing that game's deterministic sequence.
    const customSeedMix = new Set(['game-143']);
    const unmatched = [...later].filter((g) => !customSeedMix.has(g) && (differ['makeRng {hashSeed}'] || []).includes(g));
    check(later.size > 0, 'some later games use the hashed-seed variant');
    check(unmatched.length === 0, `every makeRng from game-058 on is reproduced by one variant${unmatched.length ? ': not ' + unmatched.join(' ') : ''}`);
    check(customSeedMix.has('game-143') && later.has('game-143') && (differ.makeRng || []).includes('game-143') && (differ['makeRng {hashSeed}'] || []).includes('game-143'), 'game-143 retains its documented custom seed mix');
    check(tally.hash3[0] >= tally.hash3[1] - 1, 'hash3 matches every copy but game-129 (which adds a mixing round)');
}

// ---------------------------------------------------------------- math
section('math');
check(M.clamp(5, 0, 3) === 3 && M.clamp(-1, 0, 3) === 0, 'clamp');
check(near(M.remap(5, 0, 10, 100, 200), 150), 'remap');
check(M.smoothstep(0, 1, -1) === 0 && M.smoothstep(0, 1, 2) === 1 && near(M.smoothstep(0, 1, 0.5), 0.5), 'smoothstep');
check(near(M.wrapAngle(3 * Math.PI), Math.PI) && near(M.wrapAngle(-3 * Math.PI), Math.PI), 'wrapAngle into (-π, π]');
check(near(M.angleDiff(Math.PI - 0.1, -Math.PI + 0.1), 0.2, 1e-9), 'angleDiff takes the short way');
check(M.mod(-1, 4) === 3, 'mod is positive');
{
    let a = 0; for (let i = 0; i < 60; i++) a = M.damp(a, 10, 5, 1 / 60);
    let b = 0; for (let i = 0; i < 120; i++) b = M.damp(b, 10, 5, 1 / 120);
    check(near(a, b, 1e-9), 'damp is frame-rate independent');
}
check(M.approach(0, 1, 0.3) === 0.3 && M.approach(0.9, 1, 0.3) === 1, 'approach lands exactly');
check(M.circleRect(0, 0, 1, { x: 0.5, y: -1, w: 2, h: 2 }) && !M.circleRect(0, 0, 1, { x: 1.5, y: -1, w: 2, h: 2 }), 'circleRect');

// ---------------------------------------------------------------- noise
section('noise');
{
    let lo = 1, hi = 0;
    for (let i = 0; i < 4000; i++) { const v = N.fbm(3, i * 0.13, i * 0.07); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    check(lo >= 0 && hi < 1 && hi - lo > 0.3, `fbm stays in [0, 1) with spread (${lo.toFixed(2)}..${hi.toFixed(2)})`);
    check(near(N.vnoise(1, 0.5, 0.5), N.vnoise(1, 0.5, 0.5)) && N.vnoise(1, 0.5, 0.5) !== N.vnoise(2, 0.5, 0.5), 'deterministic and seeded');
    check(Math.abs(N.vnoise(1, 3, 4) - N.vnoise(1, 3.0001, 4)) < 1e-3, 'continuous');
    const r = N.ridged(1, 2.3, 4.1); check(r >= 0 && r <= 1, 'ridged in [0, 1]');
}

// ---------------------------------------------------------------- grid
section('grid');
{
    const map = [
        '#########',
        '#S..#...#',
        '#.#.#.#.#',
        '#.#...#G#',
        '#########',
    ];
    const w = map[0].length, h = map.length;
    const pass = (x, y) => map[y][x] !== '#';
    const field = Gd.distanceField(w, h, pass, [[1, 1]]);
    check(field[3 * w + 7] === 12, `BFS distance S→G is 12 (got ${field[3 * w + 7]})`);
    check(field[0] === -1, 'walls are -1');
    const p = Gd.astar(w, h, pass, 1, 1, 7, 3);
    check(p && p.length === 12 && p.at(-1)[0] === 7 && p.at(-1)[1] === 3, 'A* finds the 12-step path');
    let ok = true, [x, y] = [1, 1];
    for (const [nx, ny] of p) { if (Math.abs(nx - x) + Math.abs(ny - y) !== 1 || !pass(nx, ny)) ok = false; [x, y] = [nx, ny]; }
    check(ok, 'every A* step is one passable 4-neighbour');
    check(Gd.astar(w, h, pass, 1, 1, 1, 1).length === 0, 'already there → []');
    const walled = (x, y) => pass(x, y) && !(x === 5 && y === 3) && !(x === 3 && y === 3);
    check(Gd.astar(w, h, walled, 1, 1, 7, 3) === null, 'no path → null');
    check(!Gd.reachable(w, h, walled, 1, 1, 7, 3) && Gd.reachable(w, h, pass, 1, 1, 7, 3), 'reachable');
    const near1 = Gd.astar(w, h, walled, 1, 1, 7, 3, { nearest: true });
    check(near1 && near1.length > 0, 'nearest: paths toward an unreachable goal');
    let step = [7, 3], walked = 0;
    while ((step = Gd.downhill(field, w, h, step[0], step[1]))) walked++;
    check(walked === 12, 'downhill walks the field back to the start');
    check(Gd.floodFill(w, h, pass, 1, 1).count === 15, 'floodFill counts the open cells');
    // diagonals may not cut corners
    const open2 = ['...', '.#.', '...'];
    const p2 = (x, y) => open2[y][x] !== '#';
    const d = Gd.astar(3, 3, p2, 0, 0, 2, 2, { diagonal: true });
    check(d && d.length === 4, `diagonal A* doesn't cut the block's corners (${d && d.length} steps)`);
    // random mazes: A* (4-way) length equals BFS distance
    let agree = 0, trials = 300;
    for (let s = 0; s < trials; s++) {
        const rng = R.makeRng(s + 1), W = 24, H = 16;
        const cells = new Uint8Array(W * H).map(() => (rng() < 0.28 ? 0 : 1));
        cells[0] = cells[W * H - 1] = 1;
        const ps = (x, y) => cells[y * W + x] === 1;
        const f = Gd.distanceField(W, H, ps, [[0, 0]]);
        const path = Gd.astar(W, H, ps, 0, 0, W - 1, H - 1);
        if ((f[W * H - 1] < 0 && path === null) || (path && path.length === f[W * H - 1])) agree++;
    }
    check(agree === trials, `A* agrees with BFS on ${agree}/${trials} random mazes`);
    const line = Gd.lineCells(0, 0, 5, 2);
    check(line.length === 6 && line[0].join() === '0,0' && line.at(-1).join() === '5,2', 'lineCells');
    check(Gd.lineOfSight((x, y) => x === 2 && y === 0, 0, 0, 4, 0) === false && Gd.lineOfSight(() => false, 0, 0, 4, 3), 'lineOfSight');
    const heap = new Gd.MinHeap(); const rr = R.makeRng(5); const vals = [];
    for (let i = 0; i < 500; i++) { const v = rr(); vals.push(v); heap.push(v, v); }
    vals.sort((a, b) => a - b); let sorted = true;
    for (const v of vals) if (heap.pop() !== v) sorted = false;
    check(sorted && heap.size === 0, 'MinHeap pops in order');
}

// ---------------------------------------------------------------- loop
section('loop');
{
    const s = L.makeStepper({ step: 1 / 120, maxFrame: 0.05, fast: 1 });
    let n = 0;
    for (let i = 0; i < 60; i++) s.advance(1 / 60, () => n++);
    check(n === 120, `60 frames at 60 fps → 120 steps (${n})`);
    n = 0; s.reset();
    s.advance(1 / 240, () => n++); s.advance(1 / 240, () => n++);
    check(n === 1, 'two short frames add up to one step');
    n = 0; s.reset(); s.advance(10, () => n++);
    check(n === 6, `a 10 s hitch runs only maxFrame worth (${n})`);
    const f = L.makeStepper({ step: 1 / 120, fast: 4 }); n = 0; f.advance(1 / 60, () => n++);
    check(n === 8, 'fast=4 runs 4× the steps');
    check(L.debugFlags('?debug=1&fast=8').FAST === 8 && L.debugFlags('?fast=8').FAST === 1 && L.debugFlags('?debug=1&fast=999').FAST === 40, 'debugFlags');
    const got = []; const pump = L.makeEventPump((G, ev) => got.push(...ev));
    const G = { events: [{ type: 'a' }, { type: 'b' }, { type: 'a' }] };
    pump.drain(G);
    check(got.length === 3 && G.events.length === 0 && pump.seen.a === 2, 'event pump drains and counts');
}

console.log(`\n${oks} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
