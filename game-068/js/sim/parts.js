/**
 * parts.js — the garage: six upgrade lines of five levels each, what they do to the car, what they
 * cost, the car's Rating, and the paint shop.
 *
 * Rating = 100 + 30 per upgrade level, so the starting Bucket is 100 and a fully built car is 1000.
 * Opponents are built from a rating too (levelsForRating), with the same formulas, so a race's
 * recommended rating means "a car like theirs".
 */

export const CATS = ['engine', 'drive', 'tires', 'susp', 'body', 'nitro'];
export const MAX_LEVEL = 5;

export const CAT_INFO = {
    engine: {
        name: 'Engine', icon: '🔥', stat: 'Top speed',
        blurb: 'More horsepower, more top end.',
        levels: ['Lawnmower Single', 'Stroker Twin', 'Ridge-Runner Four', 'Blown Six', 'Supercharged V8', 'Crown-Spec Hemi'],
        look: ['', 'A rusty exhaust pipe', 'Twin exhausts', 'A hood scoop', 'A supercharger with a belt', 'A chrome blower that spits flame'],
    },
    drive: {
        name: 'Drivetrain', icon: '⚙️', stat: 'Acceleration',
        blurb: 'Shorter gears and a stiffer clutch: off the line faster.',
        levels: ['Three-Speed Hand-Me-Down', 'Close-Ratio Box', 'Locking Diff', 'Sequential Shifter', 'Twin-Plate Clutch', 'Dog-Box Racing Drive'],
        look: ['', 'Mud flaps', 'A tow hook and diff guard', 'A ducktail spoiler', 'A tall rear wing', 'A wing with end plates'],
    },
    tires: {
        name: 'Tyres', icon: '🛞', stat: 'Grip',
        blurb: 'Bite into the corners, and dig in on mud, sand, snow and ice.',
        levels: ['Bald Balloons', 'All-Terrains', 'Knobby Mud-Pluggers', 'Paddle Treads', 'Pro Sand-and-Snow', 'Gold Claw Racing Rubber'],
        look: ['', 'Bigger all-terrain tyres', 'Knobby tyres on five-spoke rims', 'Paddle treads on beadlock rims', 'Wide tyres on black racing rims', 'Gold rims'],
    },
    susp: {
        name: 'Suspension', icon: '🪀', stat: 'Bumps & landings',
        blurb: 'Soaks up whoops, ruts and big landings without losing speed.',
        levels: ['Pogo Sticks', 'Gas Shocks', 'Coilovers', 'Long-Travel Arms', 'Bypass Shocks', 'Trophy-Truck Travel'],
        look: ['', 'A little more ride height', 'Coil springs', 'Long-travel arms', 'Twin shocks per wheel', 'Gold coilovers'],
    },
    body: {
        name: 'Body & Armour', icon: '🛡️', stat: 'Weight & toughness',
        blurb: 'A heavier, tougher car wins the shoving matches and slides off walls.',
        levels: ['Tin Can', 'Bull Bar', 'Roll Cage', 'Nerf Bars', 'Light Bar & Skid Plates', 'Riveted Battle Armour'],
        look: ['', 'A bull bar', 'A roll cage', 'Side nerf bars', 'A roof light bar', 'Riveted armour plates'],
    },
    nitro: {
        name: 'Nitro', icon: '💨', stat: 'Boost',
        blurb: 'A bigger bottle, a harder kick and a faster refill from drifts and jumps.',
        levels: ['Empty Bottle', 'Single Bottle', 'Twin Bottles', 'Blue-Flame Purge', 'Triple Stack', 'Rocket Rack'],
        look: ['', 'A nitro bottle', 'Two bottles', 'A purge valve with blue flame', 'Three bottles', 'Big glowing tanks'],
    },
};

// Cost of buying level n (1..5) in any line.
export const LEVEL_COST = [0, 120, 300, 650, 1200, 2000];

export function emptyLevels() { return { engine: 0, drive: 0, tires: 0, susp: 0, body: 0, nitro: 0 }; }

export function rating(levels) {
    let s = 0;
    for (const c of CATS) s += levels[c] || 0;
    return 100 + s * 30;
}

/** Car handling numbers from upgrade levels. Fractional levels are fine (opponents use them). */
export function specFromLevels(lv) {
    const e = lv.engine || 0, d = lv.drive || 0, t = lv.tires || 0, s = lv.susp || 0, b = lv.body || 0, n = lv.nitro || 0;
    return {
        top: 25 + e * 3.4,             // m/s: 90 → 151 km/h
        accel: 8.5 + d * 1.6 + e * 0.25,
        brake: 24 + d * 0.8,
        latGrip: 7 + t * 0.7,          // how fast a slide is caught (1/s)
        turnGrip: 15 + t * 1.5,        // cornering force (m/s²)
        steerRate: 2.25 + t * 0.06,    // rad/s at low speed
        steerResp: 9 + t * 0.4,
        looseGrip: t * 0.075,          // share of a loose surface's grip loss won back
        absorb: s * 0.13,              // share of bumps and landings soaked up
        travel: 0.14 + s * 0.05,       // suspension travel (m): tyres keep biting through small hops
        mass: 1 + b * 0.13,
        wallKeep: 0.55 + b * 0.07,     // speed kept scraping a barrier
        nitroCap: 2 + n * 0.5,         // seconds
        boostAccel: 7 + n * 1.1,
        boostTop: 1.15 + n * 0.02,
        driftCharge: 0.42 + n * 0.08,  // nitro seconds per second of full drift
    };
}

/**
 * Upgrade levels for an opponent of a given rating. `bias` is a personality: a list of lines this
 * driver spends on first (Big Earl loves engines; Fern loves tyres).
 */
export function levelsForRating(r, bias = []) {
    const total = Math.max(0, Math.min(30, (r - 100) / 30));
    const lv = emptyLevels();
    const base = Math.floor(total / 6);
    for (const c of CATS) lv[c] = base;
    let rest = total - base * 6;
    const order = [...bias, ...CATS.filter((c) => !bias.includes(c))];
    for (const c of order) {
        if (rest <= 0) break;
        const add = Math.min(1, rest, MAX_LEVEL - lv[c]);
        lv[c] += add;
        rest -= add;
    }
    return lv;
}

// ------------------------------------------------------------------ paint shop
export const PAINTS = [
    { id: 'primer',   name: 'Primer Grey',     hex: 0x8a8d8f, cost: 0 },
    { id: 'red',      name: 'Barn Red',        hex: 0xc0302a, cost: 80 },
    { id: 'orange',   name: 'Tangerine',       hex: 0xf07b1d, cost: 80 },
    { id: 'yellow',   name: 'School Bus',      hex: 0xf5c518, cost: 80 },
    { id: 'lime',     name: 'Lime Rocket',     hex: 0x7fd12e, cost: 120 },
    { id: 'green',    name: 'Pine Green',      hex: 0x1f6b3a, cost: 120 },
    { id: 'teal',     name: 'Bayou Teal',      hex: 0x16a3a0, cost: 160 },
    { id: 'blue',     name: 'Royal Blue',      hex: 0x2457c9, cost: 160 },
    { id: 'sky',      name: 'Sky Blue',        hex: 0x5ab6ef, cost: 160 },
    { id: 'purple',   name: 'Grape Soda',      hex: 0x7a3fc4, cost: 220 },
    { id: 'pink',     name: 'Bubblegum',       hex: 0xff6fae, cost: 220 },
    { id: 'white',    name: 'Snow White',      hex: 0xf2f2ee, cost: 220 },
    { id: 'black',    name: 'Midnight',        hex: 0x1d1f24, cost: 300 },
    { id: 'gold',     name: 'Halloway Gold',   hex: 0xd9a62e, cost: 600, metal: 0.7 },
    { id: 'chrome',   name: 'Mirror Chrome',   hex: 0xd8dde3, cost: 900, metal: 1.0 },
];

export const LIVERIES = [
    { id: 'none',      name: 'Plain',            cost: 0 },
    { id: 'number',    name: 'Number Roundels',  cost: 60 },
    { id: 'stripes',   name: 'Racing Stripes',   cost: 150 },
    { id: 'flames',    name: 'Hot Rod Flames',   cost: 300 },
    { id: 'checker',   name: 'Checkered Tail',   cost: 250 },
    { id: 'bolt',      name: 'Lightning Bolt',   cost: 250 },
    { id: 'splatter',  name: 'Mud Splatter',     cost: 120 },
    { id: 'halloway',  name: 'Halloway Heritage', cost: 0, unlock: 'final' },
];

export const TRIMS = [
    { id: 'white', name: 'White', hex: 0xf4f1e8 },
    { id: 'black', name: 'Black', hex: 0x1a1a1e },
    { id: 'gold',  name: 'Gold',  hex: 0xe8b33a },
    { id: 'red',   name: 'Red',   hex: 0xd8322a },
    { id: 'blue',  name: 'Blue',  hex: 0x2f6be0 },
    { id: 'green', name: 'Green', hex: 0x3bbd5b },
    { id: 'pink',  name: 'Pink',  hex: 0xff73b3 },
    { id: 'orange',name: 'Orange',hex: 0xff8a1f },
];

export const paintById = (id) => PAINTS.find((p) => p.id === id) || PAINTS[0];
export const liveryById = (id) => LIVERIES.find((p) => p.id === id) || LIVERIES[0];
export const trimById = (id) => TRIMS.find((p) => p.id === id) || TRIMS[0];
