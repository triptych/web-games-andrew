// The look of a way through: a column of light with slow streaks rising in it,
// strongest at night. Used over the Standing Stones' altar and on the dais at
// the foot of Cinderpeak, so each end of the journey is recognisable from afar.

import * as THREE from 'three';
import { GLSL_NOISE } from './sky.js';
import { glowSprite } from './textures.js';

/**
 * @param {object} world the garden world (for updaters)
 * @param {object} o { x, y, z, color, radius, height }
 */
export function lightColumn(world, { x, y, z, color = 0xffa040, radius = 1.5, height = 7, strength = 1 }) {
    const col = new THREE.Color(color);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: col }, uOpacity: { value: 0.3 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
            uniform float uTime, uOpacity; uniform vec3 uColor; varying vec2 vUv;
            ${GLSL_NOISE}
            void main(){
                float y = vUv.y;
                float streak = vnoise(vec2(vUv.x * 18.0, y * 3.0 - uTime * 0.9)) * 0.65 + vnoise(vec2(vUv.x * 40.0 + 7.0, y * 7.0 - uTime * 1.7)) * 0.35;
                float a = pow(streak, 1.4) * (1.0 - y) * smoothstep(0.0, 0.08, y) * uOpacity;
                gl_FragColor = vec4(uColor * a * 1.6, 1.0);
                #include <colorspace_fragment>
            }`,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.25, height, 28, 1, true).translate(0, height / 2, 0), mat);
    mesh.position.set(x, y, z);
    mesh.renderOrder = 6;
    world.root.add(mesh);
    // a soft pool of light on the ground under it
    const glow = new THREE.Mesh(new THREE.CircleGeometry(radius * 2.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowSprite(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 }));
    glow.position.set(x, y + 0.05, z);
    glow.renderOrder = 5;
    world.root.add(glow);
    world.updaters.push((t, sky) => {
        mat.uniforms.uTime.value = t;
        const n = sky.state.night;
        mat.uniforms.uOpacity.value = (0.22 + 0.7 * n) * strength;
        glow.material.opacity = (0.2 + 0.5 * n) * strength;
    });
    return { mesh, glow };
}
