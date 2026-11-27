// One Shot — the motherships, their defenses and the lines spoken around them. Pure data.
//
// req:    what the Lance must reach. speed vs the ship's evasion, the elemental total (after resistances)
//         vs its barrier, power vs its armor. All three must be met for the shot to destroy it.
// resist: per element, 0.8 = the barrier soaks 80% of it, -0.5 = it takes 150%.
// shift:  the barrier's resistances rotate between the elements every `every` seconds.
// jam:    the ship jams the board, turning a tile to static every `every` seconds of a round (at most `max`).
// drones: interceptors launched while you charge.
// art:    the brief the reference picture and the Meshy model were made from.

export const BOSSES = [
    {
        id: 'picket', name: 'Picket Ark', title: 'The Choir’s Vanguard', reward: 60,
        req: { speed: 240, barrier: 600, armor: 320 },
        resist: { thermal: 0, cryo: 0, volt: 0 },
        roundTime: 28, waves: [
            { count: 3, max: 2, hp: 5, dmg: 6, name: 'Picket Wing' },
            { count: 4, max: 2, hp: 5, dmg: 6, name: 'Hangar Swarm' },
        ],
        hue: 0x9fb6ff,
        art: 'a long armored alien battle-carrier shaped like a spearhead, slate blue hull plates, a ring of pale blue lights along its spine, small hangar mouths along the flanks',
        intel: 'A forward carrier. No elemental tuning, thin armor. A good place to learn the Lance.',
    },
    {
        id: 'ember', name: 'Ember Citadel', title: 'Furnace of the Choir', reward: 90,
        req: { speed: 650, barrier: 1400, armor: 800 },
        resist: { thermal: 0.8, cryo: -0.5, volt: 0.2 },
        roundTime: 28, waves: [
            { count: 4, max: 2, hp: 6, dmg: 7, name: 'Cinder Wing' },
            { count: 5, max: 3, hp: 6, dmg: 7, name: 'Slag Lancers' },
            { count: 5, max: 3, hp: 7, dmg: 8, name: 'Furnace Guard' },
        ],
        hue: 0xff6a3a,
        art: 'a fortress-like alien mothership of dark red armor with glowing orange magma seams, crown of heat-vent spires, a molten orange core visible through its front grille',
        intel: 'Its barrier runs hot: Thermal barely scratches it. Cryo cracks it wide open.',
    },
    {
        id: 'glacier', name: 'Glacier Maw', title: 'The Frozen Bulwark', reward: 120,
        req: { speed: 800, barrier: 2000, armor: 1050 },
        resist: { thermal: -0.5, cryo: 0.85, volt: 0 },
        roundTime: 28, waves: [
            { count: 4, max: 3, hp: 6, dmg: 7, name: 'Rime Wing' },
            { count: 5, max: 3, hp: 6, dmg: 7, name: 'Shard Lancers' },
            { count: 6, max: 3, hp: 7, dmg: 8, name: 'Maw Guard' },
        ],
        hue: 0x8ff0ff,
        art: 'a massive alien mothership like a jagged iceberg of white and pale cyan crystal armor plates, a wide jagged intake mouth at the front glowing icy blue, frost mist trailing',
        intel: 'Armor like a glacier. Pour on Power. Its barrier drinks Cryo; burn it with Thermal.',
    },
    {
        id: 'storm', name: 'Storm Lattice', title: 'The Lightning Weaver', reward: 150,
        req: { speed: 1250, barrier: 2100, armor: 1050 },
        resist: { thermal: 0.2, cryo: -0.3, volt: 0.85 },
        roundTime: 28, waves: [
            { count: 5, max: 3, hp: 6, dmg: 7, name: 'Arc Wing' },
            { count: 6, max: 3, hp: 7, dmg: 7, name: 'Spark Lancers' },
            { count: 6, max: 4, hp: 7, dmg: 8, name: 'Lattice Guard' },
        ],
        jam: { first: 6, every: 7, max: 5 },
        hue: 0xc08cff,
        art: 'a fast sleek arrowhead-shaped alien mothership of violet armor wrapped by three thick metal rings crackling with purple lightning arcs, a bright lilac electric core in the center',
        intel: 'Fast. Very fast. Without Speed the Lance just misses. It jams the board with static.',
    },
    {
        id: 'prism', name: 'Prism Cathedral', title: 'The Shifting Choir', reward: 190,
        req: { speed: 1250, barrier: 2700, armor: 1400 },
        resist: { thermal: 0.9, cryo: 0.2, volt: -0.5 },
        shift: { every: 11, set: [0.9, 0.2, -0.5] },
        roundTime: 28, waves: [
            { count: 5, max: 3, hp: 7, dmg: 8, name: 'Choir Wing' },
            { count: 6, max: 4, hp: 7, dmg: 8, name: 'Halo Lancers' },
            { count: 7, max: 4, hp: 8, dmg: 8, name: 'Cathedral Guard' },
        ],
        hue: 0xfff08a,
        art: 'a cathedral-shaped alien mothership of white and gold armor with tall spires and huge faceted prism crystals that refract rainbow light, stained-glass panels glowing',
        intel: 'Its barrier rotates its tuning every few seconds. Charge, watch the prism, and time your shot.',
    },
    {
        id: 'throne', name: 'Throne of the Choir', title: 'The Mothership', reward: 260,
        req: { speed: 1800, barrier: 4000, armor: 2100 },
        resist: { thermal: 0.75, cryo: 0.3, volt: -0.3 },
        shift: { every: 12, set: [0.75, 0.3, -0.3] },
        jam: { first: 8, every: 8, max: 5 },
        roundTime: 30, waves: [
            { count: 6, max: 3, hp: 7, dmg: 8, name: 'Throne Wing' },
            { count: 7, max: 4, hp: 8, dmg: 8, name: 'Royal Lancers' },
            { count: 7, max: 4, hp: 8, dmg: 9, name: 'Crown Guard' },
            { count: 8, max: 4, hp: 9, dmg: 9, name: 'The Last Choir' },
        ],
        hue: 0xff4fa8,
        art: 'a colossal organic-mechanical alien mothership shaped like a crowned throne or a giant manta, black and magenta armor, a huge glowing pink spherical core, rows of hangar lights, ominous halo ring behind it',
        intel: 'The Throne itself. Everything at once: speed, armor, a shifting barrier, jammers. One shot. Make it count.',
    },
];

export const BOSS_COUNT = BOSSES.length;

/** Briefing and result lines: who says them, the text, and the voice clip that plays it. */
export const LINES = {
    intro: [
        { who: 'mira', vo: 'mira-intro', text: 'Fleet signal lost. We are the last ship, Juno. The Solitaire and the Lance.' },
        { who: 'juno', vo: 'juno-intro', text: 'Then we make every shot count. One mothership, one shot.' },
    ],
    brief: {
        picket: [{ who: 'mira', vo: 'mira-picket', text: 'Picket Ark ahead. Match resonance to charge the Lance. Interceptors inbound.' }],
        ember: [{ who: 'mira', vo: 'mira-ember', text: 'Ember Citadel. Its barrier burns. Cold will break it.' }],
        glacier: [{ who: 'mira', vo: 'mira-glacier', text: 'Glacier Maw. Heavy armor. We need raw power, and heat.' }],
        storm: [{ who: 'mira', vo: 'mira-storm', text: 'Storm Lattice. It moves faster than our beam. Charge speed first.' }],
        prism: [{ who: 'mira', vo: 'mira-prism', text: 'Prism Cathedral. The barrier is shifting. Watch the prism, then fire.' }],
        throne: [
            { who: 'mira', vo: 'mira-throne', text: 'The Throne of the Choir. This is it.' },
            { who: 'juno', vo: 'juno-throne', text: 'For everyone who didn’t make it this far. Let’s go.' },
        ],
    },
    launch: { who: 'juno', vo: 'juno-launch', text: 'Solitaire, launching!' },
    fire: { who: 'juno', vo: 'juno-fire', text: 'Lance, full power! One... SHOT!' },
    destroyed: { who: 'juno', vo: 'juno-win', text: 'Target down! Ha!' },
    survived: { who: 'mira', vo: 'mira-fail', text: 'It’s still standing. Pull back and re-tune the Lance.' },
    downed: { who: 'juno', vo: 'juno-downed', text: 'Hull breach! Firing everything we have!' },
    lowHull: { who: 'mira', vo: 'mira-hull', text: 'Hull critical!' },
    shift: { who: 'mira', vo: 'mira-shift', text: 'Barrier shifting!' },
    clear: { who: 'juno', vo: 'juno-clear', text: 'Wave down! Route it, Mira!' },
    rush: { who: 'juno', vo: 'juno-rush', text: 'Faster! Keep it coming!' },
    exposed: { who: 'mira', vo: 'mira-exposed', text: 'The mothership is exposed. Final charge, Juno!' },
    ending: [
        { who: 'mira', vo: 'mira-end', text: 'The Throne is gone. The Choir is silent.' },
        { who: 'juno', vo: 'juno-end', text: 'One ship. One shot. We’re going home, Mira.' },
    ],
};
