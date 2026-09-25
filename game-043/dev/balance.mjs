/**
 * balance.mjs — win rates and HP left for a player of a given level/gear against each region's
 * monster groups (1–3), fighting sensibly (guard telegraphed big hits, eat a tonic when low).
 *   node dev/balance.mjs
 */
import { Game } from '../js/sim/index.js';
const look = { skin: 1, hair: 1, hairColor: 1, eyes: 1, top: 1, bottom: 1, acc: 0 };
const kits = [
    { tag: 'R1 fresh (Lv1, wood sword)', r: 1, lv: 1, w: 'wood_sword', a: 'tunic', tonics: 0 },
    { tag: 'R1 Lv3 copper', r: 1, lv: 3, w: 'copper_sword', a: 'tunic', tonics: 1 },
    { tag: 'R2 Lv6 copper+vest', r: 2, lv: 6, w: 'copper_sword', a: 'leather_vest', tonics: 1 },
    { tag: 'R3 Lv9 iron', r: 3, lv: 9, w: 'iron_sword', a: 'iron_mail', tonics: 1 },
    { tag: 'R4 Lv12 gold', r: 4, lv: 12, w: 'gold_sword', a: 'iron_mail', tonics: 1 },
    { tag: 'R5 Lv15 gold', r: 5, lv: 15, w: 'gold_sword', a: 'gold_mail', tonics: 1 },
];
for (const K of kits) {
    for (const n of [1, 2, 3]) {
        let wins = 0, hpLeft = 0, rounds = 0;
        const N = 60;
        for (let t = 0; t < N; t++) {
            const g = Game.create({ seed: 1000 + t, name: 'B', look });
            Object.assign(g.p, { level: K.lv }); g.p.equip.weapon = K.w; g.p.equip.armor = K.a; g.refreshStats(); g.p.hp = g.p.maxHp; g.p.sp = g.p.maxSp;
            g.give('tonic', K.tonics, true);
            const pool = g.byRegion[K.r];
            const B = g.startBattle(Array.from({ length: n }, (_, k) => ({ sp: pool[(t + k) % pool.length] })), { region: K.r });
            let r = 0;
            while (!B.over && r++ < 60) {
                const P = B.allies[0];
                if (P.hp < P.maxHp * 0.35 && g.count('tonic')) g.battleAct({ type: 'item', id: 'tonic' });
                else if (B.foes.some(f => f.hp > 0 && f.intent === 'unleash') && P.hp < P.maxHp * 0.7) g.battleAct({ type: 'guard' });
                else if (n > 1 && g.p.level >= 4 && P.sp >= 5) g.battleAct({ type: 'skill', skill: 'whirl' });
                else g.battleAct({ type: 'attack' });
            }
            if (B.over === 'win') { wins++; hpLeft += B.allies[0].hp / B.allies[0].maxHp; }
            rounds += r;
        }
        console.log(`${K.tag.padEnd(28)} vs ${n}: win ${(wins / N * 100).toFixed(0).padStart(3)}%  hp left ${(hpLeft / Math.max(1, wins) * 100).toFixed(0).padStart(3)}%  rounds ${(rounds / N).toFixed(1)}`);
    }
}
