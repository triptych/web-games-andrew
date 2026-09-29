/**
 * input.js — keyboard + touch/mouse → a flat input snapshot for the sim.
 *
 *   left / right  flippers (held)
 *   launch        plunger (held; release fires)
 *   nudge         edge-triggered: true for one frame per press
 *
 * Touch: a finger on the left or right half holds that flipper. If a ball is
 * waiting on the plunger, the next touch anywhere pulls the plunger instead,
 * and lifting it launches. Multi-touch works (both flippers at once).
 */

const KEYS = {
    left:   ['KeyZ', 'ArrowLeft', 'KeyA', 'ShiftLeft'],
    right:  ['Slash', 'ArrowRight', 'KeyD', 'ShiftRight', 'KeyL'],
    launch: ['Space', 'ArrowDown', 'Enter', 'KeyS'],
    nudge:  ['ArrowUp', 'KeyN', 'KeyW'],
};
const ALL = new Set(Object.values(KEYS).flat());

const down = new Set();
const pointers = new Map();          // pointerId → 'left' | 'right' | 'launch'
let nudgeEdge = false;
let ballHeld = () => false;
let enabled = false;

export function initInput({ isBallHeld, onKey }) {
    ballHeld = isBallHeld;

    window.addEventListener('keydown', (e) => {
        if (ALL.has(e.code)) e.preventDefault();
        if (e.repeat) return;
        onKey?.(e);
        if (!enabled) return;
        if (KEYS.nudge.includes(e.code)) nudgeEdge = true;
        down.add(e.code);
    });
    window.addEventListener('keyup', (e) => { down.delete(e.code); });
    window.addEventListener('blur', () => { down.clear(); pointers.clear(); });

    const target = document.body;
    target.addEventListener('pointerdown', (e) => {
        if (!enabled || e.target.closest('button, a')) return;
        let role;
        if (ballHeld() && ![...pointers.values()].includes('launch')) role = 'launch';
        else role = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
        pointers.set(e.pointerId, role);
    });
    const release = (e) => pointers.delete(e.pointerId);
    target.addEventListener('pointerup', release);
    target.addEventListener('pointercancel', release);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function setInputEnabled(v) {
    enabled = v;
    if (!v) { down.clear(); pointers.clear(); nudgeEdge = false; }
}

const has = (list) => list.some((k) => down.has(k));
const ptr = (role) => [...pointers.values()].includes(role);

/** Snapshot for this frame. Consumes the nudge edge. */
export function readInput() {
    const snap = {
        left: has(KEYS.left) || ptr('left'),
        right: has(KEYS.right) || ptr('right'),
        launch: has(KEYS.launch) || ptr('launch'),
        nudge: nudgeEdge,
    };
    nudgeEdge = false;
    return snap;
}
