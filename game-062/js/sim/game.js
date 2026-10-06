// The game session: the hero, the floors visited this session, transitions (stairs, portals,
// waypoints, death), townsfolk dialogue, quests, shops and difficulty. Pure: no DOM, no three.

import { RNG, sub } from '../rng.js';
import { World } from './world.js';
import { generateFloor } from './dungeon.js';
import { buildTown } from './town.js';
import { QUESTS, NPCS, floorName, isBossFloor, floorLevel } from './data/story.js';
import { CLASSES } from './data/classes.js';
import { DIFFICULTIES, FLOORS } from '../config.js';
import { makeItem, shopStock, buyPrice, bumpUid, rollKind } from './items.js';
import { addToInv, identifyAll, addPotion, potionPrice, sellFromInv, computeStats, freeSlot, potionCap } from './hero.js';
import { walkable } from './tiles.js';

export class Game {
    constructor(hero, { fresh = true } = {}) {
        this.hero = hero;
        hero.sessions = (hero.sessions || 0) + 1;
        this.rng = new RNG(sub(hero.seed, 'session', hero.sessions));
        this.floors = new Map();
        this.world = null;
        this.portal = null;
        this.god = false;
        this.shops = {};
        this.dirty = true;
        let maxId = 0;
        const scan = (it) => { if (it && it.id > maxId) maxId = it.id; };
        hero.inv.forEach(scan); hero.stash.forEach(scan); Object.values(hero.equip).forEach(scan);
        bumpUid(maxId);
        this.enter(0, fresh ? 'start' : 'load');
    }

    get floor() { return this.world.floor; }
    get diff() { return DIFFICULTIES[this.hero.difficulty]; }

    mapSeed() { return sub(this.hero.seed, 'maps', this.hero.sessions, this.hero.difficulty); }

    /** Move to a floor. how: start | load | down | up | waypoint | portal | death */
    enter(floor, how) {
        const prev = this.world;
        if (prev) { this.hero.hp = prev.hero.dead ? undefined : prev.hero.hp; this.hero.juice = prev.hero.juice; }
        if (prev && prev.floor > 0 && floor === 0 && how !== 'portal-back') this.hero.shopVisit++;
        let w = this.floors.get(floor);
        if (!w) {
            const map = floor === 0 ? buildTown() : generateFloor(this.mapSeed(), floor);
            w = new World(this, map);
            this.floors.set(floor, w);
            // Keep memory bounded: town plus the three nearest floors.
            if (this.floors.size > 4) {
                const far = [...this.floors.keys()].filter((f) => f !== 0 && f !== floor).sort((a, b) => Math.abs(b - floor) - Math.abs(a - floor))[0];
                if (far !== undefined) this.floors.delete(far);
            }
        }
        // Fresh hero actor at the right spot.
        w.events.length = 0;
        w.hero = w.makeHero();
        if (how === 'death' || how === 'start' || how === 'load') { w.hero.hp = w.hero.maxHp; w.hero.juice = w.hero.maxJuice; }
        const m = w.map;
        let spot = m.start;
        if (floor === 0 && (how === 'death' || how === 'portal' || how === 'waypoint' || how === 'load')) spot = m.wellSpot;
        if (how === 'up' && floor > 0) {
            const down = w.objs.find((o) => o.type === 'down');
            spot = down ? { x: down.x, y: down.y + 1.2 } : m.arena ? { x: m.arena.cx, y: m.arena.cy + 2 } : m.start;
            if (!walkable(m.at(Math.floor(spot.x), Math.floor(spot.y)))) spot = down ? { x: down.x + 1.1, y: down.y } : m.start;
        }
        if (how === 'portal-back' && this.portal && this.portal.floor === floor) spot = { x: this.portal.x + 0.8, y: this.portal.y + 0.8 };
        w.hero.x = spot.x; w.hero.y = spot.y;
        if (!w.passable(w.hero.x, w.hero.y, w.hero.r)) w.unstick(w.hero, w.hero.r);
        w.fovKey = -1; w.fieldKey = -1;
        this.world = w;
        if (floor > 0 && !this.hero.waypoints.includes(floor)) { this.hero.waypoints.push(floor); this.hero.waypoints.sort((a, b) => a - b); w.emit('waypoint', { floor }); }
        this.hero.maxFloor = Math.max(this.hero.maxFloor, floor);
        this.syncPortals();
        w.emit('enter', { floor, how, name: floorName(floor), boss: isBossFloor(floor) && floor > 0 });
        this.dirty = true;
    }

    syncPortals() {
        for (const w of this.floors.values()) w.objs = w.objs.filter((o) => o.type !== 'portal');
        if (!this.portal) return;
        const pw = this.floors.get(this.portal.floor);
        if (pw) pw.addObj('portal', this.portal.x, this.portal.y, { home: false });
        const town = this.floors.get(0);
        if (town) town.addObj('portal', town.map.wellSpot.x + 2.4, town.map.wellSpot.y - 0.2, { home: true, dest: this.portal.floor });
    }

    // ------------------------------------------------------------------ per-tick
    update(dt) {
        const w = this.world;
        const before = w.evSeq || 0;
        w.update(dt);
        let go = null;
        // Count by sequence number, not index: the queue is capped and may have been trimmed.
        for (let i = Math.max(0, w.events.length - ((w.evSeq || 0) - before)); i < w.events.length; i++) {
            const e = w.events[i];
            if (e.type === 'stairs') go = { floor: w.floor + e.dir, how: e.dir > 0 ? 'down' : 'up' };
            if (e.type === 'portal') {
                if (w.floor === 0 && this.portal) go = { floor: this.portal.floor, how: 'portal-back', close: true };
                else if (w.floor > 0) go = { floor: 0, how: 'portal' };
            }
        }
        if (go && go.floor >= 0 && go.floor <= FLOORS) {
            const carry = w.events.splice(0);
            this.enter(go.floor, go.how);
            if (go.close) { this.portal = null; this.syncPortals(); }
            this.world.events.unshift(...carry.filter((e) => e.type === 'toast'));
        }
    }

    // ------------------------------------------------------------------ hero actions that need the game
    usePie() {
        const w = this.world, h = w.hero;
        if (w.town) { w.emit('toast', { text: 'You are already home. The pie smells great though.' }); return false; }
        if (h.dead || this.hero.potions.pie <= 0) return false;
        this.hero.potions.pie--;
        const a = h.face;
        let x = h.x + Math.cos(a) * 1.2, y = h.y + Math.sin(a) * 1.2;
        if (!w.passable(x, y, 0.4)) { x = h.x; y = h.y; }
        this.portal = { floor: w.floor, x, y };
        this.syncPortals();
        w.emit('pie', { x, y });
        return true;
    }

    respawn() {
        const h = this.hero;
        const lost = Math.floor(h.sugar * 0.1);
        h.sugar -= lost;
        h.hp = undefined; h.juice = undefined;
        // The floor you died on is rebuilt fresh next time (no corpse run).
        if (this.world.floor > 0) this.floors.delete(this.world.floor);
        this.portal = null;
        this.enter(0, 'death');
        this.world.emit('toast', { text: lost ? `You wake up in Tristrawberry, ${lost} sugar lighter.` : 'You wake up in Tristrawberry. Granny Smith tuts at you.' });
    }

    travel(floor) {
        if (!this.hero.waypoints.includes(floor) || floor === this.world.floor) return false;
        this.enter(floor, 'waypoint');
        return true;
    }

    // ------------------------------------------------------------------ quests
    questState(id) { return this.hero.quests[id] || 0; }
    questEvent(id) {
        const q = QUESTS.find((x) => x.id === id);
        if (!q) return;
        if (this.hero.quests[id] < 2) {
            this.hero.quests[id] = 2;
            this.world.emit('quest', { id, state: 2, text: `${q.name}: return to ${NPCS[q.giver].name}.` });
        }
    }

    onBossDead(type, w) {
        const map = w.map;
        if (type === 'juicer') this.questEvent('freshfruit');
        if (type === 'mango') this.questEvent('chutney');
        if (type === 'durianlord') { this.questEvent('core'); w.emit('victory', {}); }
        if (map.arena && map.floor < FLOORS && !w.objs.some((o) => o.type === 'down')) {
            const o = w.addObj('down', map.arena.cx, map.arena.cy + 2);
            map.exit = { x: o.x, y: o.y };
            w.emit('stairsOpen', { x: o.x, y: o.y });
        }
        if (!this.hero.beaten.includes(type)) this.hero.beaten.push(type);
    }

    /** Talking to a townsfolk: returns { npc, name, title, text, quest, services, reward } and applies quest changes. */
    talk(npcId) {
        const n = NPCS[npcId];
        const h = this.hero;
        const out = { npc: npcId, name: n.name, title: n.title, text: this.rng.pick(n.hello), services: n.services.slice(), quest: null, reward: null };
        // Turn in a finished quest first, then offer the next one.
        for (const q of QUESTS) {
            if (q.giver !== npcId) continue;
            if (h.quests[q.id] === 2) {
                h.quests[q.id] = 3;
                out.text = q.done;
                out.quest = { id: q.id, name: q.name, state: 3 };
                out.reward = this.giveReward(q);
                this.world.emit('quest', { id: q.id, state: 3, text: `Quest complete: ${q.name}` });
                return out;
            }
        }
        for (const q of QUESTS) {
            if (q.giver !== npcId || h.quests[q.id] !== 0) continue;
            if (q.needs && h.quests[q.needs] < 3) continue;
            h.quests[q.id] = 1;
            out.text = q.start;
            out.quest = { id: q.id, name: q.name, state: 1 };
            this.world.emit('quest', { id: q.id, state: 1, text: `New quest: ${q.name}` });
            return out;
        }
        const active = QUESTS.find((q) => q.giver === npcId && h.quests[q.id] === 1);
        if (active && this.rng.chance(0.5)) out.text = `Still waiting on that thing. ${active.hint}`;
        if (npcId === 'cane' && h.quests.core === 3 && h.difficulty < DIFFICULTIES.length - 1) out.services.push('difficulty');
        if (npcId === 'granny') this.heal();
        return out;
    }

    giveReward(q) {
        const h = this.hero, r = q.reward, w = this.world;
        const got = [];
        if (r.skill) { h.skillPts += r.skill; got.push(`+${r.skill} skill point${r.skill > 1 ? 's' : ''}`); }
        if (r.sugar) { const s = Math.round(r.sugar * (1 + h.difficulty * 0.8)); h.sugar += s; got.push(`${s} sugar`); }
        if (r.maxHp) { h.bonus.maxHp += r.maxHp; w.refreshStats(); got.push(`+${r.maxHp} max Freshness`); }
        if (r.potions) { addPotion(h, 'hp', r.potions); got.push(`${r.potions} Strawberry Jams`); }
        const give = (it) => { it.identified = true; if (!addToInv(h, it)) w.dropItem(it); got.push(it.name); };
        const lvl = Math.max(h.level, floorLevel(q.floor) + this.diff.lvl) + 2;
        if (r.item) give(makeItem(this.rng, rollKind(this.rng, h.cls), lvl, this.rng.chance(0.25) ? 'legendary' : 'rare', { identified: true }));
        if (r.forge) give(makeItem(this.rng, this.rng.pick(CLASSES[h.cls].weapons), lvl + 2, this.rng.chance(0.4) ? 'legendary' : 'rare', { identified: true }));
        if (r.legendary) give(makeItem(this.rng, 'melee2', Math.max(lvl, 9), 'legendary', { legendary: r.legendary, identified: true }));
        return got;
    }

    nextDifficulty() {
        const h = this.hero;
        if (h.quests.core !== 3 || h.difficulty >= DIFFICULTIES.length - 1) return false;
        h.difficulty++;
        for (const q of QUESTS) h.quests[q.id] = 0;
        h.waypoints = [0];
        h.maxFloor = 0;
        this.floors.clear();
        this.portal = null;
        this.enter(0, 'waypoint');
        return true;
    }

    heal() {
        const w = this.world;
        w.hero.hp = w.hero.maxHp; w.hero.juice = w.hero.maxJuice;
        w.emit('healed', {});
    }

    // ------------------------------------------------------------------ shops
    shop(kind) {
        const h = this.hero;
        const key = `${kind}:${h.shopVisit}:${h.level}:${h.difficulty}`;
        if (!this.shops[kind] || this.shops[kind].key !== key) {
            const lvl = Math.max(1, Math.min(h.level, floorLevel(Math.max(1, h.maxFloor)) + this.diff.lvl + 1));
            this.shops[kind] = { key, items: shopStock(new RNG(sub(h.seed, 'shop', kind, h.shopVisit, h.level)), kind, lvl, h.cls) };
        }
        return this.shops[kind].items;
    }
    buy(kind, idx) {
        const items = this.shop(kind);
        const it = items[idx];
        if (!it) return 'gone';
        const p = buyPrice(it);
        if (this.hero.sugar < p) return 'Not enough sugar';
        if (freeSlot(this.hero.inv) < 0) return 'Backpack full';
        this.hero.sugar -= p;
        items.splice(idx, 1);
        addToInv(this.hero, it);
        return '';
    }
    sell(invIdx) { return sellFromInv(this.hero, invIdx); }
    buyPotion(kind, n = 1) {
        const h = this.hero;
        const p = potionPrice(kind, h.level);
        let bought = 0;
        for (let i = 0; i < n; i++) {
            if (h.sugar < p || h.potions[kind] >= potionCap(kind)) break;
            h.sugar -= p; h.potions[kind]++; bought++;
        }
        return bought;
    }
    gamblePrice(kind) { const lvl = this.hero.level; return Math.round((kind === 'ring' || kind === 'neck' ? 90 : 60) + lvl * lvl * 2.2 + lvl * 14); }
    gamble(kind) {
        const h = this.hero;
        const p = this.gamblePrice(kind);
        if (h.sugar < p) return { err: 'Not enough sugar' };
        if (freeSlot(h.inv) < 0) return { err: 'Backpack full' };
        h.sugar -= p;
        const r = this.rng.next();
        const rarity = r < 0.035 ? 'legendary' : r < 0.2 ? 'rare' : r < 0.6 ? 'magic' : 'normal';
        let k = kind;
        if (kind === 'weapon') k = this.rng.pick(CLASSES[h.cls].weapons);
        if (kind === 'offhand') k = this.rng.pick(CLASSES[h.cls].offhands);
        const it = makeItem(this.rng, k, Math.max(1, h.level + this.rng.int(-1, 3)), rarity, { identified: true, kind: k });
        it.identified = true;
        addToInv(h, it);
        return { item: it };
    }
    identify() { return identifyAll(this.hero); }

    stashPut(invIdx) {
        const h = this.hero; const it = h.inv[invIdx];
        const s = freeSlot(h.stash);
        if (!it || s < 0) return false;
        h.stash[s] = it; h.inv[invIdx] = null; return true;
    }
    stashTake(stashIdx) {
        const h = this.hero; const it = h.stash[stashIdx];
        if (!it || !addToInv(h, it)) return false;
        h.stash[stashIdx] = null; return true;
    }

    // ------------------------------------------------------------------ saving
    serialize() {
        const h = this.hero;
        if (this.world) { h.hp = this.world.hero.dead ? undefined : this.world.hero.hp; h.juice = this.world.hero.juice; }
        return JSON.stringify(h);
    }
    stats() { return computeStats(this.hero); }
}

export function loadHero(json) {
    const h = typeof json === 'string' ? JSON.parse(json) : json;
    if (!h || !h.cls || !CLASSES[h.cls]) throw new Error('bad save');
    for (const q of QUESTS) if (!(q.id in h.quests)) h.quests[q.id] = 0;
    h.hp = undefined; h.juice = undefined;
    return h;
}
