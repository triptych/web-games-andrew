/**
 * ui.js — the DOM layer: HUD, dialogue, banners, cards and every menu.
 * Menus are plain buttons; keyboard / gamepad focus moves between the visible
 * buttons of the top-most open screen, so mouse, touch, keys and pads all work.
 */

import { renderPortrait } from './art/portraits.js';
import { renderRGBA } from './art/bake.js';
import { SPEAKERS, DIALOG } from './story.js';
import { UPGRADES } from './sim/moves.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const faceCache = new Map();

export function drawFace(canvas, key) {
    if (!canvas) return;
    let img = faceCache.get(key);
    const ctx = canvas.getContext('2d');
    if (!img) {
        const p = renderPortrait(key);
        img = new ImageData(p.data, p.w, p.h);
        faceCache.set(key, img);
    }
    canvas.width = img.width; canvas.height = img.height;
    ctx.putImageData(img, 0, 0);
}

const COMBO_WORDS = [[80, 'SISTER POWER!!'], [50, 'UNSTOPPABLE'], [30, 'SAVAGE'], [20, 'BRUTAL'], [10, 'GREAT'], [5, 'NICE']];

export class UI {
    constructor() {
        this.stack = [];          // open screens, top-most last
        this.focusIdx = 0;
        this.dialog = null;
        this.bannerT = null;
        this.enemyT = 0; this.enemyId = null;
        this.comboT = 0;
        this.barkT = 0;
        this.lastHp = 1;
        this.handlers = {};
        // generic close buttons
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { sfx('back'); this.close(b.closest('.screen').id); });
        // hover focus sync
        document.addEventListener('pointermove', (e) => {
            const b = e.target.closest && e.target.closest('.mbtn, .cbtn, #stage-list button');
            if (b && this.top() && this.top().contains(b)) { const list = this.buttons(); const i = list.indexOf(b); if (i >= 0 && i !== this.focusIdx) { this.focusIdx = i; this.paintFocus(); } }
        });
    }

    // ---------------------------------------------------------------- screens & focus
    open(id, focusFirst = true) {
        const el = $(id);
        el.classList.remove('hidden');
        this.stack = this.stack.filter((s) => s !== el);
        this.stack.push(el);
        if (focusFirst) { this.focusIdx = Math.max(0, this.buttons().findIndex((b) => b.classList.contains('primary'))); this.paintFocus(); }
    }
    close(id) {
        const el = $(id);
        el.classList.add('hidden');
        this.stack = this.stack.filter((s) => s !== el);
        if (this.onClose) this.onClose(id);
        this.focusIdx = 0; this.paintFocus();
    }
    closeAll() { for (const s of [...this.stack]) s.classList.add('hidden'); this.stack = []; }
    top() { return this.stack[this.stack.length - 1] || null; }
    isOpen(id) { return this.stack.includes($(id)); }
    buttons() {
        const t = this.top();
        if (!t) return [];
        return [...t.querySelectorAll('button, input')].filter((b) => !b.disabled && b.offsetParent !== null && !b.classList.contains('hidden') && b.id !== 'dlg-skip');
    }
    paintFocus() {
        for (const b of document.querySelectorAll('.focus')) b.classList.remove('focus');
        const list = this.buttons();
        if (!list.length) return;
        this.focusIdx = (this.focusIdx + list.length) % list.length;
        const b = list[this.focusIdx];
        b.classList.add('focus');
        if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
    }
    /** Keyboard / pad menu navigation. Returns true if consumed. */
    nav(ev) {
        const t = this.top();
        if (!t || t.id === 'stagecard' || t.id === 'bosscard') return false;
        const list = this.buttons();
        if (ev === 'up' || ev === 'left' || ev === 'down' || ev === 'right') {
            const cur = list[this.focusIdx];
            if (cur && cur.type === 'range' && (ev === 'left' || ev === 'right')) { cur.value = +cur.value + (ev === 'left' ? -1 : 1) * +cur.step; cur.dispatchEvent(new Event('input')); return true; }
            this.focusIdx += (ev === 'up' || ev === 'left') ? -1 : 1;
            this.paintFocus(); sfx('select');
            return true;
        }
        if (ev === 'ok') {
            const b = list[this.focusIdx];
            if (b) { if (b.type === 'checkbox') { b.checked = !b.checked; b.dispatchEvent(new Event('change')); } else b.click(); }
            return true;
        }
        if (ev === 'back') {
            const closer = t.querySelector('[data-close]');
            if (closer) { closer.click(); return true; }
            if (this.onBack) return this.onBack(t.id);
        }
        return false;
    }

    // ---------------------------------------------------------------- HUD
    showHUD(on) { $('hud').classList.toggle('hidden', !on); }

    setPlayerFace(key, name) { drawFace($('p-face'), key); $('p-name').textContent = name; }

    updateHUD(w, dt) {
        if (!w) return;
        const p = w.player;
        const hpk = Math.max(0, p.hp / p.maxHp);
        $('hp-fill').style.transform = `scaleX(${hpk})`;
        $('hp-lag').style.transform = `scaleX(${hpk})`;
        $('hp-fill').parentElement.classList.toggle('low', hpk < 0.25);
        $('en-fill').style.transform = `scaleX(${Math.max(0, p.energy / p.maxEnergy)})`;
        const odRow = $('od-row');
        $('od-fill').style.transform = `scaleX(${p.od > 0 ? p.od / p.odDur : p.meter / 100})`;
        odRow.classList.toggle('ready', p.meter >= 100 && p.od <= 0);
        odRow.classList.toggle('active', p.od > 0);
        $('od-label').textContent = p.od > 0 ? 'OVERDRIVE!' : p.meter >= 100 ? 'OVERDRIVE READY' : 'OVERDRIVE';
        $('t-ovr').classList.toggle('ready', p.meter >= 100 && p.od <= 0);
        $('p-lives').textContent = '×' + Math.max(0, w.lives);
        $('p-score').textContent = String(w.score).padStart(7, '0');
        $('cred-n').textContent = w.profile.credits || 0;
        const wc = $('weapon-chip');
        if (p.weapon) { wc.classList.remove('hidden'); wc.textContent = `${p.weapon.type === 'knives' ? 'KNIVES' : p.weapon.type.toUpperCase()} ${'▮'.repeat(Math.min(12, Math.ceil(p.weapon.uses / (p.weapon.type === 'knives' ? 1 : 2))))}`; }
        else wc.classList.add('hidden');
        // enemy bar
        if (this.enemyT > 0) {
            this.enemyT -= dt;
            const e = w.fighters.find((f) => f.id === this.enemyId);
            if (!e || e.boss || this.enemyT <= 0) $('e-panel').classList.add('hidden');
            else {
                $('e-panel').classList.remove('hidden');
                $('e-name').textContent = e.name;
                const k = Math.max(0, e.hp / e.maxHp);
                $('ehp-fill').style.transform = `scaleX(${k})`; $('ehp-lag').style.transform = `scaleX(${k})`;
            }
        }
        // boss bar
        const b = w.boss;
        if (b && !b.remove && w.state !== 'clear') {
            $('boss-panel').classList.remove('hidden');
            $('boss-name').textContent = b.def.barLabel ? `${b.name} · ${b.def.barLabel}` : b.name;
            const k = Math.max(0, b.hp / b.maxHp);
            $('boss-fill').style.transform = `scaleX(${k})`; $('boss-lag').style.transform = `scaleX(${k})`;
            $('boss-poise').style.transform = `scaleX(${b.poiseMax ? Math.max(0, b.poise / b.poiseMax) : 0})`;
        } else $('boss-panel').classList.add('hidden');
        if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) $('combo').classList.add('hidden'); }
        if (this.barkT > 0) { this.barkT -= dt; if (this.barkT <= 0) $('bark').classList.add('hidden'); }
        if (this.lowT > 0) { this.lowT -= dt; if (this.lowT <= 0) $('low-en').classList.add('hidden'); }
    }

    onHit(e, w) {
        if (e.team === 'player' && e.id) {
            const t = w.fighters.find((f) => f.id === e.id);
            if (t && !t.boss) { this.enemyId = e.id; this.enemyT = 2.5; }
        }
    }

    combo(n) {
        if (n < 3) return;
        const c = $('combo');
        c.classList.remove('hidden');
        $('combo-n').textContent = n;
        const wd = COMBO_WORDS.find(([k]) => n >= k);
        $('combo-word').textContent = wd ? wd[1] : '';
        c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
        this.comboT = 1.6;
    }

    banner(text, kind = 'big') {
        const b = $('banner');
        b.textContent = text;
        b.className = '';
        void b.offsetWidth;
        b.className = 'show ' + (kind === 'big' ? '' : kind);
    }

    go(on) { $('go-arrow').classList.toggle('hidden', !on); }

    bark(who, text) {
        const sp = SPEAKERS[who] || SPEAKERS.echo;
        drawFace($('bark-face'), sp.portrait);
        $('bark-text').innerHTML = `<b style="color:${sp.color}">${sp.name}</b> ${text}`;
        $('bark').classList.remove('hidden');
        this.barkT = 2.6;
    }

    lowEnergy() { $('low-en').classList.remove('hidden'); this.lowT = 1; }

    toast(text, t = 1.8) {
        const el = $('toast');
        el.textContent = text; el.classList.add('show');
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => el.classList.remove('show'), t * 1000);
    }

    flash(color = '#fff', a = 0.6) {
        const f = $('flash');
        f.style.background = color; f.style.transition = 'none'; f.style.opacity = a;
        requestAnimationFrame(() => { f.style.transition = 'opacity 0.35s'; f.style.opacity = 0; });
    }

    // ---------------------------------------------------------------- dialogue
    showDialog(id, onDone) {
        const lines = DIALOG[id];
        if (!lines || !lines.length) { onDone && onDone(); return; }
        this.dialog = { lines, i: -1, onDone, typed: 0, text: '', speed: 55 };
        $('dialog').classList.remove('hidden');
        $('dlg-skip').onclick = (e) => { e.stopPropagation(); this.endDialog(); };
        $('dialog').onclick = () => this.advanceDialog();
        this.nextLine();
    }
    nextLine() {
        const d = this.dialog;
        d.i++;
        if (d.i >= d.lines.length) { this.endDialog(); return; }
        const [who, text] = d.lines[d.i];
        const sp = SPEAKERS[who] || SPEAKERS.echo;
        const right = !['juno', 'echo'].includes(who);
        $('dialog').classList.toggle('right', right);
        $('dialog').style.boxShadow = `0 0 0 2px ${sp.color}, 0 8px 30px rgba(0,0,0,0.6)`;
        drawFace($('dlg-face'), sp.portrait);
        $('dlg-name').textContent = sp.name; $('dlg-name').style.color = sp.color;
        d.text = text; d.typed = 0;
        $('dlg-text').textContent = ''; $('dlg-next').classList.add('hidden');
    }
    advanceDialog() {
        const d = this.dialog;
        if (!d) return;
        if (d.typed < d.text.length) { d.typed = d.text.length; $('dlg-text').textContent = d.text; $('dlg-next').classList.remove('hidden'); return; }
        sfx('select');
        this.nextLine();
    }
    updateDialog(dt) {
        const d = this.dialog;
        if (!d || d.typed >= d.text.length) return;
        const before = Math.floor(d.typed);
        d.typed = Math.min(d.text.length, d.typed + dt * d.speed);
        const n = Math.floor(d.typed);
        if (n !== before) { $('dlg-text').textContent = d.text.slice(0, n); if (n % 3 === 0) sfx('blip'); }
        if (d.typed >= d.text.length) $('dlg-next').classList.remove('hidden');
    }
    endDialog() {
        const d = this.dialog;
        this.dialog = null;
        $('dialog').classList.add('hidden');
        if (d && d.onDone) d.onDone();
    }
    get inDialog() { return !!this.dialog; }

    // ---------------------------------------------------------------- cards
    stageCard(level, idx, ms = 2200) {
        $('sc-num').textContent = `STAGE ${idx + 1}`;
        $('sc-name').textContent = level.name;
        $('sc-sub').textContent = level.sub;
        const el = $('stagecard');
        el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
        return new Promise((res) => setTimeout(() => { el.classList.add('hidden'); res(); }, ms));
    }
    bossCard(name, title, ms = 2000) {
        $('bc-name').textContent = name; $('bc-title').textContent = title;
        $('bosscard').classList.remove('hidden');
        return new Promise((res) => setTimeout(() => { $('bosscard').classList.add('hidden'); res(); }, ms));
    }

    // ---------------------------------------------------------------- results / shop
    results(w, stageName, extra) {
        const s = w.stats;
        const mm = Math.floor(s.time / 60), ss = String(Math.floor(s.time % 60)).padStart(2, '0');
        const rank = extra.rank;
        $('res-title').textContent = stageName;
        $('res-kicker').textContent = extra.kicker || 'STAGE CLEAR';
        const rows = [['Time', `${mm}:${ss}`], ['Enemies KO\'d', s.kos], ['Max combo', s.maxCombo], ['Damage taken', Math.round(s.dmgTaken)], ['Credits found', `¢${s.cred}`], ['Time bonus', `+${extra.timeBonus}`], ['No-damage bonus', `+${extra.dmgBonus}`], ['Score', w.score]];
        $('res-grid').innerHTML = rows.map(([k, v]) => `<div>${k}</div><div class="v">${v}</div>`).join('');
        $('res-rank').innerHTML = `${rank}<small>RANK</small>`;
        this.open('modal-results');
    }

    shop(profile, onBuy) {
        const render = () => {
            $('shop-cred').textContent = `¢ ${profile.credits || 0}`;
            const list = $('shop-list');
            list.innerHTML = '';
            for (const u of UPGRADES) {
                const lvl = profile.upgrades[u.id] || 0;
                const maxed = !u.consumable && lvl >= u.max;
                const cost = u.consumable ? u.cost[Math.min(u.cost.length - 1, profile.livesBought || 0)] : u.cost[lvl];
                const b = document.createElement('button');
                b.className = 'mbtn' + (maxed ? ' owned' : '');
                const pips = u.consumable ? `LIVES ${profile.lives}` : '◆'.repeat(lvl) + '◇'.repeat(u.max - lvl);
                b.innerHTML = `<div class="nm"><span>${u.name}</span><span class="pips">${pips}</span></div><small>${u.desc}</small><div class="nm" style="margin-top:4px"><span></span><span class="cost">${maxed ? 'INSTALLED' : '¢' + cost}</span></div>`;
                b.disabled = maxed || (profile.credits || 0) < cost;
                b.addEventListener('click', () => { onBuy(u, cost); render(); this.paintFocus(); });
                list.appendChild(b);
            }
        };
        render();
        this.open('modal-shop');
        this.focusIdx = this.buttons().length - 1; this.paintFocus();
    }

    // ---------------------------------------------------------------- move list
    moves(unlocks, touch) {
        const k = touch
            ? { atk: 'ATK', jump: 'JMP', spec: 'SP', ovr: 'OVR', dir: 'stick', toward: 'stick →', back: 'stick ←', down: 'stick ↓', run: 'push stick all the way' }
            : { atk: 'J', jump: 'K', spec: 'L', ovr: 'I', dir: 'WASD', toward: '→', back: '←', down: '↓', run: '→→ (double-tap)' };
        const K = (s) => s.split(' ').map((p) => (/^[A-Z←→↓]+$|^stick/.test(p) ? `<kbd>${p}</kbd>` : p)).join(' ');
        const L = (ok) => (ok ? '' : ' class="lk"');
        $('moves-body').innerHTML = `
            <h3>Basics</h3>
            <div>${K(k.dir)} move (up = into the street)</div><div>${K(k.run)} run</div>
            <div>${K(k.atk)} ×4 · jab, cross, elbow, roundhouse</div><div>${K(k.atk)} ${K(k.atk)} then ${K(k.jump)} · launcher</div>
            <div>${K(k.back)} + ${K(k.atk)} · backfist</div><div>run + ${K(k.atk)} · dash knee</div>
            <div>${K(k.jump)} then ${K(k.atk)} · flying kick</div><div>in the air ${K(k.down)} + ${K(k.atk)} · dive stomp</div>
            <h3>Grabs</h3>
            <div>walk into a dazed foe · grab</div><div>${K(k.atk)} · knee (third hit: headbutt)</div>
            <div>${K(k.toward)} + ${K(k.atk)} · throw</div><div>${K(k.back)} + ${K(k.atk)} · suplex</div>
            <div>${K(k.jump)} · vault over</div><div>grabbed? mash any button</div>
            <h3>Suit specials</h3>
            <div>${K(k.spec)} · Arc Burst (20 energy, invulnerable)</div><div>${K(k.toward)} + ${K(k.spec)} · Rail Dash (25)</div>
            <div>in the air ${K(k.spec)} · Meteor Drop (20)</div><div>${K(k.ovr)} when the meter is full · OVERDRIVE</div>
            <div${L(unlocks.pulse)}>hold ${K(k.spec)}, release · Pulse Shot ${unlocks.pulse ? '' : '(upgrade)'}</div><div${L(unlocks.rising)}>${K(k.spec)} mid-combo · Rising Arc ${unlocks.rising ? '' : '(upgrade)'}</div>
            <div${L(unlocks.counter)}>${K(k.spec)} while hit · Counter Burst ${unlocks.counter ? '' : '(upgrade)'}</div><div${L(unlocks.aircombo)}>${K(k.atk)} again after an air hit · air combo ${unlocks.aircombo ? '' : '(upgrade)'}</div>
            <h3>Weapons</h3>
            <div>${K(k.atk)} over a weapon · pick it up</div><div>${K(k.spec)} while armed · throw it</div>
            <h3>Tips</h3>
            <div>No energy? Arc Burst costs health instead (never fatal).</div><div>Thrown bodies knock down everyone they hit.</div>
            <div>Big enemies and bosses flash gold while their guard holds. Break it.</div><div>Bosses with a glinting stance counter attacks — wait.</div>`;
        this.open('modal-moves');
    }

    // ---------------------------------------------------------------- title art
    titleArt(character = 'juno') {
        const c = $('title-juno');
        const r = renderRGBA('juno', { anim: 'idle', frame: 0, scale: 2.5, crop: 'full', variant: character === 'mika' ? 'mika' : 'base' });
        c.width = r.w; c.height = r.h;
        const ctx = c.getContext('2d');
        const tmp = document.createElement('canvas'); tmp.width = r.w; tmp.height = r.h;
        tmp.getContext('2d').putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
        ctx.save(); ctx.translate(r.w, 0); ctx.scale(-1, 1); ctx.drawImage(tmp, 0, 0); ctx.restore();
    }
}

export { $ };
