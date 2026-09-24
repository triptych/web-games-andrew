// ============================================================
// The simulation: one level being played. Pure — no DOM, no audio, no
// Math.random. It talks to the outside world through `events` (a bounded
// queue drained once a frame by main.js for sound, shake and screens).
//
// profile = { gadgets:Set, weapons:[...], maxHearts, chips, shards:Set('w-l-s'), vaults:Set('w-l') }
// run     = { score, coins, lives }   (mutated in place)
// ============================================================

import { TILE, PHYS, WEAPONS, FREEZE_TIME, BUBBLE_FREEZE, POWER, SCORE, COINS_PER_LIFE, WORLDS } from './config.js';
import { T, K, gameKind } from './tiles.js';
import { RNG, clamp } from './rng.js';
import { moveX, moveY, stepPlayer, newPlayerBody } from './physics.js';
import { ENEMY, makeEnemy } from './enemies.js';
import { BOSS, makeBoss } from './bosses.js';

const PK = new Uint8Array(32), EK = new Uint8Array(32);
for (let t = 0; t < 32; t++) {
    PK[t] = gameKind(t);
    EK[t] = t === T.HIDDEN ? K.EMPTY : gameKind(t);
}
const ESHOT = {
    spore: { w: 6, h: 6, g: 500 },
    needle: { w: 8, h: 4, g: 0 },
    rain: { w: 4, h: 6, g: 350 },
    sand: { w: 6, h: 6, g: 600 },
    crystal: { w: 6, h: 6, g: 0 },
    fireball: { w: 8, h: 8, g: 600, bounce: 2 },
    bomb: { w: 10, h: 10, g: 500, fuse: 1.1 },
    wave: { w: 12, h: 12, g: 0, floor: true },
    blast: { w: 44, h: 44, g: 0, life: 0.3 },
};

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const yOut = { landed: false, ground: 0, rect: null, head: null, headY: 0, hidden: null };

export class Game {
    constructor(level, profile, run, opts = {}) {
        this.level = level;
        this.w = level.w; this.h = level.h;
        this.W = level.w * TILE; this.H = level.h * TILE;
        this.tiles = level.tiles.slice();
        this.contents = { ...level.contents };
        this.brickCoins = {};
        this.profile = profile;
        this.run = run;
        this.rng = new RNG((level.seed ^ 0x5bd1e995) >>> 0);
        this.events = [];
        this.t = 0;
        this.time = level.time;
        this.viewW = 400; this.viewH = 240;
        this.phase = 'play'; this.phaseT = 0;
        this.cam = { x: 0, y: 0 };
        this.shake = 0;
        this.enemies = []; this.shots = []; this.eshots = []; this.items = []; this.parts = [];
        this.pickups = []; this.lifts = []; this.firebars = []; this.bumps = []; this.iceTiles = [];
        this.boss = null; this.bossLocked = false;
        this.checkpoint = null; this.goal = null; this.castle = null;
        this.gotShards = new Set();
        this.stats = { kills: 0, coins: 0, stomps: 0, shots: 0, hurts: 0, pits: 0 };
        this.fireHeld = false;

        const lw = level.world, li = level.index;
        for (const e of level.entities) {
            switch (e.t) {
                case 'enemy': this.enemies.push(makeEnemy(e.kind, e.x, e.y)); break;
                case 'shard': {
                    const key = `${lw}-${li}-${e.slot}`;
                    this.pickups.push({ t: 'shard', slot: e.slot, x: e.x * TILE + 2, y: e.y * TILE + 2, w: 12, h: 12, ghost: profile.shards.has(key), pocket: e.pocket, bob: this.rng.next() * 6 });
                    break;
                }
                case 'vault': {
                    const key = `${lw}-${li}`;
                    if (!profile.vaults.has(key)) this.pickups.push({ t: 'vault', item: e.item, x: e.x * TILE + 1, y: e.y * TILE + 1, w: 14, h: 14, pocket: e.pocket, bob: 0 });
                    break;
                }
                case 'checkpoint': this.checkpoint = { x: e.x, y: e.y, on: false }; break;
                case 'goal': this.goal = { x: e.x, y: e.y, top: e.top, flagY: e.top * TILE + 4 }; break;
                case 'castle': this.castle = { x: e.x, y: e.y }; break;
                case 'lift': this.lifts.push({ x: e.x * TILE, y: e.y * TILE, w: 48, h: 8, x0: e.x0 * TILE, x1: e.x1 * TILE, dir: 1, speed: e.speed, dx: 0, oneway: true, lift: true }); break;
                case 'firebar': this.firebars.push({ cx: e.x * TILE + 8, cy: e.y * TILE + 8, len: e.len, speed: e.speed, a: this.rng.next() * Math.PI * 2 }); break;
                case 'boss': this.bossSpawn = e; break;
            }
        }
        if (level.arena) {
            const a = level.arena;
            this.arenaPx = { x0: a.x0 * TILE, x1: (a.x1 + 1) * TILE, top: a.top * TILE, floor: a.floor * TILE };
        }

        let sx = level.start.x, sy = level.start.y;
        if (opts.checkpoint && this.checkpoint) { sx = this.checkpoint.x; sy = this.checkpoint.y; this.checkpoint.on = true; }
        const p = newPlayerBody(sx * TILE + TILE / 2 - PHYS.w / 2, (sy + 1) * TILE - PHYS.h);
        Object.assign(p, {
            hp: profile.maxHearts, invuln: 0, star: 0, pepper: 0, shield: false,
            weaponIdx: Math.min(opts.weaponIdx || 0, profile.weapons.length - 1), fireCd: 0, aim: 'fwd',
            dead: false, anim: 0, chain: 0, lastSafe: null, hidden: false, fireFlash: 0, prevBottom: 0,
        });
        this.player = p;
        this.env = { w: this.w, h: this.h, rects: [], kind: (tx, ty) => PK[this.tiles[ty * this.w + tx]] };
        this.envE = { w: this.w, h: this.h, rects: [], kind: (tx, ty) => EK[this.tiles[ty * this.w + tx]] };
        this.ab = { boots: profile.gadgets.has('boots'), mitts: profile.gadgets.has('mitts') };
        // where each bottomless pit visibly starts (for the renderer's abyss)
        this.pitTop = new Int16Array(this.w).fill(-1);
        const surf = level.surf || [];
        for (let x = 0; x < this.w; x++) {
            if (surf[x] !== -1 || this.tile(x, this.h - 3) === T.LAVA) continue;
            let l = x, r = x;
            while (l > 0 && surf[l] === -1) l--;
            while (r < this.w - 1 && surf[r] === -1) r++;
            this.pitTop[x] = Math.max(surf[l] >= 0 ? surf[l] : 0, surf[r] >= 0 ? surf[r] : 0) + 1;
        }
        this.snapCamera();
    }

    // ---------------------------------------------------- helpers for entities
    event(type, data = {}) {
        this.events.push({ type, ...data });
        if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
    }
    tile(tx, ty) { return (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) ? T.EMPTY : this.tiles[ty * this.w + tx]; }
    setTile(tx, ty, t) { if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.tiles[ty * this.w + tx] = t; }
    solidAt(px, py) {
        const t = this.tile(Math.floor(px / TILE), Math.floor(py / TILE));
        return PK[t] === K.SOLID;
    }
    near(e, dist) { return Math.abs(this.player.x - e.x) < dist && Math.abs(this.player.y - e.y) < dist * 0.8; }
    countEnemies(kind) { return this.enemies.filter(e => !e.dead && e.kind === kind).length; }

    moveEnemy(e, dt, noGrav = false) {
        const r = { wall: false, landed: false };
        if (!e.def.fly || noGrav) {
            if (!noGrav) { e.vy = Math.min(e.vy + 900 * dt, 330); }
        }
        const hx = moveX(e, e.vx * dt, this.envE);
        if (hx !== 0) r.wall = true;
        moveY(e, e.vy * dt, this.envE, yOut);
        e.onGround = false;
        if (yOut.landed) { e.vy = 0; e.onGround = true; r.landed = true; }
        else if (yOut.head && e.vy < 0) e.vy = 0;
        if (e.y > this.H + 32) { e.dead = true; e.gone = true; }
        return r;
    }
    groundAhead(e) {
        const x = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
        const tx = Math.floor(x / TILE), ty = Math.floor((e.y + e.h + 1) / TILE);
        const k = EK[this.tile(tx, ty)];
        return k === K.SOLID || k === K.ONEWAY;
    }
    shootAt(kind, x, y, vx, vy, grav) {
        const d = ESHOT[kind];
        this.eshots.push({ kind, x: x - d.w / 2, y: y - d.h / 2, w: d.w, h: d.h, vx, vy, g: grav ? 400 : d.g, bounce: d.bounce || 0, fuse: d.fuse || 0, life: d.life || 6, t: 0 });
    }
    spawnEnemyPx(kind, x, y, dir) {
        const e = makeEnemy(kind, 0, 0);
        e.x = x - e.w / 2; e.y = y - e.h; e.dir = dir || -1; e.active = true;
        this.enemies.push(e);
        this.puff(x, y - 6, 'dust', 6);
    }
    dust(x, y) { if (this.rng.chance(0.5)) this.parts.push({ k: 'dust', x: x + this.rng.range(-8, 8), y, vx: this.rng.range(-30, 30), vy: this.rng.range(-80, -20), life: 0.5, max: 0.5 }); }
    quake() {
        const p = this.player;
        if (p.onGround && !p.dead) { p.vy = -170; p.onGround = false; }
    }
    shockwave(x, y, dir) { this.shootAt('wave', x, y - 6, dir * 150, 0); }
    shellHits(shell) {
        for (const e of this.enemies) {
            if (e === shell || e.dead || !e.active || e.def.invuln || e.hidden) continue;
            if (overlap(shell, e)) { this.killEnemy(e, 'shell'); this.chainScore(e.x, e.y); }
        }
    }
    puff(x, y, k, n, spread = 60) {
        for (let i = 0; i < n; i++) {
            const a = this.rng.range(0, Math.PI * 2), s = this.rng.range(spread * 0.3, spread);
            this.parts.push({ k, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: this.rng.range(0.3, 0.6), max: 0.6 });
        }
    }
    popup(x, y, text) { this.parts.push({ k: 'text', x, y, vx: 0, vy: -30, life: 0.9, max: 0.9, text }); }
    addScore(n, x, y) {
        this.run.score += n;
        if (x !== undefined) this.popup(x, y, String(n));
    }
    addCoin(n = 1) {
        this.run.coins += n;
        this.stats.coins += n;
        this.addScore(SCORE.coin * n);
        this.event('sfx', { name: 'coin' });
        while (this.run.coins >= COINS_PER_LIFE) { this.run.coins -= COINS_PER_LIFE; this.oneUp(); }
    }
    oneUp(x, y) {
        this.run.lives = Math.min(99, this.run.lives + 1);
        this.event('sfx', { name: 'oneup' });
        if (x !== undefined) this.popup(x, y, '1UP');
    }
    chainScore(x, y) {
        const p = this.player;
        if (p.chain >= SCORE.stomp.length) { this.oneUp(x, y); }
        else this.addScore(SCORE.stomp[p.chain], x, y);
        p.chain++;
    }

    get weapon() { return this.profile.weapons[this.player.weaponIdx] || 'pea'; }
    get dmgBonus() { return this.profile.chips || 0; }

    // ---------------------------------------------------- main step
    step(inp, dt) {
        this.t += dt;
        this.phaseT += dt;
        const p = this.player;
        if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 12);

        if (this.phase === 'dying') {
            p.vy += 900 * dt; p.y += p.vy * dt;
            if (this.phaseT > 2.2) { this.phase = 'dead'; this.event('died'); }
            this.updateParts(dt);
            return;
        }
        if (this.phase === 'dead' || this.phase === 'done') { this.updateParts(dt); return; }
        if (this.phase === 'flag' || this.phase === 'walkout' || this.phase === 'tally') {
            this.stepOutro(inp, dt);
            this.updateParts(dt);
            this.updateCamera(dt);
            return;
        }

        if (this.phase === 'play') this.time = Math.max(0, this.time - dt);

        // ---- world objects that the player can stand on
        for (const L of this.lifts) {
            const nx = L.x + L.dir * L.speed * dt;
            if (nx < L.x0) { L.dir = 1; } else if (nx > L.x1) { L.dir = -1; }
            L.dx = clamp(nx, L.x0, L.x1) - L.x;
            L.x += L.dx;
        }
        const rects = this.env.rects;
        rects.length = 0;
        for (const L of this.lifts) rects.push(L);
        for (const e of this.enemies) {
            if (e.frozen > 0 && !e.dead) { e.rect = e.rect || {}; Object.assign(e.rect, { x: e.x, y: e.y, w: e.w, h: e.h, oneway: false, dx: 0 }); rects.push(e.rect); }
        }

        // ---- player
        p.prevBottom = p.y + p.h;
        this.lastJumpHeld = !!inp.jump;
        const lockedInput = this.phase !== 'play';
        const pin = lockedInput ? NO_INPUT : inp;
        const run = p.star > 0 ? PHYS.starRun : PHYS.run;
        const fx = stepPlayer(p, pin, dt, this.env, this.ab, { run });
        p.anim += dt;
        if (fx.jumped) this.event('sfx', { name: 'jump' });
        if (fx.dj) { this.event('sfx', { name: 'dj' }); this.puff(p.x + p.w / 2, p.y + p.h, 'ring', 6, 40); }
        if (fx.wallJump) { this.event('sfx', { name: 'walljump' }); this.puff(p.x + (p.facing < 0 ? p.w : 0), p.y + p.h / 2, 'dust', 3, 30); }
        if (fx.spring) { this.event('sfx', { name: 'spring' }); this.springAnim(p); }
        if (fx.poundStart) this.event('sfx', { name: 'poundstart' });
        if (fx.wallSlide && this.rng.chance(0.2)) this.parts.push({ k: 'dust', x: p.x + (p.wallDir > 0 ? p.w : 0), y: p.y + p.h - 2, vx: 0, vy: -10, life: 0.3, max: 0.3 });
        if (fx.landed) { p.chain = 0; if (!fx.poundLand) this.event('sfx', { name: 'land' }); }
        if (fx.head && fx.head.length) this.headBump(fx.head, fx.headY);
        if (fx.poundLand) this.poundLand();
        if (p.onGround) p.chain = p.pounding ? p.chain : 0;

        // safe ground for pit respawns
        if (p.onGround && !p.ride && this.phase === 'play') this.recordSafe();

        // ---- aim + weapons
        if (inp.swapPressed && this.profile.weapons.length > 1) {
            p.weaponIdx = (p.weaponIdx + 1) % this.profile.weapons.length;
            this.event('sfx', { name: 'swap' });
            this.event('weapon', { weapon: this.weapon });
        }
        const horiz = inp.left || inp.right;
        p.aim = inp.up ? (horiz ? 'diag' : 'up') : 'fwd';
        p.fireCd = Math.max(0, p.fireCd - dt);
        p.fireFlash = Math.max(0, p.fireFlash - dt);
        if (inp.fire && p.fireCd <= 0 && !p.pounding) this.fire();

        // ---- tiles the player touches
        this.touchTiles();
        if (p.y > this.H + 8) this.fellInPit();

        // ---- timers
        if (p.invuln > 0) p.invuln -= dt;
        if (p.star > 0) { p.star -= dt; if (p.star <= 0) this.event('star', { on: false }); }
        if (p.pepper > 0) p.pepper -= dt;
        for (let i = this.iceTiles.length - 1; i >= 0; i--) {
            const it = this.iceTiles[i];
            it.t -= dt;
            if (it.t <= 0) { if (this.tile(it.x, it.y) === T.ICE) this.setTile(it.x, it.y, T.BUBBLE); this.iceTiles.splice(i, 1); }
        }
        for (let i = this.bumps.length - 1; i >= 0; i--) { this.bumps[i].t -= dt; if (this.bumps[i].t <= 0) this.bumps.splice(i, 1); }

        this.updatePickups(dt);
        this.updateItems(dt);
        this.updateFirebars(dt);
        this.updateEnemies(dt);
        this.updateBoss(dt);
        this.updateShots(dt);
        this.updateEShots(dt);
        this.updateParts(dt);
        this.updateCamera(dt);
    }

    recordSafe() {
        const p = this.player;
        const ty = Math.floor((p.y + p.h + 1) / TILE);
        const l = Math.floor(p.x / TILE), r = Math.floor((p.x + p.w - 0.01) / TILE);
        for (let tx = l - 1; tx <= r + 1; tx++) {
            const below = this.tile(tx, ty), at = this.tile(tx, ty - 1);
            if (tx >= l && tx <= r && (PK[below] !== K.SOLID || below === T.CRACK || below === T.ICE)) return;
            if (at === T.SPIKE || below === T.LAVA) return;
        }
        if (this.bossLocked) return;
        p.lastSafe = { x: p.x, y: p.y };
    }

    springAnim(p) {
        const tx = Math.floor((p.x + p.w / 2) / TILE), ty = Math.floor((p.y + p.h + 2) / TILE);
        this.bumps.push({ x: tx, y: ty, t: 0.2, spring: true });
    }

    // ---------------------------------------------------- blocks
    headBump(cols, ty) {
        const p = this.player;
        const cx = (p.x + p.w / 2) / TILE;
        let best = cols[0], bd = 99;
        for (const c of cols) { const d = Math.abs(c + 0.5 - cx); if (d < bd) { bd = d; best = c; } }
        this.bumpBlock(best, ty);
    }

    bumpBlock(tx, ty) {
        const t = this.tile(tx, ty);
        const idx = ty * this.w + tx;
        const c = this.contents[idx];
        const px = tx * TILE + TILE / 2, py = ty * TILE;
        if (t === T.QBLOCK || t === T.HIDDEN) {
            this.setTile(tx, ty, T.USED);
            this.bumps.push({ x: tx, y: ty, t: 0.15 });
            this.spawnContent(c || 'coin', px, py);
            if (t === T.HIDDEN) this.event('sfx', { name: 'secret' });
        } else if (t === T.BRICK) {
            if (c === 'coins') {
                this.brickCoins[idx] = (this.brickCoins[idx] || 0) + 1;
                this.spawnContent('coin', px, py);
                this.bumps.push({ x: tx, y: ty, t: 0.15 });
                if (this.brickCoins[idx] >= 8) this.setTile(tx, ty, T.USED);
            } else if (c) {
                this.setTile(tx, ty, T.USED);
                this.bumps.push({ x: tx, y: ty, t: 0.15 });
                this.spawnContent(c, px, py);
            } else {
                this.breakBrick(tx, ty);
            }
        } else {
            this.event('sfx', { name: 'bump' });
            return;
        }
        this.event('sfx', { name: 'bump' });
        // whatever stands on a bumped block gets popped
        for (const e of this.enemies) {
            if (e.dead || e.def.invuln || !e.active) continue;
            if (Math.abs(e.y + e.h - ty * TILE) < 3 && e.x + e.w > tx * TILE - 2 && e.x < (tx + 1) * TILE + 2) this.killEnemy(e, 'bump');
        }
        if (this.tile(tx, ty - 1) === T.COIN) { this.setTile(tx, ty - 1, T.EMPTY); this.spawnContent('coin', px, py - TILE); }
    }

    breakBrick(tx, ty) {
        this.setTile(tx, ty, T.EMPTY);
        delete this.contents[ty * this.w + tx];
        const x = tx * TILE + 8, y = ty * TILE + 8;
        for (const [vx, vy] of [[-60, -220], [60, -220], [-40, -140], [40, -140]]) this.parts.push({ k: 'debris', x, y, vx, vy, life: 1, max: 1, g: true });
        this.addScore(SCORE.brick);
        this.event('sfx', { name: 'brick' });
    }

    spawnContent(what, x, y) {
        if (what === 'coin') {
            this.addCoin(1);
            this.parts.push({ k: 'coinpop', x: x - 4, y: y - 14, vx: 0, vy: -260, life: 0.45, max: 0.45, g: true });
            return;
        }
        if (what === 'coins') { this.spawnContent('coin', x, y); return; }
        this.items.push({ kind: what, x: x - 6, y: y - 2, w: 12, h: 12, vx: 0, vy: 0, emerge: 0.45, ey: y - 12, t: 0, onGround: false, def: { fly: false } });
        this.event('sfx', { name: 'sprout' });
    }

    poundLand() {
        const p = this.player;
        this.event('sfx', { name: 'pound' });
        this.event('shake', { amt: 2 });
        this.puff(p.x + p.w / 2, p.y + p.h, 'dust', 6, 50);
        const ty = Math.floor((p.y + p.h + 1) / TILE);
        const l = Math.floor(p.x / TILE), r = Math.floor((p.x + p.w - 0.01) / TILE);
        let broke = false;
        for (let tx = l; tx <= r; tx++) {
            const t = this.tile(tx, ty);
            if (t === T.CRACK || (t === T.BRICK && !this.contents[ty * this.w + tx])) {
                if (t === T.CRACK) { this.setTile(tx, ty, T.EMPTY); this.puff(tx * TILE + 8, ty * TILE + 8, 'debris', 4, 80); this.event('sfx', { name: 'brick' }); }
                else this.breakBrick(tx, ty);
                broke = true;
            } else if (t === T.QBLOCK || (t === T.BRICK)) {
                this.bumpBlock(tx, ty);
            }
        }
        if (broke) { p.pounding = 2; p.vy = PHYS.poundV; p.onGround = false; }
        // shockwave flattens small things standing nearby
        for (const e of this.enemies) {
            if (e.dead || !e.active || e.def.invuln || e.frozen > 0 || e.hidden) continue;
            if (!e.def.stomp) continue;
            if (Math.abs(e.y + e.h - (p.y + p.h)) < 4 && Math.abs(e.x + e.w / 2 - (p.x + p.w / 2)) < 30) { this.killEnemy(e, 'pound'); this.chainScore(e.x, e.y); }
        }
    }

    // ---------------------------------------------------- touching tiles
    touchTiles() {
        const p = this.player;
        const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.01) / TILE);
        const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h - 0.01) / TILE);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
            const t = this.tile(tx, ty);
            if (t === T.COIN) {
                this.setTile(tx, ty, T.EMPTY);
                this.addCoin(1);
                this.parts.push({ k: 'sparkle', x: tx * TILE + 8, y: ty * TILE + 8, vx: 0, vy: 0, life: 0.25, max: 0.25 });
            } else if (t === T.SPIKE) {
                if (p.y + p.h > ty * TILE + 7) this.hurt(true);
            } else if (t === T.LAVA || t === T.LAVA_FILL) {
                if (p.y + p.h > ty * TILE + 6) { this.puff(p.x + 5, ty * TILE + 4, 'ember', 10, 90); this.event('sfx', { name: 'sizzle' }); this.fellInPit(); return; }
            }
        }
    }

    fellInPit() {
        const p = this.player;
        if (this.phase !== 'play') return;
        this.stats.pits++;
        if (p.hp <= 1 && p.star <= 0) { p.hp = 0; this.die(); return; }
        if (p.star <= 0) p.hp -= 1;
        const s = p.lastSafe || { x: this.level.start.x * TILE + 3, y: (this.level.start.y + 1) * TILE - PHYS.h };
        p.x = s.x; p.y = s.y; p.vx = 0; p.vy = 0; p.pounding = 0; p.onGround = false; p.ride = null;
        p.invuln = PHYS.invuln + 0.4;
        this.event('sfx', { name: 'pit' });
        this.puff(p.x + 5, p.y + 7, 'ring', 8, 50);
        this.snapCamera();
    }

    hurt(knockUp = false, src = null) {
        const p = this.player;
        if (p.invuln > 0 || p.star > 0 || this.phase !== 'play' || p.dead) return;
        if (p.shield) {
            p.shield = false; p.invuln = 1;
            this.event('sfx', { name: 'shieldpop' });
            this.puff(p.x + 5, p.y + 7, 'ring', 10, 60);
            return;
        }
        this.stats.hurts++;
        p.hp -= 1;
        p.invuln = PHYS.invuln;
        p.pounding = 0;
        const from = src ? Math.sign((p.x + p.w / 2) - (src.x + src.w / 2)) || -p.facing : -p.facing;
        p.vx = from * PHYS.hurtKnockX;
        p.vy = knockUp ? -260 : -PHYS.hurtKnockY;
        p.onGround = false;
        this.event('sfx', { name: 'hurt' });
        this.event('shake', { amt: 3 });
        if (p.hp <= 0) this.die();
    }

    die() {
        const p = this.player;
        if (this.phase !== 'play') return;
        p.dead = true; p.hp = 0;
        p.vy = -330; p.vx = 0;
        this.phase = 'dying'; this.phaseT = 0;
        this.event('die');
    }

    // ---------------------------------------------------- shooting
    fire() {
        const p = this.player;
        const wk = this.weapon;
        const W = WEAPONS[wk];
        const pepper = p.pepper > 0;
        p.fireCd = 1 / (W.rate * (pepper ? 2 : 1));
        p.fireFlash = 0.08;
        let dx = p.facing, dy = 0;
        if (p.aim === 'up') { dx = 0; dy = -1; }
        else if (p.aim === 'diag') { dx = p.facing * 0.7071; dy = -0.7071; }
        const ox = p.x + p.w / 2 + dx * 7, oy = p.y + 7 + dy * 8;
        const dmg = W.dmg + this.dmgBonus;
        const mk = (ang) => {
            const c = Math.cos(ang), s = Math.sin(ang);
            const vx = (dx * c - dy * s), vy = (dx * s + dy * c);
            const size = wk === 'rocket' ? 8 : wk === 'frost' ? 6 : 5;
            this.shots.push({ kind: wk, x: ox - size / 2, y: oy - size / 2, w: size, h: size, vx: vx * W.speed, vy: vy * W.speed, ux: vx, uy: vy, dmg, life: W.life, pierce: pepper, hit: new Set(), t: 0 });
        };
        if (wk === 'spread') { mk(-0.27); mk(0); mk(0.27); }
        else mk(0);
        this.stats.shots++;
        this.event('sfx', { name: 'shot_' + wk });
    }

    updateShots(dt) {
        for (let i = this.shots.length - 1; i >= 0; i--) {
            const s = this.shots[i];
            s.t += dt; s.life -= dt;
            if (s.kind === 'rocket') {
                const sp = Math.hypot(s.vx, s.vy) + WEAPONS.rocket.accel * dt;
                s.vx = s.ux * sp; s.vy = s.uy * sp;
                if (this.rng.chance(0.6)) this.parts.push({ k: 'smoke', x: s.x + 4, y: s.y + 4, vx: -s.ux * 20, vy: -10, life: 0.35, max: 0.35 });
            }
            s.x += s.vx * dt; s.y += s.vy * dt;
            let dead = s.life <= 0;
            // tiles
            const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
            const tx = Math.floor(cx / TILE), ty = Math.floor(cy / TILE);
            const t = this.tile(tx, ty);
            if (!dead) {
                if (t === T.BUBBLE && s.kind === 'frost') { this.freezeBubbles(tx, ty); dead = true; }
                else if (PK[t] === K.SOLID) {
                    if (s.kind === 'rocket') { this.explode(cx - s.ux * 4, cy - s.uy * 4); }
                    else { this.parts.push({ k: 'spark', x: cx - s.ux * 3, y: cy - s.uy * 3, vx: 0, vy: 0, life: 0.15, max: 0.15 }); this.event('sfx', { name: 'tink' }); }
                    dead = true;
                }
            }
            if (!dead) {
                for (const e of this.enemies) {
                    if (e.dead || !e.active || e.hidden || s.hit.has(e)) continue;
                    if (!overlap(s, e)) continue;
                    s.hit.add(e);
                    if (s.kind === 'rocket') { this.explode(cx, cy); dead = true; break; }
                    this.shotHitsEnemy(s, e);
                    if (!s.pierce) { dead = true; break; }
                }
            }
            if (!dead && this.boss && !this.boss.dead && this.boss.awake) {
                const b = this.boss;
                const boxes = [b];
                let hitBody = !b.hidden && overlap(s, b);
                if (!hitBody && b.def.parts) for (const part of b.def.parts(b)) if (overlap(s, part)) { hitBody = 'part'; break; }
                if (hitBody) {
                    if (s.kind === 'rocket') this.explode(cx, cy);
                    else if (hitBody === true && b.def.vulnerable(b)) this.damageBoss(s.dmg, cx, cy);
                    else { this.parts.push({ k: 'spark', x: cx, y: cy, vx: 0, vy: 0, life: 0.15, max: 0.15 }); this.event('sfx', { name: 'tink' }); }
                    dead = true;
                }
                void boxes;
            }
            // off-screen
            if (s.x < this.cam.x - 40 || s.x > this.cam.x + this.viewW + 40 || s.y < this.cam.y - 60 || s.y > this.cam.y + this.viewH + 40) dead = true;
            if (dead) this.shots.splice(i, 1);
        }
    }

    shotHitsEnemy(s, e) {
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        if (e.def.invuln) { this.parts.push({ k: 'spark', x: cx, y: cy, vx: 0, vy: 0, life: 0.15, max: 0.15 }); this.event('sfx', { name: 'tink' }); return; }
        if (s.kind === 'frost' && !e.def.noFreeze && !e.frozen) {
            e.frozen = FREEZE_TIME; e.vx = 0; e.vy = 0;
            this.event('sfx', { name: 'freeze' });
            this.puff(cx, cy, 'ice', 5, 40);
            return;
        }
        if (e.frozen && s.kind === 'frost') { e.frozen = FREEZE_TIME; return; }
        e.hp -= s.dmg;
        e.hurt = 0.15;
        this.event('sfx', { name: 'hit' });
        if (e.hp <= 0) { this.killEnemy(e, 'shot'); this.addScore(e.def.score || SCORE.shot, e.x, e.y); }
    }

    explode(x, y) {
        const R = WEAPONS.rocket.splash;
        this.parts.push({ k: 'boom', x, y, vx: 0, vy: 0, life: 0.35, max: 0.35 });
        this.puff(x, y, 'ember', 10, 110);
        this.event('sfx', { name: 'boom' });
        this.event('shake', { amt: 3 });
        const dmg = WEAPONS.rocket.dmg + this.dmgBonus;
        for (const e of this.enemies) {
            if (e.dead || !e.active || e.hidden) continue;
            const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
            if (Math.hypot(ex - x, ey - y) < R + e.w / 2) {
                if (e.def.invuln) continue;
                e.hp -= dmg; e.hurt = 0.15;
                if (e.hp <= 0 || e.frozen) { this.killEnemy(e, 'rocket'); this.addScore(e.def.score || SCORE.shot, e.x, e.y); }
            }
        }
        const b = this.boss;
        if (b && b.awake && !b.dead && !b.hidden && b.def.vulnerable(b)) {
            const bx = b.x + b.w / 2, by = b.y + b.h / 2;
            if (Math.abs(bx - x) < R + b.w / 2 && Math.abs(by - y) < R + b.h / 2) this.damageBoss(dmg, x, y);
        }
        // blast bricks and red rock
        const t0x = Math.floor((x - R) / TILE), t1x = Math.floor((x + R) / TILE);
        const t0y = Math.floor((y - R) / TILE), t1y = Math.floor((y + R) / TILE);
        for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
            const cx = tx * TILE + 8, cy = ty * TILE + 8;
            if (Math.hypot(cx - x, cy - y) > R + 6) continue;
            const t = this.tile(tx, ty);
            if (t === T.RED) this.breakRed(tx, ty);
            else if (t === T.BRICK && !this.contents[ty * this.w + tx]) this.breakBrick(tx, ty);
        }
    }

    breakRed(tx, ty) {
        const stack = [[tx, ty]];
        let n = 0;
        while (stack.length && n < 64) {
            const [x, y] = stack.pop();
            if (this.tile(x, y) !== T.RED) continue;
            this.setTile(x, y, T.EMPTY); n++;
            this.puff(x * TILE + 8, y * TILE + 8, 'rock', 4, 90);
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        this.event('sfx', { name: 'crumble' });
        this.event('secret');
    }

    freezeBubbles(tx, ty) {
        // freeze every bubble within reach of this one: the whole stair at once
        const seen = new Set();
        const stack = [[tx, ty]];
        while (stack.length) {
            const [x, y] = stack.pop();
            const k = y * this.w + x;
            if (seen.has(k)) continue;
            seen.add(k);
            const t = this.tile(x, y);
            if (t !== T.BUBBLE && t !== T.ICE) continue;
            if (t === T.BUBBLE) this.setTile(x, y, T.ICE);
            const it = this.iceTiles.find(i => i.x === x && i.y === y);
            if (it) it.t = BUBBLE_FREEZE; else this.iceTiles.push({ x, y, t: BUBBLE_FREEZE });
            this.puff(x * TILE + 8, y * TILE + 8, 'ice', 4, 40);
            for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
                const t2 = this.tile(x + dx, y + dy);
                if (t2 === T.BUBBLE || t2 === T.ICE) stack.push([x + dx, y + dy]);
            }
        }
        this.event('sfx', { name: 'freeze' });
    }

    // ---------------------------------------------------- enemies
    killEnemy(e, how) {
        if (e.dead) return;
        e.dead = true;
        e.deathHow = how;
        this.stats.kills++;
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        if (how === 'stomp' || how === 'pound') {
            this.parts.push({ k: 'squash', x: e.x, y: e.y, vx: 0, vy: 0, life: 0.4, max: 0.4, kind: e.kind, dir: e.dir, w: e.w, h: e.h });
        } else {
            this.parts.push({ k: 'flip', x: e.x, y: e.y, vx: (e.dir || 1) * 30, vy: -200, life: 1.2, max: 1.2, g: true, kind: e.kind, dir: e.dir, w: e.w, h: e.h });
        }
        this.puff(cx, cy, e.frozen ? 'ice' : 'pop', 6, 70);
        this.event('sfx', { name: e.frozen ? 'shatter' : 'pop' });
        if (e.def.splits && !e.mini && how !== 'rocket' && how !== 'star') {
            for (const d of [-1, 1]) {
                const m = makeEnemy('glint', 0, 0);
                m.mini = true; m.w = 10; m.h = 8; m.hp = 1;
                m.x = cx - 5 + d * 4; m.y = e.y + e.h - 8; m.dir = d; m.vy = -160; m.active = true;
                this.enemies.push(m);
            }
        }
    }

    updateEnemies(dt) {
        const p = this.player;
        const camC = this.cam.x + this.viewW / 2;
        for (const e of this.enemies) {
            if (e.dead) continue;
            const dxc = Math.abs(e.x - camC);
            if (!e.active) {
                if (dxc < this.viewW / 2 + 40 && Math.abs(e.y - (this.cam.y + this.viewH / 2)) < this.viewH / 2 + 60) {
                    e.active = true;
                    e.dir = e.x > p.x ? -1 : 1;
                } else continue;
            }
            if (dxc > this.viewW * 1.4) continue;     // asleep off-screen
            if (e.hurt > 0) e.hurt -= dt;
            if (e.kickGrace > 0) e.kickGrace -= dt;
            if (e.frozen > 0) {
                e.frozen -= dt;
                if (e.frozen <= 0) { e.frozen = 0; this.puff(e.x + e.w / 2, e.y + e.h / 2, 'ice', 4, 30); }
                continue;
            }
            e.def.update(e, this, dt);
            if (e.dead || e.hidden) continue;
            // player contact
            if (p.dead || this.phase !== 'play') continue;
            const pb = { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 1 };
            if (!overlap(pb, e)) continue;
            if (p.star > 0 && !e.def.invuln) {
                this.killEnemy(e, 'star'); this.chainScore(e.x, e.y); continue;
            }
            if (p.star > 0) continue;
            const fromAbove = p.vy > 0 && p.prevBottom <= e.y + 7;
            if (e.kind === 'snail' && e.state === 'shell' && e.kickGrace > 0) continue;
            if (e.kind === 'snail' && e.state === 'shell' && !(fromAbove && p.pounding)) {
                if (fromAbove) { this.stompBounce(); e.t = 0; this.event('sfx', { name: 'stomp' }); continue; }
                e.state = 'slide'; e.kickGrace = 0.25; e.t = 0;
                e.dir = (p.x + p.w / 2) < (e.x + e.w / 2) ? 1 : -1;
                e.x += e.dir * 4;
                this.addScore(400, e.x, e.y);
                this.event('sfx', { name: 'kick' });
                continue;
            }
            if (e.def.stomp && fromAbove) {
                this.stats.stomps++;
                if (e.kind === 'snail' && e.state !== 'shell' && !p.pounding) {
                    e.state = 'shell'; e.t = 0; e.vx = 0; e.kickGrace = 0.25;
                    this.chainScore(e.x, e.y);
                } else {
                    this.killEnemy(e, 'stomp');
                    this.chainScore(e.x, e.y);
                }
                if (!p.pounding) this.stompBounce();
                this.event('sfx', { name: 'stomp' });
                continue;
            }
            if (e.kind === 'snail' && e.state === 'slide' && e.kickGrace > 0) continue;
            this.hurt(false, e);
        }
        if (this.enemies.length > 80 || this.t % 5 < dt) this.enemies = this.enemies.filter(e => !e.dead);
    }

    stompBounce() {
        const p = this.player;
        p.vy = -(this.lastJumpHeld ? PHYS.stompBounceHeld : PHYS.stompBounce);
        p.rising = !!this.lastJumpHeld;
        p.djUsed = false;
        p.onGround = false;
    }

    updateFirebars(dt) {
        const p = this.player;
        for (const f of this.firebars) {
            f.a += f.speed * dt;
            if (p.dead || this.phase !== 'play') continue;
            for (let i = 1; i <= f.len; i++) {
                const x = f.cx + Math.cos(f.a) * i * 8, y = f.cy + Math.sin(f.a) * i * 8;
                if (x > p.x - 3 && x < p.x + p.w + 3 && y > p.y - 3 && y < p.y + p.h + 3) { this.hurt(false, { x: f.cx, y: f.cy, w: 0, h: 0 }); break; }
            }
        }
    }

    updateEShots(dt) {
        const p = this.player;
        for (let i = this.eshots.length - 1; i >= 0; i--) {
            const s = this.eshots[i];
            s.t += dt; s.life -= dt;
            s.vy += s.g * dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            let dead = s.life <= 0;
            const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
            if (s.kind === 'wave') {
                if (this.solidAt(cx + Math.sign(s.vx) * 8, cy)) dead = true;
                if (this.rng.chance(0.5)) this.parts.push({ k: 'dust', x: cx, y: s.y + s.h, vx: 0, vy: -40, life: 0.3, max: 0.3 });
            } else if (s.kind === 'bomb') {
                if (this.solidAt(cx, s.y + s.h)) { s.y = Math.floor((s.y + s.h) / TILE) * TILE - s.h; s.vy = 0; s.vx = 0; s.g = 0; }
                s.fuse -= dt;
                if (s.fuse <= 0) {
                    dead = true;
                    this.shootAt('blast', cx, cy, 0, 0);
                    this.parts.push({ k: 'boom', x: cx, y: cy, vx: 0, vy: 0, life: 0.35, max: 0.35 });
                    this.event('sfx', { name: 'boom' }); this.event('shake', { amt: 3 });
                }
            } else if (s.kind !== 'blast' && this.solidAt(cx, cy)) {
                if (s.bounce > 0 && s.vy > 0) { s.bounce--; s.vy = -Math.abs(s.vy) * 0.6; s.y -= 2; }
                else { dead = true; this.parts.push({ k: 'spark', x: cx, y: cy, vx: 0, vy: 0, life: 0.15, max: 0.15 }); }
            }
            if (!dead && !p.dead && this.phase === 'play') {
                const pb = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 3 };
                if (overlap(pb, s) && s.kind !== 'bomb') { this.hurt(false, s); if (s.kind !== 'blast' && s.kind !== 'wave') dead = true; }
            }
            if (s.y > this.H || s.x < this.cam.x - 100 || s.x > this.cam.x + this.viewW + 100) dead = true;
            if (dead) this.eshots.splice(i, 1);
        }
    }

    // ---------------------------------------------------- items & pickups
    updateItems(dt) {
        const p = this.player;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            it.t += dt;
            if (it.emerge > 0) {
                it.emerge -= dt;
                it.y = it.ey + 12 * Math.max(0, it.emerge / 0.45);
                if (it.emerge <= 0) { it.vx = (it.kind === 'berry' || it.kind === 'plush') ? 40 : it.kind === 'star' ? 60 : 0; if (it.kind === 'star') it.vy = -200; }
                continue;
            }
            if (it.kind === 'star') {
                it.vy = Math.min(it.vy + 700 * dt, 300);
                const hx = moveX(it, it.vx * dt, this.envE); if (hx) it.vx = -it.vx;
                moveY(it, it.vy * dt, this.envE, yOut);
                if (yOut.landed) it.vy = -230;
            } else {
                it.vy = Math.min(it.vy + 900 * dt, 300);
                const hx = moveX(it, it.vx * dt, this.envE); if (hx) it.vx = -it.vx;
                moveY(it, it.vy * dt, this.envE, yOut);
                if (yOut.landed) it.vy = 0;
            }
            if (it.y > this.H + 16 || it.t > 30) { this.items.splice(i, 1); continue; }
            if (!p.dead && overlap(p, it)) {
                this.collectItem(it);
                this.items.splice(i, 1);
            }
        }
    }

    collectItem(it) {
        const p = this.player;
        const x = it.x, y = it.y;
        switch (it.kind) {
            case 'berry':
                if (p.hp < this.profile.maxHearts) p.hp++; else this.addScore(SCORE.powerup, x, y);
                this.event('sfx', { name: 'powerup' });
                break;
            case 'star': p.star = POWER.star; this.event('star', { on: true }); this.event('sfx', { name: 'powerup' }); break;
            case 'pepper': p.pepper = POWER.pepper; this.event('sfx', { name: 'powerup' }); break;
            case 'shield': p.shield = true; this.event('sfx', { name: 'powerup' }); break;
            case 'plush': this.oneUp(x, y); break;
        }
        this.addScore(SCORE.powerup);
        this.popup(x, y - 4, ITEM_LABEL[it.kind] || '');
    }

    updatePickups(dt) {
        const p = this.player;
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const k = this.pickups[i];
            k.bob += dt;
            if (p.dead || !overlap(p, k)) continue;
            if (k.t === 'shard') {
                if (!k.ghost) { this.gotShards.add(k.slot); this.addScore(SCORE.shard, k.x, k.y); }
                this.event('shard', { slot: k.slot, ghost: k.ghost });
                this.puff(k.x + 6, k.y + 6, 'star', 12, 80);
            } else if (k.t === 'vault') {
                this.event('vault', { item: k.item });
                this.puff(k.x + 7, k.y + 7, 'star', 16, 90);
            } else if (k.t === 'gadget') {
                this.event('gadget', { item: k.item });
                this.phase = 'done';
            }
            this.pickups.splice(i, 1);
        }
        // checkpoint
        const c = this.checkpoint;
        if (c && !c.on && p.x + p.w > c.x * TILE && p.x < c.x * TILE + TILE && p.y < (c.y + 1) * TILE && p.y + p.h > (c.y - 2) * TILE) {
            c.on = true;
            if (p.hp < this.profile.maxHearts) p.hp++;
            this.event('checkpoint');
            this.event('sfx', { name: 'checkpoint' });
            this.puff(c.x * TILE + 8, c.y * TILE, 'star', 10, 60);
        }
        // flagpole
        const g = this.goal;
        if (g && this.phase === 'play' && p.x + p.w > g.x * TILE - 1 && p.y < (g.y + 1) * TILE) {
            if (p.y + p.h < g.top * TILE) p.y = g.top * TILE - p.h + 1;     // sailed over the top: still counts
            const frac = clamp(1 - (p.y + p.h - g.top * TILE) / ((g.y - g.top) * TILE), 0, 1);
            const pts = frac > 0.9 ? 5000 : frac > 0.7 ? 2000 : frac > 0.45 ? 800 : frac > 0.2 ? 400 : 100;
            if (pts === 5000) this.oneUp(p.x, p.y - 16);
            this.addScore(pts, p.x + 10, p.y);
            this.phase = 'flag'; this.phaseT = 0;
            p.x = g.x * TILE + 8 - p.w; p.vx = 0; p.vy = 0; p.facing = 1; p.pounding = 0;
            this.event('flag');
        }
    }

    stepOutro(inp, dt) {
        const p = this.player;
        const g = this.goal;
        if (this.phase === 'flag') {
            const bottom = g.y * TILE - p.h;
            if (p.y < bottom) p.y = Math.min(bottom, p.y + 110 * dt);
            g.flagY = Math.min(g.y * TILE - 12, g.flagY + 110 * dt);
            if (p.y >= bottom && this.phaseT > 1.1) { this.phase = 'walkout'; this.phaseT = 0; p.x += p.w + 6; p.y = g.y * TILE - p.h - 2; }
        } else if (this.phase === 'walkout') {
            stepPlayer(p, WALK_RIGHT, dt, this.env, this.ab, { run: 70 });
            p.anim += dt;
            const door = this.castle ? this.castle.x * TILE + 36 : g.x * TILE + 100;
            if (p.x >= door || this.phaseT > 6) { p.hidden = true; this.phase = 'tally'; this.phaseT = 0; this.event('castle'); }
        } else if (this.phase === 'tally') {
            if (this.phaseT > 0.6 && this.time > 0) {
                const n = Math.min(this.time, dt * 90);
                this.time -= n;
                this.run.score += Math.round(n * SCORE.timeBonus);
                this.tallyTick = (this.tallyTick || 0) + n;
                if (this.tallyTick > 3) { this.tallyTick = 0; this.event('sfx', { name: 'tick' }); }
            } else if (this.phaseT > 1.2 && this.time <= 0 || this.phaseT > 8) {
                this.time = 0;
                this.phase = 'done';
                this.event('clear');
            }
        }
    }

    // ---------------------------------------------------- boss
    updateBoss(dt) {
        const p = this.player;
        const a = this.arenaPx;
        if (!a) return;
        if (!this.boss && this.bossSpawn && p.x > a.x0 + TILE * 3 && this.phase === 'play') {
            // lock the door and wake the boss
            const ax = this.level.arena.x0;
            for (let y = this.level.arena.top; y < this.level.arena.floor; y++) this.setTile(ax, y, T.HARD);
            this.bossLocked = true;
            const s = this.bossSpawn;
            this.boss = makeBoss(s.kind, s.x, s.y);
            this.boss.arenaFloor = a.floor;
            this.boss.awake = true;
            this.event('boss', { name: this.boss.def.name });
            this.event('sfx', { name: 'door' });
        }
        const b = this.boss;
        if (!b) return;
        if (b.dead) {
            b.deadT += dt;
            if (b.deadT < 2 && this.rng.chance(0.5)) {
                this.parts.push({ k: 'boom', x: b.x + this.rng.range(0, b.w), y: b.y + this.rng.range(0, b.h), vx: 0, vy: 0, life: 0.35, max: 0.35 });
                if (this.rng.chance(0.3)) this.event('sfx', { name: 'boom' });
            }
            if (b.deadT >= 2 && !b.dropped) {
                b.dropped = true;
                const item = WORLDS[this.level.world - 1].gadget || 'sun';
                const cx = (a.x0 + a.x1) / 2;
                this.pickups.push({ t: 'gadget', item, x: cx - 8, y: a.floor - 26, w: 16, h: 16, bob: 0 });
                this.event('sfx', { name: 'appear' });
            }
            return;
        }
        if (b.hurt > 0) b.hurt -= dt;
        if (b.stompCd > 0) b.stompCd -= dt;
        // light-hearted: a berry drops in every 20s while Pip is hurt
        b.berryT = (b.berryT || 0) + dt;
        if (b.berryT > 20 && p.hp < this.profile.maxHearts && !this.items.some(it => it.kind === 'berry')) {
            b.berryT = 0;
            const x = clamp(p.x + (this.rng.chance(0.5) ? -60 : 60), a.x0 + 24, a.x1 - 36);
            this.items.push({ kind: 'berry', x, y: a.top + 4, w: 12, h: 12, vx: 0, vy: 0, emerge: 0, t: 0, onGround: false });
            this.event('sfx', { name: 'sprout' });
        }
        b.def.update(b, this, dt);
        if (p.dead || this.phase !== 'play') return;
        const pb = { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 1 };
        if (!b.hidden && overlap(pb, b)) {
            const fromAbove = p.vy > 0 && p.prevBottom <= b.y + 8;
            if (fromAbove && b.def.stompable(b) && !(b.stompCd > 0)) {
                this.damageBoss(3, p.x + 5, p.y + p.h);
                b.stompCd = 0.5;
                p.pounding = 0;
                this.stompBounce();
                p.vy = -PHYS.stompBounceHeld;
                this.event('sfx', { name: 'stomp' });
            } else if (!(b.stompCd > 0)) this.hurt(false, b);
        }
        if (b.def.parts) for (const part of b.def.parts(b)) if (overlap(pb, part)) { this.hurt(false, part); break; }
        if (b.def.hazards) for (const hz of b.def.hazards(b, this)) if (overlap(pb, hz)) { this.hurt(false, hz); break; }
    }

    damageBoss(n, x, y) {
        const b = this.boss;
        if (!b || b.dead) return;
        b.hp -= n;
        b.hurt = 0.18;
        this.parts.push({ k: 'spark', x, y, vx: 0, vy: 0, life: 0.2, max: 0.2 });
        this.event('sfx', { name: 'bosshit' });
        if (b.hp <= 0) {
            b.hp = 0; b.dead = true; b.deadT = 0;
            this.addScore(SCORE.boss, b.x + b.w / 2, b.y);
            for (const e of this.enemies) if (!e.dead && e.active) this.killEnemy(e, 'star');
            this.eshots.length = 0;
            this.event('bossdead');
            this.event('shake', { amt: 8 });
        }
    }

    // ---------------------------------------------------- particles + camera
    updateParts(dt) {
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const q = this.parts[i];
            q.life -= dt;
            if (q.life <= 0) { this.parts.splice(i, 1); continue; }
            if (q.g) q.vy += 700 * dt;
            q.x += q.vx * dt; q.y += q.vy * dt;
            if (q.k === 'dust' || q.k === 'pop' || q.k === 'ring' || q.k === 'ice' || q.k === 'star' || q.k === 'ember' || q.k === 'rock') { q.vx *= Math.pow(0.1, dt); q.vy *= Math.pow(0.1, dt); }
        }
        if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
    }

    snapCamera() { this.updateCamera(1, true); }

    updateCamera(dt, snap = false) {
        const p = this.player;
        const vw = this.viewW, vh = this.viewH;
        // Horizontal: lead a little in the direction Pip faces.
        let tx = p.x + p.w / 2 - vw * 0.42;
        // Vertical: platformer-style. Anchor to the last ground Pip stood on (feet ~3 tiles
        // above the bottom edge) so jumps don't bob the screen; only chase when Pip leaves
        // the comfortable band.
        if (p.onGround || snap || this.camGround === undefined) this.camGround = p.y + p.h;
        let ty = this.camGround + clamp(vh * 0.25, 52, 110) - vh;
        const topBand = vh * 0.28, botBand = TILE * 2;
        if (p.y < ty + topBand) ty = p.y - topBand;
        if (p.y + p.h > ty + vh - botBand) ty = p.y + p.h + botBand - vh;
        let minX = 0, maxX = this.W - vw;
        if (this.bossLocked && this.arenaPx) {
            const a = this.arenaPx;
            const mid = (a.x0 + a.x1) / 2;
            if (a.x1 - a.x0 <= vw) { minX = maxX = mid - vw / 2; }
            else { minX = a.x0; maxX = a.x1 - vw; }
            ty = Math.min(ty, a.floor + TILE * 1.5 - vh);
        }
        tx = clamp(tx, minX, Math.max(minX, maxX));
        ty = clamp(ty, 0, Math.max(0, this.H - vh));
        if (snap) { this.cam.x = tx; this.cam.y = ty; return; }
        this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 7);
        const dy = ty - this.cam.y;
        this.cam.y += dy * Math.min(1, dt * (Math.abs(dy) > vh * 0.3 ? 9 : 4));
        this.cam.x = clamp(this.cam.x, minX, Math.max(minX, maxX));
        this.cam.y = clamp(this.cam.y, 0, Math.max(0, this.H - vh));
    }

    /** Called by main every step with the raw input so stomps know if jump is held. */
    setJumpHeld(v) { this.lastJumpHeld = v; }
}

const NO_INPUT = { left: false, right: false, up: false, down: false, downPressed: false, jump: false, jumpPressed: false, fire: false };
const WALK_RIGHT = { left: false, right: true, up: false, down: false, downPressed: false, jump: false, jumpPressed: false, fire: false };
const ITEM_LABEL = { berry: 'BERRY!', star: 'STAR!', pepper: 'HOT!', shield: 'BUBBLE!', plush: '' };

export { ESHOT };
