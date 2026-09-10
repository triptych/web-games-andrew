/**
 * math.js — minimal 3D math library for the software renderer.
 * No dependencies. Vec3 is a plain [x,y,z] array for speed;
 * Mat4 is a flat Float32Array(16) in column-major order (like GL).
 */

// ---------- Vec3 ----------

export function vec3(x = 0, y = 0, z = 0) { return [x, y, z]; }

export function v3add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function v3sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function v3scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function v3dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function v3cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}
export function v3len(a) { return Math.sqrt(v3dot(a, a)); }
export function v3norm(a) {
    const l = v3len(a);
    if (l < 1e-8) return [0, 0, 0];
    return [a[0] / l, a[1] / l, a[2] / l];
}
export function v3lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function v3dist(a, b) { return v3len(v3sub(a, b)); }

// ---------- Mat4 (column-major, GL-style) ----------

export function mat4Identity() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);
}

export function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
            out[c * 4 + r] = sum;
        }
    }
    return out;
}

/** Perspective projection matrix. fovY in radians. */
export function mat4Perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const out = mat4Identity();
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    out[15] = 0;
    return out;
}

/** Right-handed look-at view matrix. */
export function mat4LookAt(eye, target, up) {
    const zAxis = v3norm(v3sub(eye, target)); // forward is -z
    const xAxis = v3norm(v3cross(up, zAxis));
    const yAxis = v3cross(zAxis, xAxis);

    const out = mat4Identity();
    out[0] = xAxis[0]; out[4] = xAxis[1]; out[8] = xAxis[2];
    out[1] = yAxis[0]; out[5] = yAxis[1]; out[9] = yAxis[2];
    out[2] = zAxis[0]; out[6] = zAxis[1]; out[10] = zAxis[2];
    out[12] = -v3dot(xAxis, eye);
    out[13] = -v3dot(yAxis, eye);
    out[14] = -v3dot(zAxis, eye);
    return out;
}

/** Build a view matrix directly from position + yaw/pitch (radians). Avoids gimbal issues from lookAt. */
export function mat4ViewFromYawPitch(pos, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    // Forward vector for yaw (around Y) then pitch (around local X)
    const forward = [sy * cp, sp, -cy * cp];
    const target = v3add(pos, forward);
    return mat4LookAt(pos, target, [0, 1, 0]);
}

export function v3transformMat4(v, m) {
    const x = v[0], y = v[1], z = v[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return {
        x: m[0] * x + m[4] * y + m[8] * z + m[12],
        y: m[1] * x + m[5] * y + m[9] * z + m[13],
        z: m[2] * x + m[6] * y + m[10] * z + m[14],
        w,
    };
}

export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
