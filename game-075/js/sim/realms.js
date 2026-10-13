// The six realms. Each map is a grid of rooms written as characters, with
// connectors between them:
//
//   rows 0, 2, 4…   room characters at columns 0, 2, 4…, horizontal links between them ('-')
//   rows 1, 3, 5…   vertical links under each room ('|' open, '!' the grey-pixel barrier)
//
// Room characters:
//   H  Sunset Keep courtyard (home)      h  Sunset Keep vault (the goal)
//   G B P N V  castle courtyards (gold, onyx, pearl, neon, violet)
//   C  the Chrome Citadel courtyard      A  the arena (the Citadel's vault)
//   v  a castle vault (belongs to the courtyard below it; joined by its gate)
//   O open field   M labyrinth   K catacomb (dark)   R data river   L lasers
//   T teleporter   X cracked walls   S secret room   .  nothing
//
// `at` positions are in tiles inside the room (40 × 25). The builder moves an
// item to the nearest floor tile if its spot is solid, so maze rooms can use
// rough positions.

export const CASTLE_COLOR = { H: 'sunset', G: 'gold', B: 'onyx', P: 'pearl', N: 'neon', V: 'violet', C: 'chrome' };

export const REALMS = [
    {
        id: 1, name: 'SUNSET GATE', song: 'r1', style: 'sunset', par: 200, seed: 1101,
        blurb: ['THE CHALICE IS LOCKED IN THE GOLD KEEP.', 'FIND THE GOLD KEY. CARRY THE CHALICE HOME.'],
        map: [
            'h . v ',
            '|   | ',
            'H-O-G ',
            '| | | ',
            'O-M-O ',
        ],
        rooms: {
            '0,0': { name: 'SUNSET KEEP VAULT' },
            '0,1': { name: 'THE SUNSET KEEP' },
            '1,1': { name: 'NEON MEADOW' },
            '2,1': { name: 'THE GOLD KEEP' },
            '2,0': { name: 'GOLD VAULT' },
            '0,2': { name: 'PALM GROVE' },
            '1,2': { name: 'THE HEDGE GRID' },
            '2,2': { name: 'AMBER FIELDS' },
        },
        items: [
            { kind: 'sword', room: '1,1', at: [20, 17] },
            { kind: 'key', color: 'gold', room: '2,2', at: [26, 12] },
            { kind: 'chalice', room: '2,0', at: [20, 12] },
        ],
        pickups: [
            { kind: 'cassette', room: '0,2', at: [5, 20] },
            { kind: 'battery', room: '1,2', at: [20, 12] },
        ],
        dragons: [{ kind: 'aurix', room: '1,2', at: [20, 12] }],
        bat: false,
    },
    {
        id: 2, name: 'GRIDLOCK LABYRINTH', song: 'r2', style: 'grid', par: 260, seed: 2207,
        blurb: ['THE CHALICE IS IN THE ONYX KEEP.', 'ITS KEY IS LOCKED IN THE GOLD KEEP.'],
        map: [
            'h . v . ',
            '|   |   ',
            'H-M-B-O ',
            '| | |   ',
            'M-M-M v ',
            '|   | | ',
            'O-M-M-G ',
        ],
        rooms: {
            '0,0': { name: 'SUNSET KEEP VAULT' },
            '0,1': { name: 'THE SUNSET KEEP' },
            '2,1': { name: 'THE ONYX KEEP' },
            '2,0': { name: 'ONYX VAULT' },
            '3,1': { name: 'MAGNET YARD', pocket: [30, 15] },
            '3,3': { name: 'THE GOLD KEEP' },
            '3,2': { name: 'GOLD VAULT' },
            '0,3': { name: 'BLUE PLAZA' },
        },
        items: [
            { kind: 'sword', room: '1,1', at: [20, 12] },
            { kind: 'key', color: 'gold', room: '0,2', at: [20, 12] },
            { kind: 'magnet', room: '3,1', at: [20, 12] },
            { kind: 'key', color: 'onyx', room: '3,2', at: [20, 12] },
            { kind: 'chalice', room: '2,0', at: [20, 12] },
        ],
        pickups: [
            { kind: 'cassette', room: '3,1', at: [31, 16] },
            { kind: 'battery', room: '0,3', at: [8, 18] },
            { kind: 'oneup', room: '2,3', at: [20, 12] },
        ],
        dragons: [
            { kind: 'verdox', room: '0,2', at: [12, 12], guard: 'key:gold' },
            { kind: 'aurix', room: '1,3', at: [20, 12] },
        ],
        bat: { room: '2,2', at: [20, 12] },
    },
    {
        id: 3, name: 'STATIC CATACOMBS', song: 'r3', style: 'static', par: 300, seed: 3313,
        blurb: ['THE CATACOMBS ARE DARK. TAKE THE LAMP.', 'THE PEARL KEEP HOLDS THE CHALICE.'],
        map: [
            'h . . S ',
            '|     ! ',
            'H-K-K-K ',
            '| |   | ',
            'K-K v K ',
            '| | | | ',
            'K-K-P-K ',
        ],
        rooms: {
            '0,0': { name: 'SUNSET KEEP VAULT' },
            '0,1': { name: 'THE SUNSET KEEP' },
            '3,0': { name: '???' },
            '3,1': { name: 'THE STATIC WALL' },
            '2,3': { name: 'THE PEARL KEEP' },
            '2,2': { name: 'PEARL VAULT' },
        },
        items: [
            { kind: 'lamp', room: '0,1', at: [12, 18] },
            { kind: 'sword', room: '0,2', at: [20, 12] },
            { kind: 'key', color: 'pearl', room: '3,3', at: [24, 14] },
            { kind: 'magnet', room: '0,3', at: [20, 12] },
            { kind: 'pixel', room: '1,1', at: [8, 20] },
            { kind: 'chalice', room: '2,2', at: [20, 12] },
        ],
        pickups: [
            { kind: 'cassette', room: '3,2', at: [30, 18] },
            { kind: 'battery', room: '1,2', at: [20, 12] },
        ],
        dragons: [
            { kind: 'verdox', room: '3,3', at: [18, 12], guard: 'key:pearl' },
            { kind: 'scarlax', room: '1,3', at: [20, 12] },
            { kind: 'aurix', room: '3,1', at: [20, 16] },
        ],
        bat: { room: '1,2', at: [20, 12] },
    },
    {
        id: 4, name: 'CHROME RIVERS', song: 'r4', style: 'river', par: 300, seed: 4421,
        blurb: ['DATA RIVERS CUT THE LAND. LAY THE BRIDGE.', 'THE NEON KEY LIES ACROSS THE WATER.'],
        map: [
            'h . v . ',
            '|   |   ',
            'H-O-N-L ',
            '| |   | ',
            'L-R-O-R ',
            '  |   | ',
            'O-O-R-O ',
        ],
        rooms: {
            '0,0': { name: 'SUNSET KEEP VAULT' },
            '0,1': { name: 'THE SUNSET KEEP' },
            '2,1': { name: 'THE NEON KEEP' },
            '2,0': { name: 'NEON VAULT' },
            '1,2': { name: 'BINARY FALLS', chasm: 'h' },
            '3,2': { name: 'THE CHROME FORD', chasm: 'h' },
            '2,3': { name: 'STREAMLINE', chasm: 'v' },
            '3,3': { name: 'FROZEN BANK' },
            '0,3': { name: 'LOW DELTA' },
        },
        items: [
            { kind: 'bridge', room: '0,1', at: [28, 18] },
            { kind: 'sword', room: '2,2', at: [20, 12] },
            { kind: 'shield', room: '3,1', at: [30, 18] },
            { kind: 'key', color: 'neon', room: '3,3', at: [24, 14] },
            { kind: 'chalice', room: '2,0', at: [20, 12] },
        ],
        pickups: [
            { kind: 'cassette', room: '0,3', at: [6, 6] },
            { kind: 'battery', room: '0,2', at: [20, 12] },
            { kind: 'oneup', room: '1,3', at: [8, 18] },
        ],
        dragons: [
            { kind: 'cryovex', room: '3,3', at: [18, 12], guard: 'key:neon' },
            { kind: 'verdox', room: '0,3', at: [14, 12] },
        ],
        bridges: [
            { room: '1,2', tx: 20, ty: 18, orient: 'v' },
            { room: '3,2', tx: 20, ty: 18, orient: 'v' },
            { room: '2,3', tx: 29, ty: 12, orient: 'h' },
        ],
        bat: { room: '2,2', at: [10, 10] },
    },
    {
        id: 5, name: 'VAPOR VAULT', song: 'r5', style: 'vapor', par: 340, seed: 5531,
        blurb: ['CRACKED WALLS NEED A PLASMA CHARGE.', 'THE GOLD KEEP HOLDS THE VIOLET KEY.'],
        map: [
            'h . v . v ',
            '|   |   | ',
            'H-T V-X-G ',
            '| |   | | ',
            'O-M-M-T T ',
            '| | |   | ',
            'T-O-X-M-O ',
        ],
        rooms: {
            '0,0': { name: 'SUNSET KEEP VAULT' },
            '0,1': { name: 'THE SUNSET KEEP' },
            '2,1': { name: 'THE VIOLET KEEP' },
            '2,0': { name: 'VIOLET VAULT' },
            '4,1': { name: 'THE GOLD KEEP' },
            '4,0': { name: 'GOLD VAULT' },
            '3,1': { name: 'THE FAULT LINE', crack: 'wall', crackAt: 11 },
            '2,3': { name: 'THE SEALED ROOM', crack: 'pocket', pocketAt: [20, 12] },
            '0,2': { name: 'CHARGE DEPOT', dispenser: [20, 12] },
        },
        items: [
            { kind: 'sword', room: '1,3', at: [20, 12] },
            { kind: 'key', color: 'gold', room: '2,3', at: [20, 12] },
            { kind: 'key', color: 'violet', room: '4,0', at: [20, 12] },
            { kind: 'magnet', room: '3,3', at: [20, 12] },
            { kind: 'shield', room: '0,1', at: [28, 18] },
            { kind: 'chalice', room: '2,0', at: [20, 12] },
        ],
        pickups: [
            { kind: 'cassette', room: '4,1', at: [35, 21] },
            { kind: 'battery', room: '1,2', at: [20, 12] },
            { kind: 'oneup', room: '4,3', at: [30, 18] },
        ],
        tele: [['1,1', '3,2'], ['0,3', '4,2']],
        dragons: [
            { kind: 'luma', room: '1,2', at: [20, 12] },
            { kind: 'nox', room: '3,3', at: [20, 12] },
            { kind: 'scarlax', room: '2,2', at: [20, 12] },
        ],
        bat: { room: '0,3', at: [10, 10] },
    },
    {
        id: 6, name: 'THE CHROME CITADEL', song: 'r6', style: 'citadel', par: 420, seed: 6661,
        blurb: ['THREE DRAGONS CARRY THE CHROME SHARDS.', 'OPEN THE CITADEL. FACE CHROMAGON.'],
        map: [
            'h . A . ',
            '|   |   ',
            'H-L-C-L ',
            '| | | | ',
            'M-K-O-R ',
            '| | | | ',
            'O-M-L-O ',
        ],
        rooms: {
            '0,0': { name: 'SUNSET KEEP VAULT' },
            '0,1': { name: 'THE SUNSET KEEP' },
            '2,1': { name: 'THE CHROME CITADEL' },
            '2,0': { name: 'THE CROWN OF THE GRID' },
            '3,2': { name: 'MERCURY RUN', chasm: 'h' },
            '3,3': { name: 'THE FAR BANK' },
            '1,2': { name: 'THE UNDERCROFT' },
        },
        items: [
            { kind: 'sword', room: '0,1', at: [28, 18] },
            { kind: 'shield', room: '1,1', at: [20, 20] },
            { kind: 'lamp', room: '0,2', at: [20, 12] },
            { kind: 'bridge', room: '2,2', at: [20, 18] },
        ],
        pickups: [
            { kind: 'cassette', room: '3,2', at: [20, 21] },
            { kind: 'oneup', room: '3,2', at: [30, 21] },
            { kind: 'battery', room: '1,3', at: [20, 12] },
            { kind: 'battery', room: '2,2', at: [8, 6] },
        ],
        dragons: [
            { kind: 'aurix', room: '0,2', at: [20, 12], shard: true },
            { kind: 'verdox', room: '3,3', at: [20, 12], shard: true },
            { kind: 'scarlax', room: '1,3', at: [20, 12], shard: true },
        ],
        bridges: [{ room: '3,2', tx: 20, ty: 18, orient: 'v' }],
        boss: { room: '2,0' },
        bat: { room: '3,1', at: [20, 10] },
    },
];

/** Default room names by type, for rooms the realm doesn't name. */
export const TYPE_NAMES = {
    O: ['OPEN GRID', 'NEON FIELD', 'SYNTH PLAINS', 'THE COMMONS', 'LASER LAWN', 'VECTOR PARK'],
    M: ['THE LABYRINTH', 'BLUE CORRIDORS', 'GRID MAZE', 'WIRE WALKS', 'CIRCUIT HALLS'],
    K: ['CATACOMB', 'THE DARK', 'STATIC HALLS', 'BLACK TUNNELS', 'THE CRYPT'],
    R: ['DATA RIVER', 'THE RAPIDS'],
    L: ['LASER GALLERY', 'BEAM HALL', 'THE GRATING'],
    T: ['TELEPORT HUB', 'WARP PAD'],
    X: ['CRACKED HALL'],
    A: ['THE ARENA'],
    S: ['???'],
};
