/**
 * simtest.mjs — headless checks of SHARDFRAME's simulation. No browser.
 *
 *   node game-137/dev/simtest.mjs                    # everything
 *   ONLY=purity,rules node game-137/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-137/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. data: every part, mission, crew member and upgrade is well formed and refers to real things.
 * 3. rules: the mech, voxels (fly, settle, block, fade, collect, magnet), terrain, weapons,
 *    monsters chewing piles, hives, cages, level-ups, overdrive, shield, evac, bosses, losing.
 * 4. hangar: buying, upgrading, fitting, the crew's real-time gifts and boosts.
 * 5. maps: every mission's map over 60 seeds has every cage and hive reachable from the landing zone.
 * 6. determinism: same seed and inputs → same game; a mid-sortie save round trip plays on identically.
 * 7. bot: the bot plays the whole campaign on SEEDS seeds at skill 1 and 0.4 with per-step
 *    invariants, prints the balance table and asserts its bands.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 4);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Wd = await import('../js/sim/world.js');
const Vx = await import('../js/sim/voxels.js');
const Dm = await import('../js/sim/damage.js');
const Cb = await import('../js/sim/combat.js');
const En = await import('../js/sim/enemies.js');
const Rn = await import('../js/sim/run.js');
const Hg = await import('../js/sim/hangar.js');
const { PARTS, SLOTS, SLOT_KIND, STARTER } = await import('../js/sim/data/parts.js');
const { MISSIONS, SECTORS } = await import('../js/sim/data/missions.js');
const { CREW, GIFTS, BOOSTS, CAST } = await import('../js/sim/data/crew.js');
const { UPGRADES } = await import('../js/sim/data/upgrades.js');
const { ENEMIES, BOSSES, MATS } = await import('../js/sim/data/enemies.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, mag: false, od: false, pick: null };
const run = (G, inp, secs) => { for (let t = 0; t < secs && G.mode === 'mission'; t += DT) { Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); } };

/** A sortie with nothing in it: open ground, no spawns, the mech in the middle. */
function blank(id = 1, seed = 5) {
    const G = Gm.newGame(seed);
    G.unlocked = 12;
    Gm.act(G, { t: 'launch', mission: id });
    const R = G.run;
    for (let i = 0; i < R.W.h.length; i++) if (R.W.mat[i] !== Wd.MAT_ID.edge) { R.W.h[i] = 0; R.W.mat[i] = 0; R.W.hp[i] = 0; }
    R.enemies.length = 0; R.voxels.length = 0; R.shots.length = 0; R.W.debris.fill(0);
    R.hives.forEach((h) => { h.dead = true; }); R.hives.length = 0;
    R.spawnCd = 1e9; R.mech.x = 24.5; R.mech.y = 24.5; R.mech.inv = 0;
    R.objectives = [{ kind: 'survive', time: 1e9, done: false }];
    R.cages.length = 0;
    G.events.length = 0;
    return G;
}
const setCell = (R, x, y, h, mat = 'stone') => { const i = Wd.idx(x, y); R.W.h[i] = h; R.W.mat[i] = Wd.MAT_ID[mat]; R.W.hp[i] = MATS[mat]?.hp || 0; R.W.ffDirty = true; return i; };
const settleAll = (G, secs = 3) => { const R = G.run; for (let t = 0; t < secs; t += DT) Vx.stepVoxels(R, DT, { ...R.mech, x: -99, y: -99 }, false, () => {}); };

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main|media)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('data')) {
    section('data');
    for (const [id, P] of Object.entries(PARTS)) {
        ok(['arm', 'shoulder', 'core', 'legs'].includes(P.kind) && P.cost.length === 3 && P.name && P.desc && P.icon, `part ${id} is well formed`);
        if (P.weapon) ok(['bullet', 'beam', 'rocket', 'mortar', 'orbit', 'stomp'].includes(P.weapon.type) && P.weapon.rate > 0 && P.weapon.dmg > 0, `part ${id} has a working weapon`);
    }
    for (const [slot, id] of Object.entries(STARTER.loadout)) ok(id == null || (PARTS[id].kind === SLOT_KIND[slot] && STARTER.parts[id]), `starter ${slot} holds an owned ${SLOT_KIND[slot]}`);
    ok(MISSIONS.length === 12 && MISSIONS.every((m, i) => m.id === i + 1), 'twelve missions in order');
    const rescued = MISSIONS.flatMap((m) => m.objectives.filter((o) => o.kind === 'rescue').flatMap((o) => o.crew));
    ok(rescued.length === CREW.length && new Set(rescued).size === CREW.length, 'every crew member is rescued in exactly one mission');
    for (const m of MISSIONS) {
        ok(SECTORS[m.sector] && m.brief && m.objectives.length, `mission ${m.id} has a sector, a brief and objectives`);
        if (m.boss) ok(BOSSES[m.boss] && m.objectives.some((o) => o.kind === 'boss'), `mission ${m.id}'s boss exists`);
    }
    for (const c of CREW) ok(GIFTS[c.gift] && c.every > 0 && c.art && c.line && (c.gift !== 'gold' || c.amount > 0), `crew ${c.id} is well formed`);
    for (const [k, u] of Object.entries(UPGRADES)) ok(u.max > 0 && u.name && u.desc, `upgrade ${k} is well formed`);
    ok(Object.keys(CAST).length === 2, 'the pilot and the commander');
}

// ======================================================================
if (want('rules')) {
    section('rules: mech and terrain');
    let G = Gm.newGame(1);
    ok(G.mode === 'hangar' && G.unlocked === 1 && G.hangar.gold === 0, 'a new game starts in the hangar with mission 1 open');
    ok(!Gm.act(G, { t: 'launch', mission: 2 }), 'a locked mission will not launch');
    ok(Gm.act(G, { t: 'launch', mission: 1 }) && G.mode === 'mission', 'mission 1 launches');
    ok(G.run.mech.maxHp === C.MECH.baseHp + PARTS.plating.stats.hp, 'the starter mech has base HP plus plating');
    ok(G.run.cages.length === 2 && G.run.enemies.length === 2 * C.RESCUE.guards, 'mission 1 has two guarded cages');

    G = blank();
    let R = G.run;
    const x0 = R.mech.x;
    run(G, { ...NONE, x: 1 }, 0.5);
    ok(Math.abs(R.mech.x - (x0 + R.mech.speed * 0.5)) < 0.1, 'the mech walks at its legs\' speed');
    G = blank(); R = G.run;
    run(G, { ...NONE, x: 1, mag: true }, 0.5);
    ok(Math.abs(R.mech.x - (24.5 + R.mech.speed * C.MECH.magnetSlow * 0.5)) < 0.1, 'holding the magnet slows it');
    G = blank(); R = G.run;
    setCell(R, 26, 24, 2);
    run(G, { ...NONE, x: 1 }, 1);
    ok(R.mech.x <= 26 - C.MECH.radius + 1e-6, 'rock stops the mech');
    const i = setCell(R, 30, 30, 2, 'crystal');
    Dm.hurtCell(R, i, MATS.crystal.hp);
    ok(R.W.h[i] === 1 && R.voxels.length === MATS.crystal.voxels && G.events.some((e) => e.type === 'break'), 'breaking a layer lowers the column and throws rubble');
    Dm.hurtCell(R, i, 999);
    ok(R.W.h[i] === 0 && R.W.mat[i] === 0, 'enough damage levels it');
    const edge = Wd.idx(0, 10);
    Dm.hurtCell(R, edge, 1e6);
    ok(R.W.h[edge] === 3, 'the map edge cannot be broken');

    section('rules: voxels');
    G = blank(); R = G.run;
    Vx.burst(R, 10.5, 10.5, 0.5, 6, Vx.C.red);
    settleAll(G);
    const set = R.voxels.filter((v) => v.s === 1);
    ok(set.length === 6, 'thrown voxels come down and settle');
    ok(JSON.stringify(Vx.countDebris(R)) === JSON.stringify(R.W.debris), 'the debris count matches the settled voxels');
    ok(set.every((v) => v.z < C.VOXEL.maxStack * C.VOXEL.size - 1e-9), `stacks are at most ${C.VOXEL.maxStack} high`);
    const cell = set[0].i;
    ok(Wd.blocked(R.W, cell) && !Wd.solid(R.W, cell), 'a settled voxel blocks monsters but not the mech');
    for (let t = 0; t < C.VOXEL.life + 0.5; t += DT) Vx.stepVoxels(R, DT, { ...R.mech, x: -99, y: -99 }, false, () => {});
    ok(R.voxels.length === 0 && R.W.debris.every((n) => n === 0), `settled voxels fade after ${C.VOXEL.life} s`);

    G = blank(); R = G.run;
    Vx.burst(R, 24.5, 24.5, 0.2, 1, Vx.C.red, 0.01);
    Vx.burst(R, 24.5, 24.5, 0.2, 1, Vx.C.gold, 0.01);
    Vx.burst(R, 24.5, 24.5, 0.2, 1, Vx.C.stone, 0.01);
    run(G, NONE, 2);
    ok(R.mech.xp === 1 && R.gold === C.VOXEL.gold * R.goldValue, 'walking into red and gold voxels gives XP and credits');
    ok(R.voxels.length === 1 && R.voxels[0].c === Vx.C.stone, 'grey rubble is not collected');

    G = blank(); R = G.run;
    Vx.burst(R, 27.5, 24.5, 0.2, 3, Vx.C.red, 0.01);
    settleAll(G);
    run(G, NONE, 1.5);
    ok(R.mech.xp === 0, 'voxels 3 cells away stay put without the magnet');
    run(G, { ...NONE, mag: true }, 1.5);
    ok(R.mech.xp === 3, 'the magnet pulls them in');

    G = blank(); R = G.run;
    R.mech.maxShield = 40; R.mech.shield = 0; R.mech.hp = 50;
    Vx.burst(R, 24.5, 24.5, 0.2, 2, Vx.C.blue, 0.01);
    Vx.burst(R, 24.5, 24.5, 0.2, 2, Vx.C.green, 0.01);
    run(G, NONE, 1);
    ok(R.mech.shield >= 2 * C.VOXEL.blue - 0.01 && R.mech.hp >= 50 + 2 * C.VOXEL.green - 0.01, 'blue voxels fill the shield, green ones repair');

    section('rules: monsters');
    G = blank(); R = G.run;
    const e = En.spawnEnemy(R, 'mite', 30.5, 24.5);
    Wd.buildFlow(R.W, R.mech.x, R.mech.y);
    run(G, NONE, 0.5);
    ok(e.x < 30.5, 'a monster walks towards the mech');
    G = blank(); R = G.run;
    // a wall of voxels between a monster and the mech: it chews through
    for (let y = 18; y <= 31; y++) for (let k = 0; k < 2; k++) R.voxels.push({ x: 27.5, y: y + 0.5, z: k * C.VOXEL.size, vx: 0, vy: 0, vz: 0, c: Vx.C.stone, s: 1, life: 99, i: Wd.idx(27, y) });
    for (let y = 18; y <= 31; y++) R.W.debris[Wd.idx(27, y)] = 2;
    for (let y = 17; y <= 32; y += 15) for (let x = 20; x <= 34; x++) setCell(R, x, y, 3);
    R.mech.weapons = [];
    const m2 = En.spawnEnemy(R, 'mite', 31.5, 24.5);
    Wd.buildFlow(R.W, R.mech.x, R.mech.y);
    run(G, NONE, 0.6);
    ok(m2.x > 27.9, 'a pile of voxels stops a monster');
    run(G, NONE, 6);
    ok(G.events.some((ev) => ev.type === 'chew') && m2.x < 27, 'it chews through and gets past');

    G = blank(); R = G.run;
    R.voxels.push({ x: 26.5, y: 24.5, z: 0, vx: 0, vy: 0, vz: 0, c: Vx.C.stone, s: 1, life: 99, i: Wd.idx(26, 24) });
    R.W.debris[Wd.idx(26, 24)] = 1;
    R.shots.push({ k: 'e', x: 28.5, y: 24.5, vx: -8, vy: 0, dmg: 10, life: 3 });
    run(G, NONE, 1);
    ok(R.mech.hp === R.mech.maxHp && G.events.some((ev) => ev.type === 'splat'), 'a voxel pile stops a monster\'s shot');
    G = blank(); R = G.run;
    R.voxels.push({ x: 26.5, y: 24.5, z: 0, vx: 0, vy: 0, vz: 0, c: Vx.C.stone, s: 1, life: 99, i: Wd.idx(26, 24) });
    R.W.debris[Wd.idx(26, 24)] = 1;
    const target = En.spawnEnemy(R, 'brute', 29.5, 24.5);
    target.speed = 0;
    run(G, NONE, 0.8);
    ok(target.hp < target.max, 'the mech\'s own guns fire over the pile');

    G = blank(); R = G.run;
    const m3 = En.spawnEnemy(R, 'mite', 26.5, 24.5);
    m3.speed = 0;
    run(G, NONE, 2);
    ok(m3.dead || !R.enemies.includes(m3), 'the auto-guns kill a monster in range');
    ok(G.events.some((ev) => ev.type === 'kill') && R.voxels.length > 0, 'and it bursts into voxels');
    ok(R.mech.od > 0, 'kills charge Overdrive');

    G = blank(); R = G.run;
    R.mech.weapons = [];
    const b = En.spawnEnemy(R, 'boomer', 26.5, 24.5);
    Wd.buildFlow(R.W, R.mech.x, R.mech.y);
    run(G, NONE, 1.5);
    ok(b.dead !== false && R.mech.hp < R.mech.maxHp && G.events.some((ev) => ev.type === 'boom' && ev.from === 'monster'), 'a boomer walks up and blows up');

    section('rules: rockets, hives, cages');
    G = blank(); R = G.run;
    R.mech.weapons = [];
    const walls = [];
    for (let y = 22; y <= 26; y++) walls.push(setCell(R, 30, y, 2));
    Dm.explode(R, 30.5, 24.5, 2, 30, 30, 'mech');
    ok(walls.some((w) => R.W.h[w] < 2), 'an explosion breaks rock around it');
    G = Gm.newGame(3); G.unlocked = 12;
    Gm.act(G, { t: 'launch', mission: 2 });
    R = G.run;
    const hv = R.hives[0];
    ok(R.hives.length === 2 && hv.cells.every((c) => R.W.mat[c] === Wd.MAT_ID.hive), 'mission 2 has two hives standing in the map');
    Dm.hurtHive(R, hv, hv.max);
    ok(hv.dead && hv.cells.every((c) => R.W.h[c] === 0) && G.events.some((ev) => ev.type === 'hive_down'), 'a destroyed hive leaves open ground');
    Dm.hurtHive(R, R.hives[1], 1e9);
    R.enemies.length = 0; R.spawnCd = 1e9;
    run(G, NONE, DT * 2);
    ok(R.objectives[0].done && R.evac === C.EVAC - DT || Math.abs(R.evac - C.EVAC) < 0.05, 'both hives down: the objective is done and evac starts');
    R.mech.inv = 1e9;
    run(G, NONE, C.EVAC + C.FINISH_DELAY + 0.5);
    ok(G.mode === 'debrief' && G.debrief.win && G.cleared[2], 'the lift arrives: a win');
    const gold = G.hangar.gold;
    ok(gold >= MISSIONS[1].reward, 'the reward is paid');

    G = Gm.newGame(4); Gm.act(G, { t: 'launch', mission: 1 });
    R = G.run; R.enemies.length = 0; R.spawnCd = 1e9; R.mech.inv = 1e9; R.mech.weapons = [];
    const cage = R.cages[0];
    R.mech.x = cage.x; R.mech.y = cage.y;
    run(G, NONE, C.RESCUE.time - 0.3);
    ok(!cage.freed, 'a cage takes time to open');
    run(G, NONE, 0.5);
    ok(cage.freed && G.events.some((ev) => ev.type === 'rescue' && ev.crew === cage.crew), `standing by it for ${C.RESCUE.time} s frees ${cage.crew}`);

    section('rules: level-ups, overdrive, shield, losing');
    G = blank(); R = G.run;
    R.mech.xp = R.mech.xpNext;
    run(G, NONE, DT);
    ok(R.choice && R.choice.length === 3 && new Set(R.choice).size === 3, 'a full XP bar offers three different cards');
    const tFrozen = R.t;
    run(G, NONE, 1);
    ok(R.t === tFrozen, 'the battle waits while a card is chosen');
    const pick = R.choice[0];
    run(G, { ...NONE, pick: 0 }, DT);
    ok(!R.choice && R.mods[pick] === 1, 'picking a card applies it');
    ok(Rn.rollChoices({ mech: { weapons: [{ type: 'bullet' }] }, mods: {}, rng: G.rng }).every((k) => !UPGRADES[k].need || UPGRADES[k].need.includes('bullet')), 'cards for weapons the mech lacks are not offered');

    G = blank(); R = G.run;
    R.mech.od = 1;
    run(G, { ...NONE, od: true }, DT);
    ok(R.mech.odT > 0 && G.events.some((ev) => ev.type === 'overdrive'), 'a full gauge fires Overdrive');
    Dm.hurtMech(R, 50);
    ok(R.mech.hp === R.mech.maxHp, 'nothing hurts during Overdrive');
    G = blank(); R = G.run;
    R.mech.maxShield = R.mech.shield = 30;
    Dm.hurtMech(R, 20);
    ok(R.mech.shield === 10 && R.mech.hp === R.mech.maxHp, 'the shield takes hits first');
    Dm.hurtMech(R, 20);
    ok(R.mech.hp === R.mech.maxHp, 'a hit right after another is ignored (i-frames)');
    R.mech.inv = 0; Dm.hurtMech(R, 20);
    ok(R.mech.shield === 0 && R.mech.hp === R.mech.maxHp - 10, 'what the shield can\'t hold hurts');

    G = Gm.newGame(6); Gm.act(G, { t: 'launch', mission: 1 });
    R = G.run; R.gold = 41;
    R.mech.hp = 0.1; R.mech.inv = 0; Dm.hurtMech(R, 999);
    run(G, NONE, C.FINISH_DELAY + 0.2);
    ok(G.mode === 'debrief' && !G.debrief.win && G.hangar.gold === Math.floor(41 * C.LOSS_KEEP), `going down loses the sortie and keeps ${C.LOSS_KEEP * 100}% of the credits`);
    ok(Gm.act(G, { t: 'done' }) && G.mode === 'hangar' && G.unlocked === 1, 'back to the hangar, nothing new unlocked');
    Gm.act(G, { t: 'launch', mission: 1 });
    ok(Gm.act(G, { t: 'abort' }) && G.mode === 'debrief' && !G.debrief.win, 'giving up ends the sortie');

    section('rules: Shard Beam and tap-to-focus');
    G = blank(); R = G.run;
    run(G, { ...NONE, beam: true }, DT);
    ok(R.mech.beamT === 0 && !G.events.some((e) => e.type === 'shard_beam'), 'an uncharged Shard Beam does not fire');
    const need = Math.ceil(1 / C.SHARD_BEAM.perVoxel);
    Vx.burst(R, 24.5, 24.5, 0.2, need - 1, Vx.C.gold, 0.01);   // gold: red would level up and pause the field
    run(G, NONE, 1);
    ok(R.mech.beam < 1 && R.mech.beam > 0.9, `collecting voxels charges it (${need - 1} of ${need})`);
    Vx.burst(R, 24.5, 24.5, 0.2, 1, Vx.C.blue, 0.01);
    run(G, NONE, 0.5);
    ok(R.mech.beam === 1, 'one more voxel of any colour fills it');
    R.mech.weapons = [];
    const victims = [En.spawnEnemy(R, 'brute', 30.5, 24.5), En.spawnEnemy(R, 'brute', 36.5, 24.5)];
    for (const v of victims) v.speed = 0;
    const wall = setCell(R, 33, 24, 2);
    G.events.length = 0;
    run(G, { ...NONE, beam: true }, DT);
    ok(R.mech.beamT > 0 && R.mech.beam === 0 && G.events.some((e) => e.type === 'shard_beam'), 'charged, it fires and the gauge empties');
    run(G, NONE, C.SHARD_BEAM.time + 0.1);
    ok(victims.every((v) => v.hp < v.max * 0.5), 'it pierces: both monsters in its line are badly hurt');
    ok(R.W.h[wall] < 2, 'it cuts through the rock between them');
    R.mech.beam = 1;
    run(G, { ...NONE, beam: true }, DT);
    ok(R.mech.beamT <= 0 && R.mech.beamCd > 0, 'during the cooldown a full gauge cannot fire again');
    run(G, NONE, C.SHARD_BEAM.cooldown);
    run(G, { ...NONE, beam: true }, DT);
    ok(R.mech.beamT > 0, `after ${C.SHARD_BEAM.cooldown} s it fires again`);

    G = blank(); R = G.run;
    const near = En.spawnEnemy(R, 'brute', 26.5, 24.5), far = En.spawnEnemy(R, 'brute', 24.5, 30.5);
    near.speed = far.speed = 0; near.hp = near.max = far.hp = far.max = 1e6;
    run(G, { ...NONE, tap: { x: 24.8, y: 30.2 } }, DT);
    ok(R.focus && R.focus.id === far.id && G.events.some((e) => e.type === 'focus'), 'a tap near a monster focuses it');
    const farHp = far.hp, nearHp = near.hp;
    run(G, NONE, 1.5);
    ok(far.hp < farHp && near.hp === nearHp, 'the guns fire at the focused one, not the nearer one');
    Dm.hurtEnemy(R, far, 1e9);
    run(G, NONE, 1);
    ok(R.focus === null && G.events.some((e) => e.type === 'focus_lost') && near.hp < nearHp, 'when it dies the focus lets go and auto-aim takes the nearest again');
    run(G, { ...NONE, tap: { x: 10.5, y: 10.5 } }, DT);
    ok(R.focus === null, 'a tap on empty ground clears the focus');

    section('rules: bosses');
    G = Gm.newGame(7); G.unlocked = 12; Gm.act(G, { t: 'launch', mission: 4 });
    R = G.run; R.mech.inv = 1e9;
    run(G, NONE, 5.2);
    const boss = R.enemies.find((x) => x.boss);
    ok(boss && boss.kind === 'behemoth' && G.events.some((ev) => ev.type === 'boss_in'), 'the boss arrives on a boss mission');
    run(G, NONE, 4);
    ok(G.events.some((ev) => ev.type === 'boss_wind') && G.events.some((ev) => ev.type === 'boss_act'), 'it winds up and attacks');
    Dm.hurtEnemy(R, boss, 1e9);
    run(G, NONE, DT * 2);
    ok(R.over === 'win' && G.events.some((ev) => ev.type === 'boss_down'), 'killing it wins at once, no evac');
}

// ======================================================================
if (want('hangar')) {
    section('hangar and crew');
    const G = Gm.newGame(9);
    ok(!Gm.act(G, { t: 'buy', part: 'laser' }), 'no credits, no laser');
    G.hangar.gold = 1000;
    ok(Gm.act(G, { t: 'buy', part: 'laser' }) && G.hangar.gold === 1000 - PARTS.laser.cost[0] && G.hangar.loadout.armR === 'laser', 'buying a laser fits it in the empty right arm');
    ok(Gm.act(G, { t: 'buy', part: 'laser' }) && G.hangar.parts.laser === 2, 'buying again upgrades it');
    ok(!Gm.act(G, { t: 'equip', slot: 'core', part: 'laser' }), 'a laser does not fit in the core');
    ok(Gm.act(G, { t: 'equip', slot: 'armL', part: 'laser' }) && G.hangar.loadout.armL === 'laser' && G.hangar.loadout.armR === 'vulcan', 'moving the laser to the left arm swaps the arms');
    ok(!Gm.act(G, { t: 'equip', slot: 'legs', part: null }), 'legs can\'t be left empty');
    ok(Gm.act(G, { t: 'equip', slot: 'shoulder', part: null }) && G.hangar.loadout.shoulder === null, 'the shoulder can');
    const lvl3 = Hg.buildMech(G).weapons.find((w) => w.part === 'laser');
    ok(lvl3 && Math.abs(lvl3.dmg - PARTS.laser.weapon.dmg * 1.35) < 1e-9, 'a level-2 laser hits 35% harder');

    Hg.joinCrew(G, 'hana'); Hg.joinCrew(G, 'gen');
    Gm.act(G, { t: 'idle', secs: 599 });
    ok(Hg.giftsWaiting(G) === 1, 'after ten minutes Old Gen has a gift (9 min) and Hana not yet (10 min)');
    Gm.act(G, { t: 'idle', secs: 1 });
    ok(Hg.giftsWaiting(G) === 2, 'and then Hana does');
    Gm.act(G, { t: 'idle', secs: 99999 });
    ok(G.hangar.crew.every((c) => c.stored === C.GIFT_CAP), `gifts pile up to ${C.GIFT_CAP} each, no more`);
    const g0 = G.hangar.gold;
    Gm.act(G, { t: 'collect', crew: 'all' });
    ok(G.hangar.gold === g0 + 3 * 70 && G.hangar.boosts.bento === 3 && Hg.giftsWaiting(G) === 0, 'collecting pays Gen\'s credits and stores Hana\'s bentos');
    Gm.act(G, { t: 'idle', secs: 1e9 });
    ok(G.hangar.clock <= 1e9 && Hg.giftsWaiting(G) === 2 * C.GIFT_CAP, 'a huge absence is capped');
    Gm.act(G, { t: 'equip', slot: 'shoulder', part: 'rockets' });
    Gm.act(G, { t: 'launch', mission: 1 });
    ok(G.run.mech.maxHp === Hg.buildMech(G).maxHp + 25 && G.hangar.boosts.bento === 2 && G.run.boosts.bento, 'one bento is eaten at launch: +25 max HP');
    ok(BOOSTS.every((k) => GIFTS[k].desc), 'every boost says what it does');
}

// ======================================================================
if (want('maps')) {
    section('maps');
    const { makeRng } = await import('../js/rng.js');
    let bad = 0, n = 0;
    for (const m of MISSIONS) for (let s = 1; s <= 60; s++) {
        const L = Wd.generate(m, makeRng(Gm.hashSeed(s * 31 + m.id)));
        n++;
        if (!Wd.provedReachable(L)) bad++;
        const nh = m.objectives.filter((o) => o.kind === 'hives').reduce((a, o) => a + o.count, 0);
        const nc = m.objectives.filter((o) => o.kind === 'rescue').reduce((a, o) => a + o.crew.length, 0);
        if (L.hives.length !== nh || L.cages.length !== nc) bad++;
        if (Wd.solid(L.W, Wd.idx(Wd.cellOf(L.spawn.x), Wd.cellOf(L.spawn.y)))) bad++;
    }
    ok(bad === 0, `${n} maps (12 missions × 60 seeds): every cage and hive reachable, the right counts, a clear landing zone`);
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed) => {
        const G = Gm.newGame(seed), bot = Bt.makeBot({ seed });
        Bt.botHangar(G, bot);
        run(G, (g) => Bt.botInput(g, bot), 25);
        return G;
    };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');

    const G = Gm.newGame(7), bot = Bt.makeBot({ seed: 7 });
    G.unlocked = 7;
    Gm.act(G, { t: 'launch', mission: 7 });
    G.run.mech.inv = 1e9;             // the starter mech must still be standing at 20 s
    run(G, (g) => Bt.botInput(g, bot), 20);
    ok(G.mode === 'mission' && G.run.voxels.length > 0 && G.run.enemies.length > 0, 'mid-sortie with monsters and voxels in the air');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 3 }), b2 = Bt.makeBot({ seed: 3 });
    run(G, (g) => Bt.botInput(g, b1), 15);
    run(copy, (g) => Bt.botInput(g, b2), 15);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a mid-sortie save round trip plays on identically');
    ok(!JSON.stringify(Gm.serialize(G)).includes('_hash'), 'the spatial hash is not saved');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot: the whole campaign');
    const table = {};
    const finished = { 1: 0, 0.4: 0 }, sorties = { 1: 0, 0.4: 0 }, beams = { 1: 0, 0.4: 0 };
    let bad = null;
    for (const skill of [1, 0.4]) for (let seed = 1; seed <= SEEDS; seed++) {
        const G = Gm.newGame(seed * 101), bot = Bt.makeBot({ skill, seed });
        for (let s = 0; s < 40 && !G.ended; s++) {
            Bt.botHangar(G, bot);
            const id = G.run.mission;
            let minHp = 1, steps = 0;
            while (G.mode === 'mission') {
                if (++steps > 120 * 400) { Gm.act(G, { t: 'abort' }); bad = bad || `seed ${seed} m${id}: stuck for 400 s`; break; }
                Gm.step(G, Bt.botInput(G, bot), DT);
                for (const ev of G.events) if (ev.type === 'shard_beam') beams[skill]++;
                G.events.length = 0;
                const R = G.run;
                if (!R) break;
                const M = R.mech;
                if (!Number.isFinite(M.x) || !Number.isFinite(M.y) || !Number.isFinite(M.hp)) bad = bad || `seed ${seed} m${id}: non-finite mech`;
                if (M.x < 1 || M.y < 1 || M.x > C.MAP.w - 1 || M.y > C.MAP.h - 1) bad = bad || `seed ${seed} m${id}: mech outside the field`;
                if (M.hp > M.maxHp + 1e-6 || M.shield > M.maxShield + 1e-6) bad = bad || `seed ${seed} m${id}: over max`;
                if (R.enemies.length > C.ENEMY_CAP + 30) bad = bad || `seed ${seed} m${id}: too many monsters`;
                if (R.voxels.length > C.VOXEL.cap) bad = bad || `seed ${seed} m${id}: too many voxels`;
                minHp = Math.min(minHp, (M.hp + M.shield) / (M.maxHp + M.maxShield));
            }
            const D = G.debrief;
            const key = `${skill}:${id}`;
            const r = table[key] || (table[key] = { skill, id, att: 0, win: 0, t: [], hp: [], kills: [], cr: [] });
            r.att++; if (D.win) { r.win++; r.t.push(D.time); r.hp.push(Math.round(minHp * 100)); }
            r.kills.push(D.kills); r.cr.push(D.reward + D.salvage);
            Gm.act(G, { t: 'idle', secs: 600 });      // ten minutes between sorties: the crew make gifts
        }
        if (G.ended) finished[skill]++;
        sorties[skill] += G.stats.sorties;
    }
    ok(!bad, `per-step invariants hold (finite, inside the field, HP and shield within max, caps): ${bad || 'yes'}`);
    const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : '-');
    console.log('  skill  mission  wins/tries  median time  median low HP  kills  credits');
    for (const r of Object.values(table)) console.log(`  ${String(r.skill).padEnd(5)}  ${String(r.id).padStart(7)}  ${`${r.win}/${r.att}`.padStart(10)}  ${String(med(r.t)).padStart(10)}s  ${String(med(r.hp)).padStart(12)}%  ${String(med(r.kills)).padStart(5)}  ${String(med(r.cr)).padStart(7)}`);
    console.log(`  finished: skill 1 ${finished[1]}/${SEEDS} in ${sorties[1]} sorties; skill 0.4 ${finished[0.4]}/${SEEDS} in ${sorties[0.4]} sorties`);
    ok(finished[1] === SEEDS, 'the perfect bot finishes the campaign on every seed');
    ok(sorties[1] <= SEEDS * 18, 'and needs at most 18 sorties for 12 missions');
    ok(sorties[0.4] > sorties[1], 'a sloppy pilot needs more sorties than a good one');
    const firstTry = Object.values(table).filter((r) => r.skill === 1 && r.id <= 3).every((r) => r.win === r.att);
    ok(firstTry, 'the first three missions are won first time by a good pilot');
    const bossLosses = Object.values(table).filter((r) => r.skill === 0.4 && [4, 8, 12].includes(r.id)).reduce((a, r) => a + r.att - r.win, 0);
    ok(bossLosses >= 1, 'the bosses beat a sloppy pilot at least once');
    const t = (id) => med(table[`1:${id}`]?.t || []);
    ok(t(1) >= 30 && t(9) >= 120, `sorties last: mission 1 ${t(1)} s, mission 9 ${t(9)} s`);
    ok(beams[1] >= sorties[1], `the bot fires the Shard Beam (${beams[1]} times in ${sorties[1]} sorties): it is doing something`);
    // the beam must not trivialise hives: hive sorties stayed at ~95-110 s before it existed
    ok(t(6) >= 85 && t(11) >= 85, `hive sorties still take time: mission 6 ${t(6)} s, mission 11 ${t(11)} s`);
    ok(sorties[1] <= SEEDS * 13 && sorties[0.4] >= sorties[1] + SEEDS, `the campaign stays as hard as before the beam: ${sorties[1]} and ${sorties[0.4]} sorties`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
