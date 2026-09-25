// ============================================================
// Cooking, workbench crafting, refining stations, the blacksmith
// and tailor, shops, selling, the shipping bin, chests, and the
// menus each building opens.
// ============================================================

import { ITEM, ITEMS, GEM_ELEM } from '../data/items.js';
import { RECIPE, RECIPES, STATIONS, CRAFTS, TOOL_UPGRADE, SMITH_GEAR, TAILOR_GEAR } from '../data/recipes.js';
import { CROPS, cropInSeason } from '../data/crops.js';
import { BUILDING } from '../data/buildings.js';
import { JOBS } from '../data/jobs.js';
import { planIngredients, consumePlan, addTo, countIn, removeFrom } from './inventory.js';
import { ANIMALS } from './farm.js';
import { rngFor } from '../core/rng.js';

export const buyPrice = id => { const it = ITEM[id]; return it.buy ?? Math.max(5, Math.round(it.sell * 2.2)); };

export const CraftMethods = {
    now() { return this.day * 1440 + this.s.time.min; },
    plan(ing) { return planIngredients(this.s.inv, ing, this.s.invSize); },

    // ------------------------------------------------------------ cooking
    canCook(rid) { return this.s.known.recipes.includes(rid) && !!this.plan(RECIPE[rid].ing); },
    cook(rid) {
        const R = RECIPE[rid];
        if (!R || !this.s.known.recipes.includes(rid)) return false;
        const plan = this.plan(R.ing);
        if (!plan) { this.msg('Missing ingredients.'); this.sfx('deny'); return false; }
        consumePlan(this.s.inv, plan, this.s.invSize);
        this.give(rid, 1, true);
        this.s.stats.cooked++;
        this.skillXp('cooking', 4 + R.tier * 2);
        this.msg(`Cooked ${R.name}!`, 'bowl'); this.sfx('cook');
        this.emit('inv');
        return true;
    },

    // ------------------------------------------------------------ workbench
    craftList() {
        return CRAFTS.filter(c => this.s.village.level >= c.lvl && (!c.job || this.isResident(c.job)));
    },
    craft(outId) {
        const c = CRAFTS.find(c => c.out === outId);
        if (!c || !this.craftList().includes(c)) return false;
        const plan = this.plan(c.in);
        if (!plan) { this.msg('Missing materials.'); this.sfx('deny'); return false; }
        consumePlan(this.s.inv, plan, this.s.invSize);
        this.give(c.out, c.n, true);
        this.s.stats.crafted++;
        this.msg(`Crafted ${c.n > 1 ? c.n + ' × ' : ''}${ITEM[c.out].name}.`, 'hammer'); this.sfx('craft');
        this.emit('inv');
        return true;
    },

    // ------------------------------------------------------------ refining
    station(key, kind) {
        if (!this.s.stations[key]) this.s.stations[key] = { kind, queue: [] };
        return this.s.stations[key];
    },
    stationSpeed(key) { return key.startsWith('b:') ? 0.6 : 1; },
    refine(key, kind, idx, times = 1) {
        const st = this.station(key, kind);
        const R = STATIONS[kind]?.recipes[idx];
        if (!R) return false;
        if (st.queue.length >= 3) { this.msg('That station is busy. Collect something first.'); return false; }
        const ing = R.in.map(([k, n]) => [k, n * times]);
        const plan = this.plan(ing);
        if (!plan) { this.msg('Missing materials.'); this.sfx('deny'); return false; }
        consumePlan(this.s.inv, plan, this.s.invSize);
        const start = Math.max(this.now(), ...st.queue.map(q => q.ready));
        st.queue.push({ out: R.out, n: R.n * times, ready: Math.round(start + R.min * times * this.stationSpeed(key)) });
        this.msg(`${STATIONS[kind].name}: making ${R.n * times} × ${ITEM[R.out].name}.`, 'gear'); this.sfx('refine');
        this.emit('inv');
        return true;
    },
    collectStation(key) {
        const st = this.s.stations[key]; if (!st) return 0;
        const now = this.now();
        let n = 0;
        st.queue = st.queue.filter(q => { if (q.ready <= now) { this.give(q.out, q.n, true); n += q.n; return false; } return true; });
        if (n) { this.msg(`Collected ${n} item${n > 1 ? 's' : ''}.`, 'gear'); this.sfx('pickup'); this.emit('inv'); }
        return n;
    },

    // ------------------------------------------------------------ blacksmith & tailor
    upgradeCost(tool) {
        const t = (this.p.tools[tool] ?? 0) + 1;
        const U = TOOL_UPGRADE[t]; if (!U) return null;
        const half = this.s.blessings.includes('smith') ? 0.5 : 1, cheap = this.s.blessings.includes('cheap') ? 0.9 : 1;
        return { tier: t, bar: U.bar, n: U.n, gold: Math.round(U.gold * half * cheap) };
    },
    upgradeTool(tool) {
        const c = this.upgradeCost(tool);
        if (!c) return false;
        if (this.count(c.bar) < c.n || this.p.gold < c.gold) { this.msg(`Need ${c.n} ${ITEM[c.bar].name} and ${c.gold} gold.`); this.sfx('deny'); return false; }
        this.take(c.bar, c.n); this.p.gold -= c.gold;
        this.p.tools[tool] = c.tier;
        if (tool === 'can') this.p.water = 20 + c.tier * 10;
        this.msg(`Your ${ITEM[tool].name} is now ${['', 'Copper', 'Iron', 'Gold', 'Glimmer'][c.tier]}!`, 'hammer'); this.sfx('anvil');
        return true;
    },
    makeGear(list, out) {
        const g = list.find(g => g.out === out);
        if (!g) return false;
        if (g.once && (this.count(out) || (out === 'big_pack' && this.s.invSize > 24))) { this.msg('You already have one.'); return false; }
        const plan = this.plan(g.in);
        if (!plan || this.p.gold < g.gold) { this.msg('Missing materials or gold.'); this.sfx('deny'); return false; }
        consumePlan(this.s.inv, plan, this.s.invSize); this.p.gold -= g.gold;
        if (out === 'big_pack') { this.s.invSize = 36; this.msg('Your backpack now holds 36 items!', 'bag'); }
        else { this.give(out, 1, true); this.msg(`Made ${ITEM[out].name}!`, 'hammer'); }
        this.sfx('anvil'); this.emit('inv');
        return true;
    },
    smithList() { return SMITH_GEAR; },
    tailorList() { return TAILOR_GEAR; },
    socketGem(gem) {
        const el = GEM_ELEM[gem];
        if (!el || !this.take(gem, 1)) return false;
        this.p.weaponElem = el; this.refreshStats();
        this.msg(`Your weapon now carries ${el} power.`, 'gem'); this.sfx('anvil');
        return true;
    },
    equip(id) {
        const it = ITEM[id]; if (!it?.eq) return false;
        const slot = it.eq.slot, cur = this.p.equip[slot];
        if (!this.take(id, 1)) return false;
        if (cur) this.give(cur, 1, true);
        this.p.equip[slot] = id; this.refreshStats();
        this.msg(`Equipped ${it.name}.`); this.sfx('equip'); this.emit('inv');
        return true;
    },
    unequip(slot) {
        const cur = this.p.equip[slot]; if (!cur || slot === 'weapon') return false;
        this.p.equip[slot] = null; this.give(cur, 1, true); this.refreshStats(); this.emit('inv');
        return true;
    },

    // ------------------------------------------------------------ shops
    shopStock(shop) {
        const season = this.season, next = (season + 1) % 4;
        const seeds = s => CROPS.filter(c => c.seasons !== 'any' && cropInSeason(c, s)).map(c => 'seed_' + c.id);
        const r = rngFor(this.s.seed, 'shop', shop, this.day);
        switch (shop) {
            case 'mayor': return seeds(season).filter(id => ITEM[id].buy <= 60);
            case 'farmer': return [...seeds(season), 'hay'];
            case 'store': return [...new Set([...seeds(season), ...seeds(next)])].concat(['hay', 'tonic', 'coal', 'clay', 'flour', 'sugar', 'wood', 'stone', 'fiber', r.pick(['emerald', 'amethyst', 'sapphire', 'honey', 'hardwood', 'oil']), ...(r.chance(0.2) ? ['seed_starbloom'] : [])]);
            case 'carpenter': return ['wood', 'hardwood', 'plank', 'fence', 'bench', 'planter', 'lamp', 'chest_item'];
            case 'blacksmith': return ['coal', 'copper_ore', 'iron_ore', ...(this.s.village.level >= 3 ? ['gold_ore'] : []), 'copper_bar', 'iron_bar'];
            case 'rancher': return ['hay'];
            case 'cook': { const pool = RECIPES.filter(x => x.tier <= 3); return ['bread', ...r.shuffle(pool.map(x => x.id)).slice(0, 4)]; }
            case 'herbalist': return ['tonic', 'ether', 'smelling_salts', 'mint', 'clover'];
            case 'tailor': return ['cloth', 'rope', 'fiber', 'wool'];
            case 'miner': return ['stone', 'coal', 'clay', 'copper_ore', 'iron_ore', 'gold_ore', ...(this.s.village.level >= 5 ? ['glim_ore'] : [])];
            case 'scholar': { const pool = RECIPES.filter(x => x.tier <= 5 && !this.s.known.recipes.includes(x.id)); return r.shuffle(pool.map(x => 'scroll_' + x.id)).slice(0, 3); }
            case 'bard': return ['honey', 'herb_tea', 'berry_tart'];
        }
        return [];
    },
    priceOf(id) {
        const it = ITEM[id];
        if (it.cat === 'scroll') return 350 + (RECIPE[it.teaches]?.tier ?? 1) * 150;
        return buyPrice(id);
    },
    buy(shop, id, n = 1) {
        if (!this.shopStock(shop).includes(id)) return false;
        const cost = this.priceOf(id) * n;
        if (this.p.gold < cost) { this.msg('Not enough gold.'); this.sfx('deny'); return false; }
        this.p.gold -= cost;
        this.give(id, n, true);
        this.sfx('buy'); this.emit('inv');
        return true;
    },
    sellPrice(id) { const it = ITEM[id]; return it?.sell ?? 0; },
    sell(slot, n = 1) {
        const s = this.s.inv[slot];
        if (!s) return false;
        const it = ITEM[s.id];
        if (!it.sell || it.cat === 'tool' || it.key) { this.msg("You can't sell that."); return false; }
        n = Math.min(n, s.n);
        s.n -= n; if (s.n <= 0) this.s.inv[slot] = null;
        this.p.gold += it.sell * n;
        this.s.stats.shipped += it.sell * n;
        this.sfx('sell'); this.emit('inv');
        return true;
    },
    shipMult() { return 1 + (this.isResident('merchant') ? 0.15 : 0) + (this.s.blessings.includes('trade') ? 0.1 : 0); },
    shipSlot(slot, n) {
        const s = this.s.inv[slot];
        if (!s) return false;
        const it = ITEM[s.id];
        if (!it.sell || it.cat === 'tool' || it.key) { this.msg("That can't be shipped."); return false; }
        n = Math.min(n ?? s.n, s.n);
        s.n -= n; if (s.n <= 0) this.s.inv[slot] = null;
        const e = this.s.ship.find(e => e.id === s.id);
        if (e) e.n += n; else this.s.ship.push({ id: s.id, n });
        this.sfx('ship'); this.emit('inv');
        return true;
    },
    unship(id) {
        const e = this.s.ship.find(e => e.id === id); if (!e) return;
        const left = this.give(id, e.n, true);
        this.s.ship = this.s.ship.filter(x => x !== e);
        if (left) this.s.ship.push({ id, n: left });
    },
    shipOvernight() {
        let total = 0;
        const m = this.shipMult();
        for (const e of this.s.ship) total += Math.round(ITEM[e.id].sell * e.n * m);
        if (total) {
            this.p.gold += total; this.s.stats.shipped += total;
            this.report(`The shipping bin earned ${total} gold.`);
            this.addCoziness(Math.floor(total / 250), 'shipping');
        }
        this.s.ship = [];
        return total;
    },

    // ------------------------------------------------------------ chests
    moveBetween(fromSlots, fromSize, toSlots, toSize, idx) {
        const s = fromSlots[idx]; if (!s) return;
        const left = addTo(toSlots, s.id, s.n, toSize);
        if (left === s.n) return;
        if (left) s.n = left; else fromSlots[idx] = null;
        this.emit('inv');
    },

    // ------------------------------------------------------------ building menus
    openBuilding(b) {
        const t = b.type;
        if (t === 'cabin') { this.emit('menu', { kind: 'home' }); return; }
        if (t === 'hall') { this.talkMayor(); return; }
        const B = BUILDING[t];
        if (B.animals) { this.emit('menu', { kind: 'animals', home: B.animals }); return; }
        if (B.greenhouse) { this.emit('menu', { kind: 'greenhouse' }); return; }
        const job = B.job;
        if (this.s.movingIn[job] !== undefined) { this.emit('dialog', { name: B.name, lines: [`Boxes everywhere. ${this.people[job].name} is moving in tomorrow morning.`] }); return; }
        this.emit('menu', { kind: 'shopfront', job, building: t });
    },
    keeperHere(job) {
        const v = this.s.villagers[job];
        if (!v?.joined || v.away) return false;
        const m = this.s.time.min;
        return m >= 8 * 60 && m < 20 * 60;
    },
    shopFor(job) { return { carpenter: 'carpenter', farmer: 'farmer', blacksmith: 'blacksmith', rancher: 'rancher', cook: 'cook', herbalist: 'herbalist', merchant: 'store', tailor: 'tailor', miner: 'miner', scholar: 'scholar', bard: 'bard' }[job]; },
    tavernTreat() {
        if (this.p.gold < 120) { this.msg('Not enough gold.'); return false; }
        if (this.s.flags.tavern === this.day) { this.msg("You've already had a night at the tavern today."); return false; }
        this.p.gold -= 120; this.s.flags.tavern = this.day;
        this.p.energy = Math.min(this.p.maxEnergy, this.p.energy + 40);
        this.p.buffs = { day: this.day, atk: 2, def: 2, spd: 1, luck: 5 }; this.refreshStats();
        this.msg('A song, a warm drink, a lot of laughing. ATK/DEF +2, SPD +1 today.', 'music'); this.sfx('fanfare');
        for (const j of this.residents()) this.befriend(j, 5);
        return true;
    },
    animalsFor(home) { return Object.entries(ANIMALS).filter(([, A]) => A.home === home).map(([k]) => k); },
    addHayToSilo(n) { const k = Math.min(n, this.count('hay')); if (k) { this.take('hay', k); this.s.hay += k; this.msg(`Put ${k} hay in the silo.`); } return k; },
};

export { STATIONS, JOBS, countIn, removeFrom, ITEMS };
