// The AI pilot: flies the demo in attract mode and plays every wave in the tests.
// It reads the world directly and returns the same input frame a player makes.
// Priorities: dodge, catch falling colonists, set carried ones down, shoot the
// snatcher that is lifting someone, then the nearest threat. Lasers only fly
// horizontally, so most of the work is lining up altitude while facing the target.

import { FIELD } from '../config.js';
import { wdx } from './util.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Bot {
    constructor(skill = 1) {
        this.skill = skill;
        this.t = 0; this.bombT = 2; this.pressT = 0; this.retarget = 0; this.target = null;
        this.wobble = 0;
    }

    targetable(e) {
        if (!e.alive || e.warp > 0 || e.shielded) return false;
        if (e.kind === 'mine') return false;
        if (e.kind === 'dart' && e.state === 'wait') return false;
        return true;
    }

    pickTarget(w) {
        const s = w.ship;
        let best = null, bd = 1e9;
        for (const e of w.enemies) {
            if (!this.targetable(e)) continue;
            const dx = Math.abs(wdx(e.x, s.x)), dy = Math.abs(e.y - s.y);
            let d = dx + dy * 1.6;
            if (e.kind === 'snatcher' && e.state === 'lift') d *= 0.25 * (1 - (e.y - FIELD.ground) / 300);
            if (e.kind === 'snatcher' && e.state === 'grab') d *= 0.5;
            if (e.kind === 'hunter' || e.kind === 'ravager' || e.kind === 'stinger') d *= 0.7;
            if (e.boss) d *= 0.9;
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }

    decide(w, dt) {
        const s = w.ship;
        const out = { ax: 0, ay: 0, fire: false, firePressed: false, bomb: false, hyper: false };
        this.t += dt;
        this.bombT -= dt;
        this.pressT -= dt;
        if (!s.alive || w.state === 'gameover') return out;

        // ---------------------------------------------------------------- danger
        let dodge = 0, danger = 0;
        for (const b of w.shots) {
            const rx = wdx(b.x, s.x), ry = b.y - s.y;
            if (Math.abs(rx) > 160 || Math.abs(ry) > 80) continue;
            for (let k = 1; k <= 6; k++) {
                const tt = k * 0.07;
                const px = rx + (b.vx - s.vx) * tt, py = ry + (b.vy - s.vy * 0.5) * tt;
                if (Math.abs(px) < 14 && Math.abs(py) < 10) { dodge += py >= 0 ? -1.4 : 1.4; danger++; break; }
            }
        }
        let near = 0, brake = false;
        for (const e of w.enemies) {
            if (!e.alive || (e.warp > 0.25) || (e.kind === 'dart' && e.state === 'wait')) continue;
            const rx = wdx(e.x, s.x), ry = e.y - s.y;
            if (Math.abs(rx) > 260 || Math.abs(ry) > 120) continue;
            if (Math.abs(rx) < 130 && Math.abs(ry) < 90 && e.kind !== 'mine') near++;
            // sweep the next half second of relative motion for a collision
            const evx = e.vx || 0, evy = e.vy || 0;
            for (let k = 0; k <= 10; k++) {
                const tt = k * 0.05;
                const px = rx + (evx - s.vx) * tt, py = ry + evy * tt;
                if (Math.abs(px) < e.r + 13 && Math.abs(py) < e.r + 10) {
                    const wgt = 1.6 / (tt + 0.25);
                    dodge += (py >= 0 ? -1 : 1) * wgt * (e.kind === 'mine' || e.kind === 'meteor' ? 1.5 : 1);
                    danger++;
                    if (Math.sign(rx) === Math.sign(s.vx) && Math.abs(s.vx) > 80) brake = true;
                    break;
                }
            }
        }
        const boss = w.boss;
        if (boss && !boss.dead && boss.beams) {
            for (const b of boss.beams) {
                const dx = wdx(s.x, boss.x), dy = s.y - boss.y;
                const along = dx * Math.cos(b.ang) + dy * Math.sin(b.ang);
                const perp = -dx * Math.sin(b.ang) + dy * Math.cos(b.ang);
                if (along > 0 && Math.abs(perp) < 40) { dodge += perp >= 0 ? 2.5 : -2.5; danger += 2; }
            }
        }
        if (this.skill < 1 && Math.sin(this.t * 1.7) > 0.2 + this.skill * 0.7) dodge *= 0.4;

        // ---------------------------------------------------------------- goal
        let goalX = null, goalY = null, aim = null;
        const falling = w.colonists.filter((c) => c.state === 'falling');
        let catching = null;
        for (const c of falling) {
            if (Math.abs(wdx(c.x, s.x)) < 700 && (!catching || c.y > catching.y)) catching = c;
        }
        if (catching && danger < 2) {
            goalX = catching.x; goalY = catching.y + 8 - Math.min(20, -catching.vy * 0.15);
        } else if (s.carry.length && danger < 1 && w.planetAlive) {
            goalY = FIELD.floor;
        }
        this.retarget -= dt;
        if (this.retarget <= 0 || !this.target || !this.targetable(this.target)) {
            this.target = this.pickTarget(w);
            this.retarget = 0.3;
        }
        const T = this.target;
        if (T) aim = T;

        // ---------------------------------------------------------------- horizontal
        if (goalX !== null) {
            const dx = wdx(goalX, s.x);
            const dir = Math.sign(dx) || s.face;
            const stopDist = (s.vx * s.vx) / 1100;
            if (Math.abs(dx) > 6) {
                if (Math.sign(s.vx) === dir && Math.abs(dx) < stopDist) out.ax = -dir * 0.0;   // coast
                else out.ax = dir;
                if (Math.sign(s.vx) === dir && Math.abs(dx) < stopDist * 0.6 && Math.abs(s.vx) > 60) out.ax = -dir;
            }
        } else if (aim) {
            const dx = wdx(aim.x, s.x);
            const dir = Math.sign(dx) || s.face;
            const fast = aim.kind === 'hunter' || aim.kind === 'stinger' || aim.kind === 'ravager';
            const stand = aim.boss ? 150 : fast ? 110 : 140;
            const err = Math.abs(dx) - stand;
            if (s.face !== dir) out.ax = dir;
            else if (err > 30) out.ax = Math.abs(dx) > 500 ? dir : (Math.abs(s.vx) < 260 || Math.sign(s.vx) !== dir ? dir : 0);
            else if (err < -70 && Math.abs(aim.y - s.y) < 30) out.ax = 0;
        } else {
            // patrol
            out.ax = s.face;
        }

        if (brake && Math.sign(out.ax) === Math.sign(s.vx)) out.ax = 0;

        // ---------------------------------------------------------------- vertical
        let wantY = goalY ?? (aim ? aim.y + 1 : 150);
        if (s.carry.length && goalY === null && w.planetAlive && danger < 1) wantY = Math.min(wantY, FIELD.floor + 30);
        this.wobble = Math.sin(this.t * 0.9) * 2;
        out.ay = clamp((wantY + this.wobble - s.y) / 14, -1, 1);
        if (danger) out.ay = clamp(out.ay * 0.3 + dodge, -1, 1);
        if (s.y < FIELD.floor + 4 && out.ay < 0 && !s.carry.length && goalY !== FIELD.floor) out.ay = 0;

        // ---------------------------------------------------------------- fire
        let shoot = false;
        for (const e of w.enemies) {
            if (!this.targetable(e)) continue;
            const along = wdx(e.x, s.x) * s.face;
            if (along > 4 && along < 420 && Math.abs(e.y - (s.y - 1)) < e.r) { shoot = true; break; }
        }
        if (shoot) {
            out.fire = true;
            if (this.pressT <= 0) { out.firePressed = true; this.pressT = 0.09; }
        }

        // ---------------------------------------------------------------- bomb / hyperspace
        let lifting = false;
        for (const e of w.enemies) if (e.alive && e.kind === 'snatcher' && e.state === 'lift' && e.y > FIELD.top - 45 && w.onScreen(e.x)) lifting = true;
        if (w.session.bombs > 0 && this.bombT <= 0 && (danger >= 3 || near >= 5 || lifting)) {
            out.bomb = true; this.bombT = 3.5;
        } else if (danger >= 4 && w.session.bombs === 0 && s.hyperCool <= 0 && this.bombT <= 0) {
            out.hyper = true; this.bombT = 2;
        }
        return out;
    }
}
