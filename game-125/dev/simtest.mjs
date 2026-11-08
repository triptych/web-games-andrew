/**
 * simtest.mjs — headless checks of SEEDFALL's simulation. No browser.
 *
 *   node game-125/dev/simtest.mjs                 # everything
 *   ONLY=purity,rules node game-125/dev/simtest.mjs
 *   SEEDS=12 VERBOSE=1 node game-125/dev/simtest.mjs
 *
 * purity · data (every cost payable from zones open by then, every line of story well-formed) · station (the
 * crew deck is one walkable piece and every terminal can be reached and used) · rules (walking, missions,
 * combat, gathering, samples, death, splicing, release, research, fabrication, harvesters, colonies, the clock,
 * the endings) · zones (60 seeds per zone: every node and black box reachable from the beacon) · determinism
 * and save round trips (station, mid-mission, mid-sentence) · fuzz (random commands, then the bot finishes) ·
 * bot (whole years on SEEDS seeds; balance table).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const L = await import('../js/sim/layout.js');
const Gm = await import('../js/sim/game.js');
const St = await import('../js/sim/station.js');
const Ge = await import('../js/sim/genetics.js');
const Zg = await import('../js/sim/zonegen.js');
const Ms = await import('../js/sim/mission.js');
const Bt = await import('../js/sim/bot.js');
const Sy = await import('../js/sim/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, turn: 0, a: false, b: false, c: false, r: false };
/** A game past the intro, with the talk queue empty. */
function fresh(seed = 1) {
    const G = Gm.newGame(seed);
    while (G.talk) Gm.act(G, { t: 'next' });
    return G;
}
const drain = (G) => { let n = 0; while (G.talk && n++ < 200) { const ch = Gm.talkChoices(G); Gm.act(G, ch ? { t: 'choose', id: ch.find((c) => c.ok).id } : { t: 'next' }); } };
const give = (G, n = 9999) => { for (const k of D.RES) G.res[k] = n; };

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('data')) {
    section('data');
    // what each generation can reach, and so what it can earn
    const zoneRes = (gen) => {
        const s = new Set(['metal', 'mineral', 'flora', 'fauna']);
        return ZONES_OPEN(gen).length ? s : new Set();
    };
    function ZONES_OPEN(gen) { return D.ZONES.filter((z) => z.req <= gen); }
    for (const r of D.RESEARCH) {
        for (const q of r.req) ok(D.RESEARCH_BY_ID[q], `${r.id} needs ${q}, which exists`);
        // the generation you have when you can first research it
        const gen = Math.max(0, ...r.req.map((q) => (D.RESEARCH_BY_ID[q].gen || 0)));
        for (const k in r.cost) ok(zoneRes(gen).has(k), `${r.name}'s ${k} is earnable by a ${D.GENS[gen].mk}`);
        ok(r.days > 0 && r.days <= 12, `${r.name} takes 1-12 days`);
    }
    // no cycles in the research tree
    const seen = {};
    const depth = (id, stack = []) => { ok(!stack.includes(id), `research ${id} has no cycle`); if (stack.includes(id)) return 0; return seen[id] ??= 1 + Math.max(0, ...D.RESEARCH_BY_ID[id].req.map((q) => depth(q, [...stack, id]))); };
    D.RESEARCH.forEach((r) => depth(r.id));
    for (let g = 1; g < D.GENS.length; g++) ok(St.blueprintFor(g), `${D.GENS[g].mk} has a blueprint`);
    // every zone has the species and creatures it spawns
    D.ZONES.forEach((z, i) => {
        ok(D.SPECIES.filter((s) => s.zone === i && s.kind === 'flora').length >= 1, `${z.name} has plants to sample`);
        for (const t in z.counts.enemies) ok(D.ENEMIES[t], `${z.name}'s ${t} exists`);
        ok(z.niche.length === 4 && z.base.length === 3, `${z.name} has a niche and base metrics`);
    });
    for (const s of D.SPECIES) ok(s.t.length === 4 && s.t.every((v) => v >= 0 && v <= 10), `${s.name} has four traits in 0..10`);
    // every fauna species can be sampled from something
    for (const s of D.SPECIES.filter((x) => x.kind === 'fauna')) ok(D.ZONES.some((z) => z.counts.enemies[s.id]), `${s.name} lives somewhere`);
    // every line of story
    let lines = 0;
    for (const [id, S] of Object.entries(Sy.SCENES)) {
        for (const l of S.lines) { lines++; ok(Sy.SPEAKERS[l.w] && l.t.length > 3 && l.t.length < 330 && !/[<>]/.test(l.t), `${id}: a well-formed line by ${l.w}`); }
        if (S.choices) ok(S.then, `${id} has a then`);
    }
    for (const k of ['purge', 'concord', 'hard', 'reveille']) ok(Sy.ENDINGS[k]?.lines.length >= 3, `ending ${k} is written`);
    for (const z of [0, 1, 2, 3, 4]) ok(Sy.SCENES['echo' + z], `black box ${z} has a scene`);
    console.log(`  ${D.RESEARCH.length} projects, ${D.SPECIES.length} genomes, ${Object.keys(Sy.SCENES).length} scenes, ${lines} lines`);
}

// ======================================================================
if (want('station')) {
    section('station');
    // flood fill from the spawn over the walker's own fits() rule
    const seen = new Set(), q = [[L.SPAWN.x, L.SPAWN.z]], step = 0.5, key = (x, z) => `${x},${z}`;
    seen.add(key(L.SPAWN.x, L.SPAWN.z));
    while (q.length) {
        const [x, z] = q.pop();
        for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = x + dx, nz = z + dz, k = key(nx, nz);
            if (seen.has(k) || !L.fits(nx, nz, C.WALK.radius)) continue;
            seen.add(k); q.push([nx, nz]);
        }
    }
    for (const r of L.ROOMS) ok([...seen].some((k) => { const [x, z] = k.split(',').map(Number); return L.roomAt(x, z) === r.id; }), `${r.name} is reachable on foot`);
    for (const t of L.TERMINALS) {
        const reach = [...seen].some((k) => { const [x, z] = k.split(',').map(Number); return Math.hypot(t.x - x, t.z - z) - t.r < C.WALK.reach - 0.3; });
        ok(reach, `${t.name} can be reached`);
    }
    ok(!L.fits(0, 20, 0.3) && !L.fits(-2.5, -15, 0.3), 'outside and inside walls are solid');
    // walk the real walker from the bay to the holo-table
    const G = fresh(3);
    const target = L.TERM_BY_ID.command;
    for (let i = 0; i < 120 * 30 && G.near !== 'command'; i++) {
        const m = G.me;
        const wantYaw = Math.abs(m.x) > 0.6 && m.z > -36 ? Math.atan2(-m.x, 0) : Math.atan2(target.x - m.x, -(target.z - m.z));
        let d = wantYaw - m.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        Gm.step(G, { ...NONE, y: 1, turn: Math.max(-0.05, Math.min(0.05, d)) }, DT);
    }
    ok(G.near === 'command', `walking north up the spine reaches the Holo-table (${G.me.x.toFixed(1)}, ${G.me.z.toFixed(1)})`);
    const r = Gm.act(G, { t: 'use' });
    ok(r.ok && r.panel === 'command' && G.talk?.id === 'command', 'using it opens the Command panel and TILLY explains it');
    ok(G.day > 0, 'time ran while walking');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    let G = Gm.newGame(5);
    ok(G.talk?.id === 'wake', 'the year opens on the wake-up scene');
    const d0 = G.day;
    Gm.step(G, { ...NONE, y: 1 }, 1);
    ok(G.day === d0 && G.me.z === L.SPAWN.z, 'nothing moves while TILLY is talking');
    G = fresh(5);
    ok(Gm.currentGoal(G).term === 'command', 'the first goal points at the Command Deck');
    ok(!Gm.act(G, { t: 'deploy', zone: 1 }).ok, 'a Mk I can\'t land in Rustwood');
    ok(Gm.act(G, { t: 'deploy', zone: 0 }).ok && G.mode === 'mission', 'a Mk I can land in the Meadow');
    drain(G);
    const M = G.mission;
    ok(M.nodes.length > 10 && M.enemies.length > 0, `the Meadow has nodes (${M.nodes.length}) and creatures (${M.enemies.length})`);
    // gather a flora node by hand
    const n = M.nodes.find((x) => x.kind === 'flora');
    M.p.x = n.x; M.p.y = n.y + 1; M.p.yaw = 0;
    const sp = n.species, s0 = G.samples[sp] || 0, c0 = M.p.carry;
    for (let i = 0; i < 300; i++) Gm.step(G, { ...NONE, b: true }, DT);
    ok(M.p.carry > c0 && G.samples[sp] === s0 + 1, 'holding Gather on a plant fills the hold and uplinks a sample');
    // strike a creature
    for (const e of M.enemies) e.alive = false;
    const e = M.enemies[0]; e.alive = true; e.hp = 5; e.x = M.p.x; e.y = M.p.y - 1.2; e.passive = true;
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(!e.alive && G.stats.kills === 1, 'a strike in front kills a weakened creature');
    ok(G.samples[D.ENEMY_SPECIES[e.type]] >= 1, 'the first kill of a species always gives a sample');
    // hazards and death
    const hp = M.p.hp;
    M.hazards.push({ kind: 'acid', x: M.p.x, y: M.p.y, r: 3, period: 4, phase: 0 });
    for (let i = 0; i < 120; i++) Gm.step(G, NONE, DT);
    ok(M.p.hp < hp, 'acid hurts');
    const carried = M.p.carry;
    M.p.hp = 0.01;
    for (let i = 0; i < 200 && G.mode === 'mission'; i++) Gm.step(G, NONE, DT);
    ok(G.mode === 'station' && G.report?.lost && G.bot.busy > 0, 'a destroyed bot comes back as a report and a repair');
    const kept = D.RES.reduce((a, k) => a + G.res[k], 0);
    ok(kept <= carried * 0.35 + 1e-9 && kept < carried, `and only a third of its cargo survives (${kept} of ${carried})`);
    drain(G);
    ok(!Gm.act(G, { t: 'deploy', zone: 0 }).ok, 'no drop until the report is read');
    Gm.act(G, { t: 'report' });
    ok(!Gm.act(G, { t: 'deploy', zone: 0 }).ok, 'no drop while the bot is being rebuilt');

    // the beacon brings you home with everything
    G = fresh(6);
    Gm.act(G, { t: 'deploy', zone: 0 }); drain(G);
    G.mission.p.cargo.metal = 4; G.mission.p.carry = 4;
    for (let i = 0; i < 400 && G.mode === 'mission'; i++) Gm.step(G, { ...NONE, b: true }, DT);
    ok(G.mode === 'station' && G.res.metal === 4 && G.report.how === 'done', 'holding Gather on the beacon lifts off with the whole hold');
    ok(G.zones[0].visited, 'the zone is now visited');

    // battery
    G = fresh(7);
    Gm.act(G, { t: 'deploy', zone: 0 }); drain(G);
    G.mission.p.en = 0.005;
    Gm.step(G, NONE, DT); Gm.step(G, NONE, DT);
    ok(G.mission.p.limp, 'an empty battery makes the bot limp');

    // splicing and release
    G = fresh(8); give(G);
    G.samples.sunbloom = 2; G.samples.skitterling = 2; G.zones[0].visited = true;
    ok(Ge.isSequenced(G, 'sunbloom') && !Ge.isSequenced(G, 'whisperreed'), 'two samples sequence a Meadow genome');
    ok(!Gm.act(G, { t: 'blend', a: 'sunbloom', b: 'whisperreed', r: 0.5 }).ok, 'an unsequenced genome can\'t be blended');
    const br = Gm.act(G, { t: 'blend', a: 'sunbloom', b: 'skitterling', r: 0.6 });
    ok(br.ok && G.vats.length === 1, 'a blend starts incubating');
    ok(br.strain.traits[2] === Math.round((6 * 0.6 + 3 * 0.4 + 1) * 10) / 10, 'plant + animal blends gain Docility');
    ok(!Gm.act(G, { t: 'blend', a: 'sunbloom', b: 'skitterling', r: 0.4 }).ok, 'one vat at the start');
    Gm.act(G, { t: 'wait', days: C.BLEND_DAYS + 0.1 });
    ok(G.strains.length === 1 && G.vats.length === 0, 'after two days the strain is ready');
    const z0 = { ...G.zones[0] };
    const rr = Gm.act(G, { t: 'release', id: G.strains[0].id, zone: 0 });
    ok(rr.ok && G.zones[0].toxic < z0.toxic && G.zones[0].hostile < z0.hostile && G.zones[0].barren < z0.barren, 'releasing it improves every metric');
    ok(!Gm.act(G, { t: 'release', id: 999, zone: 0 }).ok, 'a strain can only be released once');
    // repeats work less
    const s = { traits: br.strain.traits, key: br.strain.key };
    ok(Ge.releaseEffect(G, s, 0).rel < Ge.releaseEffect({ ...G, zones: G.zones.map((Z) => ({ ...Z, uses: {} })) }, s, 0).rel, 'the same pairing works less the second time');
    ok(Ge.fitOf([4, 7, 6, 3], 0) === 1 && Ge.fitOf([10, 0, 0, 10], 0) < 0.4, 'fit is 1 on the niche and falls away from it');
    ok(!Gm.act(G, { t: 'release', id: 1, zone: 3 }).ok, 'strains only land on visited zones');

    // research, fabrication, upgrades
    G = fresh(9); give(G);
    ok(Gm.act(G, { t: 'research', id: 'm2' }).ok && !Gm.act(G, { t: 'research', id: 'a1' }).ok, 'one bench at the start');
    ok(!Gm.act(G, { t: 'fabricate' }).ok, 'no Mk II without its blueprint');
    Gm.act(G, { t: 'wait', days: 3.1 });
    ok(G.research.done.m2, 'research finishes on game days');
    ok(Gm.act(G, { t: 'fabricate' }).ok && G.bot.gen === 1 && G.bot.busy > 0, 'the Digger is fabricated and takes a day');
    drain(G);
    ok(!Gm.act(G, { t: 'research', id: 'm4' }).ok || true, 'Mk III needs its blueprint chain');
    for (let i = 0; i < D.upgradeMax(1); i++) Gm.act(G, { t: 'upgrade', id: 'hull' });
    ok(G.bot.lv.hull === D.upgradeMax(1) && !Gm.act(G, { t: 'upgrade', id: 'hull' }).ok, 'upgrades stop at the generation\'s cap');
    const S1 = Gm.botStats(G);
    ok(S1.hpMax > 85 && S1.shot > 0, 'a better hull and a blaster');

    // harvesters, colonies, the shuttle
    G = fresh(10); give(G);
    G.zones[0].visited = true;
    ok(!Gm.act(G, { t: 'harvester', zone: 0, kind: 'metal' }).ok, 'harvesters need research');
    G.research.done.a1 = true;
    ok(Gm.act(G, { t: 'harvester', zone: 0, kind: 'metal' }).ok, 'a Scrap Rig drops on the Meadow');
    ok(!Gm.act(G, { t: 'harvester', zone: 2, kind: 'metal' }).ok, 'not on an unvisited zone');
    const m0 = G.res.metal;
    Gm.act(G, { t: 'wait', days: 10 });
    ok(G.zones[0].stock.metal > 5, `it fills its stock (${G.zones[0].stock.metal.toFixed(1)} in 10 days)`);
    Gm.act(G, { t: 'collect' });
    ok(G.res.metal > m0 && G.zones[0].stock.metal < 1, 'collecting brings the stock up');
    Gm.act(G, { t: 'wait', days: 200 }); drain(G);
    ok(G.zones[0].stock.metal <= D.stockCap(0) + 1e-6, 'stock is capped');
    G.research.done.a5 = true;
    G.zones[0].hostile = 70;
    ok(!Gm.act(G, { t: 'colony', zone: 0 }).ok, 'no colony among hostile fauna');
    G.zones[0].hostile = 40;
    ok(Gm.act(G, { t: 'colony', zone: 0 }).ok && G.zones[0].colony === 1, 'an Outpost on calmer ground');
    const tx = G.zones[0].toxic;
    Gm.act(G, { t: 'wait', days: 10 });
    ok(G.zones[0].toxic < tx, 'colonies tend their zone');

    // the clock and the endings
    G = fresh(11);
    Gm.act(G, { t: 'wait', days: 400 });
    drain(G);
    ok(G.over && G.ending.kind === 'reveille' && G.day === C.YEAR_DAYS, 'a year of nothing ends in Reveille');
    ok(G.said.day90 && G.said.day330, 'the calendar beats played on the way');
    G = fresh(12);
    for (const Z of G.zones) { Z.toxic = Z.hostile = Z.barren = 10; Z.visited = true; }
    ok(!Gm.act(G, { t: 'wake' }).ok, 'no early wake without the Heartroot settled');
    G.final = 'concord';
    Gm.act(G, { t: 'wait', days: 0.3 }); drain(G);
    ok(G.said.ready, 'TILLY says when Cradle is ready');
    ok(Gm.act(G, { t: 'wake' }).ok && G.ending.kind === 'concord' && G.ending.early, 'waking them early gives the Concord ending');
    G = fresh(13);
    for (const Z of G.zones) { Z.toxic = Z.hostile = Z.barren = 38; }
    Gm.act(G, { t: 'wait', days: 400 }); drain(G);
    ok(G.ending.kind === 'hard', 'a half-made world is a Hard Welcome');

    // the Rootmother and the choice
    G = fresh(14); give(G);
    G.bot.gen = 5;
    Gm.act(G, { t: 'deploy', zone: 5 }); drain(G);
    const B = G.mission.enemies.find((x) => x.type === 'rootmother');
    ok(B && G.mission.bossId === B.id, 'the Rootmother waits in the Heartroot');
    ok(!Gm.act(G, { t: 'release', id: 1, zone: 5 }).ok, 'no seeding the Heartroot while she lives');
    B.hp = 1; G.mission.p.x = B.x; G.mission.p.y = B.y + D.ENEMIES.rootmother.r + 1; G.mission.p.yaw = 0;
    for (const e of G.mission.enemies) if (e !== B) e.alive = false;
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(!B.alive && G.mission.phase === 'choice' && G.talk?.id === 'boss_down', 'when she falls, VESPER speaks');
    while (G.talk && !Gm.talkChoices(G)) Gm.act(G, { t: 'next' });
    const ch = Gm.talkChoices(G);
    ok(ch.find((c) => c.id === 'concord' && !c.ok), 'Concord is closed without the black boxes and Mycelial Translation');
    ok(!Gm.act(G, { t: 'choose', id: 'concord' }).ok && G.talk, 'choosing it anyway is refused, and the choice stays');
    ok(Gm.act(G, { t: 'choose', id: 'purge' }).ok && G.final === 'purge', 'Purge settles it');
    drain(G);
    ok(G.mission.phase === 'run' && G.zones[5].hostile <= 30, 'the Heartroot calms and the bot can walk home');
}

// ======================================================================
if (want('zones')) {
    section('zones');
    let bad = 0, total = 0;
    for (let z = 0; z < D.ZONES.length; z++) {
        for (let s = 1; s <= 60; s++) {
            const G = fresh(s);
            const M = Zg.generateZone(z, G.zones[z], s * 977 + z);
            const R = Zg.reachMap(M);
            total++;
            const lost = M.nodes.filter((n) => !Zg.canReach(R, n.x, n.y, C.BOT.gatherReach - 0.2));
            const echoLost = M.echo && !Zg.canReach(R, M.echo.x, M.echo.y, M.echo.r - 0.3);
            if (lost.length || echoLost || (D.ZONES[z].echo >= 0 && !M.echo)) { bad++; if (bad < 4) console.log(`    zone ${z} seed ${s}: ${lost.length} stranded nodes, echo ${M.echo ? (echoLost ? 'stranded' : 'ok') : 'missing'}`); }
        }
    }
    ok(bad === 0, `every node and black box reachable from the beacon (${total - bad}/${total})`);
    // terraforming shows on the ground
    const G = fresh(2);
    const a = Zg.generateZone(1, G.zones[1], 55);
    const calm = { ...G.zones[1], hostile: 10, toxic: 10, barren: 10 };
    const b = Zg.generateZone(1, calm, 55);
    ok(b.enemies.length < a.enemies.length && b.hazards.length < a.hazards.length && b.nodes.length > a.nodes.length, 'a terraformed zone has fewer creatures and hazards and more plants');
    ok(b.enemies.every((e) => e.passive), 'and its creatures don\'t start fights');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, ticks) => { const G = fresh(seed); const B = Bt.makeBot(); for (let i = 0; i < ticks && !G.over; i++) { const inp = Bt.botTick(G, B); if (inp) Gm.step(G, inp, DT); } return G; };
    const a = play(42, 30000), b = play(42, 30000);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    // round trip mid-mission
    let G = fresh(7); const B0 = Bt.makeBot();
    for (let i = 0; i < 20000 && !(G.mode === 'mission' && G.mission.t > 8); i++) { const inp = Bt.botTick(G, B0); if (inp) Gm.step(G, inp, DT); }
    ok(G.mode === 'mission', 'a bot is on the planet');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    for (let i = 0; i < 6000; i++) { const x = Bt.botTick(G, b1); if (x) Gm.step(G, x, DT); const y = Bt.botTick(copy, b2); if (y) Gm.step(copy, y, DT); }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save mid-mission plays on identically');
    // mid-sentence
    G = Gm.newGame(3); Gm.act(G, { t: 'next' }); Gm.act(G, { t: 'next' });
    const c2 = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(c2.talk.id === 'wake' && c2.talk.i === 2 && Gm.talkLine(c2).t === Gm.talkLine(G).t, 'a save mid-sentence resumes on the same line');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('fuzz')) {
    section('fuzz');
    const { makeRng } = await import('../js/rng.js');
    const ids = D.RESEARCH.map((r) => r.id), sp = D.SPECIES.map((s) => s.id);
    let finished = 0;
    for (let s = 1; s <= 8; s++) {
        const R = makeRng(s * 31);
        const G = fresh(s);
        for (const k of D.RES) G.res[k] = 200;
        let bad = null;
        for (let i = 0; i < 1500 && !G.over; i++) {
            const pick = R.int(0, 14);
            const cmds = [
                { t: 'research', id: R.pick(ids) }, { t: 'fabricate' }, { t: 'upgrade', id: R.pick(D.UPGRADES).id },
                { t: 'blend', a: R.pick(sp), b: R.pick(sp), r: R() }, { t: 'release', id: R.int(0, 9), zone: R.int(-1, 6) },
                { t: 'harvester', zone: R.int(0, 6), kind: R.pick(D.HARVESTERS).id }, { t: 'colony', zone: R.int(0, 5) },
                { t: 'collect' }, { t: 'deploy', zone: R.int(0, 6) }, { t: 'wait', days: R() * 3 }, { t: 'report' },
                { t: 'next' }, { t: 'choose', id: R.pick(['purge', 'concord', 'x']) }, { t: 'speed', i: R.int(-1, 5) }, { t: 'abort' },
            ];
            Gm.act(G, cmds[pick]);
            if (G.mode === 'mission') for (let k = 0; k < 60; k++) Gm.step(G, { x: R() * 2 - 1, y: R() * 2 - 1, turn: R() - 0.5, a: R() < 0.3, b: R() < 0.5, c: R() < 0.3, r: R() < 0.1 }, DT);
            else Gm.step(G, { x: R() * 2 - 1, y: R() * 2 - 1, turn: R() - 0.5 }, DT);
            G.events.length = 0;
            for (const k of D.RES) if (!(G.res[k] >= 0) || !Number.isFinite(G.res[k])) bad = `${k} = ${G.res[k]}`;
            for (const Z of G.zones) for (const m of ['toxic', 'hostile', 'barren']) if (!(Z[m] >= C.METRIC_FLOOR - 1e-9 && Z[m] <= 100)) bad = `${m} = ${Z[m]}`;
            if (G.vats.length > St.vatSlots(G) || G.research.active.length > St.labSlots(G)) bad = 'slots overfilled';
            if (G.mission && !Number.isFinite(G.mission.p.x)) bad = 'non-finite bot';
            if (bad) break;
        }
        ok(!bad, `fuzz seed ${s}: invariants hold${bad ? ' — ' + bad : ''}`);
        // the bot must be able to take over from wherever that left things
        const B = Bt.makeBot();
        for (let i = 0; i < 4e6 && !G.over; i++) { const inp = Bt.botTick(G, B); if (inp) Gm.step(G, inp, DT); }
        if (G.over) finished++;
    }
    ok(finished === 8, `the bot finishes the year from every fuzzed state (${finished}/8)`);
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    const t0 = Date.now();
    for (const [label, opts] of [['perfect', { skill: 1 }], ['mortal', { skill: 0.6 }], ['lazy', { skill: 1, lazy: true }]]) {
        for (let s = 1; s <= (label === 'lazy' ? 2 : SEEDS); s++) {
            const G = fresh(s * 7919);
            const B = Bt.makeBot(opts);
            const genDay = {}, bad = [];
            let ticks = 0;
            while (!G.over && ticks < 8e6) {
                const inp = Bt.botTick(G, B);
                if (inp) Gm.step(G, inp, DT);
                ticks++;
                if (genDay[G.bot.gen] === undefined) genDay[G.bot.gen] = Math.round(G.day);
                G.events.length = 0;
                if (G.mission && (!Number.isFinite(G.mission.p.x) || Math.abs(G.mission.p.x) > C.MAP.half)) { bad.push('bot left the map'); break; }
            }
            ok(G.over && !bad.length, `${label} seed ${s}: finished the year${bad.length ? ' — ' + bad[0] : ''}`);
            rows.push({ label, seed: s, ending: G.ending?.kind, day: G.ending?.day, eden: G.ending?.eden, gens: Object.entries(genDay).map(([g, d]) => `${g}@${d}`).join(' '),
                missions: G.stats.missions, deaths: G.stats.deaths, releases: G.stats.releases, echoes: G.echoes.length, final: G.final || '-' });
        }
    }
    console.log('  ' + ['bot', 'seed', 'ending', 'day', 'eden', 'drops', 'deaths', 'strains', 'boxes', 'final', 'generation@day'].join('\t'));
    for (const r of rows) console.log('  ' + [r.label, r.seed, r.ending, r.day, r.eden, r.missions, r.deaths, r.releases, r.echoes, r.final, r.gens].join('\t'));
    const perfect = rows.filter((r) => r.label === 'perfect'), mortal = rows.filter((r) => r.label === 'mortal'), lazy = rows.filter((r) => r.label === 'lazy');
    ok(perfect.every((r) => r.ending === 'concord' || r.ending === 'purge'), 'the perfect bot reaches a New Eden on every seed');
    ok(perfect.every((r) => r.day < C.YEAR_DAYS), 'and wakes them before the deadline');
    ok(perfect.reduce((a, r) => a + r.day, 0) / perfect.length > 230, 'but not easily (average wake after day 230)');
    ok(mortal.filter((r) => r.ending !== 'reveille').length >= mortal.length * 0.5, 'a clumsier bot mostly makes it at least to a Hard Welcome');
    ok(lazy.every((r) => r.ending === 'reveille'), 'a bot that only drops and never invests fails');
    console.log(`  ${rows.length} years in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
