// The tokens on the board as the player sees them: four instanced gem cuts with a jewel shader,
// oath seals under the stones that swear something other than Kinship, rubble, ice, and the hero
// figures standing on their pedestal gems. The view's animations move these; this file draws them.

import * as THREE from 'three';
import { COLORS, OATHS, HERO, RARITY } from '../sim/data.js';
import { gemGeometries, rubbleGeometry, heroFigure } from './models.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cellPos } from './stage.js';

export const SEAL_ORDER = ['hue', 'form', 'twin', 'prism', 'motley', 'host', 'chain', 'cross', 'ring', 'vigil', 'wild'];
const SEAL_TINT = {
    hue: '#ffffff', form: '#cfe6ff', twin: '#ffd76a', prism: '#ffffff', motley: '#ff9ad8', host: '#ff7a5a',
    chain: '#ffb04a', cross: '#ffffff', ring: '#9dffb0', vigil: '#c9b8ff', wild: '#ffffff',
};

/** One canvas atlas, 4 × 3 seals: a ring, the oath's glyph at the near (camera) edge. */
function sealAtlas() {
    const S = 512, cs = S / 4, cv = document.createElement('canvas');
    cv.width = S; cv.height = cs * 3;
    const g = cv.getContext('2d');
    SEAL_ORDER.forEach((o, k) => {
        const cx = (k % 4) * cs + cs / 2, cy = Math.floor(k / 4) * cs + cs / 2, r = cs * 0.43;
        g.save();
        g.translate(cx, cy);
        if (o === 'prism' || o === 'wild') {
            for (let a = 0; a < 48; a++) {
                g.strokeStyle = `hsl(${a * 7.5}, 90%, 70%)`;
                g.lineWidth = 5;
                g.beginPath(); g.arc(0, 0, r, (a / 48) * Math.PI * 2, ((a + 1.2) / 48) * Math.PI * 2); g.stroke();
            }
        } else {
            g.strokeStyle = SEAL_TINT[o]; g.lineWidth = 5;
            g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
        }
        g.globalAlpha = 0.55; g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, r * 0.84, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
        for (let t = 0; t < 12; t++) {
            const a = (t / 12) * Math.PI * 2;
            g.fillStyle = SEAL_TINT[o];
            g.fillRect(Math.cos(a) * r * 0.92 - 1.5, Math.sin(a) * r * 0.92 - 1.5, 3, 3);
        }
        // glyph on a dark disc at the near edge (canvas bottom = toward the camera)
        g.fillStyle = 'rgba(10,6,20,0.85)';
        g.beginPath(); g.arc(0, r * 0.78, cs * 0.17, 0, Math.PI * 2); g.fill();
        g.strokeStyle = SEAL_TINT[o]; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = SEAL_TINT[o];
        g.font = `bold ${Math.round(cs * 0.2)}px "Segoe UI Symbol", "Noto Sans Symbols", system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(OATHS[o].icon, 0, r * 0.79);
        g.restore();
    });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

/** The jewel shader: physical gem plus an inner glow, a fresnel rim and per-instance effects. */
function gemMaterial(envMap) {
    const m = new THREE.MeshPhysicalMaterial({
        roughness: 0.16, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.08, ior: 1.6, specularIntensity: 0.7,
        flatShading: true, envMap, envMapIntensity: 0.85,
    });
    m.userData.time = { value: 0 };
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = m.userData.time;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec4 aFx;\nvarying vec4 vFx;\nvarying vec3 vLocal;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx = aFx;\nvLocal = position;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec4 vFx;\nvarying vec3 vLocal;')
            .replace('#include <color_fragment>', `#include <color_fragment>
              if (vFx.z > 0.5) { // a Fool stone: pearly white with a drifting rainbow
                float hh = fract(vLocal.x * 1.3 + vLocal.z * 0.9 + vLocal.y * 2.0 + uTime * 0.25);
                vec3 rb = clamp(abs(mod(hh * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                diffuseColor.rgb = mix(vec3(0.95), rb, 0.45);
              }
              diffuseColor.rgb *= 1.0 - vFx.w * 0.6;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
              {
                vec3 vd = normalize(vViewPosition);
                float fr = pow(clamp(1.0 - abs(dot(normal, vd)), 0.0, 1.0), 2.5);
                float core = clamp(1.0 - length(vLocal.xz) * 2.2, 0.0, 1.0);
                vec3 base = diffuseColor.rgb;
                totalEmissiveRadiance += base * base * (0.18 + core * 0.35 + fr * 0.5) * (1.0 - vFx.w * 0.7);
                totalEmissiveRadiance += base * vFx.x * 1.6 + vec3(vFx.y * 2.2);
              }`);
    };
    return m;
}

function sealMaterial(atlas) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uMap: { value: atlas }, uTime: { value: 0 } },
        vertexShader: `attribute vec2 aSeal; varying vec2 vUv; varying float vA; varying vec3 vC;
          void main(){
            float k = aSeal.x; vec2 cell = vec2(mod(k, 4.0), 2.0 - floor(k / 4.0));
            vUv = (cell + uv) / vec2(4.0, 3.0); vA = aSeal.y;
            #ifdef USE_INSTANCING_COLOR
              vC = instanceColor;
            #else
              vC = vec3(1.0);
            #endif
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vA; varying vec3 vC;
          void main(){ vec4 t = texture2D(uMap, vUv); float a = t.a * vA; gl_FragColor = vec4(t.rgb * vC * a * 1.25, a); }`,
    });
}

/** A billboard label (a Vigil's wake count). */
function labelSprite() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(0.6, 0.3, 1);
    sp.renderOrder = 10;
    sp.userData.draw = (text) => {
        const g = cv.getContext('2d');
        g.clearRect(0, 0, 128, 64);
        g.fillStyle = 'rgba(20,12,40,0.85)';
        g.beginPath(); g.roundRect(14, 8, 100, 48, 24); g.fill();
        g.strokeStyle = '#c9b8ff'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#efe8ff'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, 64, 33);
        tex.needsUpdate = true;
    };
    return sp;
}

export class Tokens {
    constructor(stage) {
        this.stage = stage;
        const scene = this.scene = stage.scene;
        const CAP = 64;
        this.gemMat = gemMaterial(stage.env);
        this.gems = gemGeometries().map((geo) => {
            geo.setAttribute('aFx', new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage));
            const m = new THREE.InstancedMesh(geo, this.gemMat, CAP);
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            m.setColorAt(0, new THREE.Color());
            m.castShadow = true;
            m.frustumCulled = false;
            m.count = 0;
            scene.add(m);
            return m;
        });
        this.rubble = new THREE.InstancedMesh(rubbleGeometry(), new THREE.MeshStandardMaterial({ color: 0x77706e, roughness: 0.95, flatShading: true }), CAP);
        this.rubble.castShadow = true;
        this.rubble.frustumCulled = false;
        this.rubble.count = 0;
        scene.add(this.rubble);
        this.ice = new THREE.InstancedMesh(new RoundedBoxGeometry(0.86, 0.62, 0.86, 2, 0.1),
            new THREE.MeshPhysicalMaterial({ color: 0xcfeeff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.42, envMap: stage.env, envMapIntensity: 2, clearcoat: 1, emissive: 0x2a6a9a, emissiveIntensity: 0.4, depthWrite: false }), CAP);
        this.ice.frustumCulled = false;
        this.ice.count = 0;
        this.ice.renderOrder = 3;
        scene.add(this.ice);
        const sealGeo = new THREE.PlaneGeometry(0.96, 0.96);
        sealGeo.rotateX(-Math.PI / 2);
        sealGeo.setAttribute('aSeal', new THREE.InstancedBufferAttribute(new Float32Array(CAP * 2), 2).setUsage(THREE.DynamicDrawUsage));
        this.seals = new THREE.InstancedMesh(sealGeo, sealMaterial(sealAtlas()), CAP);
        this.seals.setColorAt(0, new THREE.Color());
        this.seals.frustumCulled = false;
        this.seals.count = 0;
        this.seals.renderOrder = 2;
        scene.add(this.seals);

        this.vts = new Map();        // id → visual token
        this.figures = new Map();    // id → hero figure group
        this.o = new THREE.Object3D();
        this.c = new THREE.Color();
        this.v = new THREE.Vector3();
        this.hidden = false;
    }

    clear() {
        for (const id of [...this.vts.keys()]) this.remove(id);
    }

    /** Make (or reset) the visual for token tok at cell i. */
    add(tok, i, extra = {}) {
        const vt = {
            id: tok.id, tok: { ...tok }, i,
            p: cellPos(i % 7, (i / 7) | 0), lift: 0, sc: 1, glow: 0, flash: 0, rot: 0, tilt: 0, dim: 0, morph: 1,
            seed: Math.random() * 100, ...extra,
        };
        this.vts.set(tok.id, vt);
        if (tok.h) this.figureFor(vt);
        return vt;
    }

    figureFor(vt) {
        if (this.figures.has(vt.id)) return this.figures.get(vt.id);
        const h = HERO[vt.tok.h];
        const fig = heroFigure(h);
        fig.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        if (h.oath === 'vigil') {
            const lab = labelSprite();
            lab.position.set(0, 1.25, 0);
            fig.add(lab);
            fig.userData.label = lab;
            fig.userData.wake = -1;
        }
        this.scene.add(fig);
        this.figures.set(vt.id, fig);
        return fig;
    }

    remove(id) {
        this.vts.delete(id);
        const f = this.figures.get(id);
        if (f) { this.scene.remove(f); this.figures.delete(id); }
    }

    get(id) { return this.vts.get(id); }

    /** Write every instance for this frame. */
    frame(dt, time) {
        this.gemMat.userData.time.value = time;
        this.seals.material.uniforms.uTime.value = time;
        const n = [0, 0, 0, 0];
        let nr = 0, ni = 0, ns = 0;
        const o = this.o, c = this.c;
        for (const vt of this.vts.values()) {
            if (this.hidden || vt.sc <= 0.001) continue;
            const t = vt.tok;
            const bob = Math.sin(time * 1.6 + vt.seed) * 0.025;
            const px = vt.p.x, pz = vt.p.z, py = vt.lift + bob;
            if (t.rb) {
                o.position.set(px, py, pz);
                o.rotation.set(0, vt.seed, 0);
                o.scale.setScalar(vt.sc);
                o.updateMatrix();
                this.rubble.setMatrixAt(nr++, o.matrix);
                continue;
            }
            const hero = !!t.h;
            const mesh = this.gems[t.s];
            const k = n[t.s]++;
            o.position.set(px, py, pz);
            o.rotation.set(vt.tilt, vt.rot + (t.o === 'wild' ? time * 0.6 : 0), 0);
            const ms = vt.sc * vt.morph;
            if (hero) o.scale.set(ms * 1.08, ms * 0.5, ms * 1.08); else o.scale.setScalar(ms);
            o.updateMatrix();
            mesh.setMatrixAt(k, o.matrix);
            c.set(COLORS[t.c]?.hex ?? 0xffffff);
            mesh.setColorAt(k, c);
            mesh.geometry.attributes.aFx.setXYZW(k, vt.glow, vt.flash, t.o === 'wild' ? 1 : 0, vt.dim);
            if (t.fz) {
                o.position.set(px, py + 0.3, pz);
                o.rotation.set(0, 0, 0);
                o.scale.setScalar(vt.sc);
                o.updateMatrix();
                this.ice.setMatrixAt(ni++, o.matrix);
            }
            if (t.o !== 'hue' || hero) {
                o.position.set(px, 0.015, pz);
                o.rotation.set(0, 0, 0);
                o.scale.setScalar(vt.sc * (hero ? 1.02 : 0.92));
                o.updateMatrix();
                this.seals.setMatrixAt(ns, o.matrix);
                this.seals.geometry.attributes.aSeal.setXY(ns, SEAL_ORDER.indexOf(t.o), Math.min(1, vt.sc) * (hero ? 1 : 0.85));
                this.seals.setColorAt(ns, c.set(hero ? RARITY[HERO[t.h].r].css : '#ffffff'));
                ns++;
            }
            if (hero) this.poseFigure(vt, time, px, py, pz);
        }
        for (const [s, m] of this.gems.entries()) {
            m.count = n[s];
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
            m.geometry.attributes.aFx.needsUpdate = true;
        }
        this.rubble.count = nr; this.rubble.instanceMatrix.needsUpdate = true;
        this.ice.count = ni; this.ice.instanceMatrix.needsUpdate = true;
        this.seals.count = ns; this.seals.instanceMatrix.needsUpdate = true;
        if (this.seals.instanceColor) this.seals.instanceColor.needsUpdate = true;
        this.seals.geometry.attributes.aSeal.needsUpdate = true;
        for (const [id, f] of this.figures) if (!this.vts.has(id)) { this.scene.remove(f); this.figures.delete(id); }
    }

    poseFigure(vt, time, px, py, pz) {
        const f = this.figures.get(vt.id);
        if (!f) return;
        f.visible = !this.hidden && vt.sc > 0.02;
        f.position.set(px, py + 0.2 * vt.sc + (vt.figLift || 0), pz);
        f.scale.setScalar(vt.sc * 0.92);
        const ud = f.userData;
        const t = vt.tok;
        const asleep = t.o === 'vigil';
        if (ud.body) {
            ud.body.position.y = asleep ? 0 : Math.abs(Math.sin(time * 2.4 + vt.seed)) * 0.03;
            ud.body.rotation.z = asleep ? 0.12 * Math.sin(time * 0.8 + vt.seed) : Math.sin(time * 1.2 + vt.seed) * 0.04;
            ud.body.rotation.y = Math.sin(time * 0.7 + vt.seed) * 0.25 + (vt.spin || 0);
        }
        if (ud.head) ud.head.rotation.x = asleep ? 0.35 + Math.sin(time * 1.1 + vt.seed) * 0.06 : Math.sin(time * 1.7 + vt.seed) * 0.05;
        if (ud.aura) { ud.aura.rotation.z = time; ud.aura.scale.setScalar(1 + Math.sin(time * 3) * 0.05); }
        if (ud.label) {
            if (ud.wake !== t.wake) { ud.wake = t.wake; ud.label.userData.draw(`☾ ${t.wake}`); }
            ud.label.visible = t.wake > 0;
        }
    }
}
