// The DOM layer: screens, the HUD, the toy box, the job board, people talking, toasts and the touch deck.
// Reads the sim; never changes it (choices go back to main.js through callbacks).

import { VERSION, VEHICLES, VEH, WORK, RADIUS } from './config.js';
import { JOBS, JOB, GIVERS, MAX_STARS } from './sim/data/jobs.js';
import { BUILDINGS, ZONES } from './sim/data/city.js';
import { current, progress, target } from './sim/game.js';
import { dist, distRect } from './sim/world.js';

const $ = (id) => document.getElementById(id);
const face = (giver) => `art/por-${giver}.webp`;
const stars = (n, of = 3) => '★'.repeat(n) + `<span class="off">${'★'.repeat(of - n)}</span>`;

/**
 * What to tell the player right now: { text, wrong, btn, meter }. `key` is how this player presses the action
 * ("SPACE", "the red button", "A"). Pure: built from G alone, so the tests can read it.
 */
export function prompt(G, key = 'SPACE') {
    const c = current(G);
    if (!c) return { text: G.finished ? 'The town is finished! Drive anywhere you like.' : 'Open the job board to pick a job', btn: 'HONK' };
    const { st, job } = c, p = G.p, tg = target(G);
    if (G.veh !== st.veh) return { text: `Swap to the ${VEH[st.veh].name}`, wrong: true, btn: 'HONK' };
    if (!tg) return { text: '', btn: 'HONK' };
    const near = dist(p, tg) < tg.r;
    if (tg.what === 'load') return { text: near ? 'Stop under the hopper to load up' : `Drive to ${ZONES[st.from].name}`, btn: 'HONK' };
    if (tg.what === 'tip') {
        const ok = st.kind === 'scoop' ? dist(p, tg) < tg.r + 2 : near;
        return { text: ok ? `${key}: tip it out!` : 'Drive to the marker and tip it out', btn: ok ? 'TIP' : 'HONK' };
    }
    if (tg.what === 'roll') return { text: 'Drive over every dark patch', btn: 'HONK' };
    if (tg.what === 'push') return { text: 'Push it onto the striped pad', btn: 'HONK' };
    if (tg.what === 'scoop') return { text: G.cargo.loader && G.cargoJob !== job.id ? `${key}: empty the bucket first` : 'Drive into the pieces to scoop them up', btn: G.cargo.loader ? 'DROP' : 'HONK' };
    if (tg.what === 'dig' || tg.what === 'pour') {
        const ok = dist(p, tg) < WORK.workReach;
        return { text: ok ? `Hold ${key} to ${tg.what}` : 'Park by the marker', btn: ok ? tg.what.toUpperCase() : 'HONK' };
    }
    if (tg.what === 'lift') return { text: near ? `${key} when the hook is on the green` : 'Park the crane at the marker', btn: near ? 'LIFT' : 'HONK', meter: near };
    if (tg.what === 'wreck') {
        const b = BUILDINGS.find((x) => x.id === tg.building), ok = distRect(p, b) - RADIUS <= WORK.wreckReach;
        return { text: ok ? `${key}: swing the ball!` : 'Drive up to the old cannery', btn: ok ? 'SWING' : 'HONK' };
    }
    return { text: '', btn: 'HONK' };
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onVeh, onJob }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.key = 'SPACE';
        this.onJob = onJob;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it lifts.
        // Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), touch = $('set-touch');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; touch.value = settings.touch;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, touch: touch.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, touch]) { el.addEventListener('change', changed); el.addEventListener('input', changed); }
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // the toy box
        this.vehBtns = {};
        VEHICLES.forEach((V, i) => {
            const b = document.createElement('button');
            b.className = 'veh'; b.dataset.veh = V.id; b.title = V.name; b.setAttribute('aria-label', `${V.name} (${i + 1})`);
            b.innerHTML = `<img src="art/veh-${V.id}.webp" alt="" width="64" height="64"><kbd>${i + 1}</kbd>`;
            // on finger-down, like the other touch controls; a click still works for keyboards and mice
            b.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { e.preventDefault(); onVeh(V.id); } });
            b.addEventListener('click', () => { onVeh(V.id); b.blur(); });
            $('toybox').appendChild(b);
            this.vehBtns[V.id] = b;
        });

        $('jobs-list').addEventListener('click', (e) => {
            const b = e.target.closest('.job');
            if (!b || b.classList.contains('locked') || b.classList.contains('done')) return;
            audio.ui('click');
            this.onJob(b.dataset.job);
        });
        this.okFn = null;
        for (const id of ['talk-ok', 'done-ok', 'finale-ok']) $(id).addEventListener('click', () => {
            audio.ui('click'); audio.stopVoice();
            const fn = this.okFn; this.okFn = null;
            this.closeScreen(id.split('-')[0]);
            fn?.();
        });
        this.last = {};
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another goes on top of it, whatever their order in the page
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

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) {
        const list = this.buttons(id);
        (list.find((b) => b.classList.contains('primary') || b.classList.contains('active')) || list[0])?.focus({ preventScroll: true });
    }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ the job board, and people talking
    showJobs(G) {
        $('jobs-stars').textContent = `★ ${G.stars} / ${MAX_STARS}`;
        $('jobs-list').innerHTML = JOBS.map((j) => {
            const s = G.jobs[j.id], g = GIVERS[j.giver];
            const cls = s.st === 'done' ? 'done' : s.st === 'locked' ? 'locked' : G.active === j.id ? 'active' : '';
            const st = s.st === 'done' ? stars(s.stars) : s.st === 'locked' ? '🔒' : G.active === j.id ? 'On the job' : s.step > 0 || s.prog ? 'Started' : 'New!';
            const sub = s.st === 'locked' ? `After: ${j.needs.filter((n) => G.jobs[n].st !== 'done').map((n) => JOB[n].title).join(', ')}` : `${g.name} · ${[...new Set(j.steps.map((x) => VEH[x.veh].name))].join(', ')}`;
            return `<button class="job ${cls}" data-job="${j.id}" ${s.st === 'locked' || s.st === 'done' ? 'aria-disabled="true"' : ''}><img src="${face(j.giver)}" alt="" width="46" height="46"><span><b>${j.title}</b><small>${sub}</small></span><span class="st">${st}</span></button>`;
        }).join('');
        this.openScreen('jobs');
    }

    /** Someone speaks. steps: a job's steps to list under the words. onOk runs when the button is pressed. */
    talk(giver, text, { steps = null, button = "Let's go!", voice = null, onOk = null } = {}) {
        const g = GIVERS[giver];
        $('talk-face').src = face(giver); $('talk-name').textContent = g.name; $('talk-role').textContent = g.role;
        $('talk-text').textContent = text;
        $('talk-steps').innerHTML = steps ? steps.map((s) => `<li><b>${VEH[s.veh].name}:</b> ${s.text}</li>`).join('') : '';
        $('talk-ok').textContent = button;
        this.okFn = onOk;
        this.openScreen('talk');
        if (voice) this.audio.voice(voice);
    }

    jobDone(job, n, time, onOk) {
        $('done-face').src = face(job.giver); $('done-job').textContent = `${job.title} · ${Math.round(time)} seconds`;
        $('done-stars').innerHTML = stars(n); $('done-stars').setAttribute('aria-label', `${n} of 3 stars`);
        $('done-text').textContent = `${GIVERS[job.giver].name}: “${job.done}”`;
        this.okFn = onOk;
        this.openScreen('done');
        this.audio.voice(`${job.id}-done`);
    }

    finale(G, text, onOk) {
        $('finale-text').textContent = `${text} You earned ${G.stars} of ${MAX_STARS} stars.`;
        this.okFn = onOk;
        this.openScreen('finale');
        this.audio.voice('finale');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    set(id, prop, val) { const k = id + prop; if (this.last[k] !== val) { this.last[k] = val; $(id)[prop] = val; } }
    hud(G) {
        const c = current(G), pr = progress(G), pm = prompt(G, this.key);
        this.set('clip-title', 'textContent', c ? c.job.title : G.finished ? 'All done!' : 'Job Board');
        this.set('clip-text', 'textContent', c ? c.st.text : G.finished ? 'Hard Hat Harbor is finished. Drive around and enjoy it!' : 'Pick a job from the board (J).');
        const src = c ? face(c.job.giver) : '';
        if (this.last.face !== src) { this.last.face = src; if (src) $('clip-face').src = src; else $('clip-face').removeAttribute('src'); }
        this.set('clip-bar', 'hidden', !pr);
        if (pr) { this.set('clip-count', 'textContent', `${pr.n} / ${pr.total}`); const w = `${Math.round(pr.n / pr.total * 100)}%`; if (this.last.fill !== w) { this.last.fill = w; $('clip-fill').style.width = w; } }
        this.set('stars-n', 'textContent', String(G.stars));
        this.set('hint', 'hidden', !pm.text);
        this.set('hint', 'textContent', pm.text);
        this.set('hint', 'className', 'plate' + (pm.wrong ? ' wrong' : ''));
        this.set('btn-a', 'textContent', pm.btn);
        this.set('meter', 'hidden', !pm.meter);
        if (pm.meter) $('meter-hook').style.left = `${50 + Math.sin(G.hookT) * 50}%`;
        const need = c ? c.st.veh : null;
        for (const V of VEHICLES) {
            const cls = 'veh' + (G.veh === V.id ? ' on' : '') + (need === V.id ? ' need' : '');
            if (this.last['v' + V.id] !== cls) { this.last['v' + V.id] = cls; this.vehBtns[V.id].className = cls; this.vehBtns[V.id].setAttribute('aria-pressed', String(G.veh === V.id)); }
        }
    }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        window.A11Y?.announce?.(text);
        setTimeout(() => el.remove(), 2900);
    }
}

// the green part of the crane's meter is exactly the window the sim accepts
document.documentElement.style.setProperty('--hook-window', String(WORK.hookWindow));
const zone = $('meter-zone');
if (zone) { zone.style.left = `${50 - WORK.hookWindow * 50}%`; zone.style.width = `${WORK.hookWindow * 100}%`; }
