// Siege calibration: each invasion against a town with exactly its readiness checklist (towers level 1,
// adventurers level 2), defended by no aim, a sloppy aim (skill 0.3) and a sharp one (skill 1).
//   node game-143/dev/siege.mjs            SEEDS=4
import { newGame, step } from '../js/sim/game.js';
import { newBattle } from '../js/sim/battle.js';
import { makeBot, botInput } from '../js/sim/bot.js';
import { READY, ADV_ORDER } from '../js/sim/data.js';
import { STEP } from '../js/config.js';
import { resetWall } from '../js/sim/town.js';

export function readyTown(seed, wave, { extra = 0, advLvl = 2 } = {}) {
    const G = newGame(seed);
    G.phase = wave;
    const plots = [];
    const put = (kind, lvl = 1) => { const i = G.plots.findIndex((p) => !p.b); G.plots[i].b = { kind, lvl, build: 0, up: false }; plots.push(i); };
    G.hall.lvl = 3;
    for (const [k, v] of READY[wave]) {
        if (k === 'wall') { G.wall.lvl = v; resetWall(G); }
        if (k === 'towers') for (let i = 0; i < v + extra; i++) put('tower', 1 + Math.min(1, extra));
        if (k === 'advs') for (let i = 0; i < v + extra && i < ADV_ORDER.length; i++) { G.advs[ADV_ORDER[i]].hired = true; G.advs[ADV_ORDER[i]].lvl = advLvl; }
        if (k === 'build') put(v);
        if (k === 'bake') G.bake.pct = v;
    }
    put('tavern', 3); put('tailor', 1 + Math.min(wave, 2)); if (wave >= 1) put('bell', Math.min(wave, 2));
    const joinByWave = [['vellum', 'pip', 'silk', 'grizelda'], ['gerald', 'wick'], [], []];
    for (let w = 0; w <= wave; w++) for (const id of joinByWave[w]) G.staff[id].joined = true;
    G.hope = 55 + 5 * wave;
    return G;
}

export function fight(G, skill, seed) {
    G.mode = 'battle'; G.battle = newBattle(G);
    const B = G.battle, bot = skill == null ? null : makeBot({ skill, seed });
    while (!B.result && B.t < 400) {
        const inp = bot ? botInput(G, bot, STEP) : { ax: 0, aim: null, fire: false };
        step(G, inp, STEP);
        G.events.length = 0;
    }
    return { result: B.result, wall: Math.round(100 * B.wall.hp / B.wall.max), t: Math.round(B.t), hits: B.wallHits };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const SEEDS = +(process.env.SEEDS || 4);
    for (let wave = 0; wave < 4; wave++) {
        for (const [label, skill] of [['idle', null], ['0.3', 0.3], ['0.6', 0.6], ['1', 1]]) {
            const rows = [];
            for (let s = 1; s <= SEEDS; s++) {
                const G = readyTown(s * 31, wave);
                if (wave === 3) G.bake.pct = 99;   // no Queen: the King wave must be survived until he withdraws
                rows.push(fight(G, skill, s));
            }
            console.log(`wave ${wave} ${label.padEnd(4)} ` + rows.map((r) => `${r.result.slice(0, 3)} ${String(r.wall).padStart(3)}%`).join('  '));
        }
    }
}
