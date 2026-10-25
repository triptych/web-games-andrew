// The keeper bot. In battle it plays Kestrel's side through the same planner the Chain uses; at the
// roost it hatches, incubates, feeds, trains, breeds, shops and picks the party; between chapters it
// grinds Wild Hunts when the flock is behind. The tests use it to play the whole campaign, and
// ?debug=1 can hand it the real game. Pure, like the rest of js/sim.

import { act, unlocked, wildLevel, dragon, price, EGG_CAP } from './game.js';
import { nextCommand, stepSide } from './ai.js';
import { runEnemyPhase } from './game.js';
import { canBreed, breedOdds, dragonStats } from './dragons.js';
import { CHAPTERS, STARTERS } from './story.js';
import { SPECIES } from './data.js';
import { PARTY_MAX, LEVEL } from '../config.js';

export function makeBot({ skill = 1, starter = null, caution = 0.6, grind = true } = {}) {
    return { skill, starter, caution, grind, losses: {}, log: [] };
}

/** One battle command for the player's phase, or null. */
export function botInput(G, bot) {
    const B = G.battle;
    if (!B || B.over || B.phase !== 'p') return { cmd: null };
    return { cmd: nextCommand(G, B, 'p', { caution: bot.caution }) };
}

const power = (d) => { const s = dragonStats(d); return s.hp * 0.5 + s.atk * 1.4 + s.def + s.spd * 0.5; };

/** Tend the roost: everything a sensible keeper does between fights. */
export function botRoost(G, bot) {
    const M = G.meta;
    if (!M.started) act(G, { t: 'starter', sp: bot.starter || STARTERS[G.seed % STARTERS.length] });
    // hatch what's ready, then fill the incubators with the best eggs
    for (let s = 0; s < M.incub.length; s++) {
        const e = M.eggs.find((x) => x.eid === M.incub[s]);
        if (e && e.prog >= e.need) {
            if (M.dragons.length >= M.stableN) releaseWeakest(G);
            act(G, { t: 'hatch', slot: s });
        }
    }
    const waiting = M.eggs.filter((e) => !M.incub.includes(e.eid)).sort((a, b) => SPECIES[b.sp].rarity - SPECIES[a.sp].rarity);
    for (const e of waiting) { if (!act(G, { t: 'incubate', eid: e.eid }).ok) break; }
    if (M.food.coal > 0 && M.incub.some((x) => x != null)) act(G, { t: 'coal' });
    if (M.hoard >= 1) act(G, { t: 'collect' });
    // the party: strongest first, at most PARTY_MAX
    const ranked = M.dragons.slice().sort((a, b) => power(b) - power(a));
    act(G, { t: 'party', rids: ranked.slice(0, PARTY_MAX).map((d) => d.rid) });
    // feed the weakest of the party
    const party = M.party.map((r) => dragon(G, r)).filter(Boolean).sort((a, b) => a.lv - b.lv);
    for (const f of ['fish', 'meat']) while (M.food[f] > 0 && party.length && party[0].lv < LEVEL.max) { act(G, { t: 'feed', rid: party[0].rid, food: f }); party.sort((a, b) => a.lv - b.lv); }
    while (M.food.fruit > 0) { const d = party.find((x) => x.bond < 10); if (!d) break; act(G, { t: 'feed', rid: d.rid, food: 'fruit' }); }
    while (M.food.ironroot > 0) { const d = party[party.length - 1]; if (!d || d.train.atk >= 5) break; act(G, { t: 'feed', rid: d.rid, food: 'ironroot', stat: 'atk' }); }
    // train the weakest members of the party
    for (let s = 0; s < M.training.length; s++) act(G, { t: 'untrain', slot: s });
    const weak = party.slice().sort((a, b) => a.lv - b.lv);
    for (let s = 0; s < M.training.length && s < weak.length; s++) act(G, { t: 'train', rid: weak[s].rid, slot: s });
    // breed the two strongest adults when there's room for an egg
    if (M.flags.breed && M.eggs.length < Math.min(EGG_CAP, M.incub.length + 2)) {
        const adults = ranked.filter(canBreed);
        let best = null;
        for (let i = 0; i < adults.length; i++) for (let j = i + 1; j < adults.length; j++) {
            const a = adults[i], b = adults[j];
            const hybrid = breedOdds(a, b).some((o) => SPECIES[o.sp].hybrid);
            const score = power(a) + power(b) + (hybrid ? 40 : 0);
            if (!best || score > best.score) best = { a, b, score };
        }
        if (best) act(G, { t: 'breed', a: best.a.rid, b: best.b.rid });
    }
    // shopping: incubators and rings first, then food, then eggs
    const buy = (item, keep = 0) => { if (M.gold - price(G, item) >= keep) return act(G, { t: 'buy', item }).ok; return false; };
    if (M.incub.length < 3) buy('nest', 200);
    if (M.training.length < 2 && M.ch >= 3) buy('ring', 300);
    if (M.dragons.length >= M.stableN - 1) buy('stall', 200);
    for (let i = 0; i < 4; i++) if (!buy('fish', 400)) break;
    for (let i = 0; i < 3; i++) if (!buy('meat', 200)) break;
    if (M.eggs.length < 2 && M.dragons.length < M.stableN - 2) buy('egg', 600);
    if (M.gold > 2500 && M.eggs.length < 3) buy('rareegg', 800);
    if (M.food.coal < 1) buy('coal', 400);
}

function releaseWeakest(G) {
    const M = G.meta;
    const keep = new Set(M.party);
    const pool = M.dragons.filter((d) => !keep.has(d.rid)).sort((a, b) => power(a) - power(b));
    if (pool[0]) act(G, { t: 'release', rid: pool[0].rid });
}

/** What the bot fights next: the next chapter, or a Wild Hunt if the flock is behind. */
export function botNextBattle(G, bot) {
    const M = G.meta;
    const ci = Math.min(M.ch, CHAPTERS.length - 1);
    const C = CHAPTERS[ci];
    const top = M.party.map((r) => dragon(G, r)).filter(Boolean).map((d) => d.lv).sort((a, b) => b - a).slice(0, C.slots);
    const avg = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 1;
    const lost = bot.losses[ci] || 0;
    const behind = avg < C.lvl + 1 + Math.min(4, lost * 2);
    if (bot.grind && M.flags.wild && (behind || lost > 0) && (bot.huntsSince || 0) < 4) {
        bot.huntsSince = (bot.huntsSince || 0) + 1;
        return { t: 'start', wild: true, lvl: Math.max(1, Math.min(wildLevel(G), C.lvl + 2)) };
    }
    bot.huntsSince = 0;
    return { t: 'start', ch: ci };
}

/** Fight one battle to the end, both sides played by the same brain. Returns B. */
export function botBattle(G, bot, { maxActions = 4000, check = null } = {}) {
    const B = G.battle;
    let n = 0;
    while (!B.over && n++ < maxActions) {
        if (B.phase === 'e') runEnemyPhase(G);
        else stepSide(G, B, 'p', { caution: bot.caution });
        G.events.length = 0;
        if (check) check(G, B);
    }
    return B;
}

/**
 * Play the campaign from wherever G is. idle = seconds of real time that pass per battle (eggs
 * hatch, rings train). Returns { cleared, battles, hunts, losses, log }.
 */
export function playCampaign(G, bot, { idle = 420, maxBattles = 120, check = null } = {}) {
    let battles = 0;
    const log = [];
    while (battles < maxBattles && !(G.meta.cleared[CHAPTERS[CHAPTERS.length - 1].id])) {
        botRoost(G, bot);
        const cmd = botNextBattle(G, bot);
        if (!cmd.wild && !unlocked(G, cmd.ch)) break;
        const r = act(G, cmd);
        if (!r.ok) { log.push({ err: r.err, cmd }); break; }
        const B = G.battle;
        botBattle(G, bot, { check });
        battles++;
        const res = B.result || { win: false, reason: 'stalled' };
        if (!B.over) res.reason = 'stalled';
        log.push({ id: B.id, ch: B.ch, lvl: B.lvl, win: res.win, reason: res.reason, turns: B.turn, rank: res.rank, faints: B.stats.faints, recruited: B.recruited.length, party: G.meta.party.map((rid) => dragon(G, rid)?.lv) });
        if (!res.win && B.ch >= 0) bot.losses[B.ch] = (bot.losses[B.ch] || 0) + 1;
        if (res.win && B.ch >= 0) bot.losses[B.ch] = 0;
        act(G, { t: 'leave' });
        G.events.length = 0;
        act(G, { t: 'idle', sec: idle });
        G.events.length = 0;
    }
    return { cleared: Object.keys(G.meta.cleared).length, battles, log };
}
