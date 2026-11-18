// Madame Zahra's wares: temporary help. Costs and limits live in config.js (SHOP); icon is the cell of art/items.webp.

export const ITEMS = {
    potion: { name: 'Health Potion',  icon: 5,  text: 'Restores 15 health.', key: '1' },
    tonic:  { name: 'Stamina Tonic',  icon: 6,  text: 'Restores 20 stamina.', key: '2' },
    hyper:  { name: 'Hyper Gauntlet', icon: 7,  text: 'Your next 25 strikes hit three times as hard.', key: '3' },
    ward:   { name: 'Ward Charm',     icon: 10, text: 'The next 3 hits you take do no harm.', key: '4' },
    blast:  { name: 'Blast Charge',   icon: 8,  text: 'Shatters every ordinary block in a 3×3 square. Traps inside are disarmed; monsters wake stunned.', key: '5', target: true },
    dowse:  { name: 'Dowsing Rod',    icon: 9,  text: 'Shows every hidden trap and monster on this floor.', key: '6' },
};
export const ITEM_ORDER = ['potion', 'tonic', 'hyper', 'ward', 'blast', 'dowse'];
