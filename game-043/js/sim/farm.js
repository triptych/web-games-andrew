// ============================================================
// Crops, sprinklers, the greenhouse, and animals.
// ============================================================

import { G, O } from '../data/tiles.js';
import { ITEM } from '../data/items.js';
import { CROP, cropInSeason, cropStage } from '../data/crops.js';

export const ANIMALS = {
    chicken: { name: 'Chicken', home: 'coop', price: 400, produce: 'egg', big: 'egg_l', every: 1, hue: 45 },
    duck: { name: 'Duck', home: 'coop', price: 650, produce: 'duck_egg', big: 'gold_feather', every: 2, hue: 60, bigChance: 0.15 },
    cow: { name: 'Cow', home: 'barn', price: 1000, produce: 'milk', big: 'milk_l', every: 1, hue: 30 },
    goat: { name: 'Goat', home: 'barn', price: 1300, produce: 'goat_milk', big: 'goat_milk', every: 2, hue: 35 },
    sheep: { name: 'Sheep', home: 'barn', price: 1500, produce: 'wool', big: 'wool_fine', every: 2, hue: 50 },
};
export const HOUSE_CAP = 6;
const ANIMAL_NAMES = ['Clover', 'Biscuit', 'Maple', 'Pudding', 'Button', 'Waffles', 'Pip', 'Daisy', 'Nutmeg', 'Hazel', 'Marshmallow', 'Pickle', 'Bramble', 'Toffee', 'Dumpling', 'Pebble'];

export const FarmMethods = {
    // ------------------------------------------------------------ tiles
    isFarmTile(i) { return this.map === this.world && this.world.ground[i] === G.FARM; },
    tillAt(i) {
        if (!this.isFarmTile(i)) { this.msg('You can only till your field (south of your cabin).'); return true; }
        const w = this.world;
        if (w.obj[i]) { this.msg('Clear that first.'); return true; }
        if (this.s.world.tilled[i]) { this.rt.swing = 0.2; return true; }
        if (!this.useEnergy(this.energyCost('hoe'))) return true;
        this.s.world.tilled[i] = { w: ['rain', 'storm', 'snow'].includes(this.s.weather) ? 1 : 0 };
        this.rt.swing = 0.25; this.rt.cooldown = 0.15;
        this.sfx('till'); this.skillXp('farming', 1); this.emit('tile', i);
        return true;
    },
    plantAt(i, seedId) {
        const t = this.s.world.tilled[i];
        if (!t) { this.msg(this.isFarmTile(i) ? 'Till the soil with the hoe first.' : 'Seeds go in tilled soil on your field.'); return true; }
        if (this.s.world.crops[i]) { this.msg('Something is already growing there.'); return true; }
        const c = CROP[ITEM[seedId].crop];
        if (!cropInSeason(c, this.season)) { this.msg(`${c.name} won't grow in ${['spring', 'summer', 'fall', 'winter'][this.season]}.`); this.sfx('deny'); return true; }
        this.take(seedId, 1);
        this.s.world.crops[i] = { id: c.id, age: 0, done: 0 };
        this.s.stats.planted++;
        this.sfx('plant'); this.skillXp('farming', 1); this.emit('tile', i);
        this.rt.cooldown = 0.12;
        return true;
    },
    waterAt(i) {
        const t = this.s.world.tilled[i];
        if (!t) return false;
        if (this.p.water <= 0) { this.msg('Your can is empty. Refill it at the pond.'); this.sfx('deny'); return true; }
        if (t.w) { this.rt.swing = 0.2; return true; }
        if (!this.useEnergy(this.energyCost('can'))) return true;
        this.p.water--; t.w = 1;
        this.rt.swing = 0.25; this.rt.cooldown = 0.12;
        this.sfx('water'); this.skillXp('farming', 1); this.emit('tile', i);
        return true;
    },
    harvestAt(i) {
        const c = this.s.world.crops[i];
        if (!c || this.map !== this.world) return false;
        const C = CROP[c.id];
        if (c.age < C.days) return false;
        const r = this.rng('harvest', i);
        const n = C.yield + (r.chance(0.08 + this.p.skills.farming.lv * 0.02) ? 1 : 0);
        this.give(c.id, n);
        this.s.stats.harvested += n;
        if (!this.s.stats.first[c.id]) { this.s.stats.first[c.id] = this.day; this.addCoziness?.(5, 'first harvest'); }
        if (C.regrow) { c.age = C.days - C.regrow; c.done++; } else delete this.s.world.crops[i];
        this.skillXp('farming', 3 + Math.round(C.sell / 40));
        this.sfx('harvest'); this.emit('tile', i); this.emit('harvest', { id: c.id, i });
        return true;
    },

    // ------------------------------------------------------------ overnight
    growCrops(rained) {
        const W = this.s.world;
        const season = this.season;
        const r = this.rng('grow');
        for (const [k, c] of Object.entries(W.crops)) {
            const t = W.tilled[k];
            const C = CROP[c.id];
            if (!cropInSeason(C, season)) { delete W.crops[k]; continue; }
            if ((t && t.w) || rained) {
                c.age++;
                if (this.s.blessings.includes('farm1') && r.chance(0.1)) c.age++;
                if (this.s.blessings.includes('farm') && r.chance(0.1)) c.age++;
            }
        }
        for (const t of Object.values(W.tilled)) t.w = rained ? 1 : 0;
        // untended tilled soil slowly goes back to grass
        for (const k of Object.keys(W.tilled)) if (!W.crops[k] && r.chance(0.08)) delete W.tilled[k];
    },
    morningWatering() {
        const W = this.s.world, w = this.world;
        let n = 0;
        for (const [k, pl] of Object.entries(W.placed)) {
            const i = +k;
            if (pl.id !== 'sprinkler' && pl.id !== 'sprinkler2') continue;
            const offs = pl.id === 'sprinkler' ? [1, -1, w.W, -w.W] : [1, -1, w.W, -w.W, w.W + 1, w.W - 1, -w.W + 1, -w.W - 1];
            for (const d of offs) if (W.tilled[i + d]) { W.tilled[i + d].w = 1; n++; }
        }
        if (this.isResident('farmer') && !this.s.villagers.farmer.away) {
            let k = 0;
            for (const [key, c] of Object.entries(W.crops)) { const t = W.tilled[key]; if (t && !t.w) { t.w = 1; if (++k >= 12) break; } }
            if (k) this.report(`${this.people.farmer.name} watered ${k} of your crops.`);
        }
        return n;
    },
    /** Did seasons just change (to warn about out-of-season crops)? */
    cropsOutOfSeasonTomorrow() {
        const nextSeason = Math.floor(this.day / 12) % 4;
        if (nextSeason === this.season) return 0;
        let n = 0;
        for (const c of Object.values(this.s.world.crops)) if (!cropInSeason(CROP[c.id], nextSeason)) n++;
        return n;
    },
    cropStageAt(i) { const c = this.s.world.crops[i]; return c ? cropStage(CROP[c.id], c.age) : -1; },

    // ------------------------------------------------------------ greenhouse (12 plots, always watered, any season)
    greenhousePlant(slot, seedId) {
        const gh = this.s.greenhouse;
        if (gh[slot]) return false;
        const c = CROP[ITEM[seedId]?.crop];
        if (!c || !this.take(seedId, 1)) return false;
        gh[slot] = { id: c.id, age: 0 };
        this.sfx('plant'); this.s.stats.planted++;
        return true;
    },
    greenhouseHarvest(slot) {
        const gh = this.s.greenhouse, c = gh[slot];
        if (!c) return false;
        const C = CROP[c.id];
        if (c.age < C.days) return false;
        this.give(c.id, C.yield);
        this.s.stats.harvested += C.yield;
        if (C.regrow) c.age = C.days - C.regrow; else gh[slot] = null;
        this.skillXp('farming', 3); this.sfx('harvest');
        return true;
    },
    growGreenhouse() { for (const c of this.s.greenhouse) if (c) c.age++; },

    // ------------------------------------------------------------ animals
    hasHouse(home) { return Object.values(this.s.world.lots).some(l => l && l.b === home); },
    animalsIn(home) { return this.s.animals.filter(a => ANIMALS[a.kind].home === home); },
    buyAnimal(kind) {
        const A = ANIMALS[kind];
        if (!this.hasHouse(A.home)) { this.msg(`You need a ${A.home === 'coop' ? 'Coop' : 'Barn'} first.`); return false; }
        if (this.animalsIn(A.home).length >= HOUSE_CAP) { this.msg(`Your ${A.home} is full.`); return false; }
        if (this.p.gold < A.price) { this.msg('Not enough gold.'); this.sfx('deny'); return false; }
        this.p.gold -= A.price;
        const r = this.rng('animal', this.s.animals.length);
        const used = new Set(this.s.animals.map(a => a.name));
        let name = r.pick(ANIMAL_NAMES); let k = 0;
        while (used.has(name) && k++ < 30) name = r.pick(ANIMAL_NAMES);
        const love = this.s.blessings.includes('ranch') ? 300 : 100;
        this.s.animals.push({ id: 'a' + this.day + '_' + this.s.animals.length, kind, name, love, fed: 1, petted: 0, age: 0, ready: null });
        this.msg(`${name} the ${A.name.toLowerCase()} joined your ${A.home}!`, 'heart'); this.sfx('buy');
        this.emit('animals');
        return true;
    },
    petAnimal(id) {
        const a = this.s.animals.find(a => a.id === id);
        if (!a) return;
        if (a.petted === this.day) { this.msg(`${a.name} is happy.`); return; }
        a.petted = this.day; a.love = Math.min(1000, a.love + 20);
        this.msg(`You pet ${a.name}. ♥`, 'heart'); this.sfx('pet');
        this.emit('petted', a);
    },
    collectProduce(home) {
        let n = 0;
        for (const a of this.animalsIn(home)) if (a.ready) { this.give(a.ready, 1, true); n++; a.ready = null; }
        if (n) { this.msg(`Collected ${n} goods from the ${home}.`); this.sfx('pickup'); this.emit('inv'); }
        return n;
    },
    animalsMorning() {
        const r = this.rng('animals');
        const rancher = this.isResident('rancher') && !this.s.villagers.rancher.away;
        let fedN = 0, hungry = 0;
        for (const a of this.s.animals) {
            const A = ANIMALS[a.kind];
            a.age++;
            // feeding happens overnight: the rancher, or hay from the silo
            let fed = false;
            if (rancher) { fed = true; a.love = Math.min(1000, a.love + 5); }
            else if (this.s.hay > 0) { this.s.hay--; fed = true; }
            if (fed) fedN++; else hungry++;
            a.love = Math.max(0, Math.min(1000, a.love + (a.petted === this.day - 1 ? 8 : -10) + (fed ? 0 : -25)));
            if (fed && a.age % A.every === 0 && !a.ready) {
                const bigChance = (A.bigChance ?? 0.05) + a.love / 2000 + (this.s.blessings.includes('ranch') ? 0.1 : 0);
                a.ready = r.chance(bigChance) ? A.big : A.produce;
            }
        }
        if (hungry) this.report(`${hungry} animal${hungry > 1 ? 's went' : ' went'} hungry — cut grass with the scythe for hay.`);
        return fedN;
    },
};
