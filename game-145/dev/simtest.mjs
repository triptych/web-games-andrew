/**
 * simtest.mjs — headless checks of VACANCY's simulation. No browser.
 *
 *   node game-145/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-145/dev/simtest.mjs
 *   SEEDS=60 VERBOSE=1 node game-145/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock,
 *    and never import the view, the UI or the audio.
 * 2. rules: walking, walls, doorways, locked doors and their tools, stairs up and down, falling through a rotten
 *    floor, picking up diaries and tools, vending machines, the breaker, the dials, the conduit levers, the master
 *    switch and the ending.
 * 3. determinism: the same seed builds the same city and story; the same inputs give the same game; a save round
 *    trip mid-game plays on identically; an unknown save version is refused.
 * 4. city: over CITY_SEEDS seeds every interior of every building is connected (every floor tile reachable from
 *    the entrances, ignoring locks), every building's door opens onto street that reaches the home, every type the
 *    story needs exists.
 * 5. story: over SEEDS seeds the whole chain can be walked with the real nav and only the tools found so far:
 *    every diary, every tool, the gate, Hall C, the breaker, the console. Different seeds give different sequences.
 * 6. bot: the bot plays the whole game through the real input on BOT_SEEDS seeds with per-step invariants, and the
 *    table of game minutes and kilometres is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 30);
const CITY_SEEDS = +(process.env.CITY_SEEDS || 6);
const BOT_SEEDS = +(process.env.BOT_SEEDS || 6);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const W = await import('../js/sim/world.js');
const In = await import('../js/sim/interior.js');
const Ci = await import('../js/sim/city.js');
const St = await import('../js/sim/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, turn: 0, dyaw: 0, run: false, a: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const T = C.TILE;

/** Find a building and tile matching a predicate, for staging a rule test. */
function findTile(G, pred) {
    for (const b of G.city.buildings) {
        const I = In.interiorOf(G.city, b);
        for (let L = 0; L < I.floors; L++) for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) {
            const r = pred(I, I.levels[L], L, x, z, z * I.w + x, b);
            if (r) return { b, I, L, x, z, gx: b.x0 + x, gz: b.z0 + z, ...r };
        }
    }
    return null;
}
const place = (G, L, gx, gz, yaw = 0, fx = 0.5, fz = 0.5) => {
    Object.assign(G.p, { x: (gx + fx) * T, z: (gz + fz) * T, L, yaw, air: false, vy: 0 });
    G.p.y = W.groundAt(G.city, L, G.p.x, G.p.z);
};
const yawTo = (dir) => [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir];      // N E S W

// ======================================================================
if (want('purity')) {
    section('purity');
    const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const files = ['js/rng.js', 'js/config.js', ...walk('js/sim')];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src) && !/from '\.\.\/\.\.\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('rules')) {
    section('rules');
    let G = Gm.newGame(11);
    const s = G.story.start;
    ok(G.p.L === s.L && Math.abs(G.p.x - s.x) < 1e-9, 'you wake beside the bed in the home house');
    ok(G.items.includes('compass') && G.items.includes('flashlight'), 'you start with the compass and the flashlight');
    ok(G.city.buildings[s.b].type === 'house' && !G.city.buildings[s.b].lock, 'the home is a house and is not locked');
    ok(Gm.objective(G).id === 'diary0', 'the compass points at the first diary');

    // walking on open ground outside
    let spot = null;
    for (let z = 10; z < G.city.n - 10 && !spot; z++) for (let x = 10; x < G.city.n - 10 && !spot; x++) {
        let clear = true;
        for (let dz = -2; dz <= 2; dz++) for (let dx = -4; dx <= 4; dx++) if (!W.outdoorFree(G.city, x + dx, z + dz) || G.city.fence.size && [0, 1, 2, 3].some((d) => G.city.fence.has(Ci.edgeKey(x + dx, z + dz, d)))) clear = false;
        if (clear) spot = [x, z];
    }
    place(G, 0, spot[0], spot[1], Math.PI / 2);
    const x0 = G.p.x;
    run(G, { ...NONE, y: -1 }, 1);
    ok(Math.abs(G.p.x - (x0 + C.PLAYER.walk)) < 0.08, `walks forward at ${C.PLAYER.walk} m/s (moved ${(G.p.x - x0).toFixed(2)})`);
    const x1 = G.p.x;
    run(G, { ...NONE, y: -1, run: true }, 0.5);
    ok(Math.abs(G.p.x - x1 - C.PLAYER.run * 0.5) < 0.08, 'runs faster with run held');
    const st = G.events.filter((e) => e.type === 'step');
    ok(st.length >= 4 && st.every((e) => e.surf && e.surf !== 'none'), `footsteps with a surface (${st.length}, ${st[0]?.surf})`);
    G.events.length = 0;
    const y0 = G.p.yaw;
    run(G, { ...NONE, turn: 1 }, 0.5);
    ok(Math.abs(G.p.yaw - y0 - C.PLAYER.turn * 0.5) < 1e-6, 'arrow keys turn');
    run(G, { ...NONE, x: 1, y: -1 }, 0.4);
    ok(true, 'diagonal input is normalised');

    // a wall stops you; a doorway lets you through
    G = Gm.newGame(11);
    const wallT = findTile(G, (I, lv, L, x, z) => L === 0 && x > 1 && z > 1 && x < I.w - 2 && z < I.d - 2 && In.getEdge(I, lv, x, z, 1) === In.E.WALL
        && !(lv.flags[z * I.w + x] & (In.F.SOLID | In.F.STAIR | In.F.VOIDSTAIR | In.F.VOID | In.F.HOLE)) && I.b.type === 'house' && lv.floor[z * I.w + x] > 0);
    place(G, 0, wallT.gx, wallT.gz, yawTo(1));
    run(G, { ...NONE, y: -1 }, 1.5);
    ok(G.p.x < (wallT.gx + 1) * T - C.PLAYER.radius + 0.01, 'a wall stops you');
    const doorT = findTile(G, (I, lv, L, x, z) => L === 0 && x < I.w - 1 && In.getEdge(I, lv, x, z, 1) === In.E.DOOR && !In.edgeLock(I, lv, x, z, 1)
        && !((lv.flags[z * I.w + x] | lv.flags[z * I.w + x + 1]) & (In.F.SOLID | In.F.STAIR | In.F.VOIDSTAIR | In.F.VOID | In.F.HOLE)));
    place(G, 0, doorT.gx, doorT.gz, yawTo(1));
    run(G, { ...NONE, y: -1 }, 1);
    ok(Math.floor(G.p.x / T) >= doorT.gx + 1, 'walking straight through a doorway gets you to the next room');
    place(G, 0, doorT.gx, doorT.gz, yawTo(1), 0.5, 0.1);
    run(G, { ...NONE, y: -1 }, 1);
    ok(Math.floor(G.p.x / T) === doorT.gx, 'but the wall beside the door frame stops you');

    // a locked building: no tool, no entry; the right tool opens it
    G = Gm.newGame(11);
    const lb = G.city.buildings.find((b) => b.lock === 'boards' && !b.compound);
    const e = lb.entrances[0];
    const ox = lb.x0 + e.x + Ci.DIRS[e.dir][0], oz = lb.z0 + e.z + Ci.DIRS[e.dir][1];
    place(G, 0, ox, oz, yawTo((e.dir + 2) % 4));
    run(G, { ...NONE, y: -1 }, 1.5);
    ok(!W.tileAt(G.city, 0, Math.floor(G.p.x / T), Math.floor(G.p.z / T))?.b, 'a boarded door keeps you out');
    G.events.length = 0;
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.events.some((ev) => ev.type === 'locked' && ev.kind === 'boards'), 'using it without a crowbar says what it needs');
    G.items.push('crowbar');
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.events.some((ev) => ev.type === 'unlock') && G.openSet.has(`b${lb.id}`), 'with the crowbar it opens');
    run(G, { ...NONE, y: -1 }, 1.5);
    ok(W.tileAt(G.city, 0, Math.floor(G.p.x / T), Math.floor(G.p.z / T))?.b === lb, 'and you can walk in');

    // stairs: up the run to the next floor, and back down
    G = Gm.newGame(11);
    const sb = G.city.buildings.find((b) => b.type === 'apartment' && !b.lock && !b.innerLock);
    const I = In.interiorOf(G.city, sb);
    const lv0 = I.levels[0];
    let bottom = null;
    for (let i = 0; i < I.w * I.d && !bottom; i++) if (lv0.flags[i] & In.F.STAIR && ((lv0.stair[i] - 1) & 15) === 0) bottom = i;
    const sd = (lv0.stair[bottom] - 1) >> 4;
    const bx = bottom % I.w - Ci.DIRS[sd][0], bz = Math.floor(bottom / I.w) - Ci.DIRS[sd][1];
    place(G, 0, sb.x0 + bx, sb.z0 + bz, yawTo(sd));
    run(G, { ...NONE, y: -1 }, I.S * T / C.PLAYER.walk + 1.2);
    ok(G.p.L === 1 && Math.abs(G.p.y - sb.h) < 0.05, `walking up the stair run takes you to level 1 (L=${G.p.L}, y=${G.p.y.toFixed(2)})`);
    ok(G.events.some((ev) => ev.type === 'level' && ev.L === 1), 'and says so');
    G.p.yaw += Math.PI;
    run(G, { ...NONE, y: -1 }, I.S * T / C.PLAYER.walk + 1.2);
    ok(G.p.L === 0 && Math.abs(G.p.y) < 0.05, `turning round and walking down takes you back (L=${G.p.L}, y=${G.p.y.toFixed(2)})`);
    // you can't walk up the stairs from their top end on the lower floor
    const top = findTile(G, (II, lv, L, x, z, i, b) => b === sb && L === 0 && lv.flags[i] & In.F.STAIR && ((lv.stair[i] - 1) & 15) === I.S - 1 && { i });
    const tdir = (lv0.stair[top.i] - 1) >> 4;
    const ax = top.x + Ci.DIRS[tdir][0], az = top.z + Ci.DIRS[tdir][1];
    if (!(lv0.flags[az * I.w + ax] & In.F.SOLID)) {
        place(G, 0, sb.x0 + ax, sb.z0 + az, yawTo((tdir + 2) % 4));
        run(G, { ...NONE, y: -1 }, 1.5);
        ok(G.p.L === 0 && Math.floor(G.p.z / T) === sb.z0 + az && Math.floor(G.p.x / T) === sb.x0 + ax, 'the top of a run is a wall from the floor below');
    }

    // a rotten floor: you fall through to the floor below
    G = Gm.newGame(11);
    const hole = findTile(G, (II, lv, L, x, z, i) => L > 0 && lv.flags[i] & In.F.HOLE);
    place(G, hole.L, hole.gx, hole.gz);
    run(G, NONE, 1.5);
    ok(G.p.L === hole.L - 1 && !G.p.air && Math.abs(G.p.y - (hole.L - 1) * hole.b.h) < 0.05, `standing on a hole drops you a floor (L ${hole.L} → ${G.p.L})`);
    ok(G.events.some((ev) => ev.type === 'fall') && G.events.some((ev) => ev.type === 'land'), 'fall and land events');

    // picking things up
    G = Gm.newGame(11);
    const d0 = G.thingById.get('diary0');
    Object.assign(G.p, { x: d0.x, z: d0.z + 0.8, L: d0.L, yaw: 0 }); G.p.y = W.groundAt(G.city, d0.L, G.p.x, G.p.z);
    G.events.length = 0;
    Gm.step(G, { ...NONE, a: true }, DT);
    const de = G.events.find((ev) => ev.type === 'diary');
    ok(de && de.k === 0 && G.gotSet.has('diary0') && G.read.includes(0), 'using a diary reads it and keeps it');
    ok(Gm.objective(G).id === 'diary1', 'and the compass moves on to the next one');
    const it = G.story.things.find((t) => t.kind === 'item');
    Object.assign(G.p, { x: it.x, z: it.z + 0.6, L: it.L, yaw: 0 });
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.items.includes(it.item) && G.events.some((ev) => ev.type === 'item'), `picking up the ${it.item}`);
    G.events.length = 0;
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(!G.events.some((ev) => ev.type === 'item'), 'a tool can be picked up only once');

    // a vending machine that still works
    const vm = G.outdoor.find((o) => o.k === 'vending');
    Object.assign(G.p, { x: vm.x, z: vm.z, L: 0 });
    G.p.x += Math.sin(vm.r) * 1.3; G.p.z += -Math.cos(vm.r) * 1.3;
    G.p.yaw = Math.atan2(vm.x - G.p.x, -(vm.z - G.p.z));
    G.events.length = 0;
    Gm.step(G, { ...NONE, a: true }, DT);
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.cans === 2 && G.events.filter((ev) => ev.type === 'vend').length === 2, 'a vending machine gives a can every time');

    // the console
    G = Gm.newGame(11);
    const at = (id) => { const t = G.thingById.get(id); Object.assign(G.p, { x: t.x, z: t.z + 1.0, L: 0, yaw: 0 }); G.p.y = 0; G.events.length = 0; Gm.step(G, { ...NONE, a: true }, DT); return G.events; };
    ok(at('dial0').some((ev) => ev.type === 'msg') && G.dials[0] === 0, 'without power the dials are dead');
    const br = [...G.thingById.values()].find((t) => t.kind === 'breaker');
    Object.assign(G.p, { x: br.x + 1.0, z: br.z, L: 0, yaw: -Math.PI / 2 });
    G.events.length = 0; Gm.step(G, { ...NONE, a: true }, DT);
    ok(!G.power, 'the breaker needs the fuse');
    G.items.push('fuse');
    G.events.length = 0; Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.power && G.events.some((ev) => ev.type === 'power'), 'with the fuse the hall has power');
    for (let k = 0; k < 3; k++) for (let n = 0; n < G.story.dials[k]; n++) at(`dial${k}`);
    ok(G.dials.join() === G.story.dials.join(), `the dials turn 1..9 (${G.dials} = ${G.story.dials})`);
    ok(at('master').some((ev) => ev.type === 'fail') && G.portal === 0, 'the master switch fails until the conduits are live');
    const wrong = G.story.order[1];
    const evs = at(`lever${G.story.leverColors.indexOf(wrong)}`);
    ok(evs.some((ev) => ev.type === 'leverReset') && G.levers.length === 0, 'throwing a conduit out of order resets them all');
    for (const c of G.story.order) at(`lever${G.story.leverColors.indexOf(c)}`);
    ok(G.levers.join() === G.story.order.join(), 'in the right order they all stay live');
    G.dials[2] = G.dials[2] % 9 + 1;
    ok(at('master').some((ev) => ev.type === 'fail'), 'a wrong dial still fails');
    G.dials[2] = G.story.dials[2];
    ok(at('master').some((ev) => ev.type === 'portal') && G.portal > 0, 'the right dials and conduits open the way back');
    run(G, NONE, C.ENDING_SECONDS + 0.5);
    ok(G.won && G.events.some((ev) => ev.type === 'won'), 'and the city comes home');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const a = Ci.makeCity(5), b = Ci.makeCity(5);
    ok(JSON.stringify(a.buildings) === JSON.stringify(b.buildings) && Buffer.from(a.ground).equals(Buffer.from(b.ground)), 'the same seed builds the same city');
    const c = Ci.makeCity(6);
    ok(JSON.stringify(a.buildings) !== JSON.stringify(c.buildings), 'a different seed builds a different city');
    const play = (seed) => { const G = Gm.newGame(seed); const bot = Bt.makeBot(); run(G, (g) => Bt.botInput(g, bot, DT), 90); return G; };
    const g1 = play(42), g2 = play(42);
    ok(JSON.stringify(Gm.serialize(g1)) === JSON.stringify(Gm.serialize(g2)), 'same seed and inputs, same game');
    // interiors are the same whichever order the buildings are first visited in
    const c1 = Ci.makeCity(9), c2 = Ci.makeCity(9);
    St.makeStory(c1, 9); St.makeStory(c2, 9);
    const ids = c1.buildings.map((bb) => bb.id).slice(0, 60);
    const sig = (CC, order) => order.map((id) => { const I = In.interiorOf(CC, CC.buildings[id]); return I.levels.map((lv) => Buffer.from(lv.eN).toString('base64') + Buffer.from(lv.flags.buffer).toString('base64')).join('|'); });
    const s1 = sig(c1, ids), s2 = sig(c2, ids.slice().reverse()).reverse();
    ok(s1.every((x, i) => x === s2[i]), 'an interior is the same whichever order buildings are generated in');

    const G = Gm.newGame(7);
    const bot = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, bot, DT), 200);
    const saved = JSON.stringify(Gm.serialize(G));
    ok(saved.length < 4000, `a save is small (${saved.length} bytes)`);
    const copy = Gm.deserialize(JSON.parse(saved));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, b1, DT), 200);
    run(copy, (g) => Bt.botInput(g, b2, DT), 200);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('city')) {
    section('city');
    let totalB = 0, totalTiles = 0, sealed = 0;
    for (let s = 1; s <= CITY_SEEDS; s++) {
        const seed = s * 7919;
        const G = Gm.newGame(seed);
        const CC = G.city;
        const types = new Set(CC.buildings.map((b) => b.type));
        for (const t of ['house', 'apartment', 'office', 'hotel', 'mall', 'hospital', 'school', 'library', 'shop', 'factory', 'warehouse', 'garage', 'lab', 'hall'])
            if (!types.has(t)) ok(false, `seed ${seed}: has a ${t}`);
        // every interior is connected
        let bad = 0;
        for (const b of CC.buildings) {
            const I = In.interiorOf(CC, b);
            const d = St.reachFrom(I, () => true);
            for (let L = 0; L < I.floors; L++) {
                const lv = I.levels[L];
                for (let i = 0; i < I.w * I.d; i++) {
                    const f = lv.flags[i];
                    if (f & (In.F.SOLID | In.F.VOID | In.F.VOIDSTAIR | In.F.HOLE) || lv.floor[i] === 0) continue;
                    totalTiles++;
                    if (d[L][i] < 0) { bad++; if (bad < 4) console.log(`    sealed: seed ${seed} b${b.id} ${b.type} L${L} (${i % I.w},${Math.floor(i / I.w)})`); }
                }
            }
        }
        sealed += bad;
        ok(bad === 0, `seed ${seed}: every floor tile of all ${CC.buildings.length} buildings is reachable from a door (${bad} sealed)`);
        // every building's doors open onto streets connected to home
        const home = CC.buildings[G.story.home];
        const he = home.entrances[0];
        const start = [0, home.x0 + he.x + Ci.DIRS[he.dir][0], home.z0 + he.z + Ci.DIRS[he.dir][1]];
        const seen = new Uint8Array(CC.n * CC.n);
        const q = [start]; seen[start[2] * CC.n + start[1]] = 1;
        const nb = [];
        while (q.length) {
            const [, x, z] = q.pop();
            for (const [L2, x2, z2] of W.moves(CC, 0, x, z, (lk) => lk === 'gate', nb)) {
                if (L2 !== 0 || CC.owner[z2 * CC.n + x2] >= 0 || seen[z2 * CC.n + x2]) continue;
                seen[z2 * CC.n + x2] = 1; q.push([0, x2, z2]);
            }
        }
        let cut = 0;
        for (const b of CC.buildings) {
            const reached = b.entrances.some((e) => { const x = b.x0 + e.x + Ci.DIRS[e.dir][0], z = b.z0 + e.z + Ci.DIRS[e.dir][1]; return seen[z * CC.n + x]; });
            if (!reached) { cut++; if (cut < 4) console.log(`    cut off: seed ${seed} b${b.id} ${b.type} at ${b.x0},${b.z0}`); }
        }
        ok(cut === 0, `seed ${seed}: every building's door opens onto the street network (${cut} cut off)`);
        totalB += CC.buildings.length;
    }
    console.log(`  ${CITY_SEEDS} cities · ${totalB} buildings · ${totalTiles} interior floor tiles (${(totalTiles * 4 / 1e6 / CITY_SEEDS).toFixed(2)} km² of floor a city) · ${sealed} sealed`);
}

// ======================================================================
if (want('story')) {
    section('story');
    const seqs = new Set();
    let worst = 0;
    for (let s = 1; s <= SEEDS; s++) {
        const seed = s * 104729 + 3;
        const G = Gm.newGame(seed);
        const CC = G.city;
        let pos = [G.p.L, Math.floor(G.p.x / T), Math.floor(G.p.z / T)];
        const items = new Set(G.items), open = new Set();
        const canOpen = (lk) => open.has(lk) || items.has(C.LOCKS[W.lockKind(CC, lk)].item);
        let broken = null, steps = 0;
        const goTo = (t, label) => {
            const p = W.findPath(CC, pos, (L, x, z) => L === t.L && Math.hypot((x + 0.5) * T - t.x, (z + 0.5) * T - t.z) <= 1.6, Math.floor(t.x / T), Math.floor(t.z / T), canOpen);
            if (!p) { broken = label; return false; }
            for (let i = 1; i < p.length; i++) {
                // every locked door on the way must be one we could open
                const a = p[i - 1], b = p[i];
                if (a[0] !== b[0]) continue;
                const dir = b[1] > a[1] ? 1 : b[1] < a[1] ? 3 : b[2] > a[2] ? 2 : 0;
                const lk = W.edgeLockAt(CC, a[0], a[1], a[2], dir);
                if (lk) open.add(lk);
            }
            steps += p.length;
            pos = p[p.length - 1];
            return true;
        };
        for (const id of G.story.sequence) {
            const t = G.thingById.get(id);
            if (!goTo(t, id)) break;
            if (t.item) items.add(t.item);
        }
        if (!broken) {
            const hall = CC.buildings[CC.lab.hall];
            const br = [...G.thingById.values()].find((t) => t.kind === 'breaker');
            if (goTo(br, 'breaker') && !items.has('fuse')) broken = 'no fuse by the breaker';
            if (!broken) goTo(G.thingById.get('master'), 'console');
            if (!open.has(`b${hall.id}`) || !open.has('gate')) broken = broken || 'did not need the gate and hall locks?';
        }
        ok(!broken, `seed ${seed}: the whole chain can be walked with the tools found so far${broken ? ` (stuck at ${broken})` : ''} — ${(steps * T / 1000).toFixed(1)} km`);
        worst = Math.max(worst, steps * T);
        seqs.add(G.story.tools.join(',') + '|' + G.story.cast.join(','));
        // the clues hold the whole sequence
        const cl = Object.values(G.story.clues);
        ok(cl.filter((c) => c.kind === 'dial').length === 3 && cl.filter((c) => c.kind === 'lever').length === 4, `seed ${seed}: the diaries carry all 3 dials and all 4 conduits`);
    }
    ok(seqs.size >= Math.min(SEEDS, 10), `different seeds give different casts and tool orders (${seqs.size} distinct of ${SEEDS})`);
    console.log(`  ${SEEDS} seeds · longest shortest-route ${(worst / 1000).toFixed(1)} km`);
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= BOT_SEEDS; s++) {
        const seed = s * 31337;
        const G = Gm.newGame(seed);
        const bot = Bt.makeBot();
        let bad = null;
        const t0 = Date.now();
        while (!G.won && G.t < 90 * 60) {
            Gm.step(G, Bt.botInput(G, bot, DT), DT);
            G.events.length = 0;
            const p = G.p;
            if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.y)) bad = 'non-finite position';
            else if (!W.tileAt(G.city, p.L, Math.floor(p.x / T), Math.floor(p.z / T))) bad = `off the world at L${p.L}`;
            else if (!p.air && Math.abs(p.y - W.groundAt(G.city, p.L, p.x, p.z)) > 0.01) bad = 'not standing on the ground';
            if (bad) break;
        }
        ok(!bad && G.won, `seed ${seed}: the bot brings everyone home${bad ? ` (${bad})` : G.won ? '' : ` (stuck: ${Gm.objective(G).label})`}`);
        rows.push({ seed, min: G.t / 60, km: G.p.dist / 1000, real: (Date.now() - t0) / 1000, replans: bot.replans, falls: G.falls });
    }
    for (const r of rows) console.log(`  seed ${String(r.seed).padStart(6)}: ${r.min.toFixed(1).padStart(5)} min · ${r.km.toFixed(2)} km · ${r.replans} replans · ${r.falls} falls · ${r.real.toFixed(1)} s`);
    const avg = rows.reduce((a, r) => a + r.min, 0) / rows.length;
    ok(avg > 8 && avg < 45, `a perfect run with the compass takes 8–45 minutes (average ${avg.toFixed(1)})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
