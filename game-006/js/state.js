/**
 * Global game state management
 */

export const state = {
    // Player reference
    player: null,

    // Game stats
    fps: 60,
    timeAlive: 0,

    // Gameplay state
    isPaused: false,
    isGameOver: false,

    // Reset state for new game
    reset() {
        this.timeAlive = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.fps = 60;
    }
};
