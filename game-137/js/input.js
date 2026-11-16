// Keyboard, gamepad and touch merged into one state, { x, y, mag, od }, plus an ordered queue of
// presses for the menus.
//
// - Held directions and the held MAGNET are read every frame.
// - A press is an *edge* that stays set until a simulation step consumes it: a frame shorter
//   than the fixed step runs no step, and a tap made in it must not be lost. MAGNET is latched
//   too, so a keydown and keyup in the same frame still pulls for one step (game-079).
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.

const MAG_KEYS = ['Space', 'ShiftLeft', 'ShiftRight', 'KeyJ'];
const OD_KEYS = ['KeyE', 'KeyX', 'KeyK'];
const BEAM_KEYS = ['KeyQ', 'KeyF', 'KeyL'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.edges = { mag: false, od: false, beam: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, prev: [], mag: false };
        this.touchMag = false;
        this.lastDevice = 'keys';
        this.onTouch = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in (game-117)
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and arrows must not scroll the page, but Space must still press a focused button (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (MAG_KEYS.includes(e.code)) this.edges.mag = true;
            if (OD_KEYS.includes(e.code)) this.edges.od = true;
            if (BEAM_KEYS.includes(e.code)) this.edges.beam = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // capture phase: a touch on any menu switches the touch deck on before play starts (game-074)
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** A floating stick: zone captures the thumb, el is the ring, knob follows the thumb. */
    bindStick(zone, el, knob) {
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
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
            const rad = R();
            let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
            const d = Math.hypot(dx, dy);
            if (d > rad) {
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
    /** A touch button that is held: MAGNET. */
    bindHold(btn) {
        const on = (e) => { e.preventDefault(); this.touchMag = true; this.edges.mag = true; btn.classList.add('held'); try { btn.setPointerCapture(e.pointerId); } catch { /* */ } };
        const off = () => { this.touchMag = false; btn.classList.remove('held'); };
        btn.addEventListener('pointerdown', on);
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, off);
    }

    pressOD() { this.edges.od = true; }
    pressBeam() { this.edges.beam = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.mag = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        this.pad.mag = b(0) || b(6) || b(7);
        if (this.pad.mag && !this.pad.prev.mag) this.edges.mag = true;
        this.pad.prev.mag = this.pad.mag;
        const od = b(2) || b(3);
        if (od && !this.pad.prev.od) this.edges.od = true;
        this.pad.prev.od = od;
        const bm = b(4) || b(5);
        if (bm && !this.pad.prev.bm) this.edges.beam = true;
        this.pad.prev.bm = bm;
    }

    /** The held state for this frame. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active) {
            const sx = this.stick.x, sy = this.stick.y;
            if (Math.hypot(sx, sy) > 0.2) { x = sx; y = sy; }
        }
        const held = MAG_KEYS.some((c) => k.has(c)) || this.pad.mag || this.touchMag;
        return { x, y, mag: held || this.edges.mag, od: this.edges.od, beam: this.edges.beam, tap: null, pick: null };
    }

    consumeEdges() { this.edges.mag = false; this.edges.od = false; this.edges.beam = false; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.edges.mag = false; this.edges.od = false; this.edges.beam = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.touchMag = false;
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
