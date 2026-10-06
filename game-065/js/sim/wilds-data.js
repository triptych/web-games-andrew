/**
 * wilds-data.js — the numbers and names of everything around the core loop:
 * spirit kinship, expeditions, relics, the moonpetal garden, whispers, the
 * amber peddler, badges, titles, feats and the codex.
 *
 * None of it resets on rebirth, and none of it is needed to grow the tree:
 * the bonuses are small and the rewards are mostly amber (spent only here)
 * and collections. Feats are achievements that pay amber instead of adding
 * Radiance, so the core balance (data.js) doesn't move.
 *
 * Pure data and helpers: no DOM, no three.js, no clock, no Math.random.
 */

import { GENERATORS, SPELLS, WISP_KINDS, UPGRADES } from './data.js';

// ------------------------------------------------------------------ kinship
// Each kind of spirit you own builds kinship over time (√owned per second,
// offline too). Each level makes that spirit 1.5% brighter, up to level 20.
export const KIN_MAX = 20;
export const KIN_BONUS = 0.015;
export const kinCost = (level) => 600 * Math.pow(1.6, level);      // xp from `level` to level + 1

// ------------------------------------------------------------------ expeditions
// A party of spirits sets out to one of the Deepwood's places and comes home
// with amber, a satchel of light and, often, a relic. Time is game time, so
// parties travel while you are away.
export const EXP_SITES = [
    { id: 'hollow', name: 'Mossy Hollow',    icon: '🍂', stage: 1, amber: 1,
      desc: 'A sunken dell where the moss grows knee-deep and lost things sleep.' },
    { id: 'mere',   name: 'Mirror Mere',     icon: '🪞', stage: 3, amber: 1.5,
      desc: 'A still lake that shows the sky as it was a hundred years ago.' },
    { id: 'barrow', name: 'Barrow Hills',    icon: '⛰️', stage: 5, amber: 2,
      desc: 'Green mounds where the old kings sleep with their treasures and their oaths.' },
    { id: 'crater', name: 'Starfall Crater', icon: '☄️', stage: 7, amber: 3,
      desc: 'Where a star came down, the ground still hums and glitters.' },
];
export const EXP_SITE_BY_ID = Object.fromEntries(EXP_SITES.map((x) => [x.id, x]));
// amber is per site multiplier; light is minutes of production per hour away; relic is the chance of one
export const EXP_TIMES = [
    { id: 'stroll',  name: 'A stroll',     secs: 600,       amber: 2, light: 1, relic: 0.08 },
    { id: 'journey', name: 'A journey',    secs: 3600,      amber: 8, light: 1, relic: 0.3 },
    { id: 'quest',   name: 'A quest',      secs: 4 * 3600,  amber: 24, light: 1, relic: 0.65 },
    { id: 'odyssey', name: 'An odyssey',   secs: 8 * 3600,  amber: 40, light: 1, relic: 0.9 },
];

// ------------------------------------------------------------------ relics
// Six per site. Effect kinds (all small, all additive within their kind):
//   prod (all production), gens (listed spirits), click, wispFreq, wispDur,
//   wispPower, sapMax (flat), sapRegen, offline (efficiency), amber, kin
//   (kinship xp), buffDur (herb blessings and bottles only: spells and wisp
//   gifts are the core game's big multipliers, so they stay as they are),
//   expSpeed, garden (growth speed)
export const RELICS = [
    // Mossy Hollow
    { id: 'acorn',   site: 'hollow', name: 'Acorn-Cap Cup',      icon: '🌰', fx: { gens: [0, 1], v: 0.15 }, text: 'Fireflies and Glowcaps +15%.',
      lore: 'A squirrel drank dew from it every morning for a hundred years. It still smells of dawn.' },
    { id: 'shell',   site: 'hollow', name: 'Snail-Shell Lantern', icon: '🐚', fx: { wispFreq: 0.05 }, text: 'Wisps come 5% more often.',
      lore: 'Something small and patient once carried its own light in here.' },
    { id: 'fiddle',  site: 'hollow', name: 'Fiddlehead Charm',   icon: '🌀', fx: { kin: 0.1 }, text: 'Kinship grows 10% faster.',
      lore: 'A fern frond that never unrolled, because it was waiting for a friend.' },
    { id: 'nest',    site: 'hollow', name: 'Moss Pillow',        icon: '🪺', fx: { offline: 0.03 }, text: 'Offline production +3%.',
      lore: 'Whoever sleeps on it dreams of the grove, and the grove dreams back.' },
    { id: 'flute',   site: 'hollow', name: 'Reed Flute',         icon: '🎋', fx: { click: 0.1 }, text: 'Touches +10%.',
      lore: 'Play one note and every firefly in the hollow turns to listen.' },
    { id: 'beetle',  site: 'hollow', name: 'Beetle-Wing Brooch', icon: '🪲', fx: { prod: 0.02 }, text: 'All production +2%.',
      lore: 'Green-gold and iridescent. A gift, freely given, from a very large beetle.' },
    // Mirror Mere
    { id: 'scale',   site: 'mere', name: 'Moonlit Scale',      icon: '🐟', fx: { gens: [2, 3], v: 0.15 }, text: 'Dew Sprites and Lantern Moths +15%.',
      lore: 'Shed by a fish that swims in the moon\'s reflection and nowhere else.' },
    { id: 'lily',    site: 'mere', name: 'Silver Lily',        icon: '💮', fx: { sapMax: 10 }, text: 'Sap +10 maximum.',
      lore: 'It opens only when nobody is looking, and closes with a sigh.' },
    { id: 'bell',    site: 'mere', name: 'Drowned Bell',       icon: '🔔', fx: { wispDur: 0.1 }, text: 'Wisps linger 10% longer.',
      lore: 'It rings underwater on still nights. The wisps come to hear it.' },
    { id: 'feather', site: 'mere', name: 'Heron Feather',      icon: '🪶', fx: { expSpeed: 0.1 }, text: 'Expeditions return 10% sooner.',
      lore: 'Tuck it in a pack and the long way home becomes a little shorter.' },
    { id: 'orb',     site: 'mere', name: 'Dewglass Orb',       icon: '🫧', fx: { prod: 0.02 }, text: 'All production +2%.',
      lore: 'A single drop of dew, grown as big as an apple and never fallen.' },
    { id: 'pearl',   site: 'mere', name: 'Kelpie\'s Pearl',    icon: '🦪', fx: { amber: 0.1 }, text: 'Amber +10% from every source.',
      lore: 'The water-horse gave it up without a fight, which is the strangest part.' },
    // Barrow Hills
    { id: 'rune',    site: 'barrow', name: 'Runestone Shard',  icon: '🪨', fx: { gens: [5, 6], v: 0.15 }, text: 'Moonwells and Standing Stones +15%.',
      lore: 'Half a word in a language the hills still speak in their sleep.' },
    { id: 'torc',    site: 'barrow', name: 'Bronze Torc',      icon: '📿', fx: { gens: [4, 7], v: 0.15 }, text: 'Fox Spirits and Treants +15%.',
      lore: 'Worn by a chieftain who was kind to foxes. The foxes remember.' },
    { id: 'antler',  site: 'barrow', name: 'Elder\'s Antler',  icon: '🦌', fx: { gens: [8, 9], v: 0.15 }, text: 'White Stags and Aurora Looms +15%.',
      lore: 'Shed by the first white stag, the one who taught the others to walk softly.' },
    { id: 'owl',     site: 'barrow', name: 'Owl-Skull Charm',  icon: '🦉', fx: { offline: 0.03 }, text: 'Offline production +3%.',
      lore: 'The owl keeps watch while you sleep. It always has.' },
    { id: 'candle',  site: 'barrow', name: 'Barrow Candle',    icon: '🕯️', fx: { buffDur: 0.1 }, text: 'Herb blessings and Bottled Starlight last 10% longer.',
      lore: 'Lit for a king\'s funeral and never put out. It burns slow.' },
    { id: 'oath',    site: 'barrow', name: 'Oathring',         icon: '💍', fx: { prod: 0.03 }, text: 'All production +3%.',
      lore: 'Two old friends swore on it to guard the wood. One of them is the wood.' },
    // Starfall Crater
    { id: 'meteor',  site: 'crater', name: 'Meteor Pearl',     icon: '🌑', fx: { gens: [10, 11], v: 0.15 }, text: 'Dryad Courts and Star Seeds +15%.',
      lore: 'Dark as the gap between stars, and just as full of light if you look long enough.' },
    { id: 'thread',  site: 'crater', name: 'Comet Thread',     icon: '🧵', fx: { wispFreq: 0.05 }, text: 'Wisps come 5% more often.',
      lore: 'A strand of a comet\'s tail, snagged on a thorn as it passed.' },
    { id: 'nail',    site: 'crater', name: 'Sky-Iron Nail',    icon: '🔩', fx: { sapRegen: 0.1 }, text: 'Sap flows 10% faster.',
      lore: 'Hammered into the old tree\'s root, it draws sap the way a magnet draws iron.' },
    { id: 'vial',    site: 'crater', name: 'Stardust Vial',    icon: '🧪', fx: { garden: 0.1 }, text: 'Herbs grow 10% faster.',
      lore: 'A pinch of this on the soil and seedlings stretch toward the sky.' },
    { id: 'seed',    site: 'crater', name: 'Celestial Seed',   icon: '💠', fx: { kin: 0.1 }, text: 'Kinship grows 10% faster.',
      lore: 'The World Tree\'s cousin, still waiting for the right world.' },
    { id: 'dawn',    site: 'crater', name: 'Fragment of Dawn', icon: '🌅', fx: { prod: 0.03 }, text: 'All production +3%.',
      lore: 'A splinter of the very first morning. It is always a little bit sunrise inside.' },
];
export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));
export const RELIC_SETS = [
    { site: 'hollow', name: 'Hollow Keeper',  fx: { prod: 0.03 },      text: 'All production +3%.' },
    { site: 'mere',   name: 'Mere Warden',    fx: { wispPower: 0.1 },  text: 'Wisp gifts +10%.' },
    { site: 'barrow', name: 'Barrow Sworn',   fx: { kin: 0.15 },       text: 'Kinship grows 15% faster.' },
    { site: 'crater', name: 'Starfall Sage',  fx: { prod: 0.05 },       text: 'All production +5%.' },
];
export const RELIC_DUP_AMBER = 4;     // × the site's amber multiplier

// ------------------------------------------------------------------ the moonpetal garden
// Plant a herb in a plot; it grows on the game clock (offline too) and waits
// to be harvested. A few come up glimmering: double rewards and a mark in the herbarium.
// gift kinds: light (minutes of production), buff, sap, wisp, relic (chance)
export const GARDEN_BASE_PLOTS = 2;
export const GLIMMER_CHANCE = 0.06;
export const HERBS = [
    { id: 'moonpetal', name: 'Moonpetal',      icon: '🌼', secs: 300,       stage: 1, harvests: 0,  amber: 1,  gift: { light: 0.25 },
      text: '15 seconds of light.', lore: 'Opens at moonrise and smells faintly of honey.' },
    { id: 'dewbell',   name: 'Dewbell Tulip',  icon: '🌷', secs: 900,       stage: 1, harvests: 2,  amber: 1,  gift: { buff: 'click', mult: 3, dur: 45 },
      text: 'Touches ×3 for 45 s.', lore: 'Each cup holds one drop of dew, and the drop holds a little morning.' },
    { id: 'starmint',  name: 'Starmint',       icon: '🌿', secs: 1800,      stage: 2, harvests: 5,  amber: 2,  gift: { sap: 20 },
      text: '+20 sap.', lore: 'Chew a leaf and the sap in your veins remembers it is magic.' },
    { id: 'sunheart',  name: 'Summerheart',    icon: '🌻', secs: 3600,      stage: 3, harvests: 10, amber: 3,  gift: { buff: 'prod', mult: 1.5, dur: 60 },
      text: 'Production ×1.5 for 60 s.', lore: 'Turns to follow the sun even at midnight, and finds it.' },
    { id: 'foxglove',  name: 'Foxglove Ember', icon: '🌺', secs: 7200,      stage: 4, harvests: 20, amber: 5,  gift: { light: 6 },
      text: '6 minutes of light.', lore: 'The foxes light their foxfire from its petals.' },
    { id: 'clover',    name: 'Wisp Clover',    icon: '🍀', secs: 3 * 3600,  stage: 5, harvests: 35, amber: 4,  gift: { wisp: true },
      text: 'A golden wisp appears.', lore: 'Four leaves, and on the fourth a wisp likes to rest.' },
    { id: 'lotus',     name: 'Dreamlotus',     icon: '🪷', secs: 6 * 3600,  stage: 6, harvests: 55, amber: 14, gift: { light: 18 },
      text: '18 minutes of light.', lore: 'It blooms in your sleep and is still there when you wake.' },
    { id: 'worldbloom', name: 'Worldbloom',    icon: '🏵️', secs: 12 * 3600, stage: 8, harvests: 80, amber: 30, gift: { relic: 0.25 },
      text: 'A 25% chance of a relic.', lore: 'A flower of the World Tree itself. It has a seed of every flower in it.' },
];
export const HERB_BY_ID = Object.fromEntries(HERBS.map((h) => [h.id, h]));

// ------------------------------------------------------------------ whispers (rotating little goals)
// stat: which counter in state.stats (or 'motes' for totalMotes) the goal counts.
// base: the goal at the Seed stage; it grows with the best stage reached.
export const WHISPERS = [
    { id: 'touch',   stat: 'clicks',      base: 120, text: (n) => `Touch the tree ${n} times` },
    { id: 'wisp',    stat: 'wisps',       base: 2,   stage: 1, text: (n) => `Catch ${n} golden wisp${n > 1 ? 's' : ''}` },
    { id: 'spell',   stat: 'spells',      base: 3,   stage: 2, text: (n) => `Cast ${n} spells` },
    { id: 'buy',     stat: 'gensBought',  base: 20,  text: (n) => `Welcome ${n} spirits to the grove` },
    { id: 'up',      stat: 'upsBought',   base: 3,   text: (n) => `Buy ${n} upgrade${n > 1 ? 's' : ''}` },
    { id: 'nourish', stat: 'nourished',   base: 4,   text: (n) => `Nourish the tree ${n} times` },
    { id: 'harvest', stat: 'harvests',    base: 2,   stage: 1, text: (n) => `Harvest ${n} herb${n > 1 ? 's' : ''}` },
    { id: 'exp',     stat: 'expeditions', base: 1,   stage: 1, text: (n) => `Welcome ${n} expedition${n > 1 ? 's' : ''} home` },
    { id: 'tend',    stat: 'playTime',    base: 600, text: (n) => `Tend the grove for ${Math.round(n / 60)} minutes` },
    { id: 'motes',   stat: 'motes',       base: 0,   text: () => 'Gather a sack of light' },
];
export const WHISPER_BY_ID = Object.fromEntries(WHISPERS.map((w) => [w.id, w]));
export const WHISPER_SLOTS = 3;
export const WHISPER_REROLL = 1;       // amber

// ------------------------------------------------------------------ the amber peddler
// Mab, a moth who trades in lantern-light. `cost(level)`; max 1 for one-offs.
// kind: up (levels), use (consumable), look (cosmetic spark colours)
export const SHOP = [
    { id: 'party',   kind: 'up', name: 'Another Party',     icon: '🎒', max: 2, cost: (l) => [40, 160][l],      text: 'Send one more expedition at a time.' },
    { id: 'plots',   kind: 'up', name: 'A New Garden Bed',  icon: '🪴', max: 4, cost: (l) => [15, 40, 90, 200][l], text: 'One more plot in the moonpetal garden.' },
    { id: 'satchel', kind: 'up', name: 'Whisper Satchel',   icon: '👜', max: 1, cost: () => 50,                 text: 'Hear a fourth whisper at a time.' },
    { id: 'wick',    kind: 'up', name: 'Long-Burning Wick', icon: '🕯️', max: 3, cost: (l) => [30, 90, 270][l],   text: 'Herb blessings and Bottled Starlight last 25% longer.' },
    { id: 'loam',    kind: 'up', name: 'Black Loam',        icon: '🟫', max: 3, cost: (l) => [25, 75, 225][l],   text: 'Herbs grow 10% faster.' },
    { id: 'compass', kind: 'up', name: 'Moth Compass',      icon: '🧭', max: 3, cost: (l) => [25, 75, 225][l],   text: 'Expeditions return 10% sooner.' },
    { id: 'bottle',  kind: 'use', name: 'Bottled Starlight', icon: '🍶', cost: () => 25,                         text: 'Production ×2 for 15 minutes.' },
    { id: 'rose',    kind: 'look', name: 'Rosewater Sparks', icon: '🌹', cost: () => 10, colors: [0xff9ec8, 0xffd0e0], text: 'Touches scatter rose-pink light.' },
    { id: 'frost',   kind: 'look', name: 'Frostfire Sparks', icon: '❄️', cost: () => 10, colors: [0x9fe8ff, 0xe0f8ff], text: 'Touches scatter icy blue light.' },
    { id: 'ember',   kind: 'look', name: 'Ember Sparks',     icon: '🔥', cost: () => 10, colors: [0xffa040, 0xffe080], text: 'Touches scatter warm embers.' },
    { id: 'prism',   kind: 'look', name: 'Prism Sparks',     icon: '🌈', cost: () => 25, colors: [0xff8080, 0xffe070, 0x80ff9a, 0x80c8ff, 0xd090ff], text: 'Touches scatter every colour.' },
];
export const SHOP_BY_ID = Object.fromEntries(SHOP.map((x) => [x.id, x]));

// ------------------------------------------------------------------ badges and titles
// Each track has four tiers: bronze, silver, gold, starlit. Gold and starlit
// each unlock a title you can wear. value(s, kinTotal, relics, feats) reads the state.
export const BADGE_TIERS = ['Bronze', 'Silver', 'Gold', 'Starlit'];
export const BADGES = [
    { id: 'gather',  name: 'Gatherer',     icon: '✨', unit: 'motes gathered',         at: [1e6, 1e12, 1e18, 1e24],    titles: ['Lightgatherer', 'Keeper of All Light'],    value: (s) => s.totalMotes },
    { id: 'touch',   name: 'Toucher',      icon: '👆', unit: 'touches',                at: [500, 5000, 25000, 100000], titles: ['Tender of the Seed', 'Hand of the Grove'], value: (s) => s.stats.clicks },
    { id: 'wisp',    name: 'Wisp-Catcher', icon: '🔮', unit: 'wisps caught',           at: [5, 50, 200, 750],          titles: ['Wisp-Friend', 'Lord of Lanterns'],         value: (s) => s.stats.wisps },
    { id: 'spell',   name: 'Spellweaver',  icon: '🪄', unit: 'spells cast',            at: [10, 100, 500, 2000],       titles: ['Sapweaver', 'Archdruid'],                  value: (s) => s.stats.spells },
    { id: 'tend',    name: 'Spirit-Caller', icon: '🌿', unit: 'spirits welcomed',      at: [100, 1000, 10000, 50000],  titles: ['Spirit-Caller', 'Shepherd of Spirits'],    value: (s) => s.stats.gensBought },
    { id: 'tree',    name: 'Root-Tender',  icon: '🌳', unit: 'times nourished',        at: [50, 500, 2500, 10000],     titles: ['Root-Tender', 'Gardener of Worlds'],       value: (s) => s.stats.nourished },
    { id: 'kin',     name: 'Kindred',      icon: '💞', unit: 'kinship levels',         at: [10, 50, 120, 240],         titles: ['Kin of the Wild', 'Heart of the Herd'],    value: (s, k) => k.kin },
    { id: 'explore', name: 'Pathfinder',   icon: '🧭', unit: 'expeditions home',       at: [1, 15, 75, 250],           titles: ['Pathfinder', 'Walker of Deep Ways'],       value: (s) => s.stats.expeditions },
    { id: 'relic',   name: 'Relic-Seeker', icon: '🏺', unit: 'relics found',           at: [3, 10, 18, 24],            titles: ['Relic-Seeker', 'Curator of Wonders'],      value: (s, k) => k.relics },
    { id: 'herb',    name: 'Herbalist',    icon: '🌼', unit: 'herbs harvested',        at: [5, 50, 250, 1000],         titles: ['Herbalist', 'Moonpetal Sage'],             value: (s) => s.stats.harvests },
    { id: 'whisper', name: 'Listener',     icon: '👂', unit: 'whispers answered',      at: [3, 30, 150, 500],          titles: ['Listener', 'Voice of the Grove'],          value: (s) => s.stats.quests },
    { id: 'cycle',   name: 'Twice-Born',   icon: '🌀', unit: 'rebirths',               at: [1, 10, 30, 100],           titles: ['Twice-Born', 'Evergreen'],                 value: (s) => s.rebirths },
    { id: 'dream',   name: 'Dreamer',      icon: '💤', unit: 'hours away',             at: [1, 24, 168, 720],          titles: ['Dreamer', 'Sleeper Beneath the Roots'],    value: (s) => s.stats.offlineTime / 3600 },
    { id: 'feat',    name: 'Renowned',     icon: '🏆', unit: 'achievements and feats', at: [25, 75, 150, 225],         titles: ['Renowned', 'Legend of the Grove'],         value: (s, k) => k.ach },
];
export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));
export const DEFAULT_TITLE = 'Seedwarden';
/** Every title: [id, text, badge id, tier needed (1-based)]. */
export const TITLES = BADGES.flatMap((b) => [[`${b.id}3`, b.titles[0], b.id, 3], [`${b.id}4`, b.titles[1], b.id, 4]]);
export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t[0], t]));

// ------------------------------------------------------------------ feats
// Achievements of the wider world. They pay amber and are counted apart from
// the grove's achievements, so Radiance (data.js) is unchanged.
// test(s, k) where k = { kin, kinMax, relics, sets, herbsGrown, glimmerKinds, badgeTiers, ach }
export const FEAT_AMBER = 2;
export const FEATS = [];
const feat = (id, name, desc, test, icon) => FEATS.push({ id: `f_${id}`, name, desc, test, icon, feat: true });

WISP_KINDS.forEach((w) => {
    feat(`wk_${w.id}1`, `${w.name}`, `Catch a ${w.name}.`, (s) => (s.stats.wispKinds[w.id] | 0) >= 1, '🔮');
    feat(`wk_${w.id}2`, `${w.name} Collector`, `Catch 10 of the ${w.name} kind.`, (s) => (s.stats.wispKinds[w.id] | 0) >= 10, '🔮');
});
SPELLS.forEach((sp) => {
    feat(`sc_${sp.id}1`, `${sp.name} Adept`, `Cast ${sp.name} 10 times.`, (s) => (s.stats.spellCasts[sp.id] | 0) >= 10, '🪄');
    feat(`sc_${sp.id}2`, `${sp.name} Master`, `Cast ${sp.name} 100 times.`, (s) => (s.stats.spellCasts[sp.id] | 0) >= 100, '🪄');
});
GENERATORS.forEach((g, gi) => {
    feat(`kin_${g.id}`, `Kin of the ${g.plural}`, `Reach kinship 10 with ${g.plural}.`, (s) => (s.kinLv[gi] | 0) >= 10, '💞');
});
[[1, 'Fond'], [25, 'Familiar'], [100, 'Family'], [200, 'One with the Wild']].forEach(([n, name], i) => {
    feat(`kint${i}`, name, `Reach ${n} kinship level${n > 1 ? 's' : ''} in all.`, (s, k) => k.kin >= n, '💞');
});
feat('kinmax', 'Bound Forever', 'Reach the highest kinship with any spirit.', (s, k) => k.kinMax >= KIN_MAX, '💞');
[[1, 'Out the Door'], [10, 'Well Travelled'], [50, 'Deepwood Regular'], [150, 'Maps of Every Path']].forEach(([n, name], i) => {
    feat(`exp${i}`, name, `Welcome ${n} expedition${n > 1 ? 's' : ''} home.`, (s) => s.stats.expeditions >= n, '🧭');
});
EXP_SITES.forEach((x) => feat(`site_${x.id}`, `Seen ${x.name}`, `Bring a party home from ${x.name}.`, (s) => (s.stats.sites[x.id] | 0) >= 1, x.icon));
feat('odyssey', 'There and Back Again', 'Bring home a party from an eight-hour odyssey.', (s) => (s.stats.odysseys | 0) >= 1, '🗺️');
feat('fullparty', 'Full Satchels', 'Have three expeditions out at once.', (s) => s.exps.length >= 3, '🎒');
[[1, 'Finders Keepers'], [12, 'Cabinet of Curiosities'], [24, 'Every Lost Thing']].forEach(([n, name], i) => {
    feat(`rel${i}`, name, `Find ${n} different relic${n > 1 ? 's' : ''}.`, (s, k) => k.relics >= n, '🏺');
});
RELIC_SETS.forEach((st) => feat(`set_${st.site}`, st.name, `Find all six relics of ${EXP_SITE_BY_ID[st.site].name}.`, (s, k) => k.sets.includes(st.site), '🏺'));
[[1, 'First Harvest'], [25, 'Green Thumb'], [100, 'Market Gardener'], [400, 'Moonpetal Sage']].forEach(([n, name], i) => {
    feat(`hv${i}`, name, `Harvest ${n} herb${n > 1 ? 's' : ''}.`, (s) => s.stats.harvests >= n, '🌼');
});
HERBS.forEach((h) => feat(`herb_${h.id}`, `${h.name}`, `Harvest a ${h.name}.`, (s) => (s.herbs[h.id] | 0) >= 1, h.icon));
feat('glim1', 'It Glimmers!', 'Harvest a glimmering herb.', (s) => s.stats.glimmers >= 1, '🌟');
feat('glim8', 'Herbarium of Light', 'Harvest a glimmering herb of every kind.', (s, k) => k.glimmerKinds >= HERBS.length, '🌟');
feat('beds', 'A Garden of Six', 'Have six herbs growing at once.', (s) => s.garden.length >= 6 && s.garden.every((p) => p), '🪴');
[[1, 'Someone Is Listening'], [10, 'Good Ears'], [50, 'Whisper Friend'], [200, 'The Grove Confides']].forEach(([n, name], i) => {
    feat(`wh${i}`, name, `Answer ${n} whisper${n > 1 ? 's' : ''}.`, (s) => s.stats.quests >= n, '👂');
});
[[100, 'Amber Glow'], [1000, 'Amber Hoard'], [10000, 'Sea of Amber']].forEach(([n, name], i) => {
    feat(`am${i}`, name, `Earn ${n} amber in all.`, (s) => s.amberEver >= n, '🟠');
});
feat('bottle', 'Bottled Up', 'Uncork a Bottled Starlight.', (s) => (s.stats.bottles | 0) >= 1, '🍶');
feat('dressed', 'Dressed in Light', 'Wear a spark colour from the peddler.', (s) => !!s.spark, '🌈');
feat('named', 'A Name in the Wood', 'Wear a title.', (s) => !!s.title, '📜');
[[1, 'First Badge'], [14, 'Sash of Badges'], [28, 'Golden Sash'], [56, 'Starlit Sash']].forEach(([n, name], i) => {
    feat(`bd${i}`, name, `Earn ${n} badge tier${n > 1 ? 's' : ''}.`, (s, k) => k.badgeTiers >= n, '🎖️');
});
[[100, 'Gardener\'s Calluses'], [1000, 'A Thousand Rings'], [5000, 'Root and Branch']].forEach(([n, name], i) => {
    feat(`nr${i}`, name, `Nourish the tree ${n} times.`, (s) => s.stats.nourished >= n, '🌳');
});
[[1000, 'Busy Grove'], [10000, 'Teeming Grove'], [100000, 'Grove Beyond Counting']].forEach(([n, name], i) => {
    feat(`gb${i}`, name, `Welcome ${n} spirits to the grove in all.`, (s) => s.stats.gensBought >= n, '🌿');
});
[[50, 'Book Learning'], [100, 'Well Read'], [UPGRADES.length, 'Every Secret']].forEach(([n, name], i) => {
    feat(`up${i}`, name, `Own ${n} upgrades at once.`, (s) => Object.keys(s.ups).length >= n, '✨');
});
[[3600, 'An Hour Well Spent'], [36000, 'Ten Hours of Light'], [360000, 'A Hundred Hours']].forEach(([n, name], i) => {
    feat(`pt${i}`, name, `Tend the grove for ${n / 3600} hour${n > 3600 ? 's' : ''}.`, (s) => s.stats.playTime >= n, '⏳');
});
[[20, 'Five Years'], [100, 'A Quarter Century']].forEach(([n, name], i) => {
    feat(`ss${i}`, name, `See ${n} seasons turn.`, (s) => (s.stats.seasonsPassed | 0) >= n, '🍂');
});
export const FEAT_BY_ID = Object.fromEntries(FEATS.map((f) => [f.id, f]));

// ------------------------------------------------------------------ codex: spirit lore, unlocked by kinship
export const CODEX_LEVELS = [1, 5, 10];
export const CODEX = {
    firefly: [
        'Fireflies were the first to find the seed. They thought it was a firefly that had forgotten how to fly, and they stayed to keep it company.',
        'Every firefly carries one mote at a time, very carefully, like a lantern on a long walk. They never drop one. They have never once dropped one.',
        'On the shortest night of the year the fireflies all blink together, once, and for a moment the whole grove is a single light.',
    ],
    glowcap: [
        'Glowcaps grow in rings where the fireflies dance. They are slow thinkers, and very sure of their opinions.',
        'Beneath the moss, every glowcap is joined to every other by a web of pale threads. What one learns, all of them know by morning.',
        'The oldest glowcap is under the World Tree\'s roots. It is the size of a hill, and it is still growing, and it is very proud.',
    ],
    sprite: [
        'Dew sprites are born in the first drop of dew that catches the dawn. They live as long as it takes the drop to fall.',
        'A sprite can see the whole sky in its drop, upside down. Many of them believe the world is the other way up, and they may be right.',
        'When a drop finally falls, its sprite simply moves into the next one. None of them has ever ended. They are just very good at moving house.',
    ],
    moth: [
        'Lantern moths come from far away, following the glow of the tree the way sailors follow a lighthouse.',
        'Their wings are paper-thin and printed with maps of the places they have been. No two maps are the same.',
        'Once in a generation the moths gather in a single cloud and fly to the moon. They come back with silver dust on their wings and will not say what they saw.',
    ],
    fox: [
        'Fox spirits light foxfire along the forest paths for travellers who are lost, and then laugh at them a little, kindly.',
        'A kitsune grows a new tail every hundred years. The grove\'s eldest fox has nine and is very vain about every one.',
        'The foxes hold weddings in the rain while the sun shines. If you see one, you are invited, and you should bring a gift of fried tofu.',
    ],
    well: [
        'A moonwell holds the moon on cloudy nights, so that the moon always has somewhere to be.',
        'Drop a coin in and make a wish, and the well will consider it carefully. It grants about one wish in a thousand, the ones it likes best.',
        'All the moonwells in the world are the same water. Whisper into one and, far away, someone leaning over another hears you.',
    ],
    stones: [
        'Nobody set up the standing stones. They walked here, one step a century, because they heard the seed was waking.',
        'The runes on the stones are a song. When enough stones stand together they can sing the whole of it, and the ground hums along.',
        'Every midsummer the stones take a single step closer to the tree. In ten thousand years they will reach it, and then they will sit down.',
    ],
    treant: [
        'Treants are trees that decided to go for a walk. Most of them are still deciding where.',
        'A treant speaks one word a day. A treant conversation can take a hundred years and is always worth it.',
        'The first treant was a sapling from the World Tree\'s last life. It recognises the new tree, and it is very glad.',
    ],
    stag: [
        'White stags are almost never seen. They walk only where the light is thickest, and leave hoofprints that glow until morning.',
        'Their antlers are branches of moonlight. When a stag sheds them, they take root and grow into silver birches.',
        'Legend says that whoever follows a white stag to the end of its path will find the place where the forest began. The stags are kind enough never to stop.',
    ],
    loom: [
        'The aurora looms were built by no one. They wove themselves, from threads of light that drifted down from the sky.',
        'Every colour of the northern lights is a thread on a loom somewhere. The looms trade colours on clear nights, very politely.',
        'The great tapestry they are weaving is a picture of the whole sky. It will be finished the night the World Tree touches the stars.',
    ],
    dryad: [
        'Every dryad is bound to one tree. The dryads of the court have come to see if they can be bound to the biggest one of all.',
        'The court holds its sessions in a ring of willows, and every judgement is sung. Nobody has ever been found guilty of anything; it would spoil the song.',
        'The Green Queen is as old as the oldest oak and as young as this morning\'s leaf. She is the tree\'s friend. She was its friend last time too.',
    ],
    starseed: [
        'A star seed is what a star leaves behind when it falls and decides to stay.',
        'Planted at the roots of the world, a star seed grows downward first, toward the other stars on the far side of the earth.',
        'When every star seed has sprouted, the World Tree will have roots in the sky as well as the ground. That is what it was always for.',
    ],
};
