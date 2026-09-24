// ============================================================
// Keyboard, gamepad and the touch deck, merged into one snapshot per
// simulation step.
//
// * ONE keydown listener (two listeners fighting over a key is a bug this
//   repo has already had).
// * Edges ("pressed this step") are latched when the event arrives, so a
//   tap shorter than a frame is never lost, and cleared by snapshot().
// * The D-pad is a zone: the direction is read from where the thumb is
//   relative to the pad's centre, so sliding between directions works.
// ============================================================

const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyZ: 'jump', Space: 'jump', KeyK: 'jump',
    KeyX: 'fire', KeyJ: 'fire',
    KeyC: 'swap', KeyL: 'swap', ShiftLeft: 'swap', ShiftRight: 'swap', KeyQ: 'swap',
    Enter: 'pause', NumpadEnter: 'pause', KeyP: 'pause',   // Escape is handled by main.js (back / pause)
};
const BUTTONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'swap', 'pause'];

export class Input {
    constructor() {
        this.keys = {};           // held by keyboard
        this.touch = {};          // held by the deck
        this.pad = {};            // held by a gamepad
        this.edge = {};           // pressed since the last snapshot
        this.prevPad = {};
        this.device = 'keys';
        this.onKey = null;        // (code, e) for menus and shortcuts
        this.onDevice = null;
        for (const b of BUTTONS) { this.keys[b] = false; this.touch[b] = false; this.pad[b] = false; this.edge[b] = false; }

        window.addEventListener('keydown', e => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const b = KEYS[e.code];
            if (b) {
                e.preventDefault();
                if (!e.repeat) { this.keys[b] = true; this.edge[b] = true; }
            }
            this.setDevice('keys');
            if (this.onKey && !e.repeat) this.onKey(e.code, e);
            else if (this.onKey && e.repeat && (b === 'left' || b === 'right' || b === 'up' || b === 'down')) this.onKey(e.code, e);
        });
        window.addEventListener('keyup', e => {
            const b = KEYS[e.code];
            if (b) this.keys[b] = false;
        });
        window.addEventListener('blur', () => this.releaseAll());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    }

    setDevice(d) {
        if (this.device === d) return;
        this.device = d;
        if (this.onDevice) this.onDevice(d);
    }

    releaseAll() {
        for (const b of BUTTONS) { this.keys[b] = false; this.touch[b] = false; }
        this.dpadId = null;
    }

    /** Wire up the touch deck (DOM). */
    bindDeck(dpad, buttons) {
        const setDir = (e) => {
            const r = dpad.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
            const dead = r.width * 0.14;
            const was = { ...this.touch };
            this.touch.left = dx < -dead;
            this.touch.right = dx > dead;
            this.touch.up = dy < -dead * 1.25 && Math.abs(dy) > Math.abs(dx) * 0.45;
            this.touch.down = dy > dead * 1.25 && Math.abs(dy) > Math.abs(dx) * 0.45;
            for (const b of ['left', 'right', 'up', 'down']) if (this.touch[b] && !was[b]) this.edge[b] = true;
            dpad.dataset.dir = (this.touch.up ? 'u' : '') + (this.touch.down ? 'd' : '') + (this.touch.left ? 'l' : '') + (this.touch.right ? 'r' : '');
        };
        const clearDir = () => {
            this.touch.left = this.touch.right = this.touch.up = this.touch.down = false;
            dpad.dataset.dir = '';
        };
        dpad.addEventListener('pointerdown', e => {
            e.preventDefault();
            this.setDevice('touch');
            this.dpadId = e.pointerId;
            try { dpad.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            setDir(e);
        });
        dpad.addEventListener('pointermove', e => { if (e.pointerId === this.dpadId) setDir(e); });
        const endPad = e => { if (e.pointerId === this.dpadId) { this.dpadId = null; clearDir(); } };
        dpad.addEventListener('pointerup', endPad);
        dpad.addEventListener('pointercancel', endPad);
        dpad.addEventListener('lostpointercapture', endPad);

        for (const [el, b] of buttons) {
            const down = e => {
                e.preventDefault();
                this.setDevice('touch');
                try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                this.touch[b] = true; this.edge[b] = true;
                el.classList.add('on');
                if (this.onTouchButton) this.onTouchButton(b);
            };
            const up = () => { this.touch[b] = false; el.classList.remove('on'); };
            el.addEventListener('pointerdown', down);
            el.addEventListener('pointerup', up);
            el.addEventListener('pointercancel', up);
            el.addEventListener('lostpointercapture', up);
            el.addEventListener('contextmenu', e => e.preventDefault());
        }
    }

    pollPad() {
        const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
        let gp = null;
        for (const p of pads) if (p && p.connected) { gp = p; break; }
        for (const b of BUTTONS) this.pad[b] = false;
        if (!gp) return;
        const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        this.pad.left = btn(14) || ax < -0.4;
        this.pad.right = btn(15) || ax > 0.4;
        this.pad.up = btn(12) || ay < -0.5;
        this.pad.down = btn(13) || ay > 0.5;
        this.pad.jump = btn(0);
        this.pad.fire = btn(2) || btn(1) || btn(7);
        this.pad.swap = btn(3) || btn(4) || btn(5);
        this.pad.pause = btn(9);
        let any = false;
        for (const b of BUTTONS) {
            if (this.pad[b] && !this.prevPad[b]) { this.edge[b] = true; any = true; if (this.onPad) this.onPad(b); }
            this.prevPad[b] = this.pad[b];
        }
        if (any) this.setDevice('pad');
    }

    held(b) { return this.keys[b] || this.touch[b] || this.pad[b]; }

    /** One simulation step's input. Clears the edges. */
    snapshot() {
        const s = {
            left: this.held('left'), right: this.held('right'), up: this.held('up'), down: this.held('down'),
            jump: this.held('jump'), fire: this.held('fire'),
            jumpPressed: this.edge.jump, downPressed: this.edge.down, firePressed: this.edge.fire,
            swapPressed: this.edge.swap, pausePressed: this.edge.pause,
            leftPressed: this.edge.left, rightPressed: this.edge.right, upPressed: this.edge.up,
        };
        if (s.left && s.right) { s.left = this.keys.left && !this.touch.right; s.right = !s.left; }
        for (const b of BUTTONS) this.edge[b] = false;
        return s;
    }

    clearEdges() { for (const b of BUTTONS) this.edge[b] = false; }
}
