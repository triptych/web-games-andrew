// ============================================================
// Arcana Pull — Enemy Definitions
//
// Each wave has a `theme` (tarot archetype), a `name`, and an
// array of `enemies`.  Each enemy has:
//
//   id        — unique string key (e.g. 'fool_wraith')
//   name      — display name
//   wave      — which wave it first appears in (informational)
//   hp        — base hit points
//   atk       — base attack power
//   spd       — actions per tick cycle (1 = slow, 3 = fast)
//   def       — damage reduction (flat)
//   isElite   — true if elite enemy (every 3rd wave boss)
//   isBoss    — true for wave 10 final boss
//   ability   — { name, desc, trigger } or null for basic enemies
//
// Trigger types:
//   'passive'   — always active
//   'onHit'     — fires when this enemy takes damage
//   'onTick'    — fires each battle tick
//   'onEngage'  — fires when combat begins
//   'onDeath'   — fires when HP reaches 0
//
// Phases (boss only): array of phase threshold objects
//   { hpPct: 0.66, abilityId: 'mirror_wands' }
// ============================================================

// --------------- Wave-theme helper ---------------
// All stat values are base; battle.js scales them by +15% per wave
// beyond the wave they are defined in.

// ============================================================
// Individual enemy definitions (ordered by wave)
// ============================================================

// -- Wave 1: The Fool — naive wanderers, low stats --
export const WAVE_1_ENEMIES = [
    {
        id: 'stray_page',
        name: 'Stray Page',
        wave: 1,
        hp: 40, atk: 8, spd: 1, def: 0,
        isElite: false, isBoss: false,
        ability: null,
    },
    {
        id: 'wandering_jester',
        name: 'Wandering Jester',
        wave: 1,
        hp: 35, atk: 10, spd: 2, def: 0,
        isElite: false, isBoss: false,
        ability: null,
    },
    {
        id: 'fool_wraith',
        name: "Fool's Wraith",
        wave: 1,
        hp: 55, atk: 12, spd: 1, def: 2,
        isElite: false, isBoss: false,
        ability: null,
    },
];

// -- Wave 2: The High Priestess — hidden knowledge, evasive --
export const WAVE_2_ENEMIES = [
    {
        id: 'veil_shade',
        name: 'Veil Shade',
        wave: 2,
        hp: 50, atk: 12, spd: 2, def: 3,
        isElite: false, isBoss: false,
        ability: null,
    },
    {
        id: 'moonlit_specter',
        name: 'Moonlit Specter',
        wave: 2,
        hp: 45, atk: 15, spd: 2, def: 2,
        isElite: false, isBoss: false,
        ability: {
            name: 'Veil Step',
            desc: 'Reduces incoming damage by 20% every other tick.',
            trigger: 'onTick',
        },
    },
    {
        id: 'oracle_hound',
        name: 'Oracle Hound',
        wave: 2,
        hp: 70, atk: 10, spd: 1, def: 5,
        isElite: false, isBoss: false,
        ability: null,
    },
];

// -- Wave 3: The Emperor — armoured, disciplined. Elite present --
export const WAVE_3_ENEMIES = [
    {
        id: 'iron_sentinel',
        name: 'Iron Sentinel',
        wave: 3,
        hp: 65, atk: 14, spd: 1, def: 8,
        isElite: false, isBoss: false,
        ability: null,
    },
    {
        id: 'imperial_guard',
        name: 'Imperial Guard',
        wave: 3,
        hp: 75, atk: 16, spd: 1, def: 10,
        isElite: false, isBoss: false,
        ability: {
            name: 'Shield Wall',
            desc: 'Reduces all party damage by 5 while alive.',
            trigger: 'passive',
        },
    },
    {
        id: 'emperor_avatar',
        name: "Emperor's Avatar",
        wave: 3,
        hp: 140, atk: 22, spd: 2, def: 15,
        isElite: true, isBoss: false,
        ability: {
            name: 'Iron Authority',
            desc: 'At 50% HP, gains a one-time damage shield absorbing 40 damage.',
            trigger: 'onHit',
        },
    },
];

// -- Wave 4: The Chariot — fast, relentless pursuit --
export const WAVE_4_ENEMIES = [
    {
        id: 'chariot_runner',
        name: 'Chariot Runner',
        wave: 4,
        hp: 70, atk: 18, spd: 3, def: 3,
        isElite: false, isBoss: false,
        ability: null,
    },
    {
        id: 'war_sphinx',
        name: 'War Sphinx',
        wave: 4,
        hp: 85, atk: 20, spd: 2, def: 6,
        isElite: false, isBoss: false,
        ability: {
            name: 'Trample',
            desc: 'Deals 5 splash damage to all party members when it attacks.',
            trigger: 'onTick',
        },
    },
    {
        id: 'triumph_steed',
        name: 'Triumph Steed',
        wave: 4,
        hp: 100, atk: 24, spd: 3, def: 5,
        isElite: false, isBoss: false,
        ability: {
            name: 'Charge',
            desc: 'First attack deals double damage.',
            trigger: 'onEngage',
        },
    },
];

// -- Wave 5: The Hanged Man — reversal, debuffs, inversions. Elite present --
export const WAVE_5_ENEMIES = [
    {
        id: 'inverted_echo',
        name: 'Inverted Echo',
        wave: 5,
        hp: 80, atk: 16, spd: 2, def: 4,
        isElite: false, isBoss: false,
        ability: {
            name: 'Reversal',
            desc: 'On hit, has a 30% chance to temporarily flip target ATK and DEF.',
            trigger: 'onHit',
        },
    },
    {
        id: 'suspension_wraith',
        name: 'Suspension Wraith',
        wave: 5,
        hp: 90, atk: 14, spd: 1, def: 8,
        isElite: false, isBoss: false,
        ability: {
            name: 'Stillness',
            desc: 'Reduces SPD of the slowest party member by 1 on engage.',
            trigger: 'onEngage',
        },
    },
    {
        id: 'hanged_warden',
        name: 'Hanged Warden',
        wave: 5,
        hp: 200, atk: 20, spd: 2, def: 12,
        isElite: true, isBoss: false,
        ability: {
            name: 'Mirror Pain',
            desc: 'Reflects 15% of damage taken back to the attacker each tick.',
            trigger: 'onHit',
        },
    },
];

// -- Wave 6: Death — undying, regenerating, resilient --
export const WAVE_6_ENEMIES = [
    {
        id: 'bone_strider',
        name: 'Bone Strider',
        wave: 6,
        hp: 95, atk: 22, spd: 2, def: 6,
        isElite: false, isBoss: false,
        ability: {
            name: 'Undying',
            desc: 'Once per battle, revives with 20 HP on death.',
            trigger: 'onDeath',
        },
    },
    {
        id: 'pale_rider',
        name: 'Pale Rider',
        wave: 6,
        hp: 110, atk: 24, spd: 3, def: 5,
        isElite: false, isBoss: false,
        ability: null,
    },
    {
        id: 'reaper_shade',
        name: 'Reaper Shade',
        wave: 6,
        hp: 130, atk: 26, spd: 2, def: 8,
        isElite: false, isBoss: false,
        ability: {
            name: 'Soul Harvest',
            desc: 'Heals 8 HP each time an ally dies.',
            trigger: 'passive',
        },
    },
];

// -- Wave 7: The Tower — chaos burst, explosive. Elite present --
export const WAVE_7_ENEMIES = [
    {
        id: 'collapse_golem',
        name: 'Collapse Golem',
        wave: 7,
        hp: 120, atk: 28, spd: 1, def: 15,
        isElite: false, isBoss: false,
        ability: {
            name: 'Rubble Fall',
            desc: 'On death, deals 20 damage to all party members.',
            trigger: 'onDeath',
        },
    },
    {
        id: 'lightning_herald',
        name: 'Lightning Herald',
        wave: 7,
        hp: 100, atk: 32, spd: 3, def: 4,
        isElite: false, isBoss: false,
        ability: {
            name: 'Overcharge',
            desc: 'Every 3 ticks deals 15 bonus lightning damage to all party members.',
            trigger: 'onTick',
        },
    },
    {
        id: 'tower_sentinel',
        name: 'Tower Sentinel',
        wave: 7,
        hp: 280, atk: 30, spd: 2, def: 18,
        isElite: true, isBoss: false,
        ability: {
            name: 'Eruption',
            desc: 'At 66% and 33% HP, deals 30 damage to all party members instantly.',
            trigger: 'onHit',
        },
    },
];

// -- Wave 8: The Moon — illusions, misdirection, fear --
export const WAVE_8_ENEMIES = [
    {
        id: 'lunar_phantom',
        name: 'Lunar Phantom',
        wave: 8,
        hp: 130, atk: 28, spd: 3, def: 8,
        isElite: false, isBoss: false,
        ability: {
            name: 'Mirage',
            desc: 'Has a 25% chance to dodge any attack.',
            trigger: 'onHit',
        },
    },
    {
        id: 'howling_wolf',
        name: 'Howling Wolf',
        wave: 8,
        hp: 145, atk: 32, spd: 2, def: 6,
        isElite: false, isBoss: false,
        ability: {
            name: 'Dread Howl',
            desc: 'On engage, reduces all party ATK by 10% for 3 ticks.',
            trigger: 'onEngage',
        },
    },
    {
        id: 'nightmare_crab',
        name: 'Nightmare Crab',
        wave: 8,
        hp: 160, atk: 26, spd: 1, def: 20,
        isElite: false, isBoss: false,
        ability: {
            name: 'Shell Fortress',
            desc: 'Takes only 50% damage from the first hit each tick.',
            trigger: 'onHit',
        },
    },
];

// -- Wave 9: Judgement — resurrection, amplified threat. Elite present --
export const WAVE_9_ENEMIES = [
    {
        id: 'risen_knight',
        name: 'Risen Knight',
        wave: 9,
        hp: 160, atk: 36, spd: 2, def: 14,
        isElite: false, isBoss: false,
        ability: {
            name: 'Second Calling',
            desc: 'Revives once with 40 HP. Upon revival, gains +10 ATK.',
            trigger: 'onDeath',
        },
    },
    {
        id: 'angel_of_doom',
        name: 'Angel of Doom',
        wave: 9,
        hp: 150, atk: 40, spd: 3, def: 10,
        isElite: false, isBoss: false,
        ability: {
            name: 'Final Trumpet',
            desc: 'Every 4 ticks, all party members lose 10% current HP.',
            trigger: 'onTick',
        },
    },
    {
        id: 'celestial_judge',
        name: 'Celestial Judge',
        wave: 9,
        hp: 380, atk: 38, spd: 2, def: 22,
        isElite: true, isBoss: false,
        ability: {
            name: 'Divine Verdict',
            desc: 'At 50% HP, all party members are inflicted with -20% ATK for the rest of the battle.',
            trigger: 'onHit',
        },
    },
];

// -- Wave 10: The World — final boss, 3 phases --
export const WAVE_10_BOSS = {
    id: 'the_world',
    name: 'The World',
    wave: 10,
    hp: 800, atk: 45, spd: 2, def: 30,
    isElite: false, isBoss: true,
    phases: [
        {
            hpPct: 0.66,
            abilityId: 'mirror_suit',
            abilityName: 'Mirror of Suits',
            abilityDesc: 'Copies the special ability of the highest-ATK party member.',
        },
        {
            hpPct: 0.33,
            abilityId: 'world_dominion',
            abilityName: 'World Dominion',
            abilityDesc: 'Gains +20 ATK and +10 DEF. Reduces all party max HP by 15%.',
        },
    ],
    ability: {
        name: 'Integration',
        desc: 'Every 5 ticks, The World heals 40 HP.',
        trigger: 'onTick',
    },
};

// ============================================================
// Wave definitions — exported for use in battle.js
// ============================================================

export const WAVE_DEFS = [
    {
        wave: 1,
        theme: 'The Fool',
        name: 'The Wandering Path',
        desc: 'Naive spirits drawn to the light of your arcana.',
        enemies: WAVE_1_ENEMIES,
        gemReward: 80,
    },
    {
        wave: 2,
        theme: 'The High Priestess',
        name: 'The Hidden Veil',
        desc: 'Creatures that lurk between what is known and unknown.',
        enemies: WAVE_2_ENEMIES,
        gemReward: 80,
    },
    {
        wave: 3,
        theme: 'The Emperor',
        name: 'The Iron Decree',
        desc: 'Armoured servants of absolute rule.',
        enemies: WAVE_3_ENEMIES,
        gemReward: 80,
    },
    {
        wave: 4,
        theme: 'The Chariot',
        name: 'The Relentless Advance',
        desc: 'Fast and furious — they do not slow down.',
        enemies: WAVE_4_ENEMIES,
        gemReward: 80,
    },
    {
        wave: 5,
        theme: 'The Hanged Man',
        name: 'The Inverted World',
        desc: 'Everything is reversed. Expect the unexpected.',
        enemies: WAVE_5_ENEMIES,
        gemReward: 110,
    },
    {
        wave: 6,
        theme: 'Death',
        name: 'The Pale Crossing',
        desc: 'That which cannot truly die.',
        enemies: WAVE_6_ENEMIES,
        gemReward: 80,
    },
    {
        wave: 7,
        theme: 'The Tower',
        name: 'The Falling Spire',
        desc: 'Chaos given form. Nothing stands forever.',
        enemies: WAVE_7_ENEMIES,
        gemReward: 110,
    },
    {
        wave: 8,
        theme: 'The Moon',
        name: 'The Dream Labyrinth',
        desc: 'Illusions and fears made manifest.',
        enemies: WAVE_8_ENEMIES,
        gemReward: 80,
    },
    {
        wave: 9,
        theme: 'Judgement',
        name: 'The Final Calling',
        desc: 'Resurrection and doom march together.',
        enemies: WAVE_9_ENEMIES,
        gemReward: 110,
    },
    {
        wave: 10,
        theme: 'The World',
        name: 'The World Entire',
        desc: 'Completion. The cycle ends here — or you do.',
        enemies: [WAVE_10_BOSS],
        gemReward: 0,   // run ends after this wave
    },
];

// Convenience lookup by wave number
export const WAVE_BY_NUMBER = Object.fromEntries(WAVE_DEFS.map(w => [w.wave, w]));
