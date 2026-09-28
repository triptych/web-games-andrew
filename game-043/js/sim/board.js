// ============================================================
// The Job Board: postings, taking them yourself, assigning
// villagers, turning in, and morning resolution.
// ============================================================

import { ITEM } from '../data/items.js';
import { JOBS } from '../data/jobs.js';
import { rollPostings, assignChance, postingDays } from '../gen/postings.js';
import { rngFor } from '../core/rng.js';

export const BoardMethods = {
    openBoard() {
        if (!this.s.village.board) {
            this.emit('dialog', { name: 'Old Job Board', lines: ['Two weathered posts and a pile of broken boards. This used to be the Job Board.', `Rebuilding it takes 15 Wood. You have ${this.count('wood')}.`], choices: [{ label: 'Rebuild it (15 Wood)', act: () => this.buildJobBoard() }, { label: 'Not yet' }] });
            return;
        }
        this.refreshBoard();
        this.emit('menu', { kind: 'board' });
    },
    boardCtx() {
        return {
            level: this.s.village.level, open: this.openRegions(), species: this.species, byRegion: this.byRegion,
            sites: this.world.sites.filter(s => s.kind === 'cave' || this.s.village.level >= s.region), known: this.s.known.recipes.slice(),
            villagers: this.residents(), season: this.season,
        };
    },
    refreshBoard(force = false) {
        const B = this.s.board;
        if (!this.s.village.board) return;
        if (B.day === this.day && !force) return;
        B.day = this.day;
        const taken = new Set([...B.taken.map(t => t.id), ...B.assigned.map(a => a.id)]);
        B.postings = rollPostings(this.s.seed, this.day, this.boardCtx()).filter(p => !taken.has(p.id));
        // taken postings past their deadline lapse
        const before = B.taken.length;
        B.taken = B.taken.filter(t => t.deadline >= this.day);
        if (B.taken.length < before) this.report?.(`${before - B.taken.length} board job${before - B.taken.length > 1 ? 's' : ''} ran out of time.`);
    },
    takePosting(id) {
        const B = this.s.board;
        const p = B.postings.find(p => p.id === id);
        if (!p || p.villagerOnly) return false;
        if (B.taken.length >= 5) { this.msg('Your journal is full of jobs — finish some first.'); return false; }
        B.postings = B.postings.filter(x => x !== p);
        const t = { ...p, deadline: this.day + p.expires, kills0: this.s.stats.killsBy[p.species] ?? 0 };
        B.taken.push(t);
        this.msg(`Took the job: ${p.title}`, 'quest'); this.sfx('quest');
        this.emit('board');
        return true;
    },
    postingProgress(t) {
        if (t.type === 'gather' || t.type === 'deliver') return { have: this.count(t.item), need: t.n };
        if (t.type === 'hunt') return { have: (this.s.stats.killsBy[t.species] ?? 0) - t.kills0, need: t.n };
        if (t.type === 'delve') return { have: this.s.dungeons[t.site]?.deepest ?? 0, need: t.floor };
        return { have: 0, need: 1 };
    },
    canTurnIn(t) { const pr = this.postingProgress(t); return pr.have >= pr.need; },
    turnIn(id) {
        const B = this.s.board;
        const t = B.taken.find(t => t.id === id);
        if (!t || !this.canTurnIn(t)) { this.msg("That job isn't finished yet."); this.sfx('deny'); return false; }
        if (t.type === 'gather' || t.type === 'deliver') this.take(t.item, t.n);
        B.taken = B.taken.filter(x => x !== t);
        this.payReward(t.reward, true);
        if (t.to && t.reward.friend) this.befriend(t.to, t.reward.friend);
        this.s.stats.questsDone++;
        this.msg(`Job done: ${t.title}!`, 'quest'); this.sfx('fanfare');
        this.emit('board');
        return true;
    },
    payReward(R, toPlayer) {
        if (R.gold) this.p.gold += R.gold;
        for (const [id, n] of R.items ?? []) { if (toPlayer) this.give(id, n, true); else this.s.storehouse.push({ id, n }); }
        if (R.coz) this.addCoziness(R.coz, 'job');
    },
    assignPosting(id, jobs) {
        const B = this.s.board;
        const p = B.postings.find(p => p.id === id);
        if (!p || p.playerOnly || !jobs.length) return false;
        const vs = jobs.map(j => ({ job: j, ...this.s.villagers[j] }));
        if (vs.some(v => v.away || !v.joined)) return false;
        const chance = assignChance(p, vs, JOBS);
        const days = postingDays(p);
        for (const j of jobs) { this.s.villagers[j].away = { id: p.id, until: this.day + days }; if (this.p.companion === j) this.setCompanion(null); }
        B.postings = B.postings.filter(x => x !== p);
        B.assigned.push({ ...p, jobs, chance, until: this.day + days });
        this.msg(`${jobs.map(j => this.people[j].name).join(' & ')} set off: ${p.title} (${Math.round(chance * 100)}%, back in ${days} day${days > 1 ? 's' : ''})`, 'quest');
        this.sfx('quest');
        this.emit('board');
        return true;
    },
    assignPreview(id, jobs) {
        const p = this.s.board.postings.find(p => p.id === id);
        if (!p) return 0;
        return assignChance(p, jobs.map(j => ({ job: j, ...this.s.villagers[j] })), JOBS);
    },
    resolveAssignments() {
        const B = this.s.board;
        const keep = [];
        for (const a of B.assigned) {
            if (a.until > this.day) { keep.push(a); continue; }
            const r = rngFor(this.s.seed, 'assign', a.id);
            const ok = r.chance(a.chance);
            const names = a.jobs.map(j => this.people[j].name).join(' & ');
            if (ok) {
                const R = { ...a.reward, items: [...(a.reward.items ?? [])] };
                if (a.type === 'gather') R.items.push([a.item, a.n]);
                if (a.type === 'hunt') R.items.push([this.species[a.species].drop, a.n]);
                // gather items go to the storehouse so you can see them
                this.payReward({ gold: R.gold, coz: R.coz }, true);
                for (const [id, n] of R.items) this.s.storehouse.push({ id, n });
                this.report(`${names} finished "${a.title}"! +${R.gold} gold, goods in the Storehouse.`);
                for (const j of a.jobs) this.villagerXp(j, 30 + a.stars * 15);
                this.s.stats.questsDone++;
            } else {
                const part = (a.reward.items ?? []).slice(0, 1).map(([id, n]) => [id, Math.max(1, Math.floor(n / 2))]);
                for (const [id, n] of part) this.s.storehouse.push({ id, n });
                this.report(`${names} came back from "${a.title}" empty-handed and tired${part.length ? ' (but found a little)' : ''}.`);
                for (const j of a.jobs) { this.villagerXp(j, 10); this.s.villagers[j].tired = 2; }
            }
            for (const j of a.jobs) this.s.villagers[j].away = null;
        }
        B.assigned = keep;
        // merge storehouse duplicates
        const m = new Map();
        for (const e of this.s.storehouse) m.set(e.id, (m.get(e.id) ?? 0) + e.n);
        this.s.storehouse = [...m].map(([id, n]) => ({ id, n }));
    },
    takeFromStorehouse(id, n) {
        const e = this.s.storehouse.find(e => e.id === id);
        if (!e) return 0;
        const k = Math.min(n, e.n);
        const left = this.give(id, k, true);
        e.n -= (k - left);
        if (e.n <= 0) this.s.storehouse = this.s.storehouse.filter(x => x !== e);
        this.emit('inv');
        return k - left;
    },
    availableHelpers() { return this.residents().filter(j => !this.s.villagers[j].away); },
    itemLabel(id) { return ITEM[id]?.name ?? id; },
};
