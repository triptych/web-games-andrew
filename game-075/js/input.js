// Input: the keyboard, gamepads and the cabinet's own joystick and buttons
// (which are the touch controls on a phone), merged into one snapshot per
// frame. Presses are edges that collect between frames, so a quick tap is
// never lost. Whatever the source, the cabinet's stick tilts and its buttons
// press in, so the machine looks played.
//
//   the cabinet's buttons are labelled with their keys:
//   Z = use (Z J Space)   X = drop (X K)   C = dash (C L Shift)
//   START (Enter 1)   COIN (5)   pause (P Esc)   mute (M)   view (V)

const A_KEYS = ['KeyZ', 'KeyJ', 'Space'];
const B_KEYS = ['KeyX', 'KeyK'];
const C_KEYS = ['KeyC', 'KeyL', 'ShiftLeft', 'ShiftRight'];
const START_KEYS = ['Enter', 'Digit1', 'NumpadEnter'];
// menus read an ordered queue, so presses that come faster than frames are all kept, in order
const MENU_KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'confirm', NumpadEnter: 'confirm', Digit1: 'confirm', Space: 'confirm', KeyZ: 'confirm', KeyJ: 'confirm',
    Escape: 'back', Backspace: 'back', KeyX: 'back', KeyK: 'back',
};

export class Input {
    constructor(el) {
        this.el = el;
        this.keys = new Set();
        this.edges = new Set();
        this.btn = { a: false, b: false, c: false };
        this.stick = { x: 0, y: 0, id: null };
        this.pad = { ax: 0, ay: 0, a: false, b: false, c: false, prev: {} };
        this.touchMode = false;
        this.rep = { dir: null, t: 0 };
        this.taps = [];
        this.q = [];
        this.any = false;
        this.onTouchMode = null;
        this.bind();
    }

    bind() {
        addEventListener('keydown', (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
            if (!e.repeat) this.edges.add(e.code);
            const m = MENU_KEYS[e.code];
            if (m && (!e.repeat || ['up', 'down', 'left', 'right'].includes(m))) this.push(m);
            this.keys.add(e.code);
            this.any = true;
            this.setTouch(false);
        });
        addEventListener('keyup', (e) => this.keys.delete(e.code));
        addEventListener('blur', () => { this.keys.clear(); this.btn.a = this.btn.b = this.btn.c = false; this.stick.x = this.stick.y = 0; this.stick.id = null; });
        addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') this.setTouch(true); this.any = true; }, { capture: true });
        if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) this.touchMode = true;

        // the joystick
        const st = this.el.stick;
        if (st) {
            const move = (e) => {
                const r = st.getBoundingClientRect();
                const rad = r.width * 0.42;
                let dx = (e.clientX - (r.left + r.width / 2)) / rad, dy = (e.clientY - (r.top + r.height / 2)) / rad;
                const l = Math.hypot(dx, dy);
                if (l > 1) { dx /= l; dy /= l; }
                if (l < 0.22) { dx = 0; dy = 0; }
                this.stick.x = dx; this.stick.y = dy;
            };
            st.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.stick.id = e.pointerId;
                try { st.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                move(e);
            });
            st.addEventListener('pointermove', (e) => { if (e.pointerId === this.stick.id) { e.preventDefault(); move(e); } });
            const up = (e) => { if (e.pointerId === this.stick.id) { this.stick.id = null; this.stick.x = this.stick.y = 0; } };
            st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up); st.addEventListener('lostpointercapture', up);
        }
        // the buttons
        const hold = (b, name, edge) => {
            if (!b) return;
            b.addEventListener('pointerdown', (e) => {
                e.preventDefault(); e.stopPropagation();
                try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                if (name) this.btn[name] = true;
                this.edges.add(edge);
                const m = { BtnA: 'confirm', BtnStart: 'confirm', BtnB: 'back' }[edge];
                if (m) this.push(m);
                b.classList.add('down');
                this.any = true;
            });
            const u = () => { if (name) this.btn[name] = false; b.classList.remove('down'); };
            b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('lostpointercapture', u);
            b.addEventListener('contextmenu', (e) => e.preventDefault());
        };
        hold(this.el.a, 'a', 'BtnA');
        hold(this.el.b, 'b', 'BtnB');
        hold(this.el.c, 'c', 'BtnC');
        hold(this.el.start, null, 'BtnStart');
        hold(this.el.pause, null, 'BtnPause');
        for (const c of this.el.coins || []) hold(c, null, 'BtnCoin');
        // taps on the monitor (menus)
        const scr = this.el.screen;
        if (scr) scr.addEventListener('pointerdown', (e) => {
            const r = scr.getBoundingClientRect();
            this.taps.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
            if (this.taps.length > 4) this.taps.shift();
        });
    }

    push(tok) { if (this.q.length < 10) this.q.push(tok); }

    /** Forget queued menu presses (entering play, so they don't leak into the next menu). */
    flush() { this.q.length = 0; }

    setTouch(on) {
        if (this.touchMode === on) return;
        this.touchMode = on;
        if (this.onTouchMode) this.onTouchMode(on);
    }

    held(list) { return list.some((c) => this.keys.has(c)); }
    pressed(list) { return list.some((c) => this.edges.has(c)); }

    pollPad() {
        const P = this.pad;
        P.ax = 0; P.ay = 0; P.a = P.b = P.c = false;
        const out = new Set();
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of pads) {
            if (!gp || !gp.connected) continue;
            const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            if (Math.abs(ax) > 0.25) P.ax = ax;
            if (Math.abs(ay) > 0.25) P.ay = ay;
            if (b(14)) P.ax = -1; if (b(15)) P.ax = 1; if (b(12)) P.ay = -1; if (b(13)) P.ay = 1;
            P.a = b(0); P.b = b(1); P.c = b(2) || b(5) || b(3);
            const map = { 0: 'PadA', 1: 'PadB', 2: 'PadC', 3: 'PadC', 5: 'PadC', 9: 'PadStart', 8: 'PadCoin' };
            for (const [i, name] of Object.entries(map)) {
                const now = b(+i);
                if (now && !P.prev[i]) { out.add(name); const m = { PadA: 'confirm', PadStart: 'confirm', PadB: 'back' }[name]; if (m) this.push(m); }
                P.prev[i] = now;
            }
            if (P.a || P.b || P.c || P.ax || P.ay || out.size) { this.any = true; this.setTouch(false); }
            break;
        }
        return out;
    }

    /** One snapshot for this frame. */
    frame(dt) {
        const pe = this.pollPad();
        const E = (...names) => names.some((n) => this.edges.has(n) || pe.has(n));
        let ax = 0, ay = 0;
        if (this.held(['ArrowLeft', 'KeyA'])) ax -= 1;
        if (this.held(['ArrowRight', 'KeyD'])) ax += 1;
        if (this.held(['ArrowUp', 'KeyW'])) ay -= 1;
        if (this.held(['ArrowDown', 'KeyS'])) ay += 1;
        if (!ax && !ay) { ax = this.pad.ax || this.stick.x; ay = this.pad.ay || this.stick.y; }

        // menu directions from the stick and the pad: one on press, then auto-repeat while held
        // (keys queue their own presses and the OS's key repeat)
        const sx = this.pad.ax || this.stick.x, sy = this.pad.ay || this.stick.y;
        const dir = Math.abs(sy) > 0.55 ? (sy < 0 ? 'up' : 'down') : Math.abs(sx) > 0.55 ? (sx < 0 ? 'left' : 'right') : null;
        if (dir !== this.rep.dir) { this.rep.dir = dir; this.rep.t = 0.38; if (dir) this.push(dir); }
        else if (dir) { this.rep.t -= dt; if (this.rep.t <= 0) { this.rep.t = 0.11; this.push(dir); } }
        const tok = this.q.shift() || null;

        const snap = {
            ax, ay,
            a: E('BtnA', 'PadA') || this.pressed(A_KEYS),
            b: E('BtnB', 'PadB') || this.pressed(B_KEYS),
            c: E('BtnC', 'PadC') || this.pressed(C_KEYS),
            aHeld: this.held(A_KEYS) || this.btn.a || this.pad.a,
            start: E('BtnStart', 'PadStart') || this.pressed(START_KEYS),
            coin: E('BtnCoin', 'PadCoin', 'Digit5', 'Numpad5'),
            pause: E('BtnPause', 'KeyP', 'Escape'),
            esc: E('Escape', 'Backspace'),
            mute: E('KeyM'),
            view: E('KeyV'),
            up: tok === 'up', down: tok === 'down', left: tok === 'left', right: tok === 'right',
            taps: this.taps.splice(0),
            any: this.any,
        };
        snap.confirm = tok === 'confirm';
        snap.back = tok === 'back';
        this.edges.clear();
        this.any = false;
        this.show(snap);
        return snap;
    }

    /** The cabinet moves with you. */
    show(s) {
        const st = this.el.stickTop;
        if (st) {
            const x = Math.max(-1, Math.min(1, s.ax)), y = Math.max(-1, Math.min(1, s.ay));
            if (x !== this.lastX || y !== this.lastY) { st.style.setProperty('--jx', x.toFixed(2)); st.style.setProperty('--jy', y.toFixed(2)); this.lastX = x; this.lastY = y; }
        }
        const set = (b, on) => { if (b && b.classList.contains('down') !== on) b.classList.toggle('down', on); };
        set(this.el.a, s.aHeld);
        set(this.el.b, this.held(B_KEYS) || this.btn.b || this.pad.b);
        set(this.el.c, this.held(C_KEYS) || this.btn.c || this.pad.c);
    }
}
