// Sectors, stages and formations.
//
// Formation characters (one 16×12 slot each):
//   invaders  o gloop · k buzz · z peeper · t tank · s splitter · m mirror · b builder · d diver · c captor
//   bricks    # brick · = silver · G gold · X TNT · ? prize
//   .         empty

export const SECTORS = [
    { name: 'LUNAR OUTPOST', backdrop: 'moon', shields: true, asteroids: false, shieldColor: 0x3aff5a },
    { name: 'NEON NEBULA', backdrop: 'nebula', shields: true, asteroids: false, shieldColor: 0xff7ab8 },
    { name: 'ASTEROID ALLEY', backdrop: 'asteroids', shields: false, asteroids: true, shieldColor: 0x3aff5a },
    { name: 'SYNTH CITY', backdrop: 'city', shields: true, asteroids: false, shieldColor: 0x3ae8ff },
    { name: 'THE HIVE', backdrop: 'hive', shields: true, asteroids: false, shieldColor: 0xffc21a },
];

export const INVADER_CHARS = { o: 'gloop', k: 'buzz', z: 'peeper', t: 'tank', s: 'splitter', m: 'mirror', b: 'builder', d: 'diver', c: 'captor' };
export const BRICK_CHARS = new Set(['#', '=', 'G', 'X', '?']);

const WAVES = [
    // ---- sector 1: LUNAR OUTPOST
    { name: 'FIRST CONTACT', rows: [
        '..zzzzzz..',
        '.kkkkkkkk.',
        '.kkkkkkkk.',
        'oooooooooo',
        '#?######?#',
    ] },
    { name: 'MOON MARCH', rows: [
        'z.z.zz.z.z',
        'kkkkkkkkkk',
        '#oooooooo#',
        '#oooooooo#',
        'X##?##?##X',
    ] },
    { name: 'TANK PATROL', rows: [
        '..t.tt.t..',
        'zzzzzzzzzz',
        'kk?kkkk?kk',
        'oooooooooo',
        '##X####X##',
    ] },
    // ---- sector 2: NEON NEBULA
    { name: 'NEBULA GATE', rows: [
        '..zzzzzzz..',
        '=.kkkkkkk.=',
        '=#sooooos#=',
        '=#ooooooo#=',
        'GXX#?#?#XXG',
    ] },
    { name: 'BUILDER BAY', rows: [
        '.b.zzzzz.b.',
        '..kkkkkkk..',
        '#sk#####ks#',
        '#ooo?#?ooo#',
        '===X===X===',
    ] },
    { name: 'SPLIT DECISION', rows: [
        'sssssssss',
        'zzzzzzzzz',
        'X#X#X#X#X',
        'ooooooooo',
        '#?#####?#',
    ] },
    // ---- sector 3: ASTEROID ALLEY
    { name: 'ROCK AND ROLL', rows: [
        '.t..tt..t.',
        'zzmzzzzmzz',
        'kkkkkkkkkk',
        'o?oooooo?o',
    ] },
    { name: 'CRYSTAL CAVE', rows: [
        'mmmmmmmmmm',
        'z#z#zz#z#z',
        'kkkkkkkkkk',
        '=oooXXooo=',
        '##?####?##',
    ] },
    { name: 'HEAVY METAL', rows: [
        't.t.tt.t.t',
        '=mmmmmmmm=',
        'zzzzzzzzzz',
        'kkkk??kkkk',
        'G#X####X#G',
    ] },
    // ---- sector 4: SYNTH CITY
    { name: 'SWOOP', rows: [
        '...dddd...',
        '..dddddd..',
        'zzzzzzzzzz',
        'kkkkkkkkkk',
        '#?##XX##?#',
    ] },
    { name: 'TRACTOR BEAM', rows: [
        '..c.cc.c..',
        '.dddddddd.',
        'zzzzzzzzzz',
        'kkk?kk?kkk',
        'oooooooooo',
    ] },
    { name: 'NEON NIGHTS', rows: [
        'c.d.dd.d.c',
        'dddmmmmddd',
        'zzzzzzzzzz',
        'kkkkkkkkkk',
        '=#X#??#X#=',
    ] },
    // ---- sector 5: THE HIVE
    { name: 'HIVE WALL', rows: [
        'b.b.bb.b.b',
        '==========',
        'zsszzzzssz',
        'kkkkkkkkkk',
        '#X#?##?#X#',
    ] },
    { name: 'THE SWARM', rows: [
        'cdddddddddc',
        'tzzzzmzzzzt',
        'kkkkkkkkkkk',
        'sooooooooos',
        'G##X#?#X##G',
    ] },
    { name: 'LAST STAND', rows: [
        'bdcdddddcdb',
        '=ttttttttt=',
        'mzzzzzzzzzm',
        'skkkk?kkkks',
        'XoooooooooX',
        'G#########G',
    ] },
];

const BOSS_IDS = ['krabbo', 'saucer', 'rockjaw', 'queen', 'overmind'];

/** One loop: 3 waves + boss per sector, a challenge stage after bosses 1–4. */
export const STAGES = [];
for (let s = 0; s < 5; s++) {
    for (let w = 0; w < 3; w++) {
        const def = WAVES[s * 3 + w];
        STAGES.push({ type: 'wave', sector: s, wave: w + 1, name: def.name, rows: def.rows, label: `${s + 1}-${w + 1}` });
    }
    STAGES.push({ type: 'boss', sector: s, boss: BOSS_IDS[s], name: 'BOSS', label: `${s + 1}-B` });
    if (s < 4) STAGES.push({ type: 'challenge', sector: s, challenge: s, name: 'CHALLENGING STAGE', label: `${s + 1}-C` });
}

/** Index of the first stage of each sector (for START SECTOR). */
export const SECTOR_START = SECTORS.map((_, s) => STAGES.findIndex((st) => st.sector === s));

// ------------------------------------------------------------------ challenge stages
// Paths are Catmull-Rom splines through control points (x, y), flown in `dur` seconds.
// `mirror` flips x. Points may start and end off-screen.
export const PATHS = {
    loop: { dur: 5.2, pts: [[-12, 300], [40, 250], [100, 200], [160, 160], [170, 110], [130, 85], [90, 105], [95, 155], [150, 205], [200, 250], [260, 300]] },
    dive: { dur: 4.6, pts: [[120, 336], [118, 250], [110, 170], [90, 110], [60, 90], [40, 120], [50, 190], [30, 260], [-14, 310]] },
    sine: { dur: 5.0, pts: [[-14, 230], [30, 250], [70, 210], [110, 250], [150, 210], [190, 250], [254, 230]] },
    spiral: { dur: 5.6, pts: [[250, 300], [190, 270], [130, 260], [80, 220], [80, 160], [130, 130], [170, 160], [160, 210], [120, 215], [105, 180], [120, 160], [80, 120], [20, 100], [-14, 90]] },
    zigzag: { dur: 5.0, pts: [[-12, 290], [60, 250], [180, 220], [60, 180], [180, 140], [90, 110], [254, 90]] },
    arc: { dur: 4.4, pts: [[-12, 120], [40, 200], [120, 250], [200, 200], [254, 120]] },
};

export const CHALLENGES = [
    [
        { kind: 'buzz', path: 'loop', mirror: false },
        { kind: 'buzz', path: 'loop', mirror: true },
        { kind: 'peeper', path: 'sine', mirror: false },
        { kind: 'gloop', path: 'dive', mirror: false },
        { kind: 'gloop', path: 'dive', mirror: true },
    ],
    [
        { kind: 'splitter', path: 'arc', mirror: false },
        { kind: 'peeper', path: 'zigzag', mirror: false },
        { kind: 'peeper', path: 'zigzag', mirror: true },
        { kind: 'builder', path: 'loop', mirror: true },
        { kind: 'buzz', path: 'spiral', mirror: false },
    ],
    [
        { kind: 'mirror', path: 'sine', mirror: true },
        { kind: 'tank', path: 'arc', mirror: true },
        { kind: 'peeper', path: 'spiral', mirror: false },
        { kind: 'peeper', path: 'spiral', mirror: true },
        { kind: 'gloop', path: 'loop', mirror: false },
    ],
    [
        { kind: 'diver', path: 'dive', mirror: false },
        { kind: 'diver', path: 'dive', mirror: true },
        { kind: 'captor', path: 'loop', mirror: false },
        { kind: 'diver', path: 'zigzag', mirror: true },
        { kind: 'diver', path: 'spiral', mirror: false },
    ],
];

/** Position on a path at u ∈ [0,1]. */
export function pathPoint(path, u, mirror, out) {
    const pts = path.pts, n = pts.length - 1;
    const f = Math.min(Math.max(u, 0), 1) * n;
    const i = Math.min(n - 1, Math.floor(f)), t = f - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    const t2 = t * t, t3 = t2 * t;
    const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    const x = cr(p0[0], p1[0], p2[0], p3[0]), y = cr(p0[1], p1[1], p2[1], p3[1]);
    out.x = mirror ? 240 - x : x;
    out.y = y;
    return out;
}
