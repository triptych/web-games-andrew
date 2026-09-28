import games from './gamedata.js';

// Newest-first ordering used everywhere in the browser
const gamesNewestFirst = [...games].reverse();

const CAROUSEL_INTERVAL_MS = 5000;

// Max dots shown at once; the strip slides a window over the full game list
const CAROUSEL_DOT_WINDOW = 9;

/**
 * GameRenderer - Handles rendering game cards from data
 */
class GameRenderer {
    /**
     * Creates HTML for a single (compact) game card
     * @param {Object} game - Game data object
     * @returns {string} HTML string for the game card
     */
    createGameCardHTML(game) {
        const tagsHTML = game.tags
            .map(tag => `<span class="tag">${tag.emoji} ${tag.label}</span>`)
            .join('\n                    ');

        const searchText = this.getSearchableText(game);

        return `
            <div class="game-card ${game.cssClass}" data-game="${game.folder}" data-title="${game.title}" data-search="${searchText}">
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
     * Builds a lowercase, HTML-attribute-safe blob of searchable text for a game
     * @param {Object} game - Game data object
     * @returns {string}
     */
    getSearchableText(game) {
        const tagLabels = game.tags.map(tag => tag.label).join(' ');
        const raw = `${game.title} ${game.description} ${tagLabels}`.toLowerCase();
        return raw.replace(/"/g, '&quot;');
    }

    /**
     * Renders all game cards into the games grid
     * @param {Array} gamesData - Array of game data objects (already ordered)
     */
    renderGameCards(gamesData) {
        const gamesGrid = document.querySelector('.games-grid');

        if (!gamesGrid) {
            console.error('Games grid container not found');
            return;
        }

        gamesGrid.innerHTML = gamesData.map(game => this.createGameCardHTML(game)).join('');

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
     * Initialize game launchers using event delegation, so this keeps working
     * after the grid or carousel re-renders their cards.
     *
     * Only the Play button launches a game. The card itself is deliberately not
     * clickable: on touch devices a full-card hit area swallows carousel swipes
     * and mistimed arrow taps, launching a game the player did not ask for.
     * @param {string} containerSelector - Selector for the container to delegate from
     */
    initializeGameCards(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        container.addEventListener('click', (e) => {
            const button = e.target.closest('.play-button');
            if (!button) return;

            const card = button.closest('.game-card, .carousel-slide');
            if (!card) return;

            const gameFolder = card.dataset.game;
            const gameTitle = card.dataset.title;
            if (gameFolder) {
                this.openGame(gameFolder, gameTitle);
            }
        });
    }
}

/**
 * Carousel - Cycling showcase of every game in the collection
 */
class Carousel {
    constructor(gamesData) {
        this.games = gamesData;
        this.index = 0;
        this.track = document.querySelector('.carousel-track');
        this.dotsContainer = document.querySelector('.carousel-dots');
        this.prevBtn = document.querySelector('.carousel-arrow-prev');
        this.nextBtn = document.querySelector('.carousel-arrow-next');
        this.counter = document.querySelector('.carousel-counter');
        this.timer = null;
        this.dots = [];
    }

    slideHTML(game) {
        return `
            <div class="carousel-slide ${game.cssClass}" data-game="${game.folder}" data-title="${game.title}">
                <div class="carousel-slide-bg ${game.cssClass}"></div>
                <div class="carousel-slide-content">
                    <div class="carousel-icon">${game.icon}</div>
                    <div class="carousel-text">
                        <h2>${game.title}</h2>
                        <p>${game.description}</p>
                        <div class="game-info">
                            ${game.tags.map(tag => `<span class="tag">${tag.emoji} ${tag.label}</span>`).join('')}
                        </div>
                        <button class="play-button carousel-play-button">Play Now</button>
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        if (!this.track || this.games.length === 0) return;

        this.track.innerHTML = this.games.map(game => this.slideHTML(game)).join('');
        this.dotsContainer.innerHTML = this.games
            .map((game, i) => `<button class="carousel-dot" data-index="${i}" title="${game.title}" aria-label="Go to ${game.title}"></button>`)
            .join('');

        this.dots = Array.from(this.dotsContainer.querySelectorAll('.carousel-dot'));
        this.goTo(0, false);
    }

    goTo(index, animate = true) {
        const count = this.games.length;
        this.index = ((index % count) + count) % count;

        this.track.style.transition = animate ? '' : 'none';
        this.track.style.transform = `translateX(-${this.index * 100}%)`;

        this.updateDots();

        if (this.counter) {
            this.counter.textContent = `${this.index + 1} / ${count}`;
        }
    }

    /**
     * With 40+ games a full dot strip is unreadable, so only a window of dots
     * around the current slide is shown; the rest are hidden.
     */
    updateDots() {
        const count = this.dots.length;
        const windowSize = Math.min(CAROUSEL_DOT_WINDOW, count);
        const half = Math.floor(windowSize / 2);
        const start = Math.min(Math.max(this.index - half, 0), count - windowSize);

        this.dots.forEach((dot, i) => {
            const inWindow = i >= start && i < start + windowSize;
            dot.hidden = !inWindow;
            dot.classList.toggle('active', i === this.index);
            // Fade the dots at the edges of the window to hint there is more
            const edge = inWindow && (i === start || i === start + windowSize - 1) && count > windowSize;
            dot.classList.toggle('edge', edge);
        });
    }

    next() {
        this.goTo(this.index + 1);
    }

    prev() {
        this.goTo(this.index - 1);
    }

    startAutoplay() {
        this.stopAutoplay();
        this.timer = setInterval(() => this.next(), CAROUSEL_INTERVAL_MS);
    }

    stopAutoplay() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    bindControls() {
        this.nextBtn?.addEventListener('click', () => {
            this.next();
            this.startAutoplay();
        });

        this.prevBtn?.addEventListener('click', () => {
            this.prev();
            this.startAutoplay();
        });

        this.dotsContainer?.addEventListener('click', (e) => {
            const dot = e.target.closest('.carousel-dot');
            if (!dot) return;
            this.goTo(Number(dot.dataset.index));
            this.startAutoplay();
        });

        const viewport = document.querySelector('.carousel-viewport');
        viewport?.addEventListener('mouseenter', () => this.stopAutoplay());
        viewport?.addEventListener('mouseleave', () => this.startAutoplay());

        // Arrow keys move through the carousel while it (or its controls) has focus
        document.querySelector('.carousel')?.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.prev();
                this.startAutoplay();
            } else if (e.key === 'ArrowRight') {
                this.next();
                this.startAutoplay();
            } else {
                return;
            }
            e.preventDefault();
        });

        this.bindSwipe(viewport);
    }

    /**
     * Horizontal touch swipe on the viewport steps one slide
     * @param {Element} viewport
     */
    bindSwipe(viewport) {
        if (!viewport) return;

        let startX = null;
        let startY = null;

        viewport.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            this.stopAutoplay();
        }, { passive: true });

        viewport.addEventListener('touchend', (e) => {
            if (startX === null) return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            startX = null;

            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                dx < 0 ? this.next() : this.prev();
            }
            this.startAutoplay();
        }, { passive: true });
    }

    init() {
        this.render();
        this.bindControls();
        this.startAutoplay();
    }
}

/**
 * SearchFilter - Handles the search box and tag-chip filtering of the grid
 */
class SearchFilter {
    constructor(gamesData) {
        this.games = gamesData;
        this.searchInput = document.querySelector('#game-search');
        this.tagFiltersContainer = document.querySelector('#tag-filters');
        this.resultsCount = document.querySelector('#results-count');
        this.noResults = document.querySelector('#no-results');
        this.gamesGrid = document.querySelector('.games-grid');
        this.activeTag = null;
    }

    getAllTags() {
        const tagMap = new Map();
        this.games.forEach(game => {
            game.tags.forEach(tag => {
                if (!tagMap.has(tag.label)) {
                    tagMap.set(tag.label, tag.emoji);
                }
            });
        });
        return Array.from(tagMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    renderTagChips() {
        if (!this.tagFiltersContainer) return;

        const tags = this.getAllTags();
        const allChip = `<button class="tag-chip active" data-tag="">All</button>`;
        const chips = tags
            .map(([label, emoji]) => `<button class="tag-chip" data-tag="${label}">${emoji} ${label}</button>`)
            .join('');

        this.tagFiltersContainer.innerHTML = allChip + chips;
    }

    matchesSearch(game, query) {
        if (!query) return true;
        const haystack = `${game.title} ${game.description} ${game.tags.map(t => t.label).join(' ')}`.toLowerCase();
        return haystack.includes(query);
    }

    matchesTag(game, tag) {
        if (!tag) return true;
        return game.tags.some(t => t.label === tag);
    }

    applyFilters() {
        const query = (this.searchInput?.value || '').trim().toLowerCase();
        const cards = Array.from(this.gamesGrid.querySelectorAll('.game-card'));
        let visibleCount = 0;

        cards.forEach(card => {
            const game = this.games.find(g => g.folder === card.dataset.game);
            const isMatch = game && this.matchesSearch(game, query) && this.matchesTag(game, this.activeTag);
            card.hidden = !isMatch;
            if (isMatch) visibleCount++;
        });

        if (this.resultsCount) {
            this.resultsCount.textContent = query || this.activeTag
                ? `Showing ${visibleCount} of ${cards.length} games`
                : `${cards.length} games`;
        }

        if (this.noResults) {
            this.noResults.hidden = visibleCount !== 0;
        }
    }

    bindEvents() {
        this.searchInput?.addEventListener('input', () => this.applyFilters());

        this.tagFiltersContainer?.addEventListener('click', (e) => {
            const chip = e.target.closest('.tag-chip');
            if (!chip) return;

            this.activeTag = chip.dataset.tag || null;

            this.tagFiltersContainer.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            this.applyFilters();
        });
    }

    init() {
        this.renderTagChips();
        this.bindEvents();
        this.applyFilters();
    }
}

/**
 * Initialize the application
 */
function initApp() {
    // Render game cards (newest first) from data
    const renderer = new GameRenderer();
    renderer.renderGameCards(gamesNewestFirst);

    // Featured carousel of the newest games
    const carousel = new Carousel(gamesNewestFirst);
    carousel.init();

    // Search + tag filtering
    const searchFilter = new SearchFilter(gamesNewestFirst);
    searchFilter.init();

    // Initialize game launchers (delegated, covers grid + carousel)
    const launcher = new GameLauncher();
    launcher.initializeGameCards('.games-grid');
    launcher.initializeGameCards('.carousel-track');

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
export { GameRenderer, GameLauncher, Carousel, SearchFilter, initApp, updateGameCount };
