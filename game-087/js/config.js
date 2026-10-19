// Quillsworn — tuning and constants. Shared by the sim, the UI and the tests. Pure.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'quillsworn.v1';          // the apprentice: progress, settings, the list of novels
export const PROJECT_KEY = 'quillsworn.v1.p.';    // + project id: one key per novel, so a save rewrites one book
export const SAVE_VERSION = 1;

/** XP needed to reach a level: 50(L-1)² + 100(L-1). Level 2 at 150, 10 at 4,950, 30 at 44,950. */
export const MAX_LEVEL = 60;
export const xpForLevel = (L) => 50 * (L - 1) ** 2 + 100 * (L - 1);

export const XP = {
    perWord: 1,              // before the calling and relic bonuses
    characterFleshed: 120,   // once per character, when every core field is filled
    placeFleshed: 60,        // once per world entry
    beatFilled: 40,          // once per beat per structure
    sceneSummary: 10,        // once per scene, for a summary of 8+ words
    sceneRevised: 25,        // once per scene, the first time it's marked revised
    snapshot: 5,             // per snapshot, at most 10 a day
    oracleKeep: 8,           // keeping an Oracle result in the codex
    lessonRead: 15,          // the first time Thalion teaches a lesson
    loomCell: 2,             // weaving a thread into a chapter, first time per cell
};

export const WRITING = {
    dailyGoal: 300,          // default; the apprentice can change it
    pasteNoXp: true,         // pasted words go in the book but earn nothing
};

export const LENGTHS = [      // what a finished work is called, by words (the SFWA's bands)
    { min: 0, name: 'tale' },
    { min: 7500, name: 'novelette' },
    { min: 17500, name: 'novella' },
    { min: 40000, name: 'novel' },
];
export const NOVEL_WORDS = 40000;

export const DUEL = {
    idleGrace: 15,           // seconds without a new word before a foe starts to recover
    taunt: 20,               // seconds between taunts while idle
};

export const FIELD = {
    fleshWords: 40,          // a backstory this long counts as written
    placeWords: 30,          // a world entry's details this long count as written
    beatWords: 12,           // a beat note this long counts as filled
    loglineWords: 12,
    premiseWords: 40,
};
