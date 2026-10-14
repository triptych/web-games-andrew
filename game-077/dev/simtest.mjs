// CUE VICE — simulation tests. Plain Node, no dependencies:
//   node game-077/dev/simtest.mjs            (from the repo root)
//   VERBOSE=1 node game-077/dev/simtest.mjs
//
// 1. The sim is pure (no three.js, DOM, Math.random or clocks).
// 2. Every level parses, is rectangular, and everything that matters is
//    reachable by a rolling ball; every patrol point is walkable and every
//    patrol leg has a path.
// 3. Physics: thousands of random full-power shots never leave a ball inside a
//    wall, never produce NaN, and every shot comes to rest.
// 4. Rules: takedowns from behind, the alarm, pockets, darts, blasts, healing,
//    recruits, the locked exit, Instant Replay, the boombox, bosses.
// 5. Every level can be won by completing its objectives through the real
//    rules (teammates placed by hand, then a real shot into the exit).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../js/sim/levels.js';
import { parseLevel } from '../js/sim/level.js';
import { World } from '../js/sim/world.js';
import { T, isSolid, findPath, walkable } from '../js/sim/physics.js';
import { CREW_ORDER, CREW } from '../js/sim/data.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERBOSE = !!process.env.VERBOSE;
let fails = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log('  FAIL', msg); } else if (VERBOSE) console.log('  ok  ', msg); }
const section = (s) => console.log(`\n== ${s}`);

// ------------------------------------------------------------------ 1 purity
section('purity');
for (const f of fs.readdirSync(path.join(HERE, '../js/sim'))) {
    const src = fs.readFileSync(path.join(HERE, '../js/sim', f), 'utf8');
    ok(!/from ['"]three/.test(src), `${f} does not import three`);
    ok(!/\bdocument\.[a-z]|\bwindow\.[a-z]|Math\.random|performance\.now|Date\.now/.test(src), `${f} has no DOM, Math.random or clocks`);
}

// ------------------------------------------------------------------ 2 levels
section('levels');
function reachable(L, from) {
    // flood fill over tiles a ball can roll through; breakables and doors count as open
    const seen = new Uint8Array(L.w * L.h);
    const q = [];
    const open = (x, y) => {
        if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
        const t = L.tilesInit[y * L.w + x];
        if (t === T.WATER || t === T.VOID || t === T.WALL || t === T.WALL2 || t === T.RAIL) return false;
        return true;
    };
    for (const p of from) { const i = Math.floor(p.y) * L.w + Math.floor(p.x); seen[i] = 1; q.push(i); }
    while (q.length) {
        const i = q.pop(), x = i % L.w, y = (i / L.w) | 0;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ox, ny = y + oy;
            if (!open(nx, ny)) continue;
            const j = ny * L.w + nx;
            if (!seen[j]) { seen[j] = 1; q.push(j); }
        }
    }
    return (x, y) => {
        const tx = Math.floor(x), ty = Math.floor(y);
        for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = tx + ox, ny = ty + oy;
            if (nx >= 0 && ny >= 0 && nx < L.w && ny < L.h && seen[ny * L.w + nx]) return true;
        }
        return false;
    };
}

for (const def of LEVELS) {
    const L = parseLevel(def);
    const w0 = def.map[0].length;
    ok(def.map.every((r) => r.length === w0), `${def.id}: rectangular`);
    ok(L.starts.length >= Math.min(def.squad, 3), `${def.id}: ${L.starts.length} starts for squad ${def.squad}`);
    ok(L.exits.length > 0, `${def.id}: has an exit`);
    ok(def.getaway, `${def.id}: has a getaway vehicle`);
    const can = reachable(L, L.starts);
    for (const [name, list] of [['intel', L.intel], ['tape', L.tapes], ['switch', L.switches], ['target', L.targets], ['terminal', L.terms], ['exit', L.exits]]) {
        list.forEach((p, i) => ok(can(p.x, p.y), `${def.id}: ${name} ${i} at ${p.x - 0.5},${p.y - 0.5} reachable`));
    }
    if (def.recruit) ok(can(def.recruit.x + 0.5, def.recruit.y + 0.5), `${def.id}: recruit reachable`);
    if (def.vip) ok(can(def.vip.x + 0.5, def.vip.y + 0.5), `${def.id}: vip reachable`);
    const S = { w: L.w, h: L.h, tiles: new Uint8Array(L.tilesInit) };
    // open every door for the walk check: patrols may cross doors once opened
    for (const g of Object.keys(L.doors)) for (const i of L.doors[g]) S.tiles[i] = T.FLOOR;
    for (const f of def.foes ?? []) {
        const pts = f.path ?? [[f.x, f.y]];
        for (const [x, y] of pts) ok(walkable(S, L, x, y), `${def.id}: ${f.k} point ${x},${y} walkable`);
        ok(walkable(S, L, f.x, f.y), `${def.id}: ${f.k} start ${f.x},${f.y} walkable`);
        for (let i = 0; i < pts.length && pts.length > 1; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            ok(!!findPath(S, L, a[0] + 0.5, a[1] + 0.5, b[0] + 0.5, b[1] + 0.5, 4000), `${def.id}: ${f.k} leg ${a} → ${b} has a path`);
        }
    }
    for (const c of def.cams ?? []) ok(!isSolid(L.tilesInit[c.y * L.w + c.x]), `${def.id}: camera at ${c.x},${c.y} on an open tile`);
    for (const p of L.starts) ok(!isSolid(L.tilesInit[Math.floor(p.y) * L.w + Math.floor(p.x)]), `${def.id}: start open`);
}

// ------------------------------------------------------------------ helpers
const ALL = CREW_ORDER.slice();
function world(id, squad, extra = {}) {
    const def = LEVELS.find((l) => l.id === id);
    return new World(def, { squad, seed: 7, ...extra });
}
function runShot(W, maxT = 12) {
    let t = 0;
    while (W.S.phase === 'motion' && t < maxT) { W.step(1 / 120); t += 1 / 120; }
    return t;
}
function events(W) { return W.drain(); }
function place(b, x, y) { b.x = x; b.y = y; b.vx = 0; b.vy = 0; b.home = { x, y }; }
function finite(W) { return W.S.bodies.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy)); }
function hideFoes(W, keep = []) {
    for (const f of W.foes) if (!keep.includes(f)) { f.gone = true; f.state = 'gone'; }
}

// ------------------------------------------------------------------ 3 physics
section('physics');
{
    let shots = 0, inWall = 0, nan = 0, stuck = 0;
    for (const def of LEVELS) {
        const W = new World(def, { squad: ALL.slice(0, Math.max(1, Math.min(4, def.squad))), seed: 3 });
        hideFoes(W);
        let s = 12345;
        const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
        for (let n = 0; n < 60; n++) {
            const sh = W.shooters();
            if (!sh.length) break;
            const b = sh[n % sh.length];
            W.shoot(b.id, r() * Math.PI * 2, 0.4 + r() * 0.6);
            shots++;
            const t = runShot(W, 15);
            if (W.S.phase === 'motion') stuck++;
            if (!finite(W)) nan++;
            for (const m of W.S.bodies) {
                if (m.gone) continue;
                const tx = Math.floor(m.x), ty = Math.floor(m.y);
                if (tx < 0 || ty < 0 || tx >= W.S.w || ty >= W.S.h || isSolid(W.S.tiles[ty * W.S.w + tx])) inWall++;
            }
            if (W.S.phase === 'lost' || W.S.phase === 'won') break;
            events(W);
        }
    }
    ok(nan === 0, `no NaN after ${shots} random shots`);
    ok(inWall === 0, `no ball ends a shot inside a wall (${inWall})`);
    ok(stuck === 0, `every shot comes to rest (${stuck} did not)`);
}
{
    // energy: a ball fired straight at a wall comes back slower, never faster
    const W = world('marina', ['rico']);
    hideFoes(W);
    const b = W.crew[0];
    place(b, 8.5, 2.5);
    W.shoot(b.id, Math.PI, 1);
    let maxBack = 0;
    for (let i = 0; i < 400 && W.S.phase === 'motion'; i++) { W.step(1 / 120); if (b.vx > 0) maxBack = Math.max(maxBack, b.vx); }
    ok(maxBack > 0 && maxBack < 21, `wall bounce returns slower (${maxBack.toFixed(2)})`);
}

// ------------------------------------------------------------------ 4 rules
section('rules');
{
    // takedown from behind
    const W = world('marina', ['rico']);
    const g = W.foes.find((f) => f.path.length === 1);   // the boathouse post
    hideFoes(W, [g]);
    g.look = Math.PI / 2; g.sweep = 0; g.face = Math.PI / 2;  // facing south
    const b = W.crew[0];
    place(b, g.x, g.y - 2.2);   // north of him: behind
    W.shoot(b.id, Math.PI / 2, 0.45);
    runShot(W);
    const ev = events(W);
    ok(ev.some((e) => e.type === 'takedown'), 'hitting an unaware guard from behind knocks him out');
    ok(W.S.alarm.mode === 'sneak', 'a clean takedown raises no alarm');
    ok(g.state === 'ko', `guard is out cold (${g.state})`);
}
{
    // walking into a guard's face raises the alarm
    const W = world('marina', ['rico']);
    const g = W.foes.find((f) => f.path.length === 1);
    hideFoes(W, [g]);
    g.sweep = 0; g.face = Math.PI / 2; g.look = Math.PI / 2;
    const b = W.crew[0];
    place(b, g.x, g.y + 1.05);  // in front, inside the cone
    W.wait(3);
    runShot(W);
    ok(W.S.alarm.mode === 'alert' || W.S.stats.alarms > 0, `standing in a cone gets you seen (${W.S.alarm.mode})`);
}
{
    // a soft frontal hit only stuns and alerts
    const W = world('marina', ['rico']);
    const g = W.foes.find((f) => f.path.length === 1);
    hideFoes(W, [g]);
    g.sweep = 0; g.face = Math.PI / 2; g.look = Math.PI / 2;
    const b = W.crew[0];
    place(b, g.x, g.y + 1.5);
    W.shoot(b.id, -Math.PI / 2, 0.05);
    runShot(W);
    ok(g.state !== 'ko', 'a soft frontal bump does not knock out');
    ok(W.S.stats.alarms > 0, 'and it raises the alarm');
}
{
    // pocket a guard in the bay
    const W = world('marina', ['rico']);
    const g = W.foes[0];
    hideFoes(W, [g]);
    place(g, 9.5, 7.5); g.path = [[9.5, 7.5]]; g.face = -Math.PI / 2; g.look = -Math.PI / 2; g.sweep = 0;
    const b = W.crew[0];
    place(b, 9.5, 6.2);  // north of him (behind), pushing south into the gap? railings at row 8 x5-11
    g.x = 13.5; g.home = { x: 13.5, y: 7.5 }; g.path = [[13.5, 7.5]];
    place(b, 13.5, 5.6);
    W.shoot(b.id, Math.PI / 2, 1);
    runShot(W);
    const ev = events(W);
    ok(ev.some((e) => e.type === 'pocket' && e.kind === 'foe'), 'a hard hit knocks a guard through the pier gap into the water');
    ok(g.gone, 'sunk guards are gone');
}
{
    // teammates in the water climb out where they started, a heart lighter
    const W = world('marina', ['rico']);
    hideFoes(W);
    const b = W.crew[0];
    W.shoot(b.id, Math.PI, 0.7);   // west off the pier into the water
    runShot(W);
    ok(b.hp === CREW.rico.hp - 1, `splash costs a heart (${b.hp})`);
    ok(Math.hypot(b.x - 4.5, b.y - 12.5) < 0.01, 'and puts you back where you shot from');
}
{
    // darts put unaware guards to sleep and bank once
    const W = world('club', ['rico', 'lola']);
    const lola = W.crew.find((b) => b.who === 'lola');
    const g = W.foes[1];
    hideFoes(W, [g]);
    g.path = [[16.5, 9.5]]; place(g, 16.5, 9.5); g.face = 0; g.look = 0; g.sweep = 0;
    place(lola, 12.5, 12.5);
    W.shoot(lola.id, Math.atan2(9.5 - 12.5, 16.5 - 12.5), 0.3);
    W.step(1 / 120);
    ok(W.ability(), 'Lola fires a dart while rolling');
    runShot(W);
    ok(g.state === 'sleep', `dart sends an unaware guard to sleep (${g.state})`);
    ok(lola.charges === CREW.lola.charges - 1, 'one dart spent');
}
{
    // Dex: explosions knock out, break crates, blow the target cars
    const W = world('motors', ['dex', 'rico', 'doc']);
    const dex = W.crew.find((b) => b.who === 'dex');
    hideFoes(W);
    const car = W.L.targets[1];
    place(dex, car.x + 2.5, car.y);
    W.shoot(dex.id, Math.PI, 0.3);
    W.step(1 / 120);
    ok(W.ability(), 'Dex detonates');
    runShot(W);
    ok(W.S.targets[1], 'the blast wrecks the target car');
    ok(W.S.objectives.find((o) => o.id === 'target1').done, 'and completes its objective');
    const ri = W.crew.find((b) => b.who === 'rico');
    ok(dex.hp === CREW.dex.hp, 'Dex is blast proof');
    // crate
    const W2 = world('motors', ['dex']);
    hideFoes(W2);
    const d2 = W2.crew[0];
    place(d2, 2.5, 3.5);   // crate at x6,y3? (row 3: '#:::::X' x6)
    W2.shoot(d2.id, 0, 0.35);
    for (let i = 0; i < 60; i++) W2.step(1 / 120);
    place(d2, 4.6, 3.5); d2.vx = 2;
    W2.ability();
    runShot(W2);
    ok(W2.S.tiles[3 * W2.S.w + 6] === T.FLOOR, 'blasts break crates');
}
{
    // Doc heals by touch and revives the downed
    const W = world('hospital', ['rico', 'lola', 'doc']);
    hideFoes(W);
    const doc = W.crew.find((b) => b.who === 'doc'), rico = W.crew.find((b) => b.who === 'rico');
    ok(rico.hp === 1, 'Code Blue starts the squad hurt');
    place(rico, 3.5, 5.5); place(doc, 8.5, 5.5);
    W.shoot(doc.id, Math.PI, 0.4);
    runShot(W);
    ok(rico.hp === 2, `Doc's touch heals (${rico.hp})`);
    rico.hp = 0; rico.downed = true;
    place(doc, rico.x + 3, rico.y);
    W.shoot(doc.id, Math.PI, 0.4);
    runShot(W);
    ok(!rico.downed && rico.hp >= 1, 'Doc gets a downed teammate back up');
}
{
    // recruit joins on touch; exit locked until the objectives are done
    const W = world('club', ['rico']);
    hideFoes(W);
    const rico = W.crew[0];
    const rec = W.S.bodies.find((b) => b.kind === 'recruit');
    place(rico, rec.x, rec.y - 1.6);
    W.shoot(rico.id, Math.PI / 2, 0.2);
    runShot(W);
    ok(rec.kind === 'crew' && rec.who === 'lola', 'Lola joins when Rico reaches her');
    ok(W.S.objectives.find((o) => o.id === 'recruit').done, 'recruit objective done');
    place(rico, 27.5, 1.5);
    W.shoot(rico.id, -Math.PI / 2, 0.15);
    runShot(W);
    ok(!rico.extracted, 'the exit will not take you before the job is done');
}
{
    // Instant Replay
    const W = world('marina', ['rico']);
    const b = W.crew[0];
    const x0 = b.x, y0 = b.y;
    W.shoot(b.id, -Math.PI / 2, 0.8);
    runShot(W);
    ok(Math.hypot(W.crew[0].x - x0, W.crew[0].y - y0) > 1, 'the shot moved Rico');
    ok(W.rewind(), 'rewind works');
    ok(Math.hypot(W.crew[0].x - x0, W.crew[0].y - y0) < 1e-6, 'and puts him back');
    ok(W.S.rewinds === 2 && W.S.stats.shots === 0, 'one replay spent, the shot forgiven');
}
{
    // Roxy's boombox draws guards and they dance
    const W = world('mansion', ['roxy', 'rico', 'lola', 'doc']);
    const roxy = W.crew.find((b) => b.who === 'roxy');
    const g = W.foes.find((f) => f.k === 'goon' && f.path.length > 1 && f.y > 14);
    hideFoes(W, [g]);
    place(roxy, 10.5, 18.5);
    W.shoot(roxy.id, 0, 0.3);
    W.step(1 / 120);
    ok(W.ability(), 'Roxy drops a boombox');
    ok(g.state === 'dance', `a nearby guard goes to dance (${g.state})`);
    runShot(W); W.wait(6); runShot(W);
    ok(Math.hypot(g.x - W.S.boomboxes[0]?.x, g.y - W.S.boomboxes[0]?.y) < 2.2, 'and gets there');
}
{
    // Jinx: secure terminals, ghost
    const W = world('station', ['rico', 'lola', 'doc'], {});
    hideFoes(W);
    const rico = W.crew[0];
    const term = W.L.terms[1];
    place(rico, term.x - 1.2, term.y);
    W.shoot(rico.id, 0, 0.2);
    runShot(W);
    ok(!W.S.terms[1], 'Rico cannot hack the secure mainframe');
    const W2 = world('station', ['jinx', 'rico', 'lola']);
    hideFoes(W2);
    const jinx = W2.crew[0];
    place(jinx, term.x - 2, term.y);
    W2.shoot(jinx.id, 0, 0.2);
    runShot(W2);
    ok(W2.S.terms[1] && W2.S.doors['3'], 'Jinx hacks it and the server room opens');
    // ghost: walk her through a cone without being seen
    const W3 = world('marina', ['jinx']);
    const g = W3.foes.find((f) => f.path.length === 1);
    hideFoes(W3, [g]);
    g.sweep = 0; g.face = Math.PI / 2; g.look = Math.PI / 2;
    const j = W3.crew[0];
    place(j, g.x - 4, g.y + 2.5);
    W3.shoot(j.id, 0, 0.55);
    W3.step(1 / 120);
    W3.ability();
    runShot(W3);
    ok(W3.S.stats.alarms === 0 && g.sus < 0.3, `ghosted Jinx rolls through a cone unseen (sus ${g.sus.toFixed(2)})`);
}
{
    // Tito: wrecking ball through cracked walls; anchor stops dead
    const W = world('port', ['tito', 'rico', 'lola']);
    hideFoes(W);
    const tito = W.crew[0];
    place(tito, 20.5, 3.5);
    W.shoot(tito.id, 0, 1);
    runShot(W);
    ok(W.S.tiles[3 * W.S.w + 23] === T.FLOOR, 'Tito smashes the cracked container door');
    ok(W.S.targets[0], 'and photographs the shipment');
    place(tito, 10.5, 5.5);
    W.shoot(tito.id, 0, 1);
    for (let i = 0; i < 30; i++) W.step(1 / 120);
    ok(W.ability(), 'Tito anchors');
    ok(tito.vx === 0 && tito.vy === 0, 'and stops dead');
}
{
    // bosses take several hits and must be sunk
    const W = world('mansion', ['rico', 'roxy', 'lola', 'doc']);
    const nico = W.foes.find((f) => f.k === 'nico');
    hideFoes(W, [nico]);
    nico.path = [[6.5, 13.5]]; place(nico, 6.5, 13.5); nico.look = Math.PI / 2; nico.face = Math.PI / 2;
    const rico = W.crew.find((b) => b.who === 'rico');
    let hits = 0;
    for (let n = 0; n < 6 && nico.hp > 0 && !nico.gone; n++) {
        place(nico, 6.5, 13.5); nico.ctl = false;
        place(rico, 3.0, 13.5);
        W.shoot(rico.id, 0, 1);
        runShot(W);
        events(W).forEach((e) => { if (e.type === 'bossHit' || e.type === 'takedown') hits++; });
    }
    ok(hits >= 3, `Nico takes several hits (${hits})`);
    ok(nico.gone || nico.dazed, 'and is either dazed or in the pool');
}
{
    // the precinct fails on any alarm
    const W = world('precinct', ['rico', 'lola', 'doc']);
    W.raiseAlarm(W.foes[0], 5, 5);
    ok(W.S.phase === 'lost' && W.S.result.why === 'made', 'an alarm at the precinct ends the mission');
}

// ------------------------------------------------------------------ 5 every level is winnable
section('winnable');
for (const def of LEVELS) {
    const squad = [...new Set([...(def.need ?? []), 'jinx', 'dex', 'tito', 'rico'])].filter((w) => w !== def.recruit?.who).slice(0, Math.max(def.squad, (def.need ?? []).length + 1));
    const W = new World(def, { squad, seed: 11 });
    hideFoes(W, W.foes.filter((f) => f.sink));
    const L = W.L, S = W.S;
    const any = () => W.crew.find((b) => !b.downed && !b.extracted);
    const who = (w) => W.crew.find((b) => b.who === w);
    const touch = (b, x, y) => { place(b, x, y); W._touches(); };
    if (def.recruit) { const r = S.bodies.find((b) => b.kind === 'recruit'); const c = any(); place(c, r.x - 1.5, r.y); W.shoot(c.id, 0, 0.15); runShot(W); }
    L.intel.forEach((it) => touch(any(), it.x, it.y));
    L.terms.forEach((t, i) => { if (t.obj || t.opens) { const j = who('jinx') ?? any(); place(j, t.x - 0.9, t.y); W.hack(i, j); } });
    L.targets.forEach((t, i) => {
        if (t.kind === 'car' || t.kind === 'safe') W.explode(t.x, t.y, 2.7, who('dex'));
        else touch(any(), t.x, t.y);
    });
    for (const f of W.foes) if (f.sink && !f.gone) { const p = L.def.map.findIndex((r) => r.includes('~')); const ty = p, tx = L.def.map[p].indexOf('~'); place(f, tx + 0.5, ty + 0.5); W.hooks ??= W._hooks(); W.hooks.pocket(f, 'water'); }
    if (def.vip) { const v = S.bodies.find((b) => b.kind === 'vip'); place(v, L.exits[0].x, L.exits[0].y); }
    // everyone (including the downed) into the exit, then one real shot to end the turn
    W.crew.forEach((b) => { b.downed = false; b.hp = Math.max(1, b.hp); });
    W.drain();
    for (const b of W.crew) {
        if (S.phase !== 'aim') break;
        const e = L.exits[0];
        place(b, e.x, e.y);
        W.shoot(b.id, 0, 0.0);
        runShot(W);
    }
    const left = S.objectives.filter((o) => !o.done && o.id !== 'extract').map((o) => o.text);
    ok(left.length === 0, `${def.id}: every objective can be completed (${left.join('; ') || 'all done'})`);
    ok(S.phase === 'won', `${def.id}: the episode is won (${S.phase}${S.result?.why ? ' ' + S.result.why : ''})`);
    if (S.result?.grade) VERBOSE && console.log(`     ${def.id} grade ${S.result.grade} score ${S.result.score}`);
}

// ------------------------------------------------------------------ a fair start
section('fair start');
for (const def of LEVELS) {
    const squad = [...new Set([...(def.need ?? []), ...ALL.filter((w) => w !== def.recruit?.who)])].slice(0, def.squad);
    const W = new World(def, { squad, seed: 3 });
    let trouble = null;
    for (let n = 0; n < 3 && !trouble; n++) {
        W.wait(1.5); runShot(W);
        trouble = W.drain().find((e) => e.type === 'alarm' || e.type === 'suspicious');
    }
    ok(!trouble, `${def.id}: nobody notices the squad in the first 4.5 s${trouble ? ` (${trouble.type})` : ''}`);
}

// ------------------------------------------------------------------ guards live a while
section('patrols');
for (const def of LEVELS) {
    const W = new World(def, { squad: ['rico'], seed: 5 });
    for (const b of W.crew) { b.gone = true; }   // nobody to see
    const start = W.foes.map((f) => ({ x: f.x, y: f.y }));
    const far = W.foes.map(() => 0);
    for (let n = 0; n < 20; n++) {
        W.wait(1.5); runShot(W);
        W.foes.forEach((f, i) => { far[i] = Math.max(far[i], Math.hypot(f.x - start[i].x, f.y - start[i].y)); });
        if (W.S.phase !== 'aim') break;
    }
    ok(finite(W), `${def.id}: guards stay finite over 30 s`);
    const movers = W.foes.filter((f, i) => f.path.length > 1);
    const moved = movers.filter((f) => far[W.foes.indexOf(f)] > 1.5);
    ok(moved.length === movers.length, `${def.id}: every patrolling guard walks (${moved.length}/${movers.length})`);
    const stuckInWall = W.foes.filter((f) => !f.gone && isSolid(W.S.tiles[Math.floor(f.y) * W.S.w + Math.floor(f.x)]));
    ok(stuckInWall.length === 0, `${def.id}: no guard ends up inside a wall`);
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
