/**
 * gentest.mjs — the level generator's contract, checked with the real physics.
 *
 * For N save seeds x 25 levels:
 *   1. the exit (flag or boss arena) is reachable with the world's baseline gadgets
 *   2. route shard A and every non-gated pocket are reachable with the baseline
 *   3. every gated pocket is NOT reachable without its gadget, and IS with all gadgets
 *   4. enemies don't spawn inside terrain; the start is standable
 * Prints generation + validation cost.
 *
 *   node dev/gentest.mjs [seeds=6]
 */
import { generateLevel } from '../js/levelgen.js';
import { reach, cellReached } from '../js/validate.js';
import { baselineFor, GADGETS } from '../js/config.js';
import { T } from '../js/tiles.js';

const N = Number(process.argv[2] || 6);
const NEED = { high: 'boots', bubble: 'frost', shaft: 'mitts', red: 'rocket' };
let pass = 0, fail = 0;
const fails = {};
const ok = (c, m) => { if (c) pass++; else { fail++; fails[m.split(':')[0]] = (fails[m.split(':')[0]] || 0) + 1; if (fail < 40) console.log('  FAIL', m); } };
const times = [];
const attempts = [];

for (let s = 0; s < N; s++) {
    const seed = 1000 + s * 7919;
    for (let world = 1; world <= 5; world++) {
        for (let index = 1; index <= 5; index++) {
            const t0 = performance.now();
            const L = generateLevel(seed, world, index);
            times.push(performance.now() - t0);
            attempts.push(L.attempt);
            const tag = `${seed} ${world}-${index}`;
            ok(L.report.ok, `route: ${tag} ${L.report.fails.join(',')} (attempt ${L.attempt})`);
            const st = L.start;
            ok((L.tiles[st.y * L.w + st.x] === T.EMPTY || L.tiles[st.y * L.w + st.x] >= T.DECO_A) && L.tiles[(st.y + 1) * L.w + st.x] !== T.EMPTY, `start: ${tag}`);
            for (const e of L.entities) {
                if (e.t !== 'enemy' || e.kind === 'lavabub' || e.kind === 'chomper') continue;
                ok(L.tiles[e.y * L.w + e.x] === T.EMPTY || L.tiles[e.y * L.w + e.x] >= T.DECO_A, `enemy-in-wall: ${tag} ${e.kind} ${e.x},${e.y} tile ${L.tiles[e.y * L.w + e.x]}`);
            }
            // gated pockets
            const base = baselineFor(world);
            const gated = L.entities.filter(e => e.pocket && NEED[e.pocket] && !base.has(NEED[e.pocket]));
            if (gated.length) {
                const all = reach(L, GADGETS);
                for (const e of gated) {
                    const need = NEED[e.pocket];
                    const without = reach(L, GADGETS.filter(g => g !== need));
                    ok(!cellReached(L, without.visited, e.x, e.y), `leak: ${tag} ${e.pocket} reachable without ${need}`);
                    ok(cellReached(L, all.visited, e.x, e.y), `sealed: ${tag} ${e.pocket} unreachable even with everything`);
                }
            }
        }
    }
}
times.sort((a, b) => a - b);
console.log(`\n${pass} passed, ${fail} failed`, fails);
console.log(`generate+validate: median ${times[times.length >> 1].toFixed(0)}ms, p95 ${times[Math.floor(times.length * 0.95)].toFixed(0)}ms, max ${times[times.length - 1].toFixed(0)}ms`);
console.log(`re-rolls: ${attempts.filter(a => a > 0).length}/${attempts.length} levels needed one; max attempt ${Math.max(...attempts)}`);
process.exit(fail ? 1 : 0);
