// ============================================================
// game/verbs.js - one function per verb (GDD §18.4)
// Split out of actions.js, which keeps the turn wrapper and movement.
// Each returns the energy it cost, or 0 if nothing happened.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { DIRS8 } from '../core/coords.js';
import { dist8, clamp01 } from '../core/util.js';
import { ACTION_ENERGY, LANTERN_CAPACITY, TICKS_PER_HOUR } from '../data/constants.js';
import { T, F, tileDef } from '../data/tiles.js';
import { O, objDef } from '../data/objects.js';
import { OBSERVATIONS, HOLLOW_OBSERVATIONS } from '../data/text.js';
import { BASE_ITEMS } from '../data/items.js';
import { State, logLine } from './state.js';
import {
  groundAt, objectAt, decorAt, flagsAt, propAt, moveCost,
  setGround, setObject, setDecor, setFlag, deleteProp, inBounds, isDeep,
} from '../world/access.js';
import { recordPropDelta } from '../world/chunks.js';
import { actorAt, resolveAttack, inWeaponRange, weaponOf, knockback, applyDamage } from './combat.js';
import { startOfTurn, spendPlayerEnergy } from './scheduler.js';
import { addItem, useItem, displayName, countOf, takeOf } from './inventory.js';
import { recomputePlayer, grantXP, addShard } from './player.js';
import { addStatus, hasStatus, removeStatus } from './status.js';
import { descend, ascend, enterHollow, takePrize, checkLitCondition } from './hollowrun.js';
import { onPlayerAction } from './quests.js';
import { openDialogue } from './dialogue.js';
import { makeSimpleItem, generateItem } from '../gen/item.js';
import { floorItemsAt, setFloorItems } from './grounditems.js';
import { CAPABILITY_INFO } from '../gen/hollow/identity.js';
import { regionAt } from '../gen/fields.js';
import { doRest, doSleep, doRead, doPray, doRing, doLight, doName, doUse, doForage } from './placeverbs.js';

const act0 = (fn, energy) => (fn() ? energy : 0);

/** The verb a prop offers the context button. */
export function propVerb(prop, obj) {
  return {
    hollow_mouth: 'enter', container: 'open', bed: 'sleep', hearth: 'rest', notice_board: 'read',
    mortar: 'identify', repair: 'repair', shop: 'trade', bell: 'ring', shrine: 'pray',
    stair_down: 'descend', stair_up: 'ascend', sconce: 'light', standing_lantern: 'light',
    prize: 'take', secret: 'open', floor_key: 'take', nameplate: 'name', puzzle: 'use',
    stash: 'stash', door: 'open', grave: 'examine', stone: 'examine', forage: 'take',
    search: 'search', boat: 'enter', loom: 'examine', trap: 'examine', signature: 'examine',
  }[prop.kind] || 'examine';
}

/** Lower is more urgent, so the context button offers the obvious thing. */
export function propPrio(prop) {
  return {
    prize: 1, hollow_mouth: 2, floor_key: 2, container: 3, secret: 3,
    stair_down: 4, stair_up: 4,
  }[prop.kind] || 6;
}

/** Dispatch a named verb. `ctx` carries the tile and prop it applies to. */
export function doVerb(state, verb, ctx) {
  const p = state.player;
  const x = ctx && ctx.x !== undefined ? ctx.x : p.x;
  const y = ctx && ctx.y !== undefined ? ctx.y : p.y;
  switch (verb) {
    case 'talk': return doTalk(state, ctx.actor || actorAt(state, x, y));
    case 'attack': return doAttack(state, x, y);
    case 'open': return doOpen(state, x, y);
    case 'take': return doTake(state, x, y);
    case 'search': return doSearch(state, x, y);
    case 'enter': return doEnter(state, x, y);
    case 'descend': return act0(() => descend(state), ACTION_ENERGY.stairs);
    case 'ascend': return act0(() => ascend(state), ACTION_ENERGY.stairs);
    case 'rest': return doRest(state, x, y);
    case 'sleep': return doSleep(state, x, y);
    case 'read': return doRead(state, x, y);
    case 'pray': return doPray(state, x, y);
    case 'ring': return doRing(state, x, y);
    case 'light': return doLight(state, x, y);
    case 'name': return doName(state, x, y);
    case 'use': return doUse(state, x, y);
    case 'examine': return doExamine(state, x, y);
    case 'listen': return doListen(state);
    case 'sit': return doSit(state);
    case 'douse': return doDouse(state);
    case 'dig': return doDig(state, x, y);
    case 'repair': return doUse(state, x, y);
    case 'identify': return doUse(state, x, y);
    case 'trade': return doUse(state, x, y);
    case 'stash': return doUse(state, x, y);
    case 'wait': return ACTION_ENERGY.wait;
    default: return doExamine(state, x, y);
  }
}

// ---------------------------------------------------------------------------
// individual verbs
// ---------------------------------------------------------------------------

export function doAttack(state, x, y) {
  const p = state.player;
  if (!inWeaponRange(p, x, y)) { logLine('Too far for that.', 'plain'); return 0; }
  const target = actorAt(state, x, y);
  if (target && target.isNpc) { logLine('You are not going to do that.', 'plain'); return 0; }
  p.attackedThisTurn = true;
  const w = weaponOf(p);
  if (w.pattern === 'ranged') {
    const ammo = BASE_ITEMS[w.key] && BASE_ITEMS[w.key].ammo;
    if (ammo && !takeOf(p, ammo, 1)) { logLine('Nothing to shoot.', 'plain'); return 0; }
  }
  const dealt = resolveAttack(state, p, x, y);
  if (dealt > 0 && state.hollow) state.hollow.pacifistTurns = 0;
  state.stats.kills += dealt > 0 ? 0 : 0;
  return w.energy;
}

export function doTalk(state, actor) {
  if (!actor || !actor.isNpc) return 0;
  openDialogue(state, actor.npc, actor);
  return ACTION_ENERGY.talk;                  // conversation costs no turns
}

function doOpen(state, x, y) {
  const p = state.player;
  const prop = propAt(state, x, y);
  if (!prop) {
    const obj = objectAt(state, x, y);
    if (obj === O.door) { setObject(state, x, y, O.door_open, state.mode === 'overworld'); return ACTION_ENERGY.door; }
    if (obj === O.door_open) { setObject(state, x, y, O.door, state.mode === 'overworld'); return ACTION_ENERGY.door; }
    return 0;
  }
  if (prop.kind === 'secret') return openSecret(state, prop, x, y);
  if (prop.kind === 'prize') return takePrize(state, prop) ? refreshPrize(state, x, y) : 0;
  if (prop.kind === 'door') {
    setObject(state, x, y, O.door_open, state.mode === 'overworld');
    return ACTION_ENERGY.door;
  }
  if (prop.kind !== 'container') { return doExamine(state, x, y); }
  if (prop.opened) { logLine('Already empty.', 'plain'); return 0; }

  const contents = prop.contents || rollWorldContainer(state, prop);
  let got = 0;
  for (const item of contents) { if (addItem(p, item)) got++; }
  if (p.mods.extraLoot) addItem(p, makeSimpleItem('bandage', 1));
  if (!got) logLine('Empty. Somebody has been here.', 'plain');
  if (state.mode === 'overworld') recordPropDelta(state, prop, { opened: true, emptied: true, contents: null });
  else { prop.opened = true; prop.contents = null; }
  setObject(state, x, y, O.none, state.mode === 'overworld');
  state.stats.explore += 2;
  onPlayerAction(state, { kind: 'open', prop });
  return ACTION_ENERGY.door;
}

function refreshPrize(state, x, y) {
  setObject(state, x, y, O.none, false);
  deleteProp(state, x, y);
  return ACTION_ENERGY.pickup;
}

function rollWorldContainer(state, prop) {
  const tier = prop.tier || 0;
  const rng = state.rngStreams.combat;
  const out = [];
  const n = rng.int(1, 2);
  for (let i = 0; i < n; i++) {
    if (rng.chance(0.4)) {
      out.push(generateItem(state.master, prop.id, i, {
        ilvl: 2 + tier * 2, category: rng.weightedKey({ weapon: 3, body: 2, head: 2, tonic: 3, trinket: 1 }),
      }));
    } else {
      out.push(makeSimpleItem(rng.weightedKey({ bread: 3, bandage: 3, oil_flask: 2, nettle: 2, wool: 2 }), rng.int(1, 2)));
    }
  }
  out.push({ coin: rng.int(3, 20) + tier * 6 });
  return out;
}

function openSecret(state, prop, x, y) {
  const p = state.player;
  if (prop.needs && !p.caps.has(prop.needs)) {
    const info = CAPABILITY_INFO[prop.needs];
    logLine(`${prop.name}. You would need ${info ? info.name.toLowerCase() : 'something else'}.`, 'warn');
    return 0;
  }
  if (prop.opened) { logLine('Already opened.', 'plain'); return 0; }
  recordPropDelta(state, prop, { opened: true });
  setObject(state, x, y, O.none, true);
  setFlag(state, x, y, F.SECRET, false);
  state.stats.explore += 3;
  state.stats.tools++;
  if (prop.shard) { addShard(p, 1); logLine('A fragment, warm, in a wrapping of waxed cloth.', 'good'); }
  else {
    const rng = state.rngStreams.combat;
    const roll = rng.weightedKey({ coin: 4, gear: 3, reagent: 2, lore: 1 });
    if (roll === 'coin') { p.coin += rng.int(40, 300); logLine(`Coin. ${p.coin} now.`, 'good'); }
    else if (roll === 'gear') addItem(p, generateItem(state.master, prop.id, 1, { ilvl: 4 + (prop.tier || 0) * 3, category: 'weapon' }));
    else if (roll === 'reagent') addItem(p, makeSimpleItem(rng.pick(['name_shard', 'heart_root', 'moon_cap']), 2));
    else { addItem(p, makeSimpleItem('ledger_fragment', 1)); logLine('A page, torn from something bigger.', 'flavour'); }
  }
  grantXP(p, 20);
  return ACTION_ENERGY.useTool;
}

function doTake(state, x, y) {
  const p = state.player;
  const items = floorItemsAt(state, x, y);
  if (items && items.length) {
    const item = items.shift();
    addItem(p, item);
    setFloorItems(state, x, y, items);
    onPlayerAction(state, { kind: 'get', item });
    return ACTION_ENERGY.pickup;
  }
  const prop = propAt(state, x, y);
  if (prop && prop.kind === 'floor_key') {
    const key = makeSimpleItem('floor_key', 1);
    key.keyKind = prop.keyKind;
    key.name = prop.keyKind;
    addItem(p, key);
    deleteProp(state, x, y);
    setObject(state, x, y, O.none, false);
    return ACTION_ENERGY.pickup;
  }
  if (prop && prop.kind === 'prize') return takePrize(state, prop) ? refreshPrize(state, x, y) : 0;
  if (prop && prop.kind === 'forage') return doForage(state, prop, x, y);
  const obj = objDef(objectAt(state, x, y));
  if (obj.forage) return doForage(state, { forage: obj.forage, id: 'o' + x + ',' + y }, x, y);
  logLine('Nothing to take.', 'plain');
  return 0;
}


function doSearch(state, x, y) {
  const p = state.player;
  const prop = propAt(state, x, y);
  if (prop && prop.kind === 'search' && !prop.opened) {
    recordPropDelta(state, prop, { opened: true });
    const rng = state.rngStreams.combat;
    if (rng.chance(0.55)) addItem(p, makeSimpleItem(rng.weightedKey({ nettle: 3, tallow: 2, bread: 2, oil_flask: 1, stone: 3 }), rng.int(1, 3)));
    else logLine('Nothing but woodlice.', 'plain');
    state.stats.explore++;
    return ACTION_ENERGY.search;
  }
  // reveal secrets within 2
  let found = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const sx = x + dx, sy = y + dy;
    if (!(flagsAt(state, sx, sy) & F.SECRET)) continue;
    const sp = propAt(state, sx, sy);
    if (sp && !sp.revealed) { sp.revealed = true; found++; }
  }
  logLine(found ? `Something here is not what it looks like. (${found})` : 'Nothing out of place.', found ? 'good' : 'plain');
  if (found) { state.stats.explore += 3; grantXP(p, 8 * found); }
  return ACTION_ENERGY.search;
}

function doEnter(state, x, y) {
  const prop = propAt(state, x, y);
  if (prop && prop.kind === 'hollow_mouth') {
    enterHollow(state, prop.hollow);
    return ACTION_ENERGY.stairs;
  }
  if (prop && prop.kind === 'boat') { logLine('You could take this out, once you knew how to call it back.', 'plain'); return 0; }
  return 0;
}











export function doExamine(state, x, y) {
  const p = state.player;
  const prop = propAt(state, x, y);
  const obj = objDef(objectAt(state, x, y));
  const tile = tileDef(groundAt(state, x, y));
  const actor = actorAt(state, x, y);
  const unnamed = hasStatus(p, 'unnamed');
  if (actor && actor !== p) {
    logLine(actor.isNpc
      ? `${actor.npc.name}. ${actor.npc.look.build}, ${actor.npc.look.hair}, ${actor.npc.look.mark}.`
      : `${actor.name}. ${actor.hp} of ${actor.maxHp} left. ${describeAwareness(actor)}`, 'plain');
    return ACTION_ENERGY.examine;
  }
  if (prop && prop.name) { logLine(unnamed ? 'You cannot hold on to what this is called.' : `${prop.name}. ${obj.desc || ''}`.trim(), 'plain'); return ACTION_ENERGY.examine; }
  if (obj.id) { logLine(obj.desc || obj.name, 'plain'); return ACTION_ENERGY.examine; }
  const dec = decorAt(state, x, y);
  logLine(unnamed ? 'Something. You have lost the word for it.' : (tile.desc || tile.name), 'plain');
  return ACTION_ENERGY.examine;
}

function describeAwareness(a) {
  if (a.asleep) return 'Asleep.';
  if (a.awareness === 'unaware') return 'It has not seen you.';
  if (a.awareness === 'suspicious') return 'It heard something.';
  return 'It knows where you are.';
}

function doListen(state) {
  const pool = state.mode === 'hollow' ? HOLLOW_OBSERVATIONS : OBSERVATIONS;
  const rng = state.rngStreams.cosmetic;
  logLine(rng.pick(pool), 'flavour');
  const near = state.entities.filter(e => !e.isNpc && e.hp > 0 && dist8(e.x, e.y, state.player.x, state.player.y) <= 10);
  if (near.length) logLine(`Something is moving, ${near.length === 1 ? 'once' : near.length + ' of them'}, out past the light.`, 'warn');
  return ACTION_ENERGY.wait;
}

function doSit(state) {
  const rng = state.rngStreams.cosmetic;
  logLine(rng.pick(state.mode === 'hollow' ? HOLLOW_OBSERVATIONS : OBSERVATIONS), 'flavour');
  logLine('You sit down for a minute. Nothing needs doing this second.', 'flavour');
  return ACTION_ENERGY.wait;
}

export function doDouse(state) {
  const p = state.player;
  if (p.lanternLit) {
    p.lanternLit = false; p.greenFlame = false;
    logLine('You pinch the wick. The dark comes in close.', 'plain');
  } else {
    if (p.lanternOil <= 0) { logLine('No oil.', 'warn'); return 0; }
    p.lanternLit = true;
    logLine('Light again.', 'good');
  }
  recomputePlayer(p);
  return ACTION_ENERGY.swap;
}

function doDig(state, x, y) {
  const p = state.player;
  if (!p.caps.has('spade')) { logLine('You would need a spade.', 'warn'); return 0; }
  const prop = propAt(state, x, y);
  if (prop && prop.kind === 'secret') return openSecret(state, prop, x, y);
  logLine('You turn the ground over. Nothing under it.', 'plain');
  return ACTION_ENERGY.useTool;
}

/** Shove: cheap, delightful, and prominent for a reason. */
export function doShove(state, dx, dy) {
  const p = state.player;
  const target = actorAt(state, p.x + dx, p.y + dy);
  if (!target || target === p) { logLine('Nothing there to push.', 'plain'); return 0; }
  if (target.isNpc) { logLine('No.', 'plain'); return 0; }
  const moved = knockback(state, p, target, 1);
  logLine(moved ? `You put ${target.name} back a step.` : `${target.name} does not budge.`, 'plain');
  return ACTION_ENERGY.shove;
}

export function doWait(state) { return ACTION_ENERGY.wait; }

/** Rest: repeat wait until something interesting happens. */




export function regionForPlayer(state) {
  if (state.mode === 'hollow' && state.hollow) {
    const h = state.W.hollows.get(state.hollow.id);
    return h ? state.W.regions.get(h.regionId) : null;
  }
  return state.W.regions.get(regionAt(state.W, state.player.x, state.player.y));
}

export function placeName(state, x, y) {
  for (const s of state.W.settlements.values()) {
    if (Math.abs(s.x - x) < 30 && Math.abs(s.y - y) < 30) return s.name;
  }
  const r = regionForPlayer(state);
  return r ? r.name : 'the road';
}



// Re-exported so actions.js has one place to import a verb from.
export { doRestUntil, tickFloorProblem, collapseBehind } from './floorproblems.js';
export {
  doRest, doSleep, doRead, doPray, doRing, doLight, doName, doUse, doForage,
} from './placeverbs.js';
