// Enemy types, the paths they fly and how they behave. Pure: no DOM, no Math.random.
//
// An enemy flies one of three ways:
//   path       its position is a function of its age (a Bézier swoop, a sine drop, a march ...),
//              so a formation costs almost nothing to simulate and a save is a few numbers;
//   formation  it flies in to a slot in a Galaga-style grid, sways with it, and now and then
//              peels off to dive at the player, wraps round the top and returns to its slot;
//   dart       it steers a little toward the player and then runs straight.

import { ENEMY } from '../config.js';
import { W, H, clamp, shoot, aimAt, bulletSpeed, angleStep, emit } from './util.js';
import { updateBoss } from './bosses.js';

/**
 * hp: hit points at wave 1 (+grow[1] every grow[0] waves of difficulty), r: hit radius, pts: score,
 * size: explosion size 0..3, c: explosion colour family, fire: {from wave, gap [min,max] s, pat}.
 */
export const TYPES = {
    drone:   { hp: 1, r: 6,  pts: 100,  size: 0, c: 0, grow: [10, 1], fire: { from: 2, gap: [3, 6], pat: 'aim' } },
    weaver:  { hp: 1, r: 6,  pts: 120,  size: 0, c: 1, grow: [10, 1], fire: { from: 2, gap: [2.4, 4.6], pat: 'down' } },
    striker: { hp: 1, r: 6,  pts: 150,  size: 0, c: 2, grow: [6, 1], fire: { from: 3, gap: [2.8, 5.5], pat: 'aim' } },
    saucer:  { hp: 10, r: 8, pts: 300,  size: 1, c: 3, grow: [3, 2], fire: { from: 6, gap: [1.4, 2.4], pat: 'aim2' } },
    dart:    { hp: 1, r: 5,  pts: 150,  size: 0, c: 4, grow: [12, 1] },
    cruiser: { hp: 90, r: 11, pts: 800, size: 2, c: 5, grow: [3, 15], fire: { from: 8, gap: [1.5, 2.5], pat: 'fan3' } },
    carrier: { hp: 160, r: 12, pts: 1500, size: 2, c: 2, grow: [3, 25], fire: { from: 11, gap: [2, 3], pat: 'down2' } },
    mine:    { hp: 3, r: 6,  pts: 200,  size: 1, c: 0, grow: [8, 1], burst: 8 },
    boss:    { hp: 1, r: 18, pts: 0,    size: 3, c: 0 },
};

// ------------------------------------------------------------------ paths
const mx = (x, m) => (m < 0 ? W - x : x);

/** A cubic Bézier swoop through four points, taking d seconds; `m` = -1 mirrors it. */
export const bezPath = (p, d, m = 1) => ({ k: 'bez', d, p: [mx(p[0], m), p[1], mx(p[2], m), p[3], mx(p[4], m), p[5], mx(p[6], m), p[7]] });
/** Falls at vy px/s, weaving ±amp around x0. */
export const sinePath = (x0, vy, amp, f, ph = 0, y0 = -14) => ({ k: 'sine', x0, vy, amp, f, ph, y0 });
/** A straight line. */
export const linePath = (x0, y0, vx, vy) => ({ k: 'line', x0, y0, vx, vy });
/** Space-Invaders march: the group centre ping-pongs across the screen and drops a row at each edge. */
export const marchPath = (cx, dx, y0, dy, half, speed, step) => ({ k: 'march', cx, dx, y0, dy, half, speed, step });
/** Arrives from the top, hangs at height yh drifting side to side for `stay` s, then leaves downward. */
export const hoverPath = (x0, yh, amp, f, ph, stay) => ({ k: 'hover', x0, yh, amp, f, ph, stay });
/** A saucer: sweeps the full width at height yh, then drops away after `stay` s. */
export const strafePath = (yh, amp, f, ph, stay) => ({ k: 'strafe', yh, amp, f, ph, stay });

function bez4(p, u) {
    const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return [a * p[0] + b * p[2] + c * p[4] + d * p[6], a * p[1] + b * p[3] + c * p[5] + d * p[7]];
}

/** Where a path puts you at age t: [x, y]. */
export function pathPos(p, t) {
    switch (p.k) {
        case 'bez': {
            if (t < p.d) return bez4(p.p, t / p.d);
            const q = p.p, vx = (3 * (q[6] - q[4])) / p.d, vy = (3 * (q[7] - q[5])) / p.d;
            return [q[6] + vx * (t - p.d), q[7] + vy * (t - p.d)];
        }
        case 'sine': return [p.x0 + p.amp * Math.sin(p.f * t + p.ph), p.y0 + p.vy * t];
        case 'line': return [p.x0 + p.vx * t, p.y0 + p.vy * t];
        case 'march': {
            const span = Math.max(1, 2 * p.half), ph = (t * p.speed) / span, n = Math.floor(ph), f = ph - n;
            const x = p.cx - p.half + (n % 2 === 0 ? f : 1 - f) * span;
            // the whole group slides in from above for its first 1.6 s
            return [x + p.dx, p.y0 + p.dy + n * p.step - Math.max(0, 1.6 - t) * 45];
        }
        case 'hover': {
            const y = t < p.stay ? Math.min(p.yh, -26 + 34 * t) : p.yh + 46 * (t - p.stay);
            return [p.x0 + p.amp * Math.sin(p.f * t + p.ph), y];
        }
        case 'strafe': {
            const y = t < p.stay ? Math.min(p.yh, -16 + 60 * t) + 5 * Math.sin(t * 2.2) : p.yh + 70 * (t - p.stay);
            return [W / 2 + p.amp * Math.sin(p.f * t + p.ph), y];
        }
        default: return [W / 2, -40];
    }
}

// ------------------------------------------------------------------ spawning
const HP_RAMP = 0.05;
const hpFor = (type, G) => {
    const T = TYPES[type];
    const base = T.hp + (T.grow ? Math.floor(G.diff / T.grow[0]) * T.grow[1] : 0);
    // from wave 9 on, everything gets tougher still, to keep pace with the hangar's upgrades
    return Math.ceil(base * (1 + Math.max(0, G.diff - 8) * HP_RAMP));
};

/** Add an enemy. props: path, ai, carry (a power-up it drops), peace (never shoots), cnt (counts toward Perfect). */
export function addEnemy(G, type, props = {}) {
    const T = TYPES[type];
    const hp = props.hp ?? hpFor(type, G);
    const e = {
        id: G.nid++, type, x: -60, y: -60, vx: 0, vy: 0, r: T.r, hp, maxHp: hp, t: 0, pt: 0, hitT: 0,
        ai: 'path', st: 'path', path: null, carry: null, peace: false, cnt: true, dead: false,
        fireT: 0.5 + G.rng() * (T.fire ? T.fire.gap[0] : 3), ...props,
    };
    if (e.path) { const [x, y] = pathPos(e.path, 0); e.x = x; e.y = y; }
    G.enemies.push(e);
    return e;
}

// ------------------------------------------------------------------ firing
const FIRE_PATTERNS = {
    aim(G, e, sp) { shoot(G, e.x, e.y + 4, aimAt(G, e.x, e.y) + (G.rng() - 0.5) * 0.18, sp, 0); },
    aim2(G, e, sp) { const a = aimAt(G, e.x, e.y); shoot(G, e.x - 4, e.y + 4, a - 0.07, sp, 0); shoot(G, e.x + 4, e.y + 4, a + 0.07, sp, 0); },
    down(G, e, sp) { shoot(G, e.x, e.y + 4, Math.PI / 2, sp * 1.1, 2); },
    down2(G, e, sp) { shoot(G, e.x - 8, e.y + 6, Math.PI / 2, sp * 1.1, 2); shoot(G, e.x + 8, e.y + 6, Math.PI / 2, sp * 1.1, 2); },
    fan3(G, e, sp) { const a = aimAt(G, e.x, e.y); for (const d of [-0.34, 0, 0.34]) shoot(G, e.x, e.y + 6, a + d, sp, 1); },
    ring8(G, e, sp) { for (let i = 0; i < 8; i++) shoot(G, e.x, e.y, (i / 8) * Math.PI * 2 + e.t, sp * 0.8, 0); },
};

function enemyFire(G, e, dt) {
    const T = TYPES[e.type];
    if (!T.fire || e.peace || G.plan.kind === 'bonus' || G.wave < T.fire.from) return;
    e.fireT -= dt;
    if (e.fireT > 0) return;
    if (e.y < 6 || e.y > H - 64) { e.fireT = 0.25; return; }
    e.fireT = (T.fire.gap[0] + G.rng() * (T.fire.gap[1] - T.fire.gap[0])) / (1 + G.diff * ENEMY.fireScale);
    FIRE_PATTERNS[T.fire.pat](G, e, bulletSpeed(G));
    emit(G, { type: 'eshot', k: T.fire.pat });
}

// ------------------------------------------------------------------ the formation
/** Where a formation enemy sits: its slot, swaying and breathing with the whole grid. */
export function slotPos(G, e) {
    const br = 1 + 0.07 * Math.sin(G.t * 1.3), sway = Math.sin(G.t * 0.75) * 13;
    return [W / 2 + (e.slot.x - W / 2) * br + sway, e.slot.y + Math.sin(G.t * 1.9 + e.slot.x * 0.05) * 1.5];
}

function startDive(G, e) {
    const p = G.player, side = e.x < W / 2 ? 1 : -1;
    const tx = clamp(p.alive ? p.x : W / 2, 14, W - 14) + (G.rng() - 0.5) * 40;
    e.st = 'dive'; e.pt = 0;
    e.path = {
        k: 'bez', d: 2.3 - Math.min(0.7, G.diff * 0.03),
        p: [e.x, e.y, e.x + side * 80, e.y + 50, tx - side * 70, e.y + 150, tx, H + 34],
    };
    e.shots = G.diff >= 8 ? 2 : 1;
    e.shotT = 0.45;
}

function updateFormation(G, dt) {
    const f = G.form;
    let holders = 0, total = 0, entering = 0;
    for (const e of G.enemies) {
        if (e.ai !== 'formation' || e.dead) continue;
        total++;
        if (e.st === 'hold') holders++;
        else if (e.st === 'enter') entering++;
    }
    if (!total) { f.diveT = 2.4; return; }
    // wait until most of the grid has arrived; nothing dives during a bonus stage
    if (entering > 0 && holders < total * 0.55) return;
    if (G.plan.kind === 'bonus') return;
    f.diveT -= dt;
    if (f.diveT > 0) return;
    f.diveT = (1.7 + G.rng() * 1.8) / (1 + G.diff * 0.05);
    const hold = G.enemies.filter((e) => e.ai === 'formation' && e.st === 'hold' && !e.dead);
    const n = Math.min(hold.length, 1 + (G.diff >= 5 ? 1 : 0) + (G.diff >= 11 ? 1 : 0));
    for (let i = 0; i < n; i++) {
        const k = Math.floor(G.rng() * hold.length);
        startDive(G, hold[k]);
        hold.splice(k, 1);
    }
}

// ------------------------------------------------------------------ one enemy
const setPos = (e, x, y, dt) => {
    e.vx = dt > 0 ? (x - e.x) / dt : 0;
    e.vy = dt > 0 ? (y - e.y) / dt : 0;
    e.x = x; e.y = y;
};

function cull(G, e) {
    if (e.t > 1 && (e.x < -46 || e.x > W + 46 || e.y > H + 46 || e.y < -70)) {
        e.dead = true;
        if (e.cnt) G.plan.escaped++;
    }
}

export function updateEnemy(G, e, dt) {
    e.t += dt;
    e.hitT = Math.max(0, e.hitT - dt);
    switch (e.ai) {
        case 'path': {
            e.pt += dt;
            const [x, y] = pathPos(e.path, e.pt);
            setPos(e, x, y, dt);
            enemyFire(G, e, dt);
            if (e.type === 'carrier') updateCarrier(G, e, dt);
            cull(G, e);
            break;
        }
        case 'formation': {
            if (e.st === 'enter') {
                e.pt += dt;
                const [x, y] = pathPos(e.path, e.pt);
                setPos(e, x, y, dt);
                if (e.pt >= e.path.d) e.st = 'hold';
            } else if (e.st === 'hold') {
                const [x, y] = slotPos(G, e);
                setPos(e, x, y, dt);
                // a held enemy still takes the odd shot from its slot
                enemyFire(G, e, dt);
            } else if (e.st === 'dive') {
                e.pt += dt;
                const [x, y] = pathPos(e.path, e.pt);
                setPos(e, x, y, dt);
                if (e.shots > 0 && e.pt >= e.shotT && G.wave >= 3 && !e.peace) {
                    e.shots--; e.shotT += 0.55;
                    shoot(G, e.x, e.y + 4, aimAt(G, e.x, e.y), bulletSpeed(G), 0);
                    emit(G, { type: 'eshot', k: 'aim' });
                }
                if (e.pt >= e.path.d) { e.st = 'return'; e.x = e.slot.x; e.y = -20; }
            } else if (e.st === 'return') {
                const [sx, sy] = slotPos(G, e);
                const dx = sx - e.x, dy = sy - e.y, d = Math.hypot(dx, dy);
                if (d < 3) { e.st = 'hold'; } else {
                    const k = Math.min(1, (120 * dt) / d);
                    setPos(e, e.x + dx * k, e.y + dy * k, dt);
                }
            }
            break;
        }
        case 'dart': {
            e.pt += dt;
            if (e.pt < 1.2) e.ang = angleStep(e.ang, aimAt(G, e.x, e.y), 1.7 * dt);
            const sp = e.speed * Math.min(1, 0.45 + e.pt);
            setPos(e, e.x + Math.cos(e.ang) * sp * dt, e.y + Math.sin(e.ang) * sp * dt, dt);
            cull(G, e);
            break;
        }
        case 'boss':
            updateBoss(G, e, dt);
            break;
    }
}

/** A carrier launches a drone down a curved path every few seconds. */
function updateCarrier(G, e, dt) {
    if (e.y < 24 || G.plan.kind === 'bonus') return;
    e.launchT = (e.launchT ?? 1.6) - dt;
    if (e.launchT > 0 || e.launched >= 6) return;
    e.launchT = 2.6 / (1 + G.diff * 0.03);
    e.launched = (e.launched || 0) + 1;
    const m = e.launched % 2 ? 1 : -1;
    addEnemy(G, 'drone', {
        cnt: false,
        path: { k: 'bez', d: 3.2, p: [e.x, e.y + 8, e.x + m * 70, e.y + 70, e.x - m * 50, e.y + 150, e.x + m * 20, H + 40] },
    });
    emit(G, { type: 'launch', x: e.x, y: e.y });
}

export function updateEnemies(G, dt) {
    updateFormation(G, dt);
    // new enemies (carrier launches) join the list after this pass
    for (let i = 0, n = G.enemies.length; i < n; i++) {
        const e = G.enemies[i];
        if (!e.dead) updateEnemy(G, e, dt);
    }
}

/** Does a circle at (x, y) with radius r touch enemy e? Bosses have several parts. */
export function touches(e, x, y, r) {
    if (e.parts) {
        for (const q of e.parts) if (Math.hypot(e.x + q.dx - x, e.y + q.dy - y) < q.r + r) return true;
        return false;
    }
    return Math.hypot(e.x - x, e.y - y) < e.r + r;
}

