// Items, materials, equipment and shop stock. Equipment is generated from tier tables, so a new tier is one line.

export const TIERS = 6;

const I = (id, name, o) => ({ id, name, type: 'item', price: 0, desc: '', ...o });

const CONS = [
    I('potion', 'Potion', { price: 30, use: { hp: 90 }, tgt: 'ally', desc: 'Restores 90 HP.' }),
    I('hiPotion', 'Hi-Potion', { price: 130, use: { hp: 320 }, tgt: 'ally', desc: 'Restores 320 HP.' }),
    I('xPotion', 'X-Potion', { price: 520, use: { hp: 900 }, tgt: 'ally', desc: 'Restores 900 HP.' }),
    I('ether', 'Ether', { price: 150, use: { mp: 35 }, tgt: 'ally', desc: 'Restores 35 MP.' }),
    I('hiEther', 'Hi-Ether', { price: 600, use: { mp: 110 }, tgt: 'ally', desc: 'Restores 110 MP.' }),
    I('phoenixDown', 'Phoenix Down', { price: 220, use: { revive: 0.3 }, tgt: 'dead', desc: 'Revives a fallen ally.' }),
    I('elixir', 'Elixir', { price: 3000, use: { hp: 9999, mp: 9999 }, tgt: 'ally', desc: 'Fully restores HP and MP.' }),
    I('antidote', 'Antidote', { price: 40, use: { cleanse: true }, tgt: 'ally', desc: 'Cures poison and sleep.' }),
    I('fireOrb', 'Fire Orb', { price: 180, use: { dmg: 220, type: 'fire' }, tgt: 'foe', battleOnly: true, desc: 'Burns one foe.' }),
    I('iceOrb', 'Ice Orb', { price: 180, use: { dmg: 220, type: 'ice' }, tgt: 'foe', battleOnly: true, desc: 'Freezes one foe.' }),
    I('boltOrb', 'Bolt Orb', { price: 180, use: { dmg: 220, type: 'thunder' }, tgt: 'foe', battleOnly: true, desc: 'Shocks one foe.' }),
    I('smokeBomb', 'Smoke Bomb', { price: 80, use: { flee: true }, tgt: 'none', battleOnly: true, desc: 'Escape from any fight but a boss.' }),
    I('hpSeed', 'Vital Seed', { price: 0, use: { maxhp: 25 }, tgt: 'ally', rare: true, desc: 'Permanently raises max HP by 25.' }),
    I('mpSeed', 'Mystic Seed', { price: 0, use: { maxmp: 8 }, tgt: 'ally', rare: true, desc: 'Permanently raises max MP by 8.' }),
    I('powerSeed', 'Might Seed', { price: 0, use: { atk: 3, mag: 3 }, tgt: 'ally', rare: true, desc: 'Permanently raises attack and magic.' }),
    I('tent', 'Tent', { price: 150, use: { rest: true }, tgt: 'none', fieldOnly: true, desc: 'Rest anywhere on the map: full HP and MP.' }),
];

export const MATERIALS = [
    ['slimeGel', 'Slime Gel', 8], ['wolfPelt', 'Wolf Pelt', 14], ['batWing', 'Bat Wing', 10], ['goblinEar', 'Goblin Ear', 12],
    ['boneDust', 'Bone Dust', 16], ['spore', 'Glowing Spore', 15], ['stoneHeart', 'Stone Heart', 30], ['scorpTail', 'Scorpion Sting', 24],
    ['frostShard', 'Frost Shard', 28], ['emberCore', 'Ember Core', 34], ['wispDust', 'Wisp Dust', 26], ['drakeScale', 'Drake Scale', 60],
    ['crabClaw', 'Crab Claw', 18], ['harpyFeather', 'Harpy Feather', 22], ['rustyKey', 'Rusty Key', 0], ['gleamStone', 'Gleamstone', 90],
    ['ancientCoin', 'Ancient Coin', 120], ['lostLocket', 'Lost Locket', 0], ['herbBundle', 'Moonpetal Herbs', 10], ['sealedLetter', 'Sealed Letter', 0],
].map(([id, name, price]) => I(id, name, { type: 'mat', price, desc: 'A crafting oddity. Sells for coin and fills quest orders.' }));

export const KEY_ITEMS = [
    I('dawnShard', 'Shard of Spark', { type: 'key', desc: 'The first Dawnshard. It beats like a heart.' }),
    I('galeShard', 'Shard of Gale', { type: 'key', desc: 'A Dawnshard that hums with the wind.' }),
    I('stoneShard', 'Shard of Stone', { type: 'key', desc: 'A Dawnshard, heavy as a mountain.' }),
    I('tideShard', 'Shard of Tide', { type: 'key', desc: 'A Dawnshard that wets your palm.' }),
    I('flameShard', 'Shard of Flame', { type: 'key', desc: 'A Dawnshard, warm as an ember.' }),
    I('frostShard5', 'Shard of Frost', { type: 'key', desc: 'A Dawnshard rimed with ice.' }),
    I('elderMap', 'Aldric\'s Map', { type: 'key', desc: 'Marks the Dawnshard shrines.' }),
    I('fiddle', 'Battered Fiddle', { type: 'key', desc: 'Someone\'s fiddle. Missing two strings and one very sentimental owner.' }),
    I('toyKnight', 'Tin Knight', { type: 'key', desc: 'A well-loved toy soldier.' }),
    I('heirloom', 'Old Heirloom', { type: 'key', desc: 'A family treasure, tarnished by dungeon damp.' }),
    I('lanternKey', 'Warden\'s Lantern', { type: 'key', desc: 'Opens the sealed gate of the Obsidian Spire.' }),
];

const WEAPON_NAMES = {
    sword: ['Iron Sword', 'Steel Sword', 'Silver Blade', 'Mythril Brand', 'Dragonsteel Sword', 'Dawnbrand'],
    spear: ['Iron Spear', 'Steel Lance', 'Silver Pike', 'Mythril Halberd', 'Dragonbone Spear', 'Sunpiercer'],
    bow: ['Short Bow', 'Hunter\'s Bow', 'Elven Bow', 'Windstring', 'Dragon Longbow', 'Starfall Bow'],
    axe: ['Hand Axe', 'Battle Axe', 'War Axe', 'Mythril Cleaver', 'Dragon Maul', 'Worldsplitter Axe'],
    dagger: ['Iron Dagger', 'Steel Dirk', 'Silver Stiletto', 'Shadowfang', 'Venom Kris', 'Nightwhisper'],
    staff: ['Oak Staff', 'Birch Rod', 'Crystal Staff', 'Sage\'s Scepter', 'Starwood Staff', 'Aurora Staff'],
    tome: ['Old Tome', 'Scholar\'s Codex', 'Rune Grimoire', 'Arcane Tome', 'Chrono Codex', 'Omniscient Folio'],
};
const ARMOR_NAMES = {
    cloth: ['Linen Robe', 'Silk Robe', 'Mage Robe', 'Sage Vestments', 'Arcane Mantle', 'Aurora Mantle'],
    light: ['Leather Vest', 'Studded Leather', 'Ranger\'s Coat', 'Shadowhide', 'Windrunner Garb', 'Phantom Cloak'],
    heavy: ['Iron Mail', 'Steel Cuirass', 'Mythril Armor', 'Dragonscale Mail', 'Titan Plate', 'Aegis of Dawn'],
};
const TIER_PRICE = [60, 220, 700, 1800, 4200, 9000];

function build() {
    const out = [];
    for (const [type, names] of Object.entries(WEAPON_NAMES)) {
        names.forEach((name, t) => {
            const magic = type === 'staff' || type === 'tome';
            const p = 5 + t * 9 + t * t * 1.4;
            out.push(I(`w_${type}_${t}`, name, {
                type: 'weapon', wtype: type, tier: t, price: TIER_PRICE[t],
                stats: magic ? { mag: Math.round(p * 1.1), atk: Math.round(p * 0.3) } : { atk: Math.round(p * 1.25), ...(type === 'dagger' || type === 'bow' ? { spd: 1 + t } : {}) },
                desc: magic ? `A ${type}. Magic +${Math.round(p * 1.1)}.` : `A ${type}. Attack +${Math.round(p * 1.25)}.`,
            }));
        });
    }
    for (const [kind, names] of Object.entries(ARMOR_NAMES)) {
        names.forEach((name, t) => {
            const q = 3 + t * 6 + t * t * 0.9;
            const stats = kind === 'cloth' ? { def: Math.round(q * 0.5), res: Math.round(q * 1.3), mag: Math.round(t * 1.5), hp: Math.round(q * 3) }
                : kind === 'light' ? { def: Math.round(q * 0.9), res: Math.round(q * 0.7), spd: Math.round(t * 1.2), hp: Math.round(q * 4) }
                    : { def: Math.round(q * 1.4), res: Math.round(q * 0.6), hp: Math.round(q * 7), spd: -Math.min(2, t) };
            out.push(I(`a_${kind}_${t}`, name, { type: 'armor', akind: kind, tier: t, price: Math.round(TIER_PRICE[t] * 0.9), stats, desc: `${kind[0].toUpperCase() + kind.slice(1)} armor.` }));
        });
    }
    const C = (id, name, stats, o = {}) => out.push(I(id, name, { type: 'charm', price: o.price ?? 400, stats, tier: o.tier ?? 1, immune: o.immune, desc: o.desc ?? 'A charm.' }));
    C('c_power', 'Power Ring', { atk: 10 }, { desc: 'Attack +10.' });
    C('c_mage', 'Mage Ring', { mag: 10 }, { desc: 'Magic +10.' });
    C('c_guard', 'Guard Ring', { def: 9, res: 5 }, { desc: 'Defence +9, resist +5.' });
    C('c_boots', 'Swift Boots', { spd: 5 }, { desc: 'Speed +5.' });
    C('c_vital', 'Vital Amulet', { hp: 140 }, { price: 900, tier: 2, desc: 'Max HP +140.' });
    C('c_mana', 'Mana Pendant', { mp: 40 }, { price: 900, tier: 2, desc: 'Max MP +40.' });
    C('c_antivenom', 'Antivenom Charm', { def: 3 }, { immune: ['poison'], desc: 'Immune to poison.' });
    C('c_wake', 'Wakeful Charm', { res: 3 }, { immune: ['sleep'], desc: 'Immune to sleep.' });
    C('c_hero', 'Hero\'s Medal', { atk: 8, mag: 8, def: 6, res: 6 }, { price: 3000, tier: 3, desc: 'All-round bonus.' });
    C('c_dawn', 'Dawn Pendant', { hp: 200, mp: 50, spd: 3 }, { price: 6000, tier: 4, desc: 'HP +200, MP +50, Speed +3.' });
    C('c_gale', 'Gale Anklet', { spd: 9 }, { price: 2400, tier: 3, desc: 'Speed +9.' });
    C('c_stone', 'Stoneheart Band', { def: 18, hp: 120 }, { price: 2400, tier: 3, desc: 'Defence +18, HP +120.' });
    C('c_tide', 'Tidecaller Pearl', { mag: 16, mp: 30 }, { price: 2600, tier: 3, desc: 'Magic +16, MP +30.' });
    C('c_ember', 'Emberheart Charm', { atk: 16, spd: 2 }, { price: 2600, tier: 3, desc: 'Attack +16, Speed +2.' });
    C('c_frost', 'Rimeward Charm', { res: 18, def: 8 }, { price: 2600, tier: 3, desc: 'Resist +18, Defence +8.' });
    return out;
}

export const ITEMS = Object.fromEntries([...CONS, ...MATERIALS, ...KEY_ITEMS, ...build()].map((i) => [i.id, i]));

export function item(id) { return ITEMS[id]; }
export function weaponFor(type, tier) { return `w_${type}_${Math.max(0, Math.min(TIERS - 1, tier))}`; }
export function armorFor(kind, tier) { return `a_${kind}_${Math.max(0, Math.min(TIERS - 1, tier))}`; }

/** What a shop in a town of this tier sells. */
export function shopStock(kind, tier, charIds, CHARS) {
    const list = [];
    if (kind === 'item') {
        list.push('potion', 'antidote', 'tent', 'smokeBomb');
        if (tier >= 1) list.push('hiPotion', 'ether', 'phoenixDown', 'fireOrb', 'iceOrb', 'boltOrb');
        if (tier >= 3) list.push('xPotion', 'hiEther');
    } else {
        const w = new Set(), a = new Set();
        for (const id of Object.keys(CHARS)) { w.add(CHARS[id].weapon); for (const k of CHARS[id].armor) a.add(k); }
        for (const t of [tier - 1, tier]) {
            if (t < 0 || t >= TIERS) continue;
            for (const ty of w) list.push(weaponFor(ty, t));
            for (const k of a) list.push(armorFor(k, t));
        }
        const ch = ['c_power', 'c_mage', 'c_guard', 'c_boots', 'c_antivenom', 'c_wake'];
        if (tier >= 2) ch.push('c_vital', 'c_mana');
        if (tier >= 3) ch.push('c_hero');
        list.push(...ch);
    }
    return [...new Set(list)];
}
