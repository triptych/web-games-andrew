// The lab, in three.js. A dark room on the Moon with a window onto Tycho Station, a desk, the
// VESTA-8 console, a wood-veneer television whose screen is the console's framebuffer, a shelf of
// nine cartridges, a holographic ring of VESTA's memory sectors, dust in the lamp light.
// The view never changes the game; main.js tells it what to show.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V } from '../runtime/index.js';
import { makeCRTMaterial } from './crt.js';
import { windowTexture, woodTexture, gridTexture, badgeTexture, labelTexture } from './textures.js';

const DESK_Y = 0.74;
const SCREEN = { w: 0.40, h: 0.30, center: new THREE.Vector3(-0.08, DESK_Y + 0.33, -0.27) };

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });
const glowMat = (color, intensity = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: true });

export class View {
    constructor(canvas, quality = 2) {
        this.canvas = canvas;
        this.quality = quality;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality > 0, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.setClearColor(0x020309);
        this.renderer.shadowMap.enabled = quality >= 2;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x03040a, 4, 11);
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.55, 0.78);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
        this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
        this.pose = 'title';
        this.camFrom = null; this.camT = 1;
        this.camPos = new THREE.Vector3(2, 1.6, 2.4);
        this.camLook = new THREE.Vector3(0, 0.95, -0.1);
        this.time = 0;
        this.picks = [];
        this.cartMeshes = {};
        this.ringSegs = [];
        this.crtPower = 0; this.crtPowerTarget = 1;

        // the television's picture: a 160 × 120 canvas the console's framebuffer is copied into
        this.screenCanvas = document.createElement('canvas');
        this.screenCanvas.width = V.W; this.screenCanvas.height = V.H;
        this.screenCtx = this.screenCanvas.getContext('2d');
        this.screenImg = this.screenCtx.createImageData(V.W, V.H);
        this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
        this.screenTex.colorSpace = THREE.SRGBColorSpace;
        this.screenTex.magFilter = THREE.NearestFilter;
        this.screenTex.minFilter = THREE.LinearFilter;
        this.screenTex.generateMipmaps = false;
        this.crtMat = makeCRTMaterial(this.screenTex);
        this.screenGlow = new THREE.Color(0x30ff90);

        this.envMap = this.makeEnv();
        this.scene.environment = this.envMap;
        this.build();
        this.resize(true);
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    makeEnv() {
        const pm = new THREE.PMREMGenerator(this.renderer);
        const s = new THREE.Scene();
        s.background = new THREE.Color(0x05060e);
        const box = (c, p, sc) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: c })); m.position.set(...p); m.scale.set(...sc); s.add(m); };
        box(new THREE.Color(0.5, 1.6, 1.8), [-4, 2, 0], [0.3, 0.3, 8]);
        box(new THREE.Color(1.8, 0.5, 1.6), [4, 2.5, 0], [0.3, 0.3, 8]);
        box(new THREE.Color(1.6, 1.2, 0.8), [0, 5, 0], [3, 0.2, 3]);
        box(new THREE.Color(0.3, 0.35, 0.8), [0, 1.5, -5], [8, 3, 0.2]);
        const rt = pm.fromScene(s, 0.04);
        pm.dispose();
        return rt.texture;
    }

    // ------------------------------------------------------------------ building the lab
    build() {
        const S = this.scene;
        S.add(new THREE.HemisphereLight(0x4a5a9a, 0x0a0812, 0.55));
        // the lamp over the desk
        const spot = new THREE.SpotLight(0xffd9a8, 26, 6, 0.55, 0.6, 1.6);
        spot.position.set(0.3, 2.7, 0.6);
        spot.target.position.set(0, DESK_Y, -0.05);
        spot.castShadow = this.quality >= 2;
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0008;
        S.add(spot, spot.target);
        const rim = new THREE.DirectionalLight(0x6a7cff, 0.9);
        rim.position.set(-1, 2, -3);
        S.add(rim);
        // the television lights the desk in its own colour
        this.crtLight = new THREE.PointLight(0x30ff90, 0.8, 2.2, 1.5);
        this.crtLight.position.copy(SCREEN.center).add(new THREE.Vector3(0, -0.02, 0.35));
        S.add(this.crtLight);

        this.buildRoom(S);
        this.buildDesk(S);
        this.buildTV(S);
        this.buildConsole(S);
        this.buildJoystick(S);
        this.buildShelf(S);
        this.buildRing(S);
        this.buildDust(S);
        this.buildBeam(S);
    }

    buildRoom(S) {
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mat(0xffffff, { map: gridTexture(), roughness: 0.32, metalness: 0.35 }));
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        S.add(floor);
        const wallM = mat(0x10131f, { roughness: 0.85 });
        const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), wallM);
        back.position.set(0, 2.5, -2.4);
        S.add(back);
        // the window onto the station
        const win = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.0), new THREE.MeshBasicMaterial({ map: windowTexture(), fog: false }));
        win.position.set(-0.2, 1.9, -2.38);
        S.add(win);
        const frameM = mat(0x2a2f44, { metalness: 0.7, roughness: 0.35 });
        for (const [w, h, x, y] of [[4.8, 0.1, -0.2, 2.92], [4.8, 0.14, -0.2, 0.88], [0.1, 2.1, -2.55, 1.9], [0.1, 2.1, 2.15, 1.9], [0.06, 2.0, -0.2, 1.9]]) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), frameM);
            f.position.set(x, y, -2.36);
            S.add(f);
        }
        const side = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), wallM);
        side.rotation.y = -Math.PI / 2;
        side.position.set(2.6, 2.5, 0.2);
        S.add(side);
        const side2 = side.clone();
        side2.rotation.y = Math.PI / 2;
        side2.position.x = -3.2;
        S.add(side2);
        // neon trim along the walls
        const trim = (c, p, sc) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glowMat(c, 2.4)); m.position.set(...p); m.scale.set(...sc); S.add(m); };
        trim(0x5ff0ff, [-0.2, 0.06, -2.37], [6, 0.02, 0.02]);
        trim(0xff4fd8, [-0.2, 3.1, -2.37], [6, 0.02, 0.02]);
        trim(0x5ff0ff, [2.58, 0.06, 0.2], [0.02, 0.02, 5]);
        trim(0xff4fd8, [2.58, 2.6, 0.2], [0.02, 0.02, 5]);
        // a server rack blinking in the corner
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.9, 0.5), mat(0x0d0f18, { metalness: 0.6, roughness: 0.4 }));
        rack.position.set(-2.4, 0.95, -1.8);
        S.add(rack);
        this.blinkers = [];
        for (let i = 0; i < 24; i++) {
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.01), glowMat(i % 3 ? 0x5ff0ff : 0xffb347, 3));
            led.position.set(-2.55 + (i % 4) * 0.1, 0.4 + Math.floor(i / 4) * 0.25, -1.54);
            S.add(led);
            this.blinkers.push(led);
        }
    }

    buildDesk(S) {
        const top = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.05, 0.95, 2, 0.01), mat(0x1c1a22, { roughness: 0.45, metalness: 0.2 }));
        top.position.set(0, DESK_Y - 0.025, -0.05);
        top.receiveShadow = true; top.castShadow = true;
        S.add(top);
        const legM = mat(0x2b2f40, { metalness: 0.8, roughness: 0.3 });
        for (const [x, z] of [[-1.0, -0.45], [1.0, -0.45], [-1.0, 0.35], [1.0, 0.35]]) {
            const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, DESK_Y - 0.05, 8), legM);
            l.position.set(x, (DESK_Y - 0.05) / 2, z);
            S.add(l);
        }
        const edge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.006, 0.006), glowMat(0x5ff0ff, 2));
        edge.position.set(0, DESK_Y - 0.03, 0.43);
        S.add(edge);
        // an oscilloscope that draws whatever the sound chip plays
        const scope = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.2, 0.24, 2, 0.015), mat(0x8a8f9e, { metalness: 0.5, roughness: 0.4 }));
        scope.position.set(-0.75, DESK_Y + 0.1, -0.2);
        scope.rotation.y = 0.35;
        S.add(scope);
        const sc = document.createElement('canvas'); sc.width = 128; sc.height = 80;
        this.scopeCanvas = sc; this.scopeCtx = sc.getContext('2d');
        this.scopeTex = new THREE.CanvasTexture(sc);
        this.scopeTex.colorSpace = THREE.SRGBColorSpace;
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.11), new THREE.MeshBasicMaterial({ map: this.scopeTex }));
        scr.position.set(-0.03, 0.01, 0.121);
        scope.add(scr);
        this.scopeLevel = 0;
        // a mug, because researchers
        const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 20), mat(0xff8a2a, { roughness: 0.4 }));
        mug.position.set(0.82, DESK_Y + 0.05, 0.05);
        mug.castShadow = true;
        S.add(mug);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI), mug.material);
        handle.position.set(0.86, DESK_Y + 0.05, 0.05);
        handle.rotation.z = -Math.PI / 2;
        S.add(handle);
    }

    buildTV(S) {
        const tv = new THREE.Group();
        const c = SCREEN.center;
        tv.position.set(c.x, DESK_Y, c.z - 0.02);
        const wood = mat(0xffffff, { map: woodTexture(), roughness: 0.55 });
        const body = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.5, 0.44, 4, 0.04), wood);
        body.position.set(0.04, 0.27, -0.2);
        body.castShadow = true; body.receiveShadow = true;
        tv.add(body);
        const face = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.46, 0.04, 3, 0.02), mat(0x15161c, { roughness: 0.5 }));
        face.position.set(0.04, 0.27, 0.01);
        tv.add(face);
        // the bezel around the glass
        const bez = new THREE.Mesh(new RoundedBoxGeometry(SCREEN.w + 0.05, SCREEN.h + 0.05, 0.02, 3, 0.02), mat(0x050506, { roughness: 0.3 }));
        bez.position.set(0, 0.33, 0.03);
        tv.add(bez);
        // the glass bulges a little, like a real tube
        const g = new THREE.PlaneGeometry(SCREEN.w, SCREEN.h, 24, 18);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i) / (SCREEN.w / 2), y = p.getY(i) / (SCREEN.h / 2);
            p.setZ(i, 0.012 * (1 - 0.5 * (x * x + y * y)));
        }
        g.computeVertexNormals();
        this.screenMesh = new THREE.Mesh(g, this.crtMat);
        this.screenMesh.position.set(0, 0.33, 0.042);
        this.screenMesh.userData.act = 'tv';
        tv.add(this.screenMesh);
        this.picks.push(this.screenMesh);
        // the control column: knobs and a speaker grille
        const knobM = mat(0xc9c3b0, { metalness: 0.6, roughness: 0.3 });
        for (let i = 0; i < 2; i++) {
            const k = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.025, 20), knobM);
            k.rotation.x = Math.PI / 2;
            k.position.set(0.27, 0.42 - i * 0.07, 0.04);
            tv.add(k);
        }
        for (let i = 0; i < 7; i++) {
            const sl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.005, 0.005), mat(0x0a0a0c));
            sl.position.set(0.27, 0.26 - i * 0.015, 0.033);
            tv.add(sl);
        }
        this.tvLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), glowMat(0xff3030, 3));
        this.tvLed.position.set(0.27, 0.13, 0.035);
        tv.add(this.tvLed);
        // rabbit ears
        const ant = mat(0xd0d4dc, { metalness: 0.9, roughness: 0.2 });
        const base = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x18181d));
        base.position.set(0.04, 0.52, -0.2);
        tv.add(base);
        for (const s of [-1, 1]) {
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.42, 6), ant);
            rod.position.set(0.04 + s * 0.09, 0.71, -0.2);
            rod.rotation.z = -s * 0.45;
            tv.add(rod);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), ant);
            tip.position.set(0.04 + s * 0.18, 0.9, -0.2);
            tv.add(tip);
        }
        S.add(tv);
        this.tv = tv;
    }

    buildConsole(S) {
        const con = new THREE.Group();
        con.position.set(-0.05, DESK_Y, 0.2);
        // the side profile: a low wedge, extruded across the width
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(0.22, 0); shape.lineTo(0.22, 0.05); shape.lineTo(0.12, 0.085); shape.lineTo(0, 0.09); shape.lineTo(0, 0);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.44, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
        geo.translate(-0.11, 0, -0.22);
        geo.rotateY(Math.PI / 2);
        const shell = new THREE.Mesh(geo, mat(0x101014, { roughness: 0.35, metalness: 0.2 }));
        shell.castShadow = true; shell.receiveShadow = true;
        shell.userData.act = 'console';
        con.add(shell);
        this.picks.push(shell);
        // wood-grain front, like the consoles of 1983
        const woodFront = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.045, 0.004), mat(0xffffff, { map: woodTexture(), roughness: 0.5 }));
        woodFront.position.set(0, 0.027, 0.112);
        woodFront.rotation.x = -0.32;
        con.add(woodFront);
        const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.025), new THREE.MeshBasicMaterial({ map: badgeTexture() }));
        badge.position.set(-0.09, 0.028, 0.116);
        badge.rotation.x = -0.32;
        con.add(badge);
        // ribs on top
        for (let i = 0; i < 9; i++) {
            const rib = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.004, 0.006), mat(0x1d1d24, { metalness: 0.3 }));
            rib.position.set(-0.13, 0.091 - i * 0.002, -0.08 + i * 0.016);
            con.add(rib);
        }
        // four chrome switches and the power light
        for (let i = 0; i < 4; i++) {
            const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 10), mat(0xdfe3ea, { metalness: 1, roughness: 0.2 }));
            sw.position.set(0.06 + i * 0.035, 0.075, 0.02);
            sw.rotation.x = -0.6;
            con.add(sw);
        }
        this.powerLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), glowMat(0x30ff60, 4));
        this.powerLed.position.set(0.19, 0.06, 0.07);
        con.add(this.powerLed);
        // the cartridge slot and a cartridge in it
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, 0.035), mat(0x020203));
        slot.position.set(0.0, 0.092, -0.05);
        con.add(slot);
        this.slotCart = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.024), [mat(0x222228), mat(0x222228), mat(0x222228), mat(0x222228), mat(0xffffff), mat(0x222228)]);
        this.slotCart.position.set(0, 0.14, -0.05);
        this.slotCart.rotation.x = -0.12;
        this.slotCart.castShadow = true;
        this.slotCart.visible = false;
        this.slotCart.userData.act = 'console';
        this.picks.push(this.slotCart);
        con.add(this.slotCart);
        S.add(con);
        this.console = con;
    }

    buildJoystick(S) {
        const j = new THREE.Group();
        j.position.set(0.48, DESK_Y, 0.22);
        j.rotation.y = -0.4;
        const base = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.035, 0.11, 2, 0.01), mat(0x121216, { roughness: 0.4 }));
        base.position.y = 0.018;
        base.castShadow = true;
        j.add(base);
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.08, 10), mat(0x0a0a0d));
        stick.position.set(0.01, 0.075, 0.01);
        j.add(stick);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), mat(0x111114, { roughness: 0.3 }));
        knob.position.set(0.01, 0.115, 0.01);
        j.add(knob);
        const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 16), mat(0xe8394d, { roughness: 0.3, emissive: 0x400008 }));
        fire.position.set(-0.03, 0.04, -0.03);
        j.add(fire);
        this.stick = stick; this.knob = knob;
        S.add(j);
        // the cable back to the console
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.43, DESK_Y + 0.01, 0.17), new THREE.Vector3(0.36, DESK_Y + 0.005, 0.3),
            new THREE.Vector3(0.22, DESK_Y + 0.005, 0.32), new THREE.Vector3(0.18, DESK_Y + 0.02, 0.2),
        ]);
        const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.004, 6), mat(0x070708, { roughness: 0.6 }));
        S.add(cable);
    }

    buildShelf(S) {
        const shelf = new THREE.Group();
        shelf.position.set(1.15, DESK_Y, -0.2);
        shelf.rotation.y = -0.55;
        const woodM = mat(0x241c18, { roughness: 0.7 });
        for (let r = 0; r < 3; r++) {
            const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.015, 0.14), woodM);
            board.position.set(0, r * 0.2, 0);
            board.receiveShadow = true;
            shelf.add(board);
            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.004, 0.004), glowMat(0xff4fd8, 1.6));
            strip.position.set(0, r * 0.2 + 0.006, 0.07);
            shelf.add(strip);
        }
        for (const x of [-0.25, 0.25]) {
            const side = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.58, 0.14), woodM);
            side.position.set(x, 0.29, 0);
            shelf.add(side);
        }
        this.shelf = shelf;
        S.add(shelf);
    }

    /** Lay the cartridges on the shelf: called with the mission list and the progress. */
    setCarts(missions, progress) {
        for (const m of missions) {
            const st = progress ? progress.missions[m.id].state : 'locked';
            const cart = progress ? progress.missions[m.id].cart : null;
            const key = `${st}|${cart ? cart.title + cart.label + (cart.sprites[cart.label] || '') : ''}`;
            let rec = this.cartMeshes[m.id];
            if (!rec) {
                const i = m.n - 1;
                const front = new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.15 });
                const shell = mat(0x1e1f26, { roughness: 0.5 });
                const mesh = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.15, 0.03, 2, 0.006), [shell, shell, shell, shell, front, shell]);
                mesh.position.set(-0.16 + (i % 3) * 0.16, (2 - Math.floor(i / 3)) * 0.2 + 0.083, 0.01);
                mesh.rotation.x = -0.08;
                mesh.castShadow = true;
                mesh.userData.mission = m.id;
                this.shelf.add(mesh);
                this.picks.push(mesh);
                const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.18), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                halo.position.z = -0.02;
                mesh.add(halo);
                rec = this.cartMeshes[m.id] = { mesh, front, halo, key: '' };
            }
            if (rec.key !== key) {
                rec.key = key;
                if (rec.front.map) rec.front.map.dispose();
                rec.front.map = labelTexture(m, st, cart);
                rec.front.emissiveMap = rec.front.map;
                rec.front.needsUpdate = true;
            }
            rec.state = st;
            rec.color = new THREE.Color(m.color);
        }
    }

    /** Which cartridge sits in the console (null for none). */
    setSlot(mission, cart) {
        this.slotMission = mission ? mission.id : null;
        if (!mission) { this.slotCart.visible = false; return; }
        this.slotCart.visible = true;
        const m = this.slotCart.material[4];
        if (m.map) m.map.dispose();
        m.map = labelTexture(mission, 'open', cart);
        m.needsUpdate = true;
    }

    buildRing(S) {
        const ring = new THREE.Group();
        ring.position.set(-0.05, DESK_Y + 0.02, 0.2);
        const n = 9;
        for (let i = 0; i < n; i++) {
            const arc = (Math.PI * 2) / n - 0.08;
            const geo = new THREE.TorusGeometry(0.36, 0.006, 6, 24, arc);
            const m = new THREE.MeshBasicMaterial({ color: 0x223040, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
            const seg = new THREE.Mesh(geo, m);
            seg.rotation.x = Math.PI / 2;
            seg.rotation.z = (i / n) * Math.PI * 2;
            ring.add(seg);
            this.ringSegs.push(seg);
        }
        this.ring = ring;
        S.add(ring);
    }
    setMemory(states) {
        // states: 'done' | 'open' | 'locked' per mission
        this.ringStates = states;
    }

    buildDust(S) {
        const n = this.quality >= 1 ? 260 : 80;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 3; pos[i * 3 + 1] = Math.random() * 2.6; pos[i * 3 + 2] = (Math.random() - 0.5) * 3; }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe6c0, size: 0.008, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
        S.add(this.dust);
    }

    buildBeam(S) {
        const g = new THREE.ConeGeometry(0.8, 2.0, 32, 1, true);
        const m = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { col: { value: new THREE.Color(0xffc890) } },
            vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
            fragmentShader: 'uniform vec3 col; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = clamp(abs(dot(vN, vV)), 0.0, 1.0); float a = clamp((1.0 - vY) * 0.5, 0.0, 1.0) * pow(f, 2.0) * 0.07; gl_FragColor = vec4(col * a, a); }',
        });
        const beam = new THREE.Mesh(g, m);
        beam.position.set(0.3, 1.7, 0.6 - 0.1);
        beam.rotation.z = 0.1;
        S.add(beam);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.12, 24, 1, true), mat(0x2a2d3a, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }));
        lamp.position.set(0.3, 2.72, 0.6);
        S.add(lamp);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), glowMat(0xffe0b0, 3));
        bulb.position.set(0.3, 2.68, 0.6);
        S.add(bulb);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 6), mat(0x050505));
        cord.position.set(0.3, 3.36, 0.6);
        S.add(cord);
    }

    // ------------------------------------------------------------------ the screen
    /** Copy a framebuffer to the television. pal: an array of [r, g, b]. */
    showFB(fb, pal) {
        V.toRGBA(fb, this.screenImg.data, pal);
        this.screenCtx.putImageData(this.screenImg, 0, 0);
        this.screenTex.needsUpdate = true;
        // the glow on the desk follows the picture
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < fb.length; i += 97) { const p = pal[fb[i]]; r += p[0]; g += p[1]; b += p[2]; }
        const n = Math.ceil(fb.length / 97) * 255;
        this.screenGlow.setRGB(r / n, g / n, b / n);
    }
    setScreen({ power, noise } = {}) {
        if (power !== undefined) this.crtPowerTarget = power;
        if (noise !== undefined) this.crtMat.uniforms.noise.value = noise;
    }
    setCRTAmount(a) { this.crtMat.uniforms.amount.value = a; }
    pulseScope(level) { this.scopeLevel = Math.min(1, this.scopeLevel + level); }

    // ------------------------------------------------------------------ the camera
    setInsets(ins) { this.insets = { ...this.insets, ...ins }; }
    setPose(name, instant = false) {
        if (this.pose === name && !instant) return;
        this.pose = name;
        this.camFrom = { pos: this.camPos.clone(), look: this.camLook.clone() };
        this.camT = instant ? 1 : 0;
    }
    poseTarget(name, t) {
        const look = new THREE.Vector3(), pos = new THREE.Vector3();
        const aspect = this.camera.aspect;
        if (name === 'title') {
            const a = 0.55 + Math.sin(t * 0.07) * 0.35;
            look.set(-0.05, DESK_Y + 0.3, -0.15);
            const d = aspect < 0.8 ? 3.0 : 2.0;
            pos.set(Math.sin(a) * d, DESK_Y + 0.55 + Math.sin(t * 0.11) * 0.06, Math.cos(a) * d - 0.1);
        } else if (name === 'crt') {
            // fit the screen into the part of the window the controls leave free
            const W = this.w, H = this.h, ins = this.insets;
            const freeW = Math.max(100, W - ins.left - ins.right), freeH = Math.max(100, H - ins.top - ins.bottom);
            const fov = (this.camera.fov * Math.PI) / 180;
            const needH = Math.max((SCREEN.h + 0.03) * (H / freeH), ((SCREEN.w + 0.03) / aspect) * (W / freeW));
            const d = needH / 2 / Math.tan(fov / 2);
            // shift the camera so the screen centres in the free area
            const worldPerPx = needH / H;
            const sx = ((ins.right - ins.left) / 2) * worldPerPx, sy = ((ins.top - ins.bottom) / 2) * worldPerPx;
            const c = SCREEN.center.clone().add(new THREE.Vector3(0, 0, 0.06));
            look.set(c.x + sx, c.y + sy, c.z);
            pos.set(c.x + sx, c.y + sy, c.z + d);
        } else if (name === 'shelf') {
            look.set(1.1, DESK_Y + 0.3, -0.25);
            pos.set(0.35, DESK_Y + 0.55, 0.85);
        } else if (name === 'bench') {
            look.set(-0.05, DESK_Y + 0.25, -0.1);
            pos.set(-0.05, DESK_Y + 0.75, 1.0);
        } else {
            // the lab: a three-quarter view of the desk with the shelf on the right
            look.set(0.18, DESK_Y + 0.24, -0.15);
            const d = aspect < 0.8 ? 2.9 : aspect < 1.2 ? 2.2 : 1.75;
            pos.set(0.55 + Math.sin(t * 0.13) * 0.04, DESK_Y + 0.62 + Math.sin(t * 0.17) * 0.02, d);
        }
        return { pos, look };
    }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        const dpr = Math.min(window.devicePixelRatio || 1, this.quality >= 2 ? 2 : 1.5);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);           // also sets the canvas CSS size in px (no 100vh trap)
        this.composer.setPixelRatio(dpr);
        this.composer.setSize(w, h);
        this.bloom.resolution.set(Math.round(w * 0.5), Math.round(h * 0.5));
        this.camera.aspect = w / h;
        this.camera.fov = w / h < 0.8 ? 52 : 42;
        this.camera.updateProjectionMatrix();
    }
    setQuality(q) {
        this.quality = q;
        this.bloom.enabled = q > 0;
        this.renderer.shadowMap.enabled = q >= 2;
        this.resize(true);
    }

    /** What a tap at client (x, y) lands on: { mission } or { act } or null. */
    pick(x, y) {
        const r = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, this.camera);
        const hit = ray.intersectObjects(this.picks, false)[0];
        if (!hit) return null;
        return hit.object.userData.mission ? { mission: hit.object.userData.mission } : { act: hit.object.userData.act };
    }

    // ------------------------------------------------------------------ the frame
    frame(dt, opts = {}) {
        this.time += dt;
        const t = this.time;
        this.resize();
        // camera glide
        const target = this.poseTarget(this.pose, t);
        if (this.camT < 1) {
            this.camT = Math.min(1, this.camT + dt / 0.9);
            const k = this.camT * this.camT * (3 - 2 * this.camT);
            this.camPos.lerpVectors(this.camFrom.pos, target.pos, k);
            this.camLook.lerpVectors(this.camFrom.look, target.look, k);
        } else { this.camPos.copy(target.pos); this.camLook.copy(target.look); }
        if (opts.parallax && this.pose !== 'crt') {
            this.camPos.x += opts.parallax.x * 0.06;
            this.camPos.y += opts.parallax.y * 0.04;
        }
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(this.camLook);

        // the tube warms up and cools down
        this.crtPower += (this.crtPowerTarget - this.crtPower) * Math.min(1, dt * (this.crtPowerTarget > this.crtPower ? 1.6 : 5));
        const u = this.crtMat.uniforms;
        u.time.value = t;
        u.power.value = this.crtPower;
        this.crtLight.color.copy(this.screenGlow).multiplyScalar(0.6).addScalar(0.05);
        this.crtLight.intensity = 0.3 + this.crtPower * 1.4;
        this.tvLed.material.color.setRGB(this.crtPower > 0.5 ? 0.2 : 3, this.crtPower > 0.5 ? 3 : 0.2, 0.2);

        // cartridges on the shelf: restored ones glow, the current one breathes
        for (const id in this.cartMeshes) {
            const rec = this.cartMeshes[id];
            const pulse = 0.5 + 0.5 * Math.sin(t * 3);
            rec.halo.material.color.copy(rec.state === 'done' ? rec.color : new THREE.Color(0xffb347));
            rec.halo.material.opacity = rec.state === 'done' ? 0.28 : rec.state === 'open' ? 0.15 + pulse * 0.35 : 0;
            rec.front.emissiveIntensity = rec.state === 'locked' ? 0.03 : rec.state === 'done' ? 0.35 : 0.2 + pulse * 0.15;
            rec.mesh.position.z = 0.01 + (opts.hover === id ? 0.03 : 0);
        }
        // memory ring
        this.ring.rotation.y = t * 0.15;
        this.ring.position.y = DESK_Y + 0.03 + Math.sin(t * 0.8) * 0.005;
        (this.ringStates || []).forEach((st, i) => {
            const m = this.ringSegs[i].material;
            if (st === 'done') { m.color.setRGB(0.4, 2.2, 1.4); m.opacity = 0.9; }
            else if (st === 'open') { const p = 0.5 + 0.5 * Math.sin(t * 4); m.color.setRGB(1.8 * p + 0.4, 1.1 * p + 0.2, 0.2); m.opacity = 0.8; }
            else { m.color.setRGB(0.1, 0.15, 0.25); m.opacity = 0.5; }
        });
        // dust and blinking lights
        const p = this.dust.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            let y = p.getY(i) + dt * 0.02;
            if (y > 2.6) y = 0;
            p.setY(i, y);
            p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.01);
        }
        p.needsUpdate = true;
        this.blinkers.forEach((b, i) => { b.visible = Math.sin(t * (1.3 + (i % 5) * 0.7) + i * 2.1) > -0.2; });
        // the joystick leans with the buttons
        const m = opts.buttons || 0;
        const tx = ((m & V.BTN.right) ? 1 : 0) - ((m & V.BTN.left) ? 1 : 0), tz = ((m & V.BTN.down) ? 1 : 0) - ((m & V.BTN.up) ? 1 : 0);
        this.stick.rotation.z += (-tx * 0.4 - this.stick.rotation.z) * Math.min(1, dt * 20);
        this.stick.rotation.x += (tz * 0.4 - this.stick.rotation.x) * Math.min(1, dt * 20);
        this.knob.position.set(0.01 + Math.sin(-this.stick.rotation.z) * 0.04, 0.115, 0.01 + Math.sin(this.stick.rotation.x) * 0.04);
        this.drawScope(dt);
        this.powerLed.material.color.setRGB(0.3, 3.5 * (0.6 + 0.4 * this.crtPower), 0.6);

        if (this.bloom.enabled) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    }

    drawScope(dt) {
        const g = this.scopeCtx;
        this.scopeLevel = Math.max(0, this.scopeLevel - dt * 1.5);
        g.fillStyle = '#021208'; g.fillRect(0, 0, 128, 80);
        g.strokeStyle = 'rgba(80,255,140,0.18)'; g.lineWidth = 1;
        for (let x = 16; x < 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 80); g.stroke(); }
        for (let y = 16; y < 80; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
        g.strokeStyle = '#7dffb0'; g.lineWidth = 2; g.shadowColor = '#7dffb0'; g.shadowBlur = 6;
        g.beginPath();
        const a = 4 + this.scopeLevel * 28;
        for (let x = 0; x <= 128; x += 2) {
            const y = 40 + Math.sin(x * 0.16 + this.time * 12) * a * (0.6 + 0.4 * Math.sin(x * 0.03 + this.time));
            if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
        g.shadowBlur = 0;
        this.scopeTex.needsUpdate = true;
    }
}
