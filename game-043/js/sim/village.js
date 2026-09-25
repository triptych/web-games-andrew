// ============================================================
// The village: lots, buildings, applicants, residents, level-ups,
// daily contributions, friendship, gifts, stories, companions.
// ============================================================

import { O } from '../data/tiles.js';
import { ITEM, hasTag } from '../data/items.js';
import { BUILDING, BUILDINGS, LOTS_AT_LEVEL, VILLAGE_LEVELS, JOB_BOARD_COST, LOT_W, LOT_H } from '../data/buildings.js';
import { JOBS, APPLICANTS_AT_LEVEL, BLESSINGS } from '../data/jobs.js';
import { CROPS, cropInSeason } from '../data/crops.js';
import { BIOMES } from '../data/monsters.js';
import { RECIPES } from '../data/recipes.js';
import { GREET, TOPICS, GIFT_REACT, APPLICANT_LINES, MOVE_IN } from '../data/dialog.js';
import { PRONOUNS, fill } from '../gen/names.js';
import { listAdd } from './inventory.js';
import { seasonOf, dayOfSeason } from './state.js';

const HEART = 100;

export const VillageMethods = {
    // ------------------------------------------------------------ lots
    lotUnlocked(id) { return id < LOTS_AT_LEVEL[this.s.village.level]; },
    lotCleared(id) {
        const L = this.world.lots[id], w = this.world;
        for (let y = L.y; y < L.y + LOT_H; y++) for (let x = L.x; x < L.x + LOT_W; x++) {
            const o = w.obj[y * w.W + x];
            if (o && o !== O.LOTSIGN && o !== O.FLOWER && o !== O.TUFT) return false;
        }
        return true;
    },
    lotBuilding(id) { return this.s.world.lots[id]?.b ?? null; },
    costMult() {
        let m = 1;
        if (this.isResident('carpenter')) m *= 0.8;
        if (this.s.blessings.includes('build')) m *= 0.9;
        if (this.s.blessings.includes('cheap')) m *= 0.9;
        return m;
    },
    buildingCost(type) {
        const B = BUILDING[type], m = this.costMult();
        return { items: Object.entries(B.cost).map(([id, n]) => [id, Math.max(1, Math.round(n * m))]), gold: Math.round(B.gold * m) };
    },
    builtTypes() { return new Set(Object.values(this.s.world.lots).filter(Boolean).map(l => l.b)); },
    buildable(type) {
        const B = BUILDING[type];
        if (this.builtTypes().has(type)) return { ok: false, why: 'Already built' };
        if (this.s.village.level < B.lvl) return { ok: false, why: `Needs village level ${B.lvl}` };
        if (B.job && !this.s.applicants.includes(B.job)) return { ok: false, why: this.isResident(B.job) ? 'Already built' : `No ${JOBS[B.job].name} has asked to live here yet` };
        const c = this.buildingCost(type);
        for (const [id, n] of c.items) if (this.count(id) < n) return { ok: false, why: `Need ${n} ${ITEM[id].name}`, cost: c };
        if (this.p.gold < c.gold) return { ok: false, why: `Need ${c.gold} gold`, cost: c };
        return { ok: true, cost: c };
    },
    openLot(id) {
        const L = this.world.lots[id];
        if (!L) return;
        if (!this.lotUnlocked(id)) {
            const need = LOTS_AT_LEVEL.findIndex(n => n > id);
            this.emit('dialog', { name: `Lot ${id + 1}`, lines: [`This lot is still wild. The Mayor will open it up when the village reaches level ${need}.`] });
            return;
        }
        if (this.lotBuilding(id)) return;
        if (!this.lotCleared(id)) { this.emit('dialog', { name: `Lot ${id + 1}`, lines: ['An overgrown lot. Clear the trees, rocks and weeds on it, then come back to this sign to build.'] }); return; }
        this.emit('menu', { kind: 'build', lot: id });
    },
    build(lotId, type) {
        const chk = this.buildable(type);
        if (!chk.ok || !this.lotUnlocked(lotId) || !this.lotCleared(lotId) || this.lotBuilding(lotId)) { this.msg(chk.why ?? "Can't build here."); this.sfx('deny'); return false; }
        for (const [id, n] of chk.cost.items) this.take(id, n);
        this.p.gold -= chk.cost.gold;
        this.s.world.lots[lotId] = { b: type, day: this.day };
        const L = this.world.lots[lotId];
        this.world.obj[L.sign.y * this.world.W + L.sign.x] = O.NONE;
        this.buildBuildingMap();
        const B = BUILDING[type];
        this.addCoziness(B.xp, 'building');
        this.sfx('build');
        if (B.job) {
            this.s.movingIn[B.job] = lotId;
            this.s.applicants = this.s.applicants.filter(j => j !== B.job);
            this.msg(`${B.name} built! ${this.people[B.job].name} will move in tomorrow morning.`, 'house');
        } else this.msg(`${B.name} built!`, 'house');
        this.emit('built', { lot: lotId, type });
        this.checkStory?.();
        return true;
    },
    buildJobBoard() {
        if (this.s.village.board) return false;
        for (const [id, n] of Object.entries(JOB_BOARD_COST)) if (this.count(id) < n) { this.msg(`You need ${n} ${ITEM[id].name} to rebuild the Job Board.`); this.sfx('deny'); return false; }
        for (const [id, n] of Object.entries(JOB_BOARD_COST)) this.take(id, n);
        this.s.village.board = true;
        this.addCoziness(20, 'job board');
        this.msg('The Job Board is back up! New postings every morning.', 'board'); this.sfx('build');
        this.emit('tile', this.world.glen.board.y * this.world.W + this.world.glen.board.x);
        this.refreshBoard?.(true);
        this.checkStory?.();
        return true;
    },

    // ------------------------------------------------------------ coziness and level
    nextLevelXp() { return VILLAGE_LEVELS[this.s.village.level]?.xp ?? Infinity; },
    addCoziness(n, why) {
        const v = this.s.village;
        v.xp = Math.max(0, v.xp + n);
        if (n > 0) this.emit('coziness', { n, why });
        if (!v.levelReady && v.level < 5 && v.xp >= this.nextLevelXp()) {
            v.levelReady = true;
            this.msg(`${this.s.villageName} feels cosier than ever. The Mayor would like a word!`, 'star');
            this.sfx('chime');
        }
    },
    levelUp() {
        const v = this.s.village;
        if (!v.levelReady) return false;
        v.level++; v.levelReady = false;
        const L = v.level;
        const lines = [`By the power vested in me by, well, me: ${this.s.villageName} is now a ${this.villageTitle(L)}!`];
        const newLots = LOTS_AT_LEVEL[L] - LOTS_AT_LEVEL[L - 1];
        if (newLots) lines.push(`I've had ${newLots} more lots surveyed. The signs are up.`);
        const apps = (APPLICANTS_AT_LEVEL[L] ?? []).filter(j => !this.isResident(j) && !this.s.applicants.includes(j));
        if (apps.length) { this.s.pendingApps = [...(this.s.pendingApps ?? []), ...apps]; lines.push(`Word is spreading. I expect new faces tomorrow: ${apps.map(j => 'a ' + JOBS[j].name).join(', ')}.`); }
        const newB = BUILDINGS.filter(b => b.lvl === L && !b.job).map(b => b.name);
        if (newB.length) lines.push(`We can build new things now: ${newB.join(', ')}.`);
        const site = this.world.sites.find(s => s.kind === 'dungeon' && s.region === L);
        if (site) lines.push(`And Glim tells me the seal on ${site.name} has woken up.`);
        this.sfx('fanfare');
        this.emit('levelup-village', L);
        this.emit('dialog', { name: this.mayor.name, who: 'mayor', lines });
        this.checkStory?.();
        // a big jump can be ready for the next level already
        if (L < 5 && v.xp >= this.nextLevelXp()) v.levelReady = true;
        return true;
    },

    // ------------------------------------------------------------ residents
    vstate(job) {
        const v = this.s.villagers;
        if (!v[job]) v[job] = { joined: 0, lot: -1, friendship: 0, talked: 0, gifted: 0, happiness: 60, level: 1, xp: 0, away: null, tired: 0, story: { ch: 0, active: null }, taught: 0, met: 0 };
        return v[job];
    },
    hearts(job) { return Math.floor((this.s.villagers[job]?.friendship ?? 0) / HEART); },
    befriend(job, n) {
        const v = this.vstate(job);
        const before = this.hearts(job);
        v.friendship = Math.max(0, Math.min(10 * HEART, v.friendship + n));
        const after = this.hearts(job);
        if (after > before) { this.msg(`${this.people[job].name}: ${'♥'.repeat(after)}`, 'heart'); this.sfx('heart'); this.onHeart?.(job, after); }
    },
    villagerXp(job, n) {
        const v = this.vstate(job);
        v.xp += n;
        while (v.xp >= 100 && v.level < 10) { v.xp -= 100; v.level++; this.report(`${this.people[job].name} reached level ${v.level}!`); }
    },
    moveIns() {
        for (const [job, lot] of Object.entries(this.s.movingIn)) {
            const v = this.vstate(job);
            v.joined = this.day; v.lot = lot; v.happiness = 65;
            delete this.s.movingIn[job];
            this.addCoziness(25, 'new villager');
            this.report(`${this.people[job].name} the ${JOBS[job].name} moved in!`);
            this.s.flags['movein_' + job] = this.day;
        }
        if (this.s.pendingApps?.length) {
            for (const j of this.s.pendingApps) if (!this.s.applicants.includes(j) && !this.isResident(j)) { this.s.applicants.push(j); this.report(`A traveller arrived: ${this.people[j].name}, a ${JOBS[j].name}. They're waiting in the plaza.`); }
            this.s.pendingApps = [];
        }
    },
    decorNear(lot) {
        const L = this.world.lots[lot]; if (!L) return 0;
        let n = 0;
        for (const [k, pl] of Object.entries(this.s.world.placed)) {
            if (!ITEM[pl.id]?.decor) continue;
            const i = +k, x = i % this.world.W, y = (i / this.world.W) | 0;
            if (Math.abs(x - (L.x + 3)) < 9 && Math.abs(y - (L.y + 2)) < 9) n++;
        }
        return n;
    },
    updateHappiness() {
        let total = 0;
        const tavern = this.isResident('bard');
        for (const job of this.residents()) {
            const v = this.s.villagers[job];
            let h = 45 + this.hearts(job) * 3 + Math.min(20, this.decorNear(v.lot) * 4) + (tavern ? 8 : 0) + (this.s.blessings.includes('song') ? 5 : 0) + (this.s.blessings.includes('companion') ? 5 : 0);
            if (v.talked >= this.day - 2) h += 6;
            if (v.tired > 0) { h -= 15; v.tired--; }
            v.happiness = Math.max(0, Math.min(100, Math.round(h)));
            total += v.happiness;
        }
        return total;
    },
    contributions() {
        const r = this.rng('contrib');
        const sh = this.s.storehouse;
        const top = Math.max(1, ...this.openRegions());
        let lines = 0;
        for (const job of this.residents()) {
            const v = this.s.villagers[job];
            if (v.away) continue;
            const J = JOBS[job];
            const mult = 0.6 + v.happiness / 125;
            const got = [];
            for (const [key, a, b] of J.daily) {
                let n = Math.round(r.int(a, b) * mult);
                if (n <= 0) continue;
                let id = key;
                if (key === 'gold') { this.p.gold += n; got.push(`${n} gold`); continue; }
                if (key === 'tag:seasonCrop') { const pool = CROPS.filter(c => c.seasons !== 'any' && cropInSeason(c, this.season)); id = r.pick(pool).id; }
                else if (key === 'tag:regionOre') id = r.pick(BIOMES[top - 1].ore);
                else if (key === 'tag:monster') id = r.pick(['gel', 'fur', 'feather', 'petal', 'chitin', 'wisp_dust', 'spore', 'bone']);
                else if (key === 'tag:dish') { const pool = RECIPES.filter(x => x.tier <= 2); id = r.pick(pool).id; n = 1; }
                else if (key === 'tag:herb') id = r.pick(['mint', 'clover', 'cattail', 'dandelion']);
                else if (key === 'tag:scroll') { if (!r.chance(0.15)) continue; const rec = this.unknownRecipe(5, 'scholar', this.day); if (!rec) continue; id = 'scroll_' + rec; n = 1; }
                if (id === 'hay' && (this.hasHouse('coop') || this.hasHouse('barn'))) { this.s.hay += n; got.push(`${n} hay (silo)`); continue; }
                listAdd(sh, id, n); got.push(`${n} ${ITEM[id].name}`);
            }
            if (got.length && lines++ < 12) this.report(`${this.people[job].name} left ${got.join(', ')} in the Storehouse.`);
        }
        // the scholar reveals one faded glimmer each week
        if (this.isResident('scholar') && this.day % 7 === 0) this.revealGlimmers(1, 'scholar');
    },
    revealGlimmers(n, why) {
        const faded = this.world.glimmers.filter(g => !this.glimmerAwake(g) && !this.s.world.glimmers[g.id]);
        const r = this.rng('reveal', why);
        let k = 0;
        for (const g of r.shuffle(faded).slice(0, n)) { this.s.world.glimmers['r' + g.id] = true; k++; this.rt.explored[g.y * this.world.W + g.x] = 1; }
        if (k) this.report(`${k} faded glimmer${k > 1 ? 's' : ''} woke up early — check your map.`);
        return k;
    },
    openRegions() {
        const out = [1];
        for (let k = 2; k <= 5; k++) {
            const R = this.world.regions[k - 1];
            const relic = { thorn: 'thornbreaker', boulder: 'stonebreaker', shallows: 'lilypad', dark: 'lantern' }[R.biome.gate];
            if (this.hasRelic(relic) || this.s.quests.flags['visited_r' + k]) out.push(k);
        }
        return out;
    },

    // ------------------------------------------------------------ talking
    pr(job) { return PRONOUNS[(job === 'mayor' ? this.mayor : this.people[job]).pronoun] ?? PRONOUNS.they; },
    vvars(job) {
        const P = this.people[job], pr = this.pr(job);
        const others = this.residents().filter(j => j !== job);
        return this.vars({ name: P.name, job: JOBS[job].name.toLowerCase(), town: P.town, rival: P.rival, friend: P.friend, they: pr.they, them: pr.them, their: pr.their, season: ['spring', 'summer', 'fall', 'winter'][this.season], other: others.length ? this.people[this.rng('other', job).pick(others)].name : this.mayor.name, building: BUILDING[JOBS[job].building].name });
    },
    talkTo(id) {
        if (id === 'mayor') return this.talkMayor();
        if (id === 'glim') return this.talkGlim();
        if (id.startsWith('app_')) return this.talkApplicant(id.slice(4));
        if (JOBS[id]) return this.talkVillager(id);
    },
    talkApplicant(job) {
        const V = this.vvars(job);
        this.vstate(job).met = this.vstate(job).met || this.day;
        this.emit('dialog', { name: `${this.people[job].name} (${JOBS[job].name})`, who: job, lines: APPLICANT_LINES.map(l => fill(l, V)), choices: [{ label: 'Welcome aboard!' }] });
    },
    talkVillager(job) {
        const v = this.vstate(job), P = this.people[job], V = this.vvars(job);
        const r = this.rng('talk', job);
        const lines = [];
        const firstToday = v.talked !== this.day;
        if (this.s.flags['movein_' + job] === this.day && firstToday) lines.push(fill(r.pick(MOVE_IN), V));
        else lines.push(fill(r.pick(GREET[P.personality]), V));
        const bday = P.birthday.season === this.season && P.birthday.day === dayOfSeason(this.day);
        if (bday) lines.push("It's my birthday today, you know. Not that I'm hinting.");
        const topic = r.int(0, 4);
        if (topic === 0) lines.push(fill(r.pick(TOPICS.season[this.season]), V));
        else if (topic === 1) lines.push(fill(r.pick(TOPICS.weather[this.s.weather] ?? TOPICS.weather.sun), V));
        else if (topic === 2) lines.push(fill(r.pick(TOPICS.job[job]), V));
        else if (topic === 3) lines.push(fill(r.pick(TOPICS.village), V));
        else { const h = this.hearts(job); lines.push(fill(r.pick(TOPICS.hearts[h >= 6 ? 'high' : h >= 3 ? 'mid' : 'low']), V)); }
        if (firstToday) { v.talked = this.day; this.befriend(job, 20); }
        const choices = [];
        const story = this.storyState(job);
        if (story.available) choices.push({ label: `✦ ${story.chapter.title}`, act: () => this.startStory(job) });
        if (story.active && this.storyReady(job)) choices.push({ label: `✦ ${story.chapter.title}: done!`, act: () => this.finishStory(job) });
        else if (story.active) choices.push({ label: `✦ About "${story.chapter.title}"`, act: () => this.emit('dialog', { name: P.name, who: job, lines: [this.storyReminder(job)] }) });
        if (v.gifted !== this.day) choices.push({ label: 'Give a gift', act: () => this.emit('menu', { kind: 'gift', job }) });
        if (this.hearts(job) >= 2 && !v.away && this.p.companion !== job && this.inWorld) choices.push({ label: 'Come adventuring?', act: () => this.setCompanion(job) });
        if (this.p.companion === job) choices.push({ label: 'Thanks, you can head home', act: () => this.setCompanion(null) });
        choices.push({ label: 'Bye!' });
        this.emit('dialog', { name: `${P.name} ${'♥'.repeat(this.hearts(job))}`, who: job, lines, choices });
    },
    setCompanion(job) {
        this.p.companion = job;
        if (job) { this.msg(`${this.people[job].name} is coming with you today!`, 'heart'); this.sfx('heart'); }
        this.emit('companion', job);
    },
    tasteOf(job, id) {
        const P = this.people[job];
        const m = key => key === id || (key.startsWith('tag:') && hasTag(id, key.slice(4)));
        if (P.loves.some(m)) return 'love';
        if (P.hates.some(m)) return 'hate';
        if (P.likes.some(m)) return 'like';
        return 'neutral';
    },
    giveGift(job, id) {
        const v = this.vstate(job), P = this.people[job];
        if (v.gifted === this.day) { this.msg(`You've already given ${P.name} something today.`); return; }
        const it = ITEM[id];
        if (!it || it.cat === 'tool' || it.key) return;
        if (!this.take(id, 1)) return;
        v.gifted = this.day;
        const taste = this.tasteOf(job, id);
        const bday = P.birthday.season === this.season && P.birthday.day === dayOfSeason(this.day);
        const pts = { love: 80, like: 45, neutral: 20, hate: -40 }[taste] * (bday ? 3 : 1);
        this.befriend(job, pts);
        const r = this.rng('gift', job);
        const lines = [fill(r.pick(GIFT_REACT[taste]), this.vvars(job))];
        if (bday && taste !== 'hate') lines.unshift(GIFT_REACT.birthday[0]);
        this.emit('dialog', { name: P.name, who: job, lines });
        this.sfx(taste === 'hate' ? 'deny' : 'gift');
    },
    onHeart(job, h) {
        // the Cook teaches a recipe at every other heart
        if (job === 'cook' && h % 2 === 0) {
            const rec = this.unknownRecipe(Math.min(5, 1 + h / 2), 'cook', h);
            if (rec) { this.learnRecipe(rec); this.report?.(`${this.people.cook.name} taught you a recipe.`); }
        }
        if (this.storyState(job).available) this.msg(`${this.people[job].name} has something to ask you. ✦`, 'quest');
    },

    // ------------------------------------------------------------ villager stories
    storyState(job) {
        const v = this.vstate(job), J = JOBS[job];
        const ch = v.story.ch;
        const chapter = J.story[v.story.active ? v.story.active.ch : ch];
        return { chapter, active: !!v.story.active, available: !v.story.active && ch < 3 && this.hearts(job) >= J.story[ch].need && this.isResident(job), done: ch >= 3 };
    },
    startStory(job) {
        const v = this.vstate(job), J = JOBS[job], ch = v.story.ch, S = J.story[ch];
        const act = { ch, start: this.day, kills0: this.s.stats.kills };
        if (S.item) {
            const open = this.openRegions();
            const sites = this.world.sites.filter(s => open.includes(s.region) && (s.kind === 'cave' || this.s.village.level >= s.region));
            const r = this.rng('storysite', job, ch);
            const site = r.pick(sites.length ? sites : [this.world.siteById.c1]);
            act.site = site.id; act.floor = r.int(1, Math.min(3, site.floors - 1)); act.found = false;
        }
        v.story.active = act;
        const V = { ...this.vvars(job), place: act.site ? this.world.siteById[act.site].name : '', item: S.item ?? '' };
        const lines = [fill(S.ask, V)];
        if (act.site) lines.push(`(Look for a glowing chest on floor ${act.floor} of ${this.world.siteById[act.site].name}.)`);
        this.emit('dialog', { name: this.people[job].name, who: job, lines });
        this.msg(`New story: ${S.title}`, 'quest'); this.sfx('quest');
    },
    storyReady(job) {
        const v = this.vstate(job), a = v.story.active; if (!a) return false;
        const S = JOBS[job].story[a.ch];
        if (S.item) return !!a.found;
        if (S.deliver) return S.deliver.every(([id, n]) => this.count(id) >= n);
        if (S.hunt) return this.s.stats.kills - a.kills0 >= S.hunt;
        return false;
    },
    storyReminder(job) {
        const v = this.vstate(job), a = v.story.active, S = JOBS[job].story[a.ch];
        if (S.item) return a.found ? `You found it? Oh, give it here!` : `Any luck finding my ${S.item}? It should be on floor ${a.floor} of ${this.world.siteById[a.site].name}.`;
        if (S.deliver) return `I still need: ${S.deliver.map(([id, n]) => `${n} ${ITEM[id].name} (you have ${this.count(id)})`).join(', ')}.`;
        if (S.hunt) return `Monsters defeated so far: ${this.s.stats.kills - a.kills0} of ${S.hunt}.`;
        return '';
    },
    finishStory(job) {
        const v = this.vstate(job), a = v.story.active, S = JOBS[job].story[a.ch];
        if (!this.storyReady(job)) return;
        if (S.deliver) for (const [id, n] of S.deliver) this.take(id, n);
        v.story.active = null; v.story.ch++;
        const R = S.reward, lines = [`Thank you, ${this.p.name}. Truly.`];
        for (const [id, n] of R.items ?? []) { this.give(id, n); lines.push(`Received ${n} × ${ITEM[id].name}.`); }
        if (R.gold) { this.p.gold += R.gold; lines.push(`Received ${R.gold} gold.`); }
        if (R.recipe) for (let k = 0; k < R.recipe; k++) { const rec = this.unknownRecipe(5, 'story', job, k); if (rec) this.learnRecipe(rec); }
        if (R.teach) this.learnRecipe(R.teach);
        if (R.reveal) this.revealGlimmers(R.reveal, job);
        if (R.blessing && !this.s.blessings.includes(R.blessing)) { this.s.blessings.push(R.blessing); lines.push(`Blessing: ${BLESSINGS[R.blessing]}`); this.refreshStats(); }
        this.addCoziness(R.xp ?? 20, 'story');
        this.befriend(job, 150);
        this.s.stats.questsDone++;
        this.emit('dialog', { name: this.people[job].name, who: job, lines });
        this.sfx('fanfare');
    },
    /** Called when a special chest is opened in a site. */
    storyChestFor(siteId, floor) {
        for (const job of this.residents()) {
            const a = this.s.villagers[job].story.active;
            if (a && a.site === siteId && a.floor === floor && !a.found) return job;
        }
        return null;
    },

    // ------------------------------------------------------------ the Mayor and Glim
    talkMayor() {
        const lines = this.storyLines?.('mayor') ?? [];
        if (!lines.length) lines.push(this.rng('mayor').pick([`${this.s.villageName} gets livelier every day. My old knees can feel it.`, "Have you been by the board today?", "I used to sit under the Heartwood when I was a child. I'd like to again.", "Forty years, and look at us now."]));
        const choices = [];
        if (this.s.village.levelReady) choices.push({ label: '★ Village celebration!', act: () => this.levelUp() });
        choices.push({ label: 'How is the village?', act: () => this.villageStatus() });
        if (this.s.applicants.length) choices.push({ label: 'Newcomers', act: () => this.newcomers() });
        choices.push({ label: 'Storehouse', act: () => this.emit('menu', { kind: 'storehouse' }) });
        if (!this.isResident('farmer')) choices.push({ label: 'Buy seeds', act: () => this.emit('menu', { kind: 'shop', shop: 'mayor' }) });
        choices.push({ label: "Tomorrow's weather?", act: () => this.emit('dialog', { name: this.mayor.name, who: 'mayor', lines: [this.forecastText()] }) });
        choices.push({ label: 'Bye' });
        this.emit('dialog', { name: `Mayor ${this.mayor.name}`, who: 'mayor', lines, choices });
    },
    villageStatus() {
        const v = this.s.village;
        const next = this.nextLevelXp();
        const res = this.residents();
        const lines = [`${this.s.villageName} is a ${this.villageTitle()} (level ${v.level}). Coziness: ${v.xp}${isFinite(next) ? ` / ${next}` : ''}.`];
        lines.push(res.length ? `We have ${res.length} villager${res.length > 1 ? 's' : ''}: ${res.map(j => this.people[j].name).join(', ')}.` : 'Nobody lives here yet but us. Build the Job Board and people will come.');
        const avg = res.length ? Math.round(res.reduce((a, j) => a + this.s.villagers[j].happiness, 0) / res.length) : 0;
        if (res.length) lines.push(`Everyone's happiness averages ${avg}/100. Decorations near their homes, chats and gifts all help.`);
        lines.push('Coziness grows with new buildings, new neighbours, happy neighbours, board postings, decorations and returning Heart Shards.');
        this.emit('dialog', { name: this.mayor.name, who: 'mayor', lines });
    },
    newcomers() {
        const lines = this.s.applicants.map(j => `${this.people[j].name} the ${JOBS[j].name} needs a ${BUILDING[JOBS[j].building].name}.`);
        lines.push('Clear an open lot, then use its sign to build.');
        this.emit('dialog', { name: this.mayor.name, who: 'mayor', lines });
    },
    talkGlim() {
        const lines = this.storyLines?.('glim') ?? [];
        if (!lines.length) lines.push(this.rng('glim').pick(["*twinkles*", "The Heartwood's warmer today. I can feel it in my sparkle.", "Have you found any faded glimmers? They'll wake as the heart heals."]));
        const choices = [{ label: 'Any hints?', act: () => this.emit('dialog', { name: this.glim, who: 'glim', lines: this.hints() }) }, { label: 'Bye, Glim!' }];
        this.emit('dialog', { name: this.glim, who: 'glim', lines, choices });
    },
    hints() {
        const out = [`Right now: ${this.objective?.() ?? ''}`];
        const r = this.rng('hint');
        const pool = [
            'Guard when a monster shows 💢 — it is winding up a big hit.',
            'Cook! Dishes heal more than raw food and many give buffs for the whole day.',
            'Faded glimmers wake as the Heartwood heals. Keep an eye on places that shimmer.',
            'Assign villagers to board postings when you are busy. A good job fit raises their chance.',
            'Your villagers leave things in the Storehouse every morning. Ask the Mayor.',
            'Ship anything you do not need in the bin by your cabin. It sells overnight.',
            'Upgraded tools cost less energy. The Blacksmith can help once they move in.',
            'Trees and rocks outside the Glen grow back after a few days.',
            'In caves, the way down is sometimes hidden under a rock.',
            'Talking to villagers every day makes them happier — and happier villagers give more.',
        ];
        out.push(r.pick(pool));
        return out;
    },
    forecastText() {
        const w = this.weatherFor?.(this.day + 1) ?? 'sun';
        return { sun: "Tomorrow looks sunny.", rain: "Rain tomorrow — the crops will water themselves!", storm: "A storm is coming tomorrow. The wild things get restless in storms.", snow: "Snow tomorrow. Bundle up." }[w];
    },
    report(line) { if (!this.s.report) this.s.report = []; this.s.report.push(line); },
};
