// An auto-player for the whole game: it runs the town through act() and defends the wall through the same
// input the player uses. The tests use it to prove the story can be finished, the balance table uses its skill
// dial, and the title screen could use it as a demo. Pure, like the rest of js/sim.
//
// skill in [0, 1]: how often the mayor looks in on the town, how well she aims, and whether she remembers
// the abilities. A skill-1 bot plays like an attentive player; 0.3 like someone half watching.

import { DAY_LEN, DOILY } from '../config.js';
import { BUILDINGS, ADV_ORDER, ADVENTURERS, ABILITY_ORDER, STAFF, READY } from './data.js';
import {
    plotsOpen, countOf, hasAny, costOf, canAfford, housing, workersNeeded, advSlots, advsHired, trainCost, rates, finished,
} from './town.js';
import { questDef, needsDeliver, deliverCost, objectiveMet, act } from './game.js';
import { readiness, liveEnemies } from './battle.js';
import { ENEMIES } from './data.js';
import { hash3 } from '../rng.js';

/** pace: seconds between town turns for a skill-1 bot (story mode slows it down so the town is watchable). */
export function makeBot({ skill = 1, seed = 7, pace = 1.5 } = {}) {
    return { skill, seed, pace, think: 0, n: 0, aim: 55, aimT: 0, abilT: 0 };
}

/** Story mode: the bot runs only the town, through the same commands, and leaves the wall to the player. */
export function storyTurn(G, bot, dt) {
    if (G.mode !== 'town' || G.over) return;
    bot.think -= dt;
    if (bot.think > 0) return;
    bot.n++;
    bot.think = bot.pace;
    townTurn(G, bot);
}

// a stateless coin for the bot, so it never consumes the game's random stream
const coin = (bot, k) => hash3(bot.seed, bot.n, k);

/** Spend a little, keep a little: never drop below this buffer for nice-to-haves. */
const buffer = (G) => ({ gold: 30 + 10 * G.phase, flour: 15, sugar: 15, stone: 10 });
const affordWithBuffer = (G, cost) => canAfford(G, Object.fromEntries(Object.entries(buffer(G)).map(([k, v]) => [k, (cost[k] || 0) + v])));

function freePlot(G) {
    for (let i = 0; i < plotsOpen(G); i++) if (!G.plots[i].b) return i;
    return -1;
}

function tryBuild(G, kind) {
    const p = freePlot(G);
    if (p < 0) return false;
    return act(G, { t: 'build', plot: p, kind });
}

function tryUpgrade(G, kind, maxLvl = 3, withBuffer = true) {
    const cands = G.plots.map((p, i) => ({ p, i })).filter(({ p }) => p.b && p.b.kind === kind && p.b.lvl < maxLvl && !(p.b.build > 0))
        .sort((a, b) => a.p.b.lvl - b.p.b.lvl);
    for (const { p, i } of cands) {
        const cost = costOf(kind, p.b.lvl + 1);
        if (withBuffer ? affordWithBuffer(G, cost) : canAfford(G, cost)) return act(G, { t: 'upgrade', plot: i });
    }
    return false;
}

/** One planning pass over the town. Does at most a few things, like a player would. */
function townTurn(G, bot) {
    act(G, { t: 'collectAll' });   // pop every ripe bubble on the way past
    const r = rates(G);
    // kinds to build, in tiers: the engine, room for workers, the siege checklist, quests, extras
    const engine = [], homes = [], main = [], ready = [], quests = [], extras = [];
    if (!hasAny(G, 'bakery')) engine.push('bakery');
    if (!hasAny(G, 'mill') || (r.flour < 0.1 && G.res.flour < 40)) engine.push('mill');
    if (!hasAny(G, 'beets') || (r.sugar < 0.1 && G.res.sugar < 40)) engine.push('beets');
    if (!hasAny(G, 'quarry') || (r.stone < 0.15 && G.res.stone < 100)) engine.push('quarry');
    // a second (third...) bakery once the inputs are piling up
    // (a third or more only once the story's buildings are in: bakeries must not crowd out the tower and the oven)
    const moreBakery = r.flour > 0.45 && r.sugar > 0.3 && G.res.flour > 60 && G.res.sugar > 40;
    if (housing(G) < workersNeeded(G) + 2) (G.pop < workersNeeded(G) * 0.85 ? engine : homes).unshift(G.unlocks.ginger ? 'gingerhome' : 'cottage');

    const checklist = readiness(G, Math.min(G.phase, 3));
    for (const it of checklist) {
        if (it.ok) continue;
        if (it.k === 'towers') ready.push('tower');
        if (it.k === 'build') ready.push(it.v);
        if (it.k === 'wall') act(G, { t: 'wall' });
        if (it.k === 'advs' && !hasAny(G, 'tavern')) ready.push('tavern');
    }
    if (G.phase >= 4 && countOf(G, 'tower') < 4) ready.push('tower');

    // quests: deliver what we can, build what they ask for
    for (const id of [...G.quests.active]) {
        const q = questDef(id);
        if (needsDeliver(q) && objectiveMet(G, q) && !G.quests.paid[id] && canAfford(G, deliverCost(q))) act(G, { t: 'deliver', id });
        if (q.obj.kind === 'build') {
            for (const k of [q.obj.what, q.obj.and]) if (k && countOf(G, k) < (q.obj.n || 1) && !hasAny(G, k)) (q.main ? main : quests).push(k);
            if (q.obj.n && countOf(G, q.obj.what) < q.obj.n) quests.push(q.obj.what);
        }
        if (q.obj.kind === 'lvl') tryUpgrade(G, q.obj.what, q.obj.lvl, false);
        if (q.obj.kind === 'wall' && G.wall.lvl < q.obj.lvl) act(G, { t: 'wall' });
    }
    if (!hasAny(G, 'market') && G.pop >= 10) extras.push('market');
    if (moreBakery) (countOf(G, 'bakery') < 2 ? engine : extras).push('bakery');
    if (!hasAny(G, 'tailor') && G.phase >= 1) extras.push('tailor');
    if (!hasAny(G, 'bell') && G.phase >= 1) extras.push('bell');
    const want = [...engine, ...main, ...homes, ...ready, ...quests, ...extras].filter((k) => !(BUILDINGS[k].unique && hasAny(G, k)));
    // a full town makes room: knock down a spare level-1 producer or an empty-ish cottage
    if (want.length && freePlot(G) < 0 && (G.hall.lvl >= 3 || G.hall.build > 0)) {
        const spare = G.plots.findIndex((p) => p.b && p.b.lvl === 1 && !(p.b.build > 0) && ['mill', 'beets', 'quarry'].includes(p.b.kind)
            && G.plots.filter((q) => q.b && q.b.kind === p.b.kind).length > 1);
        if (spare >= 0) act(G, { t: 'demolish', plot: spare });
    }

    let saving = false;   // something we want and can't afford yet: no frills until it's built
    for (const k of want) {
        const def = BUILDINGS[k];
        if (!def || (def.unique && hasAny(G, k))) continue;
        if (freePlot(G) < 0) break;
        if (tryBuild(G, k)) { saving = true; break; }
        if (!canAfford(G, costOf(k))) {
            // short of something nobody makes yet? build what makes it first
            const cost = costOf(k), maker = { stone: 'quarry', flour: 'mill', sugar: 'beets' };
            for (const r in maker) if ((cost[r] || 0) > G.res[r] && !hasAny(G, maker[r]) && tryBuild(G, maker[r])) return;
            saving = true; break;
        }
    }

    // more room
    if (freePlot(G) < 0 && G.hall.lvl < 3 && G.hall.build <= 0) act(G, { t: 'hall' });

    // adventurers up to the checklist and beyond
    if (advsHired(G) < advSlots(G)) {
        for (const id of ADV_ORDER) {
            const a = G.advs[id], d = ADVENTURERS[id];
            if (a.hired || id === 'tobias') continue;
            if (G.res.gold >= d.cost + buffer(G).gold && act(G, { t: 'hire', adv: id })) break;
        }
    }
    if (advSlots(G) && advsHired(G) >= advSlots(G) && !hasAny(G, 'tavern') === false) tryUpgrade(G, 'tavern', 3);

    // the oven: lit whenever it can be fed, upgraded when the bake falls behind
    if (hasAny(G, 'oven')) {
        const lit = G.res.flour > 12 && G.res.sugar > 12 && G.bake.pct < 25 * G.bake.ings.length;
        if (lit !== G.oven.lit) act(G, { t: 'oven', on: lit });
        tryUpgrade(G, 'oven', 3);
    }

    // staff: everyone to the building they like best
    for (const id in G.staff) {
        const s = G.staff[id];
        if (!s.joined || s.at != null) continue;
        const aff = STAFF[id].aff;
        let plot = G.plots.findIndex((p, i) => p.b && p.b.kind === aff && !(p.b.build > 0 && !p.b.up) && !Object.values(G.staff).some((o) => o.at === i));
        if (plot < 0) plot = G.plots.findIndex((p, i) => p.b && ['bakery', 'market', 'mill', 'beets'].includes(p.b.kind) && !(p.b.build > 0) && !Object.values(G.staff).some((o) => o.at === i));
        if (plot >= 0) act(G, { t: 'assign', staff: id, plot });
    }

    if (saving) return;
    // surplus: upgrades that pay, then defence
    const order = ['tower', 'bakery', 'market', 'witch', 'tailor', 'bell'];
    if (r.flour < 0.2) order.push('mill');
    if (r.sugar < 0.2) order.push('beets');
    for (const k of order) if (tryUpgrade(G, k, G.phase >= 2 ? 3 : 2)) break;
    if (G.wall.lvl < 5 && affordWithBuffer(G, { gold: 200 })) act(G, { t: 'wall' });
    for (const id of ADV_ORDER) if (G.advs[id].hired && G.res.gold > trainCost(G.advs[id].lvl) + 150) { act(G, { t: 'train', adv: id }); break; }
}

/** The bot's input for one step; it may also act() (town decisions, abilities, the Queen). */
export function botInput(G, bot, dt = 1 / 120) {
    if (G.mode === 'town') {
        bot.think -= dt;
        if (bot.think <= 0) {
            bot.n++;
            // a sharp mayor checks in every couple of seconds; a distracted one every half day or so
            bot.think = (bot.pace ?? 1.5) + (1 - bot.skill) * (DAY_LEN * 0.4) * coin(bot, 1);
            townTurn(G, bot);
        }
        return { ax: 0, aim: null, fire: false };
    }
    const B = G.battle;
    if (!B || B.result) return { ax: 0, aim: null, fire: false };
    if (B.canQueen) act(G, { t: 'queen' });

    // aim: the foremost crowd, re-chosen after a reaction delay, with jitter that grows as skill falls
    bot.aimT -= dt;
    if (bot.aimT <= 0) {
        bot.n++;
        bot.aimT = 0.15 + (1 - bot.skill) * 0.9;
        const live = liveEnemies(B).filter((e) => !ENEMIES[e.kind].boss && e.x <= DOILY.range + 6);
        if (!live.length) bot.aim = DOILY.range;
        if (live.length) {
            let best = live[0], bestScore = -1;
            for (const e of live) {
                let near = 0;
                for (const o of live) if (Math.abs(o.x - e.x) < 5) near++;
                const score = near * 2 + (100 - e.x) / 10;
                if (score > bestScore) { bestScore = score; best = e; }
            }
            const spd = ENEMIES[best.kind].spd * (B.webT > 0 ? 0.5 : 1);
            const lead = best.block || best.x <= 3 ? 0 : spd * 0.35;
            bot.aim = best.x - lead + (coin(bot, 2) - 0.5) * 30 * (1 - bot.skill);
        }
    }
    // abilities when the wall is busy (a weak bot forgets them more often)
    bot.abilT -= dt;
    if (bot.abilT <= 0) {
        bot.n++;
        bot.abilT = 1 + (1 - bot.skill) * 4;
        const live = liveEnemies(B).filter((e) => !ENEMIES[e.kind].boss);
        const close = live.filter((e) => e.x < 30).length;
        if (close >= 4 && coin(bot, 3) < 0.4 + 0.6 * bot.skill) {
            for (const id of ABILITY_ORDER) if (B.abil[id] && B.abil[id].cd <= 0) { act(G, { t: 'ability', id }); break; }
        }
    }
    return { ax: 0, aim: bot.aim, fire: true };
}

export { finished };
