// The guild's roster on day one. Stats run 1..5: might, wits, arcana, stealth. `face` is a CAST id for those
// with a painted portrait; the rest are drawn from `look`.

export const ROSTER = [
    { id: 'garrick', name: 'Garrick "Stormcrow"', cls: 'Ranger', rank: 4, mgt: 4, wit: 5, arc: 2, stl: 4, face: 'garrick', note: 'A legend who mostly wants a quiet chair. Never refuses the guild.' },
    { id: 'kael', name: 'Kael Thornwood', cls: 'Swordsman', rank: 3, mgt: 5, wit: 3, arc: 1, stl: 2, face: 'kael', note: 'Does not talk about the Hollowdeep.' },
    { id: 'sera', name: 'Seraphine Vale', cls: 'Mage', rank: 2, mgt: 1, wit: 4, arc: 5, stl: 2, face: 'sera', note: 'Has been Silver for forty years, on purpose.' },
    { id: 'fenna', name: 'Fenna Marsh', cls: 'Scout', rank: 2, mgt: 3, wit: 4, arc: 1, stl: 4, look: { skin: '#c68a5e', hair: '#5a3d24', style: 'bob', eyes: '#3d5a3a', outfit: '#4d5d3a', trim: '#c9b98a' }, note: 'Knows every ditch between here and the coast.' },
    { id: 'mirelle', name: 'Mirelle Dusk', cls: 'Illusionist', rank: 2, mgt: 1, wit: 3, arc: 4, stl: 4, look: { skin: '#e8cdb8', hair: '#7a2f5a', style: 'long', eyes: '#5a8fa8', outfit: '#31264a', trim: '#d98ac0' }, note: 'May or may not be standing where you think.' },
    { id: 'dorn', name: 'Dorn Ironfoot', cls: 'Shieldbearer', rank: 1, mgt: 4, wit: 2, arc: 1, stl: 1, look: { skin: '#d7a17a', hair: '#a8562a', style: 'short', eyes: '#4a3a2a', outfit: '#5c5f66', trim: '#c97a3a', extra: ['beard', 'broad'] }, note: 'A dwarf. Counts every coin twice and every ally once.' },
    { id: 'lyra', name: 'Lyra Quickstring', cls: 'Bard-archer', rank: 1, mgt: 2, wit: 3, arc: 2, stl: 3, look: { skin: '#f0cfae', hair: '#e2c15a', style: 'bun', eyes: '#3a6a8a', outfit: '#8a3a4a', trim: '#f0e0a0' }, note: 'Writes a ballad about every quest. Some are accurate.' },
    { id: 'oswin', name: 'Brother Oswin', cls: 'Cleric', rank: 1, mgt: 2, wit: 3, arc: 4, stl: 1, look: { skin: '#a8754f', hair: '#2a2420', style: 'tuft', eyes: '#3a3a2a', outfit: '#d8d0b8', trim: '#b08a3a' }, note: 'Blesses the stew. Bram allows it.' },
    { id: 'nyx', name: 'Nyx', cls: 'Rogue', rank: 0, mgt: 2, wit: 4, arc: 2, stl: 5, face: 'nyx', note: 'Registered Copper. Nobody believes it.' },
    { id: 'pip', name: 'Pip Underhill', cls: 'Squire', rank: 0, mgt: 3, wit: 1, arc: 1, stl: 1, face: 'pip', note: 'Has a sword. Has named the sword.' },
    { id: 'tamsin', name: 'Tamsin Reed', cls: 'Hedge-witch', rank: 0, mgt: 1, wit: 3, arc: 3, stl: 2, face: 'tamsin', note: 'Her hexes work. Mostly on the right person.' },
    { id: 'jorun', name: 'Jorun Halfhand', cls: 'Brawler', rank: 0, mgt: 4, wit: 1, arc: 1, stl: 2, look: { skin: '#e2b08c', hair: '#6a6a6a', style: 'short', eyes: '#5a4a3a', outfit: '#6a3a2a', trim: '#b0a080', extra: ['stubble', 'broad'] }, note: 'Lost two fingers to a mimic. Still opens every chest.' },
];

export const ROSTER_BY_ID = Object.fromEntries(ROSTER.map((a) => [a.id, a]));
