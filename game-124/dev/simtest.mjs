/**
 * simtest.mjs — headless checks of Wrack & Wonder's simulation. No browser.
 *
 *   node game-124/dev/simtest.mjs                 # everything
 *   ONLY=purity,laws,rules node game-124/dev/simtest.mjs
 *   SEEDS=12 VERBOSE=1 node game-124/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, UI, audio or input. The bot never
 *    mentions the hidden laws: it plays from the notebook.
 * 2. laws: every seed makes a complete, consistent rule set (nine distinct glyphs, a perfect
 *    opposition matching, every phase used, the shore carries the lintel's three words, every
 *    essence has a reagent) and different seeds make different rules.
 * 3. gates: on foot, with no magic, the islet, the fen, the moor plateau, the moat's far side and
 *    the castle are unreachable; each gate, once opened, opens its way.
 * 4. rules: word order, feeding, doubling, discord, unweaving, power and waxing; each puzzle's
 *    reactions (cage, ice, vents, stones, thorns, door, heart); instruments and the notebook;
 *    survival (cold, food, fire, collapse); saving.
 * 5. determinism: the same seed and bot give the same game; a save round trip plays on identically.
 * 6. bot: a researching bot frees Elowen on SEEDS seeds; prints days, casts and experiments.
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
const Gm = await import('../js/sim/game.js');
const Lw = await import('../js/sim/laws.js');
const Wd = await import('../js/sim/world.js');
const Nv = await import('../js/sim/nav.js');
const Mg = await import('../js/sim/magic.js');
const Bt = await import('../js/sim/bot.js');
const St = await import('../js/sim/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const IDLE = { mx: 0, my: 0, dyaw: 0, dpitch: 0 };
const msgs = (G) => G.events.filter((e) => e.type === 'msg').map((e) => e.text).join(' | ');

/** A game with every glyph known, the Focus in hand and the laws' own reagents in the bag. */
function lab(seed) {
    const G = Gm.newGame(seed);
    const L = G.laws;
    G.hasWand = true; G.flags.hutKnown = true;
    G.glyphs = L.glyphs.map((g) => g.id);
    for (const r in L.reagents) G.bag[r] = 9;
    return G;
}
const R = (G, e, strong = false) => Object.keys(G.laws.reagents).filter((r) => G.laws.reagents[r].essence === e).sort((a, b) => (strong ? -1 : 1) * (G.laws.reagents[a].potency - G.laws.reagents[b].potency))[0];
function write(G, form, ess, { order = G.laws.order, feed = null, strong = false } = {}) {
    const L = G.laws;
    const s = L.glyphOf[form];
    const words = ess.map((e) => L.glyphOf[e]);
    const fd = feed || ess.map((e) => R(G, e, strong));
    const sp = order === 'shape-first' ? { glyphs: [s, ...words], feed: [null, ...fd] } : { glyphs: [...words, s], feed: [...fd, null] };
    return sp;
}
function castAt(G, form, ess, opts = {}) {
    const r = Gm.act(G, { t: 'inscribe', slot: 0, ...write(G, form, ess, opts), n: 1 });
    if (!r.ok) return { res: null, why: r.text };
    G.sel = 0;
    return Gm.act(G, { t: 'cast' });
}
function stand(G, x, z, yawTo = null) {
    const W = Wd.getWorld(G.seed);
    G.p.x = x; G.p.z = z; G.p.y = W.height(x, z); G.p.vx = G.p.vz = G.p.vy = 0; G.p.ground = true;
    if (yawTo) {
        const ey = G.p.y + C.PLAYER.eye - 0.1;
        G.p.yaw = Math.atan2(yawTo.x - x, -(yawTo.z - z));
        G.p.pitch = Math.atan2(yawTo.y - ey, Math.hypot(yawTo.x - x, yawTo.z - z));
    }
}

// =================================================================== purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    const bot = fs.readFileSync(path.join(ROOT, 'js/sim/bot.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    ok(!/laws|genLaws|glyphOf/.test(bot), 'the bot never reads the hidden laws');
    console.log(`  ${files.length} files checked`);
}

// =================================================================== laws
if (want('laws')) {
    section('laws');
    const sigs = new Set();
    let bad = 0;
    for (let s = 1; s <= 60; s++) {
        const L = Lw.genLaws(s);
        const names = new Set(L.glyphs.map((g) => g.name));
        const strokes = new Set(L.glyphs.map((g) => JSON.stringify(g.strokes)));
        const e = C.ESSENCES;
        const problems = [];
        if (L.glyphs.length !== 9 || names.size !== 9 || strokes.size !== 9) problems.push('glyphs');
        if (!e.every((x) => L.opp[x] && L.opp[x] !== x && L.opp[L.opp[x]] === x)) problems.push('opposition');
        if (!C.PHASES.every((p) => Object.values(L.wax).includes(p.id))) problems.push('phases');
        const shoreEss = Object.keys(L.reagents).filter((r) => ['seaglass', 'kelp', 'cowrie'].includes(r)).map((r) => L.reagents[r].essence).sort().join();
        if (shoreEss !== 'kindle,lumen,rime') problems.push('shore');
        if (!e.every((x) => Object.values(L.reagents).some((r) => r.essence === x))) problems.push('every essence fed');
        if (L.opp[L.elowen[0]] !== L.elowen[1]) problems.push('elowen pair');
        if (!L.lintel.every((g) => ['kindle', 'lumen', 'rime', 'bolt', 'ward', 'seal'].includes(L.glyphs.find((x) => x.id === g).essence || L.glyphs.find((x) => x.id === g).form))) problems.push('lintel');
        if (problems.length) { bad++; console.log('   seed', s, problems.join(', ')); }
        sigs.add(JSON.stringify([L.order, L.glyphOf, L.opp, L.wax, Object.values(L.reagents)]));
    }
    ok(bad === 0, 'every seed makes a complete, consistent set of laws');
    ok(sigs.size === 60, `different seeds make different laws (${sigs.size}/60 distinct)`);
    const L1 = Lw.genLaws(1), L1b = Lw.genLaws(1);
    ok(JSON.stringify(L1) === JSON.stringify(L1b), 'the same seed makes the same laws');
    // knowledge doesn't transfer: the glyph that means Kindle in one seed looks different in the next
    const k = (L) => JSON.stringify(L.glyphs.find((g) => g.essence === 'kindle').strokes);
    let same = 0;
    for (let s = 2; s <= 30; s++) if (k(Lw.genLaws(s)) === k(L1)) same++;
    ok(same === 0, 'a glyph learned in one life means nothing in the next');
}

// =================================================================== gates
if (want('gates')) {
    section('gates');
    const N = Wd.NODES, S = Wd.SITES;
    for (const seed of [1, 2, 3, 7, 11]) {
        const G = Gm.newGame(seed);
        const r = Nv.reachable(G, S.start.x, S.start.z);
        const yes = ['beach', 'hutin', 'cross', 'wood', 'cage', 'mereE', 'moorbase', 'gorge', 'south'];
        const no = ['islet', 'moortop', 'herald', 'fenin', 'bellows', 'causeway', 'moatN', 'gate', 'court', 'keepin'];
        ok(yes.every((k) => r(...N[k])), `seed ${seed}: the open island is reachable on foot`);
        const leak = no.filter((k) => r(...N[k]));
        ok(!leak.length, `seed ${seed}: without magic, nothing gated is reachable${leak.length ? ' (leaked: ' + leak + ')' : ''}`);
    }
    const G = Gm.newGame(5);
    G.flags.iceWall = true;
    ok(Nv.reachable(G, S.start.x, S.start.z)(...N.causeway), 'melting the frozen falls opens the fen');
    G.flags.bridge = true;
    ok(Nv.reachable(G, S.start.x, S.start.z)(S.mere.x + 2.5, S.mere.z), 'the vine bridge reaches the islet');
    G.flags.gate = true; G.flags.door = true;
    const inside = Nv.reachable(G, 0, 20);
    ok(inside(...N.keepin) && !inside(...N.cross), 'inside the moat the gate and door lead to the keep, and no further out');
}

// =================================================================== rules
if (want('rules')) {
    section('rules: the grammar');
    for (const seed of [3, 4]) {
        const G = lab(seed), L = G.laws;
        const ph = 'day';
        const wrongOrder = L.order === 'shape-first' ? 'essence-first' : 'shape-first';
        ok(Mg.evaluate(L, write(G, 'ward', ['kindle'], { order: wrongOrder }), ph).fail === 'tangle', `seed ${seed}: the shape at the wrong end tangles`);
        const wrongFeed = R(G, L.opp.kindle);
        ok(Mg.evaluate(L, write(G, 'ward', ['kindle'], { feed: [wrongFeed] }), ph).fail === 'starve', `seed ${seed}: the wrong reagent starves a word`);
        ok(Mg.evaluate(L, { glyphs: [L.glyphOf.kindle], feed: [R(G, 'kindle')] }, ph).fail === 'noshape', `seed ${seed}: a word with no shape scatters`);
        ok(Mg.evaluate(L, { glyphs: [L.glyphOf.bolt, L.glyphOf.ward], feed: [] }, ph).fail === 'twoshapes', `seed ${seed}: two shapes knot`);
        const ok1 = Mg.evaluate(L, write(G, 'bolt', ['rime']), L.wax.rime === 'dawn' ? 'day' : 'dawn');
        ok(ok1.form === 'bolt' && ok1.essence === 'rime' && ok1.power === L.reagents[R(G, 'rime')].potency, `seed ${seed}: a fed word in the right order works, power = potency`);
        const w = Mg.evaluate(L, write(G, 'bolt', ['rime']), L.wax.rime);
        ok(w.power === ok1.power + 1, `seed ${seed}: a word at its waxing hour is one stronger`);
        const dbl = Mg.evaluate(L, write(G, 'seal', ['bloom', 'bloom']), 'x');
        ok(dbl.essence === 'bloom' && dbl.power >= 2, `seed ${seed}: the same word twice is stronger`);
        const notOpp = C.ESSENCES.find((e) => e !== 'gale' && L.opp.gale !== e);
        ok(Mg.evaluate(L, write(G, 'bolt', ['gale', notOpp]), 'x').fail === 'discord', `seed ${seed}: two unrelated words grind`);
        const un = Mg.evaluate(L, write(G, 'bolt', ['gale', L.opp.gale]), 'x');
        ok(un.essence === 'unweave', `seed ${seed}: two opposed words unweave`);
    }

    section('rules: puzzles');
    {
        const G = lab(8), S = Wd.SITES, W = Wd.getWorld(8);
        // Nib's cage: Lumen flinches, Kindle frees
        stand(G, S.cage.x + 6, S.cage.z, { x: S.cage.x, y: W.height(S.cage.x, S.cage.z) + 0.8, z: S.cage.z });
        castAt(G, 'bolt', ['lumen']);
        ok(G.nib.mode === 'caged', 'light does not open the thorn cage');
        castAt(G, 'bolt', ['kindle']);
        ok(G.nib.mode === 'freed', 'fire opens the thorn cage');
        G.events.length = 0;
        Gm.step(G, IDLE, DT);
        ok(G.dialog?.id === 'rescue', 'freeing Nib starts his rescue scene');
        while (G.dialog) Gm.act(G, { t: 'say', choice: 0 });
        ok(G.nib.mode === 'follow', 'after the scene Nib follows you');

        // the frozen falls want Kindle at strength 2
        const gx = S.fen.x - S.fen.r - 3.5;
        const ice = { x: gx, y: W.height(gx, S.fen.z) + 3, z: S.fen.z };
        stand(G, gx - 9, S.fen.z, ice);
        const phNow = Gm.currentGoal && (G.laws.wax.kindle === 'day' ? 0.55 : 0.3);
        G.tod = phNow;
        castAt(G, 'bolt', ['kindle']);
        ok(!G.flags.iceWall || G.laws.reagents[R(G, 'kindle')].potency >= 2, 'a weak warm word does not melt the falls');
        castAt(G, 'bolt', ['kindle', 'kindle']);
        ok(G.flags.iceWall, 'the warm word twice melts the falls');

        // stones: the wrong word is ignored, the right one weak only stirs, strong wakes it
        stand(G, S.mere.x, S.mere.z + 16, { x: S.mere.x, y: W.height(S.mere.x, S.mere.z) + 1.6, z: S.mere.z });
        castAt(G, 'bolt', ['gale', 'gale']);
        ok(!G.flags.stoneWood, 'a stone ignores a word that is not its own');
        castAt(G, 'bolt', ['bloom', 'bloom']);
        ok(G.flags.stoneWood, 'its own word, strongly, wakes the Whisperwood stone');

        // the seedbed grows the bridge from a seal
        stand(G, S.seedbed.x + 2.4, S.seedbed.z); G.p.yaw = -Math.PI / 2;
        castAt(G, 'seal', ['bloom']);
        Gm.step(G, IDLE, DT);
        ok(G.flags.bridge, 'a green seal by the seedbed grows the vine bridge');

        // vents: Gale clears for a while, strong Rime plugs for good
        const v0 = Mg.ventPos(0);
        stand(G, v0.x - 4, v0.z, { x: v0.x, y: Wd.FEN_FLOOR + 1.6, z: v0.z });
        castAt(G, 'bolt', ['gale']);
        ok(!Mg.ventActive(G, 0), 'a gale bolt clears a steam vent');
        castAt(G, 'bolt', ['rime', 'rime']);
        ok(G.vents[0].plugged, 'the cold word twice plugs a vent for good');

        // the thornwall: fire regrows, unweaving at the road opens it
        stand(G, 0, 72, { x: 0, y: 9, z: S.thorn.r });
        castAt(G, 'bolt', ['kindle']);
        ok(!G.flags.thornGap, 'burning the thorns does not hold');
        castAt(G, 'bolt', ['gale', G.laws.opp.gale]);
        ok(G.flags.thornGap, 'two opposed words thrown at the thorns open the way');

        // the moat: frost-walk carries you; without it you can't walk on
        stand(G, 0, 62.5); G.p.yaw = 0;
        for (let i = 0; i < 300; i++) Gm.step(G, { ...IDLE, my: 1 }, DT);
        ok(G.p.z > 59, 'without a cold ward the black moat stops you');
        castAt(G, 'ward', ['rime']);
        for (let i = 0; i < 600; i++) Gm.step(G, { ...IDLE, my: 1 }, DT);
        ok(G.p.z < 49 && G.flags.crossedMoat, 'wearing the cold word you walk across the moat');

        // the gate opens on three stones
        G.flags.stoneFen = G.flags.stoneMoor = true;
        Gm.step(G, IDLE, DT);
        ok(G.flags.gate, 'three woken stones open the castle gate');

        // the door shows itself to light
        G.p.x = 0; G.p.z = 6; G.p.y = Wd.HILLTOP;
        castAt(G, 'ward', ['lumen']);
        Gm.step(G, IDLE, DT);
        ok(G.flags.door, 'a light ward by the blank wall reveals the keep door');

        // the gallery by updraft
        G.p.x = 0; G.p.z = 1.2; G.p.y = Wd.HILLTOP; G.p.yaw = 0; G.p.pitch = 0;
        castAt(G, 'seal', ['gale']);
        let top = 0;
        for (let i = 0; i < 120 * 8; i++) { Gm.step(G, { ...IDLE, my: G.p.y > Wd.HILLTOP + 10 ? 1 : (Math.hypot(G.p.z + 0.6) > 0.3 ? 0.5 : 0) }, DT); top = Math.max(top, G.p.y); if (G.flags.gallery) break; }
        ok(G.flags.gallery, `an updraft lifts you to the keep's gallery (rose to ${top.toFixed(1)})`);

        // the heart: wrong pair, thrown, weak, then right
        const [a, b] = G.laws.elowen;
        const other = C.ESSENCES.find((e) => e !== a && e !== b);
        G.p.x = 0; G.p.z = -3.6; G.p.y = Wd.HILLTOP + Wd.SITES.gallery.up; G.p.yaw = 0; G.p.pitch = -0.1;
        const offWax = C.PHASES.find((p) => p.id !== G.laws.wax[a] && p.id !== G.laws.wax[b]);
        G.tod = (offWax.from + offWax.to) / 2;
        G.events.length = 0;
        castAt(G, 'seal', [other, G.laws.opp[other]]);
        ok(!G.won && /not the seam/.test(msgs(G)), 'the wrong opposed pair does not free her');
        const weakA = Object.keys(G.laws.reagents).filter((r) => G.laws.reagents[r].essence === a && G.laws.reagents[r].potency === 1)[0];
        const weakB = Object.keys(G.laws.reagents).filter((r) => G.laws.reagents[r].essence === b && G.laws.reagents[r].potency === 1)[0];
        if (weakA && weakB) {
            G.events.length = 0;
            castAt(G, 'seal', [a, b], { feed: [weakA, weakB] });
            ok(!G.won && /stronger/.test(msgs(G)), 'her words, too weak, do not free her');
        }
        G.tod = (C.PHASES.find((p) => p.id === G.laws.wax[a]).from + C.PHASES.find((p) => p.id === G.laws.wax[a]).to) / 2;
        castAt(G, 'seal', [a, b]);
        ok(G.won && G.dialog?.id === 'epilogue', 'her two words, sealed at her feet at their hour, free Elowen');
        let n = 0;
        while (G.dialog && n++ < 50) { const nd = St.dialogNode(G); Gm.act(G, { t: 'say', choice: nd.choices ? nd.choices.length - 1 : undefined }); if (St.dialogNode(G)?.choices?.[0]?.end) Gm.act(G, { t: 'say', choice: 0 }); }
        ok(G.over && G.ending?.title, `the epilogue ends the game ("${G.ending?.title}")`);
        ok(G.elowen?.where === 'hut', 'the epilogue moves everyone home to the hut');
    }

    section('rules: echoes and the romance');
    {
        const G = lab(40), W = Wd.getWorld(40);
        const c = W.hutAt('circle');
        G.p.x = c.x; G.p.z = c.z - 1.5; G.p.y = W.hutFloor;
        G.tod = 0.3;
        castAt(G, 'ward', ['lumen']);
        Gm.step(G, IDLE, DT);
        ok(!G.echoes.e1, 'by day, light shows no echo');
        G.p.wards = {}; G.tod = 0.75;
        castAt(G, 'ward', ['lumen']);
        Gm.step(G, IDLE, DT);
        ok(G.echoes.e1 === 'shown', 'after dark, a light ward in the hut shows Elowen\'s echo');
        const r = Gm.act(G, { t: 'use', id: 'echo_e1' });
        ok(r.ok && G.dialog?.id === 'echo:e1', 'you can listen to the echo');
        while (G.dialog) Gm.act(G, { t: 'say' });
        ok(G.echoes.e1 === 'heard' && G.affection === 1, 'hearing it adds affection');
        const end = (aff, pick) => {
            const H = lab(41); H.affection = aff;
            St.openDialog(H, 'epilogue');
            let n = 0;
            while (H.dialog && n++ < 40) {
                const nd = St.dialogNode(H);
                if (nd.choices) { const i = nd.choices.findIndex((ch) => ch.end === pick); Gm.act(H, { t: 'say', choice: i >= 0 ? i : nd.choices.reduce((b, ch, k) => ((ch.aff || 0) > (nd.choices[b].aff || 0) ? k : b), 0) }); }
                else Gm.act(H, { t: 'say' });
            }
            return H.ending;
        };
        ok(end(3, 'heart').title === 'Two Voices', 'with echoes heard and warm answers, asking to stay is a romance');
        ok(end(0, 'heart').title === "We'll See", 'without them, she is shy but hopeful');
        ok(end(0, 'study').kind === 'study', 'or you stay to study together');
    }

    section('rules: research');
    {
        const G = Gm.newGame(12);
        const L = G.laws;
        G.flags.hutKnown = true; G.hasWand = true;
        const W = Wd.getWorld(12), al = W.hutAt('alembic');
        G.p.x = al.x + 1; G.p.z = al.z; G.p.y = W.hutFloor;
        G.bag.kelp = 2; G.bag.cowrie = 1;
        Gm.act(G, { t: 'experiment', inst: 'alembic', a: 'kelp' });
        ok(G.notes.reagents.kelp.essence === L.reagents.kelp.essence && G.bag.kelp === 1, 'the alembic reveals what a reagent carries and uses it up');
        const r0 = Gm.act(G, { t: 'experiment', inst: 'orrery', a: 'kelp' });
        ok(!r0.ok, 'instruments only work when you stand at them');
        const orr = W.hutAt('orrery'); G.p.x = orr.x - 1; G.p.z = orr.z;
        Gm.act(G, { t: 'experiment', inst: 'orrery', a: 'kelp' });
        ok(G.notes.wax[L.reagents.kelp.essence] === L.wax[L.reagents.kelp.essence], 'the orrery reveals the waxing hour');
        const be = W.hutAt('bells'); G.p.x = be.x + 1; G.p.z = be.z;
        const res = Gm.act(G, { t: 'experiment', inst: 'bells', a: 'kelp', b: 'cowrie' });
        const opposed = L.opp[L.reagents.kelp.essence] === L.reagents.cowrie.essence;
        ok(res.rel === (opposed ? 'clash' : 'two'), 'the bells tell whether two reagents clash');
        // a cast teaches: order, the glyph's essence and the shape's form
        G.glyphs = L.glyphs.map((g) => g.id);
        G.bag.seaglass = 3;
        castAt(G, 'ward', [L.reagents.seaglass.essence], { feed: ['seaglass'] });
        ok(G.notes.order === L.order, 'a successful cast records the word order');
        ok(G.notes.glyphs[L.glyphOf[L.reagents.seaglass.essence]].essence === L.reagents.seaglass.essence, '...and what its word means');
        ok(G.notes.shapes[L.glyphOf.ward].form === 'ward', '...and its shape');
        const N2 = Gm.newGame(13); N2.flags.hutKnown = true; N2.hasWand = true; N2.glyphs = N2.laws.glyphs.map((g) => g.id);
        N2.bag.kelp = 2;
        const e = N2.laws.reagents.kelp.essence;
        const wrong = C.ESSENCES.find((x) => x !== e);
        N2.notes.reagents.kelp = { essence: e, potency: 1 };
        castAt(N2, 'ward', [wrong], { feed: ['kelp'] });
        ok(N2.notes.glyphs[N2.laws.glyphOf[wrong]].not.includes(e), 'a starved word is crossed off for what fed it');
    }

    section('rules: survival');
    {
        const G = Gm.newGame(20);
        G.tod = 0.7;
        const w0 = G.p.warmth;
        for (let i = 0; i < 120 * 30; i++) Gm.step(G, IDLE, DT);
        ok(G.p.warmth < w0 - 4, 'a night outdoors is cold');
        G.p.vigor = 30;
        G.bag.berries = 1;
        Gm.act(G, { t: 'eat', item: 'berries' });
        ok(G.p.vigor > 40 && !G.bag.berries, 'berries feed you');
        G.p.health = 0.5; G.p.warmth = 0; G.bag.kelp = 4;
        for (let i = 0; i < 240; i++) Gm.step(G, IDLE, DT);
        ok(G.stats.collapses === 1 && G.p.inside !== undefined && G.p.health > 40 && G.bag.kelp === 2, 'collapsing wakes you in the hut at dawn with half your reagents');
        const H = Gm.newGame(21);
        const W = Wd.getWorld(21), hh = W.hutAt('hearth');
        H.p.x = hh.x + 2; H.p.z = hh.z; H.p.y = W.hutFloor; H.p.yaw = -Math.PI / 2;
        H.bag.driftwood = 3;
        Gm.act(H, { t: 'use', id: 'hearth' });
        ok(H.flags.hearth && !H.bag.driftwood, 'three driftwood light the hearth');
        H.bag.clam = 2;
        Gm.act(H, { t: 'cook' });
        ok(H.bag.clamcooked === 2, 'the fire cooks clams');
        const r = Gm.act(H, { t: 'rest', until: 'dawn' });
        ok(r.ok && H.tod < 0.02, 'resting by the lit hearth passes the night');
        H.p.x += 30;
        ok(!Gm.act(H, { t: 'rest', until: 'dusk' }).ok, 'you can only rest by a bed or a fire');
    }

    section('rules: saving');
    {
        const G = lab(30);
        castAt(G, 'ward', ['lumen']);
        const d = JSON.parse(JSON.stringify(Gm.serialize(G)));
        ok(!('laws' in d) && !('events' in d), 'a save leaves out the laws and events');
        const H = Gm.deserialize(d);
        ok(JSON.stringify(H.laws) === JSON.stringify(G.laws), 'loading rebuilds the laws from the seed');
        let threw = false;
        try { Gm.deserialize({ v: 99 }); } catch { threw = true; }
        ok(threw, 'an unknown save version is rejected');
    }
}

// =================================================================== determinism
function botRun(seed, maxT = 30000, opts = {}) {
    const G = Gm.newGame(seed, 'Bot');
    const bot = Bt.makeBot(opts);
    while (!G.over && G.t < maxT) {
        const { inp, cmds } = Bt.botTick(G, bot);
        for (const c of cmds) Gm.act(G, c);
        Gm.step(G, inp, DT);
        G.events.length = 0;
        const p = G.p;
        if (!Number.isFinite(p.x + p.y + p.z + p.health + p.warmth)) return { G, bot, bad: 'non-finite state' };
    }
    return { G, bot };
}

if (want('determinism')) {
    section('determinism');
    const run = (seed, T) => {
        const G = Gm.newGame(seed, 'Bot'); const bot = Bt.makeBot();
        while (G.t < T) { const { inp, cmds } = Bt.botTick(G, bot); for (const c of cmds) Gm.act(G, c); Gm.step(G, inp, DT); G.events.length = 0; }
        return G;
    };
    const a = run(42, 300), b = run(42, 300);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'the same seed and bot give the same game');
    const G = run(43, 260);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const step = (H) => { for (let i = 0; i < 120 * 20; i++) Gm.step(H, { mx: 0.4, my: 1, dyaw: 0.003, dpitch: 0 }, DT); };
    step(G); step(copy);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
}

// =================================================================== bot
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        const seed = s * 7919;
        const t0 = Date.now();
        const { G, bot, bad } = botRun(seed);
        ok(!bad, `seed ${seed}: ${bad || 'state stays finite'}`);
        ok(G.won && G.over, `seed ${seed}: the researching bot frees Elowen${G.won ? '' : ' (stuck at ' + Gm.currentGoal(G).id + ')'}`);
        rows.push({ seed, days: G.day, mins: Math.round(G.t / 60), casts: G.stats.casts, fizzles: G.stats.fizzles, exp: G.stats.experiments, collapses: G.stats.collapses, ending: G.ending?.title || '-', ms: Date.now() - t0 });
        if (process.env.VERBOSE && !G.won) console.log(bot.log.slice(-10).join('\n'));
    }
    console.table(rows);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
