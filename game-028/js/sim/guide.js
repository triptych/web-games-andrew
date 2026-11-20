// What to do next. The journal's "Where to?" hint and the bot both read this, so a hint can never point at
// something the bot couldn't do. Pure.
//
// A goal: { text, map, x, y, kind: 'talk' | 'bump' | 'step' | 'grind', level? }

import { MAPS } from './data/maps.js';
import { cond } from './rules.js';

let CUR = null;   // the game the goal is being worked out for (people stand where their condition holds)
const person = (who) => {
    for (const [map, m] of Object.entries(MAPS)) { const p = m.people.find((q) => q.who === who && (!CUR || cond(CUR, q.cond))); if (p) return { map, x: p.x, y: p.y }; }
    return null;
};
const event = (id) => {
    for (const [map, m] of Object.entries(MAPS)) { const e = m.events.find((q) => q.id === id); if (e) return { map, x: e.x, y: e.y }; }
    return null;
};
const talk = (who, text) => ({ ...person(who), kind: 'talk', text, who });
const bump = (id, text, level) => ({ ...event(id), kind: 'bump', text, id, level });
const grind = (map, text, level) => ({ map, kind: 'grind', text, level });

/** The recommended party level before each big fight (the bot grinds to it; the hint mentions it). */
export const READY = { ambush: 2, korvas: 7, gate: 9, lich: 10 };

export function nextGoal(G) {
    CUR = G;
    const q = (id) => G.quests[id]?.s;
    const f = (id) => !!G.flags[id];
    if (G.chapter === 1) {
        if (!q('the_missing_merchant')) return talk('varec', 'Elder Varec is waiting up for you, north-west in Thornhaven.');
        if (!f('borin_found')) {
            if (!G.done.tw_ambush) return bump('tw_ambush', 'The bandits camp in a thorn-walled clearing east of the Thornwood path.', READY.ambush);
            return talk('borin', 'Borin is tied up in the bandits\' camp. Talk to him.');
        }
        return talk('varec', 'Tell Elder Varec that Borin is safe.');
    }
    if (G.chapter === 2) {
        if (!G.party.includes('orin')) return talk('orin', 'A knight is waiting in Thornhaven\'s square. He wants what you want.');
        if (!G.party.includes('sera')) return talk('sera', 'A ranger watches the west path of the Thornwood. She could guide you.');
        if (!q('spirit_of_the_wood')) return talk('sylvara', 'Find Sylvara, the spirit of the World Tree, east along the Thornwood path.');
        if (q('spirit_of_the_wood') === 'active') {
            for (const n of [1, 2, 3]) {
                if (f('anchor_' + n)) continue;
                if (G.inv.soul_gem > 0) return bump('gr_a' + n, 'Press a soul gem into one of the corrupted roots in the World Tree Grove.');
                return grind('thornwood', 'You need soul gems. Lich Shards drifting through the Thornwood drop them.');
            }
            return talk('sylvara', 'All three roots are clean. Return to Sylvara.');
        }
        if (!q('broken_oath')) return talk('sylvara', 'Sylvara has something to tell Orin.');
        return bump('ch_korvas', 'Korvas waits at the altar of the Shattered Chapel, south of the grove.', READY.korvas);
    }
    if (G.chapter === 3) {
        if (!G.party.includes('thane')) return talk('thane', 'A warlock lingers in the Aethermoor ruins, south of the Thornwood. He wants to help.');
        if (!q('the_third_shard')) return talk('aneth', 'Someone is alive in the Aethermoor ruins. Find them.');
        if (!(G.inv.elder_scroll > 0)) return bump('ac_scroll', 'The seal needs the Elder Scroll: it is hidden in the Academy ruins, west of the Thornwood path.');
        if ((G.inv.soul_gem || 0) < 2) return grind('ruins', 'Aneth needs two soul gems. The Lich Shards in the ruins carry them.');
        return talk('aneth', 'Bring the soul gems and the scroll to Scholar Aneth.');
    }
    if (G.chapter === 4) {
        if (!G.done.ru_gate) return bump('ru_gate', 'The sanctum doors stand open at the south of the ruins, and something guards them.', READY.gate);
        return bump('sa_lich', 'Vaelthas waits in the Sanctum below the ruins.', READY.lich);
    }
    return null;
}

/** A side goal the bot takes on the way (and the hint mentions when idle). */
export function sideGoal(G) {
    CUR = G;
    const q = (id) => G.quests[id]?.s;
    if (q('lyras_past') === 'active' && !(G.inv.elder_scroll > 0)) return bump('ac_scroll', 'Lyra\'s scroll is hidden in the Academy ruins, west of the Thornwood path.');
    if (!q('slime_infestation')) return talk('holt', 'Farmer Holt is shouting about slimes, by his farmhouse.');
    if (q('slime_infestation') === 'active' && (G.inv.slime_core || 0) >= 3) return talk('holt', 'Bring Farmer Holt his slime cores.');
    if (q('slime_infestation') === 'active') return grind('thornwood', 'Slimes wobble about the Thornwood. Farmer Holt wants three of their cores.');
    if (!q('pelts_for_the_forge')) return talk('marta', 'Marta at the forge has work for someone handy with a blade.');
    if (q('pelts_for_the_forge') === 'active' && (G.inv.wolf_pelt || 0) >= 3) return talk('marta', 'Bring Marta her wolf pelts.');
    if (q('pelts_for_the_forge') === 'active') return grind('thornwood', 'Wolves prowl the Thornwood. Marta wants three pelts.');
    return null;
}

export const goalOpen = (G, g) => !g || !g.cond || cond(G, g.cond);
