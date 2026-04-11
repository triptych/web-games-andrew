/**
 * village.js — Village building meshes and mode management.
 *
 * When a building is constructed (via state.upgradeBuilding),
 * this module places/updates a 3D mesh in the village area.
 *
 * Exports:
 *   initVillage(scene) → { update(dt) }
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
];

const BUILDING_COLORS = {
    blacksmith: 0x886644,
    healer:     0x44aa88,
    market:     0xaa8844,
    watchtower: 0x8888aa,
    tavern:     0xaa6644,
};

const _builtMeshes = {};

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

    scene.add(group);
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

    // Mode: dim world when in village mode
    events.on('modeChanged', (mode) => {
        // Placeholder — could toggle enemy AI pause, etc.
    });

    function update(dt) {
        // Future: animate buildings (smoke, flags, etc.)
    }

    return { update };
}
