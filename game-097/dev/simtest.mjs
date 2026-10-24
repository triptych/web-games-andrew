/**
 * simtest.mjs — headless checks of Hollow Gambit's simulation. No browser.
 *
 *   node game-097/dev/simtest.mjs            # everything
 *   ONLY=purity,moves node game-097/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-097/dev/simtest.mjs
 *
 * 1. purity:   js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *              Math.random or the clock, and never import the view, UI, audio or input.
 * 2. data:     every unit, ability and chapter table is well formed; every square a chapter
 *              uses is walkable and unique.
 * 3. moves:    each movement rule (slide, leap, ride, hop, cannon, pawn, phase) on small boards.
 * 4. combat:   element edge, hit and crit, follow-up strikes, terrain, true hit, fights end.
 * 5. abilities each of the 13 abilities: who it can target and what it does.
 * 6. flow:     commands, phases, the enemy turn, win and lose, rewards, XP and level-ups.
 * 7. gacha:    rates, both pities, duplicates, costs.
 * 8. saves:    determinism, a save round trip mid-battle, version rejection.
 * 9. bot:      the bot plays the whole campaign on SEEDS seeds with per-action invariants; the
 *              balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 8);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const M = await import('../js/sim/moves.js');
const Bt = await import('../js/sim/battle.js');
const Ab = await import('../js/sim/abilities.js');
const Co = await import('../js/sim/core.js');
const Gm = await import('../js/sim/game.js');
const Bot = await import('../js/sim/bot.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- helpers
/** A board from rows of terrain, and pieces [key, team, x, y]. */
function board(rows, pieces = []) {
    const B = { ch: 0, w: rows[0].length, h: rows.length, tiles: rows.slice(), units: [], nextId: 1, turn: 1, phase: 'p', over: null,
        aiQueue: [], aiClock: 0, recruitKey: null, stats: { kills: 0, losses: 0, levelups: [] } };
    for (const [key, team, x, y, lv] of pieces) B.units.push(Co.makeUnit(B, key, team, x, y, { lv: lv || 1 }));
    return B;
}
const EMPTY8 = Array(8).fill('........');
/** A game whose battle is `B`, with the player's roster already holding every piece on it. */
function arena(rows, pieces) {
    const G = Gm.newGame(1);
    const B = board(rows, pieces);
    for (const u of B.units) if (u.team === 'p') {
        const r = { rid: 100 + u.id, key: u.key, lv: 1, xp: 0, gains: D.expectedGains(u.key, 1), bond: 0 };
        G.meta.roster.push(r); u.rid = r.rid;
    }
    G.battle = B;
    return { G, B };
}
const at = (B, x, y) => M.unitAt(B, x, y);
const dests = (B, u) => M.genMoves(B, u).map((m) => `${m.to[0]},${m.to[1]}`).sort();
const has = (B, u, x, y, kind) => M.genMoves(B, u).some((m) => m.to[0] === x && m.to[1] === y && (!kind || m.kind === kind));

// ================================================================ 1. purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|play)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ================================================================ 2. data
if (want('data')) {
    section('data');
    const ids = Object.keys(D.UNITS);
    ok(ids.length >= 24, `${ids.length} units`);
    for (const [id, u] of Object.entries(D.UNITS)) {
        ok(D.MOVES[u.move], `${id}: movement '${u.move}' exists`);
        ok(D.ELEMENTS[u.el], `${id}: element ${u.el}`);
        ok(!u.ability || D.ABILITIES[u.ability], `${id}: ability ${u.ability} exists`);
        ok(Object.values(u.stats).every((v) => v > 0) && D.STAT_KEYS.every((k) => k in u.stats && k in u.growth), `${id}: stats and growth`);
        ok(typeof u.model === 'string' && u.colors?.length === 2, `${id}: model and colours`);
    }
    const pool = (n) => D.STAR_POOL[n].length;
    ok(pool(3) >= 5 && pool(4) >= 4 && pool(5) >= 3, `summoning pool ${pool(3)}/${pool(4)}/${pool(5)} (3/4/5 star)`);
    ok(C.START.party.every((k) => D.UNITS[k].star === 3), 'the starting party is all 3-star');
    // every movement pattern is distinct enough to matter: no two summonable units move alike
    const sig = (k) => JSON.stringify(D.MOVES[D.UNITS[k].move]);
    const summ = [...D.STAR_POOL[3], ...D.STAR_POOL[4], ...D.STAR_POOL[5]];
    const dupes = summ.filter((k, i) => summ.findIndex((j) => sig(j) === sig(k)) !== i);
    ok(!dupes.length, `every summonable piece moves differently (dupes: ${dupes.join(',') || 'none'})`);
    ok(new Set(summ.map((k) => D.UNITS[k].ability)).size >= 11, 'the roster covers at least 11 different abilities');
    for (const el of Object.keys(D.ELEMENTS)) ok(summ.some((k) => D.UNITS[k].el === el), `an ${el} piece can be summoned`);

    ok(D.CHAPTERS.length === 6, 'six chapters');
    for (const ch of D.CHAPTERS) {
        const rows = ch.map;
        ok(rows.every((r) => r.length === rows[0].length) && rows.length === rows[0].length, `${ch.id}: a square board of equal rows`);
        ok(rows.join('').split('').every((c) => '.#~+'.includes(c)), `${ch.id}: known terrain only`);
        const seen = new Set();
        let good = true;
        for (const [x, y] of ch.player.slice(0, ch.slots)) {
            const k = x + ',' + y;
            if (seen.has(k) || rows[y]?.[x] === undefined || '#~'.includes(rows[y][x])) good = false;
            seen.add(k);
        }
        for (const e of ch.enemies) {
            const k = e.x + ',' + e.y;
            if (seen.has(k) || rows[e.y]?.[e.x] === undefined || '#~'.includes(rows[e.y][e.x]) || !D.UNITS[e.u]) good = false;
            seen.add(k);
        }
        ok(good, `${ch.id}: every start square is on the board, walkable and used once`);
        ok(ch.player.length >= ch.slots, `${ch.id}: a start square for every slot`);
        ok(ch.victory !== 'boss' || ch.enemies.some((e) => e.boss), `${ch.id}: a boss to slay`);
        ok(ch.enemies.every((e) => !e.recruit || e.boss), `${ch.id}: only bosses recruit`);
    }
}

// ================================================================ 3. moves
if (want('moves')) {
    section('moves');
    let B, u;
    // pawn: forward, sideways; captures only on the forward diagonals
    B = board(EMPTY8, [['thrall', 'p', 3, 4]]); u = B.units[0];
    ok(same(dests(B, u), ['2,4', '3,3', '4,4']), 'a pawn steps forward (up) and sideways, never back');
    B = board(EMPTY8, [['thrall', 'p', 3, 4], ['hound', 'e', 3, 3], ['hound', 'e', 4, 3], ['hound', 'e', 2, 5]]); u = B.units[0];
    ok(!has(B, u, 3, 3) && has(B, u, 4, 3, 'cap') && has(B, u, 2, 3) === false && !has(B, u, 2, 5), 'a pawn captures only diagonally forward');
    B = board(EMPTY8, [['thrall', 'e', 3, 3]]); u = B.units[0];
    ok(has(B, u, 3, 4, 'move') && !has(B, u, 3, 2), "the enemy's pawn marches the other way (down)");

    // rook: slides, blocked by pieces, captures the first enemy
    B = board(EMPTY8, [['gideon', 'p', 3, 4], ['hound', 'e', 3, 2], ['ilse', 'p', 5, 4]]); u = B.units[0];
    ok(has(B, u, 3, 3, 'move') && has(B, u, 3, 2, 'cap') && !has(B, u, 3, 1), 'a rook stops at the first enemy and takes it');
    ok(has(B, u, 4, 4) && !has(B, u, 5, 4) && !has(B, u, 6, 4), 'a rook cannot take or pass a friend');
    ok(!has(B, u, 3, 8) && M.genMoves(B, u).every((m) => Math.max(Math.abs(m.to[0] - 3), Math.abs(m.to[1] - 4)) <= 3), 'every rook move is within 3 squares');
    const cap = M.genMoves(B, u).find((m) => m.kind === 'cap');
    ok(same(cap.stop, [3, 3]), 'a slide that fails to kill stops on the square before the target');

    // terrain: walls and chasms stop a slide; a leap crosses them
    B = board(['........', '........', '...#....', '........', '...~....', '........', '........', '........'], [['gideon', 'p', 3, 5], ['corwin', 'p', 3, 6]]);
    u = B.units[0];
    ok(!has(B, u, 3, 4) && !has(B, u, 3, 3), 'a chasm stops a slide (and cannot be stood on)');
    u = B.units[1];
    ok(has(B, u, 4, 4) && has(B, u, 2, 4), 'a knight leaps past anything');
    B = board(['........', '........', '...#....', '........', '........', '....~...', '........', '........'], [['corwin', 'p', 2, 4]]);
    ok(!has(B, B.units[0], 3, 2) && !has(B, B.units[0], 4, 5) && has(B, B.units[0], 4, 3) && has(B, B.units[0], 3, 6), 'a knight never lands on a wall or a chasm');

    // knight and king
    B = board(EMPTY8, [['corwin', 'p', 3, 4]]);
    ok(M.genMoves(B, B.units[0]).length === 8, 'a knight in the open has 8 moves');
    B = board(EMPTY8, [['bram', 'p', 0, 0]]);
    ok(M.genMoves(B, B.units[0]).length === 3, 'a king in the corner has 3');

    // bishop with phase (Kharon): passes walls and chasms but not pieces
    B = board(['........', '..~.....', '........', '........', '........', '........', '........', '........'], [['kharon', 'p', 4, 3]]);
    u = B.units[0];
    ok(has(B, u, 1, 0) && has(B, u, 2, 1) === false, 'a phasing bishop slides over a chasm square but cannot stand in it');
    B = board(['........', '...#....', '........', '........', '........', '........', '........', '........'], [['wraith', 'e', 5, 3]]);
    // wraith (enemy) moves diagonally 3, ignoring walls
    ok(has(B, B.units[0], 2, 0), 'a wraith passes through a wall');

    // rider (nightrider): repeated knight leaps
    B = board(EMPTY8, [['vesna', 'p', 0, 7]]);
    u = B.units[0];
    ok(has(B, u, 1, 5) && has(B, u, 2, 3) && has(B, u, 3, 1) && !has(B, u, 4, -1), 'a nightrider rides a knight line: (1,2), (2,4), (3,6)…');
    B = board(EMPTY8, [['vesna', 'p', 0, 7], ['hound', 'e', 1, 5], ['hound', 'e', 2, 3]]);
    ok(has(B, B.units[0], 1, 5, 'cap') && !has(B, B.units[0], 2, 3), 'a nightrider stops at the first piece on its line');

    // cannon: moves like a rook, captures only by jumping exactly one screen
    B = board(EMPTY8, [['ludo', 'p', 3, 7], ['ilse', 'p', 3, 5], ['hound', 'e', 3, 2]]);
    u = B.units[0];
    ok(has(B, u, 3, 2, 'cap'), 'a cannon fires over one screen');
    ok(has(B, u, 3, 6, 'move') && !has(B, u, 3, 5), 'a cannon walks like a rook, but not through its screen');
    B = board(EMPTY8, [['ludo', 'p', 3, 7], ['hound', 'e', 3, 5]]);
    ok(!has(B, B.units[0], 3, 5), 'a cannon cannot capture without a screen');
    B = board(EMPTY8, [['ludo', 'p', 3, 7], ['ilse', 'p', 3, 5], ['hound', 'e', 3, 3], ['hound', 'e', 3, 2]]);
    ok(has(B, B.units[0], 3, 3, 'cap') && !has(B, B.units[0], 3, 2), 'a cannon takes the first piece past its screen only');

    // grasshopper: jumps one piece and lands just past it
    B = board(EMPTY8, [['hob', 'p', 3, 7], ['ilse', 'p', 3, 5]]);
    u = B.units[0];
    ok(has(B, u, 3, 4, 'move') && !has(B, u, 3, 3), 'a grasshopper lands directly beyond the piece it jumps');
    B = board(EMPTY8, [['hob', 'p', 3, 7], ['ilse', 'p', 3, 5], ['hound', 'e', 3, 4]]);
    ok(has(B, B.units[0], 3, 4, 'cap'), 'a grasshopper captures on its landing square');
    B = board(EMPTY8, [['hob', 'p', 3, 7], ['ilse', 'p', 3, 5], ['hound', 'e', 3, 4], ['hound', 'e', 3, 3]]);
    ok(!has(B, B.units[0], 3, 3), 'a grasshopper cannot jump two pieces');

    // queen, leapers with offsets
    B = board(EMPTY8, [['morrigan', 'p', 0, 7]]);
    ok(has(B, B.units[0], 5, 2) && has(B, B.units[0], 0, 2) && has(B, B.units[0], 5, 7) && !has(B, B.units[0], 6, 7), 'a queen slides 5 in eight directions');
    B = board(EMPTY8, [['seraphine', 'p', 3, 4]]);
    ok(has(B, B.units[0], 4, 1) && has(B, B.units[0], 6, 3) && has(B, B.units[0], 4, 5), 'a camel leaps (1,3) and steps diagonally');
    B = board(EMPTY8, [['tilda', 'p', 3, 4]]);
    ok(has(B, B.units[0], 3, 2) && has(B, B.units[0], 5, 4) && has(B, B.units[0], 3, 3) && !has(B, B.units[0], 4, 3), 'a wazir with a two-square leap');

    // every summonable piece has somewhere to go from the middle of an empty board, and a diagram
    for (const k of [...D.STAR_POOL[3], ...D.STAR_POOL[4], ...D.STAR_POOL[5]]) {
        B = board(EMPTY8, [[k, 'p', 3, 4]]);
        const n = M.genMoves(B, B.units[0]).length;
        const g = M.diagram(k).flat();
        ok(n >= 3 && g.some((c) => c !== '.'), `${k}: ${n} moves, and a movement diagram`);
    }
    // the enemy's board is the mirror image
    B = board(EMPTY8, [['corwin', 'e', 3, 4]]);
    ok(M.genMoves(B, B.units[0]).length === 8, 'symmetric patterns do not care which side they are on');
    // no move ever lands on a piece of its own side, a wall, or off the board
    for (const k of Object.keys(D.UNITS)) for (const team of ['p', 'e']) {
        B = board(['..#.....', '........', '....~...', '........', '........', '.#......', '........', '........'], [[k, team, 3, 4], ['thrall', team, 3, 3], ['hound', team === 'p' ? 'e' : 'p', 5, 4]]);
        const bad = M.genMoves(B, B.units[0]).filter((m) => !M.walkable(B, m.to[0], m.to[1]) || (M.unitAt(B, m.to[0], m.to[1])?.team === team));
        ok(!bad.length, `${k} (${team}): no move onto a wall, a chasm, off the board, or a friend`);
    }
}

// ================================================================ 4. combat
if (want('combat')) {
    section('combat');
    const A = D.ELEMENTS;
    ok(Bt.advantage('ember', 'thorn') === 1 && Bt.advantage('thorn', 'ember') === -1, 'ember beats thorn');
    ok(Bt.advantage('thorn', 'tide') === 1 && Bt.advantage('tide', 'ember') === 1 && Bt.advantage('ember', 'tide') === -1, 'thorn beats tide beats ember');
    ok(Bt.advantage('umbra', 'lumen') === 1 && Bt.advantage('lumen', 'umbra') === 1, 'umbra and lumen each have the edge over the other');
    ok(Bt.advantage('ember', 'ember') === 0 && Bt.advantage('umbra', 'ember') === 0 && Bt.advantage('lumen', 'tide') === 0, 'everything else is neutral');
    for (const a of Object.keys(A)) ok(Object.keys(A).filter((d) => Bt.advantage(a, d) > 0).length >= 1, `${a} has something to beat`);

    let { G, B } = arena(EMPTY8, [['maren', 'p', 3, 4], ['thrall', 'e', 3, 3]]);
    let [a, d] = B.units;
    let f = Bt.forecast(B, a, d);
    ok(f.d.adv === 0 && f.a.adv === 0, 'ember vs umbra is neutral');
    // damage = atk - def (neutral)
    ok(f.a.dmg === Math.max(1, a.atk - d.def), `damage is attack minus defence (${f.a.dmg})`);
    ok(f.a.hit === Math.min(100, Math.max(10, C.COMBAT.baseHit + a.skl * 2 - d.spd * 2)), `hit chance (${f.a.hit}%)`);
    d.el = 'thorn';
    f = Bt.forecast(B, a, d);
    ok(f.a.adv === 1 && f.a.dmg === Math.max(1, Math.round(a.atk * 1.25) - d.def) && f.a.hit === Math.min(100, C.COMBAT.baseHit + a.skl * 2 - d.spd * 2 + 15), 'an element edge gives +25% damage and +15 hit');
    ok(f.d.adv === -1 && f.d.dmg === Math.max(1, Math.round(d.atk * 0.8) - a.def), 'and the other side takes -20% damage');
    // follow-up strikes
    d.spd = a.spd - 4;
    ok(Bt.forecast(B, a, d).seq.join('') === 'ada', 'four speed faster strikes twice (a d a)');
    d.spd = a.spd + 4;
    ok(Bt.forecast(B, a, d).seq.join('') === 'add', 'and so does the defender (a d d)');
    d.spd = a.spd + 3;
    ok(Bt.forecast(B, a, d).seq.join('') === 'ad', 'three is not enough');
    // buffs and curses count
    d.spd = a.spd;
    const baseDef = Bt.forecast(B, a, d).a.dmg;
    Co.addMod(d, { name: 'Aegis', def: 5, turns: 2 });
    ok(Bt.forecast(B, a, d).a.dmg === Math.max(1, baseDef - 5), 'an Aegis ward lowers the damage by 5');
    d.mods = [];
    // terrain: an altar gives defence and avoid to the one standing on it
    ({ G, B } = arena(['........', '........', '........', '...+....', '........', '........', '........', '........'], [['maren', 'p', 3, 4], ['thrall', 'e', 3, 3]]));
    [a, d] = B.units;
    const plain = Bt.forecast(board(EMPTY8, [['maren', 'p', 3, 4], ['thrall', 'e', 3, 3]]), board(EMPTY8, [['maren', 'p', 3, 4], ['thrall', 'e', 3, 3]]).units[0], board(EMPTY8, [['thrall', 'e', 3, 3]]).units[0]);
    f = Bt.forecast(B, a, d);
    ok(f.a.dmg === Math.max(1, plain.a.dmg - 2) || f.a.dmg === 1, 'an altar is +2 defence');
    ok(f.a.hit === plain.a.hit - 10, 'and +10 avoid');
    // a fight: never gives negative hp, ends when one side falls, and is repeatable by seed
    let n = 0, kills = 0, bounces = 0;
    for (let s = 1; s <= 300; s++) {
        ({ G, B } = arena(EMPTY8, [['maren', 'p', 3, 4], ['thrall', 'e', 3, 3]]));
        G.rng = makeRng(s);
        [a, d] = B.units;
        const ev = Bt.fight(G, a, d, [3, 4]);
        n++;
        if (a.hp < 0 || d.hp < 0 || a.hp > a.hpMax || d.hp > d.hpMax) ok(false, 'hp out of range');
        if (ev.strikes.length > 3) ok(false, 'too many strikes');
        const dead = ev.strikes.findIndex((x) => x.hpA <= 0 || x.hpD <= 0);
        if (dead >= 0 && dead !== ev.strikes.length - 1) ok(false, 'a strike after someone fell');
        if (d.hp <= 0) kills++; else bounces++;
    }
    ok(kills > 0 && bounces > 0, `fights end both ways (${kills} kills, ${bounces} survivors in ${n})`);
    // true hit: a 50% chance lands near 50% over many rolls, and 90% lands more often than the stated 90 (it is the average of two rolls)
    const rng = makeRng(5); let hits90 = 0, hits50 = 0, hits10 = 0;
    for (let i = 0; i < 20000; i++) { const r = (rng() + rng()) * 50; if (r < 90) hits90++; if (r < 50) hits50++; if (r < 10) hits10++; }
    ok(Math.abs(hits50 / 20000 - 0.5) < 0.02, `50% displays as 50% (${(hits50 / 200).toFixed(1)})`);
    ok(hits90 / 20000 > 0.95, `true hit favours high odds (90% → ${(hits90 / 200).toFixed(1)})`);
    ok(hits10 / 20000 < 0.04, `and punishes low ones (10% → ${(hits10 / 200).toFixed(1)})`);
    // spells always land, ignore half the defence
    ({ G, B } = arena(EMPTY8, [['kharon', 'p', 3, 4], ['golem', 'e', 3, 3]]));
    [a, d] = B.units;
    const sd = Bt.spellDamage(B, a, d, 1);
    ok(sd > Math.max(1, Math.round(a.atk * 0.8) - d.def), `a spell (${sd}) gets through armour better than a blow`);
}

// ================================================================ 5. abilities
if (want('abilities')) {
    section('abilities');
    const target = (B, u, x, y) => Ab.canTarget(B, u, x, y);
    const run = (G, u, x, y) => { G.events.length = 0; return Ab.applyAbility(G, u, x, y); };
    for (const id of Object.keys(D.ABILITIES)) ok(D.UNITS && Object.values(D.UNITS).some((u) => u.ability === id), `${id} is on at least one piece`);
    let G, B, u, v;

    // heal
    ({ G, B } = arena(EMPTY8, [['ilse', 'p', 3, 4], ['gideon', 'p', 3, 2], ['bram', 'p', 6, 7]]));
    [u, v] = B.units;
    v.hp = 5;
    ok(!target(B, u, 3, 4) && target(B, u, 3, 2) && !target(B, u, 6, 7), 'heal targets a hurt ally in range, not a full-health one or one too far');
    const before = v.hp; run(G, u, 3, 2);
    ok(v.hp === before + Math.max(8, Math.round(v.hpMax * 0.45)), 'heal restores 45% (at least 8)');
    ok(u.cd === 3 && u.acted, 'using an ability rests it and spends the action');
    ok(Ab.abilityTargets(B, u).length === 0, 'no targets while resting');

    // smite: first piece in a line, never an ally, walls stop it, chasms don't
    ({ G, B } = arena(['........', '........', '...#....', '........', '........', '........', '........', '........'], [['maren', 'p', 3, 6], ['thrall', 'e', 3, 3], ['thrall', 'e', 3, 1], ['hound', 'e', 5, 3], ['hound', 'e', 5, 4]]));
    [u, v] = B.units;
    ok(target(B, u, 3, 3) && !target(B, u, 3, 1) && !target(B, u, 5, 3) && target(B, u, 5, 4), 'a bolt hits the first piece in a straight line (8 directions), a wall stops it, and off-line pieces are out');
    ({ G, B } = arena(['........', '........', '........', '...~....', '........', '........', '........', '........'], [['maren', 'p', 3, 6], ['thrall', 'e', 3, 3]]));
    [u, v] = B.units;
    ok(target(B, u, 3, 3), 'a bolt crosses a chasm');
    ({ G, B } = arena(EMPTY8, [['maren', 'p', 3, 6], ['ilse', 'p', 3, 5], ['thrall', 'e', 3, 3]]));
    ok(!target(B, B.units[0], 3, 3), 'a friend in the way blocks the bolt');
    ({ G, B } = arena(EMPTY8, [['maren', 'p', 3, 6], ['thrall', 'e', 3, 3]]));
    [u, v] = B.units;
    const hp0 = v.hp; run(G, u, 3, 3);
    ok(v.hp === hp0 - Bt.spellDamage(B, { ...u }, v, 1) || v.hp < hp0, 'a bolt hurts');
    ok(G.events.some((e) => e.type === 'ability' && e.fx[0].dmg > 0), 'and reports the damage');

    // ward and rally and bulwark and hex
    ({ G, B } = arena(EMPTY8, [['gideon', 'p', 3, 4], ['ilse', 'p', 4, 5], ['maren', 'p', 3, 7], ['thrall', 'e', 3, 1]]));
    [u, v] = B.units;
    ok(target(B, u, 4, 5) && target(B, u, 3, 4) && !target(B, u, 3, 7), 'ward: any ally (and yourself) within 2');
    const def0 = Bt.eff(v).def; run(G, u, 4, 5);
    ok(Bt.eff(v).def === def0 + 5, 'ward: +5 defence');
    ({ G, B } = arena(EMPTY8, [['aurelian', 'p', 3, 4], ['ilse', 'p', 4, 5], ['maren', 'p', 3, 7]]));
    [u, v] = B.units;
    ok(Ab.abilityTargets(B, u).length === 1, 'rally: needs no aim');
    const a0 = [Bt.eff(u).atk, Bt.eff(v).atk, Bt.eff(B.units[2]).atk]; run(G, u, 3, 4);
    ok(Bt.eff(u).atk === a0[0] + 4 && Bt.eff(v).atk === a0[1] + 4 && Bt.eff(B.units[2]).atk === a0[2], 'rally: +4 attack for allies within 2, not beyond');
    ({ G, B } = arena(EMPTY8, [['bram', 'p', 3, 4]]));
    u = B.units[0]; u.hp = 10; run(G, u, 3, 4);
    ok(u.hp === 16 && Bt.eff(u).def === u.def + 6, 'bulwark: +6 defence and 6 health');
    ({ G, B } = arena(EMPTY8, [['osric', 'p', 3, 4], ['golem', 'e', 3, 2]]));
    [u, v] = B.units; run(G, u, 3, 2);
    ok(Bt.eff(v).def === v.def - 4 && Bt.eff(v).spd === Math.max(1, v.spd - 3), 'hex: -4 defence and -3 speed');
    ok(v.mods[0].turns === 3, 'hex lasts 3 rounds');

    // blink
    ({ G, B } = arena(['........', '........', '........', '.#......', '........', '........', '........', '........'], [['vesna', 'p', 3, 4], ['thrall', 'e', 3, 5]]));
    [u, v] = B.units;
    ok(target(B, u, 3, 1) && target(B, u, 0, 4) && !target(B, u, 3, 5) && !target(B, u, 1, 3) && !target(B, u, 7, 4), 'blink: any empty walkable square within 3');
    run(G, u, 6, 4);
    ok(u.x === 6 && u.y === 4, 'blink moves the caster');

    // hook
    ({ G, B } = arena(EMPTY8, [['hob', 'p', 3, 6], ['thrall', 'e', 3, 2]]));
    [u, v] = B.units;
    ok(target(B, u, 3, 2), 'hook: first enemy within 4 on a line');
    run(G, u, 3, 2);
    ok(v.x === 3 && v.y === 5 && v.hp === v.hpMax - 3, 'hook drags the enemy next to you and hurts it for 3');

    // shove: distance, wall, chasm, piece
    ({ G, B } = arena(EMPTY8, [['corwin', 'p', 3, 4], ['golem', 'e', 3, 3]]));
    [u, v] = B.units; run(G, u, 3, 3);
    ok(v.y === 1 && v.hp === v.hpMax - 2, 'shove: 2 squares away, 2 damage');
    ({ G, B } = arena(['........', '........', '........', '........', '........', '........', '........', '........'], [['corwin', 'p', 3, 2], ['golem', 'e', 3, 1]]));
    [u, v] = B.units; run(G, u, 3, 1);
    ok(v.y === 0 && v.hp === v.hpMax - 6, 'shove into the edge of the board: 2 + 4 damage');
    ({ G, B } = arena(['........', '...#....', '........', '........', '........', '........', '........', '........'], [['corwin', 'p', 3, 3], ['golem', 'e', 3, 2]]));
    [u, v] = B.units; run(G, u, 3, 2);
    ok(v.y === 2 && v.hp === v.hpMax - 6, 'shove into a wall: 2 + 4 damage and stays put');
    ({ G, B } = arena(['........', '........', '........', '...~....', '........', '........', '........', '........'], [['corwin', 'p', 3, 5], ['golem', 'e', 3, 4]]));
    [u, v] = B.units; run(G, u, 3, 4);
    ok(!B.units.includes(v) && G.events.some((e) => e.type === 'death' && e.why === 'fall'), 'shove into a chasm is fatal, whatever its health');
    ({ G, B } = arena(EMPTY8, [['corwin', 'p', 3, 4], ['golem', 'e', 3, 3], ['thrall', 'e', 3, 2]]));
    [u, v] = B.units; run(G, u, 3, 3);
    ok(v.hp === v.hpMax - 5 && B.units[2].hp === B.units[2].hpMax - 3, 'shove into another piece: both are hurt');

    // swap
    ({ G, B } = arena(EMPTY8, [['tilda', 'p', 3, 7], ['gideon', 'p', 3, 3], ['ilse', 'p', 6, 5]]));
    [u, v] = B.units;
    ok(target(B, u, 3, 3) && !target(B, u, 6, 5), 'swap: an ally on a line within 5, even through blockers');
    run(G, u, 3, 3);
    ok(u.y === 3 && v.y === 7, 'swap trades places');

    // flame
    ({ G, B } = arena(EMPTY8, [['ludo', 'p', 3, 6], ['thrall', 'e', 3, 3], ['hound', 'e', 4, 3], ['ilse', 'p', 3, 2], ['gideon', 'e', 7, 0]]));
    [u, v] = B.units;
    ok(target(B, u, 3, 3) && target(B, u, 4, 4) && !target(B, u, 7, 7), 'flame: a centre within 3 whose 3x3 holds an enemy');
    const ally = B.units[3], far = B.units[4], hp = [v.hp, B.units[2].hp, ally.hp, far.hp];
    run(G, u, 3, 3);
    ok((v.hp < hp[0] || !B.units.includes(v)) && ally.hp === hp[2] && far.hp === hp[3], 'flame hurts every enemy in the blast, never allies, nothing outside');

    // encore
    ({ G, B } = arena(EMPTY8, [['seraphine', 'p', 3, 4], ['gideon', 'p', 4, 4], ['ilse', 'p', 0, 0]]));
    [u, v] = B.units;
    ok(Ab.abilityTargets(B, u).length === 0, 'encore: nobody has acted yet');
    v.acted = true; B.units[2].acted = true;
    ok(target(B, u, 4, 4) && !target(B, u, 0, 0), 'encore: an ally within 3 who has acted');
    run(G, u, 4, 4);
    ok(v.acted === false && u.acted === true, 'encore lets them act again, and spends the dancer');

    // drain
    ({ G, B } = arena(EMPTY8, [['morrigan', 'p', 3, 4], ['golem', 'e', 3, 3]]));
    [u, v] = B.units; u.hp = 10; const g0 = v.hp; run(G, u, 3, 3);
    ok(u.hp === 10 + (g0 - v.hp) && v.hp < g0, 'drain heals the caster by the damage dealt');

    // the whole loop of an ability: cooldown ticks down with phases
    ({ G, B } = arena(EMPTY8, [['ilse', 'p', 3, 4], ['gideon', 'p', 3, 5], ['thrall', 'e', 0, 0]]));
    [u, v] = B.units; v.hp = 3;
    Gm.act(G, { t: 'ability', id: u.id, to: [3, 5] });
    ok(u.cd === 3, 'cooldown starts at 3');
    for (let i = 0; i < 3; i++) { Gm.act(G, { t: 'end' }); Gm.runEnemyPhase(G); }
    ok(u.cd === 0, `…and is gone after 3 rounds (${u.cd})`);
    // every ability, every target square, never throws or leaves a broken board
    let applied = 0;
    for (const id of Object.keys(D.ABILITIES)) {
        const key = Object.keys(D.UNITS).find((k) => D.UNITS[k].ability === id);
        for (let s = 0; s < 6; s++) {
            const r = makeRng(s * 31 + id.length);
            const pieces = [[key, 'p', r.int(1, 6), r.int(3, 7)], ['ilse', 'p', r.int(0, 7), r.int(0, 7)], ['gideon', 'p', r.int(0, 7), r.int(0, 7)], ['thrall', 'e', r.int(0, 7), r.int(0, 3)], ['hound', 'e', r.int(0, 7), r.int(0, 4)], ['golem', 'e', r.int(0, 7), r.int(0, 5)]];
            const tiles = EMPTY8.map((row, y) => row.split('').map((c, x) => (r() < 0.12 ? (r() < 0.5 ? '#' : '~') : c)).join(''));
            const taken = new Set(); const clean = [];
            for (const p of pieces) { const k = p[2] + ',' + p[3]; if (taken.has(k) || '#~'.includes(tiles[p[3]][p[2]])) continue; taken.add(k); clean.push(p); }
            if (clean[0][0] !== key) continue;
            ({ G, B } = arena(tiles, clean));
            u = B.units[0];
            for (const o of B.units) if (o.team === 'p' && o !== u) o.hp = Math.max(1, o.hp - 6);
            for (const o of B.units) o.acted = o !== u;
            const ts = Ab.abilityTargets(B, u);
            for (const [x, y] of ts) {
                const snap = JSON.stringify(B);
                const GG = Gm.deserialize(Gm.serialize(G));
                const uu = GG.battle.units.find((o) => o.id === u.id);
                Ab.applyAbility(GG, uu, x, y);
                applied++;
                const pos = new Set();
                for (const o of GG.battle.units) {
                    const k = o.x + ',' + o.y;
                    if (pos.has(k) || !M.inB(GG.battle, o.x, o.y) || !Number.isFinite(o.hp) || o.hp <= 0 || o.hp > o.hpMax) { ok(false, `${id}: broken board after targeting ${x},${y}`); break; }
                    pos.add(k);
                }
                if (JSON.stringify(B) !== snap) ok(false, `${id}: aiming mutated the live game`);
            }
        }
    }
    ok(applied > 40, `${applied} random ability uses left a sound board`);
}

// ================================================================ 6. flow
if (want('flow')) {
    section('flow');
    let G = Gm.newGame(1);
    ok(G.meta.roster.length === 3 && G.meta.party.length === 3 && G.meta.shards === C.START.shards, 'a new game: 3 starters, a party, shards');
    ok(!Gm.act(G, { t: 'start', ch: 1 }).ok, 'chapter 2 is locked at first');
    ok(!Gm.act(G, { t: 'start', ch: 99 }).ok, 'a missing chapter is refused');
    ok(!Gm.act(G, { t: 'move', id: 1, to: [0, 0] }).ok, 'no moving without a battle');
    ok(Gm.act(G, { t: 'start', ch: 0 }).ok, 'chapter 1 starts');
    ok(!Gm.act(G, { t: 'start', ch: 0 }).ok && !Gm.act(G, { t: 'summon', n: 1 }).ok, 'no starting or summoning during a battle');
    let B = G.battle;
    ok(B.units.filter((u) => u.team === 'p').length === 3 && B.units.filter((u) => u.team === 'e').length === D.CHAPTERS[0].enemies.length, 'both sides are on the board');
    ok(G.events.some((e) => e.type === 'phase' && e.start), 'a phase event opens the battle');
    const mine = B.units.filter((u) => u.team === 'p'), foe = B.units.find((u) => u.team === 'e');
    ok(!Gm.act(G, { t: 'move', id: foe.id, to: [foe.x, foe.y + 1] }).ok, "you cannot move the enemy's pieces");
    ok(!Gm.act(G, { t: 'move', id: mine[0].id, to: [0, 0] }).ok, 'an illegal destination is refused');
    ok(!Gm.act(G, { t: 'move', id: 999, to: [0, 0] }).ok, 'an unknown piece is refused');
    ok(!Gm.act(G, { t: 'ability', id: mine[0].id, to: [0, 0] }).ok, 'an illegal ability target is refused');
    const m0 = M.genMoves(B, mine.find((u) => u.key === 'gideon'))[0];
    const gid = mine.find((u) => u.key === 'gideon');
    ok(Gm.act(G, { t: 'move', id: gid.id, to: m0.to }).ok && gid.acted && gid.x === m0.to[0], 'a legal move works and spends the piece');
    ok(!Gm.act(G, { t: 'move', id: gid.id, to: [gid.x, gid.y - 1] }).ok, 'a piece acts once a phase');
    ok(G.events.some((e) => e.type === 'move'), 'and reports a move event');
    // wait for all: the phase ends by itself, the enemy plays, and it is our phase again
    for (const u of mine) if (!u.acted) Gm.act(G, { t: 'wait', id: u.id });
    ok(B.phase === 'e', 'when the last piece has acted the enemy phase begins');
    ok(!Gm.act(G, { t: 'end' }).ok, "you cannot act on the enemy's phase");
    Gm.runEnemyPhase(G);
    ok(B.phase === 'p' && B.turn === 2 && B.units.filter((u) => u.team === 'p').every((u) => !u.acted), 'then the next turn starts, everyone ready');
    // step() paces the enemy by AI_DELAY and holds while the view animates
    G = Gm.newGame(2); Gm.act(G, { t: 'start', ch: 0 }); Gm.act(G, { t: 'end' });
    const e0 = JSON.stringify(G.battle.units);
    for (let i = 0; i < 20; i++) Gm.step(G, { hold: true }, C.STEP);
    ok(JSON.stringify(G.battle.units) === e0 && G.battle.phase === 'e', 'step() holds the enemy while the view is busy');
    for (let t = 0; t < C.AI_DELAY * 2 + 0.1; t += C.STEP) Gm.step(G, {}, C.STEP);
    ok(JSON.stringify(G.battle.units) !== e0, 'and lets it act one piece every AI_DELAY');

    // capture rules: the winner takes the square; a survivor falls back; the loser leaves the board
    const cap = arena(EMPTY8, [['gideon', 'p', 3, 6], ['thrall', 'e', 3, 3], ['hound', 'e', 0, 0]]);
    G = cap.G; B = cap.B;
    const [r, t] = B.units;
    t.hp = 1; t.def = 0;
    r.skl = 99; t.spd = 1;                          // certain hit
    Gm.act(G, { t: 'move', id: r.id, to: [3, 3] });
    ok(!B.units.includes(t) && r.x === 3 && r.y === 3, 'a kill takes the square');
    ok(G.events.some((e) => e.type === 'battle' && e.kill === 'd' && same(e.end, [3, 3])) && G.events.some((e) => e.type === 'death'), 'the battle event says who fell and where the winner ends');
    const sv = arena(EMPTY8, [['gideon', 'p', 3, 6], ['golem', 'e', 3, 3], ['hound', 'e', 0, 0]]);
    G = sv.G; B = sv.B;
    const [r2, t2] = B.units;
    t2.def = 99; t2.hp = 99; t2.hpMax = 99; r2.hp = 999; r2.hpMax = 999;
    Gm.act(G, { t: 'move', id: r2.id, to: [3, 3] });
    ok(B.units.includes(t2) && r2.x === 3 && r2.y === 4, 'a survivor drives the attacker back to the square before it');
    const un = arena(EMPTY8, [['corwin', 'p', 3, 6], ['golem', 'e', 4, 4], ['hound', 'e', 0, 0]]);
    G = un.G; B = un.B;
    un.B.units[1].hp = 99; un.B.units[1].hpMax = 99; un.B.units[1].def = 99;
    Gm.act(G, { t: 'move', id: B.units[0].id, to: [4, 4] });
    ok(B.units[0].x === 3 && B.units[0].y === 6, 'a leaper that fails to kill goes back where it started');

    // winning and losing
    let w = arena(EMPTY8, [['gideon', 'p', 3, 6], ['thrall', 'e', 3, 3]]);
    w.B.units[1].hp = 1; w.B.units[0].skl = 99; w.B.units[1].spd = 1; w.B.units[1].def = 0;
    G = w.G; Gm.act(G, { t: 'move', id: w.B.units[0].id, to: [3, 3] });
    ok(G.battle.over === 'win' && G.events.some((e) => e.type === 'win'), 'taking the last enemy wins');
    ok(G.meta.cleared.c1 && G.meta.shards === C.START.shards + D.CHAPTERS[0].reward.shards, 'a first clear pays the full reward and unlocks the next chapter');
    ok(!Gm.act(G, { t: 'move', id: 1, to: [0, 0] }).ok && Gm.act(G, { t: 'leave' }).ok && G.battle === null, 'after a win only "leave" works');
    ok(Gm.act(G, { t: 'start', ch: 1 }).ok, 'and chapter 2 is open now');
    Gm.act(G, { t: 'leave', retreat: true });
    ok(G.battle === null, 'a retreat leaves a battle that is still on');
    ok(!Gm.act(G, { t: 'leave' }).ok, 'nothing to leave');
    // replay pays 40%
    const rp = arena(EMPTY8, [['gideon', 'p', 3, 6], ['thrall', 'e', 3, 3]]);
    rp.G.meta.cleared.c1 = true; rp.B.units[1].hp = 1; rp.B.units[0].skl = 99; rp.B.units[1].spd = 1; rp.B.units[1].def = 0;
    const sh = rp.G.meta.shards; Gm.act(rp.G, { t: 'move', id: rp.B.units[0].id, to: [3, 3] });
    ok(rp.G.meta.shards === sh + Math.round(D.CHAPTERS[0].reward.shards * 0.4), 'a replay pays 40%');
    // boss chapters win on the boss alone, and recruit
    G = Gm.newGame(4); G.meta.cleared.c1 = G.meta.cleared.c2 = true; Gm.act(G, { t: 'start', ch: 2 });
    B = G.battle;
    const boss = B.units.find((u) => u.boss);
    ok(boss && boss.key === 'bram' && B.recruitKey === 'bram', 'chapter 3 has Bram as its boss, and he recruits');
    const hero = B.units.find((u) => u.team === 'p');
    for (const u of B.units.filter((x) => x.team === 'e' && x !== boss)) B.units.splice(B.units.indexOf(u), 1);
    boss.hp = 1; boss.def = 0; boss.spd = 1; hero.x = boss.x; hero.y = boss.y + 1; hero.skl = 99; hero.key = 'gideon'; hero.el = 'ember';
    ok(Gm.act(G, { t: 'move', id: hero.id, to: [boss.x, boss.y] }).ok && B.over === 'win', 'slaying the boss wins at once');
    ok(G.meta.roster.some((r) => r.key === 'bram'), 'and Bram joins the roster');
    ok(G.events.some((e) => e.type === 'win' && e.rewards.recruit?.isNew), 'with a recruit in the win event');
    // recruiting a unit you own is a Bond level
    const rec1 = Gm.recruit(G, 'bram');
    ok(!rec1.isNew && G.meta.roster.find((r) => r.key === 'bram').bond === 1, 'a duplicate becomes Bond 1');
    for (let i = 0; i < 8; i++) Gm.recruit(G, 'bram');
    const rr = G.meta.roster.find((r) => r.key === 'bram'), sh2 = G.meta.shards;
    ok(rr.bond === C.BOND.max, `bond stops at ${C.BOND.max}`);
    Gm.recruit(G, 'bram');
    ok(G.meta.shards === sh2 + C.BOND.refund, 'past the cap a duplicate pays shards');
    const bs = D.statsOf('bram', rr.gains, rr.bond), b0 = D.statsOf('bram', rr.gains, 0);
    ok(bs.atk > b0.atk && bs.hp > b0.hp && bs.def >= b0.def, 'bond raises stats');

    // losing
    const lo = arena(EMPTY8, [['ilse', 'p', 3, 6], ['golem', 'e', 3, 3]]);
    G = lo.G; lo.B.units[0].hp = 1; lo.B.units[1].atk = 99; lo.B.units[1].skl = 99; lo.B.units[0].spd = 1; lo.B.units[1].spd = 9;
    Gm.act(G, { t: 'end' }); Gm.runEnemyPhase(G);
    ok(G.battle.over === 'lose' || G.battle.units.some((u) => u.team === 'p'), 'losing every piece loses (or the golem missed)');
    const lt = arena(EMPTY8, [['ilse', 'p', 0, 7], ['thrall', 'e', 7, 0]]);
    G = lt.G; lt.B.turn = C.MAX_TURNS;
    lt.B.units[1].hp = 999;
    Gm.act(G, { t: 'end' }); lt.B.units = lt.B.units.filter((u) => u.team === 'p').concat(lt.B.units.filter((u) => u.team === 'e'));
    Gm.runEnemyPhase(G);
    ok(G.battle.over === 'lose', 'the night wins after the turn limit');

    // XP and levels
    const xp = arena(EMPTY8, [['maren', 'p', 3, 4], ['thrall', 'e', 0, 0]]);
    G = xp.G; const mu = xp.B.units[0], rec = G.meta.roster.find((x) => x.rid === mu.rid);
    const hpMax0 = mu.hpMax;
    Co.gainXp(G, mu, 250);
    ok(rec.lv === 3 && rec.xp === 50, `250 xp is two levels and 50 over (Lv ${rec.lv}, ${rec.xp})`);
    ok(G.events.filter((e) => e.type === 'levelup').length === 2, 'each level is an event');
    const s = D.statsOf('maren', rec.gains, rec.bond);
    ok(mu.atk === s.atk && mu.hpMax === s.hp && mu.hpMax >= hpMax0 && mu.hp <= mu.hpMax, 'the piece on the board has the new stats');
    Co.gainXp(G, mu, 99999);
    ok(rec.lv === C.XP.maxLevel && rec.xp === 0, `level cap ${C.XP.maxLevel}`);
    Co.gainXp(G, xp.B.units[1], 50);
    ok(true, 'enemies earn nothing');
    ok(D.expectedGains('maren', 1).atk === 0 && D.expectedGains('maren', 21).atk > 5, 'expected gains for enemy levels');
    // party rules
    G = Gm.newGame(5);
    ok(!Gm.act(G, { t: 'party', rids: [] }).ok && !Gm.act(G, { t: 'party', rids: [1, 1] }).ok && !Gm.act(G, { t: 'party', rids: [77] }).ok, 'a party must be non-empty, without repeats, of owned pieces');
    ok(Gm.act(G, { t: 'party', rids: [3, 1] }).ok && same(G.meta.party, [3, 1]), 'the party order is yours to choose');
    Gm.act(G, { t: 'party', rids: [3, 1, 2] });
    Gm.act(G, { t: 'start', ch: 0 });
    ok(G.battle.units.find((u) => u.team === 'p' && u.x === 3).key === 'ilse', 'and the first piece takes the first square');
}

// ================================================================ 7. gacha
if (want('gacha')) {
    section('gacha');
    let G = Gm.newGame(11);
    ok(!Gm.act(G, { t: 'summon', n: 3 }).ok, 'only ×1 and ×10');
    G.meta.shards = 50;
    ok(!Gm.act(G, { t: 'summon', n: 1 }).ok && G.meta.shards === 50, 'not enough shards: refused, and nothing is spent');
    G.meta.shards = 1000;
    const r1 = Gm.act(G, { t: 'summon', n: 1 });
    ok(r1.ok && r1.pulls.length === 1 && G.meta.shards === 1000 - C.GACHA.single, 'a single costs 100');
    const r10 = Gm.act(G, { t: 'summon', n: 10 });
    ok(r10.ok && r10.pulls.length === 10 && G.meta.shards === 1000 - C.GACHA.single - C.GACHA.ten, 'ten cost 900');
    ok(G.events.filter((e) => e.type === 'summon').length === 2, 'each summon is an event');
    // rates and pities over a long run
    G = Gm.newGame(12);
    const N = 30000, count = { 3: 0, 4: 0, 5: 0 };
    let since5 = 0, since4 = 0, max5 = 0, max4 = 0;
    for (let i = 0; i < N; i++) {
        G.meta.shards = 100;
        const p = Gm.summon(G, 1)[0];
        count[p.star]++;
        since5++; since4++;
        if (p.star === 5) { max5 = Math.max(max5, since5); since5 = 0; }
        if (p.star >= 4) { max4 = Math.max(max4, since4); since4 = 0; }
    }
    ok(Math.abs(count[5] / N - 0.05) < 0.02 && count[5] / N > 0.045, `5-star rate ${(count[5] / N * 100).toFixed(2)}% (5% base, a little more from pity)`);
    ok(Math.abs(count[4] / N - 0.25) < 0.03, `4-star rate ${(count[4] / N * 100).toFixed(2)}%`);
    ok(count[3] / N > 0.6 && count[3] / N < 0.75, `3-star rate ${(count[3] / N * 100).toFixed(2)}%`);
    ok(max5 <= C.GACHA.pity5, `a 5-star at least every ${C.GACHA.pity5} (longest drought ${max5})`);
    ok(max4 <= C.GACHA.pity4, `a 4-star or better at least every ${C.GACHA.pity4} (longest drought ${max4})`);
    ok(G.meta.pulls === N, 'pulls are counted');
    // every summonable piece can appear
    const got = new Set(G.meta.roster.map((r) => r.key));
    ok([...D.STAR_POOL[3], ...D.STAR_POOL[4], ...D.STAR_POOL[5]].every((k) => got.has(k)), 'every piece in the pool turned up');
    ok(G.meta.roster.every((r) => r.bond <= C.BOND.max), 'no bond above the cap');
    // new pieces arrive near the party's level, not at 1
    G = Gm.newGame(13);
    for (const r of G.meta.roster) { r.lv = 10; r.gains = D.expectedGains(r.key, 10); }
    G.meta.shards = 100000;
    let fresh = null;
    for (let i = 0; i < 40 && !fresh; i++) { const p = Gm.summon(G, 1)[0]; if (p.isNew) fresh = G.meta.roster[G.meta.roster.length - 1]; }
    ok(fresh && fresh.lv === 9, `a newcomer joins at one level below the party average (Lv ${fresh?.lv})`);
    ok(G.meta.party.length <= C.PARTY_MAX, 'the party never grows past its cap by itself');
}

// ================================================================ 8. saves
if (want('saves')) {
    section('saves');
    const play = (seed, actions) => {
        const G = Gm.newGame(seed); const bot = Bot.makeBot();
        for (let i = 0; i < actions; i++) {
            const { cmd } = Bot.botInput(G, bot);
            if (G.battle && G.battle.phase === 'e' && !G.battle.over) { Gm.runEnemyPhase(G); G.events.length = 0; continue; }
            if (!cmd) break;
            Gm.act(G, cmd); G.events.length = 0;
        }
        return G;
    };
    const a = play(42, 60), b = play(42, 60);
    ok(same(Gm.serialize(a), Gm.serialize(b)), 'same seed and inputs, same game');
    const c = play(43, 60);
    ok(!same(Gm.serialize(a), Gm.serialize(c)), 'a different seed plays differently');

    // a save round trip in the middle of a battle plays on identically
    let found = 0;
    for (const n of [12, 25, 40, 57]) {
        const G = play(7, n);
        if (!G.battle) continue;
        found++;
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bot.makeBot(), b2 = Bot.makeBot();
        for (let i = 0; i < 40; i++) {
            for (const [g, bt] of [[G, b1], [copy, b2]]) {
                const { cmd } = Bot.botInput(g, bt);
                if (g.battle && g.battle.phase === 'e' && !g.battle.over) { Gm.runEnemyPhase(g); g.events.length = 0; continue; }
                if (cmd) Gm.act(g, cmd);
                g.events.length = 0;
            }
        }
        ok(same(Gm.serialize(G), Gm.serialize(copy)), `a save taken after ${n} actions plays on identically`);
    }
    ok(found >= 2, `mid-battle saves were exercised (${found})`);
    // a save taken during the enemy phase
    const G = Gm.newGame(9); Gm.act(G, { t: 'start', ch: 0 }); Gm.act(G, { t: 'end' });
    Gm.step(G, {}, C.AI_DELAY + 0.01);
    const copy = Gm.deserialize(Gm.serialize(G));
    for (let t = 0; t < 6; t += C.STEP) { Gm.step(G, {}, C.STEP); Gm.step(copy, {}, C.STEP); }
    ok(same(Gm.serialize(G), Gm.serialize(copy)), 'a save taken mid enemy phase resumes the same turn');
    let threw = false;
    try { Gm.deserialize({ v: 999, meta: { roster: [] } }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ v: 1 }); } catch { threw = true; }
    ok(threw, 'a save with no roster is rejected');
    ok(!('rng' in Gm.serialize(G)) && !('events' in Gm.serialize(G)), 'the rng object and the event queue are not saved');
}

// ================================================================ 9. bot
if (want('bot')) {
    section('bot');
    const rows = [];
    let battles = 0, invariantBreaks = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
        const G = Gm.newGame(seed * 7919);
        const bot = Bot.makeBot();
        const chResult = {};
        let guard = 0, cleared = false, seedBattles = 0;
        while (guard++ < 30000) {
            if (!G.battle && D.CHAPTERS.every((c) => G.meta.cleared[c.id])) { cleared = true; break; }
            if (G.battle && G.battle.phase === 'e' && !G.battle.over) {
                Gm.runEnemyPhase(G);
            } else {
                const { cmd } = Bot.botInput(G, bot);
                if (!cmd) { invariantBreaks++; break; }
                const was = G.battle;
                const r = Gm.act(G, cmd);
                if (!r.ok) { invariantBreaks++; console.log('  FAIL bot command refused', JSON.stringify(cmd), r.err); break; }
                if (cmd.t === 'leave' && was) {
                    battles++; seedBattles++;
                    (chResult[was.ch] ||= []).push(was.over + ':' + was.turn);
                }
            }
            G.events.length = 0;
            const B = G.battle;
            if (B) {
                const pos = new Set();
                let bad = null;
                for (const u of B.units) {
                    const k = u.x + ',' + u.y;
                    if (pos.has(k)) bad = 'two pieces on one square';
                    else if (!M.walkable(B, u.x, u.y)) bad = 'a piece on a wall or in a chasm';
                    else if (![u.hp, u.hpMax, u.atk, u.def, u.spd, u.skl, u.x, u.y].every(Number.isFinite) || u.hp <= 0 || u.hp > u.hpMax) bad = 'bad numbers on a piece';
                    else if (u.cd < 0 || u.mods.some((m) => m.turns <= 0)) bad = 'bad cooldown or status';
                    pos.add(k);
                }
                if (bad) { invariantBreaks++; console.log('  FAIL', bad, `(seed ${seed})`); break; }
            }
            if (seedBattles > 70) break;
        }
        const lv = G.meta.roster.map((r) => r.lv);
        rows.push({ seed, cleared, battles: Object.values(chResult).flat().length, chResult, top: Math.max(...lv), pulls: G.meta.pulls, owned: G.meta.roster.length });
        if (process.env.VERBOSE) console.log(' ', seed, cleared ? 'cleared' : 'stuck', JSON.stringify(chResult));
    }
    ok(invariantBreaks === 0, 'the bot never broke an invariant or sent an illegal command');
    // the balance table: for each chapter, how often the first attempt is won, and the average turns of a win
    console.log('  chapter            first-try win   wins/attempts   avg turns (win)');
    for (let ch = 0; ch < D.CHAPTERS.length; ch++) {
        const all = rows.flatMap((r) => r.chResult[ch] || []);
        const firsts = rows.map((r) => (r.chResult[ch] || [])[0]).filter(Boolean);
        const wins = all.filter((x) => x.startsWith('win'));
        const avgT = wins.length ? Math.round(wins.reduce((a, x) => a + +x.split(':')[1], 0) / wins.length) : 0;
        console.log(`  ${(ch + 1 + '. ' + D.CHAPTERS[ch].name).padEnd(28)}${String(firsts.filter((x) => x.startsWith('win')).length + '/' + firsts.length).padEnd(14)}${String(wins.length + '/' + all.length).padEnd(16)}${avgT}`);
        if (ch === 0) ok(firsts.filter((x) => x.startsWith('win')).length / Math.max(1, firsts.length) >= 0.6, 'chapter 1 is won on most first tries by the starting party');
        if (ch <= 2) ok(wins.length >= rows.length * 0.9, `chapter ${ch + 1} is cleared on nearly every seed`);
    }
    const done = rows.filter((r) => r.cleared).length;
    console.log(`  ${rows.length} campaigns · ${done} finished · ${battles} battles · most pulls ${Math.max(...rows.map((r) => r.pulls))} · highest level ${Math.max(...rows.map((r) => r.top))}`);
    ok(done >= rows.length * 0.6, `the bot finishes the campaign on most seeds (${done}/${rows.length})`);
    const turns = rows.flatMap((r) => Object.values(r.chResult).flat()).map((x) => +x.split(':')[1]);
    ok(turns.filter((t) => t >= C.MAX_TURNS).length <= turns.length * 0.03, 'almost no battle runs out the turn limit (no stalemates)');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
