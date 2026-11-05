// The DOM layer: screens, the HUD, radar, boss bar, radio, story pages, the hangar. Reads the sim; never changes it.

import { VERSION } from './config.js';
import { LEVELS, BOSSES, TRACKS, TRACK_INFO, COSTS, MAX_TIER, WEAPONS, MISSILES, ARMOR, FUEL, LEGS } from './sim/data.js';
import { WHO, RADIO, BRIEFING, LEVEL_END, ENDING, PROLOGUE } from './sim/story.js';
import { tierCost } from './sim/game.js';

const $ = (id) => document.getElementById(id);

export const describe = (track, t) => {
    switch (track) {
        case 'guns': { const w = WEAPONS[t]; return `${w.name} · ${w.dmg} dmg × ${w.rate}/s${w.barrels > 1 ? ` · ${w.barrels} barrels` : ''}${w.pierce ? ' · pierces' : ''}${w.splash ? ' · blast' : ''}`; }
        case 'missiles': { const m = MISSILES[t]; return `${m.name} · ${m.ammo} rockets · salvo of ${m.salvo}${m.homing ? ' · seeking' : ''}${m.cluster ? ' · cluster' : ''}`; }
        case 'armor': { const a = ARMOR[t]; return `${a.hp} armour · ${Math.round(a.dr * 100)}% less damage`; }
        case 'fuel': { const f = FUEL[t]; return `${f.cap} fuel · refuels ${f.regen}/s`; }
        default: { const l = LEGS[t]; return `speed ${l.speed} · climbs slope ${l.climb} · steps over ${l.clear} m · landing ${l.stomp} dmg`; }
    }
};
const NAMES = {
    guns: (t) => WEAPONS[t].name, missiles: (t) => MISSILES[t].name,
    armor: (t) => ['Survey plating', 'Bolt-on plates', 'Skirted hull', 'Glacis & pauldrons', 'Spiked bulwark', 'Reactive aegis'][t],
    fuel: (t) => ['Survey tank', 'Twin tank', 'Triple cells', 'Pressure cells', 'Long-burn cells', 'Fusion reservoir'][t],
    legs: (t) => ['Survey legs', 'Reinforced legs', 'Piston legs', 'Hydraulic legs', 'Siege legs', 'Titan legs'][t],
};

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio; this.settings = settings;
        this.stack = []; this.touchOn = false;
        $('version').textContent = 'v' + VERSION;
        this.radioQ = []; this.radioT = 0; this.hurtT = 0; this.bossShown = false;
        this.radar = $('radar').getContext('2d');

        // A press that began outside a screen (the finger that opened it) must not click inside it when it
        // lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), gfx = $('set-gfx');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; gfx.value = settings.gfx;
        const changed = () => {
            const gchanged = settings.gfx !== gfx.value;
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, gfx: gfx.value });
            if (gchanged) $('gfx-hint').hidden = false;
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, gfx]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another appears above it
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { const l = this.buttons(id); (l.find((b) => b.classList.contains('primary')) || l[0])?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ story, briefing, report, endings
    story(pages, onDone) {
        let i = 0;
        const show = () => {
            const p = pages[i], w = WHO[p.who];
            $('story-icon').textContent = w.icon; $('story-who').textContent = w.name; $('story-who').style.color = w.col; $('story-text').textContent = p.text;
            $('story-count').textContent = `${i + 1} / ${pages.length}`;
            $('story-next').textContent = i === pages.length - 1 ? 'Begin' : 'Next';
        };
        $('story-next').onclick = () => { this.audio.ui('click'); if (++i >= pages.length) { this.closeScreen('story'); onDone(); } else show(); };
        $('story-skip').onclick = () => { this.audio.ui('click'); this.closeScreen('story'); onDone(); };
        show(); this.openScreen('story');
    }
    brief(G, onGo) {
        const lv = LEVELS[G.level];
        $('brief-num').textContent = `MISSION ${G.level + 1} OF ${LEVELS.length}`;
        $('brief-name').textContent = lv.name; $('brief-sub').textContent = lv.sub;
        $('brief-text').textContent = BRIEFING[lv.id];
        const rig = $('brief-rig'); rig.textContent = '';
        for (const t of TRACKS) { const s = document.createElement('span'); s.textContent = `${TRACK_INFO[t].icon} ${NAMES[t](G.upg[t])}`; rig.appendChild(s); }
        $('brief-go').onclick = () => { this.audio.ui('click'); this.closeScreen('brief'); onGo(); };
        this.openScreen('brief');
    }
    report(G, onNext) {
        const r = G.report, lv = LEVELS[r.level];
        $('report-name').textContent = lv.name;
        $('report-text').textContent = LEVEL_END[lv.id] || '';
        const rows = [['Time', fmtTime(r.time)], ['Enemies destroyed', r.kills], ['Colonists freed here', r.rescued], ['Scrap gathered', r.scrapGot], ['Damage taken', Math.round(r.taken)], ['Bonus', r.bonus], ['Score', r.score]];
        $('report-table').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
        $('report-next').onclick = () => { this.audio.ui('click'); this.closeScreen('report'); onNext(); };
        this.openScreen('report');
    }
    dead(G, onRetry, onQuit) {
        $('dead-name').textContent = LEVELS[G.level].name;
        $('dead-text').textContent = `Deaths so far: ${G.deaths}. You keep your upgrades, and the mission starts again from its first step.`;
        $('dead-retry').onclick = () => { this.audio.ui('click'); this.closeScreen('dead'); onRetry(); };
        $('dead-quit').onclick = () => { this.audio.ui('click'); this.closeScreen('dead'); onQuit(); };
        this.openScreen('dead');
    }
    ending(G, best, onDone) {
        const total = LEVELS.reduce((s, l) => s + l.pods, 0);
        const frac = G.podsFreed / total;
        const lines = ENDING[frac > 0.75 ? 'high' : frac > 0.4 ? 'mid' : 'low'];
        $('ending-text').innerHTML = lines.map((t) => `<p>${t}</p>`).join('');
        const rows = [['Colonists rescued', G.rescued], ['Cages opened', `${G.podsFreed} / ${total}`], ['Enemies destroyed', G.kills], ['Walker destroyed', G.deaths], ['Final score', G.score], ['Best score', best.score]];
        $('ending-table').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
        $('ending-done').onclick = () => { this.audio.ui('click'); this.closeScreen('ending'); onDone(); };
        this.openScreen('ending');
    }

    // ------------------------------------------------------------------ hangar
    hangar(G, onBuy, onGo) {
        this.hangarCtx = { G, onBuy, onGo };
        $('hangar-go').onclick = () => { this.audio.ui('click'); this.closeScreen('hangar'); onGo(); };
        this.renderHangar();
        this.openScreen('hangar');
    }
    renderHangar() {
        const { G, onBuy } = this.hangarCtx;
        $('hangar-scrap').textContent = G.scrap;
        $('hangar-info').textContent = `Next: ${LEVELS[Math.min(G.level + 1, LEVELS.length - 1)].name}. Every upgrade makes the walker physically bigger.`;
        const box = $('hangar-cards'); box.textContent = '';
        for (const t of TRACKS) {
            const tier = G.upg[t], cost = tierCost(G, t), card = document.createElement('div');
            card.className = 'card';
            const pips = Array.from({ length: MAX_TIER }, (_, i) => `<b class="${i < tier ? 'on' : ''}"></b>`).join('');
            card.innerHTML = `<h3><span>${TRACK_INFO[t].icon}</span>${TRACK_INFO[t].name}</h3><div class="pips">${pips}</div><div class="cur">${NAMES[t](tier)}</div><div class="nxt">${cost === null ? 'Fully upgraded.' : `Next: <b>${NAMES[t](tier + 1)}</b><br>${describe(t, tier + 1)}`}</div>`;
            const btn = document.createElement('button');
            btn.className = 'btn' + (cost !== null && G.scrap >= cost ? ' primary' : ''); btn.dataset.track = t;
            btn.textContent = cost === null ? 'MAX' : `Upgrade · ⚙ ${cost}`;
            btn.disabled = cost === null;
            btn.setAttribute('aria-disabled', cost === null || G.scrap < cost ? 'true' : 'false');
            btn.addEventListener('click', () => { const r = onBuy(t); if (!r.ok) { this.audio.ui('deny'); this.toast(r.reason === 'scrap' ? 'Not enough scrap.' : 'Already maxed.'); } this.renderHangar(); this.buttons('hangar').find((b) => b.dataset.track === t)?.focus({ preventScroll: true }); });
            card.appendChild(btn); box.appendChild(card);
        }
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; $('reticle').hidden = !on; this.setTouch(this.touchOn, on); if (!on) { $('radio').hidden = true; this.radioQ.length = 0; $('boss-bar').hidden = true; this.bossShown = false; } }
    setTouch(on, playing = !$('hud').hidden) { this.touchOn = on; $('touch').hidden = !(on && playing); }
    hud(G, dt) {
        const p = G.player, st = G.st, lv = LEVELS[G.level];
        const hpf = Math.max(0, p.hp / st.maxHp);
        $('hp-fill').style.width = `${hpf * 100}%`; $('hp-text').textContent = `${Math.ceil(p.hp)} / ${st.maxHp}`;
        $('hp-fill').parentElement.classList.toggle('low', hpf < 0.3);
        $('fuel-fill').style.width = `${(p.fuel / st.fuelMax) * 100}%`;
        const pips = $('msl-pips'), n = st.msl.ammo;
        if (pips.childElementCount !== n) pips.innerHTML = '<b></b>'.repeat(n);
        for (let i = 0; i < n; i++) pips.children[i].classList.toggle('on', i < Math.floor(p.missiles));
        $('hud-scrap').textContent = G.scrap; $('hud-rescued').textContent = G.rescued;
        $('hud-level').textContent = `${G.level + 1}. ${lv.name.toUpperCase()}`;
        $('prog-fill').style.width = `${Math.min(100, Math.max(0, (-p.z / lv.length) * 100))}%`;
        const v = $('vignette');
        v.classList.toggle('low', hpf < 0.3 && p.hp > 0);
        this.hurtT = Math.max(0, this.hurtT - dt); v.classList.toggle('hurt', this.hurtT > 0);
        // boss bar
        const boss = G.enemies.find((e) => e.b && (e.awake || e.b.dying > 0));
        const bb = $('boss-bar');
        if (boss && (boss.hp > 0 || boss.b.dying > 0)) {
            const def = BOSSES[boss.type];
            if (!this.bossShown) {
                this.bossShown = true; bb.hidden = false; $('boss-name').textContent = def.name;
                $('boss-phases').innerHTML = def.phases.map(() => '<b></b>').join('');
            }
            $('boss-fill').style.width = `${Math.max(0, boss.hp / boss.maxhp) * 100}%`;
            $('boss-shield').style.display = boss.b.shield || boss.b.trans > 0 ? 'block' : 'none';
            [...$('boss-phases').children].forEach((c, i) => { c.className = i < boss.b.ph ? 'done' : i === boss.b.ph ? 'now' : ''; });
        } else if (this.bossShown) { this.bossShown = false; bb.hidden = true; }
        // radio queue
        if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) $('radio').hidden = true; }
        if (this.radioT <= 0 && this.radioQ.length) this.showRadio(this.radioQ.shift());
        this.drawRadar(G);
    }
    showRadio(id) {
        const r = RADIO[id]; if (!r) return;
        const w = WHO[r.who];
        $('radio-icon').textContent = w.icon; $('radio-who').textContent = w.name; $('radio-who').style.color = w.col; $('radio-text').textContent = r.text;
        $('radio').hidden = false; this.radioT = 2.6 + r.text.length * 0.045;
        if (window.A11Y) window.A11Y.announce(`${w.name}: ${r.text}`);
    }
    drawRadar(G) {
        const c = this.radar, W = 120, R = 56, range = 75, p = G.player;
        c.clearRect(0, 0, W, W);
        c.strokeStyle = 'rgba(109,255,154,0.25)'; c.lineWidth = 1;
        for (const r of [R, R * 0.66, R * 0.33]) { c.beginPath(); c.arc(60, 60, r, 0, 6.3); c.stroke(); }
        c.beginPath(); c.moveTo(60, 4); c.lineTo(60, 116); c.moveTo(4, 60); c.lineTo(116, 60); c.stroke();
        const pt = (x, z) => { const dx = (x - p.x) / range * R, dz = (z - p.z) / range * R; const d = Math.hypot(dx, dz); const k = d > R - 3 ? (R - 3) / d : 1; return [60 + dx * k, 60 + dz * k, d > R - 3]; };
        for (const pod of G.pods) { if (pod.freed) continue; const [x, y] = pt(pod.x, pod.z); c.strokeStyle = '#ffb62e'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 4, 0, 6.3); c.stroke(); }
        for (const e of G.enemies) {
            if (e.hp <= 0 || (e.b && e.b.under)) continue;
            const [x, y, edge] = pt(e.x, e.z); if (edge && !e.awake) continue;
            c.fillStyle = e.type === 'pylon' ? '#7ae8ff' : e.awake ? '#ff5a4a' : '#a04a44';
            c.beginPath(); c.arc(x, y, e.b ? 5 : e.r > 1.5 ? 3.5 : 2.2, 0, 6.3); c.fill();
        }
        for (const m of G.marks) { if (m.kind === 'drop') continue; const [x, y] = pt(m.x, m.z); c.strokeStyle = 'rgba(255,90,60,0.8)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, Math.max(2, m.r / range * R), 0, 6.3); c.stroke(); }
        c.fillStyle = '#6dff9a'; c.save(); c.translate(60, 60); c.rotate(p.yaw); c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill(); c.restore();
    }
    reticle(x, y, on) { const r = $('reticle'); r.style.display = on ? '' : 'none'; if (on) { r.style.left = `${x}px`; r.style.top = `${y}px`; } }

    toast(text) {
        const el = document.createElement('div'); el.className = 'toast'; el.textContent = text; $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2700);
    }
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'radio') { if (this.radioQ.length < 3) this.radioQ.push(e.id); }
            else if (e.type === 'hurt') this.hurtT = 0.18;
            else if (e.type === 'rescue') this.toast(`${e.n} colonists freed!${e.first ? ' Orange pods hold more.' : ''}`);
            else if (e.type === 'bossStart') this.toast(`${e.name}: ${e.title}`);
            else if (e.type === 'bossPhase') this.toast(`Phase ${e.ph + 1}!`);
            else if (e.type === 'shieldDown') this.toast('Shield down! It is stunned: hit it!');
            else if (e.type === 'ambush') this.toast('Drop pods incoming!');
            else if (e.type === 'gateOpen') this.toast('The gate is open.');
            else if (e.type === 'pickup' && e.kind === 'hp') this.toast('Armour repaired');
        }
    }
}
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export { PROLOGUE, COSTS };
