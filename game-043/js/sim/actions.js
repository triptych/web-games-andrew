// ============================================================
// The A button. One "smart action" that looks at what you face
// and does the obvious thing; farming and placing use the selected
// hotbar item. Also: objects, glimmers, gates, the Heartwood.
// ============================================================

import { G, O, BREAK, GLIMMER_INFO } from '../data/tiles.js';
import { ITEM } from '../data/items.js';
import { BIOMES, GATE_RELIC } from '../data/monsters.js';
import { RECIPE, RECIPES } from '../data/recipes.js';
import { ORE_BY_VAR } from '../gen/dungeon.js';
import { SHARD_BLESSINGS, RETURN_LINES, GATE_TEXT } from '../data/story.js';
import { DIRS } from './game.js';
import { rngFor } from '../core/rng.js';

export const ActionMethods = {
    action() {
        const rt = this.rt;
        if (rt.cooldown > 0 || rt.battle) return;
        const f = this.facingTile();
        const m = this.map;
        // people first
        const npc = this.npcNear?.(f.x + 0.5, f.y + 0.5, 0.95);
        if (npc) { this.talkTo(npc.id); rt.cooldown = 0.3; return; }
        // a monster in reach: you get the first strike
        const mon = this.monsterNear?.(this.p.x + DIRS[this.p.dir][0] * 0.8, this.p.y - 0.2 + DIRS[this.p.dir][1] * 0.8, 1.1);
        if (mon) { rt.swing = 0.25; this.sfx('swing'); this.engage(mon, true); return; }
        // animals
        const an = this.animalNear?.(f.x + 0.5, f.y + 0.5, 0.9);
        if (an) { this.petAnimal(an.id); rt.cooldown = 0.3; return; }
        // buildings
        const b = this.buildingAt(f.x + 0.5, f.y + 0.5);
        if (b) { this.openBuilding(b); rt.cooldown = 0.3; return; }
        // ripe crops, objects, tiles
        if (this.harvestAt?.(f.i)) { rt.cooldown = 0.2; return; }
        const o = m.obj[f.i];
        if (o && this.interactObj(f.i, o, f)) return;
        // what's under your feet (forage you're standing on)
        const own = this.tileIndex(this.p.x, this.p.y - 0.2);
        if (m.obj[own] === O.FORAGE && this.interactObj(own, O.FORAGE)) return;
        // selected item
        if (this.useSelected(f)) return;
        rt.swing = 0.2;
    },

    useSelected(f) {
        const sel = this.selected();
        const m = this.map;
        if (!sel) return false;
        const it = ITEM[sel.id];
        if (!it) return false;
        const g = m.ground[f.i];
        if (sel.id === 'can') {
            if (g === G.WATER || g === G.SHALLOW) return this.refillCan();
            return this.waterAt?.(f.i) ?? false;
        }
        if (sel.id === 'hoe') return this.tillAt?.(f.i) ?? false;
        if (it.cat === 'seed') return this.plantAt?.(f.i, sel.id) ?? false;
        if (it.place) return this.placeItem(f, sel.id);
        if (it.teaches) { this.readScroll(sel.id); return true; }
        if (it.food) { this.eat(sel.id); return true; }
        if (['axe', 'pick', 'scythe'].includes(sel.id)) { this.rt.swing = 0.2; this.sfx('swing'); return true; }
        return false;
    },

    refillCan() {
        const cap = 20 + this.p.tools.can * 10;
        if (this.p.water >= cap) { this.msg('Your watering can is full.'); return true; }
        this.p.water = cap; this.msg('Filled the watering can.', 'water'); this.sfx('water');
        this.rt.swing = 0.25;
        return true;
    },

    toolOwned(tool) { return this.count(tool) > 0; },

    // ------------------------------------------------------------ objects
    interactObj(i, o, f) {
        const m = this.map;
        const br = BREAK[o];
        if (br && (br.tool || br.relic)) return this.hitObj(i, o, br);
        switch (o) {
            case O.FORAGE: return this.pickForage(i);
            case O.DARK: this.msg(this.hasRelic('lantern') ? 'Your lantern pushes the dark aside.' : "It's pitch dark in there. You'd need a light to go on."); return true;
            case O.OLDTREE: this.msg('An ancient tree, far too big to chop.'); return true;
            case O.SIGN: { const R = this.world.regions[m.ov[i] - 1]; if (R) this.emit('dialog', { name: 'Signpost', lines: [`${R.name}`, `Here lie the old roads of the ${R.biome.id === 'lake' ? 'lake country' : R.biome.id}. ${R.sites.map(id => this.world.siteById[id].name).join(' and ')} can be found somewhere ahead.`] }); return true; }
            case O.LOTSIGN: this.openLot?.(m.ov[i]); return true;
            case O.BOARD: this.openBoard?.(); return true;
            case O.BIN: this.emit('menu', { kind: 'ship' }); return true;
            case O.DUNGEON: case O.CAVE: return this.enterSiteAt(i);
            case O.FACADE: { for (const d of [0, 1, -1, this.world.W, this.world.W + 1, this.world.W - 1, 2 * this.world.W]) if (m.obj[i + d] === O.DUNGEON || m.obj[i + d] === O.CAVE) return this.enterSiteAt(i + d); return false; }
            case O.GLIMMER: return this.touchGlimmer(i);
            case O.HEART: this.touchHeart(); return true;
            case O.PLACED: return this.usePlaced(i);
            case O.CHEST: return this.openChest?.(i) ?? false;
            case O.LOCKED: return this.unlockStair?.(i) ?? false;
            case O.PEDESTAL: this.msg('An empty pedestal. The shard is yours now.'); return true;
            case O.UP: this.ascend?.(); return true;
            case O.DOWN: this.descend?.(); return true;
        }
        return false;
    },

    hitObj(i, o, br) {
        const m = this.map;
        if (br.relic) {
            if (!this.hasRelic(br.relic)) {
                const need = ITEM[br.relic].name;
                this.msg(o === O.THORN ? `A wall of enchanted thorns. Something like the ${need} might cut it.` : `A huge boulder. You'd need the ${need} to move it.`);
                this.sfx('deny'); return true;
            }
            this.removeObj(i, false);
            if (m === this.world) this.s.world.gates[i] = 1;
            this.dropItems(br.drops);
            this.sfx(o === O.THORN ? 'cut' : 'smash'); this.rt.swing = 0.25;
            // clear connected gate tiles in one go, so the gate opens at once
            for (const d of [1, -1, m.W, -m.W]) if (m.obj[i + d] === o) this.hitObj(i + d, o, br);
            return true;
        }
        const tool = br.tool;
        if (tool === 'scythe' && !this.toolOwned('scythe') && !br.hand) { this.msg('You need a scythe for this.'); return true; }
        if (tool !== 'scythe' && !this.toolOwned(tool)) { this.msg(`You need ${tool === 'axe' ? 'an axe' : 'a pickaxe'} for this.`); return true; }
        const tier = this.p.tools[tool] ?? 0;
        if (br.tier && tier < br.tier) { this.msg(`Too hard! Your ${tool === 'pick' ? 'pickaxe' : tool} needs an upgrade (Iron or better).`); this.sfx('clink'); return true; }
        const handOnly = o === O.WEED && !this.toolOwned('scythe');
        const cost = handOnly || o === O.WEED ? 0 : this.energyCost(tool);
        if (cost && !this.useEnergy(cost)) return true;
        this.rt.swing = 0.25; this.rt.cooldown = 0.18;
        const need = Math.max(1, br.hp - Math.floor(tier * 0.75));
        const hits = (this.rt.hits.get(i) ?? 0) + 1;
        this.sfx(tool === 'axe' ? 'chop' : tool === 'pick' ? 'pick' : 'cut');
        this.emit('hit', { i, o });
        if (hits < need) { this.rt.hits.set(i, hits); return true; }
        this.rt.hits.delete(i);
        const inGlen = m === this.world && this.world.region[i] === 0;
        if (br.leaves && !inGlen && m === this.world) { this.world.obj[i] = br.leaves; this.s.world.removed[i] = this.day; this.rt.orig.set(i, o); this.emit('tile', i); }
        else this.removeObj(i, !inGlen);
        // drops
        if (o === O.ORE) {
            const id = m === this.world ? (m.ov[i] === 3 ? 'gold_ore' : m.ov[i] === 2 ? 'iron_ore' : 'copper_ore') : ORE_BY_VAR[m.ov[i]] ?? 'copper_ore';
            const n = 1 + (this.rng('ore', i).chance(0.35 + this.p.skills.mining.lv * 0.04) ? 1 : 0) + (this.s.blessings.includes('mine') ? 1 : 0);
            this.give(id, n); this.dropItems([['stone', 1, 2, 1]]);
        } else if (o === O.GEM) {
            const R = m.region ?? this.world.region[i];
            const gems = BIOMES[Math.max(0, R - 1)].gem;
            this.give(gems[m.ov[i] % gems.length] ?? gems[0], 1); this.sfx('gem');
        } else this.dropItems(br.drops);
        if (br.skill) this.skillXp(br.skill, br.xp);
        this.s.stats.gathered++;
        if (m === this.world && this.world.ground[i] === G.FARM) this.s.stats.farmCleared++;
        // a cave's hidden stair
        if (m !== this.world && m.hiddenDown && m.down && m.down.y * m.W + m.down.x === i) { m.obj[i] = O.DOWN; this.msg('A way down was hidden under the rock!', 'stairs'); this.sfx('secret'); }
        this.emit('broke', { i, o });
        return true;
    },

    dropItems(drops) {
        const r = this.rng('drop', this.s.stats.gathered);
        for (const [id, a, b, ch] of drops) if (r.chance(ch)) this.give(id, r.int(a, b));
    },

    pickForage(i) {
        const m = this.map;
        const f = this.world.forage[m.ov[i]];
        if (!f) return false;
        const id = this.forageItem(f);
        const n = this.rng('forage', i).chance(0.1 + this.p.skills.foraging.lv * 0.03) ? 2 : 1;
        this.give(id, n);
        this.s.world.picked[f.id] = this.day;
        this.world.obj[i] = O.NONE; this.emit('tile', i);
        this.skillXp('foraging', 3); this.sfx('pickup'); this.s.stats.gathered++;
        return true;
    },
    forageItem(f) {
        const pool = f.region === 0 ? ['wild_berry', 'daffodil', 'mint', 'leek', 'hazelnut', 'dandelion'] : BIOMES[f.region - 1].forage;
        const r = rngFor(this.s.seed, 'fitem', f.id, this.season, Math.floor((this.day - 1) / 4));
        return pool[r.int(0, pool.length - 1)];
    },

    // ------------------------------------------------------------ placing
    placeItem(f, id) {
        const it = ITEM[id];
        const w = this.world;
        if (this.map !== w || w.region[f.i] !== 0) { this.msg('You can only place things in the Glen.'); return true; }
        if (w.obj[f.i] || this.bmap.has(f.i) || w.road[f.i] === 2 && w.ground[f.i] !== G.FARM || G.WATER === w.ground[f.i]) {
            if (!(w.ground[f.i] === G.FARM && !w.obj[f.i])) { this.msg("There's no room there."); this.sfx('deny'); return true; }
        }
        if (this.s.world.crops[f.i]) { this.msg("There's a crop there."); return true; }
        if ((id === 'sprinkler' || id === 'sprinkler2') && w.ground[f.i] !== G.FARM) { this.msg('Sprinklers go on your field.'); return true; }
        if (id !== 'sprinkler' && id !== 'sprinkler2' && w.ground[f.i] === G.FARM && id !== 'fence') { this.msg("Keep your field for crops — place that somewhere else in the Glen."); return true; }
        const px = f.x + 0.5, py = f.y + 0.9;
        if (Math.abs(px - this.p.x) < 0.5 && Math.abs(py - this.p.y) < 0.5) return true;
        this.take(id, 1);
        delete this.s.world.tilled[f.i];
        this.placeObj(f.i, id);
        if (it.station) this.s.stations['p' + f.i] = { kind: it.station, queue: [] };
        if (id === 'chest_item') this.s.stations['p' + f.i] = { kind: 'chest', items: new Array(24).fill(null) };
        this.sfx('place'); this.msg(`Placed ${it.name}.`);
        if (it.decor) this.addCoziness?.(4, 'decor');
        return true;
    },
    usePlaced(i) {
        const pl = this.s.world.placed[i];
        if (!pl) return false;
        const it = ITEM[pl.id];
        const st = this.s.stations['p' + i];
        if (st && st.kind === 'chest') { this.emit('menu', { kind: 'chest', key: 'p' + i }); return true; }
        if (it.station) { this.emit('menu', { kind: 'station', key: 'p' + i, station: it.station, tile: i }); return true; }
        this.emit('dialog', { name: it.name, lines: [it.desc ?? ''], choices: [{ label: 'Pick it up', act: () => this.pickUpPlaced(i) }, { label: 'Leave it' }] });
        return true;
    },
    pickUpPlaced(i) {
        const pl = this.s.world.placed[i]; if (!pl) return;
        const st = this.s.stations['p' + i];
        if (st && ((st.queue && st.queue.length) || (st.items && st.items.some(Boolean)))) { this.msg('Empty it first.'); return; }
        delete this.s.stations['p' + i];
        this.unplaceObj(i);
        this.give(pl.id, 1);
        if (ITEM[pl.id].decor) this.addCoziness?.(-4, 'decor');
    },

    // ------------------------------------------------------------ eating and reading
    eat(id) {
        const it = ITEM[id];
        if (!it?.food) return false;
        const f = it.food, p = this.p;
        const mult = (it.cat === 'dish' && this.s.blessings.includes('cook') ? 1.25 : 1) * (it.cat === 'dish' ? 1 + (p.skills.cooking.lv - 1) * 0.03 : 1) * (id === 'tonic' && this.s.blessings.includes('herb') ? 2 : 1);
        if (!this.take(id, 1)) return false;
        if (f.hp) p.hp = Math.min(p.maxHp, p.hp + Math.round(f.hp * mult));
        if (f.en) p.energy = Math.min(p.maxEnergy, p.energy + Math.round(f.en * mult));
        if (f.sp) p.sp = Math.min(p.maxSp, p.sp + f.sp);
        if (f.buff) { p.buffs = { day: this.day, ...f.buff }; this.refreshStats(); this.msg(`${it.name}: ${Object.entries(f.buff).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')} for today.`, 'buff'); }
        else this.msg(`Ate ${it.name}.`);
        this.sfx('eat');
        return true;
    },
    readScroll(id) {
        const it = ITEM[id];
        if (this.s.known.recipes.includes(it.teaches)) { this.msg('You already know this recipe.'); return; }
        this.take(id, 1);
        this.learnRecipe(it.teaches);
    },
    learnRecipe(rid) {
        if (!rid || this.s.known.recipes.includes(rid)) return false;
        this.s.known.recipes.push(rid);
        this.msg(`Learned a recipe: ${RECIPE[rid].name}!`, 'scroll'); this.sfx('learn');
        this.emit('learned', rid);
        return true;
    },
    /** Pick an unknown recipe up to a tier (deterministic for a given source). */
    unknownRecipe(maxTier, ...tag) {
        const pool = RECIPES.filter(r => r.tier <= maxTier && r.tier < 6 && !this.s.known.recipes.includes(r.id));
        if (!pool.length) return null;
        return this.rng('recipe', ...tag).pick(pool).id;
    },

    // ------------------------------------------------------------ glimmers
    glimmerTier() { return this.s.blessings.includes('allmagic') ? 99 : this.s.heartwood; },
    glimmerAt(i) {
        if (!this.rt.gmap) { this.rt.gmap = new Map(); for (const g of this.world.glimmers) this.rt.gmap.set(g.y * this.world.W + g.x, g); }
        return this.map === this.world ? this.rt.gmap.get(i) : null;
    },
    glimmerAwake(g) { return g.tier <= this.glimmerTier() || !!this.s.world.glimmers['r' + g.id]; },
    glimmerAwakeAt(i) { const g = this.glimmerAt(i); return !!g && this.glimmerAwake(g); },
    touchGlimmer(i) {
        const g = this.glimmerAt(i);
        if (!g) return false;
        if (!this.glimmerAwake(g)) {
            this.msg(`Something magical sleeps here… (It will wake when the Heartwood holds ${g.tier} shard${g.tier > 1 ? 's' : ''}.)`, 'sparkle');
            this.sfx('faded');
            return true;
        }
        const W = this.s.world.glimmers;
        const got = W[g.id];
        const info = GLIMMER_INFO[g.kind];
        switch (g.kind) {
            case 'acorn': case 'starfruit': case 'scroll': case 'cache': {
                if (got) return true;
                W[g.id] = 'got';
                if (g.kind === 'acorn') { this.p.bonus.hp += 10; this.refreshStats(); this.p.hp = this.p.maxHp; this.msg('A Heart Acorn! Max HP +10.', 'heart'); }
                if (g.kind === 'starfruit') { this.p.bonus.en += 10; this.refreshStats(); this.p.energy = this.p.maxEnergy; this.msg('A Star Fruit! Max energy +10.', 'star'); }
                if (g.kind === 'scroll') { const r = this.unknownRecipe(Math.min(5, g.region + 1), 'glim', g.id); if (r) this.learnRecipe(r); else this.give('gold', 300); }
                if (g.kind === 'cache') {
                    const r = this.rng('cache', g.id);
                    const R = Math.max(1, g.region);
                    this.give('gold', 150 + R * 120);
                    this.give(r.pick(BIOMES[R - 1].gem), 1);
                    this.give(r.pick(['hardwood', 'iron_ore', 'gold_ore', 'honey', 'elixir', 'tonic', 'wisp_dust']), r.int(1, 3));
                    if (R >= 2 && r.chance(0.4)) this.give('seed_starbloom', 1);
                }
                this.world.obj[i] = O.NONE; this.emit('tile', i); this.sfx('magic');
                this.emit('glimmer', g);
                return true;
            }
            case 'ring': {
                if (!this.p.fastTravel.includes(g.id)) { this.p.fastTravel.push(g.id); this.msg('The fairy ring hums awake. You can travel between awakened rings from here or from the map.', 'sparkle'); this.sfx('magic'); }
                this.emit('menu', { kind: 'travel', from: g.id });
                return true;
            }
            case 'shrine': {
                if (got) { this.msg('The shrine is quiet. Its blessing is already yours.'); return true; }
                this.emit('dialog', { name: info.name, lines: ['An old stone shrine, humming softly. The carving shows three hands: one holding a sword, one a shield, one a feather.', 'Which blessing will you ask for?'], choices: [
                    { label: 'Sword (+1 ATK)', act: () => this.shrineBless(g, 'atk') },
                    { label: 'Shield (+1 DEF)', act: () => this.shrineBless(g, 'def') },
                    { label: 'Feather (+1 SPD)', act: () => this.shrineBless(g, 'spd') }] });
                return true;
            }
            case 'moonwell': {
                if (this.s.moonwell[g.id] === this.day) { this.msg('The moonwell is still. Come back tomorrow.'); return true; }
                this.s.moonwell[g.id] = this.day;
                const p = this.p; p.hp = p.maxHp; p.sp = p.maxSp; p.energy = p.maxEnergy;
                this.msg('You drink from the moonwell. You feel completely restored.', 'heart'); this.sfx('magic');
                return true;
            }
        }
        return false;
    },
    shrineBless(g, stat) {
        this.s.world.glimmers[g.id] = 'got';
        this.p.bonus[stat] += 1; this.refreshStats();
        this.msg(`The shrine glows. ${stat.toUpperCase()} +1 forever.`, 'star'); this.sfx('magic');
    },
    fastTravel(id) {
        const g = this.world.glimmers[id];
        if (!g || !this.p.fastTravel.includes(id) || !this.inWorld) return false;
        this.p.x = g.x + 0.5; this.p.y = g.y + 1.9; this.p.dir = 0;
        if (this.blockedBox(this.p.x, this.p.y)) this.p.y = g.y + 0.9, this.p.x = g.x + 1.5;
        this.rt.monsters = [];
        this.emit('fade'); this.sfx('warp');
        this.revealAround(this.p.x, this.p.y);
        return true;
    },

    // ------------------------------------------------------------ the Heartwood
    touchHeart() {
        const p = this.p;
        if ((p.shards ?? 0) > 0) { this.returnShards(); return; }
        this.talkTo('glim');
    },
    returnShards() {
        const p = this.p;
        const n = p.shards; p.shards = 0;
        const lines = [...RETURN_LINES[0]];
        for (let k = 0; k < n; k++) {
            this.s.heartwood++;
            const B = SHARD_BLESSINGS[this.s.heartwood];
            if (B) { this.s.blessings.push(B.key); lines.push(`The Heartwood's blessing: ${B.text}`); }
        }
        lines.push(`Faded things across the land begin to glow. (Glimmers of tier ${this.s.heartwood} and below are awake.)`);
        this.refreshStats();
        this.addCoziness?.(40 * n, 'shard');
        this.sfx('fanfare');
        this.emit('heartwood', this.s.heartwood);
        this.emit('dialog', { name: this.glim, who: 'glim', lines });
        this.checkStory?.();
    },

    // ------------------------------------------------------------ sites
    enterSiteAt(i) {
        const site = this.world.sites.find(s => s.y * this.world.W + s.x === i);
        if (!site) return false;
        if (site.kind === 'dungeon') {
            const need = site.region;
            const sealed = this.s.village.level < need || (need === 1 && !this.s.village.board);
            if (sealed) {
                this.emit('dialog', { name: site.name, lines: ['A seal of faded light covers the door. It feels cold — like a house nobody lives in.', need === 1 && !this.s.village.board ? 'Maybe once people start living in the Glen again, it will warm up.' : `It might open when your village is a ${this.villageTitle(need)} (level ${need}).`] });
                this.sfx('deny');
                return true;
            }
        }
        this.enterSite?.(site.id);
        return true;
    },
    gateInfo(R) { return GATE_TEXT[R.biome.gate] ?? 'the way in'; },
};
export { GATE_RELIC };
