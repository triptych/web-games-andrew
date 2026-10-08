/**
 * actors.js — actor templates (creatures and NPC classes), the named NPC roster, and the
 * function that turns a template into a live actor at the right level.
 *
 * rig: humanoid | quad | spider | dragon | crab. ai: melee | archer | mage | beast | giant |
 * dragon | passive | civilian | guard | summon | follower.
 */
import { WEAPON_MATERIALS } from './items.js';

export const TEMPLATES = {
    // --- wildlife
    wolf:        { name: 'Wolf', rig: 'quad', body: 'wolf', scale: 1.0, hp: 45, sp: 60, dmg: 6, reach: 1.6, speed: 6.5, lvl: [1, 6], faction: 'wild', ai: 'beast', pack: true, loot: 'wolf', essence: 1, color: 0x6a6a68 },
    icewolf:     { name: 'Ice Wolf', rig: 'quad', body: 'wolf', scale: 1.1, hp: 90, sp: 80, dmg: 12, reach: 1.7, speed: 6.8, lvl: [8, 14], faction: 'wild', ai: 'beast', pack: true, loot: 'icewolf', essence: 2, color: 0xd8dde4, resist: { frost: 50 } },
    alpha_wolf:  { name: 'Alpha Wolf', rig: 'quad', body: 'wolf', scale: 1.35, hp: 160, sp: 120, dmg: 18, reach: 2, speed: 7, lvl: [6, 16], faction: 'wild', ai: 'beast', boss: true, loot: 'wolf', essence: 2, color: 0x3a3634 },
    bear:        { name: 'Bear', rig: 'quad', body: 'bear', scale: 1.0, hp: 140, sp: 120, dmg: 20, reach: 2.2, speed: 6.0, lvl: [5, 12], faction: 'wild', ai: 'beast', loot: 'bear', essence: 2, color: 0x4a3524 },
    cavebear:    { name: 'Cave Bear', rig: 'quad', body: 'bear', scale: 1.1, hp: 130, sp: 140, dmg: 18, reach: 2.3, speed: 5.8, lvl: [2, 14], faction: 'wild', ai: 'beast', loot: 'bear', essence: 2, color: 0x2c2420 },
    snowbear:    { name: 'Snow Bear', rig: 'quad', body: 'bear', scale: 1.2, hp: 280, sp: 180, dmg: 30, reach: 2.4, speed: 6.0, lvl: [14, 24], faction: 'wild', ai: 'beast', loot: 'snowbear', essence: 3, color: 0xe6e2da },
    fangcat:    { name: 'Fangcat', rig: 'quad', body: 'cat', scale: 1.0, hp: 110, sp: 120, dmg: 18, reach: 2.0, speed: 7.5, lvl: [6, 14], faction: 'wild', ai: 'beast', loot: 'fangcat', essence: 2, color: 0xa07a48 },
    snowfang:   { name: 'Snow Fangcat', rig: 'quad', body: 'cat', scale: 1.1, hp: 200, sp: 160, dmg: 26, reach: 2.1, speed: 7.6, lvl: [14, 24], faction: 'wild', ai: 'beast', loot: 'fangcat', essence: 3, color: 0xd8d2c8 },
    giantrat:     { name: 'Giant Rat', rig: 'quad', body: 'rat', scale: 0.5, hp: 12, sp: 20, dmg: 3, reach: 1.0, speed: 5.5, lvl: [1, 3], faction: 'wild', ai: 'beast', loot: 'giantrat', essence: 1, color: 0x5a4a3a },
    mudclaw:     { name: 'Mudclaw', rig: 'crab', body: 'crab', scale: 0.7, hp: 25, sp: 20, dmg: 4, reach: 1.1, speed: 2.5, lvl: [1, 8], faction: 'wild', ai: 'beast', loot: 'mudclaw', essence: 1, color: 0x6a5a40, armor: 30 },
    spider:      { name: 'Rime Spider', rig: 'spider', body: 'spider', scale: 1.0, hp: 40, sp: 60, dmg: 8, reach: 1.6, speed: 5.0, lvl: [1, 8], faction: 'wild', ai: 'beast', poison: 4, loot: 'spider', essence: 1, color: 0xc8ccc8 },
    giantspider: { name: 'Giant Rime Spider', rig: 'spider', body: 'spider', scale: 2.0, hp: 180, sp: 140, dmg: 18, reach: 2.6, speed: 4.6, lvl: [8, 20], faction: 'wild', ai: 'beast', poison: 8, boss: true, loot: 'spider', essence: 3, color: 0xb8beb8 },
    troll:       { name: 'Troll', rig: 'humanoid', body: 'troll', scale: 1.3, hp: 180, sp: 120, dmg: 22, reach: 2.4, speed: 5.5, lvl: [10, 20], faction: 'wild', ai: 'beast', regen: 3, loot: 'troll', essence: 3, color: 0x7a7468, weak: { fire: 50 } },
    frost_troll: { name: 'Frost Troll', rig: 'humanoid', body: 'troll', scale: 1.4, hp: 300, sp: 180, dmg: 32, reach: 2.6, speed: 5.5, lvl: [16, 30], faction: 'wild', ai: 'beast', regen: 4, boss: true, loot: 'troll', essence: 3, color: 0xdedcd6, resist: { frost: 50 }, weak: { fire: 50 } },
    giant:       { name: 'Giant', rig: 'humanoid', body: 'giant', scale: 3.0, hp: 520, sp: 300, dmg: 60, reach: 4.4, speed: 4.2, lvl: [12, 40], faction: 'giant', ai: 'giant', loot: 'giant', essence: 4, color: 0xb89a80, launch: true },
    mammoth:     { name: 'Mammoth', rig: 'quad', body: 'mammoth', scale: 1.0, hp: 600, sp: 300, dmg: 50, reach: 4, speed: 5, lvl: [10, 40], faction: 'giant', ai: 'beast', passive: true, loot: 'mammoth', essence: 4, color: 0x5a4636 },
    elk:         { name: 'Elk', rig: 'quad', body: 'elk', scale: 1.15, hp: 40, sp: 100, dmg: 0, speed: 9, lvl: [1, 1], faction: 'prey', ai: 'passive', loot: 'deer', essence: 1, color: 0x7a5a3a },
    deer:        { name: 'Deer', rig: 'quad', body: 'elk', scale: 0.9, hp: 25, sp: 100, dmg: 0, speed: 9, lvl: [1, 1], faction: 'prey', ai: 'passive', loot: 'deer', essence: 1, color: 0x9a7048 },
    fox:         { name: 'Fox', rig: 'quad', body: 'fox', scale: 0.55, hp: 10, sp: 60, dmg: 0, speed: 8, lvl: [1, 1], faction: 'prey', ai: 'passive', loot: 'fox', essence: 1, color: 0xb8622a },
    goat:        { name: 'Goat', rig: 'quad', body: 'goat', scale: 0.7, hp: 15, sp: 60, dmg: 0, speed: 6, lvl: [1, 1], faction: 'prey', ai: 'passive', loot: 'goat', essence: 1, color: 0xd6d0c4 },
    cow:         { name: 'Cow', rig: 'quad', body: 'cow', scale: 1.0, hp: 60, sp: 60, dmg: 0, speed: 3, lvl: [1, 1], faction: 'town', ai: 'passive', loot: 'cow', essence: 1, color: 0x6a4a34 },
    horse:       { name: 'Horse', rig: 'quad', body: 'horse', scale: 1.0, hp: 220, sp: 300, dmg: 12, speed: 12, lvl: [1, 1], faction: 'town', ai: 'passive', mount: true, essence: 2, color: 0x4a3426 },
    walrus:      { name: 'Walrus', rig: 'quad', body: 'walrus', scale: 1.0, hp: 70, sp: 50, dmg: 10, reach: 1.6, speed: 2.5, lvl: [3, 10], faction: 'wild', ai: 'beast', territorial: true, loot: 'walrus', essence: 2, color: 0x6a6460 },
    dog:         { name: 'Dog', rig: 'quad', body: 'wolf', scale: 0.8, hp: 40, sp: 60, dmg: 5, reach: 1.4, speed: 7, lvl: [1, 4], faction: 'town', ai: 'passive', essence: 1, color: 0x7a5a3a },
    // --- summons
    spiritwolf:      { name: 'Spectral Wolf', rig: 'quad', body: 'wolf', scale: 1.0, hp: 60, sp: 80, dmg: 10, reach: 1.6, speed: 7, lvl: [6, 6], faction: 'player', ai: 'summon', ghost: true, color: 0x88aaff },
    ember_golem: { name: 'Ember Golem', rig: 'humanoid', body: 'golem', scale: 1.1, hp: 140, mp: 200, dmg: 10, reach: 2, speed: 5, lvl: [12, 12], faction: 'player', ai: 'summon', spells: ['firebolt'], resist: { fire: 100 }, emissive: 0xff7a22, color: 0xff7a22 },
    rime_golem: { name: 'Rime Golem', rig: 'humanoid', body: 'golem', scale: 1.5, hp: 300, sp: 200, dmg: 26, reach: 2.6, speed: 4.5, lvl: [18, 18], faction: 'player', ai: 'summon', resist: { frost: 100 }, emissive: 0x88ccff, color: 0x9ad0ff },
    // --- undead
    wight_husk: { name: 'Barrow Husk', rig: 'humanoid', body: 'wight', scale: 1.0, hp: 60, sp: 80, lvl: [1, 6], faction: 'undead', ai: 'melee', gear: ['ancient_axe', 'ancient_shield?'], loot: 'wight', undead: true, essence: 2, color: 0x5a5a48, sleep: true, resist: { frost: 50 } },
    wight:          { name: 'Barrow Wight', rig: 'humanoid', body: 'wight', scale: 1.0, hp: 100, sp: 100, lvl: [6, 12], faction: 'undead', ai: 'melee', gear: ['ancient_sword', 'ancient_shield?'], loot: 'wight', undead: true, essence: 2, color: 0x4a4a40, sleep: true, resist: { frost: 50 } },
    wight_archer:   { name: 'Wight Archer', rig: 'humanoid', body: 'wight', scale: 1.0, hp: 80, sp: 100, lvl: [4, 14], faction: 'undead', ai: 'archer', gear: ['ancient_bow'], loot: 'wight', undead: true, essence: 2, color: 0x4a4a40, sleep: true, resist: { frost: 50 } },
    wight_warden:    { name: 'Wight Warden', rig: 'humanoid', body: 'wight', scale: 1.05, hp: 200, sp: 150, lvl: [12, 20], faction: 'undead', ai: 'melee', gear: ['ancient_greatsword'], loot: 'wight_boss', undead: true, essence: 3, color: 0x3c3c34, sleep: true, sigil: 'gale', boss: true, resist: { frost: 50 } },
    wight_scourge:  { name: 'Wight Scourge', rig: 'humanoid', body: 'wight', scale: 1.1, hp: 320, sp: 200, lvl: [18, 30], faction: 'undead', ai: 'melee', gear: ['ancient_greatsword'], loot: 'wight_boss', undead: true, essence: 4, color: 0x2c2c26, sigil: 'rime', boss: true, resist: { frost: 50 } },
    wight_dreadlord: { name: 'Wight Dreadlord', rig: 'humanoid', body: 'wight', scale: 1.15, hp: 420, sp: 260, lvl: [20, 40], faction: 'undead', ai: 'melee', gear: ['ancient_battleaxe'], loot: 'wight_boss', undead: true, essence: 5, color: 0x22221e, sigil: 'gale', boss: true, resist: { frost: 50 } },
    wight_captain: { name: 'Barrow Captain', rig: 'humanoid', body: 'wight', scale: 1.1, hp: 160, sp: 160, lvl: [3, 14], faction: 'undead', ai: 'melee', gear: ['ancient_greatsword'], loot: 'wight_boss', undead: true, essence: 3, color: 0x34342c, sigil: 'gale', boss: true, resist: { frost: 50 } },
    skeleton:        { name: 'Skeleton', rig: 'humanoid', body: 'skeleton', scale: 1.0, hp: 40, sp: 60, lvl: [1, 8], faction: 'undead', ai: 'melee', gear: ['iron_sword'], loot: 'skeleton', undead: true, color: 0xd8d0bc },
    hierophant:   { name: 'Zahrakhul', rig: 'humanoid', body: 'priest', scale: 1.2, hp: 700, mp: 900, lvl: [20, 50], faction: 'cult', ai: 'mage', float: true, spells: ['firebolt', 'icespike', 'lightning', 'embergolem'], loot: 'priest', undead: true, essence: 5, boss: true, unique: true, color: 0x3a4a3a },
    // --- people (hostile)
    bandit:         { name: 'Bandit', rig: 'humanoid', body: 'human', hp: 60, sp: 100, lvl: [1, 30], faction: 'bandit', ai: 'melee', gear: ['$weapon1h', '$lightarmor', 'shield?'], loot: 'bandit', color: 0x6a5040 },
    bandit_archer:  { name: 'Bandit Archer', rig: 'humanoid', body: 'human', hp: 50, sp: 100, lvl: [1, 30], faction: 'bandit', ai: 'archer', gear: ['$bow', '$lightarmor'], loot: 'bandit', color: 0x5a4a38 },
    bandit_mage:    { name: 'Bandit Hedge Mage', rig: 'humanoid', body: 'human', hp: 45, mp: 150, lvl: [3, 30], faction: 'bandit', ai: 'mage', spells: ['flames', 'firebolt', 'barkskin'], gear: ['robe'], loot: 'bandit', color: 0x4a3a5a },
    bandit_chief:   { name: 'Bandit Chief', rig: 'humanoid', body: 'human', hp: 140, sp: 160, lvl: [4, 40], faction: 'bandit', ai: 'melee', gear: ['$weapon2h', '$heavyarmor'], loot: 'chief', boss: true, color: 0x5a3a2a },
    necromancer:    { name: 'Necromancer', rig: 'humanoid', body: 'human', hp: 70, mp: 220, lvl: [6, 30], faction: 'cult', ai: 'mage', spells: ['rimetouch', 'icespike', 'spiritwolf'], gear: ['robe_ad', 'hood'], loot: 'mage', boss: true, color: 0x2a2030 },
    gloomkin:       { name: 'Gloomkin', rig: 'humanoid', body: 'gloomkin', hp: 70, sp: 100, lvl: [6, 24], faction: 'gloom', ai: 'melee', blind: true, gear: ['$crude'], loot: 'gloom', color: 0x8a8e7e },
    gloomkin_archer: { name: 'Gloomkin Archer', rig: 'humanoid', body: 'gloomkin', hp: 55, sp: 100, lvl: [6, 24], faction: 'gloom', ai: 'archer', blind: true, gear: ['$crudebow'], loot: 'gloom', color: 0x8a8e7e },
    gloomkin_shaman: { name: 'Gloomkin Shaman', rig: 'humanoid', body: 'gloomkin', hp: 110, mp: 200, lvl: [8, 30], faction: 'gloom', ai: 'mage', blind: true, spells: ['sparks', 'lightning', 'rimetouch'], loot: 'gloom', boss: true, color: 0x7a7e70 },
    clockwork_spider: { name: 'Clockwork Spider', rig: 'spider', body: 'clockwork', scale: 0.8, hp: 40, sp: 80, dmg: 8, reach: 1.5, speed: 5.5, lvl: [6, 20], faction: 'automaton', ai: 'beast', shock: 4, loot: 'automaton', color: 0xb08a45, resist: { poison: 100, frost: 25 } },
    sentinel:       { name: 'Brass Sentinel', rig: 'humanoid', body: 'sentinel', scale: 1.15, hp: 220, sp: 200, dmg: 24, reach: 2.4, lvl: [10, 30], faction: 'automaton', ai: 'melee', loot: 'automaton', color: 0xb08a45, armor: 80, resist: { poison: 100, frost: 25 } },
    steam_colossus: { name: 'Steam Colossus', rig: 'humanoid', body: 'sentinel', scale: 2.4, hp: 900, sp: 400, dmg: 48, reach: 4, speed: 3.6, lvl: [14, 40], faction: 'automaton', ai: 'giant', boss: true, steam: true, loot: 'colossus', color: 0xb8923e, armor: 140, resist: { poison: 100, frost: 25, fire: 25 } },
    reaver:         { name: 'Saltreaver', rig: 'humanoid', body: 'human', hp: 90, sp: 120, lvl: [3, 20], faction: 'reaver', ai: 'melee', gear: ['$weapon1h', 'reaver', 'iron_shield', 'iron_head'], loot: 'soldier', color: 0x6a7078 },
    hearthguard:    { name: 'Hearthguard Soldier', rig: 'humanoid', body: 'human', hp: 90, sp: 120, lvl: [3, 20], faction: 'hearth', ai: 'melee', gear: ['$weapon1h', 'hearth', 'iron_shield'], loot: 'soldier', color: 0x2c4a7a },
    // --- people (friendly)
    guard:          { name: 'Guard', rig: 'humanoid', body: 'human', hp: 200, sp: 200, lvl: [10, 40], faction: 'guard', ai: 'guard', gear: ['steel_sword', 'guard_bw', 'iron_head', 'iron_shield'], loot: 'soldier', color: 0xb8902a },
    citizen:        { name: 'Citizen', rig: 'humanoid', body: 'human', hp: 50, sp: 60, lvl: [1, 6], faction: 'town', ai: 'civilian', gear: ['tunic', 'shoes'], loot: 'citizen', color: 0x6b5a40 },
    hero:           { name: 'Hero of Old', rig: 'humanoid', body: 'human', hp: 600, sp: 400, lvl: [40, 40], faction: 'player', ai: 'follower', ghost: true, gear: ['night_sword', 'steel_body', 'steel_head'], color: 0xaabbff, essential: true },
    // --- dragons
    dragon:         { name: 'Dragon', rig: 'dragon', body: 'dragon', scale: 1.0, hp: 1000, sp: 500, dmg: 40, reach: 5, speed: 22, lvl: [6, 20], faction: 'dragon', ai: 'dragon', breath: 'fire', breathDmg: 18, loot: 'dragon', essence: 5, color: 0x6a5a40, armor: 60 },
    blood_dragon:   { name: 'Crimson Wyrm', rig: 'dragon', body: 'dragon', scale: 1.05, hp: 1500, sp: 600, dmg: 55, reach: 5, speed: 23, lvl: [14, 30], faction: 'dragon', ai: 'dragon', breath: 'fire', breathDmg: 26, loot: 'dragon', essence: 5, color: 0x7a2a22, armor: 80 },
    frost_dragon:   { name: 'Rime Wyrm', rig: 'dragon', body: 'dragon', scale: 1.1, hp: 1700, sp: 700, dmg: 60, reach: 5, speed: 23, lvl: [20, 40], faction: 'dragon', ai: 'dragon', breath: 'frost', breathDmg: 30, loot: 'dragon', essence: 5, color: 0xc8d0d8, armor: 90, resist: { frost: 100 } },
    elder_dragon:   { name: 'Ancient Wyrm', rig: 'dragon', body: 'dragon', scale: 1.2, hp: 2600, sp: 900, dmg: 75, reach: 5.5, speed: 24, lvl: [28, 50], faction: 'dragon', ai: 'dragon', breath: 'fire', breathDmg: 40, loot: 'dragon', essence: 5, color: 0x5a6a4a, armor: 110 },
    vyrthax:        { name: 'Vyrthax', rig: 'dragon', body: 'dragon', scale: 1.5, hp: 4000, sp: 1200, dmg: 80, reach: 6, speed: 26, lvl: [30, 60], faction: 'dragon', ai: 'dragon', breath: 'fire', breathDmg: 45, loot: 'dragon', essence: 5, color: 0x161414, eyes: 0xff3010, unique: true, essential: true, armor: 140 },
    thurnvaal:      { name: 'Thurnvaal', rig: 'dragon', body: 'dragon', scale: 1.15, hp: 3000, sp: 900, dmg: 60, reach: 5, speed: 20, lvl: [40, 40], faction: 'friend', ai: 'passive', breath: 'fire', breathDmg: 30, color: 0x8a8478, unique: true, essential: true },
    raskhar:        { name: 'Raskhar', rig: 'dragon', body: 'dragon', scale: 1.1, hp: 1800, sp: 700, dmg: 55, reach: 5, speed: 24, lvl: [20, 40], faction: 'dragon', ai: 'dragon', breath: 'fire', breathDmg: 28, color: 0x8a2a1a, unique: true, essential: true, armor: 90 },
};

// barrow-forged arms for the wights, crude gloomkin gear
import { registerItem } from './items.js';
registerItem('ancient_sword', { type: 'weapon', name: 'Barrow Sword', wtype: 'sword', material: 'ancient', lvl: 1, damage: 8, speed: 1, reach: 2.1, skill: 'oneHanded', two: false, weight: 11, value: 30, color: 0x5a6a5a });
registerItem('ancient_axe', { type: 'weapon', name: 'Barrow War Axe', wtype: 'waraxe', material: 'ancient', lvl: 1, damage: 9, speed: 0.9, reach: 2.0, skill: 'oneHanded', two: false, weight: 12, value: 35, color: 0x5a6a5a });
registerItem('ancient_greatsword', { type: 'weapon', name: 'Barrow Greatsword', wtype: 'greatsword', material: 'ancient', lvl: 1, damage: 17, speed: 0.7, reach: 2.6, skill: 'twoHanded', two: true, weight: 18, value: 60, color: 0x5a6a5a });
registerItem('ancient_battleaxe', { type: 'weapon', name: 'Barrow Battle Axe', wtype: 'battleaxe', material: 'ancient', lvl: 1, damage: 18, speed: 0.68, reach: 2.6, skill: 'twoHanded', two: true, weight: 21, value: 65, color: 0x5a6a5a });
registerItem('ancient_bow', { type: 'weapon', name: 'Barrow Bow', wtype: 'bow', material: 'ancient', lvl: 1, damage: 9, speed: 1, skill: 'archery', two: true, bow: true, weight: 10, value: 40, color: 0x5a4a3a });
registerItem('ancient_shield', { type: 'armor', name: 'Barrow Shield', slot: 'shield', armorType: 'heavy', material: 'ancient', lvl: 1, rating: 20, weight: 12, value: 30, color: 0x5a6a5a });
registerItem('crude_blade', { type: 'weapon', name: 'Gloomkin Blade', wtype: 'sword', material: 'chitin', lvl: 6, damage: 10, speed: 1, reach: 2.0, skill: 'oneHanded', two: false, weight: 8, value: 40, color: 0x8a7a5a });
registerItem('crude_bow', { type: 'weapon', name: 'Gloomkin Bow', wtype: 'bow', material: 'chitin', lvl: 6, damage: 10, speed: 1, skill: 'archery', two: true, bow: true, weight: 8, value: 50, color: 0x8a7a5a });

/** Resolve a template gear list (with `$` levelled picks and `?` optional pieces) at a level. */
export function resolveGear(list, level, rng) {
    const out = [];
    const mat = () => {
        const ok = WEAPON_MATERIALS.filter((m) => m.lvl <= level && m.id !== 'dread' && m.id !== 'dragon');
        return rng.chance(0.75) ? ok[ok.length - 1].id : ok[Math.floor(rng.next() * ok.length)].id;
    };
    const armorL = () => (level >= 16 ? 'glimmer' : level >= 10 ? 'scaled' : level >= 3 ? 'leather' : 'hide');
    const armorH = () => (level >= 28 ? 'night' : level >= 14 ? 'hill' : level >= 12 ? 'plate' : level >= 4 ? 'steel' : 'iron');
    for (let g of list || []) {
        if (g.endsWith('?')) { if (!rng.chance(0.5)) continue; g = g.slice(0, -1); }
        if (g === '$weapon1h') out.push(`${mat()}_${rng.pick(['sword', 'waraxe', 'mace', 'sword', 'dagger'])}`);
        else if (g === '$weapon2h') out.push(`${mat()}_${rng.pick(['greatsword', 'battleaxe', 'warhammer'])}`);
        else if (g === '$bow') out.push(`${mat()}_bow`, `arrow_${mat()}`);
        else if (g === '$lightarmor') { const a = armorL(); out.push(`${a}_body`); if (rng.chance(0.6)) out.push(`${a}_head`); if (rng.chance(0.5)) out.push(`${a}_feet`); }
        else if (g === '$heavyarmor') { const a = armorH(); out.push(`${a}_body`, `${a}_head`, `${a}_hands`, `${a}_feet`); }
        else if (g === '$crude') out.push('crude_blade');
        else if (g === '$crudebow') out.push('crude_bow', 'arrow_iron');
        else if (g === 'shield') out.push(`${level >= 4 ? 'steel' : 'iron'}_shield`);
        else if (g === 'ancient_bow') out.push('ancient_bow', 'arrow_iron');
        else out.push(g);
    }
    return out;
}

// ------------------------------------------------------------------ the named people of the Frostmarch
// role: warden steward wizard sworn smith merchant alchemist innkeeper priest guildmaster companion elder
// look: { sex: 'm'|'f', kin, hair, hairCol, beard, age (0 young..1 old), build }
export const NPCS = [
    // --- the prologue and Pinebrook
    { id: 'halvard', name: 'Halvard Stonehand', loc: 'hollowmere', role: 'companion', essential: true, faction: 'friend', ai: 'follower', look: { sex: 'm', kin: 'norrhen', hair: 2, hairCol: 0x6a4a2a, beard: 3, age: 0.4, build: 1.1 }, gear: ['hearth', 'iron_waraxe', 'boots_fur'], lvl: 5 },
    { id: 'ragna', name: 'Ragna', loc: 'pinebrook', home: 'pinebrook:ragna', work: 'pinebrook:mill', role: 'citizen', look: { sex: 'f', kin: 'norrhen', hair: 4, hairCol: 0x8a6a3a, age: 0.45 }, gear: ['tunic', 'shoes'], lvl: 4 },
    { id: 'hakon', name: 'Hakon the Smith', loc: 'pinebrook', home: 'pinebrook:hakon', work: 'pinebrook:anvil', role: 'smith', merchant: 'smith', look: { sex: 'm', kin: 'norrhen', hair: 1, hairCol: 0x3a2a1a, beard: 2, age: 0.5, build: 1.2 }, gear: ['tunic', 'shoes'], lvl: 8, trains: 'smithing' },
    { id: 'orla', name: 'Orla', loc: 'pinebrook', home: 'pinebrook:inn', work: 'pinebrook:inn', role: 'innkeeper', merchant: 'inn', look: { sex: 'f', kin: 'caldaran', hair: 3, hairCol: 0x2a1a10, age: 0.35 }, gear: ['tunic', 'shoes'], lvl: 4 },
    { id: 'bjarki', name: 'Bjarki', loc: 'pinebrook', home: 'pinebrook:goods', work: 'pinebrook:goods', role: 'merchant', merchant: 'general', look: { sex: 'm', kin: 'norrhen', hair: 0, hairCol: 0xa08050, beard: 1, age: 0.3 }, gear: ['fine', 'shoes'], lvl: 4 },
    { id: 'sela', name: 'Sela Varr', loc: 'pinebrook', home: 'pinebrook:inn', work: 'pinebrook:inn', role: 'citizen', essential: true, look: { sex: 'f', kin: 'caldaran', hair: 5, hairCol: 0x1a1210, age: 0.4 }, gear: ['tunic', 'shoes', 'dragonbane'], lvl: 14 },
    { id: 'aelric', name: 'Aelric Fernsong', loc: 'pinebrook', home: 'pinebrook:house1', work: 'pinebrook:mill', role: 'citizen', look: { sex: 'm', kin: 'vael', hair: 2, hairCol: 0xc0a060, age: 0.3 }, gear: ['tunic', 'shoes'], lvl: 5, trains: 'archery' },
    // --- Brightwater
    { id: 'warden_sigrun', name: 'Warden Sigrun Ironbrow', loc: 'brightwater', home: 'brightwater:hall', work: 'brightwater:hall', role: 'warden', essential: true, look: { sex: 'f', kin: 'norrhen', hair: 4, hairCol: 0xd8b878, age: 0.45 }, gear: ['warden', 'circlet', 'shoes'], lvl: 20 },
    { id: 'aldric', name: 'Aldric Venn', loc: 'brightwater', home: 'brightwater:hall', work: 'brightwater:hall', role: 'steward', essential: true, look: { sex: 'm', kin: 'caldaran', hair: 1, hairCol: 0x4a3a2a, beard: 1, age: 0.55 }, gear: ['fine', 'shoes'], lvl: 10 },
    { id: 'ivo', name: 'Ivo Farran', loc: 'brightwater', home: 'brightwater:hall', work: 'brightwater:hall', role: 'wizard', merchant: 'spells', essential: true, look: { sex: 'f', kin: 'aelfen', hair: 3, hairCol: 0xe8d8a8, age: 0.5 }, gear: ['robe_ad', 'shoes'], lvl: 18, trains: 'destruction' },
    { id: 'brenna', name: 'Brenna', loc: 'brightwater', home: 'brightwater:hall', work: 'brightwater:hall', role: 'sworn', essential: true, followable: true, look: { sex: 'f', kin: 'norrhen', hair: 2, hairCol: 0x6a3a1a, age: 0.3, build: 1.1 }, gear: ['steel_body', 'steel_feet', 'steel_sword', 'steel_shield'], lvl: 8 },
    { id: 'eira', name: 'Eira Steelheart', loc: 'brightwater', home: 'brightwater:eira_house', work: 'brightwater:anvil', role: 'smith', merchant: 'smith', look: { sex: 'f', kin: 'norrhen', hair: 1, hairCol: 0x9a3a1a, age: 0.4, build: 1.1 }, gear: ['tunic', 'shoes'], lvl: 14, trains: 'smithing' },
    { id: 'orrin', name: 'Orrin Marsh', loc: 'brightwater', home: 'brightwater:sundries', work: 'brightwater:sundries', role: 'merchant', merchant: 'general', look: { sex: 'm', kin: 'caldaran', hair: 0, hairCol: 0x2a2a2a, beard: 4, age: 0.5 }, gear: ['fine', 'shoes'], lvl: 6 },
    { id: 'mira', name: 'Mira Thistle', loc: 'brightwater', home: 'brightwater:thistle', work: 'brightwater:thistle', role: 'alchemist', merchant: 'alchemist', look: { sex: 'f', kin: 'caldaran', hair: 5, hairCol: 0x5a3a20, age: 0.6 }, gear: ['robe', 'shoes'], lvl: 10, trains: 'alchemy' },
    { id: 'gunnhild', name: 'Gunnhild', loc: 'brightwater', home: 'brightwater:inn', work: 'brightwater:inn', role: 'innkeeper', merchant: 'inn', look: { sex: 'f', kin: 'norrhen', hair: 4, hairCol: 0xb08040, age: 0.5 }, gear: ['tunic', 'shoes'], lvl: 6 },
    { id: 'jorund', name: 'Jorund the Sellsword', loc: 'brightwater', home: 'brightwater:inn', work: 'brightwater:inn', role: 'mercenary', followable: true, hire: 500, look: { sex: 'm', kin: 'norrhen', hair: 2, hairCol: 0x2a2018, beard: 3, age: 0.35, build: 1.15 }, gear: ['iron_body', 'iron_feet', 'steel_greatsword'], lvl: 10 },
    { id: 'ulfar', name: 'Ulfar Grimsson', loc: 'brightwater', home: 'brightwater:hearthhall', work: 'brightwater:hearthhall', role: 'guildmaster', essential: true, look: { sex: 'm', kin: 'norrhen', hair: 1, hairCol: 0xd0d0d0, beard: 4, age: 0.75 }, gear: ['steel_body', 'steel_feet', 'steel_greatsword'], lvl: 30, trains: 'heavyArmor' },
    { id: 'asta', name: 'Asta the Huntress', loc: 'brightwater', home: 'brightwater:hearthhall', work: 'brightwater:hearthhall', role: 'companion', followable: true, look: { sex: 'f', kin: 'norrhen', hair: 4, hairCol: 0x8a2a14, age: 0.3 }, gear: ['leather_body', 'leather_feet', 'steel_bow', 'arrow_steel'], lvl: 14, trains: 'archery' },
    { id: 'stig', name: 'Stig', loc: 'brightwater', home: 'brightwater:hearthhall', work: 'brightwater:hearthhall', role: 'companion', look: { sex: 'm', kin: 'norrhen', hair: 0, hairCol: 0x3a2a1a, beard: 2, age: 0.3, build: 1.2 }, gear: ['steel_body', 'steel_warhammer'], lvl: 12, trains: 'twoHanded' },
    { id: 'priest_bw', name: 'Maelis the Healer', loc: 'brightwater', home: 'brightwater:temple', work: 'brightwater:temple', role: 'priest', merchant: 'healer', look: { sex: 'f', kin: 'caldaran', hair: 3, hairCol: 0x4a2a14, age: 0.55 }, gear: ['robe_elder', 'shoes'], lvl: 12, trains: 'restoration' },
    { id: 'ingrid', name: 'Ingrid Fallowmoor', loc: 'brightwater', home: 'brightwater:farm1', work: 'brightwater:farm', role: 'citizen', look: { sex: 'f', kin: 'norrhen', hair: 4, hairCol: 0xc09060, age: 0.5 }, gear: ['tunic', 'shoes'], lvl: 3 },
    { id: 'tofa', name: 'Tofa Halter', loc: 'brightwater', home: 'brightwater:stables', work: 'brightwater:stables', role: 'stablemaster', merchant: 'horses', look: { sex: 'm', kin: 'norrhen', hair: 1, hairCol: 0x6a5a40, beard: 2, age: 0.5 }, gear: ['tunic', 'shoes'], lvl: 5 },
    { id: 'caravan_bw', name: 'Bjorn the Caravan Master', loc: 'brightwater', home: 'brightwater:stables', work: 'brightwater:stables', role: 'driver', look: { sex: 'm', kin: 'norrhen', hair: 0, hairCol: 0x8a6a40, beard: 3, age: 0.6 }, gear: ['tunic', 'shoes'], lvl: 5 },
    { id: 'agna', name: 'Agna', loc: 'brightwater', home: 'brightwater:house5', work: 'brightwater:market', role: 'citizen', merchant: 'food', look: { sex: 'f', kin: 'norrhen', hair: 5, hairCol: 0xd0c090, age: 0.6 }, gear: ['tunic', 'shoes'], lvl: 2 },
    { id: 'hrolfgar', name: 'Hrolfgar', loc: 'brightwater', home: 'brightwater:house1', work: 'brightwater:market', role: 'citizen', look: { sex: 'm', kin: 'norrhen', hair: 2, hairCol: 0x5a4030, beard: 1, age: 0.4 }, gear: ['tunic', 'shoes'], lvl: 3 },
    { id: 'kari', name: 'Old Kari', loc: 'brightwater', home: 'brightwater:house7', work: 'brightwater:plaza', role: 'citizen', look: { sex: 'f', kin: 'norrhen', hair: 3, hairCol: 0xd8d8d8, age: 0.9 }, gear: ['rags', 'shoes'], lvl: 1 },
    // --- Hrimvik
    { id: 'warden_kettil', name: 'Warden Kettil Saltbeard', loc: 'hrimvik', home: 'hrimvik:hall', work: 'hrimvik:hall', role: 'warden', essential: true, look: { sex: 'm', kin: 'norrhen', hair: 1, hairCol: 0xc8c8c0, beard: 4, age: 0.7 }, gear: ['warden', 'circlet', 'boots_fur'], lvl: 18 },
    { id: 'celestine', name: 'High Magister Celestine Oriel', loc: 'hrimvik', home: 'hrimvik:spire', work: 'hrimvik:spire', role: 'wizard', merchant: 'spells', essential: true, look: { sex: 'f', kin: 'aelfen', hair: 3, hairCol: 0xf0f0f0, age: 0.7 }, gear: ['robe_ad', 'shoes'], lvl: 40, trains: 'alteration' },
    { id: 'varo', name: 'Magister Varo Quill', loc: 'hrimvik', home: 'hrimvik:spire', work: 'hrimvik:spire', role: 'wizard', merchant: 'spells', look: { sex: 'm', kin: 'caldaran', hair: 0, hairCol: 0x3a3a3a, beard: 1, age: 0.5 }, gear: ['robe', 'shoes'], lvl: 20, trains: 'conjuration' },
    { id: 'torvik', name: 'Torvik the Loremaster', loc: 'hrimvik', home: 'hrimvik:spire', work: 'hrimvik:spire', role: 'elder', essential: true, look: { sex: 'm', kin: 'norrhen', hair: 1, hairCol: 0xe0e0e0, beard: 4, age: 0.95 }, gear: ['robe_elder', 'shoes'], lvl: 15 },
    { id: 'runa', name: 'Runa Sealsong', loc: 'hrimvik', home: 'hrimvik:shop', work: 'hrimvik:shop', role: 'merchant', merchant: 'general', look: { sex: 'f', kin: 'norrhen', hair: 2, hairCol: 0x4a3a2a, age: 0.5 }, gear: ['tunic', 'boots_fur'], lvl: 5 },
    { id: 'hallvig', name: 'Hallvig', loc: 'hrimvik', home: 'hrimvik:inn', work: 'hrimvik:inn', role: 'innkeeper', merchant: 'inn', look: { sex: 'm', kin: 'norrhen', hair: 0, hairCol: 0x8a7a6a, beard: 2, age: 0.55 }, gear: ['tunic', 'boots_fur'], lvl: 5 },
    // --- Stonecleft
    { id: 'warden_hrolf', name: 'Warden Hrolf Deepstone', loc: 'stonecleft', home: 'stonecleft:keep', work: 'stonecleft:keep', role: 'warden', essential: true, look: { sex: 'm', kin: 'norrhen', hair: 1, hairCol: 0x2a2a2a, beard: 3, age: 0.5 }, gear: ['warden', 'circlet', 'shoes'], lvl: 18 },
    { id: 'isolde', name: 'Isolde Brask', loc: 'stonecleft', home: 'stonecleft:keep', work: 'stonecleft:keep', role: 'scholar', essential: true, look: { sex: 'f', kin: 'caldaran', hair: 3, hairCol: 0x6a4a2a, age: 0.45 }, gear: ['robe', 'shoes'], lvl: 12, trains: 'enchanting', merchant: 'spells' },
    { id: 'thyra', name: 'Thyra Copperhand', loc: 'stonecleft', home: 'stonecleft:shop', work: 'stonecleft:shop', role: 'merchant', merchant: 'general', look: { sex: 'm', kin: 'norrhen', hair: 2, hairCol: 0x4a3020, beard: 2, age: 0.4 }, gear: ['fine', 'shoes'], lvl: 6 },
    { id: 'moira', name: 'Moira Ironhand', loc: 'stonecleft', home: 'stonecleft:house1', work: 'stonecleft:anvil', role: 'smith', merchant: 'smith', look: { sex: 'f', kin: 'orsk', hair: 1, hairCol: 0x1a1a1a, age: 0.4, build: 1.2 }, gear: ['tunic', 'shoes'], lvl: 16, trains: 'smithing' },
    { id: 'brokk', name: 'Brokk', loc: 'stonecleft', home: 'stonecleft:inn', work: 'stonecleft:inn', role: 'innkeeper', merchant: 'inn', look: { sex: 'm', kin: 'norrhen', hair: 0, hairCol: 0x5a4a3a, beard: 1, age: 0.6 }, gear: ['tunic', 'shoes'], lvl: 5 },
    // --- Mirefen
    { id: 'warden_asgerd', name: 'Warden Asgerd the Fair', loc: 'mirefen', home: 'mirefen:keep', work: 'mirefen:keep', role: 'warden', essential: true, look: { sex: 'f', kin: 'norrhen', hair: 4, hairCol: 0xe0c070, age: 0.35 }, gear: ['warden', 'circlet', 'shoes'], lvl: 16 },
    { id: 'rook', name: 'Rook', loc: 'mirefen', home: 'mirefen:cistern', work: 'mirefen:cistern', role: 'guildmaster', essential: true, look: { sex: 'm', kin: 'vael', hair: 2, hairCol: 0x1a1a1a, age: 0.4 }, gear: ['leather_body', 'leather_feet', 'steel_dagger'], lvl: 24, trains: 'pickpocket', merchant: 'fence' },
    { id: 'marten', name: 'Old Marten', loc: 'mirefen', home: 'mirefen:cistern', work: 'mirefen:cistern', role: 'merchant', merchant: 'fence', look: { sex: 'm', kin: 'caldaran', hair: 1, hairCol: 0xb0b0b0, beard: 2, age: 0.8 }, gear: ['rags', 'shoes'], lvl: 8, trains: 'lockpicking' },
    { id: 'wren', name: 'Wren Honeywort', loc: 'mirefen', home: 'mirefen:inn', work: 'mirefen:inn', role: 'innkeeper', merchant: 'inn', look: { sex: 'f', kin: 'caldaran', hair: 5, hairCol: 0x8a5a2a, age: 0.3 }, gear: ['tunic', 'shoes'], lvl: 4 },
    { id: 'edda', name: 'Edda Goldhollow', loc: 'mirefen', home: 'mirefen:meadery', work: 'mirefen:meadery', role: 'merchant', merchant: 'general', look: { sex: 'm', kin: 'norrhen', hair: 0, hairCol: 0xa08040, beard: 4, age: 0.55 }, gear: ['fine', 'shoes'], lvl: 10 },
    { id: 'freya', name: 'Freya', loc: 'mirefen', home: 'mirefen:house2', work: 'mirefen:market', role: 'citizen', look: { sex: 'f', kin: 'norrhen', hair: 4, hairCol: 0xc08050, age: 0.3 }, gear: ['tunic', 'shoes'], lvl: 3 },
    { id: 'vigdis', name: 'Vigdis', loc: 'mirefen', home: 'mirefen:forge', work: 'mirefen:anvil', role: 'smith', merchant: 'smith', look: { sex: 'f', kin: 'norrhen', hair: 1, hairCol: 0x3a2a1a, age: 0.45, build: 1.1 }, gear: ['tunic', 'shoes'], lvl: 10 },
    // --- Kelvik and Highcairn
    { id: 'osric', name: 'Osric', loc: 'kelvik', home: 'kelvik:inn', work: 'kelvik:inn', role: 'innkeeper', merchant: 'inn', look: { sex: 'm', kin: 'norrhen', hair: 0, hairCol: 0x6a5a40, beard: 2, age: 0.5 }, gear: ['tunic', 'boots_fur'], lvl: 5 },
    { id: 'ostvald', name: 'Master Ostvald', loc: 'highcairn', home: 'highcairn:monastery', work: 'highcairn:monastery', role: 'elder', essential: true, look: { sex: 'm', kin: 'norrhen', hair: 6, hairCol: 0xd0d0d0, beard: 4, age: 0.9 }, gear: ['robe_elder', 'shoes'], lvl: 40 },
    { id: 'eirik', name: 'Watcher Eirik', loc: 'highcairn', home: 'highcairn:monastery', work: 'highcairn:monastery', role: 'elder', essential: true, look: { sex: 'm', kin: 'norrhen', hair: 6, hairCol: 0xb0b0b0, beard: 3, age: 0.8 }, gear: ['robe_elder', 'shoes'], lvl: 40 },
    { id: 'hallgrim', name: 'Watcher Hallgrim', loc: 'highcairn', home: 'highcairn:monastery', work: 'highcairn:monastery', role: 'elder', essential: true, look: { sex: 'm', kin: 'norrhen', hair: 6, hairCol: 0xc8c0b0, beard: 4, age: 0.85 }, gear: ['robe_elder', 'shoes'], lvl: 40 },
];
export const NPC = Object.fromEntries(NPCS.map((n) => [n.id, n]));

// ------------------------------------------------------------------ encounter zones
// what spawns at each location while the player is near (outdoors)
export const ENCOUNTERS = {
    banditcamp: [['bandit_chief', 1], ['bandit', 3], ['bandit_archer', 2]],
    twintolls: [['bandit', 3], ['bandit_archer', 2], ['bandit_chief', 1]],
    gianthearth: [['giant', 1], ['mammoth', 2]],
    hotsprings: [['giant', 1], ['mammoth', 1]],
    greywatch: [],
    kalrstead: [],
    wreck: [['mudclaw', 3], ['walrus', 2]],
    elktotem: [['icewolf', 2]],
    shrine_e: [['fangcat', 1]],
    shrine_w: [['wolf', 2]],
};
// wandering wildlife per region: [template, weight]; picked by level band
export const WILDLIFE = {
    pinewood: [['wolf', 4], ['deer', 3], ['elk', 2], ['fox', 2], ['bear', 1], ['spider', 1], ['bandit', 1]],
    southwood: [['wolf', 3], ['deer', 3], ['bear', 2], ['fox', 2], ['spider', 1], ['bandit', 1]],
    plains: [['elk', 3], ['deer', 2], ['wolf', 3], ['fangcat', 1], ['fox', 2], ['bandit', 1], ['reaver', 1], ['hearthguard', 1]],
    greyspine: [['goat', 3], ['fangcat', 2], ['wolf', 2], ['troll', 1], ['bandit', 1]],
    wastes: [['icewolf', 3], ['snowbear', 1], ['frost_troll', 1], ['snowfang', 1], ['goat', 2]],
    coast: [['mudclaw', 3], ['walrus', 3], ['icewolf', 2]],
    hrimgard: [['goat', 3], ['troll', 1], ['snowfang', 1], ['icewolf', 2]],
    ember: [['elk', 2], ['fangcat', 2], ['mammoth', 1], ['wolf', 2], ['mudclaw', 1]],
    mirefen: [['mudclaw', 3], ['deer', 2], ['spider', 2], ['giantrat', 2], ['wolf', 2], ['fox', 2]],
    icefields: [['icewolf', 3], ['snowbear', 1], ['frost_troll', 1], ['wight_husk', 1]],
};

/** Essence tier (1 faint … 5 great) is given directly as a number on each template. */
export const ESSENCE_TIER = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
