/**
 * items.js — equipment bases, affixes, rarities, the nine Warden relics,
 * consumables and loot rolls. Items are plain objects:
 *   { id, b: base, k: kind, r: rarity, il: item level, name, aff: {key: value},
 *     dmg, arm, eva, acc, crit, range, n: stack, val: gold value }
 */

export const RARITY = ['Common', 'Magic', 'Rare', 'Relic'];

export const BASES = {
    // weapons — kind 'weapon', style melee/ranged/magic
    dagger:     { k: 'weapon', s: 'melee', n: 'Dagger', dmg: [2, 4], acc: 10, crit: 9 },
    sword:      { k: 'weapon', s: 'melee', n: 'Sword', dmg: [3, 6], acc: 5, crit: 5 },
    axe:        { k: 'weapon', s: 'melee', n: 'Axe', dmg: [3, 8], acc: 0, crit: 6 },
    mace:       { k: 'weapon', s: 'melee', n: 'Mace', dmg: [4, 7], acc: -2, crit: 3, stun: 0.1 },
    spear:      { k: 'weapon', s: 'melee', n: 'Spear', dmg: [3, 7], acc: 8, crit: 4 },
    greatsword: { k: 'weapon', s: 'melee', n: 'Greatsword', dmg: [5, 10], acc: -4, crit: 5 },
    bow:        { k: 'weapon', s: 'ranged', n: 'Shortbow', dmg: [2, 5], acc: 6, crit: 6, range: 6 },
    crossbow:   { k: 'weapon', s: 'ranged', n: 'Crossbow', dmg: [4, 7], acc: 4, crit: 4, range: 7 },
    staff:      { k: 'weapon', s: 'magic', n: 'Ember Staff', dmg: [2, 5], acc: 8, crit: 4, range: 5, spell: 10 },
    // armour
    robe:    { k: 'armor', n: 'Robe', arm: 1, eva: 3, spell: 10 },
    leather: { k: 'armor', n: 'Leather Jerkin', arm: 2, eva: 1 },
    chain:   { k: 'armor', n: 'Chain Shirt', arm: 4, eva: -2 },
    plate:   { k: 'armor', n: 'Plate Harness', arm: 6, eva: -5 },
    // trinkets
    ring:    { k: 'ring', n: 'Ring' },
    amulet:  { k: 'amulet', n: 'Amulet' },
};

export const CONSUMABLES = {
    heal:    { k: 'potion', n: 'Healing Draught', d: 'Restores 40% of your health.', val: 25, col: 0xff4a5a },
    heal2:   { k: 'potion', n: 'Greater Healing', d: 'Restores 75% of your health and cures bleeding.', val: 60, col: 0xff2a8a },
    oil:     { k: 'potion', n: 'Oil Flask', d: 'Refills your lantern by 40.', val: 20, col: 0xffc040 },
    antidote:{ k: 'potion', n: 'Antidote', d: 'Cures poison, burning, bleeding and weakness.', val: 20, col: 0x6aff8a },
    haste:   { k: 'potion', n: 'Quicksilver', d: 'Haste for 12 turns: you act twice as fast.', val: 45, col: 0x6ad0ff },
    might:   { k: 'potion', n: 'Tonic of Might', d: 'Permanently +1 Might, Agility or Will (your best).', val: 120, col: 0xffa040 },
    mapping: { k: 'scroll', n: 'Scroll of Mapping', d: 'Reveals the layout of this floor.', val: 35, col: 0xe8d8a0 },
    teleport:{ k: 'scroll', n: 'Scroll of Teleport', d: 'Whisks you to a random place on this floor.', val: 30, col: 0xb080ff },
    warding: { k: 'scroll', n: 'Scroll of Warding', d: 'A shield that halves damage for 8 turns.', val: 40, col: 0x80d0ff },
    firebomb:{ k: 'bomb', n: 'Fire Bomb', d: 'Throw: a 3×3 burst of flame.', val: 35, col: 0xff6020, throwable: true },
    frostbomb:{ k: 'bomb', n: 'Frost Bomb', d: 'Throw: freezes everything in a 3×3 burst.', val: 35, col: 0x80e0ff, throwable: true },
    key:     { k: 'key', n: 'Vault Key', d: 'Opens this floor\'s sealed vault.', val: 0, col: 0xffd040 },
    page:    { k: 'page', n: 'Journal Page', d: 'A page of Maren\'s journal.', val: 0, col: 0xf0e0c0 },
    heirloom:{ k: 'heirloom', n: 'Heirloom', d: 'Someone on this floor is looking for this.', val: 0, col: 0xffd8a0 },
};

/**
 * Affixes. v(il, rng) rolls a value; slots lists where it can appear;
 * pre/suf name a Magic item; fmt formats it for the item card.
 */
const AF = {};
const af = (k, slots, v, pre, suf, fmt) => { AF[k] = { k, slots, v, pre, suf, fmt }; };
const W = ['weapon'], A = ['armor'], J = ['ring', 'amulet'], WA = ['weapon', 'armor'], AJ = ['armor', 'ring', 'amulet'], ANY = ['weapon', 'armor', 'ring', 'amulet'];
af('dmg', ['weapon', 'ring'], (il, r) => r.int(10, 22) + Math.floor(il * 0.2), 'Keen', 'of Slaying', (v) => `+${v}% damage`);
af('acc', ANY, (il, r) => r.int(3, 7) + Math.floor(il * 0.12), 'True', 'of Aim', (v) => `+${v} accuracy`);
af('crit', ['weapon', 'ring', 'amulet'], (il, r) => r.int(3, 7) + Math.floor(il * 0.03), 'Vicious', 'of Ruin', (v) => `+${v}% critical chance`);
af('steal', ['weapon', 'ring'], (il, r) => r.int(3, 7), 'Thirsting', 'of the Leech', (v) => `${v}% of damage dealt heals you`);
af('burn', W, (il, r) => r.int(15, 25), 'Burning', 'of Embers', (v) => `${v}% chance to burn`);
af('freeze', W, (il, r) => r.int(8, 14), 'Frozen', 'of Rime', (v) => `${v}% chance to freeze`);
af('poison', W, (il, r) => r.int(18, 30), 'Venomous', 'of the Adder', (v) => `${v}% chance to poison`);
af('hp', AJ, (il, r) => r.int(5, 10) + Math.floor(il * 0.9), 'Hale', 'of the Bear', (v) => `+${v} max health`);
af('arm', ['armor', 'amulet'], (il, r) => r.int(1, 2) + Math.floor(il * 0.12), 'Sturdy', 'of the Turtle', (v) => `+${v} armour`);
af('eva', AJ, (il, r) => r.int(3, 6) + Math.floor(il * 0.08), 'Nimble', 'of the Fox', (v) => `+${v} evasion`);
af('regen', AJ, (il, r) => r.int(1, 2) + Math.floor(il * 0.04), 'Mending', 'of Renewal', (v) => `+${v} health every 10 turns`);
af('light', ['amulet', 'ring', 'armor'], () => 1, 'Gleaming', 'of the Lamp', (v) => `+${v} light radius`);
af('oil', J, (il, r) => r.int(15, 30), 'Thrifty', 'of the Wick', (v) => `lantern burns ${v}% slower`);
af('spell', ['weapon', 'ring', 'amulet'], (il, r) => r.int(10, 22) + Math.floor(il * 0.15), 'Arcane', 'of Sorcery', (v) => `+${v}% spell power`);
af('cdr', ['ring', 'amulet'], () => 1, 'Hasty', 'of Swiftness', (v) => `skill cooldowns −${v}`);
af('thorns', A, (il, r) => r.int(10, 25), 'Spiked', 'of Thorns', (v) => `${v}% of melee damage reflected`);
af('gold', J, (il, r) => r.int(20, 50), 'Gilded', 'of Greed', (v) => `+${v}% gold found`);
af('rFire', AJ, (il, r) => r.int(20, 40), 'Fireproof', 'of the Salamander', (v) => `${v}% fire resistance`);
af('rCold', AJ, (il, r) => r.int(20, 40), 'Furred', 'of Winter', (v) => `${v}% cold resistance`);
af('rPoison', AJ, (il, r) => r.int(20, 40), 'Purifying', 'of the Antidote', (v) => `${v}% poison resistance`);
af('xp', J, (il, r) => r.int(8, 18), 'Wise', 'of Learning', (v) => `+${v}% experience`);
af('might', ANY, (il, r) => r.int(1, 2) + Math.floor(il * 0.04), 'Mighty', 'of Strength', (v) => `+${v} Might`);
af('agi', ANY, (il, r) => r.int(1, 2) + Math.floor(il * 0.04), 'Deft', 'of Grace', (v) => `+${v} Agility`);
af('will', ANY, (il, r) => r.int(1, 2) + Math.floor(il * 0.04), 'Wilful', 'of the Mind', (v) => `+${v} Will`);
export const AFFIXES = AF;

export const describeAffix = (k, v) => (AF[k] ? AF[k].fmt(v) : `${k} ${v}`);

/** The relic each Warden drops (world 1–9). Stats scale with the floor it drops on. */
export const RELICS = {
    1: { b: 'ring', name: 'Signet of the Rat King', aff: (il) => ({ crit: 8, gold: 60, agi: 2 + (il >> 4) }), lore: 'A ring of a hundred tiny teeth. It bites, a little, when you find gold.' },
    2: { b: 'amulet', name: 'Mycel\'s Heartcap', aff: (il) => ({ regen: 3 + (il >> 3), rPoison: 60, hp: 12 + il }), lore: 'Still soft. Still growing. It mends whatever it touches.' },
    3: { b: 'amulet', name: 'The Archivist\'s Monocle', aff: (il) => ({ xp: 25, acc: 10 + (il >> 2), light: 1 }), lore: 'Through it, everything is a little better lit and a little better labelled.' },
    4: { b: 'plate', name: 'Brann\'s Bellows Plate', aff: (il) => ({ arm: 4 + (il >> 3), rFire: 60, thorns: 25 }), lore: 'Tempered in the Lantern\'s heat. It is warm on the inside, like a hearth.' },
    5: { b: 'ring', name: 'Prism Heart', aff: (il) => ({ dmg: 25 + (il >> 2), spell: 25 + (il >> 2), light: 1 }), lore: 'Every colour the Wyrm ever stole, folded into a stone the size of a thumbnail.' },
    6: { b: 'amulet', name: 'Vesper\'s Requiem', aff: (il) => ({ steal: 8, hp: 20 + il, will: 3 }), lore: 'A locket that hums a song with every name in the Ossuary in it. Yours is not in it yet.' },
    7: { b: 'ring', name: 'Orrery Escapement', aff: (il) => ({ cdr: 2, eva: 8 + (il >> 3), agi: 3 }), lore: 'It ticks a little faster than the world does. So do you.' },
    8: { b: 'leather', name: 'Rimeveil Mantle', aff: (il) => ({ eva: 12 + (il >> 3), rCold: 70, hp: 25 + il }), lore: 'Isolde\'s mantle. The cold slides off it, and off you.' },
    9: { b: 'amulet', name: 'Lens of the Watcher', aff: (il) => ({ crit: 12, acc: 14 + (il >> 2), light: 2 }), lore: 'You see a little further than you should. You try not to look down.' },
};

export const itemScale = (il) => 1 + 0.11 * (il - 1);
export const armScale = (il) => 1 + 0.065 * (il - 1);

const RARE_A = ['Dusk', 'Grim', 'Hollow', 'Ember', 'Gloam', 'Wyrm', 'Rime', 'Star', 'Bone', 'Thorn', 'Soot', 'Lantern', 'Ash', 'Night', 'Glass', 'Iron'];
const RARE_B = ['bane', 'fang', 'song', 'heart', 'wake', 'brand', 'ward', 'kiss', 'shard', 'bite', 'hymn', 'veil', 'spark', 'reaver', 'keeper', 'call'];

/** Make a piece of equipment of base `b` at item level `il` and rarity `r`. */
export function makeGear(run, rng, b, il, r) {
    const base = BASES[b];
    const it = { id: run.nextId++, b, k: base.k, r, il, aff: {}, n: 1 };
    const sc = itemScale(il);
    if (base.dmg) {
        it.dmg = [Math.max(1, Math.round(base.dmg[0] * sc)), Math.max(2, Math.round(base.dmg[1] * sc))];
        it.acc = base.acc; it.crit = base.crit;
        if (base.range) it.range = base.range;
        if (base.spell) it.spell = base.spell;
        it.style = base.s;
    }
    if (base.arm !== undefined) { it.arm = Math.max(1, Math.round(base.arm * armScale(il))); it.eva = base.eva; if (base.spell) it.spell = base.spell; }
    const n = r === 0 ? 0 : r === 1 ? 1 : rng.int(2, 3);
    const pool = Object.values(AF).filter((a) => a.slots.includes(base.k));
    rng.shuffle(pool);
    for (let i = 0; i < n && i < pool.length; i++) it.aff[pool[i].k] = pool[i].v(il, rng);
    // A trinket without an affix is useless: rings and amulets are at least Magic.
    if ((base.k === 'ring' || base.k === 'amulet') && n === 0) { it.r = 1; const a = pool[0]; it.aff[a.k] = a.v(il, rng); }
    it.name = gearName(it, rng);
    it.val = Math.round((12 + il * 3) * (1 + it.r * 1.6));
    return it;
}

function gearName(it, rng) {
    const base = BASES[it.b];
    if (it.r === 0) return base.n;
    const keys = Object.keys(it.aff);
    if (it.r === 1) {
        const a = AF[keys[0]];
        return rng.chance(0.5) ? `${a.pre} ${base.n}` : `${base.n} ${a.suf}`;
    }
    return `${rng.pick(RARE_A)}${rng.pick(RARE_B)} ${base.n}`;
}

export function makeRelic(run, world, il) {
    const R = RELICS[world];
    const it = makeGear(run, { int: (a) => a, pick: (a) => a[0], chance: () => false, shuffle: (a) => a }, R.b, il, 0);
    it.r = 3; it.relic = world; it.name = R.name; it.aff = R.aff(il); it.lore = R.lore;
    it.val = 400 + il * 10;
    return it;
}

export function makeConsumable(run, c, n = 1) {
    const C = CONSUMABLES[c];
    return { id: run.nextId++, b: c, k: C.k, r: 0, il: 1, name: C.n, n, val: C.val, aff: {} };
}

// ------------------------------------------------------------------ Loot

const GEAR_WEIGHTS = { dagger: 3, sword: 4, axe: 3, mace: 3, spear: 3, greatsword: 2, bow: 3, crossbow: 2, staff: 3, robe: 3, leather: 4, chain: 3, plate: 2, ring: 4, amulet: 3 };
const CONS_WEIGHTS = { heal: 10, oil: 9, antidote: 3, heal2: 2, haste: 2, might: 0.6, mapping: 2.5, teleport: 2, warding: 2, firebomb: 2.5, frostbomb: 2 };

export function rollRarity(rng, floor, bonus = 0) {
    const r = rng.next();
    const rare = 0.06 + floor * 0.0015 + bonus * 0.1;
    const magic = 0.3 + floor * 0.002 + bonus * 0.2;
    if (r < rare) return 2;
    if (r < rare + magic) return 1;
    return 0;
}

/** A random item for a floor. `kind`: 'gear' | 'cons' | undefined (either). Class-biased towards usable weapons. */
export function rollItem(run, rng, floor, kind, bonus = 0) {
    if (kind === 'cons' || (kind === undefined && rng.chance(0.62))) {
        const c = rng.weighted(CONS_WEIGHTS);
        return makeConsumable(run, c, 1);
    }
    const w = { ...GEAR_WEIGHTS };
    // Lean towards the hero's weapon style so drops are worth picking up.
    const style = run.p ? run.p.cls : null;
    if (style === 'ranger') { w.bow += 5; w.crossbow += 3; }
    if (style === 'witch') { w.staff += 7; w.robe += 3; }
    if (style === 'warden') { w.sword += 2; w.axe += 2; w.mace += 2; w.greatsword += 2; }
    const b = rng.weighted(w);
    const il = Math.max(1, floor + rng.int(-1, 2));
    return makeGear(run, rng, b, il, rollRarity(rng, floor, bonus));
}

export const isGear = (it) => it.k === 'weapon' || it.k === 'armor' || it.k === 'ring' || it.k === 'amulet';
export const stackable = (it) => !isGear(it) && it.k !== 'heirloom' && it.k !== 'page';

/** Lines describing an item for its card. */
export function describeItem(it) {
    const out = [];
    if (CONSUMABLES[it.b]) { out.push(CONSUMABLES[it.b].d); return out; }
    if (it.dmg) {
        out.push(`Damage ${it.dmg[0]}–${it.dmg[1]}` + (it.range ? ` · range ${it.range}` : ' · melee'));
        if (it.acc) out.push(`${it.acc > 0 ? '+' : ''}${it.acc} accuracy · ${it.crit}% crit`);
        if (it.spell) out.push(`+${it.spell}% spell power`);
        if (BASES[it.b].stun) out.push('10% chance to stun');
    }
    if (it.arm !== undefined && it.k === 'armor') {
        out.push(`Armour ${it.arm}` + (it.eva ? ` · ${it.eva > 0 ? '+' : ''}${it.eva} evasion` : ''));
        if (it.spell) out.push(`+${it.spell}% spell power`);
    }
    for (const k in it.aff) out.push(describeAffix(k, it.aff[k]));
    if (it.lore) out.push(`“${it.lore}”`);
    return out;
}
