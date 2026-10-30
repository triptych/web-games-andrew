// The hangar's shop: permanent upgrades for the run (they survive losing a ship) and one-off supplies.
// Pure data and queries; game.js applies them. Credits are earned from kills, medals, perfect clears
// and bosses, and are spent at the mothership after each boss.

import { PLAYER } from '../config.js';

/** name, what a level does, how many levels, and the price of each. */
export const UPGRADES = [
    { id: 'engine', name: 'ENGINES',     desc: '+8 ship speed a level',            max: 5, cost: [40, 60, 90, 130, 180] },
    { id: 'cannon', name: 'CANNONS',     desc: '+20% shot damage a level',         max: 5, cost: [50, 75, 110, 160, 220] },
    { id: 'rapid',  name: 'RAPID FIRE',  desc: 'shoots 7% faster a level',         max: 4, cost: [45, 70, 105, 150] },
    { id: 'bay',    name: 'BOMB BAY',    desc: 'carry one more bomb a level',      max: 3, cost: [60, 100, 160] },
    { id: 'magnet', name: 'MAGNET',      desc: 'pulls in capsules and medals',     max: 3, cost: [30, 55, 90] },
    { id: 'shield', name: 'SHIELD CORE', desc: '1: shield each wave. 2: and on respawn', max: 2, cost: [80, 160] },
];

export const UPGRADE_EFFECT = { engineStep: 8, cannonStep: 0.2, rapidStep: 0.07, magnetPick: 7, magnetPull: 26 };

/** One-off supplies: price, whether the hangar can sell it now, and what it does. */
export const SUPPLIES = [
    { id: 'life',  name: 'EXTRA SHIP',   desc: 'one more life',                cost: 150, can: (G) => G.lives < PLAYER.maxLives, apply: (G) => { G.lives++; } },
    { id: 'bomb',  name: 'BOMB',         desc: 'restock a bomb',               cost: 50,  can: (G) => G.bombs < maxBombs(G),     apply: (G) => { G.bombs++; } },
    { id: 'refit', name: 'WEAPON REFIT', desc: 'the gun back to full power',   cost: 100, can: (G) => G.player.weapon < PLAYER.maxWeapon, apply: (G) => { G.player.weapon = PLAYER.maxWeapon; } },
];

/** How many bombs the ship can carry. */
export const maxBombs = (G) => PLAYER.maxBombs + G.upg.bay;

export const freshUpgrades = () => ({ engine: 0, cannon: 0, rapid: 0, bay: 0, magnet: 0, shield: 0 });

/** What the hangar offers for `id` right now: { id, cost, apply }, or null if it is maxed or not for sale. */
export function offer(G, id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (u) {
        const lvl = G.upg[id];
        if (lvl >= u.max) return null;
        return { id, cost: u.cost[lvl], apply: (g) => { g.upg[id]++; if (id === 'bay') g.bombs = Math.min(maxBombs(g), g.bombs + 1); } };
    }
    const s = SUPPLIES.find((x) => x.id === id);
    if (s && s.can(G)) return { id, cost: s.cost, apply: s.apply };
    return null;
}
