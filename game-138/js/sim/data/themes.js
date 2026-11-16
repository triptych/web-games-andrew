// Level themes: what a level is built of. The view paints the materials (js/view/materials.js); the sim only needs
// the id, the one-letter code for the share link, the elements a theme favours and the words for a level's name.

export const THEMES = {
    burrow:  { code: 'w', name: 'Woodland Burrow', icon: '🌳', wall: 'planks', floor: 'boards', trim: 'roots',
        favour: ['bookshelf', 'table', 'barrels', 'mushfolk', 'campfire'],
        words: ['Burrow', 'Hollow', 'Pantry', 'Snug', 'Larder', 'Den'], adj: ['Rootbound', 'Honeyed', 'Hazel', 'Toasty', 'Acorn'] },
    stone:   { code: 's', name: 'Stone Keep', icon: '🏰', wall: 'blocks', floor: 'flags', trim: 'blocks',
        favour: ['brazier', 'statue', 'chest', 'golem', 'goblin'],
        words: ['Halls', 'Vaults', 'Keep', 'Cloister', 'Undercroft'], adj: ['Old', 'Lantern', 'Quiet', 'Sleepy', 'Granite'] },
    cellar:  { code: 'b', name: 'Brick Cellar', icon: '🧱', wall: 'bricks', floor: 'terracotta', trim: 'bricks',
        favour: ['barrels', 'cauldron', 'goblin', 'table', 'candles'],
        words: ['Cellars', 'Kitchens', 'Brewery', 'Bakehouse', 'Storerooms'], adj: ['Warm', 'Cinnamon', 'Copper', 'Rosy', 'Brick'] },
    cavern:  { code: 'r', name: 'Cavern Rock', icon: '⛰️', wall: 'rock', floor: 'pebbles', trim: 'rock',
        favour: ['slime', 'glowcaps', 'gold', 'golem', 'campfire'],
        words: ['Caverns', 'Grottoes', 'Deeps', 'Galleries', 'Chasms'], adj: ['Echoing', 'Dripping', 'Pebbled', 'Misty', 'Hidden'] },
    ruins:   { code: 'm', name: 'Mossy Ruins', icon: '🌿', wall: 'mossblocks', floor: 'mossflags', trim: 'roots',
        favour: ['statue', 'glowcaps', 'mushfolk', 'slime', 'candles'],
        words: ['Ruins', 'Gardens', 'Shrine', 'Courts', 'Cloisters'], adj: ['Mossy', 'Fern', 'Forgotten', 'Green', 'Gentle'] },
    grotto:  { code: 'c', name: 'Crystal Grotto', icon: '💎', wall: 'crystal', floor: 'glass', trim: 'crystal',
        favour: ['crystals', 'glowcaps', 'gold', 'dragon', 'slime'],
        words: ['Geodes', 'Grotto', 'Glimmerdeep', 'Prism Halls', 'Starvault'], adj: ['Glittering', 'Amethyst', 'Starlit', 'Shimmering', 'Twinkling'] },
    frost:   { code: 'f', name: 'Frost Hollow', icon: '❄️', wall: 'ice', floor: 'snow', trim: 'ice',
        favour: ['crystals', 'campfire', 'brazier', 'golem', 'chest'],
        words: ['Hollow', 'Icewell', 'Rime Halls', 'Snowdeep', 'Frostvault'], adj: ['Frosty', 'Snowy', 'Silver', 'Hushed', 'Pale'] },
};
export const THEME_IDS = Object.keys(THEMES);
export const THEME_BY_CODE = Object.fromEntries(THEME_IDS.map((id) => [THEMES[id].code, id]));

/** The themes a new dungeon starts with, top level first: cozy at the top, glittering at the bottom. */
export const DEFAULT_THEMES = ['burrow', 'stone', 'ruins', 'cavern', 'grotto'];
