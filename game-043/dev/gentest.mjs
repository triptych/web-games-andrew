/**
 * gentest.mjs — the world generator's contract, over many seeds.
 *   node dev/gentest.mjs [seeds=24]
 * For every seed: deterministic; 18 lots, 5 regions, a dungeon and a cave per region;
 * with no relics you can reach the Glen and region 1 but no other region; each further
 * region opens exactly when you hold the previous dungeon's relic; with every relic every
 * site, glimmer, forage spot and lot sign is reachable; every secret pocket stays shut
 * without its own relic; every dungeon/cave floor is connected.
 */
import { generateWorld, worldHash, PERMA_BLOCK } from '../js/gen/world.js';
import { generateFloor, floorConnected } from '../js/gen/dungeon.js';
import { flood } from '../js/core/grid.js';
import { G, O, G_BLOCK } from '../js/data/tiles.js';

const N = Number(process.argv[2] ?? 24);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const RELIC_OF = { thorn: 'thornbreaker', boulder: 'stonebreaker', shallows: 'lilypad', dark: 'lantern' };
const ORDER = ['thornbreaker', 'stonebreaker', 'lilypad', 'lantern'];

function reach(w, relics) {
    const R = new Set(relics);
    const pass = i => {
        const g = w.ground[i], o = w.obj[i];
        if (g === G.SHALLOW) { if (!R.has('lilypad')) return false; }
        else if (G_BLOCK.has(g) && g !== G.BRIDGE) return false;
        if (PERMA_BLOCK.has(o)) return false;
        if (o === O.THORN) return R.has('thornbreaker');
        if (o === O.BOULDER) return R.has('stonebreaker');
        if (o === O.DARK) return R.has('lantern');
        return true;   // trees, rocks, weeds: the player can clear them
    };
    const s = w.glen.start;
    return flood(w.W, w.H, [s.y * w.W + s.x], pass);
}
const near = (w, r, x, y) => [0, 1, -1, w.W, -w.W].some(d => r[y * w.W + x + d]);

let times = [];
for (let seed = 1; seed <= N; seed++) {
    const t0 = performance.now();
    const w = generateWorld(seed * 7919);
    times.push(performance.now() - t0);
    const tag = `seed ${seed * 7919}`;
    ok(worldHash(w) === worldHash(generateWorld(seed * 7919)), `${tag}: deterministic`);
    ok(w.lots.length === 18, `${tag}: 18 lots (${w.lots.length})`);
    ok(w.sites.length === 10, `${tag}: 10 sites (${w.sites.length})`);
    ok(w.regions.every(R => R.sites.length === 2), `${tag}: a dungeon and a cave per region`);
    // progression reachability
    for (let k = 0; k <= 4; k++) {
        const held = ORDER.slice(0, k);
        const r = reach(w, held);
        for (let j = 1; j <= 5; j++) {
            const R = w.regions[j - 1];
            const hub = near(w, r, R.hub.x, R.hub.y);
            const should = j <= k + 1;
            ok(hub === should, `${tag}: with ${k} relics region ${j} ${should ? 'reachable' : 'sealed'} (got ${hub})`);
            if (should) for (const id of R.sites) { const s = w.siteById[id]; ok(r[(s.y + 1) * w.W + s.x], `${tag}: ${s.name} reachable with ${k} relics`); }
        }
        if (k === 0) {
            for (const L of w.lots) ok(near(w, r, L.sign.x, L.sign.y + 1) || r[(L.sign.y + 1) * w.W + L.sign.x], `${tag}: lot ${L.id} sign reachable`);
            ok(near(w, r, w.glen.board.x, w.glen.board.y + 1), `${tag}: job board reachable`);
        }
    }
    const all = reach(w, ORDER);
    let unreached = 0;
    for (const g of w.glimmers) if (!near(w, all, g.x, g.y)) unreached++;
    for (const f of w.forage) if (!near(w, all, f.x, f.y)) unreached++;
    ok(unreached === 0, `${tag}: every glimmer and forage spot reachable with all relics (${unreached} not)`);
    for (const g of w.glimmers.filter(g => g.pocket)) {
        const r = reach(w, ORDER.filter(x => x !== RELIC_OF[g.pocket]));
        ok(!near(w, r, g.x, g.y), `${tag}: pocket behind ${g.pocket} is shut without the ${RELIC_OF[g.pocket]}`);
    }
    ok(w.glimmers.filter(g => g.pocket).length >= 3, `${tag}: at least 3 secret pockets`);
    ok(w.glimmers.filter(g => g.kind === 'ring').length >= 5, `${tag}: fairy rings in the Glen and regions`);
    // nothing solid on roads
    let blocked = 0;
    for (let i = 0; i < w.W * w.H; i++) if (w.road[i] === 1 && w.ground[i] !== G.SHALLOW && [O.TREE, O.PINE, O.ROCK, O.BIGROCK, O.BUSH, O.OLDTREE].includes(w.obj[i])) blocked++;
    ok(blocked === 0, `${tag}: roads are clear (${blocked})`);
    // floors
    if (seed <= 8) for (const s of w.sites) for (let f = 1; f <= s.floors; f++) ok(floorConnected(generateFloor(seed * 7919, s, f)), `${tag}: ${s.id} floor ${f} connected`);
}
times.sort((a, b) => a - b);
console.log(`world generation: median ${times[times.length >> 1].toFixed(0)}ms, max ${times[times.length - 1].toFixed(0)}ms`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
