import { state } from './state.js';
import { events } from './events.js';
import { SPEEDS } from './config.js';
import { buildUpgradeCard, TAB_UPGRADES } from './shop.js';
import { playUiClick } from './sounds.js';

let $gold, $floor, $roomVal, $roomTotal, $speedBtn, $muteBtn, $townBtn, $townOverlay, $townBody,
    $townClose, $logList, $partyStrip, $awayToast, $awayText, $awayDismiss;

let activeTab = 'heroes';
let displayedGold = 0; // for animated count-up
let getSpeedIndex = () => 0;
let onSpeedChange = () => {};

const MAX_LOG_LINES = 40;

export function initUI({ onSpeedToggle, onMuteToggle, getSpeedIdx }) {
    $gold = document.getElementById('gold-val');
    $floor = document.getElementById('floor-val');
    $roomVal = document.getElementById('room-val');
    $roomTotal = document.getElementById('room-total');
    $speedBtn = document.getElementById('speed-btn');
    $muteBtn = document.getElementById('mute-btn');
    $townBtn = document.getElementById('town-btn');
    $townOverlay = document.getElementById('town-overlay');
    $townBody = document.getElementById('town-body');
    $townClose = document.getElementById('town-close');
    $logList = document.getElementById('log-list');
    $partyStrip = document.getElementById('party-strip');
    $awayToast = document.getElementById('away-toast');
    $awayText = document.getElementById('away-text');
    $awayDismiss = document.getElementById('away-dismiss');

    getSpeedIndex = getSpeedIdx;
    onSpeedChange = onSpeedToggle;

    displayedGold = state.gold;
    $gold.textContent = displayedGold;
    updateMuteBtn();
    updateSpeedBtn();

    $speedBtn.addEventListener('click', () => { playUiClick(); onSpeedChange(); updateSpeedBtn(); });
    $muteBtn.addEventListener('click', () => {
        state.muted = !state.muted;
        if (!state.muted) playUiClick();
        updateMuteBtn();
        onMuteToggle(state.muted);
    });
    $townBtn.addEventListener('click', () => { playUiClick(); openTown(); });
    $townClose.addEventListener('click', () => { playUiClick(); closeTown(); });
    $townOverlay.addEventListener('click', (e) => { if (e.target === $townOverlay) closeTown(); });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUiClick();
            activeTab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderTownBody();
        });
    });

    events.on('goldChanged', () => { /* animated via rAF in tick() below */ });
    events.on('upgradePurchased', () => { renderTownBody(); renderPartyStrip(); });
    events.on('combatLog', (entry) => addLogLine(entry));
    events.on('roomCleared', () => { if (!$townOverlay.classList.contains('hidden')) renderTownBody(); });
}

export function updateSpeedBtn() {
    $speedBtn.textContent = SPEEDS[getSpeedIndex()] + 'x';
}
function updateMuteBtn() {
    $muteBtn.innerHTML = state.muted ? '&#128263;' : '&#128266;';
}

export function tickGoldDisplay(dt) {
    if (displayedGold === state.gold) return;
    const diff = state.gold - displayedGold;
    const step = Math.max(1, Math.ceil(Math.abs(diff) * Math.min(1, dt * 6)));
    displayedGold += Math.sign(diff) * Math.min(Math.abs(diff), step);
    $gold.textContent = Math.round(displayedGold);
}

export function setFloorRoom(floorNum, roomIdx, roomTotal) {
    $floor.textContent = floorNum;
    $roomVal.textContent = roomIdx + 1;
    $roomTotal.textContent = roomTotal;
}

export function renderPartyStrip(party) {
    if (!party) { $partyStrip.innerHTML = ''; return; }
    $partyStrip.innerHTML = '';
    for (const h of party) {
        const card = document.createElement('div');
        card.className = 'party-card' + (h.alive ? '' : ' dead');
        card.innerHTML = `
            <div class="name" style="color:${h.color}">${h.name}</div>
            <div class="hpbar"><div class="hpbar-fill" style="width:${Math.max(0, h.hp / h.maxHp * 100)}%"></div></div>
        `;
        $partyStrip.appendChild(card);
    }
}

function addLogLine(entry) {
    const line = document.createElement('div');
    line.className = 'log-entry' + (entry.kind && entry.kind !== 'normal' ? ' ' + entry.kind : '');
    line.textContent = entry.text;
    $logList.appendChild(line);
    while ($logList.children.length > MAX_LOG_LINES) $logList.removeChild($logList.firstChild);
    $logList.scrollTop = $logList.scrollHeight;
}

function openTown() {
    $townOverlay.classList.remove('hidden');
    renderTownBody();
}
function closeTown() {
    $townOverlay.classList.add('hidden');
}

function renderTownBody() {
    $townBody.innerHTML = '';
    const ids = TAB_UPGRADES[activeTab] || [];
    for (const id of ids) {
        $townBody.appendChild(buildUpgradeCard(id));
    }
}

export function showAwaySummary({ elapsedMs, floorsCleared, goldEarned, wiped }) {
    const hrs = elapsedMs / 3600000;
    const timeStr = hrs >= 1 ? `${hrs.toFixed(1)} hours` : `${Math.round(elapsedMs / 60000)} minutes`;
    $awayText.textContent =
        `You were gone for ${timeStr}.\n` +
        `Your party cleared ${floorsCleared} floor(s) and found ● ${goldEarned} gold.` +
        (wiped ? '\nThe party wiped at least once, but pressed on!' : '');
    $awayToast.classList.remove('hidden');
    $awayDismiss.onclick = () => { playUiClick(); $awayToast.classList.add('hidden'); };
}
