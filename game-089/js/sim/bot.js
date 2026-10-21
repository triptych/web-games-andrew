// An auto-player for the whole game: board decisions, towns and battles. It plays through the
// same act() the player uses, so the tests, the balance table and the in-game Auto battle all
// exercise the real rules. Pure, like the rest of js/sim.
//
// skill 1 plays well (heals in time, aims at weaknesses, shops for upgrades, crafts); skill 0.5
// is a casual player (attacks a lot, shops a bit, sometimes forgets to heal).

import { SKILLS, BURSTS, ITEMS, GEAR, RECIPES, DUNGEONS, TOWNS, COMPANIONS } from './data.js';
import { SPACES, ahead } from './board.js';
import { stats, skillsOf, gearScore, canEquip } from './party.js';
import { dungeonLevel, shopStock, itemPrice, gearPrice, innCost, hireCost, canCraft, forgeDiscount, upgradeCost, dragonLevel } from './game.js';
import { burstOf, whyNot, TUNE } from './battle.js';
import { enemyLevel, VALOR_MAX, PARTY_MAX } from '../config.js';
import { hash3 } from '../rng.js';

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, seed, n: 0, townSteps: 0 };
}

// The bot's own dice: a hash of its counter, so it never touches the game's random state.
function coin(bot) { bot.n++; return hash3(bot.seed, bot.n, 77); }

const hpFrac = (G) => {
    let a = 0, b = 0;
    for (const m of G.party) { const s = stats(G, m); a += m.hp; b += s.maxhp; }
    return b ? a / b : 1;
};

/** The next action for the board game (anything but a battle command). */
export function boardAction(G, bot) {
    const smart = coin(bot) < bot.skill;
    switch (G.phase) {
        case 'roll': {
            bot.townSteps = 0;
            const eq = equipBest(G);
            if (eq) return eq;
            const heal = fieldHeal(G, bot);
            if (heal) return heal;
            return { type: 'roll' };
        }
        case 'passTown':
            if (G.ctx.dungeon) return wantsDungeon(G, bot, G.ctx.dungeon) ? { type: 'stop' } : { type: 'go' };
            return needsTown(G, bot) ? { type: 'stop' } : { type: 'go' };
        case 'dragonOffer': return readyForDragon(G, bot) ? { type: 'climb' } : { type: 'wait' };
        case 'buy': {
            const s = SPACES[G.pos];
            const reserve = (bot.skill >= 1 ? 30 : 40) + 15 * G.lap;
            return G.gold >= s.price + reserve && (smart || coin(bot) < 0.5) ? { type: 'buy' } : { type: 'pass' };
        }
        case 'upgrade': {
            const cost = upgradeCost(G, SPACES[G.pos].deed);
            return G.gold >= cost + 150 + 60 * G.lap && smart ? { type: 'upgrade' } : { type: 'pass' };
        }
        case 'dungeonGate': return wantsDungeon(G, bot, SPACES[G.pos].dungeon) ? { type: 'enter' } : { type: 'pass' };
        case 'dungeonCamp': {
            const down = G.party.some((m) => m.hp <= 0);
            return hpFrac(G) > 0.5 && (!down || (G.bag.items.phoenix || 0) > 0) ? { type: 'onward' } : { type: 'retreat' };
        }
        case 'portal': {
            // the next town if we need one, else the next unfinished dungeon we can take, else a town
            const towns = SPACES.filter((s) => s.type === 'town').sort((a, b) => ahead(G.pos, a.i) - ahead(G.pos, b.i));
            if (!needsTown(G, bot)) {
                const dun = SPACES.filter((s) => s.type === 'dungeon' && !G.cleared[s.dungeon] && G.level >= DUNGEONS[s.dungeon].lv)
                    .sort((a, b) => ahead(G.pos, a.i) - ahead(G.pos, b.i));
                if (dun.length && hpFrac(G) > 0.7) return { type: 'warpTo', to: dun[0].i };
            }
            return { type: 'warpTo', to: towns[0].i };
        }
        case 'reward': case 'defeat': case 'notice': return { type: 'ok' };
        case 'town': return townStep(G, bot);
        case 'battle': return { type: 'cmd', ...battleCommand(G, bot) };
    }
    return null;
}

/** One complete step: the action for the current phase, battle commands included. */
export function botAction(G, bot) { return boardAction(G, bot); }

function wantsDungeon(G, bot, id) {
    const smart = bot.skill >= 1;
    const rec = DUNGEONS[id].lv + (smart ? 0 : -1);
    return G.level >= rec && hpFrac(G) > (smart ? 0.75 : 0.5) && G.party.length >= Math.min(2, G.lap) && (smart || coin(bot) < 0.6);
}

function needsTown(G, bot) {
    if (hpFrac(G) < 0.6) return true;
    const town = G.ctx.town || SPACES[G.pos].town;
    if (!town) return false;
    const c = TOWNS[town].companion;
    if (!G.hired[c] && G.party.length < PARTY_MAX && G.gold >= hireCost(G, c) + 20) return true;
    if (bot.skill < 1) return coin(bot) < 0.35;
    if ((G.bag.items.potion || 0) + (G.bag.items.hipotion || 0) < 3 && G.gold > 120) return true;
    if (RECIPES.some((r) => canCraft(G, r) && craftWorth(G, r) > 0)) return true;
    return bestPurchase(G, town, 60) != null;
}

function readyForDragon(G, bot) {
    const lv = dragonLevel(G);
    if (bot.skill < 1) return false;
    return G.party.length === PARTY_MAX && G.level >= lv && hpFrac(G) > 0.9 && hasGear(G, 'dragonbane');
}
const hasGear = (G, id) => G.party.some((m) => Object.values(m.gear).includes(id)) || G.bag.gear[id] > 0;

/** Equip anything in the bag that beats what someone is wearing. */
function equipBest(G) {
    for (const m of [...G.party, ...G.bench]) {
        for (const id of Object.keys(G.bag.gear)) {
            const g = GEAR[id];
            if (!canEquip(G, m, id)) continue;
            if (gearScore(G, m, id) > gearScore(G, m, m.gear[g.slot]) + 0.5) return { type: 'equip', member: m.id, gear: id };
        }
    }
    return null;
}

function fieldHeal(G, bot) {
    if (bot.skill < 1) return null;
    for (const m of G.party) {
        const s = stats(G, m);
        if (m.hp <= 0 && G.bag.items.phoenix) return { type: 'use', item: 'phoenix', target: m.id };
        if (m.hp > 0 && m.hp < s.maxhp * 0.45) {
            if (G.bag.items.potion > 2) return { type: 'use', item: 'potion', target: m.id };
            if (G.bag.items.picnic) return { type: 'use', item: 'picnic', target: m.id };
        }
    }
    return null;
}

/** The best gear upgrade this town sells that we can afford while keeping `reserve`. */
function bestPurchase(G, town, reserve) {
    const st = shopStock(G, town);
    let best = null, bestGain = 0;
    for (const id of st.gear) {
        const price = gearPrice(G, id);
        if (G.gold < price + reserve) continue;
        if (G.bag.gear[id]) continue;
        const g = GEAR[id];
        for (const m of G.party) {
            if (!canEquip(G, m, id)) continue;
            const gain = gearScore(G, m, id) - gearScore(G, m, m.gear[g.slot]);
            const per = gain / Math.max(1, price) * 100;
            if (gain > 3 && per > bestGain) { bestGain = per; best = id; }
        }
    }
    return best;
}

function craftWorth(G, r) {
    if (r.out === 'dragonbane') return 999;
    const g = GEAR[r.out];
    let best = 0;
    for (const m of G.party) {
        if (!canEquip(G, m, r.out)) continue;
        if (G.party.some((x) => x.gear[g.slot] === r.out) || G.bag.gear[r.out]) continue;
        best = Math.max(best, gearScore(G, m, r.out) - gearScore(G, m, m.gear[g.slot]));
    }
    return best;
}

function townStep(G, bot) {
    const town = G.ctx.town;
    bot.townSteps++;
    if (bot.townSteps > 40) return { type: 'leave' };
    const smart = bot.skill >= 1;
    const eq = equipBest(G);
    if (eq) return eq;
    if (hpFrac(G) < 0.85 && G.gold >= innCost(G, town) && (smart || hpFrac(G) < 0.6)) {
        if (!bot.rested) { bot.rested = true; return { type: 'inn' }; }
    }
    const c = TOWNS[town].companion;
    if (!G.hired[c] && G.gold >= hireCost(G, c) + 10) {
        if (G.party.length < PARTY_MAX) return { type: 'hire', id: c };
    }
    if (smart) {
        // forge first: crafted gear beats the shop
        let bestR = -1, bestW = 0;
        RECIPES.forEach((r, i) => {
            if (!canCraft(G, r)) return;
            const w = craftWorth(G, r);
            if (w > bestW && G.gold - r.gold * forgeDiscount(G) >= 30) { bestW = w; bestR = i; }
        });
        if (bestR >= 0 && bestW > 2) return { type: 'craft', recipe: bestR };
    }
    const reserve = smart ? 70 + 20 * G.lap : 20;
    const buy = bestPurchase(G, town, reserve);
    if (buy && (smart || coin(bot) < 0.6)) return { type: 'buyGear', gear: buy };
    const st = shopStock(G, town);
    const want = smart ? { potion: 4, hipotion: G.lap >= 3 ? 3 : 0, ether: 2, phoenix: G.lap >= 2 ? 2 : 0 } : { potion: 3 };
    for (const [id, n] of Object.entries(want)) {
        if (!st.items.includes(id)) continue;
        if ((G.bag.items[id] || 0) < n && G.gold >= itemPrice(G, id) + 30) return { type: 'buyItem', item: id };
    }
    bot.rested = false;
    return { type: 'leave' };
}

// ================================================================== battles

function est(u, t, power, kind, element) {
    const phys = kind === 'phys';
    let atk = phys ? u.atk : u.mag;
    if (u.status.atkUp) atk *= 1.3;
    const def = phys ? t.def : t.res;
    let d = (power * atk * atk) / (atk + def * TUNE.defK);
    const el = element || (phys ? (u.status.imbue ? 'frost' : u.element) : null);
    if (el && t.weak.includes(el)) d *= 1.5;
    if (el && t.resist.includes(el)) d *= 0.5;
    if (el && u.amp?.[el]) d *= u.amp[el];
    if (t.dragon && u.bane > 1) d *= u.bane;
    return d;
}

/** A battle command for whoever's turn it is. */
export function battleCommand(G, bot) {
    const B = G.battle;
    const u = B.units[B.turn];
    const m = G.party[u.mi];
    const foes = B.units.map((x, i) => ({ x, i })).filter((o) => o.x.side === 'e' && o.x.alive);
    const allies = B.units.map((x, i) => ({ x, i })).filter((o) => o.x.side === 'p');
    const living = allies.filter((o) => o.x.alive);
    const down = allies.filter((o) => !o.x.alive);
    const known = skillsOf(G, m).filter((id) => u.mp >= SKILLS[id].mp);
    const ok = (c) => !whyNot(G, c);
    const smart = coin(bot) < bot.skill;
    const big = B.kind === 'boss' || B.kind === 'dragon';

    // a full Valor gauge
    if (G.valor >= VALOR_MAX && (smart || coin(bot) < 0.5)) {
        const b = burstOf(G, u);
        const S = BURSTS[b];
        const hurt = living.filter((o) => o.x.hp < o.x.maxhp * 0.6).length + down.length;
        if (S.kind !== 'heal' || hurt >= 2) return { cmd: 'burst', burst: b };
    }
    // raise the fallen
    if (down.length && (smart || coin(bot) < 0.4)) {
        if (known.includes('revive')) return { cmd: 'skill', skill: 'revive', target: down[0].i };
        if (G.bag.items.phoenix) return { cmd: 'item', item: 'phoenix', target: down[0].i };
    }
    // heal
    const hurt = living.filter((o) => o.x.hp < o.x.maxhp * (smart ? 0.42 : 0.28)).sort((a, b) => a.x.hp / a.x.maxhp - b.x.hp / b.x.maxhp);
    if (hurt.length && (smart || coin(bot) < 0.5)) {
        const many = living.filter((o) => o.x.hp < o.x.maxhp * 0.6).length >= 2;
        if (many && known.includes('prayer')) return { cmd: 'skill', skill: 'prayer' };
        if (known.includes('mend')) return { cmd: 'skill', skill: 'mend', target: hurt[0].i };
        if (hurt[0].x === u && known.includes('grog')) return { cmd: 'skill', skill: 'grog' };
        const pot = hurt[0].x.maxhp > 220 && G.bag.items.hipotion ? 'hipotion' : G.bag.items.potion ? 'potion' : G.bag.items.hipotion ? 'hipotion' : null;
        if (pot) return { cmd: 'item', item: pot, target: hurt[0].i };
    }
    // statuses that hurt
    if (smart && known.includes('purify')) {
        const sick = living.find((o) => o.x.status.poison || o.x.status.burn || o.x.status.stun);
        if (sick && (big || sick.x.hp < sick.x.maxhp * 0.7)) return { cmd: 'skill', skill: 'purify', target: sick.i };
    }
    // out of mana
    if (smart && u.mp < u.maxmp * 0.15 && u.mag > u.atk && G.bag.items.ether) return { cmd: 'item', item: 'ether', target: B.turn };
    // buffs in a long fight
    if (smart && (big || foes.length >= 3)) {
        for (const id of known) {
            const S = SKILLS[id];
            if (S.kind !== 'buff' || id === 'grog') continue;
            if (id === 'imbue' && !B.units.some((x) => x.dragon || x.boss)) continue;
            const tgts = S.target === 'self' ? [u] : living.map((o) => o.x);
            const missing = tgts.filter((t) => S.buffs.some((b) => !t.status[b.id])).length;
            if (missing >= Math.ceil(tgts.length * 0.6)) return { cmd: 'skill', skill: id };
        }
        if (known.includes('entangle') && foes.filter((o) => !o.x.status.slow).length >= 2) return { cmd: 'skill', skill: 'entangle' };
    }
    // damage: the best expected total, saving a little mana for heals
    const reserve = known.includes('mend') ? SKILLS.mend.mp + 2 : 0;
    let best = { cmd: 'attack', target: foes[0]?.i }, bestV = 0;
    const lowest = foes.slice().sort((a, b) => a.x.hp - b.x.hp);
    for (const f of foes) {
        const v = Math.min(f.x.hp, est(u, f.x, 1, 'phys', null)) * 1.02;
        if (v > bestV) { bestV = v; best = { cmd: 'attack', target: f.i }; }
    }
    if (smart || coin(bot) < 0.35) {
        for (const id of known) {
            const S = SKILLS[id];
            if (S.kind !== 'phys' && S.kind !== 'mag') continue;
            if (u.mp - S.mp < reserve && id !== 'smite') continue;
            const hits = S.hits || 1;
            let v = 0, tgt = null;
            if (S.target === 'enemies') for (const f of foes) v += Math.min(f.x.hp, est(u, f.x, S.power * hits, S.kind, S.element));
            else if (S.target === 'random') v = foes.reduce((a, f) => a + Math.min(f.x.hp, est(u, f.x, S.power, S.kind, S.element)), 0) / foes.length * hits;
            else for (const f of foes) { const d = Math.min(f.x.hp, est(u, f.x, S.power * hits, S.kind, S.element)); if (d > v) { v = d; tgt = f.i; } }
            if (S.status) v *= 1.08;
            v *= 1 - S.mp / Math.max(30, u.maxmp * 1.6);   // mana is worth something
            if (v > bestV * 1.1) { bestV = v; best = { cmd: 'skill', skill: id, target: tgt }; }
        }
    }
    if (!smart && foes.length) best = coin(bot) < 0.5 ? best : { cmd: 'attack', target: lowest[0].i };
    if (bot.skill >= 1 && foes.length >= 2 && G.bag.items.bomb && bestV < 30 + 10 * G.lap) return { cmd: 'item', item: 'bomb' };
    return ok(best) ? best : { cmd: 'defend' };
}

export { COMPANIONS, ITEMS };
