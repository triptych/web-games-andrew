/**
 * race.js — one race: the grid, the countdown and launch, laps and positions, elimination and time
 * trial rules, coins on the road, resets, and the results.
 *
 * Types:
 *   race   everyone races `laps` laps; finishing order counts
 *   duel   the same, one on one (champions and the rival)
 *   elim   each time the leader completes a lap, whoever is last is knocked out
 *   tt     the player alone against target times (gold / silver / bronze)
 *
 * The player is entrant 0. Drive the race with step(dt, playerControls); read `events` after each
 * step for the view and the audio (cleared at the start of the next step).
 */

import { Car, collideCars, NO_INPUT } from './car.js';
import { Driver } from './ai.js';
import { COUNTDOWN } from '../config.js';
import { Rng } from '../rng.js';

export class Race {
    /**
     * @param opts.track   Track
     * @param opts.type    'race' | 'duel' | 'elim' | 'tt'
     * @param opts.laps
     * @param opts.entrants [{ name, spec, ai: { skill, lane, nitroHappy } | null, ... }]; [0] is the player
     * @param opts.targets  for 'tt': [gold, silver, bronze] seconds
     * @param opts.rubber   gentle catch-up for the pack (not in duels)
     */
    constructor(opts) {
        this.track = opts.track;
        this.type = opts.type || 'race';
        this.laps = opts.laps || 3;
        this.targets = opts.targets || null;
        this.rubber = !!opts.rubber;
        this.rng = new Rng(opts.seed || 7);
        this.entrants = opts.entrants;
        this.phase = 'countdown';
        this.cd = COUNTDOWN;          // countdown seconds left
        this.t = 0;                   // race clock from the green light
        this.events = [];
        this.cars = [];
        this.drivers = [];
        this.finishOrder = [];
        this.elimOrder = [];
        this.coinsGot = 0;
        this.coinTaken = new Uint8Array(this.track.coins.length);
        this.playerDone = false;
        this.doneT = 0;
        this.throttleSince = -1;      // when the player went to full throttle during the countdown
        this.leaderLaps = 0;

        const tr = this.track;
        opts.entrants.forEach((e, k) => {
            const car = new Car(e.spec, k);
            car.power = 1;
            // The rookie starts near the back: the player takes the second-to-last slot (behind the
            // champion in a duel), everyone else fills in around.
            const n = opts.entrants.length;
            const ps = n > 2 ? n - 2 : n - 1;
            const slot = k === 0 ? ps : k - 1 < ps ? k - 1 : k;
            const g = tr.grid[slot % tr.grid.length];
            car.place(tr, g.i, g.d, 0);
            car.dist = -tr.delta(g.i, tr.startI) * tr.ds;   // negative: behind the line
            car.lap = 0;
            car.lapStart = 0;
            car.lapTimes = [];
            car.best = Infinity;
            car.finished = false;
            car.finishT = 0;
            car.out = false;
            car.wrongT = 0;
            car.name = e.name;
            this.cars.push(car);
            this.drivers.push(e.ai ? new Driver(car, e.ai, (opts.seed || 7) * 31 + k * 977) : null);
        });
        if (this.type === 'tt') this.cars.forEach((c, k) => { if (k) c.out = true; });
        this.order = this.cars.slice();
    }

    get player() { return this.cars[0]; }

    step(dt, pctl = NO_INPUT) {
        this.events.length = 0;
        const tr = this.track;
        const P = this.player;

        // ---------------------------------------------------------- countdown
        if (this.phase === 'countdown') {
            const before = this.cd;
            this.cd -= dt;
            if (Math.ceil(before) !== Math.ceil(this.cd) && this.cd > 0) this.events.push({ type: 'beep', n: Math.ceil(this.cd) });
            if (pctl.throttle > 0.5) { if (this.throttleSince < 0) this.throttleSince = this.cd; }
            else this.throttleSince = -1;
            for (const c of this.cars) c.events.length = 0;
            if (this.cd <= 0) {
                this.phase = 'race';
                this.t = 0;
                this.events.push({ type: 'go' });
                // Launch: hit the throttle in the last half second for a boost; too early bogs down.
                if (this.throttleSince >= 0) {
                    if (this.throttleSince <= 0.55) { P.launch = 1.2; this.events.push({ type: 'launch', good: true }); }
                    else { P.launch = 0; P.bog = 0.7; this.events.push({ type: 'launch', good: false }); }
                }
                this.cars.forEach((c, k) => {
                    if (k && this.rng.next() < 0.45) c.launch = 0.6 + this.rng.next() * 0.5;
                });
            }
            return;
        }
        if (this.phase === 'done') return;

        this.t += dt;

        // ---------------------------------------------------------- slipstream
        // Tucked in behind another car on the road ahead: less drag and a little more top end.
        for (const c of this.cars) {
            let best = 0;
            if (!c.out && !c.air && c.speed > 12) {
                for (const o of this.cars) {
                    if (o === c || o.out) continue;
                    const ahead = tr.delta(c.loc.i, o.loc.i) * tr.ds;
                    if (ahead < 3 || ahead > 22 || Math.abs(o.loc.d - c.loc.d) > 2.4) continue;
                    best = Math.max(best, 1 - (ahead - 3) / 19);
                }
            }
            const was = c.draft;
            c.draft += (best - c.draft) * Math.min(1, dt * 3);
            if (c.id === 0 && was < 0.5 && c.draft >= 0.5) this.events.push({ type: 'draft', car: 0 });
        }

        // ---------------------------------------------------------- drive
        for (let k = 0; k < this.cars.length; k++) {
            const c = this.cars[k];
            if (c.out && !c.parked) continue;
            let ctl;
            if (c.finished || c.out) ctl = { throttle: 0, brake: 0.25, steer: 0, drift: false, nitro: false };
            else if (k === 0 && !this.drivers[0]) ctl = pctl;
            else ctl = this.drivers[k].controls(tr, this.cars, this.t);
            if (k === 0 && P.bog > 0) { P.bog -= dt; ctl = { ...ctl, throttle: ctl.throttle * 0.35 }; }
            // After finishing, the cars cruise on their racing line.
            if (c.finished && this.drivers[k]) {
                const ai = this.drivers[k].controls(tr, this.cars, this.t);
                ctl = { ...ai, throttle: Math.min(ai.throttle, c.speed > 14 ? 0 : 0.6), nitro: false };
            } else if (c.finished && k === 0) {
                if (!this.cruise) this.cruise = new Driver(c, { skill: 0.7 }, 3);
                ctl = this.cruise.controls(tr, this.cars, this.t);
                ctl = { ...ctl, throttle: c.speed > 12 ? 0 : 0.5, nitro: false };
            }
            const i0 = c.loc.i, f0 = c.loc.f;
            c.step(tr, ctl, dt);
            // Progress along the track, wrap-aware.
            const di = tr.delta(i0, c.loc.i) + (c.loc.f - f0);
            c.dist += di * tr.ds;
        }
        collideCars(this.cars.filter((c) => !c.out));

        // ---------------------------------------------------------- per car bookkeeping
        for (let k = 0; k < this.cars.length; k++) {
            const c = this.cars[k];
            for (const e of c.events) this.events.push(e);
            c.events.length = 0;
            if (c.out) continue;

            // Laps.
            if (!c.finished && c.dist >= (c.lap + 1) * tr.L) {
                const lt = this.t - c.lapStart;
                c.lapTimes.push(lt);
                c.best = Math.min(c.best, lt);
                c.lap++;
                c.lapStart = this.t;
                if (c.lap >= this.laps && this.type !== 'elim') {
                    c.finished = true;
                    c.finishT = this.t;
                    this.finishOrder.push(c);
                    this.events.push({ type: 'finish', car: k, pos: this.finishOrder.length });
                    if (k === 0) this.playerDone = true;
                } else {
                    this.events.push({ type: 'lap', car: k, lap: c.lap, time: lt, last: c.lap === this.laps - 1 });
                }
                if (this.type === 'elim' && c.lap > this.leaderLaps) {
                    this.leaderLaps = c.lap;
                    this.eliminateLast();
                }
            }

            // Wrong way.
            const fwd = Math.sin(c.h) * c.loc.tx + Math.cos(c.h) * c.loc.tz;
            const mv = (c.vx * c.loc.tx + c.vz * c.loc.tz);
            c.wrongT = fwd < -0.3 && mv < -2 ? c.wrongT + dt : Math.max(0, c.wrongT - dt * 2);

            // Stuck: back on the track.
            if (c.speed < 1.6 && !c.finished && !c.air) c.stuckT += dt; else c.stuckT = 0;
            if (c.stuckT > (k === 0 ? 4.5 : 2.5) || c.y < tr.heightAt(c.loc.i, c.loc.f, c.loc.d) - 6) { c.reset(tr); c.stuckT = 0; }

            // Rubber band, gently, and never in duels.
            if (k && this.rubber && !c.finished) {
                const gap = P.dist - c.dist;
                c.power = gap > 40 ? 1 + Math.min(0.06, (gap - 40) * 0.0006) : gap < -60 ? 1 - Math.min(0.05, (-gap - 60) * 0.0004) : 1;
            }
        }

        // ---------------------------------------------------------- coins (player only)
        if (!P.finished) {
            const co = tr.coins;
            for (let j = 0; j < co.length; j++) {
                if (this.coinTaken[j]) continue;
                const c = co[j];
                if (Math.abs(tr.delta(P.loc.i, c.i)) > 3) continue;
                const dx = c.x - P.x, dz = c.z - P.z, dy = c.y - (P.y + 0.7);
                if (dx * dx + dz * dz + dy * dy * 0.5 < 2.6 * 2.6) {
                    this.coinTaken[j] = 1;
                    this.coinsGot += c.v;
                    this.events.push({ type: 'coin', idx: j, v: c.v, x: c.x, y: c.y, z: c.z });
                }
            }
        }

        // ---------------------------------------------------------- positions
        this.order = this.cars.filter((c) => !(this.type === 'tt' && c.id)).slice().sort((a, b) => {
            if (a.out !== b.out) return a.out ? 1 : -1;
            if (a.out && b.out) return this.elimOrder.indexOf(b) - this.elimOrder.indexOf(a);
            if (a.finished !== b.finished) return a.finished ? -1 : 1;
            if (a.finished) return a.finishT - b.finishT;
            return b.dist - a.dist;
        });

        // ---------------------------------------------------------- the end
        const alive = this.cars.filter((c) => !c.out);
        if (this.type === 'elim' && alive.length === 1 && !alive[0].finished) {
            const w = alive[0];
            w.finished = true; w.finishT = this.t;
            this.finishOrder.unshift(w);
            this.events.push({ type: 'finish', car: w.id, pos: 1 });
            this.playerDone = true;
        }
        if (this.type === 'elim' && P.out) this.playerDone = true;
        if (this.playerDone) {
            this.doneT += dt;
            if (!this.results) this.results = this.makeResults();
        }
        // Hard stop: no race goes on forever.
        if (this.t > 60 * 12 && !this.playerDone) { this.playerDone = true; this.results = this.makeResults(); }
    }

    eliminateLast() {
        const alive = this.cars.filter((c) => !c.out);
        if (alive.length <= 1) return;
        let last = alive[0];
        for (const c of alive) if (c.dist < last.dist) last = c;
        last.out = true;
        last.parked = true;
        last.outT = this.t;
        this.elimOrder.push(last);
        this.events.push({ type: 'elim', car: last.id, left: alive.length - 1 });
    }

    /** Player's position, 1-based. */
    posOf(car) { return this.order.indexOf(car) + 1; }

    /** Final standings. Cars still racing get a projected time from their average speed. */
    makeResults() {
        const tr = this.track, total = this.laps * tr.L;
        const rows = this.cars.map((c, k) => {
            let time = c.finishT, done = c.finished;
            if (!done && !c.out) {
                const avg = Math.max(8, c.dist / Math.max(1, this.t));
                time = this.t + Math.max(0, total - c.dist) / avg;
            }
            return { k, name: c.name, time, done, out: c.out, best: c.best, dist: c.dist };
        });
        let order;
        if (this.type === 'elim') {
            const alive = this.cars.filter((c) => !c.out).sort((a, b) => b.dist - a.dist);
            const out = this.elimOrder.slice().reverse();
            order = [...alive, ...out].map((c) => rows[c.id]);
        } else if (this.type === 'tt') {
            order = [rows[0]];
        } else {
            order = rows.filter((r) => !r.out).sort((a, b) => a.time - b.time);
        }
        const pos = order.findIndex((r) => r.k === 0) + 1;
        let medal = null;
        if (this.type === 'tt' && this.targets) {
            const t = rows[0].time;
            medal = t <= this.targets[0] ? 'gold' : t <= this.targets[1] ? 'silver' : t <= this.targets[2] ? 'bronze' : null;
        }
        return { order, pos, medal, coins: this.coinsGot, time: rows[0].time, best: this.player.best, type: this.type };
    }
}
