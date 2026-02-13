// Upgrade system - level-up and upgrade selection

import { events } from './events.js';
import { state } from './state.js';
import { sounds } from './sounds.js';

let k;
let unsubscribeCallbacks = [];

// Upgrade definitions
export const UPGRADE_DEFS = {
    damage: {
        id: 'damage',
        name: "Power Shot",
        description: "Increase damage by 25%",
        maxLevel: 5,
        icon: "💥",
        apply: () => {
            state.playerStats.damage *= 1.25;
        },
        getCurrentLevel: () => state.upgrades.damage || 0,
    },
    fireRate: {
        id: 'fireRate',
        name: "Rapid Fire",
        description: "Shoot 20% faster",
        maxLevel: 5,
        icon: "⚡",
        apply: () => {
            state.playerStats.fireRate *= 0.8; // Lower is faster
        },
        getCurrentLevel: () => state.upgrades.fireRate || 0,
    },
    moveSpeed: {
        id: 'moveSpeed',
        name: "Swift Boots",
        description: "Move 20% faster",
        maxLevel: 5,
        icon: "👟",
        apply: () => {
            state.playerStats.moveSpeed *= 1.2;
        },
        getCurrentLevel: () => state.upgrades.moveSpeed || 0,
    },
    maxHp: {
        id: 'maxHp',
        name: "Vitality Boost",
        description: "Increase max HP by 20 and heal 20 HP",
        maxLevel: 5,
        icon: "❤️",
        apply: () => {
            const player = state.player;
            const oldMax = player.maxHp;
            player.maxHp += 20;
            player.hp += 20; // Heal when upgrading
            if (player.hp > player.maxHp) {
                player.hp = player.maxHp;
            }
        },
        getCurrentLevel: () => state.upgrades.maxHp || 0,
    },
    pickupRadius: {
        id: 'pickupRadius',
        name: "Magnetism",
        description: "Increase pickup range by 30%",
        maxLevel: 5,
        icon: "🧲",
        apply: () => {
            state.playerStats.pickupRadius *= 1.3;
        },
        getCurrentLevel: () => state.upgrades.pickupRadius || 0,
    },
};

export function initUpgrades(kaplay) {
    k = kaplay;

    // Clear any existing event listeners from previous game
    unsubscribeCallbacks.forEach(unsub => unsub());
    unsubscribeCallbacks = [];

    // Listen for XP collection
    const xpGainedUnsub = events.on('xpGained', (amount) => {
        const player = state.player;
        if (!player || !player.exists()) return;

        player.xp += amount;

        // Check for level up
        if (player.xp >= player.xpToNext) {
            player.xp -= player.xpToNext;
            player.level++;
            player.xpToNext = Math.floor(player.xpToNext * 1.5); // Scale XP requirement

            events.emit('playerLevelUp', player.level);
        }
    });
    unsubscribeCallbacks.push(xpGainedUnsub);

    // Listen for upgrade selection
    const upgradeSelectedUnsub = events.on('upgradeSelected', (upgradeId) => {
        applyUpgrade(upgradeId);
    });
    unsubscribeCallbacks.push(upgradeSelectedUnsub);
}

// Get random upgrades for selection
export function getRandomUpgrades(count = 3) {
    const availableUpgrades = Object.values(UPGRADE_DEFS).filter(upgrade => {
        const currentLevel = upgrade.getCurrentLevel();
        return currentLevel < upgrade.maxLevel;
    });

    // If not enough upgrades available, return all available
    if (availableUpgrades.length <= count) {
        return availableUpgrades;
    }

    // Shuffle and pick random upgrades
    const shuffled = [...availableUpgrades].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// Apply an upgrade
function applyUpgrade(upgradeId) {
    const upgrade = UPGRADE_DEFS[upgradeId];
    if (!upgrade) {
        console.error('Unknown upgrade:', upgradeId);
        return;
    }

    // Check if max level reached
    const currentLevel = upgrade.getCurrentLevel();
    if (currentLevel >= upgrade.maxLevel) {
        console.warn('Upgrade at max level:', upgradeId);
        return;
    }

    // Track upgrade level
    if (!state.upgrades[upgradeId]) {
        state.upgrades[upgradeId] = 0;
    }
    state.upgrades[upgradeId]++;

    // Apply the upgrade effect
    upgrade.apply();

    // Play sound
    sounds.powerUp();

    console.log(`Applied upgrade: ${upgrade.name} (Level ${state.upgrades[upgradeId]})`);
}
