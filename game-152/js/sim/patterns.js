// Enemy bullet patterns, shared by small enemies and bosses. Pure.
// Every pattern is aimed once, when its telegraph starts (`lockAim`), so the warning shows exactly where it goes.

const SPEED = { bullet: 21, shell: 34, ring: 15, missile: 13 };

export function angleTo(x0, y0, x1, y1) { return Math.atan2(y1 - y0, x1 - x0); }

/** The direction a pattern will fire in: toward where the boat is now, seen from the shooter. */
export function lockAim(G, x, y) { return angleTo(x, y, G.boat.x, G.boat.y); }

function bullet(G, x, y, a, spd, carrierVy, kind = 'bullet', extra = {}) {
    G.bullets.push({
        id: G.nextId++, kind, x, y,
        vx: Math.cos(a) * spd, vy: carrierVy + Math.sin(a) * spd,
        life: kind === 'shell' ? 3 : 5, r: kind === 'shell' ? 0.55 : 0.45, ...extra,
    });
}

/**
 * Fire pattern `p` from (x, y). aim = the locked angle; carrierVy = the shooter's own speed downriver, which the
 * bullets inherit (a boss keeping pace with the boat fires bullets that keep pace too).
 */
export function fire(G, p, x, y, aim, carrierVy, owner) {
    const n = p.n || 1;
    switch (p.p || p.pattern) {
        case 'aimed':
            for (let i = 0; i < n; i++) bullet(G, x, y, aim + (i - (n - 1) / 2) * 0.07, SPEED.bullet * (1 - i * 0.06), carrierVy);
            break;
        case 'shell':
            bullet(G, x, y, aim, SPEED.shell, carrierVy, 'shell');
            break;
        case 'fan': {
            const s = p.spread || 0.5;
            for (let i = 0; i < n; i++) bullet(G, x, y, aim - s / 2 + (n > 1 ? (s * i) / (n - 1) : s / 2), SPEED.bullet, carrierVy);
            break;
        }
        case 'ring':
            for (let i = 0; i < n; i++) bullet(G, x, y, aim + (i / n) * Math.PI * 2, SPEED.ring, carrierVy);
            break;
        case 'sweep': {
            const arc = p.arc || 1.4;
            G.emitters.push({ owner, x, y, a: aim - arc / 2, da: arc / Math.max(1, n - 1), left: n, every: 0.06, t: 0, carrierVy });
            break;
        }
        case 'missile':
            for (let i = 0; i < n; i++) {
                const a = aim + (i - (n - 1) / 2) * 0.9;
                bullet(G, x, y, a, SPEED.missile, carrierVy, 'missile', { hp: 1, life: 6, r: 0.6, turn: 1.7 });
            }
            break;
        case 'lane':
            G.lanes.push({ id: G.nextId++, owner, x: G.boat.x, w: p.w || 3, tele: p.tele || 1.2, dur: p.dur || 0.7, t: 0, y0: y });
            break;
    }
    G.events.push({ type: 'efire', p: p.p || p.pattern, x, y, n });
}

/** Sweeps fire their bullets one at a time. */
export function stepEmitters(G, dt) {
    for (let i = G.emitters.length - 1; i >= 0; i--) {
        const e = G.emitters[i];
        // follow the owner if it still exists (a boss part), so the sweep comes from the gun
        const o = e.owner && findOwner(G, e.owner);
        if (o) { e.x = o.x; e.y = o.y; }
        e.t -= dt;
        while (e.t <= 0 && e.left > 0) {
            bullet(G, e.x, e.y, e.a, SPEED.bullet * 0.95, e.carrierVy);
            e.a += e.da; e.left--; e.t += e.every;
        }
        if (e.left <= 0) G.emitters.splice(i, 1);
    }
}

/** An owner is 'e:<id>' (an enemy) or 'b:<part id>' (a boss part). */
export function findOwner(G, owner) {
    if (owner.startsWith('e:')) {
        const id = +owner.slice(2);
        const e = G.enemies.find((q) => q.id === id);
        return e ? { x: e.x, y: e.y } : null;
    }
    if (owner.startsWith('b:') && G.boss) {
        const part = G.boss.parts.find((q) => q.id === owner.slice(2));
        return part && !part.dead ? { x: G.boss.x + part.dx, y: G.boss.y + part.dy } : { x: G.boss.x, y: G.boss.y };
    }
    return null;
}

/** Move enemy bullets; missiles steer toward the boat. */
export function stepBullets(G, dt) {
    const b = G.boat;
    for (let i = G.bullets.length - 1; i >= 0; i--) {
        const q = G.bullets[i];
        if (q.kind === 'missile') {
            const want = Math.atan2(b.y - q.y, b.x - q.x);
            const rvx = q.vx, rvy = q.vy - b.speed;            // steer in the boat's frame
            let a = Math.atan2(rvy, rvx);
            let d = want - a;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            a += Math.max(-q.turn * dt, Math.min(q.turn * dt, d));
            const s = Math.hypot(rvx, rvy) || SPEED.missile;
            q.vx = Math.cos(a) * s; q.vy = b.speed + Math.sin(a) * s;
        }
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.life -= dt;
        if (q.life <= 0 || q.y < b.y - 30) G.bullets.splice(i, 1);
    }
    for (let i = G.lanes.length - 1; i >= 0; i--) {
        const l = G.lanes[i];
        l.t += dt;
        if (G.boss) l.y0 = G.boss.y;
        if (l.t >= l.tele && !l.live) { l.live = true; G.events.push({ type: 'lane', x: l.x }); }
        if (l.t >= l.tele + l.dur) G.lanes.splice(i, 1);
    }
}
