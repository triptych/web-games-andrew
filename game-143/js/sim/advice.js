// Lord Vellum's clipboard: what the player could usefully do next, best first. Pure, like the rest of js/sim.
// The tip card shows the first goal, the "What next?" panel lists several, and the tests check that a fresh town
// always has a goal it can act on.
//
// A goal: { id, icon, title, text, can, show }
//   can   the player can do it right now (affordable, a plot free...)
//   show  where "Show me" goes: { plot, build? } a plot (and the building to pick there), { panel } a panel, or null

import { BUILDINGS, STAFF, STAFF_ORDER, ADVENTURERS, ADV_ORDER, RES_ICON } from './data.js';
import {
    plotsOpen, countOf, hasAny, costOf, canAfford, housing, workersNeeded, advSlots, advsHired, bakeCap, isRipe, daysUntil,
} from './town.js';
import { questDef, needsDeliver, deliverCost, objectiveMet } from './game.js';
import { readiness } from './battle.js';
import { WALL_COST, HALL_COST, LVL_MULT } from '../config.js';

const A = (k) => { const n = BUILDINGS[k].name; return /^The /.test(n) ? n : (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n; };
const THE = (k) => { const n = BUILDINGS[k].name; return /^The /.test(n) ? n : 'the ' + n; };

/** How much more of each resource a cost needs, as text ("🪙40 🪨10"), or '' when affordable. */
export function shortBy(G, cost) {
    return Object.entries(cost).filter(([r, v]) => (G.res[r] || 0) < v).map(([r, v]) => `${RES_ICON[r]}${Math.ceil(v - G.res[r])}`).join(' ');
}

/** What each building is for, in a phrase short enough for the tip card. */
export const PURPOSE = {
    cottage: 'Homes for six more villagers.', mill: 'Flour for the bakery and the Grand Bake.', beets: 'Sugar for the bakery and the Grand Bake.',
    quarry: 'Stone for the wall and the bigger buildings.', bakery: 'Turns flour and sugar into gold and hope.', market: 'Gold from every villager in town.',
    tailor: 'Knitted cozies for the wall: less damage in a siege.', tavern: 'Adventurers stay here, and fight on the wall.',
    tower: 'A candied crossbow on the wall in a siege.', witch: 'Hex-starch makes the Mayor\'s doilies hit harder.',
    bell: 'Hope in town, and faster shooting on the wall.', oven: 'Where the Mayor will bake her secret project.', gingerhome: 'Homes for eight gingerfolk.',
};

const freePlot = (G) => { for (let i = 0; i < plotsOpen(G); i++) if (!G.plots[i].b) return i; return -1; };
const building = (G, kind) => G.plots.some((p) => p.b?.kind === kind && p.b.build > 0 && !p.b.up);

export function nextGoals(G) {
    if (G.mode !== 'town') return [];
    const out = [], seen = new Set();
    const add = (pri, g) => { if (seen.has(g.id)) return; seen.add(g.id); out.push({ pri, ...g }); };
    const free = freePlot(G);
    const hallCost = G.hall.lvl < 3 ? HALL_COST[G.hall.lvl] : null;

    // building something: say what it is for, and what's missing when it can't be afforded
    const buildGoal = (pri, kind, why) => {
        if (hasAny(G, kind) && BUILDINGS[kind].unique) return;
        if (building(G, kind)) return;
        const cost = costOf(kind), short = shortBy(G, cost);
        // short of something nobody in town makes yet? the maker comes first
        const maker = { stone: 'quarry', flour: 'mill', sugar: 'beets' };
        for (const r in maker) {
            if ((cost[r] || 0) > G.res[r] && !hasAny(G, maker[r]) && maker[r] !== kind) {
                buildGoal(pri, maker[r], `${A(kind)} needs ${r}, and nothing in town makes it yet.`);
                return;
            }
        }
        if (free < 0) {
            if (G.hall.build > 0 || pri >= 5) return;   // no saving up for a bigger hall just for a nice-to-have
            if (!hallCost) return;
            const hs = shortBy(G, hallCost);
            add(pri, {
                id: 'hall', icon: '🏛️', title: 'Upgrade the Town Hall', can: !hs,
                text: `Every plot is full. A bigger Town Hall opens more plots${why ? ` (you need room for ${A(kind)})` : ''}.${hs ? ` Need ${hs} more.` : ''}`,
                show: { panel: 'hall' },
            });
            return;
        }
        add(pri, {
            id: 'build:' + kind, icon: BUILDINGS[kind].icon, title: `Build ${A(kind)}`, can: !short,
            text: (short ? `Need ${short} more: tap the ✨ bubbles to earn it faster. ` : '') + why,
            show: { plot: free, build: kind },
        });
    };

    // 1. a first lesson in bubbles
    const ripe = G.plots.findIndex((p) => isRipe(p.b));
    if (ripe >= 0) {
        add((G.stats.collected || 0) < 3 ? 0 : 8, {
            id: 'collect', icon: '✨', title: 'Collect the bubbles', can: true,
            text: 'A glowing bubble means a building has something ready. Tap it to collect a bonus (or press C to gather them all).',
            show: { plot: ripe },
        });
    }

    // 2. quests ready to hand in
    for (const id of G.quests.active) {
        const q = questDef(id);
        if (needsDeliver(q) && objectiveMet(G, q) && !G.quests.paid[id]) {
            const short = shortBy(G, deliverCost(q));
            add(short ? 6 : 1, {
                id: 'deliver:' + id, icon: '📦', title: `Deliver: ${q.title}`, can: !short,
                text: short ? `Ready to deliver once you have ${short} more.` : 'Everything is ready. Hand it over in the Quests panel.',
                show: { panel: 'quests' },
            });
        }
    }

    // 3. homes when the new jobs outnumber the villagers
    const jobs = workersNeeded(G);
    if (jobs > housing(G) - 1 && countOf(G, 'mill') + countOf(G, 'bakery') > 0) {
        const home = G.unlocks.ginger ? 'gingerhome' : 'cottage';
        buildGoal(2, home, `The workshops need ${Math.ceil(jobs)} workers and there are homes for ${housing(G)}. More homes, more villagers, everything runs faster.`);
    }

    // 4. the story's main quests, then the oven
    for (const id of G.quests.active) {
        const q = questDef(id);
        if (q.obj.kind !== 'build') continue;
        for (const k of [q.obj.what, q.obj.and]) {
            if (!k) continue;
            const need = k === q.obj.what ? q.obj.n || 1 : 1;
            if (countOf(G, k) >= need) continue;
            buildGoal(q.main ? 3 : 5, k, `For the quest “${q.title}”. ${PURPOSE[k]}`);
        }
    }
    const oven = G.plots.findIndex((p) => p.b?.kind === 'oven' && !(p.b.build > 0 && !p.b.up));
    if (oven >= 0 && !G.oven.lit && G.bake.pct < bakeCap(G)) {
        add(3, { id: 'oven', icon: '🔥', title: 'Light the Great Oven', can: true, text: 'The Grand Bake only rises while the oven is lit. It burns flour and sugar as it bakes.', show: { plot: oven } });
    }
    if (oven >= 0 && G.oven.lit && G.oven.starved) {
        const k = G.res.flour < 1 ? 'mill' : 'beets';
        buildGoal(3, k, `The oven has run out of ${k === 'mill' ? 'flour' : 'sugar'}. Another ${BUILDINGS[k].name} keeps it baking.`);
    }
    // the producers every town needs: the bakery first once there's flour, it's the town's gold
    if (!hasAny(G, 'bakery') && hasAny(G, 'mill') && hasAny(G, 'beets')) buildGoal(2, 'bakery', 'The bakery turns flour and sugar into gold and hope. It pays for everything else.');
    if (!hasAny(G, 'mill')) buildGoal(3, 'mill', 'Flour for the bakery and the Grand Bake.');
    if (!hasAny(G, 'beets')) buildGoal(3, 'beets', 'Sugar for the bakery and the Grand Bake.');
    if (!hasAny(G, 'quarry')) buildGoal(3, 'quarry', 'Stone for the wall and most buildings.');

    // 5. the siege checklist
    if (G.phase < 4) {
        const soon = daysUntil(G) < 4 ? 2 : 4;   // the checklist jumps the queue as the siege gets close
        for (const r of readiness(G)) {
            if (r.ok) continue;
            if (r.k === 'wall' && G.wall.build <= 0 && WALL_COST[G.wall.lvl]) {
                const short = shortBy(G, WALL_COST[G.wall.lvl]);
                add(soon, { id: 'wall', icon: '🧱', title: `Raise the wall to level ${r.v}`, can: !short, text: `${short ? `Need ${short} more. ` : ''}The siege checklist asks for it: a taller wall takes more hits.`, show: { panel: 'defence' } });
            }
            if (r.k === 'towers') buildGoal(soon, 'tower', `The siege checklist wants ${r.v} watchtower${r.v > 1 ? 's' : ''} (you have ${r.have}). Each one shoots from the wall.`);
            if (r.k === 'build') buildGoal(soon, r.v, `The siege checklist asks for one. ${PURPOSE[r.v]}`);
            if (r.k === 'advs') {
                if (!hasAny(G, 'tavern')) buildGoal(soon, 'tavern', 'Adventurers need somewhere to stay before they will help on the wall.');
                else if (advsHired(G) < advSlots(G)) {
                    const id = ADV_ORDER.find((a) => !G.advs[a].hired && a !== 'tobias' && !(ADVENTURERS[a].phase > G.phase) && !(ADVENTURERS[a].needs && !G.quests.done[ADVENTURERS[a].needs]));
                    if (id) add(soon, { id: 'hire', icon: '⚔️', title: `Hire ${ADVENTURERS[id].name}`, can: G.res.gold >= ADVENTURERS[id].cost, text: `The checklist wants ${r.v} adventurers on the wall.`, show: { panel: 'heroes' } });
                } else add(5, { id: 'tavernup', icon: '🍺', title: 'Upgrade the tavern', can: true, text: 'Every room is taken. A bigger Grinning Gourd fits more heroes.', show: { plot: G.plots.findIndex((p) => p.b?.kind === 'tavern') } });
            }
        }
    }

    // 6. idle staff
    const idle = STAFF_ORDER.filter((id) => G.staff[id].joined && G.staff[id].at == null);
    if (idle.length) {
        const id = idle[0], aff = STAFF[id].aff, here = aff ? G.plots.findIndex((p) => p.b?.kind === aff) : -1;
        add(5, {
            id: 'staff', icon: '🧑‍🍳', title: `Put ${STAFF[id].name} to work`, can: true,
            text: `${STAFF[id].name} is taking it easy. Staff speed up the building they work in${aff ? `, most of all ${A(aff)}` : ''}.`,
            show: here >= 0 ? { plot: here } : { panel: 'staff' },
        });
    }

    // 7. the other quests and nice-to-haves
    if (!hasAny(G, 'bakery')) buildGoal(5, 'bakery', 'Turns flour and sugar into gold and hope.');
    if (!hasAny(G, 'market') && G.pop >= 8) buildGoal(6, 'market', 'Gold from every villager in town.');
    if (G.phase >= 1 && !hasAny(G, 'bell')) buildGoal(7, 'bell', 'Hope in town, and faster shooting on the wall.');

    // 8. an upgrade that pays: the cheapest affordable one
    let best = null;
    G.plots.forEach((p, i) => {
        const b = p.b;
        if (!b || b.lvl >= 3 || b.build > 0 || (b.kind === 'cottage' && jobs <= housing(G) - 4)) return;
        const cost = costOf(b.kind, b.lvl + 1), total = (cost.gold || 0) + (cost.stone || 0);
        if (!best || total < best.total) best = { i, b, cost, total };
    });
    if (best) {
        const short = shortBy(G, best.cost);
        add(short ? 9 : 7, {
            id: 'upgrade', icon: '⭐', title: `Upgrade ${THE(best.b.kind)} to ★${best.b.lvl + 1}`, can: !short,
            text: `Level ${best.b.lvl + 1} works ${Math.round((LVL_MULT[best.b.lvl] / LVL_MULT[best.b.lvl - 1] - 1) * 100)}% harder.${short ? ` Need ${short} more.` : ''}`,
            show: { plot: best.i },
        });
    }
    if (free < 0 && hallCost && G.hall.build <= 0) {
        const hs = shortBy(G, hallCost);
        add(8, { id: 'hall', icon: '🏛️', title: 'Upgrade the Town Hall', can: !hs, text: `More plots to build on.${hs ? ` Need ${hs} more.` : ''}`, show: { panel: 'hall' } });
    }

    // 9. nothing pressing
    add(10, {
        id: 'wait', icon: '⏩', title: 'Speed up time', can: true,
        text: 'Nothing urgent. Speed up time (2× or 3×) or sleep until morning (☾) while the town works. Keep tapping bubbles as they appear.',
        show: null,
    });

    // what can be done now comes before what has to be saved for, within the same priority
    out.sort((a, b) => a.pri - b.pri || (b.can - a.can));
    return out;
}

const FREE = /^(collect|oven|staff|deliver:)/;   // goals that cost nothing (a delivery is paid for by the quest)

/**
 * What a player following the tips does right now: the top goal when it's doable, otherwise (while saving up for
 * it) only the free things, so the savings aren't frittered away. The tests check this is never empty for long.
 */
export function doableGoal(G) {
    const goals = nextGoals(G).filter((g) => g.id !== 'wait');
    if (goals[0]?.can) return goals[0];
    return goals.find((g) => g.can && FREE.test(g.id)) || null;
}
