// ============================================================
// game/time.js - ticks, day/night, weather, epochs (GDD §7.4, §10.4-10.5)
// Anything time-varying derives from floor(tick / period), never the raw tick.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { clamp01 } from '../core/util.js';
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { DOMAINS, TICKS_PER_DAY, TICKS_PER_HOUR, QUIET_DRIFT, QUIET_LIT_RECOVER } from '../data/constants.js';
import { WEATHER_LINES } from '../data/text.js';
import { State, difficultyMods } from './state.js';

export const dayOf = tick => Math.floor(tick / TICKS_PER_DAY);
export const hourOf = tick => Math.floor((tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
export const isNight = tick => { const h = hourOf(tick); return h >= 20 || h < 4; };
export const isDusk = tick => { const h = hourOf(tick); return h === 19 || h === 4; };

export function clockString(tick) {
  const h = hourOf(tick);
  const m = Math.floor(((tick % TICKS_PER_HOUR) / TICKS_PER_HOUR) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Advance world time by energy spent. Ticks follow the player's pace. */
export function advanceTime(energy) {
  const before = State.tick;
  State.energyCarry += energy;
  while (State.energyCarry >= 100) { State.energyCarry -= 100; State.tick++; }
  if (State.tick !== before) {
    bus.emit(EV.WORLD_TICK, { tick: State.tick });
    if (dayOf(State.tick) !== dayOf(before)) {
      integrateQuiet();
      bus.emit(EV.WORLD_DAYTICK, { day: dayOf(State.tick) });
    }
  }
}

const WEATHER_KINDS = ['clear', 'overcast', 'rain', 'fog', 'snow', 'still'];

/** @pure Weather for a region, on 3-hour boundaries. */
export function weatherAt(regionId, tick) {
  const block = Math.floor(tick / TICKS_PER_HOUR / 3);
  const key = regionId + '|' + block;
  const cached = State.weatherCache.get(key);
  if (cached) return cached;
  const region = State.W.regions.get(regionId);
  const rng = deriveRNG(State.master, DOMAINS.WEATHER, hashStr(regionId), block);
  const biome = region ? region.dominantBiome : 'meadow';
  const table = { clear: 6, overcast: 4, rain: 3, fog: 2, snow: 0.2, still: 1 };
  if (biome === 'fen' || biome === 'cloudforest') { table.fog += 4; table.rain += 2; }
  if (biome === 'snowfield' || biome === 'peak') { table.snow += 6; table.clear -= 2; }
  if (biome === 'dryland' || biome === 'heath') { table.clear += 4; table.rain -= 1; }
  if (region && region.quiet > 0.5) table.still += 4;
  const kind = rng.weightedKey(table);
  const out = { kind, line: (WEATHER_LINES[kind] || WEATHER_LINES.clear)[rng.int(0, 1)] || '' };
  if (State.weatherCache.size > 64) State.weatherCache.clear();
  State.weatherCache.set(key, out);
  return out;
}

export const WEATHER_EFFECTS = Object.freeze({
  clear: {}, overcast: {},
  rain: { visibility: -1, fireMult: 0.75, forage: 0.15 },
  fog: { visibility: -3, ambush: 0.5, rangedMiss: 0.25 },
  snow: { moveCost: 20, tracks: true },
  still: { quiet: 0.05, silent: true },
});

/**
 * Integrate the Quiet lazily: each region drifts by how many of its Hollows
 * are unlit, and recovers for each lit one. Slow enough that nothing is lost
 * by accident, fast enough that neglect shows.
 */
export function integrateQuiet() {
  const mods = difficultyMods();
  const day = dayOf(State.tick);
  let worldQuiet = 0, n = 0;
  for (const r of State.W.regions.values()) { worldQuiet += r.quiet; n++; }
  const mean = n ? worldQuiet / n : 0;
  const rubber = mean > 0.7 ? 0.5 : 1;     // never unwinnable, never unpleasant

  for (const r of State.W.regions.values()) {
    const lastDay = Math.floor(r.quietUpdatedTick / TICKS_PER_DAY);
    const days = day - lastDay;
    if (days <= 0) continue;
    let lit = 0, unlit = 0;
    for (const hid of r.hollows) {
      const h = State.W.hollows.get(hid);
      if (!h) continue;
      if (h.lit) lit++; else unlit++;
    }
    const delta = (unlit * QUIET_DRIFT - lit * QUIET_LIT_RECOVER) * days * mods.quietDrift * rubber;
    const before = r.quiet;
    r.quiet = clamp01(Math.max(r.quietFloor ?? r.quietBase * 0.5, r.quiet + delta));
    r.quietUpdatedTick = State.tick;
    if (Math.abs(r.quiet - before) > 0.005) {
      bus.emit(EV.WORLD_QUIET, { regionId: r.id, value: r.quiet, delta: r.quiet - before });
    }
  }
}

/** Ambient light 0..1, where 1 is full dark. */
export function ambientDarkness() {
  if (State.mode === 'hollow') return 0.88;
  const h = hourOf(State.tick);
  if (h >= 20 || h < 4) return 0.62;
  if (h === 19 || h === 4 || h === 5) return 0.25;
  return 0.0;
}
