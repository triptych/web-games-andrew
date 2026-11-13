// GIANT'S VAULT: commands. Everything that isn't real-time input goes through act(G, cmd): the UI, the bot and the
// tests all use it. A command either changes G and pushes an event, or pushes { type: 'denied', reason } and returns
// the reason. Pure.

import { SECOND_MASTERY_AT, LOOT_FILTER } from '../config.js';
import { SKILLS, MASTERIES, MASTERY_MAX, hybridKey, HYBRIDS } from './data/masteries.js';
import { BASES, RARITY_ORDER } from './data/items.js';
import { recompute, canLearn } from './stats.js';
import { slotOf, sellPrice, rollItem, rollGem } from './loot.js';
import { enterArea, portalToTown } from './areas.js';
import { sendPetToTown } from './pet.js';
import { lastFit } from './world.js';

const deny = (G, reason) => { G.events.push({ type: 'denied', reason }); return reason; };

export function bagFree(G) { return G.player.bag.indexOf(null); }
export function bagCount(G) { return G.player.bag.filter(Boolean).length; }

/** Put an item id into the bag (or the pet's bag if full). Returns where it went, or '' if nowhere. */
export function stow(G, id) {
    const P = G.player;
    let i = P.bag.indexOf(null);
    if (i >= 0) { P.bag[i] = id; return 'bag'; }
    if (G.pet.state !== 'away') { i = G.pet.bag.indexOf(null); if (i >= 0) { G.pet.bag[i] = id; return 'pet'; } }
    return '';
}

function takeOut(G, id) {
    const P = G.player;
    let i = P.bag.indexOf(id);
    if (i >= 0) { P.bag[i] = null; return true; }
    i = G.pet.bag.indexOf(id);
    if (i >= 0) { G.pet.bag[i] = null; return true; }
    if (P.stash) { i = P.stash.indexOf(id); if (i >= 0) { P.stash[i] = null; return true; } }
    return false;
}
const owned = (G, id) => G.player.bag.includes(id) || G.pet.bag.includes(id) || G.player.stash?.includes(id);

/** Does an item pass the loot filter (the minimum rarity shown and auto-picked)? */
export function passesFilter(G, it) {
    if (!it) return false;
    if (it.gem) return true;
    const min = { all: 'common', magic: 'magic', rare: 'rare', legendary: 'legendary' }[G.player.filter || 'all'];
    return RARITY_ORDER.indexOf(it.rarity) >= RARITY_ORDER.indexOf(min);
}

const nearTown = (G, what) => G.area.kind === 'town' || what === 'any';

export function act(G, cmd) {
    const P = G.player;
    const r = run(G, cmd, P);
    return r || '';
}

function run(G, cmd, P) {
    switch (cmd.t) {
        case 'equip': {
            const it = G.items[cmd.id];
            if (!it || !owned(G, cmd.id) || it.gem) return deny(G, 'cannot equip that');
            let slot = slotOf(it.base);
            if (slot === 'ring') slot = cmd.slot === 'ring2' || cmd.slot === 'ring1' ? cmd.slot : !P.equip.ring1 ? 'ring1' : !P.equip.ring2 ? 'ring2' : 'ring1';
            const from = P.bag.indexOf(cmd.id) >= 0 ? 'bag' : 'other';
            const idx = P.bag.indexOf(cmd.id);
            takeOut(G, cmd.id);
            const old = P.equip[slot];
            P.equip[slot] = cmd.id;
            if (old) { if (from === 'bag' && idx >= 0) P.bag[idx] = old; else if (!stow(G, old)) { dropOnFloor(G, old); } }
            recompute(G);
            G.events.push({ type: 'equip', id: cmd.id, slot });
            return '';
        }
        case 'unequip': {
            const id = P.equip[cmd.slot];
            if (!id) return deny(G, 'nothing there');
            if (bagFree(G) < 0) return deny(G, 'Your bag is full');
            P.equip[cmd.slot] = null;
            P.bag[bagFree(G)] = id;
            recompute(G);
            G.events.push({ type: 'unequip', id, slot: cmd.slot });
            return '';
        }
        case 'toPet': {
            if (G.pet.state === 'away') return deny(G, 'Ember is in town');
            const i = P.bag.indexOf(cmd.id), j = G.pet.bag.indexOf(null);
            if (i < 0) return deny(G, 'not in your bag');
            if (j < 0) return deny(G, 'Ember\'s pack is full');
            P.bag[i] = null; G.pet.bag[j] = cmd.id;
            G.events.push({ type: 'moved', id: cmd.id, to: 'pet' });
            return '';
        }
        case 'fromPet': {
            const i = G.pet.bag.indexOf(cmd.id), j = bagFree(G);
            if (i < 0) return deny(G, 'not in Ember\'s pack');
            if (j < 0) return deny(G, 'Your bag is full');
            G.pet.bag[i] = null; P.bag[j] = cmd.id;
            G.events.push({ type: 'moved', id: cmd.id, to: 'bag' });
            return '';
        }
        case 'toStash': case 'fromStash': {
            if (G.area.kind !== 'town') return deny(G, 'The stash is in town');
            P.stash ||= new Array(60).fill(null);
            if (cmd.t === 'toStash') {
                const i = P.bag.indexOf(cmd.id), j = P.stash.indexOf(null);
                if (i < 0 || j < 0) return deny(G, j < 0 ? 'The stash is full' : 'not in your bag');
                P.bag[i] = null; P.stash[j] = cmd.id;
            } else {
                const i = P.stash.indexOf(cmd.id), j = bagFree(G);
                if (i < 0 || j < 0) return deny(G, j < 0 ? 'Your bag is full' : 'not in the stash');
                P.stash[i] = null; P.bag[j] = cmd.id;
            }
            G.events.push({ type: 'moved', id: cmd.id, to: cmd.t === 'toStash' ? 'stash' : 'bag' });
            return '';
        }
        case 'drop': {
            if (!takeOut(G, cmd.id)) return deny(G, 'not yours');
            dropOnFloor(G, cmd.id);
            return '';
        }
        case 'sell': {
            if (!nearTown(G)) return deny(G, 'Sell to Ysolde in town, or send Ember');
            const it = G.items[cmd.id];
            if (!it || !takeOut(G, cmd.id)) return deny(G, 'not yours');
            const g = sellPrice(it);
            P.gold += g; delete G.items[cmd.id];
            G.events.push({ type: 'sold', id: cmd.id, gold: g });
            return '';
        }
        case 'sellJunk': {
            if (!nearTown(G)) return deny(G, 'Sell to Ysolde in town');
            let n = 0, g = 0;
            for (const bag of [P.bag, G.pet.bag]) for (let i = 0; i < bag.length; i++) {
                const it = bag[i] && G.items[bag[i]];
                if (!it || it.gem || (it.rarity !== 'common' && it.rarity !== 'magic')) continue;
                g += sellPrice(it); delete G.items[bag[i]]; bag[i] = null; n++;
            }
            P.gold += g;
            G.events.push({ type: 'sold', n, gold: g });
            return '';
        }
        case 'gamble': {
            if (!nearTown(G)) return deny(G, 'Ysolde gambles in town');
            const price = 150 * P.level;
            if (P.gold < price) return deny(G, 'Not enough gold');
            if (bagFree(G) < 0) return deny(G, 'Your bag is full');
            const base = cmd.base && BASES[cmd.base] ? cmd.base : G.rng.pick(Object.keys(BASES));
            const w = { magic: 50, rare: 40, legendary: 8, set: 3 };
            const roll = G.rng() * 101;
            const rarity = roll < w.magic ? 'magic' : roll < w.magic + w.rare ? 'rare' : roll < 98 ? 'legendary' : 'set';
            const it = rollItem(G, P.level, { rarity, base });
            G.items[it.id] = it;
            P.gold -= price;
            P.bag[bagFree(G)] = it.id;
            G.events.push({ type: 'gamble', id: it.id, rarity: it.rarity, price });
            return '';
        }
        case 'socket': {
            const it = G.items[cmd.item], gem = G.items[cmd.gem];
            if (!it || !gem?.gem) return deny(G, 'pick an item and a gem');
            const slot = it.sockets.indexOf(null);
            if (slot < 0) return deny(G, 'No empty socket');
            const equipped = Object.values(P.equip).includes(cmd.item);
            if (!equipped && !owned(G, cmd.item)) return deny(G, 'not yours');
            if (!takeOut(G, cmd.gem)) return deny(G, 'not your gem');
            it.sockets[slot] = cmd.gem;
            recompute(G);
            G.events.push({ type: 'socketed', item: cmd.item, gem: cmd.gem });
            return '';
        }
        case 'addSocket': {
            if (!nearTown(G)) return deny(G, 'Ysolde does this in town');
            const it = G.items[cmd.item];
            if (!it || it.gem) return deny(G, 'pick an item');
            const max = { weapon: 2, helm: 1, chest: 2, amulet: 1 }[BASES[it.base].slot === 'ring' ? 'ring' : BASES[it.base].slot] || 0;
            if (it.sockets.length >= max) return deny(G, 'It can\'t take another socket');
            const price = Math.round(500 * it.ilvl / 10);
            if (P.gold < price) return deny(G, 'Not enough gold');
            P.gold -= price; it.sockets.push(null);
            G.events.push({ type: 'socketAdded', item: it.id, price });
            return '';
        }
        case 'combine': {
            if (!nearTown(G)) return deny(G, 'Ysolde combines gems in town');
            const same = P.bag.filter((id) => id && G.items[id].gem === cmd.gem && G.items[id].grade === cmd.grade);
            if (same.length < 3) return deny(G, 'Needs three of a kind');
            if (cmd.grade >= 3) return deny(G, 'Already perfect');
            const price = 50 * (cmd.grade + 1);
            if (P.gold < price) return deny(G, 'Not enough gold');
            for (const id of same.slice(0, 3)) { takeOut(G, id); delete G.items[id]; }
            const g = rollGem(G, cmd.grade + 1, cmd.gem);
            G.items[g.id] = g; P.bag[bagFree(G)] = g.id; P.gold -= price;
            G.events.push({ type: 'combined', id: g.id });
            return '';
        }
        case 'learnBar': {
            const m = cmd.m;
            if (!P.masteries.includes(m)) return deny(G, 'not your mastery');
            if (P.unspent.skill < 1) return deny(G, 'No skill points');
            if ((P.bar[m] || 0) >= MASTERY_MAX) return deny(G, 'Mastery is maxed');
            P.bar[m] = (P.bar[m] || 0) + 1; P.unspent.skill--;
            recompute(G);
            G.events.push({ type: 'learned', bar: m, rank: P.bar[m] });
            return '';
        }
        case 'learnSkill': {
            const why = canLearn(G, cmd.id);
            if (why) return deny(G, why);
            P.ranks[cmd.id] = (P.ranks[cmd.id] || 0) + 1; P.unspent.skill--;
            // a newly learned active skill goes on the first empty slot
            if (P.ranks[cmd.id] === 1 && SKILLS[cmd.id].kind === 'active' && !P.slots.includes(cmd.id)) {
                const e = P.slots.indexOf(null);
                if (e >= 0) P.slots[e] = cmd.id;
            }
            recompute(G);
            G.events.push({ type: 'learned', skill: cmd.id, rank: P.ranks[cmd.id] });
            return '';
        }
        case 'attr': {
            if (!['might', 'cunning', 'spirit', 'vitality'].includes(cmd.k)) return deny(G, 'no such attribute');
            if (P.unspent.attr < 1) return deny(G, 'No attribute points');
            P.attrs[cmd.k]++; P.unspent.attr--;
            recompute(G);
            G.events.push({ type: 'attr', k: cmd.k });
            return '';
        }
        case 'slot': {
            if (cmd.i < 0 || cmd.i > 4) return deny(G, 'no such slot');
            if (cmd.id && (SKILLS[cmd.id]?.kind !== 'active' || !P.ranks[cmd.id])) return deny(G, 'not a learned active skill');
            const was = P.slots.indexOf(cmd.id);
            if (was >= 0) P.slots[was] = P.slots[cmd.i];
            P.slots[cmd.i] = cmd.id || null;
            G.events.push({ type: 'slotted' });
            return '';
        }
        case 'pickMastery': {
            if (P.level < SECOND_MASTERY_AT) return deny(G, `Your second oath comes at level ${SECOND_MASTERY_AT}`);
            if (P.masteries[1]) return deny(G, 'You have sworn two oaths already');
            if (!MASTERIES[cmd.m] || P.masteries[0] === cmd.m) return deny(G, 'pick another mastery');
            P.masteries[1] = cmd.m;
            P.synergy = HYBRIDS[hybridKey(P.masteries[0], cmd.m)].synergy;
            P.res[MASTERIES[cmd.m].res] = cmd.m === 'warfare' ? 0 : 999;
            recompute(G);
            G.events.push({ type: 'mastery', m: cmd.m, hybrid: HYBRIDS[hybridKey(P.masteries[0], cmd.m)].name });
            return '';
        }
        case 'travel': {
            const to = cmd.area;
            if (to !== 'town' && !P.waystones.includes(to)) return deny(G, 'You haven\'t found that waystone');
            const here = G.features?.find((f) => f.kind === 'waystone');
            if (!here || Math.hypot(here.x - P.x, here.y - P.y) > 3) return deny(G, 'Stand by a waystone');
            enterArea(G, to, 'waystone');
            return '';
        }
        case 'enter': {
            // walk through an exit (the sim does this on touch; the command is for the bot and tests)
            const f = G.features.find((x) => x.id === cmd.id);
            if (!f || f.kind !== 'exit') return deny(G, 'no way there');
            if (f.locked) return deny(G, 'The way is sealed');
            enterArea(G, f.to, 'start');
            return '';
        }
        case 'portal': return portalToTown(G) ? deny(G, 'already in town') : '';
        case 'petTown': { const r = sendPetToTown(G); return r ? deny(G, r) : ''; }
        case 'filter': {
            if (!LOOT_FILTER.includes(cmd.level)) return deny(G, 'no such filter');
            P.filter = cmd.level; G.events.push({ type: 'filter', level: cmd.level }); return '';
        }
        case 'riftOpen': {
            if (!P.bossesKilled.includes('kolossar')) return deny(G, 'The rifts open after Kolossar is bound');
            const tier = Math.max(1, Math.min(cmd.tier || 1, P.riftBest + 1));
            if (G.area.kind !== 'town') return deny(G, 'The obelisk is in town');
            enterArea(G, 'rift', 'start', { tier });
            return '';
        }
        case 'pickup': {
            const d = G.drops.find((x) => x.id === cmd.id);
            if (!d) return deny(G, 'gone');
            if (Math.hypot(d.x - P.x, d.y - P.y) > 2.2) return deny(G, 'too far');
            pickUp(G, d, true);
            return '';
        }
        case 'respec': {
            if (G.area.kind !== 'town') return deny(G, 'Old Heron resets skills in town');
            const price = P.level <= 10 ? 0 : 100 * P.level;
            if (P.gold < price) return deny(G, 'Not enough gold');
            let back = 0;
            for (const k in P.bar) back += P.bar[k];
            for (const k in P.ranks) back += P.ranks[k];
            P.bar = {}; P.ranks = {}; P.slots = [null, null, null, null, null];
            P.unspent.skill += back; P.gold -= price;
            recompute(G);
            G.events.push({ type: 'respec', price });
            return '';
        }
    }
    return deny(G, 'unknown command');
}

export function dropOnFloor(G, id) {
    const P = G.player;
    const a = G.rng() * 6.28, p = lastFit(G.area, P.x, P.y, P.x + Math.cos(a) * 0.8, P.y + Math.sin(a) * 0.8, 0.2);
    G.drops.push({ id: G.nextId++, item: id, x: p.x, y: p.y, dropped: true });
}

/** Pick a floor drop up. force: picked on purpose (a click), so the filter doesn't apply. */
export function pickUp(G, d, force = false) {
    const P = G.player;
    if (d.gold) { const g = Math.round(d.gold * (1 + P.stats.goldFind / 100)); P.gold += g; G.events.push({ type: 'gold', amt: g, x: d.x, y: d.y }); }
    else if (d.globe) { const h = P.stats.maxLife * 0.2; P.life = Math.min(P.stats.maxLife, P.life + h); G.events.push({ type: 'globe', x: d.x, y: d.y }); }
    else {
        const it = G.items[d.item];
        if (!force && (!passesFilter(G, it) || d.dropped)) return false;
        const where = stow(G, d.item);
        if (!where) { if (!G.bagFullWarned) { G.events.push({ type: 'denied', reason: 'Your bag and Ember\'s pack are full' }); G.bagFullWarned = true; } return false; }
        G.bagFullWarned = false;
        G.events.push({ type: 'pickup', id: d.item, rarity: it.rarity, where });
    }
    G.drops.splice(G.drops.indexOf(d), 1);
    return true;
}

