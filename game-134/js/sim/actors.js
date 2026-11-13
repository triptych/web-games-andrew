// Everything that moves besides the saucer: walkers, enemies, shots, jets and pickups. Pure.

import { GROUND, BEAM, DROP, STATUS, SCORE, UFO, CEIL, FLOOR, FX, DEFECT } from '../config.js';
import { SPECIMENS, ENEMIES, SHOTS, LEVELS } from './data.js';
import { holdCap, hullMax, spawnSpecimen, spawnEnemy, spawnPickup, groundX, weighted, level } from './world.js';

const sign = (v) => (v < 0 ? -1 : 1);

// ------------------------------------------------------------------ the beam
export function beamHalf(G, y) {
    const u = G.ufo;
    const k = (1 + 0.2 * G.up.beam) * (u.fx.mega > 0 ? BEAM.megaWidth : 1);
    return (BEAM.top + Math.max(0, y - u.y) * BEAM.spread) * k;
}

/** Is a thing whose middle is at (x, y) inside the beam cone? */
export function inCone(G, x, y) {
    const u = G.ufo;
    if (!u.beam || y <= u.y) return false;
    return Math.abs(x - u.x) <= beamHalf(G, y);
}

// ------------------------------------------------------------------ getting hurt
/** One hit on the saucer. Returns true if it landed. */
export function hurt(G, cause, dmg = 1) {
    const u = G.ufo;
    if (u.dead > 0 || u.inv > 0 || u.fx.shield > 0) return false;
    u.hull -= dmg;
    u.inv = UFO.invuln;
    G.stats.hits++;
    if (u.hold.length) {
        const kind = u.hold.pop();
        spawnSpecimen(G, kind, u.x, { y: u.y + 1, state: 'fall', noBeam: 1, vy: -3 });
    }
    u.defects = Math.min(DEFECT.max, u.defects + 1);
    G.events.push({ type: 'hit', cause, x: u.x, y: u.y });
    if (u.hull <= 0) crash(G);
    return true;
}

function crash(G) {
    const u = G.ufo;
    u.dead = UFO.respawn;
    u.beam = false;
    G.lives--;
    G.stats.crashes++;
    for (const kind of u.hold) spawnSpecimen(G, kind, u.x + G.rng.range(-1, 1), { y: u.y + 1, state: 'fall', noBeam: 1, vy: -4 });
    u.hold = [];
    G.events.push({ type: 'crash', x: u.x, y: u.y, lives: G.lives });
}

// ------------------------------------------------------------------ walkers
export function updateSpecimens(G, dt) {
    const u = G.ufo;
    const alive = u.dead <= 0;
    const cap = holdCap(G);
    const lift = BEAM.lift * (u.fx.mega > 0 ? BEAM.megaLift : 1);
    for (let i = G.specs.length - 1; i >= 0; i--) {
        const s = G.specs[i];
        const d = SPECIMENS[s.kind];
        s.noBeam = Math.max(0, s.noBeam - dt);
        const mid = s.y - d.h / 2;
        const beamed = alive && s.noBeam <= 0 && inCone(G, s.x, mid);

        if (beamed) {
            if (s.state !== 'lift') { s.state = 'lift'; s.vy = 0; G.events.push({ type: 'grab', kind: s.kind, x: s.x, y: s.y }); }
            s.vy = -lift / d.weight;
            s.y += s.vy * dt;
            const pull = BEAM.pull * dt;
            s.x += Math.max(-pull, Math.min(pull, u.x - s.x));
            const top = u.y + BEAM.catchDy;
            if (s.y - d.h <= top) {
                if (u.hold.length < cap) {
                    u.hold.push(s.kind);
                    G.specs.splice(i, 1);
                    if (s.wake) G.respawns.push({ t: 14, kind: s.wake });   // HQ sends a replacement
                    G.events.push({ type: 'catch', kind: s.kind, x: s.x, y: s.y, n: u.hold.length });
                    if (u.hold.length === cap) G.events.push({ type: 'full' });
                    continue;
                }
                s.y = top + d.h;                          // hold full: it hangs under the saucer
                if (u.fullT <= 0) { G.events.push({ type: 'full' }); u.fullT = 3; }
            }
            continue;
        }

        if (s.state === 'lift') { s.state = 'fall'; s.vy = Math.min(s.vy, 0) * 0.3; }
        if (s.state === 'fall') {
            s.vy += DROP.gravity * dt;
            s.y += s.vy * dt;
            if (s.dropped && s.vy > 0) bonkCheck(G, s);
            if (s.y >= GROUND) {
                s.y = GROUND;
                const hard = s.vy > 11;
                s.vy = 0;
                s.dropped = false;
                if (hard || s.wake) { s.state = 'dazed'; s.daze = Math.max(s.daze, hard ? 1.4 : 1); }
                else s.state = 'walk';
                G.events.push({ type: 'land', kind: s.kind, x: s.x, hard });
            }
            continue;
        }
        if (s.state === 'dazed') {
            s.daze -= dt;
            if (s.daze <= 0) {
                if (s.wake) {                               // a bonked enemy gets back up
                    G.specs.splice(i, 1);
                    spawnEnemy(G, s.wake, s.x).cd = 1.5;
                    G.events.push({ type: 'wake', kind: s.wake, x: s.x });
                    continue;
                }
                s.state = 'walk';
            }
            continue;
        }
        // walking
        let speed = d.walk;
        const dx = s.x - u.x;
        if (d.flee && alive && Math.abs(dx) < 6.5 && (u.beam || s.kind === 'golden')) {
            s.dir = sign(dx);
            speed = d.flee;
        } else {
            s.turnT -= dt;
            if (s.turnT <= 0) {
                const r = G.rng();
                s.dir = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
                s.turnT = G.rng.range(1.2, 4);
            }
        }
        s.x += s.dir * speed * dt;
        if (s.x < 1.2) { s.x = 1.2; s.dir = 1; }
        if (s.x > G.W - 1.2) { s.x = G.W - 1.2; s.dir = -1; }
    }
    // keep the field stocked
    const walkers = G.specs.filter((s) => !s.wake).length;
    if (walkers < level(G).pop) {
        G.specT -= dt;
        if (G.specT <= 0) {
            G.specT = G.rng.range(1.2, 2.6);
            const kind = weighted(G.rng, level(G).spec);
            spawnSpecimen(G, kind, groundX(G, u.x, 14));
        }
    }
}

/** A dropped specimen landing on an enemy's head. */
function bonkCheck(G, s) {
    const d = SPECIMENS[s.kind];
    for (let j = G.enemies.length - 1; j >= 0; j--) {
        const e = G.enemies[j];
        const ed = ENEMIES[e.kind];
        if (Math.abs(s.x - e.x) > (ed.w + d.w) / 2 * 0.85) continue;
        if (s.y < GROUND - ed.h + 0.2) continue;
        // hit
        s.vy = -7;
        s.dropped = false;
        s.y = GROUND - ed.h;
        G.stats.bonks++;
        if (e.kind === 'boss') {
            if (e.inv > 0) return;
            e.hp--;
            e.inv = 1;
            G.score += SCORE.bonk;
            G.events.push({ type: 'bosshit', x: e.x, hp: e.hp });
            if (e.hp <= 0) {
                G.enemies.splice(j, 1);
                G.bossDown = true;
                G.score += 2000;
                G.events.push({ type: 'bossdown', x: e.x });
            }
        } else if (ed.armored) {
            G.enemies.splice(j, 1);
            G.stats.destroyed++;
            G.score += SCORE.destroy;
            G.respawns.push({ t: 16, kind: e.kind });
            G.events.push({ type: 'boom', kind: e.kind, x: e.x });
        } else {
            G.enemies.splice(j, 1);
            G.score += SCORE.bonk;
            spawnSpecimen(G, ed.bank, e.x, { state: 'dazed', daze: DROP.bonkStun, wake: e.kind, dir: e.dir });
            G.events.push({ type: 'bonk', kind: e.kind, x: e.x });
        }
        return;
    }
}

// ------------------------------------------------------------------ enemies
export function updateEnemies(G, dt) {
    const u = G.ufo;
    const alive = u.dead <= 0;
    for (let i = G.enemies.length - 1; i >= 0; i--) {
        const e = G.enemies[i];
        const d = ENEMIES[e.kind];
        e.inv = Math.max(0, e.inv - dt);
        e.deflT = Math.max(0, e.deflT - dt);
        const dx = u.x - e.x;

        // the beam on someone who doesn't want it
        if (alive && inCone(G, e.x, GROUND - d.h / 2)) {
            if (d.beam === 'backfire') {
                e.zap += dt;
                if (e.zap >= BEAM.backfire) {
                    e.zap = 0;
                    G.events.push({ type: 'backfire', x: e.x });
                    hurt(G, 'backfire');
                }
            } else if (e.deflT <= 0) {
                e.deflT = 1.2;
                G.events.push({ type: 'deflect', kind: e.kind, x: e.x });
            }
        } else e.zap = Math.max(0, e.zap - dt);

        // a laser beam in progress
        if (e.fire > 0) {
            e.fire -= dt;
            if (alive && Math.abs(u.x - e.aimX) < 0.55 + UFO.rx * 0.8) hurt(G, 'laser');
            continue;
        }
        // winding up to fire
        if (e.wind > 0) {
            e.wind -= dt;
            if (e.wind <= 0) fire(G, e);
            continue;
        }
        // walking
        let want = 0;
        if (e.kind === 'agent' && alive) want = Math.abs(dx) > 3 ? sign(dx) : 0;
        else if (e.kind === 'tinfoil' && alive && Math.abs(dx) < 10) want = Math.abs(dx) > 1 ? sign(dx) : 0;
        else if (e.kind === 'boss' && alive) want = Math.abs(dx) > 2 ? sign(dx) : 0;
        else {
            e.turnT -= dt;
            if (e.turnT <= 0) { e.dir = G.rng() < 0.5 ? -1 : 1; e.turnT = G.rng.range(2, 5); }
            want = e.dir;
        }
        if (d.walk) {
            e.dir = want || e.dir;
            e.x += want * d.walk * dt;
            const m = e.kind === 'boss' ? 6 : 2;
            if (e.x < m) { e.x = m; e.dir = 1; }
            if (e.x > G.W - m) { e.x = G.W - m; e.dir = -1; }
        }
        // deciding to shoot
        e.cd -= dt;
        const dist = e.kind === 'gunner' ? Math.hypot(dx, u.y - (GROUND - d.h)) : Math.abs(dx);
        if (e.cd <= 0 && alive && dist < d.range && u.y < GROUND - d.h - 1) {
            e.cd = d.every * G.rng.range(0.85, 1.2);
            e.wind = d.windup;
            if (e.kind === 'laser' || (e.kind === 'boss' && e.pattern % 3 === 2)) {
                e.aimX = u.x;
                e.wind = e.kind === 'boss' ? 1.1 : d.windup;
            }
            G.events.push({ type: 'windup', kind: e.kind, id: e.id, x: e.x, aimX: e.aimX });
        }
    }
}

function shoot(G, kind, x, y, tx, ty, spread = 0) {
    const S = SHOTS[kind];
    const a = Math.atan2(ty - y, tx - x) + spread;
    G.shots.push({ kind, x, y, vx: Math.cos(a) * S.speed, vy: Math.sin(a) * S.speed, ttl: S.ttl });
}

function fire(G, e) {
    const u = G.ufo;
    const d = ENEMIES[e.kind];
    const top = GROUND - d.h;
    if (u.dead > 0 && e.kind !== 'laser') return;
    if (e.kind === 'gunner') {
        for (const sp of [-0.17, 0, 0.17]) shoot(G, 'pellet', e.x, top, u.x, u.y, sp);
        G.events.push({ type: 'shot', kind: 'pellet', x: e.x, y: top });
    } else if (e.kind === 'agent') {
        shoot(G, 'net', e.x, top + 0.4, u.x, u.y);
        G.events.push({ type: 'shot', kind: 'net', x: e.x, y: top });
    } else if (e.kind === 'tank') {
        shoot(G, 'shell', e.x + e.dir * 0.6, top + 0.2, u.x + u.vx * 0.5, u.y);
        G.events.push({ type: 'shot', kind: 'shell', x: e.x, y: top });
    } else if (e.kind === 'tinfoil') {
        const hit = u.dead <= 0 && Math.abs(u.x - e.x) < 4.4;
        if (hit && u.fx.shield <= 0) { u.fx.dazzle = STATUS.dazzle; G.events.push({ type: 'dazzled' }); }
        G.events.push({ type: 'flash', x: e.x, y: top, hit });
    } else if (e.kind === 'laser' || (e.kind === 'boss' && e.pattern % 3 === 2)) {
        e.fire = 0.45;
        G.events.push({ type: 'laser', x: e.aimX });
        e.pattern++;
    } else if (e.kind === 'boss') {
        for (const sp of [-0.32, 0, 0.32]) shoot(G, 'shell', e.x, top + 0.6, u.x, u.y, sp);
        G.events.push({ type: 'shot', kind: 'shell', x: e.x, y: top });
        e.pattern++;
    }
}

// ------------------------------------------------------------------ shots and jets
export function updateShots(G, dt) {
    const u = G.ufo;
    for (let i = G.shots.length - 1; i >= 0; i--) {
        const s = G.shots[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.ttl -= dt;
        if (s.ttl <= 0 || s.y < -2 || s.x < -2 || s.x > G.W + 2) { G.shots.splice(i, 1); continue; }
        if (u.dead > 0) continue;
        const r = SHOTS[s.kind].r;
        const ex = (s.x - u.x) / (UFO.rx + r), ey = (s.y - u.y) / (UFO.ry + r);
        if (ex * ex + ey * ey > 1) continue;
        G.shots.splice(i, 1);
        if (s.kind === 'net') {
            if (u.fx.shield > 0) continue;
            u.fx.net = STATUS.net;
            G.events.push({ type: 'netted', x: u.x, y: u.y });
        } else hurt(G, s.kind);
    }
}

export function updateJets(G, dt) {
    const L = level(G), u = G.ufo;
    if (L.jets && u.dead <= 0) {
        G.jetT -= dt;
        if (G.jetT <= 0) {
            G.jetT = L.jets * G.rng.range(0.8, 1.2);
            const dir = G.rng() < 0.5 ? 1 : -1;
            const y = Math.max(CEIL + 0.5, Math.min(FLOOR - 0.5, u.y + G.rng.range(-1.2, 1.2)));
            G.jets.push({ x: u.x - dir * 30, y, dir, warn: 1.4, hit: false });
            G.events.push({ type: 'jetwarn', y, dir });
        }
    }
    for (let i = G.jets.length - 1; i >= 0; i--) {
        const j = G.jets[i];
        if (j.warn > 0) {
            j.warn -= dt;
            j.x = u.x - j.dir * 30;                 // the jet comes from just off screen, wherever you are
            if (j.warn <= 0) G.events.push({ type: 'jet', y: j.y, dir: j.dir });
            continue;
        }
        j.x += j.dir * 34 * dt;
        if (!j.hit && u.dead <= 0 && Math.abs(j.x - u.x) < 2.2 && Math.abs(j.y - u.y) < 1.0) {
            j.hit = true;
            hurt(G, 'jet');
        }
        if ((j.x - u.x) * j.dir > 40) G.jets.splice(i, 1);
    }
}

// ------------------------------------------------------------------ pickups
export function updatePickups(G, dt) {
    const u = G.ufo;
    G.pickT -= dt;
    if (G.pickT <= 0) { G.pickT = G.rng.range(8, 13); spawnPickup(G, u.x); }
    for (let i = G.pickups.length - 1; i >= 0; i--) {
        const p = G.pickups[i];
        p.life -= dt;
        if (p.life <= 0) { G.pickups.splice(i, 1); continue; }
        if (u.dead > 0 || Math.hypot(p.x - u.x, p.y - u.y) > 1.5) continue;
        G.pickups.splice(i, 1);
        applyPickup(G, p.kind);
        G.events.push({ type: 'pickup', kind: p.kind, x: p.x, y: p.y });
    }
}

export function applyPickup(G, kind) {
    const u = G.ufo;
    if (kind === 'wrench') u.hull = Math.min(hullMax(G), u.hull + 1);
    else if (kind === 'tape') { u.defects = 0; u.glitch = null; }
    else if (kind === 'turbo') u.fx.turbo = FX.turbo;
    else if (kind === 'mega') u.fx.mega = FX.mega;
    else if (kind === 'shield') u.fx.shield = FX.shield;
    else if (kind === 'clock') G.timeLeft += FX.clock;
    else if (kind === 'star') G.score += FX.star;
}

// ------------------------------------------------------------------ enemies coming back
export function updateRespawns(G, dt) {
    for (let i = G.respawns.length - 1; i >= 0; i--) {
        const r = G.respawns[i];
        r.t -= dt;
        if (r.t > 0) continue;
        G.respawns.splice(i, 1);
        spawnEnemy(G, r.kind, groundX(G, G.ufo.x, 12));
    }
}

export { LEVELS, FLOOR };
