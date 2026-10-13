/* TALEWRIGHT runtime — state: the party, inventory, gold, switches, variables,
 * self switches, levels and equipment, and save serialisation. Pure data:
 * no drawing, so the Node harness drives it directly. */
(window.TW_MODULES = window.TW_MODULES || []).push(['state', function (TW) {
    'use strict';
    const U = TW.util;
    const STATS = ['hp', 'mp', 'atk', 'def', 'mag', 'spd'];
    const MAX_LEVEL = 99;

    /** Total EXP needed to reach a level. */
    function expFor(level) {
        if (level <= 1) return 0;
        const l = level - 1;
        return Math.floor(8 * Math.pow(l, 2.1) + 12 * l);
    }

    class State {
        constructor(project) {
            this.p = project;
            this.newGame();
        }

        newGame() {
            const s = this.p.system || {};
            this.gold = Math.max(0, s.gold | 0);
            this.items = {};
            this.switches = {};
            this.vars = {};
            this.self = {};
            this.party = [];
            this.reserve = {};       // heroes who left the party keep their progress
            for (const id of s.party || []) this.addActor(id);
            this.mapId = s.startMap || (this.p.maps[0] && this.p.maps[0].id) || 1;
            this.x = s.startX | 0; this.y = s.startY | 0; this.dir = s.startDir || 2;
            this.playtime = 0;
            this.steps = 0;
            this.battles = 0;
            this.bgm = null;
        }

        // ── database lookups ──
        actorDb(id) { return U.byId(this.p.actors, id); }
        itemDb(id) { return U.byId(this.p.items, id); }
        skillDb(id) { return U.byId(this.p.skills, id); }
        enemyDb(id) { return U.byId(this.p.enemies, id); }
        troopDb(id) { return U.byId(this.p.troops, id); }

        // ── actors ──
        makeActor(id) {
            const db = this.actorDb(id);
            if (!db) return null;
            const level = U.clamp(db.level | 0 || 1, 1, MAX_LEVEL);
            const a = { id, name: db.name, level, exp: expFor(level), hp: 1, mp: 0, equip: { weapon: 0, armor: 0, acc: 0 } };
            const eq = db.equip || {};
            for (const slot of ['weapon', 'armor', 'acc']) if (eq[slot] && this.itemDb(eq[slot])) a.equip[slot] = eq[slot];
            a.hp = this.stat(a, 'hp'); a.mp = this.stat(a, 'mp');
            return a;
        }
        addActor(id) {
            if (this.party.some((a) => a.id === id)) return false;
            if (this.party.length >= 4) return false;
            const a = this.reserve[id] || this.makeActor(id);
            if (!a) return false;
            delete this.reserve[id];
            this.party.push(a);
            return true;
        }
        removeActor(id) {
            const i = this.party.findIndex((a) => a.id === id);
            if (i < 0) return false;
            this.reserve[id] = this.party[i];
            this.party.splice(i, 1);
            return true;
        }
        inParty(id) { return this.party.some((a) => a.id === id); }
        leader() { return this.party[0] || null; }

        base(a, key) {
            const db = this.actorDb(a.id);
            if (!db) return 1;
            const b = (db.stats && db.stats[key]) || 0, g = (db.gain && db.gain[key]) || 0;
            return Math.floor(b + g * (a.level - 1));
        }
        equipBonus(a, key) {
            let n = 0;
            for (const slot of ['weapon', 'armor', 'acc']) {
                const it = a.equip[slot] && this.itemDb(a.equip[slot]);
                if (it && it[key]) n += it[key] | 0;
            }
            return n;
        }
        stat(a, key) {
            const v = this.base(a, key) + (key === 'hp' || key === 'mp' ? 0 : this.equipBonus(a, key));
            return Math.max(key === 'hp' ? 1 : 0, Math.min(9999, v));
        }
        maxHp(a) { return this.stat(a, 'hp'); }
        maxMp(a) { return this.stat(a, 'mp'); }
        alive(a) { return a.hp > 0; }

        skillsOf(a) {
            const db = this.actorDb(a.id);
            if (!db) return [];
            return (db.skills || []).filter((s) => s.level <= a.level && this.skillDb(s.skill)).map((s) => s.skill);
        }

        /** Give EXP; returns [{ actor, level, learned: [skillIds] }] for each level gained. */
        gainExp(a, n) {
            const ups = [];
            if (!n || a.level >= MAX_LEVEL) return ups;
            a.exp = Math.max(0, a.exp + n);
            const db = this.actorDb(a.id) || {};
            while (a.level < MAX_LEVEL && a.exp >= expFor(a.level + 1)) {
                const oldHp = this.maxHp(a), oldMp = this.maxMp(a);
                a.level++;
                if (a.hp > 0) { a.hp += this.maxHp(a) - oldHp; a.mp += this.maxMp(a) - oldMp; }
                const learned = (db.skills || []).filter((s) => s.level === a.level).map((s) => s.skill);
                ups.push({ actor: a, level: a.level, learned });
            }
            a.hp = Math.min(a.hp, this.maxHp(a)); a.mp = Math.min(a.mp, this.maxMp(a));
            return ups;
        }
        recoverAll() {
            for (const a of this.party) { a.hp = this.maxHp(a); a.mp = this.maxMp(a); }
        }

        // ── items and gold ──
        count(id) { return this.items[id] | 0; }
        has(id) {
            if (this.count(id) > 0) return true;
            return this.party.some((a) => a.equip.weapon === id || a.equip.armor === id || a.equip.acc === id);
        }
        gainItem(id, n) {
            if (!this.itemDb(id)) return 0;
            const before = this.count(id);
            const after = U.clamp(before + (n | 0), 0, 99);
            if (after) this.items[id] = after; else delete this.items[id];
            return after - before;
        }
        gainGold(n) { this.gold = U.clamp(this.gold + (n | 0), 0, 9999999); }
        inventory() {
            const list = [];
            for (const it of this.p.items || []) if (this.count(it.id) > 0) list.push(it);
            return list;
        }

        slotFor(item) { return item.kind === 'weapon' ? 'weapon' : item.kind === 'armor' ? 'armor' : item.kind === 'accessory' ? 'acc' : null; }
        equip(a, slot, itemId) {
            const old = a.equip[slot];
            if (itemId) {
                if (this.count(itemId) <= 0) return false;
                this.gainItem(itemId, -1);
            }
            if (old) this.gainItem(old, 1);
            a.equip[slot] = itemId || 0;
            a.hp = Math.min(a.hp, this.maxHp(a)); a.mp = Math.min(a.mp, this.maxMp(a));
            return true;
        }

        /** Use a consumable on an actor outside battle. Returns true when it did something. */
        useItemOn(item, a) {
            if (!item || item.kind !== 'consumable') return false;
            let did = false;
            if (item.revive && a.hp <= 0) { a.hp = Math.max(1, Math.floor(this.maxHp(a) * (item.pct ? (item.hp || 25) / 100 : 0.25))); did = true; }
            else if (a.hp > 0) {
                if (item.hp) { const n = item.pct ? Math.floor(this.maxHp(a) * item.hp / 100) : item.hp; if (a.hp < this.maxHp(a)) { a.hp = Math.min(this.maxHp(a), a.hp + n); did = true; } }
                if (item.mp) { const n = item.pct ? Math.floor(this.maxMp(a) * item.mp / 100) : item.mp; if (a.mp < this.maxMp(a)) { a.mp = Math.min(this.maxMp(a), a.mp + n); did = true; } }
            }
            return did;
        }

        // ── switches, variables, self switches ──
        sw(id) { return !!this.switches[id]; }
        setSw(id, v) { if (id > 0) this.switches[id] = !!v; }
        v(id) { return this.vars[id] | 0; }
        setV(id, n) { if (id > 0) this.vars[id] = U.clamp(Math.trunc(Number(n) || 0), -9999999, 9999999); }
        selfKey(mapId, evId, k) { return mapId + ':' + evId + ':' + k; }
        selfSw(mapId, evId, k) { return !!this.self[this.selfKey(mapId, evId, k)]; }
        setSelf(mapId, evId, k, v) { const key = this.selfKey(mapId, evId, k); if (v) this.self[key] = true; else delete this.self[key]; }

        // ── saves ──
        serialize() {
            return {
                v: 1, mapId: this.mapId, x: this.x, y: this.y, dir: this.dir,
                gold: this.gold, items: this.items, switches: this.switches, vars: this.vars, self: this.self,
                party: this.party, reserve: this.reserve, playtime: Math.floor(this.playtime), steps: this.steps, battles: this.battles, bgm: this.bgm,
                leader: this.leader() ? this.leader().id : 0, level: this.leader() ? this.leader().level : 1,
            };
        }
        load(d) {
            if (!d || typeof d !== 'object') return false;
            this.newGame();
            const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
            this.mapId = d.mapId | 0 || this.mapId; this.x = d.x | 0; this.y = d.y | 0; this.dir = [2, 4, 6, 8].includes(d.dir) ? d.dir : 2;
            this.gold = Math.max(0, d.gold | 0);
            this.items = {}; for (const k of Object.keys(obj(d.items))) if (this.itemDb(+k)) this.items[k] = U.clamp(d.items[k] | 0, 0, 99);
            this.switches = obj(d.switches); this.vars = obj(d.vars); this.self = obj(d.self);
            const fix = (a) => {
                if (!a || !this.actorDb(a.id)) return null;
                const m = this.makeActor(a.id);
                m.level = U.clamp(a.level | 0, 1, MAX_LEVEL); m.exp = Math.max(0, a.exp | 0);
                m.equip = Object.assign({ weapon: 0, armor: 0, acc: 0 }, a.equip || {});
                for (const s of ['weapon', 'armor', 'acc']) if (m.equip[s] && !this.itemDb(m.equip[s])) m.equip[s] = 0;
                m.hp = U.clamp(a.hp | 0, 0, this.maxHp(m)); m.mp = U.clamp(a.mp | 0, 0, this.maxMp(m));
                return m;
            };
            this.party = (Array.isArray(d.party) ? d.party : []).map(fix).filter(Boolean).slice(0, 4);
            this.reserve = {}; for (const k of Object.keys(obj(d.reserve))) { const m = fix(d.reserve[k]); if (m) this.reserve[k] = m; }
            this.playtime = Math.max(0, +d.playtime || 0); this.steps = d.steps | 0; this.battles = d.battles | 0; this.bgm = d.bgm || null;
            if (!U.byId(this.p.maps, this.mapId)) this.newGame();
            return true;
        }
    }

    TW.State = State;
    TW.expFor = expFor;
    TW.STATS = STATS;
}]);
