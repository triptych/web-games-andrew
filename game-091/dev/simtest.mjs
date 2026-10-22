/**
 * simtest.mjs — headless checks of STARSPIN's simulation. No browser.
 *
 *   node game-091/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-091/dev/simtest.mjs
 *   SEEDS=200 VERBOSE=1 node game-091/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: spinning, nudges and respins and their Energy, payline matches, wilds, Static and the
 *    Static Filter, every perk that changes the maths, block, burn, jams, targets, winning and
 *    losing, rewards, the Constellation, Waystations, bosses and the end of the run.
 * 3. tree: on many seeds the Constellation is well formed: no crossing edges, every star reachable
 *    from the bottom row and leading to the top, an Extra Reel in every keystone row.
 * 4. determinism: the same seed and actions give the same run; a save round trip mid-fight plays
 *    on identically; an unknown save version is rejected.
 * 5. bot: whole runs on SEEDS seeds at two skills, with invariants after every action, and the
 *    balance table (win rate, where runs end).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 60);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/battle.js');
const Tr = await import('../js/sim/tree.js');
const Bot = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const act = (G, a) => { const r = Gm.act(G, a); return r; };
/** A battle whose reels each hold just the given symbols, so the payline is known. */
function rig(G, line, enemyHp = 999) {
    G.b.reels = line.map((s) => [s]);
    G.b.stops = line.map(() => 0);
    G.b.spun = true;
    for (const e of G.b.enemies) { e.hp = e.maxHp = enemyHp; e.block = 0; }
    G.events.length = 0;
}
/** A new run whose first fight is against `ids` (a lone Scrap Drone unless told otherwise). */
const fresh = (seed = 1, ids = ['drone']) => { const G = Gm.newGame(seed); Bt.startBattle(G, ids); G.events.length = 0; return G; };

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|glyphs)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('rules')) {
    section('rules');
    let G = fresh(1);
    ok(G.p.reels.length === 3 && G.p.reels.every((r) => r.length === 8), 'a new run has three reels of eight');
    ok(G.phase === 'battle' && G.b && G.p.hp === C.PLAYER.hp, 'and starts in a fight at full hull');
    ok(G.b.energy === C.PLAYER.energy, `a turn starts with ${C.PLAYER.energy} Energy`);
    ok(!Gm.can(G, { t: 'fire' }) && !Gm.can(G, { t: 'nudge', reel: 0, dir: 1 }), 'nothing fires or nudges before a spin');
    ok(act(G, { t: 'spin' }) && G.b.spun, 'SPIN lands the reels');
    ok(!Gm.can(G, { t: 'spin' }), 'and can\'t be repeated before FIRE');
    const s0 = G.b.stops[1], n1 = G.b.reels[1].length;
    act(G, { t: 'nudge', reel: 1, dir: 1 });
    ok(G.b.stops[1] === (s0 + 1) % n1 && G.b.energy === C.PLAYER.energy - 1, 'a nudge moves one reel one symbol and costs 1 Energy');
    act(G, { t: 'nudge', reel: 1, dir: -1 });
    ok(G.b.stops[1] === s0 && G.b.energy === 0, 'a nudge down undoes it');
    ok(!Gm.can(G, { t: 'respin', reel: 0 }), 'with no Energy left, no more nudges or respins');

    // payline maths
    G = fresh(2);
    const ev = (line) => Bt.evaluate(G, line);
    let r = ev(['blade', 'blade', 'blade']);
    ok(r.dmg === 30 && r.top === 3, `three Starblades: 5 × 3 × 2 = 30 (got ${r.dmg})`);
    r = ev(['blade', 'shield', 'blade']);
    ok(r.dmg === 15 && r.block === 5, `a pair hits ×1.5 each; the odd one fires alone (got ${r.dmg}, ${r.block})`);
    r = ev(['blade', 'wild', 'shield']);
    ok(r.dmg === 15 && r.block === 5, 'a Wild Star joins the biggest group');
    r = ev(['wild', 'wild', 'wild']);
    ok(r.dmg === 30, 'three Wild Stars fire as Starblades');
    r = ev(['static', 'static', 'comet']);
    ok(r.aoe === 3 && r.groups.length === 1, 'Static does nothing');
    r = ev(['charge', 'charge', 'charge']);
    ok(r.energy === 3, 'Ion Charge gives 1 Energy a copy and is never multiplied');
    r = ev(['hex', 'hex', 'mend']);
    ok(r.burn === 6 && r.heal === 3, 'Hex Moons pair into 6 Burn; Nova Mend repairs 3');
    G.p.perks.filter = true;
    ok(ev(['blade', 'static', 'static']).dmg === 30, 'Static Filter: Static counts as a Wild Star');
    G.p.perks = { twin: true };
    ok(ev(['blade', 'blade', 'mend']).dmg === 20, 'Twin Suns: pairs ×2');
    G.p.perks = { jackpot: true };
    ok(ev(['comet', 'comet', 'comet']).aoe === 27, 'Jackpot Core: three of a kind ×3');
    G.p.perks = { sharp: 1 };
    ok(ev(['blade', 'mend', 'shield']).dmg === 6, 'Focusing Lens: +1 per Starblade');
    G.p.perks = { supernova: true };
    ok(ev(['blade', 'mend', 'shield']).dmg === 6, 'Supernova Heart: +25% damage (5 → 6)');
    G.p.perks = {};
    G.p.etch = { blade: 1 };
    ok(ev(['blade', 'blade', 'blade']).dmg === 45, 'an etched Starblade is worth 7.5: three of them 45');
    ok(ev(Array(5).fill('shield')).block === 75, 'five of a kind: ×3 each');

    // firing: damage, block, burn and the enemy turn
    G = fresh(3);
    rig(G, ['blade', 'blade', 'blade'], 100);
    G.b.enemies[0].block = 10;
    act(G, { t: 'fire' });
    ok(G.b.enemies[0].hp === 80, 'FIRE: 30 damage, 10 of it soaked by the enemy\'s Block');
    ok(G.events.some((e) => e.type === 'hit') && G.events.some((e) => e.type === 'eturn'), 'and the enemies take their turn');
    ok(G.events.filter((e) => e.type === 'hit').every((e) => e.s && typeof e.s.hp === 'number'), 'battle events carry a HUD snapshot');
    ok(!G.b.spun && G.b.turn === 2, 'then a new turn starts');

    G = fresh(4);
    rig(G, ['shield', 'shield', 'shield']);
    const e0 = G.b.enemies[0];
    e0.move = D.ENEMIES[e0.id].moves.findIndex((m) => m.k === 'atk');
    const hit = Bt.hitOf(e0, Bt.intentOf(e0)) * (Bt.intentOf(e0).n || 1);
    act(G, { t: 'fire' });
    ok(G.p.hp === C.PLAYER.hp - Math.max(0, hit - 30), `30 Block soaks a ${hit}-damage attack`);
    ok(G.b.block === Math.max(0, 30 - hit) * 0, 'Block is gone at the start of the next turn');

    G = fresh(5);
    G.p.perks.aegis = true;
    rig(G, ['shield', 'shield', 'shield']);
    G.b.enemies[0].move = D.ENEMIES[G.b.enemies[0].id].moves.findIndex((m) => m.k === 'block');
    act(G, { t: 'fire' });
    ok(G.b.block === 15, 'Aegis Memory: Block halves instead of vanishing');

    G = fresh(6);
    rig(G, ['hex', 'hex', 'hex'], 100);
    act(G, { t: 'fire' });
    ok(G.b.enemies[0].burn === 11, 'twelve Burn after the first tick: one less every enemy turn');
    ok(G.b.enemies[0].hp === 88, 'and the tick ignores Block (12 damage)');

    G = fresh(7);
    rig(G, ['mend', 'mend', 'mend']);
    G.b.enemies[0].move = D.ENEMIES[G.b.enemies[0].id].moves.findIndex((m) => m.k !== 'atk');
    G.p.hp = 30;
    act(G, { t: 'fire' });
    ok(G.p.hp === 48, 'three Nova Mends repair 18');

    G = fresh(8);
    rig(G, ['charge', 'charge', 'blade']);
    G.b.enemies[0].move = D.ENEMIES[G.b.enemies[0].id].moves.findIndex((m) => m.k !== 'atk');
    act(G, { t: 'fire' });
    ok(G.b.energy === C.PLAYER.energy + 2, 'two Ion Charges: +2 Energy next turn');

    // jams are temporary
    G = Gm.newGame(9);
    G.sector = 0;
    Bt.startBattle(G, ['moth']);
    const moth = G.b.enemies[0];
    moth.move = D.ENEMIES.moth.moves.findIndex((m) => m.k === 'jam');
    const before = G.b.reels.reduce((s, r) => s + r.length, 0);
    const strips = JSON.stringify(G.p.reels);
    act(G, { t: 'spin' });
    act(G, { t: 'fire' });
    ok(G.b.reels.reduce((s, r) => s + r.length, 0) === before + 1 && G.b.reels.some((r) => r.includes('static')), 'a jam adds Static to a reel');
    ok(JSON.stringify(G.p.reels) === strips, 'only for this fight: your real reels are untouched');

    // targets, winning, rewards and the tree
    G = fresh(10);
    Bt.startBattle(G, ['drone', 'moth']);
    G.events.length = 0;
    rig(G, ['blade', 'blade', 'blade'], 20);
    ok(act(G, { t: 'target', i: 1 }) && G.b.target === 1, 'you can pick your target');
    act(G, { t: 'fire' });
    ok(G.b.enemies[1].hp === 0 && G.b.enemies[0].hp === 20, 'Starblades hit only the target');
    ok(G.b.target === 0 && !Gm.can(G, { t: 'target', i: 1 }), 'the target moves off a dead enemy');
    rig(G, ['comet', 'comet', 'comet'], 9);
    act(G, { t: 'fire' });
    ok(G.phase === 'reward' && G.points === 1 && G.reward.choices.length === 3, 'winning offers three symbols and a point');
    ok(new Set(G.reward.choices).size === 3, 'the three are different');
    const pickSym = G.reward.choices[1];
    const cnt = (g, s) => g.p.reels.map((r) => r.filter((x) => x === s).length);
    const c0 = cnt(G, pickSym);
    act(G, { t: 'pick', i: 1 });
    ok(cnt(G, pickSym).every((n, i) => n === c0[i] + 1), 'a pick adds that symbol to every reel');
    ok(G.phase === 'tree', 'then the Constellation opens');
    const av = Tr.available(G.tree);
    ok(av.length >= 2 && av.every((id) => id.startsWith('0:')), 'the first star can be any in the bottom row');
    ok(!act(G, { t: 'light', id: '5:0' }), 'a star off your path can\'t be lit');
    act(G, { t: 'light', id: av[0] });
    ok(G.points === 0 && G.tree.lit.length === 1, 'lighting a star spends the point');
    const nxt = Tr.available(G.tree);
    ok(nxt.length >= 1 && nxt.every((id) => G.tree.edges.includes(`${av[0]}>${id}`)), 'the next stars are the ones joined to it');
    ok(!act(G, { t: 'light', id: nxt[0] }), 'no point, no star');
    act(G, { t: 'leave' });
    ok(G.phase === 'battle' && G.stop === 1, 'Continue goes on to the next stop');

    // every node does what it says
    const apply = (kind) => { const g = fresh(11); g.phase = 'tree'; g.points = 1; g.tree.nodes[0].kind = kind; g.tree.lit = []; act(g, { t: 'light', id: g.tree.nodes[0].id }); return g; };
    ok(apply('reel').p.reels.length === 4, 'Extra Reel adds a reel');
    ok(apply('hull').p.maxHp === C.PLAYER.hp + 8, 'Hull Plating: +8 max HP');
    ok(apply('wild').p.reels.every((r) => r.includes('wild')), 'Lucky Star: a Wild Star on every reel');
    ok(apply('etch_comet').p.etch.comet === 1, 'Etch Comet');
    ok(apply('capacitor').p.perks.capacitor === 1, 'Capacitor');
    let g5 = fresh(12);
    g5.p.reels = [0, 1, 2, 3, 4].map(() => D.STARTER_STRIP.slice());
    g5.phase = 'tree'; g5.points = 1; g5.tree.nodes[0].kind = 'reel'; g5.tree.lit = [];
    act(g5, { t: 'light', id: g5.tree.nodes[0].id });
    ok(g5.p.reels.length === 5 && g5.p.maxHp === C.PLAYER.hp + 8, 'past five reels, Extra Reel gives hull instead');
    G = fresh(13);
    G.p.perks.spark = true;
    Bt.startBattle(G, ['drone']);
    act(G, { t: 'spin' });
    act(G, { t: 'respin', reel: 0 });
    ok(G.b.energy === C.PLAYER.energy && !G.b.free, 'Spark Coil: the first respin is free');
    G = fresh(14);
    G.p.perks.plating = 1;
    Bt.startBattle(G, ['drone']);
    ok(G.b.block === 6, 'Deflector: start a fight with 6 Block');

    // Waystation
    G = fresh(15);
    G.stop = 1;
    rig(G, ['comet', 'comet', 'comet'], 1);
    act(G, { t: 'fire' });
    act(G, { t: 'pick', i: -1 });
    act(G, { t: 'leave' });
    ok(G.phase === 'way', 'the third stop is a Waystation');
    G.p.hp = 20;
    const wg = JSON.parse(JSON.stringify(G.p));
    act(G, { t: 'rest' });
    ok(G.p.hp === 20 + Math.round(C.PLAYER.hp * C.REST_HEAL), 'Repair restores 35% of max HP');
    ok(G.phase === 'battle' && G.stop === 3, 'and the next fight begins');
    G = fresh(16);
    G.phase = 'way';
    G.b = null;
    const lens = G.p.reels.map((r) => r.length);
    ok(Gm.purgeable(G).includes('charge'), 'a symbol on the reels can be stripped');
    act(G, { t: 'purge', sym: 'charge' });
    ok(G.p.reels.every((r, i) => r.length === lens[i] - 1 && !r.includes('charge')), 'strip takes one copy from every reel');
    G.p.reels = G.p.reels.map(() => ['blade', 'blade', 'shield', 'mend']);
    G.phase = 'way';
    ok(!Gm.purgeable(G).length, 'never below four symbols');
    void wg;

    // bosses and the end
    G = fresh(17);
    G.stop = 4;
    Bt.startBattle(G, D.SECTORS[0].boss, true);
    G.p.hp = 10;
    rig(G, ['blade', 'blade', 'blade'], 1);
    act(G, { t: 'fire' });
    ok(G.p.hp === G.p.maxHp && G.phase === 'reward', 'a boss win repairs the hull fully');
    act(G, { t: 'pick', i: 0 });
    act(G, { t: 'light', id: Tr.available(G.tree)[0] });
    act(G, { t: 'leave' });
    ok(G.sector === 1 && G.stop === 0 && G.events.some((e) => e.type === 'sector'), 'and the next sector begins');
    G = fresh(18);
    G.sector = 2; G.stop = 4;
    Bt.startBattle(G, D.SECTORS[2].boss, true);
    rig(G, ['blade', 'blade', 'blade'], 1);
    act(G, { t: 'fire' });
    ok(G.over && G.phase === 'won' && G.events.some((e) => e.type === 'over' && e.won), 'beating The House wins the run');
    G = fresh(19);
    rig(G, ['static', 'static', 'static']);
    G.p.hp = 1;
    G.b.enemies[0].move = D.ENEMIES[G.b.enemies[0].id].moves.findIndex((m) => m.k === 'atk');
    act(G, { t: 'fire' });
    ok(G.over && G.phase === 'lost' && !Gm.can(G, { t: 'spin' }), 'at 0 hull the run is lost and nothing more can be done');
}

if (want('tree')) {
    section('tree');
    let bad = 0;
    const kinds = {};
    for (let s = 1; s <= 300; s++) {
        const G = Gm.newGame(s * 31);
        const T = G.tree;
        const top = D.TREE.rows - 1;
        const ids = new Set(T.nodes.map((n) => n.id));
        const out = (id) => T.edges.filter((e) => e.startsWith(id + '>')).map((e) => e.split('>')[1]);
        const inc = (id) => T.edges.filter((e) => e.endsWith('>' + id));
        let err = null;
        if (T.nodes.filter((n) => n.r === top).length !== 1 || T.nodes.find((n) => n.r === top).kind !== 'supernova') err = 'top is not one Supernova Heart';
        for (const n of T.nodes) {
            kinds[n.kind] = (kinds[n.kind] || 0) + 1;
            if (n.r < top && !out(n.id).length) err = `${n.id} is a dead end`;
            if (n.r > 0 && !inc(n.id).length) err = `${n.id} can't be reached`;
            if (!D.NODES[n.kind]) err = `${n.id} has no kind`;
        }
        for (const e of T.edges) {
            const [a, b] = e.split('>').map((x) => x.split(':').map(Number));
            if (b[0] !== a[0] + 1 || !ids.has(e.split('>')[1])) err = `bad edge ${e}`;
            if (a[0] < top - 1 && Math.abs(a[1] - b[1]) > 1) err = `edge ${e} jumps columns`;
        }
        // no two edges between the same rows cross
        for (let r = 0; r < top - 1; r++) {
            const es = T.edges.map((e) => e.split('>').map((x) => x.split(':').map(Number))).filter(([a]) => a[0] === r);
            for (const [a, b] of es) for (const [c, d] of es) if ((a[1] - c[1]) * (b[1] - d[1]) < 0) err = `edges cross in row ${r}`;
        }
        for (const kr of D.TREE.keyRows) {
            const row = T.nodes.filter((n) => n.r === kr);
            if (!row.some((n) => n.kind === 'reel')) err = `keystone row ${kr} has no Extra Reel`;
            if (row.some((n) => D.NODES[n.kind].tier !== 'key')) err = `row ${kr} holds a minor star`;
        }
        if (T.nodes.filter((n) => n.r === 0).length < 3) err = 'fewer than three starts';
        if (err) { bad++; if (bad < 4) console.log('   seed', s, err); }
    }
    ok(!bad, `300 Constellations are well formed (${bad} bad)`);
    ok(Object.keys(D.NODES).every((k) => kinds[k]), 'every kind of star turns up');
}

if (want('determinism')) {
    section('determinism');
    const playN = (seed, n) => {
        const G = Gm.newGame(seed);
        const b = Bot.makeBot({ seed });
        for (let k = 0; k < n && !G.over; k++) { Gm.act(G, Bot.botAct(G, b)); G.events.length = 0; }
        return G;
    };
    ok(JSON.stringify(Gm.serialize(playN(42, 80))) === JSON.stringify(Gm.serialize(playN(42, 80))), 'same seed and actions, same run');
    const G = playN(7, 37);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bot.makeBot({ seed: 3 }), b2 = Bot.makeBot({ seed: 3 });
    for (let k = 0; k < 120; k++) {
        if (!G.over) Gm.act(G, Bot.botAct(G, b1));
        if (!copy.over) Gm.act(copy, Bot.botAct(copy, b2));
        G.events.length = copy.events.length = 0;
    }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-run plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('bot')) {
    section('bot');
    const table = {};
    for (const skill of [1, 0.6]) {
        const row = table[skill] = { wins: 0, fights: 0, ends: {}, reels: 0, acts: 0 };
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919);
            const bot = Bot.makeBot({ skill, seed: s });
            let bad = null, n = 0;
            while (!G.over && n < 5000) {
                const a = Bot.botAct(G, bot);
                if (!Gm.act(G, a)) { bad = `illegal action ${JSON.stringify(a)} in ${G.phase}`; break; }
                G.events.length = 0;
                n++;
                const p = G.p;
                if (!(p.hp >= 0 && p.hp <= p.maxHp)) bad = `hull ${p.hp}/${p.maxHp}`;
                else if (G.b && G.b.enemies.some((e) => !(e.hp >= 0 && e.hp <= e.maxHp))) bad = 'enemy HP out of range';
                else if (G.b && !(G.b.energy >= 0 && G.b.block >= 0)) bad = 'negative Energy or Block';
                else if (p.reels.some((r) => r.length < 4 || r.includes('static'))) bad = 'a reel lost its shape';
                if (bad) break;
            }
            if (!G.over && !bad) bad = 'never finished';
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            if (G.phase === 'won') row.wins++;
            else { const k = `${G.sector + 1}.${G.stop + 1}`; row.ends[k] = (row.ends[k] || 0) + 1; }
            row.fights += G.stats.fights;
            row.reels += G.p.reels.length;
            row.acts += n;
        }
    }
    const rate = (k) => table[k].wins / SEEDS;
    for (const k of [1, 0.6]) {
        const R = table[k];
        console.log(`  skill ${k}: wins ${(rate(k) * 100).toFixed(0)}% · ${(R.fights / SEEDS).toFixed(1)} fights · ${(R.reels / SEEDS).toFixed(1)} reels at the end · ${Math.round(R.acts / SEEDS)} actions · lost at (sector.stop) ${JSON.stringify(R.ends)}`);
    }
    ok(rate(1) > rate(0.6) + 0.15, 'a careful pilot wins clearly more often than a careless one');
    ok(rate(1) >= 0.45 && rate(1) <= 0.92, `the careful bot wins often but not always (${(rate(1) * 100).toFixed(0)}%)`);
    ok(rate(0.6) >= 0.05, `a careless pilot can still win sometimes (${(rate(0.6) * 100).toFixed(0)}%)`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
