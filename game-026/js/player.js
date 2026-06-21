/**
 * player.js — Grid position & facing, animated step/turn tweens, wall collision.
 *
 * The player is logically on a tile (state.playerTile) facing one of 4 cardinal
 * directions (state.facing → index into DIRS). The camera is driven to match.
 * A move/turn starts a short tween; input is ignored until it finishes, keeping
 * everything strictly grid-aligned (classic blobber feel).
 *
 * Call initPlayer() after initDungeon(). Forward input via handleInput(e),
 * advance tweens via updatePlayer(dt).
 */

import * as THREE from 'three';
import { camera } from './scene.js';
import { state } from './state.js';
import { events } from './events.js';
import { TILE_SIZE, DIRS, STEP_TIME, TURN_TIME, CAM_POS,
         BUMP_TIME, BUMP_DIST, BUMP_DIP } from './config.js';
import { isWalkable, tileAt, startTile } from './dungeon.js';
import { playFootstep, playWallBump, playDescend } from './sounds.js';

const EYE_Y = CAM_POS[1];

// Tween state. When active, we lerp from `from` → `to` over `dur` seconds.
let anim = null;   // { kind:'move'|'turn'|'bump', from, to, t, dur }

// Logical pose (authoritative). Camera is derived from these between tweens.
let tileX, tileZ, facing;

// Fog-of-war: set of 'x,z' strings for tiles the player has visited.
const _visited = new Set();

export function initPlayer() {
    tileX  = startTile.x;
    tileZ  = startTile.z;
    facing = 2;            // face south (into the maze) by default
    anim   = null;
    _visited.clear();

    state.playerTile = { x: tileX, z: tileZ };
    state.facing     = facing;

    _snapCamera();
    _revealTile(tileX, tileZ);
    events.emit('playerMoved', { x: tileX, z: tileZ, facing });
}

/** Yaw (radians) for a facing index. North looks toward -Z. */
function _yawFor(dir) {
    // facing 0=N(-Z) 1=E(+X) 2=S(+Z) 3=W(-X). atan2 mapping: yaw 0 looks down -Z.
    return -dir * (Math.PI / 2);
}

function _worldFor(x, z) {
    return new THREE.Vector3(x * TILE_SIZE, EYE_Y, z * TILE_SIZE);
}

function _snapCamera() {
    camera.position.copy(_worldFor(tileX, tileZ));
    camera.rotation.set(0, _yawFor(facing), 0);
}

export function handleInput(e) {
    if (anim) return;                       // busy mid-tween — ignore
    if (state.isGameOver || state.isPaused) return;

    const k = e.key.toLowerCase();

    if (k === 'w' || k === 'arrowup')    return _tryMove(facing);
    if (k === 's' || k === 'arrowdown')  return _tryMove((facing + 2) % 4);
    if (k === 'q')                       return _tryMove((facing + 3) % 4); // strafe left
    if (k === 'e')                       return _tryMove((facing + 1) % 4); // strafe right
    if (k === 'a' || k === 'arrowleft')  return _turn(-1);
    if (k === 'd' || k === 'arrowright') return _turn(+1);
}

function _tryMove(dir) {
    const { dx, dz } = DIRS[dir];
    const nx = tileX + dx;
    const nz = tileZ + dz;
    if (!isWalkable(nx, nz)) {
        playWallBump();
        anim = {
            kind: 'bump',
            from: _worldFor(tileX, tileZ),
            dir:  new THREE.Vector3(dx, 0, dz),
            t: 0,
            dur: BUMP_TIME,
        };
        return;
    }
    anim = {
        kind: 'move',
        from: _worldFor(tileX, tileZ),
        to:   _worldFor(nx, nz),
        t: 0,
        dur: STEP_TIME,
        nx, nz,
    };
}

function _turn(sign) {
    const fromYaw = _yawFor(facing);
    facing = (facing + sign + 4) % 4;
    anim = {
        kind: 'turn',
        from: fromYaw,
        to:   fromYaw - sign * (Math.PI / 2),   // continuous so the lerp doesn't wrap
        t: 0,
        dur: TURN_TIME,
    };
}

// Smoothstep easing for a snappy-but-soft grid step.
function _ease(p) { return p * p * (3 - 2 * p); }

export function updatePlayer(dt) {
    if (!anim) return;

    anim.t += dt;
    const p = _ease(Math.min(anim.t / anim.dur, 1));

    if (anim.kind === 'move') {
        camera.position.lerpVectors(anim.from, anim.to, p);
    } else if (anim.kind === 'turn') {
        camera.rotation.set(0, anim.from + (anim.to - anim.from) * p, 0);
    } else { // 'bump' — lurch into the wall and back, with a small head-knock dip
        const knock = Math.sin(Math.min(anim.t / anim.dur, 1) * Math.PI);
        camera.position.copy(anim.from).addScaledVector(anim.dir, knock * BUMP_DIST);
        camera.position.y = EYE_Y - knock * BUMP_DIP;
    }

    if (anim.t >= anim.dur) {
        // Commit the logical pose and snap exactly onto the grid.
        const kind = anim.kind;
        if (kind === 'move') {
            tileX = anim.nx;
            tileZ = anim.nz;
            state.playerTile = { x: tileX, z: tileZ };
        } else if (kind === 'turn') {
            state.facing = facing;
        }
        anim = null;
        _snapCamera();
        if (kind === 'move') _onArrive();
        if (kind !== 'bump') events.emit('playerMoved', { x: tileX, z: tileZ, facing });
    }
}

/** Tile checks on completing a step: stairs now; loot/encounters hook in here (Phases 4–5). */
function _onArrive() {
    playFootstep();
    _revealTile(tileX, tileZ);
    const ch = tileAt(tileX, tileZ);
    events.emit('tileEntered', { x: tileX, z: tileZ, tile: ch });
    if (ch === '>') {
        playDescend();
        events.emit('stairsReached', { x: tileX, z: tileZ });
        events.emit('logMessage', 'Stairs descend deeper into the dark...');
    }
}

function _revealTile(x, z) {
    const key = `${x},${z}`;
    if (!_visited.has(key)) {
        _visited.add(key);
        events.emit('tileRevealed', { x, z });
    }
}

/** Returns a copy of the visited tile set (for minimap rendering). */
export function getVisited() { return _visited; }
