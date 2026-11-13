// Lanternhall — the simulation. Pure: no DOM, no Math.random, no clock, no storage. Everything the player
// can do is a command to act(); the only thing that runs on time is step(G, dt) (the tavern till and the
// Stamp Rush sand-glass), and that time is handed in. The UI reads G and drains G.events.

import {
    DAYS, AP_PER_DAY, RANKS, RANK_POW, QUEST_DIFF, XP_QUEST, MERIT, REVIEW_DAYS, START, UPKEEP, DEBT, FAC, TILL,
    VISIT_AFF, HEARTS, RAID, JOBS,
} from '../config.js';
import { makeRng } from '../rng.js';
import { beginScene, advance, choose } from './scene.js';
import { applyFx, evalCond, bump, bumpAff, addXp, chooseEnding } from './rules.js';
import { startMg, mgAct, mgTick } from './minigames.js';
import { makePetition, feeFor } from './petition.js';
import { sceneDef, STORY } from './scenes.js';
import { ROSTER, ROSTER_BY_ID } from './data/adventurers.js';
import { CAST, ROMANCE } from './data/cast.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const chapterOf = (day) => Math.min(4, Math.floor((day - 1) / 6));
export const advName = (id) => ROSTER_BY_ID[id].name;

export function newGame(seed = 1, profile = {}) {
    const G = {
        v: 1, seed, rng: makeRng(seed),
        name: String(profile.name || 'Robin').slice(0, 16), gender: ['f', 'm', 'n'].includes(profile.gender) ? profile.gender : 'n',
        day: 1, phase: 'desk', ap: AP_PER_DAY,
        rank: 0, merit: 0, gold: START.gold, renown: START.renown, integ: START.integ, trust: { ...START.trust },
        aff: Object.fromEntries(ROMANCE.map((id) => [id, 0])), hearts: Object.fromEntries(ROMANCE.map((id) => [id, 0])),
        partner: null, flags: {}, count: {}, seen: {},
        advs: ROSTER.map((a) => ({ id: a.id, rank: a.rank, xp: 0, state: 'ready', until: 0 })),
        queue: [], pet: null, board: [], out: [], reports: [],
        fac: { board: 0, tavern: 0, infirm: 0, yard: 0, vault: 0 }, till: 0, tillDay: 0, potions: 1, charts: 0, nid: 1,
        mg: null, scene: null, sq: [], ending: null, over: false,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    startDay(G);
    return G;
}

// ------------------------------------------------------------------ scenes
/** The script of the scene on stage (a written one, or one made up on the spot such as small talk). */
export function sceneLines(G) {
    return G.scene ? (G.scene.gen || sceneDef(G.scene.id).lines) : null;
}

function startNext(G) {
    while (!G.scene && G.sq.length) {
        const next = G.sq.shift();
        const meta = typeof next === 'string' ? { id: next, title: sceneDef(next).title, kind: sceneDef(next).kind } : next.meta;
        const lines = typeof next === 'string' ? sceneDef(next).lines : next.gen;
        const live = beginScene(G, meta, lines);
        if (typeof next !== 'string') G.scene.gen = next.gen;
        if (!live) sceneOver(G);
    }
    if (!G.scene && G.ending && !G.over) {
        G.over = true;
        G.events.push({ type: 'over', ending: G.ending.id });
    }
}

function sceneOver(G) {
    const id = G.scene.id;
    G.seen[id] = G.day;
    G.scene = null;
    G.events.push({ type: 'sceneEnd', id });
    if (G.flags.gm && G.rank === 4) { G.rank = 5; G.events.push({ type: 'promoted', rank: 5, job: JOBS[5] }); }
    if (id === 'raid_result' && G.flags.raid_lost) finish(G, 'ruin');
}

function finish(G, id = chooseEnding(G)) {
    if (G.ending) return;
    G.ending = { id };
    G.pet = null; G.mg = null;
    G.sq = ['end_' + id];
    if (G.partner && !['hearth', 'emissary', 'ruin', 'disgrace'].includes(id)) G.sq.push('epi_' + G.partner);
}

// ------------------------------------------------------------------ the day
function startDay(G) {
    G.ap = AP_PER_DAY + (G.rank >= 4 ? 1 : 0);
    G.tillDay = 0;
    G.phase = 'desk';
    const ch = chapterOf(G.day);
    if (G.day === RAID.day) for (const o of G.out.splice(0)) resolve(G, o);       // everyone is called home for the raid
    const ri = REVIEW_DAYS.indexOf(G.day);
    if (ri >= 0) {
        const before = G.rank;
        while (G.rank < ri + 1 && G.merit >= MERIT[G.rank + 1]) G.rank++;
        if (G.rank > before) { G.flags.promoted = true; G.events.push({ type: 'promoted', rank: G.rank, job: JOBS[G.rank] }); } else delete G.flags.promoted;
    }
    if (G.day === 29 && (G.flags.bribed || G.flags.cooked) && G.integ <= 32) { G.flags.disgraced = true; finish(G, 'disgrace'); startNext(G); return; }
    G.queue = [];
    if (G.day !== RAID.day) {
        const n = 2 + (G.fac.board >= 2 ? 1 : 0);
        for (let i = 0; i < n; i++) G.queue.push(makePetition(G, ch));
    }
    for (const s of STORY) if (s.day === G.day && !G.seen[s.id] && (!s.if || evalCond(G, s.if))) G.sq.push(s.id);
    G.events.push({ type: 'day', day: G.day, chapter: ch });
    startNext(G);
}

function endDay(G) {
    const ch = chapterOf(G.day);
    // people left waiting, and jobs nobody took
    for (const q of G.queue) bump(G, q.type === 'adv' ? 'fellow' : q.type, -1);
    if (G.pet) { bump(G, G.pet.type === 'adv' ? 'fellow' : G.pet.type, -1); G.pet = null; }
    G.queue = [];
    for (let i = G.board.length - 1; i >= 0; i--) {
        if (G.board[i].expires <= G.day) { bump(G, G.board[i].type === 'adv' ? 'fellow' : G.board[i].type, -1); G.board.splice(i, 1); }
    }
    // the night's ledger
    const upkeep = UPKEEP.base + UPKEEP.perChapter * ch;
    const tavern = FAC.tavern.income[G.fac.tavern];
    const interest = G.gold > 0 ? Math.min(40, Math.floor(G.gold * 0.01 * G.fac.vault)) : 0;
    G.gold += tavern + interest - upkeep;
    if (G.gold < 0) bump(G, 'fellow', -2);                   // wages are late
    const yard = FAC.yard.xp[G.fac.yard];
    if (yard) for (const a of G.advs) if (a.state === 'ready') addXp(G, a.id, yard);
    G.events.push({ type: 'night', upkeep, tavern, interest });
    if (G.day >= DAYS) {
        if (G.flags.debt_ext && !G.flags.debt_paid) {
            if (G.gold >= DEBT.late) { G.gold -= DEBT.late; G.flags.debt_paid = true; } else G.flags.foreclosed = true;
        }
        finish(G);
        startNext(G);
        return;
    }
    G.day++;
    G.reports = [];
    for (const a of G.advs) if (a.state === 'hurt' && a.until <= G.day) a.state = 'ready';
    for (let i = G.out.length - 1; i >= 0; i--) if (G.out[i].back <= G.day) resolve(G, G.out.splice(i, 1)[0]);
    startDay(G);
}

// ------------------------------------------------------------------ quests
export function partyPower(G, q, party) {
    return party.reduce((sum, id) => sum + RANK_POW[G.advs.find((a) => a.id === id).rank] + 2 * ROSTER_BY_ID[id][q.kind], 0);
}

/** The real chance a party has. The board shows the chance for the rank you posted; this uses the true one. */
export function questChance(G, q, party, { potion = false, chart = false, rank = q.rank } = {}) {
    const p = partyPower(G, q, party);
    return clamp(0.5 + (p - QUEST_DIFF[rank]) / (10 + 6 * rank) + (potion ? 0.1 : 0) + (chart ? 0.05 : 0), 0.05, 0.97);
}

function resolve(G, o) {
    const q = o.q, trustKey = q.type === 'adv' ? 'fellow' : q.type;
    const chance = questChance(G, q, o.party, o);
    const r = G.rng();
    const res = r < chance ? 'win' : r < chance + 0.25 ? 'part' : 'fail';
    // a client who was overcharged disputes the bill: they pay for the job it really was, less a quarter
    if (q.posted > q.rank) q.fee = Math.round(feeFor(G, q, q.rank) * 0.75);
    let gold = 0;
    if (res === 'win') {
        gold = q.fee;
        G.renown += 1 + q.rank; G.merit += 1 + (q.rank >= 3 ? 1 : 0);
        bump(G, trustKey, 1 + (q.rank >= 2 ? 1 : 0) + (q.type === 'crown' || q.type === 'wild' ? 1 : 0));   // rarer patrons remember longer
        G.count.wins = (G.count.wins || 0) + 1;
    } else if (res === 'part') {
        gold = Math.round(q.fee / 2);
    } else {
        G.renown = Math.max(0, G.renown - 1 - q.rank);
        bump(G, trustKey, -3); bump(G, 'fellow', -2);
        G.count.fails = (G.count.fails || 0) + 1;
    }
    G.gold += gold;
    for (const id of o.party) {
        const a = G.advs.find((x) => x.id === id);
        a.state = 'ready';
        if (res === 'fail') { a.state = 'hurt'; a.until = G.day + Math.max(1, 2 + q.rank - G.fac.infirm); }
        const gap = a.rank - q.rank;
        const base = XP_QUEST * (q.rank + 1) * (gap <= 0 ? 1 : gap === 1 ? 0.5 : 0.15);
        addXp(G, id, Math.round(base * (res === 'win' ? 1 : res === 'part' ? 0.5 : 0.25)));
    }
    const rep = { res, title: q.title, type: q.type, gold, rank: q.rank, posted: q.posted, party: o.party.slice() };
    G.reports.push(rep);
    G.events.push({ type: 'report', ...rep });
}

// ------------------------------------------------------------------ commands
/** Do one thing. Returns false if the command is not allowed right now. */
export function act(G, cmd) {
    if (G.over || !cmd) return false;
    if (G.scene) {
        const lines = sceneLines(G);
        let live;
        if (cmd.t === 'next') { if (!G.scene.cur || G.scene.cur.choice) return false; live = advance(G, lines); }
        else if (cmd.t === 'choose') { if (!G.scene.cur?.choice?.some((o) => o.i === cmd.i)) return false; live = choose(G, lines, cmd.i); }
        else return false;
        if (!live) { sceneOver(G); startNext(G); }
        return true;
    }
    if (G.mg) {
        if (cmd.t === 'mg') return mgAct(G, cmd);
        if (cmd.t === 'mgclose' && G.mg.done) { G.mg = null; return true; }
        return false;
    }
    if (G.phase === 'raid') return cmd.t === 'raid' ? raid(G, cmd) : cmd.t === 'heal' ? heal(G, cmd) : false;
    if (G.pet) {
        if (cmd.t === 'grade') return grade(G, cmd.rank);
        if (cmd.t === 'decline') { bump(G, G.pet.type === 'adv' ? 'fellow' : G.pet.type, -1); G.events.push({ type: 'declined' }); G.pet = null; return true; }
        return false;
    }
    switch (cmd.t) {
        case 'call':
            if (!G.queue.length) return false;
            G.pet = G.queue.shift();
            G.events.push({ type: 'petition', giver: G.pet.giver });
            return true;
        case 'assign': return assign(G, cmd);
        case 'heal': return heal(G, cmd);
        case 'visit': return visit(G, cmd.who);
        case 'play':
            if (G.ap < 1 || !startMg(G, cmd.game, cmd.arg)) return false;
            G.ap--;
            return true;
        case 'upgrade': {
            const f = FAC[cmd.fac];
            if (!f || G.fac[cmd.fac] >= f.cost.length || G.gold < f.cost[G.fac[cmd.fac]]) return false;
            G.gold -= f.cost[G.fac[cmd.fac]];
            G.fac[cmd.fac]++;
            G.renown += 2;
            G.events.push({ type: 'upgrade', fac: cmd.fac, level: G.fac[cmd.fac] });
            return true;
        }
        case 'till': {
            const n = Math.floor(G.till);
            if (n < 1) return false;
            G.till -= n; G.gold += n;
            G.events.push({ type: 'till', gold: n });
            return true;
        }
        case 'paydebt':
            if (!G.flags.debt_ext || G.flags.debt_paid || G.gold < DEBT.late) return false;
            G.gold -= DEBT.late; G.flags.debt_paid = true; bump(G, 'crown', 3);
            G.events.push({ type: 'debtpaid' });
            return true;
        case 'endday':
            endDay(G);
            return true;
        default: return false;
    }
}

function grade(G, rank) {
    if (!(rank >= 0 && rank <= 4)) return false;
    const q = G.pet, trustKey = q.type === 'adv' ? 'fellow' : q.type;
    const diff = Math.abs(rank - q.rank);
    q.posted = rank;
    q.fee = feeFor(G, q, rank);
    q.expires = G.day + 2;
    if (diff === 0) { G.merit += 1; G.count.graded = (G.count.graded || 0) + 1; }
    else { bump(G, trustKey, -diff); G.merit = Math.max(0, G.merit - (diff - 1)); G.count.misgraded = (G.count.misgraded || 0) + 1; }
    G.board.push(q);
    G.pet = null;
    // the clerk is not told whether the grade was right: the party's report says so
    G.events.push({ type: 'posted', id: q.id, posted: rank });
    return true;
}

function assign(G, cmd) {
    const qi = G.board.findIndex((q) => q.id === cmd.quest);
    const party = [...new Set(cmd.party || [])];
    if (qi < 0 || party.length < 1 || party.length > 3) return false;
    if (!party.every((id) => G.advs.find((a) => a.id === id)?.state === 'ready')) return false;
    const potion = !!cmd.potion && G.potions > 0, chart = !!cmd.chart && G.charts > 0;
    if (potion) G.potions--;
    if (chart) G.charts--;
    const q = G.board.splice(qi, 1)[0];
    for (const id of party) G.advs.find((a) => a.id === id).state = 'away';
    const back = G.day + Math.max(1, q.days - (chart ? 1 : 0));
    G.out.push({ q, party, potion, chart, back });
    G.events.push({ type: 'assigned', id: q.id, party, back });
    return true;
}

function heal(G, cmd) {
    const a = G.advs.find((x) => x.id === cmd.adv);
    if (!a || a.state !== 'hurt' || G.potions < 1) return false;
    G.potions--; a.state = 'ready';
    bump(G, 'fellow', 1);
    G.events.push({ type: 'healed', adv: a.id });
    return true;
}

function visit(G, who) {
    if (!ROMANCE.includes(who) || !G.flags['met_' + who] || G.ap < 1) return false;
    if (G.advs.find((a) => a.id === who)?.state === 'away') return false;
    G.ap--;
    G.count['visit_' + who] = (G.count['visit_' + who] || 0) + 1;
    bumpAff(G, who, VISIT_AFF);
    const h = G.hearts[who];
    if (h < 4 && G.aff[who] >= HEARTS[h].aff && G.day >= HEARTS[h].day) {
        G.hearts[who]++;
        G.sq.push(`${who}_h${h + 1}`);
    } else {
        const talk = CAST[who].talk;
        const line = talk[(G.count['visit_' + who] - 1) % talk.length];
        G.sq.push({ meta: { id: 'talk_' + who, title: '', kind: 'talk' }, gen: [`@bg ${CAST[who].room}`, `@show ${who}.happy c`, `${who}.happy: ${line}`] });
    }
    startNext(G);
    return true;
}

/** How strong a raid party would be, and what is adding to it. */
export function raidPower(G, party, lead) {
    const parts = [['The party', party.reduce((s, id) => s + RAID.pow[G.advs.find((a) => a.id === id).rank], 0)]];
    const potions = Math.min(RAID.potionMax, G.potions);
    if (potions) parts.push(['Healing draughts', potions]);
    if (G.flags.dragon_ally) parts.push(['Vesperax', RAID.dragon]);
    if (G.flags.dragon_foe) parts.push(['No friend among the wild', RAID.foe]);
    if (G.trust.crown >= RAID.at) parts.push(['Royal lancers', RAID.crown]);
    if (G.trust.wild >= RAID.at) parts.push(['Fae guides', RAID.wild]);
    if (G.trust.folk >= RAID.at) parts.push(['Brightmoor militia', RAID.folk]);
    if (lead) parts.push(['You, at the front', RAID.lead]);
    return { parts, total: parts.reduce((s, p) => s + p[1], 0) };
}

function raid(G, cmd) {
    const party = [...new Set(cmd.party || [])].slice(0, RAID.size);
    if (!party.length || !party.every((id) => G.advs.find((a) => a.id === id)?.state === 'ready')) return false;
    const { total } = raidPower(G, party, !!cmd.lead);
    G.potions -= Math.min(RAID.potionMax, G.potions);
    if (cmd.lead) G.flags.went_afield = true;
    const res = total >= RAID.won ? 'won' : total >= RAID.pyrrhic ? 'pyrrhic' : 'lost';
    if (res === 'lost') G.flags.raid_lost = true;
    else {
        G.flags.raid_won = true;
        G.renown += 15;
        for (const k of ['folk', 'crown', 'wild', 'fellow']) bump(G, k, 5);
        for (const id of party) addXp(G, id, 40);
    }
    if (res === 'pyrrhic') { G.flags.raid_pyrrhic = true; bump(G, 'fellow', -10); }
    if (res !== 'won') for (const id of party) { const a = G.advs.find((x) => x.id === id); a.state = 'hurt'; a.until = G.day + 3; }
    G.phase = 'desk';
    G.events.push({ type: 'raid', res, power: total });
    G.sq.push('raid_result');
    startNext(G);
    return true;
}

// ------------------------------------------------------------------ real time
/** The only things on a clock: coins dropping into the tavern till, and the Stamp Rush sand-glass. */
export function step(G, dt) {
    if (G.over) return;
    if (G.mg) { mgTick(G, dt); return; }
    const cap = TILL.cap[G.fac.tavern];
    if (!G.scene && G.tillDay < cap) {
        const d = Math.min(dt * TILL.rate, cap - G.tillDay);
        G.till += d; G.tillDay += d;
    }
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

export { RANKS };
