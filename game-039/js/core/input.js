/**
 * Keyboard + touch input. Exposes a stable snapshot the game loop reads:
 *   axis {x, y}   normalised thrust direction
 *   flip          edge-triggered invert request this frame
 *   silent        holding the silent-running modifier
 *
 * Touch: left half of the screen is a floating thumb-stick, right half taps to
 * invert. A held touch on the right half is silent running.
 */

const keys = new Set();
let flipQueued = false;
let pauseQueued = false;

const state = {
    axis: { x: 0, y: 0 },
    flip: false,
    silent: false,
    pause: false
};

// --- touch bookkeeping ---
let stickId = null;
let stickOx = 0, stickOy = 0, stickX = 0, stickY = 0;
let actionId = null;
let actionStart = 0;
let actionMoved = false;
const HOLD_MS = 220;
const STICK_RANGE = 34;

const KEY_LEFT = ['arrowleft', 'a'];
const KEY_RIGHT = ['arrowright', 'd'];
const KEY_UP = ['arrowup', 'w'];
const KEY_DOWN = ['arrowdown', 's'];
const MOVE_KEYS = [...KEY_LEFT, ...KEY_RIGHT, ...KEY_UP, ...KEY_DOWN];

function anyDown(list) {
    return list.some((k) => keys.has(k));
}

/**
 * A predicate supplied by main.js that reports whether a menu screen is open.
 * While one is, keys belong to the menu and must not also drive the probe — a
 * space press that confirms a menu item must not additionally queue a flip.
 */
let menuOpen = () => false;

export function initInput(canvas, isMenuOpen) {
    if (isMenuOpen) menuOpen = isMenuOpen;

    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        // Still swallow the browser defaults for our keys even in menus, so the
        // page never scrolls out from under the canvas.
        const ours = k === ' ' || k === 'spacebar' || MOVE_KEYS.includes(k);
        if (ours) e.preventDefault();
        // `__menuHandled` is set by the menu listener, which runs first and may
        // have just closed a screen; checking menuOpen() alone would miss that
        // and let the key double-fire into gameplay.
        if (e.__menuHandled || menuOpen()) return;

        if (k === ' ' || k === 'spacebar') {
            if (!keys.has(' ')) flipQueued = true;
            keys.add(' ');
            return;
        }
        // Pause is owned entirely by main.js when a screen is open (handled
        // above by the early return), and by the game loop when one is not.
        // Only queue it on the initial press, not on auto-repeat.
        if (k === 'p' || k === 'escape') {
            if (!keys.has(k)) pauseQueued = true;
        }
        keys.add(k);
    });

    window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        keys.delete(k === 'spacebar' ? ' ' : k);
    });

    window.addEventListener('blur', () => keys.clear());

    const rectOf = () => canvas.getBoundingClientRect();

    canvas.addEventListener('touchstart', (e) => {
        // Menus handle their own pointer input; do not also steer the probe.
        if (menuOpen()) { e.preventDefault(); return; }
        const r = rectOf();
        for (const t of e.changedTouches) {
            const localX = t.clientX - r.left;
            if (localX < r.width * 0.5) {
                if (stickId === null) {
                    stickId = t.identifier;
                    stickOx = t.clientX;
                    stickOy = t.clientY;
                    stickX = 0;
                    stickY = 0;
                }
            } else if (actionId === null) {
                actionId = t.identifier;
                actionStart = performance.now();
                actionMoved = false;
            }
        }
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === stickId) {
                stickX = (t.clientX - stickOx) / STICK_RANGE;
                stickY = (t.clientY - stickOy) / STICK_RANGE;
                const m = Math.hypot(stickX, stickY);
                if (m > 1) { stickX /= m; stickY /= m; }
            } else if (t.identifier === actionId) {
                actionMoved = true;
            }
        }
        e.preventDefault();
    }, { passive: false });

    const endTouch = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === stickId) {
                stickId = null;
                stickX = 0;
                stickY = 0;
            } else if (t.identifier === actionId) {
                // A short tap inverts polarity; a hold was silent running.
                if (!actionMoved && performance.now() - actionStart < HOLD_MS) flipQueued = true;
                actionId = null;
            }
        }
        e.preventDefault();
    };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });
}

/** Called once per frame by the loop; consumes edge-triggered presses. */
export function sampleInput() {
    let ax = 0, ay = 0;
    if (anyDown(KEY_LEFT)) ax -= 1;
    if (anyDown(KEY_RIGHT)) ax += 1;
    if (anyDown(KEY_UP)) ay -= 1;
    if (anyDown(KEY_DOWN)) ay += 1;

    if (stickId !== null) {
        ax += stickX;
        ay += stickY;
    }

    const m = Math.hypot(ax, ay);
    if (m > 1) { ax /= m; ay /= m; }

    state.axis.x = ax;
    state.axis.y = ay;
    state.flip = flipQueued;
    state.pause = pauseQueued;
    state.silent = keys.has('shift') ||
        (actionId !== null && performance.now() - actionStart >= HOLD_MS);

    flipQueued = false;
    pauseQueued = false;
    return state;
}

/** Drop any queued edge presses and held keys — used when a screen opens or closes. */
export function flushInput() {
    flipQueued = false;
    pauseQueued = false;
    keys.clear();
}

/** True if a touch is currently driving the thumb-stick (used to show it). */
export function stickState() {
    return stickId === null ? null : { x: stickX, y: stickY };
}
