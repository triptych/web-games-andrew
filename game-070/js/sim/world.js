// The game, as a pure simulation: no three.js, no DOM. One World is one attack
// wave. The session (score, ships, bombs, colonists, wave, loop) carries over
// between worlds. The view and the audio read the world's state and its
// `events` list, which main.js drains every frame.
//
// States: intro → play ⇄ dying → tally → done, or → gameover (continueGame()
// brings it back).

import { FIELD, SHIP, LASER, COLONIST, SCORE, EXTRA_EVERY, MAX_BOMBS, MAX_LIVES, DIFFICULTY, VIEW_W, WORLD_W } from '../config.js';
import { makeRng } from '../rng.js';
import { wrap, wdx } from './util.js';
import { waveFor, WAVE_COUNT } from './waves.js';
import {
    stepEnemy, stepSquadron, makeEnemy, toRavager, burstHive, splitMeteor,
    spawnSnatcher, spawnMinelayer, spawnHive, spawnHunter, spawnSquadron, spawnMeteor,
} from './enemies.js';
import { BOSSES } from './bosses.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function newSession(difficulty = 'arcade', wave = 0) {
    const d = DIFFICULTY[difficulty] || DIFFICULTY.arcade;
    return {
        difficulty, lives: d.lives, bombs: d.bombs, score: 0, wave, loop: 0, continues: 0,
        nextExtra: EXTRA_EVERY, colonists: COLONIST.count, planetAlive: true, waveCount: 0,
    };
}

export class World {
    constructor(session, opts = {}) {
        const S = this.session = session;
        this.rng = makeRng(opts.seed ?? 1);
        this.demo = !!opts.demo;
        this.god = !!opts.god;
        this.diff = DIFFICULTY[S.difficulty] || DIFFICULTY.arcade;
        this.loop = S.loop;
        this.def = waveFor(S.wave % WAVE_COUNT, S.loop);
        this.aggr = this.def.aggr;
        this.speed = this.diff.speed * (1 + S.loop * 0.12);
        this.maxShots = Math.round(16 + 6 * this.aggr);
        this.events = [];
        this.time = 0; this.state = 'intro'; this.stateT = 0; this.freeze = 0;
        this.nextId = 1;
        this.enemies = []; this.shots = []; this.lasers = []; this.colonists = []; this.squadrons = [];
        this.boss = null;
        this.stats = { kills: 0, shots: 0, rescued: 0, lost: 0, deaths: 0 };
        this.tally = null;

        // a boss wave or the first wave of a loop's third rebuilds the planet
        if (S.wave % 5 === 0) { S.colonists = COLONIST.count; S.planetAlive = true; }
        if (S.colonists <= 0) S.planetAlive = false;
        this.planetAlive = S.planetAlive;

        const sx = this.rng.range(0, WORLD_W);
        this.ship = {
            x: sx, y: 150, vx: 0, vy: 0, face: 1, camOff: SHIP.lead, alive: true, inv: 1.5,
            cool: 0, hyperCool: 0, thrusting: false, carry: [], deadT: 0,
        };
        this.camX = wrap(sx + SHIP.lead);

        if (this.planetAlive) {
            for (let i = 0; i < S.colonists; i++) {
                const x = wrap((i + this.rng.range(0.15, 0.85)) * (WORLD_W / S.colonists) + sx);
                this.colonists.push({ id: this.nextId++, x, y: FIELD.ground, vx: this.rng.chance(0.5) ? COLONIST.walk : -COLONIST.walk, vy: 0, state: 'walk', t: this.rng() * 5, fallFrom: 0 });
            }
        }

        const d = this.def;
        this.quota = { snatcher: d.snatcher || 0, minelayer: d.minelayer || 0, hive: d.hive || 0, squadron: d.squadron || 0, meteor: d.meteor || 0 };
        this.timers = { snatcher: 1.6, minelayer: 4, hive: 8, squadron: 6, meteor: 2, hunter: 0 };
        this.hunterAt = (d.boss ? 999 : 48 - Math.min(20, S.loop * 8 + d.index)) * this.diff.hunterAt;
        S.waveCount++;
        this.ev('waveStart', sx, 150, { wave: S.wave, name: d.name, boss: d.boss || null });
    }

    // ================================================================== helpers
    ev(type, x = 0, y = 0, extra) {
        const e = { type, x, y, t: this.time };
        if (extra) Object.assign(e, extra);
        this.events.push(e);
        return e;
    }
    onScreen(x, margin = 0) { return Math.abs(wdx(x, this.camX)) < VIEW_W / 2 + margin; }
    countKind(kind) { let n = 0; for (const e of this.enemies) if (e.alive && e.kind === kind) n++; return n; }
    spawnX(away) {
        for (let i = 0; i < 12; i++) {
            const x = this.rng.range(0, WORLD_W);
            if (Math.abs(wdx(x, this.ship.x)) > away) return x;
        }
        return wrap(this.ship.x + WORLD_W / 2);
    }
    addShot(x, y, vx, vy, force = false) {
        if (!force && this.shots.length >= this.maxShots) return;
        this.shots.push({ x: wrap(x), y, vx, vy, life: 3.4 });
        this.ev('shot', x, y);
    }
    addScore(n, x, y) {
        if (!n) return;
        const S = this.session;
        S.score += n;
        if (x !== undefined && n >= 200) this.ev('score', x, y, { n });
        while (S.score >= S.nextExtra) {
            S.nextExtra += EXTRA_EVERY;
            S.lives = Math.min(MAX_LIVES, S.lives + 1);
            S.bombs = Math.min(MAX_BOMBS, S.bombs + 1);
            this.ev('extra', this.ship.x, this.ship.y);
        }
    }
    aliveMain() {
        let n = 0;
        for (const e of this.enemies) if (e.alive && !e.minor && !e.boss) n++;
        return n;
    }
    quotaLeft() { const q = this.quota; return q.snatcher + q.minelayer + q.hive + q.squadron + q.meteor; }
    enemiesLeft() { return this.aliveMain() + this.quotaLeft() + (this.boss && !this.boss.dead ? 1 : 0); }

    // ================================================================== colonists
    killColonist(c, why) {
        if (c.state === 'dead') return;
        c.state = 'dead';
        if (c.hunter) c.hunter.target = null;
        c.hunter = null;
        const S = this.session;
        S.colonists = Math.max(0, S.colonists - 1);
        this.stats.lost++;
        this.ev('colonistDie', c.x, c.y, { why });
        if (S.colonists === 0 && this.planetAlive) this.planetDie();
    }
    dropColonist(c) {
        if (c.state !== 'grabbed' && c.state !== 'carried') return;
        c.state = 'falling'; c.by = null; c.vy = 0; c.fallFrom = c.y;
        this.ev('fall', c.x, c.y);
    }
    planetDie() {
        this.planetAlive = false;
        this.session.planetAlive = false;
        this.ev('planetDie', this.ship.x, FIELD.ground);
        for (const e of this.enemies) if (e.alive && e.kind === 'snatcher') toRavager(this, e);
        this.freeze = 0.35;
    }
    meteorImpact(e) {
        this.ev('impact', e.x, FIELD.ground, { size: e.size });
        for (const c of this.colonists) {
            if (c.state === 'walk' && Math.abs(wdx(c.x, e.x)) < 16 + e.r) this.killColonist(c, 'meteor');
        }
    }

    stepColonists(dt) {
        const s = this.ship;
        for (const c of this.colonists) {
            c.t += dt;
            if (c.state === 'walk') {
                c.x = wrap(c.x + c.vx * dt);
                if (this.rng() < dt * 0.15) c.vx = -c.vx;
                c.y = FIELD.ground;
            } else if (c.state === 'falling') {
                c.vy = Math.max(-COLONIST.maxFall, c.vy - COLONIST.gravity * dt);
                c.y += c.vy * dt;
                if (s.alive && Math.abs(wdx(c.x, s.x)) < 12 && Math.abs(c.y - (s.y - 8)) < 13) {
                    c.state = 'carried'; s.carry.push(c);
                    this.addScore(SCORE.catch, c.x, c.y);
                    this.stats.rescued++;
                    this.ev('catch', c.x, c.y);
                } else if (c.y <= FIELD.ground) {
                    c.y = FIELD.ground;
                    if (!this.planetAlive || c.fallFrom - FIELD.ground > COLONIST.safeFall) this.killColonist(c, 'fall');
                    else { c.state = 'walk'; this.addScore(SCORE.softLanding, c.x, c.y); this.ev('softLand', c.x, c.y); }
                }
            } else if (c.state === 'carried') {
                const i = s.carry.indexOf(c);
                c.x = s.x; c.y = s.y - 10 - i * 3;
                if (s.y <= FIELD.floor + 3 && this.planetAlive) {
                    c.state = 'walk'; c.y = FIELD.ground;
                    c.x = wrap(s.x + (i - (s.carry.length - 1) / 2) * 6);
                    s.carry.splice(i, 1);
                    this.addScore(SCORE.setDown, c.x, c.y);
                    this.ev('setDown', c.x, c.y);
                }
            }
        }
        this.colonists = this.colonists.filter((c) => c.state !== 'dead');
    }

    // ================================================================== ship
    stepShip(dt, inp) {
        const s = this.ship;
        if (!s.alive) return;
        s.inv = Math.max(0, s.inv - dt);
        s.cool -= dt;
        s.hyperCool -= dt;
        const ax = clamp(inp.ax || 0, -1, 1), ay = clamp(inp.ay || 0, -1, 1);
        s.thrusting = false;
        if (Math.abs(ax) > 0.2) {
            const d = Math.sign(ax);
            if (d !== s.face) { s.face = d; s.vx *= SHIP.turnBrake; this.ev('turn', s.x, s.y); }
            s.vx += d * SHIP.thrust * Math.min(1, Math.abs(ax) * 1.3) * dt;
            s.thrusting = true;
        } else {
            s.vx *= Math.exp(-SHIP.drag * dt);
        }
        s.vx = clamp(s.vx, -SHIP.maxSpeed, SHIP.maxSpeed);
        s.x = wrap(s.x + s.vx * dt);
        s.vy = ay * SHIP.climb;
        s.y = clamp(s.y + s.vy * dt, FIELD.floor, FIELD.top - 6);
        s.camOff += (s.face * SHIP.lead - s.camOff) * Math.min(1, dt * 2.2);

        // laser: a tap fires as soon as the short tap gap has passed; holding auto-fires slower
        const tapOk = s.cool <= LASER.holdCooldown - LASER.tapCooldown;
        if (this.lasers.length < LASER.max && ((inp.firePressed && tapOk) || (inp.fire && s.cool <= 0))) {
            s.cool = LASER.holdCooldown;
            this.lasers.push({ ox: wrap(s.x + s.face * 9), y: s.y - 1, dir: s.face, head: 0, prev: 0, hue: this.rng(), alive: true });
            this.stats.shots++;
            this.ev('fire', s.x, s.y);
        }
        if (inp.bomb) this.smartBomb();
        if (inp.hyper && s.hyperCool <= 0) this.hyperspace();
    }

    smartBomb() {
        const S = this.session, s = this.ship;
        if (S.bombs <= 0 || !s.alive) return;
        S.bombs--;
        this.ev('bomb', s.x, s.y);
        for (const e of this.enemies) {
            if (!e.alive || !this.onScreen(e.x, 8)) continue;
            if (e.boss) { this.damage(e, 4, 'bomb'); continue; }
            if (e.kind === 'dart' && e.state === 'wait') continue;
            this.kill(e, 'bomb');
        }
        this.shots = this.shots.filter((b) => !this.onScreen(b.x, 8));
        this.freeze = Math.max(this.freeze, 0.08);
    }

    hyperspace() {
        const s = this.ship;
        const fx = s.x, fy = s.y;
        s.x = this.rng.range(0, WORLD_W);
        s.y = this.rng.range(70, 220);
        s.vx = 0;
        s.inv = Math.max(s.inv, SHIP.hyperInv);
        s.hyperCool = SHIP.hyperCooldown;
        s.camOff = s.face * SHIP.lead;
        this.camX = wrap(s.x + s.camOff);
        this.lasers.length = 0;
        this.ev('hyper', s.x, s.y, { fx, fy });
    }

    killShip(why) {
        const s = this.ship;
        if (!s.alive || s.inv > 0 || this.god || this.state !== 'play') return;
        s.alive = false;
        s.deadT = 0;
        s.thrusting = false;
        this.stats.deaths++;
        for (const c of s.carry) { c.state = 'grabbed'; this.dropColonist(c); }
        s.carry.length = 0;
        this.session.lives = Math.max(0, this.session.lives - 1);
        this.state = 'dying'; this.stateT = 0;
        this.freeze = 0.25;
        this.ev('playerDie', s.x, s.y, { why });
    }

    respawn() {
        const s = this.ship;
        s.alive = true; s.inv = SHIP.respawnInv; s.vx = 0; s.y = 150;
        this.shots.length = 0;
        // clear the area: push nearby enemies away and pop nearby mines
        for (const e of this.enemies) {
            if (!e.alive || e.boss || e.kind === 'dart') continue;
            if (Math.abs(wdx(e.x, s.x)) < 260) {
                if (e.kind === 'mine') { e.alive = false; continue; }
                if (e.kind === 'meteor') { e.y = FIELD.top + 18; continue; }
                e.x = wrap(e.x + (wdx(e.x, s.x) >= 0 ? 1 : -1) * 520);
            }
        }
        this.state = 'play'; this.stateT = 0;
        this.ev('respawn', s.x, s.y);
    }

    continueGame() {
        if (this.state !== 'gameover') return;
        const S = this.session;
        S.lives = this.diff.lives;
        S.bombs = Math.max(S.bombs, this.diff.bombs);
        S.continues++;
        this.respawn();
    }

    // ================================================================== lasers and damage
    stepLasers(dt) {
        for (const L of this.lasers) {
            L.prev = L.head;
            L.head = Math.min(LASER.range, L.head + LASER.speed * dt);
            // nearest thing the laser swept across this step
            let best = null, bd = 1e9;
            for (const e of this.enemies) {
                if (!e.alive || e.warp > 0) continue;
                const dy = Math.abs(e.y - L.y);
                if (dy > e.r + 1.5) continue;
                const along = wdx(e.x, L.ox) * L.dir;
                if (along < L.prev - e.r - 8 || along > L.head + e.r) continue;
                if (along < -12) continue;
                if (along < bd) { bd = along; best = e; }
            }
            if (best) {
                L.alive = false;
                L.hitAt = Math.max(0, bd);
                if (best.shielded) this.ev('ting', best.x, L.y);
                else this.damage(best, 1, 'laser');
                if (best.boss && best.boss.onHit) best.boss.onHit(best);
            }
            if (L.head >= LASER.range) L.alive = false;
        }
        this.lasers = this.lasers.filter((L) => L.alive);
    }

    damage(e, n, cause) {
        if (!e.alive) return;
        if (e.shielded) { this.ev('ting', e.x, e.y); return; }
        e.hp -= n;
        e.hitT = 0.12;
        if (e.boss) this.ev('bossHit', e.x, e.y, { kind: e.kind });
        if (e.hp <= 0) this.kill(e, cause);
    }

    kill(e, cause) {
        if (!e.alive) return;
        e.alive = false;
        this.stats.kills++;
        if (e.boss) {
            const keep = e.boss.partKilled(e);
            if (keep) e.alive = true;
            return;
        }
        let pts = SCORE[e.kind] || 0;
        if (e.kind === 'meteor') pts = SCORE.meteor[e.size] || 0;
        if (e.kind === 'dart') {
            pts = e.state === 'dive' ? SCORE.dartDive : SCORE.dart;
            const sq = e.sq;
            sq.killed++;
            if (sq.killed >= sq.n && !sq.lost) { this.addScore(SCORE.squadron, e.x, e.y + 14); this.ev('squadronBonus', e.x, e.y); }
        }
        if (cause !== 'collide' || e.kind !== 'mine') this.addScore(pts, e.x, e.y);
        if (e.carry) { this.dropColonist(e.carry); e.carry = null; }
        if (e.target) { e.target.hunter = null; e.target = null; }
        this.ev('explode', e.x, e.y, { kind: e.kind, size: e.kind === 'meteor' ? e.size * 0.6 : e.kind === 'hive' ? 1.4 : e.kind === 'mine' ? 0.4 : 1, seed: e.seed, cause });
        if (e.kind === 'hive') burstHive(this, e);
        if (e.kind === 'meteor') splitMeteor(this, e);
    }

    // ================================================================== spawning
    stepSpawns(dt) {
        const q = this.quota, T = this.timers, d = this.def;
        const t = this.stateT;
        for (const k in T) T[k] -= dt;
        if (q.snatcher > 0 && T.snatcher <= 0 && (this.countKind('snatcher') <= 2 || T.snatcher < -14)) {
            const n = Math.min(q.snatcher, d.batch || 4);
            for (let i = 0; i < n; i++) spawnSnatcher(this);
            q.snatcher -= n;
            T.snatcher = 3;
            this.ev('warpIn', this.ship.x, 200);
        }
        if (q.minelayer > 0 && T.minelayer <= 0) { spawnMinelayer(this); q.minelayer--; T.minelayer = 9; }
        if (q.hive > 0 && T.hive <= 0) { spawnHive(this); q.hive--; T.hive = 11; }
        if (q.squadron > 0 && T.squadron <= 0 && !this.squadrons.some((sq) => !sq.done)) {
            spawnSquadron(this); q.squadron--; T.squadron = 6;
        }
        if (q.meteor > 0 && T.meteor <= 0) { spawnMeteor(this, 3); q.meteor--; T.meteor = this.rng.range(1.6, 3.2) / Math.min(1.6, this.aggr); }
        if (t > this.hunterAt && T.hunter <= 0) {
            T.hunter = Math.max(7, 16 - this.loop * 3);
            if (this.countKind('hunter') < 3) { spawnHunter(this); this.ev('hunter', this.ship.x, this.ship.y); }
        }
        for (const sq of this.squadrons) {
            if (sq.done) continue;
            if (!this.enemies.some((e) => e.alive && e.sq === sq)) sq.done = true;
            else stepSquadron(this, sq, dt);
        }
    }

    // ================================================================== step
    step(dt, inp = {}) {
        this.time += dt;
        if (this.freeze > 0) { this.freeze -= dt; return; }
        this.stateT += dt;
        const s = this.ship;

        if (this.state === 'intro') {
            this.stepShip(dt, { ...inp, firePressed: false, fire: false, bomb: false, hyper: false });
            this.stepColonists(dt);
            if (this.stateT > (this.def.boss ? 2.6 : 1.8)) {
                this.state = 'play'; this.stateT = 0;
                if (this.def.boss) { this.boss = new BOSSES[this.def.boss](this); this.ev('bossEnter', this.boss.x, this.boss.y, { name: this.boss.name }); }
            }
            this.updateCamera();
            return;
        }
        if (this.state === 'gameover' || this.state === 'done') { this.updateCamera(); return; }

        if (this.state === 'play') {
            this.stepShip(dt, inp);
            this.stepSpawns(dt);
        } else if (this.state === 'dying') {
            s.deadT += dt;
            if (s.deadT > 2.6) {
                if (this.session.lives <= 0) { this.state = 'gameover'; this.stateT = 0; this.ev('gameOver'); }
                else this.respawn();
            }
        }
        if (this.boss && !this.boss.dead) this.boss.step(dt);
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (e.alive && !e.boss) stepEnemy(this, e, dt);
            if (e.hitT) e.hitT = Math.max(0, e.hitT - dt);
        }
        this.stepLasers(dt);
        this.stepShots(dt);
        this.stepColonists(dt);
        this.collideShip();
        this.enemies = this.enemies.filter((e) => e.alive);

        if (this.state === 'play' && this.quotaLeft() === 0 && this.aliveMain() === 0 && (!this.def.boss || (this.boss && this.boss.dead))) {
            this.waveClear();
        }
        if (this.state === 'tally') {
            this.stepShip(dt, { ...inp, firePressed: false, fire: false, bomb: false, hyper: false });
            if (this.stateT > this.tally.dur) { this.state = 'done'; this.ev('waveDone'); }
        }
        this.updateCamera();
    }

    updateCamera() {
        const s = this.ship;
        this.camX = wrap(s.x + s.camOff);
    }

    stepShots(dt) {
        const s = this.ship;
        for (const b of this.shots) {
            b.x = wrap(b.x + b.vx * dt);
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.y < FIELD.ground - 4 || b.y > FIELD.top + 8) b.life = 0;
            if (s.alive && b.life > 0 && Math.abs(wdx(b.x, s.x)) < SHIP.r + 1 && Math.abs(b.y - s.y) < 4.5) {
                b.life = 0;
                this.killShip('shot');
            }
        }
        this.shots = this.shots.filter((b) => b.life > 0);
    }

    collideShip() {
        const s = this.ship;
        if (!s.alive) return;
        for (const e of this.enemies) {
            if (!e.alive || e.warp > 0) continue;
            if (e.kind === 'dart' && e.state === 'wait') continue;
            const dx = Math.abs(wdx(e.x, s.x)), dy = Math.abs(e.y - s.y);
            if (dx < e.r + SHIP.r && dy < e.r + 3.5) {
                if (s.inv > 0 || this.god) continue;
                if (!e.boss) this.kill(e, 'collide');
                this.killShip('collide');
                return;
            }
        }
    }

    waveClear() {
        const S = this.session;
        this.state = 'tally'; this.stateT = 0;
        for (const e of this.enemies) if (e.alive && (e.kind === 'mine' || e.kind === 'hunter')) { e.alive = false; this.ev('explode', e.x, e.y, { kind: e.kind, size: 0.6, quiet: true }); }
        this.shots.length = 0;
        // colonists still in the ship are set down for free
        for (const c of this.ship.carry) { c.state = 'walk'; c.y = FIELD.ground; }
        this.ship.carry.length = 0;
        const alive = this.planetAlive ? this.colonists.filter((c) => c.state !== 'dead').length : 0;
        const per = 100 * Math.min(5, (S.wave % WAVE_COUNT) + 1);
        const bonus = alive * per;
        this.addScore(bonus);
        this.tally = { alive, per, bonus, dur: 3.2 + alive * 0.18, boss: this.def.boss || null };
        this.ev('waveClear', this.ship.x, this.ship.y, { wave: S.wave, bonus, alive });
    }
}
