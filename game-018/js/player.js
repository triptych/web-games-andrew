/**
 * player.js — Player mesh, movement, attack, and input handling.
 *
 * Exports:
 *   initPlayer(scene, camera) → { playerGroup, update(dt) }
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    PLAYER_SPEED, PLAYER_ATK_RANGE, PLAYER_ATK_CD,
    WORLD_SIZE, VILLAGE_RADIUS,
    CAM_OFFSET, CAM_LERP,
    WEAPON_DEFS, TAVERN_HEAL_RADIUS, TAVERN_HEAL_RATE, TAVERN_HEAL_AMOUNT,
} from './config.js';
import {
    playSwordSwing, playAxeSwing, playBowShot, playPlayerHurt, playPickup, playGoldPickup, playFootstep, playHeal,
} from './sounds.js';

// ---- Input state ----
const keys = {};
document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup',   e => { keys[e.code] = false; });

// Mouse look state
let mouseYaw   = 0;
let mousePitch = 0.45; // slight downward tilt (radians)
let isPointerLocked = false;

document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement != null;
});
document.addEventListener('mousemove', e => {
    if (!isPointerLocked) return;
    mouseYaw   -= e.movementX * 0.002;
    mousePitch -= e.movementY * 0.002;
    mousePitch  = Math.max(-Math.PI / 4, Math.min(Math.PI / 3, mousePitch));
});

export function requestPointerLock() {
    document.body.requestPointerLock();
}

// ---- Build player mesh ----
function _buildPlayerMesh() {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.7, 1.0, 0.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4488ff });
    const body    = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffddaa });
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);

    // Weapon (starts as sword)
    const swordGeo = new THREE.BoxGeometry(0.12, 0.8, 0.12);
    const swordMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const sword    = new THREE.Mesh(swordGeo, swordMat);
    sword.position.set(0.5, 1.1, -0.1);
    sword.name = 'weapon';
    sword.castShadow = true;
    group.add(sword);

    // Shadow blob
    const shadowGeo = new THREE.CircleGeometry(0.4, 12);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
    const shadow    = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    group.add(shadow);

    group.userData.sword = sword;
    return group;
}

// ---- Init ----
export function initPlayer(scene, camera) {
    const playerGroup = _buildPlayerMesh();
    playerGroup.position.set(0, 0, 3);
    scene.add(playerGroup);

    let atkCooldown  = 0;
    let footTimer    = 0;
    let swingAnim    = 0;   // >0 = mid-swing
    let isMoving     = false;
    let lastFacingDir = new THREE.Vector3(0, 0, -1);  // cached for arc attacks
    let tavernHealTimer = 0;

    // Arm bob reference (always look up the current weapon by name)
    const sword = playerGroup.userData.sword;

    // Weapon mesh swap on equip
    events.on('weaponChanged', (type) => {
        const wDef = WEAPON_DEFS[type];
        const oldWeapon = playerGroup.getObjectByName('weapon');
        if (oldWeapon) playerGroup.remove(oldWeapon);
        let geo;
        if (type === 'axe') {
            geo = new THREE.BoxGeometry(0.35, 0.55, 0.1);
        } else if (type === 'bow') {
            geo = new THREE.TorusGeometry(0.3, 0.04, 6, 12, Math.PI);
        } else {
            geo = new THREE.BoxGeometry(0.12, 0.8, 0.12);
        }
        const mat = new THREE.MeshLambertMaterial({ color: wDef.color });
        const newWeapon = new THREE.Mesh(geo, mat);
        newWeapon.position.set(0.5, 1.1, -0.1);
        newWeapon.name = 'weapon';
        playerGroup.add(newWeapon);
    });

    // Camera pivot
    const camPivot = new THREE.Object3D();
    scene.add(camPivot);

    function update(dt, monsters, pickups, builtPositions) {
        if (state.isGameOver) return;

        // --- Movement ---
        const moveDir = new THREE.Vector3(0, 0, 0);

        // Forward/back based on yaw
        const fwd = new THREE.Vector3(-Math.sin(mouseYaw), 0, -Math.cos(mouseYaw));
        const right = new THREE.Vector3(Math.cos(mouseYaw), 0, -Math.sin(mouseYaw));

        if (keys['KeyW'] || keys['ArrowUp'])    moveDir.addScaledVector(fwd, 1);
        if (keys['KeyS'] || keys['ArrowDown'])  moveDir.addScaledVector(fwd, -1);
        if (keys['KeyA'] || keys['ArrowLeft'])  moveDir.addScaledVector(right, -1);
        if (keys['KeyD'] || keys['ArrowRight']) moveDir.addScaledVector(right, 1);

        isMoving = moveDir.lengthSq() > 0;

        if (isMoving) {
            moveDir.normalize();
            const speed = PLAYER_SPEED * dt;
            const nx = playerGroup.position.x + moveDir.x * speed;
            const nz = playerGroup.position.z + moveDir.z * speed;
            const limit = WORLD_SIZE - 2;
            playerGroup.position.x = Math.max(-limit, Math.min(limit, nx));
            playerGroup.position.z = Math.max(-limit, Math.min(limit, nz));

            // Face movement direction
            playerGroup.rotation.y = Math.atan2(moveDir.x, moveDir.z);

            // Cache facing direction for arc-based attacks
            lastFacingDir.copy(moveDir);

            // Footstep sound (every ~0.35s)
            footTimer += dt;
            if (footTimer > 0.35) { footTimer = 0; playFootstep(); }
        } else {
            footTimer = 0;
        }

        // --- Camera follow ---
        const camDist   = 10;
        const camHeight = 8 + mousePitch * 6;
        const targetCamPos = new THREE.Vector3(
            playerGroup.position.x + Math.sin(mouseYaw) * camDist,
            playerGroup.position.y + camHeight,
            playerGroup.position.z + Math.cos(mouseYaw) * camDist
        );
        camera.position.lerp(targetCamPos, CAM_LERP);
        camera.lookAt(
            playerGroup.position.x,
            playerGroup.position.y + 1,
            playerGroup.position.z
        );

        // --- Attack cooldown ---
        if (atkCooldown > 0) atkCooldown -= dt;

        // --- Attack trigger ---
        if ((keys['Space'] || keys['KeyF']) && atkCooldown <= 0) {
            _doAttack(playerGroup, monsters, lastFacingDir);
            const weapon = WEAPON_DEFS[state.equippedWeapon] || WEAPON_DEFS.sword;
            atkCooldown = weapon.cooldown;
            swingAnim   = 0.25;
            if (state.equippedWeapon === 'axe') playAxeSwing();
            else if (state.equippedWeapon === 'bow') playBowShot();
            else playSwordSwing();
        }

        // Weapon swing animation
        const currentWeapon = playerGroup.getObjectByName('weapon');
        if (currentWeapon) {
            if (swingAnim > 0) {
                swingAnim -= dt;
                currentWeapon.rotation.x = (swingAnim / 0.25) * (Math.PI / 2);
            } else {
                // Idle bob
                currentWeapon.rotation.x = Math.sin(Date.now() * 0.002) * 0.1;
            }
        }

        // --- Pickup scan ---
        _checkPickups(playerGroup.position, pickups);

        // --- Tavern proximity heal ---
        if (builtPositions) {
            const tavernPos = builtPositions['tavern'];
            if (tavernPos && state.getBuildingLevel('tavern') > 0 && state.hp < state.maxHp) {
                const distToTavern = playerGroup.position.distanceTo(tavernPos);
                if (distToTavern <= TAVERN_HEAL_RADIUS) {
                    tavernHealTimer -= dt;
                    if (tavernHealTimer <= 0) {
                        tavernHealTimer = TAVERN_HEAL_RATE;
                        state.heal(TAVERN_HEAL_AMOUNT);
                        playHeal();
                        events.emit('message', 'Resting at the tavern... HP restored.', '#88ddaa');
                    }
                } else {
                    tavernHealTimer = Math.min(tavernHealTimer, 0);
                }
            }
        }

        // --- Emit position ---
        events.emit('playerMoved', playerGroup.position);
    }

    return { playerGroup, update };
}

// ---- Attack ----
function _doAttack(playerGroup, monsters, lastFacingDir) {
    const weapon  = WEAPON_DEFS[state.equippedWeapon] || WEAPON_DEFS.sword;
    const reach   = weapon.range;
    const pPos    = playerGroup.position;
    const cosHalf = Math.cos(weapon.arcAngle / 2);

    for (const m of monsters) {
        if (!m.alive) continue;
        const diff = new THREE.Vector3().subVectors(m.mesh.position, pPos).setY(0);
        const dist = diff.length();
        if (dist > reach) continue;
        if (dist > 0) {
            const dot = diff.normalize().dot(lastFacingDir);
            if (dot < cosHalf) continue;
        }
        const dmg = Math.floor(state.atk * weapon.dmgMult) + Math.floor(Math.random() * 6);
        m.takeDamage(dmg);
    }
}

// ---- Pickup ----
function _checkPickups(pPos, pickups) {
    for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        if (!p.active) continue;
        if (pPos.distanceTo(p.mesh.position) < 1.2) {
            p.collect();
        }
    }
}
