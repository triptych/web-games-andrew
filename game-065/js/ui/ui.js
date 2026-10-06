/**
 * ui.js — the DOM side of Worldroot: HUD counters, the tabbed panel, modals,
 * toasts, floating numbers and the stage lore banner.
 *
 * Lists are built once and then patched in place (text, classes) on a timer,
 * so a click never lands on an element that was just replaced. A list is only
 * rebuilt when the set of things in it changes.
 *
 * `act` is the action table from main.js (buyGen, buyUpgrade, nourish, cast,
 * rebirth, …): the UI never touches the simulation's state directly.
 */

import {
    GENERATORS, UPGRADES, UPGRADE_BY_ID, STAGES, SPELLS, HEARTWOOD, REALMS, TRIALS, ACHIEVEMENTS, SEASONS,
    WISP_KINDS, TREE_LEVEL_BONUS, HW_BONUS, REBIRTH_STAGE, MILESTONES, stageOf,
} from '../sim/data.js';
import { fmt, fmtTime, fmtLong } from './format.js';

export const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let G = null, act = null, settings = null;
let buyAmt = 1;
let tab = 'grove';
let journalView = 'ach';
let selAch = null;
const keys = {};          // last-built keys per list, to know when to rebuild

const ACH_ICON = { motes: '✨', grove: '🌿', tree: '🌳', clicks: '👆', wisps: '🔮', spells: '🪄', rebirth: '🌀', realms: '🌍', trials: '⚖️', secret: '🌙' };
const STAGE_UNLOCKS = [
    'Fireflies, Glowcaps and Dew Sprites',
    'Lantern Moths and Fox Spirits; golden wisps begin to appear',
    'Moonwells; spells: Verdant Surge and Moonlit Hands',
    'Standing Stones; spell: Call the Wisp',
    'Treants; spell: Quicken Time',
    'White Stags; you can now be reborn for heartwood',
    'Aurora Looms; spell: Starfall; the aurora wakes',
    'the Dryad Court',
    'Star Seeds',
    'its crown touches the stars',
    'realms can be bound to its branches',
];

export function initUI(grove, actions, s) {
    G = grove; act = actions; settings = s;
    buyAmt = s.buy === 'max' ? 'max' : (Number(s.buy) || 1);
    buildGenRows();
    wireTabs();
    wireStatic();
    setTab(s.tab || 'grove', true);
    refresh(true);
}

export function setGrove(grove) { G = grove; for (const k in keys) delete keys[k]; buildGenRows(); refresh(true); }

// ------------------------------------------------------------------ tabs
function wireTabs() {
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
        act.ui();
        if ($('panel').classList.contains('closed')) togglePanel(true);
        setTab(b.dataset.tab);
    }));
    $('panel-toggle').addEventListener('click', () => { act.ui(); togglePanel(); });
}
export function togglePanel(open) {
    const p = $('panel');
    const want = open ?? p.classList.contains('closed');
    p.classList.toggle('closed', !want);
    document.body.classList.toggle('sheet-closed', !want);
    act.layout();
}
export function setTab(name, quiet) {
    tab = name;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.id === `pane-${name}`));
    if (!quiet) { settings.tab = name; act.saveSettings(); }
    $('panel-body').scrollTop = 0;
    refresh(true);
}
export function currentTab() { return tab; }

// ------------------------------------------------------------------ static wiring
function wireStatic() {
    $('buy-amt').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        buyAmt = b.dataset.amt === 'max' ? 'max' : Number(b.dataset.amt);
        settings.buy = buyAmt; act.saveSettings(); act.ui();
        refresh(true);
    });
    $('buy-all-ups').addEventListener('click', () => act.buyAllUpgrades());
    for (const k of ['gens', 'ups', 'tree']) {
        $(`auto-${k}`).addEventListener('change', (e) => act.setAuto(k, e.target.checked));
    }
    $('journal-seg').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        journalView = b.dataset.j; act.ui();
        document.querySelectorAll('#journal-seg button').forEach((x) => x.classList.toggle('on', x === b));
        keys.journal = null;
        refresh(true);
    });
    $('journal-body').addEventListener('click', (e) => {
        const a = e.target.closest('.ach'); if (!a) return;
        selAch = a.dataset.id; keys.journal = null; refresh(true);
    });

    // delegated list clicks
    $('up-list').addEventListener('click', (e) => { const b = e.target.closest('[data-up]'); if (b && !b.disabled) act.buyUpgrade(b.dataset.up); });
    $('spell-list').addEventListener('click', (e) => { const b = e.target.closest('[data-spell]'); if (b && !b.disabled) act.cast(b.dataset.spell); });
    $('hw-list').addEventListener('click', (e) => { const b = e.target.closest('[data-hw]'); if (b && !b.disabled) act.buyHeartwood(b.dataset.hw); });
    $('trial-list').addEventListener('click', (e) => { const b = e.target.closest('[data-trial]'); if (b && !b.disabled) act.askTrial(b.dataset.trial); });
    $('realm-list').addEventListener('click', (e) => { const b = e.target.closest('[data-realm]'); if (b && !b.disabled) act.askRealm(b.dataset.realm); });
    $('tree-card').addEventListener('click', (e) => { if (e.target.closest('#tree-nourish')) act.nourish(); });
    $('rebirth-card').addEventListener('click', (e) => {
        if (e.target.closest('#btn-rebirth')) act.askRebirth();
        if (e.target.closest('#btn-abandon')) act.askAbandon();
    });

    $('chip-stage').addEventListener('click', () => { act.ui(); togglePanel(true); setTab('tree'); });
    $('chip-season').addEventListener('click', () => { act.ui(); if (G.stage >= 2) { togglePanel(true); setTab('magic'); } else toast('🍃', 'Seasons', `${G.season().name}: ${G.season().desc}. ${fmtTime(G.seasonLeft())} left.`); });
}

// ------------------------------------------------------------------ generators
function buildGenRows() {
    const list = $('gen-list');
    list.innerHTML = '';
    GENERATORS.forEach((g, i) => {
        const b = document.createElement('button');
        b.className = 'gen';
        b.dataset.gen = i;
        b.innerHTML = `<div class="g-ico">${g.icon}</div>
            <div class="g-mid"><div class="g-name">${esc(g.name)}</div><div class="g-info"></div><div class="g-ms"><i></i></div></div>
            <div class="g-right"><div class="g-own">0</div><div class="g-cost"></div></div>`;
        b.title = g.desc;
        list.appendChild(b);
        // hold to keep buying
        let hold = null, rep = null;
        const stop = () => { clearTimeout(hold); clearInterval(rep); hold = rep = null; };
        b.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            act.buyGen(i, buyAmt);
            hold = setTimeout(() => { rep = setInterval(() => act.buyGen(i, buyAmt), 110); }, 420);
        });
        b.addEventListener('pointerup', stop);
        b.addEventListener('pointerleave', stop);
        b.addEventListener('pointercancel', stop);
        b.addEventListener('click', (e) => { if (e.detail === 0) act.buyGen(i, buyAmt); });   // keyboard
        b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
}

function refreshGens() {
    const s = G.s, d = G.derive();
    const total = Math.max(1e-9, d.baseMps);
    let shownLocked = false;
    document.querySelectorAll('#gen-list .gen').forEach((row) => {
        const i = Number(row.dataset.gen);
        const g = GENERATORS[i];
        const vis = G.genVisible(i);
        let teaser = false;
        if (!vis) {
            if (!shownLocked) { teaser = true; shownLocked = true; } else { row.hidden = true; return; }
        }
        row.hidden = false;
        if (teaser) {
            row.className = 'gen locked';
            row.querySelector('.g-name').textContent = '???';
            const why = !G.genUnlocked(i) ? (s.trial === 'lonely' && i >= 3 ? 'Not in this trial' : `Grows near a ${STAGES[g.stage].name}`) : `Gather ${fmt(g.cost * 0.5)} motes to discover`;
            row.querySelector('.g-info').textContent = why;
            row.querySelector('.g-own').textContent = '';
            row.querySelector('.g-cost').textContent = '';
            row.querySelector('.g-ico').textContent = '❔';
            row.querySelector('.g-ms i').style.width = '0%';
            return;
        }
        row.querySelector('.g-name').textContent = g.name;
        row.querySelector('.g-ico').textContent = g.icon;
        let n = buyAmt === 'max' ? Math.max(1, G.genMaxAffordable(i)) : buyAmt;
        const cost = G.genCost(i, n);
        const can = s.motes >= cost && G.genUnlocked(i);
        row.className = `gen ${can ? 'can' : 'cant'}`;
        row.querySelector('.g-own').textContent = fmt(s.gens[i]);
        const ce = row.querySelector('.g-cost');
        ce.textContent = `${n > 1 ? `×${n} ` : ''}${fmt(cost)}`;
        ce.classList.toggle('no', !can);
        const each = g.mps * d.genMult[i] * d.global;
        const share = d.rates[i] / total;
        row.querySelector('.g-info').innerHTML = s.gens[i] > 0
            ? `each <b>${fmt(each)}</b>/s · all <b>${fmt(d.rates[i])}</b>/s (${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%)`
            : `each <b>${fmt(each)}</b>/s`;
        const ms = G.nextMilestone(i);
        const prev = [...MILESTONES].reverse().find((m) => s.gens[i] >= m) || 0;
        row.querySelector('.g-ms i').style.width = ms ? `${((s.gens[i] - prev) / (ms - prev)) * 100}%` : '100%';
        row.title = `${g.desc}${ms ? `\nAt ${ms} owned: ×2.` : ''}`;
    });
    document.querySelectorAll('#buy-amt button').forEach((b) => b.classList.toggle('on', String(b.dataset.amt) === String(buyAmt)));
    showAuto('gens');
}

function showAuto(k) {
    const row = $(`auto-${k}-row`);
    row.hidden = !G.autoUnlocked(k);
    $(`auto-${k}`).checked = !!G.s.auto[k];
}

// ------------------------------------------------------------------ upgrades
function refreshUps() {
    const s = G.s;
    const avail = G.availableUpgrades();
    const key = avail.map((u) => u.id).join(',');
    const list = $('up-list');
    if (keys.ups !== key) {
        keys.ups = key;
        list.className = 'list';
        list.innerHTML = avail.length ? avail.map((u) => `
            <div class="row up-row" data-row="${u.id}">
                <div class="r-ico">${u.icon}</div>
                <div><div class="r-name">${esc(u.name)}</div><div class="r-desc">${esc(u.desc)}</div></div>
                <button class="r-btn" data-up="${u.id}">${fmt(u.cost)}</button>
            </div>`).join('') : '<div class="empty">No upgrades yet. Grow your grove and more will appear.</div>';
    }
    list.querySelectorAll('[data-up]').forEach((b) => { b.disabled = s.motes < UPGRADE_BY_ID[b.dataset.up].cost; });
    $('buy-all-ups').disabled = !avail.some((u) => u.cost <= s.motes);
    const owned = Object.keys(s.ups);
    if (keys.owned !== owned.length) {
        keys.owned = owned.length;
        $('owned-ups').innerHTML = owned.map((id) => { const u = UPGRADE_BY_ID[id]; return u ? `<span title="${esc(u.name)}: ${esc(u.desc)}">${u.icon}</span>` : ''; }).join('');
        $('owned-count').textContent = `${owned.length} / ${UPGRADES.length}`;
    }
    showAuto('ups');
}

// ------------------------------------------------------------------ tree
function refreshTree() {
    const s = G.s;
    const L = s.tree, st = G.stage;
    const maxed = G.treeMaxed();
    const cost = maxed ? 0 : G.treeCost();
    const nextStageAt = Math.min(100, (st + 1) * 10);
    const html = `<div class="big-card">
        <h3>${esc(STAGES[st].name)}</h3>
        <div class="dim small">Level ${L} / 100${st < 10 ? ` · next stage at level ${nextStageAt}` : ''}</div>
        <div class="progress"><i style="width:${L}%"></i></div>
        <p class="lore">${esc(STAGES[st].lore)}</p>
        <p class="small">Every level: all production ×${TREE_LEVEL_BONUS} (now <b class="gold">×${fmt(Math.pow(TREE_LEVEL_BONUS, L), 2)}</b>)</p>
        ${st < 10 ? `<p class="small dim">At the ${esc(STAGES[st + 1].name)} stage: ${esc(STAGE_UNLOCKS[st + 1])}.</p>` : ''}
        ${maxed ? '<p class="gold">The World Tree stands complete. Bind a realm in the Rebirth tab.</p>'
            : `<button id="tree-nourish" class="big-btn green" ${s.motes < cost ? 'disabled' : ''}>Nourish · ${fmt(cost)}</button>`}
    </div>`;
    const key = `${L}|${s.motes >= cost}|${st}`;
    if (keys.tree !== key) { keys.tree = key; $('tree-card').innerHTML = html; }
    if (keys.stages !== st) {
        keys.stages = st;
        $('stage-list').innerHTML = STAGES.map((x, i) => `<li class="${i < st ? 'done' : i === st ? 'now' : 'future'}"><b>${esc(x.name)}</b><span>${i * 10 === 0 ? 'the beginning' : `level ${i * 10}`}: ${esc(STAGE_UNLOCKS[i])}</span></li>`).join('');
    }
    showAuto('tree');
}

// ------------------------------------------------------------------ magic
function refreshMagic() {
    const s = G.s, d = G.derive();
    const open = G.spellsOpen();
    $('sap-card').innerHTML = open
        ? `<div class="card"><b>🍯 Sap</b> <span class="gold">${Math.floor(s.sap)} / ${Math.floor(d.sapMax)}</span> <span class="dim small">· +${(d.sapRegen * (G.seasonIndex() === 3 ? 1 + d.seasonPower : 1)).toFixed(2)}/s</span>
            <div class="sapbar"><i style="width:${(s.sap / d.sapMax) * 100}%"></i></div>
            <span class="dim small">Sap flows from the tree. Spend it on spells; a spell can't be recast while it is running.</span></div>`
        : `<div class="card"><b>Spells sleep in the sap.</b><p class="dim small">${s.trial === 'starless' ? 'No spells in the Starless Night trial.' : 'Grow the tree to the Seedling stage (level 20) to learn them.'}</p></div>`;
    const key = `${open}|${G.stage}|${s.trial}`;
    if (keys.spells !== key) {
        keys.spells = key;
        $('spell-list').innerHTML = SPELLS.map((sp) => `
            <div class="row ${G.stage < sp.stage || !open ? 'locked' : ''}">
                <div class="r-ico">${sp.icon}</div>
                <div><div class="r-name">${esc(sp.name)}</div><div class="r-desc">${G.stage < sp.stage ? `At the ${esc(STAGES[sp.stage].name)} stage` : esc(sp.desc)}</div></div>
                <button class="r-btn" data-spell="${sp.id}">🍯 ${G.spellCost(sp)}</button>
            </div>`).join('');
    }
    $('spell-list').querySelectorAll('[data-spell]').forEach((b) => {
        const id = b.dataset.spell;
        const running = s.buffs.find((x) => x.id === id);
        b.disabled = !G.canCast(id);
        b.textContent = running ? `${Math.ceil(running.until - s.t)}s` : `🍯 ${G.spellCost(SPELLS.find((x) => x.id === id))}`;
    });
    const wOpen = G.wispsOpen();
    $('wisp-card').innerHTML = wOpen
        ? `Golden wisps drift through the grove every few minutes (${(1 / d.wispFreq * 100).toFixed(0)}% of the usual wait). Touch one before it fades for a gift:<br>
           ${WISP_KINDS.map((k) => `<span class="dim small">· <b class="mint">${k.name}</b>: ${k.desc}</span>`).join('<br>')}
           <br><span class="small">Caught: <b class="gold">${s.stats.wisps}</b></span>`
        : '<span class="dim">Wisps come once the seed has sprouted.</span>';
    $('season-card').innerHTML = SEASONS.map((x, i) => `<div class="${i === G.seasonIndex() ? 'gold' : 'dim'} small">${x.icon} <b>${x.name}</b>: ${x.desc}${d.seasonPower > 1 ? ' (doubled)' : ''}${i === G.seasonIndex() ? ` · ${fmtTime(G.seasonLeft())} left` : ''}</div>`).join('');
    $('buff-list').innerHTML = s.buffs.length ? s.buffs.map((b) => `<div class="small">✦ <b class="gold">${esc(b.name)}</b> ×${fmt(b.mult, 1)} · ${Math.ceil(b.until - s.t)}s</div>`).join('') : '<span class="dim small">None right now.</span>';
}

// ------------------------------------------------------------------ rebirth
function refreshRebirth() {
    const s = G.s;
    const gain = G.hwGain();
    const can = G.canRebirth();
    let card;
    if (s.trial) {
        const t = TRIALS.find((x) => x.id === s.trial);
        const done = s.trialsDone[s.trial];
        card = `<div class="big-card"><h3>Trial: ${esc(t.name)}</h3><p class="small">${esc(t.rule)}</p>
            <p class="small">Goal: grow a <b class="gold">${esc(STAGES[t.goal].name)}</b> (level ${t.goal * 10}). ${done ? '<b class="mint">Complete!</b>' : ''}</p>
            <p class="small dim">Reward: ${esc(t.reward)}</p>
            <p class="small">Leaving the trial is a rebirth${gain ? ` worth <b class="gold">${fmt(gain)}</b> heartwood` : ''}.</p>
            <button id="btn-abandon" class="big-btn ${done ? 'green' : ''}">${done ? 'Claim and be reborn' : 'Leave the trial'}</button></div>`;
    } else {
        card = `<div class="big-card"><h3>Rebirth</h3>
            <p class="small">The tree drops a seed and the grove begins again, but heartwood stays: every heartwood ever earned gives <b class="gold">+${HW_BONUS * 100}%</b> production for good, and spends on lasting gifts below.</p>
            ${can ? `<div class="big-num">+${fmt(gain)} 🪵</div><p class="small dim">The taller the tree, the more heartwood: level ${s.tree + 1} would give ${fmt(G.hwForLevel(s.tree + 1))}.</p>`
                : `<p class="small dim">Grow a <b>${esc(STAGES[REBIRTH_STAGE].name)}</b> (tree level ${REBIRTH_STAGE * 10}) to be reborn.</p>`}
            <button id="btn-rebirth" class="big-btn purple" ${can ? '' : 'disabled'}>Be reborn</button>
            <p class="small dim">Heartwood bonus now: ×${fmt(1 + HW_BONUS * s.hwEarned, 2)} · Rebirths: ${s.rebirths}</p></div>`;
    }
    const key = `${s.trial}|${can}|${gain}|${s.rebirths}|${s.trialsDone[s.trial]}|${s.tree}`;
    if (keys.rb !== key) { keys.rb = key; $('rebirth-card').innerHTML = card; }
    $('hw-have').textContent = `· ${fmt(s.hw)} to spend`;
    const hwKey = HEARTWOOD.map((h) => G.hwLevel(h.id)).join(',') + '|' + Math.floor(s.hw);
    if (keys.hw !== hwKey) {
        keys.hw = hwKey;
        $('hw-list').innerHTML = HEARTWOOD.map((h) => {
            const l = G.hwLevel(h.id), max = l >= h.max, c = max ? 0 : h.cost(l);
            return `<div class="row ${max ? 'done' : ''}"><div class="r-ico">${h.icon}</div>
                <div><div class="r-name">${esc(h.name)} ${h.max > 1 && h.max < 999 ? `<span class="dim small">${l}/${h.max}</span>` : h.max === 999 ? `<span class="dim small">lv ${l}</span>` : ''}</div>
                <div class="r-desc">${l ? esc(h.desc(l)) : ''}${!max ? `${l ? '<br>' : ''}Next: ${esc(h.next(l))}` : ''}</div></div>
                <button class="r-btn" data-hw="${h.id}" ${max || s.hw < c ? 'disabled' : ''}>${max ? '✓' : `🪵 ${fmt(c)}`}</button></div>`;
        }).join('');
    }
    // trials
    const tKey = `${G.trialsOpen()}|${s.trial}|${Object.keys(s.trialsDone).join()}|${Math.floor(Math.log10(1 + s.hwEarned) * 10)}`;
    if (keys.trials !== tKey) {
        keys.trials = tKey;
        $('trial-list').innerHTML = !G.trialsOpen() ? '<div class="card dim small">Trials open after your first rebirth: a cycle under a hard rule, for a lasting reward.</div>'
            : TRIALS.map((t) => {
                const done = s.trialsDone[t.id], open = G.trialOpen(t.id);
                return `<div class="row ${done ? 'done' : open ? '' : 'locked'}"><div class="r-ico">${done ? '🏅' : '⚖️'}</div>
                    <div><div class="r-name">${esc(t.name)}</div><div class="r-desc">${esc(t.rule)} Goal: ${esc(STAGES[t.goal].name)}.<br><span class="mint">Reward: ${esc(t.reward)}</span>${open ? '' : `<br>Needs ${fmt(t.needs)} heartwood earned.`}</div></div>
                    <button class="r-btn" data-trial="${t.id}" ${done || !open || s.trial ? 'disabled' : ''}>${done ? '✓' : s.trial === t.id ? 'Active' : 'Begin'}</button></div>`;
            }).join('');
    }
    const rKey = `${s.realms.join()}|${G.treeMaxed()}|${s.trial}`;
    if (keys.realms !== rKey) {
        keys.realms = rKey;
        $('realm-list').innerHTML = `<div class="card small dim">When the tree becomes the World Tree, bind one of the nine realms to its branches. Binding is a rebirth that also grants the realm's blessing forever, but each realm bound makes the tree ×30 hungrier.</div>`
            + REALMS.map((r) => {
                const bound = s.realms.includes(r.id);
                return `<div class="row ${bound ? 'done' : ''}"><div class="r-ico" style="color:#${r.color.toString(16).padStart(6, '0')}">${bound ? '🌍' : '◈'}</div>
                    <div><div class="r-name">${esc(r.name)}</div><div class="r-desc">${esc(r.desc)}</div></div>
                    <button class="r-btn" data-realm="${r.id}" ${bound || !G.canBindRealm(r.id) ? 'disabled' : ''}>${bound ? 'Bound' : 'Bind'}</button></div>`;
            }).join('');
    }
}

// ------------------------------------------------------------------ journal
function refreshJournal() {
    const s = G.s;
    const body = $('journal-body');
    if (journalView === 'ach') {
        const key = `ach|${G.achCount()}|${selAch}`;
        if (keys.journal === key) return;
        keys.journal = key;
        const a = selAch && ACHIEVEMENTS.find((x) => x.id === selAch);
        body.innerHTML = `<div class="card" id="ach-detail">${a ? `<b class="${s.ach[a.id] ? 'gold' : ''}">${esc(a.name)}</b> ${s.ach[a.id] ? '✓' : ''}<br><span class="small dim">${esc(a.cat === 'secret' && !s.ach[a.id] ? 'A secret of the grove.' : a.desc)}</span>`
            : `<b>${G.achCount()} / ${ACHIEVEMENTS.length}</b> achievements · each one makes the grove's Radiance upgrades stronger.<br><span class="small dim">Tap one for details.</span>`}</div>
            <div class="ach-grid">${ACHIEVEMENTS.map((x) => `<button class="ach ${s.ach[x.id] ? 'got' : ''} ${selAch === x.id ? 'sel' : ''}" data-id="${x.id}" title="${esc(x.name)}">${ACH_ICON[x.cat] || '✦'}</button>`).join('')}</div>`;
    } else if (journalView === 'stats') {
        keys.journal = null;
        const d = G.derive();
        const rows = [
            ['Motes now', fmtLong(s.motes)], ['Motes this cycle', fmt(s.runMotes)], ['Motes ever', fmt(s.totalMotes)],
            ['Motes per second', fmt(G.mps())], ['Best motes per second', fmt(s.stats.bestMps)], ['Per touch', fmt(G.clickValue())],
            ['Touches', fmt(s.stats.clicks)], ['Motes from touches', fmt(s.stats.clickMotes)], ['Spirits', fmt(s.gens.reduce((x, y) => x + y, 0))],
            ['Upgrades', `${Object.keys(s.ups).length} / ${UPGRADES.length}`], ['Tree level', `${s.tree} (best stage: ${STAGES[s.bestStage].name})`],
            ['Global multiplier', `×${fmt(d.global, 2)}`], ['Wisps caught', fmt(s.stats.wisps)], ['Spells cast', fmt(s.stats.spells)],
            ['Rebirths', fmt(s.rebirths)], ['Heartwood earned', fmt(s.hwEarned)], ['Realms bound', `${s.realms.length} / 9`],
            ['Trials completed', `${Object.keys(s.trialsDone).length} / ${TRIALS.length}`], ['Time in this cycle', fmtTime(s.runT)],
            ['Time playing', fmtTime(s.stats.playTime)], ['Grove age', fmtTime(s.t)], ['Motes gathered while away', fmt(s.stats.offlineMotes)],
            ['Offline production', `${Math.round(d.offlineEff * 100)}% for up to ${d.offlineHours} h`], ['Longest time away', fmtTime(s.stats.longestAway)],
        ];
        body.innerHTML = `<table class="stats">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
    } else {
        const key = `lore|${s.bestStage}`;
        if (keys.journal === key) return;
        keys.journal = key;
        body.innerHTML = STAGES.slice(0, s.bestStage + 1).map((x) => `<div class="lore-entry"><b>${esc(x.name)}</b><p>${esc(x.lore)}</p></div>`).join('')
            + (s.bestStage < 10 ? '<p class="dim small">More of the story grows with the tree.</p>' : '');
    }
}

// ------------------------------------------------------------------ HUD
let lastMotesText = '';
export function refreshHUD() {
    const s = G.s;
    const t = fmt(s.motes);
    if (t !== lastMotesText) { lastMotesText = t; $('motes').textContent = t; }
    $('mps').textContent = fmt(G.mps());
    $('click-val').textContent = fmt(G.clickValue());
    const se = G.season();
    $('season-ico').textContent = se.icon;
    $('season-name').textContent = se.name;
    $('season-left').textContent = fmtTime(G.seasonLeft());
    $('stage-name').textContent = STAGES[G.stage].name;
    $('stage-lv').textContent = `${s.tree}`;
    const sapOpen = G.spellsOpen();
    $('sap-chip').hidden = !sapOpen;
    if (sapOpen) $('sap-val').textContent = `${Math.floor(s.sap)}`;
    const tr = s.trial && TRIALS.find((x) => x.id === s.trial);
    $('trial-chip').hidden = !tr;
    if (tr) $('trial-chip').textContent = `⚖️ ${tr.name}${s.trialsDone[tr.id] ? ' ✓' : ''}`;
    // buffs
    const bk = s.buffs.map((b) => b.id).join();
    const box = $('buffs');
    if (box.dataset.k !== bk) {
        box.dataset.k = bk;
        box.innerHTML = s.buffs.map((b) => `<div class="buff" data-b="${b.id}"><span>${esc(b.name)} ×${fmt(b.mult, 1)}</span><span class="tl"></span><i class="bar"></i></div>`).join('');
    }
    s.buffs.forEach((b) => {
        const el = box.querySelector(`[data-b="${b.id}"]`);
        if (!el) return;
        el.querySelector('.tl').textContent = `${Math.ceil(b.until - s.t)}s`;
        el.querySelector('.bar').style.width = `${Math.max(0, (b.until - s.t) / b.dur) * 100}%`;
    });
    // nourish button
    const nb = $('nourish-btn');
    const maxed = G.treeMaxed();
    const cost = maxed ? 0 : G.treeCost();
    const frac = maxed ? 1 : Math.min(1, s.motes / cost);
    $('nourish-ring').style.strokeDashoffset = String(276.5 * (1 - frac));
    $('nourish-cost').textContent = maxed ? 'World Tree' : fmt(cost);
    nb.classList.toggle('ready', !maxed && s.motes >= cost);
    nb.classList.toggle('maxed', maxed);
    nb.disabled = maxed;
    // badges
    const nUps = G.availableUpgrades().filter((u) => u.cost <= s.motes).length;
    badge('badge-ups', nUps);
    badge('badge-rebirth', (G.canRebirth() && !s.trial && G.hwGain() >= Math.max(1, s.hwEarned * 0.5)) || (s.trial && s.trialsDone[s.trial]) || G.treeMaxed() ? '!' : 0);
    // magic / rebirth tabs dim until they matter
    $('tab-magic').classList.toggle('locked', G.stage < 2 && !s.rebirths);
    $('tab-rebirth').classList.toggle('locked', G.stage < 4 && !s.rebirths);
}
function badge(id, v) { const b = $(id); b.hidden = !v; if (v) b.textContent = String(v); }

/** Patch the open pane. `force` also rebuilds keyed lists. */
export function refresh(force) {
    if (!G) return;
    if (force) for (const k in keys) delete keys[k];
    refreshHUD();
    if ($('panel-body').offsetParent === null) return;     // sheet folded away
    if (tab === 'grove') refreshGens();
    else if (tab === 'ups') refreshUps();
    else if (tab === 'tree') refreshTree();
    else if (tab === 'magic') refreshMagic();
    else if (tab === 'rebirth') refreshRebirth();
    else if (tab === 'journal') refreshJournal();
}

// ------------------------------------------------------------------ floaters, toasts, lore, flash
export function floater(x, y, text, cls = '') {
    if (!settings.floaters) return;
    const box = $('floaters');
    if (box.childElementCount > 40) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    el.style.left = `${x + (Math.random() - 0.5) * 24}px`;
    el.style.top = `${y}px`;
    box.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

export function toast(icon, title, text, ms = 3600) {
    const box = $('toasts');
    while (box.childElementCount >= 4) box.lastElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="t-i">${icon}</span><div><b>${esc(title)}</b>${esc(text)}</div>`;
    box.prepend(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
}

export function lore(title, text) {
    const el = $('lore-banner');
    el.hidden = true;
    void el.offsetWidth;          // restart the animation
    $('lore-title').textContent = title;
    $('lore-text').textContent = text;
    el.hidden = false;
    clearTimeout(lore.t);
    lore.t = setTimeout(() => { el.hidden = true; }, 6200);
}

export function flash() {
    const f = $('flash');
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 120);
}

// ------------------------------------------------------------------ modal
let modalClose = null;
export function modal(html, buttons = [{ label: 'OK' }], onClose) {
    $('modal-body').innerHTML = html;
    const row = $('modal-buttons');
    row.innerHTML = '';
    buttons.forEach((b) => {
        const el = document.createElement('button');
        el.className = `big-btn ${b.cls || ''}`;
        el.textContent = b.label;
        el.addEventListener('click', () => { act.ui(); closeModal(); b.fn?.(); });
        row.appendChild(el);
    });
    modalClose = onClose || null;
    $('modal').hidden = false;
}
export function closeModal() { $('modal').hidden = true; const f = modalClose; modalClose = null; f?.(); }
export function modalOpen() { return !$('modal').hidden; }
