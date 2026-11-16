// The wave function collapse tile set. Pure data and functions.
//
// Every tile is a 3×3 pattern of "micro" cells:
//   #  rock (the wall)          .  floor          ~  shallow water (walkable, slow)
//   o  a well / pit (blocked)   v  stairs down    ^  stairs up
// Two tiles may sit side by side when the three micro cells along their shared edge are identical (both read in the
// same world direction). Rotations of every base pattern are generated here, so a corridor bend, say, exists facing
// all four ways. Only #, . and ~ ever lie on an edge.

/** Base patterns: family → { rows, w (base weight), mix (the "Mix" slider that scales it), room (chamber-ish) } */
export const FAMILIES = {
    rock:       { rows: ['###', '###', '###'], w: 6, mix: null },
    tunnel:     { rows: ['#.#', '#.#', '#.#'], w: 3, mix: 'tunnels' },
    bend:       { rows: ['#.#', '#..', '###'], w: 2, mix: 'tunnels' },
    tee:        { rows: ['#.#', '...', '###'], w: 0.9, mix: 'tunnels' },
    cross:      { rows: ['#.#', '...', '#.#'], w: 0.35, mix: 'tunnels' },
    dead:       { rows: ['#.#', '#.#', '###'], w: 0.5, mix: 'tunnels' },
    floor:      { rows: ['...', '...', '...'], w: 5, mix: 'chambers', room: true },
    wall:       { rows: ['###', '...', '...'], w: 2.6, mix: 'chambers', room: true },
    corner:     { rows: ['###', '#..', '#..'], w: 1.1, mix: 'chambers', room: true },
    inner:      { rows: ['#..', '...', '...'], w: 0.45, mix: 'chambers', room: true },
    door:       { rows: ['#.#', '...', '...'], w: 0.8, mix: 'chambers', room: true },
    pool:       { rows: ['~~~', '~~~', '~~~'], w: 1.2, mix: 'water', room: true },
    poolEdge:   { rows: ['...', '~~~', '~~~'], w: 0.9, mix: 'water', room: true },
    poolCorner: { rows: ['...', '.~~', '.~~'], w: 0.6, mix: 'water', room: true },
    poolInner:  { rows: ['.~~', '~~~', '~~~'], w: 0.3, mix: 'water', room: true },
    stream:     { rows: ['.~.', '.~.', '.~.'], w: 0.7, mix: 'water', room: true },
    streamBend: { rows: ['.~.', '.~~', '...'], w: 0.35, mix: 'water', room: true },
    inlet:      { rows: ['.~.', '~~~', '~~~'], w: 0.3, mix: 'water', room: true },
    spout:      { rows: ['###', '.~.', '.~.'], w: 0.5, mix: 'water', room: true },    // a waterfall out of the wall
    well:       { rows: ['...', '.o.', '...'], w: 0.35, mix: 'pits', room: true },
    stairsDown: { rows: ['...', '.v.', '...'], w: 0, mix: 'never', room: true },     // only ever pinned
    stairsUp:   { rows: ['...', '.^.', '...'], w: 0, mix: 'never', room: true },
};
export const FAMILY_IDS = Object.keys(FAMILIES);

/** What the Paint tool can pin, and which families each brush allows. */
export const BRUSHES = {
    chamber: { name: 'Chamber', icon: '🏛️', fams: ['floor'] },
    tunnel:  { name: 'Tunnel', icon: '🕳️', fams: ['tunnel', 'bend', 'tee', 'cross', 'dead'] },
    water:   { name: 'Water', icon: '💧', fams: ['pool', 'stream', 'spout', 'inlet', 'poolEdge'] },
    well:    { name: 'Well', icon: '🪣', fams: ['well'] },
    rock:    { name: 'Solid rock', icon: '🪨', fams: ['rock'] },
};
export const BRUSH_IDS = Object.keys(BRUSHES);

const rotate = (rows) => [0, 1, 2].map((r) => [0, 1, 2].map((c) => rows[2 - c][r]).join(''));   // 90° clockwise

function build() {
    const tiles = [];
    const seen = new Set();
    for (const fam of FAMILY_IDS) {
        const f = FAMILIES[fam];
        let rows = f.rows;
        const variants = [];
        for (let k = 0; k < 4; k++) {
            const key = rows.join('/');
            if (!seen.has(key)) { seen.add(key); variants.push({ rows, rot: k }); }
            rows = rotate(rows);
        }
        for (const v of variants) {
            tiles.push({
                id: tiles.length, fam, rot: v.rot, rows: v.rows,
                w: f.w / variants.length,
                // N, E, S, W edges, each read left→right or top→bottom in world space
                edges: [v.rows[0], v.rows.map((r) => r[2]).join(''), v.rows[2], v.rows.map((r) => r[0]).join('')],
            });
        }
    }
    return tiles;
}

export const TILES = build();
export const T = TILES.length;

/** compat[d][a] = the tiles that may sit in direction d (0 N, 1 E, 2 S, 3 W) of tile a. */
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const OPP = [2, 3, 0, 1];
export const COMPAT = [0, 1, 2, 3].map((d) => TILES.map((a) => TILES.filter((b) => a.edges[d] === b.edges[OPP[d]]).map((b) => b.id)));

export const tilesOf = (fams) => TILES.filter((t) => fams.includes(t.fam)).map((t) => t.id);
export const isWalk = (ch) => ch === '.' || ch === '~' || ch === 'v' || ch === '^';
