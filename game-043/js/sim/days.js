// ============================================================
// Sleeping, passing out, and everything that happens overnight.
// ============================================================

import { rngFor } from '../core/rng.js';
import { O } from '../data/tiles.js';
import { DAY_START } from './state.js';
import { seasonOf } from './state.js';

const REGROW = { [O.TREE]: 7, [O.PINE]: 7, [O.BUSH]: 4, [O.ROCK]: 5, [O.TUFT]: 3, [O.WEED]: 4, [O.DEADTREE]: 8, [O.CRYSTAL]: 6, [O.ORE]: 6, [O.BIGROCK]: 9, [O.STUMP]: 7 };

export const DayMethods = {
    weatherFor(day) {
        if (day <= 2) return 'sun';
        const r = rngFor(this.s.seed, 'weather', day);
        const season = seasonOf(day);
        const x = r.next();
        if (season === 3) return x < 0.35 ? 'snow' : 'sun';
        const rain = [0.25, 0.12, 0.25][season], storm = [0.05, 0.1, 0.06][season];
        return x < storm ? 'storm' : x < storm + rain ? 'rain' : 'sun';
    },
    sleep() {
        const late = this.s.time.min >= 24 * 60;
        this.endDay(late ? 0.75 : 1, false);
    },
    passOut() {
        this.msg('You collapse from exhaustion…', 'moon');
        const lost = this.isResident('herbalist') ? 0 : Math.min(250, Math.floor(this.p.gold * 0.1));
        this.p.gold -= lost;
        this.endDay(0.6, true, lost);
    },
    faint(lost) {
        // lost a battle
        this.s.stats.faints++;
        this.endDay(0.6, true, lost, true);
    },
    endDay(energyFrac, fainted, lost = 0, battle = false) {
        this.s.stats.sleeps++;
        this.s.report = [];
        if (fainted) this.report(battle ? `You were found and carried home${this.isResident('herbalist') ? ` — ${this.people.herbalist.name} patched you up` : ''}.${lost ? ` You lost ${lost} gold.` : ''}` : `You passed out and woke up at home.${lost ? ` Lost ${lost} gold.` : ''}`);
        const rained = this.s.weather === 'rain' || this.s.weather === 'storm' || this.s.weather === 'snow';
        // ------------------------------------ overnight
        this.shipOvernight();
        this.growCrops(false);
        this.growGreenhouse();
        this.s.time.day++;
        this.s.time.min = DAY_START;
        this.s.weather = this.weatherFor(this.day);
        const nowRain = this.s.weather === 'rain' || this.s.weather === 'storm' || this.s.weather === 'snow';
        if (nowRain) for (const t of Object.values(this.s.world.tilled)) t.w = 1;
        this.regrow();
        this.moveIns();
        this.resolveAssignments();
        this.animalsMorning();
        this.morningWatering();
        const happy = this.updateHappiness();
        if (happy) this.addCoziness(Math.round(happy / 20), 'happiness');
        this.contributions();
        this.refreshBoard();
        // player
        const p = this.p;
        p.energy = Math.round(p.maxEnergy * energyFrac);
        p.hp = fainted ? Math.round(p.maxHp * 0.5) : p.maxHp;
        p.sp = p.maxSp;
        p.companion = null;
        if (p.buffs.day !== this.day) { p.buffs = { day: 0 }; }
        this.refreshStats();
        // back to the cabin
        this.map = this.world; this.rt.floor = null; p.where = 'world';
        this.placeAtHome();
        this.rt.monsters = []; this.rt.battle = null;
        const warn = this.cropsOutOfSeasonTomorrow();
        if (warn) this.report(`Heads up: ${warn} crop${warn > 1 ? 's' : ''} won't survive into next season.`);
        if (this.day % 12 === 1) this.report(`A new season begins: ${['Spring', 'Summer', 'Fall', 'Winter'][this.season]}!`);
        this.report(`Weather: ${{ sun: 'sunny', rain: 'rain', storm: 'storm', snow: 'snow' }[this.s.weather]}.`);
        this.checkStory?.();
        this.saveExplored();
        this.emit('newday', { report: this.s.report.slice(), fainted });
        this.emit('autosave');
    },
    regrow() {
        const W = this.s.world, w = this.world;
        const r = rngFor(this.s.seed, 'regrow', this.day);
        for (const [k, day] of Object.entries(W.removed)) {
            if (day < 0) continue;
            const i = +k;
            const orig = this.rt.orig.get(i);
            const need = REGROW[orig];
            if (!need || w.region[i] === 0) continue;
            if (this.day - day < need || !r.chance(0.6)) continue;
            // don't regrow on top of the player's things
            if (W.placed[i]) continue;
            w.obj[i] = orig; delete W.removed[k]; this.rt.orig.delete(i);
        }
        // stumps left by chopping outside the Glen are "removed" with a day: they regrow into trees above
        for (const [id, day] of Object.entries(W.picked)) {
            const f = w.forage[+id];
            if (!f) { delete W.picked[id]; continue; }
            if (this.day - day >= 3) {
                const i = f.y * w.W + f.x;
                if (!w.obj[i]) { w.obj[i] = O.FORAGE; w.ov[i] = f.id & 255; }
                delete W.picked[id];
            }
        }
        this.emit('tiles');
    },
    onHour() {
        const h = Math.floor(this.s.time.min / 60);
        if (h === 18) this.emit('dusk');
        this.emit('hour', h);
        if (h === 20 && this.p.companion) { this.msg(`${this.people[this.p.companion].name} heads home for the night.`); this.setCompanion(null); }
    },
};
