// ============================================================
// The main quest state machine.
// quests.main = { ch: 0 prologue | 1..5 chapters | 6 finale, step }
// ============================================================

import { PROLOGUE, CHAPTER1, CHAPTER_N, FINALE, GATE_TEXT, FESTIVAL_LINES } from '../data/story.js';
import { fill } from '../gen/names.js';

export const StoryMethods = {
    chapterSteps(ch = this.s.quests.main.ch) {
        if (ch === 0) return PROLOGUE;
        if (ch === 1) return CHAPTER1;
        if (ch <= 5) return CHAPTER_N;
        return FINALE;
    },
    currentStep() { const q = this.s.quests.main; return this.chapterSteps()[q.step]; },
    storyVars(ch = this.s.quests.main.ch) {
        const k = Math.min(5, Math.max(1, ch));
        const R = this.world.regions[k - 1];
        const site = this.world.sites.find(s => s.kind === 'dungeon' && s.region === k);
        return this.vars({ k, region: R.name, dungeon: site?.name ?? '', gate: GATE_TEXT[R.biome.gate] ?? 'the path', title: this.villageTitle(k) });
    },
    chapterTitle(ch = this.s.quests.main.ch) {
        return ['Prologue — A Letter in the Leaves', 'Chapter 1 — The First Light', 'Chapter 2 — Thorns and Thunder', 'Chapter 3 — The Mirror Water', 'Chapter 4 — Ember and Ash', 'Chapter 5 — The Starlit Spire', 'Finale — The Festival of Glimmering'][ch] ?? '';
    },
    objective() { const st = this.currentStep(); return st ? fill(st.goal, this.storyVars()) : ''; },
    stepDone(st) {
        const q = this.s.quests, f = q.flags, ch = q.main.ch;
        const k = Math.min(5, Math.max(1, ch));
        switch (st.id) {
            case 'talk_mayor': return !!f.met_mayor;
            case 'meet_glim': return !!f.met_glim;
            case 'clear_farm': return this.s.stats.farmCleared >= 10;
            case 'plant': return this.s.stats.planted >= 5;
            case 'board': return this.s.village.board;
            case 'sleep': return this.s.stats.sleeps > (f.boardSleep0 ?? 0);
            case 'welcome': return this.residents().length > 0 || Object.keys(this.s.movingIn).length > 0;
            case 'explore': return !!f['visited_r' + k];
            case 'level': return this.s.village.level >= k;
            case 'gate': return !!f['visited_r' + k];
            case 'dungeon': return !!this.s.dungeons['d' + k]?.cleared;
            case 'return': return this.s.heartwood >= k;
            case 'festival': return !!f.festival;
        }
        return false;
    },
    checkStory() {
        const q = this.s.quests.main;
        let guard = 0;
        while (guard++ < 20) {
            const steps = this.chapterSteps();
            const st = steps[q.step];
            if (!st || st.final) return;
            if (st.id === 'board' && this.s.village.board && this.s.quests.flags.boardSleep0 === undefined) this.s.quests.flags.boardSleep0 = this.s.stats.sleeps;
            if (!this.stepDone(st)) return;
            q.step++;
            if (q.step >= steps.length) {
                q.ch++; q.step = 0;
                if (q.ch === 1) {
                    // the first applicants arrive the morning after the board goes up (sleep step just completed → they're here now)
                    for (const j of ['carpenter', 'farmer']) if (!this.s.applicants.includes(j) && !this.isResident(j)) this.s.applicants.push(j);
                    this.report?.('Two travellers saw the Job Board and came to the plaza!');
                }
                this.emit('chapter', { ch: q.ch, title: this.chapterTitle(q.ch) });
                this.sfx('chapter');
            } else {
                this.emit('objective', this.objective());
            }
        }
    },
    /** Dialogue for the Mayor or Glim that belongs to the current step (said once per step). */
    storyLines(who) {
        const q = this.s.quests;
        const st = this.currentStep();
        const lines = [];
        if (who === 'mayor' && !q.flags.met_mayor) { q.flags.met_mayor = true; }
        if (who === 'glim' && !q.flags.met_glim) {
            if (!q.flags.met_mayor) return [fill("…? (The little light bobs shyly. Maybe talk to the old-timer first.)", this.vars())];
            q.flags.met_glim = true;
            const G = PROLOGUE[1].glim;
            this.checkStory();
            return G.map(l => fill(l, this.vars()));
        }
        if (!st) return lines;
        const src = st[who];
        const key = `seen_${who}_${q.main.ch}_${st.id}`;
        if (src && !q.flags[key]) {
            q.flags[key] = true;
            lines.push(...src.map(l => fill(l, this.storyVars())));
        }
        if (who === 'mayor' && st.id === 'talk_mayor') this.checkStory();
        if (who === 'glim' && st.id === 'festival' && this.s.time.min >= 18 * 60) { this.festival(); return []; }
        if (who === 'mayor' && st.id === 'festival' && this.s.time.min >= 18 * 60) { this.festival(); return []; }
        return lines;
    },
    festival() {
        const q = this.s.quests;
        if (q.flags.festival) return;
        q.flags.festival = true;
        if (!this.s.blessings.includes('allmagic')) this.s.blessings.push('allmagic');
        this.addCoziness(200, 'festival');
        const names = this.residents().map(j => this.people[j].name);
        const lines = FESTIVAL_LINES.map(l => fill(l, this.vars()));
        if (names.length) lines.splice(8, 0, `${names.join(', ')} — everyone is here.`);
        this.emit('festival', { lines });
        this.sfx('fanfare');
        this.checkStory();
    },
    onNewGame() {
        this.s.quests.flags.start = this.day;
    },
};
