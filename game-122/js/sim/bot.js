// An auto-player that does the research for real. It never looks at the island's laws: it knows
// only what its notebook (G.notes) has recorded from experiments and casts, what the pages say,
// what a glyph looks like (ringed or bare), and what it can see. The simtest greps this file to
// make sure the word for the hidden laws never appears in it.
//
// botTick(G, bot) → { inp, cmds }: the walking input for the next step and the discrete actions
// (the same act() commands the UI sends) to apply first.

import { ESSENCES, FORMS, ESSENCE_INFO, PLAYER, PHASES } from '../config.js';
import { REAGENTS, REAGENT_IDS, ITEMS } from './data/reagents.js';
import { SITES, NODES, HILLTOP } from './world.js';
import { worldOf, phaseOf, isNight } from './util.js';
import { findPath } from './nav.js';
import { usables, publicGlyph } from './game.js';
import { dialogNode } from './story.js';
import { ventPos } from './magic.js';

const IDLE = { mx: 0, my: 0, dyaw: 0, dpitch: 0, sprint: false, jump: false };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function makeBot({ skill = 1, romance = true } = {}) {
    return { skill, romance, q: [], cur: null, path: null, pi: 0, stuck: 0, lastP: null, lastPT: 0, fails: 0, log: [], elowen: null, giveUp: 0, ticks: 0 };
}

// ------------------------------------------------------------------ what the bot knows
function know(G) {
    const N = G.notes;
    const kind = (g) => publicGlyph(G, g).kind;
    const gE = {}, sF = {};
    for (const g of G.glyphs) {
        if (kind(g) === 'essence' && N.glyphs[g]?.essence) gE[g] = N.glyphs[g].essence;
        if (kind(g) === 'shape' && N.shapes[g]?.form) sF[g] = N.shapes[g].form;
    }
    // elimination: three shapes, six words, each meaning used once
    const shapes = G.glyphs.filter((g) => kind(g) === 'shape');
    const free = (all, known) => all.filter((x) => !Object.values(known).includes(x));
    for (let pass = 0; pass < 3; pass++) {
        const unk = shapes.filter((g) => !sF[g]);
        if (shapes.length === 3 && unk.length === 1) sF[unk[0]] = free(FORMS, sF)[0];
        for (const g of G.glyphs.filter((g) => kind(g) === 'essence' && !gE[g])) {
            const cand = free(ESSENCES, gE).filter((e) => !(N.glyphs[g]?.not || []).includes(e));
            if (cand.length === 1) gE[g] = cand[0];
        }
    }
    const rE = {}, pot = {};
    for (const r in N.reagents) if (N.reagents[r].essence) { rE[r] = N.reagents[r].essence; pot[r] = N.reagents[r].potency || 1; }
    const opp = {};
    for (const [a, b] of N.opp) { opp[a] = b; opp[b] = a; }
    return { order: N.order, gE, sF, rE, pot, opp, wax: N.wax, kind };
}

const glyphFor = (K, e) => Object.keys(K.gE).find((g) => K.gE[g] === e);
const shapeFor = (K, f) => Object.keys(K.sF).find((g) => K.sF[g] === f);
/** Reagents in the bag that carry essence e, strongest first when strong, else weakest first. */
function reagentsFor(G, K, e, strong = false) {
    const ids = Object.keys(G.bag).filter((r) => REAGENTS[r] && K.rE[r] === e && G.bag[r] > 0);
    return ids.sort((a, b) => (strong ? K.pot[b] - K.pot[a] : K.pot[a] - K.pot[b]));
}
const stock = (G, K, e) => reagentsFor(G, K, e).reduce((s, r) => s + G.bag[r], 0);

/** Write a spell: a form and one or two essences. Returns { glyphs, feed } or null. */
function spell(G, K, form, ess, { strong = false } = {}) {
    const s = shapeFor(K, form);
    if (!s) return null;
    const words = [], feed = [];
    const used = {};
    for (const e of ess) {
        const g = glyphFor(K, e);
        if (!g) return null;
        const r = reagentsFor(G, K, e, strong).find((x) => G.bag[x] - (used[x] || 0) > 0);
        if (!r) return null;
        used[r] = (used[r] || 0) + 1;
        words.push(g); feed.push(r);
    }
    const first = K.order !== 'essence-first';
    return first ? { glyphs: [s, ...words], feed: [null, ...feed] } : { glyphs: [...words, s], feed: [...feed, null] };
}

// ------------------------------------------------------------------ tasks
const T = {
    go: (x, z, near = 1.6, why = '') => ({ t: 'go', x, z, near, why }),
    use: (id, why = '') => ({ t: 'use', id, why }),
    act: (cmd) => ({ t: 'act', cmd }),
    aimcast: (aim) => ({ t: 'aimcast', aim }),
    face: (yaw, pitch = 0) => ({ t: 'face', yaw, pitch }),
    walk: (x, z, opts = {}) => ({ t: 'walk', x, z, ...opts }),
    gather: (item, n, region) => ({ t: 'gather', item, n, region }),
    wait: (s) => ({ t: 'wait', s }),
};

const say = (bot, s) => { bot.log.push(s); if (bot.log.length > 400) bot.log.shift(); };

export function botTick(G, bot) {
    bot.ticks++;
    const cmds = [];
    if (G.over) return { inp: IDLE, cmds };
    if (G.dialog) {
        const n = dialogNode(G);
        if (n?.choices) {
            let c = 0;
            if (bot.romance) {
                c = n.choices.reduce((bi, ch, i) => ((ch.aff || 0) > (n.choices[bi].aff || 0) ? i : bi), 0);
                const heart = n.choices.findIndex((ch) => ch.end === 'heart');
                if (heart >= 0) c = heart;
            }
            cmds.push({ t: 'say', choice: c });
        } else {
            if (n?.who === 'page') readPage(G, bot, n.text);
            cmds.push({ t: 'say' });
        }
        return { inp: IDLE, cmds };
    }
    // eat when hungry
    if (G.p.vigor < 45) {
        const food = ['clamcooked', 'chanterellecooked', 'berries', 'chanterelle', 'clam'].find((f) => G.bag[f] > 0);
        if (food) cmds.push({ t: 'eat', item: food });
    }
    if (!bot.cur) {
        if (!bot.q.length) plan(G, bot);
        bot.cur = bot.q.shift() || T.wait(0.5);
        bot.path = null; bot.stuck = 0; bot.started = G.t;
    }
    const r = run(G, bot, bot.cur, cmds);
    if (r.done) {
        if (r.fail) {
            bot.fails++;
            say(bot, `fail t=${G.t.toFixed(0)} ${r.why || ''}`);
            if (bot.cur.pick) (bot.bad ||= []).push(bot.cur.pick);
            bot.q = [T.wait(1)];          // don't hammer the route finder
            bot.giveUp++;
        }
        bot.cur = null;
    }
    return { inp: r.inp || IDLE, cmds };
}

function readPage(G, bot, text) {
    // the two words she spoke together, from "speak the X word and the Y word"
    const m = /speak \*\*(the \w+ word)\*\* and \*\*(the \w+ word)\*\*/.exec(text);
    if (m) {
        const e = (w) => ESSENCES.find((x) => ESSENCE_INFO[x].word === w);
        bot.elowen = [e(m[1]), e(m[2])];
        say(bot, `elowen spoke ${bot.elowen}`);
    }
}

function steerTo(G, x, z, run = false) {
    const p = G.p;
    const dx = x - p.x, dz = z - p.z;
    const want = Math.atan2(dx, -dz);
    const d = wrap(want - p.yaw);
    const turn = Math.max(-0.25, Math.min(0.25, d));
    const ahead = Math.abs(d) < 0.9;
    return { mx: 0, my: ahead ? 1 : 0.15, dyaw: turn, dpitch: -p.pitch * 0.2, sprint: run && Math.abs(d) < 0.3, jump: false };
}

function run(G, bot, t, cmds) {
    const p = G.p;
    const elapsed = G.t - bot.started;
    switch (t.t) {
        case 'wait': return { done: elapsed >= t.s };
        case 'act': cmds.push(t.cmd); return { done: true };
        case 'face': {
            const dy = wrap(t.yaw - p.yaw), dp = t.pitch - p.pitch;
            if (Math.abs(dy) < 0.01 && Math.abs(dp) < 0.01) return { done: true };
            return { inp: { ...IDLE, dyaw: Math.max(-0.3, Math.min(0.3, dy)), dpitch: Math.max(-0.3, Math.min(0.3, dp)) } };
        }
        case 'aimcast': {
            const a = t.aim;
            const ex = p.x, ey = p.y + PLAYER.eye - 0.1, ez = p.z;
            const yaw = Math.atan2(a.x - ex, -(a.z - ez));
            const pitch = Math.atan2(a.y - ey, Math.hypot(a.x - ex, a.z - ez));
            const dy = wrap(yaw - p.yaw), dp = pitch - p.pitch;
            if (Math.abs(dy) < 0.004 && Math.abs(dp) < 0.004) { cmds.push({ t: 'cast' }); return { done: true }; }
            return { inp: { ...IDLE, dyaw: Math.max(-0.3, Math.min(0.3, dy)), dpitch: Math.max(-0.3, Math.min(0.3, dp)) } };
        }
        case 'walk': {
            // a straight walk with no route finding: across ice, into an updraft, off a ledge
            const d = Math.hypot(t.x - p.x, t.z - p.z);
            if (d < (t.near || 0.9) && (t.minY == null || p.y >= t.minY) && (!t.land || p.ground)) return { done: true };
            if (elapsed > (t.timeout || 25)) return { done: true, fail: true, why: `walk timeout at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} to ${t.x},${t.z} climb ${t.climb}` };
            if (t.until && t.until(G)) return { done: true };
            if (t.climb === 'seal') {
                const s = [...G.seals].reverse().find((x) => x.kind === 'updraft');
                if (!s) return { done: true, fail: true, why: 'no updraft' };
                t.climb = s.lift - 1.2; t.cx = s.x; t.cz = s.z;
            }
            if (t.climb != null && p.y < t.climb && !t.risen) {
                // stand in the updraft and rise before going anywhere
                const s = steerTo(G, t.cx, t.cz);
                const dc = Math.hypot(t.cx - p.x, t.cz - p.z);
                return { inp: { ...s, my: dc > 0.5 ? 0.6 : 0, sprint: false } };
            }
            if (t.climb != null) t.risen = true;
            return { inp: d < 0.4 ? IDLE : { ...steerTo(G, t.x, t.z), my: Math.min(1, d) } };
        }
        case 'go': {
            const d = Math.hypot(t.x - p.x, t.z - p.z);
            if (d < t.near) return { done: true };
            // through the hut door square-on, never by a corner
            const H = SITES.hut;
            const hutSide = (x, z) => Math.abs(x - H.x) < H.w / 2 && Math.abs(z - H.z) < H.d / 2;
            if (!t.viaDoor && hutSide(t.x, t.z) !== hutSide(p.x, p.z)) {
                const out = { x: H.x, z: H.z - H.d / 2 - 2.2 }, inn = { x: H.x, z: H.z - H.d / 2 + 1.6 };
                const [a, b] = hutSide(p.x, p.z) ? [inn, out] : [out, inn];
                bot.q.unshift({ ...t, viaDoor: true });
                bot.q.unshift(T.walk(b.x, b.z, { near: 0.5, timeout: 8 }));
                bot.q.unshift(T.walk(a.x, a.z, { near: 0.5, timeout: 8 }));
                if (Math.hypot(a.x - p.x, a.z - p.z) > 6) bot.q.unshift(T.go(a.x, a.z, 1.0, 'door'));
                return { done: true };
            }
            // short hops indoors and up close: walk straight, sliding along whatever is in the way
            if (d < 7 && (hutSide(p.x, p.z) || bot.direct)) {
                if (elapsed > 12) return { done: true, fail: true, why: `direct ${t.why} from ${G.p.x.toFixed(1)},${G.p.y.toFixed(1)},${G.p.z.toFixed(1)} to ${t.x.toFixed(1)},${t.z.toFixed(1)}` };
                return { inp: { ...steerTo(G, t.x, t.z), my: Math.min(1, d) } };
            }
            if (!bot.path || G.t - bot.pathT > 12) {
                bot.path = findPath(G, p.x, p.z, t.x, t.z);
                bot.pi = 1; bot.pathT = G.t;
                if (!bot.path) return { done: true, fail: true, why: `no path to ${t.x.toFixed(0)},${t.z.toFixed(0)} ${t.why}` };
            }
            let w = bot.path[Math.min(bot.pi, bot.path.length - 1)];
            while (bot.pi < bot.path.length - 1 && Math.hypot(w.x - p.x, w.z - p.z) < 1.2) { bot.pi++; w = bot.path[bot.pi]; }
            // stuck?
            if (!bot.lastP || G.t - bot.lastPT > 2) {
                if (bot.lastP && Math.hypot(bot.lastP.x - p.x, bot.lastP.z - p.z) < 0.6) { bot.stuck++; bot.path = null; }
                bot.lastP = { x: p.x, z: p.z }; bot.lastPT = G.t;
            }
            if (bot.stuck > 6) return { done: true, fail: true, why: 'stuck ' + t.why };
            const inp = steerTo(G, w.x, w.z, d > 12);
            if (bot.stuck > 2) inp.jump = (bot.ticks % 60) === 0;
            return { inp };
        }
        case 'use': {
            const u = usables(G).find((x) => x.id === t.id);
            if (!u) return { done: true };
            const d = Math.hypot(u.x - p.x, u.z - p.z);
            const reach = PLAYER.reach + (u.reach || 0) + 1.2;
            if (d > reach) { bot.q.unshift(t); bot.q.unshift(T.go(u.x, u.z, Math.max(1.2, reach - 0.8), 'use ' + t.id)); return { done: true }; }
            cmds.push({ t: 'use', id: t.id });
            return { done: true };
        }
        case 'gather': {
            if ((G.bag[t.item] || 0) >= t.n) return { done: true };
            let best = null, bd = Infinity;
            for (const k of G.pickups) {
                if (!k.alive || k.item !== t.item) continue;
                if (t.region && worldOf(G).regionAt(k.x, k.z) !== t.region && !(t.region === 'shore' && k.z > 140)) continue;
                const d = Math.hypot(k.x - p.x, k.z - p.z);
                if (d < bd && !(bot.bad || []).includes(k.id)) { bd = d; best = k; }
            }
            if (!best) return { done: true };
            bot.q.unshift(t);
            bot.q.unshift(T.use(best.id));
            bot.q.unshift({ ...T.go(best.x, best.z, 1.8, 'pickup'), pick: best.id });
            return { done: true };
        }
    }
    return { done: true };
}

// ------------------------------------------------------------------ the plan
const hutPos = (G, k) => worldOf(G).hutAt(k);
const inHut = (G) => G.p.inside;

function nightCheck(G, bot) {
    const ph = phaseOf(G.tod);
    if (bot.noSleep || G.flags.gallery) return false;   // at her feet, the hour matters more than sleep
    if ((ph === 'night' || (ph === 'dusk' && G.tod > 0.56)) && G.flags.hearth) {
        if (Math.hypot(G.p.x, G.p.z) < SITES.thorn.r - 2) {
            // inside the curse: no walking home. Make a fire and sit by it until morning.
            const K = know(G);
            const fire = spell(G, K, 'seal', ['kindle']);
            if (!fire) return false;
            bot.q.push(T.face(G.p.yaw, -0.3));
            castAt(bot, fire, null);
            bot.q.push(T.act({ t: 'cook' }), T.act({ t: 'rest', until: 'dawn' }));
            return true;
        }
        const b = hutPos(G, 'bed');
        bot.q.push(T.go(NODES.hutin[0], NODES.hutin[1], 1.5, 'home for the night'), T.go(b.x - 1.2, b.z - 0.4, 1.0, 'bed'));
        bot.q.push(T.act({ t: 'cook' }), T.act({ t: 'rest', until: 'dawn' }));
        return true;
    }
    return false;
}

/** Gather reagents so the bag holds at least n of each listed type that has spawns left. */
function stockUp(G, bot, types, n) {
    let any = false;
    for (const r of types) if ((G.bag[r] || 0) < n && G.pickups.some((k) => k.alive && k.item === r)) { bot.q.push(T.gather(r, n, REAGENTS[r].region)); any = true; }
    return any;
}

function foodRun(G, bot) {
    const total = ['clamcooked', 'chanterellecooked', 'berries', 'chanterelle', 'clam'].reduce((s, f) => s + (G.bag[f] || 0), 0);
    if (G.p.vigor > 60 || total >= 2) return false;
    let best = null, bd = 90;
    for (const k of G.pickups) {
        if (!k.alive || !(k.kind === 'bush' || k.item === 'clam' || k.item === 'chanterelle')) continue;
        if (k.kind === 'bush' && !k.alive) continue;
        const d = Math.hypot(k.x - G.p.x, k.z - G.p.z);
        if (d < bd && findPath(G, G.p.x, G.p.z, k.x, k.z)) { bd = d; best = k; }
    }
    if (!best) return false;
    bot.q.push(T.go(best.x, best.z, 1.8, 'food'), T.use(best.id));
    return true;
}

/** Research at the hut: distil new reagents, read the orrery, test glyphs, ring the bells. */
function research(G, bot, K) {
    const N = G.notes;
    const atHut = () => { if (!inHut(G)) { bot.q.push(T.go(NODES.hutin[0], NODES.hutin[1], 1.5, 'to the hut')); return true; } return false; };
    const instAt = (k) => { const a = hutPos(G, k); return T.go(a.x + (a.x > SITES.hut.x ? -1.2 : 1.2), a.z, 0.9, k); };
    // 1. distil one of every reagent type whose essence we don't know
    const unknown = Object.keys(G.bag).filter((r) => REAGENTS[r] && !K.rE[r] && G.bag[r] > 0);
    if (unknown.length) {
        if (atHut()) return true;
        bot.q.push(instAt('alembic'));
        for (const r of unknown) bot.q.push(T.act({ t: 'experiment', inst: 'alembic', a: r }));
        return true;
    }
    // 2. the orrery for every essence whose hour we don't know
    const waxless = ESSENCES.filter((e) => !K.wax[e] && reagentsFor(G, K, e).length);
    if (waxless.length) {
        if (atHut()) return true;
        bot.q.push(instAt('orrery'));
        for (const e of waxless) bot.q.push(T.act({ t: 'experiment', inst: 'orrery', a: reagentsFor(G, K, e)[0] }));
        return true;
    }
    // 3. test unknown glyphs at the circle
    const kind = K.kind;
    const unkWords = G.glyphs.filter((g) => kind(g) === 'essence' && !K.gE[g]);
    const unkShapes = G.glyphs.filter((g) => kind(g) === 'shape' && !K.sF[g]);
    const shapes = G.glyphs.filter((g) => kind(g) === 'shape');
    for (const g of unkWords) {
        const taken = Object.values(K.gE);
        const not = N.glyphs[g]?.not || [];
        const cand = ESSENCES.filter((e) => !taken.includes(e) && !not.includes(e) && reagentsFor(G, K, e).length);
        if (!cand.length) continue;
        if (atHut()) return true;
        const s = unkShapes[0] || shapes[0];
        const r = reagentsFor(G, K, cand[0])[0];
        const first = K.order !== 'essence-first';
        const sp = first ? { glyphs: [s, g], feed: [null, r] } : { glyphs: [g, s], feed: [r, null] };
        bot.q.push(T.go(hutPos(G, 'circle').x, hutPos(G, 'circle').z - 1.6, 0.8, 'circle'), T.face(Math.PI, -0.2));
        bot.q.push(T.act({ t: 'inscribe', slot: 0, ...sp, n: 1 }), T.act({ t: 'select', slot: 0 }), T.act({ t: 'cast' }), T.wait(0.3));
        say(bot, `test glyph ${g} as ${cand[0]}`);
        return true;
    }
    // shapes still unknown with all words known: cast a known word in each unknown shape
    if (unkShapes.length && Object.keys(K.sF).length < 2) {
        const e = ESSENCES.find((x) => glyphFor(K, x) && reagentsFor(G, K, x).length && x !== 'gale');
        if (e) {
            if (atHut()) return true;
            const g = glyphFor(K, e), r = reagentsFor(G, K, e)[0], s = unkShapes[0];
            const sp = K.order !== 'essence-first' ? { glyphs: [s, g], feed: [null, r] } : { glyphs: [g, s], feed: [r, null] };
            bot.q.push(T.act({ t: 'inscribe', slot: 0, ...sp, n: 1 }), T.act({ t: 'select', slot: 0 }), T.act({ t: 'cast' }), T.wait(0.3));
            return true;
        }
    }
    // 4. the bells, until every known essence's opposite is known (or can't be)
    const known = ESSENCES.filter((e) => reagentsFor(G, K, e).length);
    for (const a of known) {
        if (K.opp[a]) continue;
        for (const b of known) {
            if (a === b || K.opp[b]) continue;
            const ra = reagentsFor(G, K, a)[0], rb = reagentsFor(G, K, b)[0];
            const tried = [...N.apartR, ...N.oppR].some(([x, y]) => (K.rE[x] === a && K.rE[y] === b) || (K.rE[x] === b && K.rE[y] === a));
            if (tried) continue;
            if (atHut()) return true;
            bot.q.push(instAt('bells'), T.act({ t: 'experiment', inst: 'bells', a: ra, b: rb }));
            return true;
        }
    }
    return false;
}

/** Cast a spell aimed at a point (a bolt), or here (a ward or a seal). */
function castAt(bot, sp, aim, n = 1) {
    bot.q.push(T.act({ t: 'inscribe', slot: 0, ...sp, n }), T.act({ t: 'select', slot: 0 }));
    if (aim) bot.q.push(T.aimcast(aim)); else bot.q.push(T.act({ t: 'cast' }));
    bot.q.push(T.wait(0.2));
}

const shore = ['seaglass', 'kelp', 'cowrie'];
const byRegion = (reg) => REAGENT_IDS.filter((r) => REAGENTS[r].region === reg);

function plan(G, bot) {
    const F = G.flags, K = know(G), p = G.p, W = worldOf(G);
    // the first evening
    if (!F.hearth) {
        if ((G.bag.driftwood || 0) < 3) { bot.q.push(T.gather('driftwood', 3)); return; }
        if (stockUp(G, bot, shore, 3)) return;
        bot.q.push(T.go(NODES.hutdoor[0], NODES.hutdoor[1], 2), T.go(NODES.hutin[0], NODES.hutin[1], 1.2), T.use('hearth'));
        return;
    }
    if (!G.hasWand) { bot.q.push(T.use('desk')); return; }
    if (!G.pages.includes('p2')) { bot.q.push(T.use('page_p2')); return; }
    if (!F.lintel) { bot.q.push(T.go(hutPos(G, 'circle').x, hutPos(G, 'circle').z, 1.0), T.face(Math.PI, 0.35), T.use('lintel')); return; }
    if (nightCheck(G, bot)) return;
    if (foodRun(G, bot)) return;
    const goal = G.flags.firstSpell + G.nib.mode + Object.keys(G.flags).length;
    if (goal !== bot.lastGoal || G.day !== bot.lastDay) { bot.lastGoal = goal; bot.lastDay = G.day; bot.giveUp = 0; }
    if (bot.giveUp > 60) {
        // nothing left to pick today: sleep until things grow back
        const b = hutPos(G, 'bed');
        bot.q.push(T.go(b.x - 1.2, b.z - 0.4, 1.0, 'bed to wait'), T.act({ t: 'rest', until: 'dawn' }));
        return;
    }

    // research whatever can be researched with what is in the bag
    if (inHut(G) || Object.keys(G.bag).some((r) => REAGENTS[r] && !K.rE[r])) {
        if (research(G, bot, K)) return;
    }

    // keep a working stock of the shore's three
    if (!F.firstSpell || G.nib.mode === 'caged') {
        if (shore.some((r) => (G.bag[r] || 0) < 2)) { if (stockUp(G, bot, shore, 4)) return; }
        if (research(G, bot, K)) return;
    }

    // Nib
    if (G.nib.mode === 'caged') {
        const e = ['kindle', 'rime', 'gale'].find((x) => spell(G, K, 'bolt', [x]));
        if (!e) { bot.giveUp++; stockUp(G, bot, shore, 5); return; }
        bot.q.push(T.go(SITES.cage.x + 6, SITES.cage.z + 3, 1.5, 'cage'));
        castAt(bot, spell(G, K, 'bolt', [e]), { x: SITES.cage.x, y: W.height(SITES.cage.x, SITES.cage.z) + 0.8, z: SITES.cage.z });
        bot.q.push(T.wait(0.5));
        return;
    }
    if (G.nib.mode === 'freed') { bot.q.push(T.go(SITES.cage.x + 3, SITES.cage.z, 2)); return; }

    // Whisperwood: its word, its reagents, its stone
    if (!G.pages.includes('p4')) { bot.q.push(T.use('page_p4')); return; }
    if (!G.story.said.carve_wood) { bot.q.push(T.use('post')); return; }
    if (!G.pages.includes('p5')) { bot.q.push(T.use('page_p5')); return; }
    const woodR = byRegion('wood');
    if (!F.stoneWood) {
        if (!glyphFor(K, 'bloom') || stock(G, K, 'bloom') < 2) {
            if (woodR.some((r) => !K.rE[r] && !(G.bag[r] > 0))) { if (stockUp(G, bot, woodR, 3)) return; }
            if (glyphFor(K, 'bloom') && reagentsFor(G, K, 'bloom').length) { /* fine */ }
            if (stock(G, K, 'bloom') < 3) {
                const br = woodR.filter((r) => K.rE[r] === 'bloom');
                if (br.length && stockUp(G, bot, br, 4)) return;
            }
            if (research(G, bot, K)) return;
            if (!glyphFor(K, 'bloom')) { bot.giveUp++; if (stockUp(G, bot, woodR, 4)) return; bot.q.push(T.wait(2)); return; }
        }
        if (!F.bridge) {
            const sp = spell(G, K, 'seal', ['bloom']);
            if (!sp) { if (stockUp(G, bot, woodR.filter((r) => K.rE[r] === 'bloom'), 4)) return; bot.giveUp++; return; }
            bot.q.push(T.go(SITES.seedbed.x + 2.6, SITES.seedbed.z, 0.6, 'seedbed'), T.face(-Math.PI / 2, -0.3));
            castAt(bot, sp, null);
            return;
        }
        const sp = spell(G, K, 'bolt', ['bloom', 'bloom']) || null;
        if (!sp) { const br = woodR.filter((r) => K.rE[r] === 'bloom'); if (stockUp(G, bot, br, 4)) return; bot.giveUp++; return; }
        bot.q.push(T.go(SITES.mere.x + 3.2, SITES.mere.z, 1.0, 'islet'));
        castAt(bot, sp, { x: SITES.mere.x, y: W.height(SITES.mere.x, SITES.mere.z) + 1.6, z: SITES.mere.z });
        return;
    }

    // Ember Fen
    const fenR = byRegion('fen');
    if (!F.stoneFen) {
        if (!F.iceWall) {
            if (!G.pages.includes('p6')) { bot.q.push(T.use('page_p6')); return; }
            const sp = spell(G, K, 'bolt', ['kindle', 'kindle']);
            if (!sp) { if (stockUp(G, bot, shore.filter((r) => K.rE[r] === 'kindle'), 4)) return; bot.giveUp++; return; }
            bot.q.push(T.go(NODES.gorge[0] - 2, NODES.gorge[1], 1.5, 'gorge'));
            const x = SITES.fen.x - SITES.fen.r - 3.5;
            castAt(bot, sp, { x, y: W.height(x, SITES.fen.z) + 3, z: SITES.fen.z });
            return;
        }
        if (!G.story.said.carve_fen) { bot.q.push(T.use('bellows')); return; }
        if (!glyphFor(K, 'gale') || stock(G, K, 'gale') < 2) {
            if (fenR.some((r) => !K.rE[r] && !(G.bag[r] > 0))) { if (stockUp(G, bot, fenR, 3)) return; }
            const gr = fenR.filter((r) => K.rE[r] === 'gale');
            if (gr.length && stock(G, K, 'gale') < 6 && stockUp(G, bot, gr, 6)) return;
            if (research(G, bot, K)) return;
            if (!glyphFor(K, 'gale')) { bot.giveUp++; if (stockUp(G, bot, fenR, 4)) return; bot.q.push(T.wait(2)); return; }
        }
        const sp = spell(G, K, 'bolt', ['gale', 'gale']);
        if (!sp) { if (stockUp(G, bot, fenR.filter((r) => K.rE[r] === 'gale'), 6)) return; bot.giveUp++; return; }
        bot.q.push(T.go(SITES.pool.x, SITES.pool.z + SITES.pool.r + 2.5, 1.2, 'south of the pool'));   // not down the causeway: the vents would catch the bolt
        castAt(bot, sp, { x: SITES.pool.x, y: W.height(SITES.pool.x, SITES.pool.z) + 1.6, z: SITES.pool.z });
        return;
    }

    // The Highmoor
    const moorR = byRegion('moor');
    const onMoor = Math.hypot(p.x - SITES.moor.x, p.z - SITES.moor.z) < SITES.moor.r - 1 && p.y > W.height(NODES.moorbase[0], NODES.moorbase[1]) + 6;
    const climb = () => {
        const sp = spell(G, K, 'seal', ['gale']);
        if (!sp) { stockUp(G, bot, fenR.filter((r) => K.rE[r] === 'gale'), 4); bot.giveUp++; return; }
        const [bx, bz] = NODES.moorbase;
        bot.q.push(T.go(bx, bz - 2.5, 0.7, 'cliff foot'), T.face(0, 0));
        castAt(bot, sp, null);
        bot.q.push(T.walk(bx, bz - 14, { climb: 'seal', near: 1.5, land: true, timeout: 30 }));
    };
    if (!F.stoneMoor) {
        const needStill = !glyphFor(K, 'still') || stock(G, K, 'still') < 2;
        if (needStill || !G.story.said.carve_moor || !G.pages.includes('p7')) {
            const moorTypesKnown = moorR.every((r) => K.rE[r]);
            if (!onMoor && (!G.story.said.carve_moor || !moorTypesKnown || stock(G, K, 'still') < 3 || !G.pages.includes('p7'))) {
                // research first if the bag already holds what's needed
                if (moorR.some((r) => G.bag[r] > 0 && !K.rE[r]) && research(G, bot, K)) return;
                if (glyphFor(K, 'still') && stock(G, K, 'still') >= 2 && G.story.said.carve_moor && G.pages.includes('p7')) { /* go cast */ }
                else { if (stock(G, K, 'gale') < 1) { if (stockUp(G, bot, fenR.filter((r) => K.rE[r] === 'gale'), 4)) return; } climb(); return; }
            }
            if (onMoor) {
                if (!G.story.said.carve_moor) { bot.q.push(T.use('herald')); return; }
                if (!G.pages.includes('p7')) { bot.q.push(T.use('page_p7')); return; }
                if (stockUp(G, bot, moorR, 4)) return;
                // walk off the cliff, back toward the hut
                bot.q.push(T.go(0, -101.5, 1.0, 'cliff edge'), T.walk(0, -88, { near: 2, land: true }));
                return;
            }
            if (research(G, bot, K)) return;
        }
        if (!glyphFor(K, 'still')) { bot.giveUp++; if (research(G, bot, K)) return; climb(); return; }
        const sp = spell(G, K, 'bolt', ['still', 'still']);
        if (!sp) { if (!onMoor) { climb(); return; } stockUp(G, bot, moorR.filter((r) => K.rE[r] === 'still'), 4); bot.giveUp++; return; }
        if (!onMoor) { climb(); return; }
        bot.q.push(T.go(NODES.ringS[0], NODES.ringS[1], 1.2, 'ring'));
        castAt(bot, sp, { x: SITES.storm.x, y: W.height(SITES.storm.x, SITES.storm.z) + 1.6, z: SITES.storm.z });
        return;
    }
    if (onMoor) { bot.q.push(T.go(0, -101.5, 1.0, 'cliff edge'), T.walk(0, -88, { near: 2, land: true })); return; }

    // The castle. First make sure the notebook holds what the keep will need.
    const pair = Object.keys(K.opp).find((e) => glyphFor(K, e) && glyphFor(K, K.opp[e]));
    const need = {};
    const want = (e, n) => { need[e] = (need[e] || 0) + n; };   // uses add up: gale lifts you AND may be one of her words
    if (!F.thornGap) { if (pair) { want(pair, 1); want(K.opp[pair], 1); } }
    if (!F.crossedMoat) want('rime', 1);
    if (!F.door) want('lumen', 2);
    if (!F.gallery) want('gale', 1);
    want('kindle', 2);                       // a fire to wait by, a night or two
    if (bot.elowen) { want(bot.elowen[0], 2); want(bot.elowen[1], 2); }
    const inside = Math.hypot(p.x, p.z) < SITES.moat.inner;
    if (!pair || !ESSENCES.every((e) => K.wax[e] || !glyphFor(K, e))) { if (research(G, bot, K)) return; }
    for (const e in need) {
        if (!inside && stock(G, K, e) < need[e]) {
            const types = REAGENT_IDS.filter((r) => K.rE[r] === e && REAGENTS[r].region !== 'moor');
            const moorTypes = REAGENT_IDS.filter((r) => K.rE[r] === e && REAGENTS[r].region === 'moor');
            if (types.length && stockUp(G, bot, types, need[e] + 1)) return;
            if (!types.length && moorTypes.length) { if (onMoor) { if (stockUp(G, bot, moorTypes, need[e] + 1)) return; } else { climb(); return; } }
        }
    }
    if (!F.thornGap) {
        if (!pair) { bot.giveUp++; if (research(G, bot, K)) return; bot.q.push(T.wait(2)); return; }
        if (!G.pages.includes('p8')) { bot.q.push(T.use('page_p8')); return; }
        const sp = spell(G, K, 'bolt', [pair, K.opp[pair]]);
        if (!sp) { bot.giveUp++; return; }
        bot.q.push(T.go(0, 72, 1.0, 'before the thorns'));
        castAt(bot, sp, { x: 0, y: 9, z: SITES.thorn.r });
        return;
    }
    if (!F.crossedMoat) {
        if (isNight(G) || phaseOf(G.tod) === 'dusk') { if (nightCheck(G, bot)) return; }
        const sp = spell(G, K, 'ward', ['rime']);
        if (!sp) { bot.giveUp++; return; }
        bot.q.push(T.go(0, 63, 0.7, 'moat edge'), T.face(Math.PI, 0));
        castAt(bot, sp, null);
        bot.q.push(T.walk(0, 47.5, { near: 1.0, timeout: 20 }));
        return;
    }
    if (!F.gate) { bot.giveUp++; bot.q.push(T.wait(2)); return; }
    if (!F.inCastle) {
        const sp = spell(G, K, 'ward', ['lumen']);
        bot.q.push(T.go(0, 24, 1.2, 'gate'));
        if (sp) castAt(bot, sp, null);
        bot.q.push(T.go(0, 13, 1.2, 'courtyard'));
        return;
    }
    if (!G.pages.includes('p9')) { bot.q.push(T.use('page_p9')); return; }
    if (!F.door) {
        const sp = spell(G, K, 'ward', ['lumen']);
        if (!sp) { bot.giveUp++; return; }
        bot.q.push(T.go(0, 6.5, 1.0, 'keep door'));
        castAt(bot, sp, null);
        bot.q.push(T.wait(0.5));
        return;
    }
    if (!G.pages.includes('p10')) { bot.q.push(T.use('page_p10')); return; }
    if (!F.gallery) {
        const sp = spell(G, K, 'seal', ['gale']);
        if (!sp) { bot.giveUp++; return; }
        bot.q.push(T.go(0, 1.2, 0.5, 'under the gallery'), T.face(0, 0));
        castAt(bot, sp, null);
        bot.q.push(T.walk(0, -4.6, { climb: 'seal', near: 0.8, land: true, timeout: 30 }));
        return;
    }
    // the heart
    if (!bot.elowen) { bot.giveUp++; bot.q.push(T.use('page_p8')); return; }
    const [a, b] = bot.elowen;
    const sp = spell(G, K, 'seal', [a, b], { strong: true });
    if (!sp) { bot.giveUp++; return; }
    const power = sp.feed.filter(Boolean).reduce((s, r) => s + (K.pot[r] || 1), 0);
    const ph = phaseOf(G.tod);
    const waxing = (K.wax[a] === ph ? 1 : 0) + (K.wax[b] === ph ? 1 : 0);
    if (power + waxing < 3) {
        // wait for an hour when one of her words waxes: rest by a fire made on the gallery
        const target = K.wax[a] || K.wax[b];
        const fire = spell(G, K, 'seal', ['kindle']);
        if (!target || !fire) { bot.giveUp++; bot.q.push(T.wait(5)); return; }
        bot.q.push(T.go(-3, -6, 0.7, 'gallery corner'), T.face(-Math.PI / 2, -0.2));
        castAt(bot, fire, null);
        bot.q.push(T.act({ t: 'rest', until: target }));
        return;
    }
    bot.q.push(T.go(0, -3.6, 0.4, 'before her'), T.face(0, -0.1));
    castAt(bot, sp, null);
}

/** For main.js's attract mode and ?debug=1 autoplay. */
export function botInput(G, bot) { return botTick(G, bot); }
export { know as botKnowledge };
