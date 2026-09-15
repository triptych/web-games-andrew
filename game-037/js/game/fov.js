// ============================================================
// game/fov.js - what the player can see right now (GDD §17.8, §18.3)
// Its own module because every map change has to refresh it, and both the
// action layer and the Hollow layer need to call it without importing each
// other.
// ============================================================
import { computeFOV } from '../core/grid.js';
import { F } from '../data/tiles.js';
import { isOpaque, inBounds, setFlag } from '../world/access.js';
import { hasStatus } from './status.js';

/** Recompute visibility, and remember every tile the player has now seen. */
export function updateFOV(state) {
  const p = state.player;
  if (!p) return;
  const radius = fovRadius(state, p);
  const seen = state.visible = new Set();
  computeFOV(p.x, p.y, radius, (x, y) => isOpaque(state, x, y), (x, y) => {
    if (!inBounds(state, x, y)) return;
    seen.add(x * 4096 + y);
    setFlag(state, x, y, F.EXPLORED, true);
  });
}

/**
 * How far you can see: your lantern, or the daylight, whichever reaches
 * further. Weather and the hungry dark take it back again.
 */
export function fovRadius(state, p) {
  let r = p.lightRadius || 0;
  if (state.mode !== 'hollow') {
    const h = Math.floor((state.tick % 2400) / 120);
    const daylight = (h >= 6 && h < 19) ? 12 : ((h >= 4 && h < 6) || h === 19) ? 8 : 0;
    r = Math.max(r, daylight);
    const weather = state.weather && state.weather.kind;
    if (weather === 'fog') r = Math.max(2, r - 3);
    else if (weather === 'rain' || weather === 'snow') r = Math.max(2, r - 1);
  } else if (state.hollow && state.hollow.floor && state.hollow.floor.lightPenalty) {
    r = Math.max(1, Math.round(r * state.hollow.floor.lightPenalty));
  }
  if (hasStatus(p, 'blinded')) r = 1;
  if (p.tonicLightUntil && state.tick < p.tonicLightUntil) r = Math.max(r, 7);
  return Math.max(1, Math.round(r));
}
