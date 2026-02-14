// Global game state management

export const state = {
    // Player reference
    player: null,
    playerClass: 'ranger',

    // Game stats
    kills: 0,
    timeAlive: 0,
    currentWave: 1,

    // Gameplay state
    isPaused: false,
    isGameOver: false,

    // Player stats (for upgrades)
    playerStats: {
        damage: 1.0,
        fireRate: 1.0,
        moveSpeed: 1.0,
        maxHp: 1.0,
        pickupRadius: 1.0,
    },

    // Upgrade tracking
    upgrades: {},

    // Reset state for new game
    reset() {
        this.kills = 0;
        this.timeAlive = 0;
        this.currentWave = 1;
        this.isPaused = false;
        this.isGameOver = false;
        // Note: playerClass is preserved between games
        this.playerStats = {
            damage: 1.0,
            fireRate: 1.0,
            moveSpeed: 1.0,
            maxHp: 1.0,
            pickupRadius: 1.0,
        };
        this.upgrades = {};
    }
};
