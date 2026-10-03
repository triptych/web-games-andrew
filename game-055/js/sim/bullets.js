// Enemy bullets and the pattern vocabulary bosses and enemies are written in.
//
// A bullet is a plain object (pooled). It flies in a straight line unless it
// has acceleration or angular velocity, and it can carry one scheduled change
// (`then`: stop, re-aim, curve, speed up) and/or a `split` into a ring.

export const STYLE = {
    pellet: { r: 3.2, size: 10 },
    orb: { r: 5, size: 16 },
    rice: { r: 3, size: 15, long: true },
    star: { r: 5, size: 16, spin: true },
    big: { r: 11, size: 34 },
    arrow: { r: 3.6, size: 14, long: true },
    ring: { r: 5.5, size: 17 },
    bubble: { r: 8, size: 24 },
    needle: { r: 2.6, size: 18, long: true },
};

// Palette indices: the renderer maps these to colours.
export const C = { red: 0, orange: 1, yellow: 2, green: 3, cyan: 4, blue: 5, purple: 6, pink: 7, white: 8 };

const TAU = Math.PI * 2;

export function makeBulletSystem() {
    const pool = [];
    return {
        list: [],
        lasers: [],
        alloc() {
            const b = pool.pop() || {};
            b.alive = true; b.t = 0; b.delay = 0; b.grazed = false;
            b.acc = 0; b.angVel = 0; b.maxSpd = 9999; b.minSpd = 0;
            b.then = null; b.split = null; b.home = 0; b.life = 14; b.spin = 0;
            return b;
        },
        free(b) { pool.push(b); },
    };
}

/** Spawn one bullet. `o` may carry acc, angVel, maxSpd, minSpd, then, split, delay, home, life. */
export function shoot(w, x, y, ang, spd, style = 'orb', color = C.red, o) {
    const sys = w.bs;
    if (sys.list.length > 2400) return null;
    const b = sys.alloc();
    const st = STYLE[style] || STYLE.orb;
    b.x = x; b.y = y; b.ang = ang; b.spd = spd * w.bspd;
    b.vx = Math.cos(ang) * b.spd; b.vy = Math.sin(ang) * b.spd;
    b.style = style; b.color = color; b.r = st.r;
    if (o) {
        if (o.acc) b.acc = o.acc * w.bspd;
        if (o.angVel) b.angVel = o.angVel;
        if (o.maxSpd) b.maxSpd = o.maxSpd * w.bspd;
        if (o.minSpd) b.minSpd = o.minSpd * w.bspd;
        if (o.then) b.then = o.then;
        if (o.split) b.split = o.split;
        if (o.delay) b.delay = o.delay;
        if (o.home) b.home = o.home;
        if (o.life) b.life = o.life;
    }
    sys.list.push(b);
    return b;
}

export function aimAngle(w, x, y) {
    const p = w.player;
    return Math.atan2(p.y - y, p.x - x);
}

/** n bullets evenly around a circle starting at a0. */
export function ring(w, x, y, n, spd, a0, style, color, o) {
    for (let i = 0; i < n; i++) shoot(w, x, y, a0 + (i / n) * TAU, spd, style, color, o);
}

/** n bullets fanned across `spread` radians centred on ang. */
export function fan(w, x, y, n, spread, ang, spd, style, color, o) {
    if (n <= 1) { shoot(w, x, y, ang, spd, style, color, o); return; }
    for (let i = 0; i < n; i++) shoot(w, x, y, ang - spread / 2 + spread * (i / (n - 1)), spd, style, color, o);
}

/** A fan aimed at the player. */
export function aimed(w, x, y, n, spread, spd, style, color, o) {
    fan(w, x, y, n, spread, aimAngle(w, x, y), spd, style, color, o);
}

/** A column of bullets at increasing speeds along one angle (a "stack"). */
export function stack(w, x, y, ang, n, spd0, spd1, style, color, o) {
    for (let i = 0; i < n; i++) shoot(w, x, y, ang, spd0 + (spd1 - spd0) * (n > 1 ? i / (n - 1) : 0), style, color, o);
}

/** Scale a count by difficulty density, keeping at least `min`. */
export function dens(w, n, min = 1) { return Math.max(min, Math.round(n * w.dens)); }

/**
 * A laser: telegraphed for `warm` seconds (harmless thin line), then live for `dur`.
 * `follow` keeps the origin on an entity (+ offset); `sweep` turns it (rad/s).
 */
export function laser(w, x, y, ang, o = {}) {
    const L = {
        x, y, ang, len: o.len ?? 1400, width: o.width ?? 14, warm: o.warm ?? 0.9, dur: o.dur ?? 1.2,
        sweep: o.sweep ?? 0, t: 0, follow: o.follow ?? null, ox: o.ox ?? 0, oy: o.oy ?? 0,
        color: o.color ?? C.pink, alive: true, live: false, aimDuringWarm: o.aim ?? false,
    };
    w.bs.lasers.push(L);
    w.ev('laserWarm', { x, y });
    return L;
}

export function stepBullets(w, dt) {
    const sys = w.bs;
    const list = sys.list;
    const ts = w.bulletTime;
    const p = w.player;
    const W = w.W, H = w.H;
    for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        if (b.delay > 0) { b.delay -= dt; if (b.delay > 0) continue; }
        b.t += dt * ts;
        const t = b.t;
        if (b.then && t >= b.then.at) {
            const th = b.then;
            b.then = th.next || null;
            if (th.aim) b.ang = Math.atan2(p.y - b.y, p.x - b.x) + (th.aimOff || 0);
            if (th.dAng) b.ang += th.dAng;
            if (th.ang !== undefined) b.ang = th.ang;
            if (th.spd !== undefined) b.spd = th.spd * w.bspd;
            if (th.acc !== undefined) b.acc = th.acc * w.bspd;
            if (th.angVel !== undefined) b.angVel = th.angVel;
            if (th.maxSpd !== undefined) b.maxSpd = th.maxSpd * w.bspd;
            if (th.style) { b.style = th.style; b.r = STYLE[th.style].r; }
            if (th.color !== undefined) b.color = th.color;
            b.vx = Math.cos(b.ang) * b.spd; b.vy = Math.sin(b.ang) * b.spd;
        }
        if (b.acc !== 0 || b.angVel !== 0 || b.home !== 0) {
            if (b.acc !== 0) b.spd = Math.min(b.maxSpd, Math.max(b.minSpd, b.spd + b.acc * dt * ts));
            if (b.angVel !== 0) b.ang += b.angVel * dt * ts;
            if (b.home !== 0 && t < 2.2) {
                const want = Math.atan2(p.y - b.y, p.x - b.x);
                let d = want - b.ang;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                b.ang += Math.max(-b.home * dt, Math.min(b.home * dt, d));
            }
            b.vx = Math.cos(b.ang) * b.spd; b.vy = Math.sin(b.ang) * b.spd;
        }
        b.x += b.vx * dt * ts;
        b.y += b.vy * dt * ts;
        if (b.split && t >= b.split.at) {
            const s = b.split;
            const a0 = s.aim ? Math.atan2(p.y - b.y, p.x - b.x) : (s.a0 ?? b.ang);
            ring(w, b.x, b.y, s.n, s.spd, a0, s.style || 'pellet', s.color ?? b.color, s.o);
            w.ev('split', { x: b.x, y: b.y, color: b.color });
            killAt(list, i, sys);
            continue;
        }
        const m = b.r + 30;
        if (b.x < -m || b.x > W + m || b.y < -m - 60 || b.y > H + m || t > b.life) killAt(list, i, sys);
    }
    // lasers
    const L = sys.lasers;
    for (let i = L.length - 1; i >= 0; i--) {
        const l = L[i];
        l.t += dt;
        if (l.follow) {
            if (!l.follow.alive) { L.splice(i, 1); continue; }
            l.x = l.follow.x + l.ox; l.y = l.follow.y + l.oy;
        }
        if (l.t < l.warm) {
            if (l.aimDuringWarm) l.ang = Math.atan2(p.y - l.y, p.x - l.x);
        } else {
            if (!l.live) { l.live = true; w.ev('laserFire', { x: l.x, y: l.y }); }
            l.ang += l.sweep * dt * ts;
        }
        if (l.t > l.warm + l.dur) L.splice(i, 1);
    }
}

function killAt(list, i, sys) {
    const b = list[i];
    b.alive = false;
    list[i] = list[list.length - 1];
    list.pop();
    sys.free(b);
}

/** Remove every enemy bullet; returns their positions for effects and score. */
export function cancelAll(w, reason = 'bomb') {
    const sys = w.bs;
    const out = [];
    for (const b of sys.list) { if (b.delay <= 0) out.push(b.x, b.y, b.color); b.alive = false; sys.free(b); }
    sys.list.length = 0;
    sys.lasers.length = 0;
    if (out.length) w.ev('cancel', { pts: out, reason });
    return out.length / 3;
}

/** Distance from point to a laser's segment. */
export function laserDist(l, px, py) {
    const dx = Math.cos(l.ang), dy = Math.sin(l.ang);
    const rx = px - l.x, ry = py - l.y;
    const t = Math.max(0, Math.min(l.len, rx * dx + ry * dy));
    const qx = l.x + dx * t - px, qy = l.y + dy * t - py;
    return Math.sqrt(qx * qx + qy * qy);
}
