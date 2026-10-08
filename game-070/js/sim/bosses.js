// The three bosses. Each boss owns a set of "part" enemies in world.enemies
// (kind 'pod', 'core', 'seg', 'head', 'plate', 'eye'), positions them every step,
// and takes damage through them: parts have hp and a `shielded` flag (a shielded
// part absorbs lasers). Bosses follow the ship around the planet so the fight
// stays on screen.

import { FIELD, SCORE } from '../config.js';
import { wrap, wdx } from './util.js';
import { makeEnemy, fireAimed, spawnSnatcher, spawnHunter } from './enemies.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const TAU = Math.PI * 2;

function part(w, boss, kind, hp, r, extra = {}) {
    return makeEnemy(w, kind, boss.x, boss.y, { hp, hpMax: hp, r, boss, warp: 0, ...extra });
}

class Boss {
    constructor(w, name) {
        this.w = w; this.name = name;
        this.x = wrap(w.ship.x + 330 * (w.ship.face || 1)); this.y = 190;
        this.t = 0; this.phase = 1; this.dead = false; this.enter = 1.8;
        this.k = (1 + w.loop * 0.4) * w.diff.boss;
        this.parts = [];
    }
    follow(dt, speed, keep = 0) {
        const s = this.w.ship;
        const tx = wrap(s.x + keep * (s.face || 1));
        const dx = wdx(tx, this.x);
        if (Math.abs(dx) > 40) this.x = wrap(this.x + clamp(dx, -speed * dt, speed * dt) * (Math.abs(dx) > 380 ? 6 : 1));
    }
    get hp() { return this.parts.reduce((a, p) => a + (p.alive ? Math.max(0, p.hp) : 0), 0); }
    get hpMax() { return this.parts.reduce((a, p) => a + p.hpMax, 0); }
    fraction() { return this.hpMax ? this.hp / this.hpMax : 0; }
    checkPhase() {
        if (this.phase === 1 && this.fraction() < 0.5) {
            this.phase = 2;
            this.w.ev('bossPhase', this.x, this.y);
        }
    }
    /** Called by the world when a part's hp reaches 0. Return true to keep it alive. */
    partKilled() { return false; }
    die() {
        if (this.dead) return;
        this.dead = true;
        const w = this.w;
        for (const p of this.parts) if (p.alive) { p.alive = false; w.ev('explode', p.x, p.y, { kind: p.kind, size: 1.2 }); }
        w.addScore(this.bounty * (1 + w.loop), this.x, this.y);
        w.ev('bossDie', this.x, this.y, { name: this.name });
        w.freeze = 0.5;
        for (const e of w.enemies) if (e.alive && (e.kind === 'mine')) e.alive = false;
        w.shots.length = 0;
    }
}

// ================================================================== HARVESTER
// A saucer of rings. Eight pods ride the rim; the core under the dome is shielded
// until most of the pods are gone. Tractor beam, snatcher launches, shot rings.
export class Harvester extends Boss {
    constructor(w) {
        super(w, 'THE HARVESTER');
        this.kind = 'harvester';
        this.bounty = 10000;
        this.rot = 0;
        this.ringT = 3; this.launchT = 4; this.beamT = 4.5; this.aimT = 2;
        this.beam = null;   // { x, t, col, lift }
        const podHp = Math.round(12 * this.k);
        for (let i = 0; i < 8; i++) this.parts.push(part(w, this, 'pod', podHp, 8, { idx: i }));
        this.core = part(w, this, 'core', Math.round(90 * this.k), 13, { shielded: true });
        this.parts.push(this.core);
    }
    step(dt) {
        const w = this.w;
        this.t += dt;
        const p2 = this.phase === 2;
        this.rot += dt * (p2 ? 1.05 : 0.6);
        if (!this.beam) this.follow(dt, p2 ? 85 : 55);
        this.y = 182 + Math.sin(this.t * 0.8) * 10;
        const pods = this.parts.filter((p) => p.kind === 'pod');
        for (const p of pods) {
            const a = this.rot + (p.idx / 8) * TAU;
            p.x = wrap(this.x + Math.cos(a) * 64);
            p.y = this.y - 4 + Math.sin(a) * 13;
            p.depth = Math.sin(a);
        }
        this.core.x = this.x; this.core.y = this.y - 18;
        const podsLeft = pods.filter((p) => p.alive).length;
        this.core.shielded = podsLeft > 2;
        if (this.enter > 0) { this.enter -= dt; return; }
        this.checkPhase();

        this.ringT -= dt * w.diff.fire;
        if (this.ringT <= 0) {
            this.ringT = p2 ? 2.2 : 3.4;
            const n = p2 ? 14 : 10, off = w.rng() * TAU;
            for (let i = 0; i < n; i++) {
                const a = off + (i / n) * TAU;
                w.addShot(this.x, this.y - 6, Math.cos(a) * 72 * w.diff.shotSpeed, Math.sin(a) * 72 * w.diff.shotSpeed, true);
            }
            w.ev('bossShot', this.x, this.y);
        }
        if (p2) {
            this.aimT -= dt * w.diff.fire;
            if (this.aimT <= 0) {
                this.aimT = 1.6;
                const c = this.core, s = w.ship, sp = 130 * w.diff.shotSpeed;
                const base = Math.atan2(s.y - c.y, wdx(s.x, c.x));
                if (s.alive) for (const d of [-0.2, 0, 0.2]) w.addShot(c.x, c.y, Math.cos(base + d) * sp, Math.sin(base + d) * sp, true);
            }
        }
        this.launchT -= dt;
        if (this.launchT <= 0 && w.planetAlive) {
            this.launchT = p2 ? 5 : 7;
            if (w.countKind('snatcher') < 3) {
                const e = spawnSnatcher(w);
                e.x = this.x; e.y = this.y - 20; e.warp = 0.3;
                w.ev('launch', this.x, this.y);
            }
        }
        // tractor beam
        if (!this.beam) {
            this.beamT -= dt;
            if (this.beamT <= 0 && w.planetAlive) {
                this.beamT = p2 ? 8 : 11;
                let best = null, bd = 340;
                for (const c of w.colonists) {
                    if (c.state !== 'walk') continue;
                    const d = Math.abs(wdx(c.x, this.x));
                    if (d < bd) { bd = d; best = c; }
                }
                if (best) { this.beam = { col: best, t: 0, lift: false, hits: 0 }; w.ev('tractor', this.x, this.y); }
            }
        } else {
            const b = this.beam, c = b.col;
            b.t += dt;
            if (!b.lift) {
                if (c.state !== 'walk') { this.beam = null; return; }
                this.x = wrap(this.x + clamp(wdx(c.x, this.x), -90 * dt, 90 * dt));
                if (b.t > 1.6 && Math.abs(wdx(c.x, this.x)) < 8) { b.lift = true; c.state = 'grabbed'; c.by = this; w.ev('abduct', c.x, c.y); }
                if (b.t > 6) this.beam = null;
            } else {
                if (c.state !== 'grabbed' || c.by !== this) { this.beam = null; return; }
                c.x = this.x;
                c.y += 34 * dt;
                if (c.y >= this.y - 26) { w.killColonist(c, 'taken'); this.beam = null; }
            }
        }
    }
    onHit() {
        if (this.beam && this.beam.lift) {
            this.beam.hits++;
            if (this.beam.hits >= 4) { this.w.dropColonist(this.beam.col); this.beam = null; this.beamT = 6; }
        }
    }
    die() {
        if (this.beam && this.beam.lift) this.w.dropColonist(this.beam.col);
        this.beam = null;
        super.die();
    }
    partKilled(p) {
        const w = this.w;
        if (p === this.core) { this.die(); return false; }
        w.addScore(SCORE.bossPod, p.x, p.y);
        w.ev('explode', p.x, p.y, { kind: 'pod', size: 1.3 });
        this.checkPhase();
        return false;
    }
}

// ================================================================== LEVIATHAN
// A serpent. The head steers after the ship; the body follows the head's trail.
// The head is shielded until the body is short.
export class Leviathan extends Boss {
    constructor(w) {
        super(w, 'THE LEVIATHAN');
        this.kind = 'leviathan';
        this.bounty = 15000;
        this.ang = Math.PI;
        this.trail = [];
        this.lungeT = 5; this.lunge = 0; this.shotT = 1; this.fanT = 2;
        const n = 12 + Math.min(4, w.loop * 2);
        this.head = part(w, this, 'head', Math.round(70 * this.k), 11, { shielded: true });
        this.parts.push(this.head);
        for (let i = 0; i < n; i++) this.parts.push(part(w, this, 'seg', Math.round(9 * this.k), 8, { idx: i }));
        for (let i = 0; i < 400; i++) this.trail.push({ x: wrap(this.x + i * 3), y: this.y });
    }
    step(dt) {
        const w = this.w, s = w.ship;
        this.t += dt;
        const p2 = this.phase === 2;
        // steer the head toward a point circling the ship
        const tx = wrap(s.x + Math.cos(this.t * 0.7) * 110), ty = clamp(s.y + Math.sin(this.t * 1.1) * 70, 50, FIELD.top - 20);
        const want = Math.atan2(ty - this.y, wdx(tx, this.x));
        let da = want - this.ang;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        this.ang += clamp(da, -1.7 * dt, 1.7 * dt);
        if (this.enter <= 0) {
            this.lungeT -= dt;
            if (this.lungeT <= 0) { this.lungeT = p2 ? 4 : 6; this.lunge = 1; w.ev('roar', this.x, this.y); }
        }
        this.lunge = Math.max(0, this.lunge - dt);
        const sp = (p2 ? 150 : 112) * (1 + this.lunge * 1.1) * w.diff.speed;
        const far = Math.abs(wdx(s.x, this.x)) > 450 ? 2.5 : 1;
        this.x = wrap(this.x + Math.cos(this.ang) * sp * dt * far);
        this.y = clamp(this.y + Math.sin(this.ang) * sp * dt, 44, FIELD.top - 12);
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > 400) this.trail.length = 400;
        // place the head and the body along the trail at fixed arc spacing
        this.head.x = this.x; this.head.y = this.y; this.head.ang = this.ang;
        const segs = this.parts.filter((p) => p.kind === 'seg' && p.alive);
        let acc = 0, ti = 0, want2 = 16;
        for (const sgm of segs) {
            while (ti < this.trail.length - 1 && acc < want2) {
                const a = this.trail[ti], b = this.trail[ti + 1];
                acc += Math.hypot(wdx(a.x, b.x), a.y - b.y);
                ti++;
            }
            const p = this.trail[ti];
            sgm.x = p.x; sgm.y = p.y;
            want2 += 15;
        }
        this.head.shielded = segs.length > 4;
        if (this.enter > 0) { this.enter -= dt; return; }
        this.checkPhase();
        this.shotT -= dt * w.diff.fire * (p2 ? 1.5 : 1);
        if (this.shotT <= 0 && segs.length) {
            this.shotT = 0.55;
            const src = w.rng.pick(segs);
            if (w.onScreen(src.x, -10)) fireAimed(w, src, 115, 0.1);
        }
        if (p2 && segs.length) {
            this.fanT -= dt * w.diff.fire;
            if (this.fanT <= 0) {
                this.fanT = 2.2;
                const tail = segs[segs.length - 1];
                const base = Math.atan2(s.y - tail.y, wdx(s.x, tail.x));
                for (let i = -2; i <= 2; i++) {
                    const a = base + i * 0.22;
                    w.addShot(tail.x, tail.y, Math.cos(a) * 100 * w.diff.shotSpeed, Math.sin(a) * 100 * w.diff.shotSpeed, true);
                }
                w.ev('bossShot', tail.x, tail.y);
            }
        }
    }
    partKilled(p) {
        const w = this.w;
        if (p === this.head) { this.die(); return false; }
        w.addScore(SCORE.bossSeg, p.x, p.y);
        w.ev('explode', p.x, p.y, { kind: 'seg', size: 1.2 });
        this.checkPhase();
        return false;
    }
}

// ================================================================== OVERSEER
// A giant eye in a cage of turning shield plates. Hurt only while the eye is
// open; while open it sweeps a beam at you. Spirals of shots while closed.
export class Overseer extends Boss {
    constructor(w) {
        super(w, 'THE OVERSEER');
        this.kind = 'overseer';
        this.bounty = 20000;
        this.rot = 0; this.spinA = 0; this.spiralT = 0; this.hunterT = 10;
        this.cycle = 'closed'; this.cycleT = 3.5; this.open = 0;
        this.beams = [];
        this.eye = part(w, this, 'eye', Math.round(120 * this.k), 18, { shielded: true });
        this.parts.push(this.eye);
        const plateHp = Math.round(16 * this.k);
        for (let i = 0; i < 6; i++) this.parts.push(part(w, this, 'plate', plateHp, 10, { idx: i }));
    }
    step(dt) {
        const w = this.w, s = w.ship;
        this.t += dt;
        const p2 = this.phase === 2;
        this.follow(dt, 70, 140);
        this.y = 150 + Math.sin(this.t * 0.5) * 35;
        this.rot += dt * (p2 ? -1.35 : 0.85);
        for (const p of this.parts) {
            if (p.kind !== 'plate') continue;
            const a = this.rot + (p.idx / 6) * TAU;
            p.x = wrap(this.x + Math.cos(a) * 44);
            p.y = this.y + Math.sin(a) * 44;
            p.ang = a;
        }
        this.eye.x = this.x; this.eye.y = this.y;
        // eye cycle
        this.cycleT -= dt;
        if (this.cycleT <= 0) {
            const next = { closed: ['opening', 0.7], opening: ['open', p2 ? 3.6 : 3], open: ['closing', 0.5], closing: ['closed', p2 ? 2.6 : 3.4] }[this.cycle];
            this.cycle = next[0]; this.cycleT = next[1];
            if (this.cycle === 'open' && this.enter <= 0) {
                const n = p2 ? 2 : 1;
                for (let i = 0; i < n; i++) {
                    const base = Math.atan2(s.y - this.y, wdx(s.x, this.x));
                    this.beams.push({ ang: base + (i ? Math.PI : 0) + (i ? 0 : -0.5), warn: 0.8, live: 1.8, dir: i ? -1 : 1 });
                }
                w.ev('beamWarn', this.x, this.y);
            }
        }
        const target = this.cycle === 'open' ? 1 : this.cycle === 'opening' ? 0.6 : this.cycle === 'closing' ? 0.3 : 0;
        this.open += (target - this.open) * Math.min(1, dt * 6);
        this.eye.shielded = this.cycle !== 'open';
        if (this.enter > 0) { this.enter -= dt; this.beams.length = 0; return; }
        this.checkPhase();
        // beams sweep toward the ship
        for (const b of this.beams) {
            if (b.warn > 0) {
                b.warn -= dt;
                if (b.warn <= 0) w.ev('beamFire', this.x, this.y);
            } else {
                b.live -= dt;
                const want = Math.atan2(s.y - this.y, wdx(s.x, this.x));
                let da = want - b.ang;
                while (da > Math.PI) da -= TAU;
                while (da < -Math.PI) da += TAU;
                b.ang += clamp(da, -0.45 * dt, 0.45 * dt) * (b.dir > 0 ? 1 : 0.6) + (b.dir < 0 ? 0.35 * dt : 0);
                // does it touch the ship?
                if (s.alive && s.inv <= 0) {
                    const dx = wdx(s.x, this.x), dy = s.y - this.y;
                    const along = dx * Math.cos(b.ang) + dy * Math.sin(b.ang);
                    const perp = Math.abs(-dx * Math.sin(b.ang) + dy * Math.cos(b.ang));
                    if (along > 10 && perp < 5) w.killShip('beam');
                }
            }
        }
        this.beams = this.beams.filter((b) => b.live > 0 && this.cycle !== 'closed');
        // spirals while closed
        if (this.cycle === 'closed') {
            this.spiralT -= dt * w.diff.fire;
            if (this.spiralT <= 0) {
                this.spiralT = p2 ? 0.22 : 0.3;
                this.spinA += 0.47;
                const arms = p2 ? 3 : 2;
                for (let i = 0; i < arms; i++) {
                    const a = this.spinA + (i / arms) * TAU;
                    w.addShot(this.x + Math.cos(a) * 20, this.y + Math.sin(a) * 20, Math.cos(a) * 82 * w.diff.shotSpeed, Math.sin(a) * 82 * w.diff.shotSpeed, true);
                }
            }
        }
        this.hunterT -= dt;
        if (this.hunterT <= 0) {
            this.hunterT = p2 ? 11 : 15;
            if (w.countKind('hunter') < 2) spawnHunter(w);
        }
    }
    partKilled(p) {
        const w = this.w;
        if (p === this.eye) { this.die(); return false; }
        w.addScore(SCORE.bossPod, p.x, p.y);
        w.ev('explode', p.x, p.y, { kind: 'plate', size: 1.3 });
        this.checkPhase();
        return false;
    }
}

export const BOSSES = { harvester: Harvester, leviathan: Leviathan, overseer: Overseer };
