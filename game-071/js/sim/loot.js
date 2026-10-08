/**
 * loot.js — levelled lists for creatures, corpses and containers.
 */
import { ITEMS, WEAPON_MATERIALS, WEAPON_TYPES, ARMOR_SETS, SLOTS } from './items.js';
import { ENCHANTS, ENCH_BASE, enchName } from './magic.js';

const INGREDIENTS = Object.values(ITEMS).filter((d) => d.type === 'ingredient' && d.kind !== 'mineral' || d.id === 'salt').map((d) => d.id);
const RARE_ING = ['rime_crystals', 'ember_ash', 'night_dust', 'ghost_dust'];

function materialFor(level, rng, list = WEAPON_MATERIALS) {
    const ok = list.filter((m) => m.lvl <= level);
    if (rng.chance(0.1)) { const next = list.find((m) => m.lvl > level); if (next && next.lvl <= level + 6) return next; }
    // favour the newest materials but keep older ones around
    const i = Math.max(0, ok.length - 1 - Math.floor(Math.pow(rng.next(), 1.8) * ok.length));
    return ok[i];
}

export function lvlWeapon(level, rng) {
    const m = materialFor(level, rng);
    const t = rng.pick(Object.keys(WEAPON_TYPES));
    return { id: `${m.id}_${t}`, n: 1 };
}

export function lvlArmor(level, rng) {
    const sets = ARMOR_SETS.filter((s) => s.lvl <= level + (rng.chance(0.1) ? 6 : 0));
    const s = sets.length ? sets[Math.max(0, sets.length - 1 - Math.floor(Math.pow(rng.next(), 1.6) * sets.length))] : ARMOR_SETS[0];
    const slots = SLOTS.filter((k, i) => s.rating[i]);
    return { id: `${s.id}_${rng.pick(slots)}`, n: 1 };
}

/** Maybe give an item a random enchantment appropriate to its slot and the level. */
export function maybeEnchant(entry, level, rng, chance) {
    const d = ITEMS[entry.id];
    if (!d || d.unique || d.ench || !rng.chance(chance)) return entry;
    let pool;
    if (d.type === 'weapon' && !d.bow && d.wtype !== 'staff') pool = ENCHANTS.weapon;
    else if (d.type === 'weapon' && d.bow) pool = ['fireDamage', 'frostDamage', 'shockDamage', 'absorbStamina'];
    else if (d.type === 'armor' || d.type === 'jewelry') pool = ENCHANTS.armor[d.slot] || ENCHANTS.armor.body;
    if (!pool) return entry;
    const id = rng.pick(pool);
    const base = ENCH_BASE[id] || 15;
    const tier = Math.min(3, Math.floor(level / 10 + rng.next()));
    const mag = Math.round(base * (0.45 + tier * 0.3));
    const ench = { id, mag, dur: id === 'paralysis' ? 2 : id === 'turnUndead' || id === 'fear' ? 15 : 0 };
    const e = { ...entry, ench, name: enchName(d.name, ench) };
    if (d.type === 'weapon') e.charge = 1000;
    return e;
}

export function lvlPotion(level, rng) {
    const k = Math.min(3, Math.floor(level / 10 + rng.next() * 1.2));
    const kinds = ['restoreHealth', 'restoreHealth', 'restoreMana', 'restoreStamina'];
    if (rng.chance(0.15)) return { id: rng.pick(['potion_resistFire', 'potion_resistFrost', 'potion_fortifyHealth', 'potion_invis', 'poison_weak', 'potion_resistShock']), n: 1 };
    return { id: `potion_${rng.pick(kinds)}_${k}`, n: 1 };
}

export function lvlEssence(level, rng) {
    const opts = ['petty', 'petty', 'lesser', 'lesser', 'common', 'greater', 'grand'].filter((_, i) => i <= 2 + Math.floor(level / 6));
    return { id: `essence_${rng.pick(opts)}`, n: 1 };
}

const gold = (rng, a, b) => ({ id: 'gold', n: rng.int(a, b) });

const CREATURE = {
    wolf: (L, r) => [{ id: 'pelt_wolf', n: 1 }, r.chance(0.5) && { id: 'wolf_tooth', n: 1 }],
    icewolf: (L, r) => [{ id: 'pelt_icewolf', n: 1 }, r.chance(0.5) && { id: 'wolf_tooth', n: 1 }],
    bear: (L, r) => [{ id: 'pelt_bear', n: 1 }, { id: 'bear_claws', n: r.int(1, 2) }],
    snowbear: (L, r) => [{ id: 'pelt_snowbear', n: 1 }, { id: 'bear_claws', n: r.int(1, 2) }],
    fangcat: (L, r) => [{ id: 'pelt_fangcat', n: 1 }, r.chance(0.5) && { id: 'wolf_tooth', n: 1 }],
    giantrat: () => [{ id: 'rat_tail', n: 1 }],
    mudclaw: (L, r) => [{ id: 'mudclaw_shell', n: r.int(1, 2) }],
    spider: (L, r) => [{ id: 'spider_egg', n: r.int(1, 2) }],
    troll: () => [{ id: 'troll_grease', n: 1 }],
    giant: (L, r) => [{ id: 'giant_knuckle', n: 1 }, gold(r, 50, 200)],
    mammoth: (L, r) => [{ id: 'venison', n: 2 }],
    deer: (L, r) => [{ id: 'pelt_deer', n: 1 }, { id: 'venison', n: 1 }],
    fox: () => [{ id: 'pelt_fox', n: 1 }],
    goat: () => [{ id: 'pelt_goat', n: 1 }, { id: 'venison', n: 1 }],
    cow: () => [{ id: 'venison', n: 2 }],
    walrus: () => [{ id: 'walrus', n: 2 }],
    wight: (L, r) => [gold(r, 2, 15 + L * 2), r.chance(0.3) && { id: r.pick(INGREDIENTS), n: 1 }, r.chance(0.08) && lvlEssence(L, r)],
    wight_boss: (L, r) => [gold(r, 40, 80 + L * 6), maybeEnchant(lvlWeapon(L, r), L, r, 0.6), r.chance(0.5) && lvlEssence(L, r), lvlPotion(L, r)],
    skeleton: (L, r) => [{ id: 'bone_meal', n: r.int(1, 2) }],
    bandit: (L, r) => [gold(r, 5, 20 + L * 3), r.chance(0.35) && lvlPotion(L, r), r.chance(0.3) && { id: 'lockpick', n: r.int(1, 3) }, r.chance(0.15) && { id: r.pick(['bread', 'cheese', 'ale', 'apple']), n: 1 }],
    chief: (L, r) => [gold(r, 40, 100 + L * 8), lvlPotion(L, r), maybeEnchant(lvlArmor(L, r), L, r, 0.35), r.chance(0.4) && { id: 'gem_' + r.pick(['garnet', 'amethyst', 'ruby']), n: 1 }],
    mage: (L, r) => [gold(r, 10, 40 + L * 3), lvlPotion(L, r), r.chance(0.3) && lvlEssence(L, r), r.chance(0.2) && { id: `tome_${r.pick(['firebolt', 'icespike', 'barkskin', 'spiritwolf', 'calm', 'healing'])}`, n: 1 }],
    soldier: (L, r) => [gold(r, 3, 15), r.chance(0.3) && lvlPotion(L, r)],
    citizen: (L, r) => [gold(r, 1, 12), r.chance(0.3) && { id: r.pick(['apple', 'bread', 'cabbage', 'leek', 'tankard']), n: 1 }],
    gloom: (L, r) => [r.chance(0.6) && { id: r.pick(['glowcap', 'palecap', 'trollcap', 'scorchcap', 'bogbean']), n: r.int(1, 2) }, gold(r, 0, 10)],
    automaton: (L, r) => [{ id: 'ingot_deep', n: r.int(1, 2) }, r.chance(0.3) && lvlEssence(L, r)],
    colossus: (L, r) => [{ id: 'ingot_deep', n: 5 }, { id: 'essence_great', n: 1 }, gold(r, 200, 400)],
    priest: (L, r) => [{ id: 'hierophant_crown', n: 1 }, { id: 'staff_frost', n: 1 }, gold(r, 300, 500), { id: 'essence_great', n: 1 }],
    dragon: (L, r) => [{ id: 'dragon_bone', n: r.int(1, 2) }, { id: 'dragon_scale', n: r.int(1, 2) }, gold(r, 100, 300 + L * 10), r.chance(0.5) && { id: 'gem_' + r.pick(['sapphire', 'emerald', 'diamond', 'ruby']), n: 1 }],
};

const CONTAINER = {
    barrel: (L, r) => [r.chance(0.5) && { id: r.pick(['apple', 'cabbage', 'carrot', 'potato', 'leek', 'salmon', 'ale', 'mead', 'wheat', 'salt']), n: r.int(1, 3) }],
    sack: (L, r) => [r.chance(0.6) && { id: r.pick(['wheat', 'potato', 'salt', 'garlic', 'lavender', 'bread']), n: r.int(1, 3) }],
    urn: (L, r) => [r.chance(0.7) && gold(r, 3, 25 + L * 2), r.chance(0.3) && { id: r.pick(INGREDIENTS), n: 1 }, r.chance(0.05) && { id: 'gem_' + r.pick(['garnet', 'amethyst']), n: 1 }, r.chance(0.08) && lvlEssence(L, r)],
    chest: (L, r) => [gold(r, 10, 40 + L * 4), r.chance(0.6) && lvlPotion(L, r), r.chance(0.35) && maybeEnchant(r.chance(0.5) ? lvlWeapon(L, r) : lvlArmor(L, r), L, r, 0.25), r.chance(0.2) && lvlEssence(L, r), r.chance(0.25) && { id: 'lockpick', n: r.int(1, 4) }],
    boss: (L, r) => [gold(r, 80, 150 + L * 10), lvlPotion(L, r), lvlPotion(L, r), maybeEnchant(r.chance(0.5) ? lvlWeapon(L, r) : lvlArmor(L, r), L, r, 0.7), r.chance(0.5) && { id: 'gem_' + r.pick(['ruby', 'sapphire', 'emerald', 'diamond', 'amethyst']), n: 1 }, lvlEssence(L, r), r.chance(0.3) && { id: `tome_${r.pick(['firebolt', 'icespike', 'lightning', 'quickmending', 'stoneskin', 'embergolem', 'rage', 'hush'])}`, n: 1 }, r.chance(0.4) && { id: r.pick(RARE_ING), n: 1 }],
    satchel: (L, r) => [gold(r, 5, 25), r.chance(0.4) && lvlPotion(L, r), r.chance(0.3) && { id: r.pick(INGREDIENTS), n: r.int(1, 2) }],
    wardrobe: (L, r) => [r.chance(0.6) && { id: r.pick(['tunic', 'fine', 'shoes', 'boots_fur', 'hood', 'robe']), n: 1 }],
    shelf: (L, r) => [r.chance(0.4) && { id: r.pick(['tankard', 'plate', 'bowl', 'goblet', 'candlestick']), n: 1 }, r.chance(0.2) && { id: r.pick(INGREDIENTS), n: 1 }],
    ore_iron: () => [{ id: 'ore_iron', n: 1 }], ore_silver: () => [{ id: 'ore_silver', n: 1 }], ore_copper: () => [{ id: 'ore_copper', n: 1 }], ore_nightiron: () => [{ id: 'ore_nightiron', n: 1 }], ore_glimmer: () => [{ id: 'ore_glimmer', n: 1 }], ore_verdite: () => [{ id: 'ore_verdite', n: 1 }],
};

export function rollLoot(table, level, rng) {
    const f = CREATURE[table] || CONTAINER[table];
    if (!f) return [];
    return f(level, rng).filter(Boolean).filter((e) => e.n > 0 && ITEMS[e.id]);
}

export const LOOT_TABLES = [...Object.keys(CREATURE), ...Object.keys(CONTAINER)];
