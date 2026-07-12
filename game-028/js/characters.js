/**
 * characters.js — Party member and enemy definitions.
 *
 * Each character has base stats, abilities, and portrait metadata.
 * Battle instances (with current HP/MP) are cloned from these templates.
 */

// --- Party member templates ---
export const PARTY_DEFS = {
    lyra: {
        id:       'lyra',
        name:     'Lyra',
        title:    'Wandering Mage',
        portrait: '🧙‍♀️',
        color:    '#a07cff',
        maxHp:    80,
        maxMp:    120,
        atk:      12,
        def:      6,
        spd:      9,
        abilities: [
            { id: 'attack',    name: 'Strike',      mpCost: 0,  damage: 1.0, type: 'physical', target: 'single' },
            { id: 'fireball',  name: 'Fireball',    mpCost: 12, damage: 2.2, type: 'magic',    target: 'single',  desc: 'A bolt of searing flame.' },
            { id: 'frostbind', name: 'Frostbind',   mpCost: 16, damage: 1.4, type: 'magic',    target: 'single',  effect: 'slow', desc: 'Freezes the target, reducing their speed.' },
            { id: 'remedy',    name: 'Remedy',      mpCost: 18, damage: 0,   type: 'heal',     target: 'ally',    heal: 40,       desc: 'Restores an ally\'s HP.' },
        ],
        bio: 'A young mage who fled the Aethermoor Academy after discovering a forbidden prophecy. Her mastery of elemental magic belies her age.',
    },

    orin: {
        id:       'orin',
        name:     'Orin',
        title:    'Iron Vanguard',
        portrait: '🛡️',
        color:    '#64c8ff',
        maxHp:    150,
        maxMp:    40,
        atk:      18,
        def:      16,
        spd:      6,
        abilities: [
            { id: 'attack',     name: 'Slash',       mpCost: 0,  damage: 1.0, type: 'physical', target: 'single' },
            { id: 'shield_bash',name: 'Shield Bash', mpCost: 8,  damage: 1.2, type: 'physical', target: 'single',  effect: 'stun',  desc: 'A powerful bash that may stun the target.' },
            { id: 'provoke',    name: 'Provoke',      mpCost: 10, damage: 0,   type: 'support',  target: 'self',    effect: 'taunt', desc: 'Forces all enemies to target Orin for 2 turns.' },
            { id: 'iron_guard', name: 'Iron Guard',   mpCost: 14, damage: 0,   type: 'support',  target: 'self',    effect: 'guard', desc: 'Halves all damage taken this turn.' },
        ],
        bio: 'A disgraced knight of the Solarian Order, Orin carries an oath-debt to protect the innocent. His sword arm is legendary in three kingdoms.',
    },

    sera: {
        id:       'sera',
        name:     'Sera',
        title:    'Thornwood Ranger',
        portrait: '🏹',
        color:    '#64dc8c',
        maxHp:    100,
        maxMp:    70,
        atk:      16,
        def:      9,
        spd:      14,
        abilities: [
            { id: 'attack',       name: 'Arrow Shot',   mpCost: 0,  damage: 1.0, type: 'physical', target: 'single' },
            { id: 'triple_shot',  name: 'Triple Shot',  mpCost: 10, damage: 0.7, type: 'physical', target: 'all',   desc: 'Fires three arrows at all enemies.' },
            { id: 'poison_arrow', name: 'Poison Arrow', mpCost: 12, damage: 0.9, type: 'physical', target: 'single', effect: 'poison', desc: 'Inflicts poison, dealing damage over 3 turns.' },
            { id: 'shadowstep',   name: 'Shadowstep',   mpCost: 16, damage: 1.8, type: 'physical', target: 'single', effect: 'dodge',  desc: 'Teleports behind the target for a devastating strike.' },
        ],
        bio: 'An elf ranger exiled from the Thornwood Conclave for consorting with humans. Sera\'s uncanny aim and woodland instincts make her an invaluable scout.',
    },

    thane: {
        id:       'thane',
        name:     'Thane',
        title:    'Soulbrand Warlock',
        portrait: '💀',
        color:    '#ff8050',
        maxHp:    90,
        maxMp:    100,
        atk:      14,
        def:      8,
        spd:      10,
        abilities: [
            { id: 'attack',      name: 'Shadow Bolt', mpCost: 0,  damage: 1.0, type: 'magic',    target: 'single' },
            { id: 'soul_drain',  name: 'Soul Drain',  mpCost: 14, damage: 1.6, type: 'magic',    target: 'single', effect: 'lifesteal', desc: 'Drains life force, healing Thane for half damage dealt.' },
            { id: 'hex',         name: 'Hex',          mpCost: 10, damage: 0,   type: 'debuff',   target: 'single', effect: 'weaken',    desc: 'Weakens an enemy, reducing their attack for 3 turns.' },
            { id: 'dark_ritual', name: 'Dark Ritual',  mpCost: 30, damage: 3.5, type: 'magic',    target: 'all',    desc: 'A devastating ritual that damages all enemies at great MP cost.' },
        ],
        bio: 'A former imperial warlock who broke his bond with the demon Kaelthas. Thane now seeks redemption, though the shadow magic still clings to his soul.',
    },
};

// --- Enemy templates ---
export const ENEMY_DEFS = {
    slime: {
        id: 'slime', name: 'Forest Slime', portrait: '🟢',
        maxHp: 30, atk: 6, def: 2, spd: 4,
        xpReward: 15, goldReward: 5,
        abilities: [{ id: 'attack', name: 'Blob', mpCost: 0, damage: 1.0, type: 'physical', target: 'single' }],
        loot: [{ id: 'slime_core', chance: 0.6 }],
    },
    forest_wolf: {
        id: 'forest_wolf', name: 'Forest Wolf', portrait: '🐺',
        maxHp: 45, atk: 12, def: 5, spd: 11,
        xpReward: 25, goldReward: 8,
        abilities: [
            { id: 'attack', name: 'Bite', mpCost: 0, damage: 1.0, type: 'physical', target: 'single' },
            { id: 'howl',   name: 'Howl', mpCost: 0, damage: 0,   type: 'buff',     target: 'self', effect: 'atk_up' },
        ],
        loot: [{ id: 'wolf_pelt', chance: 0.5 }, { id: 'fang', chance: 0.3 }],
    },
    bandit: {
        id: 'bandit', name: 'Thornwood Bandit', portrait: '🗡️',
        maxHp: 60, atk: 14, def: 8, spd: 9,
        xpReward: 35, goldReward: 20,
        abilities: [
            { id: 'attack',   name: 'Slash',    mpCost: 0, damage: 1.0, type: 'physical', target: 'single' },
            { id: 'cheap_shot',name: 'Cheap Shot', mpCost: 0, damage: 1.3, type: 'physical', target: 'single' },
        ],
        loot: [{ id: 'iron_dagger', chance: 0.2 }, { id: 'potion', chance: 0.5 }],
    },
    golem: {
        id: 'golem', name: 'Stone Golem', portrait: '🗿',
        maxHp: 120, atk: 18, def: 22, spd: 3,
        xpReward: 80, goldReward: 30,
        abilities: [
            { id: 'attack',   name: 'Crush',      mpCost: 0, damage: 1.0, type: 'physical', target: 'single' },
            { id: 'quake',    name: 'Ground Slam', mpCost: 0, damage: 0.8, type: 'physical', target: 'all' },
        ],
        loot: [{ id: 'stone_heart', chance: 0.7 }],
    },
    lich_shard: {
        id: 'lich_shard', name: 'Lich Shard', portrait: '💠',
        maxHp: 80, atk: 16, def: 10, spd: 12,
        xpReward: 60, goldReward: 25,
        abilities: [
            { id: 'attack',      name: 'Frost Ray',  mpCost: 0,  damage: 1.0, type: 'magic',  target: 'single' },
            { id: 'soul_rend',   name: 'Soul Rend',  mpCost: 0,  damage: 1.5, type: 'magic',  target: 'single', effect: 'mp_drain' },
        ],
        loot: [{ id: 'soul_gem', chance: 0.4 }],
    },
    academy_wisp: {
        id: 'academy_wisp', name: 'Academy Wisp', portrait: '🔵',
        maxHp: 40, atk: 10, def: 4, spd: 13,
        xpReward: 20, goldReward: 10,
        abilities: [
            { id: 'attack',   name: 'Spark',    mpCost: 0, damage: 1.0, type: 'magic', target: 'single' },
            { id: 'flicker',  name: 'Flicker',  mpCost: 0, damage: 0,   type: 'buff',   target: 'self', effect: 'atk_up' },
        ],
        loot: [{ id: 'ether', chance: 0.25 }],
    },
    corrupted_knight: {
        id: 'corrupted_knight', name: 'Corrupted Knight', portrait: '⚔️',
        maxHp: 70, atk: 17, def: 12, spd: 8,
        xpReward: 40, goldReward: 22,
        abilities: [
            { id: 'attack',    name: 'Tainted Blade', mpCost: 0, damage: 1.0, type: 'physical', target: 'single' },
            { id: 'dark_smite', name: 'Dark Smite',   mpCost: 0, damage: 1.3, type: 'magic',    target: 'single' },
        ],
        loot: [{ id: 'chain_mail', chance: 0.15 }, { id: 'potion', chance: 0.4 }],
    },
    korvas: {
        id: 'korvas', name: 'Korvas the Fallen Paladin', portrait: '🗡️',
        maxHp: 220, atk: 22, def: 14, spd: 8,
        xpReward: 220, goldReward: 90,
        isBoss: true,
        abilities: [
            { id: 'attack',       name: 'Oathbreaker Strike', mpCost: 0, damage: 1.1, type: 'physical', target: 'single' },
            { id: 'corrupt_smite', name: 'Corrupt Smite',      mpCost: 0, damage: 1.6, type: 'magic',    target: 'single', effect: 'weaken' },
            { id: 'dark_judgment', name: 'Dark Judgment',      mpCost: 0, damage: 1.3, type: 'magic',    target: 'all' },
        ],
        loot: [{ id: 'stone_heart', chance: 0.3 }, { id: 'runic_blade', chance: 0.5 }],
    },
    aethermoor_lich: {
        id: 'aethermoor_lich', name: 'The Lich of Aethermoor', portrait: '☠️',
        maxHp: 500, atk: 28, def: 18, spd: 14,
        xpReward: 500, goldReward: 200,
        isBoss: true,
        abilities: [
            { id: 'attack',       name: 'Deathbolt',    mpCost: 0,  damage: 1.2, type: 'magic',    target: 'single' },
            { id: 'wail',         name: 'Wail of Ages',  mpCost: 0,  damage: 0.9, type: 'magic',    target: 'all' },
            { id: 'reanimate',    name: 'Reanimate',     mpCost: 0,  damage: 0,   type: 'support',  target: 'self', effect: 'revive_minion' },
            { id: 'void_eclipse', name: 'Void Eclipse',  mpCost: 0,  damage: 2.5, type: 'magic',    target: 'all', desc: 'Used below 30% HP.' },
        ],
        loot: [{ id: 'lich_crown', chance: 1.0 }],
    },
};

// --- Encounter groups (used by map/battle system) ---
export const ENCOUNTER_GROUPS = {
    thornwood_easy:  [['slime'], ['slime', 'slime'], ['forest_wolf']],
    thornwood_hard:  [['forest_wolf', 'slime'], ['bandit'], ['bandit', 'bandit'], ['lich_shard']],
    academy_easy:    [['academy_wisp'], ['academy_wisp', 'academy_wisp'], ['slime', 'academy_wisp']],
    grove_easy:      [['forest_wolf'], ['forest_wolf', 'forest_wolf']],
    chapel_hard:     [['corrupted_knight'], ['corrupted_knight', 'corrupted_knight']],
    ruins_normal:    [['golem'], ['lich_shard', 'slime'], ['bandit', 'lich_shard']],
    ruins_hard:      [['golem', 'lich_shard'], ['lich_shard', 'lich_shard', 'bandit']],
    sanctum_hard:    [['lich_shard', 'lich_shard'], ['golem', 'lich_shard'], ['lich_shard', 'corrupted_knight']],
    boss_thornwood:  [['golem']],
    boss_korvas:     [['korvas']],
    final_boss:      [['aethermoor_lich']],
};
