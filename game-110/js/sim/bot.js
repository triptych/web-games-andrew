// An auto-player. It plays through the same commands the player's buttons send, so the tests, the balance table
// and the title-screen demo all exercise the real rules. Pure, like the rest of js/sim.
//
// cps: hand crafts per second (0 for a player who never clicks). every: seconds between check-ins (an attentive
// player looks every second; an idle one every ten minutes). react: how long a visitor waits before it's greeted.

import { MINIONS, PERKS, DECOR, HOBBIES, SCHEME_BY } from './data.js';
import { rates, roomOpen, upgradesOnOffer, minionVisible, minionCost, henchCost, henchFree, legendGain } from './game.js';
import { HENCH } from '../config.js';

export function makeBot({ cps = 5, every = 1, react = 2, visitors = true, relocate = 1, cackleBelow = 70 } = {}) {
    return { cps, every, react, visitors, relocate, cackleBelow, acc: 0, wait: 0 };
}

/** Charm per second gained by applying fn to G, then undoing it. */
function gainOf(G, bot, apply, undo) {
    const a = rates(G);
    apply(); G._mods = null;
    const b = rates(G);
    undo(); G._mods = null;
    return (b.cps - a.cps) + (b.click - a.click) * bot.cps;
}

/** The commands to send for the next dt seconds. */
export function botCommands(G, bot, dt) {
    const out = [];
    bot.acc += bot.cps * dt;
    while (bot.acc >= 1) { bot.acc -= 1; out.push({ t: 'craft' }); }
    bot.wait -= dt;
    if (bot.wait > 0) return out;
    bot.wait = bot.every;

    const R = rates(G);
    const M = R.M;
    // keep up appearances
    if (G.dread < bot.cackleBelow && G.cd.cackle <= 0) out.push({ t: 'cackle' });
    if (M.unlock.storm && G.cd.storm <= 0 && G.dread < 40) out.push({ t: 'ability', id: 'storm' });
    if (bot.cps > 0 && M.unlock.taste && G.cd.taste <= 0) out.push({ t: 'ability', id: 'taste' });
    if (M.unlock.soiree && G.cd.soiree <= 0 && G.dread > 70) out.push({ t: 'ability', id: 'soiree' });
    // greet visitors once they've been noticed
    if (bot.visitors) for (const v of G.visitors) if (v.life - v.t >= bot.react) out.push({ t: 'visitor', vid: v.vid });
    // craft in the room that pays best
    let best = G.room, bv = -1;
    for (const h of HOBBIES) if (roomOpen(G, h.id) && R.hobbyMul[h.id] > bv) { bv = R.hobbyMul[h.id]; best = h.id; }
    if (best !== G.room) out.push({ t: 'room', id: best });
    return out;
}

/** Spend charm, gold and legend the way a sensible player would. Call after the commands above are applied. */
export function botShop(G, bot) {
    if (bot.wait !== bot.every) return [];        // only on a check-in
    const out = [];
    // charm: the best payback, counting the time to save up for it
    for (let guard = 0; guard < 40; guard++) {
        const R = rates(G);
        const base = Math.max(R.cps + R.click * bot.cps, 0.1);
        let pick = null, score = Infinity;
        for (const m of MINIONS) {
            if (!minionVisible(G, m)) continue;
            const cost = minionCost(G, m.id, 1);
            const d = gainOf(G, bot, () => { G.owned[m.id]++; }, () => { G.owned[m.id]--; });
            const s = cost / Math.max(d, 1e-9) + Math.max(0, cost - G.charm) / base;
            if (s < score) { score = s; pick = { t: 'buy', id: m.id, n: 1, cost }; }
        }
        for (const u of upgradesOnOffer(G).slice(0, 12)) {
            let d = gainOf(G, bot, () => { G.upg[u.id] = 1; }, () => { delete G.upg[u.id]; });
            if (d <= 0) d = base * 0.04;              // utility upgrades: worth about 4% of income
            const s = u.cost / d + Math.max(0, u.cost - G.charm) / base;
            if (s < score) { score = s; pick = { t: 'upgrade', id: u.id, cost: u.cost }; }
        }
        if (!pick || pick.cost > G.charm) break;
        out.push(pick);
        // apply now so the next choice sees it (the caller applies the same list in order; act() rejects repeats safely)
        G.charm -= pick.cost;
        if (pick.t === 'buy') G.owned[pick.id]++; else G.upg[pick.id] = 1;
        G._mods = null;
    }
    // undo the dry run: the caller's act() calls do it for real
    for (let i = out.length - 1; i >= 0; i--) {
        const p = out[i];
        G.charm += p.cost;
        if (p.t === 'buy') G.owned[p.id]--; else delete G.upg[p.id];
    }
    G._mods = null;
    // gold: décor first (it shows), then henchmen
    let gold = G.gold;
    for (const d of DECOR) if (!G.decor[d.id] && d.cost <= gold) { out.push({ t: 'decor', id: d.id }); gold -= d.cost; }
    if (G.hench < Math.min(HENCH.max, 3 + G.runs) && henchCost(G) <= gold) out.push({ t: 'hench' });
    // schemes: anything the free henchmen can run
    let free = henchFree(G);
    G.board.forEach((c, i) => { if (c && free >= needOf(c)) { out.push({ t: 'scheme', i }); free -= needOf(c); } });
    // relocate when it would at least double legend (or bring the first point)
    const gain = legendGain(G);
    if (bot.relocate && gain >= Math.max(1, G.legend.total * bot.relocate)) {
        out.push({ t: 'relocate' });
    }
    // and spend legend, cheapest perks first
    let pts = G.legend.total - G.legend.spent + (out.some((c) => c.t === 'relocate') ? gain : 0);
    for (const p of [...PERKS].sort((a, b) => a.cost - b.cost)) if (!G.perks[p.id] && p.cost <= pts) { out.push({ t: 'perk', id: p.id }); pts -= p.cost; }
    return out;
}

const needOf = (c) => SCHEME_BY[c.id].need;
