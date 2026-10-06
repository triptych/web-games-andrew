// Keyboard, mouse and touch → actions. Held keys are polled (aiming); presses are dispatched as
// events to whatever mode is active. A drag anywhere on the canvas aims (or orbits, with the right
// mouse button); a tap without a drag is a "tap" action with screen coordinates.

const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'swing', Enter: 'confirm', NumpadEnter: 'confirm',
    KeyV: 'view', Tab: 'view', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', Backspace: 'back',
    Digit1: 'spell1', Digit2: 'spell2', Digit3: 'spell3', Digit4: 'spell4', Digit5: 'spell5',
    KeyQ: 'item', KeyE: 'item2', KeyR: 'retry', KeyC: 'look',
};

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.held = new Set();
        this.handlers = [];
        this.drag = null;
        this.aimDelta = 0;      // radians requested by dragging since last poll
        this.orbitDelta = 0;
        this.pitchDelta = 0;
        this.touch = false;
        this.fine = false;
        addEventListener('keydown', (e) => this.key(e, true));
        addEventListener('keyup', (e) => this.key(e, false));
        addEventListener('blur', () => this.held.clear());
        canvas.addEventListener('pointerdown', (e) => this.down(e));
        addEventListener('pointermove', (e) => this.move(e));
        addEventListener('pointerup', (e) => this.up(e));
        addEventListener('pointercancel', (e) => this.up(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.addEventListener('wheel', (e) => { this.emit('wheel', { dy: e.deltaY }); }, { passive: true });
        const markTouch = () => { if (!this.touch) { this.touch = true; document.body.classList.add('touch'); } };
        addEventListener('touchstart', markTouch, { passive: true, capture: true });
        if (matchMedia('(pointer: coarse)').matches) markTouch();
    }

    on(fn) { this.handlers.push(fn); return () => { this.handlers = this.handlers.filter((h) => h !== fn); }; }
    emit(action, data = {}) { for (const h of [...this.handlers]) h(action, data); }

    key(e, down) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') { if (down && e.code === 'Enter') this.emit('confirm', {}); return; }
        const a = KEYMAP[e.code];
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.fine = down;
        if (!a) return;
        if (a === 'view' || a === 'swing' || a === 'back' || a.startsWith('spell') || e.code.startsWith('Arrow')) e.preventDefault();
        if (down) {
            if (!e.repeat) { this.held.add(a); this.emit(a, { key: e.code }); }
        } else this.held.delete(a);
    }

    down(e) {
        if (e.pointerType === 'touch') { this.touch = true; document.body.classList.add('touch'); }
        this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, moved: 0, t: performance.now() };
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    }
    move(e) {
        const d = this.drag;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        d.x = e.clientX; d.y = e.clientY;
        d.moved += Math.abs(dx) + Math.abs(dy);
        if (d.btn === 2 || d.btn === 1) { this.orbitDelta += dx * 0.006; this.pitchDelta += dy * 0.004; }
        else this.aimDelta -= dx * (this.touch ? 0.0042 : 0.0028);
    }
    up(e) {
        const d = this.drag;
        if (!d || d.id !== e.pointerId) return;
        this.drag = null;
        if (d.moved < 10 && performance.now() - d.t < 600) this.emit('tap', { x: e.clientX, y: e.clientY, btn: d.btn });
        if (d.btn === 2 || d.btn === 1) this.emit('orbitEnd', {});
    }

    // Consume the accumulated drag.
    takeAim() { const a = this.aimDelta; this.aimDelta = 0; return a; }
    takeOrbit() { const a = this.orbitDelta, p = this.pitchDelta; this.orbitDelta = 0; this.pitchDelta = 0; return [a, p]; }
}
