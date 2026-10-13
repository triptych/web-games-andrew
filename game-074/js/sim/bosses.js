// The seven wardens of the Pit. Each boss is a set of hit circles ("parts")
// moved by its step function. A part may be:
//   core  — its death ends the fight
//   armor — shots spark off it (it may stop being armor: an opening jaw, an eye)
//   body  — touching it hurts
// Patterns run on a looping clock so every fight can be learned: the same
// attack always follows the same tell.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function P(name, ox, oy, r, hp, flags = {}) {
    return { name, ox, oy, x: 0, y: 0, r, hp, alive: true, ...flags };
}
function place(b) {
    for (const p of b.parts) if (!p.free) { p.x = b.x + p.ox; p.y = b.y + p.oy; }
}
const part = (b, name) => b.parts.find((p) => p.name === name);

/** Advance the boss's looping clock; crossed(t) is true on the step it passes t. */
function clock(b, dt, period, rate = 1) {
    b.loop = b.loop ?? 0;
    b.pct = b.ct ?? 0;
    b.ct = (b.ct ?? 0) + dt * rate;
    if (b.ct >= period) { b.ct -= period; b.pct -= period; b.loop = (b.loop ?? 0) + 1; }
}
const crossed = (b, t) => b.pct < t && b.ct >= t;
const within = (b, t0, t1) => b.ct >= t0 && b.ct < t1;
function every(b, key, gap, dt, rate = 1) {
    b.tm = b.tm || {};
    b.tm[key] = (b.tm[key] ?? 0) - dt * rate;
    if (b.tm[key] <= 0) { b.tm[key] += gap; return true; }
    return false;
}

function enter(b, w, dt, tx, ty, dur = 3.2, k = 1.4) {
    b.x += (tx - b.x) * Math.min(1, k * dt);
    b.y += (ty - b.y) * Math.min(1, k * dt);
    place(b);
    if (b.t > dur) { b.st = 'fight'; b.ct = 0; b.pct = 0; w.fx('bossFight', { kind: b.kind }); }
}

/** A curtain of needles with a gap: the Ferryman's scythe. */
function bladeWave(w, x, gapY, gap = 1.7, speed = 7) {
    for (let y = 0.5; y < 17.6; y += 0.5) {
        if (Math.abs(y - gapY) < gap) continue;
        const off = 0.06 * (y - gapY) * (y - gapY);
        w.fire(x + off, y, Math.PI, speed, 'needle', { noWall: true });
    }
    w.fx('blade', { x, y: gapY });
}

export const BOSSES = {
    // ================================================================ 1. the Cradle
    gorrmaw: {
        name: 'GORRMAW', title: 'Warden of the Cradle', score: 30000,
        init(b) {
            b.x = 25.6; b.y = -7; b.open = 0;
            b.parts = [
                P('core', -1.9, -0.9, 1.0, 1150, { core: true, armor: true, score: 0 }),
                P('hornL', -1.3, 3.5, 0.72, 150, { score: 3000 }),
                P('hornR', 1.1, 4.0, 0.72, 150, { score: 3000 }),
                P('skull', 0.6, 0.9, 2.5, Infinity, { armor: true, body: true }),
                P('jaw', -0.8, -2.4, 1.35, Infinity, { armor: true, body: true }),
                P('neck', 1.9, -4.6, 2.0, Infinity, { armor: true, body: true }),
            ];
            place(b);
        },
        frac: (b) => { const c = part(b, 'core'); return c.hp / c.max; },
        step(b, w, dt) {
            if (b.st === 'enter') return enter(b, w, dt, 25.6, 8.6, 3.4, 1.2);
            const core = part(b, 'core'), hornL = part(b, 'hornL'), hornR = part(b, 'hornR'), jaw = part(b, 'jaw');
            const hard = core.hp < core.max * 0.5;
            clock(b, dt, 12);
            b.y = 8.6 + Math.sin(b.t * 0.7) * 0.8;
            const want = within(b, 2.0, 5.7) || within(b, 9.8, 11.9) ? 1 : 0;
            b.open += (want - b.open) * Math.min(1, 5 * dt);
            core.armor = b.open < 0.55;
            jaw.oy = -2.4 - b.open * 1.0;
            core.oy = -0.9 - b.open * 0.3;
            place(b);
            const mx = core.x - 0.4, my = core.y;
            // horns: aimed triples
            if ((within(b, 0, 2) || within(b, 6.6, 8.2)) && every(b, 'horn', 0.55, dt, w.D.rate)) {
                for (const h of [hornL, hornR]) if (h.alive) w.fan(h.x, h.y, w.aim(h.x, h.y), 3, 0.42, 7.2, 'orb');
            }
            // the fire stream
            if (within(b, 2.6, 5.5) && every(b, 'stream', hard ? 0.05 : 0.06, dt, w.D.rate)) {
                const k = (b.ct - 2.6) * 2.2;
                w.fire(mx, my, Math.PI + 0.62 * Math.sin(k), 8.4, 'fire');
                if (hard) w.fire(mx, my, Math.PI - 0.62 * Math.sin(k), 8.4, 'fire');
            }
            if (crossed(b, 2.4)) w.fx('roar', { x: mx, y: my });
            // lava geysers under and around the angel
            if (crossed(b, 6.2)) {
                const px = w.player.x;
                for (const dx of hard ? [-12, -6, 0, 6] : [-6.5, 0, 6.5]) {
                    const x = clamp(px + dx, 1, 21);
                    w.spawn('geyser', { x, tel: 1.0, dur: 1.2, h: 11 });
                }
            }
            // ember rain
            if (within(b, 8.0, 9.6) && every(b, 'rain', hard ? 0.09 : 0.13, dt, w.D.rate)) {
                w.fire(w.rng.range(2, 30), 18.8, -Math.PI / 2 - 0.12, 5.2, 'fire', { noWall: true });
            }
            if (crossed(b, 10.3)) w.fan(mx, my, w.aim(mx, my), hard ? 9 : 7, 1.3, 6.4, 'big');
        },
    },

    // ================================================================ 2. the Bone Orchard
    wyrm: {
        name: 'THE OSSUARY WYRM', title: 'Coil of a Thousand Saints', score: 35000,
        init(b) {
            b.x = 17; b.y = 9; b.s = 0.5; b.enter = 1;
            b.parts = [P('head', 0, 0, 0.95, 1300, { core: true, body: true, free: true })];
            for (let i = 0; i < 14; i++) {
                b.parts.push(P('seg' + i, 0, 0, 0.74 - i * 0.022, 52, { body: true, free: true, score: 600, seg: i }));
            }
            this.pose(b);
        },
        path(b, s) {
            const ex = b.enter * 18;
            return [17 + ex + 11.8 * Math.sin(s), 9 + 6.3 * Math.sin(2 * s)];
        },
        pose(b) {
            const [hx, hy] = this.path(b, b.s);
            const [qx, qy] = this.path(b, b.s + 0.01);
            b.ang = Math.atan2(qy - hy, qx - hx);
            b.parts[0].x = hx; b.parts[0].y = hy;
            for (let i = 1; i < b.parts.length; i++) {
                const [x, y] = this.path(b, b.s - i * 0.135);
                b.parts[i].x = x; b.parts[i].y = y;
            }
            b.x = hx; b.y = hy;
        },
        frac: (b) => b.parts[0].hp / b.parts[0].max,
        step(b, w, dt) {
            const head = b.parts[0];
            const hard = head.hp < head.max * 0.45;
            if (b.st === 'enter') {
                b.enter = Math.max(0, 1 - b.t / 3.6);
                b.s += 0.42 * dt;
                this.pose(b);
                if (b.t > 3.6) { b.st = 'fight'; b.ct = 0; b.pct = 0; w.fx('bossFight', { kind: b.kind }); }
                return;
            }
            b.s += (hard ? 0.56 : 0.42) * dt;
            this.pose(b);
            clock(b, dt, hard ? 1.7 : 2.6);
            if (crossed(b, 0.01)) { b.rip = 0; b.ripI = 1; w.fx('rattle', { x: head.x, y: head.y }); }
            if (b.rip !== undefined) {
                b.rip += dt;
                while (b.ripI < b.parts.length && b.rip >= (b.ripI - 1) * 0.07) {
                    const s = b.parts[b.ripI];
                    if (s.alive && s.x < 31.5) {
                        const prev = b.parts[b.ripI - 1];
                        const a = Math.atan2(s.y - prev.y, s.x - prev.x) + Math.PI / 2;
                        w.fire(s.x, s.y, a, 4.6, 'orb');
                        w.fire(s.x, s.y, a + Math.PI, 4.6, 'orb');
                        if (hard) w.fire(s.x, s.y, w.aim(s.x, s.y), 5.2, 'needle');
                    }
                    b.ripI++;
                }
            }
            if (every(b, 'fan', hard ? 1.4 : 1.9, dt, w.D.rate) && head.x < 30.5) w.fan(head.x, head.y, w.aim(head.x, head.y), 5, 0.8, 8.4, 'needle');
        },
    },

    // ================================================================ 3. the Weeping Foundry
    penitent: {
        name: 'THE IRON PENITENT', title: 'Engine of Unending Contrition', score: 40000,
        init(b) {
            b.x = 34; b.y = 9;
            b.parts = [
                P('core', -1.1, 0, 1.0, 1500, { core: true, armor: true }),
                P('plateT', -1.6, 1.95, 1.15, 380, { score: 4000, body: true }),
                P('plateB', -1.6, -1.95, 1.15, 380, { score: 4000, body: true }),
                P('armT', -3.1, 4.7, 0.85, 240, { score: 3000 }),
                P('armB', -3.1, -4.7, 0.85, 240, { score: 3000 }),
                P('hull', 1.3, 0, 2.7, Infinity, { armor: true, body: true }),
                P('head', 1.0, 3.9, 1.1, Infinity, { armor: true, body: true }),
                P('skirt', 1.4, -3.9, 1.2, Infinity, { armor: true, body: true }),
            ];
            place(b);
        },
        frac: (b) => {
            const c = part(b, 'core'), t = part(b, 'plateT'), d = part(b, 'plateB');
            return (Math.max(0, c.hp) + Math.max(0, t.hp) + Math.max(0, d.hp)) / (c.max + t.max + d.max);
        },
        step(b, w, dt) {
            if (b.st === 'enter') return enter(b, w, dt, 24.6, 9, 3.4, 1.1);
            const core = part(b, 'core'), pt = part(b, 'plateT'), pb = part(b, 'plateB'), at = part(b, 'armT'), ab = part(b, 'armB');
            const exposed = !pt.alive && !pb.alive;
            core.armor = !exposed;
            clock(b, dt, 11);
            b.y = 9 + Math.sin(b.t * 0.45) * 1.7;
            place(b);
            b.fist = b.fist || {};
            if (within(b, 0, 3) && every(b, 'arm', 0.45, dt, w.D.rate)) {
                b.alt = !b.alt;
                const a = b.alt ? at : ab;
                if (a.alive) w.fan(a.x, a.y, w.aim(a.x, a.y), 3, 0.25, 8.2, 'orb');
            }
            for (const [t0, a] of [[3.2, at], [4.7, ab]]) {
                if (crossed(b, t0) && a.alive) {
                    const ang = w.aim(a.x, a.y);
                    w.laser({ x: a.x - 0.5, y: a.y, a: ang, len: 40, w: 0.55, warn: 0.85, dur: 0.5, color: 1 });
                    b.fist[a.name] = { a: ang, t: 0 };
                    w.fx('clank', { x: a.x, y: a.y });
                }
            }
            for (const k of Object.keys(b.fist)) { b.fist[k].t += dt; if (b.fist[k].t > 1.6) delete b.fist[k]; }
            if (within(b, 5.6, 8.6) && every(b, 'chain', exposed ? 0.06 : 0.075, dt, w.D.rate)) {
                const arms = exposed ? 3 : 2, th = b.ct * 2.5 * (b.loop % 2 ? -1 : 1);
                for (let i = 0; i < arms; i++) w.fire(core.x, core.y, th + (i / arms) * TAU, 5.2, exposed ? 'fire' : 'orb');
            }
            if (crossed(b, 9.2)) w.ring(b.x + 0.5, b.y, exposed ? 18 : 12, 4.8, 'big', b.loop * 0.2);
            if (exposed && within(b, 9.6, 10.8) && every(b, 'vent', 0.2, dt)) w.fan(core.x, core.y, w.aim(core.x, core.y), 5, 0.9, 7, 'fire');
        },
        partDown(b, p, w) { if (p.name.startsWith('plate')) w.fx('plateOff', { name: p.name }); },
    },

    // ================================================================ 4. the Drowned Choir
    ferryman: {
        name: 'THE FERRYMAN', title: 'Who Rows the Unsung Below', score: 45000,
        init(b) {
            b.x = 36; b.y = 3.4;
            b.parts = [
                P('lantern', -2.7, 5.4, 0.72, 2700, { core: true }),
                P('skull', 0.3, 6.2, 0.95, Infinity, { armor: true, body: true }),
                P('robe', 0.5, 3.5, 1.5, Infinity, { armor: true, body: true }),
                P('boatL', -2.9, -0.1, 1.1, Infinity, { armor: true, body: true }),
                P('boatM', 0.3, -0.3, 1.6, Infinity, { armor: true, body: true }),
                P('boatR', 3.3, -0.1, 1.1, Infinity, { armor: true, body: true }),
            ];
            place(b);
        },
        frac: (b) => { const c = part(b, 'lantern'); return c.hp / c.max; },
        step(b, w, dt) {
            if (b.st === 'enter') return enter(b, w, dt, 24.5, 3.4, 3.6, 1.0);
            const lan = part(b, 'lantern'), skull = part(b, 'skull');
            const hard = lan.hp < lan.max * 0.5;
            clock(b, dt, 13);
            b.y = 3.4 + Math.sin(b.t * 1.1) * 0.25;
            if (hard) b.x = 24.5 + Math.sin(b.t * 0.33) * 2.6;
            place(b);
            if (crossed(b, 0.5) || crossed(b, 11.5)) w.fan(lan.x, lan.y, w.aim(lan.x, lan.y), hard ? 7 : 5, 1.6, 3.6, 'soul');
            if (crossed(b, 2.3)) { b.gap = clamp(w.player.y, 3, 15); w.fx('scytheWarn', { y: b.gap }); }
            if (crossed(b, 3.0)) bladeWave(w, b.x - 3, b.gap);
            if (hard && crossed(b, 4.2)) bladeWave(w, b.x - 3, b.gap > 9 ? b.gap - 5 : b.gap + 5);
            if (crossed(b, 5.4)) {
                for (const dx of [-4.5, 0, 4.5]) {
                    const x = w.player.x + dx;
                    if (x > 1 && x < 20) w.spawn('hand', { x, tel: 0.95, h: 5 });
                }
            }
            if (within(b, 7.0, 9.0) && every(b, 'skull', 0.9, dt, w.D.rate)) w.fan(skull.x, skull.y, w.aim(skull.x, skull.y), 5, 0.75, 6.2, 'big');
            if (crossed(b, 9.6)) { b.gap = clamp(w.player.y, 3, 15); w.fx('scytheWarn', { y: b.gap }); }
            if (crossed(b, 10.3)) bladeWave(w, b.x - 3, b.gap);
            if (hard && every(b, 'rain', 0.45, dt, w.D.rate)) w.fire(w.rng.range(2, 22), 18.6, -Math.PI / 2, 2.6, 'soul', { home: 0.5, homeT: 1.5, noWall: true });
        },
    },

    // ================================================================ 5. the Flesh Labyrinth
    brood: {
        name: 'THE BROOD MOTHER', title: 'Heart of the Living Pit', score: 50000,
        init(b) {
            b.x = 35; b.y = 9; b.open = 0; b.beat = 0; b.pulse = 0;
            b.parts = [
                P('eye', -2.4, 0, 1.05, 1150, { core: true, armor: true }),
                P('heart', 0.7, 0, 3.0, Infinity, { armor: true, body: true }),
                P('vesselT', 1.6, 6.3, 1.4, Infinity, { armor: true, body: true }),
                P('vesselB', 1.6, -6.3, 1.4, Infinity, { armor: true, body: true }),
            ];
            const T = [[-2.1, 3.7], [-2.1, -3.7], [-0.7, 5.4], [-0.7, -5.4]];
            T.forEach(([ox, oy], i) => b.parts.push(P('tent' + i, ox, oy, 0.72, 170, { score: 3000, bx: ox, by: oy })));
            place(b);
        },
        frac: (b) => { const c = part(b, 'eye'); return c.hp / c.max; },
        step(b, w, dt) {
            if (b.st === 'enter') return enter(b, w, dt, 25.2, 9, 3.4, 1.2);
            const eye = part(b, 'eye');
            const hard = eye.hp < eye.max * 0.5;
            const period = hard ? 0.8 : 1.1;
            b.bt = (b.bt ?? 0) + dt;
            b.pulse = Math.max(0, b.pulse - dt * 3);
            for (const p of b.parts) if (p.bx !== undefined) {
                p.ox = p.bx - 0.5 + Math.sin(b.t * 1.6 + p.by) * 0.5;
                p.oy = p.by + Math.cos(b.t * 1.3 + p.bx) * 0.4;
            }
            const openWant = (b.beat % 8 >= 2 && b.beat % 8 <= 5) ? 1 : 0;
            b.open += (openWant - b.open) * Math.min(1, 5 * dt);
            eye.armor = b.open < 0.5;
            place(b);
            if (b.bt >= period) {
                b.bt -= period;
                b.beat++;
                b.pulse = 1;
                w.fx('beat', { x: b.x, y: b.y });
                const k = b.beat % 8;
                b.parts.forEach((p, i) => {
                    if (p.name.startsWith('tent') && p.alive && (b.beat + i) % 2 === 0) w.fire(p.x, p.y, w.aim(p.x, p.y), 6.4, 'orb');
                });
                if (k === 3) {
                    const ys = (b.beat >> 3) % 2 ? [6, 12] : [3, 9, 15];
                    for (const y of ys) w.laser({ x: b.x - 2.6, y, a: Math.PI, len: 34, w: 0.46, warn: 1.1, dur: 1.3, color: 2 });
                    w.fx('veins', {});
                }
                if (k === 4) w.fan(eye.x, eye.y, w.aim(eye.x, eye.y), 3, 0.3, 7, 'big');
                if (k === 6) for (let i = 0; i < 3; i++) w.spawn('fly', { x: b.x - 2, y: b.y + (i - 1) * 2.4, home: true, vx: -5, vy: (i - 1) * 3, speed: 6 });
                if (hard) w.ring(b.x - 1, b.y, 14, 3.8, 'orb', b.beat * 0.17);
            }
        },
    },

    // ================================================================ 6. the Frozen Betrayal
    sammael: {
        name: 'SAMMAEL', title: 'The Frost-Crowned, Who Betrayed the Star', score: 60000,
        init(b) {
            b.x = 36; b.y = 9; b.mode = 'hover'; b.mt = 0; b.si = 0;
            b.parts = [
                P('body', 0, 0, 0.85, 3000, { core: true, body: true }),
                P('wingU', 0.35, 1.25, 0.8, Infinity, { armor: true }),
                P('wingD', 0.35, -1.25, 0.8, Infinity, { armor: true }),
            ];
            place(b);
        },
        frac: (b) => { const c = part(b, 'body'); return c.hp / c.max; },
        setMode(b, m) { b.mode = m; b.mt = 0; },
        step(b, w, dt) {
            if (b.st === 'enter') return enter(b, w, dt, 24, 9, 3.0, 1.5);
            const body = part(b, 'body');
            const frac = body.hp / body.max;
            const hard = frac < 0.55, frenzy = frac < 0.25;
            b.mt += dt;
            const seq = hard ? ['dash', 'hover', 'blizzard', 'hover', 'dash', 'hover', 'prism', 'hover'] : ['dash', 'hover', 'prism', 'hover'];
            const next = () => this.setMode(b, seq[b.si++ % seq.length]);
            switch (b.mode) {
                case 'hover': {
                    const ty = clamp(w.player.y, 3, 15);
                    b.x += (24 - b.x) * Math.min(1, 2.5 * dt);
                    b.y += (ty - b.y) * Math.min(1, 1.6 * dt);
                    if (every(b, 'fan', hard ? 0.6 : 0.78, dt, w.D.rate)) w.fan(b.x - 0.5, b.y, w.aim(b.x, b.y), 7, 1.1, 8, 'needle');
                    if (frenzy && every(b, 'spiral', 0.085, dt)) for (const k of [0, Math.PI]) w.fire(b.x, b.y, b.t * 3.1 + k, 6, 'shard');
                    if (b.mt > (hard ? 2.0 : 2.7)) next();
                    break;
                }
                case 'dash': {
                    if (b.mt < dt * 1.5) {
                        w.laser({ x: b.x - 1, y: b.y, a: Math.PI, len: 40, w: 0.75, warn: 0.75, dur: 0.02, color: 3 });
                        w.fx('dashWarn', { y: b.y });
                    }
                    if (b.mt > 0.75) {
                        b.x -= 32 * dt;
                        if (hard && every(b, 'trail', 0.07, dt)) w.fire(b.x + 0.8, b.y, Math.PI / 2 * (w.rng() < 0.5 ? 1 : -1), 1.8, 'shard', { acc: 2, maxSpd: 6 });
                        if (b.x < -4) { b.x = 36; b.y = w.rng.range(4, 14); this.setMode(b, 'return'); w.fx('blink', {}); }
                    }
                    break;
                }
                case 'return':
                    b.x += (24 - b.x) * Math.min(1, 3 * dt);
                    if (b.mt > 1.0) next();
                    break;
                case 'prism':
                    if (b.mt < dt * 1.5) {
                        for (const [dx, dy] of [[-2.5, 3], [-3.2, 0], [-2.5, -3]]) w.spawn('crystal', { x: b.x + dx, y: clamp(b.y + dy, 1.5, 16.5), speed: 2.6 });
                        w.fx('prism', { x: b.x, y: b.y });
                    }
                    if (b.mt > 1.3) next();
                    break;
                case 'blizzard':
                    if (every(b, 'snow', 0.085, dt, w.D.rate)) w.fire(w.rng.range(6, 40), 18.9, -2.35, 6.2, 'shard', { noWall: true });
                    if (every(b, 'aim', 0.7, dt, w.D.rate)) w.fan(b.x, b.y, w.aim(b.x, b.y), 3, 0.3, 8.5, 'needle');
                    b.y += (9 - b.y) * Math.min(1, dt);
                    if (b.mt > 4.2) next();
                    break;
                default: next();
            }
            place(b);
        },
    },

    // ================================================================ 7. the Gate of Dawn
    malphas: {
        name: 'MALPHAS', title: 'Lord of the Pit', score: 100000,
        init(b) {
            b.x = 38; b.y = 9; b.phase = 1;
            b.parts = [
                P('handT', -5, 5.2, 1.35, 600, { score: 8000, body: true, free: true }),
                P('handB', -5, -5.2, 1.35, 600, { score: 8000, body: true, free: true }),
                P('head', -0.6, 3.6, 1.45, 1900, { armor: true, score: 15000 }),
                P('heart', -0.5, -1.3, 1.25, 2000, { core: true, armor: true }),
                P('torso', 1.4, -0.6, 3.2, Infinity, { armor: true, body: true }),
                P('crown', 0.5, 6.2, 1.1, Infinity, { armor: true, body: true }),
                P('hip', 1.6, -5.4, 1.8, Infinity, { armor: true, body: true }),
            ];
            b.hand = { handT: { st: 'rest', t: 0 }, handB: { st: 'rest', t: 0 } };
            place(b);
            this.hands(b, null, 0);
        },
        frac: (b) => {
            const ps = ['handT', 'handB', 'head', 'heart'].map((n) => part(b, n));
            let hp = 0, max = 0;
            for (const p of ps) { hp += Math.max(0, p.hp); max += p.max; }
            return hp / max;
        },
        hands(b, w, dt) {
            for (const name of ['handT', 'handB']) {
                const p = part(b, name), h = b.hand[name];
                const sign = name === 'handT' ? 1 : -1;
                const rx = b.x - 5.2, ry = b.y + sign * 5.2 + Math.sin(b.t * 1.3 + sign) * 0.5;
                h.t += dt;
                if (h.st === 'rest' || !p.alive) { p.x = rx; p.y = ry; }
                else if (h.st === 'wind') {
                    p.x += (31 - p.x) * Math.min(1, 5 * dt); p.y += (h.y - p.y) * Math.min(1, 6 * dt);
                    if (h.t > 0.7) { h.st = 'sweep'; h.t = 0; w.fx('swipe', { y: h.y }); }
                } else if (h.st === 'sweep') {
                    p.x -= 22 * dt;
                    if (p.x < -1.5) { h.st = 'back'; h.t = 0; }
                } else if (h.st === 'back') {
                    p.x += (rx - p.x) * Math.min(1, 2.4 * dt); p.y += (ry - p.y) * Math.min(1, 2.4 * dt);
                    if (h.t > 1.4) h.st = 'rest';
                }
            }
        },
        step(b, w, dt) {
            const hT = part(b, 'handT'), hB = part(b, 'handB'), head = part(b, 'head'), heart = part(b, 'heart');
            if (b.st === 'enter') {
                b.x += (26.5 - b.x) * Math.min(1, 1.0 * dt);
                place(b); this.hands(b, w, dt);
                if (b.t > 4.2) { b.st = 'fight'; b.ct = 0; b.pct = 0; w.fx('bossFight', { kind: b.kind }); }
                return;
            }
            b.y = 9 + Math.sin(b.t * 0.5) * 0.7;
            place(b);
            this.hands(b, w, dt);
            if (b.phase === 1) {
                clock(b, dt, 9);
                if (within(b, 0, 3) && every(b, 'finger', 0.8, dt, w.D.rate)) {
                    b.alt = !b.alt;
                    const h = b.alt ? hT : hB;
                    if (h.alive && b.hand[h.name].st === 'rest') w.fan(h.x, h.y, w.aim(h.x, h.y), 5, 0.7, 7.6, 'needle');
                }
                for (const [t0, h] of [[3.5, hT], [6.0, hB]]) {
                    if (crossed(b, t0) && h.alive) { b.hand[h.name] = { st: 'wind', t: 0, y: clamp(w.player.y, 1.5, 16.5) }; w.fx('handWarn', { y: b.hand[h.name].y }); }
                }
                if (crossed(b, 7.3)) w.ring(head.x, head.y, 16, 4.6, 'orb', b.loop * 0.2);
                if (!hT.alive && !hB.alive) {
                    b.phase = 2; b.ct = 0; b.pct = 0; head.armor = false;
                    w.fx('phase', { phase: 2 });
                    w.fx('say', { who: 'malphas', text: 'You burn brighter than she did. Good. Brighter fuel.' });
                }
            } else if (b.phase === 2) {
                clock(b, dt, 12);
                if (within(b, 0.3, 4) && every(b, 'spiral', 0.075, dt, w.D.rate)) {
                    const th = b.ct * 1.9 * (b.loop % 2 ? -1 : 1);
                    for (let i = 0; i < 3; i++) w.fire(head.x, head.y, th + (i / 3) * TAU, 5, 'fire');
                }
                if (crossed(b, 4.5)) {
                    b.beams = [-0.2, 0.2].map((d) => w.laser({ x: head.x - 0.6, y: head.y + d * 2, a: w.aim(head.x, head.y) + d, len: 42, w: 0.42, warn: 1.0, dur: 2.4, color: 4 }));
                }
                if (b.beams) {
                    for (const l of b.beams) {
                        l.x = head.x - 0.6;
                        if (l.t > l.warn) {
                            let d = w.aim(l.x, l.y) - l.a;
                            while (d > Math.PI) d -= TAU;
                            while (d < -Math.PI) d += TAU;
                            l.a += clamp(d, -0.42 * dt, 0.42 * dt);
                        }
                    }
                    if (b.ct > 8) b.beams = null;
                }
                if (crossed(b, 7.6)) {
                    for (let i = 0; i < 6; i++) w.spawnQ.push({ at: w.t + i * 0.3, kind: 'imp', o: { y: i % 2 ? 13 : 5, path: 'loop', loopX: 14, loopDir: i % 2 ? -1 : 1, speed: 8, shoot: 0.5 }, group: null });
                }
                if (within(b, 8.6, 11) && every(b, 'trip', 0.65, dt, w.D.rate)) w.fan(head.x, head.y, w.aim(head.x, head.y), 3, 0.35, 7.4, 'big');
                if (crossed(b, 10.2)) w.ring(head.x, head.y, 12, 4.2, 'orb', 0.13);
            } else {
                clock(b, dt, 8);
                const desperate = heart.hp < heart.max * 0.35;
                w.pull = desperate ? 2.7 : 2.0;
                if (every(b, 'ring', desperate ? 0.9 : 1.25, dt, w.D.rate)) {
                    b.rot = (b.rot ?? 0) + 0.16;
                    w.ring(heart.x, heart.y, 18, 4.2, 'orb', b.rot);
                    w.fire(heart.x, heart.y, w.aim(heart.x, heart.y), 6.5, 'big');
                }
                if ((desperate || within(b, 3, 6)) && every(b, 'spiral', 0.1, dt, w.D.rate)) {
                    for (const k of [0, Math.PI]) w.fire(heart.x, heart.y, b.t * 2.2 * (desperate ? -1 : 1) + k, 5.6, 'needle');
                }
            }
        },
        partDown(b, p, w) {
            if (p.name === 'head') {
                b.phase = 3; b.ct = 0; b.pct = 0;
                part(b, 'heart').armor = false;
                b.beams = null;
                for (const l of w.lasers) l.t = l.warn + l.dur;
                w.dawn = true;
                if (!w.S.power.halo) w.S.power.halo = { c: 'gold', lvl: 2 };
                w.fx('dawn', {});
                w.fx('say', { who: 'vesper', text: 'Cael! I am here, I was always here. Take my light. RISE!' });
            }
            if (p.name === 'handT' || p.name === 'handB') w.fx('handLost', { name: p.name });
        },
        dying(b, w) { w.pull = 0; },
    },
};
