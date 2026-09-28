// Palettes and options for people (player, villagers, the Mayor).
export const SKIN = ['#fde0c8', '#f5c7a1', '#e8b088', '#d39a6a', '#b87a4b', '#98603a', '#744426', '#4f2e1a'];
export const HAIR_COLORS = ['#2b1b12', '#4a2c17', '#7a4a24', '#b3702e', '#e0b050', '#f2e3a0', '#c9c4bd', '#a0342c', '#6a4c9c', '#3a7a78'];
export const EYES = ['#2c2c3a', '#4a3020', '#2e6a9a', '#3e7a3a', '#7a5a2a', '#6a3a8a'];
export const CLOTH = ['#d94c4c', '#e8904a', '#e8c84a', '#6aa84f', '#3f8a7a', '#4a7ad9', '#6a4ab0', '#c060a0', '#f0ece0', '#4a4a58'];
export const HAIR_STYLES = ['short', 'bob', 'long', 'spiky', 'bun', 'curly', 'ponytail', 'shaved'];
export const ACCESSORIES = ['none', 'hat', 'flower', 'glasses', 'scarf', 'beanie'];
export const ACC_NAMES = { none: 'None', hat: 'Straw hat', flower: 'Flower', glasses: 'Glasses', scarf: 'Scarf', beanie: 'Beanie' };

export function randomLook(rng) {
    return {
        skin: rng.int(0, SKIN.length - 1), hair: rng.int(0, HAIR_STYLES.length - 1), hairColor: rng.int(0, HAIR_COLORS.length - 1),
        eyes: rng.int(0, EYES.length - 1), top: rng.int(0, CLOTH.length - 1), bottom: rng.int(0, CLOTH.length - 1),
        acc: rng.int(0, ACCESSORIES.length - 1),
    };
}
