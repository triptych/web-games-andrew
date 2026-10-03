/**
 * ui.js — the DOM side: HUD, card bar, unit panel, Keep panel, relic choice,
 * modals, the Ember Tree, the bestiary, banners and toasts.
 *
 * It reads the world and calls back into main.js through `H` (handlers) for
 * every action, so it never mutates the simulation itself.
 */

import {
    UNITS, UNIT_ORDER, CASTLE, CASTLE_ORDER, POWERS, RARITIES, REGIONS, ARCH, ARCH_INFO, AFFIXES,
    EMBER_TREE, EMBER_ORDER, emberRankCost, REKINDLE_MIN_WAVE, embersFor, RELIC_SLOTS, LANES,
    regionIndex, localWave, isBossWave, isLongNight, unitDmgMul, wallMaxHp, keepfireDmg, rampartDmg, powerMul,
    PERK_LEVELS, UNIT_MAX_LEVEL, FINAL_WAVE,
} from './config.js';
import {
    cardCost, unitUpgradeCost, sellValue, castleCost, towerCostFor, unitSummary, unlockedUnits, waveProgress,
} from './sim/world.js';
import { relicLines } from './sim/relics.js';
import { newFoes } from './sim/waves.js';
import { unitThumb, speciesThumb } from './view/thumbs.js';

const $ = (id) => document.getElementById(id);
let H = {};
const U = { cardsKey: '', gold: -1, sel: null, unitId: null, powersKey: '', relicPick: null, toastT: 0, bossMax: 0 };

export const POWER_ICON = { meteor: '☄️', nova: '❄️', storm: '⛈️', rally: '📯', mend: '✨', midas: '🪙', arrows: '🏹', quake: '🌋' };
const CASTLE_ICON = { walls: '🧱', bailey: '🚩', forge: '⚒️', treasury: '💰', keepfire: '🔥', ramparts: '🗡️' };
const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e5 ? Math.round(n / 1e3) + 'k' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.floor(n)));
export { fmt };

export function initUI(handlers) {
    H = handlers;
    $('start-btn').onclick = () => H.startWave();
    $('keep-btn').onclick = () => H.openKeep();
    $('speed-btn').onclick = () => H.speed();
    $('pause-btn').onclick = () => H.pause();
    $('keepfire-btn').onclick = () => H.keepfire();
    $('up-close').onclick = () => H.closeUnit();
    $('up-upgrade').onclick = () => H.upgradeUnit(U.unitId);
    $('up-sell').onclick = () => H.sellUnit(U.unitId);
    $('relic-skip').onclick = () => H.relic(null);
    $('replace-cancel').onclick = () => { $('relic-replace').classList.add('hidden'); $('relic-cards').classList.remove('hidden'); $('relic-skip').classList.remove('hidden'); };
    $('retry-btn').onclick = () => H.retry();
    $('lost-rekindle').onclick = () => H.openEmbers();
    $('lost-title').onclick = () => H.toTitle();
    $('resume-btn').onclick = () => H.resume();
    $('pause-settings').onclick = () => showScreen('settings');
    $('pause-help').onclick = () => showScreen('help');
    $('pause-title').onclick = () => H.toTitle();
    $('continue-btn').onclick = () => H.continueGame();
    $('new-btn').onclick = () => H.newGame();
    $('embers-btn').onclick = () => H.openEmbers();
    $('bestiary-btn').onclick = () => H.openBestiary();
    $('help-btn').onclick = () => showScreen('help');
    $('settings-btn').onclick = () => showScreen('settings');
    $('victory-ok').onclick = () => hideScreen('victory');
    $('rekindle-btn').onclick = () => H.rekindle();
    $('reset-btn').onclick = () => H.reset();
    for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => { hideScreen(b.dataset.close); H.closed?.(b.dataset.close); };
    for (const t of document.querySelectorAll('.tab')) t.onclick = () => {
        for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x === t);
        for (const k of ['castle', 'relics', 'stats']) $('keep-' + k).classList.toggle('hidden', k !== t.dataset.tab);
    };
    bindModal();
    for (const id of ['set-sound', 'set-music', 'set-hints', 'set-auto', 'set-quality']) $(id).onchange = () => H.settings(readSettings());
    // Buttons give a click sound.
    document.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) H.click?.(); }, true);
}

export function readSettings() {
    return {
        sound: $('set-sound').checked, music: $('set-music').checked, hints: $('set-hints').checked,
        autoStart: $('set-auto').checked, quality: $('set-quality').value,
    };
}
export function writeSettings(s) {
    $('set-sound').checked = !!s.sound; $('set-music').checked = !!s.music; $('set-hints').checked = !!s.hints;
    $('set-auto').checked = !!s.autoStart; $('set-quality').value = String(s.quality ?? 'auto');
}

// ------------------------------------------------------------------ screens

export function showScreen(id) { $(id).classList.remove('hidden'); $(id).scrollTop = 0; }
export function hideScreen(id) { $(id).classList.add('hidden'); }
export const isOpen = (id) => !$(id).classList.contains('hidden');
export function showHUD(on) { $('hud').classList.toggle('hidden', !on); document.body.classList.toggle('playing', on); }

// ------------------------------------------------------------------ cards

export function buildCards(w) {
    const list = unlockedUnits(w);
    const key = list.join(',');
    if (key === U.cardsKey) return;
    const prev = new Set(U.cardsKey.split(','));
    U.cardsKey = key;
    const box = $('cards');
    box.innerHTML = '';
    list.forEach((t, i) => {
        const d = UNITS[t];
        const el = document.createElement('div');
        el.className = 'card' + (U.cardsKey && !prev.has(t) && prev.size > 1 ? ' fresh' : '');
        el.dataset.type = t;
        el.innerHTML = `<span class="hk">${i < 9 ? i + 1 : i === 9 ? 0 : '-'}</span><img alt=""><div class="cname">${d.short ?? d.name}</div><div class="cost"><span class="coin"></span><span class="cv"></span></div><div class="cd"></div>`;
        el.querySelector('img').src = unitThumb(t);
        el.addEventListener('pointerdown', (e) => H.cardDown(t, e));
        box.appendChild(el);
    });
}

export function setSelectedCard(t) {
    U.sel = t;
    for (const el of $('cards').children) el.classList.toggle('sel', el.dataset.type === t);
}

// ------------------------------------------------------------------ HUD per frame

const flagCache = { key: '' };
export function updateHUD(w, o = {}) {
    // gold
    const g = Math.floor(w.gold);
    if (g !== U.gold) {
        if (g > U.gold && U.gold >= 0) { $('gold-box').classList.remove('bump'); void $('gold-box').offsetWidth; $('gold-box').classList.add('bump'); }
        U.gold = g;
        $('gold').textContent = fmt(g);
    }
    // wave label & progress
    const R = REGIONS[w.regionIdx];
    const lbl = `Wave ${w.wave} · ${isLongNight(w.wave) ? 'The Long Night — ' : ''}${R.name}${isBossWave(w.wave) ? ' · BOSS' : ''}`;
    if ($('wave-label').textContent !== lbl) $('wave-label').textContent = lbl;
    const prog = waveProgress(w);
    $('progress-fill').style.width = (prog * 100).toFixed(1) + '%';
    const fk = w.wave + ':' + w.phase;
    if (flagCache.key !== fk && w.waveDef) {
        flagCache.key = fk;
        const fl = $('flags');
        fl.innerHTML = '';
        for (const t of w.waveDef.flags) {
            const f = document.createElement('div');
            f.className = 'flag' + (w.waveDef.boss ? ' boss' : '');
            f.style.left = (Math.min(1, t / w.waveDef.duration) * 100).toFixed(1) + '%';
            f.dataset.t = t;
            fl.appendChild(f);
        }
    }
    for (const f of $('flags').children) f.classList.toggle('passed', w.phase === 'wave' && w.waveT >= +f.dataset.t);
    // wall
    const wf = Math.max(0, w.wallHp / w.wallMax);
    $('wall-fill').style.width = (wf * 100).toFixed(1) + '%';
    $('wall-lag').style.width = (wf * 100).toFixed(1) + '%';
    $('wall-fill').className = wf < 0.3 ? 'low' : wf < 0.6 ? 'mid' : '';
    $('wall-txt').textContent = fmt(Math.max(0, Math.ceil(w.wallHp)));
    $('vignette').classList.toggle('danger', w.phase === 'wave' && wf < 0.3);
    // cards
    buildCards(w);
    for (const el of $('cards').children) {
        const t = el.dataset.type;
        const cost = cardCost(w, t);
        el.querySelector('.cv').textContent = fmt(cost);
        el.classList.toggle('poor', w.gold < cost);
        const cd = w.phase === 'wave' ? w.cards[t] : 0;
        const max = UNITS[t].recharge * (1 - w.mods.recharge);
        const cdEl = el.querySelector('.cd');
        if (cd > 0) { cdEl.style.display = 'block'; cdEl.style.clipPath = `inset(${((1 - cd / max) * 100).toFixed(1)}% 0 0 0)`; }
        else cdEl.style.display = 'none';
    }
    // powers
    const pk = w.powers.map((p) => p.power + p.rarity).join(',') + '|' + w.powerCap + '|' + (o.armedPower ?? -1);
    if (pk !== U.powersKey) {
        U.powersKey = pk;
        const box = $('powers');
        box.innerHTML = '';
        for (let i = 0; i < w.powerCap; i++) {
            const p = w.powers[i];
            const el = document.createElement('button');
            el.className = 'pslot' + (p ? '' : ' empty') + (o.armedPower === i ? ' armed' : '');
            el.innerHTML = `<span class="key">${'QWER'[i] ?? ''}</span>${p ? POWER_ICON[p.power] : ''}`;
            if (p) { el.style.borderColor = RARITIES[p.rarity].color; el.title = `${RARITIES[p.rarity].name} ${POWERS[p.power].name}: ${POWERS[p.power].desc}`; el.setAttribute('aria-label', el.title); }
            el.onclick = () => p && H.power(i);
            box.appendChild(el);
        }
    }
    // keepfire
    const kb = $('keepfire-btn');
    kb.classList.toggle('hidden', w.castle.keepfire <= 0);
    if (w.castle.keepfire > 0) {
        $('kf-ring').style.strokeDashoffset = (106.8 * (1 - w.kf / 100)).toFixed(1);
        kb.classList.toggle('ready', w.kf >= 100);
        kb.classList.toggle('armed', !!o.armedKeepfire);
    }
    // boss bar
    const boss = w.enemies.find((e) => e.boss && !e.dead);
    $('boss-bar').classList.toggle('hidden', !boss);
    if (boss) {
        const sp = w.speciesById[boss.species];
        const nm = `${sp.name}, ${sp.title}`;
        if ($('boss-name').textContent !== nm) $('boss-name').textContent = nm;
        const f = boss.hp / boss.maxHp;
        $('boss-fill').style.width = (f * 100).toFixed(2) + '%';
        $('boss-lag').style.width = (f * 100).toFixed(2) + '%';
        $('boss-ward').style.width = ((boss.ward ?? 0) / boss.maxHp * 100).toFixed(2) + '%';
    }
    // prep panel
    $('prep-panel').classList.toggle('hidden', w.phase !== 'prep' || !!o.hidePrep);
    $('speed-btn').textContent = '×' + (o.speed ?? 1);
    $('speed-btn').classList.toggle('on', (o.speed ?? 1) > 1);
    $('pause-btn').classList.toggle('hidden', w.phase !== 'wave');
}

export function renderPrep(w) {
    const R = REGIONS[w.regionIdx];
    $('prep-region').textContent = `${R.numeral} · ${R.name}${isLongNight(w.wave) ? ' · The Long Night' : ''}`;
    const boss = isBossWave(w.wave);
    $('prep-wave').innerHTML = boss ? `Wave ${w.wave} · <span class="boss">${R.boss.name}</span>` : `Wave ${w.wave} of ${FINAL_WAVE}`;
    const fresh = new Set(newFoes(w.wave));
    const box = $('prep-foes');
    box.innerHTML = '';
    for (const a of w.waveDef.archs) {
        const sp = a === 'boss' ? w.speciesById[`boss:${w.waveDef.boss}`] : w.bestiary[w.regionIdx][a];
        if (!sp) continue;
        const el = document.createElement('div');
        el.className = 'foe-chip' + (fresh.has(a) ? ' new' : '');
        el.title = sp.name;
        const img = document.createElement('img');
        img.src = speciesThumb(sp);
        el.appendChild(img);
        box.appendChild(el);
    }
}

// ------------------------------------------------------------------ banners & toasts

export function banner(text, sub = '', cls = '') {
    const el = document.createElement('div');
    el.className = 'banner ' + cls;
    el.innerHTML = `${text}${sub ? `<span class="sub">${sub}</span>` : ''}`;
    $('banners').appendChild(el);
    setTimeout(() => el.remove(), 2700);
}

let toastTimer = 0;
export function toast(text, hint = false, ms = 2600) {
    const el = $('toast');
    el.textContent = text;
    el.className = 'show' + (hint ? ' hint' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, ms);
}

export function targetHint(text) {
    $('target-hint').classList.toggle('hidden', !text);
    if (text) $('target-hint').textContent = text;
}

// ------------------------------------------------------------------ coin flyers

export function flyCoins(x, y, n = 3) {
    const tgt = $('gold-box').getBoundingClientRect();
    const tx = tgt.left + 18, ty = tgt.top + tgt.height / 2;
    for (let i = 0; i < Math.min(n, 6); i++) {
        const c = document.createElement('div');
        c.className = 'flycoin';
        $('flyers').appendChild(c);
        const sx = x + (Math.random() - 0.5) * 30, sy = y + (Math.random() - 0.5) * 20;
        const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, ty) - 60 - Math.random() * 60;
        const t0 = performance.now() + i * 60;
        const dur = 600 + Math.random() * 200;
        const step = (now) => {
            const k = Math.max(0, Math.min(1, (now - t0) / dur));
            const e = k * k * (3 - 2 * k);
            const px = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * mx + e * e * tx;
            const py = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * my + e * e * ty;
            c.style.transform = `translate(${px - 8}px, ${py - 8}px) scale(${1 - k * 0.4})`;
            if (k < 1) requestAnimationFrame(step); else c.remove();
        };
        requestAnimationFrame(step);
    }
}

// ------------------------------------------------------------------ unit panel

export function openUnitPanel(w, u, pos) {
    U.unitId = u.id;
    const p = $('unit-panel');
    p.classList.remove('hidden');
    renderUnitPanel(w);
    placeUnitPanel(pos);
}
export function placeUnitPanel(pos) {
    const p = $('unit-panel');
    const r = p.getBoundingClientRect();
    const W = window.innerWidth, Hh = window.innerHeight;
    let x = pos ? pos.x - r.width / 2 : (W - r.width) / 2;
    let y = pos ? pos.y - r.height - 20 : Hh / 2 - r.height / 2;
    if (pos && y < 70) y = pos.y + 40;
    x = Math.max(8, Math.min(W - r.width - 8, x));
    y = Math.max(60, Math.min(Hh - r.height - 100, y));
    p.style.left = x + 'px';
    p.style.top = y + 'px';
}
export function closeUnitPanel() { U.unitId = null; $('unit-panel').classList.add('hidden'); }
export const unitPanelId = () => U.unitId;

export function renderUnitPanel(w) {
    const u = w.units.find((v) => v.id === U.unitId);
    if (!u) { closeUnitPanel(); return; }
    const d = UNITS[u.type];
    $('up-img').src = unitThumb(u.type);
    $('up-name').textContent = d.name;
    $('up-title').textContent = d.title;
    $('up-level').textContent = `Level ${u.level}${u.level >= UNIT_MAX_LEVEL ? ' (max)' : ''} · ${u.kills} kills`;
    const s = unitSummary(w, u);
    const rows = [];
    rows.push(`<span>Health</span><b>${fmt(s.hp)} / ${fmt(s.maxHp)}</b>`);
    if (s.dps !== undefined) rows.push(`<span>Damage</span><b>${fmt(s.dmg)}</b>`, `<span>Per second</span><b>${fmt(s.dps)}</b>`);
    if (s.brew !== undefined) rows.push(`<span>Brews</span><b>${s.brew} gold</b>`);
    if (s.heal !== undefined) rows.push(`<span>Heals</span><b>${fmt(s.heal)}</b>`);
    if (d.root) rows.push(`<span>Thorns</span><b>${fmt(s.dmg)}</b>`);
    rows.push(`<span>Post</span><b>${u.kind === 'wall' ? 'Tower ' + (u.tier + 1) : 'Field'}</b>`);
    $('up-stats').innerHTML = rows.join('');
    $('up-perks').innerHTML = `<div class="dim">${d.desc}</div>` + PERK_LEVELS.map((lv) => `<div class="perk ${u.level >= lv ? 'got' : ''}"><span class="lv">Lv ${lv}</span>${d.perks[lv]}</div>`).join('');
    const c = unitUpgradeCost(w, u);
    const ub = $('up-upgrade');
    if (isFinite(c)) { ub.innerHTML = `Level up <span class="coin"></span>${fmt(c)}`; ub.disabled = w.gold < c; }
    else { ub.textContent = 'Max level'; ub.disabled = true; }
    $('up-sell').innerHTML = `Sell +${fmt(sellValue(w, u))}`;
}

// ------------------------------------------------------------------ Keep panel

const castleEffect = (w, key) => {
    const c = w.castle;
    switch (key) {
        case 'walls': return `${fmt(wallMaxHp(c.walls) * (1 + w.mods.wallhp))} HP → ${fmt(wallMaxHp(c.walls + 1) * (1 + w.mods.wallhp))}`;
        case 'bailey': return `${c.bailey} columns → ${c.bailey + 1}`;
        case 'forge': return `+${c.forge * 12}% damage → +${(c.forge + 1) * 12}%`;
        case 'treasury': return `+${c.treasury * 8}% bounty, ${c.treasury * 2}% interest → +${(c.treasury + 1) * 8}%, ${(c.treasury + 1) * 2}%`;
        case 'keepfire': return c.keepfire ? `Lane firestorm ${fmt(keepfireDmg(c.keepfire) * powerMul(w.wave))} → ${fmt(keepfireDmg(c.keepfire + 1) * powerMul(w.wave))}` : 'Unlocks the Keepfire';
        case 'ramparts': return `Spikes ${fmt(rampartDmg(c.ramparts))} → ${fmt(rampartDmg(c.ramparts + 1))} (scales with the wave)`;
    }
    return '';
};

export function renderKeep(w, stats) {
    $('keep-gold').textContent = fmt(w.gold);
    const tw = $('towers');
    tw.innerHTML = '';
    for (let lane = 0; lane < LANES; lane++) {
        const t = w.castle.towers[lane];
        const c = towerCostFor(w, lane);
        const el = document.createElement('div');
        el.className = 'tower' + (w.waveDef.lanes.includes(lane) ? ' active' : '');
        el.innerHTML = `<div class="tl">Lane ${lane + 1}</div><div class="pips">${[0, 1, 2].map((i) => `<div class="pip ${i < t ? 'on' : ''}"></div>`).join('')}</div>`;
        const b = document.createElement('button');
        b.className = 'btn';
        if (isFinite(c)) { b.innerHTML = `<span class="coin"></span>${fmt(c)}`; b.disabled = w.gold < c; b.onclick = () => H.buyTower(lane); }
        else { b.textContent = 'Max'; b.disabled = true; }
        el.appendChild(b);
        tw.appendChild(el);
    }
    const up = $('upgrades');
    up.innerHTML = '';
    for (const key of CASTLE_ORDER) {
        const def = CASTLE[key];
        const lv = w.castle[key];
        const c = castleCost(w, key);
        const el = document.createElement('div');
        el.className = 'upg';
        el.innerHTML = `<div class="ui">${CASTLE_ICON[key]}</div><div class="ut"><div class="un">${def.name}<span class="lv">${key === 'bailey' ? lv + ' cols' : 'Lv ' + lv}/${def.max}</span></div><div class="ud">${def.desc}<br>${isFinite(c) ? castleEffect(w, key) : 'Fully upgraded'}</div></div>`;
        const b = document.createElement('button');
        b.className = 'btn primary';
        if (isFinite(c)) { b.innerHTML = `<span class="coin"></span>${fmt(c)}`; b.disabled = w.gold < c; b.onclick = () => H.buyCastle(key); }
        else { b.textContent = 'Max'; b.disabled = true; }
        el.appendChild(b);
        up.appendChild(el);
    }
    // relics
    const rb = $('keep-relics');
    rb.innerHTML = `<div class="sub center">Relics ${w.relics.length}/${RELIC_SLOTS}</div>`;
    const row = document.createElement('div');
    row.id = 'keep-relic-row';
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center';
    for (const r of w.relics) row.appendChild(relicCard(r, true));
    if (!w.relics.length) row.innerHTML = '<div class="dim">No relics yet. You choose one after every wave.</div>';
    rb.appendChild(row);
    // stats
    const s = w.stats;
    const counts = {};
    for (const u of w.units) counts[u.type] = (counts[u.type] ?? 0) + 1;
    $('keep-stats').innerHTML = `
        <div class="row"><span>Waves held</span><b>${s.waves}</b></div>
        <div class="row"><span>Best wave this defence</span><b>${w.best}</b></div>
        <div class="row"><span>Monsters slain</span><b>${fmt(s.kills)}</b></div>
        <div class="row"><span>Bosses slain</span><b>${s.bosses}</b></div>
        <div class="row"><span>Gold earned</span><b>${fmt(s.gold)}</b></div>
        <div class="row"><span>Powerups used</span><b>${s.powers}</b></div>
        <div class="row"><span>Keepfires</span><b>${s.keepfires}</b></div>
        <div class="row"><span>Party</span><b>${Object.entries(counts).map(([k, n]) => `${n} ${UNITS[k].name}`).join(', ') || '—'}</b></div>
        ${stats ? `<div class="row"><span>Rekindles</span><b>${stats.rekindles}</b></div><div class="row"><span>Embers</span><b>${stats.embers}</b></div>` : ''}`;
}

// ------------------------------------------------------------------ Relics

const NOUN_SHAPE = {
    Charm: 'gem', Token: 'coin', Trinket: 'gem', Ring: 'ring', Brooch: 'brooch', Sigil: 'rune', Talisman: 'amulet', Amulet: 'amulet', Rune: 'rune', Idol: 'idol',
    Grimoire: 'book', Chalice: 'chalice', Lantern: 'lantern', Horn: 'horn', Banner: 'banner', Crown: 'crown', Heart: 'heart', Feather: 'feather', Crest: 'shield', Codex: 'book',
};

export function drawRelicIcon(cv, r) {
    const g = cv.getContext('2d');
    const S = cv.width;
    g.clearRect(0, 0, S, S);
    g.save();
    g.scale(S / 64, S / 64);
    const c1 = r.colors[0], c2 = r.colors[1];
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, RARITIES[r.rarity].color + '66'); grd.addColorStop(1, 'transparent');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    g.lineWidth = 2.5; g.strokeStyle = '#2a1a0a';
    const gold = '#e8b84a';
    const fillStroke = (fill) => { g.fillStyle = fill; g.fill(); g.stroke(); };
    const shape = NOUN_SHAPE[r.noun] ?? 'gem';
    g.beginPath();
    switch (shape) {
        case 'gem': g.moveTo(32, 8); g.lineTo(52, 26); g.lineTo(32, 56); g.lineTo(12, 26); g.closePath(); fillStroke(c1); g.beginPath(); g.moveTo(12, 26); g.lineTo(52, 26); g.moveTo(24, 26); g.lineTo(32, 8); g.lineTo(40, 26); g.stroke(); break;
        case 'coin': g.arc(32, 32, 20, 0, 7); fillStroke(gold); g.beginPath(); g.arc(32, 32, 12, 0, 7); fillStroke(c1); break;
        case 'ring': g.arc(32, 36, 16, 0, 7); g.lineWidth = 7; g.strokeStyle = gold; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = '#2a1a0a'; g.beginPath(); g.moveTo(32, 10); g.lineTo(40, 20); g.lineTo(32, 26); g.lineTo(24, 20); g.closePath(); fillStroke(c1); break;
        case 'brooch': for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); g.lineTo(32 + Math.cos(a + 0.39) * 14, 32 + Math.sin(a + 0.39) * 14); } g.closePath(); fillStroke(gold); g.beginPath(); g.arc(32, 32, 9, 0, 7); fillStroke(c1); break;
        case 'rune': g.moveTo(18, 10); g.lineTo(46, 12); g.lineTo(50, 52); g.lineTo(14, 54); g.closePath(); fillStroke('#7a7470'); g.beginPath(); g.strokeStyle = c1; g.lineWidth = 3.5; g.moveTo(26, 20); g.lineTo(32, 44); g.lineTo(38, 20); g.moveTo(24, 32); g.lineTo(40, 32); g.stroke(); break;
        case 'amulet': g.moveTo(14, 8); g.quadraticCurveTo(32, 30, 50, 8); g.lineWidth = 2; g.strokeStyle = gold; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = '#2a1a0a'; g.beginPath(); g.arc(32, 38, 15, 0, 7); fillStroke(gold); g.beginPath(); g.arc(32, 38, 9, 0, 7); fillStroke(c1); break;
        case 'idol': g.arc(32, 18, 9, 0, 7); fillStroke(c1); g.beginPath(); g.moveTo(22, 28); g.lineTo(42, 28); g.lineTo(46, 56); g.lineTo(18, 56); g.closePath(); fillStroke(c2); break;
        case 'book': g.rect(14, 12, 36, 42); fillStroke(c1); g.beginPath(); g.rect(14, 12, 7, 42); fillStroke(gold); g.beginPath(); g.arc(35, 32, 7, 0, 7); fillStroke(c2); break;
        case 'chalice': g.moveTo(16, 12); g.lineTo(48, 12); g.quadraticCurveTo(46, 34, 32, 36); g.quadraticCurveTo(18, 34, 16, 12); fillStroke(gold); g.beginPath(); g.rect(29, 36, 6, 10); fillStroke(gold); g.beginPath(); g.ellipse(32, 50, 12, 4, 0, 0, 7); fillStroke(gold); g.beginPath(); g.ellipse(32, 14, 14, 3, 0, 0, 7); fillStroke(c1); break;
        case 'lantern': g.rect(20, 18, 24, 32); fillStroke('#3a3a40'); g.beginPath(); g.rect(24, 22, 16, 24); fillStroke(c1); g.beginPath(); g.moveTo(20, 18); g.lineTo(32, 8); g.lineTo(44, 18); fillStroke('#3a3a40'); break;
        case 'horn': g.moveTo(10, 46); g.quadraticCurveTo(20, 14, 54, 14); g.lineTo(54, 26); g.quadraticCurveTo(26, 28, 20, 52); g.closePath(); fillStroke('#e8dcc0'); g.beginPath(); g.rect(30, 16, 5, 12); fillStroke(c1); break;
        case 'banner': g.rect(16, 6, 3, 52); fillStroke('#6a4a2a'); g.beginPath(); g.moveTo(19, 10); g.lineTo(50, 10); g.lineTo(50, 44); g.lineTo(34, 36); g.lineTo(19, 44); g.closePath(); fillStroke(c1); g.beginPath(); g.arc(34, 24, 6, 0, 7); fillStroke(c2); break;
        case 'crown': g.moveTo(10, 48); g.lineTo(10, 20); g.lineTo(21, 32); g.lineTo(32, 12); g.lineTo(43, 32); g.lineTo(54, 20); g.lineTo(54, 48); g.closePath(); fillStroke(gold); for (const x of [21, 32, 43]) { g.beginPath(); g.arc(x, 42, 4, 0, 7); fillStroke(c1); } break;
        case 'heart': g.moveTo(32, 54); g.bezierCurveTo(4, 32, 14, 6, 32, 20); g.bezierCurveTo(50, 6, 60, 32, 32, 54); fillStroke(c1); break;
        case 'feather': g.moveTo(14, 54); g.quadraticCurveTo(18, 14, 52, 8); g.quadraticCurveTo(44, 40, 14, 54); fillStroke(c1); g.beginPath(); g.moveTo(14, 54); g.quadraticCurveTo(30, 30, 50, 10); g.stroke(); break;
        case 'shield': g.moveTo(32, 8); g.lineTo(52, 14); g.lineTo(48, 40); g.lineTo(32, 56); g.lineTo(16, 40); g.lineTo(12, 14); g.closePath(); fillStroke(c1); g.beginPath(); g.moveTo(32, 14); g.lineTo(32, 48); g.moveTo(18, 26); g.lineTo(46, 26); g.strokeStyle = gold; g.lineWidth = 4; g.stroke(); break;
    }
    g.restore();
}

function relicCard(r, small = false) {
    const el = document.createElement('div');
    el.className = 'relic' + (small ? ' small' : '');
    el.style.borderColor = RARITIES[r.rarity].color;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    drawRelicIcon(cv, r);
    el.appendChild(cv);
    el.insertAdjacentHTML('beforeend', `<div class="rn">${r.name}</div><div class="rr" style="color:${RARITIES[r.rarity].color}">${RARITIES[r.rarity].name}</div><div class="rl">${relicLines(r).join('<br>')}</div>`);
    return el;
}

export function openClear(w) {
    const c = w.lastClear;
    $('clear-title').textContent = c.boss ? `${REGIONS[c.region].boss.name} Falls!` : `Wave ${c.wave} Held`;
    $('clear-sum').innerHTML = `<span>Slain <b>${c.kills}</b></span><span>Gold <b>+${fmt(c.gold)}</b></span><span>Wave bonus <b>+${fmt(c.bonus)}</b></span>${c.interest ? `<span>Interest <b>+${fmt(c.interest)}</b></span>` : ''}<span>Wall <b>${Math.round(c.wallLeft * 100)}%</b></span>`;
    const box = $('relic-cards');
    box.innerHTML = '';
    box.classList.remove('hidden');
    $('relic-replace').classList.add('hidden');
    $('relic-skip').classList.remove('hidden');
    $('relic-skip').textContent = `Take ${fmt(Math.round(40 + 12 * w.wave))} gold instead`;
    for (const r of w.relicOffer) {
        const el = relicCard(r);
        el.onclick = () => {
            if (w.relics.length >= RELIC_SLOTS) {
                U.relicPick = r;
                box.classList.add('hidden');
                $('relic-skip').classList.add('hidden');
                const held = $('relic-held');
                held.innerHTML = '';
                w.relics.forEach((x, i) => { const e2 = relicCard(x, true); e2.onclick = () => H.relic(r, i); held.appendChild(e2); });
                $('relic-replace').classList.remove('hidden');
            } else H.relic(r);
        };
        box.appendChild(el);
    }
    showScreen('clear');
}

// ------------------------------------------------------------------ Modals

let modalOk = null;
export function showModal(html, okText = 'Onward', onOk = null) {
    $('modal-body').innerHTML = html;
    $('modal-ok').textContent = okText;
    modalOk = onOk;
    showScreen('modal');
}
export function bindModal() {
    $('modal-ok').onclick = () => { const f = modalOk; modalOk = null; hideScreen('modal'); f?.(); H.modalDone?.(); };
}

export function regionCardHTML(w) {
    const R = REGIONS[w.regionIdx];
    const lines = R.intro.map((l) => `<div class="quote">“${l}”<span class="who">— Castellan Brannoc</span></div>`).join('');
    return `<div class="numeral">${R.numeral}</div><div class="region-name">${R.name}</div><div class="region-sub">${isLongNight(w.wave) ? 'The Long Night' : R.sub}</div>${lines}`;
}

export function foeCardsHTML(w, archs) {
    return `<h2>New Foes</h2>` + archs.map((a) => {
        const sp = w.bestiary[w.regionIdx][a];
        return `<div class="mcard"><img src="${speciesThumb(sp)}" alt=""><div><div class="mt">${a === 'treasure' ? 'Treasure carrier' : a}</div><div class="mn">${sp.name}</div><div class="md">${ARCH_INFO[a]}</div></div></div>`;
    }).join('');
}

export function allyCardHTML(type) {
    const d = UNITS[type];
    return `<h2>A New Ally</h2><div class="mcard"><img src="${unitThumb(type)}" alt=""><div><div class="mt">${d.title}</div><div class="mn">${d.name}</div><div class="md">${d.desc}<br><span class="dim">Costs ${d.cost} gold · ${d.place === 'field' ? 'field only' : 'tower or field'}</span></div></div></div>`;
}

export function bossCardHTML(w) {
    const R = REGIONS[w.regionIdx];
    const sp = w.speciesById[`boss:${R.boss.kind}`];
    return `<h2 class="red">${R.boss.name}</h2><div class="region-sub">${R.boss.title}</div><div class="mcard"><img src="${speciesThumb(sp)}" alt=""><div><div class="quote">“${R.boss.taunt}”</div></div></div>`;
}

// ------------------------------------------------------------------ Lost

export function showLost(w, earned, canRekindle, gain) {
    $('lost-sum').innerHTML = `The wall broke on <b>wave ${w.wave}</b>.<br>You keep all <b>${fmt(earned)}</b> gold earned in the attempt — spend it and try again.${canRekindle ? `<br><span class="dim">Or Rekindle now for <b>${gain}</b> Embers.</span>` : ''}`;
    $('lost-rekindle').classList.toggle('hidden', !canRekindle);
    showScreen('lost');
}

// ------------------------------------------------------------------ Ember tree

export function renderEmbers(meta, run) {
    $('ember-have').textContent = meta.embers;
    $('ember-count').textContent = meta.embers ? `(${meta.embers})` : '';
    const gain = run && run.best >= REKINDLE_MIN_WAVE ? embersFor(run.best) : 0;
    $('ember-intro').innerHTML = run
        ? (gain ? `Rekindling ends this defence (best wave <b>${run.best}</b>) and starts again from wave 1 for <b>${gain}</b> Embers.` : `Reach wave ${REKINDLE_MIN_WAVE} to Rekindle. Best wave this defence: <b>${run.best}</b>.`)
        : 'Embers buy permanent upgrades for every defence. Earn them by Rekindling.';
    const grid = $('ember-grid');
    grid.innerHTML = '';
    for (const k of EMBER_ORDER) {
        const d = EMBER_TREE[k];
        const r = meta.tree[k] ?? 0;
        const el = document.createElement('div');
        el.className = 'ember' + (r >= d.max ? ' maxed' : '');
        el.innerHTML = `<div class="en"><span>${d.name}</span><span>${r}/${d.max}</span></div><div class="ed">${d.desc}</div>`;
        const b = document.createElement('button');
        b.className = 'btn';
        if (r >= d.max) { b.textContent = 'Mastered'; b.disabled = true; }
        else { const c = emberRankCost(k, r); b.innerHTML = `<span class="ember-ico"></span> ${c}`; b.disabled = meta.embers < c; b.onclick = () => H.buyRank(k); }
        el.appendChild(b);
        grid.appendChild(el);
    }
    const rb = $('rekindle-btn');
    rb.classList.toggle('hidden', !gain);
    rb.innerHTML = `Rekindle for <span class="ember-ico"></span> ${gain} Embers`;
}

// ------------------------------------------------------------------ Bestiary

export function renderBestiary(meta, w) {
    const grid = $('bestiary-grid');
    grid.innerHTML = '';
    w.bestiary.forEach((byArch, ri) => {
        const R = REGIONS[ri];
        grid.insertAdjacentHTML('beforeend', `<div class="region-h">${R.numeral} · ${R.name}</div>`);
        const list = [...R.roster.map(([a]) => byArch[a]), byArch.treasure, w.speciesById[`boss:${R.boss.kind}`]];
        for (const sp of list) {
            const seen = (meta.seen[sp.id] ?? 0) > 0 || (w.seen[sp.id] ?? 0) > 0;
            const el = document.createElement('div');
            el.className = 'beast' + (seen ? '' : ' unknown');
            const img = document.createElement('img');
            img.src = speciesThumb(sp);
            el.appendChild(img);
            const arch = sp.arch === 'boss' ? 'Boss' : sp.arch;
            el.insertAdjacentHTML('beforeend', `<div class="bn">${seen ? sp.name : '???'}</div><div class="ba">${arch}</div>${seen && ARCH_INFO[sp.arch] ? `<div class="bk">${ARCH_INFO[sp.arch]}</div>` : ''}`);
            grid.appendChild(el);
        }
    });
}

export function setTitleInfo(text, canContinue) {
    $('title-info').innerHTML = text;
    $('continue-btn').classList.toggle('hidden', !canContinue);
}
