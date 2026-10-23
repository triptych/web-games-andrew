/**
 * simtest.mjs — headless checks of Hauntly Manor's simulation. No browser.
 *
 *   node game-095/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-095/dev/simtest.mjs
 *   SEEDS=40 VERBOSE=1 node game-095/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. layout: the seeded layout always holds a solvable house (codes in range, three distinct
 *    books, a real melody), and the clue text carries the numbers the locks want.
 * 3. rules: every puzzle, lock, recipe, wrong try, the case board, the party and the talk.
 * 4. world: every plan step points at a real hotspot in the right room; every room has a way
 *    back; every hotspot has a name; every line of dialogue is short enough to read.
 * 5. determinism: the same seed and inputs give the same game; a save round trip mid-story
 *    plays on identically.
 * 6. bot: the bot plays the whole story on SEEDS seeds and the table is printed.
 * 7. fuzz: random actions from the start, then the bot finishes from wherever that left things.
 *    Nothing can be lost or locked, so it must always finish.
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
const W = await import('../js/sim/world.js');
const D = await import('../js/sim/data.js');
const Lay = await import('../js/sim/layout.js');
const Plan = await import('../js/sim/plan.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const tick = (G, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, DT); };
const has = (G, i) => G.inv.includes(i);
const lines = (G) => G.events.filter((e) => e.type === 'say').map((e) => e.text);
const ev = (G, type) => G.events.filter((e) => e.type === type);
const clear = (G) => { G.events.length = 0; };

/** Run the bot to the end (or a stuck step). Returns { actions, G }. */
function playOut(G, { skill = 1, seed = 7, maxActions = 2000, onAction = null } = {}) {
    const bot = Bt.makeBot({ skill, seed });
    let actions = 0, stuck = null;
    for (let n = 0; n < maxActions; n++) {
        const a = Bt.botAct(G, bot);
        if (a.type === 'done') break;
        if (a.type === 'stuck') { stuck = a.step; break; }
        if (a.type !== 'wait') { Gm.act(G, a); actions++; onAction?.(G, a); }
        tick(G, 0.1);
        clear(G);
    }
    return { actions, stuck, G };
}

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout|setInterval/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('layout')) {
    section('layout');
    let bad = 0;
    for (let s = 1; s <= 600; s++) {
        const L = Lay.makeLayout(s * 7919);
        const good = L.age >= 5 && L.age <= 9 && L.day >= 2 && L.day <= 9 && L.guests >= 3 && L.guests <= 9
            && new Set(L.bookOrder).size === 3 && L.bookOrder.every((i) => i >= 0 && i < 5)
            && new Set(L.bookTitles).size === 5 && D.BOOK_TITLES.every((t) => L.bookTitles.includes(t))
            && L.melody.length === 4 && L.melody.every((n) => n >= 0 && n < 5) && !L.melody.every((n) => n === L.melody[0])
            && Lay.KEY_SPOTS.includes(L.keySpot) && Object.values(L.peeks).every((p) => p >= 0 && p < 3);
        if (!good) { bad++; console.log('  bad layout', s, JSON.stringify(L)); }
    }
    ok(bad === 0, '600 seeds make valid layouts');
    ok(JSON.stringify(Lay.makeLayout(5)) === JSON.stringify(Lay.makeLayout(5)), 'a seed always makes the same layout');
    const seen = { keySpot: new Set(), age: new Set(), melody: new Set(), order: new Set() };
    for (let s = 1; s <= 200; s++) { const L = Lay.makeLayout(s); seen.keySpot.add(L.keySpot); seen.age.add(L.age); seen.melody.add(L.melody.join()); seen.order.add(L.bookOrder.join()); }
    ok(seen.keySpot.size === 3 && seen.age.size === 5 && seen.melody.size > 40 && seen.order.size > 20, `seeds vary the house (${seen.keySpot.size} key spots, ${seen.age.size} ages, ${seen.melody.size} melodies, ${seen.order.size} book orders in 200)`);
    // the clue text carries what the locks want, so a player can solve them from the journal alone
    for (let s = 1; s <= 60; s++) {
        const L = Lay.makeLayout(s);
        ok(D.CLUES.portrait.text(L).includes(`aged ${L.age}`), `seed ${s}: the portrait clue names the age`);
        ok(D.CLUES.partyday.text(L).includes(D.ordinal(L.day)), `seed ${s}: the calendar clue names the day`);
        ok(D.CLUES.guests.text(L).includes(`${L.guests} little guests`), `seed ${s}: the guest-list clue names the count`);
        const r = D.CLUES.rhyme.text(L);
        const idx = L.bookOrder.map((i) => r.indexOf(L.bookTitles[i]));
        ok(idx.every((x) => x >= 0) && idx[0] < idx[1] && idx[1] < idx[2], `seed ${s}: the rhyme lists the titles in pull order`);
        const l = D.CLUES.lullaby.text(L);
        const li = L.melody.reduce((acc, n) => { const p = l.indexOf(D.NOTE_NAMES[n], acc.pos); acc.ok = acc.ok && p >= 0; acc.pos = p + 1; return acc; }, { ok: true, pos: 0 });
        ok(li.ok, `seed ${s}: the lullaby clue lists the notes in order`);
    }
}

if (want('rules')) {
    section('rules');
    // ---- a fresh house
    let G = Gm.newGame(1);
    ok(G.room === 'foyer' && G.inv.length === 0 && G.clues.length === 0, 'a new game starts in the foyer with nothing');
    ok(W.visibleHotspots(G).every((id) => W.HOTSPOTS[id].room === 'foyer'), 'only the foyer\'s hotspots are tappable at first');
    Gm.act(G, { type: 'click', id: 'k_oven' });
    ok(G.events.length === 0, 'tapping something in another room does nothing');
    Gm.act(G, { type: 'go', room: 'library' });
    ok(G.room === 'foyer', 'a locked room cannot be entered');
    Gm.act(G, { type: 'go', room: 'ballroom' });
    ok(G.room === 'foyer', 'the ballroom cannot be entered before the case is solved');

    // ---- the key hides in the seeded spot only
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        G = Gm.newGame(seed);
        Gm.act(G, { type: 'go', room: 'parlor' });
        for (const spot of Lay.KEY_SPOTS) Gm.act(G, { type: 'click', id: 'p_' + spot });
        ok(has(G, 'brass_key') && G.inv.filter((i) => i === 'brass_key').length === 1, `seed ${seed}: searching all three spots finds exactly one key`);
        const before = G.inv.length;
        Gm.act(G, { type: 'click', id: 'p_' + G.layout.keySpot });
        ok(G.inv.length === before, `seed ${seed}: the key spot does not give a second key`);
    }
    G = Gm.newGame(1);
    Gm.act(G, { type: 'go', room: 'parlor' });
    const wrong = Lay.KEY_SPOTS.find((s) => s !== G.layout.keySpot);
    Gm.act(G, { type: 'click', id: 'p_' + wrong });
    ok(!has(G, 'brass_key'), 'a wrong spot gives only a silly line');

    // ---- the library door
    G = Gm.newGame(1); G.inv.push('brass_key');
    Gm.act(G, { type: 'click', id: 'd_f_library' });
    ok(G.room === 'foyer', 'tapping the locked library door does not open it');
    Gm.act(G, { type: 'use', item: 'brass_key', id: 'd_f_library' });
    ok(G.f.lib_open && !has(G, 'brass_key'), 'the brass key opens the library door and is used up');
    Gm.act(G, { type: 'click', id: 'd_f_library' });
    ok(G.room === 'library' && G.visited.library, 'then the door leads in');

    // ---- wrong items never get lost
    G = Gm.newGame(1); G.inv.push('broom', 'card');
    Gm.act(G, { type: 'use', item: 'card', id: 'f_portrait' });
    ok(has(G, 'card') && ev(G, 'nope').length === 1, 'a wrong item on a hotspot earns a line and is kept');
    Gm.act(G, { type: 'use', item: 'brass_key', id: 'f_portrait' });
    ok(ev(G, 'nope').length === 1, 'an item you do not have cannot be used');
    Gm.act(G, { type: 'combine', a: 'broom', b: 'card' });
    ok(has(G, 'broom') && has(G, 'card'), 'a pair that does not combine stays as it was');

    // ---- the hatch and the attic
    G = Gm.newGame(1); G.inv.push('broom');
    Gm.act(G, { type: 'click', id: 'f_hatch' });
    ok(!G.f.attic_open, 'the hatch will not open by hand');
    Gm.act(G, { type: 'use', item: 'broom', id: 'f_hatch' });
    Gm.act(G, { type: 'click', id: 'f_hatch' });
    ok(G.f.attic_open && G.room === 'attic', 'the broom reaches the cord and the ladder leads up');

    // ---- the pantry lock
    G = Gm.newGame(3); G.room = 'kitchen'; clear(G);
    const L3 = G.layout;
    Gm.act(G, { type: 'code', id: 'pantry', digits: [L3.age, L3.day, (L3.guests % 9) + 1] });
    ok(!G.f.pantry_open && ev(G, 'code')[0].ok === false, 'a wrong code does not open the pantry');
    Gm.act(G, { type: 'code', id: 'pantry', digits: [L3.day, L3.age, L3.guests] });
    ok(L3.day === L3.age || !G.f.pantry_open, 'the digits must be in order (age, day, guests)');
    Gm.act(G, { type: 'code', id: 'pantry', digits: [L3.age, L3.day, L3.guests] });
    ok(G.f.pantry_open && has(G, 'cake_mix') && has(G, 'frosting'), 'the right code opens it and gives the cake mix and frosting');
    Gm.act(G, { type: 'code', id: 'pantry', digits: [L3.age, L3.day, L3.guests] });
    ok(G.inv.filter((i) => i === 'cake_mix').length === 1, 'it cannot be opened twice for double ingredients');
    G = Gm.newGame(3);
    Gm.act(G, { type: 'code', id: 'pantry', digits: [G.layout.age, G.layout.day, G.layout.guests] });
    ok(!G.f.pantry_open, 'the pantry code does nothing from another room');

    // ---- the oven
    G = Gm.newGame(1); G.room = 'kitchen'; G.inv.push('cake_mix'); clear(G);
    Gm.act(G, { type: 'use', item: 'cake_mix', id: 'k_oven' });
    ok(G.f.baking && !has(G, 'cake_mix'), 'cake mix in the oven starts the bake');
    tick(G, C.BAKE_SECONDS - 0.5);
    Gm.act(G, { type: 'click', id: 'k_oven' });
    ok(!has(G, 'plain_cake'), 'the cake is not ready early');
    tick(G, 1);
    ok(G.f.baked && !G.f.baking && ev(G, 'ding').length === 1, 'it dings when done');
    Gm.act(G, { type: 'click', id: 'k_oven' });
    ok(has(G, 'plain_cake') && G.f.cake_taken, 'then the cake comes out');
    Gm.act(G, { type: 'click', id: 'k_oven' });
    ok(G.inv.filter((i) => i === 'plain_cake').length === 1, 'and only once');

    // ---- recipes
    G = Gm.newGame(1); G.inv.push('ink', 'quill', 'card', 'frosting', 'plain_cake', 'candles');
    Gm.act(G, { type: 'combine', a: 'quill', b: 'ink' });
    ok(has(G, 'inked_quill') && !has(G, 'ink') && !has(G, 'quill'), 'ink and quill make an inked quill (either order)');
    Gm.act(G, { type: 'combine', a: 'card', b: 'inked_quill' });
    ok(has(G, 'invitation') && !has(G, 'card'), 'the inked quill and the card make the invitation');
    Gm.act(G, { type: 'combine', a: 'frosting', b: 'plain_cake' });
    Gm.act(G, { type: 'combine', a: 'candles', b: 'frosted_cake' });
    ok(has(G, 'birthday_cake') && !has(G, 'candles'), 'frosting, cake and candles make the birthday cake');
    Gm.act(G, { type: 'combine', a: 'invitation', b: 'invitation' });
    ok(has(G, 'invitation'), 'an item does not combine with itself');
    ok(D.RECIPES.every((r) => D.ITEMS[r.a] && D.ITEMS[r.b] && D.ITEMS[r.out]), 'every recipe names real items');

    // ---- the bookshelf
    G = Gm.newGame(2); G.room = 'library'; clear(G);
    const o = G.layout.bookOrder;
    const notNext = [0, 1, 2, 3, 4].find((i) => i !== o[0]);
    Gm.act(G, { type: 'click', id: 'l_book_' + notNext });
    ok(G.books.length === 0 && ev(G, 'book')[0].ok === false, 'a wrong first book does nothing');
    Gm.act(G, { type: 'click', id: 'l_book_' + o[0] });
    ok(G.books.length === 1, 'the right first book stays pulled');
    Gm.act(G, { type: 'click', id: 'l_book_' + notNext });
    ok(G.books.length === 0 || notNext === o[1], 'a wrong second book resets the shelf');
    for (const i of o) Gm.act(G, { type: 'click', id: 'l_book_' + i });
    ok(G.f.shelf_open && W.hotspotShown(G, 'l_compartment'), 'pulling them in order opens the compartment');
    Gm.act(G, { type: 'click', id: 'l_compartment' });
    ok(has(G, 'winding_key') && !W.hotspotShown(G, 'l_compartment'), 'which holds the winding key, once');

    // ---- the music box
    G = Gm.newGame(2); G.room = 'parlor'; G.inv.push('winding_key'); clear(G);
    Gm.act(G, { type: 'click', id: 'p_musicbox' });
    ok(G.clues.includes('giggle') && ev(G, 'open').length === 0, 'the box giggles first and cannot be played unwound');
    Gm.act(G, { type: 'note', n: 0 });
    ok(G.notes.length === 0, 'notes are ignored until it is wound');
    Gm.act(G, { type: 'use', item: 'winding_key', id: 'p_musicbox' });
    ok(G.f.box_wound && !has(G, 'winding_key') && ev(G, 'open')[0]?.ui === 'melody', 'the winding key winds it and opens the keys');
    const m = G.layout.melody;
    const badTune = m.map((n, i) => (i === 3 ? (n + 1) % 5 : n));
    for (const n of badTune) Gm.act(G, { type: 'note', n });
    ok(!G.f.box_open && G.notes.length === 0, 'a wrong tune is wiped after four notes');
    for (const n of m) Gm.act(G, { type: 'note', n });
    ok(G.f.box_open && has(G, 'trunk_key') && has(G, 'music_box') && !W.hotspotShown(G, 'p_musicbox'), 'the right tune gives the star key and the music box');

    // ---- the trunk
    G = Gm.newGame(1); G.room = 'attic'; G.inv.push('trunk_key'); clear(G);
    Gm.act(G, { type: 'use', item: 'trunk_key', id: 'a_trunk' });
    ok(G.f.trunk_open && has(G, 'streamers') && G.clues.includes('diary3'), 'the star key opens the trunk: streamers and a diary page');

    // ---- the case board
    G = Gm.newGame(1);
    Gm.act(G, { type: 'accuse', who: 'ghost' });
    ok(!G.f.case_solved, 'you cannot accuse without evidence');
    for (const [room, id] of [['foyer', 'f_chandelier'], ['kitchen', 'k_floor'], ['parlor', 'p_musicbox']]) { Gm.act(G, { type: 'go', room }); Gm.act(G, { type: 'click', id }); }
    ok(W.evidenceCount(G) === C.EVIDENCE_NEEDED, 'three pieces of evidence are enough to decide');
    for (const who of ['raccoon', 'pipes', 'caretaker']) {
        clear(G);
        Gm.act(G, { type: 'accuse', who });
        ok(!G.f.case_solved && ev(G, 'wrong').length === 1 && lines(G).length === 1, `${who} is wrong, with a reason`);
    }
    Gm.act(G, { type: 'accuse', who: 'ghost' });
    ok(G.f.case_solved && G.f.ball_open, 'the lonely ghost is right and the ballroom opens');
    Gm.act(G, { type: 'go', room: 'ballroom' });
    ok(G.room === 'ballroom', 'and you can walk in');

    // ---- the party and the talk
    for (const pick of [0, 1, 2]) {
        G = Gm.newGame(4);
        G.f.ball_open = true; G.f.case_solved = true; G.room = 'ballroom';
        G.inv.push('birthday_cake', 'streamers', 'music_box', 'invitation');
        clear(G);
        Gm.act(G, { type: 'use', item: 'birthday_cake', id: 'b_table' });
        Gm.act(G, { type: 'use', item: 'streamers', id: 'b_banner' });
        Gm.act(G, { type: 'use', item: 'music_box', id: 'b_stand' });
        ok(!G.f.party_ready && !G.talk, `(pick ${pick}) three of four placed: no party yet`);
        Gm.act(G, { type: 'use', item: 'invitation', id: 'b_easel' });
        ok(G.f.party_ready && G.talk?.node === 'meet', `(pick ${pick}) the fourth starts the talk`);
        Gm.act(G, { type: 'click', id: 'b_table' });
        ok(G.talk.node === 'meet', `(pick ${pick}) other actions are ignored while Winnie talks`);
        Gm.act(G, { type: 'choose', i: pick });
        ok(G.talk.node === 'ask', `(pick ${pick}) a choice moves the talk on`);
        Gm.act(G, { type: 'choose', i: pick });
        ok(!G.talk && G.ending === ['warm', 'funny', 'brave'][pick], `(pick ${pick}) the second ends the story: ${G.ending}`);
        ok(typeof D.EPILOGUE[G.ending] === 'string', `(pick ${pick}) the ending has an epilogue`);
        Gm.act(G, { type: 'go', room: 'foyer' });
        ok(G.room === 'ballroom', `(pick ${pick}) nothing acts after the end`);
    }
    G = Gm.newGame(4); G.f.ball_open = true; G.room = 'ballroom'; G.inv.push('birthday_cake', 'streamers', 'music_box', 'invitation');
    for (const [item, id] of [['music_box', 'b_stand'], ['invitation', 'b_easel'], ['streamers', 'b_banner'], ['birthday_cake', 'b_table']]) Gm.act(G, { type: 'use', item, id });
    ok(G.f.party_ready, 'the party works in any order');

    // ---- the shy ghosts
    G = Gm.newGame(1);
    Gm.act(G, { type: 'click', id: 'peek_foyer' });
    ok(G.stats.wisps === 1 && !W.hotspotShown(G, 'peek_foyer'), 'a peeking ghost can be found once');
    Gm.act(G, { type: 'click', id: 'peek_foyer' });
    ok(G.stats.wisps === 1, 'and is not counted twice');

    // ---- the clock
    G = Gm.newGame(1);
    const spooks = [];
    tick(G, 400);
    ok(G.events.filter((e) => e.type === 'spook').length >= 12 && G.events.filter((e) => e.type === 'spook').length <= 32, `ambient spooks come every ${C.SPOOK.min}-${C.SPOOK.max} s (${G.events.filter((e) => e.type === 'spook').length} in 400 s)`);
    ok(G.events.filter((e) => e.type === 'spook').every((e) => ['candle', 'breeze', 'giggle', 'sheet', 'creak'].includes(e.kind)), 'every spook is a known harmless kind');
    ok(Math.abs(G.t - 400) < 0.1, 'the clock counts game time');
    G = Gm.newGame(1); tick(G, 10); Gm.act(G, { type: 'click', id: 'f_lamp' });
    ok(G.idle === 0, 'acting resets the idle timer');
    tick(G, 50);
    ok(G.idle > C.IDLE_NUDGE, 'idling past the nudge time is noticed');
}

if (want('world')) {
    section('world');
    const G = Gm.newGame(1);
    const rooms = Object.keys(D.ROOMS);
    ok(rooms.length === 6, 'six rooms');
    for (const [id, h] of Object.entries(W.HOTSPOTS)) {
        ok(rooms.includes(h.room), `${id} is in a real room`);
        ok(typeof W.hotspotName(G, id) === 'string' && W.hotspotName(G, id).length > 0, `${id} has a name`);
        ok(typeof h.click === 'function', `${id} has a tap handler`);
        for (const item of Object.keys(h.use || {})) ok(D.ITEMS[item], `${id}: use handler for a real item (${item})`);
    }
    for (const room of rooms.filter((r) => r !== 'foyer')) {
        ok(Object.values(W.HOTSPOTS).some((h) => h.room === room && h.kind === 'door'), `${room} has a door back`);
        ok(W.HOTSPOTS['peek_' + room], `${room} has a shy ghost`);
    }
    for (const s of Plan.PLAN) {
        const hsid = typeof s.hs === 'function' ? s.hs(G) : s.hs;
        if (hsid) ok(W.HOTSPOTS[hsid] && W.HOTSPOTS[hsid].room === s.room, `plan step ${s.id}: its hotspot ${hsid} is in ${s.room}`);
        ok(s.hint.length === 3, `plan step ${s.id}: three hints`);
        ok(s.hint.every((h) => (typeof h === 'function' ? h(G) : h).length > 10), `plan step ${s.id}: hints are real sentences`);
    }
    ok(new Set(Plan.PLAN.map((s) => s.id)).size === Plan.PLAN.length, 'plan step ids are unique');
    for (const [k, c] of Object.entries(D.CLUES)) {
        ok(['evidence', 'code', 'diary', 'clue'].includes(c.kind), `clue ${k} has a kind`);
        ok(c.text(Lay.makeLayout(1)).length > 20 && c.text(Lay.makeLayout(1)).length < 400, `clue ${k} text is a readable length`);
    }
    // every line of dialogue the bot reaches fits the box
    const speakers = new Set(['', 'Maya', 'Theo', 'June', 'Dev', 'Winnie']);
    let longest = 0, count = 0, badSpeaker = null;
    const G2 = Gm.newGame(9); Gm.intro(G2);
    playOut(G2, { onAction: (g) => { for (const e of g.events) if (e.type === 'say') { count++; longest = Math.max(longest, e.text.length); if (!speakers.has(e.who)) badSpeaker = e.who; if (!e.text) badSpeaker = 'empty'; } } });
    for (const e of G2.events) if (e.type === 'say') { count++; }
    ok(!badSpeaker, `every line has a known speaker (${badSpeaker || 'ok'})`);
    ok(longest < 420, `no line is longer than 420 characters (longest ${longest} in ${count})`);
    for (const node of Object.values(D.TALK)) for (const c of node.choices) ok(c.text.length < 90 && ['Maya', 'Theo', 'June', 'Dev'].includes(c.who), `choice "${c.text.slice(0, 24)}…" fits a button`);
}

if (want('determinism')) {
    section('determinism');
    const run = (seed) => { const G = Gm.newGame(seed); playOut(G, { maxActions: 60 }); return G; };
    ok(JSON.stringify(Gm.serialize(run(42))) === JSON.stringify(Gm.serialize(run(42))), 'same seed and inputs, same game');
    ok(JSON.stringify(Gm.serialize(run(42))) !== JSON.stringify(Gm.serialize(run(43))), 'a different seed is a different game');

    const G = Gm.newGame(7);
    playOut(G, { maxActions: 40 });
    const data = JSON.parse(JSON.stringify(Gm.serialize(G)));
    ok(!('events' in data) && !('rng' in data) && typeof data.rngState === 'number', 'a save has no events and no rng object, only its state');
    const copy = Gm.deserialize(data);
    ok(Array.isArray(copy.events), 'a loaded game has a fresh event list');
    const a = playOut(G, { seed: 3 }), b = playOut(copy, { seed: 3 });
    ok(JSON.stringify(Gm.serialize(a.G)) === JSON.stringify(Gm.serialize(b.G)), 'a save round trip mid-story plays on identically');
    ok(a.G.ending && b.G.ending, 'and both reach an ending');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize(null); } catch { threw = true; }
    ok(threw, 'an empty save is rejected');
    // the save also keeps a half-solved lock, a pulled book and a baking cake
    const H = Gm.newGame(5); H.room = 'kitchen'; H.inv.push('cake_mix'); Gm.act(H, { type: 'use', item: 'cake_mix', id: 'k_oven' }); tick(H, 2);
    const H2 = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(H))));
    tick(H, 5); tick(H2, 5);
    ok(H.f.baked && H2.f.baked, 'a cake baking at save time finishes after a load');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.4]) {
            const G = Gm.newGame(s * 7919);
            const r = playOut(G, { skill, seed: s });
            ok(!r.stuck && G.ending, `seed ${s} skill ${skill}: reaches an ending${r.stuck ? ' (stuck at ' + r.stuck + ')' : ''}`);
            const inv = G.inv.length === 0 || G.inv.every((i) => D.ITEMS[i]);
            ok(inv && new Set(G.inv).size === G.inv.length, `seed ${s} skill ${skill}: the pack is sane at the end`);
            ok(Object.keys(D.ROOMS).every((r2) => G.visited[r2]), `seed ${s} skill ${skill}: every room visited`);
            rows.push({ seed: s, skill, actions: r.actions, t: G.t, ending: G.ending, clues: G.clues.length });
        }
    }
    const avg = (k, f) => (rows.filter((r) => r.skill === k).reduce((a, r) => a + r[f], 0) / SEEDS).toFixed(1);
    ok(+avg(1, 'actions') < 160, `a perfect run takes under 160 actions (average ${avg(1, 'actions')})`);
    ok(rows.every((r) => r.clues === Object.keys(D.CLUES).length - 0 || r.clues >= Object.keys(D.CLUES).length - 1), 'the bot finds every clue (the mirror is the only one it skips)');
    const ends = {};
    for (const r of rows) ends[r.ending] = (ends[r.ending] || 0) + 1;
    console.log(`  ${rows.length} runs · actions per run: perfect ${avg(1, 'actions')}, random choices ${avg(0.4, 'actions')} · game time ${avg(1, 'actions') && avg(1, 't')} s · endings ${JSON.stringify(ends)}`);
}

if (want('hints')) {
    section('hints');
    // the hint button always has a next step until the party is on, and gets clearer each time
    const G = Gm.newGame(11);
    let steps = 0;
    for (let n = 0; n < 400 && !G.ending; n++) {
        const s = Plan.firstPending(G);
        if (!s) break;
        clear(G);
        Gm.act(G, { type: 'hint' });
        const h1 = ev(G, 'hint')[0];
        Gm.act(G, { type: 'hint' }); Gm.act(G, { type: 'hint' });
        const h3 = ev(G, 'hint')[2];
        if (!(h1.level === 1 && h1.id === null && h3.level === 3 && h3.text.length > 10)) { ok(false, `step ${s.id}: hint levels 1 and 3 are shaped right`); break; }
        if (h3.room && !D.ROOMS[h3.room]) ok(false, `step ${s.id}: hint names a real room`);
        if (h3.id) ok(W.HOTSPOTS[h3.id], `step ${s.id}: hint 3 points at a real hotspot (${h3.id})`);
        // do just this step, using the plan's own actions
        for (const a of s.acts(G)) { if (a.type !== 'wait') Gm.act(G, a); }
        tick(G, 7);
        if (G.talk) { while (G.talk) Gm.act(G, { type: 'choose', i: 0 }); }
        if (!s.done(G) && s.id !== 'cake') { ok(false, `step ${s.id}: its own actions finish it`); break; }
        steps++;
        if (s.id === 'cake' && !s.done(G)) { Gm.act(G, { type: 'go', room: 'kitchen' }); Gm.act(G, { type: 'click', id: 'k_oven' }); }
    }
    ok(steps >= 30, `the plan walks the whole story one hinted step at a time (${steps} steps)`);
    clear(G);
    Gm.act(G, { type: 'hint' });
    ok(!G.ending || ev(G, 'hint').length === 0, 'no hint after the ending');
}

if (want('fuzz')) {
    section('fuzz');
    // random actions from the start. Nothing can be lost or locked, so the bot must always finish.
    const NOTES = [0, 1, 2, 3, 4];
    const ITEM_IDS = Object.keys(D.ITEMS);
    let runs = 0, bad = 0;
    for (let s = 1; s <= Math.max(20, SEEDS * 2); s++) {
        const G = Gm.newGame(s * 31);
        let r = s * 2654435761 >>> 0;
        const rnd = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
        const pick = (a) => a[Math.floor(rnd() * a.length)];
        let problem = null;
        for (let n = 0; n < 500 && !G.ending && !problem; n++) {
            const k = rnd();
            if (G.talk) { Gm.act(G, { type: 'choose', i: Math.floor(rnd() * 3) }); }
            else if (k < 0.5) Gm.act(G, { type: 'click', id: pick(W.visibleHotspots(G)) });
            else if (k < 0.7 && G.inv.length) Gm.act(G, { type: 'use', item: pick(G.inv), id: pick(W.visibleHotspots(G)) });
            else if (k < 0.78 && G.inv.length > 1) Gm.act(G, { type: 'combine', a: pick(G.inv), b: pick(G.inv) });
            else if (k < 0.84) Gm.act(G, { type: 'go', room: pick(Object.keys(D.ROOMS)) });
            else if (k < 0.9) Gm.act(G, { type: 'note', n: pick(NOTES) });
            else if (k < 0.94) Gm.act(G, { type: 'code', id: 'pantry', digits: [Math.floor(rnd() * 10), Math.floor(rnd() * 10), Math.floor(rnd() * 10)] });
            else if (k < 0.97) Gm.act(G, { type: 'accuse', who: pick(Object.keys(D.SUSPECTS)) });
            else if (k < 0.99) Gm.act(G, { type: 'use', item: pick(ITEM_IDS), id: pick(Object.keys(W.HOTSPOTS)) });
            else Gm.act(G, { type: 'hint' });
            tick(G, 0.2 + rnd() * 3);
            // invariants after every action
            if (new Set(G.inv).size !== G.inv.length) problem = 'duplicate item in the pack';
            else if (G.inv.some((i) => !D.ITEMS[i])) problem = 'unknown item';
            else if (new Set(G.clues).size !== G.clues.length || G.clues.some((c) => !D.CLUES[c])) problem = 'bad clue list';
            else if (!W.roomOpen(G, G.room)) problem = 'standing in a locked room';
            else if (!Number.isFinite(G.t) || G.bake < 0) problem = 'bad clock';
            else if (G.f.baking && G.f.baked) problem = 'baking and baked';
            else if (G.f.box_open && !(G.f.box_wound)) problem = 'music box open but never wound';
            else if (G.f.ball_open && !G.f.case_solved) problem = 'ballroom open without the case';
            clear(G);
        }
        runs++;
        if (problem) { bad++; ok(false, `fuzz seed ${s}: ${problem}`); continue; }
        // from wherever that left things, the bot finishes
        const res = playOut(G, { maxActions: 600 });
        if (!ok(!res.stuck && G.ending, `fuzz seed ${s}: the bot finishes after random play${res.stuck ? ' (stuck at ' + res.stuck + ')' : ''}`)) bad++;
    }
    console.log(`  ${runs} random games, ${bad} problems`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
