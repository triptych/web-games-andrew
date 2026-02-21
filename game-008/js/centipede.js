/**
 * centipede.js — Centipede entity: spawning, movement, splitting.
 *
 * Phase 2: Centipede traverses the field with wall/node collision,
 * depth-based speed scaling, segment splitting on kill, and Kaplay rendering.
 *
 * Public API (used by Phase 3+):
 *   initCentipede(k)
 *   spawnCentipede(k, type, segCount, col, row, dirX)
 *   hitCentipedeAt(col, row)   — called by Phase 3 bullets
 */

import {
    GRID_COLS, GRID_ROWS, TILE_SIZE,
    PLAYER_ZONE_MIN,
    ENEMY_DEFS,
    COLORS,
    SCORE_SEGMENT_KILL, SCORE_HEAD_BONUS,
    GOLD_PER_SEGMENT,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    isNodeAt, isTowerAt, tileToWorld,
    placeNode, spawnNodeEntity,
} from './grid.js';

let _k      = null;
let _nextId = 1;

// ============================================================
// Centipede class
// ============================================================

class Centipede {
    /**
     * @param {object} k        Kaplay context
     * @param {string} type     Key from ENEMY_DEFS (e.g. 'centipede')
     * @param {Array}  segments [{col, row, hp}, ...]
     * @param {Array}  history  [{col, row}, ...] trail — history[i] = position for segment i
     * @param {number} dirX     1 = right, -1 = left
     */
    constructor(k, type, segments, history, dirX) {
        this.k            = k;
        this.id           = _nextId++;
        this.type         = type;
        this.def          = ENEMY_DEFS[type];
        this.dirX         = dirX;
        this.inPlayerZone = false;
        this.segments     = segments;
        this.history      = history;
        this.moveTimer    = 0;
        this.segEntities  = [];
        this.eyeEntities  = [];

        this._spawnEntities(k);
        state.centipedes.push(this);
    }

    /**
     * Create a fresh centipede with all segments stacked at (startCol, startRow).
     * They spread out as the head moves and the body follows.
     */
    static create(k, type, segCount, startCol, startRow, dirX) {
        const def      = ENEMY_DEFS[type];
        const segments = [];
        const history  = [];
        for (let i = 0; i < segCount; i++) {
            segments.push({ col: startCol, row: startRow, hp: def.hp });
            history.push({ col: startCol, row: startRow });
        }
        return new Centipede(k, type, segments, history, dirX);
    }

    // --------------------------------------------------------
    // Speed — increases as centipede descends (classic feel)
    // --------------------------------------------------------

    get speed() {
        const row = this.segments.length > 0 ? this.segments[0].row : 0;
        return Math.min(this.def.speed * (1 + row * 0.04), this.def.speed * 2.5);
    }

    // --------------------------------------------------------
    // Per-frame update
    // --------------------------------------------------------

    update(dt) {
        this.moveTimer += dt;
        const interval = 1 / this.speed;
        if (this.moveTimer >= interval) {
            this.moveTimer -= interval;
            this._step();
        }
        this._updateVisuals();
    }

    _step() {
        if (this.segments.length === 0) return;

        const head    = this.segments[0];
        const nextCol = head.col + this.dirX;

        const hitWall = nextCol < 0 || nextCol >= GRID_COLS;
        const hitObs  = !hitWall && (isNodeAt(nextCol, head.row) || isTowerAt(nextCol, head.row));

        let newPos;

        if (hitWall || hitObs) {
            // Descend one row and reverse horizontal direction
            this.dirX   *= -1;
            const newRow = head.row + 1;
            newPos       = { col: head.col, row: newRow };

            if (newRow >= PLAYER_ZONE_MIN && !this.inPlayerZone) {
                this.inPlayerZone = true;
                events.emit('centipedeReachedBottom');
            }

            // Fell past the grid bottom — Phase 3 will handle life loss
            if (newRow >= GRID_ROWS) {
                this._respawnAtTop();
                return;
            }
        } else {
            newPos = { col: nextCol, row: head.row };
        }

        // Trail: prepend new head position, trim to segment count
        this.history.unshift(newPos);
        if (this.history.length > this.segments.length) {
            this.history.length = this.segments.length;
        }

        // Sync each segment's position from the trail
        for (let i = 0; i < this.segments.length; i++) {
            if (this.history[i]) {
                this.segments[i].col = this.history[i].col;
                this.segments[i].row = this.history[i].row;
            }
        }
    }

    _respawnAtTop() {
        // Phase 3 will deduct lives; here we just reset position.
        this.inPlayerZone = false;
        this.dirX         = 1;
        this.moveTimer    = 0;
        for (const seg of this.segments) { seg.col = 0; seg.row = 0; }
        for (const h   of this.history)  { h.col   = 0; h.row   = 0; }
    }

    // --------------------------------------------------------
    // Hit / kill / split
    // --------------------------------------------------------

    /**
     * Deal 1 damage to whichever segment occupies (col, row).
     * Returns true if a segment was found there.
     */
    hitAt(col, row) {
        const idx = this.segments.findIndex(s => s.col === col && s.row === row);
        if (idx === -1) return false;

        this.segments[idx].hp -= 1;
        if (this.segments[idx].hp <= 0) this._killSegment(idx);
        return true;
    }

    _killSegment(idx) {
        const { col, row } = this.segments[idx];
        const isHead        = idx === 0;

        // Leave a node, award score + gold
        placeNode(col, row);
        spawnNodeEntity(this.k, col, row);
        state.addScore(SCORE_SEGMENT_KILL + (isHead ? SCORE_HEAD_BONUS : 0));
        state.earn(GOLD_PER_SEGMENT);
        state.waveKills++;
        events.emit('segmentKilled', col, row, this.id);

        // Destroy the killed segment's circle
        const killedEnt = this.segEntities[idx];
        if (killedEnt && killedEnt.exists()) killedEnt.destroy();

        // Destroy all eye entities — recreated below if needed
        for (const eye of this.eyeEntities) {
            if (eye && eye.exists()) eye.destroy();
        }
        this.eyeEntities = [];

        // Partition into front and rear at the killed index
        const beforeSegs = this.segments.slice(0, idx);
        const afterSegs  = this.segments.slice(idx + 1);
        const beforeHist = this.history.slice(0, idx);
        const afterHist  = this.history.slice(idx + 1);
        const beforeEnts = this.segEntities.slice(0, idx);
        const afterEnts  = this.segEntities.slice(idx + 1);

        // Destroy rear entities — the new Centipede spawns fresh ones
        for (const e of afterEnts) {
            if (e && e.exists()) e.destroy();
        }

        // Update this centipede to be the front half
        this.segments    = beforeSegs;
        this.history     = beforeHist;
        this.segEntities = beforeEnts;

        // Spawn rear half as a new independent centipede
        if (afterSegs.length > 0) {
            new Centipede(this.k, this.type, afterSegs, afterHist, this.dirX);
        }

        // Dispose or recreate eyes
        if (this.segments.length === 0) {
            const i = state.centipedes.indexOf(this);
            if (i !== -1) state.centipedes.splice(i, 1);
        } else {
            this._spawnEyes(this.k);
        }
    }

    // --------------------------------------------------------
    // Rendering
    // --------------------------------------------------------

    _spawnEntities(k) {
        const headR = TILE_SIZE * 0.42;
        const bodyR = TILE_SIZE * 0.34;
        const headC = this.def.headColor || COLORS.centipedeHead;
        const bodyC = this.def.color     || COLORS.centipedeBody;

        for (let i = 0; i < this.segments.length; i++) {
            const isHead = i === 0;
            const w      = tileToWorld(this.segments[i].col, this.segments[i].row);
            const ent    = k.add([
                k.pos(w.x, w.y),
                k.circle(isHead ? headR : bodyR),
                k.color(...(isHead ? headC : bodyC)),
                k.anchor('center'),
                k.z(10),
                'centipede',
            ]);
            this.segEntities.push(ent);
        }

        this._spawnEyes(k);
    }

    _spawnEyes(k) {
        if (this.segments.length === 0) return;
        const w = tileToWorld(this.segments[0].col, this.segments[0].row);
        for (let e = 0; e < 2; e++) {
            const eye = k.add([
                k.pos(w.x + (e === 0 ? -5 : 5), w.y - 6),
                k.circle(3),
                k.color(255, 255, 255),
                k.anchor('center'),
                k.z(11),
                'centipedeEye',
            ]);
            this.eyeEntities.push(eye);
        }
    }

    _updateVisuals() {
        for (let i = 0; i < this.segments.length; i++) {
            const ent = this.segEntities[i];
            if (!ent || !ent.exists()) continue;
            const w = tileToWorld(this.segments[i].col, this.segments[i].row);
            ent.pos.x = w.x;
            ent.pos.y = w.y;
        }

        if (this.eyeEntities.length === 2 && this.segments.length > 0) {
            const w  = tileToWorld(this.segments[0].col, this.segments[0].row);
            const ex = this.dirX * 4;
            this.eyeEntities[0].pos.x = w.x + ex - 5;
            this.eyeEntities[0].pos.y = w.y - 6;
            this.eyeEntities[1].pos.x = w.x + ex + 5;
            this.eyeEntities[1].pos.y = w.y - 6;
        }
    }
}

// ============================================================
// Module init — call once inside the 'game' scene
// ============================================================

export function initCentipede(k) {
    _k = k;

    // Spawn the first centipede: head at col 0, row 0, moving right
    spawnCentipede(k, 'centipede', 12, 0, 0, 1);

    // Per-frame update for all active centipedes
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;
        // Spread to safe-iterate while centipedes may be added/removed
        for (const c of [...state.centipedes]) {
            if (c.segments.length > 0) c.update(k.dt());
        }
    });
}

// ============================================================
// Public spawn helper — also used by waves.js (Phase 5)
// ============================================================

export function spawnCentipede(k, type, segCount, startCol, startRow, dirX = 1) {
    return Centipede.create(k, type, segCount, startCol, startRow, dirX);
}

// ============================================================
// Public hit API — called by player bullets in Phase 3
// ============================================================

/**
 * Hit the centipede segment occupying the given tile.
 * Returns true if any centipede had a segment there.
 */
export function hitCentipedeAt(col, row) {
    for (const c of [...state.centipedes]) {
        if (c.hitAt(col, row)) return true;
    }
    return false;
}
