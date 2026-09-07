/**
 * input.js — unified keyboard + touch input.
 *
 * Desktop: Arrow Left/Right or A/D to steer, Space (hold) to fire.
 * Mobile: two large steer zones (left/right halves of a bottom bar) plus a
 * fire button, all rendered as DOM overlay elements (not Phaser game objects)
 * so they sit above the canvas and work regardless of canvas scaling.
 */

export class InputController {
    constructor(scene) {
        this.scene = scene;
        this.steer = 0;   // -1..1
        this.firing = false;

        this._keyLeft  = scene.input.keyboard.addKey('LEFT');
        this._keyRight = scene.input.keyboard.addKey('RIGHT');
        this._keyA     = scene.input.keyboard.addKey('A');
        this._keyD     = scene.input.keyboard.addKey('D');
        this._keyFire  = scene.input.keyboard.addKey('SPACE');

        this._touchLeft = false;
        this._touchRight = false;
        this._touchFire = false;

        this._buildTouchUI();
    }

    _buildTouchUI() {
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        if (!isTouch) return;

        const wrap = document.createElement('div');
        wrap.id = 'n2-touch-controls';
        wrap.style.cssText = `
            position: fixed; inset: 0; z-index: 50;
            pointer-events: none; touch-action: none;
            font-family: 'Courier New', monospace;
        `;

        const mkBtn = (label, css) => {
            const b = document.createElement('div');
            b.textContent = label;
            b.style.cssText = `
                position: fixed; pointer-events: auto; touch-action: none;
                display: flex; align-items: center; justify-content: center;
                border-radius: 50%; user-select: none;
                background: rgba(54, 240, 255, 0.12);
                border: 2px solid rgba(54, 240, 255, 0.5);
                color: rgba(232, 224, 255, 0.8);
                font-size: 28px; font-weight: bold;
                ${css}
            `;
            wrap.appendChild(b);
            return b;
        };

        const leftBtn  = mkBtn('◀', 'left: 24px; bottom: 28px; width: 84px; height: 84px;');
        const rightBtn = mkBtn('▶', 'left: 120px; bottom: 28px; width: 84px; height: 84px;');
        const fireBtn  = mkBtn('●', 'right: 28px; bottom: 28px; width: 100px; height: 100px; background: rgba(255,47,110,0.15); border-color: rgba(255,47,110,0.55);');

        document.body.appendChild(wrap);
        this._touchWrap = wrap;

        const bind = (el, onDown, onUp) => {
            const down = (e) => { e.preventDefault(); onDown(); el.style.background = el.style.background.replace('0.12', '0.35').replace('0.15', '0.4'); };
            const up = (e) => { e.preventDefault(); onUp(); };
            el.addEventListener('touchstart', down, { passive: false });
            el.addEventListener('touchend', up, { passive: false });
            el.addEventListener('touchcancel', up, { passive: false });
            el.addEventListener('mousedown', down);
            el.addEventListener('mouseup', up);
            el.addEventListener('mouseleave', up);
        };

        bind(leftBtn,  () => { this._touchLeft = true; },  () => { this._touchLeft = false; });
        bind(rightBtn, () => { this._touchRight = true; }, () => { this._touchRight = false; });
        bind(fireBtn,  () => { this._touchFire = true; },  () => { this._touchFire = false; });
    }

    update() {
        let steer = 0;
        const keyLeft = this._keyLeft.isDown || this._keyA.isDown;
        const keyRight = this._keyRight.isDown || this._keyD.isDown;
        if (keyLeft || this._touchLeft) steer -= 1;
        if (keyRight || this._touchRight) steer += 1;
        this.steer = steer;
        // Touch buttons feel better with a snappier turn rate than keyboard
        // (there's no analog "hold lightly" on a big finger button).
        this.usingTouch = (this._touchLeft || this._touchRight) && !keyLeft && !keyRight;
        this.firing = this._keyFire.isDown || this._touchFire || this._touchLeft || this._touchRight;
        // Auto-fire while steering too (N2O plays best with near-constant fire);
        // also always allow explicit fire button/key.
    }

    destroy() {
        if (this._touchWrap && this._touchWrap.parentNode) {
            this._touchWrap.parentNode.removeChild(this._touchWrap);
        }
    }
}
