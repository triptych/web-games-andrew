// ============================================================
// Buildings that go on village lots. Every building occupies a 4x3
// footprint (door at the bottom centre) inside a 6x5 lot.
// ============================================================

export const LOT_W = 6, LOT_H = 5, BLD_W = 4, BLD_H = 3;

export const BUILDINGS = [
    { id: 'workshop',  name: "Carpenter's Workshop", job: 'carpenter',  lvl: 1, cost: { wood: 40, stone: 20 }, gold: 300,  xp: 40, roof: 30,  wall: 35, station: 'sawmill', icon: 'axe' },
    { id: 'farmhouse', name: 'Farmhouse & Mill',     job: 'farmer',     lvl: 1, cost: { wood: 50, stone: 20 }, gold: 400,  xp: 40, roof: 50,  wall: 40, station: 'mill', icon: 'grain' },
    { id: 'forge',     name: 'Forge',                job: 'blacksmith', lvl: 2, cost: { stone: 60, plank: 10, copper_bar: 3 }, gold: 900, xp: 50, roof: 0, wall: 220, station: 'forge', icon: 'bar' },
    { id: 'ranch',     name: 'Ranch House',          job: 'rancher',    lvl: 2, cost: { wood: 60, plank: 10, fiber: 30 }, gold: 800, xp: 50, roof: 5, wall: 30, station: 'dairy', icon: 'milk' },
    { id: 'cafe',      name: 'Café',                 job: 'cook',       lvl: 2, cost: { plank: 15, stone: 30, clay: 10 }, gold: 800, xp: 50, roof: 340, wall: 40, icon: 'bowl' },
    { id: 'coop',      name: 'Coop',                 job: null,         lvl: 2, cost: { wood: 60, plank: 5, stone: 20 }, gold: 500, xp: 30, roof: 15, wall: 40, animals: 'coop', icon: 'egg' },
    { id: 'apothecary',name: 'Apothecary',           job: 'herbalist',  lvl: 3, cost: { plank: 20, brick: 10, tonic: 2 }, gold: 1200, xp: 60, roof: 130, wall: 60, station: 'still', icon: 'potion' },
    { id: 'store',     name: 'General Store',        job: 'merchant',   lvl: 3, cost: { plank: 25, brick: 15, copper_bar: 5 }, gold: 1500, xp: 60, roof: 210, wall: 45, icon: 'sack' },
    { id: 'loft',      name: "Tailor's Loft",        job: 'tailor',     lvl: 3, cost: { plank: 20, rope: 5, fiber: 40 }, gold: 1200, xp: 60, roof: 300, wall: 50, station: 'loom', icon: 'cloth' },
    { id: 'barn',      name: 'Barn',                 job: null,         lvl: 3, cost: { plank: 30, stone: 40, copper_bar: 2 }, gold: 1200, xp: 40, roof: 355, wall: 25, animals: 'barn', icon: 'milk' },
    { id: 'lodge',     name: "Miner's Lodge",        job: 'miner',      lvl: 4, cost: { beam: 6, stone: 80, iron_bar: 3 }, gold: 2000, xp: 70, roof: 25, wall: 230, icon: 'pick' },
    { id: 'tower',     name: 'Watchtower',           job: 'guard',      lvl: 4, cost: { brick: 30, beam: 6, iron_bar: 4 }, gold: 2200, xp: 70, roof: 220, wall: 215, icon: 'sword' },
    { id: 'library',   name: 'Library',              job: 'scholar',    lvl: 4, cost: { plank: 30, brick: 20, cloth: 2 }, gold: 2200, xp: 70, roof: 260, wall: 35, icon: 'scroll' },
    { id: 'greenhouse',name: 'Greenhouse',           job: null,         lvl: 4, cost: { plank: 30, iron_bar: 4, ice_crystal: 3 }, gold: 3000, xp: 60, roof: 180, wall: 120, greenhouse: true, icon: 'seed' },
    { id: 'tavern',    name: 'Tavern',               job: 'bard',       lvl: 5, cost: { beam: 10, brick: 30, gold_bar: 2, honey: 3 }, gold: 3000, xp: 80, roof: 15, wall: 30, icon: 'cup' },
];

export const BUILDING = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

/** The fixed village furniture that isn't on a lot. */
export const JOB_BOARD_COST = { wood: 15 };

export const VILLAGE_LEVELS = [
    { lvl: 1, title: 'Overgrown Glen', xp: 0 },
    { lvl: 2, title: 'Hamlet', xp: 120 },
    { lvl: 3, title: 'Village', xp: 360 },
    { lvl: 4, title: 'Town', xp: 800 },
    { lvl: 5, title: 'Glimmerglen', xp: 1500 },
];

export const LOTS_AT_LEVEL = [0, 6, 9, 12, 15, 18];
