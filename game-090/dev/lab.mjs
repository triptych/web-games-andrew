// Shared by the balance scripts: build a ready party at a level and chapter, and fight a boss with the bot.
import { newGame, startBattle, BOSSES } from '../js/sim/game.js';
import { makeBot, botTick } from '../js/sim/bot.js';
import { newDaemon, calc } from '../js/sim/units.js';
import { wildList } from '../js/sim/data/daemons.js';
import { GEAR } from '../js/sim/data/items.js';

/** A game in the hub with an Agent and three daemons at `lv`, gear and items as a player at `chapter` would have. */
export function setup(seed, lv, chapter) {
    const G = newGame(seed, { name: 'Lab' });
    G.scene = null; G.phase = 'hub'; G.chapter = chapter;
    G.agent.lv = lv;
    G.items = { patch: 6, kit: chapter >= 1 ? 4 : 3, sap: 3, seed: 2, smoke: 0, honey: 1 };
    const cap = [500, 500, 1700, 1700, 4000, 4000, 9500, 9500][Math.min(7, chapter)];
    for (const slot of ['blade', 'sidearm', 'coat', 'charm']) {
        const g = Object.values(GEAR).filter((x) => x.slot === slot && x.price <= cap).sort((a, b) => b.price - a.price)[0];
        G.gear[slot] = g.id;
    }
    G.agent.skills = ['snapshot', 'slash', 'mend', 'scan', 'overclock', 'cinder', 'frostbite', 'spark', 'gust', 'glimmer'];
    if (lv >= 15) G.agent.skills.splice(9, 1, 'blaze');
    const cands = wildList().sort((a, b) => Math.abs(a.lv - lv) - Math.abs(b.lv - lv)).slice(0, 14);
    for (let i = 0; i < 3; i++) {
        const p = cands[(Math.abs(Math.imul(seed + 7, 2654435761)) % 997 + i * 5) % cands.length];
        const u = newDaemon(G, p.id, lv); G.stock.push(u); G.party.push(u.uid);
    }
    for (const u of [G.agent, ...G.stock]) { const c = calc(G, u); u.hp = c.maxhp; u.mp = c.maxmp; }
    return G;
}

export function fightBoss(G, id, skill = 1, trace = null) {
    const spec = BOSSES[id];
    startBattle(G, { kind: spec.kind || 'boss', tag: id, foes: spec.foes.map((f) => ({ ...f })), waves: spec.waves, canFlee: false });
    const bot = makeBot({ skill, seed: G.seed });
    let n = 0, last = 0;
    while (G.phase === 'battle' && n++ < 4000) {
        botTick(G, bot);
        const B = G.battle;
        if (trace && B && B.round !== last) { last = B.round; trace(B); }
        G.events.length = 0;
    }
    return { win: G.phase === 'reward', round: G.battle ? G.battle.round : 0 };
}
