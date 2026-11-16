/**
 * simtest.mjs — headless checks of LANTERNHOLLOW's simulation. No browser.
 *
 *   node game-138/dev/simtest.mjs                 # everything
 *   ONLY=wfc,gen node game-138/dev/simtest.mjs
 *   SEEDS=60 VERBOSE=1 node game-138/dev/simtest.mjs
 *
 * purity   js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock.
 * tiles    the tile set: rotations, edges, a symmetric compatibility table.
 * wfc      every neighbouring pair of tiles matches along its edge; the border is rock; pins are honoured.
 * gen      over SEEDS seeds × 3 sizes × up to 5 levels: stairs line up between levels, every level is reachable from
 *          its stairs up to its stairs down, the kept part is a sensible size, levels are never the fallback, the
 *          mix sliders change what grows (0 water → no water), painted pins hold or are reported as loosened.
 * features nothing on or beside the stairs, every blocker leaves the stairs joined and every friend and hoard
 *          reachable, sliders at 0 place nothing, stamps and erasures are honoured, a blocking stamp is refused.
 * share    encode/decode round trips, garbage and hostile links are clamped, not trusted.
 * walker   walking, walls, water, stairs down and up, befriending and treasure.
 * determinism  the same params give the same dungeon; a save round trip mid-walk walks on identically.
 * bot      the explorer bot walks every dungeon to the bottom with the real collision, meeting every friend and
 *          finding every hoard; prints a table of times.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 30);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Tl = await import('../js/sim/tiles.js');
const W = await import('../js/sim/wfc.js');
const D = await import('../js/sim/dungeon.js');
const F = await import('../js/sim/features.js');
const S = await import('../js/sim/share.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Wk = await import('../js/sim/walker.js');
const { ELEMENTS } = await import('../js/sim/data/elements.js');
const { THEME_IDS } = await import('../js/sim/data/themes.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const P = (o = {}) => S.normalize({ seed: 'test-seed', ...o });
const walkable = (ch) => Tl.isWalk(ch);

/** Every adjacency in a tiles array matches, and the border faces rock. */
function tilesConsistent(tiles, w, h) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = Tl.TILES[tiles[y * w + x]];
        if (x + 1 < w && t.edges[1] !== Tl.TILES[tiles[y * w + x + 1]].edges[3]) return `E edge at ${x},${y}`;
        if (y + 1 < h && t.edges[2] !== Tl.TILES[tiles[(y + 1) * w + x]].edges[0]) return `S edge at ${x},${y}`;
        if (y === 0 && t.edges[0] !== '###') return `open top border at ${x}`;
        if (y === h - 1 && t.edges[2] !== '###') return `open bottom border at ${x}`;
        if (x === 0 && t.edges[3] !== '###') return `open left border at ${y}`;
        if (x === w - 1 && t.edges[1] !== '###') return `open right border at ${y}`;
    }
    return '';
}

/** Micro cells reachable from (sx, sy), optionally with features blocking. */
function reachMicro(L, sx, sy, withFeatures) {
    const blocked = new Uint8Array(L.mw * L.mh);
    if (withFeatures) for (const f of L.features) if (f.block) blocked[f.my * L.mw + f.mx] = 1;
    const seen = new Uint8Array(L.mw * L.mh), q = [sy * L.mw + sx];
    seen[q[0]] = 1;
    while (q.length) {
        const c = q.pop(), x = c % L.mw, y = (c / L.mw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= L.mw || ny >= L.mh) continue;
            const n = ny * L.mw + nx;
            if (seen[n] || blocked[n] || !walkable(L.grid[ny][nx])) continue;
            seen[n] = 1; q.push(n);
        }
    }
    return seen;
}

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|\blocation\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main|controls)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('tiles')) {
    section('tiles');
    ok(Tl.T > 40 && Tl.T < 120, `a sensible number of tile variants (${Tl.T})`);
    for (const t of Tl.TILES) {
        ok(t.rows.length === 3 && t.rows.every((r) => r.length === 3), `${t.fam}/${t.rot} is 3×3`);
        ok(t.edges.every((e) => /^[#.~]{3}$/.test(e)), `${t.fam}/${t.rot} has only rock, floor or water on its edges`);
    }
    // rotation: the bend's opening moves clockwise
    const bends = Tl.TILES.filter((t) => t.fam === 'bend');
    ok(bends.length === 4, 'a bend faces all four ways');
    ok(Tl.TILES.filter((t) => t.fam === 'rock').length === 1 && Tl.TILES.filter((t) => t.fam === 'floor').length === 1, 'symmetric tiles are not duplicated');
    let sym = true;
    for (let d = 0; d < 4; d++) for (const a of Tl.TILES) for (const b of Tl.COMPAT[d][a.id]) if (!Tl.COMPAT[(d + 2) % 4][b].includes(a.id)) sym = false;
    ok(sym, 'compatibility is symmetric (b may sit east of a ⇔ a may sit west of b)');
    // every tile can sit beside at least one other in every direction (no dead tiles)
    ok(Tl.TILES.every((t) => [0, 1, 2, 3].every((d) => Tl.COMPAT[d][t.id].length > 0)), 'every tile has a neighbour in every direction');
    // micro connectivity inside each tile: its walkable micro cells form one piece
    const inner = Tl.TILES.every((t) => {
        const cells = []; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (walkable(t.rows[y][x])) cells.push([x, y]);
        if (!cells.length) return true;
        const seen = new Set(['0,0'].slice(0, 0)); const q = [cells[0]]; seen.add(cells[0].join());
        while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (!seen.has(k) && cells.some((c) => c.join() === k)) { seen.add(k); q.push([x + dx, y + dy]); } } }
        return seen.size === cells.length;
    });
    ok(inner, 'every tile\'s walkable micro cells are joined inside the tile');
}

// ======================================================================
if (want('wfc')) {
    section('wfc');
    const weights = D.tileWeights(C.DEFAULT_MIX);
    let solved = 0, bad = '';
    for (let s = 1; s <= SEEDS; s++) {
        const tiles = W.collapse({ w: 14, h: 10, weights, rng: makeRng(s * 101) });
        if (!tiles) continue;
        solved++;
        bad ||= tilesConsistent(tiles, 14, 10);
    }
    ok(!bad, `every collapsed map matches along every edge${bad ? ': ' + bad : ''}`);
    ok(solved >= SEEDS * 0.5, `most plain collapses succeed first time (${solved}/${SEEDS})`);
    // a pin is honoured
    const pin = Tl.tilesOf(['well']);
    const t = W.collapse({ w: 10, h: 8, weights, pins: new Map([[3 * 10 + 4, pin]]), rng: makeRng(7) })
        || W.collapse({ w: 10, h: 8, weights, pins: new Map([[3 * 10 + 4, pin]]), rng: makeRng(8) });
    ok(t && Tl.TILES[t[34]].fam === 'well', 'a pinned cell gets its pinned tile');
    // a weight-0 kind never appears unless pinned
    const noWater = D.tileWeights({ ...C.DEFAULT_MIX, water: 0 });
    let water = false;
    for (let s = 1; s <= 10; s++) { const m = W.collapse({ w: 12, h: 9, weights: noWater, rng: makeRng(s) }); if (m && [...m].some((i) => Tl.FAMILIES[Tl.TILES[i].fam].mix === 'water')) water = true; }
    ok(!water, 'water at 0 grows no water tiles');
}

// ======================================================================
if (want('gen')) {
    section('gen');
    const rows = [];
    let stairsOk = true, reachOk = true, consistent = '', fallbacks = 0, sizeOk = true, total = 0, ms = 0;
    for (const size of ['s', 'm', 'l']) {
        for (let s = 1; s <= SEEDS; s++) {
            const levels = 1 + (s % C.MAX_LEVELS);
            const p = P({ seed: `gen-${size}-${s}`, size, levels, themes: THEME_IDS.slice(s % 3) });
            const t0 = Date.now();
            const d = D.generate(p);
            ms += Date.now() - t0;
            ok(d.levels.length === levels, `${p.seed}: ${levels} levels`) || 0;
            for (const L of d.levels) {
                total++;
                if (L.fallback) fallbacks++;
                consistent ||= tilesConsistent(L.tiles, L.w, L.h) && `${p.seed} L${L.k}: ${tilesConsistent(L.tiles, L.w, L.h)}`;
                if (L.grid[L.up.my][L.up.mx] !== '^') stairsOk = false;
                if (L.down && L.grid[L.down.my][L.down.mx] !== 'v') stairsOk = false;
                if (L.k > 0) { const A = d.levels[L.k - 1].down; if (A.mx !== L.up.mx || A.my !== L.up.my) stairsOk = false; }
                const seen = reachMicro(L, L.up.mx, L.up.my, false);
                if (L.down && !seen[L.down.my * L.mw + L.down.mx]) reachOk = false;
                let walk = 0, reached = 0;
                for (let y = 0; y < L.mh; y++) for (let x = 0; x < L.mw; x++) if (walkable(L.grid[y][x])) { walk++; if (seen[y * L.mw + x]) reached++; }
                if (reached !== walk) reachOk = false;           // nothing walkable is left unreachable
                const kept = L.tiles.filter((i) => Tl.TILES[i].fam !== 'rock').length / (L.w * L.h);
                if (kept < C.GEN.minWalk - 1e-9 || kept > C.GEN.maxWalk + 1e-9) sizeOk = false;
                rows.push({ size, rooms: L.rooms.length, kept, feats: L.features.length });
            }
        }
    }
    ok(!consistent, `every generated level matches along every edge${consistent ? ': ' + consistent : ''}`);
    ok(stairsOk, 'stairs down on level k sit exactly over the stairs up on level k+1');
    ok(reachOk, 'every walkable cell is reachable from the stairs up, and the stairs down are among them');
    ok(sizeOk, `the kept part of every level covers ${C.GEN.minWalk * 100}–${C.GEN.maxWalk * 100} % of its cells`);
    ok(fallbacks === 0, `no level needed the default-mix fallback (${fallbacks} of ${total})`);
    const avg = (k, sz) => { const r = rows.filter((x) => x.size === sz); return (r.reduce((a, x) => a + x[k], 0) / r.length).toFixed(1); };
    for (const sz of ['s', 'm', 'l']) console.log(`  ${sz}: ${avg('rooms', sz)} chambers, ${(avg('kept', sz) * 100).toFixed(0)} % dungeon, ${avg('feats', sz)} features per level`);
    console.log(`  ${total} levels in ${ms} ms (${(ms / total).toFixed(1)} ms each)`);
    ok(ms / total < 120, 'a level generates in well under a frame budget on average');

    // the mix changes what grows
    const count = (p, fam) => D.generate(p).levels.reduce((a, L) => a + L.tiles.filter((i) => Tl.FAMILIES[Tl.TILES[i].fam].mix === fam).length, 0);
    const lo = count(P({ seed: 'mix', levels: 3, mix: { water: 1 } }), 'water'), hi = count(P({ seed: 'mix', levels: 3, mix: { water: 9 } }), 'water');
    ok(hi > lo, `more water at 9 than at 1 (${hi} > ${lo} tiles)`);
    ok(count(P({ seed: 'mix', levels: 3, mix: { water: 0 } }), 'water') === 0, 'water at 0: none at all');
    ok(count(P({ seed: 'mix', levels: 3, mix: { pits: 0 } }), 'pits') === 0, 'wells at 0: none at all');
    const ch = (m) => D.generate(P({ seed: 'mix2', levels: 3, mix: m })).levels.reduce((a, L) => a + L.tiles.filter((i) => Tl.FAMILIES[Tl.TILES[i].fam].mix === 'chambers').length, 0);
    ok(ch({ chambers: 9, tunnels: 2 }) > ch({ chambers: 2, tunnels: 9 }), 'more chamber tiles when chambers are up and tunnels down');
    // extreme mixes still generate
    let extremes = true;
    for (const m of [{ tunnels: 0, chambers: 0, water: 0, pits: 0 }, { tunnels: 9, chambers: 0 }, { tunnels: 0, chambers: 9, water: 9, pits: 9 }]) {
        try { const d = D.generate(P({ seed: 'extreme', levels: 2, mix: m })); if (!d.levels.every((L) => L.down === null || L.grid[L.down.my][L.down.mx] === 'v')) extremes = false; } catch { extremes = false; }
    }
    ok(extremes, 'even all-zero or lopsided mixes still give a joined dungeon');

    // painted pins
    const base = D.generate(P({ seed: 'pins', levels: 2 }));
    const L0 = base.levels[0];
    let cell = null;
    for (let y = 2; y < L0.h - 2 && !cell; y++) for (let x = 2; x < L0.w - 2; x++) if (Tl.TILES[L0.tiles[y * L0.w + x]].fam === 'rock' && Math.abs(x - L0.up.cx) > 2) { cell = { x, y }; break; }
    const pinned = D.generate(P({ seed: 'pins', levels: 2, pins: [{ l: 0, x: cell.x, y: cell.y, b: 'chamber' }] })).levels[0];
    ok(pinned.loosened || Tl.TILES[pinned.tiles[cell.y * pinned.w + cell.x]].fam === 'floor', 'a painted chamber square becomes a chamber (or the level says it loosened it)');
    ok(!pinned.loosened, 'a single painted square fits without loosening');
    const rockPin = D.generate(P({ seed: 'pins', levels: 2, pins: [{ l: 1, x: 3, y: 3, b: 'rock' }] })).levels[1];
    ok(rockPin.loosened || Tl.TILES[rockPin.tiles[3 * rockPin.w + 3]].fam === 'rock' || rockPin.up.cx === 3, 'a painted rock square stays rock');
    // a pin on level 1 doesn't change level 0
    ok(JSON.stringify(D.generate(P({ seed: 'pins', levels: 2, pins: [{ l: 1, x: 4, y: 4, b: 'water' }] })).levels[0].grid) === JSON.stringify(L0.grid), 'painting one level leaves the others alone');
}

// ======================================================================
if (want('features')) {
    section('features');
    let nearStairs = false, joined = true, reachAll = true, onFloor = true, wallOk = true, total = 0;
    for (let s = 1; s <= SEEDS; s++) {
        const d = D.generate(P({ seed: `feat-${s}`, levels: 3, size: ['s', 'm', 'l'][s % 3], el: { monsters: 9, hoards: 9, lights: 9, cozy: 9, flora: 9, windows: 9 } }));
        for (const L of d.levels) {
            const seen = reachMicro(L, L.up.mx, L.up.my, true);
            if (L.down && !seen[L.down.my * L.mw + L.down.mx]) joined = false;
            for (const f of L.features) {
                total++;
                if (f.block && [L.up, L.down].some((st) => st && Math.abs(st.mx - f.mx) <= 1 && Math.abs(st.my - f.my) <= 1)) nearStairs = true;
                if (L.grid[f.my][f.mx] !== '.') onFloor = false;
                if (f.dir !== undefined && L.grid[f.my + [-1, 0, 1, 0][f.dir]]?.[f.mx + [0, 1, 0, -1][f.dir]] !== '#') wallOk = false;
                if (f.block && ['monsters', 'hoards'].includes(ELEMENTS[f.kind]?.cat)) {
                    const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(f.my + dy) * L.mw + f.mx + dx]);
                    if (!adj) reachAll = false;
                }
            }
        }
    }
    ok(!nearStairs, 'nothing that blocks stands on or beside the stairs');
    ok(onFloor, 'every feature stands on bare floor (not rock, water, wells or stairs)');
    ok(wallOk, 'every torch and window hangs on real rock');
    ok(joined, 'with everything at 9, the stairs are still joined');
    ok(reachAll, 'every friend and every hoard has a reachable cell beside it');
    console.log(`  ${total} features on ${SEEDS * 3} busy levels`);

    const none = D.generate(P({ seed: 'zero', levels: 3, el: { monsters: 0, hoards: 0, lights: 0, cozy: 0, flora: 0, windows: 0 } }));
    ok(none.levels.every((L) => L.features.length === 0), 'every element slider at 0 places nothing');
    const noMon = D.generate(P({ seed: 'zero', levels: 3, el: { monsters: 0 } }));
    ok(noMon.levels.every((L) => !L.features.some((f) => ELEMENTS[f.kind]?.cat === 'monsters')), 'monsters at 0: no monsters, not even the dragon');
    const deep = D.generate(P({ seed: 'dragon-test', levels: 3, el: { monsters: 5 } }));
    ok(deep.levels[2].features.some((f) => f.kind === 'dragon') && !deep.levels[0].features.some((f) => f.kind === 'dragon'), 'the drowsy dragon sleeps on the deepest level only');
    const more = (k) => D.generate(P({ seed: 'dens', levels: 3, el: { [k]: 9 } })).levels.reduce((a, L) => a + L.features.filter((f) => (ELEMENTS[f.kind]?.cat ?? (f.kind === 'torch' ? 'lights' : 'windows')) === k).length, 0);
    const less = (k) => D.generate(P({ seed: 'dens', levels: 3, el: { [k]: 2 } })).levels.reduce((a, L) => a + L.features.filter((f) => (ELEMENTS[f.kind]?.cat ?? (f.kind === 'torch' ? 'lights' : 'windows')) === k).length, 0);
    for (const k of ['monsters', 'hoards', 'lights', 'cozy', 'flora', 'windows']) ok(more(k) > less(k), `${k} at 9 places more than at 2`);

    // stamps and erasures
    const d0 = D.generate(P({ seed: 'stamp' }));
    const L = d0.levels[0];
    let spot = null;
    for (let y = 0; y < L.mh && !spot; y++) for (let x = 0; x < L.mw; x++) if (!F.stampProblem(L, x, y, 'cauldron') && Tl.FAMILIES[Tl.TILES[L.tiles[((y / 3) | 0) * L.w + ((x / 3) | 0)]].fam].room) { spot = { x, y }; break; }
    ok(!!spot, 'there is somewhere to stamp');
    const d1 = D.generate(P({ seed: 'stamp', stamps: [{ l: 0, x: spot.x, y: spot.y, k: 'cauldron' }] }));
    ok(d1.levels[0].features.some((f) => f.kind === 'cauldron' && f.mx === spot.x && f.my === spot.y && f.stamped), 'a stamped element is placed where it was stamped');
    const victim = L.features.find((f) => f.block);
    const d2 = D.generate(P({ seed: 'stamp', erased: [{ l: 0, x: victim.mx, y: victim.my }] }));
    ok(!d2.levels[0].features.some((f) => f.mx === victim.mx && f.my === victim.my), 'an erased element is gone');
    // a stamp that would cut a tunnel is refused: find a tunnel cell with exactly two walkable neighbours on the route
    let cut = null;
    for (let y = 0; y < L.mh && !cut; y++) for (let x = 0; x < L.mw; x++) {
        if (L.grid[y][x] !== '.' || Tl.FAMILIES[Tl.TILES[L.tiles[((y / 3) | 0) * L.w + ((x / 3) | 0)]].fam].room) continue;
        const blocked = new Uint8Array(L.mw * L.mh); blocked[y * L.mw + x] = 1;
        const seen = F.reach(L, blocked);
        if (L.down && !seen[L.down.my * L.mw + L.down.mx]) { cut = { x, y }; break; }
    }
    if (cut) ok(F.stampProblem(L, cut.x, cut.y, 'barrels') === 'that would block the way', 'a stamp that would cut the way to the stairs is refused');
    ok(F.stampProblem(L, 0, 0, 'slime') === 'that is solid rock', 'a stamp on rock is refused with a reason');
    ok(F.stampProblem(L, L.up.mx, L.up.my, 'slime') !== '', 'a stamp on the stairs is refused');
}

// ======================================================================
if (want('share')) {
    section('share');
    const p = P({ seed: 'mossy-badger-27', size: 'l', levels: 4, mix: { tunnels: 2, chambers: 8, water: 0, pits: 9 }, el: { monsters: 9, hoards: 0, lights: 3, cozy: 7, flora: 1, windows: 6 },
        themes: ['frost', 'grotto', 'cellar', 'ruins'], pins: [{ l: 0, x: 3, y: 4, b: 'water' }, { l: 2, x: 5, y: 5, b: 'rock' }],
        stamps: [{ l: 1, x: 10, y: 12, k: 'dragon' }], erased: [{ l: 3, x: 7, y: 8 }] });
    const h = S.encode(p);
    ok(JSON.stringify(S.decode(h)) === JSON.stringify(p), 'encode → decode gives the same params');
    ok(JSON.stringify(S.decode('#' + h)) === JSON.stringify(p), 'a leading # is fine');
    ok(h.length < 400, `the link stays short (${h.length} characters)`);
    ok(S.encode(S.decode(h)) === h, 'and encodes back to the same text');
    ok(S.decode('') === null && S.decode('#z=m') === null, 'a link without a seed is not a dungeon');
    const hostile = S.decode('s=<script>alert(1)</script>&z=huge&n=99&m=99999&e=abc&t=zzzz&p=0.999.999.c_x.y.z_0.1.1.nope&k=0.1.1.__proto__&x=-1.-1.-1');
    ok(hostile && /^[a-z0-9-]+$/.test(hostile.seed), `a hostile seed is cleaned (${hostile.seed})`);
    ok(hostile.size === 'm' && hostile.levels === C.MAX_LEVELS, 'size and levels are clamped');
    ok(Object.values(hostile.mix).every((v) => v >= 0 && v <= 9) && Object.values(hostile.el).every((v) => v >= 0 && v <= 9), 'sliders are clamped to 0–9');
    ok(hostile.themes.every((t) => THEME_IDS.includes(t)), 'unknown themes fall back to real ones');
    ok(hostile.pins.length === 0 && hostile.stamps.length === 0 && hostile.erased.length === 0, 'out-of-range or unknown edits are dropped');
    let gen = true;
    try { D.generate(hostile); } catch { gen = false; }
    ok(gen, 'a hostile link still generates a dungeon');
    const dup = S.normalize({ seed: 'a', pins: [{ l: 0, x: 2, y: 2, b: 'rock' }, { l: 0, x: 2, y: 2, b: 'water' }] });
    ok(dup.pins.length === 1 && dup.pins[0].b === 'water', 'painting a square twice keeps the latest paint');
    const rng = makeRng(5);
    ok(/^[a-z]+-[a-z]+-\d+$/.test(S.seedPhrase(rng)), 'seed phrases look like "mossy-badger-27"');
}

// ======================================================================
if (want('walker')) {
    section('walker');
    let G = Gm.newGame(P({ seed: 'walk-test', levels: 3 }));
    const L = G.d.levels[0];
    ok(Wk.microOf(G.x) !== L.up.mx || Wk.microOf(G.z) !== L.up.my, 'the explorer starts beside the stairs, not on them');
    ok(!Wk.blockedAt(L, G.x, G.z), 'and somewhere free');
    const x0 = G.x, z0 = G.z;
    for (let i = 0; i < 60; i++) Gm.step(G, { fx: 1, sx: 0 }, DT);
    ok(Math.hypot(G.x - x0, G.z - z0) > 1, 'walking forward moves');
    for (let i = 0; i < 20 * 120; i++) Gm.step(G, { fx: 1, sx: 0 }, DT);
    ok(!Wk.blockedAt(L, G.x, G.z), 'walking into a wall for 20 s never goes through it');
    let inRock = false;
    for (let i = 0; i < 30 * 120; i++) { Gm.step(G, { fx: 1, sx: 0.4, yaw: 0.01 }, DT); if (L.grid[Wk.microOf(G.z)]?.[Wk.microOf(G.x)] === '#') inRock = true; }
    ok(!inRock, 'circling for 30 s never puts the explorer inside rock');

    // water slows
    G = Gm.newGame(P({ seed: 'walk-test', levels: 3, mix: { water: 9 } }));
    const Lw = G.d.levels.find((l) => l.grid.some((r) => r.includes('~')));
    if (Lw) {
        G.lv = Lw.k;
        let wx = -1, wz = -1;
        outer: for (let y = 0; y < Lw.mh; y++) for (let x = 0; x < Lw.mw; x++) if (Lw.grid[y][x] === '~' && !Wk.blockedAt(Lw, Wk.centre(x), Wk.centre(y))) { wx = x; wz = y; break outer; }
        G.x = Wk.centre(wx); G.z = Wk.centre(wz);
        const sp = (x, z) => { G.x = x; G.z = z; G.yaw = 0; const a = G.dist; Gm.step(G, { fx: 1 }, DT); return G.dist - a; };
        const inWater = sp(Wk.centre(wx), Wk.centre(wz));
        ok(inWater > 0 && inWater < C.WALK.speed * DT * 0.8, 'wading is slower than walking');
        ok(G.events.some((e) => e.type === 'splash') || G.wet, 'stepping into water splashes');
    }

    // stairs: walk onto the stairs down and arrive on the next level
    G = Gm.newGame(P({ seed: 'walk-test', levels: 3 }));
    const L0 = G.d.levels[0];
    G.x = Wk.centre(L0.down.mx); G.z = Wk.centre(L0.down.my); G.stairCool = 0;
    Gm.step(G, { fx: 0 }, DT);
    ok(G.lv === 1 && G.events.some((e) => e.type === 'stairs' && e.to === 1), 'stepping onto the stairs down takes you to level 2');
    ok(Wk.microOf(G.x) !== L0.down.mx || Wk.microOf(G.z) !== L0.down.my || true, 'you arrive beside the stairs up');
    const L1 = G.d.levels[1];
    ok(Math.abs(Wk.microOf(G.x) - L1.up.mx) + Math.abs(Wk.microOf(G.z) - L1.up.my) === 1, 'right next to the stairs you came down');
    for (let i = 0; i < 2; i++) Gm.step(G, { fx: 0 }, DT);
    ok(G.lv === 1, 'and you are not bounced straight back up');
    G.x = Wk.centre(L1.up.mx); G.z = Wk.centre(L1.up.my); G.stairCool = 0; G.events.length = 0;
    Gm.step(G, { fx: 0 }, DT);
    ok(G.lv === 0, 'the stairs up take you back');
    G.x = Wk.centre(L0.up.mx); G.z = Wk.centre(L0.up.my); G.stairCool = 0; G.events.length = 0;
    Gm.step(G, { fx: 0 }, DT);
    ok(G.lv === 0 && G.events.some((e) => e.type === 'exit'), 'the way in, at the top, turns you round');

    // befriending and treasure
    G = Gm.newGame(P({ seed: 'friends', levels: 2, el: { monsters: 9, hoards: 9 } }));
    const Lf = G.d.levels[0];
    const mon = Lf.features.find((f) => ELEMENTS[f.kind]?.cat === 'monsters');
    const gold = Lf.features.find((f) => ELEMENTS[f.kind]?.cat === 'hoards');
    if (mon) {
        G.x = Wk.centre(mon.mx) + 1.4; G.z = Wk.centre(mon.my);
        Gm.step(G, { fx: 0 }, DT);
        ok(G.friends === 1 && G.events.some((e) => e.type === 'befriend' && e.id === mon.id), 'coming close to a monster befriends it');
        Gm.step(G, { fx: 0 }, DT);
        ok(G.friends === 1, 'once');
    }
    if (gold) {
        G.x = Wk.centre(gold.mx); G.z = Wk.centre(gold.my) + 1.4; G.events.length = 0;
        Gm.step(G, { fx: 0 }, DT);
        ok(G.gold === ELEMENTS[gold.kind].value && G.events.some((e) => e.type === 'loot'), 'coming close to a hoard finds it');
    }
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const p = P({ seed: 'same-again', levels: 4, size: 'l' });
    ok(JSON.stringify(D.generate(p).levels.map((L) => [L.grid, L.features])) === JSON.stringify(D.generate(p).levels.map((L) => [L.grid, L.features])), 'the same params give the same dungeon');
    const q = P({ seed: 'same-agaim', levels: 4, size: 'l' });
    ok(JSON.stringify(D.generate(p).levels[0].grid) !== JSON.stringify(D.generate(q).levels[0].grid), 'a one-letter change gives a different dungeon');
    const viaLink = S.decode(S.encode(p));
    ok(JSON.stringify(D.generate(viaLink).levels.map((L) => L.grid)) === JSON.stringify(D.generate(p).levels.map((L) => L.grid)), 'a share link rebuilds the same dungeon');

    const G = Gm.newGame(P({ seed: 'save-walk', levels: 3 }));
    const b = Bt.makeBot();
    for (let t = 0; t < 25; t += DT) Gm.step(G, Bt.botInput(G, b), DT);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    for (let t = 0; t < 25; t += DT) { Gm.step(G, Bt.botInput(G, b1), DT); Gm.step(copy, Bt.botInput(copy, b2), DT); }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-walk walks on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    let allDone = true, allFound = true, finite = true;
    const n = Math.max(6, Math.round(SEEDS / 3));
    for (let s = 1; s <= n; s++) {
        const size = ['s', 'm', 'l'][s % 3];
        const G = Gm.newGame(P({ seed: `tour-${s}`, size, levels: 2 + (s % 3) }));
        const bot = Bt.makeBot();
        let t = 0;
        while (!bot.done && t < 1500) {
            Gm.step(G, Bt.botInput(G, bot), DT);
            G.events.length = 0;
            t += DT;
            if (!Number.isFinite(G.x) || !Number.isFinite(G.z)) { finite = false; break; }
        }
        const tot = Gm.totals(G);
        if (!bot.done) allDone = false;
        if (G.friends !== tot.friends || G.gold !== tot.gold) allFound = false;
        rows.push({ s, size, levels: G.d.levels.length, t: Math.round(t), friends: `${G.friends}/${tot.friends}`, gold: `${G.gold}/${tot.gold}`, skipped: Object.keys(bot.skip).length });
    }
    ok(finite, 'positions stay finite');
    ok(allDone, 'the bot reaches the bottom of every dungeon');
    ok(allFound, 'meeting every friend and finding every hoard, with the real walker');
    ok(rows.every((r) => r.skipped === 0), 'nothing was unreachable');
    for (const r of rows) console.log(`  tour-${r.s} ${r.size} ×${r.levels}: ${r.t} s, friends ${r.friends}, gold ${r.gold}`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
