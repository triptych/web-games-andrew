// The game simulation: one stage of BRICKVADERS. Pure JS — no three.js, no DOM —
// so the bot can play it headlessly in Node. Everything visible or audible leaves
// through `this.events` ({ type, t, ... }); the view and audio consume them.
//
// Coordinates are low-res pixels, y up, origin bottom-left. Entities that the ball and
// lasers can hit (invaders, formation bricks, flyers, the mystery ship) all carry an
// axis-aligned box { x, y, w, h } with (x, y) the bottom-left corner.

import { W, FIELD, PADDLE, BALL, SLOT, FORMATION_TOP, MARCH_DROP, LASER, POWER_TIME, CAPSULE_KINDS, CAPSULE_WEIGHTS, EXTRA_LIFE_AT, EXTRA_LIFE_EVERY, DIFFICULTY, MAX_BOMBS, MAX_BALLS } from '../config.js';
import { makeRng } from '../rng.js';
import { INVADERS, INVADER_INFO, SHIELD_SHAPE, CAPSULE_W, CAPSULE_H, UFO, ROW_COLORS } from '../art/sprites.js';
import { Grid } from './grid.js';
import { STAGES, SECTORS, INVADER_CHARS, CHALLENGES, PATHS, pathPoint } from './levels.js';
import { BOSSES, buildBossGrid, CELL_CODE } from './bosses.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BRICK_INFO = {
    '#': { hp: 1, pts: 10 }, '=': { hp: 3, pts: 50 }, 'G': { hp: 1, pts: 100, gold: true },
    'X': { hp: 1, pts: 30, tnt: true }, '?': { hp: 1, pts: 50, prize: true },
};
const _p = { x: 0, y: 0 };

/** Fresh session (the part of the game that survives between stages). */
export function newSession(difficulty = 'arcade', stage = 0) {
    const d = DIFFICULTY[difficulty] || DIFFICULTY.arcade;
    return {
        difficulty, score: 0, lives: d.lives, bombs: 1, loop: 0, stage,
        nextLife: EXTRA_LIFE_AT[0], shots: 0, continues: 0, kills: 0, maxChain: 0,
    };
}

export function nextLifeAfter(score) {
    for (const s of EXTRA_LIFE_AT) if (score < s) return s;
    const last = EXTRA_LIFE_AT[EXTRA_LIFE_AT.length - 1];
    return last + Math.ceil((score + 1 - last) / EXTRA_LIFE_EVERY) * EXTRA_LIFE_EVERY;
}

export class World {
    constructor(session, opts = {}) {
        this.session = session;
        this.diff = DIFFICULTY[session.difficulty] || DIFFICULTY.arcade;
        this.rng = makeRng(opts.seed ?? 12345);
        this.demo = !!opts.demo;
        this.god = !!opts.god;
        this.events = [];
        this.time = 0;
        this.nextId = 1;
        this.beatT = 0; this.beatIndex = 0;
        this.startStage(session.stage);
    }

    // ================================================================== setup
    get loop() { return this.session.loop; }

    startStage(index) {
        const stage = STAGES[index];
        this.stageIndex = index;
        this.stage = stage;
        this.sector = SECTORS[stage.sector];
        this.paddle = { x: W / 2, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h, vx: 0, invuln: 0, alive: true };
        this.balls = []; this.shots = []; this.bullets = []; this.slots = []; this.free = [];
        this.grids = []; this.capsules = []; this.beams = []; this.pendingTnt = []; this.queue = [];
        this.ufo = null; this.boss = null; this.challenge = null; this.form = null;
        this.power = { L: 0, E: 0, C: 0, F: 0 };
        this.barrier = this.diff.startBarrier;
        this.chain = 0; this.mult = 1;
        this.stageTime = 0; this.stageMisses = 0;
        this.bricksTotal = 0; this.bricksBroken = 0;
        this.shotCooldown = 0; this.fireT = 1.5; this.diveT = 4; this.captorT = 7;
        this.ufoT = this.rng.range(14, 22);
        this.state = 'intro'; this.stateT = 0;
        this.tally = null; this.freeze = 0;
        this.stuckWait = 0;
        const loopMul = 1 + this.loop * 0.12;
        this.ballBase = (BALL.baseSpeed + index * BALL.stageSpeedUp) * this.diff.ballSpeed * loopMul;

        if (stage.type === 'wave') this.buildFormation(stage.rows);
        if (stage.type === 'boss') this.buildBoss(stage.boss);
        if (stage.type === 'challenge') this.buildChallenge(stage.challenge);
        if (this.sector.shields && stage.type !== 'challenge') this.buildShields();
        if (this.sector.asteroids && stage.type === 'wave') this.buildAsteroids();
        this.balls.push(this.newBall());
        this.emit('stageStart', { index, label: stage.label, name: stage.name, sector: stage.sector, type: stage.type });
    }

    buildFormation(rows) {
        const cols = Math.max(...rows.map((r) => r.length));
        const ox = Math.round((W - cols * SLOT.w) / 2 / 2) * 2;
        this.form = { ox, oy: FORMATION_TOP - Math.min(this.loop, 2) * 8, dir: 1, cols, rows: rows.length, total: 0, step: 0, frame: 0 };
        rows.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
                const ch = row[c];
                if (ch === '.') continue;
                this.addSlot(c, r, ch);
            }
        });
        this.form.total = this.slots.filter((s) => s.inv).length;
        this.placeSlots();
    }

    addSlot(col, row, ch) {
        const kind = INVADER_CHARS[ch];
        let s;
        if (kind) {
            const spr = INVADERS[kind], info = INVADER_INFO[kind];
            const hp = info.hp + (this.loop > 0 && info.hp === 1 && kind !== 'mini' ? 1 : 0);
            s = { id: this.nextId++, cat: 'slot', inv: true, kind, col, row, hp, maxHp: hp, w: spr.w, h: spr.h, x: 0, y: 0, state: 'form', alive: true, flash: 0, held: [], buildT: this.rng.range(4, 8), builds: 0, dv: null };
        } else {
            const info = BRICK_INFO[ch];
            const hp = info.hp + (this.loop > 0 && ch === '#' ? 1 : 0);
            s = { id: this.nextId++, cat: 'slot', inv: false, kind: 'brick', btype: ch, col, row, hp, maxHp: hp, w: 15, h: 11, x: 0, y: 0, state: 'form', alive: true, flash: 0, color: ROW_COLORS[row % ROW_COLORS.length] };
            if (!info.gold) this.bricksTotal++;
        }
        this.slots.push(s);
        return s;
    }

    slotHome(s, out) {
        const f = this.form;
        const X = f.ox + s.col * SLOT.w, top = f.oy - s.row * SLOT.h;
        if (s.inv) { out.x = X + Math.floor((SLOT.w - s.w) / 2); out.y = top - SLOT.h + Math.floor((SLOT.h - s.h) / 2); }
        else { out.x = X + 0.5; out.y = top - SLOT.h + 0.5; }
        return out;
    }

    placeSlots() {
        for (const s of this.slots) {
            if (!s.alive || s.state !== 'form') continue;
            this.slotHome(s, _p); s.x = _p.x; s.y = _p.y;
        }
    }

    buildShields() {
        const types = [null, { hp: 1, color: this.sector.shieldColor }];
        for (let i = 0; i < 4; i++) {
            const cx = 30 + i * 60;
            const g = new Grid({ kind: 'shield', id: i, x: cx - 11, y: 44, cols: 22, rows: 16, cw: 1, ch: 1, types });
            g.fill(SHIELD_SHAPE, (c) => (c === 'X' ? 1 : 0));
            this.grids.push(g);
        }
    }

    buildAsteroids() {
        this.rockSpawnT = [];
        this.spawnRock(-10, 118, 13);
        this.spawnRock(150, 118, 13);
        this.spawnRock(60, 168, -10);
    }

    spawnRock(x, y, vx) {
        const R = 4.6 + this.rng() * 1.6;
        const n = 11;
        const rows = [];
        for (let r = 0; r < n; r++) {
            let row = '';
            for (let c = 0; c < n; c++) {
                const dx = c - (n - 1) / 2, dy = r - (n - 1) / 2;
                const d = Math.hypot(dx, dy * 1.15) + this.rng() * 0.9;
                row += d < R * 0.55 ? 'h' : d < R ? 'a' : '.';
            }
            rows.push(row);
        }
        const types = [null, { hp: 1, color: 0x9a7a5a }, { hp: 2, color: 0x6a5a48 }];
        const g = new Grid({ kind: 'rock', id: this.nextId++, x, y, cols: n, rows: n, cw: 2, ch: 2, types, vx });
        g.fill(rows, (c) => (c === 'a' ? 1 : c === 'h' ? 2 : 0));
        g.fx = x;
        this.grids.push(g);
    }

    buildBoss(id) {
        const def = BOSSES[id];
        const grid = buildBossGrid(id);
        this.grids.push(grid);
        let coreHp = 0;
        for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] && grid.types[grid.cells[i]].core) coreHp += grid.hp[i];
        // Rockjaw: the bottom row of jaw cells opens and shuts.
        let jawCells = [];
        if (def.jaw) {
            let lowest = Infinity;
            for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] === CELL_CODE.j) lowest = Math.min(lowest, Math.floor(i / grid.cols));
            for (let c = 0; c < grid.cols; c++) {
                const i = lowest * grid.cols + c;
                if (grid.cells[i] === CELL_CODE.j && c > 8 && c < grid.cols - 9) jawCells.push(i);
            }
        }
        this.boss = {
            id, def, grid, t: 0, phase: 0, coreHp, coreMax: coreHp, attackT: 2.4, lastAttack: '',
            baseX: grid.x, baseY: grid.y, regenT: def.regen.every, dashOff: 0, dashTarget: 0, dashT: 0,
            spiralT: 0, spiralA: 0, spiralCd: 0, jawCells, jawOpen: false, jawT: def.jaw ? def.jaw.shut : 0, dead: false, dieT: 0,
            holder: { x: grid.x + grid.w / 2 - 2, y: grid.y - 2, w: 4, h: 4, held: [] }, broken: 0,
        };
        this.emit('bossIntro', { id, name: def.name, title: def.title });
    }

    buildChallenge(n) {
        const groups = CHALLENGES[n % CHALLENGES.length];
        this.challenge = { groups, gi: 0, member: 0, nextT: 1.2, hits: 0, total: groups.length * 8, escaped: 0 };
        this.power.L = 999;
    }

    newBall() {
        const p = this.paddle;
        return {
            id: this.nextId++, x: p.x, y: p.y + p.h + BALL.r + 0.5, vx: 0, vy: 0, speed: this.ballBase,
            stuck: true, stuckDx: 0, stuckT: 0, captured: null, lastTouch: this.time, dead: false, pierce: new Map(),
        };
    }

    // ================================================================== events / scoring
    emit(type, data = {}) {
        data.type = type; data.t = this.time;
        this.events.push(data);
        return data;
    }

    addScore(pts, x, y, popup = true) {
        if (pts <= 0) return;
        const S = this.session;
        S.score += pts;
        if (popup) this.emit('score', { pts, x, y });
        while (S.score >= S.nextLife) {
            S.lives++;
            this.emit('extraLife', {});
            S.nextLife = nextLifeAfter(S.nextLife);
        }
    }

    bumpChain(x, y) {
        this.chain++;
        if (this.chain > this.session.maxChain) this.session.maxChain = this.chain;
        const m = Math.min(5, 1 + Math.floor(this.chain / 5));
        if (m > this.mult) { this.mult = m; this.emit('chain', { mult: m, x, y }); }
    }

    // ================================================================== beat clock
    beatInterval() {
        const st = this.stage;
        if (st.type === 'boss') return this.boss && this.boss.phase > 0 ? 0.13 : 0.15;
        if (st.type === 'challenge') return 0.14;
        if (!this.form) return 0.15;
        const alive = this.aliveInvaders(true);
        const f = this.form.total ? alive / this.form.total : 0;
        const speed = this.diff.march * (1 + this.stageIndex * 0.025 + this.loop * 0.15);
        return Math.max(0.075, (0.085 + 0.22 * Math.pow(f, 0.85)) / speed);
    }

    aliveInvaders(formationOnly = false) {
        let n = 0;
        for (const s of this.slots) if (s.alive && s.inv) n++;
        if (!formationOnly) for (const e of this.free) if (e.alive) n++;
        return n;
    }

    // ================================================================== main step
    step(dt, input) {
        this.time += dt;
        this.stateT += dt;
        this.beatT += dt;
        const interval = this.beatInterval();
        if (this.beatT >= interval) {
            this.beatT -= interval;
            if (this.beatT > interval) this.beatT = 0;
            this.beatIndex++;
            const marching = this.state === 'play' && this.form && this.freeze <= 0;
            this.emit('beat', { i: this.beatIndex, interval, song: this.songId(), march: !!marching });
            if (marching) this.marchStep();
        }

        if (this.state === 'intro') {
            this.updatePaddle(dt, input);
            this.updateBalls(dt, input);
            if (this.stateT > 2.1) { this.state = 'play'; this.stateT = 0; this.emit('go', {}); }
            return;
        }
        if (this.state === 'play') {
            if (this.freeze > 0) { this.freeze -= dt; return; }
            this.stageTime += dt;
            this.updatePlay(dt, input);
            return;
        }
        if (this.state === 'dying') {
            this.updateFx(dt);
            if (this.stateT > 1.9) this.afterDeath();
            return;
        }
        if (this.state === 'clearing') {
            this.updatePaddle(dt, input);
            this.updateFx(dt);
            this.updateClearing(dt);
            return;
        }
        if (this.state === 'bossdying') {
            this.updatePaddle(dt, input);
            this.updateBossDeath(dt);
            return;
        }
        if (this.state === 'tally') {
            this.updatePaddle(dt, input);
            if (this.stateT > 5 || (this.stateT > 1.6 && input && input.firePressed)) { this.state = 'done'; this.emit('stageDone', {}); }
        }
    }

    songId() {
        if (this.stage.type === 'boss') return this.stage.boss === 'overmind' ? 'final' : 'boss';
        if (this.stage.type === 'challenge') return 'challenge';
        return 'sector' + this.stage.sector;
    }

    updatePlay(dt, input) {
        const p = this.paddle;
        if (p.invuln > 0) p.invuln -= dt;
        for (const k of ['L', 'E', 'C', 'F']) if (this.power[k] > 0) { this.power[k] -= dt; if (this.power[k] <= 0) { this.power[k] = 0; this.emit('powerEnd', { kind: k }); } }

        this.updatePaddle(dt, input);
        this.handleFire(dt, input);
        this.updateQueue(dt);
        this.updateBalls(dt, input);
        if (this.state !== 'play') return;
        this.updateShots(dt);
        this.updateFormation(dt);
        this.updateFree(dt);
        this.updateGrids(dt);
        if (this.boss) this.updateBoss(dt);
        if (this.challenge) this.updateChallenge(dt);
        this.updateUfo(dt);
        this.updateBullets(dt);
        this.updateBeams(dt);
        this.updateCapsules(dt);
        this.updateTnt(dt);
        if (this.state === 'play') this.checkClear();
    }

    updateFx(dt) { this.updateTnt(dt); }

    // ================================================================== paddle & fire
    updatePaddle(dt, input) {
        const p = this.paddle;
        const tw = this.power.E > 0 ? PADDLE.wWide : PADDLE.w;
        if (p.w !== tw) p.w += clamp(tw - p.w, -50 * dt, 50 * dt);
        const prev = p.x;
        if (input) {
            if (input.targetX != null) {
                const d = input.targetX - p.x, m = PADDLE.maxSpeed * dt;
                p.x += clamp(d, -m, m);
                p.vx = 0;
            } else if (input.dx) {
                p.x += clamp(input.dx, -PADDLE.maxSpeed * dt * 1.5, PADDLE.maxSpeed * dt * 1.5);
                p.vx = 0;
            }
            if (input.axis) {
                p.vx = clamp(p.vx + input.axis * PADDLE.keyAccel * dt, -PADDLE.keySpeed, PADDLE.keySpeed);
                if (Math.sign(p.vx) !== Math.sign(input.axis)) p.vx = input.axis * 40;
            } else {
                p.vx *= Math.max(0, 1 - 18 * dt);
            }
            p.x += p.vx * dt;
        }
        const half = p.w / 2;
        p.x = clamp(p.x, half + 1, W - half - 1);
        if ((p.x <= half + 1 && p.vx < 0) || (p.x >= W - half - 1 && p.vx > 0)) p.vx = 0;
        p.moved = (p.x - prev) / Math.max(dt, 1e-6);
    }

    handleFire(dt, input) {
        if (this.shotCooldown > 0) this.shotCooldown -= dt;
        if (!input) return;
        if (input.bomb) this.nova();
        const stuck = this.balls.find((b) => b.stuck);
        if (stuck && input.firePressed) { this.launchBalls(); return; }
        if (!input.fire && !input.firePressed) return;
        const p = this.paddle;
        const rapid = this.power.L > 0;
        if (rapid) {
            if (this.shotCooldown > 0 || this.shots.length >= LASER.maxRapid) return;
            const off = p.w / 2 - 1.5;
            this.shots.push({ x: p.x - off, y: p.y + p.h + 1, vy: LASER.rapidSpeed });
            this.shots.push({ x: p.x + off, y: p.y + p.h + 1, vy: LASER.rapidSpeed });
            this.shotCooldown = LASER.rapidCooldown;
            this.session.shots++;
            this.emit('laser', { x: p.x, y: p.y + p.h, rapid: true });
        } else {
            if (this.shots.length >= LASER.maxSingle || this.shotCooldown > 0) return;
            this.shots.push({ x: p.x, y: p.y + p.h + 1, vy: LASER.speed });
            this.shotCooldown = 0.12;
            this.session.shots++;
            this.emit('laser', { x: p.x, y: p.y + p.h, rapid: false });
        }
    }

    launchBalls() {
        for (const b of this.balls) {
            if (!b.stuck) continue;
            b.stuck = false;
            const off = clamp(b.stuckDx / (this.paddle.w / 2), -1, 1);
            const a = off * 0.9 + (this.rng() - 0.5) * 0.25;
            b.vx = Math.sin(a) * b.speed; b.vy = Math.cos(a) * b.speed;
            b.lastTouch = this.time;
            this.emit('launch', { x: b.x, y: b.y });
        }
        this.stuckWait = 0;
    }

    // ================================================================== balls
    updateBalls(dt, input) {
        const p = this.paddle;
        let anyStuck = false;
        for (const b of this.balls) {
            if (b.stuck) {
                anyStuck = true;
                b.x = clamp(p.x + b.stuckDx, 2, W - 2);
                b.y = p.y + p.h + BALL.r + 0.5;
                b.stuckT += dt;
                if (this.state === 'play' && this.power.C > 0 && b.stuckT > BALL.stickRelease && b.caught) this.launchBalls();
                continue;
            }
            if (b.captured) {
                const c = b.captured;
                b.x = c.x + c.w / 2 + (b.capOff || 0);
                b.y = c.y - 4;
                continue;
            }
            if (this.state !== 'play') continue;
            this.stepBall(b, dt);
        }
        if (anyStuck && this.state === 'play') {
            this.stuckWait += dt;
            if (this.stuckWait > (this.challenge ? 1.2 : 6)) this.launchBalls();
        }
        if (this.state !== 'play') return;
        let removed = false;
        for (let i = this.balls.length - 1; i >= 0; i--) if (this.balls[i].dead) { this.balls.splice(i, 1); removed = true; }
        if (removed && !this.balls.some((b) => !b.captured)) {
            if (this.challenge || this.god) {
                this.balls.push(this.newBall());
                if (!this.challenge) this.emit('ballSaved', {});
            } else this.loseLife('ball');
        }
    }

    stepBall(b, dt) {
        const r = BALL.r;
        const fire = this.power.F > 0;
        if (this.time - b.lastTouch > BALL.nudgeAfter) {
            b.lastTouch = this.time;
            this.rotateBall(b, (this.rng() < 0.5 ? -1 : 1) * 0.3);
        }
        if (!fire) this.unstick(b);
        const n = Math.max(1, Math.ceil(b.speed * dt / 0.9));
        const sdt = dt / n;
        for (let k = 0; k < n; k++) {
            const ox = b.x;
            b.x += b.vx * sdt;
            if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); this.emit('wall', { x: b.x, y: b.y }); }
            else if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx); this.emit('wall', { x: b.x, y: b.y }); }
            if (this.ballCollide(b, 0, fire)) b.x = ox;
            const oy = b.y;
            b.y += b.vy * sdt;
            if (b.y > FIELD.top - r) { b.y = FIELD.top - r; b.vy = -Math.abs(b.vy); this.emit('wall', { x: b.x, y: b.y }); }
            if (this.ballCollide(b, 1, fire)) b.y = oy;
            if (b.captured || b.dead) return;
            if (b.vy < 0 && this.paddleBounce(b)) { if (b.stuck) return; }
            if (b.y < FIELD.ground - 3) {
                if (this.barrier > 0) {
                    this.barrier--;
                    b.y = FIELD.ground - 3; b.vy = Math.abs(b.vy);
                    this.emit('barrier', { x: b.x, left: this.barrier });
                } else {
                    b.dead = true;
                    this.emit('ballLost', { x: b.x });
                    return;
                }
            }
        }
    }

    rotateBall(b, a) {
        const c = Math.cos(a), s = Math.sin(a);
        const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
        b.vx = vx; b.vy = vy;
        this.fixAngle(b);
    }

    fixAngle(b) {
        const s = b.speed;
        const len = Math.hypot(b.vx, b.vy) || 1;
        b.vx *= s / len; b.vy *= s / len;
        const minVy = s * BALL.minVy;
        if (Math.abs(b.vy) < minVy) {
            b.vy = (b.vy < 0 ? -1 : 1) * minVy;
            b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, s * s - minVy * minVy));
        }
    }

    /** If something moved onto the ball, push it out the short way. */
    unstick(b) {
        const r = BALL.r;
        for (const e of this.targetList()) {
            if (!this.solidFor(e)) continue;
            if (b.x + r <= e.x || b.x - r >= e.x + e.w || b.y + r <= e.y || b.y - r >= e.y + e.h) continue;
            const pl = b.x + r - e.x, pr = e.x + e.w - (b.x - r), pd = b.y + r - e.y, pu = e.y + e.h - (b.y - r);
            const m = Math.min(pl, pr, pd, pu);
            if (m === pd) { b.y = e.y - r - 0.01; b.vy = -Math.abs(b.vy); }
            else if (m === pu) { b.y = e.y + e.h + r + 0.01; b.vy = Math.abs(b.vy); }
            else if (m === pl) { b.x = e.x - r - 0.01; b.vx = -Math.abs(b.vx); }
            else { b.x = e.x + e.w + r + 0.01; b.vx = Math.abs(b.vx); }
            this.fixAngle(b);
        }
    }

    solidFor(e) { return e.alive && !(e.cat === 'free' && e.ghost); }

    /** Everything the ball and lasers can hit, as boxes. Rebuilt on demand each step. */
    targetList() {
        if (this._tlTime === this.time) return this._tl;
        const tl = this._tl || (this._tl = []);
        tl.length = 0;
        for (const s of this.slots) if (s.alive) tl.push(s);
        for (const e of this.free) if (e.alive) tl.push(e);
        if (this.ufo && this.ufo.alive) tl.push(this.ufo);
        this._tlTime = this.time;
        return tl;
    }

    /** Move-then-test collision on one axis (0 = x, 1 = y). Returns true if the ball reflected. */
    ballCollide(b, axis, fire) {
        const r = BALL.r;
        const x0 = b.x - r, x1 = b.x + r, y0 = b.y - r, y1 = b.y + r;
        for (const e of this.targetList()) {
            if (!e.alive || x1 <= e.x || x0 >= e.x + e.w || y1 <= e.y || y0 >= e.y + e.h) continue;
            if (fire) {
                const last = b.pierce.get(e.id);
                if (last !== undefined && this.time - last < 0.25) continue;
                b.pierce.set(e.id, this.time);
                this.hitEntity(e, 2, 'fire', b);
                continue;
            }
            if (axis === 0) b.vx = -b.vx; else b.vy = -b.vy;
            this.fixAngle(b);
            this.hitEntity(e, 1, 'ball', b);
            return true;
        }
        for (const g of this.grids) {
            const i = g.hitBox(x0, y0, x1, y1, b.x, b.y);
            if (i < 0) continue;
            const t = g.types[g.cells[i]];
            if (fire && !t.steel && !t.core) {
                this.hitCell(g, i, 3, 'fire', true);
                if (g.kind === 'shield') this.crater(g, b.x, b.y, 2.2);
                continue;
            }
            if (axis === 0) b.vx = -b.vx; else b.vy = -b.vy;
            this.fixAngle(b);
            this.hitCell(g, i, fire ? 2 : 1, fire ? 'fire' : 'ball', false);
            if (g.kind === 'shield') this.crater(g, b.x, b.y, 1.8);
            return true;
        }
        for (const bl of this.bullets) {
            if (bl.dead) continue;
            if (Math.abs(bl.x - b.x) < bl.w / 2 + r && Math.abs(bl.y - b.y) < bl.h / 2 + r) {
                bl.dead = true;
                this.emit('swat', { x: bl.x, y: bl.y, kind: bl.kind });
                this.addScore(5, bl.x, bl.y, false);
            }
        }
        return false;
    }

    paddleBounce(b) {
        const p = this.paddle;
        const top = p.y + p.h;
        if (b.y - BALL.r > top || b.y - BALL.r < top - 4) return false;
        const half = p.w / 2 + BALL.r;
        if (Math.abs(b.x - p.x) > half) return false;
        b.y = top + BALL.r;
        const off = clamp((b.x - p.x) / half, -1, 1);
        b.speed = Math.min(this.ballBase * BALL.maxMul, b.speed + BALL.hitSpeedUp);
        const a = off * (Math.PI / 3);
        b.vx = Math.sin(a) * b.speed; b.vy = Math.cos(a) * b.speed;
        b.lastTouch = this.time;
        this.chain = 0; this.mult = 1;
        this.emit('paddle', { x: b.x, y: b.y, off });
        if (this.power.C > 0 && this.state === 'play') {
            b.stuck = true; b.caught = true; b.stuckDx = b.x - p.x; b.stuckT = 0;
            this.emit('catch', { x: b.x });
        }
        return true;
    }

    // ================================================================== shots
    updateShots(dt) {
        for (const s of this.shots) {
            s.y += s.vy * dt;
            if (s.y > FIELD.top + 4) { s.dead = true; continue; }
            const x0 = s.x - 0.5, x1 = s.x + 0.5, y0 = s.y, y1 = s.y + 5;
            let hit = false;
            for (const e of this.targetList()) {
                if (!e.alive || x1 <= e.x || x0 >= e.x + e.w || y1 <= e.y || y0 >= e.y + e.h) continue;
                if (e.kind === 'mirror' && e.inv !== false && e.cat !== 'ufo') {
                    this.fireBullet(s.x, e.y - 1, 0, -LASER.speed * 0.45, 'zig', true);
                    this.emit('reflect', { x: s.x, y: e.y });
                } else this.hitEntity(e, 1, 'shot', null);
                hit = true; break;
            }
            if (!hit) {
                for (const g of this.grids) {
                    const i = g.hitBox(x0, y0, x1, y1, s.x, s.y + 2);
                    if (i < 0) continue;
                    this.hitCell(g, i, 1, 'shot', false);
                    if (g.kind === 'shield') this.crater(g, s.x, s.y + 4, 2.4);
                    hit = true; break;
                }
            }
            if (!hit) {
                for (const bl of this.bullets) {
                    if (bl.dead || Math.abs(bl.x - s.x) > bl.w / 2 + 0.5 || s.y + 5 < bl.y - bl.h / 2 || s.y > bl.y + bl.h / 2) continue;
                    if (bl.kind === 'bomb' || bl.kind === 'rock' || this.rng() < 0.35) {
                        bl.dead = true; hit = true;
                        this.emit('swat', { x: bl.x, y: bl.y, kind: bl.kind });
                        this.addScore(bl.kind === 'bomb' ? 25 : 10, bl.x, bl.y, bl.kind === 'bomb');
                        break;
                    }
                }
            }
            if (hit) s.dead = true;
        }
        this.shots = this.shots.filter((s) => !s.dead);
    }

    // ================================================================== hits
    hitEntity(e, dmg, src, ball) {
        if (!e.alive) return;
        const viaBall = src === 'ball' || src === 'fire';
        if (viaBall) this.bumpChain(e.x + e.w / 2, e.y + e.h / 2);
        if (e.cat === 'ufo') return this.killUfo(src);
        if (!e.inv) return this.hitBrick(e, dmg, src);
        return this.hitInvader(e, dmg, src);
    }

    hitInvader(e, dmg, src) {
        e.hp -= dmg;
        e.flash = 0.12;
        if (e.hp > 0) {
            this.emit('hit', { id: e.id, kind: e.kind, x: e.x, y: e.y, w: e.w, h: e.h, frac: e.hp / e.maxHp, src });
            return;
        }
        this.killInvader(e, src);
    }

    killInvader(e, src) {
        e.alive = false;
        const info = INVADER_INFO[e.kind];
        let pts = info.pts;
        if (e.state === 'dive' || e.state === 'capdive' || e.state === 'beam') pts *= 2;
        if (e.kind === 'captor' && e.held && e.held.length) pts = 400;
        if (this.challenge && e.chal) { pts = 100; this.challenge.hits++; }
        const viaBall = src === 'ball' || src === 'fire';
        const total = pts * (viaBall ? this.mult : 1) * (1 + this.loop);
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        this.addScore(total, cx, cy);
        this.session.kills++;
        this.emit('kill', { id: e.id, kind: e.kind, x: e.x, y: e.y, w: e.w, h: e.h, src, frame: this.form ? this.form.frame : 0, big: e.maxHp > 2 });
        if (e.kind === 'splitter') {
            for (const sgn of [-1, 1]) this.spawnMini(cx - 3 + sgn * 4, e.y + 1, sgn * this.rng.range(28, 40));
        }
        if (e.kind === 'captor') this.releaseHeld(e);
        if (!this.challenge) {
            const p = e.kind === 'gloop' || e.kind === 'buzz' || e.kind === 'peeper' || e.kind === 'mini' ? 0.06 : 0.12;
            if (this.rng() < p) this.spawnCapsule(cx, cy);
        }
        if (e.maxHp >= 3) this.freeze = Math.max(this.freeze, 0.05);
    }

    hitBrick(s, dmg, src) {
        const info = BRICK_INFO[s.btype];
        const forced = src === 'fire' || src === 'nova' || src === 'clear';
        if (info.gold && !forced) {
            s.flash = 0.1;
            this.emit('clank', { x: s.x + s.w / 2, y: s.y + s.h / 2 });
            return;
        }
        s.hp -= dmg;
        s.flash = 0.1;
        if (s.hp > 0) {
            this.emit('crack', { id: s.id, x: s.x + s.w / 2, y: s.y + s.h / 2, btype: s.btype, frac: s.hp / s.maxHp });
            return;
        }
        s.alive = false;
        if (!info.gold && src !== 'clear') this.bricksBroken++;
        const viaBall = src === 'ball' || src === 'fire';
        if (src !== 'clear') this.addScore(info.pts * (viaBall ? this.mult : 1) * (1 + this.loop), s.x + s.w / 2, s.y + s.h / 2, info.pts >= 30);
        this.emit('brick', { id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, btype: s.btype, color: s.color, chain: this.chain, src });
        if (info.tnt) this.pendingTnt.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, col: s.col, row: s.row, t: 0.09 });
        if (src === 'clear') return;
        if (info.prize) this.spawnCapsule(s.x + s.w / 2, s.y + s.h / 2, null, true);
        else if (this.rng() < 0.05) this.spawnCapsule(s.x + s.w / 2, s.y + s.h / 2);
    }

    updateTnt(dt) {
        for (const t of this.pendingTnt) {
            t.t -= dt;
            if (t.t > 0) continue;
            t.done = true;
            this.emit('tnt', { x: t.x, y: t.y });
            this.freeze = Math.max(this.freeze, 0.04);
            for (const e of this.targetList()) {
                if (!e.alive) continue;
                const dx = e.x + e.w / 2 - t.x, dy = e.y + e.h / 2 - t.y;
                if (Math.abs(dx) < 24 && Math.abs(dy) < 18) this.hitEntity(e, 2, 'tnt', null);
            }
            for (const g of this.grids) if (g.kind !== 'boss') this.crater(g, t.x, t.y, 10);
        }
        this.pendingTnt = this.pendingTnt.filter((t) => !t.done);
    }

    hitCell(g, i, dmg, src, force) {
        const code = g.cells[i];
        if (!code) return;
        const t = g.types[code];
        const before = g.hp[i];
        const res = g.damage(i, dmg, force);
        g.cellCenter(i, _p);
        const viaBall = src === 'ball' || src === 'fire';
        if (res === 'blocked') { this.emit('clank', { x: _p.x, y: _p.y }); return; }
        if (viaBall && g.kind !== 'shield') this.bumpChain(_p.x, _p.y);
        const after = g.cells[i] ? g.hp[i] : 0;
        if (res === 'destroyed') {
            this.emit('cell', { x: _p.x, y: _p.y, s: g.cw, color: t.color, kind: g.kind, glow: t.glow || 0, src });
            if (g.kind === 'rock') this.addScore(5, _p.x, _p.y, false);
            if (g.kind === 'boss' && this.boss && !this.boss.dead) {
                if (t.gun) { this.addScore(500, _p.x, _p.y); this.emit('gunDown', { x: _p.x, y: _p.y }); this.spawnCapsule(_p.x, _p.y, null, true); }
                else if (!t.core) this.addScore(10 * (viaBall ? this.mult : 1), _p.x, _p.y, false);
                if (++this.boss.broken % 22 === 0) this.spawnCapsule(_p.x, _p.y);
                // the ball cracks a neighbour too, so tunnels open up
                if (viaBall && !t.core && this.rng() < 0.35) {
                    const c = i % g.cols, r = Math.floor(i / g.cols);
                    const [dc, dr] = this.rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
                    const j = (r + dr) * g.cols + c + dc;
                    if (c + dc >= 0 && c + dc < g.cols && r + dr >= 0 && r + dr < g.rows && g.cells[j]) {
                        const tj = g.types[g.cells[j]];
                        if (!tj.steel && !tj.core && !tj.gun) {
                            g.cellCenter(j, _p);
                            if (g.damage(j, 1) === 'destroyed') this.emit('cell', { x: _p.x, y: _p.y, s: g.cw, color: tj.color, kind: g.kind, glow: tj.glow || 0, src: 'crack' });
                        }
                    }
                }
            }
        } else if (res === 'damaged') {
            this.emit('cellHit', { x: _p.x, y: _p.y, kind: g.kind, core: !!t.core });
        }
        if (t.core && this.boss && g === this.boss.grid) {
            const delta = before - after;
            if (delta > 0) {
                this.boss.coreHp -= delta;
                this.addScore(300 * delta * (1 + this.loop), _p.x, _p.y);
                this.emit('bossHit', { x: _p.x, y: _p.y, frac: this.boss.coreHp / this.boss.coreMax });
                this.freeze = Math.max(this.freeze, 0.035);
                if (this.boss.coreHp <= 0) this.bossDie();
            }
        }
    }

    /** Blast a jagged crater out of a grid (shields, rocks). */
    crater(g, x, y, rad) {
        const cells = g.cellsInRadius(x, y, rad, this.rng);
        for (const i of cells) {
            const t = g.types[g.cells[i]];
            if (t.steel || t.core) continue;
            g.set(i, 0);
            if (this.rng() < 0.5) { g.cellCenter(i, _p); this.emit('cell', { x: _p.x, y: _p.y, s: g.cw, color: t.color, kind: g.kind, glow: 0, src: 'crater' }); }
        }
    }

    // ================================================================== formation
    marchStep() {
        const f = this.form;
        f.frame ^= 1;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, any = false;
        for (const s of this.slots) {
            if (!s.alive || s.state !== 'form') continue;
            any = true;
            if (s.x < minX) minX = s.x;
            if (s.x + s.w > maxX) maxX = s.x + s.w;
            if (s.y < minY) minY = s.y;
        }
        if (!any) return;
        const alive = this.aliveInvaders(true);
        const step = alive <= 2 ? 3 : 2;
        if ((f.dir > 0 && maxX + step > W - 3) || (f.dir < 0 && minX - step < 3)) {
            f.oy -= MARCH_DROP;
            f.dir = -f.dir;
            this.emit('drop', {});
        } else {
            f.ox += f.dir * step;
        }
        this.placeSlots();
        // grind through shields
        for (const s of this.slots) {
            if (!s.alive || s.state !== 'form') continue;
            for (const g of this.grids) {
                if (g.kind !== 'shield') continue;
                if (s.x + s.w <= g.x || s.x >= g.x + g.w || s.y + s.h <= g.y || s.y >= g.y + g.h) continue;
                for (let i = 0; i < g.cells.length; i++) {
                    if (!g.cells[i]) continue;
                    g.cellCenter(i, _p);
                    if (_p.x > s.x && _p.x < s.x + s.w && _p.y > s.y && _p.y < s.y + s.h) g.set(i, 0);
                }
            }
        }
        let lowest = Infinity;
        for (const s of this.slots) if (s.alive && s.state === 'form' && s.y < lowest) lowest = s.y;
        if (lowest < FIELD.invasion) {
            this.emit('invasion', {});
            f.oy = Math.min(f.oy + 56, FORMATION_TOP);
            this.placeSlots();
            if (!this.god) this.loseLife('invasion');
        }
    }

    updateFormation(dt) {
        if (!this.form) return;
        const p = this.paddle;
        for (const s of this.slots) {
            if (!s.alive) continue;
            if (s.flash > 0) s.flash -= dt;
            if (!s.inv) continue;
            if (s.state === 'dive') this.updateDive(s, dt, true);
            else if (s.state === 'return') this.updateReturn(s, dt);
            else if (s.state === 'capdive' || s.state === 'beam') this.updateCaptor(s, dt);
            else if (s.state === 'form' && s.kind === 'builder') this.updateBuilder(s, dt);
            if (s.state !== 'form' && s.alive && this.paddleTouch(s)) {
                if (s.kind === 'captor' || s.kind === 'diver') {
                    this.killInvader(s, 'crash');
                    if (!this.god && p.invuln <= 0) this.loseLife('crash');
                }
            }
        }

        // shooting
        this.fireT -= dt;
        const maxB = Math.max(1, Math.round((1.6 + this.stageIndex * 0.2 + this.loop * 2) * this.diff.maxBullets));
        if (this.fireT <= 0) {
            this.fireT = this.rng.range(0.6, 1.6) / (this.diff.fireRate * (0.8 + this.stageIndex * 0.05 + this.loop * 0.3));
            if (this.bullets.length < maxB) this.formationShoot();
        }
        // divers and captors leave formation
        this.diveT -= dt;
        if (this.diveT <= 0) {
            this.diveT = this.rng.range(3.2, 6) / (this.diff.diveRate * (1 + this.loop * 0.3));
            const divers = this.slots.filter((s) => s.alive && s.kind === 'diver' && s.state === 'form');
            if (divers.length) this.startDive(this.rng.pick(divers));
        }
        this.captorT -= dt;
        if (this.captorT <= 0) {
            this.captorT = this.rng.range(9, 14) / this.diff.diveRate;
            const busy = this.slots.some((s) => s.alive && s.kind === 'captor' && s.state !== 'form');
            const caps = this.slots.filter((s) => s.alive && s.kind === 'captor' && s.state === 'form' && !s.held.length);
            if (!busy && caps.length && this.balls.some((b) => !b.stuck && !b.captured)) {
                const c = this.rng.pick(caps);
                c.state = 'capdive'; c.t = 0;
                c.tx = clamp(p.x - c.w / 2 + this.rng.range(-16, 16), 8, W - 8 - c.w);
                c.ty = this.rng.range(140, 160);
                this.emit('captorDive', { id: c.id });
            }
        }
    }

    formationShoot() {
        // bottom-most invader in each column of the formation
        const bottoms = new Map();
        for (const s of this.slots) {
            if (!s.alive || !s.inv || s.state !== 'form') continue;
            const cur = bottoms.get(s.col);
            if (!cur || s.row > cur.row) bottoms.set(s.col, s);
        }
        if (!bottoms.size) return;
        const list = [...bottoms.values()];
        let shooter;
        if (this.rng() < 0.5) {
            const px = this.paddle.x;
            shooter = list.reduce((a, b) => (Math.abs(b.x + b.w / 2 - px) < Math.abs(a.x + a.w / 2 - px) ? b : a));
        } else shooter = this.rng.pick(list);
        const sp = this.diff.bulletSpeed * (1 + this.loop * 0.12);
        const x = shooter.x + shooter.w / 2, y = shooter.y - 2;
        if (shooter.kind === 'tank') this.fireBullet(x, y, 0, -48 * sp, 'bomb');
        else if (shooter.kind === 'peeper') this.fireBullet(x, y, 0, -105 * sp, 'plunger');
        else this.fireBullet(x, y, 0, -78 * sp, 'zig');
    }

    fireBullet(x, y, vx, vy, kind, reflected = false) {
        const size = { zig: [3, 7], plunger: [3, 6], bomb: [5, 5], rock: [4, 4], orb: [3, 3] }[kind];
        this.bullets.push({ x, y, vx, vy, kind, w: size[0], h: size[1], t: 0, dead: false });
        this.emit('ebullet', { kind, x, y, reflected });
    }

    startDive(s) {
        s.state = 'dive';
        this.initDive(s);
        this.emit('dive', { id: s.id, x: s.x, y: s.y });
    }

    initDive(e) {
        e.dv = {
            t: 0, x0: e.x, y0: e.y, side: e.x + e.w / 2 < W / 2 ? -1 : 1, tx: null, x1: 0, y1: 0, t1: 0,
            shots: [this.rng.range(1.1, 1.6), this.rng.range(1.9, 2.5)],
            speed: (72 + this.loop * 14) * (0.85 + this.diff.bulletSpeed * 0.15),
        };
    }

    updateDive(e, dt, returns) {
        const d = e.dv;
        d.t += dt;
        if (d.t < 0.8) {
            const a = (d.t / 0.8) * Math.PI * 1.25;
            e.x = d.x0 + d.side * 14 * (1 - Math.cos(a));
            e.y = d.y0 + 16 * Math.sin(a);
        } else {
            if (d.tx === null) { d.tx = clamp(this.paddle.x + this.rng.range(-24, 24), 10, W - 10); d.x1 = e.x; d.y1 = e.y; d.t1 = d.t; }
            const u = d.t - d.t1;
            e.y = d.y1 - d.speed * u;
            const prog = clamp((d.speed * u) / Math.max(20, d.y1 - 20), 0, 1);
            const sm = prog * prog * (3 - 2 * prog);
            e.x = d.x1 + (d.tx - e.w / 2 - d.x1) * sm + 14 * Math.sin(u * 5) * (1 - prog * 0.6);
        }
        while (d.shots.length && d.t > d.shots[0]) {
            d.shots.shift();
            if (e.y > 60) this.fireBullet(e.x + e.w / 2, e.y - 1, 0, -90 * this.diff.bulletSpeed, 'zig');
        }
        if (e.y < -16) {
            if (returns) {
                e.state = 'return';
                this.slotHome(e, _p);
                e.x = _p.x; e.y = 336;
            } else e.alive = false;
        }
    }

    updateReturn(e, dt) {
        this.slotHome(e, _p);
        const dx = _p.x - e.x, dy = _p.y - e.y, d = Math.hypot(dx, dy);
        const sp = 120 * dt;
        if (d <= sp + 0.5) { e.x = _p.x; e.y = _p.y; e.state = 'form'; e.dv = null; return; }
        e.x += (dx / d) * sp; e.y += (dy / d) * sp;
    }

    updateCaptor(c, dt) {
        c.t += dt;
        if (c.state === 'capdive') {
            const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy), sp = 95 * dt;
            if (d <= sp + 0.5) {
                c.x = c.tx; c.y = c.ty; c.state = 'beam'; c.t = 0;
                this.beams.push({ kind: 'tractor', owner: c, t: 0, dur: 3.2, warn: 0.4 });
                this.emit('beamStart', { id: c.id, kind: 'tractor' });
            } else { c.x += (dx / d) * sp; c.y += (dy / d) * sp; }
        } else if (c.state === 'beam') {
            if (c.t > 3.6) { c.state = 'return'; this.emit('beamEnd', { id: c.id }); }
        }
    }

    updateBuilder(s, dt) {
        s.buildT -= dt;
        if (s.buildT > 0 || s.builds >= 8) return;
        s.buildT = this.rng.range(5, 8.5);
        // heal a damaged brick nearby first
        for (const o of this.slots) {
            if (!o.alive || o.inv || o.hp >= o.maxHp) continue;
            if (Math.abs(o.col - s.col) <= 2 && Math.abs(o.row - s.row) <= 2) {
                o.hp = o.maxHp;
                this.emit('build', { x: o.x + o.w / 2, y: o.y + o.h / 2, heal: true });
                s.builds++;
                return;
            }
        }
        const occ = new Set();
        for (const o of this.slots) if (o.alive) occ.add(o.col + ',' + o.row);
        const cands = [];
        for (const [dc, dr] of [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, 2], [-1, 2], [1, 2]]) {
            const c = s.col + dc, r = s.row + dr;
            if (c < 0 || c >= this.form.cols || r < 0 || r > this.form.rows + 1) continue;
            if (occ.has(c + ',' + r)) continue;
            cands.push([c, r]);
        }
        if (!cands.length) return;
        const [c, r] = cands[0][1] === s.row + 1 && this.rng() < 0.6 ? cands[0] : this.rng.pick(cands);
        const b = this.addSlot(c, r, this.loop > 0 && this.rng() < 0.3 ? '=' : '#');
        this.slotHome(b, _p); b.x = _p.x; b.y = _p.y;
        b.color = ROW_COLORS[(r + 3) % ROW_COLORS.length];
        s.builds++;
        this.emit('build', { x: b.x + b.w / 2, y: b.y + b.h / 2, id: b.id });
    }

    paddleTouch(e) {
        const p = this.paddle;
        return e.x < p.x + p.w / 2 && e.x + e.w > p.x - p.w / 2 && e.y < p.y + p.h && e.y + e.h > p.y;
    }

    releaseHeld(e, score = true) {
        if (!e.held || !e.held.length) return;
        for (const b of e.held) {
            b.captured = null;
            b.vx = this.rng.range(-0.4, 0.4) * b.speed; b.vy = -b.speed;
            this.fixAngle(b);
            b.lastTouch = this.time;
        }
        if (score) {
            this.addScore(1000 * Math.min(3, e.held.length) * (1 + this.loop), e.x + e.w / 2, e.y);
            this.emit('rescue', { x: e.x + e.w / 2, y: e.y, n: e.held.length });
        }
        e.held = [];
    }

    // ================================================================== free flyers (minis, boss divers, challenge)
    spawnMini(x, y, vx) {
        const spr = INVADERS.mini;
        this.free.push({ id: this.nextId++, cat: 'free', inv: true, kind: 'mini', x, y, w: spr.w, h: spr.h, vx, vy: -16, hp: 1, maxHp: 1, alive: true, flash: 0, state: 'free', shootT: this.rng.range(1, 3), t: 0 });
    }

    spawnFreeDiver(x, y) {
        const spr = INVADERS.diver;
        const e = { id: this.nextId++, cat: 'free', inv: true, kind: 'diver', x, y, w: spr.w, h: spr.h, hp: 1, maxHp: 1, alive: true, flash: 0, state: 'dive', t: 0 };
        this.initDive(e);
        this.free.push(e);
    }

    updateFree(dt) {
        for (const e of this.free) {
            if (!e.alive) continue;
            e.t += dt;
            if (e.flash > 0) e.flash -= dt;
            if (e.chal) {
                const path = PATHS[e.path];
                const u = (this.time - e.t0) / path.dur;
                if (u >= 1) { e.alive = false; this.challenge.escaped++; continue; }
                pathPoint(path, u, e.mirror, _p);
                e.x = _p.x - e.w / 2; e.y = _p.y - e.h / 2;
                continue;
            }
            if (e.kind === 'mini') {
                e.x += e.vx * dt; e.y += e.vy * dt;
                if (e.x < 2) { e.x = 2; e.vx = Math.abs(e.vx); }
                if (e.x + e.w > W - 2) { e.x = W - 2 - e.w; e.vx = -Math.abs(e.vx); }
                e.shootT -= dt;
                if (e.shootT <= 0 && e.y > 50) { e.shootT = this.rng.range(1.8, 3.5); this.fireBullet(e.x + 3, e.y - 1, 0, -70 * this.diff.bulletSpeed, 'zig'); }
                if (this.paddleTouch(e)) { this.killInvader(e, 'crash'); continue; }
                if (e.y < -10) e.alive = false;
            } else if (e.state === 'dive') {
                this.updateDive(e, dt, false);
                if (e.alive && this.paddleTouch(e)) {
                    this.killInvader(e, 'crash');
                    if (!this.god && this.paddle.invuln <= 0) this.loseLife('crash');
                }
            }
        }
        if (this.free.length > 40 || this.free.some((e) => !e.alive)) this.free = this.free.filter((e) => e.alive);
    }

    updateChallenge(dt) {
        const c = this.challenge;
        if (c.gi >= c.groups.length) return;
        c.nextT -= dt;
        if (c.nextT > 0) return;
        const g = c.groups[c.gi];
        const spr = INVADERS[g.kind];
        const path = PATHS[g.path];
        this.free.push({ id: this.nextId++, cat: 'free', inv: true, chal: true, kind: g.kind, path: g.path, mirror: g.mirror, t0: this.time, x: path.pts[0][0], y: path.pts[0][1], w: spr.w, h: spr.h, hp: 1, maxHp: 1, alive: true, flash: 0, state: 'free', t: 0 });
        c.member++;
        if (c.member >= 8) { c.member = 0; c.gi++; c.nextT = 2.4; this.emit('squadron', { n: c.gi }); }
        else c.nextT = 0.2;
    }

    // ================================================================== grids (rocks)
    updateGrids(dt) {
        for (const g of this.grids) {
            for (let i = 0; i < g.flash.length; i++) if (g.flash[i] > 0) g.flash[i] = Math.max(0, g.flash[i] - dt * 6);
            if (g.kind !== 'rock') continue;
            g.fx += g.vx * dt;
            if (g.vx > 0 && g.fx > W + 4) g.fx = -g.w - 4;
            if (g.vx < 0 && g.fx < -g.w - 4) g.fx = W + 4;
            const nx = Math.round(g.fx);
            if (nx !== g.x) {
                const dx = nx - g.x;
                g.x = nx;
                // carry balls resting against it
                for (const b of this.balls) {
                    if (b.stuck || b.captured) continue;
                    const i = g.hitBox(b.x - BALL.r, b.y - BALL.r, b.x + BALL.r, b.y + BALL.r, b.x, b.y);
                    if (i >= 0) { b.x += dx * 2; b.vx = Math.sign(dx) * Math.abs(b.vx || 1); this.fixAngle(b); }
                }
            }
        }
        const before = this.grids.length;
        this.grids = this.grids.filter((g) => g.kind !== 'rock' || g.alive > 0);
        if (this.grids.length < before && this.sector.asteroids) {
            this.rockSpawnT.push(this.rng.range(6, 10));
            this.emit('rockGone', {});
        }
        if (this.rockSpawnT && this.rockSpawnT.length) {
            for (let i = 0; i < this.rockSpawnT.length; i++) this.rockSpawnT[i] -= dt;
            if (this.rockSpawnT[0] <= 0) {
                this.rockSpawnT.shift();
                const left = this.rng() < 0.5;
                this.spawnRock(left ? -24 : W + 2, this.rng.pick([118, 168]), left ? this.rng.range(9, 15) : -this.rng.range(9, 15));
            }
        }
    }

    // ================================================================== mystery ship
    updateUfo(dt) {
        if (this.stage.type !== 'wave') return;
        if (this.ufo) {
            const u = this.ufo;
            u.x += u.dir * 40 * dt;
            u.t += dt;
            if (u.x < -24 || u.x > W + 8) { this.ufo = null; this.emit('ufoGone', {}); }
            return;
        }
        this.ufoT -= dt;
        if (this.ufoT <= 0) {
            this.ufoT = this.rng.range(18, 28);
            if (this.aliveInvaders(true) < 6) return;
            const dir = this.rng() < 0.5 ? 1 : -1;
            this.ufo = { id: this.nextId++, cat: 'ufo', kind: 'ufo', x: dir > 0 ? -18 : W + 2, y: 291, w: UFO.w, h: UFO.h, dir, alive: true, t: 0 };
            this.emit('ufo', {});
        }
    }

    killUfo(src) {
        const u = this.ufo;
        if (!u || !u.alive) return;
        u.alive = false;
        const S = this.session;
        let pts = this.rng.pick([50, 100, 150, 200, 300]);
        if (src === 'shot' && (S.shots === 23 || (S.shots > 23 && (S.shots - 23) % 15 === 0))) pts = 300;
        if (src === 'ball' || src === 'fire') pts *= 2;
        this.addScore(pts * (1 + this.loop), u.x + u.w / 2, u.y + u.h / 2);
        this.emit('ufoKill', { x: u.x, y: u.y, w: u.w, h: u.h, pts: pts * (1 + this.loop) });
        this.spawnCapsule(u.x + u.w / 2, u.y, null, true);
        this.ufo = null;
    }

    // ================================================================== enemy bullets, beams
    updateBullets(dt) {
        const p = this.paddle;
        for (const b of this.bullets) {
            if (b.dead) continue;
            b.t += dt;
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < -6 || b.x > W + 6 || b.y > 330) { b.dead = true; continue; }
            // the paddle
            if (Math.abs(b.x - p.x) < p.w / 2 - 2 + (b.kind === 'bomb' ? 1 : 0) && b.y - b.h / 2 < p.y + p.h - 1 && b.y + b.h / 2 > p.y) {
                b.dead = true;
                if (b.kind === 'bomb') this.emit('boom', { x: b.x, y: b.y });
                if (p.invuln > 0 || this.god) { this.emit('deflect', { x: b.x, y: b.y }); continue; }
                this.loseLife('shot');
                return;
            }
            // shields and rocks
            for (const g of this.grids) {
                if (g.kind === 'boss') continue;
                const i = g.hitBox(b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2, b.x, b.y - b.h / 2);
                if (i < 0) continue;
                b.dead = true;
                if (b.kind === 'bomb') { this.crater(g, b.x, b.y - 2, 7); this.emit('boom', { x: b.x, y: b.y }); }
                else { this.hitCell(g, i, 1, 'bullet', false); this.crater(g, b.x, b.y - 2, b.kind === 'rock' ? 3.5 : 2.6); this.emit('splash', { x: b.x, y: b.y }); }
                break;
            }
            if (!b.dead && b.y < FIELD.ground) {
                b.dead = true;
                if (b.kind === 'bomb') this.emit('boom', { x: b.x, y: FIELD.ground });
                else this.emit('splash', { x: b.x, y: FIELD.ground });
            }
        }
        this.bullets = this.bullets.filter((b) => !b.dead);
    }

    updateBeams(dt) {
        const p = this.paddle;
        for (const bm of this.beams) {
            bm.t += dt;
            if (bm.kind === 'beam') {
                if (bm.t > bm.warn && bm.t < bm.warn + bm.dur) {
                    if (!bm.fired) { bm.fired = true; this.emit('beamFire', { x: bm.x }); }
                    if (Math.abs(p.x - bm.x) < p.w / 2 + bm.w / 2 - 1 && p.invuln <= 0 && !this.god) { this.loseLife('beam'); return; }
                    for (const g of this.grids) if (g.kind === 'shield') this.crater(g, bm.x + this.rng.range(-3, 3), this.rng.range(44, 60), 3);
                }
                if (bm.t > bm.warn + bm.dur) bm.done = true;
            } else if (bm.kind === 'tractor') {
                const o = bm.owner;
                const alive = o === this.boss ? !o.dead : o.alive;
                if (!alive || bm.t > bm.dur) { bm.done = true; this.endTractor(bm); continue; }
                if (bm.t < bm.warn || (bm.held && bm.held.length >= (o === this.boss ? 2 : 1))) continue;
                const cx = o === this.boss ? o.grid.x + o.grid.w / 2 : o.x + o.w / 2;
                const cy = o === this.boss ? o.grid.y : o.y;
                bm.cx = cx; bm.cy = cy;
                for (const b of this.balls) {
                    if (b.stuck || b.captured || b.y >= cy || b.y < FIELD.ground + 18) continue;
                    const half = 5 + (cy - b.y) * 0.24;
                    if (Math.abs(b.x - cx) > half) continue;
                    this.captureBall(b, o === this.boss ? o.holder : o, bm);
                }
            }
        }
        this.beams = this.beams.filter((b) => !b.done);
    }

    captureBall(b, holder, bm) {
        b.captured = holder;
        b.capOff = (holder.held.length % 3 - 1) * 4;
        holder.held.push(b);
        if (bm) (bm.held || (bm.held = [])).push(b);
        this.emit('captured', { x: b.x, y: b.y });
        if (!this.balls.some((o) => !o.captured)) {
            this.balls.push(this.newBall());
            this.emit('ballCaptured', {});
        }
    }

    endTractor(bm) {
        this.emit('beamEnd', {});
        if (bm.owner === this.boss && bm.held) {
            this.boss.holder.held = [];
            // the boss spits captured balls back down, hard
            for (const b of bm.held) {
                if (b.captured === null) continue;
                b.captured = null;
                b.vx = this.rng.range(-0.3, 0.3) * b.speed; b.vy = -b.speed;
                b.speed = Math.min(this.ballBase * BALL.maxMul, b.speed * 1.1);
                this.fixAngle(b);
                b.lastTouch = this.time;
            }
            this.emit('spit', {});
        }
    }

    // ================================================================== capsules
    spawnCapsule(x, y, kind = null, force = false) {
        if (!force && this.capsules.length >= 2) return;
        if (this.demo && kind === null && this.rng() < 0.3) return;
        if (!kind) {
            const S = this.session;
            let total = 0;
            const pool = CAPSULE_KINDS.filter((k) => !(k === 'P' && S.lives >= 6) && !(k === 'N' && S.bombs >= MAX_BOMBS));
            for (const k of pool) total += CAPSULE_WEIGHTS[k];
            let r = this.rng() * total;
            kind = pool[0];
            for (const k of pool) { r -= CAPSULE_WEIGHTS[k]; if (r <= 0) { kind = k; break; } }
        }
        this.capsules.push({ x: clamp(x - CAPSULE_W / 2, 1, W - CAPSULE_W - 1), y, w: CAPSULE_W, h: CAPSULE_H, kind, t: 0 });
        this.emit('capsule', { kind, x, y });
    }

    updateCapsules(dt) {
        const p = this.paddle;
        for (const c of this.capsules) {
            c.t += dt;
            c.y -= 42 * dt;
            if (c.x < p.x + p.w / 2 && c.x + c.w > p.x - p.w / 2 && c.y < p.y + p.h + 1 && c.y + c.h > p.y) {
                c.dead = true;
                this.applyPower(c.kind, c.x + c.w / 2, c.y);
            } else if (c.y < -8) c.dead = true;
        }
        this.capsules = this.capsules.filter((c) => !c.dead);
    }

    applyPower(k, x, y) {
        const S = this.session;
        this.addScore(100, x, y + 8, false);
        if (k in POWER_TIME) this.power[k] = POWER_TIME[k];
        if (k === 'S') for (const b of this.balls) { b.speed = Math.max(this.ballBase * 0.62, b.speed * 0.65); this.fixAngle(b); }
        if (k === 'M') this.multiBall();
        if (k === 'B') this.barrier = 3;
        if (k === 'N') S.bombs = Math.min(MAX_BOMBS, S.bombs + 1);
        if (k === 'P') S.lives++;
        this.emit('power', { kind: k, x, y });
    }

    multiBall() {
        if (this.balls.every((b) => b.stuck)) this.launchBalls();
        const src = this.balls.filter((b) => !b.stuck && !b.captured);
        for (const b of src) {
            for (const a of [-0.45, 0.45]) {
                if (this.balls.length >= MAX_BALLS) return;
                const nb = { ...b, id: this.nextId++, pierce: new Map() };
                this.balls.push(nb);
                this.rotateBall(nb, a);
            }
        }
    }

    // ================================================================== nova bomb
    nova() {
        const S = this.session;
        if (S.bombs <= 0 || this.state !== 'play') return;
        S.bombs--;
        const p = this.paddle;
        this.emit('nova', { x: p.x, y: p.y });
        p.invuln = Math.max(p.invuln, 1.2);
        for (const b of this.bullets) { if (!b.dead) { b.dead = true; this.emit('swat', { x: b.x, y: b.y, kind: b.kind }); } }
        this.bullets = [];
        this.beams = this.beams.filter((bm) => { if (bm.kind === 'tractor') this.endTractor(bm); return false; });
        // a shockwave from the paddle: everything within reach takes one hit
        for (const e of [...this.targetList()]) {
            if (!e.alive) continue;
            const dx = e.x + e.w / 2 - p.x, dy = e.y + e.h / 2 - p.y;
            if (dx * dx + dy * dy < 120 * 120) this.hitEntity(e, 1, 'nova', null);
        }
        if (this.boss && !this.boss.dead) {
            const g = this.boss.grid;
            const cores = [], other = [];
            for (let i = 0; i < g.cells.length; i++) {
                if (!g.cells[i]) continue;
                const t = g.types[g.cells[i]];
                if (t.core) cores.push(i); else if (!t.jaw) other.push(i);
            }
            for (let k = 0; k < 16 && other.length; k++) {
                const j = Math.floor(this.rng() * other.length);
                this.hitCell(g, other[j], 3, 'nova', true);
                other.splice(j, 1);
            }
            for (let k = 0; k < 1 && cores.length && this.boss && !this.boss.dead; k++) this.hitCell(g, cores[Math.floor(this.rng() * cores.length)], 1, 'nova', true);
        }
    }

    // ================================================================== boss
    updateBoss(dt) {
        const B = this.boss;
        if (B.dead) return;
        const def = B.def, g = B.grid;
        B.t += dt;
        // movement (and a dash offset that eases back)
        if (B.dashT > 0) { B.dashT -= dt; B.dashOff += (B.dashTarget - B.dashOff) * Math.min(1, dt * 5); }
        else B.dashOff *= Math.max(0, 1 - dt * 0.8);
        const m = def.move;
        const speedUp = 1 + B.phase * 0.25;
        const nx = Math.round(clamp(B.baseX + Math.sin(B.t * m.wx * speedUp) * m.ax + B.dashOff, 2, W - 2 - g.w));
        const ny = Math.round(B.baseY + Math.sin(B.t * m.wy) * m.ay);
        g.x = nx; g.y = ny;
        B.holder.x = g.x + g.w / 2 - 2; B.holder.y = g.y - 2;
        // regeneration
        B.regenT -= dt;
        if (B.regenT <= 0) { B.regenT = def.regen.every / Math.min(1, this.diff.fireRate * 1.2); this.bossRegen(def.regen.n + B.phase); }
        // jaw
        if (def.jaw) {
            B.jawT -= dt;
            if (B.jawT <= 0) {
                B.jawOpen = !B.jawOpen;
                B.jawT = B.jawOpen ? def.jaw.open : def.jaw.shut;
                for (const i of B.jawCells) g.set(i, B.jawOpen ? 0 : CELL_CODE.j);
                this.emit(B.jawOpen ? 'jawOpen' : 'jawShut', { x: g.x + g.w / 2, y: g.y });
            }
        }
        // spiral stream
        if (B.spiralT > 0) {
            B.spiralT -= dt; B.spiralCd -= dt;
            if (B.spiralCd <= 0) {
                B.spiralCd = 0.085;
                B.spiralA += 0.47;
                const c = this.bossCenter();
                const sp = 62 * this.diff.bulletSpeed;
                const a = Math.PI * 1.5 + Math.sin(B.spiralA) * 1.25;
                this.fireBullet(c.x, c.y, Math.cos(a) * sp, Math.sin(a) * sp, 'orb');
            }
        }
        // attacks
        B.attackT -= dt;
        if (B.attackT <= 0) {
            const ph = def.phases[B.phase];
            B.attackT = ph.cool * 1.25 * this.rng.range(0.9, 1.3) / this.diff.fireRate * (this.loop ? 0.8 : 1);
            let pick = this.rng.pick(ph.attacks);
            if (pick === B.lastAttack) pick = this.rng.pick(ph.attacks);
            B.lastAttack = pick;
            this.bossAttack(pick);
        }
        // phase change
        const frac = B.coreHp / B.coreMax;
        if (!B.exposed && frac <= 0.25) {
            B.exposed = true;
            for (let i = 0; i < g.cells.length; i++) {
                const tt = g.types[g.cells[i]];
                if (g.cells[i] && !tt.core && !tt.gun && !tt.jaw && (tt.hp > 1 || tt.steel)) { g.set(i, CELL_CODE.a); g.flash[i] = 1; }
            }
            this.emit('coreExposed', { x: g.x + g.w / 2, y: g.y + g.h / 2 });
        }
        const nextPh = def.phases[B.phase + 1];
        if (nextPh && frac <= nextPh.at) {
            B.phase++;
            this.freeze = 0.25;
            this.emit('bossPhase', { phase: B.phase, x: g.x + g.w / 2, y: g.y + g.h / 2 });
            this.spawnCapsule(g.x + g.w / 2, g.y, null, true);
            if (B.id === 'overmind' && B.phase === 1) {
                for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === CELL_CODE.s) { g.set(i, CELL_CODE.h); g.flash[i] = 1; }
            }
        }
    }

    bossCenter() {
        const g = this.boss.grid;
        let sx = 0, sy = 0, n = 0;
        for (let i = 0; i < g.cells.length; i++) {
            if (!g.cells[i] || !g.types[g.cells[i]].core) continue;
            g.cellCenter(i, _p); sx += _p.x; sy += _p.y; n++;
        }
        return n ? { x: sx / n, y: sy / n } : { x: g.x + g.w / 2, y: g.y + g.h / 2 };
    }

    bossCells(pred) {
        const g = this.boss.grid, out = [];
        for (let i = 0; i < g.cells.length; i++) if (g.cells[i] && pred(g.types[g.cells[i]])) out.push(i);
        return out;
    }

    bossAttack(kind) {
        const B = this.boss, g = B.grid, p = this.paddle;
        const sp = this.diff.bulletSpeed * (1 + this.loop * 0.12);
        this.emit('bossAttack', { kind });
        const origin = (pred) => {
            const cells = this.bossCells(pred);
            if (!cells.length) return null;
            g.cellCenter(this.rng.pick(cells), _p);
            return { x: _p.x, y: _p.y };
        };
        switch (kind) {
            case 'spread3': case 'spread5': {
                const n = kind === 'spread3' ? 3 : 5;
                const guns = this.bossCells((t) => t.gun);
                if (!guns.length) { this.bossAttack('aimed'); return; }
                const used = new Set();
                for (let k = 0; k < (B.phase > 0 ? 2 : 1); k++) {
                    const i = this.rng.pick(guns);
                    const col = i % g.cols;
                    if (used.has(col < g.cols / 2)) continue;
                    used.add(col < g.cols / 2);
                    g.cellCenter(i, _p);
                    for (let j = 0; j < n; j++) {
                        const a = -Math.PI / 2 + (j / (n - 1) - 0.5) * 0.95;
                        this.fireBullet(_p.x, _p.y - 2, Math.cos(a) * 72 * sp, Math.sin(a) * 72 * sp, 'zig');
                    }
                }
                break;
            }
            case 'aimed': {
                const o = origin((t) => t.glow && !t.core) || this.bossCenter();
                for (let k = 0; k < 2 + Math.min(1, B.phase); k++) {
                    this.queue.push({ t: k * 0.18, fn: () => {
                        const dx = p.x - o.x, dy = p.y + 3 - o.y, d = Math.hypot(dx, dy) || 1;
                        this.fireBullet(o.x, o.y, (dx / d) * 80 * sp, (dy / d) * 80 * sp, 'orb');
                    } });
                }
                break;
            }
            case 'ring': {
                const c = this.bossCenter();
                const n = 7 + B.phase * 2;
                for (let j = 0; j < n; j++) {
                    const a = Math.PI + 0.15 + (j / (n - 1)) * (Math.PI - 0.3);
                    this.fireBullet(c.x, c.y, Math.cos(a) * 58 * sp, Math.sin(a) * 58 * sp, 'orb');
                }
                break;
            }
            case 'summon': {
                const n = this.free.filter((e) => e.alive && e.kind === 'mini').length;
                if (n >= 6) { this.bossAttack('aimed'); return; }
                for (let k = 0; k < 2; k++) this.spawnMini(g.x + this.rng.range(10, g.w - 16), g.y - 6, (k ? 1 : -1) * this.rng.range(24, 40));
                this.emit('summon', { x: g.x + g.w / 2, y: g.y });
                break;
            }
            case 'bombs':
                for (let k = 0; k < 3; k++) this.queue.push({ t: k * 0.25, fn: () => this.fireBullet(g.x + this.rng.range(8, g.w - 8), g.y - 3, 0, -46 * sp, 'bomb') });
                break;
            case 'beam':
                this.beams.push({ kind: 'beam', x: clamp(p.x, 8, W - 8), w: 9, t: 0, warn: 1.1, dur: 0.7 });
                this.emit('beamWarn', {});
                break;
            case 'rocks':
                for (let k = 0; k < 7; k++) this.queue.push({ t: k * 0.18, fn: () => this.fireBullet(this.rng.range(8, W - 8), 304, this.rng.range(-10, 10), -55 * sp, 'rock') });
                this.emit('rumble', {});
                break;
            case 'tractor':
                if (this.beams.some((b) => b.kind === 'tractor')) { this.bossAttack('aimed'); return; }
                this.beams.push({ kind: 'tractor', owner: B, t: 0, dur: 2.8, warn: 0.45 });
                this.emit('beamStart', { kind: 'tractor', boss: true });
                break;
            case 'divers':
                for (let k = 0; k < 2; k++) this.queue.push({ t: k * 0.4, fn: () => this.spawnFreeDiver(g.x + (k ? g.w - 14 : 4), g.y) });
                break;
            case 'spiral':
                B.spiralT = 2.6; B.spiralCd = 0;
                break;
            case 'dash':
                B.dashTarget = (g.x + g.w / 2 < W / 2 ? 1 : -1) * 50; B.dashT = 1.2;
                this.emit('dash', {});
                break;
        }
    }

    updateQueue(dt) {
        if (!this.queue.length) return;
        for (const q of this.queue) { q.t -= dt; if (q.t <= 0 && !q.done) { q.done = true; if (this.boss && !this.boss.dead) q.fn(); } }
        this.queue = this.queue.filter((q) => !q.done);
    }

    bossRegen(n) {
        const g = this.boss.grid;
        const cands = [];
        for (let i = 0; i < g.cells.length; i++) {
            if (g.cells[i] || !g.orig[i]) continue;
            const t = g.types[g.orig[i]];
            if (!t.regen) continue;
            const c = i % g.cols, r = Math.floor(i / g.cols);
            const nb = (c > 0 && g.cells[i - 1]) || (c < g.cols - 1 && g.cells[i + 1]) || (r > 0 && g.cells[i - g.cols]) || (r < g.rows - 1 && g.cells[i + g.cols]);
            if (nb) cands.push(i);
        }
        let k = 0;
        while (k < n && cands.length) {
            const j = Math.floor(this.rng() * cands.length);
            const i = cands[j]; cands.splice(j, 1);
            // never rebuild onto a ball
            g.cellCenter(i, _p);
            if (this.balls.some((b) => Math.abs(b.x - _p.x) < 4 && Math.abs(b.y - _p.y) < 4)) continue;
            g.set(i, g.orig[i]); g.flash[i] = 1;
            this.emit('regen', { x: _p.x, y: _p.y });
            k++;
        }
    }

    bossDie() {
        const B = this.boss;
        if (B.dead) return;
        B.dead = true; B.dieT = 0; B.blastT = 0;
        this.state = 'bossdying'; this.stateT = 0;
        this.bullets = []; this.beams = []; this.queue = [];
        for (const e of this.free) if (e.alive) { e.alive = false; this.emit('kill', { id: e.id, kind: e.kind, x: e.x, y: e.y, w: e.w, h: e.h, src: 'clear', frame: 0 }); }
        for (const b of this.balls) { if (b.captured) b.captured = null; }
        this.emit('bossDie', { x: B.grid.x + B.grid.w / 2, y: B.grid.y + B.grid.h / 2, name: B.def.name });
    }

    updateBossDeath(dt) {
        const B = this.boss, g = B.grid;
        B.dieT += dt; B.blastT -= dt;
        if (B.dieT < 2.6 && B.blastT <= 0) {
            B.blastT = 0.11;
            const cells = this.bossCells(() => true);
            for (let k = 0; k < 14 && cells.length; k++) {
                const j = Math.floor(this.rng() * cells.length);
                const i = cells[j]; cells.splice(j, 1);
                const t = g.types[g.cells[i]];
                g.cellCenter(i, _p);
                g.set(i, 0);
                this.emit('cell', { x: _p.x, y: _p.y, s: g.cw, color: t.color, kind: 'boss', glow: t.glow || 0, src: 'death' });
            }
            this.emit('blast', { x: g.x + this.rng() * g.w, y: g.y + this.rng() * g.h });
        }
        if (B.dieT >= 2.6 && g.alive > 0) {
            for (let i = 0; i < g.cells.length; i++) {
                if (!g.cells[i]) continue;
                const t = g.types[g.cells[i]];
                g.cellCenter(i, _p);
                g.set(i, 0);
                this.emit('cell', { x: _p.x, y: _p.y, s: g.cw, color: t.color, kind: 'boss', glow: t.glow || 0, src: 'death' });
            }
            this.emit('bossFinal', { x: g.x + g.w / 2, y: g.y + g.h / 2 });
        }
        if (B.dieT > 4.0) this.startTally();
    }

    // ================================================================== clear, tally, death
    checkClear() {
        if (this.stage.type === 'wave') {
            if (this.aliveInvaders() > 0) return;
            this.state = 'clearing'; this.stateT = 0;
            this.bullets = []; this.beams = [];
            for (const b of this.balls) if (b.captured) b.captured = null;
            const bricks = this.slots.filter((s) => s.alive && !s.inv);
            this.sweep = bricks.length === 0 || this.bricksBroken >= this.bricksTotal;
            const c = { x: W / 2, y: 200 };
            bricks.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
            this.clearList = bricks.map((s, i) => ({ s, t: 0.25 + i * 0.06 }));
            this.emit('waveClear', { sweep: this.sweep });
        } else if (this.stage.type === 'challenge') {
            const c = this.challenge;
            if (c.gi < c.groups.length || this.free.some((e) => e.alive)) return;
            this.startTally();
        }
    }

    updateClearing(dt) {
        for (const c of this.clearList) {
            if (c.done || this.stateT < c.t) continue;
            c.done = true;
            this.hitBrick(c.s, 99, 'clear');
            this.addScore(10, c.s.x + c.s.w / 2, c.s.y + c.s.h / 2, false);
        }
        const last = this.clearList.length ? this.clearList[this.clearList.length - 1].t : 0;
        if (this.stateT > last + 1.1) this.startTally();
    }

    startTally() {
        const st = this.stage, L = 1 + this.loop, sec = st.sector + 1;
        const lines = [];
        if (st.type === 'wave') {
            lines.push(['WAVE CLEAR', 1000 * sec * L]);
            lines.push(['NO MISS', this.stageMisses ? 0 : 2000 * sec * L]);
            lines.push(['BRICK SWEEP', this.sweep ? 3000 * L : 0]);
            lines.push(['TIME BONUS', Math.max(0, Math.round(120 - this.stageTime)) * 20 * L]);
        } else if (st.type === 'boss') {
            lines.push([this.boss.def.name, 10000 * sec * L]);
            lines.push(['NO MISS', this.stageMisses ? 0 : 5000 * L]);
            lines.push(['TIME BONUS', Math.max(0, Math.round(150 - this.stageTime)) * 30 * L]);
        } else {
            const c = this.challenge;
            lines.push(['NUMBER OF HITS', c.hits]);
            lines.push(['BONUS', c.hits * 100 * L]);
            if (c.hits >= c.total) lines.push(['PERFECT!!', 10000 * L]);
        }
        const total = lines.reduce((s, l, i) => s + (st.type === 'challenge' && i === 0 ? 0 : l[1]), 0);
        this.tally = { lines, total, kind: st.type, perfect: st.type === 'challenge' && this.challenge.hits >= this.challenge.total };
        this.addScore(total, W / 2, 160, false);
        this.state = 'tally'; this.stateT = 0;
        this.bullets = []; this.capsules = [];
        this.emit('tally', { kind: st.type, perfect: this.tally.perfect });
    }

    loseLife(cause) {
        if (this.state !== 'play') return;
        const p = this.paddle;
        this.state = 'dying'; this.stateT = 0;
        this.session.lives--;
        this.stageMisses++;
        this.emit('playerDie', { x: p.x, y: p.y + p.h / 2, cause });
        this.bullets = []; this.capsules = []; this.beams = []; this.queue = [];
        for (const s of this.slots) if (s.alive && s.inv && s.state !== 'form') { s.state = 'return'; this.releaseHeld(s, false); }
        for (const e of this.free) if (e.alive && e.kind === 'diver') e.alive = false;
        this.balls = [];
        this.power.E = 0; this.power.C = 0; this.power.F = 0;
        if (!this.challenge) this.power.L = 0;
        this.chain = 0; this.mult = 1;
    }

    afterDeath() {
        if (this.session.lives <= 0) {
            this.state = 'gameover'; this.stateT = 0;
            this.emit('gameOver', {});
            return;
        }
        this.state = 'play'; this.stateT = 0;
        this.paddle.invuln = 2;
        this.paddle.x = W / 2;
        this.balls = [this.newBall()];
        this.barrier = Math.max(this.barrier, this.diff.startBarrier);
        this.emit('respawn', {});
    }

    /** Continue after GAME OVER: same stage state, fresh ships. */
    continueGame() {
        const S = this.session;
        S.lives = this.diff.lives; S.continues++; S.bombs = Math.max(S.bombs, 1);
        this.state = 'play'; this.stateT = 0;
        this.paddle.invuln = 2.5; this.paddle.x = W / 2;
        this.balls = [this.newBall()];
        this.barrier = Math.max(this.barrier, 1);
        this.emit('respawn', { cont: true });
    }
}
