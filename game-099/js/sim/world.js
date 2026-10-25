// The sticker world. Pure: no DOM, no renderer, no Math.random, no clock. A scene of a cart is
// loaded into live stickers; every step, each sticker's rules run in block language and the
// stickers move, touch, hurt and make each other. The view reads G and drains G.events.
//
// How a rule fires:
//   always / every N       on a timer, per sticker
//   touch TAG              when a sticker with that tag starts touching me (and again every 0.8 s)
//   near TAG R             when one comes within R
//   press A/B              when the button is pressed or held, with a cooldown
//   tapped / hurt / die    from input and from damage, queued so rules never recurse
//   message M              a `shout` block, heard on the next step
//
// A sticker's tags are its own tags, `solid` if it is solid, and its sticker id, so "touch dragon"
// and "how many goblin" work without anyone declaring them.

import { COLS, ROWS, LIMITS, HERO_IFRAMES, FOE_IFRAMES, CONTACT_REFIRE, TOUCH_MARGIN, SAY_TIME } from '../config.js';
import { makeRng } from '../rng.js';
import { defsFor } from './cart.js';

const NEAR_ONCE = 1e9;
const NO_INPUT = { x: 0, y: 0, a: false, b: false, ah: false, bh: false, tap: null };

// ------------------------------------------------------------------ small helpers

export const alive = (o) => !o.dying && !o.dead && !o.gone;
export const hasTag = (G, o, tag) => G.tags[o.sid]?.has(tag) ?? false;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function rad(def) {
    if (def.rad) return def.rad;
    if (def.size === 2) return def.solid ? 0.95 : 0.8;
    return def.solid ? 0.45 : 0.38;
}
const radOf = (G, o) => rad(G.defs[o.sid]);
const touching = (G, a, b) => dist(a, b) < radOf(G, a) + radOf(G, b) + TOUCH_MARGIN;
const cmp = (a, op, b) => (op === '>=' ? a >= b : op === '<=' ? a <= b : a === b);

function tagSets(defs) {
    const out = Object.create(null);
    for (const [id, d] of Object.entries(defs)) {
        const s = new Set(d.tags);
        if (d.solid) s.add('solid');
        s.add(id.toLowerCase());
        out[id] = s;
    }
    return out;
}

export function nearest(G, me, tag, max = Infinity) {
    let best = null, bd = max;
    for (const o of G.insts) {
        if (o === me || !alive(o) || !hasTag(G, o, tag)) continue;
        const d = dist(me, o);
        if (d < bd) { bd = d; best = o; }
    }
    return best;
}

export const heroesOf = (G) => G.insts.filter((o) => alive(o) && hasTag(G, o, 'hero'));

// ------------------------------------------------------------------ building a world

function makeInst(G, sid, x, y, fx = 1, fy = 0) {
    const def = G.defs[sid];
    const o = {
        id: G.nextId++, sid, x, y, fx, fy, hp: def.hp, tm: {}, ct: {}, mo: null, say: null,
        flash: 0, inv: 0, age: 0, started: false, kb: null, wt: 0, wv: [0, 0],
        dying: false, dead: false, gone: false, moving: false,
    };
    resetTimers(G, o, def);
    return o;
}

function resetTimers(G, o, def) {
    o.tm = {}; o.ct = {};
    def.rules.forEach((r, i) => { if (r.hat.t === 'every') o.tm[i] = r.hat.sec * (0.4 + 0.6 * G.rng()); });
}

/** A new running world for scene `sceneIdx` of a cart. */
export function newWorld(cart, sceneIdx = 0, seed = 1) {
    const defs = defsFor(cart);
    const G = {
        v: 1, seed, rng: makeRng(seed), cart, defs, tags: tagSets(defs),
        scene: 0, t: 0, status: 'play', score: 0,
        inv: { coin: 0, key: 0, gem: 0, star: 0 }, vars: { A: 0, B: 0, C: 0 },
        insts: [], pending: [], solids: [], nextId: 1, msgs: [], hq: [], goNext: null, hadHero: false,
        events: [],
    };
    loadScene(G, Math.max(0, Math.min(cart.scenes.length - 1, sceneIdx)), null, 'next');
    return G;
}

function loadScene(G, idx, carried, entry) {
    const scene = G.cart.scenes[idx];
    G.scene = idx;
    G.insts = [];
    G.pending = [];
    G.msgs = [];
    G.hq = [];
    scene.items.forEach((item, index) => {
        const def = G.defs[item.sid];
        if (!def) return;
        if (carried && G.tags[item.sid].has('hero')) return;      // the travelling hero takes its place
        if (G.insts.length >= LIMITS.maxInst) return;
        const o = makeInst(G, item.sid, item.x, item.y);
        o.item = index;                       // which placed item this came from (the stage editor uses it)
        G.insts.push(o);
    });
    if (carried) {
        // arrive at the edge the door is on, on the nearest spot clear of solids and doors
        const ex = entry === 'prev' ? COLS - 3 : 3;
        const blocked = (x, y) => G.insts.some((o) => (G.defs[o.sid].solid || hasTag(G, o, 'door') || hasTag(G, o, 'fire')) && Math.hypot(o.x - x, o.y - y) < 1.7);
        const spot = [];
        for (let k = 0; k < 14 && spot.length < carried.length; k++) {
            for (const dx of [0, 1, -1, 2]) {
                const y = ROWS / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1.1;
                const x = ex + dx * (entry === 'prev' ? -1 : 1);
                if (y > 1 && y < ROWS - 1 && !blocked(x, y) && !spot.some((p) => Math.hypot(p.x - x, p.y - y) < 1)) { spot.push({ x, y }); break; }
            }
        }
        carried.forEach((h, i) => {
            const p = spot[i] || { x: ex, y: ROWS / 2 };
            Object.assign(h, { x: p.x, y: p.y, mo: null, kb: null, ct: {}, started: true });
            G.insts.push(h);
        });
    }
    if (G.insts.some((o) => hasTag(G, o, 'hero'))) G.hadHero = true;
    G.solids = G.insts.filter((o) => G.defs[o.sid].solid);
}

// ------------------------------------------------------------------ doing things to stickers

function damage(G, t, n) {
    if (!alive(t) || t.inv > 0) return;
    t.hp -= n;
    t.inv = hasTag(G, t, 'hero') ? HERO_IFRAMES : FOE_IFRAMES;
    t.flash = 0.22;
    G.events.push({ type: 'hurt', id: t.id, sid: t.sid, x: t.x, y: t.y, n });
    G.hq.push({ id: t.id, hat: 'hurt' });
    if (t.hp <= 0) t.dying = true;
}

function heal(G, t, n) {
    if (!alive(t)) return;
    t.hp = Math.max(t.hp, Math.min(G.defs[t.sid].hp, t.hp + n));   // healing never lowers health
    G.events.push({ type: 'heal', id: t.id, x: t.x, y: t.y, n });
}

function push(G, from, t) {
    if (!alive(t)) return;
    let dx = t.x - from.x, dy = t.y - from.y;
    let d = Math.hypot(dx, dy);
    if (d < 1e-4) { dx = -from.fx; dy = -from.fy; d = 1; }
    t.kb = { vx: (dx / d) * 9, vy: (dy / d) * 9, t: 0.16 };
}

function resolve(G, me, who, ctx) {
    switch (who.m) {
        case 'me': return [me];
        case 'it': return ctx.other && !ctx.other.gone && !ctx.other.dead ? [ctx.other] : [];
        case 'nearest': { const n = nearest(G, me, who.tag); return n ? [n] : []; }
        default:
            return G.insts.filter((o) => o !== me && alive(o) && hasTag(G, o, who.tag) && dist(me, o) - radOf(G, o) <= who.r);
    }
}

function place(G, me, where, ctx) {
    const r = radOf(G, me);
    switch (where) {
        case 'front': return { x: me.x + me.fx * (r + 0.55), y: me.y + me.fy * (r + 0.55) };
        case 'around': {
            const a = G.rng() * Math.PI * 2, d = r + 0.6 + G.rng() * 0.8;
            return { x: me.x + Math.cos(a) * d, y: me.y + Math.sin(a) * d };
        }
        case 'random': {
            let p = null;
            for (let i = 0; i < 8; i++) {
                p = { x: 1 + G.rng() * (COLS - 2), y: 1 + G.rng() * (ROWS - 2) };
                if (!G.solids.some((s) => dist(s, p) < 1.6)) break;
            }
            return p;
        }
        case 'it': return ctx.other ? { x: ctx.other.x, y: ctx.other.y } : { x: me.x, y: me.y };
        default: return { x: me.x, y: me.y };
    }
}

function spawn(G, sid, where, me, ctx) {
    if (!G.defs[sid]) return;
    if (G.insts.length + G.pending.length >= LIMITS.maxInst) { G.events.push({ type: 'full' }); return; }
    const p = place(G, me, where, ctx);
    const r = rad(G.defs[sid]);
    const o = makeInst(G, sid, Math.min(COLS - r, Math.max(r, p.x)), Math.min(ROWS - r, Math.max(r, p.y)), me.fx, me.fy);
    o.age = 0;
    G.pending.push(o);
    G.events.push({ type: 'spawn', sid, x: o.x, y: o.y });
}

function test(G, me, c) {
    let r = false;
    switch (c.t) {
        case 'touching': r = G.insts.some((o) => o !== me && alive(o) && hasTag(G, o, c.tag) && touching(G, me, o)); break;
        case 'near': { const n = nearest(G, me, c.tag); r = !!n && dist(me, n) <= c.r; break; }
        case 'hp': r = cmp(me.hp, c.op, c.n); break;
        case 'item': r = cmp(G.inv[c.item] ?? 0, c.op, c.n); break;
        case 'var': r = cmp(G.vars[c.v] ?? 0, c.op, c.n); break;
        case 'chance': r = G.rng() * 100 < c.pct; break;
        case 'count': r = cmp(G.insts.filter((o) => alive(o) && hasTag(G, o, c.tag)).length, c.op, c.n); break;
    }
    return c.neg ? !r : r;
}

const halted = (G) => G.status !== 'play' || G.goNext !== null;

/** Run a list of blocks for sticker `me`. ctx = { other, n }. Returns false if it was cut short. */
function exec(G, me, list, ctx) {
    for (const b of list) {
        if (halted(G)) return false;
        if (++ctx.n > LIMITS.actionsPerTick) return false;
        switch (b.t) {
            case 'steer': me.mo = { k: 'steer', t: b.secs }; break;
            case 'chase': me.mo = { k: 'chase', tag: b.tag, t: b.secs }; break;
            case 'flee': me.mo = { k: 'flee', tag: b.tag, t: b.secs }; break;
            case 'wander': me.mo = { k: 'wander', t: b.secs }; break;
            case 'walk': me.mo = { k: 'walk', dir: b.dir, t: b.secs }; break;
            case 'fly': me.mo = { k: 'fly', t: b.secs }; break;
            case 'stop': me.mo = null; break;

            case 'hurt': for (const t of resolve(G, me, b.who, ctx)) damage(G, t, b.n); break;
            case 'heal': for (const t of resolve(G, me, b.who, ctx)) heal(G, t, b.n); break;
            case 'push': for (const t of resolve(G, me, b.who, ctx)) push(G, me, t); break;
            case 'shoot': spawn(G, b.sid, 'front', me, ctx); break;

            case 'say':
                if (!me.say || me.say.text !== b.text || me.say.t < 1) {
                    me.say = { text: b.text, t: SAY_TIME };
                    G.events.push({ type: 'say', id: me.id, text: b.text });
                }
                break;
            case 'fx': G.events.push({ type: 'fx', kind: b.kind, x: me.x, y: me.y }); break;
            case 'sound': G.events.push({ type: 'sfx', name: b.name }); break;

            case 'spawn': for (let i = 0; i < b.n; i++) spawn(G, b.sid, b.where, me, ctx); break;
            case 'become':
                for (const t of resolve(G, me, b.who, ctx)) {
                    const def = G.defs[b.sid];
                    if (!def) continue;
                    t.sid = b.sid; t.hp = def.hp; t.mo = null; t.started = false; t.age = 0;
                    resetTimers(G, t, def);
                    G.solids = G.insts.filter((o) => alive(o) && G.defs[o.sid].solid);
                }
                break;
            case 'vanish': for (const t of resolve(G, me, b.who, ctx)) t.gone = true; break;
            case 'give':
                G.inv[b.item] = Math.min(999, (G.inv[b.item] || 0) + b.n);
                G.events.push({ type: 'give', item: b.item, n: b.n, x: me.x, y: me.y });
                break;
            case 'take': G.inv[b.item] = Math.max(0, (G.inv[b.item] || 0) - b.n); break;
            case 'score': G.score += b.n; break;
            case 'goto': {
                const last = G.cart.scenes.length - 1;
                const to = b.to === 'next' ? G.scene + 1 : b.to === 'prev' ? G.scene - 1 : 0;
                if (to >= 0 && to <= last && to !== G.scene) { G.goNext = to; G.goEntry = b.to === 'prev' ? 'prev' : 'next'; }
                else {
                    me.say = { text: b.to === 'next' ? 'No door here yet.' : 'Nothing that way.', t: SAY_TIME };
                }
                break;
            }
            case 'win': G.status = 'won'; G.events.push({ type: 'win' }); break;
            case 'lose': G.status = 'lost'; G.events.push({ type: 'lose' }); break;
            case 'console': G.events.push({ type: 'console', open: b.open }); break;

            case 'if':
                if (!exec(G, me, test(G, me, b.c) ? b.then : b.else, ctx)) return false;
                break;
            case 'repeat':
                for (let i = 0; i < b.n; i++) if (!exec(G, me, b.body, ctx)) return false;
                break;
            case 'setvar': G.vars[b.v] = b.n; break;
            case 'addvar': G.vars[b.v] = Math.max(-999, Math.min(999, (G.vars[b.v] || 0) + b.n)); break;
            case 'shout': G.msgs.push(b.msg); break;
        }
    }
    return true;
}

const fire = (G, me, rule, other = null) => exec(G, me, rule.body, { other, n: 0 });

// ------------------------------------------------------------------ movement

const DIR_VEC = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

function motion(G, me, def, inp, dt) {
    let vx = 0, vy = 0, flying = false;
    const mo = me.mo;
    if (mo) {
        const sp = def.speed;
        switch (mo.k) {
            case 'steer': {
                const l = Math.hypot(inp.x, inp.y);
                if (l > 0.08) { const k = Math.min(1, l) / l; vx = inp.x * k * sp; vy = inp.y * k * sp; }
                break;
            }
            case 'chase': case 'flee': {
                const t = nearest(G, me, mo.tag);
                if (t) {
                    const dx = t.x - me.x, dy = t.y - me.y, d = Math.hypot(dx, dy);
                    if (d > 0.05 && (mo.k === 'flee' || d > (radOf(G, me) + radOf(G, t)) * 0.8)) {
                        const s = mo.k === 'chase' ? 1 : -1;
                        vx = (dx / d) * sp * s; vy = (dy / d) * sp * s;
                    }
                }
                break;
            }
            case 'wander':
                me.wt -= dt;
                if (me.wt <= 0) {
                    me.wt = 0.6 + G.rng() * 1.2;
                    const a = G.rng() * Math.PI * 2;
                    me.wv = G.rng() < 0.7 ? [Math.cos(a), Math.sin(a)] : [0, 0];
                }
                vx = me.wv[0] * sp * 0.6; vy = me.wv[1] * sp * 0.6;
                break;
            case 'walk': {
                let v = DIR_VEC[mo.dir];
                if (mo.dir === 'forward') v = [me.fx, me.fy];
                else if (mo.dir === 'back') v = [-me.fx, -me.fy];
                vx = v[0] * sp; vy = v[1] * sp;
                break;
            }
            case 'fly': vx = me.fx * sp; vy = me.fy * sp; flying = true; break;
        }
        mo.t -= dt;
        if (mo.t <= 0) me.mo = null;
    }
    if (me.kb) {
        vx += me.kb.vx; vy += me.kb.vy;
        me.kb.t -= dt;
        if (me.kb.t <= 0) me.kb = null;
    }
    me.moving = vx !== 0 || vy !== 0;
    if (me.moving && !me.kb) {
        const l = Math.hypot(vx, vy);
        if (l > 0.01) { me.fx = vx / l; me.fy = vy / l; }
    }
    me.x += vx * dt;
    me.y += vy * dt;

    const r = rad(def);
    if (flying) {
        if (me.x < -1 || me.x > COLS + 1 || me.y < -1 || me.y > ROWS + 1) me.gone = true;
        return;
    }
    if (!G.tags[me.sid].has('flying') && !def.solid) {
        for (const s of G.solids) {
            if (s === me || !alive(s)) continue;
            let dx = me.x - s.x, dy = me.y - s.y, d = Math.hypot(dx, dy);
            const min = r + radOf(G, s);
            if (d < min) {
                if (d < 1e-4) { dx = 1; dy = 0; d = 1; }
                me.x = s.x + (dx / d) * min;
                me.y = s.y + (dy / d) * min;
            }
        }
    }
    me.x = Math.min(COLS - r, Math.max(r, me.x));
    me.y = Math.min(ROWS - r, Math.max(r, me.y));
}

// ------------------------------------------------------------------ the step

/** inp = { x, y, a, b, ah, bh, tap }: stick in [-1, 1] (y down), button edges and held, a tap in cells. */
export function step(G, inp, dt) {
    if (G.status !== 'play') return;
    inp = inp || NO_INPUT;
    G.t += dt;
    const byId = new Map(G.insts.map((o) => [o.id, o]));
    G.solids = G.insts.filter((o) => alive(o) && G.defs[o.sid].solid);

    // queued hats from last step: hurt
    const hq = G.hq; G.hq = [];
    for (const q of hq) {
        const o = byId.get(q.id);
        if (!o || o.gone) continue;
        const rules = G.defs[o.sid].rules;
        for (const r of rules) if (r.hat.t === q.hat && !halted(G)) fire(G, o, r);
    }
    // shouts from last step
    const msgs = G.msgs; G.msgs = [];
    for (const m of msgs) {
        for (const o of G.insts) {
            if (!alive(o)) continue;
            for (const r of G.defs[o.sid].rules) if (r.hat.t === 'message' && r.hat.msg === m && !halted(G)) fire(G, o, r);
        }
    }
    // a tap on a sticker
    if (inp.tap) {
        let best = null, bd = Infinity;
        for (const o of G.insts) {
            if (!alive(o)) continue;
            const reach = G.defs[o.sid].size === 2 ? 1.1 : 0.65;
            const d = Math.hypot(o.x - inp.tap.x, o.y - inp.tap.y);
            if (d < reach && d < bd) { bd = d; best = o; }
        }
        if (best) for (const r of G.defs[best.sid].rules) if (r.hat.t === 'tapped' && !halted(G)) fire(G, best, r);
    }

    // every sticker's own rules
    for (const me of G.insts.slice()) {
        if (!alive(me)) continue;
        let def = G.defs[me.sid];
        me.age += dt;
        me.flash = Math.max(0, me.flash - dt);
        me.inv = Math.max(0, me.inv - dt);
        if (me.say) { me.say.t -= dt; if (me.say.t <= 0) me.say = null; }
        const rules = def.rules;
        for (let ri = 0; ri < rules.length; ri++) {
            if (!alive(me) || G.defs[me.sid] !== def || halted(G)) break;
            const rule = rules[ri], h = rule.hat;
            switch (h.t) {
                case 'start': if (!me.started) { me.started = true; fire(G, me, rule); } break;
                case 'always': fire(G, me, rule); break;
                case 'every':
                    me.tm[ri] -= dt;
                    if (me.tm[ri] <= 0) { me.tm[ri] += h.sec; fire(G, me, rule); }
                    break;
                case 'press': {
                    const key = 'p' + ri;
                    me.tm[key] = (me.tm[key] || 0) - dt;
                    const down = h.btn === 'A' ? inp.a || inp.ah : inp.b || inp.bh;
                    if (down && me.tm[key] <= 0) { me.tm[key] = h.cd; fire(G, me, rule); }
                    break;
                }
                case 'touch': case 'near': {
                    const prev = me.ct[ri] || {};
                    let next = null;
                    for (const o of G.insts) {
                        if (o === me || !alive(o) || !hasTag(G, o, h.tag)) continue;
                        const hit = h.t === 'touch' ? touching(G, me, o) : dist(me, o) <= h.r;
                        if (!hit) continue;
                        if (!next) next = {};
                        const was = prev[o.id];
                        if (was === undefined) { next[o.id] = h.t === 'touch' ? CONTACT_REFIRE : NEAR_ONCE; fire(G, me, rule, o); }
                        else {
                            next[o.id] = was - dt;
                            if (h.t === 'touch' && next[o.id] <= 0) { next[o.id] = CONTACT_REFIRE; fire(G, me, rule, o); }
                        }
                        if (!alive(me) || halted(G)) break;
                    }
                    if (next) me.ct[ri] = next; else delete me.ct[ri];
                    break;
                }
                default: break;
            }
        }
    }

    // movement
    for (const me of G.insts) {
        if (alive(me)) motion(G, me, G.defs[me.sid], inp, dt);
    }

    // the defeated: their last words run, and may defeat others in turn
    for (let pass = 0; pass < 4; pass++) {
        const dying = G.insts.filter((o) => o.dying && !o.dead);
        if (!dying.length) break;
        for (const o of dying) {
            o.dying = false; o.dead = true;
            G.events.push({ type: 'die', id: o.id, sid: o.sid, x: o.x, y: o.y });
            for (const r of G.defs[o.sid].rules) if (r.hat.t === 'die' && !halted(G)) fire(G, o, r);
        }
    }

    G.insts = G.insts.filter((o) => !o.dead && !o.gone);
    if (G.pending.length) { G.insts.push(...G.pending); G.pending = []; }

    if (G.goNext !== null && G.status === 'play') {
        const idx = G.goNext, entry = G.goEntry;
        G.goNext = null;
        const carried = heroesOf(G);
        loadScene(G, idx, carried, entry);
        G.events.push({ type: 'scene', index: idx });
    }
    if (G.status === 'play' && G.hadHero && !G.insts.some((o) => alive(o) && hasTag(G, o, 'hero'))) {
        G.status = 'lost';
        G.events.push({ type: 'lose' });
    }
}

// ------------------------------------------------------------------ saving a running world

export function serialize(G) {
    const insts = G.insts.map((o) => JSON.parse(JSON.stringify(o)));
    return {
        v: 1, seed: G.seed, rngState: G.rng.state(), scene: G.scene, t: G.t, status: G.status, score: G.score,
        inv: { ...G.inv }, vars: { ...G.vars }, nextId: G.nextId, hadHero: G.hadHero,
        msgs: [...G.msgs], hq: JSON.parse(JSON.stringify(G.hq)), insts,
    };
}

export function deserialize(d, cart) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const G = newWorld(cart, d.scene, d.seed);
    G.rng.setState(d.rngState);
    G.t = d.t; G.status = d.status; G.score = d.score;
    G.inv = { ...d.inv }; G.vars = { ...d.vars }; G.nextId = d.nextId; G.hadHero = d.hadHero;
    G.msgs = [...d.msgs]; G.hq = JSON.parse(JSON.stringify(d.hq));
    G.insts = d.insts.map((o) => JSON.parse(JSON.stringify(o)));
    G.pending = [];
    G.events = [];
    G.solids = G.insts.filter((o) => G.defs[o.sid]?.solid);
    return G;
}

