/* TALEWRIGHT runtime — input: keyboard, gamepad, on-screen buttons and taps
 * folded into one button state with per-frame edges and menu key repeat. */
(window.TW_MODULES = window.TW_MODULES || []).push(['input', function (TW) {
    'use strict';

    const KEYS = {
        ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
        KeyZ: 'ok', Enter: 'ok', Space: 'ok', NumpadEnter: 'ok', KeyJ: 'ok',
        KeyX: 'cancel', Escape: 'cancel', KeyK: 'cancel', Backspace: 'cancel',
        ShiftLeft: 'run', ShiftRight: 'run',
    };
    const BUTTONS = ['up', 'down', 'left', 'right', 'ok', 'cancel', 'run'];

    class Input {
        constructor() {
            this.keys = {};      // held from the keyboard
            this.soft = {};      // held from on-screen buttons
            this.pad = {};       // held from a gamepad
            this.edge = {};      // pressed since the last frame
            this.down = {};
            this.prev = {};
            this.rep = {};
            this.repT = {};
            this.taps = [];      // { x, y } in screen pixels of the 320×240 layer
            this.enabled = true;
            this._kd = (e) => this.onKey(e, true);
            this._ku = (e) => this.onKey(e, false);
            this._blur = () => { this.keys = {}; this.soft = {}; };
        }
        attach() {
            window.addEventListener('keydown', this._kd);
            window.addEventListener('keyup', this._ku);
            window.addEventListener('blur', this._blur);
        }
        detach() {
            window.removeEventListener('keydown', this._kd);
            window.removeEventListener('keyup', this._ku);
            window.removeEventListener('blur', this._blur);
        }
        onKey(e, on) {
            if (!this.enabled) return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            const b = KEYS[e.code] || (e.key === 'Enter' ? 'ok' : e.key === 'Escape' ? 'cancel' : null);
            if (!b) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            e.preventDefault();
            if (on && !this.keys[b]) this.edge[b] = true;
            this.keys[b] = on;
            if (on && TW.audio) TW.audio.unlock();
        }
        setSoft(b, on) {
            if (on && !this.soft[b]) this.edge[b] = true;
            this.soft[b] = on;
            if (on && TW.audio) TW.audio.unlock();
        }
        tap(x, y) { this.taps.push({ x, y }); if (TW.audio) TW.audio.unlock(); }
        pollPad() {
            this.pad = {};
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (const p of pads) {
                if (!p) continue;
                const ax = p.axes[0] || 0, ay = p.axes[1] || 0, B = (i) => p.buttons[i] && p.buttons[i].pressed;
                if (ay < -0.5 || B(12)) this.pad.up = true;
                if (ay > 0.5 || B(13)) this.pad.down = true;
                if (ax < -0.5 || B(14)) this.pad.left = true;
                if (ax > 0.5 || B(15)) this.pad.right = true;
                if (B(0)) this.pad.ok = true;
                if (B(1) || B(9)) this.pad.cancel = true;
                if (B(2) || B(5)) this.pad.run = true;
            }
        }
        /** Call once per logic step. */
        update(dt) {
            try { this.pollPad(); } catch (e) { /* no gamepad API */ }
            for (const b of BUTTONS) {
                const d = !!(this.keys[b] || this.soft[b] || this.pad[b]);
                const pressed = !!this.edge[b] || (d && !this.prev[b]);
                this.down[b] = d;
                this.rep[b] = false;
                if (pressed) { this.rep[b] = true; this.repT[b] = 0.32; }
                else if (d) {
                    this.repT[b] -= dt;
                    if (this.repT[b] <= 0) { this.rep[b] = true; this.repT[b] = 0.075; }
                }
                this.prev[b] = d;
                this.edge[b] = pressed;
            }
            this.pressedNow = Object.assign({}, this.edge);
            this.edge = {};
        }
        pressed(b) { return !!(this.pressedNow && this.pressedNow[b]); }
        held(b) { return !!this.down[b]; }
        repeat(b) { return !!this.rep[b]; }
        /** Consume a press so a second reader in the same frame doesn't see it. */
        eat(b) { if (this.pressedNow) this.pressedNow[b] = false; this.rep[b] = false; }
        takeTap() { return this.taps.shift() || null; }
        clearTaps() { this.taps.length = 0; }
        dir() {
            if (this.down.up) return 8;
            if (this.down.down) return 2;
            if (this.down.left) return 4;
            if (this.down.right) return 6;
            return 0;
        }
        /** For menus: up/down/left/right with key repeat. */
        nav() {
            if (this.rep.up) return 'up';
            if (this.rep.down) return 'down';
            if (this.rep.left) return 'left';
            if (this.rep.right) return 'right';
            return null;
        }
    }

    TW.Input = Input;
}]);
