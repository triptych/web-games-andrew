// Tile types: the shapes a level's supply can hold. A type is unlocked once at the cauldron by
// spending elements (its recipe); the cauldron's tier decides which rarities it can make.
// Shapes never rotate, except by the Tile Swap skill.

/** id, name, rarity, rows, recipe (elements, paid once), start (unlocked from the beginning) */
const DEFS = [
    ['mono', 'Mote', 'common', ['#'], {}, true],
    ['domH', 'Pair', 'common', ['##'], {}, true],
    ['domV', 'Stack', 'common', ['#', '#'], {}, true],
    ['triH', 'Rod', 'common', ['###'], { salt: 1 }, true],
    ['triV', 'Pillar', 'common', ['#', '#', '#'], { salt: 1 }, true],
    ['bendA', 'Crook', 'uncommon', ['##', '#.'], { salt: 1, ember: 1 }, false],
    ['bendB', 'Hook', 'uncommon', ['##', '.#'], { salt: 1, ember: 1 }, false],
    ['bendC', 'Heel', 'uncommon', ['#.', '##'], { salt: 2 }, false],
    ['bendD', 'Spur', 'uncommon', ['.#', '##'], { salt: 2 }, false],
    ['square', 'Ingot', 'uncommon', ['##', '##'], { ember: 2 }, false],
    ['tetH', 'Beam', 'rare', ['####'], { dew: 1, salt: 1 }, false],
    ['tetV', 'Spire', 'rare', ['#', '#', '#', '#'], { dew: 1, salt: 1 }, false],
    ['tetT', 'Pestle', 'rare', ['###', '.#.'], { root: 1, ember: 1 }, false],
    ['tetL', 'Ladle', 'rare', ['#.', '#.', '##'], { root: 1, salt: 1 }, false],
    ['tetJ', 'Tongs', 'rare', ['.#', '.#', '##'], { root: 1, salt: 1 }, false],
    ['tetS', 'Coil', 'exotic', ['.##', '##.'], { ash: 1, dew: 1 }, false],
    ['tetZ', 'Twist', 'exotic', ['##.', '.##'], { ash: 1, dew: 1 }, false],
    ['slab', 'Slab', 'exotic', ['###', '###'], { ash: 2, root: 1 }, false],
    ['lineH', 'Span', 'aether', ['#####'], { aether: 1, ash: 1 }, false],
    ['lineV', 'Mast', 'aether', ['#', '#', '#', '#', '#'], { aether: 1, ash: 1 }, false],
    ['cross', 'Star', 'aether', ['.#.', '###', '.#.'], { aether: 2 }, false],
];

/** Which cauldron tier can make a rarity (1 Cracked, 2 Tin, 3 Brass, 4 Gold). */
export const RARITY_TIER = { common: 1, uncommon: 1, rare: 2, exotic: 3, aether: 4 };
/** Supply mix: geometric weights so commons dominate and the opening is always playable. */
export const RARITY_WEIGHT = { common: 60, uncommon: 25, rare: 12, exotic: 6, aether: 3 };

export const SHAPES = {};
for (const [id, name, rarity, rows, recipe, start] of DEFS) {
    SHAPES[id] = { id, name, rarity, cells: cellsOf(rows), recipe, start };
}
export const SHAPE_IDS = Object.keys(SHAPES);
export const START_SHAPES = SHAPE_IDS.filter((id) => SHAPES[id].start);

function cellsOf(rows) {
    const out = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') out.push([x, y]); }));
    return out;
}

/** Bounding size of a cell list. */
export function sizeOf(cells) {
    let w = 0, h = 0;
    for (const [x, y] of cells) { if (x + 1 > w) w = x + 1; if (y + 1 > h) h = y + 1; }
    return { w, h };
}

/** Rotate a cell list 90° clockwise and shift it back to the origin. */
export function rotateCells(cells) {
    const { h } = sizeOf(cells);
    return cells.map(([x, y]) => [h - 1 - y, x]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export const CAULDRONS = [
    null,
    { tier: 1, name: 'Cracked Cauldron', elements: ['common'] },
    { tier: 2, name: 'Tin Cauldron', elements: ['common', 'uncommon'] },
    { tier: 3, name: 'Brass Cauldron', elements: ['common', 'uncommon', 'rare'] },
    { tier: 4, name: 'Gold Cauldron', elements: ['common', 'uncommon', 'rare', 'exotic'] },
];
