// Shared GLSL: hashing, 3D value noise, fbm, and an analytic crater field.
// Every pow() base is clamped to [0, 1]: under bloom one NaN pixel smears into a blinking box.

export const NOISE = /* glsl */`
float h31(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vn3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p, int oct){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vn3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
// Craters on a 3D lattice. Returns height in .x and its gradient (in p's units) in .yzw.
// A bowl inside radius s, a raised rim just outside it, nothing beyond. Feature points sit in the
// middle half of their cell and reach at most 0.4 cells, so only the 2×2×2 cells nearest p can
// touch it: 8 lookups, not 27.
vec4 craters(vec3 p, float density){
  vec3 c = floor(p);
  vec3 o = step(0.5, fract(p)) * 2.0 - 1.0;     // which neighbour on each axis is nearer
  vec4 acc = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    vec3 cell = c + vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1)) * o;
    vec3 rnd = h33(cell);
    if (rnd.z > density) continue;
    vec3 fp = cell + 0.25 + rnd * 0.5;
    float s = 0.1 + 0.15 * h31(cell + 7.7);
    vec3 d = p - fp;
    float r = length(d);
    float x1 = r / s;
    if (x1 > 1.6) continue;
    float h, dh;
    if (x1 < 1.0) { h = (x1 * x1 - 1.0) * 0.7 + 0.25 * x1 * x1 * x1 * x1; dh = 1.4 * x1 + x1 * x1 * x1; }
    else { float kk = (x1 - 1.0) / 0.6; float e = 1.0 - kk; h = 0.25 * e * e * (1.0 + 2.0 * kk); dh = 0.25 * (-6.0 * kk * e) / 0.6; }
    acc.x += h * s;
    acc.yzw += dh * (r > 1e-4 ? d / r : vec3(0.0));
  }
  return acc;
}
`;
