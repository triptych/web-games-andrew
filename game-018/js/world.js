/**
 * world.js — Three.js scene setup: terrain, village, trees, rocks, lighting.
 * Returns { scene, camera, renderer, villageCenter }.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { WORLD_SIZE, VILLAGE_RADIUS, COLORS } from './config.js';

export function initWorld() {
    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.body.appendChild(renderer.domElement);

    // ---- Scene ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 60, 140);

    // ---- Camera ----
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 12, 10);
    camera.lookAt(0, 0, 0);

    // Resize handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ---- Lighting ----
    const ambient = new THREE.AmbientLight(0xffeedd, 0.55);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5dd, 1.4);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 300;
    sun.shadow.camera.left   = -WORLD_SIZE;
    sun.shadow.camera.right  =  WORLD_SIZE;
    sun.shadow.camera.top    =  WORLD_SIZE;
    sun.shadow.camera.bottom = -WORLD_SIZE;
    sun.shadow.bias          = -0.001;
    scene.add(sun);

    // ---- Ground ----
    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 40, 40);
    // Vertex displacement pass — creates subtle organic terrain bumps outside the village.
    // PlaneGeometry is in the XY plane before rotation, so local X=x, local Y=y (world Z after -PI/2 rotation).
    // We displace the local Z component (which becomes world Y after the -PI/2 X rotation applied below).
    // Vertices within VILLAGE_RADIUS+5 of centre are left flat so the village sits on level ground.
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);   // local X and Y span the plane
        const dist = Math.sqrt(x * x + y * y);
        if (dist > VILLAGE_RADIUS + 5) {
            pos.setZ(i, (Math.random() - 0.5) * 0.35);  // local Z becomes world Y after rotation
        }
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshLambertMaterial({ color: COLORS.ground });
    const ground    = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);

    // ---- Village area (slightly different colour) ----
    const villageGeo = new THREE.CircleGeometry(VILLAGE_RADIUS, 32);
    const villageMat = new THREE.MeshLambertMaterial({ color: COLORS.villageGrass });
    const villagePlane = new THREE.Mesh(villageGeo, villageMat);
    villagePlane.rotation.x = -Math.PI / 2;
    villagePlane.position.y = 0.02;
    villagePlane.receiveShadow = true;
    scene.add(villagePlane);

    // ---- Village path (dirt road) ----
    const pathGeo = new THREE.PlaneGeometry(4, WORLD_SIZE);
    const pathMat = new THREE.MeshLambertMaterial({ color: COLORS.path });
    const path    = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.01;
    path.position.z = WORLD_SIZE / 2;
    scene.add(path);

    // ---- Village center marker (campfire placeholder) ----
    const fireGroup = new THREE.Group();
    fireGroup.position.set(0, 0, 0);

    // Log pile
    const logGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6);
    const logMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        log.rotation.x = Math.PI / 2;
        log.rotation.z = (i / 3) * Math.PI;
        log.castShadow = true;
        fireGroup.add(log);
    }

    // Flame (orange sphere, animated in main loop)
    const flameGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7722 });
    const flame    = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.5;
    flame.name = 'flame';
    fireGroup.add(flame);

    // Point light for campfire glow
    const fireLight = new THREE.PointLight(0xff8844, 2.5, 14, 2);
    fireLight.position.set(0, 1.5, 0);
    fireGroup.add(fireLight);
    fireGroup.userData.fireLight = fireLight;

    scene.add(fireGroup);
    fireGroup.userData.flame = flame;

    // ---- Decorative trees ----
    _spawnTrees(scene, 90, VILLAGE_RADIUS + 4, WORLD_SIZE - 5);

    // ---- Decorative rocks (singles + clusters) ----
    _spawnRocks(scene, 30, VILLAGE_RADIUS + 4, WORLD_SIZE - 5);
    _spawnRockClusters(scene, 12, VILLAGE_RADIUS + 6, WORLD_SIZE - 8);

    // ---- Forest trails ----
    _spawnTrails(scene);

    // ---- Bushes ----
    _spawnBushes(scene, 55, VILLAGE_RADIUS + 3, WORLD_SIZE - 6);

    // ---- Passive animals (rabbits) — returned for animation ----
    const rabbits = _spawnRabbits(scene, 18, VILLAGE_RADIUS + 5, WORLD_SIZE - 10);

    // ---- Flowers / grass tufts ----
    _spawnFlowerPatches(scene, 60, VILLAGE_RADIUS + 3, WORLD_SIZE - 6);

    // ---- Stars (visible at night) ----
    const starGeo  = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 300; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        starVerts.push(
            Math.sin(phi) * Math.cos(theta) * 190,
            Math.abs(Math.cos(phi)) * 190 + 10,
            Math.sin(phi) * Math.sin(theta) * 190
        );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    const starMat  = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, sizeAttenuation: true });
    const stars    = new THREE.Points(starGeo, starMat);
    stars.visible  = false;
    scene.add(stars);

    return { scene, camera, renderer, villageCenter: new THREE.Vector3(0, 0, 0), fireGroup, ambient, sun, stars, rabbits };
}

/**
 * Pick a uniformly random position in an annulus (ring) defined by minR and maxR.
 * Used by all scatter-spawn helpers to place objects at a random distance from origin.
 * @param {number} minR - minimum radial distance from origin
 * @param {number} maxR - maximum radial distance from origin
 * @returns {{ x: number, z: number }}
 */
function _randRadialPos(minR, maxR) {
    const angle = Math.random() * Math.PI * 2;
    const r     = minR + Math.random() * (maxR - minR);
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

// ---- Tree helper ----
function _spawnTrees(scene, count, minR, maxR) {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6);
    const foliageGeo = new THREE.ConeGeometry(1.1, 2.2, 7);
    const trunkMat  = new THREE.MeshLambertMaterial({ color: 0x7a5c3a });
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });

    for (let i = 0; i < count; i++) {
        const { x, z } = _randRadialPos(minR, maxR);

        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.9;
        trunk.castShadow = true;

        const foliage = new THREE.Mesh(foliageGeo, foliageMat.clone());
        // Slight color variation
        foliage.material.color.setHex(0x2d6a2d + Math.floor(Math.random() * 0x102010));
        foliage.position.y = 2.6;
        foliage.castShadow = true;

        const scale = 0.7 + Math.random() * 0.8;
        group.scale.set(scale, scale * (0.9 + Math.random() * 0.4), scale);

        group.add(trunk);
        group.add(foliage);
        scene.add(group);
    }
}

// ---- Rock helper ----
function _spawnRocks(scene, count, minR, maxR) {
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    for (let i = 0; i < count; i++) {
        const { x, z } = _randRadialPos(minR, maxR);

        const rock = new THREE.Mesh(rockGeo, rockMat.clone());
        rock.material.color.setHex(0x777777 + Math.floor(Math.random() * 0x222222));
        rock.position.set(x, 0.25, z);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const s = 0.4 + Math.random() * 0.8;
        rock.scale.set(s, s * 0.6, s);
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
    }
}

// ---- Rock cluster helper — groups of 3-5 rocks close together ----
function _spawnRockClusters(scene, count, minR, maxR) {
    const bigGeo  = new THREE.DodecahedronGeometry(0.6, 1);
    const smlGeo  = new THREE.DodecahedronGeometry(0.3, 0);

    for (let i = 0; i < count; i++) {
        const { x: cx, z: cz } = _randRadialPos(minR, maxR);
        const clrHex = 0x666666 + Math.floor(Math.random() * 0x333333);
        const clusterSize = 3 + Math.floor(Math.random() * 3);

        for (let j = 0; j < clusterSize; j++) {
            const geo  = j === 0 ? bigGeo : smlGeo;
            const rock = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: clrHex }));
            const jOff = j === 0 ? 0 : (Math.random() - 0.5) * 1.8;
            rock.position.set(
                cx + (Math.random() - 0.5) * 2.0,
                j === 0 ? 0.3 : 0.15,
                cz + (Math.random() - 0.5) * 2.0
            );
            rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            const s = j === 0 ? (0.8 + Math.random() * 1.2) : (0.4 + Math.random() * 0.6);
            rock.scale.set(s, s * (0.5 + Math.random() * 0.4), s * (0.8 + Math.random() * 0.4));
            rock.castShadow = true;
            rock.receiveShadow = true;
            scene.add(rock);
        }
    }
}

// ---- Forest trails — winding dirt paths ----
function _spawnTrails(scene) {
    const trailMat = new THREE.MeshLambertMaterial({ color: 0xa08060 });

    // 3 radial trails branching out from village edge
    const trailAngles = [0.8, 2.5, 4.8];
    for (const baseAngle of trailAngles) {
        let x = Math.cos(baseAngle) * (VILLAGE_RADIUS + 2);
        let z = Math.sin(baseAngle) * (VILLAGE_RADIUS + 2);
        let angle = baseAngle;

        for (let step = 0; step < 18; step++) {
            const segLen = 3.5 + Math.random() * 2;
            angle += (Math.random() - 0.5) * 0.35;   // gentle curve
            const nx = x + Math.cos(angle) * segLen;
            const nz = z + Math.sin(angle) * segLen;

            const cx = (x + nx) * 0.5;
            const cz = (z + nz) * 0.5;
            const len = Math.sqrt((nx - x) ** 2 + (nz - z) ** 2);

            const seg = new THREE.Mesh(
                new THREE.PlaneGeometry(1.4 + Math.random() * 0.4, len),
                trailMat
            );
            seg.rotation.x = -Math.PI / 2;
            seg.rotation.z = -(angle - Math.PI / 2);
            seg.position.set(cx, 0.015, cz);
            seg.receiveShadow = true;
            scene.add(seg);

            x = nx; z = nz;
            if (Math.sqrt(nx * nx + nz * nz) > WORLD_SIZE - 8) break;
        }
    }
}

// ---- Bush helper ----
function _spawnBushes(scene, count, minR, maxR) {
    for (let i = 0; i < count; i++) {
        const { x, z } = _randRadialPos(minR, maxR);

        // Pick a green shade
        const greenBase = 0x1a5c1a + Math.floor(Math.random() * 0x184018);
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // 2–3 overlapping sphere blobs
        const blobCount = 2 + Math.floor(Math.random() * 2);
        for (let b = 0; b < blobCount; b++) {
            const blobR = 0.3 + Math.random() * 0.25;
            const blob  = new THREE.Mesh(
                new THREE.SphereGeometry(blobR, 6, 5),
                new THREE.MeshLambertMaterial({ color: greenBase + Math.floor(Math.random() * 0x102010) })
            );
            blob.position.set(
                (Math.random() - 0.5) * 0.5,
                blobR * 0.85,
                (Math.random() - 0.5) * 0.5
            );
            blob.castShadow = true;
            group.add(blob);
        }

        const s = 0.6 + Math.random() * 0.9;
        group.scale.set(s, s * (0.6 + Math.random() * 0.5), s);
        scene.add(group);
    }
}

// ---- Flower patches / grass tufts ----
function _spawnFlowerPatches(scene, count, minR, maxR) {
    const flowerColors = [0xffcc00, 0xff66aa, 0xffffff, 0xcc66ff, 0xff8833];
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x4a8a2a });

    for (let i = 0; i < count; i++) {
        const { x: cx, z: cz } = _randRadialPos(minR, maxR);

        const flowerCount = 2 + Math.floor(Math.random() * 4);
        for (let f = 0; f < flowerCount; f++) {
            const fx = cx + (Math.random() - 0.5) * 1.4;
            const fz = cz + (Math.random() - 0.5) * 1.4;

            // Stem
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.28, 4),
                stemMat
            );
            stem.position.set(fx, 0.14, fz);
            scene.add(stem);

            // Head
            const col  = flowerColors[Math.floor(Math.random() * flowerColors.length)];
            const head = new THREE.Mesh(
                new THREE.SphereGeometry(0.08 + Math.random() * 0.05, 5, 4),
                new THREE.MeshLambertMaterial({ color: col })
            );
            head.position.set(fx, 0.32, fz);
            scene.add(head);
        }
    }
}

// ---- Passive rabbits ----
function _spawnRabbits(scene, count, minR, maxR) {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xddccbb });
    const earMat  = new THREE.MeshLambertMaterial({ color: 0xffaaaa });
    const eyeMat  = new THREE.MeshBasicMaterial({ color: 0x220000 });
    const list    = [];

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r     = minR + Math.random() * (maxR - minR);
        const ox    = Math.cos(angle) * r;
        const oz    = Math.sin(angle) * r;

        const group = new THREE.Group();
        group.position.set(ox, 0, oz);

        // Body
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 6), bodyMat.clone());
        body.scale.set(1, 0.8, 1.2);
        body.position.y = 0.2;
        body.castShadow = true;
        group.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), bodyMat.clone());
        head.position.set(0, 0.38, -0.2);
        group.add(head);

        // Ears (two tall thin boxes)
        for (const ex of [-0.07, 0.07]) {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.04), earMat);
            ear.position.set(ex, 0.56, -0.2);
            group.add(ear);
        }

        // Eyes
        for (const ex of [-0.06, 0.06]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), eyeMat);
            eye.position.set(ex, 0.4, -0.33);
            group.add(eye);
        }

        // Tail (tiny white puff)
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4),
            new THREE.MeshLambertMaterial({ color: 0xffffff }));
        tail.position.set(0, 0.2, 0.22);
        group.add(tail);

        scene.add(group);

        // Store wander state on group.userData
        group.userData.rabbit = {
            homeX: ox, homeZ: oz,
            targetX: ox, targetZ: oz,
            wanderTimer: Math.random() * 3,
            hopTimer: 0,
            hopPhase: 0,
        };

        list.push(group);
    }

    return list;
}

/**
 * updateRabbits(rabbits, dt) — call from main game loop each frame.
 * Rabbits wander near their spawn point and hop gently.
 */
export function updateRabbits(rabbits, dt) {
    if (!rabbits) return;
    for (const r of rabbits) {
        const d = r.userData.rabbit;
        d.wanderTimer -= dt;
        if (d.wanderTimer <= 0) {
            // Pick a new nearby target
            const spread = 4 + Math.random() * 4;
            const a = Math.random() * Math.PI * 2;
            d.targetX = d.homeX + Math.cos(a) * spread;
            d.targetZ = d.homeZ + Math.sin(a) * spread;
            d.wanderTimer = 2.5 + Math.random() * 4;
        }

        // Move toward target
        const dx = d.targetX - r.position.x;
        const dz = d.targetZ - r.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.3) {
            const spd = 1.8;
            r.position.x += (dx / dist) * spd * dt;
            r.position.z += (dz / dist) * spd * dt;
            r.rotation.y  = Math.atan2(dx, dz);

            // Hop animation
            d.hopTimer += dt * 6;
            r.position.y = Math.max(0, Math.sin(d.hopTimer) * 0.12);
        } else {
            r.position.y = 0;
        }
    }
}
