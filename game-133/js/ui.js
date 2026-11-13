// The DOM layer: screens, the HUD, the four desk tabs, the petition, the party picker, the handbook, the album.
// It reads the sim and sends commands through `send`; it never changes G.

import {
    VERSION, RANKS, JOBS, CHAPTERS, MERIT, REVIEW_DAYS, FAC, DEBT, RAID, KIND_NAME, FEE, FEE_MULT, VOTE_AT, MG, DAYS, TILL, HEARTS, XP_NEXT,
} from './config.js';
import { ART, CG_FILES, faceStyle } from './assets.js';
import { esc } from './vn.js';
import { chapterOf, questChance, raidPower, advName } from './sim/game.js';
import { TRUSTS, TRUST_NAME, votes } from './sim/rules.js';
import { CAST, ROMANCE, PLACES } from './sim/data/cast.js';
import { ROSTER_BY_ID } from './sim/data/adventurers.js';
import { FOES, TIER_NAME, COUNTS, COUNT_NAME, SITES, SITE_NAME, OMENS, OMEN_NAME, GIVER_NAME } from './sim/data/quests.js';
import { ENDINGS, ENDING } from './sim/data/endings.js';
import { TELLS, BEATS } from './sim/minigames.js';
import { Mini } from './ui/mini.js';

const $ = (id) => document.getElementById(id);
const rank = (r) => `<span class="rank r${r}">${RANKS[r]}</span>`;
const cmd = (c) => `data-cmd='${JSON.stringify(c)}'`;
const pct = (v) => Math.round(v * 100) + '%';
const TAB_BG = { desk: 'office', board: 'hall', roster: 'yard', guild: 'tavern' };

export class UI {
    constructor({ audio, settings, vn, send, onSettings }) {
        this.audio = audio; this.settings = settings; this.vn = vn; this.send = send;
        this.stack = [];
        this.tab = 'desk';
        this.party = null;                 // { quest, sel: [], potion, chart } while the picker is open
        this.raidSel = [];
        this.raidLead = true;
        this.sparWho = null;
        this.mini = new Mini({ audio, send });
        this.lastKey = '';
        $('version').textContent = 'v' + VERSION;
        $('title').querySelector('.title-art').style.backgroundImage = `url('${ART.title}')`;

        // A press that began outside a screen (the finger that opened it) must not click inside it on lift.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        // every button that carries a command or a UI action, anywhere
        document.addEventListener('click', (e) => {
            const b = e.target.closest('[data-cmd], [data-ui]');
            if (!b || b.disabled) return;
            audio.ui('click');
            if (b.dataset.cmd) this.send(JSON.parse(b.dataset.cmd));
            else this.action(b.dataset.ui, b.dataset.arg);
        });
        $('tabs').addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (b) { audio.ui('click'); this.setTab(b.dataset.tab); }
        });
        $('btn-endday').addEventListener('click', () => { audio.ui('click'); this.endDay(); });
        $('party-go').addEventListener('click', () => this.sendParty());

        const bind = (id, key) => {
            const el = $(id);
            el.value = settings[key];
            el.addEventListener('input', () => { settings[key] = +el.value; onSettings(settings); });
        };
        bind('set-music', 'music'); bind('set-sfx', 'sfx'); bind('set-voice', 'voice'); bind('set-speed', 'speed');
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        const el = $(id);
        el.hidden = false;
        el.style.zIndex = 50 + this.stack.length;       // a screen opened from another appears on top of it
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'party') this.party = null;
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    isOpen(id) { return this.stack.includes(id); }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { (this.buttons(id).find((b) => b.classList.contains('primary')) || this.buttons(id)[0])?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        const box = $('toasts');
        while (box.children.length >= 3) box.firstChild.remove();
        box.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }

    /** Floating numbers for what a choice just changed. */
    floats(fx) {
        const NAMES = { gold: 'Gold', merit: 'Merit', renown: 'Renown', integ: 'Honesty', potions: 'Draughts', charts: 'Charts', ap: 'Actions', ...TRUST_NAME };
        if (performance.now() - (this.floatAt || 0) > 1600) this.floatN = 0;
        this.floatAt = performance.now();
        let i = this.floatN || 0;
        for (const k in fx) {
            const v = fx[k];
            if (!v || k.startsWith('xp.') || i >= 6) continue;
            const label = k.startsWith('aff.') ? CAST[k.slice(4)].name.split(' ')[0] + (v > 0 ? ' ♥' : ' ♡') : `${NAMES[k] || k} ${v > 0 ? '+' : ''}${Math.round(v)}`;
            const el = document.createElement('div');
            el.className = 'float ' + (v > 0 ? 'up' : 'down');
            el.textContent = label;
            el.style.top = (i++ * 26) + 'px';
            el.style.animationDelay = ((i - (this.floatN || 0)) * 0.12) + 's';
            $('floats').appendChild(el);
            setTimeout(() => el.remove(), 2600);
        }
        this.floatN = i;
    }

    // ------------------------------------------------------------------ the whole picture
    /** Redraw everything from G. Cheap enough to call after every command. */
    refresh(G) {
        this.G = G;
        const inScene = !!G.scene, hub = !inScene && !G.over;
        $('hud').hidden = false;
        $('hud-day').textContent = `Day ${Math.min(G.day, DAYS)}`;
        $('hud-chapter').textContent = CHAPTERS[chapterOf(G.day)];
        $('hud-job').textContent = JOBS[G.rank];
        $('hud-gold').textContent = G.gold;
        $('hud-renown').textContent = G.renown;
        $('hud-ap').textContent = G.ap;
        $('panel').hidden = !hub;
        this.vn.render(G);
        if (hub) {
            this.vn.setBg(G.phase === 'raid' ? 'deep' : TAB_BG[this.tab]);
            this.vn.dim(true);
            this.vn.setActors([], null);
            this.vn.setCg(null);
            this.drawTabs(G);
            this.drawBody(G);
        }
        // the petitioner at the desk
        if (G.pet && hub) { this.drawPetition(G); if (!this.isOpen('petition')) this.openScreen('petition'); }
        else if (this.isOpen('petition')) this.closeScreen('petition');
        // a mini-game
        if (G.mg && hub) { this.mini.draw(G); if (!this.isOpen('mg')) this.openScreen('mg'); }
        else if (this.isOpen('mg')) this.closeScreen('mg');
        if (this.party) { if (hub && G.board.some((q) => q.id === this.party.quest)) this.drawParty(G); else this.closeScreen('party'); }
    }

    setTab(tab) {
        this.tab = tab;
        if (this.G) this.refresh(this.G);
        $('tab-body').scrollTop = 0;
    }

    drawTabs(G) {
        const dots = { desk: G.queue.length, board: G.board.length, roster: G.advs.filter((a) => a.state === 'hurt').length, guild: G.ap };
        for (const b of $('tabs').children) {
            const t = b.dataset.tab;
            b.classList.toggle('on', t === this.tab);
            b.innerHTML = t[0].toUpperCase() + t.slice(1) + (dots[t] ? `<span class="dot">${dots[t]}</span>` : '');
        }
        const raid = G.phase === 'raid';
        $('tabs').hidden = raid;
        $('btn-endday').hidden = raid;
        $('btn-endday').textContent = G.day >= DAYS ? 'Close the Ledger' : 'End the Day';
    }

    drawBody(G) {
        const el = $('tab-body');
        const key = G.phase === 'raid' ? 'raid' : this.tab;
        const html = key === 'raid' ? this.raidHtml(G) : key === 'desk' ? this.deskHtml(G) : key === 'board' ? this.boardHtml(G) : key === 'roster' ? this.rosterHtml(G) : this.guildHtml(G);
        if (html !== this.lastHtml) { const top = el.scrollTop; el.innerHTML = html; el.scrollTop = this.lastKey === key ? top : 0; this.lastHtml = html; this.lastKey = key; }
    }

    // ------------------------------------------------------------------ Desk
    deskHtml(G) {
        const next = REVIEW_DAYS.find((d) => d >= G.day);
        const need = G.rank < 4 ? MERIT[G.rank + 1] : null;
        const reports = G.reports.map((r) => `<div class="card"><div class="grow"><div class="ttl ${r.res}">${r.res === 'win' ? '✔ Done' : r.res === 'part' ? '◐ Half done' : '✘ Failed'}: ${esc(r.title)}</div>
            <div class="sub">${r.party.map(advName).join(', ')} · ${r.gold ? `+${r.gold} gold` : 'no fee'}${r.posted !== r.rank ? ` · <span class="fail">you posted it ${RANKS[r.posted]}; it was ${RANKS[r.rank]} work</span>` : ''}</div></div></div>`).join('');
        const meter = (k, v, name, cls = '') => `<div class="meter"><div class="lab"><span>${name}</span><b>${v}</b></div><span class="bar mark ${cls}"><i style="width:${v}%"></i></span></div>`;
        return `
            <h3>At your desk</h3>
            <div class="card"><div class="grow"><div class="ttl">${G.queue.length ? `${G.queue.length} petitioner${G.queue.length > 1 ? 's' : ''} waiting` : 'Nobody is waiting'}</div>
                <div class="sub">${G.queue.length ? 'Hear them, and grade the job from what they say.' : G.board.length ? 'There are jobs on the Board to hand out.' : 'The afternoon is yours: see the Guild tab.'}</div></div>
                <div class="acts"><button class="btn primary" id="btn-call" ${cmd({ t: 'call' })} ${G.queue.length ? '' : 'disabled'}>Next, please</button></div></div>
            ${G.reports.length ? `<h3>This morning's reports</h3>${reports}` : ''}
            <h3>Your standing</h3>
            <div class="card"><div class="grow">
                <div class="row" style="min-height:0"><span>${JOBS[G.rank]}${need != null ? ` → ${JOBS[G.rank + 1]}` : ''}</span><b>Merit ${G.merit}${need != null ? ` / ${need}` : ''}</b></div>
                ${need != null ? `<span class="bar gold"><i style="width:${Math.min(100, (G.merit / need) * 100)}%"></i></span>` : ''}
                <div class="sub">${next ? (next === G.day ? 'Pell reviewed your ledger this morning.' : `Pell reviews your ledger on day ${next}.`) : G.day < 29 ? 'The council votes on day 29.' : `${votes(G)} of 5 voices are with you.`}</div>
            </div></div>
            <div class="meters">${TRUSTS.map((k) => meter(k, G.trust[k], TRUST_NAME[k])).join('')}${meter('integ', G.integ, 'Honest ledger', 'plum')}</div>
            <p class="dim small">The mark is ${VOTE_AT}: where a faction would vote for you, on day 29.</p>
            ${G.flags.debt_ext && !G.flags.debt_paid ? `<div class="card"><div class="grow"><div class="ttl fail">The Crown's debt: ${DEBT.late} gold by sunset on day ${DAYS}</div><div class="sub">Pay it from the Guild tab.</div></div></div>` : ''}
            ${!G.flags.debt_paid && !G.flags.debt_ext && G.flags.met_ren ? `<div class="card"><div class="grow"><div class="ttl">The audit is on day ${DEBT.due}</div><div class="sub">The guild owes the Crown ${DEBT.amount} gold.</div></div></div>` : ''}`;
    }

    drawPetition(G) {
        const q = G.pet;
        $('petition-body').innerHTML = `
            <div class="pet-head"><div class="face big" style="background-image:url('${ART.giver(q.type, q.face)}');background-size:118%;background-position:50% 12%"></div>
                <div><h2 style="margin:0">${esc(q.giver)}</h2><div class="dim">${GIVER_NAME[q.type]} · wants: <span class="kind">${KIND_NAME[q.kind]}</span></div></div></div>
            <div class="pet-text" id="pet-text">“${esc(q.text)}”</div>
            <p class="dim small">How dangerous is it? Add the creature, the number, the place${G.day >= 13 ? ' and any omen' : ''}; every two points of threat is a rank.</p>
            <div class="grades">${RANKS.map((n, r) => `<button class="btn" data-grade="${r}" ${cmd({ t: 'grade', rank: r })}>${rank(r)}<span class="dim small">${Math.round(FEE[r] * FEE_MULT[q.type])}g</span></button>`).join('')}</div>
            <div class="sheet-foot"><button class="btn" data-ui="handbook">📖 Handbook</button><button class="btn" ${cmd({ t: 'decline' })}>Send them away</button></div>`;
    }

    // ------------------------------------------------------------------ Board
    boardHtml(G) {
        const ready = G.advs.filter((a) => a.state === 'ready').length;
        const jobs = G.board.map((q) => `<div class="card"><div class="grow"><div class="ttl">${rank(q.posted)} ${esc(q.title)}</div>
            <div class="sub">${esc(q.giver)} · needs <span class="kind">${KIND_NAME[q.kind]}</span> · ${q.days} day${q.days > 1 ? 's' : ''} · about ${q.fee} gold · ${q.expires <= G.day ? '<span class="fail">last day</span>' : `${q.expires - G.day + 1} days left`}</div></div>
            <div class="acts"><button class="btn primary" data-ui="assign" data-arg="${q.id}" ${ready ? '' : 'disabled'}>Assign</button></div></div>`).join('');
        const out = G.out.map((o) => `<div class="card"><div class="grow"><div class="ttl">${rank(o.q.posted)} ${esc(o.q.title)}</div>
            <div class="sub">${o.party.map(advName).join(', ')} · back on day ${o.back}</div></div></div>`).join('');
        return `<h3>Posted and waiting (${G.board.length})</h3>${jobs || '<div class="empty">The board is bare. Hear some petitioners.</div>'}
            <h3>Out on the road (${G.out.length})</h3>${out || '<div class="empty">Nobody is out.</div>'}
            <p class="dim small">${ready} adventurer${ready === 1 ? '' : 's'} ready. A job nobody takes before its last day costs you that petitioner's trust.</p>`;
    }

    action(what, arg) {
        const G = this.G;
        if (what === 'handbook') { this.drawHandbook(G); this.openScreen('handbook'); }
        else if (what === 'assign') { this.party = { quest: +arg, sel: [], potion: false, chart: false }; this.drawParty(G); this.openScreen('party'); }
        else if (what === 'pick') { const p = this.party, i = p.sel.indexOf(arg); if (i >= 0) p.sel.splice(i, 1); else if (p.sel.length < 3) p.sel.push(arg); this.drawParty(G); }
        else if (what === 'potion') { this.party.potion = !this.party.potion; this.drawParty(G); }
        else if (what === 'chart') { this.party.chart = !this.party.chart; this.drawParty(G); }
        else if (what === 'raidpick') { const i = this.raidSel.indexOf(arg); if (i >= 0) this.raidSel.splice(i, 1); else if (this.raidSel.length < RAID.size) this.raidSel.push(arg); this.refresh(G); }
        else if (what === 'raidlead') { this.raidLead = !this.raidLead; this.refresh(G); }
        else if (what === 'raidgo') this.send({ t: 'raid', party: this.raidSel.filter((id) => G.advs.find((a) => a.id === id)?.state === 'ready'), lead: this.raidLead && !!G.flags.will_lead });
        else if (what === 'spar') { const who = $('spar-who')?.value; if (who) this.send({ t: 'play', game: 'spar', arg: who }); }
    }

    drawParty(G) {
        const p = this.party, q = G.board.find((x) => x.id === p.quest);
        if (!q) return;
        p.sel = p.sel.filter((id) => G.advs.find((a) => a.id === id)?.state === 'ready');
        const ready = G.advs.filter((a) => a.state === 'ready');
        const odds = p.sel.length ? questChance(G, q, p.sel, { rank: q.posted, potion: p.potion && G.potions > 0, chart: p.chart && G.charts > 0 }) : 0;
        const word = odds >= 0.9 ? 'They should manage it.' : odds >= 0.7 ? 'Good odds.' : odds >= 0.45 ? 'A coin toss.' : odds > 0 ? 'This is asking for trouble.' : 'Choose one to three adventurers.';
        $('party-head').innerHTML = `${rank(q.posted)} ${esc(q.title)}`;
        $('party-body').innerHTML = `
            <p class="dim">Needs <span class="kind">${KIND_NAME[q.kind]}</span> · ${q.days} day${q.days > 1 ? 's' : ''} away · the odds below are for the rank <b>you</b> posted.</p>
            <div class="pick">${ready.map((a) => { const r = ROSTER_BY_ID[a.id]; return `<button class="btn ${p.sel.includes(a.id) ? 'on' : ''}" data-ui="pick" data-arg="${a.id}" aria-pressed="${p.sel.includes(a.id)}">
                <span class="face" style="${faceStyle(a.id)}"></span><span>${esc(r.name.split(' ')[0])}<br>${rank(a.rank)} <span class="kind">${KIND_NAME[q.kind].slice(0, 3)} ${r[q.kind]}</span></span></button>`; }).join('') || '<div class="empty">Everyone is away or hurt.</div>'}</div>
            <div class="row" style="margin-top:10px"><span class="odds" id="party-odds">${p.sel.length ? pct(odds) : '—'}</span><span class="dim">${word}</span></div>
            <div class="seg">
                <button class="btn small ${p.potion ? 'on' : ''}" data-ui="potion" ${G.potions ? '' : 'disabled'}>🧪 Send a draught (${G.potions}) +10%</button>
                <button class="btn small ${p.chart ? 'on' : ''}" data-ui="chart" ${G.charts ? '' : 'disabled'}>🗺️ Give them a chart (${G.charts}) +5%, a day sooner</button>
            </div>`;
        $('party-go').disabled = !p.sel.length;
    }

    sendParty() {
        const p = this.party;
        if (!p || !p.sel.length) return;
        this.audio.sfx('quill', 0.7);
        const c = { t: 'assign', quest: p.quest, party: p.sel.slice(), potion: p.potion, chart: p.chart };
        this.closeScreen('party');
        this.send(c);
    }

    // ------------------------------------------------------------------ Roster
    rosterHtml(G) {
        const cards = G.advs.map((a) => {
            const r = ROSTER_BY_ID[a.id];
            const state = a.state === 'ready' ? '<span class="win">Ready</span>' : a.state === 'away' ? `<span class="part">Away until day ${G.out.find((o) => o.party.includes(a.id))?.back ?? '?'}</span>` : `<span class="fail">Hurt until day ${a.until}</span>`;
            const xp = a.rank < 4 ? `<span class="bar"><i style="width:${Math.min(100, (a.xp / XP_NEXT[a.rank]) * 100)}%"></i></span>` : '<span class="dim small">A legend. Nothing left to prove.</span>';
            return `<div class="card"><span class="face" style="${faceStyle(a.id)}"></span><div class="grow"><div class="ttl">${esc(r.name)} ${rank(a.rank)}</div>
                <div class="sub">${r.cls} · Might ${r.mgt} · Wits ${r.wit} · Arcana ${r.arc} · Stealth ${r.stl} · ${state}</div>${xp}<div class="sub"><i>${esc(r.note)}</i></div></div>
                ${a.state === 'hurt' ? `<div class="acts"><button class="btn small" ${cmd({ t: 'heal', adv: a.id })} ${G.potions ? '' : 'disabled'}>🧪 Heal</button></div>` : ''}</div>`;
        }).join('');
        return `<h3>The Fellowship (${G.advs.length}) · 🧪 ${G.potions} draughts · 🗺️ ${G.charts} charts</h3>${cards}`;
    }

    // ------------------------------------------------------------------ Guild
    guildHtml(G) {
        const ap = G.ap > 0;
        const people = ROMANCE.filter((id) => G.flags['met_' + id]).map((id) => {
            const c = CAST[id], away = G.advs.find((a) => a.id === id)?.state === 'away', h = G.hearts[id];
            const due = h < 4 && G.aff[id] >= HEARTS[h].aff && G.day >= HEARTS[h].day;
            return `<div class="card"><span class="face" style="${faceStyle(id)}"></span><div class="grow"><div class="ttl">${esc(c.name)} ${G.partner === id ? '💍' : ''}</div>
                <div class="sub">${esc(c.title)} · ${PLACES[c.room].name}</div><div class="hearts" aria-label="${h} of 4 hearts">${'♥'.repeat(h)}${'♡'.repeat(4 - h)}</div>
                <span class="bar plum"><i style="width:${G.aff[id]}%"></i></span></div>
                <div class="acts"><button class="btn ${due ? 'primary' : ''}" data-visit="${id}" ${cmd({ t: 'visit', who: id })} ${ap && !away ? '' : 'disabled'}>${away ? 'Away' : due ? 'Visit ♥' : 'Visit'}</button></div></div>`;
        }).join('');
        const game = (id, icon, name, where, blurb, extra = '') => `<div class="card"><div class="grow"><div class="ttl">${icon} ${name}</div><div class="sub">${where} · ${blurb}</div></div>
            <div class="acts">${extra || `<button class="btn" data-game="${id}" ${cmd({ t: 'play', game: id })} ${ap ? '' : 'disabled'}>Play</button>`}</div></div>`;
        const ready = G.advs.filter((a) => a.state === 'ready' && a.rank < 4);
        if (!ready.some((a) => a.id === this.sparWho)) this.sparWho = ready[0]?.id || null;
        const spar = `<select id="spar-who" aria-label="Spar with">${ready.map((a) => `<option value="${a.id}" ${a.id === this.sparWho ? 'selected' : ''}>${esc(advName(a.id).split(' ')[0])} (${RANKS[a.rank]})</option>`).join('')}</select>
            <button class="btn" data-game="spar" data-ui="spar" ${ap && ready.length ? '' : 'disabled'}>Spar</button>`;
        const rooms = Object.keys(FAC).map((k) => {
            const f = FAC[k], lvl = G.fac[k], cost = f.cost[lvl];
            return `<div class="card"><div class="grow"><div class="ttl">${f.name} <span class="pill">level ${lvl}</span></div><div class="sub">${f.blurb}</div></div>
                <div class="acts">${cost ? `<button class="btn small" ${cmd({ t: 'upgrade', fac: k })} ${G.gold >= cost ? '' : 'disabled'}>Improve · ${cost}g</button>` : '<span class="dim small">Finest in the realm</span>'}</div></div>`;
        }).join('');
        return `
            <h3>This afternoon · ⏳ ${G.ap} free action${G.ap === 1 ? '' : 's'}</h3>
            <div class="card" id="till"><div class="grow"><div class="ttl">🍺 The Tankard's till: <b id="till-n">${Math.floor(G.till)}</b> coins</div>
                <div class="sub">Fills while you are at the desk, up to ${TILL.cap[G.fac.tavern]} a day (<span id="till-day">${Math.floor(G.tillDay)}</span> so far).</div></div>
                <div class="acts"><button class="btn small" id="btn-till" ${cmd({ t: 'till' })} ${G.till >= 1 ? '' : 'disabled'}>Collect</button></div></div>
            ${G.flags.debt_ext && !G.flags.debt_paid ? `<div class="card"><div class="grow"><div class="ttl">The Crown's debt</div><div class="sub">${DEBT.late} gold, due by sunset on day ${DAYS}.</div></div><div class="acts"><button class="btn primary" ${cmd({ t: 'paydebt' })} ${G.gold >= DEBT.late ? '' : 'disabled'}>Pay ${DEBT.late}g</button></div></div>` : ''}
            <h3>Visit someone (1 ⏳)</h3>${people || '<div class="empty">You have not met anyone to visit yet.</div>'}
            <h3>Work a room (1 ⏳)</h3>
            ${game('stamp', '🖋️', 'Stamp Rush', 'Your desk', 'approve or reject eight forms against the checklist. Earns merit and a little gold.')}
            ${game('brew', '🧪', 'The Cauldron', 'Infirmary', `remember the recipe; bottle up to three healing draughts (you have ${G.potions}).`)}
            ${game('route', '🗺️', 'Cartography', 'Map Room', `plot a road within the supplies; earns charts (you have ${G.charts}).`)}
            ${game('dice', '🎲', 'Dragon\'s Hoard', 'The Tankard', `push your luck for gold. Stake ${MG.dice.stake}g.`, `<button class="btn" data-game="dice" ${cmd({ t: 'play', game: 'dice' })} ${ap && G.gold >= MG.dice.stake ? '' : 'disabled'}>Play</button>`)}
            ${game('spar', '⚔️', 'The Sparring Ring', 'Training Yard', 'read an adventurer\'s tells to train them.', spar)}
            <h3>Improve the guild</h3>${rooms}`;
    }

    /** The till ticks in real time: update just its numbers. */
    tick(G) {
        const n = $('till-n');
        if (n && !this.anyScreen()) {
            const v = String(Math.floor(G.till));
            if (n.textContent !== v) { n.textContent = v; $('till-day').textContent = Math.floor(G.tillDay); $('btn-till').disabled = G.till < 1; }
        }
        if (G.mg) this.mini.tick(G);
    }

    endDay() {
        const G = this.G;
        if (!G || G.scene || G.mg || G.pet) return;
        const left = [];
        if (G.queue.length) left.push(`${G.queue.length} petitioner${G.queue.length > 1 ? 's are' : ' is'} still waiting`);
        if (G.ap > 0 && G.day > 1) left.push(`you have ${G.ap} free action${G.ap > 1 ? 's' : ''} left`);
        if (left.length && this.confirmKey !== G.day + '|' + left.join()) { this.confirmKey = G.day + '|' + left.join(); this.toast(`${left.join(' and ')[0].toUpperCase() + left.join(' and ').slice(1)}. Press again to end the day anyway.`); return; }
        this.send({ t: 'endday' });
    }

    // ------------------------------------------------------------------ the raid
    raidHtml(G) {
        this.raidSel = this.raidSel.filter((id) => G.advs.find((a) => a.id === id)?.state === 'ready');
        const lead = this.raidLead && !!G.flags.will_lead;
        const { parts, total } = raidPower(G, this.raidSel, lead);
        const word = total >= RAID.won ? 'Orla nods. “That will do it.”' : total >= RAID.pyrrhic ? 'Orla frowns. “They will pay for every stair.”' : 'Orla says nothing at all.';
        const cards = G.advs.map((a) => {
            const r = ROSTER_BY_ID[a.id], on = this.raidSel.includes(a.id);
            return a.state === 'ready' ? `<button class="btn ${on ? 'on' : ''}" data-ui="raidpick" data-arg="${a.id}" aria-pressed="${on}"><span class="face" style="${faceStyle(a.id)}"></span><span>${esc(r.name.split(' ')[0])}<br>${rank(a.rank)}</span></button>`
                : `<button class="btn" ${cmd({ t: 'heal', adv: a.id })} ${a.state === 'hurt' && G.potions ? '' : 'disabled'}><span class="face" style="${faceStyle(a.id)};filter:grayscale(1)"></span><span>${esc(r.name.split(' ')[0])}<br><span class="fail small">Hurt${G.potions ? ' · 🧪 heal' : ''}</span></span></button>`;
        }).join('');
        return `<h3>The descent · choose up to ${RAID.size}</h3>
            <div class="pick">${cards}</div>
            <div class="card" style="margin-top:10px"><div class="grow">
                ${parts.map(([n, v]) => `<div class="row" style="min-height:0"><span>${n}</span><b>${v > 0 ? '+' : ''}${v}</b></div>`).join('')}
                <div class="row" style="min-height:0"><span class="odds">Strength</span><span class="odds" id="raid-total">${total}</span></div>
                <span class="bar gold"><i style="width:${Math.min(100, (total / (RAID.won * 1.25)) * 100)}%"></i></span>
                <div class="sub">${this.raidSel.length ? word : 'Read her your list.'} Healing draughts are carried down (up to ${RAID.potionMax}).</div></div></div>
            ${G.flags.will_lead ? `<button class="btn ${lead ? 'on' : ''}" data-ui="raidlead" aria-pressed="${lead}">🛡️ You go down with them, carrying Bram's shield</button>` : ''}
            <div class="sheet-foot"><button class="btn primary" id="raid-go" data-ui="raidgo" ${this.raidSel.length ? '' : 'disabled'}>Send them down</button></div>`;
    }

    // ------------------------------------------------------------------ handbook, album, slots, log, ending
    drawHandbook(G) {
        const omens = !G || G.day >= 13 || G.flags.omens;
        const row = (name, pts, words) => `<tr><td>+${pts}</td><td><b>${name}</b><br><span class="dim small">${words}</span></td></tr>`;
        $('handbook-body').innerHTML = `
            <p><b>Threat</b> = creature + number + place${omens ? ' + omen' : ''}. <b>Every two points is a rank:</b>
                ${RANKS.map((n, r) => `${rank(r)} ${r === 4 ? '8+' : `${r * 2}–${r * 2 + 1}`}`).join(' · ')}</p>
            <h3>The creature</h3><table>${TIER_NAME.map((n, t) => row(n, t, FOES.filter((f) => f.tier === t).map((f) => f.many).join(', '))).join('')}</table>
            <h3>How many</h3><table>${COUNT_NAME.map((n, i) => row(n, i, COUNTS[i].map((c) => `“${c[0]}…”`).join(' '))).join('')}</table>
            <h3>Where</h3><table>${SITE_NAME.map((n, i) => row(n, i, SITES[i].join(', '))).join('')}</table>
            ${omens ? `<h3>Omens</h3><table>${OMEN_NAME.map((n, i) => row(n, i, i ? OMENS[i].map((o) => `“${o.trim()}”`).join(' ') : 'nothing said')).join('')}</table>` : ''}
            <h3>Sending a party</h3>
            <p>A party's strength is each member's rank plus their skill at the kind of work (Might, Wits, Arcana or Stealth). The odds you are shown are for the rank <i>you</i> posted: grade a job too low and the party walks into more than they were told. Overcharge a client and they dispute the bill.</p>
            <h3>Stamp Rush: the checklist</h3>
            <p>Approve a form only if it has the <b>client's seal</b>, the <b>party's signature</b>, the <b>fee paid</b>, a party rank <b>at least the job's rank</b>, and, on cursed ground, a <b>Platinum countersign</b>.</p>
            <h3>The Sparring Ring</h3>
            <p>Guard beats Strike · Strike beats Feint · Feint beats Guard.</p>
            <table>${Object.keys(TELLS).map((m) => `<tr><td>${m[0].toUpperCase() + m.slice(1)}</td><td>${TELLS[m].map((t) => `“${t}”`).join(' ')}<br><span class="dim small">Answer with ${Object.keys(BEATS).find((k) => BEATS[k] === m)}.</span></td></tr>`).join('')}</table>
            <h3>Your own ladder</h3>
            <p>${JOBS.slice(0, 5).map((j, i) => `${j}${i ? ` (merit ${MERIT[i]})` : ''}`).join(' → ')} → Guildmaster, by vote. Reviews fall on days ${REVIEW_DAYS.join(', ')}.</p>`;
    }

    openAlbum(album) {
        const found = new Set(album.endings);
        $('album-count').textContent = `${found.size} of ${ENDINGS.length} found.`;
        $('album-body').innerHTML = ENDINGS.map((e) => (found.has(e.id)
            ? `<div class="e"><div class="pic" style="${CG_FILES.has('end-' + e.id) ? `background-image:url('${ART.cg('end-' + e.id)}')` : ''}">${CG_FILES.has('end-' + e.id) ? '' : '🏮'}</div><div class="cap"><b class="t-${e.tone}">${esc(e.title)}</b>${esc(e.hint)}</div></div>`
            : `<div class="e locked"><div class="pic">?</div><div class="cap"><b>— — —</b>${esc(e.hint)}</div></div>`)).join('');
        this.openScreen('album');
    }

    openSlots(mode, slots, onPick) {
        $('slots-head').textContent = mode === 'save' ? 'Save' : 'Load';
        $('slots-list').innerHTML = slots.map((s, i) => {
            if (mode === 'save' && i === 0) return '';
            const label = i === 0 ? 'Autosave' : `Slot ${i}`;
            return `<button class="btn" data-slot="${i}" ${!s && mode === 'load' ? 'disabled' : ''}><b>${label}</b> · ${s ? `${esc(s.sum.name)}, ${esc(s.sum.job)}, day ${s.sum.day}, ${s.sum.gold}g` : 'empty'}</button>`;
        }).join('');
        $('slots-list').onclick = (e) => { const b = e.target.closest('[data-slot]'); if (b && !b.disabled) onPick(mode, +b.dataset.slot); };
        this.openScreen('slots');
    }

    openLog() {
        $('log-body').innerHTML = this.vn.log.map((l) => `<p>${l.who ? `<b>${esc(l.who)}:</b> ` : ''}${l.narr ? `<i>${esc(l.text)}</i>` : esc(l.text)}</p>`).join('') || '<p class="dim">Nothing yet.</p>';
        this.openScreen('log');
        $('log-body').parentElement.scrollTop = 1e6;
    }

    showEnding(G, album) {
        const e = ENDING[G.ending.id];
        const art = CG_FILES.has('end-' + e.id) ? ART.cg('end-' + e.id) : ART.title;
        $('ending-art').style.backgroundImage = `url('${art}')`;
        $('ending-kicker').textContent = { best: 'The best ending', good: 'An ending', mixed: 'An ending', rare: 'A rare ending', bad: 'A bad ending' }[e.tone];
        $('ending-name').textContent = e.title;
        $('ending-name').className = 't-' + e.tone;
        $('ending-text').textContent = `${G.name}, ${JOBS[G.rank]}. ${G.count.wins || 0} quests done, ${G.count.graded || 0} graded true${G.partner ? `, and ${CAST[G.partner].name.split(' ')[0]} beside you` : ''}.`;
        $('ending-count').textContent = `${album.endings.length} of ${ENDINGS.length} endings found.`;
        this.openScreen('ending');
    }
}
