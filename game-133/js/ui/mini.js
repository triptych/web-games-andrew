// The five mini-game screens. Each draws G.mg and sends { t: 'mg', a } inputs; the rules are all in
// js/sim/minigames.js. The Cauldron shows its recipe here (lighting each ingredient in turn) before it takes input.

import { MG, RANKS } from '../config.js';
import { INGREDIENTS, MASKED, formValid } from '../sim/minigames.js';
import { advName } from '../sim/game.js';
import { faceStyle } from '../assets.js';

const $ = (id) => document.getElementById(id);
const NAMES = { stamp: 'Stamp Rush', brew: 'The Cauldron', route: 'Cartography', dice: 'Dragon\'s Hoard', spar: 'The Sparring Ring' };
const TERRAIN = { 1: '', 2: '🌲', 3: '⛰️', 4: '🌿', 9: '🏔️' };
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ICON = ['🌙', '🔥', '🐸', '✨'];
const SITE = ['near town', 'the wilds', 'cursed ground'];
const cmd = (a) => `data-cmd='${JSON.stringify({ t: 'mg', a })}'`;
const rank = (r) => `<span class="rank r${r}">${RANKS[r]}</span>`;

export class Mini {
    constructor({ audio, send }) {
        this.audio = audio; this.send = send;
        this.show = null;                  // the Cauldron's recipe being shown: { key, i, t }
        this.speed = 1;
    }

    /** Is the Cauldron still showing its recipe? (Input waits until it has.) */
    get showing() { return !!this.show && this.show.i < this.show.n; }

    draw(G) {
        const mg = G.mg;
        $('mg-head').textContent = NAMES[mg.game];
        const body = $('mg-body');
        if (mg.done) {
            const r = mg.result;
            body.innerHTML = `<div class="result"><h3>${r.title}</h3><div class="stars" aria-label="${r.stars} of 3 stars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div>
                ${r.lines.map((l) => `<p>${l}</p>`).join('')}</div><div class="sheet-foot"><button class="btn primary" id="mg-close" data-cmd='{"t":"mgclose"}'>Back to the desk</button></div>`;
            this.show = null;
            return;
        }
        body.innerHTML = this[mg.game](G, mg);
    }

    stamp(G, mg) {
        const f = mg.forms[mg.i];
        const yn = (v, y, n) => `<span class="${v ? 'yes' : 'no'}">${v ? y : n}</span>`;
        return `<div class="mg-top"><span>Form ${mg.i + 1} of ${mg.forms.length}</span><span>✔ ${mg.right} · ✘ ${mg.wrong} / ${MG.stamp.strikes}</span><span>⏳ <b id="mg-time">${Math.ceil(mg.time)}</b>s</span></div>
            <span class="bar gold"><i id="mg-bar" style="width:${(mg.time / MG.stamp.time) * 100}%"></i></span>
            <div class="form" style="margin-top:10px"><b>${f.party}</b> request a job.<br>
                Job rank: ${rank(f.q)} · Party rank: ${rank(f.p)}<br>
                Client's seal: ${yn(f.seal, 'present', 'MISSING')} · Signature: ${yn(f.sign, 'signed', 'UNSIGNED')}<br>
                Fee: ${yn(f.paid, 'paid', 'UNPAID')} · Ground: ${SITE[f.site]}${f.site === 2 ? ` · Platinum countersign: ${yn(f.counter, 'yes', 'NONE')}` : ''}</div>
            <p class="dim small">Approve only with seal, signature and fee, a party at least the job's rank, and a countersign on cursed ground.</p>
            <div class="mg-acts"><button class="btn danger" id="mg-no" ${cmd('no')}>✘ Reject</button><button class="btn primary" id="mg-ok" ${cmd('ok')}>✔ Approve</button></div>`;
    }

    brew(G, mg) {
        const key = `${mg.round}|${mg.seq.join('')}`;
        if (!this.show || this.show.key !== key) this.show = { key, i: 0, t: 0.5, n: mg.seq.length, seq: mg.seq.slice() };
        const lit = this.showing && this.show.t < 0.45 ? this.show.seq[this.show.i] : -1;
        return `<div class="mg-top"><span>Recipe ${mg.round + 1} of ${MG.brew.rounds.length}</span><span>🧪 bottled: ${mg.made}</span><span id="brew-say">${this.showing ? 'Watch the recipe…' : `Now you: ${mg.pos} / ${mg.seq.length}`}</span></div>
            <div class="pots">${INGREDIENTS.map((n, i) => `<button class="btn ${lit === i ? 'lit' : ''}" data-pot="${i}" ${cmd(i)} ${this.showing ? 'disabled' : ''}>${ICON[i]} ${n}</button>`).join('')}</div>
            <p class="dim small" style="text-align:center">Add the ingredients in the order shown. One wrong, and the pot is spoiled.</p>`;
    }

    route(G, mg) {
        const w = mg.grid[0].length;
        const trail = new Set(mg.trail.map(([x, y]) => y * w + x));
        const cells = mg.grid.map((row, y) => row.map((c, x) => {
            const here = x === mg.x && y === mg.y, goal = x === mg.gx && y === mg.gy;
            return `<div class="t${c} ${here ? 'here' : trail.has(y * w + x) ? 'trail' : ''}">${here ? '🧭' : goal ? '🚩' : TERRAIN[c]}${c < 9 ? `<span class="cost">${c}</span>` : ''}</div>`;
        }).join('')).join('');
        return `<div class="mg-top"><span>Supplies used: <b id="route-spent">${mg.spent}</b> of ${mg.budget}</span><span class="dim small">Road 1 · forest 2 · hills 3 · marsh 4 · peaks impassable</span></div>
            <div class="map" style="grid-template-columns:repeat(${w},1fr)">${cells}</div>
            <div class="dpad"><span></span><button class="btn" aria-label="Up" ${cmd('u')}>▲</button><span></span>
                <button class="btn" aria-label="Left" ${cmd('l')}>◀</button><button class="btn" aria-label="Down" ${cmd('d')}>▼</button><button class="btn" aria-label="Right" ${cmd('r')}>▶</button></div>
            <p class="dim small" style="text-align:center">Reach the flag without running out of supplies. Arrow keys work too.</p>`;
    }

    dice(G, mg) {
        return `<div class="mg-top"><span>Round ${Math.min(mg.round + 1, MG.dice.rounds)} of ${MG.dice.rounds}</span><span>In the pot: <b id="dice-pot">${mg.pot}</b></span><span>Banked: <b id="dice-bank">${mg.banked}</b>g</span></div>
            <div class="dice">${mg.last ? `<span>${DIE[mg.last[0]]}</span><span>${DIE[mg.last[1]]}</span>` : '<span class="dim" style="font-size:18px">Roll the bones.</span>'}</div>
            <p style="text-align:center" class="${mg.bust ? 'fail' : 'dim'}">${mg.bust ? (mg.last[0] === 1 && mg.last[1] === 1 ? 'Snake eyes! The dragon takes everything you banked.' : 'A one! The pot is lost.') : 'Each roll adds to the pot. A one loses the pot; two ones lose it all.'}</p>
            <div class="mg-acts"><button class="btn" id="mg-bank" ${cmd('bank')} ${mg.pot ? '' : 'disabled'}>Bank ${mg.pot}</button><button class="btn primary" id="mg-roll" ${cmd('roll')}>🎲 Roll</button></div>`;
    }

    spar(G, mg) {
        const a = G.advs.find((x) => x.id === mg.adv);
        const last = mg.last ? `<p style="text-align:center" class="${mg.last.res === 'win' ? 'win' : mg.last.res === 'lose' ? 'fail' : 'dim'}">You chose ${mg.last.you}; they chose ${mg.last.them}. ${mg.last.res === 'win' ? 'A clean read!' : mg.last.res === 'lose' ? 'Ow.' : 'Blades lock.'}</p>` : '';
        return `<div class="mg-top"><span class="face" style="${faceStyle(mg.adv)}"></span><span>${advName(mg.adv)} ${rank(a.rank)}</span><span>Exchange ${mg.round + 1} of ${MG.spar.rounds} · read: ${mg.wins}</span></div>
            ${last}<div class="tell" id="spar-tell">${mg.tell === MASKED ? `<span class="dim">${mg.tell}</span>` : mg.tell}</div>
            <div class="mg-acts"><button class="btn" ${cmd('strike')}>🗡️ Strike</button><button class="btn" ${cmd('guard')}>🛡️ Guard</button><button class="btn" ${cmd('feint')}>💨 Feint</button></div>
            <p class="dim small" style="text-align:center">Guard beats Strike · Strike beats Feint · Feint beats Guard. The Handbook lists the tells.</p>`;
    }

    /** Called every frame while a mini-game is up: the sand-glass, and the Cauldron's recipe. */
    tick(G, dt = 0) {
        const mg = G.mg;
        if (!mg || mg.done) return;
        if (mg.game === 'stamp') {
            const t = $('mg-time');
            if (t) { t.textContent = Math.ceil(mg.time); $('mg-bar').style.width = (mg.time / MG.stamp.time) * 100 + '%'; }
        } else if (mg.game === 'brew' && this.showing) {
            const before = this.show.i, lit = this.show.t < 0.45;
            this.show.t += dt * this.speed;
            if (this.show.t >= 0.75) { this.show.t = 0; this.show.i++; }
            if (before !== this.show.i || lit !== (this.show.t < 0.45)) {
                if (this.show.t < 0.45 && this.showing) this.audio.sfx('drop', 0.5);
                this.draw(G);
            }
        }
    }

    /** Arrow keys for Cartography, digits for the Cauldron, Y/N for the forms. */
    key(G, code) {
        const mg = G.mg;
        if (!mg || mg.done) return false;
        const map = mg.game === 'route' ? { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r' }
            : mg.game === 'brew' && !this.showing ? { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }
            : mg.game === 'stamp' ? { KeyY: 'ok', KeyN: 'no' } : {};
        if (!(code in map)) return false;
        this.send({ t: 'mg', a: map[code] });
        return true;
    }
}
export { formValid };
