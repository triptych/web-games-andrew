/**
 * village.js — Village building meshes and mode management.
 *
 * Exports:
 *   initVillage(scene) → { update(dt, nightBlend) }
 *   builtPositions — live object mapping building id to THREE.Vector3 world pos
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { state }  from './state.js';
import { events } from './events.js';
import { BUILDING_DEFS, VILLAGE_RADIUS } from './config.js';

// Pre-defined slot positions in the village circle
const BUILDING_SLOTS = [
    { x: -8, z: -5  },
    { x:  8, z: -5  },
    { x: -8, z:  5  },
    { x:  8, z:  5  },
    { x:  0, z: -10 },
    { x:  0, z:  10 },   // alchemist slot
];

const BUILDING_COLORS = {
    blacksmith: 0x886644,
    healer:     0x44aa88,
    market:     0xaa8844,
    watchtower: 0x8888aa,
    tavern:     0xaa6644,
    alchemist:  0x6644aa,
};

const _builtMeshes  = {};
const _torchLights  = {};

// Live export: player.js imports this directly to check tavern position
export const builtPositions = {};

function _buildBuildingMesh(scene, defId, slotIndex) {
    const def  = BUILDING_DEFS.find(b => b.id === defId);
    const slot = BUILDING_SLOTS[slotIndex];
    const col  = BUILDING_COLORS[defId] ?? 0x888888;
    const group = new THREE.Group();
    group.position.set(slot.x, 0, slot.z);

    // Foundation
    const foundGeo = new THREE.BoxGeometry(3, 0.25, 3);
    const foundMat = new THREE.MeshLambertMaterial({ color: 0xb8a070 });
    const found    = new THREE.Mesh(foundGeo, foundMat);
    found.position.y = 0.125;
    found.receiveShadow = true;
    group.add(found);

    // Walls
    const wallGeo = new THREE.BoxGeometry(2.6, 2.0, 2.6);
    const wallMat = new THREE.MeshLambertMaterial({ color: col });
    const walls   = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = 1.25;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    // Roof (pyramid)
    const roofGeo = new THREE.ConeGeometry(2.0, 1.2, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b3a3a });
    const roof    = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.85;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Special: watchtower is taller
    if (defId === 'watchtower') {
        walls.scale.y = 2.2;
        walls.position.y = 2.4;
        roof.position.y  = 4.8 + 0.6;
    }

    // Torch point light beside building (starts at 0 intensity, brightens at night)
    const torch = new THREE.PointLight(0xff9955, 0, 7, 2);
    torch.position.set(1.6, 2.2, 0);
    group.add(torch);
    _torchLights[defId] = torch;

    scene.add(group);

    // Record world position for proximity checks
    builtPositions[defId] = new THREE.Vector3(slot.x, 0, slot.z);

    return group;
}

export function initVillage(scene) {
    let slotIndex = 0;

    // Listen for buildings being built
    events.on('buildingBuilt', (id, level) => {
        if (level === 1) {
            // First time built — place mesh
            const mesh = _buildBuildingMesh(scene, id, slotIndex++);
            _builtMeshes[id] = mesh;
        } else {
            // Upgrade — tint slightly brighter
            const mesh = _builtMeshes[id];
            if (mesh) {
                mesh.traverse(child => {
                    if (child.isMesh && child.material.color) {
                        child.material.color.multiplyScalar(1.12);
                    }
                });
            }
        }
    });

    // Mode: placeholder
    events.on('modeChanged', (mode) => {});

    function update(dt, nightBlend = 0) {
        // Update torch intensities based on time of day
        const torchIntensity = nightBlend * 2.0;
        for (const light of Object.values(_torchLights)) {
            light.intensity = torchIntensity + Math.sin(Date.now() * 0.005 + light.position.x) * 0.15 * nightBlend;
        }
    }

    return { update };
}
