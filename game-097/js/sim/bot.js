// An auto-player. It plays through act() like the player does: it summons, picks a party, starts the
// next chapter and fights it with the same brain the enemy uses. The tests, the balance table and
// an attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.

import { GACHA, PARTY_MAX } from '../config.js';
import { power } from './data.js';
import { nextChapter } from './game.js';
import { bestForTeam } from './ai.js';

export function makeBot({ summon = true, farm = true } = {}) {
    return { summon, farm, failures: {}, lastCh: -1, farming: false };
}

export function botInput(G, bot) {
    const m = G.meta, B = G.battle;
    if (!B) {
        if (bot.summon && m.shards >= GACHA.single) return { cmd: { t: 'summon', n: m.shards >= GACHA.ten ? 10 : 1 } };
        const want = m.roster.slice().sort((a, b) => power(b) - power(a)).slice(0, PARTY_MAX).map((r) => r.rid);
        if (want.join() !== m.party.join()) return { cmd: { t: 'party', rids: want } };
        let ch = nextChapter(G);
        // after a defeat, level up on an earlier chapter before trying again
        if (bot.farm && (bot.failures[ch] || 0) > 0 && bot.farming === false && ch > 0) { bot.farming = true; ch -= 1; } else bot.farming = false;
        bot.lastCh = ch;
        return { cmd: { t: 'start', ch } };
    }
    if (B.over) {
        if (B.over === 'lose') bot.failures[B.ch] = (bot.failures[B.ch] || 0) + 1;
        return { cmd: { t: 'leave' } };
    }
    if (B.phase !== 'p') return {};
    const best = bestForTeam(G, 'p');
    return { cmd: best ? best.cmd : { t: 'end' } };
}
