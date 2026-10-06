// Tile codes shared by the generator, the sim and the view.
export const T = { SOLID: 0, FLOOR: 1, JAM: 2, PUNCH: 3, BLOCK: 4, GRASS: 5, PATH: 6 };

export const walkable = (t) => t === T.FLOOR || t === T.JAM || t === T.GRASS || t === T.PATH;
export const opaque = (t) => t === T.SOLID || t === T.BLOCK;
export const blocksShots = opaque;

export const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function makeGrid(w, h, fill = T.SOLID) {
    const t = new Uint8Array(w * h);
    t.fill(fill);
    return { w, h, t, at(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? T.SOLID : t[y * w + x]; }, set(x, y, v) { if (x >= 0 && y >= 0 && x < w && y < h) t[y * w + x] = v; } };
}
