/**
 * game.js — the run: creation, floors, the hero's actions, the turn engine,
 * hazards, field of view, auto-explore, story beats, checkpoints and saves.
 *
 * Pure and seeded. The view never changes the run; it calls act() and the
 * UI-choice functions, then plays back run._t.ev.
 */

import { makeRng, hashSeed } from './rng.js';
import { T, TP, DIRS8, cheb } from './tiles.js';
import { WORLDS, worldOf, floorInWorld, isBossFloor, LAST_FLOOR } from './worlds.js';
import { CLASSES, SKILLS, PERKS, xpToNext } from './classes.js';
import { SPECIES, makeMonster } from './monsters.js';
import { makeGear, makeConsumable, makeRelic, rollItem, isGear, stackable, CONSUMABLES } from './items.js';
import { buildLevel } from './dungeon.js';
import { populate } from './populate.js';
import { shadowcast, blocksSight, computeLightMap } from './fov.js';
import { distanceMap, descend, findPath, lineOfFire, cornerOk } from './path.js';
import {
    hooks, R, ev, log, pstats, attack, damage, heal, applyStatus, kill, gainXp, dropAt, actorAt, objAt, blockingObj,
    canEnter, alive, isPlayer, hostile, perk, STATUS, freeNear, tileAt, inBounds,
} from './combat.js';
import { monsterAct, finishCharge, openDoor } from './ai.js';
import { emerge } from './bosses.js';
import { acceptQuest, recheck, talk, onLeaveFloor, giveItem } from './quests.js';

export const SAVE_VERSION = 1;

// ------------------------------------------------------------------ Run

function attachTransient(run) {
    Object.defineProperty(run, '_t', { value: { ev: [], vis: null, los: null, light: null, dmap: null, threat: false, prevVis: new Set() }, enumerable: false, writable: true, configurable: true });
}

export function newRun({ seed, cls = 'warden', mode = 'lantern' }) {
    seed = (seed >>> 0) || 1;
    const C = CLASSES[cls];
    const run = {
        v: SAVE_VERSION, seed, mode, cls, rng: { s: hashSeed(seed, 99) }, nextId: 1,
        floor: 0, turn: 0, clock: 0,
        p: {
            id: 0, name: 'You', x: 0, y: 0, cls, lvl: 1, xp: 0, hp: C.hp, base: { ...C.stats }, bonusHp: 0,
            oil: 100, oilMax: 100, gold: 0, inv: [], eq: { weapon: null, armor: null, ring: null, amulet: null },
            perks: {}, cds: {}, st: {}, embers: 0, pages: [], regenAcc: 0, secondWind: false, hush: 0, lastHit: '',
        },
        lv: null, mons: [], items: [], objs: [], hazards: [], fields: [], quests: [], log: [],
        story: [{ k: 'prologue' }, { k: 'world', w: 1 }], perkQ: 0, pending: null, dialog: null,
        over: false, dead: null, won: null, checkpoint: null,
        stats: { kills: 0, killsBy: {}, gold: 0, quests: 0, deepest: 0, potions: 0, turns: 0, deaths: 0, bosses: 0, steps: 0 },
        flags: {},
    };
    attachTransient(run);
    const rng = R(run);
    run.p.eq.weapon = makeGear(run, rng, C.gear[0], 1, 0);
    run.p.eq.armor = makeGear(run, rng, C.gear[1], 1, 0);
    run.p.inv.push(makeConsumable(run, 'heal', 2), makeConsumable(run, 'oil', 1));
    if (cls === 'witch') run.p.inv.push(makeConsumable(run, 'firebomb', 1));
    run.p.hp = pstats(run).hpMax;
    enterFloor(run, 1);
    return run;
}

export function enterFloor(run, f) {
    const w = worldOf(f);
    run.floor = f;
    run.stats.deepest = Math.max(run.stats.deepest, f);
    if (floorInWorld(f) === 1) run.checkpoint = { floor: f, p: JSON.parse(JSON.stringify(run.p)), nextId: run.nextId };
    const rng = makeRng(hashSeed(run.seed, f, 7));
    const lv = buildLevel(rng, f, w);
    run.lv = lv;
    populate(run, lv, rng);
    run.p.x = lv.start.x; run.p.y = lv.start.y;
    run.p.secondWind = false;
    run.flags.dark = false;
    run.clock = 0;
    if (f > 1 && floorInWorld(f) === 1) run.story.push({ k: 'world', w });
    if (isBossFloor(f)) run.story.push({ k: 'warden', w });
    refresh(run);
    run._t.prevVis = new Set();
    updateFov(run);
    run._t.threat = false;
    log(run, isBossFloor(f) ? `Floor ${f} — ${WORLDS[w].warden.title}.` : `Floor ${f} — ${WORLDS[w].name}.`, 'floor');
    ev(run, { t: 'floor', floor: f });
}

/** Rebuild everything transient (after a load or a floor change). */
export function refresh(run) {
    if (!run._t) attachTransient(run);
    const n = run.lv.w * run.lv.h;
    run._t.vis = new Uint8Array(n);
    run._t.los = new Uint8Array(n);
    run._t.light = computeLightMap(run.lv);
    computeDmap(run);
    updateFov(run);
}

// ------------------------------------------------------------------ Blocking state

/** Why the hero can't act right now (the UI must resolve it first), or null. */
export function blocker(run) {
    if (run.over) return 'over';
    if (run.story.length) return 'story';
    if (run.pending) return 'perk';
    if (run.dialog) return 'dialog';
    if (run.perkQ > 0) { offerPerks(run); return 'perk'; }
    return null;
}

export function storyNext(run) {
    const s = run.story.shift();
    if (s && s.k === 'ending') run.story.unshift(s); // the ending waits for chooseEnding()
}

export function chooseEnding(run, id) {
    if (id === 'dawn' && distinctPages(run) < 10) return false;
    run.story = [];
    run.won = id;
    run.over = true;
    ev(run, { t: 'won', id });
    return true;
}
export const distinctPages = (run) => new Set(run.p.pages).size;

// ------------------------------------------------------------------ Perks

export function offerPerks(run) {
    if (run.pending || run.perkQ <= 0) return;
    const rng = R(run);
    const p = run.p;
    const pool = Object.keys(PERKS).filter((k) => (p.perks[k] || 0) < PERKS[k].max && (!PERKS[k].cls || PERKS[k].cls === p.cls));
    rng.shuffle(pool);
    // At least one class perk when one is available — they are the interesting ones.
    const cls = pool.filter((k) => PERKS[k].cls);
    const opts = pool.filter((k) => !PERKS[k].cls).slice(0, 2);
    if (cls.length) opts.push(cls[0]); else if (pool[2]) opts.push(pool.filter((k) => !opts.includes(k))[0]);
    run.pending = { k: 'perk', opts: opts.filter(Boolean) };
}

export function choosePerk(run, id) {
    if (!run.pending || !run.pending.opts.includes(id)) return false;
    const before = pstats(run).hpMax;
    run.p.perks[id] = (run.p.perks[id] || 0) + 1;
    const after = pstats(run).hpMax;
    if (after > before) run.p.hp += after - before;
    run.pending = null;
    run.perkQ--;
    log(run, `Perk: ${PERKS[id].n}.`, 'good');
    for (const s of CLASSES[run.p.cls].skills) if (SKILLS[s].lvl === run.p.lvl) log(run, `New skill: ${SKILLS[s].n}!`, 'good');
    if (run.perkQ > 0) offerPerks(run);
    return true;
}

hooks.onLevelUp = (run) => { /* perks are offered when blocker() is next consulted */ };

// ------------------------------------------------------------------ Acting

const FREE = -1;

/** The hero's action. Returns true if it was accepted. */
export function act(run, a) {
    if (blocker(run)) return false;
    const p = run.p;
    let cost = 0;
    switch (a.t) {
        case 'move': cost = doMove(run, a.dx, a.dy); break;
        case 'wait': cost = 100; search(run, 2, 0.6); break;
        case 'fire': cost = doFire(run, a.id); break;
        case 'skill': cost = doSkill(run, a); break;
        case 'use': cost = doUse(run, a); break;
        case 'equip': cost = doEquip(run, a.id); break;
        case 'unequip': cost = doUnequip(run, a.slot); break;
        case 'drop': cost = doDrop(run, a.id); break;
        case 'pickup': cost = pickup(run, true) ? FREE : 0; break;
        case 'descend': return doDescend(run);
        default: return false;
    }
    if (cost === 0) return false;
    if (cost === FREE) return true;
    if (p.st.haste) cost = Math.round(cost / 2);
    endTurn(run, cost);
    // Frozen or stunned: the world moves on without you.
    for (let g = 0; g < 8 && !run.over && (p.st.frozen || p.st.stun); g++) {
        log(run, p.st.frozen ? 'You are frozen solid!' : 'You are stunned!', 'bad');
        endTurn(run, 100);
    }
    return true;
}

function doMove(run, dx, dy) {
    const p = run.p;
    const x = p.x + dx, y = p.y + dy;
    if (!inBounds(run, x, y) || (dx === 0 && dy === 0)) return 0;
    if (!cornerOk(run.lv, p.x, p.y, dx, dy)) return 0;
    const m = actorAt(run, x, y);
    if (m && hostile(p, m)) {
        attack(run, p, m, { kind: 'phys' });
        return 100;
    }
    if (m && m.ally) {
        if (p.st.root) return 0;
        ev(run, { t: 'move', id: m.id, fx: m.x, fy: m.y, x: p.x, y: p.y });
        m.x = p.x; m.y = p.y;
        stepTo(run, x, y);
        return 100;
    }
    const o = objAt(run, x, y);
    if (o && blockingObj(o)) return interact(run, o);
    const t = tileAt(run, x, y);
    if (t === T.DOOR) { openDoor(run, x, y); return 100; }
    if (t === T.VAULT_DOOR) {
        const k = p.inv.findIndex((it) => it.b === 'key');
        if (inVault(run, p.x, p.y)) {
            run.lv.tiles[y * run.lv.w + x] = T.DOOR_OPEN;
            ev(run, { t: 'door', x, y, vault: true });
            log(run, 'You shoulder the vault door open from the inside.', 'info');
            return 100;
        }
        if (k < 0) { log(run, 'A sealed vault door. It needs a key from this floor.', 'info'); return 0; }
        consume(run, p.inv[k]);
        run.lv.tiles[y * run.lv.w + x] = T.DOOR_OPEN;
        ev(run, { t: 'door', x, y, vault: true });
        log(run, 'The vault door grinds open.', 'good');
        refreshFovSoon(run);
        return 100;
    }
    if (!canEnter(run, p, x, y)) {
        if (t === T.DEEP) log(run, 'The water is too deep to wade.', 'info');
        else if (t === T.LAVA) log(run, 'Lava. Absolutely not.', 'info');
        else if (t === T.CHASM) log(run, 'A chasm drops away into the dark.', 'info');
        return 0;
    }
    if (p.st.root) { log(run, 'You are rooted to the spot!', 'bad'); return 100; }
    stepTo(run, x, y);
    return 100;
}

function stepTo(run, x, y) {
    const p = run.p;
    ev(run, { t: 'move', id: 0, fx: p.x, fy: p.y, x, y });
    p.x = x; p.y = y;
    run.stats.steps++;
    const t = tileAt(run, x, y);
    if (t === T.SHALLOW && p.st.burn) { delete p.st.burn; log(run, 'The water puts out the flames.', 'good'); }
    pickup(run, false);
    const trap = run.objs.find((o) => o.k === 'trap' && !o.gone && o.x === x && o.y === y);
    if (trap && !trap.hidden && R(run).chance(Math.min(0.9, 0.5 + pstats(run).agi * 0.03))) log(run, 'You step carefully over the trap.', 'good');
    else if (trap) triggerTrap(run, trap);
    if (t === T.STAIRS_DOWN) log(run, 'Stairs lead down into the dark.', 'info');
}

function interact(run, o) {
    const p = run.p;
    const rng = R(run);
    switch (o.k) {
        case 'chest': {
            o.open = true;
            ev(run, { t: 'chest', id: o.id });
            const f = run.floor;
            const gold = Math.round(rng.int(8, 20) * (1 + f * 0.12) * (1 + o.tier) * (1 + pstats(run).gold / 100));
            p.gold += gold; run.stats.gold += gold;
            ev(run, { t: 'gold', n: gold });
            const n = (o.tier ? 2 : 1) + (rng.chance(0.3 + perk(run, 'gold') * 0.2) ? 1 : 0);
            const got = [];
            for (let k = 0; k < n; k++) {
                const it = rollItem(run, rng, f + o.tier, k === 0 ? 'gear' : undefined, o.tier ? 1 : 0.3);
                giveItem(run, it);
                got.push(it.name);
            }
            log(run, `The chest holds ${gold} gold and ${got.join(', ')}.`, 'loot');
            return 100;
        }
        case 'brazier': {
            if (o.lit) { log(run, 'The brazier crackles warmly.', 'info'); return 0; }
            o.lit = true;
            const l = run.lv.lights.find((l) => l.obj === o.id);
            if (l) l.on = true;
            run._t.light = computeLightMap(run.lv);
            ev(run, { t: 'light', id: o.id });
            log(run, 'You light the brazier. The dark draws back.', 'good');
            if (o.questUnlit) recheck(run);
            p.oil = Math.min(p.oilMax, p.oil + 5);
            return 100;
        }
        case 'shrine': {
            if (o.used) { log(run, 'The shrine is silent.', 'info'); return 0; }
            o.used = true;
            pray(run);
            ev(run, { t: 'shrine', id: o.id });
            return 100;
        }
        case 'fountain': {
            if (o.used) { log(run, 'The fountain has run dry.', 'info'); return 0; }
            o.used = true;
            heal(run, p, pstats(run).hpMax * 0.5);
            for (const s of ['poison', 'burn', 'bleed', 'weak']) delete p.st[s];
            log(run, 'You drink from the fountain. Cold, clean, and somehow warm.', 'good');
            ev(run, { t: 'fountain', id: o.id });
            return 100;
        }
        case 'merchant': run.dialog = { k: 'shop', obj: o.id, name: o.name }; return FREE;
        case 'npc': run.dialog = talk(run, o); return FREE;
        case 'captive': {
            o.gone = true;
            const m = makeMonster(run, 'captive', o.x, o.y, run.floor, rng);
            m.ally = true; m.awake = true; m.name = o.name; m.quest = o.quest;
            m.hpMax = m.hp = Math.round(m.hpMax * 1.2);
            run.mons.push(m);
            ev(run, { t: 'spawn', id: m.id, freed: true });
            log(run, `You free ${o.name}! "Lead the way — I'm right behind you."`, 'quest');
            return 100;
        }
    }
    return 0;
}

function pray(run) {
    const p = run.p;
    const rng = R(run);
    const r = rng.next();
    if (r < 0.24) { heal(run, p, 9999); for (const s of ['poison', 'burn', 'bleed', 'weak']) delete p.st[s]; log(run, 'Warmth fills you. You are whole.', 'good'); }
    else if (r < 0.44) { const n = 5 + Math.round(run.floor / 4); p.bonusHp += n; p.hp += n; log(run, `The shrine blesses you: +${n} max health.`, 'good'); }
    else if (r < 0.6) { const k = rng.pick(['might', 'agi', 'will']); p.base[k] += 1; log(run, `The shrine blesses you: +1 ${k === 'agi' ? 'Agility' : k === 'will' ? 'Will' : 'Might'}.`, 'good'); }
    else if (r < 0.74) { gainXp(run, Math.round(xpToNext(p.lvl) * 0.4)); log(run, 'Visions of the Deep fill your head. You understand a little more.', 'good'); }
    else if (r < 0.86) { p.oil = p.oilMax; log(run, 'Your lantern flares and fills to the brim.', 'good'); }
    else if (r < 0.93) { revealMap(run); log(run, 'The shrine shows you the shape of this floor.', 'good'); }
    else {
        applyStatus(run, p, 'weak', 20);
        for (let k = 0; k < 2; k++) {
            const c = freeNear(run, p.x, p.y, null, 3);
            if (!c) break;
            const sp = R(run).pick(WORLDS[run.lv.world].bestiary.filter((s) => SPECIES[s].a !== 'ambusher'));
            const m = makeMonster(run, sp, c[0], c[1], run.floor, rng);
            m.awake = true; run.mons.push(m); ev(run, { t: 'spawn', id: m.id });
        }
        log(run, 'The shrine is not a kind one. Something answers your prayer.', 'bad');
    }
}

function doFire(run, id) {
    const p = run.p;
    const s = pstats(run);
    if (s.range <= 1) { log(run, 'You have no ranged weapon.', 'info'); return 0; }
    const m = run.mons.find((o) => o.id === id && alive(o));
    if (!m || !canTarget(run, m, s.range)) return 0;
    ev(run, { t: 'shot', id: 0, fx: p.x, fy: p.y, x: m.x, y: m.y, kind: s.style === 'magic' ? 'ember' : 'arrow' });
    attack(run, p, m, { ranged: true, kind: s.style === 'magic' ? 'magic' : 'phys' });
    return 100;
}

/** A hostile the hero can see, within range, with a clear line of fire. */
export function canTarget(run, m, range) {
    const p = run.p;
    if (!alive(m) || m.ally || m.dormant) return false;
    if (!run._t.vis[m.y * run.lv.w + m.x]) return false;
    if (cheb(p.x, p.y, m.x, m.y) > range) return false;
    return lineOfFire(run.lv, p.x, p.y, m.x, m.y, (x, y) => { const a = actorAt(run, x, y); return a && a !== m && !isPlayer(a); });
}

export function visibleHostiles(run) {
    return run.mons.filter((m) => alive(m) && !m.ally && !m.dormant && run._t.vis[m.y * run.lv.w + m.x]);
}

// ------------------------------------------------------------------ Skills

export function skillState(run, id) {
    const S = SKILLS[id];
    const unlocked = run.p.lvl >= S.lvl;
    return { unlocked, cd: run.p.cds[id] || 0, ready: unlocked && !(run.p.cds[id] > 0) };
}

function cooldown(run, id) {
    let cd = SKILLS[id].cd - pstats(run).cdr;
    if (perk(run, 'shieldwall') && (id === 'bulwark' || id === 'bash')) cd -= 3;
    if (perk(run, 'shadowstep') && id === 'tumble') cd -= 3;
    run.p.cds[id] = Math.max(1, cd);
}

function spellRoll(run, mult) {
    return pstats(run).spell * mult * R(run).range(0.85, 1.2);
}

function doSkill(run, a) {
    const id = a.s;
    const S = SKILLS[id];
    if (!S || !CLASSES[run.p.cls].skills.includes(id)) return 0;
    const st = skillState(run, id);
    if (!st.unlocked) { log(run, `${S.n} unlocks at level ${S.lvl}.`, 'info'); return 0; }
    if (!st.ready) { log(run, `${S.n} is recharging (${st.cd}).`, 'info'); return 0; }
    const p = run.p;
    const rng = R(run);
    const s = pstats(run);
    const target = a.id !== undefined ? run.mons.find((m) => m.id === a.id && alive(m)) : null;
    let cost = 100;
    switch (id) {
        case 'cleave': {
            const foes = run.mons.filter((m) => alive(m) && !m.ally && cheb(m.x, m.y, p.x, p.y) <= 1);
            if (!foes.length) { log(run, 'Nothing within reach to cleave.', 'info'); return 0; }
            ev(run, { t: 'skill', s: id, x: p.x, y: p.y });
            for (const m of foes) attack(run, p, m, { mult: 1 + perk(run, 'reaver') * 0.4, accBonus: 10 });
            if (perk(run, 'reaver')) heal(run, p, foes.length * s.hpMax * 0.02 * perk(run, 'reaver'), true);
            break;
        }
        case 'bash': {
            if (!target || cheb(target.x, target.y, p.x, p.y) > 1 || target.ally) { log(run, 'Bash needs an adjacent enemy.', 'info'); return 0; }
            ev(run, { t: 'skill', s: id, x: target.x, y: target.y });
            const d = attack(run, p, target, { mult: 0.7, accBonus: 15 });
            if (d && alive(target)) {
                applyStatus(run, target, 'stun', 2);
                const kx = target.x + Math.sign(target.x - p.x), ky = target.y + Math.sign(target.y - p.y);
                if (!target.boss && canEnter(run, target, kx, ky)) { ev(run, { t: 'move', id: target.id, fx: target.x, fy: target.y, x: kx, y: ky, knock: true }); target.x = kx; target.y = ky; }
            }
            break;
        }
        case 'warcry': {
            ev(run, { t: 'skill', s: id, x: p.x, y: p.y });
            for (const m of run.mons) {
                if (!alive(m) || m.ally || cheb(m.x, m.y, p.x, p.y) > 3 || !run._t.vis[m.y * run.lv.w + m.x]) continue;
                applyStatus(run, m, 'weak', 5); m.awake = true;
                if (!m.boss && rng.chance(0.5)) applyStatus(run, m, 'fear', 3);
            }
            log(run, 'You roar. The dark flinches.', 'good');
            break;
        }
        case 'bulwark': p.st.shield = { t: 4, v: 0.7 }; ev(run, { t: 'skill', s: id, x: p.x, y: p.y }); ev(run, { t: 'status', id: 0, st: 'shield' }); break;
        case 'volley': {
            const range = Math.max(6, s.range);
            const foes = visibleHostiles(run).filter((m) => canTarget(run, m, range)).sort((a, b) => cheb(a.x, a.y, p.x, p.y) - cheb(b.x, b.y, p.x, p.y)).slice(0, 3 + perk(run, 'fletcher'));
            if (!foes.length) { log(run, 'No targets in sight.', 'info'); return 0; }
            for (const m of foes) { ev(run, { t: 'shot', id: 0, fx: p.x, fy: p.y, x: m.x, y: m.y, kind: 'arrow' }); attack(run, p, m, { ranged: true, mult: 0.85 }); }
            break;
        }
        case 'pin': {
            if (!target || !canTarget(run, target, S.range)) { log(run, 'No clear shot.', 'info'); return 0; }
            ev(run, { t: 'shot', id: 0, fx: p.x, fy: p.y, x: target.x, y: target.y, kind: 'arrow', big: true });
            if (attack(run, p, target, { ranged: true, mult: 1.5, accBonus: 10 }) && alive(target)) applyStatus(run, target, 'root', 3);
            break;
        }
        case 'tumble': case 'blink': {
            const { x, y } = a;
            if (x === undefined || cheb(x, y, p.x, p.y) > S.range || !run._t.vis[y * run.lv.w + x] || !canEnter(run, p, x, y)) { log(run, 'You can\'t reach there.', 'info'); return 0; }
            if (id === 'tumble' && !lineOfFire(run.lv, p.x, p.y, x, y)) { log(run, 'Something is in the way.', 'info'); return 0; }
            ev(run, { t: 'tele', id: 0, fx: p.x, fy: p.y, x, y, leap: id === 'tumble' });
            p.x = x; p.y = y;
            if (id === 'tumble' && perk(run, 'shadowstep')) p.st.evade = { t: 3, v: 10 };
            pickup(run, false);
            cost = 50;
            break;
        }
        case 'mark': {
            if (!target || !run._t.vis[target.y * run.lv.w + target.x] || cheb(target.x, target.y, p.x, p.y) > S.range) { log(run, 'No target in sight.', 'info'); return 0; }
            applyStatus(run, target, 'mark', 8);
            for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (inBounds(run, target.x + dx, target.y + dy)) run.lv.seen[(target.y + dy) * run.lv.w + target.x + dx] = 1;
            ev(run, { t: 'skill', s: id, x: target.x, y: target.y });
            log(run, `You mark the ${target.name}.`, 'good');
            break;
        }
        case 'firebolt': {
            if (!target || !canTarget(run, target, S.range)) { log(run, 'No clear line for a firebolt.', 'info'); return 0; }
            ev(run, { t: 'shot', id: 0, fx: p.x, fy: p.y, x: target.x, y: target.y, kind: 'fire', big: true });
            const pyro = perk(run, 'pyro');
            damage(run, target, spellRoll(run, 1.0 + pyro * 0.2) - rng.int(0, target.arm >> 1), { src: p, kind: 'fire' });
            if (alive(target)) applyStatus(run, target, 'burn', 3 + pyro, Math.max(1, Math.round(s.spell * 0.22 * (1 + pyro * 0.25))));
            break;
        }
        case 'nova': {
            const r = perk(run, 'frostheart') ? 3 : 2;
            ev(run, { t: 'skill', s: id, x: p.x, y: p.y, r });
            for (const m of run.mons.slice()) {
                if (!alive(m) || m.ally || cheb(m.x, m.y, p.x, p.y) > r) continue;
                damage(run, m, spellRoll(run, 0.6), { src: p, kind: 'cold' });
                if (alive(m)) applyStatus(run, m, 'frozen', 2 + (r === 3 ? 1 : 0));
            }
            break;
        }
        case 'meteor': {
            const { x, y } = a;
            if (x === undefined || cheb(x, y, p.x, p.y) > S.range || !run._t.vis[y * run.lv.w + x]) { log(run, 'You can\'t see there.', 'info'); return 0; }
            const tiles = [];
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inBounds(run, x + dx, y + dy)) tiles.push((y + dy) * run.lv.w + x + dx);
            run.hazards.push({ id: run.nextId++, tiles, t: 1, dmg: Math.round(spellRoll(run, 2.1)), kind: 'fire', owner: 0, friendly: true, st: { k: 'burn', n: 3 } });
            ev(run, { t: 'hazard', tiles, kind: 'meteor', friendly: true });
            log(run, 'A meteor streaks down out of the dark…', 'good');
            break;
        }
    }
    cooldown(run, id);
    return cost;
}

// ------------------------------------------------------------------ Items

function findInv(run, id) { return run.p.inv.find((it) => it.id === id); }

export function consume(run, it) {
    it.n = (it.n || 1) - 1;
    if (it.n <= 0) run.p.inv.splice(run.p.inv.indexOf(it), 1);
}

function doUse(run, a) {
    const it = findInv(run, a.id);
    if (!it) return 0;
    if (isGear(it)) return doEquip(run, it.id);
    const p = run.p;
    const s = pstats(run);
    const alch = 1 + perk(run, 'potion') * 0.3;
    switch (it.b) {
        case 'heal': heal(run, p, s.hpMax * 0.4 * alch); break;
        case 'heal2': heal(run, p, s.hpMax * 0.75 * alch); delete p.st.bleed; break;
        case 'oil': p.oil = Math.min(p.oilMax, p.oil + 40); p.hush = 0; log(run, 'You refill your lantern. The light swells.', 'good'); ev(run, { t: 'oil' }); break;
        case 'antidote': for (const k of ['poison', 'burn', 'bleed', 'weak']) delete p.st[k]; log(run, 'You feel clean.', 'good'); break;
        case 'haste': applyStatus(run, p, 'haste', 12); log(run, 'The world slows around you.', 'good'); break;
        case 'might': {
            const k = ['might', 'agi', 'will'].sort((a, b) => p.base[b] - p.base[a])[0];
            p.base[k] += 1;
            log(run, `You feel stronger: +1 ${k === 'agi' ? 'Agility' : k === 'will' ? 'Will' : 'Might'}.`, 'good');
            break;
        }
        case 'mapping': revealMap(run); log(run, 'The scroll unrolls a map of this floor.', 'good'); break;
        case 'teleport': {
            const c = randomFloorTile(run, 10);
            if (c) { ev(run, { t: 'tele', id: 0, fx: p.x, fy: p.y, x: c[0], y: c[1] }); p.x = c[0]; p.y = c[1]; pickup(run, false); }
            break;
        }
        case 'warding': p.st.shield = { t: 8, v: 0.5 }; ev(run, { t: 'status', id: 0, st: 'shield' }); log(run, 'A ward shimmers around you.', 'good'); break;
        case 'firebomb': case 'frostbomb': {
            const { x, y } = a;
            if (x === undefined || cheb(x, y, p.x, p.y) > 6 || !run._t.vis[y * run.lv.w + x] || !lineOfFire(run.lv, p.x, p.y, x, y)) { log(run, 'You can\'t throw there.', 'info'); return 0; }
            const fire = it.b === 'firebomb';
            const dmg = Math.round((8 + run.floor * 1.7) * (fire ? 1 : 0.5));
            const tiles = [];
            ev(run, { t: 'shot', id: 0, fx: p.x, fy: p.y, x, y, kind: fire ? 'bomb' : 'frostbomb' });
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                if (!inBounds(run, x + dx, y + dy)) continue;
                tiles.push((y + dy) * run.lv.w + x + dx);
                const m = actorAt(run, x + dx, y + dy);
                if (!m || isPlayer(m) || m.ally) continue;
                damage(run, m, dmg, { src: p, kind: fire ? 'fire' : 'cold' });
                if (alive(m)) applyStatus(run, m, fire ? 'burn' : 'frozen', fire ? 3 : 2, Math.round(dmg * 0.25));
            }
            ev(run, { t: 'boom', tiles, kind: fire ? 'fire' : 'ice' });
            break;
        }
        case 'page': run.story.push({ k: 'page', w: it.world }); return -1;
        case 'key': log(run, 'Walk into the vault door to use the key.', 'info'); return 0;
        default: log(run, 'Nothing happens.', 'info'); return 0;
    }
    if (it.k === 'potion') run.stats.potions++;
    consume(run, it);
    ev(run, { t: 'use', b: it.b });
    return 100;
}

function doEquip(run, id) {
    const it = findInv(run, id);
    if (!it || !isGear(it)) return 0;
    const p = run.p;
    const slot = it.k;
    const old = p.eq[slot];
    const before = pstats(run).hpMax;
    p.inv.splice(p.inv.indexOf(it), 1);
    p.eq[slot] = it;
    if (old) p.inv.push(old);
    const after = pstats(run).hpMax;
    p.hp = Math.max(1, Math.min(after, p.hp + Math.max(0, after - before)));
    log(run, `You equip ${it.name}.`, 'info');
    ev(run, { t: 'equip', slot });
    return 100;
}

function doUnequip(run, slot) {
    const p = run.p;
    const it = p.eq[slot];
    if (!it || p.inv.length >= 20) return 0;
    p.eq[slot] = null;
    p.inv.push(it);
    p.hp = Math.min(p.hp, pstats(run).hpMax);
    ev(run, { t: 'equip', slot });
    return 100;
}

function doDrop(run, id) {
    const it = findInv(run, id);
    if (!it) return 0;
    run.p.inv.splice(run.p.inv.indexOf(it), 1);
    run.items.push({ id: it.id, x: run.p.x, y: run.p.y, it, dropped: true });
    ev(run, { t: 'drop', id: it.id, x: run.p.x, y: run.p.y });
    return FREE;
}

/** Pick up what is under the hero. Gold always; items while there is room. */
function pickup(run, manual) {
    const p = run.p;
    let got = false;
    for (const fi of run.items.filter((f) => f.x === p.x && f.y === p.y)) {
        const it = fi.it;
        if (fi.dropped && !manual) continue;
        if (it.k === 'gold') {
            const n = Math.round(it.n * (1 + pstats(run).gold / 100));
            p.gold += n; run.stats.gold += n;
            ev(run, { t: 'gold', n, x: p.x, y: p.y });
            log(run, `+${n} gold.`, 'loot');
        } else if (it.k === 'page') {
            if (!p.pages.includes(it.world)) p.pages.push(it.world);
            run.story.push({ k: 'page', w: it.world });
            log(run, 'You find a page of Maren\'s journal!', 'quest');
            ev(run, { t: 'pickup', b: 'page' });
        } else {
            const same = stackable(it) && p.inv.find((o) => o.b === it.b && stackable(o));
            if (same) same.n += it.n || 1;
            else if (p.inv.length >= 20) { if (manual) log(run, 'Your pack is full.', 'warn'); continue; }
            else p.inv.push(it);
            log(run, `You pick up ${it.n > 1 ? it.n + '× ' : ''}${it.name}.`, it.r >= 2 ? 'rare' : 'loot');
            ev(run, { t: 'pickup', b: it.b, r: it.r });
            if (it.quest) recheck(run);
        }
        run.items.splice(run.items.indexOf(fi), 1);
        got = true;
    }
    return got;
}

function revealMap(run) {
    const lv = run.lv;
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
        const t = lv.tiles[y * lv.w + x];
        if (t !== T.WALL) { lv.seen[y * lv.w + x] = 1; continue; }
        for (const [dx, dy] of DIRS8) {
            const X = x + dx, Y = y + dy;
            if (X >= 0 && Y >= 0 && X < lv.w && Y < lv.h && lv.tiles[Y * lv.w + X] !== T.WALL) { lv.seen[y * lv.w + x] = 1; break; }
        }
    }
    ev(run, { t: 'reveal' });
}

function inVault(run, x, y) {
    const v = run.lv.vault;
    return !!v && x >= v.x && x < v.x + v.w && y >= v.y && y < v.y + v.h;
}

function randomFloorTile(run, minD) {
    const rng = R(run);
    for (let k = 0; k < 300; k++) {
        const x = rng.int(1, run.lv.w - 2), y = rng.int(1, run.lv.h - 2);
        if (cheb(x, y, run.p.x, run.p.y) < minD || !canEnter(run, run.p, x, y) || inVault(run, x, y)) continue;
        if (run.objs.some((o) => o.k === 'trap' && o.x === x && o.y === y)) continue;
        return [x, y];
    }
    return null;
}

// ------------------------------------------------------------------ Traps

function search(run, radius, chance) {
    const p = run.p;
    const rng = R(run);
    for (const o of run.objs) {
        if (o.k !== 'trap' || !o.hidden || o.gone) continue;
        if (cheb(o.x, o.y, p.x, p.y) > radius || !run._t.vis[o.y * run.lv.w + o.x]) continue;
        if (rng.chance(chance)) { o.hidden = false; ev(run, { t: 'trapFound', id: o.id }); log(run, 'You spot a trap!', 'warn'); }
    }
}

function triggerTrap(run, o) {
    const p = run.p;
    const s = pstats(run);
    o.hidden = false;
    ev(run, { t: 'trap', id: o.id, trap: o.trap, x: o.x, y: o.y });
    const square = () => {
        const t = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inBounds(run, o.x + dx, o.y + dy)) t.push((o.y + dy) * run.lv.w + o.x + dx);
        return t;
    };
    switch (o.trap) {
        case 'spike': log(run, 'Spikes punch up through the floor!', 'bad'); damage(run, p, s.hpMax * 0.12 + run.floor * 0.5, { src: 'a spike trap' }); applyStatus(run, p, 'bleed', 3, 1 + (run.floor >> 3)); break;
        case 'fire': {
            log(run, 'A gout of flame!', 'bad');
            const tiles = square();
            run.fields.push({ tiles, t: 3, dmg: Math.round(2 + run.floor * 0.5), kind: 'fire', st: { k: 'burn', n: 2 } });
            ev(run, { t: 'boom', tiles, kind: 'fire' });
            damage(run, p, 3 + run.floor * 0.6, { src: 'a fire trap', kind: 'fire' });
            applyStatus(run, p, 'burn', 3, 1 + (run.floor >> 3));
            break;
        }
        case 'gas': {
            log(run, 'A hiss — poison gas!', 'bad');
            const tiles = square();
            run.fields.push({ tiles, t: 5, dmg: Math.round(1 + run.floor * 0.35), kind: 'poison', st: { k: 'poison', n: 3 } });
            ev(run, { t: 'boom', tiles, kind: 'poison' });
            applyStatus(run, p, 'poison', 4, 1 + (run.floor >> 3));
            break;
        }
        case 'alarm':
            log(run, 'An alarm shrieks! Everything on this floor knows where you are.', 'bad');
            for (const m of run.mons) if (!m.ally && !m.dormant && cheb(m.x, m.y, p.x, p.y) < 20) { m.awake = true; m.asleep = false; m.lastSeen = { x: p.x, y: p.y }; m.lost = 0; }
            o.gone = true;
            break;
        case 'tele': {
            log(run, 'The floor flickers and you are somewhere else.', 'bad');
            const c = randomFloorTile(run, 8);
            o.gone = true;
            if (c) { ev(run, { t: 'tele', id: 0, fx: p.x, fy: p.y, x: c[0], y: c[1] }); p.x = c[0]; p.y = c[1]; }
            break;
        }
    }
}

// ------------------------------------------------------------------ Turn engine

function endTurn(run, cost) {
    run.clock += cost;
    while (run.clock >= 100) {
        run.clock -= 100;
        worldTick(run);
        if (run.over) return;
    }
    computeDmap(run);
    for (const m of run.mons.slice()) {
        if (!alive(m)) continue;
        m.energy += m.spd * cost / 100;
        let guard = 0;
        while (m.energy >= 100 && alive(m) && !run.over && guard++ < 4) {
            m.energy -= 100;
            monsterAct(run, m);
        }
        if (run.over) return;
    }
    run.mons = run.mons.filter((m) => !m.dead);
    updateFov(run);
}

function worldTick(run) {
    const p = run.p;
    const s = pstats(run);
    run.turn++;
    run.stats.turns++;
    // The lantern.
    const was = p.oil;
    p.oil = Math.max(0, p.oil - s.oilRate);
    if (was >= 25 && p.oil < 25) log(run, 'Your lantern is running low.', 'warn');
    if (p.oil <= 0) {
        if (was > 0) log(run, 'Your lantern gutters out. The Hush is gathering…', 'bad');
        p.hush++;
        if (p.hush % 6 === 0) damage(run, p, 1 + Math.floor(run.floor / 8), { src: 'the Hush' });
        if (run.over) return;
    }
    // Regeneration.
    if (s.regen > 0 && p.hp < s.hpMax) {
        p.regenAcc += s.regen / 10;
        if (p.regenAcc >= 1) { const n = Math.floor(p.regenAcc); p.regenAcc -= n; heal(run, p, n, true); }
    }
    for (const k in p.cds) if (p.cds[k] > 0) p.cds[k]--;
    // Statuses.
    tickStatuses(run, p);
    if (run.over) return;
    for (const m of run.mons) {
        if (!alive(m)) continue;
        tickStatuses(run, m);
        const S = SPECIES[m.sp];
        const rg = (S && S.regen) || (m.aff.includes('regen') ? 0.05 : 0);
        if (rg && alive(m) && m.hp < m.hpMax) m.hp = Math.min(m.hpMax, m.hp + Math.max(1, Math.round(m.hpMax * rg)));
    }
    if (run.over) return;
    // Hazards (telegraphed last turn) land now.
    const due = run.hazards.filter((h) => --h.t <= 0);
    run.hazards = run.hazards.filter((h) => h.t > 0);
    for (const h of due) { resolveHazard(run, h); if (run.over) return; }
    // Lingering fields.
    for (const f of run.fields) {
        f.t--;
        const set = new Set(f.tiles);
        for (const a of [p, ...run.mons]) {
            if (!alive(a) || !set.has(a.y * run.lv.w + a.x)) continue;
            if (f.friendly ? (isPlayer(a) || a.ally) : !(isPlayer(a) || a.ally)) continue;
            damage(run, a, f.dmg, { src: f.friendly ? p : 'the ' + f.kind, kind: f.kind === 'ice' ? 'cold' : f.kind });
            if (f.st && alive(a)) applyStatus(run, a, f.st.k, f.st.n, Math.max(1, Math.round(f.dmg * 0.3)));
            if (run.over) return;
        }
    }
    run.fields = run.fields.filter((f) => f.t > 0);
    // Passive trap spotting.
    search(run, 1 + perk(run, 'path') * 2, 0.08 + s.agi * 0.012 + perk(run, 'path') * 0.3);
}

function tickStatuses(run, a) {
    for (const k of Object.keys(a.st)) {
        const st = a.st[k];
        if (!st) continue;
        if (STATUS[k] && STATUS[k].dot && st.v > 0) {
            if (k === 'burn' && isPlayer(a) && tileAt(run, a.x, a.y) === T.SHALLOW) { delete a.st[k]; continue; }
            damage(run, a, st.v * (k === 'burn' && isPlayer(a) ? 1 : (k === 'burn' ? 1 + perk(run, 'pyro') * 0.2 : 1)), { src: STATUS[k].n.toLowerCase(), kind: STATUS[k].kind });
            if (!alive(a)) return;
        }
        if (--st.t <= 0) { delete a.st[k]; if (a.st.haste === undefined && a.boss && k === 'haste') a.spd = 100; }
    }
}

function resolveHazard(run, h) {
    const p = run.p;
    const set = new Set(h.tiles);
    const owner = h.owner === 0 ? p : run.mons.find((m) => m.id === h.owner);
    const kind = h.kind === 'ice' ? 'cold' : h.kind === 'fire' || h.kind === 'meteor' ? 'fire' : h.kind === 'poison' ? 'poison' : 'magic';
    ev(run, { t: 'boom', tiles: h.tiles, kind: h.kind, friendly: !!h.friendly });
    const rng = R(run);
    const hit = [];
    if (h.friendly) { for (const m of run.mons) if (alive(m) && !m.ally && set.has(m.y * run.lv.w + m.x)) hit.push(m); }
    else {
        if (set.has(p.y * run.lv.w + p.x)) hit.push(p);
        for (const m of run.mons) if (alive(m) && m.ally && set.has(m.y * run.lv.w + m.x)) hit.push(m);
    }
    for (const a of hit) {
        const n = h.dmg * rng.range(0.85, 1.15);
        damage(run, a, n, { src: h.friendly ? p : (owner || { name: 'a blast' }), kind });
        if (h.st && alive(a)) applyStatus(run, a, h.st.k, h.st.n, Math.max(1, Math.round(h.dmg * 0.2)));
        if (run.over) return;
    }
    if (h.field) run.fields.push({ tiles: h.tiles, t: h.field, dmg: Math.max(1, Math.round(h.dmg * 0.35)), kind: h.kind, st: h.st, friendly: !!h.friendly });
    if (h.bomber && owner && alive(owner)) { owner.dead = true; owner.hp = 0; ev(run, { t: 'die', id: owner.id, x: owner.x, y: owner.y, burst: true }); }
    if (h.charge) finishCharge(run, h);
    if (h.emerge) emerge(run, h);
}

function computeDmap(run) {
    const lv = run.lv;
    const blocked = new Set();
    for (const o of run.objs) if (blockingObj(o)) blocked.add(o.y * lv.w + o.x);
    run._t.dmap = distanceMap(lv, [[run.p.x, run.p.y]], (i) => {
        const t = lv.tiles[i];
        return (TP[t].pass || t === T.DOOR) && !blocked.has(i);
    }, 40);
}

function refreshFovSoon(run) { run._t.fovDirty = true; }

export function updateFov(run) {
    const lv = run.lv;
    const p = run.p;
    const { vis, los, light } = run._t;
    const radius = pstats(run).light;
    vis.fill(0); los.fill(0);
    const blocks = blocksSight(lv);
    shadowcast(p.x, p.y, 13, blocks, (x, y) => {
        if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return;
        const i = y * lv.w + x;
        los[i] = 1;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d <= radius + 0.5 || light[i] > 0.12) { vis[i] = 1; lv.seen[i] = 1; }
    });
    // Newly visible threats interrupt travel and auto-explore.
    const now = new Set();
    for (const m of run.mons) {
        if (!alive(m) || m.ally || m.dormant || !vis[m.y * lv.w + m.x]) continue;
        now.add(m.id);
        if (!run._t.prevVis.has(m.id)) {
            run._t.threat = true;
            if (!m.seen) { m.seen = true; if (m.elite || m.boss) log(run, `You see ${m.name}!`, 'warn'); }
        }
    }
    run._t.prevVis = now;
    run._t.fovDirty = false;
}

// ------------------------------------------------------------------ Floors

function doDescend(run) {
    const p = run.p;
    if (tileAt(run, p.x, p.y) !== T.STAIRS_DOWN) return false;
    if (run.floor >= LAST_FLOOR) return false;
    onLeaveFloor(run);
    ev(run, { t: 'descend' });
    enterFloor(run, run.floor + 1);
    return true;
}

hooks.onKill = (run, m) => {
    recheck(run);
    if (m.boss) bossDefeated(run, m);
};

hooks.onPlayerDeath = (run, src) => {
    run.over = true;
    const cause = typeof src === 'string' ? src : src && src.name ? (src.boss ? src.name : `a ${src.name}`) : (run.p.lastHit || 'the dark');
    run.dead = { floor: run.floor, cause, turn: run.turn };
    run.stats.deaths++;
    log(run, `You were slain by ${cause}.`, 'bad');
};

function bossDefeated(run, m) {
    const lv = run.lv;
    const w = lv.world;
    run.flags.dark = false;
    run.stats.bosses++;
    for (const o of run.mons) if (o.summoner === m.id && alive(o)) { o.dead = true; o.hp = 0; ev(run, { t: 'die', id: o.id, x: o.x, y: o.y, fade: true }); }
    run.hazards = [];
    run.fields = [];
    ev(run, { t: 'bossDie', id: m.id, x: m.x, y: m.y });
    if (w < 10) {
        run.p.embers++;
        lv.tiles[lv.down.y * lv.w + lv.down.x] = T.STAIRS_DOWN;
        ev(run, { t: 'stairs', x: lv.down.x, y: lv.down.y });
        const rng = R(run);
        dropAt(run, m.x, m.y, makeRelic(run, w, run.floor));
        dropAt(run, m.x, m.y, { id: run.nextId++, k: 'gold', n: Math.round(60 * (1 + run.floor * 0.12)) });
        dropAt(run, m.x, m.y, rollItem(run, rng, run.floor + 2, 'gear', 1.5));
        dropAt(run, m.x, m.y, makeConsumable(run, 'heal2'));
        log(run, `The Ember is yours. Your lantern burns brighter. (${run.p.embers}/9 Embers)`, 'quest');
        run.story.push({ k: 'defeat', w });
    } else {
        run.story.push({ k: 'defeat', w }, { k: 'ending' });
    }
}

/** Lantern mode: start the current world again with the hero as they entered it. */
export function rekindle(run) {
    if (run.mode !== 'lantern' || !run.checkpoint || !run.dead) return false;
    const deaths = run.stats.deaths;
    run.p = JSON.parse(JSON.stringify(run.checkpoint.p));
    run.p.hp = pstats(run).hpMax;
    run.p.oil = Math.max(run.p.oil, 60);
    run.over = false; run.dead = null; run.story = []; run.pending = null; run.dialog = null; run.perkQ = 0;
    run.stats.deaths = deaths;
    for (const q of run.quests) if (q.state === 'active' || q.state === 'offered') q.state = 'failed';
    run.flags.rekindles = (run.flags.rekindles || 0) + 1;
    enterFloor(run, run.checkpoint.floor);
    log(run, 'The lantern rekindles. You remember these stairs.', 'good');
    return true;
}

// ------------------------------------------------------------------ Dialog choices

export function closeDialog(run) { run.dialog = null; }
export function acceptDialogQuest(run) {
    if (!run.dialog || run.dialog.k !== 'quest') return;
    acceptQuest(run, run.dialog.q);
    run.dialog = null;
}

export const price = (it) => Math.max(5, Math.round((it.val || 10) * (isGear(it) ? 1.3 : 1)));
export const sellPrice = (it) => Math.max(1, Math.round((it.val || 4) * 0.35));
export const oilPrice = (run) => Math.ceil((run.p.oilMax - run.p.oil) * 0.6);

export function buy(run, objId, itemId) {
    const o = run.objs.find((x) => x.id === objId && x.k === 'merchant');
    if (!o) return false;
    const it = o.stock.find((x) => x.id === itemId);
    if (!it || run.p.gold < price(it)) return false;
    const same = stackable(it) && run.p.inv.find((x) => x.b === it.b && stackable(x));
    if (!same && run.p.inv.length >= 20) return false;
    run.p.gold -= price(it);
    o.stock.splice(o.stock.indexOf(it), 1);
    if (same) same.n += it.n || 1; else run.p.inv.push(it);
    ev(run, { t: 'buy' });
    log(run, `Bought ${it.name}.`, 'loot');
    return true;
}
export function sell(run, itemId) {
    const it = run.p.inv.find((x) => x.id === itemId);
    if (!it || it.k === 'page' || it.k === 'key' || it.quest) return false;
    run.p.gold += sellPrice(it);
    consume(run, it);
    ev(run, { t: 'sell' });
    return true;
}
export function buyOil(run) {
    const c = oilPrice(run);
    if (c <= 0 || run.p.gold < c) return false;
    run.p.gold -= c; run.p.oil = run.p.oilMax; run.p.hush = 0;
    ev(run, { t: 'oil' });
    log(run, 'The merchant fills your lantern to the brim.', 'good');
    return true;
}

// ------------------------------------------------------------------ Travel & auto-explore

const knownWalkable = (run, i) => {
    const t = run.lv.tiles[i];
    return run.lv.seen[i] && (TP[t].pass || t === T.DOOR);
};
function trapSet(run) {
    const s = new Set();
    for (const o of run.objs) if ((o.k === 'trap' && !o.hidden && !o.gone) || blockingObj(o)) s.add(o.y * run.lv.w + o.x);
    return s;
}

/** First step towards (x, y) over known ground, avoiding known traps; null if there or unreachable. */
export function travelStep(run, x, y) {
    const p = run.p;
    if (p.x === x && p.y === y) return null;
    const avoid = trapSet(run);
    const goal = y * run.lv.w + x;
    let path = findPath(run.lv, p.x, p.y, x, y, (i) => (knownWalkable(run, i) && !avoid.has(i)) || i === goal);
    // No safe way round: walk over known traps rather than not at all (never through blocking objects).
    if (!path.length) path = findPath(run.lv, p.x, p.y, x, y, (i) => (knownWalkable(run, i) && !blockingObj(objAt(run, i % run.lv.w, (i / run.lv.w) | 0))) || i === goal);
    if (!path.length) return null;
    const [nx, ny] = path[0];
    return { t: 'move', dx: nx - p.x, dy: ny - p.y };
}

/**
 * Auto-explore: walk to the nearest unexplored edge, item, chest or unlit
 * brazier (when a kindle quest wants it). Returns an action, or
 * { done: true } when the floor is explored, or { stop: 'enemy' }.
 */
export function autoExplore(run, ignoreFoes = false, allowTraps = false) {
    const p0 = run.p;
    if (!ignoreFoes && visibleHostiles(run).some((m) => m.awake || cheb(m.x, m.y, p0.x, p0.y) <= 6)) return { stop: 'enemy' };
    const lv = run.lv;
    const p = run.p;
    const avoid = allowTraps ? new Set(run.objs.filter((o) => blockingObj(o)).map((o) => o.y * lv.w + o.x)) : trapSet(run);
    const goals = [];
    const kindle = run.quests.some((q) => q.state === 'active' && q.kind === 'kindle');
    for (const fi of run.items) {
        const i = fi.y * lv.w + fi.x;
        if (!lv.seen[i] || fi.dropped || (fi.x === p.x && fi.y === p.y)) continue;
        if (fi.it.k !== 'gold' && fi.it.k !== 'page' && p.inv.length >= 20 && !(stackable(fi.it) && p.inv.some((o) => o.b === fi.it.b))) continue;
        goals.push([fi.x, fi.y]);
    }
    for (const o of run.objs) {
        if (!lv.seen[o.y * lv.w + o.x]) continue;
        if ((o.k === 'chest' && !o.open) || (o.k === 'brazier' && !o.lit && kindle) || (o.k === 'captive' && !o.gone) || (o.k === 'npc' && !o.met) || (o.k === 'fountain' && !o.used && p.hp < pstats(run).hpMax * 0.7)) goals.push([o.x, o.y]);
    }
    for (let y = 1; y < lv.h - 1; y++) for (let x = 1; x < lv.w - 1; x++) {
        const i = y * lv.w + x;
        if (!knownWalkable(run, i) || avoid.has(i)) continue;
        for (const [dx, dy] of DIRS8) if (!lv.seen[(y + dy) * lv.w + x + dx]) { goals.push([x, y]); break; }
    }
    if (!goals.length) return { done: true };
    const goalSet = new Set(goals.map(([x, y]) => y * lv.w + x));
    const D = distanceMap(lv, goals, (i) => (knownWalkable(run, i) && !avoid.has(i)) || goalSet.has(i) || i === p.y * lv.w + p.x);
    if (D[p.y * lv.w + p.x] <= 0) {
        // Everything left lies past a spotted trap: say so rather than claim the floor is done.
        if (!allowTraps) { const r = autoExplore(run, true, true); if (r.t) return { stop: 'trap' }; }
        return { done: true };
    }
    const path = descend(lv, D, p.x, p.y);
    if (!path.length) return { done: true };
    const [nx, ny] = path[0];
    const o = objAt(run, nx, ny);
    if (o && o.k === 'npc') o.met = true;
    return { t: 'move', dx: nx - p.x, dy: ny - p.y };
}

// ------------------------------------------------------------------ Save

export function serialize(run) { return JSON.stringify(run); }
export function deserialize(json) {
    const run = typeof json === 'string' ? JSON.parse(json) : json;
    if (!run || run.v !== SAVE_VERSION) return null;
    attachTransient(run);
    refresh(run);
    run._t.prevVis = new Set(visibleHostiles(run).map((m) => m.id));
    return run;
}

export function drainEvents(run) {
    const e = run._t.ev;
    run._t.ev = [];
    return e;
}

export { pstats, alive, CONSUMABLES };
