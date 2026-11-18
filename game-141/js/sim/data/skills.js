// The skill tree. One skill point per level; each rank costs one point. needs: { skill: rank } to unlock.
// icon is the cell of art/skills.webp (4x4).

export const BRANCHES = [
    { id: 'pick', name: 'Pickaxe' },
    { id: 'body', name: 'Body' },
    { id: 'stone', name: 'Stonecraft' },
    { id: 'arcane', name: 'Arcana' },
];

export const SKILLS = [
    { id: 'pick', branch: 'pick', name: 'Pickaxe Power', max: 5, icon: 0,
      text: (r) => `+${r} pick power on every block.` },
    { id: 'crit', branch: 'pick', name: 'Lucky Strike', max: 3, icon: 1, needs: { pick: 2 },
      text: (r) => `${r * 12}% chance a strike lands twice as hard.` },
    { id: 'shock', branch: 'pick', name: 'Shockwave', max: 2, icon: 2, needs: { pick: 3 },
      text: (r) => `Breaking a block deals ${r} damage to the ordinary blocks beside it.` },
    { id: 'stamina', branch: 'body', name: 'Endurance', max: 5, icon: 3,
      text: (r) => `+${r * 10} maximum stamina.` },
    { id: 'vitality', branch: 'body', name: 'Vitality', max: 5, icon: 4,
      text: (r) => `+${r * 6} maximum health.` },
    { id: 'armor', branch: 'body', name: 'Ward-weave', max: 3, icon: 5, needs: { vitality: 2 },
      text: (r) => `Take ${r} less damage from every hit (never below 1).` },
    { id: 'forage', branch: 'body', name: 'Forager', max: 2, icon: 6, needs: { stamina: 2 },
      text: (r) => `Food you dig up restores ${r * 50}% more stamina.` },
    { id: 'stone', branch: 'stone', name: 'Stonecraft', max: 3, icon: 7,
      text: (r) => `+${r} damage to sandstone, brick and granite.` },
    { id: 'obsidian', branch: 'stone', name: 'Obsidian Lore', max: 3, icon: 8, needs: { stone: 1 },
      text: (r) => `Obsidian takes ${['a third', 'two thirds', 'full', 'more than full'][r]} of your pick power.` },
    { id: 'crystal', branch: 'stone', name: 'Crystal Song', max: 3, icon: 9, needs: { stone: 1 },
      text: (r) => `Crystal takes ${['a third', 'two thirds', 'full', 'more than full'][r]} of your pick power.` },
    { id: 'dowse', branch: 'arcane', name: 'Dowsing', max: 3, icon: 10,
      text: (r) => ['Nothing yet.', 'Artifacts and chests glint through their blocks.', 'Each new floor shows one hidden danger.', 'Each new floor shows three hidden dangers.'][r] },
    { id: 'greed', branch: 'arcane', name: 'Prospector', max: 3, icon: 11,
      text: (r) => `+${r * 20}% gold from blocks, monsters and chests.` },
    { id: 'glyph', branch: 'arcane', name: 'Glyphreading', max: 1, icon: 12, needs: { dowse: 1 },
      text: (r) => (r ? 'A rune struck out of order fizzles instead of resetting the others.' : 'Runes struck out of order reset the sequence.') },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
