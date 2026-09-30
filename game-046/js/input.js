/**
 * input.js — keyboard, touch, mouse and gamepad → one analogue move vector.
 *
 *   Keyboard  WASD / arrow keys
 *   Touch     a floating joystick: put a thumb down anywhere, drag to walk,
 *             lift to stop (and start shooting) — Archero's one-thumb scheme
 *   Mouse     click-and-drag works the same way
 *   Gamepad   left stick / d-pad
 *
 * The vector is in simulation axes: +x right, +y "up the room" (screen up).
 */

const KEYS = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
};
const ALL = new Set(Object.values(KEYS).flat());
const down = new Set();
let enabled = false;
let stick = null;                  // { id, ox, oy, x, y }
let base, knob;
const RADIUS = 56;

export function initInput({ onKey }) {
    base = document.getElementById('stick');
    knob = document.getElementById('stick-knob');
    window.addEventListener('keydown', (e) => {
        if (ALL.has(e.code) || e.code === 'Space') e.preventDefault();
        if (!e.repeat) onKey?.(e);
        down.add(e.code);
    });
    window.addEventListener('keyup', (e) => down.delete(e.code));
    window.addEventListener('blur', () => { down.clear(); endStick(); });

    const target = document.getElementById('touch-layer');
    target.addEventListener('pointerdown', (e) => {
        if (!enabled || stick) return;
        stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        target.setPointerCapture?.(e.pointerId);
        base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        knob.style.transform = 'translate(-50%, -50%)';
        base.classList.add('on');
    });
    target.addEventListener('pointermove', (e) => {
        if (!stick || e.pointerId !== stick.id) return;
        stick.x = e.clientX; stick.y = e.clientY;
        let dx = stick.x - stick.ox, dy = stick.y - stick.oy;
        const d = Math.hypot(dx, dy);
        // Drag past the rim and the base follows the thumb.
        if (d > RADIUS * 1.4) {
            const k = (d - RADIUS * 1.4) / d;
            stick.ox += dx * k; stick.oy += dy * k;
            base.style.transform = `translate(${stick.ox}px, ${stick.oy}px)`;
            dx = stick.x - stick.ox; dy = stick.y - stick.oy;
        }
        const m = Math.min(1, Math.hypot(dx, dy) / RADIUS);
        const a = Math.atan2(dy, dx);
        knob.style.transform = `translate(calc(-50% + ${Math.cos(a) * m * RADIUS}px), calc(-50% + ${Math.sin(a) * m * RADIUS}px))`;
    });
    const end = (e) => { if (stick && e.pointerId === stick.id) endStick(); };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
}

function endStick() {
    stick = null;
    base?.classList.remove('on');
}

export function setInputEnabled(v) {
    enabled = v;
    if (!v) { endStick(); }
}

const has = (list) => list.some((k) => down.has(k));

/** { mx, my } with |m| ≤ 1. */
export function readInput() {
    if (!enabled) return { mx: 0, my: 0 };
    let mx = 0, my = 0;
    if (has(KEYS.left)) mx -= 1;
    if (has(KEYS.right)) mx += 1;
    if (has(KEYS.up)) my += 1;
    if (has(KEYS.down)) my -= 1;
    if (stick) {
        const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > 8) { const m = Math.min(1, d / RADIUS); mx = (dx / d) * m; my = (-dy / d) * m; }
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
        if (!gp) continue;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        if (Math.hypot(ax, ay) > 0.2) { mx = ax; my = -ay; }
        if (gp.buttons[12]?.pressed) my = 1;
        if (gp.buttons[13]?.pressed) my = -1;
        if (gp.buttons[14]?.pressed) mx = -1;
        if (gp.buttons[15]?.pressed) mx = 1;
    }
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    return { mx, my };
}

export const stickActive = () => !!stick;
