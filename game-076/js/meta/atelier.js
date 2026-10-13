// The Atelier: the game around the maker. Turns edit events and playtest hooks
// into stats and Ink, checks quests and achievements, advances chapters (with
// their scenes and unlocks), and runs the Trophy Case, the Emporium, the
// Journal, Settings and the Blot.
import { h, modal, toast, clear, field, confirmDialog } from '../editor/ui.js';
import { bus } from '../editor/bus.js';
import { store } from '../editor/store.js';
import { meta, GRANTS, CHAPTER_NAMES, RANKS } from './progress.js';
import { QUESTS, questsFor, qid, evaluate } from './quests.js';
import { ACHIEVEMENTS, TIER_INK, progressOf } from './achievements.js';
import { SHOP } from './shop.js';
import { CHAPTERS, SCENES, WHISPERS } from './story.js';
import { MentorPanel, playScene, portrait, drawQuillon, quillLook } from './mentor.js';

const FEATURE_NAMES = {
    'tool.pencil': 'Pencil', 'tool.eraser': 'Eraser', 'layer.decor': 'Decor layer', start: 'Hero start', playtest: 'Playtest', 'tileset.meadow': 'Meadow tileset',
    events: 'Events', 'cmd.text': 'Show Text', 'cmd.comment': 'Comment', 'tpl.npc': 'NPC template', 'tpl.sign': 'Sign template', 'sprites.villagers': 'Villager sprites',
    db: 'Database', 'db.items': 'Items', 'cmd.item': 'Change Items', 'cmd.gold': 'Change Gold', 'cmd.self': 'Self Switches', pages: 'Event pages', 'tool.rect': 'Rectangle tool', 'tool.fill': 'Fill tool', 'tileset.village': 'Village tileset', 'tpl.chest': 'Chest template', objects: 'Object graphics',
    'maps.many': 'More maps', 'cmd.transfer': 'Transfer Player', 'cmd.erase': 'Erase Event', 'tpl.door': 'Door template', mapprops: 'Map resizing', 'layer.over': 'Over layer', 'tool.picker': 'Eyedropper', 'tileset.interior': 'Interior tileset',
    'cmd.choice': 'Show Choices', 'cmd.switch': 'Switches', 'cmd.var': 'Variables', 'cmd.if': 'Conditional Branch', 'cmd.wait': 'Wait', conditions: 'Page conditions', 'db.switches': 'Switch & variable names',
    'db.actors': 'Heroes', 'db.enemies': 'Enemies', 'db.skills': 'Skills', 'db.troops': 'Troops', 'cmd.battle': 'Battle Processing', 'cmd.heal': 'Recover All', encounters: 'Random encounters', 'tileset.dungeon': 'Dungeon tileset', 'tpl.monster': 'Monster template', 'tpl.spring': 'Healing Spring template',
    'cmd.shop': 'Shop Processing', 'cmd.party': 'Change Party', 'cmd.exp': 'Change EXP', 'tpl.shop': 'Shopkeeper template', 'tpl.inn': 'Inn template', 'tpl.save': 'Save Crystal template', equipment: 'Equipment', 'tileset.castle': 'Castle tileset',
    'trigger.auto': 'Autorun & Parallel', movement: 'NPC movement', 'cmd.route': 'Move routes', 'cmd.fadeout': 'Fades', 'cmd.fadein': 'Fade In', 'cmd.flash': 'Flash', 'cmd.shake': 'Shake', 'cmd.tint': 'Tint', 'cmd.sfx': 'Sound effects', 'cmd.bgm': 'Music', mapmusic: 'Map music', forge: 'Sprite Forge', 'tileset.snow': 'Snowfield tileset',
    export: 'Export', 'db.system': 'System settings', 'cmd.gameover': 'Game Over', 'cmd.end': 'The End', 'tileset.desert': 'Desert tileset', 'tileset.sky': 'Sky Isles tileset',
};

export const atelier = {
    panel: null,
    questsEl: null,
    lastEdit: Date.now(),
    clicks: 0,
    busyScene: false,

    init(rightEl, statusEls) {
        this.status = statusEls;
        this.panel = new MentorPanel(rightEl);
        this.panel.onPortrait = () => this.poke();
        this.chapterEl = h('div.chapter');
        this.questsEl = h('ul.quests', { role: 'list' });
        rightEl.append(this.chapterEl, this.questsEl, h('div.mentorbtns',
            h('button.small', { text: '📖 Journal', on: { click: () => this.journal() } }),
            h('button.small', { text: '🏆 Trophies', on: { click: () => this.trophies() } }),
            h('button.small', { text: '🛍 Emporium', on: { click: () => this.emporium() } })));
        bus.on('edit', (e) => this.onEdit(e));
        bus.on('hook', (e) => this.onHook(e));
        bus.on('change', () => this.soon());
        bus.on('project', () => this.soon());
        bus.on('ink', (e) => { this.drawStatus(); if (e.n > 0 && e.why) this.inkPop(e.n); });
        bus.on('rank', (r) => toast('You are now a ' + r.title + '.', 'rank', { icon: '✒', title: 'Maker Rank ' + r.level, ms: 5000 }));
        bus.on('playtest-warn', (m) => toast(m, 'warn', { ms: 7000 }));
        setInterval(() => this.tick(), 15000);
        this.applyTheme();
        this.drawStatus();
        this.render();
    },

    // ── stats and Ink from editing ──
    onEdit(e) {
        const d = meta.data;
        this.lastEdit = Date.now();
        this.whispered = false;
        switch (e.kind) {
            case 'paint': case 'erase': {
                meta.stat(e.kind === 'paint' ? 'painted' : 'erased', e.n || 0);
                // 1 Ink per 20 tiles, at most 30 a minute
                const c = d.inkClock;
                const now = Date.now();
                if (now - c.t > 60000) { c.t = now; c.given = 0; }
                c.painted = (c.painted || 0) + (e.n || 0);
                const earn = Math.min(Math.floor(c.painted / 20), 30 - (c.given || 0));
                if (earn > 0) { c.painted -= earn * 20; c.given = (c.given || 0) + earn; meta.addInk(earn); }
                break;
            }
            case 'fill': meta.stat('fills'); break;
            case 'eventEdit': break;
            case 'commandAdd': meta.stat('commands'); meta.addInk(1); if (e.type === 'text') meta.stat('texts'); break;
            case 'mapCreate': meta.stat('maps'); meta.addInk(5, 'map'); break;
            case 'dbCreate': meta.stat('db'); meta.addInk(5, 'db'); break;
            case 'forge': meta.stat('forged'); meta.addInk(5, 'forge'); break;
            case 'undo': meta.stat('undos'); break;
            case 'playtest': {
                meta.stat('playtests');
                if (Date.now() - (d.flags.lastPlaytestInk || 0) > 120000) { d.flags.lastPlaytestInk = Date.now(); meta.addInk(6, 'playtest'); }
                break;
            }
            case 'export': meta.stat('exports'); meta.addInk(25, 'export'); break;
            case 'download': meta.stat('downloads'); break;
            case 'import': meta.stat('imports'); break;
            case 'newEvent': meta.stat('events'); meta.addInk(4, 'event'); break;
        }
        meta.save();
        this.soon();
    },
    onHook({ name, data }) {
        const f = meta.data.flags;
        const mark = (k) => { if (!f['hook.' + k]) { f['hook.' + k] = true; meta.save(); this.soon(); } };
        mark(name);
        if (name === 'text' && (data.trigger === 'action' || data.trigger === 'touch')) mark('talk');
        if (name === 'battleWin') meta.stat('battlesWon');
        if (name === 'battleLose' || name === 'gameover') meta.stat('battlesLost');
        if (name === 'shopBuy') meta.stat('shopBuys');
        if (name === 'levelUp') meta.stat('levelUps');
        if (name === 'ending') meta.stat('endings');
        if (name === 'transfer') meta.stat('transfers');
        if (name === 'choice') meta.stat('choices');
        if (name === 'save') meta.stat('saves');
        if (name === 'item') meta.stat('chests');
        this.soon();
    },

    soon() { clearTimeout(this.evalT); this.evalT = setTimeout(() => this.evaluate(), 250); },
    ctx() { return { p: store.project, stats: meta.data.stats, flags: meta.data.flags, inkEarned: meta.data.inkEarned }; },

    /** Check quests, achievements and whether a chapter is finished. */
    evaluate() {
        if (!store.project) return;
        const d = meta.data, x = this.ctx();
        let changed = false;
        // a copy of the sample game teaches by example; its content doesn't earn quests or project trophies
        const sample = !!(store.project.meta && store.project.meta.sample);
        const live = sample ? [] : meta.free ? QUESTS : QUESTS.filter((q) => q.ch <= d.chapter);
        for (const q of live) {
            const k = qid(q);
            if (d.quests[k]) continue;
            if (evaluate(q, x).done) {
                d.quests[k] = Date.now();
                changed = true;
                meta.addInk(40, 'quest');
                toast(q.desc, 'quest', { icon: '✔', title: 'Quest complete: ' + q.title });
            }
        }
        if (QUESTS.every((q) => d.quests[qid(q)])) d.flags.allquests = true;
        for (const a of ACHIEVEMENTS) {
            if (d.achievements[a.id]) continue;
            if (sample && a.check) continue;
            const [n, goal] = progressOf(a, x);
            if (n >= goal) {
                d.achievements[a.id] = { at: Date.now(), free: meta.free };
                changed = true;
                meta.addInk(TIER_INK[a.tier], 'achievement');
                toast(a.desc, 'trophy ' + a.tier, { icon: '🏆', title: a.name, ms: 5000 });
            }
        }
        if (changed) meta.save();
        // chapter progress (story mode)
        if (!meta.free && d.chapter < 9 && !this.busyScene) {
            const qs = questsFor(d.chapter);
            if (qs.length && qs.every((q) => d.quests[qid(q)])) this.finishChapter();
        }
        this.render();
    },

    finishChapter() {
        const d = meta.data, ch = d.chapter;
        this.busyScene = true;
        playScene('ch' + ch + '-end', () => {
            d.chapter = ch + 1;
            meta.addInk(150, 'chapter');
            if (d.chapter >= 9) { d.done = true; d.flags.storydone = true; }
            meta.save();
            this.restored(ch + 1);
            bus.emit('unlocks', d.chapter);
            this.applyTheme();
            this.busyScene = false;
            if (d.chapter < 9) playScene('ch' + d.chapter + '-start', () => { this.render(); this.greet(); this.evaluate(); });
            else { this.render(); this.evaluate(); }
        });
    },
    /** A card listing what a chapter restored. */
    restored(ch) {
        const list = (GRANTS[ch] || []).map((f) => FEATURE_NAMES[f] || f);
        const c = CHAPTERS[ch];
        modal({
            title: ch >= 9 ? 'The Worldbook is whole' : 'Glyph restored: ' + (c.glyph || c.title), cls: 'restored',
            body: h('div.restoredbody', h('div.glyph', { text: ch >= 9 ? '✦' : '✧' }), h('p', { text: ch >= 9 ? 'Every tool in the Atelier is yours. You are a Worldsmith.' : 'Chapter ' + ch + ': ' + c.title + ' — ' + c.blurb }), h('ul.unlocklist', ...list.map((t) => h('li', { text: '✓ ' + t })))),
            buttons: [{ label: 'Onward', primary: true }],
        });
    },

    // ── the quest panel ──
    render() {
        const d = meta.data;
        if (!this.questsEl) return;
        clear(this.chapterEl); clear(this.questsEl);
        const x = this.ctx();
        const ch = meta.free ? null : Math.min(d.chapter, 9);
        if (ch === null) this.chapterEl.append(h('div.chlabel', { text: 'Free Mode' }), h('div.chtitle', { text: 'All quests' }));
        else this.chapterEl.append(h('div.chlabel', { text: ch >= 9 ? 'Epilogue' : ch === 0 ? 'Prologue' : 'Chapter ' + ch }), h('div.chtitle', { text: CHAPTERS[ch].title }));
        const qs = ch === null ? QUESTS.filter((q) => !d.quests[qid(q)]).slice(0, 8) : ch >= 9 ? [] : questsFor(ch);
        const done = qs.filter((q) => d.quests[qid(q)]).length;
        if (qs.length) this.chapterEl.appendChild(h('div.chbar', h('i', { style: { width: (100 * done / qs.length) + '%' } })));
        let first = true;
        for (const q of qs) {
            const ok = !!d.quests[qid(q)];
            const r = ok ? { progress: 1, goal: 1 } : evaluate(q, x);
            const li = h('li.quest' + (ok ? '.done' : first ? '.current' : ''),
                h('span.qbox', { text: ok ? '✔' : '' }),
                h('div.qtext', h('b', { text: q.title }), h('span', { text: q.desc }), !ok && r.goal > 1 ? h('span.qprog', { text: Math.min(r.progress, r.goal) + ' / ' + r.goal }) : null),
                !ok && q.show ? h('button.small.showme', { text: 'Show me', on: { click: () => this.showMe(q) } }) : null);
            this.questsEl.appendChild(li);
            if (!ok && first) { first = false; this.current = q; }
        }
        if (store.project.meta && store.project.meta.sample) this.questsEl.prepend(h('li.quest.note', h('span.qbox', { text: '🏮' }), h('div.qtext', h('b', { text: 'This is the sample game' }), h('span', { text: 'Take it apart and learn from it. Quests count in your own projects (Project ▸ New or Open).' }))));
        if (ch !== null && ch >= 9) this.questsEl.appendChild(h('li.quest.done', h('span.qbox', { text: '✦' }), h('div.qtext', h('b', { text: 'Worldsmith' }), h('span', { text: 'The story is finished. Every tool is yours: make anything.' }))));
        if (!qs.length && ch === null) this.questsEl.appendChild(h('li.quest.done', h('span.qbox', { text: '✦' }), h('div.qtext', h('b', { text: 'Every quest done' }))));
        const blot = meta.free ? 0 : Math.max(0, 1 - d.chapter / 9);
        document.documentElement.style.setProperty('--blot', blot.toFixed(3));
    },
    greet() {
        const q = this.current;
        if (q && meta.data.settings.mentor) this.panel.speak('Q', q.hint);
    },
    showMe(q) {
        this.panel.speak('Q', q.hint);
        const el = document.getElementById(q.show) || document.querySelector('[data-show="' + q.show + '"]');
        if (!el) return;
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 3200);
        bus.emit('show-me', q.show);
    },
    poke() {
        this.clicks++;
        if (this.clicks % 3 === 0) {
            meta.data.flags.mottClicks = (meta.data.flags.mottClicks || 0) + 1;
            if (meta.data.flags.mottClicks >= 10) meta.data.flags.mott10 = true;
            meta.save();
            const lines = ['Hello! Hello! Did you need a moth?', 'I\'m not in the way, I\'m SUPERVISING.', 'Is that a chest? Is there a button in it?', 'Quillon says I can\'t drink the palette.', 'Make a map with a lamp in it! For me!'];
            this.panel.speak('M', lines[meta.data.flags.mottClicks % lines.length]);
            this.soon();
        } else if (this.current) this.panel.speak('Q', this.current.hint);
    },

    // ── the Blot and the clock ──
    tick() {
        const hr = new Date().getHours();
        if (hr >= 0 && hr < 4 && !meta.data.flags.nightowl) { meta.data.flags.nightowl = true; meta.save(); this.soon(); }
        meta.data.stats.minutes += 0.25;
        if (meta.free || meta.data.chapter >= 9 || this.whispered || document.querySelector('.modal-back,.playtest,.scene')) return;
        if (Date.now() - this.lastEdit > 90000) {
            this.whispered = true;
            const [b, q] = WHISPERS[Math.floor(Math.random() * WHISPERS.length)];
            this.panel.speak('B', b);
            setTimeout(() => this.panel.speak('Q', q), 4500);
        }
    },

    // ── status bar ──
    drawStatus() {
        const s = this.status;
        if (!s) return;
        const r = meta.rank();
        s.ink.textContent = '✒ ' + meta.data.ink;
        s.ink.title = 'Ink: ' + meta.data.ink + ' to spend, ' + meta.data.inkEarned + ' earned in all';
        s.rank.textContent = r.title;
        s.rank.title = 'Maker Rank ' + r.level + ' of 20' + (r.next ? ' — ' + (r.next - r.earned) + ' Ink to the next' : '');
        s.rankbar.style.width = (r.next ? 100 * (r.earned - r.prev) / (r.next - r.prev) : 100) + '%';
    },
    inkPop(n) {
        const el = this.status && this.status.ink;
        if (!el) return;
        const pop = h('span.inkpop', { text: '+' + n });
        el.parentElement.appendChild(pop);
        setTimeout(() => pop.remove(), 1200);
    },

    applyTheme() {
        const th = meta.data.settings.theme || 'default';
        const ok = th === 'default' || meta.has('theme.' + th);
        document.body.dataset.theme = ok ? th : 'default';
    },

    // ── screens ──
    trophies() {
        const d = meta.data, x = this.ctx();
        const got = ACHIEVEMENTS.filter((a) => d.achievements[a.id]).length;
        const grid = h('div.trophies');
        for (const a of ACHIEVEMENTS) {
            const have = d.achievements[a.id];
            const [n, goal] = progressOf(a, x);
            const secret = a.hidden && !have;
            grid.appendChild(h('div.trophy.' + a.tier + (have ? '.have' : ''),
                h('div.tmedal', { text: have ? '🏆' : secret ? '❔' : '○' }),
                h('div.tbody', h('b', { text: secret ? '???' : a.name + (have && have.free ? ' ✦' : '') }), h('span', { text: secret ? 'A secret.' : a.desc }),
                    !have && !secret && goal > 1 ? h('div.tprog', h('i', { style: { width: Math.min(100, 100 * n / goal) + '%' } }), h('em', { text: Math.min(n, goal) + ' / ' + goal })) : null),
                h('div.ttier', { text: a.tier + ' · ' + TIER_INK[a.tier] + ' ✒' })));
        }
        modal({ title: 'Trophy Case — ' + got + ' / ' + ACHIEVEMENTS.length, full: true, body: h('div', h('p.hint', { text: '✦ marks a trophy earned in Free Mode.' }), grid), buttons: [{ label: 'Close' }] });
    },

    emporium() {
        const TW = store.TW;
        const body = h('div.shop');
        const draw = () => {
            clear(body);
            const mott = portrait(80, 'M');
            body.appendChild(h('div.shophead', mott.el, h('div', h('h3', { text: 'The Inkwell Emporium' }), h('p', { text: 'Tilesets! Monsters! Songs! Hats! Everything I sell is for your games or for the Atelier, never tools: those you earn. I take payment in Ink. Mmm, ink.' }), h('div.inkbig', { text: '✒ ' + meta.data.ink + ' Ink' }))));
            const cats = [...new Set(SHOP.map((s) => s.cat))];
            for (const cat of cats) {
                const row = h('div.shopgrid');
                for (const it of SHOP.filter((s) => s.cat === cat)) {
                    const own = !!meta.data.owned[it.id] || (it.id === 'tileset.sky' && meta.has('tileset.sky'));
                    const pv = h('div.shopprev');
                    try { preview(TW, it.preview, pv); } catch { /* preview only */ }
                    row.appendChild(h('div.shopitem' + (own ? '.owned' : ''), pv, h('b', { text: it.name }), h('p', { text: it.desc }),
                        own ? h('div.ownedtag', { text: '✓ Yours' }) : h('button.primary.small', { text: it.price + ' ✒', disabled: meta.data.ink < it.price, title: meta.data.ink < it.price ? 'Not enough Ink yet' : 'Buy', on: { click: () => this.buy(it, draw) } })));
                }
                body.append(h('h4', { text: cat }), row);
            }
        };
        draw();
        modal({ title: 'Inkwell Emporium', full: true, body, buttons: [{ label: 'Close' }], onClose: () => TW.audio.stopMusic() });
    },
    buy(it, redraw) {
        if (!meta.spend(it.price)) { toast('Not enough Ink.', 'warn'); return; }
        meta.data.owned[it.id] = true;
        meta.stat('bought');
        meta.save();
        toast('Mott wraps it up in a leaf.', 'ok', { icon: '🛍', title: it.name + ' is yours' });
        if (it.id.startsWith('theme.')) { meta.data.settings.theme = it.id.slice(6); meta.save(); this.applyTheme(); }
        bus.emit('unlocks', meta.data.chapter);
        this.soon();
        redraw();
    },

    journal() {
        const d = meta.data;
        const list = h('div.journal');
        list.appendChild(h('p', { text: 'Every scene you have seen, to read again.' }));
        for (const [id, sc] of Object.entries(SCENES)) {
            const seen = d.seen.includes(id);
            list.appendChild(h('button.journalrow' + (seen ? '' : '.locked'), { disabled: !seen, on: { click: () => playScene(id) } }, h('span', { text: seen ? '📖' : '🔒' }), h('span', { text: seen ? sc.title : '???' })));
        }
        const st = d.stats;
        const stats = h('table.statsTable', ...[['Tiles painted', st.painted], ['Commands written', st.commands], ['Playtests', st.playtests], ['Battles won in playtests', st.battlesWon], ['Exports', st.exports], ['Ink earned', d.inkEarned], ['Minutes in the Atelier', Math.round(st.minutes)]].map(([k, v]) => h('tr', h('th', { text: k }), h('td', { text: String(Math.round(v)) }))));
        modal({ title: 'Journal', wide: true, body: h('div.journalwrap', list, h('div', h('h3', { text: 'Your ledger' }), stats)), buttons: [{ label: 'Close' }] });
    },

    settings(onReset) {
        const s = meta.data.settings;
        const themes = [['default', 'Ink (default)'], ['parchment', 'Parchment'], ['midnight', 'Midnight Ink'], ['synthwave', 'Synthwave']].map(([id, n]) => { const ok = id === 'default' || meta.has('theme.' + id); return [id, n + (ok ? '' : ' 🔒'), !ok]; });
        const body = h('div.form',
            field('Atelier theme', 'select', s.theme, (v) => { s.theme = v; meta.save(); this.applyTheme(); }, { options: themes }),
            field('Sound effects', 'check', s.sound, (v) => { s.sound = v; meta.save(); store.TW.audio.configure({ sound: v }); }),
            field('Music', 'check', s.music, (v) => { s.music = v; meta.save(); store.TW.audio.configure({ music: v }); }),
            field('Volume', 'range', s.volume, (v) => { s.volume = v; meta.save(); store.TW.audio.configure({ volume: v }); }, { min: 0, max: 1, step: 0.05 }),
            field('Reduce motion', 'check', s.reduceMotion, (v) => { s.reduceMotion = v; meta.save(); document.body.classList.toggle('reduce-motion', v); }),
            field('Quillon gives hints', 'check', s.mentor, (v) => { s.mentor = v; meta.save(); }),
            h('hr'),
            meta.free ? h('p', { text: 'Free Mode is on: everything is unlocked.' }) : h('div', h('p', { text: 'Free Mode unlocks every tool at once. Quests and trophies still count (marked ✦). This can\'t be undone without resetting your progress.' }),
                h('button', { text: 'Switch to Free Mode', on: { click: async () => { if (await confirmDialog('Free Mode', 'Unlock every tool now? The story stays readable in the Journal.', 'Unlock everything')) { this.goFree(); } } } })),
            h('hr'),
            h('button.danger', { text: 'Reset Atelier progress…', on: { click: async () => { if (await confirmDialog('Reset progress', 'Reset chapters, quests, trophies, Ink and purchases? Your projects are kept.', 'Reset', true)) { meta.reset(); if (onReset) onReset(); } } } }));
        modal({ title: 'Settings', body, buttons: [{ label: 'Close' }] });
    },
    goFree() {
        meta.data.mode = 'free';
        meta.data.flags.free = true;
        meta.save();
        document.querySelectorAll('.modal-back').forEach((m) => m.remove());
        bus.emit('unlocks', meta.data.chapter);
        this.render();
        this.soon();
        playScene('free-start');
    },
};

/** A small preview of an Emporium item. */
function preview(TW, pv, el) {
    const c = h('canvas');
    if (pv.tileset) {
        const ts = TW.tiles.TILESETS[pv.tileset];
        c.width = 8 * 16; c.height = 2 * 16;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        ts.tiles.slice(0, 16).forEach((t, i) => g.drawImage(TW.tiles.tileCanvas(pv.tileset, i + 1, 0, 0), (i % 8) * 16, Math.floor(i / 8) * 16));
    } else if (pv.sprites) {
        c.width = pv.sprites.length * 18; c.height = 20;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        pv.sprites.forEach((s, i) => TW.sprites.drawChar(g, s, 2, 1, i * 18, 0));
    } else if (pv.monsters) {
        c.width = pv.monsters.length * 50; c.height = 48;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        pv.monsters.forEach((m, i) => g.drawImage(TW.sprites.monster({ family: m, size: 'M' }), i * 50, 0));
    } else if (pv.music) {
        const b = h('button.small', { text: '▶ Listen', on: { click: () => { TW.audio.unlock(); if (TW.audio.current() === pv.music) { TW.audio.stopMusic(); b.textContent = '▶ Listen'; } else { TW.audio.playMusic(pv.music); b.textContent = '■ Stop'; } } } });
        el.appendChild(b);
        return;
    } else if (pv.skin) {
        const sk = TW.ui.SKINS[pv.skin];
        el.appendChild(h('div.skinprev', { style: { background: 'linear-gradient(' + sk.fill[0] + ',' + sk.fill[1] + ')', borderColor: sk.border, color: sk.text } }, h('b', { text: 'Elder', style: { color: sk.accent } }), h('span', { text: ' Welcome, traveller!' })));
        return;
    } else if (pv.theme) {
        el.appendChild(h('div.themeprev.theme-' + pv.theme, h('i'), h('i'), h('i')));
        return;
    } else if (pv.quill) {
        c.width = 64; c.height = 64;
        const look = Object.assign({}, quillLook(), { [pv.quill]: true });
        drawQuillon(c.getContext('2d'), 64, 0, look);
    }
    c.style.imageRendering = 'pixelated';
    el.appendChild(c);
}
export { RANKS, CHAPTER_NAMES };
