// ARCANA WAGON — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'arcana-wagon.v1';

export const STEP = 1 / 60;               // the sim only paces timers; every story move is a command
export const MAX_FRAME = 0.1;

export const DAYS = 7;                    // the last one is the Harvest Moon Festival
export const HAND = 6;                    // cards dealt for a reading
export const BEATS = 3;                   // Past, Present, Future

// Seconds the sim waits on a thing the view is animating.
export const TIMING = {
    arrive: 3.0,          // the client walks in and sits
    vision: 1.5,          // between one vision appearing in the ball and the next
    omenAt: 0.9,          // the omen comes after the ball starts to clear
    flip: 2.4,            // the three cards turn over
    leave: 1.6,           // the client gets up and goes
    dayIntro: 2.6,        // the "Day N" card (also skippable)
};

// Fortune-teller ranks: XP needed, name, Focus charges per day.
export const RANKS = [
    { xp: 0,   name: 'Fledgling Seer',     focus: 1, perk: 'You can clear one clouded vision a day with Focus.' },
    { xp: 50,  name: 'Wagon Seer',         focus: 2, perk: 'A second Focus a day.' },
    { xp: 150, name: 'Reader of Veils',    focus: 2, perk: 'The universe speaks plainly now: every omen is understood.' },
    { xp: 290, name: 'Oracle of the Road', focus: 3, perk: 'A third Focus a day, and the cards fall kinder: one fewer false lead.' },
    { xp: 460, name: 'Arcanist Royal',     focus: 3, perk: 'All the colours of fate are yours.' },
];

export const STYLES = ['truth', 'kind', 'bold'];
export const STYLE_NAME = { truth: 'Plain truth', kind: 'Gentle words', bold: 'A grand show' };

// How many clues the plot has, and the points the ending is read from.
export const CLUES = ['ledger', 'orders', 'rota', 'cupbearer', 'envoy'];
export const ROMANCE_MIN = 9;            // affection for "a sweetheart" at the festival
export const ROMANCE_LOVE = 13;          // affection for "love"
