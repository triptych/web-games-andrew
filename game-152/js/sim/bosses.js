// Mini-bosses and multi-phase sector bosses. Pure.
//
// A boss rides ahead of the boat at SECTOR.bossGap, swaying across the arena. Its parts have their own hp; the
// core is shielded while a phase says so. A phase ends when its `until` is met; between phases the boss is
// invulnerable for a moment, its bullets are cancelled into score, and the sim asks for a hit-stop.

import { BOSSES } from './data.js';
import { SECTOR } from '../config.js';
import { riverAt } from './river.js';
import { fire, lockAim } from './patterns.js';

export function spawnBoss(G, key) {
    const d = BOSSES[key];
    const b = G.boat;
    const r = riverAt(G.river, b.y + 90);
    const hpMul = 1 + G.sector * 0.1;
    G.boss = {
        key, mini: !!d.mini, x: r.cx, y: b.y + 90, t: 0, phase: 0, inv: 2.5, dying: 0, entering: true,
        parts: d.parts.map((p) => ({ id: p.id, role: p.role, group: p.group || null, dx: p.dx, dy: p.dy, r: p.r, hp: p.hp * hpMul, max: p.hp * hpMul, dead: false, hit: 0 })),
        timers: d.phases.map((ph) => ph.patterns.map((p) => (p.offset || 0) + p.every * 0.6)),
        tele: d.phases.map((ph) => ph.patterns.map(() => 0)),
        aims: d.phases.map((ph) => ph.patterns.map(() => 0)),
        supplyT: 9,
    };
    G.phase = 'boss';
    G.events.push({ type: d.mini ? 'miniboss' : 'boss', key, name: d.name, title: d.title });
}

export function bossData(G) { return G.boss ? BOSSES[G.boss.key] : null; }
export function partPos(B, p) { return { x: B.x + p.dx, y: B.y + p.dy }; }
export function core(B) { return B.parts.find((p) => p.role === 'core'); }

/** Is this part shielded right now (the core during a shielded phase, everything while invulnerable)? */
export function shielded(G, p) {
    const B = G.boss;
    if (!B || B.inv > 0 || B.dying > 0) return true;
    const ph = BOSSES[B.key].phases[B.phase];
    return p.role === 'core' && ph.shielded;
}

/** Total hp share left, for the HUD bar (0..1). */
export function bossHpShare(G) {
    const B = G.boss;
    if (!B) return 0;
    let hp = 0, max = 0;
    for (const p of B.parts) { hp += Math.max(0, p.hp); max += p.max; }
    return max ? hp / max : 0;
}

export function stepBoss(G, dt) {
    const B = G.boss;
    if (!B) return;
    const d = BOSSES[B.key];
    const boat = G.boat;
    B.t += dt;
    if (B.inv > 0) B.inv -= dt;
    for (const p of B.parts) if (p.hit > 0) p.hit -= dt;

    // ride ahead of the boat; ease in from far away at the start
    const wantY = boat.y + SECTOR.bossGap;
    B.y += (wantY - B.y) * Math.min(1, dt * (B.entering ? 1.1 : 3));
    if (B.entering && Math.abs(B.y - wantY) < 3) B.entering = false;
    const r = riverAt(G.river, B.y);
    const swing = Math.min(d.sway, Math.max(0, r.hw - d.w - 1));
    const od = d.phases[B.phase]?.overdrive ? 1.6 : 1;
    B.x = r.cx + Math.sin(B.t * d.swaySpeed * od) * swing;
    B.vy = boat.speed;

    if (B.dying > 0) {
        B.dying -= dt;
        if (Math.floor((B.dying + dt) * 6) !== Math.floor(B.dying * 6)) {
            const p = B.parts[Math.floor(B.t * 7) % B.parts.length];
            G.events.push({ type: 'boom', x: B.x + p.dx, y: B.y + p.dy, big: true });
        }
        if (B.dying <= 0) finishBoss(G);
        return;
    }

    // supply drops: the arena never starves the boat of fuel
    B.supplyT -= dt;
    if (B.supplyT <= 0) {
        B.supplyT = 9;
        const f = ((B.t * 0.37) % 1.4) - 0.7;
        G.pickups.push({ id: G.nextId++, kind: 'cell', x: r.cx + f * (r.hw - 3), y: boat.y + 26, value: 1, t: 0, drift: true });
    }

    if (B.entering || B.inv > 0) return;
    const ph = d.phases[B.phase];
    const timers = B.timers[B.phase], teles = B.tele[B.phase], aims = B.aims[B.phase];
    ph.patterns.forEach((p, i) => {
        const from = B.parts.find((q) => q.id === p.from);
        if (!from || from.dead) return;
        const pos = partPos(B, from);
        const every = p.every / od;
        if (teles[i] > 0) {
            teles[i] -= dt;
            if (teles[i] <= 0) { fire(G, p, pos.x, pos.y, aims[i], B.vy, 'b:' + from.id); timers[i] = every; }
            return;
        }
        timers[i] -= dt;
        if (timers[i] <= 0) {
            teles[i] = p.tele;
            aims[i] = lockAim(G, pos.x, pos.y);
            G.events.push({ type: 'btele', part: from.id, p: p.p, x: pos.x, y: pos.y });
        }
    });
}

/** Damage a part; handles part deaths and phase changes. Returns true if the damage landed. */
export function hitPart(G, p, dmg) {
    const B = G.boss;
    if (!B || p.dead) return false;
    if (shielded(G, p)) { G.events.push({ type: 'deflect', x: B.x + p.dx, y: B.y + p.dy }); return false; }
    p.hp -= dmg;
    p.hit = 0.08;
    if (p.hp <= 0) {
        p.dead = true;
        p.hp = 0;
        G.events.push({ type: 'partdown', id: p.id, role: p.role, x: B.x + p.dx, y: B.y + p.dy });
        G.events.push({ type: 'hitstop', t: 0.07 });
        G.score += 500 * G.mult;
    }
    checkPhase(G);
    return true;
}

function checkPhase(G) {
    const B = G.boss;
    const d = BOSSES[B.key];
    const ph = d.phases[B.phase];
    const c = core(B);
    let done = false;
    if (ph.until === 'parts') done = B.parts.every((p) => p.group !== ph.kill || p.dead);
    else done = c.hp / c.max <= ph.until;
    if (c.dead) done = true;
    if (!done) return;
    if (B.phase >= d.phases.length - 1 || c.dead) {
        // down: every remaining part blows, then the boss sinks
        for (const p of B.parts) if (!p.dead) { p.dead = true; p.hp = 0; }
        B.dying = d.mini ? 1.6 : 3.0;
        cancelBullets(G);
        G.events.push({ type: 'bossdown', key: B.key, mini: B.mini, x: B.x, y: B.y });
        G.events.push({ type: 'hitstop', t: 0.22 });
        return;
    }
    B.phase++;
    B.inv = 1.8;
    cancelBullets(G);
    G.events.push({ type: 'phase', key: B.key, phase: B.phase, name: d.phases[B.phase].name, overdrive: !!d.phases[B.phase].overdrive });
    G.events.push({ type: 'hitstop', t: 0.16 });
}

/** Phase changes clear the screen: every enemy bullet turns into a little score. */
function cancelBullets(G) {
    for (const q of G.bullets) G.events.push({ type: 'cancel', x: q.x, y: q.y });
    G.score += G.bullets.length * 10;
    G.bullets.length = 0;
    G.emitters.length = 0;
    G.lanes.length = 0;
}

function finishBoss(G) {
    const B = G.boss;
    const d = BOSSES[B.key];
    G.score += d.score * G.mult;
    // the cores rain onto the water ahead
    for (let i = 0; i < 8; i++) {
        G.pickups.push({ id: G.nextId++, kind: 'core', x: B.x + (i - 3.5) * 1.6, y: B.y - 6 - (i % 3) * 3, value: Math.ceil(d.cores / 8), t: 0 });
    }
    G.boss = null;
    G.events.push({ type: 'bosskill', key: B.key, mini: B.mini, score: d.score });
    // open the arena: the river carries on after it
    const seg = G.river.segs.find((s) => s.len === Infinity);
    if (seg) { seg.len = Math.max(60, G.boat.y + 70 - seg.y0); seg.cx1 = seg.cx0; seg.hw1 = seg.hw0; G.river.endY = seg.y0 + seg.len; }
    if (B.mini) G.phase = 'run';
    else { G.phase = 'clear'; G.clearT = 3.2; }
}
