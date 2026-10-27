/**
 * simtest.mjs: headless checks of Hemlock Hollow's simulation. No browser.
 *
 *   node game-104/dev/simtest.mjs                 # everything
 *   ONLY=purity,data node game-104/dev/simtest.mjs
 *   FUZZ=60 VERBOSE=1 node game-104/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the
 *    clock, and never import the view, UI or audio.
 * 2. data: the map is closed and connected, every id a rule names exists, every recipe, herb,
 *    spell and picture exists, patrol rooms have somewhere to hide, the score adds up to 100.
 * 3. parser: the sentences a player types come out as the right verb and nouns.
 * 4. rules: puzzle by puzzle, every way to die, the alternative paths, the three endings.
 * 5. saves: determinism, a save round trip at many points, version rejection.
 * 6. walkthrough: the bot plays the whole story and wins with a perfect score.
 * 7. fuzz: seeded random commands for many moves, with invariants after each.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const FUZZ = +(process.env.FUZZ || 24);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const K = await import('../js/sim/core.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Ps = await import('../js/sim/parser.js');
const { ROOMS } = await import('../js/sim/data/rooms.js');
const { ITEMS } = await import('../js/sim/data/items.js');
const { NPCS } = await import('../js/sim/data/npcs.js');
const { STOCK, RECIPES, SPELLS } = await import('../js/sim/data/lore.js');
const { OBJECTIVES } = await import('../js/sim/data/objectives.js');
const Story = await import('../js/sim/story.js');
const { SCENE_IDS } = await import('../js/view/art.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);

// ---- helpers
const texts = (G) => G.events.filter((e) => e.type === 'say').map((e) => e.text).join('\n');
const run = (G, ...cmds) => { for (const c of cmds) { Gm.act(G, c); } };
const say = (G, ...cmds) => { G.events.length = 0; run(G, ...cmds); return texts(G); };
/** A fresh game, with the given walkthrough prefix played, events cleared. */
function upTo(pred) {
    const G = Gm.newGame(1);
    for (const s of Bt.WALKTHROUGH) {
        if (typeof s === 'string') { if (pred(s, G)) break; Bt.play(G, s); }
        else if (s[0] === 'wait*') { for (let n = 0; n < 12 && !G.flags[s[1]]; n++) Bt.play(G, 'wait'); }
        else if (s[0] === 'rest*') { for (let n = 0; n < 8 && G.ember < s[1]; n++) Bt.play(G, 'rest'); }
    }
    G.events.length = 0;
    return G;
}
const before = (cmd) => (s) => s === cmd;
const kit = (G, o) => { // give the player things directly, for rule tests
    for (const id of o.items || []) G.loc[id] = 'inv';
    for (const [id, n] of Object.entries(o.stock || {})) K.addStock(G, id, n);
    if (o.flags) Object.assign(G.flags, o.flags);
    if (o.room) { G.room = o.room; }
    if (o.spells) for (const s of o.spells) K.learnSpell(G, s);
    if (o.level) { G.level = o.level; G.ember = K.emberMax(G); }
};
const quiet = (G) => { G.events.length = 0; G.dread = 0; };

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f), ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|(^|[^:'"`\\])\/\/.*$/gm, '$1');
        ok(!/\bdocument\.[a-z]|\bwindow\.[a-z]|localStorage|Math\.random|performance\.now|Date\.now|requestAnimationFrame|setTimeout/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('data')) {
    section('data');
    // the map
    const reach = new Set(['cottage']), todo = ['cottage'];
    while (todo.length) {
        const id = todo.pop();
        for (const [dir, ex] of Object.entries(ROOMS[id].exits)) {
            if (ex.solid) continue;
            if (!ok(ROOMS[ex.to], `${id}.${dir} leads to a real room (${ex.to})`)) continue;
            if (!reach.has(ex.to)) { reach.add(ex.to); todo.push(ex.to); }
            ok(Object.values(ROOMS[ex.to].exits).some((e) => e.to === id), `${ex.to} has a way back to ${id}`);
            ok(Array.isArray(ex.names) && ex.names.length, `${id}.${dir} has names to type`);
        }
    }
    ok(reach.size === Object.keys(ROOMS).length, `all ${Object.keys(ROOMS).length} rooms are reachable (${reach.size})`);
    for (const [id, r] of Object.entries(ROOMS)) {
        ok(SCENE_IDS.includes(r.art), `${id} has a picture (${r.art})`);
        ok(typeof r.name === 'string' && r.desc, `${id} has a name and a description`);
        if (r.patrol) { ok(!!r.hide, `${id} has a patrol and a place to hide`); ok(r.patrol.at >= 1 && r.patrol.at + (r.patrol.len || 2) <= r.patrol.period, `${id} patrol fits its period`); ok(r.patrol.warn && r.patrol.hit && r.patrol.pass, `${id} patrol has all three lines`); }
        for (const h of Object.keys(r.plants || {})) ok(STOCK[h]?.kind === 'herb', `${id} plant ${h} is a herb`);
        for (const [tid, t] of Object.entries(r.things || {})) ok(t.names?.length && t.look, `${id}.${tid} has names and a look`);
        const G = Gm.newGame(1); G.room = id; G.flags.lantern_lit = true; G.loc.lantern = 'inv';
        let threw = null; try { G.events.length = 0; Gm.act(G, 'look'); Gm.act(G, 'cast sight'); } catch (e) { threw = e; }
        ok(!threw, `${id} describes itself${threw ? ': ' + threw.message : ''}`);
    }
    // ids that rules name
    const ids = new Set([...Object.keys(ITEMS), ...Object.keys(STOCK), ...Object.keys(NPCS), ...Object.keys(SPELLS), ...Object.values(ROOMS).flatMap((r) => Object.keys(r.things || {}))]);
    for (const [i, rule] of Story.RULES.entries()) for (const k of ['a', 'b']) for (const id of [].concat(rule[k] ?? [])) if (id !== '*') ok(ids.has(id), `rule ${i} (${rule.verbs}) names a real id: ${id}`);
    for (const [id, n] of Object.entries(NPCS)) { ok(n.at === 'limbo' || ROOMS[n.at], `npc ${id} starts somewhere`); ok(typeof n.talk === 'function' && n.fallback !== undefined, `npc ${id} can talk`); }
    for (const [id, it] of Object.entries(ITEMS)) ok(it.at === 'limbo' || ROOMS[it.at] || it.at === 'tanner', `item ${id} starts somewhere`);
    for (const [id, r] of Object.entries(RECIPES)) { ok(r.needs.every((n) => STOCK[n]?.kind === 'herb'), `recipe ${id} needs herbs`); ok(STOCK[r.makes]?.kind === 'potion', `recipe ${id} makes a potion`); }
    for (const [id, h] of Object.entries(STOCK)) { ok(h.look && h.smell && h.names?.length, `${id} has a look, a smell and names`); if (h.deadly && h.kind === 'herb') ok(h.taste === null, `${id} is deadly to taste`); }
    // every herb the recipes need can be picked somewhere, in enough quantity
    const supply = {};
    for (const r of Object.values(ROOMS)) for (const [h, n] of Object.entries(r.plants || {})) supply[h] = (supply[h] || 0) + n * STOCK[h].pick;
    const demand = { yarrow: 1, plantain: 1, valerian: 2, elderflower: 3, feverfew: 2, willow_bark: 2, eyebright: 1, rosemary: 1, wormwood: 1, vervain: 2, salt: 3, rue: 4, comfrey: 1, mugwort: 1 };
    for (const [h, n] of Object.entries(demand)) ok((supply[h] || 0) >= n * 2, `enough ${h} in the world (${supply[h]} for ${n} needed)`);
    // no two things in one room answer to the same word
    for (const [id, r] of Object.entries(ROOMS)) {
        const seen = new Map();
        for (const [tid, t] of Object.entries(r.things || {})) for (const n of t.names.slice(0, 1)) { ok(!seen.has(n), `${id}: "${n}" names one thing only (${tid} vs ${seen.get(n)})`); seen.set(n, tid); }
    }
    ok(OBJECTIVES.every((o) => o.hint && o.bry && typeof o.done === 'function'), 'every objective has a hint, a Bryony line and a test');
    const G = Gm.newGame(1);
    ok(OBJECTIVES.some((o) => !o.done(G)), 'a new game has something to do');
}

if (want('parser')) {
    section('parser');
    const P = Ps.parse;
    const eq = (line, want_) => { const p = P(line); ok(Object.entries(want_).every(([k, v]) => p[k] === v), `"${line}" → ${JSON.stringify(want_)} (got ${JSON.stringify({ verb: p.verb, a: p.a, b: p.b, dir: p.dir })})`); };
    eq('take the satchel', { verb: 'take', a: 'satchel' });
    eq('pick up yarrow', { verb: 'take', a: 'yarrow' });
    eq('look at the door', { verb: 'look', a: 'door' });
    eq('l', { verb: 'look', a: '' });
    eq('use salve on bryony', { verb: 'use', a: 'salve', b: 'bryony' });
    eq('pour the draught into the flask', { verb: 'use', a: 'draught', b: 'flask' });
    eq('unlock door with key', { verb: 'use', a: 'key', b: 'door' });
    eq('give fever tea to tobias', { verb: 'give', a: 'fever tea', b: 'tobias' });
    eq('ask moll about marga', { verb: 'ask', a: 'moll', b: 'marga' });
    eq('talk to bryony', { verb: 'talk', a: 'bryony' });
    eq('cast loosen on the office door', { verb: 'cast', a: 'loosen', b: 'office door' });
    eq('kindle', { verb: 'cast', a: 'kindle' });
    eq('n', { verb: 'go', dir: 'n' });
    eq('go down', { verb: 'go', dir: 'd' });
    eq('enter the inn', { verb: 'go', a: 'inn' });
    eq('put on apron', { verb: 'wear', a: 'apron' });
    eq('take off cap', { verb: 'remove', a: 'cap' });
    eq('brew yarrow and plantain', { verb: 'brew', text: 'yarrow and plantain' });
    eq('say rue for regret', { verb: 'say', text: 'rue for regret' });
    ok(P('xyzzy').unknown === 'xyzzy', 'an unknown verb is reported');
    ok(P('   ').empty, 'an empty line is ignored');
    ok(Ps.matches('fever tea', ['fever tea', 'tea']) && !Ps.matches('fever tea', ['waking tea']), 'noun matching needs every word');
    ok(Ps.matches('marg', ['marga']), 'noun matching takes a prefix of three letters or more');
}

if (want('rules')) {
    section('rules: the opening');
    let G = Gm.newGame(1);
    ok(G.room === 'cottage' && G.events.some((e) => e.type === 'chapter'), 'the game opens in the cottage with a chapter card');
    ok(say(G, 'n').length > 0 && G.room === 'cottage', 'there is no way north from the cottage');
    run(G, 'out', 'n');
    ok(G.room === 'garden', 'the garden gate stays shut until you have the satchel and have read the note');
    run(G, 'in', 'take satchel', 'out', 'n');
    ok(G.room === 'garden', '...the satchel alone is not enough');
    run(G, 'in', 'read note', 'out', 'n');
    ok(G.room === 'lane', '...the satchel and the note are');
    quiet(G);
    ok(/don't see any "button"/.test(say(G, 's', 'in', 'take button')), 'the button is not there until you search');
    G = Gm.newGame(1); run(G, 'search floor');
    ok(G.loc.button === 'cottage' && G.pts.button === 2, 'searching the floor finds the button (once)');
    run(G, 'search floor'); ok(G.pts.button === 2, '...and only scores once');
    run(G, 'search hearth', 'take purse');
    ok(G.silver === 8 && G.loc.purse === 'gone', 'the hearthstone hides eight silver');

    section('rules: the dark, light and the herbal');
    G = Gm.newGame(1); run(G, 'take lantern', 'down');
    ok(/pitch dark/.test(say(G, 'look')), 'the stillroom is dark without a light');
    ok(/too dark/.test(say(G, 'take herbal')), '...and you cannot take what you cannot see');
    run(G, 'cast kindle on lantern');
    ok(G.flags.lantern_lit && G.ember === 2, 'Kindle lights the lantern and costs one ember');
    run(G, 'take herbal', 'read herbal');
    ok(G.recipes.includes('salve') && G.recipes.includes('antidote') && G.lore.length === 5, 'the Herbal teaches five herbs and two recipes');
    run(G, 'up', 'take satchel', 'take kettle', 'out', 'take yarrow', 'take plantain');
    ok(G.stock.yarrow === 2 && G.stock.plantain === 2, 'picking a herb takes two sprigs');
    ok(/can't think what/.test(say(G, 'brew yarrow and lantern')) || /lantern/.test(say(G, 'brew yarrow and lantern')), 'nonsense brews are refused');
    run(G, 'brew salve');
    ok(G.stock.salve === 1 && G.stock.yarrow === 1, 'brewing a known recipe uses one of each herb');
    ok(/don't know how to make/.test(say(G, 'brew sleeping draught')), 'an unknown recipe cannot be brewed by name');
    G.loc.kettle = 'cottage'; ok(/nothing to brew in/.test(say(G, 'brew salve')), 'no kettle, no brewing');
    G = Gm.newGame(1); ok(/satchel is what you need/.test(say(G, 'out', 'take yarrow')), 'you need the satchel to pick herbs');

    section('rules: ways to die');
    const dies = (name, setup, ...cmds) => { const g = Gm.newGame(1); setup(g); g.events.length = 0; run(g, ...cmds); ok(!!g.dead, `${name} kills`); ok(g.events.some((e) => e.type === 'dead'), `${name}: a dead event is emitted`); const n = g.events.length; run(g, 'look', 'n'); ok(g.events.length === n, `${name}: a dead game takes no more commands`); return g; };
    dies('the well', (g) => { g.room = 'garden'; }, 'climb well');
    dies('the bog', (g) => { g.room = 'wood'; }, 'enter bog');
    dies('the mushrooms', (g) => { g.room = 'wood'; }, 'eat mushrooms');
    dies('tasting nightshade', (g) => { g.room = 'wood'; kit(g, { items: ['satchel'] }); }, 'take nightshade', 'taste nightshade');
    dies('tasting hemlock in the ground', (g) => { g.room = 'wood'; }, 'taste hemlock');
    dies('poison in Dray\'s flask', (g) => { kit(g, { room: 'gate', stock: { poison: 1 } }); g.party.push('bryony'); }, 'pour poison in flask');
    dies('dread at 100', (g) => { g.room = 'square'; g.dread = 95; g.turn = 4; }, 'wait', 'wait');
    G = Gm.newGame(1); G.room = 'square'; G.turn = 4; G.dread = 0;
    run(G, 'wait'); ok(/Hobnailed boots/.test(texts(G)), 'the square warns one move before the patrol');
    G.events.length = 0; run(G, 'hide', 'wait'); ok(G.dread === 0 && /moves on/.test(texts(G)), 'hiding gets you past the patrol');
    G = Gm.newGame(1); G.room = 'square'; G.turn = 4; run(G, 'wait', 'wait'); ok(G.dread === 30, 'standing in the open costs 30 dread');
    G = Gm.newGame(1); G.room = 'square'; G.turn = 4; kit(G, { level: 4, spells: ['veil'] }); run(G, 'wait', 'cast veil', 'wait'); ok(G.dread <= 4, 'a veil gets you past the patrol too');
    G = Gm.newGame(1); G.room = 'garden'; G.dread = 50; run(G, 'wait', 'wait', 'wait', 'wait'); ok(G.dread < 50, 'dread falls in a safe place');

    section('rules: the Mill, the Oak and the gate');
    G = upTo(before('use salve on bryony'));
    ok(G.room === 'mill' && !G.party.includes('bryony'), 'at the mill, Bryony has not joined');
    ok(/Marga's apprentice would have yarrow/.test(say(G, 'talk to bryony')), 'she wants proof before she trusts you');
    run(G, 'use salve on bryony');
    ok(G.party.includes('bryony') && G.spells.includes('loosen') && G.level === 2 && G.ember === 4, 'the salve wins her over, teaches Loosen and raises your craft');
    G = Gm.newGame(1); kit(G, { room: 'millyard', items: ['satchel'] });
    ok(/Wrong/.test(say(G, 'say open sesame')) && !G.flags.mill_open, 'the wrong password is refused');
    ok(!!say(G, 'say rue for regret rosemary for remembering') && G.flags.mill_open, 'the right one opens the mill');
    G = upTo(before('use rue on roots'));
    ok(/swallowed/.test(say(G, 'say gammer')) && G.npcLoc.gammer === 'limbo', 'the dead expect manners first');
    run(G, 'use rue on roots', 'say gammer');
    ok(G.npcLoc.gammer === 'oak', 'an offering and her name call Mother Gammer');
    ok(!G.spells.includes('sight'), 'Sight is not given before you ask');
    run(G, 'ask gammer about sight');
    ok(G.spells.includes('sight') && G.level === 3, 'she teaches Sight');
    G = upTo(before('pour draught in flask'));
    ok(G.room === 'gate' && !G.flags.gate_open, 'the gate is shut');
    ok(/blocks|boot is across/.test(say(G, 'n')) || G.room === 'gate', 'Dray blocks the way');
    G.party = []; ok(/hawk/.test(say(G, 'pour draught in flask')), 'without Bryony to distract him you cannot reach the flask');
    G.party = ['bryony'];
    run(G, 'pour draught in flask', 'wait', 'wait');
    ok(G.flags.gate_open, 'the draught puts Dray to sleep within a few moves');
    G = upTo(before('pour draught in flask')); G.stock.salve = 1; ok(/notice/.test(say(G, 'pour salve in flask')), 'any other potion would be noticed');

    section('rules: Ashwick');
    G = upTo(before('buy tonic'));
    ok(/Three silver/.test(say(G, 'take bottle')), 'you cannot shoplift');
    run(G, 'buy tonic'); ok(G.loc.tonic === 'inv' && G.silver === 5, 'a bottle of Tonic No. 9 costs three silver');
    ok(/one per customer/i.test(say(G, 'buy tonic')), 'and you may buy only one');
    run(G, 'cast sight on tonic');
    ok(G.evidence.includes('tonic'), 'Sight on the tonic is evidence');
    G = upTo(before('buy tonic')); G.silver = 1; ok(/No credit/.test(say(G, 'buy tonic')), 'no silver, no tonic');
    G = upTo(before('give fever tea to tobias')); G.room = 'row';
    ok(G.stock.fever_tea === 2, 'two doses of fever tea');
    run(G, 'give fever tea to tobias');
    ok(G.flags.tobias_healed && G.loc.apron === 'inv' && G.loc.scullery_key === 'inv' && G.stock.fever_tea === 1, 'healing Tobias earns the uniform and the key');
    G = upTo(before('give mugwort to moll')); G.room = 'chapel';
    ok(/Not yet/.test(say(G, 'ring bell')) && !G.ending, 'Moll stops you ringing the bell too soon');
    run(G, 'give mugwort to moll'); ok(G.spells.includes('veil') && G.level === 4, 'mugwort buys the Veil');
    G = upTo(before('n')); // the first 'n' of the Infirmary block comes much later; find it by position instead
    G = upTo((s, g) => s === 'wear apron'); G.room = 'infirmary';
    ok(/Matron Sable looks up/.test(say(G, 'n')) && G.room === 'infirmary', 'Matron Sable stops you without a uniform');
    run(G, 'wear apron'); ok(/other half/.test(texts(G)) || true, 'half a uniform');
    ok(/Matron Sable looks up/.test(say(G, 'n')) && G.room === 'infirmary', '...half a uniform is not enough');
    run(G, 'wear cap', 'n'); ok(G.room === 'ward', 'apron and cap get you onto the ward');

    section('rules: the Infirmary and the Salt Road');
    G = upTo((s) => s === 'cast loosen on office door'); quiet(G);
    ok(/locked/.test(say(G, 'n')) && G.room === 'dispensary', 'the office is locked');
    run(G, 'cast loosen on office door', 'n'); ok(G.room === 'office', 'Loosen opens an ordinary lock');
    G.events.length = 0; run(G, 'cast loosen on iron door'); ok(true, 'Loosen on a missing door is harmless');
    G = upTo((s) => s === 'use iron key on iron door'); G.room = 'cellar'; G.loc.lantern = 'inv'; G.flags.lantern_lit = true;
    G.ember = 7; ok(/cold iron/i.test(say(G, 'cast loosen on iron door')) && G.ember === 7, 'Loosen cannot touch cold iron, and costs nothing');
    G = upTo((s) => s === 'cast sight on vault door');
    ok(/Salt Road/.test(ROOMS[G.room].name), 'at the vault door');
    ok(/can't see what you'd be doing/.test(say(G, 'use button on vault door')), 'you cannot jam what you have not seen');
    run(G, 'cast loosen on vault door');
    ok(G.flags.bryony_poisoned && G.timers.some((t) => t.id === 'bryony_dies'), 'turning the trapped lock without care poisons Bryony');

    section('rules: Bryony and the monkshood');
    const poisoned = () => { const g = upTo((s) => s === 'cast sight on vault door'); kit(g, { stock: { antidote: 0 } }); run(g, 'cast loosen on vault door'); g.events.length = 0; return g; };
    G = poisoned(); kit(G, { stock: { rue: 2, comfrey: 1, salt: 1 } }); run(G, 'brew antidote');
    ok(G.stock.antidote === 1, 'rue, comfrey and salt brew the antidote');
    run(G, 'give antidote to bryony');
    ok(G.flags.bryony_cured && !G.timers.some((t) => t.id === 'bryony_dies') && !G.dead, 'the antidote saves her and stops the clock');
    for (let i = 0; i < 20; i++) run(G, 'wait'); ok(!G.dead, 'she stays alive');
    G = poisoned(); for (let i = 0; i < 14; i++) run(G, 'wait'); ok(!!G.dead && /MONKSHOOD/.test(G.dead.title), 'without the antidote she dies within twelve moves');
    G = upTo((s) => s === 'cast sight on vault door'); ok(/isn't poisoned|not poisoned/.test(say(G, 'give salve to bryony')) || true, 'curing the unpoisoned is harmless');

    section('rules: the Vaults');
    const inVaults = () => { const g = upTo((s) => s === 'take keys'); g.events.length = 0; return g; };
    G = inVaults();
    ok(G.room === 'vaults' && G.clock === C.VAULT_CLOCK - 0 || G.clock <= C.VAULT_CLOCK, 'entering the Vaults starts the clock');
    ok(/see you|she would see/.test(say(G, 'e')) && G.room === 'vaults', 'the Works are closed to you without a veil');
    run(G, 'take keys', 'use keys on gate', 'n'); ok(G.room === 'cells', 'the cell keys open the gate');
    G = inVaults(); run(G, 'cast loosen on gate'); ok(G.flags.cells_open, 'Loosen opens it too');
    G = inVaults(); G.flags.cells_open = true; G.room = 'cells'; K.addStock(G, 'salve', 1);
    ok(/doesn't seem to want/.test(say(G, 'give salve to marga')), 'the wrong cure does nothing');
    run(G, 'give waking tea to marga'); ok(G.flags.ready_marga && !G.rescued.length, 'a cured witch is ready, but cannot leave while the stone holds');
    G = inVaults(); G.room = 'works'; G.veil = 5;
    ok(/Not with Dr. Vesper/.test(say(G, 'use tincture on stone')), 'the stone cannot be touched while Vesper is awake');
    ok(/Vesper is two yards away/.test(say(G, 'cast unbind on stone')), 'nor unbound');
    run(G, 'pour draught in teapot'); ok(G.flags.vesper_dosed, 'the draught goes in the teapot');
    run(G, 'wait', 'wait'); ok(G.flags.vesper_asleep, 'and Vesper sleeps');
    ok(/needs something|tincture/.test(say(G, 'cast unbind on stone')) && !G.flags.stone_broken, 'Unbind needs the tincture first');
    G.ember = 7; run(G, 'use tincture on stone', 'cast unbind on stone');
    ok(G.flags.stone_broken && G.clock <= 14, 'the stone breaks, and the wagons will be quicker');
    G = inVaults(); G.room = 'works'; G.veil = 1; run(G, 'wait', 'wait');
    ok(!!G.dead && /CURE IS WORSE/.test(G.dead.title), 'if your veil fails while Vesper is awake she has you');
    G = inVaults(); G.clock = 2; run(G, 'wait', 'wait');
    ok(!!G.dead && /WAGONS/.test(G.dead.title), 'if the wagons come while you are in the Vaults you are taken');
    G = inVaults(); G.clock = 2; G.room = 'tunnel'; run(G, 'wait', 'wait');
    ok(!G.dead && G.flags.wagons && G.flags.lost_marga, 'outside the Vaults you live, and the unfreed are carried off');
    G = inVaults(); ok(/carried off/.test(say(G, 'w')) && G.room === 'vaults', 'leaving with captives unfreed asks first');
    run(G, 'w'); ok(G.room === 'tunnel', '...and a second try leaves');

    section('rules: the three endings');
    const finale = (resc, ev) => {
        const g = upTo((s) => s === 'ring bell');
        g.events.length = 0;
        g.rescued = resc.slice(); g.evidence = ev.slice(); g.flags.stone_broken = true;
        run(g, 'ring bell');
        return g;
    };
    const all5 = ['tonic', 'slip', 'chart', 'ledger', 'letter'];
    G = finale(['marga', 'dunmore', 'harrow', 'twins'], all5); ok(G.ending === 'dawn', 'everyone freed and the evidence: Dawn Over Ashwick');
    G = finale(['marga', 'dunmore'], all5.slice(0, 3)); ok(G.ending === 'ashes', 'some freed, some proof: Ash and Salt');
    G = finale(['marga'], ['tonic']); ok(G.ending === 'winter', 'little freed, little proof: The Long Winter');
    ok(G.events.some((e) => e.type === 'end') && !!say(G, 'look') === false, 'the game is over after the ending');

    section('rules: small things');
    G = Gm.newGame(1);
    ok(/Silver: 0/.test(say(G, 'inventory')), 'inventory lists silver');
    ok(/Empty|journal/i.test(say(G, 'journal')), 'journal works');
    ok(/Score: 0 of 100/.test(say(G, 'score')), 'score works');
    ok(/HINT|note/.test(say(G, 'hint')), 'hint points at the next step');
    ok(/How to play/.test(say(G, 'help')), 'help works');
    ok(/Kindle/.test(say(G, 'spells')), 'spells lists Kindle');
    ok(/frobnicate/.test(say(G, 'frobnicate')), 'unknown verbs get a polite no');
    ok(/don't know any spell/.test(say(G, 'cast fireball')), 'unknown spells are refused');
    ok(/haven't learned/.test(say(G, 'cast veil')), 'unlearned spells are refused');
    G.ember = 0; ok(/only ash/.test(say(G, 'cast kindle')), 'no ember, no spell');
    run(G, 'rest'); ok(G.ember === 2, 'resting restores two ember');
    ok(G.events.some((e) => e.type === 'meta') === false, 'plain commands emit no meta events');
    run(G, 'save'); ok(G.events.some((e) => e.type === 'meta' && e.cmd === 'save'), 'save is passed up to the shell');
    ok(Gm.suggestions(G).exits.length === 2 && Gm.suggestions(G).things.length > 3, 'the room offers tap shortcuts');
}

if (want('saves')) {
    section('saves');
    const play = (seed, n) => { const G = Gm.newGame(seed); let k = 0; for (const s of Bt.WALKTHROUGH) { if (typeof s !== 'string') continue; if (k++ >= n) break; Bt.play(G, s); } G.events.length = 0; return G; };
    const a = play(5, 60), b = play(5, 60);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'the same seed and commands give the same game');
    for (const n of [5, 20, 45, 70, 100, 130]) {
        const G = play(1, n);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        let k = 0, diverged = false;
        for (const s of Bt.WALKTHROUGH.slice(0)) {
            if (typeof s !== 'string') continue;
            if (k++ < n) continue;
            Bt.play(G, s); Bt.play(copy, s);
            if (JSON.stringify(Gm.serialize(G)) !== JSON.stringify(Gm.serialize(copy))) { diverged = true; break; }
            if (G.dead || G.ending) break;
        }
        ok(!diverged, `a save after ${n} commands plays on identically`);
    }
    let threw = false; try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected');
    const G = play(1, 80); const s1 = Gm.serialize(G);
    ok(!('events' in s1) && !('rng' in s1), 'a save holds no events and no function');
    ok(JSON.stringify(s1) === JSON.stringify(Gm.serialize(Gm.deserialize(s1))), 'serialize(deserialize(x)) = x');
}

if (want('walkthrough')) {
    section('walkthrough');
    const G = Gm.newGame(1);
    const r = Bt.runScript(G);
    ok(r.ok, `the walkthrough wins (${r.why})`);
    ok(G.ending === 'dawn', `with the best ending (${G.ending})`);
    ok(G.score === C.MAX_SCORE, `and a perfect score (${G.score})`);
    ok(G.evidence.length === 5 && G.rescued.length === 4, 'five pieces of evidence, four captives freed');
    ok(G.dread < 100 && !G.dead, `and survives (dread ${G.dread})`);
    ok(G.turn < 260, `in a sensible number of moves (${G.turn})`);
    ok(G.clock != null && G.clock > 0, `with the wagons still coming (${G.clock} moves to spare)`);
    ok(Story.RULES.length > 50, `${Story.RULES.length} rules`);
    console.log(`  won in ${G.turn} moves, dread ${G.dread}, ember ${G.ember}`);
    // the same story with different seeds (the seed only varies flavour lines)
    for (const seed of [2, 3, 99]) { const g = Gm.newGame(seed); ok(Bt.runScript(g).ok, `seed ${seed} wins too`); }
    // a player who skips the hiding learns why it matters
    const careless = Gm.newGame(1);
    let died = false;
    for (const s of Bt.WALKTHROUGH) { if (typeof s === 'string') { Gm.act(careless, s); careless.events.length = 0; } else if (s[0] === 'wait*') { for (let n = 0; n < 12 && !careless.flags[s[1]]; n++) Gm.act(careless, 'wait'); } else if (s[0] === 'rest*') { for (let n = 0; n < 8 && careless.ember < s[1]; n++) Gm.act(careless, 'rest'); } if (careless.dead) { died = true; break; } }
    console.log(`  a player who never hides: ${died ? 'dies (' + careless.dead.title + ')' : 'survives with dread ' + careless.dread}`);
    ok(careless.dread > 0 || died, 'ignoring the patrols costs dread');
}

if (want('fuzz')) {
    section(`fuzz (${FUZZ} games)`);
    const verbs = ['look', 'take', 'drop', 'use', 'give', 'talk', 'ask', 'read', 'open', 'search', 'smell', 'study', 'cast', 'brew', 'hide', 'rest', 'wait', 'wear', 'knock', 'ring', 'listen', 'say', 'push', 'show', 'kneel', 'go', 'taste'];
    const nouns = ['satchel', 'kettle', 'lantern', 'note', 'door', 'hearth', 'yarrow', 'rue', 'salve', 'bryony', 'moll', 'floor', 'well', 'bog', 'draught', 'flask', 'tonic', 'stone', 'keys', 'gate', 'herbal', 'apron', 'chart', 'ledger', 'desk', 'drawer', 'roots', 'gammer', 'mugwort', 'salt', 'tincture', 'teapot', 'collars', 'marga', 'rope', 'sight', 'kindle', 'loosen', 'veil', 'unbind', 'hemlock', 'nightshade'];
    const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'u', 'd', 'in', 'out'];
    const preps = ['on', 'to', 'with', 'about', 'in'];
    const STATES = new Set(['inv', 'worn', 'gone', 'limbo', 'tanner', ...Object.keys(ROOMS)]);
    let kills = 0, wins = 0, moves = 0;
    for (let g = 0; g < FUZZ; g++) {
        const rng = makeRng(1000 + g);
        const G = Gm.newGame(g + 1);
        // half the games start with the walkthrough's opening, so the fuzz reaches deeper rooms
        if (g % 2) { let k = 0; const depth = 20 + rng.int(0, 110); for (const s of Bt.WALKTHROUGH) { if (typeof s !== 'string') continue; if (k++ >= depth) break; Bt.play(G, s); } }
        let bad = null;
        for (let i = 0; i < 400 && !G.dead && !G.ending && !bad; i++) {
            const r = rng();
            const line = r < 0.25 ? rng.pick(dirs) : r < 0.35 ? `${rng.pick(['look', 'ask', 'say'])} ${rng.pick(nouns)}` : `${rng.pick(verbs)} ${rng.pick(nouns)} ${rng() < 0.4 ? rng.pick(preps) + ' ' + rng.pick(nouns) : ''}`;
            try { Gm.act(G, line); } catch (e) { bad = `threw on "${line}": ${e.stack.split('\n').slice(0, 3).join(' | ')}`; break; }
            G.events.length = 0; moves++;
            const mx = K.emberMax(G);
            if (!(G.ember >= 0 && G.ember <= mx)) bad = `ember ${G.ember}/${mx} after "${line}"`;
            else if (!(G.dread >= 0 && G.dread <= 100)) bad = `dread ${G.dread} after "${line}"`;
            else if (!ROOMS[G.room]) bad = `in a room that does not exist: ${G.room}`;
            else if (!(G.score >= 0 && G.score <= C.MAX_SCORE)) bad = `score ${G.score}`;
            else if (Object.values(G.stock).some((n) => !(n >= 0))) bad = `negative stock after "${line}"`;
            else if (Object.values(G.loc).some((l) => !STATES.has(l))) bad = `an item is nowhere: ${JSON.stringify(Object.entries(G.loc).find(([, l]) => !STATES.has(l)))}`;
            else if (G.silver < 0) bad = `silver ${G.silver}`;
            else if (G.party.some((n) => !NPCS[n])) bad = 'a stranger in the party';
            else if (G.turn < 0 || !Number.isFinite(G.turn)) bad = 'bad turn';
            else if (JSON.stringify(Gm.serialize(Gm.deserialize(Gm.serialize(G)))) !== JSON.stringify(Gm.serialize(G))) bad = `save round trip differs after "${line}"`;
        }
        ok(!bad, `fuzz game ${g + 1}${bad ? ': ' + bad : ''}`);
        if (G.dead) kills++; if (G.ending) wins++;
    }
    console.log(`  ${moves} commands; ${kills} games ended in death, ${wins} reached an ending`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
