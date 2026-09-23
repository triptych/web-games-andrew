// ============================================================
// Keyboard + pointer input. Pointer events cover mouse, pen and touch
// alike, with one pointer id per finger, so the left thumb can steer while
// the right one pumps.
//
// The on-screen stick is RELATIVE: it anchors where the thumb lands and
// reads the drag from there, so there's nothing to aim for. If the thumb
// wanders past the rim, the anchor is dragged along behind it, which makes
// reversing direction a short flick instead of a long drag back.
// ============================================================

const KEY_DIRS = {
    ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3,
};
const PUMP_KEYS = new Set(['Space', 'KeyZ', 'KeyX', 'KeyJ']);

export class Input {
    constructor(target, handler) {
        this.h = handler;
        this.dirStack = [];
        this.pumpKey = false;
        this.pumpEdge = false;
        this.pumpButton = null;      // pointer id holding the on-screen PUMP
        this.stick = null;           // { id, ax, ay, x, y }
        this.touchSeen = false;
        this.dpr = 1;
        this.deadZone = 12;          // css px
        this.rim = 44;               // css px

        const pos = e => [e.clientX * this.dpr, e.clientY * this.dpr];
        target.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (e.pointerType === 'touch' || e.pointerType === 'pen') this.touchSeen = true;
            try { target.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
            const [x, y] = pos(e);
            this.h.down(e.pointerId, x, y, e.pointerType);
        }, { passive: false });
        target.addEventListener('pointermove', e => {
            const [x, y] = pos(e);
            if (this.stick && this.stick.id === e.pointerId) this.moveStick(x, y);
            this.h.move(e.pointerId, x, y, e.pointerType, e.buttons);
        });
        const up = e => {
            if (this.stick && this.stick.id === e.pointerId) this.stick = null;
            if (this.pumpButton === e.pointerId) this.pumpButton = null;
            this.h.up(e.pointerId);
        };
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', up);
        target.addEventListener('lostpointercapture', up);
        target.addEventListener('contextmenu', e => e.preventDefault());

        window.addEventListener('keydown', e => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const d = KEY_DIRS[e.code];
            if (d !== undefined) {
                e.preventDefault();
                this.dirStack = this.dirStack.filter(k => k !== d);
                this.dirStack.push(d);
                this.h.key(e.code, e);
                return;
            }
            if (PUMP_KEYS.has(e.code)) {
                e.preventDefault();
                if (!e.repeat) { this.pumpKey = true; this.pumpEdge = true; }
                this.h.key(e.code, e);
                return;
            }
            if (!e.repeat) this.h.key(e.code, e);
        });
        window.addEventListener('keyup', e => {
            const d = KEY_DIRS[e.code];
            if (d !== undefined) this.dirStack = this.dirStack.filter(k => k !== d);
            if (PUMP_KEYS.has(e.code)) this.pumpKey = false;
        });
        window.addEventListener('blur', () => this.releaseAll());
    }

    releaseAll() {
        this.dirStack = [];
        this.pumpKey = false;
        this.pumpButton = null;
        this.stick = null;
    }

    startStick(id, x, y) {
        this.stick = { id, ax: x, ay: y, x, y };
    }

    moveStick(x, y) {
        const s = this.stick;
        s.x = x; s.y = y;
        const rim = this.rim * this.dpr;
        const dx = x - s.ax, dy = y - s.ay;
        const d = Math.hypot(dx, dy);
        if (d > rim) {
            s.ax = x - dx / d * rim;
            s.ay = y - dy / d * rim;
        }
    }

    stickDir() {
        const s = this.stick;
        if (!s) return -1;
        const dx = s.x - s.ax, dy = s.y - s.ay;
        if (Math.hypot(dx, dy) < this.deadZone * this.dpr) return -1;
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 0 : 2;
        return dy > 0 ? 1 : 3;
    }

    pressPump(id) {
        this.pumpButton = id;
        this.pumpEdge = true;
    }

    /** One simulation step's worth of input. Clears the pump edge. */
    snapshot() {
        let dir = this.stickDir();
        if (dir < 0 && this.dirStack.length) dir = this.dirStack[this.dirStack.length - 1];
        const out = { dir, pump: this.pumpKey || this.pumpButton !== null, pumpPressed: this.pumpEdge };
        this.pumpEdge = false;
        return out;
    }
}
