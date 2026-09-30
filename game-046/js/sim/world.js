/**
 * world.js — a whole Quiverspire run as a pure, seeded simulation.
 *
 * No three.js, no DOM, no Math.random: dev/simtest.mjs plays whole chapters
 * headlessly with the bot, and a seed replays a run exactly.
 *
 * Phases:
 *   fight   enemies alive, door shut, the player shoots when standing still
 *   clear   room won: loot vacuums in, door opens, walk out the top
 *   choice  paused on a card pick (level-up, starting blessing, angel, devil)
 *   exit    walking through the door (short beat, then the next room)
 *   dead    game over         won   chapter cleared
 *
 * Public API: createRun, stepWorld, choose, runRewards, stageLabel.
 */

import {
    ROOM, PLAYER, CHAPTERS, STAGE_PLAN, ENEMIES, ENEMY_UNLOCK, BOSS_ORDER, DEVIL_CHANCE, COIN,
    difficulty, xpToNext,
} from '../config.js';
import { makeRng, hashSeed } from './rng.js';
import { generateRoom } from './roomgen.js';
import { flowField, wideTiles, flyable, colOf, rowOf, walkable, cellAt, cellX, cellY, resolveCircle, FLOOR, ROCK, SPIKE } from './grid.js';
import { rollAbilities, rollDevil, grantAbility, devilDeal, healPlayer, recalcStats } from './abilities.js';
import {
    updatePlayerAttack, updateArrows, updateBullets, updateHazards, updatePickups, updateOrbits,
    updateSpirits, tickStatus, hurtPlayer,
} from './combat.js';
import { makeEnemy, thinkEnemy, canContact, contactMul } from './enemies.js';
import { makeBoss, thinkBoss } from './bosses.js';

const emit = (w, type, data) => w.fxQueue.push({ type, ...data });

// ------------------------------------------------------------------ Run setup

/**
 * @param {{seed:number, chapter?:number, endless?:boolean, talents?:Object}} o
 */
export function createRun(o) {
    const chapter = Math.max(1, Math.min(CHAPTERS.length, o.chapter ?? 1));
    const w = {
        seed: o.seed >>> 0,
        rng: makeRng(hashSeed(o.seed, 77)),
        talents: { ...(o.talents ?? {}) },
        endless: !!o.endless,
        chapter,                    // chapter whose look & enemy mix is in play
        diffChapter: chapter,       // chapter number used for difficulty (grows in endless)
        chapterDef: CHAPTERS[chapter - 1],
        stage: 0,                   // index into STAGE_PLAN
        stageNum: 1,                // 1-based count of rooms entered this run
        cycle: 0,
        diff: difficulty(chapter, 0),
        room: null, grid: null,
        flow: null, flowCell: -1,
        player: null,
        enemies: [], arrows: [], bullets: [], hazards: [], pickups: [],
        boss: null, shrine: null,
        phase: 'fight', resume: 'fight', choice: null, pendingLevels: 0,
        exitT: 0, clearT: 0, roomTime: 0, time: 0,
        coins: 0,
        nextId: 1,
        fxQueue: [],
        stats: { kills: 0, dmgDealt: 0, dmgTaken: 0, bossKills: 0, rooms: 0, hits: 0 },
        result: null,
    };
    w.player = {
        x: 0, y: ROOM.spawnY, r: PLAYER.r, face: Math.PI / 2, moving: false,
        hp: 1, level: 1, xp: 0, ab: {}, picked: [], devilMul: 1, extraLife: false,
        stat: {}, atkT: 0, invuln: 0, volleys: [], target: 0, shootT: -9, hurtT: -9,
        starT: 0, starOn: false, aegisT: 0, spikeT: 0, dead: false, vx: 0, vy: 0, kx: 0, ky: 0,
    };
    recalcStats(w);
    w.player.hp = w.player.stat.maxHp;
    enterRoom(w);
    // Archero-style opening blessing: one free ability before the first fight.
    openChoice(w, 'start', rollAbilities(w, 3));
    return w;
}

export function stageLabel(w) {
    return w.endless ? `${w.stageNum}` : `${w.chapter}-${w.stage + 1}`;
}

function enemyPool(w) {
    const n = Math.min(ENEMY_UNLOCK.length, w.chapter);
    const pool = {};
    for (let i = 0; i < n; i++) for (const t of ENEMY_UNLOCK[i]) pool[t] = 1;
    // Older types fade a little; this chapter's favourites are common.
    for (const t of ENEMY_UNLOCK[n - 1]) pool[t] = 1.4;
    for (const t of w.chapterDef.favored) pool[t] = (pool[t] ?? 0.6) + 1.6;
    return pool;
}

function enterRoom(w) {
    const kind = STAGE_PLAN[w.stage];
    w.room = generateRoom(hashSeed(w.seed, w.chapter, w.stageNum, w.cycle), kind, w.chapterDef.gen);
    w.room.biome = w.chapterDef.biome;
    w.grid = w.room.grid;
    w.enemies = []; w.arrows = []; w.bullets = []; w.hazards = []; w.pickups = [];
    w.boss = null; w.shrine = null;
    w.flowCell = -1;
    w.wideAllow = wideTiles(w.grid);
    w.roomTime = 0;
    w.clearT = 0;
    w.diff = difficulty(w.diffChapter, w.stage);
    const p = w.player;
    p.x = 0; p.y = ROOM.spawnY; p.face = Math.PI / 2; p.volleys.length = 0; p.atkT = 0; p.kx = p.ky = 0;
    p.invuln = Math.max(p.invuln, 0.8);
    updateFlow(w);

    if (kind === 'combat') spawnCombat(w);
    else if (kind === 'miniboss') spawnMiniboss(w);
    else if (kind === 'boss') makeBoss(w, BOSS_ORDER[(w.chapter - 1) % BOSS_ORDER.length], 0, w.grid.rows - 4);
    else if (kind === 'angel') w.shrine = { kind: 'angel', x: 0, y: w.grid.rows * 0.62, used: false };

    w.phase = kind === 'angel' ? 'clear' : 'fight';
    w.grid.doorOpen = false;
    emit(w, 'roomEnter', { kind, stage: w.stage, stageNum: w.stageNum, label: stageLabel(w) });
}

/** Wide tiles connected to the entrance, so a golem spawned there can always reach the player. */
function wideMask(g) {
    const m = wideTiles(g);
    const seen = new Uint8Array(m.length), q = [colOf(0) + g.cols];
    seen[q[0]] = 1;
    while (q.length) {
        const i = q.pop(), c = i % g.cols, r = (i / g.cols) | 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nc = c + dc, nr = r + dr, j = nr * g.cols + nc;
            if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows || seen[j] || !m[j]) continue;
            seen[j] = 1; q.push(j);
        }
    }
    return seen;
}

/** Reachable, spread-out spawn points away from the entrance. */
function spawnPoints(w, n, fly, wide = false) {
    const g = w.grid;
    const reach = flowField(g, colOf(0), rowOf(ROOM.spawnY));
    const wideOk = wide ? wideMask(g) : null;
    const cand = [];
    for (let r = 5; r < g.rows - 1; r++) {
        for (let c = 0; c < g.cols; c++) {
            const t = cellAt(g, c, r);
            const ok = fly ? t !== ROCK : (walkable(t) && t !== SPIKE && reach[r * g.cols + c] < 9999 && (!wide || wideOk[r * g.cols + c]));
            if (ok) cand.push({ x: cellX(c), y: cellY(r) });
        }
    }
    if (!cand.length && wide) return spawnPoints(w, n, fly, false);
    w.rng.shuffle(cand);
    const out = [];
    for (const c of cand) {
        if (out.length >= n) break;
        if (out.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > 1.6)) out.push(c);
    }
    while (out.length < n && cand.length) out.push(cand[out.length % cand.length]);
    return out;
}

const isWide = (t, elite) => ENEMIES[t].r * (elite ? 1.45 : 1) > 0.5;

function spawnCombat(w) {
    const pool = enemyPool(w);
    let budget = w.diff.budget * w.rng.range(0.9, 1.15);
    const picks = [];
    while (budget > 0.5 && picks.length < 14) {
        const t = w.rng.weighted(pool);
        const cost = ENEMIES[t].cost;
        if (cost > budget + 0.6) { if (budget < 1) break; continue; }
        picks.push(t);
        budget -= cost;
    }
    const ground = picks.filter((t) => !ENEMIES[t].fly && !isWide(t)), air = picks.filter((t) => ENEMIES[t].fly);
    const wide = picks.filter((t) => !ENEMIES[t].fly && isWide(t));
    const gp = spawnPoints(w, ground.length, false), ap = spawnPoints(w, air.length, true), wp = spawnPoints(w, wide.length, false, true);
    ground.forEach((t, i) => makeEnemy(w, t, gp[i].x, gp[i].y));
    wide.forEach((t, i) => makeEnemy(w, t, wp[i].x, wp[i].y));
    air.forEach((t, i) => makeEnemy(w, t, ap[i].x, ap[i].y));
}

function spawnMiniboss(w) {
    const pool = enemyPool(w);
    delete pool.bat;
    const type = w.rng.weighted(pool);
    const fly = !!ENEMIES[type].fly;
    // Elites are wide: spawn them in the open, as high up the room as the layout allows.
    const pts = spawnPoints(w, 12, fly, !fly && isWide(type, true));
    const p = pts.reduce((a, q) => (q.y > a.y ? q : a), pts[0] ?? { x: 0, y: w.grid.rows - 4 });
    const e = makeEnemy(w, type, p.x, p.y, { elite: true, spawnT: 1.2 });
    resolveCircle(w.grid, e, e.r, e.fly);
    emit(w, 'eliteSpawn', { id: e.id, type });
    // A few minions.
    let budget = w.diff.budget * 0.35;
    while (budget >= 1) {
        const t = w.rng.pick(['slime', 'bat', 'archer', 'plant'].filter((k) => pool[k] || k === 'bat'));
        budget -= ENEMIES[t].cost;
        const q = spawnPoints(w, 1, !!ENEMIES[t].fly)[0];
        if (q) makeEnemy(w, t, q.x, q.y);
    }
}

function updateFlow(w) {
    const p = w.player;
    const c = colOf(p.x), r = rowOf(p.y);
    const idx = r * w.grid.cols + c;
    if (idx === w.flowCell && w.flow) return;
    w.flowCell = idx;
    const tc = Math.max(0, Math.min(w.grid.cols - 1, c)), tr = Math.max(0, Math.min(w.grid.rows - 1, r));
    w.flow = flowField(w.grid, tc, tr, w.flow);
    w.flowWide = flowField(w.grid, tc, tr, w.flowWide, w.wideAllow);
    w.flowAir = flowField(w.grid, tc, tr, w.flowAir, null, flyable);
}

// ------------------------------------------------------------------ Choices

function openChoice(w, kind, options) {
    if (!options.length) return false;
    w.resume = w.phase === 'choice' ? w.resume : w.phase;
    w.phase = 'choice';
    w.choice = { kind, options };
    emit(w, 'choice', { kind });
    return true;
}

/**
 * Resolve the open choice with one of its options (ability id, 'heal',
 * or 'refuse' for the devil).
 */
export function choose(w, id) {
    const ch = w.choice;
    if (!ch || w.phase !== 'choice') return;
    if (!ch.options.includes(id) && id !== 'refuse') id = ch.options[0];
    if (ch.kind === 'level' || ch.kind === 'start') {
        grantAbility(w, id);
        if (ch.kind === 'level') w.pendingLevels--;
    } else if (ch.kind === 'angel') {
        if (id === 'heal') healPlayer(w, w.player.stat.maxHp * 0.4);
        else grantAbility(w, id);
        w.shrine.used = true;
        openDoor(w);
    } else if (ch.kind === 'devil') {
        if (id !== 'refuse') devilDeal(w, id);
        w.shrine.used = true;
    }
    emit(w, 'chosen', { kind: ch.kind, id });
    w.choice = null;
    w.phase = w.resume;
}

function openDoor(w) {
    if (w.grid.doorOpen) return;
    w.grid.doorOpen = true;
    emit(w, 'doorOpen', {});
}

// ------------------------------------------------------------------ Step

/**
 * @param {{mx:number, my:number}} input  analogue move vector, |m| ≤ 1
 */
export function stepWorld(w, input, dt) {
    if (w.phase === 'choice' || w.phase === 'dead' || w.phase === 'won') return;
    w.time += dt;
    w.roomTime += dt;
    const p = w.player;

    if (w.phase === 'exit') {
        p.y += p.stat.speed * 0.8 * dt;
        w.exitT -= dt;
        if (w.exitT <= 0) nextStage(w);
        return;
    }

    // --- Player movement ---
    let mx = input.mx || 0, my = input.my || 0;
    const mag = Math.hypot(mx, my);
    const moving = mag > 0.15;
    const ox = p.x, oy = p.y;
    if (moving) {
        const k = Math.min(1, mag) / mag;
        p.x += mx * k * p.stat.speed * dt;
        p.y += my * k * p.stat.speed * dt;
        resolveCircle(w.grid, p, p.r, false);
        p.face = Math.atan2(my, mx);
    }
    if (p.kx || p.ky) {
        p.x += p.kx * dt; p.y += p.ky * dt;
        resolveCircle(w.grid, p, p.r, false);
        const f = Math.pow(0.001, dt);
        p.kx *= f; p.ky *= f;
        if (Math.abs(p.kx) + Math.abs(p.ky) < 0.05) p.kx = p.ky = 0;
    }
    p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
    p.moving = moving;
    updateFlow(w);

    // --- Player timers ---
    if (p.invuln > 0) p.invuln -= dt;
    if (p.ab.star) {
        p.starT += dt;
        const was = p.starOn;
        p.starOn = (p.starT % 10) > 8;
        if (p.starOn && !was) emit(w, 'star', {});
    }
    if (p.ab.aegis && p.aegisT > 0) {
        p.aegisT -= dt;
        if (p.aegisT <= 0) emit(w, 'aegisReady', {});
    }
    if (p.spikeT > 0) p.spikeT -= dt;
    if (w.phase === 'fight' && cellAt(w.grid, colOf(p.x), rowOf(p.y)) === SPIKE && spikesUp(w) && p.spikeT <= 0) {
        p.spikeT = 0.8;
        if (hurtPlayer(w, p.stat.maxHp * 0.08, { kind: 'spikes', short: true })) emit(w, 'spikes', { x: p.x, y: p.y });
    }

    // --- Attacks ---
    updatePlayerAttack(w, dt, moving);
    updateSpirits(w, dt);
    updateArrows(w, dt);
    updateOrbits(w, dt);

    // --- Enemies ---
    for (const e of w.enemies) {
        if (!e.alive) continue;
        const sm = tickStatus(w, e, dt);
        if (!e.alive) continue;
        if (e.frozenT > 0) continue;
        if (e.boss) thinkBoss(w, e, dt, sm); else thinkEnemy(w, e, dt, sm);
        if (canContact(e) && !p.dead) {
            const rr = e.r + p.r * 0.85;
            if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr && hurtPlayer(w, e.contact * contactMul(e), { kind: 'contact' }) === true) {
                // Knock the player clear of the body that hit them.
                const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
                const push = e.boss || e.elite ? 5.5 : 4;
                p.kx = ((p.x - e.x) / d || 0) * push;
                p.ky = ((p.y - e.y) / d || 1) * push;
            }
        }
    }
    separateEnemies(w);
    w.enemies = w.enemies.filter((e) => e.alive);

    updateBullets(w, dt);
    updateHazards(w, dt);
    updatePickups(w, dt);

    if (p.dead) {
        w.phase = 'dead';
        w.result = 'dead';
        return;
    }

    // --- Room flow ---
    if (w.phase === 'fight' && w.enemies.length === 0) {
        w.phase = 'clear';
        w.clearT = 0;
        w.stats.rooms++;
        w.bullets.length = 0;
        w.hazards.length = 0;
        const kind = w.room.kind;
        emit(w, 'roomClear', { kind });
        openDoor(w);
        const last = !w.endless && w.stage === STAGE_PLAN.length - 1;
        if ((kind === 'miniboss' || kind === 'boss') && !last && w.rng.chance(DEVIL_CHANCE)) {
            w.shrine = { kind: 'devil', x: 0, y: Math.min(w.grid.rows - 3, w.grid.rows * 0.7), used: false };
            emit(w, 'devilAppears', {});
        }
    }
    if (w.phase === 'clear') {
        w.clearT += dt;
        const xpLeft = w.pickups.some((k) => k.kind === 'xp');
        if (w.pendingLevels > 0 && (!xpLeft || w.clearT > 2.5) && w.clearT > 0.5) {
            // Deep in Endless every ability can be maxed out: a hearty meal is always on offer.
            const opts = rollAbilities(w, 3);
            openChoice(w, 'level', opts.length ? opts : ['heal']);
            return;
        }
        const s = w.shrine;
        if (s && !s.used && Math.hypot(p.x - s.x, p.y - s.y) < 1.25) {
            if (s.kind === 'angel') {
                const gift = rollAbilities(w, 3).find((id) => id !== 'heal');
                openChoice(w, 'angel', gift ? ['heal', gift] : ['heal']);
            } else {
                const opts = rollDevil(w);
                if (opts.length) openChoice(w, 'devil', opts);
                else s.used = true;                 // nothing left to sell: the Devil leaves
            }
            return;
        }
        if (w.grid.doorOpen && w.pendingLevels === 0 && p.y > w.grid.rows + 0.15) {
            w.phase = 'exit';
            w.exitT = 0.55;
            emit(w, 'roomExit', {});
        }
    }
}

export const spikesUp = (w) => (w.time % 2.4) < 1.1;

function separateEnemies(w) {
    const es = w.enemies;
    for (let i = 0; i < es.length; i++) {
        const a = es[i];
        if (!a.alive || a.burrowed) continue;
        for (let j = i + 1; j < es.length; j++) {
            const b = es[j];
            if (!b.alive || b.burrowed || a.fly !== b.fly) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const rr = (a.r + b.r) * 0.9;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr || d2 < 1e-8) continue;
            const d = Math.sqrt(d2), push = (rr - d) * 0.5;
            const ux = dx / d, uy = dy / d;
            const wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1;
            a.x -= ux * push * wa; a.y -= uy * push * wa;
            b.x += ux * push * wb; b.y += uy * push * wb;
            resolveCircle(w.grid, a, a.r, a.fly);
            resolveCircle(w.grid, b, b.r, b.fly);
        }
    }
}

function nextStage(w) {
    if (!w.endless && w.stage === STAGE_PLAN.length - 1) {
        w.phase = 'won';
        w.result = 'clear';
        emit(w, 'chapterClear', { chapter: w.chapter });
        return;
    }
    w.stage++;
    w.stageNum++;
    if (w.stage >= STAGE_PLAN.length) {
        // Endless: the next floor of the spire — a new biome, one notch harder.
        w.stage = 0;
        w.cycle++;
        w.chapter = (w.cycle % CHAPTERS.length) + 1;
        w.chapterDef = CHAPTERS[w.chapter - 1];
        w.diffChapter = 1 + w.cycle * 1.5;      // chapter-10 strength by floor 7, exponential after (config.difficulty)
        emit(w, 'floorUp', { chapter: w.chapter, cycle: w.cycle });
    }
    enterRoom(w);
}

// ------------------------------------------------------------------ Rewards

/** Coins banked at the end of a run (greed applies; a clear adds a bonus). */
export function runRewards(w) {
    const stages = w.stats.rooms;
    let coins = w.coins + stages * COIN.perStage * (1 + Math.floor(w.diffChapter / 2));
    if (w.result === 'clear') coins += COIN.chapterClear * w.chapter;
    return Math.round(coins * (1 + 0.1 * (w.talents.greed || 0)));
}

export { xpToNext, FLOOR };
