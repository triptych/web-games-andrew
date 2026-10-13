// Input: keyboard, gamepads and a touch deck merged into one snapshot per
// frame. Presses are edges that accumulate between frames, so a quick tap is
// never lost. Touch flight is relative dragging (the angel moves by the
// finger's motion, not to the finger), re-anchored on every new touch.

const FIRE = ['KeyZ', 'KeyJ', 'Space'];
const BEAM = ['KeyX', 'KeyK'];
const HALO = ['KeyC', 'KeyL'];
const FOCUS = ['ShiftLeft', 'ShiftRight'];
const NAV_KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'confirm', Space: 'confirm', KeyZ: 'confirm', Escape: 'back', Backspace: 'back',
};
const PAD_NAV = { PadUp: 'up', PadDown: 'down', PadLeft: 'left', PadRight: 'right', PadA: 'confirm', PadStart: 'confirm', PadB: 'back', PadBack: 'back' };

export class Input {
    constructor(ui) {
        this.ui = ui;
        this.keys = new Set();
        this.edges = new Set();
        this.gpPrev = {};
        this.any = false;
        this.touchMode = false;
        this.drag = null;          // { id, x0, y0, x, y }
        this.btn = { beam: false, fire: false };
        this.mouse = false;
        this.navQ = [];        // menu presses in order: one is consumed per frame, none are lost
        this.bind();
    }

    bind() {
        addEventListener('keydown', (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
            if (!e.repeat) this.edges.add(e.code);
            else if (e.code.startsWith('Arrow')) this.edges.add('Rep' + e.code);
            const nav = NAV_KEYS[e.code];
            if (nav && (!e.repeat || e.code.startsWith('Arrow')) && this.navQ.length < 8) this.navQ.push(nav);
            this.keys.add(e.code);
            this.any = true;
            if (this.touchMode) { this.touchMode = false; this.ui.setTouch(false); }
        });
        addEventListener('keyup', (e) => this.keys.delete(e.code));
        addEventListener('blur', () => { this.keys.clear(); this.btn.beam = false; this.drag = null; });

        // any finger anywhere (menus included) switches to the touch deck
        addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') this.touch(); }, { capture: true });
        if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) { this.touchMode = true; this.ui.setTouch(true); }

        const area = this.ui.playArea;
        area.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') { this.any = true; return; }
            e.preventDefault();
            this.touch();
            if (this.drag) return;
            try { area.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, fresh: true };
        });
        area.addEventListener('pointermove', (e) => {
            if (!this.drag || e.pointerId !== this.drag.id) return;
            e.preventDefault();
            this.drag.x = e.clientX; this.drag.y = e.clientY;
        });
        const up = (e) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
        area.addEventListener('pointerup', up);
        area.addEventListener('pointercancel', up);
        area.addEventListener('lostpointercapture', up);
        area.addEventListener('contextmenu', (e) => e.preventDefault());

        const hold = (el, on, off) => {
            if (!el) return;
            el.addEventListener('pointerdown', (e) => {
                e.preventDefault(); e.stopPropagation();
                this.touch();
                try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                el.classList.add('down'); on();
            });
            const u = () => { el.classList.remove('down'); off(); };
            el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('lostpointercapture', u);
        };
        hold(this.ui.el('t-beam'), () => { this.btn.beam = true; }, () => { this.btn.beam = false; });
        hold(this.ui.el('t-halo'), () => this.edges.add('BtnHalo'), () => {});
        hold(this.ui.el('t-pause'), () => this.edges.add('BtnPause'), () => {});
    }

    touch() {
        this.any = true;
        if (!this.touchMode) { this.touchMode = true; this.ui.setTouch(true); }
    }

    held(list) { return list.some((c) => this.keys.has(c)); }
    pressed(list) { return list.some((c) => this.edges.has(c)); }

    pollPad() {
        const out = { ax: 0, ay: 0, fire: false, beam: false, focus: false, edges: new Set() };
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of pads) {
            if (!gp || !gp.connected) continue;
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            if (Math.abs(ax) > 0.22) out.ax = ax;
            if (Math.abs(ay) > 0.22) out.ay = -ay;
            const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
            if (b(14)) out.ax = -1; if (b(15)) out.ax = 1; if (b(12)) out.ay = 1; if (b(13)) out.ay = -1;
            out.fire = b(0) || b(7);
            out.beam = b(2) || b(6);
            out.focus = b(4) || b(5);
            const map = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 9: 'PadStart', 8: 'PadBack', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
            for (const [i, name] of Object.entries(map)) {
                const now = b(+i);
                if (now && !this.gpPrev[i]) out.edges.add(name);
                this.gpPrev[i] = now;
            }
            const dirs = [['up', ay < -0.6, 'PadUp'], ['down', ay > 0.6, 'PadDown'], ['left', ax < -0.6, 'PadLeft'], ['right', ax > 0.6, 'PadRight']];
            for (const [k, now, name] of dirs) { if (now && !this.gpPrev[k]) out.edges.add(name); this.gpPrev[k] = now; }
            for (const name of out.edges) if (PAD_NAV[name] && this.navQ.length < 8) this.navQ.push(PAD_NAV[name]);
            if (out.fire || out.beam || Math.abs(ax) > 0.22 || Math.abs(ay) > 0.22 || out.edges.size) {
                this.any = true;
                if (this.touchMode) { this.touchMode = false; this.ui.setTouch(false); }
            }
            break;
        }
        return out;
    }

    /**
     * One snapshot. `player` (sim player, or null) and `pxPerUnit` let a touch
     * drag become a heading toward where the finger has moved the angel.
     */
    frame(player, pxPerUnit, autofire, menu = true) {
        const gp = this.pollPad();
        const nav = menu ? this.navQ.shift() : null;
        if (!menu) this.navQ.length = 0;
        const E = (...c) => this.pressed(c) || c.some((x) => gp.edges.has(x));
        let ax = 0, ay = 0;
        if (this.held(['ArrowLeft', 'KeyA'])) ax -= 1;
        if (this.held(['ArrowRight', 'KeyD'])) ax += 1;
        if (this.held(['ArrowUp', 'KeyW'])) ay += 1;
        if (this.held(['ArrowDown', 'KeyS'])) ay -= 1;
        if (!ax && gp.ax) ax = gp.ax;
        if (!ay && gp.ay) ay = gp.ay;

        // relative drag → a target position for the angel
        if (this.drag && player) {
            const d = this.drag;
            if (d.fresh || !d.anchor) { d.anchor = { x: player.x, y: player.y, fx: d.x, fy: d.y }; d.fresh = false; }
            const sens = 1.35;
            let tx = d.anchor.x + ((d.x - d.anchor.fx) / pxPerUnit) * sens;
            let ty = d.anchor.y - ((d.y - d.anchor.fy) / pxPerUnit) * sens;
            const cx = Math.max(0.8, Math.min(31.2, tx)), cy = Math.max(0.5, Math.min(17.5, ty));
            // absorb overshoot so dragging back from a wall is immediate
            d.anchor.fx += ((tx - cx) / sens) * pxPerUnit;
            d.anchor.fy -= ((ty - cy) / sens) * pxPerUnit;
            tx = cx; ty = cy;
            const dx = tx - player.x, dy = ty - player.y;
            ax = Math.max(-1, Math.min(1, dx * 3.2));
            ay = Math.max(-1, Math.min(1, dy * 3.2));
            if (Math.abs(dx) < 0.03) ax = 0;
            if (Math.abs(dy) < 0.03) ay = 0;
        }
        const beam = this.held(BEAM) || this.btn.beam || gp.beam;
        let fire = this.held(FIRE) || gp.fire;
        if (autofire === 'always' || (autofire === 'touch' && this.touchMode)) fire = true;
        const snap = {
            ax, ay, fire, beam,
            halo: E('KeyC', 'KeyL', 'BtnHalo', 'PadY', 'PadB'),
            focus: this.held(FOCUS) || gp.focus,
            pause: E('KeyP', 'Escape', 'BtnPause', 'PadStart'),
            confirm: nav === 'confirm',
            back: nav === 'back',
            up: nav === 'up', down: nav === 'down', left: nav === 'left', right: nav === 'right',
            skip: E('Escape', 'PadStart', 'PadBack'),
            mute: E('KeyM'),
            any: this.any,
        };
        this.edges.clear();
        this.any = false;
        return snap;
    }

    /** Drop any held touch/drag state (mode changes). */
    rebase() { if (this.drag) this.drag.fresh = true; }
}
