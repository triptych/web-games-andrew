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
    pointer: { active: false, x: 0, y: 0 },
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

export function setBinds(next) { binds = { ...structuredClone(DEFAULT_BINDS), ...next }; }
export function getBinds() { return structuredClone(binds); }
export function captureBind(action, cb) { captureNext = { action, cb }; }

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

export function consumeFlare() { const v = input.flare; input.flare = false; return v; }
export function consumeOd()    { const v = input.od;    input.od = false;    return v; }

export function initInput(canvas) {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
        if (captureNext) {
            e.preventDefault();
            const { action, cb } = captureNext;
            captureNext = null;
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

    // --- Touch: drag anywhere to fly; the ship tracks the finger with an offset
    // so it is never hidden under the thumb. Two fingers = focus. ---
    let touchId = null;
    const onTouchStart = (e) => {
        listeners.anyKey.forEach((f) => f(e));
        if (e.touches.length >= 2) { held.add('focus'); refreshAxes(); }
        if (touchId !== null) return;
        const t = e.changedTouches[0];
        touchId = t.identifier;
        input.pointer.active = true;
        input.pointer.px = t.clientX;
        input.pointer.py = t.clientY - 60;   // lift above the finger
    };
    const onTouchMove = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier !== touchId) continue;
            input.pointer.px = t.clientX;
            input.pointer.py = t.clientY - 60;
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
}
