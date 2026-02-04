import games from './gamedata.js';

/**
 * GameRenderer - Handles rendering game cards from data
 */
class GameRenderer {
    /**
     * Creates HTML for a single game card
     * @param {Object} game - Game data object
     * @returns {string} HTML string for the game card
     */
    createGameCardHTML(game) {
        const tagsHTML = game.tags
            .map(tag => `<span class="tag">${tag.emoji} ${tag.label}</span>`)
            .join('\n                    ');

        return `
            <div class="game-card ${game.cssClass}" data-game="${game.folder}" data-title="${game.title}">
                <div class="game-preview ${game.cssClass}">
                    <div class="preview-icon">${game.icon}</div>
                </div>
                <div class="game-title">${game.title}</div>
                <div class="game-description">
                    ${game.description}
                </div>
                <div class="game-info">
                    ${tagsHTML}
                </div>
                <button class="play-button">
                    Play Now
                </button>
            </div>
        `;
    }

    /**
     * Renders all game cards into the games grid
     * @param {Array} gamesData - Array of game data objects
     */
    renderGameCards(gamesData) {
        const gamesGrid = document.querySelector('.games-grid');

        if (!gamesGrid) {
            console.error('Games grid container not found');
            return;
        }

        // Clear existing content
        gamesGrid.innerHTML = '';

        // Render each game card
        gamesData.forEach(game => {
            gamesGrid.innerHTML += this.createGameCardHTML(game);
        });

        console.log(`Rendered ${gamesData.length} game card(s)`);
    }
}

/**
 * GameLauncher - Handles opening and launching games
 */
class GameLauncher {
    /**
     * Opens a game in a new window
     * @param {string} gameFolder - The folder name of the game
     * @param {string} gameTitle - The title of the game
     */
    openGame(gameFolder, gameTitle) {
        const gameUrl = `${gameFolder}/index.html`;
        window.open(gameUrl, '_blank');
        console.log(`Launching ${gameTitle} from ${gameUrl}`);
    }

    /**
     * Initialize game launchers for all game cards
     */
    initializeGameCards() {
        const playButtons = document.querySelectorAll('.play-button');

        playButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const gameCard = e.target.closest('.game-card');
                if (gameCard) {
                    const gameFolder = gameCard.dataset.game;
                    const gameTitle = gameCard.dataset.title;
                    this.openGame(gameFolder, gameTitle);
                }
            });
        });

        console.log(`Initialized ${playButtons.length} game launcher(s)`);
    }
}

/**
 * Initialize the application
 */
function initApp() {
    // Render game cards from data
    const renderer = new GameRenderer();
    renderer.renderGameCards(games);

    // Initialize game launchers
    const launcher = new GameLauncher();
    launcher.initializeGameCards();

    // Update game count dynamically
    updateGameCount();
}

/**
 * Updates the total game count in the footer
 */
function updateGameCount() {
    const gameCards = document.querySelectorAll('.game-card');
    const countElement = document.querySelector('footer strong');

    if (countElement) {
        countElement.textContent = gameCards.length;
    }
}

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export for potential use in other modules
export { GameRenderer, GameLauncher, initApp, updateGameCount };
