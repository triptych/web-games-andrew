// The opening cinematic, played once at the start of a new game. Six painted shots (fal) with
// slow camera moves, hard cuts and white flashes, letterbox bars and subtitles, narrated by
// Captain Mirei (ElevenLabs) over the opening theme, then the title card. It is driven by the
// main loop's frame time, and it can always be skipped: the Skip button or Esc ends it,
// Enter / Space / a tap jumps to the next shot.

import { ART } from './media.js';

export const SHOTS = [
    { img: 0, vo: 'intro-1', text: 'Three years ago, the sky over Aozora Bay cracked open.', from: [1.18, 0, -4], to: [1.05, 0, 3] },
    { img: 1, vo: 'intro-2', text: 'Out of the Lattice came the Cubeborn… and everything they touched turned to cubes.', from: [1.05, 3, 2], to: [1.2, -3, -2], cut: 'flash' },
    { img: 2, vo: 'intro-3', text: 'What is left of us fights on from the sky carrier Skylark.', from: [1.1, -4, 0], to: [1.1, 4, 0] },
    { img: 3, vo: 'intro-4', text: 'Our last hope is one pilot… and one machine.', from: [1.0, 0, 0], to: [1.22, 0, -3], shake: true },
    { img: 4, vo: 'intro-5', text: 'Shardframe Unit-07. Kai Arashi. Launch!', from: [1.35, 6, 2], to: [1.05, -2, 0], cut: 'flash', lines: true },
    { img: 5, vo: 'intro-6', text: 'Bring them home, Kai.', from: [1.25, 0, 4], to: [1.08, 0, 0], cut: 'flash' },
];
const MIN_SHOT = 4.2, TITLE_CARD = 2.4;

export class Cinematic {
    constructor({ audio, onDone }) {
        this.audio = audio;
        this.onDone = onDone;
        this.el = document.getElementById('intro');
        this.stage = document.getElementById('intro-stage');
        this.sub = document.getElementById('intro-sub');
        this.lines = document.getElementById('speedlines');
        this.active = false;
        this.imgs = SHOTS.map((s) => {
            const im = new Image();
            im.alt = '';
            im.src = ART.intro[s.img];
            return im;
        });
        document.getElementById('intro-skip').addEventListener('click', (e) => { e.stopPropagation(); this.finish(); });
        // a tap anywhere else moves on a shot
        this.el.addEventListener('pointerdown', (e) => { if (this.active && !e.target.closest('#intro-skip')) this.next(); });
    }

    start() {
        this.active = true;
        this.i = -1;
        this.t = 0;
        this.el.hidden = false;
        this.stage.replaceChildren(...this.imgs);
        this.audio.playMusic('title');
        this.next();
    }

    next() {
        if (!this.active) return;
        this.i++;
        this.t = 0;
        for (const im of this.imgs) im.classList.remove('on');
        this.lines.classList.remove('on');
        this.stage.querySelector('.card')?.remove();
        if (this.i >= SHOTS.length) {
            if (this.i === SHOTS.length) {
                const card = document.createElement('div');
                card.className = 'card outline';
                card.textContent = 'SHARDFRAME';
                this.stage.appendChild(card);
                this.sub.textContent = '';
                this.dur = TITLE_CARD;
                return;
            }
            return this.finish();
        }
        const S = SHOTS[this.i];
        const im = this.imgs[this.i];
        im.classList.add('on');
        // the camera move: a slow push, pan or pull across the painting
        const tf = ([s, x, y]) => `scale(${s}) translate(${x}%, ${y}%)`;
        this.dur = Math.max(MIN_SHOT, this.audio.voiceDuration(S.vo) + 0.9);
        try { im.animate([{ transform: tf(S.from) }, { transform: tf(S.to) }], { duration: this.dur * 1000, easing: 'ease-out', fill: 'forwards' }); } catch { im.style.transform = tf(S.to); }
        if (S.shake && !window.A11Y?.reducedMotion) {
            try { this.stage.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(0,0)' }], { duration: 260, iterations: 3 }); } catch { /* */ }
        }
        if (S.cut === 'flash' && !window.A11Y?.reducedMotion) { this.el.classList.remove('whiteout'); void this.el.offsetWidth; this.el.classList.add('whiteout'); }
        if (S.lines) this.lines.classList.add('on');
        this.sub.textContent = S.text;
        this.audio.say(S.vo, { force: true });
        if (this.i === 4) this.audio.play('overdrive', { vol: 0.6 });
    }

    /** Called every frame with real seconds. */
    update(dt) {
        if (!this.active) return;
        this.t += dt;
        if (this.t >= this.dur) this.next();
    }

    finish() {
        if (!this.active) return;
        this.active = false;
        this.el.hidden = true;
        this.el.classList.remove('whiteout');
        this.lines.classList.remove('on');
        this.audio.shutUp();
        this.onDone?.();
    }
}
