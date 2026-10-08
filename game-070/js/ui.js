// DOM layout: fits the 4:3 monitor into the window and arranges the cabinet
// around it. Wide desktops get side panels; a portrait phone gets the monitor on
// top and a control deck underneath; a landscape phone gets the stick and the
// buttons either side of the monitor.

export class UI {
    constructor() {
        this.body = document.body;
        this.screenEl = document.getElementById('screen');
        this.canvas = document.getElementById('game');
        this.stickEl = document.getElementById('stick');
        this.knobEl = this.stickEl ? this.stickEl.querySelector('.knob') : null;
        this.fireEl = document.getElementById('btn-fire');
        this.bombEl = document.getElementById('btn-bomb');
        this.hyperEl = document.getElementById('btn-hyper');
        this.pauseEl = document.getElementById('btn-pause');
        this.touch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);
        if (this.touch) this.body.classList.add('touch');
        this.rect = null;
        this.onResize = null;
    }

    markTouch() {
        if (this.touch) return;
        this.touch = true;
        this.body.classList.add('touch');
        if (this.onResize) this.onResize();
    }

    screenRect() { return this.rect || (this.rect = this.canvas.getBoundingClientRect()); }

    layout(renderer) {
        const vv = window.visualViewport;
        const vw = Math.round(vv ? vv.width : window.innerWidth), vh = Math.round(vv ? vv.height : window.innerHeight);
        let sw, sh, mode;
        if (this.touch && vh >= vw) {
            mode = 'portrait';
            sw = vw; sh = sw * 0.75;
            if (vh - sh < 200) { sh = Math.max(120, vh - 200); sw = sh / 0.75; }
        } else if (this.touch) {
            mode = 'landscape';
            sh = vh; sw = sh / 0.75;
            const sideMin = 128;
            if (sw > vw - 2 * sideMin) { sw = Math.max(200, vw - 2 * sideMin); sh = sw * 0.75; }
        } else {
            mode = 'desktop';
            sh = vh - 16; sw = sh / 0.75;
            if (sw > vw - 16) { sw = vw - 16; sh = sw * 0.75; }
        }
        sw = Math.floor(sw); sh = Math.floor(sh);
        const left = Math.floor((vw - sw) / 2);
        const top = mode === 'portrait' ? 0 : Math.floor((vh - sh) / 2);
        const st = this.body.style;
        st.setProperty('--sw', sw + 'px'); st.setProperty('--sh', sh + 'px');
        st.setProperty('--sl', left + 'px'); st.setProperty('--st', top + 'px');
        st.setProperty('--deck', Math.max(0, vh - sh) + 'px');
        st.setProperty('--side', Math.max(0, left) + 'px');
        this.body.dataset.layout = mode;
        if (mode === 'landscape' && left < 170) this.body.dataset.tight = '1'; else delete this.body.dataset.tight;
        this.body.classList.toggle('wide', mode === 'desktop' && left >= 200);
        renderer.resize(sw, sh, window.devicePixelRatio || 1);
        this.rect = null;
    }

    setPlaying(on) { this.body.classList.toggle('playing', on); }

    setKnob(x, y, active) {
        if (!this.knobEl) return;
        this.stickEl.classList.toggle('active', active);
        this.knobEl.style.setProperty('--kx', `${x}px`);
        this.knobEl.style.setProperty('--ky', `${y}px`);
    }
}
