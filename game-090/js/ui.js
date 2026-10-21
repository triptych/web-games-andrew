// The DOM layer: screens, banners, the hub bar, the reward and ending cards, and the controllers
// for dialogue, the field HUD, the battle HUD and the station's panels. Reads the sim; never
// changes it except by acting through doAct.

import { VERSION } from './config.js';
import { h, $, clear, bar, portraitImg, skillTag, skillCost } from './ui/dom.js';
import { Dialogue } from './ui/dialogue.js';
import { BattleHud } from './ui/battlehud.js';
import { FieldHud } from './ui/field.js';
import { Panels } from './ui/panels.js';
import { SKILLS } from './sim/data/skills.js';
import { ITEMS, GEAR } from './sim/data/items.js';
import { DAEMONS } from './sim/data/daemons.js';
import { ENDINGS, CHARS, BONDERS } from './sim/data/story.js';
import { AGENT_LOOKS } from './view/humans.js';
import { TIDES, tideOf } from './config.js';
import { calc } from './sim/units.js';

export class UI {
    constructor({ audio, settings, view, input, act, onSettings, onDeleteSave }) {
        this.audio = audio; this.settings = settings; this.view = view; this.input = input;
        this.act = act;
        this.G = null;
        this.stack = [];
        this.touchOn = false;
        this.hudMode = null;
        this.newLook = 0; this.newDiff = 1;
        $('version').textContent = 'v' + VERSION;

        this.vn = new Dialogue(this);
        this.battle = new BattleHud(this);
        this.field = new FieldHud(this);
        this.panels = new Panels(this);
        view.battle.onPop = (id, text, kind) => this.pop(id, text, kind);

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        // settings
        const S = settings;
        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), quality = $('set-quality'), bspeed = $('set-bspeed'), calm = $('set-calm');
        sfx.value = S.sfx; music.value = S.music; touch.value = S.touch; quality.value = String(S.quality); bspeed.value = String(S.bspeed); calm.checked = !!S.calm;
        const changed = () => {
            Object.assign(S, { sfx: +sfx.value, music: +music.value, touch: touch.value, quality: +quality.value, bspeed: +bspeed.value, calm: calm.checked });
            onSettings(S);
        };
        for (const el of [sfx, music, touch, quality, bspeed, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // new game
        const looks = $('looks');
        AGENT_LOOKS.forEach((_, i) => looks.append(h('button.lk' + (i === 0 ? '.on' : ''), { 'aria-label': 'Look ' + (i + 1), onclick: () => { this.newLook = i; [...looks.children].forEach((c, j) => c.classList.toggle('on', j === i)); } })));
        for (const b of $('diff').querySelectorAll('button')) b.addEventListener('click', () => { this.newDiff = +b.dataset.d; [...$('diff').children].forEach((c) => c.classList.toggle('on', c === b)); });
    }

    paintLooks() {
        const looks = $('looks');
        [...looks.children].forEach((b, i) => { if (!b.firstChild) { const img = portraitImg(`look:${i}`, () => this.view.portraits.person('agent', 'smile', i), 'pf'); b.append(img); img.style.cssText = 'width:100%;height:100%;object-fit:cover'; } });
    }

    // ------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        // a screen opened from another sits on top of it
        el.style.zIndex = String(50 + this.stack.length + 1);
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        for (const s of this.stack.slice(0, -1)) $(s).classList.add('under');
        this.focusFirst(id);
    }
    closeScreen(id) {
        const el = $(id);
        el.hidden = true; el.classList.remove('under'); el.style.zIndex = '';
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'panel') this.panels.cur = null;
        if (this.top()) { $(this.top()).classList.remove('under'); this.focusFirst(this.top()); }
    }
    closeTop() { const t = this.top(); if (t) this.closeScreen(t); if (t === 'panel' && this.G.phase === 'hub') this.view.hub.preset('overview'); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input, .item[tabindex]')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length > 0); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir, root = null) {
        const list = root ? this.buttons(root) : this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------ small things
    toast(text) {
        const el = h('div.toast', { text });
        $('toasts').append(el);
        setTimeout(() => el.remove(), 2700);
    }
    banner(text, sub = '') {
        const el = $('banner');
        el.hidden = false;
        el.replaceChildren(text, ...(sub ? [h('small', { text: sub })] : []));
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
        clearTimeout(this._bt);
        this._bt = setTimeout(() => { el.hidden = true; }, 1450);
    }
    splash(text, sub = '') {
        const el = $('splash');
        el.hidden = false;
        el.replaceChildren(h('div.big', text, h('small', { text: sub })));
        el.firstChild.style.animation = 'none'; void el.offsetWidth; el.firstChild.style.animation = '';
        clearTimeout(this._st);
        this._st = setTimeout(() => { el.hidden = true; }, 1650);
    }
    pop(id, text, kind) {
        const st = this.view.stage;
        const p = this.view.battle.project(id, st.w, st.h, 0.9);
        if (!p) return;
        const el = h('div.num.' + kind, { text, style: `left:${p.x + (Math.random() - 0.5) * 36}px;top:${p.y + (Math.random() - 0.5) * 20}px` });
        $('fx').append(el);
        setTimeout(() => el.remove(), 1050);
    }

    // ------------------------------------------------------------ acting
    doAct(a) {
        const err = this.act(a);
        if (err) { this.toast(err[0].toUpperCase() + err.slice(1) + '.'); this.audio.ui('error'); }
        return err;
    }
    deploy(zone) { this.act({ type: 'deploy', zone }); }
    splice(a, b, keep, done) {
        const err = this.doAct({ type: 'splice', a, b, keep });
        if (!err) done?.();
    }
    save() { this.onSave?.(); }
    quit() { this.onQuit?.(); }

    // ------------------------------------------------------------ the HUD for each phase
    showHud(mode) {
        this.hudMode = mode;
        $('hud-field').hidden = mode !== 'field';
        $('hud-battle').hidden = mode !== 'battle';
        $('hub-bar').hidden = mode !== 'hub';
        if (mode !== 'battle') { this.battle.hideCmd(); this.battle.hideRecode(); }
        if (mode !== 'scene') this.vn.hide();
        this.setTouch(this.touchOn);
    }
    setTouch(on) {
        this.touchOn = on;
        $('touch').hidden = !(on && this.hudMode === 'field');
    }

    refreshHub(G) {
        const t = tideOf(G.day);
        $('hub-day').textContent = `Day ${G.day}`;
        $('hub-tide').textContent = TIDES[t].name;
        const phase = [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25][t];
        const moon = $('hub-moon');
        moon.style.setProperty('--shade', `${(1 - phase) * (t < 4 ? -1 : 1) * 18}px`);
        $('hub-scrap').textContent = G.scrap;
        const nav = $('hub-nav');
        const key = `${G.chapter}:${Object.values(G.bonds).join('')}`;
        if (nav.dataset.key !== key) {
            nav.dataset.key = key;
            clear(nav);
            const mk = (id, label, sub, fn) => nav.append(h('button.cbtn', { onclick: () => { this.audio.ui('open'); fn(); } }, h('span', { text: label }), h('small', { text: sub })));
            mk('brief', 'Briefing', 'deploy', () => this.panels.open_('briefing'));
            mk('green', 'Greenhouse', 'splice', () => this.panels.open_('greenhouse'));
            mk('market', 'Market', 'shop', () => this.panels.open_('market'));
            mk('lounge', 'Lounge', 'bonds', () => this.panels.open_('lounge'));
            mk('rest', 'Infirmary', 'rest', () => this.panels.open_('rest'));
            mk('menu', 'Menu', 'party', () => this.panels.open_('menu'));
        }
    }

    // ------------------------------------------------------------ presenting the sim's state
    /** Called whenever nothing is animating. Cheap and idempotent. */
    present(G) {
        this.G = G;
        switch (G.phase) {
            case 'scene': this.vn.show(G); break;
            case 'hub': this.refreshHub(G); break;
            case 'explore': this.field.refresh(G); this.field.hint(G); this.exploreMenu(G); break;
            case 'battle': this.battle.present(G); break;
            case 'reward': this.rewardCard(G); break;
            case 'defeat': this.defeatCard(G); break;
            case 'credits': this.creditsCard(G); break;
        }
    }

    exploreMenu(G) {
        const X = G.explore;
        if (!X) return;
        const key = X.menu ? `${X.menu}:${X.cur}` : '';
        if (key === this._menuKey) return;
        this._menuKey = key;
        if (!X.menu) { if (this.top() === 'modal' && this._fieldModal) this.closeScreen('modal'); this._fieldModal = false; return; }
        const rec = X.floors[X.cur];
        const m = clear($('modal-sheet'));
        this._fieldModal = true;
        if (X.menu === 'anchor') {
            const used = rec.anchorUsed;
            m.append(h('h2', { text: 'Sprout' }), h('p', { text: used ? 'The Sprout has given what it can on this floor. You can still save and leave.' : 'A Sprout node: a sapling wired into the old grid. Rest beneath it and your whole party recovers.' }));
            m.append(h('div.sheet-foot',
                h('button.btn', { text: 'Leave the zone', onclick: () => { this.closeScreen('modal'); this.doAct({ type: 'leaveZone' }); } }),
                h('button.btn.primary', { text: used ? 'Save & continue' : 'Rest & save', onclick: () => { this.doAct({ type: 'anchor' }); this.onSave?.(); this.closeScreen('modal'); this.doAct({ type: 'closeMenu' }); this.toast(used ? 'Saved.' : 'Rested and saved.'); } })));
        } else {
            const clear_ = rec.bossDone || !rec.fl.boss;
            m.append(h('h2', { text: clear_ && X.cur === ZONE_FLOORS(X) ? 'Portal home' : 'Gate' }), h('p', { text: 'Leave the zone and return to Arbor Station? Floors reset the next time you deploy; the day ends.' }));
            m.append(h('div.sheet-foot', h('button.btn', { text: 'Stay', onclick: () => { this.closeScreen('modal'); this.doAct({ type: 'closeMenu' }); } }), h('button.btn.primary', { text: 'Return to the station', onclick: () => { this.closeScreen('modal'); this.doAct({ type: 'leaveZone' }); } })));
        }
        this.openScreen('modal');
    }

    battleEnd(e) {
        if (e.result === 'win') this.banner('VICTORY', e.kind === 'normal' ? '' : 'the signal is quiet');
        else if (e.result === 'lose') this.banner('DEFEAT', 'the lattice goes dark');
    }

    // ------------------------------------------------------------ reward
    rewardCard(G) {
        const r = G.reward;
        if (!r) return;
        const key = `${G.pendingLearn.length}:${r.xp}:${r.scrap}`;
        if (this._rewardKey === key && !$('reward').hidden) return;
        this._rewardKey = key;
        const sh = clear($('reward-sheet'));
        sh.classList.add('reward');
        sh.append(h('h2', { text: r.kind === 'normal' ? 'Victory' : 'The signal falls quiet' }));
        sh.append(h('div', { style: 'display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px' }, h('div', { html: `<span class="scrap-ic"></span> <b style="color:var(--gold);font-size:22px">+${r.scrap}</b> Scrap` }), h('div', { html: `<b style="color:var(--accent);font-size:22px">+${r.xp}</b> XP` }), ...Object.entries(r.items).map(([id, n]) => h('div', { text: `${ITEMS[id].name} ×${n}` }))));
        for (const g of r.gained) sh.append(h('div.rw-row', portraitImg(`pc:${g.sp}`, () => this.view.portraits.daemon(g.sp, 80, 100)), h('div', h('div', { text: `${g.name} joined you!`, style: 'color:var(--accent);font-weight:700;letter-spacing:0.08em' }), h('div.s', { text: `Lv ${g.lv} · recoded` })), h('div.lvup', { text: 'NEW' })));
        for (const u of r.units) {
            const learned = u.learned.filter((l) => l.learned).map((l) => SKILLS[l.skill].name);
            sh.append(h('div.rw-row', u.sp === 'agent' ? portraitImg(`pc:agent:${G.look || 0}`, () => this.view.portraits.person('agent', 'neutral', G.look || 0)) : portraitImg(`pc:${u.sp}`, () => this.view.portraits.daemon(u.sp, 80, 100)), h('div', h('div', { text: u.name, style: 'font-weight:700' }), h('div.s', { text: learned.length ? 'Learned ' + learned.join(', ') : '', style: 'color:var(--dim);font-size:12px' })), h('div', { style: 'text-align:right' }, h('div', { text: `+${u.xp} XP` }), u.to > u.from ? h('div.lvup', { text: `LEVEL UP  ${u.from} → ${u.to}` }) : null)));
        }
        if (G.pendingLearn.length) {
            const p = G.pendingLearn[0];
            const u = [G.agent, ...G.stock].find((x) => x.uid === p.uid);
            const sk = SKILLS[p.skill];
            const box = h('div.detail', { style: 'margin-top:10px' }, h('h4', { text: `${u.name} can learn ${sk.name}` }), h('p', { text: sk.desc }), h('div.s', { text: 'Forget which skill?' }));
            const list = h('div', { style: 'display:grid;gap:4px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-top:6px' });
            u.skills.forEach((id, i) => list.append(h('button.btn.mini', { onclick: () => { this.audio.ui('click'); this.doAct({ type: 'learn', replace: i }); this._rewardKey = ''; } }, h('span', { text: SKILLS[id].name }))));
            box.append(list, h('div.sheet-foot', h('button.btn.mini', { text: `Don't learn it`, onclick: () => { this.doAct({ type: 'learn', skip: true }); this._rewardKey = ''; } })));
            sh.append(box);
        } else sh.append(h('div.sheet-foot', h('button.btn.primary', { text: 'Continue', onclick: () => { this.audio.ui('click'); this.closeScreen('reward'); this.doAct({ type: 'claim' }); this._rewardKey = ''; } })));
        this.openScreen('reward');
    }

    defeatCard(G) {
        if (!$('modal').hidden && this._defeat) return;
        const m = clear($('modal-sheet'));
        this._defeat = true;
        m.append(h('h2', { text: 'Defeat' }), h('p', { text: 'The Agent goes down, and Wren pulls the Beacon. You wake in the infirmary, a little poorer and a lot wiser. A fifth of your Scrap is gone.' }), h('div.sheet-foot', h('button.btn.primary', { text: 'Wake up', onclick: () => { this._defeat = false; this.closeScreen('modal'); this.doAct({ type: 'ack' }); } })));
        this.openScreen('modal');
    }

    creditsCard(G) {
        if (!$('credits').hidden) return;
        const E = ENDINGS[G.ending] || ENDINGS.graft;
        const sh = clear($('credits-sheet'));
        sh.append(h('div', { text: 'ENDING', style: 'letter-spacing:0.4em;color:var(--accent);font-size:12px' }), h('h2', { text: E.title }), h('p', { text: E.sub }),
            h('div.cur', h('div', { text: 'Days' }, h('b', { text: G.day })), h('div', { text: 'Level' }, h('b', { text: G.agent.lv })), h('div', { text: 'Daemons' }, h('b', { text: Object.values(G.dex).filter((d) => d.recoded > 0).length })), h('div', { text: 'Bonds' }, h('b', { text: Object.values(G.bonds).reduce((a, b) => a + b, 0) }))),
            h('div.cur', ...[['hearth', 'Hearth'], ['wild', 'Wild'], ['graft', 'Graft']].map(([k, n]) => h('div', { text: n }, h('b', { text: G.currents[k] })))),
            h('p', { text: 'Verdant Protocol: made in code, with no image or audio files. Thank you for playing. The world is healing, and so, a little, are you.', style: 'margin-top:14px' }),
            h('div.sheet-foot', h('button.btn', { text: 'Back to the title', onclick: () => { this.closeScreen('credits'); this.onQuit?.(true); } }), h('button.btn.primary', { text: 'Keep playing', onclick: () => { this.closeScreen('credits'); this.doAct({ type: 'credits_done' }); } })));
        this.openScreen('credits');
    }
}
const ZONE_FLOORS = (X) => ({ underpass: 2, galleria: 2, orchard: 2, cathedral: 2, skyrail: 2, spire: 3, rift: 2 }[X.zone] ?? 2);
