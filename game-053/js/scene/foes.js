// Procedural foes, built from a creature's kind and colour. Each model has
// userData.parts for animation and userData.height for the damage numbers.
import * as THREE from 'three';
import { mulberry32, hashStr } from '../rng.js';

function std(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra }); }
function eyeMat(color = 0xffd040) { return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: 2.5 }); }

export function buildFoe(c) {
    const rnd = mulberry32(hashStr(c.name));
    const col = new THREE.Color(c.color ?? 0x888888);
    const dark = col.clone().multiplyScalar(0.55);
    const light = col.clone().lerp(new THREE.Color(0xffffff), 0.3);
    const body = std(col), bodyD = std(dark), bodyL = std(light);
    const g = new THREE.Group();
    const parts = { bob: new THREE.Group() };
    g.add(parts.bob);
    const B = parts.bob;
    let height = 1.8;
    const eyeC = c.kind === 'spirit' ? 0x9fd8ff : c.kind === 'dragon' ? 0x40ff90 : rnd() < 0.5 ? 0xffcc33 : 0xff4422;
    const eyes = (parent, x, y, z, r = 0.07) => { for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), eyeMat(eyeC)); e.position.set(s * x, y, z); parent.add(e); } };
    const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = B) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

    switch (c.kind) {
        case 'beast': {
            mesh(new THREE.CapsuleGeometry(0.42, 1.1, 4, 8), body, 0, 0.95, 0).rotation.x = Math.PI / 2;
            for (const [x, z] of [[-0.28, 0.45], [0.28, 0.45], [-0.28, -0.45], [0.28, -0.45]]) mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.7, 6), bodyD, x, 0.35, z);
            const head = new THREE.Group(); head.position.set(0, 1.25, 0.85); B.add(head); parts.head = head;
            mesh(new THREE.BoxGeometry(0.5, 0.45, 0.55), body, 0, 0, 0, head);
            mesh(new THREE.BoxGeometry(0.3, 0.25, 0.4), bodyL, 0, -0.08, 0.38, head);
            for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.09, 0.25, 4), bodyD, s * 0.17, 0.3, -0.05, head);
            eyes(head, 0.14, 0.08, 0.28);
            mesh(new THREE.ConeGeometry(0.08, 0.7, 5), bodyD, 0, 1.05, -0.95).rotation.x = -2.2;
            height = 1.7; break;
        }
        case 'insect': {
            for (const [z, r] of [[-0.6, 0.42], [0, 0.3], [0.45, 0.25]]) mesh(new THREE.SphereGeometry(r, 8, 6), z === 0 ? bodyD : body, 0, 0.6, z);
            for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const l = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.9, 4), bodyD, s * 0.45, 0.35, -0.2 + i * 0.25); l.rotation.z = s * 1.0; }
            const head = new THREE.Group(); head.position.set(0, 0.62, 0.62); B.add(head); parts.head = head;
            for (const s of [-1, 1]) { const m = mesh(new THREE.ConeGeometry(0.05, 0.3, 4), bodyL, s * 0.1, -0.05, 0.15, head); m.rotation.x = Math.PI / 2; m.rotation.z = s * 0.4; }
            eyes(head, 0.11, 0.08, 0.12, 0.06);
            height = 1.1; break;
        }
        case 'slime': {
            const m = mesh(new THREE.SphereGeometry(0.75, 16, 12), std(col, { transparent: true, opacity: 0.82, roughness: 0.15, flatShading: false, emissive: col, emissiveIntensity: 0.15 }), 0, 0.6, 0);
            m.scale.set(1.15, 0.85, 1.15); parts.squish = m;
            mesh(new THREE.SphereGeometry(0.35, 10, 8), bodyD, 0, 0.55, 0);
            eyes(B, 0.22, 0.85, 0.62, 0.09);
            height = 1.3; break;
        }
        case 'flyer': {
            mesh(new THREE.SphereGeometry(0.38, 10, 8), body, 0, 1.6, 0).scale.set(1, 0.9, 1.3);
            const head = new THREE.Group(); head.position.set(0, 1.8, 0.45); B.add(head); parts.head = head;
            mesh(new THREE.SphereGeometry(0.22, 8, 6), bodyL, 0, 0, 0, head);
            mesh(new THREE.ConeGeometry(0.08, 0.35, 4), std(0xd8a030), 0, -0.04, 0.27, head).rotation.x = Math.PI / 2;
            eyes(head, 0.1, 0.06, 0.16, 0.05);
            parts.wings = [];
            for (const s of [-1, 1]) {
                const w = new THREE.Group(); w.position.set(s * 0.3, 1.7, 0); B.add(w);
                const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(s * 1.3, 0.25); shp.lineTo(s * 1.0, -0.15); shp.lineTo(s * 0.6, -0.35); shp.closePath();
                const wm = new THREE.Mesh(new THREE.ShapeGeometry(shp), std(dark, { side: THREE.DoubleSide })); wm.rotation.x = -Math.PI / 2.3; w.add(wm);
                parts.wings.push({ w, s });
            }
            for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), std(0xd8a030), s * 0.12, 1.2, 0);
            height = 2.1; break;
        }
        case 'spirit': {
            const geo = new THREE.LatheGeometry([[0, 2.1], [0.32, 2.0], [0.42, 1.7], [0.45, 1.2], [0.55, 0.7], [0.7, 0.25], [0.5, 0.0]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
            const m = mesh(geo, std(col, { transparent: true, opacity: 0.6, emissive: col, emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false }), 0, 0.3, 0);
            parts.ghost = m;
            for (const s of [-1, 1]) { const a = mesh(new THREE.ConeGeometry(0.12, 0.9, 6), std(col, { transparent: true, opacity: 0.5, emissive: col, emissiveIntensity: 0.5 }), s * 0.55, 1.6, 0.15); a.rotation.z = s * 2.4; }
            eyes(B, 0.13, 2.05, 0.3, 0.07);
            const l = new THREE.PointLight(col.getHex(), 3, 6, 1.5); l.position.set(0, 1.6, 0.6); B.add(l);
            height = 2.5; break;
        }
        case 'serpent': {
            const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(Math.sin(t * 6) * 0.6, 0.25 + t * t * 1.6, -1.2 + t * 1.6)); }
            mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.22, 8), body, 0, 0, 0);
            const head = new THREE.Group(); head.position.copy(pts[10]).add(new THREE.Vector3(0, 0.1, 0.15)); B.add(head); parts.head = head;
            mesh(new THREE.BoxGeometry(0.42, 0.25, 0.6), bodyL, 0, 0, 0, head);
            mesh(new THREE.ConeGeometry(0.03, 0.2, 3), std(0xffffff), 0.1, -0.15, 0.25, head).rotation.x = Math.PI;
            mesh(new THREE.ConeGeometry(0.03, 0.2, 3), std(0xffffff), -0.1, -0.15, 0.25, head).rotation.x = Math.PI;
            eyes(head, 0.15, 0.1, 0.18, 0.05);
            height = 2.3; break;
        }
        case 'plant': {
            mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.4, 7), bodyD, 0, 0.7, 0);
            parts.vines = [];
            for (let i = 0; i < 5; i++) {
                const v = new THREE.Group(); v.position.set(0, 1.0, 0); v.rotation.y = i * 1.25; B.add(v);
                const seg = mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.3, 5), body, 0, 0.6, 0, v); seg.rotation.z = 0.9; seg.position.x = 0.5;
                parts.vines.push(v);
            }
            const head = new THREE.Group(); head.position.set(0, 1.75, 0.1); B.add(head); parts.head = head;
            for (let i = 0; i < 6; i++) { const p = mesh(new THREE.SphereGeometry(0.28, 6, 4), std(c.color === 0x5b8a3c ? 0xd04a6a : light), 0, 0, 0, head); p.position.set(Math.cos(i) * 0.3, Math.sin(i) * 0.3, 0); p.scale.set(1, 1, 0.3); }
            mesh(new THREE.SphereGeometry(0.2, 8, 6), std(0x200808), 0, 0, 0.08, head);
            eyes(head, 0.08, 0.06, 0.24, 0.05);
            height = 2.1; break;
        }
        case 'dragon': {
            const sc = 1;
            mesh(new THREE.SphereGeometry(2.2, 12, 10), body, 0, 1.5, -3).scale.set(1.3, 0.9, 1.6);
            const neckPts = [new THREE.Vector3(0, 2.2, -1.5), new THREE.Vector3(0, 3.6, -0.2), new THREE.Vector3(0, 4.8, 0.4), new THREE.Vector3(0, 5.4, 1.2)];
            mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(neckPts), 20, 0.75, 10), body, 0, 0, 0);
            const head = new THREE.Group(); head.position.set(0, 5.5, 1.6); B.add(head); parts.head = head;
            mesh(new THREE.BoxGeometry(1.4, 1.0, 1.8), body, 0, 0, 0, head);
            mesh(new THREE.BoxGeometry(1.0, 0.55, 1.4), bodyL, 0, -0.3, 1.2, head);
            const jaw = mesh(new THREE.BoxGeometry(0.95, 0.25, 1.4), bodyD, 0, -0.65, 1.0, head); parts.jaw = jaw;
            for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.16, 1.4, 5), std(0xd8d0b0), s * 0.45, 0.8, -0.6, head); h.rotation.x = -0.9; h.rotation.z = s * -0.3; }
            for (let i = 0; i < 6; i++) mesh(new THREE.ConeGeometry(0.2, 0.6, 4), bodyD, 0, 2.6 + i * 0.5, -1.2 + i * 0.45).rotation.x = -0.4;
            eyes(head, 0.42, 0.25, 0.75, 0.14);
            parts.wings = [];
            for (const s of [-1, 1]) {
                const w = new THREE.Group(); w.position.set(s * 1.6, 3, -2.5); B.add(w);
                const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(s * 5, 2.5); shp.lineTo(s * 4.5, 0.2); shp.lineTo(s * 3.6, -0.6); shp.lineTo(s * 2.4, -0.4); shp.lineTo(s * 1.4, -1.0); shp.closePath();
                const wm = new THREE.Mesh(new THREE.ShapeGeometry(shp), std(dark, { side: THREE.DoubleSide, transparent: true, opacity: 0.92 })); wm.rotation.y = s * 0.5; w.add(wm);
                parts.wings.push({ w, s });
            }
            for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.8, 6), bodyD, s * 1.4, 0.6, -1.4);
            const l = new THREE.PointLight(0x40ff90, 30, 14, 1.5); l.position.set(0, 5, 3.5); B.add(l); parts.mouthLight = l;
            g.scale.setScalar(sc);
            height = 6.6; break;
        }
        case 'brute': case 'humanoid': case 'master': case 'rival': default: {
            const big = c.kind === 'brute';
            const s = big ? 1.35 : 1;
            const torsoMat = c.kind === 'master' ? std(0x2a3a4a) : c.kind === 'rival' ? std(new THREE.Color().setHSL(rnd(), 0.4, 0.35)) : body;
            mesh(new THREE.CylinderGeometry(0.32 * s, 0.26 * s, 0.85 * s, 7), torsoMat, 0, 1.2 * s, 0);
            if (c.kind === 'master') { const cape = mesh(new THREE.ConeGeometry(0.5, 1.5, 8, 1, true), std(0x8a1a1a, { side: THREE.DoubleSide }), 0, 1.0, -0.12); cape.scale.z = 0.5; mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 12), std(0xd8b040, { metalness: 0.8, roughness: 0.3 }), 0, 1.6, 0).rotation.x = Math.PI / 2; }
            const head = new THREE.Group(); head.position.set(0, (1.82 + (big ? 0.1 : 0)) * s, big ? 0.15 : 0); B.add(head); parts.head = head;
            mesh(new THREE.SphereGeometry(0.22 * s, 10, 8), c.kind === 'master' || c.kind === 'rival' ? std(0xd8a880) : bodyL, 0, 0, 0, head);
            if (c.kind === 'rival' || rnd() < 0.3) mesh(new THREE.SphereGeometry(0.25 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(0x6a6a70, { metalness: 0.7, roughness: 0.35 }), 0, 0.03, 0, head);
            eyes(head, 0.08 * s, 0.03, 0.19 * s, 0.04 * s);
            for (const sx of [-1, 1]) { const leg = mesh(new THREE.CylinderGeometry(0.1 * s, 0.08 * s, 0.8 * s, 6), bodyD, sx * 0.14 * s, 0.4 * s, 0); leg.castShadow = true; }
            parts.arm = new THREE.Group(); parts.arm.position.set(0.42 * s, 1.5 * s, 0); B.add(parts.arm);
            mesh(new THREE.CylinderGeometry(0.08 * s * (big ? 1.5 : 1), 0.07 * s, 0.75 * s, 6), torsoMat, 0, -0.35 * s, 0, parts.arm);
            const wpn = mesh(new THREE.BoxGeometry(0.06, big ? 0.9 : 1.1, 0.06), std(big ? 0x5a3a20 : 0xc8ccd0, { metalness: big ? 0 : 0.8, roughness: 0.35 }), 0, -0.6 * s, 0.4, parts.arm);
            wpn.rotation.x = Math.PI / 2.2;
            if (big) mesh(new THREE.SphereGeometry(0.22, 6, 5), std(0x4a3a2a), 0, -0.62 * s, 0.85, parts.arm);
            const l2 = new THREE.Group(); l2.position.set(-0.42 * s, 1.5 * s, 0); B.add(l2);
            mesh(new THREE.CylinderGeometry(0.08 * s * (big ? 1.5 : 1), 0.07 * s, 0.75 * s, 6), torsoMat, 0, -0.35 * s, 0, l2); l2.rotation.z = -0.2;
            height = 2.1 * s; break;
        }
    }
    // size by level
    const lvl = c.level || 1;
    const k = c.kind === 'dragon' ? 1 : 1.0 + Math.min(lvl, 16) * 0.03;
    g.scale.multiplyScalar(k);
    g.userData = { parts, height: height * k, kind: c.kind };
    g.traverse((o) => { if (o.material) o.userData.baseEmissive = o.material.emissive ? o.material.emissive.clone() : null; });
    return g;
}
