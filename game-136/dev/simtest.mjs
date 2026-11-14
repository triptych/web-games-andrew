/**
 * simtest.mjs — headless checks of Pinch & Place's simulation. No browser.
 *
 *   node game-136/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-136/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-136/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. catalog: every kind and every room is well formed (footprints, costs, goals that name real things).
 * 3. rules: crafting and clay, placing on the floor, rugs, things on top of surfaces, the walls,
 *    the doorway, rotating, stowing (riders come too), squishing, undo, progress and unlocks.
 * 4. goals: every goal type, set up by hand, is met and then unmet.
 * 5. determinism: same seed and commands → same game; a save round trip plays on identically;
 *    a share link rebuilds the same room.
 * 6. bot: the perfect bot earns three stars in every room on SEEDS seeds; a sloppy bot earns
 *    fewer; after every command nothing overlaps and the clay is never negative. Balance table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 4);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Rm = await import('../js/sim/room.js');
const Rt = await import('../js/sim/rate.js');
const Sh = await import('../js/sim/share.js');
const Cat = await import('../js/sim/data/catalog.js');
const Lv = await import('../js/sim/data/levels.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const R = (kind, size = 0, colors = null, motif = 0, variant = 0) => ({ kind, size, variant, motif, colors: colors || Cat.KINDS[kind].colors.slice() });
/** A game in a room with every room unlocked. */
const room = (id, seed = 1) => {
    const G = Gm.newGame(seed);
    for (const l of Lv.LEVELS) G.progress[l.id] = { stars: 1, score: 50 };
    Gm.act(G, { t: 'level', id });
    G.events.length = 0;
    return G;
};
const craft = (G, ...a) => Gm.act(G, { t: 'craft', recipe: R(...a) }).id;
const place = (G, id, spec) => Gm.act(G, { t: 'place', id, ...spec });
const at = (G, id) => G.items.find((i) => i.id === id)?.at;

/** No two floor things share a tile, no two rugs, no two riders, no two wall things; every top has its host. */
function invariants(G) {
    const seen = { floor: new Set(), rug: new Set(), top: new Set(), wall: new Set() };
    for (const it of G.items) {
        if (!it.at) continue;
        if (it.at.layer === 'wall') {
            const [w, h] = Cat.KINDS[it.kind].fp[it.size];
            for (let i = 0; i < w; i++) for (let v = 0; v < h; v++) {
                const k = `${it.at.wall}:${it.at.u + i}:${it.at.v + v}`;
                if (seen.wall.has(k)) return `wall cell ${k} twice`;
                seen.wall.add(k);
            }
            continue;
        }
        if (it.at.layer === 'top') {
            const host = G.items.find((h) => h.id === it.at.on);
            if (!host?.at || !Cat.KINDS[host.kind].surface) return `rider ${it.id} has no host`;
            if (!Rm.tilesOf(host).some(([x, y]) => x === it.at.x && y === it.at.y)) return `rider ${it.id} off its host`;
        }
        for (const [x, y] of Rm.tilesOf(it)) {
            if (!Rm.inRoom(G, x, y)) return `${it.kind} outside the room`;
            const k = x + ',' + y;
            const set = seen[it.at.layer];
            if (set.has(k)) return `${it.at.layer} tile ${k} twice`;
            set.add(k);
        }
    }
    if (G.clay < 0 || !Number.isFinite(G.clay)) return 'clay went negative';
    return null;
}

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|\bbtoa\b|\batob\b/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|photo|share-link)/.test(src) && !/from '\.\.\/\.\.\/(view|ui|audio|input|save|main|photo)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('catalog')) {
    section('catalog');
    for (const [id, K] of Object.entries(Cat.KINDS)) {
        ok(K.fp.length === 3 && K.cost.length === 3 && K.h.length === 3, `${id}: three sizes`);
        ok(Cat.validRecipe(Cat.defaultRecipe(id)), `${id}: the default recipe is valid`);
        ok(K.cost.every((c, i) => c >= 1 && (i === 0 || c >= K.cost[i - 1])), `${id}: bigger never costs less`);
        if (K.layer === 'small') ok(K.fp.every(([w, d]) => w === 1 && d === 1), `${id}: small things are one tile`);
        ok(K.colors.every((c) => Cat.COLOR[c]), `${id}: default colours are in the palette`);
    }
    for (const L of Lv.ALL_LEVELS) {
        const G = room(L.id);
        const [dx, dy] = Rm.doorTile(G);
        ok(Rm.inRoom(G, dx, dy) && !Rm.isBlocked(G, dx, dy), `${L.id}: the door opens onto a free tile`);
        ok(L.windows.every((w) => w.u >= 0 && w.u + w.w <= Rm.wallLength(G, w.wall)), `${L.id}: windows fit their walls`);
        const kinds = (o) => !o || !o.kind || Cat.KINDS[o.kind];
        const tags = new Set(Object.values(Cat.KINDS).flatMap((k) => k.tags));
        const real = (o) => kinds(o) && (!o?.tag || tags.has(o.tag));
        ok(L.goals.every((g) => real(g.of) && real(g.a) && real(g.b)), `${L.id}: every goal names real things`);
        ok(L.goals.filter((g) => g.req).length >= (L.studio ? 0 : 2), `${L.id}: at least two required goals`);
        ok(L.goals.every((g) => g.text && g.text.length < 48), `${L.id}: goal texts are short enough for the card`);
    }
    ok(new Set(Lv.ALL_LEVELS.map((l) => l.id)).size === Lv.ALL_LEVELS.length, 'room ids are unique');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    let G = room('pip');
    ok(Gm.shelf(G).length === 1 && Gm.shelf(G)[0].gift, 'the first room starts with a gift bed on the shelf');
    const clay0 = G.clay;
    const lamp = craft(G, 'floorlamp', 1);
    ok(lamp && G.clay === clay0 - Cat.costOf('floorlamp', 1), 'crafting costs its clay');
    ok(G.events.some((e) => e.type === 'craft'), 'and emits a craft event');
    G.clay = 1;
    ok(!Gm.act(G, { t: 'craft', recipe: R('sofa', 2) }).ok, 'no crafting without enough clay');
    ok(G.events.some((e) => e.type === 'nope' && e.why === 'clay'), 'and says why');
    ok(!Gm.act(G, { t: 'craft', recipe: { kind: 'sofa', size: 7, variant: 0, colors: ['tomato', 'teal'] } }).ok, 'a bad recipe is refused');
    ok(!Gm.act(G, { t: 'craft', recipe: { kind: 'sofa', size: 0, variant: 0, colors: ['tomato', 'mauve'] } }).ok, 'an unknown colour is refused');

    G = room('pip');
    const bed = Gm.shelf(G)[0].id;
    ok(place(G, bed, { x: 4, y: 4, rot: 0 }).ok === false, 'a bed hanging out of the room is refused');
    ok(place(G, bed, { x: 1, y: 1, rot: 0 }).ok, 'a bed fits in the middle');
    ok(G.events.some((e) => e.type === 'place'), 'and emits a place event');
    const l2 = craft(G, 'floorlamp');
    ok(!place(G, l2, { x: 1, y: 2, rot: 0 }).ok, 'nothing stands where the bed is');
    const [dx, dy] = Rm.doorTile(G);
    ok(!place(G, l2, { x: dx, y: dy, rot: 0 }).ok, 'nothing stands in the doorway');
    const rug = craft(G, 'rug', 0);
    ok(place(G, rug, { x: dx, y: dy - 1, rot: 0 }).ok, 'a rug may lie in the doorway');
    const rug2 = craft(G, 'rug', 0);
    ok(!place(G, rug2, { x: dx, y: dy - 1, rot: 0 }).ok, 'rugs don\'t overlap');
    ok(place(G, rug2, { x: 3, y: 0, rot: 0 }).ok, 'a rug can lie under furniture');
    ok(place(G, l2, { x: 3, y: 0, rot: 0 }).ok, 'and furniture stands on a rug');

    G = room('juno');
    ok(!place(G, craft(G, 'chair'), { x: 3, y: 3, rot: 0 }).ok, 'a blocked tile takes nothing');
    const desk = craft(G, 'desk', 0);
    ok(place(G, desk, { x: 1, y: 0, rot: 0 }).ok, 'a desk against the wall');
    const tl = craft(G, 'tablelamp');
    ok(place(G, tl, { x: 2, y: 0, rot: 0 }).ok && at(G, tl).layer === 'top' && at(G, tl).on === desk, 'a small thing pointed at a surface goes on top of it');
    const tl2 = craft(G, 'plant');
    ok(!place(G, tl2, { x: 2, y: 0, rot: 0 }).ok, 'one thing per tile of a surface');
    ok(place(G, tl2, { x: 1, y: 0, rot: 0 }).ok && at(G, tl2).layer === 'top', 'the other tile of the desk takes another');
    const toy = craft(G, 'toy');
    ok(place(G, toy, { x: 4, y: 4, rot: 0 }).ok && at(G, toy).layer === 'floor', 'a small thing on bare floor stands on the floor');
    const chair = craft(G, 'chair');
    ok(place(G, chair, { x: 1, y: 1, rot: 0 }).ok, 'a chair');
    const tl3 = craft(G, 'tablelamp');
    ok(!place(G, tl3, { x: 1, y: 1, rot: 0 }).ok, 'a chair is not a surface');
    ok(Gm.act(G, { t: 'rotate', id: desk }).ok, 'the desk turns');
    ok(!invariants(G), `turning keeps the room consistent (${invariants(G)})`);
    const ridersAfterTurn = [tl, tl2].filter((id) => at(G, id)?.layer === 'top').length;
    ok(ridersAfterTurn >= 1 && ridersAfterTurn <= 2, 'riders the turned desk still covers stay on it');
    Gm.act(G, { t: 'stow', id: desk });
    ok(!at(G, desk) && !at(G, tl) && !at(G, tl2), 'stowing the desk brings everything on it back to the shelf');
    ok(G.events.filter((e) => e.type === 'stow' && e.rider).length >= 1, 'with a stow event for each rider');

    G = room('mo');
    const pic = craft(G, 'picture', 1);
    ok(!place(G, pic, { wall: 'R', u: 2, v: 1 }).ok, 'pictures don\'t cover the window');
    ok(!place(G, pic, { wall: 'L', u: 4, v: 0 }).ok, 'or the door');
    ok(place(G, pic, { wall: 'L', u: 0, v: 2 }).ok, 'a picture hangs on a free wall');
    ok(!Gm.act(G, { t: 'rotate', id: pic }).ok, 'wall things don\'t turn');
    const clock = craft(G, 'clock');
    ok(!place(G, clock, { wall: 'L', u: 1, v: 2 }).ok, 'wall things don\'t overlap');
    ok(place(G, clock, { wall: 'L', u: 9, v: 9 }).ok && at(G, clock).u === G.w - 1 && at(G, clock).v === C.WALL_ROWS - 1, 'a spot past the wall\'s end is clamped onto it');

    G = room('pip');
    const before = G.clay;
    const sq = craft(G, 'sofa', 0);
    ok(Gm.act(G, { t: 'squish', id: sq }).ok && G.clay === before, 'squishing gives all the clay back');
    const gift = Gm.shelf(G).find((i) => i.gift).id;
    Gm.act(G, { t: 'squish', id: gift });
    ok(G.clay === before, 'a squished gift gives nothing (it was free)');
    Gm.act(G, { t: 'undo' });
    ok(Gm.shelf(G).some((i) => i.id === gift), 'undo brings it back');
    const n = G.items.length;
    Gm.act(G, { t: 'undo' }); Gm.act(G, { t: 'undo' });
    ok(G.items.length === n && G.clay === before && !G.items.some((i) => i.kind === 'sofa'), 'undo goes back step by step');
    ok(!Gm.act(G, { t: 'undo' }).ok, 'and stops at the start of the room');

    G = room('pip');
    for (let i = 0; i < C.SHELF_MAX; i++) G.items.push({ id: G.nextId++, kind: 'toy', size: 0, variant: 0, motif: 0, colors: ['tomato', 'teal'], lump: 1, gift: true, at: null });
    G.clay = 99;
    ok(!Gm.act(G, { t: 'craft', recipe: R('toy') }).ok, 'the shelf has room for only so much');

    G = Gm.newGame(3);
    ok(Gm.unlocked(G, 'pip') && !Gm.unlocked(G, 'mo') && Gm.unlocked(G, 'studio'), 'the first room and the studio are open; the rest are locked');
    ok(!Gm.act(G, { t: 'level', id: 'mo' }).ok, 'a locked room can\'t be opened');
    Gm.act(G, { t: 'finish' });
    ok(G.result.stars === 0 && !Gm.unlocked(G, 'mo'), 'finishing an empty room earns nothing');
    Bt.botPlayRoom(G);
    ok(G.progress.pip.stars === 3 && Gm.unlocked(G, 'mo'), 'three stars open the next room');
    Gm.act(G, { t: 'clear' });
    Gm.act(G, { t: 'finish' });
    ok(G.progress.pip.stars === 3, 'a worse try never lowers the best');
    Gm.act(G, { t: 'level', id: 'studio' });
    ok(G.clay === Lv.STUDIO.clay && !G.items.length, 'the studio opens empty with its big lump');
    Gm.act(G, { t: 'finish' });
    ok(!G.progress.studio, 'the studio keeps no record');
}

// ======================================================================
if (want('goals')) {
    section('goals');
    const goal = (G, text) => Rt.evaluate(G).goals.find((g) => g.text === text);
    let G = room('mo');
    const arm = craft(G, 'armchair'), lamp = craft(G, 'floorlamp'), shelfId = craft(G, 'bookshelf', 0), plant = craft(G, 'plant');
    place(G, arm, { x: 3, y: 3, rot: 0 });
    place(G, lamp, { x: 0, y: 5, rot: 0 });
    ok(!goal(G, 'A lamp right by the armchair').ok, 'near: a lamp across the room isn\'t by the chair');
    place(G, lamp, { x: 4, y: 4, rot: 0 });
    ok(goal(G, 'A lamp right by the armchair').ok, 'near: a lamp on the next tile is (diagonals count)');
    place(G, shelfId, { x: 2, y: 2, rot: 0 });
    ok(!goal(G, 'A bookshelf against a wall').ok, 'against: a bookshelf in the middle isn\'t');
    place(G, shelfId, { x: 0, y: 2, rot: 0 });
    ok(goal(G, 'A bookshelf against a wall').ok, 'against: one touching the back wall is');
    place(G, plant, { x: 4, y: 0, rot: 0 });
    ok(!goal(G, 'A plant by the window').ok, 'window: a plant on the far wall\'s side isn\'t by the window');
    place(G, plant, { x: 0, y: 3, rot: 0 });
    ok(goal(G, 'A plant by the window').ok, 'window: a plant under it is');

    G = room('twins');
    const rug = craft(G, 'rug', 2), t1 = craft(G, 'toy'), t2 = craft(G, 'toy');
    place(G, rug, { x: 1, y: 1, rot: 0 });
    place(G, t1, { x: 2, y: 2, rot: 0 }); place(G, t2, { x: 5, y: 5, rot: 0 });
    ok(goal(G, 'Two toys out on the rug').have === 1, 'onrug: counts only things on the rug');
    place(G, t2, { x: 3, y: 3, rot: 0 });
    ok(goal(G, 'Two toys out on the rug').ok, 'onrug: two on it meets it');
    const cols = new Set(G.items.filter((i) => i.at).flatMap((i) => i.colors)).size;
    ok(goal(G, 'Five different colours').have === cols, 'colors: counts every colour used, both slots');
    const tbl = craft(G, 'nightstand'), t3 = craft(G, 'toy');
    place(G, tbl, { x: 5, y: 0, rot: 0 }); place(G, t3, { x: 5, y: 0, rot: 0 });
    ok(goal(G, 'A toy up on a shelf or table').ok, 'on: a toy on a nightstand counts as on a surface');
    // walk: wall the door tile in with things
    G = room('pip');
    const [dx, dy] = Rm.doorTile(G);   // (0, 3)
    const a = craft(G, 'chair'), b = craft(G, 'chair'), c = craft(G, 'chair');
    place(G, a, { x: 0, y: 2, rot: 0 }); place(G, b, { x: 1, y: 3, rot: 0 }); place(G, c, { x: 0, y: 4, rot: 0 });
    ok(Rm.walk(G).reached.size === 1 && goal(G, 'Pip can reach everything from the door').ok, 'walk: things around the door are reachable from it');
    const d = craft(G, 'chair');
    place(G, d, { x: 3, y: 3, rot: 0 });
    ok(!goal(G, 'Pip can reach everything from the door').ok, 'walk: a chair the door can\'t get to fails it');
    ok(Rm.walk(G).stuck.includes(d), 'and names the stuck chair');

    G = room('biscuit');
    ok(goal(G, 'Cosiness 70 or more').have === 0, 'cosy: an empty room is not cosy');
    for (const k of ['sofa', 'rug', 'floorlamp', 'floorlamp']) craft(G, k, 0);
    let x = 0;
    for (const it of Gm.shelf(G)) { place(G, it.id, { x, y: 0, rot: 0 }); x += Rm.footprint(it)[0]; }
    const cz = goal(G, 'Cosiness 70 or more').have;
    ok(cz === C.COSY.soft + C.COSY.rug + 2 * (C.COSY.light + C.COSY.warmLight), `cosy: sofa + rug + two warm lamps = ${cz}`);
    const r = Rt.evaluate(G);
    ok(r.stars === 0 && !r.reqOk, 'stars: a room missing a required goal earns none');
    ok(r.score >= 0 && r.score <= 100 && Object.values(r.style).every((v) => v >= 0 && v <= 100), 'every score is 0–100');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = room('fern', seed); Bt.botPlayRoom(G); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same room');

    const G = room('cabin', 7);
    const bot = Bt.makeBot();
    for (let i = 0; i < 8; i++) Gm.act(G, Bt.botNext(G, bot));
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    Bt.botPlayRoom(G); Bt.botPlayRoom(copy);
    void b1; void b2;
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-room plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ ...Gm.serialize(G), level: 'atlantis' }); } catch { threw = true; }
    ok(threw, 'an unknown room is rejected');

    // share links
    for (const id of ['twins', 'juno', 'cabin']) {
        const H = room(id, 3);
        Bt.botPlayRoom(H);
        const packed = JSON.parse(JSON.stringify(Sh.pack(H, 'hello')));
        const u = Sh.unpack(packed);
        const sig = (g) => g.items.filter((i) => i.at).map((i) => `${i.kind}/${i.size}/${i.colors}/${i.at.layer}/${i.at.x ?? i.at.u}/${i.at.y ?? i.at.v}/${i.at.rot ?? i.at.wall}`).sort().join('|');
        ok(u && u.dropped === 0 && sig(u.G) === sig(H), `${id}: a share link rebuilds the same diorama`);
        ok(u.G.visit.caption === 'hello', `${id}: with its caption`);
        ok(Rt.evaluate(u.G).score === Rt.evaluate(H).score, `${id}: and the same rating`);
        ok(JSON.stringify(packed).length < 1600, `${id}: in ${JSON.stringify(packed).length} bytes`);
    }
    ok(Sh.unpack({ v: 1, l: 'nowhere', it: [] }) === null, 'a link to an unknown room is refused');
    const bad = Sh.unpack({ v: 1, l: 'pip', it: [[0, 0, 0, 0, 0, 0, 0, 1, 9, 9, 0], [99, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], 'x'] });
    ok(bad && bad.dropped === 3 && bad.G.items.length === 0, 'things that don\'t fit or don\'t exist are dropped, not trusted');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const L of Lv.LEVELS) {
        for (let s = 1; s <= SEEDS; s++) {
            for (const skill of [1, 0.5]) {
                const G = room(L.id, s * 7919);
                const bot = Bt.makeBot({ skill, seed: s });
                let bad = null, cmd, n = 0;
                while ((cmd = Bt.botNext(G, bot)) && n++ < 400) {
                    Gm.act(G, cmd);
                    G.events.length = 0;
                    bad = invariants(G);
                    if (bad) break;
                }
                ok(!bad, `${L.id} seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
                ok(G.result, `${L.id} seed ${s} skill ${skill}: the bot finished the room`);
                rows.push({ room: L.id, seed: s, skill, stars: G.result?.stars || 0, score: G.result?.score || 0, clay: G.clay });
            }
        }
        const perfect = rows.filter((r) => r.room === L.id && r.skill === 1);
        ok(perfect.every((r) => r.stars === 3), `${L.id}: three stars are reachable on every seed (${perfect.map((r) => r.score).join(', ')})`);
    }
    const avg = (k, f) => rows.filter((r) => r.skill === k).reduce((a, r) => a + r[f], 0) / rows.filter((r) => r.skill === k).length;
    ok(avg(1, 'stars') > avg(0.5, 'stars'), 'a careful decorator earns more stars than a sloppy one');
    console.log('\n  room      perfect (stars score clay)   sloppy (stars score)');
    for (const L of Lv.LEVELS) {
        const p = rows.filter((r) => r.room === L.id && r.skill === 1), q = rows.filter((r) => r.room === L.id && r.skill < 1);
        const m = (a, f) => (a.reduce((x, r) => x + r[f], 0) / a.length).toFixed(1);
        console.log(`  ${L.id.padEnd(9)} ${m(p, 'stars')}  ${m(p, 'score')}  ${m(p, 'clay').padStart(5)}  of ${String(L.clay).padStart(2)}        ${m(q, 'stars')}  ${m(q, 'score')}`);
    }
    console.log(`  average stars: perfect ${avg(1, 'stars').toFixed(2)}, sloppy ${avg(0.5, 'stars').toFixed(2)}`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
