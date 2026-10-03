// The simulation. Pure: no DOM, no WebGL, no Math.random. main.js steps it
// at a fixed 1/120 s and drains `events` each frame for effects, sound and HUD.

import { RNG } from '../rng.js';
import { W, DT, DIFFICULTY } from './config.js';
import { makeTerrain, WATER } from './terrain.js';
import { makeBulletSystem, stepBullets, cancelAll, laserDist } from './bullets.js';
import { ENEMIES, canFire } from './enemies.js';
import { makePlayer, stepPlayer, addOverdrive } from './player.js';
import { makeDirector } from './director.js';
import { runGen, clamp, TAU } from './util.js';

let nextId = 1;

export class World {
    /**
     * cfg: { op, opIndex, seed, difficulty, loadout, H, endless, startAtBoss, god }
     */
    constructor(cfg) {
        this.W = W;
        this.H = cfg.H ?? 900;
        this.op = cfg.op;
        this.opIndex = cfg.opIndex ?? 0;
        this.seed = cfg.seed >>> 0;
        this.endless = !!cfg.endless;
        this.endlessLevel = 0;
        this.god = !!cfg.god;
        this.rng = new RNG(this.seed);
        // Early operations run gentler than the difficulty's baseline; the endless mode ramps by sector.
        const base = DIFFICULTY[cfg.difficulty] || DIFFICULTY.pilot;
        const intensity = this.endless ? 0.9 : [0.52, 0.72, 0.9, 1.0, 1.08, 1.15][this.opIndex] ?? 1;
        this.intensity = intensity;
        this.diff = { ...base, fireRate: base.fireRate * intensity, density: base.density * (0.4 + 0.6 * intensity) };
        this.bspd = this.diff.bulletSpd;
        this.dens = this.diff.density;
        this.bspd *= 0.85 + 0.15 * intensity;
        this.L = cfg.loadout;
        this.t = 0;
        this.frame = 0;
        this.scrollSpeed = this.op.scroll;
        this.scrollTarget = this.op.scroll;
        this.scroll = 0;
        // the Crucible's platform, or the open sea the Tidewarden sails on
        this.platformY = this.endless ? Infinity : this.op.biome === 'volcano' ? this.op.length * this.op.scroll + 40 : this.op.biome === 'coast' ? this.op.length * this.op.scroll - 500 : Infinity;
        this.terrain = makeTerrain(this.op.biome, this.seed, { platformY: this.platformY });
        this.terrainVersion = 0;
        this.enemies = [];
        this.pshots = [];
        this.pickups = [];
        this.bs = makeBulletSystem();
        this.events = [];
        this.timers = [];
        this.stats = {
            kills: 0, spawned: 0, escaped: 0, hits: 0, bombs: 0, grazes: 0, survivors: 0, survivorsTotal: 0,
            salvage: 0, maxChain: 0, time: 0, bossTime: 0, checkpoint: !!cfg.startAtBoss, phaseTimeouts: 0,
        };
        this.score = 0;
        this.chain = 0;
        this.chainT = 0;
        this.salvage = 0;
        this.bulletTime = 1;
        this.cloudCover = 1;
        this.state = 'play';
        this.stateT = 0;
        this.boss = null;
        this.ally = null;
        this.player = makePlayer(this);
        this.director = makeDirector(this);
        if (cfg.startAtBoss) {
            this.director.skipToBoss();
            this.scroll = this.director.t * this.op.scroll;
            this.cloudCover = 0.6;
        }
    }

    ev(type, data) { data.type = type; this.events.push(data); }
    after(dt, fn) { this.timers.push({ at: this.t + dt, fn }); }

    get mult() { return 1 + Math.min(this.chain, 100) * 0.04; }

    // ------------------------------------------------------------- spawning

    spawn(kind, x, y, o = {}) {
        const def = o.def || ENEMIES[kind];
        const hpMul = this.diff.enemyHp * (1 + 0.3 * this.endlessLevel);
        const e = {
            id: nextId++, kind, def, x, y, px: x, py: y, r: def.r, hp: def.hp * hpMul, maxHp: def.hp * hpMul,
            ground: !!def.ground, alive: true, t: 0, delay: o.delay || 0, flash: 0, elite: false,
            rot: o.rot ?? (def.ground ? 0 : Math.PI), trot: Math.PI / 2, dir: o.dir ?? Math.PI / 2,
            mv: o.mv || { type: 'none' }, data: o.data || {}, gen: null, wait: 0, entered: false,
        };
        if (e.mv.type === 'dive' && e.mv.x0 === undefined) e.mv.x0 = x;
        if (def.ground && o.dir !== undefined) e.rot = o.dir + Math.PI / 2;
        if (def.fire) e.gen = def.fire(e, this);
        this.enemies.push(e);
        if (!def.structure && !def.boss && kind !== 'missile' && !def.noHit) this.stats.spawned++;
        return e;
    }

    makeElite(e) {
        e.elite = true;
        e.hp *= 2.2; e.maxHp *= 2.2;
        if (e.def.fire) e.gen = e.def.fire(e, this);
    }

    spawnAlly() {
        if (this.ally) return;
        this.ally = { x: -40, y: this.H * 0.7, t: 0, fireT: 0 };
        this.ev('ally', {});
    }

    setBiome(biome, seed) {
        this.terrain = makeTerrain(biome, seed, { platformY: Infinity });
        this.terrainVersion++;
    }

    // ------------------------------------------------------------- player shots

    pshot(x, y, ang, spd, dmg, kind, o = {}) {
        if (this.pshots.length > 600) return;
        this.pshots.push({
            x, y, px: x, py: y, ang, spd, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg, kind,
            r: o.r ?? 5, pierce: o.pierce || 0, hits: null, crit: !!o.crit, target: o.target || null,
            accel: o.accel || 0, max: o.max || spd, turn: o.turn || 0, life: o.life || 1.2, t: 0,
            splash: o.splash || 0, splashDmg: o.splashDmg || 0, delay: o.delay || 0, alive: true,
        });
    }

    /** A part (or the boss itself) a homing weapon should aim at. */
    bossTarget(b) {
        if (!b.alive || b.entering || b.dying || b.submerged || !b.parts) return null;
        let best = null;
        for (const p of b.parts) if (p.alive && p.gate && !p.visual) { best = p; break; }
        if (!best && !b.invuln) best = b.parts.find((p) => p.core) || null;
        return best;
    }

    // ------------------------------------------------------------- damage

    damageEnemy(e, dmg, x, y, src, part) {
        if (!e.alive) return;
        if (e.boss) {
            if (e.entering || e.dying || e.submerged) return;
            if (!part) part = this.bossTarget(e);
            if (!part) return;
            if (part.core) {
                if (e.invuln) return;
                e.hp -= dmg;
                e.flash = 0.05;
            } else {
                part.hp -= dmg;
                part.flash = 0.06;
                if (part.hp <= 0 && part.alive) {
                    part.alive = false;
                    this.ev('partKill', { x: part.x, y: part.y, big: true, id: part.id, boss: e.bossId });
                    this.addScore(800);
                    this.dropSalvage(part.x, part.y, 20);
                    addOverdrive(this, 0.05);
                }
            }
            return;
        }
        e.hp -= dmg;
        e.flash = 0.06;
        if (e.hp <= 0) this.killEnemy(e);
    }

    killEnemy(e, silent = false) {
        if (!e.alive) return;
        e.alive = false;
        const def = e.def;
        if (def.onDeath) def.onDeath(e, this);
        const water = e.ground && this.terrain.kind(e.x, this.scroll + this.H - e.y) === WATER;
        this.ev('kill', { x: e.x, y: e.y, kind: e.kind, size: def.size, ground: e.ground, water, elite: e.elite, rot: e.rot, silent });
        if (def.explodes) {
            const R = def.explodes;
            this.ev('blast', { x: e.x, y: e.y, r: R });
            for (const o of this.enemies) {
                if (o === e || !o.alive || o.boss || o.def.noHit) continue;
                const dx = o.x - e.x, dy = o.y - e.y;
                if (dx * dx + dy * dy < R * R) this.after(0.12, () => this.damageEnemy(o, 90, o.x, o.y, 'blast'));
            }
        }
        if (silent) return;
        if (!def.structure && e.kind !== 'missile') this.stats.kills++;
        this.chain++;
        this.chainT = 2.8;
        if (this.chain > this.stats.maxChain) this.stats.maxChain = this.chain;
        if (this.chain > 0 && this.chain % 25 === 0) { this.ev('chain', { n: this.chain }); this.director.bark('chain'); }
        const pts = def.score * (e.elite ? 2 : 1);
        this.addScore(pts);
        this.ev('score', { x: e.x, y: e.y, pts: Math.round(pts * this.mult * this.diff.score), mult: this.mult });
        this.dropSalvage(e.x, e.y, def.salvage * (e.elite ? 2 : 1));
        addOverdrive(this, def.size === 'l' ? 0.05 : def.size === 'm' ? 0.015 : 0.006);
        const r = this.rng;
        const p = this.player;
        if (def.midboss) {
            this.spawnPickup(e.x, e.y, 'repair');
            this.spawnPickup(e.x + 20, e.y, 'bomb');
        } else if (def.size !== 's') {
            if (p.armor < p.maxArmor && r.chance(def.size === 'l' ? 0.35 : 0.05)) this.spawnPickup(e.x, e.y, 'repair');
            else if (r.chance(def.size === 'l' ? 0.2 : 0.025)) this.spawnPickup(e.x, e.y, 'bomb');
            else if (r.chance(def.size === 'l' ? 0.3 : 0.05)) this.spawnPickup(e.x, e.y, 'od');
        }
    }

    addScore(base, useMult = true) {
        this.score += Math.round(base * (useMult ? this.mult : 1) * this.diff.score);
    }

    salvageGain(v) {
        const g = v * this.L.salvageMul * this.diff.salvage;
        this.salvage += g;
        this.stats.salvage = Math.floor(this.salvage);
    }

    dropSalvage(x, y, total) {
        if (total <= 0) return;
        const n = Math.min(8, Math.ceil(total / 5));
        for (let i = 0; i < n; i++) this.spawnPickup(x, y, 'salvage', total / n);
    }

    spawnPickup(x, y, kind, value = 0) {
        if (this.pickups.length > 260) { if (kind === 'salvage') this.salvageGain(value); return; }
        const a = this.rng.float() * TAU, s = this.rng.range(40, 140);
        this.pickups.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, kind, value, t: 0, alive: true, mag: false, spin: this.rng.float() * TAU });
    }

    cancelBullets(big) {
        const n = cancelAll(this, big ? 'bomb' : 'tick');
        return n;
    }

    /** The Ion Lance: a column of damage above (x, y). */
    beamAttack(x, y, halfW, dmg) {
        let top = -20;
        for (const e of this.enemies) {
            if (!e.alive || e.delay > 0 || e.def.noHit || e.y > y) continue;
            if (e.boss) {
                if (!e.parts) continue;
                for (const p of e.parts) {
                    if (!p.alive || p.visual) continue;
                    if (Math.abs(p.x - x) < halfW + p.r && p.y < y) { this.damageEnemy(e, dmg, p.x, p.y, 'beam', p); }
                }
                continue;
            }
            if (Math.abs(e.x - x) < halfW + e.r && e.y > -10) this.damageEnemy(e, dmg, e.x, e.y, 'beam');
        }
        // burn small bullets inside the beam
        const list = this.bs.list;
        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];
            if (b.r < 6 && b.delay <= 0 && b.y < y && Math.abs(b.x - x) < halfW) {
                this.ev('burn', { x: b.x, y: b.y });
                b.alive = false;
                list[i] = list[list.length - 1]; list.pop();
                this.bs.free(b);
            }
        }
        this.player.beamTop = top;
    }

    rescue(e) {
        const n = e.data.people || 3;
        this.stats.survivors += n;
        this.salvageGain(12 * n);
        this.addScore(500 * n, false);
        this.ev('rescue', { x: e.x, y: e.y, n });
        this.director.bark('rescue');
    }

    hitPlayer(x, y) {
        const p = this.player;
        if (!p.alive || p.invuln > 0 || this.god || this.state !== 'play') return;
        if (p.shield) {
            p.shield = 0; p.shieldT = 22; p.invuln = 1.2;
            this.clearNear(p.x, p.y, 90);
            this.ev('shieldBreak', { x: p.x, y: p.y });
            return;
        }
        p.armor--;
        this.stats.hits++;
        this.chain = 0;
        p.invuln = 2.2;
        p.hitT = 0.4;
        this.clearNear(p.x, p.y, 120);
        this.ev('phit', { x: p.x, y: p.y, armor: p.armor, fromX: x, fromY: y });
        if (p.armor === 1) this.director.bark('lowArmor');
        if (p.armor <= 0) {
            if (p.phoenix) {
                p.phoenix = false;
                p.armor = p.maxArmor;
                p.invuln = 4;
                this.cancelBullets(true);
                for (const e of this.enemies) if (e.alive && !e.def.noHit && e.y > -20) this.damageEnemy(e, 200 * (e.boss ? 0.5 : 1), e.x, e.y, 'bomb');
                this.ev('phoenix', { x: p.x, y: p.y });
                return;
            }
            p.alive = false;
            this.state = 'dying';
            this.stateT = 0;
            this.ev('pdead', { x: p.x, y: p.y });
        }
    }

    clearNear(x, y, R) {
        const list = this.bs.list;
        const pts = [];
        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];
            const dx = b.x - x, dy = b.y - y;
            if (dx * dx + dy * dy < R * R) {
                pts.push(b.x, b.y, b.color);
                b.alive = false; list[i] = list[list.length - 1]; list.pop(); this.bs.free(b);
            }
        }
        if (pts.length) this.ev('cancel', { pts, reason: 'near' });
    }

    onBossPhase(b, idx) {
        this.addScore(3000 * (idx + 1));
        this.dropSalvage(b.x, b.y, 40);
        if (this.L.stormBreaker && this.player.bombs < this.L.bombs + 2) { this.player.bombs++; this.ev('bombRefund', {}); }
    }

    bossDefeated(b) {
        b.alive = false;
        this.stats.bossTime = this.t - (this.bossStartT || this.t);
        const bonus = 20000 * (this.opIndex + 1 + this.endlessLevel);
        this.addScore(bonus, false);
        this.dropSalvage(b.x, b.y, 160 + 40 * this.opIndex);
        for (let i = 0; i < 3; i++) this.spawnPickup(b.x, b.y, 'salvage', 25);
        this.ev('bossDeath', { x: b.x, y: b.y, id: b.bossId, eject: !!b.bdef.eject, final: !!b.bdef.final, bonus });
        this.cancelBullets(true);
        for (const e of this.enemies) if (e.alive && e !== b && !e.def.noHit) this.killEnemy(e, true);
        this.scrollTarget = this.op.scroll * 0.7;
        if (!this.endless) {
            this.state = 'victory';
            this.stateT = 0;
            const lines = this.op.victory || [];
            lines.forEach(([who, text], i) => this.after(1 + i * 3.4, () => this.ev('comms', { who, text })));
        } else {
            this.addScore(0);
        }
    }

    // ------------------------------------------------------------- step

    step(input) {
        const dt = DT;
        this.t += dt;
        this.frame++;
        this.stats.time = this.t;
        if (this.cloudCover > 0 && this.director.phase !== 'transition') this.cloudCover = Math.max(0, this.cloudCover - dt * 0.4);
        this.scrollSpeed += (this.scrollTarget - this.scrollSpeed) * Math.min(1, dt * 0.8);
        this.scroll += this.scrollSpeed * dt;
        for (let i = this.timers.length - 1; i >= 0; i--) {
            if (this.t >= this.timers[i].at) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
        }
        if (this.state === 'play') this.director.step(dt);
        const p = this.player;
        this.bulletTime = p.odT > 0 && this.L.timeDilation ? 0.5 : 1;
        stepPlayer(this, dt, this.state === 'play' || this.state === 'victory' ? input : {});
        if (this.ally) this.stepAlly(dt);

        // enemies
        const ens = this.enemies;
        for (let i = 0; i < ens.length; i++) {
            const e = ens[i];
            if (!e.alive) continue;
            if (e.delay > 0) { e.delay -= dt; continue; }
            e.px = e.x; e.py = e.y;
            e.t += dt;
            e.flash = Math.max(0, e.flash - dt);
            if (e.def.update) e.def.update(e, this, dt);
            if (e.gen && !e.boss && p.alive && this.state === 'play') runGen(e, dt);
            if (!e.entered && e.y > -5 && e.y < this.H && e.x > -5 && e.x < this.W + 5) e.entered = true;
            if (!e.boss) {
                const out = e.y > this.H + 70 || e.y < -220 || e.x < -160 || e.x > this.W + 160;
                if (out && (e.entered || e.t > 12)) {
                    e.alive = false;
                    if (e.kind === 'beacon' && !e.data.done) this.ev('missed', { n: e.data.people });
                    else if (!e.def.structure && e.kind !== 'missile') this.stats.escaped++;
                }
            }
            if (e.boss && e.parts) for (const pt of e.parts) pt.flash = Math.max(0, pt.flash - dt);
        }

        stepBullets(this, dt);
        this.stepShots(dt);
        this.collidePlayer(dt);
        this.stepPickups(dt);

        if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0) this.chain = 0; }

        // compact
        if (this.frame % 30 === 0) {
            this.enemies = ens.filter((e) => e.alive);
        }

        if (this.state === 'dying') {
            this.stateT += dt;
            if (this.stateT > 2.8) this.state = 'failed';
        } else if (this.state === 'victory') {
            this.stateT += dt;
            for (const k of this.pickups) k.mag = true;
            if (this.stateT > 7.5) this.state = 'cleared';
        }
    }

    stepAlly(dt) {
        const a = this.ally, p = this.player;
        a.t += dt;
        const tx = clamp(p.x - 70, 30, this.W - 30), ty = clamp(p.y + 20, 60, this.H - 30);
        const k = 1 - Math.exp(-dt * (a.t < 2 ? 1.5 : 4));
        a.x += (tx - a.x) * k; a.y += (ty - a.y) * k;
        a.fireT -= dt;
        const b = this.boss;
        if (a.fireT <= 0 && b && b.alive && !b.dying) {
            a.fireT = 0.09;
            const c = this.bossTarget(b);
            if (c) {
                const ang = Math.atan2(c.y - a.y, c.x - a.x);
                this.pshot(a.x, a.y - 10, ang, 1000, 7 * this.L.dmgMul, 'ally', { r: 5 });
            }
        }
    }

    stepShots(dt) {
        const S = this.pshots;
        const ens = this.enemies;
        for (let i = S.length - 1; i >= 0; i--) {
            const s = S[i];
            if (s.delay > 0) { s.delay -= dt; s.x = this.player.x + (s.x - this.player.px); s.y = this.player.y + (s.y - this.player.py); continue; }
            s.t += dt;
            s.px = s.x; s.py = s.y;
            if (s.kind === 'msl') {
                let t = s.target;
                if (t && !t.alive) t = s.target = null;
                if (!t && s.t > 0.15 && this.frame % 6 === 0) {
                    let bd = 1e9;
                    for (const e of ens) {
                        if (!e.alive || e.delay > 0 || e.def.noHit || e.y < -20) continue;
                        const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
                        if (d < bd) { bd = d; t = e; }
                    }
                    s.target = t;
                }
                if (t && s.t > 0.12) {
                    let tx = t.x, ty = t.y;
                    if (t.boss) { const c = this.bossTarget(t); if (c) { tx = c.x; ty = c.y; } }
                    const want = Math.atan2(ty - s.y, tx - s.x);
                    let d = want - s.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
                    s.ang += clamp(d, -s.turn * dt, s.turn * dt);
                } else if (!t) {
                    let d = -Math.PI / 2 - s.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
                    s.ang += clamp(d, -4 * dt, 4 * dt);
                }
            }
            if (s.accel) s.spd = Math.min(s.max, s.spd + s.accel * dt);
            s.vx = Math.cos(s.ang) * s.spd; s.vy = Math.sin(s.ang) * s.spd;
            s.x += s.vx * dt; s.y += s.vy * dt;
            let dead = s.t > s.life || s.y < -40 || s.y > this.H + 40 || s.x < -40 || s.x > this.W + 40;
            if (!dead) {
                for (let j = 0; j < ens.length; j++) {
                    const e = ens[j];
                    if (!e.alive || e.delay > 0 || e.def.noHit || e.y < -30) continue;
                    if (s.hits && s.hits.includes(e.id)) continue;
                    if (e.boss) {
                        if (!e.parts || e.entering || e.dying || e.submerged) continue;
                        let hitPart = null;
                        for (const pt of e.parts) {
                            if (!pt.alive || pt.visual || (pt.core && e.invuln && e.phase && e.phase.gate === 'parts')) continue;
                            const dx = pt.x - s.x, dy = pt.y - s.y, rr = pt.r + s.r;
                            if (dx * dx + dy * dy < rr * rr) { hitPart = pt; break; }
                        }
                        if (!hitPart) continue;
                        if (hitPart.core && e.invuln) this.ev('ting', { x: s.x, y: s.y });
                        else this.damageEnemy(e, s.dmg, s.x, s.y, s.kind, hitPart);
                        this.ev('phitE', { x: s.x, y: s.y, kind: s.kind, crit: s.crit, shield: hitPart.shield || (hitPart.core && e.invuln) });
                        if (s.splash) this.splash(s);
                        dead = true;
                        break;
                    }
                    const dx = e.x - s.x, dy = e.y - s.y, rr = e.r + s.r;
                    if (dx * dx + dy * dy < rr * rr) {
                        this.damageEnemy(e, s.dmg, s.x, s.y, s.kind);
                        this.ev('phitE', { x: s.x, y: s.y, kind: s.kind, crit: s.crit, ground: e.ground });
                        if (s.splash) this.splash(s);
                        if (s.kind === 'msl' && this.L.cluster) {
                            for (let k = 0; k < 5; k++) this.pshot(s.x, s.y, k * TAU / 5 + s.t * 3, 300, 9 * this.L.ordMul, 'bomblet', { life: 0.3, r: 9 });
                        }
                        if (s.pierce > 0) {
                            s.pierce--;
                            (s.hits || (s.hits = [])).push(e.id);
                        } else { dead = true; break; }
                    }
                }
            }
            if (dead) { S[i] = S[S.length - 1]; S.pop(); }
        }
    }

    splash(s) {
        this.ev('rocketHit', { x: s.x, y: s.y });
        for (const e of this.enemies) {
            if (!e.alive || e.boss || e.def.noHit) continue;
            const dx = e.x - s.x, dy = e.y - s.y;
            if (dx * dx + dy * dy < s.splash * s.splash) this.damageEnemy(e, s.splashDmg, e.x, e.y, 'splash');
        }
    }

    collidePlayer(dt) {
        const p = this.player;
        if (!p.alive) return;
        const list = this.bs.list;
        const pr = p.r, gr = p.graze;
        let grazes = 0;
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (b.delay > 0) continue;
            const dx = b.x - p.x, dy = b.y - p.y;
            const d2 = dx * dx + dy * dy;
            const hr = b.r + pr;
            if (d2 < hr * hr) { this.hitPlayer(b.x, b.y); if (!p.alive) return; continue; }
            if (!b.grazed) {
                const g = b.r + gr;
                if (d2 < g * g) { b.grazed = true; grazes++; }
            }
        }
        for (const l of this.bs.lasers) {
            if (!l.live) continue;
            const d = laserDist(l, p.x, p.y);
            if (d < l.width * 0.42 + pr) { this.hitPlayer(p.x, p.y); if (!p.alive) return; }
            else if (d < l.width * 0.5 + gr && this.frame % 10 === 0) grazes++;
        }
        if (grazes) {
            this.stats.grazes += grazes;
            addOverdrive(this, 0.012 * grazes * this.L.grazeMul);
            this.addScore(20 * grazes, false);
            this.ev('graze', { x: p.x, y: p.y, n: grazes });
        }
        for (const e of this.enemies) {
            if (!e.alive || e.delay > 0 || e.ground || e.def.noHit) continue;
            if (e.boss) {
                if (e.entering || e.dying || e.submerged || !e.parts) continue;
                for (const pt of e.parts) {
                    if (!pt.alive || pt.visual) continue;
                    const dx = pt.x - p.x, dy = pt.y - p.y, rr = pt.r * 0.8 + pr;
                    if (dx * dx + dy * dy < rr * rr) { this.hitPlayer(pt.x, pt.y); break; }
                }
                continue;
            }
            const dx = e.x - p.x, dy = e.y - p.y, rr = e.r * 0.7 + pr;
            if (dx * dx + dy * dy < rr * rr) {
                this.hitPlayer(e.x, e.y);
                if (e.kind === 'missile') this.killEnemy(e, true);
                else this.damageEnemy(e, 40, e.x, e.y, 'ram');
                if (!p.alive) return;
            }
        }
    }

    stepPickups(dt) {
        const p = this.player;
        const K = this.pickups;
        const magR = 70 * this.L.magnet;
        const top = p.y < this.H * 0.28;
        for (let i = K.length - 1; i >= 0; i--) {
            const k = K[i];
            k.t += dt;
            k.spin += dt * 4;
            const dx = p.x - k.x, dy = p.y - k.y;
            const d = Math.hypot(dx, dy);
            if (p.alive && (k.mag || d < magR || top || k.t > 2.4)) k.mag = true;
            if (k.mag && p.alive) {
                const s = 380 + k.t * 200;
                k.vx += (dx / (d || 1) * s - k.vx) * Math.min(1, dt * 9);
                k.vy += (dy / (d || 1) * s - k.vy) * Math.min(1, dt * 9);
            } else {
                k.vx *= Math.pow(0.08, dt); k.vy *= Math.pow(0.08, dt);
                k.vy += 30 * dt;
            }
            k.x += k.vx * dt; k.y += k.vy * dt;
            if (p.alive && d < 20) {
                this.collect(k);
                K[i] = K[K.length - 1]; K.pop();
                continue;
            }
            if (k.y > this.H + 30 || k.t > 14) { K[i] = K[K.length - 1]; K.pop(); }
        }
    }

    collect(k) {
        const p = this.player;
        switch (k.kind) {
            case 'salvage': this.salvageGain(k.value); break;
            case 'repair': if (p.armor < p.maxArmor) p.armor++; else this.addScore(2000, false); break;
            case 'bomb': p.bombs = Math.min(p.bombs + 1, 9); break;
            case 'od': addOverdrive(this, 0.34); break;
        }
        this.ev('pickup', { x: k.x, y: k.y, kind: k.kind, value: k.value });
    }
}

export { canFire };
