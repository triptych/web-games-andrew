// The DOM layer: screens, the HUD, banners, warnings, callouts, radio chatter, the cutscene and dialogue player,
// pilot select, scores and settings. Reads the sim; never changes it.

import { VERSION, DIFFS } from './config.js';
import { PILOTS, PILOT_BY_ID } from './sim/data/pilots.js';
import { STAGES, BOSSES, CAST } from './sim/data/world.js';
import { POWERUPS, SYNERGIES } from './sim/data/powerups.js';
import { storyFor } from './sim/data/story.js';
import { chainTier } from './sim/core.js';
import { BOSS_DEFS } from './sim/bosses.js';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const FIERCE = /^(boss\d|launch|sora-hikari|kaito-voss|lyra-daughter)/;

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.scene = null;
        this.sel = { pilot: 'sora', diff: 1, mode: 'story' };
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        // settings
        const S = { sfx: $('set-sfx'), music: $('set-music'), voice: $('set-voice'), touch: $('set-touch'), quality: $('set-quality'), calm: $('set-calm'), scenes: $('set-scenes') };
        for (const [k, el] of Object.entries(S)) { if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = settings[k]; }
        const changed = () => {
            for (const [k, el] of Object.entries(S)) settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
            onSettings(settings);
        };
        for (const el of Object.values(S)) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted'); });

        this.buildHowto();
        this.buildSelect();
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
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
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length); }
    focusFirst(id) { const s = $(id).querySelector('.pilot.sel') || this.buttons(id)[0]; s?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
        this.audio.ui('move');
    }

    buildHowto() {
        $('howto-pu').innerHTML = Object.entries(POWERUPS).map(([k, p]) => `<div class="pu"><i style="background:${hex(p.color)}">${k === 'U' ? '1UP' : k}</i><span><b>${p.name}</b> ${p.desc}</span></div>`).join('');
        $('howto-syn').innerHTML = SYNERGIES.map((s) => `<div class="s"><b>${s.name}</b> <span class="dim">(${s.need.map((n) => n.replace(/\d/, ' ×$&')).join(' + ')})</span><br>${s.desc}</div>`).join('');
    }

    buildSelect() {
        $('pilots').innerHTML = PILOTS.map((p) => `
            <button class="pilot" data-pilot="${p.id}" style="--pc:${p.css}">
                <img src="art/por/${p.id}.webp" alt="${p.name}">
                <div class="pi"><div class="pn">${p.name}</div><div class="ps">${p.ship} · "${p.callsign}"</div>
                <div class="pb">${p.blurb}</div><div class="pst">${p.story}</div></div>
            </button>`).join('');
        $('diffs').innerHTML = DIFFS.map((d, i) => `<button class="diff" data-diff="${i}"><b>${d.name}</b><span>${d.desc}</span></button>`).join('');
        $('pilots').addEventListener('click', (e) => { const b = e.target.closest('[data-pilot]'); if (b) { this.sel.pilot = b.dataset.pilot; this.audio.ui('click'); this.refreshSelect(); } });
        $('diffs').addEventListener('click', (e) => { const b = e.target.closest('[data-diff]'); if (b) { this.sel.diff = +b.dataset.diff; this.audio.ui('click'); this.refreshSelect(); } });
        this.refreshSelect();
    }
    refreshSelect() {
        for (const b of document.querySelectorAll('.pilot')) b.classList.toggle('sel', b.dataset.pilot === this.sel.pilot);
        for (const b of document.querySelectorAll('.diff')) b.classList.toggle('sel', +b.dataset.diff === this.sel.diff);
        document.documentElement.style.setProperty('--pilot', PILOT_BY_ID[this.sel.pilot].css);
    }
    openSelect(mode) {
        this.sel.mode = mode;
        $('select-head').textContent = mode === 'endless' ? 'Survival: choose your pilot' : 'Story: choose your pilot';
        this.openScreen('select');
    }

    showScores(scores) {
        const rows = (list, title) => `<h3>${title}</h3>` + (list.length ? '<table>' + list.map((s, i) => `<tr><td>${i + 1}</td><td>${fmt(s.score)}</td><td>${PILOT_BY_ID[s.pilot]?.name || ''}</td><td class="dim">${s.note || ''}</td></tr>`).join('') + '</table>' : '<p class="dim">No runs yet.</p>');
        $('score-list').innerHTML = rows(scores.story || [], 'Story') + rows(scores.endless || [], 'Survival');
        this.openScreen('scores');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    setTouch(on, playing = !$('hud').hidden) { this.touchOn = on; $('touch').hidden = !(on && playing); }

    hud(G, hiscore) {
        const p = G.player;
        if (this._score !== G.score) { this._score = G.score; $('score').textContent = fmt(G.score); }
        $('hiscore').textContent = fmt(Math.max(hiscore, G.score));
        const lives = Math.max(0, G.lives), bombs = G.bombs;
        if (this._lb !== lives * 100 + bombs) { this._lb = lives * 100 + bombs; $('hud-lives').innerHTML = '<i>▲</i>'.repeat(Math.min(8, lives)) + (lives > 8 ? `×${lives}` : ''); $('hud-bombs').innerHTML = '<i>◆</i>'.repeat(bombs); }
        const stg = G.mode === 'endless' ? `WAVE ${G.wave}` : `STAGE ${G.stage + 1} · ${STAGES[G.stage].name}`;
        if (this._stg !== stg) { this._stg = stg; $('hud-stage').textContent = stg; }
        // chain
        const ch = G.chain.n >= 5;
        $('hud-chain').hidden = !ch;
        if (ch) { $('chain-n').textContent = G.chain.n; $('chain-x').textContent = chainTier(G); }
        // gear
        const gear = [`PWR ${p.overdriveT > 0 ? 'MAX' : p.power}`];
        if (p.options) gear.push(`OPT ${p.options}`);
        if (p.rockets) gear.push(`RKT ${p.rockets}`);
        if (p.shield) gear.push(`SHD ${p.shield}`);
        if (p.warpMax) gear.push(`WRP ${p.warp}/${p.warpMax}`);
        if (p.halo) gear.push(`HALO ${p.halo}`);
        const timed = [];
        if (p.overdriveT > 0) timed.push(`OVERDRIVE ${p.overdriveT.toFixed(0)}`);
        if (p.chronoT > 0) timed.push(`CHRONO ${p.chronoT.toFixed(0)}`);
        if (p.magnetT > 0) timed.push(`MAGNET ${p.magnetT.toFixed(0)}`);
        const gk = gear.join() + timed.join();
        if (this._gk !== gk) { this._gk = gk; $('hud-gear').innerHTML = gear.map((g) => `<span class="gear">${g}</span>`).join('') + timed.map((g) => `<span class="gear t">${g}</span>`).join(''); }
        const syn = SYNERGIES.filter((s) => G.syn[s.id]).map((s) => s.name).join(',');
        if (this._syn !== syn) { this._syn = syn; $('hud-syn').innerHTML = syn ? syn.split(',').map((s) => `<span class="syn">✦ ${s}</span>`).join('') : ''; }
        // burst
        const full = G.burst >= 100;
        $('burst-fill').style.width = (p.burstT > 0 ? (p.burstT / PILOT_BY_ID[p.pilot].burst.time) * 100 : G.burst) + '%';
        $('hud-burst').classList.toggle('full', full);
        $('burst-label').textContent = p.burstT > 0 ? PILOT_BY_ID[p.pilot].burst.name : full ? 'BURST READY · SPACE' : 'BURST';
        $('t-burst').classList.toggle('ready', full);
        // boss
        const B = G.boss;
        const showBoss = B && !B.dead && B.entering <= 0;
        $('boss-bar').hidden = !showBoss;
        if (showBoss) {
            $('boss-name').textContent = BOSSES[B.key].name;
            $('boss-fill').style.width = Math.max(0, (B.hp / B.maxhp) * 100) + '%';
            const D = BOSS_DEFS[B.key];
            if (this._bp !== B.id + ':' + B.phase) { this._bp = B.id + ':' + B.phase; this.phaseName = D.phases[B.phase].name || ''; }
            $('boss-phase').textContent = '◆'.repeat(D.phases.length - B.phase - 1) + ' ' + this.phaseName + (B.vuln ? '' : ' · ARMORED');
            $('boss-time').textContent = Math.max(0, Math.ceil(D.phases[B.phase].time - B.pt));
        }
    }

    // ------------------------------------------------------------------ banners, callouts, radio
    banner(n, name, sub) {
        const b = $('banner');
        b.hidden = true; void b.offsetWidth;
        $('banner-n').textContent = n; $('banner-name').textContent = name; $('banner-sub').textContent = sub;
        b.hidden = false;
        clearTimeout(this._bt); this._bt = setTimeout(() => { b.hidden = true; }, 3400);
    }
    warning(key) {
        const w = $('warning');
        $('warn-art').src = `art/boss/${key}.webp`;
        $('warn-name').textContent = BOSSES[key].name;
        $('warn-title').textContent = BOSSES[key].title;
        w.hidden = true; void w.offsetWidth; w.hidden = false;
        clearTimeout(this._wt); this._wt = setTimeout(() => { w.hidden = true; }, 3200);
    }
    callout(text, sub = '') {
        const c = $('callout');
        c.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
        c.hidden = true; void c.offsetWidth; c.hidden = false;
        clearTimeout(this._ct); this._ct = setTimeout(() => { c.hidden = true; }, 1800);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 1900);
    }
    radio(sceneId, pilot) {
        const s = storyFor(sceneId, pilot);
        if (!s) return;
        const l = s.lines[0];
        const who = speaker(l.who);
        $('radio-por').hidden = l.who === 'system';
        if (l.who !== 'system') $('radio-por').src = `art/por/${portraitId(l.who)}.webp`;
        $('radio-who').textContent = who.name.toUpperCase();
        $('radio-who').style.color = who.color;
        $('radio-text').textContent = l.text;
        const r = $('radio');
        r.hidden = true; void r.offsetWidth; r.hidden = false;
        this.audio.voice(l.vo).then((d) => {
            clearTimeout(this._rt);
            this._rt = setTimeout(() => { r.hidden = true; }, Math.max(3500, (d || 0) * 1000 + 600));
        });
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'stage': if (G.mode === 'story') this.banner(`STAGE ${e.n + 1}`, e.name, e.sub); else this.banner('SURVIVAL', e.name, e.sub); break;
                case 'wave': if (e.n > 1) this.toast(`WAVE ${e.n}`); break;
                case 'radio': if (this.settings.scenes !== 'skip' || !this.seenRadio?.has(e.scene)) { this.radio(e.scene, G.pilot); (this.seenRadio ||= new Set()).add(e.scene); } break;
                case 'warning': this.warning(e.key); break;
                case 'boss': this.callout(e.name, e.title); break;
                case 'phase': if (e.name) this.callout(e.name, e.timedOut ? 'time out' : 'phase broken'); else this.toast(e.timedOut ? 'TIME OUT' : 'PHASE BROKEN'); break;
                case 'bossDie': this.callout('DESTROYED', e.timedOut ? '' : 'BOSS BONUS'); break;
                case 'synergy': this.callout(e.name, SYNERGIES.find((s) => s.id === e.id)?.desc); break;
                case 'powerup': this.toast(e.name); break;
                case 'burst': this.callout(e.name); break;
                case 'extend': this.callout('EXTEND!', '1UP'); break;
                case 'capitalBreak': this.callout('CAPITAL SHIP DOWN', '+50,000'); break;
                case 'engineDown': this.toast(e.left > 0 ? `ENGINE DOWN · ${e.left} LEFT` : 'ALL ENGINES DOWN'); break;
                case 'clear': this.banner(G.mode === 'story' ? 'STAGE CLEAR' : 'WAVE CLEAR', `+${fmt(e.score || 0)}`, ''); break;
                case 'waveClear': this.banner('WAVE CLEAR', `WAVE ${e.n}`, ''); break;
                case 'continue': this.toast('CONTINUE'); break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------ cutscenes and dialogue
    /** Show a scene (art or none) and step through its lines; done() runs after the last. */
    playScene(sceneId, pilot, done) {
        const s = storyFor(sceneId, pilot);
        if (!s) { done(); return; }
        this.scene = { s, i: -1, done, typing: 0, full: '', shown: '' };
        const el = $('scene');
        el.hidden = false;
        el.classList.toggle('full', !!s.art);
        if (s.art) $('scene-img').src = `art/cs/${s.art}.webp`;
        this.audio.preload(s.lines.map((l) => l.vo));
        this.nextLine();
    }
    nextLine() {
        const sc = this.scene;
        if (!sc) return;
        if (sc.typing > 0 && sc.shown.length < sc.full.length) { sc.shown = sc.full; $('dlg-text').textContent = sc.full; return; }   // finish the line first
        sc.i++;
        if (sc.i >= sc.s.lines.length) return this.endScene();
        const l = sc.s.lines[sc.i];
        const who = speaker(l.who);
        const fierce = FIERCE.test(sc.s.id) && PILOT_BY_ID[l.who];
        const por = $('dlg-por');
        por.src = `art/por/${portraitId(l.who)}${fierce ? '-fierce' : ''}.webp`;
        por.classList.toggle('right', !PILOT_BY_ID[l.who] && l.who !== 'mei');
        por.style.animation = 'none'; void por.offsetWidth; por.style.animation = '';
        por.hidden = l.who === 'system';
        $('dlg-who').textContent = who.name.toUpperCase();
        $('dlg-box').style.setProperty('--spk', who.color);
        sc.full = l.text; sc.shown = ''; sc.typing = 1;
        $('dlg-text').textContent = '';
        this.audio.voice(l.vo);
    }
    tickScene(dt) {
        const sc = this.scene;
        if (!sc || sc.shown.length >= sc.full.length) return;
        sc.acc = (sc.acc || 0) + dt * 55;
        const n = Math.floor(sc.acc);
        if (n > 0) { sc.acc -= n; sc.shown = sc.full.slice(0, sc.shown.length + n); $('dlg-text').textContent = sc.shown; if (Math.random() < 0.3) this.audio.ui('text'); }
    }
    skipScene() { if (this.scene) this.endScene(); }
    endScene() {
        const sc = this.scene;
        this.scene = null;
        this.audio.stopVoice();
        $('scene').hidden = true;
        $('scene').classList.remove('full');
        sc?.done();
    }
    inScene() { return !!this.scene; }

    // ------------------------------------------------------------------ end screens
    gameOver(G, canContinue) {
        $('over-head').textContent = G.mode === 'endless' ? 'The Choir Ends' : 'Game Over';
        $('over-text').innerHTML = G.mode === 'endless'
            ? `Wave ${G.wave} · score <b>${fmt(G.score)}</b> · best chain ${G.chain.best}`
            : `Stage ${G.stage + 1} · score <b>${fmt(G.score)}</b>${canContinue ? '<br>Continue? Your score resets to zero.' : ''}`;
        $('over-cont').hidden = !canContinue;
        $('over-quit').textContent = canContinue ? 'Give Up' : 'To Title';
        this.openScreen('over');
    }
    results(G, title) {
        $('results-head').textContent = title;
        const st = [['Score', fmt(G.score)], ['Pilot', PILOT_BY_ID[G.pilot].name], ['Difficulty', DIFFS[G.diff].name], ['Kills', fmt(G.kills)], ['Best chain', G.chain.best], ['Grazes', fmt(G.grazes)], ['Stars', fmt(G.gems)], ['Bosses destroyed', G.bossesKilled], ['Capital ships downed', G.capitalsBroken], ['Synergies discovered', `${Object.keys(G.synSeen).length} / ${SYNERGIES.length}`], ['Continues', G.continues]];
        $('results-body').innerHTML = st.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
        this.openScreen('results');
    }
}

function speaker(who) {
    if (PILOT_BY_ID[who]) return { name: PILOT_BY_ID[who].name, color: PILOT_BY_ID[who].css };
    return CAST[who] || { name: who, color: '#fff' };
}
function portraitId(who) { return who === 'system' ? 'mei' : who; }
