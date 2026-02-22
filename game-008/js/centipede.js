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
    HEAD_SHOCKWAVE_RADIUS,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    isNodeAt, isTowerAt, tileToWorld,
    placeNode, spawnNodeEntity,
} from './grid.js';
import { playSegmentKill, playHeadShockwave } from './sounds.js';
import { spawnShockwave } from './player.js';

let _k      = null;
let _nextId = 1;

// ============================================================
// Particle helpers
// ============================================================

/**
 * Spawn a burst of small square particles at the given world position.
 * Used for segment kill explosions.
 */
function _spawnKillParticles(k, wx, wy, color) {
    const COUNT = 8;
    for (let i = 0; i < COUNT; i++) {
        const angle  = (i / COUNT) * Math.PI * 2 + Math.random() * 0.4;
        const speed  = 60 + Math.random() * 90;
        const vx     = Math.cos(angle) * speed;
        const vy     = Math.sin(angle) * speed;
        const size   = 3 + Math.random() * 3;

        const p = k.add([
            k.pos(wx, wy),
            k.rect(size, size),
            k.color(...color),
            k.opacity(1),
            k.anchor('center'),
            k.z(18),
            'particle',
        ]);

        let t = 0;
        const lifetime = 0.35 + Math.random() * 0.2;
        p.onUpdate(() => {
            if (!p.exists()) return;
            t += k.dt();
            if (t >= lifetime) { p.destroy(); return; }
            p.pos = k.vec2(p.pos.x + vx * k.dt(), p.pos.y + vy * k.dt());
            p.opacity = 1 - t / lifetime;
        });
    }
}

/**
 * Flash a segment entity white briefly (hit feedback without kill).
 */
function _flashSegmentHit(k, ent, originalColor) {
    if (!ent || !ent.exists()) return;
    ent.color = k.rgb(255, 255, 255);
    k.wait(0.08, () => {
        if (ent && ent.exists()) ent.color = k.rgb(...originalColor);
    });
}

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
    constructor(k, type, segments, history, dirX, growingSteps = 0) {
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
        // Freeze tower slow support
        this.slowFactor   = 0;   // 0 = no slow, 0.4 = 40% speed reduction
        this.slowTimer    = 0;   // seconds remaining
        // Spawn immunity: centipede is immune until every segment has moved off
        // the starting tile (i.e. after segCount - 1 steps from the head).
        // Only set on fresh wave spawns (via Centipede.create); split halves pass 0.
        this.growingSteps  = growingSteps;
        this.maxSegments   = segments.length;   // for length-based speed scaling
        this._flashTimer   = 0;   // drives opacity pulse while invulnerable

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
        return new Centipede(k, type, segments, history, dirX, segCount > 1 ? segCount - 1 : 0);
    }

    // --------------------------------------------------------
    // Speed — increases as centipede descends (classic feel)
    // --------------------------------------------------------

    get speed() {
        const row        = this.segments.length > 0 ? this.segments[0].row : 0;
        const lost       = this.maxSegments - this.segments.length;
        const lengthMult = 1 + lost * 0.03;   // +3% per lost segment
        const base       = Math.min(this.def.speed * (1 + row * 0.04) * lengthMult, this.def.speed * 3.0);
        return this.slowTimer > 0 ? base * (1 - this.slowFactor) : base;
    }

    applySlow(factor, duration) {
        this.slowFactor = Math.max(this.slowFactor, factor);
        this.slowTimer  = Math.max(this.slowTimer, duration);
    }

    // --------------------------------------------------------
    // Per-frame update
    // --------------------------------------------------------

    update(dt) {
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) { this.slowTimer = 0; this.slowFactor = 0; }
        }
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
        if (this.growingSteps > 0) this.growingSteps--;

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
        // Emit event so Phase 3 player can deduct a life.
        events.emit('centipedeFellOffBottom');
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
        if (this.growingSteps > 0) return false;   // immune while spawning
        const idx = this.segments.findIndex(s => s.col === col && s.row === row);
        if (idx === -1) return false;

        this.segments[idx].hp -= 1;
        if (this.segments[idx].hp <= 0) {
            this._killSegment(idx);
        } else {
            // Damage flash — white blink on partial hit
            const ent = this.segEntities[idx];
            const isHead = idx === 0;
            const col2 = isHead
                ? (this.def.headColor || COLORS.centipedeHead)
                : (this.def.color     || COLORS.centipedeBody);
            _flashSegmentHit(this.k, ent, col2);
        }
        return true;
    }

    _killSegment(idx) {
        const { col, row } = this.segments[idx];
        const isHead        = idx === 0;

        // Particle burst + sound at the kill position
        const w = tileToWorld(col, row);
        const burstColor = isHead
            ? (this.def.headColor || COLORS.centipedeHead)
            : (this.def.color     || COLORS.centipedeBody);
        _spawnKillParticles(this.k, w.x, w.y, burstColor);
        playSegmentKill();

        // Head death: shockwave visual + event so towers.js can deal damage
        if (isHead) {
            spawnShockwave(this.k, w.x, w.y, [220, 80, 255]);
            spawnShockwave(this.k, w.x, w.y, [255, 160, 255], 0.08);
            playHeadShockwave();
            events.emit('headShockwave', col, row, HEAD_SHOCKWAVE_RADIUS);
        }

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
                k.opacity(1),
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
        const k = this.k;

        // Pulse opacity while invulnerable; snap to 1 once grown
        let targetOpacity = 1;
        if (this.growingSteps > 0) {
            this._flashTimer += k.dt();
            // Oscillate between 0.3 and 1.0 at ~4 Hz
            targetOpacity = 0.65 + 0.35 * Math.sin(this._flashTimer * Math.PI * 8);
        }

        for (let i = 0; i < this.segments.length; i++) {
            const ent = this.segEntities[i];
            if (!ent || !ent.exists()) continue;
            const w = tileToWorld(this.segments[i].col, this.segments[i].row);
            ent.pos     = k.vec2(w.x, w.y);
            ent.opacity = targetOpacity;
        }

        if (this.eyeEntities.length === 2 && this.segments.length > 0) {
            const w  = tileToWorld(this.segments[0].col, this.segments[0].row);
            const ex = this.dirX * 4;
            this.eyeEntities[0].pos = k.vec2(w.x + ex - 5, w.y - 6);
            this.eyeEntities[1].pos = k.vec2(w.x + ex + 5, w.y - 6);
        }
    }
}

// ============================================================
// Module init — call once inside the 'game' scene
// ============================================================

export function initCentipede(k) {
    _k = k;

    // NOTE: Centipede spawning is now handled by waves.js (Phase 5).
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
