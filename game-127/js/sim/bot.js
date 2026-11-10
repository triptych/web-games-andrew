// The auto-player. It plays through act() like a person would: one "route" per career ending, a plan built
// from what that ending still needs, rest when Stress climbs, work when gold runs low, a friend to court, and
// story choices scored by their effects. Used by the tests, the balance table and the attract mode. Pure.

import { ACT } from './data/activities.js';
import { ITEM, ITEMS } from './data/items.js';
import { QUEST } from './data/quests.js';
import { REGION, APPROACH } from './data/adventures.js';
import { ENDING } from './data/endings.js';
import { CAST, FRIENDS } from './data/cast.js';
import { CONTEST } from './data/events.js';
import { act, canDo, heartReady, advStep, advChance, contestOpen, placeOpen } from './game.js';
import { questChance, STAT_NAMES } from './rules.js';
import { makeRng } from '../rng.js';

// Each route: the ending it aims for, lessons and jobs it likes, a friend to court, a festival contest, a
// Free Day extra, the regions it explores, and what it values in story choices (stat weights).
export const ROUTES = {
    king: { ending: 'king', lessons: ['etiquette', 'rhetoric', 'theology', 'music', 'sword'], jobs: ['courier', 'tavern', 'stall'], friend: 'isolde', contest: 'ball', extra: 'petition', values: { fav: 3, grc: 2, elo: 2, cha: 2, mor: 2, fame: 2, bond: 1 } },
    crown: { ending: 'crown', lessons: ['etiquette', 'rhetoric', 'theology'], jobs: ['courier', 'tavern'], friend: null, contest: 'ball', extra: 'petition', values: { fav: 3, grc: 2, elo: 2, mor: 2, fame: 1 } },
    archmage: { ending: 'archmage', lessons: ['arcane', 'library'], jobs: ['clerk', 'bakery'], friend: 'theo', contest: 'arcane', values: { mag: 3, int: 2 } },
    diplomat: { ending: 'diplomat', lessons: ['rhetoric', 'etiquette', 'theology'], jobs: ['tavern', 'stall'], friend: 'saffi', contest: 'debate', values: { elo: 3, grc: 2, cha: 2, mor: 2 } },
    warrior: { ending: 'warrior', lessons: ['sword', 'strategy', 'theology'], jobs: ['farm', 'docks', 'watch'], friend: 'rowan', contest: 'tourney', values: { cmb: 3, str: 2, vit: 2, mor: 1 } },
    merchant: { ending: 'merchant', lessons: ['commerce'], jobs: ['stall', 'docks', 'cards', 'smithy'], friend: 'saffi', contest: 'debate', values: { com: 3, cun: 2, gold: 0.02 } },
    entertainer: { ending: 'entertainer', lessons: ['music', 'etiquette'], jobs: ['stage', 'tavern', 'bakery'], friend: 'saffi', contest: 'arts', values: { art: 3, cha: 2 } },
    overlord: { ending: 'overlord', lessons: ['dragonlore', 'flight', 'sword', 'shadow'], jobs: ['cards', 'smithy', 'docks'], friend: 'lumi', contest: 'tourney', regions: [], advRate: 0, talk: 'mother', values: { drc: 3, str: 2, fame: 1, mor: -3 } },
    assassin: { ending: 'assassin', lessons: ['shadow', 'sword'], jobs: ['watch', 'cards', 'hunting'], friend: 'pip', contest: 'tourney', values: { cun: 3, cmb: 2, mor: -1 } },
    priest: { ending: 'priest', lessons: ['theology'], jobs: ['chores', 'farm'], friend: 'rowan', contest: 'arts', extra: 'pray', values: { fth: 3, mor: 3 } },
    scholar: { ending: 'scholar', lessons: ['library', 'rhetoric'], jobs: ['clerk'], friend: 'theo', contest: 'debate', values: { int: 3, elo: 1 } },
    dragonlord: { ending: 'dragonlord', lessons: ['dragonlore', 'flight', 'theology'], jobs: ['farm', 'smithy'], friend: 'lumi', contest: 'tourney', regions: ['peaks'], values: { drc: 3, mor: 2, vit: 2 } },
    adventurer: { ending: 'adventurer', lessons: ['sword', 'arcane'], jobs: ['hunting', 'docks'], friend: 'rowan', contest: 'tourney', regions: ['whisperwood', 'ruins', 'hills', 'wastes', 'peaks', 'shadowmere'], advRate: 1, values: { fame: 3, cmb: 2, str: 1 } },
    ranger: { ending: 'ranger', lessons: ['theology'], jobs: ['hunting', 'farm'], friend: 'rowan', contest: 'tourney', regions: ['whisperwood', 'hills'], advRate: 0.3, talk: 'praise', values: { vit: 2, str: 2, cun: 2, mor: 2 } },
    smith: { ending: 'smith', lessons: ['music'], jobs: ['smithy', 'farm'], friend: 'rowan', contest: 'tourney', values: { str: 3, art: 2 } },
    quiet: { ending: 'quiet', lessons: [], jobs: ['farm', 'bakery'], friend: null, contest: null, lazy: true, values: { bond: 1 } },
};

export function makeBot({ route = 'archmage', skill = 1, seed = 7 } = {}) {
    return { route, skill, rng: makeRng(seed), day: { turn: -1 } };
}

/** How much a stat still matters to the route's ending (0 when the requirement is met). */
function need(G, R, k) {
    const E = ENDING[R.ending];
    const req = E.req?.[k];
    if (req == null) return 0;
    const v = k === 'gold' ? G.gold / 40 : G.stats[k];
    const goal = k === 'gold' ? req / 40 : req + 6;
    return Math.max(0, goal - v);
}

/** Score an activity for the route: the gains it gives to stats the ending still needs. */
function scoreAct(G, R, id) {
    const A = ACT[id];
    if (!A?.fx) return 0;
    const E = ENDING[R.ending];
    let s = 0;
    for (const k in A.fx) {
        const n = need(G, R, k);
        if (A.fx[k] > 0) s += A.fx[k] * (n > 0 ? 1 + n / 20 : 0.1);
        else if (E.min?.[k] != null && G.stats[k] + A.fx[k] < E.min[k] + 4) s += A.fx[k] * 3;
        else if (E.req?.[k] != null) s += A.fx[k] * 0.8;
        if (E.max?.[k] != null && A.fx[k] > 0 && G.stats[k] > E.max[k] - 10) s -= A.fx[k] * 4;
    }
    if (E.max?.mor != null && A.fx.mor < 0) s += -A.fx.mor * 1.5;   // dark routes like losing Morality
    if (E.count?.[id] && (G.count[id] || 0) < E.count[id]) s += 3;
    return s;
}

function choosePlan(G, bot) {
    const R = ROUTES[bot.route];
    const rnd = bot.rng;                   // the bot has its own stream, so it never shifts the game's
    const slots = [];
    let sts = G.stats.sts;
    let gold = G.gold;
    const add = (id) => { slots.push(id); const A = ACT[id]; if (A) { sts += A.sts || 0; gold -= A.cost || 0; } };
    // accepted quests first, if they look winnable
    for (const q of G.quests) if (slots.length < 2 && questChance(G, QUEST[q]) > 0.45) add('quest:' + q);
    while (slots.length < 3) {
        if (bot.skill < 1 && rnd() > bot.skill) {
            const all = Object.keys(ACT).filter((id) => canDo(G, id) && (ACT[id].cost || 0) <= gold);
            add(all[Math.floor(rnd() * all.length)] || 'rest');
            continue;
        }
        if (sts >= 52 || (R.lazy && rnd() < 0.5)) {
            if (canDo(G, 'holiday') && gold >= ACT.holiday.cost + 60 && !slots.includes('holiday')) add('holiday');
            else add(rnd() < 0.5 && gold > 40 ? 'play' : 'rest');
            sts -= 20;
            continue;
        }
        if (R.regions && rnd() < (R.advRate || 0.25) && slots.every((s) => !s.startsWith('adv:'))) {
            const regs = R.regions.filter((r) => canDo(G, 'adv:' + r));
            if (regs.length) { slots.push('adv:' + regs[regs.length - 1 - Math.floor(rnd() * Math.min(2, regs.length))]); sts += 9; continue; }
        }
        const lessons = R.lessons.filter((id) => canDo(G, id) && (ACT[id].cost || 0) <= gold - 20);
        const jobs = R.jobs.filter((id) => canDo(G, id));
        const broke = gold < 160;
        const pool = broke || !lessons.length ? (jobs.length ? jobs : ['farm']) : [...lessons, ...jobs];
        const jobBonus = gold < 300 ? 1.5 : gold < 600 ? 0.4 : 0;
        const best = pool.map((id) => [id, scoreAct(G, R, id) + (ACT[id].kind === 'job' ? jobBonus : 0) + rnd() * 0.4 - (slots.includes(id) ? 0.3 : 0)]).sort((a, b) => b[1] - a[1])[0][0];
        add(best);
    }
    return slots;
}

/** One command for the current state. */
export function botCommand(G, bot) {
    const R = ROUTES[bot.route];
    const rnd = bot.rng;
    if (G.scene) {
        const c = G.scene.cur;
        if (!c) return { t: 'advance' };
        if (!c.choice) return { t: 'advance' };
        return { t: 'choose', i: pickChoice(G, bot, c.choice) };
    }
    switch (G.phase) {
        case 'free': return freeDay(G, bot, R);
        case 'plan': return { t: 'plan', slots: choosePlan(G, bot) };
        case 'run': return { t: 'next' };
        case 'adventure': {
            const step = advStep(G);
            const avoidFire = ENDING[R.ending].max?.drc != null;      // a route with a Draconity ceiling keeps the dragon in
            const opts = step.opts.filter((a) => !(avoidFire && a === 'dragon'));
            const best = (opts.length ? opts : step.opts).map((a) => [a, advChance(G, a)]).sort((a, b) => b[1] - a[1])[0];
            if (best[1] < 0.2 && bot.skill >= 1) return { t: 'retreat' };
            return { t: 'approach', a: bot.skill < 1 && rnd() > bot.skill ? step.opts[0] : best[0] };
        }
        case 'festival': {
            let id = R.contest && contestOpen(G, R.contest) ? R.contest : null;
            if (!id) {
                const scored = Object.values(CONTEST).filter((C) => contestOpen(G, C.id)).map((C) => [C.id, Object.entries(C.stats).reduce((a, [k, w]) => a + G.stats[k] * w, 0)]);
                id = scored.sort((a, b) => b[1] - a[1])[0][0];
            }
            return { t: 'contest', id };
        }
        case 'starfall': {
            const want = G.partner || (R.friend && G.aff[R.friend] >= 20 ? R.friend : null);
            const who = want || FRIENDS.filter((f) => G.flags['met_' + f] && G.aff[f] >= 20).sort((a, b) => G.aff[b] - G.aff[a])[0] || null;
            return { t: 'starfall', who };
        }
        default: return null;
    }
}

function freeDay(G, bot, R) {
    if (bot.day.turn !== G.turn) bot.day = { turn: G.turn };
    const day = bot.day;
    const f = R.friend && G.flags['met_' + R.friend] && placeOpen(G, CAST[R.friend].place) ? R.friend : null;
    // buy the friend's favourite gift when there's money to spare
    if (f && !G.done['visit:' + f]) {
        const love = CAST[f].loves.find((i) => G.inv[i]) || CAST[f].likes.find((i) => G.inv[i]);
        if (!love) {
            const buy = [...CAST[f].loves, ...CAST[f].likes].find((i) => ITEM[i].price <= G.gold - 250);
            if (buy && !day.bought) { day.bought = true; return { t: 'buy', item: buy }; }
        }
        if (G.ap > 0) return { t: 'visit', who: f, gift: love || undefined };
    }
    // a keepsake for the route's lessons
    if (!day.keep) {
        day.keep = true;
        const k = ITEMS.find((i) => i.kind === 'keepsake' && !G.keep[i.id] && (!i.minAge || G.age >= i.minAge) && i.boosts.some((b) => R.lessons.includes(b) || R.jobs.includes(b)) && G.gold >= i.price + 400);
        if (k) return { t: 'buy', item: k.id };
    }
    // quests that suit the prince
    if (!day.board) {
        day.board = true;
        const fits = (q) => Object.entries(q.reward).reduce((a, [k, v]) => a + (typeof v === 'number' ? (R.values[k] ?? (k === 'gold' ? 0.003 : 0.1)) * v : 0), 0) > 0;
        const q = G.board.map((id) => QUEST[id]).filter((q) => questChance(G, q) > 0.6 && fits(q)).sort((a, b) => questChance(G, b) - questChance(G, a))[0];
        if (q && G.quests.length < 2 && !R.lazy) return { t: 'accept', quest: q.id };
    }
    if (G.ap > 0 && !G.done.talk) return { t: 'talk', topic: G.stats.sts >= 40 ? 'praise' : R.talk || (G.stats.bond < 50 ? 'feel' : R.values.drc > 0 ? 'mother' : 'feel') };
    if (G.ap > 0 && R.extra === 'petition' && G.age >= 12 && !G.done['castle:petition']) return { t: 'do', place: 'castle', action: 'petition' };
    if (G.ap > 0 && R.extra === 'pray' && !G.done['temple:pray']) return { t: 'do', place: 'temple', action: 'pray' };
    if (G.ap > 0 && R.values.mor > 0 && G.gold > 900 && !G.done['temple:donate']) return { t: 'do', place: 'temple', action: 'donate' };
    // otherwise keep friendships warm
    if (G.ap > 0) {
        const other = FRIENDS.filter((x) => G.flags['met_' + x] && !G.done['visit:' + x] && placeOpen(G, CAST[x].place) && (!G.partner || x === G.partner || heartReady(G, x) == null))
            .sort((a, b) => G.aff[b] - G.aff[a])[0];
        if (other && (R.friend == null || G.aff[other] < 60)) return { t: 'visit', who: other };
    }
    if (G.ap > 0 && G.stats.sts > 30 && !G.done['manor:nap']) return { t: 'do', place: 'manor', action: 'nap' };
    return { t: 'endFree' };
}

/** Score each option of a choice by its effects against the route's values; take the best. */
function pickChoice(G, bot, opts) {
    const R = ROUTES[bot.route];
    if (bot.skill < 1 && bot.rng() > bot.skill) return opts[Math.floor(bot.rng() * opts.length)].i;
    let best = opts[0], bs = -Infinity;
    for (const o of opts) {
        let s = 0;
        if (o.fx) for (const tok of o.fx.split(/\s+/)) {
            const p = tok.match(/^partner:(\w+)$/);
            if (p) { s += p[1] === (R.friend || G.partner) ? 100 : -50; continue; }
            const m = tok.match(/^([a-z.]+)([+-])([\d.]+)$/);
            if (!m) continue;
            const d = (m[2] === '-' ? -1 : 1) * +m[3];
            const k = m[1];
            if (k.startsWith('aff.')) s += k.slice(4) === R.friend ? d * 1.5 : d * 0.2;
            else if (k === 'sts') s -= d * 0.2;
            else s += d * (R.values[k] ?? 0.3);
        }
        // a check named in the option text: "(Eloquence)" etc. — prefer the strongest stat
        const named = o.t.match(/\((\w+)\)/);
        if (named) {
            const key = Object.keys(STAT_NAMES).find((k) => STAT_NAMES[k] === named[1]);
            if (key && key in G.stats) s += G.stats[key] * 0.5 + (R.values[key] || 0) * 3;
        }
        if (s > bs) { bs = s; best = o; }
    }
    return best.i;
}

/** Play a whole game with the bot. Returns the finished G. */
export function playThrough(G, bot, maxSteps = 60000) {
    let n = 0;
    while (!G.over && n++ < maxSteps) {
        const cmd = botCommand(G, bot);
        if (!cmd || !act(G, cmd)) {
            // a refused command should never happen; fall back to the safest move so the run can be inspected
            if (G.phase === 'free') act(G, { t: 'endFree' });
            else if (G.phase === 'plan') act(G, { t: 'plan', slots: ['rest', 'rest', 'rest'] });
            else throw new Error(`bot stuck in ${G.phase}: ${JSON.stringify(cmd)}`);
        }
        G.events.length = 0;
    }
    return G;
}
