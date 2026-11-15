// One sortie: the mech on the battlefield until the objectives are done or it goes down.
// Pure.

import { MECH, RESCUE, EVAC, FLOW_EVERY, FINISH_DELAY, LOSS_KEEP, OVERDRIVE, COLORS, VOXEL } from '../config.js';
import { missionById, LAST_MISSION } from './data/missions.js';
import { UPGRADES } from './data/upgrades.js';
import { HIVE } from './data/enemies.js';
import { BOOSTS } from './data/crew.js';
import { generate, buildFlow, collide, solid, idx, cellOf, inMap } from './world.js';
import { stepVoxels } from './voxels.js';
import { buildHash, fireWeapons, stepShots } from './combat.js';
import { spawning, stepEnemies, spawnBoss, spawnEnemy } from './enemies.js';
import { buildMech, joinCrew, xpFor } from './hangar.js';

/** The run keeps a reference to the game's rng and event list; neither is saved with it. */
export function attach(G, R) {
    Object.defineProperty(R, 'rng', { value: G.rng, writable: true, enumerable: false, configurable: true });
    Object.defineProperty(R, 'events', { value: G.events, writable: true, enumerable: false, configurable: true });
    return R;
}

export function startRun(G, id) {
    const m = missionById(id);
    if (!m || id > G.unlocked) return false;
    const H = G.hangar;
    // one of each boost the crew gave is used up on this sortie
    const boosts = {};
    for (const k of BOOSTS) if (H.boosts[k] > 0) { H.boosts[k]--; boosts[k] = 1; }
    const L = generate(m, G.rng);
    const known = new Set(H.crew.map((c) => c.id));
    const crew = m.objectives.filter((o) => o.kind === 'rescue').flatMap((o) => o.crew);
    const mods = boosts.luck ? { luck: 1 } : {};
    const R = {
        mission: id, d: m.d, t: 0, W: L.W,
        hpScale: 0.6 + 0.4 * m.d ** 1.3, dmgScale: 0.9 + 0.35 * m.d,
        spawnMul: m.boss ? 0.55 : m.objectives.some((o) => o.kind === 'survive') ? 1.1 : 1,
        goldValue: 1,
        enemies: [], shots: [], voxels: [], nextId: 1, spawnCd: 2.5,
        hives: L.hives.map((h, k) => {
            const cells = [];
            for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) cells.push(idx(cellOf(h.x) + x, cellOf(h.y) + y));
            const hp = HIVE.hp * (0.6 + 0.4 * m.d ** 1.3);
            return { id: 'h' + k, x: h.x, y: h.y, hp, max: hp, cells, cd: 2 + k, flash: 0, dead: false };
        }),
        cages: L.cages.map((c, k) => ({ crew: known.has(crew[k]) ? 'civ' : crew[k], x: c.x, y: c.y, prog: 0, freed: false })),
        objectives: m.objectives.map((o) => ({ ...o, done: false })),
        boss: null, bossDown: false, choice: null, pending: 0, mods, boosts,
        evac: null, over: null, overT: 0, gold: 0, kills: 0, collected: { red: 0, blue: 0, green: 0, gold: 0 }, rescued: [],
    };
    attach(G, R);
    const b = buildMech(G, mods, boosts);
    R.mech = {
        ...b, x: L.spawn.x, y: L.spawn.y, vx: 0, vy: 0, face: -Math.PI / 2, aim: -Math.PI / 2,
        hp: b.maxHp, shield: b.maxShield, shieldT: 0, inv: 1.5, od: boosts.cheer ? 1 : 0, odT: 0,
        lvl: boosts.tuneup ? 2 : 1, xp: 0, xpNext: xpFor(boosts.tuneup ? 2 : 1), taken: 0, wading: false, magnet: b.magnet,
    };
    buildFlow(R.W, R.mech.x, R.mech.y);
    R.W.ffT = FLOW_EVERY;
    // every cage is guarded
    for (const c of R.cages) for (let k = 0; k < RESCUE.guards; k++) {
        const a = (k / RESCUE.guards) * Math.PI * 2;
        spawnEnemy(R, k % 2 && m.d > 1.2 ? 'spitter' : 'mite', c.x + Math.cos(a) * 1.4, c.y + Math.sin(a) * 1.4);
    }
    G.run = R;
    G.mode = 'mission';
    G.stats.sorties++;
    G.events.push({ type: 'launch', mission: id, boosts: Object.keys(boosts) });
    return true;
}

// ------------------------------------------------------------------ level-ups
function needs(M, need) {
    if (!need) return true;
    return M.weapons.some((w) => need.includes(w.type));
}
export function rollChoices(R) {
    const M = R.mech;
    const ok = Object.keys(UPGRADES).filter((k) => (R.mods[k] || 0) < UPGRADES[k].max && needs(M, UPGRADES[k].need));
    const out = [];
    while (out.length < 3 && ok.length) out.push(ok.splice(Math.floor(R.rng() * ok.length), 1)[0]);
    return out;
}
export function applyUpgrade(G, R, key) {
    const M = R.mech;
    R.mods[key] = (R.mods[key] || 0) + 1;
    const b = buildMech(G, R.mods, R.boosts, M.weapons);
    const dHp = b.maxHp - M.maxHp, dSh = b.maxShield - M.maxShield;
    Object.assign(M, b);
    M.hp = Math.min(M.maxHp, M.hp + Math.max(0, dHp) + (key === 'hp' ? 30 : 0));
    M.shield = Math.min(M.maxShield, M.shield + Math.max(0, dSh));
    R.events.push({ type: 'upgrade', key, n: R.mods[key] });
}

// ------------------------------------------------------------------ the step
/** inp = { x, y, mag, od, pick }: move, MAGNET held, OVERDRIVE pressed, a level-up card (0-2). */
export function stepRun(G, inp, dt) {
    const R = G.run, M = R.mech;
    if (R.over) {
        R.overT -= dt;
        stepVoxels(R, dt, M, false, () => {});
        if (R.overT <= 0) finish(G);
        return;
    }
    if (R.choice) {
        if (inp.pick != null && inp.pick >= 0 && inp.pick < R.choice.length) {
            applyUpgrade(G, R, R.choice[inp.pick]);
            R.choice = null;
            if (R.pending > 0) { R.pending--; offer(R); }
        }
        return;                                   // the field waits while a card is chosen
    }
    R.t += dt;

    // ---- the mech
    const mag = !!inp.mag;
    const cx = cellOf(M.x), cy = cellOf(M.y);
    M.wading = inMap(cx, cy) && R.W.debris[idx(cx, cy)] > 0;
    let sp = M.speed * (mag ? MECH.magnetSlow : 1) * (M.wading ? MECH.debrisSlow : 1);
    const len = Math.hypot(inp.x || 0, inp.y || 0), k = len > 1 ? 1 / len : 1;
    M.vx = (inp.x || 0) * k * sp; M.vy = (inp.y || 0) * k * sp;
    M.x += M.vx * dt; M.y += M.vy * dt;
    collide(R.W, M, MECH.radius, solid);
    if (len > 0.1) M.face = Math.atan2(M.vy, M.vx);
    M.magnetOn = mag;
    if (inp.od && M.od >= 1 && M.odT <= 0) { M.od = 0; M.odT = OVERDRIVE.time; R.events.push({ type: 'overdrive' }); }
    M.odT = Math.max(0, M.odT - dt);
    M.inv = Math.max(0, M.inv - dt);
    M.shieldT = Math.max(0, M.shieldT - dt);
    if (M.shieldT <= 0 && M.shield < M.maxShield) M.shield = Math.min(M.maxShield, M.shield + M.shieldRegen * dt);
    if (M.regen) M.hp = Math.min(M.maxHp, M.hp + M.regen * dt);

    // ---- the world
    R.W.ffT -= dt;
    if (R.W.ffT <= 0) { buildFlow(R.W, M.x, M.y); R.W.ffT += FLOW_EVERY; }
    const m = missionById(R.mission);
    if (m.boss && R.boss == null && R.t >= 5) spawnBoss(R, m.boss);
    buildHash(R);
    spawning(R, dt);
    stepEnemies(R, dt);
    buildHash(R);
    fireWeapons(R, dt, mag);
    stepShots(R, dt);
    stepVoxels(R, dt, M, mag, (c) => collect(R, c));

    // ---- cages
    for (const c of R.cages) {
        if (c.freed) continue;
        if (Math.hypot(M.x - c.x, M.y - c.y) < RESCUE.radius) {
            c.prog += dt;
            if (c.prog >= RESCUE.time) {
                c.freed = true;
                if (c.crew !== 'civ') R.rescued.push(c.crew); else R.gold += 40;
                R.events.push({ type: 'rescue', crew: c.crew, x: c.x, y: c.y });
            }
        } else c.prog = Math.max(0, c.prog - dt * 0.5);
    }

    // ---- level-ups
    while (M.xp >= M.xpNext) { M.xp -= M.xpNext; M.lvl++; M.xpNext = xpFor(M.lvl); R.pending++; }
    if (R.pending > 0 && !R.choice) { R.pending--; offer(R); }

    // ---- objectives
    for (const o of R.objectives) {
        if (o.done) continue;
        if (o.kind === 'rescue') o.done = R.cages.every((c) => c.freed);
        else if (o.kind === 'hives') o.done = R.hives.filter((h) => h.dead).length >= o.count;
        else if (o.kind === 'survive') o.done = R.t >= o.time;
        else if (o.kind === 'boss') o.done = R.bossDown;
        if (o.done) R.events.push({ type: 'objective', kind: o.kind });
    }
    if (R.evac == null && R.objectives.every((o) => o.done)) {
        // a boss going down ends it; otherwise hold out until the lift arrives
        R.evac = m.boss ? 0 : EVAC;
        if (R.evac) { R.spawnMul *= 1.5; R.events.push({ type: 'evac', time: R.evac }); }
    }
    if (R.evac != null) R.evac = Math.max(0, R.evac - dt);
    if (M.hp <= 0) { R.over = 'lose'; R.overT = FINISH_DELAY; R.events.push({ type: 'fail' }); }
    else if (R.evac === 0) { R.over = 'win'; R.overT = FINISH_DELAY; R.events.push({ type: 'clear' }); }
}

function offer(R) {
    const c = rollChoices(R);
    if (c.length) { R.choice = c; R.events.push({ type: 'levelup', lvl: R.mech.lvl }); }
}

function collect(R, c) {
    const M = R.mech, name = COLORS[c];
    R.collected[name]++;
    if (name === 'red') M.xp += VOXEL.red;
    else if (name === 'blue') { if (M.maxShield > 0) M.shield = Math.min(M.maxShield, M.shield + VOXEL.blue); else M.hp = Math.min(M.maxHp, M.hp + 2); }
    else if (name === 'green') M.hp = Math.min(M.maxHp, M.hp + VOXEL.green);
    else if (name === 'gold') R.gold += VOXEL.gold * R.goldValue;
    R.events.push({ type: 'collect', c: name });
}

/** Give up on the sortie (from the pause menu). */
export function abort(G) {
    const R = G.run;
    if (!R || R.over) return false;
    R.over = 'lose'; R.overT = 0; R.aborted = true;
    finish(G);
    return true;
}

/** Back to the carrier: pay out, welcome the rescued, unlock the next sortie. */
export function finish(G) {
    const R = G.run, m = missionById(R.mission);
    const win = R.over === 'win';
    const reward = win ? m.reward : 0;
    const salvage = win ? R.gold : Math.floor(R.gold * LOSS_KEEP);
    G.hangar.gold += reward + salvage;
    const joined = R.rescued.filter((id) => joinCrew(G, id));
    const first = win && !G.cleared[m.id];
    if (win) { G.cleared[m.id] = true; G.unlocked = Math.max(G.unlocked, Math.min(LAST_MISSION, m.id + 1)); G.stats.wins++; }
    G.stats.kills += R.kills;
    const ending = win && m.id === LAST_MISSION && !G.ended;
    if (ending) G.ended = true;
    G.debrief = {
        mission: m.id, win, reward, salvage, joined, kills: R.kills, time: Math.round(R.t),
        lvl: R.mech.lvl, collected: R.collected, first, ending, aborted: !!R.aborted,
    };
    G.run = null;
    G.mode = 'debrief';
    G.events.push({ type: 'debrief', win, mission: m.id });
}
