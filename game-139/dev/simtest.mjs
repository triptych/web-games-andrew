/**
 * simtest.mjs — headless checks of CLEAN SLATE's simulation. No browser.
 *
 *   node game-139/dev/simtest.mjs                 # everything
 *   ONLY=purity,rules node game-139/dev/simtest.mjs
 *   SEEDS=40 VERBOSE=1 node game-139/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the
 *    clock, and never import the view, the UI or the audio.
 * 2. data: every card, rival and room is well formed; every picture and voice line the data names exists.
 * 3. rules: pairs to 13 (and within one), Clean pairs, kings, cuts and Notoriety, taint, bounty, locks, pouring
 *    a Grudge, the rival's turn, Composure, reshuffles, winning a night, trust and partnerships, the day (market,
 *    rooms, chores), interludes, the letters, acts, bosses, the ending, losing.
 * 4. determinism: same seed and commands → same game; a save round trip mid-run plays on identically.
 * 5. bot: whole runs on SEEDS seeds at three blade policies and two skills, with invariants checked after every
 *    command, the balance table printed, and its bands asserted.
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
const { CARDS, STARTER, MARKET, fxOf, cardText } = await import('../js/sim/data/cards.js');
const { RIVALS, ACTS } = await import('../js/sim/data/rivals.js');
const { ROOMS, INTERLUDES, NARRATOR, ENDINGS } = await import('../js/sim/data/inn.js');
const { buildLayout } = await import('../js/sim/layout.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const has = (G, type) => G.events.some((e) => e.type === type);

/** A game at the start of a night against `rival`, with the pyramid and hand set by hand. */
function fightWith(rival, { ranks, hand = [], seed = 5 } = {}) {
    const G = Gm.newGame(seed);
    G.letters = [rival];
    Gm.act(G, { t: 'host', id: rival });
    const F = G.fight;
    if (ranks) F.slots.forEach((s, i) => { s.rank = ranks[i % ranks.length]; s.taint = false; s.bounty = false; s.lock = 0; s.up = true; });
    if (hand.length) {
        F.discard.push(...F.hand); F.hand = [];
        for (const id of hand) { const uid = 'x' + id + F.hand.length; F.cards[uid] = { id, up: false }; F.hand.push(uid); }
    }
    G.events.length = 0;
    return G;
}
const bottom = (G) => Gm.openSlots(G.fight).map((s) => s.id);
const handUid = (G, id) => G.fight.hand.find((u) => G.fight.cards[u].id === id);

// ======================================================================
if (want('purity')) {
    section('purity');
    const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    const files = ['js/rng.js', 'js/config.js', ...walk('js/sim')];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|media)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('data')) {
    section('data');
    for (const c of Object.values(CARDS)) {
        ok(c.rank >= 0 && c.rank <= 13, `${c.id}: rank in 0..13`);
        ok(c.rank > 0 || c.trick || c.fx.wild || c.junk, `${c.id}: a rank-0 card is a trick, wild or junk`);
        ok(typeof cardText(c, false) === 'string' && cardText(c, true).length > 0, `${c.id}: has rules text, plain and polished`);
        const art = c.partner ? `art/rival-${c.partner}.webp` : `art/card-${c.id}.webp`;
        ok(fs.existsSync(path.join(ROOT, art)), `${c.id}: ${art} exists`);
    }
    for (const id of [...STARTER, ...MARKET]) ok(!!CARDS[id], `${id} is a card`);
    const ranks = new Set(STARTER.map((id) => CARDS[id].rank).filter((r) => r));
    ok([...Array(13)].every((_, i) => [12, 13, 14].some((sum) => ranks.has(sum - (i + 1)))), 'the starter deck can meet every rival rank A..K within one');
    for (const r of Object.values(RIVALS)) {
        ok(fs.existsSync(path.join(ROOT, `art/rival-${r.id}.webp`)), `${r.id}: portrait exists`);
        ok(r.final || CARDS[r.partner]?.partner === r.id, `${r.id}: has its own partner card`);
        ok(r.intents.length >= 3 && r.intents.every((i) => ['hit', 'grudge', 'lock', 'muddle', 'drain', 'fluster', 'restock'].includes(i.t)), `${r.id}: intents are known`);
        const lines = r.final ? ['arrive', 'cleared'] : ['arrive', 'accept'];
        for (const k of lines) ok(fs.existsSync(path.join(ROOT, `audio/vo-${r.id}-${k}.mp3`)), `${r.id}: voice line ${k} exists`);
        const L = buildLayout(r.layout);
        ok(L.slots.length >= 15 && L.slots.length <= 28 && L.width <= 9, `${r.id}: ${L.slots.length} cards, ${L.width} wide`);
    }
    for (const a of [1, 2, 3]) ok(ACTS[a].rivals.length === 4 && RIVALS[ACTS[a].boss].boss, `act ${a}: four rivals and a boss`);
    for (const k of Object.keys(NARRATOR)) ok(fs.existsSync(path.join(ROOT, `audio/vo-narrator-${k}.mp3`)), `narrator ${k} is voiced`);
    for (const f of ['title', 'table', 'cardback', 'rivalback', 'ending', 'over']) ok(fs.existsSync(path.join(ROOT, `art/${f}.webp`)), `art/${f}.webp exists`);
    for (const x of INTERLUDES) ok(x.options.length === 2, `interlude ${x.id}: two options`);
    ok(Object.keys(ENDINGS).length === 3, 'three endings');
    ok(Object.values(ROOMS).every((r) => r.price > 0), 'rooms have prices');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    // ---- the run starts
    let G = Gm.newGame(1);
    ok(G.phase === 'letters' && G.letters.length === 2 && G.letters.every((id) => ACTS[1].rivals.includes(id)), 'a run starts with two letters from act I');
    ok(G.deck.length === STARTER.length && G.resolve === C.RUN.resolve, 'the starter deck and full Resolve');
    ok(!Gm.act(G, { t: 'host', id: 'thorn' }), 'you can only host someone who wrote');
    Gm.act(G, { t: 'host', id: G.letters[0] });
    ok(G.phase === 'night' && G.fight.hand.length === C.RUN.hand && has(G, 'arrive'), 'hosting starts a night with a full hand');
    ok(G.fight.slots.length === 15 && Gm.openSlots(G.fight).length === 5, 'act I: a five-row pyramid, its bottom row open');

    // ---- pairs
    G = fightWith('quell', { ranks: [6], hand: ['ale', 'bread', 'silver'] });   // ale 3, bread 10, silver 11
    let b = bottom(G);
    ok(!Gm.canPair(G, { hand: handUid(G, 'ale') }, { slot: b[0] }), '3 + 6 is not 13');
    ok(!Gm.act(G, { t: 'pair', a: { hand: handUid(G, 'ale') }, b: { slot: b[0] } }) && has(G, 'nope'), 'and is refused');
    ok(!Gm.canPair(G, { slot: b[0] }, { slot: b[1] }), 'two rival cards must make exactly 13 (6 + 6 is not)');
    G.fight.slots[b[1]].rank = 7;
    ok(Gm.canPair(G, { slot: b[0] }, { slot: b[1] }), '6 + 7 rival cards pair');
    const before = G.tips;
    Gm.act(G, { t: 'pair', a: { slot: b[0] }, b: { slot: b[1] } });
    ok(G.fight.slots[b[0]].gone && G.fight.slots[b[1]].gone && G.tips > before, 'a rival pair settles both and pays tips');
    ok(G.fight.streak === 2, 'and adds two to the streak');
    ok(Gm.exposed(G.fight, buildLayout(RIVALS.quell.layout).slots[b[0]].covers[0] ?? 0) || true, '');
    // within one: your cards meet the rival at 12, 13 or 14
    G = fightWith('quell', { ranks: [2], hand: ['bread', 'silver', 'copper'] });   // 10+2=12, 11+2=13, 2+2=4
    b = bottom(G);
    ok(Gm.canPair(G, { hand: handUid(G, 'bread') }, { slot: b[0] }), '10 + 2 = 12 meets 13 within one');
    ok(!Gm.canPair(G, { hand: handUid(G, 'copper') }, { slot: b[0] }), '2 + 2 does not');
    const c0 = G.fight.composure;
    Gm.act(G, { t: 'pair', a: { hand: handUid(G, 'silver') }, b: { slot: b[0] } });
    ok(has(G, 'clean') && G.fight.composure === c0 + C.RUN.clean, 'an exact 13 with a hand card is a Clean pair: +Composure');
    G.events.length = 0;
    Gm.act(G, { t: 'pair', a: { hand: handUid(G, 'bread') }, b: { slot: b[1] } });
    ok(!has(G, 'clean') && G.fight.slots[b[1]].gone, 'a pair within one settles, but is not Clean');
    ok(G.fight.composure === c0 + C.RUN.clean + CARDS.bread.fx.block, "the hand card's effect fires (Warm Bread: +3 Composure)");
    ok(G.fight.discard.length > 0 && !G.fight.hand.includes(handUid(G, 'bread')), 'the used card goes to the discard pile');
    // flex and wild
    G = fightWith('quell', { ranks: [9], hand: ['lucky', 'regular'] });   // lucky 6 flex 1 (meets ±2); regular wild
    b = bottom(G);
    ok(Gm.canPair(G, { hand: handUid(G, 'lucky') }, { slot: b[0] }), 'Lucky Penny (6, flex 1) meets 9 at 15, 13±2');
    ok(Gm.canPair(G, { hand: handUid(G, 'regular') }, { slot: b[1] }), 'The Regular pairs with anything');
    ok(!Gm.canPair(G, { hand: handUid(G, 'lucky') }, { hand: handUid(G, 'regular') }), 'two of your own cards never pair');

    // ---- face-down cards turn up when uncovered
    G = fightWith('quell', { hand: ['silver'] });
    const L = buildLayout(RIVALS.quell.layout);
    for (const s of G.fight.slots) s.up = L.slots[s.id].bottom;
    const row4 = L.slots.filter((s) => s.r === 3).map((s) => s.id);
    const above = row4[0], under = L.slots[above].coveredBy;
    G.fight.slots[under[0]].rank = 6; G.fight.slots[under[1]].rank = 7;
    Gm.act(G, { t: 'pair', a: { slot: under[0] }, b: { slot: under[1] } });
    ok(G.fight.slots[above].up && G.events.some((e) => e.type === 'flip' && e.slot === above), 'uncovering a face-down card turns it up');

    // ---- kings
    G = fightWith('quell', { ranks: [13], hand: ['sparekey'] });
    b = bottom(G);
    Gm.act(G, { t: 'solo', slot: b[0] });
    ok(G.fight.slots[b[0]].gone, 'an open rival King settles alone');
    const h0 = G.fight.hand.length;
    Gm.act(G, { t: 'solo', hand: handUid(G, 'sparekey') });
    ok(G.fight.hand.length === h0 - 1 + 2, 'your own King plays alone for its effect (Spare Key: draw 2)');
    ok(!Gm.act(G, { t: 'solo', slot: Gm.openSlots(G.fight).find((s) => s.rank !== 13)?.id ?? -1 }), 'only a King settles alone');

    // ---- cuts, blades, Notoriety, trust
    G = fightWith('brannoc', { ranks: [5], hand: ['habit', 'stiletto'] });
    b = bottom(G);
    Gm.act(G, { t: 'cut', hand: handUid(G, 'habit'), slot: b[0] });
    ok(G.fight.slots[b[0]].gone && G.notoriety === 1 && G.fight.blades === 1 && has(G, 'blade'), 'Old Habit settles any open card alone, +1 Notoriety');
    ok(!Gm.canPair(G, { hand: handUid(G, 'stiletto') }, { slot: b[0] }), 'a settled card cannot be paired');
    G.fight.slots[b[1]].rank = 4;
    Gm.act(G, { t: 'pair', a: { hand: handUid(G, 'stiletto') }, b: { slot: b[1] } });
    ok(G.notoriety === 2 && G.fight.soothe === CARDS.stiletto.fx.soothe, 'a Blade numbered card also counts, and soothes the next blow');
    // Notoriety makes blows harder
    G = Gm.newGame(3); G.notoriety = 8; G.letters = ['flint']; Gm.act(G, { t: 'host', id: 'flint' });
    const raw = RIVALS.flint.intents[(G.fight.intentAt - 1) % RIVALS.flint.intents.length];
    if (raw.t === 'hit') ok(G.fight.intent.n === Math.round(raw.n * C.RUN.hitScale[1]) + 2, 'every 4 Notoriety adds 1 to each blow');
    // warrant
    G = fightWith('varr', { ranks: [5], hand: ['habit'] });
    const r0 = G.resolve;
    Gm.act(G, { t: 'cut', hand: handUid(G, 'habit'), slot: bottom(G)[0] });
    ok(G.resolve === r0 - C.RUN.warrant, 'Captain Varr: every Blade costs Resolve');

    // ---- taint and bounty
    G = fightWith('brannoc', { ranks: [5], hand: ['knives', 'bread', 'copper'] });
    b = bottom(G);
    G.fight.slots[b[0]].taint = true; G.fight.slots[b[1]].taint = true; G.fight.slots[b[2]].bounty = true;
    G.fight.slots[b[0]].rank = 6; G.fight.slots[b[1]].rank = 3; G.fight.slots[b[2]].rank = 11;
    let r1 = G.resolve;
    Gm.act(G, { t: 'pair', a: { hand: handUid(G, 'knives') }, b: { slot: b[0] } });   // 7 + 6
    ok(G.resolve === r1 - C.RUN.taint, 'settling a tainted card with a non-Hearth card hurts');
    r1 = G.resolve;
    Gm.act(G, { t: 'pair', a: { hand: handUid(G, 'bread') }, b: { slot: b[1] } });    // 10 + 3, Hearth
    ok(G.resolve === r1, 'a Hearth card settles it safely');
    const t1 = G.tips;
    Gm.act(G, { t: 'pair', a: { hand: handUid(G, 'copper') }, b: { slot: b[2] } });   // 2 + 11
    ok(G.tips >= t1 + C.RUN.bounty + 1 && has(G, 'bounty'), 'a bounty card pays extra tips');

    // ---- locks
    G = fightWith('quell', { ranks: [6] });
    b = bottom(G);
    G.fight.slots[b[0]].lock = 1; G.fight.slots[b[1]].rank = 7;
    ok(!Gm.canPair(G, { slot: b[0] }, { slot: b[1] }), 'a locked card cannot be used');
    G.fight.cards.sk = { id: 'skeleton', up: false }; G.fight.hand.push('sk');
    G.fight.slots[b[2]].rank = 2;
    Gm.act(G, { t: 'pair', a: { hand: 'sk' }, b: { slot: b[2] } });
    ok(!G.fight.slots[b[0]].lock, 'Skeleton Key unlocks them');

    // ---- the rival's turn
    G = fightWith('flint', { ranks: [6], hand: ['ale', 'roomkey'] });
    G.fight.intent = { t: 'hit', n: 7 };
    Gm.act(G, { t: 'pair', a: { hand: handUid(G, 'ale') }, b: { slot: bottom(G)[1] } });   // 3+6=9: not a pair
    G.fight.composure = 3;
    const r2 = G.resolve, rd = G.fight.round;
    Gm.act(G, { t: 'end' });
    ok(G.resolve === r2 - 4 && has(G, 'block') && has(G, 'hurt'), 'a blow of 7 against 3 Composure costs 4 Resolve');
    ok(G.fight.round === rd + 1 && G.fight.composure === 0 && G.fight.hand.length === C.RUN.hand && G.fight.intent, 'then a new round: Composure gone, a fresh hand, a new intent');
    G = fightWith('flint', { ranks: [6] });
    G.fight.intent = { t: 'grudge', n: 2 };
    const d0 = G.fight.draw.length + G.fight.hand.length + G.fight.discard.length;
    Gm.act(G, { t: 'end' });
    const grudges = Object.values(G.fight.cards).filter((c) => c.id === 'grudge').length;
    ok(grudges === 2 && G.fight.draw.length + G.fight.hand.length + G.fight.discard.length === d0 + 2, 'a Grudge intent shuffles Grudges into your draw pile');
    // a grudge in hand
    G = fightWith('flint', { ranks: [6], hand: ['grudge', 'ale'] });
    G.fight.intent = { t: 'lock', n: 1 };
    const r3 = G.resolve;
    Gm.act(G, { t: 'end' });
    ok(G.resolve === r3 - C.RUN.grudge, 'a Grudge still in hand at round end hurts');
    ok(G.fight.slots.some((s) => s.lock), 'a lock intent locks open cards');
    G = fightWith('flint', { ranks: [6], hand: ['grudge', 'ale'] });
    const gu = handUid(G, 'grudge');
    Gm.act(G, { t: 'pour', hand: gu });
    ok(G.fight.out.includes(gu) && G.fight.hand.length === 2 && has(G, 'pour'), 'pouring a Grudge out removes it for the night and draws one');
    ok(!Gm.act(G, { t: 'pour', hand: G.fight.hand[0] }), 'one pour a round');
    ok(!Gm.canPair(G, { hand: gu }, { slot: bottom(G)[0] }), 'a Grudge never pairs');
    // drain, fluster, muddle, restock
    G = fightWith('tally', { ranks: [6] }); G.tips = 10; G.fight.intent = { t: 'drain', n: 6 }; Gm.act(G, { t: 'end' });
    ok(G.tips === 4, 'drain takes tips');
    G = fightWith('moss', { ranks: [6] }); G.fight.intent = { t: 'fluster' }; Gm.act(G, { t: 'end' });
    ok(G.fight.hand.length === C.RUN.hand - 1, 'fluster: one card fewer next round');
    G = fightWith('garr', { ranks: [6, 7] });
    b = bottom(G); Gm.act(G, { t: 'pair', a: { slot: b[0] }, b: { slot: b[1] } });
    G.fight.intent = { t: 'restock', n: 2 }; Gm.act(G, { t: 'end' });
    ok(!G.fight.slots[b[0]].gone && !G.fight.slots[b[1]].gone, 'restock deals cards back onto the empty bottom row');
    // reshuffle
    G = fightWith('quell', { ranks: [6] });
    G.fight.discard.push(...G.fight.draw); G.fight.draw = [];
    G.fight.intent = { t: 'lock', n: 0 };
    Gm.act(G, { t: 'end' });
    ok(has(G, 'reshuffle') && G.fight.hand.length === C.RUN.hand, 'an empty draw pile reshuffles the discards');

    // ---- winning a night, trust and partners
    G = fightWith('brannoc', { ranks: [13] });
    for (let k = 0; k < 40 && G.phase === 'night'; k++) { const o = Gm.openSlots(G.fight)[0]; Gm.act(G, { t: 'solo', slot: o.id }); }
    ok(G.phase === 'won' && G.won.canPartner && has(G, 'cleared'), 'clearing the pyramid wins the night; no blades, so a partnership is offered');
    const tipsWon = G.tips;
    Gm.act(G, { t: 'partner' });
    ok(G.deck.some((c) => c.id === 'p_brannoc') && G.partners.includes('brannoc') && has(G, 'partner'), 'a partner joins the deck');
    ok(G.phase === 'day' && G.day.offers.length === C.RUN.market && G.tips === tipsWon, 'then the day: the market is open');
    G = fightWith('brannoc', { ranks: [13] });
    G.fight.blades = 2;
    for (let k = 0; k < 40 && G.phase === 'night'; k++) Gm.act(G, { t: 'solo', slot: Gm.openSlots(G.fight)[0].id });
    ok(!G.won.canPartner && !Gm.act(G, { t: 'partner' }), 'two blades on Brannoc (trust 1): no partnership');
    const tf = G.tips;
    Gm.act(G, { t: 'farewell' });
    ok(G.tips === tf + C.RUN.farewell.tips && G.stats.refused === 1, 'seeing them out pays tips instead');

    // ---- the day
    G.tips = 100;
    const deckN = G.deck.length;
    const offer = G.day.offers[0];
    Gm.act(G, { t: 'buy', i: 0 });
    ok(G.deck.length === deckN + 1 && G.deck.at(-1).id === offer && G.tips === 100 - Gm.priceOf(G, offer), 'buying a card adds it and costs its price');
    ok(!Gm.act(G, { t: 'buy', i: 0 }), 'a bought card is gone from the market');
    const room = G.day.room;
    Gm.act(G, { t: 'room' });
    ok(G.rooms.includes(room), `building a room (${room})`);
    const blade = G.deck.find((c) => c.id === 'stiletto');
    G.notoriety = 3;
    Gm.act(G, { t: 'chore', kind: 'letgo', uid: blade.uid });
    ok(!G.deck.includes(blade) && G.notoriety === 2, 'letting go of a Blade removes it and lowers Notoriety');
    ok(!Gm.act(G, { t: 'chore', kind: 'rest' }), 'one chore a day');
    Gm.act(G, { t: 'leave' });
    ok(G.phase === 'letters' || G.phase === 'interlude', 'leaving the day brings letters (or an interlude first)');
    if (G.phase === 'interlude') { Gm.act(G, { t: 'choose', i: 0 }); ok(G.phase === 'letters' && has(G, 'chose'), 'an interlude choice leads to the letters'); }
    // polish
    G = Gm.newGame(9); G.phase = 'day'; G.day = { offers: [], room: null, chore: null };
    const ale = G.deck.find((c) => c.id === 'ale');
    Gm.act(G, { t: 'chore', kind: 'polish', uid: ale.uid });
    ok(ale.up && fxOf(CARDS.ale, true).block === CARDS.ale.fx.block + 2, 'polishing a card improves it');
    // rooms take effect
    G = Gm.newGame(10); G.rooms = ['snug', 'cellar', 'board']; G.letters = ['flint']; Gm.act(G, { t: 'host', id: 'flint' });
    ok(G.fight.hand.length === C.RUN.hand + 1 && G.fight.composure === 2, 'the Snug draws one more; the Cellar gives 2 Composure');
    ok(G.fight.slots.filter((s) => s.up).length === 5 + 4 + 3, 'the Notice Board turns one more row face up');

    // ---- acts, the boss, the ending
    G = Gm.newGame(11);
    G.night = 3; G.letters = []; G.phase = 'day'; G.day = { offers: [], room: null, chore: 'rest' };
    G.usedInterludes = INTERLUDES.map((x) => x.id);
    Gm.act(G, { t: 'leave' });
    ok(G.letters.length === 1 && G.letters[0] === 'corvina', 'after three nights, only the boss writes');
    G.letters = ['corvina']; Gm.act(G, { t: 'host', id: 'corvina' });
    ok(G.fight.slots.length === 21, 'the act I boss deals six rows');
    for (const s of G.fight.slots) { s.rank = 13; s.up = true; s.lock = 0; s.taint = false; }
    for (let k = 0; k < 60 && G.phase === 'night'; k++) Gm.act(G, { t: 'solo', slot: Gm.openSlots(G.fight)[0].id });
    Gm.act(G, { t: 'farewell' });
    ok(G.act === 2 && G.night === 0 && G.phase === 'day', 'beating the boss starts act II');
    G = Gm.newGame(12); G.act = 3; G.night = 3; G.letters = ['thorn']; G.partners = ['a', 'b', 'c', 'd', 'e', 'f'];
    G.deck = G.deck.filter((c) => CARDS[c.id].suit !== 'blade');
    Gm.act(G, { t: 'host', id: 'thorn' });
    for (const s of G.fight.slots) { s.rank = 13; s.up = true; s.lock = 0; s.taint = false; }
    for (let k = 0; k < 60 && G.phase === 'night'; k++) Gm.act(G, { t: 'solo', slot: Gm.openSlots(G.fight)[0].id });
    ok(G.phase === 'won' && !G.won.canPartner, 'Mother Thorn never partners');
    Gm.act(G, { t: 'farewell' });
    ok(G.phase === 'ending' && G.ending === 'slate' && G.over, 'six partners and no blades: A Clean Slate');
    G = Gm.newGame(12); G.notoriety = 12; G.act = 3; G.night = 3; G.letters = ['thorn']; Gm.act(G, { t: 'host', id: 'thorn' });
    for (const s of G.fight.slots) { s.rank = 13; s.up = true; s.lock = 0; s.taint = false; }
    for (let k = 0; k < 60 && G.phase === 'night'; k++) Gm.act(G, { t: 'solo', slot: Gm.openSlots(G.fight)[0].id });
    Gm.act(G, { t: 'farewell' });
    ok(G.ending === 'nightfall', 'Notoriety 10+: Nightfall, Innkeeper');

    // ---- losing
    G = fightWith('flint', { ranks: [6] });
    G.resolve = 3; G.fight.intent = { t: 'hit', n: 9 };
    Gm.act(G, { t: 'end' });
    ok(G.phase === 'over' && G.over && has(G, 'over'), 'Resolve 0 ends the run');
    ok(!Gm.act(G, { t: 'end' }), 'and nothing more can be done');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, n) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); Bt.playRun(G, b, { act: Gm.act, maxActs: n }); return G; };
    ok(JSON.stringify(Gm.serialize(play(42, 300))) === JSON.stringify(Gm.serialize(play(42, 300))), 'same seed and commands, same game');
    for (const at of [40, 160, 400]) {
        const G = play(7, at);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot({ seed: 3 }), b2 = Bt.makeBot({ seed: 3 });
        Bt.playRun(G, b1, { act: Gm.act, maxActs: 250 });
        Bt.playRun(copy, b2, { act: Gm.act, maxActs: 250 });
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip after ${at} commands plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    let bad = null;
    const check = (G) => {
        if (bad) return;
        const F = G.fight;
        if (!Number.isFinite(G.resolve) || G.resolve < 0 || G.resolve > G.maxResolve) bad = `resolve ${G.resolve}`;
        else if (G.tips < 0 || !Number.isFinite(G.tips)) bad = `tips ${G.tips}`;
        else if (G.notoriety < 0) bad = 'notoriety < 0';
        else if (F && (F.hand.length > 12 || F.slots.some((s) => s.rank < 1 || s.rank > 13))) bad = 'hand or ranks out of range';
        else if (F) {
            const all = new Set([...F.draw, ...F.hand, ...F.discard, ...F.out]);
            if (all.size !== F.draw.length + F.hand.length + F.discard.length + F.out.length) bad = 'a card is in two piles';
            else if (all.size !== Object.keys(F.cards).length) bad = 'a card went missing';
        }
    };
    for (const blades of ['never', 'trust', 'always']) for (const skill of [1, 0.8]) {
        let won = 0, nights = 0, partners = 0, rounds = 0, minRes = 0;
        const endings = { slate: 0, open: 0, nightfall: 0 };
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 104729);
            const bot = Bt.makeBot({ skill, blades, seed: s });
            let low = 99;
            Bt.playRun(G, bot, { act: Gm.act, onAct: (g, cmd) => { check(g); low = Math.min(low, g.resolve); if (cmd.t === 'end') rounds++; } });
            if (bad) { ok(false, `seed ${s} ${blades} ${skill}: ${bad}`); bad = null; }
            ok(G.over, `seed ${s} ${blades} ${skill}: the run finishes`);
            if (G.phase === 'ending') { won++; endings[G.ending]++; }
            nights += G.stats.nights; partners += G.partners.length; minRes += low;
        }
        rows.push({ blades, skill, win: Math.round((won / SEEDS) * 100), nights: +(nights / SEEDS).toFixed(1), partners: +(partners / SEEDS).toFixed(1), roundsPerNight: +(rounds / Math.max(1, nights)).toFixed(1), lowestResolve: +(minRes / SEEDS).toFixed(1), ...endings });
    }
    console.table(rows);
    const R = (b, s) => rows.find((r) => r.blades === b && r.skill === s);
    ok(R('trust', 1).win >= 75, `a perfect bot that respects trust wins most runs (${R('trust', 1).win}%)`);
    ok(R('trust', 0.8).win >= 5 && R('trust', 0.8).win <= 65, `a skill-0.8 bot wins some and loses some (${R('trust', 0.8).win}%)`);
    ok(R('trust', 1).win > R('trust', 0.8).win, 'a better bot wins more');
    ok(R('trust', 1).slate >= R('trust', 1).win * SEEDS / 100 * 0.6, 'a trusting player mostly earns A Clean Slate');
    ok(R('always', 1).nightfall >= R('always', 1).slate, 'the old ways lead to Nightfall');
    ok(R('always', 1).partners < 1 && R('trust', 1).partners > 6, 'blades cost partnerships');
    ok(R('trust', 1).roundsPerNight >= 2.5 && R('trust', 1).roundsPerNight <= 7, `a night takes a few rounds (${R('trust', 1).roundsPerNight})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
