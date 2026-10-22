// Villagers: who lives in each town, deterministic from the game seed. State (quests, arcs) lives in G.quests, not here.

import { makeRng, hashStr } from '../rng.js';
import { FIRST, LAST, SKINS, HAIRS, STYLES, CLOTHS, PERSONALITIES, ARCS } from './data/npcdata.js';
import { LOCS, TOWNS } from './world/locations.js';

const cache = new Map();

export function townNpcs(seed, townId, map) {
    const key = `${seed}:${townId}`;
    if (cache.has(key)) return cache.get(key);
    const L = LOCS[townId];
    const rng = makeRng(hashStr(`npc:${seed}:${townId}`));
    const used = new Set();
    const slots = rng.shuffle([...map.slots]);
    const placed = [];
    const out = [];
    const nameOf = () => { for (let k = 0; k < 20; k++) { const n = `${rng.pick(FIRST)} ${rng.pick(LAST)}`; if (!used.has(n)) { used.add(n); return n; } } return `Villager ${used.size}`; };
    const spot = () => { for (const s of slots) if (placed.every((p) => Math.hypot(p[0] - s[0], p[1] - s[1]) > 3.2)) { placed.push(s); return s; } const s = slots[rng.int(0, slots.length - 1)]; placed.push(s); return s; };
    const palette = CLOTHS[L.theme];
    const arcs = ARCS.map((a) => a.id);
    // two storylines per town, a different pair per game
    rng.shuffle(arcs);
    const arcPair = [arcs[(TOWNS.indexOf(townId) * 2) % arcs.length], arcs[(TOWNS.indexOf(townId) * 2 + 1) % arcs.length]];
    for (let k = 0; k < 9; k++) {
        const personality = k === 0 ? 'elder' : k === 1 ? 'child' : k === 2 ? 'child' : rng.pick(PERSONALITIES.filter((p) => p !== 'child' && p !== 'elder'));
        const child = personality === 'child', old = personality === 'elder';
        const [cloth, cloth2] = rng.pick(palette);
        const s = spot();
        out.push({
            id: `${townId}:n${k}`, name: nameOf(), personality, x: s[0] + 0.5, y: s[1] + 0.5, wander: child ? 4 : 2.5, speed: child ? 1.6 : 1.0,
            arc: k >= 3 && k <= 4 ? arcPair[k - 3] : null, kind: 'npc',
            look: { skin: rng.pick(SKINS), hair: old ? '#d8d8d8' : rng.pick(HAIRS), style: rng.pick(STYLES), cloth, cloth2, trim: rng.pick(['#ffd35c', '#c8c8d0', '#e08040']), build: child ? 'child' : old ? 'old' : 'norm', hat: rng() < 0.2 ? 'cap' : null, beard: old && rng() < 0.6 ? '#d8d8d8' : null },
        });
    }
    cache.set(key, out);
    return out;
}
