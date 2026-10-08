/**
 * simtest.mjs — headless tests of the pure simulation (js/sim), no browser.
 *
 *   purity       js/sim never imports three, touches the DOM or calls Math.random.
 *   tracks       every track: no bend tighter than the barrier can follow, no two parts of the loop
 *                closer than two barriers apart (bridges excepted), the grid behind the line, coins
 *                and patches on the road, slopes a car can climb.
 *   physics      a field of bots races every track: nobody NaNs, sinks into the ground, leaves
 *                the barriers or gets stuck for good; everyone finishes; jumps get air.
 *   determinism  the same race twice gives the same finishing times.
 *   rules        elimination knocks one car out per lap and ends with one; time trial medals; payouts,
 *                first-win bonus, unlocks, circuits, upgrades and the final.
 *   career       a bot plays the whole career like a player would: races each event with its own car,
 *                spends its winnings on upgrades, retries what it loses, and must win the Dirt Crown
 *                within a sensible number of races.
 *
 *   node game-069/dev/simtest.mjs            ONLY=purity,tracks,physics,determinism,rules,career
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Track } from '../js/sim/track.js';
import { TRACKS, trackDef } from '../js/sim/tracks.js';
import { Race } from '../js/sim/race.js';
import { specFromLevels, levelsForRating, rating, CATS, LEVEL_COST } from '../js/sim/parts.js';
import { CIRCUITS, EVENTS, newProfile, buildField, recordResult, cleared, eventUnlocked, nextEvent, buyUpgrade, upgradeCost, payout, playerRating } from '../js/sim/career.js';
import { SCENES, TRIGGERS, CAST } from '../js/sim/story.js';
import { DT } from '../js/config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log(`  ✗ ${m}`); } else if (process.env.VERBOSE) console.log(`  ✓ ${m}`); };
const section = (n) => console.log(`\n${n}`);

/** Run a race to the end with bots in every seat (the player too, unless ctl is given). */
function runRace(track, entrants, opts = {}) {
    const r = new Race({ track, type: opts.type || 'race', laps: opts.laps || 2, entrants, seed: opts.seed || 3, targets: opts.targets, rubber: opts.rubber });
    let resets = 0, airs = 0, maxAir = 0, bad = null;
    const limit = opts.limit || 600;
    while (r.t < limit) {
        r.step(DT);
        for (const e of r.events) {
            if (e.type === 'reset') resets++;
            if (e.type === 'land') { airs++; maxAir = Math.max(maxAir, e.airT); }
        }
        for (const c of r.cars) {
            if (!Number.isFinite(c.x + c.y + c.z + c.vx + c.vz + c.vy + c.h)) bad = bad || `NaN car ${c.id}`;
            if (!c.out && Math.abs(c.loc.d) > track.wall + 0.5) bad = bad || `car ${c.id} beyond the barrier (d=${c.loc.d.toFixed(2)})`;
            const g = track.heightAt(c.loc.i, c.loc.f, c.loc.d);
            if (c.y < g - 0.3) bad = bad || `car ${c.id} under the ground by ${(g - c.y).toFixed(2)}`;
        }
        if (r.cars.every((c) => c.finished || c.out)) break;
        if (opts.stopWhenPlayerDone && r.playerDone) break;
    }
    return { r, resets, airs, maxAir, bad };
}

const botField = (rate, n = 6, playerSpec = null) => Array.from({ length: n }, (_, k) => ({
    name: 'B' + k,
    spec: k === 0 && playerSpec ? playerSpec : specFromLevels(levelsForRating(rate + (k - 2) * 15)),
    ai: { skill: 0.72 + (k % 4) * 0.06, lane: ((k % 3) - 1) * 0.5 },
}));

// ================================================================== purity
if (want('purity')) {
    section('purity');
    const dir = path.join(HERE, '../js/sim');
    for (const f of fs.readdirSync(dir)) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        ok(!/from ['"]three/.test(src), `${f} does not import three`);
        ok(!/\bdocument\.|\bwindow\./.test(src), `${f} does not touch the DOM`);
        ok(!/Math\.random/.test(src), `${f} does not call Math.random`);
        ok(!/from ['"]\.\.\/view/.test(src), `${f} does not import the view`);
    }
}

// ================================================================== tracks
if (want('tracks')) {
    section('tracks');
    for (const id of Object.keys(TRACKS)) {
        for (const rev of [false, true]) {
            const t = new Track(trackDef(id, rev));
            const tag = `${id}${rev ? ' (rev)' : ''}`;
            let rawR = Infinity;
            for (let i = 0; i < t.N; i++) rawR = Math.min(rawR, 1 / Math.abs(t.kRaw[i]));
            ok(rawR > t.wall + 3, `${tag}: tightest bend r=${rawR.toFixed(1)} clears the barrier (${t.wall})`);
            const skip = Math.ceil((t.wall * 3.2) / t.ds);
            let minC = Infinity;
            for (let i = 0; i < t.N; i++) for (let j = i + skip; j < t.N; j++) {
                if (t.N - j + i < skip) continue;
                if (Math.abs(t.py[i] - t.py[j]) > 5.5) continue;
                minC = Math.min(minC, Math.hypot(t.px[i] - t.px[j], t.pz[i] - t.pz[j]));
            }
            ok(minC > 2 * t.wall + 3, `${tag}: separate parts of the loop stay apart (${minC.toFixed(1)} m)`);
            let maxS = 0;
            for (let i = 0; i < t.N; i++) maxS = Math.max(maxS, Math.abs(t.slopeAt(i)));
            ok(maxS < 0.45, `${tag}: steepest slope ${maxS.toFixed(2)} is climbable`);
            ok(t.L > 600 && t.L < 2000, `${tag}: length ${t.L.toFixed(0)} m`);
            for (const c of t.coins) ok(Math.abs(c.d) < t.hw, `${tag}: coin on the road`);
            for (const g of t.grid.slice(0, 6)) ok(t.delta(g.i, t.startI) > 0 && Math.abs(g.d) < t.hw, `${tag}: grid slot behind the line`);
            if (TRACKS[id].shape.type === 'eight') {
                let gap = 0;
                for (let i = 0; i < t.N; i++) for (let j = 0; j < t.N; j++) {
                    if (Math.abs(t.delta(i, j)) < 40) continue;
                    if (Math.hypot(t.px[i] - t.px[j], t.pz[i] - t.pz[j]) < 4) gap = Math.max(gap, Math.abs(t.py[i] - t.py[j]));
                }
                ok(gap > 5.5, `${tag}: the figure eight crosses on a bridge (${gap.toFixed(1)} m clearance)`);
            }
        }
    }
}

// ================================================================== physics
if (want('physics')) {
    section('physics');
    for (const id of Object.keys(TRACKS)) {
        for (const rate of [100, 550, 1000]) {
            const t = new Track(trackDef(id, rate === 550));
            const { r, resets, airs, maxAir, bad } = runRace(t, botField(rate), { laps: 2 });
            const tag = `${id}${rate === 550 ? ' (rev)' : ''} @${rate}`;
            ok(!bad, `${tag}: ${bad || 'no NaN, nothing under the ground or past the barrier'}`);
            ok(r.cars.every((c) => c.finished), `${tag}: everyone finishes (${r.cars.filter((c) => c.finished).length}/6, t=${r.t.toFixed(0)})`);
            ok(resets <= 3, `${tag}: ${resets} resets`);
            const lap = Math.min(...r.cars.map((c) => c.best));
            ok(lap > 18 && lap < 90, `${tag}: best lap ${lap.toFixed(1)} s`);
            if ((TRACKS[id].features || []).some((f) => f.type === 'table' || f.type === 'kicker') && rate >= 550) ok(maxAir > 0.35, `${tag}: the jumps give air (${maxAir.toFixed(2)} s, ${airs} landings)`);
        }
    }
}

// ================================================================== determinism
if (want('determinism')) {
    section('determinism');
    const t = new Track(trackDef('crownrun'));
    const a = runRace(t, botField(700), { laps: 1, seed: 11 }).r.cars.map((c) => c.finishT.toFixed(4)).join();
    const b = runRace(t, botField(700), { laps: 1, seed: 11 }).r.cars.map((c) => c.finishT.toFixed(4)).join();
    ok(a === b, 'the same race twice gives the same times');
}

// ================================================================== rules
if (want('rules')) {
    section('rules');
    // Elimination.
    const t = new Track(trackDef('hollow'));
    const el = runRace(t, botField(300), { type: 'elim', laps: 5, limit: 400 });
    ok(el.r.cars.filter((c) => c.out).length === 5, `elimination knocks out five (${el.r.cars.filter((c) => c.out).length})`);
    ok(el.r.results && el.r.results.order.length === 6, 'elimination ranks all six');
    // Time trial: a slow car misses the medals, a quick one gets gold.
    const tt = new Track(trackDef('windmill'));
    const ref = runRace(tt, [{ name: 'ref', spec: specFromLevels(levelsForRating(130, ['engine', 'tires'])), ai: { skill: 0.9 } }], { laps: 2 }).r.cars[0].finishT;
    const targets = [ref * 1.02, ref * 1.07, ref * 1.13];
    const fast = runRace(tt, [{ name: 'fast', spec: specFromLevels(levelsForRating(400)), ai: { skill: 0.92 } }], { type: 'tt', laps: 2, targets });
    ok(fast.r.results.medal === 'gold', `a much better car takes gold (${fast.r.results.medal})`);
    const slow = runRace(tt, [{ name: 'slow', spec: specFromLevels(levelsForRating(100)), ai: { skill: 0.55 } }], { type: 'tt', laps: 2, targets });
    ok(slow.r.results.medal !== 'gold', `a sloppy starter doesn't (${slow.r.results.medal})`);
    // After the player finishes, the car cruises on (and stays finite) while the others race on.
    {
        const t2 = new Track(trackDef('barnyard'));
        const r2 = new Race({ track: t2, type: 'race', laps: 1, entrants: botField(300), seed: 4 });
        let bad = false, steps = 0;
        while (!r2.playerDone && r2.t < 200) { r2.step(DT); steps++; }
        r2.drivers[0] = null;   // the player's own car: the race's cruise driver takes over
        for (let k = 0; k < 1200; k++) { r2.step(DT, { throttle: 0, brake: 0, steer: 0 }); if (r2.cars.some((c) => !Number.isFinite(c.x + c.y + c.vx + c.vy + c.h + c.w))) bad = true; }
        ok(r2.playerDone && !bad, `after the player finishes every car stays finite (${steps} steps to the flag)`);
    }
    // Career rules.
    const p = newProfile('T');
    ok(eventUnlocked(p, 'flats-1') && !eventUnlocked(p, 'flats-2'), 'only the first race is open at the start');
    ok(!eventUnlocked(p, 'woods-1'), 'the second circuit is locked');
    const pay1 = recordResult(p, EVENTS['flats-1'], { pos: 1, time: 100, coins: 10 });
    ok(pay1.bonus > 0 && p.coins === 150 + pay1.total + 10, `a first win pays the purse, the bonus and the coins (${pay1.total})`);
    ok(eventUnlocked(p, 'flats-2'), 'a win opens the next race');
    const pay2 = recordResult(p, EVENTS['flats-1'], { pos: 1, time: 99, coins: 0 });
    ok(pay2.bonus === 0, 'the bonus is paid once');
    recordResult(p, EVENTS['flats-2'], { pos: 1, time: 50, medal: 'bronze', coins: 0 });
    recordResult(p, EVENTS['flats-3'], { pos: 3, time: 80, coins: 0 });
    ok(eventUnlocked(p, 'flats-4'), 'bronze and a podium open the boss race');
    recordResult(p, EVENTS['flats-4'], { pos: 2, time: 80, coins: 0 });
    ok(!eventUnlocked(p, 'woods-1'), 'second place against a champion is not enough');
    recordResult(p, EVENTS['flats-4'], { pos: 1, time: 80, coins: 0 });
    ok(eventUnlocked(p, 'woods-1'), 'beating the champion opens the next circuit');
    p.coins = 10000;
    ok(buyUpgrade(p, 'engine') && p.levels.engine === 1 && p.coins === 10000 - LEVEL_COST[1], 'upgrades cost coins and add a level');
    for (let k = 0; k < 6; k++) buyUpgrade(p, 'engine');
    ok(p.levels.engine === 5, 'levels stop at five');
    ok(rating({ engine: 5, drive: 5, tires: 5, susp: 5, body: 5, nitro: 5 }) === 1000, 'a maxed car rates 1000');
    // Every event's field builds, with the champion where there is one.
    for (const id of Object.keys(EVENTS)) {
        const ev = EVENTS[id];
        const f = buildField(ev, newProfile('X'));
        ok(f.length === (ev.type === 'tt' ? 1 : ev.type === 'duel' ? 2 : 6), `${id}: field of ${f.length}`);
        if (ev.boss) ok(f.some((e) => e.champ === ev.boss), `${id}: ${ev.boss} is on the grid`);
    }
    // Story: every speaker exists and every trigger points at a scene.
    for (const [id, sc] of Object.entries(SCENES)) for (const [who] of sc.lines) ok(!!CAST[who], `scene ${id}: speaker ${who}`);
    for (const kind of Object.values(TRIGGERS)) for (const [ev, sc] of Object.entries(kind)) ok(EVENTS[ev] && SCENES[sc], `trigger ${ev} → ${sc}`);
}

// ================================================================== career
if (want('career')) {
    section('career (a bot plays the whole game)');
    const p = newProfile('Bot');
    const SKILL = Number(process.env.SKILL || 0.82);
    let races = 0;
    const log = [];
    // Spend like a sensible player: the cheapest upgrade first, keeping lines level.
    const shop = () => {
        for (;;) {
            let best = null;
            for (const c of CATS) { const cost = upgradeCost(p, c); if (cost && cost <= p.coins && (!best || cost < upgradeCost(p, best))) best = c; }
            if (!best) break;
            buyUpgrade(p, best);
        }
    };
    const ttCache = {};
    while (!p.done && races < 400) {
        shop();
        const ev = nextEvent(p);
        if (!ev) break;
        const track = new Track(trackDef(ev.track, !!ev.reverse));
        const field = buildField(ev, p);
        field[0].ai = { skill: SKILL, lane: 0, nitroHappy: 0.7 };
        let targets = null;
        if (ev.type === 'tt') {
            if (!ttCache[ev.id]) {
                const ref = runRace(track, [{ name: 'ref', spec: specFromLevels(levelsForRating(ev.rating, ['engine', 'tires'])), ai: { skill: 0.9 } }], { laps: ev.laps }).r.cars[0].finishT;
                ttCache[ev.id] = [ref * 1.02, ref * 1.07, ref * 1.13];
            }
            targets = ttCache[ev.id];
        }
        const { r } = runRace(track, field, { type: ev.type, laps: ev.laps, seed: 100 + races, targets, rubber: !ev.boss && ev.type !== 'duel' && ev.type !== 'tt', stopWhenPlayerDone: true });
        const res = r.results || r.makeResults();
        recordResult(p, ev, res);
        races++;
        log.push(`${ev.id.padEnd(9)} ⚡${String(playerRating(p)).padStart(4)} vs ${ev.rating}: ${ev.type === 'tt' ? res.medal || 'none' : res.pos} · 🪙${p.coins}`);
    }
    if (process.env.VERBOSE) console.log(log.join('\n'));
    const tries = {};
    for (const [id, r] of Object.entries(p.results)) tries[id] = r.runs;
    console.log(`  races: ${races}, rating ${playerRating(p)}, coins left ${p.coins}`);
    console.log(`  runs per event: ${Object.entries(tries).map(([k, v]) => `${k}:${v}`).join(' ')}`);
    ok(p.done, `the bot wins the Dirt Crown (${races} races)`);
    ok(races < 90, `in under 90 races (${races})`);
    ok(Math.max(...Object.values(tries)) <= 12, 'no event needs more than 12 tries');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
