// The DOM layer: screens, the HUD, the edge markers, the mission computer's lines, the cards
// between asteroids, settings and the touch deck. Reads the sim; never changes it.

import { VERSION, PLAYER } from './config.js';
import { LEVELS, BRIEFS } from './sim/data.js';
import { objectives, right } from './sim/game.js';
import * as V from './sim/vec.js';

const $ = (id) => document.getElementById(id);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const LINES = {
    alarm: ['They have seen you, Commander.', 'Movement in the hangar.', 'That beacon is calling for help.'],
    turretDown: ['Beacon silenced.', 'One less voice.', 'Good. Keep going.'],
    exitOpen: ['The gate is open. Follow the light.', 'The way is open, Commander.'],
    hurtLow: ['Suit integrity is critical. Look for a repair kit.', 'Your suit cannot take much more.'],
    shieldDown: ['Its shield is down. Now, Commander.'],
    respawn: ['Suit restored. I have brought you back to the landing site.'],
    power: ['Weapon output increased.'],
};

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.commsT = 0;
        this.lastLine = {};
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

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), quality = $('set-quality'), diff = $('set-diff');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; quality.value = String(settings.quality); diff.value = settings.diff;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, quality: +quality.value, diff: diff.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, quality, diff]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved mission deleted.'); });

        this.markers = [];
        for (let i = 0; i < 10; i++) {
            const m = document.createElement('div');
            m.className = 'marker';
            m.innerHTML = '<span class="arrow"></span><span class="dist"></span>';
            m.hidden = true;
            $('markers').appendChild(m);
            this.markers.push(m);
        }
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another screen sits on top of it
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

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length > 0); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on;
        $('markers').hidden = !on;
        $('vitals').hidden = !on;
        if (!on) { $('card').hidden = true; $('comms').classList.remove('on'); }
        this.setTouch(this.touchOn, on);
    }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
        document.body.classList.toggle('touch', on);
    }

    hud(G, dt) {
        const P = G.player, def = LEVELS[G.level];
        $('hud-level').textContent = `${ROMAN[G.level]} · ${def.name}`;
        $('hud-score').textContent = String(G.score).padStart(7, '0');
        const alive = G.turrets.filter((t) => t.alive).length;
        let goal;
        if (G.exit.open) goal = 'THE GATE IS OPEN';
        else if (G.boss?.alive && !G.boss.shield) goal = 'DESTROY THE MONOLITH';
        else goal = `${G.boss ? 'PYLONS' : 'BEACONS'} ${G.turrets.length - alive} / ${G.turrets.length}`;
        $('hud-goal').textContent = goal;
        const hp = Math.max(0, P.hp) / PLAYER.hp;
        $('hp-fill').style.width = (hp * 100).toFixed(1) + '%';
        $('hp-fill').classList.toggle('low', hp < 0.3);
        $('lives').textContent = '◉'.repeat(Math.max(0, G.lives - 1));
        $('power').textContent = '▮'.repeat(P.power) + '▯'.repeat(3 - P.power);
        $('dash-ready').classList.toggle('on', P.dashCd <= 0);
        this.markersFor(G);
        // the intro card
        const card = $('card');
        if (G.phase === 'intro') {
            card.hidden = false;
            card.classList.remove('warp');
            $('card-num').textContent = `ASTEROID ${ROMAN[G.level]}`;
            $('card-name').textContent = def.name;
            $('card-title').textContent = def.title;
            card.style.opacity = String(Math.min(1, G.phaseT / 0.6));
        } else if (G.phase === 'warp') {
            card.hidden = false;
            card.classList.add('warp');
            card.style.opacity = '1';
        } else card.hidden = true;
        if (this.commsT > 0) { this.commsT -= dt; if (this.commsT <= 0) $('comms').classList.remove('on'); }
    }

    markersFor(G) {
        const P = G.player, R = G.world.R, Rv = right(P);
        const objs = G.phase === 'play' || G.phase === 'intro' ? objectives(G) : [];
        const w = innerWidth, h = innerHeight, cx = w / 2, cy = h / 2;
        const mx = cx - 34, my = cy - 58;
        let i = 0;
        for (const o of objs) {
            if (i >= this.markers.length) break;
            const dist = V.arc(P.p, o.p) * R;
            const m = this.markers[i++];
            if (dist < 7.5) { m.hidden = true; continue; }
            const d = V.toward(P.p, o.p);
            const sx = V.dot(d, Rv), sy = -V.dot(d, P.f);
            const k = Math.min(mx / Math.max(1e-6, Math.abs(sx)), my / Math.max(1e-6, Math.abs(sy)));
            m.hidden = false;
            m.className = 'marker ' + o.kind;
            m.style.transform = `translate(${(cx + sx * k).toFixed(1)}px, ${(cy + sy * k).toFixed(1)}px)`;
            m.firstChild.style.transform = `rotate(${Math.atan2(sy, sx).toFixed(3)}rad)`;
            m.lastChild.textContent = `${Math.round(dist * 10)} m`;
        }
        for (; i < this.markers.length; i++) this.markers[i].hidden = true;
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    /** The mission computer speaks: one line at a time at the foot of the screen. */
    say(text, secs = 4) {
        const c = $('comms');
        $('comms-text').textContent = text;
        c.classList.add('on');
        this.commsT = secs;
    }
    line(kind, G) {
        const now = G.t;
        if (this.lastLine[kind] && now - this.lastLine[kind] < 12) return;
        this.lastLine[kind] = now;
        const list = LINES[kind];
        this.say(list[Math.floor(now * 7) % list.length]);
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'level') this.say(BRIEFS[e.n] || '', 6);
            else if (e.type === 'alarm') this.line('alarm', G);
            else if (e.type === 'turretDown' && e.left > 0) this.line('turretDown', G);
            else if (e.type === 'exitOpen') this.say(LINES.exitOpen[G.level % 2], 5);
            else if (e.type === 'shieldDown') this.say(LINES.shieldDown[0], 5);
            else if (e.type === 'hurt' && e.hp < 30 && e.hp > 0) this.line('hurtLow', G);
            else if (e.type === 'respawn') this.say(LINES.respawn[0], 4);
            else if (e.type === 'pickup' && e.kind === 'power' && G.player.power <= 3) this.line('power', G);
            else if (e.type === 'warp') {
                $('card-num').textContent = 'BEYOND THE GATE';
                $('card-name').textContent = `+${e.bonus}`;
                $('card-title').textContent = e.level >= LEVELS.length - 1 ? 'Toward the sun' : 'Gate bonus';
            } else if (e.type === 'over' || e.type === 'win') this.showEnd(G, e.type === 'win');
        }
    }

    showEnd(G, won) {
        $('over-head').textContent = won ? 'PERIHELION' : 'MISSION LOST';
        $('over-text').textContent = won
            ? 'The last gate opens onto the sun itself, and the signal falls silent. Whatever built the lattice has been waiting a long time for someone to come this far. It is not waiting any more.'
            : `Your suit fails on ${LEVELS[G.level].name}. The signal goes on, patient, for whoever comes next.`;
        $('over-stats').innerHTML = `<tr><td>Score</td><td>${G.score}</td></tr><tr><td>Asteroid</td><td>${ROMAN[G.level]} · ${LEVELS[G.level].name}</td></tr><tr><td>Machines destroyed</td><td>${G.kills}</td></tr><tr><td>Mission time</td><td>${Math.floor(G.t / 60)}:${String(Math.floor(G.t % 60)).padStart(2, '0')}</td></tr>`;
    }
}
