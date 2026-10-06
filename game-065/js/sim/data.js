/**
 * data.js — every number and name in Worldroot. Pure data plus a few pure
 * helpers; no DOM, no three.js, no clock, no Math.random.
 *
 * Balance lives here. dev/simtest.mjs plays the whole progression with a bot
 * and prints a pacing table, so change a number, re-run it, and read the table.
 */

// ------------------------------------------------------------------ core tuning
export const SAVE_VERSION = 1;

export const COST_RATIO = 1.15;          // each generator costs 15% more than the last
export const MILESTONES = [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];
export const MILESTONE_MULT = 2;         // every milestone doubles that generator

export const TREE_BASE = 30;             // cost of the first Nourish
export const TREE_RATIO = 1.5;          // each Nourish costs this much more
export const TREE_STAGE_STEP = 4;        // ×this at each stage boundary
export const TREE_SUPER = 0.005;         // past level 50 costs grow by e^(k·(L−50)²) too
export const TREE_LEVELS = 100;          // level 100 = the World Tree
export const TREE_LEVEL_BONUS = 1.03;    // every tree level multiplies all production
export const REALM_TREE_SCALE = 30;      // tree costs ×this per realm already bound

// Heartwood from a rebirth depends on how tall the tree grew this cycle:
// HW_K at level 50, ×HW_G for every level above it.
export const HW_K = 40;
export const HW_G = 1.12;               // ≈ ×10 every twenty levels
export const HW_BONUS = 0.01;            // +1% production per heartwood ever earned
export const REBIRTH_STAGE = 5;          // the Grove Tree can be reborn

export const OFFLINE_BASE_EFF = 0.5;     // offline production starts at 50%
export const OFFLINE_BASE_HOURS = 8;

export const SEASON_LENGTH = 300;        // seconds of game time per season

export const SAP_BASE_MAX = 50;
export const SAP_PER_STAGE = 15;
export const SAP_REGEN = 0.12;           // sap per second before upgrades

export const WISP_MIN = 120;             // seconds between wisps, before upgrades
export const WISP_MAX = 300;
export const WISP_LIFE = 14;             // seconds a wisp lingers

// ------------------------------------------------------------------ generators
// Base costs and rates follow the classic ~×11 cost / ~×6 rate ladder per tier.
export const GENERATORS = [
    { id: 'firefly',  name: 'Firefly',         plural: 'Fireflies',        icon: '✨', cost: 15,     mps: 0.1,   stage: 0,
      desc: 'A spark that never learned to be afraid of the dark. It carries motes down from the canopy.' },
    { id: 'glowcap',  name: 'Glowcap',         plural: 'Glowcaps',         icon: '🍄', cost: 100,    mps: 1,     stage: 0,
      desc: 'A mushroom that drinks starlight through its roots and breathes it out as motes.' },
    { id: 'sprite',   name: 'Dew Sprite',      plural: 'Dew Sprites',      icon: '💧', cost: 1100,   mps: 8,     stage: 0,
      desc: 'Tiny water spirits that gather dawn light in drops of dew.' },
    { id: 'moth',     name: 'Lantern Moth',    plural: 'Lantern Moths',    icon: '🦋', cost: 12000,  mps: 47,    stage: 1,
      desc: 'Moths with paper-thin wings that glow like lanterns. They dust the air with light.' },
    { id: 'fox',      name: 'Fox Spirit',      plural: 'Fox Spirits',      icon: '🦊', cost: 1.3e5,  mps: 260,   stage: 1,
      desc: 'A kitsune who lights foxfire along the paths for anyone lost in the wood.' },
    { id: 'well',     name: 'Moonwell',        plural: 'Moonwells',        icon: '🌙', cost: 1.4e6,  mps: 1400,  stage: 2,
      desc: 'A ring of mossy stones around water that holds the moon even on cloudy nights.' },
    { id: 'stones',   name: 'Standing Stone',  plural: 'Standing Stones',  icon: '🗿', cost: 2e7,    mps: 7800,  stage: 3,
      desc: 'Old stones carved with runes. When enough of them stand together, they hum.' },
    { id: 'treant',   name: 'Treant',          plural: 'Treants',          icon: '🌳', cost: 3.3e8,  mps: 44000, stage: 4,
      desc: 'Walking trees, slow and patient, who tend the younger forest.' },
    { id: 'stag',     name: 'White Stag',      plural: 'White Stags',      icon: '🦌', cost: 5.1e9,  mps: 2.6e5, stage: 5,
      desc: 'Antlers like silver branches. Where a white stag walks, light gathers in its hoofprints.' },
    { id: 'loom',     name: 'Aurora Loom',     plural: 'Aurora Looms',     icon: '🌌', cost: 7.5e10, mps: 1.6e6, stage: 6,
      desc: 'A loom of starlight that weaves the northern lights and spins their loose threads into motes.' },
    { id: 'dryad',    name: 'Dryad Court',     plural: 'Dryad Courts',     icon: '🧚', cost: 1e12,   mps: 1e7,   stage: 7,
      desc: 'The tree-maidens of the deep wood hold court, and the whole forest grows brighter.' },
    { id: 'starseed', name: 'Star Seed',       plural: 'Star Seeds',       icon: '🌟', cost: 1.4e13, mps: 6.5e7, stage: 8,
      desc: 'A fallen star planted in the roots of the world. Something enormous is growing from it.' },
];

const TIER_NAMES = [
    ['Brighter Bellies', 'Summer Dusk', 'Lantern Swarms', 'Firefly Choir', 'Glowworm Cousins', 'Endless Twilight', 'Living Constellations', 'The Lamp of the World'],
    ['Rich Loam', 'Spore Song', 'Fairy Rings', 'Mycelial Web', 'Moonlit Caps', 'Deepmould', 'The Underglow', 'Mother Mycelium'],
    ['Morning Dew', 'Dewdrop Prisms', 'Sprite Dances', 'Mist Weaving', 'Rainbow Scales', 'Cloud Tears', 'Tidal Moonbeams', 'Queen of Droplets'],
    ['Silken Wings', 'Paper Lanterns', 'Moth Lights', 'Dusk Pollen', 'Silvered Dust', 'Luminous Cocoons', 'Moonmoth Migration', 'The Great Moth'],
    ['Kitsune Smiles', 'Twin Tails', 'Foxfire Paths', 'Nine Tails', 'Shrine Offerings', 'Trickster Trails', 'Fox Weddings', 'Inari\'s Blessing'],
    ['Clear Waters', 'Silver Basins', 'Lunar Tides', 'Wishing Coins', 'Reflecting Pools', 'Moon Drinking', 'Eclipse Water', 'The Moon Below'],
    ['Carved Runes', 'Solstice Alignment', 'Humming Stones', 'Ley Lines', 'Druid Chants', 'Henge Fires', 'Stone Dreams', 'The Eternal Circle'],
    ['Bark Hide', 'Slow Walkers', 'Root Speech', 'Elder Council', 'Acorn Hoards', 'Forest Shepherds', 'Old Growth', 'The First Treant'],
    ['Silver Antlers', 'Swift Hooves', 'Moonlit Herds', 'Antler Crowns', 'Hunt\'s End', 'Starlit Glades', 'The Unseen Path', 'King of the Wood'],
    ['Spun Light', 'Northern Threads', 'Colour Weft', 'Sky Tapestries', 'Polar Spindles', 'Woven Dawn', 'Curtains of Heaven', 'The Loom of Ages'],
    ['Dryad Whispers', 'Willow Maidens', 'Oak Matrons', 'Birch Heralds', 'Court of Leaves', 'Verdant Thrones', 'Evergreen Oath', 'The Green Queen'],
    ['Fallen Embers', 'Comet Kernels', 'Nebula Husks', 'Starlight Sprouts', 'Galactic Roots', 'Celestial Bloom', 'Cosmic Canopy', 'The Seed of Stars'],
];
const TIER_OWNED = [1, 5, 25, 50, 100, 150, 200, 250];
const TIER_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e13];

// ------------------------------------------------------------------ tree stages
export const STAGES = [
    { name: 'Seed',        lore: 'A seed of light lies in the clearing, warm as a held breath. Touch it, and it remembers how to grow.' },
    { name: 'Sprout',      lore: 'A green thread unfurls from the seed. The fireflies gather to watch, and a wisp drifts close.' },
    { name: 'Seedling',    lore: 'Two leaves, then four. Sap begins to move, and the grove learns its first spells.' },
    { name: 'Sapling',     lore: 'The sapling sways taller than the ferns. Old stones in the undergrowth begin to hum.' },
    { name: 'Young Tree',  lore: 'Bark thickens. Roots find the deep water. The treants come to see what woke them.' },
    { name: 'Grove Tree',  lore: 'The tree shades the whole clearing now. It could drop a seed and begin again, stronger.' },
    { name: 'Elder Tree',  lore: 'Its crown catches the aurora. The forest around it glows a little brighter every night.' },
    { name: 'Ancient Tree', lore: 'Dryads sing in its branches. Rings beneath the bark count centuries that have not happened yet.' },
    { name: 'Great Tree',  lore: 'Its roots touch fallen stars. Clouds snag in its upper branches and rain light.' },
    { name: 'Sky Tree',    lore: 'Its canopy holds up the night. The stars lean in to listen.' },
    { name: 'World Tree',  lore: 'The roots hold the earth, the branches hold the heavens. Worlds can be bound to its boughs.' },
];
export const stageOf = (level) => Math.min(10, Math.floor(level / 10));

// ------------------------------------------------------------------ spells
export const SPELLS = [
    { id: 'surge',   name: 'Verdant Surge',  icon: '🌿', cost: 20, stage: 2, desc: 'All production ×3 for 60 seconds.' },
    { id: 'hands',   name: 'Moonlit Hands',  icon: '🖐️', cost: 15, stage: 2, desc: 'Clicks ×20 for 30 seconds.' },
    { id: 'lure',    name: 'Call the Wisp',  icon: '🔮', cost: 30, stage: 3, desc: 'A golden wisp appears right now.' },
    { id: 'quicken', name: 'Quicken Time',   icon: '⏳', cost: 60, stage: 4, desc: 'Gain 5 minutes of production at once.' },
    { id: 'starfall', name: 'Starfall',      icon: '☄️', cost: 90, stage: 6, desc: 'All production ×10 for 30 seconds.' },
];

// ------------------------------------------------------------------ wisps
export const WISP_KINDS = [
    { id: 'lucky',   w: 46, name: 'Lucky Wisp',   desc: 'A shower of motes' },
    { id: 'frenzy',  w: 38, name: 'Wild Bloom',   desc: 'Production ×7 for 77 s' },
    { id: 'kinship', w: 9,  name: 'Kinship',      desc: 'One kind of spirit ×(1 + 10% per owned) for 30 s' },
    { id: 'storm',   w: 4,  name: 'Spark Storm',  desc: 'Clicks ×777 for 13 s' },
    { id: 'spring',  w: 3,  name: 'Sap Spring',   desc: 'Sap refilled' },
];

// ------------------------------------------------------------------ seasons
export const SEASONS = [
    { id: 'spring', name: 'Spring', icon: '🌸', desc: 'Clicks ×2' },
    { id: 'summer', name: 'Summer', icon: '☀️', desc: 'Spirits produce ×1.25' },
    { id: 'autumn', name: 'Autumn', icon: '🍂', desc: 'Wisps come twice as often' },
    { id: 'winter', name: 'Winter', icon: '❄️', desc: 'Sap flows twice as fast' },
];

// ------------------------------------------------------------------ upgrades
// effect kinds (see game.js derive()):
//   gen {gen, mult}         one generator ×mult
//   click {mult}            click power ×mult
//   clickPct {pct}          clicks also give pct of motes/s
//   global {mult}           all production ×mult
//   synergy {gen, from, pct} gen +pct per `from` owned
//   radiance {k}            all production ×(1 + k × achievements)
//   wisp {freq, dur, power} wisp tuning (multipliers)
//   sap {max, regen}        sap tuning (add, multiplier)
export const UPGRADES = [];

GENERATORS.forEach((g, gi) => {
    TIER_NAMES[gi].forEach((name, t) => {
        UPGRADES.push({
            id: `g${gi}t${t}`, name, icon: g.icon, cost: g.cost * TIER_COST[t],
            desc: `${g.plural} are twice as bright.`,
            req: { gen: gi, owned: TIER_OWNED[t] },
            fx: { kind: 'gen', gen: gi, mult: 2 },
        });
    });
});

const CLICK_UPS = [
    ['Gentle Touch',         100,  { kind: 'click', mult: 2 },        { clicks: 10 }],
    ['Warm Palms',           600,  { kind: 'click', mult: 2 },        { clicks: 60 }],
    ['Glimmering Fingertips', 8000, { kind: 'clickPct', pct: 0.01 },  { clickMotes: 1000 }],
    ['Moth-Wing Gloves',     1e5,  { kind: 'clickPct', pct: 0.01 },   { clickMotes: 1e5 }],
    ['Dewdrop Rings',        1e7,  { kind: 'clickPct', pct: 0.01 },   { clickMotes: 1e7 }],
    ['Foxfire Knuckles',     1e9,  { kind: 'clickPct', pct: 0.01 },   { clickMotes: 1e9 }],
    ['Moonstone Bracelet',   1e11, { kind: 'clickPct', pct: 0.01 },   { clickMotes: 1e11 }],
    ['Runic Palm',           1e13, { kind: 'clickPct', pct: 0.01 },   { clickMotes: 1e13 }],
    ['Treant\'s Handshake',  1e15, { kind: 'clickPct', pct: 0.01 },   { clickMotes: 1e15 }],
    ['Hand of the Stars',    1e17, { kind: 'clickPct', pct: 0.01 },   { clickMotes: 1e17 }],
];
CLICK_UPS.forEach(([name, cost, fx, req], i) => {
    const desc = fx.kind === 'click' ? 'Clicks are twice as strong.' : 'Each click also gathers 1% of your motes per second.';
    UPGRADES.push({ id: `c${i}`, name, icon: '👆', cost, desc, req, fx });
});

// Each pair of neighbouring spirits helps the next one up.
const SYN_NAMES = ['Glowcap Lanterns', 'Sprites in the Gills', 'Dew on Moth Wings', 'Moth-Lit Fox Trails', 'Fox Wishes', 'Moon-Bathed Stones',
    'Treants Raise Stones', 'Stags Among Treants', 'Antler Threads', 'Dryads at the Loom', 'Star-Crowned Dryads'];
for (let i = 0; i < GENERATORS.length - 1; i++) {
    const a = GENERATORS[i], b = GENERATORS[i + 1];
    UPGRADES.push({
        id: `s${i}`, name: SYN_NAMES[i], icon: '🔗', cost: b.cost * 40,
        desc: `${b.plural} gain +1% for every ${a.name.toLowerCase()} you own.`,
        req: { gen: i, owned: 15, gen2: i + 1, owned2: 15 },
        fx: { kind: 'synergy', gen: i + 1, from: i, pct: 0.01 },
    });
}

// Radiance: the more achievements, the brighter the grove.
const RAD = [
    ['Glowmoss Lamps',   5,   1e5,  0.01], ['Lightwood Lanterns', 12, 1e7, 0.01], ['Mote Mirrors', 20, 1e9, 0.0125],
    ['Prism Leaves',     30,  1e11, 0.0125], ['Halo Bark', 42, 1e13, 0.015], ['Crown of Radiance', 56, 1e15, 0.015],
    ['Living Aurora',    72,  1e17, 0.0175], ['The Grove Remembers', 90, 1e19, 0.02],
];
RAD.forEach(([name, ach, cost, k], i) => {
    UPGRADES.push({
        id: `r${i}`, name, icon: '💫', cost, desc: `All production +${(k * 100).toFixed(1)}% per achievement.`,
        req: { ach }, fx: { kind: 'radiance', k },
    });
});

// Tree-stage upgrades: each stage opens one big global multiplier.
const SAP_VEINS = ['Sap Veins', 'Root Wells', 'Bark Runes', 'Heartwood Glow', 'Leaf Prisms', 'Crown of Light', 'Ring Memories', 'Star Roots', 'Sky Branches', 'The World\'s Breath'];
SAP_VEINS.forEach((name, i) => {
    UPGRADES.push({
        id: `t${i}`, name, icon: '🌳', cost: treeCostRaw(10 * (i + 1) + 3),
        desc: 'All production ×1.3.', req: { stage: i + 1 }, fx: { kind: 'global', mult: 1.3 },
    });
});

const WISP_UPS = [
    ['Wisp Lantern',  3,  5e3,  { kind: 'wisp', freq: 1.3 }, 'Wisps come 30% more often.'],
    ['Lantern Path',  10, 5e6,  { kind: 'wisp', freq: 1.3, dur: 1.5 }, 'Wisps come 30% more often and linger 50% longer.'],
    ['Will-o\'-Ways', 30, 5e10, { kind: 'wisp', freq: 1.3, power: 1.25 }, 'Wisps come 30% more often; their gifts are 25% stronger.'],
    ['Wisp Song',     80, 5e14, { kind: 'wisp', power: 1.5, dur: 1.3 }, 'Wisp gifts are 50% stronger and they linger 30% longer.'],
];
WISP_UPS.forEach(([name, wisps, cost, fx, desc], i) => {
    UPGRADES.push({ id: `w${i}`, name, icon: '🔮', cost, desc, req: { wisps }, fx });
});

const SAP_UPS = [
    ['Sap Channels', 2, 5e4], ['Deep Taproot', 4, 5e8], ['Living Cistern', 6, 5e12], ['River of Sap', 8, 5e16],
];
SAP_UPS.forEach(([name, stage, cost], i) => {
    UPGRADES.push({ id: `p${i}`, name, icon: '🍯', cost, desc: 'Sap +25 maximum and flows 25% faster.', req: { stage }, fx: { kind: 'sap', max: 25, regen: 1.25 } });
});

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// ------------------------------------------------------------------ heartwood (prestige 1)
// Permanent. `cost(level)` is the price of the next level.
export const HEARTWOOD = [
    { id: 'roots',   name: 'Deep Roots',      icon: '🌱', max: 3,  cost: (l) => [5, 60, 600][l],
      desc: (l) => `Each new cycle starts with the tree at level ${10 * l}.`, next: (l) => `Start at tree level ${10 * (l + 1)}.` },
    { id: 'dowry',   name: 'Firefly Dowry',   icon: '✨', max: 3,  cost: (l) => [2, 20, 200][l],
      desc: (l) => `Start each cycle with ${[0, 10, 25, 50][l]} of each of the first three spirits.`, next: (l) => `Start with ${[10, 25, 50][l]} of each.` },
    { id: 'dream',   name: 'Dreaming Grove',  icon: '💤', max: 5,  cost: (l) => 3 * Math.pow(4, l),
      desc: (l) => `Offline production at ${50 + l * 10}%.`, next: (l) => `${60 + l * 10}% offline production.` },
    { id: 'sleep',   name: 'Long Sleep',      icon: '🌙', max: 4,  cost: (l) => 4 * Math.pow(5, l),
      desc: (l) => `Offline progress is kept for up to ${[8, 12, 24, 48, 72][l]} hours.`, next: (l) => `Up to ${[12, 24, 48, 72][l]} hours.` },
    { id: 'hands',   name: 'Spirit Hands',    icon: '🖐️', max: 5,  cost: (l) => 3 * Math.pow(4, l),
      desc: (l) => `Spirit hands touch the tree ${[0, 1, 2, 4, 6, 10][l]} time${l === 1 ? '' : 's'} a second.`, next: (l) => `${[1, 2, 4, 6, 10][l]} touch${l === 0 ? '' : 'es'} a second.` },
    { id: 'keepers', name: 'Grove Keepers',   icon: '🧑‍🌾', max: 1, cost: () => 8,
      desc: (l) => l ? 'Keepers buy spirits for you (toggle in the Grove tab).' : 'Unlocks automatic spirit buying.', next: () => 'Automatic spirit buying.' },
    { id: 'scribes', name: 'Rune Scribes',    icon: '📜', max: 1, cost: () => 15,
      desc: (l) => l ? 'Scribes buy upgrades for you (toggle in the Upgrades tab).' : 'Unlocks automatic upgrade buying.', next: () => 'Automatic upgrade buying.' },
    { id: 'gardener', name: 'Gardener\'s Will', icon: '🪴', max: 1, cost: () => 25,
      desc: (l) => l ? 'The tree nourishes itself (toggle in the Tree tab).' : 'Unlocks automatic Nourish.', next: () => 'Automatic Nourish.' },
    { id: 'catcher', name: 'Wisp Catcher',    icon: '🕸️', max: 1, cost: () => 40,
      desc: (l) => l ? 'Wisps you miss are caught for you.' : 'Wisps you miss are caught for you.', next: () => 'Missed wisps are caught for you.' },
    { id: 'kin',     name: 'Wisp Kin',        icon: '🔮', max: 5,  cost: (l) => 5 * Math.pow(3, l),
      desc: (l) => `Wisps come ${l * 10}% more often.`, next: (l) => `${(l + 1) * 10}% more often.` },
    { id: 'bark',    name: 'Ancient Bark',    icon: '🪵', max: 5,  cost: (l) => 6 * Math.pow(4, l),
      desc: (l) => `Spirits cost ${l * 4}% less.`, next: (l) => `${(l + 1) * 4}% cheaper spirits.` },
    { id: 'wells',   name: 'Sap Wells',       icon: '🍯', max: 5,  cost: (l) => 4 * Math.pow(3, l),
      desc: (l) => `Sap +${l * 20} maximum and flows ${l * 20}% faster.`, next: (l) => `+${(l + 1) * 20} sap, ${(l + 1) * 20}% faster.` },
    { id: 'heart',   name: 'Heart of the Forest', icon: '❤️', max: 999, cost: (l) => Math.round(10 * Math.pow(2.5, l)),
      desc: (l) => `All production ×${fmtMult(Math.pow(1.25, l))}.`, next: (l) => `×${fmtMult(Math.pow(1.25, l + 1))} production.` },
];
export const HEARTWOOD_BY_ID = Object.fromEntries(HEARTWOOD.map((h) => [h.id, h]));

// ------------------------------------------------------------------ realms (prestige 2)
export const REALMS = [
    { id: 'midgard',   name: 'Midgard',      color: 0x6fcf6a, desc: 'Every spirit produces ×3.' },
    { id: 'alfheim',   name: 'Alfheim',      color: 0xfff1a8, desc: 'Wisps come twice as often and their gifts are ×1.5.' },
    { id: 'vanaheim',  name: 'Vanaheim',     color: 0x8ef0c8, desc: 'Season bonuses are doubled.' },
    { id: 'asgard',    name: 'Asgard',       color: 0xffcf5a, desc: 'Heartwood from rebirth ×2.' },
    { id: 'jotunheim', name: 'Jotunheim',    color: 0x9cc8ff, desc: 'Clicks ×10 and spirit hands click twice as fast.' },
    { id: 'svartalf',  name: 'Svartalfheim', color: 0xb08cff, desc: 'Spirits cost 25% less.' },
    { id: 'niflheim',  name: 'Niflheim',     color: 0xd8f4ff, desc: 'Offline production +25% and kept 24 hours longer; sap ×2.' },
    { id: 'muspel',    name: 'Muspelheim',   color: 0xff7a3a, desc: 'Spell effects ×2 and spells cost half.' },
    { id: 'helheim',   name: 'Helheim',      color: 0x7f8fb0, desc: 'Tree costs ÷100.' },
];
export const REALM_BY_ID = Object.fromEntries(REALMS.map((r) => [r.id, r]));

// ------------------------------------------------------------------ trials (challenges)
export const TRIALS = [
    { id: 'silent',   name: 'The Silent Grove', goal: 6, needs: 40, rule: 'Clicking the tree does nothing.',
      reward: 'All spirits produce ×1.5.' },
    { id: 'lonely',   name: 'Lonely Light',     goal: 5, needs: 150, rule: 'Only Fireflies, Glowcaps and Dew Sprites can be bought.',
      reward: 'Fireflies, Glowcaps and Dew Sprites ×10.' },
    { id: 'withered', name: 'Withered Soil',    goal: 7, needs: 500, rule: 'Each spirit costs 25% more than the last (not 15%).',
      reward: 'Each spirit costs 14% more than the last (not 15%).' },
    { id: 'starless', name: 'Starless Night',   goal: 7, needs: 2000, rule: 'No wisps, and no spells.',
      reward: 'Wisp gifts ×1.5 and spells cost 25% less.' },
    { id: 'hungry',   name: 'Hungry Roots',     goal: 8, needs: 8000, rule: 'Nourishing the tree costs ×1000.',
      reward: 'Nourishing the tree costs ÷10.' },
    { id: 'brief',    name: 'Brief Light',      goal: 8, needs: 25000, rule: 'Spirits produce ×0.05, but clicks are ×100.',
      reward: 'Clicks ×5.' },
];
export const TRIAL_BY_ID = Object.fromEntries(TRIALS.map((t) => [t.id, t]));

// ------------------------------------------------------------------ achievements
// test(s) reads the plain state. Each one adds Radiance.
export const ACHIEVEMENTS = [];
const MOTE_NAMES = ['A Glimmer', 'A Handful of Light', 'Lantern Bright', 'Bonfire', 'Starlit', 'Moonlit', 'Sunrise', 'Constellation', 'Nebula',
    'Galaxy', 'Starstream', 'Cosmic Dawn', 'Light of Ages', 'Ocean of Light', 'Infinite Glow', 'Beyond Counting', 'Every Star', 'The Light Before Light',
    'Brighter Than Brightness', 'Lumen Eternal', 'The Last Shadow Fades'];
MOTE_NAMES.forEach((name, i) => {
    const n = Math.pow(10, i + 2);
    ACHIEVEMENTS.push({ id: `m${i}`, name, desc: `Gather ${n} motes in all.`, n, test: (s) => s.totalMotes >= n, cat: 'motes' });
});
const OWN_LEVELS = [1, 50, 100, 200, 300];
GENERATORS.forEach((g, gi) => {
    OWN_LEVELS.forEach((n, j) => {
        const names = [`First ${g.name}`, `${g.plural} in Bloom`, `A Hundred ${g.plural}`, `${g.name} Sanctuary`, `${g.name} Kingdom`];
        ACHIEVEMENTS.push({ id: `o${gi}_${j}`, name: names[j], desc: `Own ${n} ${n === 1 ? g.name : g.plural}.`, test: (s) => s.gens[gi] >= n, cat: 'grove' });
    });
});
STAGES.forEach((st, i) => {
    if (i === 0) return;
    ACHIEVEMENTS.push({ id: `st${i}`, name: st.name, desc: `Grow the tree into a ${st.name}.`, test: (s) => s.bestStage >= i, cat: 'tree' });
});
[[1, 'Touch of Light'], [100, 'Tapping Along'], [1000, 'Dedicated Toucher'], [10000, 'Woodpecker'], [50000, 'The Thousand-Handed']].forEach(([n, name], i) => {
    ACHIEVEMENTS.push({ id: `c${i}`, name, desc: `Click the tree ${n} times.`, test: (s) => s.stats.clicks >= n, cat: 'clicks' });
});
[[1e3, 'Firm Grip'], [1e6, 'Strong Hands'], [1e9, 'Light-Fingered'], [1e12, 'Hand of Dawn'], [1e15, 'Hand of Noon']].forEach(([n, name], i) => {
    ACHIEVEMENTS.push({ id: `cm${i}`, name, desc: `Gather ${n} motes by clicking.`, test: (s) => s.stats.clickMotes >= n, cat: 'clicks' });
});
[[1, 'Will-o\'-the-Wisp'], [10, 'Wisp Watcher'], [50, 'Wisp Whisperer'], [150, 'Wispherd'], [400, 'Lord of Lights']].forEach(([n, name], i) => {
    ACHIEVEMENTS.push({ id: `w${i}`, name, desc: `Catch ${n} golden wisp${n > 1 ? 's' : ''}.`, test: (s) => s.stats.wisps >= n, cat: 'wisps' });
});
[[1, 'First Spell'], [25, 'Apprentice of Sap'], [100, 'Grove Mage'], [500, 'Archdruid']].forEach(([n, name], i) => {
    ACHIEVEMENTS.push({ id: `sp${i}`, name, desc: `Cast ${n} spell${n > 1 ? 's' : ''}.`, test: (s) => s.stats.spells >= n, cat: 'spells' });
});
[[1, 'Rebirth'], [5, 'Turning Seasons'], [15, 'The Wheel of Years'], [50, 'Evergreen']].forEach(([n, name], i) => {
    ACHIEVEMENTS.push({ id: `rb${i}`, name, desc: `Be reborn ${n} time${n > 1 ? 's' : ''}.`, test: (s) => s.rebirths >= n, cat: 'rebirth' });
});
[[10, 'Heartwood'], [100, 'Ringed'], [1000, 'Ironwood'], [10000, 'Petrified Glory']].forEach(([n, name], i) => {
    ACHIEVEMENTS.push({ id: `hw${i}`, name, desc: `Earn ${n} heartwood in all.`, test: (s) => s.hwEarned >= n, cat: 'rebirth' });
});
REALMS.forEach((r, i) => {
    ACHIEVEMENTS.push({ id: `rl${i}`, name: `${i + 1} Realm${i ? 's' : ''} Bound`, desc: `Bind ${i + 1} realm${i ? 's' : ''} to the World Tree.`, test: (s) => s.realms.length >= i + 1, cat: 'realms' });
});
TRIALS.forEach((t) => {
    ACHIEVEMENTS.push({ id: `tr_${t.id}`, name: t.name, desc: `Complete the trial "${t.name}".`, test: (s) => !!s.trialsDone[t.id], cat: 'trials' });
});
ACHIEVEMENTS.push({ id: 'x_sleep', name: 'Hibernation', desc: 'Return after sleeping for 8 hours or more.', test: (s) => s.stats.longestAway >= 8 * 3600, cat: 'secret' });
ACHIEVEMENTS.push({ id: 'x_year', name: 'A Year in the Grove', desc: 'See all four seasons.', test: (s) => s.stats.seasonsSeen >= 4, cat: 'secret' });
ACHIEVEMENTS.push({ id: 'x_frugal', name: 'Patient Seed', desc: 'Reach the Sapling stage with no more than 15 spirits.', test: (s) => s.tree >= 30 && s.gens.reduce((a, b) => a + b, 0) <= 15, cat: 'secret' });
ACHIEVEMENTS.push({ id: 'x_all', name: 'Full Grove', desc: 'Own at least one of every spirit.', test: (s) => s.gens.every((n) => n > 0), cat: 'grove' });
ACHIEVEMENTS.push({ id: 'x_combo', name: 'Double Bloom', desc: 'Have three effects active at once.', test: (s) => s.buffs.length >= 3, cat: 'secret' });
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// ------------------------------------------------------------------ helpers
const fmtMult = (x) => (x < 1000 ? x.toFixed(2) : x.toExponential(2));

export function treeCostRaw(level) {
    // every new stage takes a step up: the tree must gather strength first
    const over = Math.max(0, level - 50);
    return TREE_BASE * Math.pow(TREE_RATIO, level) * Math.pow(TREE_STAGE_STEP, Math.floor(level / 10)) * Math.exp(TREE_SUPER * over * over);
}
