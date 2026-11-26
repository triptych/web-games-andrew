/**
 * simtest.mjs — headless checks of Folio & Fable's simulation. No browser.
 *
 *   node game-150/dev/simtest.mjs            # everything
 *   ONLY=purity,books,rules node game-150/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-150/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock,
 *    and never import the view, the UI or the audio.
 * 2. books: the procedural book engine is deterministic, and every kind × rarity makes a sane book (title, author,
 *    virtues within budget, a finite look, a value that rises with rarity) over many seeds.
 * 3. rules: furniture, shelving and sections, the open shop (browsers buy, requests at the counter: serve,
 *    commission, decline, fulfil later), expeditions, the trader, the bindery (rarity from cover and accents,
 *    rebinding), reading and skills, talking books, the town's inspirations, every story chapter's reward.
 * 4. determinism: the same seed and play give the same game; a save round trip in the middle of an open day plays
 *    on identically; an unknown save version is rejected.
 * 5. requests: every request the town makes over many days can be answered by some book the game can make.
 * 6. bot: the bot plays the whole story on SEEDS seeds at two skills with per-step invariants, and the balance table
 *    (the day each chapter starts) is printed and held to bands.
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
const B = await import('../js/sim/books.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
/** Run the open shop until it closes, answering nobody unless told how. */
const runDay = (G, onAsk = null) => { let n = 0; while (G.phase === 'open' && n++ < 200000) { Gm.step(G, DT * 4); if (onAsk) for (const cu of G.customers) if (cu.state === 'ask' && cu.want) onAsk(cu); } };
const ser = (G) => JSON.stringify(Gm.serialize(G));

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
if (want('books')) {
    section('books');
    const a = B.makeBook(1, 12345, { kind: 'grimoire', rarity: 3 });
    const b = B.makeBook(1, 12345, { kind: 'grimoire', rarity: 3 });
    ok(JSON.stringify(a) === JSON.stringify(b), 'one seed, one book: the engine is deterministic');
    ok(JSON.stringify(a) !== JSON.stringify(B.makeBook(1, 12346, { kind: 'grimoire', rarity: 3 })), 'a different seed makes a different book');
    let bad = 0, titles = new Set(), n = 0;
    const avgValue = [0, 0, 0, 0, 0];
    for (const kind of D.KIND_IDS) for (let r = 0; r <= 4; r++) for (let s = 0; s < 40; s++) {
        const k = B.makeBook(n, s * 7919 + r * 31 + kind.length, { kind, rarity: r });
        n++;
        titles.add(k.title);
        avgValue[r] += k.value / (D.KIND_IDS.length * 40);
        const pts = B.totalPoints(k);
        const look = k.look;
        const finite = ['h', 'w', 't', 'hue', 'sat', 'lit', 'wear'].every((f) => Number.isFinite(look[f]));
        const good = k.title && k.title.length > 3 && !/undefined|NaN/.test(k.title) && k.author.split(' ').length >= 2
            && pts >= D.RARITY[r].points && pts <= D.RARITY[r].points + 2 && Object.values(k.stats).every((x) => x > 0 && Number.isInteger(x))
            && Object.keys(k.stats).length >= 1 && Object.keys(k.stats).length <= 3 && Object.keys(k.stats).every((v) => D.VIRTUE_IDS.includes(v))
            && finite && look.h > 0.5 && look.t > 0.05 && /^hsl\(/.test(look.color) && k.value > 0
            && (!k.skill || D.SKILLS[k.skill]) && (!k.talk || D.VOICES[k.talk]);
        if (!good) { bad++; if (bad < 4) console.log('    bad book', JSON.stringify(k).slice(0, 300)); }
        if (kind === 'manual' && !k.skill) bad++;
    }
    ok(bad === 0, `${n} books over every kind and rarity are sane (${bad} bad)`);
    ok(titles.size > n * 0.5, `titles vary (${titles.size} different in ${n})`);
    ok(avgValue.every((v, i) => i === 0 || v > avgValue[i - 1] * 1.5), `value rises with rarity (${avgValue.map(Math.round).join(' < ')})`);
    const talkers = Array.from({ length: 200 }, (_, i) => B.makeBook(i, i * 13, { kind: 'grimoire', rarity: 4 })).filter((k) => k.talk).length;
    ok(talkers === 200, 'every legendary grimoire talks');
    ok(B.describe(a).includes('Grimoire'), 'describe names the kind');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    // --- the shop as Tam finds it
    let G = Gm.newGame(1);
    ok(G.books.length === C.START.books && G.books.every((b) => !b.loc), 'Elowen\'s ten books wait in the back room');
    ok(Gm.cell(G, 'wall', 1)?.type === 'shelf' && Gm.cell(G, 'wall', 4)?.type === 'shelf', 'two old shelves on the wall');
    ok(!Gm.act(G, { t: 'send', heroes: ['rook'], place: 'woods' }).ok, 'no expeditions before the story allows');
    ok(!Gm.act(G, { t: 'craft', kind: 'cookbook', cover: 'paper', ink: 'ink', accents: [] }).ok, 'the bindery is asleep at the start');

    // --- furniture
    const g0 = G.gold;
    ok(Gm.act(G, { t: 'buyFurniture', type: 'fern' }).ok && G.gold === g0 - D.FURNITURE.fern.cost && G.stored.fern === 1, 'buying furniture costs its price');
    ok(!Gm.act(G, { t: 'place', type: 'fern', row: 'wall', slot: 0 }).ok, 'a fern can\'t hang on the wall');
    ok(Gm.act(G, { t: 'place', type: 'fern', row: 'floor', slot: 1 }).ok && G.shop.floor[1].type === 'fern', 'a fern stands on the floor');
    ok(Gm.cozy(G) === 2, 'and makes the shop cozier');
    ok(Gm.appeal(G, 'wall', 1) > Gm.appeal(G, 'wall', 4), 'a shelf with a fern in front of it catches the eye');
    G.gold = 500;
    ok(Gm.act(G, { t: 'buyFurniture', type: 'cat' }).ok && !Gm.act(G, { t: 'buyFurniture', type: 'cat' }).ok, 'only one cat');
    ok(Gm.act(G, { t: 'move', row: 'floor', from: 1, to: 3 }).ok && G.shop.floor[3]?.type === 'fern' && !G.shop.floor[1], 'furniture moves');
    ok(Gm.act(G, { t: 'expand' }).ok && G.shop.width === 8 && G.shop.wall.length === 8, 'renovating adds two slots');

    // --- shelving and sections
    ok(Gm.act(G, { t: 'shelve', book: G.books[0].id, row: 'wall', slot: 1 }).ok && G.books[0].loc.slot === 1, 'a book goes on a shelf');
    ok(!Gm.act(G, { t: 'shelve', book: G.books[1].id, row: 'wall', slot: 0 }).ok, 'not on bare wall');
    ok(Gm.act(G, { t: 'unshelve', book: G.books[0].id }).ok && !G.books[0].loc, 'and comes off again');
    G = Gm.newGame(2);
    for (let i = 0; i < 4; i++) {
        const b = B.makeBook(900 + i, i, { kind: 'poetry', rarity: 0 }); G.books.push(b);
        Gm.act(G, { t: 'shelve', book: b.id, row: 'wall', slot: 1 });
    }
    ok(Gm.section(G, 'wall', 1) === 'poetry', 'four books of a kind make a section');
    ok(Gm.appeal(G, 'wall', 1) > 1.5, 'and a section is appealing');
    for (let i = 0; i < 14; i++) { const b = B.makeBook(950 + i, i, { kind: 'novel' }); G.books.push(b); }
    ok(Gm.act(G, { t: 'autoShelve' }).ok, 'auto-shelve fills the shelves');
    ok(Gm.shelfBooks(G, 'wall', 1).filter(Boolean).length === 12 && Gm.shelfBooks(G, 'wall', 4).filter(Boolean).length === 12, 'both shelves full, twelve each');
    ok(!Gm.act(G, { t: 'shelve', book: Gm.unshelved(G)[0].id, row: 'wall', slot: 1 }).ok, 'a full shelf takes no more');

    // --- the open shop: browsers buy, the till rings
    G = Gm.newGame(3);
    Gm.act(G, { t: 'autoShelve' });
    ok(Gm.act(G, { t: 'open' }).ok && G.phase === 'open' && G.schedule.length === 4, 'day one: four visitors are coming');
    ok(!Gm.act(G, { t: 'buyFurniture', type: 'fern' }).ok, 'no furniture shopping while the doors are open');
    let asked = 0;
    runDay(G, (cu) => { asked++; Gm.act(G, { t: 'decline', cust: cu.id }); });
    ok(G.phase === 'evening', 'the shop closes by itself at the end of the day');
    ok(asked >= 1, 'someone brought a request to the counter on day one');
    ok(G.events.some((e) => e.type === 'enter') && G.events.some((e) => e.type === 'leave'), 'customers came and went');
    ok(G.books.every((b) => !b.loc || !b.loc.held), 'nobody left holding a book');

    // a day where everyone loves cookbooks and the shelf is full of them
    let sold = 0, tries = 0;
    for (let s = 1; s <= 6; s++) {
        G = Gm.newGame(100 + s);
        Gm.act(G, { t: 'autoShelve' });
        const gold = G.gold;
        Gm.act(G, { t: 'open' });
        runDay(G, (cu) => Gm.act(G, { t: 'decline', cust: cu.id }));
        tries++;
        if (G.stats.sold > 0) { sold++; ok(G.gold > gold, `seed ${s}: a sale brings gold`); }
    }
    ok(sold >= 4, `browsers buy from the shelves on most first days (${sold}/${tries})`);
    ok(G.ledger.length === G.stats.sold, 'every sale is in the ledger');

    // --- a request served, a commission taken and fulfilled (two customers waiting at the counter)
    G = Gm.newGame(5);
    Gm.act(G, { t: 'autoShelve' });
    Gm.act(G, { t: 'open' });
    G.schedule.length = 0;
    const target = B.makeBook(999, 5, { kind: 'cookbook', rarity: 2, virtue: 'hearth' });
    G.books.push(target);
    G.customers.push({ id: 501, folk: 'cook', name: 'Bun', x: 5, tx: 5, state: 'ask', want: { kind: 'cookbook' }, patience: 30 });
    G.customers.push({ id: 502, folk: 'scholar', name: 'Owl', x: 5, tx: 5, state: 'ask', want: { kind: 'atlas', virtue: 'wonder', min: 3 }, patience: 30 });
    const before = G.gold;
    ok(Gm.act(G, { t: 'serve', cust: 501, book: target.id }).ok && G.gold > before && !G.books.includes(target), 'serving a request sells the book at a bonus');
    ok(G.gold - before >= Math.round(target.value * C.ECON.requestBonus), 'at least half again its value');
    ok(G.stats.requests === 1 && G.renown >= 2, 'and counts toward the story, with renown');
    ok(!Gm.act(G, { t: 'serve', cust: 502, book: G.books.find((b) => b.kind !== 'atlas').id }).ok, 'the wrong book is refused');
    ok(Gm.act(G, { t: 'commission', cust: 502 }).ok && G.commissions.length === 1, 'a request can become a commission');
    ok(G.customers.every((c) => c.state === 'out'), 'both customers head for the door');
    runDay(G);
    const atlas = B.makeBook(998, 9, { kind: 'atlas', rarity: 2, virtue: 'wonder' });
    G.books.push(atlas);
    const com = G.commissions[0];
    const g1 = G.gold;
    ok(Gm.act(G, { t: 'fulfill', com: com.id, book: atlas.id }).ok && G.gold > g1 && !G.commissions.length, 'a commission is fulfilled later, for more');
    Gm.act(G, { t: 'next' });
    G.commissions.push({ id: 5000, folk: 'cook', name: 'X', req: { kind: 'cookbook' }, until: G.day });
    Gm.act(G, { t: 'open' }); runDay(G, (cu) => Gm.act(G, { t: 'decline', cust: cu.id })); Gm.act(G, { t: 'next' });
    ok(!G.commissions.some((c) => c.id === 5000), 'an old commission lapses quietly');

    // --- a customer who waits too long goes home
    G = Gm.newGame(6);
    Gm.act(G, { t: 'open' });
    let gaveUp = false;
    for (let i = 0; i < 40000 && G.phase === 'open'; i++) { Gm.step(G, DT * 4); if (G.events.some((e) => e.type === 'gaveUp')) gaveUp = true; }
    ok(gaveUp && G.phase === 'evening', 'an unanswered customer gives up politely and the day still ends');

    // --- close early
    G = Gm.newGame(7);
    Gm.act(G, { t: 'open' });
    Gm.step(G, 1);
    ok(Gm.act(G, { t: 'close' }).ok && G.schedule.length === 0, 'closing early sends nobody else in');
    runDay(G);
    ok(G.phase === 'evening', 'and the day ends once the shop is empty');

    // --- story chapter 1 → expeditions
    G = Gm.newGame(8);
    G.stats.sold = 3;
    Gm.act(G, { t: 'autoShelve' });
    ok(G.story.ch === 2 && G.flags.exp && G.heroes.rook.hired && G.events.some((e) => e.type === 'chapter' && e.n === 1), 'chapter 1 done: Rook joins and expeditions open');
    const gift = G.books.find((b) => !b.loc || b.loc.row);
    ok(Gm.act(G, { t: 'equip', hero: 'rook', book: gift.id }).ok && gift.loc.adv === 'rook', 'Rook carries a book');
    ok(Gm.heroPower(G, 'rook', 'woods') > 1 + D.HEROES.rook.stats.valor - 0.01, 'its virtues add to his power');
    ok(!Gm.act(G, { t: 'shelve', book: gift.id, row: 'wall', slot: 1 }).ok, 'a carried book can\'t be shelved');
    ok(!Gm.act(G, { t: 'send', heroes: ['rook'], place: 'archive' }).ok, 'the Sunken Archive is unknown at first');
    ok(Gm.act(G, { t: 'send', heroes: ['rook'], place: 'woods' }).ok && G.heroes.rook.away, 'Rook sets off to the Whispering Woods');
    ok(!Gm.act(G, { t: 'equip', hero: 'rook', book: null }).ok, 'away adventurers can\'t swap books');
    const stock0 = G.books.length + Object.values(G.mats).reduce((a, x) => a + x, 0);
    Gm.act(G, { t: 'open' }); runDay(G, (cu) => Gm.act(G, { t: 'decline', cust: cu.id }));
    ok(Gm.act(G, { t: 'next' }).ok && !G.heroes.rook.away, 'he is home the next morning');
    const ret = G.events.find((e) => e.type === 'returned');
    ok(ret && G.books.length + Object.values(G.mats).reduce((a, x) => a + x, 0) > stock0, 'with books or materials');
    ok(G.story.ch === 3 && G.flags.bindery, 'chapter 2 done: the bindery wakes');
    ok(G.events.some((e) => e.type === 'donation'), 'and the town left books on the step');

    // --- the bindery
    G.mats = { paper: 3, leather: 2, oak: 1, ink: 3, honey: 2, gold: 3, thread: 2, seal: 1 };
    let r = Gm.act(G, { t: 'craft', kind: 'cookbook', cover: 'paper', ink: 'honey', accents: [] });
    let made = G.books[G.books.length - 1];
    ok(r.ok && made.crafted && made.rarity === 0 && B.stat(made, 'hearth') > 0, 'paper and honey ink make a common cookbook with Hearth');
    ok(G.story.ch === 4 && G.patterns.includes('manual'), 'chapter 3 done: the Skill Manual pattern');
    ok(!Gm.act(G, { t: 'craft', kind: 'grimoire', cover: 'paper', ink: 'ink', accents: [] }).ok, 'an unknown pattern can\'t be used');
    ok(!Gm.act(G, { t: 'craft', kind: 'novel', cover: 'dragonhide', ink: 'ink', accents: [] }).ok, 'materials you lack can\'t be used');
    ok(!Gm.act(G, { t: 'craft', kind: 'novel', cover: 'paper', ink: 'ink', accents: ['gold', 'gold'] }).ok, 'no doubled accents');
    r = Gm.act(G, { t: 'craft', kind: 'novel', cover: 'oak', ink: 'ink', accents: ['gold'] });
    made = G.books[G.books.length - 1];
    ok(r.ok && made.rarity >= 2 && made.rarity <= 3 && made.gilt, 'an oak cover makes it rare, and gold leaf may lift it to epic');
    r = Gm.act(G, { t: 'craft', kind: 'manual', cover: 'leather', ink: 'ink', accents: ['seal', 'thread'] });
    made = G.books[G.books.length - 1];
    ok(r.ok && made.skill && D.SKILLS[made.skill], 'a manual with a wax seal teaches a skill');
    const p0 = { ...made.stats };
    ok(Gm.act(G, { t: 'rebind', book: made.id }).ok && made.plus === 1 && Object.keys(p0).every((v) => made.stats[v] === p0[v] + 1), 'rebinding is +1 to every virtue, like tempering a blade');
    let ups = 0;
    for (let s = 0; s < 200; s++) {
        const H = Gm.newGame(s); H.flags.bindery = true; H.mats = { leather: 1, ink: 1, gold: 1, star: 1 };
        Gm.act(H, { t: 'craft', kind: 'novel', cover: 'leather', ink: 'ink', accents: ['gold', 'star'] });
        ups += H.books[H.books.length - 1].rarity - 1;
    }
    ok(ups > 140 && ups < 300, `gold leaf and a star fragment each lift the rarity about half the time (${(ups / 200).toFixed(2)} steps a book)`);
    ok(Gm.craftPreview(G, { cover: 'leather', accents: ['gold'] }).hi === 2, 'the preview shows the range');

    // --- reading and skills
    G = Gm.newGame(9);
    const manual = B.makeBook(777, 1, { kind: 'manual', rarity: 1, skill: 'silvertongue' }); G.books.push(manual);
    ok(!Gm.act(G, { t: 'read', book: manual.id }).ok, 'Tam reads in the evening');
    Gm.act(G, { t: 'open' }); Gm.act(G, { t: 'close' }); runDay(G);
    const price0 = Gm.priceOf(G, G.books[0]);
    ok(Gm.act(G, { t: 'read', book: manual.id }).ok && Gm.knows(G, 'silvertongue'), 'reading a manual teaches Tam its skill');
    ok(Gm.priceOf(G, G.books[0]) > price0, 'Silver Tongue raises prices');
    ok(!Gm.act(G, { t: 'read', book: G.books[0].id }).ok, 'one book an evening');

    // --- talking books and Whispering
    const talker = B.makeBook(778, 2, { kind: 'grimoire', rarity: 2, talk: 'giggly' }); G.books.push(talker);
    ok(Gm.act(G, { t: 'talk', book: talker.id }).ok && G.events.some((e) => e.type === 'talk' && e.line), 'a talking book says something');
    ok(!Gm.act(G, { t: 'talk', book: manual.id }).ok, 'an ordinary book doesn\'t');
    G.player.skills.push('whispering'); G.talkedToday = [];
    const m0 = Object.values(G.mats).reduce((a, x) => a + x, 0);
    Gm.act(G, { t: 'talk', book: talker.id }); Gm.act(G, { t: 'talk', book: talker.id });
    ok(Object.values(G.mats).reduce((a, x) => a + x, 0) === m0 + 1, 'with Whispering it gives one gift a day');

    // --- the town
    G = Gm.newGame(10);
    G.town.hearth = 69;
    const pie = B.makeBook(779, 3, { kind: 'cookbook', rarity: 1, virtue: 'hearth' }); G.books.push(pie);
    Gm.act(G, { t: 'shelve', book: pie.id, row: 'wall', slot: 1 });
    const v0 = Gm.visitorsToday(G);
    G.day = 2;
    G.customers = []; G.phase = 'open';
    G.customers.push({ id: 1, folk: 'cook', name: 'Bun', x: 3, tx: 3, state: 'ask', want: { kind: 'cookbook' }, patience: 10 });
    Gm.act(G, { t: 'serve', cust: 1, book: pie.id });
    ok(G.inspired.includes('bakery') && G.events.some((e) => e.type === 'inspired' && e.id === 'bakery'), 'Hearth from sold cookbooks inspires the bakery');
    ok(Gm.visitorsToday(G) >= v0, 'which brings more customers');
    G.town.valor = 999; G.phase = 'evening';
    const n2 = B.makeBook(780, 4, { kind: 'bestiary' }); G.books.push(n2);
    G.phase = 'open'; G.customers.push({ id: 2, folk: 'adventurer', name: 'T', x: 3, tx: 3, state: 'ask', want: { kind: 'bestiary' }, patience: 10 });
    Gm.act(G, { t: 'serve', cust: 2, book: n2.id });
    ok(G.inspired.includes('guild') && G.inspired.includes('guild2') && G.patterns.includes('bestiary'), 'both Valor inspirations, and the Bestiary pattern');

    // --- the trader and the later chapters
    G = Gm.newGame(11);
    Object.assign(G.stats, { sold: 3 });
    Gm.act(G, { t: 'ack', key: 'x' });
    G.stats.expeditions = 1; Gm.act(G, { t: 'ack', key: 'x' });
    G.stats.crafted = 1; Gm.act(G, { t: 'ack', key: 'x' });
    G.stats.requests = 4; Gm.act(G, { t: 'ack', key: 'x' });
    ok(G.story.ch === 5 && G.flags.trader, 'chapters 2–4 done in turn: the trader will come');
    G.phase = 'evening'; Gm.act(G, { t: 'next' });
    ok(G.trader && G.trader.stock.length >= 7, 'Ottoline arrives the next morning');
    ok(G.trader.stock.some((it) => it.book && it.book.talk), 'in chapter 5 she always has a talking book');
    const ti = G.trader.stock.findIndex((it) => it.book && it.book.talk);
    G.gold = 1000;
    ok(Gm.act(G, { t: 'buy', i: ti }).ok && G.books.some((b) => b.talk), 'buying it brings it home');
    ok(!Gm.act(G, { t: 'buy', i: ti }).ok, 'it can\'t be bought twice');
    const talking = G.books.find((b) => b.talk);
    Gm.act(G, { t: 'talk', book: talking.id });
    ok(G.story.ch === 6 && G.patterns.includes('grimoire') && Gm.knows(G, 'whispering'), 'chapter 5 done: grimoires and Whispering');
    G.stats.inspired = 3; Gm.act(G, { t: 'ack', key: 'x' });
    ok(G.story.ch === 7 && Gm.placeOpen(G, 'observatory'), 'chapter 6 done: Starfall Observatory');
    G.phase = 'morning';
    ok(!Gm.act(G, { t: 'craft', masterwork: true }).ok, 'the Book of Larkspur needs its materials');
    G.mats = { dragonhide: 1, moon: 1, star: 1, gold: 1 };
    ok(Gm.act(G, { t: 'craft', masterwork: true }).ok, 'and binds with them');
    const mw = G.books.find((b) => b.masterwork);
    ok(mw && mw.rarity === 4 && mw.title === D.MASTERWORK.name && mw.talk, 'a legendary book that talks');
    ok(G.ending && G.story.ch === 8 && G.events.some((e) => e.type === 'ending'), 'the story ends; the shop goes on');
    ok(!Gm.act(G, { t: 'shelve', book: mw.id, row: 'wall', slot: 1 }).ok && Gm.candidates(G, {}).every((b) => !b.masterwork), 'the Book of Larkspur is never for sale');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, days) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); for (let d = 0; d < days; d++) { Bt.playDay(G, b); G.events.length = 0; } return G; };
    ok(ser(play(42, 6)) === ser(play(42, 6)), 'same seed and play, same game after six days');

    // save in the middle of an open day, with customers in the shop
    const G = play(7, 4);
    const bot = Bt.makeBot({ seed: 7 });
    Bt.morning(G, bot);
    Gm.act(G, { t: 'open' });
    for (let i = 0; i < 6000 && !(G.clock > 15 && G.customers.length > 0); i++) { Gm.step(G, DT); Bt.serve(G, bot); }
    ok(G.phase === 'open' && G.customers.length > 0, 'mid-day, customers inside');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
    const finish = (H, b) => { while (H.phase === 'open') { Gm.step(H, DT); Bt.serve(H, b); } Bt.evening(H, b); Gm.act(H, { t: 'next' }); for (let d = 0; d < 3; d++) Bt.playDay(H, b); H.events.length = 0; };
    G.events.length = 0;
    finish(G, b1); finish(copy, b2);
    ok(ser(G) === ser(copy), 'a save round trip mid-day plays on identically for three more days');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('requests')) {
    section('requests');
    let n = 0, bad = 0;
    for (let s = 1; s <= 8; s++) {
        const G = Gm.newGame(s * 31);
        const bot = Bt.makeBot({ seed: s });
        for (let d = 0; d < 30; d++) {
            Bt.morning(G, bot);
            Gm.act(G, { t: 'open' });
            while (G.phase === 'open') {
                Gm.step(G, DT * 4);
                for (const cu of G.customers) if (cu.state === 'ask' && cu.want && !cu.checked) {
                    cu.checked = true; n++;
                    const r = cu.want;
                    const good = (!r.kind || D.KINDS[r.kind]) && (!r.virtue || (D.VIRTUES[r.virtue] && r.min >= 1 && r.min <= 9))
                        && (!(r.kind && r.virtue) || D.KINDS[r.kind].virtues.includes(r.virtue));
                    if (!good) { bad++; if (bad < 4) console.log('    unanswerable', JSON.stringify(r)); }
                }
                Bt.serve(G, bot);
            }
            Bt.evening(G, bot); Gm.act(G, { t: 'next' }); G.events.length = 0;
        }
    }
    ok(n > 200 && bad === 0, `${n} requests over 240 days, every one answerable by a book the game can make (${bad} not)`);
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) for (const skill of [1, 0.5]) {
        const G = Gm.newGame(s * 7919);
        const bot = Bt.makeBot({ skill, seed: s });
        const chDay = { 1: 1 };
        let bad = null;
        const inv = (H) => {
            if (bad) return;
            if (!Number.isFinite(H.gold) || H.gold < 0) bad = `gold ${H.gold}`;
            else if (H.customers.some((c) => !Number.isFinite(c.x) || c.x < -1 || c.x > H.shop.width + 1)) bad = 'a customer left the shop floor';
            else {
                const seen = new Set();
                for (const b of H.books) {
                    if (seen.has(b.id)) { bad = `book ${b.id} twice`; break; }
                    seen.add(b.id);
                    if (b.loc && b.loc.row && (b.loc.i >= Gm.cap(H, b.loc.row, b.loc.slot))) { bad = `book ${b.id} on a slot that doesn't exist`; break; }
                }
                for (const [m, k] of Object.entries(H.mats)) if (k < 0) bad = `${m} ${k}`;
            }
        };
        for (let d = 0; d < 120 && !G.ending && !bad; d++) {
            Bt.playDay(G, bot, { onStep: inv });
            inv(G);
            G.events.length = 0;
            for (let c = 1; c <= G.story.ch; c++) if (!chDay[c]) chDay[c] = G.day;
        }
        ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
        ok(G.ending, `seed ${s} skill ${skill}: the story ends (day ${G.day})`);
        rows.push({ seed: s, skill, end: G.ending ? G.day : 999, ch: chDay, gold: G.gold, renown: Math.floor(G.renown), sold: G.stats.sold, insp: G.inspired.length });
    }
    const med = (k, f) => { const v = rows.filter((r) => r.skill === k).map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    console.log('  skill | end day (median) | ch2 | ch4 | ch5 | ch6 | ch7 | sold | renown | inspirations');
    for (const k of [1, 0.5]) console.log(`  ${k.toFixed(1).padEnd(5)} | ${String(med(k, (r) => r.end)).padEnd(16)} | ${[2, 4, 5, 6, 7].map((c) => String(med(k, (r) => r.ch[c] ?? 999)).padEnd(3)).join(' | ')} | ${String(med(k, (r) => r.sold)).padEnd(4)} | ${String(med(k, (r) => r.renown)).padEnd(6)} | ${med(k, (r) => r.insp)}`);
    ok(rows.every((r) => r.end <= 45), `every bot finishes the story within 45 days (${rows.map((r) => r.end).join(', ')})`);
    ok(med(1, (r) => r.end) >= 15, `but it takes a while: the good bot's median ending is day ${med(1, (r) => r.end)} (≥ 15)`);
    ok(rows.every((r) => r.ch[2] <= 5), `the first chapter is done within five days (${rows.map((r) => r.ch[2]).join(', ')})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
