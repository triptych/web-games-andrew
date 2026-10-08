/**
 * tracks.js — every track in the game, grouped by environment. Shapes, elevation features and
 * surface patches are described in js/sim/track.js. dev/simtest.mjs checks each one: no part of
 * the loop comes near another (except the bridge of a figure eight), no bend is tighter than a car
 * can take, and a bot can lap it.
 */


export const ENVS = {
    flats:  { name: 'Dustwater Flats',  surface: 'dirt',    shoulder: 'grass' },
    woods:  { name: 'Pinecrest Woods',  surface: 'loam',    shoulder: 'grass' },
    canyon: { name: 'Redrock Canyon',   surface: 'redclay', shoulder: 'sand' },
    bayou:  { name: 'Gatorback Bayou',  surface: 'swamp',   shoulder: 'bog' },
    frost:  { name: 'Frostbite Pass',   surface: 'pack',    shoulder: 'snow' },
    dome:   { name: 'The Thunderdome',  surface: 'clay',    shoulder: 'dirt' },
    mesa:   { name: 'Ravenwood Mesa',   surface: 'dirt',    shoulder: 'sand' },
};

export const TRACKS = {
    // ============================================================ DUSTWATER FLATS — farm country
    'barnyard': {
        name: 'Barnyard Oval', env: 'flats', hw: 8, shoulder: 5, bank: 1.0,
        shape: { type: 'polar', R: 92, sx: 1.55, sz: 0.72, harm: [[2, 0.05, 0]] },
        coins: [{ u: 0.12, n: 6 }, { u: 0.62, n: 6, lat: 3 }],
        blurb: 'A banked quarter-mile oval behind the Pruitt barn. Flat out, then turn left. Twice.',
    },
    'cornfield': {
        name: 'Cornfield Loop', env: 'flats', hw: 7, shoulder: 5, bank: 0.3,
        shape: { type: 'polar', R: 118, sx: 1.25, sz: 0.95, harm: [[2, 0.12, 0.4], [3, 0.1, 1.2], [5, 0.035, 2]] },
        hills: [[2, 1.6, 0]],
        features: [{ u: 0.33, type: 'table', len: 36, h: 2.2 }, { u: 0.71, type: 'whoops', len: 44, h: 0.45, n: 6 }],
        patches: [{ u: 0.52, len: 26, lat: -2, w: 4, type: 'mud' }],
        coins: [{ u: 0.2, n: 5, lat: -2 }, { u: 0.86, n: 6, wave: 2 }],
        blurb: 'Through the corn and over the irrigation mound. Mind the mud by the pump house.',
    },
    'windmill': {
        name: 'Windmill Run', env: 'flats', hw: 7, shoulder: 5, bank: 0.2,
        shape: { type: 'pts', scale: 1.4, pts: [[0, -90], [70, -95], [120, -60], [115, 0], [70, 25], [55, 70], [85, 110], [40, 140], [-30, 120], [-60, 70], [-110, 40], [-110, -30], [-70, -75]] },
        hills: [[1, 2, 1]],
        features: [{ u: 0.18, type: 'crest', len: 30, h: 2.4 }, { u: 0.56, type: 'table', len: 34, h: 2.4 }],
        patches: [{ u: 0.4, len: 20, lat: 0, w: 8, type: 'gravel' }],
        coins: [{ u: 0.3, n: 6 }, { u: 0.75, n: 5, lat: 2 }],
        blurb: 'Out past the old windmill and back, with a crest that likes to throw you sideways.',
    },
    // ============================================================ PINECREST WOODS — forest rally
    'pinecone': {
        name: 'Pinecone Trail', env: 'woods', hw: 6.5, shoulder: 4.5, bank: 0.3,
        shape: { type: 'polar', R: 128, sx: 1.1, sz: 0.95, harm: [[3, 0.14, 0], [4, 0.06, 1], [6, 0.025, 0.5]] },
        hills: [[1, 6, 0], [3, 2, 1]],
        features: [{ u: 0.4, type: 'crest', len: 28, h: 2.2 }, { u: 0.8, type: 'table', len: 30, h: 2 }],
        patches: [{ u: 0.22, len: 22, lat: 1.5, w: 3.5, type: 'mud' }, { u: 0.62, len: 24, lat: -1.5, w: 3.5, type: 'mud' }],
        coins: [{ u: 0.1, n: 6, wave: 2 }, { u: 0.55, n: 5 }],
        blurb: 'A logging road through the tall pines. Soft loam, puddles, and a hill you can feel in your stomach.',
    },
    'ridgeback': {
        name: 'Ridgeback Run', env: 'woods', hw: 6.5, shoulder: 4.5, bank: 0.4,
        shape: { type: 'pts', scale: 1.25, pts: [[0, -100], [80, -110], [130, -70], [100, -20], [40, -10], [30, 40], [90, 60], [120, 110], [60, 150], [-20, 130], [-50, 80], [-100, 60], [-120, 0], [-80, -60]] },
        hills: [[1, 9, 0.5], [2, 3, 0]],
        features: [{ u: 0.12, type: 'crest', len: 26, h: 2 }, { u: 0.47, type: 'crest', len: 30, h: 2.6 }, { u: 0.74, type: 'whoops', len: 36, h: 0.5, n: 5 }],
        patches: [{ u: 0.32, len: 20, lat: 0, w: 7, type: 'gravel' }],
        coins: [{ u: 0.05, n: 5 }, { u: 0.62, n: 6, wave: 2.5 }],
        blurb: 'Up the ridge, along its spine and down again. Every crest is blind.',
    },
    'hollow': {
        name: 'Hollow Creek', env: 'woods', hw: 6.5, shoulder: 4.5, bank: 0.3,
        shape: { type: 'polar', R: 108, sx: 1.35, sz: 0.9, harm: [[2, 0.15, 0], [3, 0.12, 2], [5, 0.03, 1]] },
        hills: [[2, 3, 0.8]],
        features: [{ u: 0.58, type: 'table', len: 32, h: 2.2 }, { u: 0.25, type: 'whoops', len: 30, h: 0.45, n: 5 }],
        patches: [{ u: 0.12, len: 16, lat: 0, w: 7, type: 'water' }, { u: 0.78, len: 14, lat: 0, w: 7, type: 'water' }, { u: 0.4, len: 18, lat: 2, w: 3, type: 'mud' }],
        coins: [{ u: 0.3, n: 6 }, { u: 0.9, n: 5, lat: -2 }],
        blurb: 'Two creek fords and a ring of ferns. Hit the water straight or swim.',
    },
    // ============================================================ REDROCK CANYON — jumps
    'mesaloop': {
        name: 'Mesa Loop', env: 'canyon', hw: 7.5, shoulder: 5, bank: 0.3,
        shape: { type: 'polar', R: 150, sx: 1.2, sz: 0.85, harm: [[2, 0.18, 0], [3, 0.08, 1]] },
        hills: [[1, 3, 0]],
        features: [{ u: 0.15, type: 'table', len: 40, h: 3 }, { u: 0.45, type: 'kicker', len: 46, h: 3.4 }, { u: 0.72, type: 'table', len: 40, h: 2.8 }],
        patches: [{ u: 0.6, len: 24, lat: 0, w: 8, type: 'sand' }],
        coins: [{ u: 0.3, n: 6 }, { u: 0.86, n: 6, wave: 3 }],
        blurb: 'Big sky, big tabletops. The kicker on the back straight is the one they talk about.',
    },
    'gulch': {
        name: 'Rattlesnake Gulch', env: 'canyon', hw: 6.5, shoulder: 4, smooth: 9, bank: 0.35,
        shape: { type: 'pts', scale: 1.35, pts: [[0, -110], [90, -100], [120, -40], [70, 0], [110, 50], [80, 110], [10, 100], [-10, 40], [-60, 60], [-110, 20], [-100, -60], [-50, -70]] },
        hills: [[2, 2, 0.4]],
        features: [{ u: 0.22, type: 'kicker', len: 40, h: 3 }, { u: 0.62, type: 'crest', len: 26, h: 2.4 }, { u: 0.86, type: 'whoops', len: 34, h: 0.55, n: 5 }],
        patches: [{ u: 0.38, len: 26, lat: 0, w: 7, type: 'gravel' }, { u: 0.7, len: 16, lat: -2, w: 4, type: 'sand' }],
        coins: [{ u: 0.08, n: 6, wave: 2 }, { u: 0.5, n: 5 }],
        blurb: 'A twisting dry wash between red walls. Gravel, a blind kicker, and rattlers in the shade.',
    },
    'arch': {
        name: 'Sunset Arch', env: 'canyon', hw: 7, shoulder: 5, bank: 0.3,
        shape: { type: 'polar', R: 140, sx: 1.05, sz: 1.0, harm: [[3, 0.18, 0.7], [5, 0.05, 0], [2, 0.06, 1]] },
        hills: [[1, 4, 1], [3, 2, 0]],
        features: [{ u: 0.05, type: 'crest', len: 30, h: 2.6 }, { u: 0.38, type: 'table', len: 42, h: 3.2 }, { u: 0.66, type: 'kicker', len: 44, h: 3.2 }],
        patches: [{ u: 0.52, len: 30, lat: 0, w: 8, type: 'sand' }],
        coins: [{ u: 0.22, n: 6 }, { u: 0.8, n: 6, lat: 2 }],
        blurb: 'Under the great stone arch at golden hour. Three big airs and a sand trap.',
    },
    // ============================================================ GATORBACK BAYOU — mud and water
    'gatorbend': {
        name: 'Gator Bend', env: 'bayou', hw: 7, shoulder: 4.5, bank: 0.25,
        shape: { type: 'polar', R: 118, sx: 1.25, sz: 0.9, harm: [[2, 0.18, 0], [4, 0.06, 1]] },
        features: [{ u: 0.44, type: 'crest', len: 26, h: 1.6 }, { u: 0.8, type: 'whoops', len: 36, h: 0.4, n: 6 }],
        patches: [{ u: 0.18, len: 30, lat: 0, w: 8, type: 'water' }, { u: 0.58, len: 24, lat: 2, w: 4, type: 'mud' }, { u: 0.64, len: 20, lat: -2.5, w: 3, type: 'mud' }],
        coins: [{ u: 0.3, n: 6 }, { u: 0.92, n: 5, wave: 2 }],
        blurb: 'Round the gator pond and through the shallows. Something in there is watching.',
    },
    'stilts': {
        name: 'Stilt-Shack Sprint', env: 'bayou', hw: 6.5, shoulder: 4, bank: 0.3,
        shape: { type: 'pts', scale: 1.4, pts: [[0, -95], [75, -100], [115, -55], [95, 5], [125, 55], [80, 105], [15, 85], [-25, 120], [-90, 95], [-100, 30], [-60, -10], [-95, -60]] },
        features: [{ u: 0.3, type: 'table', len: 30, h: 1.8 }, { u: 0.7, type: 'crest', len: 24, h: 1.6 }],
        patches: [{ u: 0.12, len: 34, lat: 0, w: 7, type: 'plank' }, { u: 0.5, len: 22, lat: 0, w: 7, type: 'water' }, { u: 0.86, len: 22, lat: 1, w: 4, type: 'mud' }],
        coins: [{ u: 0.4, n: 6 }, { u: 0.78, n: 5, lat: -2 }],
        blurb: 'A boardwalk past the stilt shacks, then into the muck. Lanterns light the way.',
    },
    'crossroads': {
        name: 'Crossroads Bayou', env: 'bayou', hw: 6.5, shoulder: 4, bank: 0.25,
        shape: { type: 'eight', a: 150, b: 72, H: 3.8 },
        features: [{ u: 0.58, type: 'whoops', len: 30, h: 0.45, n: 5 }],
        patches: [{ u: 0.38, len: 26, lat: 0, w: 7, type: 'water' }, { u: 0.86, len: 22, lat: 0, w: 7, type: 'mud' }, { u: 0.08, len: 20, lat: 0, w: 7, type: 'plank' }],
        coins: [{ u: 0.22, n: 6 }, { u: 0.7, n: 6, wave: 2 }],
        blurb: 'A figure eight where the old roads cross: over the wooden bridge, then under it.',
    },
    // ============================================================ FROSTBITE PASS — snow and ice
    'frozenlake': {
        name: 'Frozen Lake Loop', env: 'frost', hw: 7.5, shoulder: 5, bank: 0.25,
        shape: { type: 'polar', R: 122, sx: 1.25, sz: 0.9, harm: [[2, 0.1, 0], [3, 0.1, 1]] },
        hills: [[1, 2.5, 0]],
        features: [{ u: 0.7, type: 'crest', len: 30, h: 2 }],
        patches: [{ u: 0.2, len: 70, lat: 0, w: 9, type: 'ice' }, { u: 0.55, len: 20, lat: 2, w: 4, type: 'snow' }],
        coins: [{ u: 0.3, n: 6, wave: 3 }, { u: 0.85, n: 5 }],
        blurb: 'Half of it is a frozen lake. Steer with the throttle, and pray.',
    },
    'avalanche': {
        name: 'Avalanche Pass', env: 'frost', hw: 7, shoulder: 4.5, smooth: 12, bank: 0.4,
        shape: { type: 'pts', scale: 1.45, pts: [[0, -110], [85, -100], [120, -45], [80, 0], [120, 50], [90, 115], [20, 110], [-10, 55], [-60, 100], [-115, 60], [-110, -15], [-60, -40], [-90, -90]] },
        hills: [[1, 10, 0], [2, 3, 1]],
        features: [{ u: 0.2, type: 'crest', len: 30, h: 2.2 }, { u: 0.5, type: 'table', len: 36, h: 2.6 }, { u: 0.82, type: 'crest', len: 28, h: 2.2 }],
        patches: [{ u: 0.35, len: 24, lat: 0, w: 8, type: 'ice' }, { u: 0.66, len: 20, lat: -2, w: 4, type: 'snow' }],
        coins: [{ u: 0.1, n: 6 }, { u: 0.6, n: 6, wave: 2 }],
        blurb: 'A mountain road between snowbanks taller than your car. Ice in the shadows.',
    },
    'summit': {
        name: 'Summit Circuit', env: 'frost', hw: 7, shoulder: 5, bank: 0.35,
        shape: { type: 'polar', R: 136, sx: 1.1, sz: 0.95, harm: [[3, 0.16, 0.3], [2, 0.08, 1.5], [5, 0.03, 0]] },
        hills: [[1, 7, 0.4], [2, 2.5, 0]],
        features: [{ u: 0.1, type: 'table', len: 36, h: 2.6 }, { u: 0.42, type: 'kicker', len: 40, h: 3 }, { u: 0.72, type: 'whoops', len: 36, h: 0.5, n: 6 }],
        patches: [{ u: 0.26, len: 30, lat: 0, w: 9, type: 'ice' }, { u: 0.58, len: 26, lat: 0, w: 9, type: 'ice' }],
        coins: [{ u: 0.18, n: 6 }, { u: 0.9, n: 6, lat: 2 }],
        blurb: 'The top of the world: thin air, two ice sheets and a kicker into the clouds.',
    },
    // ============================================================ THE THUNDERDOME — stadium supercross
    'snake': {
        name: 'Supercross Snake', env: 'dome', hw: 6.5, shoulder: 3, bank: 0.5,
        shape: { type: 'pts', scale: 1.25, pts: [[-110, -60], [-30, -70], [40, -60], [110, -55], [125, -15], [80, 5], [20, -5], [-40, 5], [-70, 30], [-30, 55], [40, 45], [110, 50], [120, 85], [60, 100], [-40, 100], [-115, 90], [-130, 30], [-130, -30]] },
        features: [
            { u: 0.08, type: 'table', len: 30, h: 2.4 }, { u: 0.2, type: 'whoops', len: 30, h: 0.5, n: 6 },
            { u: 0.42, type: 'kicker', len: 30, h: 2.6 }, { u: 0.62, type: 'table', len: 30, h: 2.4 },
            { u: 0.85, type: 'crest', len: 22, h: 1.8 },
        ],
        coins: [{ u: 0.3, n: 5 }, { u: 0.74, n: 5, wave: 2 }],
        blurb: 'Back and forth across the stadium floor under the lights. Rhythm is everything.',
    },
    'thundereight': {
        name: 'Thunder Eight', env: 'dome', hw: 6.5, shoulder: 3, bank: 0.4,
        shape: { type: 'eight', a: 125, b: 60, H: 3.6 },
        features: [{ u: 0.36, type: 'table', len: 28, h: 2 }, { u: 0.86, type: 'whoops', len: 28, h: 0.5, n: 6 }, { u: 0.62, type: 'crest', len: 22, h: 1.6 }],
        coins: [{ u: 0.2, n: 6 }, { u: 0.7, n: 5 }],
        blurb: 'A figure eight with a steel bridge in the middle and twenty thousand people screaming.',
    },
    'ringfire': {
        name: 'Ring of Fire', env: 'dome', hw: 6.5, shoulder: 3, bank: 0.6,
        shape: { type: 'polar', R: 92, sx: 1.4, sz: 0.85, harm: [[3, 0.2, 0], [2, 0.1, 1]] },
        features: [{ u: 0.12, type: 'table', len: 30, h: 2.4 }, { u: 0.35, type: 'whoops', len: 32, h: 0.55, n: 7 }, { u: 0.6, type: 'kicker', len: 32, h: 2.8 }, { u: 0.82, type: 'table', len: 28, h: 2.2 }],
        coins: [{ u: 0.48, n: 6 }, { u: 0.95, n: 5, lat: 2 }],
        blurb: 'Max Volt\'s showpiece: jumps through rings of flame and a whoops section that rattles teeth.',
    },
    // ============================================================ RAVENWOOD MESA — the Crown
    'speedway': {
        name: 'Ravenwood Speedway', env: 'mesa', hw: 8, shoulder: 5, bank: 0.8,
        shape: { type: 'polar', R: 140, sx: 1.4, sz: 0.8, harm: [[2, 0.06, 0], [3, 0.05, 0.7]] },
        hills: [[2, 1.5, 0]],
        features: [{ u: 0.3, type: 'crest', len: 30, h: 2 }, { u: 0.78, type: 'table', len: 36, h: 2.6 }],
        patches: [{ u: 0.55, len: 26, lat: 0, w: 9, type: 'gravel' }],
        coins: [{ u: 0.12, n: 6 }, { u: 0.62, n: 6, wave: 3 }],
        blurb: 'Victor Ravenwood\'s private speedway, all black barriers and gold flags. Qualify here or go home.',
    },
    'crownrun': {
        name: 'The Crown Run', env: 'mesa', hw: 7.5, shoulder: 5, bank: 0.4,
        shape: { type: 'pts', scale: 1.5, pts: [[0, -120], [90, -125], [150, -85], [140, -20], [90, 0], [110, 55], [160, 90], [130, 140], [60, 130], [20, 85], [-30, 130], [-100, 125], [-140, 70], [-100, 20], [-150, -30], [-130, -95], [-60, -120]] },
        hills: [[1, 6, 0.3], [2, 3, 1.4], [3, 1.5, 0]],
        features: [
            { u: 0.06, type: 'table', len: 40, h: 3 }, { u: 0.2, type: 'whoops', len: 40, h: 0.55, n: 7 },
            { u: 0.34, type: 'kicker', len: 50, h: 3.8 }, { u: 0.55, type: 'crest', len: 30, h: 2.6 },
            { u: 0.7, type: 'table', len: 44, h: 3.2 }, { u: 0.88, type: 'kicker', len: 44, h: 3.4 },
        ],
        patches: [
            { u: 0.26, len: 22, lat: 0, w: 9, type: 'gravel' }, { u: 0.46, len: 18, lat: 0, w: 9, type: 'water' },
            { u: 0.62, len: 20, lat: 2, w: 4, type: 'mud' }, { u: 0.8, len: 24, lat: 0, w: 9, type: 'sand' },
            // Victor's crew oiled the outside of three bends (Colt warns you after the qualifier).
            { u: 0.115, len: 18, lat: 4.5, w: 3, type: 'oil' }, { u: 0.405, len: 18, lat: -4.5, w: 3, type: 'oil' }, { u: 0.745, len: 18, lat: 4.5, w: 3, type: 'oil' },
        ],
        coins: [{ u: 0.13, n: 6 }, { u: 0.5, n: 6, wave: 3 }, { u: 0.95, n: 6 }],
        blurb: 'The road the Dirt Crown has been won on for sixty years. Every kind of ground, every kind of air.',
    },
};

/** A track definition with the environment's surfaces filled in. */
export function trackDef(id, reverse = false) {
    const t = TRACKS[id];
    if (!t) throw new Error(`no track ${id}`);
    const env = ENVS[t.env];
    return { id, ...t, surface: t.surface || env.surface, shoulderSurf: t.shoulderSurf || env.shoulder, reverse };
}

