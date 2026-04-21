/**
 * Upgrade tree definitions.
 * category: hull | drill | tank | engine | cargo | lights | special
 * Each array is ordered tier 1→5 (or fewer for specials).
 */

export const UPGRADES = {
    hull: [
        { level: 1, name: 'Reinforced Plating', desc: 'Hull HP: 150',          cost: 500,    unlockDepth: 0,    effect: { hullMax: 150 } },
        { level: 2, name: 'Composite Armor',    desc: 'Hull HP: 225',          cost: 1500,   unlockDepth: 500,  effect: { hullMax: 225 } },
        { level: 3, name: 'Mithril Shell',      desc: 'Hull HP: 325',          cost: 4000,   unlockDepth: 1500, effect: { hullMax: 325 } },
        { level: 4, name: 'Arcane Shielding',   desc: 'Hull HP: 450',          cost: 10000,  unlockDepth: 2500, effect: { hullMax: 450 } },
        { level: 5, name: 'Void-Tempered Hull', desc: 'Hull HP: 650',          cost: 25000,  unlockDepth: 4500, effect: { hullMax: 650 } },
    ],
    drill: [
        { level: 1, name: 'Hardened Bit',    desc: 'Drill Power 2',               cost: 400,   unlockDepth: 0,    effect: { drillPower: 2 } },
        { level: 2, name: 'Rotary Drill',    desc: 'Power 3 + diagonal drilling', cost: 1200,  unlockDepth: 400,  effect: { drillPower: 3, diagonal: true } },
        { level: 3, name: 'Plasma Cutter',   desc: 'Drill Power 5',               cost: 3500,  unlockDepth: 1200, effect: { drillPower: 5 } },
        { level: 4, name: 'Arcane Bore',     desc: 'Power 7 + 3-wide AOE',        cost: 9000,  unlockDepth: 2800, effect: { drillPower: 7, aoe: true } },
        { level: 5, name: 'Void Drill',      desc: 'Power 10, instant any block', cost: 22000, unlockDepth: 5000, effect: { drillPower: 10, instant: true } },
    ],
    tank: [
        { level: 1, name: 'Extended Tank',   desc: 'Fuel capacity: 150', cost: 300,   unlockDepth: 0,    effect: { fuelMax: 150 } },
        { level: 2, name: 'Double Tank',     desc: 'Fuel capacity: 250', cost: 900,   unlockDepth: 300,  effect: { fuelMax: 250 } },
        { level: 3, name: 'Tri-Cell Tank',   desc: 'Fuel capacity: 400', cost: 2500,  unlockDepth: 1000, effect: { fuelMax: 400 } },
        { level: 4, name: 'Plasma Cell',     desc: 'Fuel capacity: 650', cost: 6500,  unlockDepth: 2200, effect: { fuelMax: 650 } },
        { level: 5, name: 'Quantum Reserve', desc: 'Fuel capacity: 1000',cost: 18000, unlockDepth: 4000, effect: { fuelMax: 1000 } },
    ],
    engine: [
        { level: 1, name: 'Tuned Engine',     desc: 'Speed 1.3x',                  cost: 350,   unlockDepth: 0,    effect: { speedMult: 1.3,  winchMult: 1.3  } },
        { level: 2, name: 'Turbo Engine',     desc: 'Speed 1.6x',                  cost: 1000,  unlockDepth: 500,  effect: { speedMult: 1.6,  winchMult: 1.5  } },
        { level: 3, name: 'Thruster Array',   desc: 'Speed 2x',                    cost: 3000,  unlockDepth: 1500, effect: { speedMult: 2.0,  winchMult: 1.8  } },
        { level: 4, name: 'Anti-Grav Assist', desc: 'Speed 2.5x',                  cost: 8000,  unlockDepth: 3000, effect: { speedMult: 2.5,  winchMult: 2.5  } },
        { level: 5, name: 'Phase Drive',      desc: 'Speed 3x, Winch 4x',          cost: 20000, unlockDepth: 5000, effect: { speedMult: 3.0,  winchMult: 4.0  } },
    ],
    cargo: [
        { level: 1, name: 'Expanded Hold',       desc: '15 cargo slots', cost: 450,   unlockDepth: 0,    effect: { cargoSlots: 15 } },
        { level: 2, name: 'Ore Compactor',        desc: '20 cargo slots', cost: 1100,  unlockDepth: 300,  effect: { cargoSlots: 20 } },
        { level: 3, name: 'Modular Bay',          desc: '30 cargo slots', cost: 3200,  unlockDepth: 1200, effect: { cargoSlots: 30 } },
        { level: 4, name: 'Dimensional Pocket',   desc: '45 cargo slots', cost: 8500,  unlockDepth: 2500, effect: { cargoSlots: 45 } },
        { level: 5, name: 'Void Cargo Net',       desc: '65 cargo slots', cost: 21000, unlockDepth: 4500, effect: { cargoSlots: 65 } },
    ],
    lights: [
        { level: 1, name: 'Better Headlights', desc: 'Light radius: 4 tiles',              cost: 250,   unlockDepth: 0,    effect: { lightRadius: 4 } },
        { level: 2, name: 'Floodlights',       desc: 'Light radius: 6 tiles',              cost: 700,   unlockDepth: 200,  effect: { lightRadius: 6 } },
        { level: 3, name: 'Sonar Pulse',       desc: '8 tiles + ore ping on minimap',      cost: 2000,  unlockDepth: 800,  effect: { lightRadius: 8,  orePing: true  } },
        { level: 4, name: 'Arcane Lens',       desc: '10 tiles, see through walls',        cost: 6000,  unlockDepth: 2000, effect: { lightRadius: 10, seeThrough: true } },
        { level: 5, name: 'Omnivision',        desc: 'Full 14-tile radius',                cost: 15000, unlockDepth: 4000, effect: { lightRadius: 14 } },
    ],
    // Specials are one-off purchases (not tiered 1-5)
    special: [
        { id: 'scanner',   name: 'Ore Scanner',     desc: 'HUD shows ore name on hover',            cost: 1500,  unlockDepth: 800,  effect: { oreScanner: true  } },
        { id: 'radar',     name: 'Depth Radar',     desc: 'Minimap shows ore clusters',             cost: 4000,  unlockDepth: 1500, effect: { depthRadar: true  } },
        { id: 'shield',    name: 'Pressure Shield', desc: 'Nullify lava/acid 5s (30s cooldown)',    cost: 3000,  unlockDepth: 1200, effect: { pressureShield: true } },
        { id: 'teleport',  name: 'Emergency Beacon',desc: 'Teleport to base (1 charge)',            cost: 8000,  unlockDepth: 2500, effect: { teleporter: true  } },
        { id: 'autodrill', name: 'Auto-Drill',      desc: 'Drill continuously in one direction',    cost: 5000,  unlockDepth: 2000, effect: { autoDrill: true   } },
        { id: 'magnet',    name: 'Ore Magnet',      desc: 'Pulls ore 2 tiles away to cargo',        cost: 6000,  unlockDepth: 2800, effect: { oreMagnet: true   } },
        { id: 'nanites',   name: 'Hull Nanites',    desc: 'Auto-repair 1 HP/sec passive',           cost: 12000, unlockDepth: 3500, effect: { naniteRepair: true } },
        { id: 'voidanchor',name: 'Void Anchor',     desc: 'Negates void anomaly damage',            cost: 18000, unlockDepth: 5000, effect: { voidAnchor: true  } },
    ],
};

// Consumables sold at base store
export const CONSUMABLES = [
    { id: 'fuel_full',    name: 'Fuel Refill (Full)',   desc: 'Fill tank to max',         cost: 150, icon: '⛽' },
    { id: 'fuel_half',    name: 'Fuel Refill (50%)',    desc: 'Restore half tank',        cost: 80,  icon: '⛽' },
    { id: 'repair_full',  name: 'Hull Repair (Full)',   desc: 'Restore all hull HP',      cost: 200, icon: '🔧' },
    { id: 'repair_kit',   name: 'Hull Repair Kit',      desc: '+25 HP, usable in field',  cost: 80,  icon: '🩹' },
    { id: 'cargo_temp',   name: 'Temp Cargo Expansion', desc: '+5 slots for 1 run',       cost: 200, icon: '📦' },
    { id: 'tnt',          name: 'TNT Charge',           desc: 'Blast 3x3 area instantly', cost: 120, icon: '💥' },
    { id: 'seismic',      name: 'Seismic Scan',         desc: 'Reveal ore 20 rows ahead', cost: 500, icon: '📡' },
    { id: 'recall_flare', name: 'Recall Flare',         desc: 'Emergency winch to base',  cost: 300, icon: '🚨' },
    { id: 'lucky_charm',  name: 'Lucky Charm',          desc: '+20% ore value for 1 run', cost: 400, icon: '🍀' },
    { id: 'void_map',     name: 'Void Map Fragment',    desc: '1 of 3 needed (Singing Vein quest)', cost: 2500, icon: '🗺️' },
];
