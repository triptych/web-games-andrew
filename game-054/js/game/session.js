/**
 * session.js — one level being played. Owns the world, the player, monsters,
 * projectiles, pickups, barrels and triggers, and is the single place where
 * damage is resolved, so every weapon and every monster goes through the
 * same rules (armour, powerups, splash falloff, line of sight, knockback,
 * gibbing, infighting).
 *
 * The session never touches the DOM: it raises callbacks (onMessage,
 * onComms, onLog, onComplete, onDeath…) that main.js wires to the UI.
 */
import * as THREE from 'three';
import { CELL, STEP, PICKUPS, WEAPON_BY_ID, AMMO, KEY_ORDER, POWER_INFO } from '../config.js';
import { generateLevel, K_DOOR } from '../level/gen.js';
import { buildLevel } from '../level/build.js';
import { bakeLightmap } from '../level/lightmap.js';
import { THEMES } from '../level/textures.js';
import { G, disposeObject } from '../render/materials.js';
import { createSky } from '../render/sky.js';
import { World } from './world.js';
import { Monster } from './monsters.js';
import { Projectiles } from './projectiles.js';
import { makePickup, makeBarrel, buildDecor } from './props.js';
import { colorBox } from '../level/build.js';
import { actorMaterial } from '../render/materials.js';
import { ARCHETYPES } from './bestiary.js';
import { sfx, voice, music, setListener } from '../audio.js';
import { input } from '../input.js';
import { BARKS, LOGS } from '../story.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const WEAPON_AMMO_BONUS = { shotgun: ['shells', 8], ssg: ['shells', 10], chaingun: ['bullets', 40], rocket: ['rockets', 4], plasma: ['cells', 60], rail: ['cells', 40], bfg: ['cells', 80] };
const DROPS = { husk: 'clip' };

export class Session {
    constructor(ctx) {
        this.R = ctx.renderer;
        this.scene = ctx.renderer.scene;
        this.fx = ctx.fx;
        this.vm = ctx.vm;
        this.player = ctx.player;
        this.weapons = ctx.weapons;
        this.weapons.S = this;
        this.species = ctx.species;
        this.settings = ctx.settings;
        this.cb = ctx.callbacks;
        this.seenSpecies = ctx.seenSpecies;
        this.monsters = [];
        this.barrels = [];
        this.pickups = [];
        this.terminals = [];
        this.shockwaves = [];
        this.time = 0;
        this.levelTime = 0;
        this.proj = new Projectiles(this);
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.combat = 0;
        this.paused = false;
    }

    // ------------------------------------------------------------------ loading

    load(spec, seed, opts) {
        this.spec = spec;
        this.diff = opts.difficulty;
        this.depth = opts.depth;
        const L = generateLevel(spec, seed, { depth: opts.depth, difficulty: opts.difficulty, arsenal: opts.arsenal });
        this.L = L;
        this.world = new World(L);
        this.fx.setWorld(this.world);
        const theme = THEMES[L.theme];
        this.theme = theme;
        const q = this.R.quality;
        const built = buildLevel(L, { texSize: q && this.R.tier >= 2 ? 128 : 256, anisotropy: this.R.tier >= 2 ? 1 : 4 });
        this.built = built;
        this.root.add(built.group);
        const lm = bakeLightmap(L, theme);
        this.lm = lm;
        G.uLM.value = lm.main;
        G.uLMF.value = lm.flicker;
        G.uLMSize.value.set(L.W * CELL, L.H * CELL);
        G.uFog.value.set(theme.fog);
        G.uFogD.value = theme.fogDensity;
        G.uAmb.value.setRGB(...theme.ambient);
        this.R.post.uGrade.value.set(...theme.grade);
        this.R.post.uHeat.value = L.theme === 'foundry' ? 0.5 : L.theme === 'hell' ? 0.8 : 0;
        this.R.renderer.setClearColor(theme.fog);
        this.sky = createSky(theme.sky);
        this.root.add(this.sky);
        // decor
        const dec = buildDecor(L, CELL);
        if (dec.mesh) this.root.add(dec.mesh);
        this.emitters = dec.emitters;
        this.decorSolids = L.things.filter((t) => t.type === 'decor' && t.solid > 0).map((t) => ({ x: t.x * CELL, z: t.z * CELL, r: t.solid }));

        // stats
        this.stats = { kills: 0, monsters: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: L.secrets.length, time: 0, par: spec.par ?? 240, damageTaken: 0, shots: 0 };
        // things
        for (const t of L.things) {
            const x = t.x * CELL, z = t.z * CELL;
            if (t.type === 'monster' && !t.ambush) this.spawnMonster(t.arch, x, z, { angle: t.angle, elite: t.elite, zone: t.zone, boss: t.boss });
            else if (t.type === 'pickup') this._addPickup(t.id, x, z, { secret: t.secret });
            else if (t.type === 'barrel') this._addBarrel(x, z);
            else if (t.type === 'terminal') this.terminals.push({ ...t, wx: x, wz: z, read: false });
        }
        this.ambush = L.things.filter((t) => t.type === 'monster' && t.ambush);
        this.stats.monsters += this.ambush.length;
        this.stats.totalItems = this.pickups.filter((p) => !p.id.startsWith('key_')).length;
        this.boss = this.monsters.find((m) => m.boss) ?? null;
        this.exitOpen = !L.exit.needsBoss;
        this._buildExitLever();
        this.exitDone = false;
        // player
        const P = this.player;
        P.spawn(L.start.x * CELL, L.start.z * CELL, L.floor[L.start.cell], L.start.angle);
        P.metalFloor = L.theme === 'station';
        this.weapons.select(this.weapons.current, true);
        // automap
        this.seen = new Uint8Array(L.W * L.H);
        this.seenT = 0;
        this.revealAll = false;
        this.flowT = 0;
        this.lastCell = -1;
        this.rooms = L.rooms;
        this.currentRoom = -1;
        this.roomsVisited = new Set();
        this.lowHealthBarked = false;
        this.messages = [];
        music.start(theme.music, seed ^ (opts.depth * 977));
        this.cb.onLevelStart?.(this);
        // put the camera where the player stands so the level card shows the start room
        this.R.camera.fov = this.settings.fov ?? 78;
        this._camera(0);
        return this;
    }

    dispose() {
        for (const m of this.monsters) m.remove();
        this.monsters = [];
        this.proj.clear();
        for (const p of this.pickups) this.root.remove(p.group);
        this.pickups = [];
        this.barrels = [];
        this.fx.clear();
        disposeObject(this.root);
        this.scene.remove(this.root);
        this.root = new THREE.Group();
        this.scene.add(this.root);
        G.uLM.value?.dispose?.(); G.uLMF.value?.dispose?.();
        G.uLM.value = null; G.uLMF.value = null;
    }

    _addPickup(id, x, z, opts = {}) {
        const c = this.world.cellAt(x, z);
        const y = this.L.floor[c] ?? 0;
        const group = makePickup(id);
        group.position.set(x, y + 0.45, z);
        this.root.add(group);
        const p = { id, x, z, y, group, taken: false, phase: Math.random() * 6, secret: opts.secret, dropped: !!opts.dropped };
        this.pickups.push(p);
        return p;
    }

    _addBarrel(x, z) {
        const c = this.world.cellAt(x, z);
        const y = this.L.floor[c] ?? 0;
        const mesh = makeBarrel(this.L.theme);
        mesh.position.set(x, y, z);
        mesh.rotation.y = Math.random() * 6;
        this.root.add(mesh);
        this.barrels.push({ isBarrel: true, x, z, y, r: 0.4, h: 1.1, hp: 25, dead: false, mesh, alive: true, get cy() { return this.y + 0.55; } });
    }

    spawnMonster(arch, x, z, opts = {}) {
        const m = new Monster(this, { arch, x, z, ...opts });
        this.monsters.push(m);
        if (opts.counted !== false) this.stats && (this.stats.monsters += opts.fromAmbush ? 0 : 1);
        if (opts.spawning) { this.fx.teleport(x, m.y, z, 0xff5a2a); sfx.teleport({ x, y: m.y, z }); }
        return m;
    }

    // ------------------------------------------------------------------ main update

    update(dt) {
        const P = this.player;
        this.time += dt;
        G.uTime.value = this.time;
        if (this.paused) return;
        this.levelTime += dt;
        this.stats.time = this.levelTime;
        const look = consume();
        if (this.demo) { look.x = 0; look.y = 0; }

        P.update(dt, this.world, look);
        this._decorPush(P);
        this._powers(dt);
        this._interact(dt);
        this.weapons.update(dt, look);

        // doors
        this.world.updateDoors(dt, (cell) => this._occupied(cell));
        for (const ev of this.world.events) {
            const d = ev.door;
            const pos = { x: (d.x + 0.5) * CELL, y: this.L.floor[d.cell] + 1.5, z: (d.y + 0.5) * CELL };
            if (ev.type === 'door') sfx.door(pos, ev.open);
            if (ev.type === 'secret' && !d.found) {
                d.found = true;
                this.stats.secrets++;
                sfx.secret(); sfx.door(pos, true);
                this.message('A secret is revealed!', '#ffe36b');
                this.comms(BARKS.secret);
                this._noiseCell(d.cell, 6);
            }
        }
        this.world.events.length = 0;
        for (const dm of this.built.doorMeshes) {
            if (!dm) continue;
            const d = dm.userData.door;
            dm.position.y = dm.userData.baseY + d.open * (dm.userData.h - 0.08);
            dm.visible = d.open < 0.99;
        }

        // flow field follows the player
        this.flowT -= dt;
        const pc = this.world.cellAt(P.x, P.z);
        if (pc !== this.lastCell || this.flowT <= 0) {
            this.lastCell = pc;
            this.flowT = 0.6;
            this.world.computeFlow(pc, null);
            this._enterCell(pc);
        }

        // monsters (far ones aren't drawn; the fog has them by then)
        for (const m of this.monsters) {
            m.update(dt);
            if (!m.gibbed) m.root.visible = Math.abs(m.x - P.x) + Math.abs(m.z - P.z) < 75;
        }
        // drop removed corpses past the cap
        if (this.monsters.length > 90) {
            const idx = this.monsters.findIndex((m) => m.state === 'dead' && !m.boss);
            if (idx >= 0) { this.monsters[idx].remove(); this.monsters.splice(idx, 1); }
        }
        if (this.boss?.shielded && this.boss.pylons?.every((p) => !p.alive)) {
            this.boss.shielded = false;
            if (this.boss.shieldMesh) this.boss.shieldMesh.visible = false;
            this.message('The shield collapses!', '#c9a0ff');
            sfx.explosion({ x: this.boss.x, y: this.boss.cy, z: this.boss.z }, 1.4);
            this.fx.explosion(this.boss.x, this.boss.cy, this.boss.z, 1.5, 0xb080ff);
        }
        if (this.boss?.shieldMesh?.visible) {
            this.boss.shieldMesh.position.set(this.boss.x, this.boss.cy, this.boss.z);
            this.boss.shieldMesh.rotation.y += dt;
        }

        this.proj.update(dt);
        this._updateBarrels(dt);
        this._updatePickups(dt);
        this._updateShockwaves(dt);
        this._updateLever(dt);
        this._ambient(dt);
        this._updateSeen(dt);

        // music intensity
        let near = 0;
        for (const m of this.monsters) if (m.alive && m.awake && !m.static && m.dist < 28) near += m.hasLos ? 1 : 0.4;
        this.combat = Math.max(this.combat - dt * 0.15, Math.min(1, near / 3));
        music.setCombat(this.combat);
        music.setBoss(!!(this.boss && this.boss.alive && this.boss.awake));

        this.fx.update(dt, this.R.height * this.R.renderer.getPixelRatio() * 0.9);
        this._camera(dt);
        setListener(P.x, P.eyeY, P.z, P.yaw);
        clearInputs();

        if (!P.alive && P.deathT > 2.2 && !this.deathReported) { this.deathReported = true; this.cb.onDeath?.(this); }
    }

    /** Title-screen attract mode: monsters idle, the camera drifts around the start room. */
    demoUpdate(dt) {
        this.time += dt;
        G.uTime.value = this.time;
        for (const m of this.monsters) m.update(dt);
        this._ambient(dt);
        for (const p of this.pickups) { p.phase += dt; p.group.position.y = p.y + 0.45 + Math.sin(p.phase * 2.2) * 0.08; if (p.group.userData.spin) p.group.userData.mesh.rotation.y += dt * 1.6; }
        this.fx.update(dt, this.R.height * this.R.renderer.getPixelRatio() * 0.9);
        const L = this.L, room = L.rooms[this.demoRoom ?? L.startRoom];
        const cx = (room.x + room.w / 2) * CELL, cz = (room.y + room.h / 2) * CELL;
        const a = this.time * 0.07;
        const rad = Math.min(room.w, room.h) * CELL * 0.22;
        const cam = this.R.camera;
        cam.position.set(cx + Math.cos(a) * rad, room.floor + 1.9 + Math.sin(this.time * 0.3) * 0.25, cz + Math.sin(a) * rad);
        cam.rotation.set(Math.sin(this.time * 0.21) * 0.08 + 0.05, -(a + Math.PI * 0.5) + Math.PI, 0);
        this.sky.position.copy(cam.position);
        if (this.L.theme === 'hell' || this.L.theme === 'throne') {
            const sky = this.sky.material.uniforms.uFlash;
            sky.value = Math.max(0, sky.value - dt * 3);
            if (Math.random() < dt * 0.12) sky.value = 1;
        }
    }

    _camera(dt) {
        const P = this.player, cam = this.R.camera;
        const sp = P.vel;
        P.bob += dt * sp * 1.25;
        const bobAmt = P.grounded && P.alive ? Math.min(1, sp / 10) * (this.settings.bob ?? 1) : 0;
        const shake = this.fx.shake * (this.settings.shake ?? 1);
        cam.position.set(
            P.x + (Math.random() - 0.5) * shake * 0.12,
            P.eyeY + Math.abs(Math.sin(P.bob)) * 0.07 * bobAmt + (Math.random() - 0.5) * shake * 0.1,
            P.z + (Math.random() - 0.5) * shake * 0.12,
        );
        cam.rotation.set(P.pitch + P.kickPitch, -P.yaw, P.roll + Math.sin(P.bob * 0.5) * 0.004 * bobAmt + P.hurtRoll * 0.08);
        P.hurtRoll = (P.hurtRoll ?? 0) * Math.max(0, 1 - dt * 5);
        const fov = (this.settings.fov ?? 78) + (P.powers.haste > 0 ? 6 : 0) + Math.min(4, sp * 0.15);
        if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix(); }
        this.sky.position.copy(cam.position);
    }

    _decorPush(P) {
        for (const s of this.decorSolids) {
            const dx = P.x - s.x, dz = P.z - s.z;
            const min = P.r + s.r;
            if (Math.abs(dx) < min && Math.abs(dz) < min) {
                if (Math.abs(dx) > Math.abs(dz)) this.world.move(P, (Math.sign(dx) * min - dx), 0);
                else this.world.move(P, 0, (Math.sign(dz) * min - dz));
            }
        }
        // barrels are solid too
        for (const b of this.barrels) {
            if (b.dead) continue;
            const dx = P.x - b.x, dz = P.z - b.z, min = P.r + b.r;
            if (Math.abs(dx) < min && Math.abs(dz) < min && P.y < b.y + 1.0) {
                if (Math.abs(dx) > Math.abs(dz)) this.world.move(P, (Math.sign(dx) * min - dx), 0);
                else this.world.move(P, 0, (Math.sign(dz) * min - dz));
            }
        }
    }

    _powers(dt) {
        const P = this.player, post = this.R.post;
        for (const k of Object.keys(P.powers)) {
            if (P.powers[k] > 0) {
                const before = P.powers[k];
                P.powers[k] = Math.max(0, P.powers[k] - dt);
                if (before > 3 && P.powers[k] <= 3) this.message(`${POWER_INFO[k].label} is wearing off`, POWER_INFO[k].color);
            }
        }
        const fade = (t) => (t <= 0 ? 0 : t < 3 ? (Math.sin(t * 12) > 0 ? 1 : 0.35) : 1);
        post.uBerserk.value = Math.min(1, P.powers.berserk > 0 ? 0.25 + 0.75 * Math.max(0, (P.powers.berserk - 30) / 10) : 0);
        post.uOverdrive.value = fade(P.powers.overdrive) * 0.8;
        post.uInvuln.value = fade(P.powers.invuln) * 0.85;
        post.uHaste.value = fade(P.powers.haste) * 0.8;
        post.uCloak.value = fade(P.powers.cloak) * 0.6;
        post.uSuit.value = fade(P.powers.suit) * 0.6;
        post.uDamage.value = Math.max(0, post.uDamage.value - dt * 2.2);
        post.uPickup.value = Math.max(0, post.uPickup.value - dt * 2.5);
        post.uAberration.value = Math.max(0, post.uAberration.value - dt * 3);
        post.uFlash.value = Math.max(0, post.uFlash.value - dt * 3);
        post.uLowHealth.value = P.alive ? Math.max(0, Math.min(1, (35 - P.health) / 30)) : 0;
        post.uDeath.value = P.alive ? 0 : Math.min(1, P.deathT);
        // liquid damage
        const c = this.world.cellAt(P.x, P.z);
        if (P.alive && this.L.liquid[c] && P.y <= this.L.floor[c] + 0.05) {
            P.liquidT -= dt;
            if (P.liquidT <= 0) {
                P.liquidT = 0.7;
                if (P.powers.suit <= 0 && P.powers.invuln <= 0) this.damagePlayer(this.theme.liquidDamage * (this.diff.dmg > 1 ? 1.2 : 1), 'liquid', null, true);
            }
        } else P.liquidT = 0.2;
    }

    // ------------------------------------------------------------------ interaction

    _interact(dt) {
        const P = this.player;
        if (!P.alive) return;
        const W = this.world, L = this.L;
        const f = P.forward();
        const use = input.pressed.has('use');
        let prompt = null;

        // terminals
        this.logCooldown = Math.max(0, (this.logCooldown ?? 0) - dt);
        for (const t of this.terminals) {
            if (this.logCooldown > 0) break;
            const d = Math.hypot(P.x - t.wx, P.z - t.wz);
            if (d < 1.9) {
                prompt = t.read ? 'Read the log again' : 'Read the log';
                if (use) { this._readTerminal(t); return; }
            }
        }
        // exit switch
        const ex = L.exit;
        const exX = ex.x * CELL, exZ = ex.z * CELL;
        const de = Math.hypot(P.x - exX, P.z - exZ);
        if (de < 2.0 && !this.exitDone) {
            prompt = this.exitOpen ? 'Throw the exit switch' : 'Sealed — the guardian still lives';
            const facing = f[0] * -ex.nx + f[2] * -ex.nz > 0.3;
            const pushing = de < 1.25 && facing && input.move.y > 0.3;
            if (use || pushing) {
                if (this.exitOpen) { this._exit(); return; }
                else if (use || this._lockMsgT === undefined || this.time - this._lockMsgT > 2) {
                    this._lockMsgT = this.time;
                    sfx.locked();
                    this.message('The exit is sealed while the guardian lives.', '#ff7a5a');
                }
            }
        }
        // doors in front of us
        const probe = (dist) => W.cellAt(P.x + f[0] * dist, P.z + f[2] * dist);
        const candidates = new Set([probe(0.8), probe(1.4)]);
        if (P.bumped !== null && P.bumped !== undefined && P.bumped >= 0) candidates.add(P.bumped);
        // auto-open: any non-secret door within reach of our body
        for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
            const c = W.cellAt(P.x + dx * 0.9, P.z + dz * 0.9);
            if (c >= 0 && L.door[c] >= 0 && !L.doors[L.door[c]].secret && !L.doors[L.door[c]].key) candidates.add(c);
        }
        for (const c of candidates) {
            if (c < 0 || L.door[c] < 0) continue;
            const d = L.doors[L.door[c]];
            if (d.secret) {
                // secrets: press use, or keep pushing into them
                const pushing = P.bumped === c && input.move.y > 0.3;
                if (pushing) { this._secretPush = (this._secretPush ?? 0) + dt; } else if (!use) continue;
                if (use || this._secretPush > 0.45) { W.openDoor(c, 'player'); this._secretPush = 0; }
                continue;
            }
            if (d.key && !P.keys.has(d.key)) {
                prompt = `Needs the ${d.key} keycard`;
                const bump = P.bumped === c || use;
                if (bump && (this._lockMsgT === undefined || this.time - this._lockMsgT > 1.6)) {
                    this._lockMsgT = this.time;
                    sfx.locked();
                    this.message(`You need the ${d.key.toUpperCase()} keycard to open this door.`, colorOfKey(d.key));
                    this.cb.onKeyHint?.(d.key);
                }
                continue;
            }
            if (d.state === 'closed' || d.state === 'closing' || d.state === 'open') W.openDoor(c, 'player', P.keys);
        }
        if (P.bumped === null || P.bumped < 0 || L.door[P.bumped] < 0) this._secretPush = 0;
        this.usePrompt = prompt;
    }

    _readTerminal(t) {
        sfx.terminal();
        const logs = LOGS[this.spec.id] ?? this.spec.logs ?? [];
        const log = logs[t.log] ?? { from: 'Station log', text: 'The screen shows only static, and under the static, faintly, singing.' };
        if (!t.read) { t.read = true; this.stats.logs = (this.stats.logs ?? 0) + 1; }
        this.cb.onLog?.(log, t);
    }

    _exit() {
        this.exitDone = true;
        sfx.use(); sfx.exit();
        if (this.lever) { this.lever.handle.rotation.x = 0.9; this.lever.light = 2; }
        this.cb.onComplete?.(this);
    }

    /** A lever on the exit panel: red while sealed, green when the way is open. */
    _buildExitLever() {
        const ex = this.L.exit;
        const g = new THREE.Group();
        const plate = new THREE.Mesh(colorBox(0.42, 0.62, 0.06, 0, [0.25, 0.26, 0.28]), actorMaterial({ rim: 0.2 }));
        g.add(plate);
        const lamp = new THREE.Mesh(colorBox(0.3, 0.07, 0.07, 1, [1, 1, 1]), actorMaterial({ unlit: true, rim: 0 }));
        lamp.position.set(0, 0.36, 0.03);
        g.add(lamp);
        const handle = new THREE.Group();
        const bar = new THREE.Mesh(colorBox(0.07, 0.34, 0.07, 0, [0.6, 0.6, 0.62]), actorMaterial({ rim: 0.3 }));
        bar.position.y = 0.17;
        const knob = new THREE.Mesh(colorBox(0.14, 0.09, 0.12, 0.4, [0.9, 0.15, 0.1]), actorMaterial({ rim: 0.3 }));
        knob.position.y = 0.36;
        handle.add(bar, knob);
        handle.position.set(0, -0.12, 0.06);
        handle.rotation.x = -0.6;
        g.add(handle);
        const fx = ex.x * CELL, fz = ex.z * CELL;
        g.position.set(fx - ex.nx * 0.02, ex.floor + 1.15, fz - ex.nz * 0.02);
        g.rotation.y = Math.atan2(ex.nx, ex.nz);
        this.root.add(g);
        this.lever = { g, lamp, handle, light: 0 };
    }

    _updateLever(dt) {
        const lv = this.lever;
        if (!lv) return;
        const col = this.exitOpen ? [0.2, 1, 0.35] : [1, 0.15, 0.1];
        const pulse = this.exitOpen ? 0.75 + 0.25 * Math.sin(this.time * 4) : 0.6;
        lv.lamp.material.uniforms.uTint.value.setRGB(col[0] * pulse, col[1] * pulse, col[2] * pulse);
        if (this.exitDone) lv.handle.rotation.x += (0.9 - lv.handle.rotation.x) * Math.min(1, dt * 12);
        const ex = this.L.exit;
        this.R.light(ex.x * CELL, ex.floor + 1.5, ex.z * CELL, this.exitOpen ? 0x40ff70 : 0xff3020, 4, 0.6 + lv.light, 1);
        lv.light = Math.max(0, lv.light - dt * 2);
    }

    _enterCell(c) {
        const r = this.L.region[c];
        if (r >= 0 && r !== this.currentRoom) {
            this.currentRoom = r;
            if (!this.roomsVisited.has(r)) {
                this.roomsVisited.add(r);
                const room = this.L.rooms[r];
                // exit-room ambush when you first walk in
                if (room.kind === 'exit') this._triggerAmbush(r);
                if (this.boss && room.id === this.L.exitRoom && this.boss.alive) {
                    this.comms(BARKS.bossNear);
                    this.boss.wake(this.player);
                    this.cb.onBoss?.(this.boss);
                }
            }
        }
    }

    _triggerAmbush(roomId) {
        const list = this.ambush.filter((t) => t.room === roomId && !t.done);
        list.forEach((t, k) => {
            t.done = true;
            setTimeout(() => {
                if (!this.world) return;
                this.spawnMonster(t.arch, t.x * CELL, t.z * CELL, { spawning: true, awake: true, elite: t.elite, zone: t.zone, counted: true, fromAmbush: true });
            }, 250 + k * 280);
        });
        if (list.length) { this.message('Ambush!', '#ff5a3a'); sfx.alarm(); }
    }

    // ------------------------------------------------------------------ pickups

    _updatePickups(dt) {
        const P = this.player;
        for (const p of this.pickups) {
            if (p.taken) continue;
            p.phase += dt;
            const g = p.group;
            g.position.y = p.y + 0.45 + Math.sin(p.phase * 2.2) * 0.08;
            if (g.userData.spin) g.userData.mesh.rotation.y += dt * 1.6;
            g.userData.halo.material.uniforms.uIntensity.value = 0.8 + Math.sin(p.phase * 3) * 0.2;
            if (g.userData.big) this.R.light(p.x, p.y + 0.8, p.z, PICKUPS[p.id].color ?? 0xffffff, 3.2, 0.45, 0.3);
            if (!P.alive) continue;
            if (Math.abs(P.x - p.x) < 0.95 && Math.abs(P.z - p.z) < 0.95 && Math.abs(P.y - p.y) < 1.4) this._take(p);
        }
    }

    _take(p) {
        const P = this.player, D = PICKUPS[p.id];
        const amul = (this.diff.ammo ?? 1) >= 1.5 ? 2 : 1;
        let msg = D.name, color = '#d8ffd0', taken = true;
        switch (D.kind) {
            case 'health': {
                const cap = D.cap;
                if (P.health >= cap) { taken = false; break; }
                P.health = Math.min(cap, P.health + D.amount);
                if (p.id === 'soul') { sfx.power(); this.flash(0x55aaff, 0.35); msg = 'Soul Orb! +100 health'; color = '#8fd0ff'; }
                else sfx.health();
                break;
            }
            case 'armor': {
                if (D.set) {
                    if (P.armor >= D.set) { taken = false; break; }
                    P.armor = D.set; P.armorClass = p.id === 'mega' ? 0.5 : 0.34;
                    if (p.id === 'mega') { sfx.power(); this.flash(0x4aa8ff, 0.3); }
                    else sfx.armor();
                } else {
                    if (P.armor >= D.cap) { taken = false; break; }
                    P.armor = Math.min(D.cap, P.armor + D.amount);
                    if (!P.armorClass) P.armorClass = 0.34;
                    sfx.armor();
                }
                break;
            }
            case 'ammo': {
                const a = D.ammo;
                if (P.ammo[a] >= P.maxAmmo[a]) { taken = false; break; }
                P.ammo[a] = Math.min(P.maxAmmo[a], P.ammo[a] + D.amount * amul);
                sfx.ammo();
                color = AMMO[a].color;
                break;
            }
            case 'weapon': {
                const id = D.weapon;
                const isNew = !P.weapons.has(id);
                const [a, n] = WEAPON_AMMO_BONUS[id] ?? ['bullets', 20];
                if (!isNew && P.ammo[a] >= P.maxAmmo[a]) { taken = false; break; }
                P.weapons.add(id);
                P.ammo[a] = Math.min(P.maxAmmo[a], P.ammo[a] + n * (p.dropped ? 0.5 : 1) * amul);
                sfx.weapon();
                if (isNew) {
                    msg = `You got the ${D.name}!`;
                    color = '#ffd36b';
                    this.flash(0xffcc66, 0.25);
                    this.weapons.onPickup(id, true);
                    this.comms(BARKS.weapon + ' ' + WEAPON_BY_ID[id].blurb);
                    this.cb.onNewWeapon?.(id);
                }
                break;
            }
            case 'backpack': {
                if (!P.backpack) {
                    P.backpack = true;
                    for (const k of Object.keys(P.maxAmmo)) P.maxAmmo[k] = AMMO[k].max * 2;
                }
                P.ammo.bullets = Math.min(P.maxAmmo.bullets, P.ammo.bullets + 20);
                P.ammo.shells = Math.min(P.maxAmmo.shells, P.ammo.shells + 8);
                P.ammo.rockets = Math.min(P.maxAmmo.rockets, P.ammo.rockets + 2);
                P.ammo.cells = Math.min(P.maxAmmo.cells, P.ammo.cells + 40);
                sfx.weapon();
                msg = 'Backpack — ammo capacity doubled!';
                break;
            }
            case 'power': {
                P.powers[D.power] = D.time;
                if (D.power === 'berserk') { P.health = Math.max(P.health, 100); this.weapons.select('blade'); this.comms(BARKS.berserk); }
                sfx.power();
                this.flash(D.color, 0.3);
                msg = `${D.name}!`;
                color = POWER_INFO[D.power].color;
                break;
            }
            case 'map': {
                this.revealAll = true;
                sfx.power();
                msg = 'Survey Drone — the whole level is mapped.';
                color = '#ffe66b';
                break;
            }
            case 'key': {
                P.keys.add(D.key);
                sfx.key();
                this.flash(D.color, 0.3);
                msg = `Picked up the ${D.name}.`;
                color = colorOfKey(D.key);
                if (!this._keyBarked) { this._keyBarked = true; this.comms(BARKS.firstKey); }
                const t = this.L.things.find((tt) => tt.type === 'pickup' && tt.id === p.id);
                if (t) this._triggerAmbush(t.room);
                this.cb.onKey?.(D.key);
                break;
            }
        }
        if (!taken) return;
        p.taken = true;
        this.root.remove(p.group);
        if (!p.id.startsWith('key_') && !p.dropped) this.stats.items++;
        if (D.kind !== 'ammo' || Math.random() < 1) this.R.post.uPickup.value = D.kind === 'ammo' ? 0.25 : 0.6;
        this.message(msg, color);
    }

    // ------------------------------------------------------------------ combat: player → world

    canFire() { return !this.paused && !this.exitDone; }

    onPlayerFire(w) {
        this.stats.shots++;
        if (w.kind !== 'melee') this._noiseAt(this.player.x, this.player.z, w.id === 'pistol' ? 10 : 18);
        if (this.player.powers.cloak > 0 && w.kind !== 'melee') this.player.powers.cloak = Math.max(0, this.player.powers.cloak - 1.5);
    }

    /** Auto-aim: DOOM's vertical aim help, plus a little horizontal pull when strong. */
    aimDirection(yaw, pitch, w) {
        const P = this.player;
        let mode = this.settings.autoAim ?? (input.touch ? 2 : 1);
        if (w.kind === 'melee') mode = 0;
        let best = null, bestA = mode === 2 ? 0.14 : 0.07;
        if (mode > 0) {
            const eye = P.eyePos();
            for (const m of this.monsters) {
                if (!m.alive || m.state === 'spawning') continue;
                const dx = m.x - P.x, dz = m.z - P.z;
                const d = Math.hypot(dx, dz);
                if (d > 60 || d < 0.5) continue;
                const myaw = Math.atan2(dx, -dz);
                let da = myaw - yaw;
                while (da > Math.PI) da -= Math.PI * 2;
                while (da < -Math.PI) da += Math.PI * 2;
                const tol = bestA + Math.atan2(m.r, d);
                if (Math.abs(da) > tol) continue;
                const mpitch = Math.atan2(m.cy - eye[1], d);
                if (Math.abs(mpitch - pitch) > 0.5) continue;
                if (!this.world.los(eye[0], eye[1], eye[2], m.x, m.cy, m.z)) continue;
                const score = Math.abs(da) + d * 0.002;
                if (!best || score < best.score) best = { m, da, mpitch, score };
            }
        }
        let ay = yaw, ap = pitch;
        if (best) {
            ap = best.mpitch;
            if (mode === 2) ay = yaw + best.da * 0.6;
        }
        const dir = [Math.sin(ay) * Math.cos(ap), Math.sin(ap), -Math.cos(ay) * Math.cos(ap)];
        return { yaw: ay, pitch: ap, dir, target: best?.m ?? null };
    }

    /** First body or wall along a ray. Returns {t, x,y,z, body|null, hit (world hit)} */
    traceBodies(o, d, maxT, exclude) {
        const hit = this.world.raycast(o[0], o[1], o[2], d[0], d[1], d[2], maxT);
        let bestT = hit.t, body = null;
        const test = (b, r, y0, y1) => {
            const t = rayBox(o, d, b.x - r, y0, b.z - r, b.x + r, y1, b.z + r);
            if (t !== null && t < bestT) { bestT = t; body = b; }
        };
        for (const m of this.monsters) {
            if (!m.alive || m === exclude || m.state === 'spawning') continue;
            test(m, m.r, m.y, m.y + m.h);
        }
        for (const b of this.barrels) if (!b.dead) test(b, 0.4, b.y, b.y + 1.1);
        return { t: bestT, x: o[0] + d[0] * bestT, y: o[1] + d[1] * bestT, z: o[2] + d[2] * bestT, body, hit };
    }

    playerHitscan(eye, dir, range, dmg, showFx = true) {
        const r = this.traceBodies(eye, dir, range, null);
        if (r.body) {
            if (showFx) {
                if (r.body.isBarrel) this.fx.sparks(r.x, r.y, r.z, -dir[0], -dir[1], -dir[2], 4);
                else {
                    this.fx.blood(r.x, r.y, r.z, r.body.A.blood, 4, dir);
                    if (Math.random() < 0.5) sfx.flesh({ x: r.x, y: r.y, z: r.z });
                    // spatter on the wall behind
                    if (Math.random() < 0.35) {
                        const back = this.world.raycast(r.x, r.y, r.z, dir[0], dir[1] - 0.15, dir[2], 3.5);
                        if (back.what === 'wall' || back.what === 'floor') {
                            const c = r.body.A.blood;
                            this.fx.decals.add(back.x, back.y, back.z, back.nx, back.ny, back.nz, 2, 0.5 + Math.random() * 0.6, [((c >> 16) & 255) / 400, ((c >> 8) & 255) / 400, (c & 255) / 400]);
                        }
                    }
                }
            }
            this.cb.onHitMarker?.(r.body.isBarrel ? 0.5 : 1);
        } else if (showFx && r.hit.what !== 'none') {
            this.fx.impact(r.hit, 'bullet');
            if (Math.random() < 0.3) sfx.ricochet({ x: r.x, y: r.y, z: r.z });
        }
        return r;
    }

    applyHit(body, dmg, opts) {
        if (body.isBarrel) this.damageBarrel(body, dmg, this.player);
        else this.damageMonster(body, dmg, this.player, opts);
    }

    crosshairPoint(eye, dir) {
        const r = this.traceBodies(eye, dir, 120, null);
        return [r.x, r.y, r.z];
    }

    playerRail(eye, muzzle, dir, dmg) {
        const hit = this.world.raycast(eye[0], eye[1], eye[2], dir[0], dir[1], dir[2], 200);
        const hits = [];
        for (const m of this.monsters) {
            if (!m.alive || m.state === 'spawning') continue;
            const t = rayBox(eye, dir, m.x - m.r, m.y, m.z - m.r, m.x + m.r, m.y + m.h, m.z + m.r);
            if (t !== null && t < hit.t) hits.push([t, m]);
        }
        for (const b of this.barrels) {
            if (b.dead) continue;
            const t = rayBox(eye, dir, b.x - 0.4, b.y, b.z - 0.4, b.x + 0.4, b.y + 1.1, b.z + 0.4);
            if (t !== null && t < hit.t) hits.push([t, b]);
        }
        hits.sort((a, b) => a[0] - b[0]);
        for (const [t, b] of hits) {
            const px = eye[0] + dir[0] * t, py = eye[1] + dir[1] * t, pz = eye[2] + dir[2] * t;
            if (b.isBarrel) this.damageBarrel(b, dmg, this.player);
            else { this.fx.blood(px, py, pz, b.A.blood, 10, dir); this.damageMonster(b, dmg, this.player, { dir, kind: 'rail' }); }
        }
        if (hits.length) this.cb.onHitMarker?.(1);
        this.fx.rail(muzzle, [hit.x, hit.y, hit.z]);
        if (hit.what !== 'sky') { this.fx.impact(hit, 'plasma'); this.fx.plasmaBurst(hit.x, hit.y, hit.z, 0x9a6aff); }
        this.R.post.uAberration.value = 0.6;
    }

    playerMelee(w, mul) {
        const P = this.player;
        const f = P.forward();
        let best = null, bd = Infinity;
        for (const m of this.monsters) {
            if (!m.alive || m.state === 'spawning') continue;
            const dx = m.x - P.x, dz = m.z - P.z;
            const d = Math.hypot(dx, dz) - m.r;
            if (d > w.range) continue;
            const dot = (dx * f[0] + dz * f[2]) / (Math.hypot(dx, dz) || 1);
            if (dot < 0.55) continue;
            if (m.y > P.eyeY + 0.5 || m.y + m.h < P.y) continue;
            if (d < bd) { bd = d; best = m; }
        }
        let barrel = null;
        for (const b of this.barrels) {
            if (b.dead) continue;
            const dx = b.x - P.x, dz = b.z - P.z, d = Math.hypot(dx, dz);
            if (d < w.range + 0.4 && (dx * f[0] + dz * f[2]) / (d || 1) > 0.6 && d < bd) { barrel = b; bd = d; }
        }
        if (barrel) { this.damageBarrel(barrel, 30 * mul, P); sfx.blade(true); return; }
        if (!best) { sfx.blade(false); return; }
        sfx.blade(true);
        const dir = [f[0], 0, f[2]];
        if (best.state === 'stagger') {
            // execution
            this.fx.blood(best.x, best.cy, best.z, best.A.blood, 24, dir);
            this.R.post.uAberration.value = 0.8;
            this.fx.shake = Math.max(this.fx.shake, 0.4);
            best.hp = -best.maxHp;
            best.die(best.maxHp, P, { kind: 'execute', splash: true });
            const heal = Math.round(rnd(15, 25));
            P.health = Math.min(Math.max(100, P.health), P.health + heal);
            this.message(`Execution! +${heal} health`, '#7dff8a');
            for (let k = 0; k < 14; k++) this.fx.add.spawn(best.x + rnd(-0.5, 0.5), best.cy + rnd(-0.5, 0.5), best.z + rnd(-0.5, 0.5), (P.x - best.x) * 2 + rnd(-2, 2), rnd(1, 3), (P.z - best.z) * 2 + rnd(-2, 2), 0.5, 0.25, 0.05, [0.4, 1, 0.5, 1], [0.2, 1, 0.4, 0], 0, 1);
            this.cb.onHitMarker?.(2);
            return;
        }
        this.fx.blood(best.x, best.cy, best.z, best.A.blood, 10, dir);
        this.damageMonster(best, rnd(...w.dmg) * mul, P, { dir, kind: 'melee', knock: mul > 4 ? 3 : 1 });
        this.cb.onHitMarker?.(1);
    }

    spawnProjectile(type, x, y, z, dir, speed, dmg, owner, opts) {
        return this.proj.spawn(type, x, y, z, dir, speed, dmg, owner, opts);
    }

    monsterHitscan(m, muzzle, dir, range, dmg) {
        const r = this.traceBodies([muzzle.x, muzzle.y, muzzle.z], dir, range, m);
        // the player
        const P = this.player;
        const tp = rayBox([muzzle.x, muzzle.y, muzzle.z], dir, P.x - P.r, P.y, P.z - P.r, P.x + P.r, P.y + P.h, P.z + P.r);
        this.fx.tracer([muzzle.x, muzzle.y, muzzle.z], tp !== null && tp < r.t ? [muzzle.x + dir[0] * tp, muzzle.y + dir[1] * tp, muzzle.z + dir[2] * tp] : [r.x, r.y, r.z], 0xffc070);
        this.fx.muzzle(muzzle.x, muzzle.y, muzzle.z, 0xffc070, 0.4);
        if (tp !== null && tp < r.t) { this.damagePlayer(dmg, m, dir); return; }
        if (r.body) {
            if (r.body.isBarrel) this.damageBarrel(r.body, dmg, m);
            else this.damageMonster(r.body, dmg, m, { dir });
        } else if (r.hit.what !== 'none') this.fx.impact(r.hit, 'bullet');
    }

    // ------------------------------------------------------------------ damage

    damageMonster(m, dmg, source, opts = {}) {
        if (!m.alive) return 0;
        const dealt = m.damage(dmg, source, opts);
        return dealt;
    }

    damagePlayer(amount, source, dir, ignoreArmor = false) {
        const P = this.player;
        if (!P.alive || amount <= 0) return 0;
        if (P.powers.invuln > 0 || this.settings.god) { if (P.powers.invuln > 0) { this.R.post.uFlash.value = Math.max(this.R.post.uFlash.value, 0.03); this.R.post.uFlashColor.value.set(0x99ff55); } return 0; }
        let hp = amount;
        if (!ignoreArmor && P.armor > 0) {
            const absorb = Math.min(P.armor, Math.round(amount * P.armorClass));
            P.armor -= absorb; hp -= absorb;
            if (P.armor <= 0) P.armorClass = 0;
        }
        hp = Math.round(hp);
        P.health -= hp;
        this.stats.damageTaken += hp;
        const post = this.R.post;
        post.uDamage.value = Math.min(1, post.uDamage.value + 0.25 + amount / 60);
        post.uAberration.value = Math.min(1, post.uAberration.value + amount / 50);
        this.fx.shake = Math.max(this.fx.shake, Math.min(0.6, amount / 40));
        P.hurtRoll = (Math.random() - 0.5) * Math.min(1, amount / 20);
        if (source && source.x !== undefined) this.cb.onHurtFrom?.(source.x, source.z, amount);
        else if (dir) this.cb.onHurtFrom?.(P.x - dir[0] * 5, P.z - dir[2] * 5, amount);
        if (dir && source !== 'liquid') { P.vx += dir[0] * Math.min(6, amount / 6); P.vz += dir[2] * Math.min(6, amount / 6); }
        this.cb.onHurt?.(amount);
        if (P.health <= 0) {
            P.health = 0; P.alive = false; P.deathT = 0;
            sfx.death();
            this.message('You died.', '#ff4a3a');
            this.weapons.charging = false;
        } else {
            if (this._hurtSndT === undefined || this.time - this._hurtSndT > 0.35) { this._hurtSndT = this.time; sfx.hurt(amount); }
            if (P.health < 30 && !this.lowHealthBarked) { this.lowHealthBarked = true; this.comms(BARKS.lowHealth); }
        }
        return hp;
    }

    radiusDamage(x, y, z, radius, dmg, source, opts = {}) {
        const P = this.player;
        const apply = (b, bx, by0, by1, bz, br) => {
            // distance from blast to the body's box
            const cx = Math.max(bx - br, Math.min(x, bx + br)), cy = Math.max(by0, Math.min(y, by1)), cz = Math.max(bz - br, Math.min(z, bz + br));
            const d = Math.hypot(cx - x, cy - y, cz - z);
            if (d >= radius) return 0;
            if (!this.world.los(x, y, z, bx, (by0 + by1) / 2, bz) && !this.world.los(x, y + 0.5, z, bx, by1 - 0.1, bz)) return 0;
            return dmg * (1 - d / radius);
        };
        for (const m of this.monsters) {
            if (!m.alive || m === opts.exclude) continue;
            if (opts.noSelf && m === source) continue;
            if (m.boss && source === m) continue;
            const a = apply(m, m.x, m.y, m.y + m.h, m.z, m.r);
            if (a > 0) {
                const dx = m.x - x, dz = m.z - z, l = Math.hypot(dx, dz) || 1;
                this.damageMonster(m, a, source, { dir: [dx / l, 0, dz / l], splash: true, knock: 2 });
            }
        }
        if (P.alive && opts.exclude !== P && !(opts.noSelf && source === P)) {
            let a = apply(P, P.x, P.y, P.y + P.h, P.z, P.r);
            if (source === P) a *= 0.5;
            if (a > 0) {
                const dx = P.x - x, dz = P.z - z, l = Math.hypot(dx, dz) || 1;
                this.damagePlayer(a, source, [dx / l, 0, dz / l]);
                const k = (opts.knock ?? 5) * (a / dmg);
                P.vx += (dx / l) * k * 2; P.vz += (dz / l) * k * 2;
                P.vy += (opts.up ?? (source === P ? 6 : 2)) * (a / dmg);
                P.grounded = false;
            }
        }
        for (const b of this.barrels) {
            if (b.dead || b === opts.exclude) continue;
            const a = apply(b, b.x, b.y, b.y + 1.1, b.z, 0.4);
            if (a > 0) this.damageBarrel(b, a, source);
        }
    }

    damageBarrel(b, dmg, source) {
        if (b.dead) return;
        b.hp -= dmg;
        if (b.hp > 0) return;
        b.dead = true;
        b.alive = false;
        setTimeout(() => {
            if (!this.world) return;
            this.root.remove(b.mesh);
            this.fx.explosion(b.x, b.y + 0.6, b.z, 1.1, 0xff9a3a);
            this.fx.decals.add(b.x, b.y + 0.01, b.z, 0, 1, 0, 1, 2.6);
            sfx.barrel({ x: b.x, y: b.y + 0.6, z: b.z });
            this.radiusDamage(b.x, b.y + 0.6, b.z, 4.6, 115, source, { knock: 7 });
            for (let k = 0; k < 6; k++) this.fx.debris.add(b.x, b.y + 0.6, b.z, rnd(-6, 6), rnd(4, 9), rnd(-6, 6), rnd(0.1, 0.25), [0.3, 0.3, 0.3], 5);
            this._noiseAt(b.x, b.z, 16);
        }, 90 + Math.random() * 90);
    }

    singularityBoom(p) {
        const P = this.player;
        const od = P.powers.overdrive > 0 ? 3 : 1;
        this.fx.explosion(p.x, p.y, p.z, 2.6, 0x9a6aff);
        this.fx.flashes.add(p.x, p.y, p.z, 0x000000, 0.2, 9, 0.6, 0xb080ff, 2);
        this.fx.flashes.ring(p.x, this.L.floor[this.world.cellAt(p.x, p.z)] ?? p.y - 1, p.z, 0xb080ff, 10, 0.8);
        for (let k = 0; k < 80 * this.fx.budget; k++) {
            const a = rnd(0, Math.PI * 2), b = rnd(-1, 1), r = rnd(4, 9);
            const s = Math.sqrt(1 - b * b);
            const sx = p.x + Math.cos(a) * s * r, sy = p.y + b * r, sz = p.z + Math.sin(a) * s * r;
            this.fx.add.spawn(sx, sy, sz, (p.x - sx) * 2.5, (p.y - sy) * 2.5, (p.z - sz) * 2.5, 0.4, 0.3, 0.05, [0.7, 0.4, 1, 1], [1, 1, 1, 0], 0, 0);
        }
        sfx.bfgBoom({ x: p.x, y: p.y, z: p.z });
        this.flash(0xb080ff, 0.5);
        this.R.post.uAberration.value = 1;
        for (const m of this.monsters) {
            if (!m.alive) continue;
            const d = Math.hypot(m.x - p.x, m.cy - p.y, m.z - p.z);
            if (d > 9) continue;
            const dmg = rnd(500, 600) * od * (1 - d / 12);
            const l = d || 1;
            this.damageMonster(m, dmg, P, { dir: [(m.x - p.x) / l, 0, (m.z - p.z) / l], splash: true, kind: 'bfg' });
        }
        for (const b of this.barrels) if (!b.dead && Math.hypot(b.x - p.x, b.z - p.z) < 9) this.damageBarrel(b, 200, P);
        const pd = Math.hypot(P.x - p.x, P.z - p.z);
        if (pd < 4) this.damagePlayer(30 * (1 - pd / 4), P, null);
        this._noiseAt(p.x, p.z, 30);
    }

    shockwave(x, floorY, z, range, dmg, source) {
        this.shockwaves.push({ x, y: floorY, z, r: 0.5, range, dmg, source, hit: false });
    }

    _updateShockwaves(dt) {
        const P = this.player;
        for (const s of this.shockwaves) {
            s.r += dt * 11;
            const n = Math.round(10 * this.fx.budget);
            for (let k = 0; k < n; k++) {
                const a = rnd(0, Math.PI * 2);
                this.fx.add.spawn(s.x + Math.cos(a) * s.r, s.y + 0.15, s.z + Math.sin(a) * s.r, 0, rnd(1, 3), 0, 0.35, 0.5, 0.1, [1, 0.6, 0.2, 1], [1, 0.1, 0, 0], 0, 1);
            }
            const pd = Math.hypot(P.x - s.x, P.z - s.z);
            if (!s.hit && Math.abs(pd - s.r) < 0.8 && P.y - s.y < 0.45) {
                s.hit = true;
                this.damagePlayer(s.dmg, s.source, [(P.x - s.x) / (pd || 1), 0, (P.z - s.z) / (pd || 1)]);
                P.vy = 5;
            }
        }
        this.shockwaves = this.shockwaves.filter((s) => s.r < s.range);
    }

    archonShield(boss) {
        boss.shielded = true;
        boss.pylons = [];
        const L = this.L;
        const room = L.rooms[L.exitRoom];
        const cx = (room.x + room.w / 2) * CELL, cz = (room.y + room.h / 2) * CELL;
        const rad = Math.min(room.w, room.h) * CELL * 0.36;
        for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + boss.phase * 0.4;
            let x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
            let c = this.world.cellAt(x, z);
            for (let t = 0; t < 8 && (!L.open[c] || L.liquid[c] || L.kind[c] === 1); t++) { x = cx + Math.cos(a) * rad * (0.9 - t * 0.1); z = cz + Math.sin(a) * rad * (0.9 - t * 0.1); c = this.world.cellAt(x, z); }
            const p = this.spawnMonster('pylon', x, z, { spawning: true, counted: false });
            boss.pylons.push(p);
            this.fx.beams.add([boss.x, boss.cy, boss.z], [x, (L.floor[c] ?? 0) + 2, z], 0xb080ff, 0.2, 1.2, 8);
        }
        if (!boss.shieldMesh) {
            boss.shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(boss.h * 0.55, 2), new THREE.ShaderMaterial({
                uniforms: { uTime: G.uTime },
                vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }',
                fragmentShader: 'uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0-abs(dot(vN,vV)),2.0); float hex = step(0.9, fract(vP.y*3.0+uTime*0.5)) + step(0.92, fract((vP.x+vP.z)*2.5-uTime*0.3)); gl_FragColor = vec4(vec3(0.7,0.5,1.0)*(f*1.4+hex*0.4), 1.0); }',
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
            }));
            this.root.add(boss.shieldMesh);
        }
        boss.shieldMesh.visible = true;
        this.message('The Archon draws on the Engine — destroy the pylons!', '#c9a0ff');
        this.comms('It\'s pulling power from the pylons, Warden. Break them and its shield breaks with them.');
        sfx.alarm();
    }

    // ------------------------------------------------------------------ kills

    onKill(m, source) {
        if (m.counted) this.stats.kills++;
        if (DROPS[m.arch] && m.counted) this._addPickup(DROPS[m.arch], m.x, m.z, { dropped: true });
        if (m.boss) {
            this.exitOpen = true;
            this.message(`${m.sp.name} is destroyed!`, '#ffd36b');
            this.comms(BARKS.exitOpen);
            this.flash(0xffffff, 0.5);
            sfx.explosion({ x: m.x, y: m.cy, z: m.z }, 2);
            for (let k = 0; k < 6; k++) setTimeout(() => { if (this.world) this.fx.explosion(m.x + rnd(-1.5, 1.5), m.cy + rnd(-1, 1.5), m.z + rnd(-1.5, 1.5), 1.2, 0xffaa55); }, k * 280);
            for (const o of this.monsters) if (o.alive && !o.counted) o.die(999, null, {});
            this.cb.onBossDead?.(m);
        }
        if (m.counted && this.stats.kills >= this.stats.monsters && this.stats.monsters > 0 && !this._allKillsBarked && this.ambush.every((t) => t.done)) {
            this._allKillsBarked = true;
            this.comms(BARKS.allKills);
        }
        this.cb.onKill?.(m, source);
    }

    onSight(m) {
        const sp = m.sp;
        if (!this.seenSpecies.has(sp.arch) && !m.static) {
            this.seenSpecies.add(sp.arch);
            if (!m.boss) this.comms(BARKS.newSpecies(sp.name, sp.cls));
            this.cb.onNewSpecies?.(sp);
        }
    }

    // ------------------------------------------------------------------ noise / ambience / map

    _noiseAt(x, z, radius) { this._noiseCell(this.world.cellAt(x, z), radius); }
    _noiseCell(c, radius) {
        if (c < 0) return;
        const reach = this.world.soundReach(c, radius);
        for (const m of this.monsters) {
            if (m.awake || !m.alive || m.static) continue;
            const mc = this.world.cellAt(m.x, m.z);
            if (reach.has(mc)) m.wake(this.player);
        }
    }

    _occupied(cell) {
        const W = this.world;
        const P = this.player;
        const near = (x, z, r) => { const cx = cell % W.W, cz = (cell / W.W) | 0; return x + r > cx * CELL && x - r < (cx + 1) * CELL && z + r > cz * CELL && z - r < (cz + 1) * CELL; };
        if (near(P.x, P.z, P.r)) return true;
        for (const m of this.monsters) if (m.alive && near(m.x, m.z, m.r)) return true;
        return false;
    }

    _updateBarrels() { /* static until shot */ }

    _ambient(dt) {
        const P = this.player;
        for (const e of this.emitters) {
            const d = Math.hypot(e.x - P.x, e.z - P.z);
            if (d > 30) continue;
            if (e.kind === 'fire' && Math.random() < 0.6) this.fx.fire(e.x, e.y, e.z, e.scale);
            if (e.kind === 'candle' && Math.random() < 0.15) this.fx.add.spawn(e.x + rnd(-0.25, 0.25), e.y, e.z + rnd(-0.25, 0.25), 0, 0.5, 0, 0.4, 0.1, 0.02, [1, 0.7, 0.3, 1], [1, 0.2, 0, 0], -0.5, 0);
        }
        // liquids bubble near you
        if (Math.random() < dt * 14) {
            const a = rnd(0, Math.PI * 2), r = rnd(1, 12);
            const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
            const c = this.world.cellAt(x, z);
            if (c >= 0 && this.L.liquid[c]) {
                const ll = this.theme.liquidLight;
                const lava = this.L.theme === 'foundry';
                this.fx.add.spawn(x, this.L.floor[c] + 0.05, z, rnd(-0.2, 0.2), lava ? rnd(1.5, 4) : rnd(0.3, 0.8), rnd(-0.2, 0.2), rnd(0.4, 1.0), lava ? 0.12 : 0.2, 0.02, [ll[0], ll[1], ll[2], 1], [ll[0], ll[1] * 0.4, 0, 0], lava ? 4 : 0, 0.5);
            }
        }
        // halos flicker with their lights
        for (const h of this.built.halos) {
            if (!h.userData.flicker) continue;
            const ph = h.userData.phase;
            h.userData.base0 ??= h.material.uniforms.uIntensity.value;
            h.material.uniforms.uIntensity.value = h.userData.base0 * (0.6 + 0.4 * Math.sin(this.time * 9 + ph * 7) * Math.sin(this.time * 23 + ph * 3));
        }
        // hell skies throw lightning
        if (this.L.theme === 'hell' || this.L.theme === 'throne') {
            const sky = this.sky.material.uniforms.uFlash;
            sky.value = Math.max(0, sky.value - dt * 3);
            if (Math.random() < dt * 0.12) { sky.value = 1; if (this.L.sky[this.world.cellAt(P.x, P.z)]) this.R.post.uFlash.value = 0.08; }
        }
    }

    _updateSeen(dt) {
        this.seenT -= dt;
        if (this.seenT > 0) return;
        this.seenT = 0.2;
        const P = this.player, W = this.world;
        const eye = P.eyeY;
        for (let k = 0; k < 48; k++) {
            const a = (k / 48) * Math.PI * 2;
            const dx = Math.sin(a), dz = -Math.cos(a);
            const h = W.raycast(P.x, eye, P.z, dx, 0, dz, 40);
            const steps = Math.ceil(h.t / 0.9);
            for (let s = 0; s <= steps; s++) {
                const t = Math.min(h.t, s * 0.9);
                const c = W.cellAt(P.x + dx * t, P.z + dz * t);
                if (c >= 0) this.seen[c] = 1;
            }
            const c2 = W.cellAt(h.x + dx * 0.2, h.z + dz * 0.2);
            if (c2 >= 0) this.seen[c2] = 1;
        }
    }

    // ------------------------------------------------------------------ helpers for UI

    ambientAt(x, z) {
        const s = this.lm.sample(x, z);
        const a = this.theme.ambient;
        return [s[0] + a[0], s[1] + a[1], s[2] + a[2]];
    }

    message(text, color = '#ffffff') { this.cb.onMessage?.(text, color); }
    comms(text) { this.cb.onComms?.(text); }
    flash(color, amount) { this.R.post.uFlashColor.value.set(color); this.R.post.uFlash.value = Math.max(this.R.post.uFlash.value, amount); }
}

// ------------------------------------------------------------------ utilities

let _consumeFn = null;
let _clearFn = null;
export function bindInputFns(consumeLook, clearPressed) { _consumeFn = consumeLook; _clearFn = clearPressed; }
function consume() { return _consumeFn ? _consumeFn() : { x: 0, y: 0 }; }
function clearInputs() { _clearFn?.(); }

function colorOfKey(k) { return { blue: '#5aa8ff', yellow: '#ffd23a', red: '#ff4a4a' }[k]; }

/** Ray vs axis-aligned box; returns entry t or null. */
export function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
    let tmin = 0, tmax = Infinity;
    const lo = [x0, y0, z0], hi = [x1, y1, z1];
    for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) return null; continue; }
        let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
    }
    return tmin;
}
export { K_DOOR, KEY_ORDER, ARCHETYPES, voice };
