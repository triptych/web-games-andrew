// ============================================================
// game/economy.js - merchants, prices, services (GDD §20.5-20.6)
// Prices scale with tier but never gate: everything essential drops.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { DOMAINS, TICKS_PER_DAY } from '../data/constants.js';
import { BASE_ITEMS } from '../data/items.js';
import { generateItem, makeSimpleItem, itemValue } from '../gen/item.js';
import { State, logLine } from './state.js';
import { addItem, removeItem, displayName } from './inventory.js';
import { adjustDisposition } from './dialogue.js';

export const SERVICE_PRICES = Object.freeze({
  bed: 12, meal: 6, identify: 25, ferry: 30, stash: 0, bell: 0,
});

/** A merchant's stock, refreshed daily and derived, never stored. */
export function stockOf(state, npc) {
  const day = Math.floor(state.tick / TICKS_PER_DAY);
  const key = npc.id + '|' + day;
  state.stockCache = state.stockCache || new Map();
  if (state.stockCache.has(key)) return state.stockCache.get(key);

  const rng = deriveRNG(state.master, DOMAINS.NPC_STOCK, hashStr(npc.id), day);
  const settle = state.W.settlements.get(npc.settlementId);
  const region = settle ? state.W.regions.get(settle.regionId) : null;
  const tier = region ? region.tier : 0;
  const playerTier = Math.max(tier, Math.floor(state.player.level / 3));

  const out = [];
  const staples = ['oil_flask', 'bread', 'bandage', 'pottage', 'arrow', 'stone'];
  for (const k of staples) {
    if (!rng.chance(0.8)) continue;
    out.push(makeSimpleItem(k, rng.int(1, 4)));
  }
  const n = rng.int(3, 7);
  let aboveTier = 0;
  for (let i = 0; i < n; i++) {
    const ilvl = tier * 2 + rng.int(0, 6);
    if (ilvl > playerTier * 2 + 6) { if (aboveTier >= 2) continue; aboveTier++; }
    out.push(generateItem(state.master, npc.id + ':' + day, i, {
      ilvl: Math.max(1, ilvl),
      category: rng.weightedKey({ weapon: 4, body: 3, head: 2, offhand: 2, tonic: 3, trinket: 1 }),
    }));
  }
  if (state.stockCache.size > 32) state.stockCache.clear();
  state.stockCache.set(key, out);
  return out;
}

export function buyPrice(state, npc, item) {
  const d = npc.disposition || 0;
  const mult = d >= 40 ? 0.8 : d <= -20 ? 1.2 : 1.0;
  return Math.max(1, Math.round(itemValue(item) * mult * (item.stack || 1)));
}

export function sellPrice(state, npc, item) {
  const d = npc.disposition || 0;
  const rate = d >= 40 ? 0.45 : d <= -20 ? 0.30 : 0.35;
  return Math.max(1, Math.round(itemValue(item) * rate * (item.stack || 1)));
}

export function buy(state, npc, item) {
  const p = state.player;
  const price = buyPrice(state, npc, item);
  if (p.coin < price) { logLine('Not enough coin.', 'plain'); return false; }
  p.coin -= price;
  addItem(p, item);
  const stock = stockOf(state, npc);
  const i = stock.indexOf(item);
  if (i >= 0) stock.splice(i, 1);
  logLine(`${displayName(item)}, for ${price}.`, 'plain');
  return true;
}

export function sell(state, npc, item) {
  const p = state.player;
  if (item.bound) { logLine('That is not yours to sell.', 'plain'); return false; }
  const price = sellPrice(state, npc, item);
  removeItem(p, item, item.stack || 1);
  p.coin += price;
  logLine(`${displayName(item)}, gone, for ${price}.`, 'plain');
  return true;
}

/** Gifting: the cheapest content in the game and the warmest. */
export function giveGift(state, npc, item) {
  const p = state.player;
  const def = BASE_ITEMS[item.base];
  let delta = 5;
  const tags = (def && def.tags) || [];
  const wantsIt = npc.needs && npc.needs.some(nd => nd.object && nd.object.item === item.base);
  if (wantsIt) delta += 12;
  const values = npc.values || {};
  if (values.craft > 0.6 && def && def.kind === 'reagent') delta += 5;
  if (values.family > 0.6 && def && def.kind === 'food') delta += 5;
  if (tags.includes('sweet') || tags.includes('warm')) delta += 2;
  removeItem(p, item, 1);
  adjustDisposition(state, npc, delta, 'gifted');
  state.stats.social += 2;
  logLine(`${npc.shortName} takes it, and looks at it properly. (+${delta})`, 'good');
  return true;
}

/** Services, priced so that coming up for air is a pleasure, not a tax. */
export function payService(state, kind) {
  const p = state.player;
  const price = SERVICE_PRICES[kind] ?? 0;
  const mult = kind === 'repair' ? (p.mods.repairCost || 1) : 1;
  const cost = Math.round(price * mult);
  if (p.coin < cost) { logLine(`That is ${cost} coin. You have ${p.coin}.`, 'plain'); return false; }
  p.coin -= cost;
  return true;
}

export function repairCost(item) {
  const missing = 100 - (item.condition || 100);
  return Math.max(1, Math.round((missing / 25) * 8 * Math.max(1, (item.ilvl || 4) / 4)));
}
