/**
 * ui.js — HUD updates, message log, and village build panel.
 * All DOM — no Three.js or Kaplay.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { BUILDING_DEFS, SELL_PRICES, WEAPON_DEFS, POTION_COST_HERBS } from './config.js';
import { playUiClick, playBuild, playGoldPickup } from './sounds.js';

// ---- DOM refs ----
const barHp       = document.getElementById('bar-hp');
const barXp       = document.getElementById('bar-xp');
const statHpText  = document.getElementById('stat-hp-text');
const statXpText  = document.getElementById('stat-xp-text');
const statLevel   = document.getElementById('stat-level');
const statGold    = document.getElementById('stat-gold');
const resWood     = document.getElementById('res-wood');
const resStone    = document.getElementById('res-stone');
const resIron     = document.getElementById('res-iron');
const resHerbs    = document.getElementById('res-herbs');
const hudMode     = document.getElementById('hud-mode');
const msgLog      = document.getElementById('msg-log');
const buildPanel  = document.getElementById('build-panel');
const buildList   = document.getElementById('build-list');
const buildClose  = document.getElementById('build-close');

// ---- Message log ----
const MAX_MSGS = 5;
let msgTimeouts = [];

function pushMsg(text, color = '#aaccaa') {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.color = color;
    el.style.opacity = '1';
    el.style.transition = 'opacity 0.5s';
    msgLog.prepend(el);

    // Fade out after 3s
    const t = setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
    }, 3000);
    msgTimeouts.push(t);

    // Trim to MAX_MSGS
    while (msgLog.children.length > MAX_MSGS) {
        msgLog.lastChild.remove();
    }
}

// ---- Build panel ----
function buildBuildPanel() {
    buildList.innerHTML = '';
    for (const def of BUILDING_DEFS) {
        const lvl  = state.getBuildingLevel(def.id);
        const maxed = lvl >= def.maxLevel;
        const nextLvl = lvl + 1;

        // Scale cost
        const scaledCost = {};
        for (const [k, v] of Object.entries(def.cost)) {
            scaledCost[k] = Math.ceil(v * Math.pow(1.8, lvl));
        }
        const costStr = Object.entries(scaledCost)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ') || 'Free';

        const canAfford = state.canAfford(scaledCost);

        const row = document.createElement('div');
        row.className = 'build-item';
        row.innerHTML = `
            <div>
                <div class="b-name">${def.emoji} ${def.name} ${lvl > 0 ? `<span style="color:#88ddff;font-size:11px">(Lv ${lvl})</span>` : ''}</div>
                <div class="b-cost">${maxed ? 'MAX LEVEL' : `Cost: ${costStr}`}</div>
                <div class="b-desc">${def.desc}</div>
            </div>
            <button data-id="${def.id}" ${maxed || !canAfford ? 'disabled' : ''}>${maxed ? 'Built' : lvl === 0 ? 'Build' : 'Upgrade'}</button>
        `;
        buildList.appendChild(row);
    }

    buildList.querySelectorAll('button[data-id]:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const ok = state.upgradeBuilding(id);
            if (ok) {
                playBuild();
                const def = BUILDING_DEFS.find(b => b.id === id);
                const lvl = state.getBuildingLevel(id);
                events.emit('message', `${def.emoji} ${def.name} ${lvl === 1 ? 'built' : `upgraded to Lv ${lvl}`}!`, '#c8a844');
                buildBuildPanel(); // refresh
            }
        });
    });
}

function buildSellSection() {
    const marketLvl = state.getBuildingLevel('market');
    if (marketLvl < 1) return '';

    const sellMult = 1 + state.buildingBonus('sellBonus');
    const resources = ['wood','stone','iron','herbs'];
    let rows = '';
    for (const res of resources) {
        const amount = state.getResource(res);
        const price  = Math.ceil(SELL_PRICES[res] * sellMult);
        rows += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;">
            <span style="color:#88aa88;text-transform:capitalize;">${res}: <span style="color:#c8e8a0">${amount}</span></span>
            <span style="color:#c8a844;font-size:11px;">${price}g each</span>
            <button class="sell-btn" data-res="${res}" data-price="${price}" ${amount === 0 ? 'disabled' : ''} style="padding:2px 8px;font-size:11px;">Sell All</button>
        </div>`;
    }

    return `<div style="border-top:1px solid rgba(200,168,68,0.3);margin-top:10px;padding-top:10px;">
        <div style="color:#c8a844;font-size:11px;font-weight:bold;margin-bottom:6px;">MARKET — Sell Resources (×${sellMult.toFixed(2)})</div>
        ${rows}
    </div>`;
}

export function showBuildPanel() {
    buildBuildPanel();
    // Remove any existing sell section before re-appending
    const oldSell = document.getElementById('sell-section');
    if (oldSell) oldSell.remove();
    // Append sell section if market is built
    const sellHtml = buildSellSection();
    if (sellHtml) {
        const sellDiv = document.createElement('div');
        sellDiv.id = 'sell-section';
        sellDiv.innerHTML = sellHtml;
        // Insert before the Close button
        const closeBtn = document.getElementById('build-close');
        buildPanel.insertBefore(sellDiv, closeBtn);
        sellDiv.querySelectorAll('.sell-btn:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const res   = btn.dataset.res;
                const price = parseInt(btn.dataset.price);
                const amt   = state.getResource(res);
                if (amt <= 0) return;
                state.spendResource(res, amt);
                state.addGold(price * amt);
                playGoldPickup();
                events.emit('message', `Sold ${amt} ${res} for ${price * amt} gold.`, '#c8a844');
                showBuildPanel();  // refresh
            });
        });
    }
    buildPanel.style.display = 'block';
}

export function hideBuildPanel() {
    buildPanel.style.display = 'none';
}

// ---- Subscribe events ----
export function initUI() {
    // HP
    events.on('playerHpChanged', (hp, maxHp) => {
        const pct = (hp / maxHp * 100).toFixed(0);
        barHp.style.width = pct + '%';
        statHpText.textContent = `${hp}/${maxHp}`;
    });

    // XP
    events.on('playerXpChanged', (xp, xpNext) => {
        const pct = (xp / xpNext * 100).toFixed(0);
        barXp.style.width = pct + '%';
        statXpText.textContent = `${xp}/${xpNext}`;
    });

    // Level
    events.on('playerLevelUp', (lvl) => {
        statLevel.textContent = lvl;
        statXpText.textContent = `${state.xp}/${state.xpNext}`;
    });

    // Gold
    events.on('playerGoldChanged', (gold) => {
        statGold.textContent = gold;
    });

    // Resources
    const resEls = { wood: resWood, stone: resStone, iron: resIron, herbs: resHerbs };
    events.on('resourceChanged', (type, amount) => {
        if (resEls[type]) resEls[type].textContent = amount;
    });

    // Mode
    events.on('modeChanged', (mode) => {
        hudMode.textContent = mode === 'village' ? 'VILLAGE' : 'EXPLORING';
        hudMode.style.color = mode === 'village' ? '#88ddaa' : '#c8a844';
    });

    // Messages
    events.on('message', (text, color) => pushMsg(text, color));

    // Game over
    events.on('gameOver', () => {
        pushMsg('You have fallen!', '#e05555');
        const overlay = document.getElementById('game-over');
        if (overlay) overlay.style.display = 'flex';
    });

    // Weapon indicator
    const statWeapon = document.getElementById('stat-weapon');
    if (statWeapon) {
        events.on('weaponChanged', (type) => {
            statWeapon.textContent = WEAPON_DEFS[type]?.label || type;
        });
    }

    // Build panel close button
    buildClose.addEventListener('click', () => {
        playUiClick();
        hideBuildPanel();
    });
}
