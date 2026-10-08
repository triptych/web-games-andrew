/**
 * magic.js — spells, enchantments and the Storm Sigils.
 */
import { registerItem } from './items.js';

// kind: conc (stream while held), bolt (projectile), ball (projectile + splash), self, ward, target (projectile that applies effects),
// summon, spectral (conjured weapon), rune (placed trap), cloak? (none), heal (conc self)
export const SPELLS = {
    flames:        { name: 'Flames', school: 'destruction', tier: 0, cost: 14, kind: 'conc', elem: 'fire', dmg: 8, range: 6, desc: 'A gout of fire that does 8 points per second. Targets on fire take extra damage.' },
    rimetouch:     { name: 'Rime Touch', school: 'destruction', tier: 0, cost: 14, kind: 'conc', elem: 'frost', dmg: 8, range: 6, desc: 'A blast of cold that does 8 points per second to Health and Stamina.' },
    sparks:        { name: 'Sparks', school: 'destruction', tier: 0, cost: 14, kind: 'conc', elem: 'shock', dmg: 8, range: 6, desc: 'Lightning that does 8 points of shock damage per second to Health and half to Mana.' },
    firebolt:      { name: 'Firebolt', school: 'destruction', tier: 1, cost: 41, kind: 'bolt', elem: 'fire', dmg: 25, speed: 40, desc: 'A blast of fire that does 25 points of damage. Targets on fire take extra damage.' },
    icespike:      { name: 'Ice Spike', school: 'destruction', tier: 1, cost: 48, kind: 'bolt', elem: 'frost', dmg: 25, speed: 45, desc: 'A spike of ice that does 25 points of frost damage to Health and Stamina.' },
    lightning:     { name: 'Lightning Bolt', school: 'destruction', tier: 1, cost: 48, kind: 'bolt', elem: 'shock', dmg: 25, speed: 120, desc: 'A bolt of lightning that does 25 points of shock damage to Health and half to Mana.' },
    firerune:      { name: 'Fire Rune', school: 'destruction', tier: 1, cost: 98, kind: 'rune', elem: 'fire', dmg: 50, radius: 4, desc: 'Cast on a nearby surface, it explodes for 50 points of fire damage when enemies come near.' },
    fireball:      { name: 'Fireball', school: 'destruction', tier: 2, cost: 133, kind: 'ball', elem: 'fire', dmg: 40, radius: 5, speed: 35, desc: 'A fiery explosion for 40 points of damage in a 15 foot radius.' },
    icestorm:      { name: 'Ice Storm', school: 'destruction', tier: 2, cost: 154, kind: 'ball', elem: 'frost', dmg: 40, radius: 4, speed: 18, desc: 'A freezing whirlwind that does 40 points of frost damage per second.' },
    chainlightning:{ name: 'Chain Lightning', school: 'destruction', tier: 2, cost: 154, kind: 'ball', elem: 'shock', dmg: 40, radius: 6, speed: 90, desc: 'Lightning that leaps from the target to another, for 40 points of shock damage.' },
    immolate:    { name: 'Immolate', school: 'destruction', tier: 3, cost: 254, kind: 'bolt', elem: 'fire', dmg: 60, speed: 45, desc: 'A blast of fire that does 60 points of damage.' },
    glaciallance:      { name: 'Glacial Lance', school: 'destruction', tier: 3, cost: 254, kind: 'bolt', elem: 'frost', dmg: 60, speed: 45, desc: 'A spear of ice that does 60 points of frost damage.' },
    thunderbolt:   { name: 'Stormspear', school: 'destruction', tier: 3, cost: 254, kind: 'bolt', elem: 'shock', dmg: 60, speed: 150, desc: 'An enormous bolt of lightning for 60 points of shock damage.' },
    healing:       { name: 'Mending', school: 'restoration', tier: 0, cost: 12, kind: 'heal', heal: 10, desc: 'Heals the caster 10 points per second.' },
    ward:          { name: 'Ward', school: 'restoration', tier: 0, cost: 18, kind: 'ward', ward: 40, desc: 'Increases armor rating by 40 points and negates up to 40 points of spell damage.' },
    quickmending:   { name: 'Quick Mending', school: 'restoration', tier: 1, cost: 87, kind: 'self', heal: 50, desc: 'Heals the caster 50 points.' },
    mendother:     { name: 'Mend Other', school: 'restoration', tier: 1, cost: 26, kind: 'conc', heal: 15, range: 8, ally: true, desc: 'Heals the target 15 points per second.' },
    turnundead:    { name: 'Turn Undead', school: 'restoration', tier: 1, cost: 84, kind: 'target', effects: [{ id: 'turnUndead', mag: 12, dur: 30 }], speed: 30, desc: 'Undead up to level 12 flee for 30 seconds.' },
    knitflesh:   { name: 'Knit Flesh', school: 'restoration', tier: 2, cost: 165, kind: 'self', heal: 100, desc: 'Heals the caster 100 points.' },
    bulwark:     { name: 'Bulwark Ward', school: 'restoration', tier: 2, cost: 36, kind: 'ward', ward: 60, desc: 'Increases armor rating by 60 points and negates up to 60 points of spell damage.' },
    dawnflare:       { name: 'Dawnflare', school: 'restoration', tier: 3, cost: 120, kind: 'bolt', elem: 'sun', dmg: 50, speed: 50, undeadOnly: true, desc: 'A searing light that does 50 points of damage to the undead.' },
    barkskin:      { name: 'Barkskin', school: 'alteration', tier: 0, cost: 40, kind: 'self', armor: 40, dur: 60, desc: 'Improves the caster\'s armor rating by 40 points for 60 seconds.' },
    wisplight:   { name: 'Wisplight', school: 'alteration', tier: 0, cost: 21, kind: 'self', light: 60, desc: 'Creates a hovering light that lasts for 60 seconds.' },
    stoneskin:    { name: 'Stoneskin', school: 'alteration', tier: 1, cost: 90, kind: 'self', armor: 60, dur: 60, desc: 'Improves the caster\'s armor rating by 60 points for 60 seconds.' },
    ironskin:     { name: 'Ironskin', school: 'alteration', tier: 2, cost: 150, kind: 'self', armor: 80, dur: 60, desc: 'Improves the caster\'s armor rating by 80 points for 60 seconds.' },
    paralyze:      { name: 'Paralyze', school: 'alteration', tier: 3, cost: 250, kind: 'target', effects: [{ id: 'paralysis', mag: 1, dur: 10 }], speed: 40, desc: 'Targets that fail to resist are paralyzed for 10 seconds.' },
    spiritwolf:      { name: 'Call Spirit Wolf', school: 'conjuration', tier: 0, cost: 51, kind: 'summon', summon: 'spiritwolf', dur: 60, desc: 'Summons a spectral wolf for 60 seconds.' },
    spectralblade:    { name: 'Spectral Blade', school: 'conjuration', tier: 0, cost: 45, kind: 'bound', weapon: 'spectral_blade', dur: 120, desc: 'Creates a magic sword for 120 seconds.' },
    embergolem: { name: 'Call Ember Golem', school: 'conjuration', tier: 1, cost: 106, kind: 'summon', summon: 'ember_golem', dur: 60, desc: 'Summons a Ember Golem for 60 seconds.' },
    rimegolem: { name: 'Call Rime Golem', school: 'conjuration', tier: 2, cost: 144, kind: 'summon', summon: 'rime_golem', dur: 60, desc: 'Summons a Rime Golem for 60 seconds.' },
    courage:       { name: 'Courage', school: 'illusion', tier: 0, cost: 30, kind: 'target', effects: [{ id: 'courage', mag: 1, dur: 60 }], ally: true, speed: 30, desc: 'The target won\'t flee and fights harder for 60 seconds.' },
    calm:          { name: 'Calm', school: 'illusion', tier: 0, cost: 50, kind: 'target', effects: [{ id: 'calm', mag: 9, dur: 30 }], speed: 30, desc: 'Creatures and people up to level 9 won\'t fight for 30 seconds.' },
    rage:          { name: 'Rage', school: 'illusion', tier: 1, cost: 70, kind: 'target', effects: [{ id: 'frenzy', mag: 14, dur: 30 }], speed: 30, desc: 'Creatures and people up to level 14 attack anything nearby for 30 seconds.' },
    hush:        { name: 'Hush', school: 'illusion', tier: 1, cost: 100, kind: 'self', effects: [{ id: 'hush', mag: 1, dur: 180 }], desc: 'You move more quietly for 180 seconds.' },
    fear:          { name: 'Fear', school: 'illusion', tier: 2, cost: 120, kind: 'target', effects: [{ id: 'fear', mag: 16, dur: 30 }], speed: 30, desc: 'Creatures and people up to level 16 flee from combat for 30 seconds.' },
    invisibility:  { name: 'Invisibility', school: 'illusion', tier: 2, cost: 230, kind: 'self', effects: [{ id: 'invisibility', mag: 1, dur: 30 }], desc: 'The caster is invisible for 30 seconds. Activating an object or attacking breaks the spell.' },
};
export const SPELL_IDS = Object.keys(SPELLS);
export const TIERS = ['First Circle', 'Second Circle', 'Third Circle', 'Fourth Circle'];
const TOME_VAL = [50, 160, 340, 700];
for (const [id, sp] of Object.entries(SPELLS)) registerItem(`tome_${id}`, { type: 'spelltome', name: `Spell Tome: ${sp.name}`, spell: id, weight: 1, value: TOME_VAL[sp.tier] });
registerItem('spectral_blade', { type: 'weapon', name: 'Spectral Blade', wtype: 'sword', material: 'bound', lvl: 1, damage: 10, speed: 1.1, reach: 2.1, skill: 'oneHanded', two: false, weight: 0, value: 0, color: 0x6aa8ff, bound: true });

/** Mana cost after skill and perks. */
export function spellCost(spell, skillLevel, perks) {
    let c = spell.cost * (1 - 0.4 * Math.min(100, skillLevel) / 100);
    const school = spell.school;
    const novice = { destruction: 'de_novice', restoration: 're_novice', alteration: 'alt_novice', conjuration: 'co_novice', illusion: 'il_novice' }[school];
    if (spell.tier === 0 && perks[novice]) c *= 0.5;
    if (school === 'destruction' && (spell.tier === 1 || spell.tier === 2) && perks.de_apprentice) c *= 0.5;
    if (school === 'destruction' && spell.tier === 3 && perks.de_expert) c *= 0.5;
    return Math.max(1, Math.round(c));
}

// ------------------------------------------------------------------ enchantments
export const ENCHANTS = {
    weapon: ['fireDamage', 'frostDamage', 'shockDamage', 'absorbHealth', 'absorbStamina', 'paralysis', 'turnUndead', 'fear', 'damageMana'],
    armor: {
        head: ['fortifyMana', 'fortifyArchery', 'fortifyDestruction', 'fortifyRestoration', 'fortifyAlteration', 'fortifyConjuration', 'fortifyIllusion', 'regenMana', 'waterbreathing'],
        body: ['fortifyHealth', 'fortifyStamina', 'resistFire', 'resistFrost', 'resistShock', 'resistPoison', 'regenHealth', 'fortifyHeavyArmor', 'fortifyLightArmor'],
        hands: ['fortifyOneHanded', 'fortifyTwoHanded', 'fortifyArchery', 'fortifySmithing', 'fortifyAlchemy', 'fortifyLockpicking', 'fortifyPickpocket', 'fortifyCarry'],
        feet: ['fortifyStamina', 'fortifySneak', 'fortifyCarry', 'resistFire', 'resistFrost', 'resistShock', 'hush'],
        shield: ['fortifyBlock', 'resistFire', 'resistFrost', 'resistShock', 'resistMagic', 'fortifyHealth'],
        ring: ['fortifyOneHanded', 'fortifyTwoHanded', 'fortifyArchery', 'fortifyAlchemy', 'fortifyMana', 'fortifyHealth', 'resistFire', 'resistFrost', 'resistShock', 'regenMana', 'fortifySneak', 'fortifyConjuration'],
        amulet: ['fortifyHealth', 'fortifyMana', 'fortifyStamina', 'resistMagic', 'fortifySpeech', 'fortifyDestruction', 'fortifyRestoration', 'regenHealth'],
    },
};
// base magnitudes with a great essence and 0 skill
export const ENCH_BASE = {
    fireDamage: 10, frostDamage: 10, shockDamage: 10, absorbHealth: 8, absorbStamina: 10, paralysis: 1, turnUndead: 12, fear: 10, damageMana: 12,
    fortifyHealth: 25, fortifyMana: 25, fortifyStamina: 25, fortifyCarry: 15, regenHealth: 20, regenMana: 25, resistFire: 20, resistFrost: 20, resistShock: 20,
    resistPoison: 20, resistMagic: 6, waterbreathing: 1, hush: 1, fortifyBlock: 12, fortifySpeech: 10,
};
export const ENCH_SUFFIX = {
    fireDamage: ['Cinders', 'Kindling', 'the Forge', 'the Pyre'], frostDamage: ['Rime', 'Hoarfrost', 'the Glacier', 'Deep Winter'], shockDamage: ['Static', 'Crackling', 'the Tempest', 'the Thunderhead'],
    absorbHealth: ['Thirst', 'Leeching', 'the Leech', 'the Bloodmoon'], absorbStamina: ['Sapping', 'Wearying', 'the Long March', 'Exhaustion'],
    paralysis: ['Halting', 'Binding', 'Stone', 'the Statue'], turnUndead: ['Hallowing', 'Dawn', 'the Lantern', 'Sunrise'], fear: ['Unease', 'Dread', 'Panic', 'Nightmares'], damageMana: ['Dimming', 'Draining', 'Hollowing', 'the Void'],
};
export function enchName(baseName, ench) {
    const tierIdx = Math.min(3, Math.floor((ench.mag / (ENCH_BASE[ench.id] || 10)) * 1.6));
    const suf = ENCH_SUFFIX[ench.id] ? ENCH_SUFFIX[ench.id][tierIdx] : effectShort(ench.id);
    return `${baseName} of ${suf}`;
}
function effectShort(id) {
    const m = id.replace(/^fortify/, '').replace(/^resist/, '').replace(/^regen/, '');
    const map = { Health: 'Health', Mana: 'Mana', Stamina: 'Stamina', Carry: 'the Ox', Fire: 'Fire Resistance', Frost: 'Frost Resistance', Shock: 'Shock Resistance', Magic: 'Warding', Poison: 'Antidote',
        OneHanded: 'Fighting', TwoHanded: 'Strength', Archery: 'the Marksman', Block: 'Blocking', HeavyArmor: 'Iron Skin', LightArmor: 'the Wind', Sneak: 'Shadows', Lockpicking: 'Keys',
        Pickpocket: 'Filching', Speech: 'Haggling', Smithing: 'the Forge', Alchemy: 'the Alchemist', Enchanting: 'Arcana', Destruction: 'Evocation', Restoration: 'Mending',
        Alteration: 'Shaping', Conjuration: 'Conjuring', Illusion: 'Glamour', waterbreathing: 'Waterbreathing', hush: 'Silence' };
    return map[m] || m;
}

// ------------------------------------------------------------------ Storm Sigils
/**
 * The Stormsworn trace sigils in the air with an open hand. Each sigil has three rings, learned
 * one at a time from ancient sigil stones. Tracing a sigil spends Storm Charge: the longer you
 * hold, the more rings you trace and the more charge it costs. Charge trickles back on its own,
 * faster under rain and thunder, and every dragon ember you absorb raises its ceiling and fills it.
 */
export const SIGILS = {
    gale:      { name: 'Sigil of the Gale',   rings: ['gust', 'gale', 'tempest'], cost: [20, 40, 75], desc: 'A wall of wind bursts from your palm and hurls aside whatever stands before you.' },
    stride:    { name: 'Sigil of the Stride', rings: ['step', 'leap', 'flight'], cost: [15, 25, 40], desc: 'The wind carries you forward in a single rushing stride.' },
    embers:    { name: 'Sigil of Embers',     rings: ['spark', 'blaze', 'pyre'], cost: [25, 45, 80], desc: 'A fan of fire pours from the sigil as it burns away.' },
    rime:      { name: 'Sigil of Rime',       rings: ['chill', 'frost', 'winter'], cost: [25, 45, 80], desc: 'Winter spills from the sigil and freezes all before you.' },
    earthbind: { name: 'Sigil of Earthbinding', rings: ['root', 'chain', 'anchor'], cost: [20, 30, 45], desc: 'Old mortal craft: binds a dragon to the earth so it cannot take wing.' },
    stillness: { name: 'Sigil of Stillness',  rings: ['hush', 'pause', 'stop'], cost: [30, 50, 85], desc: 'The world slows around you while your own heart keeps its pace.' },
    veil:      { name: 'Sigil of the Veil',   rings: ['mist', 'shade', 'ghost'], cost: [20, 35, 55], desc: 'You step half out of the world; blades and fire pass through you.' },
};
export const RINGS = {};
for (const [sid, sg] of Object.entries(SIGILS)) sg.rings.forEach((r, i) => { RINGS[`${sid}:${i}`] = { id: `${sid}:${i}`, sigil: sid, idx: i, name: r[0].toUpperCase() + r.slice(1) }; });

/** How many rings of a sigil the player knows. */
export function sigilPower(storm, sigilId) { return Math.min(3, storm?.rings[sigilId] || 0); }
/** Learn the next ring of a sigil (from a sigil stone); returns the new ring count. */
export function learnRing(storm, sigilId) { storm.rings[sigilId] = Math.min(3, (storm.rings[sigilId] || 0) + 1); if (!storm.equipped) storm.equipped = sigilId; return storm.rings[sigilId]; }
/** Absorb a dragon's ember: the ceiling rises and the charge fills. */
export function absorbEmber(storm) { storm.embers++; storm.chargeMax = Math.min(300, storm.chargeMax + 10); storm.charge = storm.chargeMax; }

export function makeStorm() { return { rings: {}, embers: 0, equipped: null, charge: 60, chargeMax: 100 }; }
