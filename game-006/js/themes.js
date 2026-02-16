/**
 * Theme System for Floor Progression
 * Defines texture themes and assigns them based on floor difficulty
 */

// Texture theme definitions - each theme has 4-5 wall textures
export const TEXTURE_THEMES = {
    DUNGEON: {
        name: 'Dungeon',
        description: 'Dark medieval dungeon',
        wallTextures: [
            'sprites/Bricks/DUNGEONBRICKS.png',
            'sprites/Bricks/DUNGEONCELL.png',
            'sprites/Rocks/GRAYROCKS.png',
            'sprites/Bricks/CLAYBRICKS.png',
        ],
        doorTexture: 'sprites/Doors/CREAKYDOOR.png',
    },
    CASTLE: {
        name: 'Castle',
        description: 'Stone castle fortress',
        wallTextures: [
            'sprites/Bricks/CASTLEBRICKS.png',
            'sprites/Bricks/BIGBRICKS.png',
            'sprites/Rocks/FLATSTONES.png',
            'sprites/BuildingTextures/BRICKS.png',
        ],
        doorTexture: 'sprites/Doors/OFFICEDOOR.png',
    },
    INDUSTRIAL: {
        name: 'Industrial',
        description: 'Factory and warehouse',
        wallTextures: [
            'sprites/Industrial/METALTILE.png',
            'sprites/Industrial/PIPES.png',
            'sprites/Industrial/CROSSWALL.png',
            'sprites/Industrial/STORAGE.png',
        ],
        doorTexture: 'sprites/Doors/OFFICEDOOR.png',
    },
    TECH: {
        name: 'Tech',
        description: 'High-tech sci-fi facility',
        wallTextures: [
            'sprites/Tech/HIGHTECH.png',
            'sprites/Tech/HIGHTECHWALL.png',
            'sprites/Tech/HEXAGONS.png',
            'sprites/Tech/DOUBLELIGHTS.png',
        ],
        doorTexture: 'sprites/Doors/SPOOKYDOOR.png',
    },
    URBAN: {
        name: 'Urban',
        description: 'City streets and buildings',
        wallTextures: [
            'sprites/Urban/GRAYWALL.png',
            'sprites/Urban/CHESS.png',
            'sprites/Urban/GARAGE.png',
            'sprites/BuildingTextures/BRICKS.png',
        ],
        doorTexture: 'sprites/Doors/OFFICEDOOR.png',
    },
    HELL: {
        name: 'Hell',
        description: 'Infernal lava realm',
        wallTextures: [
            'sprites/Rocks/LAVAROCKS.png',
            'sprites/Bricks/REDBRICKS.png',
            'sprites/Rocks/SLIMROCKS.png',
            'sprites/Bricks/GOOBRICKS.png',
        ],
        doorTexture: 'sprites/Doors/SPOOKYDOOR.png',
    },
    ICE: {
        name: 'Ice',
        description: 'Frozen wasteland',
        wallTextures: [
            'sprites/Rocks/ICEYROCKS.png',
            'sprites/Bricks/PORCELAINBRICKS.png',
            'sprites/Tech/TINYSQUARES.png',
            'sprites/Rocks/FLATSTONES.png',
        ],
        doorTexture: 'sprites/Doors/CREAKYDOOR.png',
    },
    GOLD: {
        name: 'Gold',
        description: 'Treasure vault',
        wallTextures: [
            'sprites/Rocks/GOLDROCKS.png',
            'sprites/Tech/STARWALLA.png',
            'sprites/Tech/STARWALLB.png',
            'sprites/Bricks/ROUNDBRICKS.png',
        ],
        doorTexture: 'sprites/Doors/SPOOKYDOOR.png',
    },
    FOREST: {
        name: 'Forest',
        description: 'Dense woodland',
        wallTextures: [
            'sprites/Wood/TRUNKS.png',
            'sprites/Wood/BIGTRUNK.png',
            'sprites/Wood/DARKWOOD.png',
            'sprites/Rocks/DIRT.png',
        ],
        doorTexture: 'sprites/Doors/CREAKYDOOR.png',
    },
    SPACE: {
        name: 'Space',
        description: 'Space station',
        wallTextures: [
            'sprites/Tech/TECHWALLA.png',
            'sprites/Tech/TECHWALLB.png',
            'sprites/Tech/LONGLIGHTS.png',
            'sprites/Industrial/SUPPORT.png',
        ],
        doorTexture: 'sprites/Doors/OFFICEDOOR.png',
    },
};

// Theme progression by floor number
export const FLOOR_THEME_PROGRESSION = [
    { floor: 1, theme: 'DUNGEON' },      // Floors 1-2
    { floor: 3, theme: 'CASTLE' },       // Floors 3-4
    { floor: 5, theme: 'INDUSTRIAL' },   // Floors 5-6
    { floor: 7, theme: 'TECH' },         // Floors 7-8
    { floor: 9, theme: 'URBAN' },        // Floors 9-10
    { floor: 11, theme: 'HELL' },        // Floors 11-12
    { floor: 13, theme: 'ICE' },         // Floors 13-14
    { floor: 15, theme: 'GOLD' },        // Floors 15-16
    { floor: 17, theme: 'FOREST' },      // Floors 17-18
    { floor: 19, theme: 'SPACE' },       // Floors 19-20
];

/**
 * Get theme for a specific floor number
 */
export function getThemeForFloor(floorNumber) {
    // Find the appropriate theme based on floor number
    let selectedTheme = FLOOR_THEME_PROGRESSION[0].theme;

    for (let i = FLOOR_THEME_PROGRESSION.length - 1; i >= 0; i--) {
        if (floorNumber >= FLOOR_THEME_PROGRESSION[i].floor) {
            selectedTheme = FLOOR_THEME_PROGRESSION[i].theme;
            break;
        }
    }

    // For floors beyond 20, cycle through all themes with some randomization
    if (floorNumber > 20) {
        const themeKeys = Object.keys(TEXTURE_THEMES);
        const themeIndex = (floorNumber - 1) % themeKeys.length;
        selectedTheme = themeKeys[themeIndex];
    }

    return TEXTURE_THEMES[selectedTheme];
}

/**
 * Get a specific wall texture path from a theme
 */
export function getWallTextureFromTheme(theme, wallTypeIndex) {
    if (!theme || !theme.wallTextures) return null;

    // Wrap around if index is out of bounds
    const index = wallTypeIndex % theme.wallTextures.length;
    return theme.wallTextures[index];
}

/**
 * Get all theme names
 */
export function getAllThemeNames() {
    return Object.keys(TEXTURE_THEMES);
}

/**
 * Get theme by name
 */
export function getThemeByName(themeName) {
    return TEXTURE_THEMES[themeName] || TEXTURE_THEMES.DUNGEON;
}
