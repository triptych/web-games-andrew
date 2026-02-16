/**
 * Texture Management Module
 * Handles loading and slicing sprites for raycasting
 */

let k = null;
let texturesLoaded = false;

// Texture slices for raycasting
export const textures = {
    wall: {
        slices: [],
        data: null,
        width: 0,
        height: 0,
    },
    // Add more textures as needed
};

/**
 * Initialize texture system and load sprites
 */
export function initTextures(kaplay) {
    k = kaplay;

    console.log('Initializing textures... texturesLoaded:', texturesLoaded, 'slices:', textures.wall.slices.length);

    // If already loaded and processed, reuse existing textures
    if (texturesLoaded && textures.wall.slices.length > 0) {
        console.log('Textures already loaded and processed, reusing existing slices');
        return;
    }

    // Load wall texture
    k.loadSprite("wall", "sprites/brick_wall.png");

    // Function to process textures once loaded
    const processTextures = () => {
        console.log('Processing texture slices...');

        try {
            // Get wall sprite data
            const wallSprite = k.getSprite("wall");
            console.log('Got wallSprite:', !!wallSprite, 'has data:', !!(wallSprite && wallSprite.data));

            if (wallSprite && wallSprite.data) {
                // Clear existing slices
                textures.wall.slices = [];

                textures.wall.data = wallSprite.data;
                textures.wall.width = wallSprite.data.width;
                textures.wall.height = wallSprite.data.height;

                // Create vertical slices for raycasting
                // Each slice is 1 pixel wide
                for (let i = 0; i < wallSprite.data.width; i++) {
                    const quad = new k.Quad(
                        i / wallSprite.data.width,
                        0,
                        1 / wallSprite.data.width,
                        1
                    );
                    textures.wall.slices.push(
                        wallSprite.data.frames[0].scale(quad)
                    );
                }

                console.log(`✓ Wall texture sliced: ${textures.wall.slices.length} slices from ${wallSprite.data.width}x${wallSprite.data.height} texture`);
                texturesLoaded = true;
            } else {
                console.warn('Wall sprite not ready');
            }
        } catch (e) {
            console.error('Error processing textures:', e);
        }
    };

    // Wait for sprites to load
    k.onLoad(() => {
        console.log('onLoad callback fired, texturesLoaded:', texturesLoaded);
        if (!texturesLoaded) {
            processTextures();
        }
    });

    // Also try immediate processing (in case sprite is cached from previous scene)
    setTimeout(() => {
        if (!texturesLoaded) {
            console.log('Attempting immediate texture processing after timeout...');
            processTextures();
        }
    }, 50);
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
    // For now, all walls use the same texture
    // In the future, you could map wallType to different textures
    if (!texturesLoaded || textures.wall.slices.length === 0) {
        return null;
    }

    // Normalize u to 0-1 range
    u = u - Math.floor(u);

    // Get the appropriate slice index
    const sliceIndex = Math.floor(u * (textures.wall.width - 1));

    return {
        slice: textures.wall.slices[sliceIndex],
        tex: textures.wall.data.tex,
    };
}
