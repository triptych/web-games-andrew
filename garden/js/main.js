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
    return q;
}

// ---------------------------------------------------------------- world

function makeWorld(layout, island, quality) {
    const w = {
        layout, island, quality, root: new THREE.Group(),
        colliders: [], floors: [], boxFloors: [], vines: [], lampSpots: [], updaters: [], glowMats: [], nightSigns: [],
        flowerBeds: [], hedges: [], cypress: [], topiary: [], windows: [], runes: [], altars: [], beacons: [], fountains: [],
        landmarks: [], petalSources: [], sparkSources: [], statues: [], statueGlows: [],
    };
    w.groundAt = (x, z) => island.heightAt(x, z);
    w.onDeck = (x, z) => w.boxFloors.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
    w.walkHeight = (x, z) => {
        let h = island.heightAt(x, z);
        for (const f of w.floors) if (!f.block && (x - f.x) ** 2 + (z - f.z) ** 2 < f.r * f.r && f.y > h) h = f.y;
        for (const b of w.boxFloors) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y > h) h = b.y;
        return h;
    };
    w.inPlaza = (x, z) => {
        for (const sp of layout.spokes) if (Math.hypot(x - sp.pavilion.x, z - sp.pavilion.z) < PAVILION_PLAZA + 0.4) return true;
        for (const f of layout.features) if (f.type === 'fountain' && Math.hypot(x - f.x, z - f.z) < 6.6) return true;
        return false;
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
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.5, 1.15);
    if (quality.bloom) composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const controls = new Controls(world, camera, canvas);
    world.controls = controls;
    // a fox spirit from Worldroot comes by on about one visit in five (?fox=1 always, ?fox=0 never)
    const fox = new FoxVisitor(scene, world, controls, camera, { force: params.get('fox') });
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
        let best = null, bt = Infinity;
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
        const tg = marchGround(world, o, d, Math.min(bt, 120));
        if (tg < bt) {
            const p = o.clone().addScaledVector(d, tg);
            return { type: 'ground', point: p, t: tg };
        }
        return best;
    }

    // ------------------------------------------------------------ actions

    const standForStatue = (st) => controls.standFor(st);

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
        audio.link();
        ui.flash(true);
        controls.route = null;
        setTimeout(() => {
            controls.teleport(x, z, yaw);
            setTimeout(() => ui.flash(false), 120);
            after?.();
        }, 650);
    }

    function linkToGame(game) {
        const st = statueByGame.get(game);
        const s = standForStatue(st);
        ui.closeAll();
        linkTo(s.x, s.z, s.yaw, () => (highlight = { id: st.id, until: performance.now() + 4000, accent: st.genre.accent }));
    }

    function walkToGame(game) {
        const st = statueByGame.get(game);
        const s = standForStatue(st);
        ui.closeAll();
        const route = controls.plan(s.x, s.z);
        controls.walkTo(route, s.yaw);
        controls.route.statue = st;
        controls.route.run = route.length > 14;
        ui.hint(`Walking to ${game.title}…`, 3500);
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

    ui.on('mapOpen', () => map.draw(controls.pos, controls.yaw));
    ui.on('timeOpen', () => {
        document.getElementById('time-slider').value = Math.round(sky.time * 1440);
        document.getElementById('music-vol').value = audio.musicVol;
        document.getElementById('time-pause').textContent = sky.paused ? 'Resume' : 'Pause';
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
                const l = Math.hypot(lm.x, lm.z) || 1;
                let x = lm.x - (lm.x / l) * 8, z = lm.z - (lm.z / l) * 8;
                if (world.walkHeight(x, z) < 0.4) {
                    x = lm.x * 0.7;
                    z = lm.z * 0.7;
                }
                linkTo(x, z, Math.atan2(-(lm.x - x), -(lm.z - z)));
            }
        }
    };
    hologram.onSelect = (game) => ui.showCard(game, { fromHologram: true });

    document.getElementById('time-slider').addEventListener('input', (e) => sky.setTime(e.target.value / 1440));
    document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => sky.setTime(Number(b.dataset.time))));
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
        if (!entered || intro) return;
        if (ui.blocking) return;
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
    controls.onStep = () => {
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
    });

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

    // ------------------------------------------------------------ loop

    let fpsAcc = 0, fpsN = 0, fpsTimer = 0, clockTimer = 0, zoneTimer = 0;
    const camPos = new THREE.Vector3();

    function zoneCheck() {
        const p = controls.pos;
        let key = 'wilds', name = 'The Island', sub = '', accent;
        if (Math.hypot(p.x, p.z) < PLAZA_R + 1) {
            key = 'hub';
            name = 'The Hub';
            sub = `${games.length} games · ${layout.spokes.length} paths`;
            accent = '#8ff6ff';
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
        } else {
            controls.update(dt);
        }
        camPos.copy(entered && !intro ? controls.pos : camera.position);
        if (!entered || intro) camPos.y = world.groundAt(camPos.x, camPos.z);

        sky.update(dt, camPos);
        const s = sky.state;
        water.update(t);
        windUniforms.uWindTime.value = t;
        const night = s.night;

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
        if (entered && !intro && mouse && !ui.blocking && !controls.look?.moved) {
            const h = pick(mouse.x, mouse.y);
            setHover(h);
            if (h?.type === 'statue') ui.tooltip(h.statue.game, mouse.x, mouse.y);
            else if (h?.type === 'panel') ui.tooltip(hologram.current, mouse.x, mouse.y, 'Click for details · [ ] to turn');
            else ui.tooltip(null);
        } else if (controls.look?.moved || ui.blocking) {
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
        for (const u of world.updaters) u(t, sky);
        fox.update(dt, t, entered && !intro && controls.enabled, ui.blocking || !!ui.cardGame);
        updateGrass(world, camPos);
        audio.update(night, island.shoreAt(camPos.x, camPos.z));

        clockTimer += dt;
        if (clockTimer > 0.5) {
            clockTimer = 0;
            ui.clock(sky.clockText(), night);
            if (ui.open === 'map') map.draw(controls.pos, controls.yaw);
        }
        zoneTimer += dt;
        if (entered && !intro && zoneTimer > 0.3) {
            zoneTimer = 0;
            zoneCheck();
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
        window.__garden = { world, controls, hologram, sky, ui, pick, statues, layout, island, camera, renderer, audio, linkToGame, walkToGame, scene, fox, get entered() { return entered && !intro; } };
    }
}

boot().catch((e) => {
    console.error(e);
    const t = document.getElementById('loader-text');
    if (t) t.innerHTML = 'Something went wrong building the garden. <a href="classic.html">Open the game list instead.</a>';
});
