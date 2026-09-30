/**
 * ui.js — DOM screens and HUD. Markup lives in index.html; this module
 * fills it in, reads the world each frame (with dirty checks), and wires
 * buttons to the handlers main.js passes in.
 *
 *   initUI(handlers)        { play, endless, talents, back, resume, quit, again, menu, mute, pause, choose, chapter }
 *   showScreen(name)        'title' | 'talents' | 'choice' | 'pause' | 'over' | null
 *   updateHUD(w, dt)        per frame while a run is on screen
 *   showChoice(w)           cards for the open level-up / angel / devil choice
 *   banner(text, sub, cls)  big centre text
 */

import { ABILITIES, CHAPTERS, TALENTS, xpToNext, DEVIL_HP_COST, BOSSES } from './config.js';
import { stageLabel } from './sim/world.js';
import { getBiome } from './view/biomes.js';
import { toScreen } from './view/scene.js';
import { state } from './state.js';

const $ = (id) => document.getElementById(id);
let el, H;
let last = {};
let bossShown = null;

export function initUI(handlers) {
    H = handlers;
    el = {
        hud: $('hud'), lvl: $('lvl'), lvlBadge: $('lvl-badge'), xp: $('xp-fill'), stage: $('stage-label'), coins: $('coin-val'),
        bossBar: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'), bossLag: $('boss-lag'),
        heroHp: $('hero-hp'), heroHpVal: $('hero-hp-val'), heroHpFill: $('hero-hp-fill'), hint: $('hint'),
        banners: $('banners'),
        title: $('title'), talents: $('talents'), choice: $('choice'), pause: $('pause'), over: $('over'),
        chNum: $('ch-num'), chName: $('ch-name'), chInfo: $('ch-info'), chCard: $('ch-card'), chPrev: $('ch-prev'), chNext: $('ch-next'),
        play: $('play-btn'), endless: $('endless-btn'), titleCoins: $('title-coins'),
        talentGrid: $('talent-grid'), talentCoins: $('talent-coins'),
        choiceTitle: $('choice-title'), choiceSub: $('choice-sub'), choiceCards: $('choice-cards'), refuse: $('choice-refuse'),
        pauseStage: $('pause-stage'), pauseAb: $('pause-abilities'),
        overTitle: $('over-title'), overSub: $('over-sub'), overStats: $('over-stats'), overCoins: $('over-coin-val'), overUnlock: $('over-unlock'),
        mute: $('mute-btn'), pauseBtn: $('pause-btn'),
    };
    const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    on('play-btn', () => H.play());
    on('endless-btn', () => H.endless());
    on('talents-btn', () => H.talents());
    on('talents-back', () => H.back());
    on('resume-btn', () => H.resume());
    on('quit-btn', () => H.quit());
    on('again-btn', () => H.again());
    on('menu-btn', () => H.menu());
    on('mute-btn', () => H.mute());
    on('pause-btn', () => H.pause());
    on('choice-refuse', () => H.choose('refuse'));
    on('ch-prev', () => H.chapter(-1));
    on('ch-next', () => H.chapter(1));
}

export function showScreen(name) {
    for (const s of ['title', 'talents', 'choice', 'pause', 'over']) el[s].classList.toggle('hidden', s !== name);
    el.pauseBtn.classList.toggle('hidden', name !== null);
}

export function showHUD(v) { el.hud.classList.toggle('hidden', !v); if (!v) { el.bossBar.classList.add('hidden'); bossShown = null; } }
export function setMuted(m) { el.mute.classList.toggle('off', m); }

// ------------------------------------------------------------------ Title & talents

export function refreshTitle(chapter) {
    const ch = CHAPTERS[chapter - 1];
    const locked = chapter > state.unlocked;
    el.chNum.textContent = `CHAPTER ${chapter}`;
    el.chName.textContent = ch.name;
    const best = state.best[chapter];
    el.chInfo.textContent = locked ? `🔒 Clear chapter ${chapter - 1} to unlock`
        : state.cleared[chapter] ? '✓ Cleared · 12 rooms' : best ? `Best: ${chapter}-${best} of 12` : '12 rooms · boss at the top';
    const b = getBiome(ch.biome);
    el.chCard.style.setProperty('--ch-glow', '#' + b.pColor.toString(16).padStart(6, '0') + '40');
    el.chCard.classList.toggle('locked', locked);
    el.play.disabled = locked;
    el.chPrev.disabled = chapter <= 1;
    el.chNext.disabled = chapter >= CHAPTERS.length;
    el.endless.disabled = !state.endlessUnlocked;
    el.endless.textContent = state.endlessUnlocked ? (state.endlessBest ? `ENDLESS · ${state.endlessBest}` : 'ENDLESS') : '🔒 ENDLESS';
    el.titleCoins.textContent = state.coins;
}

export function refreshTalents() {
    el.talentCoins.textContent = state.coins;
    el.talentGrid.innerHTML = '';
    for (const [id, t] of Object.entries(TALENTS)) {
        const lv = state.talents[id];
        const div = document.createElement('div');
        div.className = 'talent';
        const pips = Array.from({ length: t.max }, (_, i) => `<span class="pip${i < lv ? ' on' : ''}"></span>`).join('');
        const maxed = lv >= t.max;
        const price = state.talentPrice(id);
        div.innerHTML = `<div class="icon">${t.icon}</div><div class="name">${t.name}</div><div class="pips">${pips}</div>
            <div class="desc">${lv ? t.desc(lv) : t.desc(1).replace(/\d+/, '0')}</div>`;
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerHTML = maxed ? 'MAX' : `<span class="coin-ico"></span> ${price}`;
        btn.disabled = maxed || state.coins < price;
        btn.addEventListener('click', (e) => { e.stopPropagation(); H.buy(id); });
        div.appendChild(btn);
        el.talentGrid.appendChild(div);
    }
}

// ------------------------------------------------------------------ Choice

export function showChoice(w) {
    const ch = w.choice;
    const titles = {
        start: ['A BLESSING', 'The spire offers a gift for the climb'],
        level: ['LEVEL UP!', `Level ${w.player.level - w.pendingLevels + 1} · choose an ability`],
        angel: ['THE ANGEL', 'She offers healing, or a gift'],
        devil: ['THE DEVIL', `Power, for ${Math.round(DEVIL_HP_COST * 100)}% of your max HP — forever`],
    };
    const [t, s] = titles[ch.kind];
    el.choiceTitle.textContent = t;
    el.choiceSub.textContent = s;
    el.choiceCards.innerHTML = '';
    for (const id of ch.options) {
        const card = document.createElement('button');
        let icon, name, desc, tier, lv = '';
        if (id === 'heal' && ch.kind === 'angel') {
            icon = '💗'; name = 'Restore'; desc = 'Heal 40% of your max HP.'; tier = 'rare';
        } else {
            const a = ABILITIES[id];
            icon = a.icon; name = a.name; desc = a.desc; tier = a.tier;
            const have = w.player.ab[id] || 0;
            if (id !== 'heal') lv = have ? `OWNED ×${have} → ×${have + 1}` : 'NEW';
        }
        card.className = `card ${tier}`;
        card.innerHTML = `<div class="icon">${icon}</div><div class="txt"><div class="name">${name}</div><div class="desc">${desc}</div>
            ${ch.kind === 'devil' ? `<div class="cost">−${Math.round(DEVIL_HP_COST * 100)}% max HP</div>` : ''}<div class="lv">${lv}</div></div>`;
        card.addEventListener('click', (e) => { e.stopPropagation(); H.choose(id); });
        el.choiceCards.appendChild(card);
    }
    el.refuse.classList.toggle('hidden', ch.kind !== 'devil');
}

// ------------------------------------------------------------------ Pause & over

function abilityChips(w) {
    const out = [];
    for (const [id, n] of Object.entries(w.player.ab)) {
        if (!n) continue;
        const a = ABILITIES[id];
        out.push(`<span class="chip">${a.icon} ${a.name}${n > 1 ? ` <b>×${n}</b>` : ''}</span>`);
    }
    return out.join('') || '<span class="chip">No abilities yet</span>';
}

export function showPause(w) {
    el.pauseStage.textContent = w.endless ? `Endless · room ${w.stageNum} · ${CHAPTERS[w.chapter - 1].name}` : `Chapter ${w.chapter} · ${CHAPTERS[w.chapter - 1].name} · room ${w.stage + 1} of 12`;
    el.pauseAb.innerHTML = abilityChips(w);
}

export function showOver(w, coins, rec) {
    const won = w.result === 'clear';
    el.overTitle.textContent = won ? 'CHAPTER CLEAR!' : 'DEFEATED';
    el.overTitle.style.color = won ? '' : '#ff8a8a';
    el.overSub.textContent = w.endless
        ? `Endless · reached room ${w.stageNum}${rec.newBest ? ' — new record!' : ''}`
        : won ? `${CHAPTERS[w.chapter - 1].name} is yours` : `Fell in room ${stageLabel(w)} of ${CHAPTERS[w.chapter - 1].name}${rec.newBest ? ' — new best!' : ''}`;
    const mins = Math.floor(w.time / 60), secs = Math.floor(w.time % 60);
    el.overStats.innerHTML = [
        `<span class="chip">Level <b>${w.player.level}</b></span>`,
        `<span class="chip">Kills <b>${w.stats.kills}</b></span>`,
        `<span class="chip">Rooms <b>${w.stats.rooms}</b></span>`,
        `<span class="chip">Damage <b>${w.stats.dmgDealt.toLocaleString()}</b></span>`,
        `<span class="chip">Time <b>${mins}:${String(secs).padStart(2, '0')}</b></span>`,
    ].join('') + abilityChips(w);
    el.overCoins.textContent = `+${coins}`;
    el.overUnlock.classList.toggle('hidden', !rec.unlockedChapter);
    if (rec.unlockedChapter) el.overUnlock.textContent = `Chapter ${rec.unlockedChapter} unlocked: ${CHAPTERS[rec.unlockedChapter - 1].name}`;
    if (!rec.unlockedChapter && won && w.chapter === 1 && state.endlessUnlocked) {
        el.overUnlock.classList.remove('hidden');
        el.overUnlock.textContent = 'Endless mode unlocked';
    }
}

// ------------------------------------------------------------------ HUD

export function banner(text, sub = '', cls = '') {
    const d = document.createElement('div');
    d.className = 'banner ' + cls;
    d.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
    el.banners.innerHTML = '';
    el.banners.appendChild(d);
    setTimeout(() => d.remove(), 1700);
}

export function popLevel() {
    el.lvlBadge.classList.remove('pop');
    void el.lvlBadge.offsetWidth;
    el.lvlBadge.classList.add('pop');
}

export function setHint(text) {
    el.hint.classList.toggle('hidden', !text);
    if (text) el.hint.textContent = text;
}

export function updateHUD(w) {
    const p = w.player;
    const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
    set('lvl', p.level, (v) => { el.lvl.textContent = v; });
    set('xp', Math.round(100 * p.xp / xpToNext(p.level)), (v) => { el.xp.style.width = v + '%'; });
    set('stage', stageLabel(w), (v) => { el.stage.textContent = w.endless ? `ROOM ${v}` : v; });
    set('coins', w.coins, (v) => { el.coins.textContent = v; });
    set('hp', Math.ceil(p.hp), (v) => { el.heroHpVal.textContent = v; });
    set('hpf', Math.round(100 * p.hp / p.stat.maxHp), (v) => {
        el.heroHpFill.style.width = v + '%';
        el.heroHp.classList.toggle('low', v < 30);
    });
    const s = toScreen(p.x, p.y, 1.55);
    el.heroHp.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    el.heroHp.style.display = w.phase === 'exit' ? 'none' : '';

    // Boss bar.
    const boss = w.boss && w.boss.alive ? w.boss : null;
    if (boss !== bossShown) {
        bossShown = boss;
        el.bossBar.classList.toggle('hidden', !boss);
        if (boss) el.bossName.textContent = (w.diffChapter > 5 ? 'Ascended ' : '') + BOSSES[boss.bossId].name;
    }
    if (boss) {
        const f = Math.max(0, boss.hp / boss.maxHp) * 100;
        set('boss', Math.round(f * 2), () => { el.bossFill.style.width = f + '%'; el.bossLag.style.width = f + '%'; });
    }
}

export function resetHUD() { last = {}; bossShown = null; el.bossBar.classList.add('hidden'); }
