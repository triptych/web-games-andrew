/**
 * simtest.mjs — headless checks of SOLITAIRE FROM OUTER SPACE's simulation. No browser.
 *
 *   node game-116/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-116/dev/simtest.mjs
 *   SEEDS=60 VERBOSE=1 node game-116/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the
 *    clock, and never import the view, the UI or the audio.
 * 2. data: layouts fit 7 cards wide, every creature has a layout, moves and a drawer, every card,
 *    gadget and souvenir has words, events are well formed.
 * 3. rules: the beam (±1, K–A wrap), cover and flips, the four suits and the chain, draws and Quick,
 *    End Turn and every kind of creature move, Static and Slime, freezing, the Clean Sweep, gadgets
 *    (Wild Beam, Disintegrator, Jetpack, Freeze Ray), winning and losing a fight.
 * 4. run: maps proved over 300 seeds (no crossing paths, every stop reachable and leading to the
 *    boss, fixed rows), the store, removal down to the minimum deck, the diner, every broadcast
 *    option, rewards, gadget swaps and the walk from reel to reel.
 * 5. determinism: same seed and commands → same run; a save round trip mid-fight plays on identically;
 *    an unknown save version is rejected.
 * 6. bot: whole runs on SEEDS seeds at two skill levels with per-command invariants, and the
 *    balance table (win rate, where runs end, HP lost per fight by reel and tier).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 40);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const Gm = await import('../js/sim/game.js');
const Ba = await import('../js/sim/battle.js');
const Ru = await import('../js/sim/run.js');
const Bt = await import('../js/sim/bot.js');
const Tx = await import('../js/sim/text.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);

/** A fresh run with a fight set up against `key`, with the table and stock under our control. */
function fight(key = 'ant', seed = 1) {
    const G = Gm.newGame(seed);
    G.phase = 'battle';
    Ba.startBattle(G, key);
    G.events.length = 0;
    return G;
}
/** Lay out a custom table: cards = [{ r, s, row, col }]. */
function setTable(G, cards) {
    const B = G.battle;
    B.tab = cards.map((c, i) => ({ id: 100 + i, up: false, frozen: false, ...c }));
    for (const c of B.tab) c.up = !Ba.covered(B, c);
}
const beamTab = (r, s = 0) => ({ r, s, src: 'tab' });

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('data')) {
    section('data');
    for (const [k, L] of Object.entries(D.LAYOUTS)) {
        const cols = L.flat();
        ok(Math.max(...cols) <= 12 && Math.min(...cols) >= 0, `layout ${k} fits 7 cards wide`);
        ok(L.length <= 7, `layout ${k} has at most 7 rows`);
        const seen = new Set();
        let dup = false;
        L.forEach((row, r) => row.forEach((c) => { const key = `${r}:${c}`; if (seen.has(key)) dup = true; seen.add(key); }));
        ok(!dup, `layout ${k} has no two cards in one place`);
        ok(L[L.length - 1].length >= 2, `layout ${k} starts with at least two cards face up`);
    }
    const art = await import('../js/view/art.js').catch(() => null);
    for (const [k, e] of Object.entries(D.ENEMIES)) {
        ok(!!D.LAYOUTS[e.layout], `${k} has a layout`);
        ok(e.moves.length >= 2 && e.moves.every((m) => ['atk', 'atkblock', 'block', 'buff', 'jam', 'freeze', 'drain', 'wind'].includes(m.t)), `${k} has known moves`);
        ok(e.moves.every((m) => Tx.intentText({ ...m, dmg: m.n }).length > 0), `${k}'s moves all have badge text`);
        if (art) ok(art.ART_KINDS.includes(e.art), `${k} has a drawer (${e.art})`);
    }
    for (const r of D.REELS) {
        ok([...r.fights, ...r.elites, r.boss].every((k) => D.ENEMIES[k]), `${r.title}: every creature exists`);
        ok(D.ENEMIES[r.boss].boss && r.elites.every((k) => D.ENEMIES[k].elite), `${r.title}: boss and elites are marked`);
    }
    for (const k of Object.keys(D.CARDS)) {
        ok(Tx.cardText({ k, r: 5 }).length > 3 && (D.CARDS[k].junk || Tx.cardText({ k, r: 5, up: true }).length > 3), `card ${k} has words, upgraded too`);
        if (!D.CARDS[k].junk && k !== 'plain') ok(Tx.cardText({ k, up: true }) !== Tx.cardText({ k }), `upgrading ${k} changes it`);
    }
    for (const pool of Object.values(D.CARD_POOL)) for (const k of pool) ok(!!D.CARDS[k], `pooled card ${k} exists`);
    for (const k of Object.keys(D.GADGETS)) ok(D.GADGETS[k].cost > 0 && D.GADGETS[k].cost <= C.CHARGE_MAX && D.GADGETS[k].text, `gadget ${k} is affordable and described`);
    for (const k of Object.keys(D.RELICS)) ok(D.RELICS[k].icon && D.RELICS[k].text, `souvenir ${k} is described`);
    for (const t of Object.values(D.RELIC_POOL)) for (const k of t) ok(!!D.RELICS[k], `pooled souvenir ${k} exists`);
    for (const [k, ev] of Object.entries(D.EVENTS)) ok(ev.options.length >= 2 && ev.options.every((o) => o.label && o.result && o.do), `event ${k} is well formed`);
}

if (want('rules')) {
    section('rules');
    ok(Ba.rankFits(5, 6) && Ba.rankFits(6, 5) && Ba.rankFits(13, 1) && Ba.rankFits(1, 13), 'one up, one down, and K–A wrap round');
    ok(!Ba.rankFits(5, 5) && !Ba.rankFits(5, 7), 'the same rank and two apart do not fit');

    let G = fight('ant', 3);
    let B = G.battle;
    ok(B.tab.length === D.LAYOUTS[B.layout].flat().length, 'the table is dealt in the layout');
    ok(B.tab.every((c) => c.up === !Ba.covered(B, c)), 'exactly the uncovered cards are face up');
    ok(B.beam && B.draws === C.DRAWS_PER_TURN, 'a turn starts with a beam card and the full draws');

    // cover and flip: a 2-card pyramid
    setTable(G, [{ r: 5, s: 0, row: 0, col: 1 }, { r: 7, s: 2, row: 1, col: 0 }, { r: 9, s: 2, row: 1, col: 2 }]);
    B.beam = beamTab(8);
    ok(!B.tab[0].up && B.tab[1].up && B.tab[2].up, 'a card covered by the row below is face down');
    B.enemy.hp = 999; B.enemy.maxHp = 999;
    ok(!Gm.act(G, { t: 'play', id: 100 }), 'a face-down card cannot be played');
    ok(Gm.act(G, { t: 'play', id: 101 }), 'a card one lower than the beam plays');
    ok(B.beam.r === 7 && B.plays === 1, 'it becomes the beam, chain 1');
    ok(B.block === 2 + 1, 'a Shield gives 2 + chain block');
    ok(!B.tab.find((c) => c.id === 100).up, 'a card half-uncovered stays face down');
    ok(!Gm.act(G, { t: 'play', id: 102 }), 'a card two away does not fit');
    // rays and rockets with the chain
    setTable(G, [{ r: 8, s: 0, row: 0, col: 0 }, { r: 9, s: 1, row: 0, col: 2 }, { r: 10, s: 3, row: 0, col: 4 }]);
    B.beam = beamTab(7); B.plays = 2; B.enemy.block = 0;
    let hp0 = B.enemy.hp;
    Gm.act(G, { t: 'play', id: 100 });
    ok(hp0 - B.enemy.hp === 2 + 3, 'a Ray at chain 3 deals 2 + 3');
    B.enemy.block = 50; hp0 = B.enemy.hp;
    Gm.act(G, { t: 'play', id: 101 });
    ok(hp0 - B.enemy.hp === 1 + 4 && B.enemy.block === 50, 'a Rocket at chain 4 deals 1 + 4 straight through shields');
    const ch0 = B.charge;
    Gm.act(G, { t: 'play', id: 102 });
    ok(B.charge === ch0 + 2, 'an Atom from the 4th card of a chain gives 2 charge');
    ok(G.events.some((e) => e.type === 'sweep') && B.tab.length > 0, 'clearing the table is a Clean Sweep and deals a new one');

    // a Ray against block
    G = fight('ant', 4); B = G.battle;
    setTable(G, [{ r: 2, s: 0, row: 0, col: 0 }, { r: 9, s: 0, row: 0, col: 4 }]);
    B.beam = beamTab(1); B.enemy.block = 3; hp0 = B.enemy.hp;
    Gm.act(G, { t: 'play', id: 100 });
    ok(B.enemy.block === 0 && hp0 - B.enemy.hp === 0, 'a Ray is soaked by the creature\'s block first');

    // draws, Quick and End Turn
    G = fight('ant', 5); B = G.battle;
    B.enemy.hp = 999;
    const plain = { uid: 900, k: 'plain', r: 4, s: 0, src: 'deck' };
    const boots = { uid: 901, k: 'jet_boots', r: 9, s: -1, src: 'deck' };
    B.stock = [plain, { ...plain, uid: 902 }, boots];   // the top of the stock is the end
    Gm.act(G, { t: 'draw' });
    ok(B.beam.uid === 901 && B.draws === C.DRAWS_PER_TURN && B.block >= 3, 'a Quick card gives the draw back (Jet Boots also block)');
    Gm.act(G, { t: 'draw' });
    ok(B.draws === C.DRAWS_PER_TURN - 1, 'a plain draw uses one draw');
    Gm.act(G, { t: 'draw' });
    ok(B.draws === C.DRAWS_PER_TURN - 1 || B.draws === 0, 'draws count down');
    while (B.draws > 0) Gm.act(G, { t: 'draw' });
    ok(!Gm.act(G, { t: 'draw' }), 'no draws left: drawing is refused');
    B.enemy.intent = { t: 'atk', n: 6, hits: 1 }; B.enemy.dmul = 1; B.enemy.str = 0; B.enemy.weak = 0;
    B.block = 4; const hpP = G.hp;
    const turn0 = B.turn;
    Gm.act(G, { t: 'end' });
    ok(G.hp === hpP - 2, 'End Turn: the creature attacks, block soaks the first 4 of 6');
    ok(B.turn === turn0 + 1 && B.plays === 0 && B.block === 0 && B.draws === C.DRAWS_PER_TURN, 'a new turn: chain 0, block gone, draws back');
    ok(G.events.filter((e) => e.type === 'draw' && e.free).length >= 1, 'the new turn starts with a free beam card');

    // creature moves
    const move = (m, setup) => { const g = fight('ant', 6); const b = g.battle; b.enemy.hp = 999; b.enemy.intent = m; b.enemy.dmul = 1; setup?.(g, b); Gm.act(g, { t: 'end' }); return g; };
    G = move({ t: 'block', n: 9 });
    ok(G.battle.enemy.block === 9, 'block: the creature shields');
    G = move({ t: 'buff', str: 2 });
    ok(G.battle.enemy.str === 2 && Ba.intentInfo(G.battle).dmg == null || Ba.hitFor(G.battle.enemy, 5) === 7, 'buff: strength adds to every hit');
    G = move({ t: 'jam', junk: 'static', count: 2, n: 0 });
    ok(G.battle.stock.filter((c) => c.k === 'static').length + (G.battle.beam.k === 'static' ? 1 : 0) === 2, 'jam: two Static go into the stock');
    G = move({ t: 'jam', junk: 'static', count: 2, n: 0 }, (g) => g.relics.push('tinfoil_hat'));
    ok(!G.battle.stock.some((c) => c.k === 'static'), 'the Tin Foil Hat keeps Static out');
    G = move({ t: 'freeze', count: 2, n: 0 });
    const frozen = G.battle.tab.filter((c) => c.frozen);
    ok(frozen.length === 2, 'freeze: two face-up cards freeze');
    G.battle.beam = beamTab(frozen[0].r === 13 ? 12 : frozen[0].r + 1);
    ok(!Gm.act(G, { t: 'play', id: frozen[0].id }), 'a frozen card cannot be played');
    G.battle.enemy.intent = { t: 'wind' };
    Gm.act(G, { t: 'end' });
    ok(!G.battle.tab.some((c) => c.frozen), 'frozen cards thaw at the creature\'s next move');
    G = move({ t: 'drain', n: 6 }, (g, b) => { b.enemy.hp = 500; b.enemy.maxHp = 999; b.block = 0; });
    ok(G.battle.enemy.hp === 506, 'drain: the creature heals what got through');
    G = move({ t: 'atk', n: 8, hits: 1 }, (g, b) => { b.enemy.weak = 1; b.block = 0; });
    ok(G.hp === 60 - 6, 'Dazed: a quarter off (8 → 6)');

    // Static and Slime on the beam
    G = fight('ant', 7); B = G.battle; B.enemy.hp = 999;
    B.stock = [{ uid: -1, k: 'static', r: 0, s: -1, src: 'deck', temp: true }];
    B.discard = [];
    Gm.act(G, { t: 'draw' });
    ok(Ba.playableCards(B).length === 0, 'nothing fits on Martian Static');
    B.stock = [{ uid: 5, k: 'plain', r: 4, s: 0, src: 'deck' }];
    Gm.act(G, { t: 'draw' });
    ok(!B.discard.some((c) => c.k === 'static'), 'covered Static burns up instead of going to the discard');
    const hpS = G.hp;
    B.stock = [{ uid: -1, k: 'slime', r: 3, s: -1, src: 'deck', temp: true }];
    B.draws = 1; B.block = 0;
    Gm.act(G, { t: 'draw' });
    ok(G.hp === hpS - 3, 'Space Slime hurts when it lands');
    // reshuffle
    G = fight('ant', 8); B = G.battle; B.enemy.hp = 999;
    B.discard = B.stock.splice(0);
    Gm.act(G, { t: 'draw' });
    ok(G.events.some((e) => e.type === 'reshuffle'), 'an empty stock reshuffles the discard');

    // gadgets
    G = fight('ant', 9); B = G.battle; B.enemy.hp = 999; B.charge = 0;
    ok(!Gm.act(G, { t: 'gadget', i: 0 }), 'a gadget needs its charge');
    B.charge = 9;
    hp0 = B.enemy.hp;
    Gm.act(G, { t: 'gadget', i: G.gadgets.indexOf('ray_pistol') });
    ok(hp0 - B.enemy.hp === 8 && B.charge === 6, 'the Ray Pistol deals 8 for 3 charge');
    setTable(G, [{ r: 11, s: 0, row: 0, col: 0 }]);
    B.beam = beamTab(3);
    ok(!Gm.act(G, { t: 'play', id: 100 }), 'a J does not fit on a 3...');
    Gm.act(G, { t: 'gadget', i: G.gadgets.indexOf('wild_beam') });
    ok(Gm.act(G, { t: 'play', id: 100 }), '...until the Wild Beam');
    ok(!B.wildBeam, 'the Wild Beam lasts one card');
    G.gadgets = ['disintegrator', 'jetpack', 'freeze_ray'];
    setTable(G, [{ r: 5, s: 0, row: 0, col: 1 }, { r: 9, s: 0, row: 1, col: 0 }]);
    B.charge = 9;
    ok(!Gm.act(G, { t: 'gadget', i: 0, target: 100 }), 'the Disintegrator needs a face-up target');
    ok(Gm.act(G, { t: 'gadget', i: 0, target: 101 }) && B.tab.length === 1 && B.tab[0].up, 'the Disintegrator vaporizes a card and uncovers what was under it');
    const dr = B.draws;
    B.stock.push({ uid: 7, k: 'plain', r: 4, s: 0, src: 'deck' });
    Gm.act(G, { t: 'gadget', i: 1 });
    ok(B.draws === dr && B.beam.uid === 7, 'the Jetpack draws for free');
    Gm.act(G, { t: 'gadget', i: 2 });
    B.enemy.intent = { t: 'atk', n: 50, hits: 1 };
    const hpF = G.hp;
    Gm.act(G, { t: 'end' });
    ok(G.hp === hpF && !B.enemy.stun, 'the Freeze Ray skips the creature\'s move');

    // cards from the deck
    G = fight('ant', 10); B = G.battle; B.enemy.hp = 999; B.enemy.block = 0;
    B.stock = [{ uid: 1, k: 'meteor', r: 13, s: -1, src: 'deck' }];
    hp0 = B.enemy.hp;
    Gm.act(G, { t: 'draw' });
    ok(hp0 - B.enemy.hp === 9, 'a Meteor Shower hits 3 × 3');
    B.stock = [{ uid: 2, k: 'chain_rx', r: 6, s: -1, src: 'deck' }];
    B.draws = 1; const chainBefore = B.chainBase;
    Gm.act(G, { t: 'draw' });
    ok(B.chainBase === chainBefore + 2, 'Chain Reaction jumps the chain by 2');
    B.stock = [{ uid: 3, k: 'wild', r: 0, s: -1, src: 'deck' }];
    B.draws = 1;
    Gm.act(G, { t: 'draw' });
    setTable(G, [{ r: 11, s: 2, row: 0, col: 0 }]);
    ok(Gm.act(G, { t: 'play', id: 100 }), 'anything fits on a Wild Card');

    // winning and losing
    G = fight('ant', 11); B = G.battle;
    B.enemy.hp = 1; B.enemy.block = 0; B.charge = 3;
    Gm.act(G, { t: 'gadget', i: G.gadgets.indexOf('ray_pistol') });
    ok(G.phase === 'reward' && G.offer.cards.length === 3 && G.bucks > C.START.bucks, 'a won fight pays bucks and offers three cards');
    G = fight('ant', 12); B = G.battle;
    G.hp = 1; B.block = 0; B.enemy.intent = { t: 'atk', n: 20, hits: 1 };
    Gm.act(G, { t: 'end' });
    ok(G.over && !G.won && G.phase === 'over', 'losing every HP ends the run');
}

if (want('run')) {
    section('run');
    let bad = 0;
    for (let s = 1; s <= 300; s++) {
        const G = Gm.newGame(s * 31);
        for (let a = 0; a < 3; a++) {
            G.act = a;
            const M = Ru.makeMap(G);
            const N = M.nodes;
            const boss = N[M.boss];
            // no crossing
            for (const n of N) for (const m of N) {
                if (n.row !== m.row || n === m || n.type === 'boss') continue;
                for (const a1 of n.next) for (const b1 of m.next) {
                    if (N[a1].type === 'boss') continue;
                    if ((n.lane - m.lane) * (N[a1].lane - N[b1].lane) < 0) bad++;
                }
            }
            // every node is reachable from row 0 and leads to the boss
            const reach = new Set(N.filter((n) => n.row === 0).map((n) => n.id));
            for (const n of N) if (reach.has(n.id)) for (const x of n.next) reach.add(x);
            if (reach.size !== N.length) bad++;
            const toBoss = new Set([boss.id]);
            for (let r = C.MAP.rows - 1; r >= 0; r--) for (const n of N) if (n.row === r && n.next.some((x) => toBoss.has(x))) toBoss.add(n.id);
            if (toBoss.size !== N.length) bad++;
            if (N.some((n) => n.row === 0 && n.type !== 'fight')) bad++;
            if (N.some((n) => n.row === 3 && n.type !== 'treasure')) bad++;
            if (N.some((n) => n.row === C.MAP.rows - 1 && n.type !== 'rest')) bad++;
            if (N.some((n) => n.row < 2 && n.type === 'elite')) bad++;
            if (!N.some((n) => n.type === 'shop')) bad++;
            if (N.filter((n) => n.row === 0).length < 2) bad++;
        }
    }
    ok(bad === 0, `300 seeds × 3 reels of maps: no crossings, all reachable, all lead to the boss, rows typed (${bad} problems)`);

    // travel
    let G = Gm.newGame(5);
    ok(G.phase === 'intro' && !Gm.act(G, { t: 'go', id: 0 }), 'the reel card comes first');
    Gm.act(G, { t: 'done' });
    const starts = Ru.choices(G);
    ok(starts.length >= 2 && starts.every((id) => G.map.nodes[id].row === 0), 'start on any stop in the bottom row');
    const notNext = G.map.nodes.find((n) => n.row === 2);
    ok(!Gm.act(G, { t: 'go', id: notNext.id }), 'you cannot skip ahead');
    Gm.act(G, { t: 'go', id: starts[0] });
    ok(G.phase === 'battle' && G.battle, 'a fight stop starts a fight');

    // the store
    G = Gm.newGame(6); G.phase = 'shop'; G.offer = { kind: 'shop', cards: [{ k: 'wild', up: false, price: 50, sold: false }], gadget: { k: 'jetpack', price: 80, sold: false }, relic: { k: 'jukebox', price: 130, sold: false }, removeUsed: false };
    G.bucks = 60;
    ok(!Gm.act(G, { t: 'buy', what: 'relic' }), 'you cannot buy what you cannot afford');
    ok(Gm.act(G, { t: 'buy', what: 'card', i: 0 }) && G.bucks === 10 && G.deck.some((c) => c.k === 'wild'), 'buying a card pays and adds it');
    ok(!Gm.act(G, { t: 'buy', what: 'card', i: 0 }), 'a sold card stays sold');
    G.bucks = 500;
    G.gadgets = ['ray_pistol', 'wild_beam', 'force_bubble'];
    ok(!Gm.act(G, { t: 'buy', what: 'gadget' }), 'a fourth gadget needs a slot to swap');
    ok(Gm.act(G, { t: 'buy', what: 'gadget', slot: 2 }) && G.gadgets[2] === 'jetpack', 'swapping a gadget');
    const price = G.removePrice;
    ok(Gm.act(G, { t: 'buy', what: 'remove' }) && G.pick, 'Card Disposal asks for a card');
    const n0 = G.deck.length, b0 = G.bucks;
    ok(Gm.act(G, { t: 'pick', uid: G.deck[0].uid }) && G.deck.length === n0 - 1 && G.bucks === b0 - price, 'removing a card costs the price');
    ok(G.removePrice === price + C.SHOP.removeStep && !Gm.act(G, { t: 'buy', what: 'remove' }), 'one removal a visit, and the next costs more');
    G.offer.removeUsed = false;
    G.deck = G.deck.slice(0, C.DECK_MIN);
    ok(!Gm.act(G, { t: 'buy', what: 'remove' }), `the deck never drops below ${C.DECK_MIN}`);
    ok(Gm.act(G, { t: 'done' }) && G.phase === 'map', 'leaving the store');

    // the diner
    G = Gm.newGame(7); G.phase = 'rest'; G.offer = { kind: 'rest' }; G.hp = 20;
    Gm.act(G, { t: 'rest', what: 'heal' });
    ok(G.hp === 20 + Math.round(60 * C.REST_HEAL) && G.phase === 'map', 'the diner heals 30%');
    G.phase = 'rest'; G.offer = { kind: 'rest' };
    Gm.act(G, { t: 'rest', what: 'upgrade' });
    const target = G.deck.find((c) => c.k === 'death_ray');
    ok(Gm.act(G, { t: 'pick', uid: target.uid }) && target.up && G.phase === 'map', 'tinkering upgrades the card you pick');
    G.phase = 'rest'; G.offer = { kind: 'rest' };
    Gm.act(G, { t: 'rest', what: 'upgrade' });
    ok(!Gm.act(G, { t: 'pick', uid: target.uid }), 'an upgraded card cannot be upgraded again');
    ok(Gm.act(G, { t: 'pick', uid: null }) && G.phase === 'rest', 'cancelling a pick goes back to the diner');

    // every broadcast option
    for (const [k, ev] of Object.entries(D.EVENTS)) {
        ev.options.forEach((opt, i) => {
            const g = Gm.newGame(40 + i);
            g.phase = 'event'; g.offer = { kind: 'event', k, chosen: -1, result: null, gadget: null, gadgetTaken: true };
            g.bucks = 100; g.hp = 30;
            const before = JSON.stringify([g.hp, g.maxHp, g.bucks, g.deck.length, g.relics.length]);
            const okc = Gm.act(g, { t: 'choose', i });
            if (g.pick) Gm.act(g, { t: 'pick', uid: g.deck[0].uid });
            if (g.offer.gadget && !g.offer.gadgetTaken) Gm.act(g, { t: 'take', what: 'gadget' });
            const after = JSON.stringify([g.hp, g.maxHp, g.bucks, g.deck.length, g.relics.length]);
            const changes = Object.keys(opt.do).length > 0;
            ok(okc && (changes ? before !== after || g.gadgets.length > 2 || g.deck.some((c) => c.up) : before === after) && Gm.act(g, { t: 'done' }) && g.phase === 'map', `${k} option ${i + 1} does what it says and moves on`);
        });
    }
    const gF = Gm.newGame(9); gF.phase = 'event'; gF.offer = { kind: 'event', k: 'fortune', chosen: -1, result: null }; gF.bucks = 10;
    ok(!Gm.act(gF, { t: 'choose', i: 0 }), 'an option you cannot afford is refused');
    const gC = Gm.newGame(9); gC.phase = 'event'; gC.offer = { kind: 'event', k: 'crashed_saucer', chosen: -1, result: null }; gC.hp = 3;
    Gm.act(gC, { t: 'choose', i: 0 });
    ok(gC.hp === 1 && !gC.over, 'a broadcast can hurt but never kills');

    // rewards and the walk through the reels
    G = Gm.newGame(12); G.phase = 'battle'; Ba.startBattle(G, 'gila'); G.battle.enemy.hp = 1; G.battle.charge = 9; G.act = 0;
    Gm.act(G, { t: 'gadget', i: 0 });
    ok(G.phase === 'reward' && G.offer.relics.length === 2, 'a boss offers a choice of two souvenirs');
    Gm.act(G, { t: 'take', what: 'relic', i: 1 });
    ok(!Gm.act(G, { t: 'take', what: 'relic', i: 0 }), 'and you only get one');
    Gm.act(G, { t: 'done' });
    ok(G.act === 1 && G.phase === 'intro' && G.pos == null && G.trail.length === 0, 'beating the boss rolls the next reel');
    G.act = 2; G.phase = 'battle'; Ba.startBattle(G, 'overlord'); G.battle.enemy.hp = 1; G.battle.charge = 9;
    Gm.act(G, { t: 'gadget', i: 0 });
    Gm.act(G, { t: 'done' });
    ok(G.over && G.won, 'beating the Overlord wins the run');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, n) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); for (let i = 0; i < n && !G.over; i++) { Gm.act(G, Bt.botCommand(G, b)); G.events.length = 0; } return G; };
    ok(JSON.stringify(Gm.serialize(play(42, 400))) === JSON.stringify(Gm.serialize(play(42, 400))), 'same seed and commands, same run');
    // a round trip in the middle of a fight
    const G = Gm.newGame(77);
    const b = Bt.makeBot({ seed: 3 });
    let n = 0;
    while (!(G.phase === 'battle' && G.battle.turn >= 2) && n++ < 2000) { Gm.act(G, Bt.botCommand(G, b)); G.events.length = 0; }
    ok(G.phase === 'battle', 'reached the middle of a fight');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
    for (let i = 0; i < 600; i++) {
        if (!G.over) Gm.act(G, Bt.botCommand(G, b1));
        if (!copy.over) Gm.act(copy, Bt.botCommand(copy, b2));
        G.events.length = 0; copy.events.length = 0;
    }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-fight plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    const G2 = Gm.newGame(1);
    const before = JSON.stringify(Gm.serialize(G2));
    ok(!Gm.act(G2, { t: 'play', id: 1 }) && !Gm.act(G2, { t: 'nonsense' }) && JSON.stringify(Gm.serialize(G2)) === before, 'an illegal command changes nothing');
}

if (want('bot')) {
    section('bot');
    const table = [];
    for (const skill of [1, 0.6]) {
        let wins = 0, illegal = 0, stuck = 0, broke = 0;
        const ends = {}, loss = {}, cnt = {};
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let n = 0, key = null, hp0 = 0;
            while (!G.over && n < C.BOT_GUARD) {
                if (G.phase === 'battle' && !key) { key = `${G.act + 1}:${G.battle.tier}`; hp0 = G.hp; }
                const cmd = Bt.botCommand(G, bot);
                if (!Gm.act(G, cmd)) { illegal++; console.log('    illegal', s, G.phase, JSON.stringify(cmd)); break; }
                G.events.length = 0;
                n++;
                if (key && G.phase !== 'battle') { loss[key] = (loss[key] || 0) + (hp0 - G.hp); cnt[key] = (cnt[key] || 0) + 1; key = null; }
                const B = G.battle;
                if (G.hp > G.maxHp || G.hp < 0 || G.bucks < 0 || G.deck.length < C.DECK_MIN || G.gadgets.length > C.GADGET_SLOTS ||
                    (B && (B.charge > C.CHARGE_MAX || B.charge < 0 || B.draws < 0 || B.enemy.hp < 0 || B.enemy.hp > B.enemy.maxHp))) { broke++; console.log('    invariant', s, G.phase); break; }
            }
            if (!G.over) stuck++;
            if (G.won) wins++;
            else if (G.over) { const k = `${G.act + 1}:${G.battle ? D.ENEMIES[G.battle.key].name : G.phase}`; ends[k] = (ends[k] || 0) + 1; }
        }
        ok(illegal === 0, `skill ${skill}: the bot never gives an illegal command`);
        ok(broke === 0, `skill ${skill}: HP, bucks, deck, gadgets, charge and draws stay in range`);
        ok(stuck === 0, `skill ${skill}: every run ends`);
        table.push({ skill, wins, ends, loss, cnt });
        console.log(`  skill ${skill}: won ${wins}/${SEEDS} (${Math.round((100 * wins) / SEEDS)}%)`);
        console.log('    runs end at:', Object.entries(ends).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(', ') || '—');
        console.log('    HP lost per fight:', Object.keys(loss).sort().map((k) => `${k} ${(loss[k] / cnt[k]).toFixed(1)}`).join(' · '));
    }
    const [p, c] = table;
    ok(p.wins > c.wins, `the careful bot wins more than the careless one (${p.wins} vs ${c.wins})`);
    ok(p.wins / SEEDS >= 0.25 && p.wins / SEEDS <= 0.85, `the careful bot wins between 25% and 85% of runs (${Math.round((100 * p.wins) / SEEDS)}%)`);
    ok(c.wins / SEEDS <= 0.5, `the careless bot wins at most half (${Math.round((100 * c.wins) / SEEDS)}%)`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
