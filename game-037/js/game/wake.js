// ============================================================
// game/wake.js - what happens instead of death (GDD §21)
// You cannot truly die. You can lose what you were carrying, the light you
// had, and the time you had left - and the world notices.
// ============================================================
import { deriveRNG } from '../core/rand.js';
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import {
  DOMAINS, WAKE_TIME_HOURS, WAKE_DROP_FRACTION, WAKE_COIN_LOSS,
  WAKE_OIL_FLASK_LOSS, WAKE_PACK_TTL_DAYS, TICKS_PER_HOUR, TICKS_PER_DAY,
} from '../data/constants.js';
import { WAKE_LINES } from '../data/text.js';
import { State, logLine, difficultyMods } from './state.js';
import { itemValue } from '../gen/item.js';
import { recomputePlayer } from './player.js';
import { addStatus } from './status.js';
import { advanceTime, integrateQuiet } from './time.js';
import { streamAround } from '../world/chunks.js';
import { refreshNpcActors } from '../world/entities.js';
import { updateFOV } from './fov.js';
import { leaveHollow } from './hollowrun.js';
import { carriedWeight } from './player.js';

/** The whole cost of waking, in order, deterministically. */
export function wake(state) {
  const p = state.player;
  const mods = difficultyMods();

  if (mods.permadeath) {
    state.mode = 'dead';
    logLine('That was the end of it. The world keeps your Ledger.', 'bad');
    bus.emit(EV.GAME_OVER, { reason: 'noWake' });
    return;
  }

  // second wind, once per descent
  if (p.mods.secondWind && !p.secondWindUsed) {
    p.secondWindUsed = true;
    p.hp = 1;
    logLine('Not yet. You get your feet under you.', 'good');
    return;
  }

  state.wakeCount++;
  const rng = deriveRNG(state.master, DOMAINS.WAKE, state.wakeCount);
  const scale = mods.wakeCost * (1 + (p.mods.wakeCost || 0));
  const lost = { items: [], coin: 0, hours: 0 };

  // 1. world time advances
  const hours = Math.round(rng.int(WAKE_TIME_HOURS[0], WAKE_TIME_HOURS[1]) * scale);
  lost.hours = hours;
  advanceTime(hours * TICKS_PER_HOUR * 100);
  integrateQuiet();

  // 2. the lantern is empty; half the flasks are gone
  p.lanternOil = 0;
  p.lanternLit = false;
  p.greenFlame = false;
  for (let i = p.inventory.length - 1; i >= 0; i--) {
    const it = p.inventory[i];
    if (it.base !== 'oil_flask') continue;
    const keep = Math.floor((it.stack || 1) * (1 - WAKE_OIL_FLASK_LOSS * scale));
    if (keep <= 0) { lost.items.push(it); p.inventory.splice(i, 1); }
    else it.stack = keep;
  }

  // 3. drop 40% by weight, least valuable first - the game is kind here
  const droppable = p.inventory
    .filter(it => !it.bound && !(it.kind === 'key' || it.kind === 'shard' || it.kind === 'lore'))
    .sort((a, b) => itemValue(a) - itemValue(b));
  const targetWeight = carriedWeight(p) * WAKE_DROP_FRACTION * scale;
  let dropped = 0;
  const pack = [];
  for (const it of droppable) {
    if (dropped >= targetWeight) break;
    dropped += (it.weight || 0) * (it.stack || 1);
    const i = p.inventory.indexOf(it);
    if (i >= 0) { p.inventory.splice(i, 1); pack.push(it); lost.items.push(it); }
  }

  // 4. coin
  const coinLoss = Math.round(p.coin * WAKE_COIN_LOSS * scale);
  p.coin = Math.max(0, p.coin - coinLoss);
  lost.coin = coinLoss;

  // 5. wake-sickness: one Vigor of max HP, until a full night's sleep
  addStatus(p, 'wakesick', 9999);
  p.vigorLost = 1;

  // 7. the pack stays where you fell (or near floor 1's stair, underground)
  if (pack.length) {
    const where = state.mode === 'hollow' ? { x: p.x, y: p.y, hollow: state.hollow.id } : { x: p.x, y: p.y };
    state.deltas.packs.push({
      ...where, items: pack.map(serializeItem),
      expiresTick: state.tick + WAKE_PACK_TTL_DAYS * TICKS_PER_DAY,
    });
  }

  // 6. and nothing else: tools, quest items, capabilities, knowledge, map
  if (state.hollow) leaveHollow(state);
  const wp = p.wakePoint;
  p.x = wp.x; p.y = wp.y;
  p.energy = 0;
  p.secondWindUsed = false;
  recomputePlayer(p);
  p.hp = Math.max(1, Math.round(p.maxHp * 0.5));
  state.mode = 'overworld';
  state.entities = [];
  streamAround(state, p.x, p.y);
  refreshNpcActors(state);
  updateFOV(state);

  logLine(WAKE_LINES[state.wakeCount % WAKE_LINES.length], 'bad');
  logLine(`${hours} hours gone. ${lost.items.length ? lost.items.length + ' things left behind. ' : ''}${coinLoss ? coinLoss + ' coin lighter.' : ''}`.trim(), 'bad');
  state.ledger.push({ tick: state.tick, text: `Woke at ${wp.name}. ${hours} hours, ${lost.items.length} things, ${coinLoss} coin.` });
  bus.emit(EV.PLAYER_WOKE, { at: { x: p.x, y: p.y }, lost });
}

function serializeItem(it) {
  return { ...it };
}

/** Warn before a descent turns into a Wake. */
export function wakeWarning(state) {
  const p = state.player;
  if (p.hp / p.maxHp > 0.25) { p.warnedLowHp = false; return; }
  if (p.warnedLowHp) return;
  p.warnedLowHp = true;
  logLine('You are badly hurt. Waking costs hours you may not have.', 'warn');
  bus.emit(EV.UI_TOAST, { text: 'Badly hurt. Waking costs time.', icon: '♥' });
}

/** Packs decay after three days, and are picked up like any container. */
export function expirePacks(state) {
  state.deltas.packs = state.deltas.packs.filter(p => p.expiresTick > state.tick);
}
