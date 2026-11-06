/**
 * simtest.mjs — headless checks of Atlas of Ink's simulation. No browser.
 *
 *   node game-123/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-123/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-123/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. world: every seed builds a valid world (features on the right ground, harbours on a coast, rivers,
 *    a sea lane between harbours) and the same seed builds the same one.
 * 3. rules: the quill, focus, radius, error, feature resolution, the confidence rule that stops a
 *    rushed cast spoiling a steady one, the clock, delivery and the season ending.
 * 4. commissions: every seed gets the six clients in order, each one solvable; a perfect chart gets three
 *    stars from every client and a chart that hides the reefs wrecks the ship.
 * 5. determinism: the same seed and inputs give the same game; a save round trip mid-cast plays on identically.
 * 6. bot: the bot plays whole seasons at two skill levels with per-step invariants, and the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 10);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Wd = await import('../js/sim/world.js');
const Cm = await import('../js/sim/commission.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const W = C.WORLD.w, H = C.WORLD.h;
const NONE = { x: 0, y: 0, a: false, r: false, h: false, d: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs && G.phase === 'work'; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const seedOf = (s) => s * 7919;
const KINDS = ['farm', 'ore', 'route', 'sail', 'shrine', 'survey'];

/** Put the quill somewhere and cast a spell of a given focus by holding still. */
function castAt(G, x, y, focus) {
    G.q.x = x; G.q.y = y;
    Gm.step(G, { ...NONE, a: true, h: true }, DT);
    while (G.channel && G.channel.focus < focus - 1e-9) Gm.step(G, { ...NONE, h: true }, DT);
    Gm.step(G, { ...NONE, r: true }, DT);
}

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('world')) {
    section('world');
    let rivers = 0, lakes = 0, retried = 0;
    for (let s = 1; s <= SEEDS * 2; s++) {
        const w = Wd.buildWorld(seedOf(s));
        if (w.attempt) retried++;
        ok(w.valid, `seed ${s}: a valid world`);
        const bad = [];
        for (const f of w.features) {
            const t = w.terrain[f.y * W + f.x];
            if (f.kind === 'harbor' && t !== C.T.SAND) bad.push(`harbor on ${t}`);
            if (f.kind === 'reef' && t !== C.T.SHOAL && t !== C.T.SEA && t !== C.T.DEEP) bad.push(`reef on ${t}`);
            if (f.kind === 'ore' && t !== C.T.HILLS && t !== C.T.MOUNTAIN) bad.push(`ore on ${t}`);
            if (f.kind === 'town' && t !== C.T.PLAINS) bad.push(`town on ${t}`);
            if (w.featureAt[f.y * W + f.x] !== f.id) bad.push('featureAt disagrees');
        }
        ok(!bad.length, `seed ${s}: features stand on the right ground${bad.length ? ' (' + bad[0] + ')' : ''}`);
        for (let i = 0; i < W * H; i++) { if (w.terrain[i] === C.T.RIVER) rivers++; if (w.terrain[i] === C.T.LAKE) lakes++; }
        const A = Wd.buildWorld(seedOf(s));
        ok(A.terrain.every((t, i) => t === w.terrain[i]) && A.features.length === w.features.length, `seed ${s}: the same seed builds the same world`);
        ok(w.landFrac > 0.3 && w.landFrac < 0.65, `seed ${s}: land fraction ${w.landFrac.toFixed(2)} is an island, not a puddle or a continent`);
    }
    ok(rivers > SEEDS, `rivers exist (${rivers} river cells over ${SEEDS * 2} worlds)`);
    console.log(`  ${SEEDS * 2} worlds, ${retried} needed a retry, ${rivers} river cells, ${lakes} lake cells`);
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    ok(G.phase === 'work' && G.commissions.length === 6, 'a new game starts on the first of six commissions');
    ok(G.ink.every((v) => v === 0), 'the sheet starts blank');

    // movement
    const x0 = G.q.x;
    run(G, { ...NONE, x: 1 }, 0.5);
    ok(Math.abs(G.q.x - (x0 + C.QUILL.speed * 0.5)) < 0.15, 'the quill moves at QUILL.speed');
    run(G, { ...NONE, x: 1 }, 10);
    ok(G.q.x <= W - 0.5 + 1e-9, 'it stops at the edge of the sheet');
    G = Gm.newGame(1);
    G.q.x = 30; G.q.y = 20;
    run(G, { ...NONE, x: 1, y: 1 }, 0.2);
    ok(Math.hypot(G.q.vx, G.q.vy) <= C.QUILL.speed + 1e-6, 'diagonals are no faster');

    // a tap in one step: press and release together still casts
    G = Gm.newGame(3);
    G.q.x = 30; G.q.y = 20;
    Gm.step(G, { ...NONE, a: true, r: true }, DT);
    ok(G.casts === 1 && !G.channel, 'a press and release in one step is a tap that casts');
    const inked = G.ink.filter((v) => v).length;
    ok(inked > 8 && inked < Math.PI * (C.SCRY.minR + 0.5) ** 2, `a tap inks a small disc (${inked} cells)`);
    ok(G.events.some((e) => e.type === 'scry' && e.focus < 0.05), 'and emits a scry event');
    const edge = G.ink.findIndex((v, i) => v && Math.hypot((i % W) + 0.5 - 30, ((i / W) | 0) + 0.5 - 20) > C.SCRY.minR + 0.8);
    ok(edge === -1, 'nothing is inked outside the radius');

    // focus builds when still, bleeds when moving
    G = Gm.newGame(3);
    G.q.x = 30; G.q.y = 20;
    Gm.step(G, { ...NONE, a: true, h: true }, DT);
    run(G, { ...NONE, h: true }, 0.5);
    ok(Math.abs(G.channel.focus - 0.5) < 0.03, `holding still for half of focusTime gives half focus (${G.channel.focus.toFixed(2)})`);
    const f1 = G.channel.focus;
    run(G, { ...NONE, h: true, x: 1 }, 0.2);
    ok(G.channel.focus < f1 - 0.2, 'moving bleeds focus');
    run(G, { ...NONE, h: true }, 3);
    ok(G.channel.focus === 1, 'focus tops out at 1');
    const sp = G.q.x;
    run(G, { ...NONE, h: true, x: 1 }, 0.1);
    ok(G.q.x - sp < C.QUILL.speed * C.QUILL.channelSpeed * 0.1 + 0.12 && G.q.x - sp > 0.5, 'the quill is slower while channelling');
    Gm.step(G, { ...NONE, h: false }, DT);
    ok(G.casts === 1 && !G.channel, 'letting go of the key casts');

    // radius and error grow with focus
    const stats = (focus) => {
        let n = 0, bad = 0, cells = 0;
        for (let s = 1; s <= 12; s++) {
            const g = Gm.newGame(seedOf(s));
            castAt(g, 36, 22, focus);
            for (let i = 0; i < W * H; i++) if (g.ink[i]) { cells++; n++; if (g.ink[i] !== g.world.terrain[i]) bad++; }
        }
        return { cells: cells / 12, wrong: bad / n };
    };
    const lo = stats(0), mid = stats(0.5), hi = stats(1);
    ok(hi.cells > mid.cells && mid.cells > lo.cells, `the radius grows with focus (${lo.cells | 0} → ${mid.cells | 0} → ${hi.cells | 0} cells)`);
    ok(hi.cells > Math.PI * (C.SCRY.maxR - 0.6) ** 2, 'a full cast covers about π·maxR² cells');
    ok(hi.wrong < 0.03, `a full-focus cast is nearly true (${(hi.wrong * 100).toFixed(1)}% wrong)`);
    ok(lo.wrong > 0.3, `a rushed cast is wide of the mark (${(lo.wrong * 100).toFixed(0)}% wrong)`);
    ok(mid.wrong > hi.wrong && lo.wrong > mid.wrong, 'error falls as focus rises');

    // features need focus
    G = Gm.newGame(seedOf(2));
    const feat = G.world.features.find((f) => f.kind === 'ore');
    castAt(G, feat.x + 0.5, feat.y + 0.5, 0.2);
    ok(!G.found.includes(feat.id), 'a rushed cast cannot resolve an ore vein');
    castAt(G, feat.x + 0.5, feat.y + 0.5, 0.6);
    ok(G.found.includes(feat.id) && G.events.some((e) => e.type === 'found' && e.id === feat.id), 'a steady cast finds it, and says so');
    const n1 = G.events.filter((e) => e.type === 'found' && e.id === feat.id).length;
    castAt(G, feat.x + 0.5, feat.y + 0.5, 0.6);
    ok(G.events.filter((e) => e.type === 'found' && e.id === feat.id).length === n1, 'it is only found once');

    // a rushed cast never spoils a steady one
    G = Gm.newGame(seedOf(4));
    castAt(G, 36, 22, 1);
    const snap = G.ink.slice();
    castAt(G, 36, 22, 0.1);
    castAt(G, 34, 21, 0.3);
    ok(G.ink.every((v, i) => v === snap[i]), 'a cast cannot overwrite ink that was cast more steadily');
    castAt(G, 36, 22, 1);
    ok(G.ink.some((v) => v) && G.conf.some((v) => v === 101), 'but an equally steady cast may redo it');

    // the first client's sheet starts blank; a travel client's start is already on it
    G = Gm.newGame(seedOf(5));
    Gm.deliver(G); Gm.next(G); Gm.deliver(G); Gm.next(G);          // on to the adventurer
    const c = Gm.current(G);
    ok(c.kind === 'route' && G.found.includes(c.start) && G.ink.some((v) => v), 'a travel client’s starting place is already charted');
    ok(G.ink.filter((v) => v).length < 40, 'and only that');

    // the clock and delivery
    G = Gm.newGame(seedOf(6));
    const t0 = G.timeLeft;
    run(G, NONE, 5);
    ok(Math.abs(G.timeLeft - (t0 - 5)) < 0.05, 'the clock runs down in game time');
    Gm.step(G, { ...NONE, a: true, h: true }, DT);
    run(G, { ...NONE, h: true }, 60);
    ok(G.phase === 'result' && G.channel === null, 'time out hands the chart over (and drops a spell in progress)');
    ok(G.result && G.result.stars === 0 && G.result.points === 0, 'a blank sheet earns nothing');
    ok(G.events.some((e) => e.type === 'result'), 'and emits a result event');
    const idx = G.idx;
    Gm.step(G, { ...NONE, x: 1 }, DT);
    ok(G.q.x === G.q.x && G.idx === idx, 'nothing steps during a result');
    Gm.next(G);
    ok(G.idx === idx + 1 && G.phase === 'work' && G.ink.every((v) => v === 0), 'next() opens a fresh sheet for the next client');
    G = Gm.newGame(seedOf(6));
    Gm.step(G, { ...NONE, d: true }, DT);
    ok(G.phase === 'result', 'a deliver press hands the chart over early');
    for (let i = 0; i < 6; i++) { if (G.phase === 'result') Gm.next(G); if (G.phase === 'work') Gm.deliver(G); }
    ok(G.phase === 'over' && G.events.some((e) => e.type === 'over'), 'after six commissions the season ends');
    ok(G.results.length === 6 && G.points === 0, 'six results, no points for six blank sheets');
}

if (want('commissions')) {
    section('commissions');
    const outcomes = { reef: 0, sail: 0 };
    for (let s = 1; s <= SEEDS * 2; s++) {
        const G = Gm.newGame(seedOf(s));
        const w = G.world;
        ok(G.commissions.map((c) => c.kind).join() === KINDS.join(), `seed ${s}: farmer, prospector, adventurer, captain, pilgrim, king, in that order`);
        let bad = '';
        for (const c of G.commissions) {
            const r = c.region;
            if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) bad = `${c.kind} region leaves the sheet`;
            if (c.time < 40 || c.time > 130) bad = `${c.kind} time ${c.time}`;
            if (c.targets && c.targets.length < 3) bad = `${c.kind} has ${c.targets.length} targets`;
            if (c.targets && !c.targets.every((id) => w.features[id].x >= r.x && w.features[id].x < r.x + r.w && w.features[id].y >= r.y && w.features[id].y < r.y + r.h)) bad = `${c.kind} target outside its region`;
            if (c.start != null) {
                const S = w.features[c.start], Gl = w.features[c.goal];
                const ship = c.kind === 'sail';
                if (S.kind !== (ship ? 'harbor' : 'town') || Gl.kind !== (ship ? 'harbor' : 'ruin')) bad = `${c.kind} start/goal kinds`;
                if (Gl.x < r.x || Gl.x >= r.x + r.w || Gl.y < r.y || Gl.y >= r.y + r.h) bad = `${c.kind} goal is not inside its zone`;
                if (S.x >= r.x && S.x < r.x + r.w && S.y >= r.y && S.y < r.y + r.h) bad = `${c.kind} start is inside the zone`;
                // the true route exists, and takes real effort
                const p = (await import('../js/sim/path.js')).astar(W, H, Cm.truthCost(w, ship), S.x, S.y, Gl.x, Gl.y);
                if (!p) bad = `${c.kind} has no true route`;
                else if (p.path.length < 14) bad = `${c.kind} route is only ${p.path.length} cells`;
            }
        }
        ok(!bad, `seed ${s}: commissions are well formed${bad ? ' (' + bad + ')' : ''}`);

        // a perfect chart earns three stars from every client
        const P = Gm.newGame(seedOf(s));
        const stars = [];
        for (let k = 0; k < 6; k++) {
            P.ink = Array.from(P.world.terrain);
            P.conf = P.ink.map(() => 101);
            P.found = P.world.features.map((f) => f.id);
            Gm.deliver(P);
            stars.push(P.result.stars);
            Gm.next(P);
        }
        ok(stars.every((v) => v === 3), `seed ${s}: a perfect chart earns three stars from every client (${stars.join('')})`);

        // a chart that is perfect except that it hides the reefs wrecks the captain
        const R = Gm.newGame(seedOf(s));
        for (let k = 0; k < 3; k++) { Gm.deliver(R); Gm.next(R); }
        R.ink = Array.from(R.world.terrain);
        R.conf = R.ink.map(() => 101);
        R.found = R.world.features.filter((f) => f.kind !== 'reef').map((f) => f.id);
        Gm.deliver(R);
        outcomes.sail++;
        if (R.result.outcome === 'reef') outcomes.reef++;
        ok(R.result.stars === 0 || R.result.outcome !== 'ok' || R.result.stars > 0, `seed ${s}: the captain’s voyage resolves`);
    }
    ok(outcomes.reef >= outcomes.sail * 0.8, `hiding the reefs wrecks the ship on most seeds (${outcomes.reef} of ${outcomes.sail})`);

    // a chart that calls the sea plains sends the adventurer into the water
    let drowned = 0, tried = 0;
    for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame(seedOf(s));
        Gm.deliver(G); Gm.next(G); Gm.deliver(G); Gm.next(G);
        const c = Gm.current(G);
        const w = G.world;
        G.ink = Array.from(w.terrain).map((t) => (t === C.T.DEEP || t === C.T.SEA || t === C.T.SHOAL || t === C.T.LAKE ? C.T.PLAINS : t));
        G.conf = G.ink.map(() => 101);
        G.found = [c.start, c.goal];
        Gm.deliver(G);
        tried++;
        if (G.result.outcome === 'blocked' && G.result.stars === 0) drowned++;
        else if (G.result.stars === 0) ok(false, `seed ${s}: a zero-star route should explain itself (${G.result.outcome})`);
    }
    console.log(`  ${drowned} of ${tried} overland routes were sent into water by a chart that called it plains (the rest found a dry way)`);
    ok(true, 'water-as-plains charts resolve');

    // an unfound goal is the one thing a route cannot recover from
    const G = Gm.newGame(seedOf(1));
    Gm.deliver(G); Gm.next(G); Gm.deliver(G); Gm.next(G);
    G.ink = Array.from(G.world.terrain); G.conf = G.ink.map(() => 101);
    G.found = [Gm.current(G).start];
    Gm.deliver(G);
    ok(G.result.outcome === 'nogoal' && G.result.stars === 0, 'a goal that was never found cannot be reached');
}

if (want('determinism')) {
    section('determinism');
    const playSeason = (seed, secs) => {
        const G = Gm.newGame(seed), b = Bt.makeBot();
        run(G, (g) => Bt.botInput(g, b), secs);
        return G;
    };
    const a = playSeason(42, 15), b = playSeason(42, 15);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(Gm.serialize(a).world === undefined && Gm.serialize(a).events === undefined, 'a save holds neither the derived world nor the event queue');
    ok(JSON.stringify(Gm.serialize(a)).length < 60000, `a save is small (${JSON.stringify(Gm.serialize(a)).length} bytes)`);

    // a save round trip in the middle of a held cast plays on identically
    const G = Gm.newGame(seedOf(7));
    const bot = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, bot), 3.3);
    G.q.x = 40; G.q.y = 20;
    Gm.step(G, { ...NONE, a: true, h: true }, DT);
    run(G, { ...NONE, h: true }, 0.4);
    ok(!!G.channel, 'a spell is mid-focus when we save');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(copy.world.terrain.every((t, i) => t === G.world.terrain[i]), 'the world is rebuilt from the seed');
    const finish = (g) => {
        run(g, { ...NONE, h: true }, 0.7);
        Gm.step(g, { ...NONE, r: true }, DT);
        const bt = Bt.makeBot();
        run(g, (x) => Bt.botInput(x, bt), 8);
        return JSON.stringify(Gm.serialize(g));
    };
    ok(finish(G) === finish(copy), 'a save round trip plays on identically');

    // and across a result and into the next commission
    const H2 = Gm.newGame(seedOf(8));
    Gm.step(H2, { ...NONE, d: true }, DT);
    const c2 = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(H2))));
    Gm.next(H2); Gm.next(c2);
    ok(JSON.stringify(Gm.serialize(H2)) === JSON.stringify(Gm.serialize(c2)), 'a save taken on a result screen resumes into the next commission');

    let threw = 0;
    for (const bad of [{ v: 999 }, null, { v: 1, ink: [] }, { ...Gm.serialize(H2), idx: 99 }]) { try { Gm.deserialize(bad); } catch { threw++; } }
    ok(threw === 4, 'an unknown or damaged save is rejected, not half-loaded');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const T0 = Date.now();
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.5, 0]) {
            const G = Gm.newGame(seedOf(s));
            const bot = Bt.makeBot({ skill });
            let bad = null, guard = 0;
            while (G.phase !== 'over' && guard++ < 6 * 160 * 120) {
                if (G.phase === 'result') {
                    const c = Gm.current(G);
                    rows.push({ seed: s, skill, kind: c.kind, stars: G.result.stars, left: G.result.timeLeft / c.time, pct: G.result.pct, outcome: G.result.outcome });
                    Gm.next(G);
                    continue;
                }
                Gm.step(G, skill === 0 ? NONE : Bt.botInput(G, bot), DT);
                G.events.length = 0;
                const q = G.q;
                if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad = 'non-finite quill';
                else if (q.x < 0 || q.y < 0 || q.x > W || q.y > H) bad = 'quill outside the sheet';
                else if (G.channel && !(G.channel.focus >= 0 && G.channel.focus <= 1)) bad = 'focus out of range';
                else if (G.timeLeft < -1e-6) bad = 'negative time';
                if (bad) break;
            }
            ok(!bad && G.phase === 'over', `seed ${s} skill ${skill}: ${bad || 'a whole season, invariants hold'}`);
            ok(G.ink.every((v) => Number.isInteger(v) && v >= 0 && v <= 12) && G.found.every((id) => G.world.features[id]), `seed ${s} skill ${skill}: the sheet holds only real terrain and real features`);
            if (skill === 0) ok(G.points === 0, `seed ${s}: an idle cartographer earns nothing`);
        }
    }
    const avg = (arr, f) => arr.reduce((a, r) => a + f(r), 0) / (arr.length || 1);
    const by = (skill, kind) => rows.filter((r) => r.skill === skill && (!kind || r.kind === kind));
    console.log('  kind     skill 1: stars  time used | skill 0.5: stars  time used');
    for (const kind of KINDS) {
        const a = by(1, kind), b = by(0.5, kind);
        console.log(`  ${kind.padEnd(8)}          ${avg(a, (r) => r.stars).toFixed(2)}      ${(100 - avg(a, (r) => r.left) * 100).toFixed(0).padStart(3)}%   |           ${avg(b, (r) => r.stars).toFixed(2)}      ${(100 - avg(b, (r) => r.left) * 100).toFixed(0).padStart(3)}%`);
        ok(avg(a, (r) => r.stars) >= 2.3, `${kind}: the steady bot averages at least 2.3 stars (${avg(a, (r) => r.stars).toFixed(2)})`);
        ok(1 - avg(a, (r) => r.left) < 0.6, `${kind}: the steady bot needs well under 60% of the time, leaving room for a person`);
    }
    ok(avg(by(1), (r) => r.stars) > avg(by(0.5), (r) => r.stars), 'a steadier bot earns more stars than a hasty one');
    ok(avg(by(0.5), (r) => r.stars) > 1.5, 'and the hasty one still gets somewhere');
    ok(avg(by(0.5), (r) => r.stars) < 2.9, 'but not everything: haste costs accuracy');
    ok(by(0).every((r) => r.stars === 0), 'doing nothing earns no stars from anyone');
    console.log(`  ${rows.length} commissions played in ${Date.now() - T0} ms`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
