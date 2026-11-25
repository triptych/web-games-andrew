// The six magical mini-games. Pure. Each is { init(rng, level), step(M, inp, dt, rng), bot(M, b) }.
// inp = { x, y, a, dir }: x/y held in [-1, 1], a = action pressed this step, dir = 'up'|'right'|'down'|'left'|null
// pressed this step. M.score against M.goal gives the grade. Every M is plain data (it is saved with the game).

const DIRS = ['up', 'right', 'down', 'left'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const GRADES = ['C', 'B', 'A', 'S'];
export function grade(M) {
    const r = M.score / M.goal;
    return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.45 ? 1 : 0;
}

// ------------------------------------------------------------------ Resonance (echo): repeat the crystal song
const echo = {
    init(rng, level) {
        const rounds = level >= 2 ? 6 : 5, first = level >= 2 ? 4 : 3;
        const seqs = Array.from({ length: rounds }, (_, r) => Array.from({ length: first + r }, () => rng.int(0, 3)));
        return {
            game: 'echo', level, t: 0, done: false, score: 0, goal: seqs.reduce((s, q) => s + q.length, 0),
            seqs, round: 0, phase: 'pause', timer: 1.0, i: 0, lives: 3, lit: -1,
            noteDur: level >= 2 ? 0.42 : 0.55, ev: [],
        };
    },
    step(M, inp, dt) {
        M.t += dt;
        M.timer -= dt;
        const seq = M.seqs[M.round];
        if (M.phase === 'pause') {
            M.lit = -1;
            if (M.timer <= 0) { M.phase = 'show'; M.i = 0; M.timer = M.noteDur; M.lit = seq[0]; M.ev.push({ type: 'note', n: seq[0] }); }
        } else if (M.phase === 'show') {
            if (M.timer <= 0) {
                M.i++;
                if (M.i >= seq.length) { M.phase = 'input'; M.i = 0; M.timer = 4; M.lit = -1; }
                else { M.timer = M.noteDur; M.lit = seq[M.i]; M.ev.push({ type: 'note', n: seq[M.i] }); }
            } else if (M.timer < M.noteDur * 0.25) M.lit = -1;
        } else if (M.phase === 'input') {
            if (M.timer < 3.7) M.lit = -1;
            const d = inp.dir ? DIRS.indexOf(inp.dir) : -1;
            if (d >= 0) {
                M.lit = d;
                if (d === seq[M.i]) {
                    M.score++; M.i++; M.timer = 4;
                    M.ev.push({ type: 'good', n: d });
                    if (M.i >= seq.length) next(M, true);
                } else { M.ev.push({ type: 'miss', n: d }); M.lives--; next(M, false); }
            } else if (M.timer <= 0) { M.ev.push({ type: 'miss', n: -1 }); M.lives--; next(M, false); }
        }
        function next(M, ok) {
            M.round++;
            M.phase = 'pause'; M.timer = 0.9;
            if (ok) M.ev.push({ type: 'round' });
            if (M.round >= M.seqs.length || M.lives <= 0) { M.done = true; M.phase = 'done'; }
        }
    },
    bot(M, b) {
        if (M.phase !== 'input' || M.timer > 3.7 - b.react) return null;
        const want = M.seqs[M.round][M.i];
        return { dir: b.rng() < 1 - (1 - b.acc) * 0.3 ? DIRS[want] : DIRS[(want + 1) % 4] };
    },
};

// ------------------------------------------------------------------ Rune Strokes: enter each rune's strokes before it fades
const runes = {
    init(rng, level) {
        const M = { game: 'runes', level, t: 0, done: false, score: 0, time: 40, goal: level >= 2 ? 75 : 60, rune: [], i: 0, runeT: 0, runeMax: level >= 2 ? 5.5 : 7, len: level >= 2 ? 5 : 4, made: 0, ev: [] };
        newRune(M, rng);
        return M;
    },
    step(M, inp, dt, rng) {
        M.t += dt; M.runeT -= dt;
        if (M.t >= M.time) { M.done = true; return; }
        if (inp.dir) {
            if (inp.dir === M.rune[M.i]) {
                M.i++;
                M.ev.push({ type: 'stroke', i: M.i });
                if (M.i >= M.rune.length) { M.score += M.rune.length; M.made++; M.ev.push({ type: 'rune' }); newRune(M, rng); }
            } else { M.i = 0; M.ev.push({ type: 'miss' }); }
        }
        if (M.runeT <= 0) { M.ev.push({ type: 'fade' }); newRune(M, rng); }
    },
    bot(M, b) {
        b.cd = (b.cd || 0) - b.dt;
        if (b.cd > 0) return null;
        b.cd = b.react;
        const want = M.rune[M.i];
        return { dir: b.rng() < b.acc ? want : DIRS[(DIRS.indexOf(want) + 2) % 4] };
    },
};
function newRune(M, rng) {
    const n = M.len + (rng() < 0.3 ? 1 : 0);
    M.rune = [];
    for (let k = 0; k < n; k++) {
        let d;
        do d = DIRS[rng.int(0, 3)]; while (M.rune.length && d === M.rune[M.rune.length - 1]);
        M.rune.push(d);
    }
    M.i = 0; M.runeT = M.runeMax;
}

// ------------------------------------------------------------------ Potion Brewing: press as the needle crosses the glow
const potion = {
    init(rng, level) {
        const M = { game: 'potion', level, t: 0, done: false, score: 0, n: 8, k: 0, goal: 24, needle: 0, dir: 1, speed: level >= 2 ? 0.95 : 0.7, c: 0.5, w: 0.24, cool: 0.6, last: null, ev: [] };
        newZone(M, rng);
        return M;
    },
    step(M, inp, dt, rng) {
        M.t += dt;
        if (M.cool > 0) { M.cool -= dt; return; }
        M.wait = (M.wait || 0) + dt;
        M.needle += M.dir * M.speed * dt;
        if (M.needle > 1) { M.needle = 2 - M.needle; M.dir = -1; }
        if (M.needle < 0) { M.needle = -M.needle; M.dir = 1; }
        if (inp.a || M.wait > 6) {                       // a dawdled ingredient fizzles on its own
            M.wait = 0;
            const d = inp.a ? Math.abs(M.needle - M.c) : 1;
            const pts = d < M.w / 6 ? 3 : d < M.w / 2 ? 2 : 0;
            M.score += pts;
            M.last = pts === 3 ? 'perfect' : pts ? 'good' : 'fizzle';
            M.ev.push({ type: M.last, k: M.k });
            M.k++;
            if (M.k >= M.n) { M.done = true; return; }
            M.speed *= 1.06; M.w = Math.max(0.12, M.w * 0.93);
            M.cool = 0.45;
            newZone(M, rng);
        }
    },
    bot(M, b) {
        if (M.cool > 0) { b.off = undefined; return null; }
        if (b.off === undefined) b.off = (b.rng() - 0.5) * (1 - b.acc) * 0.9;
        return Math.abs(M.needle - (M.c + b.off)) < 0.012 ? { a: true } : null;
    },
};
function newZone(M, rng) { M.c = 0.15 + rng() * 0.7; M.needle = M.c > 0.5 ? 0 : 1; M.dir = M.c > 0.5 ? 1 : -1; }

// ------------------------------------------------------------------ Star Catcher: move the basket, catch stars, dodge comets
const stars = {
    init(rng, level) {
        return { game: 'stars', level, t: 0, done: false, score: 0, time: 35, goal: level >= 2 ? 58 : 46, x: 0.5, w: 0.17, items: [], spawn: 0, stun: 0, rate: level >= 2 ? 0.5 : 0.62, fall: level >= 2 ? 0.5 : 0.4, nid: 0, ev: [] };
    },
    step(M, inp, dt, rng) {
        M.t += dt;
        if (M.t >= M.time) { M.done = true; return; }
        if (M.stun > 0) M.stun -= dt;
        else M.x = clamp(M.x + inp.x * 1.35 * dt, M.w / 2, 1 - M.w / 2);
        M.spawn -= dt;
        if (M.spawn <= 0) {
            M.spawn = M.rate * (0.7 + rng() * 0.6);
            const r = rng();
            const kind = r < 0.22 ? 'comet' : r < 0.32 ? 'gold' : 'star';
            M.items.push({ id: M.nid++, kind, x: 0.06 + rng() * 0.88, y: 0, vy: M.fall * (0.8 + rng() * 0.5) * (kind === 'comet' ? 1.25 : 1) });
        }
        for (let i = M.items.length - 1; i >= 0; i--) {
            const s = M.items[i];
            s.y += s.vy * dt;
            if (s.y >= 0.9 && s.y < 0.97 && Math.abs(s.x - M.x) < M.w / 2 + 0.02) {
                M.items.splice(i, 1);
                if (s.kind === 'comet') { M.score = Math.max(0, M.score - 2); M.stun = 0.6; M.ev.push({ type: 'comet' }); }
                else { M.score += s.kind === 'gold' ? 3 : 1; M.ev.push({ type: s.kind, x: s.x }); }
            } else if (s.y > 1.05) M.items.splice(i, 1);
        }
    },
    bot(M, b) {
        // chase the lowest catchable star that no comet will cross first
        let best = null, by = -1;
        for (const s of M.items) {
            if (s.kind === 'comet' || s.y < 0.15 || s.y > 0.95) continue;
            const reach = Math.abs(s.x - M.x) / 1.35, fallT = (0.92 - s.y) / s.vy;
            if (reach <= fallT + 0.05 * b.acc && s.y > by) { by = s.y; best = s; }
        }
        let tx = best ? best.x : 0.5;
        for (const c of M.items) if (c.kind === 'comet' && c.y > 0.6 && Math.abs(c.x - M.x) < M.w) tx = c.x > M.x ? M.x - 0.3 : M.x + 0.3;
        if (b.rng() > b.acc) tx = b.wander ?? (b.wander = b.rng());
        const dx = tx - M.x;
        return { x: Math.abs(dx) < 0.015 ? 0 : clamp(dx * 12, -1, 1) };
    },
};

// ------------------------------------------------------------------ Sky Rings: steer through every ring
const rings = {
    init(rng, level) {
        const n = level >= 2 ? 22 : 16;
        const list = [];
        let px = 0, py = 0;
        for (let i = 0; i < n; i++) {
            px = clamp(px + (rng() - 0.5) * 1.1, -0.75, 0.75);
            py = clamp(py + (rng() - 0.5) * 1.1, -0.6, 0.6);
            list.push({ x: px, y: py, z: 1 + i * (level >= 2 ? 0.55 : 0.66), done: false });
        }
        return { game: 'rings', level, t: 0, done: false, score: 0, goal: n, x: 0, y: 0, rings: list, r: level >= 2 ? 0.21 : 0.25, speed: 0.55, passed: 0, ev: [] };
    },
    step(M, inp, dt) {
        M.t += dt;
        M.x = clamp(M.x + inp.x * 1.5 * dt, -1, 1);
        M.y = clamp(M.y + inp.y * 1.5 * dt, -0.85, 0.85);
        for (const r of M.rings) {
            if (r.done) continue;
            r.z -= M.speed * dt;
            if (r.z <= 0) {
                r.done = true; M.passed++;
                if (Math.hypot(r.x - M.x, r.y - M.y) < M.r) { M.score++; M.ev.push({ type: 'ring' }); }
                else M.ev.push({ type: 'missRing' });
            }
        }
        if (M.passed >= M.rings.length) M.done = true;
    },
    bot(M, b) {
        const r = M.rings.find((q) => !q.done);
        if (!r) return { x: 0, y: 0 };
        const lag = b.acc > 0.9 ? 0 : (1 - b.acc) * 2.2;
        if (b.off === undefined) b.off = [(b.rng() - 0.5) * lag, (b.rng() - 0.5) * lag];
        const tx = r.x + b.off[0], ty = r.y + b.off[1];
        if (r.z < 0.05) b.off = undefined;
        return { x: clamp((tx - M.x) * 8, -1, 1), y: clamp((ty - M.y) * 8, -1, 1) };
    },
};

// ------------------------------------------------------------------ Fireball Gallery: three lanes; masks good, Mochi plushies bad
const LANE = { left: 0, up: 1, down: 1, right: 2 };
const fireball = {
    init(rng, level) {
        return { game: 'fireball', level, t: 0, done: false, score: 0, time: 35, goal: level >= 2 ? 72 : 58, targets: [], spawn: 0.5, rate: level >= 2 ? 0.62 : 0.78, life: level >= 2 ? 1.2 : 1.6, nid: 0, ev: [] };
    },
    step(M, inp, dt, rng) {
        M.t += dt;
        if (M.t >= M.time) { M.done = true; return; }
        M.spawn -= dt;
        if (M.spawn <= 0) {
            M.spawn = M.rate * (0.7 + rng() * 0.6);
            const free = [0, 1, 2].filter((l) => !M.targets.some((t) => t.lane === l));
            if (free.length) M.targets.push({ id: M.nid++, lane: free[rng.int(0, free.length - 1)], kind: rng() < 0.25 ? 'mochi' : 'mask', t: M.life });
        }
        for (let i = M.targets.length - 1; i >= 0; i--) { M.targets[i].t -= dt; if (M.targets[i].t <= 0) M.targets.splice(i, 1); }
        const lane = inp.dir != null ? LANE[inp.dir] : inp.lane != null ? inp.lane : -1;
        if (lane >= 0) {
            const i = M.targets.findIndex((t) => t.lane === lane);
            M.ev.push({ type: 'shot', lane });
            if (i >= 0) {
                const t = M.targets.splice(i, 1)[0];
                if (t.kind === 'mask') { M.score += 2; M.ev.push({ type: 'hit', lane }); }
                else { M.score = Math.max(0, M.score - 3); M.ev.push({ type: 'oops', lane }); }
            }
        }
    },
    bot(M, b) {
        b.cd = (b.cd || 0) - b.dt;
        if (b.cd > 0) return null;
        const t = M.targets.find((q) => q.kind === 'mask' && q.t < M.life - b.react);
        if (!t) return null;
        b.cd = b.react * 0.8;
        const wrong = b.rng() > b.acc;
        return { dir: ['left', 'up', 'right'][wrong ? (t.lane + 1) % 3 : t.lane] };
    },
};

export const MINI = { echo, runes, potion, stars, rings, fireball };

/** A bot's settings for a skill in [0, 1]: reaction time and accuracy. */
export function miniBot(skill, rng) {
    return { rng, acc: 0.55 + 0.45 * skill, react: 0.55 - 0.35 * skill, dt: 0 };
}
