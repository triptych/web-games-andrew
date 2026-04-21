import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';

export const actions = { left: false, right: false, up: false, down: false, use: false, pause: false };

let _keys = null;
let _scene = null;

export function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 600;
}

export function init(scene) {
    _scene = scene;
    _keys = scene.input.keyboard.addKeys({
        left1:  Phaser.Input.Keyboard.KeyCodes.LEFT,
        left2:  Phaser.Input.Keyboard.KeyCodes.A,
        right1: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        right2: Phaser.Input.Keyboard.KeyCodes.D,
        up1:    Phaser.Input.Keyboard.KeyCodes.UP,
        up2:    Phaser.Input.Keyboard.KeyCodes.W,
        down1:  Phaser.Input.Keyboard.KeyCodes.DOWN,
        down2:  Phaser.Input.Keyboard.KeyCodes.S,
        use1:   Phaser.Input.Keyboard.KeyCodes.SPACE,
        pause1: Phaser.Input.Keyboard.KeyCodes.ESC,
        pause2: Phaser.Input.Keyboard.KeyCodes.P,
    });
}

// Called from UIScene to set d-pad button state
export function setDPad(direction, pressed) {
    if (direction === 'left')  actions.left  = pressed;
    if (direction === 'right') actions.right = pressed;
    if (direction === 'up')    actions.up    = pressed;
    if (direction === 'down')  actions.down  = pressed;
    if (direction === 'use')   actions.use   = pressed;
}

export function update() {
    if (!_keys) return;
    // Keyboard overrides (OR with d-pad)
    actions.left  = _keys.left1.isDown  || _keys.left2.isDown  || actions.left;
    actions.right = _keys.right1.isDown || _keys.right2.isDown || actions.right;
    actions.up    = _keys.up1.isDown    || _keys.up2.isDown    || actions.up;
    actions.down  = _keys.down1.isDown  || _keys.down2.isDown  || actions.down;
    actions.use   = _keys.use1.isDown   || actions.use;
    // Pause is checked as JustDown in the scene itself
}

export function justPaused() {
    if (!_keys) return false;
    return Phaser.Input.Keyboard.JustDown(_keys.pause1) ||
           Phaser.Input.Keyboard.JustDown(_keys.pause2);
}

export function resetDPad() {
    actions.left  = false;
    actions.right = false;
    actions.up    = false;
    actions.down  = false;
    actions.use   = false;
}

// Must be called at the END of each update tick to clear keyboard state
// (d-pad state is managed by pointer events, so only keyboard needs clearing here)
export function endFrame() {
    // Nothing needed — keyboard isDown is live state.
    // D-pad is managed by UIScene pointer events.
}
