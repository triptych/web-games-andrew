// Every block of the castle, drawn as one InstancedMesh per material: a unit cube scaled to the
// block's size. The material samples its fal texture in the block's own frame (so the texture
// tumbles with the block and keeps the same density on a brick and a beam) and darkens the edges,
// which is what makes a wall read as a heap of toy blocks instead of one surface.

import * as THREE from 'three';

const MAX = 760;

// per material: texture, tint, texels per metre, how dark the edges get, a glow
const LOOK = {
    stone: { tex: 'stone', color: 0xf3eadb, scale: 0.55, edge: 0.55, rough: 0.9 },
    brick: { tex: 'brick', color: 0xffffff, scale: 0.55, edge: 0.55, rough: 0.85 },
    wood:  { tex: 'wood',  color: 0xffffff, scale: 0.45, edge: 0.5,  rough: 0.8 },
    ice:   { tex: 'ice',   color: 0xdff6ff, scale: 0.5,  edge: 0.75, rough: 0.25, emissive: 0x1d5a78, metal: 0.1 },
    roof:  { tex: 'roof',  color: 0xffffff, scale: 0.9,  edge: 0.6,  rough: 0.75 },
    tnt:   { tex: 'tnt',   color: 0xffffff, scale: 1,    edge: 0.7,  rough: 0.7, faceUV: true },
    rock:  { tex: 'stone', color: 0xb9b0a3, scale: 0.25, edge: 0.85, rough: 1 },
};

export function makeBlockMaterial(tex, look) {
    const m = new THREE.MeshStandardMaterial({
        color: look.color, map: tex, roughness: look.rough, metalness: look.metal || 0,
        emissive: look.emissive || 0x000000, emissiveIntensity: look.emissive ? 0.35 : 0,
    });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.kkScale = { value: look.scale };
        sh.uniforms.kkEdge = { value: look.edge };
        sh.uniforms.kkFace = { value: look.faceUV ? 1 : 0 };
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
                attribute float aSeed;
                varying vec3 vBoxPos; varying vec3 vBoxN; varying vec3 vBoxHalf; varying float vSeed;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vec3 kkS = vec3(1.0);
                #ifdef USE_INSTANCING
                kkS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
                vSeed = aSeed;
                #else
                vSeed = 0.0;
                #endif
                vBoxPos = position * kkS; vBoxN = normal; vBoxHalf = kkS * 0.5;`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
                uniform float kkScale; uniform float kkEdge; uniform float kkFace;
                varying vec3 vBoxPos; varying vec3 vBoxN; varying vec3 vBoxHalf; varying float vSeed;`)
            .replace('#include <map_fragment>', `
                vec3 an = abs(vBoxN);
                vec2 kp; vec2 kh;
                if (an.x > an.y && an.x > an.z) { kp = vBoxPos.zy; kh = vBoxHalf.zy; }
                else if (an.y > an.z) { kp = vBoxPos.xz; kh = vBoxHalf.xz; }
                else { kp = vBoxPos.xy; kh = vBoxHalf.xy; }
                vec2 kuv = kkFace > 0.5 ? (kp / max(kh, vec2(1e-3))) * 0.5 + 0.5
                                        : kp * kkScale + vec2(fract(vSeed * 0.618), fract(vSeed * 0.381));
                vec4 kTex = texture2D(map, kuv);
                diffuseColor *= kTex;
                // toy-block edges: darker in a thin band along every edge of the face
                vec2 ke = kh - abs(kp);
                float kd = min(ke.x, ke.y);
                float kEdge = mix(kkEdge, 1.0, smoothstep(0.0, 0.045, kd));
                float kLip = 1.0 + 0.12 * (1.0 - smoothstep(0.045, 0.09, kd)) * smoothstep(0.0, 0.045, kd);
                diffuseColor.rgb *= kEdge * kLip;
            `);
    };
    return m;
}

export class Blocks {
    constructor(scene, textures) {
        this.meshes = {};
        const geo = new THREE.BoxGeometry(1, 1, 1);
        geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1));
        for (const [mat, look] of Object.entries(LOOK)) {
            const g = geo.clone();
            const seeds = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
            seeds.setUsage(THREE.DynamicDrawUsage);
            g.setAttribute('aSeed', seeds);
            const mesh = new THREE.InstancedMesh(g, makeBlockMaterial(textures[look.tex], look), MAX);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.count = 0;
            mesh.frustumCulled = false;
            scene.add(mesh);
            this.meshes[mat] = mesh;
        }
        // roof cones ride on the roof blocks
        const cone = new THREE.ConeGeometry(1, 1, 12, 1);
        cone.translate(0, 0.5, 0);
        this.cones = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0xffffff, map: textures.roofCone, roughness: 0.7 }), 64);
        this.cones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.cones.castShadow = true;
        this.cones.count = 0;
        this.cones.frustumCulled = false;
        scene.add(this.cones);
        this.coneTints = [0xff9fc2, 0x8fc8ff, 0xc9a7ff, 0xffc07a];
        this.cones.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
        this.m = new THREE.Matrix4();
        this.q = new THREE.Quaternion();
        this.v = new THREE.Vector3();
        this.s = new THREE.Vector3();
        this.c = new THREE.Color();
    }

    update(G) {
        const counts = {};
        for (const k in this.meshes) counts[k] = 0;
        let nc = 0;
        for (const b of G.W.bodies) {
            if (b.kind !== 'block' && b.kind !== 'rock') continue;
            const mesh = this.meshes[b.mat];
            if (!mesh) continue;
            const i = counts[b.mat]++;
            if (i >= MAX) continue;
            this.q.set(b.q[0], b.q[1], b.q[2], b.q[3]);
            this.v.set(b.p[0], b.p[1], b.p[2]);
            this.s.set(b.h[0] * 2, b.h[1] * 2, b.h[2] * 2);
            this.m.compose(this.v, this.q, this.s);
            mesh.setMatrixAt(i, this.m);
            mesh.geometry.attributes.aSeed.array[i] = (b.s0 ? b.s0[0] * 3.1 + b.s0[1] * 7.7 + b.s0[2] * 1.3 : b.id * 0.37);
            if (b.look === 'cone' && nc < 64) {
                // the cone stands on the top face of its block, in the block's frame
                const up = this.s.set(0, b.h[1], 0).applyQuaternion(this.q);
                this.v.add(up);
                const r = Math.max(b.h[0], b.h[2]) * 1.25;
                this.s.set(r, b.coneH || 1.6, r);
                this.m.compose(this.v, this.q, this.s);
                this.cones.setMatrixAt(nc, this.m);
                this.c.setHex(this.coneTints[Math.abs(Math.round(b.s0[0] * 3 + b.s0[2])) % this.coneTints.length]);
                this.cones.setColorAt(nc, this.c);
                nc++;
            }
        }
        for (const k in this.meshes) {
            const mesh = this.meshes[k];
            mesh.count = Math.min(MAX, counts[k]);
            mesh.instanceMatrix.needsUpdate = true;
            mesh.geometry.attributes.aSeed.needsUpdate = true;
        }
        this.cones.count = nc;
        this.cones.instanceMatrix.needsUpdate = true;
        if (this.cones.instanceColor) this.cones.instanceColor.needsUpdate = true;
    }
}
