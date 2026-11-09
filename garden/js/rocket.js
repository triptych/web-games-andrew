// Aboard the Silver Comet, the rocket that crashed past the grove. Walk up the
// ramp and you are in her airlock, with two spacesuits on their hooks and a
// third hook empty. A corridor runs her length, ribbed and piped, its tube
// lights failing and catching, wires hanging out of the ceiling and sparking.
// Aft is the engine room with the pile still warm; forward, the cockpit, its
// glass pressed against the earth she ploughed and the pilot's seat empty.
// There are crew quarters and a cargo hold, and one room still has power: the
// transporter. Step on the pad and pull the lever, and it throws you at a world
// it makes up as it goes (planet.js), where you can walk about the valley round
// the recall beacon until your suit's air runs low and the recall pulls you
// home. On one world in five, until somebody finds them, the pilot is waiting.
//
// Its own scenes (the ship, and whichever world you are on), drawn by the
// garden's composer and walked with the garden's controls.

import * as THREE from 'three';
import { NavGrid } from './nav.js';
import { Batch, xf } from './materials.js';
import { Planet, WALK_R, biomeFor, BIOMES } from './planet.js';
import { RocketAudio } from './rocket-audio.js';
import { SHIP_NAME, ROCKET_ACCENT } from './rocket-site.js';
import * as K from './rocket-kit.js';
import { glowSprite } from './textures.js';
import { rng, clamp, lerp, smoothstep, store, TAU, esc } from './util.js';

const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- the floor plan

// One character a metre: E engine room, T transporter, C corridor, A airlock,
// Q crew quarters, H cargo hold, P cockpit, + doorways, . solid. The nose is +x.
const MAP = [
    '..................................', // z = -7
    '.........TTTTTTT....HHHHHH........', // -6
    '.........TTTTTTT....HHHHHH........', // -5
    '..EEEEEE.TTTTTTT....HHHHHH........', // -4
    '..EEEEEE.TTTTTTT....HHHHHH...PPP..', // -3
    '..EEEEEE...++........++.....PPPPP.', // -2
    '..EEEEEE+CCCCCCCCCCCCCCCCCC+PPPPP.', // -1
    '..EEEEEE+CCCCCCCCCCCCCCCCCC+PPPPP.', // 0
    '..EEEEEE..........++...++...PPPPP.', // 1
    '..EEEEEE.........AAAA.QQQQQQ.PPP..', // 2
    '..EEEEEE.........AAAA.QQQQQQ......', // 3
    '.................AAAA.QQQQQQ......', // 4
    '..................++..QQQQQQ......', // 5  (the outer hatch)
    '..................................', // 6
];
const X0 = -17, Z0 = -7;
const H = 2.9, DOOR_H = 2.3;
const ROOMS = {
    E: { name: 'The Engine Room', wall: { base: '#8a8478', band: '#6a3a1a', stripe: '#c8231b', grime: 1, seed: 'wall-e' }, floor: '#5a5a5e' },
    T: { name: 'The Transporter Room', wall: { base: '#cfd8dc', band: '#2a6aa8', stripe: '#f2c84a', grime: 0.15, seed: 'wall-t' }, floor: '#4a5a6a' },
    C: { name: 'The Main Corridor', wall: { base: '#d8d2bc', band: '#3a8a86', stripe: '#b8231b', grime: 0.5, seed: 'wall-c' }, floor: '#7a7e86' },
    A: { name: 'The Airlock', wall: { base: '#d8d2bc', band: '#b8231b', stripe: '#f2c84a', grime: 0.45, seed: 'wall-a' }, floor: '#7a7e86' },
    Q: { name: 'The Crew Quarters', wall: { base: '#e0d4b8', band: '#a86a3a', stripe: '#3a8a86', grime: 0.4, seed: 'wall-q' }, floor: '#6a5a4a' },
    H: { name: 'The Cargo Hold', wall: { base: '#a8a890', band: '#5a6a3a', stripe: '#f2c84a', grime: 0.8, seed: 'wall-h' }, floor: '#6a6a62' },
    P: { name: 'The Cockpit', wall: { base: '#c8ccd0', band: '#2a3a6a', stripe: '#b8231b', grime: 0.3, seed: 'wall-p' }, floor: '#5a5e66' },
};
const PAD = { x: -4.5, z: -4.0, r: 1.25 };
const SPAWN = { x: 2.0, z: 4.2, yaw: 0 };
const CHARGE = 2.6, ARRIVE = 1.5, RECALL = 2.0, RETURN = 1.3, FAINT = 2.4;
export const PILOT_ODDS = 0.2;
const SAVE = 'rocketLog';

const cellAt = (x, z) => {
    const i = Math.floor(x - X0), j = Math.floor(z - Z0);
    return MAP[j]?.[i] ?? '.';
};
const openCh = (c) => c !== '.' && c !== undefined;
/** Can the player's circle stand at (x, z) aboard? */
export function aboard(x, z, m = 0.3) {
    return openCh(cellAt(x - m, z - m)) && openCh(cellAt(x + m, z - m)) && openCh(cellAt(x - m, z + m)) && openCh(cellAt(x + m, z + m));
}

export class Rocket {
    /** @param {object} env { renderer, audio (AudioEngine), ui, quality } */
    constructor(env) {
        this.env = env;
        this.tier = env.quality?.tier || 'high';
        this.inside = false;
        this.state = 'out';      // 'out' | 'ship' | 'charge' | 'arrive' | 'planet' | 'recall' | 'return' | 'faint'
        this.onExit = null;
        this.clock = 0;
        this.shipScene = new THREE.Scene();
        this.shipScene.background = new THREE.Color(0x08090c);
        this.cols = [];
        this.hits = [];
        this.floors = [];
        this.anims = [];
        this.sparkSpots = [];
        this.sound = env.audio ? new RocketAudio(env.audio) : null;
        this.planet = new Planet({ quality: env.quality });
        this.info = null;
        this.forcePilot = null;   // tests: true or false overrides the one-in-five
        this.forceBiome = null;   // tests: the kind of the next world
        this._load();

        this._shell();
        this._lights();
        this._corridor();
        this._transporter();
        this._engine();
        this._cockpit();
        this._airlock();
        this._quarters();
        this._hold();
        this._sparks();
        this._shimmer();
        this._dom();

        const self = this;
        this.shipWorld = {
            layout: null,
            island: { heightAt: (x, z) => (aboard(x, z) ? 1 : -5) },
            walkHeight: () => 0,
            onDeck: () => false,
            collidersNear: () => self.cols,
            onArrive: (r) => r?.then?.(),
        };
        this.shipWorld.nav = new NavGrid(this.shipWorld, 18);
        this.world = this.shipWorld;
    }

    /** The scene being looked at: the ship, or the world you are on. */
    get scene() {
        return this.onPlanet ? this.planet.scene : this.shipScene;
    }

    get onPlanet() {
        return (this.state === 'arrive' || this.state === 'planet' || this.state === 'recall' || this.state === 'faint') && this.planet.built;
    }

    /** Locked into a beam or a faint. */
    get busy() {
        return this.state === 'charge' || this.state === 'arrive' || this.state === 'recall' || this.state === 'return' || this.state === 'faint';
    }

    // ------------------------------------------------------------ saving

    _load() {
        const s = store.get(SAVE, null);
        this.save = { trips: 0, species: [], last: null, pilot: null, worlds: [] };
        if (s && typeof s === 'object') {
            this.save.trips = Math.max(0, Math.floor(Number(s.trips) || 0));
            this.save.species = Array.isArray(s.species) ? s.species.filter((x) => typeof x === 'string').slice(0, 500) : [];
            this.save.last = typeof s.last === 'string' ? s.last : null;
            this.save.worlds = Array.isArray(s.worlds) ? s.worlds.slice(-12) : [];
            const p = s.pilot;
            if (p && typeof p === 'object' && Number.isFinite(p.seed) && BIOMES[p.key]) this.save.pilot = { seed: p.seed >>> 0, key: p.key, name: String(p.name || 'an unnamed world').slice(0, 60), at: Number(p.at) || Date.now() };
        }
    }

    _store() {
        store.set(SAVE, this.save);
    }

    // ------------------------------------------------------------ the ship

    _shell() {
        const mats = {
            ceil: new THREE.MeshStandardMaterial({ map: K.ceilingTexture(), roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide }),
            trim: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }),
            frame: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.7 }),
            hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6 }),
        };
        for (const [ch, room] of Object.entries(ROOMS)) {
            mats['wall' + ch] = new THREE.MeshStandardMaterial({ map: K.wallTexture(room.wall), roughness: 0.65, metalness: 0.1 });
            mats['floor' + ch] = new THREE.MeshStandardMaterial({ map: K.floorTexture(room.floor), roughness: 0.55, metalness: 0.5 });
        }
        this.mats = mats;
        const B = new Batch();
        const floorG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        const ceilG = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
        const wallG = new THREE.PlaneGeometry(1, H).translate(0, H / 2, 0);
        const lintelG = new THREE.PlaneGeometry(1, H - DOOR_H).translate(0, (H + DOOR_H) / 2, 0);
        const doorFloorRoom = (i, j) => {
            // a doorway takes the floor of the room beside it that isn't the corridor
            for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const c = MAP[j + dj]?.[i + di];
                if (c && c !== '+' && c !== '.' && c !== 'C') return c;
            }
            return 'C';
        };
        for (let j = 0; j < MAP.length; j++) {
            for (let i = 0; i < MAP[j].length; i++) {
                const ch = MAP[j][i];
                if (!openCh(ch)) continue;
                const cx = X0 + i + 0.5, cz = Z0 + j + 0.5;
                const room = ch === '+' ? doorFloorRoom(i, j) : ch;
                B.add('floor' + room, floorG, xf(cx, 0, cz));
                B.add(ch === '+' ? 'trim' : 'ceil', ceilG, xf(cx, ch === '+' ? DOOR_H : H, cz));
                for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const n = MAP[j + dj]?.[i + di] ?? '.';
                    const ry = Math.atan2(-di, -dj);
                    const ex = cx + di * 0.5, ez = cz + dj * 0.5;
                    if (!openCh(n) || (n !== '+' && ch !== '+' && n !== ch)) {
                        B.add('wall' + (ch === '+' ? room : ch), wallG, xf(ex, 0, ez, ry));
                        // the doorway's jambs: chevrons where the door cell meets the wall
                        // (not across the open outer hatch, the airlock's way out)
                        if (ch === '+' && !(dj === 1 && Z0 + j === 5)) B.add('hazard', new THREE.BoxGeometry(1, DOOR_H, 0.06).translate(0, DOOR_H / 2, 0), xf(ex - di * 0.03, 0, ez - dj * 0.03, ry));
                    } else if (ch !== '+' && n === '+') {
                        B.add('trim', lintelG, xf(ex, 0, ez, ry));
                        B.add('frame', new THREE.BoxGeometry(1.0, 0.14, 0.12), xf(ex - di * 0.06, DOOR_H + 0.07, ez - dj * 0.06, ry));
                    }
                }
            }
        }
        const g = B.build(mats, { castShadow: false, receiveShadow: false });
        this.shipScene.add(g);
        g.traverse((m) => {
            if (m.isMesh && m.name.startsWith('floor')) this.floors.push(m);
        });
        // the labels over the doors, on the corridor side
        const label = (text, x, z, ry, col) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshStandardMaterial({ map: K.signTexture(text, '', col), emissive: 0xffffff, emissiveMap: K.signTexture(text, '', col), emissiveIntensity: 0.25, roughness: 0.6 }));
            m.position.set(x, (H + DOOR_H) / 2, z);
            m.rotation.y = ry;
            this.shipScene.add(m);
        };
        label('TRANSPORTER', -5, -0.97, 0, '#7ae8ff');
        label('CARGO HOLD', 5, -0.97, 0);
        label('AIRLOCK', 2, 0.97, Math.PI, '#ff7a6a');
        label('QUARTERS', 7, 0.97, Math.PI);
        label('ENGINE ROOM', -7.97, 0, Math.PI / 2, '#ff9a4a');
        label('COCKPIT', 9.97, 0, -Math.PI / 2);
        // and arrows down the corridor walls
        const arrow = (text, dir, x, z, ry) => {
            const t = K.signTexture(text, dir);
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.2 }));
            m.position.set(x, 1.75, z);
            m.rotation.y = ry;
            this.shipScene.add(m);
        };
        arrow('TRANSPORTER', '<', -1.6, -0.99, 0);
        arrow('COCKPIT', '>', 7.6, -0.99, 0);
        arrow('ENGINE', '>', -2.2, 0.99, Math.PI);
    }

    _lights() {
        const s = this.shipScene;
        s.add(new THREE.HemisphereLight(0x8aa0b8, 0x2a2420, this.tier === 'low' ? 1.7 : 1.1));
        s.add(new THREE.AmbientLight(0x30343c, 0.8));
        const few = this.tier === 'low';
        const L = (col, i, d, x, y, z, decay = 1.5) => {
            const l = new THREE.PointLight(col, i, d, decay);
            l.position.set(x, y, z);
            s.add(l);
            return l;
        };
        this.lights = {
            corridorA: L(0xffe0b0, 6, 9, -3, 2.5, 0),
            corridorB: L(0xffe0b0, 6, 9, 5, 2.5, 0),
            transporter: L(0x7ae8ff, 12, 10, PAD.x, 2.4, PAD.z),
            engine: L(0xff7a2a, 9, 10, -10.2, 2.3, 1.8),
            airlock: L(0xff3a2a, 3, 6, 2, 2.5, 3.5),
            cockpit: L(0x8ab0ff, 5, 7, 13.0, 2.3, 0),
            quarters: few ? null : L(0xffc890, 4, 7, 8, 2.4, 4),
            hold: few ? null : L(0xd8d8b0, 3, 7, 6, 2.4, -4),
        };
        // the spark's flash, moved to whichever wire is sparking
        this.flash = L(0xbfe0ff, 0, 7, 0, 2, 0, 2);
    }

    _corridor() {
        const B = new Batch();
        const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.75 });
        const pipe = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.45, metalness: 0.6 });
        const pipe2 = new THREE.MeshStandardMaterial({ color: 0x3a6a6a, roughness: 0.5, metalness: 0.5 });
        // ribs every two metres
        for (let x = -8; x <= 10; x += 2) {
            for (const s of [-1, 1]) B.add('chrome', new THREE.BoxGeometry(0.14, H, 0.12), xf(x, H / 2, s * 0.94));
            B.add('chrome', new THREE.BoxGeometry(0.14, 0.14, 2), xf(x, H - 0.07, 0));
        }
        // pipes along the ceiling's edges
        for (const [z, key, r] of [[0.78, 'pipe', 0.07], [-0.8, 'pipe2', 0.05], [-0.62, 'pipe', 0.035]]) {
            B.add(key, new THREE.CylinderGeometry(r, r, 18.5, 8).rotateZ(Math.PI / 2), xf(1, H - 0.25, z));
            for (let x = -7; x <= 9; x += 3) B.add('chrome', new THREE.TorusGeometry(r + 0.02, 0.012, 4, 10).rotateY(Math.PI / 2), xf(x, H - 0.25, z));
        }
        // a ceiling panel hanging down where the wires came loose, and one that fell
        B.add('chrome', new THREE.BoxGeometry(0.9, 0.03, 0.9), xf(-0.5, H - 0.42, 0.2, 0.2, 1, 1, 1, 0.55, 0.1));
        B.add('chrome', new THREE.BoxGeometry(0.9, 0.03, 0.9), xf(6.6, 0.05, 0.35, 0.7, 1, 1, 1, 0.05, 0.12));
        this.shipScene.add(B.build({ chrome, pipe, pipe2 }, { castShadow: false, receiveShadow: false }));
        // tube lights down the middle; some of them failing
        this.tubes = [];
        for (const x of [-6, -2, 2, 6, 9]) {
            const m = new THREE.MeshStandardMaterial({ color: 0x302820, emissive: 0xfff0c8, emissiveIntensity: 2 });
            const t = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.16), m);
            t.position.set(x, H - 0.04, 0);
            this.shipScene.add(t);
            this.tubes.push({ m, x, bad: x === -2 || x === 6, ph: x * 1.7 });
        }
        this.hits.push(this._hit(new THREE.BoxGeometry(1.4, 1.6, 1.4), -0.5, 2.2, 0.2, 'wires'));
    }

    _transporter() {
        const s = this.shipScene;
        const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.7 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.4, metalness: 0.6 });
        this.padMat = new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x7ae8ff, emissiveIntensity: 0.35, roughness: 0.2 });
        this.coilMat = new THREE.MeshStandardMaterial({ color: 0x103040, emissive: 0x7ae8ff, emissiveIntensity: 1.2, roughness: 0.3 });
        const g = new THREE.Group();
        g.position.set(PAD.x, 0, PAD.z);
        s.add(g);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(PAD.r + 0.15, PAD.r + 0.25, 0.1, 40), steel);
        base.position.y = 0.05;
        g.add(base);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(PAD.r, PAD.r, 0.02, 40), this.padMat);
        top.position.y = 0.11;
        g.add(top);
        for (let k = 1; k <= 3; k++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(PAD.r * (k / 3.4), 0.025, 4, 40).rotateX(Math.PI / 2), dark);
            ring.position.y = 0.125;
            g.add(ring);
        }
        // three coil pillars round the pad
        this.coils = [];
        for (let k = 0; k < 3; k++) {
            const a = Math.PI / 2 + (k / 3) * TAU + Math.PI / 3;
            const px = Math.cos(a) * (PAD.r + 0.5), pz = Math.sin(a) * (PAD.r + 0.5);
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, H, 10), steel);
            p.position.set(px, H / 2, pz);
            g.add(p);
            for (let c = 0; c < 5; c++) {
                const coil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 16).rotateX(Math.PI / 2), this.coilMat);
                coil.position.set(px, 0.6 + c * 0.38, pz);
                g.add(coil);
            }
            this.cols.push({ x: PAD.x + px, z: PAD.z + pz, r: 0.22 });
        }
        // the emitter overhead, and a column of faint light between it and the pad
        const em = new THREE.Mesh(new THREE.CylinderGeometry(PAD.r, PAD.r * 0.8, 0.15, 40), dark);
        em.position.y = H - 0.08;
        g.add(em);
        const emGlow = new THREE.Mesh(new THREE.CircleGeometry(PAD.r * 0.85, 40).rotateX(Math.PI / 2), this.padMat);
        emGlow.position.y = H - 0.16;
        g.add(emGlow);
        this.beamMat = new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const col = new THREE.Mesh(new THREE.CylinderGeometry(PAD.r * 0.95, PAD.r * 0.95, H - 0.3, 32, 1, true), this.beamMat);
        col.position.y = H / 2;
        g.add(col);

        // the console against the wall, facing the pad: dials, a screen, the lever
        const cx = -7.45, cz = PAD.z;
        const con = new THREE.Group();
        con.position.set(cx, 0, cz);
        s.add(con);
        const face = K.consoleTexture('transporter', '#7ae8ff');
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 2.2), new THREE.MeshStandardMaterial({ color: 0x5a6a70, roughness: 0.5, metalness: 0.4 }));
        body.position.set(0, 0.5, 0);
        con.add(body);
        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 2.1), new THREE.MeshStandardMaterial({ map: face, roughness: 0.5 }));
        desk.position.set(0.32, 1.12, 0);
        desk.rotation.z = -0.9;
        con.add(desk);
        // the screen on a hood above
        this.tScreen = K.crtScreen(320, 240);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0x4a5a60, roughness: 0.5, metalness: 0.4 }));
        hood.position.set(-0.1, 1.85, 0);
        con.add(hood);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.7), new THREE.MeshBasicMaterial({ map: this.tScreen.tex }));
        screen.position.set(0.16, 1.85, 0);
        screen.rotation.y = Math.PI / 2;
        con.add(screen);
        // the lever: pull it to go
        this.lever = new THREE.Group();
        this.lever.position.set(0.25, 1.05, 0.75);
        con.add(this.lever);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8).translate(0, 0.25, 0), steel);
        this.lever.add(shaft);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc8231b, roughness: 0.3, emissive: 0x400000 }));
        knob.position.y = 0.5;
        this.lever.add(knob);
        this.lever.rotation.z = 0.5;
        // the destination dial, a big brass knob with a pointer
        this.dial = new THREE.Group();
        this.dial.position.set(0.3, 1.2, -0.65);
        con.add(this.dial);
        const knobD = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.06, 18).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 0.3, metalness: 0.9 }));
        this.dial.add(knobD);
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.02), new THREE.MeshBasicMaterial({ color: 0x101010 }));
        tick.position.set(0.035, 0.05, 0);
        this.dial.add(tick);
        this.cols.push({ x: cx, z: cz - 0.6, r: 0.55 }, { x: cx, z: cz + 0.6, r: 0.55 });
        this.hits.push(this._hit(new THREE.BoxGeometry(1.0, 2.3, 2.3), cx, 1.15, cz, 'console'));
        this.hits.push(this._hit(new THREE.CylinderGeometry(PAD.r + 0.3, PAD.r + 0.3, 0.6, 16), PAD.x, 0.3, PAD.z, 'pad'));
        this.hits.push(this._hit(new THREE.BoxGeometry(0.4, 0.4, 0.4), cx + 0.3, 1.2, cz - 0.65, 'dial'));
    }

    _engine() {
        const s = this.shipScene;
        const C0 = { x: -12, z: 0 };
        const chrome = new THREE.MeshStandardMaterial({ color: 0xa8acb2, roughness: 0.35, metalness: 0.7 });
        const iron = new THREE.MeshStandardMaterial({ color: 0x3a3634, roughness: 0.6, metalness: 0.6 });
        const pipe = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.45, metalness: 0.6 });
        const red = new THREE.MeshStandardMaterial({ color: 0xb8231b, roughness: 0.4 });
        this.coreMat = new THREE.MeshStandardMaterial({ color: 0x401808, emissive: 0xff7a2a, emissiveIntensity: 1.5, roughness: 0.3 });
        const B = new Batch();
        B.add('iron', new THREE.CylinderGeometry(1.15, 1.25, H, 24), xf(C0.x, H / 2, C0.z));
        for (const y of [0.25, 1.0, 1.9, 2.65]) B.add('chrome', new THREE.TorusGeometry(1.2, 0.06, 6, 32).rotateX(Math.PI / 2), xf(C0.x, y, C0.z));
        // pipes from the pile out to the walls, with valve wheels on them
        for (const [a, y] of [[0.3, 2.3], [2.2, 1.6], [3.6, 2.5], [4.9, 1.2]]) {
            const len = 2.0;
            const px = C0.x + Math.cos(a) * (1.2 + len / 2), pz = C0.z + Math.sin(a) * (1.2 + len / 2);
            B.add('pipe', new THREE.CylinderGeometry(0.09, 0.09, len, 8).rotateZ(Math.PI / 2), xf(px, y, pz, -a));
            const wx = C0.x + Math.cos(a) * 2.0, wz = C0.z + Math.sin(a) * 2.0;
            B.add('red', new THREE.TorusGeometry(0.2, 0.03, 6, 14), xf(wx, y + 0.18, wz, -a + Math.PI / 2));
        }
        // gauges on the walls
        for (const [x, z, ry] of [[-14.95, -2, Math.PI / 2], [-14.95, 2, Math.PI / 2], [-10.5, -3.95, 0]]) {
            B.add('chrome', new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18).rotateX(Math.PI / 2), xf(x, 1.6, z, ry));
        }
        s.add(B.build({ iron, chrome, pipe, red }, { castShadow: false, receiveShadow: false }));
        // windows round the pile, glowing
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU;
            const w = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1.2), this.coreMat);
            w.position.set(C0.x + Math.cos(a) * 1.21, 1.45, C0.z + Math.sin(a) * 1.21);
            w.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
            s.add(w);
        }
        this.cols.push({ x: C0.x, z: C0.z, r: 1.35 });
        this.hits.push(this._hit(new THREE.CylinderGeometry(1.4, 1.4, H, 12), C0.x, H / 2, C0.z, 'reactor'));
        // a burst pipe venting steam
        this.steam = [];
        const SM = 14;
        for (let i = 0; i < SM; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xd8d8d8, transparent: true, opacity: 0, depthWrite: false }));
            s.add(sp);
            this.steam.push({ sp, t: i / SM });
        }
        this.steamAt = new V3(-14.7, 2.2, -3.2);
        // a red warning lamp on the wall, turning
        const lampM = new THREE.MeshStandardMaterial({ color: 0x401010, emissive: 0xff2a1a, emissiveIntensity: 2 });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, TAU, 0, Math.PI / 2), lampM);
        lamp.position.set(-9.6, 2.5, 3.85);
        lamp.rotation.x = -Math.PI / 2;
        s.add(lamp);
        this.warnSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xff2a1a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.warnSprite.scale.setScalar(1.4);
        this.warnSprite.position.copy(lamp.position);
        s.add(this.warnSprite);
    }

    _cockpit() {
        const s = this.shipScene;
        const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.75 });
        const leather = new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.7 });
        const panel = new THREE.MeshStandardMaterial({ color: 0x3a4248, roughness: 0.5, metalness: 0.4 });
        // the windscreen, with the earth she ploughed pressed against it
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.1), new THREE.MeshBasicMaterial({ map: K.dirtGlassTexture(), color: 0x8a8070 }));
        glass.position.set(15.97, 1.65, 0);
        glass.rotation.y = -Math.PI / 2;
        s.add(glass);
        const B = new Batch();
        B.add('chrome', new THREE.BoxGeometry(0.1, 0.12, 4), xf(15.92, 2.72, 0));
        B.add('chrome', new THREE.BoxGeometry(0.1, 0.12, 4), xf(15.92, 0.58, 0));
        for (const z of [-1.3, 0, 1.3]) B.add('chrome', new THREE.BoxGeometry(0.1, 2.2, 0.08), xf(15.92, 1.65, z));
        // the dashboard, under the windscreen
        B.add('panel', new THREE.BoxGeometry(0.9, 0.95, 3.9), xf(15.45, 0.47, 0));
        // the pilot's seat: empty, the harness unbuckled and hanging
        const seat = { x: 13.6, z: 0 };
        B.add('chrome', new THREE.CylinderGeometry(0.08, 0.2, 0.45, 10), xf(seat.x, 0.22, seat.z));
        B.add('leather', new THREE.BoxGeometry(0.7, 0.14, 0.7), xf(seat.x, 0.5, seat.z));
        B.add('leather', new THREE.BoxGeometry(0.14, 1.1, 0.7), xf(seat.x - 0.36, 1.05, seat.z, 0, 1, 1, 1, 0, 0.18));
        B.add('leather', new THREE.BoxGeometry(0.16, 0.3, 0.45), xf(seat.x - 0.5, 1.72, seat.z, 0, 1, 1, 1, 0, 0.18));
        for (const sz of [-1, 1]) {
            B.add('chrome', new THREE.BoxGeometry(0.6, 0.06, 0.08), xf(seat.x + 0.02, 0.78, seat.z + sz * 0.38));
            // the harness straps, hanging loose over the sides
            B.add('panel', new THREE.BoxGeometry(0.05, 0.7, 0.06), xf(seat.x - 0.2, 0.9, seat.z + sz * 0.4, 0, 1, 1, 1, sz * 0.3, 0.2));
        }
        // the yoke
        B.add('chrome', new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8).rotateZ(Math.PI / 2), xf(14.65, 0.95, 0));
        B.add('chrome', new THREE.TorusGeometry(0.2, 0.03, 6, 16, Math.PI).rotateY(Math.PI / 2), xf(14.35, 1.0, 0, 0, 1, 1, 1, 0, 0));
        s.add(B.build({ chrome, leather, panel }, { castShadow: false, receiveShadow: false }));
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.7), new THREE.MeshStandardMaterial({ map: K.consoleTexture('cockpit', '#f2c84a'), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.05 }));
        dash.position.set(15.0, 0.98, 0);
        dash.rotation.set(-Math.PI / 2 + 0.5, -Math.PI / 2, 0, 'YXZ');
        s.add(dash);
        // blinking lights along the dash
        this.blinks = [];
        const br = rng('cockpit-blinks');
        for (let i = 0; i < 12; i++) {
            const m = new THREE.MeshStandardMaterial({ color: 0x101010, emissive: br.pick([0xff3a2a, 0x3aff7a, 0xffd04a, 0x7ae8ff]), emissiveIntensity: 1.5 });
            const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), m);
            b.position.set(15.1, 0.99, -1.7 + i * 0.31);
            s.add(b);
            this.blinks.push({ m, rate: br.range(0.5, 3), ph: br() * TAU });
        }
        // the screen that keeps the log: it says where the pilot went
        this.pScreen = K.crtScreen(320, 200);
        const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ map: this.pScreen.tex }));
        sc.position.set(15.5, 1.25, 1.15);
        sc.rotation.y = -Math.PI / 2 - 0.25;
        s.add(sc);
        this.cols.push({ x: seat.x, z: seat.z, r: 0.5 }, { x: 15.45, z: -1.2, r: 0.5 }, { x: 15.45, z: 0, r: 0.5 }, { x: 15.45, z: 1.2, r: 0.5 });
        this.hits.push(this._hit(new THREE.BoxGeometry(1.0, 1.9, 1.0), seat.x - 0.1, 0.95, seat.z, 'seat'));
        this.hits.push(this._hit(new THREE.BoxGeometry(0.9, 1.4, 3.9), 15.4, 0.7, 0, 'dash'));
        this.hits.push(this._hit(new THREE.BoxGeometry(0.2, 2.1, 3.9), 15.9, 1.65, 0, 'glass'));
    }

    _airlock() {
        const s = this.shipScene;
        const suit = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.55, metalness: 0.2 });
        const orange = new THREE.MeshStandardMaterial({ color: 0xd86a1a, roughness: 0.5 });
        const glass = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false });
        const brass = new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 0.3, metalness: 0.9 });
        // the suit rack on the west wall: two suits and an empty hook
        const B = new Batch();
        B.add('brass', new THREE.BoxGeometry(0.06, 0.06, 2.6), xf(0.12, 2.05, 3.4));
        for (const [i, z] of [2.6, 3.4, 4.2].entries()) {
            B.add('brass', new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6).rotateZ(Math.PI / 2), xf(0.24, 2.0, z));
            if (i === 2) continue;
            B.add('suit', new THREE.CylinderGeometry(0.22, 0.2, 0.75, 10), xf(0.38, 1.55, z));
            B.add('orange', new THREE.BoxGeometry(0.06, 0.2, 0.26), xf(0.6, 1.62, z));
            for (const sz of [-1, 1]) {
                B.add('suit', new THREE.CylinderGeometry(0.06, 0.055, 0.6, 8), xf(0.38, 1.35, z + sz * 0.27));
                B.add('suit', new THREE.CylinderGeometry(0.08, 0.07, 0.75, 8), xf(0.38, 0.8, z + sz * 0.1));
                B.add('orange', new THREE.BoxGeometry(0.22, 0.1, 0.13), xf(0.45, 0.38, z + sz * 0.1));
            }
            // the fishbowl helmet on the shelf above
            B.add('brass', new THREE.TorusGeometry(0.18, 0.03, 6, 16).rotateX(Math.PI / 2), xf(0.32, 2.42, z));
        }
        B.add('brass', new THREE.BoxGeometry(0.4, 0.04, 2.6), xf(0.2, 2.38, 3.4));
        s.add(B.build({ brass, suit, orange }, { castShadow: false, receiveShadow: false }));
        for (const z of [2.6, 3.4]) {
            const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), glass);
            h.position.set(0.32, 2.62, z);
            s.add(h);
        }
        // the name over the empty hook
        const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.14), new THREE.MeshStandardMaterial({ map: K.noteTexture(['  J.S.']), roughness: 0.8 }));
        tag.position.set(0.03, 1.8, 4.2);
        tag.rotation.y = Math.PI / 2;
        s.add(tag);
        this.cols.push({ x: 0.35, z: 2.6, r: 0.35 }, { x: 0.35, z: 3.4, r: 0.35 });
        this.hits.push(this._hit(new THREE.BoxGeometry(0.8, 2.6, 2.5), 0.35, 1.3, 3.4, 'suits'));
        // the outer hatch: daylight through it
        this.daylight = new THREE.Mesh(new THREE.PlaneGeometry(2, DOOR_H), new THREE.MeshBasicMaterial({ color: 0xfff4dc }));
        this.daylight.position.set(2, DOOR_H / 2, 5.99);
        this.daylight.rotation.y = Math.PI;
        s.add(this.daylight);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xfff0d0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.set(4, 3, 1);
        glow.position.set(2, 1.2, 5.6);
        s.add(glow);
        this.hits.push(this._hit(new THREE.BoxGeometry(2, DOOR_H, 0.6), 2, DOOR_H / 2, 5.6, 'hatch'));
    }

    _quarters() {
        const s = this.shipScene;
        const frame = new THREE.MeshStandardMaterial({ color: 0xa8acb2, roughness: 0.35, metalness: 0.7 });
        const blanket = new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.9 });
        const blanket2 = new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.9 });
        const pillow = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9 });
        const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.7 });
        const B = new Batch();
        // bunks along the back wall
        for (const [bx, key] of [[6.2, 'blanket'], [9.6, 'blanket2']]) {
            for (const y of [0.45, 1.55]) {
                B.add('frame', new THREE.BoxGeometry(2.0, 0.08, 0.9), xf(bx, y, 5.5));
                B.add(y > 1 ? 'blanket2' : key, new THREE.BoxGeometry(1.9, 0.16, 0.85), xf(bx, y + 0.12, 5.5));
                B.add('pillow', new THREE.BoxGeometry(0.4, 0.12, 0.6), xf(bx - 0.72, y + 0.26, 5.5));
            }
            for (const ex of [-1, 1]) B.add('frame', new THREE.BoxGeometry(0.06, 2.0, 0.06), xf(bx + ex * 0.98, 1.0, 5.05));
        }
        // a little table with a cup on it, and a stool
        B.add('wood', new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20), xf(8.2, 0.75, 3.1));
        B.add('frame', new THREE.CylinderGeometry(0.05, 0.08, 0.75, 8), xf(8.2, 0.37, 3.1));
        B.add('pillow', new THREE.CylinderGeometry(0.05, 0.04, 0.1, 10), xf(8.05, 0.83, 3.0));
        B.add('frame', new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), xf(8.9, 0.45, 3.6));
        B.add('frame', new THREE.CylinderGeometry(0.03, 0.05, 0.45, 6), xf(8.9, 0.22, 3.6));
        s.add(B.build({ frame, blanket, blanket2, pillow, wood }, { castShadow: false, receiveShadow: false }));
        const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.05), new THREE.MeshStandardMaterial({ map: K.posterTexture(), roughness: 0.8 }));
        poster.position.set(10.97, 1.6, 3.4);
        poster.rotation.y = -Math.PI / 2;
        s.add(poster);
        const note = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.33), new THREE.MeshStandardMaterial({ map: K.noteTexture(['Gone through', 'again. Back by', 'supper.   — J.S.']), roughness: 0.85 }));
        note.position.set(9.4, 1.55, 2.02);
        s.add(note);
        this.cols.push({ x: 6.2, z: 5.5, r: 0.55 }, { x: 5.6, z: 5.5, r: 0.5 }, { x: 6.8, z: 5.5, r: 0.5 }, { x: 9.6, z: 5.5, r: 0.55 }, { x: 9.0, z: 5.5, r: 0.5 }, { x: 10.2, z: 5.5, r: 0.5 }, { x: 8.2, z: 3.1, r: 0.55 }, { x: 8.9, z: 3.6, r: 0.25 });
        this.hits.push(this._hit(new THREE.BoxGeometry(0.6, 0.5, 0.2), 9.4, 1.55, 2.1, 'note'));
        this.hits.push(this._hit(new THREE.BoxGeometry(0.2, 1.1, 0.8), 10.9, 1.6, 3.4, 'poster'));
        this.hits.push(this._hit(new THREE.BoxGeometry(5.2, 2.0, 1.0), 7.9, 1.0, 5.5, 'bunks'));
    }

    _hold() {
        const s = this.shipScene;
        const crateMats = ['RATIONS', 'SPARES', 'FUEL RODS', 'OXYGEN'].map((l) => new THREE.MeshStandardMaterial({ map: K.crateTexture(l), roughness: 0.8 }));
        const r = rng('hold');
        const put = (x, z, sz, y = 0, rot = 0, k = 0) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), crateMats[k % crateMats.length]);
            m.position.set(x, y + sz / 2, z);
            m.rotation.y = rot;
            s.add(m);
        };
        put(3.7, -5.4, 0.9, 0, 0.1, 0);
        put(3.75, -5.35, 0.7, 0.9, -0.2, 1);
        put(4.8, -5.4, 0.9, 0, -0.05, 2);
        put(8.3, -5.3, 0.9, 0, 0.3, 3);
        put(8.2, -4.2, 0.8, 0, -0.4, 0);
        put(6.6, -5.5, 0.7, 0, 0.8, 1);
        // one that burst open, its oxygen canisters rolled across the floor
        const can = new THREE.MeshStandardMaterial({ color: 0x3a8a3a, roughness: 0.4, metalness: 0.5 });
        for (let i = 0; i < 5; i++) {
            const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10).rotateZ(Math.PI / 2), can);
            c.position.set(5.2 + r() * 2, 0.09, -3.4 - r() * 1.2);
            c.rotation.y = r() * TAU;
            s.add(c);
        }
        // a rack of ray guns on the west wall
        const gun = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 0.8 });
        const fin = new THREE.MeshStandardMaterial({ color: 0xb8231b, roughness: 0.4 });
        for (let i = 0; i < 3; i++) {
            const g = new THREE.Group();
            g.position.set(3.08, 1.5, -5.2 + i * 0.55);
            g.rotation.y = Math.PI / 2;
            s.add(g);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.38, 10).rotateX(Math.PI / 2), gun);
            g.add(barrel);
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gun);
            bulb.position.z = -0.18;
            g.add(bulb);
            for (let k = 0; k < 3; k++) {
                const f = new THREE.Mesh(new THREE.TorusGeometry(0.05 + k * 0.004, 0.012, 4, 14), fin);
                f.position.z = 0.02 + k * 0.07;
                g.add(f);
            }
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.05), fin);
            grip.position.set(0, -0.1, -0.12);
            grip.rotation.x = 0.3;
            g.add(grip);
        }
        this.cols.push({ x: 3.8, z: -5.4, r: 0.6 }, { x: 4.8, z: -5.4, r: 0.6 }, { x: 8.3, z: -5.3, r: 0.6 }, { x: 8.2, z: -4.2, r: 0.55 }, { x: 6.6, z: -5.5, r: 0.5 });
        this.hits.push(this._hit(new THREE.BoxGeometry(0.3, 0.6, 1.8), 3.15, 1.5, -4.65, 'rayguns'));
        this.hits.push(this._hit(new THREE.BoxGeometry(1.2, 0.5, 1.4), 6.2, 0.2, -3.9, 'oxygen'));
    }

    /** Wires hanging out of the ceiling in five places, each sparking now and then. */
    _sparks() {
        const s = this.shipScene;
        const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
        const rubber2 = new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.7 });
        const spots = [[-0.4, 0.3, 1.1], [-0.7, -0.1, 0.9], [7.4, -0.5, 1.2], [-11.2, 2.8, 1.0], [12.4, 1.6, 0.9], [6.8, -4.0, 1.1], [-3.4, -5.6, 0.7]];
        spots.forEach(([x, z, len], i) => {
            const w = K.hangingWire(x, z, len, 'wire' + i);
            s.add(new THREE.Mesh(w.geo, i % 2 ? rubber2 : rubber));
            this.sparkSpots.push({ p: w.end, next: 1 + Math.random() * 4, sputter: 0 });
        });
        const N = 90;
        this.sp = { n: N, pos: new Float32Array(N * 3), col: new Float32Array(N * 3), v: new Float32Array(N * 3), life: new Float32Array(N), i: 0 };
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.sp.pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(this.sp.col, 3));
        this.sp.geo = g;
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowSprite(), size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        pts.frustumCulled = false;
        s.add(pts);
    }

    _spark(spot) {
        const S = this.sp;
        const n = 6 + Math.floor(Math.random() * 10);
        for (let k = 0; k < n; k++) {
            const i = S.i++ % S.n;
            S.pos[i * 3] = spot.p.x;
            S.pos[i * 3 + 1] = spot.p.y;
            S.pos[i * 3 + 2] = spot.p.z;
            S.v[i * 3] = (Math.random() - 0.5) * 3;
            S.v[i * 3 + 1] = Math.random() * 1.5 - 0.3;
            S.v[i * 3 + 2] = (Math.random() - 0.5) * 3;
            S.life[i] = 0.3 + Math.random() * 0.5;
        }
        this.flash.position.copy(spot.p);
        this.flash.intensity = 10;
        if (this.controls) {
            const d = Math.hypot(this.controls.pos.x - spot.p.x, this.controls.pos.z - spot.p.z);
            this.sound?.spark(clamp(1 - d / 14, 0, 1));
        }
    }

    _updateSparks(dt) {
        for (const s of this.sparkSpots) {
            s.next -= dt;
            if (s.next <= 0) {
                // a sputter of two or three, then quiet
                if (s.sputter <= 0) s.sputter = 1 + Math.floor(Math.random() * 3);
                s.sputter--;
                s.next = s.sputter > 0 ? 0.08 + Math.random() * 0.2 : 2 + Math.random() * 6;
                this._spark(s);
            }
        }
        const S = this.sp;
        for (let i = 0; i < S.n; i++) {
            if (S.life[i] > 0) {
                S.life[i] -= dt;
                S.v[i * 3 + 1] -= 9.8 * dt;
                S.pos[i * 3] += S.v[i * 3] * dt;
                S.pos[i * 3 + 1] = Math.max(0.02, S.pos[i * 3 + 1] + S.v[i * 3 + 1] * dt);
                S.pos[i * 3 + 2] += S.v[i * 3 + 2] * dt;
            }
            const a = Math.max(0, S.life[i]) * 2.4;
            S.col[i * 3] = a * 0.9;
            S.col[i * 3 + 1] = a * 0.95;
            S.col[i * 3 + 2] = a;
            if (S.life[i] <= 0) S.pos[i * 3 + 1] = -50;
        }
        S.geo.attributes.position.needsUpdate = true;
        S.geo.attributes.color.needsUpdate = true;
        this.flash.intensity *= Math.exp(-dt * 18);
    }

    /** The shimmer of a body coming or going: motes spiralling up round the player. */
    _shimmer() {
        const N = 160;
        const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            seed[i * 3] = Math.random() * TAU;
            seed[i * 3 + 1] = Math.random();
            seed[i * 3 + 2] = 0.25 + Math.random() * 0.4;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const m = new THREE.PointsMaterial({ map: glowSprite(), size: 0.12, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const pts = new THREE.Points(g, m);
        pts.frustumCulled = false;
        this.shim = { pts, g, pos, col, seed, N, amt: 0 };
    }

    _updateShimmer(t, x, y, z, amt) {
        const S = this.shim;
        S.pts.visible = amt > 0.01;
        if (!S.pts.visible) return;
        for (let i = 0; i < S.N; i++) {
            const a = S.seed[i * 3] + t * (2 + S.seed[i * 3 + 1] * 3);
            const u = (S.seed[i * 3 + 1] + t * 0.6) % 1;
            const r = S.seed[i * 3 + 2];
            S.pos[i * 3] = x + Math.cos(a) * r;
            S.pos[i * 3 + 1] = y + u * 2.1;
            S.pos[i * 3 + 2] = z + Math.sin(a) * r;
            const k = amt * Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(t * 20 + i));
            S.col[i * 3] = 0.5 * k;
            S.col[i * 3 + 1] = 0.9 * k;
            S.col[i * 3 + 2] = 1.0 * k;
        }
        S.g.attributes.position.needsUpdate = true;
        S.g.attributes.color.needsUpdate = true;
    }

    _hit(geo, x, y, z, kind) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
        m.position.set(x, y, z);
        m.userData.kind = kind;
        this.shipScene.add(m);
        return m;
    }

    // ------------------------------------------------------------ the panel

    _dom() {
        this.dom = {
            root: $('rocket-hud'), where: $('rk-where'), whereLabel: $('rk-where-label'), trips: $('rk-trips'),
            o2row: $('rk-o2-row'), o2: $('rk-o2'), o2bar: $('rk-o2-bar'), signal: $('rk-signal'), species: $('rk-species'),
            go: $('rk-go'), pilot: $('rk-pilot'), recall: $('rk-recall'), leave: $('rk-leave'), fx: $('beam-fx'),
            note: $('pilot-note'), noteBody: $('pilot-note-body'), noteClose: $('pilot-note-close'),
        };
        const d = this.dom;
        d.go?.addEventListener('click', () => {
            this.env.audio?.click();
            this.energize('random');
        });
        d.pilot?.addEventListener('click', () => {
            this.env.audio?.click();
            this.energize('pilot');
        });
        d.recall?.addEventListener('click', () => {
            this.env.audio?.click();
            this.recall('early');
        });
        d.leave?.addEventListener('click', () => {
            this.env.audio?.click();
            this.leaveShip();
        });
        d.noteClose?.addEventListener('click', () => this.closeLog());
        d.note?.addEventListener('pointerdown', (e) => {
            if (e.target === d.note) this.closeLog();
        });
        addEventListener('keydown', (e) => {
            if (!this.logOpen) return;
            if (e.key === 'Escape') this.closeLog();
            e.stopImmediatePropagation();
        }, true);
    }

    _hud() {
        const d = this.dom;
        if (!d.root) return;
        const planet = this.onPlanet || this.state === 'charge';
        d.trips.textContent = String(this.save.trips);
        if (d.species) d.species.textContent = String(this.save.species.length);
        d.o2row.hidden = !(this.state === 'planet' || this.state === 'arrive' || this.state === 'recall' || this.state === 'faint');
        d.go.hidden = planet;
        d.leave.hidden = planet;
        d.pilot.hidden = planet || !this.save.pilot;
        if (this.save.pilot) d.pilot.textContent = `Dial ${this.save.pilot.name}`;
        d.recall.hidden = this.state !== 'planet';
        if (this.state === 'planet' || this.state === 'arrive') {
            d.whereLabel.textContent = this.info?.label || 'A world';
            d.where.textContent = this.info?.name || '';
        } else {
            d.whereLabel.textContent = `Aboard the ${SHIP_NAME}`;
            d.where.textContent = ROOMS[this.roomCh]?.name.replace(/^The /, '') ?? 'Doorway';
        }
        for (const b of [d.go, d.pilot, d.leave, d.recall]) if (b) b.disabled = this.busy;
    }

    _o2Hud() {
        const d = this.dom;
        if (!d.o2) return;
        const k = clamp(this.o2 / this.o2Max, 0, 1);
        const s = Math.max(0, Math.ceil(this.o2));
        d.o2.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        d.o2bar.style.transform = `scaleX(${k})`;
        d.root.classList.toggle('rk-low', k < 0.3);
        d.root.classList.toggle('rk-critical', k < 0.12);
    }

    // ------------------------------------------------------------ in and out

    /** Up the ramp and through the hatch. */
    enter(controls, camera) {
        this.controls = controls;
        this.camera = camera;
        this.inside = true;
        this.state = 'ship';
        this.world = this.shipWorld;
        controls.world = this.shipWorld;
        controls.gravity = 1;
        controls.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
        controls.enabled = true;
        this.exitArmed = false;
        this.roomCh = 'A';
        this.seenRooms = new Set(['A']);
        if (this.dom.root) this.dom.root.hidden = false;
        document.body.classList.add('in-rocket');
        this.sound?.start();
        this.sound?.setMode('ship');
        this._drawScreens(true);
        this._hud();
        this.env.ui?.zone(`The ${SHIP_NAME}`, 'Crashed, and still sparking', ROCKET_ACCENT);
        if (!this.save.intro) {
            this.save.intro = 1;
            this._store();
            const touch = matchMedia('(pointer: coarse)').matches;
            setTimeout(() => this.inside && this.state === 'ship' && this.env.ui?.hint(`Mind the wires · one room still has power: follow the signs to the transporter and ${touch ? 'tap' : 'click'} its lever (or Energize) · the hatch behind you leads out`, 11000), 1400);
        }
    }

    /** Back on the island: the camera is the garden's again. */
    leave() {
        if (!this.inside) return;
        this.inside = false;
        this.state = 'out';
        this.shipScene.add(this.shim.pts);
        if (this.planet.built) this.planet.dispose();
        if (this.controls) {
            this.controls.gravity = 1;
            this.controls.enabled = true;
        }
        if (this.dom.root) this.dom.root.hidden = true;
        if (this.dom.fx) this.dom.fx.style.opacity = '0';
        document.body.classList.remove('in-rocket');
        this.sound?.stop();
        this.closeLog();
    }

    /** Walk to the hatch and out. */
    leaveShip() {
        if (this.state !== 'ship' || !this.controls) return;
        const c = this.controls;
        this.exitArmed = true;
        c.walkTo([{ x: 2, z: 4.6 }, { x: 2, z: 5.6 }]);
    }

    // ------------------------------------------------------------ the transporter

    /** Pull the lever: walk onto the pad first if you are not on it. `dest` is 'random' or 'pilot'. */
    energize(dest = 'random') {
        if (this.state !== 'ship' || !this.controls) return;
        if (dest === 'pilot' && !this.save.pilot) dest = 'random';
        const c = this.controls;
        const d = Math.hypot(c.pos.x - PAD.x, c.pos.z - PAD.z);
        if (d > 0.6) {
            c.walkTo([{ x: PAD.x, z: PAD.z }]);
            if (c.route) c.route.then = () => this.energize(dest);
            this.env.ui?.hint('To the transporter pad…', 2500);
            return;
        }
        this.dest = dest;
        this.state = 'charge';
        this.bT = 0;
        c.enabled = false;
        c.route = null;
        this.sound?.energize(CHARGE);
        this.env.ui?.tooltip?.(null);
        this._hud();
    }

    /** Make the next world. */
    _makeWorld() {
        let seed, key, pilot;
        if (this.dest === 'pilot' && this.save.pilot) {
            seed = this.save.pilot.seed;
            key = this.save.pilot.key;
            pilot = true;
        } else {
            seed = (Math.random() * 4294967296) >>> 0;
            key = this.forceBiome ?? biomeFor(seed, this.save.last);
            // one world in five, until the pilot is found (and never again after)
            pilot = !this.save.pilot && (this.forcePilot ?? Math.random() < PILOT_ODDS);
        }
        this.shipScene.add(this.shim.pts);   // (out of the old world before it is cleared away)
        const info = this.planet.build(seed, { biome: key, pilot });
        this.info = info;
        this.planet.scene.add(this.shim.pts);
        if (this.planet.pilot && this.save.pilot && this.save.pilot.seed === seed) this.planet.pilot.found = true;
        this.save.trips++;
        this.save.last = key;
        this.save.worlds.push({ name: info.name, key, seed });
        this.save.worlds = this.save.worlds.slice(-12);
        this._store();
        return info;
    }

    _arrivePlanet() {
        const c = this.controls;
        try {
            this._makeWorld();
        } catch (e) {
            console.error(e);
            this.planet.dispose();
            this.state = 'ship';
            c.enabled = true;
            this.env.ui?.hint('The transporter coughs and nothing happens. Try the lever again.', 5000);
            this._hud();
            return;
        }
        this.world = this.planet.world;
        c.world = this.planet.world;
        c.gravity = this.info.gravity;
        const sp = this.planet.spawn;
        c.teleport(sp.x, sp.z, sp.yaw);
        c.pitch = 0.08;
        this.camera.position.set(sp.x, this.planet.world.walkHeight(sp.x, sp.z) + 1.65, sp.z);
        this.camera.rotation.set(c.pitch, c.yaw, 0, 'YXZ');
        this.o2Max = this.info.o2;
        this.o2 = this.o2Max;
        this.warned = 0;
        this.edgeHint = false;
        this.pingAt = 0;
        this.logged = new Set();
        this.state = 'arrive';
        this.bT = 0;
        this.sound?.setMode('planet', { wind: this.info.key === 'moon' ? 0 : 0.3 + Math.random() * 0.6, pitch: Math.random() });
        this.sound?.arrive();
        this._hud();
    }

    /** Back to the ship: `why` is 'early' (you asked), 'air' (it ran out). */
    recall(why = 'early') {
        if (this.state !== 'planet') return;
        this.why = why;
        this.state = 'recall';
        this.bT = 0;
        this.controls.enabled = false;
        this.controls.route = null;
        this.sound?.energize(RECALL);
        this._hud();
    }

    _faint() {
        this.why = 'air';
        this.state = 'faint';
        this.bT = 0;
        this.controls.enabled = false;
        this.controls.route = null;
        this.sound?.gasp();
        this.env.ui?.fadeBlack(true);
        this._hud();
    }

    _arriveShip() {
        const c = this.controls;
        this.shipScene.add(this.shim.pts);
        this.planet.dispose();
        this.world = this.shipWorld;
        c.world = this.shipWorld;
        c.gravity = 1;
        c.teleport(PAD.x, PAD.z, Math.PI * 0.85);
        c.pitch = 0;
        this.camera.position.set(PAD.x, 1.65, PAD.z);
        this.camera.rotation.set(0, c.yaw, 0, 'YXZ');
        this.state = 'return';
        this.bT = 0;
        this.sound?.setMode('ship');
        this.sound?.arrive();
        if (this.why === 'air') {
            this.env.ui?.fadeBlack(false);
            setTimeout(() => this.inside && this.env.ui?.hint('Your air ran out, and the recall pulled you home just in time', 6000), 600);
        }
        this._drawScreens(true);
        this._hud();
    }

    // ------------------------------------------------------------ the pilot

    _foundPilot() {
        const pl = this.planet.pilot;
        if (!pl || pl.found) return;
        pl.found = true;
        this.save.pilot = { seed: this.planet.seed, key: this.info.key, name: this.info.name, at: Date.now() };
        this._store();
        this.sound?.found();
        this.env.ui?.zone('The pilot', `of the ${SHIP_NAME}, who tried to go home`, ROCKET_ACCENT);
        setTimeout(() => this.inside && this.state === 'planet' && this.openLog(), 2200);
        this._hud();
    }

    /** The flight log, from the pilot's lap. */
    openLog() {
        const d = this.dom;
        if (!d.note || !d.noteBody) return;
        const name = esc(this.save.pilot?.name || this.info?.name || 'this world');
        d.noteBody.innerHTML = `
            <p><strong>Day 1.</strong> Came down hard on an island with a garden on it, and took half a grove with me. Sorry about the trees. The engine's gone and the radio's gone. Nobody on the island seems to see me. I think it's that kind of island.</p>
            <p><strong>Day 6.</strong> The transporter still works, but it won't hold a course: every time I pull the lever it throws me somewhere new. Somewhere out there is a ship, or a radio, or a way home.</p>
            <p><strong>Day 14.</strong> Nine worlds. No ship. The recall burned out on the last trip and I walked back to the beacon with the air alarm screaming. Patched it with wire from the galley toaster. It'll pull whoever goes through home when their air runs low.</p>
            <p><strong>Day 15.</strong> Last full tank. One more try.</p>
            <p class="np-shaky"><strong>${name}.</strong> The recall didn't come. The toaster wire, I expect. The air's going, and the view is really something. If you're reading this you came through the Comet's transporter, and the recall works for you, so go home when it pulls. Tell the garden I liked it.</p>
            <p class="np-sign">J. Starling, pilot, ${esc(SHIP_NAME)} SC-7</p>`;
        d.note.hidden = false;
        this.logOpen = true;
        if (this.controls) this.controls.enabled = false;
        d.noteClose?.focus({ preventScroll: true });
    }

    closeLog() {
        if (!this.logOpen) return;
        this.logOpen = false;
        if (this.dom.note) this.dom.note.hidden = true;
        if (this.controls && (this.state === 'planet' || this.state === 'ship')) this.controls.enabled = true;
    }

    // ------------------------------------------------------------ screens

    _drawScreens(force) {
        const t = this.clock;
        if (!force && this._scrT && t - this._scrT < 0.12) return;
        this._scrT = t;
        const p = this.save.pilot;
        const charging = this.state === 'charge';
        this.tScreen.draw((g, w, h) => {
            g.fillStyle = '#5affb0';
            g.font = 'bold 20px "Courier New", monospace';
            g.fillText('TRANSPORTER', 16, 30);
            g.fillText(charging ? 'ENERGIZING' : 'READY', 190, 30);
            g.font = '16px "Courier New", monospace';
            g.fillText(`LOCK ...... ${charging && this.dest === 'pilot' ? 'PILOT' : 'RANDOM'}`, 16, 60);
            g.fillText(`WORLDS .... ${this.save.trips}`, 16, 82);
            g.fillText(`RECALL .... AUTO @ LOW AIR`, 16, 104);
            if (p) {
                g.fillStyle = '#ffd25a';
                g.fillText(`PILOT ..... ${p.name.toUpperCase().slice(0, 14)}`, 16, 126);
            }
            // the wave
            g.strokeStyle = '#5affb0';
            g.lineWidth = 2;
            g.beginPath();
            const amp = charging ? 22 + (this.bT / CHARGE) * 20 : 10;
            const f = charging ? 0.15 + (this.bT / CHARGE) * 0.3 : 0.08;
            for (let x = 0; x <= w; x += 4) {
                const y = 185 + Math.sin(x * f + t * 6) * amp * Math.sin(x * 0.02 + t);
                x ? g.lineTo(x, y) : g.moveTo(x, y);
            }
            g.stroke();
            if (Math.floor(t * 2) % 2) g.fillRect(16, 222, 10, 4);
        });
        if (force || Math.floor(t * 2) !== this._pBlink) {
            this._pBlink = Math.floor(t * 2);
            this.pScreen.draw((g) => {
                g.fillStyle = '#5affb0';
                g.font = 'bold 18px "Courier New", monospace';
                g.fillText('SC-7 · FLIGHT LOG', 14, 28);
                g.font = '15px "Courier New", monospace';
                g.fillText('PILOT ... J. STARLING', 14, 58);
                if (p) {
                    g.fillStyle = '#ffd25a';
                    g.fillText('STATUS .. FOUND', 14, 82);
                    g.fillText(`ON ...... ${p.name.toUpperCase().slice(0, 14)}`, 14, 106);
                } else {
                    g.fillStyle = this._pBlink % 2 ? '#ff6a5a' : '#5affb0';
                    g.fillText('STATUS .. NO SIGNAL', 14, 82);
                    g.fillStyle = '#5affb0';
                    g.fillText('LAST .... TRANSPORTER', 14, 106);
                }
                g.fillStyle = '#5affb0';
                g.fillText('HULL .... BREACHED', 14, 140);
                g.fillText('ENGINE .. OFFLINE', 14, 162);
            });
        }
    }

    // ------------------------------------------------------------ every frame

    update(dt, t, camera) {
        if (!this.inside) return;
        this.clock += dt;
        const c = this.controls;
        if (this.onPlanet) this._planetFrame(dt, t, camera);
        else this._shipFrame(dt, t);
        this._beams(dt, t);
        this.sound?.update(dt, { airLeft: this.o2Max ? this.o2 / this.o2Max : 1, calls: this.planet.creatures?.length ?? 0, airless: this.info?.key === 'moon' });
        if (Math.floor(this.clock * 4) !== this._hudT) {
            this._hudT = Math.floor(this.clock * 4);
            this._hud();
        }
        return c;
    }

    _shipFrame(dt, t) {
        const p = this.controls.pos;
        // which room you are in
        const ch = cellAt(p.x, p.z);
        if (ch !== '+' && ch !== this.roomCh && ROOMS[ch]) {
            this.roomCh = ch;
            if (!this.seenRooms.has(ch)) {
                this.seenRooms.add(ch);
                if (ch === 'T') this.env.ui?.zone('The Transporter Room', 'The only room with the power on', '#7ae8ff');
                else if (ch === 'P') this.env.ui?.zone('The Cockpit', 'Nose down in the earth', ROCKET_ACCENT);
                else if (ch === 'E') this.env.ui?.zone('The Engine Room', 'The pile is still warm', '#ff9a4a');
            }
        }
        // out through the hatch
        if (this.state === 'ship') {
            if (p.z < 4.4) this.exitArmed = true;
            if (this.exitArmed && p.z > 5.25 && p.x > 0.9 && p.x < 3.1) {
                this.exitArmed = false;
                this.state = 'out-going';
                this.onExit?.();
                return;
            }
        }
        // the corridor's tube lights: two of them failing
        let fl = 0;
        for (const tb of this.tubes) {
            if (!tb.bad) continue;
            const on = Math.sin(t * 7 + tb.ph) * Math.sin(t * 2.3 + tb.ph * 2) > -0.35 || Math.sin(t * 31) > 0.9;
            tb.m.emissiveIntensity = on ? 2 : 0.05;
            if (!on) fl++;
        }
        if (fl && Math.random() < dt * 2) this.sound?.flicker();
        this.lights.corridorA.intensity = 6 * (this.tubes[1].m.emissiveIntensity > 1 ? 1 : 0.35);
        this.lights.corridorB.intensity = 6 * (this.tubes[3].m.emissiveIntensity > 1 ? 1 : 0.4);
        if (this.lights.hold) this.lights.hold.intensity = 3 * (Math.sin(t * 11) > -0.8 ? 1 : 0.2);
        // the pile breathes, the lamp turns, steam
        const br = 0.75 + 0.25 * Math.sin(t * 1.3) + 0.08 * Math.sin(t * 7.1);
        this.coreMat.emissiveIntensity = 1.2 * br;
        this.lights.engine.intensity = 9 * br;
        const ph = (t * 1.6) % 1;
        this.warnSprite.material.opacity = ph < 0.5 ? 0.7 : 0.1;
        this.lights.airlock.intensity = 2 + 1.5 * Math.max(0, Math.sin(t * 3));
        for (const s of this.steam) {
            const u = (s.t + t * 0.8) % 1;
            s.sp.position.set(this.steamAt.x + u * 2.2, this.steamAt.y + u * 0.6, this.steamAt.z + u * 0.4 + Math.sin(u * 7 + s.t * 9) * 0.1);
            s.sp.scale.setScalar(0.2 + u * 1.4);
            s.sp.material.opacity = (1 - u) * 0.35 * smoothstep(0, 0.1, u);
        }
        for (const b of this.blinks) b.m.emissiveIntensity = Math.sin(t * b.rate + b.ph) > 0.2 ? 1.8 : 0.1;
        // the transporter hums, harder as it charges
        const k = this.state === 'charge' ? clamp(this.bT / CHARGE, 0, 1) : 0;
        this.padMat.emissiveIntensity = 0.3 + 0.1 * Math.sin(t * 3) + k * 3;
        this.coilMat.emissiveIntensity = 0.6 + 0.25 * Math.sin(t * 9) + k * 4;
        this.beamMat.opacity = 0.04 + 0.02 * Math.sin(t * 4) + k * 0.4;
        this.lights.transporter.intensity = 12 + k * 30;
        this.lever.rotation.z = lerp(0.5, -0.5, smoothstep(0, 0.15, k));
        this.dial.rotation.x = this.save.pilot ? Math.sin(t * 0.3) * 0.05 + (this.dest === 'pilot' && k ? 1.2 : 0) : t * 0.4;
        this.daylight.material.color.setScalar(0.95 + 0.05 * Math.sin(t));
        this._updateSparks(dt);
        this._drawScreens(false);
    }

    _planetFrame(dt, t, camera) {
        const c = this.controls;
        const P = this.planet;
        P.update(dt, t, camera, c.pos);
        if (this.state !== 'planet') return;
        // air (not while you read the pilot's log)
        if (!this.logOpen) this.o2 -= dt * (c.speed > 6 ? 1.5 : 1);
        this._o2Hud();
        const k = this.o2 / this.o2Max;
        if (k < 0.3 && this.warned < 1) {
            this.warned = 1;
            this.sound?.alarm(false);
            this.env.ui?.hint('Air at 30% · the recall will pull you home when it runs out, or head back to the beacon', 6000);
        }
        if (k < 0.12) {
            this.alarmT = (this.alarmT ?? 0) - dt;
            if (this.alarmT <= 0) {
                this.alarmT = 1.4;
                this.sound?.alarm(true);
            }
        }
        if (this.o2 <= 0) return this._faint();
        // as far as the beacon reaches
        const r = Math.hypot(c.pos.x, c.pos.z);
        if (!this.edgeHint && r > WALK_R - 2.5) {
            this.edgeHint = true;
            this.env.ui?.hint('The beacon’s lock doesn’t reach past these hills', 4500);
        }
        // the pilot: a ping on the suit radio, quicker as you come near
        const pl = P.pilot;
        if (pl) {
            const d = Math.hypot(c.pos.x - pl.x, c.pos.z - pl.z);
            if (!pl.found) {
                if (this.dom.signal) this.dom.signal.hidden = false;
                if (t > this.pingAt) {
                    this.pingAt = t + 0.6 + clamp(d / 14, 0, 4);
                    this.sound?.ping(clamp(1 - d / 60, 0, 1));
                    this.dom.signal?.classList.remove('rk-ping');
                    void this.dom.signal?.offsetWidth;
                    this.dom.signal?.classList.add('rk-ping');
                }
                if (d < 3.4) this._foundPilot();
            } else if (this.dom.signal) this.dom.signal.hidden = true;
        } else if (this.dom.signal) this.dom.signal.hidden = true;
        // animals close by go in the log
        for (const cr of P.creatures) {
            if (this.logged.has(cr.sp.name)) continue;
            if (Math.hypot(cr.g.position.x - c.pos.x, cr.g.position.z - c.pos.z) < 7) this._logSpecies(cr.sp);
        }
    }

    _logSpecies(sp) {
        this.logged.add(sp.name);
        const key = `${this.info.name}: ${sp.name}`;
        if (!this.save.species.includes(key)) {
            this.save.species.push(key);
            this._store();
        }
    }

    _beams(dt, t) {
        const fx = this.dom.fx;
        const setFx = (v) => {
            if (fx) fx.style.opacity = String(clamp(v, 0, 1));
        };
        const p = this.controls?.pos;
        if (!p) return;
        if (this.state === 'charge') {
            this.bT += dt;
            const k = this.bT / CHARGE;
            this._updateShimmer(t, p.x, 0.1, p.z, smoothstep(0.1, 0.8, k));
            setFx(smoothstep(0.72, 1, k));
            this.camera.position.x = p.x + (Math.random() - 0.5) * 0.02 * k;
            if (k >= 1) this._arrivePlanet();
        } else if (this.state === 'arrive') {
            this.bT += dt;
            const k = this.bT / ARRIVE;
            this._updateShimmer(t, p.x, this.planet.padY, p.z, 1 - smoothstep(0.2, 1, k));
            setFx(1 - smoothstep(0, 0.6, k));
            if (k >= 1) {
                this.state = 'planet';
                this.controls.enabled = !this.logOpen;
                const i = this.info;
                const temp = `${i.temp > 0 ? '' : ''}${i.temp} °C`;
                this.env.ui?.zone(i.name, `${i.label} · ${temp} · ${i.gravity}g · ${i.suns === 2 ? 'two suns' : i.phase === 'night' ? 'night side' : i.phase === 'golden' ? 'late afternoon' : 'daylight'}`, i.accent);
                if (!this.save.planetIntro) {
                    this.save.planetIntro = 1;
                    this._store();
                    setTimeout(() => this.inside && this.state === 'planet' && this.env.ui?.hint(`Your suit has ${Math.round(this.o2Max / 60 * 10) / 10} minutes of air · walk where you like inside the hills · the beacon behind you (or Beam back) takes you home, and the recall will pull you back anyway when the air runs low`, 12000), 1500);
                }
                this._hud();
            }
        } else if (this.state === 'recall') {
            this.bT += dt;
            const k = this.bT / RECALL;
            this._updateShimmer(t, p.x, this.planet.world.walkHeight(p.x, p.z), p.z, smoothstep(0.1, 0.8, k));
            setFx(smoothstep(0.7, 1, k));
            if (k >= 1) this._arriveShip();
        } else if (this.state === 'faint') {
            this.bT += dt;
            this.camera.rotation.x = lerp(this.camera.rotation.x, -0.6, dt * 1.2);
            if (this.bT >= FAINT) this._arriveShip();
        } else if (this.state === 'return') {
            this.bT += dt;
            const k = this.bT / RETURN;
            this._updateShimmer(t, p.x, 0.1, p.z, 1 - smoothstep(0.1, 1, k));
            setFx(this.why === 'air' ? 0 : 1 - smoothstep(0, 0.6, k));
            if (k >= 1) {
                this.state = 'ship';
                this.controls.enabled = !this.logOpen;
                this.shim.pts.visible = false;
                if (this.why === 'early') this.env.ui?.hint(`Back aboard the ${SHIP_NAME}`, 3000);
                this._hud();
            }
        } else if (this.shim.pts.visible) this.shim.pts.visible = false;
    }

    // ------------------------------------------------------------ pointing

    _pickShip(ray) {
        const h = ray.intersectObjects(this.hits, false)[0];
        const f = ray.intersectObjects(this.floors, false)[0];
        if (h && (!f || h.distance < f.distance + 0.5) && h.distance < 14) return { type: h.object.userData.kind, d: h.distance };
        if (f && f.distance < 30) return { type: 'ground', point: f.point };
        return null;
    }

    _notes(kind) {
        const touch = matchMedia('(pointer: coarse)').matches;
        const verb = touch ? 'Tap' : 'Click';
        const p = this.save.pilot;
        const N = {
            console: { icon: '⚡', kicker: 'The Transporter Room', title: 'The transporter console', desc: 'Dials, a screen that still glows, and a big red lever. It won’t hold a course: every trip goes somewhere new.', cta: `${verb} to step on the pad and pull the lever →`, accent: '#7ae8ff' },
            pad: { icon: '✨', kicker: 'The Transporter Room', title: 'The transporter pad', desc: 'It hums. The coils round it are warm, and the air over it shimmers a little.', cta: `${verb} to energize →`, accent: '#7ae8ff' },
            dial: p ? { icon: '\u{1F9ED}', kicker: 'The transporter console', title: `Locked on: ${p.name}`, desc: 'The one world the transporter can find again: where the pilot sat down to watch the sky.', cta: `${verb} to go back there →`, accent: '#ffd25a' } : { icon: '\u{1F9ED}', kicker: 'The transporter console', title: 'The destination dial', desc: 'It spins freely. Whatever it was set to, it isn’t any more.', accent: '#7ae8ff' },
            reactor: { icon: '☢️', kicker: 'The Engine Room', title: 'The atomic pile', desc: 'Still warm, still glowing, going nowhere. It is just enough to keep the transporter alive.', accent: '#ff9a4a' },
            seat: { icon: '\u{1FA91}', kicker: 'The Cockpit', title: 'The pilot’s seat', desc: p ? `Empty. The pilot’s name was J. Starling, and they are sitting on ${p.name}, looking at the sky.` : 'Empty. The harness was unbuckled, not torn: whoever flew her walked away from the crash.', accent: ROCKET_ACCENT },
            dash: { icon: '\u{1F39B}️', kicker: 'The Cockpit', title: 'The flight deck', desc: p ? `The log screen has found its pilot: on ${p.name}.` : 'Most of it is dead. The log screen still says where the pilot was last: the transporter.', accent: ROCKET_ACCENT },
            glass: { icon: '\u{1FAB1}', kicker: 'The Cockpit', title: 'The windscreen', desc: 'Pressed against the earth she ploughed up. A little daylight gets in at the top, and a worm is having a look.', accent: ROCKET_ACCENT },
            suits: { icon: '\u{1F468}‍\u{1F680}', kicker: 'The Airlock', title: 'The suit rack', desc: 'Two suits on their hooks and a third hook empty, with J.S. on a label over it.', accent: '#ff7a6a' },
            hatch: { icon: '\u{1F6AA}', kicker: 'The Airlock', title: 'The hatch', desc: 'Daylight, the ramp and the garden.', cta: `${verb} to leave the ship →`, accent: '#ffe8b0' },
            note: { icon: '\u{1F4DD}', kicker: 'The Crew Quarters', title: 'A note pinned to the wall', desc: '“Gone through again. Back by supper. — J.S.”', accent: '#ffc890' },
            poster: { icon: '\u{1FA90}', kicker: 'The Crew Quarters', title: 'SEE THE RINGS!', desc: 'Comet Lines, weekly departures. Somebody has drawn a little heart on the ringed planet.', accent: '#ffc890' },
            bunks: { icon: '\u{1F6CF}️', kicker: 'The Crew Quarters', title: 'The bunks', desc: 'Four bunks, and only one of them slept in.', accent: '#ffc890' },
            rayguns: { icon: '\u{1F52B}', kicker: 'The Cargo Hold', title: 'A rack of ray guns', desc: 'Chrome, finned and entirely for show. The batteries were taken out long ago.', accent: '#d8d8b0' },
            oxygen: { icon: '\u{1FAE7}', kicker: 'The Cargo Hold', title: 'Oxygen canisters', desc: 'A crate burst open in the crash. Every one of them is empty.', accent: '#d8d8b0' },
            wires: { icon: '⚡', kicker: 'The Main Corridor', title: 'Loose wiring', desc: 'The ceiling panel came down and the wires came with it. Best not to touch.', accent: '#bfe0ff' },
        };
        return N[kind] || null;
    }

    /** A click or tap aboard or on a world. */
    tap(ray) {
        if (this.busy || this.logOpen) return null;
        if (this.state === 'ship') {
            const h = this._pickShip(ray);
            if (!h) return null;
            if (h.type === 'console' || h.type === 'pad') this.energize('random');
            else if (h.type === 'dial') this.energize(this.save.pilot ? 'pilot' : 'random');
            else if (h.type === 'hatch') this.leaveShip();
            else if (h.type === 'ground' && aboard(h.point.x, h.point.z, 0.35)) this.controls.walkTo([{ x: h.point.x, z: h.point.z }]);
            return h;
        }
        if (this.state === 'planet') {
            const h = this.planet.pick(ray);
            if (!h) return null;
            if (h.type === 'beacon') this.recall('early');
            else if (h.type === 'pilot') {
                if (!this.planet.pilot.found && h.d < 12) this._foundPilot();
                else if (this.planet.pilot.found) this.openLog();
                else this.controls.walkTo([{ x: this.planet.pilot.x + 1.5, z: this.planet.pilot.z + 1.5 }]);
            } else if (h.type === 'creature') this._logSpecies(h.c.sp);
            else if (h.type === 'ground' && this.planet.walkable(h.point.x, h.point.z)) this.controls.walkTo([{ x: h.point.x, z: h.point.z }]);
            return h;
        }
        return null;
    }

    hoverNote(ray) {
        if (this.busy || this.logOpen) return null;
        if (this.state === 'ship') {
            const h = this._pickShip(ray);
            return h && h.type !== 'ground' ? this._notes(h.type) : null;
        }
        if (this.state === 'planet') {
            const h = this.planet.pick(ray);
            if (!h) return null;
            const i = this.info;
            if (h.type === 'beacon') return { icon: '\u{1F4E1}', kicker: i.name, title: 'The recall beacon', desc: 'Where the transporter put you down, and where it can find you again.', cta: `${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} to beam back to the ship →`, accent: '#7ae8ff' };
            if (h.type === 'pilot') return { icon: '\u{1F468}‍\u{1F680}', kicker: i.name, title: this.planet.pilot.found ? 'J. Starling, pilot of the Silver Comet' : 'Someone in a spacesuit', desc: this.planet.pilot.found ? 'Still sitting against the stone, still watching the sky. The flight log is in their lap.' : 'Sitting against a stone, very still, with a flag planted beside them.', cta: this.planet.pilot.found ? 'Click to read the flight log →' : 'Click to go closer →', accent: ROCKET_ACCENT };
            if (h.type === 'creature') {
                const sp = h.c.sp;
                return { icon: { strider: '\u{1F98C}', grazer: '\u{1F995}', hopper: '\u{1F407}', floater: '\u{1FAB8}', flyer: '\u{1F985}', crawler: '\u{1F41B}' }[sp.plan], kicker: `${i.name} · native life`, title: sp.name, desc: sp.desc, accent: '#' + sp.accent.getHexString() };
            }
        }
        return null;
    }

    clearHover() {}

    stepSurface() {
        if (!this.onPlanet) return 'metal';
        const k = this.info?.key;
        return k === 'moon' || k === 'crystal' || k === 'lava' || k === 'ice' ? 'stone' : 'grass';
    }
}

/** Yellow and black chevrons, for the edges of the doorways. */
function hazardTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#f2c84a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#1a1a1a';
    for (let i = -4; i < 8; i++) {
        g.beginPath();
        g.moveTo(i * 32, 0);
        g.lineTo(i * 32 + 16, 0);
        g.lineTo(i * 32 + 16 + 128, 128);
        g.lineTo(i * 32 + 128, 128);
        g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 4);
    return t;
}
