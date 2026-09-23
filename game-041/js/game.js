// ============================================================
// BURROWGUARD — the simulation. Pure logic: no DOM, no WebGL.
// ============================================================
// Positions are in cells; a cell's centre is its integer coordinate.
// Every actor moves cell-to-cell: (fx,fy) -> (tx,ty) with progress t in 0..1.

import {
    COLS, ROWS, CORE, PLAYER_START, SPAWNS, stratumOf,
    PLAYER_SPEED, PLAYER_DIG_SPEED, HARPOON_REACH, HARPOON_SPEED, PUMP_REPEAT,
    RESPAWN_TIME, SPAWN_SHIELD, START_GOLD, START_LIVES, CORE_HP, EXTRA_LIVES,
    DOT_SCORE, DOT_GOLD, GEM_SCORE, GEM_GOLD, EAT_CHAIN, ROCK_CHAIN, SELL_RATE,
    WAVES_PER_ROUND, FIRST_COUNTDOWN, WAVE_GAP, VEG_AFTER_DOTS, VEG_TIME, frightTime,
    ENEMIES, TOWERS, upgradeCost, towerValue,
} from './config.js';
import {
    World, DIRT, TUNNEL, OCC_NONE, OCC_ROCK, OCC_TOWER, OCC_CORE,
    DOT_NONE, DOT_PELLET, DOT_ORE, DOT_GEM, DX, DY, mulberry32,
} from './world.js';
import { sfx } from './audio.js';

const OPP = d => (d + 2) & 3;
const VEGGIES = ['carrot', 'turnip', 'mushroom', 'eggplant'];
const ENEMY_COLORS = {
    grub: '#ff5a3a', skitter: '#c060ff', drake: '#40e060', stalker: '#ffa030', borer: '#c0c0d8', king: '#ffd820',
};

export class Game {
    constructor(seed = 1) {
        this.seed = seed >>> 0;
        this.rand = mulberry32(this.seed ^ 0x9e3779b9);
        this.hi = 0;
        this.phase = 'idle';
        this.nextId = 1;
    }

    // ================================================================ lifecycle
    newGame() {
        this.score = 0;
        this.lives = START_LIVES;
        this.gold = START_GOLD;
        this.round = 1;
        this.coreHp = CORE_HP;
        this.lifeIdx = 0;
        this.time = 0;
        this.stats = { kills: 0, dots: 0, built: 0, leaks: 0, eaten: 0, crushed: 0, popped: 0, throws: 0 };
        this.seenTypes = new Set();
        this.startRound();
    }

    startRound() {
        this.world = new World();
        this.world.generate((this.seed + this.round * 7919) >>> 0);
        this.rocks = this.world.rocks.map(({ c, r }) => ({ c, r, y: r, state: 'idle', t: 0, crushed: 0 }));
        this.enemies = [];
        this.towers = [];
        this.shots = [];
        this.shells = [];
        this.bolts = [];
        this.parts = [];
        this.pops = [];
        this.rings = [];
        this.fires = [];
        this.wave = 0;
        this.waveActive = false;
        this.countdown = this.round === 1 ? FIRST_COUNTDOWN : WAVE_GAP + 4;
        this.queue = [];
        this.spawnT = 0;
        this.spawnSide = 0;
        this.fright = 0;
        this.eatChain = 0;
        this.roundDots = 0;
        this.vegGiven = false;
        this.veg = null;
        this.selected = null;
        this.buildType = null;
        this.player = this.makePlayer();
        this.playerField = null;
        this.playerFieldKey = '';
        this.shake = 0;
        this.coreFlash = 0;
        this.sndShoot = 0;
        this.sndDig = 0;
        this.phase = 'ready';
        this.phaseT = 2.4;
        this.banner = { text: 'ROUND ' + this.round, sub: 'READY!', t: 2.4, col: '#ffd820' };
    }

    makePlayer() {
        return {
            fx: PLAYER_START.c, fy: PLAYER_START.r, tx: PLAYER_START.c, ty: PLAYER_START.r, t: 0,
            x: PLAYER_START.c, y: PLAYER_START.r,
            dir: 0, face: 0, digging: false, moving: false, anim: 0,
            harpoon: null, pumpCd: 0,
            dead: false, deadT: 0, inv: SPAWN_SHIELD,
        };
    }

    gameOver(reason) {
        if (this.phase === 'gameover') return;
        this.phase = 'gameover';
        this.phaseT = 0;
        this.overReason = reason;
        this.buildType = null;
        this.selected = null;
        if (this.score > this.hi) { this.hi = this.score; this.newHi = true; } else this.newHi = false;
        sfx.gameOver();
    }

    // ================================================================ tick
    update(dt, inp) {
        this.time += dt;
        if (this.banner && this.banner.t > 0) this.banner.t -= dt;
        this.shake = Math.max(0, this.shake - dt * 18);
        this.coreFlash = Math.max(0, this.coreFlash - dt);

        if (this.phase === 'ready') {
            this.phaseT -= dt;
            if (this.phaseT <= 0) this.phase = 'play';
            this.updateParticles(dt);
            return;
        }
        if (this.phase === 'roundclear') {
            this.phaseT -= dt;
            this.updateParticles(dt);
            this.updateShots(dt);
            if (this.phaseT <= 0) {
                this.round++;
                this.coreHp = Math.min(CORE_HP, this.coreHp + 3);
                this.startRound();
            }
            return;
        }
        if (this.phase === 'gameover') {
            this.phaseT += dt;
            this.updateParticles(dt);
            return;
        }
        if (this.phase !== 'play') return;

        this.world.updateFields();
        this.updatePlayer(dt, inp);
        this.updateWaves(dt);
        this.updateEnemies(dt);
        this.updateTowers(dt);
        this.updateShots(dt);
        this.updateRocks(dt);
        this.updateVeg(dt);
        this.checkCollisions();
        if (this.fright > 0) {
            this.fright -= dt;
            if (this.fright <= 0) {
                this.fright = 0;
                for (const e of this.enemies) e.frightened = false;
            }
        }
        this.updateParticles(dt);
        this.enemies = this.enemies.filter(e => !e.dead);
        if (this.selected && !this.towers.includes(this.selected)) this.selected = null;
        if (this.coreHp <= 0) this.gameOver('core');
    }

    // ================================================================ scoring
    addScore(n) {
        this.score += n;
        while (this.lifeIdx < EXTRA_LIVES.length && this.score >= EXTRA_LIVES[this.lifeIdx]) {
            this.lifeIdx++;
            this.lives++;
            this.popup(this.player.x, this.player.y - 0.6, '1UP', '#5aff6a');
            sfx.extraLife();
        }
    }

    popup(x, y, text, col = '#ffffff') {
        this.pops.push({ x, y, text: String(text), life: 1.0, col });
    }

    burst(x, y, col, n = 10, speed = 3, size = 0.12) {
        for (let i = 0; i < n; i++) {
            const a = this.rand() * Math.PI * 2, s = speed * (0.3 + this.rand() * 0.9);
            this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + this.rand() * 0.4, max: 0.8, col, size, grav: 0 });
        }
    }

    debris(x, y, col, n = 4) {
        for (let i = 0; i < n; i++) {
            this.parts.push({
                x: x + (this.rand() - 0.5) * 0.5, y: y + (this.rand() - 0.5) * 0.5,
                vx: (this.rand() - 0.5) * 2.5, vy: -1 - this.rand() * 2,
                life: 0.35 + this.rand() * 0.25, max: 0.6, col, size: 0.09, grav: 9,
            });
        }
    }

    // ================================================================ player
    updatePlayer(dt, inp) {
        const p = this.player;
        if (p.dead) {
            p.deadT += dt;
            if (p.deadT >= RESPAWN_TIME) {
                if (this.lives <= 0) this.gameOver('lives');
                else this.player = this.makePlayer();
            }
            return;
        }
        if (p.inv > 0) p.inv -= dt;
        p.pumpCd -= dt;
        p.moving = false;
        const want = inp ? inp.dir : -1;
        const pumpHeld = !!(inp && (inp.pump || inp.pumpPressed));

        if (pumpHeld) {
            if (!p.harpoon) {
                // Turn in place to aim, then throw.
                if (want >= 0 && p.fx === p.tx && p.fy === p.ty) {
                    p.dir = want;
                    if (want === 0 || want === 2) p.face = want;
                }
                if (inp.pumpPressed || p.pumpCd <= 0) this.fireHarpoon();
            }
        } else if (p.harpoon && want >= 0) {
            p.harpoon = null;       // moving lets go of the line
        }

        if (p.harpoon) {
            this.updateHarpoon(dt, inp);
        } else if (!pumpHeld) {
            this.movePlayer(p, want, dt);
        }
        p.x = p.fx + (p.tx - p.fx) * p.t;
        p.y = p.fy + (p.ty - p.fy) * p.t;
    }

    movePlayer(p, want, dt) {
        const moving = p.fx !== p.tx || p.fy !== p.ty;
        if (!moving) {
            if (want < 0 || !this.tryStart(p, want)) return;
        } else {
            if (want < 0) return;                                  // stop where you stand
            if (want === OPP(p.dir)) this.reversePlayer(p);
            else if (want !== p.dir && p.t < 0.3 && !p.digging) this.reversePlayer(p); // turn at the cell just left
        }
        const sp = p.digging ? PLAYER_DIG_SPEED : PLAYER_SPEED;
        p.t += sp * dt;
        p.moving = true;
        p.anim += dt;
        if (p.digging) {
            this.sndDig -= dt;
            if (this.sndDig <= 0) {
                this.sndDig = 0.13;
                sfx.dig();
                const x = p.fx + (p.tx - p.fx) * p.t + DX[p.dir] * 0.4, y = p.fy + (p.ty - p.fy) * p.t + DY[p.dir] * 0.4;
                this.debris(x, y, ['#d89c48', '#c86c30', '#a84838', '#7a3864'][stratumOf(p.ty)], 3);
            }
        }
        if (p.t >= 1) {
            const over = (p.t - 1) / sp;
            this.arrivePlayer(p);
            if (want >= 0 && this.tryStart(p, want)) {
                p.t = Math.min(0.45, over * (p.digging ? PLAYER_DIG_SPEED : PLAYER_SPEED));
            }
        }
    }

    reversePlayer(p) {
        [p.fx, p.tx] = [p.tx, p.fx];
        [p.fy, p.ty] = [p.ty, p.fy];
        p.t = 1 - p.t;
        p.dir = OPP(p.dir);
        if (p.dir === 0 || p.dir === 2) p.face = p.dir;
        p.digging = false;
    }

    tryStart(p, d) {
        p.dir = d;
        if (d === 0 || d === 2) p.face = d;
        const nc = p.fx + DX[d], nr = p.fy + DY[d];
        const w = this.world;
        if (!w.inb(nc, nr)) return false;
        const i = w.idx(nc, nr);
        if (w.occ[i] !== OCC_NONE) return false;
        p.tx = nc; p.ty = nr; p.t = 0;
        p.digging = w.tile[i] === DIRT;
        return true;
    }

    arrivePlayer(p) {
        p.fx = p.tx; p.fy = p.ty; p.t = 0;
        const w = this.world;
        if (p.digging) {
            w.dig(p.fx, p.fy);
            p.digging = false;
        }
        this.collectDot(p.fx, p.fy);
    }

    collectDot(c, r) {
        const w = this.world, i = w.idx(c, r);
        const d = w.dot[i];
        if (d === DOT_NONE) return;
        w.dot[i] = DOT_NONE;
        this.stats.dots++;
        this.roundDots++;
        if (d === DOT_GEM) {
            this.addScore(GEM_SCORE);
            this.gold += GEM_GOLD;
            this.startFright();
        } else {
            this.addScore(DOT_SCORE);
            this.gold += DOT_GOLD;
            if (d === DOT_ORE) sfx.ore(); else sfx.pellet();
        }
    }

    startFright() {
        this.fright = frightTime(this.round);
        this.eatChain = 0;
        let any = false;
        for (const e of this.enemies) {
            if (e.dead || e.def.boss || e.ghost || e.fx < 0 || e.fx >= COLS) continue;
            e.frightened = true;
            e.state = 'walk';
            e.fireSpan = null;
            any = true;
            // Reverse on the spot, like the ghosts do.
            if (e.fx !== e.tx || e.fy !== e.ty) {
                [e.fx, e.tx] = [e.tx, e.fx]; [e.fy, e.ty] = [e.ty, e.fy];
                e.t = 1 - e.t; e.dir = OPP(e.dir);
                if (e.dir === 0 || e.dir === 2) e.face = e.dir;
            }
        }
        sfx.gem();
        this.banner = { text: 'POWER GEM!', sub: any ? 'EAT THEM!' : '', t: 1.2, col: '#4ff0ff' };
    }

    killPlayer() {
        const p = this.player;
        if (p.dead || p.inv > 0) return;
        p.dead = true;
        p.deadT = 0;
        p.harpoon = null;
        p.digging = false;
        this.lives--;
        this.shake = Math.max(this.shake, 6);
        this.buildType = null;
        sfx.die();
    }

    // ---------------------------------------------------------------- harpoon
    fireHarpoon() {
        const p = this.player;
        p.harpoon = { state: 'out', len: 0.2, target: null };
        this.stats.throws++;
        p.pumpCd = PUMP_REPEAT;
        sfx.harpoon();
    }

    updateHarpoon(dt, inp) {
        const p = this.player, h = p.harpoon, w = this.world;
        const px = p.fx + (p.tx - p.fx) * p.t, py = p.fy + (p.ty - p.fy) * p.t;
        if (h.state === 'out') {
            h.len += HARPOON_SPEED * dt;
            const tx = px + DX[p.dir] * h.len, ty = py + DY[p.dir] * h.len;
            for (const e of this.enemies) {
                if (e.dead || e.ghost || !this.onGrid(e)) continue;
                const reach = e.def.boss ? 0.95 : 0.5;
                if (Math.abs(e.x - tx) < reach && Math.abs(e.y - ty) < reach) {
                    h.state = 'attached';
                    h.target = e;
                    this.pumpEnemy(e);
                    return;
                }
            }
            const cc = Math.round(tx), cr = Math.round(ty);
            const own = (cc === p.fx && cr === p.fy) || (cc === p.tx && cr === p.ty);
            let blocked = !w.inb(cc, cr);
            if (!blocked && !own) {
                const i = w.idx(cc, cr);
                blocked = w.tile[i] === DIRT || w.occ[i] === OCC_ROCK || w.occ[i] === OCC_TOWER;
            }
            if (blocked || h.len >= HARPOON_REACH) h.state = 'in';
        } else if (h.state === 'in') {
            h.len -= 30 * dt;
            if (h.len <= 0) p.harpoon = null;
        } else if (h.state === 'attached') {
            const e = h.target;
            if (!e || e.dead) { h.state = 'in'; return; }
            h.len = Math.max(0.3, Math.abs(e.x - px) + Math.abs(e.y - py) - (e.def.boss ? 0.8 : 0.4));
            if (inp && (inp.pumpPressed || (inp.pump && p.pumpCd <= 0))) this.pumpEnemy(e);
        }
    }

    pumpEnemy(e) {
        const p = this.player;
        e.inflate += 1;
        e.pumpT = 0;
        p.pumpCd = PUMP_REPEAT;
        sfx.pump();
        if (e.inflate >= e.def.pumps) {
            this.killEnemy(e, 'pump');
            if (p.harpoon) p.harpoon.state = 'in';
        }
    }

    // ================================================================ waves
    buildWave(round, wave) {
        const gw = (round - 1) * WAVES_PER_ROUND + wave;
        const list = [];
        if (wave === WAVES_PER_ROUND) {
            const escorts = 3 + round;
            for (let i = 0; i < escorts; i++) list.push(i % 2 ? 'skitter' : 'grub');
            list.splice(2, 0, 'king');
            if (round >= 2) list.push('stalker', 'drake');
            if (round >= 3) list.push('borer');
        } else {
            const n = 5 + wave * 2 + (round - 1) * 3;
            const pool = [['grub', 5]];
            if (gw >= 2) pool.push(['skitter', 3]);
            if (gw >= 3) pool.push(['drake', 2]);
            if (gw >= 4) pool.push(['stalker', 1.6]);
            if (gw >= 5) pool.push(['borer', 1]);
            const total = pool.reduce((s, [, wgt]) => s + wgt, 0);
            for (let i = 0; i < n; i++) {
                let x = this.rand() * total;
                for (const [type, wgt] of pool) { x -= wgt; if (x <= 0) { list.push(type); break; } }
                if (list.length <= i) list.push('grub');
            }
            // Make sure the newest arrival actually shows up.
            const newest = pool[pool.length - 1][0];
            if (!list.includes(newest)) list[list.length - 1] = newest;
        }
        return {
            list,
            interval: Math.max(0.42, 1.25 - gw * 0.05),
            hpMul: 1 + (gw - 1) * 0.19 + (gw - 1) * (gw - 1) * 0.008,
        };
    }

    startWave() {
        this.wave++;
        const spec = this.buildWave(this.round, this.wave);
        this.queue = spec.list.slice();
        this.spawnInterval = spec.interval;
        this.hpMul = spec.hpMul;
        this.spawnT = 0.3;
        this.waveActive = true;
        const fresh = spec.list.find(t => !this.seenTypes.has(t));
        const boss = this.wave === WAVES_PER_ROUND;
        this.banner = {
            text: boss ? 'BOSS WAVE' : 'WAVE ' + this.wave,
            sub: fresh ? 'NEW: ' + ENEMIES[fresh].name : (boss ? 'THE KING COMES' : ''),
            t: 1.8, col: boss ? '#ff3a78' : '#ffd820',
        };
        spec.list.forEach(t => this.seenTypes.add(t));
        sfx.waveStart();
    }

    /** Skip the countdown; pays one gold per second skipped. */
    callWave() {
        if (this.phase !== 'play' || this.waveActive) return false;
        const bonus = Math.ceil(this.countdown);
        if (bonus > 0) {
            this.gold += bonus;
            this.popup(CORE.c, 0.2, '+' + bonus + ' GOLD', '#ffd820');
        }
        this.countdown = 0;
        return true;
    }

    updateWaves(dt) {
        if (!this.waveActive) {
            this.countdown -= dt;
            if (this.countdown <= 0) this.startWave();
            return;
        }
        if (this.queue.length) {
            this.spawnT -= dt;
            if (this.spawnT <= 0) {
                this.spawnT = this.spawnInterval;
                this.spawnEnemy(this.queue.shift(), this.spawnSide);
                this.spawnSide ^= 1;
            }
        } else if (this.enemies.every(e => e.dead)) {
            this.waveActive = false;
            if (this.wave >= WAVES_PER_ROUND) this.roundClear();
            else {
                this.countdown = WAVE_GAP;
                sfx.waveClear();
            }
        }
    }

    roundClear() {
        const bonus = this.coreHp * 200;
        this.addScore(bonus);
        let refund = 0;
        for (const t of this.towers) refund += Math.floor(towerValue(t.type, t.lvl) * SELL_RATE);
        this.gold += refund;
        this.phase = 'roundclear';
        this.phaseT = 4;
        this.banner = { text: 'ROUND CLEAR!', sub: 'CORE BONUS ' + bonus, t: 4, col: '#5aff6a', sub2: refund ? 'TOWER SALVAGE +' + refund : '' };
        sfx.roundClear();
    }

    // ================================================================ enemies
    spawnEnemy(type, side) {
        const def = ENEMIES[type];
        const s = SPAWNS[side];
        const hp = Math.round(def.hp * (this.hpMul || 1) * 10) / 10;
        const e = {
            id: this.nextId++, type, def, hp, maxHp: hp,
            fx: s.fromC, fy: s.r, tx: s.c, ty: s.r, t: 0, x: s.fromC, y: s.r,
            dir: s.dir, face: s.dir, ghost: false, digging: false, dead: false,
            inflate: 0, pumpT: 0, slow: 1, hitT: 0, anim: this.rand() * 2,
            frightened: false, chaseT: def.chase || 0,
            state: 'walk', stateT: 0, fireCd: 1.5,
        };
        this.enemies.push(e);
        return e;
    }

    onGrid(e) { return e.x > -0.5 && e.x < COLS - 0.5; }

    updateEnemies(dt) {
        const w = this.world;
        for (const e of this.enemies) {
            if (e.dead) continue;
            e.anim += dt;
            if (e.hitT > 0) e.hitT -= dt;
            if (e.chaseT > 0) e.chaseT -= dt;
            if (e.fireCd > 0) e.fireCd -= dt;
            const slow = e.slow; e.slow = 1;            // towers re-apply every frame

            if (e.inflate > 0) {
                e.pumpT += dt;
                const held = this.player.harpoon && this.player.harpoon.target === e;
                if (e.pumpT > (held ? 1.2 : 0.5)) {
                    e.inflate -= dt * 1.5;
                    if (e.inflate <= 0) e.inflate = 0;
                }
                continue;
            }

            if (e.state === 'charge') {
                e.stateT -= dt;
                if (e.stateT <= 0) {
                    e.state = 'fire';
                    e.stateT = 0.8;
                    sfx.fire();
                }
                continue;
            }
            if (e.state === 'fire') {
                e.stateT -= dt;
                const dir = e.face === 2 ? -1 : 1;
                e.fireSpan = [e.fx + dir * 0.5, e.fx + dir * 3.5];
                if (e.stateT <= 0) { e.state = 'walk'; e.fireCd = 3.6; e.fireSpan = null; }
                continue;
            }

            let sp = e.def.speed;
            if (e.type === 'stalker' && e.ghost) sp = e.def.ghostSpeed;
            if (e.type === 'borer' && e.digging) sp = e.def.digSpeed;
            if (e.frightened) sp *= 0.55;
            sp *= slow;
            e.t += sp * dt;
            let guard = 0;
            while (e.t >= 1 && guard++ < 3) {
                e.t -= 1;
                this.arriveEnemy(e);
                if (e.dead || e.state !== 'walk') { e.t = 0; break; }
                if (e.fx === e.tx && e.fy === e.ty) { e.t = 0; break; }
            }
            e.x = e.fx + (e.tx - e.fx) * e.t;
            e.y = e.fy + (e.ty - e.fy) * e.t;
            // Stalkers phase through dirt as a pair of eyes: untouchable, harmless.
            if (e.type === 'stalker') {
                const cc = Math.round(e.x), cr = Math.round(e.y);
                e.ghost = w.inb(cc, cr) && (w.tile[w.idx(cc, cr)] === DIRT);
            }
        }
    }

    arriveEnemy(e) {
        const w = this.world;
        e.fx = e.tx; e.fy = e.ty;
        e.x = e.fx; e.y = e.fy;
        if (e.digging) {
            w.dig(e.fx, e.fy);
            w.dot[w.idx(e.fx, e.fy)] = DOT_NONE;
            e.digging = false;
            this.debris(e.fx, e.fy, '#9a8676', 5);
        }
        if (e.fx === CORE.c && e.fy === CORE.r) {
            this.hitCore(e);
            return;
        }
        // Drakes stop and breathe fire along a row when the miner is in line.
        if (e.def.fire && !e.frightened && e.fireCd <= 0 && !this.player.dead) {
            const p = this.player;
            const pr = Math.round(p.y);
            if (pr === e.fy && Math.abs(p.x - e.fx) <= 4 && Math.abs(p.x - e.fx) >= 0.5) {
                e.face = p.x < e.fx ? 2 : 0;
                e.state = 'charge';
                e.stateT = 0.6;
                return;
            }
        }
        this.chooseNext(e);
    }

    chooseNext(e) {
        const w = this.world;
        const c = e.fx, r = e.fy;
        let field = null, cost = null;
        const walk = i => w.walkCost(i), dig = i => w.digCost(i), ghost = i => w.ghostCost(i);

        if (e.frightened) {
            // Flee: step to the neighbour farthest from the miner, never reversing unless cornered.
            const p = this.player;
            let best = -1, bs = -Infinity;
            for (let d = 0; d < 4; d++) {
                const nc = c + DX[d], nr = r + DY[d];
                if (!w.inb(nc, nr) || w.walkCost(w.idx(nc, nr)) === Infinity) continue;
                if (nc === CORE.c && nr === CORE.r) continue;
                let s = Math.abs(nc - p.x) + Math.abs(nr - p.y) + this.rand() * 0.8;
                if (d === OPP(e.dir)) s -= 3;
                if (s > bs) { bs = s; best = d; }
            }
            if (best >= 0) { this.setStep(e, best); return; }
            // Cornered (a borer mid-drill has no tunnel around it): carry on as normal.
        }

        if (e.type === 'stalker') {
            if (e.chaseT > 0 && !this.player.dead) {
                field = this.playerFieldNow();
            } else field = w.fields.ghost;
            cost = ghost;
        } else if (e.type === 'borer') {
            field = w.fields.dig; cost = dig;
        } else {
            field = w.fields.core; cost = walk;
            if (!w.inb(c, r) || field[w.idx(c, r)] === Infinity) { field = w.fields.dig; cost = dig; }
        }

        let best = -1, bv = Infinity;
        for (let d = 0; d < 4; d++) {
            const nc = c + DX[d], nr = r + DY[d];
            if (!w.inb(nc, nr)) continue;
            const j = w.idx(nc, nr);
            if (cost(j) === Infinity) continue;
            let v = field[j];
            if (v === Infinity) continue;
            v += this.rand() * 0.01 + (d === OPP(e.dir) ? 0.005 : 0);
            if (v < bv) { bv = v; best = d; }
        }
        this.setStep(e, best);
    }

    setStep(e, d) {
        if (d < 0) { e.tx = e.fx; e.ty = e.fy; return; }
        const w = this.world;
        e.dir = d;
        if (d === 0 || d === 2) e.face = d;
        e.tx = e.fx + DX[d]; e.ty = e.fy + DY[d];
        e.digging = e.type === 'borer' && w.tile[w.idx(e.tx, e.ty)] === DIRT;
    }

    playerFieldNow() {
        const p = this.player, w = this.world;
        const pc = Math.round(p.x), pr = Math.round(p.y);
        const key = pc + ',' + pr + ',' + w.version;
        if (key !== this.playerFieldKey) {
            this.playerField = w.fieldTo(pc, pr);
            this.playerFieldKey = key;
        }
        return this.playerField;
    }

    hitCore(e) {
        e.dead = true;
        this.coreHp = Math.max(0, this.coreHp - e.def.dmg);
        this.coreFlash = 0.5;
        this.shake = Math.max(this.shake, 5);
        this.stats.leaks++;
        this.burst(CORE.c, CORE.r, '#4ff0ff', 16, 4);
        this.popup(CORE.c, CORE.r - 0.8, '-' + e.def.dmg, '#ff3a78');
        sfx.coreHit();
    }

    hurt(e, dmg, quiet = false) {
        if (e.dead) return;
        if (e.def.armor) dmg = Math.max(dmg * 0.35, dmg - e.def.armor);
        e.hp -= dmg;
        if (!quiet) e.hitT = 0.07;
        if (e.hp <= 0) this.killEnemy(e, 'tower');
    }

    killEnemy(e, how) {
        if (e.dead) return 0;
        e.dead = true;
        this.stats.kills++;
        let pts = e.def.score, gold = e.def.gold;
        if (how === 'pump') {
            this.stats.popped++;
            pts = [200, 300, 400, 500][stratumOf(Math.max(1, Math.round(e.y)))];
            if (e.type === 'drake' && (this.player.dir === 0 || this.player.dir === 2)) pts *= 2;
            if (e.def.boss) pts = e.def.score * 2;
            gold += 1;
        } else if (how === 'eat') {
            this.stats.eaten++;
            pts = EAT_CHAIN[Math.min(this.eatChain, EAT_CHAIN.length - 1)];
            this.eatChain++;
            gold += 2;
            sfx.eat();
        } else if (how === 'rock') {
            this.stats.crushed++;
            pts = 0;
        }
        if (pts) {
            this.addScore(pts);
            this.popup(e.x, e.y - 0.3, pts, how === 'eat' ? '#4ff0ff' : '#ffffff');
        }
        this.gold += gold;
        const col = ENEMY_COLORS[e.type] || '#ffffff';
        this.burst(e.x, e.y, col, e.def.boss ? 40 : 12, e.def.boss ? 5 : 3.2);
        if (how === 'pump') { sfx.pop(); this.rings.push({ x: e.x, y: e.y, r: 0.2, grow: 3, life: 0.3, max: 0.3, col: '#ffffff' }); }
        else if (how === 'tower') sfx.kill();
        if (e.def.boss) this.shake = Math.max(this.shake, 8);
        const h = this.player.harpoon;
        if (h && h.target === e) h.state = 'in';
        return pts;
    }

    // ================================================================ collisions
    checkCollisions() {
        const p = this.player;
        if (p.dead) return;
        for (const e of this.enemies) {
            if (e.dead || e.ghost || !this.onGrid(e)) continue;
            const reach = e.def.boss ? 0.95 : 0.62;
            if (Math.abs(e.x - p.x) > reach || Math.abs(e.y - p.y) > reach) continue;
            if (e.frightened) { this.killEnemy(e, 'eat'); continue; }
            if (e.inflate > 0) continue;
            this.killPlayer();
            return;
        }
        // Dragon fire: a row of flame that passes through dirt.
        for (const e of this.enemies) {
            if (e.dead || e.state !== 'fire' || !e.fireSpan) continue;
            const [a, b] = e.fireSpan;
            if (Math.abs(p.y - e.fy) < 0.5 && p.x >= Math.min(a, b) - 0.3 && p.x <= Math.max(a, b) + 0.3) {
                this.killPlayer();
                return;
            }
        }
        if (this.veg && Math.abs(this.veg.c - p.x) < 0.6 && Math.abs(this.veg.r - p.y) < 0.6) {
            const pts = 500 + (this.round - 1) * 300;
            this.addScore(pts);
            this.gold += 10;
            this.popup(this.veg.c, this.veg.r - 0.4, pts, '#ff40a8');
            this.burst(this.veg.c, this.veg.r, '#ff40a8', 14, 3);
            sfx.veg();
            this.veg = null;
        }
    }

    // ================================================================ towers
    canBuild(c, r, type) {
        const w = this.world, p = this.player;
        if (!w.buildable(c, r)) return false;
        if (!p.dead && ((p.fx === c && p.fy === r) || (p.tx === c && p.ty === r))) return false;
        if (this.enemies.some(e => !e.dead && Math.round(e.x) === c && Math.round(e.y) === r)) return false;
        return type ? this.gold >= TOWERS[type].cost : true;
    }

    build(c, r, type) {
        if (this.phase !== 'play' && this.phase !== 'ready') return false;
        if (!this.canBuild(c, r, null) || this.gold < TOWERS[type].cost) { sfx.deny(); return false; }
        const w = this.world;
        this.gold -= TOWERS[type].cost;
        const i = w.idx(c, r);
        if (w.dot[i] === DOT_ORE) { w.dot[i] = DOT_NONE; this.gold += DOT_GOLD; this.addScore(DOT_SCORE); }
        w.setOcc(c, r, OCC_TOWER);
        const t = { type, c, r, lvl: 0, cd: 0.4, angle: -Math.PI / 2, spin: 0, flash: 0, target: null };
        this.towers.push(t);
        this.stats.built++;
        this.burst(c, r, TOWERS[type].color, 10, 2.5);
        sfx.build();
        return t;
    }

    upgrade(t) {
        if (!t || t.lvl >= 2) { sfx.deny(); return false; }
        const cost = upgradeCost(t.type, t.lvl);
        if (this.gold < cost) { sfx.deny(); return false; }
        this.gold -= cost;
        t.lvl++;
        this.burst(t.c, t.r, TOWERS[t.type].color, 14, 3);
        sfx.upgrade();
        return true;
    }

    sell(t) {
        if (!t) return false;
        const refund = Math.floor(towerValue(t.type, t.lvl) * SELL_RATE);
        this.gold += refund;
        this.world.setOcc(t.c, t.r, OCC_NONE);
        this.towers = this.towers.filter(x => x !== t);
        if (this.selected === t) this.selected = null;
        this.popup(t.c, t.r - 0.4, '+' + refund, '#ffd820');
        sfx.sell();
        return true;
    }

    towerAt(c, r) { return this.towers.find(t => t.c === c && t.r === r) || null; }

    /** A tap/click on the field: place, select, or clear. */
    tapCell(c, r) {
        if (this.phase !== 'play' && this.phase !== 'ready') return;
        if (this.buildType) {
            const ok = this.build(c, r, this.buildType);
            if (ok) this.buildType = null;
            return;
        }
        const t = this.towerAt(c, r);
        this.selected = t && t !== this.selected ? t : null;
        if (t) sfx.click();
    }

    chooseBuild(type) {
        this.selected = null;
        this.buildType = this.buildType === type ? null : type;
        sfx.click();
    }

    progressOf(e) {
        const w = this.world;
        const c = Math.max(0, Math.min(COLS - 1, Math.round(e.x))), r = Math.max(0, Math.min(ROWS - 1, Math.round(e.y)));
        return w.fields.ghost[w.idx(c, r)];
    }

    updateTowers(dt) {
        const targets = this.enemies.filter(e => !e.dead && !e.ghost && this.onGrid(e));
        for (const t of this.towers) {
            const L = TOWERS[t.type].levels[t.lvl];
            t.cd -= dt;
            t.flash = Math.max(0, t.flash - dt);
            t.spin += dt * (t.type === 'frost' ? 1.2 : 0);
            const r2 = L.range * L.range;
            if (t.type === 'frost') {
                for (const e of targets) {
                    const dx = e.x - t.c, dy = e.y - t.r;
                    if (dx * dx + dy * dy > r2) continue;
                    e.slow = Math.min(e.slow, L.slow);
                    this.hurt(e, L.dps * dt, true);
                }
                continue;
            }
            // Target the enemy closest to the core.
            let best = null, bp = Infinity;
            for (const e of targets) {
                if (e.dead) continue;
                const dx = e.x - t.c, dy = e.y - t.r;
                if (dx * dx + dy * dy > r2) continue;
                const pr = this.progressOf(e);
                if (pr < bp) { bp = pr; best = e; }
            }
            t.target = best;
            if (!best) continue;
            if (TOWERS[t.type].rotates) {
                const want = Math.atan2(best.y - t.r, best.x - t.c);
                let da = want - t.angle;
                while (da > Math.PI) da -= Math.PI * 2;
                while (da < -Math.PI) da += Math.PI * 2;
                t.angle += da * Math.min(1, dt * 14);
            }
            if (t.cd > 0) continue;
            t.cd = 1 / L.rate;
            t.flash = 0.08;
            if (t.type === 'blaster') {
                this.shots.push({ x: t.c + Math.cos(t.angle) * 0.4, y: t.r + Math.sin(t.angle) * 0.4, target: best, dmg: L.dmg, vx: 0, vy: 0, life: 1.2, col: '#ffe070' });
                if (this.sndShoot <= 0) { sfx.shoot(); this.sndShoot = 0.07; }
            } else if (t.type === 'arc') {
                const hit = [best];
                let cur = best;
                while (hit.length < L.chain) {
                    let nb = null, nd = 1.8 * 1.8;
                    for (const e of targets) {
                        if (e.dead || hit.includes(e)) continue;
                        const dx = e.x - cur.x, dy = e.y - cur.y, d2 = dx * dx + dy * dy;
                        if (d2 < nd) { nd = d2; nb = e; }
                    }
                    if (!nb) break;
                    hit.push(nb); cur = nb;
                }
                const pts = [t.c, t.r - 0.2];
                for (const e of hit) pts.push(e.x, e.y);
                this.bolts.push({ pts, life: 0.2, seed: this.rand() * 1000 });
                for (const e of hit) this.hurt(e, L.dmg);
                sfx.zap();
            } else if (t.type === 'boomer') {
                // Lead the target a little.
                const lead = 0.5;
                const ax = best.x + (best.tx - best.fx) * lead * best.def.speed * 0.5;
                const ay = best.y + (best.ty - best.fy) * lead * best.def.speed * 0.5;
                this.shells.push({ x0: t.c, y0: t.r, x1: ax, y1: ay, t: 0, dur: 0.55, dmg: L.dmg, splash: L.splash });
                sfx.lob();
            }
        }
        if (this.sndShoot > 0) this.sndShoot -= dt;
    }

    updateShots(dt) {
        for (const s of this.shots) {
            s.life -= dt;
            if (s.target && !s.target.dead) {
                const dx = s.target.x - s.x, dy = s.target.y - s.y;
                const d = Math.hypot(dx, dy);
                if (d < 0.3) { this.hurt(s.target, s.dmg); s.life = 0; continue; }
                s.vx = dx / d * 12; s.vy = dy / d * 12;
            }
            s.x += s.vx * dt; s.y += s.vy * dt;
        }
        this.shots = this.shots.filter(s => s.life > 0);

        for (const sh of this.shells) {
            sh.t += dt / sh.dur;
            if (sh.t >= 1) {
                const r2 = sh.splash * sh.splash;
                for (const e of this.enemies) {
                    if (e.dead || e.ghost) continue;
                    const dx = e.x - sh.x1, dy = e.y - sh.y1;
                    if (dx * dx + dy * dy <= r2) this.hurt(e, sh.dmg);
                }
                this.rings.push({ x: sh.x1, y: sh.y1, r: 0.2, grow: sh.splash * 2.5, life: 0.35, max: 0.35, col: '#ff6a3a' });
                this.burst(sh.x1, sh.y1, '#ff9a3a', 12, 3.5);
                this.shake = Math.max(this.shake, 2);
                sfx.boom();
            }
        }
        this.shells = this.shells.filter(s => s.t < 1);
        for (const b of this.bolts) b.life -= dt;
        this.bolts = this.bolts.filter(b => b.life > 0);
    }

    // ================================================================ rocks
    updateRocks(dt) {
        const w = this.world, p = this.player;
        for (const k of this.rocks) {
            if (k.state === 'idle') {
                if (!w.isTunnel(k.c, k.r + 1)) continue;
                const under = !p.dead && ((p.fx === k.c && p.fy === k.r + 1) || (p.tx === k.c && p.ty === k.r + 1));
                if (under) continue;
                k.state = 'wobble'; k.t = 0.6;
                sfx.rockWobble();
            } else if (k.state === 'wobble') {
                k.t -= dt;
                if (k.t <= 0) {
                    k.state = 'fall';
                    w.setOcc(k.c, k.r, OCC_NONE);
                    w.dig(k.c, k.r);
                    w.dot[w.idx(k.c, k.r)] = DOT_NONE;
                }
            } else if (k.state === 'fall') {
                k.y += 8 * dt;
                // Crush anything under it.
                for (const e of this.enemies) {
                    if (e.dead || e.ghost) continue;
                    if (Math.abs(e.x - k.c) < 0.7 && e.y - k.y > -0.2 && e.y - k.y < 0.85) {
                        if (e.def.boss) { if (!e.rockHit) { e.rockHit = true; this.hurt(e, 60); } }
                        else { this.killEnemy(e, 'rock'); k.crushed++; }
                    }
                }
                if (!p.dead && Math.abs(p.x - k.c) < 0.6 && p.y - k.y > -0.2 && p.y - k.y < 0.8) this.killPlayer();
                const below = Math.floor(k.y) + 1;
                const free = below < ROWS && w.isTunnel(k.c, below) && w.occ[w.idx(k.c, below)] === OCC_NONE;
                if (!free) {
                    k.y = Math.floor(k.y);
                    k.state = 'crumble'; k.t = 0.5;
                    this.shake = Math.max(this.shake, 3);
                    sfx.rockLand();
                    this.debris(k.c, k.y + 0.3, '#9a8676', 8);
                    if (k.crushed > 0) {
                        const pts = ROCK_CHAIN[Math.min(k.crushed, ROCK_CHAIN.length) - 1];
                        this.addScore(pts);
                        this.gold += 3 * k.crushed;
                        this.popup(k.c, k.y - 0.5, pts, '#ffd820');
                    }
                }
            } else if (k.state === 'crumble') {
                k.t -= dt;
                if (k.t <= 0) k.state = 'gone';
            }
        }
        this.rocks = this.rocks.filter(k => k.state !== 'gone');
    }

    // ================================================================ bonus veggie
    updateVeg(dt) {
        if (!this.vegGiven && this.roundDots >= VEG_AFTER_DOTS) {
            this.vegGiven = true;
            this.veg = { c: PLAYER_START.c, r: PLAYER_START.r, t: VEG_TIME, kind: VEGGIES[(this.round - 1) % VEGGIES.length] };
        }
        if (this.veg) {
            this.veg.t -= dt;
            if (this.veg.t <= 0) this.veg = null;
        }
    }

    // ================================================================ fx
    updateParticles(dt) {
        for (const q of this.parts) {
            q.life -= dt;
            q.vy += q.grav * dt;
            q.x += q.vx * dt; q.y += q.vy * dt;
            q.vx *= 0.96; q.vy *= q.grav ? 1 : 0.96;
        }
        this.parts = this.parts.filter(q => q.life > 0);
        if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
        for (const q of this.pops) { q.life -= dt; q.y -= dt * 0.8; }
        this.pops = this.pops.filter(q => q.life > 0);
        for (const q of this.rings) { q.life -= dt; q.r += q.grow * dt; }
        this.rings = this.rings.filter(q => q.life > 0);
    }
}
