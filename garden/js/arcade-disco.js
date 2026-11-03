// The disco at the Lighthouse Arcade: a floor of light-up tiles, a mirror ball
// throwing specks of light round the room, coloured beams sweeping the floor, a
// pair of speakers that thump, and the jukebox that runs it all. With a song on,
// the floor follows the beat (a new pattern every few bars) and lights the tile
// under your feet; with no song it idles in slow colour.

import * as THREE from 'three';
import { glowSprite } from './textures.js';
import { PIXEL_FONT } from './arcade-screens.js';
import { TAU, rng } from './util.js';

export const FLOOR_Y = 0.07;

const BEAM_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const BEAM_FS = 'uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * uOpacity; gl_FragColor = vec4(uColor * a, 1.0); }';

export class Disco {
    /** @param {object} env { plan, scene, quality } */
    constructor(env) {
        const { plan, scene } = env;
        this.d = plan.disco;
        this.j = plan.jukebox;
        this.hall = plan.hall;
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.pickables = [];
        this.spin = 0;
        this.pattern = 0;
        this.lastBar = -1;
        this.bubbleT = 0;
        this._floor();
        this._ball(env.quality);
        this._beams();
        this._jukebox();
        this._speakers();
    }

    _floor() {
        const { d } = this;
        const n = d.n;
        const geo = new THREE.BoxGeometry(d.tile - 0.05, 0.06, d.tile - 0.05);
        this.tiles = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n * n);
        const m = new THREE.Matrix4();
        for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
            m.makeTranslation(d.x - d.half + (i + 0.5) * d.tile, FLOOR_Y - 0.03, d.z - d.half + (k + 0.5) * d.tile);
            this.tiles.setMatrixAt(i * n + k, m);
            this.tiles.setColorAt(i * n + k, new THREE.Color(0.1, 0.1, 0.1));
        }
        this.group.add(this.tiles);
        // a black grid under the tiles and a chrome rim round them
        const under = new THREE.Mesh(new THREE.BoxGeometry(d.half * 2 + 0.02, 0.04, d.half * 2 + 0.02), new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.6 }));
        under.position.set(d.x, 0.02, d.z);
        this.group.add(under);
        const chrome = new THREE.MeshStandardMaterial({ color: 0xdde0ff, metalness: 1, roughness: 0.12 });
        for (const [w, dd, x, z] of [[d.half * 2 + 0.24, 0.12, d.x, d.z - d.half - 0.06], [d.half * 2 + 0.24, 0.12, d.x, d.z + d.half + 0.06], [0.12, d.half * 2, d.x - d.half - 0.06, d.z], [0.12, d.half * 2, d.x + d.half + 0.06, d.z]]) {
            const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, dd), chrome);
            rim.position.set(x, 0.04, z);
            this.group.add(rim);
        }
        this.col = new THREE.Color();
    }

    _ball(quality) {
        const { d } = this;
        const y = this.hall.h - 1.3;
        this.ballPos = new THREE.Vector3(d.x, y, d.z);
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.04, flatShading: true, emissive: 0x332244, emissiveIntensity: 0.5 }));
        ball.position.copy(this.ballPos);
        this.group.add(ball);
        this.mirror = ball;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, this.hall.h - y), new THREE.MeshStandardMaterial({ color: 0x777788, metalness: 1, roughness: 0.3 }));
        rod.position.set(d.x, (this.hall.h + y) / 2 + 0.2, d.z);
        this.group.add(rod);
        // the specks it throws: directions on a sphere, cast onto the room's walls, floor and ceiling every frame
        const N = quality?.tier === 'low' ? 140 : 280;
        const r = rng('mirrorball');
        this.dirs = [];
        for (let i = 0; i < N; i++) {
            const yy = r.range(-0.95, 0.35);
            const a = r() * TAU, s = Math.sqrt(1 - yy * yy);
            this.dirs.push(new THREE.Vector3(Math.cos(a) * s, yy, Math.sin(a) * s));
        }
        const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            const c = new THREE.Color().setHSL(r() < 0.6 ? 0 : r(), r() < 0.6 ? 0 : 0.8, 0.85);
            col.set([c.r, c.g, c.b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.speckMat = new THREE.PointsMaterial({ size: 0.24, map: glowSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.6 });
        this.specks = new THREE.Points(g, this.speckMat);
        this.specks.frustumCulled = false;
        this.group.add(this.specks);
        this.v = new THREE.Vector3();
    }

    _beams() {
        const { d } = this;
        this.beams = [];
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        corners.forEach(([sx, sz], i) => {
            const mat = new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0.3 } },
                vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            });
            const len = this.hall.h * 1.25;
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, len, 20, 1, true).translate(0, -len / 2, 0), mat);
            // ConeGeometry's uv.y runs 0 at the base to 1 at the tip; the shader wants the tip bright, so flip
            const uv = cone.geometry.attributes.uv;
            for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k));
            const pivot = new THREE.Group();
            pivot.position.set(d.x + sx * (d.half + 0.4), this.hall.h - 0.3, d.z + sz * (d.half + 0.4));
            pivot.add(cone);
            // a can light at the top of each beam
            const can = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x15151c, metalness: 0.6, roughness: 0.4 }));
            pivot.add(can);
            this.group.add(pivot);
            this.beams.push({ pivot, mat, phase: i * 1.7, sx, sz });
        });
        // two coloured lights that wash the floor and the people on it
        this.lights = [0, 1].map((k) => {
            const l = new THREE.PointLight(0xff40d0, 4, 12, 1.4);
            l.position.set(d.x + (k ? 1 : -1) * 1.6, 3.2, d.z);
            this.group.add(l);
            return l;
        });
    }

    _jukebox() {
        const { j } = this;
        const g = new THREE.Group();
        g.position.set(j.x, 0, j.z);
        g.rotation.y = j.rot;
        const wood = new THREE.MeshStandardMaterial({ color: 0x5a1a14, roughness: 0.35, metalness: 0.1 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xeeeeff, metalness: 1, roughness: 0.1 });
        const add = (geo, mat, x, y, z, rx = 0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            m.rotation.x = rx;
            m.userData.kind = 'jukebox';
            g.add(m);
            this.pickables.push(m);
            return m;
        };
        add(new THREE.BoxGeometry(1.04, 1.02, 0.62), wood, 0, 0.51, 0);
        add(new THREE.CylinderGeometry(0.52, 0.52, 0.62, 28, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), wood, 0, 1.02, 0);
        // the glowing arches
        this.archMats = [new THREE.MeshBasicMaterial({ color: 0xff40a0, toneMapped: false }), new THREE.MeshBasicMaterial({ color: 0x40e0ff, toneMapped: false })];
        add(new THREE.TorusGeometry(0.5, 0.04, 8, 36, Math.PI), this.archMats[0], 0, 1.02, 0.31);
        add(new THREE.TorusGeometry(0.4, 0.03, 8, 36, Math.PI), this.archMats[1], 0, 1.02, 0.32);
        // the bubble tubes down each side
        this.tubeMats = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xffa020, toneMapped: false, transparent: true, opacity: 0.85 }));
        for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 10), this.tubeMats[sx > 0 ? 1 : 0], sx * 0.5, 0.52, 0.3);
        this.bubbles = [];
        const bubMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.8 });
        for (let k = 0; k < 10; k++) {
            const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), bubMat);
            b.position.set((k % 2 ? 1 : -1) * 0.5, 0.1 + (k / 10) * 0.9, 0.34);
            g.add(b);
            this.bubbles.push(b);
        }
        // the record in the window, and the tone arm
        const disc = new THREE.Group();
        disc.position.set(0, 1.12, 0.2);
        disc.rotation.x = Math.PI / 2 - 0.35;
        const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.008, 32), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.2, metalness: 0.3 }));
        const label = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 20), new THREE.MeshBasicMaterial({ color: 0xff3060 }));
        disc.add(vinyl, label);
        g.add(disc);
        this.disc = disc;
        this.discLabel = label.material;
        add(new THREE.CircleGeometry(0.34, 28, 0, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false }), 0, 1.02, 0.312);
        // the title strips: a little card for every song
        const c = Object.assign(document.createElement('canvas'), { width: 256, height: 128 });
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#f4ecd8';
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = '#c0203a';
        ctx.font = `7px ${PIXEL_FONT}`;
        ctx.textBaseline = 'middle';
        for (let k = 0; k < 8; k++) {
            const x = (k % 2) * 128 + 6, y = Math.floor(k / 2) * 32 + 16;
            ctx.strokeStyle = '#c0203a';
            ctx.strokeRect(x - 2, y - 12, 120, 24);
            ctx.fillText(`${String.fromCharCode(65 + Math.floor(k / 2))}${(k % 2) + 1}`, x + 2, y);
        }
        this.cardCanvas = c;
        this.cardTex = new THREE.CanvasTexture(c);
        this.cardTex.colorSpace = THREE.SRGBColorSpace;
        add(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ map: this.cardTex, toneMapped: false, color: 0xdddddd }), 0, 0.78, 0.315, -0.15);
        // the speaker grille
        const gr = add(new THREE.PlaneGeometry(0.78, 0.4), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9, emissive: 0xffa040, emissiveIntensity: 0.15 }), 0, 0.3, 0.315);
        this.grille = gr.material;
        for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 1.02, 0.66), chrome, sx * 0.52, 0.51, 0);
        this.group.add(g);
        this.jukeGroup = g;
        this.jukeLight = new THREE.PointLight(0xffa050, 2.5, 5, 1.6);
        this.jukeLight.position.set(j.x - 0.8, 1.2, j.z);
        this.group.add(this.jukeLight);
    }

    /** Writes the song names onto the title strips. */
    setSongs(songs) {
        const ctx = this.cardCanvas.getContext('2d');
        ctx.fillStyle = '#1a1020';
        ctx.font = `6px ${PIXEL_FONT}`;
        songs.slice(0, 8).forEach((s, k) => {
            const x = (k % 2) * 128 + 24, y = Math.floor(k / 2) * 32 + 16;
            ctx.fillText(s.title.toUpperCase().slice(0, 15), x, y - 3);
            ctx.fillStyle = '#6a4060';
            ctx.fillText(s.artist.toUpperCase().slice(0, 15), x, y + 6);
            ctx.fillStyle = '#1a1020';
        });
        this.cardTex.needsUpdate = true;
    }

    _speakers() {
        const cab = new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.7 });
        const cone = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.5, metalness: 0.2 });
        this.cones = [];
        for (const s of this.d.speakers) {
            const g = new THREE.Group();
            g.position.set(s.x, 0, s.z);
            g.rotation.y = this.j.rot;
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.7), cab);
            box.position.y = 0.8;
            g.add(box);
            for (const [y, r] of [[0.5, 0.3], [1.15, 0.18], [1.45, 0.08]]) {
                const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.6, 0.08, 20).rotateX(Math.PI / 2), cone);
                c.position.set(0, y, 0.36);
                g.add(c);
                if (r > 0.2) this.cones.push(c);
            }
            this.group.add(g);
        }
    }

    /** Is (x, z) on the dance floor? */
    onFloor(x, z) {
        const { d } = this;
        return Math.abs(x - d.x) < d.half && Math.abs(z - d.z) < d.half;
    }

    update(dt, t, beat, player) {
        const { d } = this;
        const n = d.n;
        const playing = beat.playing;
        const b = playing ? beat.beat : t * 0.6;
        const pulse = playing ? beat.pulse : 0.3 + 0.2 * Math.sin(t * 2);
        // a new floor pattern every four bars
        const bar = Math.floor(b / 4);
        if (bar !== this.lastBar && bar % 4 === 0) {
            this.lastBar = bar;
            this.pattern = playing ? (this.pattern + 1 + Math.floor(Math.random() * 4)) % 6 : 5;
        }
        const pi = player && this.onFloor(player.x, player.z) ? { i: Math.floor((player.x - (d.x - d.half)) / d.tile), k: Math.floor((player.z - (d.z - d.half)) / d.tile) } : null;
        const c = this.col;
        const beatI = Math.floor(b);
        const step8 = Math.floor(b * 2);
        for (let i = 0; i < n; i++) {
            for (let k = 0; k < n; k++) {
                const ci = i - (n - 1) / 2, ck = k - (n - 1) / 2;
                const rr = Math.hypot(ci, ck);
                let hue = 0, on = 0;
                switch (this.pattern) {
                    case 0: // checkerboard swapping on the beat
                        on = (i + k + beatI) % 2 ? 1 : 0.08;
                        hue = ((beatI % 4) / 4 + (i + k) * 0.02) % 1;
                        break;
                    case 1: // rings rippling out from the middle
                        on = Math.abs(rr - (b * 2) % (n * 0.75)) < 0.7 ? 1 : 0.06;
                        hue = (rr * 0.08 + b * 0.05) % 1;
                        break;
                    case 2: // stripes sweeping corner to corner
                        on = ((i + k + step8) % 4) === 0 ? 1 : 0.07;
                        hue = ((i - k) * 0.04 + b * 0.03 + 1) % 1;
                        break;
                    case 3: // sparkles on the eighth notes
                        on = ((i * 7 + k * 13 + step8 * 5) % 9) < 2 ? 1 : 0.05;
                        hue = ((i * 3 + k * 5 + step8) % 7) / 7;
                        break;
                    case 4: { // a spiral turning
                        const a = (Math.atan2(ck, ci) / TAU + 1) % 1;
                        on = Math.abs(((a + rr * 0.12 - b * 0.25) % 1 + 1) % 1 - 0.5) < 0.16 ? 1 : 0.06;
                        hue = (a + b * 0.02) % 1;
                        break;
                    }
                    default: // idle: a slow wash of colour
                        on = 0.35 + 0.3 * Math.sin(t * 1.2 + ci * 0.7 + ck * 0.5);
                        hue = (t * 0.03 + (ci + ck) * 0.04 + 1) % 1;
                }
                if (playing && on >= 1) on = 0.65 + pulse * 0.6;
                if (pi && pi.i === i && pi.k === k) on = 1.4, (hue = (b * 0.1) % 1);
                c.setHSL(hue, 0.95, 0.5).multiplyScalar(on * (playing ? 1.4 : 1));
                this.tiles.setColorAt(i * n + k, c);
            }
        }
        this.tiles.instanceColor.needsUpdate = true;

        // the mirror ball turns; its specks are found by casting each facet's direction at the room
        this.spin += dt * (playing ? 0.55 : 0.18);
        this.mirror.rotation.y = this.spin;
        const pos = this.specks.geometry.attributes.position;
        const h = this.hall, o = this.ballPos;
        const cs = Math.cos(this.spin), sn = Math.sin(this.spin);
        for (let i = 0; i < this.dirs.length; i++) {
            const dd = this.dirs[i];
            const dx = dd.x * cs - dd.z * sn, dz = dd.x * sn + dd.z * cs, dy = dd.y;
            let tt = Infinity;
            if (dy < 0) tt = Math.min(tt, (0.02 - o.y) / dy);
            if (dy > 0) tt = Math.min(tt, (h.h - 0.02 - o.y) / dy);
            if (dx > 0) tt = Math.min(tt, (h.x1 - 0.03 - o.x) / dx);
            if (dx < 0) tt = Math.min(tt, (h.x0 + 0.03 - o.x) / dx);
            if (dz > 0) tt = Math.min(tt, (h.z1 - 0.03 - o.z) / dz);
            if (dz < 0) tt = Math.min(tt, (h.z0 + 0.03 - o.z) / dz);
            if (tt > 16) pos.setXYZ(i, 0, -50, 0);
            else pos.setXYZ(i, o.x + dx * tt, Math.max(o.y + dy * tt, FLOOR_Y + 0.01), o.z + dz * tt);
        }
        pos.needsUpdate = true;
        this.speckMat.opacity = playing ? 0.7 + pulse * 0.3 : 0.45;

        // beams sweep the floor in time
        for (const bm of this.beams) {
            const a = b * 0.25 + bm.phase;
            bm.pivot.rotation.set(Math.sin(a) * 0.55 + bm.sz * 0.35, 0, Math.cos(a * 1.3) * 0.55 - bm.sx * 0.35);
            bm.mat.uniforms.uColor.value.setHSL((bm.phase * 0.17 + b * 0.02) % 1, 1, 0.55);
            bm.mat.uniforms.uOpacity.value = playing ? 0.18 + pulse * 0.3 : 0.08;
        }
        this.lights.forEach((l, k) => {
            l.color.setHSL((b * 0.0625 + k * 0.5) % 1, 1, 0.55);
            l.intensity = playing ? 3 + pulse * 6 : 1.5;
        });
        // the jukebox glows and bubbles; the record spins while it plays
        this.archMats[0].color.setHSL((t * 0.1) % 1, 1, 0.55).multiplyScalar(1.6);
        this.archMats[1].color.setHSL((t * 0.1 + 0.5) % 1, 1, 0.55).multiplyScalar(1.6);
        for (const m of this.tubeMats) m.color.setHSL((0.08 + Math.sin(t * 0.7) * 0.04 + 1) % 1, 1, 0.55).multiplyScalar(1.5);
        for (const bu of this.bubbles) {
            bu.position.y += dt * (0.12 + (bu.id % 3) * 0.04);
            if (bu.position.y > 0.98) bu.position.y = 0.08;
        }
        if (playing) this.disc.rotateY(dt * 4.7);
        this.grille.emissiveIntensity = playing ? 0.2 + pulse * 0.5 : 0.12;
        this.jukeLight.intensity = 2 + (playing ? pulse * 2 : 0);
        for (const cn of this.cones) cn.scale.setScalar(1 + (playing ? pulse * 0.08 : 0));
    }

    /** The jukebox's label takes the colour of the song on the turntable. */
    setRecord(index) {
        this.discLabel.color.setHSL((index * 0.13) % 1, 0.9, 0.5);
    }
}
