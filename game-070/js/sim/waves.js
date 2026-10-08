// The attack waves of one loop. Counts are how many of each enemy the wave
// sends in total; `batch` is how many snatchers warp in at a time. Later loops
// scale counts and aggression (see waveFor).

export const WAVES = [
    { name: 'FIRST CONTACT', snatcher: 12, batch: 4 },
    { name: 'MINEFIELD', snatcher: 14, minelayer: 3, batch: 5 },
    { name: 'THE HIVE', snatcher: 14, minelayer: 2, hive: 1, squadron: 1, batch: 5 },
    { name: 'METEOR STORM', snatcher: 9, hive: 1, meteor: 12, batch: 3 },
    { name: 'THE HARVESTER', boss: 'harvester' },
    { name: 'DEEP RAID', snatcher: 16, minelayer: 3, hive: 2, squadron: 2, batch: 5 },
    { name: 'DARTS', snatcher: 10, squadron: 4, batch: 4 },
    { name: 'STONE RAIN', snatcher: 10, minelayer: 2, meteor: 18, batch: 4 },
    { name: 'SIEGE', snatcher: 18, minelayer: 3, hive: 3, squadron: 2, batch: 6 },
    { name: 'THE LEVIATHAN', boss: 'leviathan' },
    { name: 'ONSLAUGHT', snatcher: 20, minelayer: 4, hive: 3, squadron: 3, batch: 6 },
    { name: 'FIRESTORM', snatcher: 12, meteor: 18, squadron: 3, batch: 4 },
    { name: 'THE SWARM', snatcher: 12, hive: 6, batch: 4 },
    { name: 'LAST STAND', snatcher: 20, minelayer: 4, hive: 4, squadron: 3, meteor: 10, batch: 6 },
    { name: 'THE OVERSEER', boss: 'overseer' },
];

export const WAVE_COUNT = WAVES.length;

/** Wave definition for a 0-based wave index within a loop, scaled for the loop. */
export function waveFor(index, loop) {
    const base = WAVES[index];
    const k = 1 + loop * 0.25;
    const w = { ...base, index, loop, aggr: 1 + index * 0.035 + loop * 0.3 };
    for (const key of ['snatcher', 'minelayer', 'hive', 'squadron', 'meteor']) {
        if (w[key]) w[key] = Math.round(w[key] * k);
    }
    if (w.batch) w.batch = Math.min(8, w.batch + loop);
    return w;
}

/** The waves after which the planet is rebuilt. */
export const isBoss = (index) => !!WAVES[index].boss;
