/**
 * Grid-locked movement with animation.
 *
 * A blobber's whole feel lives here: the player occupies exactly one cell
 * and one of four facings at all times, but the camera slides and swings
 * between them so it does not look like a slideshow. Input arriving during
 * an animation is queued (one deep) rather than dropped, which keeps
 * corridors fast to run without ever letting the player end up off-grid.
 */

const HALF_PI = Math.PI / 2;

export const NORTH = 0, EAST = 1, SOUTH = 2, WEST = 3;
export const DIR_VECTORS = [
    { x: 0, y: -1 },  // north
    { x: 1, y: 0 },   // east
    { x: 0, y: 1 },   // south
    { x: -1, y: 0 }   // west
];

export const STEP_TIME = 0.20;
export const TURN_TIME = 0.16;
const BUMP_TIME = 0.18;

export class Player {
    constructor(x, y, facing = NORTH) {
        this.cellX = x;
        this.cellY = y;
        this.facing = facing;
        this.x = x + 0.5;
        this.y = y + 0.5;
        this.angle = facing * HALF_PI;
        this.pitch = 0;

        this.anim = null;        // { kind, t, dur, ...from/to }
        this.queued = null;      // one buffered action
        this.bob = 0;
    }

    get busy() { return this.anim !== null; }

    /** Cell directly in front, for interaction and attacks. */
    facingCell() {
        const v = DIR_VECTORS[this.facing];
        return { x: this.cellX + v.x, y: this.cellY + v.y };
    }

    cellInDirection(dir) {
        const v = DIR_VECTORS[((dir % 4) + 4) % 4];
        return { x: this.cellX + v.x, y: this.cellY + v.y };
    }

    /**
     * Request an action. `action` is one of:
     * 'forward' | 'back' | 'strafeLeft' | 'strafeRight' | 'turnLeft' | 'turnRight'
     * Returns true if it started immediately.
     */
    request(action, level, onBump) {
        if (this.anim) { this.queued = action; return false; }
        return this._begin(action, level, onBump);
    }

    _begin(action, level, onBump) {
        if (action === 'turnLeft') return this._startTurn(-1);
        if (action === 'turnRight') return this._startTurn(1);

        let dir = this.facing;
        if (action === 'back') dir = this.facing + 2;
        else if (action === 'strafeLeft') dir = this.facing + 3;
        else if (action === 'strafeRight') dir = this.facing + 1;
        const target = this.cellInDirection(dir);

        if (!level.walkable(target.x, target.y)) {
            this._startBump(target);
            if (onBump) onBump(target);
            return false;
        }
        this.anim = {
            kind: 'move', t: 0, dur: STEP_TIME,
            fromX: this.x, fromY: this.y,
            toX: target.x + 0.5, toY: target.y + 0.5
        };
        this.cellX = target.x;
        this.cellY = target.y;
        return true;
    }

    _startTurn(delta) {
        const from = this.angle;
        const to = from + delta * HALF_PI;
        this.facing = ((this.facing + delta) % 4 + 4) % 4;
        this.anim = { kind: 'turn', t: 0, dur: TURN_TIME, fromA: from, toA: to };
        return true;
    }

    /** A short lurch into a wall we cannot enter — no cell change. */
    _startBump(target) {
        this.anim = {
            kind: 'bump', t: 0, dur: BUMP_TIME,
            fromX: this.x, fromY: this.y,
            toX: this.x + (target.x + 0.5 - this.x) * 0.18,
            toY: this.y + (target.y + 0.5 - this.y) * 0.18
        };
    }

    update(dt, level, onArrive, onBump) {
        const a = this.anim;
        if (!a) {
            this.bob *= Math.max(0, 1 - dt * 8);
            this.pitch = this.bob;
            return;
        }
        a.t += dt;
        const raw = Math.min(1, a.t / a.dur);

        if (a.kind === 'move') {
            const p = easeInOut(raw);
            this.x = a.fromX + (a.toX - a.fromX) * p;
            this.y = a.fromY + (a.toY - a.fromY) * p;
            this.bob = Math.sin(raw * Math.PI * 2) * 2.2;
            this.pitch = this.bob;
        } else if (a.kind === 'turn') {
            const p = easeInOut(raw);
            this.angle = a.fromA + (a.toA - a.fromA) * p;
        } else if (a.kind === 'bump') {
            // out and back
            const p = Math.sin(raw * Math.PI);
            this.x = a.fromX + (a.toX - a.fromX) * p;
            this.y = a.fromY + (a.toY - a.fromY) * p;
        }

        if (raw >= 1) {
            if (a.kind === 'move') { this.x = a.toX; this.y = a.toY; }
            if (a.kind === 'turn') {
                this.angle = a.toA;
                // keep the float from drifting after thousands of turns
                this.angle = Math.round(this.angle / HALF_PI) * HALF_PI;
            }
            if (a.kind === 'bump') { this.x = a.fromX; this.y = a.fromY; }
            const finished = a.kind;
            this.anim = null;
            if (finished === 'move' && onArrive) onArrive(this.cellX, this.cellY);
            if (this.queued) {
                const q = this.queued;
                this.queued = null;
                this._begin(q, level, onBump);
            }
        }
    }
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
