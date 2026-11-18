// Quest kinds. Each quest counts one of G.stats from the moment it is taken; claiming it pays out and a new
// one takes its place. 'minFloor' keeps a quest from asking for something the player cannot meet yet.

export const QUESTS = {
    blocks:   { stat: 'blocks',   text: (n) => `Break ${n} blocks`,          base: 40, step: 15, gold: 1.0, minFloor: 1 },
    stone:    { stat: 'stone',    text: (n) => `Break ${n} stone blocks`,    base: 15, step: 6,  gold: 2.2, minFloor: 3 },
    floors:   { stat: 'floors',   text: (n) => `Clear ${n} floor${n > 1 ? 's' : ''}`, base: 1, step: 0.34, gold: 40, minFloor: 1 },
    disarm:   { stat: 'disarmed', text: (n) => `Disarm ${n} trap${n > 1 ? 's' : ''}`, base: 2, step: 0.6, gold: 14, minFloor: 1 },
    monsters: { stat: 'monsters', text: (n) => `Defeat ${n} monsters`,      base: 3, step: 1,   gold: 10, minFloor: 1 },
    chests:   { stat: 'chests',   text: (n) => `Open ${n} chest${n > 1 ? 's' : ''}`, base: 1, step: 0.4, gold: 22, minFloor: 2 },
    puzzles:  { stat: 'puzzles',  text: (n) => `Solve ${n} rune or sun puzzle${n > 1 ? 's' : ''}`, base: 1, step: 0.3, gold: 30, minFloor: 3 },
    artifact: { stat: 'art_',     text: (n, kind) => `Find ${n} ${kind === 'tool' ? 'tool' : kind === 'jewel' ? 'jewel' : kind === 'relic' ? 'relic' : 'idol'} artifact`, base: 1, step: 0, gold: 60, minFloor: 1 },
};
