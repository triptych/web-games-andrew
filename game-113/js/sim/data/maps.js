// The places. Each map is a grid of tiles, one character each (see TILES), plus the people, chests, triggers and exits on it.
// x is the column and y the row; actors stand at tile centres (x + 0.5). `need`/`not` are story flags.
//
// The view reads `theme` for textures, light and fog; the audio reads `music` for the area's song.

/** What each tile character is. solid: blocks walking. h: block height for the view. */
export const TILES = {
    ' ': { solid: true, h: 0, kind: 'void' },
    '.': { solid: false, h: 0, kind: 'ground' },
    ',': { solid: false, h: 0, kind: 'ground2' },
    ':': { solid: false, h: 0, kind: 'path' },
    '=': { solid: false, h: 0, kind: 'dock' },
    'f': { solid: false, h: 0, kind: 'flowers' },
    'w': { solid: false, h: 0, kind: 'wheat' },
    '#': { solid: true, h: 1.6, kind: 'wall' },
    'H': { solid: true, h: 2.8, kind: 'cliff' },
    'h': { solid: true, h: 2.2, kind: 'house' },
    '~': { solid: true, h: -0.35, kind: 'water' },
    'T': { solid: true, h: 0, kind: 'tree' },
    'r': { solid: true, h: 0, kind: 'rock' },
    '*': { solid: true, h: 0, kind: 'crystal' },
    'l': { solid: true, h: 0, kind: 'lamp' },
    'p': { solid: true, h: 0, kind: 'pillar' },
    'o': { solid: true, h: 0, kind: 'coral' },
    'b': { solid: true, h: 0, kind: 'barrel' },
    's': { solid: true, h: 0, kind: 'snowbank' },
    'm': { solid: true, h: 0, kind: 'windmill' },
    'L': { solid: true, h: 0.2, kind: 'lift' },
    'S': { solid: true, h: 0, kind: 'songcrystal' },
    'C': { solid: true, h: 0, kind: 'chest' },
};

export const MAPS = {
    hollow: {
        name: 'The Crystal Hollow', theme: 'hollow', music: { seed: 711, bpm: 72, scale: 'phrygian', lyrics: 'hush' },
        rows: [
            'HHHHHHHHHHHHHHHHHHHHHHHH',
            'HHHH################HHHH',
            'HHH#*..............*#HHH',
            'HH#..................#HH',
            'HH#*....::::::::....*#HH',
            'HH#.....::::::::.....#HH',
            'HH#.r...::::::::...r.#HH',
            'HH#.....::::::::.....#HH',
            'HH#*....::::::::....*#HH',
            'HH##....::::::::....##HH',
            'HHH##.....::::.....##HHH',
            'HHHH##....::::....##HHHH',
            'HHHHH##...::::...##HHHHH',
            'HHHHHH##..::::..##HHHHHH',
            'HHHHHHHH##::::##HHHHHHHH',
            'HHHHHHHHHH::::HHHHHHHHHH',
        ],
        spawn: [11.5, 9.5], npcs: [], chests: [], exits: [], triggers: [], enemies: [],
    },

    beach: {
        name: 'The Drowned Beach', theme: 'beach', music: { seed: 1201, bpm: 84, scale: 'dorian', lyrics: 'sea' },
        rows: [
            'HHHHHHHHHHH::HHHHHHHHHHH',
            'H#####p####::####p#####H',
            'H#*...r....::.......*##H',
            'H#.........::.....T...#H',
            'H#..,,,....::...,,,...#H',
            'H#.,,C,,..:::..,,,,,..#H',
            'H#..,,,..:::.......r..#H',
            'H#r.....:::....S......#H',
            'H#.....:::,,,,......T.#H',
            'H#~~..:::,,,,,,,,.....#H',
            'H~~~~.::,,,,,,,,,,,,..#H',
            'H~~~~~:,,,,,,,,,,,,,,.#H',
            'H~~~===,,,,,,,,,,,,,,r#H',
            'H~~~~~~~,,,,,,,,,,,,,.#H',
            'H~~~~~~~~~~~~~~~~~~~~~~H',
            'HHHHHHHHHHHHHHHHHHHHHHHH',
        ],
        spawn: [11.5, 1.5],
        npcs: [
            { id: 'otto', x: 5.5, y: 12.5, dir: 'right', not: 'metOtto', talk: [{ scene: 'meetOtto' }], mech: true },
        ],
        chests: ['lozenge'],
        exits: [{ x: 11, y: 0, w: 2, h: 1, to: 'aurelune', at: [11.5, 13.5], dir: 'up', need: 'metOtto', blocked: 'beachBlocked' }],
        triggers: [],
        enemies: [{ kind: 'shardcrab', x: 15.5, y: 4.5, need: 'metOtto' }, { kind: 'shardcrab', x: 12.5, y: 8.5, need: 'metOtto' }],
    },

    aurelune: {
        name: 'Aurelune, the City of Song', theme: 'aurelune', music: { seed: 3307, bpm: 92, scale: 'lydian', lyrics: 'hope' },
        rows: [
            'HHHHHHHHHHHHHHHHHHHHHHHH',
            'Hhhhhhh####LL####hhhhhhH',
            'Hhhhhhh#l..::..l#hhhhhhH',
            'Hh....p....::....p....hH',
            'Hh.l.......::.......l.hH',
            'H....::::::::::::::....H',
            'Hp...:....,,,,....:..p.H',
            'H....:..,,,,,,,,..:....H',
            'Hhh..:..,,,pp,,,..:..hhH',
            'Hhh..:..,,,,,,,,..:..hhH',
            'H....:...,,,,,,...:.C..H',
            'Hp...::::::::::::::..p.H',
            'H.S....l...::...l......H',
            'Hhhh.......::.......hhhH',
            'Hhhhh......::......hhhhH',
            'HHHHHHHHHHH::HHHHHHHHHHH',
        ],
        spawn: [11.5, 13.5],
        travel: { x: 14.5, y: 3.5 },
        npcs: [
            { id: 'archivist', x: 6.5, y: 9.5, dir: 'right', mech: true, talk: [{ need: 'surface', scene: 'archivist2' }, { scene: 'archivist' }] },
        ],
        signs: [{ x: 11, y: 8, w: 2, h: 1, scene: 'statue' }, { x: 11, y: 1, w: 2, h: 1, scene: 'lift' }],
        chests: ['metronome'],
        exits: [{ x: 11, y: 15, w: 2, h: 1, to: 'beach', at: [11.5, 1.5], dir: 'down' }],
        triggers: [{ x: 9, y: 12, w: 6, h: 3, scene: 'arriveAurelune', once: 'seenAurelune' }],
        enemies: [{ kind: 'gloomwisp', x: 4.5, y: 6.5 }, { kind: 'rustling', x: 19.5, y: 8.5 }, { kind: 'gloomwisp', x: 14.5, y: 10.5 }],
    },

    marisonde: {
        name: 'Marisonde of the Coral Spires', theme: 'marisonde', music: { seed: 4409, bpm: 104, scale: 'mixo', lyrics: 'sea' },
        rows: [
            'HHHHHHHHHHHHHHHHHHHHHHHH',
            'HTThhhh..hhhhh..hhhh#rrH',
            'HT.hhhh..hhhhh..hhhh#..H',
            'H...........l........r.H',
            'H.::::::::::::::::::::.H',
            'H.:..,,,..T...,,,..T:..H',
            'H.:.,,C,,.....,,S,,.:..H',
            'H.:..,,,..o..o.,,,..:..H',
            'H.:::::::====:::::::::.H',
            'H~~~~~~~~====~~~~~~~:.rH',
            'H~~~~~~~~====~~~~~~~:.rH',
            'H~~~~~~~~=..=~~~~~~#:.#H',
            'H~~~~~~~~====~~~~~##::#H',
            'H~~~~~~~~~~~~~~~~###::#H',
            'H~~~~~~~~~~~~~~~~##*::*H',
            'HHHHHHHHHHHHHHHHHHHHHHHH',
        ],
        spawn: [2.5, 3.5],
        travel: { x: 1.5, y: 5.5 },
        npcs: [
            { id: 'sera', x: 10.5, y: 11.5, dir: 'down', not: 'seraJoined', talk: [{ scene: 'meetSera' }] },
            { id: 'elder', x: 6.5, y: 3.5, dir: 'down', talk: [{ need: 'maelstraBeaten', scene: 'elder2' }, { scene: 'elder' }] },
            { id: 'fisher', x: 15.5, y: 7.5, dir: 'left', talk: [{ need: 'maelstraBeaten', scene: 'fisher2' }, { scene: 'fisher' }] },
            { id: 'kid', x: 8.5, y: 5.5, dir: 'down', talk: [{ need: 'seraJoined', scene: 'kid2' }, { scene: 'kid' }] },
        ],
        chests: ['lozenge'],
        exits: [],
        triggers: [
            { x: 20, y: 13, w: 2, h: 2, scene: 'grottoBlocked', not: 'seraJoined', push: [20.5, 11.5] },
            { x: 20, y: 13, w: 2, h: 2, scene: 'maelstraBoss', need: 'seraJoined', not: 'maelstraBeaten' },
            { x: 1, y: 2, w: 4, h: 3, scene: 'arriveMarisonde', once: 'seenMarisonde' },
        ],
        enemies: [{ kind: 'reefgob', x: 6.5, y: 7.5 }, { kind: 'jellyhush', x: 21.5, y: 6.5 }, { kind: 'reefgob', x: 17.5, y: 4.5 }],
    },

    sunreach: {
        name: 'Sunreach Fields', theme: 'sunreach', music: { seed: 5521, bpm: 112, scale: 'major', lyrics: 'sun' },
        rows: [
            'HHHHHHHHHHHHHHHHHHHHHHHH',
            'HTT..wwwwww..m....wwwTTH',
            'HT...wwwwww.......wwww.H',
            'H..:::::::::::::::::...H',
            'H..:..hh....l....ff:...H',
            'H..:..hh..ff.S..fff:...H',
            'H..:.......fff......:..H',
            'Hww:..wwwwww..wwww..:wwH',
            'Hww:..wwwwww..wwww..:wwH',
            'H..::::::::::::::::::..H',
            'H.f...C....m.....b..:..H',
            'Hww..wwww.....wwww..:wwH',
            'Hwww.wwww..T..wwww..:wwH',
            'HT...........TT.....::TH',
            'HTT..rr.....TTT....r::TH',
            'HHHHHHHHHHHHHHHHHHHHHHHH',
        ],
        spawn: [2.5, 6.5],
        travel: { x: 1.5, y: 5.5 },
        npcs: [
            { id: 'mari', x: 12.5, y: 10.5, dir: 'left', not: 'mariJoined', talk: [{ scene: 'meetMari' }] },
            { id: 'miller', x: 8.5, y: 4.5, dir: 'down', talk: [{ need: 'hollowhayBeaten', scene: 'miller2' }, { scene: 'miller' }] },
            { id: 'farmer', x: 15.5, y: 6.5, dir: 'left', talk: [{ need: 'hollowhayBeaten', scene: 'farmer2' }, { scene: 'farmer' }] },
        ],
        chests: ['ember'],
        exits: [],
        triggers: [
            { x: 20, y: 13, w: 2, h: 2, scene: 'fieldBlocked', not: 'mariJoined', push: [20.5, 11.5] },
            { x: 20, y: 13, w: 2, h: 2, scene: 'hollowhayBoss', need: 'mariJoined', not: 'hollowhayBeaten' },
            { x: 1, y: 4, w: 3, h: 4, scene: 'arriveSunreach', once: 'seenSunreach' },
        ],
        enemies: [{ kind: 'crowl', x: 8.5, y: 9.5 }, { kind: 'thornling', x: 16.5, y: 12.5 }, { kind: 'crowl', x: 17.5, y: 3.5 }],
    },

    frosthold: {
        name: 'Frosthold Citadel', theme: 'frosthold', music: { seed: 6637, bpm: 96, scale: 'harm', lyrics: 'frost' },
        rows: [
            'HHHHHHHHHHHHHHHHHHHHHHHH',
            'HTT#hhhh#H::::H#hhhh#TTH',
            'HT.#hhhh#H::::H#hhhh#.TH',
            'H...l....#::::#....l...H',
            'H.........::::.........H',
            'H..ss.....::::....ss...H',
            'H..ss..p..::::..p......H',
            'H::::::::::::::::::::..H',
            'H.....,,,,....,,,,..:..H',
            'Hhh...,,S,....,C,,..:..H',
            'Hhh...,,,,..b.,,,,..:TTH',
            'H..p.........l.....p:.TH',
            'HTT..ss.............:..H',
            'HTTT....ss....ss.....:.H',
            'HTTTT...............:.TH',
            'HHHHHHHHHHHHHHHHHHHHHHHH',
        ],
        spawn: [21.5, 13.5],
        travel: { x: 22.5, y: 12.5 },
        npcs: [
            { id: 'ingrid', x: 4.5, y: 9.5, dir: 'right', not: 'ingridJoined', talk: [{ scene: 'meetIngrid' }] },
            { id: 'smith', x: 4.5, y: 11.5, dir: 'up', talk: [{ need: 'rimefangBeaten', scene: 'smith2' }, { scene: 'smith' }] },
            { id: 'guard', x: 9.5, y: 4.5, dir: 'down', talk: [{ need: 'rimefangBeaten', scene: 'guard2' }, { scene: 'guard' }] },
        ],
        chests: ['pearl'],
        exits: [],
        triggers: [
            { x: 10, y: 1, w: 4, h: 2, scene: 'gateBlocked', not: 'ingridJoined', push: [11.5, 4.5] },
            { x: 10, y: 1, w: 4, h: 2, scene: 'rimefangBoss', need: 'ingridJoined', not: 'rimefangBeaten' },
            { x: 19, y: 11, w: 4, h: 4, scene: 'arriveFrosthold', once: 'seenFrosthold' },
        ],
        enemies: [{ kind: 'frostmite', x: 6.5, y: 13.5 }, { kind: 'snowwolf', x: 16.5, y: 5.5 }, { kind: 'frostmite', x: 17.5, y: 9.5 }],
    },

    spire: {
        name: 'The Hush Spire', theme: 'spire', music: { seed: 7741, bpm: 88, scale: 'phrygian', lyrics: 'hush' },
        rows: [
            'HHHHHHHHHHHHHHHHHHHHHHHH',
            'HHHHHHHH*##::##*HHHHHHHH',
            'HHHHHH*#...::...#*HHHHHH',
            'HHHHH#..*..::..*..#HHHHH',
            'HHHH#...p..::..p...#HHHH',
            'HHH#....,,,::,,,....#HHH',
            'HH#*...,,,,::,,,,...*#HH',
            'H#.....:::::::::::....#H',
            'H#.S...:..p....p..:..C#H',
            'H#.....:..........:...#H',
            'H#*....::::::::::::..*#H',
            'HH#........::........#HH',
            'HHH#....r..::..r....#HHH',
            'HHHH#......::......#HHHH',
            'HHHHH##....::....##HHHHH',
            'HHHHHHHHHHH::HHHHHHHHHHH',
        ],
        spawn: [11.5, 13.5],
        travel: { x: 9.5, y: 13.5 },
        npcs: [],
        chests: ['tonic'],
        exits: [],
        triggers: [
            { x: 2, y: 9, w: 20, h: 1, scene: 'wardenBoss', not: 'wardenBeaten' },
            { x: 11, y: 1, w: 2, h: 2, scene: 'throne', need: 'wardenBeaten' },
            { x: 9, y: 12, w: 6, h: 3, scene: 'arriveSpire', once: 'seenSpire' },
        ],
        enemies: [{ kind: 'hushknight', x: 5.5, y: 11.5, not: 'wardenBeaten' }, { kind: 'silencer', x: 18.5, y: 12.5, not: 'wardenBeaten' }, { kind: 'silencer', x: 6.5, y: 4.5 }, { kind: 'hushknight', x: 18.5, y: 4.5 }],
    },
};

/** Otto's route map. `need` unlocks a stop; `at` is where the band steps out. */
export const WORLD = {
    aurelune: { name: 'Aurelune', x: 0.18, y: 0.7, map: 'aurelune', at: [13.5, 3.5], need: 'surface', blurb: 'The drowned City of Song, under the world.' },
    marisonde: { name: 'Marisonde', x: 0.36, y: 0.32, map: 'marisonde', at: [2.5, 3.5], need: 'surface', blurb: 'Coral spires on a silver sea.' },
    sunreach: { name: 'Sunreach', x: 0.6, y: 0.62, map: 'sunreach', at: [2.5, 6.5], need: 'maelstraBeaten', blurb: 'Windmills and wheat, gone quiet.' },
    frosthold: { name: 'Frosthold', x: 0.8, y: 0.22, map: 'frosthold', at: [21.5, 13.5], need: 'hollowhayBeaten', blurb: 'A citadel of ice in the north.' },
    spire: { name: 'The Hush Spire', x: 0.52, y: 0.12, map: 'spire', at: [11.5, 13.5], need: 'rimefangBeaten', blurb: 'The dragon\'s tower, over the Crystal Hollow.' },
};

export const tileAt = (map, x, y) => {
    const m = typeof map === 'string' ? MAPS[map] : map;
    if (y < 0 || y >= m.rows.length || x < 0 || x >= m.rows[0].length) return ' ';
    return m.rows[y][x];
};

/** Where the chests are, in reading order, with their contents and ids. */
export function chestsOf(id) {
    const m = MAPS[id], out = [];
    let i = 0;
    m.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'C') out.push({ id: `${id}:${x},${y}`, x, y, item: m.chests[i++] }); });
    return out;
}
export function crystalOf(id) {
    const m = MAPS[id];
    for (let y = 0; y < m.rows.length; y++) { const x = m.rows[y].indexOf('S'); if (x >= 0) return { x, y }; }
    return null;
}
