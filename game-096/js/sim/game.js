// The simulation for one run of a level. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.

import { PHYS, PEARL, HEARTS } from '../config.js';
import { makeRng } from '../rng.js';
import { INVENTIONS, SHELLS } from './data.js';
import { getLevel } from './levels.js';
import { initWorld, stepWorld, moveAxis, groundBelow, forSolids, bodyHits } from './world.js';
import { initEnemies, stepEnemies, touchEnemies, hitEnemiesNear, shockwave, bindHooks } from './enemies.js';
import { initBoss, stepBoss, bossShock } from './boss.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const SHELL_IDS = SHELLS.map((s) => s.id);
export const ev = (G, type, o) => { G.events.push(o ? { type, ...o } : { type }); };

/** Sum the effects of the equipped inventions. */
export function perksOf(ids) {
    const fx = { hearts: 0, magnet: 0, jump: 1, spin: 1, rescue: 0, curioSense: 0, crumble: 1, glide: 0, bounce: 1, swapGrace: 0 };
    for (const id of ids || []) {
        const inv = INVENTIONS.find((i) => i.id === id);
        if (!inv) continue;
        for (const k in inv.fx) fx[k] = ['jump', 'spin', 'crumble', 'bounce'].includes(k) ? fx[k] * inv.fx[k] : fx[k] + inv.fx[k];
    }
    return fx;
}

/**
 * A fresh run of a level.
 * opts: { seed, equipped: [invention ids], shells: n owned, god: bool (the tests' bot cannot be hurt) }
 */
export function newGame(levelId = 'l1_1', opts = {}) {
    const level = getLevel(levelId);
    const perks = perksOf(opts.equipped);
    const G = {
        v: 1,
        levelId, level,
        seed: opts.seed ?? 1,
        rng: makeRng(opts.seed ?? 1),
        t: 0, time: 0,
        status: 'play',                 // play | won
        winT: 0,
        god: !!opts.god,
        equipped: [...(opts.equipped || [])],
        perks,
        shells: opts.shells ?? Math.min(5, level.meta.world),
        maxHearts: HEARTS.base + perks.hearts,
        hearts: HEARTS.base + perks.hearts,
        pearls: 0, oopsies: 0, falls: 0, rescued: false,
        cam: { yaw: level.start.yaw + (level.chase ? Math.PI : 0) },
        cp: { x: level.start.x, y: level.start.y, z: level.start.z },
        events: [],
        shotId: 1,
    };
    G.p = {
        x: level.start.x, y: level.start.y, z: level.start.z, vx: 0, vy: 0, vz: 0,
        yaw: level.start.yaw,
        shell: 0, grounded: true, coyote: 0, buffer: 0, jumping: false,
        spinT: 0, spinCool: 0, rollT: 0, rollCool: 0, rdx: 0, rdz: 0, rollJump: false,
        brace: false, glide: false, slam: 0, slamWait: 0, charge: 0, swapCool: 0,
        hurtT: 0, stun: 0, dead: 0, launch: null, safe: { x: level.start.x, y: level.start.y, z: level.start.z },
        ground: null, hit: null, landed: false, bonk: false, gref: -1, safeT: 0,
        anim: 0, fallStart: 0,
    };
    G.pearlL = level.pearls.map((q) => ({ x: q.x, y: q.y, z: q.z, got: 0 }));
    G.curioL = level.curios.map((q) => ({ x: q.x, y: q.y, z: q.z, kind: q.kind, i: q.i, got: 0 }));
    G.crates = level.crates.map((c, i) => makeCrate(c, i));
    G.springs = level.springs.map((s) => ({ x: s.x, y: s.y, z: s.z, pop: 0 }));
    G.barrels = level.launchers.map(() => ({ cool: 0, shake: 0 }));
    G.switchesDown = level.switches.map(() => 0);
    G.shots = [];
    G.waveZ = level.chase ? level.start.z + level.chase.lead : 0;
    initWorld(G);
    initEnemies(G);
    initBoss(G);
    return G;
}

function makeCrate(c, i) {
    const h = 0.46;
    return {
        kind: c.kind, x: c.x, y: c.y, z: c.z, alive: 1, pop: 0, id: i,
        box: { x0: c.x - h, x1: c.x + h, y0: c.y, y1: c.y + 0.92, z0: c.z - h, z1: c.z + h, t: 'k', ref: i },
    };
}

// ---------------------------------------------------------------- hurt, rescue, respawn
export function hurt(G, fx, fz, amount = 1) {
    const p = G.p;
    if (p.hurtT > 0 || p.dead > 0 || G.status !== 'play' || p.launch) return false;
    if (G.god) { p.hurtT = 0.6; ev(G, 'hurt', { x: p.x, y: p.y, z: p.z, god: 1 }); return true; }
    G.hearts -= amount;
    p.hurtT = PHYS.hurtTime;
    p.stun = 0.22;
    p.rollT = 0; p.glide = false; p.slam = 0; p.charge = 0; p.spinT = 0;
    const dx = p.x - fx, dz = p.z - fz, l = Math.hypot(dx, dz) || 1;
    p.vx = (dx / l) * PHYS.knock; p.vz = (dz / l) * PHYS.knock; p.vy = 6.5; p.grounded = false;
    ev(G, 'hurt', { x: p.x, y: p.y, z: p.z });
    if (G.hearts <= 0) { G.hearts = 0; oopsie(G); }
    return true;
}

function oopsie(G) {
    const p = G.p;
    G.oopsies++;
    p.dead = 1.1;
    ev(G, 'oopsie', { x: p.x, y: p.y, z: p.z });
}

function respawn(G, to, free) {
    const p = G.p;
    p.x = to.x; p.y = to.y + 0.02; p.z = to.z; p.vx = p.vy = p.vz = 0;
    p.dead = 0; p.hurtT = free ? 1.0 : 2.0; p.stun = 0; p.launch = null;
    p.rollT = 0; p.glide = false; p.slam = 0; p.charge = 0; p.spinT = 0; p.rollJump = false; p.brace = false;
    p.grounded = false; p.safeT = 0;
    if (G.level.chase) G.waveZ = to.z + G.level.chase.lead;
    ev(G, 'respawn', { x: p.x, y: p.y, z: p.z });
}

bindHooks({ hurt });

// ---------------------------------------------------------------- pickups and crates
function collectPearl(G, n, x, y, z) {
    const before = G.pearls;
    G.pearls += n;
    ev(G, 'pearl', { x, y, z, n, total: G.pearls });
    if (Math.floor(G.pearls / 50) > Math.floor(before / 50) && G.hearts < G.maxHearts) { G.hearts++; ev(G, 'heart', { x, y, z, why: 'pearls' }); }
}

export function breakCrate(G, c, how) {
    if (!c.alive) return;
    c.alive = 0;
    const k = c.kind;
    ev(G, 'crate', { kind: k, x: c.x, y: c.y + 0.45, z: c.z, how });
    if (k === 'wood') collectPearl(G, 2, c.x, c.y + 0.5, c.z);
    else if (k === 'pearl') collectPearl(G, 8, c.x, c.y + 0.5, c.z);
    else if (k === 'heart') { G.hearts = Math.min(G.maxHearts + 1, G.hearts + 1); ev(G, 'heart', { x: c.x, y: c.y + 0.5, z: c.z, why: 'crate' }); }
    else if (k === 'check') {
        G.cp = { x: c.x, y: c.y, z: c.z };
        ev(G, 'checkpoint', { x: c.x, y: c.y, z: c.z });
    }
}

function pickups(G, dt) {
    const p = G.p;
    const mag = G.perks.magnet ? PEARL.magnet : 0;
    const R2 = (PEARL.radius + PHYS.radius) ** 2;
    for (const q of G.pearlL) {
        if (q.got) continue;
        const dx = p.x - q.x, dz = p.z - q.z, dy = (p.y + 0.5) - q.y;
        const d2 = dx * dx + dz * dz;
        if (mag && d2 < mag * mag && Math.abs(dy) < mag) {
            const d = Math.sqrt(d2 + dy * dy) || 1, s = Math.min(d, 15 * dt);
            q.x += (dx / d) * s; q.z += (dz / d) * s; q.y += (dy / d) * s;
        }
        if (d2 < R2 && dy > -1.5 && dy < 1.9) { q.got = 1; collectPearl(G, 1, q.x, q.y, q.z); }
    }
    for (const q of G.curioL) {
        if (q.got) continue;
        const dx = p.x - q.x, dz = p.z - q.z, dy = (p.y + 0.5) - q.y;
        if (dx * dx + dz * dz < 1.3 * 1.3 && dy > -1.6 && dy < 2) {
            q.got = 1;
            ev(G, 'curio', { x: q.x, y: q.y, z: q.z, kind: q.kind, i: q.i });
        }
    }
}

// ---------------------------------------------------------------- the player
function wishDir(G, inp) {
    const c = G.cam.yaw, fx = -Math.sin(c), fz = -Math.cos(c), rx = Math.cos(c), rz = -Math.sin(c);
    let ix = inp.x || 0, iy = inp.y || 0;
    const m = Math.hypot(ix, iy);
    if (m > 1) { ix /= m; iy /= m; }
    const mag = Math.min(1, m);
    return { x: fx * -iy + rx * ix, z: fz * -iy + rz * ix, mag: mag < 0.12 ? 0 : mag };
}

function approach(v, target, a) { return v < target ? Math.min(target, v + a) : Math.max(target, v - a); }

function doJump(G, p, mul = 1) {
    let v = PHYS.jumpV * G.perks.jump * (SHELL_IDS[p.shell] === 'anchor' ? PHYS.anchorJumpMul : 1) * mul;
    p.vy = v; p.grounded = false; p.coyote = 0; p.buffer = 0; p.jumping = true; p.glide = false;
    ev(G, 'jump', { x: p.x, y: p.y, z: p.z, rolling: p.rollT > 0 ? 1 : 0 });
}

function stepPlayer(G, inp, dt) {
    const p = G.p;
    const sh = SHELL_IDS[p.shell];
    const w = wishDir(G, inp);

    // ---- timers
    p.hurtT = Math.max(0, p.hurtT - dt); p.stun = Math.max(0, p.stun - dt);
    p.spinCool = Math.max(0, p.spinCool - dt); p.rollCool = Math.max(0, p.rollCool - dt); p.swapCool = Math.max(0, p.swapCool - dt);
    p.spinT = Math.max(0, p.spinT - dt);
    p.anim += dt;
    p.coyote = p.grounded ? PHYS.coyote : Math.max(0, p.coyote - dt);
    p.buffer = inp.jump ? PHYS.buffer : Math.max(0, p.buffer - dt);

    // ---- barrel flight: the player is carried along a fixed arc
    if (p.launch) { stepLaunch(G, p, dt); return; }

    // ---- shell swap
    if ((inp.swap || inp.sel) && p.swapCool <= 0) {
        let to = p.shell;
        if (inp.sel) to = clamp(inp.sel - 1, 0, G.shells - 1);
        else to = (p.shell + inp.swap + G.shells) % G.shells;
        if (to !== p.shell) {
            p.shell = to; p.swapCool = PHYS.swapCool;
            p.glide = false; p.brace = false; p.charge = 0; p.rollT = 0; p.rollJump = false;
            if (G.perks.swapGrace) p.hurtT = Math.max(p.hurtT, 1.0);
            ev(G, 'swap', { shell: to, x: p.x, y: p.y, z: p.z });
        }
    }
    const cur = SHELL_IDS[p.shell];

    // ---- actions
    if (p.stun <= 0) {
        if (inp.spin && p.spinCool <= 0 && p.spinT <= 0 && p.slam === 0 && !p.brace) {
            p.spinT = PHYS.spinTime; p.spinCool = PHYS.spinTime + PHYS.spinCool;
            ev(G, 'spin', { x: p.x, y: p.y, z: p.z });
        }
        if (inp.power) {
            if (cur === 'spiral' && p.rollCool <= 0 && p.rollT <= 0 && p.slam === 0) {
                const d = w.mag ? w : { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) };
                const l = Math.hypot(d.x, d.z) || 1;
                p.rdx = d.x / l; p.rdz = d.z / l; p.rollT = PHYS.rollTime;
                ev(G, 'roll', { x: p.x, y: p.y, z: p.z });
            } else if (cur === 'anchor' && p.slam === 0 && p.rollT <= 0 && p.spinT <= 0) {
                if (p.grounded) { p.vy = 6.2; p.grounded = false; p.slamWait = 0.17; p.slam = 1; }
                else { p.slam = 2; p.vy = -PHYS.slamSpeed; p.vx = p.vz = 0; }
                p.glide = false;
                ev(G, 'slamStart', { x: p.x, y: p.y, z: p.z });
            }
        }
    }
    p.brace = cur === 'coconut' && !!inp.powerHeld && p.stun <= 0 && p.spinT <= 0;
    if (cur === 'spring') {
        if (inp.powerHeld && p.grounded && p.stun <= 0) p.charge = Math.min(PHYS.hopCharge, p.charge + dt);
        else if (p.charge > 0) {
            if (p.grounded) {
                const k = p.charge / PHYS.hopCharge;
                p.vy = PHYS.hopMin + (PHYS.hopMax - PHYS.hopMin) * k; p.grounded = false; p.coyote = 0; p.jumping = false;
                ev(G, 'hop', { x: p.x, y: p.y, z: p.z, k });
            }
            p.charge = 0;
        }
    } else p.charge = 0;

    // ---- jumping
    if (p.buffer > 0 && p.stun <= 0 && (p.grounded || p.coyote > 0) && p.slam === 0 && p.charge === 0) {
        if (p.rollT > 0) p.rollJump = true;
        p.rollT = 0; p.rollCool = 0.1;
        doJump(G, p);
    } else if (cur === 'sail' && !p.grounded && !p.glide && p.slam === 0 && (inp.jump || inp.power) && p.vy < 4 && p.coyote <= 0) {
        p.glide = true; p.jumping = false;
        ev(G, 'glide', { x: p.x, y: p.y, z: p.z });
    }
    if (!inp.jumpHeld && p.jumping && p.vy > 0) { p.vy *= PHYS.jumpCut; p.jumping = false; }
    if (p.vy <= 0) p.jumping = false;
    if (p.glide && !(inp.jumpHeld || inp.powerHeld)) p.glide = false;
    if (cur !== 'sail') p.glide = false;

    // ---- horizontal velocity
    const maxV = PHYS.run * (cur === 'anchor' ? PHYS.anchorRunMul : 1) * (p.brace ? PHYS.braceSpeed : 1) * (p.charge > 0 ? 0.3 : 1);
    if (p.stun > 0) {
        // knocked back: keep what the hit gave us
    } else if (p.rollT > 0) {
        // steer the roll gently toward where the stick points
        if (w.mag) {
            const a = Math.atan2(-p.rdx, -p.rdz), b = Math.atan2(-w.x, -w.z), d = clamp(angDiff(a, b), -2.6 * dt, 2.6 * dt);
            p.rdx = -Math.sin(a + d); p.rdz = -Math.cos(a + d);
        }
        const sp = p.grounded ? PHYS.rollSpeed : PHYS.rollAirSpeed;
        p.vx = p.rdx * sp; p.vz = p.rdz * sp;
        p.rollT -= dt;
        if (p.rollT <= 0) { p.rollT = 0; p.rollCool = PHYS.rollCool; }
    } else if (p.slam > 0) {
        p.vx = approach(p.vx, 0, 90 * dt); p.vz = approach(p.vz, 0, 90 * dt);
    } else if (p.glide) {
        const gs = PHYS.glideSpeed * (1 + 0.06 * G.perks.glide);
        let tx = w.x * gs * w.mag, tz = w.z * gs * w.mag;
        if (!w.mag) { const sp = Math.hypot(p.vx, p.vz); const k = sp > 0.1 ? Math.min(1, 5.5 / sp) : 0; tx = p.vx * k; tz = p.vz * k; }
        p.vx = approach(p.vx, tx, PHYS.glideAccel * dt); p.vz = approach(p.vz, tz, PHYS.glideAccel * dt);
    } else {
        const acc = (p.grounded ? PHYS.accelGround : PHYS.accelAir) * dt;
        let tx = w.x * maxV * w.mag, tz = w.z * maxV * w.mag;
        if (p.rollJump && !p.grounded && !w.mag) { tx = p.vx; tz = p.vz; }       // a roll-jump keeps its speed
        if (!p.grounded && !w.mag && !p.rollJump) { tx = p.vx * 0.97; tz = p.vz * 0.97; }
        p.vx = approach(p.vx, tx, acc); p.vz = approach(p.vz, tz, acc);
        if (p.rollJump) {
            const sp = Math.hypot(p.vx, p.vz);
            if (sp > PHYS.rollAirSpeed) { p.vx *= PHYS.rollAirSpeed / sp; p.vz *= PHYS.rollAirSpeed / sp; }
        }
    }

    // ---- facing
    if (p.rollT > 0) p.yaw = Math.atan2(-p.rdx, -p.rdz);
    else if (p.stun <= 0 && p.spinT <= 0 && (w.mag || (p.brace && false))) {
        const want = Math.atan2(-w.x, -w.z);
        p.yaw += clamp(angDiff(p.yaw, want), -PHYS.turnRate * dt, PHYS.turnRate * dt);
    }

    // ---- vertical
    if (p.slam === 1) {
        p.slamWait -= dt;
        p.vy -= PHYS.gravity * dt * 0.5;
        if (p.slamWait <= 0) { p.slam = 2; p.vy = -PHYS.slamSpeed; p.vx = p.vz = 0; }
    } else if (p.slam === 2) {
        p.vy = -PHYS.slamSpeed;
    } else if (p.glide) {
        const fall = PHYS.glideFall * (1 - 0.3 * G.perks.glide);
        p.vy = p.vy < -fall ? Math.min(-fall, p.vy + 90 * dt) : Math.max(p.vy - PHYS.gravity * dt, -fall);
    } else {
        p.vy -= PHYS.gravity * dt;
        if (p.spinT > PHYS.spinTime * 0.45 && p.vy < -2.4) p.vy = -2.4;           // a spin catches a little air
        if (p.vy < -PHYS.fallMax) p.vy = -PHYS.fallMax;
    }

    // ---- bubble vents lift whoever is over them
    for (const v of G.level.vents) {
        const dx = p.x - v.x, dz = p.z - v.z;
        if (dx * dx + dz * dz < v.r * v.r && p.y > v.y - 0.2 && p.y < v.y + v.height) {
            const cap = p.glide ? 7.5 : 5.5;
            p.vy = Math.min(cap, p.vy + (p.glide ? 70 : 46) * dt);
            if (p.slam) p.slam = 0;
            if (!p.vent) ev(G, 'vent', { x: p.x, y: p.y, z: p.z });
            p.vent = 0.2;
        }
    }
    if (p.vent > 0) p.vent -= dt;

    // ---- platforms carry the player
    if (p.grounded && p.ground && p.ground.t === 'm') {
        const i = p.ground.ref, b = G.mbox[i], pv = G.mprev[i];
        p.x += b.x0 - pv.x0; p.y += b.y1 - pv.y1; p.z += b.z0 - pv.z0;
    }

    // ---- move and collide
    const wasGrounded = p.grounded, vyBefore = p.vy;
    p.landed = false; p.hit = null; p.bonk = false; p.ground = null;
    moveAxis(G, p, 'x', p.vx * dt);
    moveAxis(G, p, 'z', p.vz * dt);
    moveAxis(G, p, 'y', p.vy * dt);
    p.grounded = p.landed;
    if (p.ground) { p.gt = p.ground.t || (p.ground.ref != null ? 's' : ''); p.gi = p.ground.ref ?? -1; } else { p.gt = ''; p.gi = -1; }
    if (p.hit && p.rollT > 0) { p.rollT = 0; p.rollCool = PHYS.rollCool; ev(G, 'bump', { x: p.x, y: p.y, z: p.z }); }

    if (p.grounded) {
        const g = p.ground;
        if (!wasGrounded) {
            if (vyBefore < -5) ev(G, 'land', { x: p.x, y: p.y, z: p.z, v: -vyBefore });
            p.glide = false; p.rollJump = false; p.jumping = false;
        }
        if (p.slam === 2) landSlam(G, p);
        else if (p.slam === 1) p.slam = 0;
        if (g.t === 'c') { const c = G.crumbs[g.ref]; if (c.state === 0) { c.state = 1; c.t = 0; ev(G, 'crumble', { x: (g.x0 + g.x1) / 2, y: g.y1, z: (g.z0 + g.z1) / 2, i: g.ref }); } }
        else if (g.t === 'k') {
            const c = G.crates[g.ref];
            if (c.kind !== 'iron' && vyBefore < -1) {
                breakCrate(G, c, 'stomp');
                p.vy = (inp.jumpHeld ? PHYS.bounceHold : PHYS.bounceV) * G.perks.bounce; p.grounded = false; p.jumping = false;
            }
        }
        if (g.t === undefined && g.safe !== false && p.grounded) {
            const m = 0.9;
            if (p.x > g.x0 + m && p.x < g.x1 - m && p.z > g.z0 + m && p.z < g.z1 - m) {
                p.safeT += dt;
                if (p.safeT > 0.2) { p.safe.x = p.x; p.safe.y = g.y1; p.safe.z = p.z; }
            }
        } else p.safeT = 0;
    } else if (p.slam === 1 && p.bonk) p.slam = 0;
    if (p.bonk) ev(G, 'bonk', { x: p.x, y: p.y, z: p.z });
}

function landSlam(G, p) {
    p.slam = 0;
    ev(G, 'slam', { x: p.x, y: p.y, z: p.z });
    shockwave(G, p.x, p.y, p.z, PHYS.slamRadius);
    bossShock(G, p.x, p.y, p.z, PHYS.slamRadius);
    // big switches
    const L = G.level;
    for (let i = 0; i < L.switches.length; i++) {
        const s = L.switches[i];
        if (G.switchesDown[i]) continue;
        if (Math.hypot(p.x - s.x, p.z - s.z) < 2.0 && Math.abs(p.y - s.y) < 1.2) {
            G.switchesDown[i] = 1; G.gatesOpen[s.gate] = true;
            ev(G, 'switch', { x: s.x, y: s.y, z: s.z, gate: s.gate });
        }
    }
    for (const c of G.crates) {
        if (!c.alive) continue;
        if (Math.hypot(p.x - c.x, p.z - c.z) < PHYS.slamRadius * 0.8 && Math.abs(p.y - c.y) < 1.6) breakCrate(G, c, 'slam');
    }
}

function stepLaunch(G, p, dt) {
    const l = p.launch;
    l.t += dt;
    if (l.t < l.pre) { p.x = l.sx; p.y = l.sy; p.z = l.sz; p.vx = p.vy = p.vz = 0; return; }
    const u = clamp((l.t - l.pre) / l.T, 0, 1);
    const arc = l.H * 4 * u * (1 - u);
    p.x = l.sx + (l.tx - l.sx) * u; p.z = l.sz + (l.tz - l.sz) * u;
    p.y = l.sy + (l.ty - l.sy) * u + arc;
    p.yaw = Math.atan2(-(l.tx - l.sx), -(l.tz - l.sz));
    if (u >= 1) {
        const dx = l.tx - l.sx, dz = l.tz - l.sz, T = l.T;
        p.vx = (dx / T) * 0.5; p.vz = (dz / T) * 0.5;
        p.vy = (l.ty - l.sy) / T - 4 * l.H / T;
        p.launch = null; p.grounded = false; p.hurtT = Math.max(p.hurtT, 0.3);
    }
}

// ---------------------------------------------------------------- world interactions
function interact(G, dt) {
    const p = G.p, L = G.level;

    // springs (sponges)
    for (const s of G.springs) {
        s.pop = Math.max(0, s.pop - dt);
        const dx = p.x - s.x, dz = p.z - s.z;
        if (dx * dx + dz * dz < 0.9 * 0.9 && p.y > s.y - 0.1 && p.y < s.y + 0.55 && p.vy <= 0.5 && !p.launch) {
            p.vy = PHYS.springV * G.perks.bounce; p.grounded = false; p.jumping = false; p.slam = 0; s.pop = 0.35;
            ev(G, 'bounce', { x: s.x, y: s.y, z: s.z });
        }
    }

    // barrels
    for (let i = 0; i < L.launchers.length; i++) {
        const b = L.launchers[i], s = G.barrels[i];
        s.cool = Math.max(0, s.cool - dt); s.shake = Math.max(0, s.shake - dt);
        if (p.launch || s.cool > 0 || p.dead > 0) continue;
        const dx = p.x - b.x, dz = p.z - b.z;
        if (dx * dx + dz * dz < 1.15 * 1.15 && p.y > b.y - 0.4 && p.y < b.y + 1.9) {
            const dist = Math.hypot(b.tx - b.x, b.tz - b.z);
            p.launch = {
                t: 0, pre: 0.42, T: b.T * (0.8 + dist / 40), sx: b.x, sy: b.y + 0.4, sz: b.z, tx: b.tx, ty: b.ty, tz: b.tz,
                H: 2.2 + dist * 0.12 + Math.max(0, b.ty - b.y) * 0.5,
            };
            p.rollT = 0; p.glide = false; p.slam = 0; p.spinT = 0;
            s.cool = 1.6; s.shake = 0.42;
            ev(G, 'barrel', { x: b.x, y: b.y, z: b.z });
        }
    }

    // wood and rubber alike: attacks break crates
    if (p.spinT > 0 || p.rollT > 0) {
        const reach = p.spinT > 0 ? PHYS.spinReach * G.perks.spin : 1.15;
        for (const c of G.crates) {
            if (!c.alive || c.kind === 'iron') continue;
            const dx = p.x - c.x, dz = p.z - c.z;
            if (dx * dx + dz * dz < (reach + 0.4) ** 2 && p.y + 1.2 > c.y && p.y < c.y + 1.2) breakCrate(G, c, p.spinT > 0 ? 'spin' : 'roll');
        }
    }

    pickups(G, dt);

    // the goal
    if (L.goal && G.status === 'play') {
        const g = L.goal;
        if (Math.hypot(p.x - g.x, p.z - g.z) < g.r && Math.abs(p.y - g.y) < 2.6 && p.dead <= 0) win(G);
    }

    // the chasing wave
    if (L.chase && G.status === 'play' && p.dead <= 0) {
        G.waveZ -= L.chase.speed * dt;
        if (p.z > G.waveZ - 0.4 && !p.launch) {
            ev(G, 'swept', { x: p.x, y: p.y, z: p.z });
            if (G.god) respawn(G, { x: p.x, y: p.y, z: G.waveZ - 8 }, true);
            else { G.hearts -= 1; if (G.hearts <= 0) { G.hearts = 0; oopsie(G); } else respawn(G, G.cp, false); }
        }
    }

    // the water below
    if (p.y < L.killY && p.dead <= 0) {
        ev(G, 'splash', { x: p.x, y: L.waterY, z: p.z });
        G.falls++;
        if (G.perks.rescue && !G.rescued) {
            G.rescued = true;
            ev(G, 'rescue', { x: p.safe.x, y: p.safe.y, z: p.safe.z });
            respawn(G, p.safe, true);
        } else if (G.god) {
            respawn(G, p.safe, true);
        } else {
            G.hearts -= 1;
            if (G.hearts <= 0) { G.hearts = 0; oopsie(G); } else respawn(G, p.safe, false);
        }
    }
}

export function win(G) {
    if (G.status !== 'play') return;
    G.status = 'won';
    ev(G, 'win', { time: G.time });
}

// ---------------------------------------------------------------- camera
function stepCamera(G, dt) {
    const p = G.p, L = G.level, cam = G.cam;
    let target = cam.yaw, found = null, best = Infinity;
    for (const s of L.sections) {
        const inside = p.x >= s.x0 && p.x <= s.x1 && p.z >= s.z0 && p.z <= s.z1;
        const dx = Math.max(s.x0 - p.x, p.x - s.x1, 0), dz = Math.max(s.z0 - p.z, p.z - s.z1, 0);
        const d = inside ? -Math.abs(p.y - s.y) : Math.hypot(dx, dz) + 1;
        if (d < best) { best = d; found = s; }
    }
    cam.mode = 'run';
    if (found) {
        let base;
        if (found.type === 'corner') {
            const rx = p.x - found.ox, rz = p.z - found.oz;
            const a = rx * found.r[0] + rz * found.r[1], b = rx * found.f[0] + rz * found.f[1];
            const ex = found.dir > 0 ? (-a / found.w + 0.5) : (a / found.w + 0.5);
            const t = clamp(b / found.w + ex - 0.5, 0, 1);
            const s = t * t * (3 - 2 * t);
            base = (found.h0 + found.dir * s) * Math.PI / 2;
        } else if (found.type === 'arena') { base = found.h * Math.PI / 2; cam.mode = 'arena'; cam.cx = found.cx; cam.cz = found.cz; cam.r = found.r; }
        else base = found.h * Math.PI / 2;
        if (L.chase) base += Math.PI;            // a chase is filmed from the front: the wave looms behind you, you run toward the screen
        target = cam.yaw + angDiff(cam.yaw, base);
    }
    cam.yaw += (target - cam.yaw) * (1 - Math.exp(-5.5 * dt));
}

// ---------------------------------------------------------------- the step
/** Advance one fixed step. inp = { x, y, jump, jumpHeld, spin, power, powerHeld, swap, sel }; x and y in [-1, 1] (y down). */
export function step(G, inp, dt) {
    if (G.status === 'won') { G.winT += dt; stepCamera(G, dt); return; }
    G.t += dt;
    G.lastJumpHeld = !!inp.jumpHeld;
    const p = G.p;
    if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) { G.hearts = G.maxHearts; respawn(G, G.cp, false); }
        stepCamera(G, dt);
        return;
    }
    if (!G.hold) G.time += dt;
    stepWorld(G, dt);
    stepPlayer(G, inp, dt);
    for (const c of G.crates) c.pop = Math.max(0, c.pop - dt);
    interact(G, dt);
    stepEnemies(G, dt);
    touchEnemies(G, dt);
    stepBoss(G, dt);
    if (G.boss && G.boss.done) win(G);
    stepCamera(G, dt);
}

// ---------------------------------------------------------------- saves of a run (tests use these)
const SKIP = new Set(['level', 'rng', 'events', 'mbox', 'mprev', 'box', 'ground', 'hit']);
export function serialize(G) {
    const s = JSON.parse(JSON.stringify(G, (k, v) => (SKIP.has(k) ? undefined : v)));
    s.rngState = G.rng.state();
    return s;
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = JSON.parse(JSON.stringify(rest));
    G.level = getLevel(G.levelId);
    G.rng = makeRng(0); G.rng.setState(rngState);
    G.events = [];
    const states = G.crumbs, opened = G.gatesOpen;
    initWorld(G);
    G.gatesOpen = opened || {};
    G.crumbs.forEach((c, i) => { c.state = states[i].state; c.t = states[i].t; });
    G.crates.forEach((c, i) => { c.box = makeCrate(c, i).box; });
    // movers are a pure function of time: bring their boxes up to date
    stepWorld(G, 0);
    G.mprev = G.mbox.map((b) => ({ x0: b.x0, y1: b.y1, z0: b.z0 }));
    // what he was standing on is a reference into the world, so it is found again from its kind and index
    const p = G.p;
    p.hit = null;
    p.ground = p.gt === 'm' ? G.mbox[p.gi] : p.gt === 'c' ? G.crumbs[p.gi].box : p.gt === 'k' ? G.crates[p.gi].box : p.gt === 's' ? G.level.solids[p.gi] : null;
    return G;
}

export { groundBelow, forSolids, bodyHits };
