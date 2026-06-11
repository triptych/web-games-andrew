/**
 * player.js — Player avatar: class-driven 8-direction movement with wall
 * collision (axis-separated so you slide along walls instead of sticking).
 *
 * The avatar is a THREE.Group (body + face + a swing arm) so it can be rotated
 * as one unit to face the travel direction and carry a small attack animation.
 * The face (eyes + brow) sits on the +Z side of the group — the same direction
 * `rotation.y = atan2(dx, dz)` points — so it always shows which way you face.
 *
 * Input is read from a small key-set this module owns; main.js just calls
 * initPlayer(cls) on spawn and updatePlayer(dt) each frame. combat.js calls
 * triggerAttackAnim() when an attack fires so the arm swings.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { collidesCircle, getSpawn } from './maze.js';
import { events } from './events.js';

const RADIUS     = 1.0;    // collision radius (world units)
const HURT_FLASH = 0.18;   // seconds the avatar glows red after taking a hit
const ATTACK_DUR = 0.25;   // seconds the swing animation lasts

let _group  = null;        // the whole avatar (rotated to face travel dir)
let _body   = null;        // body mesh (holds the class-color material)
let _arm    = null;        // swing arm pivot
let _speed  = 6;
let _color  = 0x64c8ff;
let _hurt   = 0;           // remaining hurt-flash time (seconds)
let _attack = 0;           // remaining attack-animation time (seconds)

const _keys = new Set();

function _onKeyDown(e) { _keys.add(e.key.toLowerCase()); }
function _onKeyUp(e)   { _keys.delete(e.key.toLowerCase()); }

// Subscribe ONCE at module load (initPlayer runs per level — subscribing there
// would stack listeners). The flash is rendered/decayed in updatePlayer.
events.on('playerHurt', () => { _hurt = HURT_FLASH; });

/** Wire up movement key listeners (idempotent). */
export function attachPlayerInput() {
    window.addEventListener('keydown', _onKeyDown);
    window.addEventListener('keyup',   _onKeyUp);
}
export function detachPlayerInput() {
    window.removeEventListener('keydown', _onKeyDown);
    window.removeEventListener('keyup',   _onKeyUp);
    _keys.clear();
}

/** Build the avatar group once: body, face (brow + two eyes), and a swing arm. */
function _buildAvatar() {
    const group = new THREE.Group();

    // Body — the class-colored box (material lives here for flash/recolor).
    const bodyGeo = new THREE.BoxGeometry(1.4, 1.6, 1.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: _color });
    _body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(_body);

    // Face sits on the +Z face of the body (the direction the group points).
    const FZ = 0.71;   // just proud of the body's +Z surface (half-depth 0.7)
    const eyeGeo = new THREE.BoxGeometry(0.26, 0.26, 0.12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });   // bright → catches bloom
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.32, 0.22, FZ);
    eyeR.position.set( 0.32, 0.22, FZ);
    group.add(eyeL, eyeR);

    // Pupils — small dark blocks, slightly proud of the eyes.
    const pupGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const pupMat = new THREE.MeshBasicMaterial({ color: 0x101018 });
    const pupL = new THREE.Mesh(pupGeo, pupMat);
    const pupR = new THREE.Mesh(pupGeo, pupMat);
    pupL.position.set(-0.32, 0.22, FZ + 0.06);
    pupR.position.set( 0.32, 0.22, FZ + 0.06);
    group.add(pupL, pupR);

    // Brow — a dark bar above the eyes, makes "forward" unmistakable.
    const browGeo = new THREE.BoxGeometry(1.0, 0.16, 0.12);
    const browMat = new THREE.MeshBasicMaterial({ color: 0x101018 });
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(0, 0.55, FZ);
    group.add(brow);

    // Swing arm — a small bright box on a pivot at the body's front-right, in
    // front of the avatar. It rotates forward during an attack (see updatePlayer).
    _arm = new THREE.Group();
    _arm.position.set(0.5, 0.1, 0.4);   // shoulder, slightly forward + right
    const handGeo = new THREE.BoxGeometry(0.3, 0.3, 1.0);
    const handMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hand = new THREE.Mesh(handGeo, handMat);
    hand.position.set(0, 0, 0.55);      // extends forward from the pivot
    _arm.add(hand);
    group.add(_arm);

    return group;
}

/** Spawn (or respawn) the player for a given class definition. */
export function initPlayer(cls) {
    _speed = cls.speed;
    _color = cls.color;

    if (!_group) {
        _group = _buildAvatar();
        scene.add(_group);
    } else {
        _body.material.color.setHex(_color);
    }

    _hurt = 0;
    _attack = 0;
    _body.material.emissive.setHex(0x000000);
    _arm.rotation.x = 0;

    const spawn = getSpawn();
    _group.position.set(spawn.x, 0.8, spawn.z);
    attachPlayerInput();
}

/** Current player world position (Vector3). */
export function getPlayerPos() {
    return _group ? _group.position : new THREE.Vector3();
}

/** Facing as a unit vector in the XZ plane (for aiming shots). */
let _facing = new THREE.Vector3(0, 0, 1);
export function getPlayerFacing() { return _facing.clone(); }

/** Kick off the attack swing animation. Called by combat.js when an attack fires. */
export function triggerAttackAnim() { _attack = ATTACK_DUR; }

/** Per-frame update. dt in seconds. */
export function updatePlayer(dt) {
    if (!_group) return;

    // Hurt flash: glow red, fading out. Decay before the no-input early return
    // so the flash still fades when the player is standing still.
    if (_hurt > 0) {
        _hurt -= dt;
        const k = Math.max(0, _hurt / HURT_FLASH);
        _body.material.emissive.setRGB(k, 0, 0);
    }

    // Attack swing: arm sweeps forward and back over ATTACK_DUR. Also decays
    // outside the movement block so a stationary attack still animates.
    if (_attack > 0) {
        _attack -= dt;
        const k = Math.max(0, _attack / ATTACK_DUR);   // 1 → 0
        // sin(pi*k) peaks mid-swing → smooth out-and-back overhead chop.
        _arm.rotation.x = -Math.sin(Math.PI * k) * 1.6;
    } else {
        _arm.rotation.x = 0;
    }

    let dx = 0, dz = 0;
    if (_keys.has('arrowup')    || _keys.has('w')) dz -= 1;
    if (_keys.has('arrowdown')  || _keys.has('s')) dz += 1;
    if (_keys.has('arrowleft')  || _keys.has('a')) dx -= 1;
    if (_keys.has('arrowright') || _keys.has('d')) dx += 1;

    if (dx === 0 && dz === 0) return;

    // Normalize so diagonal movement isn't faster.
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
    _facing.set(dx, 0, dz);

    const step = _speed * dt;
    const px = _group.position.x;
    const pz = _group.position.z;

    // Axis-separated collision → slide along walls.
    const nx = px + dx * step;
    if (!collidesCircle(nx, pz, RADIUS)) _group.position.x = nx;

    const nz = pz + dz * step;
    if (!collidesCircle(_group.position.x, nz, RADIUS)) _group.position.z = nz;

    // Face the direction of travel (yaw only). The face + arm rotate with the group.
    _group.rotation.y = Math.atan2(dx, dz);
}
