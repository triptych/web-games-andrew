// ============================================================
// render/palette.js - colour ramps and the Quiet's desaturation (GDD §26.3)
// Every seed's oaks are slightly their own green.
// ============================================================
import { PALETTES, BIOME_TINTS } from '../data/palettes.js';
import { deriveRNG, hashStr } from '../core/rand.js';
import { DOMAINS } from '../data/constants.js';
import { clamp01 } from '../core/util.js';

export function hsl(h, s, l, a = 1) {
  return `hsla(${((h % 360) + 360) % 360}, ${Math.round(clamp01(s) * 100)}%, ${Math.round(clamp01(l) * 100)}%, ${a})`;
}

/** Per-world perturbation: the visual "hand" of this seed. */
export function buildPaletteSet(master) {
  const rng = deriveRNG(master, DOMAINS.SPRITES, 0);
  const style = {
    outline: rng.pick(['dark', 'none', 'tinted']),
    dither: rng.chance(0.5),
    shadeDir: rng.pick([[1, 1], [-1, 1]]),
    saturation: rng.float(0.82, 1.0),
    warmth: rng.float(-0.05, 0.1),
  };
  const out = {};
  for (const key of Object.keys(PALETTES)) {
    const p = PALETTES[key];
    const prng = deriveRNG(master, DOMAINS.SPRITES, hashStr(key));
    const base = {
      h: p.base.h + prng.float(-8, 8),
      s: clamp01(p.base.s * style.saturation + prng.float(-0.05, 0.05)),
      l: clamp01(p.base.l + prng.float(-0.05, 0.05) + style.warmth * 0.2),
    };
    const roles = {};
    for (const [role, d] of Object.entries(p.roles)) {
      roles[role] = {
        h: base.h + d.dh, s: clamp01(base.s + d.ds), l: clamp01(base.l + d.dl),
      };
    }
    out[key] = { base, roles };
  }
  return { palettes: out, style };
}

/**
 * Quiet variant: colour drains toward its own luminance, so detail literally
 * leaves the world. The game's most important visual idea, nearly free.
 */
export function quietize(colour, q) {
  if (!q) return colour;
  return {
    h: colour.h,
    s: colour.s * (1 - q),
    l: colour.l * (1 - 0.15 * q) + 0.5 * 0.15 * q,
  };
}

/** Biome tints: the same oak recipe is greyer in a fen. */
export function tintFor(biome) {
  return BIOME_TINTS[biome] || null;
}

export function applyTint(colour, tint) {
  if (!tint) return colour;
  return { h: colour.h + tint.dh, s: clamp01(colour.s + tint.ds), l: clamp01(colour.l + tint.dl) };
}

export function roleColour(paletteSet, paletteKey, role, q = 0, tint = null) {
  const p = paletteSet.palettes[paletteKey] || paletteSet.palettes.stone;
  let c = (p.roles[role] || p.roles.main || p.base);
  if (tint) c = applyTint(c, tint);
  c = quietize(c, q);
  return hsl(c.h, c.s, c.l);
}
