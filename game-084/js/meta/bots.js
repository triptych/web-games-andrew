// Bots that play the repaired cartridges, for the tests and for the attract mode on the lab CRT.
// Each returns a button mask for the next frame from the run's state. Pure.

import { V } from '../runtime/index.js';

const B = V.BTN;
const first = (R, t) => R.objs.find((o) => !o.dead && o.type === t);
const all = (R, t) => R.objs.filter((o) => !o.dead && o.type === t);
const cx = (o) => o.x + o.T.hb.x + o.T.hb.w / 2;
const cy = (o) => o.y + o.T.hb.y + o.T.hb.h / 2;

/** Step a copy of the run for some frames with an input policy (frame index → mask). */
export function simulate(R, frames, policy) {
    const C = V.cloneRun(R);
    const bot = {};
    for (let i = 0; i < frames && C.status === 'run'; i++) {
        V.stepRun(C, policy(C, i, bot));
        C.events.length = 0;
    }
    return C;
}
const hurt = (R0, C) => C.status === 'lose' || (C.globals.lives || 0) < (R0.globals.lives || 0);

/** Hold toward a target value with a dead zone. */
const toward = (v, target, dead, neg, pos) => (v < target - dead ? pos : v > target + dead ? neg : 0);

export const BOTS = {
    rally(R, bot) {
        const p = first(R, 'player'), b = first(R, 'ball');
        if (!p || !b) return 0;
        // meet the ball off-centre, so it leaves at an angle the console can't reach
        if (b.vx < 0) bot.aim = bot.aim ?? 0;
        else bot.aim = (R.frame >> 6) % 2 ? 7 : -7;
        return toward(cy(p), cy(b) + (b.vx < 0 ? bot.aim : 0), 2, B.up, B.down);
    },
    brick(R, bot) {
        const p = first(R, 'paddle'), b = first(R, 'ball');
        if (!p || !b) return 0;
        if (b.vy > 0) bot.off = ((R.frame * 7919) >> 5) % 13 - 6;
        return toward(cx(p), cx(b) + (bot.off || 0), 1.5, B.left, B.right);
    },
    invasion(R, bot) {
        const s = first(R, 'ship');
        if (!s) return 0;
        const sx = cx(s);
        let m = 0;
        // dodge a bomb that is coming down on us
        const threat = all(R, 'bomb').filter((b) => b.y < s.y && b.y > s.y - 46 && Math.abs(cx(b) - sx) < 9);
        if (threat.length) {
            const b = threat[0];
            const left = sx > 14 && (cx(b) >= sx || sx > 146);
            m = left ? B.left : B.right;
        } else {
            // the lowest invader nearest us
            let best = null, bs = Infinity;
            for (const a of all(R, 'alien')) {
                const sc = Math.abs(cx(a) - sx) - a.y * 0.5;
                if (sc < bs) { bs = sc; best = a; }
            }
            if (best) {
                const lead = (R.globals.dir || 0) * 3;
                m = toward(sx, cx(best) + lead, 2, B.left, B.right);
                if (Math.abs(cx(best) + lead - sx) < 4 && !all(R, 'bullet').length && !bot.fired) m |= B.a;
            }
        }
        bot.fired = !!(m & B.a);
        return m;
    },
    munch(R, bot) {
        const p = first(R, 'munch');
        if (!p) return 0;
        const W = R.map.w, H = R.map.h;
        const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || (R.P.flags[R.map.t[y * W + x]] & V.FLAG.solid);
        const px = Math.round(p.x / 8), py = Math.round(p.y / 8);
        const power = (R.globals.power || 0) > 40;
        const danger = new Set();
        if (!power) {
            for (const g of all(R, 'ghost')) {
                const gx = Math.round(g.x / 8), gy = Math.round(g.y / 8);
                for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) danger.add((gy + dy) * W + gx + dx);
            }
        }
        const DIRS = [[1, 0, B.right], [-1, 0, B.left], [0, 1, B.down], [0, -1, B.up]];
        const bfs = (avoid) => {
            const prev = new Map([[py * W + px, -1]]);
            const q = [[px, py]];
            while (q.length) {
                const [x, y] = q.shift();
                const t = R.map.t[y * W + x];
                if ((t === 2 || t === 9) && !(x === px && y === py)) {
                    let k = y * W + x, last = k;
                    while (prev.get(k) !== -1) { last = k; k = prev.get(k); }
                    const lx = last % W, ly = Math.floor(last / W);
                    for (const [dx, dy, b] of DIRS) if (px + dx === lx && py + dy === ly) return b;
                }
                for (const [dx, dy] of DIRS) {
                    const nx = x + dx, ny = y + dy, k = ny * W + nx;
                    if (solid(nx, ny) || prev.has(k) || (avoid && danger.has(k))) continue;
                    prev.set(k, y * W + x);
                    q.push([nx, ny]);
                }
            }
            return 0;
        };
        let m = bfs(true);
        if (!m) {
            // boxed in: step to the free neighbour farthest from every ghost
            let best = 0, bd = -1;
            for (const [dx, dy, b] of DIRS) {
                if (solid(px + dx, py + dy)) continue;
                let d = Infinity;
                for (const g of all(R, 'ghost')) d = Math.min(d, Math.abs(g.x / 8 - px - dx) + Math.abs(g.y / 8 - py - dy));
                if (d > bd) { bd = d; best = b; }
            }
            m = best || bfs(false);
        }
        return m;
    },
    hop(R, bot) {
        const f = first(R, 'frog');
        if (!f) return 0;
        if (f.mv) return 0;
        if (bot.wait > 0) { bot.wait--; return 0; }
        const score = (C) => {
            if (hurt(R, C)) return -1e6;
            if (C.status === 'win') return 1e6;
            const g = first(C, 'frog');
            if (!g) return -1e5;
            const edge = Math.max(0, 12 - g.x, g.x - 140);
            // near the top, line up with an empty lily pad
            let pad = 0;
            if (g.y < 50) {
                let d = Infinity;
                for (let x = 0; x < C.map.w; x++) if (C.map.t[C.map.w + x] === 6) d = Math.min(d, Math.abs(x * 8 - g.x));
                pad = Number.isFinite(d) ? d : 0;
            }
            return (C.globals.homes || 0) * 5000 - g.y * 10 - edge * 4 - pad * 6;
        };
        const ACTS = [B.up, B.left, B.right, 0, B.down];
        let best = 0, bs = -Infinity;
        for (const a of ACTS) {
            const C1 = simulate(R, 9, (C, i) => (i === 0 ? a : 0));
            if (hurt(R, C1)) continue;
            let s2 = -Infinity;
            for (const b of ACTS) {
                const C2 = simulate(C1, 30, (C, i) => (i === 0 ? b : 0));
                s2 = Math.max(s2, score(C2));
            }
            const sc = s2 + (a === B.up ? 3 : a === 0 ? 1 : 0);
            if (sc > bs) { bs = sc; best = a; }
        }
        if (!best) bot.wait = 3;
        return best;
    },
    girder(R, bot) {
        const h = first(R, 'hero');
        if (!h) return 0;
        const LADDERS = [15, 5, 13, 7];
        const base = (C) => {
            const g = first(C, 'hero');
            if (!g) return 0;
            if (g.climbing) return B.up;
            const floor = [13, 10, 7, 4, 1].indexOf(Math.floor(cy(g) / 8));
            const tx = floor >= 0 && floor < 4 ? LADDERS[floor] * 8 + 4 : 84;
            const dx = tx - cx(g);
            if (Math.abs(dx) > 1.5) return dx > 0 ? B.right : B.left;
            return floor < 4 ? B.up : 0;
        };
        // distance still to walk and climb, along the route ladder by ladder to the captive
        const FY = [108, 84, 60, 36, 12];
        const LX = LADDERS.map((l) => l * 8 + 4);
        const rest = (f, x) => {
            let d = 0;
            for (let k = f; k < 4; k++) { d += Math.abs(x - LX[k]) + 24; x = LX[k]; }
            return d + Math.abs(x - 84);
        };
        const progress = (C) => {
            if (C.status === 'win') return 1e6;
            if (hurt(R, C)) return -1e6;
            const g = first(C, 'hero');
            const y = cy(g), x = cx(g);
            if (g.climbing) {
                let f = 0;
                while (f < 3 && y <= FY[f + 1]) f++;
                return -(Math.max(0, y - FY[f + 1]) + rest(f + 1, LX[f]));
            }
            let f = 0, bd = Infinity;
            FY.forEach((fy, i) => { if (Math.abs(fy - y) < bd && fy >= y - 4) { bd = Math.abs(fy - y); f = i; } });
            return -rest(f, x);
        };
        if (bot.left > 0) { bot.left--; return bot.mask; }
        const b0 = base(R);
        const away = b0 & B.right ? B.left : B.right;
        const cands = [[b0, 0], [b0 | B.a, 22], [B.a, 22], [0, 12], [0, 30], [B.down, 16], [away, 14], [away | B.a, 22]];
        let best = cands[0], bs = -Infinity;
        for (const c of cands) {
            const C = simulate(R, 70, (S, i) => (i < Math.max(1, c[1]) ? c[0] : base(S)));
            const sc = progress(C) - (c === cands[0] ? 0 : 5);
            if (sc > bs) { bs = sc; best = c; }
        }
        bot.mask = best[0];
        bot.left = Math.max(4, Math.min(best[1], 6)) - 1;
        return best[0];
    },
    run(R, bot) {
        const h = first(R, 'runner');
        if (!h) return 0;
        // the default: run right and jump at walls, gaps and walkers
        const base = (C) => {
            const g = first(C, 'runner');
            if (!g) return 0;
            let m = B.right;
            const W = C.map.w, solidAt = (x, y) => {
                const tx = Math.floor(x / 8), ty = Math.floor(y / 8);
                if (tx < 0 || ty < 0 || tx >= W || ty >= C.map.h) return false;
                return (C.P.flags[C.map.t[ty * W + tx]] & V.FLAG.solid) !== 0;
            };
            const fx = g.x + 12;
            const wall = solidAt(fx, g.y + 4) || solidAt(fx + 6, g.y + 4);
            const gap = !solidAt(fx + 4, g.y + 12) && !solidAt(fx + 4, g.y + 20);
            const foe = all(C, 'walker').some((w) => w.x > g.x && w.x - g.x < 30 && Math.abs(w.y - g.y) < 10);
            if (g.onground) { if ((wall || gap || foe) && !(C.btn & B.a)) m |= B.a; }
            else if (g.vy < 0) m |= B.a;
            return m;
        };
        if (bot.left > 0) { bot.left--; return bot.mask === -1 ? base(R) : bot.mask; }
        const score = (C) => {
            if (C.status === 'win') return 1e6;
            if (hurt(R, C)) return -1e6;
            const g = first(C, 'runner');
            return cx(g) - Math.max(0, g.y - 96) * 2;
        };
        const cands = [[-1, 4], [B.right | B.a, 30], [B.right | B.a, 12], [B.a, 30], [0, 12], [B.left, 12], [B.left | B.a, 24]];
        let best = cands[0], bs = -Infinity;
        for (const c of cands) {
            const C = simulate(R, 100, (S, i) => (i < c[1] && c[0] !== -1 ? c[0] : base(S)));
            const sc = score(C) - (c === cands[0] ? 0 : 3);
            if (sc > bs) { bs = sc; best = c; }
        }
        bot.mask = best[0];
        bot.left = Math.min(best[1], 4) - 1;
        return best[0] === -1 ? base(R) : best[0];
    },
    dungeon(R, bot) {
        const h = first(R, 'hero');
        if (!h) return 0;
        const W = R.map.w, H = R.map.h;
        const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || (R.P.flags[R.map.t[y * W + x]] & V.FLAG.solid);
        // swing at a blob in reach, facing it first
        for (const b of all(R, 'blob')) {
            const dx = cx(b) - cx(h), dy = cy(b) - cy(h);
            if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
                const want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? [1, 0] : [-1, 0]) : (dy > 0 ? [0, 1] : [0, -1]);
                if (h.fx !== want[0] || h.fy !== want[1]) return want[0] > 0 ? B.right : want[0] < 0 ? B.left : want[1] > 0 ? B.down : B.up;
                if (!all(R, 'sword').length && !bot.swung) { bot.swung = true; return B.a; }
                bot.swung = false;
                return 0;
            }
        }
        bot.swung = false;
        // where to: the key, then the door, then the stairs or the relic
        const keys = R.globals.keys || 0;
        const goals = [];
        const key = first(R, 'key'), relic = first(R, 'relic');
        let doorCells = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (R.map.t[y * W + x] === 3) doorCells.push([x, y]);
        if (relic && !doorCells.length) goals.push([Math.round(relic.x / 8), Math.round(relic.y / 8)]);
        else if (keys > 0 && doorCells.length) goals.push(...doorCells);
        else if (key) goals.push([Math.round(key.x / 8), Math.round(key.y / 8)]);
        else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (R.map.t[y * W + x] === 4) goals.push([x, y]);
        if (!goals.length && relic) goals.push([Math.round(relic.x / 8), Math.round(relic.y / 8)]);
        const goalSet = new Set(goals.map(([x, y]) => y * W + x));
        const hx = Math.round((h.x) / 8), hy = Math.round((h.y) / 8);
        const prev = new Map([[hy * W + hx, -1]]);
        const q = [[hx, hy]];
        let found = -1;
        while (q.length) {
            const [x, y] = q.shift();
            if (goalSet.has(y * W + x)) { found = y * W + x; break; }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy, k = ny * W + nx;
                if (prev.has(k)) continue;
                if (solid(nx, ny) && !goalSet.has(k)) continue;
                prev.set(k, y * W + x);
                q.push([nx, ny]);
            }
        }
        if (found < 0) return 0;
        let k = found, step = found;
        while (prev.get(k) !== -1) { step = k; k = prev.get(k); }
        const tx = (step % W) * 8, ty = Math.floor(step / W) * 8;
        const dx = tx - h.x, dy = ty - h.y;
        if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) return 0;
        return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? B.right : B.left) : (dy > 0 ? B.down : B.up);
    },
    last(R) {
        const s = first(R, 'ship');
        if (!s) return 0;
        let best = null;
        for (const st of all(R, 'star')) if (st.y < s.y && (!best || st.y > best.y)) best = st;
        if (!best) return 0;
        return toward(cx(s), cx(best), 2, B.left, B.right);
    },
};

/** Play a cart with a bot until it ends or frames run out. Returns the run. */
export function playOut(cart, botName, { seed = 1, frames = 60 * 300, onFrame } = {}) {
    const P = V.prepare(cart);
    const R = V.newRun(P, { seed });
    const bot = {};
    const f = BOTS[botName];
    while (R.status === 'run' && R.stats.frames < frames) {
        V.stepRun(R, f(R, bot));
        R.events.length = 0;
        if (onFrame) onFrame(R);
    }
    return R;
}
export { first, all, cx, cy };
