/**
 * touch.js — on-screen controls for phones and tablets.
 *
 * A floating stick: put a thumb down anywhere on the left half of the screen
 * and drag; the stick is centred where the thumb landed, so it never needs
 * aiming. A sword button sits in the bottom-right corner (hold to keep
 * swinging), and a pause button in the top-right. All three are DOM elements
 * over the canvas, shown only during play on touch devices.
 *
 * dungeon.js reads `touch.dx`, `touch.dy` (−1..1) and `touch.attack`.
 */

const STICK_RADIUS = 52;   // px of drag for full speed
const DEAD_ZONE    = 8;    // px before the stick registers

export const touch = { dx: 0, dy: 0, attack: false };

let root = null;
let onPause = null;
let enabled = false;

export function isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

/** Build the controls once. `pauseFn` is called by the pause button. */
export function initTouch(pauseFn) {
    onPause = pauseFn;
    if (root || !isTouchDevice()) return;

    root = document.createElement('div');
    root.id = 'touch-controls';
    root.innerHTML = `
        <div id="stick-zone"><div id="stick-base"><div id="stick-knob"></div></div></div>
        <button id="attack-btn" aria-label="Attack">⚔</button>
        <button id="pause-btn" aria-label="Pause">❚❚</button>`;
    document.body.appendChild(root);

    const zone = root.querySelector('#stick-zone');
    const base = root.querySelector('#stick-base');
    const knob = root.querySelector('#stick-knob');
    let stickId = null, ox = 0, oy = 0;

    zone.addEventListener('pointerdown', (e) => {
        if (stickId !== null) return;
        stickId = e.pointerId;
        zone.setPointerCapture(e.pointerId);
        ox = e.clientX; oy = e.clientY;
        base.style.left = `${ox}px`;
        base.style.top  = `${oy}px`;
        base.classList.add('active');
        knob.style.transform = 'translate(-50%, -50%)';
        e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== stickId) return;
        let vx = e.clientX - ox, vy = e.clientY - oy;
        const len = Math.hypot(vx, vy);
        if (len > STICK_RADIUS) { vx *= STICK_RADIUS / len; vy *= STICK_RADIUS / len; }
        knob.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px))`;
        if (len < DEAD_ZONE) { touch.dx = 0; touch.dy = 0; return; }
        touch.dx = vx / STICK_RADIUS;
        touch.dy = vy / STICK_RADIUS;
    });
    const release = (e) => {
        if (e.pointerId !== stickId) return;
        stickId = null;
        touch.dx = 0; touch.dy = 0;
        base.classList.remove('active');
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);

    const attack = root.querySelector('#attack-btn');
    attack.addEventListener('pointerdown', (e) => {
        touch.attack = true;
        attack.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    for (const type of ['pointerup', 'pointercancel']) {
        attack.addEventListener(type, () => { touch.attack = false; });
    }

    root.querySelector('#pause-btn').addEventListener('click', () => onPause && onPause());

    setTouchEnabled(enabled);
}

/** Show the controls during play; hide them on menus and end screens. */
export function setTouchEnabled(on) {
    enabled = on;
    touch.dx = 0; touch.dy = 0; touch.attack = false;
    if (root) root.classList.toggle('hidden', !on);
}
