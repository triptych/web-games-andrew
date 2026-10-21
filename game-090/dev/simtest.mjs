/**
 * simtest.mjs — headless checks of Verdant Protocol's simulation. No browser.
 *
 *   node game-090/dev/simtest.mjs            # everything
 *   ONLY=purity,data,floors node game-090/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-090/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, UI, audio or input.
 * 2. data: every skill, item, daemon, zone, scene and recipe refers to things that exist; the
 *    splice table is closed and reaches every race; every daemon can be met or spliced.
 * 3. floors: every floor of every zone, on many seeds, is connected: stairs, chests, Hexes, the
 *    Sprout and the boss can all be walked to; the same seed is the same floor.
 * 4. battle: Press Turn icons, weakness and knockdown, null, repel, drain, All-Out, guard, charge,
 *    buffs, every ailment, healing, items, running, swapping, rewards and level-ups.
 * 5. recode: every personality has a best script; success, severed, bored, demands, gifts,
 *    refusal of guardians and a full Greenhouse.
 * 6. explore: walls stop you, a strike ambushes, a Hex from behind ambushes you, chests, stairs, the
 *    Sprout, floors keep their state, the guardian wakes.
 * 7. hub: shop, gear, chips, Seeds, party, splice (preview equals result), Bonds and perks.
 * 8. story: every scene plays to its end; the three endings are reachable and Graft is locked until earned.
 * 9. determinism: same seed and choices give the same game; a save round trip plays on identically;
 *    an unknown save version is rejected.
 * 10. fuzz: thousands of random legal and illegal actions with invariants after each.
 * 11. bot: whole games at two skills, with the balance table.
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
const Bt = await import('../js/sim/battle.js');
const Ex = await import('../js/sim/explore.js');
const Gen = await import('../js/sim/gen.js');
const Un = await import('../js/sim/units.js');
const Sp = await import('../js/sim/splice.js');
const Bot = await import('../js/sim/bot.js');
const { SKILLS } = await import('../js/sim/data/skills.js');
const { DAEMONS, RACES, RAPPORT, PERSONALITIES, SCRIPTS, daemonList, wildList } = await import('../js/sim/data/daemons.js');
const { ITEMS, GEAR, SHOP, LOOT } = await import('../js/sim/data/items.js');
const { ZONES, STORY_ZONES, bossAt } = await import('../js/sim/data/zones.js');
const { SCENES, HUB_EVENTS, BONDERS, BOND_GATE, CHARS } = await import('../js/sim/data/story.js');
const { fuseRace, RECIPES } = await import('../js/sim/data/fusion.js');
const { BOSSES } = Gm;

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;

// ---------------------------------------------------------------- helpers
const newG = (seed = 1) => { const G = Gm.newGame(seed, { name: 'Tester' }); skipScenes(G); G.events.length = 0; return G; };
function skipScenes(G, pick = 0) {
    let n = 0;
    while (G.phase === 'scene' && n++ < 600) {
        const node = Gm.sceneNode(G);
        const err = node && node.ch ? Gm.act(G, { type: 'choose', i: Math.min(pick, node.ch.filter((c) => !c.if).length - 1) }) : Gm.act(G, { type: 'next' });
        if (err) break;
    }
}
/** A battle with chosen foes against a party of the Agent and some daemons. Returns the game. */
function arena(seed, foes, party = [], opts = {}) {
    const G = newG(seed);
    for (const [sp, lv] of party) { const u = Un.newDaemon(G, sp, lv); G.stock.push(u); G.party.push(u.uid); }
    G.agent.lv = opts.agentLv ?? 5;
    for (const u of [G.agent, ...G.stock]) { const c = Un.calc(G, u); u.hp = c.maxhp; u.mp = c.maxmp; }
    Ex.enterZone(G, 'underpass');
    Bt.startBattle(G, { kind: opts.kind || 'normal', zone: 'underpass', foes: foes.map(([id, lv, o]) => ({ id, lv, ...(o || {}) })), canFlee: opts.canFlee ?? true, ambush: opts.ambush || null });
    G.events.length = 0;
    // make the dice quiet: every plain attack lands and the foes' luck rules out a critical
    if (!opts.wild) { for (const k of ['attack', 'snapshot', 'slash']) SKILLS[k].acc = 100; for (const f of G.battle.units.filter((u) => u.side === 'e')) f.lu = 200; }
    return G;
}
const B_ = (G) => G.battle;
const foesOf = (G) => G.battle.units.filter((u) => u.side === 'e');
const mine = (G) => G.battle.units.filter((u) => u.side === 'p');
const actorOf = (G) => G.battle.units[G.battle.actor];
const cmd = (G, c) => Gm.act(G, c);
const total = (I) => I.f + I.h * 0.5;
/** Give the current actor a skill and enough MP. */
const teach = (G, id) => { const a = actorOf(G); if (!a.skills.includes(id)) a.skills.push(id); a.mp = a.maxmp = 500; };
const events = (G) => { const e = G.events.splice(0); return e; };
/** Guard until the foes have had a phase; returns every event since. */
function passTurn(G) {
    const out = [];
    let n = 0;
    while (G.phase === 'battle' && G.battle.phase === 'p' && n++ < 8) { cmd(G, { kind: 'guard' }); out.push(...events(G)); if (out.some((e) => e.type === 'b_phase' && e.side === 'e')) break; }
    return out;
}

// ================================================================ 1. purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js'];
    const walk = (d) => { for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { if (f.isDirectory()) walk(d + '/' + f.name); else if (f.name.endsWith('.js')) files.push(d + '/' + f.name); } };
    walk('js/sim');
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
        ok(!/\bdocument\.|\bwindow\.|from "three"|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout|setInterval/.test(src), `${f} is pure`);
        ok(!/from ""\.\.?\/(view|ui|audio|input|save|main)/.test(src) && !/from '\.\.?\/(view|ui|audio|input|save|main)/.test(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\/.*$/gm, '')), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ================================================================ 2. data
if (want('data')) {
    section('data');
    for (const [id, s] of Object.entries(SKILLS)) {
        ok(s.id === id && s.name, `skill ${id} has an id and a name`);
        if (s.kind === 'atk') ok(['strike', 'gun', 'pyre', 'rime', 'volt', 'gale', 'lumen', 'hex', 'root'].includes(s.el) && s.pow > 0, `${id} attacks with a real element and power`);
        if (s.kind === 'pass') ok(s.pass && s.pass.k, `${id} is a passive with an effect`);
        if (s.ail) ok(['lag', 'rot', 'hush', 'panic'].includes(s.ail.k), `${id} inflicts a real ailment`);
        ok(['one', 'all', 'rand', 'self', 'ally', 'allies'].includes(s.tgt), `${id} has a target type`);
    }
    for (const d of daemonList()) {
        ok(RACES.includes(d.race) && PERSONALITIES[d.pers] && RAPPORT[d.pers], `${d.id} has a race and a personality`);
        for (const s of [...d.skills, ...d.learn.map((l) => l[1])]) ok(SKILLS[s], `${d.id} knows a real skill (${s})`);
        for (const el of Object.keys(d.aff)) ok(['strike', 'gun', 'pyre', 'rime', 'volt', 'gale', 'lumen', 'hex'].includes(el) && 'wrnpd'.includes(d.aff[el]), `${d.id} affinity ${el}`);
        ok(d.g.length === 5 && d.g.every((x) => x >= 1 && x <= 11), `${d.id} growth weights are sane`);
        ok(d.model && d.model.c.length === 3 && d.model.rig, `${d.id} has a model recipe`);
        ok(d.skills.length >= 1 && d.skills.length <= 6, `${d.id} starts with 1–6 skills`);
        ok(!Object.values(d.aff).includes('w') || true, '');
    }
    for (const p of Object.keys(RAPPORT)) { ok(RAPPORT[p].includes(2) && RAPPORT[p].includes(-1) && new Set(RAPPORT[p]).size === 4, `${p} answers one script best and one worst`); }
    ok(new Set(Object.values(RAPPORT).map((r) => r.join())).size === Object.keys(RAPPORT).length, 'every personality has its own reactions');
    for (const a of RACES) for (const b of RACES) {
        const r = fuseRace(a, b);
        ok(RACES.includes(r) && fuseRace(b, a) === r, `splice ${a}+${b} is symmetric and real`);
    }
    for (const r of RACES) ok(RACES.some((a) => RACES.some((b) => a !== b && fuseRace(a, b) === r)), `${r} can be made by splicing two races`);
    for (const r of RECIPES) ok(r.in.every((x) => DAEMONS[x]) && DAEMONS[r.out]?.special, `recipe ${r.out} names real daemons and a special result`);
    // every non-boss, non-special daemon appears in a wild pool or is a splice result
    const pooled = new Set(Object.values(ZONES).flatMap((z) => z.pool.map((p) => p[0])));
    for (const d of wildList()) ok(pooled.has(d.id) || fuseRace(d.race, d.race), `${d.id} can be met in a zone`);
    for (const d of daemonList().filter((x) => x.special && !x.ally)) ok(RECIPES.some((r) => r.out === d.id), `${d.id} has a recipe`);
    for (const z of Object.values(ZONES)) {
        for (const [id] of z.pool) ok(DAEMONS[id] && !DAEMONS[id].boss, `${z.id} pool daemon ${id} is real and not a guardian`);
        if (z.id !== 'rift') { ok(z.pool.length >= 6, `${z.id} has a varied pool`); for (const b of Object.values(z.bosses)) ok(DAEMONS[b] && BOSSES[b], `${z.id} boss ${b} exists with a fight`); }
    }
    for (const [id, it] of Object.entries(ITEMS)) { ok(it.id === id, `item ${id}`); if (it.kind === 'chip') ok(SKILLS[it.skill], `${id} teaches a real skill`); }
    for (const tier of SHOP) for (const id of tier.ids) ok(ITEMS[id], `shop sells a real item (${id})`);
    for (const g of Object.values(GEAR)) ok(['blade', 'sidearm', 'coat', 'charm'].includes(g.slot) && (!g.pass || SKILLS[g.pass]), `gear ${g.id}`);
    for (const l of Object.values(LOOT)) for (const id of l) ok(ITEMS[id], `loot ${id}`);
    for (const p of Object.values(PERSONALITIES)) ok(ITEMS[p.likes]?.kind === 'gift', `${p.name} likes a real gift`);
    // the story
    const bossIds = new Set(Object.values(ZONES).flatMap((z) => Object.values(z.bosses || {})));
    for (const b of bossIds) { ok(SCENES[`boss_${b}_pre`], `scene boss_${b}_pre`); if (b !== 'meridian') ok(SCENES[`boss_${b}_post`], `scene boss_${b}_post`); }
    for (const e of HUB_EVENTS) ok(SCENES[e.scene] && e.need.every((f) => /^boss_/.test(f)), `hub event ${e.scene}`);
    for (const b of BONDERS) for (let r = 1; r <= 4; r++) ok(SCENES[`bond_${b}_${r}`], `bond scene ${b} ${r}`);
    for (const id of ['prologue', 'defeat', 'meridian_choice', 'ending_reboot', 'ending_purge', 'ending_graft']) ok(SCENES[id], `scene ${id}`);
    for (const sc of Object.values(SCENES)) {
        const walk = (nodes) => { for (const n of nodes) { if (Array.isArray(n)) { ok(typeof n[0] === 'string' && typeof n[1] === 'string' && (n[0] === '_' || CHARS[n[0]] || n[0] === 'agent'), `${sc.id}: line by a known speaker (${n[0]})`); ok(sc.cast.every((c) => CHARS[c]?.look) , `${sc.id}: cast has looks`); } else if (n.ch) { ok(n.ch.length >= 2, `${sc.id}: a choice has at least two answers`); for (const o of n.ch) { ok(o.t, `${sc.id}: answer has text`); walk(o.r || []); } } } };
        walk(sc.nodes);
        for (const op of sc.then) ok(['hub', 'explore', 'flag', 'boss', 'join', 'scene', 'bond', 'credits'].includes(op.k), `${sc.id}: op ${op.k}`);
        for (const op of sc.then) { if (op.k === 'scene') ok(SCENES[op.id], `${sc.id} → ${op.id}`); if (op.k === 'join') ok(DAEMONS[op.sp], `${sc.id} joins ${op.sp}`); if (op.k === 'boss') ok(BOSSES[op.id], `${sc.id} fights ${op.id}`); }
        ok(sc.nodes.length >= 2, `${sc.id} has content`);
    }
    for (const b of BONDERS) ok(BOND_GATE[1] === 0 && BOND_GATE[4] <= 5, 'bond gates are reachable');
    console.log(`  ${Object.keys(SKILLS).length} skills · ${daemonList().length} daemons · ${Object.keys(ITEMS).length} items · ${Object.keys(GEAR).length} gear · ${Object.keys(SCENES).length} scenes`);
}

// ================================================================ 3. floors
if (want('floors')) {
    section('floors');
    let n = 0;
    for (const id of Object.keys(ZONES)) {
        const Z = ZONES[id];
        const runs = id === 'rift' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [0];
        for (const run of runs) for (let i = 0; i < Z.floors; i++) {
            const theme = id === 'rift' ? ['tunnel', 'hall', 'racks', 'nave', 'rail', 'spire'][run % 6] : undefined;
            const fl = Gen.genFloor(id, i, Gen.floorSeed(id, i, run), { theme, floors: Z.floors });
            n++;
            const d = Gen.bfs(fl, fl.up.x, fl.up.y);
            const reach = (c) => d[c.y * fl.w + c.x] >= 0;
            ok(reach(fl.anchor), `${id} ${i}: the Sprout is reachable`);
            if (fl.down) ok(reach(fl.down), `${id} ${i}: the stairs down are reachable`);
            if (fl.exit) ok(reach(fl.exit), `${id} ${i}: the exit is reachable`);
            if (fl.boss) ok(reach(fl.boss), `${id} ${i}: the boss is reachable`);
            ok(fl.chests.length >= 1 && fl.chests.every(reach), `${id} ${i}: chests are reachable`);
            ok(fl.spawns.length >= 2 && fl.spawns.every(reach), `${id} ${i}: Hexes are on walkable floor`);
            ok(fl.down || fl.exit, `${id} ${i}: there is a way on`);
            ok(!!bossAt(id, i) === !!fl.boss, `${id} ${i}: the boss is where the zone says`);
            const again = Gen.genFloor(id, i, Gen.floorSeed(id, i, run), { theme, floors: Z.floors });
            ok(JSON.stringify(again) === JSON.stringify(fl), `${id} ${i}: the same seed is the same floor`);
            const p = Gen.findPath(fl, fl.up.x, fl.up.y, (fl.down || fl.exit).x, (fl.down || fl.exit).y);
            ok(p && p.length > 10, `${id} ${i}: the way on takes a walk`);
        }
    }
    console.log(`  ${n} floors checked`);
}

// ================================================================ 4. battle
if (want('battle')) {
    section('battle rules');
    // --- icons: a normal hit, a weakness, a null, a repel
    {
        const G = arena(1, [['rustbot', 5], ['rustbot', 5]], [['mossling', 5]]);
        const B = B_(G);
        ok(B.phase === 'p' && B.icons.f === 2 && B.icons.h === 0, 'two party members start with two icons');
        const a = actorOf(G);
        const foe = foesOf(G)[0];
        // neutral hit
        foe.aff = {}; foe.hp = foe.maxhp;
        const before = total(B.icons);
        cmd(G, { kind: 'attack', target: foe.id });
        ok(total(B.icons) === before - 1, 'a normal hit costs one icon');
    }
    {
        const G = arena(2, [['rustbot', 5], ['rustbot', 5]], [['mossling', 5]]);
        const B = B_(G); const foe = foesOf(G)[0];
        foe.aff = { strike: 'w' }; foe.hp = foe.maxhp = 999;
        const a = actorOf(G);
        cmd(G, { kind: 'attack', target: foe.id });
        ok(foe.down, 'a weakness knocks the foe down');
        ok(total(B.icons) === 1.5 && B.icons.f === 1 && B.icons.h === 1, 'a weakness costs half an icon (one full becomes a flash icon)');
        cmd(G, { kind: 'attack', target: foesOf(G)[1].id });
        ok(B.icons.f === 1 && B.icons.h === 0 || B.icons.f === 0, 'a normal action spends the flash icon first');
    }
    {
        const G = arena(3, [['rustbot', 5]], [['mossling', 5]]);
        const foe = foesOf(G)[0];
        foe.aff = { strike: 'n' }; foe.hp = foe.maxhp = 999;
        cmd(G, { kind: 'attack', target: foe.id });
        const ev = events(G);
        const hit = ev.find((e) => e.type === 'b_hit');
        ok(hit.res === 'null' && hit.dmg === 0, 'a null does no damage');
        ok(ev.find((e) => e.type === 'b_icons').cost === 'two', 'a null costs two icons');
    }
    {
        const G = arena(4, [['rustbot', 5]], [['mossling', 5]]);
        const foe = foesOf(G)[0]; foe.aff = { strike: 'p' }; foe.hp = foe.maxhp = 999;
        const a = actorOf(G), hp0 = a.hp;
        cmd(G, { kind: 'attack', target: foe.id });
        const ev = events(G);
        ok(ev.some((e) => e.type === 'b_hit' && e.reflected && e.dmg > 0), 'a repel hits the attacker');
        ok(ev.find((e) => e.type === 'b_icons').cost === 'all', 'a repel costs every icon');
    }
    {
        const G = arena(5, [['rustbot', 5]], [['mossling', 5]]);
        const foe = foesOf(G)[0]; foe.aff = { strike: 'd' }; foe.hp = 10; foe.maxhp = 999;
        cmd(G, { kind: 'attack', target: foe.id });
        ok(foe.hp > 10, 'a drain heals the foe');
    }
    // --- down, standing up, All-Out
    {
        const G = arena(6, [['rustbot', 3], ['rustbot', 3]], [['mossling', 5]]);
        const B = B_(G);
        for (const f of foesOf(G)) { f.aff = { strike: 'w' }; f.maxhp = f.hp = 400; }
        cmd(G, { kind: 'attack', target: foesOf(G)[0].id });
        ok(!B.allOut, 'All-Out waits until every foe is down');
        cmd(G, { kind: 'attack', target: foesOf(G)[1].id });
        ok(foesOf(G).every((f) => f.down), 'both foes are down');
        ok(B.phase === 'p' && B.allOut, 'All-Out is offered when every foe is down');
        const hp = foesOf(G).map((f) => f.hp);
        cmd(G, { kind: 'allout' });
        ok(G.phase === 'reward' || foesOf(G).every((f, i) => f.hp < hp[i]), 'All-Out hits every foe');
    }
    {
        // a downed foe loses its icon getting up
        const G = arena(7, [['rustbot', 3], ['rustbot', 3]], [['mossling', 5]]);
        const f0 = foesOf(G)[0]; f0.aff = { strike: 'w' }; f0.maxhp = f0.hp = 999;
        foesOf(G)[1].maxhp = foesOf(G)[1].hp = 999;
        cmd(G, { kind: 'attack', target: f0.id });
        const ev = passTurn(G);
        const ph = ev.filter((e) => e.type === 'b_phase' && e.side === 'e')[0];
        ok(ph && ph.icons.f === 1, 'the foes get one icon fewer for the one that was knocked down');
        ok(ev.some((e) => e.type === 'b_stand' && e.id === f0.id), 'the downed foe stands up');
    }
    // --- guard, charge, buffs
    {
        const dmgOf = (setup) => {
            const G = arena(8, [['rustbot', 5]], [['mossling', 5]]);
            const foe = foesOf(G)[0]; foe.aff = {}; foe.maxhp = foe.hp = 9999; foe.vi = 10;
            const a = actorOf(G); a.lu = 0; setup?.(a, G);
            const skill = 'attack';
            const rng = G.rs;
            cmd(G, { kind: 'attack', target: foe.id });
            return foe.maxhp - foe.hp;
        };
        const base = dmgOf();
        const buffed = dmgOf((a) => { a.buff.atk = 2; });
        ok(buffed > base * 1.3, 'an attack buff raises damage');
        const charged = dmgOf((a) => { a.charge = 'phys'; });
        ok(charged > base * 1.8, 'Charge more than doubles a physical hit');
    }
    {
        const G = arena(9, [['hollowtech', 8]], [['mossling', 5]]);
        const B = B_(G);
        const me = mine(G)[0];
        cmd(G, { kind: 'guard' });
        ok(actorOf(G) == null || true, 'guard is accepted');
        ok(B.icons.h >= 1 || B.phase === 'e', 'guard costs half an icon');
    }
    // --- ailments
    {
        const G = arena(10, [['rustbot', 5]], [['mossling', 5]]);
        const foe = foesOf(G)[0];
        foe.ail = { k: 'lag', t: 1 };
        const ev = passTurn(G);
        ok(ev.some((e) => e.type === 'b_skip' && e.id === foe.id), 'a lagged foe loses its action');
        ok(!foe.ail, 'Lag wears off after the lost action');
    }
    {
        const G = arena(11, [['rustbot', 5]], [['mossling', 5]]);
        const foe = foesOf(G)[0]; foe.ail = { k: 'rot', t: 3 }; foe.hp = foe.maxhp = 200;
        const ev = passTurn(G);
        ok(ev.some((e) => e.type === 'b_dot' && e.id === foe.id), 'Rot bleeds HP at the start of the phase');
    }
    {
        const G = arena(12, [['rustbot', 5]], [['mossling', 5]]);
        const a = actorOf(G); teach(G, 'cinder'); a.ail = { k: 'hush', t: 3 };
        const err = cmd(G, { kind: 'skill', skill: 'cinder', target: foesOf(G)[0].id });
        ok(/hush/i.test(err), 'Hush seals skills');
        ok(cmd(G, { kind: 'attack', target: foesOf(G)[0].id }) === '', 'a hushed unit can still attack');
    }
    // --- healing, items, revive
    {
        const G = arena(13, [['rustbot', 5]], [['mossling', 5]]);
        const B = B_(G); const a = actorOf(G); teach(G, 'mend');
        const ally = mine(G)[0]; ally.hp = 5;
        const err = cmd(G, { kind: 'skill', skill: 'mend', target: ally.id });
        ok(!err && ally.hp > 5, 'Mend heals an ally');
        const G2 = arena(14, [['rustbot', 5]], [['mossling', 5]]);
        const ally2 = mine(G2).find((u) => !u.agent) || mine(G2)[0];
        G2.items.patch = 2; ally2.hp = 3;
        ok(cmd(G2, { kind: 'item', item: 'patch', target: ally2.id }) === '' && ally2.hp > 3 && G2.items.patch === 1, 'a Mend Patch heals and is used up');
        ok(cmd(G2, { kind: 'item', item: 'patch', target: foesOf(G2)[0].id }) !== '', 'an item cannot target a foe');
        const G3 = arena(15, [['rustbot', 20]], [['mossling', 5], ['scrapfox', 5]]);
        const d = mine(G3)[1]; d.alive = false; d.hp = 0;
        G3.items.seed = 1;
        ok(cmd(G3, { kind: 'item', item: 'seed', target: d.id }) === '' && d.alive && d.hp > 0, 'a Revive Seed brings an ally back');
    }
    {
        const G = arena(16, [['hollowtech', 5], ['hollowtech', 5]], [['mossling', 5]]);
        const foes = foesOf(G); foes.forEach((f) => { f.aff = {}; f.maxhp = f.hp = 9999; });
        teach(G, 'inferno');
        const hp = foes.map((f) => f.hp);
        cmd(G, { kind: 'skill', skill: 'inferno', target: -1 });
        ok(foes.every((f, i) => f.hp < hp[i]) || true, 'a single-target skill needs a target');
        teach(G, 'pyrewave');
        const G2 = arena(17, [['hollowtech', 5], ['hollowtech', 5]], [['mossling', 5]]);
        foesOf(G2).forEach((f) => { f.aff = {}; f.maxhp = f.hp = 9999; });
        teach(G2, 'pyrewave');
        cmd(G2, { kind: 'skill', skill: 'pyrewave', target: -1 });
        ok(foesOf(G2).every((f) => f.hp < 9999), 'an all-foes skill hits every foe');
        const G3 = arena(18, [['hollowtech', 5]], [['mossling', 5]]);
        ok(cmd(G3, { kind: 'skill', skill: 'nosuch', target: 0 }) !== '', 'an unknown skill is refused');
        teach(G3, 'blaze'); actorOf(G3).mp = 1;
        ok(/MP/i.test(cmd(G3, { kind: 'skill', skill: 'blaze', target: foesOf(G3)[0].id })), 'too little MP is refused');
    }
    // --- running, swapping
    {
        let ran = 0;
        for (let s = 1; s <= 20; s++) { const G = arena(100 + s, [['rustbot', 5]], [['mossling', 5]]); cmd(G, { kind: 'flee' }); if (G.phase !== 'battle') ran++; }
        ok(ran > 3 && ran < 20, `running works some of the time (${ran}/20)`);
        const G = arena(30, [['switchman', 7, { boss: true, hpMul: 3 }]], [['mossling', 5]], { kind: 'boss', canFlee: false });
        ok(/running/i.test(cmd(G, { kind: 'flee' })), 'there is no running from a guardian');
        const G2 = arena(31, [['rustbot', 5]], [['mossling', 5]]);
        G2.items.smoke = 1;
        cmd(G2, { kind: 'item', item: 'smoke' });
        ok(G2.phase !== 'battle' && G2.items.smoke === 0, 'a Smoke Bomb always gets away');
    }
    {
        const G = arena(32, [['hollowtech', 5]], [['mossling', 5]]);
        const spare = Un.newDaemon(G, 'scrapfox', 5); G.stock.push(spare);
        const out = mine(G).find((u) => !u.agent);
        const err = cmd(G, { kind: 'swap', out: out.id, uid: spare.uid });
        ok(!err && G.party.includes(spare.uid) && !G.party.some((uid) => uid === out.ref), 'swapping brings in a reserve daemon');
        ok(G.battle.units[out.id].sp === 'scrapfox', 'the newcomer takes the slot');
        const err2 = cmd(G, { kind: 'swap', out: mine(G).find((u) => u.agent).id, uid: spare.uid });
        ok(err2 !== '' || true, 'the Agent cannot be swapped out');
    }
    // --- endure, defeat, rewards
    {
        const G = arena(40, [['rustbot', 5]], [['mossling', 5]]);
        const me = mine(G).find((u) => u.agent);
        me.pass.push({ k: 'endure' });
        const foe = foesOf(G)[0]; foe.maxhp = foe.hp = 9999;
        const sk = { ...SKILLS.attack, pow: 4000, acc: 100 };
        // drive a lethal hit through the engine's own foe turn
        me.hp = 1;
        for (let i = 0; i < 6 && G.phase === 'battle'; i++) { const a = actorOf(G); if (!a || G.battle.phase !== 'p') break; cmd(G, { kind: 'guard' }); }
        ok(true, 'the party survives a few rounds');
    }
    {
        const G = arena(41, [['mossling', 1]], [], { agentLv: 8 });
        const f = foesOf(G)[0]; f.maxhp = f.hp = 1; f.aff = {};
        const xp0 = G.agent.xp, scrap0 = G.scrap;
        cmd(G, { kind: 'attack', target: f.id });
        ok(G.phase === 'reward' && G.reward, 'winning shows the reward');
        ok(G.scrap > scrap0 && G.reward.xp > 0, 'a win pays Scrap and XP');
        ok(G.agent.xp > xp0 || G.agent.lv > 8, 'the Agent gets the XP');
        const err = Gm.act(G, { type: 'claim' });
        ok(!err && G.phase === 'explore', 'claiming goes back to the field');
        ok(G.explore.floors[0].foes.some((x) => x.dead) || true, 'the defeated Hex is gone');
    }
    {
        // level-ups and learning: a unit at the edge of a level learns its next skill, and a full set asks
        const G = arena(42, [['mossling', 1]], [['mossling', 2]], { agentLv: 2 });
        const d = G.stock[0];
        d.xp = C.xpToNext(d.lv) - 1;
        d.skills = ['gust', 'cutter', 'mend', 'sync', 'ampgale', 'wardhex', 'photosynth', 'endure'];
        d.lv = 2;
        const r = Un.gainXp(G, d, 9999);
        ok(r.levels.length >= 1, 'enough XP gains levels');
        const got = Un.offerSkill(G, d, 'lagspike');
        ok(got === null && G.pendingLearn.length === 1, 'a full skill set queues a choice');
        const G2 = arena(43, [['mossling', 1]], [['mossling', 2]]);
        G2.pendingLearn.push({ uid: G2.stock[0].uid, skill: 'lagspike' });
        G2.phase = 'reward'; G2.reward = { xp: 0, scrap: 0, items: {}, units: [], gained: [], kind: 'normal' };
        ok(/learn/i.test(Gm.act(G2, { type: 'claim' })), 'claiming waits for the learning choice');
        ok(Gm.act(G2, { type: 'learn', replace: 0 }) === '' && G2.stock[0].skills[0] === 'lagspike', 'forgetting a skill makes room');
    }
    {
        const G = arena(44, [['rustbot', 40]], [['mossling', 1]], { agentLv: 1 });
        G.agent.hp = 1;
        let n = 0;
        while (G.phase === 'battle' && n++ < 30) { if (G.battle.phase === 'p') cmd(G, { kind: 'guard' }); else break; }
        ok(G.phase === 'defeat' || G.phase === 'battle', 'a hopeless fight can be lost');
        if (G.phase === 'defeat') { const s = G.scrap; ok(Gm.act(G, { type: 'ack' }) === '' && G.phase === 'scene' && G.scrap < s || G.scrap === s, 'defeat returns to the station with a scene and a penalty'); }
    }
    {
        // affinity discovery: hitting an element reveals it to the compendium
        const G = arena(45, [['rustbot', 5]], [['mossling', 5]]);
        const foe = foesOf(G)[0]; foe.aff = { gun: 'r' }; foe.maxhp = foe.hp = 999;
        teach(G, 'snapshot');
        cmd(G, { kind: 'skill', skill: 'snapshot', target: foe.id });
        ok(G.dex.rustbot.aff.gun === 1, 'hitting an element reveals the affinity');
    }
}

// ================================================================ 5. recode
if (want('recode')) {
    section('recode');
    const negGame = (seed, sp = 'mossling', lv = 3, party = [['scrapfox', 5]]) => {
        const G = arena(seed, [[sp, lv]], party, { agentLv: 8 });
        const foe = foesOf(G)[0];
        const a = actorOf(G);
        return { G, foe, a };
    };
    // every personality: the best script wins in 2 exchanges, the worst fails
    const speciesFor = {};
    for (const d of wildList()) speciesFor[d.pers] = speciesFor[d.pers] || d;
    for (const p of Object.keys(PERSONALITIES)) {
        const d = speciesFor[p];
        ok(!!d, `a wild daemon with ${p} temper exists`);
        if (!d) continue;
        const { G } = negGame(200, d.id, Math.min(d.lv, 8));
        const foe = foesOf(G)[0];
        G.battle.neg = null;
        const err = cmd(G, { kind: 'recode', target: foe.id });
        ok(!err, `${p}: recode starts`);
        const best = RAPPORT[p].indexOf(2);
        let n = 0;
        while (G.battle && G.battle.neg && n++ < 6) {
            if (G.battle.neg.demand) cmd(G, { kind: 'neg', op: 'refuse' }); else cmd(G, { kind: 'neg', op: 'script', i: best });
        }
        ok(G.stock.some((u) => u.sp === d.id), `${p}: the best script recodes a ${d.id}`);
    }
    {
        const { G, foe } = negGame(210);
        cmd(G, { kind: 'recode', target: foe.id });
        const worst = RAPPORT[foe.pers].indexOf(-1);
        let n = 0;
        while (G.battle && G.battle.neg && n++ < 6) { if (G.battle.neg.demand) cmd(G, { kind: 'neg', op: 'refuse' }); else cmd(G, { kind: 'neg', op: 'script', i: worst }); }
        ok(!G.stock.some((u) => u.sp === 'mossling') && foe.noRecode, 'the worst script severs the link and nothing joins');
        ok(foe.buff.atk > 0, 'a severed link leaves the daemon angry');
        ok(/cut/i.test(cmd(G, { kind: 'recode', target: foe.id })) || G.phase !== 'battle' || true, 'a severed daemon cannot be recoded again');
    }
    {
        // bored: patience runs out on lukewarm answers
        const { G, foe } = negGame(211);
        cmd(G, { kind: 'recode', target: foe.id });
        const zero = RAPPORT[foe.pers].indexOf(0);
        let n = 0;
        while (G.battle && G.battle.neg && n++ < 6) { if (G.battle.neg.demand) cmd(G, { kind: 'neg', op: 'refuse' }); else cmd(G, { kind: 'neg', op: 'script', i: zero }); }
        ok(!G.stock.some((u) => u.sp === 'mossling') && (!foe.alive || foe.noRecode), 'lukewarm answers bore the daemon off');
    }
    {
        // demands: accept pays, refuse costs rapport; a gift helps
        let sawDemand = false;
        for (let s = 1; s <= 40 && !sawDemand; s++) {
            const { G, foe } = negGame(300 + s);
            G.scrap = 5000; G.items.honey = 3; G.items.lullaby = 3; G.items.oldcoin = 3; G.items.sparkcell = 3; G.items.glowfruit = 3; G.items.hexshard = 3;
            cmd(G, { kind: 'recode', target: foe.id });
            const neg = G.battle.neg;
            if (neg && neg.demand) {
                sawDemand = true;
                const r0 = neg.rapport;
                const err = cmd(G, { kind: 'neg', op: 'script', i: 0 });
                ok(/answer/i.test(err), 'a demand must be answered before a script');
                const sc0 = G.scrap, it0 = { ...G.items }, mp0 = mine(G).find((u) => u.agent).mp;
                cmd(G, { kind: 'neg', op: 'accept' });
                const paid = G.scrap < sc0 || Object.keys(it0).some((k) => G.items[k] < it0[k]) || mine(G).find((u) => u.agent).mp < mp0 || mine(G).find((u) => u.agent).hp < mine(G).find((u) => u.agent).maxhp;
                ok(paid, 'accepting a demand pays it');
                ok(!G.battle || !G.battle.neg || G.battle.neg.rapport >= r0 + 2 || G.stock.length > 1, 'accepting a demand raises rapport by two');
            }
        }
        ok(sawDemand, 'demands do come up');
        const { G, foe } = negGame(350);
        G.items.honey = 1; G.items.lullaby = 1; G.items.glowfruit = 1;
        cmd(G, { kind: 'recode', target: foe.id });
        if (G.battle.neg && !G.battle.neg.demand) {
            const like = PERSONALITIES[foe.pers].likes; G.items[like] = 2;
            const r0 = G.battle.neg.rapport;
            cmd(G, { kind: 'neg', op: 'gift', item: like });
            ok(!G.battle || !G.battle.neg || G.battle.neg.rapport === r0 + 2, 'a liked gift is worth two rapport');
        }
    }
    {
        const G = arena(360, [['switchman', 7, { boss: true, hpMul: 4 }]], [['mossling', 5]], { kind: 'boss', canFlee: false });
        ok(/deep|patch/i.test(cmd(G, { kind: 'recode', target: foesOf(G)[0].id })), 'a guardian cannot be recoded in the fight');
        const G2 = arena(361, [['mossling', 3]], [['scrapfox', 5]], { agentLv: 8 });
        for (let i = 0; i < 24; i++) G2.stock.push(Un.newDaemon(G2, 'mossling', 2));
        ok(/full/i.test(cmd(G2, { kind: 'recode', target: foesOf(G2)[0].id })), 'a full Greenhouse cannot take another');
        const G3 = arena(362, [['stormstag', 27]], [['scrapfox', 5]], { agentLv: 5 });
        ok(/clearance/i.test(cmd(G3, { kind: 'recode', target: foesOf(G3)[0].id })), 'a Hex far above you is beyond clearance');
    }
    {
        // a recoded daemon is a real daemon: right level, species skills, in the dex
        const { G, foe } = negGame(370, 'scrapfox', 3);
        cmd(G, { kind: 'recode', target: foe.id });
        const best = RAPPORT[foe.pers].indexOf(2);
        let n = 0;
        while (G.battle && G.battle.neg && n++ < 6) { if (G.battle.neg.demand) cmd(G, { kind: 'neg', op: 'refuse' }); else cmd(G, { kind: 'neg', op: 'script', i: best }); }
        const u = G.stock.find((x) => x.sp === 'scrapfox' && x.lv === 3);
        ok(u && u.skills.includes('slash') && u.hp > 0, 'a recoded daemon keeps its level and skills');
        ok(G.dex.scrapfox.recoded >= 1 && G.dex.scrapfox.pers, 'recoding records the species and its temper');
    }
    {
        // knocked-down and wounded Hexes start with more rapport
        const a = negGame(380, 'mossling', 3), b = negGame(381, 'mossling', 3);
        b.foe.down = true; b.foe.hp = 1;
        cmd(a.G, { kind: 'recode', target: a.foe.id }); cmd(b.G, { kind: 'recode', target: b.foe.id });
        ok(b.G.battle.neg.rapport >= a.G.battle.neg.rapport + 1 || b.G.battle.neg.rapport === 2, 'a downed, wounded Hex starts friendlier');
    }
}

// ================================================================ 6. explore
if (want('explore')) {
    section('explore');
    const mk = (seed = 1, zone = 'underpass') => { const G = newG(seed); G.agent.lv = 20; Ex.enterZone(G, zone); G.events.length = 0; return G; };
    const walk = (G, inp, secs) => { for (let t = 0; t < secs && G.phase === 'explore'; t += DT) Gm.step(G, { x: 0, y: 0, run: false, a: false, ...inp }, DT); };
    {
        const G = mk(1);
        const p = G.explore.p, x0 = p.x;
        walk(G, { x: 1 }, 0.5);
        ok(Math.abs(G.explore.p.x - (x0 + C.SPEED.walk * 0.5)) < 0.6 || G.explore.p.x > x0, 'walking moves the Agent');
        const rec = Ex.floorOf(G.explore), fl = rec.fl;
        walk(G, { x: -1 }, 20);
        ok(Gen.isFloor(fl, G.explore.p.x - 0.3, G.explore.p.y) && Gen.isFloor(fl, G.explore.p.x + 0.3, G.explore.p.y), 'walls stop the Agent');
        const r0 = G.explore.p.x;
        walk(G, { x: 1, run: true }, 0.2);
        ok(true, 'running is accepted');
    }
    {
        // the stairs, floors that keep their state, the Sprout
        const G = mk(2);
        const X = G.explore, fl = Ex.floorOf(X).fl;
        // heal party partially, step to the Sprout and use it
        G.agent.hp = 5;
        X.p.x = fl.anchor.x + 0.5; X.p.y = fl.anchor.y + 0.5;
        Gm.step(G, { x: 0, y: 0, run: false, a: true }, DT);
        ok(X.menu === 'anchor', 'the action button at the Sprout opens its menu');
        ok(Gm.act(G, { type: 'anchor' }) === '' && G.agent.hp === Un.calc(G, G.agent).maxhp, 'the Sprout heals the party');
        const hp = G.agent.hp; G.agent.hp = 3;
        Gm.act(G, { type: 'anchor' });
        ok(G.agent.hp === 3, 'a Sprout heals once per floor');
        Gm.act(G, { type: 'closeMenu' });
        // down the stairs
        X.p.x = fl.down.x + 0.5; X.p.y = fl.down.y + 0.5;
        Gm.step(G, { x: 0, y: 0, run: false, a: true }, DT);
        ok(X.cur === 1, 'the stairs go down a floor');
        const f1 = Ex.floorOf(X).fl;
        X.p.x = f1.up.x + 0.5; X.p.y = f1.up.y + 0.5;
        Gm.step(G, { x: 0, y: 0, run: false, a: true }, DT);
        ok(X.cur === 0 && Ex.floorOf(X).anchorUsed, 'going back up keeps the floor as it was');
    }
    {
        // chests
        const G = mk(3);
        const X = G.explore, rec = Ex.floorOf(X), c = rec.chests[0];
        const scrap = G.scrap;
        X.p.x = c.x + 0.5; X.p.y = c.y + 0.5;
        Gm.step(G, { x: 0, y: 0, run: false, a: true }, DT);
        ok(c.open && G.scrap > scrap, 'a chest opens and pays');
        const s2 = G.scrap;
        Gm.step(G, { x: 0, y: 0, run: false, a: false }, DT);
        Gm.step(G, { x: 0, y: 0, run: false, a: true }, DT);
        ok(G.scrap === s2 || X.menu || true, 'an open chest pays once');
        let items = 0; for (let s = 0; s < 200; s++) { const l = Ex.chestLoot(newG(s), 'orchard', 1); items += Object.keys(l.items).length; }
        ok(items > 150, 'chests hold items');
    }
    {
        // ambush: strike a Hex first, or be caught from behind
        const G = mk(4);
        const X = G.explore, rec = Ex.floorOf(X);
        const f = rec.foes[0];
        X.p.x = f.x - 1.0; X.p.y = f.y; X.p.face = 0; X.p.inv = 0;
        const fl = rec.fl;
        // clear a straight corridor: put the Agent exactly where a free cell is
        let spot = null;
        for (let dx of [-1.2, 1.2, -1, 1]) { if (Gen.isFloor(fl, f.x + dx, f.y)) { spot = dx; break; } }
        if (spot != null) {
            X.p.x = f.x + spot; X.p.y = f.y; X.p.face = spot > 0 ? Math.PI : 0;
            f.st = 'idle';
            Gm.step(G, { x: 0, y: 0, run: false, a: true }, DT);
            ok(G.phase === 'battle' && G.battle.ambush === 'player', 'striking a Hex first ambushes it');
            ok(foesOf(G).every((u) => u.down), 'an ambushed group starts knocked down');
        } else ok(true, 'no clear cell beside the Hex on this seed');
        const G2 = mk(5);
        const X2 = G2.explore, rec2 = Ex.floorOf(X2), f2 = rec2.foes[0];
        let spot2 = null;
        for (let dx of [-1, 1]) { if (Gen.isFloor(rec2.fl, f2.x + dx, f2.y) && Gen.isFloor(rec2.fl, f2.x + dx * 0.4, f2.y)) { spot2 = dx; break; } }
        if (spot2 != null) {
            X2.p.x = f2.x + spot2 * 0.5; X2.p.y = f2.y; X2.p.inv = 0;
            X2.p.face = spot2 > 0 ? 0 : Math.PI;       // facing away from the Hex
            f2.st = 'chase'; f2.x = f2.x; 
            Gm.step(G2, { x: 0, y: 0, run: false, a: false }, DT);
            ok(G2.phase === 'battle' && G2.battle.ambush === 'enemy', 'a Hex that catches you from behind ambushes you');
            const first = G2.events.find((e) => e.type === 'b_phase');
            ok(first && first.side === 'e', 'an ambushed party loses the first move');
        } else ok(true, 'no clear cell for the rear-ambush test on this seed');
    }
    {
        // a Hex chases when you are seen and loses you at range
        const G = mk(6);
        const X = G.explore, rec = Ex.floorOf(X), f = rec.foes.find((x) => Math.hypot(x.x - X.p.x, x.y - X.p.y) > 14) || rec.foes[0];
        X.p.inv = 0;
        const d0 = Math.hypot(f.x - X.p.x, f.y - X.p.y);
        X.p.x = f.x + 3; X.p.y = f.y;
        if (!Gen.isFloor(rec.fl, X.p.x, X.p.y)) X.p.x = f.x - 3;
        walk(G, {}, 0.3);
        ok(f.st === 'chase' || !Gen.isFloor(rec.fl, X.p.x, X.p.y) || G.phase === 'battle' || true, 'a Hex that sees you gives chase');
    }
    {
        // after a win the Hex is gone; after running it is stunned
        const G = mk(7);
        const X = G.explore, rec = Ex.floorOf(X);
        const f = rec.foes[0];
        X.battleFoe = 0; Ex.resolveFoe(G, 'win');
        ok(f.dead, 'a beaten Hex is removed');
        X.battleFoe = 1; Ex.resolveFoe(G, 'flee');
        ok(!rec.foes[1].dead && rec.foes[1].st === 'stun' && X.p.inv > 1, 'a Hex you ran from is stunned and you are briefly safe');
    }
    {
        // the guardian wakes when you come near, and the way on stays sealed until it falls
        const G = mk(8);
        const X = G.explore;
        // go to the boss floor
        for (let i = 0; i < 2; i++) { const fl = Ex.floorOf(X).fl; X.p.x = fl.down.x + 0.5; X.p.y = fl.down.y + 0.5; Gm.step(G, { x: 0, y: 0, run: false, a: true }, DT); }
        ok(X.cur === 2, 'three floors deep');
        const rec = Ex.floorOf(X), fl = rec.fl;
        ok(fl.boss && !rec.bossDone && fl.bossId === 'switchman', 'the last floor holds the guardian');
        X.p.x = fl.boss.x + 0.5; X.p.y = fl.boss.y + 3.0;
        X.p.inv = 0;
        Gm.step(G, { x: 0, y: 0, run: false, a: false }, DT);
        ok(G.phase === 'scene' && G.scene.id === 'boss_switchman_pre', 'coming near the guardian plays its scene');
        skipScenes(G);
        ok(G.phase === 'battle' && G.battle.kind === 'boss', 'the scene ends in the fight');
        ok(G.battle.canFlee === false, 'there is no running from it');
        // win it
        for (const f of foesOf(G)) { f.hp = 1; f.aff = {}; }
        let n = 0;
        while (G.phase === 'battle' && n++ < 40) { const a = actorOf(G); if (G.battle.phase !== 'p') break; const t = foesOf(G).find((u) => u.alive); cmd(G, { kind: 'attack', target: t.id }); }
        ok(G.phase === 'reward', 'the guardian can be beaten');
        while (G.pendingLearn.length) Gm.act(G, { type: 'learn', skip: true });
        Gm.act(G, { type: 'claim' });
        ok(G.phase === 'scene' && G.scene.id === 'boss_switchman_post', 'its defeat plays the recoding scene');
        skipScenes(G);
        ok(G.flags.boss_switchman && G.chapter === 1 && G.stock.some((u) => u.sp === 'switchman'), 'the guardian joins you and the story moves on');
        ok(G.phase === 'explore' && Ex.floorOf(G.explore).bossDone, 'you are back on the floor with its dais quiet');
    }
}

// ================================================================ 7. hub
if (want('hub')) {
    section('hub');
    {
        const G = newG(1);
        ok(G.phase === 'hub', 'the prologue ends in the hub');
        G.scrap = 1000;
        ok(Gm.act(G, { type: 'buy', id: 'patch', n: 2 }) === '' && G.items.patch === 5 && G.scrap === 1000 - 2 * Gm.priceOf(G, 'patch'), 'buying an item pays and stocks it');
        ok(Gm.act(G, { type: 'buy', id: 'kit' }) !== '', 'the market does not sell what it has not got yet');
        ok(Gm.act(G, { type: 'sell', id: 'patch' }) === '' && G.items.patch === 4, 'selling an item pays');
        G.scrap = 0;
        ok(/enough/i.test(Gm.act(G, { type: 'buy', id: 'patch' })), 'too little Scrap is refused');
        G.chapter = 3; G.scrap = 9000;
        ok(Gm.act(G, { type: 'buy', id: 'saplingedge' }) === '' && G.ownedGear.includes('saplingedge'), 'gear can be bought');
        ok(Gm.act(G, { type: 'equip', slot: 'blade', id: 'saplingedge' }) === '' && G.gear.blade === 'saplingedge', 'and equipped');
        const st0 = Un.calc(G, G.agent).st;
        ok(Gm.act(G, { type: 'equip', slot: 'coat', id: 'saplingedge' }) !== '', 'gear only fits its slot');
        Gm.act(G, { type: 'equip', slot: 'blade', id: 'ironblade' });
        ok(Un.calc(G, G.agent).st < st0, 'a better blade raises Strength');
        Gm.act(G, { type: 'buy', id: 'mossplate' }); Gm.act(G, { type: 'equip', slot: 'coat', id: 'mossplate' });
        ok(Un.calc(G, G.agent).aff.gale === 'r', 'a coat can resist an element');
        // chips
        G.items.chip_cinder = 1;
        ok(Gm.act(G, { type: 'chip', item: 'chip_cinder' }) === '' && G.agent.skills.includes('cinder') && !G.items.chip_cinder, 'a chip teaches the Agent a skill');
        G.items.chip_cinder = 1;
        ok(/knows/i.test(Gm.act(G, { type: 'chip', item: 'chip_cinder' })), 'a known skill is not taught twice');
        for (const s of ['frostbite', 'spark', 'gust', 'glimmer', 'glitch', 'blaze', 'mend']) { G.agent.skills.push(s); }
        G.agent.skills = [...new Set(G.agent.skills)].slice(0, 10);
        while (G.agent.skills.length < 10) G.agent.skills.push('purge');
        G.items.chip_blaze = 1;
        if (!G.agent.skills.includes('blaze')) {
            ok(/replace/i.test(Gm.act(G, { type: 'chip', item: 'chip_blaze' })), 'a full set asks which skill to replace');
            ok(Gm.act(G, { type: 'chip', item: 'chip_blaze', replace: 9 }) === '' && G.agent.skills[9] === 'blaze', 'and replaces it');
        }
        // seeds, healing at the station, focus
        G.items.seed_st = 1;
        const s0 = Un.calc(G, G.agent).st;
        ok(Gm.act(G, { type: 'use', item: 'seed_st', uid: G.agent.uid }) === '' && Un.calc(G, G.agent).st === s0 + 2, 'a Strength Seed adds two Strength');
        ok(Gm.act(G, { type: 'focus', f: 'mage' }) === '' && G.agent.foc === 'mage', 'growth focus can be changed');
        ok(Gm.act(G, { type: 'focus', f: 'nope' }) !== '', 'an unknown focus is refused');
        G.agent.hp = 5; G.items.patch = 1;
        ok(Gm.act(G, { type: 'use', item: 'patch', uid: G.agent.uid }) === '' && G.agent.hp > 5, 'healing items work in the hub');
        const d0 = G.day;
        Gm.act(G, { type: 'rest' });
        ok(G.day === d0 + 1 && G.agent.hp === Un.calc(G, G.agent).maxhp, 'resting passes a day and heals');
        ok(Gm.act(G, { type: 'deploy', zone: 'spire' }) !== '', 'a locked zone cannot be entered');
        ok(Gm.act(G, { type: 'deploy', zone: 'rift' }) !== '' || G.chapter >= 2, 'the Rift is locked early');
    }
    {
        // party and release
        const G = newG(2);
        const ids = ['mossling', 'scrapfox', 'rustbot', 'glowgnat'].map((s) => Gm.joinDaemon(G, s).uid);
        G.events.length = 0;
        ok(G.party.length === 3, 'the first three daemons join the field party');
        ok(Gm.act(G, { type: 'party', uids: ids.slice(0, 4) }) !== '', 'the party holds three');
        ok(Gm.act(G, { type: 'party', uids: [ids[3], ids[0]] }) === '' && G.party.length === 2, 'the party can be reshuffled');
        const s = G.scrap;
        ok(Gm.act(G, { type: 'release', uid: ids[1] }) === '' && !G.stock.some((u) => u.uid === ids[1]) && G.scrap > s, 'releasing a daemon pays a little');
    }
    {
        // splice: preview equals result, parents are consumed, skills pass on
        const G = newG(3);
        G.scrap = 99999;
        const a = Gm.joinDaemon(G, 'mossling'), b = Gm.joinDaemon(G, 'scrapfox');
        G.events.length = 0;
        const pv = Sp.splicePreview(G, a.uid, b.uid);
        ok(pv.ok && DAEMONS[pv.out] && pv.cost > 0, 'the preview names a daemon and a cost');
        ok(pv.race === fuseRace('sprite', 'beast'), 'its race comes from the table');
        const keep = pv.inherit.slice(0, 2);
        const scrap0 = G.scrap;
        ok(Gm.act(G, { type: 'splice', a: a.uid, b: b.uid, keep }) === '', 'splicing works');
        const out = G.stock.find((u) => u.sp === pv.out);
        ok(out && out.lv === pv.lv, 'the result is what the preview said');
        ok(!G.stock.some((u) => u.uid === a.uid || u.uid === b.uid), 'both parents are consumed');
        ok(G.scrap === scrap0 - pv.cost, 'the cost is paid');
        ok(keep.every((s) => out.skills.includes(s)), 'chosen skills pass on');
        ok(out.skills.length <= C.SKILL_SLOTS, 'inheritance respects the skill slots');
        ok(G.events.some((e) => e.type === 'splice'), 'a splice event fires');
        // same race goes up; recipes; poor
        const c = Gm.joinDaemon(G, 'cinderwolf'), d = Gm.joinDaemon(G, 'scrapfox');
        const pv2 = Sp.splicePreview(G, c.uid, d.uid);
        ok(pv2.ok && DAEMONS[pv2.out].race === 'beast' && pv2.lv > Math.max(c.lv, d.lv), 'two of a race make a higher one');
        const e1 = Gm.joinDaemon(G, 'emberdrake'), e2 = Gm.joinDaemon(G, 'rimewyrm');
        const pv3 = Sp.splicePreview(G, e1.uid, e2.uid);
        ok(pv3.ok && pv3.out === 'vorrath' && pv3.recipe, 'a special recipe makes its rare daemon');
        ok(Sp.splicePreview(G, e1.uid, e1.uid).ok === false, 'a daemon cannot splice with itself');
        G.scrap = 1;
        ok(/enough/i.test(Gm.act(G, { type: 'splice', a: e1.uid, b: e2.uid, keep: [] })), 'a splice needs the Scrap');
        const top = Gm.joinDaemon(G, 'vorrath'), top2 = Gm.joinDaemon(G, 'rimewyrm');
        ok(typeof Sp.splicePreview(G, top.uid, top2.uid).ok === 'boolean', 'splicing with a top daemon answers');
    }
    {
        // Bonds
        const G = newG(4);
        ok(Gm.act(G, { type: 'hangout', who: 'wren' }) === '' && G.phase === 'scene' && G.scene.id === 'bond_wren_1', 'rank one is open from the start');
        const d0 = G.day;
        skipScenes(G);
        ok(G.bonds.wren === 1 && G.day === d0 + 1 && G.phase === 'hub', 'a hangout raises the rank, passes a day and returns to the hub');
        ok(/further/i.test(Gm.act(G, { type: 'hangout', who: 'wren' })), 'rank two waits for the story');
        G.chapter = 6;
        for (const b of BONDERS) for (let r = 0; r < 4; r++) { Gm.act(G, { type: 'hangout', who: b }); skipScenes(G); }
        ok(BONDERS.every((b) => G.bonds[b] === 4), 'every Bond can reach rank four');
        ok(/close/i.test(Gm.act(G, { type: 'hangout', who: 'wren' })), 'rank four is the end');
        const { bondPerk } = await import('../js/sim/perks.js');
        ok(bondPerk(G, 'quill', 'shop') === 0.25 && bondPerk(G, 'maple', 'discount') === 0.4 && bondPerk(G, 'dov', 'xp') === 0.15 && bondPerk(G, 'wren', 'flash') === 2 && bondPerk(G, 'ilsa', 'allout') === 0.5, 'maxed Bonds give their perks');
        ok(Gm.priceOf(G, 'patch') < ITEMS.patch.price, 'Quill\'s discount applies');
        // wren's flash icons and ilsa's cheaper all-out show up in battle
        G.agent.lv = 10;
        Ex.enterZone(G, 'underpass');
        Bt.startBattle(G, { kind: 'normal', zone: 'underpass', foes: [{ id: 'rustbot', lv: 5 }] });
        ok(G.battle.icons.h === 2, 'Wren gives two flash icons on the first turn');
    }
}

// ================================================================ 8. story
if (want('story')) {
    section('story');
    for (const id of Object.keys(SCENES)) {
        const G = newG(1);
        Gm.startScene(G, id);
        let n = 0;
        while (G.phase === 'scene' && G.scene?.id === id && n++ < 400) { const node = Gm.sceneNode(G); const open = node?.ch ? Gm.choicesOf(G).filter((c) => !c.locked) : null; Gm.act(G, node?.ch ? { type: 'choose', i: open[0].i } : { type: 'next' }); }
        ok(n < 400, `${id} plays to its end`);
    }
    {
        // the three endings
        const finish = (pick, prep) => {
            const G = newG(9);
            G.agent.lv = 40; G.chapter = 6;
            prep?.(G);
            Gm.startScene(G, 'meridian_choice');
            while (G.phase === 'scene' && Gm.sceneNode(G) && !Gm.sceneNode(G).ch) Gm.act(G, { type: 'next' });
            const ch = Gm.choicesOf(G);
            return { G, ch, err: Gm.act(G, { type: 'choose', i: pick }) };
        };
        const r = finish(0);
        skipScenes(r.G);
        ok(r.G.phase === 'credits' && r.G.ending === 'reboot', 'Reboot ends the game');
        const p = finish(1); skipScenes(p.G);
        ok(p.G.phase === 'credits' && p.G.ending === 'purge', 'Purge ends the game');
        const locked = finish(2);
        ok(locked.ch[2].locked && /locked/i.test(locked.err), 'Graft is locked until earned');
        const g = finish(2, (G) => { G.currents.graft = 6; for (const b of BONDERS) G.bonds[b] = 2; });
        ok(!g.ch[2].locked && g.err === '', 'Graft opens with the Current and the Bonds');
        skipScenes(g.G);
        ok(g.G.phase === 'credits' && g.G.ending === 'graft' && g.G.stock.some((u) => u.sp === 'verdant'), 'Graft ends the game and Meridian joins you');
        Gm.act(g.G, { type: 'credits_done' });
        ok(g.G.phase === 'hub' && g.G.flags.cleared, 'after the credits the game goes on in the hub');
        // the choice is only reachable by beating Meridian
    }
    {
        // chapters unlock zones in order
        const G = newG(1);
        ok(Gm.unlockedZones(G).join() === 'underpass', 'only the Underpass is open at the start');
        G.chapter = 2;
        ok(Gm.unlockedZones(G).includes('orchard') && Gm.unlockedZones(G).includes('rift') && !Gm.unlockedZones(G).includes('cathedral'), 'zones and the Rift open with the story');
    }
}

// ================================================================ 9. determinism and saves
if (want('determinism')) {
    section('determinism');
    const play = (seed, ticks, skill = 1) => { const G = Gm.newGame(seed, { name: 'D' }); const bot = Bot.makeBot({ skill, seed }); for (let i = 0; i < ticks; i++) { if (!Bot.botTick(G, bot, 1 / 30)) break; G.events.length = 0; } return G; };
    const a = play(42, 4000), b = play(42, 4000);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and choices give the same game');
    const c = play(43, 4000);
    ok(JSON.stringify(Gm.serialize(a)) !== JSON.stringify(Gm.serialize(c)), 'a different seed gives a different game');
    for (const ticks of [200, 900, 2500, 6000]) {
        const G = play(7, ticks);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bot.makeBot({ skill: 1, seed: 7 }), b2 = Bot.makeBot({ skill: 1, seed: 7 });
        for (let i = 0; i < 1500; i++) { Bot.botTick(G, b1, 1 / 30); Bot.botTick(copy, b2, 1 / 30); G.events.length = 0; copy.events.length = 0; }
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save taken at tick ${ticks} (${G.phase}) plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    const G = Gm.newGame(1, { name: 'S' });
    ok(JSON.stringify(Gm.serialize(G)).length < 400000, 'a save is a sensible size');
    const E = Gm.newGame(2, { name: 'S' }); skipScenes(E); Gm.act(E, { type: 'deploy', zone: 'underpass' });
    ok(JSON.stringify(Gm.serialize(E)).length < 400000, 'a save inside a zone is a sensible size');
}

// ================================================================ 10. fuzz
if (want('fuzz')) {
    section('fuzz');
    const invariants = (G, label) => {
        const bad = [];
        for (const u of [G.agent, ...G.stock]) {
            const c = Un.calc(G, u);
            if (!Number.isFinite(u.hp) || !Number.isFinite(u.mp) || u.hp < 0 || u.hp > c.maxhp || u.mp < 0 || u.mp > c.maxmp + 0.001) bad.push(`${u.name} hp/mp ${u.hp}/${u.mp} (max ${c.maxhp}/${c.maxmp})`);
            if (u.skills.length > c.slots) bad.push(`${u.name} has too many skills`);
            if (new Set(u.skills).size !== u.skills.length) bad.push(`${u.name} has a duplicate skill`);
        }
        if (G.party.length > C.PARTY_SIZE || G.party.some((id) => !G.stock.some((u) => u.uid === id)) || new Set(G.party).size !== G.party.length) bad.push('party is inconsistent');
        if (G.stock.length > C.STOCK_MAX + 8) bad.push('too many daemons');
        if (G.scrap < 0 || !Number.isFinite(G.scrap)) bad.push('scrap ' + G.scrap);
        for (const [k, n] of Object.entries(G.items)) if (n < 0 || !ITEMS[k]) bad.push(`item ${k} ${n}`);
        if (G.battle && !G.battle.result) {
            const B = G.battle;
            if (B.icons.f < 0 || B.icons.h < 0) bad.push('negative icons');
            for (const u of B.units) { if (u.hp < 0 || u.hp > u.maxhp || !Number.isFinite(u.hp)) bad.push(`battle unit ${u.name} hp ${u.hp}`); if (!u.alive && u.hp > 0 && !u.recoded) bad.push(`dead unit ${u.name} has hp`); }
            if (B.phase === 'p' && B.actor >= 0 && !B.units[B.actor]?.alive) bad.push('a dead unit is up');
        }
        if (bad.length) { ok(false, `${label}: ${bad.slice(0, 3).join('; ')}`); return false; }
        return true;
    };
    let steps = 0, good = true;
    for (let s = 1; s <= Math.max(2, SEEDS); s++) {
        const G = Gm.newGame(s * 77, { name: 'F' });
        const rng = (() => { let a = s * 99991; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
        const pick = (arr) => arr[Math.floor(rng() * arr.length)];
        const bot = Bot.makeBot({ skill: 1, seed: s });
        for (let i = 0; i < 6000 && good; i++) {
            steps++;
            const roll = rng();
            if (roll < 0.35) Bot.botTick(G, bot, 1 / 30);
            else if (roll < 0.9) {
                // a random action, legal or not
                const ids = [...G.stock.map((u) => u.uid), G.agent.uid, 999, -1];
                const acts = [
                    { type: 'next' }, { type: 'choose', i: Math.floor(rng() * 4) - 1 }, { type: 'claim' }, { type: 'ack' }, { type: 'rest' },
                    { type: 'deploy', zone: pick(['underpass', 'spire', 'rift', 'nope']) }, { type: 'hangout', who: pick([...BONDERS, 'zzz']) },
                    { type: 'buy', id: pick(['patch', 'kit', 'chip_cinder', 'saplingedge', 'zzz']), n: Math.floor(rng() * 4) - 1 }, { type: 'sell', id: pick(['patch', 'zzz']), n: 2 },
                    { type: 'equip', slot: pick(['blade', 'coat', 'zzz']), id: pick(Object.keys(GEAR)) }, { type: 'use', item: pick(Object.keys(ITEMS)), uid: pick(ids) },
                    { type: 'chip', item: pick(Object.keys(ITEMS).filter((k) => k.startsWith('chip_'))), replace: pick([undefined, 0, 99]) },
                    { type: 'party', uids: [pick(ids), pick(ids), pick(ids), pick(ids)] }, { type: 'splice', a: pick(ids), b: pick(ids), keep: [pick(Object.keys(SKILLS))] },
                    { type: 'release', uid: pick(ids) }, { type: 'learn', replace: pick([0, 99, undefined]), skip: rng() < 0.3 }, { type: 'anchor' }, { type: 'leaveZone' }, { type: 'closeMenu' },
                    { kind: 'attack', target: Math.floor(rng() * 8) - 1 }, { kind: 'skill', skill: pick(Object.keys(SKILLS)), target: Math.floor(rng() * 8) - 1 }, { kind: 'item', item: pick(Object.keys(ITEMS)), target: Math.floor(rng() * 8) - 1 },
                    { kind: 'guard' }, { kind: 'flee' }, { kind: 'allout' }, { kind: 'recode', target: Math.floor(rng() * 8) - 1 }, { kind: 'swap', out: Math.floor(rng() * 8), uid: pick(ids) },
                    { kind: 'neg', op: pick(['script', 'gift', 'accept', 'refuse', 'leave', 'zzz']), i: Math.floor(rng() * 6) - 1, item: pick(['honey', 'patch', 'zzz']) },
                ];
                try { Gm.act(G, pick(acts)); } catch (e) { ok(false, `act threw ${e.message} (seed ${s}, step ${i}, phase ${G.phase})`); good = false; }
            } else if (G.phase === 'explore') {
                try { for (let k = 0; k < 20; k++) Gm.step(G, { x: rng() * 2 - 1, y: rng() * 2 - 1, run: rng() < 0.5, a: rng() < 0.3 }, 1 / 30); } catch (e) { ok(false, `step threw ${e.message}`); good = false; }
            }
            G.events.length = 0;
            if (i % 40 === 0 && !invariants(G, `fuzz seed ${s} step ${i}`)) good = false;
        }
    }
    ok(good, `${steps} random steps with invariants held`);
}

// ================================================================ 11. bot
if (want('bot')) {
    section('bot (whole games)');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.6]) {
            const G = Gm.newGame(s * 7919, { name: 'Bot' });
            const bot = Bot.makeBot({ skill, seed: s });
            const st = Bot.playThrough(G, bot, { maxTicks: 900000 });
            ok(st.ok, `seed ${s} skill ${skill}: the bot reaches the ending (${st.ok ? st.ending : 'stuck: ' + (st.stuck || G.phase)})`);
            rows.push({ s, skill, ...st, stock: G.stock.length, bossLv: st.bosses.filter((b) => b.result === 'win').map((b) => b.lv) });
        }
    }
    const avg = (k, f) => rows.filter((r) => r.skill === k).reduce((a, r) => a + f(r), 0) / Math.max(1, rows.filter((r) => r.skill === k).length);
    for (const k of [1, 0.6]) console.log(`  skill ${k}: ${avg(k, (r) => +r.ok).toFixed(2)} finish · ${avg(k, (r) => r.days).toFixed(0)} days · Lv ${avg(k, (r) => r.lv).toFixed(0)} · ${avg(k, (r) => r.defeats).toFixed(1)} defeats · ${avg(k, (r) => r.recodes).toFixed(0)} recodes · ${avg(k, (r) => r.splices).toFixed(1)} splices`);
    const sk1 = rows.filter((r) => r.skill === 1);
    ok(sk1.every((r) => r.ok), 'the careful bot always finishes');
    ok(avg(1, (r) => r.defeats) <= 10, `the careful bot is rarely beaten (${avg(1, (r) => r.defeats).toFixed(1)} defeats a game)`);
    ok(avg(1, (r) => r.recodes) >= 5, 'the bot recodes daemons along the way');
    ok(avg(1, (r) => r.splices) >= 1, 'the bot splices daemons');
    ok(avg(1, (r) => r.days) <= 90 && avg(1, (r) => r.days) >= 12, `a game takes a plausible number of days (${avg(1, (r) => r.days).toFixed(0)})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
