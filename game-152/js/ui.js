// The DOM layer: screens, the HUD, banners, comms, the skill tree, settings and the touch deck. Reads the sim
// and the meta save; buying skills goes through skills.js on the meta object main.js hands it.

import { VERSION, SECTOR, BOOSTS, FUEL, SECTORS } from './config.js';
import { SKILLS, SECTOR_DATA, BOSSES } from './sim/data.js';
import { nodeOf, blocked, nextCost, buy, respec, refundOne } from './sim/skills.js';
import { bossHpShare } from './sim/bosses.js';
import { LINES, CAST } from './lines.js';

const $ = (id) => document.getElementById(id);
const BOOST_NAMES = { overdrive: 'OVERDRIVE', spread: 'SPREAD', plasma: 'PLASMA', rapid: 'RAPID', shield: 'BARRIER', magnet: 'MAGNET' };

export class UI {
    constructor({ audio, settings, meta, onSettings, onDeleteSave, onResetAll, onMeta }) {
        this.audio = audio;
        this.settings = settings;
        this.meta = meta;
        this.onMeta = onMeta;
        this.stack = [];
        this.touchOn = false;
        this.commsT = 0;
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when the finger lifts (game-071)
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const ids = ['sfx', 'music', 'voice', 'touch', 'autofire'];
        for (const k of ids) $('set-' + k).value = settings[k];
        $('set-shake').checked = settings.shake;
        const changed = () => {
            for (const k of ids) settings[k] = ['sfx', 'music', 'voice'].includes(k) ? +$('set-' + k).value : $('set-' + k).value;
            settings.shake = $('set-shake').checked;
            onSettings(settings);
        };
        for (const k of ids) $('set-' + k).addEventListener('change', changed);
        $('set-shake').addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved run abandoned.'); });
        $('set-reset').addEventListener('click', () => {
            if (this._resetArmed) { onResetAll(); this._resetArmed = false; $('set-reset').textContent = 'Reset all progress (cores and skills)'; this.toast('All progress reset.'); }
            else { this._resetArmed = true; $('set-reset').textContent = 'Tap again to confirm the reset'; }
        });

        $('sk-respec').addEventListener('click', () => {
            respec(this.meta);
            audio.ui('close');
            this.onMeta();
            this.renderSkills();
            this.toast('Every core refunded.');
        });
        this.buildSkills();
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // stack order decides who is on top (game-088)
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        if (id === 'skills') this.renderSkills();
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
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length > 0); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ title / records
    refreshTitle(hasSave) {
        $('btn-continue').hidden = !hasSave;
        const m = this.meta;
        const tag = m.cores ? `◆ ${m.cores}` : '';
        for (const id of ['title-cores', 'dock-cores', 'over-cores']) $(id).textContent = tag;
        $('title-records').textContent = m.runs ? `Best ${m.best.toLocaleString()} · ${m.runs} run${m.runs > 1 ? 's' : ''} · ${m.wins} win${m.wins === 1 ? '' : 's'}` : 'Three sectors. Three fortresses. One boat.';
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); if (!on) $('comms').hidden = true; }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
        document.body.classList.toggle('touch', on);
    }
    setAutoFire(on) { $('btn-fire').classList.toggle('auto', on); $('btn-fire').textContent = on ? 'AUTO' : 'FIRE'; }

    hud(G, dt) {
        const b = G.boat, S = G.stats;
        $('hud-score').textContent = G.score.toLocaleString();
        $('hud-mult').hidden = G.mult <= 1;
        $('hud-mult').textContent = '×' + G.mult;
        $('hud-combo').hidden = G.combo < 3;
        $('hud-combo').textContent = G.combo + ' COMBO!';
        const sd = SECTOR_DATA[G.sector];
        $('hud-sector').textContent = `SECTOR ${G.sector + 1} · ${sd.name}`;
        $('prog-fill').style.width = Math.min(100, (b.y / SECTOR.length) * 100) + '%';
        $('g-hull').style.width = Math.max(0, (b.hull / S.maxHull) * 100) + '%';
        $('g-fuel').style.width = Math.max(0, (b.fuel / FUEL.max) * 100) + '%';
        document.querySelector('.gauge.fuel').classList.toggle('low', b.fuel < FUEL.low);
        document.querySelector('.gauge.hull').classList.toggle('low', b.hull < S.maxHull * 0.3);
        // jump pips
        const pips = $('g-jump');
        if (pips.children.length !== S.charges) {
            pips.innerHTML = '';
            for (let i = 0; i < S.charges; i++) { const p = document.createElement('div'); p.className = 'pip'; p.appendChild(document.createElement('i')); pips.appendChild(p); }
        }
        [...pips.children].forEach((p, i) => {
            const f = Math.max(0, Math.min(1, b.charge - i));
            p.firstChild.style.width = f * 100 + '%';
            p.classList.toggle('full', f >= 1);
        });
        $('g-msl').textContent = Math.floor(b.missiles);
        $('g-cores').textContent = G.cores;
        // boosts with timers
        const list = [];
        const mul = S.boostMul;
        if (b.overdriveT > 0) list.push(['overdrive', b.overdriveT / (BOOSTS.overdrive.time * mul)]);
        if (b.weapon) list.push([b.weapon, b.weaponT / (BOOSTS[b.weapon].time * mul)]);
        if (b.shield > 0) list.push(['shield', b.shieldT > 900 ? 1 : b.shieldT / (BOOSTS.shield.time * mul), b.shield]);
        if (b.magnetT > 0) list.push(['magnet', b.magnetT / (BOOSTS.magnet.time * mul)]);
        const key = list.map((q) => q[0] + (q[2] || '')).join();
        const box = $('hud-boosts');
        if (box.dataset.key !== key) {
            box.dataset.key = key;
            box.innerHTML = list.map(([k, , n]) => `<div class="boost" data-k="${k}">${BOOST_NAMES[k]}${n ? ' ×' + n : ''}<div class="t"><i></i></div></div>`).join('');
        }
        list.forEach(([k, f], i) => { const el = box.children[i]?.querySelector('i'); if (el) el.style.width = Math.max(0, Math.min(1, f)) * 100 + '%'; });
        // boss bar
        const B = G.boss;
        $('hud-boss').hidden = !B || B.entering;
        $('hud').classList.toggle('bossmode', !!B && !B.entering);
        if (B) {
            const d = BOSSES[B.key];
            $('boss-name').textContent = `${d.name} · ${d.title}`;
            const ph = d.phases[B.phase];
            $('boss-phase').textContent = d.mini ? 'MID-BOSS' : `${B.phase + 1}/${d.phases.length} ${ph.name || ''}`;
            $('boss-fill').style.width = bossHpShare(G) * 100 + '%';
            $('hud-boss').classList.toggle('od', !!ph.overdrive);
        }
        if (this.commsT > 0) { this.commsT -= dt; if (this.commsT <= 0) $('comms').hidden = true; }
    }

    banner(big, small = '', warn = false) {
        const el = $('banner');
        el.querySelector('.b1').textContent = big;
        el.querySelector('.b2').textContent = small;
        el.querySelector('.b2').hidden = !small;
        el.classList.toggle('warn', warn);
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    /** The comms box: portrait, name, subtitle. */
    say(id, secs = 3.2) {
        const L = LINES[id];
        if (!L) return;
        const c = CAST[L.who];
        $('comms-img').src = `art/por-${L.who}.webp`;
        $('comms-name').textContent = c.name;
        $('comms-name').style.color = c.color;
        $('comms-text').textContent = L.text;
        $('comms').hidden = false;
        this.commsT = secs;
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    // ------------------------------------------------------------------ dock and the end
    showDock(G) {
        const last = G.log[G.log.length - 1];
        const next = SECTOR_DATA[G.sector + 1];
        $('dock-text').innerHTML = `<div class="stats">
            <span>${last.name} cleared in</span><b>${fmtT(last.time)}</b>
            <span>Kills this sector</span><b>${last.kills}</b>
            <span>Score</span><b>${G.score.toLocaleString()}</b>
            <span>Cores banked this run</span><b>◆ ${G.cores}</b></div>`;
        $('dock-next').textContent = next ? next.name : 'next sector';
    }
    showOver(G, banked, best) {
        $('over-head').textContent = G.won ? 'VICTORY!' : 'GAME OVER';
        const died = G.log[G.log.length - 1]?.died;
        const cause = { bullet: 'shot down', shell: 'shelled by a tank', missile: 'hit by a missile', laser: 'caught in a laser', ram: 'rammed', mine: 'hit a mine', fuel: 'ran out of fuel', bank: 'wrecked on the rocks', blockade: 'wrecked on a boom', sandbar: 'wrecked on a sandbar' }[died] || died;
        $('over-text').innerHTML = `<p>${G.won ? 'Commodore Kurogane\'s Iron Lotus fleet is broken and the river runs free!' : `The Hayate went down in <b>${SECTOR_DATA[G.sector].name}</b>: ${cause}.`}</p>
            <div class="stats">
            <span>Score${G.score >= best && G.score > 0 ? ' — NEW BEST!' : ''}</span><b>${G.score.toLocaleString()}</b>
            <span>Sectors cleared</span><b>${G.won ? SECTORS : G.sector} / ${SECTORS}</b>
            <span>Kills</span><b>${G.kills}</b>
            <span>Best combo</span><b>${G.bestCombo}</b>
            <span>Jumps</span><b>${G.jumps}</b>
            <span>Time</span><b>${fmtT(G.t)}</b>
            <span>Cores banked</span><b>◆ ${banked}</b></div>
            <p class="sk-note">Spend cores on the Skill Tree: more hull, higher jumps, extra barrels, seeker rounds and longer boosts.</p>`;
    }

    // ------------------------------------------------------------------ skill tree
    buildSkills() {
        const root = $('skill-tree');
        root.innerHTML = '';
        for (const br of SKILLS) {
            const col = document.createElement('div');
            col.className = 'branch';
            col.style.setProperty('--bc', br.color);
            col.innerHTML = `<h3 style="color:${br.color}">${br.name}</h3>`;
            for (const n of br.nodes) {
                const b = document.createElement('button');
                b.className = 'node';
                b.dataset.id = n.id;
                b.addEventListener('click', () => this.clickNode(n.id));
                b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (refundOne(this.meta, n.id)) { this.audio.ui('close'); this.onMeta(); this.renderSkills(); } });
                col.appendChild(b);
            }
            root.appendChild(col);
        }
    }
    clickNode(id) {
        if (buy(this.meta, id)) {
            this.audio.ui('buy');
            this.onMeta();
            this.renderSkills();
            const n = nodeOf(id);
            this.toast(`${n.name} ${roman(this.meta.ranks[id])}`);
        } else {
            this.audio.ui('deny');
            const why = blocked(this.meta.ranks, id, this.meta.cores);
            if (why === 'locked') this.toast('Unlock the skill above it first.');
            else if (why === 'cores') this.toast('Not enough cores.');
        }
    }
    renderSkills(inRun = this.inRun) {
        const m = this.meta;
        $('sk-cores').textContent = m.cores;
        $('sk-note').textContent = inRun ? 'Skills you buy now take effect when you leave the next dock (or on your next run). Right-click a skill to refund its top rank.'
            : 'Each skill needs the one above it. Upgrades apply at the start of every run and at every dock. Right-click a skill to refund its top rank.';
        for (const b of document.querySelectorAll('#skill-tree .node')) {
            const id = b.dataset.id, n = nodeOf(id);
            const k = m.ranks[id] | 0;
            const why = blocked(m.ranks, id, m.cores);
            const cost = nextCost(m.ranks, id);
            b.className = 'node' + (why === 'max' ? ' max' : why === 'locked' ? ' locked' : why === 'cores' ? ' poor' : ' can');
            const pips = '●'.repeat(k) + '○'.repeat(n.ranks - k);
            const now = k ? n.desc(k) : 'Not learned';
            const nxt = why === 'max' ? 'MAX RANK' : `Next: ${n.desc(k + 1)} · ◆ ${cost}`;
            b.innerHTML = `<span class="rk">${pips}</span><div class="nm">${n.name}</div><div class="ds">${now}</div><div class="nx">${why === 'locked' ? '🔒 ' + nxt : nxt}</div>`;
            b.setAttribute('aria-label', `${n.name}, rank ${k} of ${n.ranks}. ${nxt}`);
        }
    }
}

function fmtT(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function roman(n) { return ['', 'I', 'II', 'III', 'IV'][n] || n; }
