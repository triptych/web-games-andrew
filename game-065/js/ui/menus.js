// Panels: the pause menu, Team, Summary, Bag, Registry, Workbench, Parts Exchange, Locker,
// World Map and Settings. One panel shows at a time, with a back stack.

import { $, esc, typeChip, statusChip, bar, botImg, focusFirst, fmtCogs, fmtTime } from './dom.js';
import { SPECIES, lineOf, canLearnCard } from '../sim/dex.js';
import { MOVES, moveDesc } from '../sim/data/moves.js';
import { ITEMS, RECIPES, BLUEPRINTS } from '../sim/data/items.js';
import { TRAITS } from '../sim/data/traits.js';
import { TYPES, TYPE_INFO, defensiveProfile } from '../sim/data/types.js';
import { PARTS, SLOT_NAMES } from '../sim/data/parts.js';
import { MAPS, WORLD_NODES } from '../sim/data/maps.js';
import { SEAL_NAMES, SEAL_TYPES } from '../sim/data/story.js';
import { calcStats, TEMPERS, name as unitName, evolutionTarget } from '../sim/unit.js';
import { STATS, STAT_NAMES, STAT_SHORT, xpForLevel, PARTY_SIZE } from '../config.js';

const POCKETS = [['repair', '🩹', 'Repair'], ['spike', '📍', 'Spikes'], ['battle', '🟥', 'Chips'], ['module', '⚙️', 'Modules'], ['kit', '🔧', 'Kits'], ['material', '🔩', 'Materials'], ['card', '🎴', 'Cards'], ['key', '🗝️', 'Key']];

export class Menus {
    constructor(app) {
        this.app = app;
        this.root = $('panel');
        this.stack = [];
        // Clicking the backdrop backs out, but only a press that started there (not one that opened the panel).
        this.root.addEventListener('pointerdown', (e) => { this.downOnBackdrop = e.target === this.root; });
        this.root.addEventListener('click', (e) => { if (e.target === this.root && this.downOnBackdrop) this.back(); this.downOnBackdrop = false; });
    }
    get open() { return !this.root.classList.contains('hidden'); }
    get g() { return this.app.game; }
    get st() { return this.app.game.state; }

    show(name, args = {}, push = true) {
        if (push && this.cur) this.stack.push(this.cur);
        this.cur = { name, args };
        this.root.classList.remove('hidden');
        this.render();
        document.body.classList.add('panel-open');
    }
    render() {
        const { name, args } = this.cur;
        const fn = this[`p_${name}`];
        this.root.innerHTML = `<div class="pnl ${name}">${fn.call(this, args)}</div>`;
        this.root.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.app.audio.sfx('select'); this.act(b.dataset.x, b.dataset); }));
        const close = this.root.querySelector('.pclose');
        if (close) close.addEventListener('click', () => { this.app.audio.sfx('back'); this.back(); });
        if (this[`w_${name}`]) this[`w_${name}`](args);
        focusFirst(this.root);
    }
    refresh() { if (this.open && this.cur) { const f = document.activeElement && document.activeElement.dataset ? JSON.stringify(document.activeElement.dataset) : null; this.render(); if (f) { const d = JSON.parse(f); const el = [...this.root.querySelectorAll('button')].find((b) => JSON.stringify(b.dataset) === f); if (el) el.focus(); void d; } } }
    back() {
        if (!this.cur) return;
        const was = this.cur;
        if (was.args.onClose && !this.stack.length) was.args.onClose();
        if (this.stack.length) { this.cur = this.stack.pop(); this.render(); return; }
        this.close();
    }
    close() {
        const was = this.cur;
        this.cur = null; this.stack = [];
        this.root.classList.add('hidden'); this.root.innerHTML = '';
        document.body.classList.remove('panel-open');
        if (was && was.args.pending) this.app.respond(null);
        this.app.onPanelClosed();
    }
    note(text) { const n = this.root.querySelector('.pnote'); if (n) { n.textContent = text; n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); } }
    head(title, sub = '') { return `<div class="phead"><div class="ptitle">${title}</div>${sub ? `<div class="psub">${sub}</div>` : ''}<button class="pclose" aria-label="Close">✕</button></div>`; }

    // ------------------------------------------------------------------ actions dispatch
    act(x, d) {
        const g = this.g, st = this.st;
        switch (x) {
            case 'go': this.show(d.p, d.arg ? JSON.parse(d.arg) : {}); break;
            case 'save': this.app.saveNow(true); this.note('Game saved.'); break;
            case 'title': this.close(); this.app.quitToTitle(); break;
            case 'summary': this.show('summary', { uid: +d.uid }); break;
            case 'up': { const i = +d.i; if (i > 0) { g.swap(i, i - 1); this.app.view.ow.refreshFollower(g); } this.refresh(); break; }
            case 'takemod': { g.setMod(+d.i, null); this.note('Module returned to the bag.'); this.refresh(); break; }
            case 'givemod': this.show('bag', { pocket: 'module', give: +d.i }); break;
            case 'rename': { const u = st.party[+d.i]; const n = prompt('Nickname (blank to reset):', u.nick || ''); if (n !== null) g.rename(u.uid, n); this.refresh(); break; }
            case 'pocket': this.cur.args.pocket = d.p; this.render(); break;
            case 'item': this.useItem(d.id); break;
            case 'pick': this.cur.args.onPick(+d.i); break;
            case 'slot': this.cur.args.onSlot(+d.i); break;
            case 'craft': { const r = g.craft(+d.i, +(d.n || 1)); this.app.audio.sfx(r.ok ? 'craft' : 'nope'); this.render(); this.note(r.msg); break; }
            case 'build': { const r = g.build(d.bp); this.app.audio.sfx(r.ok ? 'build' : 'nope'); this.render(); this.note(r.msg); if (r.ok) this.app.view.ow.refreshFollower(g); break; }
            case 'buy': { const r = g.buy(d.id, +(d.n || 1)); this.app.audio.sfx(r.ok ? 'coins' : 'nope'); this.render(); this.note(r.msg); break; }
            case 'sell': { const r = g.sell(d.id, +(d.n || 1)); this.app.audio.sfx(r.ok ? 'coins' : 'nope'); this.render(); this.note(r.msg); break; }
            case 'shoptab': this.cur.args.tab = d.t; this.render(); break;
            case 'deposit': { const r = g.deposit(+d.i); this.render(); if (!r.ok) this.note(r.msg); this.app.view.ow.refreshFollower(g); break; }
            case 'withdraw': { const r = g.withdraw(+d.i); this.render(); if (!r.ok) this.note(r.msg); this.app.view.ow.refreshFollower(g); break; }
            case 'release': { const u = st.locker[+d.i]; if (u && confirm(`Release ${unitName(u)} back into the scrap? This can't be undone.`)) { g.release(+d.i); this.render(); } break; }
            case 'reg': this.show('entry', { sp: +d.sp }); break;
            case 'regf': this.cur.args.filter = d.f; this.cur.args.page = 0; this.render(); break;
            case 'regp': this.cur.args.page = Math.max(0, (this.cur.args.page || 0) + +d.n); this.render(); break;
            case 'set': {
                const s = this.app.settings;
                if (d.k === 'muted') s.muted = !s.muted;
                else s[d.k] = isNaN(+d.v) ? d.v : +d.v;
                this.app.applySettings();
                this.render();
                break;
            }
            case 'benchtab': this.cur.args.tab = d.t; this.render(); break;
        }
    }

    // ------------------------------------------------------------------ pause menu
    p_menu() {
        const st = this.st;
        const seen = Object.keys(st.seen).length, owned = Object.keys(st.owned).length;
        const seals = SEAL_NAMES.map((n, i) => `<span class="seal${st.seals > i ? ' got' : ''}" title="${n}" style="--tc:${TYPE_INFO[SEAL_TYPES[i]].color}">${TYPE_INFO[SEAL_TYPES[i]].icon}</span>`).join('');
        const obj = this.g.objective().text;
        return `${this.head('⚙ ' + esc(st.name), `${MAPS[this.g.world.id].name}`)}
            <div class="menu-grid">
                <button class="big default" data-x="go" data-p="team">🤖<span>Team</span></button>
                <button class="big" data-x="go" data-p="registry" ${st.bag.registry ? '' : 'disabled'}>📖<span>Registry</span></button>
                <button class="big" data-x="go" data-p="bag">🎒<span>Bag</span></button>
                <button class="big" data-x="go" data-p="map">🗺️<span>Map</span></button>
                <button class="big" data-x="save">💾<span>Save</span></button>
                <button class="big" data-x="go" data-p="settings">🔧<span>Settings</span></button>
            </div>
            <div class="trainer-card">
                <div class="tc-row"><span>Cogs</span><b>${fmtCogs(st.cogs)}</b></div>
                <div class="tc-row"><span>Registry</span><b>${owned} owned · ${seen} seen / 250</b></div>
                <div class="tc-row"><span>Play time</span><b>${fmtTime(st.playtime)}</b></div>
                <div class="seals">${seals}</div>
                <div class="tc-obj">⚙ ${esc(obj)}</div>
            </div>
            <div class="prow"><button data-x="title" class="ghost">Save &amp; quit to title</button></div>
            <div class="pnote"></div>`;
    }

    // ------------------------------------------------------------------ team
    p_team(a) {
        const P = this.st.party;
        const rows = P.map((u, i) => {
            const S = SPECIES[u.sp], st = calcStats(u);
            const evo = S.evolves ? (S.evolves.k === 'level' ? `Evolves at Lv${S.evolves.lv}` : S.evolves.k === 'kit' ? `Evolves with a ${ITEMS[S.evolves.item].name}` : `Evolves when its sync is high (${u.sync}/220)`) : 'Final form';
            return `<div class="trow">
                <button class="tcell${i === 0 ? ' default' : ''}" data-x="summary" data-uid="${u.uid}">${botImg(u.sp, u.gilded, 'timg')}
                    <span class="tinfo"><span class="tname">${esc(unitName(u))}${u.gilded ? ' <span class="gild">✦</span>' : ''} <small>Lv${u.lv}</small></span>
                    <span class="ttypes">${S.types.map((t) => typeChip(t, true)).join('')}${statusChip(u.st)}</span>
                    ${bar(u.hp / st.hp)}<span class="thp">${u.hp}/${st.hp} · ${esc(evo)}</span></span></button>
                <div class="tacts">
                    <button data-x="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
                    ${u.mod ? `<button data-x="takemod" data-i="${i}" title="Take module">${ITEMS[u.mod].icon}✕</button>` : `<button data-x="givemod" data-i="${i}" title="Give a module">⚙+</button>`}
                    <button data-x="rename" data-i="${i}" title="Nickname">✎</button>
                </div></div>`;
        }).join('');
        void a;
        return `${this.head('Team', 'The first bot leads, and follows you around.')}<div class="tlist">${rows || '<div class="empty">No COM-bots yet.</div>'}</div><div class="pnote"></div>`;
    }

    p_summary({ uid }) {
        const u = this.g.unitByUid(uid);
        if (!u) return this.head('Summary');
        const S = SPECIES[u.sp], st = calcStats(u), T = TEMPERS[u.temper];
        const a = xpForLevel(u.lv), b = xpForLevel(u.lv + 1);
        const stats = STATS.map((s, i) => {
            const mark = T.up === s ? ' up' : T.down === s ? ' down' : '';
            return `<div class="srow${mark}"><span class="sn">${STAT_NAMES[s]}</span><span class="sv">${st[s]}</span>${bar(st[s] / (s === 'hp' ? 400 : 300), 'stat')}<span class="cal" title="Calibration">${'●'.repeat(Math.round(u.cal[i] / 8))}${'○'.repeat(4 - Math.round(u.cal[i] / 8))}</span></div>`;
        }).join('');
        const moves = u.moves.map((m) => { const mv = MOVES[m.id]; return `<div class="mrow" style="--tc:${TYPE_INFO[mv.type].color}"><b>${esc(mv.name)}</b> ${typeChip(mv.type, true)} <span class="mmeta">${mv.cat === 'K' ? 'Kinetic' : mv.cat === 'E' ? 'Energy' : 'Utility'}${mv.pow > 1 ? ` · Power ${mv.pow}` : ''}${mv.acc ? ` · ${mv.acc}%` : ''} · ${m.pp}/${mv.pp}</span><div class="mdesc">${esc(moveDesc(mv))}</div></div>`; }).join('');
        const parts = Object.entries(S.parts).filter(([k]) => k !== 'e').map(([k, v]) => `<span class="part"><i>${SLOT_NAMES[k]}</i> ${esc(PARTS[k][v].name)}</span>`).join('');
        const traits = S.traits.map((t) => `<div class="trait"><b>${esc(TRAITS[t].name)}</b> — ${esc(TRAITS[t].desc)}</div>`).join('');
        return `${this.head(`${esc(unitName(u))} <small>#${String(S.id).padStart(3, '0')} ${u.nick ? esc(S.name) : ''}</small>`, `Lv${u.lv} · ${T.name} temperament · Sync ${u.sync}`)}
            <div class="sumgrid">
                <div class="sumpic">${botImg(u.sp, u.gilded, 'bigimg')}<div class="ttypes">${S.types.map((t) => typeChip(t)).join('')}</div>
                    <div class="xpl">${u.lv < 100 ? `${(u.xp - a).toLocaleString()} / ${(b - a).toLocaleString()} XP` : 'Max level'}</div>${bar((u.xp - a) / Math.max(1, b - a), 'xp')}
                    ${u.mod ? `<div class="held">Holding ${ITEMS[u.mod].icon} ${esc(ITEMS[u.mod].name)}</div>` : ''}</div>
                <div class="sumstats">${stats}<div class="tnote">Calibration dots show how finely this unit was tuned. Temperament: ${T.up ? `+${STAT_SHORT[T.up]} −${STAT_SHORT[T.down]}` : 'balanced'}.</div></div>
            </div>
            <div class="sect">Parts</div><div class="parts">${parts}</div>
            <div class="sect">Traits</div>${traits}
            <div class="sect">Techniques</div>${moves}`;
    }

    // ------------------------------------------------------------------ bag
    p_bag(a) {
        const st = this.st;
        const pocket = a.pocket || 'repair';
        const items = Object.entries(st.bag).filter(([id, n]) => n > 0 && ITEMS[id] && ITEMS[id].pocket === pocket);
        const tabs = POCKETS.map(([p, i, l]) => `<button class="tab${p === pocket ? ' on' : ''}" data-x="pocket" data-p="${p}" title="${l}">${i}<span>${l}</span></button>`).join('');
        const list = items.map(([id, n], i) => {
            const it = ITEMS[id];
            const label = it.pocket === 'card' ? `${it.name}: ${MOVES[it.teach].name}` : it.name;
            const verb = a.give !== undefined ? 'Give' : it.pocket === 'kit' ? 'Install' : it.pocket === 'card' ? 'Teach' : it.pocket === 'module' ? 'Give' : it.pocket === 'repair' ? 'Use' : '';
            return `<button class="irow${i === 0 ? ' default' : ''}" data-x="item" data-id="${id}" ${verb ? '' : 'data-info="1"'}><span class="ii">${it.icon}</span><span class="in">${esc(label)}<small>${esc(it.pocket === 'card' ? moveDesc(MOVES[it.teach]) : it.desc)}</small></span><span class="ic">${it.pocket === 'key' ? '' : '×' + n}</span>${verb ? `<span class="iv">${verb}</span>` : ''}</button>`;
        }).join('');
        return `${this.head('Bag', `${fmtCogs(st.cogs)}`)}<div class="tabs bagtabs">${tabs}</div><div class="ilist">${list || '<div class="empty">Nothing in this pocket.</div>'}</div><div class="pnote"></div>`;
    }

    useItem(id) {
        const g = this.g, it = ITEMS[id], a = this.cur.args;
        if (a.give !== undefined) { const r = g.setMod(a.give, id); this.back(); this.note(r.ok ? `Gave the ${it.name}.` : r.msg); return; }
        if (it.pocket === 'repair') {
            if (it.repel || it.flare) { const r = g.useItem(id, -1); this.note(r.msg); if (r.ok && it.flare) { this.close(); this.app.worldChanged(); } this.render(); return; }
            this.pickBot(`Use the ${it.name} on…`, (i) => { const r = g.useItem(id, i); this.back(); this.render(); this.note(r.msg); this.app.audio.sfx(r.ok ? 'heal' : 'nope'); }, (u) => (it.revive ? u.hp <= 0 : u.hp > 0));
            return;
        }
        if (it.pocket === 'module') { this.pickBot(`Give the ${it.name} to…`, (i) => { const r = g.setMod(i, id); this.back(); this.render(); this.note(r.ok ? `Installed the ${it.name}.` : r.msg); }); return; }
        if (it.pocket === 'kit') {
            this.pickBot(`Install the ${it.name} in…`, (i) => {
                const r = g.useKit(id, i);
                if (!r.ok) { this.back(); this.note(r.msg); this.app.audio.sfx('nope'); return; }
                this.close();
            }, (u) => !!evolutionTarget(u, id));
            return;
        }
        if (it.pocket === 'card') {
            this.pickBot(`Run ${MOVES[it.teach].name} on…`, (i) => {
                const r = g.teach(id, i);
                if (r.needSlot) { this.show('slot', { uid: this.st.party[i].uid, move: it.teach, onSlot: (s) => { const r2 = s < 0 ? { ok: false, msg: 'Cancelled.' } : g.teach(id, i, s); this.stack.pop(); this.back(); this.render(); this.note(r2.msg); }, }); return; }
                this.back(); this.render(); this.note(r.ok ? r.msg : r.msg); this.app.audio.sfx(r.ok ? 'learn' : 'nope');
            }, (u) => canLearnCard(u.sp, it.teach) && !u.moves.some((m) => m.id === it.teach));
        }
    }

    pickBot(title, onPick, ok = () => true) { this.show('pick', { title, onPick, ok }); }
    p_pick(a) {
        const rows = this.st.party.map((u, i) => {
            const st = calcStats(u);
            const can = a.ok(u);
            return `<button class="tcell${can && !this.root.querySelector('.default') ? '' : ''}" data-x="pick" data-i="${i}" ${can ? '' : 'disabled'}>${botImg(u.sp, u.gilded, 'timg')}<span class="tinfo"><span class="tname">${esc(unitName(u))} <small>Lv${u.lv}</small></span>${bar(u.hp / st.hp)}<span class="thp">${u.hp}/${st.hp} ${statusChip(u.st)}${can ? '' : ' · can\'t use'}</span></span></button>`;
        }).join('');
        return `${this.head(esc(a.title))}<div class="tlist">${rows}</div>`;
    }
    p_slot(a) {
        const u = this.g.unitByUid(a.uid);
        const nm = MOVES[a.move];
        return `${this.head(`Forget a technique for ${esc(nm.name)}?`, `${esc(unitName(u))} already knows four.`)}
            <div class="mrow new" style="--tc:${TYPE_INFO[nm.type].color}"><b>NEW: ${esc(nm.name)}</b> ${typeChip(nm.type, true)} <span class="mmeta">${nm.pow > 1 ? `Power ${nm.pow}` : 'Utility'}</span><div class="mdesc">${esc(moveDesc(nm))}</div></div>
            ${u.moves.map((m, i) => { const mv = MOVES[m.id]; return `<button class="mrow btn" data-x="slot" data-i="${i}" style="--tc:${TYPE_INFO[mv.type].color}"><b>${esc(mv.name)}</b> ${typeChip(mv.type, true)} <span class="mmeta">${mv.pow > 1 ? `Power ${mv.pow}` : 'Utility'}</span><div class="mdesc">${esc(moveDesc(mv))}</div></button>`; }).join('')}
            <button class="ghost" data-x="slot" data-i="-1">Keep the old techniques</button>`;
    }

    // ------------------------------------------------------------------ registry
    p_registry(a) {
        const st = this.st;
        const filter = a.filter || 'all';
        const list = SPECIES.slice(1).filter((s) => filter === 'all' ? true : filter === 'owned' ? st.owned[s.id] : filter === 'seen' ? st.seen[s.id] : s.types.includes(filter));
        const per = 30, page = Math.min(a.page || 0, Math.max(0, Math.ceil(list.length / per) - 1));
        const shown = list.slice(page * per, page * per + per);
        const cells = shown.map((s) => {
            const seen = st.seen[s.id], owned = st.owned[s.id];
            return `<button class="rcell${owned ? ' owned' : ''}" data-x="reg" data-sp="${s.id}" ${seen ? '' : 'disabled'}>${seen ? botImg(s.id, false, 'rimg') : '<span class="unk">?</span>'}<span class="rn">#${String(s.id).padStart(3, '0')}</span><span class="rname">${seen ? esc(s.name) : '???'}</span>${owned ? '<i class="rown">⚙</i>' : ''}</button>`;
        }).join('');
        const tfil = ['all', 'owned', 'seen', ...TYPES].map((f) => `<button class="chip${f === filter ? ' on' : ''}" data-x="regf" data-f="${f}">${TYPE_INFO[f] ? TYPE_INFO[f].icon : f === 'all' ? 'All' : f === 'owned' ? 'Owned' : 'Seen'}</button>`).join('');
        return `${this.head('COM-bot Registry', `${Object.keys(st.owned).length} owned · ${Object.keys(st.seen).length} seen · 250 known`)}
            <div class="chips">${tfil}</div>
            <div class="rgrid">${cells || '<div class="empty">Nothing here yet.</div>'}</div>
            <div class="prow pager"><button data-x="regp" data-n="-1" ${page ? '' : 'disabled'}>◂ Prev</button><span>${page + 1} / ${Math.max(1, Math.ceil(list.length / per))}</span><button data-x="regp" data-n="1" ${(page + 1) * per < list.length ? '' : 'disabled'}>Next ▸</button></div>`;
    }

    p_entry({ sp }) {
        const st = this.st;
        const S = SPECIES[sp];
        const owned = st.owned[sp];
        const line = lineOf(sp);
        const chain = line.map((s, i) => {
            const m = s.evolves ? (s.evolves.k === 'level' ? `Lv${s.evolves.lv}` : s.evolves.k === 'kit' ? ITEMS[s.evolves.item].name : 'High sync') : '';
            const seen = st.seen[s.id];
            return `<button class="evo${s.id === sp ? ' cur' : ''}" data-x="reg" data-sp="${s.id}" ${seen ? '' : 'disabled'}>${seen ? botImg(s.id, false, 'eimg') : '<span class="unk">?</span>'}<span>${seen ? esc(s.name) : '???'}</span></button>${i < line.length - 1 ? `<span class="evoarrow">▸<small>${esc(m)}</small></span>` : ''}`;
        }).join('');
        const parts = Object.entries(S.parts).filter(([k]) => k !== 'e').map(([k, v]) => `<span class="part${S.added.some(([a, b]) => a === k && b === v) && S.stage > 1 ? ' new' : ''}"><i>${SLOT_NAMES[k]}</i> ${esc(PARTS[k][v].name)}</span>`).join('');
        const stats = STATS.map((s) => `<div class="srow"><span class="sn">${STAT_NAMES[s]}</span><span class="sv">${S.base[s]}</span>${bar(S.base[s] / 180, 'stat')}</div>`).join('');
        const prof = defensiveProfile(S.types);
        const where = Object.values(MAPS).filter((m) => (m.enc || []).some(([n]) => n === S.name) || (m.encS || []).some(([n]) => n === S.name) || Object.values(m.ents).some((e) => (e.k === 'wreck' || e.k === 'titan') && e.sp === S.name)).map((m) => m.name);
        const traits = S.traits.map((t, i) => `<div class="trait"><b>${esc(TRAITS[t].name)}</b>${S.stages > 1 ? ` <small>(stage ${i + 1})</small>` : ''} — ${esc(TRAITS[t].desc)}</div>`).join('');
        return `${this.head(`#${String(sp).padStart(3, '0')} ${esc(S.name)}`, S.types.map((t) => typeChip(t)).join(' '))}
            <div class="sumgrid">
                <div class="sumpic">${botImg(sp, false, 'bigimg')}<div class="entry">${esc(S.entry)}</div></div>
                <div class="sumstats">${owned ? stats + `<div class="tnote">Base stats total ${S.total}.</div>` : '<div class="empty">Own one to read its specifications.</div>'}</div>
            </div>
            <div class="sect">Evolution line</div><div class="evos">${chain}</div>
            <div class="sect">Parts${S.stage > 1 ? ' <small>(new parts glow)</small>' : ''}</div><div class="parts">${parts}</div>
            ${owned ? `<div class="sect">Traits</div>${traits}` : ''}
            <div class="sect">Matchups</div><div class="prof">${prof.weak.length ? `<div><i>Weak to</i> ${prof.weak.map((t) => typeChip(t, true)).join('')}</div>` : ''}${prof.resist.length ? `<div><i>Resists</i> ${prof.resist.map((t) => typeChip(t, true)).join('')}</div>` : ''}${prof.immune.length ? `<div><i>Immune to</i> ${prof.immune.map((t) => typeChip(t, true)).join('')}</div>` : ''}</div>
            ${where.length ? `<div class="sect">Found in</div><div class="where">${where.map(esc).join(' · ')}</div>` : ''}`;
    }

    // ------------------------------------------------------------------ workbench
    p_bench(a) {
        const st = this.st, g = this.g;
        const tab = a.tab || 'craft';
        const have = (id) => st.bag[id] || 0;
        const recipes = RECIPES.map((r, i) => {
            const ok = g.canCraft(r);
            const mats = Object.entries(r.mats).map(([id, n]) => `<span class="mat${have(id) >= n ? '' : ' short'}">${ITEMS[id].icon} ${have(id)}/${n}</span>`).join('');
            const isKit = ITEMS[r.out].pocket === 'kit';
            if ((tab === 'kits') !== isKit) return '';
            return `<div class="rrow"><span class="ii">${ITEMS[r.out].icon}</span><span class="in">${r.n > 1 ? r.n + '× ' : ''}${esc(ITEMS[r.out].name)} <small>(have ${have(r.out)})</small><span class="mats">${mats}</span></span>
                <button data-x="craft" data-i="${i}" ${ok ? '' : 'disabled'}>Craft</button><button data-x="craft" data-i="${i}" data-n="5" ${g.canCraft(r, 5) ? '' : 'disabled'}>×5</button></div>`;
        }).join('');
        const bps = Object.entries(BLUEPRINTS).filter(([bp]) => st.bag[bp]).map(([bp, B]) => {
            const mats = Object.entries(B.mats).map(([id, n]) => `<span class="mat${have(id) >= n ? '' : ' short'}">${ITEMS[id].icon} ${have(id)}/${n}</span>`).join('');
            const sp = Object.values(SPECIES).find((s) => s && s.name === B.bot);
            return `<div class="rrow bp">${botImg(sp.id, false, 'timg')}<span class="in">${esc(B.bot)} <small>Lv${B.lv}</small><span class="mats">${mats}</span></span><button data-x="build" data-bp="${bp}" ${g.canBuild(bp) ? '' : 'disabled'}>Build</button></div>`;
        }).join('');
        const mats = Object.entries(st.bag).filter(([id, n]) => n > 0 && ITEMS[id] && ITEMS[id].pocket === 'material').map(([id, n]) => `<span class="mat">${ITEMS[id].icon} ${esc(ITEMS[id].name)} ×${n}</span>`).join('');
        return `${this.head('Workbench', 'Turn salvage into spikes, kits, modules and COM-bots.')}
            <div class="tabs"><button class="tab${tab === 'craft' ? ' on' : ''}" data-x="benchtab" data-t="craft">🔧 Craft</button><button class="tab${tab === 'kits' ? ' on' : ''}" data-x="benchtab" data-t="kits">⚙ Upgrade kits</button><button class="tab${tab === 'build' ? ' on' : ''}" data-x="benchtab" data-t="build">📐 Blueprints</button></div>
            <div class="matbar">${mats || '<span class="empty">No materials. Dig through sparkling heaps, and beat wild bots for salvage.</span>'}</div>
            <div class="rlist">${tab === 'build' ? (bps || '<div class="empty">No blueprints yet. They turn up in houses and wrecks.</div>') : recipes}</div>
            <div class="pnote"></div>`;
    }

    // ------------------------------------------------------------------ shop
    p_shop(a) {
        const st = this.st, g = this.g;
        const tab = a.tab || 'buy';
        const stock = tab === 'buy' ? a.stock : tab === 'cards' ? a.cards : Object.keys(st.bag).filter((id) => st.bag[id] > 0 && g.sellPrice(id) > 0);
        const rows = stock.map((id, i) => {
            const it = ITEMS[id];
            const label = it.pocket === 'card' ? `${it.name}: ${MOVES[it.teach].name}` : it.name;
            if (tab === 'sell') return `<div class="rrow"><span class="ii">${it.icon}</span><span class="in">${esc(label)} <small>×${st.bag[id]}</small></span><span class="price">${fmtCogs(g.sellPrice(id))}</span><button data-x="sell" data-id="${id}"${i === 0 ? ' class="default"' : ''}>Sell</button><button data-x="sell" data-id="${id}" data-n="${st.bag[id]}">All</button></div>`;
            const owned = it.pocket === 'card' && st.bag[id];
            return `<div class="rrow"><span class="ii">${it.icon}</span><span class="in">${esc(label)}<small>${esc(it.pocket === 'card' ? moveDesc(MOVES[it.teach]) : it.desc)}</small></span><span class="price">${fmtCogs(it.price)}</span><button data-x="buy" data-id="${id}" ${st.cogs >= it.price && !owned ? '' : 'disabled'}${i === 0 ? ' class="default"' : ''}>${owned ? 'Owned' : 'Buy'}</button>${it.pocket !== 'card' ? `<button data-x="buy" data-id="${id}" data-n="5" ${st.cogs >= it.price * 5 ? '' : 'disabled'}>×5</button>` : ''}</div>`;
        }).join('');
        return `${this.head('Parts Exchange', `You have ${fmtCogs(st.cogs)}`)}
            <div class="tabs"><button class="tab${tab === 'buy' ? ' on' : ''}" data-x="shoptab" data-t="buy">Buy</button>${a.cards && a.cards.length ? `<button class="tab${tab === 'cards' ? ' on' : ''}" data-x="shoptab" data-t="cards">Program cards</button>` : ''}<button class="tab${tab === 'sell' ? ' on' : ''}" data-x="shoptab" data-t="sell">Sell</button></div>
            <div class="rlist">${rows || '<div class="empty">Nothing to show.</div>'}</div><div class="pnote"></div>`;
    }

    // ------------------------------------------------------------------ locker
    p_locker() {
        const st = this.st;
        const cell = (u, i, from) => { const S = SPECIES[u.sp]; return `<div class="lcell">${botImg(u.sp, u.gilded, 'timg')}<span class="lname">${esc(unitName(u))} <small>Lv${u.lv}</small></span><span class="ltypes">${S.types.map((t) => typeChip(t, true)).join('')}</span>
            ${from === 'party' ? `<button data-x="deposit" data-i="${i}" ${st.party.length > 1 ? '' : 'disabled'}>Store ▸</button>` : `<button data-x="withdraw" data-i="${i}" ${st.party.length < PARTY_SIZE ? '' : 'disabled'}>◂ Take</button><button class="ghost sm" data-x="release" data-i="${i}">Release</button>`}</div>`; };
        return `${this.head('Bot Locker', `${st.locker.length} stored. Stored bots are fully repaired.`)}
            <div class="locker"><div class="lcol"><div class="sect">Team (${st.party.length}/6)</div>${st.party.map((u, i) => cell(u, i, 'party')).join('')}</div>
            <div class="lcol"><div class="sect">Locker</div>${st.locker.map((u, i) => cell(u, i, 'locker')).join('') || '<div class="empty">Empty.</div>'}</div></div><div class="pnote"></div>`;
    }

    // ------------------------------------------------------------------ map
    p_map() {
        const st = this.st;
        const here = this.g.world.id;
        const parentOf = (id) => {
            if (WORLD_NODES[id]) return id;
            for (const m of Object.values(MAPS)) for (const t of Object.values(m.w)) if (t[0] === id && WORLD_NODES[m.id]) return m.id;
            return null;
        };
        const cur = parentOf(here);
        const lines = [];
        for (const [id, p] of Object.entries(WORLD_NODES)) for (const t of Object.values(MAPS[id].w)) if (WORLD_NODES[t[0]] && id < t[0]) { const q = WORLD_NODES[t[0]]; lines.push(`<line x1="${p[0] * 100}" y1="${p[1] * 100}" x2="${q[0] * 100}" y2="${q[1] * 100}" class="${st.visited[id] && st.visited[t[0]] ? 'seen' : ''}"/>`); }
        const nodes = Object.entries(WORLD_NODES).map(([id, p]) => {
            const m = MAPS[id];
            const known = st.visited[id];
            const town = m.kind === 'town';
            return `<g class="node${known ? ' known' : ''}${id === cur ? ' here' : ''}${town ? ' town' : ''}" transform="translate(${p[0] * 100} ${p[1] * 100})"><circle r="${town ? 2.6 : 1.6}"/>${known || town ? `<text y="${town ? -4 : 4.6}">${esc(known ? m.name : '???')}</text>` : ''}</g>`;
        }).join('');
        return `${this.head('Map of Midden', `You are in ${esc(MAPS[here].name)}`)}<div class="wmap"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="mg"><stop offset="0" stop-color="#e8c890"/><stop offset="1" stop-color="#a8804a"/></radialGradient></defs><rect x="1" y="1" width="98" height="98" rx="4" fill="url(#mg)"/>${lines.join('')}${nodes}</svg></div>`;
    }

    // ------------------------------------------------------------------ settings
    p_settings() {
        const s = this.app.settings;
        const opt = (k, vals) => vals.map(([v, l]) => `<button class="chip${String(s[k]) === String(v) ? ' on' : ''}" data-x="set" data-k="${k}" data-v="${v}">${l}</button>`).join('');
        return `${this.head('Settings')}
            <div class="setrow"><span>Music</span>${opt('music', [[0, 'Off'], [0.3, 'Low'], [0.55, 'Mid'], [0.85, 'High']])}</div>
            <div class="setrow"><span>Sound</span>${opt('sfx', [[0, 'Off'], [0.4, 'Low'], [0.8, 'Mid'], [1, 'High']])}</div>
            <div class="setrow"><span>Mute all</span><button class="chip${s.muted ? ' on' : ''}" data-x="set" data-k="muted">${s.muted ? 'Muted' : 'Sound on'}</button></div>
            <div class="setrow"><span>Text speed</span>${opt('textSpeed', [['slow', 'Slow'], ['normal', 'Normal'], ['instant', 'Instant']])}</div>
            <div class="setrow"><span>Battle text</span>${opt('battleText', [['auto', 'Auto'], ['manual', 'Press A']])}</div>
            <div class="setrow"><span>Graphics</span>${opt('quality', [['auto', 'Auto'], [0, 'High'], [1, 'Medium'], [2, 'Low'], [3, 'Potato']])}</div>
            <div class="setrow"><span>Film grain</span>${opt('grain', [[0, 'Off'], [1, 'On']])}</div>
            <div class="tnote">Keys: arrows / WASD move · Z, Space or Enter = A · X or Backspace = B · Esc or M = menu · hold Shift to run.</div>`;
    }
}
