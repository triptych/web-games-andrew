/**
 * Tunables. The Atari 2600 drew 160x192 visible pixels with a 2:1 pixel aspect,
 * so that is our internal buffer; everything below is in those buffer pixels.
 */

export const VIEW_W = 160;
export const VIEW_H = 192;

/** Containment ring: play happens between the core and the ring wall. */
export const CORE_X = VIEW_W / 2;
export const CORE_Y = VIEW_H / 2;
export const CORE_R = 11;          // core radius: reaching this damages containment
export const RING_R = 86;          // outer wall: motes spawn just outside it

export const POS = 1;
export const NEG = -1;

// ---- Probe ---------------------------------------------------------------
export const PROBE_ACCEL = 260;        // px/s^2 while thrusting
export const PROBE_DRAG = 3.1;         // velocity damping per second
export const PROBE_MAX_SPEED = 62;     // px/s
export const PROBE_R = 3;

// ---- Flux (the economy) --------------------------------------------------
export const FLUX_MAX = 100;
export const FLUX_REGEN = 7.5;         // per second, passive
export const FLUX_PER_ECHO = 1.55;     // cost to shed one echo
export const FLUX_PER_FLIP = 3.0;      // cost to invert polarity
export const FLUX_RECLAIM = 1.25;      // refund for flying back through an echo
export const FLUX_ABSORB_BONUS = 2.2;  // refund for absorbing a mote

// ---- Wake ----------------------------------------------------------------
export const ECHO_INTERVAL = 0.055;    // seconds between sheds while moving
export const ECHO_MIN_GAP = 3.4;       // do not shed if this close to the last echo
export const ECHO_LIFE = 9.0;          // seconds before an echo fades out
export const ECHO_FADE = 1.6;          // seconds of visible fade at end of life
export const ECHO_MAX = 260;           // hard cap, oldest culled first
export const ECHO_R = 2;
export const ECHO_FORCE = 1250;        // field strength constant
export const ECHO_REACH = 26;          // px beyond which an echo exerts nothing
export const ECHO_RECLAIM_R = 4.5;     // fly this close to reclaim

// ---- Motes ---------------------------------------------------------------
export const MOTE_R = 2.5;
export const MOTE_DRIFT = 8.5;         // baseline inward pull, px/s^2
export const MOTE_MAX_SPEED = 46;
export const MOTE_DRAG = 0.55;
export const MOTE_ABSORB_R = 5.0;      // probe contact radius for absorbing
export const PROBE_FORCE_MULT = 2.6;   // the live probe pulls harder than an echo

export const MOTE_KIND = {
    DRIFTER: 'drifter',
    SPLITTER: 'splitter',
    INVERTER: 'inverter',
    LEECH: 'leech',
    ANCHOR: 'anchor'
};

/** Score value per mote class, before the chain multiplier. */
export const MOTE_SCORE = {
    drifter: 10,
    splitter: 15,
    inverter: 25,
    leech: 30,
    anchor: 50
};

// ---- Chains --------------------------------------------------------------
/**
 * Chains are the payoff that makes building a lattice worth more than simply
 * chasing motes one at a time. The cap has to sit high enough that a player who
 * banks a dozen motes in a trap and harvests them in one pass genuinely beats
 * raw volume — a low cap makes skilled play saturate and lose to button-mashing.
 */
export const CHAIN_WINDOW = 2.4;       // seconds to land the next absorb
export const CHAIN_MAX = 40;

// ---- Run -----------------------------------------------------------------
export const CONTAINMENT_MAX = 5;
export const SURGE_EVERY = 5;          // every Nth wave is a surge wave
export const WAVE_BREAK = 2.6;         // seconds of calm between waves
/**
 * Once a wave has finished spawning, the player gets this long to clear the
 * board before the next wave starts anyway. Without it, a player who traps
 * motes well can hold them forever and the run never advances.
 */
export const DRAIN_GRACE = 12.0;
