/**
 * Keyboard input: held-key state for repeated movement plus a small queue
 * of one-shot presses for actions that must not auto-repeat.
 */

const BINDINGS = {
    ArrowUp: 'forward', KeyW: 'forward',
    ArrowDown: 'back', KeyS: 'back',
    ArrowLeft: 'turnLeft', KeyA: 'turnLeft',
    ArrowRight: 'turnRight', KeyD: 'turnRight',
    KeyQ: 'strafeLeft', KeyE: 'strafeRight',
    Comma: 'strafeLeft', Period: 'strafeRight'
};

const ONE_SHOT = {
    Enter: 'use', Space: 'cast', ControlLeft: 'cast', ControlRight: 'cast',
    KeyF: 'melee', Tab: 'map', KeyM: 'mute', KeyI: 'inventory',
    Escape: 'pause', KeyH: 'help', Slash: 'help', KeyR: 'rest',
    Digit1: 'item1', Digit2: 'item2', Digit3: 'item3', Digit4: 'item4',
    Digit5: 'item5', Digit6: 'item6', Digit7: 'item7', Digit8: 'item8',
    Digit9: 'item9',
    KeyC: 'continue', F2: 'save'
};

export class Input {
    constructor(target = window) {
        this.held = new Set();
        this.events = [];
        this.moves = [];
        this.anyKeyPressed = false;

        target.addEventListener('keydown', (e) => {
            if (BINDINGS[e.code] || ONE_SHOT[e.code]) e.preventDefault();
            this.anyKeyPressed = true;
            if (e.repeat) return;
            this.held.add(e.code);
            const action = ONE_SHOT[e.code];
            if (action) this.events.push(action);
            // A tap must land even if the key is released before the next
            // frame; holding is handled separately by heldMovement().
            const move = BINDINGS[e.code];
            if (move && this.moves.length < 2) this.moves.push(move);
        });
        target.addEventListener('keyup', (e) => this.held.delete(e.code));
        window.addEventListener('blur', () => { this.held.clear(); this.moves.length = 0; });
    }

    /** Take the oldest tapped movement, if any. */
    nextMove() {
        return this.moves.length ? this.moves.shift() : null;
    }

    /** The movement action a currently-held key is asking for, if any. */
    heldMovement() {
        for (const code of this.held) {
            const a = BINDINGS[code];
            if (a) return a;
        }
        return null;
    }

    /** Drain one-shot actions since the last call. */
    drain() {
        const out = this.events;
        this.events = [];
        return out;
    }

    consumeAnyKey() {
        const v = this.anyKeyPressed;
        this.anyKeyPressed = false;
        return v;
    }
}
