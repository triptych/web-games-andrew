// Town upgrades: permanent perks bought with gold, goods and Lore. `fx` keys are summed (or, for
// the ones ending in Mul, added to 1) into G.mods by recomputeMods().

export const BRANCHES = {
    gather: { name: 'Gathering', icon: '🪓' },
    craft: { name: 'Crafting', icon: '🔨' },
    heroes: { name: 'Heroes', icon: '⚔️' },
    town: { name: 'Town', icon: '🏡' },
};

const U = [];
const up = (id, branch, name, icon, hall, cost, text, fx, req = []) => U.push({ id, branch, name, icon, hall, cost, text, fx, req });

// gathering
up('axes', 'gather', 'Sharper Axes', '🪓', 1, { gold: 60, wood: 30 }, 'Wood gathering +20%.', { woodMul: 0.2 });
up('picks', 'gather', 'Iron Picks', '⛏️', 2, { gold: 90, stone: 40 }, 'Stone, ore and coal +20%.', { stoneMul: 0.2 });
up('seeds', 'gather', 'Seed Selection', '🌱', 2, { gold: 90, wheat: 20 }, 'Farms, orchards and gardens +20%.', { farmMul: 0.2 });
up('nets', 'gather', 'Better Nets', '🥅', 3, { gold: 120, fiber: 20 }, 'Fishing +25%.', { fishMul: 0.25 });
up('baskets', 'gather', 'Sturdy Baskets', '🧺', 2, { gold: 100, wood: 60 }, 'Storage space +25%.', { capMul: 0.25 });
up('lamps', 'gather', 'Lantern Shifts', '🏮', 3, { gold: 150, plank: 10 }, 'Work after dark at 65% instead of 35%.', { nightWork: 0.3 });
up('guides', 'gather', 'Forest Guides', '🧭', 3, { gold: 140, plank: 10 }, 'Nearby trees and boulders help twice as much.', { nearMul: 1 });
up('foresters', 'gather', 'Master Foresters', '🌲', 4, { gold: 320, plank: 30, ingot: 6 }, 'Wood +30%, stone +30%.', { woodMul: 0.3, stoneMul: 0.3 }, ['axes', 'picks']);
up('husbandry', 'gather', 'Gentle Hands', '🐑', 4, { gold: 300, cloth: 10 }, 'Eggs and honey +30%.', { husbMul: 0.3 });
// crafting
up('hands', 'craft', 'Quick Hands', '✋', 2, { gold: 100, wood: 40 }, 'Crafters work 15% faster.', { craftSpeed: 0.15 });
up('spices', 'craft', 'Spice Rack', '🧂', 2, { gold: 110, herb: 15 }, 'Dishes sell for 15% more and buffs last a quest longer.', { dishPrice: 0.15, buffDur: 1 });
up('furnace', 'craft', 'Efficient Furnace', '🔥', 4, { gold: 300, stone: 80, ingot: 5 }, 'Smelting needs 25% less coal.', { coalCut: 0.25 });
up('tools', 'craft', 'Fine Tools', '🛠️', 4, { gold: 340, ingot: 10 }, 'Gear you craft is 10% stronger.', { gearMul: 0.1 });
up('cellar', 'craft', 'Pantry Cellar', '🗄️', 3, { gold: 150, stone: 60 }, 'Room for 50% more dishes, potions and gear.', { goodsCap: 0.5 });
up('chef', 'craft', 'Master Chef', '👨‍🍳', 3, { gold: 220, flour: 10 }, 'A 20% chance a cooking job makes an extra portion.', { extraPortion: 0.2 });
up('primer', 'craft', 'Alchemy Primer', '📜', 5, { gold: 520, lore: 6 }, 'Potions are 25% stronger.', { potionMul: 0.25 });
up('assembly', 'craft', 'Assembly Line', '🏭', 5, { gold: 600, ingot: 15, lore: 8 }, 'Crafters work 20% faster.', { craftSpeed: 0.2 }, ['hands']);
// heroes
up('training', 'heroes', 'Training Yard', '🎯', 2, { gold: 100, wood: 50 }, 'Heroes earn 20% more XP.', { heroXp: 0.2 });
up('charter', 'heroes', 'Guild Charter', '📜', 3, { gold: 200, plank: 15 }, 'Room for two more heroes.', { heroCap: 2 });
up('maps', 'heroes', "Ranger's Maps", '🗺️', 3, { gold: 180, fiber: 20 }, 'Quests take 15% less time.', { questTime: 0.15 });
up('rations', 'heroes', 'Field Rations', '🥖', 2, { gold: 90, wheat: 20 }, 'Heroes get hungry 25% slower.', { hunger: 0.25 });
up('beds', 'heroes', 'Soft Beds', '🛌', 3, { gold: 160, cloth: 8 }, 'Heroes recover energy 40% faster.', { sleep: 0.4 });
up('boards', 'heroes', 'Bounty Boards', '📌', 3, { gold: 170, plank: 12 }, 'Two more quests on the board.', { board: 2 });
up('hunters', 'heroes', 'Treasure Hunters', '💰', 4, { gold: 340, cloth: 10 }, 'Quests pay 20% more gold.', { questGold: 0.2 });
up('songs', 'heroes', 'Tavern Songs', '🎶', 3, { gold: 180, honey: 6 }, 'Heroes are happier: +10 mood.', { heroMood: 10 });
up('tactics', 'heroes', 'Veteran Tactics', '🛡️', 5, { gold: 650, lore: 10 }, 'Hero power +8%.', { heroPower: 0.08 }, ['training']);
// town
up('wagon', 'town', 'Welcome Wagon', '🛒', 2, { gold: 120, wood: 40 }, 'Newcomers arrive 25% sooner and are welcomed automatically.', { welcomeRate: 0.25, autoWelcome: 1 });
up('cozy', 'town', 'Cozy Lanterns', '🕯️', 2, { gold: 110, fiber: 15 }, 'Coziness +15%.', { cozyMul: 0.15 });
up('routes', 'town', 'Trade Routes', '🐪', 3, { gold: 220, plank: 12 }, 'Everything sells for 15% more.', { sellMul: 0.15 });
up('watch', 'town', 'Night Watch', '🌙', 3, { gold: 200, plank: 15 }, 'Defense +20% against raids.', { defenseMul: 0.2 });
up('builders', 'town', "Builders' Guild", '🏗️', 4, { gold: 360, plank: 30 }, 'Building is 25% faster, with one extra builder.', { buildTime: 0.25, builders: 1 });
up('clock', 'town', "Time-Keeper's Clock", '⏰', 3, { gold: 240, lore: 3, plank: 12 }, 'Away longer, away smarter: offline cap +4 hours, efficiency +10%.', { offlineHrs: 4, offlineEff: 0.1 });
up('silver', 'town', 'Silver Lining', '🌤️', 5, { gold: 700, lore: 12 }, 'Offline cap +6 hours, efficiency +15%.', { offlineHrs: 6, offlineEff: 0.15 }, ['clock']);
up('charterroyal', 'town', 'Royal Charter', '👑', 5, { gold: 800, lore: 15 }, 'Renown gains +20%.', { renownMul: 0.2 });

export const UPGRADES = Object.fromEntries(U.map((u) => [u.id, u]));
export const UPGRADE_IDS = U.map((u) => u.id);
