/**
 * actor.js — live actors: creation, derived stats, active effects, damage, healing and death.
 */
import { TEMPLATES, NPC, resolveGear, ESSENCE_TIER } from './actors.js';
import { ITEMS, itemDef, armorRating, weaponDamage } from './items.js';
import { EFFECTS } from './effects.js';
import { addItem, autoEquip, carryWeight } from './inventory.js';
import { rollLoot } from './loot.js';
import { KIN, TOTEMS, addSkillXp } from './stats.js';
import { DIFFICULTY } from './rules.js';

let NEXT_ID = 1;
export function resetIds(n = 1) { NEXT_ID = n; }

export function emptyEquip() { return { right: null, left: null, ammo: null, head: null, body: null, hands: null, feet: null, ring: null, amulet: null }; }

export function baseActor(kind) {
    return {
        id: `a${NEXT_ID++}`, kind, name: '', tpl: null, faction: 'town', rig: 'humanoid', body: 'human', scale: 1, color: 0x888888,
        pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, r: 0.38, h: 1.8, yaw: 0, onGround: true, swim: false, wade: false,
        level: 1, hp: 50, hpMax: 50, mp: 0, mpMax: 0, sp: 50, spMax: 50, spDelay: 0,
        inv: [], equip: emptyEquip(), gold: 0, spells: [], hands: { right: null, left: null },
        act: { kind: 'idle', t: 0 }, blocking: false, sneaking: false, sprinting: false, moving: 0,
        effects: [], stats: { armor: 0, resist: { fire: 0, frost: 0, shock: 0, poison: 0, magic: 0 }, dmgMult: 1, speedMul: 1 }, dirty: true,
        ai: null, dead: false, deadT: 0, cell: 'ext', essential: false, unique: false, hostileTo: null,
        detect: 0, alarm: 0, stagger: 0, lastHitBy: null, combatT: 0, bleedout: 0,
    };
}

/** Make an actor from a template id at a level (clamped to the template's band). */
export function createActor(tplId, opts = {}) {
    const T = TEMPLATES[tplId];
    if (!T) throw new Error(`no template ${tplId}`);
    const a = baseActor(T.rig === 'dragon' ? 'dragon' : T.rig === 'humanoid' ? 'npc' : 'creature');
    const rng = opts.rng;
    const lvl = Math.max(T.lvl[0], Math.min(T.lvl[1], opts.level ?? T.lvl[0]));
    const k = 1 + (lvl - T.lvl[0]) * 0.1;
    Object.assign(a, {
        tpl: tplId, name: opts.name || T.name, faction: opts.faction || T.faction, rig: T.rig, body: T.body, scale: (T.scale || 1) * (opts.scale || 1),
        color: T.color, level: lvl, unique: !!T.unique, essential: !!(T.essential || opts.essential), boss: !!T.boss, undead: !!T.undead,
    });
    a.baseHp = Math.round(T.hp * k); a.baseMp = Math.round((T.mp || 0) * k); a.baseSp = Math.round((T.sp || 80) * k);
    a.hpMax = a.hp = a.baseHp; a.mpMax = a.mp = a.baseMp; a.spMax = a.sp = a.baseSp;
    a.r = (T.rig === 'quad' ? 0.45 : T.rig === 'spider' ? 0.55 : T.rig === 'crab' ? 0.4 : T.rig === 'dragon' ? 3.5 : 0.38) * a.scale;
    a.h = (T.rig === 'quad' ? 1.1 : T.rig === 'spider' ? 0.9 : T.rig === 'crab' ? 0.6 : T.rig === 'dragon' ? 4 : 1.8) * a.scale;
    if (T.body === 'bear' || T.body === 'mammoth' || T.body === 'horse' || T.body === 'elk') { a.r *= 1.5; a.h *= 1.3; }
    a.tdmg = Math.round((T.dmg || 6) * (1 + (lvl - T.lvl[0]) * 0.08));
    a.reach = (T.reach || 2) * (T.rig === 'humanoid' ? 1 : 1);
    a.speed = T.speed || 4.6;
    a.spells = [...(T.spells || [])];
    if (rng && T.gear) for (const g of resolveGear(T.gear, lvl, rng)) addItem(a, { id: g }, g.startsWith('arrow_') ? 20 + rng.int(0, 10) : 1);
    if (T.gear) autoEquip(a);
    a.ai = { kind: opts.ai || T.ai, state: T.sleep ? 'sleep' : 'idle', t: rng ? rng.next() * 0.3 : 0, target: null, home: { x: 0, z: 0 }, anchor: null, think: 0 };
    if (T.ghost) a.ghost = true;
    if (T.body === 'human' || T.body === 'giant') a.look = randomLook(rng, T);
    a.loot = T.loot;
    a.essence = T.essence ? ESSENCE_TIER[T.essence] : 0;
    if (T.sigil) { a.npcSigil = T.sigil; a.npcRings = T.rings || 2; }
    if (T.regen) a.regen = T.regen;
    if (T.float) a.float = true;
    recalc(a);
    a.hp = a.hpMax; a.mp = a.mpMax; a.sp = a.spMax;
    return a;
}

const HAIR_COLS = [0x2a1a10, 0x3a2a1a, 0x5a3a20, 0x6a4a2a, 0x8a6a3a, 0xa08050, 0xc8a870, 0x8a3a1a, 0x1a1414, 0x9a9690];
/** A random face and figure for generic people (bandits, guards, citizens). */
export function randomLook(rng, T = {}) {
    if (!rng) return { sex: 'm', kin: 'norrhen', hair: 1, hairCol: 0x4a3420, beard: 1, age: 0.4 };
    const kins = ['norrhen', 'norrhen', 'norrhen', 'caldaran', 'caldaran', 'orsk', 'vael', 'ashen', 'aelfen'];
    const sex = T.body === 'giant' ? 'm' : rng.chance(T.faction === 'guard' ? 0.2 : 0.4) ? 'f' : 'm';
    const age = rng.next();
    return {
        sex, kin: T.body === 'giant' ? 'norrhen' : rng.pick(kins), hair: rng.int(0, 6), hairCol: age > 0.8 ? 0x9a9690 : rng.pick(HAIR_COLS),
        beard: sex === 'm' ? rng.int(0, 4) : 0, age, build: 0.92 + rng.next() * 0.2,
    };
}

/** A named NPC from the roster, dressed and ready. */
export function createNamedNpc(id, rng, overrides = {}) {
    const n = NPC[id];
    const a = baseActor('npc');
    Object.assign(a, {
        npcId: id, name: n.name, tpl: 'citizen', faction: n.faction || (n.role === 'guard' ? 'guard' : 'town'), rig: 'humanoid', body: 'human', level: n.lvl || 5,
        essential: !!n.essential, unique: true, look: { ...n.look }, role: n.role, merchant: n.merchant || null, trains: n.trains || null, followable: !!n.followable, hire: n.hire || 0,
    });
    a.baseHp = 50 + a.level * 8; a.baseMp = 50 + (n.role === 'wizard' ? a.level * 8 : 0); a.baseSp = 60 + a.level * 6;
    a.tdmg = 6 + a.level; a.reach = 2; a.speed = 4.6;
    for (const g of n.gear || []) addItem(a, { id: g }, g.startsWith('arrow_') ? 30 : 1);
    autoEquip(a);
    if (n.role === 'wizard') a.spells = ['firebolt', 'healing', 'barkskin', n.lvl > 20 ? 'embergolem' : 'spiritwolf'];
    if (n.role === 'elder') { a.npcSigil = 'gale'; a.npcRings = 2; }
    const aiKind = n.ai || (n.role === 'companion' || n.role === 'sworn' || n.role === 'mercenary' ? 'civilian' : 'civilian');
    a.ai = { kind: aiKind, state: 'idle', t: rng ? rng.next() : 0, target: null, home: null, work: n.work || null, homeId: n.home || null, think: 0 };
    a.gold = 20 + a.level * 5;
    Object.assign(a, overrides);
    recalc(a);
    a.hp = a.hpMax; a.mp = a.mpMax; a.sp = a.spMax;
    return a;
}

// ------------------------------------------------------------------ derived stats
export function recalc(a) {
    const s = a.stats;
    s.armor = 0;
    s.resist = { fire: 0, frost: 0, shock: 0, poison: 0, magic: 0 };
    s.weak = { fire: 0, frost: 0, shock: 0 };
    s.dmgMult = 1; s.speedMul = 1; s.carry = 300; s.skillMod = {};
    s.invisible = false; s.paralyzed = false; s.slowed = false; s.hush = false; s.feared = false; s.calmed = false; s.frenzied = false; s.waterbreathing = false; s.ethereal = false;
    s.regen = { hp: 1, mp: 1, sp: 1 }; s.stealth = 0; s.spellCostMul = 1;
    let hpMax = a.baseHp, mpMax = a.baseMp, spMax = a.baseSp;
    const T = TEMPLATES[a.tpl];
    if (T?.resist) for (const [k, v] of Object.entries(T.resist)) s.resist[k] += v;
    if (T?.weak) for (const [k, v] of Object.entries(T.weak)) s.weak[k] += v;
    if (T?.armor) s.armor += T.armor;
    // player sheet
    const sh = a.sheet;
    if (sh) {
        hpMax = sh.attr.hp; mpMax = sh.attr.mp; spMax = sh.attr.sp;
        s.carry = 300 + sh.carryBonus + (sh.perks.pp_pockets ? 100 : 0);
        const kin = KIN[sh.kin];
        if (kin.resist) for (const [k, v] of Object.entries(kin.resist)) s.resist[k] += v;
        if (kin.melee) s.dmgMult += kin.melee;
        const tt = sh.totem && TOTEMS[sh.totem];
        if (tt) {
            hpMax += tt.hp || 0; mpMax += tt.mp || 0;
            if (tt.melee) s.dmgMult += tt.melee;
            if (tt.carry) s.carry += tt.carry;
            if (tt.spRegen) s.regen.sp *= 1 + tt.spRegen;
            if (tt.speed) s.speedMul *= 1 + tt.speed;
            s.stealth = tt.stealth || 0;
            s.spellCostMul = 1 - (tt.spellCost || 0);
        }
        if (sh.perks.alt_resist) s.resist.magic += 30;
    }
    // armour and enchantments from what is worn
    let heavy = 0, light = 0, pieces = 0;
    for (const slot of ['head', 'body', 'hands', 'feet', 'left', 'ring', 'amulet']) {
        const e = a.equip[slot];
        if (!e) continue;
        const d = itemDef(e);
        if (!d) continue;
        if (d.type === 'armor') {
            let r = armorRating(e);
            if (sh) {
                const skill = d.armorType === 'heavy' ? sh.skills.heavyArmor + (s.skillMod.heavyArmor || 0) : d.armorType === 'light' ? sh.skills.lightArmor : 0;
                r *= 1 + skill / 100 * 0.6;
                if (d.armorType === 'heavy' && sh.perks.ha_jugger) r *= 1.2;
                if (d.armorType === 'light' && sh.perks.la_agile) r *= 1.2;
            } else r *= 1 + a.level * 0.01;
            s.armor += r;
            if (slot !== 'left' && slot !== 'ring' && slot !== 'amulet') { pieces++; if (d.armorType === 'heavy') heavy++; if (d.armorType === 'light') light++; }
        }
        const ench = e.ench || d.ench;
        if (ench && d.type !== 'weapon') applyConstant(a, ench, s, (v) => { hpMax += v; }, (v) => { mpMax += v; }, (v) => { spMax += v; });
    }
    if (sh) {
        if (heavy === 4 && sh.perks.ha_fitted) s.armor *= 1.25;
        if (light === 4 && sh.perks.la_fit) s.armor *= 1.25;
        if (light === 4 && sh.perks.la_wind) s.regen.sp *= 1.5;
        s.fullHeavy = heavy === 4; s.fullLight = light === 4;
        s.heavyPieces = heavy; s.lightPieces = light;
        if (sh.perks.re_recovery) s.regen.mp *= 1.5;
    }
    // active effects (potions, spells, food)
    for (const ef of a.effects) {
        const E = EFFECTS[ef.id];
        if (!E) { if (ef.id === 'armorSpell') s.armor += ef.mag; if (ef.id === 'ward') s.armor += ef.mag; if (ef.id === 'ethereal') s.ethereal = true; continue; }
        if (E.kind === 'fortify') { if (E.stat === 'hpMax') hpMax += ef.mag; else if (E.stat === 'mpMax') mpMax += ef.mag; else if (E.stat === 'spMax') spMax += ef.mag; else if (E.stat === 'carry') s.carry += ef.mag; }
        else if (E.kind === 'resist') s.resist[E.stat] += ef.mag;
        else if (E.kind === 'weak') s.weak[E.stat] += ef.mag;
        else if (E.kind === 'regen') s.regen[E.stat.slice(0, 2)] *= 1 + ef.mag / 100;
        else if (E.kind === 'skill') s.skillMod[E.stat] = (s.skillMod[E.stat] || 0) + ef.mag;
        else if (E.kind === 'status') s[E.stat] = true;
    }
    if (s.slowed) s.speedMul *= 0.5;
    for (const k of Object.keys(s.resist)) s.resist[k] = Math.min(85, s.resist[k]);
    const fh = a.hp / (a.hpMax || 1), fm = a.mp / (a.mpMax || 1), fs = a.sp / (a.spMax || 1);
    a.hpMax = Math.max(1, Math.round(hpMax)); a.mpMax = Math.max(0, Math.round(mpMax)); a.spMax = Math.max(1, Math.round(spMax));
    if (a.dirtyKeepRatio) { a.hp = fh * a.hpMax; a.mp = fm * a.mpMax; a.sp = fs * a.spMax; }
    a.hp = Math.min(a.hp, a.hpMax); a.mp = Math.min(a.mp, a.mpMax); a.sp = Math.min(a.sp, a.spMax);
    if (sh) {
        a.carry = carryWeight(a);
        a.encumbered = a.carry > s.carry;
    }
    a.dirty = false;
}

function applyConstant(a, ench, s, addHp, addMp, addSp) {
    const E = EFFECTS[ench.id];
    if (!E) return;
    if (E.kind === 'fortify') { if (E.stat === 'hpMax') addHp(ench.mag); else if (E.stat === 'mpMax') addMp(ench.mag); else if (E.stat === 'spMax') addSp(ench.mag); else if (E.stat === 'carry') s.carry += ench.mag; }
    else if (E.kind === 'resist') s.resist[E.stat] += ench.mag;
    else if (E.kind === 'regen') s.regen[E.stat.slice(0, 2)] *= 1 + ench.mag / 100;
    else if (E.kind === 'skill') s.skillMod[E.stat] = (s.skillMod[E.stat] || 0) + ench.mag;
    else if (E.kind === 'status') s[E.stat] = true;
}

// ------------------------------------------------------------------ effects
/** Add a timed effect (or an instant one, applied now). Returns true if it changed anything. */
export function addEffect(world, a, ef, src = null) {
    const E = EFFECTS[ef.id];
    if (ef.id === 'armorSpell' || ef.id === 'ward' || ef.id === 'ethereal' || ef.id === 'burning' || ef.id === 'light' || ef.id === 'rested') {
        a.effects = a.effects.filter((x) => x.id !== ef.id);
        a.effects.push({ ...ef, t: ef.dur, src: src?.id || null });
        if (ef.id === 'burning') return true;
        a.dirty = true;
        return true;
    }
    if (!E) return false;
    if (E.kind === 'restore') { heal(a, E.stat, ef.mag); return true; }
    if (E.kind === 'damage') {
        if (E.stat === 'hp') applyDamage(world, a, { amount: ef.mag, type: 'poison', source: src });
        else a[E.stat] = Math.max(0, a[E.stat] - ef.mag);
        return true;
    }
    if (E.kind === 'elemental') { applyDamage(world, a, { amount: ef.mag, type: E.elem, source: src }); return true; }
    if (E.kind === 'absorb') {
        const got = Math.min(a[E.stat], ef.mag);
        if (E.stat === 'hp') applyDamage(world, a, { amount: ef.mag, type: 'magic', source: src }); else a[E.stat] -= got;
        if (src) heal(src, E.stat, got);
        return true;
    }
    if (E.undead && !a.undead) return false;
    if (E.kind === 'status' && E.hostile && ef.mag > 1 && a.level > ef.mag) return false;   // too strong to affect
    if (a.boss && (ef.id === 'paralysis' || ef.id === 'calm' || ef.id === 'fear') && ef.mag < 99) return false;
    // timed: refresh rather than stack the same effect
    const ex = a.effects.find((x) => x.id === ef.id && x.src === (src?.id || null));
    if (ex) { ex.t = Math.max(ex.t, ef.dur || 0); ex.mag = Math.max(ex.mag, ef.mag); }
    else a.effects.push({ id: ef.id, mag: ef.mag, dur: ef.dur || 0, t: ef.dur || 0, src: src?.id || null });
    a.dirty = true;
    if (ef.id === 'paralysis') { a.act = { kind: 'knock', t: 0, dur: ef.dur }; world?.emit('paralyze', { actor: a }); }
    return true;
}

export function heal(a, stat, amt) {
    const max = stat === 'hp' ? a.hpMax : stat === 'mp' ? a.mpMax : a.spMax;
    a[stat] = Math.min(max, a[stat] + amt);
}

export function tickEffects(world, a, dt) {
    let changed = false;
    for (let i = a.effects.length - 1; i >= 0; i--) {
        const ef = a.effects[i];
        const E = EFFECTS[ef.id];
        if (E?.kind === 'dot' || ef.id === 'burning') applyDamage(world, a, { amount: ef.mag * dt, type: ef.id === 'burning' ? 'fire' : 'poison', source: null, quiet: true, dot: true });
        if (ef.dur > 0) {
            ef.t -= dt;
            if (ef.t <= 0) { a.effects.splice(i, 1); changed = true; }
        }
    }
    if (changed) a.dirty = true;
    if (a.dirty) recalc(a);
}

// ------------------------------------------------------------------ damage
/**
 * info: { amount, type: phys|fire|frost|shock|poison|magic|sun, source, power, sneak, pierce, stagger, hand, weapon, quiet, dot, knock }
 * Returns the damage actually done.
 */
export function applyDamage(world, t, info) {
    if (t.dead || info.amount <= 0) return 0;
    const st = t.stats;
    if (st.ethereal || t.invulnerable) return 0;
    let dmg = info.amount;
    const src = info.source;
    // block: only against what's in front
    let blocked = false;
    if (t.blocking && src && !info.dot && (info.type === 'phys' || info.type === 'fire' || info.type === 'frost' || info.type === 'shock')) {
        const dx = src.pos.x - t.pos.x, dz = src.pos.z - t.pos.z, l = Math.hypot(dx, dz) || 1;
        const fx = -Math.sin(t.yaw), fz = -Math.cos(t.yaw);
        if ((dx * fx + dz * fz) / l > 0.25) {
            const shield = t.equip.left && itemDef(t.equip.left)?.slot === 'shield';
            const skill = t.sheet ? t.sheet.skills.block : t.level;
            let m = (shield ? 0.35 : 0.25) + skill / 200;
            if (t.sheet?.perks.bl_wall) m += 0.2;
            if (info.type !== 'phys') m = shield && t.sheet?.perks.bl_elemental ? 0.5 : shield ? 0.2 : 0;
            if (info.arrow && t.sheet?.perks.bl_deflect && shield) m = 1;
            m = Math.min(0.9, m);
            if (m > 0) {
                blocked = true;
                const absorbed = dmg * m;
                dmg -= absorbed;
                t.sp = Math.max(0, t.sp - absorbed * 0.6);
                if (t.sheet) world?.skillUse(t, 'block', 1 + absorbed * 0.1);
                if (info.power && t.sp <= 1) info.stagger = true; else if (!info.power) info.stagger = false;
            }
        }
    }
    if (info.type === 'phys') {
        const ar = st.armor * (info.pierce ? 0.75 : 1);
        dmg *= 1 - Math.min(0.8, ar * 0.0012);
        if (t.sheet && st.fullLight && t.sheet.perks.la_deft && world?.rng.chance(0.1)) dmg = 0;
    } else if (info.type === 'sun') {
        if (!t.undead) return 0;
    } else if (info.type !== 'magic') {
        const res = (st.resist[info.type] || 0) - (st.weak?.[info.type] || 0);
        dmg *= 1 - Math.max(-1, Math.min(85, res)) / 100;
        if (info.type !== 'poison') dmg *= 1 - Math.min(85, st.resist.magic) / 100;
    } else dmg *= 1 - Math.min(85, st.resist.magic) / 100;
    // difficulty
    if (world && src?.kind === 'player') dmg *= DIFFICULTY[world.difficulty].dealt;
    if (world && t.kind === 'player') dmg *= DIFFICULTY[world.difficulty].taken;
    if (t.kind === 'player' && world?.godMode) dmg = 0;
    if (dmg <= 0 && !blocked) return 0;
    t.hp -= dmg;
    if (info.type === 'frost') { t.sp = Math.max(0, t.sp - dmg); if (!info.dot && world) addEffect(world, t, { id: 'slow', mag: 1, dur: 2 }); }
    if (info.type === 'shock') t.mp = Math.max(0, t.mp - dmg * 0.5);
    if (info.type === 'fire' && !info.dot && dmg > 3) addEffect(world, t, { id: 'burning', mag: Math.max(1, dmg / 6), dur: 3 });
    if (src && src !== t) { t.lastHitBy = src.id; t.combatT = 8; if (src.kind === 'player' && world?.lawHit && !info.trap) world.lawHit(t); }
    // armour skill use when the player is struck
    if (t.sheet && info.type === 'phys' && dmg > 0 && world) {
        if (st.heavyPieces) world.skillUse(t, 'heavyArmor', 0.5 + dmg * 0.08);
        if (st.lightPieces) world.skillUse(t, 'lightArmor', 0.5 + dmg * 0.08);
    }
    if (!info.quiet && world) world.emit('hit', { target: t, source: src, dmg, dmgType: info.type, blocked, power: !!info.power, sneak: !!info.sneak, crit: !!info.crit, pos: { x: t.pos.x, y: t.pos.y + t.h * 0.65, z: t.pos.z } });
    // stagger / knockdown
    if ((info.stagger || info.knock) && !t.dead && t.hp > 0 && t.rig !== 'dragon' && !t.boss) {
        const towerOfStrength = t.sheet?.perks.ha_tower && st.fullHeavy;
        if (info.knock) t.act = { kind: 'knock', t: 0, dur: 1.6, push: info.push || null };
        else if (!towerOfStrength || world?.rng.chance(0.5)) t.act = { kind: 'stagger', t: 0, dur: 0.6 };
        t.blocking = false;
    } else if (info.knock && t.boss && t.rig !== 'dragon') t.act = { kind: 'stagger', t: 0, dur: 0.5 };
    if (world?.onDamaged) world.onDamaged(t, src, dmg, info);
    if (t.hp <= 0) {
        if (t.essential && t.kind !== 'player') { t.hp = 1; t.bleedout = 8; t.act = { kind: 'knock', t: 0, dur: 8 }; if (world) world.emit('bleedout', { actor: t }); }
        else if (world) world.kill(t, src);
        else { t.dead = true; t.hp = 0; }
    }
    return dmg;
}

/** Turn a dead actor's belongings into lootable contents (worn gear stays on the body). */
export function dropLoot(a, rng) {
    if (a.lootDone) return;
    a.lootDone = true;
    if (a.loot && rng) for (const e of rollLoot(a.loot, a.level, rng)) addItem(a, e, e.n);
}

export { weaponDamage, ITEMS };
