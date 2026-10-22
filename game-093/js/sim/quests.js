// Quests: the board in every town and the storylines villagers carry. Generated on demand from the seed, then stored in G.quests.

import { makeRng, hashStr } from '../rng.js';
import { ENEMIES, ZONES } from './data/enemies.js';
import { ITEMS } from './data/items.js';
import { ARCS } from './data/npcdata.js';
import { LOCS, TOWNS } from './world/locations.js';
import { count, addItem, removeItem, avgLevel } from './party.js';

const NEAR_DUNGEON = { emberfield: ['woods'], silverbrook: ['woods', 'mines'], portazura: ['mines', 'temple'], dunehaven: ['temple', 'pyramid'], hoarhold: ['pyramid', 'glacier'] };

export function newQuestState() {
    return { active: [], done: {}, board: {}, boardGen: {}, arcStage: {}, arcDone: {}, kills: {}, nextId: 1, completed: 0 };
}

function zoneKinds(zoneKey) {
    const z = ZONES[zoneKey];
    return [...new Set(z.forms.flat())].filter((k) => !ENEMIES[k].boss);
}
const plural = (name) => (/s$/.test(name) ? name : name + 's');

function pickTask(G, rng, townId, type) {
    const L = LOCS[townId];
    const tier = L.tier;
    if (type === 'hunt') {
        const kinds = zoneKinds(L.zone);
        const kind = rng.pick(kinds);
        return { type: 'hunt', kind, n: rng.int(3, 5) + Math.floor(tier / 2), name: plural(ENEMIES[kind].name) };
    }
    if (type === 'fetch') {
        const mats = [...new Set(zoneKinds(L.zone).map((k) => ENEMIES[k].mat).filter(Boolean))];
        const item = rng.pick(mats);
        return { type: 'fetch', item, n: rng.int(2, 4), name: ITEMS[item].name };
    }
    if (type === 'recover') {
        const dungeon = rng.pick(NEAR_DUNGEON[townId]);
        return { type: 'recover', dungeon, spot: rng.int(0, 5), item: 'lostLocket', name: ITEMS.lostLocket.name };
    }
    // courier: someone in another town
    const other = rng.pick(TOWNS.filter((t) => t !== townId && LOCS[t].tier <= tier + 1));
    return { type: 'courier', town: other, npcIdx: rng.int(5, 8), item: 'sealedLetter', name: ITEMS.sealedLetter.name };
}

function rewardFor(G, rng, townId, task, scale = 1) {
    const tier = LOCS[townId].tier;
    const base = (45 + tier * 70) * scale;
    const n = task.n || 2;
    const gold = Math.round(base * (0.8 + n * 0.25) * (0.9 + rng() * 0.3));
    const items = [];
    const r = rng();
    if (tier >= 2 && r < 0.3) items.push(['hiPotion', 2]); else if (r < 0.55) items.push(['potion', 3]); else if (r < 0.75) items.push(['ether', 2]); else if (tier >= 1) items.push(['phoenixDown', 1]);
    return { gold, xp: Math.round((30 + tier * 60) * scale), items };
}

function describe(G, q) {
    const p = q.p;
    if (p.type === 'hunt') return `Defeat ${p.n} ${p.name}.`;
    if (p.type === 'fetch') return `Bring ${p.n} × ${p.name}.`;
    if (p.type === 'recover') return `Find the lost ${ITEMS[p.item].name} in ${LOCS[p.dungeon].name}.`;
    return `Deliver the letter to ${p.npcName} in ${LOCS[p.town].name}.`;
}

export function resolveCourierTarget(G, task, npcLookup) {
    const n = npcLookup(task.town)[Math.min(task.npcIdx, 8)];
    task.npcId = n.id; task.npcName = n.name;
}

let npcLookupFn = null;
export function setNpcLookup(fn) { npcLookupFn = fn; }

export function makeQuest(G, rng, townId, type, opts = {}) {
    const p = pickTask(G, rng, townId, type);
    if (p.type === 'courier') resolveCourierTarget(G, p, npcLookupFn);
    const q = { id: 0, town: townId, p, from: opts.from || 'board', arc: opts.arc || null, reward: opts.reward || rewardFor(G, rng, townId, p, opts.scale || 1), state: 'avail' };
    q.title = opts.title || ({ hunt: `Hunt: ${p.name}`, fetch: `Supplies: ${p.name}`, recover: `Lost and Found`, courier: `Special Delivery` })[p.type];
    q.text = describe(G, q);
    return q;
}

/** Four notices on a town's board, regenerated whenever the story moves on or the board has been emptied. */
export function ensureBoard(G, townId) {
    const Q = G.quests;
    const gen = G.story.i * 3 + Math.floor(Q.completed / 4);
    if (Q.board[townId] && Q.boardGen[townId] === gen) return Q.board[townId];
    const rng = makeRng(hashStr(`board:${G.seed}:${townId}:${gen}`));
    const types = rng.shuffle(['hunt', 'fetch', 'recover', 'courier', 'hunt', 'fetch']).slice(0, 4);
    const list = types.map((t) => makeQuest(G, rng, townId, t));
    Q.board[townId] = list; Q.boardGen[townId] = gen;
    return list;
}

export function accept(G, q) {
    const Q = G.quests;
    if (q.state === 'active') return false;
    q.id = Q.nextId++;
    q.state = 'active';
    q.base = { kills: Q.kills[q.p.kind] || 0 };
    if (q.p.type === 'courier') addItem(G, q.p.item, 1);
    Q.active.push(q);
    const b = Q.board[q.town];
    if (b && q.from === 'board') Q.board[q.town] = b.filter((x) => x !== q);
    G.events.push({ type: 'quest', what: 'accept', q: q.id, title: q.title });
    return true;
}

export function status(G, q) {
    const p = q.p;
    if (p.type === 'hunt') { const have = Math.min(p.n, (G.quests.kills[p.kind] || 0) - q.base.kills); return { have, need: p.n, ready: have >= p.n }; }
    if (p.type === 'fetch') { const have = Math.min(p.n, count(G, p.item)); return { have, need: p.n, ready: have >= p.n }; }
    if (p.type === 'recover') { const have = Math.min(1, count(G, p.item)); return { have, need: 1, ready: have >= 1 }; }
    return { have: q.delivered ? 1 : 0, need: 1, ready: !!q.delivered };
}

export function complete(G, q) {
    const st = status(G, q);
    if (!st.ready) return false;
    const Q = G.quests;
    if (q.p.type === 'fetch') removeItem(G, q.p.item, q.p.n);
    if (q.p.type === 'recover') removeItem(G, q.p.item, 1);
    G.gold += q.reward.gold;
    for (const [id, n] of q.reward.items || []) addItem(G, id, n);
    Q.active = Q.active.filter((x) => x !== q);
    Q.done[q.id] = true; Q.completed++;
    q.state = 'done';
    G.events.push({ type: 'quest', what: 'done', q: q.id, title: q.title, reward: q.reward });
    G.stats.questsDone++;
    return true;
}

/** Called when the party kills something. */
export function onKill(G, kind) {
    G.quests.kills[kind] = (G.quests.kills[kind] || 0) + 1;
}

/** The arc stage a villager is on, as a ready-made quest (or null when finished). */
export function arcQuest(G, npc, townId) {
    const Q = G.quests;
    if (!npc.arc) return null;
    const stage = Q.arcStage[npc.id] || 0;
    const arc = ARCS.find((a) => a.id === npc.arc);
    if (stage >= arc.stages.length) return null;
    const active = Q.active.find((q) => q.arc?.npc === npc.id);
    if (active) return active;
    const rng = makeRng(hashStr(`arc:${G.seed}:${npc.id}:${stage}`));
    const spec = arc.stages[stage].task;
    const q = makeQuest(G, rng, townId, spec.type, { from: 'arc', arc: { npc: npc.id, id: arc.id, stage }, title: `${arc.title} (${stage + 1}/3)`, scale: stage === 2 ? 2.2 : stage === 1 ? 1.4 : 1 });
    if (spec.item) { q.p.item = spec.item; q.p.name = ITEMS[spec.item].name; }
    if (stage === 2) { q.reward.items.push([['hpSeed', 'mpSeed', 'powerSeed'][hashStr(npc.id) % 3], 1]); }
    q.text = describe(G, q);
    q.arcStage = stage;
    return q;
}

export function fillArcText(G, line, npc, q, townId) {
    const p = q.p;
    const L = LOCS[townId];
    return line.replace(/\{n\}/g, npc.name.split(' ')[0] === npc.name ? npc.name : npc.name)
        .replace(/\{m\}/g, p.npcName || 'a friend').replace(/\{town2\}/g, p.town ? LOCS[p.town].name : L.name)
        .replace(/\{place\}/g, p.dungeon ? LOCS[p.dungeon].name : 'the old ruins').replace(/\{mon\}/g, p.name || 'monsters')
        .replace(/\{mat\}/g, p.name || 'materials').replace(/\{need\}/g, p.n ? `${p.n} ${p.name}` : 'a few').replace(/\{town\}/g, L.name);
}
