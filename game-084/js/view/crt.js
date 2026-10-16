// The television's screen: the VESTA-8's 160 × 120 framebuffer on a curved, glowing CRT.
// Barrel distortion, scanlines, an aperture mask, a soft phosphor bleed, a vignette, static when
// there is no signal, and the power-on collapse line. Every pow() base is clamped (game-065: one
// NaN pixel under bloom smears into a blinking box).

import * as THREE from 'three';

export function makeCRTMaterial(tex) {
    return new THREE.ShaderMaterial({
        uniforms: {
            map: { value: tex },
            time: { value: 0 },
            power: { value: 0 },          // 0 off → 1 on (the collapse line in between)
            noise: { value: 0 },          // static
            amount: { value: 1 },         // the CRT effect setting: 0 off, 0.5 light, 1 full
            bright: { value: 1.6 },
        },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */`
            uniform sampler2D map;
            uniform float time, power, noise, amount, bright;
            varying vec2 vUv;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            void main() {
                vec2 c = vUv * 2.0 - 1.0;
                c *= 1.0 + dot(c, c) * 0.06 * amount;
                vec2 uv = c * 0.5 + 0.5;
                float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
                // power-on: the picture grows out of a bright horizontal line
                float open = clamp(power * 1.6 - 0.25, 0.0, 1.0);
                float lineH = mix(0.004, 1.0, open * open);
                float band = step(abs(uv.y - 0.5), lineH * 0.5);
                vec2 suv = vec2(uv.x, 0.5 + (uv.y - 0.5) / max(lineH, 0.004));
                vec3 col = texture2D(map, clamp(suv, 0.0, 1.0)).rgb;
                // phosphor bleed: a little of the neighbours
                vec2 px = vec2(1.0 / 160.0, 1.0 / 120.0);
                vec3 bleed = texture2D(map, clamp(suv + vec2(px.x, 0.0), 0.0, 1.0)).rgb + texture2D(map, clamp(suv - vec2(px.x, 0.0), 0.0, 1.0)).rgb;
                col = mix(col, max(col, bleed * 0.5), 0.35 * amount);
                // scanlines and the aperture mask
                float sl = 0.62 + 0.38 * pow(clamp(abs(sin(suv.y * 120.0 * 3.14159)), 0.0, 1.0), 0.6);
                col *= mix(1.0, sl, amount);
                float m = mod(floor(vUv.x * 480.0), 3.0);
                vec3 mask = m < 1.0 ? vec3(1.0, 0.82, 0.82) : m < 2.0 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0);
                col *= mix(vec3(1.0), mask, 0.5 * amount);
                // static
                float n = hash(floor(vUv * vec2(240.0, 180.0)) + floor(time * 30.0));
                col = mix(col, vec3(n * 0.55 + 0.05), noise);
                // the collapse line glows white while the tube warms up
                col = mix(vec3(1.4), col, smoothstep(0.0, 0.5, open)) * band;
                // vignette and the gentle flicker of an old tube
                float vig = clamp(1.0 - dot(c * vec2(0.9, 1.1), c * vec2(0.9, 1.1)) * 0.45 * amount, 0.0, 1.0);
                float flick = 1.0 - 0.02 * amount * sin(time * 50.0);
                col *= vig * flick * bright * step(0.001, power);
                // the glass catches a faint sheen even when the set is off
                float sheen = pow(clamp(1.0 - length(c - vec2(-0.45, 0.55)) * 0.9, 0.0, 1.0), 3.0) * 0.06;
                gl_FragColor = vec4(col * inside + sheen, 1.0);
            }`,
    });
}
