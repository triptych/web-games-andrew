// An auto-player. It plays the whole thirty days through act(), the same commands the UI sends, so the tests,
// the balance table and the proof that every ending can be reached all exercise the real rules. It grades
// petitions by reading their words against the Handbook (readPetition), never the hidden rank. Pure.

import { DAYS, RANK_POW, FAC, DEBT, RAID, MG } from '../config.js';
import { makeRng } from '../rng.js';
import { newGame, act, step, questChance, raidPower } from './game.js';
import { readPetition } from './petition.js';
import { BEATS, TELLS, formValid, routeSolve } from './minigames.js';
import { ROMANCE } from './data/cast.js';

// What each route wants. prefer: answer tags in order of liking. ap: afternoon activities in order.
const BASE = { prefer: ['honest', 'kind', 'folk'], love: 'bram', commit: true, grade: 'right', assign: 'best', skip: [], first: [],
    ap: ['visit', 'stamp'], upgrades: ['board', 'tavern', 'yard', 'infirm', 'vault'], raid: 'best', debt: true };
export const ROUTES = {
    golden: { prefer: ['honest', 'folk', 'wild', 'kind'], first: ['crown', 'wild'], love: 'ren', ap: ['visit', 'brew', 'stamp'] },
    academy: { prefer: ['honest', 'kind', 'crown'], love: null, ap: ['spar', 'stamp'], spar: true, upgrades: ['yard', 'board', 'tavern'] },
    wild: { prefer: ['wild', 'honest', 'kind'], first: ['wild'], love: 'kael' },
    crown: { prefer: ['crown', 'honest'], first: ['crown'], skip: ['wild'], love: 'ren' },
    folk: { prefer: ['folk', 'honest', 'kind', 'crown'], first: ['folk'], skip: ['crown'], love: 'bram' },
    keeper: { prefer: ['stern', 'honest', 'crown'], love: 'sera', skip: ['crown'] },
    steady: { prefer: ['decline', 'honest', 'kind'], love: 'kael', commit: false },
    quiet: { prefer: ['honest'], grade: 'wrong', ap: ['visit', 'dice'], love: 'nyx' },
    hearth: { prefer: ['decline', 'hearth', 'kind', 'honest'], love: 'bram', ap: ['visit', 'stamp'] },
    road: { prefer: ['road', 'honest', 'kind'], love: null, ap: ['brew', 'stamp'] },
    emissary: { prefer: ['emissary', 'wild', 'honest'], first: ['wild'], love: null, ap: ['stamp', 'brew'] },
    puppet: { prefer: ['corrupt', 'honest', 'crown'], love: null, ap: ['stamp'] },
    gilded: { prefer: ['greed', 'crown'], love: null, ap: ['dice', 'stamp'], upgrades: ['vault', 'tavern', 'board'] },
    disgrace: { prefer: ['corrupt', 'greed'], love: null, ap: ['dice'], pickAudit: 'corrupt', noBribe: true },
    foreclosed: { prefer: ['folk', 'honest'], love: null, assign: 'none', ap: ['visit'], debt: false },
    ruin: { prefer: ['honest'], love: null, raid: 'weak' },
};
export const ROUTE_IDS = Object.keys(ROUTES);

export function makeBot({ skill = 1, route = 'golden', seed = 1 } = {}) {
    return { skill, route, plan: { ...BASE, ...ROUTES[route] }, rng: makeRng(seed * 7919 + 13) };
}

const slip = (bot, p) => bot.skill < 1 && bot.rng() < (1 - bot.skill) * p;

function pickChoice(G, bot) {
    const opts = G.scene.cur.choice, P = bot.plan, id = G.scene.id;
    const byTag = (t) => opts.find((o) => o.tag === t);
    if (/_h4$/.test(id)) {
        const who = id.split('_')[0];
        return (who === P.love && P.commit && byTag('commit')) || byTag('friend') || opts[0];
    }
    if (id === 'malvane_offer' && P.noBribe) return byTag('honest');
    if (slip(bot, 0.3)) return opts[Math.floor(bot.rng() * opts.length)];
    for (const t of ['love', ...P.prefer]) { const o = byTag(t); if (o) return o; }
    return opts[0];
}

function playMg(G, bot) {
    const mg = G.mg;
    if (mg.done) return { t: 'mgclose' };
    const wrong = slip(bot, 0.35);
    if (mg.game === 'stamp') return { t: 'mg', a: formValid(mg.forms[mg.i]) !== wrong ? 'ok' : 'no' };
    if (mg.game === 'brew') return { t: 'mg', a: wrong ? (mg.seq[mg.pos] + 1) % MG.brew.kinds : mg.seq[mg.pos] };
    if (mg.game === 'route') {
        const path = routeSolve(mg).path;
        return { t: 'mg', a: path[0] || 'r' };
    }
    if (mg.game === 'dice') return { t: 'mg', a: mg.pot >= (wrong ? 40 : 16) ? 'bank' : 'roll' };
    if (mg.game === 'spar') {
        // read the tell, as a player would; a masked tell is a guess
        const them = Object.keys(TELLS).find((m) => TELLS[m].includes(mg.tell));
        const counter = them && !wrong ? Object.keys(BEATS).find((k) => BEATS[k] === them) : ['strike', 'guard', 'feint'][Math.floor(bot.rng() * 3)];
        return { t: 'mg', a: counter };
    }
    return { t: 'mgclose' };
}

function combos(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i++) {
        out.push([ids[i]]);
        for (let j = i + 1; j < ids.length; j++) {
            out.push([ids[i], ids[j]]);
            for (let k = j + 1; k < ids.length; k++) out.push([ids[i], ids[j], ids[k]]);
        }
    }
    return out;
}

/** The cheapest party that makes a posted job safe, or the best there is if it is at least a coin flip. */
export function pickParty(G, q, need = 0.8) {
    const ready = G.advs.filter((a) => a.state === 'ready').map((a) => a.id);
    let best = null, bestCost = Infinity, top = null, topCh = 0;
    for (const party of combos(ready)) {
        const ch = questChance(G, q, party, { rank: q.posted });
        const cost = party.reduce((s, id) => s + RANK_POW[G.advs.find((a) => a.id === id).rank], 0);
        if (ch >= need && cost < bestCost) { best = party; bestCost = cost; }
        if (ch > topCh || (ch === topCh && top && cost < top.cost)) { top = { party, cost }; topCh = ch; }
    }
    return best || (topCh >= 0.5 ? top.party : null);
}

function assignCmd(G, bot) {
    const P = bot.plan;
    if (P.assign === 'none') return null;
    const order = [...G.board].sort((a, b) => (P.first.includes(b.type) - P.first.includes(a.type)) || (b.posted - a.posted));
    for (const q of order) {
        if (P.skip.includes(q.type)) continue;
        const party = pickParty(G, q);
        if (party) return { t: 'assign', quest: q.id, party, chart: G.charts > 0, potion: G.potions > RAID.potionMax && G.day < 24 };
    }
    return null;
}

function apCmd(G, bot) {
    const P = bot.plan;
    for (const what of P.ap) {
        if (what === 'visit' && P.love && G.flags['met_' + P.love] && G.advs.find((a) => a.id === P.love)?.state !== 'away'
            && (G.hearts[P.love] < 4 || G.aff[P.love] < 80)) return { t: 'visit', who: P.love };
        if (what === 'visit' && !P.love) {
            const any = ROMANCE.find((id) => G.flags['met_' + id] && G.hearts[id] < 2 && G.advs.find((a) => a.id === id)?.state !== 'away');
            if (any) return { t: 'visit', who: any };
        }
        if (what === 'spar') {
            const who = G.advs.filter((a) => a.state === 'ready' && a.rank < 4).sort((a, b) => b.rank - a.rank || b.xp - a.xp)[0];
            if (who) return { t: 'play', game: 'spar', arg: who.id };
        }
        if (what === 'brew' && G.potions < RAID.potionMax + 1) return { t: 'play', game: 'brew' };
        if (what === 'dice' && G.gold >= MG.dice.stake) return { t: 'play', game: 'dice' };
        if (what === 'route' && G.charts < 2) return { t: 'play', game: 'route' };
        if (what === 'stamp') return { t: 'play', game: 'stamp' };
    }
    return { t: 'play', game: 'stamp' };
}

/** The next command the bot would send. */
export function botCommand(G, bot) {
    const P = bot.plan;
    if (G.scene) return G.scene.cur.choice ? { t: 'choose', i: pickChoice(G, bot).i } : { t: 'next' };
    if (G.mg) return playMg(G, bot);
    if (G.phase === 'raid') {
        const ready = G.advs.filter((a) => a.state === 'ready').sort((a, b) => (P.raid === 'weak' ? a.rank - b.rank : b.rank - a.rank));
        const hurt = G.advs.find((a) => a.state === 'hurt');
        if (P.raid !== 'weak' && hurt && G.potions > 0 && ready.length < RAID.size) return { t: 'heal', adv: hurt.id };
        return { t: 'raid', party: ready.slice(0, P.raid === 'weak' ? 1 : RAID.size).map((a) => a.id), lead: !!G.flags.will_lead };
    }
    if (G.pet) {
        if (P.decline?.includes(G.pet.type)) return { t: 'decline' };
        const read = readPetition(G.pet.text);
        let rank = read ? read.rank : 1;
        if (P.grade === 'wrong') rank = (rank + 2) % 5;
        else if (P.grade === 'over') rank = Math.min(4, rank + 1);
        else if (slip(bot, 0.6)) rank = Math.max(0, Math.min(4, rank + (bot.rng() < 0.5 ? -1 : 1)));
        return { t: 'grade', rank };
    }
    if (G.queue.length) return { t: 'call' };
    const hurt = G.advs.find((a) => a.state === 'hurt');
    if (hurt && G.potions > (G.day >= 22 ? RAID.potionMax : 0)) return { t: 'heal', adv: hurt.id };
    const as = assignCmd(G, bot);
    if (as) return as;
    if (G.till >= 5) return { t: 'till' };
    if (G.ap > 0) return apCmd(G, bot);
    if (G.flags.debt_ext && !G.flags.debt_paid && P.debt && G.gold >= DEBT.late) return { t: 'paydebt' };
    const reserve = (P.debt && !G.flags.debt_paid ? (G.flags.debt_ext ? DEBT.late : DEBT.amount) : 0) + 40;
    for (const f of P.upgrades) {
        const lvl = G.fac[f];
        if (lvl < FAC[f].cost.length && G.gold >= FAC[f].cost[lvl] + (bot.route === 'gilded' ? 2000 : bot.route === 'foreclosed' ? 0 : reserve)) return { t: 'upgrade', fac: f };
    }
    return { t: 'endday' };
}

/** Play a whole game. Returns the finished G; opts.until stops early at a day; opts.onStep sees every state. */
export function playThrough(seed, { route = 'golden', skill = 1, profile = { name: 'Robin', gender: 'n' }, until = DAYS + 1, onStep = null, G = null, bot = null } = {}) {
    G = G || newGame(seed, profile);
    bot = bot || makeBot({ skill, route, seed });
    let guard = 0;
    while (!G.over && G.day < until) {
        if (++guard > 20000) throw new Error(`bot stuck on day ${G.day} (${JSON.stringify(botCommand(G, bot))})`);
        const cmd = botCommand(G, bot);
        if (!act(G, cmd)) throw new Error(`bot sent a refused command on day ${G.day}: ${JSON.stringify(cmd)}`);
        if (!G.scene && !G.mg) step(G, 2);        // a couple of seconds pass at the desk between actions
        if (onStep) onStep(G, cmd);
        G.events.length = 0;
    }
    return G;
}
