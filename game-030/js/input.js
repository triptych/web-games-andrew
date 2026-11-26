// Keyboard, the touch pad and taps. Directions are held state (walking continues while a key or pad button is
// down); everything else is a press queued until the main loop takes it, one a frame, so nothing is lost or
// merged at a low frame rate. A key aimed at a focused button, slider or select is left to the browser, so
// Space presses buttons and sliders keep their arrows; Escape is still ours.

const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const PRESS_KEYS = { Space: 'ok', Enter: 'ok', NumpadEnter: 'ok', KeyZ: 'ok', Escape: 'back', Backspace: 'back', KeyX: 'back', KeyM: 'menu', KeyH: 'hint', KeyL: 'log', KeyJ: 'journal' };

export class Input {
    constructor() {
        this.held = new Set();      // keyboard directions
        this.pad = null;            // touch pad direction
        this.queue = [];
        this.touch = false;
        this.order = [];            // most recent direction wins
        window.addEventListener('keydown', (e) => this.key(e, true));
        window.addEventListener('keyup', (e) => this.key(e, false));
        window.addEventListener('blur', () => { this.held.clear(); this.order = []; this.pad = null; });
        window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.setTouch(true); }, { capture: true });
        const dpad = document.getElementById('dpad');
        const padAt = (e) => {
            const b = document.elementFromPoint(e.clientX, e.clientY)?.closest('#dpad button');
            for (const x of dpad.querySelectorAll('button')) x.classList.toggle('on', x === b);
            this.pad = b ? b.dataset.dir : null;
        };
        dpad.addEventListener('pointerdown', (e) => { e.preventDefault(); dpad.setPointerCapture(e.pointerId); padAt(e); });
        dpad.addEventListener('pointermove', (e) => { if (this.pad !== null || e.buttons) padAt(e); });
        const up = () => { this.pad = null; for (const x of dpad.querySelectorAll('button')) x.classList.remove('on'); };
        dpad.addEventListener('pointerup', up);
        dpad.addEventListener('pointercancel', up);
        document.getElementById('btn-act').addEventListener('pointerdown', (e) => { e.preventDefault(); this.queue.push({ t: 'ok', src: 'pad' }); });
    }

    setTouch(on) {
        if (this.touch === on) return;
        this.touch = on;
        document.body.classList.toggle('touch', on);
        this.onTouch?.(on);
    }

    key(e, down) {
        const tag = e.target?.tagName;
        const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
        if (inField && e.code !== 'Escape') return;
        // let a focused button take Space/Enter, but only one on screen: a button clicked just before its panel closed
        // (a battle's Continue) can keep the focus, and then Space on the map did nothing
        if (down && tag === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter') && e.target.getClientRects().length) return;
        const dir = DIR_KEYS[e.code];
        if (dir) {
            if (down) { if (!this.held.has(dir)) { this.held.add(dir); this.order.push(dir); this.queue.push({ t: 'dir', dir }); } }
            else { this.held.delete(dir); this.order = this.order.filter((d) => d !== dir); }
            if (!inField) e.preventDefault();
            this.setTouch(false);
            return;
        }
        if (!down) return;
        if (e.repeat && e.code !== 'Space' && e.code !== 'Enter') return;
        let t = PRESS_KEYS[e.code];
        if (/^Digit[1-9]$/.test(e.code)) t = 'num' + e.code.slice(5);
        if (e.code === 'KeyQ') t = 'auto';
        if (e.code === 'KeyE') t = 'skip';
        if (!t) return;
        if (e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
        this.setTouch(false);
        this.queue.push({ t });
    }

    /** The direction being held now (latest key wins; the pad counts too). */
    get dir() { return this.pad || this.order[this.order.length - 1] || null; }

    take() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
