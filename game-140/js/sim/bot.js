// An auto-player. It reads the story the way a player would (the choices on offer and what they do) and acts only
// through act(), so the tests, the route checks and the attract demo all exercise the real game. Pure.
//
// policy 'kind'   takes the choice that gives the most hope, mercy and bond
// policy 'harsh'  takes the one that gives the least (defiance, fire, leaving people in the sea)
// policy 'random' picks with the seeded rng
// camp: an ordered list of companions to sit with when they are free. skill: chance a ward turn is the best one.

import { act, sceneLines, campChoices } from './game.js';
import { parseLine } from './scene.js';
import { hint } from './ward.js';
import { makeRng } from '../rng.js';

export function makeBot({ policy = 'kind', camp = ['aldwin', 'edda', 'kestrel', 'ione', 'caius'], skill = 1, seed = 7 } = {}) {
    return { policy, camp, skill, rng: makeRng(seed) };
}

function score(fx = '') {
    let s = 0;
    for (const m of fx.matchAll(/(hope|mercy|b\.\w+)\+(\d+)/g)) s += +m[2] * (m[1] === 'mercy' ? 2 : 1);
    if (/flag:(defied|burned|leftcaius|condemned|refusedcaius|harsh|threat)/.test(fx)) s -= 3;
    return s;
}

/** The command the bot would give now, or null if there is nothing to do. */
export function botCommand(G, bot) {
    if (G.phase === 'scene' && G.scene?.cur) {
        const cur = G.scene.cur;
        if (!cur.choice) return { t: 'advance' };
        const opts = parseLine(sceneLines(G)[G.scene.pc]).opts;
        let pick = cur.choice[0];
        if (bot.policy === 'random') pick = cur.choice[Math.floor(bot.rng() * cur.choice.length)];
        else {
            const sign = bot.policy === 'harsh' ? -1 : 1;
            let best = -Infinity;
            for (const c of cur.choice) { const s = sign * score(opts[c.i].fx); if (s > best) { best = s; pick = c; } }
        }
        return { t: 'choose', i: pick.i };
    }
    if (G.phase === 'ward' && G.ward) {
        if (G.ward.moves > 80) return { t: 'unseal' };
        if (bot.rng() < bot.skill) { const h = hint(G.ward); if (h) return { t: 'turn', ring: h.ring, dir: h.dir }; }
        return { t: 'turn', ring: Math.floor(bot.rng() * G.ward.rings.length), dir: bot.rng() < 0.5 ? 1 : -1 };
    }
    if (G.phase === 'camp') {
        const free = campChoices(G).map((c) => c.who);
        const who = bot.camp.find((w) => free.includes(w));
        return who ? { t: 'sit', who } : { t: 'sleep' };
    }
    if (G.phase === 'map') return { t: 'travel' };
    return null;
}

/** Play to the end (or `limit` commands). Returns the number of commands given. Throws if a command is refused. */
export function playThrough(G, bot, limit = 20000, onStep = null) {
    let n = 0;
    for (; n < limit && G.phase !== 'end'; n++) {
        const cmd = botCommand(G, bot);
        if (!cmd) throw new Error(`bot stuck in phase ${G.phase}`);
        if (!act(G, cmd)) throw new Error(`refused ${JSON.stringify(cmd)} in ${G.phase} ${G.scene?.id}`);
        if (onStep) onStep(G, cmd);
        G.events.length = 0;
    }
    return n;
}
