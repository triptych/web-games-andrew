// Scene orchestration: builds a system's scene from the sim, syncs ships every frame,
// drives the chase/dock/title cameras and turns sim events into effects.

import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { buildSky } from './sky.js';
import { buildStar, buildPlanet } from './bodies.js';
import { Asteroids } from './asteroids.js';
import { buildShip } from './shipgen.js';
import { buildStation, buildHearth, buildPoi } from './stations.js';
import { FX } from './fx.js';
import { PAINTS, ROCK_TYPES, ENEMIES } from '../config.js';

const tmpV = new THREE.Vector3();

export class View {
    constructor(canvas) {
        this.r = new Renderer(canvas);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 200000);
        this.camera.position.set(0, 50, -200);
        this.r.setup(this.scene, this.camera);
        this.sysGroup = new THREE.Group();
        this.scene.add(this.sysGroup);
        this.starLight = new THREE.PointLight(0xffffff, 3.2, 0, 0);
        this.scene.add(this.starLight);
        this.ambient = new THREE.AmbientLight(0x404a66, 0.8);
        this.scene.add(this.ambient);
        this.hemi = new THREE.HemisphereLight(0x8090c0, 0x201810, 0.6);
        this.scene.add(this.hemi);
        this.fill = new THREE.DirectionalLight(0x8aa0ff, 0.25);
        this.scene.add(this.fill);
        this.pmrem = new THREE.PMREMGenerator(this.r.gl);
        this.asteroids = new Asteroids(this.scene);
        this.fx = new FX(this.scene, this.camera);
        this.updaters = [];
        this.stationObjs = new Map();
        this.poiObjs = new Map();
        this.enemyObjs = new Map();
        this.trafficObjs = new Map();
        this.protos = new Map();
        this.playerShip = null;
        this.playerKey = '';
        this.hearthKey = '';
        this.camMode = 'title';
        this.camT = 0;
        this.shake = 0;
        this.fovKick = 0;
        this.warpK = 0;
        this.flash = 0;
        this.damage = 0;
        this.camVel = new THREE.Vector3();
        this.camLook = new THREE.Vector3();
        this.sysId = null;
        this.t = 0;
    }

    resize(w, h) { this.r.resize(w, h); }

    // ---------------------------------------------------------------- system
    enterSystem(world) {
        const sys = world.sys;
        const tier = this.r.tier;
        for (const c of [...this.sysGroup.children]) { this.sysGroup.remove(c); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
        this.updaters = [];
        this.stationObjs.clear();
        this.poiObjs.clear();
        for (const o of this.enemyObjs.values()) { this.scene.remove(o); o.userData.dispose?.(); }
        this.enemyObjs.clear();
        for (const o of this.trafficObjs.values()) { this.scene.remove(o); o.userData.dispose?.(); }
        this.trafficObjs.clear();
        this.fx.clear();
        this.sky = buildSky(sys, tier);
        this.sysGroup.add(this.sky);
        const star = buildStar(sys);
        this.sysGroup.add(star);
        this.updaters.push(star.userData.update);
        this.buildEnv(sys);
        this.starLight.color.set(sys.star.color).lerp(new THREE.Color(1, 1, 1), 0.45);
        this.starLight.intensity = 2.6 + sys.star.lum * 0.6;
        const skyCol = new THREE.Color().setHSL(sys.sky.hue1, 0.5, 0.5);
        this.hemi.color.copy(skyCol);
        this.ambient.color.copy(skyCol).lerp(new THREE.Color(0x404a66), 0.6);
        for (const p of sys.planets) {
            const g = buildPlanet(p, tier);
            this.sysGroup.add(g);
            this.updaters.push(g.userData.update);
        }
        this.asteroids.buildDust(sys, tier);
        for (const st of sys.stations) {
            const sp = this.game.galaxy.species[st.species];
            const g = st.kind === 'hearth' ? buildHearth(this.game.s.base) : buildStation(st, sp);
            g.position.set(st.pos.x, st.pos.y, st.pos.z);
            this.sysGroup.add(g);
            this.stationObjs.set(st.id, g);
            if (st.kind === 'hearth') { this.hearthObj = g; this.hearthKey = this.baseKey(); }
        }
        this.syncPois(world, true);
        this.sysId = sys.id;
        this.fill.position.set(-1, 0.5, -1);
    }
    // A soft environment for metals: a sphere with the nebula colours and a hot spot toward the star.
    buildEnv(sys) {
        const envScene = new THREE.Scene();
        const c1 = new THREE.Color().setHSL(sys.sky.hue1, 0.55, 0.22), c2 = new THREE.Color().setHSL(sys.sky.hue2, 0.5, 0.12);
        const star = new THREE.Color(sys.star.color);
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            uniforms: { c1: { value: c1 }, c2: { value: c2 }, cs: { value: star } },
            vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'uniform vec3 c1, c2, cs; varying vec3 vD; void main(){ float y = vD.y * 0.5 + 0.5; vec3 c = mix(c2, c1, y); c += cs * pow(max(0.0, dot(vD, normalize(vec3(0.6, 0.3, 0.7)))), 12.0) * 2.0; gl_FragColor = vec4(c, 1.0); }',
        });
        envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
        if (this.envTex) this.envTex.dispose();
        this.envTex = this.pmrem.fromScene(envScene, 0.04).texture;
        this.scene.environment = this.envTex;
        mat.dispose();
    }
    baseKey() { return this.game.s.base.modules.map((m) => `${m.type}${m.level}`).join(','); }
    refreshHearth(world) {
        const st = world.sys.stations.find((s) => s.kind === 'hearth');
        if (!st || this.baseKey() === this.hearthKey) return;
        if (this.hearthObj) { this.sysGroup.remove(this.hearthObj); this.hearthObj.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
        const g = buildHearth(this.game.s.base);
        g.position.set(st.pos.x, st.pos.y, st.pos.z);
        this.sysGroup.add(g);
        this.stationObjs.set(st.id, g);
        this.hearthObj = g;
        this.hearthKey = this.baseKey();
    }
    syncPois(world, force = false) {
        const want = [...world.visiblePois(), ...world.extra];
        const ids = new Set(want.map((o) => o.id));
        for (const [id, g] of this.poiObjs) if (!ids.has(id)) { this.sysGroup.remove(g); this.poiObjs.delete(id); }
        for (const o of want) {
            if (this.poiObjs.has(o.id)) continue;
            const g = buildPoi(o);
            this.sysGroup.add(g);
            this.poiObjs.set(o.id, g);
        }
    }

    // ---------------------------------------------------------------- ships
    shipFor(kind, seed, cls, colors, style, scale = 1) {
        return buildShip({ seed, cls, style, colors, scale });
    }

    ensurePlayerShip() {
        const sh = this.game.s.ship;
        const key = `${sh.design}|${sh.hull}|${sh.paint}`;
        if (key === this.playerKey && this.playerShip) return;
        if (this.playerShip) { this.scene.remove(this.playerShip); this.playerShip.userData.dispose?.(); }
        const p = PAINTS[sh.paint] || PAINTS[0];
        this.playerShip = buildShip({ seed: sh.design, cls: sh.hull, style: 'guild', colors: p, scale: 0.55 });
        this.scene.add(this.playerShip);
        this.playerKey = key;
    }

    enemyColors(e) {
        if (e.faction === 'swarm') { const sp = this.game.galaxy.species.find((s) => s.hostile); return { a: sp.palette.dark, b: sp.palette.skin, c: sp.palette.eye }; }
        if (e.faction === 'warden') return { a: '#2a2440', b: '#6a3cff', c: '#c79bff' };
        return { a: '#3a2a2a', b: '#1a1416', c: '#ff4a2a' };
    }

    syncShips(world, t, dt) {
        // Enemies
        const live = new Set();
        for (const e of world.enemies) {
            live.add(e.id);
            let o = this.enemyObjs.get(e.id);
            if (!o) {
                const style = e.faction === 'swarm' ? 'swarm' : e.faction === 'warden' ? 'warden' : 'reaver';
                o = this.shipFor(e.type, (e.seed % 5) + ENEMIES[e.type].cls * 101, ENEMIES[e.type].cls, this.enemyColors(e), style, 0.55 * e.def.size);
                this.scene.add(o);
                this.enemyObjs.set(e.id, o);
            }
            o.position.set(e.pos.x, e.pos.y, e.pos.z);
            o.rotation.set(-e.pitch, e.yaw, -(e.bank || 0), 'YXZ');
            o.userData.setThrust?.(e.state === 'approach' ? 1 : 0.6, t);
            if (e.hitT > 0) o.visible = Math.floor(t * 30) % 2 === 0; else o.visible = true;
            if (Math.random() < 0.3 * this.fx.parts.budget && o.userData.engines?.length) {
                const en = o.userData.engines[0];
                tmpV.set(en.x, en.y, en.z).multiplyScalar(0.55 * e.def.size).applyQuaternion(o.quaternion).add(o.position);
                this.fx.parts.emit(tmpV, { x: 0, y: 0, z: 0 }, o.userData.glowCol.clone().multiplyScalar(1.2), 3 * e.def.size, 0.5, { drag: 1 });
            }
        }
        for (const [id, o] of this.enemyObjs) if (!live.has(id)) { this.scene.remove(o); o.userData.dispose?.(); this.enemyObjs.delete(id); }
        // Traffic
        const tl = new Set();
        for (const n of world.traffic) {
            tl.add(n.id);
            let o = this.trafficObjs.get(n.id);
            if (!o) {
                const sp = this.game.galaxy.species[n.species];
                o = this.shipFor('npc', n.seed % 7, n.cls, sp ? { a: sp.ship.a, b: sp.ship.b, c: sp.ship.c } : PAINTS[1], 'trader', 0.6);
                this.scene.add(o);
                this.trafficObjs.set(n.id, o);
            }
            o.position.set(n.pos.x, n.pos.y, n.pos.z);
            o.rotation.set(-n.pitch, n.yaw, 0, 'YXZ');
            o.userData.setThrust?.(0.7, t);
        }
        for (const [id, o] of this.trafficObjs) if (!tl.has(id)) { this.scene.remove(o); this.trafficObjs.delete(id); }
    }

    // ---------------------------------------------------------------- events
    onEvent(e, world) {
        const fx = this.fx;
        switch (e.type) {
            case 'explode':
                fx.explosion(e.pos, e.size * (e.boss ? 1.6 : 1), e.faction === 'swarm' ? '#9aff6a' : e.faction === 'warden' ? '#c79bff' : '#ffa040');
                if (world && Math.hypot(e.pos.x - world.player.pos.x, e.pos.y - world.player.pos.y, e.pos.z - world.player.pos.z) < 600) this.shake = Math.max(this.shake, 0.6 * e.size);
                if (e.player) { this.shake = 2; this.flash = 0.8; }
                break;
            case 'hit': {
                fx.hit(e.pos, e.shield);
                this.shake = Math.max(this.shake, 0.35);
                if (e.shield && this.playerShip) {
                    const local = new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z).sub(this.playerShip.position).applyQuaternion(this.playerShip.quaternion.clone().invert()).normalize();
                    fx.shieldHit(local);
                } else this.damage = 0.8;
                break;
            }
            case 'ehit': fx.hit(e.pos, e.shield); break;
            case 'spark': fx.sparks(e.pos, '#ffd27a', 5, 50); break;
            case 'bump': this.shake = Math.max(this.shake, Math.min(1.2, e.impact / 80)); fx.sparks(e.pos, '#ffffff', 12, 60); break;
            case 'mine':
                if (this.playerShip) fx.oreStream(e.pos, this.playerShip.position, e.res);
                break;
            case 'rockBreak': fx.rockBreak(e.pos, e.radius, ROCK_TYPES[e.rockType]?.color || '#888'); this.shake = Math.max(this.shake, 0.25); break;
            case 'pickup': if (this.playerShip) fx.sparks(this.playerShip.position, '#6bffb0', 14, 40); break;
            case 'shard': this.flash = 0.7; this.fovKick = 6; break;
            case 'interdict': this.shake = 1.4; this.flash = 0.3; break;
            case 'built': if (world) this.refreshHearth(world); break;
            case 'clusters': break;
            default: break;
        }
    }

    // ---------------------------------------------------------------- per frame
    update(dt, world, mode, ui = {}) {
        this.t += dt;
        const t = this.t;
        for (const u of this.updaters) u(t);
        for (const g of this.stationObjs.values()) g.userData.update?.(t);
        for (const g of this.poiObjs.values()) g.userData.update?.(t);
        if (world) {
            this.ensurePlayerShip();
            const p = world.player;
            const ship = this.playerShip;
            ship.visible = !p.dead && !(world.docked && mode !== 'title');
            ship.position.set(p.pos.x, p.pos.y, p.pos.z);
            ship.rotation.set(-p.pitch, p.yaw, -p.roll, 'YXZ');
            const st = this.game.stats();
            const thrust = p.cruise.state === 'on' ? 1 : Math.min(1, p.speed / st.speed) * (p.boosting ? 1.4 : 1);
            ship.userData.setThrust(Math.min(1.4, thrust), t);
            // Exhaust particles
            if (ship.visible && thrust > 0.05) {
                for (const en of ship.userData.engines) {
                    if (Math.random() > (0.5 + thrust * 0.5) * this.fx.parts.budget) continue;
                    tmpV.set(en.x, en.y, en.z).multiplyScalar(0.55).applyQuaternion(ship.quaternion).add(ship.position);
                    this.fx.parts.emit(tmpV, { x: -p.vel.x * 0.05, y: -p.vel.y * 0.05, z: -p.vel.z * 0.05 }, ship.userData.glowCol.clone().multiplyScalar(p.boosting ? 2.2 : 1.4), en.r * 0.9 * (1 + thrust), 0.35 + thrust * 0.3, { drag: 1.5 });
                }
            }
            this.asteroids.sync(world, t, p.mining);
            this.syncShips(world, t, dt);
            if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) this.syncPois(world);
        }
        this.updateCamera(dt, world, mode);
        this.fx.update(dt, t, world, this);
        // Warp tunnel & lens effects
        this.fx.warpTunnel(this.warpK, t);
        this.shake = Math.max(0, this.shake - dt * 2.2);
        this.flash = Math.max(0, this.flash - dt * 1.6);
        this.damage = Math.max(0, this.damage - dt * 2);
        this.fovKick *= Math.max(0, 1 - dt * 3);
        const L = this.r.lens.uniforms;
        const sp = world ? world.player.speed : 0;
        L.uCA.value = 0.0012 + Math.min(0.004, sp / 900000) + this.warpK * 0.006;
        L.uFlash.value.set(1, 1, 1, Math.min(1, this.flash));
        L.uDamage.value = this.damage + (ui.lowHull ? 0.25 + 0.15 * Math.sin(t * 6) : 0);
        this.r.render(dt);
    }

    updateCamera(dt, world, mode) {
        const cam = this.camera;
        this.camT += dt;
        let fov = 62;
        if (mode === 'title' && world) {
            const st = world.sys.stations.find((s) => s.kind === 'hearth') || world.sys.stations[0];
            const c = st ? new THREE.Vector3(st.pos.x, st.pos.y, st.pos.z) : new THREE.Vector3();
            const a = this.camT * 0.04;
            const target = c.clone().add(new THREE.Vector3(Math.cos(a) * 420, 90 + Math.sin(a * 0.7) * 40, Math.sin(a) * 420));
            cam.position.lerp(target, Math.min(1, dt * 1.5));
            if (cam.position.distanceTo(target) > 2000) cam.position.copy(target);
            this.camLook.lerp(c.clone().add(new THREE.Vector3(Math.sin(a) * 80, 0, 0)), Math.min(1, dt * 2));
            cam.lookAt(this.camLook);
            fov = 55;
        } else if ((mode === 'docked' || world?.docked) && world) {
            const st = world.sys.stations.find((s) => s.id === world.dockedId);
            const c = st ? new THREE.Vector3(st.pos.x, st.pos.y, st.pos.z) : new THREE.Vector3();
            const a = this.camT * 0.06;
            const R = st?.kind === 'hearth' ? 300 : 280;
            const target = c.clone().add(new THREE.Vector3(Math.cos(a) * R, 70, Math.sin(a) * R));
            if (cam.position.distanceTo(target) > 3000) cam.position.copy(target);
            cam.position.lerp(target, Math.min(1, dt * 1.2));
            // Keep the station in the open left part of the screen (menus sit on the right).
            const right = new THREE.Vector3().subVectors(c, cam.position).cross(new THREE.Vector3(0, 1, 0)).normalize();
            const shift = innerWidth > 700 ? R * 0.45 : 0;
            this.camLook.lerp(c.clone().addScaledVector(right, shift), Math.min(1, dt * 2));
            cam.lookAt(this.camLook);
            fov = 55;
        } else if (world) {
            const p = world.player;
            const ship = this.playerShip;
            const st = this.game.stats();
            const cruise = p.cruise.state === 'on';
            const sc = st.scale;
            const dist = 30 * sc + (cruise ? 22 : 0) + Math.min(14, p.speed * 0.06) + (p.dead ? 60 : 0);
            const height = 8.5 * sc + (cruise ? 4 : 0);
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-p.pitch, p.yaw, 0, 'YXZ'));
            const back = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
            const fwd = back.clone().negate();
            const target = ship.position.clone().addScaledVector(back, dist).addScaledVector(up, height);
            if (cam.position.distanceTo(target) > 1500 || this.snapNext) { cam.position.copy(target); this.snapNext = false; }
            const k = Math.min(1, dt * (cruise ? 8 : 6));
            cam.position.lerp(target, k);
            const look = ship.position.clone().addScaledVector(fwd, 40).addScaledVector(up, 3 * sc);
            this.camLook.lerp(look, Math.min(1, dt * 10));
            cam.up.lerp(up, Math.min(1, dt * 3)).normalize();
            cam.lookAt(this.camLook);
            fov = 62 + (p.boosting ? 7 : 0) + (cruise ? Math.min(16, p.cruise.speed / 180) : 0) + (p.cruise.state === 'charge' ? -3 * p.cruise.t : 0);
        }
        if (this.shake > 0) {
            const s = this.shake * this.shake * 2.2;
            cam.position.x += (Math.random() - 0.5) * s;
            cam.position.y += (Math.random() - 0.5) * s;
            cam.position.z += (Math.random() - 0.5) * s;
        }
        fov += this.fovKick + this.warpK * 35;
        if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix(); }
        if (this.sky) this.sky.position.copy(cam.position);
        this.fill.position.copy(cam.position).add(new THREE.Vector3(-300, 200, -300));
        this.fill.target.position.copy(cam.position);
    }

    // World position → screen (CSS px). Returns null when behind the camera.
    project(pos, w, h) {
        tmpV.set(pos.x, pos.y, pos.z).project(this.camera);
        const behind = tmpV.z > 1;
        return { x: (tmpV.x * 0.5 + 0.5) * w, y: (-tmpV.y * 0.5 + 0.5) * h, behind, z: tmpV.z };
    }
}
