// The campaign: three sectors, twelve sorties, a boss at the end of each sector.
// objectives: hives = destroy N enemy hives; rescue = free these crew; survive = hold out N s; boss = kill the kaiju.
// d scales enemy hp, damage and spawn rate. reward is the credits paid on success.

export const SECTORS = {
    prairie: { name: 'Glass Prairie', mat: 'crystal', alt: 'stone', ground: 0x3d6b4f, ground2: 0x4e8a5f, sky: [0xff9e6b, 0x6b4fd8],
        art: 'a wide grassy prairie at sunset dotted with giant translucent cyan crystal outcrops shaped like stacked cubes, distant mountains' },
    canyon: { name: 'Rust Canyons', mat: 'rust', alt: 'stone', ground: 0x8a5a3c, ground2: 0x9c6a48, sky: [0xffc46b, 0xd8504f],
        art: 'a deep red rock canyon with rusted abandoned industrial machinery and a cracked dam, cube-shaped boulders, hot orange evening light' },
    city: { name: 'Neon Megalopolis', mat: 'neon', alt: 'stone', ground: 0x2b2d4a, ground2: 0x34375a, sky: [0xff4fd8, 0x1a1050],
        art: 'a ruined night-time megacity of glowing neon towers half turned into floating violet cubes, rain, magenta and cyan signs with no readable text' },
};

export const MISSIONS = [
    { id: 1, sector: 'prairie', name: 'First Sortie', d: 1.0, reward: 120,
        brief: 'Two civilians are trapped in Cubeborn cages near the old wind farm. Get them out. Remember: anything you blow up turns to voxels. Grab them, or let them pile up as cover.',
        objectives: [{ kind: 'rescue', crew: ['hana', 'gen'] }] },
    { id: 2, sector: 'prairie', name: 'Hive Breaker', d: 1.15, reward: 150,
        brief: 'Two hives are pumping out monsters across the prairie. Rockets crack hives fastest. Burn them down.',
        objectives: [{ kind: 'hives', count: 2 }] },
    { id: 3, sector: 'prairie', name: 'Glass Mill Holdout', d: 1.3, reward: 180,
        brief: 'Kids are hiding in the glass mill. Free them and hold the line for ninety seconds while the evac ship lands.',
        objectives: [{ kind: 'rescue', crew: ['twins'] }, { kind: 'survive', time: 90 }] },
    { id: 4, sector: 'prairie', name: 'Prism Behemoth', d: 1.4, reward: 260, boss: 'behemoth',
        brief: 'Something huge just crawled out of the Lattice rift. It rings itself with crystal shards before it fires. When it glows, move!',
        objectives: [{ kind: 'boss' }] },

    { id: 5, sector: 'canyon', name: 'Canyon Convoy', d: 1.6, reward: 220,
        brief: 'A refugee convoy was swallowed by the canyon. Three survivors are caged along the riverbed.',
        objectives: [{ kind: 'rescue', crew: ['sato', 'rin', 'goro'] }] },
    { id: 6, sector: 'canyon', name: 'Rust Hives', d: 1.8, reward: 250,
        brief: 'Three hives have dug into the canyon walls. The rock is thick here. Cut your own road if you have to.',
        objectives: [{ kind: 'hives', count: 3 }] },
    { id: 7, sector: 'canyon', name: 'Dam Break', d: 2.0, reward: 280,
        brief: 'Two hives are guarding the dam, and two people are caged on the spillway. Do both.',
        objectives: [{ kind: 'hives', count: 2 }, { kind: 'rescue', crew: ['miko', 'benji'] }] },
    { id: 8, sector: 'canyon', name: 'Rust Centipede', d: 2.1, reward: 360, boss: 'centipede',
        brief: 'A rust-plated kaiju is chewing through the canyon. It charges, it stomps, it calls the swarm. It will not stop on its own.',
        objectives: [{ kind: 'boss' }] },

    { id: 9, sector: 'city', name: 'Neon Crossing', d: 2.3, reward: 300,
        brief: 'Professor Ume is holed up under the crossing. Free her, then hold out two minutes for the lift.',
        objectives: [{ kind: 'rescue', crew: ['ume'] }, { kind: 'survive', time: 120 }] },
    { id: 10, sector: 'city', name: 'Tower District', d: 2.5, reward: 330,
        brief: 'Three cages hang between the towers. The swarm is thick downtown. Make the buildings your weapons.',
        objectives: [{ kind: 'rescue', crew: ['saki', 'ota', 'nana'] }] },
    { id: 11, sector: 'city', name: 'Heart of the Lattice', d: 2.7, reward: 380,
        brief: 'Four hives feed the rift itself. Break them all and the Queen will have to come out.',
        objectives: [{ kind: 'hives', count: 4 }] },
    { id: 12, sector: 'city', name: 'Lattice Queen', d: 2.8, reward: 600, boss: 'queen',
        brief: 'This is it, Kai. The Lattice Queen. Everything we have is riding on Unit-07. Shardframe, launch!',
        objectives: [{ kind: 'boss' }] },
];

export const missionById = (id) => MISSIONS.find((m) => m.id === id);
export const LAST_MISSION = MISSIONS[MISSIONS.length - 1].id;
