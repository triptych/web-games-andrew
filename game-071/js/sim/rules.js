/**
 * rules.js — game-rule constants the simulation needs (kept out of config.js, which reads the
 * page URL and so isn't pure).
 */
export const DIFFICULTY = {
    novice:     { dealt: 2.0,  taken: 0.5 },
    apprentice: { dealt: 1.5,  taken: 0.75 },
    adept:      { dealt: 1.0,  taken: 1.0 },
    expert:     { dealt: 0.75, taken: 1.5 },
    master:     { dealt: 0.5,  taken: 2.0 },
};
