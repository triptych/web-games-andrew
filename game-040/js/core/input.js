/**
 * input.js — keyboard, mouse and touch, normalised into one `input` object the
 * sim reads. Browser-only; nothing in js/sim/ imports this.
 *
 * The sim consumes: { ax, ay, focus, fire, flare, od, pointer:{active,x,y} }
 * where ax/ay are -1..1 and pointer x/y are in *world* units, supplied by the
 * view layer via setPointerWorld().
 */

export const input = {
    ax: 0, ay: 0,
    focus: false,
    fire: false,
    flare: false,        // edge-triggered: cleared by consumeFlare()
    od: false,           // edge-triggered: cleared by consumeOd()
    /**
     * pointer.relative distinguishes the two ways of flying with a pointer:
     *  - mouse (relative: false) — the ship goes where the cursor is, which is
     *    what a mouse user expects because the cursor is visible and precise
     *  - touch (relative: true) — the ship moves by the DELTA of the finger, so
     *    a thumb anywhere on the glass flies the ship without teleporting it and
     *    without the hand covering the part of the screen you need to read
     * pointer.rebase asks the consumer to re-anchor on the next frame (a new
     * finger went down), which is what stops the jump.
     */
    pointer: { active: false, relative: false, rebase: false, x: 0, y: 0 },
    anyKey: false,
};

export const DEFAULT_BINDS = {
    up:    ['ArrowUp', 'KeyW'],
    down:  ['ArrowDown', 'KeyS'],
    left:  ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    fire:  ['KeyZ', 'Space'],
    focus: ['ShiftLeft', 'ShiftRight'],
    flare: ['KeyX'],
    od:    ['KeyC'],
    pause: ['Escape', 'KeyP'],
};

let binds = structuredClone(DEFAULT_BINDS);
const held = new Set();
const listeners = { pause: [], anyKey: [], confirm: [], cancel: [] };
let captureNext = null;
let captureTimer = null;

export function setBinds(next) { binds = { ...structuredClone(DEFAULT_BINDS), ...next }; }
export function getBinds() { return structuredClone(binds); }
/**
 * Listen for the next key press and bind it. Times out, because on a phone
 * there is no keyboard: without this, tapping a rebind button leaves the panel
 * stuck on "PRESS A KEY…" with no way back.
 */
export function captureBind(action, cb, timeoutMs = 6000) {
    if (captureTimer) clearTimeout(captureTimer);
    captureNext = { action, cb };
    captureTimer = setTimeout(() => {
        captureTimer = null;
        if (!captureNext) return;
        const { cb: done } = captureNext;
        captureNext = null;
        done?.(null);
    }, timeoutMs);
}

export function cancelCaptureBind() {
    if (captureTimer) clearTimeout(captureTimer);
    captureTimer = null;
    captureNext = null;
}

function actionFor(code) {
    for (const [action, codes] of Object.entries(binds)) {
        if (codes.includes(code)) return action;
    }
    return null;
}

function refreshAxes() {
    input.ax = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    input.ay = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
    input.focus = held.has('focus');
    input.fire = held.has('fire');
    // Touching a movement key hands control back to the keyboard. Without this,
    // one stray mouse movement leaves the ship following the cursor forever and
    // the arrow keys do nothing, which reads as the game having frozen.
    if (input.ax !== 0 || input.ay !== 0) input.pointer.active = false;
}

export function onPause(fn)   { listeners.pause.push(fn); }
export function onAnyKey(fn)  { listeners.anyKey.push(fn); }
export function onConfirm(fn) { listeners.confirm.push(fn); }
export function onCancel(fn)  { listeners.cancel.push(fn); }

/**
 * On-screen buttons press the same virtual keys the keyboard does, rather than
 * writing input.focus directly — otherwise any keyboard event would call
 * refreshAxes() and silently clobber a held touch button.
 */
export function setVirtualHold(action, down) {
    if (down) held.add(action);
    else held.delete(action);
    refreshAxes();
}

export function consumeFlare() { const v = input.flare; input.flare = false; return v; }
export function consumeOd()    { const v = input.od;    input.od = false;    return v; }

export function initInput(canvas) {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
        if (captureNext) {
            e.preventDefault();
            const { action, cb } = captureNext;
            captureNext = null;
            if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
            if (e.code !== 'Escape') binds[action] = [e.code];
            cb?.(binds[action]);
            return;
        }
        const action = actionFor(e.code);
        if (action) e.preventDefault();
        if (e.repeat) return;

        listeners.anyKey.forEach((f) => f(e));
        if (e.code === 'Enter' || e.code === 'Space') listeners.confirm.forEach((f) => f(e));
        if (e.code === 'Escape') listeners.cancel.forEach((f) => f(e));

        if (!action) return;
        if (action === 'pause') { listeners.pause.forEach((f) => f()); return; }
        if (action === 'flare') { input.flare = true; return; }
        if (action === 'od')    { input.od = true;    return; }
        held.add(action);
        refreshAxes();
    });

    window.addEventListener('keyup', (e) => {
        const action = actionFor(e.code);
        if (!action) return;
        held.delete(action);
        refreshAxes();
    });

    window.addEventListener('blur', () => { held.clear(); refreshAxes(); input.pointer.active = false; });

    const target = canvas || window;

    target.addEventListener('mousemove', (e) => {
        input.pointer.active = true;
        input.pointer.relative = false;       // a mouse flies the ship absolutely
        input.pointer.px = e.clientX;
        input.pointer.py = e.clientY;
    });
    target.addEventListener('mousedown', (e) => {
        if (e.button === 0) input.flare = true;
        if (e.button === 1) input.od = true;
        if (e.button === 2) { held.add('focus'); refreshAxes(); }
        listeners.anyKey.forEach((f) => f(e));
    });
    target.addEventListener('mouseup', (e) => {
        if (e.button === 2) { held.delete('focus'); refreshAxes(); }
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Touch: drag ANYWHERE to fly, relative to where the finger went down.
    // Relative rather than absolute is the whole game on a phone: the ship never
    // jumps to the thumb, the thumb never has to sit on top of the bullets it is
    // dodging, and a short drag near the bottom of the glass can still reach the
    // top of the arena. Two fingers = focus (there is also a FOCUS button). ---
    let touchId = null;
    const onTouchStart = (e) => {
        listeners.anyKey.forEach((f) => f(e));
        if (e.touches.length >= 2) { held.add('focus'); refreshAxes(); }
        if (touchId !== null) return;
        const t = e.changedTouches[0];
        touchId = t.identifier;
        input.pointer.active = true;
        input.pointer.relative = true;
        input.pointer.rebase = true;        // re-anchor: do not teleport the ship
        input.pointer.px = t.clientX;
        input.pointer.py = t.clientY;
    };
    const onTouchMove = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier !== touchId) continue;
            input.pointer.px = t.clientX;
            input.pointer.py = t.clientY;
            e.preventDefault();
        }
    };
    const onTouchEnd = (e) => {
        for (const t of e.changedTouches) if (t.identifier === touchId) touchId = null;
        if (e.touches.length < 2) { held.delete('focus'); refreshAxes(); }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
}

/** Called by the view each frame: converts screen pixels to world coordinates. */
export function setPointerWorld(x, y) {
    input.pointer.x = x;
    input.pointer.y = y;
}

export function resetInput() {
    held.clear();
    refreshAxes();
    input.flare = false;
    input.od = false;
    input.pointer.active = false;
    input.pointer.rebase = true;
}
