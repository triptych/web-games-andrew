// lib/core/input.js — keyboard, gamepad and a touch stick merged into one state, plus an ordered
// queue of presses for menus. The scaffold's Input class with every fix that later games found:
//
// - Action presses are *edges* that stay set until a simulation step consumes them: a frame
//   shorter than the fixed step runs no step, and a tap made in it must not be lost (059, 071).
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame (074, 075).
// - Space and the arrows don't scroll the page, but Space still presses a focused button:
//   preventDefault() on it cancels the click (078). ~20 copies still miss this.
// - A focused slider/select keeps its keys, but Escape still closes the sheet it is in (117, 118).
// - Key repeat is ignored; blur clears held keys; the stick ends on lostpointercapture.
// - A game that draws its own menu cursor must move real focus with it (button.focus()). Otherwise
//   lib/a11y.js focuses the screen's first button, and Space or Enter presses that button while the
//   cursor shows another (games 059, 063, 074).
// - A touch anywhere (capture phase) switches the touch deck on before play starts (074).
//
//   import { Input } from '../lib/core/input.js';
//   const input = new Input({ actions: { a: ['Space', 'KeyZ', 'KeyJ'], b: ['KeyX', 'KeyK'] } });

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const DEFAULT_ACTIONS = { a: ['Space', 'KeyZ', 'KeyJ'] };
/** Standard-mapping gamepad buttons → the key a menu sees. */
const DEFAULT_PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
/** Gamepad button → action edge. */
const DEFAULT_PAD_ACTIONS = { 0: 'a', 2: 'b' };

export class Input {
    /**
     * @param {object} [o]
     * @param {Record<string,string[]>} [o.actions]  action name → key codes that set its edge
     * @param {Record<number,string>} [o.padKeys]     pad button → queued key for menus
     * @param {Record<number,string>} [o.padActions]  pad button → action edge
     * @param {number} [o.deadzone]                   stick/axis dead zone
     * @param {EventTarget} [o.target]                where to listen (default window)
     */
    constructor({ actions = DEFAULT_ACTIONS, padKeys = DEFAULT_PAD_KEYS, padActions = DEFAULT_PAD_ACTIONS, deadzone = 0.25, target = window } = {}) {
        this.actions = actions;
        this.padKeys = padKeys;
        this.padActions = padActions;
        this.deadzone = deadzone;
        this.keys = new Set();
        this.queue = [];                    // { key, pad? } in the order pressed
        this.edges = {};
        for (const k in actions) this.edges[k] = false;
        for (const i in padActions) this.edges[padActions[i]] = false;
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, prev: {} };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen
        this._listeners = [];

        const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); this._listeners.push([t, ev, fn, opt]); };
        on(target, 'keydown', (e) => {
            const tag = e.target?.tagName;
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) && e.code !== 'Escape') return;
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            for (const name in this.actions) if (this.actions[name].includes(e.code)) this.edges[name] = true;
            this.keys.add(e.code);
        });
        on(target, 'keyup', (e) => this.keys.delete(e.code));
        on(window, 'blur', () => this.clear());
        on(window, 'pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** A floating stick: `zone` captures the thumb, `el` is the ring, `knob` follows the thumb. */
    bindStick(zone, el, knob, { radius = () => Math.min(70, Math.max(48, window.innerWidth * 0.12)) } = {}) {
        const end = (e) => {
            if (e.pointerId !== this.stick.id) return;
            this.stick.active = false;
            this.stick.x = this.stick.y = 0;
            knob.style.transform = '';
            el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (this.stick.active) return;
            e.preventDefault();
            const r = zone.getBoundingClientRect();
            Object.assign(this.stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            el.style.left = `${e.clientX - r.left}px`;
            el.style.top = `${e.clientY - r.top}px`;
            el.style.bottom = 'auto';
            el.classList.add('on');
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        zone.addEventListener('pointermove', (e) => {
            if (!this.stick.active || e.pointerId !== this.stick.id) return;
            e.preventDefault();
            const rad = radius();
            let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
            const d = Math.hypot(dx, dy);
            if (d > rad) {
                // drag the base along so the thumb never runs off the end
                const k = (d - rad) / d;
                this.stick.ox += dx * k; this.stick.oy += dy * k;
                const r = zone.getBoundingClientRect();
                el.style.left = `${this.stick.ox - r.left}px`;
                el.style.top = `${this.stick.oy - r.top}px`;
                dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
            }
            this.stick.x = dx / rad; this.stick.y = dy / rad;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); });
    }

    /** Set an action edge by hand (a touch button, a test). */
    press(name = 'a') { this.edges[name] = true; }
    held(code) { return this.keys.has(code); }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dz = this.deadzone;
        const dead = (v) => (Math.abs(v) > dz ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        const prev = this.pad.prev;
        for (const i in this.padKeys) {
            if (b(+i) && !prev[i]) { this.queue.push({ key: this.padKeys[i], pad: true }); this.lastDevice = 'pad'; }
        }
        for (const i in this.padActions) if (b(+i) && !prev[i]) this.edges[this.padActions[i]] = true;
        for (let i = 0; i < gp.buttons.length; i++) prev[i] = b(i);
    }

    /** This frame's held direction and action edges: { x, y, a, ... }. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.2) { x = this.stick.x; y = this.stick.y; }
        return { x, y, ...this.edges };
    }

    /** Call once a simulation step has seen the edges. */
    consumeEdges() { for (const k in this.edges) this.edges[k] = false; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() {
        this.keys.clear();
        this.flush();
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
    destroy() {
        for (const [t, ev, fn, opt] of this._listeners) t.removeEventListener(ev, fn, opt);
        this._listeners.length = 0;
    }
}
