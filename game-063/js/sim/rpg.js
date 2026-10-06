// The hero's profile (plain JSON, saved as is) and everything derived from it: stats, gear, spells,
// items, experience and gold, the shop, and what a finished hole pays out.

export const STAT_KEYS = ['pow', 'ctl', 'lck', 'mag'];
export const STAT_INFO = {
    pow: { name: 'Power', short: 'POW', desc: 'Ball speed +1% per point' },
    ctl: { name: 'Control', short: 'CTL', desc: 'Slower meter, longer preview, less hook and slice' },
    lck: { name: 'Luck', short: 'LCK', desc: 'Wider PERFECT zone, more gold' },
    mag: { name: 'Magic', short: 'MAG', desc: '+2 max MP per point' },
};
export const MAX_LEVEL = 25;

export const CLUB_SETS = {
    willow: { name: 'Willow Woods', cost: 0, pow: 0, ctl: 0, lck: 0, mag: 0, tier: 0, desc: 'Your trusty starter set.' },
    oak: { name: 'Oakheart Set', cost: 150, pow: 2, ctl: 1, tier: 1, desc: 'Sturdy oak heads with a satisfying thock.' },
    silver: { name: 'Silversteel Set', cost: 420, pow: 3, ctl: 3, tier: 2, desc: 'Elven-forged and balanced like a dream.' },
    frost: { name: 'Frostforged Set', cost: 800, pow: 5, ctl: 3, lck: 1, tier: 3, desc: 'Cold to the touch. Hot off the tee.' },
    dragon: { name: 'Dragonbone Set', cost: 1400, pow: 7, ctl: 4, tier: 4, desc: 'Carved from a shed dragon tooth. Probably.' },
    star: { name: 'Starforged Set', cost: 2600, pow: 9, ctl: 6, lck: 3, tier: 6, desc: 'Hammered from a falling star. For legends.' },
};
export const BALLS = {
    pebble: { name: 'Pebble Ball', cost: 0, tier: 0, desc: 'Round. Mostly.' },
    feather: { name: 'Feather Ball', cost: 120, tier: 1, wind: 0.55, desc: 'Wind affects it 45% less.' },
    slime: { name: 'Slime Ball', cost: 200, tier: 1, bounce: 1.3, roll: 0.87, desc: 'Bounces 30% higher, rolls 15% farther.' },
    iron: { name: 'Iron Heart', cost: 350, tier: 2, boss: 1, wind: 0.8, roll: 1.15, desc: '+1 damage to bosses. Heavy: less wind, less roll.' },
    clover: { name: 'Clover Ball', cost: 500, tier: 3, lck: 3, gold: 0.25, desc: 'LCK +3 and 25% more gold.' },
    comet: { name: 'Comet Ball', cost: 1200, tier: 4, pow: 2, wind: 0.5, desc: 'POW +2, wind −50%, and a comet trail.' },
};
export const CHARMS = {
    none: { name: 'No charm', cost: 0, tier: 0, desc: '' },
    rabbit: { name: "Rabbit's Foot", cost: 100, tier: 1, lck: 2, desc: 'From the Meadowmere spring fair. Lucky, unless you are the rabbit.' },
    owl: { name: 'Owl Feather', cost: 180, tier: 1, ctl: 2, desc: 'Tucked in your cap, it whispers: steady, steady…' },
    ogre: { name: 'Ogre Belt', cost: 300, tier: 2, pow: 2, desc: 'A size too big. Somehow it helps.' },
    moon: { name: 'Moonstone', cost: 300, tier: 2, mag: 2, desc: 'Hums softly when Wedgewick is nearby.' },
    coin: { name: 'Mulligan Coin', cost: 600, tier: 3, mull: 2, desc: 'Heads, you try again. Mulligan costs only 2 MP.' },
    pin: { name: 'Golden Tee Pin', cost: 900, tier: 4, pow: 1, ctl: 1, lck: 1, mag: 1, desc: 'A tiny copy of the Golden Tee, for Caddie-Knights.' },
};
export const SPELLS = {
    mulligan: { name: 'Mulligan', mp: 4, key: '1', color: '#ffd84a', desc: 'Rewind your last shot. The stroke is refunded.' },
    ward: { name: 'Gust Ward', mp: 2, key: '2', color: '#9fe8ff', desc: 'Next shot ignores the wind and never hooks or slices.' },
    fire: { name: 'Fireball', mp: 3, key: '3', color: '#ff7a2a', desc: 'Next shot burns through trees and ice; double boss damage.' },
    frost: { name: 'Frost Step', mp: 3, key: '4', color: '#bfefff', desc: 'Next shot freezes water and lava beneath it and skates across.' },
    seek: { name: 'Seeker', mp: 4, key: '5', color: '#d58aff', desc: 'Next shot curves toward the cup as it gets close.' },
};
export const SPELL_ORDER = ['mulligan', 'ward', 'fire', 'frost', 'seek'];
export const ITEMS = {
    rocket: { name: 'Rocket Tee', cost: 40, icon: '🚀', desc: 'Next shot: +35% power.' },
    sticky: { name: 'Sticky Ball', cost: 30, icon: '🍯', desc: 'Next shot stops dead where it lands.' },
    spring: { name: 'Spring Ball', cost: 30, icon: '🌀', desc: 'Next shot bounces like mad.' },
    ghost: { name: 'Ghost Ball', cost: 50, icon: '👻', desc: 'Next shot passes through every obstacle.' },
    potion: { name: 'Mana Potion', cost: 25, icon: '🧪', desc: 'Restore 4 MP right now.' },
};
export const ITEM_ORDER = ['rocket', 'sticky', 'spring', 'ghost', 'potion'];

export const LOOKS = [
    { id: 'pip', name: 'Pip', hair: '#7a4a2a', hairStyle: 0, skin: '#ffd9bd', eyes: '#3a7a3a' },
    { id: 'poppy', name: 'Poppy', hair: '#e8784a', hairStyle: 1, skin: '#ffe0c8', eyes: '#3a5aa8' },
    { id: 'rowan', name: 'Rowan', hair: '#2a2438', hairStyle: 2, skin: '#c98e62', eyes: '#6a3a1a' },
    { id: 'wren', name: 'Wren', hair: '#f4e08a', hairStyle: 3, skin: '#ffe6d0', eyes: '#7a3aa8' },
];
export const OUTFITS = ['#3a8a5a', '#3a6ac8', '#c84a4a', '#8a4ac8', '#e0a030', '#2a9aa8'];

export function newProfile(name = 'Pip', look = 0, outfit = 0) {
    return {
        v: 1, name, look, outfit,
        level: 1, xp: 0, pts: 0,
        stats: { pow: 1, ctl: 1, lck: 1, mag: 1 },
        gold: 30,
        items: { rocket: 1, sticky: 0, spring: 0, ghost: 0, potion: 1 },
        owned: { clubs: ['willow'], balls: ['pebble'], charms: ['none'] },
        equip: { clubs: 'willow', ball: 'pebble', charm: 'none' },
        spells: ['mulligan'],
        holes: {},
        flags: {},
        node: 0,
        totals: { strokes: 0, holes: 0, monsters: 0, coins: 0, perfects: 0, holeInOnes: 0 },
        cleared: false,
    };
}

export function gearStats(p) {
    const out = { pow: 0, ctl: 0, lck: 0, mag: 0 };
    for (const g of [CLUB_SETS[p.equip.clubs], BALLS[p.equip.ball], CHARMS[p.equip.charm]]) {
        if (!g) continue;
        for (const k of STAT_KEYS) out[k] += g[k] || 0;
    }
    return out;
}

export function totalStats(p) {
    const g = gearStats(p);
    const out = {};
    for (const k of STAT_KEYS) out[k] = p.stats[k] + g[k];
    return out;
}

// Everything the swing and the ball use.
export function derive(p) {
    const s = totalStats(p);
    const ball = BALLS[p.equip.ball] || BALLS.pebble;
    const charm = CHARMS[p.equip.charm] || CHARMS.none;
    return {
        stats: s,
        powMult: 1 + 0.01 * s.pow,
        curveMult: Math.max(0.3, 1 - 0.04 * s.ctl),
        meterSpeed: Math.max(0.55, 1 - 0.03 * s.ctl),
        arcFrac: Math.min(1, 0.35 + 0.045 * s.ctl),
        perfectZone: Math.min(0.2, 0.065 * (1 + 0.06 * s.lck)),
        maxMp: 6 + 2 * s.mag,
        windK: ball.wind ?? 1,
        bounceK: ball.bounce ?? 1,
        rollK: ball.roll ?? 1,
        bossBonus: ball.boss ?? 0,
        goldMult: 1 + 0.03 * s.lck + (ball.gold ?? 0),
        mulliganCost: charm.mull ?? SPELLS.mulligan.mp,
        comet: p.equip.ball === 'comet',
    };
}

// A stand-in profile for tests and bots at a given progression tier.
export function tierProfile(tier) {
    const p = newProfile();
    const sets = ['willow', 'oak', 'silver', 'frost', 'dragon', 'dragon'];
    p.equip.clubs = sets[Math.min(tier, 5)];
    p.level = 1 + tier * 4;
    p.stats = { pow: 1 + tier * 2, ctl: 1 + tier * 2, lck: 1 + tier * 2, mag: 1 + tier * 2 };
    p.spells = ['mulligan', 'ward', 'fire', 'frost', 'seek'].slice(0, Math.min(5, tier + 1));
    return p;
}

// ---------------------------------------------------------------- experience
export const xpToNext = (L) => 40 + 30 * (L - 1);

export function addXp(p, n) {
    let ups = 0;
    p.xp += n;
    while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
        p.xp -= xpToNext(p.level);
        p.level++;
        p.pts += 2;
        ups++;
    }
    if (p.level >= MAX_LEVEL) p.xp = Math.min(p.xp, xpToNext(p.level));
    return ups;
}

export function allocate(p, key) {
    if (p.pts <= 0 || !STAT_KEYS.includes(key)) return false;
    p.stats[key]++;
    p.pts--;
    return true;
}

// Auto: keep the stats level, Power first.
export function autoAllocate(p) {
    while (p.pts > 0) {
        const k = STAT_KEYS.slice().sort((a, b) => p.stats[a] - p.stats[b] || STAT_KEYS.indexOf(a) - STAT_KEYS.indexOf(b))[0];
        allocate(p, k);
    }
}

// ---------------------------------------------------------------- scoring
export const SCORE_NAMES = { '-4': 'Condor!', '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', 0: 'Par', 1: 'Bogey', 2: 'Double Bogey', 3: 'Triple Bogey' };
export function scoreName(strokes, par) {
    if (strokes === 1) return 'Hole in One!';
    const d = strokes - par;
    return SCORE_NAMES[d] ?? (d < 0 ? 'Miracle!' : `+${d}`);
}
export function starsFor(strokes, par) { return strokes < par ? 3 : strokes === par ? 2 : 1; }

// What a finished hole pays: called once with the hole result. Mutates the profile.
export function applyResult(p, hole, r) {
    const prev = p.holes[hole.id];
    const first = !prev;
    const under = Math.max(0, hole.par - r.strokes);
    const d = derive(p);
    let xp = 30 + 15 * under + r.monsterXp + (r.boss ? 120 : 0);
    if (first) xp += 30;
    const gold = Math.round((20 + 15 * under + (first ? 40 : 0)) * d.goldMult) + Math.round(r.coins * d.goldMult);
    p.gold += gold;
    const stars = starsFor(r.strokes, hole.par);
    p.holes[hole.id] = { best: prev ? Math.min(prev.best, r.strokes) : r.strokes, stars: Math.max(prev?.stars ?? 0, stars) };
    p.totals.strokes += r.strokes; p.totals.holes++; p.totals.monsters += r.monsters; p.totals.coins += r.coins; p.totals.perfects += r.perfects;
    if (r.strokes === 1) p.totals.holeInOnes++;
    for (const [k, n] of Object.entries(r.itemsFound || {})) p.items[k] = Math.min(9, (p.items[k] || 0) + n);
    const level0 = p.level;
    const ups = addXp(p, xp);
    return { xp, gold, stars, first, ups, level0, level: p.level, best: p.holes[hole.id].best, newBest: !prev || r.strokes < prev.best };
}

// ---------------------------------------------------------------- shop
// progress: number of realms cleared (0..5)
export function shopStock(p, progress) {
    const tier = progress + (p.cleared ? 1 : 0);
    const out = [];
    for (const [id, g] of Object.entries(CLUB_SETS)) if (g.cost > 0 && g.tier <= tier + 1) out.push({ cat: 'clubs', id, ...g, owned: p.owned.clubs.includes(id) });
    for (const [id, g] of Object.entries(BALLS)) if (g.cost > 0 && g.tier <= tier + 1) out.push({ cat: 'balls', id, ...g, owned: p.owned.balls.includes(id) });
    for (const [id, g] of Object.entries(CHARMS)) if (g.cost > 0 && g.tier <= tier + 1) out.push({ cat: 'charms', id, ...g, owned: p.owned.charms.includes(id) });
    for (const id of ITEM_ORDER) out.push({ cat: 'items', id, ...ITEMS[id], have: p.items[id] || 0 });
    return out;
}

export function buy(p, cat, id) {
    const table = { clubs: CLUB_SETS, balls: BALLS, charms: CHARMS, items: ITEMS }[cat];
    const g = table?.[id];
    if (!g || p.gold < g.cost) return false;
    if (cat === 'items') {
        if ((p.items[id] || 0) >= 9) return false;
        p.items[id] = (p.items[id] || 0) + 1;
    } else {
        if (p.owned[cat].includes(id)) return false;
        p.owned[cat].push(id);
        equip(p, cat, id);
    }
    p.gold -= g.cost;
    return true;
}

export function equip(p, cat, id) {
    if (!p.owned[cat]?.includes(id)) return false;
    p.equip[{ clubs: 'clubs', balls: 'ball', charms: 'charm' }[cat]] = id;
    return true;
}
