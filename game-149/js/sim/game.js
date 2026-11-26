// The simulation hub. Pure: no DOM, no rendering library, no Math.random, no clock.
//   newGame(seed, name) → G;  step(G, inp, dt, { hold });  act(G, cmd) → bool;  serialize / deserialize.
// The view reads G and drains G.events; the UI, the bot and the tests all go through act() and step().
//
// A day: the morning scene (with the class mini-game) → afternoon (free) → evening (free) → the night scene → sleep.
// Free time is spent by walking the campus and doing something at a place: talking with a friend (their next chat, or
// a heart event when one is ready), playing their mini-game, training, exploring the wood. Gifts, the shop, quest
// turn-ins and picking up charms cost no time. Day 11's night is the Festival, and then the Hollow Moon: a rescue
// against the clock across the island, and the final battle.

import { MAP, BOND, CLIMAX, START, SLOTS, BATTLE } from '../config.js';
import { makeRng } from '../rng.js';
import { PLACES, PLACE_IDS, CHARMS, PETALS, TREATS, SCHEDULE, FRIENDS, ITEMS, SHOP, CAST, RESCUES, MINIS } from './data.js';
import { startScene, runVN, vnNext, vnChoose, vnResume } from './vn.js';
import { startBattle, battleStep, battleAct, settleHeroes } from './battle.js';
import { MINI, grade } from './minis.js';
import { hearts, addBond, heartEventReady, giftValue, give, has, giftable, heroStats, healParty, best, addXp } from './rules.js';

export const SAVE_V = 1;

// ------------------------------------------------------------------ the island's solid bits
// Each building stands behind its door (pushed away from the island's centre); the fountain sits in the courtyard.
export const SOLIDS = (() => {
    const out = [{ x: 0, z: 8, r: 2.6 }];                                   // the fountain
    for (const id of PLACE_IDS) {
        const p = PLACES[id];
        if (id === 'courtyard' || id === 'gate' || id === 'forest') continue;
        const d = Math.hypot(p.x, p.z) || 1;
        out.push({ id, x: p.x + (p.x / d) * 6.5, z: p.z + (p.z / d) * 6.5, r: 4.2 });
    }
    return out;
})();

export function newGame(seed = 1, name = 'Kai') {
    const G = {
        v: SAVE_V, seed, rng: makeRng(seed), t: 0,
        name: (name || 'Kai').slice(0, 14),
        day: 1, slot: 0, mode: 'vn', vn: null, battle: null, mini: null, panel: null,
        pos: { x: 0, z: 33, face: Math.PI }, near: null,
        bonds: { hana: 0, lys: 0, pip: 0, ren: 0 }, heartSeen: {}, talks: {}, romance: {}, joined: {}, partyPick: [],
        captive: null, partner: null, giftDay: {},
        heroes: {},
        inv: { ...START.inv }, lumens: START.lumens,
        flags: {}, quests: {}, charms: [], petals: [], treats: [], grades: {}, cgSeen: {},
        music: 'title', chapter: 1, climax: null, ended: false, auto: false, festival: false,
        stats: { battles: 0, minis: 0, talks: 0, gifts: 0 }, retries: {},
        events: [],
    };
    for (const id of ['kai', ...FRIENDS, 'graves']) {
        const lv = id === 'graves' ? 6 : 1;
        const s = heroStats(id, lv);
        G.heroes[id] = { lv, xp: 0, hp: s.mhp, mp: s.mmp };
    }
    startScene(G, SCHEDULE[1].morning);
    runVN(G, HOOKS);
    return G;
}

// ------------------------------------------------------------------ scene hooks
const HOOKS = {
    battle(G, enc) { startBattle(G, enc); },
    mini(G, game, level, partner) { startMini(G, game, level, partner, 'vn'); },
    done(G, name) { sceneDone(G, name); },
    ending(G) { G.mode = 'end'; G.ended = true; G.music = 'title'; G.events.push({ type: 'ending' }); },
    climax(G) {
        G.climax = { time: CLIMAX.time, freed: [], late: false, inside: false };
        G.pos = { x: 0, z: 2, face: Math.PI };
        G.music = 'climax';
        G.panel = null;
        play(G, 'climax_intro');
    },
};

function play(G, name) {
    startScene(G, name);
    runVN(G, HOOKS);
}
/** Start a scene and run it to its first line (tests and the debug hooks). */
export const playScene = (G, name) => play(G, name);

function toMap(G) {
    G.mode = 'map';
    G.panel = null;
    G.music = G.climax ? 'climax' : G.festival ? 'academy' : (G.slot >= 2 ? 'mystery' : 'academy');
    if (G.day === 2 && !G.quests.treats && !G.climax) { play(G, 'q_treats_start'); return; }
    G.events.push({ type: 'map' });
}

function sceneDone(G, name) {
    const sch = SCHEDULE[G.day] || {};
    // the climax: each rescue frees its captive; the moon may already be up
    if (G.climax) {
        const r = RESCUES.find((q) => 'res_' + q.id === name);
        if (r && !G.climax.freed.includes(r.id)) { G.climax.freed.push(r.id); G.events.push({ type: 'freed', id: r.id }); }
        if (name === 'res_best') G.captive = null;          // back in the party
        return toMap(G);
    }
    if (name === sch.morning) {
        G.slot = 1;
        return toMap(G);
    }
    if (name === sch.night) return nextDay(G);
    if (name.startsWith('meet_') && name !== 'meet_done') {
        if (G.flags.metLys && G.flags.metPip && G.flags.metHana) return play(G, 'meet_done');
        return toMap(G);
    }
    if (G.spend) { G.spend = false; return advanceSlot(G); }
    return toMap(G);
}

function advanceSlot(G) {
    G.slot++;
    if (G.slot >= 3) return toNight(G);
    return toMap(G);
}

function toNight(G) {
    G.slot = 3;
    G.panel = null;
    const n = SCHEDULE[G.day]?.night;
    if (n) return play(G, n);
    return nextDay(G);
}

function nextDay(G) {
    G.day++;
    G.slot = 0;
    G.giftDay = {};
    G.festival = G.day === 11;
    healParty(G);
    G.pos = { x: -22, z: 26, face: Math.PI };          // waking up at the dorm
    G.events.push({ type: 'day', day: G.day });
    const m = SCHEDULE[G.day]?.morning;
    if (m) return play(G, m);
    G.slot = 1;
    return toMap(G);
}

// ------------------------------------------------------------------ mini-games
export function startMini(G, game, level, partner = null, from = 'free') {
    const M = MINI[game].init(G.rng, level);
    G.mini = { game, level, partner, from, M, result: null };
    G.mode = 'mini';
    G.events.push({ type: 'miniStart', game, level, partner });
}

function miniStep(G, inp, dt) {
    const S = G.mini;
    if (!S || S.result) return;
    MINI[S.game].step(S.M, inp, dt, G.rng);
    if (S.M.ev.length) { for (const e of S.M.ev) G.events.push({ type: 'mini', game: S.game, e }); S.M.ev.length = 0; }
    if (S.M.done) {
        const gi = grade(S.M);
        const lumens = [6, 12, 20, 30][gi] * (G.festival ? 2 : 1);
        S.result = { grade: gi, score: S.M.score, lumens };
        G.lumens += lumens;
        G.grades[S.game] = Math.max(G.grades[S.game] ?? -1, gi);
        G.stats.minis++;
        if (S.partner && FRIENDS.includes(S.partner)) addBond(G, S.partner, BOND.play[gi]);
        for (const id of ['kai', ...FRIENDS]) if (id === 'kai' || G.joined[id]) addXp(G, id, BATTLE.miniXp[gi]);
        if (G.festival && gi >= 2) give(G, ['tart', 'chime', 'phoenix'][gi - 2] || 'tart');
        G.events.push({ type: 'miniDone', game: S.game, grade: gi, score: S.M.score, lumens });
    }
}

/** The player closed the results card. */
function miniDone(G) {
    const S = G.mini;
    if (!S?.result) return false;
    G.mini = null;
    if (S.from === 'vn') { vnResume(G, HOOKS); return true; }
    advanceSlot(G);
    return true;
}

// ------------------------------------------------------------------ battles
function battleDone(G) {
    const B = G.battle;
    if (!B || (B.phase !== 'won' && B.phase !== 'lost')) return false;
    if (B.phase === 'lost') return false;                 // retry or leave
    settleHeroes(G, B);
    G.stats.battles++;
    G.battle = null;
    if (G.vn?.wait?.kind === 'battle') { vnResume(G, HOOKS); return true; }
    if (B.enc === 'explore' && G.rng() < 0.5) give(G, G.rng.pick(['healing', 'mana', 'honeybun', 'chestnuts']));
    advanceSlot(G);
    return true;
}

function battleRetry(G) {
    const B = G.battle;
    if (!B || B.phase !== 'lost') return false;
    healParty(G);
    G.retries[B.enc] = (G.retries[B.enc] || 0) + 1;
    G.events.push({ type: 'retry', enc: B.enc });
    startBattle(G, B.enc);
    return true;
}

function battleLeave(G) {
    const B = G.battle;
    if (!B || B.phase !== 'lost' || !B.optional) return false;
    G.battle = null;
    healParty(G);
    advanceSlot(G);
    return true;
}

// ------------------------------------------------------------------ the campus
export function nearPlace(G) {
    for (const id of PLACE_IDS) {
        const p = PLACES[id];
        if (Math.hypot(G.pos.x - p.x, G.pos.z - p.z) < p.r) return id;
    }
    return null;
}

/** What can be done at a place right now: [{ id, label, time (costs the slot), ok, why }]. */
export function placeActions(G, place) {
    const P = PLACES[place];
    const out = [];
    const free = G.mode === 'map' && G.slot >= 1 && G.slot <= 2 && !G.climax;
    if (G.climax) {
        const r = RESCUES.find((q) => q.place === place);
        if (r) {
            const done = G.climax.freed.includes(r.id);
            out.push({ id: 'rescue', label: done ? 'Freed!' : G.climax.late ? 'The cage is sealed' : 'Break the cage', ok: !done && !G.climax.late });
        }
        if (place === 'tower') {
            const ready = G.climax.freed.length >= 4 || G.climax.late;
            out.push({ id: 'undercroft', label: 'Storm the Undercroft', ok: ready, why: ready ? '' : `Free everyone first (${G.climax.freed.length}/4), or wait for the moon` });
        }
        if (place === 'dorm') out.push({ id: 'rest', label: 'Catch your breath (heal)', ok: true });
        return out;
    }
    if (G.day === 1 && P.friend && !metFlag(G, P.friend) && P.friend !== 'ren') {
        out.push({ id: 'meet', label: `Look around the ${P.name}`, ok: true });
        return out;
    }
    if (P.friend) {
        const f = P.friend;
        const ready = heartEventReady(G, f);
        out.push({ id: 'talk', who: f, label: ready ? `♥ Spend time with ${CAST[f].name}` : `Hang out with ${CAST[f].name}`, time: true, ok: free, heart: !!ready });
        const lv = G.day >= 7 ? 2 : 1;
        out.push({ id: 'play', who: f, label: `${MINIS[CAST[f].mini].name} with ${CAST[f].name}${G.festival ? ' (festival prizes!)' : ''}`, time: true, ok: free, game: CAST[f].mini, level: lv });
        out.push({ id: 'gift', who: f, label: `Give ${CAST[f].name} a gift`, ok: !G.giftDay[f] && Object.keys(G.inv).some(giftable), why: G.giftDay[f] ? 'Already gave a gift today' : 'Nothing to give' });
    }
    if (place === 'library' && has(G, 'librarybook')) out.push({ id: 'quest', q: 'q_book_done', label: 'Return Theo\'s library book', ok: true });
    if (place === 'lab' && G.day >= 3 && !G.quests.petals) out.push({ id: 'quest', q: 'q_petals_start', label: 'Ask Pip what she\'s working on', ok: true });
    if (place === 'lab' && G.quests.petals === 1 && has(G, 'moonpetal', 5)) out.push({ id: 'quest', q: 'q_petals_done', label: 'Give Pip five moonpetals', ok: true });
    if (G.quests.treats === 1 && has(G, 'mochitreat', 3)) out.push({ id: 'quest', q: 'q_treats_done', label: 'Feed Mochi the marshmallows', ok: true });
    if (G.charms.length >= CHARMS.length && G.quests.charms !== 2) out.push({ id: 'quest', q: 'q_charms_done', label: 'Listen to the Echo Charms', ok: true });
    if (P.shop) out.push({ id: 'shop', label: 'Academy Store', ok: true });
    if (P.train) out.push({ id: 'train', label: 'Practice battle', time: true, ok: free });
    if (P.explore) out.push({ id: 'explore', label: 'Explore the Whispering Wood (battle)', time: true, ok: free && !!G.joined.ren, why: G.joined.ren ? '' : 'Too spooky to go alone' });
    if (place === 'hall') out.push({ id: 'practice', label: 'Practise Resonance', time: true, ok: free, game: 'echo', level: G.day >= 7 ? 2 : 1 });
    if (P.sleep) {
        out.push({ id: 'party', label: 'Choose your party', ok: Object.keys(G.joined).length > 2 });
        out.push({ id: 'sleep', label: G.slot >= 2 ? 'Turn in for the night' : 'Sleep until night', ok: G.slot >= 1 && G.slot <= 2 && (G.day > 1 || G.quests.meet === 2), why: G.day === 1 && G.quests.meet !== 2 ? 'Meet your classmates first' : '' });
    }
    return out;
}

const metFlag = (G, f) => !!G.flags['met' + f[0].toUpperCase() + f.slice(1)];

/**
 * Where the campus guide arrow points: the place the story wants Kai at next, or null when there's nothing to point at.
 * The climax: the nearest student still caged, then the Principal's Tower. Day 1: the nearest classmate not yet met,
 * then the Dormitory. Free time: a quest turn-in, then a friend with a heart event waiting, then the friend Kai is
 * closest to.
 */
export function guidePlace(G) {
    if (G.mode !== 'map' || G.ended) return null;
    const nearest = (ids) => {
        let b = null, bd = Infinity;
        for (const id of ids) { const d = Math.hypot(PLACES[id].x - G.pos.x, PLACES[id].z - G.pos.z); if (d < bd) { bd = d; b = id; } }
        return b;
    };
    const C = G.climax;
    if (C) {
        if (C.late) return 'tower';
        const left = RESCUES.filter((r) => !C.freed.includes(r.id)).map((r) => r.place);
        return left.length ? nearest(left) : 'tower';
    }
    if (G.slot < 1 || G.slot > 2) return null;
    if (G.day === 1) {
        if (G.quests.meet === 2) return 'dorm';
        const unmet = FRIENDS.filter((f) => f !== 'ren' && !metFlag(G, f)).map((f) => CAST[f].home);
        return unmet.length ? nearest(unmet) : 'dorm';
    }
    if (has(G, 'librarybook')) return 'library';
    if (G.quests.petals === 1 && has(G, 'moonpetal', 5)) return 'lab';
    if (G.day >= 3 && !G.quests.petals) return 'lab';
    const ready = FRIENDS.filter((f) => heartEventReady(G, f));
    if (ready.length) return CAST[ready.reduce((a, f) => ((G.bonds[f] || 0) > (G.bonds[a] || 0) ? f : a))].home;
    return CAST[best(G)].home;
}

function doAction(G, cmd) {
    const place = G.panel;
    if (!place) return false;
    const a = placeActions(G, place).find((x) => x.id === cmd.id && (!cmd.who || x.who === cmd.who) && (!cmd.q || x.q === cmd.q));
    if (!a || !a.ok) return false;
    switch (a.id) {
        case 'meet': G.panel = null; play(G, 'meet_' + PLACES[place].friend); return true;
        case 'talk': {
            const f = a.who;
            G.panel = null; G.spend = true; G.stats.talks++;
            const ev = heartEventReady(G, f);
            if (ev) { G.heartSeen[f] = ev; play(G, `heart_${f}_${ev}`); return true; }
            addBond(G, f, BOND.talk);
            const n = Math.min(5, (G.talks[f] || 0) + 1);
            G.talks[f] = n;
            play(G, `talk_${f}_${n}`);
            return true;
        }
        case 'play': G.panel = null; startMini(G, a.game, a.level, a.who, 'free'); return true;
        case 'practice': G.panel = null; startMini(G, a.game, a.level, null, 'free'); return true;
        case 'gift': {
            const item = cmd.item;
            if (!item || !has(G, item) || !giftable(item)) return false;
            const v = giftValue(a.who, item);
            give(G, item, -1);
            G.giftDay[a.who] = true;
            G.stats.gifts++;
            addBond(G, a.who, BOND.gift[v]);
            G.events.push({ type: 'gift', who: a.who, item, value: v });
            return true;
        }
        case 'quest': G.panel = null; play(G, a.q); return true;
        case 'shop': return false;                       // the shop is buy/sell commands, not one action
        case 'train': G.panel = null; startBattle(G, 'training'); return true;
        case 'explore': G.panel = null; startBattle(G, 'explore'); return true;
        case 'sleep': G.panel = null; toNight(G); return true;
        case 'rest': healParty(G); G.events.push({ type: 'rest' }); return true;
        case 'party': return false;                      // the party is the 'party' command
        case 'rescue': {
            const r = RESCUES.find((q) => q.place === place);
            G.panel = null;
            G.climax.time -= CLIMAX.battleCost;
            play(G, 'res_' + r.id);
            return true;
        }
        case 'undercroft': G.panel = null; G.climax.inside = true; play(G, 'undercroft'); return true;
        default: return false;
    }
}

function buy(G, item) {
    if (G.panel !== 'courtyard' || !SHOP.includes(item)) return false;
    const price = ITEMS[item].price;
    if (G.lumens < price) return false;
    G.lumens -= price;
    give(G, item, 1);
    G.events.push({ type: 'buy', item, price });
    return true;
}

function setParty(G, pick) {
    if (!Array.isArray(pick)) return false;
    G.partyPick = pick.filter((f) => FRIENDS.includes(f) && G.joined[f]).slice(0, 2);
    G.events.push({ type: 'party' });
    return true;
}

// ------------------------------------------------------------------ the overmap
function mapStep(G, inp, dt) {
    if (G.panel) return;
    const len = Math.hypot(inp.x, inp.y);
    if (len > 0.05) {
        const k = Math.min(1, len) / len;
        let nx = G.pos.x + inp.x * k * MAP.speed * dt, nz = G.pos.z + inp.y * k * MAP.speed * dt;
        for (const s of SOLIDS) {
            const dx = nx - s.x, dz = nz - s.z, d = Math.hypot(dx, dz);
            if (d < s.r + 0.5) { const p = (s.r + 0.5) / (d || 1); nx = s.x + dx * p; nz = s.z + dz * p; }
        }
        // the island's edge (the bridge sticks out south of it)
        const d = Math.hypot(nx, nz), lim = MAP.radius - 1;
        if (d > lim && !(Math.abs(nx) < 3 && nz > 0 && nz < 44)) { nx *= lim / d; nz *= lim / d; }
        if (nz > 43) nz = 43;
        G.pos.x = nx; G.pos.z = nz;
        G.pos.face = Math.atan2(inp.x, inp.y);
        G.pos.moving = true;
    } else G.pos.moving = false;
    G.near = nearPlace(G);
    // pick things up
    for (const c of CHARMS) {
        if (!G.charms.includes(c.id) && Math.hypot(G.pos.x - c.x, G.pos.z - c.z) < MAP.charmR) {
            G.charms.push(c.id);
            G.events.push({ type: 'charm', id: c.id, n: G.charms.length, text: c.text });
            if (G.charms.length === 12 && !G.quests.charms) G.quests.charms = 1;
        }
    }
    if (G.day >= 3) for (const p of PETALS) {
        if (!G.petals.includes(p.id) && Math.hypot(G.pos.x - p.x, G.pos.z - p.z) < MAP.charmR) {
            G.petals.push(p.id); give(G, 'moonpetal', 1);
            G.events.push({ type: 'petal', id: p.id });
        }
    }
    if (G.quests.treats === 1) for (const p of TREATS) {
        if (!G.treats.includes(p.id) && Math.hypot(G.pos.x - p.x, G.pos.z - p.z) < MAP.charmR) {
            G.treats.push(p.id); give(G, 'mochitreat', 1);
            G.events.push({ type: 'treat', id: p.id });
        }
    }
    // the Hollow Moon climbs while you move
    const C = G.climax;
    if (C && !C.late && !C.inside) {
        C.time -= dt;
        if (C.time <= 0) { C.time = 0; C.late = true; G.events.push({ type: 'moonrise' }); play(G, 'moonrise'); }
    }
}

// ------------------------------------------------------------------ step and act
/** Advance one fixed step. inp = { x, y, a, dir } (held stick, action press, direction press). hold: the view is animating. */
export function step(G, inp, dt, { hold = false } = {}) {
    G.t += dt;
    if (G.mode === 'map') mapStep(G, inp, dt);
    else if (G.mode === 'battle') battleStep(G, dt, hold);
    else if (G.mode === 'mini') miniStep(G, inp, dt);
}

export function act(G, cmd) {
    if (!cmd || !cmd.t) return false;
    switch (cmd.t) {
        case 'next': return G.mode === 'vn' && vnNext(G, HOOKS);
        case 'choose': return G.mode === 'vn' && vnChoose(G, cmd.i, HOOKS);
        case 'visit': {
            if (G.mode !== 'map' || G.panel) return false;
            const id = cmd.place || G.near;
            if (!id || nearPlace(G) !== id) return false;
            G.panel = id;
            G.events.push({ type: 'panel', place: id });
            return true;
        }
        case 'close': if (!G.panel) return false; G.panel = null; return true;
        case 'do': return G.mode === 'map' && doAction(G, cmd);
        case 'buy': return buy(G, cmd.item);
        case 'party': return setParty(G, cmd.pick);
        case 'miniDone': return G.mode === 'mini' && miniDone(G);
        case 'battleDone': return G.mode === 'battle' && battleDone(G);
        case 'retry': return G.mode === 'battle' && battleRetry(G);
        case 'leave': return G.mode === 'battle' && battleLeave(G);
        case 'attack': case 'skill': case 'item': case 'defend': case 'auto':
            return G.mode === 'battle' && battleAct(G, cmd);
        default: return false;
    }
}

// ------------------------------------------------------------------ queries the UI and the bot use
export const timeLabel = (G) => (G.climax ? 'The Hollow Moon' : SLOTS[G.slot]);
export { hearts, best, heartEventReady };

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
