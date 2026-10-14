// The simulation hub. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// G.L (the level) is regenerated from (seed, level, difficulty) and never saved.

import { PLAYER, CELL, DIFFICULTY, AMMO_START, FURY } from '../config.js';
import { makeRng } from '../rng.js';
import { LEVELS, TAPES, BRIEFINGS, ENEMIES } from './data.js';
import { generateLevel, reachable, KEY_NAMES } from './level.js';
import { cellAt, cellX, cellZ, flowField, isWall } from './world.js';
import { newPlayer, stepPlayer } from './player.js';
import { spawnEnemy, stepEnemies, findSpot, defOf } from './enemies.js';
import { spawnBoss, stepBosses } from './bosses.js';
import { stepProjectiles, ev, quip, damageBarrel, dropPickup } from './combat.js';
import { starterGun, legendary as legendaryFor } from './weapons.js';

export { NO_INPUT } from './player.js';
export const LEVEL_COUNT = LEVELS.length;

export function newGame(seed = 1, diffIndex = 1) {
    const G = {
        v: 1, seed, diffIndex, rng: makeRng(seed ^ 0x5eed),
        t: 0, lt: 0, level: 0, phase: 'play', events: [], nextId: 1,
        tapes: LEVELS.map(() => [false, false, false]),
        stats: { kills: 0, deaths: 0, style: 0, time: 0, levels: [] },
        player: newPlayer(),
        god: false,
    };
    Object.defineProperty(G, 'diff', { get() { return DIFFICULTY[this.diffIndex]; }, enumerable: false });
    const p = G.player;
    p.weapons.push(starterGun());
    p.ammo = { ...AMMO_START };
    startLevel(G, 0);
    return G;
}

/** Copy of the parts of the player that carry from level to level. */
function carry(p) {
    return JSON.parse(JSON.stringify({ hp: p.hp, armor: p.armor, weapons: p.weapons, cur: p.cur, ammo: p.ammo, bombs: p.bombs, fury: p.fury }));
}

export function startLevel(G, index, entry = null) {
    G.level = index;
    G.lt = 0;
    G.phase = 'play';
    const L = G.L = generateLevel(G.seed, index, G.diff);
    const p = G.player;
    if (entry) Object.assign(p, JSON.parse(JSON.stringify(entry)));
    p.hp = Math.max(p.hp, PLAYER.hp);
    G.entry = carry(p);
    Object.assign(p, {
        x: cellX(L, L.start), z: cellZ(L, L.start), y: L.floor[L.start], vx: 0, vy: 0, vz: 0,
        yaw: L.startYaw, pitch: 0, keys: 0, dead: false, ground: true, overdrive: 0, fuel: PLAYER.fuelMax,
        reloadT: 0, switchT: 0, fireT: 0, combo: { n: 0, t: 0 }, nearGun: -1, noAuto: -1, kickT: 0, jet: false,
    });
    for (const g of p.weapons) g.clip = Math.min(g.mag, g.clip ?? g.mag);
    G.doorOpen = L.doors.map(() => 0);
    G.doorLock = L.doors.map(() => false);
    G.enemies = [];
    G.proj = [];
    G.waves = [];
    G.pickups = L.pickups.filter((pk) => !(pk.kind === 'tape' && G.tapes[index][pk.tape])).map((pk) => ({ ...JSON.parse(JSON.stringify(pk)), id: G.nextId++ }));
    G.barrels = L.barrels.map((b) => ({ id: G.nextId++, x: cellX(L, b.cell), z: cellZ(L, b.cell), y: L.floor[b.cell], hp: 30, dead: false }));
    for (const s of L.enemies) spawnEnemy(G, s.type, cellX(L, s.cell), cellZ(L, s.cell));
    G.totalEnemies = G.enemies.length + (L.ambush ? L.ambush.reduce((a, s) => a + s.n, 0) : 0);
    G.ambush = L.ambush ? 'idle' : 'none';
    G.ambushLeft = 0;
    G.bossState = L.boss ? 'idle' : 'none';
    G.bossId = -1;
    G.bossDef = null;
    G.exitOpen = !L.boss;
    G.quipT = 2;
    G.tally = { kills: 0, gibs: 0, style: 0, tapes: 0, taken: 0, dealt: 0, deaths: 0 };
    G.flowSig = -1;
    G.wonT = 0;
    G.keysChanged = true;
    updateObjective(G);
    ev(G, 'level', { index, name: LEVELS[index].name, sub: LEVELS[index].sub, briefing: BRIEFINGS[index] });
    quip(G, 'start', true);
    G.quipT = 4;
}

/** After death: back to the start of the level with what you had when you entered it. */
export function continueLevel(G) {
    const deaths = G.tally.deaths;
    startLevel(G, G.level, G.entry);
    G.tally.deaths = deaths;
    G.stats.deaths++;
}

/** After a level clear: on to the next. */
export function nextLevel(G) {
    if (G.level + 1 >= LEVEL_COUNT) return false;
    G.stats.levels[G.level] = { ...G.tally, time: G.lt };
    startLevel(G, G.level + 1);
    return true;
}

// ==================================================================== objectives

function updateObjective(G) {
    const L = G.L, p = G.player;
    G.keysChanged = false;
    const { seen } = reachable(L, p.keys, false);   // with the keys in hand, not the ones on the floor
    let target = null;
    for (const pk of G.pickups) {
        if (pk.kind !== 'key' || (p.keys & (1 << pk.key))) continue;
        if (seen[pk.cell]) { target = { kind: 'key', key: pk.key, x: pk.x, z: pk.z, cell: pk.cell, text: `Find the ${KEY_NAMES[pk.key]} keycard` }; break; }
    }
    if (!target) {
        const er = L.rooms[L.exitRoom];
        if (L.boss && G.bossState !== 'dead') target = { kind: 'boss', x: (er.x + er.w / 2) * CELL, z: (er.y + er.h / 2) * CELL, cell: er.c, text: G.bossState === 'active' ? `Kill ${G.bossDef.name}` : 'Find the big one' };
        else if (G.ambush === 'active') target = { kind: 'ambush', x: p.x, z: p.z, cell: cellAt(L, p.x, p.z), text: 'Survive the ambush!' };
        else target = { kind: 'exit', x: cellX(L, L.exitCell), z: cellZ(L, L.exitCell), cell: L.exitCell, text: L.boss === 'rourke' ? 'Finish it' : 'Reach the exit' };
    }
    const changed = !G.objective || G.objective.text !== target.text;
    G.objective = target;
    if (changed) ev(G, 'objective', { text: target.text });
}

// ==================================================================== step

export function step(G, inp, dt) {
    if (G.phase === 'won' || G.phase === 'clear') return;
    if (G.phase === 'dead') { G.t += dt; return; }
    G.t += dt; G.lt += dt; G.stats.time += dt;
    const p = G.player;
    const eScale = p.overdrive > 0 ? FURY.enemyScale : 1;
    G.quipT -= dt;

    stepPlayer(G, inp, dt);
    stepDoors(G, dt);
    refreshFlow(G);
    stepEnemies(G, dt * eScale);
    stepBosses(G, dt * eScale);
    stepProjectiles(G, dt, eScale);
    for (const b of G.barrels) if (b.lit && !b.dead) { b.fuse -= dt; if (b.fuse <= 0) damageBarrel(G, b, 999); }
    if (G.enemies.some((e) => e.dead)) G.enemies = G.enemies.filter((e) => !e.dead);
    stepTriggers(G, dt);
    if (G.keysChanged || (G.lt % 1 < dt)) updateObjective(G);
}

function stepDoors(G, dt) {
    const L = G.L, p = G.player;
    for (let d = 0; d < L.doors.length; d++) {
        const door = L.doors[d];
        let want = 0;
        if (!G.doorLock[d] && (p.keys & (1 << door.key))) {
            for (const c of door.cells) {
                if ((cellX(L, c) - p.x) ** 2 + (cellZ(L, c) - p.z) ** 2 < 6.5 * 6.5) { want = 1; break; }
            }
            // once open, a keyed door stays open
            if (G.doorOpen[d] > 0.95) want = 1;
        }
        const was = G.doorOpen[d];
        if (want > was) G.doorOpen[d] = Math.min(1, was + dt * 1.6);
        else if (want < was) {
            // never close on the player
            const onIt = door.cells.some((c) => c === cellAt(L, p.x, p.z));
            if (!onIt) G.doorOpen[d] = Math.max(0, was - dt * 2.5);
        }
        // a door shutting on an enemy shoves it out of the doorway, into the room it guards
        if (was >= 0.9 && G.doorOpen[d] < 0.9) {
            for (const e of G.enemies) {
                const ec = cellAt(L, e.x, e.z);
                if (!door.cells.includes(ec)) continue;
                const out = [ec + 1, ec - 1, ec + L.W, ec - L.W].find((j) => !L.solid[j] && L.door[j] < 0 && L.room[j] === door.room)
                    ?? [ec + 1, ec - 1, ec + L.W, ec - L.W].find((j) => !L.solid[j] && L.door[j] < 0);
                if (out !== undefined) { e.x = cellX(L, out); e.z = cellZ(L, out); e.y = L.floor[out]; }
            }
        }
        if (was === 0 && G.doorOpen[d] > 0) ev(G, 'door', { id: d, open: true, key: door.key });
        if (was > 0 && G.doorOpen[d] === 0) ev(G, 'door', { id: d, open: false, key: door.key });
    }
}

/** Flow fields are a pure function of the player's cell and the doors that block, so a loaded
 *  game recomputes exactly the fields the saved one had. */
function refreshFlow(G) {
    const L = G.L, p = G.player;
    const c = cellAt(L, p.x, p.z);
    let sig = c;
    for (let d = 0; d < L.doors.length; d++) sig = sig * 2 + (G.doorOpen[d] >= 0.9 ? 1 : 0);
    if (sig === G.flowSig && G.flowWalk) return;
    G.flowSig = sig;
    G.flowWalk = flowField(G, c, false, G.flowWalk);
    G.flowFly = flowField(G, c, true, G.flowFly);
}

function stepTriggers(G, dt) {
    const L = G.L, p = G.player;
    const c = cellAt(L, p.x, p.z);
    const inExitRoom = c >= 0 && L.room[c] === L.exitRoom;
    const lockExit = (on) => { for (const d of L.doors) if (d.room === L.exitRoom) G.doorLock[d.id] = on; };

    // ambush: walking into the exit room teleports a wave in and locks the doors
    if (G.ambush === 'idle' && inExitRoom && c !== -1) {
        const r = L.rooms[L.exitRoom];
        const inside = (p.x / CELL > r.x + 0.5 && p.x / CELL < r.x + r.w - 0.5 && p.z / CELL > r.y + 0.5 && p.z / CELL < r.y + r.h - 0.5);
        if (inside) {
            G.ambush = 'active';
            lockExit(true);
            let n = 0;
            for (const s of L.ambush) for (let k = 0; k < s.n; k++) {
                const spot = findSpot(G, (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL, 2, Math.min(r.w, r.h) * CELL * 0.45);
                if (!spot) continue;
                const e = spawnEnemy(G, s.type, spot.x, spot.z, { alert: true, ambush: true });
                n++;
                ev(G, 'spawn', { x: e.x, y: e.y, z: e.z, etype: e.type });
            }
            G.ambushLeft = n;
            ev(G, 'ambush', { n });
            updateObjective(G);
        }
    }
    // ambushers and summons that lose you for long come back through the walls
    if (G.ambush === 'active' || G.bossState === 'active') {
        for (const e of G.enemies) {
            if (e.dead || e.boss || !(e.ambush || e.summoned) || e.lostT < 8) continue;
            const s = findSpot(G, p.x, p.z, 5, 12);
            if (!s) continue;
            e.x = s.x; e.z = s.z; e.y = L.floor[s.c] + (e.def.fly ? 2 : 0); e.lostT = 0; e.vx = e.vz = 0;
            ev(G, 'spawn', { x: e.x, y: e.y, z: e.z, etype: e.type });
        }
    }
    if (G.ambush === 'active' && !G.enemies.some((e) => e.ambush && !e.dead)) G.ambushLeft = 0;
    if (G.ambush === 'active' && G.ambushLeft <= 0) {
        G.ambush = 'done';
        lockExit(false);
        ev(G, 'ambushClear', {});
        updateObjective(G);
    }

    // boss
    if (G.bossState === 'idle' && inExitRoom) {
        const r = L.rooms[L.exitRoom];
        const inside = (p.x / CELL > r.x + 1 && p.x / CELL < r.x + r.w - 1 && p.z / CELL > r.y + 1 && p.z / CELL < r.y + r.h - 1);
        if (inside) {
            G.bossState = 'active';
            lockExit(true);
            const b = spawnBoss(G, L.boss, r);
            G.bossId = b.id;
            updateObjective(G);
        }
    }
    // supply drops keep a boss fight from running dry
    if (G.bossState === 'active') {
        G.supplyT = (G.supplyT ?? 10) - dt;
        if (G.supplyT <= 0) {
            G.supplyT = 15;
            const r = L.rooms[L.exitRoom];
            const s = findSpot(G, (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL, 3, Math.min(r.w, r.h) * CELL * 0.4);
            const guns = p.weapons.filter((g) => !g.infinite);
            const kind = guns.length && G.rng() < 0.75 ? guns[Math.floor(G.rng() * guns.length)].ammo : G.rng.pick(['cola', 'burger', 'vest']);
            if (s) { dropPickup(G, kind, s.x, L.floor[s.c], s.z); ev(G, 'supply', { x: s.x, y: L.floor[s.c], z: s.z }); }
        }
    }
    if (G.bossState === 'active' && !G.enemies.some((e) => e.id === G.bossId && !e.dead)) {
        G.bossState = 'dead';
        lockExit(false);
        G.exitOpen = true;
        // the boss drops its legendary
        const leg = G.bossDef.legendary;
        if (leg) {
            G.pickups.push({ id: G.nextId++, kind: 'gun', x: cellX(L, L.exitCell) + 1, z: cellZ(L, L.exitCell), y: L.floor[L.exitCell], cell: L.exitCell, gun: legendaryFor(leg, G.level) });
        }
        ev(G, 'bossDead', { name: G.bossDef.name });
        if (L.boss === 'rourke') G.wonT = 4;
        updateObjective(G);
    }
    if (G.wonT > 0) {
        G.wonT -= dt;
        if (G.wonT <= 0) {
            G.phase = 'won';
            G.stats.levels[G.level] = { ...G.tally, time: G.lt };
            ev(G, 'won', {});
        }
        return;
    }

    // the exit
    if (G.exitOpen && G.ambush !== 'active' && L.boss !== 'rourke') {
        const ex = cellX(L, L.exitCell), ez = cellZ(L, L.exitCell);
        if ((p.x - ex) ** 2 + (p.z - ez) ** 2 < 1.4 * 1.4 && Math.abs(p.y - L.floor[L.exitCell]) < 1.5) {
            G.phase = 'clear';
            G.stats.kills += G.tally.kills;
            G.stats.style += G.tally.style;
            ev(G, 'clear', { tally: tallyOf(G) });
        }
    }
}


export function tallyOf(G) {
    const t = G.tally;
    const killPct = G.totalEnemies ? t.kills / G.totalEnemies : 1;
    const score = killPct * 40 + G.tapes[G.level].filter(Boolean).length / 3 * 25 + Math.min(1, t.style / 25000) * 25 + (t.deaths === 0 ? 10 : 0);
    const rank = score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';
    const word = { S: 'TUBULAR!', A: 'RADICAL!', B: 'GNARLY', C: 'BOGUS', D: 'GAG ME' }[rank];
    return { kills: t.kills, total: G.totalEnemies, tapes: G.tapes[G.level].filter(Boolean).length, time: G.lt, style: t.style, gibs: t.gibs, deaths: t.deaths, rank, word, level: G.level, name: LEVELS[G.level].name };
}

export function tapeText(level, i) { return TAPES[level][i]; }

// ==================================================================== save

const TRANSIENT = new Set(['rng', 'events', 'L', 'flowWalk', 'flowFly', 'flowSig']);

export function serialize(G) {
    const out = { rngState: G.rng.state() };
    for (const k of Object.keys(G)) if (!TRANSIENT.has(k)) out[k] = G[k];
    out.enemies = G.enemies.map(({ def, ...e }) => e);
    return JSON.parse(JSON.stringify(out));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = JSON.parse(JSON.stringify(d));
    const G = { ...rest, rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    Object.defineProperty(G, 'diff', { get() { return DIFFICULTY[this.diffIndex]; }, enumerable: false });
    G.L = generateLevel(G.seed, G.level, G.diff);
    for (const e of G.enemies) e.def = e.boss && !e.pylon ? G.bossDef : defOf(e.type, G);
    G.flowSig = -1;
    return G;
}

export { ENEMIES, LEVELS };
