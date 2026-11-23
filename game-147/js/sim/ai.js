// The auto-battle brain: one function picks a command for a hero, under a preset. The test bot uses the same brain,
// so the balance tables measure the AI the player can switch on. Pure.
//
// Presets
//   aggressive — the hardest-hitting thing available every turn; MP spent freely; chains as soon as they're ready.
//   balanced   — heal anyone under 45%, hit weaknesses, keep 30% MP for emergencies, chain when ready.
//   conserve   — basic attacks unless a weakness or an emergency (under 30%) calls for MP; chains only when free.

import { SKILLS, CHAINS, HEROES, ITEMS } from './data.js';
import { heroesOf, enemiesOf, living, elemMul, chainOptions, stat } from './battle.js';
import { has } from './util.js';

export const PRESETS = {
    aggressive: { name: 'Aggressive', icon: '🔥', healAt: 0.3, mpKeep: 0, chain: 'ready' },
    balanced: { name: 'Balanced', icon: '⚖️', healAt: 0.45, mpKeep: 0.3, chain: 'ready' },
    conserve: { name: 'Conserve MP', icon: '💧', healAt: 0.3, mpKeep: 0.5, chain: 'free' },
};

/** Expected damage of a skill on a target (no randomness, used only to rank options). */
function estimate(G, a, S, t) {
    const atk = stat(G, a, S.stat || 'atk');
    const def = stat(G, t, 'def');
    let d = atk * (S.power || 0) * (S.hits || 1) * 2 * 50 / (50 + def) * elemMul(t, S.el);
    if (t.stagger) d *= 1.3;
    return d;
}

function chainPower(G, id) {
    return CHAINS[id].hits.reduce((s, h) => s + h[1] * (h[4] === 'all' ? 1.6 : 1), 0) * (1 + CHAINS[id].members.length * 0.2);
}

export function aiPick(G, a, presetId = 'balanced') {
    const P = PRESETS[presetId] || PRESETS.balanced;
    const B = G.battle;
    const party = living(heroesOf(B));
    const foes = living(enemiesOf(B));
    const skills = HEROES[a.id].skills.map((id) => [id, SKILLS[id]]).filter(([, S]) => S.mp <= a.mp);
    const mpOk = (S) => a.mp - S.mp >= a.mmp * P.mpKeep;

    // 1. chains
    const co = chainOptions(G);
    if (co.ready && co.list.length && (P.chain === 'ready' || co.free)) {
        const best = co.list.slice().sort((x, y) => chainPower(G, y) - chainPower(G, x))[0];
        const target = foes.find((e) => e.stagger && !e.chained) || foes.slice().sort((x, y) => x.hp - y.hp)[0];
        return { t: 'chain', chain: best, target: target?.id };
    }
    // 2. someone down and salts in the bag
    const down = heroesOf(B).find((h) => !h.alive);
    if (down && has(G, 'smellingSalts') && presetId !== 'aggressive') return { t: 'item', item: 'smellingSalts', target: down.id };
    // 3. heal
    const hurt = party.slice().sort((x, y) => x.hp / x.mhp - y.hp / y.mhp)[0];
    if (hurt && hurt.hp / hurt.mhp < P.healAt) {
        const many = party.filter((h) => h.hp / h.mhp < 0.6).length >= 2;
        const heal = skills.find(([, S]) => S.kind === 'heal' && (many ? S.target === 'allies' : true));
        if (heal) return { t: 'skill', skill: heal[0], target: hurt.id };
        if (has(G, 'honeyDrop') && hurt.hp / hurt.mhp < 0.3) return { t: 'item', item: 'honeyDrop', target: hurt.id };
    }
    // 4. a buff early in the fight (once), if MP allows
    if (presetId !== 'conserve' && B.turnCount < 6) {
        const buff = skills.find(([id, S]) => (S.kind === 'buff' || S.kind === 'debuff') && mpOk(S) && !B.log.includes(id));
        if (buff && foes.length >= 2) {
            const tgt = buff[1].target === 'ally' ? party.slice().sort((x, y) => stat(G, y, 'atk') + stat(G, y, 'mag') - stat(G, x, 'atk') - stat(G, x, 'mag'))[0] : null;
            return { t: 'skill', skill: buff[0], target: tgt?.id };
        }
    }
    // 5. damage: score every (skill, target), basic attack included
    let best = { score: -1, cmd: { t: 'attack', target: foes[0]?.id } };
    const options = [['attack', SKILLS.attack], ...skills.filter(([, S]) => S.kind === 'dmg' || S.kind === 'steal')];
    for (const [id, S] of options) {
        if (id !== 'attack' && !mpOk(S)) {
            // conserve still spends on a weakness
            if (!(presetId === 'conserve' && foes.some((t) => elemMul(t, S.el) > 1) && a.mp >= S.mp)) continue;
        }
        if (presetId === 'conserve' && id !== 'attack' && !foes.some((t) => elemMul(t, S.el) > 1)) continue;
        const targets = S.target === 'all' ? [foes] : foes.map((t) => [t]);
        for (const ts of targets) {
            let score = ts.reduce((s, t) => s + Math.min(t.hp, estimate(G, a, S, t)), 0);
            // finishing blows and breaking poise are worth a little extra
            for (const t of ts) { if (estimate(G, a, S, t) >= t.hp) score *= 1.15; if (elemMul(t, S.el) > 1 && !t.stagger) score *= 1.1; }
            score -= S.mp * (presetId === 'aggressive' ? 0.1 : 0.6);
            if (score > best.score) best = { score, cmd: id === 'attack' ? { t: 'attack', target: ts[0].id } : { t: 'skill', skill: id, target: ts[0].id } };
        }
    }
    return best.cmd;
}

export { ITEMS };
