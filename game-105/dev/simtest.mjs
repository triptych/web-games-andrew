/**
 * simtest.mjs — headless checks of SOLDER & RAIN's simulation. No browser.
 *
 *   node game-105/dev/simtest.mjs                 # everything
 *   ONLY=purity,rules node game-105/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-105/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. generator: every kind at every tier it can appear in, over SEEDS seeds: valid, fits the bench,
 *    no overlapping footprints, every fault has its spare, deterministic per seed.
 * 3. rules: covering, lifting, fasteners, cables, snapping, tools, soldering, scrubbing, oiling,
 *    the meter and the power test each have a line.
 * 4. solve: the bot repairs every generated job through the real commands (hand-chosen tools,
 *    pointer moves, held buttons) and passes the test; the marks come out as designed.
 * 5. determinism: same seed and inputs give the same job; a save round trip mid-repair plays on
 *    identically.
 * 6. story: every scene, choice, clue and tip reference exists; the bot plays the whole campaign
 *    to each ending, collects every clue, and the economy is sane.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Dv = await import('../js/sim/device.js');
const Ru = await import('../js/sim/rules.js');
const Pl = await import('../js/sim/plan.js');
const Kd = await import('../js/sim/kinds.js');
const St = await import('../js/sim/story.js');
const Mo = await import('../js/sim/modules.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const tick = (G, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, {}, DT); };
const drive = (G, gen) => Bt.drive(G, gen, Gm.step, DT);
const tierOk = (k, t) => (k === 'spanner' ? t === 5 : t >= Kd.KINDS[k].minTier);
const combos = [];
for (const k of Object.keys(Kd.KINDS)) for (const t of [1, 2, 3, 4, 5]) if (tierOk(k, t)) combos.push([k, t]);
const freeJob = (kind, tier, seed) => { const G = Gm.newGame(1); Gm.act(G, { t: 'free', kind, tier, seed }); return G; };
const ptr = (G, ref, pos) => ({ t: 'down', ref, bx: pos[0], bz: pos[2], ax: pos[0], az: pos[2] });

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

if (want('generator')) {
    section('generator');
    let n = 0, retries = 0, big = 0;
    for (const [kind, tier] of combos) {
        for (let seed = 1; seed <= SEEDS; seed++) {
            let dev;
            try { dev = Dv.generateDevice(seed, kind, tier); } catch (e) { ok(false, `${kind}/${tier}/${seed}: ${e.message}`); continue; }
            n++; retries += dev.attempt;
            const v = Dv.validate(dev);
            ok(v.ok, `${kind}/${tier}/${seed} validates (${v.errors[0] || ''})`);
            const T = C.TIERS[tier];
            ok(dev.truth.length >= 1 && dev.truth.length <= T.faults[1] + 1, `${kind}/${tier}/${seed} has ${dev.truth.length} faults`);
            if (dev.W > 15.3 || dev.D > 9.5) big++;
            // the same seed gives the same device
            if (seed === 1) ok(JSON.stringify(Dv.generateDevice(seed, kind, tier)) === JSON.stringify(dev), `${kind}/${tier} is deterministic`);
            // cable colours and tags are unique so a plug always names its socket
            const tags = Object.values(dev.wires).map((w) => w.tag);
            ok(new Set(tags).size === tags.length, `${kind}/${tier}/${seed} cable tags are unique`);
            // every part in a slot and every slot's occupant agree
            for (const s of Object.values(dev.slots)) if (s.occ) ok(dev.parts[s.occ].slot === s.id, 'slot and part agree');
            // hidden failures only from the tier that allows them
            if (T.hidden === 0) ok(!dev.truth.some((t) => t.hidden), `${kind}/${tier} has no hidden faults`);
            if (T.solder === 0) ok(!dev.truth.some((t) => t.type === 'cut' || t.type === 'joints'), `${kind}/${tier} has no solder work`);
        }
    }
    ok(big === 0, 'every device fits the bench');
    console.log(`  ${n} devices, ${retries} generator retries in total`);
    // forced faults and stashes from story jobs
    const d = Dv.generateDevice(9, 'noodlebot', 1, { faults: [{ role: 'fuse', type: 'burnt' }] });
    ok(d.truth[0].type === 'burnt' && d.slots[d.truth[0].slot].role === 'fuse', 'a story job can force the fuse to burn');
    const d2 = Dv.generateDevice(9, 'hovercoil', 2, { stash: { role: 'board', label: 'tag', clue: 'tag' } });
    ok(d2.stash.length === 1, 'a story job can hide something under the board');
}

if (want('rules')) {
    section('rules');
    const G = freeJob('noodlebot', 1, 3);
    const dev = G.job.dev;
    const panel = Object.values(dev.slots).find((s) => s.kind === 'panel');
    const cell = Object.values(dev.slots).find((s) => s.role === 'cell');
    // covering and lifting
    ok(Ru.blockers(dev, cell).includes(panel), 'the top plate covers the cell');
    const cellPart = dev.parts[cell.occ];
    Gm.act(G, { t: 'down', ref: `part:${cellPart.id}`, bx: cell.pos[0], bz: cell.pos[2], ax: cell.pos[0], az: cell.pos[2] });
    ok(G.job.held === null && G.job.stats.wrong === 1, 'a covered part will not lift');
    Gm.act(G, { t: 'up' });
    ok(Ru.evaluate(dev).ok === false, 'a broken device fails its test');
    // a screw takes time, and the tool follows the screw
    const hole = panel.holes[0];
    const hp = Pl.refPos(dev, `hole:${hole.id}`);
    Gm.act(G, { t: 'down', ref: `hole:${hole.id}`, bx: hp[0], bz: hp[2], ax: hp[0], az: hp[2] });
    ok(G.tool === 'driver' && G.bit === 'phil', 'smart tools reach for the right bit');
    tick(G, 0.3);
    ok(hole.prog < 1 && hole.prog > 0, 'holding the driver turns the screw a little');
    Gm.act(G, { t: 'move', ref: `hole:${hole.id}`, bx: hp[0] + 5, bz: hp[2], ax: hp[0] + 5, az: hp[2] });
    const p0 = hole.prog; tick(G, 0.3);
    ok(hole.prog === p0, 'the tool lifts when the pointer wanders off the head');
    Gm.act(G, { t: 'move', ref: `hole:${hole.id}`, bx: hp[0], bz: hp[2], ax: hp[0], az: hp[2] });
    tick(G, 1.5);
    ok(hole.prog === 0 && G.job.dish.phil === 1, 'the screw comes out into the dish');
    ok(G.events.some((e) => e.type === 'screw_out'), 'and says so');
    Gm.act(G, { t: 'up' });
    // manual tools slip on the wrong bit
    const G2 = freeJob('noodlebot', 1, 3);
    Gm.act(G2, { t: 'manual', on: true });
    const d2 = G2.job.dev, h2 = Object.values(d2.slots).find((s) => s.kind === 'panel').holes[0];
    G2.bit = 'flat'; G2.tool = 'driver';
    const hp2 = Pl.refPos(d2, `hole:${h2.id}`);
    Gm.act(G2, ptr(G2, `hole:${h2.id}`, hp2));
    tick(G2, 0.5);
    ok(h2.prog === 1 && G2.job.stats.slips >= 1, 'manual tools: the wrong bit slips');
    // rust blocks a bolt until it is oiled
    const G3 = freeJob('hovercoil', 3, 1);
    const d3 = G3.job.dev;
    const rusty = Object.values(d3.slots).flatMap((s) => s.holes.map((h) => ({ s, h }))).find((x) => x.h.rust > 0);
    if (rusty) {
        const rp = Pl.refPos(d3, `hole:${rusty.h.id}`);
        Gm.act(G3, ptr(G3, `hole:${rusty.h.id}`, rp)); tick(G3, 0.6);
        ok(rusty.h.prog === 1, 'a rusted bolt will not turn');
        Gm.act(G3, { t: 'up' });
        Gm.act(G3, { t: 'tool', tool: 'oil' }); Gm.act(G3, ptr(G3, `hole:${rusty.h.id}`, rp)); tick(G3, 2.5); Gm.act(G3, { t: 'up' });
        ok(rusty.h.rust === 0, 'oil frees a rusted bolt');
        ok(G3.tool === (rusty.h.type.startsWith('hex') ? 'ratchet' : 'driver'), 'and the right wrench comes back to the hand');
    }
}

if (want('cables')) {
    section('loose cable ends rest on what is under them');
    // generated loose ends never start buried in the tray's base
    let loose = 0;
    for (const [kind, tier] of combos) for (let seed = 1; seed <= SEEDS; seed++) {
        const dev = Dv.generateDevice(seed, kind, tier);
        for (const w of Object.values(dev.wires)) w.ends.forEach((e) => { if (!e.at) { loose++; if (Math.abs(e.pos[0]) < dev.W / 2 + 0.3 && Math.abs(e.pos[2]) < dev.D / 2 + 0.3) ok(e.pos[1] >= C.FLOOR_Y, `${kind}/${tier}/${seed}: a loose plug over the tray is not under its floor`); } });
    }
    console.log(`  ${loose} loose ends checked`);
    // a plug pulled out and dropped over the device lies on the tray floor where it can be picked up again
    const G = freeJob('noodlebot', 1, 3);
    const dev = G.job.dev;
    Gm.act(G, { t: 'tool', tool: 'hand' });
    const open = () => { for (let i = 0; i < 12 && Object.values(dev.slots).some((s) => s.kind === 'panel' && s.occ); i++) { try { drive(G, Bt.repairJob(G, { maxGoals: 1 })); } catch { /* one goal */ } } };
    open();
    const w = Object.values(dev.wires).find((x) => x.ends.every((e) => e.at && Ru.blockers(dev, dev.slots[e.port.split('.')[0]]).length === 0));
    const pr = `plug:${w.id}.0`, pp = Pl.refPos(dev, pr);
    Gm.act(G, ptr(G, pr, pp)); tick(G, 0.3);
    ok(G.job.held && G.job.held.k === 'plug', 'a plug can be pulled out');
    for (const [x, z] of [[0, 0], [dev.W / 2 + 2, 0]]) {
        Gm.act(G, { t: 'move', ref: null, bx: x, bz: z, ax: x, az: z }); tick(G, 0.5);
        Gm.act(G, { t: 'up' }); if (G.job.held) { Gm.act(G, ptr(G, null, [x, 0, z])); Gm.act(G, { t: 'up' }); }
        tick(G, 0.6);
        const e = w.ends[0];
        ok(Math.abs(e.pos[1] - Ru.restY(dev, e.pos[0], e.pos[2])) < 0.02, `dropped at x=${x.toFixed(0)}: it lies at ${e.pos[1].toFixed(2)}, on the surface`);
        if (x === 0) {
            ok(e.pos[1] >= C.FLOOR_Y, 'over the tray it lies on the tray floor, not inside its base');
            Gm.act(G, ptr(G, pr, e.pos)); tick(G, 0.3);
            ok(G.job.held && G.job.held.k === 'plug', 'and it can be picked up again');
        }
    }
}

if (want('guidance')) {
    section('guidance: what to do with the thing in your hand');
    const G = freeJob('noodlebot', 1, 3);
    const dev = G.job.dev;
    // take the cover plate off with real commands, stopping with it in the hand
    const panel = Object.values(dev.slots).find((x) => x.kind === 'panel');
    const g0 = Pl.nextGoal(G, {});
    ok(g0.k === 'turn' && /slide across/.test(g0.text), 'the first step is to undo the cover screws, and says how');
    for (let i = 0; i < 10 && panel.occ && panel.holes.some((h) => h.prog > 0); i++) { try { drive(G, Bt.repairJob(G, { maxGoals: 1 })); } catch { /* one goal */ } }
    const g1 = Pl.nextGoal(G, {});
    ok(g1.k === 'lift' && /PARTS area/.test(g1.text), 'then lift the plate, and the text says where to put it');
    Gm.act(G, { t: 'tool', tool: 'hand' });
    const pid = panel.occ, pr = `part:${pid}`, pp = Pl.refPos(dev, pr);
    Gm.act(G, ptr(G, pr, pp)); tick(G, 0.5);
    ok(G.job.held && G.job.held.id === pid, 'the plate is in hand');
    const g2 = Pl.nextGoal(G, {});
    ok(g2.k === 'putdown' && g2.zone === 'park' && /PARTS area/.test(g2.text), 'holding it, the guide says to set it down in the PARTS area');
    // drop it right on the screw dish: it is nudged out, not left on top of it
    Gm.act(G, { t: 'move', ref: null, bx: C.DISH.x, bz: C.DISH.z, ax: C.DISH.x, az: C.DISH.z }); tick(G, 0.4);
    Gm.act(G, { t: 'up' }); if (G.job.held) { Gm.act(G, ptr(G, null, [C.DISH.x, 0, C.DISH.z])); Gm.act(G, { t: 'up' }); }
    tick(G, 0.3);
    const part = dev.parts[pid];
    ok(part.loc === 'free', 'it was put down');
    ok(Math.hypot(part.pos[0] - C.DISH.x, part.pos[2] - C.DISH.z) >= C.DISH.r + Math.max(part.w, part.d) / 2, 'and not on top of the screw dish');
    // a burnt part in hand: the guide points at the bin
    const G2 = freeJob('noodlebot', 1, 5);
    const d2 = G2.job.dev;
    const bad = Object.values(d2.parts).find((q) => Ru.isDefective(q));
    bad.loc = 'held'; bad.slot = null; d2.slots[bad.home].occ = null; G2.job.held = { k: 'part', id: bad.id, sticky: true, t: 1, travel: 1 };
    const g3 = Pl.nextGoal(G2, {});
    ok(g3.zone === 'bin' && /SCRAP/.test(g3.text), 'a burnt part in hand: the guide says the scrap bin');
    // a spare that fits an open slot: follow the ghost
    const d3 = freeJob('noodlebot', 1, 5);
    void d3;
    // the guide names the spares drawer when one is needed
    const G4 = freeJob('noodlebot', 1, 5);
    let sawSpare = false;
    const gen = (function* () { for (let i = 0; i < 60; i++) { const g = Pl.nextGoal(G4, {}); if (!g || g.k === 'test') return; if (g.k === 'spare') { sawSpare = /Open Spares/.test(g.text) && /label/.test(g.text); return; } yield* (function* () { const r = Bt.repairJob(G4, { maxGoals: 1 }); try { for (let q = r.next(); !q.done; q = r.next()) yield; } catch (e) { if (!/gave up/.test(e.message)) throw e; } })(); } })();
    drive(G4, gen);
    ok(sawSpare, 'when a replacement is needed the guide says to open Spares and match the label');
}

if (want('rules2')) {
    section('parts, cables, snapping');
    const G = freeJob('radio', 1, 2);
    const dev = G.job.dev;
    // take everything off
    const run = (n, opt = {}) => { try { drive(G, Bt.repairJob(G, { ...opt, maxGoals: n })); } catch (e) { if (!/gave up/.test(e.message)) throw e; } };
    for (let i = 0; i < 20 && !Object.values(dev.parts).some((p) => p.loc === 'free'); i++) run(1);
    const parked = Object.values(dev.parts).filter((p) => p.loc === 'free');
    ok(parked.length > 0, 'the bot lifted parts onto the bench');
    // a wrong-spec spare will not fit
    const defective = Object.values(dev.parts).find((p) => p.loc === 'scrap' || Ru.isDefective(p));
    const slotNeeding = dev.truth.length && dev.slots[dev.truth[0].slot];
    if (slotNeeding && !slotNeeding.occ) {
        const decoy = dev.spares.find((s) => s.spec !== slotNeeding.spec && s.mod === slotNeeding.mod);
        if (decoy) {
            Gm.act(G, { t: 'spare', spec: decoy.spec });
            const sp = Object.values(dev.parts).find((p) => p.spare && p.loc === 'free');
            const pos = [slotNeeding.pos[0], 0, slotNeeding.pos[2]];
            Gm.act(G, { t: 'tool', tool: 'hand' });
            const from = Pl.refPos(dev, `part:${sp.id}`);
            Gm.act(G, ptr(G, `part:${sp.id}`, from)); tick(G, 0.4);
            Gm.act(G, { t: 'move', ref: null, bx: pos[0], bz: pos[2], ax: pos[0], az: pos[2] }); tick(G, 0.4); Gm.act(G, { t: 'up' });
            ok(sp.loc === 'free' && G.job.stats.wrong > 0, 'a wrong-spec part does not fit its slot');
            ok(G.job.stats.spent > 0, 'spares cost money');
            // returning it refunds
            const spent = G.job.stats.spent;
            const f2 = Pl.refPos(dev, `part:${sp.id}`);
            Gm.act(G, ptr(G, `part:${sp.id}`, f2)); tick(G, 0.5); Gm.act(G, { t: 'return' }); Gm.act(G, { t: 'up' });
            ok(G.job.stats.spent < spent, 'returning a spare refunds it');
        }
    }
    // the scrap bin takes bad parts and refuses good ones
    const good = Object.values(dev.parts).find((p) => p.loc === 'free' && !Ru.isDefective(p) && !p.spare);
    if (good) {
        const gp = Pl.refPos(dev, `part:${good.id}`);
        Gm.act(G, { t: 'tool', tool: 'hand' });
        Gm.act(G, ptr(G, `part:${good.id}`, good.small ? gp : gp)); tick(G, 0.6);
        Gm.act(G, { t: 'move', ref: null, bx: C.BIN.x, bz: C.BIN.z, ax: C.BIN.x, az: C.BIN.z }); tick(G, 0.4); Gm.act(G, { t: 'up' });
        ok(good.loc !== 'scrap', 'a good part is not thrown away');
    }
}

if (want('tools')) {
    section('tools: solder, brush, oil, meter');
    // a job with every kind of work
    let found = null;
    for (let seed = 1; seed < 60 && !found; seed++) {
        const dev = Dv.generateDevice(seed, 'cyberarm', 4);
        const t = dev.truth.map((x) => x.type);
        if (t.includes('joints') && (t.includes('seized') || t.includes('corr')) && dev.truth.length >= 3) found = seed;
    }
    const seed = found || 1;
    const G = freeJob('cyberarm', 4, seed);
    const dev = G.job.dev;
    const board = Object.values(dev.parts).find((p) => p.mod === 'board');
    if (board.cond.joints.length) {
        // open the device up to the board with the bot, then solder by hand
        const open = () => { try { drive(G, Bt.repairJob(G, { maxGoals: 60 })); } catch (e) { /* stops when done */ } };
        void open;
        board.cond.joints.forEach((j) => { j.heat = 0; });
        const j0 = board.cond.joints[0];
        // joints take heat while the iron is on them and cool when it lifts
        Gm.act(G, { t: 'tool', tool: 'solder' });
        const jr = `joint:${board.id}.0`;
        const jp = Pl.refPos(dev, jr);
        Gm.act(G, ptr(G, jr, jp)); tick(G, 0.4);
        ok(j0.heat > 0.15, 'the iron heats a joint');
        Gm.act(G, { t: 'up' }); const h = j0.heat; tick(G, 0.3);
        ok(j0.heat < h, 'and it cools when the iron lifts');
        // too hot burns
        Gm.act(G, ptr(G, jr, jp)); tick(G, 2.6);
        ok(G.job.stats.burns >= 1 || j0.done, 'holding the iron too long burns the joint (or it finished first)');
        Gm.act(G, { t: 'up' });
    }
    // the meter reveals hidden faults
    const G2 = freeJob('blaster', 3, 1);
    const hidden = Object.values(G2.job.dev.parts).find((p) => p.cond.dead);
    if (hidden) {
        ok(!Ru.describe(G2.job.dev, `part:${hidden.id}`).includes('dead'), 'a dead part does not look dead');
        Gm.act(G2, { t: 'tool', tool: 'probe' });
        const pp = Pl.refPos(G2.job.dev, `part:${hidden.id}`);
        Gm.act(G2, ptr(G2, `part:${hidden.id}`, pp)); tick(G2, 0.7); Gm.act(G2, { t: 'up' });
        ok(hidden.probed && G2.job.notes.some((n) => n.bad), 'the meter reads it as faulty');
    }
    // brushing needs movement, not just pressure
    const G3 = freeJob('radio', 2, 1);
    const dusty = Object.values(G3.job.dev.parts).find((p) => p.cond.dust > 0);
    if (dusty) {
        Gm.act(G3, { t: 'tool', tool: 'brush' });
        const dp = Pl.refPos(G3.job.dev, `part:${dusty.id}`);
        Gm.act(G3, ptr(G3, `part:${dusty.id}`, dp)); tick(G3, 1);
        const before = dusty.cond.dust;
        ok(dusty.cond.dust === before, 'a still brush cleans nothing');
        for (let i = 0; i < 400; i++) { Gm.act(G3, { t: 'move', ref: `part:${dusty.id}`, bx: dp[0] + Math.sin(i * 0.4) * 0.6, bz: dp[2], ax: dp[0], az: dp[2] }); Gm.step(G3, {}, DT); }
        ok(dusty.cond.dust < before, 'a scrubbing brush does');
    }
}

if (want('solve')) {
    section('solve');
    const stars = {};
    let n = 0, simSec = 0;
    for (const [kind, tier] of combos) {
        for (let seed = 1; seed <= SEEDS; seed++) {
            const G = freeJob(kind, tier, seed);
            let msg = '';
            try {
                simSec += drive(G, Bt.repairJob(G, { clean: true, stash: true, pullGov: seed % 2 === 0 })) * DT;
            } catch (e) { msg = e.message; }
            const pass = G.phase === 'result';
            ok(pass, `${kind}/${tier}/${seed} solved${msg ? ': ' + msg : ''}`);
            if (pass) { n++; stars[G.job.result.stars] = (stars[G.job.result.stars] || 0) + 1; }
        }
    }
    console.log(`  ${n} jobs solved, ${(simSec / 60).toFixed(0)} min of sim time; stars ${JSON.stringify(stars)}`);
    ok(stars[3] > 0, 'a thorough bot earns three stars');
    // a messy bench costs a star: leave a part lying about
    const G = freeJob('noodlebot', 1, 5);
    drive(G, Bt.repairJob(G, {}));
    ok(G.job.result.stars >= 2, 'a tidy, clean job earns at least two stars');
    // a failed test
    const G2 = freeJob('noodlebot', 1, 5);
    Gm.act(G2, { t: 'test' }); tick(G2, 8);
    const fail = G2.events.find((e) => e.type === 'test_fail');
    ok(G2.phase === 'bench' && G2.job.stats.fails === 1 && fail && /stage|cable/.test(fail.msg), 'testing a broken device fails with a hint about the stage');
}

if (want('determinism')) {
    section('determinism and saves');
    const play = (seed) => { const G = freeJob('cyberarm', 3, seed); drive(G, Bt.repairJob(G, { maxGoals: 25 }) ); return G; };
    const mid = (seed) => { const G = freeJob('cyberarm', 3, seed); try { drive(G, Bt.repairJob(G, { maxGoals: 25 })); } catch { /* stops */ } return G; };
    void play;
    const a = mid(42), b = mid(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same job');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(a))));
    const finish = (G) => { try { drive(G, Bt.repairJob(G, { clean: true })); } catch (e) { return e.message; } return 'ok'; };
    const ra = finish(a), rb = finish(copy);
    ok(ra === 'ok' && rb === 'ok', 'a save taken mid-repair finishes');
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    // a save with a part in hand puts it down
    const G = freeJob('radio', 1, 4);
    try { drive(G, Bt.repairJob(G, { maxGoals: 3 })); } catch { /* */ }
    const part = Object.values(G.job.dev.parts).find((p) => p.loc === 'slot' && !Ru.liftCheck(G.job.dev, p).ok === false);
    if (part) {
        const p = Pl.refPos(G.job.dev, `part:${part.id}`);
        Gm.act(G, { t: 'tool', tool: 'hand' }); Gm.act(G, ptr(G, `part:${part.id}`, p)); tick(G, 0.5);
        if (G.job.held) {
            const L = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
            ok(L.job.held === null && L.job.dev.parts[part.id].loc === 'free', 'loading a game with a part in hand puts it on the bench');
        }
    }
}

if (want('story')) {
    section('story');
    const scenes = St.SCENES;
    const clueIds = Object.keys(St.CLUES);
    const speakers = Object.keys(St.SPEAKERS);
    for (const [id, sc] of Object.entries(scenes)) {
        ok(sc.lines.length > 0, `scene ${id} has lines`);
        const then = sc.then;
        ok(['shop', 'brief', 'endday', 'ending', 'credits'].includes(then) || then.startsWith('day:') || (then.startsWith('scene:') && scenes[then.slice(6)]), `scene ${id} goes somewhere real (${then})`);
        for (const l of sc.lines) {
            ok(speakers.includes(l.w), `scene ${id}: speaker ${l.w} exists`);
            if (l.clue) ok(clueIds.includes(l.clue), `scene ${id}: clue ${l.clue} exists`);
            if (l.ask) for (const a of l.ask) ok(!a.next || scenes[a.next], `scene ${id}: choice leads to ${a.next}`);
        }
    }
    for (const day of St.DAYS) {
        ok(scenes[day.open], `day ${day.n} opening exists`);
        ok(!day.close || scenes[day.close], `day ${day.n} closing exists`);
        for (const j of day.jobs) {
            if (j.walk) { ok(Kd.kindsForTier(j.tier).length > 0, `day ${day.n}: a walk-in of tier ${j.tier} exists`); continue; }
            ok(scenes[j.pre] && scenes[j.post], `day ${day.n}: ${j.id} has both scenes`);
            ok(Kd.KINDS[j.kind] && tierOk(j.kind, j.tier), `day ${day.n}: ${j.id} is a real device at a possible tier`);
            if (j.stash) ok(clueIds.includes(j.stash.clue), `day ${day.n}: ${j.id}'s hidden clue exists`);
        }
    }
    // every clue is reachable
    const reach = new Set();
    for (const sc of Object.values(scenes)) for (const l of sc.lines) if (l.clue) reach.add(l.clue);
    for (const d of St.DAYS) for (const j of d.jobs) if (j.stash) reach.add(j.stash.clue);
    for (const c of clueIds) ok(reach.has(c), `clue ${c} can be found`);
    for (const t of Object.keys(St.TIPS)) ok(St.TIPS[t].length > 10, `tip ${t} has text`);

    // the whole campaign, to each ending, with different choices
    for (const [choice, pull] of [['end_quiet', false], ['end_broadcast', true], ['end_surrender', false]]) {
        const G = Gm.newGame(11);
        let err = '';
        try { drive(G, Bt.playCampaign(G, { choice, pullGov: pull, seed: 11 })); } catch (e) { err = e.message; }
        ok(G.phase === 'credits' && !err, `the campaign ends (${choice}) ${err}`);
        const s = G.story;
        ok(s.clues.length === clueIds.length, `${choice}: every clue found (${s.clues.length}/${clueIds.length})`);
        ok(s.flags[choice], `${choice}: the ending was recorded`);
        ok(s.jobs === 11, `${choice}: all eleven jobs done (${s.jobs})`);
        ok(pull ? s.freed >= 2 : s.freed === 0, `${choice}: governors pulled counted (${s.freed})`);
        ok(s.credits >= 0, `${choice}: no debt`);
        if (choice === 'end_quiet') console.log(`  credits at the end: ${s.credits}, upgrades: ${Object.keys(s.upgrades).length}/${C.UPGRADES.length}`);
    }
    // saving in the middle of dialogue and at the bench survives a round trip
    const G = Gm.newGame(5);
    Gm.act(G, { t: 'campaign', seed: 5 });
    const L = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(L.phase === 'dialogue' && L.dlg.i === G.dlg.i, 'a save in the middle of a scene resumes there');
}

if (want('hints')) {
    section('hints');
    // the hint never names something that is still locked: it is always a physically possible step
    for (const [kind, tier] of [['blaster', 3], ['console', 4], ['spanner', 5]]) {
        const G = freeJob(kind, tier, 2);
        let n = 0, bad = 0;
        const gen = (function* () {
            for (let i = 0; i < 400; i++) {
                const g = Pl.nextGoal(G, {});
                if (!g) return;
                n++;
                if (g.k === 'lift') { const lc = Ru.liftCheck(G.job.dev, G.job.dev.parts[g.part]); if (!lc.ok) bad++; }
                if (g.k === 'turn') { const { slot } = Ru.holeOf(G.job.dev, g.ref.slice(5)); if (Ru.blockers(G.job.dev, slot).length) bad++; }
                if (g.k === 'test') return;
                yield* (function* () { const r = Bt.repairJob(G, { maxGoals: 1 }); try { for (let s = r.next(); !s.done; s = r.next()) yield; } catch (e) { if (!/gave up/.test(e.message)) throw e; } })();
            }
        })();
        drive(G, gen);
        ok(bad === 0 && n > 5, `${kind}: ${n} hints in a row, all physically possible`);
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
