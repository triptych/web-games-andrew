// The simulation of one stage: Cael, his Halo and Echoes, every shot, enemy,
// bullet, laser, item and boss, the scroll and the stage script.
//
// Pure: no three.js, no DOM, no Math.random. Everything that the view, the
// audio or the UI needs to hear about goes through the bounded event queue
// `fxq`, drained once per frame by main.js. A Node harness (dev/simtest.mjs)
// plays the real game with a bot.

import { W, H, SCROLL, PLAYER, HALO, DIFFICULTY, EXTENDS, MAX_LIVES } from '../config.js';
import { makeRng } from '../rng.js';
import { Terrain } from './terrain.js';
import { KINDS } from './enemies.js';
import { BOSSES } from './bosses.js';
import { STAGES } from './stages.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BR = { orb: 0.17, big: 0.3, needle: 0.11, fire: 0.22, soul: 0.2, shard: 0.13 };

export function newSession(diff = 'seraph', stage = 0) {
    const D = DIFFICULTY[diff];
    return {
        diff, stage, score: 0,
        lives: D.lives - 1,           // reserve lives; 0 = this is your last
        health: D.health,
        nextExtend: 0, continues: 0,
        power: { halo: null, speed: 1, echoes: 0, seeker: false, aegis: 0 },
        stats: { kills: 0, deaths: 0 },
    };
}

/** Power a player would plausibly have on reaching a stage (Stage Select, tests). */
export function stockPower(S, stage) {
    const p = S.power;
    if (stage >= 1) { p.halo = { c: ['red', 'blue', 'gold'][stage % 3], lvl: stage >= 2 ? 2 : 1 }; p.speed = 2; }
    if (stage >= 2) { p.echoes = 1; p.seeker = true; }
    if (stage >= 4) p.echoes = 2;
}

export class World {
    constructor(session, opts = {}) {
        this.S = session;
        this.D = DIFFICULTY[session.diff];
        this.si = session.stage;
        this.stage = STAGES[session.stage];
        this.rng = makeRng(opts.seed ?? 1234);
        this.terrain = new Terrain(this.stage.terrain, this.stage.seed);
        this.t = 0;
        this.fxq = [];
        this.nextId = 1;
        this.state = 'play';          // play | clear | over
        this.stateT = 0;
        this.god = !!opts.god;
        this.stats = { spawned: 0, killed: 0, deaths: 0, bossTime: 0, shards: 0, noMiss: true };
        this.reset(opts.from ?? 0, true);
    }

    // ================================================================ lifecycle
    reset(from, first = false) {
        const st = this.stage;
        this.scroll = from;
        this.speed = SCROLL;
        this.cursor = 0;
        while (this.cursor < st.script.length && st.script[this.cursor].at < from) {
            // keep standing scenery (blocks) behind a checkpoint out of it; replay only the future
            this.cursor++;
        }
        this.pshots = []; this.bullets = []; this.lasers = []; this.enemies = []; this.items = []; this.blocks = [];
        this.spawnQ = []; this.groups = new Map();
        this.boss = null; this.pull = 0; this.dawn = false;
        const t = this.terrain.at(from + 6);
        const y = clamp(9, t.floor + 2, t.ceil - 2);
        this.player = {
            x: 6, y, alive: true, dying: 0, inv: first ? 1.2 : PLAYER.invuln,
            charge: 0, charging: false, fireT: 0, seekT: 0, moving: 0, bank: 0,
        };
        this.trail = [];
        this.echoes = [];
        this.halo = null;
        if (this.S.power.halo) this.halo = { x: this.player.x + HALO.frontX, y, st: 'front', fireT: 0, n: 0, t: 0 };
        this.S.health = this.D.health;
        // blocks placed by events already passed but still on screen
        for (const ev of st.script) if (ev.t === 'block' && ev.at < from && ev.at + 40 > from) this.runEvent(ev);
        this.fx('reset', { from });
    }

    checkpointFor(scroll) {
        let cp = 0;
        for (const c of this.stage.checkpoints) if (c <= scroll + 0.01) cp = c;
        return cp;
    }

    // ================================================================ api for enemies and bosses
    fx(e, payload = {}) {
        payload.e = e;
        this.fxq.push(payload);
        if (this.fxq.length > 700) this.fxq.splice(0, this.fxq.length - 700);
    }

    aim(x, y) {
        const p = this.player;
        return Math.atan2(p.y - y, p.x - x);
    }

    fire(x, y, a, spd, type = 'orb', extra = null) {
        if (this.bullets.length >= 1100) return null;
        spd *= this.D.bullet;
        const b = { x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: BR[type] ?? 0.17, type, t: 0 };
        if (type === 'soul') { b.home = 1.5; b.homeT = 2.6; }
        if (extra) Object.assign(b, extra);
        this.bullets.push(b);
        return b;
    }

    fan(x, y, a, n, spread, spd, type = 'orb', extra = null) {
        for (let i = 0; i < n; i++) this.fire(x, y, a + (n > 1 ? spread * (i / (n - 1) - 0.5) : 0), spd, type, extra);
        this.fx('efire', { x, y, n });
    }

    ring(x, y, n, spd, type = 'orb', off = 0, extra = null) {
        for (let i = 0; i < n; i++) this.fire(x, y, off + (i / n) * TAU, spd, type, extra);
        this.fx('efire', { x, y, n });
    }

    laser(o) {
        const l = { x: o.x, y: o.y, a: o.a, len: o.len ?? 40, w: o.w ?? 0.35, warn: o.warn ?? 0.9, dur: o.dur ?? 1, t: 0, owner: o.owner ?? null, va: o.va ?? 0, color: o.color ?? 0, id: this.nextId++ };
        this.lasers.push(l);
        this.fx('laserWarn', { x: l.x, y: l.y });
        return l;
    }

    spawn(kind, o = {}, group = null) {
        const def = KINDS[kind];
        if (!def) throw new Error(`unknown enemy kind ${kind}`);
        const e = {
            id: this.nextId++, kind, o, t: 0, dt: 1 / 120,
            hp: def.hp, maxHp: def.hp, r: def.r, score: def.score,
            x: 34, y: 9, vx: 0, vy: 0, flash: 0, group,
            ground: !!def.ground, seen: false, dead: false, gone: false,
        };
        def.init.call(def, e, this);
        this.enemies.push(e);
        this.stats.spawned++;
        if (group) group.n++;
        return e;
    }

    dropItem(x, y, kind) {
        this.items.push({ id: this.nextId++, x: clamp(x, 1, W - 1), y: clamp(y, 1, H - 1), kind, t: 0, vy: 0 });
        this.fx('drop', { x, y, kind });
    }

    addScore(n) {
        const S = this.S;
        S.score += Math.round(n * this.D.score);
        while (S.nextExtend < EXTENDS.length && S.score >= EXTENDS[S.nextExtend]) {
            S.nextExtend++;
            if (S.lives < MAX_LIVES) { S.lives++; this.fx('extend', {}); }
        }
    }

    // ================================================================ script
    runEvent(ev) {
        const o = ev.o || {};
        switch (ev.t) {
            case 'wave': {
                const n = ev.n ?? 1;
                const group = o.drop ? { n: 0, killed: 0, escaped: 0, item: o.drop, x: 0, y: 0 } : null;
                for (let i = 0; i < n; i++) {
                    const oi = { ...o, i };
                    if (o.dy) oi.y = (o.y ?? 9) + i * o.dy;
                    if (o.dphase) oi.phase = (o.phase ?? 0) + i * o.dphase;
                    if (o.dx) oi.x = (o.x ?? 34) + i * o.dx;
                    if (o.ys) oi.y = o.ys[i % o.ys.length];
                    this.spawnQ.push({ at: this.t + i * (o.gap ?? 0.32), kind: ev.kind, o: oi, group });
                }
                if (group) group.n = 0;
                break;
            }
            case 'one': this.spawn(ev.kind, { ...o }); break;
            case 'say': this.fx('say', { who: ev.who, text: ev.text, touch: ev.touch }); break;
            case 'block': {
                const wx = ev.at + (o.x ?? 34);
                if (this.blocks.some((b) => b.wx === wx && b.y0 === o.y0)) break;
                this.blocks.push({ id: this.nextId++, wx, y0: o.y0 ?? 0, y1: o.y1 ?? 6, w: o.w ?? 1.4, hp: o.hp ?? Infinity, maxHp: o.hp ?? Infinity, kind: o.kind ?? 'pillar', flash: 0 });
                break;
            }
            case 'speed': this.speed = o.v ?? SCROLL; break;
            case 'boss': this.startBoss(); break;
            default: break;
        }
    }

    startBoss() {
        if (this.boss) return;
        const def = BOSSES[this.stage.boss];
        const b = { kind: this.stage.boss, def, t: 0, st: 'enter', x: 26, y: 9, parts: [], phase: 0, deadT: 0 };
        def.init(b, this);
        for (const p of b.parts) { p.max = p.hp; p.alive = p.alive ?? true; p.flash = 0; }
        this.boss = b;
        this.speed = this.stage.bossScroll ?? 1.2;
        this.fx('boss', { kind: b.kind, name: def.name, title: def.title });
    }

    // ================================================================ step
    step(inp, dt) {
        this.t += dt;
        this.stateT += dt;
        if (this.state === 'over') return;
        this.scroll += this.speed * dt;

        const st = this.stage.script;
        while (this.cursor < st.length && st[this.cursor].at <= this.scroll) this.runEvent(st[this.cursor++]);
        if (!this.boss && this.scroll >= this.stage.len && this.state === 'play') this.startBoss();

        for (let i = this.spawnQ.length - 1; i >= 0; i--) {
            const q = this.spawnQ[i];
            if (this.t >= q.at) { this.spawnQ.splice(i, 1); this.spawn(q.kind, q.o, q.group); }
        }

        this.stepPlayer(inp, dt);
        this.stepHalo(inp, dt);
        this.stepEchoes();
        this.stepFiring(inp, dt);
        this.stepShots(dt);
        this.stepEnemies(dt);
        if (this.boss) this.stepBoss(dt);
        this.stepBullets(dt);
        this.stepLasers(dt);
        this.stepItems(dt);
        this.stepBlocks();

        if (this.state === 'clear' && this.stateT > 3.2 && !this.clearSent) { this.clearSent = true; this.fx('stageClear', {}); }
    }

    // ---------------------------------------------------------------- player
    stepPlayer(inp, dt) {
        const p = this.player;
        if (p.inv > 0) p.inv -= dt;
        if (!p.alive) {
            p.dying -= dt;
            if (p.dying <= 0) this.afterDeath();
            return;
        }
        let ax = inp.ax || 0, ay = inp.ay || 0;
        const m = Math.hypot(ax, ay);
        if (m > 1) { ax /= m; ay /= m; }
        const sp = PLAYER.speeds[this.S.power.speed] * (inp.focus ? PLAYER.focus : 1);
        p.vx = ax * sp; p.vy = ay * sp;
        p.x += p.vx * dt + this.pull * dt;
        p.y += p.vy * dt;
        p.bank += (ay - p.bank) * Math.min(1, 8 * dt);
        p.moving = m;
        p.x = clamp(p.x, 0.7, W - 0.7);
        p.y = clamp(p.y, 0.45, H - 0.45);
        if (this.state !== 'play') return;

        // terrain: sample the body at three points
        for (const dx of [-PLAYER.len, 0, PLAYER.len]) {
            const t = this.terrain.at(this.scroll + p.x + dx);
            if (p.y - PLAYER.body < t.floor) { this.touchWall(0, t.floor + PLAYER.body + 0.05); break; }
            if (p.y + PLAYER.body > t.ceil) { this.touchWall(0, t.ceil - PLAYER.body - 0.05); break; }
        }
        if (!p.alive) return;
        for (const b of this.blocks) {
            const x0 = b.wx - this.scroll - b.w / 2, x1 = x0 + b.w;
            if (p.x + PLAYER.len > x0 && p.x - PLAYER.len < x1 && p.y + PLAYER.body > b.y0 && p.y - PLAYER.body < b.y1) {
                this.touchWall(x0 - PLAYER.len - 0.05, null);
                break;
            }
        }
    }

    touchWall(pushX, pushY) {
        const p = this.player;
        if (this.god) {
            if (pushY !== null) p.y = pushY;
            if (pushX) p.x = pushX;
            return;
        }
        if (this.D.health > 1) {
            if (pushY !== null) p.y = clamp(pushY, 0.45, H - 0.45);
            if (pushX) {
                p.x = pushX;
                if (p.x < 0.7) { this.kill(); return; }     // crushed against the edge
            }
            this.hurt();
        } else this.kill();
    }

    hurt() {
        const p = this.player;
        if (!p.alive || p.inv > 0 || this.god || this.state !== 'play') return;
        const pw = this.S.power;
        if (pw.aegis > 0) {
            pw.aegis--;
            p.inv = PLAYER.hurtInvuln;
            this.fx('aegis', { x: p.x, y: p.y, left: pw.aegis });
            return;
        }
        if (this.D.health > 1 && this.S.health > 1) {
            this.S.health--;
            p.inv = PLAYER.hurtInvuln;
            this.fx('hurt', { x: p.x, y: p.y, health: this.S.health });
            return;
        }
        this.kill();
    }

    kill() {
        const p = this.player;
        if (!p.alive || this.god) return;
        p.alive = false;
        p.dying = 1.7;
        p.charge = 0; p.charging = false;
        this.stats.deaths++;
        this.stats.noMiss = false;
        this.S.stats.deaths++;
        this.deathScroll = this.scroll;
        this.fx('playerDie', { x: p.x, y: p.y });
        const pw = this.S.power;
        if (this.D.keepPower) { pw.aegis = 0; pw.speed = Math.max(1, pw.speed - 1); }
        else {
            pw.speed = 1; pw.echoes = 0; pw.seeker = false; pw.aegis = 0;
            if (pw.halo) pw.halo.lvl = 1;
        }
        if (this.halo && (this.halo.st === 'front' || this.halo.st === 'back')) this.halo.st = 'free';
    }

    afterDeath() {
        const S = this.S;
        if (S.lives <= 0) {
            this.state = 'over';
            this.stateT = 0;
            this.fx('gameOver', {});
            return;
        }
        S.lives--;
        this.respawn();
    }

    /** Back into play after a death or a continue. */
    respawn() {
        const p = this.player;
        if (this.D.checkpoints) {
            const bossCp = this.boss ? this.stage.len - 18 : null;
            this.reset(bossCp ?? this.checkpointFor(this.deathScroll ?? this.scroll));
        } else {
            const t = this.terrain.at(this.scroll + 6);
            p.x = 6; p.y = clamp(9, t.floor + 2, t.ceil - 2);
            p.alive = true; p.inv = PLAYER.invuln;
            this.S.health = this.D.health;
            if (this.halo) this.halo.st = 'return';
            this.bullets.length = 0;
            for (const l of this.lasers) l.t = Math.max(l.t, l.warn + l.dur);
        }
        this.fx('respawn', {});
    }

    /** A continue: fresh lives, score wiped (arcade rules), back to the checkpoint. */
    continueGame() {
        const S = this.S;
        S.continues++;
        S.score = 0;
        S.nextExtend = 0;
        S.lives = this.D.lives - 1;
        this.state = 'play';
        this.stateT = 0;
        this.respawn();
    }

    // ---------------------------------------------------------------- the Halo (Force)
    stepHalo(inp, dt) {
        const pw = this.S.power;
        if (!pw.halo) { this.halo = null; return; }
        const p = this.player;
        if (!this.halo) this.halo = { x: -1.5, y: p.y, st: 'arrive', fireT: 0, n: 0, t: 0 };
        const h = this.halo;
        h.t += dt;
        const toward = (spd) => {
            const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy);
            if (d > 1e-4) { const s = Math.min(d, spd * dt); h.x += (dx / d) * s; h.y += (dy / d) * s; }
            return d;
        };
        if (inp.halo && p.alive) {
            if (h.st === 'front' || h.st === 'back') { h.dir = h.st === 'front' ? 1 : -1; h.st = 'launch'; this.fx('haloCast', { x: h.x, y: h.y }); }
            else if (h.st === 'free' || h.st === 'launch') { h.st = 'return'; this.fx('haloCall', {}); }
        }
        switch (h.st) {
            case 'arrive':
                if (toward(HALO.ret) < 0.9 && p.alive) { h.st = 'front'; this.fx('haloAttach', { x: h.x, y: h.y }); }
                break;
            case 'front': h.x = p.x + HALO.frontX; h.y = p.y; break;
            case 'back': h.x = p.x + HALO.backX; h.y = p.y; break;
            case 'launch':
                h.x += h.dir * HALO.launch * dt;
                h.y += clamp(p.y - h.y, -1, 1) * 4 * dt;
                if ((h.dir > 0 && h.x >= HALO.freeFront) || (h.dir < 0 && h.x <= HALO.freeBack)) h.st = 'free';
                break;
            case 'free':
                if (p.alive) h.y += clamp(p.y - h.y, -1, 1) * 5.5 * dt;
                if (p.alive && Math.hypot(p.x - h.x, p.y - h.y) < 0.95) this.attachHalo();
                break;
            case 'return':
                if (!p.alive) { h.st = 'free'; break; }
                if (toward(HALO.ret) < 1.0) this.attachHalo();
                break;
            default: break;
        }
        h.x = clamp(h.x, -1, W + 1);
        h.y = clamp(h.y, 0.4, H - 0.4);

        // contact damage
        const rate = (h.st === 'launch' ? HALO.launchContact : HALO.contact) * dt;
        if (h.st !== 'arrive') {
            for (const e of this.enemies) {
                if (e.dead || e.ghost || e.hp === Infinity) continue;
                if (Math.hypot(e.x - h.x, e.y - h.y) < HALO.r + e.r) this.damage(e, rate, null);
            }
            if (this.boss && this.boss.st === 'fight') {
                for (const part of this.boss.parts) {
                    if (!part.alive || part.hidden || part.armor) continue;
                    if (Math.hypot(part.x - h.x, part.y - h.y) < HALO.r + part.r) this.damageBossPart(part, rate * 0.6, null);
                }
            }
        }
    }

    attachHalo() {
        const h = this.halo, p = this.player;
        h.st = h.x >= p.x ? 'front' : 'back';
        this.fx('haloAttach', { x: h.x, y: h.y, side: h.st });
    }

    // ---------------------------------------------------------------- echoes (options)
    stepEchoes() {
        const p = this.player, n = this.S.power.echoes;
        if (p.alive && (this.trail.length === 0 || p.moving > 0.01)) {
            this.trail.push(p.x, p.y);
            if (this.trail.length > 600) this.trail.splice(0, this.trail.length - 600);
        }
        while (this.echoes.length < n) this.echoes.push({ x: p.x, y: p.y });
        this.echoes.length = n;
        const L = this.trail.length / 2;
        for (let i = 0; i < n; i++) {
            const k = Math.max(0, L - 1 - (i + 1) * 16);
            this.echoes[i].x = this.trail[k * 2] ?? p.x;
            this.echoes[i].y = this.trail[k * 2 + 1] ?? p.y;
        }
    }

    // ---------------------------------------------------------------- shooting
    shot(x, y, a, spd, kind, dmg, r, extra = null) {
        const s = { x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, k: kind, dmg, r, t: 0, life: 2.2 };
        if (extra) Object.assign(s, extra);
        this.pshots.push(s);
        return s;
    }

    stepFiring(inp, dt) {
        const p = this.player;
        if (!p.alive || this.state !== 'play') { p.charging = false; p.charge = 0; return; }
        const pw = this.S.power;
        const wantBeam = !!inp.beam;
        if (wantBeam) {
            if (!p.charging) this.fx('chargeStart', {});
            p.charging = true;
            p.charge = Math.min(1, p.charge + dt / PLAYER.chargeTime);
        } else if (p.charging) {
            p.charging = false;
            this.releaseBeam(p.charge);
            p.charge = 0;
        }
        const firing = !!inp.fire && !wantBeam;
        p.fireT -= dt; p.seekT -= dt;
        if (firing && p.fireT <= 0) {
            p.fireT = PLAYER.fireGap;
            this.shot(p.x + 0.6, p.y + 0.14, 0, 44, 'dart', 1, 0.24);
            this.shot(p.x + 0.6, p.y - 0.14, 0, 44, 'dart', 1, 0.24);
            for (const e of this.echoes) this.shot(e.x + 0.4, e.y, 0, 44, 'echo', 0.9, 0.22);
            this.fx('pshot', {});
        }
        if (firing && pw.seeker && p.seekT <= 0) {
            p.seekT = PLAYER.seekGap;
            const srcs = [p, ...this.echoes];
            srcs.forEach((s, i) => {
                const up = i % 2 ? -1 : 1;
                this.shot(s.x, s.y, up * 0.9, 9, 'seeker', 3.2, 0.26, { home: 6.5, life: 2.6, accel: 22, maxSpd: 20 });
            });
        }
        const h = this.halo;
        if (h && (h.st === 'front' || h.st === 'back' || h.st === 'free' || h.st === 'launch')) {
            h.fireT -= dt;
            if (firing && h.fireT <= 0) this.fireHalo(h);
        }
    }

    releaseBeam(c) {
        const p = this.player;
        if (c < PLAYER.chargeMin) {
            this.shot(p.x + 0.6, p.y, 0, 44, 'dart', 1.2, 0.26);
            return;
        }
        const k = (c - PLAYER.chargeMin) / (1 - PLAYER.chargeMin);
        this.shot(p.x + 0.9, p.y, 0, 38, 'beam', 10 + 42 * k, 0.45 + 0.85 * k, { pierce: Infinity, hit: new Set(), charge: k, life: 1.6 });
        this.fx('beam', { x: p.x, y: p.y, charge: k });
    }

    fireHalo(h) {
        const pw = this.S.power;
        const c = this.dawn ? 'dawn' : pw.halo.c, lv = pw.halo.lvl;
        const back = h.st === 'back';
        const base = back ? Math.PI : 0;
        h.n++;
        const fx = h.x + (back ? -0.5 : 0.5), fy = h.y;
        switch (c) {
            case 'red': {
                const angs = lv >= 2 ? [-0.38, -0.19, 0, 0.19, 0.38] : [-0.17, 0, 0.17];
                for (const a of angs) this.shot(fx, fy, base + a, 30, 'fire', lv >= 2 ? 1.5 : 1.3, lv >= 2 ? 0.42 : 0.34, { life: 1.4 });
                h.fireT = 0.15;
                break;
            }
            case 'blue': {
                this.shot(fx, fy, base, 58, 'laser', 1.3, 0.22, { pierce: 3, hit: new Set() });
                if (lv >= 2 && h.n % 2 === 0) {
                    for (const s of [-1, 1]) this.shot(fx, fy, base + s * 0.55 * (back ? -1 : 1), 40, 'diag', 1.15, 0.22, { bounce: 2, pierce: 2, hit: new Set() });
                }
                h.fireT = 0.09;
                break;
            }
            case 'gold': {
                const n = lv >= 2 ? 4 : 2;
                for (let i = 0; i < n; i++) {
                    const s = i % 2 ? -1 : 1, k = Math.floor(i / 2);
                    this.shot(fx, fy, base + s * (0.7 + k * 0.6), 11, 'mote', 2.6, 0.28, { home: 7, life: 2.4, accel: 16, maxSpd: 22 });
                }
                h.fireT = lv >= 2 ? 0.24 : 0.3;
                break;
            }
            case 'dawn': {
                for (const a of [-0.14, 0, 0.14]) this.shot(fx, fy, base + a, 52, 'dawn', 2.4, 0.36, { pierce: 4, hit: new Set() });
                if (h.n % 3 === 0) for (const s of [-1, 1]) this.shot(fx, fy, base + s * 1.0, 12, 'mote', 3, 0.3, { home: 8, life: 2.4, accel: 18, maxSpd: 24 });
                h.fireT = 0.08;
                break;
            }
            default: break;
        }
    }

    nearestTarget(x, y) {
        let best = null, bd = 1e9;
        for (const e of this.enemies) {
            if (e.dead || e.ghost || e.hp === Infinity || e.x > W + 0.5 || e.x < -0.5) continue;
            const d = Math.hypot(e.x - x, e.y - y);
            if (d < bd) { bd = d; best = e; }
        }
        if (this.boss && this.boss.st === 'fight') {
            for (const p of this.boss.parts) {
                if (!p.alive || p.hidden || p.armor || !(p.hp < Infinity)) continue;
                const d = Math.hypot(p.x - x, p.y - y) - 2;
                if (d < bd) { bd = d; best = p; }
            }
        }
        return best;
    }

    stepShots(dt) {
        const keep = [];
        for (const s of this.pshots) {
            s.t += dt;
            if (s.home) {
                const tg = this.nearestTarget(s.x, s.y);
                let a = Math.atan2(s.vy, s.vx);
                let sp = Math.hypot(s.vx, s.vy);
                if (s.accel) sp = Math.min(s.maxSpd, sp + s.accel * dt);
                if (tg && s.t > 0.08) {
                    let d = Math.atan2(tg.y - s.y, tg.x - s.x) - a;
                    while (d > Math.PI) d -= TAU;
                    while (d < -Math.PI) d += TAU;
                    a += clamp(d, -s.home * dt, s.home * dt);
                }
                s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
            }
            s.x += s.vx * dt; s.y += s.vy * dt;
            if (s.t > s.life || s.x > W + 3 || s.x < -3) continue;
            if (s.k === 'diag' && s.bounce > 0) {
                const t = this.terrain.at(this.scroll + s.x);
                const top = Math.min(H, t.ceil), bot = Math.max(0, t.floor);
                if (s.y > top && s.vy > 0) { s.vy = -s.vy; s.y = top; s.bounce--; }
                else if (s.y < bot && s.vy < 0) { s.vy = -s.vy; s.y = bot; s.bounce--; }
            }
            if (s.y > H + 2 || s.y < -2) continue;
            const t = this.terrain.at(this.scroll + s.x);
            if (s.y < t.floor || s.y > t.ceil) { this.fx('spark', { x: s.x, y: s.y, k: s.k }); continue; }
            if (this.shotVsBlocks(s)) continue;
            if (this.shotVsEnemies(s)) continue;
            if (this.boss && this.shotVsBoss(s)) continue;
            keep.push(s);
        }
        this.pshots = keep;
    }

    shotVsBlocks(s) {
        for (const b of this.blocks) {
            const x0 = b.wx - this.scroll - b.w / 2;
            if (s.x > x0 - s.r * 0.5 && s.x < x0 + b.w + s.r * 0.5 && s.y > b.y0 && s.y < b.y1) {
                if (b.hp < Infinity) {
                    b.hp -= s.dmg; b.flash = 0.06;
                    if (b.hp <= 0) {
                        this.fx('blockBreak', { x: x0 + b.w / 2, y: (b.y0 + b.y1) / 2, w: b.w, h: b.y1 - b.y0, kind: b.kind, id: b.id });
                        this.addScore(300);
                        this.blocks = this.blocks.filter((q) => q !== b);
                    }
                }
                this.fx('spark', { x: s.x, y: s.y, k: s.k });
                return true;
            }
        }
        return false;
    }

    /** Returns true if the shot is used up. */
    hitCheck(s, target) {
        if (s.hit) {
            if (s.hit.has(target)) return false;
            s.hit.add(target);
        }
        return true;
    }

    shotVsEnemies(s) {
        for (const e of this.enemies) {
            if (e.dead || e.ghost) continue;
            if (e.rect) {
                const r = e.rect;
                if (e.def?.blocksShots || KINDS[e.kind].blocksShots) {
                    if (s.x > r.x0 && s.x < r.x1 && s.y > r.y0 && s.y < r.y1) { this.fx('spark', { x: s.x, y: s.y, k: s.k }); return true; }
                }
                continue;
            }
            if (e.hp === Infinity && !e.parts) continue;
            if (e.parts) {
                for (const p of e.parts) {
                    if (!p.alive) continue;
                    if (Math.hypot(p.x - s.x, p.y - s.y) < p.r + s.r) {
                        if (!this.hitCheck(s, p)) continue;
                        if (p.armor) { this.fx('spark', { x: s.x, y: s.y, k: s.k }); if (s.k !== 'beam') return true; continue; }
                        p.hp -= s.dmg; p.flash = 0.06;
                        this.fx('hit', { x: s.x, y: s.y });
                        if (p.hp <= 0) { p.alive = false; this.addScore(p.score || 100); this.fx('explode', { x: p.x, y: p.y, size: 0.8, kind: e.kind }); }
                        if (!s.pierce || --s.pierce <= 0) return true;
                    }
                }
            }
            if (e.hp === Infinity) continue;
            if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r) {
                if (!this.hitCheck(s, e)) continue;
                if (e.stone) { this.fx('spark', { x: s.x, y: s.y, k: s.k }); if (s.k !== 'beam') return true; continue; }
                this.damage(e, s.dmg, s);
                if (!s.pierce || --s.pierce <= 0) return true;
            }
        }
        return false;
    }

    damage(e, dmg, s) {
        if (e.dead) return;
        e.hp -= dmg;
        e.flash = 0.06;
        if (s) this.fx('hit', { x: s.x, y: s.y });
        if (e.hp <= 0) this.killEnemy(e);
    }

    killEnemy(e) {
        e.dead = true;
        const def = KINDS[e.kind];
        this.addScore(e.score);
        this.stats.killed++;
        this.S.stats.kills++;
        this.fx('explode', { x: e.x, y: e.y, size: def.big ? 2.2 : Math.max(0.7, e.r * 1.6), kind: e.kind });
        if (def.death) def.death(e, this);
        if (e.kind === 'carrier') this.dropItem(e.x, e.y, e.item);
        if (def.shards) for (let i = 0; i < def.shards; i++) this.dropItem(e.x + (i - def.shards / 2) * 0.7, e.y + ((i % 2) - 0.5), 'shard');
        if (e.parts) for (const p of e.parts) if (p.alive && p.hp < Infinity) { p.alive = false; this.addScore(p.score || 100); this.fx('explode', { x: p.x, y: p.y, size: 0.7, kind: e.kind, delay: 0.05 }); }
        const g = e.group;
        if (g) { g.killed++; g.x = e.x; g.y = e.y; this.checkGroup(g); }
        if (this.D.revenge && !def.big && e.x > 9 && e.x < W && this.player.alive && e.kind !== 'mine' && e.kind !== 'crystal') {
            this.fire(e.x, e.y, this.aim(e.x, e.y), 5.2, 'orb');
        }
    }

    checkGroup(g) {
        if (g.done || g.killed + g.escaped < g.n || g.n === 0) return;
        g.done = true;
        if (g.escaped === 0) { this.dropItem(g.x, g.y, g.item); this.fx('groupBonus', { x: g.x, y: g.y }); this.addScore(1000); }
    }

    shotVsBoss(s) {
        const b = this.boss;
        if (b.st !== 'fight') return false;
        for (const p of b.parts) {
            if (!p.alive || p.hidden) continue;
            if (Math.hypot(p.x - s.x, p.y - s.y) < p.r + s.r) {
                if (!this.hitCheck(s, p)) continue;
                if (p.armor) {
                    this.fx('spark', { x: s.x, y: s.y, k: s.k, armor: true });
                    if (s.k === 'beam') { s.dmg *= 0.5; if (s.dmg < 4) return true; continue; }
                    return true;
                }
                this.damageBossPart(p, s.dmg, s);
                if (!s.pierce || --s.pierce <= 0) return true;
            }
        }
        return false;
    }

    damageBossPart(p, dmg, s) {
        const b = this.boss;
        if (!p.alive || !(p.hp < Infinity)) return;
        p.hp -= dmg;
        p.flash = 0.06;
        if (s) this.fx('hit', { x: s.x, y: s.y, boss: true });
        if (p.hp <= 0) {
            p.alive = false;
            this.addScore(p.score ?? 2000);
            this.fx('explode', { x: p.x, y: p.y, size: p.core ? 3 : 1.8, kind: 'boss' });
            if (b.def.partDown) b.def.partDown(b, p, this);
            if (p.core) this.bossDown();
        }
    }

    bossDown() {
        const b = this.boss;
        if (b.st === 'dying' || b.st === 'dead') return;
        b.st = 'dying'; b.deadT = 0;
        this.stats.bossTime = b.t;
        this.addScore(b.def.score ?? 20000);
        for (const bl of this.bullets) this.fx('cancel', { x: bl.x, y: bl.y });
        this.addScore(this.bullets.length * 10);
        this.bullets.length = 0;
        this.lasers.length = 0;
        for (const e of this.enemies) if (!e.dead && e.hp < Infinity) this.killEnemy(e);
        this.pull = 0;
        this.fx('bossDie', { x: b.x, y: b.y, kind: b.kind });
    }

    // ---------------------------------------------------------------- enemies
    stepEnemies(dt) {
        const p = this.player;
        const keep = [];
        for (const e of this.enemies) {
            if (e.dead) continue;
            e.t += dt; e.dt = dt;
            if (e.flash > 0) e.flash -= dt;
            KINDS[e.kind].step(e, this, dt);
            if (e.x < W + 0.3) e.seen = true;
            const off = e.x < -3.5 || e.x > W + 6 || e.y < -4 || e.y > H + 4;
            if (e.gone || (off && (e.seen || e.t > 6))) {
                if (e.group) { e.group.escaped++; this.checkGroup(e.group); }
                continue;
            }
            // contact
            if (p.alive && p.inv <= 0 && !e.noContact && this.state === 'play') {
                let hit = false;
                if (e.rect) {
                    const r = e.rect;
                    hit = p.x + PLAYER.r > r.x0 && p.x - PLAYER.r < r.x1 && p.y + PLAYER.r > r.y0 && p.y - PLAYER.r < r.y1;
                } else {
                    if (!e.ghost && Math.hypot(e.x - p.x, e.y - p.y) < e.r * 0.82 + PLAYER.r) hit = true;
                    if (!hit && e.parts) for (const q of e.parts) if (q.alive && Math.hypot(q.x - p.x, q.y - p.y) < q.r * 0.8 + PLAYER.r) { hit = true; break; }
                }
                if (hit) this.hurt();
            }
            keep.push(e);
        }
        this.enemies = keep;
    }

    // ---------------------------------------------------------------- boss
    stepBoss(dt) {
        const b = this.boss;
        b.t += dt;
        for (const p of b.parts) if (p.flash > 0) p.flash -= dt;
        if (b.st === 'dying') {
            b.deadT += dt;
            if (b.def.dying) b.def.dying(b, this, dt);
            if (Math.floor(b.deadT * 9) !== Math.floor((b.deadT - dt) * 9)) {
                const p = b.parts[Math.floor(this.rng() * b.parts.length)];
                this.fx('explode', { x: p.x + this.rng.range(-1, 1), y: p.y + this.rng.range(-1, 1), size: 1.4, kind: 'boss' });
            }
            if (b.deadT > 3.6) {
                b.st = 'dead';
                this.fx('bossGone', { x: b.x, y: b.y, kind: b.kind });
                this.state = 'clear'; this.stateT = 0;
            }
            return;
        }
        if (b.st === 'dead') return;
        b.def.step(b, this, dt);
        const p = this.player;
        if (b.st === 'fight' && p.alive && p.inv <= 0 && this.state === 'play') {
            for (const q of b.parts) {
                if (!q.alive || !q.body || q.hidden) continue;
                if (Math.hypot(q.x - p.x, q.y - p.y) < q.r * 0.85 + PLAYER.r) { this.hurt(); break; }
            }
        }
    }

    // ---------------------------------------------------------------- bullets, lasers
    stepBullets(dt) {
        const p = this.player, h = this.halo;
        const haloBlocks = h && h.st !== 'arrive';
        const keep = [];
        for (const b of this.bullets) {
            b.t += dt;
            if (b.home && b.t < b.homeT && p.alive) {
                let a = Math.atan2(b.vy, b.vx);
                const sp = Math.hypot(b.vx, b.vy);
                let d = Math.atan2(p.y - b.y, p.x - b.x) - a;
                while (d > Math.PI) d -= TAU;
                while (d < -Math.PI) d += TAU;
                a += clamp(d, -b.home * dt, b.home * dt);
                b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
            }
            if (b.curve) {
                const a = Math.atan2(b.vy, b.vx) + b.curve * dt, sp = Math.hypot(b.vx, b.vy);
                b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
            }
            if (b.acc) {
                const sp = Math.hypot(b.vx, b.vy), ns = clamp(sp + b.acc * dt, b.minSpd ?? 0.5, b.maxSpd ?? 14);
                if (sp > 1e-4) { b.vx *= ns / sp; b.vy *= ns / sp; }
            }
            if (b.gy) b.vy += b.gy * dt;
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < -1.5 || b.x > W + 3 || b.y < -1.5 || b.y > H + 1.5 || b.t > 12) continue;
            if (b.t > 0.25 && !b.noWall) {
                const t = this.terrain.at(this.scroll + b.x);
                if (b.y < t.floor - 0.15 || b.y > t.ceil + 0.15) { this.fx('bspark', { x: b.x, y: b.y }); continue; }
            }
            if (haloBlocks && Math.hypot(b.x - h.x, b.y - h.y) < HALO.r + b.r) { this.fx('absorb', { x: b.x, y: b.y }); continue; }
            if (p.alive && p.inv <= 0 && this.state === 'play' && Math.hypot(b.x - p.x, b.y - p.y) < b.r + PLAYER.r) {
                this.hurt();
                if (!p.alive || p.inv > 0) continue;
            }
            keep.push(b);
        }
        this.bullets = keep;
    }

    stepLasers(dt) {
        const p = this.player;
        const keep = [];
        for (const l of this.lasers) {
            l.t += dt;
            if (l.owner && !l.owner.isBoss) {
                if (l.owner.dead || l.owner.gone) { if (l.t < l.warn) continue; }
                else { l.x = l.owner.x - 0.6; l.y = l.owner.y; }
            }
            if (l.va) l.a += l.va * dt;
            if (l.t > l.warn + l.dur) continue;
            l.on = l.t >= l.warn;
            if (l.on && p.alive && p.inv <= 0 && this.state === 'play') {
                const dx = Math.cos(l.a), dy = Math.sin(l.a);
                const px = p.x - l.x, py = p.y - l.y;
                const along = px * dx + py * dy;
                if (along > 0 && along < l.len && Math.abs(px * dy - py * dx) < l.w + PLAYER.r) this.hurt();
            }
            keep.push(l);
        }
        this.lasers = keep;
    }

    // ---------------------------------------------------------------- items
    stepItems(dt) {
        const p = this.player;
        const keep = [];
        for (const it of this.items) {
            it.t += dt;
            const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
            if (p.alive && d < 2.4) { it.x += (dx / d) * 9 * dt; it.y += (dy / d) * 9 * dt; }
            else { it.x -= 1.7 * dt; it.y += Math.sin(it.t * 2.2) * 0.6 * dt; }
            if (p.alive && d < 0.95) { this.pickup(it.kind, it); continue; }
            if (it.x < -1.5) continue;
            keep.push(it);
        }
        this.items = keep;
    }

    pickup(kind, it) {
        const pw = this.S.power;
        let bonus = 0;
        switch (kind) {
            case 'red': case 'blue': case 'gold':
                if (!pw.halo) pw.halo = { c: kind, lvl: 1 };
                else if (pw.halo.c === kind) { if (pw.halo.lvl >= 2) bonus = 2000; pw.halo.lvl = 2; }
                else pw.halo.c = kind;
                break;
            case 'wing': if (pw.speed >= 4) bonus = 1000; pw.speed = Math.min(4, pw.speed + 1); break;
            case 'echo': if (pw.echoes >= 2) bonus = 2000; pw.echoes = Math.min(2, pw.echoes + 1); break;
            case 'seeker': if (pw.seeker) bonus = 1500; pw.seeker = true; break;
            case 'aegis': pw.aegis = 3; break;
            case 'life': if (this.S.lives < MAX_LIVES) this.S.lives++; else bonus = 5000; break;
            case 'shard': bonus = 200; this.stats.shards++; break;
            default: break;
        }
        if (bonus) this.addScore(bonus);
        this.fx('pickup', { kind, x: it.x, y: it.y, bonus });
    }

    stepBlocks() {
        this.blocks = this.blocks.filter((b) => b.wx - this.scroll + b.w > -4);
        for (const b of this.blocks) if (b.flash > 0) b.flash -= 1 / 120;
    }

    // ---------------------------------------------------------------- queries
    get progress() { return Math.min(1, this.scroll / this.stage.len); }
    bossFrac() {
        const b = this.boss;
        if (!b) return 0;
        if (b.st === 'dying' || b.st === 'dead') return 0;
        return b.def.frac ? b.def.frac(b) : 1;
    }
}
