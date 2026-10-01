/** boosters.js — consumable power-ups. Bought at depots, found in salvage, dropped mid-fight. */

export const BOOSTERS = {
    nanite:  { name: 'Nanite Pack', icon: 'repair', color: '#46ff9a', when: 'any', price: 40, desc: 'Repair 35% of your hull.' },
    battery: { name: 'Cell Battery', icon: 'energy', color: '#ffe14d', when: 'any', price: 35, desc: '+3 energy (can exceed the reactor cap).' },
    emp:     { name: 'EMP Charge', icon: 'emp', color: '#7fe8ff', when: 'any', price: 60, desc: 'Strip every enemy shield, clear jams, and hit every enemy for 12% of its max hull.' },
    coin:    { name: 'Lucky Coin', icon: 'wild', color: '#ffffff', when: 'landed', price: 55, desc: 'After the reels land: the middle of two reels turns wild.' },
    chip:    { name: 'Overdrive Chip', icon: 'core', color: '#ff4dff', when: 'ready', price: 90, desc: 'Start a 2-spin Overdrive: ×2 power, enemies frozen.' },
    patch:   { name: 'Debug Patch', icon: 'patch', color: '#9cffd0', when: 'any', price: 45, desc: 'Erase every Glitch from your strips and unjam every reel.' },
};
export const BOOSTER_IDS = Object.keys(BOOSTERS);
