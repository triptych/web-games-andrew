/**
 * models.js — a line-up of every body type for checking models and animation in isolation.
 *   dev/models.html?set=people|beasts|monsters|dragon&act=idle|walk|run|fight|attack|power|block|bow|cast|sneak|dead|sigil
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ActorsView } from '../js/view/actorsview.js';
import { createActor, createNamedNpc } from '../js/sim/actor.js';
import { addItem, equip } from '../js/sim/inventory.js';
import { Rng } from '../js/sim/rng.js';

const q = new URLSearchParams(location.search);
const SET = q.get('set') || 'people', ACT = q.get('act') || 'walk';
const W = innerWidth, H = innerHeight;
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(W, H); r.setPixelRatio(1);
r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
r.shadowMap.enabled = true;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a4048);
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
sun.position.set(-6, 12, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 80 });
scene.add(sun, new THREE.HemisphereLight(0xbcd0e8, 0x4a4030, 0.6));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x5a6048, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const rng = new Rng(7);
const world = { actors: [], player: { pos: { x: 0, y: 0, z: 50 }, h: 1.8 }, cellId: 'ext', byId: () => null };
const view = new ActorsView(scene, world);
const list = [];
const give = (a, ids) => { for (const id of ids) { const e = addItem(a, { id }, 1); } for (const id of ids) { const ent = a.inv.find((x) => x.id === id); if (ent) equip(a, ent, ids.indexOf(id) === 1 && !id.includes('shield') && !id.includes('_') ? 'left' : 'right'); } };
if (SET === 'people') {
    for (const id of ['halvard', 'ragna', 'hakon', 'orla', 'bjarki']) list.push(createNamedNpc(id, rng));
    for (const t of ['bandit', 'bandit_archer', 'bandit_mage', 'guard', 'reaver', 'hearthguard', 'bandit_chief']) list.push(createActor(t, { rng, level: 14 }));
} else if (SET === 'beasts') {
    for (const t of ['wolf', 'fox', 'giantrat', 'bear', 'fangcat', 'goat', 'deer', 'elk', 'cow', 'horse', 'walrus', 'mudclaw', 'spider', 'mammoth']) list.push(createActor(t, { rng }));
} else if (SET === 'monsters') {
    for (const t of ['wight', 'wight_warden', 'wight_dreadlord', 'skeleton', 'gloomkin', 'troll', 'rime_golem', 'ember_golem', 'sentinel', 'hierophant', 'giant']) list.push(createActor(t, { rng, level: 20 }));
} else if (SET === 'dragon') {
    for (const t of ['dragon', 'frost_dragon']) list.push(createActor(t, { rng }));
}
const recs = [];
let x = 0;
const gap = (a) => a.rig === 'dragon' ? 22 : a.tpl === 'mammoth' ? 7 : a.tpl === 'giant' ? 4 : a.rig === 'humanoid' ? 1.3 : 2.4 * (a.scale || 1);
const total = list.reduce((s, a) => s + gap(a), 0);
x = -total / 2;
for (const a of list) {
    x += gap(a) / 2;
    a.pos.x = x; a.pos.z = 0; a.yaw = q.get('yaw') ? +q.get('yaw') : 0;
    x += gap(a) / 2;
    if (SET === 'dragon') { a.fly = list.indexOf(a) === 0 ? q.get('fly') === '1' : false; if (a.fly) a.pos.y = 4; }
    const rec = view.build(a);
    scene.add(rec.g); recs.push(rec);
    view.place(rec);
}
const cam = new THREE.PerspectiveCamera(SET === 'dragon' ? 45 : 30, W / H, 0.1, 500);
const span = total;
const fitD = span / 2 / Math.tan((cam.fov * Math.PI / 180) / 2) / (W / H) * 1.05;
const camY = SET === 'dragon' ? 6 : SET === 'beasts' ? 1.2 : 1.1;
cam.position.set(+(q.get('cx') || 0), +(q.get('cy') || camY + fitD * 0.12), +(q.get('cz') || fitD));
cam.lookAt(+(q.get('cx') || 0), SET === 'dragon' ? 3 : 0.9, 0);
if (q.get('zoom')) { cam.zoom = +q.get('zoom'); cam.updateProjectionMatrix(); }

let t = 0;
const clock = new THREE.Clock();
function act(a, t) {
    a.act = { kind: 'idle', t: 0 }; a.blocking = false; a.sneaking = false; a.dead = false;
    const cyc = (d) => (t % d) / d;
    if (ACT === 'attack' || ACT === 'power') {
        const pw = ACT === 'power';
        const W1 = pw ? 0.48 : 0.2, S = pw ? 0.12 : 0.1, R = pw ? 0.46 : 0.26;
        const u = cyc(W1 + S + R + 0.4) * (W1 + S + R + 0.4);
        if (u < W1) a.act = { kind: 'attack', phase: 'wind', t: u, wind: W1, strike: S, recover: R, power: pw, hand: 'right' };
        else if (u < W1 + S) a.act = { kind: 'attack', phase: 'strike', t: u - W1, wind: W1, strike: S, recover: R, power: pw, hand: 'right' };
        else if (u < W1 + S + R) a.act = { kind: 'attack', phase: 'recover', t: u - W1 - S, wind: W1, strike: S, recover: R, power: pw, hand: 'right' };
    } else if (ACT === 'bow') a.act = { kind: 'draw', t: cyc(1.6) * 1.6, full: 1.05 };
    else if (ACT === 'cast') a.act = { kind: 'cast', hand: 'right', t: cyc(1) * 0.6, spell: 'firebolt' };
    else if (ACT === 'sigil') a.act = { kind: 'sigil', t: cyc(1.5) * 1.5, charging: false };
    else if (ACT === 'block') a.blocking = true;
    else if (ACT === 'sneak') a.sneaking = true;
    else if (ACT === 'dead') a.dead = true;
    if (a.rig === 'dragon' && ACT === 'breath') a.breath = 1;
}
function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    t += dt;
    for (const rec of recs) {
        const a = rec.a;
        act(a, t + (+q.get('t') || 0));
        const speed = ACT === 'walk' || ACT === 'sneak' ? 1.6 : ACT === 'run' ? 5.5 : 0;
        const items = view.held(a);
        const drawn = ['fight', 'attack', 'power', 'block', 'bow', 'cast'].includes(ACT);
        rec.anim(rec.pose, rec.st, { a, dt, speed: a.rig === 'dragon' ? (a.fly ? 18 : speed) : speed, lvx: 0, lvz: -speed, vy: 0, lookYaw: 0, lookPitch: 0, aimPitch: 0, ground: null, rightItem: items.r, leftItem: items.l, drawn });
        if (a.rig === 'humanoid') view.placeItems(rec, drawn);
        view.place(rec);
    }
    r.render(scene, cam);
    requestAnimationFrame(frame);
}
frame();
setTimeout(() => { window.__fm = { mode: 'ready' }; }, 300);
