// An auto-player. It plays through the same commands and input the player uses, so the tests, the balance table and
// the debug autoplay all exercise the real rules. Pure, like the rest of js/sim.
//
// makeBot({ skill, fav, romance, collect, seed }): skill in [0, 1] dulls its mini-games, battles and wandering;
// fav is the friend it spends its free time with (or 'spread' to rotate); romance picks the romantic answer at the
// last heart event; collect walks over to every charm, petal and marshmallow.

import { makeRng } from '../rng.js';
import { PLACES, CHARMS, PETALS, TREATS, FRIENDS, ITEMS, CAST, RESCUES, SHOP } from './data.js';
import { placeActions, nearPlace, SOLIDS } from './game.js';
import { heroAI } from './battle.js';
import { MINI, miniBot } from './minis.js';
import { heartEventReady, giftable } from './rules.js';

const NONE = { x: 0, y: 0, a: false, dir: null };

export function makeBot({ skill = 1, fav = 'lys', romance = true, collect = skill >= 0.8, seed = 7 } = {}) {
    const rng = makeRng((seed * 2654435761) >>> 0);
    return { skill, fav, romance, collect, rng, mb: miniBot(skill, rng), target: null, stuck: 0, last: null, side: 0, rot: 0, shopped: -1 };
}

const favOf = (G, bot) => {
    if (bot.fav !== 'spread') return bot.fav;
    return FRIENDS[(G.day * 2 + G.slot) % 4];
};

/** One decision for this step: { cmd } to send to act(), and/or { inp } for step(). */
export function botDecide(G, bot) {
    switch (G.mode) {
        case 'vn': {
            const V = G.vn;
            if (V?.choices) return { cmd: { t: 'choose', i: pickChoice(G, bot, V.choices) } };
            return { cmd: { t: 'next' } };
        }
        case 'mini': {
            const S = G.mini;
            if (S.result) return { cmd: { t: 'miniDone' } };
            bot.mb.dt = 1 / 120;
            const o = MINI[S.game].bot(S.M, bot.mb) || {};
            return { inp: { ...NONE, ...o } };
        }
        case 'battle': {
            const B = G.battle;
            if (B.phase === 'won') return { cmd: { t: 'battleDone' } };
            if (B.phase === 'lost') return { cmd: { t: B.optional ? 'leave' : 'retry' } };
            if (B.phase === 'cmd') return { cmd: heroAI(G, B, B.actors[B.cur], bot.skill, bot.rng) };
            return { inp: NONE };
        }
        case 'map': return mapDecide(G, bot);
        default: return { inp: NONE };
    }
}

function pickChoice(G, bot, choices) {
    const fav = favOf(G, bot);
    let best = 0, bs = -1e9;
    choices.forEach((c, i) => {
        let s = 0;
        for (const f of c.fx) {
            const m = f.match(/^(hana|lys|pip|ren)\+(\d+)$/);
            if (m) s += (m[1] === fav ? 10 : 1) * +m[2];
            if (f === `romance:${fav}`) s += bot.romance ? 100 : -100;
            if (f === `friend:${fav}`) s += bot.romance ? -100 : 100;
            if (f === `partner:${fav}`) s += 200;
        }
        if (bot.skill < 0.5) s += bot.rng() * 20;
        if (s > bs) { bs = s; best = i; }
    });
    return best;
}

// ------------------------------------------------------------------ the campus
function goal(G, bot) {
    const C = G.climax;
    if (C) {
        if (!C.late) {
            const open = RESCUES.filter((r) => !C.freed.includes(r.id));
            if (open.length) {
                const r = open.reduce((a, b) => (dist(G, PLACES[b.place]) < dist(G, PLACES[a.place]) ? b : a));
                return { place: r.place, act: 'rescue' };
            }
        }
        return { place: 'tower', act: 'undercroft' };
    }
    if (G.day === 1) {
        for (const [f, p] of [['lys', 'library'], ['pip', 'lab'], ['hana', 'arena']]) if (!G.flags['met' + f[0].toUpperCase() + f.slice(1)]) return { place: p, act: 'meet' };
        if (G.quests.meet === 2) return { place: 'dorm', act: 'sleep' };
    }
    // little errands that cost no time
    if (G.inv.librarybook) return { place: 'library', act: 'quest' };
    if (G.day >= 3 && !G.quests.petals) return { place: 'lab', act: 'quest' };
    if (G.quests.petals === 1 && (G.inv.moonpetal || 0) >= 5) return { place: 'lab', act: 'quest' };
    if (G.quests.treats === 1 && (G.inv.mochitreat || 0) >= 3) return { place: G.near || 'courtyard', act: 'quest' };
    if (G.charms.length >= 12 && G.quests.charms !== 2) return { place: G.near || 'courtyard', act: 'quest' };
    if (bot.collect) {
        const pts = [];
        for (const c of CHARMS) if (!G.charms.includes(c.id)) pts.push(c);
        if (G.day >= 3) for (const p of PETALS) if (!G.petals.includes(p.id)) pts.push(p);
        if (G.quests.treats === 1) for (const p of TREATS) if (!G.treats.includes(p.id)) pts.push(p);
        if (pts.length) {
            const p = pts.reduce((a, b) => (dist(G, b) < dist(G, a) ? b : a));
            return { point: p };
        }
    }
    const fav = favOf(G, bot);
    if (bot.shopped !== G.day && G.lumens >= 30 && !Object.keys(G.inv).some((i) => giftable(i) && CAST[fav].loves?.includes(i))) return { place: 'courtyard', act: 'shop' };
    if (G.slot >= 1 && G.slot <= 2) return { place: CAST[fav].home, act: 'friend' };
    return { place: 'dorm', act: 'sleep' };
}

const dist = (G, p) => Math.hypot(G.pos.x - p.x, G.pos.z - p.z);

function mapDecide(G, bot) {
    if (G.panel) return panelDecide(G, bot);
    const g = goal(G, bot);
    const tgt = g.point || PLACES[g.place];
    if (g.place && nearPlace(G) === g.place) return { cmd: { t: 'visit', place: g.place } };
    // steer, sliding round buildings; if stuck, sidestep for a moment
    let dx = tgt.x - G.pos.x, dz = tgt.z - G.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    for (const s of SOLIDS) {
        const ox = s.x - G.pos.x, oz = s.z - G.pos.z, od = Math.hypot(ox, oz);
        if (od < s.r + 3 && (ox * dx + oz * dz) > 0.3 * od) {
            const side = (ox * dz - oz * dx) > 0 ? 1 : -1;
            dx += -dz * side * 0.9; dz += dx * side * 0.9;
        }
    }
    if (bot.last) {
        const moved = Math.hypot(G.pos.x - bot.last.x, G.pos.z - bot.last.z);
        bot.stuck = moved < 0.004 ? bot.stuck + 1 : Math.max(0, bot.stuck - 2);
    }
    bot.last = { x: G.pos.x, z: G.pos.z };
    if (bot.stuck > 60) { bot.side = 90; bot.stuck = 0; bot.rot = bot.rng() < 0.5 ? 1 : -1; }
    if (bot.side > 0) { bot.side--; const t = dx; dx = -dz * bot.rot; dz = t * bot.rot; }
    const l = Math.hypot(dx, dz) || 1;
    return { inp: { x: dx / l, y: dz / l, a: false, dir: null } };
}

function panelDecide(G, bot) {
    const acts = placeActions(G, G.panel);
    const ok = (id) => acts.find((a) => a.id === id && a.ok);
    const g = goal(G, bot);
    let a;
    if ((a = ok('quest'))) return { cmd: { t: 'do', id: 'quest', q: a.q } };
    if ((a = ok('meet'))) return { cmd: { t: 'do', id: 'meet' } };
    if ((a = ok('rescue'))) return { cmd: { t: 'do', id: 'rescue' } };
    if ((a = ok('undercroft'))) return { cmd: { t: 'do', id: 'undercroft' } };
    if (G.panel === 'courtyard' && bot.shopped !== G.day && !G.climax) {
        const fav = favOf(G, bot);
        const love = SHOP.find((i) => CAST[fav].loves?.includes(i) && ITEMS[i].price <= G.lumens);
        if (love && !(G.inv[love] > 0)) return { cmd: { t: 'buy', item: love } };
        if ((G.inv.healing || 0) < 3 && G.lumens >= ITEMS.healing.price + 10) return { cmd: { t: 'buy', item: 'healing' } };
        bot.shopped = G.day;
        return { cmd: { t: 'close' } };
    }
    const giftA = acts.find((x) => x.id === 'gift' && x.ok);
    if (giftA) {
        const items = Object.keys(G.inv).filter(giftable);
        const loved = items.find((i) => CAST[giftA.who].loves?.includes(i)) || items.find((i) => CAST[giftA.who].likes?.includes(i));
        if (loved) return { cmd: { t: 'do', id: 'gift', who: giftA.who, item: loved } };
    }
    if (g.act === 'friend' || PLACES[G.panel].friend) {
        const talk = acts.find((x) => x.id === 'talk' && x.ok), play = acts.find((x) => x.id === 'play' && x.ok);
        if (talk && (talk.heart || !play || ((G.talks[talk.who] || 0) <= (G.stats.minis % 3)))) return { cmd: { t: 'do', id: 'talk', who: talk.who } };
        if (play) return { cmd: { t: 'do', id: 'play', who: play.who } };
    }
    if ((a = ok('sleep')) && g.act === 'sleep') return { cmd: { t: 'do', id: 'sleep' } };
    if ((a = ok('rest')) && G.climax) return { cmd: { t: 'close' } };
    return { cmd: { t: 'close' } };
}
