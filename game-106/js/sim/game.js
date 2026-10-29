// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// A run: survive ROUND.seconds in an electrified maze while robots pour in through the doors.
// The laser fires on its own at the nearest robot; robots drop data chips; chips level you up and
// every level offers three upgrades (G.choice — the sim waits until choose() is called). Every
// SECTOR.seconds the room is purged and rebuilt, and late in each sector the Grinner comes.

import { FIELD, PLAYER, ROUND, SECTOR, WALL, LASER, ORBIT, PULSE, ROBOTS, SPAWN, BOLT, GRINNER, XP, CHIP, UPGRADES } from '../config.js';
import { makeRng } from '../rng.js';
import { makeMaze, doors, pushOut, circleRect, pointInRect, lineOfSight } from './maze.js';
import { flowField, flowDir, clearPath } from './nav.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;

export function newGame(seed = 1) {
    const rng = makeRng(seed);
    const G = {
        v: 1,                       // save format version
        seed,
        rng,
        t: 0,                       // run time
        st: 0,                      // time in this sector
        sector: 1,
        score: 0,
        kills: 0,
        over: false,
        win: false,
        nid: 1,
        player: {
            x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0, kx: 0, ky: 0, fx: 1, fy: 0,
            hp: PLAYER.hp, maxHp: PLAYER.hp, inv: 0, dash: 0, dashCool: 0, fireT: 0.3, pulseT: PULSE.cool,
        },
        xp: 0, level: 1, pending: 0,
        choice: null,               // { options: [upgrade ids] } while a level-up waits for choose()
        up: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
        walls: [],
        robots: [],
        lasers: [],
        bolts: [],
        chips: [],
        grinner: null,
        spawnT: 1.2,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    G.walls = makeMaze(rng, [{ x: G.player.x, y: G.player.y, r: 2.5 }]);
    return G;
}

// ------------------------------------------------------------------ derived stats
export function stats(G) {
    const u = G.up;
    return {
        laserCool: LASER.cool * 0.82 ** u.rate,
        laserCount: 1 + u.split,
        pierce: u.pierce,
        dmg: LASER.dmg * (1 + 0.3 * u.power),
        discs: u.orbit,
        pulse: u.pulse,
        pulseR: PULSE.radius * (1 + 0.25 * Math.max(0, u.pulse - 1)),
        pulseCool: PULSE.cool * 0.88 ** Math.max(0, u.pulse - 1),
        speed: PLAYER.speed * (1 + 0.1 * u.speed),
        magnet: PLAYER.magnet * (1 + 0.6 * u.magnet),
    };
}
export const xpNeed = (level) => Math.round(XP.base * XP.grow ** (level - 1));

/** Advance one fixed step. inp = { x, y, a }: x and y in [-1, 1] (y down), a = dash pressed since the last step. */
export function step(G, inp, dt) {
    if (G.over || G.choice) return;             // a level-up waits for choose()
    G.t += dt;
    G.st += dt;
    const S = stats(G);
    movePlayer(G, inp, dt, S);
    spawnRobots(G, dt);
    moveRobots(G, dt);
    fireLaser(G, dt, S);
    moveLasers(G, dt, S);
    discsAndPulse(G, dt, S);
    moveBolts(G, dt);
    moveGrinner(G, dt);
    collectChips(G, dt, S);
    if (G.player.hp <= 0) return end(G, false);
    if (G.t >= ROUND.seconds) return end(G, true);
    if (G.st >= SECTOR.seconds) nextSector(G);
    if (G.pending > 0 && !G.choice) offerChoice(G);
}

function end(G, win) {
    G.over = true;
    G.win = win;
    if (win) G.score += 5000 + Math.round(G.player.hp) * 20;
    G.events.push({ type: 'over', win, score: G.score });
}

// ------------------------------------------------------------------ player
function movePlayer(G, inp, dt, S) {
    const p = G.player;
    const len = Math.hypot(inp.x, inp.y);
    const k = len > 1 ? 1 / len : 1;             // diagonals are not faster
    if (len > 0.2) { p.fx = inp.x / len; p.fy = inp.y / len; }
    p.dashCool = Math.max(0, p.dashCool - dt);
    if (inp.a && p.dashCool <= 0) {
        p.dash = PLAYER.dash; p.dashCool = PLAYER.dashCool;
        G.events.push({ type: 'dash', x: p.x, y: p.y });
    }
    const dashing = p.dash > 0;
    p.dash = Math.max(0, p.dash - dt);
    p.inv = Math.max(0, p.inv - dt);
    if (dashing && len < 0.2) { p.vx = p.fx * S.speed * PLAYER.dashMul; p.vy = p.fy * S.speed * PLAYER.dashMul; }
    else { const sp = S.speed * (dashing ? PLAYER.dashMul : 1); p.vx = inp.x * k * sp; p.vy = inp.y * k * sp; }
    p.x += (p.vx + p.kx) * dt;
    p.y += (p.vy + p.ky) * dt;
    const decay = Math.exp(-dt * 8);
    p.kx *= decay; p.ky *= decay;
    p.x = clamp(p.x, PLAYER.radius, FIELD.w - PLAYER.radius);
    p.y = clamp(p.y, PLAYER.radius, FIELD.h - PLAYER.radius);
    for (const w of G.walls) {
        const push = pushOut(p.x, p.y, PLAYER.radius, w);
        if (!push) continue;
        p.x += push.x; p.y += push.y;
        if (p.inv <= 0 && !dashing) {
            const l = Math.hypot(push.x, push.y) || 1;
            p.kx = (push.x / l) * WALL.knock; p.ky = (push.y / l) * WALL.knock;
            hurt(G, WALL.touch, 'zap');
        }
    }
}

function hurt(G, dmg, cause) {
    const p = G.player;
    if (p.inv > 0 || p.dash > 0 || G.over) return;
    p.hp = Math.max(0, p.hp - dmg);
    p.inv = PLAYER.iframes;
    G.events.push({ type: 'hurt', x: p.x, y: p.y, dmg, cause });
}

// ------------------------------------------------------------------ robots
function spawnRobots(G, dt) {
    G.spawnT -= dt;
    if (G.spawnT > 0) return;
    const ramp = 0.86 ** (G.sector - 1) * (1 - 0.35 * Math.min(1, G.st / SECTOR.seconds));
    G.spawnT = Math.max(SPAWN.min, SPAWN.every * ramp);
    if (G.robots.length >= SPAWN.cap) return;
    const p = G.player;
    const open = doors().filter((d) => Math.hypot(d.x - p.x, d.y - p.y) > 5);
    const door = G.rng.pick(open.length ? open : doors());
    const kinds = Object.keys(ROBOTS).filter((k) => ROBOTS[k].from <= G.sector);
    const weight = { drone: 6, hunter: 3, gunner: 2, brute: 1 };
    const n = Math.min(SPAWN.burst + G.sector - 1, SPAWN.cap - G.robots.length);
    let brutes = 0;
    for (let i = 0; i < n; i++) {
        let kind = pickWeighted(G.rng, kinds, weight);
        if (kind === 'brute' && brutes++ > 0) kind = 'drone';
        addRobot(G, kind, door);
    }
}

function pickWeighted(rng, keys, w) {
    let sum = 0;
    for (const k of keys) sum += w[k];
    let r = rng() * sum;
    for (const k of keys) { r -= w[k]; if (r < 0) return k; }
    return keys[keys.length - 1];
}

function addRobot(G, kind, door) {
    const R = ROBOTS[kind];
    const along = (G.rng() - 0.5) * 1.8;
    const x = door.side < 2 ? door.x + along : door.x;
    const y = door.side < 2 ? door.y : door.y + along;
    const hpMul = 1 + SPAWN.hpGrow * (G.sector - 1);
    G.robots.push({ id: G.nid++, kind, x, y, kx: 0, ky: 0, hp: R.hp * hpMul, maxHp: R.hp * hpMul, zap: 0, oT: 0, fT: (R.fire || 0) * G.rng(), hitT: 0 });
}

function moveRobots(G, dt) {
    const p = G.player;
    const list = G.robots;
    // a coarse grid keeps the crowd separation cheap with a hundred robots on screen
    const cell = 1.6, grid = new Map();
    for (let i = 0; i < list.length; i++) {
        const r = list[i], key = ((r.x / cell) | 0) * 64 + ((r.y / cell) | 0);
        let b = grid.get(key);
        if (!b) grid.set(key, b = []);
        b.push(i);
    }
    const decay = Math.exp(-dt * 6);
    // robots steer round the walls: straight at you when the way is clear, else down the flood from you
    const field = list.length ? flowField(G.walls, p.x, p.y) : null;
    for (let i = 0; i < list.length; i++) {
        const r = list[i], R = ROBOTS[r.kind];
        const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy) || 1;
        let mx = dx / d, my = dy / d;
        let closing = true;
        if (r.kind === 'gunner') {
            if (d < R.keep - 1) { mx = -mx; my = -my; closing = false; }
            else if (d < R.keep + 1.5) { const s = (r.id & 1) ? 1 : -1; [mx, my] = [-my * s, mx * s]; closing = false; }
            r.fT -= dt;
            if (r.fT <= 0 && d < 13) {
                r.fT = R.fire;
                if (lineOfSight(G.walls, r.x, r.y, p.x, p.y)) {
                    G.bolts.push({ x: r.x, y: r.y, vx: (dx / d) * BOLT.speed, vy: (dy / d) * BOLT.speed, ttl: BOLT.ttl });
                    G.events.push({ type: 'bolt', x: r.x, y: r.y });
                }
            }
        }
        if (closing && !clearPath(G.walls, r.x, r.y, p.x, p.y, R.r)) {
            const f = flowDir(field, r.x, r.y);
            if (f) { mx = f.x; my = f.y; }
        }
        // and a shove off any wall they're about to graze
        for (const w of G.walls) {
            const nx = clamp(r.x, w.x, w.x + w.w), ny = clamp(r.y, w.y, w.y + w.h);
            const ex = r.x - nx, ey = r.y - ny, e = Math.hypot(ex, ey), room = R.r + 0.35;
            if (e < room && e > 1e-6) { const k = (1 - e / room) * 1.5; mx += (ex / e) * k; my += (ey / e) * k; }
        }
        const ml = Math.hypot(mx, my);
        if (ml > 1) { mx /= ml; my /= ml; }
        // separation from neighbours
        let sx = 0, sy = 0;
        const gx = (r.x / cell) | 0, gy = (r.y / cell) | 0;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const b = grid.get((gx + ox) * 64 + gy + oy);
            if (!b) continue;
            for (const j of b) {
                if (j === i) continue;
                const o = list[j], ex = r.x - o.x, ey = r.y - o.y, e2 = ex * ex + ey * ey, rr = R.r + ROBOTS[o.kind].r;
                if (e2 < rr * rr && e2 > 1e-6) { const e = Math.sqrt(e2), f = (rr - e) / e; sx += ex * f; sy += ey * f; }
            }
        }
        r.x += (mx * R.speed + r.kx) * dt + sx * 0.5;
        r.y += (my * R.speed + r.ky) * dt + sy * 0.5;
        r.kx *= decay; r.ky *= decay;
        r.x = clamp(r.x, R.r, FIELD.w - R.r);
        r.y = clamp(r.y, R.r, FIELD.h - R.r);
        r.zap = Math.max(0, r.zap - dt);
        r.oT = Math.max(0, r.oT - dt);
        r.hitT = Math.max(0, r.hitT - dt);
        // robots that blunder into the electrified walls get zapped (drones fry outright)
        for (const w of G.walls) {
            const push = pushOut(r.x, r.y, R.r, w);
            if (!push) continue;
            r.x += push.x; r.y += push.y;
            if (r.zap <= 0 && !w.outer) { r.zap = 0.5; damageRobot(G, r, WALL.robotTouch, 'wall'); }
        }
        if (d < R.r + PLAYER.radius) hurt(G, R.dmg, r.kind);
    }
    reap(G);
}

function damageRobot(G, r, dmg, by) {
    if (r.hp <= 0) return;
    r.hp -= dmg;
    r.hitT = 0.1;
    if (r.hp <= 0) {
        const R = ROBOTS[r.kind];
        G.kills++;
        G.score += R.score;
        dropChip(G, r.x, r.y, R.xp);
        G.events.push({ type: 'kill', x: r.x, y: r.y, kind: r.kind, by });
    } else G.events.push({ type: 'hit', x: r.x, y: r.y, by });
}

/** A chip, or — once the floor is crowded — more value in the nearest one, so a long run never
 *  carries hundreds of chips. */
function dropChip(G, x, y, v) {
    if (G.chips.length >= CHIP.crowd) {
        let best = null, bd = CHIP.merge * CHIP.merge;
        for (const c of G.chips) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
        if (best) { best.v += v; return; }
    }
    G.chips.push({ x, y, v });
}

function reap(G) {
    if (G.robots.some((r) => r.hp <= 0)) G.robots = G.robots.filter((r) => r.hp > 0);
}

// ------------------------------------------------------------------ weapons
function fireLaser(G, dt, S) {
    const p = G.player;
    p.fireT -= dt;
    const g = G.grinner;
    const gd = g ? Math.hypot(g.x - p.x, g.y - p.y) : Infinity;
    if (p.fireT > 0 || (!G.robots.length && gd > GRINNER.aim)) return;
    // the Grinner when it's close (lasers only knock it back); else the nearest robot in sight and
    // range; failing that, the nearest in range
    let best = gd < GRINNER.aim ? g : null, bd = best ? 0 : LASER.range * LASER.range, blind = null, bb = best ? 0 : bd;
    for (const r of G.robots) {
        const d2 = (r.x - p.x) ** 2 + (r.y - p.y) ** 2;
        if (d2 >= bb) continue;
        if (d2 < bd && lineOfSight(G.walls, p.x, p.y, r.x, r.y)) { best = r; bd = d2; }
        else if (d2 < bb) { blind = r; bb = d2; }
    }
    const t = best || blind;
    if (!t) return;
    p.fireT = S.laserCool;
    const a0 = Math.atan2(t.y - p.y, t.x - p.x);
    for (let i = 0; i < S.laserCount; i++) {
        const a = a0 + (i - (S.laserCount - 1) / 2) * LASER.spread;
        const vx = Math.cos(a) * LASER.speed, vy = Math.sin(a) * LASER.speed;
        G.lasers.push({ x: p.x, y: p.y, vx, vy, ttl: LASER.ttl, pierce: S.pierce, hit: [] });
    }
    G.events.push({ type: 'shoot', x: p.x, y: p.y, a: a0, n: S.laserCount });
}

function moveLasers(G, dt, S) {
    const g = G.grinner;
    for (const l of G.lasers) {
        l.x += l.vx * dt; l.y += l.vy * dt; l.ttl -= dt;
        if (l.x < 0 || l.y < 0 || l.x > FIELD.w || l.y > FIELD.h) { l.ttl = 0; continue; }
        if (G.walls.some((w) => pointInRect(l.x, l.y, w))) { l.ttl = 0; G.events.push({ type: 'spark', x: l.x, y: l.y }); continue; }
        if (g && Math.hypot(g.x - l.x, g.y - l.y) < GRINNER.r) {
            l.ttl = 0;
            g.kx += l.vx * GRINNER.knock; g.ky += l.vy * GRINNER.knock;
            G.events.push({ type: 'ping', x: l.x, y: l.y });
            continue;
        }
        for (const r of G.robots) {
            if (r.hp <= 0 || l.hit.includes(r.id)) continue;
            const rr = ROBOTS[r.kind].r + 0.15;
            if ((r.x - l.x) ** 2 + (r.y - l.y) ** 2 < rr * rr) {
                l.hit.push(r.id);
                damageRobot(G, r, S.dmg, 'laser');
                r.kx += l.vx * 0.08; r.ky += l.vy * 0.08;
                if (l.pierce-- <= 0) { l.ttl = 0; break; }
            }
        }
    }
    G.lasers = G.lasers.filter((l) => l.ttl > 0);
    reap(G);
}

function discsAndPulse(G, dt, S) {
    const p = G.player;
    if (S.discs) {
        for (let k = 0; k < S.discs; k++) {
            const a = G.t * ORBIT.spin + (k * TAU) / S.discs;
            const dx = p.x + Math.cos(a) * ORBIT.radius, dy = p.y + Math.sin(a) * ORBIT.radius;
            for (const r of G.robots) {
                const rr = ROBOTS[r.kind].r + ORBIT.size;
                if (r.oT <= 0 && (r.x - dx) ** 2 + (r.y - dy) ** 2 < rr * rr) { r.oT = ORBIT.hitCool; damageRobot(G, r, ORBIT.dmg * (1 + 0.15 * G.up.power), 'disc'); }
            }
        }
    }
    if (S.pulse) {
        p.pulseT -= dt;
        if (p.pulseT <= 0) {
            p.pulseT = S.pulseCool;
            G.events.push({ type: 'pulse', x: p.x, y: p.y, r: S.pulseR });
            for (const r of G.robots) {
                const dx = r.x - p.x, dy = r.y - p.y, d = Math.hypot(dx, dy) || 1;
                if (d < S.pulseR + ROBOTS[r.kind].r) {
                    r.kx += (dx / d) * PULSE.knock; r.ky += (dy / d) * PULSE.knock;
                    damageRobot(G, r, PULSE.dmg * (1 + 0.2 * (S.pulse - 1)), 'pulse');
                }
            }
            for (const b of G.bolts) if (Math.hypot(b.x - p.x, b.y - p.y) < S.pulseR) b.ttl = 0;
            const g = G.grinner;
            if (g) { const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy) || 1; if (d < S.pulseR + GRINNER.r) { g.kx += (dx / d) * PULSE.knock * 2; g.ky += (dy / d) * PULSE.knock * 2; } }
        }
    }
    reap(G);
}

function moveBolts(G, dt) {
    const p = G.player;
    for (const b of G.bolts) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt;
        if (b.x < 0 || b.y < 0 || b.x > FIELD.w || b.y > FIELD.h || G.walls.some((w) => pointInRect(b.x, b.y, w))) { b.ttl = 0; continue; }
        if (Math.hypot(b.x - p.x, b.y - p.y) < BOLT.r + PLAYER.radius && p.inv <= 0 && p.dash <= 0) { b.ttl = 0; hurt(G, BOLT.dmg, 'bolt'); }
    }
    G.bolts = G.bolts.filter((b) => b.ttl > 0);
}

// ------------------------------------------------------------------ the Grinner
function moveGrinner(G, dt) {
    const p = G.player;
    if (!G.grinner && G.sector >= 2 && G.st >= SECTOR.grinnerAt) {
        let far = null, fd = -1;
        for (const d of doors()) { const e = Math.hypot(d.x - p.x, d.y - p.y); if (e > fd) { fd = e; far = d; } }
        G.grinner = { x: far.x, y: far.y, kx: 0, ky: 0, age: 0, recoil: 0 };
        G.events.push({ type: 'grinner', x: far.x, y: far.y });
    }
    const g = G.grinner;
    if (!g) return;
    g.age += dt;
    g.recoil = Math.max(0, g.recoil - dt);
    const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(GRINNER.max, GRINNER.speed + GRINNER.accel * g.age) * (g.recoil > 0 ? -0.6 : 1);
    g.x = clamp(g.x + ((dx / d) * sp + g.kx) * dt, 0, FIELD.w);
    g.y = clamp(g.y + ((dy / d) * sp + g.ky) * dt, 0, FIELD.h);
    const decay = Math.exp(-dt * 5);
    g.kx *= decay; g.ky *= decay;
    if (d < GRINNER.r + PLAYER.radius && g.recoil <= 0) {
        const hp = p.hp;
        hurt(G, GRINNER.dmg, 'grinner');
        if (p.hp < hp) { g.recoil = GRINNER.recoil; G.events.push({ type: 'cackle', x: g.x, y: g.y }); }
    }
}

// ------------------------------------------------------------------ chips and levels
function collectChips(G, dt, S) {
    const p = G.player;
    for (const c of G.chips) {
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
        if (d < S.magnet && d > 1e-6) { const sp = Math.min(d / dt, CHIP.speed * (1.2 - d / S.magnet)); c.x += (dx / d) * sp * dt; c.y += (dy / d) * sp * dt; }
        if (Math.hypot(p.x - c.x, p.y - c.y) < PLAYER.radius + CHIP.r) {
            c.v = -c.v;                               // marked taken
            G.xp += -c.v;
            G.score += 10 * -c.v;
            G.events.push({ type: 'chip', x: c.x, y: c.y, v: -c.v });
            while (G.xp >= xpNeed(G.level)) { G.xp -= xpNeed(G.level); G.level++; G.pending++; }
        }
    }
    if (G.chips.some((c) => c.v < 0)) G.chips = G.chips.filter((c) => c.v > 0);
}

function offerChoice(G) {
    const ids = Object.keys(UPGRADES).filter((k) => k !== 'repair' && G.up[k] < UPGRADES[k].max);
    const options = [];
    while (options.length < 3 && ids.length) options.push(ids.splice(Math.floor(G.rng() * ids.length), 1)[0]);
    while (options.length < 3) options.push('repair');
    G.choice = { options };
    G.events.push({ type: 'levelup', level: G.level });
}

/** The player picked option i of G.choice. Pure, like step(). */
export function choose(G, i) {
    if (!G.choice) return false;
    const id = G.choice.options[i];
    if (!id) return false;
    const p = G.player;
    G.up[id] = Math.min(UPGRADES[id].max, G.up[id] + 1);
    if (id === 'armor') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); }
    if (id === 'repair') p.hp = Math.min(p.maxHp, p.hp + 40);
    if (id === 'pulse' && G.up.pulse === 1) p.pulseT = 0.5;
    G.choice = null;
    G.pending--;
    G.events.push({ type: 'choose', id, level: G.up[id] });
    if (G.pending > 0) offerChoice(G);
    return true;
}

// ------------------------------------------------------------------ sectors
function nextSector(G) {
    // the purge: every robot in the room blows, the room is rebuilt around the player
    for (const r of G.robots) damageRobot(G, r, 1e9, 'purge');
    G.robots = [];
    G.bolts = [];
    G.lasers = [];
    G.grinner = null;
    G.sector++;
    G.st = 0;
    G.spawnT = 2;
    const p = G.player;
    G.walls = makeMaze(G.rng, [{ x: p.x, y: p.y, r: 2.2 }]);       // chips drift through walls, so they needn't be kept clear
    G.events.push({ type: 'sector', sector: G.sector });
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
