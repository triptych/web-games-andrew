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
    // Slightly bump vertices for organic feel.
    // PlaneGeometry is in the XY plane before rotation, so local X=x, local Y=y (world Z after -PI/2 rotation).
    // We bump the Z component (local Z = world Y after rotation).
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
    _spawnTrees(scene, 80, VILLAGE_RADIUS + 4, WORLD_SIZE - 5);

    // ---- Decorative rocks ----
    _spawnRocks(scene, 40, VILLAGE_RADIUS + 4, WORLD_SIZE - 5);

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

    return { scene, camera, renderer, villageCenter: new THREE.Vector3(0, 0, 0), fireGroup, ambient, sun, stars };
}

// ---- Tree helper ----
function _spawnTrees(scene, count, minR, maxR) {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6);
    const foliageGeo = new THREE.ConeGeometry(1.1, 2.2, 7);
    const trunkMat  = new THREE.MeshLambertMaterial({ color: 0x7a5c3a });
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r     = minR + Math.random() * (maxR - minR);
        const x     = Math.cos(angle) * r;
        const z     = Math.sin(angle) * r;

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
        const angle = Math.random() * Math.PI * 2;
        const r     = minR + Math.random() * (maxR - minR);
        const x     = Math.cos(angle) * r;
        const z     = Math.sin(angle) * r;

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
