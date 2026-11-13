// Lanternhall — tuning and constants. Shared by the sim, the UI and the tests.

export const VERSION = '1.1.0';
export const SAVE_KEY = 'lanternhall.v1';
export const SLOTS = 3;

export const DAYS = 30;                       // the story runs thirty days, in five chapters of six
export const AP_PER_DAY = 2;                  // free actions each afternoon (three as Vice-Guildmaster)
export const CHAPTERS = ['The New Clerk', 'Copper and Bronze', 'The Audit', 'The Gloam', 'The Deep Lantern'];

// Adventurer ranks, beginner to legend.
export const RANKS = ['Copper', 'Bronze', 'Silver', 'Gold', 'Platinum'];
export const RANK_POW = [6, 10, 16, 25, 38];  // what a rank adds to a party's power
export const QUEST_DIFF = [14, 28, 46, 70, 104];
export const XP_NEXT = [40, 95, 170, 270];    // xp to leave each rank
export const XP_QUEST = 12;                   // xp per (quest rank + 1) on a success
export const FEE = [14, 30, 60, 105, 180];    // the guild's cut by posted rank
export const FEE_MULT = { folk: 1, adv: 1, crown: 1.4, wild: 0.4 };
export const KINDS = ['mgt', 'wit', 'arc', 'stl'];
export const KIND_NAME = { mgt: 'Might', wit: 'Wits', arc: 'Arcana', stl: 'Stealth' };

// Your own ladder. MERIT[i] is the merit needed to be promoted to job i at a review.
export const JOBS = ['Apprentice Clerk', 'Desk Clerk', 'Senior Clerk', 'Quest Officer', 'Vice-Guildmaster', 'Guildmaster'];
export const MERIT = [0, 18, 42, 70, 100];
export const REVIEW_DAYS = [7, 13, 19, 25];
export const VOTE_AT = 50;                    // a faction votes for you at this trust
export const VOTES_NEEDED = 3;

export const START = { gold: 120, renown: 10, integ: 50, trust: { folk: 35, crown: 30, wild: 20, fellow: 35 } };
export const UPKEEP = { base: 20, perChapter: 8 };
export const DEBT = { due: 18, amount: 400, late: 500 };

// Guild rooms. cost[i] buys level i + 1.
export const FAC = {
    board: { name: 'Notice Board', cost: [90, 180, 340], blurb: 'Better-paying work: +10% fees per level. A third petitioner each day from level 2.' },
    tavern: { name: 'The Lamplit Tankard', cost: [80, 170, 320], blurb: 'Nightly takings, and a fuller till.', income: [6, 16, 28, 42] },
    infirm: { name: 'Infirmary', cost: [70, 150, 280], blurb: 'The hurt mend a day sooner per level.' },
    yard: { name: 'Training Yard', cost: [80, 170, 320], blurb: 'Idle adventurers drill: xp each night per level.', xp: [0, 3, 6, 9] },
    vault: { name: 'Vault', cost: [100, 200, 380], blurb: 'Interest on the guild\'s gold each night (1% per level, up to 40).' },
};
export const TILL = { rate: 1 / 3, cap: [18, 30, 45, 60] };   // coins a second, and the most the till takes in a day

// Friendship and romance.
export const AFF_SOFT = 150;
export const VISIT_AFF = 6;
export const HEARTS = [{ aff: 6, day: 2 }, { aff: 20, day: 8 }, { aff: 36, day: 14 }, { aff: 54, day: 20 }];
export const HEARTH_AFF = 70;

// The raid on the Hollowdeep (day 28).
export const RAID = { day: 28, size: 5, pow: [1, 2, 4, 7, 11], won: 36, pyrrhic: 27, dragon: 6, foe: -3, crown: 4, wild: 3, folk: 2, lead: 2, potionMax: 3, at: 55 };

// Mini-games.
export const MG = {
    stamp: { forms: 8, time: 45, strikes: 3 },
    brew: { rounds: [3, 4, 5], kinds: 4 },
    route: { w: 6, h: 5, slack: 2 },
    dice: { rounds: 3, stake: 10, cap: 80 },
    spar: { rounds: 5, xp: 5 },
};

// The nightly assessment. A day's score is the weighted average of the parts that applied that day (0..100);
// GRADES are the lowest score for each letter. Pell expects the merit a promotion needs, spread over its six days.
export const DAY_WEIGHTS = { graded: 40, sent: 20, results: 20, actions: 10, merit: 10 };
export const GRADES = [['S', 95], ['A', 85], ['B', 70], ['C', 55], ['D', 40], ['F', 0]];
export const MERIT_PACE = [3, 4, 5, 5, 5];             // merit a day Pell expects, by chapter
