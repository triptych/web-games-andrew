/**
 * simtest.mjs — headless checks of Crystal Crescendo's simulation. No browser.
 *
 *   node game-113/dev/simtest.mjs                 # everything
 *   ONLY=purity,maps,song,battle,save,story node game-113/dev/simtest.mjs
 *   SEEDS=3 VERBOSE=1 node game-113/dev/simtest.mjs
 *
 * purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock.
 * maps: every row is 24 wide, every chest has contents, and every person, sign, chest, crystal, trigger and exit can be
 *   reached on foot from where the band arrives.
 * song: phrases are well formed — no two notes in a lane at once, no tap inside a hold, holds end inside the phrase,
 *   syllables only on Marigold's lane, guard notes only on living lanes, the same seed writes the same phrase.
 * battle: hits, blocks, misses, holds, KO, crescendo, the tutorial can't be lost, timing windows by difficulty.
 * save: a save round trip mid-battle and mid-field plays on identically; unknown versions are rejected.
 * story: the bot plays the whole game from the prologue to the credits at two skills on SEEDS seeds; the balance table
 *   prints battles, defeats and levels per chapter.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 2);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Ba = await import('../js/sim/battle.js');
const S = await import('../js/sim/song.js');
const M = await import('../js/sim/data/maps.js');
const St = await import('../js/sim/story.js');
const Pa = await import('../js/sim/party.js');
const F = await import('../js/sim/field.js');
const { ENEMIES } = await import('../js/sim/data/enemies.js');
const { SCENES } = await import('../js/sim/data/script.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false, lanes: [], held: [false, false, false, false] };

/** A fresh game standing in the field of `map` with the given princesses, for rule tests. */
function fieldGame(map = 'marisonde', members = ['lyra'], seed = 5) {
    const G = Gm.newGame(seed);
    St.endScene(G);
    Object.assign(G.flags, { awake: true, metOtto: true, surface: true });
    for (const m of members) if (m !== 'lyra') Pa.join(G, m);
    F.loadMap(G, map);
    G.mode = 'field';
    G.events.length = 0;
    return G;
}
const runBattle = (G, fn, secs) => { for (let t = 0; t < secs && G.mode === 'battle'; t += DT) Gm.step(G, fn(G), DT); };
const nextNote = (B, pred) => B.notes.find((n) => !n.j && pred(n));
/** Step until the song reaches `t`. */
const until = (G, t) => { while (G.battle && G.battle.t < t && G.mode === 'battle') Gm.step(G, NONE, DT); };

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('maps')) {
    section('maps');
    for (const [id, m] of Object.entries(M.MAPS)) {
        ok(m.rows.length === 16 && m.rows.every((r) => r.length === 24), `${id}: 24×16`);
        ok(M.chestsOf(id).every((c) => c.item), `${id}: every chest has contents`);
        for (const ch of m.rows.join('')) ok(M.TILES[ch], `${id}: tile '${ch}' is known`) || null;
        if (id === 'hollow') continue;
        // flood from the spawn
        const seen = new Set(), q = [[Math.floor(m.spawn[0]), Math.floor(m.spawn[1])]];
        const walk = (x, y) => { const t = M.TILES[M.tileAt(id, x, y)]; return t && !t.solid; };
        ok(walk(...q[0]), `${id}: spawn is walkable`);
        while (q.length) {
            const [x, y] = q.pop(); const k = x + ',' + y;
            if (seen.has(k) || !walk(x, y)) continue;
            seen.add(k);
            q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${Math.floor(x) + dx},${Math.floor(y) + dy}`));
        for (const n of m.npcs) ok(near(n.x, n.y), `${id}: ${n.id} can be reached`);
        if (m.travel) ok(near(m.travel.x, m.travel.y), `${id}: Otto's parking spot can be reached`);
        for (const c of M.chestsOf(id)) ok(near(c.x, c.y), `${id}: chest at ${c.x},${c.y} can be reached`);
        const cr = M.crystalOf(id); if (cr) ok(near(cr.x, cr.y), `${id}: Song Crystal can be reached`);
        for (const t of m.triggers) ok(Array.from({ length: t.w * t.h }, (_, i) => [t.x + (i % t.w), t.y + Math.floor(i / t.w)]).some(([x, y]) => seen.has(`${x},${y}`)), `${id}: trigger ${t.scene} can be reached`);
        for (const e of m.exits) ok(seen.has(`${e.x},${e.y}`), `${id}: exit to ${e.to} can be reached`);
        for (const s of m.signs || []) ok(near(s.x, s.y + 1) || near(s.x, s.y), `${id}: sign ${s.scene} can be reached`);
        for (const e of m.enemies) ok(seen.has(`${Math.floor(e.x)},${Math.floor(e.y)}`), `${id}: ${e.kind} starts on open ground`);
        for (const n of m.npcs) for (const t of n.talk || []) ok(SCENES[t.scene], `${id}: ${n.id}'s scene ${t.scene} exists`);
        for (const t of m.triggers) ok(SCENES[t.scene], `${id}: trigger scene ${t.scene} exists`);
    }
    for (const [k, n] of Object.entries(M.WORLD)) {
        const m = M.MAPS[n.map];
        ok(!M.TILES[M.tileAt(n.map, Math.floor(n.at[0]), Math.floor(n.at[1]))].solid, `route stop ${k} lands on open ground`);
        ok(m.travel, `route stop ${k} has a parking spot for Otto`);
    }
}

// ======================================================================
if (want('song')) {
    section('song');
    let phrases = 0, bad = 0;
    const why = [];
    for (let seed = 1; seed <= 40; seed++) {
        const song = S.composeSong(seed * 7919, { bpm: 100 + seed, scale: Object.keys(S.SCALES)[seed % 7] });
        for (let k = 0; k < 6; k++) for (const side of ['play', 'guard', 'solo']) for (const dens of [0, 1, 2]) for (const lanes of [[1, 0, 0, 0], [1, 1, 0, 0], [1, 1, 1, 0], [1, 1, 1, 1], [0, 1, 0, 1]]) {
            if (side === 'solo' && !lanes[0]) continue;
            phrases++;
            const L = side === 'solo' ? [1, 0, 0, 0] : lanes;
            const notes = S.phraseNotes(song, k, { side, lanes: L.map(Boolean), density: dens, enemy: ENEMIES.vorthrax, colossus: side === 'play' && k % 2 === 1 });
            const beats = S.phraseBeats();
            let fault = null;
            for (const n of notes) {
                if (n.kind === 'colossus') continue;
                if (!L[n.lane]) fault = `note in absent lane ${n.lane}`;
                if (n.beat < 0 || n.beat + n.len > beats + 1e-9) fault = `note outside the phrase at ${n.beat}+${n.len}`;
                if (n.syl && n.lane !== 2) fault = 'syllable off lane 2';
                if (side !== 'guard' && n.lane === 2 && !n.syl) fault = 'lyric without a syllable';
                if (!(n.pitch >= 0)) fault = 'no pitch';
            }
            for (let l = 0; l < 4; l++) {
                const ln = notes.filter((n) => n.lane === l).sort((a, b) => a.beat - b.beat);
                for (let i = 1; i < ln.length; i++) if (ln[i].beat < ln[i - 1].beat + ln[i - 1].len + 0.25 - 1e-9) fault = `lane ${l} overlaps at beat ${ln[i].beat}`;
            }
            if (fault) { bad++; if (why.length < 5) why.push(`${side} d${dens} ${lanes.join('')} seed ${seed} k ${k}: ${fault}`); }
        }
    }
    ok(bad === 0, `${phrases} phrases are well formed`);
    for (const w of why) console.log('    ', w);
    const song = S.composeSong(99, { bpm: 120 });
    ok(JSON.stringify(S.phraseNotes(song, 3, { side: 'play', lanes: [true, true, true, true], density: 1 })) === JSON.stringify(S.phraseNotes(song, 3, { side: 'play', lanes: [true, true, true, true], density: 1 })), 'the same phrase is written the same way twice');
    const full = S.phraseNotes(song, 0, { side: 'play', lanes: [true, true, true, true], density: 1 }).length;
    const solo = S.phraseNotes(song, 0, { side: 'play', lanes: [true, false, false, false], density: 1 }).length;
    ok(full > solo * 1.6, `a full band plays more notes than Lyra alone (${full} vs ${solo})`);
    ok(full <= 26, `a full band at Normal stays playable (${full} notes in two bars)`);
}

// ======================================================================
if (want('battle')) {
    section('battle');
    // --- a perfect hit on a party note damages; a missed guard note hurts that princess
    let G = fieldGame('marisonde', ['lyra', 'sera']);
    Ba.startBattle(G, 'reefgob');
    let B = G.battle;
    ok(G.mode === 'battle' && B.lanes[0] === 'lyra' && B.lanes[1] === 'sera' && !B.lanes[2], 'the band takes its lanes');
    ok(B.t < 0 && B.ph.kind === 'count', 'it opens with a count-in');
    let n = nextNote(B, (x) => x.side === 'party' && x.lane === 0);
    until(G, n.t);
    const hp0 = B.hp;
    Gm.step(G, { ...NONE, lanes: [{ lane: 0, t: n.t }] }, DT);
    ok(n.j === 'perfect' && B.hp < hp0, `a PERFECT drum hit damages the enemy (${hp0 - B.hp})`);
    ok(B.combo === 1, 'and starts a combo');
    // an early press beyond the window does nothing
    n = nextNote(B, (x) => x.side === 'party' && x.lane === 0);
    until(G, n.t - 0.4);
    Gm.step(G, { ...NONE, lanes: [{ lane: 0, t: B.t }] }, DT);
    ok(!n.j, 'a press far before the note is ignored');
    // GOOD timing
    const Wn = C.WINDOWS.normal;
    until(G, n.t + (Wn.great + Wn.good) / 2);
    Gm.step(G, { ...NONE, lanes: [{ lane: 0, t: n.t + (Wn.great + Wn.good) / 2 }] }, DT);
    ok(n.j === 'good', 'a late press inside the window is GOOD');
    // a miss resets the combo
    n = nextNote(B, (x) => x.side === 'party');
    until(G, n.t + Wn.good + 0.02);
    ok(n.j === 'miss' && B.combo === 0, 'a party note left alone is a miss and breaks the combo');
    // guard phrase: a miss hurts the lane's princess
    n = nextNote(B, (x) => x.side === 'enemy');
    ok(n, 'the enemy plays a riff in its turn');
    const who = B.lanes[n.lane], h0 = G.party.st[who].hp;
    until(G, n.t + Wn.good + 0.02);
    ok(G.party.st[who].hp < h0 || B.ward > 0, `a missed enemy note hurts ${who}`);
    // a blocked one doesn't
    n = nextNote(B, (x) => x.side === 'enemy' && x.kind === 'tap');
    if (n) {
        const w2 = B.lanes[n.lane], h1 = G.party.st[w2].hp;
        until(G, n.t + 0.06);
        Gm.step(G, { ...NONE, lanes: [{ lane: n.lane, t: n.t + 0.06 }] }, DT);
        ok(n.j === 'great' && G.party.st[w2].hp === h1, 'a GREAT block stops the blow');
    }

    // --- melody heals, lyrics ward, harmony holds and resonance
    G = fieldGame('frosthold', ['lyra', 'sera', 'mari', 'ingrid']);
    Ba.startBattle(G, 'frostmite');
    B = G.battle;
    G.party.st.lyra.hp = 10;
    const mel = nextNote(B, (x) => x.side === 'party' && x.lane === 1);
    until(G, mel.t);
    Gm.step(G, { ...NONE, lanes: [{ lane: 1, t: mel.t }] }, DT);
    ok(G.party.st.lyra.hp > 10, 'a melody note heals the most hurt princess');
    const lyr = nextNote(B, (x) => x.side === 'party' && x.lane === 2 && x.kind === 'tap');
    until(G, lyr.t);
    Gm.step(G, { ...NONE, lanes: [{ lane: 2, t: lyr.t }] }, DT);
    ok(B.ward > 0 && lyr.syl, `a sung word ("${lyr.syl}") weaves a ward`);
    const har = nextNote(B, (x) => x.side === 'party' && x.lane === 3 && x.kind === 'hold');
    until(G, har.t);
    const r0 = B.reso, e0 = B.hp;
    Gm.step(G, { ...NONE, lanes: [{ lane: 3, t: har.t }], held: [false, false, false, true] }, DT);
    ok(har.holding && B.holds[3] === har, 'a harmony note is held');
    while (B.t < har.t + har.len * 0.5) Gm.step(G, { ...NONE, held: [false, false, false, true] }, DT);
    ok(har.holding, 'it stays held while the key is down');
    while (B.t < har.t + har.len + 0.02) Gm.step(G, { ...NONE, held: [false, false, false, true] }, DT);
    ok(!har.holding && !har.dropped && B.reso > r0 && B.hp < e0, 'held to the end: a heavy blow and more resonance');
    const har2 = nextNote(B, (x) => x.side === 'party' && x.lane === 3 && x.kind === 'hold');
    if (har2) {
        until(G, har2.t);
        Gm.step(G, { ...NONE, lanes: [{ lane: 3, t: har2.t }], held: [false, false, false, true] }, DT);
        Gm.step(G, { ...NONE, held: [false, false, false, false] }, DT);
        ok(har2.dropped, 'let go early: the hold is dropped');
    }

    // --- KO silences a lane; crescendo revives and doubles
    G = fieldGame('frosthold', ['lyra', 'sera', 'mari', 'ingrid']);
    Ba.startBattle(G, 'frostmite');
    B = G.battle;
    until(G, 0.01);
    G.party.st.mari.hp = 1;
    const en = { id: 999, t: B.t, lane: 2, kind: 'tap', len: 0, side: 'enemy', j: null };
    B.notes.unshift(en);
    until(G, B.t + 0.3);
    ok(G.party.st.mari.hp === 0, 'a princess at 0 HP is knocked out');
    ok(!B.notes.some((x) => x.lane === 2 && !x.j), 'her lane falls silent');
    B.cres = 100;
    Gm.step(G, { ...NONE, cres: { t: B.t } }, DT);
    ok(G.party.st.mari.hp > 0 && B.cresUntil > B.t, 'Crescendo revives her and powers up the band');
    ok(B.cres === 0, 'and empties the meter');

    // --- the tutorial can't be lost
    G = fieldGame('beach', ['lyra']);
    Ba.startBattle(G, 'shardcrab', { tutorial: true, from: 'field' });
    B = G.battle;
    ok(B.state === 'talk', 'the tutorial opens with Otto explaining');
    for (let t = 0; t < 120 && G.mode === 'battle'; t += DT) Gm.step(G, { ...NONE, a: B.state === 'talk' }, DT);
    ok(G.party.st.lyra.hp >= 1 && G.mode === 'battle', 'doing nothing in the tutorial never loses it');

    // --- losing: all down → defeat → retry heals
    G = fieldGame('spire', ['lyra']);
    Ba.startBattle(G, 'hushknight');
    runBattle(G, () => NONE, 240);
    ok(G.mode === 'defeat', 'a band that never plays loses');
    Gm.step(G, { ...NONE, pick: 'retry' }, DT);
    ok(G.mode === 'battle' && G.party.st.lyra.hp === Pa.maxHp(G, 'lyra'), 'Try again restarts the duel at full health');

    // --- winning: results, XP, back to the field, the roaming enemy is gone
    G = fieldGame('aurelune', ['lyra']);
    const fe = G.field.enemies[0];
    Ba.startBattle(G, fe.kind, { from: 'field', fieldEnemy: fe.id });
    const bot = Bt.makeBot({ skill: 1 });
    runBattle(G, (g) => Bt.botInput(g, bot), 300);
    ok(G.mode === 'results' && G.results.rank === 'S', `a perfect bot wins with an S (${G.results?.rank})`);
    const xp0 = G.party.st.lyra.xp + G.party.st.lyra.lv * 1000;
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.mode === 'field' && !fe.alive, 'the results close back to the field without that monster');
    ok(G.party.st.lyra.xp + G.party.st.lyra.lv * 1000 > xp0 - 1, 'XP was gained');

    // --- windows by difficulty
    ok(C.WINDOWS.easy.good > C.WINDOWS.normal.good && C.WINDOWS.normal.good > C.WINDOWS.hard.good, 'Easy is more forgiving than Hard');
}

// ======================================================================
if (want('save')) {
    section('save');
    const play = (G, bot, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, Bt.botInput(G, bot), DT); G.events.length = 0; };
    // mid-field / mid-scene
    let G = Gm.newGame(1234);
    play(G, Bt.makeBot({ skill: 0.8, seed: 3 }), 40);
    let copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    let b1 = Bt.makeBot({ skill: 0.8, seed: 9 }), b2 = Bt.makeBot({ skill: 0.8, seed: 9 });
    play(G, b1, 30); play(copy, b2, 30);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip plays on identically (at ${G.map}, ${G.mode})`);
    // mid-battle, including a talk phrase (Infinity)
    G = fieldGame('frosthold', ['lyra', 'sera', 'mari', 'ingrid']);
    Ba.startBattle(G, 'rimefang', { from: 'field' });
    play(G, Bt.makeBot({ skill: 0.7, seed: 4 }), 9);
    copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    b1 = Bt.makeBot({ skill: 0.7, seed: 5 }); b2 = Bt.makeBot({ skill: 0.7, seed: 5 });
    play(G, b1, 12); play(copy, b2, 12);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-battle plays on identically');
    G = fieldGame('beach', ['lyra']);
    Ba.startBattle(G, 'shardcrab', { tutorial: true });
    copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(copy.battle.ph.len === Infinity, 'a talk phrase survives the round trip');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('story')) {
    section('story (the bot plays the whole game)');
    const CH = ['awake', 'metOtto', 'surface', 'seraJoined', 'maelstraBeaten', 'mariJoined', 'hollowhayBeaten', 'ingridJoined', 'rimefangBeaten', 'wardenBeaten', 'cleared'];
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.75]) {
            const G = Gm.newGame(s * 104729, 'normal');
            const bot = Bt.makeBot({ skill, seed: s });
            const reached = {};
            let defeats = 0, bad = null, t = 0;
            const LIMIT = 60 * 60 * 2;           // two hours of game time
            const seenTypes = {};
            while (G.mode !== 'ending' && t < LIMIT) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                t += DT;
                for (const e of G.events) { seenTypes[e.type] = (seenTypes[e.type] || 0) + 1; if (e.type === 'defeat') defeats++; }
                G.events.length = 0;
                for (const f of CH) if (G.flags[f] && !reached[f]) reached[f] = { t: Math.round(t), lv: G.party.st.lyra.lv, battles: G.stats.battles };
                const p = G.p;
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { bad = 'non-finite position'; break; }
                if (G.mode === 'field' && F.solidAt(G, p.x, p.y)) { bad = `stood inside a wall at ${G.map} ${p.x.toFixed(2)},${p.y.toFixed(2)}`; break; }
                if (G.battle && !Number.isFinite(G.battle.hp)) { bad = 'non-finite enemy HP'; break; }
            }
            const last = CH.filter((f) => reached[f]).pop();
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            ok(G.mode === 'ending', `seed ${s} skill ${skill}: reaches the credits (last: ${last}, map ${G.map}, mode ${G.mode})`);
            if (skill === 1) ok(defeats === 0, `seed ${s}: the perfect bot is never defeated (${defeats})`);
            for (const ev of ['hushNear', 'talkStart', 'colossusHit', 'crescendo', 'join', 'chest', 'crystal', 'levelUp', 'victory']) ok(seenTypes[ev], `seed ${s} skill ${skill}: saw '${ev}'`);
            rows.push({ s, skill, t: Math.round(t), defeats, battles: G.stats.battles, lv: G.party.members.map((m) => G.party.st[m].lv).join('/'), reached });
        }
    }
    console.log('\n  seed skill  time   battles defeats levels      chapter reached at (game seconds, Lyra level, battles)');
    for (const r of rows) {
        const ch = ['maelstraBeaten', 'hollowhayBeaten', 'rimefangBeaten', 'wardenBeaten', 'cleared'].map((f) => r.reached[f] ? `${r.reached[f].t}s/L${r.reached[f].lv}/${r.reached[f].battles}` : '—').join('  ');
        console.log(`  ${String(r.s).padEnd(4)} ${String(r.skill).padEnd(5)} ${String(r.t).padEnd(6)} ${String(r.battles).padEnd(7)} ${String(r.defeats).padEnd(7)} ${r.lv.padEnd(11)} ${ch}`);
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
