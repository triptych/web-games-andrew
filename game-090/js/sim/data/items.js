// Items, chips and gear. Prices are in Scrap, the Accord's small change.
//   kind  heal | mp | revive | cure | field | bomb | gift | chip | seed | key
//   use   where it works: 'field', 'battle' or 'both'

export const ITEMS = {};
const add = (id, name, o) => { ITEMS[id] = { id, name, price: 0, use: 'both', ...o }; };

add('patch', 'Mend Patch', { kind: 'heal', pct: 35, price: 40, desc: 'Heals one ally by 35%.' });
add('kit', 'Mend Kit', { kind: 'heal', pct: 70, price: 120, desc: 'Heals one ally by 70%.' });
add('fullkit', 'Full Kit', { kind: 'heal', pct: 100, cure: true, price: 320, desc: 'Fully heals one ally and clears ailments.' });
add('sap', 'Sap Vial', { kind: 'mp', amt: 30, price: 70, desc: 'Restores 30 MP.' });
add('elixir', 'Ley Elixir', { kind: 'mp', amt: 999, price: 420, desc: 'Fully restores one ally\'s MP.' });
add('seed', 'Revive Seed', { kind: 'revive', pct: 50, price: 180, desc: 'Revives a fallen ally at half HP.' });
add('bloom', 'Revive Bloom', { kind: 'revive', pct: 100, price: 520, desc: 'Revives a fallen ally fully.' });
add('antidote', 'Clear Cache', { kind: 'cure', price: 60, desc: 'Cures Lag, Rot, Hush and Panic.' });
add('smoke', 'Smoke Bomb', { kind: 'field', use: 'battle', price: 90, desc: 'Escape from any fight that is not a boss.' });
add('beacon', 'Warp Beacon', { kind: 'field', use: 'field', price: 110, desc: 'Leave the zone at once, keeping everything.' });
add('grenade', 'Pyre Grenade', { kind: 'bomb', el: 'pyre', pow: 46, price: 110, use: 'battle', desc: 'Pyre damage to every foe.' });
add('froststick', 'Rime Charge', { kind: 'bomb', el: 'rime', pow: 46, price: 110, use: 'battle', desc: 'Rime damage to every foe.' });
add('arcnade', 'Arc Cell', { kind: 'bomb', el: 'volt', pow: 46, price: 110, use: 'battle', desc: 'Volt damage to every foe.' });
add('flash', 'Flashbang', { kind: 'bomb', el: null, pow: 0, ail: { k: 'lag', p: 55 }, price: 130, use: 'battle', desc: 'May Lag every foe.' });
add('honey', 'Wild Honey', { kind: 'gift', price: 50, use: 'battle', desc: 'A gift. Wild daemons love it.' });
add('lullaby', 'Lullaby Disc', { kind: 'gift', price: 50, use: 'battle', desc: 'A gift. Timid daemons love it.' });
add('oldcoin', 'Old Coin', { kind: 'gift', price: 80, use: 'battle', desc: 'A gift. Proud and cold daemons love it.' });
add('sparkcell', 'Spark Cell', { kind: 'gift', price: 60, use: 'battle', desc: 'A gift. Playful and curious daemons love it.' });
add('glowfruit', 'Glowfruit', { kind: 'gift', price: 60, use: 'battle', desc: 'A gift. Kind daemons love it.' });
add('hexshard', 'Hex Shard', { kind: 'gift', price: 90, use: 'battle', desc: 'A gift. Cruel daemons love it.' });

// skill chips: teach the Agent a skill
const chip = (skill, name, price, desc) => add('chip_' + skill, name + ' Chip', { kind: 'chip', skill, price, use: 'field', desc: desc || `Teaches the Agent ${name}.` });
for (const [id, nm, pr] of [
    ['cinder', 'Cinder', 220], ['frostbite', 'Frostbite', 220], ['spark', 'Spark', 220], ['gust', 'Gust', 220], ['glimmer', 'Glimmer', 220], ['glitch', 'Glitch', 220],
    ['blaze', 'Blaze', 620], ['glacier', 'Glacier', 620], ['arclance', 'Arc Lance', 620], ['cutter', 'Cutter', 620], ['radiance', 'Radiance', 620], ['corrupt', 'Corrupt', 620],
    ['pyrewave', 'Pyrewave', 1400], ['whiteout', 'Whiteout', 1400], ['stormfront', 'Stormfront', 1400], ['cyclone', 'Cyclone', 1400], ['sunburst', 'Sunburst', 1400], ['blight', 'Blight', 1400],
    ['mendplus', 'Mend Plus', 480], ['mendall', 'Mend All', 900], ['reseed', 'Reseed', 700], ['purge', 'Purge', 300],
    ['overclock', 'Overclock', 320], ['fortify', 'Fortify', 320], ['sync', 'Sync', 320], ['lagspike', 'Lagspike', 420], ['rotseed', 'Rotseed', 420], ['dispel', 'Dispel', 500],
    ['heavyswing', 'Heavy Swing', 400], ['cleave', 'Cleave', 800], ['deadeye', 'Dead Eye', 900], ['burstfire', 'Burst Fire', 500], ['charge', 'Charge', 360], ['focus', 'Focus', 360],
    ['inferno', 'Inferno', 3200], ['zerohour', 'Zero Hour', 3200], ['thunderprotocol', 'Thunder Protocol', 3200], ['tempestcore', 'Tempest Core', 3200], ['daybreak', 'Daybreak', 3200], ['nullpointer', 'Null Pointer', 3200],
]) chip(id, nm, pr);

// growth seeds: permanent stats
for (const [k, nm] of [['st', 'Strength'], ['ma', 'Magic'], ['vi', 'Vitality'], ['ag', 'Agility'], ['lu', 'Luck']]) {
    add('seed_' + k, nm + ' Seed', { kind: 'seed', stat: k, use: 'field', price: 0, desc: `Permanently raises ${nm} by 2.` });
}
add('keycard', 'Spire Keycard', { kind: 'key', price: 0, use: 'field', desc: 'Opens Meridian\'s lower gate.' });

/** Items the market stocks, by chapter reached. */
export const SHOP = [
    { from: 0, ids: ['patch', 'sap', 'antidote', 'smoke', 'beacon', 'honey', 'lullaby', 'sparkcell', 'glowfruit', 'chip_cinder', 'chip_frostbite', 'chip_spark', 'chip_gust'] },
    { from: 1, ids: ['kit', 'seed', 'oldcoin', 'grenade', 'froststick', 'arcnade', 'flash', 'chip_glimmer', 'chip_glitch', 'chip_mendplus', 'chip_overclock', 'chip_fortify', 'chip_sync', 'chip_heavyswing', 'chip_charge', 'chip_focus', 'chip_purge'] },
    { from: 2, ids: ['hexshard', 'elixir', 'chip_blaze', 'chip_glacier', 'chip_arclance', 'chip_cutter', 'chip_radiance', 'chip_corrupt', 'chip_lagspike', 'chip_rotseed', 'chip_burstfire', 'chip_dispel', 'chip_reseed'] },
    { from: 3, ids: ['fullkit', 'bloom', 'chip_cleave', 'chip_deadeye', 'chip_mendall', 'chip_pyrewave', 'chip_whiteout', 'chip_stormfront', 'chip_cyclone', 'chip_sunburst', 'chip_blight'] },
    { from: 5, ids: ['chip_inferno', 'chip_zerohour', 'chip_thunderprotocol', 'chip_tempestcore', 'chip_daybreak', 'chip_nullpointer'] },
];

// ---------------------------------------------------------------- gear: the Agent wears four things
//   blade: +St and crit,  sidearm: +Ag and gun power,  coat: +Vi and affinities,  charm: +Lu and a passive
export const GEAR = {};
const gear = (id, name, slot, o) => { GEAR[id] = { id, name, slot, price: 0, ...o }; };
gear('ironblade', 'Verge Blade', 'blade', { st: 2, price: 0, desc: 'Issued to every new Warden.' });
gear('saplingedge', 'Sapling Edge', 'blade', { st: 6, price: 400, desc: 'Ironwood with a monofilament edge.' });
gear('cinderbrand', 'Cinder Brand', 'blade', { st: 11, price: 1500, desc: 'Still warm from the forge.' });
gear('lattice', 'Lattice Saber', 'blade', { st: 17, crit: 5, price: 3600, desc: 'Cuts along the grid lines.' });
gear('worldedge', 'Worldedge', 'blade', { st: 26, crit: 8, price: 9000, desc: 'Forged from a Warden Mk-IX\'s door.' });
gear('popgun', 'Pop Gun', 'sidearm', { ag: 2, price: 0, desc: 'Standard issue, loud.' });
gear('thornpistol', 'Thorn Pistol', 'sidearm', { ag: 5, gun: 4, price: 450, desc: 'Fires seed-casings at speed.' });
gear('relayrifle', 'Relay Rifle', 'sidearm', { ag: 9, gun: 8, price: 1700, desc: 'Borrowed a sight from a drone.' });
gear('arcrail', 'Arc Rail', 'sidearm', { ag: 14, gun: 14, price: 4000, desc: 'A coilgun rail, hand-wound.' });
gear('lastword', 'Last Word', 'sidearm', { ag: 20, gun: 20, price: 9500, desc: 'One chamber. It is always enough.' });
gear('fieldcoat', 'Field Coat', 'coat', { vi: 2, price: 0, desc: 'Waxed canvas, patched twice.' });
gear('mossplate', 'Mossplate', 'coat', { vi: 6, price: 420, aff: { gale: 'r' }, desc: 'Living moss over canvas. Resists Gale.' });
gear('ceramicvest', 'Ceramic Vest', 'coat', { vi: 10, price: 1600, aff: { strike: 'r' }, desc: 'Resists Strike.' });
gear('insulated', 'Insulated Coat', 'coat', { vi: 14, price: 3800, aff: { volt: 'r', pyre: 'r' }, desc: 'Resists Volt and Pyre.' });
gear('nullcloak', 'Null Cloak', 'coat', { vi: 20, price: 9000, aff: { hex: 'r', lumen: 'r', strike: 'r' }, desc: 'Woven from a dead signal. Resists Hex, Lumen and Strike.' });
gear('lucky', 'Rabbit Foot', 'charm', { lu: 3, price: 0, desc: 'Not from a rabbit. Lucky anyway.' });
gear('wardcharm', 'Ward Charm', 'charm', { lu: 2, pass: 'dodge', price: 700, desc: 'Dodge.' });
gear('lifecharm', 'Life Charm', 'charm', { lu: 2, pass: 'vital', price: 1500, desc: 'Vital.' });
gear('keencharm', 'Keen Charm', 'charm', { lu: 4, pass: 'keeneye', price: 2400, desc: 'Keen Eye.' });
gear('rootcharm', 'Root Charm', 'charm', { lu: 6, pass: 'photosynth', price: 5200, desc: 'Photosynth.' });

/** What Hexes drop, by race: scrap trinkets that sell for a little. */
export const LOOT = {
    sprite: ['glowfruit', 'honey'], beast: ['honey', 'patch'], construct: ['sparkcell', 'sap'],
    wisp: ['lullaby', 'sparkcell'], wyrm: ['oldcoin', 'patch'], colossus: ['oldcoin', 'kit'],
    archon: ['oldcoin', 'sap'], revenant: ['hexshard', 'antidote'],
};
