/**
 * effects.js — magic effects shared by potions, poisons, food, ingredients, enchantments,
 * spells and powers. Each effect knows what it does to an actor and how it reads in text.
 */

// kind: restore | fortify | resist | regen | damage | weak | status | special
// base: magnitude per point for alchemy/enchanting value calculations
export const EFFECTS = {
    restoreHealth:   { name: 'Restore Health', kind: 'restore', stat: 'hp', base: 0.5, text: (m) => `Restore ${m} points of Health.` },
    restoreMana:  { name: 'Restore Mana', kind: 'restore', stat: 'mp', base: 0.6, text: (m) => `Restore ${m} points of Mana.` },
    restoreStamina:  { name: 'Restore Stamina', kind: 'restore', stat: 'sp', base: 0.6, text: (m) => `Restore ${m} Stamina.` },
    fortifyHealth:   { name: 'Bolster Health', kind: 'fortify', stat: 'hpMax', base: 0.35, text: (m, d) => `Health is increased by ${m}${d ? ` for ${d} seconds` : ''}.` },
    fortifyMana:  { name: 'Bolster Mana', kind: 'fortify', stat: 'mpMax', base: 0.3, text: (m, d) => `Mana is increased by ${m}${d ? ` for ${d} seconds` : ''}.` },
    fortifyStamina:  { name: 'Bolster Stamina', kind: 'fortify', stat: 'spMax', base: 0.3, text: (m, d) => `Stamina is increased by ${m}${d ? ` for ${d} seconds` : ''}.` },
    fortifyCarry:    { name: 'Bolster Carry Weight', kind: 'fortify', stat: 'carry', base: 0.15, text: (m, d) => `Carrying capacity is increased by ${m}${d ? ` for ${d} seconds` : ''}.` },
    regenHealth:     { name: 'Regenerate Health', kind: 'regen', stat: 'hpRegen', base: 0.5, text: (m, d) => `Health regenerates ${m}% faster${d ? ` for ${d} seconds` : ''}.` },
    regenMana:    { name: 'Regenerate Mana', kind: 'regen', stat: 'mpRegen', base: 0.5, text: (m, d) => `Mana regenerates ${m}% faster${d ? ` for ${d} seconds` : ''}.` },
    regenStamina:    { name: 'Regenerate Stamina', kind: 'regen', stat: 'spRegen', base: 0.5, text: (m, d) => `Stamina regenerates ${m}% faster${d ? ` for ${d} seconds` : ''}.` },
    resistFire:      { name: 'Resist Fire', kind: 'resist', stat: 'fire', base: 0.5, text: (m, d) => `Resist ${m}% of fire damage${d ? ` for ${d} seconds` : ''}.` },
    resistFrost:     { name: 'Resist Frost', kind: 'resist', stat: 'frost', base: 0.5, text: (m, d) => `Resist ${m}% of frost damage${d ? ` for ${d} seconds` : ''}.` },
    resistShock:     { name: 'Resist Shock', kind: 'resist', stat: 'shock', base: 0.5, text: (m, d) => `Resist ${m}% of shock damage${d ? ` for ${d} seconds` : ''}.` },
    resistMagic:     { name: 'Resist Magic', kind: 'resist', stat: 'magic', base: 0.9, text: (m, d) => `Resist ${m}% of magic${d ? ` for ${d} seconds` : ''}.` },
    resistPoison:    { name: 'Resist Poison', kind: 'resist', stat: 'poison', base: 0.4, text: (m, d) => `Resist ${m}% of poison${d ? ` for ${d} seconds` : ''}.` },
    invisibility:    { name: 'Invisibility', kind: 'status', stat: 'invisible', base: 6, text: (m, d) => `Invisibility for ${d} seconds.` },
    waterbreathing:  { name: 'Waterbreathing', kind: 'status', stat: 'waterbreathing', base: 1, text: (m, d) => `Can breathe underwater for ${d} seconds.` },
    hush:          { name: 'Hush', kind: 'status', stat: 'hush', base: 3, text: (m, d) => `Movement is silent${d ? ` for ${d} seconds` : ''}.` },
    damageHealth:    { name: 'Damage Health', kind: 'damage', stat: 'hp', hostile: true, base: 1.2, text: (m) => `Causes ${m} points of poison damage.` },
    damageMana:   { name: 'Damage Mana', kind: 'damage', stat: 'mp', hostile: true, base: 0.8, text: (m) => `Drains the target's Mana by ${m} points.` },
    damageStamina:   { name: 'Damage Stamina', kind: 'damage', stat: 'sp', hostile: true, base: 0.8, text: (m) => `Drains the target's Stamina by ${m} points.` },
    lingering:       { name: 'Lingering Damage Health', kind: 'dot', stat: 'hp', hostile: true, base: 1.0, text: (m, d) => `Causes ${m} points of poison damage per second for ${d} seconds.` },
    paralysis:       { name: 'Paralysis', kind: 'status', stat: 'paralyzed', hostile: true, base: 20, text: (m, d) => `Target is paralyzed for ${d} seconds.` },
    slow:            { name: 'Slow', kind: 'status', stat: 'slowed', hostile: true, base: 3, text: (m, d) => `Target moves at half speed for ${d} seconds.` },
    weakFire:        { name: 'Weakness to Fire', kind: 'weak', stat: 'fire', hostile: true, base: 0.6, text: (m, d) => `Target is ${m}% weaker to fire for ${d} seconds.` },
    weakFrost:       { name: 'Weakness to Frost', kind: 'weak', stat: 'frost', hostile: true, base: 0.6, text: (m, d) => `Target is ${m}% weaker to frost for ${d} seconds.` },
    weakShock:       { name: 'Weakness to Shock', kind: 'weak', stat: 'shock', hostile: true, base: 0.6, text: (m, d) => `Target is ${m}% weaker to shock for ${d} seconds.` },
    fear:            { name: 'Fear', kind: 'status', stat: 'feared', hostile: true, base: 8, text: (m, d) => `Creatures and people up to level ${m} flee for ${d} seconds.` },
    frenzy:          { name: 'Frenzy', kind: 'status', stat: 'frenzied', hostile: true, base: 8, text: (m, d) => `Creatures and people up to level ${m} attack anything nearby for ${d} seconds.` },
    calm:            { name: 'Calm', kind: 'status', stat: 'calmed', hostile: false, base: 8, text: (m, d) => `Creatures and people up to level ${m} won't fight for ${d} seconds.` },
    courage:         { name: 'Courage', kind: 'status', stat: 'courage', base: 2, text: (m, d) => `Allies fight harder for ${d} seconds.` },
    // fortify skills
    fortifyOneHanded:   { name: 'Bolster One-Handed', kind: 'skill', stat: 'oneHanded', base: 0.5, text: (m, d) => `One-handed weapons do ${m}% more damage${d ? ` for ${d} seconds` : ''}.` },
    fortifyTwoHanded:   { name: 'Bolster Two-Handed', kind: 'skill', stat: 'twoHanded', base: 0.5, text: (m, d) => `Two-handed weapons do ${m}% more damage${d ? ` for ${d} seconds` : ''}.` },
    fortifyArchery:     { name: 'Bolster Archery', kind: 'skill', stat: 'archery', base: 0.5, text: (m, d) => `Bows do ${m}% more damage${d ? ` for ${d} seconds` : ''}.` },
    fortifyBlock:       { name: 'Bolster Block', kind: 'skill', stat: 'block', base: 0.4, text: (m, d) => `Blocking absorbs ${m}% more damage${d ? ` for ${d} seconds` : ''}.` },
    fortifyHeavyArmor:  { name: 'Bolster Heavy Armor', kind: 'skill', stat: 'heavyArmor', base: 0.4, text: (m, d) => `Increases Heavy Armor skill by ${m} points${d ? ` for ${d} seconds` : ''}.` },
    fortifyLightArmor:  { name: 'Bolster Light Armor', kind: 'skill', stat: 'lightArmor', base: 0.4, text: (m, d) => `Increases Light Armor skill by ${m} points${d ? ` for ${d} seconds` : ''}.` },
    fortifySneak:       { name: 'Bolster Sneak', kind: 'skill', stat: 'sneak', base: 0.4, text: (m, d) => `You are ${m}% harder to detect${d ? ` for ${d} seconds` : ''}.` },
    fortifyLockpicking: { name: 'Bolster Lockpicking', kind: 'skill', stat: 'lockpicking', base: 0.3, text: (m, d) => `Lockpicking is ${m}% easier${d ? ` for ${d} seconds` : ''}.` },
    fortifyPickpocket:  { name: 'Bolster Pickpocket', kind: 'skill', stat: 'pickpocket', base: 0.3, text: (m, d) => `Pickpocketing is ${m}% easier${d ? ` for ${d} seconds` : ''}.` },
    fortifySpeech:      { name: 'Bolster Haggling', kind: 'skill', stat: 'speech', base: 0.4, text: (m, d) => `You haggle for ${m}% better prices${d ? ` for ${d} seconds` : ''}.` },
    fortifySmithing:    { name: 'Bolster Smithing', kind: 'skill', stat: 'smithing', base: 0.4, text: (m, d) => `Weapons and armor can be improved ${m}% better${d ? ` for ${d} seconds` : ''}.` },
    fortifyAlchemy:     { name: 'Bolster Alchemy', kind: 'skill', stat: 'alchemy', base: 0.5, text: (m, d) => `Potions you mix are ${m}% stronger.` },
    fortifyEnchanting:  { name: 'Bolster Enchanting', kind: 'skill', stat: 'enchanting', base: 0.5, text: (m, d) => `Enchantments are ${m}% stronger${d ? ` for ${d} seconds` : ''}.` },
    fortifyDestruction: { name: 'Bolster Destruction', kind: 'skill', stat: 'destruction', base: 0.6, text: (m, d) => `Destruction spells cost ${m}% less${d ? ` for ${d} seconds` : ''}.` },
    fortifyRestoration: { name: 'Bolster Restoration', kind: 'skill', stat: 'restoration', base: 0.6, text: (m, d) => `Restoration spells cost ${m}% less${d ? ` for ${d} seconds` : ''}.` },
    fortifyAlteration:  { name: 'Bolster Alteration', kind: 'skill', stat: 'alteration', base: 0.6, text: (m, d) => `Alteration spells cost ${m}% less${d ? ` for ${d} seconds` : ''}.` },
    fortifyConjuration: { name: 'Bolster Conjuration', kind: 'skill', stat: 'conjuration', base: 0.6, text: (m, d) => `Conjuration spells cost ${m}% less${d ? ` for ${d} seconds` : ''}.` },
    fortifyIllusion:    { name: 'Bolster Illusion', kind: 'skill', stat: 'illusion', base: 0.6, text: (m, d) => `Illusion spells cost ${m}% less${d ? ` for ${d} seconds` : ''}.` },
    // weapon enchantments (on hit)
    fireDamage:   { name: 'Fire Damage', kind: 'elemental', elem: 'fire', hostile: true, base: 1.2, text: (m) => `Burns the target for ${m} points.` },
    frostDamage:  { name: 'Frost Damage', kind: 'elemental', elem: 'frost', hostile: true, base: 1.2, text: (m) => `Target takes ${m} frost damage to Health and Stamina.` },
    shockDamage:  { name: 'Shock Damage', kind: 'elemental', elem: 'shock', hostile: true, base: 1.2, text: (m) => `Target takes ${m} points of shock damage to Health and half to Mana.` },
    absorbHealth: { name: 'Absorb Health', kind: 'absorb', stat: 'hp', hostile: true, base: 2.2, text: (m) => `Absorb ${m} points of Health.` },
    absorbStamina:{ name: 'Absorb Stamina', kind: 'absorb', stat: 'sp', hostile: true, base: 1.6, text: (m) => `Absorb ${m} points of Stamina.` },
    turnUndead:   { name: 'Turn Undead', kind: 'status', stat: 'feared', undead: true, hostile: true, base: 6, text: (m, d) => `Undead up to level ${m} flee for ${d} seconds.` },
    banish:       { name: 'Banish', kind: 'special', hostile: true, base: 8, text: () => 'Summoned creatures are sent home.' },
};
export const EFFECT_IDS = Object.keys(EFFECTS);

export function effectText(id, mag, dur) {
    const e = EFFECTS[id];
    return e ? e.text(Math.round(mag), dur ? Math.round(dur) : 0) : id;
}
