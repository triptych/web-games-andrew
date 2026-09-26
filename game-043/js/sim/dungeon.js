// ============================================================
// Dungeons and caves at runtime: entering, floors, stairs, keys,
// chests, story chests, bosses, and the way home.
// ============================================================

import { rngFor } from '../core/rng.js';
import { O, G } from '../data/tiles.js';
import { ITEM } from '../data/items.js';
import { BIOMES } from '../data/monsters.js';
import { generateFloor } from '../gen/dungeon.js';

const GEAR_BY_TIER = [null, ['copper_sword', 'leather_vest'], ['iron_sword', 'leather_vest', 'iron_mail'], ['iron_mail', 'gold_sword'], ['gold_sword', 'gold_mail'], ['glim_sword', 'gold_mail', 'glim_robe']];

export const DungeonMethods = {
    dstate(id) { return (this.s.dungeons[id] ??= { deepest: 0, cleared: false, chests: {} }); },
    enterSite(id) {
        const site = this.world.siteById[id];
        const D = this.dstate(id);
        if (D.deepest > 1) {
            const deepest = Math.min(D.deepest, site.floors);
            const choices = [{ label: 'Floor 1', act: () => this.gotoFloor(id, 1) }];
            if (deepest > 1) choices.push({ label: `Floor ${deepest} (the rune remembers)`, act: () => this.gotoFloor(id, deepest) });
            choices.push({ label: 'Not now' });
            this.emit('dialog', { name: site.name, lines: [D.cleared ? 'A return rune glows by the door. It will take you to any floor you have reached.' : 'The rune by the door remembers how deep you have been.'], choices });
            return;
        }
        this.gotoFloor(id, 1);
    },
    gotoFloor(id, n, arriveAtDown = false) {
        const site = this.world.siteById[id];
        const f = generateFloor(this.s.seed, site, n);
        const D = this.dstate(id);
        D.deepest = Math.max(D.deepest, n);
        f.opened = new Set();
        for (const c of f.chests) if (D.chests[`${n}:${c.n}`]) f.opened.add(c.y * f.W + c.x);
        // a villager's lost keepsake?
        const job = this.storyChestFor?.(id, n);
        if (job) {
            const r = rngFor(this.s.seed, 'storychest', id, n);
            for (let t = 0; t < 200; t++) {
                const x = r.int(1, f.W - 2), y = r.int(1, f.H - 2), i = y * f.W + x;
                if (f.ground[i] === G.FLOOR && !f.obj[i] && Math.abs(x - f.start.x) + Math.abs(y - f.start.y) > 6) { f.obj[i] = O.CHEST; f.special = { i, job }; break; }
            }
        }
        // the boss is only there until beaten
        if (f.boss) {
            if (D.cleared) { f.obj[f.pedestal.y * f.W + f.pedestal.x] = O.PEDESTAL; f.obj[(f.pedestal.y + 1) * f.W + f.pedestal.x] = O.NONE; }
        }
        this.map = f; this.rt.floor = f; this.rt.floorKey = false;
        this.p.where = id; this.p.floor = n;
        const st = arriveAtDown && f.down ? this.besideFree(f, f.down) : f.start;
        this.p.x = st.x + 0.5; this.p.y = st.y + 0.95; this.p.dir = 0;
        if (this.blockedBox(this.p.x, this.p.y)) { const b = this.besideFree(f, st); this.p.x = b.x + 0.5; this.p.y = b.y + 0.95; }
        // monsters
        const pool = this.byRegion[site.region];
        const r = rngFor(this.s.seed, 'fmon', id, n, this.day);
        const depth = (n - 1) * (site.kind === 'dungeon' ? 1.2 : 0.9);
        this.rt.monsters = f.monsters.map((m, k) => ({ id: `d${k}`, sp: r.pick(pool), x: m.x + 0.5, y: m.y + 0.9, dir: 0, t: 0, vx: 0, vy: 0, depth, stun: 0, fade: 1, region: -1 }));
        if (f.boss && !D.cleared) this.rt.monsters.push({ id: 'boss', sp: `r${site.region}boss`, x: f.boss.x + 0.5, y: f.boss.y + 0.9, dir: 0, t: 0, vx: 0, vy: 0, depth: 0, stun: 0, fade: 1, boss: true, region: -1 });
        this.rt.cooldown = 0.6;
        this.emit('mapchange', { kind: site.kind, site: id, floor: n });
        this.emit('fade');
        this.sfx('stairs');
        this.s.log.unshift(`${site.name} — floor ${n}`);
        this.checkStory?.();
    },
    besideFree(f, p) {
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [0, 2]]) {
            const x = p.x + dx, y = p.y + dy, i = y * f.W + x;
            if (f.ground[i] === G.FLOOR && !f.obj[i]) return { x, y };
        }
        return p;
    },
    descend() {
        const f = this.map; if (this.inWorld) return;
        const site = this.world.siteById[f.site];
        if (f.floor >= site.floors) return;
        this.gotoFloor(f.site, f.floor + 1);
    },
    ascend() {
        const f = this.map; if (this.inWorld) return;
        if (f.floor <= 1) return this.exitSite();
        this.gotoFloor(f.site, f.floor - 1, true);
    },
    exitSite() {
        const f = this.map;
        const site = this.world.siteById[f?.site];
        this.map = this.world; this.rt.floor = null; this.p.where = 'world'; this.p.floor = 0;
        if (site) { this.p.x = site.x + 0.5; this.p.y = site.y + 1.95; this.p.dir = 0; }
        this.rt.monsters = [];
        this.rt.cooldown = 0.8;
        this.emit('mapchange', { kind: 'world' });
        this.emit('fade');
        this.sfx('stairs');
        this.emit('autosave');
    },
    unlockStair(i) {
        const f = this.map;
        if (!this.rt.floorKey) { this.msg('The way down is locked. There must be a key on this floor.', 'key'); this.sfx('deny'); return true; }
        this.rt.floorKey = false;
        f.obj[i] = O.DOWN;
        this.msg('Unlocked!', 'key'); this.sfx('unlock');
        return true;
    },
    openChest(i) {
        const f = this.map;
        if (this.inWorld || f.opened.has(i)) { this.msg('Empty.'); return true; }
        f.opened.add(i);
        this.sfx('chest');
        if (f.special?.i === i) {
            const job = f.special.job;
            const a = this.s.villagers[job].story.active;
            a.found = true;
            this.msg(`You found ${this.people[job].name}'s lost treasure! Bring it back to them.`, 'quest');
            this.emit('dialog', { name: 'A glowing chest', lines: [`Inside, wrapped in cloth: something that can only be ${this.people[job].name}'s. You tuck it away safely.`] });
            return true;
        }
        const c = f.chests.find(c => c.y * f.W + c.x === i);
        if (!c) return true;
        this.dstate(f.site).chests[`${f.floor}:${c.n}`] = true;
        const r = rngFor(this.s.seed, 'chest', f.site, f.floor, c.n);
        const tier = f.region, got = [];
        if (c.key) { this.rt.floorKey = true; got.push('an Old Key'); }
        const gold = r.int(20, 60) * tier + f.floor * 15;
        this.p.gold += gold; got.push(`${gold} gold`);
        const B = BIOMES[tier - 1];
        const roll = r.next();
        if (roll < 0.33) { const rec = this.unknownRecipe(Math.min(5, tier + 1), 'chest', f.site, f.floor, c.n); if (rec) { this.learnRecipe(rec); got.push('a recipe'); } }
        else if (roll < 0.5) { const g = r.pick(GEAR_BY_TIER[tier]); this.give(g, 1, true); got.push(ITEM[g].name); }
        else if (roll < 0.7) { const id = r.pick(B.gem); this.give(id, 1, true); got.push(ITEM[id].name); }
        const mat = r.pick([...B.ore, 'tonic', 'hardwood', r.pick(B.forage)]);
        const n = r.int(2, 4); this.give(mat, n, true); got.push(`${n} ${ITEM[mat].name}`);
        if (f.kind === 'cave' && f.floor === this.world.siteById[f.site].floors) { const g2 = r.pick(B.gem); this.give(g2, 2, true); got.push(`2 ${ITEM[g2].name}`); }
        this.emit('dialog', { name: 'Treasure!', lines: [`Found ${got.join(', ')}.`] });
        this.emit('inv');
        return true;
    },
    bossDefeated(B) {
        const f = this.map;
        const site = this.world.siteById[f.site];
        const D = this.dstate(f.site);
        if (D.cleared) return;
        D.cleared = true;
        this.p.shards = (this.p.shards ?? 0) + 1;
        const relic = BIOMES[site.region - 1].relic;
        const lines = ['The last echo of the fight fades. On a stone pedestal, something is glowing.', 'You found a Heart Shard! It is warm, and it hums like a cat.'];
        if (relic && !this.hasRelic(relic)) { this.p.relics.push(relic); lines.push(`Beside it lies an old relic: the ${ITEM[relic].name}! ${ITEM[relic].desc}`); }
        lines.push('Take the shard home to the Heartwood.');
        f.obj[f.pedestal.y * f.W + f.pedestal.x] = O.PEDESTAL;
        this.addCoziness(60, 'dungeon');
        this.emit('dialog', { name: site.name, lines });
        this.sfx('fanfare');
        this.checkStory?.();
    },
};
