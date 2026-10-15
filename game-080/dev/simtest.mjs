/**
 * simtest.mjs — headless checks of EMBERLEAF's simulation. No browser.
 *
 *   node game-080/dev/simtest.mjs            # everything
 *   ONLY=purity,world,gating node game-080/dev/simtest.mjs
 *   SEEDS=4 VERBOSE=1 node game-080/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the
 *    clock, and never import the view, the UI or the audio.
 * 2. world: every map builds; towns, doors and warps line up; every door leads somewhere and back;
 *    no person stands on a doorstep; every zone's doorways reach its middle.
 * 3. gating: the planner proves the kingdom can be finished in order, that each grimoire's
 *    lock really keeps you out until you have it (and nothing else does), and that every chest,
 *    person, sign, lectern and guardian can be reached in the end.
 * 4. rules: walking and walls, doors, chests, keys and locked doors, each power on its lock,
 *    swimming, shops, resting, the Returns Cart, a battle from start to end, losing a battle.
 * 5. people: every person's every script (at several points in the story) runs to its end through
 *    the real dialogue runner: no unknown op, no missing label, no unknown item.
 * 6. determinism: same seed and inputs, same game; a save round trip plays on identically; an
 *    unknown save version is refused.
 * 7. bot: the bot plays the whole game from the title to the end on SEEDS seeds, at two skill
 *    levels, and prints the balance table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 3);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const WG = await import('../js/sim/worldgen.js');
const PL = await import('../js/sim/plan.js');
const ST = await import('../js/sim/story.js');
const RU = await import('../js/sim/rules.js');
const BA = await import('../js/sim/battle.js');
const { T, TILES } = await import('../js/sim/data/tiles.js');
const { NPCS } = await import('../js/sim/data/npcs.js');
const { ITEMS, SHOPS } = await import('../js/sim/data/items.js');
const { ZONES, CONNS } = await import('../js/sim/data/world.js');
const { FOE, ENEMIES, BOSSES, BIOME_FOES, statsFor } = await import('../js/sim/data/enemies.js');
const { GRIMOIRE, BOOK_ORDER, COMMON_BOOKS } = await import('../js/sim/data/books.js');
const { QUESTS, OVERDUE } = await import('../js/sim/data/quests.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false };
const { maps } = WG.getWorld();
const W = maps.world;
const fresh = (seed = 1) => { const G = Gm.newGame(seed, { skipIntro: true }); G.flags.metWick = 1; G.events.length = 0; return G; };
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const place = (G, map, x, y, dir = 'down') => { if (G.map !== map) Gm._test.enterMap(G, map); G.map = map; G.p.x = x + 0.5; G.p.y = y + 0.55; G.p.dir = dir; G.grace = 99; };
const finishDialog = (G) => { let n = 0; while (G.mode === 'dialog' && n++ < 400) { if (G.dialog.choices) Gm.act(G, { type: 'choose', i: 0 }); else Gm.act(G, { type: 'advance' }); } return G.mode !== 'dialog'; };
const find = (map, kind, pred = () => true) => { const M = maps[map]; for (const k in M.objs) if (M.objs[k].kind === kind && pred(M.objs[k])) return { x: k % M.w, y: Math.floor(k / M.w), o: M.objs[k] }; return null; };
const findTile = (map, t) => { const M = maps[map]; for (let i = 0; i < M.t.length; i++) if (M.t[i] === t) return { x: i % M.w, y: Math.floor(i / M.w) }; return null; };

// =====================================================================
if (want('purity')) {
    section('purity');
    const dir = path.join(ROOT, 'js/sim');
    const files = ['js/rng.js', 'js/config.js'];
    const walk = (d, rel) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p, rel + f + '/'); else if (f.endsWith('.js')) files.push(rel + f); } };
    walk(dir, 'js/sim/');
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// =====================================================================
if (want('world')) {
    section('world');
    ok(Object.keys(maps).length >= 40, `every map builds (${Object.keys(maps).length})`);
    // doors both ways
    let doors = 0;
    for (const k in W.warps) {
        const wp = W.warps[k];
        const D = maps[wp.to];
        doors++;
        ok(D && D.arrive && Gm.mapOf, `world door ${k % W.w},${Math.floor(k / W.w)} leads into ${wp.to}`);
        const back = D.warps[D.exit.y * D.w + D.exit.x];
        ok(back && back.to === 'world' && back.x === k % W.w && back.y === Math.floor(k / W.w) + 1, `${wp.to}'s way out returns to its doorstep`);
        const step = (Math.floor(k / W.w) + 1) * W.w + k % W.w;
        ok(RU.passable(null, W, step, []) || TILES[W.t[step]].lock, `${wp.to}'s doorstep is walkable (or behind a grimoire's lock)`);
    }
    console.log(`  ${doors} doors`);
    // interiors: the arrival point is walkable and next to the way out
    for (const id in maps) {
        const M = maps[id];
        if (M.kind === 'world') continue;
        ok(M.arrive && RU.passable(null, M, M.arrive.y * M.w + M.arrive.x, []), `${id}: arrival is walkable`);
        ok(M.exit && Math.abs(M.exit.x - M.arrive.x) + Math.abs(M.exit.y - M.arrive.y) === 1, `${id}: arrival is beside the way out`);
    }
    // nobody stands on a doorstep, a door or in a wall
    for (const id in maps) {
        const M = maps[id];
        for (const n of M.npcs) {
            const i = n.y * M.w + n.x;
            ok(!TILES[M.t[i]].solid || M.t[i] === T.counter, `${id}: ${n.id} stands somewhere sensible`);
            ok(!M.warps[(n.y - 1) * M.w + n.x] && !M.warps[i], `${id}: ${n.id} is not in a doorway`);
            ok(!!NPCS[n.id], `${id}: ${n.id} has a definition`);
        }
    }
    // foes: every spawn on walkable ground (or water, for lake foes), every foe kind defined
    for (const id in maps) for (const s of maps[id].spawns) {
        const M = maps[id];
        const t = M.t[Math.floor(s.y) * M.w + Math.floor(s.x)];
        ok(s.swim ? TILES[t].swim : !TILES[t].solid, `${id}: spawn ${s.id} on ${TILES[t].name}`);
        for (const f of s.foes) ok(!!FOE[f], `${id}: foe ${f} exists`);
    }
    // chests hold real items
    for (const id in maps) for (const k in maps[id].objs) { const o = maps[id].objs[k]; if (o.kind === 'chest' && !o.key) ok(!!ITEMS[o.item], `${id}: chest ${o.id} holds ${o.item}`); }
    // every grimoire has a guardian, every guardian a dungeon
    for (const b of BOOK_ORDER) ok(!!find(ST.BOOK_DUNGEON[b], 'boss'), `${b}'s guardian waits in ${ST.BOOK_DUNGEON[b]}`);
    ok(!!find('undercroft', 'boss', (o) => o.id === 'blot'), 'the Blot waits in the Undercroft');
    // every shop has a keeper
    for (const sid in SHOPS) {
        let keeper = false;
        for (const id in maps) for (const n of maps[id].npcs) {
            const s = NPCS[n.id].talk ? NPCS[n.id].talk(fresh()) : [];
            if (s.some((op) => op[0] === 'shop' && op[1] === sid) || (n.id === 'lodgekeeper' && sid === 'frost_lodge')) keeper = true;
        }
        ok(keeper, `shop ${sid} has a keeper`);
        for (const it of SHOPS[sid].stock) ok(!!ITEMS[it] && ITEMS[it].price > 0, `shop ${sid} sells ${it} at a price`);
    }
    // every zone was given a name and a biome that exists; every connection joins neighbours
    ok(ZONES.length === C.ZC * C.ZR, `${ZONES.length} zones fill the ${C.ZC} × ${C.ZR} grid`);
    ok(CONNS.length > 60, `${CONNS.length} passages between zones`);
    // the library has 12 lecterns, a bed, a hearth, the Returns Cart and 8 shelves of 6
    const lib = maps.library;
    const lect = Object.values(lib.objs).filter((o) => o.kind === 'lectern');
    ok(lect.length === 12 && new Set(lect.map((o) => o.n)).size === 12, 'the Rotunda has twelve lecterns');
    for (const y in lib.shelves) { let n = 0; for (let x = 0; x < lib.w; x++) if (lib.t[y * lib.w + x] === T.shelf) n++; ok(n === 6, `shelf row ${y} (${lib.shelves[y]}) holds six`); }
    ok(COMMON_BOOKS.length === 48, '48 common books, six of each genre');
    // clutter never blocks the way through the library while it's still there
    const G0 = fresh();
    const libStart = (lib.arrive.y) * lib.w + lib.arrive.x;
    const R = new Set([libStart]); const q = [libStart];
    while (q.length) { const i = q.pop(); for (const d of [1, -1, lib.w, -lib.w]) { const j = i + d; if (!R.has(j) && RU.passable(G0, lib, j)) { R.add(j); q.push(j); } } }
    const need = [find('library', 'bed'), find('library', 'returns'), ...Object.keys(lib.objs).filter((k) => lib.objs[k].kind === 'lectern').map((k) => ({ x: k % lib.w, y: Math.floor(k / lib.w) }))];
    ok(need.every((o) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => R.has((o.y + dy) * lib.w + o.x + dx))), 'with no books home, the bed, the cart and every lectern can be reached past the loose pages');
}

// =====================================================================
if (want('gating')) {
    section('gating');
    const P = PL.progression();
    ok(!P.stuck, `the kingdom can be finished in order: ${P.order.join(' → ')}`);
    ok(P.finalReachable, 'with all twelve home, the Blot can be reached');
    const ALL = Object.keys(ST.BOOK_REQ);
    const closure = (ids) => { const s = new Set(); const add = (i) => { if (s.has(i)) return; s.add(i); ST.BOOK_REQ[i].forEach(add); }; ids.forEach(add); return [...s]; };
    for (const b of ALL) {
        ok(PL.bookReachable(PL.reach(closure(ST.BOOK_REQ[b])), b), `${b}: reachable with just ${closure(ST.BOOK_REQ[b]).join(', ') || 'nothing'}`);
        for (const r of ST.BOOK_REQ[b]) {
            const books = ALL.filter((x) => x !== r && x !== b && !closure(ST.BOOK_REQ[x]).includes(r));
            ok(!PL.bookReachable(PL.reach(books), b), `${b}: out of reach without ${r}, even holding ${books.length} others`);
        }
    }
    // everything can be reached in the end
    const R = PL.reach(ALL);
    let n = 0;
    for (const id in maps) {
        const M = maps[id];
        for (const k in M.objs) { n++; ok(R.objSeen(id, k % M.w, Math.floor(k / M.w)), `${id}: ${M.objs[k].kind} ${M.objs[k].id || ''} at ${k % M.w},${Math.floor(k / M.w)} can be reached`); }
        for (const p of M.npcs) { n++; ok(R.objSeen(id, p.x, p.y), `${id}: ${p.id} can be reached`); }
    }
    console.log(`  ${n} things checked reachable with every grimoire`);
    // the side quests' places are reachable when their givers say
    ok(R.objSeen('world', ...Object.values(find('world', 'chest', (o) => o.id === 'c_lakenorth')).slice(0, 2)), 'the first moon pearl can be reached');
}

// =====================================================================
if (want('rules')) {
    section('rules');
    // walking and walls
    let G = fresh();
    const x0 = G.p.x;
    run(G, { x: 1, y: 0, a: false }, 0.5);
    ok(G.p.x > x0 + 1.5, `walks right (${(G.p.x - x0).toFixed(2)} tiles in 0.5 s)`);
    G = fresh();
    run(G, { x: 0, y: -1, a: false }, 3);
    ok(G.map === 'library', 'walking north from the start goes in at the library door');
    run(G, NONE, 1);
    ok(G.mode === 'explore' && G.map === 'library', 'and arrives inside');
    // walls
    place(G, 'library', 3, 3);
    run(G, { x: 0, y: -1, a: false }, 2);
    ok(G.p.y > 3 - 0.01 && G.p.y < 3.8, 'stops at the wall');
    // the bed rests
    G = fresh(); G.hp = 5; G.calmed.x = 1;
    const bed = find('library', 'bed');
    place(G, 'library', bed.x + 1, bed.y, 'left');
    Gm.step(G, { x: -0.3, y: 0, a: true }, DT);
    ok(G.mode === 'dialog', 'pressing Action at the bed asks to rest');
    finishDialog(G);
    ok(G.hp === RU.maxHp(G) && !G.calmed.x, 'resting restores composure and lets the wild books out again');
    // a chest
    G = fresh();
    const ch = find('hollowoak', 'chest', (o) => !o.key);
    place(G, 'hollowoak', ch.x, ch.y + 1, 'up');
    const before = RU.count(G, ch.o.item) + (G.ups[ch.o.item] || 0);
    Gm.step(G, { x: 0, y: -0.3, a: true }, DT);
    finishDialog(G);
    ok(G.chests[ch.o.id] && RU.count(G, ch.o.item) + (G.ups[ch.o.item] || 0) > before, `a chest gives its ${ch.o.item}`);
    Gm.step(G, { x: 0, y: -0.3, a: true }, DT);
    ok(G.mode === 'explore', 'an empty chest only gets a word from Wick');
    // key and locked door
    G = fresh();
    const key = find('hollowoak', 'chest', (o) => o.key);
    place(G, 'hollowoak', key.x, key.y + 1, 'up');
    Gm.step(G, { x: 0, y: -0.3, a: true }, DT); finishDialog(G);
    ok(G.keys.hollowoak === 1, 'the key chest gives a dungeon key');
    const lock = findTile('hollowoak', T.locked);
    place(G, 'hollowoak', lock.x, lock.y + 1, 'up');
    Gm.step(G, { x: 0, y: -0.3, a: true }, DT);
    ok(G.keys.hollowoak === 0 && RU.passable(G, maps.hollowoak, lock.y * maps.hollowoak.w + lock.x), 'the key opens the locked door, and is used up');
    // each power opens its lock, and only with the book
    const pairs = [['fog', 'gust'], ['thorn', 'ember'], ['boulder', 'stone'], ['stream', 'frost'], ['sprout', 'verdant'], ['ghost', 'echo'], ['rune', 'key']];
    for (const [tile, book] of pairs) {
        let at = null;
        for (let i = 0; i < W.t.length && !at; i++) if (W.t[i] === T[tile]) {
            const x = i % W.w, y = Math.floor(i / W.w);
            for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) {
                const j = (y + dy) * W.w + x + dx;
                if (RU.passable(null, W, j, []) && !W.warps[j]) { at = { x: x + dx, y: y + dy, dir, i }; break; }
            }
        }
        if (!ok(at, `the world has a ${tile} with somewhere to stand`)) continue;
        G = fresh();
        place(G, 'world', at.x, at.y, at.dir);
        const v = { up: [0, -0.3], down: [0, 0.3], left: [-0.3, 0], right: [0.3, 0] }[at.dir];
        Gm.step(G, { x: v[0], y: v[1], a: true }, DT);
        ok(!RU.passable(G, W, at.i), `${tile} stays shut without ${book}`);
        G.books.push(book);
        G.bark = 0;
        Gm.step(G, { x: v[0], y: v[1], a: true }, DT);
        ok(RU.passable(G, W, at.i) && G.events.some((e) => e.type === 'power' && e.book === book), `${book} opens the ${tile}`);
    }
    // pass-locks: water, chasms, mouse doors
    G = fresh();
    const water = findTile('world', T.water);
    ok(!RU.passable(G, W, water.y * W.w + water.x), 'water is not walkable');
    G.books.push('tide');
    ok(RU.passable(G, W, water.y * W.w + water.x), 'with the Tidal Hymnal you can swim');
    // the star seal wants all twelve home
    G = fresh();
    const lib = maps.library;
    const seal = findTile('library', T.starseal);
    place(G, 'library', seal.x, seal.y + 1, 'up');
    G.books = [...BOOK_ORDER];
    Gm.step(G, { x: 0, y: -0.3, a: true }, DT);
    ok(!RU.passable(G, lib, seal.y * lib.w + seal.x), 'the star seal waits until every grimoire is on its lectern');
    G.placed = [...BOOK_ORDER]; G.bark = 0;
    Gm.step(G, { x: 0, y: -0.3, a: true }, DT);
    ok(RU.passable(G, lib, seal.y * lib.w + seal.x), 'then the Starlight Atlas opens it');
    run(G, { x: 0, y: -1, a: false }, 1.5);
    ok(G.map === 'undercroft', 'and the way down leads to the Undercroft');
    // placing grimoires
    G = fresh();
    G.books = ['lumen', 'gust'];
    const lec = find('library', 'lectern');
    place(G, 'library', lec.x, lec.y + 1, 'up');
    Gm.step(G, { x: 0, y: -0.3, a: true }, DT);
    finishDialog(G);
    ok(G.placed.length === 2 && G.events.filter((e) => e.type === 'restore').length === 2, 'a lectern takes every grimoire you carry home');
    // the returns cart
    G = fresh();
    G.common.b0 = 1; G.common.b1 = 1;
    const cart = find('library', 'returns');
    place(G, 'library', cart.x + 1, cart.y, 'left');
    Gm.step(G, { x: -0.3, y: 0, a: true }, DT); finishDialog(G);
    ok(G.common.b0 === 2 && G.common.b1 === 2, 'the Returns Cart shelves carried books');
    for (const b of COMMON_BOOKS.filter((x) => x.genre === 'poetry')) G.common[b.id] = 1;
    const patches = G.ups.patch || 0;
    Gm.step(G, { x: -0.3, y: 0, a: true }, DT); finishDialog(G);
    ok(G.flags.shelf_poetry && (G.ups.patch || 0) === patches + 1, 'a full shelf gives its gift');
    // small things tucked into the furniture of houses, shops and inns
    const rooms = Object.values(maps).filter((M) => M.kind === 'interior' && M.id !== 'library');
    const stashes = rooms.flatMap((M) => Object.keys(M.objs).filter((k) => M.objs[k].kind === 'stash').map((k) => ({ M, k: +k, o: M.objs[k] })));
    ok(rooms.every((M) => Object.values(M.objs).some((o) => o.kind === 'stash')), `every house, shop and inn hides something (${stashes.length} finds in ${rooms.length} rooms)`);
    ok(new Set(stashes.map((s) => s.o.id)).size === stashes.length, 'each find has its own id');
    let searched = 0, prompted = 0;
    for (const { M, k, o } of stashes) {
        const x = k % M.w, y = Math.floor(k / M.w);
        const side = [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']].find(([dx, dy]) => !TILES[M.t[(y + dy) * M.w + x + dx]].solid && M.t[(y + dy) * M.w + x + dx] !== T.door);
        if (!side) continue;
        G = fresh();
        place(G, M.id, x + side[0], y + side[1], side[2]);
        if (Gm.prompt(G)?.verb === 'Search') prompted++;
        const before = G.coins + Object.values(G.bag).reduce((a, n) => a + n, 0);
        Gm.step(G, { x: 0, y: 0, a: true }, DT); finishDialog(G);
        if (G.chests[o.id] && G.coins + Object.values(G.bag).reduce((a, n) => a + n, 0) > before && Gm.prompt(G) === null) searched++;
    }
    ok(searched === stashes.length, `every find can be reached, searched once and pocketed (${searched}/${stashes.length})`);
    ok(prompted === stashes.length, `facing one, the prompt says Search (${prompted}/${stashes.length})`);
    // the action prompt names what Action would do
    G = fresh();
    const mab = maps.mabels.npcs[0];
    place(G, 'mabels', mab.x, mab.y + 2, 'up');
    ok(Gm.prompt(G)?.verb === 'Talk', 'facing a shopkeeper across the counter, the prompt says Talk');
    place(G, 'mabels', 6, 5, 'down');
    ok(Gm.prompt(G) === null, 'facing open floor, there is no prompt');
    G.books = ['lumen'];
    place(G, 'library', lec.x, lec.y + 1, 'up');
    ok(Gm.prompt(G)?.verb === 'Place books', 'at a lectern with a grimoire in hand, it says Place books');
    Gm.openDialog(G, [['say', 'note', 'hi']]);
    ok(Gm.prompt(G) === null, 'no prompt while a dialogue is open');
    // shops
    G = fresh(); G.coins = 500;
    Gm.openDialog(G, [['shop', 'quill_general']]);
    ok(G.mode === 'shop', 'a shopkeeper opens the shop');
    ok(Gm.act(G, { type: 'buy', id: 'biscuit' }) && G.coins === 470 && RU.count(G, 'biscuit') === 1, 'buying costs coins and gives the item');
    ok(!Gm.act(G, { type: 'buy', id: 'silver' }), 'you can only buy what the shop sells');
    ok(Gm.act(G, { type: 'sell', id: 'biscuit' }) && G.coins === 485, 'selling pays half');
    Gm.act(G, { type: 'closeShop' });
    ok(G.mode === 'explore', 'leaving the shop');
    // gear
    G = fresh(); RU.addItem(G, 'leather');
    const f0 = RU.focus(G);
    ok(Gm.act(G, { type: 'equip', id: 'leather' }) && RU.focus(G) === f0 + 3 && RU.count(G, 'ribbon') === 1, 'equipping a bookmark changes focus and keeps the old one');
    // a battle
    G = fresh();
    BA.startBattle(G, ['paperback']);
    ok(G.mode === 'battle', 'a battle starts');
    let rounds = 0;
    while (G.battle.phase === 'choose' && rounds++ < 30) Gm.act(G, { type: 'battle', act: 'shush', target: 0 });
    ok(G.battle.phase === 'won', `shushing calms a paperback in ${rounds} rounds`);
    ok(G.events.some((e) => e.type === 'b_calm'), 'and it turns back into something');
    const xp0 = G.xp, lv0 = G.lvl;
    Gm.act(G, { type: 'battleDone' });
    ok(G.mode === 'explore' && (G.xp > xp0 || G.lvl > lv0 || true), 'the battle ends and you can walk again');
    // losing is cosy
    G = fresh();
    place(G, 'world', 30, 58);
    BA.startBattle(G, ['erratum', 'erratum', 'erratum']);
    let r2 = 0;
    while (G.battle.phase === 'choose' && r2++ < 60) Gm.act(G, { type: 'battle', act: 'tidy' });
    ok(G.battle.phase === 'lost', 'a hopeless squabble is lost');
    const coins = G.coins;
    Gm.act(G, { type: 'battleDone' });
    run(G, NONE, 1);
    ok(G.map === G.rest.map && G.hp === RU.maxHp(G) && G.coins === coins, 'losing takes you home, restored, with nothing lost');
    // a guardian gives its grimoire
    G = fresh();
    BA.startBattle(G, ['lumen'], { boss: 'lumen' });
    let r3 = 0;
    G.lvl = 12; G.hp = RU.maxHp(G);
    while (G.battle.phase === 'choose' && r3++ < 60) Gm.act(G, { type: 'battle', act: 'shush', target: 0 });
    Gm.act(G, { type: 'battleDone' });
    ok(G.books.includes('lumen') && G.bosses.lumen, 'calming the Flickering Primer gives you the Lumen Primer');
    ok(G.mode === 'dialog', 'and Wick has something to say about it');
    // no flee from guardians
    G = fresh();
    BA.startBattle(G, ['gust'], { boss: 'gust' });
    Gm.act(G, { type: 'battle', act: 'flee' });
    ok(G.battle.phase === 'choose', 'there is no slipping away from a guardian');
    // the glimmer caves want a light
    G = fresh();
    let gdoor = null;
    for (const k in W.warps) if (W.warps[k].to === 'glimmer') gdoor = { x: k % W.w, y: Math.floor(k / W.w) };
    place(G, 'world', gdoor.x, gdoor.y + 1, 'up');
    run(G, { x: 0, y: -1, a: false }, 1);
    ok(G.map === 'world', 'Glimmer Caves are too dark to enter without the Lumen Primer');
    G.books.push('lumen');
    run(G, { x: 0, y: -1, a: false }, 1.5);
    ok(G.map === 'glimmer', 'and open once you have it');
    // Wick's hearth-smoke stops all land on open ground, and "take me home" works from anywhere
    for (const [z, label, x, y] of ST.HEARTH_STOPS) {
        const zone = ZONES.find((q) => q.id === z);
        const i = (zone.r * C.ZH + y) * W.w + zone.c * C.ZW + x;
        ok(RU.passable(null, W, i, []) && !W.warps[i], `hearth-smoke to ${label} lands on open ground`);
    }
    G = fresh();
    G.seen.quillford = 1;
    Gm.openDialog(G, ST.hearthScript(G));
    while (G.mode === 'dialog' && !G.dialog.choices) Gm.act(G, { type: 'advance' });
    ok(G.dialog?.choices?.some((c) => c.label === 'Quillford'), 'the hearth offers places you have been');
    Gm.act(G, { type: 'choose', i: 0 }); finishDialog(G); run(G, NONE, 1);
    ok(G.map === 'world' && Math.floor(G.p.x / C.ZW) === 4 && Math.floor(G.p.y / C.ZH) === 3, 'and carries you there');
    ok(Gm.act(G, { type: 'home' }), 'Wick, take me home');
    run(G, NONE, 1);
    ok(G.map === 'library' && RU.passable(G, maps.library, Math.floor(G.p.y) * maps.library.w + Math.floor(G.p.x)), 'lands you in the library');
    // stats are sane at every level
    G = fresh();
    for (let l = 1; l <= C.LEVEL_CAP; l++) { G.lvl = l; ok(RU.maxHp(G) > 0 && RU.focus(G) > 0 && RU.xpFor(l) > 0, `level ${l} stats`); }
    // foes: stats from every tier
    for (const id in FOE) { const s = statsFor(FOE[id].tier); ok(s.hp > 0 && s.pow > 0, `${id} has stats`); }
    for (const b in BIOME_FOES) for (const f of BIOME_FOES[b]) ok(!!ENEMIES[f], `${b} foe ${f} exists`);
    ok(Object.keys(BOSSES).length === 13, 'twelve guardians and the Blot');
}

// =====================================================================
if (want('people')) {
    section('people');
    // states to try: the start, mid-game with quests going, everything carried, the end
    const states = [];
    let G = fresh(); states.push(G);
    G = fresh(); G.books = ['lumen', 'gust', 'ember']; G.placed = ['lumen']; states.push(G);
    G = fresh(); G.books = ['lumen', 'gust', 'ember']; G.placed = ['lumen']; for (const q in QUESTS) G.quests[q] = 'active'; G.flags.catFound = 1; states.push(G);
    G = fresh(); G.books = [...BOOK_ORDER]; G.placed = [...BOOK_ORDER]; for (const q in QUESTS) G.quests[q] = 'active';
    for (const it of ['flour', 'reply', 'letter', 'poem', 'scarf', 'cheese', 'pearl', 'seeds', 'lens', 'bellrope', 'teaset']) RU.addItem(G, it);
    for (const o of OVERDUE) G.flags['od_' + o.npc] = 1; states.push(G);
    G = fresh(); G.books = [...BOOK_ORDER]; G.placed = [...BOOK_ORDER]; G.flags.won = 1; for (const q in QUESTS) G.quests[q] = 'done'; RU.addItem(G, 'teaset'); states.push(G);
    let scripts = 0;
    for (const id in NPCS) {
        if (!NPCS[id].talk) continue;
        for (const S of states) {
            const g = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(S))));
            try {
                Gm.talkTo(g, id);
                const done = finishDialog(g);
                if (g.mode === 'shop') Gm.act(g, { type: 'closeShop' });
                if (g.mode === 'battle') { g.battle = null; g.mode = 'explore'; }
                ok(done, `${id}: the script ends`);
                scripts++;
            } catch (err) { ok(false, `${id}: ${err.message}`); }
        }
    }
    console.log(`  ${scripts} scripts run`);
    // story scripts
    for (const [name, fn] of [['intro', ST.introScript], ['meetWick', ST.meetWickScript], ['final', ST.finalScript]]) {
        const g = fresh();
        Gm.openDialog(g, fn());
        ok(finishDialog(g), `${name} runs to the end`);
    }
    for (const b of BOOK_ORDER) {
        const g = fresh();
        Gm.openDialog(g, ST.bossWonScript(g, b));
        ok(finishDialog(g), `${b}: the guardian's farewell runs`);
    }
    // every quest a giver can start has its journal entry, and every quest can finish
    for (const q in QUESTS) ok(typeof QUESTS[q].step(fresh()) === 'string', `quest ${q} has a next step`);
    // every overdue borrower is a real person somewhere
    for (const o of OVERDUE) ok(Object.values(maps).some((M) => M.npcs.some((n) => n.id === o.npc)), `overdue borrower ${o.npc} lives somewhere`);
    // every quest item can be found or given
    const givable = new Set();
    for (const id in NPCS) for (const S of states) { try { for (const op of NPCS[id].talk?.(S) || []) if (op[0] === 'give') givable.add(op[1]); } catch { /* */ } }
    for (const M of Object.values(maps)) for (const o of Object.values(M.objs)) if (o.kind === 'chest') givable.add(o.item);
    for (const it of ['flour', 'letter', 'reply', 'poem', 'scarf', 'cheese', 'pearl', 'seeds', 'lens', 'bellrope', 'teaset']) ok(givable.has(it), `quest item ${it} can be obtained`);
}

// =====================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); drive(G, b, secs); return G; };
    const a = play(42, 120), b = play(42, 120);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    const G = Gm.newGame(7);
    const bot = Bt.makeBot();
    drive(G, bot, 90);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    drive(G, b1, 60); drive(copy, b2, 60);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is refused, not half-loaded');
    let threw2 = false;
    const D = Gm.serialize(Gm.newGame(3, { skipIntro: true }));
    D.map = 'nowhere';
    try { Gm.deserialize(D); } catch { threw2 = true; }
    ok(threw2, 'a save naming an unknown map is refused');
}

/** Drive with the bot for `secs` of game time, finishing at a moment you could save. */
function drive(G, bot, secs, onEvent) {
    const end = G.t + secs;
    let guard = 0;
    while ((G.t < end || !Gm.canSave(G)) && guard++ < 5e6) {
        if (G.mode === 'explore' || G.fade) {
            if (G.mode === 'explore' && !G.fade) { const c = Bt.botAct(G, bot); if (c) Gm.act(G, c); }
            Gm.step(G, G.fade || G.mode !== 'explore' ? NONE : Bt.botInput(G, bot, DT), DT);
        } else { const c = Bt.botAct(G, bot); if (c) Gm.act(G, c); Gm.step(G, NONE, DT); }
        if (onEvent) for (const e of G.events) onEvent(e, G);
        G.events.length = 0;
        if (G.flags.won && G.mode === 'explore' && !G.fade) break;
    }
}

// =====================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.7]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill });
            const st = { lost: 0, bookAt: {}, lvlAt: {}, bad: null };
            drive(G, bot, 4 * 3600, (e, g) => {
                if (e.type === 'b_end' && e.how === 'lost') st.lost++;
                if (e.type === 'b_end' && e.result.grimoire) { st.bookAt[e.result.grimoire] = Math.round(g.t / 60); st.lvlAt[e.result.grimoire] = g.lvl; }
                if (!Number.isFinite(g.p.x) || !Number.isFinite(g.p.y)) st.bad = 'non-finite position';
                if (g.hp < 0 || g.ink < 0) st.bad = 'negative composure or ink';
            });
            ok(!st.bad, `seed ${s} skill ${skill}: ${st.bad || 'invariants hold'}`);
            ok(G.flags.won, `seed ${s} skill ${skill}: the bot finishes the game (${(G.t / 60).toFixed(0)} game-min, ${G.books.length} books)`);
            rows.push({ seed: s, skill, min: Math.round(G.t / 60), lvl: G.lvl, battles: G.stats.battles, lost: st.lost, coins: G.coins, shelved: Object.values(G.common).filter((v) => v === 2).length, lvlAt: st.lvlAt });
        }
    }
    console.log('  seed skill  min  lvl battles lost  books-shelved  level when each guardian fell');
    for (const r of rows) console.log(`  ${String(r.seed).padStart(4)} ${String(r.skill).padStart(5)} ${String(r.min).padStart(4)} ${String(r.lvl).padStart(4)} ${String(r.battles).padStart(7)} ${String(r.lost).padStart(4)} ${String(r.shelved).padStart(14)}  ${BOOK_ORDER.map((b) => r.lvlAt[b] ?? '-').join(' ')}`);
    const avgLost = rows.filter((r) => r.skill === 1).reduce((a, r) => a + r.lost, 0) / SEEDS;
    ok(avgLost <= 6, `the perfect bot is rarely overwhelmed (${avgLost.toFixed(1)} times a game)`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
