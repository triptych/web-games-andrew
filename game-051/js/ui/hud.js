/**
 * hud.js — the top resource bar and the bottom tab bar (with badges).
 */

import { $, $$, icon, num } from './dom.js';
import { G } from '../game.js';
import { maxStamina, olXpToNext } from '../sim/overlord.js';
import { staminaNext } from '../sim/idle.js';
import { questBadges } from '../sim/quests.js';
import { codexClaimable } from '../sim/codex.js';
import { dur } from '../core/fmt.js';
import { requestPortrait, portraitSrc } from './portraits.js';
import { goTab, go } from './app.js';
import { modal, h } from './dom.js';

let wired = false;
let lastLook = null;

function wire() {
    wired = true;
    const ICON = { citadel: 'citadel', heroes: 'heroes', summon: 'summon', adventure: 'adventure', quests: 'quests' };
    for (const t of $$('#tabbar .tab')) {
        t.querySelector('.tab-ico').innerHTML = icon(ICON[t.dataset.tab]);
        t.addEventListener('click', () => goTab(t.dataset.tab));
    }
    $('#tb-overlord').addEventListener('click', () => go('overlord'));
    $('#tb-gems').addEventListener('click', () => go('market', { tab: 'gems' }));
    $('#tb-gold').addEventListener('click', () => go('market'));
    $('#tb-stamina').addEventListener('click', () => {
        const S = G.S;
        const next = staminaNext(S);
        modal({ title: 'Stamina', body: h('div', h('p', { html: `${icon('stamina')} <b>${S.res.stamina} / ${maxStamina(S)}</b>` }), h('p.muted', `Campaign stages and Rifts cost stamina. It refills by 1 every 2 minutes${next > 0 ? ` (next in ${dur(next)})` : ''}, and fully on every Overlord level-up. The Spire and Arena are free.`)), buttons: [{ label: 'Buy +60 for 30 gems', cls: 'gold', onClick: () => { go('market', { tab: 'gems' }); } }, { label: 'OK', cls: 'ghost' }] });
    });
}

export function showChrome(mode) {
    if (!wired) wire();
    const full = mode === 'full' || mode === 'none';
    $('#topbar').hidden = mode === 'none' || mode === 'notop';
    $('#tabbar').hidden = full || mode === 'notab';
    document.body.classList.toggle('ingame', mode !== 'title');
    if (mode === 'title') { $('#topbar').hidden = true; $('#tabbar').hidden = true; }
}

export function setTab(tab) {
    for (const t of $$('#tabbar .tab')) t.classList.toggle('on', t.dataset.tab === tab);
}

export function updateHud() {
    const S = G.S;
    if (!S || $('#topbar').hidden) return;
    $('#tb-gold').innerHTML = `${icon('gold')}${num(S.res.gold)}`;
    $('#tb-gems').innerHTML = `${icon('gem')}${num(S.res.gems)}`;
    $('#tb-stamina').innerHTML = `${icon('stamina')}${S.res.stamina}<small>/${maxStamina(S)}</small>`;
    $('#tb-name').textContent = S.overlord.name;
    $('#tb-level').textContent = S.overlord.level;
    $('#tb-xpfill').style.width = Math.min(100, (S.overlord.xp / olXpToNext(S.overlord.level)) * 100) + '%';
    if (S.overlord.look && lastLook !== S.overlord.look) {
        lastLook = S.overlord.look;
        const who = { seed: 77, look: S.overlord.look };
        const src = portraitSrc(who);
        if (src) $('#tb-portrait').src = src;
        else requestPortrait(who, (u) => { $('#tb-portrait').src = u; });
    }
    // badges
    const setBadge = (tab, n) => {
        const b = $(`#tabbar .tab[data-tab="${tab}"] .badge`);
        b.hidden = !n;
        b.textContent = n > 9 ? '9+' : n;
    };
    setBadge('quests', questBadges(S));
    const sig = S.res.sigils;
    setBadge('summon', (sig.mystic || 0) + (sig.common || 0) + (sig.legend || 0) + (sig.ld || 0) + (sig.fire || 0) + (sig.water || 0) + (sig.wind || 0));
    setBadge('heroes', S.heroes.filter((x) => x.isNew).length + Math.max(0, codexClaimable(S)));
}

export function invalidateOverlordPortrait() { lastLook = null; }
