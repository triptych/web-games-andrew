// Keyboard, mouse (steer toward cursor), gamepad and touch (relative stick, throttle rail, buttons).
// Produces one snapshot per frame; edge-triggered presses are consumed once.

const KEYMAP = {
    KeyW: 'thrUp', KeyS: 'thrDown', KeyA: 'left', KeyD: 'right', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyR: 'up2', KeyF: 'down2', ShiftLeft: 'boost', ShiftRight: 'boost', Space: 'fire', KeyQ: 'mine', KeyE: 'interact', KeyX: 'stop',
};
const EDGE = { KeyC: 'cruise', KeyT: 'target', KeyG: 'map', Tab: 'sys', KeyN: 'sys', KeyJ: 'log', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyH: 'warp', KeyE: 'interact', KeyB: 'target' };

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.edges = new Set();
        this.mouse = { x: 0, y: 0, nx: 0, ny: 0, active: false, left: false, right: false, moved: 0, inside: false };
        this.wheel = 0;
        this.touch = { active: false, sx: 0, sy: 0, throttle: null, buttons: new Set(), stickId: null, thrId: null, base: null };
        this.isTouch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
        this.settings = { mouseSteer: true, invertY: false };
        this.blockGame = false; // true while a menu is open
        this.padPrev = [];
        addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
            if (!e.repeat && EDGE[e.code]) this.edges.add(EDGE[e.code]);
            if (KEYMAP[e.code]) {
                this.keys.add(KEYMAP[e.code]);
                if (['left', 'right', 'up', 'down', 'up2', 'down2'].includes(KEYMAP[e.code])) this.mouse.active = false; // keyboard takes over
            }
        });
        addEventListener('keyup', (e) => { if (KEYMAP[e.code]) this.keys.delete(KEYMAP[e.code]); });
        addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; this.touch.buttons.clear(); });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const dx = e.clientX - this.mouse.x, dy = e.clientY - this.mouse.y;
            this.mouse.x = e.clientX; this.mouse.y = e.clientY;
            this.mouse.moved += Math.hypot(dx, dy);
            if (this.mouse.moved > 6) this.mouse.active = true;
            this.mouse.inside = true;
        });
        document.addEventListener('pointerleave', () => { this.mouse.inside = false; });
        document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse') return;
            if (e.button === 0) this.mouse.left = true;
            if (e.button === 2) this.mouse.right = true;
        });
        addEventListener('pointerup', (e) => {
            if (e.pointerType !== 'mouse') return;
            if (e.button === 0) this.mouse.left = false;
            if (e.button === 2) this.mouse.right = false;
        });
        canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
        this.setupTouch();
    }

    setupTouch() {
        const zone = document.getElementById('stick-zone');
        const base = document.getElementById('stick-base');
        const knob = document.getElementById('stick-knob');
        const rail = document.getElementById('throttle-rail');
        const T = this.touch;
        if (!zone) return;
        const R = 50;
        zone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            T.stickId = e.pointerId;
            zone.setPointerCapture?.(e.pointerId);
            T.base = { x: e.clientX, y: e.clientY };
            T.sx = 0; T.sy = 0;
            const zr = zone.getBoundingClientRect();
            base.style.left = `${e.clientX - zr.left - 60}px`;
            base.style.top = `${e.clientY - zr.top - 60}px`;
            base.style.bottom = 'auto';
            zone.classList.add('active');
            this.isTouch = true;
        });
        const move = (e) => {
            if (e.pointerId !== T.stickId || !T.base) return;
            let dx = e.clientX - T.base.x, dy = e.clientY - T.base.y;
            const d = Math.hypot(dx, dy);
            if (d > R) { dx *= R / d; dy *= R / d; }
            T.sx = dx / R; T.sy = dy / R;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        };
        const end = (e) => {
            if (e.pointerId !== T.stickId) return;
            T.stickId = null; T.sx = 0; T.sy = 0; T.base = null;
            knob.style.transform = '';
            zone.classList.remove('active');
        };
        zone.addEventListener('pointermove', move);
        zone.addEventListener('pointerup', end);
        zone.addEventListener('pointercancel', end);
        const setThr = (e) => {
            const r = rail.getBoundingClientRect();
            T.throttle = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
        };
        rail.addEventListener('pointerdown', (e) => { e.preventDefault(); T.thrId = e.pointerId; rail.setPointerCapture?.(e.pointerId); setThr(e); this.isTouch = true; });
        rail.addEventListener('pointermove', (e) => { if (e.pointerId === T.thrId) setThr(e); });
        const thrEnd = (e) => { if (e.pointerId === T.thrId) T.thrId = null; };
        rail.addEventListener('pointerup', thrEnd);
        rail.addEventListener('pointercancel', thrEnd);
        const hold = { 'tb-fire': 'fire', 'tb-mine': 'mine', 'tb-boost': 'boost', 'tb-act': 'interact' };
        const tap = { 'tb-cruise': 'cruise', 'tb-tgt': 'target', 'tb-act': 'interact' };
        for (const id of Object.keys({ ...hold, ...tap })) {
            const b = document.getElementById(id);
            if (!b) continue;
            b.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                b.setPointerCapture?.(e.pointerId);
                b.classList.add('down');
                if (hold[id]) T.buttons.add(hold[id]);
                if (tap[id]) this.edges.add(tap[id]);
                this.isTouch = true;
            });
            const up = () => { b.classList.remove('down'); if (hold[id]) T.buttons.delete(hold[id]); };
            b.addEventListener('pointerup', up);
            b.addEventListener('pointercancel', up);
            b.addEventListener('lostpointercapture', up);
        }
    }

    pad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const p of pads) if (p && p.connected) return p;
        return null;
    }

    // Build the frame snapshot for the sim.
    snapshot(w, h, currentThrottle) {
        const k = this.keys, m = this.mouse, T = this.touch;
        const s = { steerX: 0, steerY: 0, throttle: 0, throttleSet: null, stop: k.has('stop'), boost: k.has('boost'), fire: k.has('fire'), mine: k.has('mine'), interact: k.has('interact'), interactPressed: false, cruise: false, targetNext: 0 };
        if (this.blockGame) return s;
        s.steerX = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
        s.steerY = (k.has('up') || k.has('up2') ? 1 : 0) - (k.has('down') || k.has('down2') ? 1 : 0);
        if (this.settings.invertY) s.steerY = -s.steerY;
        s.throttle = (k.has('thrUp') ? 1 : 0) - (k.has('thrDown') ? 1 : 0);
        // Mouse steering
        this.mouseSteering = false;
        if (this.settings.mouseSteer && m.active && m.inside && !this.isTouch && s.steerX === 0 && s.steerY === 0) {
            const R = Math.min(w, h) * 0.32;
            let nx = (m.x - w / 2) / R, ny = (m.y - h / 2) / R;
            const d = Math.hypot(nx, ny);
            m.nx = nx; m.ny = ny;
            if (d > 0.07) {
                const kk = Math.min(1, (d - 0.07) / 0.93) / d;
                s.steerX = Math.max(-1, Math.min(1, nx * kk * 1.15));
                s.steerY = Math.max(-1, Math.min(1, -ny * kk * 1.15)) * (this.settings.invertY ? -1 : 1);
            }
            this.mouseSteering = true;
        }
        if (m.left) s.fire = true;
        if (m.right) s.mine = true;
        if (this.wheel) { s.throttleSet = Math.max(0, Math.min(1, currentThrottle - this.wheel * 0.1)); this.wheel = 0; }
        // Touch
        if (T.stickId != null) { s.steerX = T.sx * 1.1; s.steerY = -T.sy * 1.1 * (this.settings.invertY ? -1 : 1); }
        if (T.thrId != null && T.throttle != null) s.throttleSet = T.throttle;
        if (T.buttons.has('fire')) s.fire = true;
        if (T.buttons.has('mine')) s.mine = true;
        if (T.buttons.has('boost')) s.boost = true;
        if (T.buttons.has('interact')) s.interact = true;
        // Gamepad
        const p = this.pad();
        if (p) {
            const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
            const ax = dz(p.axes[0] || 0), ay = dz(p.axes[1] || 0), ry = dz(p.axes[3] || 0);
            if (ax || ay) { s.steerX = ax; s.steerY = -ay * (this.settings.invertY ? -1 : 1); }
            if (ry) s.throttle = -ry;
            const b = (i) => p.buttons[i]?.pressed;
            const edge = (i, name) => { if (b(i) && !this.padPrev[i]) this.edges.add(name); };
            if (b(7)) s.fire = true;
            if (b(6)) s.mine = true;
            if (b(1)) s.boost = true;
            if (b(0)) s.interact = true;
            if (b(4)) s.throttle = -1;
            if (b(5)) s.throttle = 1;
            edge(0, 'interact'); edge(2, 'cruise'); edge(3, 'target'); edge(9, 'pause'); edge(8, 'map');
            this.padPrev = p.buttons.map((x) => x.pressed);
        }
        if (this.edges.has('interact')) s.interactPressed = true;
        if (this.edges.has('cruise')) s.cruise = true;
        if (this.edges.has('target')) s.targetNext = 1;
        return s;
    }
    consume(name) { const had = this.edges.has(name); this.edges.delete(name); return had; }
    clearEdges() { this.edges.clear(); }
}
