// The Game object every page talks to. It owns the player and world, builds
// pages (text blocks + navigation), runs the clock and day roll-over, deaths,
// level-ups, deeds, mail and the live commentary.

import { R, fmt, clamp } from '../rng.js';
import { colorize, esc, strip } from '../colors.js';
import { h, $ } from './ui.js';
import * as S from './state.js';
import * as W from './world.js';
import { endFight, simDuel, playerDuelStats } from './combat.js';
import { MOUNTS } from '../data/items.js';
import { ADMIN, PETITION_REPLIES } from '../data/text.js';

export const DEEDS = [
    { id: 'firstblood', name: 'First Blood', desc: 'Win your first fight in the Gloamwood.', pts: 5 },
    { id: 'died', name: 'It Happens', desc: 'Die for the first time.', pts: 5 },
    { id: 'lvl5', name: 'Blooded', desc: 'Reach level 5.', pts: 10 },
    { id: 'lvl10', name: 'Hardened', desc: 'Reach level 10.', pts: 15 },
    { id: 'lvl15', name: 'Ready', desc: 'Reach level 15.', pts: 20 },
    { id: 'dk1', name: 'Wyrmslayer', desc: 'Slay the Jade Wyrm.', pts: 50 },
    { id: 'dk5', name: 'Wyrmbane', desc: 'Slay the Jade Wyrm five times.', pts: 75 },
    { id: 'dk10', name: 'Living Legend', desc: 'Slay the Jade Wyrm ten times.', pts: 100 },
    { id: 'flawless10', name: 'Untouchable', desc: 'Win 10 flawless fights.', pts: 15 },
    { id: 'thrill25', name: 'Thrill-seeker', desc: 'Win 25 thrill-seeking fights.', pts: 15 },
    { id: 'rich', name: 'Moneybags', desc: 'Have 10,000 gold in the bank.', pts: 15 },
    { id: 'gems10', name: 'Magpie', desc: 'Hold 10 gems at once.', pts: 10 },
    { id: 'mount', name: 'Saddled', desc: 'Buy a mount.', pts: 10 },
    { id: 'married', name: 'Wedded Bliss', desc: 'Marry Willa or Corwin.', pts: 25 },
    { id: 'drunk', name: 'Legless', desc: 'Get thoroughly drunk at the Crooked Antler.', pts: 5 },
    { id: 'souls20', name: 'Ferryman\'s Favourite', desc: 'Torment 20 restless souls.', pts: 10 },
    { id: 'resurrect', name: 'Back From the Shore', desc: 'Win resurrection from Vorgath.', pts: 10 },
    { id: 'pvp1', name: 'Night Stalker', desc: 'Defeat another warrior in the fields.', pts: 10 },
    { id: 'pvp10', name: 'Terror of the Fields', desc: 'Defeat 10 warriors in the fields.', pts: 20 },
    { id: 'bounty', name: 'Bounty Hunter', desc: 'Collect a bounty.', pts: 15 },
    { id: 'masters', name: 'Graduate', desc: 'Defeat all fourteen masters.', pts: 30 },
    { id: 'days7', name: 'Regular', desc: 'Play for 7 days.', pts: 10 },
    { id: 'days30', name: 'Townsfolk', desc: 'Play for 30 days.', pts: 20 },
    { id: 'chat', name: 'Social Butterfly', desc: 'Say something in the commentary.', pts: 5 },
    { id: 'raven', name: 'Pen Pal', desc: 'Send a raven to another warrior.', pts: 5 },
    { id: 'guild', name: 'Belonging', desc: 'Join or found a guild.', pts: 10 },
    { id: 'bighit', name: 'Mighty Blow', desc: 'Land a single hit of 100 damage or more.', pts: 15 },
    { id: 'outhouse', name: 'A Delicate Matter', desc: 'Visit the Gloamwood outhouse.', pts: 5 },
    { id: 'fairy', name: 'Fairy Friend', desc: 'Give a gem to a forest fairy.', pts: 5 },
];

const CHAT_DESKTOP_NAMES = { village: 'Village Square', inn: 'The Crooked Antler', garden: 'Moonlit Gardens', shades: 'The Pale Shore', stone: 'The Standing Stone', guild: 'Guild Hall' };

export class Game {
    constructor({ ui, scene, audio, prefs, pages, onLogout }) {
        this.ui = ui; this.scene = scene; this.audio = audio; this.prefs = prefs; this.pages = pages;
        this.onLogout = onLogout;
        this.p = null; this.w = null;
        this.flashes = [];
        this.queue = [];          // pending chat lines {due, channel, make()}
        this.nextChat = {};       // per channel: next ambient chat time
        this.greeted = new Set(); // channels greeted this session
        this.recentNews = [];
        this.online = [];
        this.navCount = 0;
        this.ui.onNav = (it) => this.runNav(it);
    }

    // ------------------------------------------------------------ session
    start(player, world, { fresh = false } = {}) {
        this.p = player; this.w = world;
        R.seed((world.seed ^ (player.day * 7919) ^ Date.now()) >>> 0);
        this.queue = []; this.nextChat = {}; this.greeted = new Set(); this.recentNews = [];
        this.refreshOnline(true);
        this.checkClassicDawn();
        if (fresh) {
            this.mail({ from: ADMIN, subject: 'Welcome to Hollowmere!', body: welcomeBody(player.name) });
            this.goto('newday', { first: true });
        } else if (this.p.fight) this.goto('fight');
        else if (this.p.event) this.goto('event');
        else if (!this.p.alive) this.goto('shades');
        else this.goto('village');
        this.scene?.snapView?.();
    }

    save() {
        if (!this.p) return false;
        return S.saveSlot(this.p.slot, this.p, this.w);
    }

    // ------------------------------------------------------------ navigation & page building
    goto(id, arg) {
        this.navCount++;
        const fn = this.pages[id];
        if (!fn) { console.error('no page', id); return; }
        this.cur = { id, arg };
        this.buf = [];
        this.navs = [];
        this.meta = { title: '', view: 'village', channel: null, chatNode: null, area: 'village' };
        const fl = this.flashes;
        this._flashOut = fl;
        const myNav = this.navCount;
        fn(this, arg);
        if (this.navCount !== myNav) return; // the page redirected
        this.flashes = [];
        if (fl.length && !this._flashUsed) this.buf.unshift(h('div', { class: 'flash' }, fl.map((t) => h('p', { html: colorize(t) }))));
        this._flashUsed = false;
        this.ui.mount({ title: this.meta.title, banner: this.meta.banner, blocks: this.buf, navs: this.navs, chatNode: this.meta.chatNode, keepScroll: this.meta.keepScroll });
        this.scene?.setView(this.meta.view);
        this.audio?.setArea(this.meta.area || this.meta.view);
        if (this.meta.channel) this.enterChannel(this.meta.channel);
        this.refreshVitals();
        this.save();
    }

    refresh() { if (this.p && this.cur) this.goto(this.cur.id, this.cur.arg); }

    runNav(it) {
        this.audio?.sfx('click');
        const before = this.navCount;
        let r = it.action;
        if (typeof r === 'function') r = r(this);
        if (r && typeof r.then === 'function') { r.then((x) => { if (typeof x === 'string') this.goto(x); else if (this.navCount === before) this.refresh(); }); return; }
        if (typeof r === 'string') this.goto(r, it.arg);
        else if (this.navCount === before) this.refresh();
    }

    title(t, opts = {}) {
        this.meta.title = t;
        Object.assign(this.meta, opts);
    }
    /** Use pending flashes inside the page instead of at the top. */
    flashHere() { this._flashUsed = true; if (this._flashOut.length) this.buf.push(h('div', { class: 'flash' }, this._flashOut.map((t) => h('p', { html: colorize(t) })))); }
    flash(t) { this.flashes.push(t); }
    text(t, cls = '') { this.buf.push(h('p', { class: cls, html: colorize(t) })); }
    lines(arr, cls = 'log') { this.buf.push(h('div', { class: cls }, arr.map((t) => h('p', { html: colorize(t) })))); }
    say(who, t) { this.buf.push(h('p', { class: 'speech', html: `<span class="spk">${colorize(who)}</span> ${colorize('“' + t + '”')}` })); }
    note(t) { this.buf.push(h('p', { class: 'note', html: colorize(t) })); }
    hr() { this.buf.push(h('hr', { class: 'orn' })); }
    add(node) { this.buf.push(node); return node; }
    heading(t) { this.buf.push(h('h3', { class: 'sub', html: colorize(t) })); }
    nav(section, label, action, opts = {}) {
        let sec = this.navs.find((s) => s.section === section);
        if (!sec) { sec = { section, items: [] }; this.navs.push(sec); }
        sec.items.push({ label, action, ...opts });
    }
    table(head, rows, cls = '') {
        const t = h('table', { class: 'tbl ' + cls });
        if (head) t.append(h('thead', {}, h('tr', {}, head.map((c) => h('th', { html: colorize(c) })))));
        const tb = h('tbody');
        for (const r of rows) {
            const tr = h('tr', r.cls ? { class: r.cls } : {});
            for (const c of (r.cells || r)) tr.append(c && c.nodeType ? h('td', {}, c) : h('td', { html: colorize(String(c)) }));
            tb.append(tr);
        }
        t.append(tb);
        this.buf.push(h('div', { class: 'tbl-wrap' }, t));
    }
    /** An amount box with buttons: buttons = [{label, fn(value), all?:number}] */
    amount({ label, value = '', max, buttons, placeholder = 'Amount' }) {
        const input = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: max ?? null, value, placeholder, 'aria-label': strip(label || placeholder) });
        const row = h('div', { class: 'formrow' });
        if (label) row.append(h('label', { html: colorize(label) }));
        row.append(input);
        for (const b of buttons) {
            row.append(h('button', { type: 'button', class: 'btn' + (b.cls ? ' ' + b.cls : ''), onclick: () => {
                let v = b.all != null ? b.all : Math.floor(Number(input.value));
                if (!Number.isFinite(v) || v < 0) v = 0;
                this.audio?.sfx('click');
                const before = this.navCount;
                const r = b.fn(v);
                if (typeof r === 'string') this.goto(r); else if (this.navCount === before) this.refresh();
            } }, b.label));
        }
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') row.querySelector('button')?.click(); });
        this.buf.push(row);
        return input;
    }
    button(label, fn, cls = '') {
        const b = h('button', { type: 'button', class: 'btn ' + cls, html: colorize(label), onclick: () => {
            this.audio?.sfx('click');
            const before = this.navCount; const r = fn(this);
            if (typeof r === 'string') this.goto(r); else if (this.navCount === before) this.refresh();
        } });
        return b;
    }
    buttons(list) { this.buf.push(h('div', { class: 'btnrow' }, list.map(([l, f, c]) => this.button(l, f, c)))); }
    chat(channel, title, opts = {}) {
        const canPost = opts.canPost !== false;
        const box = this.ui.chatBox(channel, title || CHAT_DESKTOP_NAMES[channel], {
            canPost,
            note: opts.note,
            placeholder: opts.placeholder,
            onPost: (txt) => this.playerSay(channel, txt),
        });
        this.meta.channel = channel;
        this.meta.chatNode = box;
    }

    // ------------------------------------------------------------ vitals / meta UI
    refreshVitals() {
        if (!this.p) return;
        const sp = this.p.spouse === 'willa' ? 'Willa' : this.p.spouse === 'corwin' ? 'Corwin' : this.p.spouse;
        this.ui.renderVitals(this.p, this.w, { clock: this.clockLabel(), spouseName: sp });
        this.ui.setMailBadge(this.p.mail.filter((m) => !m.read).length);
        this.scene?.setTime?.(this.clockMinutes(), this.p.alive);
        this.updateClockBadge();
    }

    updateClockBadge() {
        const el = document.getElementById('clock-badge'); if (!el || !this.p) return;
        const m = this.clockMinutes() % 1440;
        const icon = !this.p.alive ? '☠' : m >= 330 && m < 1170 ? '☀' : '☾';
        el.textContent = `${icon} Day ${this.p.day} · ${this.clockLabel()}`;
    }

    // ------------------------------------------------------------ the clock & days
    clockMinutes() {
        if (this.p.pacing === 'classic') {
            const since = (Date.now() - this.p.lastDawn) / 60000; // real minutes
            return 360 + since * 4;
        }
        return this.p.clock;
    }
    clockLabel() { return S.clockText(this.clockMinutes()); }
    spend(min) { if (this.p.pacing !== 'classic') this.p.clock = Math.min(this.p.clock + min, 360 + 1439); }
    msToDawn() { return Math.max(0, this.p.lastDawn + 6 * 3600000 - Date.now()); }
    checkClassicDawn() {
        if (this.p.pacing === 'classic' && this.msToDawn() <= 0 && this.cur?.id !== 'newday') {
            this.pendingDawn = true;
            return true;
        }
        return false;
    }

    /** Sleep (log out) at 'inn' or 'fields'. Handles both pacing modes. */
    sleep(where) {
        this.p.sleptAt = where;
        if (this.p.pacing === 'classic' && this.msToDawn() > 0) {
            this.save();
            this.onLogout?.(`You settle down to sleep ${where === 'inn' ? 'in your room at the Crooked Antler' : 'under the stars in the fields'}. The next day dawns in ${fmtDur(this.msToDawn())}.`);
            return;
        }
        this.goto('newday', { slept: where });
    }

    /** Roll the world over to a new day and refresh the player. Returns a report. */
    newDay() {
        const p = this.p, w = this.w;
        const reacts = [];
        const res = W.simulateDay(w, p, {
            react: (kind, n) => { if (kind === 'dk' || kind === 'death' || kind === 'wed' || (kind === 'level' && R.chance(0.15))) reacts.push({ kind, who: n.name }); },
            duelPlayer: (npc) => {
                const a = W.npcStats(npc);
                const me = playerDuelStats(p); me.hp = S.maxHp(p);
                const r = simDuel(a, me);
                if (r.winner === 'a') {
                    const gold = p.gold; const exp = Math.round(p.exp * 0.05);
                    p.gold = 0; p.exp -= exp; p.stats.pvpLosses++;
                    return { winner: 'npc', gold, exp };
                }
                return { winner: 'you' };
            },
        });
        this.recentNews = reacts.slice(-6);
        p.day++; p.stats.days++;
        const wasDead = !p.alive;
        p.alive = true;
        p.spirits = R.weighted([-2, -1, 0, 1, 2], (v) => [1, 2, 6, 2, 1][v + 2]);
        const spiritTurns = [-1, 0, 0, 1, 2][p.spirits + 2];
        p.turns = S.turnsPerDay(p) + spiritTurns;
        p.pvp = 3; p.gravefights = 10; p.specUses = S.maxSpecUses(p); p.drunk = 0;
        p.flags = {}; p.buffs = []; p.fight = null; p.event = null; p.soulHp = null;
        p.hp = S.maxHp(p);
        p.clock = 360; p.lastDawn = Date.now();
        const lines = [];
        // interest
        if (p.bank > 0) {
            const rate = 0.02 + R.f() * 0.03;
            const cap = 400 + p.level * 250 + p.dk * 100;
            const i = Math.min(Math.round(p.bank * rate), cap);
            p.bank += i; if (i > 0) lines.push(`\`6Ezra Quill has added \`^${fmt(i)}\`6 gold in interest to your account (${(rate * 100).toFixed(1)}%).`);
        } else if (p.bank < 0) {
            const i = Math.round(-p.bank * 0.05);
            p.bank -= i; lines.push(`\`4Your debt at the Counting House grows by \`$${fmt(i)}\`4 gold in interest.`);
        }
        const m = S.mount(p);
        if (m && m.buff) { p.buffs.push({ id: 'mount', ...m.buff }); lines.push(`\`@Your ${m.name} is rested and eager.`); }
        if (p.spouse) {
            p.buffs.push({ id: 'spouse', name: 'Wedded Bliss', rounds: 20, def: 1.1 });
            lines.push(`\`%You wake beside ${p.spouse === 'willa' ? 'Willa' : 'Corwin'}, who kisses you good morning. You feel protected (\`^Wedded Bliss\`%).`);
        }
        const g = S.guild(p);
        if (g && g.perk === 'charm' && p.charm < 30) { p.charm++; lines.push('`6The Gilded Blades insist you look your best: `^+1 charm`6.'); }
        if (res.goldLost || res.killedBy) { p.stats.deaths++; }
        if (p.stats.days >= 7) this.deed('days7');
        if (p.stats.days >= 30) this.deed('days30');
        // bounties on you placed by people you've beaten
        return { report: res.report, lines, wasDead, spirits: p.spirits, spiritTurns, killedBy: res.killedBy };
    }

    // ------------------------------------------------------------ rewards & penalties
    gainGold(n, fromForest = false) {
        let g = n;
        if (fromForest) {
            g = Math.round(g * (1 + (S.race(this.p).gold || 0)));
            const gu = S.guild(this.p); if (gu && gu.perk === 'gold') g = Math.round(g * 1.1);
            this.p.stats.gold += g;
        }
        this.p.gold += g;
        return g;
    }
    gainGems(n) {
        this.p.gems += n; if (n > 0) { this.p.stats.gems += n; this.audio?.sfx('gem'); }
        if (this.p.gems >= 10) this.deed('gems10');
    }
    /** Die. cause: coded text for the news. */
    die(cause, newsText) {
        const p = this.p;
        const lostGold = p.gold;
        const lostExp = Math.round(p.exp * 0.1);
        p.gold = 0; p.exp -= lostExp; p.hp = 0; p.alive = false; p.stats.deaths++;
        p.buffs = []; p.event = null; // the fight stays until the player leaves its result page
        if (newsText) this.news(newsText);
        this.deed('died');
        this.audio?.sfx('death');
        this.react('death', { foe: cause || 'something' });
        return { lostGold, lostExp };
    }
    news(t) { W.addNews(this.w, t); }
    endFight() { endFight(this.p); }

    deed(id) {
        const p = this.p;
        if (p.deeds[id]) return;
        const d = DEEDS.find((x) => x.id === id); if (!d) return;
        p.deeds[id] = this.p.day || 1;
        p.renown += d.pts;
        setTimeout(() => { this.ui.toast(`\`^Deed earned: \`&${d.name}\`0 · +${d.pts} renown`, '🏆', 'deed'); this.audio?.sfx('deed'); }, 400);
    }

    // ------------------------------------------------------------ mail
    mail({ from, subject, body, gold = 0, gems = 0, fromId = null }) {
        const m = { id: this.p.mailSeq++, from, fromId, subject, body, gold, gems, day: Math.max(1, this.p.day), t: Date.now(), read: false };
        this.p.mail.unshift(m);
        if (this.p.mail.length > 60) this.p.mail.length = 60;
        this.ui.setMailBadge(this.p.mail.filter((x) => !x.read).length);
        return m;
    }
    mailLater(delayMs, m) {
        (this.p.mailQueue ||= []).push({ due: Date.now() + delayMs, ...m });
    }
    petition(text) {
        this.mailLater(R.i(20, 60) * 1000, { from: ADMIN, subject: 'Re: your petition', body: `You wrote:\n“${text.slice(0, 300)}”\n\n${R.pick(PETITION_REPLIES)}\n\n— ${ADMIN}` });
    }

    // ------------------------------------------------------------ online & commentary
    refreshOnline(initial = false) {
        const prev = new Set(this.online.map((n) => n.id));
        this.online = W.computeOnline(this.w);
        const now = new Set(this.online.map((n) => n.id));
        if (!initial && this.meta?.channel === 'village') {
            const arrived = this.online.filter((n) => !prev.has(n.id));
            const left = [...prev].filter((id) => !now.has(id)).map((id) => W.findNpc(this.w, id)).filter(Boolean);
            for (const n of left.slice(0, 1)) if (R.chance(0.5)) this.queueLine('village', R.i(1, 4) * 1000, () => W.byeLine(n), true);
            for (const n of arrived.slice(0, 1)) if (R.chance(0.4)) this.queueLine('village', R.i(2, 6) * 1000, () => W.greetLine(this.w, n, { name: R.pick(this.online)?.name || 'all' }, false));
        }
        this.ui.renderOnline(this.online, (n) => this.showProfile(n));
    }

    queueLine(channel, delay, make, ignoreOffline = false) {
        this.queue.push({ due: Date.now() + delay, channel, make, ignoreOffline });
    }

    enterChannel(ch) {
        const list = this.w.chat[ch] || (this.w.chat[ch] = []);
        const last = list[list.length - 1];
        if (!last || Date.now() - last.t > 4 * 60000) {
            const n = R.i(3, 6);
            for (let i = 0; i < n; i++) {
                const e = W.chatLine(this.w, ch, this.chatCtx(ch));
                if (e) list.push({ ...e, t: Date.now() - (n - i) * R.i(20, 70) * 1000 });
            }
        }
        if (!this.greeted.has(ch) && ch !== 'shades') {
            this.greeted.add(ch);
            const cand = this.online.filter((n) => n.alive && n.chatty > 0.25);
            const isNew = this.p.day <= 2 && this.p.dk === 0;
            if (cand.length && R.chance(isNew ? 0.9 : 0.55)) {
                const k = isNew ? R.i(1, 2) : 1;
                for (let i = 0; i < k; i++) { const n = R.pick(cand); this.queueLine(ch, R.i(2, 7) * 1000 + i * 3000, () => W.greetLine(this.w, n, this.p, isNew)); }
            }
        }
        this.nextChat[ch] = Date.now() + R.i(6, 16) * 1000;
        this.updateChatBox();
    }

    chatCtx(ch) {
        return { player: this.p, online: this.online, recentNews: this.recentNews, drunkNpc: ch === 'inn' && R.chance(0.3) ? R.pick(this.online)?.id : null };
    }

    updateChatBox() {
        const ch = this.meta?.channel; if (!ch) return;
        const box = this.meta.chatNode;
        const here = this.online.filter((n) => (ch === 'shades' ? !n.alive : n.alive)).length;
        this.ui.fillChat(box, this.w.chat[ch] || [], this.p.name, ch === 'shades' ? `${here} restless souls` : `${here} warriors nearby`);
    }

    playerSay(channel, txt) {
        const p = this.p;
        let text = txt.slice(0, 200);
        let emote = false;
        if (text.startsWith('/me ')) { emote = true; text = text.slice(4); }
        else if (text.startsWith(':')) { emote = true; text = text.slice(1).trimStart(); }
        if (p.drunk >= 3 && !emote) text = text.replace(/s/g, 'sh') + ' *hic*';
        if (!p.alive && channel !== 'shades') return;
        W.postChat(this.w, channel, { who: p.name, color: p.lodge.color || '`%', tag: p.guild?.tag || null, emote, text });
        this.audio?.sfx('chat');
        this.deed('chat');
        // replies
        const speakers = this.online.filter((n) => (channel === 'shades' ? !n.alive : n.alive));
        const lower = text.toLowerCase();
        const named = speakers.find((n) => lower.includes(n.name.toLowerCase()));
        const nReplies = named ? 1 : R.chance(0.75) ? R.i(1, 2) : 0;
        const used = new Set();
        for (let i = 0; i < nReplies; i++) {
            const n = i === 0 && named ? named : R.pick(speakers.filter((x) => !used.has(x.id)));
            if (!n) break;
            used.add(n.id);
            this.queueLine(channel, R.i(2, 6) * 1000 + i * R.i(2, 5) * 1000, () => W.replyLine(this.w, n, text, p));
        }
        this.updateChatBox();
    }

    /** Let the crowd react to something the player did. */
    react(kind, extra = {}) {
        const cand = this.online.filter((n) => n.alive && n.chatty > 0.2);
        if (!cand.length) return;
        const k = kind === 'dk' ? R.i(3, 5) : kind === 'level' ? R.i(0, 2) : kind === 'gear' ? (R.chance(0.35) ? 1 : 0) : R.i(1, 2);
        const used = new Set();
        for (let i = 0; i < k; i++) {
            const n = R.pick(cand.filter((x) => !used.has(x.id))); if (!n) break; used.add(n.id);
            this.queueLine('village', R.i(3, 9) * 1000 + i * R.i(2, 5) * 1000, () => W.reactYou(n, kind, this.p, extra));
        }
    }

    tick() {
        if (!this.p) return;
        const now = Date.now();
        // queued lines
        if (this.queue.length) {
            const due = this.queue.filter((q) => q.due <= now);
            this.queue = this.queue.filter((q) => q.due > now);
            for (const q of due) {
                const e = q.make(); if (!e) continue;
                W.postChat(this.w, q.channel, e);
                if (q.channel === this.meta?.channel) { this.audio?.sfx('chat'); this.updateChatBox(); }
            }
        }
        // ambient chat in the current channel
        const ch = this.meta?.channel;
        if (ch && now >= (this.nextChat[ch] || 0)) {
            const e = W.chatLine(this.w, ch, this.chatCtx(ch));
            if (e) {
                W.postChat(this.w, ch, e);
                this.audio?.sfx('chat');
                this.updateChatBox();
                // newbie question → a veteran answers
                if (/\?$/.test(e.text) || /^(how|where|what|why|is|can|does)\b/.test(e.text)) {
                    const vet = this.online.find((n) => n.pers === 'veteran' && n.alive && n.id !== e.id);
                    if (vet && R.chance(0.7)) this.queueLine(ch, R.i(4, 10) * 1000, () => W.answerLine(vet, e.text, e.who));
                }
            }
            const busy = this.online.length;
            this.nextChat[ch] = now + R.i(12, 50) * 1000 * (busy > 14 ? 0.7 : busy < 9 ? 1.4 : 1);
        }
        // online list every minute
        if (!this._lastOnline || now - this._lastOnline > 60000) { this._lastOnline = now; this.refreshOnline(); }
        // queued mail
        if (this.p.mailQueue?.length) {
            const due = this.p.mailQueue.filter((m) => m.due <= now);
            if (due.length) {
                this.p.mailQueue = this.p.mailQueue.filter((m) => m.due > now);
                for (const m of due) { delete m.due; this.mail(m); this.ui.toast(`A raven arrives with a letter from \`^${m.from}\`0.`, '🐦‍⬛'); this.audio?.sfx('raven'); }
                this.save();
            }
        }
        // clock + classic dawn
        const cl = document.getElementById('v-clock'); if (cl) cl.textContent = this.clockLabel();
        this.updateClockBadge();
        if (this.p.pacing === 'classic' && this.msToDawn() <= 0 && !this.p.fight && this.cur?.id !== 'newday' && !this.ui.modalStack) {
            this.flash('`@The sky lightens over the Gloamwood. A new day has dawned!');
            this.goto('newday', { dawn: true });
        }
        if (now - (this._lastSky || 0) > 5000) { this._lastSky = now; this.scene?.setTime?.(this.clockMinutes(), this.p.alive); }
    }

    // ------------------------------------------------------------ profiles
    async showProfile(n) {
        const st = W.npcStats(n);
        const g = n.guild ? this.w.guilds.find((x) => x.tag === n.guild) : null;
        const spouse = n.spouse ? W.findNpc(this.w, n.spouse) : null;
        const body = h('div', { class: 'profile' },
            h('p', { html: colorize(`${n.color}\`b${W.npcFull(n)}\`b`) + (n.alive ? '' : ' <span class="c4b">(dead)</span>') }),
            h('table', { class: 'tbl mini' }, h('tbody', {},
                ...[['Level', n.level], ['Wyrm kills', n.dk], ['Race', S.race({ race: n.race }).name], ['Weapon', W.npcWeapon(n)], ['Armour', W.npcArmor(n)], ['Guild', g ? `<${g.tag}> ${g.name}` : '—'], ['Spouse', spouse ? spouse.name : '—'], ['Sleeps', n.sleep === 'inn' ? 'at the inn' : 'in the fields'], ['Status', this.online.includes(n) ? `online · ${n.loc}` : 'offline'], ['PvP wins', n.pvpWins], ['Bounty', this.w.bounties[n.id] ? fmt(this.w.bounties[n.id]) + ' gold' : '—']]
                    .map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, String(v)))))),
            h('p', { class: 'bio', text: n.bio || '' }),
        );
        const r = await this.ui.modal({ title: 'Warrior Profile', body, buttons: [{ label: 'Write mail', value: 'mail' }, { label: 'Close', value: null }] });
        if (r === 'mail') this.goto('mail', { compose: n.id });
    }
}

function welcomeBody(p) {
    return `Hello ${p}, and welcome to the realm!\n\nA few things every new warrior should know:\n\n• You have a limited number of forest fights each day. Use them wisely.\n• Gold you carry is lost if you die. The Counting House keeps it safe.\n• Sleeping in the fields is free, but other warriors can attack you there overnight. A room at the Crooked Antler keeps you safe.\n• Your master at the Proving Yard decides when you are ready for the next level.\n• At level 15, the Jade Wyrm awaits in the deepest part of the Gloamwood.\n\nBe kind in the square, and petition me if anything seems broken.\n\n— ${ADMIN}, Keeper of the Realm`;
}

export function fmtDur(ms) {
    const m = Math.ceil(ms / 60000);
    const hh = Math.floor(m / 60), mm = m % 60;
    return hh ? `${hh}h ${mm}m` : `${mm}m`;
}
