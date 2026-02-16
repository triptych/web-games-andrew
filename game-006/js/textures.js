/**
 * Texture Management Module
 * Handles loading and slicing sprites for raycasting with theme support
 */

let k = null;
let texturesLoaded = false;
let currentTheme = null;

// Texture slices for raycasting - now supports multiple wall types per theme
export const textures = {
    walls: {}, // Map of wall type (1-4) to texture data
    door: null, // Door texture (type 5)
};

/**
 * Initialize texture system
 */
export function initTextures(kaplay) {
    k = kaplay;
    console.log('Texture system initialized');
}

/**
 * Load textures for a specific theme
 * Returns a promise that resolves when textures are loaded
 */
export function loadThemeTextures(theme) {
    if (!k) {
        console.error('Kaplay not initialized');
        return Promise.reject('Kaplay not initialized');
    }

    console.log(`Loading textures for theme: ${theme.name}`);
    currentTheme = theme;
    texturesLoaded = false;

    return new Promise((resolve) => {

    // Clear existing textures
    textures.walls = {};
    textures.door = null;

    // Load wall textures (types 1-4)
    theme.wallTextures.forEach((texturePath, index) => {
        const wallType = index + 1; // Wall types 1-4
        const spriteName = `wall_${wallType}`;
        k.loadSprite(spriteName, texturePath);
    });

    // Load door texture (type 5)
    k.loadSprite('door_texture', theme.doorTexture);

    // Function to process textures once loaded
    const processTextures = () => {
        console.log('Processing theme texture slices...');

        try {
            let allLoaded = true;

            // Process each wall texture
            for (let i = 0; i < theme.wallTextures.length; i++) {
                const wallType = i + 1;
                const spriteName = `wall_${wallType}`;
                const sprite = k.getSprite(spriteName);

                if (sprite && sprite.data) {
                    const slices = [];
                    const width = sprite.data.width;
                    const height = sprite.data.height;

                    // Create vertical slices for raycasting
                    for (let x = 0; x < width; x++) {
                        const quad = new k.Quad(
                            x / width,
                            0,
                            1 / width,
                            1
                        );
                        slices.push(sprite.data.frames[0].scale(quad));
                    }

                    textures.walls[wallType] = {
                        slices,
                        data: sprite.data,
                        width,
                        height,
                    };

                    console.log(`✓ Wall type ${wallType} sliced: ${slices.length} slices from ${width}x${height}`);
                } else {
                    allLoaded = false;
                }
            }

            // Process door texture
            const doorSprite = k.getSprite('door_texture');
            if (doorSprite && doorSprite.data) {
                const slices = [];
                const width = doorSprite.data.width;
                const height = doorSprite.data.height;

                for (let x = 0; x < width; x++) {
                    const quad = new k.Quad(
                        x / width,
                        0,
                        1 / width,
                        1
                    );
                    slices.push(doorSprite.data.frames[0].scale(quad));
                }

                textures.door = {
                    slices,
                    data: doorSprite.data,
                    width,
                    height,
                };

                console.log(`✓ Door texture sliced: ${slices.length} slices`);
            } else {
                allLoaded = false;
            }

            if (allLoaded) {
                texturesLoaded = true;
                console.log(`✓ Theme textures loaded: ${theme.name}`);
                resolve(); // Resolve promise when all textures are loaded
            }
        } catch (e) {
            console.error('Error processing theme textures:', e);
        }
    };

    // Wait for sprites to load
    k.onLoad(() => {
        if (!texturesLoaded) {
            processTextures();
        }
    });

    // Also try immediate processing
    setTimeout(() => {
        if (!texturesLoaded) {
            processTextures();
        }
    }, 100);

    // Fallback timeout
    setTimeout(() => {
        if (!texturesLoaded) {
            console.warn('Texture loading timed out, but continuing anyway');
            resolve();
        }
    }, 2000);
    });
}

/**
 * Check if textures are loaded
 */
export function areTexturesLoaded() {
    return texturesLoaded;
}

/**
 * Get a texture slice for a specific wall type and UV coordinate
 */
export function getWallSlice(wallType, u) {
    // Handle door texture (tile type 5)
    if (wallType === 5) {
        if (!texturesLoaded || !textures.door) {
            return null;
        }

        // Normalize u to 0-1 range
        u = u - Math.floor(u);

        // Get the appropriate slice index
        const sliceIndex = Math.floor(u * (textures.door.width - 1));

        return {
            slice: textures.door.slices[sliceIndex],
            tex: textures.door.data.tex,
        };
    }

    // Handle regular wall textures (types 1-4)
    const wallTexture = textures.walls[wallType];
    if (!texturesLoaded || !wallTexture) {
        return null;
    }

    // Normalize u to 0-1 range
    u = u - Math.floor(u);

    // Get the appropriate slice index
    const sliceIndex = Math.floor(u * (wallTexture.width - 1));

    return {
        slice: wallTexture.slices[sliceIndex],
        tex: wallTexture.data.tex,
    };
}

/**
 * Get current theme
 */
export function getCurrentTheme() {
    return currentTheme;
}
