/**
 * world.js — the World: time, weather, the current cell, every live actor, projectiles, items,
 * containers and the event queue.
 *
 * Pure simulation. main.js calls tick(dt, input) at a fixed step and drains `events` once a frame
 * for the view, audio and UI.
 */
import { getTerrain } from './terrain.js';
import { Colliders } from './colliders.js';
import { ExteriorSpace, moveBody } from './physics.js';
import { Weather } from './weather.js';
import { Rng, hashStr } from './rng.js';
import { regionAt, LOC, LOCATIONS } from './geography.js';
import { makeFlora, addFloraColliders } from './flora.js';
import { Settlements } from './settlements.js';
import { baseActor, createActor, recalc, tickEffects, applyDamage, dropLoot, addEffect, heal } from './actor.js';
import { makeSheet, addSkillXp, KIN } from './stats.js';
import { makeStorm, absorbEmber, learnRing, SIGILS, RINGS } from './magic.js';
import { Interiors } from './interiors.js';
import { addItem, equip, removeItem, weaponIn } from './inventory.js';
import { ITEMS, itemDef, ESSENCE_IDS } from './items.js';
import { startAttack, startBash, startDraw, releaseArrow, startCast, releaseCast, startSigil, releaseSigil, updateAct, updateProjectiles, aimDir, eye } from './combat.js';
import { think, steer, hostile, canSee } from './ai.js';
import { fineFor, townOf } from './crafting.js';
import { updateDragon, updateDeadDragon } from './dragon.js';
import { Population } from './population.js';
import { rollLoot } from './loot.js';
import { Quests } from './quests.js';

export const SPEED = { walk: 2.3, run: 4.9, sprint: 7.4, sneak: 1.9, sneakRun: 2.7, swim: 2.5, swimFast: 3.6, encumbered: 1.6 };
export const TIMESCALE = 20;   // game seconds per real second

export function createPlayer(opts = {}) {
    const p = baseActor('player');
    Object.assign(p, {
        id: 'player', name: opts.name || 'Stranger', faction: 'player', r: 0.36, h: 1.78,
        camYaw: 0, camPitch: 0, third: !!opts.third, stepDist: 0, drawn: false,
        sheet: makeSheet(opts.kin || 'norrhen'), storm: makeStorm(),
        look: opts.look || { sex: 'm', kin: opts.kin || 'norrhen', hair: 1, hairCol: 0x5a3a20, beard: 1, age: 0.3 },
        spells: ['flames', 'healing'], hands: { right: null, left: null }, favorites: [], bounty: {}, detectMax: 0, attackHold: -1, gold: 0,
    });
    p.baseHp = p.baseMp = p.baseSp = 100;
    for (const id of opts.items || ['roadworn', 'shoes']) addItem(p, { id });
    equip(p, p.inv.find((e) => e.id === 'roadworn'));
    equip(p, p.inv.find((e) => e.id === 'shoes'));
    recalc(p);
    p.hp = p.hpMax; p.mp = p.mpMax; p.sp = p.spMax;
    return p;
}

// deferred calls (run at the end of a tick, so nothing mutates the actor list mid-loop)
const deferred = [];
const later = (fn) => deferred.push(fn);

export class World {
    constructor(opts = {}) {
        this.terrain = opts.terrain || getTerrain();
        this.colliders = new Colliders();
        this.ext = new ExteriorSpace(this.terrain, this.colliders);
        this.space = this.ext;
        this.cellId = 'ext';
        this.settlements = new Settlements(this.terrain, this.colliders);
        const keepOut = LOCATIONS.map((l) => ({ x: l.x, z: l.z, r: (l.flat || 30) + 6 }));
        for (const b of this.settlements.buildings) keepOut.push({ x: b.x, z: b.z, r: Math.hypot(b.w, b.d) / 2 + 2 });
        for (const pr of this.settlements.props) keepOut.push({ x: pr.x, z: pr.z, r: 3 });
        this.flora = makeFlora(this.terrain, keepOut);
        addFloraColliders(this.flora, this.colliders);
        this.rng = new Rng(opts.seed ?? 12345);
        this.time = { hour: 8.5, day: 0, total: 8.5 };
        this.weather = new Weather(this.rng.fork(3));
        this.events = [];
        this.player = createPlayer(opts.player);
        this.actors = [this.player];
        this.index = new Map([[this.player.id, this.player]]);
        this.projectiles = [];
        this.runes = [];
        this.items = [];             // loose items: { uid, entry, pos, cell, owner }
        this.containers = new Map(); // id → { inv, locked, owner, kind }
        this.harvested = {};         // plant index → game hour harvested
        this.flags = {};
        this.region = 'pinewood';
        this.difficulty = opts.difficulty || 'normal';
        this.godMode = false;
        this.slowTime = 0; this.slowScale = 1;
        this.timeScale = 1;
        this.pop = new Population(this);
        this.focus = null;
        this.uid = 1;
        this.interiors = new Interiors(this);
        this.extReturn = null;       // the exterior door we came in through
        this.onDamaged = null; this.onKill = null; this.onCrime = null;
        this.alchemyKnown = {};
        this.stats = { kills: 0, dragons: 0, embers: 0, locations: 0, potions: 0, crafted: 0, stolen: 0, days: 0 };
        this.discovered = new Set();
        this.cleared = new Set();
        this.quests = new Quests(this);
    }

    // ---------------------------------------------------------------- events & lookups
    emit(type, data = {}) {
        data.type = type;
        this.events.push(data);
        if (this.quests) this.quests.queue.push(data);
        if (this.events.length > 800) this.events.splice(0, this.events.length - 800);
        return data;
    }
    drain() { const e = this.events; this.events = []; return e; }
    byId(id) { return id ? this.index.get(id) || null : null; }
    hostile(a, b) { return hostile(a, b); }
    interiorSpot(n, a) { return this.interiors ? this.interiors.spot(n, a) : null; }

    addActor(a) {
        if (this.actors.includes(a)) return a;
        this.actors.push(a);
        this.index.set(a.id, a);
        a.cell = this.cellId;
        this.emit('actorAdded', { actor: a });
        return a;
    }
    removeActor(a) {
        const i = this.actors.indexOf(a);
        if (i >= 0) this.actors.splice(i, 1);
        if (a !== this.player) this.index.delete(a.id);
        this.emit('actorRemoved', { actor: a });
    }
    despawn(a) { later(() => this.removeActor(a)); }

    spawn(tpl, x, z, opts = {}) {
        const a = createActor(tpl, { rng: this.rng, level: opts.level ?? this.player.sheet.level, ...opts });
        a.pos.x = x; a.pos.z = z; a.pos.y = this.space.ground(x, z, opts.y ?? 1e4);
        a.ai.home = { x, z };
        return this.addActor(a);
    }

    placePlayer(x, z, yaw = 0, y = null) {
        const p = this.player;
        p.pos.x = x; p.pos.z = z;
        p.pos.y = this.space.ground(x, z, y ?? 1e4);
        p.vel.x = p.vel.y = p.vel.z = 0;
        p.yaw = p.camYaw = yaw;
        p.onGround = true;
        p.fallStart = null;
    }
    placeAt(locId, dx = 0, dz = 0) { const l = LOC[locId]; this.placePlayer(l.x + dx, l.z + dz, 0); }

    hourAdvance(hours) {
        this.time.total += hours;
        this.time.hour = ((this.time.hour + hours) % 24 + 24) % 24;
        this.time.day = Math.floor(this.time.total / 24);
        this.stats.days = this.time.day;
    }

    // ---------------------------------------------------------------- skills
    skillUse(a, skill, amount) {
        if (!a.sheet) return;
        for (const ev of addSkillXp(a.sheet, skill, amount)) {
            if (ev.kind === 'skill') this.emit('skillUp', { skill: ev.skill, level: ev.level });
            if (ev.kind === 'level') this.emit('levelUp', { level: ev.level });
        }
    }

    // ---------------------------------------------------------------- light at a spot (for sneaking)
    lightAt(pos) {
        let l;
        if (this.cellId === 'ext') {
            const h = this.time.hour;
            const day = h > 6 && h < 19 ? 1 : h > 5 && h < 21 ? 0.65 : 0.3;
            l = day * (1 - this.weather.cur.cover * 0.25);
            for (const L of this.settlements.lights) {
                if (Math.abs(L.x - pos.x) > 12 || Math.abs(L.z - pos.z) > 12) continue;
                const d = Math.hypot(L.x - pos.x, L.z - pos.z);
                if (d < 12 && this.time.hour > 17 || d < 12 && this.time.hour < 7) l = Math.max(l, 1 - d / 12);
            }
        } else l = this.space.lightAt ? this.space.lightAt(pos) : 0.5;
        const p = this.player;
        if (p.effects.some((e) => e.id === 'light') || p.equip.left?.id === 'torch') l = Math.max(l, 0.9);
        return Math.max(0.15, Math.min(1, l));
    }

    // ---------------------------------------------------------------- the main step
    tick(dt, input) {
        this.slowTime = Math.max(0, this.slowTime - dt);
        const scale = this.slowTime > 0 ? this.slowScale : 1;
        const sdt = dt * scale;
        const dh = sdt * TIMESCALE / 3600 * this.timeScale;
        const prevHour = this.time.hour;
        this.hourAdvance(dh);
        if (Math.floor(prevHour) !== Math.floor(this.time.hour)) this.emit('hour', { hour: Math.floor(this.time.hour) });
        if (this.cellId === 'ext') this.region = regionAt(this.player.pos.x, this.player.pos.z);
        this.weather.update(dh, sdt, this.region, this.events);
        const p = this.player;
        if (p.sheet.rested > 0) p.sheet.rested = Math.max(0, p.sheet.rested - dh);
        if (p.boundEntry && this.time.total > p.boundUntil) { removeItem(p, p.boundEntry, 1); p.boundEntry = null; this.emit('note', { text: 'The spectral weapon fades.' }); }
        if (!p.dead && input) this.controlPlayer(dt, input);
        if (!p.dead) { updateAct(this, p, dt); tickEffects(this, p, dt); }
        if (this.cellId !== 'ext') this.interiors.tick(sdt);
        for (const a of this.actors) {
            if (a === p || a.cell !== this.cellId) continue;
            if (a.rig === 'dragon') {
                if (a.dead) updateDeadDragon(this, a, sdt);
                else { updateDragon(this, a, sdt); tickEffects(this, a, sdt); }
                continue;
            }
            if (a.dead) { a.deadT += sdt; if (!a.onGround) moveBody(a, { x: 0, z: 0 }, sdt, this.space); continue; }
            if (a.ai) { think(this, a, sdt); steer(this, a, sdt); }
            updateAct(this, a, sdt);
            tickEffects(this, a, sdt);
            a.sp = Math.min(a.spMax, a.sp + a.spMax * 0.06 * sdt);
            a.mp = Math.min(a.mpMax, a.mp + a.mpMax * 0.03 * sdt);
            if (a.regen) a.hp = Math.min(a.hpMax, a.hp + a.regen * sdt);
            else if (!a.ai || a.ai.state !== 'combat') a.hp = Math.min(a.hpMax, a.hp + a.hpMax * 0.01 * sdt);
            if (a.combatT > 0) a.combatT -= sdt;
        }
        updateProjectiles(this, sdt);
        this.pop.update(dt);
        this.lawTick(dt);
        if (this.quests) this.quests.tick(dt);
        while (deferred.length) deferred.shift()();
        // the sneak eye: the most anyone has noticed you
        let dm = 0, inCombat = false;
        for (const a of this.actors) {
            if (a === p || a.dead || !a.ai) continue;
            if (a.ai.target === p.id && a.ai.state === 'combat') inCombat = true;
            if (hostile(a, p)) dm = Math.max(dm, a.ai.target === p.id ? 1 : a.detect);
        }
        p.detectMax = dm;
        p.inCombat = inCombat;
        if (p.sneaking && dm > 0.05 && dm < 1) this.skillUse(p, 'sneak', dt * 0.6);
        this.focus = this.findFocus();
        if (p.hp <= 0 && !p.dead) this.kill(p, null);
    }

    // ---------------------------------------------------------------- the player
    controlPlayer(dt, inp) {
        const p = this.player;
        const st = p.stats;
        p.lookDX = inp.look.dx * 600; p.lookDY = inp.look.dy * 600;
        p.camYaw -= inp.look.dx;
        p.camPitch = Math.max(-1.45, Math.min(1.45, p.camPitch - inp.look.dy));
        if (inp.pressed.has('sneak')) p.sneaking = !p.sneaking;
        if (inp.pressed.has('camera')) p.third = !p.third;
        if (inp.pressed.has('ready')) { p.drawn = !p.drawn; this.emit('ready', { drawn: p.drawn }); }
        const frozen = p.act.kind === 'stagger' || p.act.kind === 'knock' || st.paralyzed || this.frozen;
        let mx = frozen ? 0 : inp.move.x, my = frozen ? 0 : inp.move.y;
        const mag = Math.min(1, Math.hypot(mx, my));
        const sy = Math.sin(p.camYaw), cy = Math.cos(p.camYaw);
        let wx = -sy * my + cy * mx, wz = -cy * my - sy * mx;
        const wl = Math.hypot(wx, wz);
        if (wl > 1e-4) { wx /= wl; wz /= wl; }
        const walk = inp.walk || ((inp.device === 'touch' || inp.device === 'pad') && mag < 0.5);
        const canSprint = p.sp > 1 && my > 0.3 && !p.encumbered;
        p.sprinting = !!inp.sprint && canSprint && mag > 0.2;
        if (p.sprinting && p.sneaking) p.sneaking = false;
        let speed;
        if (p.swim) speed = p.sprinting ? SPEED.swimFast : SPEED.swim;
        else if (p.sprinting) speed = SPEED.sprint;
        else if (p.sneaking) speed = walk ? SPEED.sneak : SPEED.sneakRun;
        else speed = walk ? SPEED.walk : SPEED.run;
        if (p.encumbered) { speed = Math.min(speed, SPEED.encumbered); p.sprinting = false; }
        if (p.act.kind === 'attack' && p.act.phase !== 'recover') speed *= p.act.power ? 0.4 : 0.7;
        if (p.act.kind === 'draw' || p.act.kind === 'cast' || p.blocking) speed *= 0.55;
        speed *= st.speedMul;
        speed *= mag > 0.05 ? Math.max(0.35, mag) : 0;
        const jump = !frozen && inp.pressed.has('jump') && !p.encumbered && p.sp > 5;
        if (jump && p.onGround) { p.sp -= 6; p.spDelay = 1; this.emit('jump', {}); }
        if (p.dash) { wx = 0; wz = 0; }
        const res = moveBody(p, { x: wx * speed, z: wz * speed, jump }, dt, this.space);
        if (res.landed > 4.5 && !p.swim) {
            let dmg = (res.landed - 4.5) * (res.landed - 4.5) * 2.4;
            if (p.sheet.perks.ha_cushion && st.fullHeavy) dmg *= 0.5;
            this.emit('fall', { dmg });
            applyDamage(this, p, { amount: dmg, type: 'magic', source: null });
        }
        const hs = Math.hypot(p.vel.x, p.vel.z);
        p.moving = hs;
        const aiming = p.act.kind !== 'idle' || p.blocking;
        if (!p.third || aiming) p.yaw = p.camYaw;
        else if (hs > 0.5) {
            const target = Math.atan2(-p.vel.x, -p.vel.z);
            let d = target - p.yaw;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            p.yaw += d * Math.min(1, dt * 10);
        }
        if (p.sprinting && hs > 1) { p.sp = Math.max(0, p.sp - 7 * dt); p.spDelay = 1.2; }
        p.spDelay -= dt;
        const calm = p.inCombat ? 1 : 2;
        if (p.spDelay <= 0) p.sp = Math.min(p.spMax, p.sp + p.spMax * 0.05 * dt * st.regen.sp * calm);
        if (p.act.kind !== 'cast') p.mp = Math.min(p.mpMax, p.mp + p.mpMax * 0.03 * dt * st.regen.mp * calm);
        p.hp = Math.min(p.hpMax, p.hp + p.hpMax * 0.007 * dt * st.regen.hp * calm);
        if (p.swim && this.cellId === 'ext' && (this.region === 'coast' || this.region === 'icefields') && !(p.sheet && KIN[p.sheet.kin]?.coldblood) && (st.resist.frost || 0) < 50) {
            applyDamage(this, p, { amount: 2.5 * dt, type: 'frost', source: null, quiet: true, dot: true });
        }
        if (p.onGround && hs > 0.4) {
            p.stepDist += hs * dt;
            const stride = p.sprinting ? 2.1 : p.sneaking ? 1.1 : 1.6;
            if (p.stepDist > stride) { p.stepDist = 0; this.emit('step', { actor: p, surface: this.surfaceAt(p.pos.x, p.pos.z), sneak: p.sneaking, heavy: st.heavyPieces || 0 }); }
        }
        if (!frozen) this.playerCombat(dt, inp);
        if (inp.pressed.has('use') || inp.pressed.has('tapUse')) this.useFocus();
    }

    playerCombat(dt, inp) {
        const p = this.player;
        const right = weaponIn(p, 'right');
        const leftEntry = p.equip.left, leftDef = leftEntry && itemDef(leftEntry);
        const rSpell = p.hands.right, lSpell = p.hands.left;
        if (inp.pressed.has('attack')) {
            p.drawn = true;
            if (rSpell && !right) startCast(this, p, 'right');
            else if (right?.d.bow) startDraw(this, p);
            else if (p.blocking) startBash(this, p);
            else p.attackHold = 0;
        }
        if (p.attackHold >= 0) {
            p.attackHold += dt;
            if (p.attackHold > 0.32) { startAttack(this, p, 'right', true); p.attackHold = -1; }
        }
        if (inp.released.has('attack')) {
            if (p.attackHold >= 0) { startAttack(this, p, 'right', false); p.attackHold = -1; }
            if (p.act.kind === 'draw') releaseArrow(this, p);
            if (p.act.kind === 'cast' && p.act.hand === 'right') releaseCast(this, p, 'right');
        }
        const blockable = !lSpell && (!leftDef || leftDef.slot === 'shield' || leftDef.type === 'torch' || right?.d.two);
        if (inp.held.has('block') && blockable && !right?.d.bow) { if (!p.blocking && p.act.kind === 'idle') { p.blocking = true; p.drawn = true; } }
        else p.blocking = false;
        if (inp.pressed.has('block')) {
            if (lSpell) startCast(this, p, 'left');
            else if (leftDef?.type === 'weapon') startAttack(this, p, 'left', false);
        }
        if (inp.released.has('block') && p.act.kind === 'cast' && p.act.hand === 'left') releaseCast(this, p, 'left');
        if (inp.pressed.has('sigil')) startSigil(this, p);
        if (inp.released.has('sigil')) releaseSigil(this, p);
    }

    /** grass, snow, stone, wood, dirt, water */
    surfaceAt(x, z) {
        if (this.cellId !== 'ext') return this.space.surface || 'stone';
        const T = this.terrain;
        if (this.player.wade) return 'water';
        if (this.space.onPlatform(x, z, this.player.pos.y)) return 'wood';
        if (T.maskAt(x, z, 1) > 0.5) return 'snow';
        if (T.maskAt(x, z, 2) > 0.5) return 'dirt';
        if (T.slopeAt(x, z) > 0.35) return 'stone';
        return 'grass';
    }

    // ---------------------------------------------------------------- death
    kill(t, src) {
        if (t.dead) return;
        t.dead = true; t.hp = 0; t.deadT = 0;
        t.act = { kind: 'dead', t: 0 };
        t.blocking = false;
        if (t.ai) { t.ai.state = 'dead'; t.ai.goal = null; }
        dropLoot(t, this.rng);
        if (t.kind === 'player') { this.emit('playerDeath', { by: src }); return; }
        if (src?.kind === 'player' || src?.faction === 'player') this.stats.kills++;
        if (src?.kind === 'player' && ['guard', 'town', 'friend', 'hearth'].includes(t.faction) && !t.hostileToPlayer && !t.summoner && !t.campLoc) this.crime('murder', t.npcId || null, 0, null);
        this.emit('death', { actor: t, by: src });
        if (t.essence && t.kind !== 'npc') this.dropEssence(t, src);
        if (t.rig === 'dragon') this.dragonDeath(t);
        if (this.cellId !== 'ext') this.interiors.onKill(t);
        if (t.npcId) this.pop.state[t.npcId] = { ...(this.pop.state[t.npcId] || {}), dead: true };
        if (t.campLoc) {
            const camp = this.pop.camps.get(t.campLoc);
            if (camp?.actors?.every((a) => a.dead) && camp.clearedAt == null) { camp.clearedAt = this.time.total; this.emit('cleared', { loc: t.campLoc }); }
        }
        if (t.summoner) later(() => this.dismiss(t));
        if (this.onKill) this.onKill(t, src);
    }

    /** Creatures leave a vial of their essence behind (enchanting fuel); summoners condense it more often. */
    dropEssence(t, src) {
        const p = this.player;
        const chance = 0.25 + (p.sheet.skills.conjuration || 0) / 250 + (src === p ? 0.1 : 0);
        if (!this.rng.chance(chance)) return;
        const id = ESSENCE_IDS[Math.min(ESSENCE_IDS.length, t.essence) - 1];
        addItem(t, { id }, 1);
        this.emit('essence', { actor: t, id });
    }

    dragonDeath(t) {
        this.stats.dragons++;
        this.emit('dragonDeath', { actor: t });
        if (this.flags.stormsworn) {
            absorbEmber(this.player.storm);
            this.stats.embers++;
            this.emit('ember', { actor: t, pos: { ...t.pos } });
        }
    }

    // ---------------------------------------------------------------- magic helpers used by combat.js
    summon(owner, tpl, dur) {
        const max = owner.sheet?.perks.co_twin ? 2 : 1;
        const mine = this.actors.filter((a) => a.summoner === owner.id && !a.dead);
        while (mine.length >= max) this.dismiss(mine.shift());
        const d = aimDir(this, owner);
        const x = owner.pos.x + d.x * 3, z = owner.pos.z + d.z * 3;
        const a = createActor(tpl, { rng: this.rng, level: owner.sheet?.level || owner.level || 5, faction: owner.kind === 'player' ? 'player' : owner.faction, ai: 'summon' });
        if (owner.sheet?.perks.co_potency && tpl.includes('golem')) { a.tdmg *= 1.5; a.hpMax = Math.round(a.hpMax * 1.5); a.hp = a.hpMax; }
        a.pos.x = x; a.pos.z = z; a.pos.y = this.space.ground(x, z, owner.pos.y + 2);
        a.summoner = owner.id; a.summonT = dur;
        a.ai.leader = owner.id;
        a.follower = owner.kind === 'player';
        this.addActor(a);
        this.emit('summon', { actor: a });
        return a;
    }
    dismiss(a) { if (!a || !this.actors.includes(a)) return; this.emit('unsummon', { actor: a }); this.removeActor(a); }

    bindWeapon(owner, weaponId, dur, hand) {
        const e = addItem(owner, { id: weaponId, bound: true });
        equip(owner, e, hand);
        owner.hands[hand] = null;
        owner.boundUntil = this.time.total + dur * TIMESCALE / 3600;
        owner.boundEntry = e;
        this.emit('bound', { actor: owner });
    }

    aimPoint(a, maxD) {
        const d = aimDir(this, a), e = eye(a);
        for (let s = 0.5; s <= maxD; s += 0.5) {
            const x = e.x + d.x * s, y = e.y + d.y * s, z = e.z + d.z * s;
            const g = this.space.ground(x, z, y + 0.5);
            if (y <= g + 0.05) return { x, y: g, z };
        }
        const x = e.x + d.x * maxD, z = e.z + d.z * maxD;
        return { x, y: this.space.ground(x, z, e.y), z };
    }

    // ---------------------------------------------------------------- loose items and containers
    dropItem(entry, n, pos, owner = null) {
        const it = { uid: `i${this.uid++}`, entry: { ...entry, n }, pos: { ...pos }, cell: this.cellId, owner };
        this.items.push(it);
        this.emit('itemDropped', { item: it });
        return it;
    }

    container(id, kind, opts = {}) {
        let c = this.containers.get(id);
        if (!c) {
            const r = new Rng(hashStr(id) ^ (this.time.day * 977));
            c = { id, kind, inv: opts.inv || rollLoot(kind, opts.level ?? this.player.sheet.level, r), locked: opts.locked || 0, owner: opts.owner || null };
            this.containers.set(id, c);
        }
        return c;
    }

    // ---------------------------------------------------------------- interaction
    /** The thing in front of the player that Use would act on. */
    findFocus() {
        const p = this.player;
        if (p.dead) return null;
        const d = aimDir(this, p);
        const e = eye(p);
        const range = p.third ? 4.4 : 3.2;
        let best = null, bestScore = -Infinity;
        const consider = (kind, ref, x, y, z, r = 0.6, extra = {}) => {
            const dx = x - e.x, dy = y - e.y, dz = z - e.z;
            const dist = Math.hypot(dx, dy, dz);
            if (dist > range + r) return;
            const cos = (dx * d.x + dy * d.y + dz * d.z) / (dist || 1);
            const need = 0.84 - Math.min(0.35, r / Math.max(dist, 0.5));
            if (cos < need) return;
            const score = cos * 2 - dist * 0.25;
            if (score > bestScore) { bestScore = score; best = { kind, ref, x, y, z, dist, ...extra }; }
        };
        for (const a of this.actors) {
            if (a === p) continue;
            if (a.dead) { if (a.rig !== 'dragon' || a.deadT > 4) consider('corpse', a, a.pos.x, a.pos.y + 0.4, a.pos.z, a.rig === 'dragon' ? 4 : 1.0); }
            else if (a.rig === 'humanoid' && !hostile(a, p) && a.ai?.state !== 'combat' && !a.summoner) consider(p.sneaking && !a.follower ? 'pickpocket' : 'talk', a, a.pos.x, a.pos.y + 1.4 * a.scale, a.pos.z, 0.6);
            else if (a.talkable && !hostile(a, p)) consider('talk', a, a.pos.x, a.pos.y + 3 * a.scale, a.pos.z, 3.5);
            else if (a.tpl === 'horse' && !hostile(a, p)) consider('mount', a, a.pos.x, a.pos.y + 1.2, a.pos.z, 1);
        }
        for (const it of this.items) if (it.cell === this.cellId) consider('item', it, it.pos.x, it.pos.y + 0.15, it.pos.z, 0.45);
        const use = this.space.usablesFor ? this.space.usablesFor(p.pos, range + 2) : this.extUsables(p.pos, range + 2);
        for (const u of use) consider(u.kind, u, u.x, u.y, u.z, u.r || 0.8, u);
        return best;
    }

    extUsables(pos, r) {
        const out = [];
        const S = this.settlements;
        for (const dd of S.doors) if (Math.abs(dd.x - pos.x) < r + 2 && Math.abs(dd.z - pos.z) < r + 2) out.push({ kind: 'door', x: dd.x, y: dd.y + 1.2, z: dd.z, r: 1.1, door: dd, name: dd.name });
        for (const st of S.stations) if (Math.abs(st.x - pos.x) < r && Math.abs(st.z - pos.z) < r) out.push({ kind: 'station', x: st.x, y: st.y + 0.9, z: st.z, r: 1, station: st });
        for (const pr of S.props) {
            if (Math.abs(pr.x - pos.x) > r + 3 || Math.abs(pr.z - pos.z) > r + 3) continue;
            if (pr.type === 'totem') out.push({ kind: 'totem', x: pr.x, y: pr.y + 2, z: pr.z, r: 1.4, totem: pr.totem });
            else if (pr.type === 'sigilstone' && pr.ring) out.push({ kind: 'sigilstone', x: pr.x, y: pr.y + 2.2, z: pr.z, r: 4, ring: pr.ring, loc: pr.loc });
            else if ((pr.type === 'barrel' || pr.type === 'crate') && pr.loc) out.push({ kind: 'container', x: pr.x, y: pr.y + 0.8, z: pr.z, r: 0.7, cid: `${pr.loc}:${pr.type}:${Math.round(pr.x)}:${Math.round(pr.z)}`, ckind: pr.type === 'barrel' ? 'barrel' : 'sack', owner: pr.loc, name: pr.type === 'barrel' ? 'Barrel' : 'Crate' });
            else if (pr.type === 'cookpot') out.push({ kind: 'station', x: pr.x, y: pr.y + 0.6, z: pr.z, r: 1, station: { type: 'cookpot', id: `${pr.loc}:cook` } });
            else if (pr.type === 'signpost') out.push({ kind: 'sign', x: pr.x, y: pr.y + 2.3, z: pr.z, r: 0.8, to: pr.to });
        }
        const plants = this.flora.plants;
        if (!this._plantGrid) {
            this._plantGrid = new Map();
            plants.forEach((pl, i) => { const k = Math.floor(pl.x / 16) * 4096 + Math.floor(pl.z / 16); if (!this._plantGrid.has(k)) this._plantGrid.set(k, []); this._plantGrid.get(k).push(i); });
        }
        const cx = Math.floor(pos.x / 16), cz = Math.floor(pos.z / 16);
        for (let gz = cz - 1; gz <= cz + 1; gz++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
            for (const i of this._plantGrid.get(gx * 4096 + gz) || []) {
                const pl = plants[i];
                if (Math.hypot(pl.x - pos.x, pl.z - pos.z) > r) continue;
                const h = this.harvested[i];
                if (h != null && this.time.total - h < 72) continue;
                out.push({ kind: 'plant', x: pl.x, y: pl.y + 0.3, z: pl.z, r: 0.6, plant: i, name: ITEMS[pl.id].name });
            }
        }
        for (const u of this.quests.extUsables(pos, r)) out.push(u);
        return out;
    }

    /** Touching a sigil stone: the scar copies the next ring of its sigil (once per stone). */
    readSigilStone(f) {
        const key = `stone:${f.loc}`;
        const st = this.player.storm;
        if (this.flags[key]) { this.emit('note', { text: 'The stone is silent; its ring is already part of you.' }); return; }
        this.flags[key] = true;
        const n = learnRing(st, f.ring);
        const ring = RINGS[`${f.ring}:${n - 1}`];
        this.emit('ringLearned', { sigil: f.ring, ring: n, name: ring?.name, sigilName: SIGILS[f.ring].name, loc: f.loc });
    }

    giveItem(entry, n = 1) { addItem(this.player, entry, n); this.emit('pickup', { entry, n }); }

    // ---------------------------------------------------------------- doors and cells
    /** Go through a load door (the UI fades out first, then calls this). */
    travelDoor(door) {
        if (this.cellId === 'ext') {
            this.extReturn = door;
            this.enterCell(door.to, 'entry');
        } else if (door.to === 'ext') {
            this.exitToExt((door.ext?.id && this.settlements.doors.find((d) => d.id === door.ext.id)) || (door.ext?.x != null ? door.ext : null) || this.settlements.doors.find((d) => d.loc === this.space.loc && d.interior === 'dungeon') || this.extReturn);
        } else this.enterCell(door.to, door.arriveAt || 'entry');
    }

    /** Swap the world over to an interior cell. */
    enterCell(id, arriveAt = 'entry') {
        const p = this.player;
        const followers = this.actors.filter((a) => a !== p && a.follower && !a.dead && !a.summoner);
        // everything outside (or in the previous cell) goes to sleep
        for (const a of [...this.actors]) if (a !== p && !followers.includes(a)) this.removeActor(a);
        if (this.cellId === 'ext') this.pop.suspend();
        this.items = this.items.filter((it) => it.cell === 'ext' || it.cell === id || it.owner === 'keep');
        this.projectiles.length = 0; this.runes.length = 0;
        const c = this.interiors.get(id);
        this.interiors.usedSpots.clear();
        this.space = c;
        this.cellId = id;
        p.cell = id;
        const at = arriveAt === 'up' ? c.upSpot || c.entry : arriveAt === 'down' ? c.downSpot || c.entry : c.entry;
        this.placePlayer(at.x, at.z, at.rot, c.floorAt(at.x, at.z) + 0.5);
        followers.forEach((f, i) => { f.cell = id; f.pos.x = at.x + 1 + i * 0.8; f.pos.z = at.z + 0.6; f.pos.y = c.floorAt(f.pos.x, f.pos.z); });
        this.interiors.populate(c);
        this.quests.cellSetup(c);
        this.pop.timer = 0;
        this.emit('cellChanged', { cell: id, interior: true, name: c.kind === 'dungeon' ? LOC[c.loc]?.name : null });
        if (c.loc && !this.discovered.has(c.loc) && c.kind === 'dungeon') { this.discovered.add(c.loc); this.emit('discovered', { loc: c.loc }); }
    }

    /** Back out into the open, in front of the door we used. */
    exitToExt(door) {
        const p = this.player;
        const followers = this.actors.filter((a) => a !== p && a.follower && !a.dead && !a.summoner);
        for (const a of [...this.actors]) if (a !== p && !followers.includes(a)) this.removeActor(a);
        this.projectiles.length = 0; this.runes.length = 0;
        this.space = this.ext;
        this.cellId = 'ext';
        p.cell = 'ext';
        const d = door || this.extReturn || { x: p.pos.x, z: p.pos.z, rot: 0 };
        const out = 2.2;
        const x = d.x + Math.sin(d.rot || 0) * out, z = d.z + Math.cos(d.rot || 0) * out;
        this.placePlayer(x, z, (d.rot || 0) + Math.PI);
        followers.forEach((f, i) => { f.cell = 'ext'; f.pos.x = x + 1 + i; f.pos.z = z + 1; f.pos.y = this.terrain.heightAt(f.pos.x, f.pos.z); });
        this.extReturn = null;
        this.pop.timer = 0;
        this.emit('cellChanged', { cell: 'ext', interior: false });
    }

    useFocus() {
        const f = this.focus;
        const p = this.player;
        if (!f) return;
        if (p.stats.invisible && f.kind !== 'item') { p.effects = p.effects.filter((e) => e.id !== 'invisibility'); p.dirty = true; }
        switch (f.kind) {
            case 'item': {
                const it = f.ref;
                const theft = it.owner && !this.isOwnerOk(it.owner);
                if (theft) this.crime('theft', it.owner, ITEMS[it.entry.id]?.value || 1);
                addItem(p, theft ? { ...it.entry, stolen: true } : it.entry, it.entry.n);
                this.items.splice(this.items.indexOf(it), 1);
                this.emit('pickup', { entry: it.entry, n: it.entry.n });
                this.emit('itemTaken', { item: it });
                break;
            }
            case 'plant': {
                const pl = this.flora.plants[f.plant];
                this.harvested[f.plant] = this.time.total;
                const n = 1 + (this.rng.chance(0.25) ? 1 : 0);
                addItem(p, { id: pl.id }, n);
                this.emit('pickup', { entry: { id: pl.id }, n, harvest: true });
                this.emit('harvest', { plant: f.plant });
                break;
            }
            case 'corpse': this.emit('openContainer', { actor: f.ref, corpse: true, name: f.ref.name }); break;
            case 'container': {
                const c = this.container(f.cid, f.ckind, { owner: f.owner, locked: f.locked, level: f.level });
                if (c.locked > 0) { this.emit('locked', { container: c, focus: f }); break; }
                this.emit('openContainer', { container: c, name: f.name, owner: f.owner });
                break;
            }
            case 'talk': this.emit('talk', { actor: f.ref }); break;
            case 'pickpocket': this.emit('pickpocket', { actor: f.ref }); break;
            case 'door':
                if (f.door.locked > 0 && !this.flags[`unlocked:${f.door.id}`]) { this.emit('locked', { door: f.door, focus: f }); break; }
                this.emit('useDoor', { door: f.door });
                break;
            case 'station': this.emit('station', { station: f.station }); break;
            case 'totem': p.sheet.totem = f.totem; p.dirty = true; this.emit('totem', { totem: f.totem }); break;
            case 'sigilstone': this.readSigilStone(f); break;
            case 'sign': this.emit('sign', { to: f.to }); break;
            case 'mount': this.emit('mount', { horse: f.ref }); break;
            default:
                if (this.quests.use(f)) break;
                if (this.cellId !== 'ext') this.interiors.use(f, this); else this.emit('use', { focus: f });
        }
    }

    isOwnerOk(owner) { return !owner || owner === 'player' || this.flags[`owns:${owner}`]; }
    // ---------------------------------------------------------------- the law
    /** The town whose guards care about what happens here (null in the wilds). */
    townAt() {
        let loc = null;
        if (this.cellId !== 'ext') loc = this.space.loc || this.cellId.split(':')[0];
        else {
            const p = this.player.pos;
            for (const L of LOCATIONS) if ((L.kind === 'city' || L.kind === 'town' || L.kind === 'village') && Math.hypot(L.x - p.x, L.z - p.z) < (L.flat || 60) + 90) { loc = L.id; break; }
        }
        if (!loc || !LOC[loc] || !['city', 'town', 'village'].includes(LOC[loc].kind) && loc !== 'hollowmere' && loc !== 'highcairn') return null;
        return townOf(loc);
    }
    lawful(a) { return a && !a.dead && a !== this.player && ['guard', 'town', 'friend', 'hearth'].includes(a.faction) && !a.summoner && !a.campLoc; }
    /** Who saw it? Lawful folk nearby with a line of sight (the victim always counts). */
    witnesses(victim = null) {
        const p = this.player;
        return this.actors.filter((a) => this.lawful(a) && a.cell === this.cellId && a.ai?.state !== 'sleep' && (a === victim || (Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < 20 && canSee(this, a, p) && !(p.stats.invisible))));
    }
    crime(kind, owner, value, victim = null) {
        const p = this.player;
        if (kind === 'theft') this.stats.stolen++;
        const seen = this.witnesses(victim);
        this.emit('crime', { kind, owner, value, seen: seen.length > 0 });
        if (this.onCrime) this.onCrime(kind, owner, value);
        if (!seen.length) return false;
        const town = this.townAt() || (victim?.homeLoc && townOf(victim.homeLoc)) || null;
        if (!town) { for (const a of seen) { a.angry = a.angry || new Set(); a.angry.add(p.id); } return true; }
        p.bounty[town] = (p.bounty[town] || 0) + fineFor(kind, value);
        this.emit('crimeSeen', { kind, town, bounty: p.bounty[town] });
        this.lawCool = Math.min(this.lawCool || 0, 1.5);
        return true;
    }
    /** The player struck someone: an assault if they were minding their own business. */
    lawHit(t) {
        if (!this.lawful(t) || t.follower || t.hostileToPlayer || t.angry?.has(this.player.id) || t.ai?.state === 'combat' && hostile(t, this.player)) return;
        t.angry = t.angry || new Set(); t.angry.add(this.player.id);
        this.crime('assault', t.npcId || t.homeLoc || null, 0, t);
    }
    guardsOf(town) { return this.actors.filter((a) => a.tpl === 'guard' && !a.dead && townOf(a.homeLoc || '') === town); }
    /** Guards walk up to wanted criminals; murderers and those who resisted are attacked on sight. */
    lawTick(dt) {
        this.lawCool = (this.lawCool ?? 2) - dt;
        if (this.lawCool > 0) return;
        this.lawCool = 1;
        const p = this.player, town = this.townAt();
        if (!town || p.dead) return;
        const b = p.bounty[town] || 0;
        if (b <= 0) return;
        const guards = this.guardsOf(town);
        if (b >= 1000 || this.flags[`resist:${town}`]) { for (const g of guards) if (!g.hostileToPlayer) { g.hostileToPlayer = true; g.ai.state = 'combat'; g.ai.target = p.id; } return; }
        if ((this.arrestCool || 0) > this.time.total) return;
        for (const g of guards) {
            if (g.hostileToPlayer || g.ai.state === 'combat') continue;
            const d = Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z);
            if (d < 26 && canSee(this, g, p)) g.ai.dest = { x: p.pos.x, z: p.pos.z, run: true };
            if (d < 3.5) { this.arrestCool = this.time.total + 0.5; this.emit('arrest', { guard: g, town, bounty: b }); return; }
        }
    }
    payFine(town) {
        const p = this.player, b = p.bounty[town] || 0;
        if (p.gold < b) return false;
        p.gold -= b;
        this.clearBounty(town);
        // anything stolen is confiscated
        const stolen = p.inv.filter((e) => e.stolen);
        for (const e of stolen) removeItem(p, e, e.n || 1);
        this.emit('note', { text: stolen.length ? 'You pay the fine. Your stolen goods are confiscated.' : 'You pay the fine.' });
        return true;
    }
    serveTime(town) {
        const p = this.player, b = p.bounty[town] || 0;
        const days = Math.max(1, Math.min(10, Math.ceil(b / 100)));
        this.clearBounty(town);
        // a little of what you knew fades in the cell
        const ids = Object.keys(p.sheet.skillXp).sort((a, c) => p.sheet.skillXp[c] - p.sheet.skillXp[a]);
        for (const id of ids.slice(0, days)) p.sheet.skillXp[id] = 0;
        for (const e of p.inv.filter((x) => x.stolen)) removeItem(p, e, e.n || 1);
        this.wait(days * 24, true);
        this.emit('note', { text: `You serve ${days} day${days > 1 ? 's' : ''} in the town cells. Some of your skill progress is lost.` });
    }
    resistArrest(town) {
        this.flags[`resist:${town}`] = true;
        this.player.bounty[town] = (this.player.bounty[town] || 0) + 40;
        this.lawCool = 0;
    }
    clearBounty(town) {
        this.player.bounty[town] = 0;
        delete this.flags[`resist:${town}`];
        for (const a of this.actors) {
            if (a.angry) a.angry.delete(this.player.id);
            if (a.tpl === 'guard' && townOf(a.homeLoc || '') === town) { a.hostileToPlayer = false; if (a.ai.target === this.player.id) { a.ai.target = null; a.ai.state = 'idle'; } a.ai.dest = null; }
        }
        this.arrestCool = this.time.total + 0.3;
    }

    // ---------------------------------------------------------------- fast travel
    /** null if you may travel now, else the reason you can't. */
    canFastTravel() {
        const p = this.player;
        if (!this.flags.prologueDone) return 'You cannot travel yet.';
        if (this.cellId !== 'ext') return 'You cannot fast travel from inside.';
        if (p.inCombat || this.actors.some((a) => !a.dead && a.ai?.target === p.id && a.ai.state === 'combat')) return 'You cannot fast travel with enemies nearby.';
        if (p.stats.encumbered) return 'You are carrying too much to fast travel.';
        if (p.swimming) return 'You cannot fast travel while swimming.';
        return null;
    }
    fastTravel(locId) {
        const L = LOC[locId];
        if (!L || this.canFastTravel()) return false;
        const p = this.player;
        const dist = Math.hypot(L.x - p.pos.x, L.z - p.pos.z);
        const hours = Math.max(0.5, dist / 450);
        const followers = this.actors.filter((a) => a !== p && a.follower && !a.dead && !a.summoner);
        for (const a of [...this.actors]) if (a !== p && !followers.includes(a) && a.rig !== 'dragon') this.removeActor(a);
        this.pop.suspend();
        this.hourAdvance(hours);
        // arrive in front of the dungeon door, or at the edge of the settlement on its road
        const door = this.settlements.doors.find((d) => d.loc === locId && d.interior === 'dungeon');
        let x, z, yaw = 0;
        if (door) { x = door.x + Math.sin(door.rot || 0) * 3; z = door.z + Math.cos(door.rot || 0) * 3; yaw = (door.rot || 0) + Math.PI; }
        else {
            const sp = this.settlements.props.find((pr) => pr.type === 'signpost' && Math.hypot(pr.x - L.x, pr.z - L.z) < (L.flat || 40) + 60);
            if (sp) { x = sp.x + 2; z = sp.z + 2; } else { x = L.x; z = L.z + (L.flat ? Math.min(L.flat * 0.4, 20) : 6); }
            yaw = Math.atan2(-(L.x - x), -(L.z - z));
        }
        this.placePlayer(x, z, yaw);
        followers.forEach((f, i) => { f.pos.x = x + 1.5 + i; f.pos.z = z + 1; f.pos.y = this.terrain.heightAt(f.pos.x, f.pos.z); });
        this.pop.timer = 0;
        this.weather.update(hours, 200, regionAt(x, z), this.events);
        this.emit('fastTravel', { loc: locId, hours });
        return true;
    }

    // ---------------------------------------------------------------- using items from the inventory
    useItem(entry) {
        const p = this.player;
        const d = itemDef(entry);
        if (!d) return false;
        if (d.type === 'potion' || d.type === 'food') {
            for (const ef of d.effects || []) addEffect(this, p, ef, p);
            for (const ef of entry.effects || []) addEffect(this, p, ef, p);
            removeItem(p, entry, 1);
            this.emit(d.type === 'potion' ? 'drink' : 'eat', { id: d.id });
            if (d.type === 'potion') this.stats.potions++;
            return true;
        }
        if (d.type === 'ingredient') {
            // raw ingredients are food of a sort; what they do in a still is learned at the alchemy table
            addEffect(this, p, { id: 'restoreHealth', mag: 2, dur: 0 }, p);
            removeItem(p, entry, 1);
            this.emit('eat', { id: d.id });
            return true;
        }
        if (d.type === 'spelltome') {
            if (p.spells.includes(d.spell)) { this.emit('note', { text: 'You already know this spell.' }); return false; }
            p.spells.push(d.spell);
            removeItem(p, entry, 1);
            this.emit('learnSpell', { spell: d.spell });
            return true;
        }
        if (d.type === 'book') { this.emit('readBook', { entry }); return true; }
        if (d.type === 'poison') return this.applyPoison(entry);
        return false;
    }

    applyPoison(entry) {
        const p = this.player;
        const w = p.equip.right;
        if (!w || itemDef(w)?.type !== 'weapon') { this.emit('note', { text: 'You need a weapon in hand to apply a poison.' }); return false; }
        const d = itemDef(entry);
        w.poison = { effects: [...(d.effects || []), ...(entry.effects || [])].map((e) => ({ ...e, mag: e.mag * (p.sheet.perks.al_poisoner ? 1.25 : 1) })), uses: 1, name: entry.name || d.name };
        removeItem(p, entry, 1);
        this.emit('note', { text: `Applied ${w.poison.name}.` });
        return true;
    }

    // ---------------------------------------------------------------- waiting and sleeping
    wait(hours, sleep = false) {
        const p = this.player;
        this.hourAdvance(hours);
        heal(p, 'hp', p.hpMax); heal(p, 'mp', p.mpMax); heal(p, 'sp', p.spMax);
        for (const a of this.actors) if (!a.dead && a !== p) a.hp = a.hpMax;
        for (const ef of p.effects) if (ef.dur > 0) ef.t -= hours * 3600 / TIMESCALE;
        p.dirty = true;
        this.weather.update(hours, 200, this.region, this.events);
        this.pop.timer = 0;
        if (sleep && hours >= 1) { p.sheet.rested = 8; this.emit('note', { text: 'You wake Refreshed. Skills improve 10% faster for a while.' }); }
        this.emit('waited', { hours, sleep });
    }
}
