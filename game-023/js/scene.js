/**
 * scene.js — Three.js scene setup: renderer, camera, background, grid, stars, sun.
 */

import * as THREE from 'three';
import { COLORS, CAM_FOV, CAM_Z, CAM_TILT_X, GRID_LINES, GRID_SIZE, GRID_NEAR, GRID_HORIZON } from './config.js';

export let renderer, scene, camera;
export const clock = new THREE.Clock();

export function initScene() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(COLORS.bg);
    document.body.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(COLORS.bg, 0.04);

    // Camera
    camera = new THREE.PerspectiveCamera(CAM_FOV, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 3, CAM_Z);
    camera.rotation.x = CAM_TILT_X;

    _buildSynthwaveGrid();
    _buildStars();
    _buildSun();

    window.addEventListener('resize', _onResize);
}

function _buildSynthwaveGrid() {
    // Perspective grid: lines converging toward the horizon
    // We draw vertical (Z-running) lines and horizontal (X-running) lines on a flat plane
    const group = new THREE.Group();

    const matBright = new THREE.LineBasicMaterial({ color: COLORS.grid,    transparent: true, opacity: 0.7 });
    const matDim    = new THREE.LineBasicMaterial({ color: COLORS.gridDim, transparent: true, opacity: 0.4 });

    const halfCols = Math.floor(GRID_LINES / 2);
    const xStep    = GRID_SIZE / GRID_LINES;
    const yPlane   = -1.2;

    // Vertical lines (run from near to horizon)
    for (let i = -halfCols; i <= halfCols; i++) {
        const x = i * xStep;
        const pts = [
            new THREE.Vector3(x, yPlane, GRID_NEAR),
            new THREE.Vector3(x, yPlane, GRID_HORIZON),
        ];
        const geo  = new THREE.BufferGeometry().setFromPoints(pts);
        const mat  = (i % 5 === 0) ? matBright : matDim;
        group.add(new THREE.Line(geo, mat));
    }

    // Horizontal lines — more dense near camera, sparse far (perspective illusion)
    const rowCount = 22;
    for (let r = 0; r <= rowCount; r++) {
        // Non-linear spacing: cluster rows near camera
        const t   = Math.pow(r / rowCount, 1.8);
        const z   = GRID_HORIZON + t * (GRID_NEAR - GRID_HORIZON);
        const xHalf = (GRID_SIZE / 2) * (1 - 0.35 * (1 - t)); // slight converge
        const pts   = [
            new THREE.Vector3(-xHalf, yPlane, z),
            new THREE.Vector3( xHalf, yPlane, z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = (r % 4 === 0) ? matBright : matDim;
        group.add(new THREE.Line(geo, mat));
    }

    scene.add(group);
}

function _buildStars() {
    const count   = 1800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = Math.random() * 50 + 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat  = new THREE.PointsMaterial({ color: COLORS.starNear, size: 0.18, sizeAttenuation: true });
    scene.add(new THREE.Points(geo, mat));

    // Dimmer far stars tinted purple
    const count2    = 600;
    const positions2 = new Float32Array(count2 * 3);
    for (let i = 0; i < count2; i++) {
        positions2[i * 3]     = (Math.random() - 0.5) * 300;
        positions2[i * 3 + 1] = Math.random() * 80 + 20;
        positions2[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }
    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.BufferAttribute(positions2, 3));
    const mat2  = new THREE.PointsMaterial({ color: COLORS.starFar, size: 0.12, sizeAttenuation: true });
    scene.add(new THREE.Points(geo2, mat2));
}

function _buildSun() {
    // Retro synthwave retrowave sun — a circle with horizontal stripe cutouts
    const group = new THREE.Group();
    group.position.set(0, 2.5, GRID_HORIZON - 5);

    // Main disc
    const discGeo = new THREE.CircleGeometry(5.5, 64);
    const discMat = new THREE.MeshBasicMaterial({ color: COLORS.sun, side: THREE.FrontSide });
    group.add(new THREE.Mesh(discGeo, discMat));

    // Dark horizontal stripes (mask effect)
    const stripes = [
        { y: -0.5, h: 0.18 },
        { y: -1.1, h: 0.22 },
        { y: -1.8, h: 0.28 },
        { y: -2.6, h: 0.36 },
        { y: -3.6, h: 0.50 },
    ];
    for (const s of stripes) {
        const geo = new THREE.PlaneGeometry(12, s.h);
        const mat = new THREE.MeshBasicMaterial({ color: COLORS.bg, side: THREE.FrontSide, depthTest: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, s.y, 0.01);
        mesh.renderOrder = 1;
        group.add(mesh);
    }

    scene.add(group);
}

function _onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
