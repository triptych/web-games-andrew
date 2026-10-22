// Tile kinds shared by every map. The view gives each one a look; the sim only needs to know where you can stand.

export const T = {
    DEEP: 0, SHALLOW: 1, GRASS: 2, WOODS: 3, SAND: 4, SNOW: 5, ROCK: 6, DIRT: 7, STONE: 8, WOOD: 9, LAVA: 10, ICE: 11, WALL: 12,
    BRIDGE: 13, SWAMP: 14, FLOWERS: 15, ASH: 16, BRICK: 17, CARPET: 18, DARK: 19, MOSS: 20, TEMPLE: 21, SANDSTONE: 22, ICEFLOOR: 23, FOREST: 24,
};
const walk = new Uint8Array(32);
for (const t of [T.SHALLOW, T.GRASS, T.WOODS, T.SAND, T.SNOW, T.DIRT, T.STONE, T.WOOD, T.ICE, T.BRIDGE, T.SWAMP, T.FLOWERS, T.ASH, T.BRICK, T.CARPET, T.DARK, T.MOSS, T.TEMPLE, T.SANDSTONE, T.ICEFLOOR]) walk[t] = 1;
export const WALKABLE = walk;
export const isWater = (t) => t === T.DEEP || t === T.SHALLOW;

/** A map's tile at (x, y), or ROCK outside it. */
export function tileAt(map, x, y) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return T.ROCK;
    return map.tile[y * map.w + x];
}
export function hgtAt(map, x, y) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return 0;
    return map.hgt[y * map.w + x];
}
export function blockedAt(map, x, y) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
    const i = y * map.w + x;
    return !WALKABLE[map.tile[i]] || map.blk[i] !== 0;
}
