/**
 * save.js — save slots in localStorage (guarded: private windows and full storage just fail
 * quietly), plus autosave and quicksave. A save is plain JSON of everything that changes:
 * the player, time and weather, flags, quests, containers, loose items, NPC fates, dungeon
 * state. Loading mutates the existing World in place (the terrain and settlements never change).
 */
import { SAVE_PREFIX, VERSION } from './config.js';
import { LOC } from './sim/geography.js';
import { KIN } from './sim/stats.js';
import { recalc } from './sim/actor.js';

const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
    keys() { try { return Object.keys(localStorage); } catch { return []; } },
};

const P_KEYS = ['name', 'yaw', 'camYaw', 'camPitch', 'third', 'hp', 'mp', 'sp', 'sheet', 'storm', 'look', 'spells', 'favorites', 'bounty', 'gold', 'drawn'];

export class Saves {
    constructor(app) { this.app = app; this.prefix = `${SAVE_PREFIX}:slot:`; }

    list() {
        const out = [];
        for (const k of store.keys()) {
            if (!k.startsWith(this.prefix)) continue;
            const raw = store.get(`${SAVE_PREFIX}:meta:${k.slice(this.prefix.length)}`);
            try { out.push({ slot: k.slice(this.prefix.length), meta: JSON.parse(raw) }); } catch { /* skip */ }
        }
        return out.sort((a, b) => (b.meta.t || 0) - (a.meta.t || 0));
    }
    latest() { return this.list()[0] || null; }

    /** Write a save. slot null → a new manual slot; 'auto' / 'quick' are fixed slots. */
    save(slot = null, kind = 'manual') {
        const w = this.app.world;
        if (!w || w.player.dead) return false;
        if (kind === 'auto') slot = 'auto';
        if (kind === 'quick') slot = 'quick';
        slot = slot || `s${Date.now().toString(36)}`;
        const data = serialize(w);
        const p = w.player;
        const place = w.cellId === 'ext' ? (LOC[nearestLoc(w)]?.name || 'The Frostmarch') : (w.space.name || (w.space.loc && LOC[w.space.loc]?.name) || 'Indoors');
        const meta = { name: p.name, level: p.sheet.level, kin: KIN[p.sheet.kin]?.name, place, kind, t: Date.now(), when: new Date().toLocaleString(), v: VERSION };
        const ok = store.set(this.prefix + slot, JSON.stringify(data)) && store.set(`${SAVE_PREFIX}:meta:${slot}`, JSON.stringify(meta));
        if (!ok) this.app.ui?.toast('Could not save: browser storage is unavailable or full.');
        return ok ? slot : false;
    }
    load(slot) {
        const raw = store.get(this.prefix + slot);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }
    remove(slot) { store.del(this.prefix + slot); store.del(`${SAVE_PREFIX}:meta:${slot}`); }
}

function nearestLoc(w) {
    const p = w.player.pos;
    let best = null, bd = 1e9;
    for (const id in LOC) { const L = LOC[id]; const d = Math.hypot(L.x - p.x, L.z - p.z); if (d < bd) { bd = d; best = id; } }
    return best;
}

// ------------------------------------------------------------------ world ⇄ JSON
const EQ_SLOTS = ['right', 'left', 'head', 'body', 'hands', 'feet', 'amulet', 'ring', 'ammo'];

export function serialize(w) {
    const p = w.player;
    const player = {};
    for (const k of P_KEYS) player[k] = p[k];
    player.pos = { ...p.pos };
    player.inv = p.inv.map((e) => ({ ...e }));
    player.equip = {};
    for (const k of Object.keys(p.equip)) { const i = p.inv.indexOf(p.equip[k]); if (i >= 0) player.equip[k] = i; }
    player.effects = p.effects.filter((e) => e.dur > 0).map((e) => ({ id: e.id, mag: e.mag, dur: e.dur, t: e.t }));
    const containers = {};
    for (const [id, c] of w.containers) containers[id] = { kind: c.kind, inv: c.inv, locked: c.locked, owner: c.owner, gold: c.gold };
    return JSON.parse(JSON.stringify({
        v: VERSION,
        seed: w.seedUsed ?? null,
        time: { ...w.time },
        weather: { type: w.weather.type, cur: { ...w.weather.cur } },
        difficulty: w.difficulty,
        flags: w.flags,
        stats: w.stats,
        discovered: [...w.discovered],
        cleared: [...w.cleared],
        harvested: w.harvested,
        alchemyKnown: w.alchemyKnown,
        containers,
        items: w.items.map((it) => ({ uid: it.uid, entry: it.entry, pos: it.pos, cell: it.cell, owner: it.owner })),
        uid: w.uid,
        cell: w.cellId,
        extReturn: w.extReturn ? { id: w.extReturn.id, x: w.extReturn.x, z: w.extReturn.z, rot: w.extReturn.rot } : null,
        player,
        followers: w.actors.filter((a) => a.follower && a.npcId && !a.dead).map((a) => a.npcId),
        pop: w.pop.save(),
        interiors: w.interiors.state,
        quests: w.quests.save(),
    }));
}

export function applySave(w, d) {
    d = JSON.parse(JSON.stringify(d));   // never share objects with the source (the pristine snapshot is reused)
    const p = w.player;
    // clear the live world
    for (const a of [...w.actors]) if (a !== p) w.removeActor(a);
    w.projectiles.length = 0; w.runes.length = 0;
    w.space = w.ext; w.cellId = 'ext'; p.cell = 'ext';
    w.events.length = 0;
    Object.assign(w.time, d.time);
    w.weather.type = d.weather.type; Object.assign(w.weather.cur, d.weather.cur);
    w.difficulty = d.difficulty || 'normal';
    w.flags = d.flags || {};
    Object.assign(w.stats, d.stats || {});
    w.discovered = new Set(d.discovered || []);
    w.cleared = new Set(d.cleared || []);
    w.harvested = d.harvested || {};
    w.alchemyKnown = d.alchemyKnown || {};
    w.containers = new Map(Object.entries(d.containers || {}).map(([id, c]) => [id, { id, ...c }]));
    w.items = (d.items || []).map((it) => ({ ...it }));
    w.uid = d.uid || 1;
    // the player
    const sp = d.player;
    for (const k of P_KEYS) if (sp[k] !== undefined) p[k] = sp[k];
    p.inv = sp.inv.map((e) => ({ ...e }));
    for (const k of Object.keys(p.equip)) p.equip[k] = null;
    for (const [k, i] of Object.entries(sp.equip || {})) if (p.inv[i]) p.equip[k] = p.inv[i];
    p.effects = (sp.effects || []).map((e) => ({ ...e, src: null }));
    p.dead = false; p.act = { kind: 'idle', t: 0 }; p.vel.x = p.vel.y = p.vel.z = 0;
    p.hands = p.hands || { right: null, left: null };
    p.dirty = true; recalc(p);
    // NPCs, dungeons, quests
    w.pop.npcs.clear(); w.pop.npcCell.clear(); w.pop.camps.clear(); w.pop.guards.clear(); w.pop.wild = [];
    w.pop.load(d.pop);
    w.interiors.state = d.interiors || {};
    w.interiors.cache.clear();
    w.quests.load(d.quests);
    w.quests.queue.length = 0;
    // followers come back with you
    for (const id of d.followers || []) {
        const a = w.pop.npc(id);
        a.follower = true; a.ai.kind = 'follower'; a.ai.leader = p.id; a.faction = 'friend';
    }
    // where you were
    if (d.cell && d.cell !== 'ext') {
        w.extReturn = d.extReturn ? (w.settlements.doors.find((x) => x.id === d.extReturn.id) || d.extReturn) : null;
        w.enterCell(d.cell);
        p.pos.x = sp.pos.x; p.pos.z = sp.pos.z; p.pos.y = w.space.ground(sp.pos.x, sp.pos.z, sp.pos.y + 0.5);
    } else {
        w.placePlayer(sp.pos.x, sp.pos.z, sp.yaw, sp.pos.y + 0.5);
        w.emit('cellChanged', { cell: 'ext', interior: false });
    }
    for (const id of d.followers || []) { const a = w.pop.npcs.get(id); if (a) { a.pos.x = p.pos.x + 1.2; a.pos.z = p.pos.z + 1; a.pos.y = w.space.ground(a.pos.x, a.pos.z, p.pos.y + 1); w.addActor(a); } }
    p.yaw = sp.yaw; p.camYaw = sp.camYaw ?? sp.yaw; p.camPitch = sp.camPitch || 0;
    w.pop.timer = 0;
    w.focus = null;
}
