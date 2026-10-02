/**
 * balance.mjs — a bot plays the real combat engine and rules headlessly and
 * reports how long the first Wyrm kills take, how often it dies, and where.
 *   node game-053/dev/balance.mjs [runs=20] [dks=3]
 * The bot is sensible, not perfect: it heals below 60%, banks its gold, buys
 * the best gear it can afford, thrill-seeks when its gear outclasses its
 * level, challenges its master when ready, and faces the Wyrm at full health.
 */
import { R } from '../js/rng.js';
import * as S from '../js/engine/state.js';
import { startFight, playRound, useSkill, endFight } from '../js/engine/combat.js';
import { creatureFor, WYRM } from '../js/data/creatures.js';
import { masterStats, SPECIALTIES } from '../js/data/classes.js';
import { GEAR_COST } from '../js/data/items.js';

const runs = +(process.argv[2] || 20), targetDk = +(process.argv[3] || 3);
const healCost = (p, amt) => Math.round(Math.log(p.level + 1) * (amt + 10) * (1 + p.dk * 0.03));

function fight(p, foe, type) {
    startFight(p, type, foe);
    const sp = SPECIALTIES[p.spec];
    for (let i = 0; i < 300 && !p.fight.over; i++) {
        const sk = [...sp.skills].reverse().find((s) => p.specLevel >= s.need && p.specUses >= s.cost);
        if (sk && (type !== 'forest' || p.hp < S.maxHp(p) * 0.5)) useSkill(p, sk.id); else playRound(p);
    }
    const r = p.fight.result, taken = p.fight.taken;
    endFight(p); p.fight = null;
    return { r, taken };
}

function shop(p) {
    const total = p.gold + p.bank;
    for (const k of ['weapon', 'armor']) {
        for (let lvl = 15; lvl > p[k]; lvl--) {
            const net = GEAR_COST[lvl - 1] - (p[k] ? Math.round(GEAR_COST[p[k] - 1] * 0.75) : 0);
            if (net <= total * 0.48 && lvl <= p.level + 2) { p.bank -= net; p[k] = lvl; break; }
        }
    }
}

const results = [];
for (let run = 0; run < runs; run++) {
    R.seed(1000 + run);
    const p = S.newPlayer({ name: 'Bot', sex: 'n', race: ['human', 'elf', 'dwarf', 'troll', 'halfling'][run % 5], spec: ['shadow', 'arcane', 'thief'][run % 3], slot: 0 });
    let day = 0, deaths = 0, dkDays = [], lastDk = 0, deathsByLevel = {}, wyrmTries = 0;
    while (p.dk < targetDk && day < 400) {
        day++;
        p.turns = S.turnsPerDay(p); p.specUses = S.maxSpecUses(p); p.hp = S.maxHp(p); p.flags = {}; p.buffs = [];
        p.alive = true;
        if (p.bank > 0) p.bank += Math.min(Math.round(p.bank * 0.035), 400 + p.level * 250 + p.dk * 100);
        // master
        while (p.level < 15 && p.exp >= S.nextExp(p) && !p.flags.master) {
            p.hp = S.maxHp(p);
            const st = masterStats(p.level);
            const { r } = fight(p, { name: 'Master', weapon: 'x', level: st.level, maxhp: st.hp, atk: st.atk, def: st.def }, 'master');
            if (r === 'win') { p.level++; p.specLevel++; p.hp = S.maxHp(p); } else { p.flags.master = true; p.hp = S.maxHp(p); }
        }
        shop(p);
        // wyrm
        if (p.level >= 15) {
            p.hp = S.maxHp(p); wyrmTries++;
            const sc = 1 + p.dk * 0.04;
            const { r } = fight(p, { ...WYRM, maxhp: Math.round(WYRM.hp * sc), atk: Math.round(WYRM.atk * sc), def: Math.round(WYRM.def * sc) }, 'wyrm');
            if (r === 'win') {
                p.dk++; dkDays.push(day - lastDk); lastDk = day;
                p.dkBonus[['hp', 'atk', 'def', 'turns'][p.dk % 4]]++;
                p.level = 1; p.exp = 0; p.weapon = 0; p.armor = 0; p.gold = 50; p.bank = Math.round(p.bank * 0.5);
                continue;
            }
            deaths++; deathsByLevel.wyrm = (deathsByLevel.wyrm || 0) + 1; p.exp = Math.round(p.exp * 0.9); continue;
        }
        // forest
        while (p.turns > 0 && p.alive) {
            p.turns--;
            if (p.hp < S.maxHp(p) * 0.6) { const amt = S.maxHp(p) - p.hp; const c = healCost(p, amt); if (p.bank + p.gold >= c) { p.bank -= c; p.hp = S.maxHp(p); } }
            const strong = p.weapon >= p.level + 1 && p.armor >= p.level + 1;
            const lvl = Math.min(16, p.level + (strong ? 1 : 0));
            const foe = creatureFor(lvl, R, p.dk);
            if (strong) foe.exp = Math.round(foe.exp * 1.25);
            const { r, taken } = fight(p, foe, 'forest');
            if (r === 'win') { p.exp += foe.exp; p.bank += Math.round(foe.gold * (p.race === 'dwarf' ? 1.2 : 1)); if (taken === 0) p.turns++; }
            else { p.alive = false; deaths++; deathsByLevel[p.level] = (deathsByLevel[p.level] || 0) + 1; p.exp = Math.round(p.exp * 0.9); }
        }
    }
    results.push({ race: p.race, spec: p.spec, dkDays, deaths, deathsByLevel, wyrmTries, day });
}
const first = results.map((r) => r.dkDays[0]).filter(Boolean);
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—');
console.log(`runs: ${runs}`);
console.log(`days to the 1st Wyrm kill: avg ${avg(first)}, min ${Math.min(...first)}, max ${Math.max(...first)}`);
for (let k = 1; k < targetDk; k++) console.log(`days for Wyrm kill #${k + 1}: avg ${avg(results.map((r) => r.dkDays[k]).filter(Boolean))}`);
console.log(`deaths per run: avg ${avg(results.map((r) => r.deaths))}; Wyrm attempts per run: avg ${avg(results.map((r) => r.wyrmTries))}`);
const dl = {}; for (const r of results) for (const [k, v] of Object.entries(r.deathsByLevel)) dl[k] = (dl[k] || 0) + v;
console.log('deaths by level:', JSON.stringify(dl));
const by = {}; for (const r of results) (by[r.spec] ||= []).push(r.dkDays[0]);
console.log('1st kill by specialty:', Object.entries(by).map(([k, v]) => `${k} ${avg(v.filter(Boolean))}`).join(', '));
