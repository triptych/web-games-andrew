/**
 * simtest.mjs — headless checks of Starbase Spooky's simulation. No browser.
 *
 *   node game-130/dev/simtest.mjs            # everything
 *   ONLY=purity,data,rules,puzzles,determinism,bot node game-130/dev/simtest.mjs
 *   SEEDS=40 VERBOSE=1 node game-130/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the clock.
 * 2. data: every line any code or table refers to exists and has a voice clip; every question has a valid answer;
 *    every spot sits inside the canvas; every art file the game loads exists.
 * 3. rules: the day's jobs, the visitor's quiz (right, wrong, stickers, facts), clues and their gates (dark garden,
 *    the Glow-o-Meter), repairs, bedtime, the mystery's three questions, the vents, the ending.
 * 4. puzzles: every generated puzzle on hundreds of seeds is solvable with solveMove, and wrong taps never lock it.
 * 5. determinism: same seed and commands -> same game; a save round trip mid-game plays on identically.
 * 6. bot: whole games at two skill levels on SEEDS seeds finish all five days with per-step invariants, and the
 *    balance table is printed and checked against bands.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 24);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Pz = await import('../js/sim/puzzles.js');
const { ROOMS, MAP_SPOTS, W, H, RING, neighbor, wayTo } = await import('../js/sim/data/rooms.js');
const S = await import('../js/sim/data/story.js');
const Q = await import('../js/sim/data/questions.js');
const { CAST } = await import('../js/sim/data/cast.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const clear = (G) => { G.events.length = 0; };

/** Run the sim until Kit stops walking (or a line appears). */
function settle(G, max = 20) {
    for (let t = 0; t < max && (G.kit.tx !== null || (G.puzzle && G.puzzle.show)) && !G.over; t += DT) Gm.step(G, DT);
}
/** Click through every line until something that isn't a line is in front. */
function talk(G) { let n = 0; while (Gm.front(G)?.say && n++ < 200) Gm.act(G, { t: 'next' }); }
/** Tap a spot and walk there; a spooky moment on the way is clicked through like a child would. */
function tap(G, spot) {
    const r = Gm.act(G, { t: 'tap', spot });
    for (let k = 0; k < 10; k++) {
        settle(G);
        if (/^orby\.spook/.test(Gm.front(G)?.say || '')) Gm.act(G, { t: 'next' }); else break;
    }
    return r;
}
function go(G, room) { if (G.room !== room) Gm.act(G, { t: 'go', room }); }
function solvePuzzle(G) {
    let n = 0;
    while (Gm.front(G)?.puzzle && n++ < 500) {
        settle(G);
        const m = Pz.solveMove(G.puzzle);
        if (m) Gm.act(G, { t: 'pick', ...m });
        talk(G);
    }
}
function answerAll(G) {
    let n = 0;
    while (Gm.front(G) && n++ < 100) {
        const f = Gm.front(G);
        if (f.say || f.night) Gm.act(G, { t: 'next' });
        else if (f.ask) Gm.act(G, { t: 'answer', i: Q.QUESTION[f.ask].ok });
        else if (f.ded !== undefined) Gm.act(G, { t: 'answer', i: S.DEDUCE[f.ded].ok });
        else if (f.puzzle) solvePuzzle(G);
        else break;
    }
}

// ======================================================================================================== purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
            .replace(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "''");   // words inside strings ("past my window.") aren't code
        ok(!/\bdocument\.|\bwindow\.|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================================================== data
if (want('data')) {
    section('data');
    // every line id written anywhere in the code or the tables exists
    const srcs = ['js/sim/game.js', 'js/sim/data/story.js', 'js/sim/data/rooms.js', 'js/ui.js', 'js/main.js'].filter((f) => fs.existsSync(path.join(ROOT, f)))
        .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    const refs = new Set([...srcs.matchAll(/'((?:orby|ada|wisp|mama|zorp|gloobella|snorkel|quasar|blipblop)\.[a-z0-9.]+)'/g)].map((m) => m[1]));
    const missing = [...refs].filter((id) => !S.LINES[id] && !/\.$/.test(id));
    ok(missing.length === 0, `every line the code names exists (${refs.size} named)${missing.length ? ': ' + missing.join(', ') : ''}`);
    // generated names: fixed1..3, clue.<id>, fact.<qid>, <who>.<qid>, <who>.hello/right/wrong/bye
    for (const c of S.CLUE_ORDER) ok(S.LINES[`orby.clue.${c}`], `clue ${c} has Orby's line`);
    for (const q of Q.QUESTIONS) {
        ok(S.LINES[`${q.who}.${q.id}`] && S.LINES[`orby.fact.${q.id}`], `question ${q.id} has its spoken line and fact`);
        ok(Number.isInteger(q.ok) && q.ok >= 0 && q.ok < q.a.length && q.a.length === 3, `question ${q.id} has three answers and a valid right one`);
    }
    for (const who of new Set(Q.QUESTIONS.map((q) => q.who))) for (const k of ['hello', 'right', 'wrong', 'bye']) ok(S.LINES[`${who}.${k}`], `${who}.${k} exists`);
    const okCounts = [0, 0, 0];
    for (const q of Q.QUESTIONS) okCounts[q.ok]++;
    ok(okCounts.every((n) => n >= 5), `the right answer is spread over all three buttons (${okCounts.join('/')})`);
    for (const d of S.DEDUCE) ok(d.clues.every((c) => S.CLUES[c]), `mystery question "${d.q}" points at real clues`);
    // every line has a voice clip
    const clips = new Set(fs.readdirSync(path.join(ROOT, 'audio')));
    const noClip = Object.keys(S.LINES).filter((id) => !clips.has(S.clipName(id) + '.mp3'));
    ok(noClip.length === 0, `every one of ${Object.keys(S.LINES).length} lines has a voice clip${noClip.length ? ': ' + noClip.slice(0, 6).join(', ') : ''}`);
    // spots, art
    for (const [id, r] of Object.entries(ROOMS)) {
        ok(fs.existsSync(path.join(ROOT, `art/bg/${id}.webp`)), `room ${id} has its backdrop`);
        for (const s of r.spots) ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= W && s.y + s.h <= H && s.walk >= 20 && s.walk <= 620, `${id}.${s.id} sits on the canvas`);
        ok(r.floor > 250 && r.floor <= H && r.entry >= 20 && r.entry <= 620, `room ${id} floor and entry are sane`);
    }
    for (const id of Object.keys(MAP_SPOTS)) ok(ROOMS[id], `map spot ${id} is a room`);
    for (const id of Object.keys(CAST)) ok(fs.existsSync(path.join(ROOT, `art/spr/${id}.webp`)), `${id} has a sprite`);
    for (const f of ['bg/title.webp', 'bg/station.webp', 'icons/items.webp', 'icons/planets.webp']) ok(fs.existsSync(path.join(ROOT, 'art', f)), `art/${f} exists`);
    for (const [i, d] of S.DAYS.entries()) {
        for (const j of d.jobs) {
            if (j.room) ok(ROOMS[j.room].spots.some((s) => s.id === j.spot), `day ${i + 1} job ${j.id} points at a real spot`);
            ok(S.LINES[j.hint], `day ${i + 1} job ${j.id} has a hint line`);
            for (const a of j.after || []) ok(d.jobs.some((x) => x.id === a), `day ${i + 1} job ${j.id} waits for a job of the same day`);
        }
    }
}

// ======================================================================================================== rules
if (want('rules')) {
    section('rules');
    let G = Gm.newGame(5);
    ok(G.day === 1 && Gm.front(G)?.say === 'ada.d1', 'the game opens with Captain Ada on the comms');
    ok(Gm.act(G, { t: 'tap', spot: 'chair' }) === false, 'Kit cannot wander off while someone is talking');
    talk(G);
    ok(!Gm.front(G), 'after the briefing Kit is free');
    ok(G.broken.garden, 'day 1: the Star Garden lights are broken');
    ok(Gm.objective(G).id === 'greet', 'the first job is to greet the visitor');
    Gm.act(G, { t: 'hint' });
    ok(Gm.front(G)?.say === 'orby.hint.greet', 'Orby\'s hint names that job');
    talk(G);

    // flavour spot
    tap(G, 'chair');
    ok(Gm.front(G)?.say === 'orby.chair', 'tapping the chair walks Kit there and Orby comments');
    talk(G);
    // the visitor and the quiz
    go(G, 'dock');
    ok(G.room === 'dock', 'the map takes Kit to the Docking Bay');
    tap(G, 'visitor');
    ok(Gm.front(G)?.say === 'zorp.hello', 'Zorp says hello');
    talk(G);
    let f = Gm.front(G);
    ok(f?.ask && G.asked.zorp.includes(f.ask), 'then asks one of his questions');
    const q = Q.QUESTION[f.ask];
    const wrongI = (q.ok + 1) % 3;
    const st0 = G.stickers;
    Gm.act(G, { t: 'answer', i: wrongI });
    ok(Gm.front(G)?.say === 'zorp.wrong' && G.wrong.includes(wrongI), 'a wrong answer gets a gentle "try again"');
    talk(G);
    ok(Gm.front(G)?.ask === f.ask, 'and the same question comes back');
    ok(Gm.act(G, { t: 'answer', i: wrongI }) === false, 'the same wrong answer cannot be picked twice');
    Gm.act(G, { t: 'answer', i: q.ok });
    ok(Gm.front(G)?.say === 'zorp.right', 'the right answer gets a cheer');
    ok(G.stickers === st0 + C.STICKERS.retry && G.facts.includes(f.ask), 'one sticker on a second try, and the fact goes in the Space Book');
    Gm.act(G, { t: 'next' });
    ok(Gm.front(G)?.say === `orby.fact.${f.ask}`, 'then Orby tells the fact');
    talk(G);
    f = Gm.front(G);
    Gm.act(G, { t: 'answer', i: Q.QUESTION[f.ask].ok });
    ok(G.stickers === st0 + C.STICKERS.retry + C.STICKERS.first, 'two stickers for a first-try answer');
    answerAll(G);
    ok(G.done.greet && G.facts.length === 3, 'after three questions Zorp leaves and the job is done');

    // the dark garden, the repair, the clue
    go(G, 'garden');
    tap(G, 'goo');
    ok(!Gm.roomSpots(G).some((s) => s.id === 'goo'), 'the glowing goo is not tappable while the lights are out');
    tap(G, 'panel');
    ok(Gm.front(G)?.say === 'orby.pz.wires', 'the light panel starts the wire puzzle');
    talk(G);
    ok(G.puzzle?.kind === 'wires', 'the wire puzzle is open');
    solvePuzzle(G);
    ok(G.fixed.garden && !G.broken.garden && G.done.fix, 'solving it fixes the lights');
    talk(G);
    ok(Gm.roomSpots(G).some((s) => s.id === 'goo'), 'now the glowing goo shows');
    tap(G, 'goo');
    ok(Gm.front(G)?.say === 'orby.clue.goo', 'tapping it finds the first clue');
    talk(G);
    ok(G.clues.includes('goo') && G.done['clue:goo'], 'the goo is in the Notebook');
    ok(Gm.allDone(G), 'all of day 1\'s jobs are done');
    ok(Gm.objective(G).id === 'sleep', 'so the next thing is bed');
    // bed
    go(G, 'quarters');
    tap(G, 'bed');
    talk(G);
    ok(Gm.front(G)?.night, 'the bunk ends the day with the night card');
    Gm.act(G, { t: 'next' });
    ok(G.day === 2 && Gm.front(G)?.say === 'ada.d2', 'and day 2 starts with Captain Ada again');

    // walking out of the side of a room into the next one round the ring
    G = Gm.newGame(8); talk(G);
    ok(Gm.act(G, { t: 'exit', dir: 1 }), 'Kit can walk out of the right side of the room');
    settle(G);
    ok(G.room === neighbor('deck', 1) && G.kit.x < 80 && G.kit.face === 1, `and comes in on the left side of the ${ROOMS[G.room].name}, facing in`);
    Gm.act(G, { t: 'exit', dir: -1 }); settle(G);
    ok(G.room === 'deck' && G.kit.x > 560, 'walking out of the left side goes back, coming in on the right');
    const visited = new Set([G.room]);
    for (let i = 0; i < RING.length; i++) { Gm.act(G, { t: 'exit', dir: 1 }); settle(G); talk(G); visited.add(G.room); }
    ok(visited.size === RING.length && G.room === 'deck', 'going right all the way round visits every room once and comes home');
    ok(new Set(RING).size === RING.length && Object.keys(ROOMS).every((r) => RING.includes(r) || r === 'vents'), 'the ring holds every room but the vents');
    ok(neighbor('vents', -1) === 'quarters' && neighbor('vents', 1) === null, 'the vents only lead back to Crew Quarters');
    let far = 0;
    for (const a of RING) for (const b of RING) {
        let r = a, n = 0;
        const d = wayTo(a, b);
        while (r !== b && n < 10) { r = neighbor(r, d); n++; }
        far = Math.max(far, n);
        if (r !== b) far = 99;
    }
    ok(far <= 3, `the glowing arrow always leads to the next job's room in at most 3 rooms (${far})`);
    ok(Gm.act(G, { t: 'tap', spot: 'chair' }) && Gm.act(G, { t: 'exit', dir: -1 }), 'a new walk replaces the old one');
    settle(G);
    ok(G.room === neighbor('deck', -1), 'and the exit wins');
    G.queue.push({ say: 'orby.chair' });
    ok(Gm.act(G, { t: 'exit', dir: 1 }) === false, 'nobody leaves while someone is talking');
    G.queue.length = 0;

    // bed before the jobs are done
    G = Gm.newGame(6); talk(G);
    go(G, 'quarters'); tap(G, 'bed');
    ok(Gm.front(G)?.say === 'orby.bed', 'the bunk says "not bedtime yet" before the jobs are done');
    talk(G);
    ok(G.day === 1, 'and the day goes on');

    // a whole game by hand, checking each day's gates
    G = Gm.newGame(7);
    const play = (G) => {
        let n = 0;
        while (!G.over && n++ < 400) {
            answerAll(G);
            if (G.over) break;
            const tg = Bt.target(G);
            if (!tg) break;
            if (tg.spot === 'notebook') { Gm.act(G, { t: 'solve' }); continue; }
            go(G, tg.room); tap(G, tg.spot);
        }
    };
    // day 4: the footprints need the Glow-o-Meter
    for (let k = 0; G.day < 4 && k < 300; k++) { answerAll(G); if (G.day >= 4) break; const tg = Bt.target(G); if (tg.room !== G.room) go(G, tg.room); tap(G, tg.spot); }
    talk(G);
    ok(!G.items.includes('meter') && !Gm.clueReady(G, 'prints'), 'day 4: the footprints can\'t be found before the Professor lends the Glow-o-Meter');
    go(G, 'dock'); tap(G, 'visitor'); answerAll(G);
    ok(G.items.includes('meter') && Gm.clueReady(G, 'prints'), 'after the quiz Kit has the Glow-o-Meter and the tracks show');
    for (let k = 0; G.day < 5 && k < 300; k++) { answerAll(G); if (G.day >= 5) break; const tg = Bt.target(G); if (tg.room !== G.room) go(G, tg.room); tap(G, tg.spot); }
    talk(G);
    ok(G.clues.length === 6, 'by day 5 all six clues are in the Notebook');
    go(G, 'quarters'); tap(G, 'vent');
    ok(Gm.front(G)?.say === 'orby.vent', 'the vent stays shut before the mystery is solved');
    talk(G);
    // the mystery
    Gm.act(G, { t: 'solve' });
    talk(G);
    ok(Gm.front(G)?.ded === 0, 'the Notebook asks the first mystery question');
    Gm.act(G, { t: 'answer', i: (S.DEDUCE[0].ok + 1) % 3 });
    ok(Gm.front(G)?.say === 'orby.ded.wrong', 'a wrong guess sends Kit back to the clues');
    answerAll(G);
    ok(G.done.solve, 'three right answers solve the mystery');
    tap(G, 'vent');
    ok(Gm.front(G)?.say === 'orby.vent.cookie', 'Orby wants a Glow Cookie before going into the vent');
    talk(G);
    go(G, 'galley'); tap(G, 'snacker'); talk(G);
    ok(G.items.includes('cookie') && G.done.cookie, 'the Snack-O-Tron makes a Glow Cookie');
    go(G, 'quarters'); tap(G, 'vent'); talk(G);
    ok(G.room === 'vents', 'the vent leads into the air vents');
    tap(G, 'nest'); talk(G);
    ok(G.done.find && G.flags.wispFound, 'in the nest Kit meets Wisp');
    go(G, 'deck'); tap(G, 'comms'); talk(G);
    ok(G.puzzle?.kind === 'song', 'the comms console plays Wisp\'s mama\'s song');
    solvePuzzle(G); answerAll(G);
    ok(G.over && G.done.home && G.items.includes('star') && G.flags.mama, 'Mama Glimmer comes, gives the Nebula Star, and the game ends');
    ok(Gm.act(G, { t: 'tap', spot: 'chair' }) === false, 'nothing more happens after the ending');
    void play;
}

// ======================================================================================================== puzzles
if (want('puzzles')) {
    section('puzzles');
    const N = 300;
    for (const kind of ['wires', 'battery', 'planets', 'sequence', 'song']) {
        let solved = 0, maxMoves = 0, bad = null;
        for (let s = 1; s <= N; s++) {
            const rng = makeRng(s * 31 + kind.length);
            const p = Pz.makePuzzle(kind, rng);
            if (kind === 'battery') {
                if (p.target < 6 || p.target > 10 || p.cells.some((v) => v < 1 || v > 5) || p.cells.length !== 6) bad = `bad battery board ${JSON.stringify(p)}`;
                if (!Pz.subsetFor(p).length) bad = `battery board with no answer ${JSON.stringify(p)}`;
            }
            if (kind === 'wires' && p.right.every((c, i) => c === p.left[i])) bad = 'a wire board that starts solved';
            // a few random wrong taps first: they must never lock the puzzle
            const wr = makeRng(s);
            for (let k = 0; k < 6; k++) {
                for (let t = 0; t < 20 && p.show; t += 0.1) Pz.tickPuzzle(p, 0.1);
                if (kind === 'wires') Pz.pickPuzzle(p, { side: wr() < 0.5 ? 'l' : 'r', i: wr.int(0, 3) });
                else Pz.pickPuzzle(p, { i: wr.int(0, (p.cells || p.tray || []).length ? (p.cells || p.tray).length - 1 : p.colors - 1) });
                if (kind === 'battery' && p.solved) break;
            }
            let moves = 0;
            while (!p.solved && moves < 300) {
                for (let t = 0; t < 30 && p.show; t += 0.05) Pz.tickPuzzle(p, 0.05);
                const m = Pz.solveMove(p);
                if (!m) { bad = bad || `no move on ${kind} seed ${s}`; break; }
                Pz.pickPuzzle(p, m);
                moves++;
            }
            if (p.solved) solved++;
            maxMoves = Math.max(maxMoves, moves);
        }
        ok(!bad, `${kind}: every board is sound${bad ? ' — ' + bad : ''}`);
        ok(solved === N, `${kind}: solvable after random wrong taps on ${N} seeds (${solved}/${N}, at most ${maxMoves} moves)`);
    }
    // the memory puzzles: taps are ignored while the lights play, and a wrong tap replays the round
    const p = Pz.makePuzzle('sequence', makeRng(3));
    ok(Pz.pickPuzzle(p, { i: p.seq[0] }).length === 0, 'memory: taps are ignored while the lights are playing');
    const shown = [];
    for (let t = 0; t < 5 && p.show; t += 0.05) for (const e of Pz.tickPuzzle(p, 0.05)) shown.push(e.i);
    ok(JSON.stringify(shown) === JSON.stringify(p.seq.slice(0, 3)), `memory: round 1 shows the first three lights (${shown})`);
    Pz.pickPuzzle(p, { i: (p.seq[0] + 1) % 4 });
    ok(p.show && p.input.length === 0, 'memory: a wrong tap plays the round again');
}

// ======================================================================================================== determinism
if (want('determinism')) {
    section('determinism');
    const playFor = (seed, acts) => {
        const G = Gm.newGame(seed), b = Bt.makeBot({ skill: 0.7, seed: 11, curious: 0.1 });
        for (let i = 0, n = 0; n < acts && i < 100000 && !G.over; i++) { if (Bt.botAct(G, b)) n++; else Gm.step(G, DT); clear(G); }
        return G;
    };
    const a = playFor(42, 150), b = playFor(42, 150);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');
    const G = playFor(9, 90);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    clear(copy);
    const b1 = Bt.makeBot({ skill: 0.7, seed: 5 }), b2 = Bt.makeBot({ skill: 0.7, seed: 5 });
    for (let i = 0; i < 60000 && !G.over; i++) { if (!Bt.botAct(G, b1)) Gm.step(G, DT); clear(G); }
    for (let i = 0; i < 60000 && !copy.over; i++) { if (!Bt.botAct(copy, b2)) Gm.step(copy, DT); clear(copy); }
    ok(G.over && JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-game plays on identically to the end');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    ok(Gm.newGame(1).asked.zorp.join() !== Gm.newGame(2).asked.zorp.join() || Gm.newGame(3).asked.zorp.join() !== Gm.newGame(1).asked.zorp.join(), 'different seeds ask different questions');
}

// ======================================================================================================== bot
if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.4]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s, curious: skill < 1 ? 0.15 : 0 });
            let bad = null, idle = 0, lines = 0, wrongs = 0, spooks = 0;
            for (let i = 0; i < 400000 && !G.over; i++) {
                const c = Bt.botCommand(G, bot);
                if (c && Gm.act(G, c)) {
                    idle = 0; bot.acts++;
                    // a child listens to each line and thinks about each answer: let that time pass
                    if (c.t === 'next' || c.t === 'answer') for (let k = 0; k < 2.5 / DT && !G.over; k++) Gm.step(G, DT);
                } else { Gm.step(G, DT); idle++; }
                for (const e of G.events) { if (e.type === 'say') lines++; if (e.type === 'wrong') wrongs++; if (e.type === 'spook') spooks++; }
                clear(G);
                if (!Number.isFinite(G.kit.x) || G.kit.x < 0 || G.kit.x > 640) bad = 'Kit off the floor';
                else if (!ROOMS[G.room]) bad = 'unknown room';
                else if (G.stickers < 0) bad = 'negative stickers';
                else if (idle > 60 * 60) bad = `stuck on day ${G.day} in ${G.room}: ${JSON.stringify(Gm.front(G))} objective ${Gm.objective(G)?.id}`;
                if (bad) break;
            }
            ok(!bad && G.over, `seed ${s} skill ${skill}: ${bad || (G.over ? 'finishes all five days' : 'did not finish')}`);
            rows.push({ seed: s, skill, stickers: G.stickers, first: G.firstTry, acts: bot.acts, lines, wrongs, spooks, walk: Math.round(G.t / 60) });
        }
    }
    // the same games played by walking through the side doors only, never the map
    for (let s = 1; s <= Math.min(SEEDS, 8); s++) {
        const G = Gm.newGame(s * 104729);
        const bot = Bt.makeBot({ skill: 1, seed: s, walk: true });
        let idle = 0, rooms = 0;
        for (let i = 0; i < 600000 && !G.over && idle < 3600; i++) {
            if (Bt.botAct(G, bot)) idle = 0; else { Gm.step(G, DT); idle++; }
            for (const e of G.events) if (e.type === 'room') rooms++;
            clear(G);
        }
        ok(G.over, `seed ${s}: a bot that only walks through the side doors finishes the game (${rooms} doors walked through)`);
    }
    const avg = (k, f) => { const r = rows.filter((x) => x.skill === k); return Math.round(r.reduce((a, x) => a + x[f], 0) / r.length); };
    const max = (k, f) => Math.max(...rows.filter((x) => x.skill === k).map((x) => x[f]));
    console.log('  skill | stickers | first-try | taps | lines heard | wrong answers | spooky moments | minutes played');
    for (const k of [1, 0.4]) console.log(`  ${String(k).padEnd(5)} | ${String(avg(k, 'stickers')).padEnd(8)} | ${String(avg(k, 'first')).padEnd(9)} | ${String(avg(k, 'acts')).padEnd(4)} | ${String(avg(k, 'lines')).padEnd(11)} | ${String(avg(k, 'wrongs')).padEnd(13)} | ${String(avg(k, 'spooks')).padEnd(14)} | ${avg(k, 'walk')}`);
    // bands (game-plan.md § Balance): every child finishes; a perfect run earns every sticker; guessing still earns most
    ok(avg(1, 'first') === 15, 'a child who knows every answer gets all 15 first try');
    ok(avg(1, 'stickers') >= 50 && avg(1, 'stickers') <= 60, `a perfect game earns 50–60 stickers (${avg(1, 'stickers')})`);
    ok(avg(0.4, 'stickers') >= 0.6 * avg(1, 'stickers'), `a child who often guesses still earns most of the stickers (${avg(0.4, 'stickers')})`);
    ok(max(0.4, 'wrongs') <= 2 * 15 + 3 * 2, 'no one can get more than two wrong answers on any question');
    ok(avg(1, 'spooks') >= 4, `there are spooky moments along the way (${avg(1, 'spooks')} a game)`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
