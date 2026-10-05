// Input: keyboard, mouse, touch (on the screen and on the control deck) and gamepad,
// merged into one frame snapshot. Edges (presses) accumulate until frame() is called.

import { W, H } from './config.js';

const FIRE_KEYS = new Set(['Space', 'KeyZ', 'KeyJ', 'KeyK', 'ArrowUp', 'KeyW']);
const BOMB_KEYS = new Set(['KeyX', 'ShiftLeft', 'ShiftRight', 'KeyB', 'KeyL']);

export class Input {
    constructor(ui) {
        this.ui = ui;
        this.keys = new Set();
        this.edges = new Set();
        this.typed = [];
        this.taps = [];
        this.mouseX = null; this.mouseActive = false; this.mouseDown = false; this.mouseClicked = false;
        this.dx = 0;
        this.touchFire = 0; this.touchFirePressed = false;
        this.btnFire = false; this.btnFirePressed = false; this.btnBomb = false;
        this.padHeld = false;
        this.touchSeen = false;
        this.gpPrev = [];
        this.any = false;
        this.bind();
    }

    bind() {
        addEventListener('keydown', (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
            if (!e.repeat) this.edges.add(e.code);
            if (e.repeat && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) this.edges.add(e.code);
            this.keys.add(e.code);
            if (!e.repeat && e.key && e.key.length === 1 && /[a-z0-9 .!?\-]/i.test(e.key)) this.typed.push(e.key.toUpperCase());
            if (!e.repeat && e.code === 'Backspace') this.typed.push('\b');
            if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) this.mouseActive = false;
            this.any = true;
        });
        addEventListener('keyup', (e) => this.keys.delete(e.code));
        addEventListener('blur', () => { this.keys.clear(); this.btnFire = false; this.btnBomb = false; this.mouseDown = false; });

        const scr = this.ui.screenEl;
        addEventListener('mousemove', (e) => {
            const r = this.ui.screenRect();
            const x = ((e.clientX - r.left) / r.width) * W;
            if (this.mouseX !== null && Math.abs(x - this.mouseX) > 0.5) this.mouseActive = true;
            this.mouseX = x;
        });
        scr.addEventListener('contextmenu', (e) => e.preventDefault());
        scr.addEventListener('mousedown', (e) => {
            if (e.button === 2) { this.edges.add('Bomb'); return; }
            this.mouseDown = true; this.mouseClicked = true; this.any = true;
            this.taps.push(this.toCanvas(e.clientX, e.clientY));
        });
        addEventListener('mouseup', () => { this.mouseDown = false; });

        // touch on the screen: relative drag moves, a quick tap fires / selects
        this.touches = new Map();
        const onDown = (e, zone) => {
            if (e.pointerType === 'mouse') return;
            e.preventDefault();
            this.touchSeen = true; this.any = true;
            this.ui.markTouch();
            try { e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            this.touches.set(e.pointerId, { zone, x0: e.clientX, y0: e.clientY, x: e.clientX, t0: performance.now(), moved: 0 });
        };
        const onMove = (e) => {
            const t = this.touches.get(e.pointerId);
            if (!t) return;
            e.preventDefault();
            const ddx = e.clientX - t.x;
            t.x = e.clientX;
            t.moved += Math.abs(ddx);
            const gain = t.zone === 'pad' ? (W / Math.max(120, this.ui.padWidth())) * 1.15 : (W / this.ui.screenRect().width) * 1.15;
            this.dx += ddx * gain;
        };
        const onUp = (e) => {
            const t = this.touches.get(e.pointerId);
            if (!t) return;
            this.touches.delete(e.pointerId);
            const dt = performance.now() - t.t0;
            if (t.zone === 'screen' && dt < 300 && t.moved < 10 && Math.abs(e.clientY - t.y0) < 12) {
                this.touchFirePressed = true;
                this.taps.push(this.toCanvas(e.clientX, e.clientY));
            }
        };
        scr.addEventListener('pointerdown', (e) => onDown(e, 'screen'));
        const pad = this.ui.padEl;
        if (pad) pad.addEventListener('pointerdown', (e) => onDown(e, 'pad'));
        for (const el of [scr, pad]) {
            if (!el) continue;
            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
            el.addEventListener('pointercancel', onUp);
        }

        const hold = (el, on, off) => {
            if (!el) return;
            el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.touchSeen = true; this.any = true; this.ui.markTouch(); try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ } el.classList.add('down'); on(); });
            const up = () => { el.classList.remove('down'); off(); };
            el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
        };
        hold(this.ui.fireEl, () => { this.btnFire = true; this.btnFirePressed = true; }, () => { this.btnFire = false; });
        hold(this.ui.bombEl, () => { this.edges.add('Bomb'); this.btnBomb = true; }, () => { this.btnBomb = false; });
        hold(this.ui.pauseEl, () => this.edges.add('Pause'), () => {});
    }

    toCanvas(cx, cy) {
        const r = this.ui.screenRect();
        return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
    }

    held(...codes) { return codes.some((c) => this.keys.has(c)); }
    pressed(...codes) { return codes.some((c) => this.edges.has(c)); }

    pollPad() {
        const out = { axis: 0, fire: false, edges: new Set() };
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of pads) {
            if (!gp || !gp.connected) continue;
            const ax = gp.axes[0] || 0;
            if (Math.abs(ax) > 0.25) out.axis = ax;
            const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
            if (b(14)) out.axis = -1;
            if (b(15)) out.axis = 1;
            if (b(0)) out.fire = true;
            const map = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
            for (const [i, name] of Object.entries(map)) {
                const now = b(+i);
                if (now && !this.gpPrev[i]) out.edges.add(name);
                this.gpPrev[i] = now;
            }
            const ay = gp.axes[1] || 0;
            if (ay < -0.6 && !this.gpPrev.up) out.edges.add('PadUp');
            if (ay > 0.6 && !this.gpPrev.down) out.edges.add('PadDown');
            this.gpPrev.up = ay < -0.6; this.gpPrev.down = ay > 0.6;
            break;
        }
        return out;
    }

    frame() {
        const gp = this.pollPad();
        const E = (...c) => this.pressed(...c) || c.some((x) => gp.edges.has(x));
        let axis = 0;
        if (this.held('ArrowLeft', 'KeyA')) axis -= 1;
        if (this.held('ArrowRight', 'KeyD')) axis += 1;
        if (!axis && gp.axis) axis = gp.axis;
        const touchActive = this.touches.size > 0;
        const fireKey = [...FIRE_KEYS].some((k) => this.keys.has(k));
        const fire = fireKey || this.mouseDown || this.btnFire || gp.fire || touchActive;
        const firePressed = [...FIRE_KEYS].some((k) => this.edges.has(k)) || this.mouseClicked || this.btnFirePressed || this.touchFirePressed || E('PadA') || this.edges.has('Enter');
        const snap = {
            axis,
            targetX: this.mouseActive && !axis ? this.mouseX : null,
            dx: this.dx,
            fire, firePressed,
            bomb: [...BOMB_KEYS].some((k) => this.edges.has(k)) || this.edges.has('Bomb') || E('PadB', 'PadX'),
            pause: E('KeyP', 'Escape', 'Pause', 'PadStart'),
            confirm: E('Enter', 'Space', 'KeyZ', 'PadA', 'PadStart') || this.mouseClicked,
            back: E('Escape', 'Backspace', 'PadB'),
            up: E('ArrowUp', 'KeyW', 'PadUp'), down: E('ArrowDown', 'KeyS', 'PadDown'),
            left: E('ArrowLeft', 'KeyA', 'PadLeft'), right: E('ArrowRight', 'KeyD', 'PadRight'),
            mute: E('KeyM'),
            taps: this.taps.splice(0),
            typed: this.typed.splice(0),
            any: this.any,
            touch: this.touchSeen,
        };
        this.edges.clear();
        this.dx = 0; this.mouseClicked = false; this.btnFirePressed = false; this.touchFirePressed = false; this.any = false;
        return snap;
    }
}
