/**
 * mech.js — the frame's systems. Every system changes the slot machine:
 * reel count, rows, paylines, energy for nudges/respins, symbol power, wild and
 * core density, module slots. `gate` is the number of campaign chapters that
 * must be cleared before the next level can be installed.
 */

const geo = (base, growth) => (lv) => ({ scrap: Math.round(base * Math.pow(growth, lv - 1)), cores: 0 });
const table = (rows) => (lv) => rows[lv] ?? null;   // rows[lv] = cost to go from lv to lv+1

export const SYSTEMS = {
    reels: {
        name: 'Reel Array', group: 'machine', max: 3, icon: 'reels',
        desc: 'More reels: longer lines, bigger chains, five-of-a-kind.',
        text: (lv) => `${lv + 2} reels`,
        cost: table({ 1: { scrap: 900, cores: 3 }, 2: { scrap: 9000, cores: 5 } }),
        gate: (lv) => (lv === 1 ? 1 : 3),
    },
    matrix: {
        name: 'Targeting Matrix', group: 'machine', max: 6, icon: 'matrix',
        desc: 'Unlocks paylines: diagonals, V-shapes, a fourth row, zig-zags, steps.',
        text: (lv) => ['', '3 rows · straight lines', '+ diagonals', '+ V shapes', '4th row', '+ zig-zags', '+ steps'][lv],
        cost: table({ 1: { scrap: 140, cores: 0 }, 2: { scrap: 1100, cores: 0 }, 3: { scrap: 6000, cores: 3 }, 4: { scrap: 30000, cores: 0 }, 5: { scrap: 150000, cores: 6 } }),
        gate: (lv) => [0, 0, 1, 2, 3, 4][lv] ?? 9,
    },
    reactor: {
        name: 'Reactor', group: 'machine', max: 6, icon: 'reactor',
        desc: 'Energy for nudges, respins, holds and purges.',
        text: (lv) => `${2 + lv} max energy · +${lv >= 4 ? 2 : 1}/turn`,
        cost: table({ 1: { scrap: 110, cores: 0 }, 2: { scrap: 700, cores: 0 }, 3: { scrap: 3500, cores: 1 }, 4: { scrap: 18000, cores: 0 }, 5: { scrap: 90000, cores: 4 } }),
        gate: (lv) => [0, 0, 1, 2, 3, 4][lv] ?? 9,
    },
    servos: {
        name: 'Servo Actuators', group: 'machine', max: 5, icon: 'servos',
        desc: 'Cheaper reel control.',
        text: (lv) => ['', 'Nudge 1⚡ · Respin 2⚡', '1 free nudge per turn', 'Respin costs 1⚡', '2 free nudges per turn', 'Holds are free'][lv],
        cost: table({ 1: { scrap: 260, cores: 0 }, 2: { scrap: 2400, cores: 1 }, 3: { scrap: 14000, cores: 0 }, 4: { scrap: 70000, cores: 3 } }),
        gate: (lv) => [0, 0, 1, 3, 4][lv] ?? 9,
    },
    core: {
        name: 'Probability Core', group: 'machine', max: 8, icon: 'core',
        desc: 'Writes more Overclock wilds (and Cores) into every strip.',
        text: (lv) => `${lv} wild${lv === 1 ? '' : 's'} · ${1 + Math.floor(lv / 3)} core${lv >= 3 ? 's' : ''} per strip`,
        cost: (lv) => ({ scrap: Math.round(220 * Math.pow(2.7, lv - 1)), cores: lv >= 4 ? lv - 2 : 0 }),
        gate: (lv) => Math.floor(lv / 2),
    },
    chassis: {
        name: 'Chassis', group: 'machine', max: 4, icon: 'chassis',
        desc: 'Module slots for enhancements.',
        text: (lv) => `${lv + 1} module slots`,
        cost: table({ 1: { scrap: 500, cores: 1 }, 2: { scrap: 6000, cores: 3 }, 3: { scrap: 50000, cores: 6 } }),
        gate: (lv) => [0, 1, 2, 4][lv] ?? 9,
    },
    armor: {
        name: 'Armor Plating', group: 'frame', max: 40, icon: 'armor',
        desc: 'Maximum hull integrity.',
        text: (lv) => `${Math.round(hullAt(lv))} hull`,
        cost: geo(32, 1.3), gate: (lv) => Math.floor(lv / 7),
    },
    blade: {
        name: 'Blade Hardpoint', group: 'weapon', max: 40, icon: 'blade', weapon: true,
        desc: 'Blade symbol power.', text: (lv) => `×${powerMult(lv).toFixed(1)} power`,
        cost: geo(28, 1.3), gate: (lv) => Math.floor(lv / 7),
    },
    cannon: {
        name: 'Cannon Hardpoint', group: 'weapon', max: 40, icon: 'cannon', weapon: true,
        desc: 'Cannon symbol power.', text: (lv) => `×${powerMult(lv).toFixed(1)} power`,
        cost: geo(28, 1.3), gate: (lv) => Math.floor(lv / 7),
    },
    missile: {
        name: 'Missile Pods', group: 'weapon', max: 40, icon: 'missile', weapon: true, install: 1,
        desc: 'Adds Missile symbols to your strips: they hit every enemy.',
        text: (lv) => (lv ? `×${powerMult(lv).toFixed(1)} power` : 'Not installed'),
        cost: (lv) => (lv === 0 ? { scrap: 350, cores: 1 } : { scrap: Math.round(40 * Math.pow(1.3, lv - 1)), cores: 0 }),
        gate: (lv) => (lv === 0 ? 1 : 1 + Math.floor(lv / 7)),
    },
    arc: {
        name: 'Arc Projector', group: 'weapon', max: 40, icon: 'arc', weapon: true, install: 2,
        desc: 'Adds Arc symbols: lightning that chains between enemies.',
        text: (lv) => (lv ? `×${powerMult(lv).toFixed(1)} power` : 'Not installed'),
        cost: (lv) => (lv === 0 ? { scrap: 2500, cores: 2 } : { scrap: Math.round(60 * Math.pow(1.3, lv - 1)), cores: 0 }),
        gate: (lv) => (lv === 0 ? 2 : 2 + Math.floor(lv / 7)),
    },
    shield: {
        name: 'Deflector', group: 'frame', max: 40, icon: 'shield',
        desc: 'Shield symbol power.', text: (lv) => `×${powerMult(lv).toFixed(1)} power`,
        cost: geo(24, 1.3), gate: (lv) => Math.floor(lv / 7),
    },
    repair: {
        name: 'Nanorepair', group: 'frame', max: 40, icon: 'repair',
        desc: 'Repair symbol power.', text: (lv) => `×${powerMult(lv).toFixed(1)} power`,
        cost: geo(24, 1.3), gate: (lv) => Math.floor(lv / 7),
    },
};

export const SYSTEM_ORDER = ['reels', 'matrix', 'reactor', 'servos', 'core', 'chassis', 'blade', 'cannon', 'missile', 'arc', 'armor', 'shield', 'repair'];

export function powerMult(lv) {
    if (lv <= 0) return 0;
    return (1 + 0.3 * (lv - 1)) * Math.pow(1.07, lv - 1);
}
export function hullAt(lv) {
    return 60 * (1 + 0.2 * (lv - 1)) * Math.pow(1.06, lv - 1);
}

export function newMech() {
    return { reels: 1, matrix: 1, reactor: 1, servos: 1, core: 1, chassis: 1, armor: 1, blade: 1, cannon: 1, missile: 0, arc: 0, shield: 1, repair: 1 };
}

/** What it costs to raise `id` from its current level, or null at max. */
export function upgradeCost(mech, id) {
    const s = SYSTEMS[id];
    const lv = mech[id];
    if (lv >= s.max) return null;
    return s.cost(lv);
}

/** Can the system be raised right now? Returns { ok, why }. */
export function canUpgrade(profile, id) {
    const s = SYSTEMS[id];
    const lv = profile.mech[id];
    if (lv >= s.max) return { ok: false, why: 'MAX' };
    const need = s.gate(lv);
    if (profile.campaign.best < need) return { ok: false, why: `Clear chapter ${need}` };
    const c = s.cost(lv);
    if (profile.scrap < c.scrap) return { ok: false, why: 'scrap', cost: c };
    if (profile.cores < c.cores) return { ok: false, why: 'cores', cost: c };
    return { ok: true, cost: c };
}

export function doUpgrade(profile, id) {
    const r = canUpgrade(profile, id);
    if (!r.ok) return false;
    profile.scrap -= r.cost.scrap;
    profile.cores -= r.cost.cores;
    profile.mech[id]++;
    return true;
}

// ------------------------------------------------------------------ paylines

/**
 * Paylines for a grid. Each line is an array of row indices, one per column.
 * Matrix level unlocks families; rows come from matrix level (4 rows at lv 4+).
 */
export function buildLines(cols, rows, matrixLv) {
    const out = [];
    const seen = new Set();
    const add = (arr, name) => {
        const k = arr.join(',');
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ rows: arr, name });
    };
    const mid = Math.floor((rows - 1) / 2);
    // middle row first: it is the classic payline
    add(Array(cols).fill(mid), 'row');
    for (let r = 0; r < rows; r++) add(Array(cols).fill(r), 'row');
    if (matrixLv >= 2) {
        add(range(cols).map((c) => Math.round((c * (rows - 1)) / (cols - 1))), 'diag');
        add(range(cols).map((c) => rows - 1 - Math.round((c * (rows - 1)) / (cols - 1))), 'diag');
    }
    if (matrixLv >= 3) {
        const tri = (c) => 1 - Math.abs((2 * c) / (cols - 1) - 1);       // 0 → 1 → 0
        add(range(cols).map((c) => Math.round(tri(c) * (rows - 1))), 'v');
        add(range(cols).map((c) => rows - 1 - Math.round(tri(c) * (rows - 1))), 'v');
    }
    if (matrixLv >= 5) {
        for (let b = 0; b < rows - 1; b++) {
            add(range(cols).map((c) => b + (c % 2)), 'zig');
            add(range(cols).map((c) => b + 1 - (c % 2)), 'zig');
        }
    }
    if (matrixLv >= 6) {
        const step = (c) => Math.min(rows - 1, Math.floor((c * rows) / cols));
        add(range(cols).map(step), 'step');
        add(range(cols).map((c) => rows - 1 - step(c)), 'step');
        add(range(cols).map((c) => (c === 0 || c === cols - 1 ? mid : (mid + 1) % rows)), 'step');
    }
    return out;
}

const range = (n) => Array.from({ length: n }, (_, i) => i);
