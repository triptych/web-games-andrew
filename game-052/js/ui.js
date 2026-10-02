// DOM HUD: dash, radio readout, district banner, stop prompt, the parked
// card, toasts, the menu and touch controls. Markup lives in index.html.

const $ = (id) => document.getElementById(id);

export class UI {
    constructor() {
        this.el = {
            hud: $('hud'), speed: $('speed'), cruise: $('cruise'), clock: $('clock'), odo: $('odo'), district: $('district'),
            blinker: $('blinker'), rFreq: $('r-freq'), rName: $('r-name'), rTrack: $('r-track'),
            banner: $('banner'), bannerSmall: $('banner-small'), bannerBig: $('banner-big'),
            prompt: $('prompt'), toasts: $('toasts'), touch: $('touch'),
            stopcard: $('stopcard'), scLabel: $('sc-label'), scName: $('sc-name'), scLine: $('sc-line'), scResult: $('sc-result'),
            scAction: $('sc-action'), scGo: $('sc-go'),
            title: $('title'), tStart: $('t-start'), tLoading: $('t-loading'),
            menu: $('menu'), log: $('log'), logEmpty: $('log-empty'), camLabel: $('cam-label'),
            drift: $('btn-drift'),
        };
        this._last = {};
        this._trackTimer = null;
        this._bannerTimer = null;
        this.el.tStart.classList.add('hidden');
    }

    _set(key, el, text) {
        if (this._last[key] === text) return;
        this._last[key] = text;
        el.textContent = text;
    }

    ready() {
        this.el.tLoading.classList.add('hidden');
        this.el.tStart.classList.remove('hidden');
    }

    start() {
        this.el.title.classList.add('gone');
        this.el.hud.classList.remove('hidden');
        setTimeout(() => this.el.title.classList.add('hidden'), 1300);
    }

    dash(car, clock, district) {
        this._set('speed', this.el.speed, String(Math.round(car.kmh)).padStart(3, '0'));
        this._set('cruise', this.el.cruise, String(Math.round(car.cruise * 3.6)));
        this._set('clock', this.el.clock, clock);
        this._set('odo', this.el.odo, `${(car.odo / 1000).toFixed(1)} KM`);
        this._set('district', this.el.district, district);
        const b = car.blinker < 0 ? '◀' : car.blinker > 0 ? '▶' : '';
        if (this._last.blink !== b) {
            this._last.blink = b;
            this.el.blinker.textContent = b;
            this.el.blinker.classList.toggle('on', !!b);
        }
    }

    radio(st, track) {
        this.el.rFreq.textContent = st.freq;
        this.el.rName.textContent = st.name;
        if (track) {
            this.el.rTrack.textContent = `♪ ${track.title} — ${track.artist}`;
            this.el.rTrack.classList.add('on');
            clearTimeout(this._trackTimer);
            this._trackTimer = setTimeout(() => this.el.rTrack.classList.remove('on'), 9000);
        } else {
            this.el.rTrack.classList.remove('on');
        }
    }

    banner(small, big) {
        this.el.bannerSmall.textContent = small;
        this.el.bannerBig.textContent = big;
        this.el.banner.classList.add('on');
        clearTimeout(this._bannerTimer);
        this._bannerTimer = setTimeout(() => this.el.banner.classList.remove('on'), 4200);
    }

    prompt(text, armed) {
        if (!text) {
            if (this._last.prompt !== '') { this._last.prompt = ''; this.el.prompt.classList.add('hidden'); }
            return;
        }
        this.el.prompt.classList.remove('hidden');
        this._set('prompt', this.el.prompt, text);
        this.el.prompt.classList.toggle('armed', !!armed);
    }

    toast(text) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = text;
        this.el.toasts.appendChild(t);
        while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
        setTimeout(() => t.remove(), 4100);
    }

    showStop(st, district, time) {
        const e = this.el;
        e.scLabel.textContent = `${st.label} · ${district} · ${time}`;
        e.scName.textContent = st.name;
        e.scLine.textContent = '';
        e.scResult.classList.add('hidden');
        e.scAction.textContent = st.def.action;
        e.scAction.disabled = false;
        e.scGo.disabled = false;
        e.stopcard.classList.remove('hidden');
    }

    stopLine(text) {
        const l = this.el.scLine;
        l.classList.add('fade');
        setTimeout(() => { l.textContent = text; l.classList.remove('fade'); }, 700);
    }

    stopResult(text) {
        this.el.scResult.textContent = text;
        this.el.scResult.classList.remove('hidden');
        this.el.scAction.disabled = true;
    }

    stopLeaving() { this.el.scGo.disabled = true; this.el.scAction.disabled = true; }
    hideStop() { this.el.stopcard.classList.add('hidden'); }

    menu(open) { this.el.menu.classList.toggle('hidden', !open); }
    get menuOpen() { return !this.el.menu.classList.contains('hidden'); }

    log(entries) {
        this.el.log.innerHTML = '';
        this.el.logEmpty.classList.toggle('hidden', entries.length > 0);
        for (const e of entries.slice().reverse()) {
            const li = document.createElement('li');
            const a = document.createElement('span');
            a.textContent = `${e.name} — ${e.label}, ${e.district}`;
            const b = document.createElement('span');
            b.textContent = `${e.time} · ${e.km} km`;
            li.append(a, b);
            this.el.log.appendChild(li);
        }
    }

    settings(s) {
        const mark = (id, v) => {
            for (const b of document.querySelectorAll(`#${id} button`)) b.classList.toggle('on', b.dataset.v === String(v));
        };
        mark('set-res', s.res);
        mark('set-retro', s.retro ? 1 : 0);
        mark('set-refl', s.refl ? 1 : 0);
        mark('set-rain', s.rain);
        $('set-music').value = s.music;
        $('set-sfx').value = s.sfx;
    }

    camLabel(text) { this.el.camLabel.textContent = text; }
    drift(on) { this.el.drift.classList.toggle('on', on); }
    hudHidden(off) { this.el.hud.classList.toggle('hud-off', off); }
    touch(on) {
        this.el.touch.classList.toggle('hidden', !on);
        document.body.classList.toggle('touch', on);
    }
}
