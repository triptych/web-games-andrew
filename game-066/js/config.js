// SCRAPWRIGHT — shared constants. Data tables live in js/sim/data/.

export const VERSION = '1.0.3';
export const SAVE_KEY = 'scrapwright.v1';   // localStorage prefix

export const MAX_LEVEL = 100;
export const PARTY_SIZE = 6;
export const LOCKER_SIZE = 240;
export const MAX_MOVES = 4;
export const SPECIES_COUNT = 250;

export const STEP_TIME = 0.24;          // seconds per tile walking
export const RUN_TIME = 0.13;           // seconds per tile with steam boots
export const ENCOUNTER_RATE = 0.11;     // chance per step on a scrap drift
export const SYNC_MAX = 255;

/** Stats: Hull (hit points), Torque (kinetic attack), Plating (kinetic defence),
 *  Arc (energy attack), Shield (energy defence), Clock (speed). */
export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_NAMES = { hp: 'Hull', atk: 'Torque', def: 'Plating', spa: 'Arc', spd: 'Shield', spe: 'Clock', acc: 'Accuracy', eva: 'Evasion', crit: 'Targeting' };
export const STAT_SHORT = { hp: 'HUL', atk: 'TRQ', def: 'PLT', spa: 'ARC', spd: 'SHD', spe: 'CLK' };

export const STATUS = {
    ovh: { name: 'Overheated', short: 'HOT', color: '#ff7a2e' },
    cor: { name: 'Corroded', short: 'COR', color: '#9be04a' },
    shc: { name: 'Short-circuited', short: 'SHC', color: '#ffe14a' },
    frz: { name: 'Seized', short: 'SZD', color: '#8fe0ff' },
    pdn: { name: 'Powered down', short: 'OFF', color: '#a8a8c8' },
};

export const ATMOS = {
    heat:   { name: 'Heatwave',     text: 'The air shimmers with furnace heat.' },
    rain:   { name: 'Acid Rain',    text: 'A sour rain hisses on every surface.' },
    dust:   { name: 'Dust Storm',   text: 'Grit howls across the field.' },
    static: { name: 'Static Storm', text: 'The sky crackles with stray current.' },
    smog:   { name: 'Smog',         text: 'A thick yellow smog rolls in.' },
};

// Experience curve: medium-fast (n³).
export const xpForLevel = (n) => (n <= 1 ? 0 : n * n * n);
