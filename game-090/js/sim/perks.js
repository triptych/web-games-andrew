// What the Bonds give, in numbers. Rank 0 gives nothing; each rank adds what its line in
// data/story.js BOND_PERKS says.

export function bondPerk(G, who, what) {
    const r = G.bonds[who] || 0;
    switch (`${who}:${what}`) {
        case 'maple:discount': return r >= 4 ? 0.4 : r >= 2 ? 0.25 : 0;
        case 'maple:extraSkill': return r >= 3 ? 1 : 0;
        case 'quill:shop': return r >= 4 ? 0.25 : r >= 2 ? 0.15 : 0;
        case 'quill:scrap': return r >= 4 ? 0.25 : r >= 3 ? 0.15 : 0;
        case 'dov:xp': return r >= 4 ? 0.15 : r >= 2 ? 0.1 : r >= 1 ? 0.05 : 0;
        case 'dov:endure': return r >= 3 ? 1 : 0;
        case 'ilsa:allout': return r >= 4 ? 0.5 : r >= 2 ? 0.25 : 0;
        case 'ilsa:alloutHalf': return r >= 3 ? 1 : 0;
        case 'wren:rapport': return r >= 2 ? 1 : 0;
        case 'wren:flash': return r >= 4 ? 2 : r >= 3 ? 1 : 0;
        default: return 0;
    }
}
