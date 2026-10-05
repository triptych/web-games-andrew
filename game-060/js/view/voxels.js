// Voxel pixels. Every sprite pixel, brick and cell in the game is one instance of a
// unit box in a single InstancedMesh. The shader shades faces by direction and, on
// any box at least 3 px across, adds a 1 px bevel (light top-left, dark bottom-right)
// so a brick reads as a brick while single pixels stay flat.

import * as THREE from 'three';

const VS = `
varying vec3 vColor; varying vec3 vN; varying vec2 vUv; varying vec2 vSize;
void main(){
  vSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  vN = normalize(mat3(instanceMatrix) * normal);
  vUv = uv;
  vColor = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const FS = `
varying vec3 vColor; varying vec3 vN; varying vec2 vUv; varying vec2 vSize;
uniform float uBevel;
void main(){
  vec3 n = vN;
  float shade = n.z > 0.6 ? 1.0 : (n.y > 0.6 ? 1.3 : (n.y < -0.6 ? 0.45 : (n.x < -0.6 ? 0.85 : (n.x > 0.6 ? 0.6 : 0.7))));
  vec3 c = vColor * shade;
  if (uBevel > 0.5 && n.z > 0.6 && vSize.x > 2.5 && vSize.y > 2.5) {
    vec2 p = vUv * vSize;
    if (p.y > vSize.y - 1.0 || p.x < 1.0) c *= 1.32;
    else if (p.y < 1.0 || p.x > vSize.x - 1.0) c *= 0.58;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export function voxelMaterial(bevel = true) {
    return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uBevel: { value: bevel ? 1 : 0 } } });
}

/** Axis-aligned boxes rebuilt every frame by writing straight into the instance arrays. */
export class VoxelBatch {
    constructor(scene, capacity, bevel = true) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        this.mesh = new THREE.InstancedMesh(geo, voxelMaterial(bevel), capacity);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        this.cap = capacity;
        this.m = this.mesh.instanceMatrix.array;
        this.c = this.mesh.instanceColor.array;
        this.n = 0;
        scene.add(this.mesh);
        // identity skeleton so only translation/scale need writing
        for (let i = 0; i < capacity; i++) { this.m[i * 16 + 15] = 1; }
    }

    begin() { this.n = 0; }

    /** Box with bottom-left-front corner at (x, y) in pixels; z is the box centre. */
    box(x, y, w, h, r, g, b, z = 0, d = 1) {
        if (this.n >= this.cap) return;
        const i = this.n++, o = i * 16, m = this.m;
        m[o] = w; m[o + 1] = 0; m[o + 2] = 0;
        m[o + 4] = 0; m[o + 5] = h; m[o + 6] = 0;
        m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = d;
        m[o + 12] = x + w / 2; m[o + 13] = y + h / 2; m[o + 14] = z;
        const c = this.c, k = i * 3;
        c[k] = r; c[k + 1] = g; c[k + 2] = b;
    }

    px(x, y, rgb, z = 0, mul = 1) { this.box(x, y, 1, 1, rgb[0] * mul, rgb[1] * mul, rgb[2] * mul, z); }

    end() {
        this.mesh.count = this.n;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
        if (this.n) {
            this.mesh.instanceMatrix.addUpdateRange(0, this.n * 16);
            this.mesh.instanceColor.addUpdateRange(0, this.n * 3);
        }
    }
}

/** Rotating cubes: debris and sparks. */
export class DebrisBatch {
    constructor(scene, capacity) {
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), voxelMaterial(false), capacity);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        this.mesh.renderOrder = 5;
        this.cap = capacity;
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
        this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
        this.n = 0;
        scene.add(this.mesh);
    }
    begin() { this.n = 0; }
    cube(x, y, z, s, rx, ry, rz, r, g, b) {
        if (this.n >= this.cap) return;
        this._e.set(rx, ry, rz);
        this._q.setFromEuler(this._e);
        this._p.set(x, y, z); this._s.set(s, s, s);
        this._m.compose(this._p, this._q, this._s);
        this.mesh.setMatrixAt(this.n, this._m);
        const c = this.mesh.instanceColor.array, k = this.n * 3;
        c[k] = r; c[k + 1] = g; c[k + 2] = b;
        this.n++;
    }
    end() {
        this.mesh.count = this.n;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
    }
}
