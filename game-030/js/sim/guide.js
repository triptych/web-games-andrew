// What to do next. The journal's "Where to?" hint, the golden marker on the map and the bot all read this, so a
// hint can never point at something the bot couldn't do. Pure.
//
// A goal: { text, map, x, y, kind: 'talk' | 'bump' | 'grind', level? }

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
export const READY = { bertha: 6 };

export function nextGoal(G) {
    CUR = G;
    const f = (id) => !!G.flags[id];
    if (!f('briefed')) {
        if (!G.quests.main_gear) return talk('trina', 'Trina is waiting by the workshop, north-west of the square, with news.');
        return talk('pilcrow', 'Mayor Pilcrow is at the Hall, south-west of the square. Hear him out.');
    }
    if (!f('bertha_down')) return bump('lr_bertha', 'Big Bertha lairs behind the iron door at the east end of Gutter Gully, south of the Whistling Wilds.', READY.bertha);
    if (!f('gear_returned')) return talk('pilcrow', 'Take the Golden Gear to Mayor Pilcrow at the Hall.');
    return null;
}

/** A side goal the bot takes on the way (and the hint mentions when idle). */
export function sideGoal(G) {
    CUR = G;
    const q = (id) => G.quests[id]?.s;
    const has = (id) => G.inv[id] || 0;
    if (!G.party.includes('trina')) {
        if (!q('side_scraps')) return talk('trina', 'Trina wants five bits of scrap metal for her contraption.');
        if (has('scrap') >= 5) return talk('trina', 'Bring Trina her five scraps.');
        return grind('wilds', 'Scrap drops from Cog Sprites and Rust Crabs in the Whistling Wilds. Trina wants five.');
    }
    if (!G.party.includes('mabel')) {
        if (!q('side_kettle')) return talk('mabel', 'Mabel at the bakery has lost her kettle.');
        if (has('kettle')) return talk('mabel', 'Bring Mabel her kettle.');
        if (!G.done.gl_crab) return bump('gl_crab', 'A Rust Crab guards a rocky nook in Gutter Gully with Mabel\'s kettle.', 3);
        return bump('gl_kettle', 'Mabel\'s kettle is in the nook the crab guarded.');
    }
    if (q('side_springs') !== 'done') {
        if (!q('side_springs')) return talk('bertram', 'Bertram at the shop has a job for you.');
        if (has('spring') >= 3) return talk('bertram', 'Bring Bertram his three springs.');
        return grind('gully', 'Gear-Wolves and Rust Crabs carry Coiled Springs. Bertram wants three.');
    }
    return null;
}

export const goalOpen = (G, g) => !g || !g.cond || cond(G, g.cond);
