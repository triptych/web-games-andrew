// The rock and its maze. The ground is a dense sphere whose MeshStandardMaterial is patched to
// read a regolith baked once per asteroid into a cube map (three scales of analytic craters
// bumping the normal, fbm albedo), plus live grit, a landing pad, the lamp and the gate's glow. The walls are one merged mesh of
// curved, sphere-hugging slabs (white station panels with seams and a lit top strip), and the
// corners get instanced posts with a small red marker light.

import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { WALL } from '../config.js';

/**
 * Bake the regolith once per asteroid: a cube camera at the centre looks out at an inside-out
 * sphere whose shader evaluates two scales of analytic craters and fbm albedo, writing the bumped
 * object-space normal into rgb and the albedo into alpha. The ground then costs one cube lookup a
 * pixel instead of sixteen crater cells and a stack of noise (5× faster under SwiftShader).
 */
export function bakeRegolith(renderer, W, quality) {
    const size = quality > 1 ? 1024 : quality > 0 ? 768 : 512;
    const rt = new THREE.WebGLCubeRenderTarget(size, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    const scene = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { uR: { value: W.R } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float uR; varying vec3 vP;
${NOISE}
void main(){
  vec3 P = normalize(vP);
  vec4 big = craters(P * uR * 0.3, 0.6);
  vec4 small = craters(P * uR * 1.0 + 11.0, 0.5);
  vec4 tiny = craters(P * uR * 2.6 + 5.0, 0.35);
  float h = (big.x + small.x * 0.35 + tiny.x * 0.12) * 2.0;
  vec3 grad = big.yzw * 0.3 * 1.6 + small.yzw * 0.5 + tiny.yzw * 0.25;
  vec3 n = normalize(P - (grad - P * dot(P, grad)) * 0.9);
  float n1 = fbm3(P * uR * 0.35, 5);
  float a = mix(0.33, 0.5, n1);
  a = mix(a, 0.25, smoothstep(0.05, -0.25, h));      // crater floors are darker
  a += 0.08 * smoothstep(0.05, 0.12, h);             // fresh bright rims
  a *= 0.9 + 0.2 * vn3(P * uR * 3.0);
  gl_FragColor = vec4(n * 0.5 + 0.5, a);
}`,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat));
    const cam = new THREE.CubeCamera(0.1, 10, rt);
    const prevTone = renderer.toneMapping, prevSpace = renderer.outputColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    cam.update(renderer, scene);
    renderer.toneMapping = prevTone; renderer.outputColorSpace = prevSpace;
    mat.dispose();
    scene.children[0].geometry.dispose();
    return rt;
}

export function makeGround(W, quality, uniforms, bake) {
    const detail = quality > 1 ? 96 : quality > 0 ? 64 : 40;
    const geo = new THREE.SphereGeometry(W.R, detail * 2, detail);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.0 });
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uniforms, { uBake: { value: bake.texture } });
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
varying vec3 vObj;
uniform float uR, uExitOpen, uTime, uLampOn;
uniform vec3 uStart, uExit, uLamp;
uniform samplerCube uBake;
float vnq(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  vec3 p = fract(i * 0.1031); p += dot(p, p.yzx + 33.33); float a = fract((p.x + p.y) * p.z);
  vec3 q = fract((i + vec3(1.0)) * 0.1031); q += dot(q, q.yzx + 33.33); float b = fract((q.x + q.y) * q.z);
  return mix(a, b, (f.x + f.y + f.z) / 3.0); }
vec4 gBake;`)
            .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 P = normalize(vObj);
  gBake = textureCube(uBake, P);
  float a = gBake.a * (0.92 + 0.16 * vnq(P * uR * 9.0));          // fine grit close up
  vec3 base = a * vec3(1.02, 0.97, 0.9);
  // the landing pad at the start: concentric survey rings and four spokes
  float ds = length(P - uStart) * uR;                // chord ≈ arc this close; no acos (SwiftShader is slow at it)
  float ring = smoothstep(0.09, 0.0, abs(ds - 1.6)) + smoothstep(0.06, 0.0, abs(ds - 1.0)) * 0.6;
  vec3 ax = normalize(cross(uStart, abs(uStart.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 ay = cross(uStart, ax);
  float sx = dot(P, ax), sy = dot(P, ay);
  float spokes = smoothstep(0.96, 1.0, abs(sx * sx - sy * sy) / max(1e-6, sx * sx + sy * sy)) * step(ds, 1.6) * step(1.0, ds);   // |cos 2θ|
  base = mix(base, vec3(0.85, 0.82, 0.74), clamp(ring + spokes * 0.6, 0.0, 1.0) * 0.8);
  diffuseColor.rgb = base;
}`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 nObj = normalize(gBake.rgb * 2.0 - 1.0);
  normal = normalize((viewMatrix * vec4(nObj, 0.0)).xyz);
}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 P = normalize(vObj);
  // the commander's lamp: a soft pool of light around them, so the night side is never blind
  vec3 toL = uLamp + vViewPosition;
  float dl = length(toL);
  float lamp = uLampOn * max(dot(normal, toL / dl), 0.0) * pow(clamp(1.0 - dl / 9.0, 0.0, 1.0), 2.0);
  totalEmissiveRadiance += diffuseColor.rgb * vec3(0.85, 0.9, 1.0) * lamp * 1.3;
  float de = length(P - uExit) * uR;
  totalEmissiveRadiance += vec3(0.55, 0.75, 1.0) * uExitOpen * (exp(-de * 0.9) * 0.9 + smoothstep(0.12, 0.0, abs(de - 2.2 - sin(uTime * 2.0) * 0.15)) * 0.8);
}`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
}

export function makeWalls(W, quality, envMap) {
    const R = W.R, H = WALL.height, half = WALL.half, bottom = R - 0.45;
    const pos = [], nor = [], uv = [], idx = [];
    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const quad = (a, b, c, d, n, ua, ub, va, vb, kind) => {
        const i = pos.length / 3;
        for (const p of [a, b, c, d]) pos.push(p.x, p.y, p.z);
        for (let k = 0; k < 4; k++) nor.push(n[k].x, n[k].y, n[k].z);
        uv.push(ua, va, kind, ub, va, kind, ub, vb, kind, ua, vb, kind);
        idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    };
    for (const w of W.walls) {
        const a = v3(w.a), b = v3(w.b), n = v3(w.n);
        const ang = a.angleTo(b);
        const ext = half / R;
        const M = Math.max(3, Math.ceil((ang * R) / 0.6));
        const pts = [];
        for (let i = 0; i <= M; i++) {
            const t = -ext + ((ang + 2 * ext) * i) / M;
            // rotate a about n by t
            pts.push(a.clone().applyAxisAngle(n, t).normalize());
        }
        const len = (ang + 2 * ext) * R;
        for (let i = 0; i < M; i++) {
            const s0 = pts[i], s1 = pts[i + 1];
            const u0 = (len * i) / M, u1 = (len * (i + 1)) / M;
            const L = (s, r) => s.clone().multiplyScalar(r).addScaledVector(n, -half);
            const Rr = (s, r) => s.clone().multiplyScalar(r).addScaledVector(n, half);
            // the -n side (wound counter-clockwise seen from outside)
            const nm = n.clone().negate();
            quad(L(s1, bottom), L(s0, bottom), L(s0, R + H), L(s1, R + H), [nm, nm, nm, nm], u1, u0, -0.45, H, 0);
            quad(Rr(s0, bottom), Rr(s1, bottom), Rr(s1, R + H), Rr(s0, R + H), [n, n, n, n], u0, u1, -0.45, H, 0);
            quad(L(s0, R + H), Rr(s0, R + H), Rr(s1, R + H), L(s1, R + H), [s0, s0, s1, s1], u0, u0, 0, 1, 1);
        }
        // end caps
        const s0 = pts[0], sM = pts[M];
        const t0 = new THREE.Vector3().crossVectors(n, s0).normalize().negate();
        const tM = new THREE.Vector3().crossVectors(n, sM).normalize();
        const cap = (s, t, flip) => {
            const p = (r, k) => s.clone().multiplyScalar(r).addScaledVector(n, k * half);
            if (flip) quad(p(bottom, -1), p(bottom, 1), p(R + H, 1), p(R + H, -1), [t, t, t, t], 0, 1, -0.45, H, 2);
            else quad(p(bottom, 1), p(bottom, -1), p(R + H, -1), p(R + H, 1), [t, t, t, t], 0, 1, -0.45, H, 2);
        };
        cap(s0, t0, true);
        cap(sM, tM, false);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aWall', new THREE.Float32BufferAttribute(uv, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcfccc5, roughness: 0.5, metalness: 0.05, envMap, envMapIntensity: 0.22 });
    mat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec3 aWall;\nvarying vec3 vWall;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall = aWall;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>\nvarying vec3 vWall;\nfloat wallGlow;`)
            .replace('#include <color_fragment>', `#include <color_fragment>
{
  wallGlow = 0.0;
  float u = vWall.x, v = vWall.y, kind = vWall.z;
  if (kind < 0.5) {
    // panel seams every 1.2 units along, one seam across, a dark plinth at the foot
    float su = abs(fract(u / 1.2 + 0.5) - 0.5) * 1.2;
    float seam = 1.0 - smoothstep(0.012, 0.035, su);
    float sv = 1.0 - smoothstep(0.01, 0.03, abs(v - ${(H * 0.55).toFixed(3)}));
    diffuseColor.rgb *= 1.0 - 0.45 * max(seam, sv);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08), smoothstep(0.18, 0.12, v));
    // the lit strip just under the top edge
    float strip = smoothstep(0.03, 0.0, abs(v - ${(H - 0.12).toFixed(3)}));
    wallGlow = strip;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2), strip);
  } else if (kind < 1.5) {
    diffuseColor.rgb *= 0.82;
  }
}`)
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.75, 0.9, 1.2) * wallGlow * 2.2;');
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = quality > 0;
    mesh.receiveShadow = true;

    // posts at every corner where walls meet
    const corners = new Map();
    for (const w of W.walls) for (const p of [w.a, w.b]) corners.set(p.map((x) => Math.round(x * 1e4)).join(','), p);
    const postGeo = new THREE.CylinderGeometry(half * 1.25, half * 1.35, H + 0.65, 10);
    postGeo.translate(0, (H + 0.65) / 2 - 0.45, 0);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xbdb9b1, roughness: 0.5, metalness: 0.1, envMap, envMapIntensity: 0.2 });
    const posts = new THREE.InstancedMesh(postGeo, postMat, corners.size);
    const lampGeo = new THREE.SphereGeometry(0.09, 10, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.25, 0.15) });
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, corners.size);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const p of corners.values()) {
        const n = new THREE.Vector3(p[0], p[1], p[2]);
        q.setFromUnitVectors(up, n);
        m.compose(n.clone().multiplyScalar(R), q, sc);
        posts.setMatrixAt(i, m);
        m.compose(n.clone().multiplyScalar(R + H + 0.24), q, sc);
        lamps.setMatrixAt(i, m);
        i++;
    }
    posts.castShadow = quality > 0;
    posts.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh, posts, lamps);
    return group;
}
