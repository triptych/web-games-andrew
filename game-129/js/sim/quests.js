// HOLLOWDEEP — quests: the townsfolk's story chain and Pell's board of bounties. Pure.
//
// A quest in G.quests.active: { id, kind, title, text, npc, floor, target?, count?, have?, item_q?, gold, xp, item?, n? }
//   hunt   — kill `count` of monster `target` (counted from when it was taken)
//   delve  — reach floor `floor`
//   slay   — beat the guardian of floor `floor`
//   fetch  — find `item_q` on floor `floor` (a glint at the floor's quest spot) and bring it back
//   rescue — find the lost delver on floor `floor`; they come home with you and join the guild for free

import { STORY } from './data/town.js';
import { STRATA, MONSTERS, FLOORS_PER_STRATUM, stratumOf, isBossFloor } from './data/monsters.js';
import { NAMES } from './data/classes.js';

export const MAX_ACTIVE = 5;

/** The next story quest a person in town has for you, or null. */
export function storyFor(G, npc) {
    for (const q of STORY) {
        if (q.npc !== npc) continue;
        if (G.quests.done.includes(q.id)) continue;
        if (G.quests.active.some((a) => a.id === q.id)) return null;
        if (q.need && !G.quests.done.includes(q.need)) return null;
        return q;
    }
    return null;
}

export function storyQuest(q) {
    return {
        id: q.id, story: true, kind: q.kind, title: q.title, text: q.text, npc: q.npc, floor: q.floor,
        item_q: q.item_q || null, gold: q.gold, xp: Math.round(q.gold * 0.8), item: q.item || null, n: q.count || 1, have: 0,
    };
}

/** Pell's board: three bounties for the floors the party can reach. Re-rolled every night at the inn. */
export function rollBoard(G) {
    const rng = G.rng;
    const deep = Math.max(1, G.deepest);
    const out = [];
    const kinds = rng.shuffle(['hunt', 'hunt', 'delve', 'fetch', 'rescue']);
    let i = 0;
    for (const kind of kinds) {
        if (out.length >= 3) break;
        const id = `b${G.day}_${i++}`;
        if (kind === 'hunt') {
            const maxS = Math.min(STRATA.length - 1, Math.floor((deep - 1) / FLOORS_PER_STRATUM));
            const s = STRATA[rng.int(Math.max(0, maxS - 1), maxS)];
            const mid = rng.pick(s.monsters);
            const count = rng.int(3, 6);
            const lvl = STRATA.indexOf(s) * FLOORS_PER_STRATUM + 3;
            const gold = Math.round((MONSTERS[mid].gold * 2.5 + 10) * count * (1 + lvl * 0.05));
            out.push({ id, kind, title: `Bounty: ${MONSTERS[mid].name}`, text: `Put down ${count} ${MONSTERS[mid].name}${count > 1 ? 's' : ''}. Found in the ${s.name}.`, npc: 'pell', target: mid, count, have: 0, gold, xp: gold, floor: lvl });
        } else if (kind === 'delve') {
            // never past a guardian you haven't beaten
            const nextBoss = Math.ceil((deep + 1) / FLOORS_PER_STRATUM) * FLOORS_PER_STRATUM;
            const floor = Math.min(deep + rng.int(1, 3), nextBoss);
            if (floor <= deep) continue;
            const gold = 40 + floor * 30;
            out.push({ id, kind, title: `Survey Floor ${floor}`, text: `The guild wants eyes on floor ${floor}. Go down that far and come back to tell it.`, npc: 'pell', floor, gold, xp: gold * 2 });
        } else if (kind === 'fetch') {
            const floor = rng.int(Math.max(1, deep - 4), deep);
            const gold = 60 + floor * 35;
            out.push({ id, kind, title: `Lost Satchel, Floor ${floor}`, text: `A delver dropped a satchel of notes on floor ${floor} running from something. Look for the glint in the far reaches.`, npc: 'pell', floor, item_q: 'satchel', gold, xp: gold });
        } else if (kind === 'rescue') {
            if (deep < 2) continue;
            const floor = rng.int(Math.max(2, deep - 3), deep);
            const name = rng.pick(NAMES);
            const gold = 80 + floor * 40;
            out.push({ id, kind, title: `Find ${name}`, text: `${name} hasn't come up from floor ${floor} in two days. Bring them home and they'll fight for you.`, npc: 'pell', floor, who: name, gold, xp: gold });
        }
    }
    return out;
}

/** What still needs doing, as a short line for the quest log. */
export function progressText(G, q) {
    if (q.kind === 'hunt') return `${Math.min(q.have, q.count)} / ${q.count}`;
    if (q.kind === 'delve') return G.deepest >= q.floor ? 'Done' : `Deepest: ${G.deepest}`;
    if (q.kind === 'slay') return G.bossDown[q.floor] ? 'Done' : 'Not yet';
    if (q.kind === 'fetch') return G.inv.some((e) => e.id === (q.item_q === 'satchel' ? 'satchel_' + q.id : q.item_q)) ? 'Found' : 'Not found';
    if (q.kind === 'rescue') return q.found ? 'Found' : 'Not found';
    return '';
}

export function isComplete(G, q) {
    if (q.kind === 'hunt') return q.have >= q.count;
    if (q.kind === 'delve') return G.deepest >= q.floor;
    if (q.kind === 'slay') return !!G.bossDown[q.floor];
    if (q.kind === 'fetch') return G.inv.some((e) => e.id === questItemId(q));
    if (q.kind === 'rescue') return !!q.found;
    return false;
}

export const questItemId = (q) => (q.item_q === 'satchel' ? 'satchel_' + q.id : q.item_q);

/** A fetch or rescue quest waiting on this floor (only one at a time sits at the quest spot). */
export function spotQuest(G, floor) {
    return G.quests.active.find((q) => q.floor === floor && ((q.kind === 'fetch' && !isComplete(G, q)) || (q.kind === 'rescue' && !q.found))) || null;
}

/** Count kills toward hunts. */
export function onKills(G, mids) {
    for (const q of G.quests.active) if (q.kind === 'hunt') for (const m of mids) if (m === q.target) q.have++;
}

export { isBossFloor, stratumOf };
