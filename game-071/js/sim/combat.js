/**
 * combat.js — what actors do with their hands, their spells and the Storm Sigils.
 *
 * One action state per actor (`actor.act`): attack (light/power), bash, draw (bow), cast (spell),
 * sigil, stagger, knock, use. Player and NPCs drive the same functions; the player through input,
 * NPCs through ai.js. Damage itself goes through actor.applyDamage().
 */
import { itemDef, weaponDamage, ITEMS } from './items.js';
import { applyDamage, addEffect, heal } from './actor.js';
import { SPELLS, SIGILS, spellCost, sigilPower } from './magic.js';
import { perkVal } from './stats.js';
import { EFFECTS } from './effects.js';
import { removeItem, weaponIn, countItem } from './inventory.js';

export const TIMING = {
    light: { wind: 0.2, strike: 0.1, recover: 0.26 },
    power: { wind: 0.48, strike: 0.12, recover: 0.46 },
    bash: { wind: 0.12, strike: 0.08, recover: 0.32 },
};
export const BOW_FULL = 1.05;
export const CAST_CHARGE = 0.5;

const busy = (a) => a.act.kind !== 'idle' && a.act.kind !== 'ready';
const flat = (a) => ({ x: -Math.sin(a.yaw), z: -Math.cos(a.yaw) });

/** Where an actor is aiming: the player's camera, or toward its target. */
export function aimDir(world, a, target = null) {
    if (a.kind === 'player') {
        const cp = Math.cos(a.camPitch);
        return { x: -Math.sin(a.camYaw) * cp, y: Math.sin(a.camPitch), z: -Math.cos(a.camYaw) * cp };
    }
    const t = target || (a.ai?.target && world.byId(a.ai.target));
    if (t) {
        const dx = t.pos.x - a.pos.x, dy = (t.pos.y + t.h * 0.6) - (a.pos.y + a.h * 0.85), dz = t.pos.z - a.pos.z;
        const l = Math.hypot(dx, dy, dz) || 1;
        return { x: dx / l, y: dy / l, z: dz / l };
    }
    const f = flat(a);
    return { x: f.x, y: 0, z: f.z };
}

export function eye(a) { return { x: a.pos.x, y: a.pos.y + a.h * (a.kind === 'player' ? 0.9 : 0.85), z: a.pos.z }; }

// ------------------------------------------------------------------ melee
export function startAttack(world, a, hand = 'right', power = false) {
    if (busy(a) || a.dead || a.stats.paralyzed) return false;
    const w = weaponIn(a, hand);
    if (w?.d.bow) return startDraw(world, a);
    if (w?.d.staff) return castStaff(world, a, w.e, hand);
    let cost = 0;
    if (power) {
        cost = 20 + (w ? w.d.weight * 0.5 : 4);
        if (a.sheet) cost *= 1 - (w?.d.two ? perkVal(a.sheet, 'th_stance') : perkVal(a.sheet, 'oh_stance'));
        if (a.sp < cost * 0.4) power = false;
    }
    if (power) { a.sp = Math.max(0, a.sp - cost); a.spDelay = 1.2; }
    const speed = (w ? w.d.speed : 1.15) * (a.stats.slowed ? 0.7 : 1);
    const T = power ? TIMING.power : TIMING.light;
    a.act = { kind: 'attack', hand, power, phase: 'wind', t: 0, wind: T.wind / speed, strike: T.strike, recover: T.recover / speed, hit: new Set(), weapon: w ? w.e.id : null };
    a.blocking = false;
    return true;
}

export function startBash(world, a) {
    if (busy(a) || a.dead) return false;
    const shield = a.equip.left && itemDef(a.equip.left)?.slot === 'shield';
    if (a.sp < 10) return false;
    a.sp -= 15; a.spDelay = 1;
    a.act = { kind: 'bash', hand: 'left', phase: 'wind', t: 0, wind: TIMING.bash.wind, strike: TIMING.bash.strike, recover: TIMING.bash.recover, hit: new Set(), shield };
    return true;
}

function meleeStrike(world, a) {
    const act = a.act;
    const w = act.weapon ? ITEMS[act.weapon] : null;
    const reach = (w ? w.reach : a.reach || 1.7) * (a.rig === 'humanoid' ? Math.max(1, a.scale * 0.85) : 1) + (act.kind === 'bash' ? -0.3 : 0);
    const dir = a.kind === 'player' ? aimDir(world, a) : flat(a);
    const dl = Math.hypot(dir.x, dir.z) || 1;
    const fx = dir.x / dl, fz = dir.z / dl;
    const swingEmit = world.emit('swing', { actor: a, power: act.power, hand: act.hand, weapon: act.weapon, hits: 0 });
    let hits = 0;
    for (const t of world.actors) {
        if (t === a || t.dead || act.hit.has(t.id)) continue;
        if (a.kind !== 'player' && !world.hostile(a, t) && t !== world.byId(a.ai?.target)) continue;
        if (a.kind === 'player' && t.follower && !t.hostileToPlayer) continue;   // don't cut down your own followers
        const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > reach + t.r) continue;
        const dy = (t.pos.y + t.h * 0.5) - (a.pos.y + a.h * 0.5);
        if (Math.abs(dy) > Math.max(2.2, t.h * 0.7 + a.h * 0.3)) continue;
        const cos = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
        if (cos < (t.rig === 'dragon' ? 0.1 : 0.45)) continue;
        act.hit.add(t.id);
        hits++;
        resolveMeleeHit(world, a, t, act, w);
        if (!act.power && a.kind !== 'player') break;   // NPC light swings hit one target
    }
    swingEmit.hits = hits;
}

function resolveMeleeHit(world, a, t, act, w) {
    const sh = a.sheet;
    let dmg, crit = false, sneak = false;
    if (act.kind === 'bash') {
        dmg = (act.shield ? 6 : 3) + (sh ? (sh.perks.bl_bash ? 12 : 0) : a.level * 0.3);
        applyDamage(world, t, { amount: dmg, type: 'phys', source: a, stagger: true });
        if (sh) world.skillUse(a, 'block', 2);
        return;
    }
    const entry = act.weapon ? a.equip[act.hand] : null;
    if (sh) {
        const base = entry ? weaponDamage(entry) : 4;
        const skillId = w ? w.skill : 'oneHanded';
        const skill = sh.skills[skillId] + (a.stats.skillMod[skillId] || 0);
        let m = (1 + skill / 200) * a.stats.dmgMult;
        m *= 1 + (w?.two ? perkVal(sh, 'th_barbarian') : perkVal(sh, 'oh_armsman'));
        m *= 1 + (a.stats.skillMod[skillId] || 0) / 100;
        if (act.power) m *= 2 * (1 + (w?.two ? perkVal(sh, 'th_blow') : perkVal(sh, 'oh_savage')));
        if ((w?.wtype === 'sword' && sh.perks.oh_blades) || (w?.wtype === 'greatsword' && sh.perks.th_wounds)) {
            if (world.rng.chance(0.25)) { crit = true; m *= 1.5; }
        }
        // sneak attacks: the target hasn't noticed you
        if (a.sneaking && !t.ai?.target && t.detect < 1) {
            sneak = true;
            if (w?.wtype === 'dagger') m *= sh.perks.sn_assassin ? 15 : sh.perks.sn_backstab ? 6 : 3;
            else if (w && !w.two) m *= sh.perks.sn_backstab ? 6 : 3;
            else m *= 2;
            world.skillUse(a, 'sneak', 2.5);
        }
        dmg = base * m;
        world.skillUse(a, skillId, 1 + dmg * 0.06);
    } else {
        const base = entry ? weaponDamage(entry) * (1 + a.level * 0.03) : a.tdmg;
        dmg = base * (act.power ? 1.8 : 1) * (a.stats.dmgMult || 1);
        if (a.stats.courage) dmg *= 1.2;
    }
    const pierce = w?.pierce || false;
    const done = applyDamage(world, t, { amount: dmg, type: 'phys', source: a, power: act.power, stagger: act.power || (t.kind !== 'player' && world.rng.chance(0.15)), sneak, crit, pierce, hand: act.hand, knock: a.tpl === 'giant' && act.power ? true : false, push: a.tpl === 'giant' ? { x: -Math.sin(a.yaw) * 9, y: 8, z: -Math.cos(a.yaw) * 9 } : null });
    // weapon enchantment
    const ench = entry && (entry.ench || itemDef(entry)?.ench);
    if (ench && (entry.charge == null || entry.charge > 0) && !t.dead) {
        weaponEnchantHit(world, a, t, ench);
        if (entry.charge != null) entry.charge = Math.max(0, entry.charge - 20);
    }
    // applied poison
    if (entry?.poison && !t.dead) { for (const ef of entry.poison.effects) addEffect(world, t, ef, a); entry.poison.uses--; if (entry.poison.uses <= 0) entry.poison = null; }
    // creature extras: spiders poison, troll and spectral wolves bite
    if (a.tpl && !a.sheet && done > 0) {
        if (a.tpl === 'spider' || a.tpl === 'giantspider') addEffect(world, t, { id: 'lingering', mag: a.level * 0.4 + 1, dur: 5 }, a);
        if (a.tpl === 'clockwork_spider') applyDamage(world, t, { amount: 4 + a.level * 0.3, type: 'shock', source: a, quiet: true });
    }
}

function weaponEnchantHit(world, a, t, ench) {
    const E = EFFECTS[ench.id];
    if (!E) return;
    addEffect(world, t, { id: ench.id, mag: ench.mag, dur: ench.dur || 0 }, a);
    if (a.sheet) world.skillUse(a, 'enchanting', 0.4);
}

// ------------------------------------------------------------------ archery
export function startDraw(world, a) {
    if (busy(a) || a.dead) return false;
    const w = weaponIn(a, 'right');
    if (!w?.d.bow) return false;
    if (a.sheet && (!a.equip.ammo || a.equip.ammo.n <= 0)) {
        // pick any arrows
        const any = a.inv.find((e) => ITEMS[e.id]?.type === 'ammo');
        if (!any) { world.emit('note', { text: 'You have no arrows.' }); return false; }
        a.equip.ammo = any;
    }
    a.act = { kind: 'draw', t: 0, full: BOW_FULL * (a.sheet ? 1 - perkVal(a.sheet, 'ar_quick') : 1.15) };
    a.blocking = false;
    world.emit('draw', { actor: a });
    return true;
}

export function releaseArrow(world, a) {
    if (a.act.kind !== 'draw') return;
    const draw = Math.min(1, a.act.t / a.act.full);
    a.act = { kind: 'idle', t: 0 };
    if (draw < 0.25) return;
    const w = weaponIn(a, 'right');
    const ammoE = a.equip.ammo;
    const ammo = ammoE ? ITEMS[ammoE.id] : ITEMS.arrow_iron;
    if (a.sheet && ammoE) { removeItem(a, ammoE, 1); if (!a.inv.includes(ammoE)) a.equip.ammo = null; }
    let dmg = ((w ? weaponDamage(w.e) : 6) + ammo.damage) * (0.3 + 0.7 * draw * draw);
    const sh = a.sheet;
    let sneak = false;
    if (sh) {
        const skill = sh.skills.archery + (a.stats.skillMod.archery || 0);
        dmg *= (1 + skill / 200) * (1 + perkVal(sh, 'ar_overdraw')) * (1 + (a.stats.skillMod.archery || 0) / 100);
        if (a.sneaking) sneak = true;
    } else dmg *= 1 + a.level * 0.03;
    const dir = aimDir(world, a);
    const e = eye(a);
    const sp = 30 + 30 * draw;
    // NPC archers hold over for the drop
    if (!sh && a.ai?.target) {
        const t = world.byId(a.ai.target);
        if (t) { const d = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z); const tf = d / sp; dir.y += 0.5 * 9.8 * tf * tf / Math.max(d, 1); }
    }
    world.projectiles.push({ kind: 'arrow', pos: { x: e.x + dir.x * 0.6, y: e.y + dir.y * 0.6 - 0.05, z: e.z + dir.z * 0.6 }, vel: { x: dir.x * sp, y: dir.y * sp, z: dir.z * sp }, grav: 9.8, owner: a.id, dmg, sneak, ammo: ammo.id, life: 6, r: 0.08, power: sh && sh.perks.ar_power && world.rng.chance(0.5) });
    world.emit('loose', { actor: a });
    if (sh) world.skillUse(a, 'archery', 0.3);
}

// ------------------------------------------------------------------ magic
export function startCast(world, a, hand) {
    if (busy(a) || a.dead) return false;
    const id = a.hands[hand];
    const sp = SPELLS[id];
    if (!sp) return false;
    const cost = a.sheet ? Math.max(1, Math.round(spellCost(sp, a.sheet.skills[sp.school] + (a.stats.skillMod[sp.school] || 0), a.sheet.perks) * (a.stats.spellCostMul || 1))) : Math.round(sp.cost * 0.7);
    const isConc = sp.kind === 'conc' || sp.kind === 'heal' || sp.kind === 'ward';
    if (!isConc && a.mp < cost) { if (a.kind === 'player') world.emit('nomana', {}); return false; }
    if (isConc && a.mp < cost * 0.25) { if (a.kind === 'player') world.emit('nomana', {}); return false; }
    a.act = { kind: 'cast', hand, spell: id, t: 0, cost, conc: isConc, fired: false };
    a.blocking = false;
    world.emit('castStart', { actor: a, spell: id, hand });
    return true;
}

function castStaff(world, a, entry, hand) {
    const d = itemDef(entry);
    if ((entry.charge ?? 1000) <= 0) { world.emit('note', { text: 'This staff needs recharging.' }); return false; }
    a.act = { kind: 'cast', hand, spell: d.staff, t: 0, cost: 0, conc: SPELLS[d.staff].kind === 'conc', staff: entry };
    return true;
}

/** The player released the cast button (fire-and-forget spells go off now if charged). */
export function releaseCast(world, a, hand) {
    const act = a.act;
    if (act.kind !== 'cast' || act.hand !== hand) return;
    if (act.conc) { a.act = { kind: 'idle', t: 0 }; world.emit('castEnd', { actor: a }); return; }
    if (act.t >= CAST_CHARGE && !act.fired) fireSpell(world, a, act);
    a.act = { kind: 'idle', t: 0 };
    world.emit('castEnd', { actor: a });
}

function payCast(world, a, act) {
    if (act.staff) { act.staff.charge = Math.max(0, (act.staff.charge ?? 1000) - 40); return true; }
    if (a.mp < act.cost) return false;
    a.mp -= act.cost;
    if (a.sheet) world.skillUse(a, SPELLS[act.spell].school, act.cost * 0.06 + 0.5);
    return true;
}

function fireSpell(world, a, act) {
    const sp = SPELLS[act.spell];
    if (!payCast(world, a, act)) return;
    act.fired = true;
    const dir = aimDir(world, a);
    const e = eye(a);
    const mult = spellMult(a, sp);
    switch (sp.kind) {
        case 'bolt': case 'ball': case 'target':
            world.projectiles.push({ kind: sp.kind, spell: act.spell, elem: sp.elem || 'magic', pos: { x: e.x + dir.x * 0.7, y: e.y + dir.y * 0.7 - 0.1, z: e.z + dir.z * 0.7 }, vel: { x: dir.x * sp.speed, y: dir.y * sp.speed, z: dir.z * sp.speed }, grav: 0, owner: a.id, dmg: (sp.dmg || 0) * mult, radius: sp.radius || 0, life: 4, r: 0.25 });
            break;
        case 'self':
            if (sp.heal) heal(a, 'hp', sp.heal * mult);
            if (sp.armor) addEffect(world, a, { id: 'armorSpell', mag: sp.armor * (a.sheet?.perks.alt_armor && !a.equip.body ? 2 : 1), dur: sp.dur * (a.sheet?.perks.alt_stability ? 1.5 : 1) }, a);
            if (sp.light) addEffect(world, a, { id: 'light', mag: 1, dur: sp.light }, a);
            if (sp.effects) for (const ef of sp.effects) addEffect(world, a, ef, a);
            break;
        case 'summon': world.summon(a, sp.summon, sp.dur); break;
        case 'bound': world.bindWeapon(a, sp.weapon, sp.dur, act.hand); break;
        case 'rune': {
            const p = world.aimPoint(a, 12);
            world.runes.push({ x: p.x, y: p.y, z: p.z, owner: a.id, dmg: sp.dmg * mult, elem: sp.elem, radius: sp.radius, t: 0 });
            break;
        }
    }
    world.emit('cast', { actor: a, spell: act.spell, hand: act.hand, dir });
}

function spellMult(a, sp) {
    let m = 1;
    if (a.sheet) {
        if (sp.elem && sp.elem !== 'sun' && a.sheet.perks.de_aug) m *= 1.25;
        if (sp.heal && a.sheet.perks.re_regen) m *= 1.5;
    } else m *= 1 + a.level * 0.025;
    return m;
}

function concTick(world, a, act, dt) {
    const sp = SPELLS[act.spell];
    const cost = act.cost * dt;
    if (!act.staff && a.mp < cost) { a.act = { kind: 'idle', t: 0 }; world.emit('castEnd', { actor: a }); if (a.kind === 'player') world.emit('nomana', {}); return; }
    if (!act.staff) a.mp -= cost;
    else act.staff.charge = Math.max(0, (act.staff.charge ?? 1000) - 8 * dt);
    const mult = spellMult(a, sp);
    if (a.sheet) world.skillUse(a, sp.school, act.cost * 0.04 * dt + 0.06 * dt);
    if (sp.kind === 'heal') { heal(a, 'hp', sp.heal * mult * dt); if (a.sheet?.perks.re_respite) heal(a, 'sp', sp.heal * mult * dt * 0.5); return; }
    if (sp.kind === 'ward') { if (!a.effects.some((x) => x.id === 'ward')) addEffect(world, a, { id: 'ward', mag: sp.ward, dur: 0.3 }, a); else a.effects.find((x) => x.id === 'ward').t = 0.3; return; }
    // a stream: everything in a narrow cone in front
    const dir = aimDir(world, a);
    const e = eye(a);
    for (const t of world.actors) {
        if (t === a || t.dead) continue;
        if (sp.ally ? world.hostile(a, t) : (!world.hostile(a, t) && a.kind !== 'player')) continue;
        const dx = t.pos.x - e.x, dy = (t.pos.y + t.h * 0.5) - e.y, dz = t.pos.z - e.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > (sp.range || 6) + t.r) continue;
        const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / (d || 1);
        if (cos < 0.88 - Math.min(0.3, t.r / Math.max(d, 1))) continue;
        if (sp.heal) heal(t, 'hp', sp.heal * mult * dt);
        else applyDamage(world, t, { amount: sp.dmg * mult * dt, type: sp.elem, source: a, quiet: true, dot: true });
        if (!sp.heal && world.rng.chance(dt * 2)) world.emit('hit', { target: t, source: a, dmg: sp.dmg * mult * 0.5, type: sp.elem, pos: { x: t.pos.x, y: t.pos.y + t.h * 0.6, z: t.pos.z } });
    }
}

// ------------------------------------------------------------------ Storm Sigils
/** Begin tracing a sigil. The player holds to trace more rings (as charge allows); NPCs trace a fixed number. */
export function startSigil(world, a, rings = null) {
    if (busy(a) || a.dead) return false;
    if (a.storm) {
        const st = a.storm, id = st.equipped;
        if (!id) return false;
        const max = sigilPower(st, id);
        if (!max) return false;
        if (st.charge < SIGILS[id].cost[0] * (a.sigilCostMult || 1)) { world.emit('nocharge', { actor: a }); return false; }
        a.act = { kind: 'sigil', t: 0, sigil: id, rings: 1, max, release: rings != null, charging: rings == null };
        if (rings) a.act.rings = Math.min(max, rings);
        world.emit('sigilStart', { actor: a, sigil: id });
        return true;
    }
    if (!a.npcSigil) return false;
    a.act = { kind: 'sigil', t: 0, sigil: a.npcSigil, rings: a.npcRings || 2, max: 3, release: true, charging: false };
    world.emit('sigilStart', { actor: a, sigil: a.npcSigil });
    return true;
}

export function releaseSigil(world, a) {
    if (a.act.kind === 'sigil' && a.act.charging) { a.act.charging = false; a.act.release = true; a.act.t = 0; }
}

/** The most rings the player can afford right now. */
function affordable(a, id, want) {
    const c = SIGILS[id].cost, m = a.sigilCostMult || 1;
    let n = want;
    while (n > 1 && a.storm.charge < c[n - 1] * m) n--;
    return n;
}

function doSigil(world, a, sigilId, rings) {
    const sg = SIGILS[sigilId];
    const dir = aimDir(world, a);
    const e = eye(a);
    if (a.storm) {
        rings = affordable(a, sigilId, rings);
        a.storm.charge = Math.max(0, a.storm.charge - sg.cost[rings - 1] * (a.sigilCostMult || 1));
    }
    world.emit('sigil', { actor: a, sigil: sigilId, rings, dir, pos: e });
    const cone = (range, cosMin, fn) => {
        for (const t of world.actors) {
            if (t === a || t.dead) continue;
            if (a.kind !== 'player' && !world.hostile(a, t)) continue;
            if (a.kind === 'player' && t.follower) continue;
            const dx = t.pos.x - e.x, dy = (t.pos.y + t.h * 0.5) - e.y, dz = t.pos.z - e.z;
            const d = Math.hypot(dx, dy, dz);
            if (d > range + t.r) continue;
            if ((dx * dir.x + dy * dir.y + dz * dir.z) / (d || 1) < cosMin) continue;
            fn(t, d, dx / (d || 1), dz / (d || 1));
        }
    };
    switch (sigilId) {
        case 'gale': {
            const range = [6, 9, 13][rings - 1];
            cone(range, 0.72, (t, d, nx, nz) => {
                const k = [7, 11, 18][rings - 1] * (1 - d / (range + 2));
                if (t.rig !== 'dragon') { t.vel.x += nx * k; t.vel.z += nz * k; t.vel.y += rings === 3 ? 5 : 2; }
                applyDamage(world, t, { amount: [0, 8, 30][rings - 1] + 1, type: 'phys', source: a, knock: rings >= 2 && t.rig !== 'dragon', stagger: true });
            });
            break;
        }
        case 'stride': {
            const dist = [7, 13, 20][rings - 1];
            a.dash = { t: 0.32, vx: dir.x / (Math.hypot(dir.x, dir.z) || 1) * dist / 0.32, vz: dir.z / (Math.hypot(dir.x, dir.z) || 1) * dist / 0.32 };
            break;
        }
        case 'embers': case 'rime': {
            const dmg = (sigilId === 'embers' ? [20, 40, 70] : [15, 30, 50])[rings - 1];
            const type = sigilId === 'embers' ? 'fire' : 'frost';
            cone(10 + rings * 2, 0.8, (t) => applyDamage(world, t, { amount: dmg, type, source: a }));
            break;
        }
        case 'earthbind': {
            const dur = [8, 12, 15][rings - 1];
            cone(80, 0.85, (t) => { if (t.rig === 'dragon') { t.grounded = dur; world.emit('earthbind', { dragon: t }); } });
            break;
        }
        case 'stillness': world.slowTime = [8, 12, 16][rings - 1]; world.slowScale = [0.7, 0.5, 0.3][rings - 1]; break;
        case 'veil': addEffect(world, a, { id: 'ethereal', mag: 1, dur: [8, 13, 18][rings - 1] }, a); break;
    }
}

// ------------------------------------------------------------------ per-tick
export function updateAct(world, a, dt) {
    const act = a.act;
    if (a.storm && a.storm.charge < a.storm.chargeMax) a.storm.charge = Math.min(a.storm.chargeMax, a.storm.charge + dt * (a.stormRegen || 0.8));
    if (a.dash) {
        a.dash.t -= dt;
        a.vel.x = a.dash.vx; a.vel.z = a.dash.vz;
        if (a.dash.t <= 0) a.dash = null;
    }
    if (act.kind === 'idle' || act.kind === 'ready') return;
    act.t += dt;
    switch (act.kind) {
        case 'attack': case 'bash':
            if (act.phase === 'wind' && act.t >= act.wind) { act.phase = 'strike'; act.t = 0; meleeStrike(world, a); }
            else if (act.phase === 'strike' && act.t >= act.strike) { act.phase = 'recover'; act.t = 0; }
            else if (act.phase === 'recover' && act.t >= act.recover) a.act = { kind: 'idle', t: 0 };
            break;
        case 'draw':
            if (act.t > act.full + 3 && a.sheet) { a.sp = Math.max(0, a.sp - 6 * dt); }   // holding a full draw tires the arms
            break;
        case 'cast':
            if (act.conc) concTick(world, a, act, dt);
            else if (act.t >= CAST_CHARGE && a.kind !== 'player' && !act.fired) { fireSpell(world, a, act); a.act = { kind: 'idle', t: -0.3 }; world.emit('castEnd', { actor: a }); }
            break;
        case 'sigil':
            if (act.charging) {
                act.rings = Math.min(act.max, act.t < 0.45 ? 1 : act.t < 1.0 ? 2 : 3);
                if (a.storm) act.rings = affordable(a, act.sigil, act.rings);
                if (act.t > 1.6) { act.charging = false; act.release = true; act.t = 0; }
            } else if (act.release && act.t >= 0.15 + act.rings * 0.1) {
                doSigil(world, a, act.sigil, act.rings);
                a.act = { kind: 'recover', t: 0, dur: 0.5 };
            }
            break;
        case 'stagger': case 'knock': case 'recover': case 'use':
            if (act.push && act.t < 0.05) { a.vel.x = act.push.x; a.vel.y = act.push.y; a.vel.z = act.push.z; a.onGround = false; act.push = null; }
            if (act.t >= (act.dur || 0.6)) { a.act = { kind: 'idle', t: 0 }; if (a.bleedout) a.bleedout = 0; }
            break;
    }
}

// ------------------------------------------------------------------ projectiles
function segPointDist2(ax, ay, az, bx, by, bz, px, py, pz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const l2 = dx * dx + dy * dy + dz * dz || 1e-9;
    let t = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py, qz = az + dz * t - pz;
    return [qx * qx + qy * qy + qz * qz, t];
}

export function updateProjectiles(world, dt) {
    const P = world.projectiles;
    for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        const ox = p.pos.x, oy = p.pos.y, oz = p.pos.z;
        p.vel.y -= p.grav * dt;
        p.pos.x += p.vel.x * dt; p.pos.y += p.vel.y * dt; p.pos.z += p.vel.z * dt;
        p.life -= dt;
        let hit = null, hitT = 2;
        for (const t of world.actors) {
            if (t.dead || t.id === p.owner) continue;
            const owner = world.byId(p.owner);
            if (owner && owner.kind !== 'player' && !world.hostile(owner, t)) continue;
            if (owner?.kind === 'player' && t.follower && p.kind !== 'target') continue;
            const cx = t.pos.x, cz = t.pos.z;
            const reach = t.r + p.r + 0.15 + Math.hypot(p.pos.x - ox, p.pos.z - oz);
            if (Math.abs(cx - p.pos.x) > reach + 2 || Math.abs(cz - p.pos.z) > reach + 2) continue;
            // sample the body as three spheres up its height
            for (let k = 0; k < 3; k++) {
                const cy = t.pos.y + t.h * (0.2 + k * 0.32);
                const [d2, tt] = segPointDist2(ox, oy, oz, p.pos.x, p.pos.y, p.pos.z, cx, cy, cz);
                const rr = t.r + p.r + 0.12;
                if (d2 < rr * rr && tt < hitT) { hit = t; hitT = tt; }
            }
        }
        let wall = false;
        if (!hit) {
            const g = world.space.ground(p.pos.x, p.pos.z, p.pos.y + 1);
            if (p.pos.y <= g) wall = true;
            else if (world.space.colliders.raycast(ox, oy, oz, p.pos.x, p.pos.y, p.pos.z) >= 0) wall = true;
            else if (world.space.blockedRay && world.space.blockedRay(ox, oy, oz, p.pos.x, p.pos.y, p.pos.z)) wall = true;
        }
        if (hit) projectileHit(world, p, hit);
        else if (wall) projectileHit(world, p, null);
        if (hit || wall || p.life <= 0) { P.splice(i, 1); continue; }
    }
    // runes go off when an enemy steps near
    for (let i = world.runes.length - 1; i >= 0; i--) {
        const r = world.runes[i];
        r.t += dt;
        const owner = world.byId(r.owner);
        for (const t of world.actors) {
            if (t.dead || t.id === r.owner || (owner && !world.hostile(owner, t) && owner.kind !== 'player') || t.follower || t.kind === 'player') continue;
            if (Math.hypot(t.pos.x - r.x, t.pos.z - r.z) < r.radius * 0.6) {
                explode(world, { x: r.x, y: r.y + 0.5, z: r.z }, r.radius, r.dmg, r.elem, owner);
                world.runes.splice(i, 1);
                break;
            }
        }
        if (r.t > 600) world.runes.splice(i, 1);
    }
}

function explode(world, pos, radius, dmg, elem, owner) {
    world.emit('explode', { pos, radius, elem });
    for (const t of world.actors) {
        if (t.dead || t === owner) continue;
        if (owner && owner.kind !== 'player' && !world.hostile(owner, t)) continue;
        if (owner?.kind === 'player' && t.follower) continue;
        const d = Math.hypot(t.pos.x - pos.x, t.pos.y + t.h * 0.5 - pos.y, t.pos.z - pos.z);
        if (d < radius + t.r) applyDamage(world, t, { amount: dmg * (1 - 0.5 * d / (radius + t.r)), type: elem, source: owner, stagger: owner?.sheet?.perks.de_impact });
    }
}

function projectileHit(world, p, t) {
    const owner = world.byId(p.owner);
    world.emit('projectileHit', { kind: p.kind, spell: p.spell, elem: p.elem, pos: { ...p.pos }, target: t, ammo: p.ammo, vel: { ...p.vel } });
    if (p.kind === 'arrow') {
        if (!t) return;
        let dmg = p.dmg;
        let sneak = false;
        if (p.sneak && owner?.sheet && !t.ai?.target && t.detect < 1) { sneak = true; dmg *= owner.sheet.perks.sn_aim ? 3 : 2; world.skillUse(owner, 'sneak', 2.5); }
        const head = p.pos.y > t.pos.y + t.h * 0.85;
        if (head && t.rig === 'humanoid') dmg *= 1.25;
        applyDamage(world, t, { amount: dmg, type: 'phys', source: owner, arrow: true, sneak, stagger: p.power });
        if (owner?.sheet) world.skillUse(owner, 'archery', 1 + dmg * 0.06);
        if (world.rng.chance(0.5) && p.ammo) t.inv.push({ id: p.ammo, n: 1 });
        return;
    }
    const sp = SPELLS[p.spell];
    if (p.kind === 'ball') { explode(world, p.pos, p.radius, p.dmg, p.elem, owner); return; }
    if (!t) return;
    if (p.kind === 'bolt') {
        if (sp?.undeadOnly && !t.undead) return;
        applyDamage(world, t, { amount: p.dmg, type: p.elem === 'sun' ? 'sun' : p.elem, source: owner, stagger: owner?.sheet?.perks.de_impact });
    } else if (p.kind === 'target' && sp?.effects) {
        for (const ef of sp.effects) {
            const ok = addEffect(world, t, ef, owner);
            if (ok && (ef.id === 'frenzy' || ef.id === 'fear' || ef.id === 'calm')) world.emit('illusion', { target: t, effect: ef.id });
        }
    }
}

// ------------------------------------------------------------------ dragon breath (also used by the dragon AI)
export function breathCone(world, a, dir, origin, range, cosMin, dmg, elem, dt) {
    for (const t of world.actors) {
        if (t === a || t.dead || !world.hostile(a, t)) continue;
        const dx = t.pos.x - origin.x, dy = (t.pos.y + t.h * 0.5) - origin.y, dz = t.pos.z - origin.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > range) continue;
        if ((dx * dir.x + dy * dir.y + dz * dir.z) / (d || 1) < cosMin) continue;
        applyDamage(world, t, { amount: dmg * dt, type: elem, source: a, quiet: true, dot: true });
        if (world.rng.chance(dt * 3)) world.emit('hit', { target: t, source: a, dmg: dmg * 0.3, type: elem, pos: { x: t.pos.x, y: t.pos.y + 1, z: t.pos.z } });
    }
}

export { countItem };
