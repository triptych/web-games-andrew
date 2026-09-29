/**
 * world.js — the whole game simulation, pure JavaScript.
 *
 * No three.js, no DOM, no Math.random (see dev/simtest.mjs, which enforces
 * this). The view reads the world once a frame and syncs meshes; the world
 * announces anything worth reacting to by pushing onto `w.fxQueue`, which the
 * frame loop drains and hands to the juice director (sound, particles, shake,
 * HUD).
 *
 * Public API:
 *   createWorld(seed)            — fresh game
 *   stepWorld(w, input, dt)      — advance one fixed sub-step (dt = PHYS.tick)
 *   comboMult(w)                 — current combo multiplier
 *
 * input = { left, right, launch, nudge }   (nudge is edge-triggered)
 */

import {
    PHYS, FLIPPER, PLUNGER, RULES, POWER_DURATION, PICKUPS, TABLE, STARTING_LIVES,
} from '../config.js';
import { makeRng } from './rng.js';
import { buildTable } from './table.js';
import { buildWave } from './levels.js';

const FX_CAP = 600;
const R = PHYS.ballR;

// ============================================================
// Construction
// ============================================================

export function createWorld(seed = 1) {
    const w = {
        rng: makeRng(seed),
        table: buildTable(),
        time: 0,
        score: 0,
        lives: STARTING_LIVES,
        wave: 0,
        waveName: '',
        balls: [],
        nextBallId: 1,
        bricks: [],
        bricksLeft: 0,
        nextBrickId: 1,
        pickups: [],
        nextPickupId: 1,
        lasers: [],
        nextLaserId: 1,
        blasts: [],
        flippers: [makeFlipper(-1), makeFlipper(1)],
        power: { fire: 0, laser: 0, shield: 0, wide: 0, x2: 0 },
        combo: 0,
        comboTimer: 0,
        bestCombo: 0,
        plunger: 0,
        ballSave: 0,
        saveArmed: true,
        autoLaunch: -1,
        respawnTimer: 0,
        nextWaveTimer: 0,
        waveClearing: false,
        nudgeHeat: 0,
        tilted: false,
        nextExtraIdx: 0,
        nextExtraAt: RULES.extraBallAt[0],
        over: false,
        laserCooldown: [0, 0],
        prevInput: { left: false, right: false, launch: false },
        stats: { bricks: 0, bumpers: 0, launches: 0, drains: 0, pickups: 0, waves: 0, saves: 0, unsticks: 0 },
        fxQueue: [],
    };
    // Payload first, then type, so a payload can never rename the event.
    w.fx = (type, data) => {
        w.fxQueue.push({ ...data, type });
        if (w.fxQueue.length > FX_CAP) w.fxQueue.splice(0, w.fxQueue.length - FX_CAP);
    };
    for (const f of w.flippers) poseFlipper(f);
    startWave(w, 1);
    spawnLaneBall(w, false);
    return w;
}

function makeFlipper(side) {
    return {
        side,                                  // -1 left, +1 right
        px: side * FLIPPER.pivotX,
        py: FLIPPER.pivotY,
        angle: FLIPPER.rest,
        omega: 0,                              // CCW-positive angular velocity (rad/s)
        len: FLIPPER.len,
        held: false,
        tipX: 0, tipY: 0, dirX: 0, dirY: 0,
    };
}

function poseFlipper(f) {
    f.dirX = f.side < 0 ? Math.cos(f.angle) : -Math.cos(f.angle);
    f.dirY = Math.sin(f.angle);
    f.tipX = f.px + f.dirX * f.len;
    f.tipY = f.py + f.dirY * f.len;
}

function makeBall(w, x, y, vx = 0, vy = 0) {
    return {
        id: w.nextBallId++,
        x, y, vx, vy,
        held: false,
        inLane: false,
        still: 0,
        touchFlipper: 0,
    };
}

function spawnLaneBall(w, auto) {
    const b = makeBall(w, TABLE.laneX, 0.9);
    b.held = true;
    b.inLane = true;
    w.balls.push(b);
    w.plunger = 0;
    w.autoLaunch = auto ? 0.55 : -1;
    w.fx('ballReady', { id: b.id, auto: !!auto });
    return b;
}

function startWave(w, n) {
    const { name, bricks } = buildWave(n, w.nextBrickId);
    w.nextBrickId += bricks.length;
    w.wave = n;
    w.waveName = name;
    // A brick that materialises on top of a ball in flight stays a ghost
    // (no collision) until the ball has moved clear of it.
    for (const br of bricks) br.ghost = w.balls.some((b) => overlapsBrick(b, br, 0.25));
    w.bricks = bricks;
    w.bricksLeft = bricks.length;
    w.waveClearing = false;
    w.fx('waveStart', { wave: n, name });
}

// ============================================================
// Scoring
// ============================================================

export function comboMult(w) {
    return Math.min(RULES.comboMaxMult, 1 + Math.floor(w.combo / RULES.comboStep));
}

function addScore(w, base, x, y, popup) {
    const pts = Math.round(base * comboMult(w) * (w.power.x2 > 0 ? 2 : 1));
    w.score += pts;
    if (popup) w.fx('score', { pts, x, y });
    while (w.score >= w.nextExtraAt) {
        w.lives++;
        w.fx('extraBall', { lives: w.lives });
        w.nextExtraIdx++;
        w.nextExtraAt = w.nextExtraIdx < RULES.extraBallAt.length
            ? RULES.extraBallAt[w.nextExtraIdx]
            : w.nextExtraAt + 100000;
    }
    return pts;
}

// ============================================================
// Bricks, blasts, pickups
// ============================================================

function damageBrick(w, br, dmg, cause) {
    if (!br.alive) return;
    br.hp -= dmg;
    if (br.hp > 0) {
        addScore(w, 20, br.x, br.y, false);
        w.fx('brickHit', { id: br.id, x: br.x, y: br.y, hp: br.hp, cause });
        return;
    }
    br.alive = false;
    w.bricksLeft--;
    w.stats.bricks++;

    const before = comboMult(w);
    w.combo++;
    w.comboTimer = RULES.comboWindow;
    if (w.combo > w.bestCombo) w.bestCombo = w.combo;
    const after = comboMult(w);
    if (after > before) w.fx('comboUp', { mult: after, combo: w.combo });

    const pts = addScore(w, 100 * br.maxHp, br.x, br.y, true);
    w.fx('brickBreak', {
        id: br.id, x: br.x, y: br.y, kind: br.kind, maxHp: br.maxHp,
        combo: w.combo, pts, cause,
    });

    if (br.kind === 'x') w.blasts.push({ x: br.x, y: br.y, t: 0.09 });
    if (br.kind === 'p' || w.rng.chance(RULES.pickupChance)) spawnPickup(w, br.x, br.y);
}

function updateBlasts(w, dt) {
    for (let i = w.blasts.length - 1; i >= 0; i--) {
        const bl = w.blasts[i];
        bl.t -= dt;
        if (bl.t > 0) continue;
        w.blasts.splice(i, 1);
        w.fx('blast', { x: bl.x, y: bl.y });
        addScore(w, 250, bl.x, bl.y, false);
        const r2 = RULES.blastRadius * RULES.blastRadius;
        for (const br of w.bricks) {
            if (!br.alive) continue;
            const dx = br.x - bl.x, dy = br.y - bl.y;
            if (dx * dx + dy * dy <= r2) damageBrick(w, br, 2, 'blast');
        }
        // Shove nearby balls away from the blast.
        for (const b of w.balls) {
            if (b.held || b.inLane) continue;
            const dx = b.x - bl.x, dy = b.y - bl.y;
            const d = Math.hypot(dx, dy);
            if (d < 2.6 && d > 1e-4) {
                const k = 7 * (1 - d / 2.6);
                b.vx += (dx / d) * k;
                b.vy += (dy / d) * k;
            }
        }
    }
}

function pickKind(w) {
    const kinds = Object.keys(PICKUPS).filter(
        (k) => !(k === 'multi' && w.balls.length >= RULES.multiMax - 1));
    let total = 0;
    for (const k of kinds) total += PICKUPS[k].weight;
    let roll = w.rng.next() * total;
    for (const k of kinds) {
        roll -= PICKUPS[k].weight;
        if (roll <= 0) return k;
    }
    return kinds[kinds.length - 1];
}

function spawnPickup(w, x, y) {
    const kind = pickKind(w);
    const p = { id: w.nextPickupId++, kind, x, y, phase: w.rng.next() * Math.PI * 2 };
    w.pickups.push(p);
    w.fx('pickupSpawn', { id: p.id, kind, x, y });
}

function applyPickup(w, p) {
    w.stats.pickups++;
    addScore(w, 500, p.x, p.y, true);
    if (p.kind === 'multi') {
        // Extra balls drop in from the open channel under the top arc (always
        // clear of bricks) and race down both sides of the wall.
        const count = Math.min(2, RULES.multiMax - w.balls.length);
        for (let i = 0; i < count; i++) {
            const dir = i === 0 ? -1 : 1;
            const nb = makeBall(w, TABLE.arcCx + dir * 0.9, 26.9, dir * w.rng.range(10, 14), w.rng.range(-1, 2));
            w.balls.push(nb);
            w.fx('ballSpawn', { id: nb.id, x: nb.x, y: nb.y });
        }
    } else {
        w.power[p.kind] = POWER_DURATION[p.kind];
    }
    w.fx('pickup', { id: p.id, kind: p.kind, x: p.x, y: p.y });
}

function updatePickups(w, dt) {
    for (let i = w.pickups.length - 1; i >= 0; i--) {
        const p = w.pickups[i];
        p.y -= RULES.pickupFall * dt;
        p.x += Math.sin(w.time * 2.4 + p.phase) * 0.6 * dt;

        let got = false;
        // Caught by a flipper — the breakout paddle half of the synthesis.
        for (const f of w.flippers) {
            if (distToSeg(p.x, p.y, f.px, f.py, f.tipX, f.tipY) < 0.62) { got = true; break; }
        }
        // ...or scooped up by any ball in play.
        if (!got) {
            for (const b of w.balls) {
                if (b.held) continue;
                const dx = b.x - p.x, dy = b.y - p.y;
                if (dx * dx + dy * dy < (R + 0.45) * (R + 0.45)) { got = true; break; }
            }
        }
        if (got) {
            w.pickups.splice(i, 1);
            applyPickup(w, p);
        } else if (p.y < 0.2) {
            w.pickups.splice(i, 1);
            w.fx('pickupLost', { id: p.id, x: p.x, y: p.y });
        }
    }
}

// ============================================================
// Lasers (LASER power-up: the flippers shoot)
// ============================================================

function fireLasers(w, input, dt) {
    for (let s = 0; s < 2; s++) {
        w.laserCooldown[s] = Math.max(0, w.laserCooldown[s] - dt);
    }
    if (w.power.laser <= 0 || w.tilted) return;
    w.flippers.forEach((f, s) => {
        const held = s === 0 ? input.left : input.right;
        const was = s === 0 ? w.prevInput.left : w.prevInput.right;
        if (!held) return;
        if (was && w.laserCooldown[s] > 0) return;
        if (!was || w.laserCooldown[s] <= 0) {
            w.laserCooldown[s] = 0.28;
            const l = { id: w.nextLaserId++, x: f.tipX, y: f.tipY + 0.3, side: f.side };
            w.lasers.push(l);
            w.fx('laser', { id: l.id, x: l.x, y: l.y, side: f.side });
        }
    });
}

function updateLasers(w, dt) {
    const { arcCx, arcCy, arcR } = TABLE;
    outer:
    for (let i = w.lasers.length - 1; i >= 0; i--) {
        const l = w.lasers[i];
        l.y += RULES.laserSpeed * dt;
        for (const br of w.bricks) {
            if (!br.alive) continue;
            if (Math.abs(l.x - br.x) < br.hw + 0.06 && Math.abs(l.y - br.y) < br.hh + 0.1) {
                w.lasers.splice(i, 1);
                w.fx('laserHit', { id: l.id, x: l.x, y: br.y - br.hh });
                damageBrick(w, br, 1, 'laser');
                continue outer;
            }
        }
        for (const bp of w.table.bumpers) {
            const dx = l.x - bp.x, dy = l.y - bp.y;
            if (dx * dx + dy * dy < bp.r * bp.r) {
                w.lasers.splice(i, 1);
                w.fx('laserHit', { id: l.id, x: l.x, y: l.y });
                w.fx('bumper', { id: bp.id, x: bp.x, y: bp.y, laser: true });
                addScore(w, 10, bp.x, bp.y, false);
                continue outer;
            }
        }
        const dx = l.x - arcCx, dy = l.y - arcCy;
        if (l.y > arcCy && dx * dx + dy * dy > (arcR - 0.15) * (arcR - 0.15)) {
            w.lasers.splice(i, 1);
            w.fx('laserHit', { id: l.id, x: l.x, y: l.y, wall: true });
        }
    }
}

// ============================================================
// Geometry helpers
// ============================================================

function overlapsBrick(b, br, pad) {
    const cx = Math.max(br.x - br.hw, Math.min(b.x, br.x + br.hw));
    const cy = Math.max(br.y - br.hh, Math.min(b.y, br.y + br.hh));
    const rr = R + pad;
    return (b.x - cx) ** 2 + (b.y - cy) ** 2 < rr * rr;
}

function solidifyGhosts(w) {
    for (const br of w.bricks) {
        if (br.ghost && !w.balls.some((b) => overlapsBrick(b, br, 0.05))) br.ghost = false;
    }
}

function distToSeg(px, py, ax, ay, bx, by) {
    const ex = bx - ax, ey = by - ay;
    const len2 = ex * ex + ey * ey || 1e-9;
    let t = ((px - ax) * ex + (py - ay) * ey) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (ax + ex * t), py - (ay + ey * t));
}

// ============================================================
// Ball physics
// ============================================================

function collideWalls(w, b) {
    for (const s of w.table.walls) {
        if (s.kind === 'gate' && b.inLane) continue;
        if (s.kind === 'floor' && !b.inLane) continue;
        const ex = s.bx - s.ax, ey = s.by - s.ay;
        const len2 = ex * ex + ey * ey;
        let t = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = s.ax + ex * t, cy = s.ay + ey * t;
        const dx = b.x - cx, dy = b.y - cy;
        const rr = R + s.r;
        let nx, ny;
        if (s.nx !== undefined && t > 0 && t < 1) {
            // One-sided face: a ball that got shoved behind it (a flipper
            // squeezing it into the funnel) is pushed back to the open side,
            // never out through the back.
            const sd = dx * s.nx + dy * s.ny;
            if (sd >= rr || sd < -0.6) continue;
            nx = s.nx; ny = s.ny;
        } else {
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2);
            nx = d > 1e-6 ? dx / d : 0; ny = d > 1e-6 ? dy / d : 1;
        }
        b.x = cx + nx * rr;
        b.y = cy + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn >= 0) continue;
        const e = s.e ?? PHYS.wallE;
        b.vx -= (1 + e) * vn * nx;
        b.vy -= (1 + e) * vn * ny;

        if (s.kind === 'sling' && -vn > 1.5 && t > 0.08 && t < 0.92) {
            const out = b.vx * nx + b.vy * ny;
            if (out < PHYS.slingKick) {
                b.vx += nx * (PHYS.slingKick - out);
                b.vy += ny * (PHYS.slingKick - out);
            }
            addScore(w, 10, cx, cy, false);
            w.fx('sling', { side: s.side, x: cx, y: cy });
        } else if (-vn > 6) {
            w.fx('wall', { x: cx, y: cy, speed: -vn });
        }
    }
}

function collideBumpers(w, b) {
    for (const bp of w.table.bumpers) {
        const dx = b.x - bp.x, dy = b.y - bp.y;
        const rr = R + bp.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6;
        const nx = dx / d, ny = dy / d;
        b.x = bp.x + nx * rr;
        b.y = bp.y + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn >= 0) continue;
        b.vx -= 1.6 * vn * nx;
        b.vy -= 1.6 * vn * ny;
        const out = b.vx * nx + b.vy * ny;
        if (out < PHYS.bumperKick) {
            b.vx += nx * (PHYS.bumperKick - out);
            b.vy += ny * (PHYS.bumperKick - out);
        }
        w.stats.bumpers++;
        addScore(w, 30, bp.x, bp.y, true);
        w.fx('bumper', { id: bp.id, x: bp.x, y: bp.y, hx: bp.x + nx * bp.r, hy: bp.y + ny * bp.r });
    }
}

function collideBricks(w, b) {
    const fire = w.power.fire > 0;
    for (const br of w.bricks) {
        if (!br.alive || br.ghost) continue;
        const dx0 = b.x - br.x, dy0 = b.y - br.y;
        if (Math.abs(dx0) > br.hw + R || Math.abs(dy0) > br.hh + R) continue;
        const cx = Math.max(br.x - br.hw, Math.min(b.x, br.x + br.hw));
        const cy = Math.max(br.y - br.hh, Math.min(b.y, br.y + br.hh));
        const dx = b.x - cx, dy = b.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;

        if (fire) {                     // FIREBALL: plough straight through
            damageBrick(w, br, 99, 'fire');
            continue;
        }

        let nx, ny, pen;
        if (d2 > 1e-10) {
            const d = Math.sqrt(d2);
            nx = dx / d; ny = dy / d; pen = R - d;
        } else {
            const px = br.hw - Math.abs(dx0), py = br.hh - Math.abs(dy0);
            if (px < py) { nx = Math.sign(dx0) || 1; ny = 0; pen = px + R; }
            else         { nx = 0; ny = Math.sign(dy0) || 1; pen = py + R; }
        }
        b.x += nx * pen;
        b.y += ny * pen;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
            b.vx -= (1 + PHYS.brickE) * vn * nx;
            b.vy -= (1 + PHYS.brickE) * vn * ny;
            damageBrick(w, br, 1, 'ball');
        }
    }
}

function collideFlippers(w, b) {
    for (const f of w.flippers) {
        const ex = f.tipX - f.px, ey = f.tipY - f.py;
        const len2 = ex * ex + ey * ey;
        let t = ((b.x - f.px) * ex + (b.y - f.py) * ey) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = f.px + ex * t, cy = f.py + ey * t;
        const r = FLIPPER.r0 + (FLIPPER.r1 - FLIPPER.r0) * t;
        const dx = b.x - cx, dy = b.y - cy;
        const rr = R + r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6;
        const nx = dx / d, ny = dy / d;
        b.x = cx + nx * rr;
        b.y = cy + ny * rr;
        b.touchFlipper = 0.2;

        // Velocity of the flipper's surface at the contact point.
        const qx = cx + nx * r - f.px, qy = cy + ny * r - f.py;
        const svx = -f.omega * qy, svy = f.omega * qx;
        const vn = (b.vx - svx) * nx + (b.vy - svy) * ny;
        if (vn < 0) {
            b.vx -= (1 + PHYS.flipperE) * vn * nx;
            b.vy -= (1 + PHYS.flipperE) * vn * ny;
            if (Math.abs(f.omega) > 2 && -vn > 8) {
                w.fx('flipHit', { side: f.side, x: b.x, y: b.y, power: -vn });
            }
        }
    }
}

function collideShield(w, b) {
    if (w.power.shield <= 0 || b.inLane) return;
    const s = w.table.shield;
    if (b.y > s.ay + 1 || b.y < s.ay - 1) return;
    const cx = Math.max(s.ax, Math.min(b.x, s.bx));
    const dx = b.x - cx, dy = b.y - s.ay;
    const rr = R + s.r;
    if (dx * dx + dy * dy >= rr * rr) return;
    b.y = s.ay + rr;
    if (b.vy < PHYS.shieldKick * 0.6) {
        b.vy = PHYS.shieldKick;
        b.vx *= 0.6;
        w.fx('shieldHit', { x: b.x, y: s.ay });
    }
}

function collideBalls(w) {
    const bs = w.balls;
    for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        if (a.held) continue;
        for (let j = i + 1; j < bs.length; j++) {
            const b = bs[j];
            if (b.held) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d2 = dx * dx + dy * dy;
            if (d2 >= 4 * R * R || d2 < 1e-10) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d;
            const pen = (2 * R - d) / 2;
            a.x -= nx * pen; a.y -= ny * pen;
            b.x += nx * pen; b.y += ny * pen;
            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rel < 0) {
                const j2 = -rel * 0.95;
                a.vx -= nx * j2; a.vy -= ny * j2;
                b.vx += nx * j2; b.vy += ny * j2;
                if (-rel > 4) w.fx('ballClack', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            }
        }
    }
}

function stepBall(w, b, dt) {
    if (b.held) {
        b.x = TABLE.laneX;
        b.y = 0.9 - w.plunger * 0.45;
        b.vx = b.vy = 0;
        return;
    }
    b.vy -= PHYS.gravity * dt;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > PHYS.maxSpeed) {
        b.vx *= PHYS.maxSpeed / sp;
        b.vy *= PHYS.maxSpeed / sp;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.touchFlipper = Math.max(0, b.touchFlipper - dt);

    if (!b.inLane) {
        collideBumpers(w, b);
        collideBricks(w, b);
        collideFlippers(w, b);
        collideShield(w, b);
    }
    collideWalls(w, b);          // last, so the table boundary always wins

    if (b.inLane) {
        if (b.x < TABLE.right - 0.05) {
            b.inLane = false;
            if (w.saveArmed) {
                w.saveArmed = false;
                w.ballSave = RULES.ballSave;
            }
            w.fx('enterField', { id: b.id });
        } else if (b.y < 0.95 && b.vy <= 0) {
            b.held = true;                 // weak plunge: it rolled back onto the plunger
            w.plunger = 0;
        }
    }

    // Stuck detector: a ball that stops moving outside the lane and is not
    // being cradled on a raised flipper gets a gentle kick.
    if (!b.inLane && sp < 0.9 && b.touchFlipper <= 0) {
        b.still += dt;
        if (b.still > 2.5) {
            b.still = 0;
            b.vx = w.rng.range(-5, 5);
            b.vy = 9;
            w.stats.unsticks++;
            w.fx('unstick', { x: b.x, y: b.y });
        }
    } else {
        b.still = 0;
    }
}

function launch(w, b, power) {
    b.held = false;
    b.vx = 0;
    b.vy = PLUNGER.minSpeed + (PLUNGER.maxSpeed - PLUNGER.minSpeed) * power;
    w.stats.launches++;
    w.fx('launch', { id: b.id, power });
    w.plunger = 0;
    w.autoLaunch = -1;
}

function drainBall(w, idx) {
    const b = w.balls[idx];
    w.balls.splice(idx, 1);
    w.stats.drains++;
    if (w.balls.length > 0) {
        w.fx('drain', { x: b.x, last: false });
        return;
    }
    if (w.ballSave > 0 && !w.tilted) {
        w.stats.saves++;
        w.fx('ballSaved', { x: b.x });
        spawnLaneBall(w, true);
        return;
    }
    w.lives--;
    w.combo = 0;
    w.comboTimer = 0;
    for (const k in w.power) w.power[k] = 0;
    w.pickups.length = 0;
    w.lasers.length = 0;
    w.fx('drain', { x: b.x, last: true, lives: w.lives });
    if (w.lives <= 0) {
        w.over = true;
        w.fx('gameOver', { score: w.score, wave: w.wave, bestCombo: w.bestCombo });
        return;
    }
    w.respawnTimer = 1.6;
}

// ============================================================
// Main step
// ============================================================

export function stepWorld(w, input, dt) {
    w.time += dt;
    const prev = w.prevInput;

    // --- Flippers ---
    w.flippers.forEach((f, s) => {
        const want = !w.tilted && !w.over && (s === 0 ? input.left : input.right);
        if (want && !f.held) w.fx('flip', { side: f.side });
        f.held = want;
        const target = want ? FLIPPER.up : FLIPPER.rest;
        const speed = want ? FLIPPER.upSpeed : FLIPPER.downSpeed;
        const before = f.angle;
        if (f.angle < target) f.angle = Math.min(target, f.angle + speed * dt);
        else if (f.angle > target) f.angle = Math.max(target, f.angle - speed * dt);
        const dA = (f.angle - before) / dt;
        f.omega = f.side < 0 ? dA : -dA;
        const targetLen = w.power.wide > 0 ? FLIPPER.wideLen : FLIPPER.len;
        f.len += (targetLen - f.len) * Math.min(1, dt * 6);
        poseFlipper(f);
    });

    if (w.over) {
        w.prevInput = { left: input.left, right: input.right, launch: input.launch };
        return;
    }

    // --- Plunger ---
    const held = w.balls.find((b) => b.held);
    if (held) {
        if (w.autoLaunch >= 0) {
            w.autoLaunch -= dt;
            w.plunger = Math.min(PLUNGER.autoPower, w.plunger + dt / 0.5);
            if (w.autoLaunch < 0) launch(w, held, PLUNGER.autoPower);
        } else if (input.launch) {
            if (!prev.launch) w.fx('plungerPull', {});
            w.plunger = Math.min(1, w.plunger + dt / PLUNGER.chargeTime);
        } else if (prev.launch && w.plunger > 0) {
            launch(w, held, w.plunger);
        }
    }

    // --- Nudge / tilt ---
    w.nudgeHeat = Math.max(0, w.nudgeHeat - dt * 0.8);
    if (input.nudge && !w.tilted) {
        w.nudgeHeat += 1;
        for (const b of w.balls) {
            if (b.held || b.inLane) continue;
            b.vy += RULES.nudgeImpulse;
            b.vx += w.rng.range(-1, 1) * RULES.nudgeImpulse * 0.5;
        }
        w.fx('nudge', { heat: w.nudgeHeat });
        if (w.nudgeHeat > RULES.tiltHeat) {
            w.tilted = true;
            w.fx('tilt', {});
        }
    }

    fireLasers(w, input, dt);

    // --- Balls ---
    for (const b of w.balls) stepBall(w, b, dt);
    collideBalls(w);
    for (let i = w.balls.length - 1; i >= 0; i--) {
        if (w.balls[i].y < -0.8) drainBall(w, i);
        if (w.over) break;
    }

    solidifyGhosts(w);
    updatePickups(w, dt);
    updateLasers(w, dt);
    updateBlasts(w, dt);

    // --- Timers ---
    for (const k in w.power) {
        if (w.power[k] > 0) {
            w.power[k] -= dt;
            if (w.power[k] <= 0) {
                w.power[k] = 0;
                w.fx('powerEnd', { kind: k });
            }
        }
    }
    if (w.ballSave > 0) w.ballSave = Math.max(0, w.ballSave - dt);
    if (w.comboTimer > 0) {
        w.comboTimer -= dt;
        if (w.comboTimer <= 0) {
            if (w.combo >= RULES.comboStep) w.fx('comboEnd', { combo: w.combo });
            w.combo = 0;
        }
    }
    if (w.respawnTimer > 0) {
        w.respawnTimer -= dt;
        if (w.respawnTimer <= 0 && !w.over) {
            w.tilted = false;
            w.nudgeHeat = 0;
            w.saveArmed = true;
            spawnLaneBall(w, false);
        }
    }

    // --- Wave clear ---
    if (!w.waveClearing && w.bricksLeft <= 0) {
        w.waveClearing = true;
        w.stats.waves++;
        const bonus = 2500 * w.wave * (w.power.x2 > 0 ? 2 : 1);
        w.score += bonus;
        addScore(w, 0, 0, 0, false);          // runs the extra-ball check
        w.fx('waveClear', { wave: w.wave, bonus });
        w.nextWaveTimer = 2.6;
        w.pickups.length = 0;
        w.lasers.length = 0;
    }
    if (w.waveClearing && w.nextWaveTimer > 0) {
        w.nextWaveTimer -= dt;
        if (w.nextWaveTimer <= 0) {
            startWave(w, w.wave + 1);
            w.ballSave = Math.max(w.ballSave, 5);
        }
    }

    w.prevInput = { left: input.left, right: input.right, launch: input.launch };
}
