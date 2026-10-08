// Input: keyboard, the touch deck (a floating stick and three buttons), taps on
// the screen (menus) and gamepads, merged into one snapshot per frame. Edges
// (presses) accumulate between frames so a quick tap is never lost.

import { VIEW_W, VIEW_H } from './config.js';

const FIRE_KEYS = ['Space', 'KeyZ', 'KeyJ', 'Enter'];
const BOMB_KEYS = ['KeyX', 'KeyB', 'KeyK'];
const HYPER_KEYS = ['KeyH', 'KeyC', 'ShiftLeft', 'ShiftRight', 'KeyL'];
const STICK_R = 46;

export class Input {
    constructor(ui) {
        this.ui = ui;
        this.keys = new Set();
        this.edges = new Set();
        this.typed = [];
        this.taps = [];
        this.stick = { id: null, x0: 0, y0: 0, ax: 0, ay: 0 };
        this.btnFire = false; this.btnFirePressed = false;
        this.gpPrev = {};
        this.any = false;
        this.clicked = false;
        this.bind();
    }

    bind() {
        addEventListener('keydown', (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
            if (!e.repeat) this.edges.add(e.code);
            else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) this.edges.add('Rep' + e.code);
            this.keys.add(e.code);
            if (!e.repeat && e.key && e.key.length === 1 && /[a-z0-9 .!?\-]/i.test(e.key)) this.typed.push(e.key.toUpperCase());
            if (!e.repeat && e.code === 'Backspace') this.typed.push('\b');
            this.any = true;
        });
        addEventListener('keyup', (e) => this.keys.delete(e.code));
        addEventListener('blur', () => { this.keys.clear(); this.btnFire = false; this.releaseStick(); });

        const scr = this.ui.screenEl;
        scr.addEventListener('contextmenu', (e) => e.preventDefault());
        scr.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse') { this.ui.markTouch(); e.preventDefault(); }
            this.any = true;
            this.clicked = true;
            this.taps.push(this.toCanvas(e.clientX, e.clientY));
        });

        // floating stick: wherever the finger lands in the stick zone is the centre
        const st = this.ui.stickEl;
        if (st) {
            st.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.ui.markTouch(); this.any = true;
                if (this.stick.id !== null) return;
                try { st.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                const r = st.getBoundingClientRect();
                this.stick.id = e.pointerId;
                // start a little off-centre toward the middle of the zone so the first push isn't tiny
                this.stick.x0 = e.clientX; this.stick.y0 = e.clientY;
                this.stick.cx = r.left + r.width / 2; this.stick.cy = r.top + r.height / 2;
                this.moveStick(e.clientX, e.clientY);
            });
            st.addEventListener('pointermove', (e) => { if (e.pointerId === this.stick.id) { e.preventDefault(); this.moveStick(e.clientX, e.clientY); } });
            const up = (e) => { if (e.pointerId === this.stick.id) this.releaseStick(); };
            st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up); st.addEventListener('lostpointercapture', up);
        }

        const hold = (el, on, off) => {
            if (!el) return;
            el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.ui.markTouch(); this.any = true; try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ } el.classList.add('down'); on(); });
            const up = () => { el.classList.remove('down'); off(); };
            el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
        };
        hold(this.ui.fireEl, () => { this.btnFire = true; this.btnFirePressed = true; }, () => { this.btnFire = false; });
        hold(this.ui.bombEl, () => this.edges.add('BtnBomb'), () => {});
        hold(this.ui.hyperEl, () => this.edges.add('BtnHyper'), () => {});
        hold(this.ui.pauseEl, () => this.edges.add('BtnPause'), () => {});
    }

    moveStick(x, y) {
        const s = this.stick;
        let dx = x - s.x0, dy = y - s.y0;
        // drag the origin along if the finger runs past the rim, so reversing is instant
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) { s.x0 = x - (dx / d) * STICK_R; s.y0 = y - (dy / d) * STICK_R; dx = x - s.x0; dy = y - s.y0; }
        const dead = 7;
        s.ax = Math.abs(dx) < dead ? 0 : Math.max(-1, Math.min(1, dx / (STICK_R * 0.7)));
        s.ay = Math.abs(dy) < dead ? 0 : Math.max(-1, Math.min(1, -dy / (STICK_R * 0.7)));
        this.ui.setKnob(dx, dy, true);
    }

    releaseStick() {
        this.stick.id = null; this.stick.ax = 0; this.stick.ay = 0;
        this.ui.setKnob(0, 0, false);
    }

    toCanvas(cx, cy) {
        const r = this.ui.screenRect();
        return { x: ((cx - r.left) / r.width) * VIEW_W, y: (1 - (cy - r.top) / r.height) * VIEW_H };
    }

    held(...codes) { return codes.some((c) => this.keys.has(c)); }
    pressed(...codes) { return codes.some((c) => this.edges.has(c)); }

    pollPad() {
        const out = { ax: 0, ay: 0, fire: false, edges: new Set() };
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of pads) {
            if (!gp || !gp.connected) continue;
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            if (Math.abs(ax) > 0.25) out.ax = ax;
            if (Math.abs(ay) > 0.25) out.ay = -ay;
            const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
            if (b(14)) out.ax = -1;
            if (b(15)) out.ax = 1;
            if (b(12)) out.ay = 1;
            if (b(13)) out.ay = -1;
            if (b(0) || b(7)) out.fire = true;
            const map = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
            for (const [i, name] of Object.entries(map)) {
                const now = b(+i);
                if (now && !this.gpPrev[i]) out.edges.add(name);
                this.gpPrev[i] = now;
            }
            if (ay < -0.6 && !this.gpPrev.up) out.edges.add('PadUp');
            if (ay > 0.6 && !this.gpPrev.down) out.edges.add('PadDown');
            if (ax < -0.6 && !this.gpPrev.left) out.edges.add('PadLeft');
            if (ax > 0.6 && !this.gpPrev.right) out.edges.add('PadRight');
            this.gpPrev.up = ay < -0.6; this.gpPrev.down = ay > 0.6; this.gpPrev.left = ax < -0.6; this.gpPrev.right = ax > 0.6;
            if (out.fire || Math.abs(ax) > 0.25 || Math.abs(ay) > 0.25 || out.edges.size) this.any = true;
            break;
        }
        return out;
    }

    frame() {
        const gp = this.pollPad();
        const E = (...c) => this.pressed(...c) || c.some((x) => gp.edges.has(x));
        let ax = 0, ay = 0;
        if (this.held('ArrowLeft', 'KeyA')) ax -= 1;
        if (this.held('ArrowRight', 'KeyD')) ax += 1;
        if (this.held('ArrowUp', 'KeyW')) ay += 1;
        if (this.held('ArrowDown', 'KeyS')) ay -= 1;
        if (!ax && gp.ax) ax = gp.ax;
        if (!ay && gp.ay) ay = gp.ay;
        if (!ax && this.stick.ax) ax = this.stick.ax;
        if (!ay && this.stick.ay) ay = this.stick.ay;
        const fire = this.held(...FIRE_KEYS) || this.btnFire || gp.fire;
        const firePressed = this.pressed(...FIRE_KEYS) || this.btnFirePressed || E('PadA');
        const snap = {
            ax, ay, fire, firePressed,
            bomb: this.pressed(...BOMB_KEYS, 'BtnBomb') || E('PadB'),
            hyper: this.pressed(...HYPER_KEYS, 'BtnHyper') || E('PadX', 'PadY'),
            pause: E('KeyP', 'Escape', 'BtnPause', 'PadStart'),
            confirm: E('Enter', 'Space', 'KeyZ', 'PadA', 'PadStart') || this.btnFirePressed,
            back: E('Escape', 'Backspace', 'PadB'),
            up: E('ArrowUp', 'KeyW', 'PadUp', 'RepArrowUp'), down: E('ArrowDown', 'KeyS', 'PadDown', 'RepArrowDown'),
            left: E('ArrowLeft', 'KeyA', 'PadLeft', 'RepArrowLeft'), right: E('ArrowRight', 'KeyD', 'PadRight', 'RepArrowRight'),
            mute: E('KeyM'),
            taps: this.taps.splice(0),
            typed: this.typed.splice(0),
            any: this.any,
        };
        this.edges.clear();
        this.btnFirePressed = false; this.any = false; this.clicked = false;
        return snap;
    }
}
