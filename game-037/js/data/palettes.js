// ============================================================
// data/palettes.js - colour ramps by role (GDD §26.3)
// A palette is a base HSL plus per-role deltas. Perturbed per world,
// shifted per biome, and desaturated per Quiet variant at atlas build.
// ============================================================

const P = (h, s, l, roles) => ({ base: { h, s, l }, roles });
const R = (dh, ds, dl) => ({ dh, ds, dl });

const stdRoles = {
  main: R(0, 0, 0),
  light: R(-6, 0.05, 0.11),
  dark: R(8, -0.04, -0.12),
  outline: R(4, 0.05, -0.28),
};

export const PALETTES = {
  // --- ground ---
  grass: P(96, 0.34, 0.36, { ...stdRoles, alt: R(-10, 0.06, 0.05) }),
  meadow: P(88, 0.38, 0.42, { ...stdRoles, alt: R(45, 0.25, 0.18) }),
  tussock: P(72, 0.24, 0.42, { ...stdRoles, alt: R(-8, 0.04, 0.08) }),
  heather: P(300, 0.20, 0.42, { ...stdRoles, alt: R(-40, 0.14, 0.10) }),
  leaf: P(34, 0.32, 0.30, { ...stdRoles, alt: R(10, 0.10, 0.08) }),
  moss: P(126, 0.26, 0.32, { ...stdRoles, alt: R(-14, 0.06, 0.09) }),
  mud: P(30, 0.24, 0.27, { ...stdRoles, alt: R(6, -0.04, 0.05) }),
  reed: P(70, 0.26, 0.38, { ...stdRoles, alt: R(-6, 0.05, 0.10) }),
  tilled: P(26, 0.30, 0.26, { ...stdRoles, alt: R(4, 0.02, 0.06) }),
  sand: P(44, 0.32, 0.64, { ...stdRoles, alt: R(-6, -0.06, 0.06) }),
  shingle: P(38, 0.12, 0.52, { ...stdRoles, alt: R(200, 0.04, -0.06) }),
  water_shallow: P(196, 0.36, 0.46, { ...stdRoles, alt: R(-10, 0.10, 0.12) }),
  water_deep: P(210, 0.40, 0.28, { ...stdRoles, alt: R(-8, 0.08, 0.08) }),
  scree: P(32, 0.10, 0.48, { ...stdRoles, alt: R(0, -0.03, -0.06) }),
  stone: P(34, 0.07, 0.52, { ...stdRoles, alt: R(200, 0.03, -0.05) }),
  snow: P(205, 0.08, 0.86, { ...stdRoles, alt: R(0, 0.04, -0.05) }),
  ice: P(190, 0.22, 0.74, { ...stdRoles, alt: R(10, 0.08, -0.08) }),
  road: P(32, 0.18, 0.44, { ...stdRoles, alt: R(6, -0.04, 0.05) }),
  wood_floor: P(28, 0.28, 0.38, { ...stdRoles, alt: R(4, 0.02, 0.06) }),
  flag: P(30, 0.06, 0.46, { ...stdRoles, alt: R(0, 0.02, 0.05) }),
  hearth: P(18, 0.52, 0.42, { ...stdRoles, ember: R(-6, 0.36, 0.22), alt: R(0, -0.2, -0.1) }),
  salt: P(45, 0.10, 0.76, { ...stdRoles, alt: R(180, 0.05, -0.06) }),
  dust: P(38, 0.12, 0.38, { ...stdRoles, alt: R(0, -0.03, 0.05) }),
  grave: P(28, 0.20, 0.28, { ...stdRoles, alt: R(6, 0.04, 0.05) }),
  cave: P(220, 0.07, 0.28, { ...stdRoles, alt: R(10, 0.03, 0.05) }),
  root: P(36, 0.30, 0.26, { ...stdRoles, alt: R(80, 0.10, 0.08) }),
  rubble: P(30, 0.08, 0.40, { ...stdRoles, alt: R(0, 0, -0.08) }),

  // --- vegetation ---
  tree_broadleaf: P(96, 0.34, 0.34, {
    canopy: R(0, 0, 0), canopyLight: R(-6, 0.06, 0.11), canopyDark: R(10, -0.04, -0.12),
    trunk: R(26, -0.14, -0.16), outline: R(4, 0.05, -0.26),
  }),
  tree_birch: P(84, 0.28, 0.44, {
    canopy: R(0, 0, 0), canopyLight: R(-10, 0.08, 0.12), canopyDark: R(12, -0.06, -0.14),
    trunk: R(40, -0.24, 0.30), outline: R(4, 0.05, -0.28),
  }),
  tree_pine: P(140, 0.30, 0.25, {
    canopy: R(0, 0, 0), canopyLight: R(-8, 0.06, 0.10), canopyDark: R(10, -0.05, -0.10),
    trunk: R(-100, -0.10, -0.06), outline: R(4, 0.06, -0.20),
  }),
  tree_dead: P(30, 0.12, 0.34, {
    canopy: R(0, -0.06, 0.06), canopyLight: R(0, 0, 0.1), canopyDark: R(0, 0, -0.1),
    trunk: R(0, 0, 0), outline: R(0, 0.05, -0.22),
  }),
  bush: P(104, 0.30, 0.32, stdRoles),
  berry: P(104, 0.30, 0.32, { ...stdRoles, berry: R(240, 0.40, 0.10) }),

  // --- built ---
  wall_stone: P(36, 0.08, 0.50, stdRoles),
  wall_timber: P(28, 0.26, 0.34, stdRoles),
  wall_cob: P(44, 0.20, 0.66, stdRoles),
  thatch: P(42, 0.36, 0.48, stdRoles),
  slate: P(215, 0.10, 0.38, stdRoles),
  tile_roof: P(14, 0.32, 0.40, stdRoles),
  tar: P(220, 0.08, 0.22, stdRoles),
  turf: P(96, 0.26, 0.32, stdRoles),
  reed_roof: P(48, 0.30, 0.52, stdRoles),
  door: P(26, 0.32, 0.30, { ...stdRoles, iron: R(10, -0.24, -0.10) }),
  metal: P(210, 0.08, 0.44, stdRoles),
  cloth: P(200, 0.24, 0.52, stdRoles),

  // --- creatures ---
  beast_brown: P(28, 0.30, 0.36, stdRoles),
  beast_grey: P(30, 0.08, 0.40, stdRoles),
  fen: P(120, 0.22, 0.30, stdRoles),
  shore: P(20, 0.34, 0.42, stdRoles),
  pale: P(200, 0.06, 0.72, stdRoles),
  dark: P(250, 0.12, 0.20, stdRoles),
  folk_drab: P(38, 0.18, 0.34, stdRoles),
  folk_dark: P(260, 0.14, 0.26, stdRoles),
  drowned: P(190, 0.22, 0.32, stdRoles),
  quiet: P(220, 0.05, 0.56, stdRoles),
  warden: P(276, 0.20, 0.34, stdRoles),

  // --- the player and NPCs ---
  skin_a: P(28, 0.32, 0.64, stdRoles),
  skin_b: P(24, 0.34, 0.46, stdRoles),
  skin_c: P(22, 0.30, 0.32, stdRoles),
  hair_a: P(30, 0.30, 0.22, stdRoles),
  hair_b: P(40, 0.24, 0.52, stdRoles),
  hair_c: P(0, 0.02, 0.72, stdRoles),
  hair_d: P(16, 0.44, 0.34, stdRoles),
  coat_a: P(200, 0.22, 0.34, stdRoles),
  coat_b: P(120, 0.18, 0.30, stdRoles),
  coat_c: P(20, 0.26, 0.36, stdRoles),
  coat_d: P(280, 0.14, 0.32, stdRoles),
  lantern_lit: P(44, 0.70, 0.60, { ...stdRoles, flame: R(6, 0.30, 0.28) }),
  green_flame: P(148, 0.60, 0.50, { ...stdRoles, flame: R(6, 0.30, 0.28) }),

  // --- hollow themes ---
  barrow: P(38, 0.10, 0.36, stdRoles),
  mill: P(200, 0.14, 0.34, stdRoles),
  vault: P(34, 0.05, 0.44, stdRoles),
  chapel: P(220, 0.12, 0.40, stdRoles),
  warren: P(28, 0.16, 0.26, stdRoles),
  saltworks: P(45, 0.10, 0.62, stdRoles),
  house: P(30, 0.22, 0.36, stdRoles),
  orchard: P(70, 0.24, 0.30, stdRoles),
  starwell: P(240, 0.14, 0.30, stdRoles),

  // --- decor / small ---
  flower: P(330, 0.44, 0.62, { ...stdRoles, alt: R(60, 0.2, 0.1) }),
  fungus: P(20, 0.30, 0.56, stdRoles),
  bone: P(46, 0.12, 0.78, stdRoles),
  blood: P(0, 0.44, 0.30, stdRoles),
  gold: P(46, 0.62, 0.52, stdRoles),
  ui: P(40, 0.20, 0.72, stdRoles),
};

for (const k of Object.keys(PALETTES)) Object.freeze(PALETTES[k]);
Object.freeze(PALETTES);

/** Biome tints: every sprite drawn in this biome shifts by these deltas. */
export const BIOME_TINTS = Object.freeze({
  fen: { dh: 14, ds: -0.06, dl: -0.04 },
  deepwood: { dh: 6, ds: 0.02, dl: -0.06 },
  shore: { dh: -6, ds: -0.04, dl: 0.05 },
  snowfield: { dh: 10, ds: -0.10, dl: 0.10 },
  peak: { dh: 12, ds: -0.10, dl: 0.08 },
  crag: { dh: -4, ds: -0.04, dl: 0.02 },
  dryland: { dh: -8, ds: 0.04, dl: 0.04 },
  heath: { dh: 16, ds: 0.02, dl: 0.0 },
  cloudforest: { dh: 18, ds: -0.02, dl: -0.04 },
});
