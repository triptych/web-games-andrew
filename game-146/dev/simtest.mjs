/**
 * simtest.mjs — headless checks of JINGLE POP's simulation. No browser.
 *
 *   node game-146/dev/simtest.mjs                 # everything
 *   ONLY=purity,rules node game-146/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-146/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock.
 * 2. rules: the grid, traced shots, matching, drops, every special and power-up, the tray, the ceiling, win and loss,
 *    endless rows.
 * 3. levels: all 36 build deterministically, hang from the ceiling, respect the colour-group caps, place their specials
 *    and have a par.
 * 4. determinism: same seed and inputs → same game; a save round trip (mid-flight too) plays on identically.
 * 5. bot: the perfect bot clears every level on SEEDS seeds with per-step invariants; the balance table for skills
 *    1, 0.6 and 0.3 is printed and its bands asserted; the blizzard lasts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 3);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const H = await import('../js/sim/hex.js');
const Bt = await import('../js/sim/bot.js');
const D = await import('../js/sim/data/levels.js');
const { PAR } = await import('../js/sim/data/par.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const IDLE = { aim: null, turn: 0, fire: false, swap: -1, cycle: false, use: -1 };
const inp = (o) => ({ ...IDLE, ...o });

/** A level-mode game on an empty board, ready for hand-placed balls. */
function blank(opts = {}) {
    const G = Gm.newGame({ level: opts.level || 1, seed: opts.seed || 5 });
    G.grid = H.emptyGrid();
    G.sack = []; G.loaded = null; G.pressure = 0; G.ceil = 0;
    G.dropEvery = 99;
    return G;
}
function put(G, r, c, k, col = -1) { G.grid[r][c] = { id: G.nextId++, k, c: col }; return G.grid[r][c]; }
/** Fire the loaded shot (or a power-up) at an angle and run until it lands. */
function shoot(G, angle, { color, power } = {}) {
    if (color !== undefined) G.tray[0] = color;
    if (power) G.loaded = power;
    G.cool = 0;
    const before = G.shots;
    Gm.step(G, inp({ aim: angle, fire: true }), DT);
    ok(G.shots === before + 1, 'the shot fired');
    for (let i = 0; i < 2000 && G.phase === 'fly'; i++) Gm.step(G, IDLE, DT);
    return G.events.splice(0);
}
/** The aim that sends a shot straight at cell (r, c) from the launcher. */
const aimAt = (G, r, c) => Math.atan2(C.SHOOTER.y - H.cellY(G, r), H.cellX(G, r, c) - C.SHOOTER.x);
const count = (G, pred = () => true) => H.balls(G).filter((b) => pred(b.b)).length;

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
if (want('rules')) {
    section('rules: grid and shots');
    let G = blank();
    let sym = true;
    for (let r = 0; r < C.ROWS; r++) for (let c = 0; c < H.rowLen(G, r); c++) {
        for (const [a, b] of H.neighbors(G, r, c)) {
            if (!H.neighbors(G, a, b).some(([x, y]) => x === r && y === c)) sym = false;
            if (Math.abs(Math.hypot(H.cellX(G, a, b) - H.cellX(G, r, c), H.cellY(G, a) - H.cellY(G, r)) - 1) > 1e-9) sym = false;
        }
    }
    ok(sym, 'hex neighbours are symmetric and exactly one ball apart');
    G.par = 1;
    ok(H.rowLen(G, 0) === C.COLS - 1 && H.cellX(G, 0, 0) === 1, 'flipping the parity shifts the rows');

    G = blank();
    let tr = H.traceShot(G, Math.PI / 2);
    ok(tr.cell && tr.cell[0] === 0 && tr.cell[1] === 5 && tr.pts.length === 2, 'straight up on an empty board lands in the top row, middle');
    tr = H.traceShot(G, 0.5);
    ok(tr.pts.length >= 3 && tr.pts.every((p) => p.x >= C.R - 1e-9 && p.x <= C.FIELD.w - C.R + 1e-9), 'a shallow shot bounces off the wall and stays inside');
    put(G, 0, 5, 'orn', 0);
    tr = H.traceShot(G, Math.PI / 2);
    ok(tr.hit && tr.cell[0] === 1, 'a shot hits a hanging ball and rests touching it');
    ok(H.clampAim(0) === C.AIM_MIN && H.clampAim(4) === Math.PI - C.AIM_MIN, 'the aim is clamped above horizontal');

    section('rules: matching and drops');
    G = blank();
    put(G, 0, 4, 'orn', 1); put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 0); put(G, 1, 4, 'orn', 2);
    let ev = shoot(G, aimAt(G, 1, 5), { color: 0 });
    ok(!G.grid[0][5] && !G.grid[0][6] && ev.some((e) => e.type === 'pop' && e.list.length === 3), 'three of a colour pop');
    ok(G.grid[0][4] && G.grid[1][4], 'other colours stay');
    G = blank();
    put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 1);
    ev = shoot(G, aimAt(G, 1, 5), { color: 0 });
    ok(count(G) === 3 && !ev.some((e) => e.type === 'pop'), 'two of a colour do not pop');
    ok(G.miss === 1 && G.streak === 0, 'a shot that pops nothing is a miss');

    G = blank();
    put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 0); put(G, 1, 5, 'orn', 2); put(G, 2, 5, 'orn', 3); put(G, 2, 4, 'orn', 3);
    ev = shoot(G, aimAt(G, 1, 6), { color: 0 });
    ok(count(G) === 0 && ev.some((e) => e.type === 'drop' && e.list.length === 3), 'ornaments left hanging from nothing fall');
    ok(G.score > 0 && G.dropped === 3, 'drops score');

    section('rules: specials');
    G = blank();
    put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 0); const ice = put(G, 0, 7, 'ice', 1); put(G, 0, 4, 'gift'); put(G, 1, 6, 'orn', 1);
    ev = shoot(G, aimAt(G, 1, 5), { color: 0 });
    ok(ice.k === 'orn' && ev.some((e) => e.type === 'thaw' && e.id === ice.id), 'a pop next to a frozen ornament thaws it');
    ok(!G.grid[0][4] && G.sack.length === 1 && ev.some((e) => e.type === 'gift'), 'a pop next to a present opens it into the sack');
    ok(D.unlockedPowers(1).includes(G.sack[0]), 'the present holds a power-up unlocked by this chapter');

    G = blank();
    const ice2 = put(G, 0, 5, 'ice', 2); put(G, 0, 3, 'orn', 1);
    ev = shoot(G, aimAt(G, 1, 5), { color: 0 });
    ok(ice2.k === 'orn' && ev.some((e) => e.type === 'thaw'), 'a shot that lands against a frozen ornament cracks it');

    G = blank();
    put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 0); put(G, 0, 7, 'bell'); put(G, 0, 8, 'orn', 3); put(G, 1, 7, 'coal'); put(G, 0, 9, 'orn', 4);
    ev = shoot(G, aimAt(G, 1, 5), { color: 0 });
    ok(!G.grid[0][7] && !G.grid[0][8] && !G.grid[1][7] && ev.some((e) => e.type === 'ring'), 'a golden bell rings, popping everything around it, coal too');
    ok(G.grid[0][9], 'but not beyond');

    G = blank();
    put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'coal'); put(G, 1, 5, 'coal');
    ev = shoot(G, aimAt(G, 1, 6), { color: 0 });
    ok(G.grid[0][6] && G.grid[1][5], 'coal never matches');
    G = blank();
    put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 0); put(G, 1, 5, 'coal'); put(G, 2, 5, 'coal');
    shoot(G, aimAt(G, 0, 4) + 0.02, { color: 0 });
    ok(count(G) === 0, 'coal falls when what holds it up pops');

    G = blank();
    put(G, 0, 5, 'orn', 2); put(G, 0, 6, 'prism');
    ev = shoot(G, aimAt(G, 1, 5), { color: 2 });
    ok(!G.grid[0][5] && !G.grid[0][6], 'a prism bauble matches any colour');
    ok(G.targets === undefined && Gm.targets(G) === 0, 'and counts as an ornament to clear');

    section('rules: power-ups');
    G = blank();
    for (let c = 0; c < 11; c++) { put(G, 0, c, 'orn', c % 3); if (c < 10) put(G, 1, c, c === 5 ? 'ice' : 'coal', 4); }
    ev = shoot(G, aimAt(G, 2, 5), { power: 'bomb' });
    ok(ev.some((e) => e.type === 'blast') && !G.grid[1][5] && !G.grid[1][4] && !G.grid[0][5], 'the pudding bomb bursts everything within two rings, ice and coal included');
    ok(!ev.some((e) => e.type === 'stick'), 'and is not left on the board');

    G = blank();
    put(G, 0, 3, 'orn', 1); put(G, 0, 4, 'orn', 3);
    ev = shoot(G, aimAt(G, 1, 3) - 0.01, { power: 'star' });
    ok(!G.grid[0][3] || !G.grid[0][4], 'the rainbow star takes the colour it touches and pops with a single partner');

    G = blank();
    for (let r = 0; r < 12; r++) for (let c = 0; c < H.rowLen(G, r); c++) put(G, r, c, 'orn', (r + c) % 4);
    const before = count(G);
    ev = shoot(G, Math.PI / 2, { power: 'candy' });
    ok(before - count(G) >= 1 && ev.filter((e) => e.type === 'pop').reduce((a, e) => a + e.list.length, 0) <= Gm.CANDY_MAX, `the candy cane smashes through at most ${Gm.CANDY_MAX} ornaments`);
    ok(ev.some((e) => e.type === 'shatter'), 'then shatters');

    G = blank();
    for (let c = 0; c < 11; c++) put(G, 0, c, 'orn', c % 2 ? 1 : 3);
    put(G, 1, 3, 'ice', 3);
    ev = shoot(G, aimAt(G, 1, 4), { power: 'bell' });
    ok(H.balls(G).every((b) => b.b.c !== 3 || b.b.k !== 'orn') && !ev.some((e) => e.type === 'stick'), 'the jingle bell rings away every ornament of the colour it touches, frozen ones too');

    G = blank();
    for (let c = 0; c < 11; c++) { put(G, 0, c, 'orn', c % 4); if (c < 10) put(G, 1, c, 'orn', (c + 1) % 4); if (c < 9) put(G, 2, c + 1, 'orn', (c + 2) % 4); }
    ev = shoot(G, aimAt(G, 3, 5), { power: 'tinsel' });
    ok(ev.some((e) => e.type === 'tinsel') && !G.grid[2].some(Boolean), 'the tinsel garland sweeps away the row it lands in');

    G = blank();
    put(G, 0, 1, 'ice', 0); put(G, 0, 9, 'ice', 1); put(G, 0, 5, 'coal'); put(G, 1, 5, 'orn', 2);
    ev = shoot(G, aimAt(G, 2, 5), { power: 'cocoa' });
    ok(G.grid[0][1].k === 'orn' && G.grid[0][9].k === 'orn' && !G.grid[0][5], 'hot cocoa thaws every frozen ornament and melts the coal near it');

    G = blank();
    put(G, 0, 5, 'orn', 0);
    G.ceil = 2; G.pressure = 4; G.sack = ['cookie', 'north'];
    Gm.step(G, inp({ use: 0 }), DT);
    ok(G.ceil === 1 && G.pressure === 0 && G.sack.join() === 'north', 'the gingerbread break raises the ceiling and resets the pressure');
    Gm.step(G, inp({ use: 0 }), DT);
    ok(G.guide === 8 && G.sack.length === 0, 'the north star lights the full aim guide for 8 shots');
    G.sack = ['bomb', 'star'];
    Gm.step(G, inp({ use: 0 }), DT);
    ok(G.loaded === 'bomb' && G.sack.join() === 'star', 'a shot power-up loads into the launcher');
    Gm.step(G, inp({ use: 0 }), DT);
    ok(G.loaded === 'star' && G.sack.join() === 'bomb', 'using another swaps them');
    Gm.step(G, inp({ swap: 1 }), DT);
    ok(G.loaded === null && G.sack.length === 2, 'tapping the tray puts a loaded power-up back');

    section('rules: the tray');
    G = Gm.newGame({ level: 20, seed: 3 });
    ok(G.tray.length === 3, 'chapter four levels have three ornaments in the tray');
    const t0 = G.tray.slice();
    Gm.step(G, inp({ swap: 2 }), DT);
    ok(G.tray[0] === t0[2] && G.tray[2] === t0[0], 'tapping a tray ornament swaps it into the launcher');
    Gm.step(G, inp({ cycle: true }), DT);
    ok(G.tray.join() === [t0[1], t0[0], t0[2]].join(), 'the swap key rotates the tray');
    ok(Gm.newGame({ level: 1 }).tray.length === 1 && Gm.newGame({ level: 7 }).tray.length === 2, 'one ornament in chapter one, two in chapters two and three');
    const cols = Gm.boardColors(G);
    ok([...G.tray, G.next].every((c) => cols.includes(c)), 'the tray only holds colours still on the board');

    section('rules: ceiling, loss, win');
    G = blank();
    G.dropEvery = 4;
    put(G, 0, 0, 'orn', 5);
    for (let i = 0; i < 2; i++) shoot(G, Math.PI / 2 + 0.3 * i, { color: i % 4 });
    ok(G.ceil === 1 && G.events.length === 0, 'two misses (each counting double) bring the ceiling down a row');
    G = blank();
    G.dropEvery = 99;
    for (let r = 0; r < 15; r++) put(G, r, 0, 'orn', r % 2 ? 2 : 3);
    ok(H.cellY(G, 14) < C.DEAD_Y, 'a ball in row 14 hangs above the line');
    G.dropEvery = 1;
    ev = shoot(G, Math.PI / 2, { color: 4 });
    ok(G.ceil === 1 && H.cellY(G, 14) > C.DEAD_Y, 'the ceiling came down and row 14 is past the line');
    ok(G.over && G.result === 'lost' && ev.some((e) => e.type === 'lost'), 'an ornament below the red line loses the level');
    G = blank();
    put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 0); put(G, 0, 9, 'coal');
    G.parShots = 5;
    ev = shoot(G, aimAt(G, 1, 5), { color: 0 });
    ok(G.over && G.result === 'won' && G.stars === 3, 'clearing every ornament wins, three stars at par');
    ok(ev.some((e) => e.type === 'drop' && e.list.some((b) => b.k === 'coal')), 'and the coal left behind falls away');
    G = blank(); put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 0); G.parShots = 2; G.shots = 4;
    shoot(G, aimAt(G, 1, 5), { color: 0 });
    ok(G.stars === 1, 'well over par is one star');

    section('rules: spirit meter');
    G = blank();
    G.spirit = C.SPIRIT_MAX - 2;
    put(G, 0, 5, 'orn', 0); put(G, 0, 6, 'orn', 0); put(G, 0, 1, 'orn', 1);
    ev = shoot(G, aimAt(G, 1, 5), { color: 0 });
    ok(G.sack.length === 1 && ev.some((e) => e.type === 'power' && e.from === 'spirit'), 'a full spirit meter gives a free power-up');

    section('rules: endless');
    G = Gm.newGame({ mode: 'endless', seed: 9 });
    ok(G.tray.length === 3 && count(G) > 50 && G.pushed === 0, 'the blizzard starts with six rows and a full tray');
    const ids = H.balls(G).map((b) => `${b.b.id}@${b.x.toFixed(2)}`);
    G.pressure = G.dropEvery - 1;
    shoot(G, 0.3, { color: G.tray[0] });
    ok(G.pushed === 1, 'shots push a new row in from the top');
    const moved = H.balls(G).filter((b) => ids.includes(`${b.b.id}@${b.x.toFixed(2)}`));
    ok(moved.length >= ids.length - 6, 'existing ornaments keep their columns when a row pushes in');
}

// ======================================================================
if (want('levels')) {
    section('levels');
    ok(D.LEVELS.length === 36 && D.CHAPTERS.length === 6, '36 levels in 6 chapters');
    ok(PAR.length === 36 && PAR.every((p) => p > 3), 'every level has a par (dev/balance.mjs)');
    for (const def of D.LEVELS) {
        const G = Gm.newGame({ level: def.id, seed: 1 });
        const G2 = Gm.newGame({ level: def.id, seed: 999 });
        const sig = (g) => H.balls(g).map((b) => `${b.r},${b.c},${b.b.k},${b.b.c}`).join(';');
        const bad = [];
        if (sig(G) !== sig(G2)) bad.push('board depends on the play seed');
        if (Gm.targets(G) < 20) bad.push(`only ${Gm.targets(G)} ornaments`);
        // hangs from the ceiling: nothing floating
        const copy = { ...G, grid: G.grid.map((r) => r.slice()) };
        const before = H.balls(copy).length;
        const seen = new Set(); const q = [];
        for (let c = 0; c < C.COLS; c++) if (copy.grid[0][c]) { seen.add(c); q.push([0, c]); }
        while (q.length) { const [r, c] = q.pop(); for (const [a, b] of H.neighbors(copy, r, c)) if (copy.grid[a][b] && !seen.has(a * 64 + b)) { seen.add(a * 64 + b); q.push([a, b]); } }
        if (seen.size !== before) bad.push('floating ornaments');
        // colour groups capped
        for (const b of H.balls(G)) {
            if (b.b.k !== 'orn') continue;
            const n = Gm.group(G, b.r, b.c, b.b.c).filter(([r, c]) => G.grid[r][c].k === 'orn').length;
            if (n > 6) { bad.push(`a group of ${n}`); break; }
        }
        for (const b of H.balls(G)) {
            if (!Gm.TARGET_KINDS.has(b.b.k)) continue;
            const free = H.neighbors(G, b.r, b.c).filter(([r, c]) => G.grid[r][c]?.k !== 'coal').length;
            if (free < 2) { bad.push(`ornament at ${b.r},${b.c} walled in by coal`); break; }
        }
        for (const [k, n] of Object.entries(def.specials)) {
            const have = count(G, (b) => b.k === k);
            if (have !== n) bad.push(`${k} ${have}/${n}`);
        }
        if (H.lowestY ? false : Gm.lowestY(G) > C.DEAD_Y - 3 * C.ROW_H) bad.push('starts too close to the line');
        if (G.slots !== def.slots || G.colors !== def.colors) bad.push('tray or colours');
        ok(!bad.length, `L${def.id} ${def.name}: ${bad.join(', ') || 'valid'}`);
    }
    ok(D.LEVELS.filter((l) => l.ch === 0).every((l) => l.slots === 1) && D.LEVELS.filter((l) => l.ch >= 3).every((l) => l.slots === 3), 'the tray grows from one ornament to three');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame({ level: 14, seed }); const b = Bt.makeBot({ seed: 3 }); for (let t = 0; t < secs; t += DT) { Gm.step(G, Bt.botInput(G, b), DT); G.events.length = 0; } return G; };
    const a = play(42, 8), b = play(42, 8);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    for (const mode of ['level', 'endless']) {
        const G = Gm.newGame({ mode, level: 25, seed: 7 });
        const bot = Bt.makeBot({ seed: 1 });
        let t = 0;
        for (; t < 6; t += DT) Gm.step(G, Bt.botInput(G, bot), DT);
        while (G.phase !== 'fly' && !G.over && t < 30) { Gm.step(G, Bt.botInput(G, bot), DT); t += DT; }
        ok(G.phase === 'fly', `${mode}: caught a shot in flight`);
        G.events.length = 0;
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot({ seed: 2 }), b2 = Bt.makeBot({ seed: 2 });
        for (let s = 0; s < 8; s += DT) { Gm.step(G, Bt.botInput(G, b1), DT); Gm.step(copy, Bt.botInput(copy, b2), DT); G.events.length = copy.events.length = 0; }
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `${mode}: a save round trip mid-flight plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot and balance');
    const run = (G, bot, maxSec = 900) => {
        let bad = null;
        for (let t = 0; t < maxSec && !G.over; t += DT) {
            Gm.step(G, Bt.botInput(G, bot), DT);
            G.events.length = 0;
            if (!Number.isFinite(G.score) || !Number.isFinite(G.aim)) bad = 'non-finite score or aim';
            else if (G.sack.length > C.SACK_MAX) bad = 'sack overflow';
            else if (G.tray.length !== G.slots) bad = 'tray size changed';
            if (bad) break;
        }
        return bad;
    };
    const rows = [];
    for (const def of D.LEVELS) {
        const r = { id: def.id };
        for (const skill of [1, 0.6, 0.3]) {
            let wins = 0, shots = 0, stars = 0;
            for (let s = 1; s <= SEEDS; s++) {
                const G = Gm.newGame({ level: def.id, seed: s * 7919 });
                const bad = run(G, Bt.makeBot({ skill, seed: s }));
                if (bad) ok(false, `L${def.id} skill ${skill} seed ${s}: ${bad}`);
                if (G.result === 'won') { wins++; shots += G.shots; stars += G.stars; }
                if (!G.over) ok(false, `L${def.id} skill ${skill} seed ${s}: the level never ended`);
            }
            r[skill] = { wins, shots: wins ? Math.round(shots / wins) : 0, stars: wins ? stars / wins : 0 };
        }
        ok(r[1].wins === SEEDS, `L${def.id}: the perfect bot clears it on every seed (${r[1].wins}/${SEEDS})`);
        rows.push(r);
    }
    console.log('\n  level | perfect: win shots stars | skill 0.6 | skill 0.3');
    for (const r of rows) console.log(`  ${String(r.id).padStart(5)} | ${r[1].wins}/${SEEDS} ${String(r[1].shots).padStart(3)} ${r[1].stars.toFixed(1)} | ${r[0.6].wins}/${SEEDS} ${String(r[0.6].shots).padStart(3)} ${r[0.6].stars.toFixed(1)} | ${r[0.3].wins}/${SEEDS} ${String(r[0.3].shots).padStart(3)} ${r[0.3].stars.toFixed(1)}`);
    const rate = (k, from, to) => { const rs = rows.filter((r) => r.id >= from && r.id <= to); return rs.reduce((a, r) => a + r[k].wins, 0) / (rs.length * SEEDS); };
    const early06 = rate(0.6, 1, 12), late06 = rate(0.6, 25, 36), early03 = rate(0.3, 1, 12), late03 = rate(0.3, 25, 36);
    console.log(`  win rate: skill 0.6 ${(early06 * 100).toFixed(0)}% early, ${(late06 * 100).toFixed(0)}% late · skill 0.3 ${(early03 * 100).toFixed(0)}% early, ${(late03 * 100).toFixed(0)}% late`);
    ok(early06 >= 0.85, 'chapters 1–2 are forgiving: skill 0.6 clears at least 85%');
    ok(early03 >= 0.6, 'and even skill 0.3 clears most of them');
    ok(late03 < early03 || late06 < early06, 'the last chapters are harder than the first');
    const perfStars = rows.reduce((a, r) => a + r[1].stars, 0) / rows.length;
    const midStars = rows.reduce((a, r) => a + r[0.6].stars, 0) / rows.length;
    ok(perfStars > midStars && midStars < 2.8, `three stars take good play (perfect ${perfStars.toFixed(2)} vs skill 0.6 ${midStars.toFixed(2)})`);

    const surv = [];
    for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame({ mode: 'endless', seed: s * 31 });
        const bad = run(G, Bt.makeBot({ skill: 0.6, seed: s }), 1500);
        if (bad) ok(false, `blizzard seed ${s}: ${bad}`);
        surv.push(G.shots);
    }
    surv.sort((a, b) => a - b);
    console.log(`  blizzard (skill 0.6): shots survived ${surv.join(' ')}`);
    ok(surv[0] >= 40, 'a decent player lasts at least 40 shots in the blizzard');
    ok(surv[Math.floor(surv.length / 2)] < 400, 'but the blizzard always wins in the end');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
