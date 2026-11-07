// The asteroids. One row per level: the rock's radius, its maze density (N cells a cube face,
// so 6·N² cells in all), how many beacon turrets guard it, and what comes out of their hangars.

export const LEVELS = [
    { name: 'HIMALIA',  title: 'The First Signal',      R: 11, N: 4, turrets: 3, tkinds: ['gun'],                    braid: 0.28, cap: 5,  spawn: 5.5, kinds: { drone: 1 } },
    { name: 'THEBE',    title: 'Echoes in the Rock',    R: 12, N: 5, turrets: 4, tkinds: ['gun', 'gun', 'burst'],     braid: 0.26,  cap: 6,  spawn: 5.0, kinds: { drone: 2, seeker: 1 } },
    { name: 'ADRASTEA', title: 'A Lattice of Lights',   R: 13, N: 5, turrets: 5, tkinds: ['gun', 'burst'],            braid: 0.24, cap: 7,  spawn: 4.6, kinds: { drone: 2, seeker: 2 } },
    { name: 'METIS',    title: 'The Watchers',          R: 14, N: 6, turrets: 5, tkinds: ['gun', 'burst', 'ring'],    braid: 0.22, cap: 8,  spawn: 4.3, kinds: { drone: 2, seeker: 2, shard: 1 } },
    { name: 'LEDA',     title: 'Silence Between Stars', R: 15, N: 6, turrets: 6, tkinds: ['gun', 'burst', 'ring'],    braid: 0.21, cap: 9,  spawn: 4.0, kinds: { drone: 2, seeker: 2, shard: 2 } },
    { name: 'ELARA',    title: 'The Long Night',        R: 16, N: 7, turrets: 6, tkinds: ['burst', 'ring', 'gun'],    braid: 0.2, cap: 10,  spawn: 3.8, kinds: { drone: 2, seeker: 3, shard: 2 } },
    { name: 'CARME',    title: 'Toward the Sun',        R: 17, N: 7, turrets: 7, tkinds: ['burst', 'ring', 'ring'],   braid: 0.19,  cap: 11, spawn: 3.6, kinds: { drone: 2, seeker: 3, shard: 3 } },
    { name: 'SINOPE',   title: 'Perihelion',            R: 18, N: 8, turrets: 4, tkinds: ['ring', 'burst'],           braid: 0.22, cap: 9,  spawn: 4.0, kinds: { drone: 1, seeker: 3, shard: 2 }, boss: true },
];

/** What the mission computer says as each asteroid comes into view. */
export const BRIEFS = [
    'Three beacons are transmitting from this rock. Silence them, and the gate will open.',
    'The signal has moved. It is stronger here. I would advise caution, Commander.',
    'The beacons are linked. When one falls, the others listen.',
    'Some of the shapes here are moving. They were not moving before.',
    'I am reading no life signs, and yet something is building these machines.',
    'We are a long way from home now. The sun is only a bright star behind us.',
    'The lattice is drawing us inward. Every gate points toward the sun.',
    'This is where the signal begins. Four pylons shield its source. I am not afraid. Are you?',
];
