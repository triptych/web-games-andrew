// Quests: generated at the Guild, handed out by runners in the dungeon, tracked by events.
// slay N of a family · gather N of a collectible · reach floor N · fell a guardian · fetch a relic. Pure.

import { say, avgLvl, clamp } from './core.js';
import { FAMILIES } from './monsters.js';
import { COLLECTIBLES, genGear } from './items.js';
import { give, take, countOf } from './inv.js';
import { misc } from './journal.js';
import { gainXp } from './party.js';

const RELICS = ['the Sunken Crown', "a saint's finger-bone", 'the Lantern of Ash', 'a cracked oracle mask', "the miller's ledger", 'a sword with no name', 'the last honest scale'];

export function genQuest(G, rng) {
    const D = Math.max(1, G.maxDepth), lv = Math.max(1, Math.round(avgLvl(G)));
    const types = ['slay', 'slay', 'gather', 'gather', 'reach', 'relic'];
    if (G.cleared < Math.floor(D / 5) * 5 + 5 && D >= 3) types.push('boss');
    const type = rng.pick(types);
    const q = { id: G.quests.nextId++, type, state: 'board', gold: 0, xp: 0 };
    if (type === 'slay') {
        const fam = rng.pick(FAMILIES.filter((f) => f.minD <= D));
        q.fam = fam.id; q.need = rng.int(5, 10) + Math.floor(D / 6); q.got = 0;
        q.title = `Cull the ${fam.name}s`;
        q.desc = `Defeat ${q.need} ${fam.name}s anywhere in the dungeon.`;
        q.gold = Math.round(q.need * (24 + lv * 5)); q.xp = Math.round(q.need * (6 + lv * 3));
    } else if (type === 'gather') {
        const tier = clamp(Math.floor(D / 6) + rng.int(-1, 0), 0, 5);
        const c = rng.pick(COLLECTIBLES.filter((x) => x.tier === tier));
        q.cid = c.id; q.need = rng.int(3, 6);
        q.title = `Bring me ${c.name}`;
        q.desc = `Deliver ${q.need} ${c.name} (${c.kind}) from the dungeon.`;
        q.gold = Math.round(q.need * (30 + tier * 28 + D * 3)); q.xp = Math.round(q.need * (4 + lv * 2));
    } else if (type === 'reach') {
        q.floor = D + rng.int(2, 4);
        q.title = `Descend to B${q.floor}F`;
        q.desc = `Reach floor ${q.floor}. The Guild wants a report.`;
        q.gold = Math.round(120 + q.floor * 60 + lv * 20); q.xp = Math.round(60 + q.floor * 20);
    } else if (type === 'boss') {
        q.floor = Math.floor(D / 5) * 5 + 5;
        q.title = `Fell the guardian of B${q.floor}F`;
        q.desc = `Defeat the guardian that holds the stairs on floor ${q.floor}.`;
        q.gold = Math.round(300 + q.floor * 110); q.xp = Math.round(120 + q.floor * 45);
    } else {
        q.floor = clamp(D - rng.int(0, 2), 1, 999);
        q.relicName = rng.pick(RELICS);
        q.title = `Recover ${q.relicName}`;
        q.desc = `Somewhere on floor ${q.floor} lies ${q.relicName}. Bring it back to town.`;
        q.gold = Math.round(200 + q.floor * 80); q.xp = Math.round(80 + q.floor * 30);
        q.got = 0; q.need = 1;
    }
    q.itemReward = type === 'relic' || type === 'boss' || rng() < 0.3;
    q.seed = rng.int(1, 1e6);
    return q;
}

export function progress(G, q) {
    switch (q.type) {
        case 'slay': return [Math.min(q.need, q.got), q.need];
        case 'gather': return [Math.min(q.need, countOf(G, (x) => x.cid === q.cid)), q.need];
        case 'reach': return [Math.min(q.floor, G.maxDepth), q.floor];
        case 'boss': return [G.cleared >= q.floor ? 1 : 0, 1];
        case 'relic': return [q.got, 1];
    }
    return [0, 1];
}
export const isReady = (G, q) => { const [a, b] = progress(G, q); return a >= b; };

export function questKill(G, mon) {
    for (const q of G.quests.active) if (q.type === 'slay' && q.fam === mon.fam && q.got < q.need) {
        q.got++;
        if (q.got === q.need) say(G, `Quest ready: ${q.title}`, 14);
    }
}
export function questBoss(G, depth) {
    for (const q of G.quests.active) if (q.type === 'boss' && depth >= q.floor) say(G, `Quest ready: ${q.title}`, 14);
}
export function questReach(G, depth) {
    for (const q of G.quests.active) if (q.type === 'reach' && depth >= q.floor) say(G, `Quest ready: ${q.title}`, 14);
}
export function questRelic(G, qid) {
    const q = G.quests.active.find((x) => x.id === qid);
    if (q) { q.got = 1; say(G, `Quest ready: ${q.title}`, 14); }
}
export const activeRelicFor = (G, depth) => G.quests.active.find((q) => q.type === 'relic' && q.floor === depth && !q.got) || null;

export function accept(G, id) {
    const i = G.quests.board.findIndex((q) => q.id === id);
    if (i < 0 || G.quests.active.length >= 5) return false;
    const [q] = G.quests.board.splice(i, 1);
    q.state = 'active';
    G.quests.active.push(q);
    say(G, `Quest accepted: ${q.title}`, 11);
    return true;
}
export function abandon(G, id) {
    const i = G.quests.active.findIndex((q) => q.id === id);
    if (i >= 0) G.quests.active.splice(i, 1);
}
export function turnIn(G, id) {
    const i = G.quests.active.findIndex((q) => q.id === id);
    if (i < 0) return false;
    const q = G.quests.active[i];
    if (!isReady(G, q)) return false;
    if (q.type === 'gather') {
        let left = q.need;
        for (const it of G.inv.filter((x) => x.cid === q.cid)) { const n = Math.min(left, it.n); take(G, it.id, n); left -= n; if (!left) break; }
    }
    G.quests.active.splice(i, 1);
    const gold = Math.round(q.gold * (1 + G.guildBonus));
    G.gold += gold; G.stats.goldEarned += gold;
    for (const m of G.party) gainXp(m, q.xp);
    say(G, `Quest complete! ${gold}g and ${q.xp} XP each.`, 14);
    if (q.itemReward) {
        const lvl = Math.max(G.maxDepth, 1);
        const it = genGear(G.rng, lvl + 1, { minRarity: 2, luck: 1 });
        give(G, it, 'found');
        say(G, `Reward: ${it.name}`, 13);
    }
    G.quests.done++;
    misc(G, 'quests');
    return true;
}
