// CLEAN SLATE — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.2.0';
export const SAVE_KEY = 'clean-slate.v1';

export const STEP = 1 / 120;              // fixed step for the frame loop (the sim itself is turn-based)
export const MAX_FRAME = 0.05;

export const RUN = {
    resolve: 40,            // starting (and most) Resolve: the run's health
    hand: 5,                // cards drawn each round
    tips: 6,                // starting tips
    minDeck: 8,             // Let Go can't shrink the deck below this
    notorietyStep: 4,       // every this much Notoriety, each rival blow hits 1 harder
    pours: 1,               // Pour One Out: discard a card (a Grudge is gone for the night) and draw one
    reward: { 1: 8, 2: 11, 3: 14 },   // tips for winning a night, by act
    bossReward: 18,
    healAfter: 3,           // Resolve back after any night you win
    farewell: { tips: 6, heal: 4 },   // "see them out" instead of a partnership
    rest: 0.4,              // the Rest chore heals this share of most Resolve
    taint: 2,               // settling a tainted card without a Hearth card hurts this much
    bounty: 3,              // tips for settling a bounty card
    grudge: 1,              // a Grudge still in hand at round end hurts this much
    warrant: 2,             // Captain Varr: every Blade you use costs this much Resolve
    flex: 1,                // your cards meet the rival within this much of 13 (rival pairs must be exact)
    clean: 1,               // Composure for an exact 13 with a hand card (a Clean pair)
    hitScale: { 1: 1.4, 2: 1.8, 3: 2.1 },   // rival blows, by act (tuned against the bot: see game-plan.md)
    market: 4,              // cards on offer each day
    interlude: 0.6,         // chance of an interlude on a day (while unused ones remain)
};

/** Tips for the n-th settle in one round (1-based): 1, 1, 2, 2, 2, 3, ... */
export const settleTips = (n) => 1 + (n >= 3 ? 1 : 0) + (n >= 6 ? 1 : 0);
