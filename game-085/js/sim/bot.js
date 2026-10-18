// An auto-player. It decides what a player would on a check-in, through the same commands the UI sends,
// so the tests, the balance table and the title screen's demo caravan all exercise the real rules. Pure.
//
// skill 1 checks in often and spends well; lower skills check in less and leave gold lying about.

import { CLASSES, UPGRADES, TOWN, cartUpCost, cartCap } from './data.js';
import { partySlots } from './party.js';
import { command, wardenHere, refreshOdds } from './game.js';
import { nextWarden } from './world.js';
import { REGIONS } from './data.js';

const WANT = ['healer', 'cook', 'smith', 'alchemist', 'scout', 'trader', 'bard', 'guard'];

export function makeBot({ skill = 1 } = {}) {
    return { skill, every: skill >= 1 ? 1800 : 8 * 3600, last: -Infinity, day: 0 };
}

/** The live game's input each step: rally whenever it can. */
export function botInput(G, bot) {
    return { a: bot.skill >= 1 && !G.at && G.road && !G.camp && !G.busy && G.buffs.rallyCd <= G.t };
}

/** One check-in's worth of decisions. Returns the commands it sent. */
export function botCheckIn(G, bot) {
    const sent = [];
    const send = (c) => { const r = command(G, c); if (r.ok) sent.push(c); return r; };
    if (!G.daily.claimed) send({ type: 'claimPost' });
    while (G.letters.length) send({ type: 'read' });
    if (bot.skill >= 1) send({ type: 'orders', key: 'autoChallenge', value: true });

    // travellers
    const have = new Set(G.party.map((m) => m.cls));
    const rank = (cls) => (have.has(cls) ? 50 : 0) + WANT.indexOf(cls);
    for (const o of [...G.offers].sort((a, b) => rank(a.m.cls) - rank(b.m.cls))) {
        if (G.party.length >= partySlots(G.level)) break;
        if (have.has(o.m.cls) && G.party.length < partySlots(G.level) - 1) continue;
        if (send({ type: 'acceptOffer', id: o.m.id }).ok) have.add(o.m.cls);
    }
    if (G.at) {
        G.tavern.map((o, i) => ({ o, i })).sort((a, b) => rank(a.o.m.cls) - rank(b.o.m.cls)).forEach(({ o }) => {
            if (G.party.length >= partySlots(G.level) || have.has(o.m.cls)) return;
            if (G.gold < o.cost * 1.2) return;
            const idx = G.tavern.indexOf(o);
            if (send({ type: 'hire', idx }).ok) have.add(o.m.cls);
        });
    }

    // spend: carts first (they compound), then the wagon
    const budget = () => G.gold * (bot.skill >= 1 ? 0.85 : 0.5);
    for (let pass = 0; pass < 30; pass++) {
        let best = null;
        for (const m of G.party) {
            if (m.cls === 'captain' || m.cart >= cartCap(G.level)) continue;
            const c = cartUpCost(m.cls, m.cart);
            if (Object.entries(c.mats).some(([k, n]) => G.mats[k] < n)) continue;
            if (!best || c.gold < best.cost) best = { c: { type: 'cartUp', id: m.id }, cost: c.gold };
        }
        for (const key of Object.keys(UPGRADES)) {
            const l = G.up[key];
            if (l >= UPGRADES[key].max) continue;
            const w = key === 'wheels' ? 0.8 : key === 'hold' ? 1.1 : key === 'lantern' ? (bot.skill >= 1 ? 3 : 0.9) : key === 'larder' ? 1.3 : 1.2;
            const cost = UPGRADES[key].cost(l) * w;
            if (!best || cost < best.cost) best = { c: { type: 'upgrade', key }, cost };
        }
        if (!best || best.cost > budget()) break;
        if (!send(best.c).ok) break;
    }
    send({ type: 'equipBest' });

    // a Warden in reach: challenge it here, or head for its town when the odds look good
    const p = refreshOdds(G);
    if (G.at && wardenHere(G) !== null) {
        if (p >= (bot.skill >= 1 ? 0.6 : 0.8)) send({ type: 'challenge' });
    } else if (p >= 0.8) {
        send({ type: 'course', town: REGIONS[nextWarden(G)].warden.town });
        send({ type: 'orders', key: 'autoChallenge', value: true });
    }
    return sent;
}

/** Run the game for secs with the bot checking in on its schedule. Quiet, like time away. */
export function botPlay(G, bot, secs, advance, checkIn) {
    const end = G.t + secs;
    while (G.t < end) {
        if (G.t - bot.last >= bot.every) {
            bot.last = G.t;
            checkIn?.(G, Math.floor(G.t / 86400));
            botCheckIn(G, bot);
        }
        const n = Math.min(end - G.t, 60);
        advance(G, n);
    }
}

export { TOWN, CLASSES };
