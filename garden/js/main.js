// The Garden of Games: boots the island, runs the loop and wires input,
// picking, audio and the UI together.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import games from '../../js/gamedata.js';
import { buildLayout, projectOnPath, samplePath, PLAZA_R, PATH_HALF, GATE_S, PAVILION_PLAZA } from './layout.js';
import { Island } from './terrain.js';
import { setTextureQuality } from './textures.js';
import { makeMaterials } from './materials.js';
import { Sky } from './sky.js';
import { Weather, WEATHER } from './weather.js';
import { Water } from './water.js';
import { buildArchitecture } from './architecture.js';
import { buildPaths } from './paths.js';
import { buildStatues, hoverUniforms, STATUE_TOP } from './statues.js';
import { buildVegetation, updateGrass, windUniforms } from './vegetation.js';
import { Vines, sparkleVine } from './vines.js';
import { Particles, Bursts } from './particles.js';
import { Hologram } from './hologram.js';
import { Controls } from './controls.js';
import { AudioEngine } from './music.js';
import { UI } from './ui.js';
import { IslandMap } from './map.js';
import { nextFrame, store, smoothstep, lerp, damp } from './util.js';
import { FoxVisitor } from './fox.js';
import { Works } from './works.js';
import { Hut, buildHutExterior } from './hut.js';
import { Galaxy } from './galaxy.js';
import { Subway } from './subway.js';
import { Boat } from './boat.js';
import { Fishing } from './fishing.js';
import { Fireworks, SHOW_DIST } from './fireworks.js';
import { Cinderpeak } from './cinderpeak.js';
import { Mine } from './mine.js';
import { MineAudio } from './mine-audio.js';
import { END_S } from './minepath.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ---------------------------------------------------------------- quality

function pickQuality() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(innerWidth, innerHeight) < 700;
    let tier = params.get('q') || (store.get('lowGfx', false) ? 'low' : coarse && small ? 'low' : coarse ? 'medium' : 'high');
    const Q = {
        high: { shadows: 2048, shadowBox: 42, waterStep: 1.0, waterSegs: 256, treeTries: 9000, rockTries: 5000, grassDensity: 2.0, bladesPerClump: 6, grassFade: 40, flowerScale: 1, wildflowers: 2600, motes: 5, fireflies: 260, plaqueCell: 512, tex: 512, bloom: true, maxPR: 2, terrainRes: 0.8, lights: 6, samples: 4 },
        medium: { shadows: 1536, shadowBox: 36, waterStep: 1.4, waterSegs: 192, treeTries: 8000, rockTries: 4000, grassDensity: 1.3, bladesPerClump: 5, grassFade: 36, flowerScale: 0.8, wildflowers: 1600, motes: 3, fireflies: 170, plaqueCell: 512, tex: 512, bloom: true, maxPR: 1.5, terrainRes: 0.9, lights: 4, samples: 2 },
        low: { shadows: 1024, shadowBox: 30, waterStep: 2.0, waterSegs: 128, treeTries: 6000, rockTries: 3000, grassDensity: 0.7, bladesPerClump: 4, grassFade: 26, flowerScale: 0.6, wildflowers: 800, motes: 2, fireflies: 90, plaqueCell: 256, tex: 256, bloom: false, maxPR: 1.5, terrainRes: 1.1, lights: 2, samples: 0 },
    };
    if (!Q[tier]) tier = 'high';
    const q = { tier, ...Q[tier] };
    // ?pr=0.5 pins the pixel ratio (handy for software-GL test runs)
    if (params.has('pr')) q.fixedPR = Number(params.get('pr'));
    // ?bloom=0 and ?samples=0 switch a single post-processing feature off (to bisect render bugs)
    if (params.has('bloom')) q.bloom = params.get('bloom') !== '0';
    if (params.has('samples')) q.samples = Number(params.get('samples'));
    return q;
}

// ---------------------------------------------------------------- world

function makeWorld(layout, island, quality) {
    const w = {
        layout, island, quality, root: new THREE.Group(),
        colliders: [], floors: [], boxFloors: [], spans: [], vines: [], lampSpots: [], updaters: [], glowMats: [], nightSigns: [],
        flowerBeds: [], hedges: [], cypress: [], topiary: [], windows: [], runes: [], altars: [], beacons: [], fountains: [],
        landmarks: [], petalSources: [], sparkSources: [], statues: [], statueGlows: [],
    };
    w.groundAt = (x, z) => island.heightAt(x, z);
    // decks along a straight line, like the bridge: { ax, az, bx, bz, half, heightAt(t) }
    w.spanAt = (x, z) => {
        for (const s of w.spans) {
            const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz;
            const t = ((x - s.ax) * dx + (z - s.az) * dz) / l2;
            if (t < 0 || t > 1) continue;
            if (Math.abs((x - s.ax) * dz - (z - s.az) * dx) / Math.sqrt(l2) <= s.half) return s.heightAt(t);
        }
        return -Infinity;
    };
    w.onDeck = (x, z) => w.boxFloors.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) || w.spanAt(x, z) > -Infinity;
    w.walkHeight = (x, z) => {
        let h = Math.max(island.heightAt(x, z), w.spanAt(x, z));
        for (const f of w.floors) if (!f.block && (x - f.x) ** 2 + (z - f.z) ** 2 < f.r * f.r && f.y > h) h = f.y;
        for (const b of w.boxFloors) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y > h) h = b.y;
        return h;
    };
    w.inPlaza = (x, z) => {
        for (const sp of layout.spokes) if (Math.hypot(x - sp.pavilion.x, z - sp.pavilion.z) < PAVILION_PLAZA + 0.4) return true;
        for (const f of layout.features) if (f.type === 'fountain' && Math.hypot(x - f.x, z - f.z) < 6.6) return true;
        return w.spanAt(x, z) > -Infinity;
    };
    const CELL = 4;
    w.finalize = () => {
        w.grid = new Map();
        for (const c of w.colliders) {
            const i0 = Math.floor((c.x - c.r) / CELL), i1 = Math.floor((c.x + c.r) / CELL);
            const j0 = Math.floor((c.z - c.r) / CELL), j1 = Math.floor((c.z + c.r) / CELL);
            for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
                const k = i * 7919 + j;
                if (!w.grid.has(k)) w.grid.set(k, []);
                w.grid.get(k).push(c);
            }
        }
    };
    const empty = [];
    w.collidersNear = (x, z) => w.grid?.get(Math.floor(x / CELL) * 7919 + Math.floor(z / CELL)) || empty;
    return w;
}

function lighthouseBeams(world, scene) {
    const mat = new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform float uOpacity; varying vec2 vUv; void main(){ float a = pow(vUv.y, 2.0) * uOpacity * 0.35; gl_FragColor = vec4(vec3(1.0, 0.85, 0.55) * a, 1.0); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const beams = world.beacons.map((b) => {
        const g = new THREE.Group();
        g.position.set(b.x, b.y, b.z);
        for (const s of [0, Math.PI]) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(4, 46, 24, 1, true).translate(0, -23, 0).rotateZ(Math.PI / 2), mat);
            cone.rotation.y = s;
            g.add(cone);
        }
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd890 }));
        g.add(lamp);
        scene.add(g);
        return { g, lamp };
    });
    return (dt, night) => {
        mat.uniforms.uOpacity.value = night;
        for (const b of beams) {
            b.g.rotation.y += dt * 0.5;
            b.g.children.forEach((c) => (c.visible = night > 0.05));
            b.lamp.visible = true;
            b.lamp.material.color.setScalar(0.4 + night * 2.5).multiply(new THREE.Color(0xffd890));
        }
    };
}

// ---------------------------------------------------------------- picking

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function rayCylinder(o, d, cx, cz, r, y0, y1) {
    const ox = o.x - cx, oz = o.z - cz;
    const a = d.x * d.x + d.z * d.z;
    const b = 2 * (ox * d.x + oz * d.z);
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0 || a < 1e-8) return Infinity;
    const sq = Math.sqrt(disc);
    for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        if (t <= 0) continue;
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) return t;
    }
    return Infinity;
}

function marchGround(world, o, d, maxT) {
    let prev = 0;
    for (let t = 0.5; t < maxT; t += t < 20 ? 0.35 : 0.8) {
        const x = o.x + d.x * t, z = o.z + d.z * t;
        const y = o.y + d.y * t;
        if (y < world.walkHeight(x, z) || y < 0) {
            // refine
            let lo = prev, hi = t;
            for (let i = 0; i < 8; i++) {
                const m = (lo + hi) / 2;
                const mx = o.x + d.x * m, mz = o.z + d.z * m;
                if (o.y + d.y * m < Math.max(world.walkHeight(mx, mz), 0)) hi = m;
                else lo = m;
            }
            return hi;
        }
        prev = t;
    }
    return Infinity;
}

// ---------------------------------------------------------------- boot

async function boot() {
    const ui = new UI(games);
    const canvas = document.getElementById('scene');
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 required');
    } catch (e) {
        console.warn(e);
        ui.noWebGL();
        return;
    }
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    const quality = pickQuality();
    let pixelRatio = quality.fixedPR || Math.min(devicePixelRatio || 1, quality.maxPR);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = quality.shadows > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setTextureQuality(quality.tex, Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 3000);
    camera.position.set(0, 40, 120);

    ui.progress(0.05, 'Laying out the paths…');
    await nextFrame();
    const layout = buildLayout(games);
    ui.progress(0.1, 'Raising the island…');
    await nextFrame();
    const island = new Island(layout, quality.terrainRes);
    const world = makeWorld(layout, island, quality);
    world.ui = ui;
    scene.add(world.root);

    ui.progress(0.3, 'Quarrying marble…');
    await nextFrame();
    world.mats = makeMaterials();
    const sky = new Sky(scene, renderer, quality);
    world.sky = sky;
    sky.setTime(params.has('t') ? Number(params.get('t')) : 0.33);
    const terrain = island.buildMesh();
    scene.add(terrain);
    ui.progress(0.4, 'Filling the sea…');
    await nextFrame();
    const water = new Water(scene, island, sky, quality);

    ui.progress(0.48, 'Raising pavilions…');
    await nextFrame();
    buildArchitecture(world);
    world.hut = buildHutExterior(world);
    ui.progress(0.52, 'Smoking out a volcano…');
    await nextFrame();
    const volcano = new Cinderpeak({ world, scene, sky, quality, water });
    // the mountain coughs after dark; the sound reaches you late, by its distance
    volcano.mountain.onErupt = (delay, strength, dist) => window.setTimeout(() => audio.volcanoRumble({ near: Math.max(0.06, 1 - dist / 1800), size: strength }), Math.max(0, delay * 1000 - 200));
    buildPaths(world);
    ui.progress(0.58, 'Carving statues…');
    await nextFrame();
    const statues = buildStatues(world);
    const statueByGame = new Map(statues.map((s) => [s.game, s]));
    ui.progress(0.7, 'Planting the gardens…');
    await nextFrame();
    buildVegetation(world);
    ui.progress(0.86, 'Coaxing the vines…');
    await nextFrame();
    const vines = new Vines(world);
    const audio = new AudioEngine();
    const weather = new Weather(scene, sky, audio, quality);
    if (WEATHER[params.get('w')]) {
        weather.set(params.get('w'));
        Object.assign(weather.v, weather.target);
        weather.auto = false;
    } else weather.rollFirst();
    const hologram = new Hologram(world, games);
    const particles = new Particles(world);
    particles.build();
    const bursts = new Bursts(world);
    const beams = lighthouseBeams(world, scene);
    world.finalize();

    // lamp light pool
    const lampLights = [];
    for (let i = 0; i < quality.lights; i++) {
        const l = new THREE.PointLight(0xffb45a, 0, 13, 2);
        scene.add(l);
        lampLights.push(l);
    }
    let lampTimer = 1;

    // post-processing
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.samples });
    const composer = new EffectComposer(renderer, rt);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.5, 1.15);
    if (quality.bloom) composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // The galaxy is soft additive glow that gains nothing from MSAA, and multisampled half-float
    // targets render it near-black on some Intel/D3D11 drivers, so it is drawn without.
    const setMSAA = (on) => {
        const n = on ? quality.samples : 0;
        for (const t of [composer.renderTarget1, composer.renderTarget2]) {
            if (t.samples === n) continue;
            t.samples = n;
            t.dispose();
        }
    };

    const controls = new Controls(world, camera, canvas);
    world.controls = controls;
    // a fox spirit from Worldroot comes by on about one visit in five (?fox=1 always, ?fox=0 never)
    const fox = new FoxVisitor(scene, world, controls, camera, { force: params.get('fox') });
    const boat = new Boat(world, scene, camera, controls);
    const fishing = new Fishing({ world, scene, camera, controls, ui, audio, bursts, canvas });
    controls.canJump = () => !fishing.active && !ui.blocking && !boat.busy;
    // The title orbit circles the island looking in, so its show goes up over the island's heart. The flying
    // boat circles it too, turning from the bow to the island and back, so each shell goes up ahead of the rider's view.
    const islandHeart = new THREE.Vector3(), ahead = new THREE.Vector3();
    const fireworksAim = () => {
        if (!entered) return islandHeart;
        if (!boat.busy) return null;
        camera.getWorldDirection(ahead).setY(0).normalize();
        return ahead.multiplyScalar(SHOW_DIST).add(camera.position);
    };
    const fireworks = new Fireworks(world, camera, audio, { high: 4096, medium: 3072, low: 2048 }[quality.tier], fireworksAim);
    const map = new IslandMap(world, document.getElementById('map-canvas'));

    const resize = () => {
        const w = innerWidth, h = innerHeight;
        camera.aspect = w / h;
        camera.fov = w < h ? 72 : 62;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(w, h, false);
        composer.setPixelRatio(pixelRatio);
        composer.setSize(w, h);
    };
    // Resizing clears the canvas, so it must happen right before a render,
    // never after one — otherwise that frame is presented blank.
    let resizePending = false;
    addEventListener('resize', () => (resizePending = true));
    resize();

    ui.progress(0.94, 'Lighting the lamps…');
    await nextFrame();
    renderer.compile(scene, camera);
    ui.progress(1, 'Ready.');

    // ------------------------------------------------------------ state

    let entered = false;
    let intro = null; // fly-in transition
    let orbitA = -0.6;
    let muted = store.get('muted', false);
    audio.muted = muted;
    ui.sound(muted);
    let hovered = null;
    let lastHoverSound = 0;
    let mouse = null;
    let highlight = { id: -1, until: 0 };
    let zoneKey = '';
    const clock = new THREE.Clock();
    let elapsed = 0;
    let fireworksPending = params.has('fireworks');
    // the Works under the clock tower: built on the first visit
    let works = null;
    // the Hut by the dock and the galaxy in its sphere: both built on the first visit
    let hut = null, galaxy = null;
    // the Violet Line behind the ticket on the desk: built on the first ride
    let subway = null;
    let trip = null;       // falling into / climbing out of the sphere
    const look = { x: 0, y: 0 };
    let roomKind = null;   // which room 'below' means: 'works' | 'hut' | 'subway'
    let below = false;
    let transit = false;   // fading through a door
    let doorArmed = false; // you must step away from a door before it takes you again
    let worksHintShown = false, doorHintShown = false, hutHintShown = false, hutDoorHintShown = false, orbHintShown = false, boatHintShown = false;
    let boardPending = false; // walking to the dock edge to climb into the boat
    let fishPending = false;  // walking out along the pier to pick up the rod
    // Cinderpeak: the Standing Stones lead to its cove, a cart there rides into the mine, and a dais leads home
    let place = 'garden';     // 'garden' | 'cove' | 'mine'
    let mine = null, mineAudio = null;
    let portalArmed = false, portalPending = false, daisArmed = false, cartArmed = false, cartPending = false;
    let stonesHintShown = false, coveHintShown = false;
    const altar = world.altars[0] ?? null;
    const stones = world.landmarks.find((l) => l.name === 'The Standing Stones') ?? null;
    /** A way into the ring of stones: the gap nearest the hub, and the spot just inside it. */
    const stonesStand = (() => {
        if (!altar || !stones) return null;
        const toHub = Math.atan2(-altar.x, -altar.z);
        let best = null;
        for (let k = 0; k < 9; k++) {
            const a = ((k + 0.5) / 9) * Math.PI * 2;
            const d = Math.abs(Math.atan2(Math.sin(a - toHub), Math.cos(a - toHub)));
            if (!best || d < best.d) best = { a, d };
        }
        const out = { x: altar.x + Math.sin(best.a) * 6.8, z: altar.z + Math.cos(best.a) * 6.8 };
        const inner = { x: altar.x + Math.sin(best.a) * 2.3, z: altar.z + Math.cos(best.a) * 2.3 };
        return { ...out, inner, yaw: Math.atan2(-(altar.x - out.x), -(altar.z - out.z)) };
    })();
    const mineDrives = () => !!mine && (mine.state === 'boarding' || mine.state === 'riding' || mine.state === 'exiting');

    const setHover = (h) => {
        const prevId = hovered?.statue?.id ?? -2;
        hovered = h;
        const id = h?.statue?.id ?? -1;
        if (id >= 0 && id !== prevId && performance.now() - lastHoverSound > 250) {
            audio.hover();
            lastHoverSound = performance.now();
        }
        for (const k of ['prev', 'next']) hologram.arrows[k].userData.hover = h?.type === 'arrow' && h.key === k;
        hologram.hover = h?.type === 'panel' ? 1 : 0;
        document.body.classList.toggle('can-hover-pick', !!h && h.type !== 'ground');
    };

    function pick(cx, cy) {
        ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const o = ray.ray.origin, d = ray.ray.direction;
        if (place === 'cove') return volcano.pick(ray);
        let best = null, bt = Infinity;
        // the swirling motes over the Standing Stones' altar
        if (altar) {
            const t = rayCylinder(o, d, altar.x, altar.z, 1.7, altar.y - 0.2, altar.y + 5);
            if (t < 90) {
                bt = t;
                best = { type: 'portal', t };
            }
        }
        for (const st of statues) {
            const t = rayCylinder(o, d, st.x, st.z, 0.9, st.y, st.y + STATUE_TOP);
            if (t < bt && t < 70) {
                bt = t;
                best = { type: 'statue', statue: st, t };
            }
        }
        const hits = ray.intersectObjects(hologram.pickables, false);
        if (hits.length && hits[0].distance < bt && hits[0].distance < 60) {
            const obj = hits[0].object;
            bt = hits[0].distance;
            best = obj.userData.kind === 'arrow' ? { type: 'arrow', dir: obj.userData.dir, key: obj.userData.dir > 0 ? 'next' : 'prev', t: bt } : { type: 'panel', t: bt };
        }
        const bt0 = ray.intersectObject(boat.group, true)[0];
        if (bt0 && bt0.distance < bt && bt0.distance < 60) {
            bt = bt0.distance;
            best = { type: 'boat', t: bt };
        }
        const rod = ray.intersectObjects(fishing.pickables, false)[0];
        if (rod && rod.distance < bt && rod.distance < 60) {
            bt = rod.distance;
            best = { type: 'rod', t: bt };
        }
        const door = ray.intersectObject(world.clockDoor.mesh, false)[0];
        if (door && door.distance < bt && door.distance < 60) {
            bt = door.distance;
            best = { type: 'door', t: bt };
        }
        const hd = world.hut && ray.intersectObject(world.hut.mesh, false)[0];
        if (hd && hd.distance < bt && hd.distance < 60) {
            bt = hd.distance;
            best = { type: 'hutDoor', t: bt };
        }
        const tg = marchGround(world, o, d, Math.min(bt, 120));
        if (tg < bt) {
            const p = o.clone().addScaledVector(d, tg);
            return { type: 'ground', point: p, t: tg };
        }
        return best;
    }

    // ------------------------------------------------------------ actions

    const standForStatue = (st) => controls.standFor(st);

    /** Somewhere dry and clear to stand near (x, z), searching outward and favouring the hub side. */
    function standNear(x, z) {
        const free = (px, pz) => {
            if (!world.onDeck(px, pz) && island.heightAt(px, pz) < 0.6) return false;
            return !world.collidersNear(px, pz).some((c) => Math.hypot(px - c.x, pz - c.z) < c.r + 0.5);
        };
        const toHub = Math.atan2(-x, -z);
        for (let d = 8; d < 40; d += 1.5) {
            for (let k = 0; k < 16; k++) {
                const a = toHub + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
                const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
                if (free(px, pz)) return { x: px, z: pz };
            }
        }
        return layout.spawn;
    }

    /** The linking flash and chord that accompany opening a game. */
    function play() {
        audio.link();
        ui.flash(true);
        setTimeout(() => ui.flash(false), 450);
    }

    function openGame(game) {
        // a real new tab, opened inside the click so popup blockers allow it
        window.open(`${game.folder}/index.html`, '_blank', 'noopener');
        play();
    }

    function linkTo(x, z, yaw, after) {
        fishing.stop();
        fishPending = false;
        audio.link();
        ui.flash(true);
        controls.route = null;
        setTimeout(() => {
            if (place !== 'garden') abortCinder();
            else if (below) surface();
            controls.teleport(x, z, yaw);
            setTimeout(() => ui.flash(false), 120);
            after?.();
        }, 650);
    }

    // ------------------------------------------------------------ Cinderpeak

    const duckMusic = (on) => {
        if (!audio.ctx || !audio.music) return;
        audio.music.gain.setTargetAtTime(audio.musicVol * (on ? 0.1 : 1), audio.ctx.currentTime, 0.6);
    };

    const ZONES = {
        gallery: ['The Old Gallery', 'Timber, lantern-light and hot stone', '#ffb060'],
        crossing: ['The Molten River', 'Hold on to your hat', '#ff6a2a'],
        descent: ['The Spiral Drop', 'Down and round and down', '#ff7a3a'],
        tube: ['The Lava Tube', 'Keep your hands in the cart', '#ff5a20'],
        hairpin: ['The Switchback', '', '#ffa050'],
        rift: ['The Rift', 'Don’t look down. Or do.', '#ff6a2a'],
        quiet: ['The Quiet Seam', 'Something glitters ahead', '#b79bff'],
        gems: ['The Glittering Deep', 'Every wall a jewel box', '#8ff6ff'],
        passage: ['The Heat Passage', '', '#ff8a3a'],
        approach: ['The Heat Passage', 'The glare ahead is the lava source', '#ff7a2a'],
        source: ['The Heartfire', 'The lava source of Cinderpeak', '#ff6a2a'],
    };

    /** The mine is built once, under the white flash of the first arrival, and wired to the host here. */
    function prepareMine() {
        if (mine) return true;
        try {
            mine = new Mine({ renderer, ui, mats: world.mats, audio, quality, cart: volcano.cart });
        } catch (e) {
            console.error(e);
            mine = null;
            return false;
        }
        mine.onEvent = (name, data) => {
            if (name === 'board') {
                mineAudio ??= new MineAudio(audio);
                mineAudio.start();
                duckMusic(true);
                mineAudio.clang(2);
            } else if (name === 'roll') {
                if (data.dir > 0) ui.hint('Hold on · drag to look around', 7000);
            } else if (name === 'enter') {
                ui.fadeBlack(true);
                setTimeout(() => {
                    mine.scene.add(mine.cart.group);
                    setBelow(true, 'mine');
                    place = 'mine';
                    ui.fadeBlack(false);
                }, 300);
            } else if (name === 'leave') {
                ui.fadeBlack(true);
                setTimeout(() => {
                    world.root.add(mine.cart.group);
                    setBelow(false);
                    place = 'cove';
                    controls.world = volcano.world;
                    ui.fadeBlack(false);
                }, 300);
            } else if (name === 'zone') {
                const z = ZONES[data.id];
                if (z && z[0]) ui.zone(z[0], z[1], z[2]);
            } else if (name === 'ledge') {
                mineAudio?.brake(1);
                setTimeout(() => {
                    const sp = mine.ledgeSpawn();
                    mine.stepOut(camera, new THREE.Vector3(sp.x, mine.ledgeY() + 1.65, sp.z), sp.yaw, () => {
                        controls.seated = false;
                        controls.world = mine.walk;
                        controls.teleport(sp.x, sp.z, sp.yaw);
                        cartArmed = false;
                        ui.hint('The Heartfire · walk to the rail and look down · step back into the cart to ride home', 12000);
                    });
                }, 900);
            } else if (name === 'station') {
                mineAudio?.brake(1);
                setTimeout(() => {
                    const ps = volcano.platformStand;
                    mine.stepOut(camera, new THREE.Vector3(ps.x, volcano.world.walkHeight(ps.x, ps.z) + 1.65, ps.z), ps.yaw, () => {
                        controls.seated = false;
                        controls.world = volcano.world;
                        controls.teleport(ps.x, ps.z, ps.yaw);
                        mine.parkCart();
                        mineAudio?.stop();
                        duckMusic(false);
                        cartArmed = false;
                        daisArmed = false;
                        ui.hint('Back at the station · the dais by the water takes you home', 9000);
                    });
                }, 900);
            }
        };
        return true;
    }

    /** Step into the swirling motes: a flash, and the Cinderpeak cove with its dais under your feet. */
    function travelToCove() {
        if (transit || place !== 'garden' || trip || boat.busy) return;
        transit = true;
        portalPending = false;
        fishing.stop();
        fishPending = false;
        boardPending = false;
        controls.route = null;
        controls.keys.clear();
        controls.vel.set(0, 0);
        setHover(null);
        ui.tooltip(null);
        ui.closeAll();
        audio.link();
        audio.sparkle();
        ui.flash(true);
        setTimeout(() => {
            const ok = prepareMine();
            place = 'cove';
            controls.world = volcano.world;
            const sp = volcano.spawn;
            controls.teleport(sp.x, sp.z, sp.yaw);
            camera.fov = baseFov();
            daisArmed = false;
            cartArmed = false;
            zoneKey = 'cove';
            ui.zone('Cinderpeak Cove', ok ? 'A cart waits at the mine' : 'The mine is closed today', '#ff9a4a');
            if (!coveHintShown) {
                coveHintShown = true;
                setTimeout(() => ui.hint('Climb into the cart by the mine entrance · the dais you arrived on leads home · turn around to see the sea', 11000), 1800);
            }
            setTimeout(() => {
                ui.flash(false);
                transit = false;
            }, 250);
        }, 700);
    }

    /** Leave Cinderpeak at once, whatever is going on there (the caller covers the cut). */
    function abortCinder() {
        if (mine) {
            world.root.add(mine.cart.group);
            if (mine.state !== 'idle') mine.parkCart();
        }
        mineAudio?.stop();
        duckMusic(false);
        controls.seated = false;
        cartPending = false;
        if (below) setBelow(false);
        // the mine is big on the GPU; phones in particular can lose layers (the HUD) if it lingers, so it is rebuilt next visit
        if (mine) {
            const m = mine;
            mine = null;
            m.onEvent = null;
            m.dispose();
        }
        document.getElementById('hud').hidden = false;
        document.getElementById('fade').classList.remove('on', 'dark');
        place = 'garden';
        controls.world = world;
        camera.fov = baseFov();
        camera.updateProjectionMatrix();
        zoneKey = '';
    }

    /** The dais: a flash, and back among the Standing Stones. */
    function travelToGarden(instant = false) {
        if (place === 'garden') return;
        if (transit && !instant) return;
        transit = true;
        controls.route = null;
        controls.keys.clear();
        controls.vel.set(0, 0);
        audio.link();
        ui.flash(true);
        const land = () => {
            abortCinder();
            if (stonesStand) controls.teleport(stonesStand.x, stonesStand.z, stonesStand.yaw);
            portalArmed = false;
            ui.hint('Back among the Standing Stones', 5000);
            setTimeout(() => {
                ui.flash(false);
                transit = false;
            }, 200);
        };
        setTimeout(land, 650);
    }

    /** Climb into the cart: at the station it rolls in, on the cliff it rolls home. */
    function boardCart(dir) {
        if (!mine || mine.state === 'boarding' || mine.state === 'riding' || mine.state === 'exiting' || transit) return;
        controls.route = null;
        controls.keys.clear();
        controls.vel.set(0, 0);
        controls.seated = true;
        cartPending = false;
        setHover(null);
        ui.tooltip(null);
        ui.closeAll();
        mine.begin(camera, controls, dir);
    }

    /** Frame by frame: walking into the motes, onto the dais, or up to the cart. */
    function cinderCheck() {
        if (transit || !controls.enabled || trip || controls.seated) return;
        const p = controls.pos;
        if (place === 'garden') {
            if (!altar) return;
            const d = Math.hypot(p.x - altar.x, p.z - altar.z);
            if (d > 4.5) portalArmed = true;
            if (portalArmed && d < 2.6) travelToCove();
            else if (!stonesHintShown && d < 16 && !below && !boat.busy) {
                stonesHintShown = true;
                ui.hint('The motes over the stones are humming · click them, or walk into them', 9000);
            }
        } else if (place === 'cove') {
            const dd = volcano.dais;
            const d = Math.hypot(p.x - dd.x, p.z - dd.z);
            if (d > 4.5) daisArmed = true;
            if (daisArmed && d < dd.trigger) return travelToGarden();
            const cp = volcano.cartPos;
            const dc = Math.hypot(p.x - cp.x, p.z - cp.z);
            if (dc > 4.5) cartArmed = true;
            if (cartArmed && dc < 1.95) {
                if (!mine) prepareMine();
                if (mine) boardCart(1);
            }
        } else if (place === 'mine' && mine?.state === 'free') {
            const cp = mine.cart.group.position;
            const dc = Math.hypot(p.x - cp.x, p.z - cp.z);
            if (dc > 4.5) cartArmed = true;
            if (cartArmed && dc < 1.95) boardCart(-1);
        }
    }

    function linkToGame(game) {
        const st = statueByGame.get(game);
        const s = standForStatue(st);
        ui.closeAll();
        linkTo(s.x, s.z, s.yaw, () => (highlight = { id: st.id, until: performance.now() + 4000, accent: st.genre.accent }));
    }

    function walkToGame(game) {
        if (below || place !== 'garden') return linkToGame(game);
        fishing.stop();
        const st = statueByGame.get(game);
        const s = standForStatue(st);
        ui.closeAll();
        const route = controls.plan(s.x, s.z);
        controls.walkTo(route, s.yaw);
        controls.route.statue = st;
        controls.route.run = route.length > 14;
        ui.hint(`Walking to ${game.title}…`, 3500);
    }

    // ------------------------------------------------------------ the sphere

    const baseFov = () => (innerWidth < innerHeight ? 72 : 62);
    const FALL = 2.1;

    /** Click the sphere: fall into it, and out the other side into its galaxy. */
    function startTrip() {
        if (trip || transit || roomKind !== 'hut') return;
        galaxy ??= new Galaxy();
        controls.enabled = false;
        controls.route = null;
        controls.keys.clear();
        controls.vel.set(0, 0);
        setHover(null);
        ui.tooltip(null);
        look.x = look.y = 0;
        trip = { phase: 'fall', t: 0, age: 0, from: camera.position.clone(), fromQ: camera.quaternion.clone(), flashed: false };
        audio.sparkle();
    }

    /** Leave the galaxy: a flash, then back at the desk with the sphere in front of you. */
    function leaveTrip() {
        if (!trip || trip.phase !== 'in' || trip.age < 0.9) return;
        trip.phase = 'out';
        audio.link();
        ui.flash(true);
        setTimeout(() => {
            if (!trip) return;
            renderPass.scene = hut.scene;
            setMSAA(true);
            const d = hut.deskStand;
            controls.teleport(d.x, d.z, d.yaw);
            controls.pitch = d.pitch;
            endTrip();
            setTimeout(() => ui.flash(false), 150);
        }, 650);
    }

    function endTrip() {
        trip = null;
        camera.fov = baseFov();
        camera.updateProjectionMatrix();
        controls.enabled = true;
    }

    const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
    function tripUpdate(dt) {
        if (trip.phase === 'fall') {
            trip.t += dt;
            const k = Math.min(1, trip.t / FALL);
            const e = k * k * (1.4 - 0.4 * k);   // slow start, quick finish
            tmpV.copy(trip.from).lerp(hut.orbPos, e);
            camera.position.copy(tmpV);
            // turn to face the sphere early, then keep it dead ahead
            tmpQ.setFromRotationMatrix(tmpM.lookAt(trip.from, hut.orbPos, camera.up));
            camera.quaternion.copy(trip.fromQ).slerp(tmpQ, smoothstep(0, 0.45, k));
            camera.fov = baseFov() + smoothstep(0.5, 1, k) * 70;
            camera.updateProjectionMatrix();
            if (!trip.flashed && k > 0.8) {
                trip.flashed = true;
                ui.flash(true);
            }
            if (k >= 1) {
                renderPass.scene = galaxy.scene;
                setMSAA(false);
                camera.fov = 68;
                camera.updateProjectionMatrix();
                galaxy.update(0, camera, look, renderer.domElement.height, 0);
                trip.phase = 'in';
                trip.age = 0;
                setTimeout(() => ui.flash(false), 120);
                ui.hint('Click or press Esc to return to the hut', 7000);
            }
        } else {
            trip.age += dt;
            galaxy.update(dt, camera, look, renderer.domElement.height, trip.age);
        }
    }

    addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && trip) leaveTrip();
    });
    canvas.addEventListener('pointerup', () => leaveTrip());
    canvas.addEventListener('pointermove', (e) => {
        look.x = (e.clientX / innerWidth) * 2 - 1;
        look.y = (e.clientY / innerHeight) * 2 - 1;
    });

    // ------------------------------------------------------------ the Violet Line

    /** Click the ticket: a flash, and you are on the platform at Hearthside station. */
    function startSubway() {
        if (transit || trip || roomKind !== 'hut') return;
        transit = true;
        controls.route = null;
        controls.keys.clear();
        controls.vel.set(0, 0);
        setHover(null);
        ui.tooltip(null);
        audio.sparkle();
        ui.flash(true);
        setTimeout(() => {
            try {
                subway ??= new Subway({ renderer, ui, mats: world.mats, audio, quality });
                setBelow(true, 'subway');
                const s = subway.spawn;
                controls.teleport(s.x, s.z, s.yaw);
                subway.enter(camera);
            } catch (e) {
                console.error(e);
                ui.hint('The ticket crumbles in your hand.', 4000);
            }
            setTimeout(() => {
                ui.flash(false);
                transit = false;
            }, 250);
        }, 700);
    }

    /** Up the stair and through the wooden door: back in the hut. */
    function leaveSubway() {
        if (transit || roomKind !== 'subway') return;
        transit = true;
        controls.route = null;
        audio.door();
        ui.flash(true);
        setTimeout(() => {
            setBelow(true, 'hut');
            const s = hut.spawn;
            controls.teleport(s.x, s.z, s.yaw);
            ui.zone('The Hut', 'A sphere glows on the desk', '#c9a7ff');
            zoneKey = 'hut';
            setTimeout(() => {
                ui.flash(false);
                transit = false;
            }, 150);
        }, 650);
    }

    // ------------------------------------------------------------ the Works

    function setBelow(on, kind = 'works') {
        if (roomKind === 'subway' && (!on || kind !== 'subway')) subway.leave();
        below = on;
        roomKind = on ? kind : null;
        const room = kind === 'hut' ? hut : kind === 'subway' ? subway : kind === 'mine' ? mine : works;
        controls.world = on ? (kind === 'mine' ? mine.walk : room.world) : place === 'cove' ? volcano.world : world;
        renderPass.scene = on ? room.scene : scene;
        bloom.strength = on ? (kind === 'hut' ? 0.55 : kind === 'subway' ? 0.5 : kind === 'mine' ? 0.7 : 0.6) : 0.42;
        audio.setUnderground(on && (kind === 'works' || kind === 'mine'), kind === 'works');
        if (on) fireworks.stop();
        doorArmed = false;
        mouse = null;
        setHover(null);
        ui.tooltip(null);
    }

    /** Back to the garden at once (the caller covers it with a flash). */
    function surface() {
        if (trip) endTrip();
        setMSAA(true);
        setBelow(false);
        zoneKey = '';
    }

    function throughDoor(down, kind = 'works') {
        if (transit) return;
        const leaving = roomKind;
        transit = true;
        controls.route = null;
        audio.door();
        ui.flash(true);
        setTimeout(() => {
            if (down && kind === 'hut') {
                hut ??= new Hut({ renderer, ui, mats: world.mats });
                setBelow(true, 'hut');
                const s = hut.spawn;
                controls.teleport(s.x, s.z, s.yaw);
                ui.zone('The Hut', 'A sphere glows on the desk', '#c9a7ff');
                zoneKey = 'hut';
                if (!hutHintShown) {
                    hutHintShown = true;
                    setTimeout(() => ui.hint('Click the glowing sphere on the desk · walk back into the door to leave', 9000), 1200);
                }
            } else if (down) {
                works ??= new Works({ renderer, games, sky, island, layout, statues, ui, mats: world.mats });
                setBelow(true);
                const s = works.spawn;
                controls.teleport(s.x, s.z, s.yaw);
                ui.zone('The Works', 'Beneath the Clock Tower', '#ffb45a');
                zoneKey = 'works';
                if (!worksHintShown) {
                    worksHintShown = true;
                    setTimeout(() => ui.hint('The screens show the garden’s own code, its games and models from them · walk back into the stair door to climb out', 9000), 1200);
                }
            } else {
                surface();
                const o = leaving === 'hut' ? world.hut.out : world.clockDoor.out;
                controls.teleport(o.x, o.z, o.yaw);
            }
            setTimeout(() => {
                ui.flash(false);
                transit = false;
            }, 150);
        }, 650);
    }

    /** Walking into a door's spot goes through it. */
    function doorCheck() {
        if (transit || !controls.enabled) return;
        if (trip) return;
        const p = controls.pos;
        if (below && roomKind === 'subway') {
            const e = subway.exit, dist = Math.hypot(p.x - e.x, p.z - e.z);
            if (dist > 2) doorArmed = true;
            if (doorArmed && dist < 0.7 && subway.at === 'A') leaveSubway();
            return;
        }
        let d, kind = 'works';
        if (below) {
            d = roomKind === 'hut' ? hut.exit : works.exit;
            kind = roomKind;
        } else {
            d = world.clockDoor;
            if (world.hut && Math.hypot(p.x - world.hut.x, p.z - world.hut.z) < Math.hypot(p.x - d.x, p.z - d.z)) {
                d = world.hut;
                kind = 'hut';
            }
        }
        const dist = Math.hypot(p.x - d.x, p.z - d.z);
        if (dist > 1.6) doorArmed = true;
        if (doorArmed && dist < 0.6) throughDoor(!below, kind);
        else if (!below && kind === 'works' && !doorHintShown && dist < 6) {
            doorHintShown = true;
            ui.hint('A door at the foot of the clock tower: walk through it to go down into the Works', 6000);
        } else if (!below && kind === 'hut' && !hutDoorHintShown && dist < 7) {
            hutDoorHintShown = true;
            ui.hint('A little hut: walk through its door', 6000);
        }
    }

    /** Taps below ground: the stair door or the grating. */
    function pickBelow(cx, cy) {
        ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        if (roomKind === 'subway') return subway.pick(ray);
        if (roomKind === 'hut') {
            const hit = ray.intersectObjects([hut.orbHit, hut.ticketHit, hut.doorMesh], false)[0];
            if (hit && hit.distance < 40) return { type: { orb: 'orb', ticket: 'ticket' }[hit.object.userData.kind] ?? 'door', t: hit.distance };
            const o = ray.ray.origin, d = ray.ray.direction;
            if (d.y >= -1e-4) return null;
            const t = -o.y / d.y;
            const point = o.clone().addScaledVector(d, t);
            return hut.walkable(point.x, point.z) ? { type: 'ground', point, t } : null;
        }
        const hit = ray.intersectObjects([works.doorMesh, ...works.linkPanels], false)[0];
        if (hit && hit.distance < 40) {
            if (hit.object.userData.kind === 'source') return hit.distance < 14 ? { type: 'source', url: works.sourceUrl(hit.object.userData.screen), t: hit.distance } : null;
            return { type: 'door', t: hit.distance };
        }
        const o = ray.ray.origin, d = ray.ray.direction;
        if (d.y >= -1e-4) return null;
        const t = -o.y / d.y;
        const point = o.clone().addScaledVector(d, t);
        return works.walkable(point.x, point.z) ? { type: 'ground', point, t } : null;
    }

    world.onArrive = (r) => {
        if (r.statue) {
            highlight = { id: r.statue.id, until: performance.now() + 4000, accent: r.statue.genre.accent };
            ui.showCard(r.statue.game, { here: true });
        }
    };

    ui.on('play', play);
    ui.on('walk', walkToGame);
    ui.on('link', linkToGame);
    ui.on('find', linkToGame);
    ui.on('sound', () => {
        muted = !muted;
        audio.setMuted(muted);
        ui.sound(muted);
    });
    // pause the music while the garden tab is hidden or unfocused, e.g. after
    // it opens a game in a new tab, so the two don't play over each other
    const syncFocus = () => audio.setPaused(document.hidden || !document.hasFocus());
    document.addEventListener('visibilitychange', syncFocus);
    addEventListener('blur', syncFocus);
    addEventListener('focus', syncFocus);
    syncFocus();

    // below ground the map shows you at the tower
    const mapPos = () => (place !== 'garden' && stones ? stones : below ? (roomKind === 'works' ? world.clockDoor : { x: world.hut.cx, z: world.hut.cz }) : controls.pos);
    ui.on('mapOpen', () => map.draw(mapPos(), controls.yaw));
    ui.on('timeOpen', () => {
        document.getElementById('time-slider').value = Math.round(sky.time * 1440);
        document.getElementById('music-vol').value = audio.musicVol;
        document.getElementById('time-pause').textContent = sky.paused ? 'Resume' : 'Pause';
        syncWeather();
        document.getElementById('quality-low').checked = quality.tier === 'low';
    });
    map.onPick = ({ statue, place }) => {
        if (statue) ui.showCard(statue.game, { fromHologram: true });
        else if (place) {
            ui.closeAll();
            if (place.stand) linkTo(place.stand.x, place.stand.z, place.stand.yaw);
            else if (place.spoke) {
                const p = samplePath(place.spoke.pts, GATE_S + 2.5);
                linkTo(p.x, p.z, Math.atan2(-p.tx, -p.tz));
            } else if (place.landmark) {
                const lm = place.landmark;
                if (lm.stand) linkTo(lm.stand.x, lm.stand.z, lm.stand.yaw);
                else {
                    const s = standNear(lm.x, lm.z);
                    linkTo(s.x, s.z, Math.atan2(-(lm.x - s.x), -(lm.z - s.z)));
                }
            }
        }
    };
    hologram.onSelect = (game) => ui.showCard(game, { fromHologram: true });

    document.getElementById('time-slider').addEventListener('input', (e) => sky.setTime(e.target.value / 1440));
    document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => sky.setTime(Number(b.dataset.time))));
    const syncWeather = () => document.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('active', b.dataset.weather === weather.name));
    weather.onChange = syncWeather;
    document.querySelectorAll('[data-weather]').forEach((b) => b.addEventListener('click', () => {
        weather.auto = false;
        weather.set(b.dataset.weather);
        syncWeather();
    }));
    document.getElementById('time-pause').addEventListener('click', (e) => {
        sky.paused = !sky.paused;
        e.target.textContent = sky.paused ? 'Resume' : 'Pause';
    });
    document.getElementById('music-vol').addEventListener('input', (e) => audio.setMusicVolume(Number(e.target.value)));
    document.getElementById('quality-low').addEventListener('change', (e) => {
        store.set('lowGfx', e.target.checked);
        location.reload();
    });

    controls.onHoverMove = (x, y) => {
        mouse = x < 0 ? null : { x, y };
        if (!mouse) {
            setHover(null);
            ui.tooltip(null);
        }
    };
    controls.onTap = (x, y, type) => {
        if (!entered || intro || transit || boat.busy || fishing.active) return;
        if (ui.blocking) return;
        if (place === 'cove') return tapCove(x, y);
        if (place === 'mine') return tapMine(x, y);
        if (below) {
            const h = pickBelow(x, y);
            if (h?.type === 'source') {
                // a real new tab, opened inside the click so popup blockers allow it
                window.open(h.url, '_blank', 'noopener');
                audio.click();
            } else if (h?.type === 'orb') {
                startTrip();
            } else if (h?.type === 'ticket') {
                audio.click();
                startSubway();
            } else if (h?.type === 'pool') {
                subway.touchPool(h.point);
            } else if (h?.type === 'door') {
                const e = roomKind === 'hut' ? hut.exit : roomKind === 'subway' ? subway.exit : works.exit;
                controls.walkTo([{ x: e.x, z: e.z }]);
            }
            else if (h && h.t < 60) {
                ui.marker(x, y);
                controls.walkTo([{ x: h.point.x, z: h.point.z }]);
            }
            return;
        }
        const h = pick(x, y);
        if (!h) return;
        if (h.type === 'statue') {
            if (type === 'mouse') openGame(h.statue.game);
            else {
                audio.hover();
                highlight = { id: h.statue.id, until: Infinity, accent: h.statue.genre.accent };
                ui.showCard(h.statue.game, { here: h.t < 9 });
            }
        } else if (h.type === 'arrow') {
            hologram.step(h.dir);
            audio.arrow();
        } else if (h.type === 'panel') {
            audio.click();
            ui.showCard(hologram.current, { fromHologram: true });
        } else if (h.type === 'boat') {
            audio.click();
            boardPending = true;
            ui.closeAll();
            controls.walkTo(controls.plan(boat.stand.x, boat.stand.z));
        } else if (h.type === 'rod') {
            audio.click();
            ui.closeAll();
            if (fishing.near(controls.pos.x, controls.pos.z, 2.5)) fishing.start();
            else {
                fishPending = true;
                controls.walkTo(fishing.route());
            }
        } else if (h.type === 'portal' && stonesStand) {
            audio.click();
            ui.closeAll();
            const route = controls.plan(stonesStand.x, stonesStand.z);
            route.push(stonesStand.inner);
            controls.walkTo(route);
        } else if (h.type === 'hutDoor') {
            audio.click();
            ui.closeAll();
            controls.walkTo(controls.plan(world.hut.x, world.hut.z));
        } else if (h.type === 'door') {
            const d = world.clockDoor;
            controls.walkTo([{ x: d.x, z: d.z }]);
        } else if (h.type === 'ground') {
            if (ui.cardGame) {
                ui.closeAll();
                return;
            }
            if (h.t < 90 && (world.walkHeight(h.point.x, h.point.z) > 0.35 || world.onDeck(h.point.x, h.point.z))) {
                ui.marker(x, y);
                controls.walkTo([{ x: h.point.x, z: h.point.z }]);
            }
        }
    };
    /** Taps at the foot of Cinderpeak: the cart, the dais, or the ground. */
    function tapCove(x, y) {
        const h = pick(x, y);
        if (!h) return;
        if (h.type === 'cart') {
            audio.click();
            controls.walkTo([{ x: volcano.cartPos.x, z: volcano.cartPos.z }]);
        } else if (h.type === 'dais') {
            audio.click();
            controls.walkTo([{ x: volcano.dais.x, z: volcano.dais.z }]);
        } else if (h.type === 'ground' && h.t < 90) {
            ui.marker(x, y);
            controls.walkTo([{ x: h.point.x, z: h.point.z }]);
        }
    }

    /** Taps on the cliff over the lava: the cart, or a place to stand. */
    function tapMine(x, y) {
        if (!mine || mine.state !== 'free') return;
        ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const h = mine.pickLedge(ray);
        if (!h) return;
        if (h.type === 'cart') {
            audio.click();
            controls.walkTo([{ x: mine.cart.group.position.x, z: mine.cart.group.position.z }]);
        } else {
            ui.marker(x, y);
            controls.walkTo([{ x: h.point.x, z: h.point.z }]);
        }
    }

    controls.onStep = () => {
        if (place !== 'garden' && !below) return audio.step(controls.pos.x > volcano.platformStand.x - 3 && controls.pos.x < volcano.platformStand.x + 3 && controls.pos.z > volcano.cartPos.z - 8 && controls.pos.z < volcano.cartPos.z + 17 ? 'wood' : 'stone');
        if (below && roomKind === 'mine') return audio.step('stone');
        if (below) return audio.step(roomKind === 'subway' ? subway.stepSurface(controls.pos) : 'metal');
        const p = controls.pos;
        const surface = world.onDeck(p.x, p.z) ? 'wood' : island.pathDistAt(p.x, p.z) < PATH_HALF + 0.2 || Math.hypot(p.x, p.z) < PLAZA_R || world.inPlaza(p.x, p.z) ? 'stone' : 'grass';
        audio.step(surface);
    };
    world.onVineGrow = (k) => {
        sparkleVine(k, bursts);
        if (entered) audio.sparkle();
    };

    addEventListener('keydown', (e) => {
        if (!entered || e.target.closest?.('input')) return;
        if (e.key === ']') {
            hologram.step(1);
            audio.arrow();
        } else if (e.key === '[') {
            hologram.step(-1);
            audio.arrow();
        } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) ui.emit('sound');
        else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && canFish() && fishing.near(controls.pos.x, controls.pos.z)) fishing.start();
    });

    const canFish = () => entered && !intro && !below && !transit && !boat.busy && !trip && !ui.blocking && controls.enabled;

    boat.onPhase = (phase) => {
        if (phase === 'transform') audio.sparkle();
        else if (phase === 'flight') ui.hint('Press Esc or tap to land early', 6000);
        else if (phase === 'leave') audio.click();
    };
    boat.onDone = () => {
        zoneKey = '';
        ui.hint('Back at the dock · follow the path up to the hub', 5000);
    };
    addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && boat.flying) boat.skip();
    });
    canvas.addEventListener('pointerup', () => boat.skip());

    const enter = (thenLibrary) => {
        if (entered) return;
        entered = true;
        ui.enter();
        audio.start();
        audio.setMuted(muted);
        const sp = layout.spawn;
        const endPos = new THREE.Vector3(sp.x, world.walkHeight(sp.x, sp.z) + 1.65, sp.z);
        const endQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.02, sp.yaw, 0, 'YXZ'));
        intro = { t: 0, dur: thenLibrary ? 0.01 : 3.4, fromP: camera.position.clone(), fromQ: camera.quaternion.clone(), endPos, endQ, mid: new THREE.Vector3(sp.x * 0.5, 22, sp.z + 30) };
        if (thenLibrary) ui.show('library');
    };
    document.getElementById('enter').addEventListener('click', () => enter(false));
    document.getElementById('enter-library').addEventListener('click', () => enter(true));
    ui.ready();
    if (params.has('enter')) enter(false);
    if (params.has('cove')) {
        // ?cove: straight to the cove once the fly-in is over (for testing)
        const iv = setInterval(() => {
            if (entered && !intro) {
                clearInterval(iv);
                travelToCove();
            }
        }, 200);
    }

    // ------------------------------------------------------------ loop

    let fpsAcc = 0, fpsN = 0, fpsTimer = 0, clockTimer = 0, zoneTimer = 0;
    const camPos = new THREE.Vector3();

    function zoneCheck() {
        if (place !== 'garden') return;
        const p = controls.pos;
        let key = 'wilds', name = 'The Island', sub = '', accent;
        if (Math.hypot(p.x, p.z) < PLAZA_R + 1) {
            key = 'hub';
            name = 'The Hub';
            sub = `${games.length} games · ${layout.spokes.length} paths`;
            accent = '#8ff6ff';
        } else if (fishing.onPier(p.x, p.z)) {
            key = 'pier';
            name = 'The Fishing Pier';
            sub = 'A rod waits on the rail at the end';
            accent = '#7fd6e8';
        } else if (world.onDeck(p.x, p.z) || (Math.abs(p.x) < 6 && p.z > layout.dock.start - 6)) {
            key = 'dock';
            name = 'The Dock';
            sub = 'Follow the path up to the hub';
        } else {
            for (const sp of layout.spokes) {
                const pr = projectOnPath(sp.pts, p.x, p.z);
                const inPav = Math.hypot(p.x - sp.pavilion.x, p.z - sp.pavilion.z) < PAVILION_PLAZA + 2;
                if ((pr.d < 9 && pr.s > GATE_S - 0.5) || inPav) {
                    key = 'g' + sp.index;
                    name = sp.genre.name;
                    sub = `${sp.genre.short} · ${sp.games.length} game${sp.games.length === 1 ? '' : 's'}`;
                    accent = sp.genre.accent;
                    break;
                }
            }
            if (key === 'wilds') {
                for (const lm of world.landmarks) {
                    if (Math.hypot(p.x - lm.x, p.z - lm.z) < 13) {
                        key = lm.name;
                        name = lm.name;
                        accent = '#d9b46a';
                        break;
                    }
                }
            }
        }
        if (key !== zoneKey) {
            const quiet = key === 'wilds';
            zoneKey = key;
            if (quiet) document.getElementById('hud-zone').textContent = name;
            else ui.zone(name, sub, accent);
        }
    }

    let hintShown = false;
    function frame() {
        const rawDt = clock.getDelta();
        const dt = Math.min(rawDt, DEBUG && params.has('bigdt') ? 0.5 : 0.05);
        elapsed += dt;
        const t = elapsed;
        if (resizePending) {
            resizePending = false;
            resize();
        }

        // camera: title orbit, fly-in, or walking
        if (!entered) {
            orbitA += dt * 0.035;
            const R = layout.islandR * 0.85;
            camera.position.set(Math.sin(orbitA) * R, 30 + Math.sin(orbitA * 0.7) * 6, Math.cos(orbitA) * R);
            camera.lookAt(0, 4, 0);
        } else if (intro) {
            intro.t += dt;
            const k = smoothstep(0, 1, Math.min(1, intro.t / intro.dur));
            // a gentle arc down to the dock
            const a = intro.fromP.clone().lerp(intro.mid, k).lerp(intro.mid.clone().lerp(intro.endPos, k), k);
            camera.position.copy(a);
            camera.quaternion.copy(intro.fromQ).slerp(intro.endQ, smoothstep(0.2, 1, k));
            if (intro.t >= intro.dur) {
                intro = null;
                controls.enabled = true;
                if (!hintShown) {
                    hintShown = true;
                    const touch = matchMedia('(pointer: coarse)').matches;
                    ui.hint(touch ? 'Slide in the lower-left to walk · drag to look · tap a statue' : 'WASD to walk · drag to look · click the ground to go there · hover a statue', 9000);
                    setTimeout(() => ui.zone('The Dock', 'Follow the path up to the hub'), 600);
                    zoneKey = 'dock';
                }
            }
        } else if (trip) {
            tripUpdate(dt);
        } else if (mineDrives()) {
            mine.update(dt, t, camera, controls);
        } else if (!boat.busy && !fishing.active) {
            controls.update(dt);
        }
        if (!below) boat.update(dt, t);
        if (!below) fishing.update(dt, t, entered && !intro && !boat.busy && !transit && !ui.blocking);
        if (fishPending && entered && !intro && !controls.route) {
            fishPending = false;
            if (canFish() && fishing.near(controls.pos.x, controls.pos.z, 2.5)) fishing.start();
        }
        if (boardPending && entered && !intro && !boat.busy && !controls.route) {
            boardPending = false;
            if (Math.hypot(controls.pos.x - boat.stand.x, controls.pos.z - boat.stand.z) < 2.5) boat.board();
        }
        if (entered && !intro && !boatHintShown && !boat.busy && Math.hypot(controls.pos.x - boat.home.x, controls.pos.z - boat.home.z) < 9) {
            boatHintShown = true;
            ui.hint('Your rowboat is still moored here · click it to climb back in', 7000);
        }
        camPos.copy(entered && !intro && !boat.busy && !mineDrives() ? controls.pos : camera.position);
        // the title orbit and the boat flight keep the camera aloft, so weather must follow it up there
        if (!entered || intro) camPos.y = world.groundAt(camPos.x, camPos.z);

        const wind = weather.update(dt, t, camPos, renderer.domElement.height, below);
        windUniforms.uWind.value = 1 + wind * 2.2;
        sky.update(dt, camPos);
        const s = sky.state;
        const night = s.night;
        // the garden sees in each new day with fireworks (?fireworks shows them at once)
        if ((sky.midnight || fireworksPending) && !below) {
            fireworksPending = false;
            fireworks.start();
        }
        if (below && roomKind === 'hut') {
            hut.update(dt, t);
            audio.update(night, -100);
            // the pointer shows a hand over the sphere and the door
            if (entered && !intro && !trip && mouse && !ui.blocking && !controls.look?.moved) {
                const h = pickBelow(mouse.x, mouse.y);
                hut.setHover(h?.type === 'orb', h?.type === 'ticket');
                document.body.classList.toggle('can-hover-pick', h?.type === 'orb' || h?.type === 'door' || h?.type === 'ticket');
            } else hut.setHover(false);
            if (!orbHintShown && entered && !trip && Math.hypot(controls.pos.x - hut.orbPos.x, controls.pos.z - hut.orbPos.z) < 2.2) {
                orbHintShown = true;
                ui.hint('A sphere of glass on the desk, with something turning inside it · and a train ticket beside it · click either', 8000);
            }
        } else if (below && roomKind === 'subway') {
            subway.update(Math.min(rawDt, 0.25), t, camera, controls);
            audio.update(night, -100);
            if (entered && !intro && mouse && !ui.blocking && !controls.look?.moved) {
                const h = pickBelow(mouse.x, mouse.y);
                document.body.classList.toggle('can-hover-pick', h?.type === 'pool' || h?.type === 'door');
            }
        } else if (below && roomKind === 'mine') {
            if (!mineDrives()) mine.update(dt, t, camera, controls);
            mine.setSky(s, sky.wx);
            audio.update(night, -100);
            if (entered && !intro && mouse && !ui.blocking && !controls.look?.moved && mine.state === 'free') {
                ndc.set((mouse.x / innerWidth) * 2 - 1, -(mouse.y / innerHeight) * 2 + 1);
                ray.setFromCamera(ndc, camera);
                document.body.classList.toggle('can-hover-pick', mine.pickLedge(ray)?.type === 'cart');
            }
        } else if (below) {
            const hisses = works.update(dt, t, controls.pos, renderer.domElement.height);
            for (const v of hisses) audio.hiss(v);
            audio.update(night, -100);
            // the pointer shows a hand over the GitHub panels and the stair door
            if (entered && !intro && mouse && !ui.blocking && !controls.look?.moved) {
                const h = pickBelow(mouse.x, mouse.y);
                document.body.classList.toggle('can-hover-pick', h?.type === 'source' || h?.type === 'door');
            }
        } else {
            water.update(t);
            windUniforms.uWindTime.value = t;

            // night lighting
            world.mats.glass.emissiveIntensity = 0.15 + night * 3.2;
            for (const g of world.glowMats) g.mat.emissiveIntensity = lerp(g.day, g.night, night);
            for (const m of world.nightSigns) m.emissiveIntensity = 0.06 + night * 0.45;
            hoverUniforms.uNightGlow.value = night;
            hoverUniforms.uHoverTime.value = t;
            lampTimer += dt;
            if (lampTimer > 0.4) {
                lampTimer = 0;
                const near = world.lampSpots.map((l) => ({ l, d: (l.x - camPos.x) ** 2 + (l.z - camPos.z) ** 2 })).sort((a, b) => a.d - b.d);
                lampLights.forEach((L, i) => {
                    const n = near[i];
                    if (n && n.d < 40 * 40) {
                        L.position.copy(n.l.light);
                        L.userData.on = true;
                    } else L.userData.on = false;
                });
            }
            for (const L of lampLights) L.intensity = damp(L.intensity, L.userData.on ? night * 9 : 0, 4, dt);
            beams(dt, night);

            // hover highlight
            if (entered && !intro && mouse && !ui.blocking && !controls.look?.moved && !fishing.active) {
                const h = pick(mouse.x, mouse.y);
                setHover(h);
                if (h?.type === 'statue') ui.tooltip(h.statue.game, mouse.x, mouse.y);
                else if (h?.type === 'panel') ui.tooltip(hologram.current, mouse.x, mouse.y, 'Click for details · [ ] to turn');
                else ui.tooltip(null);
            } else if (controls.look?.moved || ui.blocking || fishing.active) {
                if (fishing.active && hovered) setHover(null);
                ui.tooltip(null);
            }
            const hid = hovered?.statue?.id ?? -1;
            if (hid >= 0) {
                hoverUniforms.uHover.value = hid;
                hoverUniforms.uHoverColor.value.set(hovered.statue.genre.accent);
            } else if (highlight.id >= 0 && performance.now() < highlight.until && (highlight.until !== Infinity || ui.cardGame)) {
                hoverUniforms.uHover.value = highlight.id;
                hoverUniforms.uHoverColor.value.set(highlight.accent);
            } else {
                hoverUniforms.uHover.value = -1;
                if (highlight.until === Infinity && !ui.cardGame) highlight = { id: -1, until: 0 };
            }

            hologram.update(dt, t, camPos, night);
            vines.update(dt, camPos, camera);
            particles.update(t, night, renderer.domElement.height);
            bursts.update(t, renderer.domElement.height);
            fireworks.update(dt, renderer.domElement.height);
            fireworks.light(sky.hemi);
            for (const u of world.updaters) u(t, sky);
            volcano.update(dt, t, camPos);
            fox.update(dt, t, entered && !intro && controls.enabled && !transit && !boat.busy && place === 'garden', ui.blocking || !!ui.cardGame);
            updateGrass(world, camPos);
            audio.update(night, place === 'cove' ? volcano.world.island.shoreAt(camPos.x, camPos.z) : island.shoreAt(camPos.x, camPos.z));
        }

        // the cart's sounds, in the open part of the ride too
        if (mineAudio?.on && !(below && roomKind === 'mine')) mineAudio.update(dt, mine.soundState());
        clockTimer += dt;
        if (clockTimer > 0.5) {
            clockTimer = 0;
            ui.clock(sky.clockText(), night);
            if (ui.open === 'map') map.draw(mapPos(), controls.yaw);
        }
        zoneTimer += dt;
        if (entered && !intro && !boat.busy && zoneTimer > 0.3) {
            zoneTimer = 0;
            if (!below) zoneCheck();
        }
        if (entered && !intro && !boat.busy) {
            if (place === 'garden') doorCheck();
            cinderCheck();
        }

        composer.render(dt);

        // adaptive resolution
        fpsAcc += dt;
        fpsN++;
        fpsTimer += dt;
        if (fpsTimer > 2.5 && !quality.fixedPR) {
            const fps = fpsN / fpsAcc;
            const maxPR = Math.min(devicePixelRatio || 1, quality.maxPR);
            let next = pixelRatio;
            if (fps < 42 && pixelRatio > 0.6) next = Math.max(0.6, pixelRatio - 0.15);
            else if (fps > 57 && pixelRatio < maxPR) next = Math.min(maxPR, pixelRatio + 0.1);
            if (Math.abs(next - pixelRatio) > 0.01) {
                pixelRatio = next;
                resizePending = true;
            }
            world.fps = fps;
            fpsAcc = fpsN = fpsTimer = 0;
        }
        world.frameMs = damp(world.frameMs || 16, rawDt * 1000, 2, 0.1);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    if (DEBUG) {
        window.__garden = { volcano, get mine() { return mine; }, get place() { return place; }, travelToCove, travelToGarden, boardCart, prepareMine, startTrip, leaveTrip, get trip() { return trip; }, get hut() { return hut; }, get subway() { return subway; }, startSubway, leaveSubway, get galaxy() { return galaxy; }, map, world, controls, throughDoor, get works() { return works; }, get below() { return below; }, hologram, sky, ui, pick, statues, layout, island, camera, renderer, audio, boat, fishing, fireworks, linkToGame, walkToGame, scene, fox, get entered() { return entered && !intro; } };
    }
}

boot().catch((e) => {
    console.error(e);
    const t = document.getElementById('loader-text');
    if (t) t.innerHTML = 'Something went wrong building the garden. <a href="classic.html">Open the game list instead.</a>';
});
