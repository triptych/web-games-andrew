// The DOM layer: screens, the HUD, subtitles, gun cards, tapes, settings and the touch deck.
// Reads the sim; never changes it.

import { VERSION, RARITY, PLAYER, FURY } from './config.js';
import { LEVELS, TAPES, ENDING, BRIEFINGS } from './sim/data.js';
import { describe, ARCH, MAKERS } from './sim/weapons.js';
import { tallyOf } from './sim/game.js';

const $ = (id) => document.getElementById(id);
const KEY_CSS = ['#fff', '#ff2a1a', '#2a7bff', '#ffc020'];
const SHORT = { pistol: 'PISTOL', shotgun: 'SHOTGUN', ripper: 'RIPPER', rocket: 'ROCKETS', photon: 'PHOTON', disc: 'DISC', tesla: 'TESLA' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.subs = [];
        this.subT = 0;
        this.tapeT = 0;
        this.hitT = 0;
        this.last = {};
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const ids = { sfx: 'set-sfx', music: 'set-music', touch: 'set-touch', sens: 'set-sens', fov: 'set-fov', invert: 'set-invert', scan: 'set-scan', quality: 'set-quality' };
        for (const [k, id] of Object.entries(ids)) {
            const el = $(id);
            if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = settings[k];
            el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
                settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
                onSettings(settings);
            });
        }
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.offsetParent !== null); }
    focusFirst(id) { const b = this.buttons(id); (b.find((x) => x.classList.contains('primary')) || b[0])?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; $('btn-pause').hidden = !on; this.setTouch(this.touchOn, on); }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
        document.body.classList.toggle('touch', on);
    }

    hud(G, dt) {
        const p = G.player, L = G.L;
        const set = (id, v) => { if (this.last[id] !== v) { this.last[id] = v; $(id).textContent = v; } };
        const hp = Math.ceil(p.hp);
        set('hp', hp);
        $('hp').classList.toggle('low', hp <= 25);
        set('armor', Math.ceil(p.armor));
        $('fuel-fill').style.width = `${p.fuel}%`;
        const keys = [1, 2, 3].filter((k) => p.keys & (1 << k)).join();
        if (this.last.keys !== keys) { this.last.keys = keys; $('keys').innerHTML = keys ? keys.split(',').map((k) => `<span style="background:${KEY_CSS[k]};color:${KEY_CSS[k]}"></span>`).join('') : ''; }
        const g = p.weapons[p.cur];
        if (g) {
            const nm = `${g.name}`;
            if (this.last.gun !== nm) { this.last.gun = nm; $('gun-name').textContent = nm; $('gun-name').style.color = RARITY[g.rarity].color; }
            set('clip', p.reloadT > 0 ? '··' : Math.floor(g.clip / g.ammoPer));
            set('reserve', g.infinite ? '∞' : Math.floor((p.ammo[g.ammo] || 0) / g.ammoPer));
        }
        set('bombs', p.bombs ? `💣 ×${p.bombs}` : '');
        const slots = p.weapons.map((w, k) => `${k + 1}${k === p.cur ? '*' : ''}${w.rarity}`).join();
        if (this.last.slots !== slots) {
            this.last.slots = slots;
            $('slots').innerHTML = p.weapons.map((w, k) => `<span class="${k === p.cur ? 'cur' : ''}" style="color:${RARITY[w.rarity].color}">${k + 1} ${SHORT[w.arch]}</span>`).join('');
        }
        // fury
        const furyEl = $('fury');
        const over = p.overdrive > 0;
        $('fury-fill').style.width = `${over ? (p.overdrive / FURY.duration) * 100 : p.fury}%`;
        furyEl.classList.toggle('ready', !over && p.fury >= FURY.max);
        furyEl.classList.toggle('active', over);
        set('fury-label', over ? 'OVERDRIVE' : p.fury >= FURY.max ? (this.touchOn ? 'OVERDRIVE READY' : 'OVERDRIVE READY · F') : 'FURY');
        $('t-over').hidden = !(p.fury >= FURY.max && !over);
        // objective and its arrow
        const o = G.objective;
        if (o) {
            set('obj-text', o.text);
            const dx = o.x - p.x, dz = o.z - p.z;
            const d = Math.hypot(dx, dz);
            const a = Math.atan2(dx, -dz) - p.yaw;
            $('obj-arrow').style.transform = `rotate(${a}rad)`;
            set('obj-dist', o.kind === 'ambush' ? '' : `${Math.round(d)}m`);
        }
        // boss bar
        const boss = G.enemies.find((e) => e.boss && !e.pylon);
        $('boss').hidden = !boss;
        if (boss) {
            set('boss-name', boss.def.name);
            $('boss-fill').style.width = `${Math.max(0, boss.hp / boss.maxhp) * 100}%`;
            $('boss').classList.toggle('shield', !!boss.invuln);
        }
        // tapes this level
        set('tapes-hud', `📼 ${G.tapes[G.level].filter(Boolean).length}/3`);
        // the gun card for a gun on the floor
        const near = p.nearGun >= 0 ? G.pickups.find((q) => q.id === p.nearGun) : null;
        const full = p.weapons.filter((w) => !w.infinite).length >= PLAYER.slots;
        $('t-swap').hidden = !(near && full);
        if (near) {
            const key = `${near.id}:${near.gun.seed}:${p.cur}:${full}`;
            if (this.last.card !== key) { this.last.card = key; this.gunCard(near.gun, g, full); }
            $('gun-card').hidden = false;
        } else { $('gun-card').hidden = true; this.last.card = null; }
        // crosshair spread when the gun is wild
        $('crosshair').classList.toggle('wide', !!g && (g.spread > 0.05 || (g.pellets > 1 && g.kind === 'hitscan')));
        // timers
        if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $('hitmark').className = ''; }
        if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) { $('subtitle').classList.remove('on'); this.nextSub(); } }
        else if (this.subs.length) this.nextSub();
        if (this.tapeT > 0) { this.tapeT -= dt; if (this.tapeT <= 0) $('tape-panel').hidden = true; }
    }

    gunCard(g, cur, full) {
        const rc = RARITY[g.rarity].color;
        const el = $('gun-card');
        el.style.setProperty('--rc', rc);
        const row = (label, a, b, better = (x, y) => x > y, fmt = (x) => x) => {
            let cls = '';
            if (cur && b !== undefined) cls = a === b ? '' : better(a, b) ? 'up' : 'down';
            return `<tr><td>${label}</td><td class="${cls}">${fmt(a)}${cur && b !== undefined && a !== b ? (better(a, b) ? ' ▲' : ' ▼') : ''}</td></tr>`;
        };
        const parts = describe(g).slice(1).join(' · ');
        el.innerHTML = `<div class="rar">${RARITY[g.rarity].name.toUpperCase()} ${esc(ARCH[g.arch].label.toUpperCase())}</div>
            <h3>${esc(g.name)}</h3>
            <table>
            ${row('Damage', g.pellets > 1 ? g.dmg * g.pellets : g.dmg, cur ? (cur.pellets > 1 ? cur.dmg * cur.pellets : cur.dmg) : undefined, undefined, (x) => Math.round(x) + (g.pellets > 1 ? ` (${g.pellets}×${Math.round(g.dmg)})` : ''))}
            ${row('Fire rate', g.rate, cur?.rate, undefined, (x) => x.toFixed(1) + '/s')}
            ${row('Magazine', g.mag, cur?.mag)}
            ${row('Reload', g.reload, cur?.reload, (x, y) => x < y, (x) => x.toFixed(1) + 's')}
            ${row('DPS', g.dps, cur?.dps)}
            </table>
            <div class="parts">${esc(MAKERS[g.maker].name)}${parts ? ' · ' + esc(parts) : ''}</div>
            ${g.flavor ? `<div class="flavor">“${esc(g.flavor)}”</div>` : ''}
            <div class="how">${full ? (cur?.infinite ? 'Switch to a gun to drop it' : (this.touchOn ? 'Tap SWAP' : 'Press E to swap')) : 'Walk over to take it'}</div>`;
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
    feed(text, color = '#fff') {
        const el = document.createElement('div');
        el.textContent = text;
        el.style.color = color;
        $('feed').appendChild(el);
        setTimeout(() => el.remove(), 2600);
        while ($('feed').children.length > 6) $('feed').firstChild.remove();
    }
    sub(who, text, boss = false, dur = 0) {
        this.subs.push({ who, text, boss, dur: dur || Math.min(7, 2 + text.length * 0.045) });
        if (this.subs.length > 3) this.subs.shift();
    }
    nextSub() {
        const s = this.subs.shift();
        if (!s) return;
        $('subtitle').innerHTML = (s.who ? `<b>${esc(s.who)}:</b> ` : '') + esc(s.text);
        $('subtitle').classList.toggle('boss', s.boss);
        $('subtitle').classList.add('on');
        this.subT = s.dur;
    }

    onEvents(G, events) {
        const p = G.player;
        for (const e of events) {
            switch (e.type) {
                case 'hit': if (e.dmg > 0 && !e.dot) { this.hitT = 0.12; $('hitmark').className = 'on'; } break;
                case 'kill': if (e.by === 'p' || e.by === 'boom') { this.hitT = 0.25; $('hitmark').className = 'on kill'; } break;
                case 'hurt': {
                    if (e.src === 'liquid') break;
                    const a = Math.atan2(e.x - p.x, -(e.z - p.z)) - p.yaw;
                    const arc = document.createElement('div');
                    arc.className = 'arc';
                    arc.style.transform = `rotate(${a}rad)`;
                    $('dmg-dir').appendChild(arc);
                    setTimeout(() => arc.remove(), 800);
                    break;
                }
                case 'combo': { const c = $('combo'); c.textContent = e.name + '!'; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); break; }
                case 'quip': this.sub('ROXY', e.text); break;
                case 'bossTalk': case 'boss': this.sub('', e.text, true, 4.5); break;
                case 'pickup': this.onPickup(G, e); break;
                case 'objective': this.feed('▶ ' + e.text, '#2ef2ff'); break;
                case 'ambush': this.sub('', 'IT\'S A TRAP! The doors slam shut.', true, 3); break;
                case 'ambushClear': this.feed('The doors unlock.', '#5dff7a'); break;
                case 'bossDead': this.sub('', `${e.name} IS DEAD.`, true, 3); break;
                case 'nodrop': this.feed('Dad\'s pistol stays. Switch guns to swap.', '#ffc531'); break;
                case 'supply': this.feed('Supply drop!', '#5dff7a'); break;
            }
        }
    }

    onPickup(G, e) {
        const names = { cola: '+15 RAD COLA', burger: '+50 BIG HUNK BURGER', vest: '+50 KEVLAR', bullet: 'BULLETS', shell: 'SHELLS', cell: 'POWER CELLS', rocket: 'ROCKETS', bomb: 'PIPE BOMB' };
        if (e.kind === 'gun') this.feed(`${e.swap ? 'SWAPPED FOR' : 'GOT'} ${e.name}`, RARITY[e.rarity ?? 0].color);
        else if (e.kind === 'key') { this.feed(`${['', 'RED', 'BLUE', 'GOLD'][e.key]} KEYCARD`, KEY_CSS[e.key]); this.sub('', `You have the ${['', 'RED', 'BLUE', 'GOLD'][e.key]} keycard.`, false, 2.5); }
        else if (e.kind === 'tape') {
            const t = TAPES[e.level][e.tape];
            $('tape-title').textContent = t.title;
            $('tape-text').textContent = t.text;
            $('tape-panel').hidden = false;
            this.tapeT = 9;
        } else this.feed(names[e.kind] || e.kind.toUpperCase());
    }

    // ------------------------------------------------------------------ screens with content
    brief(G) {
        const s = LEVELS[G.level];
        $('brief-num').textContent = `LEVEL ${G.level + 1} OF ${LEVELS.length}`;
        $('brief-name').textContent = s.name;
        $('brief-sub').textContent = s.sub;
        $('brief-text').textContent = BRIEFINGS[G.level];
    }

    tally(G) {
        const t = tallyOf(G);
        const m = Math.floor(t.time / 60), sec = Math.floor(t.time % 60);
        $('tally-name').textContent = `${t.name} — CLEARED`;
        $('tally-rank').innerHTML = `${t.rank}<small>${t.word}</small>`;
        $('tally-table').innerHTML = `
            <tr><td>Kills</td><td>${t.kills} / ${t.total}</td></tr>
            <tr><td>Gibs</td><td>${t.gibs}</td></tr>
            <tr><td>VHS tapes</td><td>${t.tapes} / 3</td></tr>
            <tr><td>Time</td><td>${m}:${String(sec).padStart(2, '0')}</td></tr>
            <tr><td>Style</td><td>${t.style.toLocaleString()}</td></tr>
            <tr><td>Deaths</td><td>${t.deaths}</td></tr>`;
        $('tally-next').textContent = G.level + 1 < LEVELS.length ? 'Next Level' : 'Onward';
    }

    won(G) {
        $('won-text').innerHTML = ENDING.map((l) => `<p>${esc(l)}</p>`).join('');
        const s = G.stats;
        const tapes = G.tapes.flat().filter(Boolean).length;
        const m = Math.floor(s.time / 60);
        $('won-table').innerHTML = `
            <tr><td>Total time</td><td>${m} min</td></tr>
            <tr><td>Kills</td><td>${s.kills + G.tally.kills}</td></tr>
            <tr><td>Style</td><td>${(s.style + G.tally.style).toLocaleString()}</td></tr>
            <tr><td>Deaths</td><td>${s.deaths}</td></tr>
            <tr><td>VHS tapes</td><td>${tapes} / 15</td></tr>`;
    }

    tapes(archive) {
        let html = '';
        LEVELS.forEach((l, li) => {
            html += `<h3>${esc(l.name)}</h3>`;
            TAPES[li].forEach((t, i) => {
                const got = archive[li]?.[i];
                html += got ? `<div class="tape"><b>${esc(t.title)}</b><br>${esc(t.text)}</div>` : `<div class="tape locked">TAPE ${String(li * 3 + i + 1).padStart(2, '0')} — not found yet</div>`;
            });
        });
        $('tape-list').innerHTML = html;
    }
}

