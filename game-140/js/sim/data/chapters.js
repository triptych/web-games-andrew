// The shape of the journey: chapters in order, the scenes and the ward each holds, and the seven wards themselves.
// A chapter's `segs` run in order: a string is a scene id (data/story.js), { ward } is a ward-lock, { camp } a night
// at the fire (data/camps.js). After a chapter, the journey map shows the road to the next one.

/** The seven hues, in the order of the colour wheel. The view's shader restores each as a band of hue. */
export const HUES = [
    { id: 'red', name: 'Crimson', css: '#d2463c', lo: 0.955, hi: 0.035 },
    { id: 'orange', name: 'Amber', css: '#e8822c', lo: 0.035, hi: 0.105 },
    { id: 'gold', name: 'Gold', css: '#e8c25a', lo: 0.105, hi: 0.2 },
    { id: 'green', name: 'Verdant', css: '#4fb46a', lo: 0.2, hi: 0.45 },
    { id: 'blue', name: 'Sapphire', css: '#3a8fd8', lo: 0.45, hi: 0.64 },
    { id: 'indigo', name: 'Indigo', css: '#5d5fc4', lo: 0.64, hi: 0.74 },
    { id: 'violet', name: 'Violet', css: '#a77ad8', lo: 0.74, hi: 0.955 },
];

/**
 * The seven runes on the ward-locks, one per Word the book teaches. A ward's `key` names the rune each ring must
 * show at the top, outermost ring first. `couple[i]` lists [ring, factor] pairs that turn when ring i turns.
 */
export const RUNES = ['kindling', 'making', 'seeing', 'growing', 'passage', 'binding', 'dreaming'];
export const RUNE_HUE = { kindling: 0, making: 1, seeing: 2, growing: 3, passage: 4, binding: 5, dreaming: 6 };

export const WARDS = {
    rose: {
        name: 'The Rose Ward', hue: 0, word: 'kindling', place: 'Hollowmere', slots: 8, rings: 2, couple: [[], []],
        key: ['kindling', 'kindling'], moves: [3, 6],
        verse: 'Under the water a heart is kept cold. Set the flame above the flame, and the heart remembers.',
    },
    forge: {
        name: 'The Forge Ward', hue: 1, word: 'making', place: 'Cinderhold', slots: 8, rings: 2, couple: [[[1, 1]], []],
        key: ['making', 'kindling'], moves: [4, 8],
        verse: 'The hammer moves the anvil. Fire first beneath, then the maker\'s mark above it.',
    },
    tide: {
        name: 'The Tide Ward', hue: 4, word: 'passage', place: 'Merrowgate', slots: 8, rings: 3, couple: [[], [[2, -1]], []],
        key: ['passage', 'making', 'kindling'], moves: [5, 9],
        verse: 'What the sea takes it turns the other way. Open the road, and the deep gives back.',
    },
    wood: {
        name: 'The Heartwood Ward', hue: 3, word: 'growing', place: 'the Eldwood', slots: 8, rings: 3, couple: [[[1, 1]], [[2, 1]], []],
        key: ['growing', 'passage', 'making'], moves: [5, 10],
        verse: 'Root turns branch and branch turns leaf. Wake the outer ring last, as a tree wakes from its crown.',
    },
    sun: {
        name: 'The Sun Ward', hue: 2, word: 'seeing', place: 'Aurelfield', slots: 8, rings: 3, couple: [[[2, -1]], [[0, 1]], [[1, -1]]],
        key: ['seeing', 'growing', 'kindling'], moves: [6, 11],
        verse: 'Every ring answers another. Look at all three before you turn one.',
    },
    star: {
        name: 'The Star Ward', hue: 5, word: 'binding', place: 'the Starfall Peaks', slots: 8, rings: 4, couple: [[[1, 1]], [[2, -1]], [[3, 1]], []],
        key: ['binding', 'seeing', 'passage', 'growing'], moves: [6, 12],
        verse: 'The stars are kept in order. Each one you move, moves the one beneath.',
    },
    dream: {
        name: 'The Last Ward', hue: 6, word: 'dreaming', place: 'Vael Sanctum', slots: 8, rings: 4, couple: [[[2, 1]], [[3, -1]], [[1, 1]], [[0, -1]]],
        key: ['dreaming', 'binding', 'seeing', 'kindling'], moves: [7, 13],
        verse: 'Seven Words, one door. Dream it open.',
    },
};
export const WARD_ORDER = ['rose', 'forge', 'tide', 'wood', 'sun', 'star', 'dream'];

export const CHAPTERS = [
    { id: 'prologue', title: 'Ash and Vellum', place: 'Ravenmoor', map: [0.2, 0.3], segs: ['prologue', 'flight'] },
    { id: 'ch1', title: 'The Drowned Rose', place: 'Hollowmere', map: [0.27, 0.52], segs: ['hollowmere', { ward: 'rose' }, 'rose-bloom', 'hierarch'] },
    { id: 'ch2', title: 'Hammer and Hush', place: 'Cinderhold', map: [0.45, 0.62], segs: ['cinderhold', 'caius-forge', { ward: 'forge' }, 'forge-bloom', { camp: 1 }] },
    { id: 'ch3', title: 'Salt and Ink', place: 'Merrowgate', map: [0.64, 0.8], segs: ['merrowgate', 'storm', { ward: 'tide' }, 'tide-bloom', { camp: 2 }] },
    { id: 'ch4', title: 'The Sleeping Wood', place: 'the Eldwood', map: [0.78, 0.55], segs: ['eldwood', { ward: 'wood' }, 'wood-bloom', { camp: 3 }] },
    { id: 'ch5', title: 'The Golden Silence', place: 'Aurelfield', map: [0.6, 0.38], segs: ['aurelfield', 'caius-sun', { ward: 'sun' }, 'sun-bloom', { camp: 4 }] },
    { id: 'ch6', title: 'Where the Stars Were Kept', place: 'the Starfall Peaks', map: [0.8, 0.18], segs: ['starfall', 'confession', 'bridge', { ward: 'star' }, 'star-bloom', { camp: 5 }] },
    { id: 'ch7', title: 'The Last Ward', place: 'Vael Sanctum', map: [0.47, 0.2], segs: ['sanctum', 'throne', { ward: 'dream' }, 'dream-bloom'] },
    { id: 'epilogue', title: 'The World in Colour', place: 'Velmaris', map: [0.47, 0.2], segs: ['epilogue'] },
];

export const CAMP_TALKS = 2;            // conversations a night at the fire allows
