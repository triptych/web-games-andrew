/**
 * simtest.mjs — headless tests of the pure simulation (no browser).
 *
 *   node game-065/dev/simtest.mjs
 *
 * ONLY=purity,word,data,maps,battle,determinism,save,pilot   SEEDS=1,2,3   VERBOSE=1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const JS = path.join(ROOT, 'js');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const VERBOSE = !!process.env.VERBOSE;
let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const check = (c, m) => (c ? ok(m) : fail(m));

const { SPECIES, SPECIES_TOTAL, BY_NAME, lineOf } = await import(`${JS}/sim/dex.js`);
const { MOVES } = await import(`${JS}/sim/data/moves.js`);
const { TRAITS } = await import(`${JS}/sim/data/traits.js`);
const { TYPES, typeEff } = await import(`${JS}/sim/data/types.js`);
const { PARTS } = await import(`${JS}/sim/data/parts.js`);
const { ITEMS, RECIPES, BLUEPRINTS, CARDS } = await import(`${JS}/sim/data/items.js`);
const { MAPS } = await import(`${JS}/sim/data/maps.js`);
const { LEADERS, rivalTeam, OBJECTIVES, SCRIPTS } = await import(`${JS}/sim/data/story.js`);
const { RNG } = await import(`${JS}/rng.js`);
const { makeUnit, calcStats, evolve, evolutionTarget } = await import(`${JS}/sim/unit.js`);
const { Battle } = await import(`${JS}/sim/battle.js`);
const { chooseAction } = await import(`${JS}/sim/ai.js`);
const { Game, newState, loadGame } = await import(`${JS}/sim/game.js`);
const { Pilot } = await import(`${JS}/sim/pilot.js`);

function listFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        if (e.name === 'node_modules' || e.name === 'shots' || e.name === 'package') return [];
        return e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)];
    });
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// ===================================================================== purity
if (want('purity')) {
    console.log('\n== purity: js/sim imports no three, touches no DOM, never calls Math.random');
    let bad = 0;
    for (const f of listFiles(path.join(JS, 'sim'))) {
        const code = strip(fs.readFileSync(f, 'utf8'));
        if (/from\s+['"]three/.test(code)) { bad++; fail(`${f} imports three`); }
        if (/\bdocument\.|\bwindow\.|localStorage|requestAnimationFrame/.test(code)) { bad++; fail(`${f} touches the DOM`); }
        if (/Math\.random\(/.test(code)) { bad++; fail(`${f} calls Math.random`); }
        if (/from\s+['"]\.\.\/(view|ui)\//.test(code)) { bad++; fail(`${f} imports the view or UI`); }
    }
    check(bad === 0, 'js/sim is pure');
}

// ===================================================================== the forbidden word
if (want('word')) {
    console.log('\n== word: the letters m-o-n never appear together, anywhere in the game');
    const word = new RegExp(['m', 'o', 'n'].join(''), 'i');
    let bad = 0;
    for (const f of listFiles(ROOT)) {
        const txt = fs.readFileSync(f, 'utf8');
        txt.split('\n').forEach((line, i) => { if (word.test(line)) { bad++; if (bad < 20) fail(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 100)}`); } });
    }
    // And in every string the game can show: names, entries, moves, traits, items, dialogue.
    const shown = [
        ...SPECIES.slice(1).flatMap((s) => [s.name, s.entry]), ...Object.values(MOVES).map((m) => m.name + m.note),
        ...Object.values(TRAITS).flatMap((t) => [t.name, t.desc]), ...Object.values(ITEMS).flatMap((i) => [i.name, i.desc]),
        ...Object.values(MAPS).flatMap((m) => [m.name, m.sub || '', ...Object.values(m.ents).flatMap((e) => [e.name || '', e.text || '', ...(Array.isArray(e.say) ? e.say : [e.say || '']), e.lose || ''])]),
        JSON.stringify(SCRIPTS), JSON.stringify(LEADERS), JSON.stringify(OBJECTIVES.map((o) => o.text)),
    ];
    const hits = shown.filter((t) => word.test(t || ''));
    check(bad === 0 && hits.length === 0, `no file and no on-screen text contains it (${listFiles(ROOT).length} files checked)`);
}

// ===================================================================== data
if (want('data')) {
    console.log('\n== data: 250 COM-bots, techniques, traits, items, evolutions, availability');
    check(SPECIES_TOTAL === 250, `exactly 250 COM-bots (${SPECIES_TOTAL})`);
    const names = new Set(SPECIES.slice(1).map((s) => s.name));
    check(names.size === 250, 'every name is unique');
    let badMoves = 0, badTraits = 0, badParts = 0, badStats = 0;
    for (const s of SPECIES.slice(1)) {
        for (const [, m] of s.learnset) if (!MOVES[m]) badMoves++;
        for (const t of s.traits) if (!TRAITS[t]) { badTraits++; if (VERBOSE) console.log('   trait', t); }
        for (const [slot, k] of Object.entries(s.parts)) if (slot !== 'e' && !(PARTS[slot] && PARTS[slot][k])) { badParts++; if (VERBOSE) console.log('   part', s.name, slot, k); }
        const tot = Object.values(s.base).reduce((a, b) => a + b, 0);
        if (tot !== s.total || Object.values(s.base).some((v) => v < 18 || v > 175)) badStats++;
        if (s.traits.length !== (s.stages === 1 ? s.traits.length : s.stage)) badTraits++;
    }
    check(!badMoves, 'every learnset technique exists');
    check(!badTraits, 'every trait exists, and a bot has one trait per evolution stage reached');
    check(!badParts, 'every part exists');
    check(!badStats, 'base stats add up to each tier\'s total and stay in range');
    // Evolutions add parts.
    let evo = 0, evoParts = 0, kitsOk = 0, kits = 0;
    for (const s of SPECIES.slice(1)) {
        if (!s.evolves) continue;
        evo++;
        const to = SPECIES[s.evolves.to];
        if (to.added.length > 0 && to.traits.length > s.traits.length) evoParts++;
        if (s.evolves.k === 'kit') { kits++; if (ITEMS[s.evolves.item] && RECIPES.some((r) => r.out === s.evolves.item)) kitsOk++; }
    }
    check(evo === evoParts, `every evolution (${evo}) installs new parts and grants a new trait`);
    check(kits === kitsOk, `every evolution kit (${kits}) exists and can be crafted`);
    // A real evolution on a unit.
    const rng = new RNG(9);
    const u = makeUnit(rng, BY_NAME.embrit.id, 16, { uid: 1 });
    const t = evolutionTarget(u);
    const r = evolve(u);
    check(t === BY_NAME.furnacle.id && SPECIES[u.sp].name === 'Furnacle' && r.parts.length && r.traits.includes('redline'), `Embrit → Furnacle at 16 installs ${r.parts.map((p) => p.name).join(' + ')}, gains Redline and learns ${r.learned.map((m) => MOVES[m].name).join(', ') || '—'}`);
    // Type chart.
    let cells = 0;
    for (const a of TYPES) for (const d of TYPES) { const e = typeEff(a, d); if ([0, 0.5, 1, 2].includes(e)) cells++; }
    check(cells === 256, '16 × 16 type chart');
    for (const ty of TYPES) {
        const weak = TYPES.filter((a) => typeEff(a, ty) > 1).length;
        if (weak < 1 && ty !== 'volt') fail(`${ty} has no weakness`);
    }
    // Effect kinds the engine understands.
    const KNOWN = new Set(['st', 'glitch', 'stagger', 'self', 'foe', 'recoil', 'drain', 'heal', 'multi', 'crit', 'atm', 'protect', 'shards', 'siphon', 'rest', 'purge', 'boom', 'recharge', 'lowhp', 'fixed']);
    const unknown = Object.values(MOVES).flatMap((m) => m.fx.filter((f) => !KNOWN.has(f.k)).map((f) => `${m.id}:${f.k}`));
    check(!unknown.length, `every technique effect is implemented (${Object.keys(MOVES).length} techniques) ${unknown.join(' ')}`);
    check(CARDS.every((c) => MOVES[c] && ITEMS[`card-${c}`]), `${CARDS.length} program cards`);
    // Availability: every COM-bot can be obtained in one save.
    const got = new Set();
    const add = (n) => { const s = BY_NAME[n.toLowerCase()]; if (s) got.add(s.id); };
    for (const m of Object.values(MAPS)) {
        for (const [n] of [...(m.enc || []), ...(m.encS || [])]) add(n);
        for (const e of Object.values(m.ents)) { if (e.k === 'wreck' || e.k === 'titan') add(e.sp); if (e.capsule) add(e.capsule); }
    }
    for (const b of Object.values(BLUEPRINTS)) add(b.bot);
    add('Omnicog');
    let grew = true;
    while (grew) { grew = false; for (const id of [...got]) { const e = SPECIES[id].evolves; if (e && !got.has(e.to)) { got.add(e.to); grew = true; } } }
    const missing = SPECIES.slice(1).filter((s) => !got.has(s.id)).map((s) => s.name);
    check(!missing.length, `all 250 COM-bots are obtainable (wild, wreck, blueprint, titan, gift, evolution)${missing.length ? ': missing ' + missing.join(', ') : ''}`);
    // Every referenced bot name exists.
    const refs = [];
    for (const m of Object.values(MAPS)) {
        for (const [n] of [...(m.enc || []), ...(m.encS || [])]) refs.push(n);
        for (const e of Object.values(m.ents)) { for (const [n] of e.team || []) refs.push(n); if (e.sp) refs.push(e.sp); }
    }
    for (const L of Object.values(LEADERS)) for (const [n] of L.team) refs.push(n);
    for (const s of ['Embrit', 'Bubblet', 'Mossbit']) for (let i = 1; i <= 4; i++) for (const [n] of rivalTeam(i, s)) refs.push(n);
    const badRef = [...new Set(refs.filter((n) => !BY_NAME[n.toLowerCase()]))];
    check(!badRef.length, `every bot named in maps and teams exists ${badRef.join(' ')}`);
    const lines = new Set(SPECIES.slice(1).map((s) => s.line)).size;
    if (VERBOSE) console.log(`   ${lines} lines; e.g. ${lineOf(BY_NAME.cogling.id).map((s) => s.name).join(' → ')}`);
}

// ===================================================================== maps
if (want('maps')) {
    console.log('\n== maps: shapes, warps that lead back, entities, reachability');
    const BLOCK = new Set(['#', 'T', 'B', '=', 'K', '%', '+']);
    let bad = 0;
    const B = (m) => { bad++; fail(m); };
    for (const m of Object.values(MAPS)) {
        m.rows.forEach((r, y) => { if (r.length !== m.W) B(`${m.id} row ${y} is ${r.length} wide, not ${m.W}`); });
        const digits = {}, letters = {};
        m.rows.forEach((r, y) => [...r].forEach((c, x) => { if (/[0-9]/.test(c)) (digits[c] ||= []).push([x, y]); if (/[a-z]/.test(c)) (letters[c] ||= []).push([x, y]); }));
        for (const d of Object.keys(digits)) {
            const t = m.w[d];
            if (!t || !MAPS[t[0]]) { B(`${m.id}: warp ${d} goes nowhere`); continue; }
            const tm = MAPS[t[0]];
            if (!tm.w[t[1]] || tm.w[t[1]][0] !== m.id) B(`${m.id}: warp ${d} → ${t[0]} doesn't lead back`);
        }
        for (const l of Object.keys(letters)) if (!m.ents[l]) B(`${m.id}: letter ${l} has no entity`);
        for (const l of Object.keys(m.ents)) if (!letters[l]) B(`${m.id}: entity ${l} is not on the map`);
        const start = Object.values(digits)[0]?.[0];
        if (!start) { B(`${m.id}: no way in`); continue; }
        const seen = new Set([start.join()]); const q = [start];
        const pass = (x, y) => { const c = m.rows[y]?.[x]; if (c === undefined || BLOCK.has(c)) return false; if (/[a-z]/.test(c)) { const e = m.ents[c]; return !!(e && (e.unless || e.when || e.k === 'marshal' || e.k === 'trigger')); } return true; };
        while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (!seen.has(k) && pass(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); } } }
        for (const [d, ps] of Object.entries(digits)) for (const p of ps) if (!seen.has(p.join())) B(`${m.id}: warp ${d} unreachable`);
        for (const [l, ps] of Object.entries(letters)) { const [x, y] = ps[0]; if (![[1, 0], [-1, 0], [0, 1], [0, -1], [0, 2]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`))) B(`${m.id}: ${m.ents[l].k} ${l} unreachable`); }
    }
    check(bad === 0, `${Object.keys(MAPS).length} maps are consistent and fully reachable`);
}

// ===================================================================== battle engine
if (want('battle')) {
    console.log('\n== battle: random teams, every technique, captures, no stalemates');
    const rng = new RNG(77);
    let stuck = 0, errors = 0, n = 400, turns = 0;
    for (let i = 0; i < n; i++) {
        const team = (k) => Array.from({ length: k }, () => makeUnit(rng, rng.int(1, 250), rng.int(5, 70), { uid: rng.int(1, 1e9) }));
        try {
            const b = new Battle({ kind: 'trainer', player: { name: 'P', units: team(3) }, foe: { name: 'F', units: team(3), ai: 2, items: { 'rivet-kit': 1 } }, rng, bag: {} });
            b.side[0].ai = 1;
            b.start();
            let g = 0;
            while (!b.over && g++ < 400) {
                if (b.need === 'switch') b.choose({ k: 'switch', i: b.side[0].units.findIndex((u) => u.hp > 0) });
                else { const a = chooseAction(b, 0); b.choose(a.k === 'item' ? { k: 'move', i: 0 } : a); }
            }
            if (!b.over) stuck++;
            turns += b.turn;
        } catch (e) { errors++; if (errors < 4) console.log(e.stack); }
    }
    check(!errors && !stuck, `${n} random 3-on-3 battles finish (avg ${(turns / n).toFixed(1)} turns)`);
    // Every technique once.
    let moveErr = 0;
    for (const id of Object.keys(MOVES)) {
        const a = makeUnit(rng, 1, 50, { uid: 1, moves: [id] }), b2 = makeUnit(rng, 100, 50, { uid: 2 });
        try {
            const b = new Battle({ kind: 'wild', player: { units: [a] }, foe: { units: [b2] }, rng, bag: {} });
            b.start(); b.choose({ k: 'move', i: 0 });
        } catch (e) { moveErr++; console.log(`   ${id}: ${e.message}`); }
    }
    check(!moveErr, `all ${Object.keys(MOVES).length} techniques run`);
    // Capture odds behave.
    let caught = 0;
    for (let i = 0; i < 200; i++) {
        const b = new Battle({ kind: 'wild', player: { units: [makeUnit(rng, 1, 30, { uid: 1 })] }, foe: { units: [makeUnit(rng, BY_NAME.bolty.id, 4, { uid: 2 })] }, rng, bag: { 'reboot-spike': 1 } });
        b.start(); b.choose({ k: 'spike', id: 'reboot-spike' });
        if (b.result === 'caught') caught++;
    }
    const titan = new Battle({ kind: 'wild', player: { units: [makeUnit(rng, 1, 30, { uid: 1 })] }, foe: { units: [makeUnit(rng, BY_NAME.glaciarch.id, 52, { uid: 2 })] }, rng, bag: { 'reboot-spike': 1, 'prime-key': 1 } });
    titan.start(); titan.choose({ k: 'spike', id: 'prime-key' });
    check(caught > 30 && caught < 120 && titan.result === 'caught', `a full-Hull Bolty is caught ${caught}/200 times with a Reboot Spike; the Prime Key never fails`);
    const tb = new Battle({ kind: 'trainer', player: { units: [makeUnit(rng, 1, 30, { uid: 1 })] }, foe: { units: [makeUnit(rng, 10, 5, { uid: 2 })] }, rng, bag: { 'reboot-spike': 1 } });
    tb.start(); tb.choose({ k: 'spike', id: 'reboot-spike' });
    check(!tb.over && tb.bag['reboot-spike'] === 1, 'trainers swat spikes away (no spike spent)');
}

// ===================================================================== determinism and saving
function playTo(seed, maxActions, until) {
    const g = new Game(newState({ seed, name: 'Pilot' }));
    const p = new Pilot(g);
    while (p.actions < maxActions) { if (until && until(g)) break; if (!p.tick()) break; }
    return { g, p };
}
if (want('determinism')) {
    console.log('\n== determinism: two runs with the same seed are identical');
    const a = playTo(5, 6000), b = playTo(5, 6000);
    check(a.g.serialize() === b.g.serialize(), `same seed → same game after 6000 actions (story ${a.g.state.story}, ${a.g.state.steps} steps)`);
}
if (want('save')) {
    console.log('\n== save: serialize mid-game, load, play on to the end');
    const { g, p } = playTo(7, 200000, (gg) => gg.state.story >= 12 && !gg.busy());
    const json = g.serialize();
    const g2 = loadGame(json);
    check(g2.serialize() === json, `save → load round trip at story ${g.state.story} (${(json.length / 1024).toFixed(1)} KB)`);
    const p2 = new Pilot(g2);
    p2.extra = p.extra;
    p2.run(600000);
    check(g2.state.story >= 25, `the loaded game plays on to the ending (story ${g2.state.story})`);
}

// ===================================================================== the pilot plays the whole game
if (want('pilot')) {
    const seeds = (process.env.SEEDS || '1,2,3').split(',').map(Number);
    console.log(`\n== pilot: a bot plays from the shack to the Champion (seeds ${seeds.join(', ')})`);
    for (const seed of seeds) {
        const t0 = Date.now();
        const g = new Game(newState({ seed, name: 'Pilot' }));
        const p = new Pilot(g, { log: (m) => console.log('   ', m) });
        const done = p.run(900000);
        const st = g.state;
        const lv = st.party.map((u) => u.lv).join('/');
        check(done && st.story >= 25 && st.seals === 8 && st.bag['starward-ticket'], `seed ${seed}: Champion with 8 seals in ${p.actions} actions, ${st.battles} battles, ${p.stats.losses} losses, ${(st.playtime / 60).toFixed(0)} sim-minutes, team ${lv}, registry ${Object.keys(st.owned).length} owned / ${Object.keys(st.seen).length} seen (${Date.now() - t0} ms)`);
        if (VERBOSE) console.log('    blackouts:', p.stats.blackouts.join(' '));
    }
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
