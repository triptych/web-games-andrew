/**
 * simtest.mjs — headless tests of the pure simulation (no browser).
 *
 *   node game-062/dev/simtest.mjs
 *   ONLY=purity,determinism,content,physics,rpg,story,bosses,bot   (comma list)
 *   HOLES=1-1,2-4   SEEDS=2 (noisy-bot seeds)   VERBOSE=1
 *
 * purity       js/sim never imports three, touches the DOM or calls Math.random
 * determinism  the same shots give the same hash; a clone plays a shot exactly like the original
 * content      every hole: tee on the tee, cup on a flat green, pickups and monsters on real ground,
 *              route points playable, pars and stroke limits sane
 * physics      thousands of random shots per realm: never NaN, never deep under the ground,
 *              never inside a solid collider, always settles
 * rpg          XP curve, levelling, stat points, shop stock, buying, equipping, results
 * story        every scene's speakers exist; every realm has its intro, boss and win scenes
 * bosses       every boss can be hit and beaten; the seal opens; bosses act on their turn
 * bot          a search bot with perfect strikes plays all 20 holes at par or better, and a noisy,
 *              risk-aware bot (human-like timing errors) finishes every hole inside the stroke limit
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOLES, HOLE_BY_ID } from '../js/sim/holes.js';
import { buildCourse, BALL_R } from '../js/sim/course.js';
import { World, runUntilSettled } from '../js/sim/world.js';
import { SURF, SURF_PHYS, REALMS } from '../js/sim/realms.js';
import { CLUBS, CLUB_ORDER } from '../js/sim/clubs.js';
import { playHole } from '../js/sim/bot.js';
import * as rpg from '../js/sim/rpg.js';
import { SCENES, SPEAKERS } from '../js/sim/story.js';
import { BOSSES } from '../js/sim/bosses.js';
import { Rng } from '../js/rng.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const HOLE_IDS = (process.env.HOLES ?? '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS ?? 1);
const VERBOSE = !!process.env.VERBOSE;
let fails = 0, passes = 0;
const ok = (m) => { passes++; if (VERBOSE) console.log(`  ✓ ${m}`); };
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const check = (c, m) => (c ? ok(m) : fail(m));
const want = (k) => !ONLY.length || ONLY.includes(k);
const holes = HOLES.filter((h) => !HOLE_IDS.length || HOLE_IDS.includes(h.id));
const courses = new Map();
const course = (h) => { if (!courses.has(h.id)) courses.set(h.id, buildCourse(h)); return courses.get(h.id); };
const section = (name) => console.log(`\n== ${name}`);

// ------------------------------------------------------------------------------------------ purity
if (want('purity')) {
    section('purity');
    const dir = path.join(HERE, '../js/sim');
    for (const f of fs.readdirSync(dir)) {
        const code = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        check(!/from\s+['"]three/.test(code), `${f} does not import three`);
        check(!/\bdocument\.|\bwindow\.|localStorage|requestAnimationFrame/.test(code), `${f} does not touch the DOM`);
        check(!/Math\.random\(/.test(code), `${f} never calls Math.random`);
        check(!/from\s+['"]\.\.\/(view|ui)\//.test(code), `${f} does not import the view or UI`);
    }
}

// ------------------------------------------------------------------------------------------ determinism
if (want('determinism')) {
    section('determinism');
    for (const id of ['1-2', '2-4', '4-2', '5-4']) {
        const h = HOLE_BY_ID[id];
        const run = () => {
            const w = new World(buildCourse(h), { profile: rpg.tierProfile(h.realm), seed: 42 });
            const shots = [['driver', 0.8, 0.1], ['iron', 0.6, -0.2], ['wedge', 0.7, 0], ['putter', 0.4, 0]];
            for (const [club, power, acc] of shots) {
                if (w.s.phase !== 'aim') break;
                w.setAim(w.defaultAim());
                w.shoot({ club, power, acc, perfect: acc === 0 });
                runUntilSettled(w);
            }
            return w.hash() + '|' + w.s.time.toFixed(6);
        };
        const a = run(), b = run();
        check(a === b, `${id}: two runs agree (${a.slice(0, 50)})`);
        // a clone plays the next shot exactly like the original
        const w = new World(course(h), { profile: rpg.tierProfile(h.realm), seed: 7 });
        for (let i = 0; i < 100; i++) w.step(1 / 240);
        const c = w.clone(false);
        for (const x of [w, c]) { x.setAim(x.defaultAim() + 0.05); x.shoot({ club: 'iron', power: 0.77, acc: 0.2, perfect: false }); runUntilSettled(x); }
        check(w.hash() === c.hash(), `${id}: clone matches original after a shot`);
    }
}

// ------------------------------------------------------------------------------------------ content
if (want('content')) {
    section('content');
    const ids = new Set();
    for (const h of holes) {
        const c = course(h);
        check(!ids.has(h.id), `${h.id}: unique id`); ids.add(h.id);
        check(Number.isInteger(h.par) && h.par >= 3 && h.par <= 9, `${h.id}: par ${h.par} is sane`);
        check(c.surfAt(c.tee.x, c.tee.z) === SURF.tee, `${h.id}: tee on the tee box`);
        check(c.surfAt(c.cup.x, c.cup.z) === SURF.green, `${h.id}: cup on the green`);
        const n = c.normalAt(c.cup.x, c.cup.z);
        check(n.y > 0.997, `${h.id}: the cup sits on a near-flat green (n.y ${n.y.toFixed(4)})`);
        // the green round the cup must hold a ball (slope below the green's rolling friction)
        let worst = 1;
        for (let a = 0; a < 16; a++) for (const r of [1.5, 3]) { const m = c.normalAt(c.cup.x + Math.sin(a) * r, c.cup.z + Math.cos(a) * r); worst = Math.min(worst, m.y); }
        check(Math.sqrt(1 - worst * worst) / worst < SURF_PHYS[SURF.green].mu * 0.5, `${h.id}: green near the cup holds a ball`);
        for (const p of c.pickups) {
            const s = c.surfAt(p.x, p.z), gy = c.heightAt(p.x, p.z);
            const overHazard = s === SURF.water || s === SURF.lava || s === SURF.void;
            check(overHazard || p.y > gy + 0.2, `${h.id}: ${p.kind} at (${p.x.toFixed(0)},${p.z.toFixed(0)}) floats above the ground`);
        }
        for (const m of c.monsters) {
            const s = c.surfAt(m.x, m.z);
            check(m.kind === 'wisp' || ![SURF.water, SURF.lava, SURF.void, SURF.oob].includes(s), `${h.id}: ${m.kind} spawns on ground (surf ${s})`);
        }
        for (const [x, z] of h.route ?? []) { const s = c.surfAt(x, z); check(![SURF.water, SURF.lava, SURF.void, SURF.oob].includes(s), `${h.id}: route point (${x},${z}) is playable`); }
        check(c.tee.y > -20, `${h.id}: tee stands on real ground`);
        const t0 = performance.now(); buildCourse(h); const ms = performance.now() - t0;
        check(ms < 2500, `${h.id}: builds in ${ms.toFixed(0)} ms`);
    }
    check(HOLES.length === 20, '20 holes');
    for (let r = 0; r < 5; r++) {
        const rh = HOLES.filter((h) => h.realm === r);
        check(rh.length === 4 && rh[3].boss && !rh[0].boss, `realm ${r}: three holes and a boss hole`);
    }
}

// ------------------------------------------------------------------------------------------ physics
if (want('physics')) {
    section('physics');
    const rng = new Rng(1234);
    for (const h of holes) {
        const c = course(h);
        const base = new World(c, { profile: rpg.tierProfile(h.realm), seed: 99 });
        let bad = 0, n = 0, maxT = 0, deep = 0, inside = 0;
        const shots = 30;
        for (let i = 0; i < shots; i++) {
            const w = base.clone(true);
            // start from a random playable spot
            for (let tries = 0; tries < 40; tries++) {
                const x = c.x0 + rng.next() * (c.nx - 1) * c.cell, z = c.z0 + rng.next() * (c.nz - 1) * c.cell;
                const s = c.surfAt(x, z);
                if ([SURF.water, SURF.lava, SURF.void, SURF.oob].includes(s)) continue;
                const B = w.s.ball; B.x = x; B.z = z; B.y = c.heightAt(x, z) + BALL_R; B.surf = s; break;
            }
            w.setAim(rng.next() * Math.PI * 2);
            w.shoot({ club: CLUB_ORDER[rng.int(4)], power: 0.1 + rng.next() * 0.95, acc: rng.next() * 2 - 1, perfect: false });
            let t = 0;
            while (w.s.phase === 'flight' && t < 60) {
                w.step(1 / 240); t += 1 / 240; n++;
                const B = w.s.ball;
                if (!Number.isFinite(B.x + B.y + B.z + B.vx + B.vy + B.vz)) { bad++; break; }
                const gy = c.heightAt(B.x, B.z);
                if (B.state === 'moving' && gy > -60 && B.y < gy + BALL_R - 0.35 && c.surfAt(B.x, B.z) !== SURF.water && c.surfAt(B.x, B.z) !== SURF.lava) deep++;
            }
            maxT = Math.max(maxT, t);
            if (w.s.phase === 'flight') bad++;
            // never resting inside a solid static collider
            const B = w.s.ball;
            if (B.state === 'rest') for (const C of c.statics) {
                if (C.soft) continue;
                let d;
                if (C.kind === 'sphere') d = Math.hypot(B.x - C.x, B.y - C.y, B.z - C.z) - C.r;
                else if (C.kind === 'capsule') { const vx = C.cx - C.ax, vy = C.cy - C.ay, vz = C.cz - C.az; const l2 = vx * vx + vy * vy + vz * vz; let u = ((B.x - C.ax) * vx + (B.y - C.ay) * vy + (B.z - C.az) * vz) / l2; u = Math.max(0, Math.min(1, u)); d = Math.hypot(B.x - C.ax - vx * u, B.y - C.ay - vy * u, B.z - C.az - vz * u) - C.r; }
                else continue;
                if (d < BALL_R * 0.5) inside++;
            }
        }
        check(bad === 0, `${h.id}: ${shots} random shots all finite and settled (longest ${maxT.toFixed(1)} s)`);
        check(deep === 0, `${h.id}: the ball never sinks into the ground (${deep} steps)`);
        check(inside === 0, `${h.id}: no ball comes to rest inside a trunk or rock (${inside})`);
    }
    // a putt toward the cup at a sensible speed drops
    const h = HOLE_BY_ID['1-1'], c = course(h);
    const w = new World(c, { profile: rpg.newProfile(), seed: 3 });
    const B = w.s.ball; B.x = c.cup.x; B.z = c.cup.z - 3; B.y = c.heightAt(B.x, B.z) + BALL_R; B.surf = SURF.green;
    let holed = false;
    for (const p of [0.2, 0.25, 0.3, 0.35, 0.4]) {
        const x = w.clone(true); x.setAim(Math.atan2(c.cup.x - B.x, c.cup.z - B.z)); x.shoot({ club: 'putter', power: p, acc: 0, perfect: true }); runUntilSettled(x);
        if (x.s.phase === 'done') holed = true;
    }
    check(holed, 'a straight 3-yard putt can be holed');
    // a hazard costs a stroke and replays from the previous lie
    const w2 = new World(course(HOLE_BY_ID['2-1']), { profile: rpg.tierProfile(1), seed: 3 });
    const B2 = w2.s.ball; B2.x = 0; B2.z = 170; B2.y = w2.course.heightAt(0, 170) + BALL_R; B2.surf = SURF.fairway;
    w2.setAim(0); w2.shoot({ club: 'wedge', power: 0.55, acc: 0, perfect: true });
    runUntilSettled(w2);
    check(w2.s.strokes === 2 && Math.abs(w2.s.ball.z - 170) < 0.01 && w2.s.penalties === 1, `a chip into the oasis costs a penalty stroke and replays (strokes ${w2.s.strokes}, ball z ${w2.s.ball.z.toFixed(1)})`);
}

// ------------------------------------------------------------------------------------------ rpg
if (want('rpg')) {
    section('rpg');
    const p = rpg.newProfile('Tess', 1, 2);
    check(p.level === 1 && p.gold > 0 && p.spells.includes('mulligan'), 'new profile');
    const ups = rpg.addXp(p, rpg.xpToNext(1) + rpg.xpToNext(2));
    check(ups === 2 && p.level === 3 && p.pts === 4, `XP levels up twice (${p.level}, ${p.pts} pts)`);
    rpg.allocate(p, 'pow'); rpg.autoAllocate(p);
    check(p.pts === 0 && p.stats.pow >= 2, 'stat points spend');
    const d0 = rpg.derive(rpg.newProfile());
    check(d0.powMult > 1 && d0.maxMp === 8 && d0.perfectZone > 0.05, 'derived stats');
    p.gold = 10000;
    const stock0 = rpg.shopStock(p, 0).filter((g) => g.cat !== 'items').length;
    const stock4 = rpg.shopStock(p, 4).filter((g) => g.cat !== 'items').length;
    check(stock4 > stock0, `shop grows with progress (${stock0} → ${stock4})`);
    check(rpg.buy(p, 'clubs', 'oak') && p.equip.clubs === 'oak' && !rpg.buy(p, 'clubs', 'oak'), 'buy equips and only once');
    check(rpg.buy(p, 'items', 'rocket') && p.items.rocket === 2, 'buy an item');
    check(rpg.equip(p, 'clubs', 'willow') && p.equip.clubs === 'willow' && !rpg.equip(p, 'clubs', 'star'), 'equip only what you own');
    const before = rpg.derive(p).powMult; rpg.equip(p, 'clubs', 'oak');
    check(rpg.derive(p).powMult > before, 'better clubs hit harder');
    const q = rpg.newProfile();
    const pay = rpg.applyResult(q, HOLE_BY_ID['1-1'], { strokes: 2, par: 3, coins: 5, monsters: 1, monsterXp: 6, perfects: 1, itemsFound: { sticky: 1 }, boss: false, penalties: 0 });
    check(pay.stars === 3 && pay.first && q.holes['1-1'].best === 2 && q.items.sticky === 1 && q.gold > 30, 'a birdie pays out three stars, gold, items');
    const pay2 = rpg.applyResult(q, HOLE_BY_ID['1-1'], { strokes: 5, par: 3, coins: 0, monsters: 0, monsterXp: 0, perfects: 0, itemsFound: {}, boss: false, penalties: 0 });
    check(!pay2.first && q.holes['1-1'].best === 2 && q.holes['1-1'].stars === 3, 'a worse round keeps the best');
    check(rpg.scoreName(1, 3) === 'Hole in One!' && rpg.scoreName(2, 3) === 'Birdie!' && rpg.scoreName(5, 4) === 'Bogey', 'score names');
}

// ------------------------------------------------------------------------------------------ story
if (want('story')) {
    section('story');
    for (const [id, sc] of Object.entries(SCENES)) {
        for (const [who, mood, text] of sc.lines) {
            check(!!SPEAKERS[who], `${id}: speaker ${who} exists`);
            check(['normal', 'happy', 'surprised', 'angry', 'sad', 'smug'].includes(mood), `${id}: mood ${mood}`);
            check(text.length > 0 && text.length < 220, `${id}: line length ${text.length}`);
        }
        check(sc.cast.length > 0 && sc.cast.length <= 5, `${id}: cast of ${sc.cast.length}`);
    }
    for (let r = 0; r < 5; r++) for (const k of ['intro', 'boss']) check(!!SCENES[`${k}:${r}`], `${k}:${r} exists`);
    for (let r = 0; r < 4; r++) check(!!SCENES[`win:${r}`], `win:${r} exists`);
    check(!!SCENES.prologue && !!SCENES.ending && !!SCENES.phase2, 'prologue, phase2 and ending exist');
}

// ------------------------------------------------------------------------------------------ bosses
if (want('bosses')) {
    section('bosses');
    for (const h of holes.filter((x) => x.boss)) {
        const c = course(h);
        const w = new World(c, { profile: rpg.tierProfile(h.realm), seed: 5 });
        check(w.s.sealed && w.bossAlive(), `${h.id}: starts sealed with a live boss`);
        // a ball dropped onto the sealed cup bounces off
        const t = w.clone(true);
        const B = t.s.ball; B.x = c.cup.x; B.z = c.cup.z; B.y = c.cup.y + 4; B.vx = B.vz = 0; B.vy = -6; B.state = 'moving'; t.s.phase = 'flight';
        runUntilSettled(t);
        check(t.s.phase !== 'done', `${h.id}: the seal keeps the ball out`);
        // knock the boss out by hand (every live part, through the real hit path)
        let guard = 0;
        while (w.bossAlive() && guard++ < 40) {
            for (const C of w.bossCols) if (!C.off && C.tag === 'boss') w.onHit(C, 20, w.s.ball);
            for (let i = 0; i < 300; i++) w.step(1 / 240);
            if (w.bossAlive()) { w.bossDef.act(w); w.s.phase = 'aim'; for (let i = 0; i < 400; i++) w.step(1 / 240); }
        }
        check(!w.bossAlive() && !w.s.sealed, `${h.id}: ${BOSSES[h.boss.kind].name} can be beaten and the seal opens (${guard} rounds)`);
        // bosses act on their turn
        const a = new World(c, { profile: rpg.tierProfile(h.realm), seed: 8 });
        const before = JSON.stringify(a.s.boss);
        a.setAim(a.defaultAim()); a.shoot({ club: 'putter', power: 0.2, acc: 0, perfect: true });
        runUntilSettled(a);
        check(JSON.stringify(a.s.boss) !== before, `${h.id}: the boss takes a turn`);
    }
}

// ------------------------------------------------------------------------------------------ bot
if (want('bot')) {
    section('bot (this takes a few minutes)');
    let tot = 0, totPar = 0;
    for (const h of holes) {
        const c = course(h);
        const t0 = performance.now();
        const strong = playHole(new World(c, { profile: rpg.tierProfile(h.realm), seed: 1 }), {});
        check(strong.phase === 'done' && strong.strokes <= h.par, `${h.id} ${h.name}: perfect-strike bot ${strong.strokes} (par ${h.par})`);
        const res = [];
        for (let sd = 0; sd < SEEDS; sd++) {
            const r = playHole(new World(c, { profile: rpg.tierProfile(h.realm), seed: 100 + sd }), { noise: 1, rng: new Rng(500 + sd * 31) });
            res.push(r);
            check(r.phase === 'done', `${h.id}: noisy bot seed ${sd} finishes (${r.strokes}, limit ${h.par + (h.boss ? 6 : 4)})`);
        }
        const avg = res.reduce((a, r) => a + r.strokes, 0) / res.length;
        tot += avg; totPar += h.par;
        console.log(`   ${h.id} ${h.name.padEnd(18)} par ${h.par}  perfect ${strong.strokes}  noisy ${res.map((r) => r.strokes).join(',')}  ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    }
    console.log(`   noisy total ${tot.toFixed(1)} vs par ${totPar}`);
}

console.log(`\n${fails ? '✗' : '✓'} ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
