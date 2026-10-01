/**
 * duel.mjs — quick class-vs-monster balance probe (no town, no gear beyond the forge).
 *
 *   node game-050/dev/duel.mjs                  levels 1,5,10…30 × both classes, 40 fights each
 *   N=100 RANK=guardian node game-050/dev/duel.mjs
 *
 * Each hero is levelled with the bot's stat allocation and given a forged item per slot
 * at its level (rarity 'magic'), roughly what a player has on hand. Reports win %, turns,
 * HP lost and the hero's damage per turn.
 */
import { newProfile, gainXp, autoAllocate, heroSide } from '../js/sim/game.js';
import { makeMonster, FAMILY_IDS } from '../js/sim/monsters.js';
import { makeBattle, doSwap, doCast, doPotion, monsterTurn } from '../js/sim/battle.js';
import { botBattleAction } from '../js/sim/bot.js';
import { makeItem, SLOTS } from '../js/sim/items.js';
import { findMoves } from '../js/sim/board.js';
import { makeRng } from '../js/sim/rng.js';
import { xpToNext } from '../js/sim/data.js';

const N = +(process.env.N || 40);
const RANK = process.env.RANK || 'normal';
const LEVELS = (process.env.LEVELS || '1,5,10,15,20,25,30').split(',').map(Number);

for (const cls of ['mage', 'warrior']) {
    console.log(`\n${cls} vs ${RANK}`);
    console.log('  lvl  win%  turns  hpLost%  dmg/turn  heroHP  monHP');
    for (const L of LEVELS) {
        const p = newProfile({ cls, seed: 5 });
        while (p.level < L) gainXp(p, xpToNext(p.level));
        autoAllocate(p);
        const r = makeRng(L * 31);
        for (const s of SLOTS) p.gear[s] = makeItem(r, { cls, slot: s, iL: L, rarity: 1, uid: 900 + SLOTS.indexOf(s) });
        let wins = 0, turns = 0, lost = 0, dmg = 0, ptTurns = 0, mhp = 0;
        for (let i = 0; i < N; i++) {
            const mon = makeMonster(makeRng(L * 1000 + i), { level: L, family: FAMILY_IDS[i % FAMILY_IDS.length], rank: RANK });
            mhp += mon.side.maxHp;
            const bt = makeBattle(heroSide(p), mon.side, 99 + i * 7 + L);
            let n = 0;
            while (!bt.over && n++ < 1500) {
                if (bt.turn === 'p') {
                    ptTurns++;
                    const a = botBattleAction(bt);
                    let ev = [];
                    if (a.potion) ev = doPotion(bt, a.potion);
                    else if (a.cast !== undefined) ev = doCast(bt, a.cast);
                    if (!ev.length) { const mv = a.move || findMoves(bt.board)[0]; ev = doSwap(bt, mv.a, mv.b); }
                    for (const e of ev) if (e.k === 'dmg' && e.side === 'e') dmg += e.n + e.absorbed;
                } else monsterTurn(bt);
            }
            if (bt.over === 'win') wins++;
            turns += bt.turnNo;
            lost += 1 - bt.sides.p.hp / bt.sides.p.maxHp;
        }
        const hs = heroSide(p);
        console.log(`  ${String(L).padStart(3)}  ${String(Math.round(100 * wins / N)).padStart(4)}  ${String(Math.round(turns / N)).padStart(5)}  ${String(Math.round(100 * lost / N)).padStart(7)}  ${String(Math.round(dmg / ptTurns)).padStart(8)}  ${String(hs.maxHp).padStart(6)}  ${String(Math.round(mhp / N)).padStart(5)}`);
    }
}
