// DOM layout: fits the 3:4 monitor into the window and arranges the cabinet around
// it — side art on wide desktops, a control deck under the screen on portrait
// phones, pad and buttons either side on landscape phones.

export class UI {
    constructor() {
        this.body = document.body;
        this.screenEl = document.getElementById('screen');
        this.canvas = document.getElementById('game');
        this.deckEl = document.getElementById('deck');
        this.padEl = document.getElementById('pad');
        this.fireEl = document.getElementById('btn-fire');
        this.bombEl = document.getElementById('btn-bomb');
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
    padWidth() { return this.padEl ? this.padEl.getBoundingClientRect().width : 200; }

    layout(renderer) {
        const vw = window.innerWidth, vh = window.innerHeight;
        let sw, sh, mode;
        if (this.touch && vh >= vw) {
            mode = 'portrait';
            const minDeck = 150;
            sw = Math.min(vw, (vh - minDeck) * 0.75);
            sh = sw / 0.75;
        } else if (this.touch) {
            mode = 'landscape';
            sh = vh; sw = sh * 0.75;
            if (sw > vw - 200) { sw = Math.max(160, vw - 200); sh = sw / 0.75; }
        } else {
            mode = 'desktop';
            sh = vh - 12; sw = sh * 0.75;
            if (sw > vw - 12) { sw = vw - 12; sh = sw / 0.75; }
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
        this.body.classList.toggle('wide', mode === 'desktop' && left >= 200);
        renderer.resize(sw, sh, window.devicePixelRatio || 1);
        this.rect = null;
    }

    setPlaying(on) { this.body.classList.toggle('playing', on); }
}
