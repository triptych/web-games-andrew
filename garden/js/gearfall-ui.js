// Two pieces of paper and a keypad. The papers on the Hut's desk open as a
// page you can read: a maintenance log with the vault door's code written in
// it and a hint about the Great Gear. The keypad by the vault door opens as a
// panel of keys: type the code (or click it in) and it answers.

const $ = (id) => document.getElementById(id);

/** A modal that owns the keyboard while it is open. */
class Modal {
    constructor(id) {
        this.el = $(id);
        this.open = false;
        this._key = (e) => {
            if (!this.open) return;
            if (this.onKey(e) !== false) {
                e.stopImmediatePropagation();
            }
        };
        addEventListener('keydown', this._key, true);
        this.el?.addEventListener('pointerdown', (e) => {
            if (e.target === this.el) this.close();
        });
    }

    show() {
        if (!this.el) return;
        this.open = true;
        this.el.hidden = false;
        this.onShow?.();
    }

    close() {
        if (!this.open) return;
        this.open = false;
        this.el.hidden = true;
        this.onClose?.();
    }

    onKey(e) {
        if (e.key === 'Escape') this.close();
        return true;
    }
}

/** The page from the Hut's desk. */
export class PaperNote extends Modal {
    constructor() {
        super('hut-note');
        $('hut-note-close')?.addEventListener('click', () => this.close());
    }

    onShow() {
        $('hut-note-close')?.focus({ preventScroll: true });
    }
}

/** The vault door's keypad. `check(code)` says whether it is right. */
export class Keypad extends Modal {
    constructor() {
        super('keypad');
        this.code = '';
        this.screen = $('kp-screen');
        this.busy = false;
        this.el?.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => this.press(b.dataset.key)));
        $('kp-close')?.addEventListener('click', () => this.close());
    }

    onShow() {
        this.code = '';
        this.busy = false;
        this._draw();
        this.el.classList.remove('kp-ok', 'kp-bad');
    }

    onKey(e) {
        const k = e.key;
        if (k === 'Escape') this.close();
        else if (/^[0-9]$/.test(k)) this.press(k);
        else if (k === 'Backspace') this.press('del');
        else if (k === 'Enter') this.press('ok');
        else if (k === 'Tab') return false;
        else return true;
        e.preventDefault();
        return true;
    }

    press(k) {
        if (this.busy) return;
        if (k === 'del') this.code = this.code.slice(0, -1);
        else if (k === 'clr') this.code = '';
        else if (k === 'ok') return this._submit();
        else if (this.code.length < 4) this.code += k;
        this.onBeep?.(this.code.length);
        this._draw();
        if (this.code.length === 4) setTimeout(() => this._submit(), 250);
    }

    _draw(msg) {
        if (!this.screen) return;
        this.screen.textContent = msg ?? (this.code.padEnd(4, '·').split('').join(' '));
    }

    _submit() {
        if (this.busy || !this.code) return;
        this.busy = true;
        const ok = this.check?.(this.code);
        this.el.classList.toggle('kp-ok', !!ok);
        this.el.classList.toggle('kp-bad', !ok);
        this._draw(ok ? 'ACCESS GRANTED' : 'ACCESS DENIED');
        if (ok) {
            this.onGranted?.();
            setTimeout(() => {
                this.close();
                this.onOpen?.();
            }, 900);
        } else {
            this.onDenied?.();
            setTimeout(() => {
                this.code = '';
                this.busy = false;
                this.el.classList.remove('kp-bad');
                this._draw();
            }, 1100);
        }
    }
}
