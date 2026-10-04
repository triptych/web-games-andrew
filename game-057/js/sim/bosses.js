/**
 * bosses.js — five multi-phase bosses. Each runs a queue of attack patterns
 * (refilled per phase); a pattern is a small state machine stepped by
 * b.t (time left in the current step) and b.k (counter).
 *
 * Telegraphs come first, always: lines for charges, circles for blasts.
 */

import { TAU, clamp, angDiff, emit, hurtPlayer, spawnEnemy, spawnEBullet, spawnHazard, radio, collideCircle } from './core.js';

const PATTERNS = {
    ravager: [['charge', 'stomp', 'charge', 'summon'], ['charge', 'stomp', 'charge', 'summon', 'stomp']],
    goliath: [['sweep', 'missiles', 'pods', 'sweep', 'missiles'], ['sweep', 'mortar', 'missiles', 'pods', 'sweep', 'mortar']],
    zero:    [['blink', 'spiral', 'lash', 'blink', 'ring'], ['blink', 'spiral', 'lash', 'blink', 'ring', 'spiral'], ['blink', 'spiral', 'lash', 'ring', 'blink', 'spiral']],
    widow:   [['scuttle', 'fireballs', 'eruptions', 'scuttle', 'eggs', 'web'], ['scuttle', 'fireballs', 'eruptions', 'spiral', 'scuttle', 'eggs', 'web']],
    mother:  [['fans', 'swarm', 'curtain', 'fans'], ['spirals', 'eggs', 'fans', 'swarm', 'curtain'], ['nova', 'spirals', 'eggs', 'curtain', 'swarm', 'fans']],
};

function arena(w, b) { return w.lv.rooms[b.room]; }
function aimAt(w, b) { return Math.atan2(w.player.y - b.y, w.player.x - b.x); }

function ring(w, x, y, n, speed, off, opts = {}) {
    const gap = opts.gap ?? 0, gapAt = opts.gapAt ?? 0;
    for (let i = 0; i < n; i++) {
        if (gap && ((i - gapAt + n) % n) < gap) continue;
        const a = off + (i / n) * TAU;
        spawnEBullet(w, x + Math.cos(a) * (opts.from ?? 0.5), y + Math.sin(a) * (opts.from ?? 0.5), a, speed, opts);
    }
}

function fan(w, x, y, ang, n, spread, speed, opts) {
    for (let i = 0; i < n; i++) {
        const a = n === 1 ? ang : ang - spread / 2 + (spread * i) / (n - 1);
        spawnEBullet(w, x, y, a, speed, opts);
    }
}

function moveToward(b, tx, ty, speed) {
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d < 0.05) { b.dvx = 0; b.dvy = 0; return d; }
    b.dvx = (dx / d) * speed; b.dvy = (dy / d) * speed;
    return d;
}

function arenaPoint(w, b, minFromPlayer, margin = 3) {
    const r = arena(w, b);
    for (let i = 0; i < 20; i++) {
        const x = w.rng.range(r.x + margin, r.x + r.w - margin), y = w.rng.range(r.y + margin, r.y + r.h - margin);
        if (Math.hypot(x - w.player.x, y - w.player.y) >= minFromPlayer) return { x, y };
    }
    return { x: r.cx, y: r.cy };
}

function callSwarm(w, b, n, extra = {}) {
    const r = arena(w, b);
    const vents = r.vents.filter((v) => Math.hypot(v.x - w.player.x, v.y - w.player.y) > 5);
    const list = vents.length ? vents : r.vents;
    for (let i = 0; i < n && w.enemies.length < w.cap; i++) {
        const v = list[i % list.length];
        spawnEnemy(w, 'skitter', v.x + w.rng.range(-0.3, 0.3), v.y + w.rng.range(-0.3, 0.3), { emerge: 0.6 + i * 0.05, room: b.room });
    }
    for (const type in extra) {
        for (let i = 0; i < extra[type] && w.enemies.length < w.cap; i++) {
            const v = w.rng.pick(list);
            spawnEnemy(w, type, v.x, v.y, { emerge: 0.8, room: b.room, alpha: w.rng.chance(w.alphaChance) });
        }
    }
    emit(w, 'roar', { x: b.x, y: b.y, kind: b.type });
}

function telegraphBlast(w, x, y, r, t, dmg, kind, extra = {}) {
    emit(w, 'target', { x, y, r, t, kind });
    w.delayed.push({ t, fn: 'eblast', x, y, r, dmg, kind, ...extra });
}

function nextPattern(w, b) {
    if (!b.queue || b.queue.length === 0) {
        const list = PATTERNS[b.type][Math.min(b.phase, PATTERNS[b.type].length) - 1];
        b.queue = [...list];
    }
    b.pat = b.queue.shift();
    b.step = 0; b.k = 0; b.t = 0;
}

function idle(b, time) { b.pat = 'idle'; b.step = 0; b.t = time; }

// ------------------------------------------------------------------ Update

export function updateBoss(w, b, dt) {
    const p = w.player;
    b.dvx = 0; b.dvy = 0;
    b.t -= dt;
    b.biteCd -= dt;
    b.anim += dt;
    if (b.state === 'intro') {
        if (b.t <= 0) { b.state = 'fight'; idle(b, 0.6); }
        return;
    }
    // Phase changes.
    const f = b.hp / b.maxHp;
    const phases = PATTERNS[b.type].length;
    const want = phases === 3 ? (f > 0.66 ? 1 : f > 0.33 ? 2 : 3) : (f > 0.5 ? 1 : 2);
    if (want > b.phase) {
        b.phase = want;
        b.queue = [];
        emit(w, 'bossPhase', { kind: b.type, phase: b.phase, x: b.x, y: b.y });
        onPhase(w, b);
        idle(b, 1.0);
        b.invuln = 0.8;
    }
    if (b.invuln) { b.invuln = Math.max(0, b.invuln - dt); if (b.invuln === 0) b.invuln = undefined; }
    // Contact damage.
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (b.biteCd <= 0 && d < b.r + p.r + 0.1 && !b.hidden) {
        if (hurtPlayer(w, b.dmg * (b.pat === 'charge' ? 1.3 : 0.8), { x: b.x, y: b.y, kind: b.type })) {
            const a = Math.atan2(p.y - b.y, p.x - b.x);
            p.kx += Math.cos(a) * 8; p.ky += Math.sin(a) * 8;
        }
        b.biteCd = 1;
    }
    if (b.pat === 'idle') {
        // Drift toward a comfortable distance and face the player.
        const want = b.type === 'mother' ? null : b.type === 'goliath' ? 7 : 5;
        if (want !== null) {
            const a = aimAt(w, b);
            const tx = p.x - Math.cos(a) * want, ty = p.y - Math.sin(a) * want;
            moveToward(b, tx, ty, b.type === 'zero' ? 2.6 : 2.2);
        } else motherSway(w, b, dt);
        turn(b, aimAt(w, b), 3, dt);
        if (b.t <= 0) nextPattern(w, b);
        return;
    }
    const fn = ACT[b.type];
    if (fn(w, b, dt) === true) idle(b, (b.phase >= 3 ? 0.45 : b.phase === 2 ? 0.65 : 0.9) * (w.diff.fireRate > 1 ? 0.85 : 1));
}

function turn(b, ang, rate, dt) {
    const d = angDiff(ang, b.face);
    b.face += clamp(d, -rate * dt, rate * dt);
}

function onPhase(w, b) {
    if (b.type === 'goliath' && b.phase === 2) { b.armor = 1; emit(w, 'armorBreak', { x: b.x, y: b.y }); }
    if (b.type === 'zero') {
        // Split off two clones.
        for (let i = 0; i < 2; i++) {
            const pt = arenaPoint(w, b, 5);
            const c = spawnEnemy(w, 'clone', pt.x, pt.y, { emerge: 0.5, room: b.room });
            c.parent = b.id;
        }
        emit(w, 'split', { x: b.x, y: b.y });
    }
    if (b.type === 'widow' && b.phase === 2) {
        // A ring of fire around the arena edge.
        const r = arena(w, b);
        for (let x = r.x + 1; x < r.x + r.w; x += 2.2) { spawnHazard(w, 'fire', x, r.y + 0.8, 1.1, 9999, 18); spawnHazard(w, 'fire', x, r.y + r.h - 0.8, 1.1, 9999, 18); }
        for (let y = r.y + 3; y < r.y + r.h - 2; y += 2.2) { spawnHazard(w, 'fire', r.x + 0.8, y, 1.1, 9999, 18); spawnHazard(w, 'fire', r.x + r.w - 0.8, y, 1.1, 9999, 18); }
    }
    if (b.type === 'mother') radio(w, b.phase === 2 ? 's4_phase2' : 's4_phase3');
}

function motherSway(w, b, dt) {
    const r = arena(w, b);
    const tx = r.cx + Math.sin(b.anim * 0.35) * (r.w * 0.22);
    moveToward(b, tx, r.y + 3.6, 1.6);
}

// ------------------------------------------------------------------ Ravager

const ACT = {};

ACT.ravager = (w, b, dt) => {
    const p = w.player;
    const ph2 = b.phase >= 2;
    switch (b.pat) {
    case 'charge': {
        if (b.step === 0) {
            b.lx = Math.cos(aimAt(w, b)); b.ly = Math.sin(aimAt(w, b));
            b.step = 1; b.t = ph2 ? 0.7 : 0.9;
            emit(w, 'telegraph', { x: b.x, y: b.y, ang: Math.atan2(b.ly, b.lx), len: 22, width: b.r * 2, t: b.t, id: b.id });
            emit(w, 'roar', { x: b.x, y: b.y, kind: 'ravager' });
        } else if (b.step === 1) {
            turn(b, Math.atan2(b.ly, b.lx), 10, dt);
            if (b.t <= 0) { b.step = 2; b.t = 2.2; b.face = Math.atan2(b.ly, b.lx); }
        } else if (b.step === 2) {
            b.dvx = b.lx * 15; b.dvy = b.ly * 15;
            if (ph2 && (b.k++ % 6) === 0) spawnHazard(w, 'acid', b.x, b.y, 1.1, 4, 12 * w.diff.enemyDmg);
            if (b.wallHit || b.t <= 0) {
                b.step = 3; b.t = ph2 ? 0.9 : 1.3;
                ring(w, b.x, b.y, ph2 ? 18 : 12, 5.5, w.rng.next(), { kind: 'spine', dmg: 10 });
                emit(w, 'thud', { x: b.x, y: b.y, big: true });
            }
        } else if (b.t <= 0) return true;
        break;
    }
    case 'stomp': {
        if (b.step === 0) { b.step = 1; b.t = 0.6; emit(w, 'windup', { x: b.x, y: b.y, kind: 'stomp' }); }
        else if (b.t <= 0) {
            const n = ph2 ? 26 : 20;
            ring(w, b.x, b.y, n, 5.6, aimAt(w, b) + b.k * 0.2, { kind: 'acid', dmg: 11, gap: 3, gapAt: (b.k * 5) % n, r: 0.22 });
            emit(w, 'thud', { x: b.x, y: b.y });
            b.t = ph2 ? 0.32 : 0.42;
            if (++b.k >= 3) return true;
        }
        break;
    }
    case 'summon': {
        if (b.step === 0) {
            callSwarm(w, b, ph2 ? 14 : 10, ph2 ? { drone: 2 } : {});
            b.step = 1; b.t = 1.2;
        } else if (b.t <= 0) return true;
        moveToward(b, p.x, p.y, 2.4);
        break;
    }
    default: return true;
    }
    return false;
};

// ------------------------------------------------------------------ Goliath

ACT.goliath = (w, b, dt) => {
    const ph2 = b.phase >= 2;
    switch (b.pat) {
    case 'sweep': {
        if (b.step === 0) {
            b.step = 1; b.t = 0.5; b.base = aimAt(w, b); b.k = 0;
            emit(w, 'windup', { x: b.x, y: b.y, kind: 'spin' });
        } else if (b.step === 1) {
            if (b.t <= 0) { b.step = 2; b.t = 1.7; b.fireT = 0; }
        } else {
            b.fireT -= dt;
            const prog = 1 - b.t / 1.7;
            const sweep = -1 + prog * 2;
            if (b.fireT <= 0) {
                b.fireT = ph2 ? 0.05 : 0.065;
                const a = b.base + sweep * 1.05;
                spawnEBullet(w, b.x + Math.cos(a) * 1.4, b.y + Math.sin(a) * 1.4, a, 10, { kind: 'slug', dmg: 10, r: 0.17 });
                if (ph2) { const a2 = b.base - sweep * 1.05; spawnEBullet(w, b.x + Math.cos(a2) * 1.4, b.y + Math.sin(a2) * 1.4, a2, 10, { kind: 'slug', dmg: 10, r: 0.17 }); }
                if ((b.k++ % 3) === 0) emit(w, 'eshot', { x: b.x, y: b.y, ang: a, heavy: true });
            }
            b.face = b.base + sweep * 1.05;
            if (b.t <= 0) return true;
        }
        break;
    }
    case 'missiles': {
        if (b.step === 0) {
            const p = w.player;
            const n = ph2 ? 8 : 6;
            for (let i = 0; i < n; i++) {
                const a = w.rng.range(0, TAU), r = i === 0 ? 0 : w.rng.range(1.5, 5);
                const r0 = arena(w, b);
                const x = clamp(p.x + Math.cos(a) * r + p.vx * 0.5, r0.x + 1, r0.x + r0.w - 1);
                const y = clamp(p.y + Math.sin(a) * r + p.vy * 0.5, r0.y + 1, r0.y + r0.h - 1);
                telegraphBlast(w, x, y, 2, 1.25 + i * 0.12, 22, 'missile');
                emit(w, 'missile', { x: b.x, y: b.y, tx: x, ty: y, t: 1.25 + i * 0.12 });
            }
            b.step = 1; b.t = 1.4;
        } else if (b.t <= 0) return true;
        break;
    }
    case 'pods': {
        if (b.step === 0) {
            const r = arena(w, b);
            for (let i = 0; i < (ph2 ? 3 : 2); i++) {
                const v = w.rng.pick(r.vents);
                spawnEnemy(w, 'husk', v.x, v.y, { emerge: 0.9, room: b.room });
            }
            callSwarm(w, b, ph2 ? 8 : 5);
            b.step = 1; b.t = 1;
        } else if (b.t <= 0) return true;
        break;
    }
    case 'mortar': {
        if (b.step === 0) { b.step = 1; b.t = 0.4; }
        else if (b.t <= 0) {
            ring(w, b.x, b.y, 16, 3.6 + b.k * 0.8, b.k * 0.2, { kind: 'plasma', dmg: 12, r: 0.28 });
            emit(w, 'thud', { x: b.x, y: b.y });
            b.t = 0.45;
            if (++b.k >= 3) return true;
        }
        break;
    }
    default: return true;
    }
    return false;
};

// ------------------------------------------------------------------ Specimen Zero

ACT.zero = (w, b, dt) => {
    const ph = b.phase;
    switch (b.pat) {
    case 'blink': {
        if (b.step === 0) { b.step = 1; b.t = 0.35; b.hidden = false; emit(w, 'blinkOut', { x: b.x, y: b.y }); }
        else if (b.step === 1) {
            if (b.t <= 0) {
                spawnHazard(w, 'acid', b.x, b.y, 1.5, 6, 12 * w.diff.enemyDmg);
                const pt = arenaPoint(w, b, 6);
                b.x = pt.x; b.y = pt.y; b.ox = b.x; b.oy = b.y;
                b.hidden = true; b.step = 2; b.t = 0.35;
            }
        } else if (b.step === 2) {
            if (b.t <= 0) {
                b.hidden = false;
                emit(w, 'blinkIn', { x: b.x, y: b.y });
                ring(w, b.x, b.y, 12 + ph * 4, 5.2, w.rng.next() * TAU, { kind: 'plasma', dmg: 10 });
                return true;
            }
        }
        break;
    }
    case 'spiral': {
        if (b.step === 0) { b.step = 1; b.t = 2.4 + ph * 0.3; b.fireT = 0; b.spin = w.rng.chance(0.5) ? 1 : -1; b.k = 0; }
        else {
            b.fireT -= dt;
            if (b.fireT <= 0) {
                b.fireT = 0.085;
                const arms = ph + 2;
                const base = b.k * 0.19 * b.spin;
                for (let i = 0; i < arms; i++) {
                    const a = base + (i / arms) * TAU;
                    spawnEBullet(w, b.x, b.y, a, 4.6, { kind: 'acid', dmg: 9, r: 0.19 });
                }
                b.k++;
            }
            if (b.t <= 0) return true;
        }
        break;
    }
    case 'lash': {
        if (b.step === 0) {
            const a = aimAt(w, b);
            b.lines = [a - 0.55, a, a + 0.55];
            if (ph >= 2) b.lines.push(a - 1.1, a + 1.1);
            for (const l of b.lines) emit(w, 'telegraph', { x: b.x, y: b.y, ang: l, len: 16, width: 0.6, t: 0.7, id: b.id });
            b.step = 1; b.t = 0.7;
        } else if (b.t <= 0) {
            for (const l of b.lines) {
                for (let i = 0; i < 9; i++) {
                    spawnEBullet(w, b.x + Math.cos(l) * (1 + i * 0.4), b.y + Math.sin(l) * (1 + i * 0.4), l, 7 + i * 0.6, { kind: 'spine', dmg: 11, r: 0.18 });
                }
            }
            emit(w, 'slash', { x: b.x, y: b.y, ang: b.lines[1] });
            return true;
        }
        break;
    }
    case 'ring': {
        if (b.step === 0) { b.step = 1; b.t = 0.3; }
        else if (b.t <= 0) {
            ring(w, b.x, b.y, 20, 3.5, b.k * 0.16, { kind: 'plasma', dmg: 10, accel: 2.2 });
            b.t = 0.35;
            if (++b.k >= 2 + ph) return true;
        }
        break;
    }
    default: return true;
    }
    return false;
};

// ------------------------------------------------------------------ Magma Widow

ACT.widow = (w, b, dt) => {
    const ph2 = b.phase >= 2;
    switch (b.pat) {
    case 'scuttle': {
        if (b.step === 0) { const pt = arenaPoint(w, b, 6, 3.5); b.tx = pt.x; b.ty = pt.y; b.step = 1; b.t = 2.2; }
        const d = moveToward(b, b.tx, b.ty, ph2 ? 8 : 6.5);
        turn(b, Math.atan2(b.dvy, b.dvx), 6, dt);
        if (d < 0.4 || b.t <= 0 || b.wallHit) return true;
        break;
    }
    case 'fireballs': {
        if (b.step === 0) { b.step = 1; b.t = 0.35; emit(w, 'windup', { x: b.x, y: b.y, kind: 'fire' }); }
        else if (b.t <= 0) {
            fan(w, b.x, b.y, aimAt(w, b) + (b.k % 2 ? 0.08 : -0.08), ph2 ? 9 : 7, 1.1, 6.8, { kind: 'fire', dmg: 12, r: 0.26 });
            emit(w, 'eshot', { x: b.x, y: b.y, ang: aimAt(w, b), fire: true });
            b.t = ph2 ? 0.4 : 0.55;
            if (++b.k >= 3) return true;
        }
        turn(b, aimAt(w, b), 4, dt);
        break;
    }
    case 'eruptions': {
        if (b.step === 0) {
            const p = w.player, r = arena(w, b);
            const n = ph2 ? 10 : 7;
            for (let i = 0; i < n; i++) {
                const x = i === 0 ? p.x : clamp(p.x + w.rng.range(-6, 6), r.x + 1, r.x + r.w - 1);
                const y = i === 0 ? p.y : clamp(p.y + w.rng.range(-6, 6), r.y + 1, r.y + r.h - 1);
                telegraphBlast(w, x, y, 1.7, 1.0 + i * 0.09, 20, 'magma', { hazard: 'fire' });
            }
            b.step = 1; b.t = 1.6;
        } else if (b.t <= 0) return true;
        break;
    }
    case 'eggs': {
        if (b.step === 0) {
            let sacs = 0;
            for (const e of w.enemies) if (e.type === 'sac' && !e.dead) sacs++;
            if (sacs < 3) {
                const a = w.rng.range(0, TAU);
                const s = spawnEnemy(w, 'sac', b.x + Math.cos(a) * 2.6, b.y + Math.sin(a) * 2.6, { emerge: 0.5, room: b.room });
                collideCircle(w.lv, s);
                s.hp *= 0.6; s.maxHp *= 0.6;
            }
            callSwarm(w, b, ph2 ? 6 : 4);
            b.step = 1; b.t = 0.9;
        } else if (b.t <= 0) return true;
        break;
    }
    case 'web': {
        if (b.step === 0) { b.step = 1; b.t = 0.25; }
        else if (b.t <= 0) {
            fan(w, b.x, b.y, aimAt(w, b), 5, 0.8, 5.2, { kind: 'web', dmg: 6, r: 0.3, slow: 2 });
            b.t = 0.4;
            if (++b.k >= 2) return true;
        }
        break;
    }
    case 'spiral': {
        if (b.step === 0) { b.step = 1; b.t = 2.6; b.fireT = 0; b.k = 0; }
        else {
            b.fireT -= dt;
            if (b.fireT <= 0) {
                b.fireT = 0.11;
                for (let i = 0; i < 4; i++) {
                    const a = b.k * 0.23 + (i / 4) * TAU;
                    spawnEBullet(w, b.x, b.y, a, 5, { kind: 'fire', dmg: 10, r: 0.22, curve: 0.25 });
                }
                b.k++;
            }
            if (b.t <= 0) return true;
        }
        break;
    }
    default: return true;
    }
    return false;
};

// ------------------------------------------------------------------ Brood Mother

ACT.mother = (w, b, dt) => {
    const ph = b.phase;
    motherSway(w, b, dt);
    switch (b.pat) {
    case 'fans': {
        if (b.step === 0) { b.step = 1; b.t = 0.4; emit(w, 'windup', { x: b.x, y: b.y, kind: 'spit' }); }
        else if (b.t <= 0) {
            const a = aimAt(w, b);
            fan(w, b.x, b.y + 1.5, a + (b.k % 2 ? 0.09 : -0.09), 9 + ph * 2, 1.2, 6 + ph * 0.5, { kind: 'acid', dmg: 11, r: 0.22 });
            emit(w, 'spit', { x: b.x, y: b.y, big: true });
            b.t = 0.5 - ph * 0.05;
            if (++b.k >= 3 + ph) return true;
        }
        break;
    }
    case 'swarm': {
        if (b.step === 0) {
            callSwarm(w, b, 12 + ph * 5, ph >= 2 ? { drone: ph - 1, spitter: ph >= 3 ? 1 : 0 } : {});
            b.step = 1; b.t = 1.4;
        } else if (b.t <= 0) return true;
        break;
    }
    case 'curtain': {
        if (b.step === 0) {
            const r = arena(w, b);
            b.step = 1; b.t = 0.6; b.k = 0;
            b.gapX = w.rng.range(r.x + 3, r.x + r.w - 3);
            emit(w, 'windup', { x: b.x, y: b.y, kind: 'tail' });
        } else if (b.t <= 0) {
            const r = arena(w, b);
            const gapW = 3.2 - ph * 0.3;
            for (let x = r.x + 0.5; x < r.x + r.w; x += 0.85) {
                if (Math.abs(x - b.gapX) < gapW / 2) continue;
                spawnEBullet(w, x, r.y + 1.2, Math.PI / 2, 4.2 + ph * 0.3, { kind: 'spine', dmg: 12, r: 0.2, life: 8 });
            }
            b.gapX = clamp(b.gapX + w.rng.range(-4, 4), r.x + 3, r.x + r.w - 3);
            b.t = 1.1;
            if (++b.k >= 2) return true;
        }
        break;
    }
    case 'spirals': {
        if (b.step === 0) { b.step = 1; b.t = 3; b.fireT = 0; b.k = 0; }
        else {
            b.fireT -= dt;
            if (b.fireT <= 0) {
                b.fireT = 0.1;
                for (let i = 0; i < 3; i++) {
                    const a1 = b.k * 0.17 + (i / 3) * TAU, a2 = -b.k * 0.17 + (i / 3) * TAU + 0.5;
                    spawnEBullet(w, b.x, b.y + 1, a1, 4.6, { kind: 'plasma', dmg: 10, r: 0.2 });
                    spawnEBullet(w, b.x, b.y + 1, a2, 4.6, { kind: 'acid', dmg: 10, r: 0.2 });
                }
                b.k++;
            }
            if (b.t <= 0) return true;
        }
        break;
    }
    case 'eggs': {
        if (b.step === 0) {
            const p = w.player, r = arena(w, b);
            const n = 4 + ph;
            for (let i = 0; i < n; i++) {
                const x = clamp(p.x + w.rng.range(-6, 6), r.x + 1.5, r.x + r.w - 1.5);
                const y = clamp(p.y + w.rng.range(-5, 5), r.y + 4, r.y + r.h - 1.5);
                emit(w, 'target', { x, y, r: 1.2, t: 1.1 + i * 0.1, kind: 'egg' });
                emit(w, 'lob', { x: b.x, y: b.y, tx: x, ty: y, t: 1.1 + i * 0.1 });
                w.delayed.push({ t: 1.1 + i * 0.1, fn: 'egg', x, y, room: b.room, r: 1.2, dmg: 14 });
            }
            b.step = 1; b.t = 1.6;
        } else if (b.t <= 0) return true;
        break;
    }
    case 'nova': {
        if (b.step === 0) { b.step = 1; b.t = 0.5; emit(w, 'windup', { x: b.x, y: b.y, kind: 'nova' }); }
        else if (b.t <= 0) {
            ring(w, b.x, b.y + 1, 28, 4.4 + b.k * 0.6, b.k * 0.11, { kind: b.k % 2 ? 'acid' : 'plasma', dmg: 11, r: 0.2 });
            fan(w, b.x, b.y + 1, aimAt(w, b), 3, 0.25, 8, { kind: 'spine', dmg: 12 });
            emit(w, 'thud', { x: b.x, y: b.y, big: true });
            b.t = 0.55;
            if (++b.k >= 3) return true;
        }
        break;
    }
    default: return true;
    }
    return false;
};

// ------------------------------------------------------------------ Clones (Specimen Zero's split-offs)

export function updateClone(w, e, dt) {
    const p = w.player;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.t -= dt; e.cd -= dt;
    if (d > 7) { e.dvx = (dx / d) * e.speed; e.dvy = (dy / d) * e.speed; }
    else { e.dvx = (-dy / d) * e.speed * 0.6; e.dvy = (dx / d) * e.speed * 0.6; }
    e.face = Math.atan2(dy, dx);
    if (e.cd <= 0) {
        e.cd = 2.4 + e.seed;
        ring(w, e.x, e.y, 10, 4.5, w.rng.next() * TAU, { kind: 'plasma', dmg: 9 });
        emit(w, 'spit', { x: e.x, y: e.y });
    }
}
