// A bot that plays through the real World / Game API: fights, loots, equips upgrades, spends
// points, uses town (sell, identify, potions, quests) and descends. Used by dev/simtest.mjs as a
// progression proof and a pacing probe. It is a clumsy, cautious player, not an optimal one.

import { SKILLS, CLASSES } from './data/classes.js';
import { equipFromInv, itemScore, learnSkill, spendStat, usable, canLearn, potionCap } from './hero.js';
import { NPCS } from './data/story.js';
import { walkable } from './tiles.js';
import { los } from './path.js';

const ORDER = {
    knight: ['bigslice', 'bash', 'juiceup', 'bigslice', 'leap', 'blender', 'blender', 'bigslice', 'juiceup', 'slice'],
    ranger: ['pipspray', 'pomegranate', 'roll', 'pipspray', 'peeltrap', 'raisinrain', 'raisinrain', 'pipspray', 'pomegranate', 'seedshot'],
    mage: ['caramelize', 'brainfreeze', 'limening', 'caramelize', 'peelport', 'melonmeteor', 'melonmeteor', 'limening', 'brainfreeze', 'zestbolt'],
};

export class Bot {
    constructor(game) {
        this.game = game;
        this.t = 0;
        this.think = 0;
        this.townPlan = null;
        this.stuckT = 0;
        this.last = { x: 0, y: 0 };
        this.wantTown = false;
        this.log = [];
        this.ignored = new Set();
        this.spent = new Map();
        this.since = 0;
        this.floorTimes = {};
        this.floorEnter = 0;
        this.curFloor = -1;
    }

    get w() { return this.game.world; }
    get hero() { return this.game.hero; }

    step(dt) {
        this.t += dt;
        this.think -= dt;
        const w = this.w;
        if (w.floor !== this.curFloor || w !== this.curWorld) { this.floorTimes[w.floor] = (this.floorTimes[w.floor] || 0); this.curFloor = w.floor; this.curWorld = w; this.floorEnter = this.t; this.townPlan = null; this.goal = null; this.visited = new Set(); }
        if (w.hero.dead) { this.game.respawn(); this.log.push(`died on floor ${this.curFloor} at L${this.hero.level}`); return; }
        if (this.think <= 0) { this.think = 0.12; this.decide(); }
        this.game.update(dt);
        if (w.floor > 0) this.floorTimes[w.floor] = (this.floorTimes[w.floor] || 0) + dt;
    }

    housekeeping() {
        const h = this.hero;
        const main = CLASSES[h.cls].main;
        while (h.statPts > 0) spendStat(h, h.statPts % 5 < 3 ? main : 'vit', 1);
        let guard = 0;
        while (h.skillPts > 0 && guard++ < 50) {
            const order = ORDER[h.cls];
            const pick = order.find((id) => canLearn(h, id) && (h.skills[id] || 0) < 1) || order.find((id) => canLearn(h, id));
            if (!pick || !learnSkill(h, pick)) break;
        }
        // Put every learned skill on the bar.
        const learned = CLASSES[h.cls].skills.filter((s) => h.skills[s] > 0);
        h.bar = [learned[0], learned[1] || learned[0], ...learned.slice(1, 5)];
        while (h.bar.length < 6) h.bar.push(null);
        // Equip upgrades.
        for (let i = 0; i < h.inv.length; i++) {
            const it = h.inv[i];
            if (!it || !usable(h, it)) continue;
            if (it.slot === 'offhand' && h.equip.weapon && h.equip.weapon.twoHanded) continue;
            const slots = it.slot === 'ring' ? ['ring1', 'ring2'] : [it.slot];
            for (const s of slots) {
                const cur = h.equip[s];
                if (itemScore(h, it) > (cur ? itemScore(h, cur) : -1) * 1.05 + 0.5) {
                    if (it.slot === 'weapon' && it.twoHanded && h.equip.offhand && itemScore(h, it) < itemScore(h, h.equip.weapon || it) + itemScore(h, h.equip.offhand)) break;
                    equipFromInv(h, i, s === 'ring2' ? 'ring2' : s === 'ring1' ? 'ring1' : null);
                    break;
                }
            }
        }
        this.w.refreshStats();
    }

    decide() {
        const w = this.w, h = w.hero, g = this.game, hero = this.hero;
        this.housekeeping();
        if (w.town) { this.doTown(); return; }

        // Potions.
        if (h.hp < h.maxHp * 0.45) w.drink('hp');
        if (h.juice < h.maxJuice * 0.15) w.drink('juice');
        const full = hero.inv.filter(Boolean).length >= 34;
        if (!this.wantTown && (full || (hero.potions.hp === 0 && h.hp < h.maxHp * 0.5 && hero.potions.pie > 0))) {
            if (hero.potions.pie > 0 && g.usePie()) this.wantTown = true;
        }
        if (this.wantTown) {
            const p = w.objs.find((o) => o.type === 'portal');
            if (p) { w.heroInteract(p.id); return; }
        }

        // Fight.
        const target = this.pickTarget();
        if (target) { this.fight(target); return; }

        // Loot what we can see.
        const loot = w.items.filter((i) => !this.ignored.has(i.id) && w.visibleTile(i.x, i.y) && w.dist(h, i) < 9 && (!i.item || hero.inv.includes(null)) && !(i.potion && hero.potions[i.potion] >= potionCap(i.potion)))
            .sort((a, b) => w.dist(h, a) - w.dist(h, b))[0];
        if (loot && this.budget(loot.id, 7)) { if (!h.intent || h.intent.id !== loot.id) w.heroInteract(loot.id); return; }
        const obj = w.objs.find((o) => !this.ignored.has(o.id) && (o.type === 'chest' || o.type === 'bigchest' || o.type === 'shrine' || o.type === 'lectern' || o.type === 'anvil') && o.state === 'idle' && w.seen[Math.floor(o.y) * w.map.w + Math.floor(o.x)] && w.dist(h, o) < 12);
        if (obj && this.budget(obj.id, 10)) { if (!h.intent || h.intent.id !== obj.id) w.heroInteract(obj.id); return; }

        // Explore: visit every room (a real player clears the floor), then the goal.
        const rooms = w.map.rooms || [];
        rooms.forEach((r, i) => { if (h.x > r.x - 0.5 && h.x < r.x + r.w + 0.5 && h.y > r.y - 0.5 && h.y < r.y + r.h + 0.5) this.visited.add(i); });
        if (this.t - this.floorEnter < 9 * 60) {
            let best = null, bd = 1e9;
            rooms.forEach((r, i) => { if (this.visited.has(i) || r.boss) return; const d = Math.hypot(r.cx + 0.5 - h.x, r.cy + 0.5 - h.y); if (d < bd) { bd = d; best = r; } });
            if (best) {
                if (!h.intent || h.intent.kind !== 'move' || this.stuck()) w.heroMoveTo(best.cx + 0.5, best.cy + 0.5);
                if (this.stuck()) { this.visited.add(rooms.indexOf(best)); }
                return;
            }
        }
        // Head for the goal: quest objects, the thief, the boss, then the stairs.
        let goal = null;
        const quest = w.objs.find((o) => (o.type === 'lectern' || o.type === 'anvil') && o.state === 'idle');
        const thief = w.mons.find((m) => m.type === 'thief' && !m.dead);
        const boss = w.boss();
        const down = w.objs.find((o) => o.type === 'down');
        if (quest) goal = quest;
        else if (thief) goal = thief;
        else if (boss && !boss.dead) goal = boss;
        else if (down) goal = down;
        if (!goal) return;
        if (goal === down && w.dist(h, down) < 1.4) { w.heroInteract(down.id); return; }
        if (goal.kind === 'obj') { if (!h.intent || h.intent.id !== goal.id) w.heroInteract(goal.id); }
        else if (!h.intent || h.intent.kind !== 'move' || this.stuck()) w.heroMoveTo(goal.x, goal.y);
        if (this.stuck()) {
            // Wiggle out.
            const a = w.rng.range(0, 6.28);
            w.heroMoveTo(h.x + Math.cos(a) * 3, h.y + Math.sin(a) * 3);
        }
    }

    /** Spend up to `max` seconds of attention on one target, then give up on it. */
    budget(id, max) {
        const s = (this.spent.get(id) || 0) + 0.12;
        this.spent.set(id, s);
        if (s > max) { this.ignored.add(id); return false; }
        return true;
    }

    stuck() {
        const h = this.w.hero;
        const moved = Math.hypot(h.x - this.last.x, h.y - this.last.y);
        if (moved > 0.6) { this.last = { x: h.x, y: h.y }; this.stuckT = this.t; return false; }
        return this.t - this.stuckT > 4;
    }

    pickTarget() {
        const w = this.w, h = w.hero;
        let best = null, bd = 1e9;
        for (const m of w.mons) {
            if (m.dead || m.burrowed || m.state === 'disguised') continue;
            if (m.state === 'sleep' && w.dist(h, m) > 9) continue;
            const d = w.dist(h, m);
            if (d > 10 || !(m.aggro || m.state === 'sleep' || d < 7)) continue;
            if (!los(w.map, h.x, h.y, m.x, m.y)) continue;
            const pr = d - (m.def.ai === 'shaman' ? 3 : 0) - (m.type === 'thief' ? 2 : 0);
            if (pr < bd) { bd = pr; best = m; }
        }
        return best;
    }

    fight(m) {
        const w = this.w, h = w.hero, hero = this.hero;
        const near = (r) => w.monsInRadius(h.x, h.y, r).length;
        const clump = (r) => w.monsInRadius(m.x, m.y, r).length;
        const has = (id) => (hero.skills[id] || 0) > 0 && (h.cds[id] || 0) <= 0 && h.juice >= SKILLS[id].cost;
        const slotOf = (id) => hero.bar.indexOf(id);
        const use = (id, x = m.x, y = m.y) => { const s = slotOf(id); if (s < 0) return false; if (h.act) return true; return w.heroSkill(s, x, y, m.id); };
        const d = w.dist(h, m);
        let id = null;
        // Squishy classes step back from melee when hurt.
        if (hero.cls !== 'knight' && !h.act && h.hp < h.maxHp * 0.7 && near(1.5) >= 1 && this.t - (this.kiteT || 0) > 0.6) {
            const a = Math.atan2(h.y - m.y, h.x - m.x);
            const tx = h.x + Math.cos(a) * 3, ty = h.y + Math.sin(a) * 3;
            if (walkable(w.tileAt(tx, ty))) { this.kiteT = this.t; w.heroMoveTo(tx, ty); return; }
        }
        if (this.t - (this.kiteT || 0) < 0.45 && h.intent && h.intent.kind === 'move') return;
        if (hero.cls === 'knight') {
            if (has('juiceup') && !h.buffs.juiceup && near(4) >= 2) id = 'juiceup';
            else if (has('blender') && !h.spin && near(2.2) >= 3) id = 'blender';
            else if (has('leap') && d > 3 && d < 7) id = 'leap';
            else if (has('bigslice') && near(2.2) >= 2) id = 'bigslice';
            else if (has('bash') && h.juice > 25) id = 'bash';
        } else if (hero.cls === 'ranger') {
            if (has('roll') && d < 1.6 && near(1.8) >= 2) { const a = Math.atan2(h.y - m.y, h.x - m.x); use('roll', h.x + Math.cos(a) * 4, h.y + Math.sin(a) * 4); return; }
            if (has('raisinrain') && clump(3) >= 3) id = 'raisinrain';
            else if (has('peeltrap') && d < 4 && near(3) >= 2) id = 'peeltrap';
            else if (has('pipspray') && near(6) >= 3) id = 'pipspray';
            else if (has('pomegranate') && h.juice > h.maxJuice * 0.4) id = 'pomegranate';
        } else {
            if (has('brainfreeze') && near(3.6) >= 2) id = 'brainfreeze';
            else if (has('peelport') && near(1.8) >= 3 && h.hp < h.maxHp * 0.5) { const a = Math.atan2(h.y - m.y, h.x - m.x); use('peelport', h.x + Math.cos(a) * 7, h.y + Math.sin(a) * 7); return; }
            else if (has('melonmeteor') && (clump(3) >= 3 || m.boss)) id = 'melonmeteor';
            else if (has('limening') && clump(5) >= 2) id = 'limening';
            else if (has('caramelize') && h.juice > h.maxJuice * 0.35) id = 'caramelize';
        }
        if (id && use(id)) return;
        // Basic attack via the attack intent (walks into range).
        if (!h.intent || h.intent.kind !== 'attack' || h.intent.id !== m.id) w.heroAttack(m.id, 0);
    }

    doTown() {
        const w = this.w, g = this.game, hero = this.hero;
        if (!this.townPlan) {
            this.townPlan = { done: false };
            for (const id of Object.keys(NPCS)) g.talk(id);
            g.talk('cane'); g.talk('cane');
            g.identify();
            this.housekeeping();
            // Sell everything not worth keeping.
            for (let i = 0; i < hero.inv.length; i++) if (hero.inv[i]) g.sell(i);
            for (const k of ['hp', 'juice', 'pie']) g.buyPotion(k, k === 'pie' ? 3 : 10);
            if (hero.potions.hp < 6) g.buyPotion('hp', 6);
            // Spend spare sugar on a gamble now and then.
            if (hero.sugar > g.gamblePrice('ring') * 3) { g.gamble('ring'); this.housekeeping(); for (let i = 0; i < hero.inv.length; i++) if (hero.inv[i]) g.sell(i); }
            w.hero.hp = w.hero.maxHp;
            this.wantTown = false;
        }
        const portal = w.objs.find((o) => o.type === 'portal');
        if (portal) { w.heroInteract(portal.id); return; }
        const top = Math.max(...hero.waypoints);
        if (top > 0) { g.travel(top); return; }
        const cellar = w.objs.find((o) => o.type === 'cellar');
        if (!w.hero.intent) w.heroInteract(cellar.id);
    }
}
