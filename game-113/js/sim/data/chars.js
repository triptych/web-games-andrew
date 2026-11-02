// The four princesses of the Song-Kingdoms, and everyone else who has a face. `look` drives the pixel painter in
// js/view/people.js; the sim only uses the numbers.

export const PRINCESSES = ['lyra', 'sera', 'mari', 'ingrid'];

export const CHARS = {
    lyra: {
        name: 'Lyra', title: 'Princess of Vellmoor', role: 'beat', lane: 0, color: '#ff6fa6', glow: '#ffb3cf',
        instrument: 'the Heartdrum', hp0: 64, hpG: 9, pow0: 10, powG: 1.7,
        look: { skin: '#f6d2b8', hair: '#b4472f', hairStyle: 'long', dress: '#e2557f', trim: '#ffd1e0', accent: '#ffe27a', crown: 'tiara', eyes: '#4a2f6a' },
        blurb: 'Keeps the BEAT. Her taps hit hardest.',
    },
    sera: {
        name: 'Seraphine', title: 'Princess of the Coral Spires', role: 'melody', lane: 1, color: '#46e0cf', glow: '#a8fff1',
        instrument: 'the Shell Harp', hp0: 54, hpG: 8, pow0: 9, powG: 1.5,
        look: { skin: '#e8c3a6', hair: '#2f7fb3', hairStyle: 'wave', dress: '#2fb5a8', trim: '#d6fff8', accent: '#ff9db0', crown: 'shell', eyes: '#1f4a6a' },
        blurb: 'Plays the MELODY. Her notes heal whoever is hurt most.',
    },
    mari: {
        name: 'Marigold', title: 'Princess of Sunreach', role: 'lyrics', lane: 2, color: '#ffc23d', glow: '#ffe7a3',
        instrument: 'her voice', hp0: 58, hpG: 8, pow0: 9, powG: 1.45,
        look: { skin: '#c98d62', hair: '#f2c14a', hairStyle: 'braid', dress: '#f08a2e', trim: '#fff1c4', accent: '#7bd06a', crown: 'flower', eyes: '#3a2a1a' },
        blurb: 'Sings the LYRICS. Her words weave a ward that soaks up blows.',
    },
    ingrid: {
        name: 'Ingrid', title: 'Princess of Frosthold', role: 'harmony', lane: 3, color: '#9b8cff', glow: '#d6ceff',
        instrument: 'the Rime Horn', hp0: 72, hpG: 10, pow0: 8, powG: 1.3,
        look: { skin: '#f3e4dc', hair: '#e8eef8', hairStyle: 'bun', dress: '#5b4fc4', trim: '#cfe6ff', accent: '#7fd6ff', crown: 'circlet', eyes: '#3b5ea8' },
        blurb: 'Holds the HARMONY. Long notes that strike hard and build resonance.',
    },
};

/** Everyone who talks but never fights. */
export const NPCS = {
    otto: { name: 'O.T.T.O.', color: '#ffcf6a', mech: true },
    bram: { name: 'Sir Bram', color: '#c7d4e8', look: { skin: '#e2b493', hair: '#6a4a2a', hairStyle: 'short', dress: '#6f7f99', trim: '#c9d5e6', accent: '#c23a3a', armor: true, beard: true, eyes: '#2a2a3a' } },
    vorthrax: { name: 'Vorthrax', color: '#c86bff' },
    warden: { name: 'Obsidian Warden', color: '#9aa3c8' },
    narr: { name: '', color: '#cfd6ff' },
    archivist: { name: 'Archivist Nine', color: '#ffd38a', mech: true },
    aldric: { name: 'Prince Aldric', color: '#9fd8ff', look: { pants: true, skin: '#e2b493', hair: '#1d2b4a', hairStyle: 'short', dress: '#2b5f9a', trim: '#e7f3ff', accent: '#ffd35c', eyes: '#1a2a3a' } },
    fenwick: { name: 'Prince Fenwick', color: '#d6f29a', look: { pants: true, skin: '#f0caa6', hair: '#8a5a2a', hairStyle: 'short', dress: '#4f8a3a', trim: '#f3ffd8', accent: '#ffd35c', eyes: '#2a3a1a' } },
    hakon: { name: 'Prince Hakon', color: '#c2e2ff', look: { pants: true, skin: '#e8cfc0', hair: '#c2602a', hairStyle: 'short', dress: '#3a4a6a', trim: '#cfe6ff', accent: '#e8eef8', beard: true, eyes: '#2a3a5a' } },
    maelstra: { name: 'Maelstra', color: '#58d6ff' },
    hollowhay: { name: 'Baron Hollowhay', color: '#ffb347' },
    rimefang: { name: 'Rimefang', color: '#bfe6ff' },
    colossus: { name: 'AUREL-ONE', color: '#ffd76a', mech: true },
    // townsfolk: looks are generated from the id by the painter
    elder: { name: 'Tide Elder', color: '#a8e6ff', look: { skin: '#d9a98a', hair: '#e8e8e8', hairStyle: 'bald', dress: '#2f6f8f', trim: '#bfe8ff', accent: '#ffd35c', beard: true, eyes: '#222' } },
    fisher: { name: 'Fisher Wynn', color: '#a8e6ff', look: { pants: true, skin: '#c48a62', hair: '#3a2a1a', hairStyle: 'short', dress: '#a85a3a', trim: '#f0d8b0', accent: '#2a5a8a', eyes: '#222' } },
    kid: { name: 'Pip', color: '#ffe0a8', look: { pants: true, skin: '#f0caa6', hair: '#d8902a', hairStyle: 'short', dress: '#4a8ad8', trim: '#ffffff', accent: '#ff5a5a', small: true, eyes: '#222' } },
    miller: { name: 'Miller Hobb', color: '#ffe0a8', look: { skin: '#e2b493', hair: '#9a9a9a', hairStyle: 'short', dress: '#8a6a3a', trim: '#f0e0c0', accent: '#5a3a1a', beard: true, eyes: '#222' } },
    farmer: { name: 'Farmer Tilly', color: '#ffe0a8', look: { skin: '#a8714c', hair: '#2a1a10', hairStyle: 'long', dress: '#c85a5a', trim: '#fff0d8', accent: '#e8d070', eyes: '#222' } },
    guard: { name: 'Frost Guard', color: '#cfe6ff', look: { skin: '#f0d8c8', hair: '#d8d8e8', hairStyle: 'short', dress: '#4a5a7a', trim: '#cfe6ff', accent: '#8ab8ff', armor: true, eyes: '#222' } },
    smith: { name: 'Smith Ylva', color: '#cfe6ff', look: { skin: '#e8c8b8', hair: '#c83a2a', hairStyle: 'braid', dress: '#5a4a4a', trim: '#d8c8c8', accent: '#ff9a3a', eyes: '#222' } },
};

export const nameOf = (id) => CHARS[id]?.name ?? NPCS[id]?.name ?? '';
