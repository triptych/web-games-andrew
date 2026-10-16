// Act II: the flight, after Atari's Star Wars. The dragon flies forward at a fixed speed along +z
// and steers by aiming: a cursor moves across the view, fire converges on it, and the body
// drifts toward it. Three stages: open sky against griffon knights (the space battle), low over
// the ramparts burning mage towers (the surface), and down the Gorge of Chains to the ward
// stone at its end (the trench run and its exhaust port).
//
// Everything is in absolute coordinates; the dragon is at (px, py, fl.dist).

import { FLIGHT, TRACKS } from '../config.js';
import { ENEMY, FOE, STAGES } from './data.js';
import { clamp, segHits, TAU } from './util.js';
import { diff, hurt, damage, kill, newId, stageClear } from './common.js';

export function initFlight(G) {
    const def = STAGES[G.stageIdx], T = TRACKS[def.track], p = G.player;
    Object.assign(p, { ax: 0, ay: 0, px: 0, py: T.base, vx: 0, vy: 0, cd: 0, inv: 0 });
    G.fl = { track: def.track, dist: 0, len: def.length || 0, towers: 0, towersDown: 0, walks: [], spawnT: 0.5, missed: 0 };
    if (def.track === 'ramparts') buildRamparts(G);
    if (def.track === 'gorge') buildGorge(G);
}

function addStatic(G, kind, x, y, z, extra = {}) {
    const D = ENEMY[kind];
    const e = { id: newId(G), kind, x, y, z, h: 0, hp: D.hp, maxHp: D.hp, t: 0, cd: 1 + G.rng() * 2, hurtT: 0, ...extra };
    G.enemies.push(e);
    return e;
}

function buildRamparts(G) {
    const rng = G.rng, len = G.fl.len;
    let z = 150, n = 0;
    while (z < len - 90) {
        const spire = n % 7 === 6;
        // every other tower stands near the line of flight, so none of the stage is empty sky
        const x = n % 2 ? rng.range(-16, 16) : rng.range(-36, 36);
        const h = spire ? 21 : rng.range(9, 17);
        addStatic(G, spire ? 'spire' : 'tower', x, h + 1.6, z, { th: h });
        z += rng.range(26, 44);
        n++;
    }
    G.fl.towers = n;
}

function buildGorge(G) {
    const rng = G.rng, len = G.fl.len, W = TRACKS.gorge.wall;
    for (let z = 230; z < len - 280; z += rng.range(130, 175)) {
        G.fl.walks.push({ z, y: rng.pick([4.5, 9.5, 15]) });
    }
    for (let z = 120; z < len - 110; z += rng.range(36, 58)) {
        const side = rng() < 0.5 ? -1 : 1;
        addStatic(G, 'turret', side * (W - 0.8), rng.range(4, 20), z, { side });
    }
    addStatic(G, 'wardstone', 0, 10, len);
}

/** The point the cursor is on, `d` units ahead of the dragon. */
export function aimPoint(G, d = 70) {
    const p = G.player, fl = G.fl;
    return {
        x: p.px + Math.tan(p.ax * FLIGHT.aimYaw) * d,
        y: p.py + Math.tan(p.ay * FLIGHT.aimPitch) * d,
        z: fl.dist + d,
    };
}

function fireBolt(G, e, sx, sy, sz, speedMul = 1) {
    const p = G.player, fl = G.fl, F = FOE.firebolt;
    const sp = F.speed * Math.min(diff(G), 1.8) * speedMul;
    // aimed in the dragon's frame: it closes on where the dragon is, not where it was
    let dx = p.px - sx, dy = p.py - sy, dz = fl.dist - sz;
    const L = Math.hypot(dx, dy, dz) || 1;
    dx /= L; dy /= L; dz /= L;
    G.foes.push({
        id: newId(G), kind: 'firebolt', x: sx, y: sy, z: sz,
        vx: dx * sp, vy: dy * sp, vz: dz * sp + FLIGHT.speed, life: F.life, r: F.r,
    });
    G.events.push({ type: 'enemyFire', kind: e.kind, foe: 'firebolt', x: sx, y: sy, z: sz });
}

// ------------------------------------------------------------------ griffon knights (sky)
function holdParams(G, e) {
    const rng = G.rng;
    Object.assign(e, {
        mode: 'enter', cx: rng.range(-16, 16), cy: rng.range(-6, 6), hd: rng.range(55, 95),
        A: rng.range(6, 14), B: rng.range(3, 7), C: rng.range(8, 20),
        w1: rng.range(0.5, 1.1), w2: rng.range(0.7, 1.4), w3: rng.range(0.3, 0.6),
        holdT: rng.range(5, 9), side: rng() < 0.5 ? -1 : 1,
    });
}

function spawnGriffon(G, k) {
    const fl = G.fl, rng = G.rng;
    const e = addStatic(G, 'griffon', rng.range(-40, 40), rng.range(-14, 14), fl.dist + 230 + k * 18, { vx: 0, vy: 0, vz: 0, ph: rng() * TAU });
    holdParams(G, e);
    G.events.push({ type: 'spawn', kind: 'griffon', id: e.id, x: e.x, y: e.y, z: e.z });
}

function stepGriffon(G, e, dt) {
    const p = G.player, fl = G.fl, rng = G.rng, S = FLIGHT.speed, dm = diff(G);
    e.t += dt; e.cd -= dt;
    const rz = e.z - fl.dist;
    let gx, gy, gz, vmax;
    if (e.mode === 'pass') {
        gx = p.px + e.side * 7; gy = p.py + 3; gz = -40; vmax = 80;
    } else {
        gx = e.cx + e.A * Math.sin(e.w1 * e.t + e.ph);
        gy = e.cy + e.B * Math.sin(e.w2 * e.t + e.ph * 2);
        gz = e.hd + e.C * Math.sin(e.w3 * e.t);
        vmax = e.mode === 'enter' ? 70 : 34;
    }
    let vx = (gx - e.x) * 1.6, vy = (gy - e.y) * 1.6, vz = (gz - rz) * 1.6;
    const v = Math.hypot(vx, vy, vz);
    if (v > vmax) { vx *= vmax / v; vy *= vmax / v; vz *= vmax / v; }
    // ease into the new velocity, so turns are swoops and not snaps
    const k = Math.min(1, dt * 3);
    e.vx += (vx - e.vx) * k; e.vy += (vy - e.vy) * k; e.vz += (vz - e.vz) * k;
    e.x += e.vx * dt; e.y += e.vy * dt; e.z += (e.vz + S) * dt;

    if (e.mode === 'enter' && Math.abs(rz - gz) < 12) e.mode = 'hold';
    if (e.mode === 'hold') {
        e.holdT -= dt;
        if (e.holdT <= 0) { e.mode = 'pass'; G.events.push({ type: 'swoop', id: e.id }); }
        if (rz > 22 && rz < 170 && e.cd <= 0) {
            fireBolt(G, e, e.x, e.y, e.z - 2);
            e.cd = (1.9 + rng() * 1.5) / dm;
        }
    }
    const nz = e.z - fl.dist;
    if (Math.hypot(e.x - p.px, e.y - p.py, nz) < ENEMY.griffon.r + FLIGHT.radius - 0.6) {
        hurt(G, 'griffon', e.x, e.y, e.z);
        kill(G, e, 0);
        G.events.push({ type: 'crash', kind: 'griffon', x: e.x, y: e.y, z: e.z });
        return;
    }
    if (e.mode === 'pass' && nz < -24) {
        // gone past: wheel round and come back from the front
        e.z = fl.dist + 230; e.x = rng.range(-40, 40); e.y = rng.range(-14, 14);
        e.vx = e.vy = e.vz = 0;
        holdParams(G, e);
    }
}

// ------------------------------------------------------------------ towers, turrets, the ward stone
function stepStatic(G, e, dt) {
    const p = G.player, fl = G.fl, rng = G.rng, dm = diff(G);
    const rz = e.z - fl.dist;
    e.t += dt; e.cd -= dt;
    if (e.kind === 'tower' || e.kind === 'spire') {
        if (rz > 24 && rz < 140 && e.cd <= 0) {
            fireBolt(G, e, e.x, e.y + 0.5, e.z - 1.5);
            e.cd = (e.kind === 'spire' ? 1.5 : 2.3 + rng() * 1.6) / dm;
        }
        // flying into the tower's shaft
        if (!e.bumped && Math.abs(rz) < 1.6 && Math.abs(e.x - p.px) < 3.0 && p.py < e.th + 1) {
            e.bumped = true;
            hurt(G, 'tower', p.px, p.py, fl.dist);
            G.events.push({ type: 'crash', kind: e.kind, x: p.px, y: p.py, z: fl.dist });
        }
    } else if (e.kind === 'turret') {
        if (rz > 20 && rz < 120 && e.cd <= 0) {
            fireBolt(G, e, e.x - e.side * 1.2, e.y, e.z - 1, 1.1);
            e.cd = (2.2 + rng() * 1.6) / dm;
        }
    }
}

// ------------------------------------------------------------------ the dragon's fire
function stepShots(G, dt) {
    const fl = G.fl;
    const T = TRACKS[fl.track];
    for (let i = G.shots.length - 1; i >= 0; i--) {
        const s = G.shots[i];
        const ox = s.x, oy = s.y, oz = s.z;
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.life -= dt;
        let gone = s.life <= 0;
        let spark = false;
        if (!gone && fl.track !== 'sky' && s.y < 0) { gone = spark = true; }
        if (!gone && fl.track === 'gorge' && Math.abs(s.x) > T.wall) { gone = spark = true; }
        if (!gone && fl.track === 'gorge') {
            for (const w of fl.walks) {
                if (oz < w.z && s.z >= w.z && Math.abs(s.y - w.y) < 1.4) { gone = spark = true; break; }
            }
        }
        if (!gone) {
            for (const e of G.enemies) {
                if (e.dead) continue;
                if (segHits(ox, oy, oz, s.x, s.y, s.z, e.x, e.y, e.z, ENEMY[e.kind].r + 0.3)) {
                    damage(G, e, 1);
                    if (e.dead && (e.kind === 'tower' || e.kind === 'spire')) towerDown(G);
                    gone = true;
                    break;
                }
                if ((e.kind === 'tower' || e.kind === 'spire') && s.y < e.th && Math.abs(s.x - e.x) < 1.8 && Math.abs(s.z - e.z) < 1.8) {
                    gone = spark = true;
                    break;
                }
            }
        }
        if (!gone) {
            for (const f of G.foes) {
                if (f.dead) continue;
                if (segHits(ox, oy, oz, s.x, s.y, s.z, f.x, f.y, f.z, f.r + 0.5)) {
                    f.dead = true; gone = true;
                    G.score += FOE[f.kind].score;
                    G.events.push({ type: 'foeShot', kind: f.kind, x: f.x, y: f.y, z: f.z, score: FOE[f.kind].score });
                    break;
                }
            }
        }
        if (spark) G.events.push({ type: 'shotHit', x: s.x, y: s.y, z: s.z });
        if (gone) G.shots.splice(i, 1);
    }
}

function towerDown(G) {
    const fl = G.fl;
    fl.towersDown++;
    if (fl.towersDown === fl.towers) {
        G.score += 10000;
        G.events.push({ type: 'bonus', score: 10000, text: 'EVERY TOWER BURNED' });
    }
}

function stepFoes(G, dt) {
    const p = G.player, fl = G.fl, S = FLIGHT.speed;
    for (const f of G.foes) {
        if (f.dead) continue;
        const F = FOE[f.kind];
        let rx = p.px - f.x, ry = p.py - f.y, rz = fl.dist - f.z;
        if (F.homing && rz < -4) {
            // steer the velocity relative to the dragon a little toward it
            let vx = f.vx, vy = f.vy, vz = f.vz - S;
            const sp = Math.hypot(vx, vy, vz) || 1;
            const L = Math.hypot(rx, ry, rz) || 1;
            const k = F.homing * dt;
            vx += (rx / L * sp - vx) * k; vy += (ry / L * sp - vy) * k; vz += (rz / L * sp - vz) * k;
            const n = Math.hypot(vx, vy, vz) || 1;
            f.vx = vx / n * sp; f.vy = vy / n * sp; f.vz = vz / n * sp + S;
        }
        f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        f.life -= dt;
        rx = p.px - f.x; ry = p.py - f.y; rz = fl.dist - f.z;
        if (f.life <= 0 || rz > 8) { f.dead = true; continue; }
        if (Math.hypot(rx, ry, rz) < f.r + FLIGHT.radius) {
            f.dead = true;
            hurt(G, f.kind, f.x, f.y, f.z);
        }
    }
}

// ------------------------------------------------------------------ the step
export function stepFlight(G, inp, dt) {
    const p = G.player, fl = G.fl, def = STAGES[G.stageIdx], T = TRACKS[fl.track];
    const live = G.phase !== 'dead';
    p.inv = Math.max(0, p.inv - dt);
    p.cd -= dt;

    if (live) {
        // the cursor: a stick or the mouse places it, keys push it
        const ix = clamp(inp.x, -1, 1), iy = clamp(-inp.y, -1, 1);
        if (inp.abs) {
            const k = Math.min(1, FLIGHT.absRate * dt);
            p.ax += (ix - p.ax) * k; p.ay += (iy - p.ay) * k;
        } else {
            p.ax = clamp(p.ax + ix * FLIGHT.keyRate * dt, -1, 1);
            p.ay = clamp(p.ay + iy * FLIGHT.keyRate * dt, -1, 1);
            // with nothing held the cursor drifts home, so keys never leave it stuck in a corner
            if (!ix) p.ax -= p.ax * Math.min(1, 0.6 * dt);
            if (!iy) p.ay -= p.ay * Math.min(1, 0.6 * dt);
        }
        const tx = p.ax * T.latX, ty = T.base + p.ay * T.latY;
        p.vx = (tx - p.px) * FLIGHT.follow; p.vy = (ty - p.py) * FLIGHT.follow;
        p.px += p.vx * dt; p.py += p.vy * dt;
        fl.dist += FLIGHT.speed * dt;

        if (inp.a && p.cd <= 0) {
            const ox = p.px, oy = p.py - 1.1, oz = fl.dist + 1.5;
            const a = aimPoint(G, 70);
            let dx = a.x - ox, dy = a.y - oy, dz = a.z - oz;
            const L = Math.hypot(dx, dy, dz);
            dx /= L; dy /= L; dz /= L;
            const sp = FLIGHT.shotSpeed;
            G.shots.push({ x: ox, y: oy, z: oz, vx: dx * sp, vy: dy * sp, vz: dz * sp + FLIGHT.speed, life: FLIGHT.shotRange / sp });
            p.cd = FLIGHT.fireCd;
            G.events.push({ type: 'fire', mode: 'flight' });
        }
    }

    stepShots(G, dt);
    if (G.phase !== 'play') return;

    // catwalks across the gorge
    if (fl.track === 'gorge') {
        for (const w of fl.walks) {
            const rz = w.z - fl.dist;
            if (!w.hit && rz < 0.5 && rz > -1.5 && Math.abs(p.py - w.y) < 2.4) {
                w.hit = true;
                hurt(G, 'catwalk', p.px, p.py, fl.dist);
                G.events.push({ type: 'crash', kind: 'catwalk', x: p.px, y: p.py, z: fl.dist });
            }
        }
    }

    for (const e of G.enemies) {
        if (e.dead) continue;
        if (e.kind === 'griffon') stepGriffon(G, e, dt);
        else stepStatic(G, e, dt);
    }
    stepFoes(G, dt);

    if (fl.track === 'sky') {
        let alive = 0;
        for (const e of G.enemies) if (!e.dead) alive++;
        const maxAlive = def.maxAlive + Math.min(2, G.loop);
        fl.spawnT -= dt;
        if (fl.spawnT <= 0 && alive < maxAlive && G.stageKills + alive < def.quota) {
            const n = Math.min(maxAlive - alive, def.quota - G.stageKills - alive, 1 + G.rng.int(0, 2));
            for (let k = 0; k < n; k++) spawnGriffon(G, k);
            fl.spawnT = 2.5 + G.rng() * 2;
        }
        if (G.stageKills >= def.quota) stageClear(G, 5000);
    } else if (fl.track === 'ramparts') {
        if (fl.dist >= fl.len) stageClear(G, 1000 * fl.towersDown);
    } else if (fl.track === 'gorge') {
        const stone = G.enemies.find((e) => e.kind === 'wardstone');
        if (stone.dead) {
            G.events.push({ type: 'gate' });
            stageClear(G, 10000);
        } else if (fl.dist >= fl.len - 5) {
            // missed: the ward throws the dragon back down the gorge to try again
            fl.missed++;
            hurt(G, 'ward', 0, 10, fl.len);
            fl.dist = fl.len - 460;
            G.foes.length = 0;
            for (const w of fl.walks) w.hit = false;
            G.events.push({ type: 'missed' });
        }
    }
}
