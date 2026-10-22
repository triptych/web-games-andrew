// The eight heroes, their growth and every skill they can learn. Pure data.
//
// Skill fields: mp, tgt (one | all | rand | ally | allies | self | dead), kind (phys | mag | heal | buff | util),
// pow, type (a weapon or an element: it decides which weaknesses it strikes), hits, sh (extra shield damage per hit),
// st ([status, chance, turns] list), fx (a special rule), vfx (the look), ult (a signature move).

export const ELEMS = ['fire', 'ice', 'thunder', 'wind', 'holy', 'dark'];
export const WEAPON_TYPES = ['sword', 'spear', 'bow', 'axe', 'dagger'];
export const WEAK_TYPES = [...WEAPON_TYPES, ...ELEMS];
export const TYPE_INFO = {
    sword: { code: 'SW', color: '#d8dce8', name: 'Sword' }, spear: { code: 'SP', color: '#9fd0ff', name: 'Spear' },
    bow: { code: 'BW', color: '#a8e08c', name: 'Bow' }, axe: { code: 'AX', color: '#e0a070', name: 'Axe' },
    dagger: { code: 'DG', color: '#c0a0e8', name: 'Dagger' },
    fire: { code: 'FI', color: '#ff7a3c', name: 'Fire' }, ice: { code: 'IC', color: '#8fe4ff', name: 'Ice' },
    thunder: { code: 'TH', color: '#ffe44d', name: 'Thunder' }, wind: { code: 'WI', color: '#7fe8b4', name: 'Wind' },
    holy: { code: 'HO', color: '#fff6c0', name: 'Holy' }, dark: { code: 'DK', color: '#b070ff', name: 'Dark' },
};
export const STATUS_INFO = {
    poison: { name: 'Poison', color: '#9be15d', bad: true }, sleep: { name: 'Sleep', color: '#8fb0ff', bad: true },
    slow: { name: 'Slow', color: '#c0a0a0', bad: true }, haste: { name: 'Haste', color: '#ffe066' },
    atkUp: { name: 'Might', color: '#ff9a5c' }, atkDown: { name: 'Weak', color: '#a06050', bad: true },
    defUp: { name: 'Shell', color: '#7fc8ff' }, defDown: { name: 'Sunder', color: '#907080', bad: true },
    regen: { name: 'Regen', color: '#7ff0a0' }, cover: { name: 'Cover', color: '#ffd35c' }, taunt: { name: 'Taunt', color: '#ff6060' },
    mark: { name: 'Marked', color: '#ff80c0', bad: true },
};

const S = (id, name, o) => ({ id, name, mp: 0, tgt: 'one', kind: 'phys', pow: 1, type: null, hits: 1, sh: 0, ...o });

export const SKILLS = Object.fromEntries([
    // ------------------------------------------------------------- Kael
    S('crossSlash', 'Cross Slash', { mp: 5, pow: 1.7, type: 'sword', vfx: 'slash', desc: 'A heavy double cut.' }),
    S('risingBlade', 'Rising Blade', { mp: 8, pow: 1.25, type: 'sword', sh: 1, vfx: 'slash', desc: 'Strikes shields hard: 1 extra shield damage.' }),
    S('flameEdge', 'Flame Edge', { mp: 8, pow: 1.5, type: 'fire', vfx: 'fire', desc: 'Sword wreathed in flame.' }),
    S('dawnFlare', 'Dawn Flare', { mp: 10, kind: 'mag', pow: 1.9, type: 'holy', vfx: 'holy', desc: 'A lance of dawnlight.' }),
    S('boltEdge', 'Bolt Edge', { mp: 9, pow: 1.5, type: 'thunder', vfx: 'thunder', desc: 'Lightning runs down the blade.' }),
    S('heroicCry', 'Heroic Cry', { mp: 14, kind: 'buff', tgt: 'allies', st: [['atkUp', 1, 3]], vfx: 'buff', desc: 'Rallies the party: attack up.' }),
    S('frostEdge', 'Frost Edge', { mp: 9, pow: 1.5, type: 'ice', vfx: 'ice', desc: 'A blade of rime.' }),
    S('radiantWave', 'Radiant Wave', { mp: 20, tgt: 'all', pow: 1.15, type: 'holy', vfx: 'holy', desc: 'A wave of light across the field.' }),
    S('sunburst', 'Sunburst', { mp: 45, tgt: 'all', kind: 'mag', pow: 2.5, type: 'holy', sh: 1, vfx: 'sun', ult: true, desc: 'The Lightbearer unleashes the dawn.' }),
    S('dawnbreaker', 'Dawnbreaker', { mp: 60, pow: 1.5, hits: 4, type: 'sword', sh: 1, vfx: 'slash', ult: true, desc: 'Four cuts with the shard-blade.' }),
    // ------------------------------------------------------------- Lyra
    S('fire', 'Fire', { mp: 4, kind: 'mag', pow: 1.6, type: 'fire', vfx: 'fire', desc: 'A ball of flame.' }),
    S('blizzard', 'Blizzard', { mp: 4, kind: 'mag', pow: 1.6, type: 'ice', vfx: 'ice', desc: 'Shards of ice.' }),
    S('bolt', 'Bolt', { mp: 5, kind: 'mag', pow: 1.65, type: 'thunder', vfx: 'thunder', desc: 'A bolt from the sky.' }),
    S('aero', 'Aero', { mp: 5, kind: 'mag', pow: 1.65, type: 'wind', vfx: 'wind', desc: 'Cutting wind.' }),
    S('soulSiphon', 'Soul Siphon', { mp: 9, kind: 'mag', pow: 1.4, type: 'dark', fx: 'drain', vfx: 'dark', desc: 'Drains life from a foe.' }),
    S('frostSpike', 'Frost Spike', { mp: 9, kind: 'mag', pow: 1.3, type: 'ice', sh: 1, vfx: 'ice', desc: 'Piercing ice: 1 extra shield damage.' }),
    S('fira', 'Fira', { mp: 15, tgt: 'all', kind: 'mag', pow: 1.3, type: 'fire', vfx: 'fire', desc: 'Fire engulfs every foe.' }),
    S('blizzara', 'Blizzara', { mp: 15, tgt: 'all', kind: 'mag', pow: 1.3, type: 'ice', vfx: 'ice', desc: 'A blizzard over every foe.' }),
    S('thundara', 'Thundara', { mp: 16, tgt: 'all', kind: 'mag', pow: 1.3, type: 'thunder', vfx: 'thunder', desc: 'Lightning on every foe.' }),
    S('aerora', 'Aerora', { mp: 16, tgt: 'all', kind: 'mag', pow: 1.3, type: 'wind', vfx: 'wind', desc: 'A cyclone of blades.' }),
    S('voidLance', 'Void Lance', { mp: 20, kind: 'mag', pow: 2.5, type: 'dark', vfx: 'dark', desc: 'A spear of nothing.' }),
    S('meteor', 'Meteor', { mp: 44, tgt: 'all', kind: 'mag', pow: 2.3, type: 'fire', sh: 1, vfx: 'meteor', ult: true, desc: 'The sky itself falls.' }),
    S('starfall', 'Starfall', { mp: 58, tgt: 'rand', hits: 6, kind: 'mag', pow: 1.25, type: 'holy', vfx: 'star', ult: true, desc: 'Six stars fall on random foes.' }),
    // ------------------------------------------------------------- Thorne
    S('aimedShot', 'Aimed Shot', { mp: 4, pow: 1.5, type: 'bow', vfx: 'arrow', desc: 'A careful shot.' }),
    S('poisonArrow', 'Poison Arrow', { mp: 7, pow: 1.0, type: 'bow', st: [['poison', 0.75, 4]], vfx: 'arrow', desc: 'Envenomed tip.' }),
    S('beastLore', 'Beast Lore', { mp: 3, kind: 'util', fx: 'analyze', vfx: 'scan', desc: 'Reveals a foe\'s weaknesses and shield.' }),
    S('tripleShot', 'Triple Shot', { mp: 12, tgt: 'rand', hits: 3, pow: 0.85, type: 'bow', vfx: 'arrow', desc: 'Three arrows at random foes.' }),
    S('hawkeye', 'Hawkeye', { mp: 10, kind: 'buff', tgt: 'self', st: [['atkUp', 1, 4]], vfx: 'buff', desc: 'Focus: attack up.' }),
    S('galeArrow', 'Gale Arrow', { mp: 9, pow: 1.5, type: 'wind', vfx: 'wind', desc: 'An arrow riding the wind.' }),
    S('rainOfArrows', 'Rain of Arrows', { mp: 22, tgt: 'all', pow: 1.15, type: 'bow', vfx: 'arrow', desc: 'Darkens the sky.' }),
    S('piercingShot', 'Piercing Shot', { mp: 14, pow: 1.5, type: 'bow', sh: 2, vfx: 'arrow', desc: 'Shatters shields: 2 extra shield damage.' }),
    S('starVolley', 'Star Volley', { mp: 42, tgt: 'all', hits: 3, pow: 0.9, type: 'bow', sh: 1, vfx: 'arrow', ult: true, desc: 'Three volleys across the field.' }),
    // ------------------------------------------------------------- Elara
    S('cure', 'Cure', { mp: 4, kind: 'heal', tgt: 'ally', pow: 2.3, vfx: 'heal', desc: 'Restores an ally\'s health.' }),
    S('protect', 'Protect', { mp: 6, kind: 'buff', tgt: 'ally', st: [['defUp', 1, 4]], vfx: 'buff', desc: 'Defence up for one ally.' }),
    S('holyLight', 'Holy Light', { mp: 7, kind: 'mag', pow: 1.7, type: 'holy', vfx: 'holy', desc: 'A column of light.' }),
    S('healingRain', 'Healing Rain', { mp: 14, kind: 'heal', tgt: 'allies', pow: 1.6, vfx: 'heal', desc: 'Heals the whole party.' }),
    S('esuna', 'Esuna', { mp: 6, kind: 'heal', tgt: 'ally', pow: 0.4, fx: 'cleanse', vfx: 'heal', desc: 'Cleanses ailments.' }),
    S('raise', 'Raise', { mp: 18, kind: 'heal', tgt: 'dead', pow: 1.2, fx: 'revive', vfx: 'heal', desc: 'Returns a fallen ally.' }),
    S('regen', 'Regen', { mp: 10, kind: 'buff', tgt: 'ally', st: [['regen', 1, 5]], vfx: 'buff', desc: 'Health returns each turn.' }),
    S('judgment', 'Judgment', { mp: 22, tgt: 'all', kind: 'mag', pow: 1.2, type: 'holy', vfx: 'holy', desc: 'Holy fire on all foes.' }),
    S('fullMend', 'Full Mend', { mp: 28, kind: 'heal', tgt: 'allies', pow: 3.2, vfx: 'heal', desc: 'A great healing.' }),
    S('grace', 'Grace', { mp: 55, kind: 'heal', tgt: 'allies', pow: 5, fx: 'reviveAll', vfx: 'grace', ult: true, desc: 'Raises the fallen and heals everyone.' }),
    // ------------------------------------------------------------- Brom
    S('cleave', 'Cleave', { mp: 5, pow: 1.7, type: 'axe', vfx: 'slash', desc: 'A brutal chop.' }),
    S('earthshaker', 'Earthshaker', { mp: 14, tgt: 'all', pow: 1.05, type: 'axe', vfx: 'quake', desc: 'Shakes every foe.' }),
    S('rage', 'Rage', { mp: 8, kind: 'buff', tgt: 'self', st: [['atkUp', 1, 4], ['defDown', 1, 4]], vfx: 'buff', desc: 'Attack way up, defence down.' }),
    S('skullCrush', 'Skull Crush', { mp: 10, pow: 1.3, type: 'axe', st: [['defDown', 0.85, 3]], vfx: 'slash', desc: 'Lowers defence.' }),
    S('titanfall', 'Titanfall', { mp: 20, pow: 1.9, type: 'axe', sh: 3, vfx: 'quake', desc: 'Smashes shields: 3 extra shield damage.' }),
    S('whirlwind', 'Whirlwind', { mp: 24, tgt: 'all', pow: 1.45, type: 'axe', vfx: 'spin', desc: 'A spinning storm of steel.' }),
    S('worldsplitter', 'Worldsplitter', { mp: 44, tgt: 'all', pow: 2.7, type: 'axe', sh: 2, vfx: 'quake', ult: true, desc: 'Splits the ground itself.' }),
    // ------------------------------------------------------------- Mira
    S('backstab', 'Backstab', { mp: 4, pow: 1.6, type: 'dagger', vfx: 'slash', desc: 'A quick, vicious thrust.' }),
    S('steal', 'Steal', { mp: 2, kind: 'util', fx: 'steal', vfx: 'scan', desc: 'Lifts an item from a foe.' }),
    S('poisonDagger', 'Venom Edge', { mp: 7, pow: 1.0, type: 'dagger', st: [['poison', 0.8, 4]], vfx: 'slash', desc: 'Poisoned blade.' }),
    S('flurry', 'Flurry', { mp: 12, hits: 5, pow: 0.62, type: 'dagger', vfx: 'slash', desc: 'Five rapid strikes.' }),
    S('lullaby', 'Lullaby', { mp: 14, kind: 'util', tgt: 'all', st: [['sleep', 0.7, 3]], vfx: 'sleep', desc: 'Puts foes to sleep.' }),
    S('shadowStep', 'Shadow Step', { mp: 14, pow: 2.0, type: 'dark', vfx: 'dark', desc: 'Strikes from the shadows.' }),
    S('quickstepDance', 'Quickstep Dance', { mp: 22, kind: 'buff', tgt: 'allies', st: [['haste', 1, 4]], vfx: 'buff', desc: 'Hastes the party.' }),
    S('deathblossom', 'Deathblossom', { mp: 26, tgt: 'all', pow: 1.7, type: 'dagger', vfx: 'spin', desc: 'A blooming storm of knives.' }),
    S('phantomWaltz', 'Phantom Waltz', { mp: 44, tgt: 'rand', hits: 8, pow: 0.95, type: 'dagger', sh: 1, vfx: 'slash', ult: true, desc: 'Eight cuts, never seen.' }),
    // ------------------------------------------------------------- Zephyr
    S('analyze', 'Analyze', { mp: 3, kind: 'util', fx: 'analyze', vfx: 'scan', desc: 'Reveals weaknesses and shield.' }),
    S('staticLance', 'Static Lance', { mp: 6, kind: 'mag', pow: 1.5, type: 'thunder', vfx: 'thunder', desc: 'Charged lance of lightning.' }),
    S('slow', 'Slow', { mp: 7, kind: 'util', st: [['slow', 0.9, 4]], vfx: 'debuff', desc: 'Drags a foe through time.' }),
    S('haste', 'Haste', { mp: 9, kind: 'buff', tgt: 'ally', st: [['haste', 1, 4]], vfx: 'buff', desc: 'Speeds up one ally.' }),
    S('gravity', 'Gravity', { mp: 18, kind: 'mag', fx: 'gravity', vfx: 'gravity', desc: 'Crushes a foe for a share of its life.' }),
    S('chronoShift', 'Chrono Shift', { mp: 16, kind: 'buff', tgt: 'ally', fx: 'bp', vfx: 'buff', desc: 'Grants an ally 2 BP.' }),
    S('temporalSnare', 'Temporal Snare', { mp: 20, kind: 'util', tgt: 'all', st: [['slow', 0.85, 4]], vfx: 'debuff', desc: 'Slows every foe.' }),
    S('prism', 'Prism Burst', { mp: 24, kind: 'mag', pow: 1.9, type: 'auto', sh: 1, vfx: 'prism', desc: 'Always strikes a weakness the foe has.' }),
    S('chronoRift', 'Chrono Rift', { mp: 46, tgt: 'all', kind: 'mag', pow: 2.4, type: 'dark', st: [['slow', 1, 4]], vfx: 'rift', ult: true, desc: 'Tears a rift in time.' }),
    // ------------------------------------------------------------- Garrick
    S('lance', 'Lance', { mp: 4, pow: 1.6, type: 'spear', vfx: 'thrust', desc: 'A steady thrust.' }),
    S('challenge', 'Challenge', { mp: 5, kind: 'buff', tgt: 'self', st: [['taunt', 1, 3], ['defUp', 1, 3]], vfx: 'buff', desc: 'Draws every attack.' }),
    S('bulwark', 'Bulwark', { mp: 9, kind: 'buff', tgt: 'allies', st: [['defUp', 1, 3]], vfx: 'buff', desc: 'Raises party defence.' }),
    S('aegisOath', 'Aegis Oath', { mp: 10, kind: 'buff', tgt: 'self', st: [['cover', 1, 4]], vfx: 'buff', desc: 'Takes hits meant for allies.' }),
    S('lanceCharge', 'Lance Charge', { mp: 12, pow: 1.95, type: 'spear', vfx: 'thrust', desc: 'A galloping thrust.' }),
    S('holyLance', 'Holy Lance', { mp: 16, pow: 1.8, type: 'holy', sh: 1, vfx: 'holy', desc: 'A lance of light.' }),
    S('reckoning', 'Reckoning', { mp: 20, tgt: 'all', pow: 1.3, type: 'spear', vfx: 'thrust', desc: 'Sweeps all foes.' }),
    S('paladinPrayer', 'Paladin\'s Prayer', { mp: 30, kind: 'heal', tgt: 'allies', pow: 2.2, vfx: 'heal', desc: 'Heals the party.' }),
    S('judgmentDay', 'Verdict of Dawn', { mp: 46, pow: 3.4, type: 'holy', sh: 3, vfx: 'sun', ult: true, desc: 'A single, final judgment.' }),
].map((s) => [s.id, s]));

const sk = (lvl, id) => ({ lvl, id });

export const CHARS = {
    kael: {
        id: 'kael', name: 'Kael', title: 'The Lightbearer', cls: 'Swordsman', weapon: 'sword', armor: ['light', 'heavy'], color: '#ffd35c',
        base: { hp: 130, mp: 30, atk: 16, mag: 10, def: 11, res: 9, spd: 12 }, grow: { hp: 26, mp: 3.4, atk: 2.6, mag: 1.4, def: 1.7, res: 1.3, spd: 0.5 },
        look: { skin: '#f0c8a0', hair: '#5a3220', style: 'spiky', cloth: '#3a5fa8', cloth2: '#e8d8a8', trim: '#ffd35c', cape: '#b02a2a', weapon: 'sword', band: '#ffd35c' },
        skills: [sk(1, 'crossSlash'), sk(3, 'risingBlade'), sk(6, 'flameEdge'), sk(8, 'dawnFlare'), sk(11, 'boltEdge'), sk(13, 'heroicCry'), sk(16, 'frostEdge'), sk(19, 'radiantWave'), sk(30, 'sunburst'), sk(40, 'dawnbreaker')],
        bio: 'An orphaned smith\'s apprentice marked with the sigil of dawn.',
    },
    lyra: {
        id: 'lyra', name: 'Lyra', title: 'Stormcaller', cls: 'Black Mage', weapon: 'staff', armor: ['cloth'], color: '#c870ff',
        base: { hp: 90, mp: 55, atk: 7, mag: 20, def: 7, res: 14, spd: 10 }, grow: { hp: 17, mp: 6.5, atk: 0.9, mag: 3.2, def: 1.0, res: 2.0, spd: 0.45 },
        look: { skin: '#f4d0b0', hair: '#7a2a9a', style: 'long', cloth: '#6a2a9a', cloth2: '#e8c0ff', trim: '#ffd35c', hat: 'witch', weapon: 'staff', band: '#e8c0ff' },
        skills: [sk(1, 'fire'), sk(2, 'blizzard'), sk(4, 'bolt'), sk(6, 'aero'), sk(9, 'frostSpike'), sk(11, 'soulSiphon'), sk(14, 'fira'), sk(16, 'blizzara'), sk(18, 'thundara'), sk(20, 'aerora'), sk(25, 'voidLance'), sk(32, 'meteor'), sk(42, 'starfall')],
        bio: 'Kael\'s oldest friend, a tempestuous mage with more talent than patience.',
    },
    thorne: {
        id: 'thorne', name: 'Thorne', title: 'Huntsman', cls: 'Hunter', weapon: 'bow', armor: ['light'], color: '#7fd06a',
        base: { hp: 110, mp: 30, atk: 15, mag: 8, def: 9, res: 9, spd: 14 }, grow: { hp: 21, mp: 3.2, atk: 2.4, mag: 1.0, def: 1.4, res: 1.3, spd: 0.6 },
        look: { skin: '#d8a878', hair: '#2a2a22', style: 'short', cloth: '#3f7a3a', cloth2: '#8a5a30', trim: '#c8e8a0', hood: '#2e5a2a', weapon: 'bow', band: '#c8e8a0' },
        skills: [sk(1, 'aimedShot'), sk(3, 'poisonArrow'), sk(5, 'beastLore'), sk(8, 'tripleShot'), sk(11, 'hawkeye'), sk(13, 'galeArrow'), sk(17, 'rainOfArrows'), sk(21, 'piercingShot'), sk(33, 'starVolley')],
        bio: 'A silent huntsman who guards the Whispering Woods and its old secrets.',
    },
    elara: {
        id: 'elara', name: 'Elara', title: 'Sister of Dawn', cls: 'Cleric', weapon: 'staff', armor: ['cloth'], color: '#8fe8d0',
        base: { hp: 100, mp: 60, atk: 8, mag: 18, def: 8, res: 16, spd: 9 }, grow: { hp: 19, mp: 6.2, atk: 1.0, mag: 2.9, def: 1.1, res: 2.3, spd: 0.4 },
        look: { skin: '#f8dcc0', hair: '#f0d890', style: 'braid', cloth: '#f4f0e8', cloth2: '#4ab0a0', trim: '#ffd35c', veil: '#f4f0e8', weapon: 'staff', band: '#ffd35c' },
        skills: [sk(1, 'cure'), sk(2, 'protect'), sk(4, 'holyLight'), sk(6, 'esuna'), sk(8, 'healingRain'), sk(11, 'regen'), sk(14, 'raise'), sk(18, 'judgment'), sk(24, 'fullMend'), sk(36, 'grace')],
        bio: 'A cleric of the Dawn Order who left the cloister to heal a world in trouble.',
    },
    brom: {
        id: 'brom', name: 'Brom', title: 'Ironbeard', cls: 'Berserker', weapon: 'axe', armor: ['heavy', 'light'], color: '#e8884a',
        base: { hp: 170, mp: 18, atk: 19, mag: 5, def: 14, res: 6, spd: 7 }, grow: { hp: 34, mp: 2.0, atk: 3.0, mag: 0.5, def: 2.2, res: 0.9, spd: 0.25 },
        look: { skin: '#e0a880', hair: '#c05a20', style: 'dwarf', cloth: '#8a4a2a', cloth2: '#5a5a66', trim: '#d8d8e0', beard: '#c05a20', helm: 'horned', weapon: 'axe', band: '#d8d8e0', build: 'stout' },
        skills: [sk(1, 'cleave'), sk(4, 'earthshaker'), sk(7, 'rage'), sk(10, 'skullCrush'), sk(15, 'titanfall'), sk(20, 'whirlwind'), sk(34, 'worldsplitter')],
        bio: 'A mine-foreman dwarf with a short temper and a very long axe.',
    },
    mira: {
        id: 'mira', name: 'Mira', title: 'Nightingale', cls: 'Rogue', weapon: 'dagger', armor: ['light', 'cloth'], color: '#ff6fa8',
        base: { hp: 105, mp: 32, atk: 14, mag: 9, def: 8, res: 9, spd: 17 }, grow: { hp: 20, mp: 3.4, atk: 2.3, mag: 1.2, def: 1.2, res: 1.3, spd: 0.8 },
        look: { skin: '#e8b890', hair: '#1a1a2a', style: 'ponytail', cloth: '#2a2a44', cloth2: '#ff6fa8', trim: '#ffd35c', scarf: '#ff6fa8', weapon: 'dagger', band: '#ff6fa8' },
        skills: [sk(1, 'backstab'), sk(2, 'steal'), sk(5, 'poisonDagger'), sk(9, 'flurry'), sk(12, 'lullaby'), sk(15, 'shadowStep'), sk(19, 'quickstepDance'), sk(24, 'deathblossom'), sk(37, 'phantomWaltz')],
        bio: 'A harbor thief and dancer who steals from those who can afford it.',
    },
    zephyr: {
        id: 'zephyr', name: 'Zephyr', title: 'Chronicler', cls: 'Scholar', weapon: 'tome', armor: ['cloth'], color: '#6fc8ff',
        base: { hp: 95, mp: 58, atk: 7, mag: 19, def: 7, res: 13, spd: 11 }, grow: { hp: 18, mp: 6.0, atk: 0.9, mag: 3.0, def: 1.0, res: 1.9, spd: 0.5 },
        look: { skin: '#c89868', hair: '#e8e8f0', style: 'short', cloth: '#2a5a8a', cloth2: '#f0e0b0', trim: '#6fc8ff', glasses: true, weapon: 'tome', band: '#6fc8ff' },
        skills: [sk(1, 'analyze'), sk(3, 'staticLance'), sk(5, 'slow'), sk(8, 'haste'), sk(12, 'gravity'), sk(15, 'chronoShift'), sk(18, 'temporalSnare'), sk(23, 'prism'), sk(35, 'chronoRift')],
        bio: 'A desert scholar who studies time, and mostly arrives late.',
    },
    garrick: {
        id: 'garrick', name: 'Garrick', title: 'The Fallen Knight', cls: 'Paladin', weapon: 'spear', armor: ['heavy'], color: '#9fb8d8',
        base: { hp: 160, mp: 26, atk: 15, mag: 7, def: 16, res: 10, spd: 8 }, grow: { hp: 30, mp: 2.8, atk: 2.4, mag: 0.8, def: 2.5, res: 1.5, spd: 0.3 },
        look: { skin: '#e8c0a0', hair: '#c8c8d0', style: 'short', cloth: '#6a7a98', cloth2: '#d8e0f0', trim: '#ffd35c', helm: 'open', cape: '#2a4a8a', weapon: 'spear', band: '#ffd35c' },
        skills: [sk(1, 'lance'), sk(3, 'challenge'), sk(6, 'bulwark'), sk(9, 'aegisOath'), sk(12, 'lanceCharge'), sk(16, 'holyLance'), sk(21, 'reckoning'), sk(26, 'paladinPrayer'), sk(38, 'judgmentDay')],
        bio: 'A knight who failed his oath once and will not fail it again.',
    },
};
export const CHAR_IDS = Object.keys(CHARS);

export function statAt(id, lvl, k) {
    const c = CHARS[id];
    return Math.round(c.base[k] + c.grow[k] * (lvl - 1));
}
export function skillsAt(id, lvl) {
    return CHARS[id].skills.filter((s) => s.lvl <= lvl).map((s) => s.id);
}
export function xpToNext(lvl) { return Math.round(18 * Math.pow(lvl, 1.85) + 12 * lvl); }
