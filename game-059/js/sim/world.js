/**
 * world.js — one stage of the game, simulated at a fixed 60 Hz.
 *
 * No three.js and no DOM in here, so dev/simtest.mjs can play every stage in
 * Node with the bot. The view reads world state each frame and drains
 * world.events (sparks, sounds, banners, dialogue requests).
 *
 * Flow inside a stage: the camera scrolls with Juno until she reaches an
 * event's x. A 'wave' event locks the screen, spawns its waves one after
 * another, and releases it (GO →) when they're all down. A 'dialog' event
 * pauses the world until the UI calls resume(). The 'boss' event locks the
 * last screen; beating the boss clears the stage.
 */

import { makeRng } from './rng.js';
import { makeFighter, stepFighter, startMove, setState, activeBox, overlaps, applyHit, canBeHit, knock, damage, isFree, resetIds } from './fighter.js';
import { PLAYER_DEF, applyProfile } from './moves.js';
import { initPlayer, controlPlayer } from './player.js';
import { ENEMIES, thinkEnemy } from './enemies.js';
import { BOSSES, thinkBoss } from './bosses.js';
import { ITEMS, DROP_TABLE, PROPS, PROJ, DIFFICULTY } from './items.js';
import { LEVELS } from './levels.js';
import { GRUNT_NAMES } from '../art/chars.js';

export const STEP = 1 / 60;
const RANK = { easy: 0, normal: 1, hard: 2 };

export class World {
    constructor(opts) {
        resetIds();
        this.stageIndex = opts.stage;
        this.level = LEVELS[opts.stage];
        this.mode = opts.mode || 'story';      // story | arcade | bossrush | survival | demo
        this.diff = DIFFICULTY[opts.difficulty || 'normal'];
        this.rng = makeRng(opts.seed ?? 20890);
        this.profile = opts.profile;
        this.viewW = opts.viewW || 400;
        this.t = 0; this.events = []; this.paused = false;
        this.fighters = []; this.items = []; this.props = []; this.projs = []; this.hazards = [];
        this.zMin = this.level.zMin ?? 0; this.zMax = this.level.zMax ?? 66;
        this.length = this.level.length;
        this.camX = this.viewW / 2; this.lock = null; this.evIdx = 0;
        this.tokensMax = this.diff.tokens; this.tokensUsed = 0;
        this.stats = { time: 0, kos: 0, maxCombo: 0, dmgTaken: 0, specials: 0, items: 0, cred: 0, hits: 0 };
        this.combo = 0; this.comboT = 0;
        this.score = this.profile.score || 0;
        this.lives = this.profile.lives ?? this.diff.lives;
        this.nextLifeAt = (Math.floor(this.score / 50000) + 1) * 50000;
        this.timeScale = 1; this.slowT = 0; this.freezeT = 0;
        this.boss = null; this.state = 'play';   // play | bossDown | clear | respawn | gameover
        this.stateT = 0; this.pendingBoss = null; this.assist = null;
        this.uid = 100000;
        this.survivalWave = 0;

        const asMika = this.profile.character === 'mika';
        const p = makeFighter({ ...PLAYER_DEF, sprite: asMika ? 'mika' : 'juno' }, { team: 'player', x: 60, z: (this.zMin + this.zMax) / 2, face: 1 });
        p.basePal = asMika ? 'freed' : 'base'; p.pal = p.basePal;
        if (asMika) p.name = 'MIKA';
        applyProfile(p, this.profile);
        p.hp = p.maxHp;
        initPlayer(p);
        if (this.profile.character === 'mika') { p.speed *= 1.08; p.dmgMul *= 0.94; p.energyRegen *= 1.3; }
        this.player = p;
        this.fighters.push(p);

        for (const pr of this.level.props || []) this.addProp(pr);
        for (const hz of this.level.hazards || []) this.addHazard({ ...hz });
        if (this.mode === 'bossrush') this.setupBossRush();
        if (this.mode === 'survival') this.setupSurvival();
        this.updateCamera(1);
    }

    get camL() { return this.camX - this.viewW / 2; }
    get camR() { return this.camX + this.viewW / 2; }
    emit(e) { this.events.push(e); }
    drainEvents() { const e = this.events; this.events = []; return e; }
    setViewWidth(w) { this.viewW = w; }
    resume() { this.paused = false; }

    // ------------------------------------------------------------ main step
    step(dt, inp) {
        if (this.paused) return;
        if (this.freezeT > 0) { this.freezeT -= dt; return; }
        if (this.slowT > 0) { this.slowT -= dt; this.timeScale = 0.3; if (this.slowT <= 0) this.timeScale = 1; }
        dt *= this.timeScale;
        this.t += dt;
        if (this.state === 'play' || this.state === 'respawn') this.stats.time += dt;

        const p = this.player;
        this.triggerEvents();
        if (this.lock) this.stepLock(dt);
        if (this.state === 'respawn') this.stepRespawn(dt);

        // control
        if (p.state !== 'dead' && this.state !== 'clear') {
            if (p.state === 'grabbed' && inp && (inp.atk || inp.jump || inp.spec)) {
                p.mash = (p.mash || 0) + 1;
                if (p.mash >= 6 && p.grabbedBy) { const g = p.grabbedBy; g.grab = null; setState(g, 'hurt', 'hurt'); g.stun = 0.4; p.grabbedBy = null; setState(p, 'idle', 'idle'); p.invuln = 0.5; p.mash = 0; this.emit({ t: 'banner', text: 'ESCAPED!', kind: 'small' }); }
            }
            controlPlayer(this, p, inp || {}, dt);
        } else if (this.state === 'clear' && isFree(p)) { p.vx = p.vz = 0; if (p.anim !== 'victory') { p.anim = 'victory'; p.animT = 0; } }

        for (const f of this.fighters) {
            if (f.team === 'enemy' && f.hitstop <= 0) {
                if (f.boss) thinkBoss(this, f, dt); else thinkEnemy(this, f, dt);
            } else if (f.ally) this.thinkAlly(f, dt);
        }
        for (const f of this.fighters) stepFighter(this, f, dt);
        if (p.state === 'fall' && p.weapon) this.dropWeapon(p);

        this.resolveHits();
        this.stepProjectiles(dt);
        this.stepHazards(dt);
        this.stepItems(dt);
        this.stepProps(dt);
        this.stepAssist(dt);

        // bounds
        const L = Math.max(8, this.camL + 10), R = Math.min(this.length - 8, this.camR - 10);
        if (p.state !== 'dead') p.x = Math.max(L, Math.min(R, p.x));
        for (const f of this.fighters) if (f.team === 'enemy' && f.state === 'fall') f.x = Math.max(this.camL - 40, Math.min(this.camR + 40, f.x));

        // cleanup
        const before = this.fighters.length;
        this.fighters = this.fighters.filter((f) => { if (f.remove && f.token) this.releaseToken(f); return !f.remove; });
        if (this.fighters.length !== before) this.tokensUsed = this.fighters.filter((f) => f.token).length;

        if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { if (this.combo >= 5) this.emit({ t: 'comboEnd', n: this.combo }); this.combo = 0; } }
        this.updateCamera(dt);

        if (this.state === 'bossDown') {
            this.stateT += dt / Math.max(0.3, this.timeScale);
            if (this.stateT > 2.4) this.finishBoss();
        }
        if (this.score >= this.nextLifeAt) { this.nextLifeAt += 50000; this.lives++; this.emit({ t: 'extraLife' }); this.emit({ t: 'sfx', id: 'oneup' }); }
    }

    // ------------------------------------------------------------ camera
    updateCamera(dt) {
        const p = this.player, half = this.viewW / 2;
        let target;
        if (this.lock) target = this.lock.camX;
        else target = Math.max(half, Math.min(this.length - half, p.x + p.face * 18));
        const k = Math.min(1, dt * 4);
        const next = this.camX + (target - this.camX) * k;
        this.camX = this.lock ? next : Math.max(this.camX, next);
        this.camX = Math.max(half, Math.min(this.length - half, this.camX));
    }

    // ------------------------------------------------------------ events
    triggerEvents() {
        const evs = this.level.events;
        if (this.mode === 'bossrush' || this.mode === 'survival') return;
        while (this.evIdx < evs.length && !this.lock && this.state === 'play') {
            const ev = evs[this.evIdx];
            const reach = ev.t === 'spawn' || ev.t === 'hazard' ? this.camR + 10 : this.player.x;
            if (reach < ev.x) break;
            this.evIdx++;
            this.fireEvent(ev);
            if (this.paused) break;
        }
    }

    fireEvent(ev) {
        switch (ev.t) {
            case 'dialog':
                if (this.mode === 'story') { this.paused = true; this.emit({ t: 'dialog', id: ev.id }); }
                break;
            case 'banner': this.emit({ t: 'banner', text: ev.text, kind: ev.kind || 'big' }); break;
            case 'wave': this.startLock(ev); break;
            case 'spawn': for (const s of ev.spawns) this.queueSpawn(s, null); break;
            case 'hazard': this.scheduleHazard(ev); break;
            case 'boss': this.startBoss(ev); break;
            case 'item': this.dropItem(ev.item, ev.ix ?? ev.x, ev.z ?? (this.zMin + this.zMax) / 2); break;
            case 'end': this.stageClear(); break;
            default: break;
        }
    }

    startLock(ev) {
        const half = this.viewW / 2;
        const camX = Math.max(half, Math.min(this.length - half, ev.cam ?? Math.max(this.camX, this.player.x)));
        this.lock = { ev, wave: 0, camX, t: 0, lastWave: -99, pending: [], id: ++this.uid, boss: false };
        this.emit({ t: 'lock' });
    }

    stepLock(dt) {
        const L = this.lock;
        L.t += dt;
        for (const s of L.pending) s.delay -= dt;
        const ready = L.pending.filter((s) => s.delay <= 0);
        L.pending = L.pending.filter((s) => s.delay > 0);
        for (const s of ready) this.spawnEnemy(s.e, s.s, { ...s.o, lockId: L.id });
        const alive = this.fighters.filter((f) => f.team === 'enemy' && f.tags.lockId === L.id && f.state !== 'dead').length;
        const waves = L.ev.waves || [];
        if (L.wave < waves.length && L.pending.length === 0 && (L.wave === 0 || alive <= (L.ev.carry ?? 1)) && L.t - L.lastWave > 1.2) {
            const list = waves[L.wave];
            let d = 0;
            for (const spec of list) {
                const [e, s, o = {}] = spec;
                if (o.min && RANK[o.min] > this.diff.rank) continue;
                L.pending.push({ e, s, o, delay: (o.delay ?? d) });
                d += 0.35;
            }
            L.wave++; L.lastWave = L.t;
            if (L.wave > 1) this.emit({ t: 'sfx', id: 'waveIn' });
        }
        if (!L.boss && L.wave >= waves.length && L.pending.length === 0 && alive === 0 && L.t > 0.6) {
            this.lock = null;
            this.emit({ t: 'go' });
        }
    }

    queueSpawn(spec, lockId) {
        const [e, s, o = {}] = spec;
        if (o.min && RANK[o.min] > this.diff.rank) return;
        this.spawnEnemy(e, s, { ...o, lockId });
    }

    spawnEnemy(type, side = 'R', o = {}) {
        const def = ENEMIES[type];
        if (!def) return null;
        const half = this.viewW / 2;
        let x, y = 0, z = o.z ?? this.rng.range(this.zMin + 4, this.zMax - 4);
        if (side === 'L') x = this.camL - 30 - this.rng() * 30;
        else if (side === 'R') x = this.camR + 30 + this.rng() * 30;
        else x = o.x ?? (this.camX + this.rng.range(-half * 0.6, half * 0.6));
        if (side === 'T') y = 220;
        if (o.x !== undefined && side !== 'L' && side !== 'R') x = o.x;
        const pal = o.pal || this.rng.pick(def.variants || ['base']);
        const names = GRUNT_NAMES[type] || [def.name];
        const f = makeFighter(def, { team: 'enemy', x, y, z, face: x < this.player.x ? 1 : -1, pal, name: this.rng.pick(names), tags: { lockId: o.lockId } });
        f.moves = def.moves || {};
        f.maxHp = f.hp = Math.round(def.hp * this.diff.enemyHp * (o.hpMul || 1) * (pal === 'elite' || pal === 'gold' ? 1.4 : 1));
        if (pal === 'elite' || pal === 'gold') f.dmgMul = 1.25;
        f.hy0 = def.hy0 || 0;
        if (side === 'T') { setState(f, 'jump', 'jump'); f.dropIn = true; f.vy = -100; }
        if (def.flying) f.y = side === 'T' ? 200 : def.alt;
        this.fighters.push(f);
        return f;
    }

    // ------------------------------------------------------------ bosses
    startBoss(ev) {
        const half = this.viewW / 2;
        const camX = Math.max(half, Math.min(this.length - half, ev.cam ?? (this.length - half)));
        this.lock = { ev: { waves: ev.minions ? [ev.minions] : [] }, wave: 0, camX, t: 0, lastWave: -99, pending: [], id: ++this.uid, boss: true };
        this.spawnBoss(ev.id, ev.entrance);
        if (this.mode === 'story' && ev.dialog) { this.paused = true; this.emit({ t: 'dialog', id: ev.dialog, boss: ev.id }); }
        this.emit({ t: 'bossIntro', id: ev.id, name: BOSSES[ev.id].name, title: BOSSES[ev.id].title });
        if (ev.assist) this.assist = { cd: 9 };
    }

    spawnBoss(id, entrance = 'R') {
        const def = BOSSES[id];
        const cx = this.lock ? this.lock.camX : this.camX;
        const x = entrance === 'L' ? cx - this.viewW / 2 + 60 : entrance === 'C' ? cx + 40 : cx + this.viewW / 2 - 60;
        const b = makeFighter(def, { team: 'enemy', x, z: (this.zMin + this.zMax) / 2, face: -1, name: def.name });
        b.moves = def.moves;
        b.maxHp = b.hp = Math.round(def.hp * this.diff.enemyHp * (this.mode === 'bossrush' ? 0.8 : 1));
        b.dmgMul = this.diff.rank === 2 ? 1.15 : 1;
        if (entrance === 'T' || entrance === 'C') { b.y = 240; setState(b, 'jump', 'jump'); b.dropIn = true; b.vy = -60; }
        if (def.flying) { b.y = def.alt; }
        b.anim = def.idleAnim || 'idle';
        b.ai.cd = 1.4;
        this.boss = b;
        this.fighters.push(b);
        return b;
    }

    finishBoss() {
        const b = this.boss;
        const id = b && b.def === BOSSES.magnus ? 'magnus' : null;
        if (id === 'magnus' && !this.pendingBoss) {
            // Magnus transforms instead of falling
            this.pendingBoss = 'magnus2';
            this.state = 'play'; this.stateT = 0;
            this.fighters = this.fighters.filter((f) => f !== b);
            if (this.mode === 'story') { this.paused = true; this.emit({ t: 'dialog', id: 's7_ascend' }); }
            this.emit({ t: 'flashScreen', color: 'gold' });
            this.lock = { ev: { waves: [] }, wave: 0, camX: this.camX, t: 0, lastWave: -99, pending: [], id: ++this.uid, boss: true };
            const nb = this.spawnBoss('magnus2', 'C');
            this.emit({ t: 'bossIntro', id: 'magnus2', name: nb.def.name, title: nb.def.title });
            this.assist = { cd: 8 };
            return;
        }
        if (this.mode === 'bossrush' && this.bossQueue && this.bossQueue.length) { this.nextRushBoss(); return; }
        this.stageClear();
    }

    stageClear() {
        if (this.state === 'clear') return;
        this.state = 'clear'; this.lock = null;
        const p = this.player;
        if (isFree(p)) { p.anim = 'victory'; p.animT = 0; }
        this.emit({ t: 'stageClear' });
    }

    // ------------------------------------------------------------ boss rush / survival
    setupBossRush() {
        this.bossQueue = ['jackhammer', 'viper', 'oni', 'bulwark', 'goliath', 'mika', 'magnus'];
        this.nextRushBoss();
    }
    nextRushBoss() {
        const id = this.bossQueue.shift();
        this.state = 'play'; this.stateT = 0; this.pendingBoss = null;
        this.fighters = this.fighters.filter((f) => f.team === 'player');
        this.lock = { ev: { waves: [] }, wave: 0, camX: this.camX, t: 0, lastWave: -99, pending: [], id: ++this.uid, boss: true };
        this.spawnBoss(id, 'R');
        this.emit({ t: 'bossIntro', id, name: BOSSES[id].name, title: BOSSES[id].title });
        if (this.player.hp < this.player.maxHp) this.dropItem('bento', this.camX, (this.zMin + this.zMax) / 2);
    }
    setupSurvival() {
        this.lock = { ev: { waves: [] }, wave: 0, camX: this.camX, t: 0, lastWave: -99, pending: [], id: ++this.uid, boss: true };
        this.survivalT = 2;
    }
    stepSurvival(dt) {
        if (this.mode !== 'survival' || this.state !== 'play') return;
        const alive = this.fighters.filter((f) => f.team === 'enemy' && f.state !== 'dead').length;
        this.survivalT -= dt;
        if (alive === 0 && this.survivalT <= 0) {
            this.survivalWave++;
            const n = this.survivalWave;
            const pool = ['punk', 'punk', 'knifer', 'gunner', 'guard'];
            if (n > 2) pool.push('bruiser', 'ninja');
            if (n > 4) pool.push('ripper', 'synth', 'drone');
            if (n > 6) pool.push('husk', 'mine', 'synth');
            const count = Math.min(9, 2 + Math.floor(n * 0.8));
            for (let k = 0; k < count; k++) this.spawnEnemy(this.rng.pick(pool), this.rng() < 0.5 ? 'L' : 'R', { hpMul: 1 + n * 0.05, pal: n > 8 && this.rng() < 0.3 ? undefined : undefined });
            this.emit({ t: 'banner', text: `WAVE ${n}`, kind: 'big' });
            if (n % 3 === 0) this.dropItem(this.rng() < 0.5 ? 'bento' : 'cell', this.camX + this.rng.range(-60, 60), (this.zMin + this.zMax) / 2);
            if (n % 5 === 0) this.dropItem(this.rng.pick(['katana', 'pipe', 'baton', 'knives']), this.camX, this.zMin + 10);
            this.survivalT = 2.5;
        }
    }

    // ------------------------------------------------------------ tokens
    takeToken(e) {
        if (e.token) return true;
        if (this.tokensUsed >= this.tokensMax + (this.boss ? 0 : 0)) return false;
        e.token = true; this.tokensUsed++;
        return true;
    }
    releaseToken(e) { if (e.token) { e.token = false; this.tokensUsed = Math.max(0, this.tokensUsed - 1); } }

    // ------------------------------------------------------------ combat hooks
    resolveHits() {
        for (const a of this.fighters) {
            const box = activeBox(a);
            if (!box) continue;
            const mv = a.move;
            for (const t of this.fighters) {
                if (t === a || t.team === a.team || !canBeHit(t)) continue;
                if (t.state === 'grabbed' && t.grabbedBy !== a) continue;
                if (a.grab && t === a.grab && !mv.grabMove) continue;
                if (t.ally) continue;
                if (!overlaps(box, t)) continue;
                const last = a.hits.get(t.id);
                if (last !== undefined && (!mv.rehit || a.mt - last < mv.rehit)) continue;
                a.hits.set(t.id, a.mt);
                if (mv.grab) { this.enemyGrab(a, t); continue; }
                const dir = box.aoe ? (t.x >= a.x ? 1 : -1) : a.face;
                const r = applyHit(this, a, t, mv, dir);
                if (r === 'hit' || r === 'armor') {
                    a.hitLanded = true; a.lastHit = true;
                    if (mv.onHitLanded) mv.onHitLanded(this, a, t);
                }
            }
            if (a.team === 'player') {
                for (const pr of this.props) {
                    if (pr.broken || pr.hitBy === a.mt + a.id * 1000 || a.hits.has('p' + pr.id)) continue;
                    if (Math.abs(pr.z - a.z) > box.z + 4) continue;
                    if (box.x1 < pr.x - pr.w || box.x0 > pr.x + pr.w || box.y0 > pr.h + 22) continue;
                    a.hits.set('p' + pr.id, a.mt);
                    this.hitProp(pr, a.team, box.aoe ? (pr.x >= a.x ? 1 : -1) : a.face);
                }
            }
        }
    }

    onHitLanded(a, t, dmg, mv) {
        if (a.team === 'player' && t.team === 'enemy') {
            this.combo++; this.comboT = 1.5; this.stats.hits++;
            if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
            this.score += 10 * Math.min(this.combo, 40) + dmg * 5;
            const p = this.player;
            if (a === p || a.kind !== 'fighter') this.addMeter(p, dmg * 1.25);
            if (a === p && mv.weaponHit && p.weapon) {
                p.weapon.uses--;
                if (p.weapon.uses <= 0) { this.emit({ t: 'weaponBreak', type: p.weapon.type, x: p.x, y: p.y + 50, z: p.z }); p.weapon = null; }
            }
            if (t.boss && t.def === BOSSES.mika) t.ai.recentHits = (t.ai.recentHits || 0) + 1;
            this.emit({ t: 'combo', n: this.combo });
        }
        if (t.team === 'player' && t.ai) this.combo = Math.max(0, this.combo);
    }

    addMeter(p, amount) {
        if (!p || p.team !== 'player' || p.od > 0 || p.meter === undefined) return;
        const before = p.meter;
        p.meter = Math.min(100, p.meter + amount * (p.odGain || 1) * 0.55);
        if (before < 100 && p.meter >= 100) { this.emit({ t: 'odReady' }); this.emit({ t: 'sfx', id: 'ready' }); }
    }

    startOverdrive(p) {
        p.od = p.odDur || 8; p.pal = 'od';
        p.energy = p.maxEnergy;
        this.emit({ t: 'odStart' }); this.emit({ t: 'banner', text: 'OVERDRIVE', kind: 'od' });
    }

    onKO(t, srcTeam) {
        if (t.team === 'enemy') {
            this.stats.kos++;
            this.score += (t.def.score || 100) * (this.diff.rank + 1);
            if (t.token) this.releaseToken(t);
            this.emit({ t: 'ko', id: t.id, boss: !!t.boss, x: t.x, z: t.z });
            if (t.def === ENEMIES.mine) { this.explodeMine(t); return; }
            const [c0, c1] = t.def.cred || [0, 0];
            if (c1 > 0 && this.rng() < 0.55) this.dropItem(this.rng() < 0.2 ? 'stack' : 'chip', t.x, t.z, Math.round(this.rng.range(c0, c1)));
            if (t.boss) this.onBossKO(t);
        }
    }

    onBossKO(b) {
        if (b !== this.boss) return;
        this.state = 'bossDown'; this.stateT = 0; this.slowT = 1.2;
        this.emit({ t: 'bossDown', id: b.id, final: b.def === BOSSES.magnus2 });
        this.emit({ t: 'flashScreen', color: 'white' });
        // minions flee / drop
        for (const f of this.fighters) if (f.team === 'enemy' && f !== b && f.state !== 'dead') { f.hp = 0; f.ko = true; knock(f, f.x < b.x ? -1 : 1, 160, 260); }
        this.lock = null;
    }

    onDeath(f) {
        if (f.team !== 'player') return;
        if (f.ally) { f.remove = true; return; }
        this.lives--;
        this.emit({ t: 'playerDown', lives: this.lives });
        this.state = 'respawn'; this.stateT = 0;
        if (f.weapon) this.dropWeapon(f);
    }

    stepRespawn(dt) {
        this.stateT += dt;
        const p = this.player;
        if (this.stateT < 1.3) return;
        if (this.lives <= 0) {
            if (this.state !== 'gameover') { this.state = 'gameover'; this.paused = true; this.emit({ t: 'gameOver' }); }
            return;
        }
        this.respawnPlayer();
    }

    respawnPlayer() {
        const p = this.player;
        p.hp = p.maxHp; p.ko = false; p.energy = p.maxEnergy;
        p.x = this.camX - this.viewW * 0.15; p.z = (this.zMin + this.zMax) / 2; p.y = 200;
        setState(p, 'jump', 'jump'); p.vy = -50; p.vx = 0; p.invuln = 2.6; p.dropIn = true;
        p.grabbedBy = null; p.grab = null;
        this.state = 'play'; this.stateT = 0;
        this.respawnBlast = true;
        this.emit({ t: 'respawn' });
    }

    /** Continue after GAME OVER: fresh lives, same spot. */
    continueGame() {
        this.lives = this.diff.lives;
        this.score = 0;
        this.paused = false;
        this.respawnPlayer();
    }

    enemyGrab(e, p) {
        if (p.state === 'attack' || p.y > 4 || p.state === 'grabbed' || p.state === 'fall') return;
        if (p.grab) { p.grab.grabbedBy = null; setState(p.grab, 'idle', 'idle'); p.grab = null; }
        setState(p, 'grabbed', 'grabbed'); p.grabbedBy = e; p.mash = 0;
        setState(e, 'grabbing', 'grab'); e.grab = p; e.grabT = 2;
        this.emit({ t: 'sfx', id: 'grab', x: e.x });
        this.emit({ t: 'banner', text: 'MASH TO ESCAPE!', kind: 'small' });
    }

    tryGrab(p, dir) {
        if (p.weapon) return false;
        for (const e of this.fighters) {
            if (e.team !== 'enemy' || e.def.noGrab || e.boss || !canBeHit(e) || e.y > 2) continue;
            if (!(e.state === 'hurt' || e.state === 'idle' || e.state === 'walk' || e.state === 'dizzy' || e.state === 'block')) continue;
            if (Math.abs(e.z - p.z) > 7) continue;
            const dx = e.x - p.x;
            if (Math.sign(dx) !== dir || Math.abs(dx) > p.w + e.w + 6) continue;
            if (e.state !== 'hurt' && e.blocking) continue;
            setState(p, 'grabbing', 'grab'); p.grab = e; p.grabT = 1.6; p.grabHits = 0; p.face = dir;
            if (e.token) this.releaseToken(e);
            e.blocking = false;
            setState(e, 'grabbed', 'grabbed'); e.grabbedBy = p; e.face = -dir;
            if (e.state === 'attack') e.move = null;
            this.emit({ t: 'sfx', id: 'grab', x: p.x });
            return true;
        }
        return false;
    }

    throwGrabbed(a, dir, dmg) {
        const t = a.grab;
        if (!t) return;
        a.grab = null; t.grabbedBy = null;
        const back = dir < 0;
        if (back) t.x = a.x - a.face * 16;
        setState(t, 'fall', 'spin');
        t.vx = (back ? -a.face * 170 : a.face * 240) / Math.max(1, t.weight * 0.8);
        t.vy = back ? 340 : 280;
        t.thrown = a.team; t.thrownHits = new Set();
        t.throwDmg = (dmg ?? (back ? 18 : 14)) * (a.dmgMul || 1) * (t.team === 'player' ? this.diff.dmgTaken * (t.armorMul || 1) : 1);
        t.face = back ? a.face : -a.face;
        t.bounce = 0;
        this.emit({ t: 'sfx', id: 'throw', x: a.x });
        if (a.team === 'player') { this.score += 300; this.addMeter(a, 10); }
    }

    aoe(src, o) {
        const team = o.team || src.team;
        let any = false;
        for (const t of this.fighters) {
            if (t === src || t.ally) continue;
            if (team !== 'neutral' && t.team === team) continue;
            if (!canBeHit(t)) continue;
            if (Math.abs(t.x - o.x) > o.r + t.w || Math.abs(t.z - o.z) > (o.zr ?? 20) || t.y > (o.ymax ?? 50)) continue;
            const dir = t.x >= o.x ? 1 : -1;
            const att = src.kind === 'fighter' ? src : { kind: 'aoe', team, x: o.x, dmgMul: 1 };
            const r = applyHit(this, att, t, o, dir, { noStopAttacker: true });
            if (r === 'hit' && src.team === 'player' && t.team === 'enemy') any = true;
        }
        if (team === 'player' || team === 'neutral') {
            for (const pr of this.props) if (!pr.broken && Math.abs(pr.x - o.x) < o.r + pr.w && Math.abs(pr.z - o.z) < (o.zr ?? 20)) this.hitProp(pr, team, pr.x >= o.x ? 1 : -1, 9);
        }
        if (o.shake) this.emit({ t: 'shake', a: o.shake });
        return any;
    }

    explodeMine(e) {
        if (e.exploded) return;
        e.exploded = true; e.remove = true;
        this.emit({ t: 'explode', x: e.x, y: 10, z: e.z, r: 34 }); this.emit({ t: 'sfx', id: 'boom', x: e.x });
        this.aoe({ kind: 'aoe', team: 'neutral', x: e.x }, { team: 'neutral', x: e.x, z: e.z, r: 36, zr: 18, dmg: 14, kb: 'knock', push: 170, lift: 250, shake: 5, spark: 'fire' });
    }

    spawnGhost(b, sprite, side) {
        const def = { ...BOSSES.viper, name: 'MIRAGE', hp: 1, poise: 0, boss: false, noGrab: true };
        const g = makeFighter(def, { team: 'enemy', x: side < 0 ? this.camL + 10 : this.camR - 10, z: this.player.z + side * 12, face: -side, pal: 'ghost' });
        g.moves = { dash: { ...BOSSES.viper.moves.dash, st: 0.55, onEnd(w, f) { f.remove = true; w.emit({ t: 'vanish', id: f.id }); } } };
        g.ghost = true; g.boss = false; g.isGhost = true;
        g.def = { ...def, ai: 'ghost' };
        g.intangible = true;
        this.fighters.push(g);
        startMove(this, g, 'dash');
        g.face = this.player.x >= g.x ? 1 : -1;
    }

    // ------------------------------------------------------------ assist (final battle)
    stepAssist(dt) {
        const A = this.assist;
        if (!A || !this.boss || this.boss.def !== BOSSES.magnus2 || this.state !== 'play' || this.boss.hp <= 0) return;
        A.cd -= dt;
        if (A.cd > 0) return;
        A.cd = this.rng.range(9, 12);
        const b = this.boss;
        const side = b.x > this.camX ? -1 : 1;
        const m = makeFighter({ ...BOSSES.mika, boss: false, name: 'MIKA' }, { team: 'player', x: side < 0 ? this.camL - 20 : this.camR + 20, z: b.z, face: side < 0 ? 1 : -1, pal: 'freed' });
        m.ally = true; m.intangible = true; m.flying = false;
        m.moves = {
            assist: { anim: 'rail', st: 0.25, ac: 0.55, rc: 0.3, vx: [0, 420, 0], dmg: 22, box: [0, 46, 10, 160], z: 22, kb: 'knock', push: 160, lift: 300, breaksArmor: true, shake: 6, spark: 'elec',
                onActive(w, f) { w.emit({ t: 'trail', id: f.id, dur: 0.5 }); w.emit({ t: 'sfx', id: 'rail', x: f.x }); } },
        };
        this.fighters.push(m);
        startMove(this, m, 'assist');
        this.emit({ t: 'assist' });
        this.emit({ t: 'bark', who: 'mika', text: this.rng.pick(['Now, Juno!', 'I\'ve got his left!', 'Together!', 'Hit him while he\'s down!']) });
    }

    thinkAlly(f, dt) {
        if (f.state === 'attack') return;
        f.vx = f.face * 200; f.state = 'run'; f.anim = 'run';
        if (f.x < this.camL - 40 || f.x > this.camR + 40) f.remove = true;
    }

    // ------------------------------------------------------------ projectiles
    spawnProjFrom(f, spec) {
        this.spawnProj({ ...spec, team: f.team, x: f.x + f.face * (spec.dx || 0), y: f.y + (spec.dy || 40), z: f.z, vx: f.face * (spec.vx || 300), vy: spec.vy || 0, owner: f.id, ownerRef: f });
    }

    spawnProj(o) {
        const shape = PROJ[o.type] || { w: 8, h: 6, z: 10 };
        const pr = { id: ++this.uid, kind: 'proj', t: 0, vz: 0, vy: 0, ttl: 2, hitSet: new Set(), ...shape, ...o };
        if (pr.h === undefined) pr.h = shape.h;
        if (shape.ground) pr.y = pr.h / 2;
        this.projs.push(pr);
        return pr;
    }

    stepProjectiles(dt) {
        const keep = [];
        for (const pr of this.projs) {
            if (pr.delay > 0) { pr.delay -= dt; keep.push(pr); continue; }
            pr.t += dt;
            if (pr.homing && this.player) {
                const p = this.player;
                pr.vx += Math.sign(p.x - pr.x) * 120 * dt * pr.homing;
                pr.vz += Math.sign(p.z - pr.z) * 80 * dt * pr.homing;
                pr.vy += Math.sign(p.y + 40 - pr.y) * 80 * dt * pr.homing;
                const sp = Math.hypot(pr.vx, pr.vz); if (sp > 170) { pr.vx *= 170 / sp; pr.vz *= 170 / sp; }
            }
            if (pr.grav) pr.vy -= 650 * dt;
            pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
            let dead = pr.t > pr.ttl || pr.x < this.camL - 80 || pr.x > this.camR + 80;
            if (pr.z < this.zMin - 8 || pr.z > this.zMax + 8) { if (!pr.vz) pr.z = Math.max(this.zMin, Math.min(this.zMax, pr.z)); else dead = true; }
            if (pr.y <= 0 && pr.grav) {
                if (pr.type === 'acid') this.addHazard({ type: 'puddle', x: pr.x, z: pr.z, r: 18, ttl: 3.2, dmg: 4 });
                if (pr.type === 'weapon') this.emit({ t: 'weaponBreak', type: pr.weaponType, x: pr.x, y: 4, z: pr.z });
                dead = true;
            }
            if (!dead) {
                for (const t of this.fighters) {
                    if (t.team === pr.team || t.ally || !canBeHit(t) || pr.hitSet.has(t.id)) continue;
                    if (Math.abs(t.z - pr.z) > (PROJ[pr.type] ? PROJ[pr.type].z : 10)) continue;
                    if (Math.abs(t.x - pr.x) > t.w + pr.w) continue;
                    if (pr.y + pr.h < t.y + (t.hy0 || 0) || pr.y - pr.h > t.y + t.h) continue;
                    pr.hitSet.add(t.id);
                    const owner = pr.ownerRef && pr.ownerRef.kind === 'fighter' ? pr.ownerRef : { kind: 'proj', team: pr.team, x: pr.x, dmgMul: 1 };
                    const r = applyHit(this, owner.kind === 'fighter' ? { ...owner, kind: 'projOwner', hitstop: 0, team: pr.team, dmgMul: owner.dmgMul, od: owner.od } : owner, t, pr, Math.sign(pr.vx) || 1, { noStopAttacker: true, hy: pr.y });
                    if (r && !pr.pierce) { dead = true; break; }
                }
                if (pr.team === 'player' && !dead) for (const prp of this.props) {
                    if (prp.broken || pr.hitSet.has('p' + prp.id)) continue;
                    if (Math.abs(prp.z - pr.z) < 12 && Math.abs(prp.x - pr.x) < prp.w + pr.w && pr.y < prp.h + 4) { pr.hitSet.add('p' + prp.id); this.hitProp(prp, 'player', Math.sign(pr.vx) || 1); if (!pr.pierce) dead = true; }
                }
            }
            if (dead) { this.emit({ t: 'projDie', type: pr.type, x: pr.x, y: pr.y, z: pr.z }); continue; }
            keep.push(pr);
        }
        this.projs = keep;
        this.stepSurvival(dt);
        if (this.respawnBlast && this.player.state === 'land') {
            this.respawnBlast = false;
            this.aoe(this.player, { x: this.player.x, z: this.player.z, r: 70, zr: 30, dmg: 6, kb: 'knock', push: 200, lift: 240, shake: 4, spark: 'elec' });
            this.emit({ t: 'shock', x: this.player.x, z: this.player.z, r: 70, color: 'cyan' });
        }
    }

    // ------------------------------------------------------------ hazards
    addHazard(h) { const hz = { id: ++this.uid, kind: 'hazard', t: 0, hit: new Set(), ...h }; this.hazards.push(hz); return hz; }

    scheduleHazard(ev) {
        const n = ev.count || 1;
        for (let k = 0; k < n; k++) {
            if (ev.kind === 'gantry') this.addHazard({ type: 'gantry', delay: k * (ev.every || 5) + 0.5, warn: 1.3, speed: 520, dmg: 12 });
            if (ev.kind === 'forklift') {
                const z = ev.z ?? this.rng.range(this.zMin + 8, this.zMax - 8);
                this.addHazard({ type: 'forklift', delay: k * (ev.every || 5) + 0.5, warn: 1.4, z, dir: ev.dir || (this.rng() < 0.5 ? 1 : -1), speed: 300, dmg: 16 });
            }
        }
    }

    stepHazards(dt) {
        const p = this.player;
        const keep = [];
        for (const h of this.hazards) {
            if (h.delay > 0 && h.type !== 'reticle' && h.type !== 'slashmark' && h.type !== 'beam' && h.type !== 'shadow') {
                h.delay -= dt; keep.push(h); continue;
            }
            h.t += dt;
            switch (h.type) {
                case 'reticle':
                    if (h.t >= h.delay) {
                        this.aoe({ kind: 'aoe', team: 'neutral', x: h.x }, { team: 'neutral', x: h.x, z: h.z, r: h.r, zr: h.r * 0.6, dmg: h.dmg, kb: 'knock', push: 150, lift: 240, shake: 4, spark: 'fire' });
                        this.emit({ t: 'explode', x: h.x, y: 6, z: h.z, r: h.r }); this.emit({ t: 'sfx', id: 'boom', x: h.x });
                        h.done = true;
                    }
                    break;
                case 'slashmark':
                    if (h.t >= h.delay) {
                        this.aoe({ kind: 'aoe', team: 'enemy', x: h.x }, { team: 'enemy', x: h.x, z: h.z, r: h.r, zr: 12, dmg: h.dmg, kb: 'heavy', push: 60, stun: 0.4, spark: 'slash', ymax: 80 });
                        this.emit({ t: 'slashfx', x: h.x, z: h.z }); this.emit({ t: 'sfx', id: 'slashHit', x: h.x });
                        h.done = true;
                    }
                    break;
                case 'beam':
                    if (h.t >= h.delay && h.t < h.delay + h.dur) {
                        for (const t of this.fighters) {
                            if (t.team !== 'player' || t.ally || h.hit.has(t.id) || !canBeHit(t)) continue;
                            if (Math.abs(t.z - h.z) <= h.zr && t.y < 70) { h.hit.add(t.id); applyHit(this, { kind: 'aoe', team: 'enemy', x: t.x - 1, dmgMul: 1 }, t, { dmg: h.dmg, kb: 'knock', push: 120, lift: 260, spark: 'fire', shake: 5 }, t.face * -1 || 1, { noStopAttacker: true }); }
                        }
                    }
                    if (h.t >= h.delay + h.dur) h.done = true;
                    break;
                case 'puddle':
                    h.tick = (h.tick || 0) - dt;
                    if (h.tick <= 0 && p && p.y < 2 && Math.abs(p.x - h.x) < h.r && Math.abs(p.z - h.z) < h.r * 0.5 && canBeHit(p)) {
                        h.tick = 0.45; damage(this, p, h.dmg * this.diff.dmgTaken, 'enemy'); p.flash = 0.1; this.emit({ t: 'sfx', id: 'sizzle', x: p.x });
                        if (p.hp <= 0 && p.state !== 'fall') knock(p, 1, 60, 150);
                    }
                    if (h.t > h.ttl) h.done = true;
                    break;
                case 'laser': {
                    const cyc = (h.t + (h.offset || 0)) % (h.on + h.off);
                    const active = cyc < h.on;
                    h.active = active; h.warning = !active && cyc > h.on + h.off - 0.7;
                    if (!active) { h.hit.clear(); break; }
                    for (const t of this.fighters) {
                        if (!canBeHit(t) || h.hit.has(t.id) || t.ally || t.boss) continue;
                        if (Math.abs(t.x - h.x) < t.w + 3 && t.y < 56) { h.hit.add(t.id); applyHit(this, { kind: 'aoe', team: 'neutral', x: t.x - 1, dmgMul: 1 }, t, { dmg: 10, kb: 'knock', push: 120, lift: 220, spark: 'elec', sfx: 'zap' }, t.x >= h.x ? 1 : -1, { noStopAttacker: true }); }
                    }
                    break;
                }
                case 'steam': {
                    const cyc = (h.t + (h.offset || 0)) % (h.on + h.off);
                    h.active = cyc < h.on; h.warning = !h.active && cyc > h.on + h.off - 0.6;
                    if (!h.active) { h.hit.clear(); break; }
                    for (const t of this.fighters) {
                        if (!canBeHit(t) || h.hit.has(t.id) || t.ally || t.boss) continue;
                        if (Math.abs(t.x - h.x) < t.w + h.r && Math.abs(t.z - h.z) < 10 && t.y < 60) { h.hit.add(t.id); applyHit(this, { kind: 'aoe', team: 'neutral', x: t.x - 1, dmgMul: 1 }, t, { dmg: 8, kb: 'knock', push: 80, lift: 260, spark: 'fire', sfx: 'steam' }, t.x >= h.x ? 1 : -1, { noStopAttacker: true }); }
                    }
                    break;
                }
                case 'forklift':
                case 'gantry': {
                    if (!h.started) {
                        h.started = true;
                        h.x = h.type === 'gantry' ? this.camR + 60 : (h.dir > 0 ? this.camL - 60 : this.camR + 60);
                        if (h.type === 'gantry') h.dir = -1;
                        this.emit({ t: 'hazardWarn', kind: h.type, z: h.z, dir: h.dir });
                        this.emit({ t: 'sfx', id: 'alarm' });
                    }
                    if (h.t < h.warn) break;
                    h.x += h.dir * h.speed * dt;
                    h.moving = true;
                    for (const t of this.fighters) {
                        if (!canBeHit(t) || h.hit.has(t.id) || t.ally) continue;
                        const inLane = h.type === 'gantry' ? t.y < 20 : Math.abs(t.z - h.z) < 12 && t.y < 40;
                        if (inLane && Math.abs(t.x - h.x) < t.w + (h.type === 'gantry' ? 8 : 28)) {
                            h.hit.add(t.id);
                            applyHit(this, { kind: 'aoe', team: 'neutral', x: h.x, dmgMul: 1 }, t, { dmg: h.dmg, kb: 'knock', push: 220, lift: 260, shake: 4, spark: 'heavy' }, h.dir, { noStopAttacker: true });
                        }
                    }
                    if ((h.dir > 0 && h.x > this.camR + 90) || (h.dir < 0 && h.x < this.camL - 90)) h.done = true;
                    break;
                }
                case 'shadow': break;
                default: break;
            }
            if (!h.done) keep.push(h);
        }
        this.hazards = keep;
    }

    // ------------------------------------------------------------ items & props
    dropItem(type, x, z, cred) {
        const it = { id: ++this.uid, kind: 'item', type, x, z: Math.max(this.zMin, Math.min(this.zMax, z)), y: 16, vy: 160, vx: (this.rng() - 0.5) * 40, t: 0, cred };
        if (ITEMS[type] && ITEMS[type].kind === 'weapon') { const W = { pipe: 22, katana: 18, baton: 20, knives: 5 }; it.uses = W[type]; }
        this.items.push(it);
        return it;
    }

    dropWeapon(p) {
        if (!p.weapon) return;
        const it = this.dropItem(p.weapon.type, p.x, p.z);
        it.uses = p.weapon.uses;
        p.weapon = null;
    }

    stepItems(dt) {
        const p = this.player;
        const keep = [];
        for (const it of this.items) {
            it.t += dt;
            if (it.y > 0 || it.vy > 0) { it.vy -= 700 * dt; it.y += it.vy * dt; it.x += it.vx * dt; if (it.y <= 0) { it.y = 0; it.vy = it.vy < -120 ? -it.vy * 0.3 : 0; it.vx *= 0.5; } }
            const def = ITEMS[it.type];
            if (def.kind !== 'weapon' && p.state !== 'dead' && it.t > 0.35 && Math.abs(p.x - it.x) < 16 && Math.abs(p.z - it.z) < 10 && p.y < 20) {
                this.collect(p, it, def);
                continue;
            }
            keep.push(it);
        }
        this.items = keep;
    }

    collect(p, it, def) {
        this.stats.items++;
        this.score += def.score || 0;
        if (def.kind === 'food') { const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + def.hp); this.emit({ t: 'heal', amount: p.hp - before }); }
        if (def.kind === 'energy') p.energy = Math.min(p.maxEnergy, p.energy + def.energy);
        if (def.kind === 'cred') { const c = it.cred || def.cred; this.stats.cred += c; this.profile.credits = (this.profile.credits || 0) + c; }
        if (def.kind === 'life') { this.lives++; this.emit({ t: 'extraLife' }); }
        this.emit({ t: 'pickup', type: it.type, x: it.x, z: it.z, name: def.name });
        this.emit({ t: 'sfx', id: def.kind === 'cred' ? 'coin' : def.kind === 'life' ? 'oneup' : 'pickup', x: it.x });
    }

    tryPickupWeapon(p) {
        for (let i = 0; i < this.items.length; i++) {
            const it = this.items[i];
            if (ITEMS[it.type].kind !== 'weapon' || it.y > 4) continue;
            if (Math.abs(p.x - it.x) < 18 && Math.abs(p.z - it.z) < 10) {
                p.weapon = { type: it.type, uses: it.uses };
                this.items.splice(i, 1);
                this.emit({ t: 'pickup', type: it.type, x: it.x, z: it.z, name: ITEMS[it.type].name });
                this.emit({ t: 'sfx', id: 'equip', x: it.x });
                return true;
            }
        }
        return false;
    }

    throwWeapon(p) {
        if (!p.weapon) return;
        this.spawnProj({ type: 'weapon', weaponType: p.weapon.type, team: 'player', x: p.x + p.face * 18, y: p.y + 52, z: p.z, vx: p.face * 360, vy: 60, grav: true, dmg: 15, kb: 'knock', push: 160, lift: 200, ttl: 1.6, owner: p.id, ownerRef: p, spin: true });
        p.weapon = null;
    }

    addProp(pr) {
        const def = PROPS[pr.type];
        this.props.push({ id: ++this.uid, kind: 'prop', type: pr.type, x: pr.x, z: pr.z ?? this.zMax - 6, hp: def.hp, w: def.w, h: def.h, drop: pr.drop, broken: false, flash: 0, def });
    }

    hitProp(pr, team, dir, force = 1) {
        if (pr.broken) return;
        pr.hp -= force; pr.flash = 0.12; pr.shakeT = 0.2;
        this.emit({ t: 'propHit', id: pr.id, x: pr.x, z: pr.z });
        this.emit({ t: 'sfx', id: pr.type === 'can' || pr.type === 'barrel' ? 'clang' : 'wood', x: pr.x });
        if (pr.hp > 0) return;
        pr.broken = true;
        this.emit({ t: 'break', id: pr.id, type: pr.type, x: pr.x, z: pr.z, dir });
        this.score += 50;
        if (pr.def.explosive) { pr.fuse = 0.35; return; }
        const n = pr.def.drops || 1;
        for (let k = 0; k < n; k++) {
            const type = k === 0 && pr.drop ? pr.drop : this.rollDrop();
            if (type) this.dropItem(type, pr.x + (k - (n - 1) / 2) * 14, pr.z - 4);
        }
    }

    rollDrop() {
        if (this.rng() < 0.18) return null;
        const total = DROP_TABLE.reduce((a, [, wgt]) => a + wgt, 0);
        let r = this.rng() * total;
        for (const [type, wgt] of DROP_TABLE) { r -= wgt; if (r <= 0) return type; }
        return 'chip';
    }

    stepProps(dt) {
        for (const pr of this.props) {
            if (pr.flash > 0) pr.flash -= dt;
            if (pr.shakeT > 0) pr.shakeT -= dt;
            if (pr.fuse !== undefined && pr.fuse > 0) {
                pr.fuse -= dt;
                if (pr.fuse <= 0) {
                    this.emit({ t: 'explode', x: pr.x, y: 14, z: pr.z, r: 44 }); this.emit({ t: 'sfx', id: 'boom', x: pr.x });
                    this.aoe({ kind: 'aoe', team: 'neutral', x: pr.x }, { team: 'neutral', x: pr.x, z: pr.z, r: 46, zr: 22, dmg: 20, kb: 'knock', push: 190, lift: 280, shake: 6, spark: 'fire' });
                }
            }
        }
    }

    // ------------------------------------------------------------ queries for view/UI
    enemiesAlive() { return this.fighters.filter((f) => f.team === 'enemy' && f.state !== 'dead').length; }

    snapshotProfile() {
        return { ...this.profile, score: this.score, lives: this.lives };
    }
}
