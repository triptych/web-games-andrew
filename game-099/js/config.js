// FABLECART — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'fablecart.v1';

export const STEP = 1 / 60;               // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// A scene is COLS × ROWS cells; one cell is one 12×12 sticker. The console's picture is
// VW × VH low-res pixels (a HUD strip on top of the scene) and is scaled up by the view.
export const CELL = 12;
export const COLS = 24;
export const ROWS = 14;
export const HUD_H = 12;
export const VW = COLS * CELL;
export const VH = ROWS * CELL + HUD_H;
export const ART = 12;                    // sticker art is ART × ART palette indices

// The console's one palette (Sweetie-16 by GrafxKid, CC0). Art strings use '.' for clear
// and '0'-'9', 'a'-'f' for these sixteen colours.
export const PAL = [
    '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
    '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
];
export const HEX = '0123456789abcdef';

export const THEMES = ['meadow', 'forest', 'cave', 'snow'];   // + 'workshop' for the console room

export const LIMITS = {
    scenes: 4,
    items: 90,              // stickers placed in one scene
    carts: 12,
    customStickers: 40,
    rules: 8,               // rules per sticker
    blocks: 30,             // blocks per rule, counting nested ones
    depth: 4,               // nesting of if / repeat
    maxInst: 130,           // live stickers in a running scene
    actionsPerTick: 160,    // one sticker's blocks per step; stops runaway loops
    name: 14,
    text: 18,
    goal: 60,
    importBytes: 400000,
};

export const HERO_IFRAMES = 0.7;
export const FOE_IFRAMES = 0.15;
export const CONTACT_REFIRE = 0.8;        // a touch hat fires again this often while the touch lasts
export const TOUCH_MARGIN = 0.12;
export const SAY_TIME = 2.2;
