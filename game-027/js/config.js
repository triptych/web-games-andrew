// ============================================================
// Alchemist's Lattice — Configuration  (Phase 1: core puzzle)
// ============================================================
//
// Engine: Phaser 4 (ES module). Following the game-019 repo convention.
// Phase 1 scope: lattice, polyomino tray (sets of 3), drag-and-drop with
// ghost preview, line clears + combo/streak scoring, and the "jammed"
// failure. No alchemy / deposits / cauldron yet (those are Phase 2+).

// --- Accessibility ---
// True when the OS requests reduced-motion (prefers-reduced-motion: reduce).
// Use this to skip or shorten animations in GameScene, UIScene, VNScene, etc.
export const REDUCED_MOTION =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Lattice (placement grid) ---
export const GRID_W    = 9;   // §1 — start at 9×9
export const GRID_H    = 9;
export const CELL_SIZE = 56;  // px per cell
export const CELL_GAP  = 2;   // px gap drawn between cells

// Top-left origin of the grid, computed so the lattice sits centered-left,
// leaving the right rail for the supply / score panels.
export const GRID_PX   = GRID_W * CELL_SIZE;   // grid pixel width/height
export const GRID_X    = 110;
export const GRID_Y    = (GAME_HEIGHT - GRID_W * CELL_SIZE) / 2 - 30;

// --- Tray (drag-and-drop shapes) ---
export const TRAY_SIZE = 3;    // §2 — dealt 3 at a time, place all 3
export const TRAY_Y    = GAME_HEIGHT - 95;       // baseline for tray shapes
export const TRAY_CELL = 30;   // px per cell when drawn in the tray
// Horizontal slot centers for the 3 tray shapes.
export const TRAY_SLOT_X = [
    GRID_X + GRID_PX * 0.18,
    GRID_X + GRID_PX * 0.50,
    GRID_X + GRID_PX * 0.82,
];

// --- Right rail panels ---
export const PANEL_X = GRID_X + GRID_PX + 50;
export const PANEL_W = GAME_WIDTH - (GRID_X + GRID_PX + 50) - 40;

// --- Scoring (§3) ---
export const SCORE_PER_CELL  = 10;   // base points per cleared cell
export const STREAK_BONUS    = 25;   // per current streak step, added on a clearing placement

// --- Starting block layouts ---
// Each layout is a list of {x, y, tileType} cells pre-filled at level start.
// Chosen by (seed % STARTING_LAYOUTS.length). They are sparse enough that the
// board is very playable but give the player an immediate situation to work with
// (partial rows / columns already started, interesting gaps near deposits).
// Coordinates are 0-indexed on the 9×9 grid.
export const STARTING_LAYOUTS = [
    // Layout 0 — "scattered corners": partial rows in the corners + inner pressure
    [
        { x: 0, y: 0, tileType: 'salt' },
        { x: 1, y: 0, tileType: 'ember' },
        { x: 2, y: 0, tileType: 'salt' },
        { x: 0, y: 1, tileType: 'root' },
        { x: 0, y: 2, tileType: 'ash' },
        { x: 7, y: 0, tileType: 'dew' },
        { x: 8, y: 0, tileType: 'salt' },
        { x: 8, y: 1, tileType: 'ash' },
        { x: 8, y: 2, tileType: 'dew' },
        { x: 0, y: 7, tileType: 'ember' },
        { x: 0, y: 8, tileType: 'salt' },
        { x: 1, y: 8, tileType: 'root' },
        { x: 2, y: 8, tileType: 'ember' },
        { x: 7, y: 8, tileType: 'dew' },
        { x: 8, y: 8, tileType: 'ember' },
        { x: 8, y: 7, tileType: 'salt' },
        { x: 8, y: 6, tileType: 'root' },
        { x: 4, y: 4, tileType: 'ash' },
        { x: 3, y: 4, tileType: 'ember' },
        { x: 5, y: 4, tileType: 'salt' },
    ],
    // Layout 1 — "cross arms": heavier cross with inner fill
    [
        { x: 0, y: 4, tileType: 'salt' },
        { x: 1, y: 4, tileType: 'ember' },
        { x: 2, y: 4, tileType: 'dew' },
        { x: 7, y: 4, tileType: 'dew' },
        { x: 8, y: 4, tileType: 'salt' },
        { x: 6, y: 4, tileType: 'root' },
        { x: 4, y: 0, tileType: 'root' },
        { x: 4, y: 1, tileType: 'ash' },
        { x: 4, y: 2, tileType: 'salt' },
        { x: 4, y: 7, tileType: 'ember' },
        { x: 4, y: 8, tileType: 'salt' },
        { x: 4, y: 6, tileType: 'dew' },
        { x: 2, y: 2, tileType: 'dew' },
        { x: 3, y: 2, tileType: 'root' },
        { x: 6, y: 2, tileType: 'root' },
        { x: 7, y: 2, tileType: 'ash' },
        { x: 2, y: 6, tileType: 'ash' },
        { x: 3, y: 6, tileType: 'ember' },
        { x: 6, y: 6, tileType: 'ember' },
        { x: 7, y: 6, tileType: 'salt' },
    ],
    // Layout 2 — "diagonal spine": denser diagonal + thicker edge clusters
    [
        { x: 0, y: 0, tileType: 'ember' },
        { x: 1, y: 0, tileType: 'salt' },
        { x: 1, y: 1, tileType: 'salt' },
        { x: 2, y: 1, tileType: 'dew' },
        { x: 3, y: 2, tileType: 'dew' },
        { x: 4, y: 3, tileType: 'ash' },
        { x: 5, y: 4, tileType: 'root' },
        { x: 6, y: 5, tileType: 'ember' },
        { x: 7, y: 6, tileType: 'ash' },
        { x: 7, y: 7, tileType: 'salt' },
        { x: 8, y: 8, tileType: 'ember' },
        { x: 8, y: 7, tileType: 'dew' },
        { x: 0, y: 8, tileType: 'salt' },
        { x: 0, y: 7, tileType: 'root' },
        { x: 8, y: 0, tileType: 'dew' },
        { x: 8, y: 1, tileType: 'ember' },
        { x: 4, y: 0, tileType: 'root' },
        { x: 4, y: 8, tileType: 'salt' },
        { x: 0, y: 4, tileType: 'ash' },
        { x: 8, y: 4, tileType: 'ember' },
    ],
    // Layout 3 — "ring": denser ring + interior scatter
    [
        { x: 1, y: 0, tileType: 'salt' },
        { x: 2, y: 0, tileType: 'dew' },
        { x: 5, y: 0, tileType: 'dew' },
        { x: 6, y: 0, tileType: 'root' },
        { x: 8, y: 2, tileType: 'root' },
        { x: 8, y: 3, tileType: 'ash' },
        { x: 8, y: 5, tileType: 'ember' },
        { x: 8, y: 6, tileType: 'salt' },
        { x: 6, y: 8, tileType: 'ash' },
        { x: 7, y: 8, tileType: 'ember' },
        { x: 3, y: 8, tileType: 'salt' },
        { x: 2, y: 8, tileType: 'dew' },
        { x: 0, y: 6, tileType: 'dew' },
        { x: 0, y: 5, tileType: 'root' },
        { x: 0, y: 3, tileType: 'root' },
        { x: 0, y: 2, tileType: 'ember' },
        { x: 3, y: 3, tileType: 'ember' },
        { x: 4, y: 3, tileType: 'salt' },
        { x: 5, y: 5, tileType: 'ash' },
        { x: 4, y: 5, tileType: 'dew' },
    ],
    // Layout 4 — "clusters": four tighter clusters spread across the board
    [
        { x: 1, y: 1, tileType: 'salt' },
        { x: 2, y: 1, tileType: 'ember' },
        { x: 1, y: 2, tileType: 'ember' },
        { x: 2, y: 2, tileType: 'root' },
        { x: 6, y: 1, tileType: 'dew' },
        { x: 7, y: 1, tileType: 'root' },
        { x: 7, y: 2, tileType: 'dew' },
        { x: 6, y: 2, tileType: 'salt' },
        { x: 1, y: 6, tileType: 'ash' },
        { x: 2, y: 6, tileType: 'salt' },
        { x: 1, y: 7, tileType: 'ember' },
        { x: 6, y: 6, tileType: 'ash' },
        { x: 7, y: 6, tileType: 'salt' },
        { x: 7, y: 7, tileType: 'ember' },
        { x: 3, y: 4, tileType: 'root' },
        { x: 4, y: 4, tileType: 'salt' },
        { x: 5, y: 4, tileType: 'ash' },
        { x: 4, y: 3, tileType: 'ember' },
        { x: 4, y: 5, tileType: 'dew' },
        { x: 0, y: 4, tileType: 'root' },
    ],
];

// --- Supply (Phase 1 placeholder, §2/§4) ---
// Real seeding/mix lands with the cauldron in Phase 3. For Phase 1 the supply
// is a generous, deterministic-per-seed flat pool so the core loop is playable.
export const SUPPLY_TILES = 36;      // total tiles dealt over the level (12 sets)

// --- Colors (warm apothecary, §UI) ---
export const COLORS = {
    bg:          [20, 16, 12],     // dark wood
    parchment:   [222, 206, 170],
    panel:       [38, 30, 22],
    panelEdge:   [120, 96, 60],    // brass
    gridBg:      [30, 24, 18],
    cellEmpty:   [46, 38, 28],
    cellEmptyHi: [58, 48, 34],
    text:        [232, 220, 192],
    textDim:     [150, 132, 100],
    brass:       [196, 158, 88],
    gold:        [240, 200, 96],
    ghostOk:     [120, 220, 130],  // valid placement
    ghostBad:    [220, 90, 80],    // invalid placement
    danger:      [220, 90, 80],
    success:     [120, 220, 130],
};

// --- Tile-type tints (Phase 1: a small placeholder palette of elements) ---
// Each tile gets a distinct color + glyph so it reads at a glance (§UI).
export const TILE_TYPES = [
    { id: 'salt',  color: [210, 206, 198], glyph: '✦' },
    { id: 'ember', color: [232, 128, 64],  glyph: '✸' },
    { id: 'dew',   color: [110, 188, 196], glyph: '❀' },
    { id: 'root',  color: [150, 120, 78],  glyph: '⬢' },
    { id: 'ash',   color: [128, 122, 130], glyph: '◆' },
];

// --- Elements (§5/§6 — harvested from deposits, spent at the cauldron) ---
// Each element has a distinct color + glyph + a tier (common→exotic). The
// glyph/color double as the deposit's reveal flourish. (Tiers gate the
// cauldron in Phase 3; here they only color the reveal.)
export const ELEMENTS = [
    { id: 'salt',   name: 'Salt',    tier: 'common',   color: [222, 216, 206], glyph: '✦' },
    { id: 'ember',  name: 'Ember',   tier: 'common',   color: [236, 132, 66],  glyph: '✸' },
    { id: 'dew',    name: 'Dew',     tier: 'uncommon', color: [112, 196, 204], glyph: '❀' },
    { id: 'root',   name: 'Root',    tier: 'uncommon', color: [158, 124, 80],  glyph: '⬢' },
    { id: 'ash',    name: 'Ash',     tier: 'rare',     color: [150, 142, 152], glyph: '◆' },
    { id: 'aether', name: 'Aether',  tier: 'exotic',   color: [190, 150, 244], glyph: '✺' },
];

// --- Supply defaults (§4 — Phase 3+ real seeding knobs) ---
export const SUPPLY_SLACK        = 1.6;   // normal nodes
export const SUPPLY_SLACK_ELITE  = 1.25;  // elite/boss
export const SUPPLY_SLACK_EARLY  = 2.0;   // tutorial/early
export const SMALL_TILE_FLOOR    = 0.4;   // ≥40% 1–2 cell tiles
export const TIER_WEIGHTS = { common: 60, uncommon: 25, rare: 12, exotic: 3 };

// --- Cauldron tiers (§4/§6) ---
// Each tier lists which element tiers it can process and which tile-type ids it
// can unlock. Tier is earned by clearing the boss; gates the cauldron screen.
export const CAULDRON_TIERS = [
    { tier: 1, name: 'Cracked Cauldron', elementTiers: ['common'] },
    { tier: 2, name: 'Tin Cauldron',     elementTiers: ['common', 'uncommon'] },
    { tier: 3, name: 'Brass Cauldron',   elementTiers: ['common', 'uncommon', 'rare'] },
    { tier: 4, name: 'Gold Cauldron',    elementTiers: ['common', 'uncommon', 'rare', 'exotic'] },
];

// --- Tile-type definitions with unlock recipes (§4 — cauldron crafting) ---
// id matches shape ids in pieces.js. `recipe` is an element-cost object.
// `tier` is the element tier the cauldron must be able to process to unlock it.
// `startUnlocked` = true for the basic tiles available from the start.
// Grouped by rarity so supply seeding can apply TIER_WEIGHTS.
export const TILE_TYPE_DEFS = [
    // --- common (always unlocked, cauldron tier 1) ---
    { id: 'mono',    name: 'Monomino',   rarity: 'common',   startUnlocked: true,  recipe: {} },
    { id: 'dominoH', name: 'Domino H',   rarity: 'common',   startUnlocked: true,  recipe: {} },
    { id: 'dominoV', name: 'Domino V',   rarity: 'common',   startUnlocked: true,  recipe: {} },
    { id: 'triI_H',  name: 'Tri-I H',    rarity: 'common',   startUnlocked: false, recipe: { salt: 1 } },
    { id: 'triI_V',  name: 'Tri-I V',    rarity: 'common',   startUnlocked: false, recipe: { salt: 1 } },
    // --- uncommon (cauldron tier 1, needs uncommon elements or enough common) ---
    { id: 'triL_a',  name: 'Tri-L A',    rarity: 'uncommon', startUnlocked: false, recipe: { salt: 1, ember: 1 } },
    { id: 'triL_b',  name: 'Tri-L B',    rarity: 'uncommon', startUnlocked: false, recipe: { salt: 1, ember: 1 } },
    { id: 'triL_c',  name: 'Tri-L C',    rarity: 'uncommon', startUnlocked: false, recipe: { salt: 2 } },
    { id: 'triL_d',  name: 'Tri-L D',    rarity: 'uncommon', startUnlocked: false, recipe: { salt: 2 } },
    { id: 'square',  name: 'Square',     rarity: 'uncommon', startUnlocked: false, recipe: { ember: 2 } },
    // --- rare (needs dew or root — uncommon elements, cauldron tier 2) ---
    { id: 'tetI_H',  name: 'Tet-I H',    rarity: 'rare',     startUnlocked: false, recipe: { dew: 1, salt: 1 } },
    { id: 'tetI_V',  name: 'Tet-I V',    rarity: 'rare',     startUnlocked: false, recipe: { dew: 1, salt: 1 } },
    { id: 'tetT',    name: 'Tet-T',      rarity: 'rare',     startUnlocked: false, recipe: { root: 1, ember: 1 } },
    { id: 'tetL',    name: 'Tet-L',      rarity: 'rare',     startUnlocked: false, recipe: { root: 1, salt: 1 } },
    { id: 'tetJ',    name: 'Tet-J',      rarity: 'rare',     startUnlocked: false, recipe: { root: 1, salt: 1 } },
    // --- exotic (needs ash — rare element, cauldron tier 3) ---
    { id: 'tetS',    name: 'Tet-S',      rarity: 'exotic',   startUnlocked: false, recipe: { ash: 1, dew: 1 } },
    { id: 'tetZ',    name: 'Tet-Z',      rarity: 'exotic',   startUnlocked: false, recipe: { ash: 1, dew: 1 } },
];

// --- Level definitions (§Phase 4 / Phase 10) ---
// Each entry is one authored level node. `levelType` routes to the right overlay
// (exploration is the default; refine/battle land in Phase 5).
// Objectives:
//   { kind:'score',   target:N }            — reach N points
//   { kind:'lines',   target:N }            — clear N lines total
//   { kind:'harvest', depositIds:[...] }    — harvest all listed deposits
// `depositSet` overrides the default DEPOSITS with a custom set for that level.
// `supplySlack` overrides SUPPLY_SLACK for this level.
// `rewards` = { currency, xp } awarded on node-clear.
export const LEVELS = [

    // ═══════════════════════════════════════════════════════════════
    //  CHAPTER 1 — "The Cracked Cauldron"
    //  Cauldron Tier 1 (common elements only). Tutorials + discovery.
    // ═══════════════════════════════════════════════════════════════

    // --- Tutorial arc (2 easy exploration nodes) ---
    {
        id: 'tutorial-1',
        name: 'The First Stir',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260614,
        objective: { kind: 'lines', target: 6 },
        supplySlack: 2.0,
        depositSet: [
            { id: 'salt-vein',    element: 'salt',  qty: 2,
              cells: [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }], layers: 1 },
        ],
        rewards: { currency: 25, xp: 30 },
    },
    {
        id: 'tutorial-2',
        name: 'Salt Vein',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260615,
        objective: { kind: 'harvest', depositIds: ['salt-vein'] },
        supplySlack: 2.0,
        depositSet: [
            { id: 'salt-vein',    element: 'salt',  qty: 3,
              cells: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }], layers: 1 },
            { id: 'ember-pocket', element: 'ember', qty: 1,
              cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }], layers: 2 },
        ],
        rewards: { currency: 35, xp: 45 },
    },

    // --- Mid-chapter exploration nodes ---
    {
        id: 'ch1-explore-3',
        name: 'Ember Pocket',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260616,
        objective: { kind: 'score', target: 2000 },
        supplySlack: 1.6,
        depositSet: [
            { id: 'ember-pocket', element: 'ember', qty: 2,
              cells: [{ x: 4, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 3 }], layers: 2 },
            { id: 'salt-seam',    element: 'salt',  qty: 1,
              cells: [{ x: 1, y: 6 }, { x: 2, y: 6 }], layers: 1 },
        ],
        rewards: { currency: 45, xp: 60 },
    },
    {
        id: 'ch1-explore-4',
        name: 'Dew and Embers',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260617,
        objective: { kind: 'lines', target: 10 },
        supplySlack: 1.6,
        depositSet: [
            { id: 'dew-seam',     element: 'dew',   qty: 1,
              cells: [{ x: 6, y: 6 }, { x: 7, y: 6 }], layers: 2 },
            { id: 'ember-pocket', element: 'ember', qty: 1,
              cells: [{ x: 2, y: 1 }, { x: 3, y: 1 }], layers: 1 },
        ],
        rewards: { currency: 50, xp: 70 },
    },
    {
        id: 'ch1-explore-5',
        name: 'The Deep Seam',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260618,
        objective: { kind: 'harvest', depositIds: ['dew-cache', 'salt-vein'] },
        supplySlack: 1.6,
        depositSet: [
            { id: 'dew-cache',    element: 'dew',   qty: 2,
              cells: [{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }], layers: 2 },
            { id: 'salt-vein',    element: 'salt',  qty: 2,
              cells: [{ x: 1, y: 2 }, { x: 2, y: 2 }], layers: 1 },
        ],
        rewards: { currency: 60, xp: 85 },
    },

    // --- Refinement level (§11b) ---
    {
        id: 'refine-1',
        name: 'Draught of Embers',
        levelType: 'refine',
        gridW: 9, gridH: 9,
        seed: 20260621,
        objective: { kind: 'brew' },
        supplySlack: 1.6,
        recipe: {
            potionId: 'ember-draught',
            crucibleCells: [
                { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
                { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
                { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
            ],
            conditions: [
                { id: 'cond-ember-rows', type: 'ingredient_rows', ingredient: 'ember', target: 3,
                  label: 'Clear 3 ember rows' },
                { id: 'cond-combo', type: 'combo', target: 2,
                  label: 'Reach a x2 combo' },
                { id: 'cond-no-dew', type: 'forbidden', ingredient: 'dew',
                  label: 'No dew lines', satisfied: true },
            ],
        },
        enhancements: [
            { id: 'stabilizer',   label: 'Stabilizer',   ingredientCost: { salt: 1 },
              effect: 'combo_ease',    description: 'Widens the combo window by 1.' },
            { id: 'potency-dust', label: 'Potency Dust', ingredientCost: { ember: 1 },
              effect: 'quality_boost', description: 'Raises the final quality by 1 grade.' },
        ],
        activeEnhancements: [],
        rewards: { currency: 70, xp: 100 },
    },

    // --- Battle grid level (§11c) ---
    {
        id: 'battle-1',
        name: 'Cinder Imps',
        levelType: 'battle',
        gridW: 9, gridH: 9,
        seed: 20260622,
        objective: { kind: 'defeat_all' },
        supplySlack: 1.6,
        battle: { playerHp: 20, turnInterval: 4 },
        enemies: [
            { id: 'imp-a', name: 'Cinder Imp',
              cells: [{ x: 2, y: 1 }], hp: 6, armor: 0, damage: 3,
              behavior: ['attack', 'advance'] },
            { id: 'imp-b', name: 'Cinder Imp',
              cells: [{ x: 5, y: 1 }], hp: 6, armor: 0, damage: 3,
              behavior: ['attack', 'advance'] },
            { id: 'imp-c', name: 'Ash Hulk',
              cells: [{ x: 3, y: 0 }, { x: 4, y: 0 }], hp: 12, armor: 1, damage: 2,
              behavior: ['harden', 'advance', 'attack'] },
        ],
        rewards: { currency: 80, xp: 110 },
    },

    // --- Elite node: tougher exploration ---
    {
        id: 'ch1-elite-1',
        name: 'The Buried Trove',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260623,
        objective: { kind: 'harvest', depositIds: ['trove-salt', 'trove-ember', 'trove-dew'] },
        supplySlack: 1.25,
        depositSet: [
            { id: 'trove-salt',   element: 'salt',  qty: 3,
              cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }], layers: 2 },
            { id: 'trove-ember',  element: 'ember', qty: 2,
              cells: [{ x: 6, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 2 }], layers: 2 },
            { id: 'trove-dew',    element: 'dew',   qty: 2,
              cells: [{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 7 }], layers: 3 },
        ],
        rewards: { currency: 110, xp: 160 },
    },

    // --- Elite refinement node ---
    {
        id: 'ch1-elite-refine',
        name: 'Moonfire Tincture',
        levelType: 'refine',
        gridW: 9, gridH: 9,
        seed: 20260624,
        objective: { kind: 'brew' },
        supplySlack: 1.25,
        recipe: {
            potionId: 'moonfire-tincture',
            crucibleCells: [
                { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 },
                { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 },
            ],
            conditions: [
                { id: 'cond-salt-rows',  type: 'ingredient_rows', ingredient: 'salt',  target: 2,
                  label: 'Clear 2 salt rows' },
                { id: 'cond-ember-rows', type: 'ingredient_rows', ingredient: 'ember', target: 2,
                  label: 'Clear 2 ember rows' },
                { id: 'cond-big-combo',  type: 'combo', target: 3,
                  label: 'Reach a x3 combo' },
            ],
        },
        enhancements: [
            { id: 'potency-dust', label: 'Potency Dust', ingredientCost: { ember: 1 },
              effect: 'quality_boost', description: 'Raises the final quality by 1 grade.' },
        ],
        activeEnhancements: [],
        rewards: { currency: 120, xp: 170 },
    },

    // --- Chapter 1 Boss ---
    {
        id: 'boss-battle-1',
        name: 'The Ember Warden',
        levelType: 'battle',
        gridW: 9, gridH: 9,
        seed: 20260625,
        objective: { kind: 'defeat_all' },
        supplySlack: 1.25,
        battle: { playerHp: 30, turnInterval: 3 },
        enemies: [
            { id: 'warden',
              name: 'Ember Warden',
              cells: [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
                      { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
              hp: 40, armor: 2, damage: 5,
              behavior: ['advance', 'harden', 'attack'] },
        ],
        rewards: { currency: 150, xp: 250, cauldronUpgrade: true },
    },

    // ═══════════════════════════════════════════════════════════════
    //  CHAPTER 2 — "The Tin Cauldron"
    //  Cauldron Tier 2 (uncommon elements: dew, root). Wider board.
    // ═══════════════════════════════════════════════════════════════

    {
        id: 'ch2-explore-1',
        name: 'Root Hollow',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260701,
        objective: { kind: 'harvest', depositIds: ['root-vein'] },
        supplySlack: 1.8,
        depositSet: [
            { id: 'root-vein',    element: 'root',  qty: 3,
              cells: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 5 }], layers: 2 },
            { id: 'ember-thread', element: 'ember', qty: 1,
              cells: [{ x: 6, y: 2 }, { x: 7, y: 2 }], layers: 1 },
        ],
        rewards: { currency: 55, xp: 80 },
    },
    {
        id: 'ch2-explore-2',
        name: 'The Dew Cavern',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260702,
        objective: { kind: 'score', target: 3500 },
        supplySlack: 1.6,
        depositSet: [
            { id: 'dew-pool',     element: 'dew',   qty: 3,
              cells: [{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 6 }, { x: 3, y: 6 }], layers: 2 },
            { id: 'root-stub',    element: 'root',  qty: 1,
              cells: [{ x: 7, y: 3 }, { x: 7, y: 4 }], layers: 1 },
        ],
        rewards: { currency: 65, xp: 90 },
    },
    {
        id: 'ch2-explore-3',
        name: 'Twin Veins',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260703,
        objective: { kind: 'lines', target: 14 },
        supplySlack: 1.6,
        depositSet: [
            { id: 'root-left',    element: 'root',  qty: 2,
              cells: [{ x: 1, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 4 }], layers: 2 },
            { id: 'dew-right',    element: 'dew',   qty: 2,
              cells: [{ x: 6, y: 4 }, { x: 7, y: 4 }, { x: 7, y: 5 }], layers: 2 },
            { id: 'salt-base',    element: 'salt',  qty: 1,
              cells: [{ x: 4, y: 7 }, { x: 5, y: 7 }], layers: 1 },
        ],
        rewards: { currency: 70, xp: 100 },
    },

    // --- Chapter 2 refinement ---
    {
        id: 'ch2-refine-1',
        name: "Dew's Clarity",
        levelType: 'refine',
        gridW: 9, gridH: 9,
        seed: 20260704,
        objective: { kind: 'brew' },
        supplySlack: 1.6,
        recipe: {
            potionId: 'dew-clarity',
            crucibleCells: [
                { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
                { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
            ],
            conditions: [
                { id: 'cond-dew-rows',  type: 'ingredient_rows', ingredient: 'dew',  target: 3,
                  label: 'Clear 3 dew rows' },
                { id: 'cond-no-ember',  type: 'forbidden', ingredient: 'ember',
                  label: 'No ember lines', satisfied: true },
                { id: 'cond-combo2',    type: 'combo', target: 2,
                  label: 'Reach a x2 combo' },
            ],
        },
        enhancements: [
            { id: 'dew-catalyst',  label: 'Dew Catalyst',  ingredientCost: { dew: 1 },
              effect: 'combo_ease',    description: 'Widens the combo window by 1.' },
            { id: 'potency-dust',  label: 'Potency Dust',  ingredientCost: { root: 1 },
              effect: 'quality_boost', description: 'Raises the final quality by 1 grade.' },
        ],
        activeEnhancements: [],
        rewards: { currency: 90, xp: 130 },
    },

    // --- Chapter 2 battle ---
    {
        id: 'ch2-battle-1',
        name: 'Root Crawlers',
        levelType: 'battle',
        gridW: 9, gridH: 9,
        seed: 20260705,
        objective: { kind: 'defeat_all' },
        supplySlack: 1.6,
        battle: { playerHp: 25, turnInterval: 4 },
        enemies: [
            { id: 'crawler-a', name: 'Root Crawler',
              cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }], hp: 8, armor: 0, damage: 3,
              behavior: ['advance', 'attack'] },
            { id: 'crawler-b', name: 'Root Crawler',
              cells: [{ x: 6, y: 0 }, { x: 7, y: 0 }], hp: 8, armor: 0, damage: 3,
              behavior: ['advance', 'attack'] },
            { id: 'vine-lord', name: 'Vine Lord',
              cells: [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }], hp: 18, armor: 1, damage: 4,
              behavior: ['harden', 'advance', 'attack'] },
        ],
        rewards: { currency: 100, xp: 140 },
    },

    // --- Chapter 2 elite ---
    {
        id: 'ch2-elite-1',
        name: 'The Ashfall Cache',
        levelType: 'exploration',
        gridW: 9, gridH: 9,
        seed: 20260706,
        objective: { kind: 'harvest', depositIds: ['ash-vein', 'root-seam', 'dew-bloom'] },
        supplySlack: 1.25,
        depositSet: [
            { id: 'ash-vein',     element: 'ash',  qty: 2,
              cells: [{ x: 4, y: 1 }, { x: 4, y: 2 }, { x: 5, y: 2 }], layers: 3 },
            { id: 'root-seam',    element: 'root', qty: 2,
              cells: [{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 6 }], layers: 2 },
            { id: 'dew-bloom',    element: 'dew',  qty: 2,
              cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 7, y: 6 }], layers: 2 },
        ],
        rewards: { currency: 140, xp: 200 },
    },

    // --- Chapter 2 Boss ---
    {
        id: 'boss-battle-2',
        name: 'The Dew Serpent',
        levelType: 'battle',
        gridW: 9, gridH: 9,
        seed: 20260710,
        objective: { kind: 'defeat_all' },
        supplySlack: 1.25,
        battle: { playerHp: 35, turnInterval: 3 },
        enemies: [
            { id: 'serpent-head',
              name: 'Dew Serpent',
              cells: [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
                      { x: 4, y: 1 }],
              hp: 30, armor: 1, damage: 4,
              behavior: ['advance', 'attack'] },
            { id: 'serpent-tail',
              name: 'Serpent Tail',
              cells: [{ x: 3, y: 1 }, { x: 5, y: 1 }],
              hp: 20, armor: 0, damage: 3,
              behavior: ['advance', 'harden', 'attack'] },
        ],
        rewards: { currency: 200, xp: 320, cauldronUpgrade: true },
    },
];

// --- Deposits (§5 — buried ingredient regions revealed by line clears) ---
// Default DEPOSITS used when a level has no `depositSet` override.
// Each is a connected region of cells buried under `layers` cover layers.
// A cover strips when the cell is part of a clearing line; harvests when all
// cells are uncovered. `qty` elements bank to stores on harvest.
export const DEPOSITS = [
    {
        id: 'salt-vein',
        element: 'salt',
        qty: 2,
        cells: [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
        layers: 1,
    },
    {
        id: 'ember-pocket',
        element: 'ember',
        qty: 1,
        cells: [{ x: 5, y: 2 }, { x: 6, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 3 }],
        layers: 2,
    },
    {
        id: 'dew-seam',
        element: 'dew',
        qty: 1,
        cells: [{ x: 6, y: 6 }, { x: 7, y: 6 }],
        layers: 2,
    },
];
