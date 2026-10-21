// balance.mjs — bots play whole games and print a table. SEEDS=n SKILL=1 LEN=standard CLS=knight
import { newGame, act, score, rank } from '../js/sim/game.js';
import { GEAR } from '../js/sim/data.js';
import { makeBot, botAction } from '../js/sim/bot.js';
const SEEDS = +(process.env.SEEDS || 12);
const skills = (process.env.SKILL || '1,0.5').split(',').map(Number);
const classes = (process.env.CLS || 'knight,ranger,mage').split(',');
const LEN = process.env.LEN || 'standard';
export function playGame(seed, cls, skill, len = LEN) {
    const G = newGame(seed, { cls, length: len, name: 'Bot' });
    const bot = makeBot({ skill, seed });
    let n = 0, err = null;
    const trace = { lvAtLap: {}, dragonLv: 0, maxEnemyLv: 0 };
    while (!G.over && n < 20000) {
        const a = botAction(G, bot);
        const why = act(G, a);
        if (why) { err = `${G.phase}: ${JSON.stringify(a)} → ${why}`; break; }
        for (const e of G.events) { if (e.type === 'b_end' && G.battle?.kind === 'dragon') { trace.dragonRounds = (trace.dragonRounds || []).concat(G.battle.round); } if (e.type === 'b_end' && G.battle?.kind !== 'dragon') { trace.rounds = (trace.rounds || 0) + G.battle.round; trace.nb = (trace.nb || 0) + 1; } }
        for (const e of G.events) if (e.type === 'lap') trace.lvAtLap[e.lap - 1] = G.level + '/' + G.gold;
        G.events.length = 0;
        n++;
    }
    return { G, n, err, trace };
}
if (process.argv[1].endsWith('balance.mjs')) {
    for (const skill of skills) for (const cls of classes) {
        const rows = [];
        for (let s = 1; s <= SEEDS; s++) rows.push(playGame(s * 7919, cls, skill));
        const wins = rows.filter((r) => r.G.over === 'win').length;
        const avg = (f) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(1);
        console.log(`${cls.padEnd(7)} skill ${skill}: win ${wins}/${SEEDS} · lv ${avg((r) => r.G.level)} · turns ${avg((r) => r.G.turn)} · battles ${avg((r) => r.G.stats.battles)} · ko ${avg((r) => r.G.stats.ko)} · shards ${avg((r) => r.G.shards.length)} · gold ${avg((r) => r.G.gold)} · deeds ${avg((r) => Object.values(r.G.deeds).filter((d) => d.owner === 'you').length)} · party ${avg((r) => r.G.party.length)} · tries ${avg((r) => r.G.dragon.tries)} · tier ${avg((r) => r.G.party.reduce((a, m) => a + (GEAR[m.gear.weapon]?.tier || 0) + (GEAR[m.gear.armor]?.tier || 0), 0) / r.G.party.length / 2)} · bane ${rows.filter((r) => JSON.stringify(r.G.party).includes('dragonbane')).length}`);
        const kb = {}; for (const r of rows) for (const [k, v] of Object.entries(r.G.stats.koBy || {})) kb[k] = (kb[k] || 0) + v;
        console.log('   rounds/battle', avg((r) => (r.trace.rounds || 0) / (r.trace.nb || 1)), 'dragon rounds', rows.map((r) => (r.trace.dragonRounds || []).join('+')).join(' '));
        console.log('   ko by', JSON.stringify(kb), 'lv by lap', JSON.stringify(rows[0].trace.lvAtLap), rows.find((r) => r.err)?.err || '');
    }
}
