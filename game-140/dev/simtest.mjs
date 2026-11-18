/**
 * simtest.mjs — headless checks of The Last Apprentice's story and rules. No browser.
 *
 *   node game-140/dev/simtest.mjs            # everything
 *   ONLY=purity,data,wards node game-140/dev/simtest.mjs
 *   SEEDS=200 VERBOSE=1 node game-140/dev/simtest.mjs
 *
 * purity       js/sim, js/rng.js, js/config.js never touch the DOM, storage, Math.random or the clock
 * data         every script lints (labels, directives, speakers); every @bg/@cg/portrait is listed in js/assets.js,
 *              has a prompt in dev/art/prompts.mjs and (unless NOART=1) a file on disk; every voiced clip exists
 * rules        effects and conditions; camp rules; ward turning and coupling
 * wards        every ward on SEEDS seeds: solvable, inside its moves band, hint walks a shortest path, unseal opens it
 * determinism  same seed + same commands = same game; save round trip mid-scene, mid-ward and mid-camp plays on identically
 * routes       the bot plays the whole story under several policies and camp plans; each route reaches the end with
 *              the flags it should (Aldwin lives or falls, Caius turns or not, Odrane's mercy, the epilogue variants),
 *              and every hue is restored; the balance table prints hope and mercy per route
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 60);
const want = (n) => !ONLY.length || ONLY.includes(n);

const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Sc = await import('../js/sim/scene.js');
const Ru = await import('../js/sim/rules.js');
const Wd = await import('../js/sim/ward.js');
const { SCENES } = await import('../js/sim/data/story.js');
const { TALKS, CAMP_INTRO } = await import('../js/sim/data/camps.js');
const { CAST } = await import('../js/sim/data/cast.js');
const { CHAPTERS, WARDS, WARD_ORDER, HUES } = await import('../js/sim/data/chapters.js');
const { LORE } = await import('../js/sim/data/lore.js');
const A = await import('../js/assets.js');
const P = await import('./art/prompts.mjs');
const { voiceKey, voiceable } = await import('../js/voicekey.js');
const { VOICED } = await import('../js/voices.js');

let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg); return c; };
const section = (n) => console.log(`\n== ${n}`);

/** Every script in the game: [name, lines]. */
function allScripts() {
    const out = Object.entries(SCENES).map(([k, v]) => ['scene ' + k, v]);
    for (const w in TALKS) TALKS[w].forEach((l, i) => out.push([`talk ${w} ${i}`, l]));
    for (const n in CAMP_INTRO) out.push(['camp ' + n, CAMP_INTRO[n]]);
    return out;
}

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|vn|assets)/.test(src), `${f} imports nothing from the view side`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('data')) {
    section('data');
    const castIds = new Set(Object.keys(CAST));
    const bgs = new Set(), cgs = new Set(), pors = new Set();
    let lines = 0, voiced = 0, chars = 0;
    for (const [name, script] of allScripts()) {
        const errs = Sc.lintScript(script, castIds);
        ok(!errs.length, `${name} lints${errs.length ? ': ' + errs.join('; ') : ''}`);
        for (const raw of script) {
            const L = Sc.parseLine(raw);
            if (L.kind === 'dir' && L.cmd === 'bg') bgs.add(L.arg);
            if (L.kind === 'dir' && L.cmd === 'cg' && L.arg) cgs.add(L.arg);
            if (L.kind === 'dir' && L.cmd === 'show') { const [id, ex] = L.arg.split(' ')[0].split('.'); pors.add(A.portraitKey(id, ex)); }
            if (L.kind === 'say') {
                lines++;
                if (L.who !== 'n' && L.who !== 'you') pors.add(A.portraitKey(L.who, L.expr));
                if (L.who !== 'n' && L.who !== 'you' && L.expr !== 'neutral') ok(CAST[L.who].exprs.includes(L.expr) || ['happy', 'sad', 'angry'].includes(L.expr), `${name}: ${L.who}.${L.expr} is a known expression`);
                if (voiceable(L.who, L.text)) { voiced++; chars += L.text.length; }
            }
            if (L.kind === 'say' || L.kind === 'choice') {
                const texts = L.kind === 'say' ? [L.text] : L.opts.map((o) => o.t);
                for (const t of texts) ok(!/["]/.test(t), `${name}: no straight double quote in "${t.slice(0, 30)}"`);
            }
            if (L.kind === 'dir' && L.cmd === 'music') ok(A.MUSIC.includes(L.arg), `${name}: music ${L.arg} exists`);
            if (L.kind === 'dir' && L.cmd === 'sfx') ok(A.SFX.includes(L.arg), `${name}: sfx ${L.arg} exists`);
        }
    }
    for (const b of bgs) ok(A.BGS.includes(b), `bg ${b} is listed in assets.js`);
    for (const c of cgs) ok(A.CGS.includes(c), `cg ${c} is listed in assets.js`);
    for (const p of pors) ok(A.PORS.includes(p), `portrait ${p} is listed in assets.js`);
    for (const b of A.BGS) ok(bgs.has(b) || b === 'map', `bg ${b} is used`);
    for (const c of A.CGS) ok(cgs.has(c), `cg ${c} is used`);
    for (const b of A.BGS) ok(P.BG[b], `bg ${b} has a prompt`);
    for (const c of A.CGS) ok(P.CG[c], `cg ${c} has a prompt`);
    if (!process.env.NOART) {
        for (const b of A.BGS) ok(fs.existsSync(path.join(ROOT, A.ART.bg(b))), `bg ${b} is on disk`);
        for (const c of A.CGS) ok(fs.existsSync(path.join(ROOT, A.ART.cg(c))), `cg ${c} is on disk`);
        for (const p of A.PORS) ok(fs.existsSync(path.join(ROOT, A.ART.por(p))), `portrait ${p} is on disk`);
        ok(fs.existsSync(path.join(ROOT, A.ART.title)), 'the title painting is on disk');
    }
    for (const k of VOICED) ok(fs.existsSync(path.join(ROOT, `audio/vo/${k}.mp3`)), `voice clip ${k} is on disk`);
    // every line the voice script records has a clip (a line edited after recording loses its voice: re-record it)
    const { allLines } = await import('./audio/voices.mjs');
    const want = allLines();
    const missing = want.filter((L) => !VOICED.has(L.key));
    ok(!missing.length, `all ${want.length} recorded lines have a clip${missing.length ? ': missing ' + missing.slice(0, 3).map((L) => `${L.who} "${L.text.slice(0, 30)}"`).join(', ') : ''}`);
    ok(want.length === VOICED.size, `no stale clips (${VOICED.size} clips for ${want.length} lines)`);
    // every scene and ward the chapters name exists; every chapter is reachable in order
    for (const c of CHAPTERS) for (const s of c.segs) {
        if (typeof s === 'string') ok(SCENES[s], `${c.id}: scene ${s} exists`);
        else if (s.ward) ok(WARDS[s.ward], `${c.id}: ward ${s.ward} exists`);
    }
    ok(WARD_ORDER.every((w) => CHAPTERS.some((c) => c.segs.some((s) => s.ward === w))), 'every ward is in a chapter');
    ok(new Set(WARD_ORDER.map((w) => WARDS[w].hue)).size === 7, 'the seven wards restore seven different hues');
    ok(HUES.reduce((a, h) => a + (h.hi > h.lo ? h.hi - h.lo : 1 - h.lo + h.hi), 0) > 0.999, 'the hue bands cover the whole colour wheel');
    for (const l of LORE) if (l.if) { try { Ru.evalCond(Gm.newGame(1), l.if); ok(true, ''); } catch (e) { ok(false, `lore ${l.id}: ${e.message}`); } }
    ok(/hope>=12/.test(SCENES['dream-bloom'].join('\n')), 'Odrane\'s mercy threshold in the script matches config');
    console.log(`  ${allScripts().length} scripts, ${lines} lines (${voiced} voiceable, ${chars} chars), ${bgs.size} backdrops, ${cgs.size} CGs, ${pors.size} portraits`);
}

if (want('rules')) {
    section('rules');
    const G = Gm.newGame(3);
    Ru.applyFx(G, 'hope+2 mercy+1 b.edda+3 flag:x');
    ok(G.hope === 2 && G.mercy === 1 && G.bond.edda === 3 && G.flags.x, 'effects apply');
    Ru.applyFx(G, '!flag:x hope-5');
    ok(!G.flags.x && G.hope === 0, 'flags clear and hope never goes below zero');
    ok(Ru.evalCond(G, 'b.edda>=3 & !flag:x & hope==0'), 'conditions combine');
    let threw = false; try { Ru.applyFx(G, 'b.nobody+1'); } catch { threw = true; }
    ok(threw, 'an unknown companion is an error, not a silent no-op');

    // a scene: first line, choices filtered by their condition
    const S = Gm.newGame(5);
    ok(S.phase === 'scene' && S.scene.id === 'prologue' && S.scene.cur.who === 'n', 'a new game starts in the prologue');
    ok(S.stage.bg === 'ravenmoor' && S.stage.music === 'ravenmoor', 'the prologue sets its backdrop and music');
    ok(!Gm.act(S, { t: 'choose', i: 0 }), 'choose is refused on a line of dialogue');
    ok(!Gm.act(S, { t: 'turn', ring: 0, dir: 1 }), 'turn is refused outside a ward');

    // ward rules
    const w = Wd.makeWard('forge', 11);
    const before = w.off.slice();
    Wd.turn(w, 0, 1);
    ok(w.off[0] === (before[0] + 1) % 8 && w.off[1] === (before[1] + 1) % 8, 'turning the forge\'s outer ring turns the inner one too');
    const t = Wd.makeWard('tide', 4); const b2 = t.off.slice(); Wd.turn(t, 1, 1);
    ok(t.off[2] === (b2[2] + 7) % 8 && t.off[0] === b2[0], 'the tide\'s middle ring turns the inner one the other way');

    // camp: two talks a night, the third Aldwin talk sets his oath, a gone companion is not at the fire
    const C = Gm.newGame(9);
    C.ch = 2; C.seg = 4; C.flags.aldwin = true;
    C.camp = { night: 1, left: 2, done: [] }; C.phase = 'camp'; C.scene = null;
    ok(Gm.campChoices(C).map((c) => c.who).join() === 'edda,aldwin', 'the first night: Edda and Aldwin are at the fire');
    ok(Gm.act(C, { t: 'sit', who: 'aldwin' }) && C.phase === 'scene' && C.scene.kind === 'talk', 'sitting with Aldwin starts his first talk');
    while (C.phase === 'scene') { const cur = C.scene.cur; Gm.act(C, cur.choice ? { t: 'choose', i: cur.choice[0].i } : { t: 'advance' }); }
    ok(C.phase === 'camp' && C.camp.left === 1 && C.talk.aldwin === 1, 'after the talk, back at the fire with one talk left');
    ok(!Gm.campChoices(C).some((c) => c.who === 'aldwin'), 'the same companion twice in one night is not offered');
    C.flags.aldwinfell = true;
    C.camp.done = [];
    ok(!Gm.campChoices(C).some((c) => c.who === 'aldwin'), 'Aldwin is not at the fire after the bridge');
    ok(Gm.act(C, { t: 'sleep' }) && C.phase !== 'camp', 'sleep ends the night');
}

if (want('wards')) {
    section('wards');
    const rows = [];
    for (const id of WARD_ORDER) {
        const W = WARDS[id];
        let bad = 0, lens = [];
        for (let s = 1; s <= SEEDS; s++) {
            const w = Wd.makeWard(id, s * 7919 + 13);
            const len = Wd.solveLength(w);
            lens.push(len);
            if (!(len >= W.moves[0] && len <= W.moves[1])) bad++;
            if (w.rings.some((r, i) => r.filter((x) => x === w.key[i]).length !== 1)) bad++;
            // walking the hints solves it in exactly the shortest number of turns
            let n = 0;
            for (let h = Wd.hint(w); h; h = Wd.hint(w)) { Wd.turn(w, h.ring, h.dir); n++; if (n > 50) break; }
            if (!Wd.isSolved(w) || n !== len) bad++;
        }
        ok(!bad, `${id}: ${SEEDS} seeds solvable inside [${W.moves}] with the key rune once per ring, hints walk a shortest path`);
        rows.push(`${id} ${W.rings} rings: shortest ${Math.min(...lens)}–${Math.max(...lens)}, mean ${(lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1)}`);
    }
    // in the game: turn to open, unseal, events and the hue
    const G = Gm.newGame(21);
    const bot = Bt.makeBot({ policy: 'kind' });
    while (G.phase !== 'ward') { Gm.act(G, Bt.botCommand(G, bot)); G.events.length = 0; }
    ok(G.ward.id === 'rose' && G.hues.every((h) => !h), 'the first ward is the Rose Ward, and the world is grey');
    ok(Gm.act(G, { t: 'hint' }) && G.events.some((e) => e.type === 'hint') && G.ward.hints === 1, 'a hint names a turn');
    ok(Gm.act(G, { t: 'unseal' }) && G.hues[0] === 1 && G.events.some((e) => e.type === 'hue' && e.hue === 0), 'unsealing opens it and restores crimson');
    ok(G.phase === 'scene' && G.scene.id === 'rose-bloom', 'the bloom scene follows');
    for (const r of rows) console.log('  ' + r);
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, n) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ policy: 'random', seed }); for (let i = 0; i < n && G.phase !== 'end'; i++) { Gm.act(G, Bt.botCommand(G, b)); G.events.length = 0; } return G; };
    ok(JSON.stringify(Gm.serialize(play(42, 600))) === JSON.stringify(Gm.serialize(play(42, 600))), 'same seed and commands, same game');
    for (const stop of ['scene', 'ward', 'camp']) {
        const G = Gm.newGame(77);
        const b = Bt.makeBot({ policy: 'random', seed: 3 });
        let n = 0;
        while (n < 5000 && !(G.phase === stop && n > 40)) { Gm.act(G, Bt.botCommand(G, b)); G.events.length = 0; n++; }
        if (!ok(G.phase === stop, `reached a ${stop} to save in`)) continue;
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot({ policy: 'random', seed: 9 }), b2 = Bt.makeBot({ policy: 'random', seed: 9 });
        Bt.playThrough(G, b1); Bt.playThrough(copy, b2);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip in a ${stop} plays on identically to the end`);
    }
    let threw = false; try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('routes')) {
    section('routes');
    const ROUTES = [
        { name: 'kind, Aldwin first', policy: 'kind', camp: ['aldwin', 'edda', 'kestrel', 'ione', 'caius'], expect: { caiusturned: true, aldwinlived: true, odranemercy: true } },
        { name: 'kind, Edda and Kestrel', policy: 'kind', camp: ['edda', 'kestrel', 'ione', 'caius'], expect: { caiusturned: true, aldwinlived: true } },
        { name: 'harsh, Aldwin first', policy: 'harsh', camp: ['aldwin', 'edda', 'kestrel', 'ione'], expect: { caiusturned: false, aldwinlived: true, aldwinfell: false, odranefell: true } },
        { name: 'harsh, never Aldwin', policy: 'harsh', camp: ['edda', 'kestrel', 'ione'], expect: { caiusturned: false, aldwinfell: true, odranefell: true } },
        { name: 'harsh, no talks', policy: 'harsh', camp: [], expect: { aldwinfell: true } },
    ];
    const table = [];
    for (const R of ROUTES) {
        for (const seed of [1, 2, 3]) {
            const G = Gm.newGame(seed * 101);
            const bot = Bt.makeBot({ policy: R.policy, camp: R.camp, seed });
            let err = null;
            try { Bt.playThrough(G, bot); } catch (e) { err = e.message; }
            ok(!err && G.phase === 'end', `${R.name} (seed ${seed}) reaches the end${err ? ': ' + err : ''}`);
            ok(G.hues.every((h) => h === 1), `${R.name}: all seven hues restored`);
            ok(G.flags.theend, `${R.name}: the epilogue played to its last line`);
            for (const [f, v] of Object.entries(R.expect)) ok(!!G.flags[f] === v, `${R.name} (seed ${seed}): ${f} is ${v}`);
            ok(!(G.flags.aldwinlived && G.flags.aldwinfell), `${R.name}: Aldwin did not both live and fall`);
            if (seed === 1) table.push(`${R.name.padEnd(24)} hope ${String(G.hope).padStart(2)}  mercy ${G.mercy}  talks ${Object.entries(G.talk).filter(([, n]) => n).map(([k, n]) => k + n).join(' ') || '-'}  cgs ${G.seenCg.length}  lines ${G.stats.lines}`);
        }
    }
    // a random walk through choices never gets stuck, on many seeds
    let stuck = 0;
    for (let s = 1; s <= Math.min(SEEDS, 40); s++) {
        const G = Gm.newGame(s);
        try { Bt.playThrough(G, Bt.makeBot({ policy: 'random', seed: s, skill: 0.7, camp: ['ione', 'kestrel', 'edda', 'aldwin', 'caius'] })); } catch { stuck++; }
        if (G.phase !== 'end' || !G.hues.every(Boolean)) stuck++;
    }
    ok(!stuck, `random choices at skill 0.7 finish the story on ${Math.min(SEEDS, 40)} seeds`);
    console.log('  ' + table.join('\n  '));
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
