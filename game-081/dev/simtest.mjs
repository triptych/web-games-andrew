/**
 * simtest.mjs — headless checks of Salve & Scale's simulation. No browser.
 *
 *   node game-081/dev/simtest.mjs                 # everything
 *   ONLY=purity,rules node game-081/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-081/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: the scan puzzle — links by sense, trails, gravity and refill, lifeblooms, scars, bound
 *    motes, vials and all four powers, remedies, the tonic, stars, multi-phase boards, skill mods.
 * 3. scans: every story, quest and boss scan, and generated walk-ins for every act, played by the
 *    scan bot at skill 1 and 0.6 on SEEDS seeds with the act's senses and no skills: the win-rate
 *    and focus-left table, with floors and ceilings so a scan can't be impossible or trivial.
 * 4. maps: every map is walled in, every entity is reachable from the start once the traps and the
 *    gate before it are cleared, traps really block, gates really gate.
 * 5. dialogue: every speaker is known, every line non-empty, every patient has an intro and thanks.
 * 6. determinism: same seed and inputs → same game; a save round trip (mid-scan too) plays on
 *    identically; an unknown save version is rejected.
 * 7. campaign: the campaign bot walks and heals its way through the whole game through step() and
 *    act() on CAMPAIGN_SEEDS seeds, reaching the ending, with per-step invariants.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 10);
const CAMPAIGN_SEEDS = +(process.env.CAMPAIGN_SEEDS || 2);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const A = await import('../js/sim/data/ailments.js');
const SP = await import('../js/sim/data/species.js');
const SK = await import('../js/sim/data/skills.js');
const MP = await import('../js/sim/data/maps.js');
const ST = await import('../js/sim/data/story.js');
const Scan = await import('../js/sim/scan.js');
const Search = await import('../js/sim/search.js');
const W = await import('../js/sim/world.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js'];
    const walk = (dir) => { for (const f of fs.readdirSync(path.join(ROOT, dir))) { const p = `${dir}/${f}`; if (fs.statSync(path.join(ROOT, p)).isDirectory()) walk(p); else files.push(p); } };
    walk('js/sim');
    for (const f of files) {
        // strip comments and string literals: a line of dialogue may say "window."
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
            .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
            .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        const imports = [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]);
        ok(!imports.some((i) => i === 'three' || /(^|\/)(view|ui|audio|input|save|main)(\/|\.js)/.test(i)), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
const FULL = ['.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......'];
/** A scan with a hand-placed grid: rows of 'kind:hue:sev' tokens ('-' = empty, '#' = hole). */
function fixture(rows, { senses = ['kind'], mods = {}, goals = [{ t: 'any', n: 999 }], focus = 20, kinds = ['thorn', 'gash'] } = {}) {
    const mask = rows.map((r) => r.map((t) => (t === '#' ? ' ' : '.')).join(''));
    const S = Scan.newScan({ mask, kinds, focus, goals }, { seed: 3, senses, mods });
    rows.forEach((row, r) => row.forEach((t, c) => {
        if (t === '#' || t === '-') { S.cells[r][c].m = t === '-' ? null : null; return; }
        const [kind, hue, sev] = t.split(':');
        S.cells[r][c].m = { id: 1000 + r * 10 + c, kind, hue: hue || A.KINDS[kind].hues[0], sev: sev || 'M', school: A.KINDS[kind].school, bloom: false, bound: 0 };
    }));
    return S;
}

if (want('rules')) {
    section('rules');
    // --- links by sense
    {
        const S = fixture([['thorn:green', 'gash:red', 'thorn:orange'], ['gash:red', 'gash:pink', 'thorn:green'], ['thorn:green', 'gash:red', 'gash:red']]);
        const a = S.cells[0][0].m, b = S.cells[0][2].m, c = S.cells[0][1].m;
        ok(Scan.canLink(S, a, b), 'two thorns link by form');
        ok(!Scan.canLink(S, a, c), 'a thorn and a gash do not link with Form only');
        S.senses = ['kind', 'hue'];
        ok(Scan.canLink(S, S.cells[0][1].m, S.cells[1][0].m) && Scan.linkTraits(S, S.cells[0][1].m, S.cells[1][0].m).includes('hue'), 'two crimson motes link by aura');
        const sp = { ...S.cells[0][0].m, kind: 'spider', hue: 'red', school: 'venom' };
        ok(Scan.canLink(S, sp, S.cells[0][1].m), 'with Aura Sight a spider-bite links to a gash by colour');
        S.senses = ['kind', 'hue', 'sev', 'school'];
        ok(Scan.canLink(S, { ...a, kind: 'gash', hue: 'pink' }, { ...a, kind: 'bruise', hue: 'blue' }), 'with Root Lore two wounds link by nature');
        ok(Scan.canLink(S, { ...a, kind: 'scorch', hue: 'orange', school: 'blight', sev: 'L' }, { ...a, kind: 'sigil', hue: 'purple', school: 'hex', sev: 'L' }), 'with Depth Sense two grave motes link');
    }
    // --- a trail treats, costs focus, gravity and refill keep the grid full
    {
        const S = fixture([
            ['gash', 'gash', 'gash', 'gash', 'gash'],
            ['thorn', 'gash', 'thorn', 'gash', 'thorn'],
            ['gash', 'thorn', 'gash', 'thorn', 'gash'],
            ['thorn', 'thorn', 'thorn', 'gash', 'gash'],
        ], { goals: [{ t: 'kind', v: 'thorn', n: 3 }, { t: 'kind', v: 'gash', n: 50 }] });
        const before = Scan.moteCount(S);
        ok(!Scan.playChain(S, [[3, 0], [3, 2]]), 'a trail must be adjacent hops');
        ok(!Scan.playChain(S, [[3, 0], [3, 1]]), 'a trail of two is not enough');
        ok(!Scan.playChain(S, [[3, 2], [3, 3], [3, 4]]), 'a thorn-to-gash hop is refused with Form only');
        const ev = Scan.playChain(S, [[3, 0], [3, 1], [3, 2]]);
        ok(ev && ev.some((e) => e.type === 'treat' && e.items.length === 3), 'a trail of three thorns is treated');
        ok(S.used === 1, 'and costs one focus');
        ok(S.goals[0].have === 3, 'and counts toward the thorn goal');
        ok(Scan.moteCount(S) === before, 'gravity and refill keep every body cell full');
        ok(ev.some((e) => e.type === 'settle' && e.spawns.length === 3), 'three new motes well up');
        ok(S.found.includes('thorn|green'), 'the codex records thorn|green');
    }
    // --- diagonal hops and undoing through the same cell are refused
    {
        const S = fixture([['thorn', 'gash'], ['gash', 'thorn'], ['thorn', 'gash']]);
        ok(Scan.validChain(S, [[0, 0], [1, 1], [2, 0]]), 'diagonal hops are allowed');
        ok(!Scan.validChain(S, [[0, 0], [1, 1], [0, 0]]), 'a trail cannot visit a mote twice');
    }
    // --- lifebloom
    {
        const row = ['gash', 'gash', 'gash', 'gash', 'gash', 'gash', 'gash'];
        const S = fixture([row, ['thorn', 'thorn', 'thorn', 'thorn', 'thorn', 'thorn', 'thorn']], { goals: [{ t: 'bloom', n: 1 }, { t: 'any', n: 99 }] });
        const ev = Scan.playChain(S, row.map((_, c) => [0, c]));
        ok(ev.some((e) => e.type === 'bloom'), 'a trail of seven grows a lifebloom');
        ok(S.goals[0].have === 1, 'and counts toward the bloom goal');
        const bl = { kind: 'gash', hue: 'red', sev: 'M', school: 'wound', bloom: true };
        ok(Scan.canLink(S, bl, { kind: 'thorn', hue: 'green', sev: 'S', school: 'wound' }), 'a lifebloom links to anything');
        const S6 = fixture([row.slice(0, 6), ['thorn', 'thorn', 'thorn', 'thorn', 'thorn', 'thorn']], { mods: { bloomChain: 6 } });
        ok(Scan.playChain(S6, row.slice(0, 6).map((_, c) => [0, c])).some((e) => e.type === 'bloom'), 'Bloom Lore: a trail of six grows one');
    }
    // --- scars and bound motes
    {
        const S = fixture([['gash', 'gash', 'gash'], ['thorn', '-', 'thorn'], ['thorn', 'thorn', 'thorn']], { goals: [{ t: 'scar', n: 1 }, { t: 'bound', n: 1 }, { t: 'any', n: 99 }] });
        S.cells[1][1].scar = 2;
        S.cells[1][0].m.bound = 1;
        ok(!Scan.selectable(S, 1, 0), 'a bound mote cannot join a trail');
        Scan.playChain(S, [[0, 0], [0, 1], [0, 2]]);
        ok(S.cells[1][1].scar === 1, 'treating next to scar softens a layer');
        ok(S.cells[1][0].m.bound === 0 && S.goals[1].have === 1, 'treating next to a bound mote unbinds it');
        const D = fixture([['gash', 'gash', 'gash'], ['thorn', '-', 'thorn'], ['thorn', 'thorn', 'thorn']], { mods: { debride: 2, unbind: 2 } });
        D.cells[1][1].scar = 2; D.cells[1][0].m.bound = 2;
        Scan.playChain(D, [[0, 0], [0, 1], [0, 2]]);
        ok(D.cells[1][1].scar === 0, 'Debride softens two scar layers');
        ok(D.cells[1][0].m.bound === 0, 'Unbinding Word breaks two binding layers');
        ok(D.cells[1][1].m, 'a softened scar cell fills with a mote');
    }
    // --- vials and powers
    {
        const S = Scan.newScan({ mask: FULL, kinds: ['thorn', 'gash', 'bruise'], focus: 30, goals: [{ t: 'any', n: 999 }] }, { seed: 9, senses: ['kind', 'hue', 'sev', 'school'] });
        ok(S.vials.length === 4 && S.vials.every((v) => v.target != null), 'one vial per sense, each with a set');
        S.vials[0].charges = 1;
        const kind = S.cells[3][3].m.kind;
        let n = 0; Scan.forEachMote(S, (m) => { if (m.kind === kind) n++; });
        const ev = Scan.usePower(S, 0, 3, 3);
        ok(ev && ev[0].type === 'treat' && ev[0].items.length === n && S.used === 0, 'the Purging Draught treats every mote of one form, free');
        S.vials[1].charges = 1;
        const hue = S.cells[4][4].m.hue;
        Scan.usePower(S, 1, 4, 4);
        ok(Search.neighbours(S, 4, 4).every(([r, c]) => !S.cells[r][c].m || S.cells[r][c].m.hue === hue || S.cells[r][c].m.bound), 'the Prism Salve paints the neighbours');
        S.vials[2].charges = 1;
        const ev2 = Scan.usePower(S, 2, 4, 3);
        ok(ev2 && ev2[0].items.length === 9, 'the Lancet Burst treats a 3×3');
        S.vials[3].charges = 1;
        Scan.usePower(S, 3);
        ok(S.wild, 'the Phoenix Feather arms a wild trail');
        ok(Scan.canLink(S, { kind: 'thorn', hue: 'green', sev: 'S', school: 'wound' }, { kind: 'sigil', hue: 'purple', sev: 'L', school: 'hex' }), 'a wild trail links anything');
        const W2 = Scan.newScan({ mask: FULL, kinds: ['thorn', 'gash'], focus: 30, goals: [{ t: 'any', n: 999 }] }, { seed: 4, senses: ['kind', 'sev'], mods: { wideLancet: true } });
        W2.vials[1].charges = 1;
        ok(Scan.usePower(W2, 1, 4, 3)[0].items.length === 13, 'Wide Lancet reaches 13 cells');
        // filling a vial
        const F = Scan.newScan({ mask: FULL, kinds: ['thorn'], focus: 30, goals: [{ t: 'any', n: 999 }] }, { seed: 5, senses: ['kind'] });
        F.vials[0].fill = F.vials[0].need - 1;
        const evF = Scan.playChain(F, [[7, 0], [7, 1], [7, 2]]);
        ok(F.vials[0].charges === 1 && evF.some((e) => e.type === 'vial' && e.full), 'treating fills a vial into a charge');
        const ST2 = Scan.newScan({ mask: FULL, kinds: ['thorn'], focus: 30, goals: [{ t: 'any', n: 999 }] }, { seed: 5, senses: ['kind'], mods: { vialLess: 3, start: ['draught'], maxCharges: 3 } });
        ok(ST2.vials[0].need === A.VIALS.kind.need - 3 && ST2.vials[0].charges === 1, 'vial mods: fewer needed, a starting charge');
    }
    // --- items, tonic, stars, losing
    {
        const S = Scan.newScan({ mask: FULL, kinds: ['thorn', 'gash', 'bruise', 'spider'], focus: 2, goals: [{ t: 'kind', v: 'thorn', n: 200 }] }, { seed: 11, senses: ['kind'] });
        Bt.scanBotPlay(S);
        ok(S.status === 'lost', 'running out of focus loses the scan');
        ok(Scan.drinkTonic(S) && S.status === 'playing' && Scan.focusLeft(S) === 5, 'the tonic gives 5 focus');
        Bt.scanBotPlay(S);
        ok(!Scan.drinkTonic(S), 'the tonic works once');
        ok(Scan.useItem(S, 'salts') && S.status === 'playing' && Scan.focusLeft(S) === 3, 'smelling salts work even after losing');
        const C2 = Scan.newScan({ mask: FULL, kinds: ['thorn', 'gash'], focus: 20, goals: [{ t: 'kind', v: 'thorn', n: 3 }] }, { seed: 2, senses: ['kind'] });
        const before = JSON.stringify(C2.cells.map((r) => r.map((c) => c.m?.id)));
        Scan.useItem(C2, 'calm');
        ok(JSON.stringify(C2.cells.map((r) => r.map((c) => c.m?.id))) !== before, 'a calm draught reshuffles');
        C2.vials[0].fill = 5;
        Scan.useItem(C2, 'star');
        ok(C2.vials[0].charges === 1, 'a starpetal tonic fills a vial');
        Bt.scanBotPlay(C2);
        ok(C2.status === 'won' && C2.stars === 3, 'an easy scan won with most focus left earns three stars');
        const T = Scan.newScan({ mask: FULL, kinds: ['thorn', 'gash'], focus: 20, goals: [{ t: 'kind', v: 'thorn', n: 300 }] }, { seed: 2, senses: ['kind'], mods: { triage: true } });
        const p = Bt.chooseChain(T);
        Scan.playChain(T, p);
        ok(T.used === 0, 'Triage: the first trail is free');
    }
    // --- shuffles keep a move available
    {
        let shuffled = 0, stuck = 0;
        for (let s = 1; s <= 30; s++) {
            const S = Scan.newScan({ mask: FULL, kinds: ['thorn', 'gash', 'bruise', 'spider', 'sigil', 'scorch', 'acid', 'frostbite'], focus: 25, goals: [{ t: 'any', n: 999 }] }, { seed: s, senses: ['kind'] });
            for (let i = 0; i < 25 && S.status === 'playing'; i++) {
                if (!Search.hasMove(S, false)) stuck++;
                const ev = Bt.scanBotStep(S);
                if (ev?.some((e) => e.type === 'shuffle')) shuffled++;
            }
        }
        ok(stuck === 0, `a legal trail always exists (shuffled ${shuffled} times over 30 crowded scans)`);
    }
    // --- multi-phase
    {
        const spec = ST.scanSpecFor({ species: 'overlord', name: 'G', scan: ST.QUESTS.citadel.boss.scan });
        const S = Scan.newScan(spec, { seed: 3, senses: A.SENSE_ORDER });
        ok(S.rows === 9 && S.cols === 8 && S.phases.length === 3, 'the Overlord is three 8×9 boards');
        let phases = 0;
        for (let i = 0; i < 400 && S.status === 'playing'; i++) {
            const ev = Bt.scanBotStep(S);
            if (!ev) break;
            if (ev.some((e) => e.type === 'phase')) phases++;
        }
        if (S.status === 'lost') { Scan.drinkTonic(S); Bt.scanBotPlay(S); }
        ok(phases >= 1, `boards change when a phase's goals are met (${phases} phase changes, ${S.status})`);
    }
    // --- skill mods
    {
        const m0 = SK.scanMods({}, [], ['kind']);
        const mAll = SK.scanMods(Object.fromEntries(SK.SKILLS.map((s) => [s.id, true])), ['quill', 'lens', 'glove'], A.SENSE_ORDER);
        ok(m0.focus === 0 && m0.tonic === 5 && m0.maxCharges === 2 && m0.steady === 0, 'no skills, no mods');
        ok(mAll.focus === 6 && mAll.vialLess === 3 && mAll.tonic === 8 && mAll.maxCharges === 3 && mAll.steady === 5 && mAll.start.includes('lancet') && mAll.start.includes('draught'), 'every skill and relic lands in the mods');
        ok(SK.SKILLS.every((s) => s.tier === 0 || SK.SKILLS.some((x) => x.branch === s.branch && x.tier === s.tier - 1)), 'every skill has a parent');
    }
}

// ======================================================================
function allScans() {
    const out = [];
    for (const [id, p] of Object.entries(ST.STORY_PATIENTS)) out.push({ label: `story ${id}`, act: p.act, spec: ST.scanSpecFor(p), boss: false });
    for (const [qid, Q] of Object.entries(ST.QUESTS)) {
        Q.patients.forEach((p, i) => out.push({ label: `${qid} ${i + 1} ${p.name}`, act: Q.act, spec: ST.scanSpecFor(p), boss: false }));
        out.push({ label: `${qid} BOSS ${Q.boss.name}`, act: Q.act, spec: ST.scanSpecFor(Q.boss), boss: true, bossSense: true });
    }
    for (let a = 0; a < ST.ACTS.length; a++) {
        const r = makeRng(1000 + a);
        for (let i = 0; i < 4; i++) { const w = ST.makeWalkin(a, r, `w${i}`); out.push({ label: `walk-in act ${a} #${i} ${w.species}`, act: a, spec: ST.scanSpecFor(w), boss: false }); }
    }
    return out;
}

if (want('scans')) {
    section('scans (no skills; skill 1 and 0.6)');
    const rows = [];
    for (const sc of allScans()) {
        const senses = A.SENSE_ORDER.filter((s) => ST.ACTS[Math.min(sc.act, 4)].senses.includes(s));
        const res = {};
        for (const skill of [1, 0.6]) {
            let wins = 0, tonic = 0, left = 0;
            for (let s = 1; s <= SEEDS; s++) {
                const S = Scan.newScan(sc.spec, { seed: s * 7919 + 13, senses });
                const rng = makeRng(s);
                Bt.scanBotPlay(S, { skill, rng });
                if (S.status === 'won') { wins++; left += Scan.focusLeft(S) / S.base; continue; }
                Scan.drinkTonic(S);
                Bt.scanBotPlay(S, { skill, rng });
                if (S.status === 'won') tonic++;
            }
            res[skill] = { win: wins / SEEDS, withTonic: (wins + tonic) / SEEDS, left: wins ? left / wins : 0 };
        }
        rows.push({ ...sc, res });
        const f = (x) => (x * 100).toFixed(0).padStart(3) + '%';
        console.log(`  ${sc.label.padEnd(36)} p: win ${f(res[1].win)} left ${f(res[1].left)} | 0.6: win ${f(res[0.6].win)} +tonic ${f(res[0.6].withTonic)} left ${f(res[0.6].left)}`);
        ok(res[1].withTonic >= 0.9, `${sc.label}: the perfect bot heals it (with the tonic) on ${f(res[1].withTonic)} of seeds`);
        ok(res[0.6].withTonic >= 0.6, `${sc.label}: the casual bot heals it (with the tonic) on ${f(res[0.6].withTonic)} of seeds`);
        ok(res[1].left <= (sc.label === 'story nib' ? 0.8 : sc.label.startsWith('walk-in') ? 0.66 : 0.62) || res[1].win < 1, `${sc.label}: not trivial (perfect bot keeps ${f(res[1].left)} of its focus)`);
    }
}

// ======================================================================
if (want('maps')) {
    section('maps');
    for (const id of MP.MAP_IDS) {
        const M = MP.MAPS[id];
        const w = M.grid[0].length, h = M.grid.length;
        ok(M.grid.every((r) => r.length === w), `${id}: rectangular ${w}×${h}`);
        ok(M.grid[0].replace(/[#]/g, '') === '' && M.grid[h - 1].replace(/[#X]/g, '') === '' && M.grid.every((r) => '#X'.includes(r[0]) && '#X'.includes(r[w - 1])), `${id}: walled in`);
        const known = new Set('#.,~oTS'.split(''));
        const unknown = [...new Set(M.grid.join(''))].filter((ch) => !known.has(ch) && !MP.legendAt(id, ch));
        ok(!unknown.length, `${id}: every symbol is known (${unknown.join('') || 'all'})`);
        ok(M.grid[M.start[1]][M.start[0]] !== '#', `${id}: the start is open`);
    }
    // quest maps: with a fresh game on that map, everything is reachable once traps and the gate are cleared;
    // traps actually block something and the gate keeps the boss in.
    for (const qid of MP.QUEST_MAPS) {
        const G = Gm.newGame(1);
        G.talk = null;
        for (const q of Object.keys(G.quests)) G.quests[q].state = 'open';
        G.patients = [];
        const Qd = ST.QUESTS[qid];
        Qd.patients.forEach((p, i) => G.patients.push({ id: `${qid}${i + 1}`, species: p.species, name: p.name, state: 'waiting', where: qid, slot: i, scan: p.scan }));
        G.patients.push({ id: `${qid}Boss`, species: Qd.boss.species, name: Qd.boss.name, state: 'waiting', where: qid, boss: true, scan: Qd.boss.scan });
        W.placeAtStart(G, qid);
        const ents = W.mapEnts(G);
        const reach = (e) => !!W.routeTo(G, e.x, e.y);
        const boss = ents.find((e) => e.boss);
        ok(!!boss && !reach(boss), `${qid}: the boss is behind the gate`);
        const traps = ents.filter((e) => e.kind === 'trap');
        ok(traps.length >= 1, `${qid}: has Company traps (${traps.length})`);
        // clear traps one at a time; at least one of them must open up something new
        const reachableCount = () => W.mapEnts(G).filter((e) => e.label && e.kind !== 'trap' && reach(e)).length;
        let gained = 0;
        for (const t of traps) {
            if (!reach(t)) continue;
            const before = reachableCount();
            G.quests[qid].traps[t.key] = true; G.wv++;
            if (reachableCount() > before) gained++;
        }
        for (const t of traps) { G.quests[qid].traps[t.key] = true; } G.wv++;
        ok(gained >= 1, `${qid}: a trap really blocks the way (${gained} of ${traps.length})`);
        const pre = W.mapEnts(G).filter((e) => e.kind !== 'gate' && !e.boss && e.kind !== 'trap');
        for (const e of pre) ok(reach(e), `${qid}: ${e.kind} at ${e.key} is reachable before the gate`);
        G.quests[qid].gate = true; G.wv++;
        ok(reach(boss), `${qid}: the boss is reachable once the gate opens`);
        ok(W.mapEnts(G).filter((e) => e.kind === 'chest').length === 2, `${qid}: a relic chest and a remedy chest`);
        ok(W.mapEnts(G).filter((e) => e.kind === 'patient').length === 4, `${qid}: three patients and a boss`);
    }
    {
        const G = Gm.newGame(1);
        for (const e of W.mapEnts(G)) if (e.label) ok(!!W.routeTo(G, e.x, e.y), `clinic: ${e.kind} ${e.id || e.key} is reachable`);
    }
}

// ======================================================================
if (want('dialogue')) {
    section('dialogue');
    const speakers = new Set(['clasp', 'ossa', 'pip', 'you', 'grimwald', 'narrator', 'aldric', 'vessa', 'corvin', 'lumina']);
    const check = (lines, where, ids) => {
        ok(Array.isArray(lines) && lines.length > 0, `${where}: has lines`);
        for (const [who, text] of lines) {
            if (!speakers.has(who) && !ids.includes(who)) ok(false, `${where}: unknown speaker ${who}`);
            if (!text || text.length < 2) ok(false, `${where}: empty line`);
        }
    };
    for (const [id, p] of Object.entries(ST.STORY_PATIENTS)) { check(p.intro, `story ${id} intro`, [id]); check(p.thanks, `story ${id} thanks`, [id]); }
    for (const [qid, Q] of Object.entries(ST.QUESTS)) {
        check(Q.arrive, `${qid} arrive`, []);
        Q.patients.forEach((p, i) => {
            const pid = p.name.toLowerCase().split(' ')[0];
            check(p.intro, `${qid} ${i} intro`, [pid]); check(p.thanks, `${qid} ${i} thanks`, [pid]);
        });
        const bid = { bramble: 'mother', crypt: 'lady', forge: 'ignatia', citadel: 'grimwald' }[qid];
        check(Q.boss.intro, `${qid} boss intro`, [bid]); check(Q.boss.thanks, `${qid} boss thanks`, [bid]);
        check(Q.gateOpen, `${qid} gateOpen`, []); check(Q.gateShut, `${qid} gateShut`, []);
    }
    for (const k of [0, 1, 2]) check(ST.HOMECOMING[k], `homecoming ${k}`, []);
    check(ST.INTRO, 'intro', []); check(ST.PIP_TUTORIAL, 'tutorial', []);
    ok(ST.ENDING.length >= 5 && ST.ENDING.every((p) => p.title && p.text.length > 40), 'the ending has its panels');
    // the cast's lines at every act
    for (let a = 0; a <= 4; a++) {
        const G = Gm.newGame(1); G.act = a; G.flags.met = true; G.flags.ossaMet = true;
        check(ST.claspLines(G), `clasp act ${a}`, []); check(ST.ossaLines(G), `ossa act ${a}`, []);
    }
    // walk-ins for every act and many seeds have valid specs
    let bad = 0;
    for (let a = 0; a <= 4; a++) {
        const r = makeRng(a + 1);
        for (let i = 0; i < 60; i++) {
            const w = ST.makeWalkin(a, r, 'w');
            const spec = ST.scanSpecFor(w);
            const kinds = spec.kinds.map((k) => (Array.isArray(k) ? k[0] : k));
            if (!spec.mask || !spec.goals.every((g) => !['kind'].includes(g.t) || kinds.includes(g.v))) bad++;
            if (!w.ailment || !SP.SPECIES[w.species]) bad++;
        }
    }
    ok(bad === 0, `300 walk-ins are well formed (${bad} bad)`);
    ok(A.codexEntries().length === 33, `the codex has 33 entries (${A.codexEntries().length})`);
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); Bt.botRun(G, b, secs, DT); return G; };
    const a = play(42, 60), b = play(42, 60);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    // round trip mid-world and mid-scan
    let G = Gm.newGame(7);
    const bot = Bt.makeBot({ seed: 3 });
    Bt.botRun(G, bot, 600, DT, (g) => !!g.scan && g.scan.S.used >= 2);
    ok(!!G.scan, 'reached the middle of a scan');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
    Bt.botRun(G, b1, 120, DT); Bt.botRun(copy, b2, 120, DT);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-scan plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('campaign')) {
    section(`campaign (${CAMPAIGN_SEEDS} seeds)`);
    for (let s = 1; s <= CAMPAIGN_SEEDS; s++) {
        for (const skill of [1, 0.6]) {
            const G = Gm.newGame(s * 101);
            const bot = Bt.makeBot({ skill, seed: s, days: 1 });
            let bad = null, t = 0, acts = 0;
            const seen = {};
            while (t < 6000 && !G.flags.won && !bad) {
                const inp = Bt.botTick(G, bot, DT);
                if (inp) { Gm.step(G, inp, DT); t += DT; } else if (++acts > 300000) bad = 'too many actions';
                for (const e of G.events) seen[e.type] = (seen[e.type] || 0) + 1;
                G.events.length = 0;
                const P = G.player;
                if (!Number.isFinite(P.x) || !Number.isFinite(P.z) || !Number.isFinite(P.yaw)) bad = 'non-finite player';
                else if (W.blocked(G, Math.floor(P.x / C.CELL), Math.floor(P.z / C.CELL))) bad = `inside a wall at ${(P.x / 2).toFixed(1)},${(P.z / 2).toFixed(1)} on ${G.map}`;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            ok(G.flags.won, `seed ${s} skill ${skill}: reaches the ending (${G.flags.won ? 'won' : `stuck: ${G.map} "${Gm.objective(G, { bot: true }).text}"`})`);
            ok(G.evidence.length === 4 && G.relics.length === 3 && G.senses.length === 4, `seed ${s} skill ${skill}: 4 evidence, 3 relics, 4 senses`);
            console.log(`  seed ${s} skill ${skill}: ${(t / 60).toFixed(1)} min walking · level ${G.level} · ${G.stats.healed} healed · ${(G.stats.stars / Math.max(1, G.stats.healed)).toFixed(2)}★ avg · ${G.stats.tonics} tonics · ${bot.quits || 0} retries · ${G.gold} petals · ${Object.keys(G.skills).length} skills · ${G.codex.length}/33 codex`);
        }
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
