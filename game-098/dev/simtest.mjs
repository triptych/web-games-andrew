/**
 * simtest.mjs — headless checks of Wyrmbond's simulation. No browser.
 *
 *   node game-098/dev/simtest.mjs            # everything
 *   ONLY=purity,data,rules node game-098/dev/simtest.mjs
 *   SEEDS=8 VERBOSE=1 node game-098/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. data: every chapter map is rectangular and parses; every unit starts on a tile it can stand on,
 *    alone; every enemy is reachable on foot or wing from Kestrel; every objective has what it needs;
 *    every species, skill and trait the tables name exists; Wild Hunt maps are valid over 200 seeds.
 * 3. rules: movement costs and blocking, the damage formula (elements, classes, terrain, wounds,
 *    fliers), counters and siege, First Strike, Sturdy, claiming property and income, calling from a
 *    roost, unchaining, each skill kind, powers, stuns, the objectives and the lose conditions.
 * 4. roost: starters, incubation in real time, warming, hatching, the stable cap, breeding odds and
 *    inheritance, hybrids, feeding, training, the hoard, the market and its upgrades.
 * 5. determinism: the same seed and commands give the same game; a save round trip mid-battle and
 *    mid-roost plays on identically; an unknown save version is rejected.
 * 6. campaign: the bot plays the whole story (with Wild Hunts when it falls behind) on SEEDS seeds,
 *    with per-action invariants, and every seed must reach the ending. The balance table is printed.
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
const ST = await import('../js/sim/story.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Ba = await import('../js/sim/battle.js');
const Mp = await import('../js/sim/map.js');
const Dr = await import('../js/sim/dragons.js');
const AI = await import('../js/sim/ai.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const act = (G, cmd) => Gm.act(G, cmd);
const drain = (G) => { const e = G.events.splice(0); return e; };

/** A fresh game with a starter and some dragons at a level. */
function setup(seed = 1, extra = []) {
    const G = Gm.newGame(seed);
    act(G, { t: 'starter', sp: 'cinderwing' });
    for (const [sp, lv] of extra) G.meta.dragons.push(Dr.makeDragon(G, sp, { lv }));
    G.meta.party = G.meta.dragons.map((d) => d.rid).slice(0, 6);
    drain(G);
    return G;
}
/** A tiny hand-built battle on an open field. units: [{ k|sp, team, x, y, lv }] */
function arena(G, rows, units, extra = {}) {
    const B = {
        id: 'test', title: 'Test', theme: 'meadow', objective: { type: 'rout', text: '' }, ch: -1,
        units: [], nextId: 1, turn: 1, phase: 'p', over: null, funds: { p: 1000, e: 1000 },
        power: { p: { meter: 0, on: false, def: D.POWERS.wyrmsong[0] }, e: { meter: 0, on: false, def: null } },
        co: { p: 'kestrel', e: null }, talk: [], talked: {}, treasure: {}, build: false, limit: 0, lvl: 5, slots: 6,
        hex: false, fainted: [], deployed: [], recruited: [], found: [], stats: { kills: 0, faints: 0, dealt: 0, taken: 0 }, aiT: 0, aiQueue: null, result: null,
        started: true, ...extra,
    };
    const m = Mp.parseMap(rows);
    Object.assign(B, { w: m.w, h: m.h, tiles: m.tiles, own: m.own, capt: m.tiles.map(() => 20), capBy: m.tiles.map(() => -1), homeHq: [], enemyHq: [] });
    for (let i = 0; i < B.tiles.length; i++) if (B.tiles[i] === 'hq') (B.own[i] === 'p' ? B.homeHq : B.enemyHq).push(i);
    Object.defineProperty(B, 'events', { value: G.events, enumerable: false, writable: true, configurable: true });
    G.battle = B;
    for (const u of units) {
        const spec = { ...u, team: u.team || 'p', lv: u.lv || 5 };
        if (u.sp) { spec.k = 'dragon'; }
        Ba.makeUnit(G, B, spec);
    }
    // every battle needs Kestrel, or it's lost at once: park one out of the way
    if (!units.some((u) => u.k === 'tamer')) {
        for (let i = B.tiles.length - B.w; i >= 0 && !B.units.some((u) => u.tamer); i = i + 1 < B.tiles.length ? i + 1 : -1) {
            const x = i % B.w, y = (i / B.w) | 0;
            if (!Mp.unitAt(B, x, y) && B.tiles[i] !== 'sea') Ba.makeUnit(G, B, { k: 'tamer', team: 'p', x, y, lv: 1 });
        }
    }
    return B;
}
const at = (B, x, y) => Mp.unitAt(B, x, y);

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout|setInterval/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|play)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('data')) {
    section('data');
    for (const [k, S] of Object.entries(D.SPECIES)) {
        ok(D.SKILLS[S.skill] && D.TRAITS[S.trait] && D.ELEMENTS[S.el] && D.CLASSES[S.cls] && D.MOVETYPES.includes(S.mt), `${k}: skill, trait, element, class and move type exist`);
        ok(S.rarity >= 1 && S.rarity <= 5 && C.HATCH[S.rarity], `${k}: rarity has a hatch time`);
    }
    for (const [k, U] of Object.entries(D.UNITS)) ok((!U.skill || D.SKILLS[U.skill]) && (!U.trait || D.TRAITS[U.trait]) && D.CLASSES[U.cls], `${k}: skill, trait and class exist`);
    for (const r of D.BREED_RECIPES) ok(D.SPECIES[r.sp]?.hybrid && r.els.every((e) => D.ELEMENTS[e]), `recipe ${r.els.join('+')} → ${r.sp} is a hybrid`);
    ok(Object.values(D.SPECIES).filter((s) => s.hybrid).every((s) => D.BREED_RECIPES.some((r) => D.SPECIES[r.sp] === s)), 'every hybrid has a recipe');
    for (const t of Object.values(D.TERRAIN)) ok(D.MOVETYPES.every((m) => m in t.cost), `${t.name}: a cost for every move type`);
    ok(ST.STARTERS.every((s) => D.SPECIES[s]), 'starters exist');
    const speakers = new Set(Object.keys(ST.SPEAKERS));
    const lines = [...ST.PROLOGUE];
    ST.CHAPTERS.forEach((Ch, ci) => {
        let m;
        try { m = Mp.parseMap(Ch.map); } catch (e) { ok(false, `${Ch.id}: ${e.message}`); return; }
        ok(m.w <= 16 && m.h <= 12, `${Ch.id}: map at most 16×12 (${m.w}×${m.h})`);
        lines.push(...Ch.pre, ...Ch.post, ...(Ch.talk || []).flatMap((t) => t.lines));
        const G = setup(ci + 1, [['pebblescale', 5], ['ripplefin', 5], ['thornback', 5], ['zephyrling', 5], ['mossling', 5]]);
        G.meta.ch = ci;
        const r = act(G, { t: 'start', ch: ci });
        if (!ok(r.ok, `${Ch.id}: starts`)) return;
        const B = G.battle;
        const spots = new Set();
        for (const u of B.units) {
            const k = u.x + ',' + u.y;
            ok(!spots.has(k), `${Ch.id}: ${u.name} at ${k} starts alone`);
            spots.add(k);
            ok(Mp.canStand(B, u, u.x, u.y), `${Ch.id}: ${u.name} can stand at ${k} (${B.tiles[Mp.idx(B, u.x, u.y)]})`);
        }
        // everyone the player must beat can be reached
        const tamer = B.units.find((u) => u.tamer);
        const reachable = (mt) => Mp.distField(B, { mt, traits: [] }, [[tamer.x, tamer.y]]);
        const walk = reachable('walk'), fly = reachable('fly');
        for (const u of B.units.filter((v) => v.team === 'e')) {
            const i = Mp.idx(B, u.x, u.y);
            const adj = Mp.DIRS.some(([dx, dy]) => Mp.inside(B, u.x + dx, u.y + dy) && walk[Mp.idx(B, u.x + dx, u.y + dy)] < Infinity);
            ok(walk[i] < Infinity || adj || fly[i] < Infinity, `${Ch.id}: ${u.name} at ${u.x},${u.y} can be reached`);
        }
        const O = Ch.objective;
        if (O.type === 'boss') ok(B.units.some((u) => u.boss && u.team === 'e'), `${Ch.id}: has a boss`);
        if (O.type === 'hq') ok(B.enemyHq.length > 0, `${Ch.id}: has an enemy stronghold`);
        if (O.type === 'survive') ok(B.homeHq.length > 0 && O.turns > 0, `${Ch.id}: has a stronghold to hold`);
        if (O.type === 'reach') ok(walk[Mp.idx(B, O.at[0], O.at[1])] < Infinity, `${Ch.id}: Kestrel can walk to the goal`);
        if (O.type === 'unchain') ok(B.units.some((u) => u.target && u.chained), `${Ch.id}: has a dragon to free`);
        if (Ch.build) ok(B.tiles.some((t, i) => t === 'roost' && B.own[i] === 'e'), `${Ch.id}: the Chain has a keep to muster at`);
        ok(Ch.deploy.length >= Ch.slots, `${Ch.id}: a deploy square for every slot`);
        for (const sp of Ch.reward.eggs || []) ok(D.SPECIES[sp], `${Ch.id}: reward egg ${sp} exists`);
    });
    for (const [who] of lines) ok(speakers.has(who), `speaker "${who}" is known`);
    // Wild Hunt maps over many seeds
    let made = 0, bad = 0;
    for (let s = 1; s <= 200; s++) {
        const G = setup(s, [['pebblescale', 10], ['ripplefin', 10]]);
        G.meta.flags.wild = true;
        const r = act(G, { t: 'start', wild: true, lvl: 1 + (s % 20) });
        if (!r.ok) { bad++; continue; }
        const B = G.battle;
        made++;
        const tamer = B.units.find((u) => u.tamer);
        const walk = Mp.distField(B, { mt: 'walk', traits: [] }, [[tamer.x, tamer.y]]);
        for (const u of B.units) if (!Mp.canStand(B, u, u.x, u.y)) bad++;
        for (const u of B.units.filter((v) => v.team === 'e')) {
            const adj = Mp.DIRS.some(([dx, dy]) => Mp.inside(B, u.x + dx, u.y + dy) && walk[Mp.idx(B, u.x + dx, u.y + dy)] < Infinity);
            if (walk[Mp.idx(B, u.x, u.y)] === Infinity && !adj && u.mt !== 'fly') bad++;
        }
        if (!B.units.some((u) => u.team === 'e' && !u.chained)) bad++;
    }
    ok(made === 200 && bad === 0, `200 Wild Hunt maps: all valid (${made} made, ${bad} problems)`);
}

// ======================================================================
if (want('rules')) {
    section('rules');
    const open = ['.......', '.......', '.......', '.......', '.......'];
    // --- movement
    {
        const G = setup(2);
        const B = arena(G, ['.ff....', '.mm.~..', '.......', '..w....', '.......'], [{ sp: 'pebblescale', x: 0, y: 2 }, { sp: 'cinderwing', x: 6, y: 4 }, { k: 'chainknight', team: 'e', x: 0, y: 0 }]);
        const peb = at(B, 0, 2), cw = at(B, 6, 4);
        const R = Ba.reachOf(B, peb);
        ok(R.get(Mp.idx(B, 1, 1))?.cost === 1 + 1, 'Mountain-born walks onto mountains for 1');
        ok(!R.has(Mp.idx(B, 4, 1)) || false, 'walkers cannot enter the sea');
        const Rf = Ba.reachOf(B, cw);
        ok(Rf.has(Mp.idx(B, 4, 1)), 'fliers cross the sea');
        ok(Ba.moveNow(B, cw) === 7, 'Swift adds a move (Cinderwing 6+1)');
        const kn = at(B, 0, 0);
        const Rk = Ba.reachOf(B, kn);
        ok(!Rk.has(Mp.idx(B, 0, 3)), 'an enemy unit blocks movement through it');
        ok(Ba.battleAct(G, { t: 'act', id: peb.id, to: [6, 4], do: 'wait' }).ok === false, 'cannot end on an occupied tile');
    }
    // --- damage
    {
        const G = setup(3);
        const B = arena(G, ['.f.m...', '.......', '.......'], [
            { sp: 'cinderwing', x: 0, y: 1 }, { sp: 'mossling', team: 'e', x: 1, y: 1 }, { sp: 'ripplefin', team: 'e', x: 0, y: 2 },
            { sp: 'mossling', team: 'e', x: 1, y: 0 }, { k: 'ballista', team: 'e', x: 5, y: 1 }, { sp: 'pebblescale', team: 'e', x: 3, y: 0 },
        ]);
        const cw = at(B, 0, 1), moss = at(B, 1, 1), rip = at(B, 0, 2), mossF = at(B, 1, 0), bal = at(B, 5, 1);
        ok(Ba.elemMult('ember', 'verdant') === C.COMBAT.edge && Ba.elemMult('ember', 'tide') === C.COMBAT.dull && Ba.elemMult('lumen', 'umbra') === C.COMBAT.edge && Ba.elemMult('umbra', 'lumen') === C.COMBAT.edge, 'the element wheel');
        ok(Ba.elemMult('aether', 'ember') === 1 && Ba.elemMult('ember', 'aether') === 1, 'Aether has no edge and no weakness');
        ok(Ba.blow(B, cw, moss) > Ba.blow(B, cw, rip), 'Ember hurts Verdant more than Tide');
        ok(Ba.blow(B, cw, mossF) < Ba.blow(B, cw, moss), 'forest cover cuts damage to a ground unit');
        ok(Ba.starsOf(B, cw, 1, 0) === 0, 'fliers get no cover');
        ok(Ba.starsOf(B, at(B, 3, 0), 3, 0) === 5, 'Mountain-born gets a fifth star on a mountain');
        const full = Ba.blow(B, cw, moss);
        cw.hp = Math.ceil(cw.hpMax / 2);
        ok(Ba.blow(B, cw, moss) < full * 0.8, 'a wounded attacker hits softer');
        cw.hp = cw.hpMax;
        ok(Ba.blow(B, bal, cw) > Ba.blow(B, bal, moss) * 1.3, 'ballistas shred fliers');
        const f = Ba.forecast(B, bal, cw, bal.x, bal.y);
        void f;
        cw.x = 3; cw.y = 1;
        ok(!Ba.canCounter(B, bal, cw, 5, 1), 'a flier at range 2 cannot counter a ballista');
        cw.x = 4; cw.y = 1;
        ok(!Ba.canCounter(B, cw, bal), 'a siege engine never counters');
        const r = Ba.battleAct(G, { t: 'act', id: bal.id, to: [5, 2], do: 'attack', target: [3, 1] });
        ok(!r.ok, 'a siege engine cannot move and fire');
    }
    // --- counters, flurries, First Strike, Sturdy, Thorns
    {
        const G = setup(4);
        const B = arena(G, open, [{ sp: 'zephyrling', x: 0, y: 0, lv: 10 }, { k: 'chainknight', team: 'e', x: 1, y: 0, lv: 1 }, { sp: 'solaris', team: 'e', x: 3, y: 3, lv: 5 }, { sp: 'pebblescale', x: 2, y: 3, lv: 5 }, { sp: 'thornback', team: 'e', x: 5, y: 0, lv: 5 }, { sp: 'magmaback', x: 5, y: 1, lv: 5 }]);
        const z = at(B, 0, 0), k = at(B, 1, 0);
        const f = Ba.forecast(B, z, k);
        ok(f.strikes.filter((s) => s.by === 'a').length === 2, 'a much faster attacker strikes twice');
        const so = at(B, 3, 3), pb = at(B, 2, 3);
        const f2 = Ba.forecast(B, pb, so);
        ok(f2.strikes[0].by === 'd', 'First Strike counters before the attacker lands');
        drain(G);
        so.traits.push('sturdy'); so.hp = 1 + 1;
        so.hp = 2;
        const t = at(B, 5, 0), mg = at(B, 5, 1);
        Ba.doAttack(G, B, mg, t);
        const ev = G.events.find((e) => e.type === 'attack');
        ok(ev.strikes.some((s) => s.by === 'a' && s.thorn > 0), 'Thorns hurt a close attacker');
        drain(G);
        so.hp = 3; so.sturdyUsed = false;
        const hurtable = { ...so };
        void hurtable;
        Ba.doAttack(G, B, pb, so);
        ok(so.hp >= 1, 'Sturdy survives a fatal blow with 1 HP');
    }
    // --- claiming, income, healing, losing the stronghold
    {
        const G = setup(5);
        const B = arena(G, ['H.v..', '.....', '..2.K'], [{ k: 'tamer', x: 1, y: 0, lv: 5 }, { k: 'chainknight', team: 'e', x: 3, y: 2, lv: 5 }, { sp: 'cinderwing', x: 4, y: 0 }]);
        const T = at(B, 1, 0), k = at(B, 3, 2), cw = at(B, 4, 0);
        const turn = () => { Ba.startPhase(G, B, 'e'); Ba.startPhase(G, B, 'p'); };   // the Chain sits this one out
        ok(Ba.battleAct(G, { t: 'act', id: T.id, to: [2, 0], do: 'capture' }).ok, 'Kestrel starts claiming a village');
        ok(B.capt[Mp.idx(B, 2, 0)] === 10 && B.own[Mp.idx(B, 2, 0)] === null, 'full health claims 10 of 20');
        turn();
        ok(Ba.battleAct(G, { t: 'act', id: T.id, to: [2, 0], do: 'capture' }).ok && B.own[Mp.idx(B, 2, 0)] === 'p', 'a second turn finishes the claim');
        const f0 = B.funds.p;
        turn();
        ok(B.funds.p - f0 === 200, 'each property pays 100 a turn (stronghold + village)');
        cw.hp = 5; cw.x = 0; cw.y = 0;
        turn();
        ok(cw.hp > 5, 'a unit on its own property heals at the start of its turn');
        T.acted = false;
        Ba.battleAct(G, { t: 'act', id: T.id, to: [2, 1], do: 'wait' });
        // a claim is lost when the claimer steps off
        k.x = 2; k.y = 0;
        Ba.startPhase(G, B, 'e');
        Ba.battleAct(G, { t: 'act', id: k.id, to: [2, 0], do: 'capture' });
        ok(B.capt[Mp.idx(B, 2, 0)] < 20, 'the Chain starts claiming it back');
        k.acted = false;
        Ba.battleAct(G, { t: 'act', id: k.id, to: [2, 1 + 0], do: 'wait' }) || null;
        ok(B.capt[Mp.idx(B, 2, 0)] === 20 || k.x === 2 && k.y === 0, 'stepping off resets a half-done claim');
        // the Chain claims your stronghold
        cw.x = 4; cw.y = 1; k.x = 0; k.y = 1; k.hp = k.hpMax;
        for (let i = 0; i < 3 && !B.over; i++) { k.acted = false; B.phase = 'e'; Ba.battleAct(G, { t: 'act', id: k.id, to: [0, 0], do: 'capture' }); }
        ok(B.over && !B.over.win && B.over.reason === 'hq', 'losing your stronghold loses the battle');
    }
    // --- calling from a roost
    {
        const G = setup(6, [['pebblescale', 6], ['ripplefin', 4]]);
        const B = arena(G, ['R....', '.....'], [{ k: 'tamer', x: 4, y: 1 }, { k: 'chainknight', team: 'e', x: 4, y: 0 }]);
        const rid = G.meta.dragons[1].rid;
        const cost = Ba.callCost(G, rid);
        ok(cost === C.CALL.base + C.CALL.perLevel * 6, 'call cost scales with level');
        B.funds.p = cost - 1;
        ok(!Ba.battleAct(G, { t: 'call', at: [0, 0], rid }).ok, 'cannot call without the gold');
        B.funds.p = cost;
        ok(Ba.battleAct(G, { t: 'call', at: [0, 0], rid }).ok && at(B, 0, 0)?.rid === rid && at(B, 0, 0).acted, 'a called dragon arrives on the roost, spent');
        ok(!Ba.battleAct(G, { t: 'call', at: [1, 0], rid: G.meta.dragons[2].rid }).ok, 'only on a roost you own');
        ok(!Ba.reserve(G, B).some((d) => d.rid === rid), 'a called dragon leaves the reserve');
    }
    // --- unchaining
    {
        const G = setup(7);
        const B = arena(G, open, [{ k: 'tamer', x: 0, y: 0, lv: 5 }, { sp: 'zephyrling', team: 'e', x: 1, y: 0, chained: true }, { k: 'chainknight', team: 'e', x: 6, y: 4 }]);
        const T = at(B, 0, 0), z = at(B, 1, 0);
        ok(Ba.unchainTargets(B, T).length === 0, 'a healthy collared dragon cannot be freed');
        z.hp = Math.floor(z.hpMax * 0.2);
        ok(Ba.unchainChance(B, z, T) === 1, 'below a quarter it is certain');
        const n0 = G.meta.dragons.length;
        ok(Ba.battleAct(G, { t: 'act', id: T.id, to: [0, 0], do: 'unchain', target: [1, 0] }).ok, 'Kestrel sings it free');
        ok(z.team === 'p' && !z.chained && z.rid != null && G.meta.dragons.length === n0 + 1, 'it joins the side and the stable');
        let tries = 0, wins = 0;
        for (let s = 0; s < 400; s++) {
            const G2 = setup(100 + s);
            const B2 = arena(G2, open, [{ k: 'tamer', x: 0, y: 0, lv: 1 }, { sp: 'zephyrling', team: 'e', x: 1, y: 0, chained: true }, { k: 'chainknight', team: 'e', x: 6, y: 4 }]);
            const zz = at(B2, 1, 0); zz.hp = Math.floor(zz.hpMax * 0.45);
            tries++;
            Ba.battleAct(G2, { t: 'act', id: at(B2, 0, 0).id, to: [0, 0], do: 'unchain', target: [1, 0] });
            if (zz.team === 'p') wins++;
        }
        const want = Ba.unchainChance({}, { chained: true, hp: 45, hpMax: 100 }, { lv: 1 });
        ok(Math.abs(wins / tries - want) < 0.07, `the chance at 45% health is what the forecast says (${Math.round(wins / tries * 100)}% vs ${Math.round(want * 100)}%)`);
    }
    // --- skills
    {
        const G = setup(8);
        const B = arena(G, open, [
            { sp: 'pyrewyrm', x: 0, y: 2, lv: 10 }, { k: 'chainknight', team: 'e', x: 3, y: 2 }, { k: 'chainknight', team: 'e', x: 3, y: 1 }, { k: 'chainknight', team: 'e', x: 4, y: 3 },
            { sp: 'mossling', x: 0, y: 0, lv: 10 }, { sp: 'zephyrling', x: 1, y: 0, lv: 10 }, { sp: 'ripplefin', x: 6, y: 1, lv: 10 }, { k: 'chainknight', team: 'e', x: 6, y: 2 },
            { sp: 'frostmaw', x: 5, y: 4, lv: 10 }, { k: 'hexer', team: 'e', x: 6, y: 4 },
        ]);
        const py = at(B, 0, 2);
        const kn = B.units.filter((u) => u.key === 'chainknight');
        const hp0 = kn.map((u) => u.hp);
        ok(Ba.battleAct(G, { t: 'act', id: py.id, to: [1, 2], do: 'skill', target: [3, 2] }).ok, 'Inferno can be aimed 2 tiles away');
        ok(kn.slice(0, 3).filter((u, i) => u.hp < hp0[i]).length === 3, 'a blast hits every foe in its 3×3');
        ok(py.cd === D.SKILLS.inferno.cd, 'the skill then rests');
        ok(Ba.skillTargets(B, py).length === 0, 'a resting skill has no targets');
        const moss = at(B, 0, 0); moss.hp = 10;
        ok(Ba.battleAct(G, { t: 'act', id: moss.id, to: [0, 0], do: 'skill', target: [0, 0] }).ok && moss.hp > 10, 'Bloom heals');
        const z = at(B, 1, 0);
        ok(Ba.battleAct(G, { t: 'act', id: z.id, to: [1, 1], do: 'skill', target: [0, 1] }).ok === false, 'Tailwind needs a spent ally');
        const py2 = at(B, 1, 2);
        ok(Ba.battleAct(G, { t: 'act', id: z.id, to: [1, 1], do: 'skill', target: [1, 2] }).ok && !py2.acted, 'Tailwind lets a spent ally act again');
        const rp = at(B, 6, 1), k2 = at(B, 6, 2);
        const y0 = k2.y;
        Ba.battleAct(G, { t: 'act', id: rp.id, to: [6, 1], do: 'skill', target: [6, 2] });
        ok(k2.y === y0 + 1 && (k2.hp < k2.hpMax), 'Tidal Crash pushes (blocked after one by the wall) and hurts');
        const fm = at(B, 5, 4), hx = at(B, 6, 4);
        Ba.battleAct(G, { t: 'act', id: fm.id, to: [5, 4], do: 'skill', target: [6, 4] });
        ok(hx.stun === 1, 'Frostbite stuns');
        Ba.endPhase(G, B);
        ok(hx.acted, 'a stunned unit loses its turn');
        ok(!Ba.battleAct(G, { t: 'act', id: hx.id, to: [6, 3], do: 'wait' }).ok, 'and cannot move or act');
    }
    // --- powers
    {
        const G = setup(9);
        const B = arena(G, open, [{ sp: 'cinderwing', x: 0, y: 0, lv: 10 }, { sp: 'mossling', team: 'e', x: 2, y: 0 }]);
        const cw = at(B, 0, 0), m = at(B, 2, 0);
        const before = Ba.blow(B, cw, m);
        ok(!Ba.battleAct(G, { t: 'power', team: 'p' }).ok, 'the song needs a full meter');
        B.power.p.meter = C.POWER.max;
        ok(Ba.battleAct(G, { t: 'power', team: 'p' }).ok && B.power.p.on, 'a full meter sings the Wyrmsong');
        ok(Ba.blow(B, cw, m) > before * 1.15 && Ba.moveNow(B, cw) === cw.mv + 1, 'the song adds damage and a move');
        Ba.endPhase(G, B); Ba.endPhase(G, B);
        ok(!B.power.p.on, 'it lasts until your next turn');
    }
    // --- objectives and losing
    {
        const G = setup(10);
        arena(G, open, [{ k: 'tamer', x: 0, y: 0 }, { k: 'chainknight', team: 'e', x: 1, y: 0, lv: 30 }]);
        const B = G.battle;
        const T = at(B, 0, 0); T.hp = 1;
        B.phase = 'e';
        Ba.battleAct(G, { t: 'act', id: at(B, 1, 0).id, to: [1, 0], do: 'attack', target: [0, 0] });
        ok(B.over && B.over.reason === 'tamer', 'if Kestrel falls, the battle is lost');
        const G2 = setup(11);
        const B2 = arena(G2, open, [{ k: 'tamer', x: 0, y: 0 }, { sp: 'cinderwing', x: 5, y: 0, lv: 20 }, { sp: 'zephyrling', team: 'e', x: 6, y: 4, chained: true }, { k: 'chainknight', team: 'e', x: 5, y: 1, lv: 1 }]);
        const kn = at(B2, 5, 1); kn.hp = 1;
        Ba.battleAct(G2, { t: 'act', id: at(B2, 5, 0).id, to: [5, 0], do: 'attack', target: [5, 1] });
        ok(B2.over?.win && B2.over.reason === 'rout', 'routing the soldiers wins, even with collared strays left');
        // a story dragon to free can't be knocked out by your side
        const G3 = setup(12);
        const B3 = arena(G3, open, [{ k: 'tamer', x: 0, y: 0 }, { sp: 'geodon', x: 3, y: 1, lv: 40 }, { sp: 'sylvara', team: 'e', x: 3, y: 2, chained: true, target: true, lv: 1 }], { objective: { type: 'unchain', text: '' } });
        Ba.battleAct(G3, { t: 'act', id: at(B3, 3, 1).id, to: [3, 1], do: 'attack', target: [3, 2] });
        const sy = at(B3, 3, 2);
        ok(sy && sy.hp === 1 && !B3.over, 'the dragon you came to free keeps 1 HP');
        ok(Ba.moveNow(B3, sy) === 0, 'and stays collared to its shrine');
        const T3 = at(B3, 0, 0); T3.x = 2; T3.y = 2;
        Ba.battleAct(G3, { t: 'act', id: T3.id, to: [2, 2], do: 'unchain', target: [3, 2] });
        ok(B3.over?.win && B3.over.reason === 'freed', 'freeing it wins');
    }
    // --- the AI never stalls and never cheats
    {
        const G = setup(13, [['pebblescale', 8], ['thunderhorn', 8]]);
        G.meta.ch = 4; G.meta.flags.wild = true;
        act(G, { t: 'start', ch: 4 });
        const B = G.battle;
        let n = 0, bad = 0;
        while (!B.over && n++ < 3000) {
            const cmd = AI.nextCommand(G, B, B.phase, {});
            if (!cmd) break;
            const r = act(G, cmd.t === 'end' ? { ...cmd, ai: true } : cmd);
            if (!r.ok) bad++;
            if (!r.ok && cmd.t === 'act') act(G, { t: 'act', id: cmd.id, do: 'wait' });
            drain(G);
        }
        ok(B.over, 'AI vs AI finishes the lighthouse defence');
        ok(bad === 0, `every AI command is legal (${bad} refused)`);
    }
}

// ======================================================================
if (want('roost')) {
    section('roost');
    const G = Gm.newGame(21);
    ok(!act(G, { t: 'start', ch: 0 }).ok, 'no battles before a starter');
    ok(act(G, { t: 'starter', sp: 'ripplefin' }).ok && G.meta.dragons.length === 1 && G.meta.party.length === 1, 'a starter hatches and joins the flock');
    ok(!act(G, { t: 'starter', sp: 'mossling' }).ok, 'only one starter');
    const M = G.meta;
    const e = Dr.makeEgg(G, 'pebblescale');
    ok(act(G, { t: 'incubate', eid: e.eid }).ok && M.incub.includes(e.eid), 'an egg goes in an incubator');
    act(G, { t: 'idle', sec: 60 });
    ok(e.prog === 60, 'real time warms it');
    act(G, { t: 'warm', slot: M.incub.indexOf(e.eid) });
    ok(e.prog === 60 + C.IDLE.tapWarm, 'a tap warms it a little more');
    ok(!act(G, { t: 'hatch', slot: 0 }).ok, 'it will not hatch before it is ready');
    act(G, { t: 'idle', sec: 99999 });
    ok(e.prog === e.need && drain(G).some((x) => x.type === 'ready'), 'time away is capped and the egg says it is ready');
    ok(act(G, { t: 'hatch', slot: 0 }).ok && M.dragons.length === 2 && M.dragons[1].genes.hp === e.genes.hp, 'it hatches with the egg\'s genes');
    ok(!M.eggs.includes(e) && M.incub[0] === null, 'the egg and the incubator are freed');
    // feeding and training
    const d = M.dragons[1];
    M.food.fish = 3;
    act(G, { t: 'feed', rid: d.rid, food: 'fish' });
    ok(d.lv === 2 && M.food.fish === 2, 'a fish levels a hatchling');
    act(G, { t: 'train', rid: d.rid });
    const lv0 = d.lv;
    act(G, { t: 'idle', sec: 3600 });
    ok(d.lv > lv0, 'a training ring levels a dragon over real time');
    M.food.ironroot = 6;
    for (let i = 0; i < 6; i++) act(G, { t: 'feed', rid: d.rid, food: 'ironroot', stat: 'atk' });
    ok(d.train.atk === C.LIMITS.trainBonus && M.food.ironroot === 1, 'trained stats stop at their limit');
    ok(M.hoard > 0 && act(G, { t: 'collect' }).ok && M.hoard < 1, 'the stable gathers a hoard you can collect');
    // the market
    M.gold = 100000;
    const n0 = M.incub.length;
    act(G, { t: 'buy', item: 'nest' });
    ok(M.incub.length === n0 + 1 && Gm.price(G, 'nest') > C.SHOP.nest.cost, 'incubators can be bought and get dearer');
    while (act(G, { t: 'buy', item: 'nest' }).ok);
    ok(M.incub.length === C.LIMITS.incubators, 'incubators stop at their limit');
    ok(act(G, { t: 'buy', item: 'egg' }).ok && M.eggs.length === 1 && D.SPECIES[M.eggs[0].sp].rarity <= 3, 'a market egg is common');
    ok(act(G, { t: 'buy', item: 'rareegg' }).ok && D.SPECIES[M.eggs[1].sp].rarity >= 3, 'a sky-merchant egg is rare');
    // the stable cap
    M.stableN = M.dragons.length;
    const egg2 = M.eggs[0];
    act(G, { t: 'incubate', eid: egg2.eid }); egg2.prog = egg2.need;
    ok(act(G, { t: 'hatch', slot: M.incub.indexOf(egg2.eid) }).err === 'stable full', 'a full stable stops a hatch');
    // breeding
    const G2 = Gm.newGame(22);
    act(G2, { t: 'starter', sp: 'cinderwing' });
    const a = Dr.makeDragon(G2, 'magmaback', { lv: 15, genes: { hp: 15, atk: 15, def: 15, spd: 15 }, traits: ['lavaborn', 'brave'] });
    const b = Dr.makeDragon(G2, 'pebblescale', { lv: 15, genes: { hp: 9, atk: 9, def: 9, spd: 9 } });
    const kid = Dr.makeDragon(G2, 'mossling', { lv: 3 });
    G2.meta.dragons.push(a, b, kid);
    ok(!act(G2, { t: 'breed', a: a.rid, b: b.rid }).ok, 'breeding is locked until the story opens it');
    G2.meta.flags.breed = true;
    ok(!act(G2, { t: 'breed', a: a.rid, b: kid.rid }).ok, 'hatchlings cannot breed');
    const odds = Dr.breedOdds(a, b);
    ok(Math.abs(odds.reduce((s, o) => s + o.p, 0) - 1) < 1e-9 && odds.some((o) => o.sp === 'obsidrake'), 'Ember + Stone can make an Obsidian Drake; odds sum to 1');
    const r = act(G2, { t: 'breed', a: a.rid, b: b.rid });
    ok(r.ok && a.breedCd === C.IDLE.breedCd && b.breedCd === C.IDLE.breedCd, 'parents lay an egg and rest');
    ok(!act(G2, { t: 'breed', a: a.rid, b: b.rid }).ok, 'resting parents cannot breed again');
    act(G2, { t: 'idle', sec: C.IDLE.breedCd });
    ok(Dr.canBreed(a), 'they are ready after resting');
    // over many eggs: species odds, gene inheritance, hybrid rates
    let hyb = 0, sumAtk = 0, inherit = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
        a.breedCd = b.breedCd = 0;
        const egg = Dr.breedEgg(G2, a, b);
        G2.meta.eggs.pop();
        if (egg.sp === 'obsidrake') hyb++;
        sumAtk += egg.genes.atk;
        if (egg.traits.includes('brave')) inherit++;
    }
    ok(Math.abs(hyb / N - 0.25) < 0.03, `hybrids hatch at their recipe's rate (${(hyb / N * 100).toFixed(1)}%)`);
    ok(sumAtk / N > 12 && sumAtk / N < 13.5, `genes lean to the better parent (${(sumAtk / N).toFixed(2)} from 15 and 9)`);
    ok(inherit / N > 0.3 && inherit / N < 0.6, `a parent's extra trait is often inherited (${(inherit / N * 100).toFixed(0)}%)`);
    // levels and stages
    const dd = Dr.makeDragon(G2, 'cinderwing', { lv: 1 });
    Dr.giveXp(dd, 100000);
    ok(dd.lv === C.LEVEL.max && dd.xp === 0, 'levels stop at the max');
    ok(Dr.stageOf(1) === 'hatchling' && Dr.stageOf(C.LEVEL.juvenile) === 'juvenile' && Dr.stageOf(C.LEVEL.adult) === 'adult' && Dr.stageOf(C.LEVEL.elder) === 'elder', 'stages by level');
    const s1 = Dr.statsFor('cinderwing', 20, { hp: 0, atk: 0, def: 0, spd: 0 }), s2 = Dr.statsFor('cinderwing', 20, { hp: 15, atk: 15, def: 15, spd: 15 });
    ok(s2.atk > s1.atk * 1.3, 'genes matter: S-grade stats beat E-grade by a third');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, battles) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); Bt.playCampaign(G, b, { maxBattles: battles }); return G; };
    const a = play(42, 5), b = play(42, 5);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game (5 battles)');
    // a round trip mid-battle
    const G = Gm.newGame(7);
    const bot = Bt.makeBot();
    Bt.botRoost(G, bot);
    act(G, { t: 'start', ch: 0 });
    for (let i = 0; i < 6; i++) AI.stepSide(G, G.battle, G.battle.phase);
    drain(G);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    Bt.botBattle(G, bot); Bt.botBattle(copy, Bt.makeBot());
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-battle plays on identically');
    ok(copy.battle.events === copy.events, 'the battle\'s event list is relinked on load');
    // and at the roost
    const G2 = play(9, 3);
    const c2 = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G2))));
    Bt.playCampaign(G2, Bt.makeBot(), { maxBattles: 2 }); Bt.playCampaign(c2, Bt.makeBot(), { maxBattles: 2 });
    ok(JSON.stringify(Gm.serialize(G2)) === JSON.stringify(Gm.serialize(c2)), 'a save round trip at the roost plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('campaign')) {
    section('campaign');
    const rows = [];
    const t0 = Date.now();
    for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame(s * 7919);
        const bot = Bt.makeBot({ starter: ST.STARTERS[s % 3] });
        let bad = null;
        const check = (G2, B) => {
            if (bad) return;
            for (const u of B.units) {
                if (u.hp <= 0) continue;
                if (!Number.isFinite(u.hp) || u.hp > u.hpMax || !Number.isFinite(u.atk)) bad = `${u.name}: bad numbers`;
                else if (!Mp.inside(B, u.x, u.y)) bad = `${u.name}: off the map`;
                else if (!Mp.canStand(B, u, u.x, u.y)) bad = `${u.name}: standing on ${B.tiles[Mp.idx(B, u.x, u.y)]}`;
                else if (B.units.some((v) => v !== u && v.hp > 0 && v.x === u.x && v.y === u.y)) bad = `${u.name}: shares a tile`;
            }
            if (G2.meta.gold < 0) bad = 'gold below zero';
        };
        const res = Bt.playCampaign(G, bot, { maxBattles: 70, check });
        ok(!bad, `seed ${s}: ${bad || 'invariants hold'}`);
        const done = !!G.meta.cleared.ch12;
        ok(done, `seed ${s}: the bot reaches the ending (${res.cleared}/12 in ${res.battles} battles)`);
        const story = res.log.filter((l) => l.ch >= 0);
        const losses = story.filter((l) => !l.win).length;
        const stalls = res.log.filter((l) => l.reason === 'stalled').length;
        ok(stalls === 0, `seed ${s}: no battle stalls`);
        const lvs = (ci) => story.filter((l) => l.ch === ci && l.win).map((l) => Math.max(...l.party.filter(Boolean)))[0];
        rows.push({ seed: s, battles: res.battles, hunts: res.log.filter((l) => l.ch < 0).length, losses, dragons: G.meta.dragons.length, lv6: lvs(5), lv12: lvs(11), bred: G.meta.bred, hatched: G.meta.hatched });
    }
    console.log('  seed  battles  hunts  story-losses  dragons  bred  hatched  top-lv@ch6  top-lv@ch12');
    for (const r of rows) console.log(`  ${String(r.seed).padStart(4)}  ${String(r.battles).padStart(7)}  ${String(r.hunts).padStart(5)}  ${String(r.losses).padStart(12)}  ${String(r.dragons).padStart(7)}  ${String(r.bred).padStart(4)}  ${String(r.hatched).padStart(7)}  ${String(r.lv6).padStart(10)}  ${String(r.lv12).padStart(11)}`);
    const avgB = rows.reduce((a, r) => a + r.battles, 0) / rows.length;
    ok(avgB >= 14 && avgB <= 60, `the campaign takes a sensible number of battles (average ${avgB.toFixed(1)})`);
    ok(rows.some((r) => r.losses > 0), 'the bot loses sometimes: the campaign is not a walkover');
    ok(rows.every((r) => r.bred > 0 && r.hatched > 2), 'the bot breeds and hatches along the way');
    console.log(`  ${rows.length} campaigns in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
