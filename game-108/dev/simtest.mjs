/**
 * simtest.mjs — headless checks of Oathstones' simulation. No browser.
 *
 *   node game-108/dev/simtest.mjs            # everything
 *   ONLY=purity,oaths node game-108/dev/simtest.mjs
 *   SEEDS=12 VERBOSE=1 node game-108/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. oaths: every oath's line rule, Cascade and Crossroads staying put, Ring, Vigil, Fool stones,
 *    rubble and ice.
 * 3. rules: swaps, binding heroes and ranks, the calling and its pity, arrivals binding stones,
 *    the enemy's turns, shields, skills, waves, rewards, losing.
 * 4. boards: every stage on many seeds deals a board with nothing waiting to clear and a move.
 * 5. determinism: the same seed and commands give the same game; a save round trip mid-battle
 *    plays on identically; an unknown save version is rejected.
 * 6. campaign: the bot plays the whole campaign on SEEDS seeds at two skills with invariants
 *    after every command, and prints the balance table.
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
const Bd = await import('../js/sim/board.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const { idx } = Bd;
const N = C.BOARD.w * C.BOARD.h;

let nid = 10000;
/** A token: colour, shape, oath, extra fields. */
const T = (c, s, o = 'hue', x = {}) => ({ id: nid++, c, s, o, ...x });
/** A board of stones that can't match anything: a checker of four colour/shape pairs with no lines. */
function quietBoard() {
    const g = [];
    for (let y = 0; y < C.BOARD.h; y++) for (let x = 0; x < C.BOARD.w; x++) g.push(T((x + 2 * y) % 5, (x * 3 + y) % 4, 'hue'));
    return g;
}
/** A battle with a quiet board we can draw on. */
function battle(seed = 1, stage = 0) {
    const G = Gm.newGame(seed);
    G.progress = stage;
    Gm.act(G, { t: 'battle', stage });
    G.B.g = quietBoard();
    G.B.guest = null;
    G.B.pending = [];
    G.B.wanderIn = 999;
    G.events.length = 0;
    return G;
}
/** Draw a line of three waiting for one swap in the bottom-left corner; returns that swap. */
function ready(G, c = 1) {
    const g = G.B.g;
    g[idx(0, 6)] = T(c, 0); g[idx(1, 6)] = T(c, 1); g[idx(2, 5)] = T(c, 2);
    return { t: 'swap', i: idx(2, 5), j: idx(2, 6) };
}
const clearsOf = (g, combo = 1) => new Set(Bd.findClears(g, combo).clear);

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

if (want('oaths')) {
    section('oaths');
    const L = (...ts) => Bd.lineValid(ts);
    ok(L(T(0, 0), T(0, 1), T(0, 2)), 'Kinship: three of one colour, any shapes');
    ok(!L(T(0, 0), T(0, 1), T(1, 2)), 'Kinship: a different colour breaks it');
    ok(L(T(0, 0, 'form'), T(1, 0, 'form'), T(2, 0, 'form')), 'Form: three of one shape, any colours');
    ok(!L(T(0, 0, 'hue'), T(1, 0, 'form'), T(2, 0, 'form')), 'Form stones in a line with a Kinship stone need its colour too');
    ok(L(T(0, 0, 'twin'), T(0, 0), T(0, 0)), 'Twinned: same colour and same shape');
    ok(!L(T(0, 0, 'twin'), T(0, 1), T(0, 0)), 'Twinned: a different shape breaks it');
    ok(L(T(0, 0, 'prism'), T(1, 0, 'form'), T(2, 0, 'form')), 'Prism: one shape, every colour different');
    ok(!L(T(0, 0, 'prism'), T(0, 0, 'form'), T(2, 0, 'form')), 'Prism: a repeated colour breaks it');
    ok(!L(T(0, 0, 'prism'), T(1, 1, 'form'), T(2, 0, 'form')), 'Prism: a different shape breaks it');
    ok(L(T(0, 0, 'motley'), T(0, 1), T(0, 2)), 'Motley: one colour, every shape different');
    ok(!L(T(0, 0, 'motley'), T(0, 0), T(0, 2)), 'Motley: a repeated shape breaks it');
    ok(!L(T(0, 0, 'host'), T(0, 1), T(0, 2)), 'Host: three is not enough');
    ok(L(T(0, 0, 'host'), T(0, 1), T(0, 2), T(0, 3)), 'Host: four of its colour');
    ok(L(T(0, 0), T(3, 2, 'wild'), T(0, 1)), 'Fool: fills a gap in a line of one colour');
    ok(!L(T(0, 0), T(3, 2, 'wild'), T(1, 1)), 'Fool: cannot reconcile two colours');
    ok(L(T(0, 0, 'prism'), T(4, 4, 'wild'), T(2, 0, 'form')), 'Fool: counts as any colour and shape in a Prism line');

    // Cascade and Crossroads join lines but stay
    let g = quietBoard();
    g[idx(1, 3)] = T(0, 0); g[idx(2, 3)] = T(0, 1, 'chain', { h: 'kel' }); g[idx(3, 3)] = T(0, 2);
    let cl = clearsOf(g, 1);
    ok(cl.has(idx(1, 3)) && cl.has(idx(3, 3)) && !cl.has(idx(2, 3)), 'Cascade: its partners clear on your own swap, it stays');
    ok(clearsOf(g, 2).has(idx(2, 3)), 'Cascade: it leaves in a cascade');
    g = quietBoard();
    g[idx(1, 3)] = T(0, 0); g[idx(2, 3)] = T(0, 3, 'cross', { h: 'wren' }); g[idx(3, 3)] = T(0, 2);
    cl = clearsOf(g);
    ok(cl.has(idx(1, 3)) && !cl.has(idx(2, 3)), 'Crossroads: a row alone clears its partners, not it');
    g[idx(2, 2)] = T(0, 1); g[idx(2, 4)] = T(0, 2);
    ok(clearsOf(g).has(idx(2, 3)), 'Crossroads: it leaves where a row and a column cross');

    // Ring
    g = quietBoard();
    const ri = idx(3, 3);
    g[ri] = T(2, 0, 'ring', { h: 'mara' });
    for (const j of Bd.neighbours4(ri)) g[j] = T(1, (j % 4));
    ok(clearsOf(g).has(ri), 'Ring: every neighbour one colour → it leaves');
    g[idx(3, 2)] = T(4, 1);
    ok(!clearsOf(g).has(ri), 'Ring: one neighbour of another colour → it stays');
    g[idx(3, 2)] = T(4, 1, 'wild');
    ok(clearsOf(g).has(ri), 'Ring: a Fool neighbour counts as the colour');
    ok(!Bd.lineable(g[ri]), 'Ring: never joins a line');

    // Vigil, rubble and ice through real swaps
    let G = battle(3);
    g = G.B.g;
    const vi = idx(3, 5);
    g[vi] = T(3, 0, 'vigil', { h: 'odo', wake: 2 });
    // a line of three right above the vigil, made by a swap: (2,4) (3,4) _ with the third at (4,3) swapped down
    g[idx(2, 4)] = T(0, 1); g[idx(3, 4)] = T(0, 2); g[idx(4, 3)] = T(0, 3);
    g[idx(4, 2)] = T(1, 1); g[idx(4, 1)] = T(2, 2);
    let r = Gm.act(G, { t: 'swap', i: idx(4, 3), j: idx(4, 4) });
    ok(r.ok, 'a swap that completes a line is accepted');
    const v1 = G.B.g.find((t) => t?.h === 'odo');
    ok(v1 && v1.wake === 1, `Vigil: a match beside it wakes it by one (wake ${v1?.wake})`);
    ok(!Bd.lineable(v1), 'Vigil: a sleeping Vigil never joins a line');
    v1.wake = 1;
    const at = G.B.g.indexOf(v1);
    const [vx, vy] = Bd.xy(at);
    // put a ready line next to it
    const nb = vy > 0 ? [vx, vy - 1] : [vx, vy + 1];
    const row = nb[1];
    const xs = [0, 1, 2].map((k) => Math.min(C.BOARD.w - 3, Math.max(0, nb[0] - 1)) + k);
    G.B.g[idx(xs[0], row)] = T(1, 0); G.B.g[idx(xs[1], row)] = T(1, 1); G.B.g[idx(xs[2], row)] = T(1, 2);
    G.events.length = 0;
    // settle through a skill-less path: make a harmless swap elsewhere that matches
    const before = Object.keys(G.roster).length;
    const moves = Bd.findMoves(G.B.g);
    ok(Bd.findClears(G.B.g, 1).clear.length > 0, 'test setup: a ready line beside the Vigil');
    // the ready line clears on the next settle: drive it with a swap that also matches
    if (moves.length) Gm.act(G, { t: 'swap', i: moves[0][0], j: moves[0][1] });
    ok(Object.keys(G.roster).length === before + 1 && G.roster.odo, 'Vigil: once awake the hero leaves and is bound');

    G = battle(4);
    g = G.B.g;
    g[idx(0, 6)] = T(2, 0); g[idx(1, 6)] = T(2, 1); g[idx(2, 5)] = T(2, 2);
    g[idx(1, 5)] = { id: nid++, rb: true, c: -1, s: -1, o: 'hue' };
    g[idx(3, 6)] = T(4, 3, 'hue', { fz: true });
    r = Gm.act(G, { t: 'swap', i: idx(2, 5), j: idx(2, 6) });
    ok(r.ok, 'swap into the bottom row accepted');
    const ev = G.events.find((e) => e.type === 'clear');
    ok(ev && ev.cells.some((c) => c.kind === 'rubble'), 'rubble beside a match breaks');
    ok(ev && ev.unfrozen.length >= 1, 'ice beside a match thaws');
    G = battle(5);
    G.B.g[idx(3, 3)].fz = true;
    r = Gm.act(G, { t: 'swap', i: idx(3, 3), j: idx(4, 3) });
    ok(!r.ok && r.why === 'frozen', 'a frozen token cannot be swapped');
}

if (want('rules')) {
    section('rules');
    // swaps
    let G = battle(11);
    const snap = JSON.stringify(G.B.g), cd = G.B.enemy.cd;
    let r = Gm.act(G, { t: 'swap', i: idx(0, 0), j: idx(1, 0) });
    ok(!r.ok && JSON.stringify(G.B.g) === snap && G.B.enemy.cd === cd && G.B.turn === 0, 'a swap that matches nothing changes nothing and costs no turn');
    ok(G.events.some((e) => e.type === 'swap' && !e.ok), 'and is shown as a failed swap');
    r = Gm.act(G, { t: 'swap', i: idx(0, 0), j: idx(2, 0) });
    ok(!r.ok, 'tokens that are not neighbours cannot swap');

    // a full board after every move, with combos counting up
    G = battle(12);
    G.B.g[idx(0, 6)] = T(1, 0); G.B.g[idx(1, 6)] = T(1, 1); G.B.g[idx(2, 5)] = T(1, 2);
    r = Gm.act(G, { t: 'swap', i: idx(2, 5), j: idx(2, 6) });
    ok(r.ok && G.B.g.every(Boolean), 'after a move the board is full again');
    ok(G.B.turn === 1 && G.B.enemy.cd === D.ENEMIES.imp.cd - 1, 'a move is a turn: the enemy counts down');
    ok(G.B.enemy.hp < G.B.enemy.maxHp, 'clearing stones hurts the enemy');
    const combos = G.events.filter((e) => e.type === 'clear').map((e) => e.combo);
    ok(combos.every((c, k) => c === k + 1), `cascades count up (${combos.join(',')})`);

    // binding a hero, then a second time for a rank
    G = battle(13);
    const bind = (g) => {
        g.B.g[idx(0, 6)] = T(2, 1, 'form', { h: 'bram' }); g.B.g[idx(1, 6)] = T(0, 1); g.B.g[idx(2, 5)] = T(4, 1, 'form');
        g.B.g[idx(1, 6)].o = 'form';
        return Gm.act(g, { t: 'swap', i: idx(2, 5), j: idx(2, 6) });
    };
    r = bind(G);
    ok(r.ok && G.roster.bram && G.roster.bram.rank === 0, 'a Form hero in a line of three Spires is bound');
    ok(G.events.some((e) => e.type === 'recruit' && e.hero === 'bram' && e.isNew), 'and a recruit event says so');
    ok(G.party.includes('bram'), 'a new hero joins a party with room');
    G.B.g = quietBoard();
    bind(G);
    ok(G.roster.bram.rank === 1, 'binding a hero you have raises their rank');

    // the calling
    G = Gm.newGame(21);
    ok(Gm.act(G, { t: 'summon', n: 1 }).ok && G.crystals === C.START.crystals - C.SUMMON.cost1 && G.calls.length === 1, 'a call costs crystals and puts a hero in the calling');
    G.crystals = 99;
    ok(!Gm.act(G, { t: 'summon', n: 1 }).ok, 'no crystals, no call');
    G.crystals = 10000; G.pity = C.SUMMON.pity - 1;
    Gm.act(G, { t: 'summon', n: 1 });
    ok(D.HERO[G.calls[G.calls.length - 1]].r === 5 && G.pity === 0, 'the pity call is a Legend');
    G.calls = new Array(C.CALLS.max).fill('pip');
    ok(!Gm.act(G, { t: 'summon', n: 1 }).ok, 'a full calling refuses another call');
    // rates over many pulls
    G = Gm.newGame(22);
    const tally = { 3: 0, 4: 0, 5: 0 };
    for (let k = 0; k < 4000; k++) { G.crystals = 1000; G.calls = []; Gm.act(G, { t: 'summon', n: 1 }); tally[D.HERO[G.calls[0]].r]++; }
    ok(tally[5] / 4000 > 0.04 && tally[5] / 4000 < 0.08 && tally[4] / 4000 > 0.22 && tally[4] / 4000 < 0.3, `summon rates near the table with pity (${JSON.stringify(tally)})`);

    // called heroes come to the board; unbound ones go back
    G = Gm.newGame(23);
    G.calls = ['nyx', 'pip'];
    Gm.act(G, { t: 'battle', stage: 0 });
    const nyx = G.B.g.findIndex((t) => t?.h === 'nyx');
    ok(nyx >= 0 && G.calls.join() === 'pip', 'the first called hero arrives with the board');
    const [, ny] = Bd.xy(nyx);
    const rowOaths = Bd.ROWS[ny].map((k) => G.B.g[k]).filter((t) => t && !t.h && !t.rb && t.o !== 'wild').map((t) => t.o);
    // her row swore Prism on arrival (a cascade may have replaced a few stones since)
    ok(G.events.some((e) => e.type === 'change' && e.kind === 'bind' && e.changes.length >= 4 && e.changes.every((c) => c.tok.o === 'prism')), 'Nyx binds the stones of her row to the Prism oath');
    ok(rowOaths.filter((o) => o === 'prism').length >= 1, 'and the row still swears it');
    Gm.act(G, { t: 'flee' });
    ok(G.B.over === 'loss' && G.calls[0] === 'nyx', 'fleeing returns an unbound called hero to the calling');
    ok(G.B.reward && !G.B.reward.win, 'fleeing settles as a loss');

    // arrivals that paint
    G = battle(24);
    G.B.pending = [{ id: 'rowan', src: 'call' }];
    G.B.g[idx(0, 6)] = T(1, 0); G.B.g[idx(1, 6)] = T(1, 1); G.B.g[idx(2, 5)] = T(1, 2);
    Gm.act(G, { t: 'swap', i: idx(2, 5), j: idx(2, 6) });
    const paint = G.events.find((e) => e.type === 'change' && e.cause === 'arrive' && e.who === 'rowan');
    ok(paint && paint.changes.length >= 1 && paint.changes.every((c) => c.tok.c === 0), 'Rowan paints the stones beside him Ember when he arrives');

    // the enemy's turn and shields
    G = battle(25);
    const hp0 = G.B.hp;
    G.B.enemy.cd = 1;
    G.B.g[idx(0, 6)] = T(1, 0); G.B.g[idx(1, 6)] = T(1, 1); G.B.g[idx(2, 5)] = T(1, 2);
    G.B.enemy.hp = 99999;
    Gm.act(G, { t: 'swap', i: idx(2, 5), j: idx(2, 6) });
    const strike = G.events.find((e) => e.type === 'enemyTurn');
    ok(strike && strike.kind === 'strike' && G.B.hp === hp0 - strike.dmg && strike.dmg > 0, 'when its count reaches zero the enemy strikes the party');
    ok(G.B.enemy.cd === G.B.enemy.cdMax, 'and its count resets');
    G.B.shield = 1000; G.B.enemy.cd = 1;
    const hp1 = G.B.hp;
    G.B.g = quietBoard();
    Gm.act(G, ready(G));
    ok(G.B.hp === hp1 && G.B.shield < 1000, 'a shield takes the blow');

    // skills
    G = battle(26);
    r = Gm.act(G, { t: 'skill', k: 0 });
    ok(!r.ok && r.why === 'not charged', 'an uncharged skill does nothing');
    G.B.party[0].charge = D.HERO[G.B.party[0].id].skill.cost;
    const e0 = G.B.enemy.hp;
    r = Gm.act(G, { t: 'skill', k: 0 });
    ok(r.ok && G.B.enemy.hp < e0 && G.B.party[0].charge === 0, 'Brave Cleave strikes and spends the charge');
    ok(G.B.turn === 0, 'a skill costs no turn');
    G.B.hp = 1;
    G.B.party[1].charge = 99;
    Gm.act(G, { t: 'skill', k: 1 });
    ok(G.B.hp === 1 + Math.round(G.B.maxHp * 0.3), 'Tidal Mend heals 30%');
    const ch = G.B.party[0].charge;
    G.B.g[idx(0, 6)] = T(0, 0); G.B.g[idx(1, 6)] = T(0, 1); G.B.g[idx(2, 5)] = T(0, 2);
    Gm.act(G, { t: 'swap', i: idx(2, 5), j: idx(2, 6) });
    ok(G.B.party[0].charge >= ch + 3, 'clearing Ember stones charges Rowan');

    // waves, winning, rewards
    G = battle(27, 1);
    ok(G.B.waves.length === 2, 'stage 2 has two waves');
    G.B.enemy.hp = 1;
    Gm.act(G, ready(G));
    ok(G.B.wave === 1 && G.B.enemy.id === 'wolf' && !G.B.over, 'beating the first wave brings the second');
    G.B.enemy.hp = 1;
    G.B.g = quietBoard();
    G.B.g[idx(0, 6)] = T(1, 0); G.B.g[idx(1, 6)] = T(1, 1); G.B.g[idx(2, 5)] = T(1, 2);
    const cr = G.crystals;
    Gm.act(G, { t: 'swap', i: idx(2, 5), j: idx(2, 6) });
    ok(G.B.over === 'win' && G.B.reward.first && G.crystals > cr + 100, 'the last wave wins, with a first-win bonus');
    ok(G.progress === 2 && G.cleared[1] === 1, 'and opens the next stage');
    ok(!Gm.act(G, { t: 'battle', stage: 5 }).ok, 'a locked stage cannot be fought');
    ok(Gm.act(G, { t: 'leave' }).ok && G.B === null, 'leave returns to camp');

    // losing keeps the heroes you bound
    G = battle(28);
    G.B.hp = 1; G.B.enemy.cd = 1; G.B.enemy.hp = 99999;
    G.roster.tess = { lv: 1, xp: 0, rank: 0 };
    Gm.act(G, ready(G));
    ok(G.B.over === 'loss' && G.roster.tess, 'a defeat keeps the roster');
    ok(G.B.reward && G.B.reward.crystals > 0, 'and pays a little');

    // party
    G = Gm.newGame(29);
    ok(!Gm.act(G, { t: 'party', ids: ['nyx'] }).ok, 'an unbound hero cannot join the party');
    ok(Gm.act(G, { t: 'party', ids: ['lyra'] }).ok && G.party.join() === 'lyra', 'a party of one is allowed');
    ok(!Gm.act(G, { t: 'party', ids: [] }).ok, 'an empty party is not');

    // every hero's data is complete and every oath and effect is known
    const known = new Set(['paint', 'mould', 'bind', 'unbind', 'wild', 'scatter', 'shatter', 'charge', 'delay', 'strike', 'mend', 'ward', 'quake', 'cleanse']);
    for (const h of D.HEROES) {
        ok(D.OATHS[h.oath] && h.skill.cost > 0 && h.arrive.fx.every(([k]) => known.has(k)) && h.skill.fx.every(([k]) => known.has(k)), `${h.name}: oath, arrival and skill are all known`);
        if (h.oath === 'vigil') ok(h.wake > 0, `${h.name}: a Vigil has a wake count`);
    }
    for (const id in D.ENEMIES) {
        const e = D.ENEMIES[id];
        ok(e.pattern.every((p) => D.ABILITY_TEXT[p.split(':')[0]]), `${e.name}: every turn of its pattern is described`);
    }
}

if (want('boards')) {
    section('boards');
    let bad = 0, n = 0;
    for (let s = 1; s <= 30; s++) for (let st = 0; st < D.STAGES.length; st++) {
        const G = Gm.newGame(s * 101 + st);
        G.progress = D.STAGES.length - 1;
        Gm.act(G, { t: 'battle', stage: st });
        n++;
        if (Bd.findClears(G.B.g, 1).clear.length || !Bd.findMoves(G.B.g, 1).length || !G.B.g.every(Boolean)) bad++;
    }
    ok(bad === 0, `${n} boards: nothing waiting to clear, a move to make, no holes (${bad} bad)`);
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, n) => {
        const G = Gm.newGame(seed), b = Bt.makeBot({ skill: 1, seed: 5 });
        for (let k = 0; k < n; k++) { const c = Bt.botCommand(G, b); if (!c) break; Gm.act(G, c); Bt.botResult(G, b); G.events.length = 0; }
        return G;
    };
    ok(JSON.stringify(Gm.serialize(play(42, 120))) === JSON.stringify(Gm.serialize(play(42, 120))), 'same seed and commands, same game');
    const G = play(7, 40);
    let guard = 0;
    while (!(G.B && !G.B.over) && guard++ < 20) { const c = Bt.campCommand(G, Bt.makeBot()); Gm.act(G, c); }
    ok(G.B && !G.B.over, 'test setup: mid-battle');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
    for (let k = 0; k < 30; k++) {
        const c1 = Bt.botCommand(G, b1), c2 = Bt.botCommand(copy, b2);
        if (!c1) break;
        Gm.act(G, c1); Gm.act(copy, c2);
    }
    G.events.length = copy.events.length = 0;
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-battle plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('campaign')) {
    section('campaign');
    const rows = [];
    const tally = {};
    for (const skill of [1, 0]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 977), bot = Bt.makeBot({ skill, seed: s });
            let battles = 0, cmds = 0, bad = null;
            while (!G.done && battles < 160 && cmds < 400000 && !bad) {
                const c = Bt.botCommand(G, bot);
                cmds++;
                if (!c) { bad = 'the bot found no command'; break; }
                const r = Gm.act(G, c);
                G.events.length = 0;
                if (!r.ok) { bad = `command refused: ${JSON.stringify(c)} ${r.why}`; break; }
                if (c.t === 'battle') battles++;
                const B = G.B;
                if (B && (c.t === 'swap' || c.t === 'skill' || c.t === 'battle')) {
                    if (!B.g.every(Boolean)) bad = 'a hole in the board';
                    else if (new Set(B.g.map((t) => t.id)).size !== N) bad = 'two tokens share an id';
                    else if (!B.over && !Bd.findMoves(B.g, 1).length) bad = 'no move left';
                    else if (!B.over && Bd.findClears(B.g, 2).clear.length) bad = 'a line left waiting';
                    else if (B.g.filter((t) => t.h).length > C.CALLS.maxOnBoard) bad = 'too many heroes on the board';
                    else if (B.hp < 0 || B.hp > B.maxHp || B.enemy.hp < 0 || !Number.isFinite(B.enemy.hp)) bad = 'hit points out of range';
                }
                if (B?.over && !B.counted) {
                    B.counted = true;
                    Bt.botResult(G, bot);
                    const k = `${skill}:${B.stage}`;
                    tally[k] = tally[k] || { w: 0, l: 0, turns: 0, hp: 0 };
                    tally[k][B.over === 'win' ? 'w' : 'l']++;
                    if (B.over === 'win') { tally[k].turns += B.turn; tally[k].hp += B.hp / B.maxHp; }
                }
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ skill, seed: s, done: G.done, battles, losses: G.stats.losses, heroes: Object.keys(G.roster).length, pulls: G.stats.pulls });
        }
    }
    const avg = (sk, f) => rows.filter((r) => r.skill === sk).reduce((a, r) => a + f(r), 0) / SEEDS;
    ok(rows.filter((r) => r.skill === 1).every((r) => r.done), 'the good bot beats the Oathbreaker on every seed');
    ok(avg(1, (r) => r.losses) < avg(0, (r) => r.losses), `the good bot loses less than a random one (${avg(1, (r) => r.losses).toFixed(1)} vs ${avg(0, (r) => r.losses).toFixed(1)})`);
    ok(avg(0, (r) => r.losses) >= 2, 'a random player has to come back from defeats');
    ok(rows.every((r) => r.heroes >= 8), 'every campaign binds at least eight heroes');
    console.log('  stage  ' + D.STAGES.map((_, i) => String(i + 1).padStart(4)).join(''));
    for (const sk of [1, 0]) {
        console.log(`  s${sk} win% ` + D.STAGES.map((_, i) => { const t = tally[`${sk}:${i}`]; return t ? String(Math.round((100 * t.w) / (t.w + t.l))).padStart(4) : '   -'; }).join(''));
        console.log(`  s${sk} hp%  ` + D.STAGES.map((_, i) => { const t = tally[`${sk}:${i}`]; return t && t.w ? String(Math.round((100 * t.hp) / t.w)).padStart(4) : '   -'; }).join(''));
        console.log(`  s${sk} turns` + D.STAGES.map((_, i) => { const t = tally[`${sk}:${i}`]; return t && t.w ? String(Math.round(t.turns / t.w)).padStart(4) : '   -'; }).join(''));
    }
    for (const sk of [1, 0]) console.log(`  skill ${sk}: ${avg(sk, (r) => r.battles).toFixed(1)} battles, ${avg(sk, (r) => r.losses).toFixed(1)} losses, ${avg(sk, (r) => r.heroes).toFixed(1)} heroes, ${avg(sk, (r) => r.pulls).toFixed(0)} calls`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
