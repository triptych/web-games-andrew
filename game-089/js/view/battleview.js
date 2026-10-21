// The battle scene, Final Fantasy style: the party lines up on the right, the monsters on the
// left, under a sky that belongs to the region. play(e) turns one b_* event into an animation and
// returns the seconds to wait; `disp` holds the HP and MP the bars show, which only change when
// a hit is shown, not when the sim computed it.

import * as THREE from 'three';
import { buildHumanoid, lookFor } from './chars.js';
import { buildMonster, animateMonster } from './monsters.js';
import { animate, setPose } from './anim.js';
import { FX } from './fx.js';
import * as P from './props.js';
import { toonInstanced, mat4, toonMesh, part, glowMat, cyl, sph, box, gradientMap, shade } from './toon.js';
import { MONSTERS, GEAR, ELEMENT_ICON, STATUS } from '../sim/data.js';
import { hash3 } from '../rng.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const THEMES = {
    meadow: { sky: ['#4aa8ff', '#bfe8ff'], ground: '#8ad85a', ground2: '#a8e46a', fog: '#cdeeff', props: ['tree', 'flowers', 'bush', 'rock'], hemi: '#d8eeff', sun: '#fff2d8' },
    woods: { sky: ['#2a7aa8', '#9ad8c8'], ground: '#4aa45a', ground2: '#3a8a4a', fog: '#a8d8c8', props: ['darktree', 'mushroom', 'pine', 'bush'], hemi: '#c8f0e0', sun: '#fff0c8' },
    coast: { sky: ['#2a90f0', '#c8f4ff'], ground: '#f4dca0', ground2: '#e8cc8a', fog: '#d8f4ff', props: ['palm', 'rock', 'shell'], hemi: '#e0f4ff', sun: '#fff8e0' },
    frost: { sky: ['#5a8ad8', '#e0f0ff'], ground: '#f0f6ff', ground2: '#d0e2f4', fog: '#e8f4ff', props: ['snowpine', 'snowrock', 'crystal'], hemi: '#e8f2ff', sun: '#f4f8ff' },
    dungeon: { sky: ['#1a1428', '#3a2a4a'], ground: '#5a5068', ground2: '#4a4058', fog: '#2a2038', props: ['cave', 'crystal'], hemi: '#8a7aa8', sun: '#ffc88a', dark: true },
    dragon: { sky: ['#3a0a10', '#ff7a3a'], ground: '#4a3434', ground2: '#3a2626', fog: '#7a2a1a', props: ['lavarock'], hemi: '#ffb08a', sun: '#ffb070', lava: true },
};

export class BattleView {
    constructor(overlay) {
        this.overlay = overlay;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.3, 600);
        this.fx = new FX(this.scene, overlay);
        this.arena = null;
        this.units = [];       // { rig, home, side, kind, disp: { hp, maxhp, mp, maxmp }, alive }
        this.t = 0;
        this.shake = 0;
        this.camBase = { pos: V(3.5, 5.6, 14.5), look: V(-0.5, 1.4, 0) };
        this.camK = 0;          // 0 = home, 1 = zoomed toward camFocus
        this.camFocus = V(0, 1.4, 0);
        this.hemi = new THREE.HemisphereLight('#d8eeff', '#5a6a4a', 1.2);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight('#fff2d8', 2.0);
        this.sun.position.set(8, 16, 10);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(1024, 1024);
        const sc = this.sun.shadow.camera;
        sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 2; sc.far = 60;
        this.scene.add(this.sun, this.sun.target);
    }

    // ------------------------------------------------------------------ setup
    buildArena(themeKey) {
        if (this.arena) { this.scene.remove(this.arena); this.arena = null; }
        const T = THEMES[themeKey] ?? THEMES.meadow;
        this.theme = T;
        const A = new THREE.Group();
        // sky
        const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { uTop: { value: new THREE.Color(T.sky[0]) }, uLow: { value: new THREE.Color(T.sky[1]) } },
            vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform vec3 uTop, uLow; varying vec3 vD; void main(){ float y = clamp(vD.y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(uLow, uTop, y), 1.0); }',
        }));
        A.add(sky);
        this.scene.fog = new THREE.Fog(T.fog, 30, 120);
        this.hemi.color.set(T.hemi);
        this.hemi.groundColor.set(shade(T.ground, -0.4));
        this.hemi.intensity = T.dark ? 0.9 : 1.2;
        this.sun.color.set(T.sun);
        this.sun.intensity = T.dark ? 1.3 : 2.0;
        // ground: a big disc with a painted noise of two tones
        const g = new THREE.PlaneGeometry(130, 130, 90, 90);
        g.rotateX(-PI / 2);
        const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
        const c1 = new THREE.Color(T.ground), c2 = new THREE.Color(T.ground2), c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            const r = Math.hypot(x, z);
            pos.setY(i, r > 16 ? (r - 16) * 0.12 * (0.6 + hash3(Math.round(x), Math.round(z), 2) * 0.4) : 0);
            const n = Math.sin(x * 0.35 + Math.sin(z * 0.27) * 1.7) * 0.5 + Math.sin(z * 0.42 - x * 0.18) * 0.5;
            c.copy(c1).lerp(c2, Math.max(0, Math.min(1, 0.5 + n * 0.5)) * 0.8 + hash3(Math.round(x * 1.3), Math.round(z * 1.3), 1) * 0.2);
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.computeVertexNormals();
        const ground = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(4) }));
        ground.receiveShadow = true;
        A.add(ground);
        // a ring of scenery round the field (a gap toward the camera)
        const geos = {
            tree: () => P.treeGeo('#5cc04a', '#8a5a34', 1 + Math.floor(Math.random() * 3)), darktree: () => P.treeGeo('#2f8a4a', '#6a4a30', 6), flowers: () => P.flowersGeo(), bush: () => P.bushGeo('#4aa840', '#ff6a9a', 2), rock: () => P.rockGeo('#a0a0ac'),
            mushroom: () => P.mushroomGeo(['#ff5a6a', '#b07aff', '#ffa03a'][Math.floor(Math.random() * 3)]), pine: () => P.pineGeo('#2f7a5a'), palm: () => P.palmGeo(1 + Math.floor(Math.random() * 2)), shell: () => P.shellGeo(),
            snowpine: () => P.pineGeo('#2f6a5a', true, 3), snowrock: () => P.rockGeo('#9aa8b8', true), crystal: () => P.crystalGeo(Math.random() < 0.5 ? '#8ae0ff' : '#c8a0ff'),
            cave: () => P.rockGeo('#4a4058', false, Math.floor(Math.random() * 9)), lavarock: () => P.rockGeo('#3a2a2a', false, Math.floor(Math.random() * 9)),
        };
        const lists = {};
        for (let i = 0; i < 70; i++) {
            const a = (i / 70) * PI * 2 + hash3(i, 1) * 0.1;
            const facing = Math.cos(a - 1.3);          // the camera sits toward +z, a little to the right
            if (facing > 0.55 && i % 3) continue;
            const r = 13 + hash3(i, 2) * 9 + (facing > 0.5 ? 6 : 0);
            const kind = T.props[Math.floor(hash3(i, 3) * T.props.length)];
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            const sc = (kind === 'cave' || kind === 'lavarock' ? 3 + hash3(i, 4) * 3 : kind === 'flowers' ? 1.6 : 1.1 + hash3(i, 4) * 0.8);
            (lists[kind] ||= []).push(mat4([x, Math.max(0, (r - 16) * 0.1), z], hash3(i, 5) * PI * 2, sc));
        }
        const floor = { grass: [], flowers: [], pebble: [] };
        for (let i = 0; i < 260; i++) {
            const x = (hash3(i, 21) - 0.5) * 30, z = (hash3(i, 22) - 0.5) * 20 - 2;
            if (Math.abs(x) < 5 && Math.abs(z + 0.6) < 3.6) continue;
            const u = hash3(i, 23);
            const k = T.dark || T.lava ? 'pebble' : u < 0.55 ? 'grass' : u < 0.85 ? 'flowers' : 'pebble';
            floor[k].push(mat4([x, 0, z], hash3(i, 24) * PI * 2, 0.7 + hash3(i, 25) * 0.6));
        }
        const fl = { grass: () => P.grassGeo(themeKey === 'frost' ? '#c8dcf0' : themeKey === 'coast' ? '#a8c870' : '#5ab84a'), flowers: () => P.flowersGeo(themeKey === 'frost' ? ['#bfe8ff', '#ffffff'] : undefined), pebble: () => P.rockGeo(T.lava ? '#3a2a2a' : T.dark ? '#5a5068' : '#b0aaa8', themeKey === 'frost') };
        for (const [k, list] of Object.entries(floor)) if (list.length) A.add(toonInstanced(fl[k](), k === 'pebble' ? list.map((m) => m.clone().multiply(new THREE.Matrix4().makeScale(0.4, 0.4, 0.4))) : list, { outline: k === 'grass' ? false : 0.02 }));
        // a worn ring of earth where the fight happens
        const ring = new THREE.Mesh(new THREE.CircleGeometry(7.5, 48), new THREE.MeshToonMaterial({ color: shade(T.ground, -0.12), gradientMap: gradientMap(4), transparent: true, opacity: 0.55 }));
        ring.rotation.x = -PI / 2; ring.position.set(0, 0.02, -1); ring.scale.set(1.25, 0.75, 1); ring.receiveShadow = true;
        A.add(ring);
        for (const [k, list] of Object.entries(lists)) A.add(toonInstanced(geos[k](), list, { outline: 0.04, emissive: k === 'crystal' ? '#1a4a6a' : undefined, emissiveIntensity: 0.6 }));
        if (T.dark) {
            // torches for a dungeon
            for (const [x, z] of [[-9, -6], [7, -7], [-12, 3], [11, 1]]) {
                A.add(toonMesh([part(cyl(0.12, 0.16, 2.2, 6), '#6a4a30', [x, 1.1, z]), part(cyl(0.3, 0.18, 0.3, 8), '#3a3a40', [x, 2.3, z])], { outline: 0.03 }));
                const f = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 8), glowMat('#ffa03a', 2.2));
                f.position.set(x, 2.75, z); A.add(f);
                const l = new THREE.PointLight('#ffa03a', 30, 14, 2); l.position.set(x, 3, z); A.add(l);
            }
        }
        if (T.lava) {
            for (let i = 0; i < 9; i++) {
                const a = hash3(i, 7) * PI * 2, r = 9 + hash3(i, 8) * 10;
                const pool = new THREE.Mesh(new THREE.CircleGeometry(1 + hash3(i, 9) * 1.8, 20), glowMat('#ff6a1a', 1.7));
                pool.rotation.x = -PI / 2;
                pool.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r - 4);
                A.add(pool);
            }
            const crack = new THREE.Mesh(new THREE.RingGeometry(10, 10.3, 64), glowMat('#ff7a2a', 1.4));
            crack.rotation.x = -PI / 2; crack.position.y = 0.02; A.add(crack);
        }
        this.scene.add(A);
        this.arena = A;
    }

    /** Build the units from the b_start event. */
    start(e, G) {
        this.fx.clear();
        for (const u of this.units) this.scene.remove(u.rig.root);
        this.units = [];
        const region = G.battle?.region;
        const theme = G.battle?.kind === 'dragon' ? 'dragon' : (G.battle?.dungeon ? 'dungeon' : region in THEMES ? region : 'meadow');
        this.buildArena(theme);
        this.kind = G.battle?.kind;
        this.dragonFight = this.kind === 'dragon';
        this.camBase = this.dragonFight ? { pos: V(4.2, 6.8, 17), look: V(-1.8, 2.6, -0.6) } : { pos: V(1.8, 4.4, 11.2), look: V(-0.1, 1.0, -0.6) };
        const party = e.units.filter((u) => u.side === 'p');
        const foes = e.units.filter((u) => u.side === 'e');
        e.units.forEach((u, i) => this.addUnit(u, i, G, party.length, foes.length));
        this.layout();
        this.camK = 0;
        this.intro = 1;
    }

    addUnit(u, i, G, nP, nE) {
        let rig, kind;
        if (u.side === 'p') {
            const m = G.party.find((x) => x.id === u.mid) ?? { id: u.mid, gear: {} };
            const look = lookFor(m.id === 'hero' ? 'hero' : m.id, G.cls);
            rig = buildHumanoid(look);
            const w = GEAR[m.gear?.weapon];
            if (w && look.weapon !== 'bow') rig.setWeapon(w.kind === 'any' ? 'blade' : w.kind, w.element === 'frost' ? '#bfefff' : w.element === 'holy' ? '#fff2a0' : undefined);
            setPose(rig, u.alive ? 'ready' : 'ko');
            rig.root.rotation.y = -PI / 2 + 0.55;      // face the enemies on the left, turned a little to the camera
            kind = 'h';
        } else {
            rig = buildMonster(MONSTERS[u.eid].model);
            rig.root.rotation.y = PI / 2 - 0.5;
            if (u.eid === 'pyrrhax') { rig.root.scale.setScalar(1.15); rig.setExpr('angry'); }
            kind = 'm';
        }
        this.scene.add(rig.root);
        this.units[i] = { rig, side: u.side, kind, eid: u.eid, mid: u.mid, name: u.name, home: V(0, 0, 0), alive: u.alive, boss: u.boss, disp: { hp: u.hp, maxhp: u.maxhp, mp: u.mp, maxmp: u.maxmp }, status: {}, lunge: null };
    }

    layout() {
        const ps = this.units.map((u, i) => [u, i]).filter(([u]) => u.side === 'p');
        const es = this.units.map((u, i) => [u, i]).filter(([u]) => u.side === 'e' && (u.alive || u.dying));
        // a staggered column, back-left to front-right, so nobody hides behind anybody
        const PS = { 1: [[3.0, -0.8]], 2: [[2.7, -2.0], [3.6, 0.2]], 3: [[2.5, -2.8], [3.25, -0.7], [4.0, 1.4]] };
        ps.forEach(([u], k) => {
            const [x, z] = (PS[ps.length] ?? PS[3])[k] ?? [4.5, 2.5];
            u.home.set(x, 0, z);
            if (!u.lunge) u.rig.root.position.copy(u.home);
        });
        const big = es.find(([u]) => u.boss);
        let slots;
        if (this.dragonFight) slots = [V(-5.5, 0, -1.6), V(-2.2, 1.6, -4.2), V(-2.4, 1.6, 2.0), V(-1.4, 1.4, -1.0)];
        else if (big) slots = [V(-3.6, 0, -1.4), V(-1.6, 0, 1.2), V(-1.4, 0, -3.4), V(-4.6, 0, 1.4)];
        else if (es.length === 1) slots = [V(-2.6, 0, -0.6)];
        else if (es.length === 2) slots = [V(-2.2, 0, -2.0), V(-3.0, 0, 0.6)];
        else slots = [V(-2.2, 0, -0.6), V(-3.4, 0, -2.8), V(-3.4, 0, 1.6), V(-4.6, 0, -0.6)];
        let k = 0;
        // the boss always takes the first slot
        es.sort((a, b) => (b[0].boss ? 1 : 0) - (a[0].boss ? 1 : 0));
        for (const [u] of es) {
            const s = slots[k++] ?? V(-6 - k, 0, (k % 2 ? 1 : -1) * 2);
            u.home.copy(s);
            if (!u.lunge && !u.placed) { u.rig.root.position.copy(s); u.placed = true; }
        }
    }

    pos(i) { return this.units[i]?.rig.root.position ?? V(0, 0, 0); }
    /** A point on a unit's body (k: 0 feet … 1 head). */
    at(i, k = 0.55) {
        const u = this.units[i];
        if (!u) return V(0, 1, 0);
        const h = (u.rig.height ?? 1.5) * (u.kind === 'h' ? 1 : 1);
        return u.rig.root.position.clone().add(V(0, h * k, 0));
    }

    // ------------------------------------------------------------------ events
    play(e, G, speed = 1) {
        const S = (x) => x / speed;
        const U = this.units;
        switch (e.type) {
            case 'b_start': this.start(e, G); return S(0.9);
            case 'b_blessing': for (const u of U) if (u?.side === 'p') this.fx.motes(u.rig.root.position, '#ffe8a0', 18, 2.5); return S(0.5);
            case 'b_turn': {
                this.returnAll();
                this.active = e.u;
                return S(0.15);
            }
            case 'b_act': return S(this.act(e, G));
            case 'b_hit': {
                const t = U[e.t];
                if (!t) return 0;
                t.disp.hp = e.hp;
                const p = this.at(e.t, 0.6);
                const big = e.crit || e.weak;
                t.rig.flash.value = 1;
                t.flashT = 0.18;
                if (t.kind === 'h') { setPose(t.rig, 'hurt'); t.hurtT = 0.4; t.rig.setExpr('hurt'); }
                else { t.knock = 0.25; t.rig.setExpr?.('hurt'); t.exprT = 0.5; }
                const cls = e.crit ? 'dmg crit' : e.weak ? 'dmg weak' : e.resist ? 'dmg resist' : t.side === 'p' ? 'dmg hurt' : 'dmg';
                this.fx.text(p.clone().add(V(0, 0.6, 0)), String(e.dmg), cls, this.camera, { life: 1.0, dx: (e.hitNo ?? 0) * 18 });
                if (e.weak) this.fx.text(p.clone().add(V(0, 1.3, 0)), 'WEAK!', 'tag weak', this.camera, { life: 0.9 });
                if (e.crit) this.fx.text(p.clone().add(V(0, 1.3, 0)), 'CRITICAL!', 'tag crit', this.camera, { life: 0.9 });
                if (e.resist) this.fx.text(p.clone().add(V(0, 1.3, 0)), 'resist', 'tag', this.camera, { life: 0.8 });
                this.impact(p, e.el, big);
                if (big) { this.shake = Math.max(this.shake, 0.35); }
                return S(e.hitNo != null ? 0.16 : 0.28);
            }
            case 'b_heal': {
                const t = U[e.t];
                if (!t) return 0;
                t.disp.hp = e.hp;
                if (!e.amt && e.regen) return 0;
                this.fx.motes(t.rig.root.position, '#9affc0', e.regen ? 8 : 20, 2);
                this.fx.text(this.at(e.t, 0.9), '+' + e.amt, 'heal', this.camera, { life: 1.0 });
                return S(e.regen ? 0.2 : 0.3);
            }
            case 'b_mp': { const t = U[e.t]; if (t) t.disp.mp = e.mp; if (e.gain) this.fx.motes(t.rig.root.position, '#8ac8ff', 14, 2); return 0; }
            case 'b_status': {
                const t = U[e.t];
                if (!t) return 0;
                if (e.on) t.status[e.st] = true; else delete t.status[e.st];
                if (e.on && e.fresh !== false) {
                    const S0 = STATUS[e.st];
                    this.fx.text(this.at(e.t, 1.05), `${S0.icon} ${S0.name}`, S0.bad ? 'tag bad' : 'tag good', this.camera, { life: 0.9 });
                    if (!S0.bad) this.fx.motes(t.rig.root.position, e.st === 'atkUp' ? '#ff8a6a' : e.st === 'haste' ? '#ffffff' : e.st === 'imbue' ? '#bfefff' : '#ffe08a', 10, 1.6);
                    return S(0.22);
                }
                return 0;
            }
            case 'b_dot': {
                const t = U[e.t];
                if (!t) return 0;
                t.disp.hp = e.hp;
                this.fx.text(this.at(e.t, 0.8), String(e.dmg), e.st === 'burn' ? 'dmg burn' : 'dmg poison', this.camera, { life: 0.9 });
                this.fx.puffs(this.at(e.t, 0.5), e.st === 'burn' ? '#ff8a3a' : '#a05ad8', 6, { size: 0.4, up: 1.5 });
                t.rig.flash.value = 0.6; t.flashT = 0.12;
                return S(0.3);
            }
            case 'b_ko': {
                const t = U[e.t];
                if (!t) return 0;
                t.alive = false;
                t.disp.hp = 0;
                if (t.kind === 'h') { setPose(t.rig, 'ko'); return S(0.45); }
                t.dying = 0.001;
                this.fx.sparks(this.at(e.t, 0.5), '#ffffff', 20, 3.5);
                this.fx.puffs(this.at(e.t, 0.4), t.eid === 'pyrrhax' ? '#ff8a3a' : '#e8e0ff', 14, { size: 0.9, up: 1.5, spread: 0.6 });
                return S(t.eid === 'pyrrhax' ? 1.4 : 0.5);
            }
            case 'b_revive': {
                const t = U[e.t];
                if (!t) return 0;
                t.alive = true; t.disp.hp = e.hp;
                setPose(t.rig, 'ready');
                this.fx.beam(t.rig.root.position, '#fff2b0', 6, 0.8, 0.6);
                this.fx.motes(t.rig.root.position, '#fff2b0', 26, 2.6);
                return S(0.6);
            }
            case 'b_stunned': {
                this.fx.text(this.at(e.u, 1.05), '💫 Stunned', 'tag bad', this.camera, { life: 0.9 });
                return S(0.5);
            }
            case 'b_fail': this.fx.text(this.at(e.u, 1.05), e.text, 'tag', this.camera, { life: 1 }); return S(0.6);
            case 'b_steal': {
                const a = this.at(e.u, 0.6);
                this.fx.text(a.clone().add(V(0, 0.8, 0)), `Stole ${e.gold}g!`, 'tag bad', this.camera, { life: 1.1 });
                this.fx.sparks(a, '#ffd84a', 14, 3);
                return S(0.4);
            }
            case 'b_summon': {
                const i = e.u;
                const u = e.unit;
                const rig = buildMonster(MONSTERS[u.eid].model);
                rig.root.rotation.y = PI / 2 - 0.5;
                this.scene.add(rig.root);
                this.units[i] = { rig, side: 'e', kind: 'm', eid: u.eid, name: u.name, home: V(0, 0, 0), alive: true, disp: { hp: u.hp, maxhp: u.maxhp, mp: 0, maxmp: 0 }, status: {}, lunge: null, spawn: 0 };
                this.layout();
                this.fx.puffs(this.units[i].home.clone().add(V(0, 0.5, 0)), u.eid === 'whelp' ? '#ff8a3a' : '#e8e0ff', 14, { size: 1 });
                return S(0.6);
            }
            case 'b_phase': {
                const t = U[e.u];
                if (t) { t.mode = 'fly'; this.fx.sparks(this.at(e.u, 0.5), '#ff8a3a', 60, 7, { up: 3 }); }
                this.shake = 1.2;
                this.flash = ['#ff8a3a', 0.6];
                return S(1.6);
            }
            case 'b_valor': return 0;
            case 'b_end': {
                this.returnAll();
                if (e.result === 'win') {
                    for (const u of U) if (u?.side === 'p' && u.alive) { setPose(u.rig, 'victory'); u.rig.setExpr('happy'); }
                    this.camK = 0.35; this.camFocus.set(4.5, 1.2, 0);
                } else if (e.result === 'fled') {
                    for (const u of U) if (u?.side === 'p' && u.alive) { u.flee = 0.001; setPose(u.rig, 'walk'); u.rig.root.rotation.y = PI / 2 + 0.3; }
                }
                return S(e.result === 'win' ? 1.2 : 0.9);
            }
        }
        return 0;
    }

    /** An actor's move: returns the time until its first hit lands. */
    act(e, G) {
        const U = this.units;
        const a = U[e.u];
        if (!a) return 0.2;
        this.returnAll(e.u);
        const t0 = e.targets?.[0];
        const tgt = t0 != null ? U[t0] : null;
        const fx = e.fx || 'claw';
        const el = e.el;
        const COLORS = { fire: '#ff7a2a', frost: '#9ae8ff', storm: '#fff27a', holy: '#fff2b0' };
        const col = COLORS[el] ?? '#ffffff';
        if (e.burst) {
            this.camK = 0.6; this.camFocus.copy(a.rig.root.position).add(V(0, 1, 0));
            this.flash = ['#ffffff', 0.5];
            this.fx.beam(a.rig.root.position, '#fff2b0', 9, 1.2, 1.1);
            this.fx.ring(a.rig.root.position.clone().add(V(0, 0.1, 0)), '#ffd84a', 6, 0.8);
            this.fx.text(this.at(e.u, 1.25), e.name, 'tag burst', this.camera, { life: 1.4 });
        }
        const melee = ['claw', 'bump', 'slash', 'smash', 'bash', 'slashBig', 'whirl', 'holySlash', 'rune', 'lash', 'roots', 'burstHoly', 'burstWild', 'quake', 'pinch'].includes(fx);
        const ranged = ['arrow', 'rain', 'cannon', 'burstStars', 'burstCannon', 'goo', 'ember', 'iceShard', 'fireball', 'zap', 'spark'].includes(fx);
        if (a.kind === 'h') {
            if (melee) { setPose(a.rig, 'ready'); }
            else if (fx === 'arrow' || fx === 'rain' || fx === 'burstStars') setPose(a.rig, 'shoot');
            else if (fx === 'item') setPose(a.rig, 'item');
            else if (fx === 'defend') setPose(a.rig, 'defend');
            else if (fx === 'flee') setPose(a.rig, 'walk');
            else setPose(a.rig, 'cast');
            a.poseT = 1.0;
        } else {
            a.rig.setExpr?.('angry'); a.exprT = 1.0;
            if (a.eid === 'pyrrhax') { a.jawT = 1.0; if (['breath', 'inferno', 'roar'].includes(fx)) a.mode = a.mode === 'fly' ? 'fly' : 'roar'; }
        }
        // the move's name, for anything but a plain attack
        if (e.name && e.name !== 'Attack' && !e.burst) this.fx.text(this.at(e.u, 1.2), e.name, a.side === 'p' ? 'tag skill' : 'tag foe', this.camera, { life: 1.1 });
        if (fx === 'defend') { this.fx.ring(a.rig.root.position.clone().add(V(0, 0.1, 0)), '#8ac8ff', 1.6, 0.5); return 0.35; }
        if (fx === 'flee') return 0.5;
        if (fx === 'item') {
            for (const ti of e.targets ?? []) this.fx.sparks(this.at(ti, 0.8), '#ffffff', 10, 2);
            if (e.item === 'bomb' || e.item === 'flask') { for (const ti of e.targets) this.fx.shoot(this.at(e.u, 0.8), this.at(ti, 0.5), e.item === 'bomb' ? '#ff8a3a' : '#bfefff', 0.4, null, 'rock', 0.22); return 0.42; }
            return 0.35;
        }
        // where the blow lands
        if (melee && tgt && !['whirl', 'quake', 'burstHoly', 'burstWild', 'lash'].includes(fx)) {
            const dir = tgt.rig.root.position.clone().sub(a.rig.root.position).setY(0).normalize();
            const reach = tgt.kind === 'm' ? (tgt.boss ? 2.2 : 1.3) * (tgt.eid === 'pyrrhax' ? 1.8 : 1) : 1.1;
            a.lunge = { to: tgt.rig.root.position.clone().sub(dir.multiplyScalar(reach)).setY(0), t: 0, dur: 0.22 };
            if (a.kind === 'h') setTimeout(() => setPose(a.rig, 'attack'), 140);
            else a.attackT = 0.45;
            setTimeout(() => {
                const p = this.at(t0, 0.6);
                const yaw = a.side === 'p' ? -PI / 2 : PI / 2;
                if (fx === 'claw' || fx === 'pinch') this.fx.slash(p, yaw, '#ffffff', 0.9, 1.2);
                else if (fx !== 'bump' && fx !== 'roots') this.fx.slash(p, yaw, col === '#ffffff' && fx === 'holySlash' ? '#fff2b0' : col, 1.1);
                if (fx === 'roots') this.fx.puffs(this.at(t0, 0.05), '#6a4a2a', 10, { size: 0.6 });
                if (fx === 'rune') this.fx.iceBurst(this.at(t0, 0));
            }, 300);
            return 0.36;
        }
        if (['whirl', 'quake', 'burstHoly', 'burstWild', 'lash'].includes(fx)) {
            const centre = V(-4.5, 0, 0);
            if (a.side === 'e') centre.set(5, 0, 0);
            a.lunge = { to: a.side === 'p' ? V(0.5, 0, 0) : V(1, 0, 0), t: 0, dur: 0.22 };
            if (a.kind === 'h') setTimeout(() => setPose(a.rig, 'attack'), 140); else a.attackT = 0.45;
            setTimeout(() => {
                this.fx.ring(centre.clone().add(V(0, 0.15, 0)), fx === 'quake' ? '#c8a070' : fx === 'burstHoly' ? '#fff2b0' : '#ffffff', 7, 0.5);
                if (fx === 'quake') { this.shake = 0.6; for (const ti of e.targets) this.fx.puffs(this.at(ti, 0.05), '#a8906a', 8, { size: 0.8 }); }
                if (fx === 'burstWild') for (const ti of e.targets) this.fx.sparks(this.at(ti, 0.5), '#9affc0', 20, 4);
            }, 300);
            return 0.38;
        }
        // projectiles and spells
        const from = this.at(e.u, a.kind === 'h' ? 0.75 : 0.6);
        if (a.kind === 'h') from.x -= 0.5;
        const targets = (e.targets ?? []).map((ti) => [ti, this.at(ti, 0.55)]);
        if (fx === 'arrow' || fx === 'burstStars') {
            for (const [, p] of targets) this.fx.shoot(from, p, fx === 'burstStars' ? '#fff27a' : col, 0.3, null, 'arrow');
            if (!targets.length && fx === 'burstStars') for (let k = 0; k < 4; k++) this.fx.shoot(from, V(-4 - Math.random() * 2, 1 + Math.random(), (Math.random() - 0.5) * 5), '#fff27a', 0.3, null, 'arrow');
            return 0.3;
        }
        if (fx === 'rain') { for (const [, p] of targets) for (let k = 0; k < 3; k++) this.fx.shoot(p.clone().add(V(1.5 + k * 0.3, 6, k * 0.4)), p, '#ffffff', 0.3 + k * 0.05, null, 'arrow'); return 0.35; }
        if (fx === 'cannon' || fx === 'burstCannon') { for (const [, p] of targets) this.fx.shoot(from.clone().add(V(0, 0.5, 0)), p, '#3a3a40', 0.45, () => this.fx.sparks(p, '#ff8a3a', 26, 5), 'rock', 0.28); return 0.45; }
        if (fx === 'fireball' || fx === 'ember') { for (const [, p] of targets) this.fx.shoot(from, p, '#ff7a2a', 0.38, null, 'orb', 0.3); this.magicCircle(a, '#ff8a3a'); return 0.4; }
        if (fx === 'iceShard') { for (const [, p] of targets) this.fx.shoot(from, p, '#bfefff', 0.32, null, 'orb', 0.22); return 0.34; }
        if (fx === 'zap' || fx === 'spark' || fx === 'bolt') { this.magicCircle(a, '#fff27a'); for (const [, p] of targets) setTimeout(() => this.fx.bolt(p, '#fff6a0'), 250); this.flash = ['#fff6c0', 0.25]; return 0.4; }
        if (fx === 'goo' || fx === 'spores' || fx === 'ink') { for (const [, p] of targets) this.fx.shoot(from, p, fx === 'goo' ? '#8aff6a' : fx === 'ink' ? '#3a2a4a' : '#d08aff', 0.4, null, 'orb', 0.25); return 0.42; }
        if (fx === 'holy' || fx === 'revive') { this.magicCircle(a, '#fff2b0'); for (const [, p] of targets) setTimeout(() => this.fx.beam(p.clone().setY(0), '#fff2b0', 8, 0.6, 0.7), 200); return 0.45; }
        if (fx === 'nova' || fx === 'blizzard' || fx === 'burstFrost') { this.magicCircle(a, '#9ae8ff'); for (const [ti] of targets) setTimeout(() => this.fx.iceBurst(this.at(ti, 0)), 250); if (fx !== 'nova') this.snow = 1.5; return 0.45; }
        if (fx === 'meteor' || fx === 'burstArcane' || fx === 'inferno' || fx === 'breath' || fx === 'wave') {
            const c = fx === 'burstArcane' ? '#d8a0ff' : fx === 'wave' ? '#5ad8ff' : '#ff7a2a';
            if (fx === 'breath' || fx === 'inferno') {
                const mouth = a.eid === 'pyrrhax' ? this.at(e.u, 0.85).add(V(2.6, 0, 0)) : from;
                for (const [, p] of targets) for (let k = 0; k < (fx === 'inferno' ? 6 : 3); k++) setTimeout(() => this.fx.shoot(mouth, p.clone().add(V(0, Math.random() * 0.5, (Math.random() - 0.5))), k % 2 ? '#ffd84a' : '#ff6a1a', 0.35, null, 'orb', 0.45), k * 60);
                this.flash = ['#ff8a3a', fx === 'inferno' ? 0.45 : 0.2];
                if (fx === 'inferno') this.shake = 0.9;
                return 0.55;
            }
            this.magicCircle(a, c);
            for (const [, p] of targets) this.fx.shoot(p.clone().add(V(3, 9, -2)), p, c, 0.5, () => { this.fx.ring(p.clone().setY(0.15), c, 3, 0.5); this.fx.sparks(p, c, 30, 6); }, 'orb', fx === 'meteor' ? 0.6 : 0.4);
            this.shake = 0.5;
            return 0.55;
        }
        if (['heal', 'healAll', 'burstHeal', 'rally', 'ward', 'vines', 'shield', 'roar'].includes(fx)) {
            const c = fx === 'rally' ? '#ff8a6a' : fx === 'ward' ? '#a8c8ff' : fx === 'vines' ? '#7ae06a' : fx === 'shield' ? '#a8c8ff' : fx === 'roar' ? '#ff5a3a' : '#9affc0';
            this.magicCircle(a, c);
            if (fx === 'roar') { this.shake = 0.7; this.fx.ring(this.at(e.u, 0.6), '#ff8a6a', 5, 0.6, { vertical: true, lookAt: this.camera.position }); }
            if (fx === 'vines') for (const [ti] of targets) this.fx.puffs(this.at(ti, 0.05), '#5ac84a', 10, { size: 0.5, up: 2 });
            return 0.4;
        }
        if (fx === 'gust') { for (const [, p] of targets) this.fx.puffs(p, '#e0f4ff', 10, { size: 0.8, out: 3, up: 0.5 }); return 0.4; }
        // anything else: a quick flash at the target
        return 0.3;
    }

    magicCircle(a, color) {
        this.fx.ring(a.rig.root.position.clone().add(V(0, 0.08, 0)), color, 1.8, 0.7);
        this.fx.motes(a.rig.root.position, color, 12, 1.5);
    }

    impact(p, el, big) {
        const col = { fire: '#ff8a3a', frost: '#bfefff', storm: '#fff27a', holy: '#fff2b0' }[el] ?? '#ffffff';
        this.fx.sparks(p, col, big ? 22 : 12, big ? 5 : 3.5, { size: 0.3 });
        if (el === 'fire') this.fx.puffs(p, '#ff7a2a', 5, { size: 0.5, up: 1.5 });
        if (el === 'frost') this.fx.sparks(p, '#ffffff', 8, 2, { g: 2 });
        if (big) this.fx.ring(p, col, 2.2, 0.35, { vertical: true, lookAt: this.camera.position });
    }

    returnAll(except) {
        for (let i = 0; i < this.units.length; i++) {
            const u = this.units[i];
            if (!u || i === except) continue;
            if (u.lunge || u.rig.root.position.distanceToSquared(u.home) > 0.01) u.lunge = { to: u.home.clone(), t: 0, dur: 0.2, back: true };
            if (u.kind === 'h' && u.alive && !['victory', 'ko', 'hurt'].includes(u.rig.pose)) setPose(u.rig, 'ready');
        }
        if (this.camK > 0 && except == null) this.camK = 0;
    }

    // ------------------------------------------------------------------ frame
    update(dt, t, w, h) {
        this.t = t;
        const U = this.units;
        for (let i = 0; i < U.length; i++) {
            const u = U[i];
            if (!u) continue;
            const R = u.rig;
            if (u.lunge) {
                u.lunge.t += dt;
                const k = Math.min(1, u.lunge.t / u.lunge.dur);
                if (!u.lunge.from) u.lunge.from = R.root.position.clone();
                R.root.position.lerpVectors(u.lunge.from, u.lunge.to, 1 - (1 - k) * (1 - k));
                if (k >= 1) u.lunge = null;
            } else if (u.flee) {
                u.flee += dt;
                R.root.position.x += dt * 7;
            }
            if (u.kind === 'h') {
                animate(R, dt, t);
                if (u.hurtT > 0) { u.hurtT -= dt; if (u.hurtT <= 0) { if (u.alive) setPose(R, 'ready'); R.setExpr('normal'); } }
                if (u.poseT > 0) { u.poseT -= dt; if (u.poseT <= 0 && u.alive && R.pose !== 'victory') setPose(R, 'ready'); }
                // a bounce for whoever is choosing
                const act = i === this.active && u.alive && !u.lunge;
                R.root.position.y = act ? Math.abs(Math.sin(t * 5)) * 0.08 : 0;
                if (act && !u.lunge) R.root.position.x += (u.home.x - 0.6 - R.root.position.x) * Math.min(1, dt * 8);
            } else {
                animateMonster(R, t, dt, u.mode ?? 'idle');
                if (u.eid === 'pyrrhax' || u.eid === 'whelp') {
                    if (u.jawT > 0) { u.jawT -= dt; R.jaw = Math.sin(Math.min(1, (1 - u.jawT) * 2) * PI) ; } else R.jaw = 0;
                    R.parts.mouthGlow && (R.parts.mouthGlow.visible = u.jawT > 0);
                }
                if (u.knock > 0) { u.knock -= dt; R.root.position.x = (u.lunge ? R.root.position.x : u.home.x) - Math.sin(u.knock * 40) * 0.08; }
                if (u.attackT > 0) { u.attackT -= dt; R.body.rotation.z = Math.sin((0.45 - u.attackT) / 0.45 * PI) * 0.35; } else if (R.kind !== 'wisp') R.body.rotation.z *= 0.8;
                if (u.exprT > 0) { u.exprT -= dt; if (u.exprT <= 0 && u.eid !== 'pyrrhax') R.setExpr('normal'); }
                if (u.dying) {
                    u.dying += dt;
                    const k = Math.min(1, u.dying / 0.6);
                    R.root.scale.setScalar(Math.max(0.001, (1 - k) * (R.baseScale ?? (R.baseScale = R.root.scale.x || 1))));
                    R.root.rotation.y += dt * 8;
                    R.root.position.y += dt * 1.5;
                    if (k >= 1) { R.root.visible = false; u.dying = 0; }
                }
                if (u.spawn != null && u.spawn < 1) { u.spawn = Math.min(1, u.spawn + dt * 3); R.root.scale.setScalar(Math.max(0.01, u.spawn)); }
            }
            if (u.flashT > 0) { u.flashT -= dt; if (u.flashT <= 0) R.flash.value = 0; }
            if (R.parts?.dragon) R.parts.dragon.flash.value = R.flash.value;
        }
        if (this.snow > 0) {
            this.snow -= dt;
            for (let k = 0; k < 3; k++) this.fx.glow.emit({ x: -9 + Math.random() * 14, y: 8, z: -5 + Math.random() * 10, vx: 1.5, vy: -5, life: 1.4, size: 0.18, color: '#ffffff' });
        }
        if (this.theme?.lava && Math.random() < 0.4) this.fx.glow.emit({ x: -14 + Math.random() * 24, y: 0.2, z: -10 + Math.random() * 14, vy: 1.5 + Math.random(), vx: 0.3, life: 2.5, size: 0.18, color: '#ffa03a' });
        // camera: a slow sway, zooms toward bursts, and shakes
        const base = this.camBase;
        const sway = Math.sin(t * 0.3) * 0.6;
        const pos = base.pos.clone().add(V(sway, Math.sin(t * 0.23) * 0.2, 0));
        const look = base.look.clone();
        if (this.camK > 0) { pos.lerp(this.camFocus.clone().add(V(2.5, 2.2, 7)), this.camK * 0.6); look.lerp(this.camFocus, this.camK * 0.7); }
        if (this.intro > 0) { this.intro -= dt * 1.4; pos.add(V(0, this.intro * 3, this.intro * 6)); }
        if (this.shake > 0) { this.shake -= dt; pos.add(V((Math.random() - 0.5) * this.shake * 0.5, (Math.random() - 0.5) * this.shake * 0.5, 0)); }
        const aspect = w / Math.max(1, h);
        if (aspect < 1) pos.add(V(0.8, 2.5, 9).multiplyScalar(1 - aspect));
        this.camera.position.copy(pos);
        this.camera.lookAt(look);
        this.fx.setScale(h);
        this.fx.update(dt, this.camera, w, h);
    }

    /** Screen position (CSS px) of a unit's head, for UI markers and tap targets. */
    screenOf(i, w, h, k = 1.05) {
        const p = this.at(i, k).project(this.camera);
        return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h };
    }

    /** The unit index under a screen point (normalised device coords), or −1. */
    pick(nx, ny, side) {
        let best = -1, bd = 0.08;
        this.units.forEach((u, i) => {
            if (!u || (side && u.side !== side)) return;
            for (const k of [0.3, 0.6, 0.9]) {
                const p = this.at(i, k).project(this.camera);
                const d = Math.hypot(p.x - nx, (p.y - ny) * 0.6);
                if (d < bd) { bd = d; best = i; }
            }
        });
        return best;
    }
}

export { ELEMENT_ICON, sph, box };
