// The AI pilot: plays demo mode and drives the headless tests. It reads the world
// directly and returns the same input frame a human produces.

import { W, FIELD, BALL } from '../config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Fold an unbounded x back into the walls (the ball's path ignoring obstacles). */
function fold(x) {
    const lo = BALL.r, hi = W - BALL.r, span = hi - lo;
    let u = (x - lo) % (2 * span);
    if (u < 0) u += 2 * span;
    return lo + (u <= span ? u : 2 * span - u);
}

export class Bot {
    constructor(skill = 1) {
        this.skill = skill;
        this.prevFire = false;
        this.aimX = W / 2;
        this.aimT = 0;
        this.wobble = 0;
        this.seed = 0x2545F491;
    }

    rand() { this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0; return this.seed / 4294967296; }

    /** Time and x at which ball b next reaches height yLine going down. */
    predict(b, yLine) {
        let t = 0, y = b.y, vy = b.vy;
        if (vy >= 0) {
            const top = FIELD.top - BALL.r;
            t = (top - y) / Math.max(vy, 1);
            y = top; vy = -vy;
        }
        t += (y - yLine) / Math.max(-vy, 1);
        return { t, x: fold(b.x + b.vx * t) };
    }

    decide(w, dt = 1 / 120) {
        const p = w.paddle;
        const inp = { axis: 0, dx: 0, targetX: null, fire: false, firePressed: false, bomb: false };
        if (w.state !== 'play' && w.state !== 'intro') { inp.fire = (w.time * 2) % 1 < 0.5; inp.firePressed = inp.fire && !this.prevFire; this.prevFire = inp.fire; return inp; }

        this.aimT -= dt;
        if (this.aimT <= 0) { this.aimT = 0.8; this.aimX = this.pickAim(w); }
        this.wobble += dt;

        const lineY = p.y + p.h + BALL.r;
        let urgent = null;
        for (const b of w.balls) {
            if (b.stuck || b.captured) continue;
            const pr = this.predict(b, lineY);
            if (b.vy < 0 && (!urgent || pr.t < urgent.t)) urgent = { ...pr, b };
            if (!urgent && b.vy >= 0) urgent = { ...pr, b, far: true };
        }

        let target = p.x;
        if (urgent) {
            // choose the paddle spot so the bounce heads toward aimX
            const dy = 200;
            const a = clamp(Math.atan2(this.aimX - urgent.x, dy), -0.95, 0.95);
            const off = a / (Math.PI / 3);
            target = urgent.x - off * (p.w / 2) * 0.85;
            if (urgent.far) target = (target + urgent.x) / 2;
        }

        // few invaders left and the ball is far away: hunt them with the laser
        if ((!urgent || urgent.far || urgent.t > 0.9) && w.form && !w.boss) {
            const inv = w.slots.filter((s) => s.alive && s.inv);
            if (inv.length && inv.length <= 3) {
                const e = inv.reduce((a, b) => (a.y < b.y ? a : b));
                const lead = (e.y - p.y) / 300 * (w.form.dir * 2 / Math.max(0.06, w.beatInterval()));
                target = e.x + e.w / 2 + (e.state === 'form' ? lead : 0);
            }
        }
        // dodge: find the nearest spot no bullet will land on before it can be left again
        const ballSoon = urgent && !urgent.far && urgent.t < 0.45;
        const threats = [];
        for (const bl of w.bullets) {
            if (bl.vy >= 0) continue;
            const ty = (bl.y - bl.h / 2 - (p.y + p.h)) / -bl.vy;
            if (ty < -0.05 || ty > 1.1) continue;
            threats.push({ x: bl.x + bl.vx * Math.max(0, ty), t: ty });
        }
        const half = p.w / 2 + 3;
        const hitAt = (x) => threats.some((th) => Math.abs(th.x - x) < half && (!ballSoon || th.t < urgent.t + 0.25));
        let danger = 0;
        if (hitAt(target)) {
            danger = threats.length;
            let best = null;
            for (let d = 4; d < 160 && best === null; d += 4) {
                for (const sgn of [1, -1]) {
                    const x = target + sgn * d;
                    if (x < p.w / 2 || x > W - p.w / 2) continue;
                    if (!hitAt(x)) { best = x; break; }
                }
            }
            if (best !== null && (!ballSoon || Math.abs(best - target) < p.w / 2 + 2)) target = best;
            else if (best !== null && ballSoon) target = best;
        }
        for (const bm of w.beams) if (bm.kind === 'beam' && Math.abs(bm.x - target) < p.w / 2 + 8) target = bm.x < W / 2 ? bm.x + p.w / 2 + 14 : bm.x - p.w / 2 - 14;
        for (const e of w.free) if (e.alive && e.kind === 'diver' && e.y < 90 && Math.abs(e.x + e.w / 2 - target) < p.w / 2 + 8) target = e.x < W / 2 ? e.x + 40 : e.x - 30;
        for (const s of w.slots) if (s.alive && s.kind === 'diver' && s.state === 'dive' && s.y < 90 && Math.abs(s.x + s.w / 2 - target) < p.w / 2 + 8) target = s.x < W / 2 ? s.x + 40 : s.x - 30;

        // catch capsules when there's time
        if ((!urgent || urgent.far || urgent.t > 1.2) && !danger) {
            for (const c of w.capsules) {
                const tc = (c.y - p.y) / 42;
                if (tc < 1.6 && Math.abs(c.x + c.w / 2 - p.x) < 90) { target = c.x + c.w / 2; break; }
            }
        }
        if (this.skill < 1) target += Math.sin(this.wobble * 3.1) * (1 - this.skill) * 16;
        inp.targetX = clamp(target, 0, W);

        // fire: launch, or shoot when something is overhead
        const stuck = w.balls.some((b) => b.stuck);
        let want = false;
        if (stuck) want = Math.abs(p.x - this.aimX) < 50 || w.stateT > 1.5;
        else {
            for (const e of w.targetList()) {
                if (!e.alive || e.kind === 'mirror' || (e.btype === 'G')) continue;
                if (Math.abs(e.x + e.w / 2 - p.x) < e.w / 2 + 2) { want = true; break; }
            }
            if (w.boss && !w.boss.dead) want = true;
            if (w.power.L > 0) want = true;
        }
        inp.fire = want && !(this.prevFire && stuck);
        inp.firePressed = inp.fire && !this.prevFire;
        this.prevFire = inp.fire;
        if (danger >= 3 && w.session.bombs > 0 && !w.demo) inp.bomb = true;
        if (danger >= 2 && w.session.bombs > 0 && w.paddle.invuln <= 0 && w.balls.length && ballSoon) inp.bomb = true;
        return inp;
    }

    pickAim(w) {
        if (w.boss && !w.boss.dead) {
            const g = w.boss.grid;
            let sx = 0, n = 0;
            for (let i = 0; i < g.cells.length; i++) if (g.cells[i] && g.types[g.cells[i]].core) { sx += g.x + (i % g.cols + 0.5) * g.cw; n++; }
            return n ? sx / n : g.x + g.w / 2;
        }
        const inv = w.targetList().filter((e) => e.alive && e.inv);
        if (!inv.length) return W / 2;
        // the lowest invader first; it is the one about to land
        inv.sort((a, b) => a.y - b.y);
        const pick = inv[Math.min(inv.length - 1, Math.floor(this.rand() * Math.min(3, inv.length)))];
        return pick.x + pick.w / 2;
    }
}
