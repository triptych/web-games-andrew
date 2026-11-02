// Everything the band duels. hp and atk are at difficulty Normal; `notes` is how many notes the enemy plays per bar in its
// call, `holds` and `doubles` the chance a note is a sustained roar or a two-lane chord. `timbre` picks its voice in audio.js,
// `sprite`/`pal` its body in js/view/monsters.js. `scale` is the mode its songs are written in.

export const ENEMIES = {
    // ---- Aurelune, the drowned city
    shardcrab: { name: 'Shardcrab', sprite: 'crab', pal: 'crystal', hp: 340, atk: 8, bpm: 96, notes: 2.5, timbre: 'pluck', xp: 14, scale: 'dorian', size: 1.3, drop: { lozenge: 0.3 } },
    gloomwisp: { name: 'Gloomwisp', sprite: 'wisp', pal: 'gloom', hp: 390, atk: 10, bpm: 104, notes: 3, timbre: 'hush', xp: 18, scale: 'minor', size: 1.2, drop: { lozenge: 0.25 } },
    rustling: { name: 'Rustling', sprite: 'automaton', pal: 'rust', hp: 480, atk: 10, bpm: 100, notes: 3, timbre: 'buzz', xp: 22, scale: 'dorian', size: 1.4, drop: { lozenge: 0.3 } },
    // ---- Marisonde, the coral spires
    reefgob: { name: 'Reef Goblin', sprite: 'fishman', pal: 'reef', hp: 870, atk: 14, bpm: 108, notes: 3, timbre: 'pluck', xp: 34, scale: 'mixo', size: 1.35, drop: { lozenge: 0.3 } },
    jellyhush: { name: 'Hushjelly', sprite: 'jelly', pal: 'violet', hp: 830, atk: 15, bpm: 112, notes: 3.5, timbre: 'bell', xp: 36, scale: 'dorian', size: 1.3, holds: 0.15, drop: { tonic: 0.15 } },
    maelstra: { name: 'Maelstra, the Tidewyrm', sprite: 'serpent', pal: 'tide', hp: 4200, atk: 19, bpm: 116, notes: 4, timbre: 'growl', xp: 160, scale: 'minor', size: 3.4, boss: true, holds: 0.15, doubles: 0.1, drop: { tonic: 1 }, charm: 'pearl' },
    // ---- Sunreach, the windmill fields
    crowl: { name: 'Crowl Knight', sprite: 'bird', pal: 'crow', hp: 1430, atk: 19, bpm: 118, notes: 3.5, timbre: 'buzz', xp: 52, scale: 'mixo', size: 1.45, doubles: 0.05, drop: { lozenge: 0.35 } },
    thornling: { name: 'Thornling', sprite: 'imp', pal: 'thorn', hp: 1290, atk: 20, bpm: 122, notes: 4, timbre: 'pluck', xp: 50, scale: 'major', size: 1.15, drop: { lozenge: 0.35 } },
    hollowhay: { name: 'Baron Hollowhay', sprite: 'scarecrow', pal: 'hay', hp: 7560, atk: 22, bpm: 124, notes: 4.5, timbre: 'growl', xp: 260, scale: 'phrygian', size: 3.2, boss: true, holds: 0.15, doubles: 0.14, drop: { tonic: 1 }, charm: 'plume' },
    // ---- Frosthold, the northern citadel
    frostmite: { name: 'Frostmite', sprite: 'mite', pal: 'ice', hp: 2250, atk: 29, bpm: 126, notes: 4, timbre: 'bell', xp: 70, scale: 'dorian', size: 1.2, drop: { lozenge: 0.4 } },
    snowwolf: { name: 'Hoarwolf', sprite: 'wolf', pal: 'snow', hp: 2530, atk: 31, bpm: 128, notes: 4, timbre: 'growl', xp: 76, scale: 'minor', size: 1.6, doubles: 0.08, drop: { tonic: 0.2 } },
    rimefang: { name: 'Rimefang, the Frozen Knight', sprite: 'wolfknight', pal: 'rime', hp: 12040, atk: 35, bpm: 130, notes: 5, timbre: 'buzz', xp: 380, scale: 'harm', size: 3.4, boss: true, holds: 0.15, doubles: 0.15, drop: { tonic: 1 }, charm: 'rimeglass' },
    // ---- The Hush Spire
    hushknight: { name: 'Hush Knight', sprite: 'knight', pal: 'obsidian', hp: 3910, atk: 37, bpm: 132, notes: 4.5, timbre: 'buzz', xp: 110, scale: 'phrygian', size: 1.7, doubles: 0.12, holds: 0.08, drop: { lozenge: 0.5 } },
    silencer: { name: 'Silent Moth', sprite: 'moth', pal: 'hush', hp: 3450, atk: 35, bpm: 136, notes: 4.5, timbre: 'hush', xp: 104, scale: 'minor', size: 1.6, holds: 0.15, drop: { tonic: 0.3 } },
    warden: { name: 'The Obsidian Warden', sprite: 'warden', pal: 'obsidian', hp: 16800, atk: 38, bpm: 134, notes: 5, timbre: 'growl', xp: 520, scale: 'harm', size: 3.6, boss: true, holds: 0.16, doubles: 0.18, drop: { tonic: 1 }, charm: 'locket' },
    vorthrax: { name: 'Vorthrax, the Hush Eternal', sprite: 'dragon', pal: 'hush', hp: 25200, atk: 43, bpm: 140, notes: 5, timbre: 'hush', xp: 0, scale: 'phrygian', size: 5.6, boss: true, final: true, holds: 0.18, doubles: 0.2 },
};

/** Which roaming enemies live where, for the bestiary and the tests. */
export const AREA_ENEMIES = {
    beach: ['shardcrab'], aurelune: ['gloomwisp', 'rustling'], marisonde: ['reefgob', 'jellyhush'],
    sunreach: ['crowl', 'thornling'], frosthold: ['frostmite', 'snowwolf'], spire: ['hushknight', 'silencer'],
};
