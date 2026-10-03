// A dodging bot that plays the real simulation. Every few steps it scores
// nine candidate moves (and a focused variant) by how close each would bring
// it to bullets, lasers and air bodies over the next ~0.35 s, plus a pull
// towards lining up under a target and staying in the lower part of the field.

export function makeBot(w, opts = {}) {
    let choice = { mx: 0, my: 0, focus: false };
    let k = 0;
    const dirs = [[0, 0]];
    for (let i = 0; i < 8; i++) dirs.push([Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
    return function think() {
        const p = w.player;
        if (k++ % 3 === 0 && p.alive) choice = decide(w, dirs, opts);
        const fire = true;
        const bomb = opts.bombs && danger(w, p.x, p.y, 0.15) > 2.5 && p.bombs > 0 && p.invuln <= 0;
        const od = p.od >= 1;
        return { mx: choice.mx, my: choice.my, focus: choice.focus, fire, bomb, od };
    };
}

function target(w) {
    const b = w.boss;
    if (b && b.alive && !b.entering) {
        const t = w.bossTarget(b);
        if (t) return t;
    }
    let best = null, bd = 1e9;
    for (const e of w.enemies) {
        if (!e.alive || e.delay > 0 || e.def.noHit || e.y < 0 || e.y > w.H * 0.75) continue;
        const d = Math.abs(e.x - w.player.x) + (e.def.size === 'l' ? -200 : 0);
        if (d < bd) { bd = d; best = e; }
    }
    // a rescue beacon in reach beats shooting
    for (const e of w.enemies) {
        if (e.kind === 'beacon' && e.alive && !e.data.done && e.y > w.H * 0.3 && e.y < w.H - 40) return { x: e.x, y: e.y, beacon: true };
    }
    return best;
}

function danger(w, x, y, horizon, vx = 0, vy = 0) {
    let d = 0;
    const steps = [0, horizon * 0.25, horizon * 0.5, horizon * 0.75, horizon];
    const R = w.player.r;
    for (const b of w.bs.list) {
        if (b.delay > 0) {
            if (b.delay < horizon) { const dx = b.x - x, dy = b.y - y; if (dx * dx + dy * dy < 1600) d += 3; }
            continue;
        }
        const dx0 = b.x - x, dy0 = b.y - y;
        if (dx0 * dx0 + dy0 * dy0 > 200 * 200) continue;
        for (const t of steps) {
            const px = Math.max(14, Math.min(w.W - 14, x + vx * t)), py = Math.max(26, Math.min(w.H - 22, y + vy * t));
            const bx = b.x + b.vx * t * w.bulletTime, by = b.y + b.vy * t * w.bulletTime;
            const dx = bx - px, dy = by - py;
            const r = b.r + R + 5;
            const d2 = dx * dx + dy * dy;
            if (d2 < r * r) d += 6 / (1 + t * 3);
            else if (d2 < (r + 12) * (r + 12)) d += 0.25;
        }
    }
    for (const l of w.bs.lasers) {
        for (const t of [0, horizon]) {
            const px = x + vx * t, py = y + vy * t;
            const ang = l.ang + (l.live ? l.sweep * t : 0);
            const dx = Math.cos(ang), dy = Math.sin(ang);
            const rx = px - l.x, ry = py - l.y;
            const u = Math.max(0, Math.min(l.len, rx * dx + ry * dy));
            const qx = l.x + dx * u - px, qy = l.y + dy * u - py;
            const dist = Math.sqrt(qx * qx + qy * qy);
            const reach = l.width * 0.5 + 16;
            if (dist < reach) d += l.live ? 8 : (l.t > l.warm - 0.6 ? 5 : 1);
        }
    }
    for (const e of w.enemies) {
        if (!e.alive || e.ground || e.def.noHit || e.delay > 0) continue;
        if (e.boss) {
            if (!e.parts) continue;
            for (const p of e.parts) { if (!p.alive) continue; const dx = p.x - x, dy = p.y - y; if (dx * dx + dy * dy < (p.r + 30) ** 2) d += 5; }
            continue;
        }
        const ex = e.x + (e.x - e.px) * 120 * horizon, ey = e.y + (e.y - e.py) * 120 * horizon;
        const dx = ex - x - vx * horizon, dy = ey - y - vy * horizon;
        if (dx * dx + dy * dy < (e.r + 22) ** 2) d += 5;
    }
    return d;
}

function decide(w, dirs, opts) {
    const p = w.player;
    const tgt = target(w);
    let best = null, bs = Infinity;
    for (const focus of [false, true]) {
        const spd = 300 * w.L.speedMul * (focus ? 0.45 : 1);
        for (const [dx, dy] of dirs) {
            const x = Math.max(14, Math.min(w.W - 14, p.x + dx * spd * 0.3));
            const y = Math.max(26, Math.min(w.H - 22, p.y + dy * spd * 0.3));
            let s = danger(w, p.x, p.y, 0.4, dx * spd, dy * spd) * 10;
            const wantY = tgt && tgt.beacon ? tgt.y : w.H * 0.8;
            s += Math.abs(y - wantY) * 0.02;
            if (tgt) s += Math.abs(x - tgt.x) * (tgt.beacon ? 0.05 : 0.03);
            if (x < 40 || x > w.W - 40) s += 1;
            if (focus) s += 0.15;
            if (s < bs) { bs = s; best = { mx: dx, my: dy, focus }; }
        }
    }
    return best;
}
