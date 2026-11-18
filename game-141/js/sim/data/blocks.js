// Block types. hp is strikes at pick power 1; family decides which skill bites it.
// tile is the cell of art/tiles.webp (a 4x4 atlas, read left to right, top to bottom).

export const BLOCKS = {
    sand:      { name: 'Loose sand',   hp: 1,  xp: 1,  family: 'soft',     tile: 0,  color: 0xe8c27a },
    hardsand:  { name: 'Packed sand',  hp: 2,  xp: 2,  family: 'soft',     tile: 1,  color: 0xb98a52 },
    sandstone: { name: 'Sandstone',    hp: 4,  xp: 3,  family: 'stone',    tile: 2,  color: 0xe2c79a },
    brick:     { name: 'Mud brick',    hp: 6,  xp: 4,  family: 'stone',    tile: 3,  color: 0xc8653e },
    granite:   { name: 'Granite',      hp: 9,  xp: 6,  family: 'stone',    tile: 4,  color: 0x9a9a98 },
    obsidian:  { name: 'Obsidian',     hp: 16, xp: 10, family: 'obsidian', tile: 5,  color: 0x2a1f3a },
    crystal:   { name: 'Crystal',      hp: 12, xp: 9,  family: 'crystal',  tile: 6,  color: 0x9fe6df },
    rune:      { name: 'Rune block',   hp: 1,  xp: 3,  family: 'puzzle',   tile: 7,  color: 0xe8c27a },
    door:      { name: 'Bronze door',  hp: 1,  xp: 4,  family: 'puzzle',   tile: 8,  color: 0x9a7240 },
    panel:     { name: 'Sun panel',    hp: 1,  xp: 6,  family: 'puzzle',   tile: 9,  color: 0xe0b85a },
};

/** The ordinary blocks a floor is filled with, by depth: [type, weight]. */
export function blockMix(n) {
    if (n <= 1) return [['sand', 8], ['hardsand', 2]];
    if (n <= 2) return [['sand', 6], ['hardsand', 4]];
    if (n <= 4) return [['sand', 4], ['hardsand', 4], ['sandstone', 3]];
    if (n <= 6) return [['sand', 2], ['hardsand', 4], ['sandstone', 4], ['brick', 2]];
    if (n <= 9) return [['sand', 2], ['hardsand', 3], ['sandstone', 4], ['brick', 3], ['granite', 2]];
    if (n <= 12) return [['sand', 2], ['hardsand', 2], ['sandstone', 3], ['brick', 3], ['granite', 3], ['obsidian', 1]];
    return [['sand', 1], ['hardsand', 2], ['sandstone', 3], ['brick', 3], ['granite', 3], ['obsidian', 2], ['crystal', 2]];
}

/** Floor art by theme: tile index of the open floor, of a room, and the wall colour around the grid. */
export const THEMES = {
    halls:    { floor: 10, room: 11, wall: 0xc9a576, fog: 0x2a1a10, name: 'sandstone halls' },
    treasure: { floor: 12, room: 12, wall: 0xb08a3a, fog: 0x1a1430, name: 'treasure vault' },
    heart:    { floor: 13, room: 13, wall: 0x3a4a8a, fog: 0x0a0c22, name: 'star chamber' },
};
export const PILLAR_TILE = 14;
export const HATCH_TILE = 15;
