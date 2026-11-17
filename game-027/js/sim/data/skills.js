// The skill tree, bought with XP between levels. Three branches of three.

export const SKILLS = {
    swap: { id: 'swap', name: 'Tile Swap', branch: 'Efficiency', cost: 80, req: [], active: true, cooldown: 6,
        desc: 'Turn a tile in your hand a quarter turn. Ready again after 6 placements.' },
    steady: { id: 'steady', name: 'Steady Hand', branch: 'Efficiency', cost: 120, req: ['swap'],
        desc: 'Every hand you are dealt holds at least one 1- or 2-cell tile, if the supply has one.' },
    affinity: { id: 'affinity', name: 'Catalyst Affinity', branch: 'Efficiency', cost: 150, req: ['swap'],
        desc: 'Once a level, redraw your hand for free.' },
    sight: { id: 'sight', name: 'Deep Sight', branch: 'Insight', cost: 100, req: [],
        desc: 'See what a buried deposit holds before it is uncovered.' },
    surveyor: { id: 'surveyor', name: 'Surveyor', branch: 'Insight', cost: 160, req: ['sight'],
        desc: 'See the next hand before this one is placed.' },
    vein: { id: 'vein', name: 'Vein Sense', branch: 'Insight', cost: 130, req: ['sight'],
        desc: 'Deposits one clear away from harvest glow, and harvests yield one more.' },
    surge: { id: 'surge', name: 'Surge', branch: 'Power', cost: 90, req: [],
        desc: 'Every combo clear earns 5 more XP, and battle damage rises by 2 per line.' },
    overflow: { id: 'overflow', name: 'Overflow', branch: 'Power', cost: 140, req: ['surge'],
        desc: 'Clearing three or more lines at once scores +60 per line past the second.' },
    reclaim: { id: 'reclaim', name: 'Reclaim', branch: 'Power', cost: 200, req: ['surge'],
        desc: 'Once a level, put your whole hand back into the supply and draw again (the supply grows by what you returned).' },
};
export const SKILL_IDS = Object.keys(SKILLS);
