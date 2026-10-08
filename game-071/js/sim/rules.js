/**
 * rules.js — game-rule constants the simulation needs (kept out of config.js, which reads the
 * page URL and so isn't pure).
 */
export const DIFFICULTY = {
    story:  { name: 'Story',  dealt: 2.0,  taken: 0.5 },
    easy:   { name: 'Easy',   dealt: 1.5,  taken: 0.75 },
    normal: { name: 'Normal', dealt: 1.0,  taken: 1.0 },
    hard:   { name: 'Hard',   dealt: 0.75, taken: 1.5 },
    deadly: { name: 'Deadly', dealt: 0.5,  taken: 2.0 },
};
