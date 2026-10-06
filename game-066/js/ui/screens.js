// The title screen and the new-game screen (name and look, with a rendered preview).

import { $, esc, personImg, focusFirst } from './dom.js';
import { LOOKS } from '../sim/data/story.js';
import { VERSION } from '../config.js';

const SKINS = ['#f4d8c0', '#f0c8a0', '#e0b48a', '#c89070', '#a87050', '#8a5a3a', '#6a4a3a'];
const HAIRS = ['#1a1410', '#3a2418', '#6a3a1a', '#a8582a', '#d8b060', '#c8c8c8', '#2a4a8a', '#8a2a5a'];
const COATS = ['#7a3a22', '#2a4a6a', '#3a5a3a', '#5a3a5a', '#8a6a2a', '#a8201a', '#2a2a30', '#2e8a8a'];
const HATS = [['cap', 'Cap'], ['top', 'Top hat'], ['bowler', 'Bowler'], ['aviator', 'Aviator'], ['bandana', 'Bandana'], ['none', 'None']];
const STYLES = [['messy', 'Messy'], ['short', 'Short'], ['long', 'Long'], ['bun', 'Bun'], ['spiky', 'Spiky'], ['slick', 'Slick']];

export class Screens {
    constructor(app) {
        this.app = app;
        this.root = $('screens');
    }
    get open() { return !this.root.classList.contains('hidden'); }
    hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; this.kind = null; }

    title(hasSave, info) {
        this.kind = 'title';
        this.root.classList.remove('hidden');
        this.root.innerHTML = `<section class="screen title">
            <div class="logo"><div class="cog c1">⚙</div><div class="cog c2">⚙</div><span class="l1">SCRAP</span><span class="l2">WRIGHT</span></div>
            <div class="tagline">Find them. Fix them. Build them. Win your way off a planet of junk.</div>
            <div class="tmenu">
                ${hasSave ? `<button class="default" data-a="continue">Continue <small>${esc(info)}</small></button>` : ''}
                <button ${hasSave ? '' : 'class="default"'} data-a="new">New Game</button>
                <button data-a="settings">Settings</button>
            </div>
            <div class="tfoot">250 COM-bots · eight Forgemasters · one ticket off Midden · v${VERSION}</div></section>`;
        this.root.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
            this.app.audio.sfx('select');
            const a = b.dataset.a;
            if (a === 'continue') this.app.continueGame();
            else if (a === 'new') { if (!hasSave || confirm('Start a new game? Your saved game will be overwritten when you next save.')) this.newGame(); }
            else if (a === 'settings') this.app.menus.show('settings', {});
        }));
        focusFirst(this.root);
    }

    newGame() {
        this.kind = 'new';
        const look = { ...LOOKS.player };
        let name = 'Rivet';
        const render = () => {
            const sw = (k, list) => list.map((c) => `<button class="sw${look[k] === c ? ' on' : ''}" data-k="${k}" data-v="${c}" style="background:${c}" aria-label="${k} ${c}"></button>`).join('');
            const ch = (k, list) => list.map(([v, l]) => `<button class="chip${look[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join('');
            this.root.innerHTML = `<section class="screen newgame"><div class="ngbox">
                <div class="ptitle">Who are you, scrap kid?</div>
                <div class="nggrid">
                    <div class="ngprev">${personImg(look, 'preview-' + JSON.stringify(look), 'ngimg')}</div>
                    <div class="ngopts">
                        <label class="ngname">Name <input id="ngname" maxlength="12" value="${esc(name)}" autocomplete="off" spellcheck="false"></label>
                        <div class="ngrow"><span>Skin</span>${sw('skin', SKINS)}</div>
                        <div class="ngrow"><span>Hair</span>${sw('hair', HAIRS)}</div>
                        <div class="ngrow"><span>Style</span>${ch('hairStyle', STYLES)}</div>
                        <div class="ngrow"><span>Coat</span>${sw('coatColor', COATS)}</div>
                        <div class="ngrow"><span>Hat</span>${ch('hat', HATS)}</div>
                        <div class="ngrow"><span>Goggles</span><button class="chip${look.goggles ? ' on' : ''}" data-k="goggles" data-v="1">On</button><button class="chip${!look.goggles ? ' on' : ''}" data-k="goggles" data-v="0">Off</button></div>
                    </div>
                </div>
                <div class="prow"><button class="ghost" id="ngback">◂ Back</button><button class="default" id="ngstart">Wake up in Cinderwick ▸</button></div>
            </div></section>`;
            this.root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
                const k = b.dataset.k;
                look[k] = k === 'goggles' ? b.dataset.v === '1' : b.dataset.v;
                name = $('ngname').value;
                this.app.audio.sfx('select');
                render();
            }));
            $('ngname').addEventListener('input', (e) => { name = e.target.value; });
            $('ngback').addEventListener('click', () => this.app.toTitle());
            $('ngstart').addEventListener('click', () => { name = ($('ngname').value || 'Rivet').trim().slice(0, 12) || 'Rivet'; this.app.startNew(name, look); });
        };
        render();
        focusFirst(this.root);
    }

    press() { const b = document.activeElement && this.root.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON' ? document.activeElement : this.root.querySelector('button.default'); if (b) b.click(); }
}
