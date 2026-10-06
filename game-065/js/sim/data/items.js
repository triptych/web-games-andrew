// Items, materials, modules, evolution kits, program cards, blueprints and workbench recipes.
// Currency is cogs (⚙). Pockets: repair, spike, battle, module, kit, material, card, key.

export const ITEMS = {};
function I(id, name, pocket, price, icon, desc, extra = {}) { ITEMS[id] = { id, name, pocket, price, icon, desc, ...extra }; }

// ------------------------------------------------------------------ repair (healing)
I('patch-kit', 'Patch Kit', 'repair', 200, '🩹', 'Patches 20 Hull on one COM-bot.', { heal: 20 });
I('rivet-kit', 'Rivet Kit', 'repair', 600, '🔧', 'Rivets back 60 Hull.', { heal: 60 });
I('overhaul-kit', 'Overhaul Kit', 'repair', 1200, '🧰', 'Restores 150 Hull.', { heal: 150 });
I('full-rebuild', 'Full Rebuild', 'repair', 2500, '🛠️', 'Restores every point of Hull.', { heal: 9999 });
I('restart-cell', 'Restart Cell', 'repair', 1500, '🔋', 'Restarts a shut-down COM-bot with half its Hull.', { revive: 0.5 });
I('prime-cell', 'Prime Cell', 'repair', 0, '⚡', 'Restarts a shut-down COM-bot with full Hull.', { revive: 1 });
I('coolant', 'Coolant', 'repair', 200, '🧊', 'Cools an overheated COM-bot.', { cure: 'ovh' });
I('antirust', 'Antirust', 'repair', 200, '🧴', 'Neutralises corrosion.', { cure: 'cor' });
I('grounding-strap', 'Grounding Strap', 'repair', 250, '🪢', 'Bleeds off a short circuit.', { cure: 'shc' });
I('thaw-torch', 'Thaw Torch', 'repair', 250, '🔥', 'Unseizes frozen gears.', { cure: 'frz' });
I('jumpstart', 'Jumpstart', 'repair', 250, '🔌', 'Wakes a powered-down COM-bot.', { cure: 'pdn' });
I('universal-solvent', 'Universal Solvent', 'repair', 600, '🧪', 'Clears any status condition.', { cure: 'all' });
I('battery', 'Battery', 'repair', 1000, '🔋', 'Restores 10 charges to one technique.', { pp: 10 });
I('big-battery', 'Big Battery', 'repair', 0, '🔋', 'Restores every charge of every technique.', { pp: 99, all: true });

// ------------------------------------------------------------------ field
I('static-repeller', 'Static Repeller', 'repair', 400, '📻', 'A crackle wild COM-bots hate. Weaker wild bots stay away for 120 steps.', { repel: 120, field: true });
I('loud-repeller', 'Loud Repeller', 'repair', 700, '📢', 'Weaker wild bots stay away for 250 steps.', { repel: 250, field: true });
I('recall-flare', 'Recall Flare', 'repair', 550, '🎆', 'Fires a flare and brings you back to the last Boiler Station you used.', { flare: true, field: true });

// ------------------------------------------------------------------ reboot spikes (capture)
I('reboot-spike', 'Reboot Spike', 'spike', 200, '📍', 'Jammed into a feral COM-bot, it overwrites its controller with yours.', { rate: 1 });
I('brass-spike', 'Brass Spike', 'spike', 600, '🔩', 'A better-made spike. ×1.5 catch rate.', { rate: 1.5 });
I('tesla-spike', 'Tesla Spike', 'spike', 1200, '⚡', 'Hits the controller with a jolt. ×2 catch rate.', { rate: 2 });
I('magna-spike', 'Magna Spike', 'spike', 1000, '🧲', '×3 on Iron, Volt and Gear bots; ×1 otherwise.', { rate: 1, vs: ['iron', 'volt', 'gear'], vsRate: 3 });
I('fathom-spike', 'Fathom Spike', 'spike', 1000, '🌊', '×3 on Hydro, Toxic and Frost bots; ×1 otherwise.', { rate: 1, vs: ['hydro', 'toxic', 'frost'], vsRate: 3 });
I('quick-spike', 'Quick Spike', 'spike', 1000, '💨', '×4 on the first turn of a battle; ×1 after.', { rate: 1, firstTurn: 4 });
I('lantern-spike', 'Lantern Spike', 'spike', 1000, '🏮', '×3 inside wrecks, stations and other dark places.', { rate: 1, dark: 3 });
I('prime-key', 'Prime Key', 'spike', 0, '🗝️', 'The master controller key. It never fails.', { rate: 255 });

// ------------------------------------------------------------------ battle chips (one battle)
I('torque-chip', 'Torque Chip', 'battle', 500, '🟥', 'Raises Torque by two stages for this battle.', { boost: 'atk' });
I('plating-chip', 'Plating Chip', 'battle', 500, '🟫', 'Raises Plating by two stages.', { boost: 'def' });
I('arc-chip', 'Arc Chip', 'battle', 500, '🟪', 'Raises Arc by two stages.', { boost: 'spa' });
I('shield-chip', 'Shield Chip', 'battle', 500, '🟦', 'Raises Shield by two stages.', { boost: 'spd' });
I('clock-chip', 'Clock Chip', 'battle', 500, '🟨', 'Raises Clock by two stages.', { boost: 'spe' });
I('lens-chip', 'Lens Chip', 'battle', 500, '🔎', 'Raises targeting (critical hits) by two stages.', { boost: 'crit' });

// ------------------------------------------------------------------ modules (held)
const TYPE_MODULES = [
    ['lucky-bolt', 'Lucky Bolt', 'scrap', '🔩'], ['pressure-gauge', 'Pressure Gauge', 'steam', '⏲️'], ['ember-core', 'Ember Core', 'blaze', '🔥'],
    ['brass-nozzle', 'Brass Nozzle', 'hydro', '🚿'], ['coolant-coil', 'Coolant Coil', 'frost', '❄️'], ['tesla-coil', 'Tesla Coil', 'volt', '⚡'],
    ['carbide-tip', 'Carbide Tip', 'grit', '⛏️'], ['gyro-vane', 'Gyro Vane', 'aero', '🌀'], ['iron-plate', 'Iron Plate', 'iron', '🛡️'],
    ['mainspring', 'Mainspring', 'gear', '⚙️'], ['acid-vial', 'Acid Vial', 'toxic', '⚗️'], ['moss-spore', 'Moss Spore', 'moss', '🌿'],
    ['hydraulic-line', 'Hydraulic Line', 'piston', '🥊'], ['vacuum-tube', 'Vacuum Tube', 'signal', '📡'], ['grave-charm', 'Grave Charm', 'rust', '🦴'],
    ['void-lens', 'Void Lens', 'void', '🔮'],
];
for (const [id, name, type, icon] of TYPE_MODULES) I(id, name, 'module', 1500, icon, `Held: ${type[0].toUpperCase() + type.slice(1)} techniques hit 20% harder.`, { boostType: type });
I('solar-coil', 'Solar Coil', 'module', 4000, '☀️', 'Held: restores 1/16 Hull at the end of every turn.', { mod: 'leftovers' });
I('overdrive-gearbox', 'Overdrive Gearbox', 'module', 4000, '⚙️', 'Held: kinetic techniques hit 20% harder.', { mod: 'kinetic' });
I('arc-amplifier', 'Arc Amplifier', 'module', 4000, '🔊', 'Held: energy techniques hit 20% harder.', { mod: 'energy' });
I('targeting-scope', 'Targeting Scope', 'module', 3000, '🎯', 'Held: critical hits come more often.', { mod: 'crit' });
I('shock-absorber', 'Shock Absorber', 'module', 3000, '🪀', 'Held: at full Hull, survives one knockout blow with 1 Hull. Then it breaks.', { mod: 'sash' });
I('volatile-core', 'Volatile Core', 'module', 5000, '☢️', 'Held: every hit is 30% stronger, but each costs 10% of the holder\'s Hull.', { mod: 'orb' });
I('learning-chip', 'Learning Chip', 'module', 3000, '💾', 'Held: earns 50% more experience.', { mod: 'xp' });
I('hair-trigger', 'Hair Trigger', 'module', 2500, '⏱️', 'Held: 20% chance to act first.', { mod: 'quick' });
I('spare-battery', 'Spare Battery', 'module', 800, '🔋', 'Held: restores a quarter of the holder\'s Hull once when it drops below half. Then it is used up.', { mod: 'berry' });
I('reset-fuse', 'Reset Fuse', 'module', 800, '🧯', 'Held: clears a status condition the moment it lands. Then it is used up.', { mod: 'lum' });
I('glow-bulb', 'Glow Bulb', 'module', 1000, '💡', 'Held by the lead bot: wild COM-bots appear more often.', { mod: 'lure' });
I('muffler', 'Muffler', 'module', 1000, '🔇', 'Held by the lead bot: wild COM-bots appear half as often.', { mod: 'muffle' });

// ------------------------------------------------------------------ evolution kits (installed as new parts)
const KITS = [
    ['brass-heart', 'Brass Heart', 'scrap', '💛'], ['pressure-valve', 'Pressure Valve', 'steam', '♨️'], ['furnace-heart', 'Furnace Heart', 'blaze', '❤️‍🔥'],
    ['hydro-pump', 'Hydro Pump', 'hydro', '💧'], ['cryo-core', 'Cryo Core', 'frost', '🧊'], ['storm-capacitor', 'Storm Capacitor', 'volt', '🌩️'],
    ['grit-auger', 'Grit Auger', 'grit', '🪛'], ['jet-turbine', 'Jet Turbine', 'aero', '✈️'], ['tempered-plate', 'Tempered Plate', 'iron', '🛡️'],
    ['clockwork-heart', 'Clockwork Heart', 'gear', '⚙️'], ['toxin-vat', 'Toxin Vat', 'toxic', '🧪'], ['seed-vault', 'Seed Vault', 'moss', '🌱'],
    ['hydraulic-ram', 'Hydraulic Ram', 'piston', '🔨'], ['signal-array', 'Signal Array', 'signal', '📶'], ['grave-relic', 'Grave Relic', 'rust', '⚱️'],
    ['singularity-seed', 'Singularity Seed', 'void', '🕳️'],
];
for (const [id, name, type, icon] of KITS) I(id, name, 'kit', 2100, icon, `An upgrade kit. Installing it into certain COM-bots makes them evolve.`, { kitType: type });

// ------------------------------------------------------------------ materials
I('scrap-metal', 'Scrap Metal', 'material', 20, '🔩', 'Bent plate and odd bolts. The planet is made of it.');
I('copper-wire', 'Copper Wire', 'material', 40, '🧵', 'A coil of salvaged copper.');
I('brass-gear', 'Brass Gear', 'material', 60, '⚙️', 'A good, true cog.');
I('spring', 'Spring', 'material', 40, '🌀', 'Coiled steel with plenty of bounce left.');
I('rubber', 'Rubber', 'material', 30, '⚫', 'Gaskets, tyres and seals.');
I('glass-lens', 'Glass Lens', 'material', 80, '🔍', 'Ground glass from an old instrument.');
I('circuit-board', 'Circuit Board', 'material', 120, '🟩', 'Off-world electronics. Nobody on Midden can make these.');
I('plasma-cell', 'Plasma Cell', 'material', 200, '🔋', 'A starship power cell that still holds a charge.');
I('aether-crystal', 'Aether Crystal', 'material', 300, '💎', 'A crystal that hums with energy from beyond the sky.');
I('void-shard', 'Void Shard', 'material', 500, '🟣', 'A sliver of alien metal. It is colder than it should be.');
I('coolant-gel', 'Coolant Gel', 'material', 90, '🧊', 'Blue gel from a cryo-ship\'s pipes.');
I('moss-fiber', 'Moss Fiber', 'material', 50, '🌿', 'Tough moss strands, good for padding and filters.');

export const MATERIALS = Object.values(ITEMS).filter((i) => i.pocket === 'material').map((i) => i.id);

// ------------------------------------------------------------------ program cards (teach techniques)
export const CARDS = [
    'bulwark', 'patch-up', 'rev-up', 'focus-lens', 'cold-restart', 'scrap-cannon', 'scrap-slam',
    'scald-jet', 'pressure-blast', 'firebox-blast', 'flame-fist', 'maelstrom', 'hose-blast', 'cryo-beam', 'frostbite',
    'arc-lash', 'tesla-bolt', 'drill-spiral', 'seismic-stomp', 'scrap-shards', 'prop-wash', 'wing-slice', 'tailwind',
    'iron-hammer', 'cannonade', 'plate-up', 'gear-grind', 'overwind', 'clockwork-strike', 'sludge-shot', 'toxic-spray',
    'leaf-blades', 'root-siphon', 'hammer-fist', 'shockwave-slam', 'hydraulic-pump', 'sonic-pulse', 'broadcast',
    'decay-ray', 'jawlock', 'aether-beam', 'prism-ray', 'full-throttle', 'recalibrate',
];
CARDS.forEach((m, i) => {
    I(`card-${m}`, `Card ${String(i + 1).padStart(2, '0')}`, 'card', 2000 + (i % 5) * 500, '🎴', '', { teach: m, cardNo: i + 1 });
});

// ------------------------------------------------------------------ key items
I('registry', 'COM-bot Registry', 'key', 0, '📖', 'Ma Bellows\' battered registry. It records every COM-bot you see and every one you own.');
I('steam-boots', 'Steam Boots', 'key', 0, '👢', 'Hold B (or Shift) to run.');
I('data-link', 'Data Link', 'key', 0, '📶', 'Shares half of every battle\'s experience with the whole team.');
I('cutter-torch', 'Cutter Torch', 'key', 0, '🔦', 'Cuts through chained metal fences.');
I('lift-coil', 'Lift Coil', 'key', 0, '🧲', 'A magnetic crane-coil. Lifts heavy engine blocks out of the way.');
I('hover-skiff', 'Hover Skiff', 'key', 0, '🛶', 'A fan-driven skiff that glides over sludge.');
I('arc-lantern', 'Arc Lantern', 'key', 0, '🏮', 'An electric lantern bright enough to light a dead station.');
I('circuit-pass', 'Circuit Pass', 'key', 0, '🎫', 'Your registration in the Grand Gearworks Circuit.');
I('starward-ticket', 'Starward Ticket', 'key', 0, '🌠', 'Passage on the Aurelia, the only ship that ever leaves Midden.');
I('syndicate-keycard', 'Syndicate Keycard', 'key', 0, '💳', 'Opens Rust Syndicate bulkheads.');

// ------------------------------------------------------------------ blueprints (key items that unlock a build at the workbench)
export const BLUEPRINTS = {
    'bp-gadgetto':   { bot: 'Gadgetto', lv: 15, mats: { 'scrap-metal': 6, 'brass-gear': 3, 'spring': 3, 'copper-wire': 2 } },
    'bp-patchwork':  { bot: 'Patchwork', lv: 22, mats: { 'scrap-metal': 10, 'rubber': 4, 'copper-wire': 4, 'circuit-board': 1 } },
    'bp-rivetpup':   { bot: 'Rivetpup', lv: 20, mats: { 'scrap-metal': 12, 'brass-gear': 4, 'spring': 4, 'plasma-cell': 1 } },
    'bp-zephlit':    { bot: 'Zephlit', lv: 24, mats: { 'brass-gear': 6, 'spring': 4, 'glass-lens': 2, 'plasma-cell': 1 } },
    'bp-voidling':   { bot: 'Voidling', lv: 30, mats: { 'void-shard': 2, 'aether-crystal': 2, 'circuit-board': 2, 'plasma-cell': 2 } },
    'bp-ramparton':  { bot: 'Ramparton', lv: 34, mats: { 'scrap-metal': 16, 'brass-gear': 6, 'circuit-board': 2 } },
    'bp-analytix':   { bot: 'Analytix', lv: 28, mats: { 'circuit-board': 3, 'glass-lens': 3, 'copper-wire': 4 } },
    'bp-lullabox':   { bot: 'Lullabox', lv: 26, mats: { 'brass-gear': 5, 'spring': 5, 'glass-lens': 1 } },
};
const BP_NAMES = { 'bp-gadgetto': 'Gadgetto', 'bp-patchwork': 'Patchwork', 'bp-rivetpup': 'Rivetpup', 'bp-zephlit': 'Zephlit', 'bp-voidling': 'Voidling', 'bp-ramparton': 'Ramparton', 'bp-analytix': 'Analytix', 'bp-lullabox': 'Lullabox' };
for (const [id, n] of Object.entries(BP_NAMES)) I(id, `Blueprint: ${n}`, 'key', 0, '📐', `Plans for building a ${n} from scratch at any workbench.`, { blueprint: true });

// ------------------------------------------------------------------ workbench recipes
// Any workbench (Ma Bellows' workshop and every Boiler Station) can craft these.
export const RECIPES = [
    { out: 'reboot-spike', n: 2, mats: { 'scrap-metal': 2, 'copper-wire': 1 } },
    { out: 'brass-spike', n: 1, mats: { 'brass-gear': 2, 'copper-wire': 1, 'spring': 1 } },
    { out: 'tesla-spike', n: 1, mats: { 'circuit-board': 1, 'copper-wire': 2, 'aether-crystal': 1 } },
    { out: 'magna-spike', n: 1, mats: { 'scrap-metal': 3, 'copper-wire': 3, 'spring': 1 } },
    { out: 'fathom-spike', n: 1, mats: { 'rubber': 2, 'coolant-gel': 1, 'glass-lens': 1 } },
    { out: 'lantern-spike', n: 1, mats: { 'glass-lens': 1, 'plasma-cell': 1, 'scrap-metal': 1 } },
    { out: 'patch-kit', n: 2, mats: { 'scrap-metal': 2, 'rubber': 1 } },
    { out: 'rivet-kit', n: 1, mats: { 'scrap-metal': 2, 'spring': 2, 'brass-gear': 1 } },
    { out: 'overhaul-kit', n: 1, mats: { 'circuit-board': 1, 'brass-gear': 2, 'rubber': 2 } },
    { out: 'restart-cell', n: 1, mats: { 'plasma-cell': 1, 'copper-wire': 2 } },
    { out: 'universal-solvent', n: 2, mats: { 'moss-fiber': 2, 'coolant-gel': 1 } },
    { out: 'battery', n: 1, mats: { 'plasma-cell': 1, 'scrap-metal': 1 } },
    { out: 'static-repeller', n: 2, mats: { 'copper-wire': 2, 'rubber': 1 } },
    { out: 'spare-battery', n: 1, mats: { 'plasma-cell': 1, 'rubber': 1 } },
    { out: 'reset-fuse', n: 1, mats: { 'copper-wire': 1, 'moss-fiber': 2 } },
    { out: 'solar-coil', n: 1, mats: { 'glass-lens': 2, 'circuit-board': 1, 'aether-crystal': 1 } },
    { out: 'learning-chip', n: 1, mats: { 'circuit-board': 2, 'copper-wire': 2 } },
    { out: 'targeting-scope', n: 1, mats: { 'glass-lens': 3, 'brass-gear': 1 } },
    { out: 'shock-absorber', n: 1, mats: { 'spring': 4, 'rubber': 2 } },
    { out: 'overdrive-gearbox', n: 1, mats: { 'brass-gear': 5, 'spring': 2, 'plasma-cell': 1 } },
    { out: 'arc-amplifier', n: 1, mats: { 'copper-wire': 4, 'circuit-board': 1, 'aether-crystal': 1 } },
    // Evolution kits.
    { out: 'brass-heart', n: 1, mats: { 'brass-gear': 4, 'scrap-metal': 4 } },
    { out: 'pressure-valve', n: 1, mats: { 'brass-gear': 2, 'rubber': 3, 'spring': 1 } },
    { out: 'furnace-heart', n: 1, mats: { 'scrap-metal': 4, 'plasma-cell': 1, 'brass-gear': 1 } },
    { out: 'hydro-pump', n: 1, mats: { 'rubber': 3, 'brass-gear': 2, 'spring': 1 } },
    { out: 'cryo-core', n: 1, mats: { 'coolant-gel': 3, 'circuit-board': 1 } },
    { out: 'storm-capacitor', n: 1, mats: { 'copper-wire': 5, 'plasma-cell': 1 } },
    { out: 'grit-auger', n: 1, mats: { 'scrap-metal': 5, 'spring': 2 } },
    { out: 'jet-turbine', n: 1, mats: { 'brass-gear': 3, 'spring': 2, 'plasma-cell': 1 } },
    { out: 'tempered-plate', n: 1, mats: { 'scrap-metal': 8, 'plasma-cell': 1 } },
    { out: 'clockwork-heart', n: 1, mats: { 'brass-gear': 5, 'spring': 3 } },
    { out: 'toxin-vat', n: 1, mats: { 'glass-lens': 2, 'rubber': 2, 'moss-fiber': 1 } },
    { out: 'seed-vault', n: 1, mats: { 'moss-fiber': 4, 'glass-lens': 1 } },
    { out: 'hydraulic-ram', n: 1, mats: { 'spring': 3, 'scrap-metal': 3, 'rubber': 2 } },
    { out: 'signal-array', n: 1, mats: { 'copper-wire': 3, 'circuit-board': 1, 'glass-lens': 1 } },
    { out: 'grave-relic', n: 1, mats: { 'scrap-metal': 3, 'void-shard': 1 } },
    { out: 'singularity-seed', n: 1, mats: { 'void-shard': 2, 'aether-crystal': 1 } },
];

// ------------------------------------------------------------------ shops: what the Parts Exchange stocks after N seals
export const SHOP_TIERS = [
    { seals: 0, items: ['reboot-spike', 'patch-kit', 'coolant', 'antirust', 'grounding-strap', 'static-repeller'] },
    { seals: 1, items: ['brass-spike', 'thaw-torch', 'jumpstart', 'recall-flare', 'spare-battery'] },
    { seals: 2, items: ['rivet-kit', 'restart-cell', 'magna-spike', 'fathom-spike', 'torque-chip', 'arc-chip'] },
    { seals: 3, items: ['tesla-spike', 'universal-solvent', 'quick-spike', 'plating-chip', 'shield-chip', 'clock-chip', 'loud-repeller'] },
    { seals: 5, items: ['overhaul-kit', 'lantern-spike', 'lens-chip', 'reset-fuse'] },
    { seals: 7, items: ['full-rebuild'] },
];

/** Materials a defeated wild bot can yield, chosen by its parts. */
export const SALVAGE = {
    c: { orb: 'scrap-metal', egg: 'scrap-metal', box: 'scrap-metal', boiler: 'brass-gear', barrel: 'scrap-metal', bell: 'rubber', dome: 'scrap-metal', bulb: 'glass-lens', tank: 'scrap-metal', lantern: 'glass-lens', cone: 'spring', serpent: 'copper-wire', disc: 'circuit-board', frame: 'scrap-metal', pod: 'rubber', kettle: 'brass-gear' },
    a: { claws: 'scrap-metal', pincers: 'spring', pistons: 'spring', hammers: 'scrap-metal', drills: 'spring', saws: 'brass-gear', tesla: 'copper-wire', cannons: 'plasma-cell', nozzles: 'rubber', tendrils: 'copper-wire', grabbers: 'spring', blades: 'scrap-metal', shields: 'scrap-metal' },
    b: { stack: 'scrap-metal', tank: 'rubber', gear: 'brass-gear', wings: 'brass-gear', propeller: 'spring', coil: 'copper-wire', turbine: 'plasma-cell', furnace: 'plasma-cell', dish: 'circuit-board', vats: 'glass-lens', crystal: 'aether-crystal', sail: 'glass-lens', balloon: 'rubber', horn: 'brass-gear', spikes: 'scrap-metal' },
    o: { moss: 'moss-fiber', frost: 'coolant-gel', crystal: 'aether-crystal', rust: 'scrap-metal' },
};

export function itemName(id) { return ITEMS[id] ? ITEMS[id].name : id; }
