/**
 * input.js — keyboard, mouse (Pointer Lock) and touch, folded into one
 * per-frame command: move vector, look delta, held buttons and edge-triggered
 * presses. The game never reads DOM events directly.
 *
 * Touch layout (two thumbs):
 *   left half   — floating move stick: it appears where your thumb lands and
 *                 follows if you drag past its rim
 *   right half  — drag to look (relative, never a jump)
 *   FIRE        — hold to shoot; dragging from it also looks, so you can
 *                 aim while firing with one thumb
 *   USE / JUMP / ◀ ▶ weapon / MAP / ❚❚   — buttons, all ≥ 48 px
 */

export const input = {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    fire: false,
    run: false,
    pressed: new Set(),     // edge-triggered: 'use', 'jump', 'slot1'..'slot9', 'next', 'prev', 'map', 'pause', 'melee', 'last'
    keys: new Set(),
    touch: false,
    locked: false,
    sensitivity: 1,
    touchSensitivity: 1,
    invertY: false,
    alwaysRun: true,
    enabled: false,
};

const KEYMAP = {
    KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', KeyD: 'right', ArrowLeft: 'turnL', ArrowRight: 'turnR',
    ShiftLeft: 'run', ShiftRight: 'run',
};

let canvas = null;
let onLockChange = null;

export function initInput(el, opts = {}) {
    canvas = el;
    onLockChange = opts.onLockChange;
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
        input.keys.add(e.code);
        if (!e.repeat) {
            const c = e.code;
            if (c === 'Space') input.pressed.add('jump');
            if (c === 'KeyE') input.pressed.add('use');
            if (c === 'KeyF' || c === 'KeyV') input.pressed.add('melee');
            if (c === 'KeyQ') input.pressed.add('last');
            if (c === 'Tab' || c === 'KeyM') { input.pressed.add('map'); e.preventDefault(); }
            if (c === 'Escape' || c === 'KeyP') input.pressed.add('pause');
            if (c.startsWith('Digit')) { const n = +c.slice(5); if (n >= 1 && n <= 9) input.pressed.add('slot' + n); }
            if (c === 'BracketRight') input.pressed.add('next');
            if (c === 'BracketLeft') input.pressed.add('prev');
            if (c === 'KeyH') input.pressed.add('hud');
            if (c === 'Backquote') input.pressed.add('fps');
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && input.enabled) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => input.keys.delete(e.code));
    window.addEventListener('blur', () => { input.keys.clear(); input.fire = false; });

    document.addEventListener('pointerlockchange', () => {
        input.locked = document.pointerLockElement === canvas;
        onLockChange?.(input.locked);
    });
    document.addEventListener('mousemove', (e) => {
        if (!input.locked) return;
        // ignore the huge spurious first event some browsers send after locking
        if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
        input.look.x += e.movementX * 0.0022 * input.sensitivity;
        input.look.y += e.movementY * 0.0022 * input.sensitivity * (input.invertY ? -1 : 1);
    });
    canvas.addEventListener('mousedown', (e) => {
        if (input.touch) return;
        if (!input.locked) return;
        if (e.button === 0) input.fire = true;
        if (e.button === 2) input.pressed.add('melee');
        if (e.button === 1) input.pressed.add('use');
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
        if (!input.enabled || !input.locked) return;
        input.pressed.add(e.deltaY > 0 ? 'next' : 'prev');
    }, { passive: true });
}

export function requestLock() {
    if (input.touch || !canvas) return;
    if (document.pointerLockElement !== canvas) {
        try {
            const p = canvas.requestPointerLock({ unadjustedMovement: false });
            if (p && p.catch) p.catch(() => {});
        } catch { /* some browsers throw synchronously */ }
    }
}
export function exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

/** Build this frame's movement from held keys and the touch stick. */
export function pollKeys(dt) {
    const k = input.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD')) x += 1;
    if (k.has('KeyA')) x -= 1;
    if (k.has('ArrowLeft')) input.look.x -= dt * 2.6;
    if (k.has('ArrowRight')) input.look.x += dt * 2.6;
    if (touchState.stick.active) { x = touchState.stick.x; y = touchState.stick.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    input.move.x = x; input.move.y = y;
    const shift = k.has('ShiftLeft') || k.has('ShiftRight');
    input.run = input.alwaysRun ? !shift : shift;
    if (touchState.stick.active) input.run = touchState.stick.mag > 0.55 || input.alwaysRun;
    input.fire = input.fire || touchState.fire;
    if (!input.locked && !input.touch && !input.bypass) input.fire = false;
}

export function consumeLook() {
    const l = { x: input.look.x, y: input.look.y };
    input.look.x = 0; input.look.y = 0;
    return l;
}

export function clearPressed() { input.pressed.clear(); }

// ------------------------------------------------------------------ touch

const touchState = {
    stick: { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, mag: 0 },
    look: { id: -1, lx: 0, ly: 0 },
    fire: false,
    fireId: -1,
    fireLast: null,
};
export { touchState };

export function initTouch(root, els) {
    const STICK_R = 56;
    const { stickBase, stickKnob } = els;
    input.touch = true;

    const showStick = (on) => {
        stickBase.classList.toggle('on', on);
    };
    const placeStick = (x, y) => {
        stickBase.style.left = x + 'px'; stickBase.style.top = y + 'px';
    };
    const knob = (dx, dy) => { stickKnob.style.transform = `translate(${dx}px, ${dy}px)`; };

    root.addEventListener('touchstart', (e) => {
        if (!input.enabled) return;
        for (const t of e.changedTouches) {
            const w = window.innerWidth;
            if (t.target.closest && t.target.closest('.tbtn')) continue;
            if (t.clientX < w * 0.45 && !touchState.stick.active) {
                const s = touchState.stick;
                s.active = true; s.id = t.identifier; s.ox = t.clientX; s.oy = t.clientY; s.x = 0; s.y = 0; s.mag = 0;
                placeStick(s.ox, s.oy); knob(0, 0); showStick(true);
            } else if (touchState.look.id < 0) {
                touchState.look.id = t.identifier; touchState.look.lx = t.clientX; touchState.look.ly = t.clientY;
            }
        }
        e.preventDefault();
    }, { passive: false });

    root.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
            const s = touchState.stick;
            if (t.identifier === s.id) {
                let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
                const d = Math.hypot(dx, dy);
                if (d > STICK_R) {
                    // drag the stick along when the thumb goes past the rim
                    const k = (d - STICK_R) / d;
                    s.ox += dx * k; s.oy += dy * k; placeStick(s.ox, s.oy);
                    dx = t.clientX - s.ox; dy = t.clientY - s.oy;
                }
                s.x = dx / STICK_R; s.y = -dy / STICK_R;
                s.mag = Math.min(1, Math.hypot(s.x, s.y));
                // small dead zone
                if (s.mag < 0.12) { s.x = 0; s.y = 0; }
                knob(dx, dy);
            } else if (t.identifier === touchState.look.id) {
                const L = touchState.look;
                const k = 0.0058 * input.touchSensitivity;
                input.look.x += (t.clientX - L.lx) * k;
                input.look.y += (t.clientY - L.ly) * k * (input.invertY ? -1 : 1);
                L.lx = t.clientX; L.ly = t.clientY;
            } else if (t.identifier === touchState.fireId && touchState.fireLast) {
                const k = 0.0058 * input.touchSensitivity;
                input.look.x += (t.clientX - touchState.fireLast[0]) * k;
                input.look.y += (t.clientY - touchState.fireLast[1]) * k * (input.invertY ? -1 : 1);
                touchState.fireLast = [t.clientX, t.clientY];
            }
        }
        e.preventDefault();
    }, { passive: false });

    const end = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === touchState.stick.id) {
                const s = touchState.stick;
                s.active = false; s.id = -1; s.x = s.y = 0; s.mag = 0; showStick(false);
            }
            if (t.identifier === touchState.look.id) touchState.look.id = -1;
            if (t.identifier === touchState.fireId) { touchState.fire = false; touchState.fireId = -1; touchState.fireLast = null; input.fire = false; }
        }
    };
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);

    // buttons
    const bind = (el, onDown, onUp) => {
        el.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            el.classList.add('down');
            onDown(e.changedTouches[0]);
        }, { passive: false });
        const up = (e) => {
            el.classList.remove('down');
            if (onUp) onUp(e.changedTouches[0]);
        };
        el.addEventListener('touchend', up);
        el.addEventListener('touchcancel', up);
        el.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
    };
    bind(els.fire, (t) => { touchState.fire = true; touchState.fireId = t.identifier; touchState.fireLast = [t.clientX, t.clientY]; }, () => { touchState.fire = false; touchState.fireId = -1; touchState.fireLast = null; input.fire = false; });
    // a finger that starts on FIRE keeps aiming: its moves bubble to the root handler above
    const press = (name) => () => input.pressed.add(name);
    bind(els.use, press('use'));
    bind(els.jump, press('jump'));
    bind(els.next, press('next'));
    bind(els.prev, press('prev'));
    bind(els.melee, press('melee'));
    bind(els.map, press('map'));
    bind(els.pause, press('pause'));
}
