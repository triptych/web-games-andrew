// The rules of one realm: SQUIRE, carrying, gates, dragons, the bat, THE NULL,
// lasers, pads, charges, the boss and the collapse. Pure: no DOM, no
// Math.random, no imports from the view. The world announces what happened on
// a bounded event queue (`w.events`) that the frame loop drains.

import { T, RW, RH, ROOM_W, ROOM_H, FLOOR, WALL, GATE, CHASM, CRACK, BARRIER, PLAYER, DRAGONS, SKILL, SCORE } from '../config.js';
import { makeRng } from '../rng.js';
import { buildRealm, ITEM_SIZE, PICKUP_SIZE } from './build.js';
import { flowField, downhill, bfsPath } from './nav.js';
import { reachMask, solve } from './plan.js';

export function newSession(opts = {}) {
    return {
        score: 0, lives: PLAYER.lives, skill: opts.skill || 'novice', mode: opts.mode || 'arcade',
        remix: opts.remix || 0, loop: 1, realm: opts.realm || 0, startRealm: opts.realm || 0,
        nextExtra: 0, cassettes: [], secret: false, continues: 0, deaths: 0, gems: 0, kills: 0,
    };
}

const overlap = (a, b, pad = 0) => a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
const cx = (e) => e.x + e.w / 2;
const cy = (e) => e.y + e.h / 2;
const dist = (a, b) => Math.hypot(cx(a) - cx(b), cy(a) - cy(b));

export class World {
    constructor(realmIndex, session, opts = {}) {
        this.session = session;
        this.skill = SKILL[session.skill] || SKILL.novice;
        this.loop = session.loop;
        const remix = session.mode === 'remix' && !opts.arcade ? ((session.remix || 1) + realmIndex * 97 + (opts.remixTry || 0) * 7777) >>> 0 : 0;
        this.map = opts.map || buildRealm(realmIndex, { remix, items: opts.items, dragons: opts.dragons });
        const M = this.map;
        this.realm = M.realm;
        this.realmIndex = realmIndex;
        this.rng = makeRng(M.seed ^ 0xC0FFEE ^ (session.loop * 31));
        this.t = 0;
        this.events = [];
        this.god = false;
        this.hitstop = 0;
        this.cleared = false;
        this.over = false;
        this.tally = null;
        this.deathsHere = 0;
        this.gemsHere = 0;
        this.killsHere = 0;
        this.combo = 0; this.comboT = 0;
        this.gemChain = 0; this.gemChainT = 0;
        this.shards = 0;
        this.collapseT = -1;
        this.visited = new Uint8Array(M.rooms.length);
        this.chaliceSeen = false;
        this.parT = this.realm.par * this.skill.par * (this.loop > 1 ? 0.8 : 1);
        this.warned = false;
        this.speedMul = this.skill.dragonSpeed * (this.loop > 1 ? 1.15 : 1);

        const s = M.start;
        this.player = {
            x: s.x, y: s.y, w: 8, h: 8, face: { x: 0, y: -1 }, pips: PLAYER.pips, inv: 1.5,
            dashT: 0, dashCool: 0, slashT: 0, slowT: 0, held: null, dead: false, deadT: 0, cause: null,
            swallowedBy: -1, padT: 0, padLock: false, moving: false, kx: 0, ky: 0, kT: 0,
        };
        this.items = M.items.map((it) => ({ ...it, holder: null, ox: 0, oy: 0, noPick: false, laid: false, fuse: 0, flare: 0 }));
        this.pickups = M.pickups.map((p, i) => ({ ...p, id: i, taken: false }));
        this.dragons = M.dragons.map((d, i) => this.makeDragon(d, i));
        this.bat = (M.bat || this.loop > 1) ? this.makeBat(M.bat || this.batSpot()) : null;   // loop 2: BYTE in every realm
        this.nul = { active: false, x: 0, y: 0, w: 14, h: 14, speed: 16, stun: 0, since: 0 };
        this.projectiles = [];
        this.minis = [];
        this.boss = M.boss ? {
            x: M.boss.x, y: M.boss.y, w: 32, h: 32, hp: 18, max: 18, phase: 1, state: 'idle', t: 0, active: false,
            dead: false, dyingT: 0, ang: -Math.PI / 2, hurt: 0, lockX: 0, lockY: 0, laserY: 0, fanT: 0, room: M.boss.room, clankT: 0, next: 'dive',
        } : null;
        this.dispenserT = -1;
        this.room = this.roomAt(cx(this.player), cy(this.player));
        this.visited[this.room] = 1;
        this.field = null; this.fieldT = 0;
        this.reach = reachMask(this);
        this.ev('realm', { realm: realmIndex });
    }

    /** A world for a realm; in REMIX, the first shuffle the planner can solve. */
    static create(realmIndex, session, opts = {}) {
        if (session.mode !== 'remix') return new World(realmIndex, session, opts);
        for (let k = 0; k < 40; k++) {
            const w = new World(realmIndex, session, { ...opts, remixTry: k });
            if (solve(w)) return w;
        }
        return new World(realmIndex, session, { ...opts, arcade: true });
    }

    // ------------------------------------------------------------------ helpers
    ev(type, data = {}) {
        this.events.push({ type, t: this.t, ...data });
        if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
    }

    roomAt(x, y) {
        const c = Math.max(0, Math.min(this.map.cols - 1, Math.floor(x / ROOM_W)));
        const r = Math.max(0, Math.min(this.map.rows - 1, Math.floor(y / ROOM_H)));
        return r * this.map.cols + c;
    }
    roomOf(e) { return this.roomAt(cx(e), cy(e)); }
    roomDist(a, b) {
        const C = this.map.cols;
        return Math.abs((a % C) - (b % C)) + Math.abs(((a / C) | 0) - ((b / C) | 0));
    }
    roomRect(i) {
        const C = this.map.cols;
        return { x: (i % C) * ROOM_W, y: ((i / C) | 0) * ROOM_H, w: ROOM_W, h: ROOM_H };
    }

    addScore(n) {
        const s = this.session;
        s.score += Math.round(n);
        const next = s.nextExtra < SCORE.extra.length ? SCORE.extra[s.nextExtra] : SCORE.extra[SCORE.extra.length - 1] + SCORE.extraEvery * (s.nextExtra - SCORE.extra.length + 1);
        if (s.score >= next) { s.nextExtra++; s.lives++; this.ev('extra'); }
    }

    // A tile is walkable for…  player | dragon | bat | proj
    tileSolid(t, who) {
        if (t === FLOOR) return false;
        if (t === CHASM) return who !== 'bat' && who !== 'proj';
        return true;
    }

    boxBlocked(x, y, w, h, who) {
        const M = this.map;
        const x0 = Math.floor(x / T), y0 = Math.floor(y / T), x1 = Math.floor((x + w - 0.001) / T), y1 = Math.floor((y + h - 0.001) / T);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
            const t = M.at(tx, ty);
            if (!this.tileSolid(t, who)) continue;
            if (t === CHASM && who === 'player' && this.onBridge(x, y, w, h, tx, ty)) continue;
            return true;
        }
        return false;
    }

    onBridge(x, y, w, h, tx, ty) {
        for (const it of this.items) {
            if (it.kind !== 'bridge' || !it.laid) continue;
            const px = tx * T, py = ty * T;
            if (px + T <= it.x || px >= it.x + it.w || py + T <= it.y || py >= it.y + it.h) continue;
            if (it.orient === 'v' ? (x >= it.x - 0.01 && x + w <= it.x + it.w + 0.01) : (y >= it.y - 0.01 && y + h <= it.y + it.h + 0.01)) return true;
        }
        return false;
    }

    /** Move along one axis with wall collision, creeping to the wall and sliding round corners. */
    moveAxis(e, d, axis, who, slide = true) {
        if (!d) return false;
        const test = (x, y) => !this.boxBlocked(x, y, e.w, e.h, who);
        const nx = axis === 'x' ? e.x + d : e.x, ny = axis === 'y' ? e.y + d : e.y;
        if (test(nx, ny)) { e.x = nx; e.y = ny; return false; }
        const sg = Math.sign(d);
        let moved = 0;
        for (let s = 0.25; s <= Math.abs(d) + 1e-6; s += 0.25) {
            if (test(axis === 'x' ? e.x + sg * s : e.x, axis === 'y' ? e.y + sg * s : e.y)) moved = s; else break;
        }
        if (axis === 'x') e.x += sg * moved; else e.y += sg * moved;
        if (slide) {
            for (let k = 1; k <= 5; k++) for (const s of [-1, 1]) {
                const px = axis === 'x' ? e.x + sg : e.x + s * k, py = axis === 'x' ? e.y + s * k : e.y + sg;
                const qx = axis === 'x' ? e.x : e.x + s * k, qy = axis === 'x' ? e.y + s * k : e.y;
                if (test(px, py) && test(qx, qy)) {
                    const step = Math.min(Math.abs(d), 1);
                    if (axis === 'x') e.y += s * step; else e.x += s * step;
                    return true;
                }
            }
        }
        return true;
    }

    // ------------------------------------------------------------------ makers
    makeDragon(d, i) {
        const cfg = DRAGONS[d.kind];
        const hp = cfg.hp + (this.loop > 1 ? 1 : 0);
        return {
            id: i, kind: d.kind, cfg, x: d.x, y: d.y, w: 16, h: 16, hp, max: hp, dead: false, face: 1,
            state: 'roam', hurt: 0, stun: 0, kx: 0, ky: 0, biteT: 0, cool: 0.5, fireT: 1.5 + i * 0.4, tell: 0,
            lunge: 0, lungeCool: 2, lx: 0, ly: 0, fleeT: 0, full: 0, blink: 0, path: null, pathT: 0, goal: null,
            stuckT: 0, memory: 0, vx: 0, vy: 0, guardKey: d.guard, shard: d.shard, mouth: 0, anim: i * 0.37,
        };
    }

    makeBat(p) { return { x: p.x, y: p.y, w: 14, h: 8, carry: null, stun: 0, gx: p.x, gy: p.y, goalT: 1, target: null, mode: 'wander', t: 0, flee: 0 }; }

    batSpot() {
        const r = this.map.rooms.find((r) => r && !r.vault && r.ch !== 'H');
        return { x: (r.x0 + 20) * T, y: (r.y0 + 12) * T };
    }

    // ------------------------------------------------------------------ the step
    step(dt, inp) {
        if (this.cleared || this.over) return;
        if (this.hitstop > 0) { this.hitstop -= dt; return; }
        this.t += dt;
        const p = this.player;

        this.stepPlayer(dt, inp);
        this.stepItems(dt);
        this.stepGates(dt);
        this.stepDragons(dt);
        if (this.bat) this.stepBat(dt);
        this.stepProjectiles(dt);
        this.stepLasers();
        this.stepNull(dt);
        if (this.boss) this.stepBoss(dt);
        this.stepMinis(dt);

        if (this.comboT > 0 && (this.comboT -= dt) <= 0) this.combo = 0;
        if (this.gemChainT > 0 && (this.gemChainT -= dt) <= 0) this.gemChain = 0;
        if (this.dispenserT > 0 && (this.dispenserT -= dt) <= 0) {
            const d = this.map.dispenser;
            this.items.push({ id: 1000 + Math.floor(this.t * 10), kind: 'charge', x: d.x, y: d.y, w: 8, h: 8, holder: null, ox: 0, oy: 0, noPick: false, fuse: 0, fromDispenser: true });
            this.ev('dispense', { x: d.x + 4, y: d.y + 4 });
        }
        if (this.collapseT > 0) {
            const before = Math.ceil(this.collapseT);
            this.collapseT -= dt;
            if (Math.ceil(this.collapseT) !== before) this.ev('rumble', { left: Math.ceil(this.collapseT) });
            if (this.collapseT <= 0 && !p.dead) { this.die('collapse'); this.collapseT = 60; }
        }
        this.checkWin();
    }

    // ------------------------------------------------------------------ SQUIRE
    stepPlayer(dt, inp) {
        const p = this.player;
        if (p.dead) {
            p.deadT -= dt;
            if (p.deadT <= 0) {
                if (this.session.lives <= 0) { this.over = true; this.ev('gameover'); return; }
                const s = this.map.start;
                p.x = s.x; p.y = s.y; p.dead = false; p.pips = PLAYER.pips; p.inv = PLAYER.invuln; p.swallowedBy = -1;
                p.dashT = 0; p.slowT = 0; p.kT = 0;
                this.ev('respawn', { x: cx(p), y: cy(p) });
                if (this.nul.active) this.placeNullFar();
            }
            return;
        }
        if (p.inv > 0) p.inv -= dt;
        if (p.dashCool > 0) p.dashCool -= dt;
        if (p.slashT > 0) p.slashT -= dt;
        if (p.slowT > 0) p.slowT -= dt;

        let ax = inp.ax || 0, ay = inp.ay || 0;
        const len = Math.hypot(ax, ay);
        if (len > 1) { ax /= len; ay /= len; }
        p.moving = len > 0.1;
        if (p.moving) {
            if (Math.abs(ax) > 0.35 || Math.abs(ay) > 0.35) p.face = { x: Math.abs(ax) > 0.35 ? Math.sign(ax) : 0, y: Math.abs(ay) > 0.35 ? Math.sign(ay) : 0 };
        }
        if (inp.dash && p.dashCool <= 0 && p.dashT <= 0) {
            const fx = p.moving ? ax : p.face.x, fy = p.moving ? ay : p.face.y;
            const fl = Math.hypot(fx, fy) || 1;
            p.dashT = PLAYER.dashTime; p.dashCool = PLAYER.dashCool; p.dx = fx / fl; p.dy = fy / fl;
            this.ev('dash', { x: cx(p), y: cy(p), dx: p.dx, dy: p.dy });
        }
        let vx, vy;
        if (p.dashT > 0) {
            p.dashT -= dt;
            vx = p.dx * PLAYER.dashSpeed; vy = p.dy * PLAYER.dashSpeed;
        } else {
            const sp = PLAYER.speed * (p.slowT > 0 ? 0.5 : 1);
            vx = ax * sp; vy = ay * sp;
        }
        if (p.kT > 0) { p.kT -= dt; vx += p.kx; vy += p.ky; }
        const bx = this.moveAxis(p, vx * dt, 'x', 'player');
        const by = this.moveAxis(p, vy * dt, 'y', 'player');
        if ((bx || by) && p.dashT > 0 && (bx && Math.abs(p.dx) > 0.7 || by && Math.abs(p.dy) > 0.7)) p.dashT = 0;
        this.bridgeAssist(p, vx, vy, dt);

        const h = p.held;
        if (h) { h.x = p.x + h.ox; h.y = p.y + h.oy; }

        // USE
        if (inp.use) this.use();
        if (inp.drop && h) this.drop(true);

        // pick up (touch). One per step.
        for (const it of this.items) {
            if (it === p.held || it.holder === 'player') continue;
            const touching = it.kind === 'bridge' ? this.touchRails(p, it) : overlap(p, it);
            if (it.noPick) { if (!touching) it.noPick = false; continue; }
            if (!touching || it.fuse > 0) continue;
            this.pickUp(it);
            break;
        }
        for (const pk of this.pickups) if (!pk.taken && overlap(p, pk)) this.collect(pk);

        // room change
        const r = this.roomAt(cx(p), cy(p));
        if (r !== this.room) {
            const from = this.room;
            this.room = r;
            const first = !this.visited[r];
            this.visited[r] = 1;
            this.ev('room', { room: r, from, first });
            const R = this.map.rooms[r];
            if (R && R.ch === 'S' && !this.session.secret) { this.session.secret = true; this.addScore(SCORE.secret); this.ev('secret', { x: cx(p), y: cy(p) }); }
            if (this.boss && r === this.boss.room && !this.boss.active && !this.boss.dead) this.wakeBoss();
        }
        const chal = this.items.find((i) => i.kind === 'chalice');
        if (chal && this.roomOf(chal) === this.room) this.chaliceSeen = true;

        // teleport pads
        let onPad = false;
        for (const pad of this.map.pads) {
            if (pad.link < 0) continue;
            if (cx(p) < pad.x || cx(p) > pad.x + pad.w || cy(p) < pad.y || cy(p) > pad.y + pad.h) continue;
            onPad = true;
            if (p.padLock) break;
            p.padT += dt;
            if (p.padT > 0.4) {
                const to = this.map.pads[pad.link];
                const fx = cx(p), fy = cy(p);
                p.x = to.x + to.w / 2 - 4; p.y = to.y + to.h / 2 - 4;
                if (p.held) { p.held.x = p.x + p.held.ox; p.held.y = p.y + p.held.oy; }
                p.padLock = true; p.padT = 0;
                this.ev('teleport', { x: fx, y: fy, tx: cx(p), ty: cy(p) });
            }
            break;
        }
        if (!onPad) { p.padLock = false; p.padT = 0; }
    }

    /** Ease the square onto a laid bridge's deck so it doesn't snag on the chasm's edge. */
    bridgeAssist(p, vx, vy, dt) {
        for (const it of this.items) {
            if (it.kind !== 'bridge' || !it.laid) continue;
            if (!overlap(p, it, 3)) continue;
            if (it.orient === 'v' && Math.abs(vy) > 1) {
                const target = it.x + it.w / 2 - p.w / 2;
                if (Math.abs(target - p.x) < 8) this.moveAxis(p, Math.sign(target - p.x) * Math.min(Math.abs(target - p.x), 50 * dt), 'x', 'player', false);
            } else if (it.orient === 'h' && Math.abs(vx) > 1) {
                const target = it.y + it.h / 2 - p.h / 2;
                if (Math.abs(target - p.y) < 8) this.moveAxis(p, Math.sign(target - p.y) * Math.min(Math.abs(target - p.y), 50 * dt), 'y', 'player', false);
            }
        }
    }

    /** A bridge is lifted by its rails, so you can walk down the middle of one. */
    touchRails(p, it) {
        if (it.orient === 'v') return overlap(p, { x: it.x, y: it.y, w: 3, h: it.h }) || overlap(p, { x: it.x + it.w - 3, y: it.y, w: 3, h: it.h });
        return overlap(p, { x: it.x, y: it.y, w: it.w, h: 3 }) || overlap(p, { x: it.x, y: it.y + it.h - 3, w: it.w, h: 3 });
    }

    pickUp(it) {
        const p = this.player;
        if (p.held) this.drop(false);
        if (it.holder === 'bat' && this.bat) this.bat.carry = null;
        if (it.kind === 'bridge' && it.laid) {
            // the player standing on a bridge can't lift it out from under themselves
            if (this.boxBlocked(p.x, p.y, p.w, p.h, 'player-nobridge')) return;
            it.laid = false; this.reach = reachMask(this);
        }
        it.holder = 'player';
        p.held = it;
        // keep the offset at which it was touched, clamped so it stays against the square
        it.ox = Math.max(-it.w, Math.min(p.w, it.x - p.x));
        it.oy = Math.max(-it.h, Math.min(p.h, it.y - p.y));
        if (it.kind === 'bridge') { it.ox = Math.max(-it.w + 2, Math.min(p.w - 2, it.ox)); it.oy = Math.max(-it.h + 2, Math.min(p.h - 2, it.oy)); }
        this.ev('pickup', { kind: it.kind, color: it.color, x: cx(it), y: cy(it) });
        if (it.kind === 'chalice') {
            if (!it.lifted) this.ev('chalice', { x: cx(it), y: cy(it) });
            if (!it.lifted && this.realm.boss && this.collapseT < 0) {
                this.collapseT = 90;
                this.nul.speed = 28;
                this.spawnNull();
                this.ev('collapse');
            }
            it.lifted = true;
        }
    }

    drop(manual) {
        const p = this.player;
        const it = p.held;
        if (!it) return;
        p.held = null;
        it.holder = null;
        it.noPick = overlap(p, it) || manual;
        if (it.kind === 'bridge') this.layBridge(it);
        this.ev('drop', { kind: it.kind, x: cx(it), y: cy(it) });
    }

    /** A dropped bridge snaps across the data river under it. */
    layBridge(it) {
        const M = this.map;
        // any river tile under the bridge or within 20 px of it; the one nearest its centre
        let best = null, bd = 1e9;
        for (let y = Math.floor((it.y - 20) / T); y <= Math.floor((it.y + it.h + 20) / T); y++) {
            for (let x = Math.floor((it.x - 20) / T); x <= Math.floor((it.x + it.w + 20) / T); x++) {
                if (M.at(x, y) !== CHASM) continue;
                const d = (x * T + 4 - cx(it)) ** 2 + (y * T + 4 - cy(it)) ** 2;
                if (d < bd) { bd = d; best = [x, y]; }
            }
        }
        if (!best) return;
        const bcx = best[0] * T + 4, bcy = best[1] * T + 4;
        // which way does the chasm run at that tile?
        let hx = 0, vy = 0;
        for (let d = -3; d <= 3; d++) { if (M.at(best[0] + d, best[1]) === CHASM) hx++; if (M.at(best[0], best[1] + d) === CHASM) vy++; }
        const orient = hx >= vy ? 'v' : 'h';
        let lo, hi;
        if (orient === 'v') {
            const x = best[0]; lo = best[1]; hi = best[1];
            while (M.at(x, lo - 1) === CHASM) lo--;
            while (M.at(x, hi + 1) === CHASM) hi++;
            const len = hi - lo + 1;
            it.orient = 'v'; it.w = 16; it.h = (len + 2) * T;
            it.x = Math.max(Math.floor(Math.max(bcx - 8, Math.min(bcx + 8, cx(it))) / T) * T - 4, 0); it.y = (lo - 1) * T;
            // keep the deck clear of the chasm's side walls
            const okDeck = (x0) => { for (let y = lo; y <= hi; y++) for (let x = Math.floor(x0 / T); x <= Math.floor((x0 + 15) / T); x++) if (M.at(x, y) !== CHASM) return false; return true; };
            if (!okDeck(it.x)) for (const d of [4, -4, 8, -8, 12, -12]) if (okDeck(it.x + d)) { it.x += d; break; }
        } else {
            const y = best[1]; lo = best[0]; hi = best[0];
            while (M.at(lo - 1, y) === CHASM) lo--;
            while (M.at(hi + 1, y) === CHASM) hi++;
            const len = hi - lo + 1;
            it.orient = 'h'; it.h = 16; it.w = (len + 2) * T;
            it.y = Math.floor(Math.max(bcy - 8, Math.min(bcy + 8, cy(it))) / T) * T - 4; it.x = (lo - 1) * T;
            const okDeck = (y0) => { for (let x = lo; x <= hi; x++) for (let y = Math.floor(y0 / T); y <= Math.floor((y0 + 15) / T); y++) if (M.at(x, y) !== CHASM) return false; return true; };
            if (!okDeck(it.y)) for (const d of [4, -4, 8, -8, 12, -12]) if (okDeck(it.y + d)) { it.y += d; break; }
        }
        it.laid = true;
        it.noPick = true;
        this.reach = reachMask(this);
        this.ev('bridge', { x: cx(it), y: cy(it) });
    }

    use() {
        const p = this.player;
        const h = p.held;
        if (!h) { this.ev('nouse'); return; }
        if (h.kind === 'sword') {
            if (p.slashT <= 0) { p.slashT = 0.22; this.ev('slash', { x: cx(p), y: cy(p), fx: p.face.x, fy: p.face.y }); }
        } else if (h.kind === 'charge') {
            h.fuse = 2.0;
            this.drop(true);
            this.ev('arm', { x: cx(h), y: cy(h) });
        } else if (h.kind === 'lamp') {
            if (h.flare <= 0) {
                h.flare = 1.2;
                for (const d of this.dragons) if (!d.dead && dist(d, h) < 84) d.fleeT = 2.5;
                this.ev('flare', { x: cx(h), y: cy(h) });
            }
        } else if (h.kind === 'bridge') {
            this.drop(true);
        } else {
            this.ev('nouse');
        }
    }

    slashBox() {
        const p = this.player;
        if (p.slashT <= 0 || !p.held || p.held.kind !== 'sword') return null;
        const fx = p.face.x, fy = p.face.y;
        return { x: cx(p) + fx * 11 - 10, y: cy(p) + fy * 11 - 10, w: 20, h: 20 };
    }

    hurt(n, from, cause = 'zap') {
        const p = this.player;
        if (p.dead || p.inv > 0 || p.dashT > 0 || this.god) return false;
        p.pips -= n;
        p.inv = 1.0;
        if (from) {
            const dx = cx(p) - from.x, dy = cy(p) - from.y, l = Math.hypot(dx, dy) || 1;
            p.kx = dx / l * 140; p.ky = dy / l * 140; p.kT = 0.12;
        }
        this.ev('hurt', { x: cx(p), y: cy(p), pips: p.pips });
        if (p.pips <= 0) this.die(cause);
        return true;
    }

    die(cause) {
        const p = this.player;
        if (p.dead || this.god) return;
        if (p.held) {
            const it = p.held;
            this.drop(false);
            it.noPick = false;
            this.rescueItem(it);
        }
        p.dead = true; p.deadT = cause === 'bite' ? 2.4 : 2.0; p.cause = cause;
        // dying in the arena: CHROMAGON settles back to wait (keeping his wounds) and the gate opens,
        // or the respawned square would be locked out of the fight for good
        const b = this.boss;
        if (b && b.active && !b.dead) {
            b.active = false; b.state = 'idle'; b.x = this.map.boss.x; b.y = this.map.boss.y;
            this.projectiles.length = 0; this.minis.length = 0;
            const g = this.map.gates.find((g) => g.color === 'chrome');
            if (g) { g.closing = false; g.opening = true; }
        }
        this.session.lives--;
        this.session.deaths++;
        this.deathsHere++;
        this.combo = 0;
        this.ev('die', { cause, x: cx(p), y: cy(p) });
    }

    /** Put an item back where the player can reach it if it ended up inside a wall or outside the reachable world. */
    rescueItem(it) {
        if (it.kind === 'bridge' && it.laid) return;
        const M = this.map;
        const tx = Math.floor(cx(it) / T), ty = Math.floor(cy(it) / T);
        if (this.reach[ty * M.gw + tx] && !this.boxBlocked(it.x, it.y, it.w, it.h, 'dragon')) return;
        // the nearest reachable spot, however far (a ring at a time, so it is cheap when it is close)
        for (let r = 1; r < 80; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = tx + dx, y = ty + dy;
            if (x < 0 || y < 0 || x >= M.gw || y >= M.gh || !this.reach[y * M.gw + x]) continue;
            const nx = x * T + T / 2 - it.w / 2, ny = y * T + T / 2 - it.h / 2;
            if (this.boxBlocked(nx, ny, it.w, it.h, 'dragon')) continue;
            it.x = nx; it.y = ny; return;
        }
    }

    collect(pk) {
        pk.taken = true;
        const at = { x: cx(pk), y: cy(pk) };
        const p = this.player;
        switch (pk.kind) {
            case 'gem': case 'biggem':
                this.gemChain++; this.gemChainT = 1.4;
                this.gemsHere++; this.session.gems++;
                this.addScore(pk.kind === 'gem' ? SCORE.gem : SCORE.bigGem);
                this.ev('gem', { ...at, big: pk.kind === 'biggem', chain: this.gemChain });
                break;
            case 'battery':
                if (p.pips < PLAYER.pips) p.pips++; else this.addScore(200);
                this.ev('battery', at); break;
            case 'oneup':
                this.session.lives++; this.ev('oneup', at); break;
            case 'cassette':
                if (!this.session.cassettes.includes(this.realm.id)) this.session.cassettes.push(this.realm.id);
                this.addScore(SCORE.cassette); this.ev('cassette', { ...at, song: this.realm.song }); break;
            case 'shard':
                this.shards++; this.addScore(1000); this.ev('shard', { ...at, n: this.shards });
                if (this.shards >= 3) {
                    const g = this.map.gates.find((g) => g.color === 'chrome');
                    if (g && g.open < 1) { g.opening = true; this.ev('citadel', { x: (g.x + 2) * T, y: (g.y + 1) * T }); }
                }
                break;
        }
    }

    // ------------------------------------------------------------------ items
    stepItems(dt) {
        const M = this.map;
        let magnet = null;
        for (const it of this.items) {
            if (it.flare > 0) it.flare -= dt;
            if (it.kind === 'magnet') magnet = it;
            if (it.fuse > 0) {
                it.fuse -= dt;
                if (it.fuse <= 0) this.explode(it);
            }
        }
        this.items = this.items.filter((it) => !it.gone);
        if (magnet) {
            const mr = this.roomOf(magnet);
            const pull = (o) => {
                if (this.roomOf(o) !== mr || overlap(o, magnet)) return;
                const dx = cx(magnet) - cx(o), dy = cy(magnet) - cy(o), l = Math.hypot(dx, dy) || 1;
                o.x += dx / l * 42 * dt; o.y += dy / l * 42 * dt;
                o.pulled = true;
            };
            for (const it of this.items) if (it !== magnet && !it.holder && !it.laid && !it.fromDispenser) pull(it);
            for (const pk of this.pickups) if (!pk.taken) pull(pk);
        }
        // the grey pixel and the static wall
        const b = M.barrier;
        if (b && !b.broken) {
            const rect = { x: b.x * T - 2, y: b.y * T - 2, w: b.w * T + 4, h: b.h * T + 6 };
            const px = this.items.find((i) => i.kind === 'pixel');
            if (px && overlap(px, rect)) {
                b.broken = true;
                for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) M.set(b.x + x, b.y + y, FLOOR);
                this.reach = reachMask(this);
                this.ev('barrier', { x: (b.x + b.w / 2) * T, y: (b.y + 1) * T });
            }
        }
    }

    explode(it) {
        const M = this.map;
        const x = cx(it), y = cy(it), R = 30;
        it.gone = true;
        if (this.player.held === it) this.player.held = null;
        let broke = false;
        for (let ty = Math.floor((y - R) / T); ty <= Math.floor((y + R) / T); ty++) {
            for (let tx = Math.floor((x - R) / T); tx <= Math.floor((x + R) / T); tx++) {
                if (M.at(tx, ty) !== CRACK) continue;
                if (Math.hypot(tx * T + 4 - x, ty * T + 4 - y) > R) continue;
                M.set(tx, ty, FLOOR); broke = true;
                this.ev('rubble', { x: tx * T + 4, y: ty * T + 4 });
            }
        }
        if (broke) {
            for (const g of M.cracks) if (!g.broken && g.tiles.every((k) => M.tiles[k] !== CRACK)) g.broken = true;
            // finish off a group that is mostly gone, so no single tile is left as a sliver
            for (const g of M.cracks) {
                if (g.broken) continue;
                const left = g.tiles.filter((k) => M.tiles[k] === CRACK);
                if (left.length && left.length <= g.tiles.length * 0.5) {
                    for (const k of left) { M.tiles[k] = FLOOR; this.ev('rubble', { x: (k % M.gw) * T + 4, y: ((k / M.gw) | 0) * T + 4 }); }
                    g.broken = true;
                }
            }
            this.reach = reachMask(this);
        }
        for (const d of this.dragons) if (!d.dead && Math.hypot(cx(d) - x, cy(d) - y) < R + 6) this.hitDragon(d, 1, { x, y });
        const p = this.player;
        if (!p.dead && Math.hypot(cx(p) - x, cy(p) - y) < R - 4) this.hurt(1, { x, y }, 'blast');
        this.ev('blast', { x, y });
        if (it.fromDispenser && M.dispenser) this.dispenserT = 1.5;
    }

    // ------------------------------------------------------------------ gates
    stepGates(dt) {
        const M = this.map;
        const p = this.player;
        for (const g of M.gates) {
            const rect = { x: g.x * T, y: g.y * T, w: g.w * T, h: g.h * T };
            if (g.closing) {
                g.open = Math.max(0, g.open - dt * 2);
                if (g.open < 0.7) this.setGateTiles(g, GATE);
                if (g.open <= 0) g.closing = false;
                continue;
            }
            if (g.open >= 1 && !g.opening) continue;
            if (!g.opening && g.color !== 'chrome' && !g.home) {
                const key = this.items.find((i) => i.kind === 'key' && i.color === g.color && (overlap(i, rect, 1) || (i === p.held && overlap(p, rect, 2))));
                if (key) { g.opening = true; this.addScore(SCORE.gate); this.ev('gate', { x: rect.x + rect.w / 2, y: rect.y + rect.h, color: g.color }); }
            }
            if (g.opening) {
                g.open = Math.min(1, g.open + dt * 1.1);
                if (g.open >= 0.7 && M.at(g.x, g.y) === GATE) { this.setGateTiles(g, FLOOR); this.reach = reachMask(this); }
                if (g.open >= 1) g.opening = false;
            }
        }
    }

    setGateTiles(g, v) { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) this.map.set(g.x + x, g.y + y, v); }

    // ------------------------------------------------------------------ dragons
    dragonPass = (x, y) => {
        const at = this.map.at;
        return at(x, y) === FLOOR && at(x + 1, y) === FLOOR && at(x, y + 1) === FLOOR && at(x + 1, y + 1) === FLOOR;
    };

    stepDragons(dt) {
        const p = this.player;
        const M = this.map;
        // refresh the flow field toward the player a few times a second
        this.fieldT -= dt;
        const anyChase = this.dragons.some((d) => !d.dead && (d.state === 'chase' || d.state === 'bite'));
        if (!p.dead && (this.fieldT <= 0 || !this.field) && (anyChase || !this.field)) {
            const tx = Math.floor(cx(p) / T), ty = Math.floor(cy(p) / T);
            this.field = flowField(M.gw, M.gh, [[tx, ty], [tx - 1, ty], [tx, ty - 1], [tx - 1, ty - 1]], this.dragonPass, 140, this.field);
            this.fieldT = 0.12;
        }
        const chalice = this.items.find((i) => i.kind === 'chalice');
        for (const d of this.dragons) {
            if (d.dead) continue;
            d.anim += dt;
            if (d.hurt > 0) d.hurt -= dt;
            if (d.full > 0) { d.full -= dt; d.mouth = 0; continue; }
            if (d.stun > 0) {
                d.stun -= dt;
                this.moveAxis(d, d.kx * dt, 'x', 'dragon'); this.moveAxis(d, d.ky * dt, 'y', 'dragon');
                continue;
            }
            if (d.blink > 0) {
                d.blink -= dt;
                if (d.blink <= 0) this.blinkTo(d);
                continue;
            }
            const cfg = d.cfg;
            const dr = this.roomOf(d), pr = this.room;
            const same = dr === pr && !p.dead;
            const pd = dist(d, p);
            if (d.fleeT > 0) d.fleeT -= dt;
            if (d.cool > 0) d.cool -= dt;
            if (d.lungeCool > 0) d.lungeCool -= dt;
            d.memory = same ? 1.6 : Math.max(0, d.memory - dt);

            // decide
            let mode = 'roam';
            const guardItem = d.guardKey ? this.guardItem(d) : null;
            if (!p.dead) {
                if (d.fleeT > 0) mode = 'flee';
                else if (d.kind === 'aurix' && chalice && dist(d, chalice) < 70 && this.roomOf(chalice) === dr) mode = 'fleeChalice';
                else if (same || d.memory > 0 || (cfg.hunter && this.roomDist(dr, pr) <= 1)) mode = 'chase';
                if (mode === 'chase' && guardItem && !guardItem.holder && dist(p, guardItem) > 110 && pd > 60) mode = 'guard';
            }
            if (d.biteT > 0) mode = 'bite';
            if (d.lunge > 0) mode = 'lunge';
            d.state = mode;

            let sp = cfg.speed * this.speedMul;
            let tx = null, ty = null;
            if (mode === 'chase' || mode === 'bite') {
                if (pd < 22 && same) { tx = cx(p); ty = cy(p); }
                else {
                    const fx = Math.round(d.x / T), fy = Math.round(d.y / T);
                    const nx = this.field && downhill(this.field, M.gw, M.gh, fx, fy, this.dragonPass);
                    if (nx) { tx = nx[0] * T + 8; ty = nx[1] * T + 8; }
                    else { tx = cx(p); ty = cy(p); }
                }
                if (mode === 'bite') sp *= 0.35;
                // bite
                if (mode === 'chase' && same && pd < 15 && d.cool <= 0) {
                    d.biteT = cfg.bite * this.skill.bite;
                    this.ev('jaws', { id: d.id, x: cx(d), y: cy(d) });
                }
                // lunge
                if (cfg.lunge && mode === 'chase' && same && pd > 28 && pd < 72 && d.lungeCool <= 0) {
                    d.lunge = 0.62; d.lungeCool = 3.2;
                    const l = pd || 1; d.lx = (cx(p) - cx(d)) / l; d.ly = (cy(p) - cy(d)) / l;
                    this.ev('roar', { id: d.id, x: cx(d), y: cy(d), kind: d.kind });
                }
            } else if (mode === 'flee' || mode === 'fleeChalice') {
                const from = mode === 'flee' ? p : chalice;
                const dx = cx(d) - cx(from), dy = cy(d) - cy(from), l = Math.hypot(dx, dy) || 1;
                tx = cx(d) + dx / l * 20; ty = cy(d) + dy / l * 20;
                sp *= 1.1;
            } else if (mode === 'guard' && guardItem) {
                const a = d.anim * 0.8;
                tx = cx(guardItem) + Math.cos(a) * 26; ty = cy(guardItem) + Math.sin(a) * 18;
                sp *= 0.6;
            } else {
                // roam its room
                d.pathT -= dt;
                if (!d.goal || d.pathT <= 0 || (Math.abs(cx(d) - d.goal[0]) < 4 && Math.abs(cy(d) - d.goal[1]) < 4)) this.pickRoam(d, dr);
                if (d.path && d.path.length) {
                    const [nx, ny] = d.path[0];
                    tx = nx * T + 8; ty = ny * T + 8;
                    if (Math.abs(cx(d) - tx) < 2 && Math.abs(cy(d) - ty) < 2) d.path.shift();
                }
                sp *= 0.55;
            }

            if (d.lunge > 0) {
                d.lunge -= dt;
                if (d.lunge > 0.36) { tx = null; } // the tell: crouch
                else { tx = cx(d) + d.lx * 30; ty = cy(d) + d.ly * 30; sp = cfg.speed * this.speedMul * 2.6; }
            }

            // steer
            let vx = 0, vy = 0;
            if (tx !== null) {
                const dx = tx - cx(d), dy = ty - cy(d), l = Math.hypot(dx, dy);
                if (l > 0.5) { vx = dx / l * sp; vy = dy / l * sp; }
            }
            if (cfg.skate) { d.vx += (vx - d.vx) * Math.min(1, dt * 3); d.vy += (vy - d.vy) * Math.min(1, dt * 3); vx = d.vx; vy = d.vy; }
            if (Math.abs(vx) > 1) d.face = Math.sign(vx);
            const ox = d.x, oy = d.y;
            this.moveAxis(d, vx * dt, 'x', 'dragon');
            this.moveAxis(d, vy * dt, 'y', 'dragon');
            const moved = Math.abs(d.x - ox) + Math.abs(d.y - oy);
            if (tx !== null && moved < sp * dt * 0.2) { d.stuckT += dt; if (d.stuckT > 1.2) { d.goal = null; d.path = null; d.stuckT = 0; } } else d.stuckT = 0;

            // the bite resolves
            if (d.biteT > 0) {
                d.biteT -= dt;
                d.mouth = 1;
                if (d.biteT <= 0) {
                    d.mouth = 0;
                    const reach = { x: d.x - 4, y: d.y - 4, w: d.w + 8, h: d.h + 8 };
                    if (!p.dead && overlap(p, reach) && p.inv <= 0 && p.dashT <= 0 && !this.god) {
                        this.ev('swallow', { id: d.id, x: cx(d), y: cy(d) });
                        this.die('bite');
                        p.swallowedBy = d.id;
                        d.full = 2.4;
                    } else {
                        this.ev('snap', { id: d.id, x: cx(d), y: cy(d) });
                    }
                    d.cool = 0.75;
                }
            } else d.mouth = Math.max(0, d.mouth - dt * 4);

            // breath
            if (cfg.fire && same && pd < 160) {
                if (d.tell > 0) {
                    d.tell -= dt;
                    if (d.tell <= 0) this.breathe(d);
                } else if ((d.fireT -= dt) <= 0 && d.biteT <= 0) {
                    d.tell = 0.45;
                    this.ev('tell', { id: d.id, x: cx(d), y: cy(d) });
                }
            }

            // the sword
            const sw = p.held && p.held.kind === 'sword' ? p.held : null;
            const sb = this.slashBox();
            if (!p.dead && ((sw && overlap(sw, d)) || (sb && overlap(sb, d)))) this.hitDragon(d, 1, { x: cx(p), y: cy(p) });
        }
    }

    guardItem(d) {
        const [kind, color] = d.guardKey.split(':');
        return this.items.find((i) => i.kind === kind && (!color || i.color === color)) || null;
    }

    pickRoam(d, room) {
        const R = this.map.rooms[room];
        d.pathT = 3 + this.rng() * 3;
        if (!R) return;
        for (let k = 0; k < 12; k++) {
            const tx = R.x0 + this.rng.int(2, RW - 4), ty = R.y0 + this.rng.int(2, RH - 4);
            if (!this.dragonPass(tx, ty)) continue;
            const path = bfsPath(this.map.gw, this.map.gh, [Math.round(d.x / T), Math.round(d.y / T)], [tx, ty], this.dragonPass, null, 2500);
            if (path) { d.path = path; d.goal = [tx * T + 8, ty * T + 8]; return; }
        }
        d.goal = null; d.path = null;
    }

    breathe(d) {
        const p = this.player;
        const ang = Math.atan2(cy(p) - cy(d), cx(p) - cx(d));
        const mx = cx(d) + d.face * 6, my = cy(d) - 2;
        if (d.cfg.ice) {
            for (const o of [-0.28, 0, 0.28]) this.projectiles.push({ kind: 'ice', x: mx, y: my, vx: Math.cos(ang + o) * 85, vy: Math.sin(ang + o) * 85, r: 2.5, life: 3 });
            this.ev('ice', { x: mx, y: my });
        } else {
            this.projectiles.push({ kind: 'fire', x: mx, y: my, vx: Math.cos(ang) * 95, vy: Math.sin(ang) * 95, r: 3, life: 3 });
            this.ev('fire', { x: mx, y: my });
        }
        d.fireT = d.cfg.fire * this.skill.fire * this.rng.range(0.8, 1.25);
    }

    hitDragon(d, dmg, from) {
        if (d.dead || d.hurt > 0) return;
        d.hp -= dmg; d.hurt = 0.5;
        const dx = cx(d) - from.x, dy = cy(d) - from.y, l = Math.hypot(dx, dy) || 1;
        d.kx = dx / l * 170; d.ky = dy / l * 170; d.stun = 0.2;
        d.biteT = 0; d.mouth = 0; d.lunge = 0; d.tell = 0;
        this.hitstop = Math.max(this.hitstop, 0.06);
        this.ev('dhit', { id: d.id, x: cx(d), y: cy(d), kind: d.kind });
        if (d.hp <= 0) { this.killDragon(d); return; }
        if (d.cfg.twin) {
            const t = this.dragons.find((o) => o.kind === d.cfg.twin && !o.dead);
            if (t && t.blink <= 0) { t.blink = 0.5; this.ev('shimmer', { id: t.id, x: cx(t), y: cy(t) }); }
        }
    }

    killDragon(d) {
        d.dead = true;
        this.combo++; this.comboT = 3;
        this.killsHere++; this.session.kills++;
        this.addScore(SCORE.dragon * d.max * Math.min(this.combo, 4));
        this.hitstop = 0.12;
        this.ev('dkill', { id: d.id, x: cx(d), y: cy(d), kind: d.kind, combo: this.combo });
        this.pickups.push({ kind: 'biggem', x: cx(d) - 4, y: cy(d) - 4, w: 8, h: 8, taken: false, id: this.pickups.length });
        if (d.shard) {
            const sp = { kind: 'shard', x: cx(d) - 3, y: cy(d) - 12, w: 6, h: 8, taken: false, id: this.pickups.length };
            const tx = Math.floor((sp.x + 3) / T), ty = Math.floor((sp.y + 4) / T);
            if (this.map.at(tx, ty) !== FLOOR) { sp.y = cy(d) - 4; sp.x = cx(d) + 6; }
            this.pickups.push(sp);
        }
    }

    blinkTo(d) {
        const p = this.player;
        if (p.dead) return;
        const R = this.map.rooms[this.room];
        for (let k = 0; k < 30; k++) {
            const a = this.rng() * Math.PI * 2, r = 36 + this.rng() * 20;
            const tx = Math.round((cx(p) + Math.cos(a) * r - 8) / T), ty = Math.round((cy(p) + Math.sin(a) * r - 8) / T);
            if (tx < R.x0 + 2 || ty < R.y0 + 2 || tx > R.x0 + RW - 4 || ty > R.y0 + RH - 4) continue;
            if (!this.dragonPass(tx, ty)) continue;
            const fx = cx(d), fy = cy(d);
            d.x = tx * T; d.y = ty * T; d.cool = 0.6;
            this.ev('blink', { id: d.id, x: fx, y: fy, tx: cx(d), ty: cy(d) });
            return;
        }
    }

    // ------------------------------------------------------------------ BYTE, the bat
    stepBat(dt) {
        const b = this.bat, p = this.player, M = this.map;
        b.t += dt;
        const carry = b.carry;
        if (b.stun > 0) {
            b.stun -= dt;
            if (b.stun <= 0) this.ev('batwake', { x: cx(b), y: cy(b) });
            return;
        }
        b.goalT -= dt;
        if (b.goalT <= 0) this.batThink();
        if (b.target && (b.target.holder === 'bat' || b.target.gone || b.target.laid)) b.target = null;
        if (b.target) { b.gx = cx(b.target); b.gy = cy(b.target); }
        const dx = b.gx - cx(b), dy = b.gy - cy(b), l = Math.hypot(dx, dy);
        const sp = (b.target ? 70 : 56) * (this.loop > 1 ? 1.15 : 1);
        if (l > 1) {
            b.x += (dx / l * sp + Math.sin(b.t * 7.3) * 30) * dt;
            b.y += (dy / l * sp + Math.cos(b.t * 5.1) * 26) * dt;
        }
        b.x = Math.max(0, Math.min(M.gw * T - b.w, b.x));
        b.y = Math.max(0, Math.min(M.gh * T - b.h, b.y));
        if (carry) { carry.x = cx(b) - carry.w / 2; carry.y = b.y + b.h - 1; }

        // reach the target: swap
        if (b.target && overlap(b, b.target, 2)) {
            const it = b.target;
            if (it.holder === 'player') {
                if (p.held === it) p.held = null;
                this.ev('snatch', { x: cx(b), y: cy(b), kind: it.kind });
            }
            if (carry) this.batDrop();
            it.holder = 'bat'; it.noPick = false; b.carry = it; b.target = null;
            this.ev('batgrab', { x: cx(b), y: cy(b), kind: it.kind });
            this.batFlee();
        }
        // the sword stuns it
        const sw = p.held && p.held.kind === 'sword' ? p.held : null;
        const sb = this.slashBox();
        if (!p.dead && ((sw && overlap(sw, b)) || (sb && overlap(sb, b)))) {
            b.stun = this.skill.sw === 'A' ? 8 : 10;
            if (b.carry) this.batDrop();
            b.target = null;
            this.addScore(SCORE.bat);
            this.ev('bathit', { x: cx(b), y: cy(b) });
            // fall to a reachable floor
            const tx = Math.floor(cx(b) / T), ty = Math.floor(cy(b) / T);
            if (!this.reach[ty * M.gw + tx]) { const s = { ...b }; this.rescueItem(s); b.x = s.x; b.y = s.y; }
        }
    }

    batThink() {
        const b = this.bat, p = this.player, M = this.map;
        b.goalT = 2.5 + this.rng() * 3.5;
        const br = this.roomOf(b);
        if (b.flee > 0) { b.flee--; this.batWander(); return; }
        if (this.rng() < 0.55) {
            const cands = [];
            for (const it of this.items) {
                if (it.holder === 'bat' || it.laid || it.fuse > 0 || it.fromDispenser) continue;
                const tx = Math.floor(cx(it) / T), ty = Math.floor(cy(it) / T);
                if (it.holder !== 'player' && !this.reach[ty * M.gw + tx]) continue;
                if (this.roomDist(this.roomOf(it), br) > 2) continue;
                let w = 1;
                if (it.holder === 'player' && !p.dead && this.roomDist(this.room, br) <= 1) w = 3;
                if (it.kind === 'chalice') w *= 0.6;
                cands.push([it, w]);
            }
            if (cands.length) {
                let tot = cands.reduce((s, c) => s + c[1], 0), r = this.rng() * tot;
                for (const [it, w] of cands) { if ((r -= w) <= 0) { b.target = it; break; } }
                if (!b.target) b.target = cands[0][0];
                return;
            }
        }
        this.batWander();
    }

    batWander() {
        const b = this.bat;
        const C = this.map.cols;
        const br = this.roomOf(b);
        const opts = [br, br - 1, br + 1, br - C, br + C].filter((r) => r >= 0 && r < this.map.rooms.length && this.map.rooms[r] && Math.abs((r % C) - (br % C)) <= 1);
        const r = opts[Math.floor(this.rng() * opts.length)];
        const R = this.map.rooms[r];
        b.gx = (R.x0 + 4 + this.rng() * (RW - 8)) * T; b.gy = (R.y0 + 4 + this.rng() * (RH - 8)) * T;
        b.target = null;
    }

    batFlee() { this.bat.flee = 1; this.bat.goalT = 0; }

    batDrop() {
        const b = this.bat;
        const it = b.carry;
        if (!it) return;
        b.carry = null; it.holder = null;
        it.x = cx(b) - it.w / 2; it.y = b.y + b.h;
        if (it.kind === 'bridge') { it.orient = 'v'; it.w = 16; it.h = 48; }
        this.rescueItem(it);
        this.ev('batdrop', { x: cx(it), y: cy(it), kind: it.kind });
    }

    // ------------------------------------------------------------------ projectiles, lasers
    stepProjectiles(dt) {
        const p = this.player, M = this.map;
        const shields = this.items.filter((i) => i.kind === 'shield');
        for (const s of this.projectiles) {
            s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
            const t = M.at(Math.floor(s.x / T), Math.floor(s.y / T));
            if (this.tileSolid(t, 'proj')) { s.life = 0; this.ev('fizz', { x: s.x, y: s.y, kind: s.kind }); continue; }
            const box = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
            if (shields.some((sh) => overlap(sh, box, 1))) { s.life = 0; this.ev('block', { x: s.x, y: s.y }); continue; }
            if (!p.dead && overlap(p, box)) {
                if (this.hurt(1, { x: s.x - s.vx, y: s.y - s.vy }, s.kind)) { if (s.kind === 'ice') p.slowT = 1.6; }
                s.life = 0;
            }
        }
        this.projectiles = this.projectiles.filter((s) => s.life > 0);
    }

    laserOn(l) { return (((this.t + l.phase) % l.period) / l.period) < l.duty; }

    stepLasers() {
        const p = this.player;
        for (const l of this.map.lasers) {
            if (!this.laserOn(l)) continue;
            if (!p.dead && overlap(p, l)) this.hurt(1, { x: l.w > l.h ? cx(p) : l.x + 1 - (cx(p) < l.x ? -4 : 4), y: l.w > l.h ? l.y + 1 - (cy(p) < l.y ? -4 : 4) : cy(p) }, 'laser');
            for (const d of this.dragons) if (!d.dead && overlap(d, l)) this.hitDragon(d, 1, { x: l.w > l.h ? cx(d) : l.x, y: l.w > l.h ? l.y : cy(d) });
        }
    }

    // ------------------------------------------------------------------ THE NULL
    stepNull(dt) {
        const n = this.nul, p = this.player;
        if (!this.warned && this.collapseT < 0 && this.t > this.parT - 30 && !(this.boss && this.boss.active)) { this.warned = true; this.ev('nullwarn'); }
        if (!n.active && this.t >= this.parT && !(this.boss && this.boss.active && !this.boss.dead)) {
            n.speed = 16; this.spawnNull();
        }
        if (!n.active) return;
        n.since += dt;
        if (this.collapseT < 0) n.speed = Math.min(58, 16 + 7 * ((this.t - this.parT) / 60));
        else n.speed = Math.min(60, 28 + n.since * 0.25);
        if (n.stun > 0) { n.stun -= dt; return; }
        if (p.dead) return;
        const dx = cx(p) - cx(n), dy = cy(p) - cy(n), l = Math.hypot(dx, dy) || 1;
        n.x += dx / l * n.speed * dt; n.y += dy / l * n.speed * dt;
        const sw = p.held && p.held.kind === 'sword' ? p.held : null;
        const sb = this.slashBox();
        if ((sw && overlap(sw, n)) || (sb && overlap(sb, n))) { n.stun = 3; this.ev('nullstun', { x: cx(n), y: cy(n) }); return; }
        if (overlap(p, n, -2) && p.inv <= 0 && p.dashT <= 0) {
            this.die('null');
            this.placeNullFar();
        }
    }

    spawnNull() {
        const n = this.nul;
        n.active = true; n.since = 0;
        this.placeNullFar();
        this.ev('null', { x: cx(n), y: cy(n) });
    }

    placeNullFar() {
        const n = this.nul;
        let best = 0, bd = -1;
        this.map.rooms.forEach((r, i) => { if (r && this.roomDist(i, this.room) > bd) { bd = this.roomDist(i, this.room); best = i; } });
        const R = this.roomRect(best);
        n.x = R.x + R.w / 2 - 7; n.y = R.y + R.h / 2 - 7; n.stun = 1;
    }

    // ------------------------------------------------------------------ CHROMAGON
    wakeBoss() {
        const b = this.boss;
        b.active = true; b.state = 'rise'; b.t = 1.6;
        const g = this.map.gates.find((g) => g.color === 'chrome');
        if (g) { g.closing = true; g.opening = false; }
        this.ev('boss', { x: cx(b), y: cy(b) });
    }

    stepBoss(dt) {
        const b = this.boss, p = this.player;
        if (!b.active) return;
        const R = this.roomRect(b.room);
        const ccx = R.x + R.w / 2, ccy = R.y + R.h / 2 + 4;
        if (b.dead) {
            if (b.dyingT > 0) {
                b.dyingT -= dt;
                if (Math.floor(b.dyingT * 8) !== Math.floor((b.dyingT + dt) * 8)) this.ev('bossboom', { x: cx(b) + this.rng.range(-18, 18), y: cy(b) + this.rng.range(-18, 18) });
                if (b.dyingT <= 0) {
                    b.active = false;
                    this.ev('bossgone', { x: cx(b), y: cy(b) });
                    const [w, h] = ITEM_SIZE.chalice;
                    this.items.push({ id: 999, kind: 'chalice', chrome: true, x: ccx - w / 2, y: ccy - h / 2, w, h, holder: null, ox: 0, oy: 0, noPick: false, fuse: 0, flare: 0 });
                    const g = this.map.gates.find((g) => g.color === 'chrome');
                    if (g) { g.closing = false; g.opening = true; }
                }
            }
            return;
        }
        if (b.hurt > 0) b.hurt -= dt;
        if (b.clankT > 0) b.clankT -= dt;
        b.t -= dt;
        const speedK = b.phase === 3 ? 0.8 : 1;
        const go = (tx, ty, sp) => {
            const dx = tx - cx(b), dy = ty - cy(b), l = Math.hypot(dx, dy);
            if (l > 1) { const m = Math.min(l, sp * dt); b.x += dx / l * m; b.y += dy / l * m; }
        };
        switch (b.state) {
            case 'rise':
                if (b.t <= 0) { b.state = 'circle'; b.t = 3; b.fanT = 0.8; }
                break;
            case 'circle':
                b.ang += dt * 1.1;
                go(ccx + Math.cos(b.ang) * 96, ccy + Math.sin(b.ang) * 46, 95);
                b.fanT -= dt;
                if (b.fanT <= 0) { this.bossFan(); b.fanT = [1.1, 0.9, 0.75][b.phase - 1]; }
                if (b.t <= 0) {
                    if (b.phase >= 2 && b.next === 'laser') { b.state = 'laserTell'; b.t = 1.0 * speedK; b.laserY = Math.max(R.y + 24, Math.min(R.y + R.h - 24, cy(p))); b.next = 'dive'; this.ev('laserTell', { y: b.laserY }); }
                    else { b.state = 'diveTell'; b.t = 0.8 * speedK; b.next = 'laser'; this.ev('roar', { kind: 'boss', x: cx(b), y: cy(b) }); }
                }
                break;
            case 'diveTell':
                b.lockX = cx(p); b.lockY = cy(p);
                if (b.t <= 0) { b.state = 'dive'; b.t = 0.75; const l = Math.hypot(b.lockX - cx(b), b.lockY - cy(b)) || 1; b.vx = (b.lockX - cx(b)) / l * 240; b.vy = (b.lockY - cy(b)) / l * 240; this.ev('dive', { x: cx(b), y: cy(b) }); }
                break;
            case 'dive': {
                const hx = this.moveAxis(b, b.vx * dt, 'x', 'dragon', false);
                const hy = this.moveAxis(b, b.vy * dt, 'y', 'dragon', false);
                if (hx || hy || b.t <= 0) { b.state = 'dull'; b.t = [1.8, 1.5, 1.3][b.phase - 1]; if (hx || hy) this.ev('slam', { x: cx(b), y: cy(b) }); }
                break;
            }
            case 'laserTell':
                go(R.x + 30, b.laserY, 140);
                if (b.t <= 0) { b.state = 'laser'; b.t = 0.6; this.ev('laser', { y: b.laserY }); }
                break;
            case 'laser':
                if (!p.dead && Math.abs(cy(p) - b.laserY) < 7 && cx(p) > R.x + 16) this.hurt(1, { x: cx(p), y: b.laserY }, 'laser');
                if (b.t <= 0) { b.state = 'dull'; b.t = [1.6, 1.4, 1.2][b.phase - 1]; }
                break;
            case 'dull':
                if (b.t <= 0) { b.state = 'recover'; b.t = 0.5; this.ev('roar', { kind: 'boss', x: cx(b), y: cy(b) }); }
                break;
            case 'recover':
                // he shakes himself off, rising back toward his circle: a beat to get clear
                go(ccx + Math.cos(b.ang) * 96, ccy + Math.sin(b.ang) * 46, 50);
                if (b.t <= 0) {
                    b.state = 'circle'; b.t = 3 * speedK; b.fanT = 0.6;
                    if (b.phase === 3) for (let k = 0; k < 3; k++) this.minis.push({ x: cx(b) - 3 + (k - 1) * 12, y: cy(b) - 3, w: 6, h: 6, life: 9, t: k });
                }
                break;
        }
        b.dull = b.state === 'dull';
        // contact
        if (!p.dead && overlap(p, b, -3) && (b.state === 'circle' || b.state === 'dive')) this.hurt(1, { x: cx(b), y: cy(b) }, 'boss');
        // the sword
        const sw = p.held && p.held.kind === 'sword' ? p.held : null;
        const sb = this.slashBox();
        if (!p.dead && ((sw && overlap(sw, b)) || (sb && overlap(sb, b)))) {
            if (b.dull && b.hurt <= 0) {
                b.hp--; b.hurt = 0.4;
                this.hitstop = 0.07;
                this.ev('bosshit', { x: cx(b), y: cy(b), hp: b.hp });
                const ph = b.hp > 12 ? 1 : b.hp > 6 ? 2 : 3;
                if (b.hp <= 0) {
                    b.dead = true; b.dyingT = 2.2;
                    this.projectiles.length = 0; this.minis.length = 0;
                    this.addScore(SCORE.boss);
                    this.hitstop = 0.25;
                    this.ev('bossdie', { x: cx(b), y: cy(b) });
                } else if (ph !== b.phase) {
                    b.phase = ph; b.state = 'circle'; b.t = 2; b.fanT = 1;
                    this.projectiles.length = 0;
                    this.ev('phase', { phase: ph, x: cx(b), y: cy(b) });
                }
            } else if (!b.dull && b.clankT <= 0) {
                b.clankT = 0.3;
                this.ev('clank', { x: (cx(b) + cx(p)) / 2, y: (cy(b) + cy(p)) / 2 });
            }
        }
    }

    bossFan() {
        const b = this.boss, p = this.player;
        const n = b.phase === 1 ? 5 : 7;
        const base = Math.atan2(cy(p) - cy(b), cx(p) - cx(b));
        for (let k = 0; k < n; k++) {
            const a = base + (k - (n - 1) / 2) * 0.22;
            this.projectiles.push({ kind: 'bossfire', x: cx(b), y: cy(b) + 6, vx: Math.cos(a) * 82, vy: Math.sin(a) * 82, r: 3.5, life: 4 });
        }
        this.ev('fan', { x: cx(b), y: cy(b) });
    }

    stepMinis(dt) {
        const p = this.player;
        for (const m of this.minis) {
            m.life -= dt; m.t += dt;
            if (p.dead) continue;
            const dx = cx(p) - cx(m), dy = cy(p) - cy(m), l = Math.hypot(dx, dy) || 1;
            m.x += (dx / l * 46 + Math.sin(m.t * 9) * 20) * dt; m.y += (dy / l * 46 + Math.cos(m.t * 8) * 20) * dt;
            const sw = p.held && p.held.kind === 'sword' ? p.held : null;
            const sb = this.slashBox();
            if ((sw && overlap(sw, m)) || (sb && overlap(sb, m))) { m.life = 0; this.addScore(200); this.ev('minidie', { x: cx(m), y: cy(m) }); continue; }
            if (overlap(p, m)) { this.hurt(1, { x: cx(m), y: cy(m) }, 'glitch'); m.life = 0; this.ev('minidie', { x: cx(m), y: cy(m) }); }
        }
        this.minis = this.minis.filter((m) => m.life > 0);
    }

    // ------------------------------------------------------------------ the goal
    checkWin() {
        const ch = this.items.find((i) => i.kind === 'chalice');
        if (!ch || this.player.dead) return;
        if (this.roomOf(ch) !== this.map.homeVault) return;
        if (this.boss && !this.boss.dead) return;
        this.cleared = true;
        const timeLeft = Math.max(0, Math.floor(this.parT - this.t));
        this.tally = {
            realm: SCORE.realm * (this.realmIndex + 1) * this.loop,
            time: timeLeft * SCORE.perSecond,
            noMiss: this.deathsHere === 0 ? SCORE.noMiss : 0,
            gems: this.gemsHere, kills: this.killsHere, seconds: Math.floor(this.t),
        };
        this.addScore(this.tally.realm + this.tally.time + this.tally.noMiss);
        this.ev('clear', { realm: this.realmIndex });
    }
}

export { ITEM_SIZE, PICKUP_SIZE, cx, cy, overlap, dist };
