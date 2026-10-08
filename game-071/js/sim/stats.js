/**
 * stats.js — skills, experience, levels, perks and kin.
 *
 * Skills rise by use (xpToNext(L) = 15 + 0.9·L + 0.12·L², scaled per skill); each skill level gives
 * 10 + L/2 character XP; character level N needs 60 + 25·N. Five perks per
 * skill, unlocked in order at skill 0/20/40/60/80, each a small named modifier the rest of the
 * simulation asks about with perkVal().
 */

export const SKILLS = {
    oneHanded:   { name: 'One-Handed', tree: 'warrior', mult: 1.0 },
    twoHanded:   { name: 'Two-Handed', tree: 'warrior', mult: 1.0 },
    archery:     { name: 'Archery', tree: 'warrior', mult: 1.1 },
    block:       { name: 'Block', tree: 'warrior', mult: 1.3 },
    heavyArmor:  { name: 'Heavy Armor', tree: 'warrior', mult: 1.2 },
    smithing:    { name: 'Smithing', tree: 'warrior', mult: 0.8 },
    lightArmor:  { name: 'Light Armor', tree: 'thief', mult: 1.2 },
    sneak:       { name: 'Sneak', tree: 'thief', mult: 1.0 },
    lockpicking: { name: 'Lockpicking', tree: 'thief', mult: 0.6 },
    pickpocket:  { name: 'Pickpocket', tree: 'thief', mult: 0.8 },
    speech:      { name: 'Speech', tree: 'thief', mult: 0.8 },
    alchemy:     { name: 'Alchemy', tree: 'thief', mult: 0.8 },
    destruction: { name: 'Evocation', tree: 'mage', mult: 1.0 },
    restoration: { name: 'Mending', tree: 'mage', mult: 1.0 },
    alteration:  { name: 'Shaping', tree: 'mage', mult: 1.0 },
    conjuration: { name: 'Summoning', tree: 'mage', mult: 1.0 },
    illusion:    { name: 'Glamour', tree: 'mage', mult: 1.0 },
    enchanting:  { name: 'Runecraft', tree: 'mage', mult: 0.8 },
};
export const SKILL_IDS = Object.keys(SKILLS);

// Game-pace scale: skills rise roughly three times faster than in the original.
export const XP_SCALE = 4.5;
export const xpToNext = (L) => 15 + 0.9 * L + 0.12 * L * L;
export const charXpToNext = (N) => 60 + 25 * N;

// ------------------------------------------------------------------ perks
// id: { skill, name, req (skill level), desc, val (a number the sim reads), prev }
export const PERKS = {};
const P = (skill, list) => list.forEach(([id, name, req, val, desc], i) => { PERKS[id] = { id, skill, name, req, val, desc, prev: i ? list[i - 1][0] : null, idx: i }; });
P('oneHanded', [['oh_armsman', 'Steady Grip', 0, 0.2, 'One-handed weapons hit 20% harder.'], ['oh_stance', 'Light Footwork', 20, 0.25, 'Heavy swings with a one-handed weapon cost 25% less stamina.'], ['oh_blades', 'Keen Edge', 40, 0.25, 'Swords have a 25% chance to land a telling blow for extra damage.'], ['oh_savage', 'Hewing Stroke', 60, 0.25, 'Heavy swings made standing still hit 25% harder.'], ['oh_paralyze', 'Stunning Riposte', 80, 0.25, 'Heavy swings made while stepping back have a 25% chance to stun.']]);
P('twoHanded', [['th_barbarian', 'Heavy Hands', 0, 0.2, 'Two-handed weapons hit 20% harder.'], ['th_stance', 'Rooted Stance', 20, 0.25, 'Heavy swings with a two-handed weapon cost 25% less stamina.'], ['th_wounds', 'Cleaving Arc', 40, 0.25, 'Greatswords have a 25% chance to land a telling blow.'], ['th_blow', 'Earthshaker', 60, 0.25, 'Heavy swings made standing still hit 25% harder.'], ['th_warmaster', 'Sweeping Reprisal', 80, 0.25, 'Heavy swings made while stepping back have a 25% chance to stun.']]);
P('archery', [['ar_overdraw', 'Strong Pull', 0, 0.2, 'Bows hit 20% harder.'], ['ar_eagle', 'Far Sight', 20, 1, 'Aim more closely while a bow is drawn.'], ['ar_steady', 'Held Breath', 40, 0.25, 'Aiming closely with a bow slows the world by 25%.'], ['ar_power', 'Heavy Shafts', 60, 0.5, 'Arrows knock back all but the largest foes half of the time.'], ['ar_quick', 'Snap Shot', 80, 0.3, 'Bows draw 30% faster.']]);
P('block', [['bl_wall', 'Braced Guard', 0, 0.2, 'Blocking stops 20% more damage.'], ['bl_deflect', 'Turn the Shaft', 20, 1, 'Arrows striking your shield do no harm.'], ['bl_bash', 'Shield Slam', 40, 1, 'Shield bashes knock foes off balance and hit harder.'], ['bl_elemental', 'Weathered Boss', 60, 0.5, 'Blocking with a shield halves fire, frost and shock damage.'], ['bl_reflex', 'Keen Reflexes', 80, 0.3, "The world slows when you block an enemy's heavy swing."]]);
P('heavyArmor', [['ha_jugger', 'Ironclad', 0, 0.2, 'Heavy armour protects 20% more.'], ['ha_fitted', 'Matched Harness', 20, 0.25, '+25% protection when every piece you wear is heavy armour.'], ['ha_tower', 'Unmoved', 40, 0.5, '50% less staggering while wearing only heavy armour.'], ['ha_cushion', 'Padded Fall', 60, 0.5, 'Falls hurt half as much in a full set of heavy armour.'], ['ha_condition', 'Second Skin', 80, 1, 'Worn heavy armour weighs nothing and no longer slows you.']]);
P('smithing', [['smith_steel', 'Steelwright', 0, 1, 'Forge Steel and Hillforged gear, and hone it twice as well.'], ['smith_arcane', 'Runed Anvil', 20, 1, 'Improve enchanted gear; forge Deepforged gear.'], ['smith_glimmer', 'Glimmerwright', 40, 1, 'Forge Glimmer gear and hone it twice as well.'], ['smith_crystal', 'Crystalwright', 60, 1, 'Forge Crystal and Nightsteel gear and hone it twice as well.'], ['smith_wyrm', 'Wyrmwright', 80, 1, 'Forge Wyrmbone, Wyrmscale and Dreadforged gear and hone it twice as well.']]);
P('lightArmor', [['la_agile', 'Supple Leathers', 0, 0.2, 'Light armour protects 20% more.'], ['la_fit', 'Tailored', 20, 0.25, '+25% protection when every piece you wear is light armour.'], ['la_unhindered', 'Featherweight', 40, 1, 'Worn light armour weighs nothing and no longer slows you.'], ['la_wind', 'Second Wind', 60, 0.5, 'Stamina recovers 50% faster in a full set of light armour.'], ['la_deft', 'Slip Aside', 80, 0.1, '10% chance to slip a melee blow entirely in a full set of light armour.']]);
P('sneak', [['sn_stealth', 'Soft Tread', 0, 0.2, 'You are 20% harder to notice while sneaking.'], ['sn_backstab', 'Knife in the Dark', 20, 6, 'Unseen strikes with one-handed weapons do six times damage.'], ['sn_aim', "Hunter's Patience", 40, 3, 'Unseen bow shots do three times damage.'], ['sn_muffled', 'Quiet Buckles', 60, 0.5, 'Armour makes half as much noise.'], ['sn_assassin', 'Final Whisper', 80, 15, 'Unseen dagger strikes do fifteen times damage.']]);
P('lockpicking', [['lp_novice', 'Simple Wards', 0, 0.5, 'Simple and plain locks are far easier.'], ['lp_quick', 'Light Touch', 20, 1, "Working a lock never draws the owner's eye."], ['lp_adept', 'Tricky Wards', 40, 0.5, 'Tricky and stubborn locks are far easier.'], ['lp_golden', 'Treasure Nose', 60, 1, 'Find more coin in chests.'], ['lp_unbreak', 'Tempered Picks', 80, 1, 'Lockpicks never snap.']]);
P('pickpocket', [['pp_light', 'Nimble Fingers', 0, 0.2, '+20% to pick a pocket.'], ['pp_night', "Sleepwalker's Bane", 20, 0.25, '+25% to pick the pocket of a sleeper.'], ['pp_cutpurse', 'Purse-Snatcher', 40, 0.5, 'Lifting coin is 50% easier.'], ['pp_pockets', 'Hidden Linings', 60, 100, 'Carry 100 more.'], ['pp_misdirect', 'Sleight of Hand', 80, 1, 'Lift weapons a mark is wearing.']]);
P('speech', [['sp_haggle', 'Shrewd', 0, 0.1, 'Prices are 10% kinder when buying and selling.'], ['sp_allure', 'Winning Smile', 20, 0.1, 'Another 10% off with anyone who likes you.'], ['sp_merchant', 'Any Port', 40, 1, 'Sell any kind of goods to any trader.'], ['sp_investor', 'Silent Partner', 60, 500, 'Put 500 gold into a shop to grow its purse.'], ['sp_persuade', 'Silver Tongue', 80, 0.3, 'Talking people round is 30% easier.']]);
P('alchemy', [['al_alchemist', 'Steady Still', 0, 0.2, 'Potions and poisons you brew are 20% stronger.'], ['al_physician', "Healer's Measure", 20, 0.25, 'Brews that restore Health, Mana or Stamina are 25% stronger.'], ['al_benefactor', 'Kind Tincture', 40, 0.25, 'Brews with helpful effects are a further 25% stronger.'], ['al_poisoner', 'Bitter Draught', 60, 0.25, 'Poisons you brew are 25% stronger.'], ['al_purity', 'Clean Distillation', 80, 1, 'Potions lose their harmful effects, and poisons their helpful ones.']]);
P('destruction', [['de_novice', 'Spark Discipline', 0, 0.5, 'First-circle Evocation spells cost half as much.'], ['de_aug', 'Fierce Elements', 20, 0.25, 'Fire, frost and shock spells hit 25% harder.'], ['de_apprentice', 'Flame Discipline', 40, 0.5, 'Second- and third-circle Evocation spells cost half as much.'], ['de_impact', 'Concussive Casting', 60, 1, 'Most Evocation spells knock foes back when cast from both hands.'], ['de_expert', 'Storm Discipline', 80, 0.5, 'Fourth-circle Evocation spells cost half as much.']]);
P('restoration', [['re_novice', 'Gentle Hands', 0, 0.5, 'First-circle Mending spells cost half as much.'], ['re_regen', 'Deep Mending', 20, 0.5, 'Healing spells heal 50% more.'], ['re_respite', 'Breath of Life', 40, 1, 'Healing spells also restore Stamina.'], ['re_recovery', 'Wellspring', 60, 0.5, 'Mana recovers 50% faster.'], ['re_ward', 'Drinking Ward', 80, 1, 'Wards turn the spells they stop into Mana.']]);
P('alteration', [['alt_novice', 'First Shapes', 0, 0.5, 'First-circle Shaping spells cost half as much.'], ['alt_armor', 'Unarmoured Grace', 20, 2, 'Skin-hardening spells protect twice as much when you wear no armour.'], ['alt_resist', 'Spellbreaker', 40, 0.3, 'Shrug off 30% of every hostile spell.'], ['alt_stability', 'Lasting Forms', 60, 0.5, 'Shaping spells last longer.'], ['alt_absorb', 'Mana Sponge', 80, 0.3, 'Soak up 30% of the Mana of spells that strike you.']]);
P('conjuration', [['co_novice', 'First Calling', 0, 0.5, 'First-circle Summoning spells cost half as much.'], ['co_summoner', 'Far Calling', 20, 2, 'Summon twice as far away.'], ['co_mystic', 'Spectral Edge', 40, 1, 'Spectral weapons hit harder.'], ['co_potency', 'Strong Bonds', 60, 0.5, 'Called golems are 50% stronger.'], ['co_twin', 'Twin Bonds', 80, 2, 'Keep two summoned allies at once.']]);
P('illusion', [['il_novice', 'First Veils', 0, 0.5, 'First-circle Glamour spells cost half as much.'], ['il_animage', 'Beast Whisperer', 20, 8, 'Glamour spells sway stronger beasts.'], ['il_kindred', 'Crowd Charmer', 40, 8, 'Glamour spells sway stronger people.'], ['il_quiet', 'Silent Gestures', 60, 1, 'Every spell you cast makes no sound.'], ['il_master', 'Will of Iron', 80, 1, 'Glamour spells sway the undead and automatons.']]);
P('enchanting', [['en_enchanter', 'Runecarver', 0, 0.2, 'New enchantments are 20% stronger.'], ['en_fire', 'Storm Runes', 20, 0.25, 'Fire, frost and shock enchantments are 25% stronger.'], ['en_insight', 'Craft Runes', 40, 0.25, 'Skill enchantments on armour are 25% stronger.'], ['en_soul', 'Rich Essence', 60, 1, 'Essences recharge enchanted weapons far more.'], ['en_extra', 'Twin Runes', 80, 1, 'Put two enchantments on one item.']]);
export const PERK_IDS = Object.keys(PERKS);

// ------------------------------------------------------------------ kin
export const KIN = {
    norrhen: { name: 'Norrhen', desc: 'Fjord-folk of the north, raised on salt wind and long winters. Icy water cannot hurt them.', bonus: { twoHanded: 8, archery: 6, block: 6, smithing: 6, sneak: 4 }, resist: { frost: 35 }, coldblood: true, skin: [0.92, 0.8, 0.72] },
    caldaran: { name: 'Caldaran', desc: 'River-city traders from the warm south: polyglots, clerks and caravan guards. Merchants give them better prices.', bonus: { speech: 10, oneHanded: 6, restoration: 6, alchemy: 5, lockpicking: 5 }, barter: 0.1, skin: [0.82, 0.66, 0.52] },
    aelfen: { name: 'Aelfen', desc: 'Long-lived elves of the high western forests, keepers of star-lore.', bonus: { conjuration: 8, enchanting: 8, illusion: 6, alteration: 6, alchemy: 4 }, mana: 30, skin: [0.92, 0.84, 0.58], ears: true },
    vael: { name: 'Vael', desc: 'Small, quick hill-elves of the southern woods who live by snare and bow.', bonus: { archery: 8, sneak: 8, lightArmor: 6, alchemy: 6, pickpocket: 4 }, resist: { poison: 30 }, skin: [0.66, 0.5, 0.36], ears: true },
    ashen: { name: 'Ashen', desc: 'Ash-grey elves from the volcanic east, at home among embers and forges.', bonus: { destruction: 8, smithing: 6, lightArmor: 6, sneak: 6, oneHanded: 4 }, resist: { fire: 35 }, skin: [0.5, 0.55, 0.6], ears: true, eyes: [0.9, 0.15, 0.1] },
    orsk: { name: 'Orsk', desc: 'Broad, tusked mountain folk, famed as miners and wrestlers. Tougher than they look, and they look tough.', bonus: { heavyArmor: 8, smithing: 8, block: 6, twoHanded: 6, oneHanded: 2 }, health: 20, melee: 0.05, skin: [0.45, 0.58, 0.38], tusks: true },
};

// ------------------------------------------------------------------ the character sheet
export function makeSheet(kin = 'norrhen') {
    const skills = {}, xp = {};
    for (const s of SKILL_IDS) { skills[s] = 15 + (KIN[kin].bonus[s] || 0); xp[s] = 0; }
    return {
        kin, level: 1, xp: 0, perkPoints: 0, perks: {}, skills, skillXp: xp,
        attr: { hp: 100 + (KIN[kin].health || 0), mp: 100 + (KIN[kin].mana || 0), sp: 100 }, carryBonus: 0,
        pendingLevels: 0, totem: null, rested: 0, treeXp: { warrior: 0, thief: 0, mage: 0 }, trainedThisLevel: 0,
    };
}

export function hasPerk(sheet, id) { return !!sheet.perks[id]; }
export function perkVal(sheet, id) { return sheet.perks[id] ? PERKS[id].val : 0; }

export function canTakePerk(sheet, id) {
    const p = PERKS[id];
    if (!p || sheet.perks[id] || sheet.perkPoints < 1) return false;
    if (sheet.skills[p.skill] < p.req) return false;
    return !p.prev || !!sheet.perks[p.prev];
}

export function takePerk(sheet, id) {
    if (!canTakePerk(sheet, id)) return false;
    sheet.perks[id] = true;
    sheet.perkPoints--;
    return true;
}

/**
 * Award skill XP; returns a list of events { kind: 'skill', skill, level } / { kind: 'level', level }.
 * `amount` is in raw use units; the skill's multiplier, the Raven Totem and being Refreshed apply.
 */
export function addSkillXp(sheet, skill, amount) {
    const out = [];
    if (!SKILLS[skill] || sheet.skills[skill] >= 100) return out;
    let mult = SKILLS[skill].mult * XP_SCALE;
    if (sheet.totem && TOTEMS[sheet.totem]?.all) mult *= 1 + TOTEMS[sheet.totem].all;
    if (sheet.rested > 0) mult *= 1.1;
    sheet.skillXp[skill] += amount * mult;
    while (sheet.skills[skill] < 100 && sheet.skillXp[skill] >= xpToNext(sheet.skills[skill])) {
        sheet.skillXp[skill] -= xpToNext(sheet.skills[skill]);
        sheet.skills[skill]++;
        if (sheet.treeXp) sheet.treeXp[SKILLS[skill].tree] += 1;
        out.push({ kind: 'skill', skill, level: sheet.skills[skill] });
        out.push(...addCharXp(sheet, 10 + sheet.skills[skill] * 0.5));
    }
    return out;
}

export function addCharXp(sheet, amount) {
    const out = [];
    sheet.xp += amount;
    while (sheet.xp >= charXpToNext(sheet.level)) {
        sheet.xp -= charXpToNext(sheet.level);
        sheet.level++;
        sheet.perkPoints++;
        sheet.pendingLevels++;
        sheet.trainedThisLevel = 0;
        out.push({ kind: 'level', level: sheet.level });
    }
    return out;
}

/**
 * Growth on level-up is automatic and follows how you played: +8 to the pool of the path you
 * raised most since the last level (warrior → Health, thief → Stamina, mage → Mana), +4 to the
 * other two, and +5 carry weight. Returns the pool that grew most.
 */
export function growAttributes(sheet) {
    if (sheet.pendingLevels < 1) return null;
    const t = sheet.treeXp || { warrior: 1, thief: 0, mage: 0 };
    const top = Object.entries(t).sort((x, y) => y[1] - x[1])[0][0];
    const main = { warrior: 'hp', thief: 'sp', mage: 'mp' }[top];
    for (const k of ['hp', 'mp', 'sp']) sheet.attr[k] += k === main ? 8 : 4;
    sheet.carryBonus += 5;
    sheet.treeXp = { warrior: 0, thief: 0, mage: 0 };
    sheet.pendingLevels--;
    return main;
}

/** Carved spirit totems in the wilds: touch one to take its blessing (one at a time). */
export const TOTEMS = {
    bear:  { name: 'The Bear Totem',  desc: '+25 Health and melee strikes hit 10% harder.', hp: 25, melee: 0.1 },
    owl:   { name: 'The Owl Totem',   desc: '+40 Mana and spells cost 5% less.', mp: 40, spellCost: 0.05 },
    fox:   { name: 'The Fox Totem',   desc: 'You are 15% harder to detect; locks and pockets yield more easily.', stealth: 0.15 },
    elk:   { name: 'The Elk Totem',   desc: 'Stamina recovers 25% faster and you move 5% quicker.', spRegen: 0.25, speed: 0.05 },
    raven: { name: 'The Raven Totem', desc: 'Every skill improves 10% faster.', all: 0.1 },
    ox:    { name: 'The Ox Totem',    desc: 'Carry weight +100.', carry: 100 },
};
