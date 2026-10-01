/**
 * citadel.js — the hub screen: tappable buildings with live status labels,
 * the main-quest tracker, active buffs, and the "while you were away" summary.
 */

import * as THREE from 'three';
import { h, app, $, icon, btn, modal, rewardGrid, showRewards, toast, num } from '../dom.js';
import { G, changed } from '../../game.js';
import { go } from '../app.js';
import { peekStage } from '../stages.js';
import { toScreen } from '../../view/engine.js';
import { gestures, canvasEl } from '../input.js';
import { BUILDING_SPOTS } from '../../view/citadel.js';
import { treasuryPending, treasuryCapHours, activeBuffs, trainingSlots } from '../../sim/idle.js';
import { maxEnergy } from '../../sim/mine.js';
import { mainQuest, claimMain } from '../../sim/quests.js';
import { freeSpinAvailable } from '../../sim/shop.js';
import { now, HOUR } from '../../core/time.js';
import { dur } from '../../core/fmt.js';
import { BUFFS } from '../../data/items.js';
import { playMusic, sfx } from '../../audio.js';
import { showIntro } from './title.js';
import { loginStatus, claimLogin, LOGIN_REWARDS } from '../../sim/codex.js';
import { describeReward } from './quests.js';

let labels = {}, detach = null, root0 = null, labelHost = null;
const _v = new THREE.Vector3();

function status(id) {
    const S = G.S, t = now();
    switch (id) {
        case 'treasury': { const p = treasuryPending(S, t); return p.full ? { text: 'Full! Collect', ready: true } : p.mins >= 60 ? { text: `${num(p.gold)} gold`, ready: p.mins >= 120 } : { text: `${Math.floor(p.mins)}m stored` }; }
        case 'farm': { const ready = S.farm.plots.filter((p) => p.crop && t >= p.readyAt).length; const empty = S.farm.plots.filter((p) => !p.crop).length; return ready ? { text: `${ready} ready!`, ready: true } : empty ? { text: `${empty} empty plot${empty > 1 ? 's' : ''}` } : { text: 'Growing…' }; }
        case 'mine': return S.mine.energy >= maxEnergy(S) ? { text: `Pick ${S.mine.energy}/${maxEnergy(S)}`, ready: true } : { text: `Pick ${S.mine.energy}/${maxEnergy(S)}` };
        case 'tavern': { const done = S.expeditions.active.filter((e) => t >= e.endsAt).length; return done ? { text: `${done} returned!`, ready: true } : { text: `${S.expeditions.active.length} out` }; }
        case 'training': return { text: `${S.training.slots.length}/${trainingSlots(S)} training` };
        case 'summoning': { const n = S.res.sigils.mystic + S.res.sigils.legend + S.res.sigils.ld; return n ? { text: `${n} sigil${n > 1 ? 's' : ''}`, ready: true } : { text: 'Summon heroes' }; }
        case 'spire': return { text: `Floor ${S.spire.floor}` };
        case 'arena': return { text: `${S.arena.tickets} tickets` };
        case 'market': return freeSpinAvailable(S) ? { text: 'Free spin!', ready: true } : { text: 'Shop' };
        case 'forge': return { text: `Lv ${S.buildings.forge}` };
        case 'keep': return { text: `Lv ${S.overlord.level}` };
        default: return null;
    }
}

function buildLabels(host) {
    labels = {};
    for (const [id, spot] of Object.entries(BUILDING_SPOTS)) {
        const el = h('div.blabel', { onclick: () => open(id) }, h('div.blabel-name', { html: `${icon(spot.icon)}${spot.label}` }), h('div.blabel-sub'));
        host.append(el);
        labels[id] = el;
    }
    refreshLabels();
}

function refreshLabels() {
    for (const [id, el] of Object.entries(labels)) {
        const s = status(id);
        const sub = el.querySelector('.blabel-sub');
        sub.hidden = !s;
        if (s) { sub.textContent = s.text; sub.classList.toggle('ready', !!s.ready); }
    }
}

function open(id) {
    sfx('click');
    const spot = BUILDING_SPOTS[id];
    go(spot.screen);
}

function questBar(hud) {
    const old = hud.querySelector('.main-quest');
    if (old) old.remove();
    const q = mainQuest(G.S);
    if (!q) return;
    const el = h('div.main-quest', { onclick: () => {
        if (q.done) {
            const got = claimMain(G.S);
            changed('quest');
            showRewards('Quest Complete!', got);
            questBar(hud);
        } else {
            const target = { summon: 'summon', adventure: 'adventure', team: 'adventure', heroes: 'heroes', treasury: 'treasury', farm: 'farm', mine: 'mine', forge: 'forge', market: 'market', spire: 'spire', tavern: 'tavern', kitchen: 'farm', arena: 'arena', rifts: 'adventure', overlord: 'overlord', citadel: 'treasury' }[q.hint];
            if (target) go(target);
        }
    } },
    h('div.mq-ico', { html: icon('quests') }),
    h('div.mq-text', h('div.mq-kicker', `Main Quest ${q.idx + 1}`), h('div.mq-title', q.text)),
    q.done ? btn('Claim', () => {}, 'gold small') : h('div.muted.small', 'Go ›'));
    app(hud, el);
}

function buffRow(hud) {
    const old = hud.querySelector('.buff-row');
    if (old) old.remove();
    const b = activeBuffs(G.S);
    if (!b.length) return;
    app(hud, h('div.buff-row', b.map((x) => h('div.buff-chip', { html: `${icon(BUFFS[x.id].icon)} ${BUFFS[x.id].desc} · <span class="timer">${dur(x.until - now())}</span>` }))));
}

export function loginModal(after) {
    const S = G.S;
    const st = loginStatus(S);
    if (st.claimed) { if (after) after(); return; }
    const row = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '10px' } });
    LOGIN_REWARDS.forEach((r, i) => {
        const done = i < st.idx, today = i === st.idx;
        const d = describeReward(r)[0];
        row.append(h('div', { style: { textAlign: 'center', padding: '6px 2px', borderRadius: '10px', fontSize: '12px', border: `1.5px solid ${today ? 'var(--gold)' : 'var(--line-soft)'}`, background: today ? 'rgba(242,196,90,.15)' : 'rgba(0,0,0,.25)', opacity: done ? 0.45 : 1 } },
            h('div', { style: { fontWeight: 900 } }, `Day ${i + 1}`), h('div', { style: { fontSize: '11px', color: 'var(--muted)' } }, i === 6 ? 'Big!' : done ? 'Got' : '')));
    });
    modal({
        title: `Daily Login · Day ${st.idx + 1}`, dismiss: false,
        body: h('div', row, h('p.muted.small', `Log in every day for a reward; the seventh day is the best, then the week repeats. Streak: ${st.streak} day${st.streak === 1 ? '' : 's'}.`), rewardGrid(describeReward(LOGIN_REWARDS[st.idx]))),
        buttons: [{ label: 'Claim', cls: 'gold', onClick: () => { const got = claimLogin(S); changed('login'); sfx('reward'); if (after) setTimeout(after, 250); } }],
    });
}

function awayModal() {
    const a = G.away;
    G.away = null;
    if (!a) return;
    const lines = [];
    lines.push(h('p', `You were away for ${dur(a.away)}. Your citadel kept working:`));
    const ul = h('div.list');
    app(ul, h('div.card', { html: `${icon('chest')} <b>Treasury:</b> ${num(a.treasury.gold)} gold, ${num(a.treasury.heroXp)} hero XP${a.treasury.full ? ' — <b style="color:var(--gold-2)">full!</b>' : ''}` }));
    if (a.cropsReady) app(ul, h('div.card', { html: `${icon('seed')} <b>Farm:</b> ${a.cropsReady} crop${a.cropsReady > 1 ? 's' : ''} ready to harvest` }));
    if (a.expeditionsDone) app(ul, h('div.card', { html: `${icon('map')} <b>Tavern:</b> ${a.expeditionsDone} expedition${a.expeditionsDone > 1 ? 's' : ''} returned` }));
    if (a.trainees) app(ul, h('div.card', { html: `${icon('sword')} <b>Training:</b> ${a.trainees} hero${a.trainees > 1 ? 'es' : ''} trained while you were gone` }));
    modal({ title: 'While You Were Away', body: h('div', lines, ul), buttons: [{ label: 'Collect Treasury', cls: 'gold', onClick: () => go('treasury') }, { label: 'Later', cls: 'ghost' }] });
}

export const citadelScreen = {
    id: 'citadel',
    tab: 'citadel',
    stage: 'citadel',
    enter(root, params) {
        root0 = root;
        playMusic('citadel');
        const st = peekStage('citadel');
        st.setOverlord(G.S.overlord.look);
        const pick = G.S.heroes.slice().sort((a, b) => b.star - a.star || b.level - a.level).slice(0, 6);
        st.setHeroes(pick.map((x) => x.look));
        st.syncFarm(G.S.farm.plots, now());
        st.applyTime();
        labelHost = h('div.passthrough', { style: { position: 'absolute', inset: '0' } });
        app(root, labelHost);
        buildLabels(labelHost);
        const hud = h('div.citadel-hud');
        app(hud, h('div.side-btns',
            sideBtn('wheel', 'Wheel', () => go('market', { tab: 'wheel' }), freeSpinAvailable(G.S)),
            sideBtn('chest', 'Bag', () => go('bag')),
            sideBtn('hammer', 'Build', () => go('treasury', { tab: 'build' })),
            sideBtn('settings', 'Settings', () => go('settings')),
        ));
        app(root, hud);
        this.hud = hud;
        questBar(hud);
        buffRow(hud);
        detach = gestures(canvasEl(), {
            onDrag: (dx, dy) => st.drag(dx, 0),
            onPinch: (k) => st.zoom(k),
            onTap: (x, y) => { const id = st.pick(x, y); if (id) open(id); },
        });
        if (params.first) showIntro(() => { questBar(hud); loginModal(); });
        else if (params.welcome) setTimeout(() => loginModal(() => { if (G.away) awayModal(); }), 400);
    },
    update() {
        const st = peekStage('citadel');
        if (!st) return;
        for (const [id, el] of Object.entries(labels)) {
            const p = toScreen(st.labelPos(id, _v), st.camera);
            if (!p || p.x < -60 || p.x > innerWidth + 60) { el.style.display = 'none'; continue; }
            el.style.display = '';
            el.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y}px)`;
            el.style.left = '0'; el.style.top = '0';
            el.style.zIndex = String(Math.round((1 - p.z) * 10000));
        }
    },
    tick() {
        refreshLabels();
        const st = peekStage('citadel');
        st.syncFarm(G.S.farm.plots, now());
        if (this.hud) buffRow(this.hud);
    },
    refresh() {
        refreshLabels();
        if (this.hud) questBar(this.hud);
    },
    exit() {
        if (detach) detach();
        detach = null;
        labels = {};
    },
};

function sideBtn(ico, label, fn, badge = false) {
    const b = h('button.side-btn', { type: 'button', onclick: () => { sfx('click'); fn(); } }, h('span', { html: icon(ico) }), label);
    if (badge) b.append(h('span.badge', '!'));
    return b;
}
