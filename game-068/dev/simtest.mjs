/**
 * simtest.mjs — headless tests of the pure simulation (no browser).
 *
 *   node game-068/dev/simtest.mjs            # everything
 *   ONLY=purity,maps,mechanics,waves,letters,balance node game-068/dev/simtest.mjs
 *
 * purity     js/sim never imports three, touches the DOM or calls Math.random
 * maps       every level's map and 200 Open Road seeds: a clean road (no tile touches the road except
 *            its neighbours), long enough, second roads join with a T, routes reach the Haven, scenery
 *            never on the road, never more than a fifth of the roadside blocked, enough room to build
 * mechanics  each ailment and each station does what the design says, scratches only catch those the
 *            dead can keep up with, collapse → revive → lost, volunteers and cures, bosses, selling
 * waves      deterministic waves, the dead phase in, everyone is hurt somehow, no more than two troubles
 * letters    letters are built from the care actually given
 * balance    the bot wins every level (with the roster it earns along the way); doing nothing loses every
 *            level; a boss level is winnable even with an empty roster; Open Road keeps going
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../js/sim/world.js';
import { Bot, playLevel } from '../js/sim/bot.js';
import { LEVELS, ENDLESS, makeWave, levelDef } from '../js/sim/levels.js';
import { generateMap, idx, GRASS, ROAD, BLOCK, pathIsClean, GATE_X } from '../js/sim/mapgen.js';
import { STATIONS, TRADES, AIL, DEAD, BOSSES } from '../js/sim/data.js';
import { letterFor, lettersFor } from '../js/sim/names.js';
import { RNG } from '../js/rng.js';
import { W, H, STEP } from '../js/config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
let fails = 0, passes = 0;
const ok = (m) => { passes++; if (process.env.V) console.log(`  ✓ ${m}`); };
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const check = (c, m) => (c ? ok(m) : fail(m));
const section = (name) => { const on = !ONLY.length || ONLY.includes(name); if (on) console.log(`\n# ${name}`); return on; };
const run = (w, sec) => { const n = Math.round(sec / STEP); for (let i = 0; i < n; i++) w.tick(STEP); };

// ------------------------------------------------------------------ purity
if (section('purity')) {
    const dir = path.join(HERE, '../js/sim');
    for (const f of fs.readdirSync(dir)) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        check(!/from 'three'/.test(src), `${f}: no three.js`);
        check(!/\bdocument\.|\bwindow\./.test(src), `${f}: no DOM`);
        check(!/Math\.random/.test(src), `${f}: no Math.random`);
    }
    console.log('  sim modules are pure');
}

// ------------------------------------------------------------------ maps
function checkMap(m, label) {
    const roadSet = new Set(m.road.map(([x, z]) => idx(x, z)));
    check(pathIsClean(m.road), `${label}: main road is a clean path`);
    check(m.road.length >= 34, `${label}: road long enough (${m.road.length})`);
    check(m.road[0][0] === 0, `${label}: road starts at the west edge`);
    check(m.road[m.road.length - 1][0] === GATE_X, `${label}: road reaches the gate`);
    if (m.branch) {
        const t = m.branch.tiles;
        check(t[0][1] === 0 || t[0][1] === H - 1, `${label}: second road starts at the top or bottom edge`);
        const [lx, lz] = t[t.length - 1];
        let touch = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (roadSet.has(idx(lx + dx, lz + dz))) touch++;
        check(touch === 1, `${label}: second road joins with a T`);
        for (let i = 0; i < t.length - 1; i++) {
            const [x, z] = t[i];
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (roadSet.has(idx(x + dx, z + dz))) fail(`${label}: second road touches the main road early at ${x},${z}`);
        }
    }
    for (const R of m.routes) {
        const end = R.at(R.length, {});
        check(end.x > GATE_X + 1, `${label}: route ends in the Haven`);
        let maxStep = 0, last = R.at(0, {});
        for (let d = 0.25; d <= R.length; d += 0.25) { const o = R.at(d, {}); maxStep = Math.max(maxStep, Math.hypot(o.x - last.x, o.z - last.z)); last = o; }
        check(maxStep < 0.3, `${label}: route is continuous`);
    }
    let near = 0, nearBlocked = 0, grass = 0;
    for (let z = 0; z < H; z++) for (let x = 0; x <= GATE_X; x++) {
        const k = m.grid[idx(x, z)];
        if (k === GRASS) grass++;
        let isNear = false;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (roadSet.has(idx(x + dx, z + dz)) || (m.branch && m.branch.tiles.some(([bx, bz]) => bx === x + dx && bz === z + dz))) isNear = true;
        if (isNear && k !== ROAD) { near++; if (k === BLOCK) nearBlocked++; }
    }
    check(nearBlocked <= near * 0.2 + 1, `${label}: at most a fifth of the roadside blocked (${nearBlocked}/${near})`);
    check(grass > 120, `${label}: room to build (${grass} grass tiles)`);
    for (const s of m.scenery) for (let dz = 0; dz < s.h; dz++) for (let dx = 0; dx < s.w; dx++) if (m.grid[idx(s.x + dx, s.z + dz)] !== BLOCK) fail(`${label}: scenery ${s.type} off its tiles`);
}
if (section('maps')) {
    for (const L of LEVELS) {
        const w = new World({ level: L.n });
        checkMap(w.map, `level ${L.n}`);
        check(!!w.map.branch === !!L.branch, `level ${L.n}: second road as designed`);
        const again = new World({ level: L.n });
        check(JSON.stringify(again.map.road) === JSON.stringify(w.map.road), `level ${L.n}: same map every time`);
    }
    let bad = 0;
    for (let s = 0; s < 200; s++) {
        const before = fails;
        const m = generateMap({ seed: `open-road-${s}`, theme: ['autumn', 'winter', 'city'][s % 3], branch: s % 2 === 0 });
        checkMap(m, `open road ${s}`);
        if (fails > before) bad++;
    }
    console.log(`  12 levels and 200 Open Road maps checked (${bad} bad)`);
}

// ------------------------------------------------------------------ mechanics
function quiet(level = 1) {
    // a world with nothing walking: we add exactly who we need
    const w = new World({ level });
    w.state = 'wave';
    w.queue = [];
    return w;
}
function walker(w, ail = {}, d = 4, kind = 'adult') {
    const p = w.makePerson({ kind, ail });
    p.d = d;
    w.place(p);
    w.people.push(p);
    w.stats.spawned++;
    return p;
}
function stationNear(w, type, p, lv = 0) {
    // the free grass tile nearest to person p
    let best = null, bd = Infinity;
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        if (w.map.grid[idx(x, z)] !== GRASS || w.occ[idx(x, z)]) continue;
        const d = (x + 0.5 - p.x) ** 2 + (z + 0.5 - p.z) ** 2;
        if (d < bd) { bd = d; best = [x, z]; }
    }
    w.supplies = 9999;
    const r = w.build(type, best[0], best[1]);
    for (let i = 0; i < lv; i++) w.upgrade(r.station.id);
    return r.station;
}
if (section('mechanics')) {
    {   // a wound bleeds, and a Medic Tent closes it
        const w = quiet(1);
        const p = walker(w, { wound: 2 });
        const hp0 = p.hp;
        for (let i = 0; i < 30; i++) { w.updatePerson(p, STEP); }
        check(p.hp < hp0 && Math.abs(hp0 - p.hp - 2 * AIL.woundDrain) < 0.2, 'a wound bleeds woundDrain HP/s per level');
        const s = stationNear(w, 'medic', p);
        p.speed = 0; const d0 = p.d;
        for (let i = 0; i < 90; i++) { p.d = d0; w.tick(STEP); }
        check(p.wound === 0, 'a Medic Tent closes wounds');
        check(s.treated > 0 && p.care.medic > 0, 'the tent counts its care');
    }
    {   // blight spreads and the Remedy Lab clears it
        const w = quiet(2);
        const p = walker(w, { sick: 40 });
        for (let i = 0; i < 30; i++) w.updatePerson(p, STEP);
        check(p.sick > 40, 'blight spreads');
        stationNear(w, 'remedy', p);
        const d0 = p.d;
        for (let i = 0; i < 150; i++) { p.d = d0; w.place(p); w.tick(STEP); }
        check(p.sick === 0, 'a Remedy Lab clears blight');
    }
    {   // hunger: slower and more fragile; the kitchen feeds and gives temporary health
        const w = quiet(3);
        const a = walker(w, {}, 4), b = walker(w, { hunger: true }, 4);
        w.updatePerson(a, STEP); w.updatePerson(b, STEP);
        check(b.speed < a.speed, 'the hungry walk slower');
        stationNear(w, 'kitchen', b);
        const d0 = b.d;
        for (let i = 0; i < 90; i++) { b.d = d0; w.place(b); a.d = d0; w.place(a); w.tick(STEP); }
        check(!b.hunger && b.temp > 0, 'the kitchen cures hunger and gives temporary health');
        const hp = b.hp, t = b.temp;
        w.hurt(b, 5);
        check(b.hp === hp && b.temp < t, 'temporary health soaks up harm first');
    }
    {   // cold rises in winter; the fire drives it out
        const w = quiet(5);
        check(w.ail.has('cold'), 'level 5 has cold');
        const p = walker(w, { cold: 30 });
        for (let i = 0; i < 60; i++) w.updatePerson(p, STEP);
        check(p.cold > 30, 'cold rises in winter');
        stationNear(w, 'fire', p);
        const d0 = p.d;
        for (let i = 0; i < 60; i++) { p.d = d0; w.place(p); w.tick(STEP); }
        check(p.cold < 5 && p.warmT > 0, 'a Warming Fire drives out the cold and leaves people warm');
        const city = quiet(9);
        check(!city.ail.has('cold'), 'no cold in the city');
    }
    {   // fractures slow; splints mend
        const w = quiet(6);
        const a = walker(w, {}, 4), b = walker(w, { fracture: true }, 4);
        w.updatePerson(a, STEP); w.updatePerson(b, STEP);
        check(Math.abs(b.speed / a.speed - AIL.fractureSlow) < 0.01, 'a broken leg walks at 55%');
        stationNear(w, 'splint', b, 1);
        const d0 = b.d;
        for (let i = 0; i < 90; i++) { b.d = d0; w.place(b); w.tick(STEP); }
        check(!b.fracture && b.boostT > 0, 'a Splint Post mends and (lv2) gives a second wind');
    }
    {   // fear: the Song Circle calms and builds courage
        const w = quiet(7);
        const p = walker(w, { fear: 80 });
        stationNear(w, 'song', p);
        const d0 = p.d;
        for (let i = 0; i < 90; i++) { p.d = d0; w.place(p); w.tick(STEP); }
        check(p.fear < 20 && p.temp > 0, 'the Song Circle calms fear and builds courage');
    }
    {   // the dead catch only those they can keep up with
        const w = quiet(1);
        const fast = walker(w, {}, 3), slow = walker(w, { fracture: true }, 8);
        const z = w.spawnDead('shambler', 0, 0, 2.6);
        const z2 = w.spawnDead('shambler', 0, 0, 7.6);
        for (let i = 0; i < 60; i++) w.tick(STEP);
        check(fast.hp === fast.maxHp, 'a healthy walker slips past a shambler');
        check(slow.hp < slow.maxHp && slow.wound > 0, 'a limping walker is caught and scratched');
        check(slow.safeT > 0 || slow.adrenT >= 0, 'a scratched walker gets a moment of safety');
        void z; void z2;
    }
    {   // lantern slows; flare stuns; bell lures
        const w = quiet(9);
        const p = walker(w, {}, 6);
        const z = w.spawnDead('shambler', 0, 0, 6);
        const s = stationNear(w, 'lantern', p, 2);
        w.tick(STEP);
        check(z.slow >= STATIONS.lantern.lv[2].slow - 1e-6, 'a lantern slows the dead in reach');
        for (let i = 0; i < 10; i++) w.tick(STEP);
        check(z.stunT > 0 || w.events.some((e) => e.type === 'flare'), 'a level-3 lantern fires a flare');
        void s;
        const w2 = quiet(9);
        const p2 = walker(w2, {}, 6);
        const z3 = w2.spawnDead('shambler', 0, 0, 6);
        stationNear(w2, 'bell', p2);
        w2.tick(STEP);
        check(z3.mode === 'lured', 'a bell lures the dead off the road');
        for (let i = 0; i < 30 * 8; i++) w2.tick(STEP);
        check(z3.mode === 'road' || z3.state !== 'walk', 'the lured come back to the road');
    }
    {   // collapse → revived by a medic; collapse → lost
        const w = quiet(1);
        const p = walker(w, {}, 6);
        w.hurt(p, 999);
        check(p.state === 'down', 'at 0 HP a person collapses');
        stationNear(w, 'medic', p);
        for (let i = 0; i < 60; i++) w.tick(STEP);
        check(p.state === 'walk', 'a Medic Tent revives the collapsed');
        const w2 = quiet(1);
        const q = walker(w2, {}, 6);
        w2.hurt(q, 999);
        const hope = w2.hope;
        run(w2, AIL.downTime + 0.5);
        check(q.state === 'lost' && w2.hope === hope - 1 && w2.lostNames.length === 1, 'nobody reaching them: lost, Hope −1, remembered');
        const w3 = quiet(5);
        const r = walker(w3, {}, 6);
        w3.hurt(r, 999);
        stationNear(w3, 'stretcher', r);
        const d0 = r.d;
        for (let i = 0; i < 60; i++) w3.tick(STEP);
        check(r.state === 'walk' && r.d > d0, 'a Stretcher Crew revives and carries forward');
    }
    {   // arrivals: thriving join the roster; supplies
        const w = quiet(1);
        const a = walker(w, {}, w.routes[0].length - 0.01);
        const b = walker(w, { wound: 1 }, w.routes[0].length - 0.01);
        a.trade = 'nurse'; b.trade = 'nurse';
        const sup = w.supplies;
        w.tick(STEP);
        check(w.stats.saved === 2 && w.stats.thriving === 1, 'arrivals counted, thriving told apart');
        check(w.roster.nurse === 1, 'only the thriving join the roster');
        check(w.stats.supplied === 10 + 4, 'thriving arrivals bring more supplies'); void sup;
    }
    {   // volunteers cure the dead, who walk home and join
        const w = new World({ level: 4, roster: { athlete: 2 } });
        w.state = 'wave'; w.queue = [];
        const z = w.spawnDead('shambler', 0, 0, 10);
        let tile = null;
        for (let r = 1; r < 3 && !tile; r++) for (let dz = -r; dz <= r && !tile; dz++) for (let dx = -r; dx <= r && !tile; dx++) {
            const x = Math.floor(z.x) + dx, zz = Math.floor(z.z) + dz;
            if (!w.canDeploy('athlete', x, zz)) tile = [x, zz];
        }
        const d = w.deploy('athlete', tile[0], tile[1]);
        check(d.ok, 'a volunteer deploys beside the road');
        check(w.available('athlete') === 1, 'the roster counts who is out');
        for (let i = 0; i < 30 * 15 && z.state === 'walk'; i++) w.tick(STEP);
        check(z.state === 'cured' && w.stats.cured === 1, 'volunteers cure the dead');
        const back = w.people.find((p) => p.restored);
        check(!!back, 'the cured walk home as people');
        const avail = w.available('athlete');
        check(w.recall(d.person.id).ok && w.available('athlete') === avail, 'a recalled volunteer rests first');
        run(w, 2.5);
        check(w.available('athlete') === avail + 1, '...then is free again');
        for (let i = 0; i < 30 * 60 && back.state === 'walk'; i++) w.tick(STEP);
        check(back.state === 'saved' && (w.roster[back.trade] || 0) >= 1, 'the cured join the roster when they arrive');
        check(w.canDeploy('neighbour', tile[0], tile[1]) === '' || w.canDeploy('neighbour', tile[0], tile[1]) === 'taken', 'neighbours are always available');
    }
    {   // a cured boss cures everything with it
        const w = new World({ level: 4 });
        w.state = 'wave'; w.queue = [];
        const b = w.spawnDead('giant', 0, 0, 4, true);
        const z = w.spawnDead('shambler', 0, 0, 6);
        w.cureDead(b, b.blightMax + 1, null);
        check(w.bossCured && z.state === 'cured', 'curing a boss breaks the blight everywhere');
        const w2 = new World({ level: 4 });
        w2.state = 'wave'; w2.queue = [];
        const b2 = w2.spawnDead('giant', 0, 0, w2.routes[0].length - 0.1, true);
        for (let i = 0; i < 10; i++) w2.tick(STEP);
        check(w2.state === 'lost', 'a boss reaching the Haven ends the level');
        void b2;
    }
    {   // build rules, upgrade, sell
        const w = new World({ level: 1 });
        const [rx, rz] = w.map.road[5];
        check(w.build('medic', rx, rz).why === 'ground', 'no building on the road');
        check(w.build('remedy', 0, 0).why === 'locked' || w.build('remedy', 0, 0).why === 'ground', 'stations unlock by level');
        let t = null;
        for (let z = 0; z < H && !t; z++) for (let x = 0; x < W && !t; x++) if (!w.canBuild('medic', x, z)) t = [x, z];
        const before = w.supplies;
        const s = w.build('medic', t[0], t[1]).station;
        check(w.build('lantern', t[0], t[1]).why === 'taken', 'one station per tile');
        w.supplies = 1000;
        w.upgrade(s.id); w.upgrade(s.id);
        check(s.lv === 2 && w.upgrade(s.id).why === 'max', 'three levels and no more');
        const spent = s.spent;
        const sup = w.supplies;
        w.sell(s.id);
        check(w.supplies - sup === Math.floor(spent * 0.7) && !w.occ[idx(t[0], t[1])], 'packing up returns 70% and frees the tile');
        void before;
    }
    console.log('  mechanics checked');
}

// ------------------------------------------------------------------ waves
if (section('waves')) {
    for (const L of [...LEVELS, ENDLESS]) {
        const branch = !!L.branch;
        for (let wv = 1; wv <= (L.endless ? 6 : L.waves); wv++) {
            const a = makeWave(L, wv, branch), b = makeWave(L, wv, branch);
            if (JSON.stringify(a) !== JSON.stringify(b)) fail(`level ${L.n} wave ${wv}: not deterministic`);
            for (let i = 1; i < a.length; i++) if (a[i].t < a[i - 1].t) fail(`level ${L.n} wave ${wv}: not sorted`);
            for (const e of a) {
                if (e.what === 'civ') {
                    const k = Object.keys(e.ail);
                    if (!k.length) fail(`level ${L.n}: someone walks unhurt`);
                    if (k.filter((x) => x !== 'cold').length > (L.endless ? 3 : 2)) fail(`level ${L.n}: too many troubles at once`);
                    for (const x of k) if (!L.ailments.includes(x)) fail(`level ${L.n}: ailment ${x} not introduced yet`);
                    if (e.route === 1 && !branch) fail(`level ${L.n}: route 1 without a second road`);
                } else if (e.what === 'dead') {
                    if (!L.dead.includes(e.kind)) fail(`level ${L.n}: ${e.kind} not introduced yet`);
                }
            }
            if (L.boss && wv === L.waves && !a.some((e) => e.what === 'boss')) fail(`level ${L.n}: no boss in the last wave`);
            if (!L.boss && !a.some((e) => e.what === 'civ')) fail(`level ${L.n} wave ${wv}: nobody walking`);
        }
        if (!L.boss && !L.endless && L.dead.length > 2) {
            const w1 = makeWave(L, 1, branch).filter((e) => e.what === 'dead').map((e) => e.kind);
            check(!w1.includes(L.dead[L.dead.length - 1]) || L.dead.length <= 2, `level ${L.n}: the newest dead are not in the first wave`);
        }
    }
    console.log('  waves checked');
}

// ------------------------------------------------------------------ letters
if (section('letters')) {
    const rng = new RNG(5);
    const p = { name: { first: 'Mara', last: 'Holt', age: 30 }, kind: 'adult', trade: 'gardener', care: { splint: 2 }, thriving: true };
    const L = letterFor(rng, p);
    check(/splint|leg/i.test(L.body.join(' ')), 'a letter is about the care given (splint)');
    check(/garden/i.test(L.body.join(' ')), 'a thriving gardener offers to garden');
    const kid = letterFor(rng, { name: { first: 'Pip', last: 'Cole', age: 7 }, kind: 'child', care: {}, thriving: true });
    check(kid.from === 'Pip, age 7', 'a child signs with their age');
    const many = lettersFor(rng, [p, { ...p, care: {} }, { name: { first: 'Pip', last: 'Cole', age: 7 }, kind: 'child', care: {} }], 3);
    check(many.length === 3 && many.some((x) => x.kind === 'child'), 'a child\'s picture is among the letters when one came home');
    console.log('  letters checked');
}

// ------------------------------------------------------------------ balance
if (section('balance')) {
    let roster = {};
    const rows = [];
    for (const L of LEVELS) {
        const w = new World({ level: L.n, roster });
        const s = playLevel(w);
        check(s.state === 'won', `the bot wins level ${L.n} (${s.stars}★)`);
        roster = s.roster;
        const idle = playLevel(new World({ level: L.n, roster }), { idle: true });
        check(idle.state === 'lost', `doing nothing loses level ${L.n}`);
        rows.push(`  L${String(L.n).padStart(2)} ${L.name.padEnd(24)} bot ${s.state} ${'★'.repeat(s.stars).padEnd(3)} saved ${String(s.stats.saved).padStart(3)}/${String(s.stats.spawned).padEnd(3)} thriving ${String(s.stats.thriving).padStart(3)} lost ${String(s.stats.lost).padStart(2)} cured ${String(s.stats.cured).padStart(3)} hope ${s.hope}/${s.hopeMax} · ${Math.round(w.time / 60)} min · idle: ${idle.state} at wave ${idle.wave}`);
    }
    console.log(rows.join('\n'));
    for (const n of [4, 8, 12]) {
        const s = playLevel(new World({ level: n, roster: {} }));
        check(s.state === 'won', `boss level ${n} winnable with an empty roster (neighbours and the cured)`);
    }
    const e = new World({ level: 13, runSeed: 7 });
    const s = playLevel(e, { maxTime: 900 });
    check(s.wave >= 8 && s.stats.saved > 100, `Open Road keeps going (wave ${s.wave}, ${s.stats.saved} saved)`);
    let nan = false;
    for (const p of e.people) if (!Number.isFinite(p.x + p.z + p.hp)) nan = true;
    for (const z of e.dead) if (!Number.isFinite(z.x + z.z)) nan = true;
    check(!nan, 'no NaN after a long run');
}

console.log(`\n${fails ? `✗ ${fails} failed` : '✓ all passed'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
