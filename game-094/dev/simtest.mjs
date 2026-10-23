/**
 * simtest.mjs — headless checks of THE LONG HELIX's story machine. No browser.
 *
 *   node game-094/dev/simtest.mjs            # everything
 *   ONLY=purity,graph node game-094/dev/simtest.mjs
 *   SEEDS=40 VERBOSE=1 node game-094/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the
 *    clock, and never import the view, UI or audio.
 * 2. graph: every `to` exists, every node is reachable, every ending can be reached, every item in
 *    the story exists, all prose is non-empty.
 * 3. rules: specialisations, 2d6 checks, forced rolls, pack limit, drop, use, locked choices, time,
 *    death by health and by clarity, the supply ship arriving on day 60.
 * 4. determinism: same seed and choices, same game; a save round trip plays on identically.
 * 5. bot: whole playthroughs on SEEDS seeds × four goals (and forced pass / forced fail). No state
 *    ever has nothing to choose, the pack never overflows, every ending is reached, every node is
 *    visited, and the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 24);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const { NODES, START } = await import('../js/sim/story.js');
const { ITEMS, GEAR } = await import('../js/sim/data/items.js');
const { CODEX } = await import('../js/sim/data/codex.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const ENDINGS = Object.values(NODES).filter((n) => n.end).map((n) => n.end.id);
const idx = (G, id) => Gm.choicesFor(G).find((c) => c.id === id)?.i;
const pick = (G, re) => Gm.choicesFor(G).find((c) => re.test(c.t) && !c.locked)?.i;
const go = (G, re, opts) => { const i = pick(G, re); return i == null ? false : Gm.choose(G, i, opts); };
const resolveText = (n, G) => (typeof n.text === 'function' ? n.text(G) : n.text);

// ---------------------------------------------------------------------------------------- purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ---------------------------------------------------------------------------------------- graph
if (want('graph')) {
    section('graph');
    const ids = Object.keys(NODES);
    const targets = (n) => {
        const out = [];
        const list = typeof n.choices === 'function' ? [] : n.choices;
        for (const c of list) {
            if (c.to) out.push(c.to);
            if (c.check) for (const o of [c.check.pass, c.check.fail]) if (o.to) out.push(o.to);
        }
        return out;
    };
    let bad = 0;
    for (const id of ids) for (const t of targets(NODES[id])) if (!NODES[t]) { bad++; console.log('   missing target', id, '->', t); }
    ok(!bad, 'every choice leads to a node that exists');
    ok(!!NODES[START], 'the start node exists');
    // death and the supply ship are reached by rule, not by a choice
    const reach = new Set([START, 'end_quiet', 'end_chorus', 'end_ardent']);
    const stack = [START];
    while (stack.length) for (const t of targets(NODES[stack.pop()])) if (!reach.has(t)) { reach.add(t); stack.push(t); }
    ok(ids.every((i) => reach.has(i)), `every node is reachable (${ids.filter((i) => !reach.has(i)).join(', ') || 'none missing'})`);
    ok(ENDINGS.length === 7, `seven endings (found ${ENDINGS.length})`);
    for (const id of ids) {
        const n = NODES[id];
        ok(n.title && n.art && n.text, `${id} has a title, art and text`);
        if (n.end) ok(Array.isArray(n.choices) && n.choices.length === 0, `${id} is an ending with no choices`);
        else ok(typeof n.choices === 'function' || n.choices.length > 0, `${id} has choices`);
    }
    // every item and codex entry the story hands out exists
    const src = fs.readFileSync(path.join(ROOT, 'js/sim/story.js'), 'utf8');
    for (const m of src.matchAll(/give: '(\w+)'/g)) ok(ITEMS[m[1]], `item ${m[1]} exists`);
    for (const m of src.matchAll(/(?:item|noItem): '(\w+)'/g)) ok(ITEMS[m[1]], `item ${m[1]} exists (req)`);
    for (const m of src.matchAll(/codex: '(\w+)'/g)) ok(CODEX[m[1]], `codex ${m[1]} exists`);
    ok(GEAR.length > C.MAX_ITEMS - 1, 'the locker offers more than the pack can carry');
    const everyEntry = new Set([...src.matchAll(/codex: '(\w+)'/g)].map((m) => m[1]));
    ok(Object.keys(CODEX).every((k) => everyEntry.has(k)), 'every journal entry can be unlocked');
    // the prose
    const G = Gm.newGame(1);
    for (const id of ids) {
        G.flags = {};
        const lines = resolveText(NODES[id], G);
        ok(Array.isArray(lines) && lines.length && lines.every((l) => typeof l === 'string' && l.length > 20), `${id} text is real prose`);
    }
}

// ---------------------------------------------------------------------------------------- rules
if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    ok(G.node === START && !G.over, 'a new game starts at the personnel file');
    ok(Gm.choicesFor(G).length === 3, 'three disciplines to choose');
    Gm.choose(G, 0);
    ok(G.stats.ANL === 4 && G.spec === 'COMPUTATIONAL GENOMICIST' && G.node === 'wake', 'the genomicist is strong at analysis');
    G = Gm.newGame(1); Gm.choose(G, 1);
    ok(G.stats.FLD === 4, 'the field geneticist is strong at fieldcraft');
    G = Gm.newGame(1); Gm.choose(G, 2);
    ok(G.stats.INT === 4, 'the neurogeneticist is strong at intuition');
    for (const i of [0, 1, 2]) {
        const g = Gm.newGame(1); Gm.choose(g, i);
        ok(Object.values(g.stats).reduce((a, b) => a + b, 0) === 10, `discipline ${i} spends exactly ten points`);
    }

    // walk to the lab
    const lab = (seed = 5, disc = 0) => { const g = Gm.newGame(seed); Gm.choose(g, disc); Gm.choose(g, 0); return g; };
    G = lab();
    ok(G.node === 'lab', 'the bunk leads to the lab');
    const airlock = Gm.choicesFor(G).find((c) => c.id === 'airlock');
    ok(airlock && airlock.locked, 'the airlock is locked until you have read the results and packed');
    ok(!Gm.choose(G, airlock.i), 'a locked choice cannot be taken');

    // a check: forced both ways, and the dice are shown
    G = lab(7);
    go(G, /Read the sequencer/); go(G, /Go back to the lab/);
    ok(G.und === 8 && G.codex.includes('uniform'), 'reading the results gives understanding and a journal entry');
    G.events.length = 0;
    go(G, /deeper alignment/, { force: 'fail' });
    const roll = G.events.find((e) => e.type === 'roll');
    ok(roll && roll.stat === 'ANL' && roll.dice.length === 2 && roll.ok === false && roll.total === roll.dice[0] + roll.dice[1] + roll.mod + roll.bonus, 'a check reports its roll, and a forced fail fails');
    ok(G.clarity === C.CLARITY_MAX - 1 && G.node === 'lab', 'a failed check costs clarity and stays put');
    go(G, /deeper alignment/, { force: 'pass' });
    ok(G.flags.motif && G.und === 18, 'a passed check pays out');
    ok(!pick(G, /deeper alignment/), 'a finished choice is gone');

    // checks without forcing follow 2d6 + stat >= dc
    let wins = 0, n = 400;
    for (let s = 1; s <= n; s++) {
        const g = lab(s * 31);
        go(g, /Read the sequencer/); go(g, /Go back to the lab/);
        go(g, /deeper alignment/);
        if (g.flags.motif) wins++;
    }
    const p = wins / n;
    // analysis 4 vs dc 8: need 2d6 >= 4, 33/36
    ok(Math.abs(p - 33 / 36) < 0.05, `the genomicist passes an ANL 8 check about 92% of the time (got ${(p * 100).toFixed(0)}%)`);

    // the pack
    G = lab(3);
    go(G, /equipment locker/);
    for (const id of GEAR) go(G, new RegExp(`Take the ${ITEMS[id].name.toLowerCase()}`));
    ok(G.inv.length === C.MAX_ITEMS, 'the pack holds six of the seven');
    const locked = Gm.choicesFor(G).filter((c) => c.locked);
    ok(locked.length === 1 && /PACK FULL/.test(locked[0].locked), 'the seventh is shown locked: pack full');
    ok(!Gm.giveItem(G, 'tuner') && G.inv.length === C.MAX_ITEMS, 'giving into a full pack fails safely');
    const dropped = G.inv[0];
    ok(Gm.dropItem(G, dropped) && !G.inv.includes(dropped), 'an item can be dropped');
    ok(pick(G, /Take the/) != null, 'and then another can be taken');
    G.inv = ['stim', 'tuner'];
    G.health = 4;
    Gm.useItem(G, 'stim');
    ok(G.health === 8 && !G.inv.includes('stim') && G.flags.used_stim, 'a stim heals four and is spent');
    ok(!Gm.dropItem(G, 'tuner') && G.inv.includes('tuner'), 'a key item cannot be dropped');
    G.node = 'gear';
    ok(!Gm.choicesFor(G).some((c) => /stim injector/.test(c.t)), 'a spent stim does not come back from the locker');

    // time
    G = lab(9);
    const t0 = Gm.clockText(G);
    G.min = 23 * 60 + 30; G.day = 41;
    Gm.giveItem(G, 'sequencer');
    G.node = 'airlock';
    Gm.choose(G, idx(G, 'out'));
    ok(G.day === 42 && Gm.clockText(G) === '00:00', 'time rolls over to the next day');
    ok(t0 === '06:12', 'the story starts at 06:12');

    // death and the supply ship
    G = lab(2); G.health = 1; G.node = 'spire_far'; G.flags.answered = true;
    Gm.choose(G, Gm.choicesFor(G).findIndex((c) => /Look for a gap/.test(c.t)), { force: 'fail' });
    ok(G.over && G.ending === 'quiet', 'health at zero ends the story: the quiet');
    G = lab(2); G.clarity = 1; G.node = 'flats';
    Gm.choose(G, Gm.choicesFor(G).findIndex((c) => /Watch the moss/.test(c.t)), { force: 'fail' });
    ok(G.over && G.ending === 'chorus', 'clarity at zero ends the story: the chorus');
    ok(Gm.choicesFor(G).length === 0 && !Gm.choose(G, 0), 'nothing can be chosen after an ending');
    G = lab(2); G.day = C.ARDENT_DAY; G.node = 'camp';
    Gm.choose(G, Gm.choicesFor(G).findIndex((c) => /Stay up/.test(c.t)), { force: 'pass' });
    ok(G.over && G.ending === 'ardent', 'on day 60 the Ardent arrives and the story ends');

    // final choices
    const cradle = () => { const g = lab(4); g.node = 'cradle'; return g; };
    G = cradle();
    ok(idx(G, 'edit') != null && Gm.choicesFor(G)[idx(G, 'edit')].locked, 'co-authoring is locked at first');
    ok(Gm.choicesFor(G)[idx(G, 'burn')].locked === 'NEEDS CUTTING TORCH', 'no torch, no fire: the choice is shown locked');
    G.inv = ['torch'];
    ok(!Gm.choicesFor(G)[idx(G, 'burn')].locked, 'with a torch, the fire is offered');
    Gm.choose(G, idx(G, 'burn'));
    ok(G.node === 'cradle_fire' && !G.over, 'the fire asks first');
    Gm.choose(G, idx(G, 'lower'));
    ok(G.node === 'cradle', 'lowering the torch goes back to the Cradle');
    Gm.choose(G, idx(G, 'burn')); Gm.choose(G, idx(G, 'light'));
    ok(G.over && G.ending === 'fire', 'lighting it ends the story: the fire');
    G = cradle(); G.inv = ['tuner']; G.und = 60; G.flags.asked_gap = true;
    ok(!Gm.choicesFor(G)[idx(G, 'edit')].locked, 'co-authoring opens at 60% with the tuner and the question asked');
    Gm.choose(G, idx(G, 'edit'));
    ok(G.ending === 'edit', 'and it ends the story: the co-author');
    G = cradle(); Gm.choose(G, idx(G, 'sign'));
    ok(G.ending === 'signature', 'the signature ending');
    G = cradle(); Gm.choose(G, idx(G, 'walk'));
    ok(G.ending === 'leave', 'the report ending');
    const text = Gm.passage(G).lines.join(' ');
    ok(/leave your crew/.test(text), 'unfreed crew are left behind in the report ending');
    G = cradle(); G.flags.crew_freed = true; Gm.choose(G, idx(G, 'walk'));
    ok(/walk your crew out/.test(Gm.passage(G).lines.join(' ')), 'freed crew walk out with you');
    const s = Gm.summary(G);
    ok(s.name === 'THE REPORT' && s.days >= 1 && s.codexTotal === Object.keys(CODEX).length, 'the summary names the ending');
}

// ---------------------------------------------------------------------------------------- determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed, n) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed: 3 }); for (let i = 0; i < n && !G.over; i++) Bt.botDo(G, b, Bt.botAct(G, b)); return G; };
    const a = play(42, 60), b = play(42, 60);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and choices, same game');
    ok(JSON.stringify(Gm.serialize(a)) !== JSON.stringify(Gm.serialize(play(43, 60))), 'a different seed rolls differently');

    const G = Gm.newGame(7);
    const bot = Bt.makeBot({ seed: 5 });
    for (let i = 0; i < 40 && !G.over; i++) Bt.botDo(G, bot, Bt.botAct(G, bot));
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 6 }), b2 = Bt.makeBot({ seed: 6 });
    for (let i = 0; i < 60; i++) { Bt.botDo(G, b1, Bt.botAct(G, b1)); Bt.botDo(copy, b2, Bt.botAct(copy, b2)); }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    for (const bad of [{ v: 999 }, null, { ...Gm.serialize(G), node: 'nowhere' }, { ...Gm.serialize(G), stats: {} }]) {
        let threw = false;
        try { Gm.deserialize(bad); } catch { threw = true; }
        ok(threw, 'an unreadable save is rejected, not half-loaded');
    }
}

// ---------------------------------------------------------------------------------------- bot
if (want('bot')) {
    section('bot');
    const visited = new Set();
    const hist = {};
    const rows = [];
    const GOALS = ['signature', 'edit', 'fire', 'leave'];
    const runs = [];
    for (let s = 1; s <= SEEDS; s++) for (const goal of GOALS) for (const force of [null, 'pass', 'fail']) runs.push({ s, goal, force });
    let stuck = 0, overflow = 0, nochoice = 0, slow = 0;
    for (const { s, goal, force } of runs) {
        const G = Gm.newGame(s * 7919);
        const bot = Bt.makeBot({ seed: s, goal, force });
        let steps = 0;
        while (!G.over && steps < 600) {
            const list = Gm.choicesFor(G);
            if (!list.some((c) => !c.locked)) { nochoice++; console.log('   nothing to choose at', G.node, 'seed', s, goal, force); break; }
            if (G.inv.length > C.MAX_ITEMS) overflow++;
            visited.add(G.node);
            const act = Bt.botAct(G, bot);
            if (!Bt.botDo(G, bot, act)) { stuck++; console.log('   bot action failed at', G.node, JSON.stringify(act)); break; }
            G.events.length = 0;
            steps++;
        }
        visited.add(G.node);
        if (!G.over) slow++;
        if (G.over) hist[G.ending] = (hist[G.ending] || 0) + 1;
        rows.push({ goal, force: force || 'dice', ending: G.ending, steps, day: G.day - C.START_DAY + 1, und: G.und, health: G.health, clarity: G.clarity });
    }
    // two endings come by rule, not by a path: wear yourself out, or dither until the ship arrives
    {
        const G = Gm.newGame(11); Gm.choose(G, 1); Gm.choose(G, 0);
        G.node = 'spire_far';
        for (let i = 0; i < 20 && !G.over; i++) go(G, /Look for a gap/, { force: 'fail' });
        visited.add('spire_far'); visited.add(G.node); hist[G.ending] = (hist[G.ending] || 0) + 1;
        const H = Gm.newGame(12); Gm.choose(H, 1); Gm.choose(H, 0);
        H.node = 'camp';
        for (let i = 0; i < 400 && !H.over; i++) { if (!go(H, /^Sleep/) ) go(H, /Break camp/), go(H, /Make camp/); }
        visited.add(H.node); hist[H.ending] = (hist[H.ending] || 0) + 1;
    }
    ok(!nochoice, 'no state ever has nothing to choose');
    ok(!stuck, 'every bot action is accepted');
    ok(!overflow, 'the pack never overflows');
    ok(!slow, 'every run reaches an ending');
    ok(ENDINGS.every((e) => hist[e]), `every ending is reached (${ENDINGS.filter((e) => !hist[e]).join(', ') || 'all seven'})`);
    const allNodes = Object.keys(NODES);
    ok(allNodes.every((n) => visited.has(n)), `every node is visited (${allNodes.filter((n) => !visited.has(n)).join(', ') || 'none missing'})`);
    // the goals do what they say when the dice allow it
    const by = (goal, force) => rows.filter((r) => r.goal === goal && r.force === force);
    for (const [goal, ending] of [['signature', 'signature'], ['fire', 'fire'], ['leave', 'leave'], ['edit', 'edit']]) {
        const r = by(goal, 'pass');
        const hit = r.filter((x) => x.ending === ending).length;
        ok(hit >= r.length * 0.9, `with lucky dice the "${goal}" bot reaches ${ending} (${hit}/${r.length})`);
    }
    console.log('  endings reached:', JSON.stringify(hist));
    const avg = (xs, k) => Math.round(xs.reduce((a, r) => a + r[k], 0) / xs.length);
    console.log('  goal        dice   runs  steps  days  decoded  health  clarity');
    for (const goal of GOALS) for (const force of ['dice', 'pass', 'fail']) {
        const r = rows.filter((x) => x.goal === goal && x.force === force);
        console.log(`  ${goal.padEnd(11)} ${force.padEnd(5)} ${String(r.length).padStart(5)} ${String(avg(r, 'steps')).padStart(6)} ${String(avg(r, 'day') ).padStart(5)} ${String(avg(r, 'und')).padStart(7)}% ${String(avg(r, 'health')).padStart(7)} ${String(avg(r, 'clarity')).padStart(8)}`);
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
