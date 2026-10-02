// Weapons, armour, mounts, drinks and potions.

// LoGD's price list for the 15 weapon/armour levels.
export const GEAR_COST = [48, 225, 585, 990, 1575, 2250, 2790, 3420, 4230, 5040, 5850, 6840, 8010, 9000, 10350];

// Names change as the village starts to respect you (by Wyrm kills).
const WEAPON_TIERS = [
    { minDk: 0, names: ['Rusty Garden Rake', 'Chipped Trowel', 'Bent Spade', 'Woodcutter\'s Hatchet', 'Iron Hoe', 'Blacksmith\'s Hammer', 'Sharpened Pitchfork', 'Butcher\'s Cleaver', 'Hunting Spear', 'Woodsman\'s Axe', 'Militia Pike', 'Footman\'s Mace', 'Notched Longsword', 'Veteran\'s Bastard Sword', 'Polished Greatsword'] },
    { minDk: 2, names: ['Short Sword', 'Flanged Mace', 'Boarding Axe', 'Hornbow', 'Falchion', 'Morning Star', 'War Pick', 'Halberd', 'Arming Sword', 'Bearded Axe', 'Estoc', 'Lucerne Hammer', 'Zweihänder', 'Knightly Longsword', 'Commander\'s Warblade'] },
    { minDk: 5, names: ['Silvered Dirk', 'Elven Leafblade', 'Dwarven Hand-axe', 'Moonsteel Rapier', 'Runed Warhammer', 'Ashwood Longbow', 'Glaive of Dawn', 'Bloodwood Flail', 'Starforged Scimitar', 'Thunderhead Maul', 'Duskblade', 'Frostbrand', 'Emberfang Axe', 'Gloamwood Reaver', 'Sunsteel Claymore'] },
    { minDk: 10, names: ['Whisperknife', 'Lantern of Judgement', 'Stormcaller Spear', 'Oathkeeper', 'Wyrmscale Cleaver', 'Bonechime Scythe', 'Heartwood Staff', 'Crown-Breaker', 'Nightfall Edge', 'Phoenix Talon', 'Jadebite', 'Shard of the First Star', 'Kingsbane', 'Godspite Hammer', 'Wyrmfang Reforged'] },
];

const ARMOR_TIERS = [
    { minDk: 0, names: ['Patched Tunic', 'Thick Wool Cloak', 'Boiled Leather Apron', 'Padded Gambeson', 'Hide Jerkin', 'Studded Vest', 'Ring-sewn Coat', 'Scavenged Chain Shirt', 'Brigandine', 'Iron Scale Coat', 'Mail Hauberk', 'Banded Mail', 'Half-plate', 'Old Knight\'s Plate', 'Gleaming Full Plate'] },
    { minDk: 2, names: ['Soldier\'s Gambeson', 'Cuir Bouilli', 'Riveted Leather', 'Lamellar Coat', 'Chain Haubergeon', 'Coat of Plates', 'Splinted Mail', 'Gothic Cuirass', 'Lobster-tail Plate', 'Fluted Harness', 'Tourney Plate', 'Champion\'s Harness', 'Siegebreaker Plate', 'Banneret\'s Panoply', 'Lord-Commander\'s Plate'] },
    { minDk: 5, names: ['Elvish Silkweave', 'Moonleather Coat', 'Dwarven Ringmail', 'Mithral Shirt', 'Starlit Scale', 'Thornguard Plate', 'Duskweave Mantle', 'Gloamsteel Cuirass', 'Wyvernhide Armour', 'Frostforged Mail', 'Emberplate', 'Stormscale Harness', 'Oakheart Plate', 'Sunsteel Panoply', 'Aegis of Dawn'] },
    { minDk: 10, names: ['Shadowsilk Wraps', 'Saint\'s Vestment', 'Ironbark Armour', 'Living Thornmail', 'Celestial Scale', 'Mantle of the Moon', 'Wyrmscale Hauberk', 'Plate of a Thousand Oaths', 'Ghostweave', 'Phoenix Mail', 'Jadeplate', 'Starfall Harness', 'Kingsguard Eternal', 'Mantle of the Ferryman', 'Armour of the Last Dragonguard'] },
];

function tierFor(tiers, dk) { let t = tiers[0]; for (const x of tiers) if (dk >= x.minDk) t = x; return t; }

export function weaponList(dk) { const t = tierFor(WEAPON_TIERS, dk); return t.names.map((name, i) => ({ name, dmg: i + 1, cost: GEAR_COST[i] })); }
export function armorList(dk) { const t = tierFor(ARMOR_TIERS, dk); return t.names.map((name, i) => ({ name, def: i + 1, cost: GEAR_COST[i] })); }
export function weaponName(level, dk) { return level <= 0 ? 'Fists' : tierFor(WEAPON_TIERS, dk).names[level - 1]; }
export function armorName(level, dk) { return level <= 0 ? 'Rags' : tierFor(ARMOR_TIERS, dk).names[level - 1]; }

// Mounts: forest turns, a daily combat buff, and a feed price.
export const MOUNTS = [
    { id: 'mule', name: 'Stubborn Mule', gold: 600, gems: 1, turns: 1, buff: null, desc: 'Won\'t go faster, won\'t go slower, won\'t go left. But it does carry you deeper into the woods each day.' },
    { id: 'pony', name: 'Shaggy Pony', gold: 1200, gems: 2, turns: 1, buff: { name: 'Pony Kick', rounds: 10, atk: 1.1, msg: 'Your pony kicks out at {foe}!' }, desc: 'Small, round and bad-tempered with everyone except you.' },
    { id: 'gelding', name: 'Grey Gelding', gold: 2500, gems: 4, turns: 2, buff: { name: 'Steady Gelding', rounds: 15, def: 1.1 }, desc: 'A calm, sensible horse that has seen a goblin or two and is not impressed.' },
    { id: 'wolf', name: 'Dire Wolf', gold: 4500, gems: 6, turns: 2, buff: { name: 'Wolf\'s Fangs', rounds: 15, minion: { count: 1, min: 1, max: 6, msg: 'Your wolf savages {foe} for `^{dmg}`0 damage!', miss: 'Your wolf snaps at {foe} and misses.' } }, desc: 'Raised from a pup by Odric\'s daughter. Eats more than you do.' },
    { id: 'stallion', name: 'Black Destrier', gold: 7000, gems: 9, turns: 3, buff: { name: 'Destrier\'s Charge', rounds: 20, atk: 1.2, def: 1.1 }, desc: 'A warhorse bred for the charge, sixteen hands of muscle and fury.' },
    { id: 'griffon', name: 'Young Griffon', gold: 12000, gems: 14, turns: 3, buff: { name: 'Griffon\'s Talons', rounds: 20, atk: 1.15, minion: { count: 1, min: 3, max: 12, msg: 'Your griffon dives on {foe} for `^{dmg}`0 damage!', miss: 'Your griffon screeches but {foe} ducks.' } }, desc: 'Half eagle, half lion, entirely convinced it is your mother.' },
    { id: 'drake', name: 'Ember Drake', gold: 20000, gems: 22, turns: 4, buff: { name: 'Drake Fire', rounds: 25, atk: 1.25, def: 1.15, minion: { count: 1, min: 5, max: 18, msg: 'Your drake breathes fire over {foe} for `^{dmg}`0 damage!', miss: 'Your drake\'s fire scorches only the grass.' } }, desc: 'A small cousin of the Wyrm itself. The irony is not lost on anyone.' },
];

// Brannoc's taps. Price scales with level.
export const DRINKS = [
    { id: 'ale', name: 'Antler Ale', mult: 10, drunk: 1, buff: { name: 'Liquid Courage', rounds: 10, atk: 1.15 }, text: 'Brannoc slides a foaming tankard down the bar. It tastes of honey, smoke and bad decisions.' },
    { id: 'mead', name: 'Spiced Mead', mult: 18, drunk: 1, buff: { name: 'Mead Warmth', rounds: 15, def: 1.15 }, text: 'The mead goes down warm and spreads to your fingertips. You feel sturdier, somehow.' },
    { id: 'grog', name: 'Bog-Troll Grog', mult: 25, drunk: 2, buff: { name: 'Grog Fury', rounds: 12, atk: 1.3, def: 0.9 }, text: 'It is green. It is bubbling. It screams very faintly as you drink it. You feel INVINCIBLE.' },
];

export const MAX_DRUNK = 4;

// Potions bought with gems (Zorya's tent).
export const POTIONS = [
    { id: 'charm', name: 'Philtre of Charm', gems: 2, desc: '+1 charm, permanently.' },
    { id: 'vitality', name: 'Draught of Vitality', gems: 2, desc: '+1 maximum hit point, permanently.' },
    { id: 'heal', name: 'Healing Potion', gems: 1, desc: 'Heal fully, right now.' },
    { id: 'vigor', name: 'Tonic of Vigour', gems: 3, desc: '+2 forest fights today.' },
    { id: 'forget', name: 'Lethe Water', gems: 4, desc: 'Forget your specialty and choose a new one (your skill points carry over).' },
];

export const BASIC_WEAPON = 'Fists';
export const BASIC_ARMOR = 'Rags';
