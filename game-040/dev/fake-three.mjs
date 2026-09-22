/**
 * fake-three.mjs — a strict stand-in for three.js r165, used only by the Node
 * harnesses in this folder.
 *
 * It implements exactly the API surface STARCADET's view layer touches, and it
 * is deliberately *hostile*: any NaN position, undefined colour, disposed
 * material still in the scene graph, or out-of-range instance write throws
 * immediately, with the offending object named. That turns the class of bug
 * that normally shows up as "the screen is black" into a stack trace.
 *
 * It is never loaded by the game — index.html's import map points at the real
 * three.js on unpkg. dev/hooks.mjs swaps this in for `import 'three'` in Node.
 */

export const problems = [];
function fail(msg) {
    const err = new Error(`[fake-three] ${msg}`);
    problems.push(msg);
    throw err;
}
function finite(...vals) {
    for (const v of vals) if (typeof v !== 'number' || !Number.isFinite(v)) return false;
    return true;
}

export class Vector2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    set(x, y) { if (!finite(x, y)) fail(`Vector2.set(${x}, ${y})`); this.x = x; this.y = y; return this; }
    copy(v) { this.x = v.x; this.y = v.y; return this; }
    clone() { return new Vector2(this.x, this.y); }
}

export class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) {
        if (!finite(x, y, z)) fail(`Vector3.set(${x}, ${y}, ${z}) — non-finite position/scale`);
        this.x = x; this.y = y; this.z = z; return this;
    }
    setScalar(s) { return this.set(s, s, s); }
    copy(v) { return this.set(v.x, v.y, v.z); }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
    sub(v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    normalize() { const l = this.length() || 1; return this.set(this.x / l, this.y / l, this.z / l); }
}

export class Euler {
    constructor(x = 0, y = 0, z = 0) { this._x = x; this._y = y; this._z = z; }
    get x() { return this._x; } set x(v) { if (!finite(v)) fail(`Euler.x = ${v}`); this._x = v; }
    get y() { return this._y; } set y(v) { if (!finite(v)) fail(`Euler.y = ${v}`); this._y = v; }
    get z() { return this._z; } set z(v) { if (!finite(v)) fail(`Euler.z = ${v}`); this._z = v; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(e) { return this.set(e.x, e.y, e.z); }
}

export class Quaternion {
    constructor() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; }
    setFromAxisAngle(axis, angle) {
        if (!finite(angle)) fail(`Quaternion.setFromAxisAngle angle=${angle}`);
        const h = angle / 2, s = Math.sin(h);
        this.x = axis.x * s; this.y = axis.y * s; this.z = axis.z * s; this.w = Math.cos(h);
        return this;
    }
    copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
}

export class Matrix4 {
    constructor() { this.elements = new Array(16).fill(0); this.elements[0] = this.elements[5] = this.elements[10] = this.elements[15] = 1; }
    compose(pos, quat, scale) {
        if (!finite(pos.x, pos.y, pos.z)) fail(`Matrix4.compose position (${pos.x}, ${pos.y}, ${pos.z})`);
        if (!finite(scale.x, scale.y, scale.z)) fail(`Matrix4.compose scale (${scale.x}, ${scale.y}, ${scale.z})`);
        if (!finite(quat.x, quat.y, quat.z, quat.w)) fail('Matrix4.compose quaternion non-finite');
        this.elements[12] = pos.x; this.elements[13] = pos.y; this.elements[14] = pos.z;
        this.elements[0] = scale.x; this.elements[5] = scale.y; this.elements[10] = scale.z;
        return this;
    }
    identity() { return this; }
}

export class Color {
    constructor(r, g, b) { this.r = 1; this.g = 1; this.b = 1; if (r !== undefined) this.set(r, g, b); }
    set(r, g, b) {
        if (r === undefined || r === null) fail('Color.set(undefined) — a material colour was never defined');
        if (typeof r === 'number' && g === undefined) {
            if (!Number.isFinite(r)) fail(`Color.set(${r})`);
            this.r = ((r >> 16) & 255) / 255; this.g = ((r >> 8) & 255) / 255; this.b = (r & 255) / 255;
        } else if (typeof r === 'string') {
            if (!/^#?[0-9a-fA-F]{3,8}$/.test(r) && !/^[a-z]+$/i.test(r)) fail(`Color.set("${r}") — not a colour`);
            this.r = this.g = this.b = 0.5;
        } else if (typeof r === 'number') {
            if (!finite(r, g, b)) fail('Color.set(r,g,b) non-finite');
            this.r = r; this.g = g; this.b = b;
        } else if (r instanceof Color) {
            this.r = r.r; this.g = r.g; this.b = r.b;
        } else {
            fail(`Color.set(${typeof r})`);
        }
        return this;
    }
    copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
    clone() { const c = new Color(); return c.copy(this); }
    offsetHSL(h, s, l) { this.r = Math.min(1, this.r + l); this.g = Math.min(1, this.g + l); this.b = Math.min(1, this.b + l); return this; }
    getHex() { return (Math.round(this.r * 255) << 16) | (Math.round(this.g * 255) << 8) | Math.round(this.b * 255); }
}

let objId = 1;
export class Object3D {
    constructor() {
        this.id = objId++;
        this.type = 'Object3D';
        this.position = new Vector3();
        this.rotation = new Euler();
        this.scale = new Vector3(1, 1, 1);
        this.children = [];
        this.parent = null;
        this.visible = true;
        this.renderOrder = 0;
        this.frustumCulled = true;
        this.userData = {};
    }
    add(...objs) {
        for (const o of objs) {
            if (!o) fail('Object3D.add(undefined)');
            if (o.parent) o.parent.remove(o);
            o.parent = this;
            this.children.push(o);
        }
        return this;
    }
    remove(obj) {
        const i = this.children.indexOf(obj);
        if (i >= 0) { this.children.splice(i, 1); obj.parent = null; }
        return this;
    }
    traverse(fn) { fn(this); for (const c of [...this.children]) c.traverse(fn); }
    lookAt(x, y, z) {
        const tx = typeof x === 'object' ? x.x : x;
        const ty = typeof x === 'object' ? x.y : y;
        const tz = typeof x === 'object' ? x.z : z;
        if (!finite(tx, ty, tz)) fail(`Object3D.lookAt(${tx}, ${ty}, ${tz})`);
        return this;
    }
    updateMatrixWorld() { return this; }
    updateWorldMatrix() { return this; }
}

export class Group extends Object3D { constructor() { super(); this.type = 'Group'; } }
export class Scene extends Object3D { constructor() { super(); this.type = 'Scene'; this.background = null; } }

export class PerspectiveCamera extends Object3D {
    constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
        super();
        this.type = 'PerspectiveCamera';
        this.fov = fov; this.aspect = aspect; this.near = near; this.far = far;
        this.projectionUpdates = 0;
    }
    updateProjectionMatrix() {
        if (!finite(this.fov, this.aspect, this.near, this.far)) fail('camera params non-finite');
        if (this.aspect <= 0) fail(`camera.aspect = ${this.aspect}`);
        this.projectionUpdates++;
    }
}

// ------------------------------------------------------------------ geometry

export class BufferAttribute {
    constructor(array, itemSize) {
        if (!array || typeof array.length !== 'number') fail('BufferAttribute without an array');
        this.array = array; this.itemSize = itemSize; this.needsUpdate = false;
        this.count = array.length / itemSize;
    }
}
export class Float32BufferAttribute extends BufferAttribute {
    constructor(array, itemSize) { super(array instanceof Float32Array ? array : new Float32Array(array), itemSize); }
}

export class BufferGeometry {
    constructor(params = {}) {
        this.type = 'BufferGeometry';
        this.attributes = {};
        this.userData = {};
        this.disposed = false;
        this.params = params;
        for (const [k, v] of Object.entries(params)) {
            if (typeof v === 'number' && !Number.isFinite(v)) fail(`${this.constructor.name}: ${k} = ${v}`);
        }
    }
    setAttribute(name, attr) { this.attributes[name] = attr; return this; }
    getAttribute(name) { return this.attributes[name]; }
    dispose() { this.disposed = true; }
}

const geo = (name, keys) => {
    const cls = class extends BufferGeometry {
        constructor(...args) {
            const params = {};
            keys.forEach((k, i) => { if (args[i] !== undefined) params[k] = args[i]; });
            super(params);
            this.type = name;
        }
    };
    Object.defineProperty(cls, 'name', { value: name });
    return cls;
};

export const BoxGeometry = geo('BoxGeometry', ['width', 'height', 'depth']);
export const ConeGeometry = geo('ConeGeometry', ['radius', 'height', 'radialSegments']);
export const CylinderGeometry = geo('CylinderGeometry', ['radiusTop', 'radiusBottom', 'height', 'radialSegments']);
export const SphereGeometry = geo('SphereGeometry', ['radius', 'widthSegments', 'heightSegments']);
export const IcosahedronGeometry = geo('IcosahedronGeometry', ['radius', 'detail']);
export const OctahedronGeometry = geo('OctahedronGeometry', ['radius', 'detail']);
export const TetrahedronGeometry = geo('TetrahedronGeometry', ['radius', 'detail']);
export const TorusGeometry = geo('TorusGeometry', ['radius', 'tube', 'radialSegments', 'tubularSegments', 'arc']);
export const PlaneGeometry = geo('PlaneGeometry', ['width', 'height', 'widthSegments', 'heightSegments']);
export const RingGeometry = geo('RingGeometry', ['innerRadius', 'outerRadius', 'thetaSegments']);
export const CircleGeometry = geo('CircleGeometry', ['radius', 'segments']);
export const CapsuleGeometry = geo('CapsuleGeometry', ['radius', 'length', 'capSegments', 'radialSegments']);

export class EdgesGeometry extends BufferGeometry {
    constructor(source) {
        super({});
        if (!source) fail('EdgesGeometry(undefined)');
        this.type = 'EdgesGeometry';
        this.source = source;
    }
}

// ----------------------------------------------------------------- materials

let matId = 1;
class Material {
    constructor(params = {}) {
        this.id = matId++;
        this.type = 'Material';
        this.disposed = false;
        this.transparent = params.transparent ?? false;
        this.opacity = params.opacity ?? 1;
        this.depthWrite = params.depthWrite ?? true;
        this.depthTest = params.depthTest ?? true;
        this.blending = params.blending ?? NormalBlending;
        this.side = params.side ?? FrontSide;
        this.visible = true;
        this.map = params.map ?? null;
        this.color = new Color(params.color ?? 0xffffff);
        if (params.emissive !== undefined) this.emissive = new Color(params.emissive);
        this.emissiveIntensity = params.emissiveIntensity ?? 1;
        this.metalness = params.metalness;
        this.roughness = params.roughness;
        this.size = params.size;
        this.sizeAttenuation = params.sizeAttenuation;
        this.vertexColors = params.vertexColors ?? false;
        this.uniforms = params.uniforms;
        this.vertexShader = params.vertexShader;
        this.fragmentShader = params.fragmentShader;
    }
    dispose() { this.disposed = true; }
}
export class MeshBasicMaterial extends Material { constructor(p) { super(p); this.type = 'MeshBasicMaterial'; } }
export class MeshStandardMaterial extends Material { constructor(p) { super(p); this.type = 'MeshStandardMaterial'; } }
export class PointsMaterial extends Material { constructor(p) { super(p); this.type = 'PointsMaterial'; } }
export class LineBasicMaterial extends Material { constructor(p) { super(p); this.type = 'LineBasicMaterial'; } }
export class SpriteMaterial extends Material { constructor(p) { super(p); this.type = 'SpriteMaterial'; } }
export class ShaderMaterial extends Material {
    constructor(p = {}) {
        super(p);
        this.type = 'ShaderMaterial';
        if (!p.vertexShader || !p.fragmentShader) fail('ShaderMaterial without shaders');
        for (const [name, u] of Object.entries(p.uniforms ?? {})) {
            if (u === undefined || !('value' in u)) fail(`uniform "${name}" has no .value`);
        }
    }
}

// ------------------------------------------------------------------- objects

export class Mesh extends Object3D {
    constructor(geometry, material) {
        super();
        this.type = 'Mesh';
        if (!geometry) fail('Mesh(undefined geometry)');
        if (!material) fail('Mesh(undefined material)');
        this.geometry = geometry;
        this.material = material;
    }
}
export class Points extends Mesh { constructor(g, m) { super(g, m); this.type = 'Points'; } }
export class LineSegments extends Mesh { constructor(g, m) { super(g, m); this.type = 'LineSegments'; } }

export class Sprite extends Object3D {
    constructor(material) {
        super();
        this.type = 'Sprite';
        if (!material) fail('Sprite(undefined material)');
        this.material = material;
        this.geometry = new PlaneGeometry(1, 1);
    }
}

export class InstancedMesh extends Mesh {
    constructor(geometry, material, count) {
        super(geometry, material);
        this.type = 'InstancedMesh';
        if (!Number.isInteger(count) || count <= 0) fail(`InstancedMesh count = ${count}`);
        this.maxCount = count;
        this.count = count;
        this.instanceMatrix = { needsUpdate: false, array: new Float32Array(count * 16) };
        this.instanceColor = { needsUpdate: false, array: new Float32Array(count * 3) };
        this.writes = 0;
    }
    setMatrixAt(i, m) {
        if (i < 0 || i >= this.maxCount) fail(`setMatrixAt(${i}) out of range (max ${this.maxCount})`);
        for (const v of m.elements) if (!Number.isFinite(v)) fail(`setMatrixAt(${i}) non-finite matrix`);
        this.instanceMatrix.array.set([m.elements[12], m.elements[13], m.elements[14]], i * 16);
        this.writes++;
    }
    setColorAt(i, c) {
        if (i < 0 || i >= this.maxCount) fail(`setColorAt(${i}) out of range`);
        if (!c || !Number.isFinite(c.r)) fail(`setColorAt(${i}) bad colour`);
        this.instanceColor.array.set([c.r, c.g, c.b], i * 3);
    }
    dispose() { this.disposed = true; }
}

// -------------------------------------------------------------------- lights

export class Light extends Object3D {
    constructor(color = 0xffffff, intensity = 1) {
        super();
        this.type = 'Light';
        if (!Number.isFinite(intensity)) fail(`light intensity = ${intensity}`);
        this.color = new Color(color);
        this.intensity = intensity;
    }
}
export class AmbientLight extends Light { constructor(c, i) { super(c, i); this.type = 'AmbientLight'; } }
export class DirectionalLight extends Light { constructor(c, i) { super(c, i); this.type = 'DirectionalLight'; } }
export class PointLight extends Light { constructor(c, i) { super(c, i); this.type = 'PointLight'; } }

// ------------------------------------------------------------------ textures

export class Texture {
    constructor(image = null) { this.image = image; this.colorSpace = ''; this.disposed = false; this.needsUpdate = false; }
    dispose() { this.disposed = true; }
}
export class CanvasTexture extends Texture {
    constructor(canvas) {
        super(canvas);
        if (!canvas) fail('CanvasTexture(undefined)');
    }
}

// ------------------------------------------------------------------ renderer

export const stats = { frames: 0, draws: 0, maxDraws: 0, instanced: 0, sprites: 0 };

export class WebGLRenderer {
    constructor(params = {}) {
        this.domElement = params.canvas ?? fakeCanvas();
        this.pixelRatio = 1;
        this.width = 1280;
        this.height = 720;
        this.clearColor = null;
    }
    setPixelRatio(r) { if (!finite(r) || r <= 0) fail(`setPixelRatio(${r})`); this.pixelRatio = r; }
    setSize(w, h) { if (!finite(w, h) || w <= 0 || h <= 0) fail(`setSize(${w}, ${h})`); this.width = w; this.height = h; }
    setClearColor(c) { this.clearColor = new Color(c); }
    getSize(target) { if (target) { target.x = this.width; target.y = this.height; return target; } return { x: this.width, y: this.height }; }
    render(scene, camera) {
        if (!scene) fail('render() without a scene');
        if (!camera) fail('render() without a camera');
        let draws = 0;
        scene.traverse((o) => {
            if (!o.visible) return;
            if (!finite(o.position.x, o.position.y, o.position.z)) fail(`${o.type} has a non-finite position`);
            if (!finite(o.scale.x, o.scale.y, o.scale.z)) fail(`${o.type} has a non-finite scale`);
            if (!o.material) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
                if (m.disposed) fail(`${o.type} is still in the scene with a DISPOSED material (id ${m.id})`);
                if (!Number.isFinite(m.opacity)) fail(`${o.type} material opacity = ${m.opacity}`);
                if (m.opacity < -1e-6 || m.opacity > 1 + 1e-6) fail(`${o.type} material opacity out of range: ${m.opacity}`);
                if (!m.color || !Number.isFinite(m.color.r)) fail(`${o.type} material has no colour`);
            }
            if (o.geometry?.disposed) fail(`${o.type} is still in the scene with a DISPOSED geometry`);
            if (o.type === 'InstancedMesh') { stats.instanced += o.count; }
            if (o.type === 'Sprite') stats.sprites++;
            draws++;
        });
        stats.frames++;
        stats.draws += draws;
        stats.maxDraws = Math.max(stats.maxDraws, draws);
        return draws;
    }
    dispose() {}
}

function fakeCanvas() {
    return {
        width: 1280, height: 720, style: {},
        addEventListener() {}, removeEventListener() {},
        getContext: () => ({}),
    };
}

// ------------------------------------------------------------------- misc

export class Clock {
    constructor() { this.t = 0; this.step = 1 / 60; }
    getDelta() { this.t += this.step; return this.step; }
    getElapsedTime() { return this.t; }
}

export const AdditiveBlending = 2;
export const NormalBlending = 1;
export const MultiplyBlending = 4;
export const FrontSide = 0;
export const BackSide = 1;
export const DoubleSide = 2;
export const SRGBColorSpace = 'srgb';
export const LinearSRGBColorSpace = 'srgb-linear';
export const MathUtils = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    degToRad: (d) => (d * Math.PI) / 180,
    randFloat: (a, b) => a + Math.random() * (b - a),
};

export function resetStats() {
    stats.frames = 0; stats.draws = 0; stats.maxDraws = 0; stats.instanced = 0; stats.sprites = 0;
    problems.length = 0;
}
