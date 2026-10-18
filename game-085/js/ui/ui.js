// The DOM layer: screens, the HUD, the status strip, the dock and its panels, toasts and the pickers.
// It reads the sim and sends commands through onCommand; it never changes G itself.

import { VERSION, caravanXpFor, RARITY } from '../config.js';
import { TOWN, CLASSES, SLOT_NAME, REGIONS } from '../sim/data.js';
import { speed } from '../sim/world.js';
import { canWear, itemScore, maxHp } from '../sim/party.js';
import { larderCap } from '../sim/economy.js';
import { PANELS, LIVE, journalHtml, itemStats } from './panels.js';
import { MapView } from '../view/map.js';
import { esc, fmtTime, fmtNum, LOG_ICON } from './fmt.js';

const $ = (id) => document.getElementById(id);
const TABS = ['road', 'caravan', 'pack', 'quests', 'map', 'town'];

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onCommand }) {
        this.audio = audio;
        this.settings = settings;
        this.onCommand = onCommand;
        this.stack = [];
        this.tab = 'road';
        this.sig = null;
        this.mapSel = null;
        this.mapView = null;
        this.journalLen = -1;
        this.liveT = 0;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it lifts.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), fights = $('set-fights');
        sfx.value = settings.sfx; music.value = settings.music; fights.value = settings.fights;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, fights: fights.value }); onSettings(settings); };
        for (const el of [sfx, music, fights]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved caravan deleted.'); });

        for (const t of document.querySelectorAll('#tabs .tab')) t.addEventListener('click', () => { audio.ui('click'); this.setTab(t.dataset.tab); });
        const panel = $('panel');
        panel.addEventListener('click', (e) => this.panelClick(e));
        panel.addEventListener('change', (e) => {
            const el = e.target;
            if (el.dataset.act === 'toggle') this.cmd({ type: 'orders', key: el.dataset.k, value: el.checked });
        });
        $('pick').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-pick]');
            if (!b) return;
            const c = JSON.parse(b.dataset.pick);
            this.closeScreen('pick');
            this.cmd(c);
        });
        $('letter-ok').addEventListener('click', () => { audio.ui('close'); this.closeScreen('letter'); this.cmd({ type: 'read' }, true); });
        this.layout();
        const onResize = () => this.layout();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    cmd(c, quiet = false) {
        const r = this.onCommand(c);
        if (!quiet && r && r.msg) this.toast(r.msg);
        if (r && !r.ok) this.audio.ui('deny'); else if (!quiet) this.audio.ui('click');
        this.sig = null;
        return r;
    }

    // ------------------------------------------------------------------ layout
    layout() {
        const vv = window.visualViewport;
        const w = Math.round(vv ? vv.width : innerWidth), h = Math.round(vv ? vv.height : innerHeight);
        document.documentElement.style.setProperty('--app-w', w + 'px');
        document.documentElement.style.setProperty('--app-h', h + 'px');
    }

    /** The rectangle the scene may draw in: everything the dock doesn't cover. */
    sceneRect() {
        const vv = window.visualViewport;
        const w = Math.round(vv ? vv.width : innerWidth), h = Math.round(vv ? vv.height : innerHeight);
        const dock = $('dock');
        if (dock.hidden) return { x: 0, y: 0, w, h };
        const r = dock.getBoundingClientRect();
        if (r.top > 20) return { x: 0, y: 0, w, h: Math.round(r.top) };
        return { x: 0, y: 0, w: Math.round(r.left), h };
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.offsetParent !== null); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.top() ? this.buttons(this.top()) : [...document.querySelectorAll('#panel button, #tabs button')].filter((b) => !b.disabled && b.offsetParent !== null);
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
        document.activeElement.scrollIntoView?.({ block: 'nearest' });
    }

    showPlay(on) {
        $('hud').hidden = !on;
        $('dock').hidden = !on;
        this.sig = null;
    }

    setTab(t) {
        if (!TABS.includes(t)) return;
        this.tab = t;
        for (const b of document.querySelectorAll('#tabs .tab')) b.classList.toggle('on', b.dataset.tab === t);
        this.sig = null;
        $('panel').scrollTop = 0;
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 3000);
    }

    // ------------------------------------------------------------------ the panel
    panelClick(e) {
        const b = e.target.closest('button[data-act]');
        if (!b || b.disabled) return;
        const d = b.dataset, a = d.act;
        switch (a) {
            case 'route': return this.cmd({ type: 'orders', key: 'route', value: d.v }, true);
            case 'campAt': return this.cmd({ type: 'orders', key: 'camp', value: +d.v }, true);
            case 'clearCourse': return this.cmd({ type: 'clearCourse' }, true);
            case 'rest': return this.cmd({ type: 'rest' });
            case 'acceptOffer': case 'declineOffer': case 'dismiss': case 'cartUp': return this.cmd({ type: a, id: +d.id });
            case 'upgrade': return this.cmd({ type: 'upgrade', key: d.k });
            case 'buy': case 'sell': return this.cmd({ type: a, good: d.g, n: +d.n });
            case 'rations': return this.cmd({ type: 'rations' });
            case 'hire': return this.cmd({ type: 'hire', idx: +d.idx });
            case 'accept': case 'abandon': return this.cmd({ type: a, id: +d.id });
            case 'challenge': return this.cmd({ type: 'challenge' });
            case 'odds': return this.cmd({ type: 'odds' }, true);
            case 'claimPost': return this.cmd({ type: 'claimPost' });
            case 'equipBest': case 'sellJunk': return this.cmd({ type: a });
            case 'sellItem': return this.cmd({ type: 'sellItem', item: +d.item });
            case 'course': this.mapSel = null; return this.cmd({ type: 'course', town: d.town });
            case 'give': return this.pickWearer(+d.item);
            case 'slot': return this.pickForSlot(+d.id, d.slot);
        }
    }

    pickWearer(itemId) {
        const G = this.G, it = G.pack.find((x) => x.id === itemId);
        if (!it) return;
        $('pick-title').textContent = `Give the ${it.name} to…`;
        $('pick-body').innerHTML = G.party.map((m) => {
            const cur = m.gear[it.slot], gain = itemScore(it) - itemScore(cur), ok = canWear(m, it);
            return `<button class="btn" style="width:100%;margin-bottom:6px;text-align:left" data-pick='${JSON.stringify({ type: 'equip', item: it.id, member: m.id })}'${ok ? '' : ' disabled'}>
                ${CLASSES[m.cls].icon} <b>${esc(m.name)}</b> <span class="dim">${CLASSES[m.cls].name} ${m.level}</span><br><span class="tiny">now: ${cur ? esc(cur.name) + ' ' + itemStats(cur) : 'nothing'} · ${ok ? (gain >= 0 ? '<span class="cheap">better</span>' : '<span class="dear">worse</span>') : `needs level ${it.ilvl - 2}`}</span></button>`;
        }).join('');
        this.openScreen('pick');
    }

    pickForSlot(memberId, slot) {
        const G = this.G, m = G.party.find((x) => x.id === memberId);
        if (!m) return;
        const cur = m.gear[slot];
        const items = G.pack.filter((it) => it.slot === slot).sort((a, b) => itemScore(b) - itemScore(a));
        $('pick-title').textContent = `${m.name}: ${SLOT_NAME[slot].toLowerCase()}`;
        $('pick-body').innerHTML = (cur ? `<p class="small">Wearing <b class="rar${cur.rarity}">${esc(cur.name)}</b> ${itemStats(cur)}</p><button class="btn" style="width:100%;margin-bottom:10px" data-pick='${JSON.stringify({ type: 'unequip', member: m.id, slot })}'>Take it off</button>` : '<p class="dim">Nothing worn.</p>')
            + (items.length ? items.map((it) => `<button class="btn" style="width:100%;margin-bottom:6px;text-align:left" data-pick='${JSON.stringify({ type: 'equip', item: it.id, member: m.id })}'${canWear(m, it) ? '' : ' disabled'}><b class="rar${it.rarity}">${esc(it.name)}</b><br><span class="tiny">${itemStats(it)} · ${canWear(m, it) ? (itemScore(it) >= itemScore(cur) ? 'better' : 'worse') : `needs level ${it.ilvl - 2}`}</span></button>`).join('') : '<p class="dim">Nothing in the pack for this slot.</p>');
        this.openScreen('pick');
    }

    // ------------------------------------------------------------------ per frame
    update(G, time) {
        this.G = G;
        $('tabs').querySelector('[data-tab="town"]').disabled = false;
        const P = PANELS[this.tab];
        const sig = this.tab + '#' + P.sig(G, this);
        const panel = $('panel');
        if (sig !== this.sig) {
            this.sig = sig;
            const st = panel.scrollTop;
            panel.innerHTML = P.html(G, this);
            panel.scrollTop = st;
            this.journalLen = -1;
            this.liveEls = {
                t: [...panel.querySelectorAll('[data-t]')],
                w: [...panel.querySelectorAll('[data-w]')],
                gold: [...panel.querySelectorAll('[data-gold]')],
                html: [...panel.querySelectorAll('[data-html]')],
            };
            if (this.tab === 'map') {
                const c = $('map');
                this.mapView = new MapView(c);
                this.mapView.sel = this.mapSel;
                c.addEventListener('click', (e) => {
                    const t = this.mapView.townAt(e.clientX, e.clientY);
                    if (t) { this.mapSel = t; this.audio.ui('click'); }
                });
            } else this.mapView = null;
            this.liveT = 0;
        }
        if (this.mapView) { this.mapView.sel = this.mapSel; this.mapView.draw(G, time); }
        // live values, four times a second
        if (time - this.liveT > 0.25) {
            this.liveT = time;
            const call = (spec) => { const [k, arg] = spec.split(':'); return LIVE[k] ? LIVE[k](G, arg) : ''; };
            for (const el of this.liveEls.t) { const v = String(call(el.dataset.t)); if (el.textContent !== v) el.textContent = v; }
            for (const el of this.liveEls.w) el.style.width = `${Math.round(Math.max(0, Math.min(1, call(el.dataset.w))) * 100)}%`;
            for (const el of this.liveEls.gold) {
                if (el.hasAttribute('data-fixed')) continue;
                let ok = G.gold >= +el.dataset.gold;
                if (ok && el.dataset.need) { const need = JSON.parse(el.dataset.need); for (const k in need) if (G.mats[k] < need[k]) ok = false; }
                const capped = el.textContent.startsWith('Caravan level') || el.textContent.startsWith('No room');
                el.disabled = !ok || capped;
            }
            for (const el of this.liveEls.html) if (el.dataset.html === 'journal' && G.log.length + G.log[G.log.length - 1]?.t !== this.journalLen) {
                this.journalLen = G.log.length + G.log[G.log.length - 1]?.t;
                el.innerHTML = journalHtml(G);
            }
            this.hud(G);
            this.status(G);
        }
    }

    hud(G) {
        $('hud-gold').querySelector('b').textContent = fmtNum(G.gold);
        $('hud-food').querySelector('b').textContent = G.rations;
        $('hud-food').style.color = G.rations <= 0 ? 'var(--bad)' : G.rations < larderCap(G) * 0.2 ? '#ffb070' : '';
        $('hud-level').querySelector('b').textContent = G.level;
        $('hud-level').querySelector('.xpbar i').style.width = `${Math.round((G.xp / caravanXpFor(G.level)) * 100)}%`;
        const bq = $('badge-quests'), post = !G.daily.claimed && G.daily.day >= 0;
        bq.hidden = !post; bq.textContent = '1';
        const bt = $('badge-town');
        bt.hidden = !G.at || this.tab === 'town';
        bt.textContent = '•';
    }

    status(G) {
        let where, sub, k = 0;
        if (G.at) {
            const T = TOWN[G.at];
            where = `In ${T.name}`;
            sub = G.orders.route === 'hold' && !G.course ? 'Holding in town (standing orders).' : G.dwell > 0 ? `Trading and resting · leaving in ${fmtTime(G.dwell)}` : 'Deciding where to go…';
            k = 1;
        } else if (G.road) {
            const r = G.road, left = r.miles - r.done;
            where = `${TOWN[r.from].name} → ${TOWN[r.to].name}`;
            if (G.busyKind === 'battle') sub = '⚔️ Fighting on the road!';
            else if (G.busyKind === 'wheel') sub = '🔧 Mending a wheel…';
            else if (G.camp) sub = '🔥 Camped by the road while the party recovers.';
            else sub = `${Math.round(left)} mi to go · about ${fmtTime(left / speed(G))}${G.course && G.course !== r.to ? ` · course: ${TOWN[G.course].name}` : ''}`;
            k = r.done / r.miles;
        } else { where = 'The Wanderwain'; sub = ''; }
        $('status-where').textContent = where;
        $('status-sub').textContent = sub;
        $('status-bar').firstElementChild.style.width = `${Math.round(k * 100)}%`;
        const rb = $('btn-rally');
        const cd = G.buffs.rallyCd - G.t;
        rb.disabled = !!G.at || !G.road || G.camp || G.busy > 0 || cd > 0;
        rb.textContent = G.buffs.rally > G.t ? 'Hup!' : cd > 0 && G.road && !G.at ? `${cd}s` : 'Rally!';
    }

    // ------------------------------------------------------------------ events and special sheets
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'levelup') this.toast(`⭐ The caravan reached level ${e.level}!${e.slot ? ' Room for another traveller.' : ''}`);
            else if (e.type === 'quest') this.toast(`📜 ${e.title}: +${e.gold}g`);
            else if (e.type === 'recruit') { /* the command's own toast says it */ }
            else if (e.type === 'rareLoot') this.toast(`✨ ${RARITY[e.rarity].name}: ${e.name}`);
            else if (e.type === 'warden') this.toast(e.won ? '🔥 The Waystone burns again!' : '💀 The Warden was too strong.');
            else if (e.type === 'newDay') this.toast('📬 The morning post has arrived.');
            else if (e.type === 'hungry') this.toast('⚠️ Out of rations! The caravan slows.');
            else if (e.type === 'region') this.toast(`🏮 Into ${REGIONS[e.region].name}`);
            else if (e.type === 'event' && e.kind === 'wanderer') this.toast(`🤝 ${e.name} asks to join (Caravan tab)`);
        }
    }

    showLetter(letter) {
        $('letter-title').textContent = letter.title;
        $('letter-text').textContent = letter.text;
        this.openScreen('letter');
    }

    showAway(c, cappedAt) {
        const h = c.secs;
        $('away-title').textContent = `While you were away · ${fmtTime(h)}`;
        const cells = [
            ['Miles', fmtNum(c.miles)], ['Towns', c.towns], ['Fights won', `${c.won}${c.lost ? ` <span class="tiny">(${c.lost} lost)</span>` : ''}`],
            ['Gold', `${c.goldNet >= 0 ? '+' : ''}${fmtNum(c.goldNet)}`], ['Quests', c.quests], ['Gear found', c.items],
        ];
        if (c.crafted) cells.push(['Forged', c.crafted]);
        if (c.cooked) cells.push(['Rations cooked', c.cooked]);
        if (c.brewed) cells.push(['Potions', c.brewed]);
        if (c.levels) cells.push(['Caravan levels', `+${c.levels}`]);
        $('away-body').innerHTML = `${cappedAt ? `<p class="dim small">The Great Lantern burns for ${fmtTime(cappedAt)} away; after that the caravan made camp and waited for you.</p>` : ''}
            <div class="stat-grid">${cells.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('')}</div>
            ${c.levelUps.length ? `<p class="small">⭐ ${c.levelUps.map(esc).join(' · ')}</p>` : ''}
            <ul class="log">${c.highlights.slice().reverse().map((e) => `<li class="hi"><span>${LOG_ICON[e.k] || '•'}</span><span>${esc(e.s)}</span></li>`).join('') || '<li class="dim">A quiet stretch of road.</li>'}</ul>`;
        this.openScreen('away');
    }
}

export { maxHp };
