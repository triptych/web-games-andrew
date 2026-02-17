// Game configuration and constants

export const CONFIG = {
    // Display settings
    SCREEN_WIDTH: 900,
    SCREEN_HEIGHT: 600,
    
    // Text settings
    FONT_SIZE: 16,
    LINE_HEIGHT: 20,
    MAX_LINE_WIDTH: 80, // Characters per line
    MAX_BUFFER_LINES: 100,
    
    // Typewriter effect
    TYPEWRITER_SPEED: 20, // Milliseconds per character
    TYPEWRITER_ENABLED: true,
    PAUSE_ON_PUNCTUATION: 50, // Extra pause on . ! ?
    
    // Colors (Classic green terminal)
    COLORS: {
        BACKGROUND: [0, 0, 0],
        TEXT_PRIMARY: [0, 255, 0],
        TEXT_SECONDARY: [0, 200, 0],
        TEXT_HIGHLIGHTED: [255, 255, 0], // Yellow for clickable text
        TEXT_ERROR: [255, 0, 0],
        TEXT_SYSTEM: [128, 128, 128],
        CURSOR: [0, 255, 0],
        LINK: [0, 255, 255] // Cyan
    },
    
    // UI Layout
    UI: {
        PADDING: 20,
        STATUS_BAR_HEIGHT: 30,
        INPUT_HEIGHT: 40,
        SCROLL_SPEED: 3
    },
    
    // Command aliases
    ALIASES: {
        'n': 'north',
        's': 'south',
        'e': 'east',
        'w': 'west',
        'ne': 'northeast',
        'nw': 'northwest',
        'se': 'southeast',
        'sw': 'southwest',
        'u': 'up',
        'd': 'down',
        'l': 'look',
        'x': 'examine',
        'i': 'inventory',
        'inv': 'inventory',
        'g': 'take',
        'get': 'take'
    }
};
