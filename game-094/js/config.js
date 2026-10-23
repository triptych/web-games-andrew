// THE LONG HELIX — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'the-long-helix.v1';

export const MAX_ITEMS = 6;           // the whole pack
export const HEALTH_MAX = 10;
export const CLARITY_MAX = 10;
export const UND_MAX = 100;           // "genome decoded", %

export const START_DAY = 41;
export const START_MIN = 6 * 60 + 12; // 06:12
export const ARDENT_DAY = 60;         // the supply ship; on this day the story ends without you

export const STATS = ['ANL', 'FLD', 'INT', 'WIL'];
export const STAT_NAMES = { ANL: 'ANALYSIS', FLD: 'FIELDCRAFT', INT: 'INTUITION', WIL: 'WILL' };

// the 1-bit scene pictures; 240×116 is 720×348 (the Hercules frame) divided by three
export const ART = { w: 240, h: 116 };

export const TYPE_CPS = { slow: 45, normal: 110, fast: 260, instant: Infinity };
export const REVEAL_ROWS_PER_SEC = 150;   // how fast a picture is drawn, top to bottom
