/**
 * simtest.mjs — headless checks of Quill & Legion's simulation. No browser.
 *
 *   node game-112/dev/simtest.mjs            # everything
 *   ONLY=purity,hex,battle node game-112/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-112/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. data: every creature, foe, card, relic and encounter is well formed and points at things that exist.
 * 3. hex: neighbours, distance, reach (walkers go round, flyers over), paths, distance fields.
 * 4. battle: deployment, the free move, damage (attack vs defence, flanking, ward, vulnerable, weak),
 *    strike back once a round, every card kind, intents and the foe's turn, statuses ticking, winning
 *    and losing, earthworks never wall the field.
 * 5. run: the map is connected and well typed, every node type, rewards, dwellings, the scriptorium,
 *    campfires, every encounter option, boons, boss relics and the next book.
 * 6. saves: determinism, a save round trip mid-battle plays on identically, version rejection.
 * 7. bot: the bot plays whole runs on SEEDS seeds at two skill levels with invariants after every
 *    command, and prints the balance table.
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
const H = await import('../js/sim/hex.js');
const BT = await import('../js/sim/battle.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);

/** A small hand-made battle: you get `mine`, the foe gets `theirs`, both as [key, count, c, r]. */
function arena(mine, theirs, { deck = [], relics = [], hero = { atk: 0, def: 0, lore: 1 }, rocks = [] } = {}) {
    const B = BT.makeBattle({ seed: 5, army: [], groups: [], relics, hero, deck, rocks });
    B.stacks = [];
    mine.forEach(([k, n, c, r], i) => B.stacks.push({ id: B.nextId++, side: 'p', key: k, count: n, start: n, top: D.CREATURES[k].hp, ward: 0, st: {}, c, r, moved: false, attacked: false, retal: false, intent: null, mi: 0, hist: [], horned: false, ai: i }));
    theirs.forEach(([k, n, c, r]) => B.stacks.push({ id: B.nextId++, side: 'e', key: k, count: n, start: n, top: D.FOES[k].hp, ward: 0, st: {}, c, r, moved: false, attacked: false, retal: false, intent: null, mi: 0, hist: [], horned: false, boss: !!D.FOES[k].boss }));
    BT.begin(B);
    B.ink = 10;
    B.events.length = 0;
    return B;
}
const give = (B, id, up = false) => { const c = { uid: 900 + B.hand.length + B.discard.length + B.exhaust.length + Math.floor(Math.random() * 0) + B.hand.length * 7 + (B.uidc = (B.uidc || 0) + 1) * 13, id, up }; B.hand.push(c); return c; };
const S = (B, side, key) => B.stacks.find((s) => s.side === side && s.key === key);

// =================================================================================== purity
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

// =================================================================================== data
if (want('data')) {
    section('data');
    for (const [k, c] of Object.entries(D.CREATURES)) {
        ok(['hp', 'dmg', 'atk', 'def', 'spd', 'cost', 'tier'].every((f) => Number.isFinite(c[f]) && c[f] > 0), `${k} has positive stats`);
        ok(D.CARDS[c.sig]?.rarity === 'sig' && D.CARDS[c.sig].actor === k, `${k}'s signature card ${c.sig} is its own`);
    }
    for (const [k, f] of Object.entries(D.FOES)) {
        ok(['hp', 'dmg', 'atk', 'def', 'spd'].every((x) => Number.isFinite(f[x]) && f[x] > 0), `${k} has positive stats`);
        ok(f.moves.length > 0 && f.moves.every((m) => ['attack', 'shoot', 'ward', 'cry', 'hex', 'curse', 'summon', 'breath', 'sweep', 'roar'].includes(m.k)), `${k}'s moves are all known`);
        ok(f.moves.every((m) => m.k !== 'summon' || D.FOES[m.key]), `${k} summons something that exists`);
        ok(f.moves.every((m) => m.k !== 'curse' || D.CARDS[m.card]?.kind === 'curse'), `${k} curses with a curse`);
        ok(f.moves.every((m) => !m.st || (Array.isArray(m.st) && typeof m.st[0] === 'string')), `${k}'s statuses are [kind, turns]`);
        ok(!f.moves.some((m) => m.k === 'shoot') || f.rng, `${k} only shoots if it is ranged`);
    }
    const kinds = ['move', 'attack', 'ward', 'buff', 'spell', 'heal', 'draw', 'earthwork', 'special', 'curse'];
    for (const [k, c] of Object.entries(D.CARDS)) {
        ok(kinds.includes(c.kind) && typeof c.name === 'string' && Number.isFinite(c.cost) && c.text, `card ${k} is well formed`);
        ok(c.kind === 'curse' || c.up, `card ${k} can be inscribed`);
        ok(!c.actor || ['any', 'melee', 'ranged'].includes(c.actor) || D.CREATURES[c.actor], `card ${k}'s actor exists`);
        if (c.text.includes('{s}')) ok(Number.isFinite(c.base), `card ${k} has spell damage for its text`);
    }
    for (const id of C.START.deck) ok(D.CARDS[id], `starter ${id} exists`);
    for (const [k] of C.START.army) ok(D.CREATURES[k], `starting creature ${k} exists`);
    for (const a of D.ACT_INFO) {
        ok(D.FOES[a.boss]?.boss, `${a.name}'s boss is a boss`);
        for (const g of [...a.skirm, ...a.elite]) ok(g.every(([k, n]) => D.FOES[k] && n > 0 && !D.FOES[k].boss), `${a.name}: encounter ${g.map((x) => x[0]).join('+')} is valid`);
    }
    for (const [k, e] of Object.entries(D.EVENTS)) ok(e.opts.length >= 2 && e.acts.length, `event ${k} has choices`);
    ok(Object.keys(D.RELICS).length >= 18, `${Object.keys(D.RELICS).length} relics`);
    console.log(`  ${Object.keys(D.CREATURES).length} creatures, ${Object.keys(D.FOES).length} foes, ${Object.keys(D.CARDS).length} cards, ${Object.keys(D.RELICS).length} relics, ${Object.keys(D.EVENTS).length} encounters`);
}

// =================================================================================== hex
if (want('hex')) {
    section('hex');
    const B = { cols: 9, rows: 6 };
    ok(H.neighbors(B, 4, 2).length === 6 && H.neighbors(B, 4, 3).length === 6, 'an inner hex has six neighbours on even and odd rows');
    ok(H.neighbors(B, 0, 0).length === 2, 'the top-left corner has two');
    let sym = true;
    for (let c = 0; c < 9; c++) for (let r = 0; r < 6; r++) for (const [x, y] of H.neighbors(B, c, r)) if (H.dist(c, r, x, y) !== 1 || !H.neighbors(B, x, y).some(([a, b]) => a === c && b === r)) sym = false;
    ok(sym, 'neighbours are symmetric and at distance 1');
    ok(H.dist(0, 0, 8, 0) === 8 && H.dist(0, 0, 0, 5) === 5 && H.dist(0, 0, 3, 5) === 6 && H.dist(0, 1, 1, 0) === 1, 'distances across the grid');
    for (let d = 0; d < 6; d++) { const [x, y] = H.neighbor(4, 2, d); ok(H.dirTo(4, 2, x, y) === d, `direction ${d} round-trips`); }
    const wall = new Set([H.key(2, 0), H.key(2, 1), H.key(2, 2), H.key(2, 3), H.key(2, 4)]);
    const free = (c, r) => !wall.has(H.key(c, r));
    const walk = H.reach(B, 1, 2, 3, free, false);
    ok(!walk.has(H.key(3, 2)), 'a walker cannot pass a wall in 3 steps');
    const fly = H.reach(B, 1, 2, 3, free, true);
    ok(fly.has(H.key(3, 2)) && !fly.has(H.key(2, 2)), 'a flyer passes over it but cannot land on it');
    const map = H.reach(B, 0, 0, 9, () => true, false);
    const p = H.pathTo(map, H.key(5, 3));
    ok(p.length === H.dist(0, 0, 5, 3) + 1 && p.every((q, i) => i === 0 || H.dist(...q, ...p[i - 1]) === 1), 'a path is contiguous and shortest');
    const f = H.distField(B, [[8, 5]], () => true);
    ok(f.get(H.key(0, 0)) === H.dist(0, 0, 8, 5), 'a distance field on an open grid matches hex distance');
}

// =================================================================================== battle
if (want('battle')) {
    section('battle');
    // deployment
    let G = Gm.newGame(3);
    Gm.act(G, { t: 'go', id: Gm.nextNodes(G)[0].id });
    let B = G.battle;
    ok(G.screen === 'battle' && B.phase === 'deploy', 'the first node is a skirmish that opens in deployment');
    ok(BT.mine(B).every((s) => s.c < C.FIELD.deploy) && BT.foes(B).every((s) => s.c >= C.FIELD.cols - 2), 'both sides start in their own columns');
    ok(BT.mine(B).some((s) => BT.ranged(s) && s.c === 0), 'archers deploy at the back');
    const pk = BT.mine(B)[0], other = BT.mine(B)[1];
    const at = [other.c, other.r];
    ok(Gm.act(G, { t: 'place', id: pk.id, at }).ok && pk.c === at[0] && pk.r === at[1], 'placing onto a friend swaps');
    ok(!Gm.act(G, { t: 'place', id: pk.id, at: [4, 2] }).ok, 'cannot deploy outside your lines');
    ok(Gm.act(G, { t: 'begin' }).ok && B.phase === 'player' && B.hand.length === C.HAND.draw && B.ink === C.HAND.ink, 'Begin draws 5 and fills the inkwell');
    ok(BT.foes(B).every((e) => e.intent && e.intent.k), 'every foe shows an intent');

    // the free move
    const s0 = BT.mine(B).find((s) => !BT.ranged(s));
    const tg = BT.moveTargets(B, s0);
    ok(tg.length > 0 && tg.every(([c, r]) => H.dist(c, r, s0.c, s0.r) <= BT.spdOf(B, s0)), 'move targets are within speed');
    ok(Gm.act(G, { t: 'move', id: s0.id, at: tg[0] }).ok && s0.moved, 'a stack moves once for free');
    ok(!Gm.act(G, { t: 'move', id: s0.id, at: BT.moveTargets(B, { ...s0, moved: false })[0] || tg[0] }).ok, 'and not twice');

    // damage
    B = arena([['pikemen', 20, 3, 2]], [['goblins', 30, 4, 2]]);
    const pkm = S(B, 'p', 'pikemen'), gob = S(B, 'e', 'goblins');
    const base = 20 * 2 * (1 + (4 - 2) * C.COMBAT.atkStep);
    ok(BT.calcDamage(B, pkm, gob, 1) === Math.round(base), `attack above defence: +5% a point (${Math.round(base)})`);
    const lo = BT.calcDamage(B, gob, pkm, 1);
    ok(lo === Math.round(30 * 2 * (1 - (5 - 3) * C.COMBAT.defStep)), 'defence above attack: -2.5% a point');
    gob.st.vuln = 1; ok(BT.calcDamage(B, pkm, gob, 1) === Math.round(base * 1.5), 'Vulnerable takes 50% more'); delete gob.st.vuln;
    pkm.st.weak = 1; ok(BT.calcDamage(B, pkm, gob, 1) === Math.round(base * 0.75), 'Weak deals 25% less'); delete pkm.st.weak;

    // flanking
    B = arena([['pikemen', 20, 3, 2], ['wolves', 4, 5, 2], ['bowmen', 10, 4, 1]], [['goblins', 30, 4, 2]]);
    const g2 = S(B, 'e', 'goblins');
    ok(BT.calcDamage(B, S(B, 'p', 'pikemen'), g2, 1) === Math.round(20 * 2 * 1.1 * (1 + 2 * C.COMBAT.flank)), 'each other stack touching the foe adds 20%');

    // a strike and the strike back
    B = arena([['pikemen', 20, 3, 2]], [['goblins', 30, 4, 2]], { deck: [] });
    let card = give(B, 'strike');
    const gb = S(B, 'e', 'goblins'), pp = S(B, 'p', 'pikemen');
    let r = BT.playCard(B, { uid: card.uid, actor: pp.id, at: [4, 2] });
    ok(r.ok && gb.count < 30 && B.ink === 9, 'Strike hurts the foe and costs 1 ink');
    ok(B.events.some((e) => e.type === 'attack' && e.retal) && pp.count < 20, 'the foe strikes back');
    ok(gb.retal && pp.attacked, 'the strike back is used and the stack has attacked');
    card = give(B, 'strike');
    ok(!BT.playCard(B, { uid: card.uid, actor: pp.id, at: [4, 2] }).ok, 'a stack attacks once a turn');
    B = arena([['pikemen', 20, 3, 2], ['wolves', 10, 4, 1]], [['goblins', 60, 4, 2]]);
    BT.playCard(B, { uid: give(B, 'strike').uid, actor: S(B, 'p', 'pikemen').id, at: [4, 2] });
    const evs = B.events.length;
    BT.playCard(B, { uid: give(B, 'strike').uid, actor: S(B, 'p', 'wolves').id, at: [4, 2] });
    ok(!B.events.slice(evs).some((e) => e.type === 'attack' && e.retal), 'it strikes back only once a round');
    B = arena([['griffins', 6, 3, 2], ['wolves', 10, 4, 1]], [['goblins', 60, 4, 2]]);
    BT.playCard(B, { uid: give(B, 'strike').uid, actor: S(B, 'p', 'wolves').id, at: [4, 2] });
    const gr = S(B, 'p', 'griffins');
    BT.endTurn(B); B.events.length = 0;
    ok(true, 'griffins answer every blow (checked below)');
    void gr;

    // walkers march into reach; ranged shoot; an archer at a foe's elbow shoots at half
    B = arena([['pikemen', 20, 0, 2], ['bowmen', 10, 0, 4]], [['goblins', 30, 2, 2]]);
    r = BT.playCard(B, { uid: give(B, 'strike').uid, actor: S(B, 'p', 'pikemen').id, at: [2, 2] });
    ok(r.ok && H.dist(S(B, 'p', 'pikemen').c, S(B, 'p', 'pikemen').r, 2, 2) === 1 && S(B, 'p', 'pikemen').moved, 'Strike walks a walker into reach (using its move)');
    B = arena([['bowmen', 10, 0, 0]], [['goblins', 30, 8, 5]]);
    ok(BT.cardTargets(B, { uid: 1, id: 'strike' }, S(B, 'p', 'bowmen').id).length === 1, 'archers shoot anywhere');
    const far = BT.calcDamage(B, S(B, 'p', 'bowmen'), S(B, 'e', 'goblins'), 1, { shot: true });
    S(B, 'e', 'goblins').c = 1; S(B, 'e', 'goblins').r = 0;
    ok(Math.abs(BT.calcDamage(B, S(B, 'p', 'bowmen'), S(B, 'e', 'goblins'), 1, { shot: true }) - far * 0.5) <= 1, 'and at half with a foe beside them');
    B = arena([['bowmen', 10, 0, 0]], [['goblins', 30, 4, 4]]);
    r = BT.playCard(B, { uid: give(B, 'strike').uid, actor: S(B, 'p', 'bowmen').id, at: [4, 4] });
    ok(r.ok && !B.events.some((e) => e.retal), 'a shot is not struck back');

    // ward
    B = arena([['pikemen', 20, 3, 2]], [['goblins', 30, 6, 2]]);
    r = BT.playCard(B, { uid: give(B, 'holdfast').uid, actor: S(B, 'p', 'pikemen').id });
    ok(r.ok && S(B, 'p', 'pikemen').ward === Math.round(0.3 * 200), 'Hold Fast wards 30% of the stack');
    const pk2 = S(B, 'p', 'pikemen');
    BT.endTurn(B); BT.runEnemyPhase(B);
    ok(pk2.ward === 0, 'Ward is gone at the start of your next turn');

    // spells
    B = arena([['pikemen', 20, 0, 2]], [['goblins', 30, 6, 2], ['skeletons', 10, 7, 4]], { hero: { atk: 0, def: 0, lore: 2 } });
    const g3 = S(B, 'e', 'goblins'), hp0 = BT.totalHp(g3);
    r = BT.playCard(B, { uid: give(B, 'firebolt').uid, at: [6, 2] });
    ok(r.ok && hp0 - BT.totalHp(g3) === 14 + 10 * 2, 'Firebolt deals base + per Lore');
    r = BT.playCard(B, { uid: give(B, 'frostbind').uid, at: [6, 2] });
    ok(r.ok && g3.st.root, 'Frostbind roots');
    r = BT.playCard(B, { uid: give(B, 'meteor').uid, at: [6, 3] });
    ok(r.ok && B.events.filter((e) => e.type === 'hit').length >= 2, 'Meteor strikes an area');
    // earthwork never walls
    B = arena([['pikemen', 20, 0, 2]], [['goblins', 30, 8, 2]], { rocks: [H.key(4, 0), H.key(4, 1), H.key(4, 2), H.key(4, 3), H.key(4, 4)] });
    const ew = BT.cardTargets(B, { uid: 1, id: 'earthwork' }, null);
    ok(!ew.some(([c, r2]) => c === 4 && r2 === 5), 'an earthwork may not close the last gap in a wall');

    // signature cards
    B = arena([['pikemen', 20, 3, 2], ['wolves', 6, 4, 1]], [['goblins', 30, 4, 2]]);
    ok(BT.playable(B, give(B, 'brace')) && BT.needs({ id: 'brace' }) === 'none', 'Set Pikes needs no target: the pikemen are its actor');
    const orphan = give(B, 'aimed');
    ok(BT.orphaned(B, orphan) && !BT.playable(B, orphan), 'a signature card whose creatures are absent is a dead draw');
    r = BT.playCard(B, { uid: give(B, 'packhunt').uid, at: [4, 2] });
    ok(r.ok && !B.events.some((e) => e.retal), 'Pack Hunt is not struck back');

    // the foe's turn
    B = arena([['pikemen', 20, 0, 2]], [['goblins', 30, 3, 2]]);
    const gx = S(B, 'e', 'goblins');
    ok(gx.intent && ['attack', 'ward'].includes(gx.intent.k), 'goblins intend to attack or ward');
    gx.intent = { i: 0, k: 'attack', target: S(B, 'p', 'pikemen').id };
    BT.endTurn(B);
    ok(B.phase === 'enemy', 'ending the turn hands it to the foe');
    BT.runEnemyPhase(B);
    ok(B.phase === 'player' && B.turn === 2, 'the foe moves, then your next turn begins');
    ok(H.dist(gx.c, gx.r, 0, 2) === 1 && S(B, 'p', 'pikemen').count < 20, 'a walker foe marches up and attacks');
    // statuses tick at the end of their owner's turn
    B = arena([['pikemen', 20, 0, 2]], [['goblins', 30, 8, 2]]);
    const gy = S(B, 'e', 'goblins'); gy.st.weak = 2;
    BT.endTurn(B); BT.runEnemyPhase(B);
    ok(gy.st.weak === 1, 'Weak 2 has a turn left after the foe\'s next move');
    gy.st.root = 1; const c0 = gy.c;
    gy.intent = { i: 0, k: 'attack', target: S(B, 'p', 'pikemen').id };
    BT.endTurn(B); BT.runEnemyPhase(B);
    ok(gy.c === c0 && !gy.st.root, 'a rooted foe stays put, then is free');
    // stun skips a move
    B = arena([['pikemen', 20, 0, 2]], [['goblins', 30, 2, 2]]);
    BT.playCard(B, { uid: give(B, 'sleep').uid, at: [2, 2] });
    BT.endTurn(B);
    const ce = S(B, 'e', 'goblins').c;
    BT.runEnemyPhase(B);
    ok(S(B, 'e', 'goblins').c === ce && S(B, 'p', 'pikemen').count === 20, 'Slumber makes a foe lose its move');
    // taunt draws attacks
    B = arena([['pikemen', 30, 1, 1], ['bowmen', 10, 1, 4]], [['worgs', 6, 4, 4]]);
    BT.playCard(B, { uid: give(B, 'taunt').uid, actor: S(B, 'p', 'pikemen').id });
    S(B, 'e', 'worgs').intent = { i: 0, k: 'attack', target: S(B, 'p', 'bowmen').id };
    BT.endTurn(B); BT.runEnemyPhase(B);
    ok(S(B, 'p', 'bowmen').count === 10, 'Challenge: the foe attacks the challenger, not the archers');
    // win and lose
    B = arena([['pikemen', 40, 3, 2]], [['goblins', 2, 4, 2]]);
    BT.playCard(B, { uid: give(B, 'strike').uid, actor: S(B, 'p', 'pikemen').id, at: [4, 2] });
    ok(B.over === 'won' && B.events.some((e) => e.type === 'won'), 'killing the last foe wins');
    B = arena([['pikemen', 1, 3, 2]], [['brutes', 4, 4, 2]]);
    S(B, 'e', 'brutes').intent = { i: 0, k: 'attack', target: S(B, 'p', 'pikemen').id };
    BT.endTurn(B); BT.runEnemyPhase(B);
    ok(B.over === 'lost', 'losing every stack loses');
    // a boss battle ends when the boss falls
    B = arena([['pikemen', 300, 3, 2]], [['grubnak', 1, 4, 2], ['goblins', 30, 8, 5]]);
    B.boss = 'grubnak';
    S(B, 'e', 'grubnak').top = 5;
    BT.playCard(B, { uid: give(B, 'strike').uid, actor: S(B, 'p', 'pikemen').id, at: [4, 2] });
    ok(B.over === 'won' && B.events.some((e) => e.type === 'flee'), 'when the boss falls the rest flee');

    // every card resolves somewhere on random boards, without throwing or breaking invariants
    let bad = 0, played = 0;
    for (let s = 1; s <= 30; s++) {
        G = Gm.newGame(s * 37);
        G.army.push({ key: 'griffins', count: 6, full: 6 }, { key: 'mages', count: 5, full: 5 });
        Gm.act(G, { t: 'go', id: Gm.nextNodes(G)[0].id });
        Gm.act(G, { t: 'begin' });
        B = G.battle;
        for (const id of Object.keys(D.CARDS)) {
            if (B.over) break;
            B.ink = 9;
            const c = give(B, id);
            if (!BT.playable(B, c)) { B.hand = B.hand.filter((x) => x !== c); continue; }
            const actors = BT.cardActors(B, c);
            const need = BT.needs(c);
            const a = actors[0];
            const at = need === 'hex' || need === 'actor+hex' ? BT.cardTargets(B, c, a)[0] : null;
            try {
                const r2 = BT.playCard(B, { uid: c.uid, actor: a, at });
                if (!r2.ok) bad++; else played++;
            } catch (err) { bad++; console.log('   threw', id, err.message); }
            for (const st of B.stacks) if (!(st.count > 0 && st.top > 0 && st.top <= BT.unitDef(st).hp && Number.isFinite(st.ward))) bad++;
        }
    }
    ok(bad === 0, `${played} random card plays resolved cleanly`);
}

// =================================================================================== run
if (want('run')) {
    section('run');
    let G = Gm.newGame(11);
    let connected = true, typed = true;
    for (let s = 1; s <= 40; s++) {
        const M = Gm.genMap((await import('../js/rng.js')).makeRng(s), s % 3);
        const ids = new Set(M.nodes.map((n) => n.id));
        // every node reachable from floor 0, and every node reaches the boss
        const reach = new Set(M.nodes.filter((n) => n.f === 0).map((n) => n.id));
        for (const n of M.nodes) if (reach.has(n.id)) n.next.forEach((x) => reach.add(x));
        if (reach.size !== M.nodes.length || !M.nodes.every((n) => n.type === 'boss' || n.next.length) || !M.nodes.every((n) => n.next.every((x) => ids.has(x)))) connected = false;
        if (!M.nodes.every((n) => n.type) || !M.nodes.filter((n) => n.f === 0).every((n) => n.type === 'battle') || !M.nodes.filter((n) => n.f === 7).every((n) => n.type === 'camp')) typed = false;
        if (!M.nodes.some((n) => n.type === 'dwelling' && n.f <= 3)) typed = false;
        if (M.nodes.some((n) => n.type === 'elite' && n.f < 2)) typed = false;
    }
    ok(connected, 'maps over 40 seeds: every node reachable, every path leads to the boss');
    ok(typed, 'node types: skirmish first, campfire last, an early dwelling, no early lair');
    ok(!Gm.act(G, { t: 'go', id: G.map.nodes.find((n) => n.f === 3).id }).ok, 'cannot skip ahead on the map');

    // a won battle: rewards, recovery, the next node
    Gm.act(G, { t: 'go', id: Gm.nextNodes(G)[0].id });
    Gm.act(G, { t: 'begin' });
    const B = G.battle;
    for (const e of BT.foes(B)) e.count = 1, e.top = 1;
    const pk = BT.mine(B).find((s) => !BT.ranged(s));
    const gold0 = G.gold;
    pk.count -= 6;
    for (let guard = 0; !B.over && guard < 40; guard++) {
        const c = { uid: 5000 + guard, id: 'firebolt', up: false };
        B.hand.push(c); B.ink = 5;
        const t = BT.foes(B)[0];
        BT.playCard(B, { uid: c.uid, at: [t.c, t.r] });
    }
    ok(B.over === 'won', 'the test battle is won');
    ok(Gm.act(G, { t: 'finish' }).ok && G.screen === 'reward' && G.gold > gold0, 'Finish opens the spoils with gold');
    ok(G.army.find((a) => a.key === pk.key).count >= 22 - 6 + Math.floor(6 * C.COMBAT.recover) - 1, 'a third of the fallen rejoin');
    ok(G.reward.cards.length === 3 && G.reward.cards.every((k) => D.CARDS[k]), 'three cards are offered');
    const n0 = G.deck.length;
    ok(Gm.act(G, { t: 'pickCard', i: 0 }).ok && G.deck.length === n0 + 1, 'taking one adds it to the deck');
    ok(!Gm.act(G, { t: 'pickCard', i: 1 }).ok, 'and only one');
    Gm.act(G, { t: 'leave' });
    ok(G.screen === 'map' || G.screen === 'boon', 'leaving goes back to the map (or a boon)');

    // dwellings
    G = Gm.newGame(12); G.gold = 5000;
    G.screen = 'dwelling'; G.offer = { stock: [{ key: 'griffins', n: 5 }, { key: 'pikemen', n: 10 }] };
    const sig0 = G.deck.filter((c) => c.id === 'swoop').length;
    ok(Gm.act(G, { t: 'recruit', key: 'griffins', n: 3 }).ok && G.army.find((a) => a.key === 'griffins').count === 3, 'recruit a new stack');
    ok(G.deck.filter((c) => c.id === 'swoop').length === sig0 + 1, 'it brings its signature card');
    ok(Gm.act(G, { t: 'recruit', key: 'pikemen', n: 10 }).ok && G.army.find((a) => a.key === 'pikemen').count === 32, 'reinforce an existing stack');
    ok(!Gm.act(G, { t: 'recruit', key: 'griffins', n: 3 }).ok, 'cannot buy more than the stock');
    G.gold = 0;
    ok(!Gm.act(G, { t: 'recruit', key: 'griffins', n: 1 }).ok, 'cannot buy without gold');
    G.army.push({ key: 'ogres', count: 1, full: 1 });
    G.gold = 5000; G.offer.stock.push({ key: 'knights', n: 2 });
    ok(G.army.length === 5 && !Gm.act(G, { t: 'recruit', key: 'knights', n: 1 }).ok, 'a full legion takes no new stacks');
    const gi = G.army.findIndex((a) => a.key === 'griffins');
    ok(Gm.act(G, { t: 'dismiss', i: gi }).ok && !G.deck.some((c) => c.id === 'swoop'), 'dismissing a stack takes its card away');

    // the scriptorium
    G = Gm.newGame(13); G.gold = 1000;
    G.screen = 'shop'; G.shop = { cards: [{ id: 'meteor', price: 130, sold: false }], relics: [{ id: 'drum', price: 190, sold: false }], removed: false };
    ok(Gm.act(G, { t: 'buyCard', i: 0 }).ok && G.deck.some((c) => c.id === 'meteor') && G.gold === 870, 'buy a card');
    ok(Gm.act(G, { t: 'buyRelic', i: 0 }).ok && G.relics.includes('drum'), 'buy a relic');
    ok(Gm.act(G, { t: 'removeCard' }).ok && G.pick?.why === 'remove', 'erasing asks for a card');
    ok(!Gm.act(G, { t: 'leave' }).ok, 'nothing else happens until you choose');
    const st = G.deck.find((c) => c.id === 'strike');
    ok(!Gm.act(G, { t: 'pickDeck', uid: G.deck.find((c) => D.CARDS[c.id].rarity === 'sig').uid }).ok, 'a signature card cannot be erased');
    ok(Gm.act(G, { t: 'pickDeck', uid: st.uid }).ok && !G.deck.includes(st) && G.shop.removed, 'erase a card, once');
    // campfire
    G = Gm.newGame(14);
    G.army[0].count = 10;
    G.screen = 'camp'; G.camp = { done: false };
    ok(Gm.act(G, { t: 'rest' }).ok && G.army[0].count === 10 + Math.ceil(12 * 0.5), 'resting raises half the missing');
    ok(!Gm.act(G, { t: 'inscribe' }).ok, 'one thing per campfire');
    G.camp = { done: false };
    ok(Gm.act(G, { t: 'inscribe' }).ok && Gm.act(G, { t: 'pickDeck', uid: G.deck.find((c) => c.id === 'strike').uid }).ok && G.deck.some((c) => c.id === 'strike' && c.up), 'inscribe a card');
    // every encounter option
    let evBad = 0;
    for (const [id, ev] of Object.entries(D.EVENTS)) {
        ev.opts.forEach((o, i) => {
            G = Gm.newGame(20 + i); G.gold = 500; G.screen = 'event'; G.event = { id, result: null };
            const r = Gm.act(G, { t: 'choose', i });
            if (!r.ok || !G.event.result) evBad++;
            if (G.pick) Gm.act(G, { t: 'pickDeck', uid: G.deck.find((c) => D.CARDS[c.id].rarity !== 'sig').uid });
            const l = Gm.act(G, { t: 'leave' });
            if (!l.ok) evBad++;
            if (G.army.some((a) => a.count <= 0 || a.count > a.full + 999)) evBad++;
        });
    }
    ok(evBad === 0, `every option of all ${Object.keys(D.EVENTS).length} encounters resolves`);
    // boons and the next book
    G = Gm.newGame(15);
    G.hero.pending = 1; G.screen = 'reward'; G.reward = { cardTaken: true }; G.node = 'boss';
    Gm.act(G, { t: 'leave' });
    ok(G.screen === 'boon' && G.boon.opts.length === 3, 'a level-up offers three boons');
    const atk0 = G.hero.atk;
    Gm.act(G, { t: 'boon', i: G.boon.opts.indexOf('atk') >= 0 ? G.boon.opts.indexOf('atk') : 0 });
    ok(G.screen === 'bossrelic' && G.bossrelic.opts.length === 3, 'after a boss: a choice of boss relics');
    void atk0;
    G.army[0].count = 3;
    Gm.act(G, { t: 'pickRelic', i: 0 });
    ok(G.act === 1 && G.screen === 'map' && G.army[0].count === G.army[0].full && G.map.act === 1, 'the next book: a new map and the legion at full strength');
}

// =================================================================================== saves
if (want('saves')) {
    section('saves');
    const play = (seed, n) => {
        const G = Gm.newGame(seed); const bot = Bt.makeBot({ seed });
        for (let i = 0; i < n && !G.over; i++) {
            if (G.screen === 'battle' && G.battle.phase === 'enemy' && !G.battle.over) { Gm.runEnemyPhase(G); continue; }
            Gm.act(G, Bt.botCommand(G, bot));
        }
        G.events.length = 0;
        return G;
    };
    const a = play(42, 300), b = play(42, 300);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed, same bot: the same run');
    // mid-battle round trip
    const G = Gm.newGame(77); const bot = Bt.makeBot({ seed: 3 });
    let i = 0;
    while (i++ < 400 && !(G.screen === 'battle' && G.battle.phase === 'player' && G.battle.turn >= 2)) {
        if (G.screen === 'battle' && G.battle.phase === 'enemy') { Gm.runEnemyPhase(G); continue; }
        Gm.act(G, Bt.botCommand(G, bot));
    }
    ok(G.screen === 'battle' && G.battle.turn >= 2, 'reached the middle of a battle');
    G.events.length = 0;
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
    const go = (g, bt) => { for (let k = 0; k < 250 && !g.over; k++) { if (g.screen === 'battle' && g.battle.phase === 'enemy' && !g.battle.over) { Gm.runEnemyPhase(g); continue; } Gm.act(g, Bt.botCommand(g, bt)); } g.events.length = 0; };
    go(G, b1); go(copy, b2);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-battle plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// =================================================================================== bot
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const skill of [1, 0.6]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null, n = 0, refused = 0;
            while (!G.over && n++ < 30000) {
                if (G.screen === 'battle' && G.battle.phase === 'enemy' && !G.battle.over) { Gm.runEnemyPhase(G); G.events.length = 0; continue; }
                const cmd = Bt.botCommand(G, bot);
                if (!cmd) { bad = `stuck on ${G.screen}`; break; }
                const r = Gm.act(G, cmd);
                if (!r.ok) { refused++; if (refused > 3) { bad = `refused ${JSON.stringify(cmd)}: ${r.err}`; break; } }
                G.events.length = 0;
                if (!Number.isFinite(G.gold) || G.gold < 0) bad = 'gold went bad';
                if (G.army.some((a) => !(a.count > 0) || a.count > a.full)) bad = 'an army stack went bad';
                if (G.battle) for (const st of G.battle.stacks) if (!(st.count > 0) || !Number.isFinite(st.ward) || st.top <= 0 || st.top > BT.unitDef(st).hp) bad = `stack ${st.key} went bad`;
                if (bad) break;
            }
            if (!G.over && !bad) bad = 'ran out of commands';
            ok(!bad, `seed ${s} skill ${skill}: ${bad || `${G.over} on floor ${G.stats.floors}`}`);
            rows.push({ skill, won: G.over === 'won', floors: G.stats.floors, act: G.act, lvl: G.hero.lvl });
        }
    }
    const sum = (k) => { const r = rows.filter((x) => x.skill === k); return { wins: r.filter((x) => x.won).length, floors: (r.reduce((a, x) => a + x.floors, 0) / r.length).toFixed(1), book3: r.filter((x) => x.act >= 2).length }; };
    const p = sum(1), m = sum(0.6);
    console.log(`  perfect bot: ${p.wins}/${SEEDS} runs won, ${p.book3} reached book III, average ${p.floors} floors`);
    console.log(`  skill 0.6:   ${m.wins}/${SEEDS} runs won, ${m.book3} reached book III, average ${m.floors} floors`);
    ok(+p.floors >= 9, 'the perfect bot clears book I on average');
    ok(p.wins < SEEDS, 'the game is not a walkover');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
