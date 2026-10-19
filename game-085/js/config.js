// WanderQuest — tuning and constants. Shared by the sim, the view, the UI and the tests.
// One tick of the simulation is one real second; every rate below is per second unless it says otherwise.

export const VERSION = '1.2.0';
export const SAVE_KEY = 'wanderquest.v1';

export const STEP = 1 / 120;              // fixed simulation step (s); the rules run on whole-second ticks inside it
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const DAY = 720;                   // one day on the road, in ticks (12 real minutes): the sky's cycle
export const NIGHT_FROM = 0.78;           // fraction of the day when night falls…
export const NIGHT_TO = 0.22;             // …and when it lifts

export const TRAVEL = {
    speed: 0.14,                          // miles per tick at Wheels 0, a fed caravan, by day
    milesPerUnit: 0.4,                    // map units → miles
    hungry: 0.6,                          // speed when the rations run out
    rally: { mult: 1.5, time: 20, cooldown: 60 },
    dwell: 40,                            // ticks spent in a town before the caravan moves on
    battleTime: 5,                        // ticks the caravan stands still for a fight (plus a little per round)
    encounterMiles: 11,                   // a fight every ~this many miles on average
    nightEncounter: 1.3,
    eventMiles: 26,                       // a road event (cache, shrine, wanderer…) every ~this many miles
    campBelow: 0.5,                       // default: make camp when the party's health falls below this
    campUntil: 0.92,
};

// Sparkles on the road, for someone who's watching: about one every 45 s of travel, 1.2–2 miles ahead.
export const SPARKLE = { chance: 1 / 45, ahead: [1.2, 2.0], kinds: { gold: 35, item: 25, monster: 20, lore: 20 } };

export const FOOD = {
    perMember: 1 / 120,                   // rations each traveller eats per tick on the road
    larder: 40, larderPerLevel: 25,
    price: 2,                             // gold per ration in Meadowmere; × (1 + 0.45 × region) further out
};

export const REGEN = { road: 0.0025, camp: 0.012, town: 1, downUntil: 0.25 };

export const OFFLINE = { baseHours: 8, hoursPerLantern: 2 };

export const PARTY = {
    // party size by caravan level: [level, slots]
    slots: [[1, 2], [3, 3], [6, 4], [10, 5], [15, 6], [21, 7], [28, 8]],
    offerLife: 3 * DAY,                   // a wanderer met on the road waits this long for an answer
};

export const QUESTS = { active: 5, board: 3 };

export const PACK = { gear: 24 };

export const RARITY = [
    { id: 'common', name: 'Common', mult: 1, weight: 60, color: '#c9ccd6' },
    { id: 'fine', name: 'Fine', mult: 1.25, weight: 26, color: '#7fd67a' },
    { id: 'rare', name: 'Rare', mult: 1.6, weight: 10, color: '#5aa8ff' },
    { id: 'epic', name: 'Epic', mult: 2.1, weight: 3.5, color: '#c27bff' },
    { id: 'legendary', name: 'Legendary', mult: 2.8, weight: 0.5, color: '#ffb340' },
];

// Experience: quick early levels, then a gentle exponential so the last regions take days, not hours.
export const xpForLevel = (l) => Math.round(25 * l * l * Math.pow(1.075, l));      // traveller: to go from l to l + 1
export const caravanXpFor = (l) => Math.round(40 * l * l * Math.pow(1.075, l));    // caravan: to go from l to l + 1
export const monsterXp = (L) => Math.round(6 + 5 * Math.pow(L, 1.25));
export const monsterGold = (L) => 2 + 1.6 * Math.pow(L, 1.15);
