// Full-screen prompts: learning a technique, evolution (and what it installed), the wreck-repair
// welding minigame, and the ending.

import { $, esc, typeChip, botImg, focusFirst, fmtTime } from './dom.js';
import { SPECIES } from '../sim/dex.js';
import { MOVES, moveDesc } from '../sim/data/moves.js';
import { TRAITS } from '../sim/data/traits.js';
import { TYPE_INFO } from '../sim/data/types.js';
import { name as unitName } from '../sim/unit.js';

export class Prompts {
    constructor(app) {
        this.app = app;
        this.root = $('prompt');
        this.kind = null;
    }
    get open() { return !this.root.classList.contains('hidden'); }
    hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; this.kind = null; clearInterval(this.timer); cancelAnimationFrame(this.raf); }
    showHtml(kind, html) {
        this.kind = kind;
        this.root.className = `prompt ${kind}`;
        this.root.innerHTML = html;
        this.root.classList.remove('hidden');
        focusFirst(this.root);
    }
    respond(v) { this.hide(); this.app.respond(v); }

    // ------------------------------------------------------------------ learn
    learn(p) {
        const u = this.app.game.unitByUid(p.uid);
        const nm = MOVES[p.move];
        const row = (mv, extra = '') => `<b>${esc(mv.name)}</b> ${typeChip(mv.type, true)} <span class="mmeta">${mv.cat === 'K' ? 'Kinetic' : mv.cat === 'E' ? 'Energy' : 'Utility'}${mv.pow > 1 ? ` · Power ${mv.pow}` : ''}${mv.acc ? ` · ${mv.acc}%` : ''}</span>${extra}<div class="mdesc">${esc(moveDesc(mv))}</div>`;
        this.showHtml('learn', `<div class="pbox">
            <div class="ptitle">${botImg(u.sp, u.gilded, 'timg')} ${esc(unitName(u))} wants to learn ${esc(nm.name)}</div>
            <div class="mrow new" style="--tc:${TYPE_INFO[nm.type].color}">${row(nm)}</div>
            <div class="psub">It already knows four techniques. Forget one?</div>
            ${u.moves.map((m, i) => `<button class="mrow btn" data-i="${i}" style="--tc:${TYPE_INFO[MOVES[m.id].type].color}">${row(MOVES[m.id], ` <span class="mmeta">${m.pp}/${MOVES[m.id].pp}</span>`)}</button>`).join('')}
            <button class="ghost default" data-i="-1">Don't learn ${esc(nm.name)}</button></div>`);
        this.root.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.app.audio.sfx(+b.dataset.i >= 0 ? 'learn' : 'back'); this.respond(+b.dataset.i); }));
    }

    // ------------------------------------------------------------------ evolution
    evolve(p) {
        const u = this.app.game.unitByUid(p.uid);
        const from = SPECIES[p.from], to = SPECIES[p.to];
        this.showHtml('evolve', `<div class="evobox">
            <div class="evotext" id="evotext">What? ${esc(unitName(u))} is evolving!</div>
            <div class="evostage"><div class="evorays"></div>${botImg(from.id, u.gilded, 'evo-from')}${botImg(to.id, u.gilded, 'evo-to')}</div>
            <button class="ghost" id="evostop">Hold B to stop it</button></div>`);
        this.app.audio.music('evolve');
        this.app.audio.sfx('evostart');
        const stage = this.root.querySelector('.evostage');
        let t = 0, last = performance.now(), cancelled = false;
        const stop = () => { if (t < 4.2) { cancelled = true; } };
        $('evostop').addEventListener('click', stop);
        this.cancel = stop;
        const tick = (now) => {
            const dt = (now - last) / 1000 * this.app.fast; last = now; t += dt;
            // Flicker between the two forms, faster and faster.
            const f = Math.sin(t * t * 2.4) > 0;
            stage.classList.toggle('show-to', t > 1 && f);
            stage.classList.toggle('glow', t > 0.6);
            if (cancelled) { this.app.audio.sfx('nope'); this.app.audio.music(this.app.musicFor()); this.respond(false); return; }
            if (t >= 4.4) {
                stage.classList.add('show-to', 'done');
                this.app.audio.sfx('evolved');
                $('evotext').textContent = `Congratulations! ${unitName(u)} evolved into ${to.name}!`;
                setTimeout(() => this.respond(true), 1100 / this.app.fast);
                return;
            }
            this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
    }

    evolved(p) {
        const to = SPECIES[p.to];
        const parts = p.parts.map((x) => `<span class="part new">${esc(x.name)}</span>`).join('');
        const traits = p.traits.map((t) => `<div class="trait"><b>${esc(TRAITS[t].name)}</b> — ${esc(TRAITS[t].desc)}</div>`).join('');
        const learned = p.learned.map((m) => `<span class="mchip" style="--tc:${TYPE_INFO[MOVES[m].type].color}">${esc(MOVES[m].name)}</span>`).join('');
        this.showHtml('evolved', `<div class="pbox">
            <div class="ptitle">${botImg(to.id, false, 'bigimg')}</div>
            <div class="ptitle">${esc(to.name)} ${to.types.map((t) => typeChip(t)).join(' ')}</div>
            <div class="entry">${esc(to.entry)}</div>
            ${parts ? `<div class="sect">New parts installed</div><div class="parts">${parts}</div>` : ''}
            ${traits ? `<div class="sect">New trait</div>${traits}` : ''}
            ${learned ? `<div class="sect">New techniques from its parts</div><div class="parts">${learned}</div>` : ''}
            ${p.pending.length ? `<div class="psub">…and it wants to learn ${p.pending.map((m) => esc(MOVES[m].name)).join(', ')}.</div>` : ''}
            <button class="default">Brilliant!</button></div>`);
        this.app.audio.music(this.app.musicFor());
        this.root.querySelector('button').addEventListener('click', () => this.respond(null));
    }

    // ------------------------------------------------------------------ repair minigame
    repair(p) {
        const S = SPECIES[p.sp];
        this.showHtml('repair', `<div class="pbox repairbox">
            <div class="ptitle">Repairing a dormant ${esc(S.name)}</div>
            <div class="psub">Weld each joint when the needle is in the bright zone. Press A (or tap WELD) — three joints.</div>
            <div class="dial"><svg viewBox="-100 -100 200 120"><path class="arc" d="M-80 0 A80 80 0 0 1 80 0"/><path id="zone" class="zone"/><line id="needle" x1="0" y1="0" x2="0" y2="-74"/><circle r="8" class="hub"/></svg></div>
            <div class="joints" id="joints"><span></span><span></span><span></span></div>
            <button class="default weld" id="weld">🔥 WELD</button></div>`);
        let round = 0, score = 0, ang = -80, dir = 1, last = performance.now();
        const zones = [[-10, 22], [18, 16], [-48, 11]];
        const setZone = () => {
            const [c, w] = zones[round];
            const a0 = ((c - w / 2) * Math.PI) / 180, a1 = ((c + w / 2) * Math.PI) / 180;
            const pt = (a) => `${Math.sin(a) * 80} ${-Math.cos(a) * 80}`;
            $('zone').setAttribute('d', `M${pt(a0)} A80 80 0 0 1 ${pt(a1)}`);
        };
        setZone();
        const speed = [110, 150, 190];
        const tick = (now) => {
            const dt = Math.min(0.05, (now - last) / 1000); last = now;
            ang += dir * speed[round] * dt;
            if (ang > 80) { ang = 80; dir = -1; } if (ang < -80) { ang = -80; dir = 1; }
            const n = $('needle'); if (n) n.setAttribute('transform', `rotate(${ang})`);
            this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
        const weld = () => {
            const [c, w] = zones[round];
            const hit = Math.abs(ang - c) <= w / 2;
            if (hit) score++;
            this.app.audio.sfx(hit ? 'weld' : 'nope');
            $('joints').children[round].className = hit ? 'ok' : 'bad';
            round++;
            if (round >= 3) { cancelAnimationFrame(this.raf); setTimeout(() => this.respond(score), 500); return; }
            setZone();
        };
        this.weld = weld;
        $('weld').addEventListener('click', weld);
    }

    // ------------------------------------------------------------------ ending
    ending() {
        const st = this.app.game.state;
        const team = st.party.map((u) => `<div class="cteam">${botImg(u.sp, u.gilded, 'timg')}<span>${esc(unitName(u))} · Lv${u.lv}</span></div>`).join('');
        this.showHtml('ending', `<div class="endbox">
            <div class="endsky"></div>
            <div class="endtitle">CHAMPION OF MIDDEN</div>
            <div class="endtext">The Aurelia's boilers roar. Steam pours across the Starport as the old ship lifts out of the junk sea, through the smog, past the great ring of dead ships, and out into the dark.<br><br>On the observation deck, a scrap kid from Cinderwick presses their face to the glass. Somewhere below, Ma Bellows is already welding something new.</div>
            <div class="sect">The team that won it</div><div class="cteams">${team}</div>
            <div class="endstats"><span>${Object.keys(st.owned).length} COM-bots registered</span><span>${st.battles} battles</span><span>${st.wrecks} wrecks repaired</span><span>${st.evolved} evolutions</span><span>${fmtTime(st.playtime)} played</span></div>
            <div class="credits">SCRAPWRIGHT · a steampunk COM-bot adventure · every bot, place and sound generated in code</div>
            <button class="default">Keep exploring Midden</button></div>`);
        this.app.audio.music('ending');
        this.root.querySelector('button').addEventListener('click', () => { this.respond(null); this.app.audio.music(this.app.musicFor()); });
    }

    /** Keyboard A / B while a prompt is open. */
    press() {
        if (this.kind === 'repair' && this.weld) { this.weld(); return true; }
        const b = document.activeElement && this.root.contains(document.activeElement) ? document.activeElement : this.root.querySelector('button.default');
        if (b) { b.click(); return true; }
        return false;
    }
    back() {
        if (this.kind === 'evolve' && this.cancel) { this.cancel(); return true; }
        if (this.kind === 'learn') { const b = this.root.querySelector('button[data-i="-1"]'); if (b) b.click(); return true; }
        return false;
    }
}
