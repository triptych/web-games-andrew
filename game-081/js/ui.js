// The DOM layer: screens, the world HUD, dialogue, the scan HUD, the journal (skills, codex,
// bestiary, evidence, story), the shop, the world map, scan results and the ending.
// Reads the sim; every change goes back through onAct(action).

import { VERSION } from './config.js';
import { HUES, KINDS, SEVS, SCHOOLS, SENSES, SENSE_ORDER, POWERS, goalLabel, codexEntries } from './sim/data/ailments.js';
import { SPECIES, SPECIES_IDS, CAST } from './sim/data/species.js';
import { BRANCHES, SKILLS, ITEMS, ITEM_IDS, UPGRADES, UPGRADE_IDS, RELICS, EVIDENCE, EVIDENCE_IDS, canLearn, renownFor, itemMax } from './sim/data/skills.js';
import { ACTS, QUESTS, ENDING } from './sim/data/story.js';
import { patientById } from './sim/game.js';
import { focusLeft } from './sim/scan.js';
import { placeName } from './sim/world.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const NAMES = {
    clasp: ['Clasp', 'receptionist'], ossa: ['Ossa', 'head nurse'], pip: ['Pip', 'wisp of the Lens'], you: ['You', 'the Healer'],
    grimwald: ['Grimwald', 'Overlord of Gloamhollow'], narrator: ['', ''],
    aldric: ['Sir Aldric', 'orderly'], vessa: ['Vessa', 'orderly'], corvin: ['Corvin', 'orderly'], lumina: ['Lumina', 'orderly'],
};
const SPEAKER_SPECIES = { mother: 'owlbear', lady: 'banshee', ignatia: 'dragon', grimwald: 'overlord' };

export class UI {
    constructor({ audio, settings, view, onSettings, onDeleteSave, onAct }) {
        this.audio = audio;
        this.settings = settings;
        this.view = view;
        this.onAct = onAct;
        this.stack = [];
        this.touchOn = false;
        this.talkIdx = -1;
        this.talkRef = null;
        this.typed = 0;
        this.journalTab = 'skills';
        this.endIdx = 0;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count (game-071).
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const ids = ['sfx', 'music', 'sens', 'invert', 'quality', 'touch', 'hints'];
        const els = Object.fromEntries(ids.map((k) => [k, $('set-' + k)]));
        const load = () => {
            els.sfx.value = settings.sfx; els.music.value = settings.music; els.sens.value = settings.sens;
            els.invert.checked = settings.invert; els.quality.value = String(settings.quality); els.touch.value = settings.touch; els.hints.checked = settings.hints;
        };
        load();
        const changed = () => {
            Object.assign(settings, {
                sfx: +els.sfx.value, music: +els.music.value, sens: +els.sens.value, invert: els.invert.checked,
                quality: +els.quality.value, touch: els.touch.value, hints: els.hints.checked,
            });
            onSettings(settings);
        };
        for (const el of Object.values(els)) el.addEventListener('change', changed);
        this.reloadSettings = load;
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        $('journal-tabs').addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            audio.ui('click');
            this.journalTab = b.dataset.tab;
            this.renderJournal(this.G);
        });
        $('talk-box').addEventListener('click', () => this.advanceTalk());
        $('end-next').addEventListener('click', () => this.nextEnding());
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        else { document.activeElement?.blur?.(); this.closedAt = performance.now(); }
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.offsetParent !== null); }
    focusFirst(id) { const b = this.buttons(id); (b.find((x) => x.classList.contains('primary')) || b[0])?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }
    /** Action pressed in a menu: the focused button, or the first. */
    pressFocused() {
        const list = this.buttons(this.top());
        const f = list.includes(document.activeElement) ? document.activeElement : list[0];
        f?.click();
    }

    // ------------------------------------------------------------------ HUD
    showWorldHud(on) {
        $('hud').hidden = !on;
        $('corner-btns').hidden = !on && !this.scanOn;
        this.setTouch(this.touchOn);
    }
    setTouch(on) {
        this.touchOn = on;
        $('touch').hidden = !(on && !$('hud').hidden && !this.talking && !this.scanOn);
        $('lock-hint').hidden = on || !this.lockHint;
    }
    setLockHint(on) { this.lockHint = on; $('lock-hint').hidden = this.touchOn || !on; }

    hud(G, { facing, objective, steer, keyHint }) {
        this.G = G;
        const act = ACTS[G.act];
        $('hud-place-name').textContent = placeName(G.map);
        $('hud-place-sub').textContent = G.map === 'clinic' ? `Day ${G.day} · ${act.title}` : act.title;
        $('hud-gold').querySelector('b').textContent = G.gold;
        $('hud-level').querySelector('b').textContent = G.level;
        $('hud-level').querySelector('.bar i').style.width = `${Math.min(100, (G.renown / renownFor(G.level)) * 100)}%`;
        $('hud-points').hidden = G.points <= 0;
        $('hud-points').querySelector('b').textContent = G.points;
        $('obj-text').textContent = objective?.text || '';
        const arrow = $('obj-arrow');
        if (steer == null) arrow.classList.add('none');
        else {
            arrow.classList.remove('none');
            arrow.style.transform = `rotate(${steer}rad)`;
            arrow.classList.toggle('on', Math.abs(steer) < 0.3);
        }
        const p = $('prompt');
        if (facing && !G.talk) {
            p.hidden = false;
            $('prompt-key').textContent = this.touchOn ? '✋' : keyHint || 'E';
            $('prompt-text').textContent = facing.label;
        } else p.hidden = true;
        $('crosshair').classList.toggle('hot', !!facing);
    }

    toast(text, big = false) {
        const el = document.createElement('div');
        el.className = 'toast' + (big ? ' big' : '');
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 3100);
    }

    // ------------------------------------------------------------------ dialogue
    speakerInfo(G, who) {
        if (NAMES[who]) return { name: NAMES[who][0], role: NAMES[who][1], model: who === 'narrator' ? null : who === 'grimwald' ? 'overlord' : who === 'you' ? null : who };
        const p = patientById(G, who) || G.patients.find((q) => q.name.toLowerCase().split(' ')[0] === who || (who === 'mother' && q.species === 'owlbear') || (who === 'lady' && q.species === 'banshee') || (who === 'ignatia' && q.species === 'dragon'));
        if (p) return { name: p.name, role: `${SPECIES[p.species].label.toLowerCase()} · ${p.ailment.toLowerCase()}`, model: p.species, variant: p.name };
        if (SPEAKER_SPECIES[who]) return { name: who, role: '', model: SPEAKER_SPECIES[who] };
        return { name: who, role: '', model: null };
    }

    /** Show G.talk; called every frame. Returns true while a conversation is up. */
    talk(G, dt) {
        if (!G.talk) {
            if (this.talking) { $('talk').hidden = true; this.talking = false; this.setTouch(this.touchOn); }
            this.talkRef = null;
            return false;
        }
        if (this.talkRef !== G.talk) {
            this.talkRef = G.talk;
            this.talkIdx = 0;
            this.showLine(G);
            $('talk').hidden = false;
            this.talking = true;
            this.setTouch(this.touchOn);
        }
        const line = G.talk.lines[this.talkIdx];
        if (line && this.typed < line.text.length) {
            this.typed = Math.min(line.text.length, this.typed + dt * 60);
            $('talk-text').textContent = line.text.slice(0, Math.floor(this.typed));
            if (Math.floor(this.typed) % 3 === 0) this.audio.blip(this.voice);
        }
        $('talk-more').style.visibility = line && this.typed >= line.text.length ? 'visible' : 'hidden';
        return true;
    }

    showLine(G) {
        const line = G.talk.lines[this.talkIdx];
        if (!line) return;
        const info = this.speakerInfo(G, line.who);
        $('talk-name').innerHTML = info.name ? `${esc(info.name)}<small>${esc(info.role)}</small>` : '';
        const pt = $('talk-portrait');
        const img = $('talk-img');
        if (info.model) {
            pt.classList.remove('narrator');
            img.hidden = false;
            try { img.src = this.view.portrait(info.model, info.variant || ''); } catch { img.hidden = true; }
        } else {
            pt.classList.add('narrator');
            img.hidden = true;
            pt.dataset.icon = line.who === 'you' ? '⚕' : '✦';
        }
        pt.style.display = info.model ? '' : 'none';
        $('talk-text').classList.toggle('narr', line.who === 'narrator');
        $('talk-text').textContent = '';
        this.typed = 0;
        this.voice = info.model ? (SPECIES[info.model]?.voice ?? CAST[line.who]?.voice ?? 1) : line.who === 'you' ? 1 : 0;
    }

    /** E / Space / tap during dialogue. */
    advanceTalk() {
        const G = this.G;
        if (!G?.talk) return;
        const line = G.talk.lines[this.talkIdx];
        if (line && this.typed < line.text.length) { this.typed = line.text.length; $('talk-text').textContent = line.text; return; }
        this.audio.ui('click');
        this.talkIdx++;
        if (this.talkIdx >= G.talk.lines.length) { this.talkRef = null; this.onAct({ type: 'talkEnd' }); return; }
        this.showLine(G);
    }

    // ------------------------------------------------------------------ scan HUD
    openScan(G) {
        if (!G.scan) return;
        const S = G.scan.S;
        const p = patientById(G, G.scan.pid);
        this.scanOn = true;
        $('scanhud').hidden = false;
        $('hud').hidden = true;
        $('touch').hidden = true;
        $('scan-name').textContent = p.name;
        $('scan-ailment').textContent = `${SPECIES[p.species].label} · ${p.ailment}` + (S.phases.length > 1 ? ` · ${S.spec.name}` : '');
        $('scan-senses').innerHTML = SENSE_ORDER.map((s) => `<div class="sense ${S.senses.includes(s) ? '' : 'off'}" title="${SENSES[s].name}: ${SENSES[s].hop}">${SENSES[s].icon}</div>`).join('');
        this.buildVials(S);
        this.armed = null;
        this.updateScan(G);
        this.scanTip(this.settings.hints ? 'Drag through motes that share a trait you can sense.' : '');
        $('corner-btns').hidden = false;
        $('btn-journal').hidden = true;
    }
    closeScan() {
        const was = this.scanOn;
        this.scanOn = false;
        $('scanhud').hidden = true;
        if (was) { $('hud').hidden = false; this.setTouch(this.touchOn); }
        $('scan-tag').hidden = true;
        $('btn-journal').hidden = false;
    }

    buildVials(S) {
        const el = $('scan-vials');
        el.innerHTML = '';
        S.vials.forEach((v, i) => {
            const b = document.createElement('button');
            b.className = 'vial';
            b.dataset.i = i;
            b.innerHTML = `<span class="liq"></span><span class="vc"></span><span class="vi">${POWERS[v.power].icon}</span><span class="vt"></span>`;
            b.title = `${POWERS[v.power].label}: ${POWERS[v.power].tip}`;
            b.addEventListener('click', () => this.onVial(i));
            el.appendChild(b);
        });
        const it = $('scan-items');
        it.innerHTML = '';
        for (const k of ITEM_IDS) {
            const b = document.createElement('button');
            b.className = 'sbtn';
            b.dataset.item = k;
            b.title = `${ITEMS[k].label}: ${ITEMS[k].desc}`;
            b.innerHTML = `${ITEMS[k].icon}<span class="ct"></span>`;
            b.addEventListener('click', () => { this.audio.ui('click'); this.onAct({ type: 'scanItem', item: k }); });
            it.appendChild(b);
        }
        $('scan-hint').onclick = () => this.onHint?.();
        $('scan-quit').onclick = () => { this.audio.ui('close'); this.onAct({ type: 'scanQuit' }); };
    }

    onVial(i) {
        const S = this.G?.scan?.S;
        if (!S) return;
        const v = S.vials[i];
        if (v.charges <= 0) { this.scanTip(`${POWERS[v.power].label}: fill the vial with ${this.vialTarget(v)} to charge it.`); return; }
        this.audio.ui('click');
        if (v.power === 'phoenix') { this.onAct({ type: 'scanPower', vial: i }); return; }
        this.armed = this.armed === i ? null : i;
        this.view.scan.armed = this.armed;
        this.scanTip(this.armed != null ? POWERS[v.power].tip : '');
        this.updateScan(this.G);
    }

    vialTarget(v) {
        if (v.target == null) return '…';
        const n = Math.max(0, v.need - v.fill);
        switch (v.sense) {
            case 'kind': return `${n} ${KINDS[v.target].plural}`;
            case 'hue': return `${n} ${HUES[v.target].label}`;
            case 'sev': return `${n} ${SEVS[v.target].label}`;
            default: return `${n} ${SCHOOLS[v.target].label.toLowerCase()}`;
        }
    }

    goalIcon(g) {
        switch (g.t) {
            case 'kind': return KINDS[g.v].icon;
            case 'hue': return `<span style="color:${HUES[g.v].css}">●</span>`;
            case 'sev': return g.v === 'L' ? '⬤' : g.v === 'M' ? '●' : '•';
            case 'school': return SCHOOLS[g.v].icon;
            case 'bloom': return '🌸';
            case 'scar': return '🩹';
            case 'bound': return '⛓️';
            default: return '✚';
        }
    }

    updateScan(G) {
        if (!G.scan) return;
        const S = G.scan.S;
        this.G = G;
        const left = focusLeft(S);
        $('focus-n').textContent = Math.max(0, left);
        $('scan-focus').classList.toggle('low', left <= 3 && S.status === 'playing');
        const goals = $('scan-goals');
        const html = S.goals.map((g, i) => `<div class="ticket ${g.have >= g.n ? 'done' : ''}" data-i="${i}"><span class="gi">${this.goalIcon(g)}</span><span><span class="gl">${esc(goalLabel(g))}</span>${g.have >= g.n ? '✓' : `${g.have} / ${g.n}`}</span><i class="gp" style="width:${(g.have / g.n) * 100}%"></i></div>`).join('');
        if (goals.dataset.h !== html) {
            const prev = this.prevGoals || [];
            goals.innerHTML = html;
            goals.dataset.h = html;
            S.goals.forEach((g, i) => { if (prev[i] != null && g.have > prev[i]) goals.children[i]?.classList.add('bump'); });
            this.prevGoals = S.goals.map((g) => g.have);
        }
        const vials = $('scan-vials').children;
        S.vials.forEach((v, i) => {
            const b = vials[i];
            if (!b) return;
            b.querySelector('.liq').style.height = `${v.charges >= S.mods.maxCharges ? 100 : (v.fill / v.need) * 100}%`;
            b.style.setProperty('--vc', v.sense === 'hue' && v.target ? HUES[v.target].css : v.sense === 'school' && v.target ? SCHOOLS[v.target].css : v.sense === 'sev' ? '#ff9ad0' : '#62e0f0');
            b.querySelector('.vt').textContent = v.charges ? POWERS[v.power].label : this.vialTarget(v);
            b.querySelector('.vc').textContent = v.charges ? `×${v.charges}` : '';
            b.classList.toggle('charged', v.charges > 0);
            b.classList.toggle('armed', this.armed === i);
            b.classList.toggle('empty', v.charges <= 0);
        });
        for (const b of $('scan-items').children) {
            const n = G.items[b.dataset.item];
            b.querySelector('.ct').textContent = n;
            b.disabled = n <= 0 || (S.status !== 'playing' && !(S.status === 'lost' && b.dataset.item === 'salts'));
        }
        $('scan-ailment').textContent = `${SPECIES[patientById(G, G.scan.pid).species].label} · ${patientById(G, G.scan.pid).ailment}` + (S.phases.length > 1 ? ` · Phase ${S.phase + 1}/${S.phases.length}: ${S.spec.name}` : '');
        if (S.wild) this.scanTip('🪶 Phoenix trail: this trail can hop between any motes!');
    }

    scanTip(t) { $('scan-tip').textContent = t || ''; }

    /** The floating tag over a hop: "same aura!" */
    showTag(text, x, y) {
        const el = $('scan-tag');
        if (!text) { el.hidden = true; return; }
        el.hidden = false;
        el.textContent = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }

    /** Win or out of focus. */
    showResult(G) {
        const S = G.scan.S;
        const p = patientById(G, G.scan.pid);
        const foot = $('res-foot');
        foot.innerHTML = '';
        const add = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.onclick = fn; foot.appendChild(b); };
        if (S.status === 'won') {
            $('res-title').textContent = `${p.name} is healed!`;
            $('res-stars').innerHTML = [1, 2, 3].map((i) => `<span class="${i <= S.stars ? '' : 'off'}">★</span>`).join('');
            $('res-body').innerHTML = `<p>${S.stats.treated} afflictions treated · longest trail ${S.stats.longest}${S.stats.blooms ? ` · ${S.stats.blooms} lifebloom${S.stats.blooms > 1 ? 's' : ''}` : ''}</p>` +
                (S.bonus ? `<p class="dim">${focusLeft(S)} Focus left over</p>` : '');
            add('Wonderful', 'primary', () => { this.closeScreen('scanresult'); this.onAct({ type: 'scanFinish' }); });
        } else {
            $('res-title').textContent = 'Out of Focus';
            $('res-stars').innerHTML = '';
            const g = S.goals.filter((x) => x.have < x.n).map((x) => `${goalLabel({ ...x, n: x.n - x.have })}`).join(', ');
            $('res-body').innerHTML = `<p>Still to do: ${esc(g)}.</p>` + (S.continued ? '<p class="dim">The tonic is already drunk.</p>' : `<p class="dim">Drink the tonic for ${S.mods.tonic} more Focus (this scan can then earn only one star).</p>`);
            if (!S.continued) add(`🍵 Tonic (+${S.mods.tonic})`, 'primary', () => { this.closeScreen('scanresult'); this.onAct({ type: 'scanTonic' }); });
            if (G.items.salts > 0) add(`🧂 Salts (+3) ×${G.items.salts}`, S.continued ? 'primary' : '', () => { this.closeScreen('scanresult'); this.onAct({ type: 'scanItem', item: 'salts' }); });
            add('Step back, try later', '', () => { this.closeScreen('scanresult'); this.onAct({ type: 'scanQuit' }); });
        }
        this.openScreen('scanresult');
    }

    // ------------------------------------------------------------------ journal
    openJournal(G, tab = null) {
        this.G = G;
        if (tab) this.journalTab = tab;
        this.renderJournal(G);
        this.openScreen('journal');
    }

    renderJournal(G) {
        if (!G) return;
        for (const t of $('journal-tabs').children) t.classList.toggle('on', t.dataset.tab === this.journalTab);
        const body = $('journal-body');
        const tab = this.journalTab;
        if (tab === 'skills') {
            let h = `<p class="pts-line">${G.points ? `✦ ${G.points} skill point${G.points > 1 ? 's' : ''} to spend` : `Renown level ${G.level}: ${G.renown} / ${renownFor(G.level)} to the next point`}</p>`;
            if (!this.atGrimoire) h += '<p class="dim" style="text-align:center;margin-top:-6px">Learn new skills at the Grimoire in the clinic study.</p>';
            h += '<div class="tree">';
            for (const [bid, B] of Object.entries(BRANCHES)) {
                h += `<div class="branch" style="--bc:${B.css}"><h4 style="color:${B.css}">${B.icon} ${B.label}</h4><div class="bl">${esc(B.blurb)}</div>`;
                for (const s of SKILLS.filter((x) => x.branch === bid)) {
                    const have = !!G.skills[s.id];
                    const can = this.atGrimoire && canLearn(G, s.id);
                    h += `<button class="node ${have ? 'have' : can ? 'can' : 'locked'}" data-skill="${s.id}" style="--bc:${B.css}"><span class="ni">${s.icon}</span><span><span class="nn">${esc(s.label)}</span><br><span class="nd">${esc(s.desc)}</span></span><span class="nc">${have ? '✓' : s.cost}</span></button>`;
                }
                h += '</div>';
            }
            h += '</div>';
            body.innerHTML = h;
            for (const n of body.querySelectorAll('[data-skill]')) n.addEventListener('click', () => {
                if (!this.atGrimoire) { this.toast('Study the Grimoire in the clinic to learn this.'); return; }
                if (this.onAct({ type: 'learn', id: n.dataset.skill })) { this.audio.learn(); this.renderJournal(this.G); this.focusFirst('journal'); }
            });
        } else if (tab === 'codex') {
            const all = codexEntries();
            let h = `<p class="pts-line">Codex of Ailments: ${G.codex.length} / ${all.length}</p><div class="grid-cards">`;
            for (const e of all) {
                const k = G.codex.includes(e.key);
                h += `<div class="card ${k ? '' : 'unk'}"><div class="big" style="text-shadow:0 0 10px ${HUES[e.hue].css}">${k ? KINDS[e.kind].icon : '?'}</div><b style="color:${k ? HUES[e.hue].css : 'inherit'}">${k ? `${HUES[e.hue].label} ${KINDS[e.kind].label.toLowerCase()}` : '???'}</b><small>${k ? SCHOOLS[KINDS[e.kind].school].label : ''}</small></div>`;
            }
            body.innerHTML = h + '</div>';
        } else if (tab === 'beasts') {
            let h = `<p class="pts-line">Patients treated: ${G.stats.healed}</p><div class="grid-cards">`;
            for (const id of SPECIES_IDS) {
                const n = G.bestiary[id] || 0;
                let img = '';
                if (n) { try { img = `<img src="${this.view.portrait(id, id)}" alt="">`; } catch { img = ''; } }
                h += `<div class="card ${n ? '' : 'unk'}" title="${n ? esc(SPECIES[id].lore) : ''}">${n ? img : '<div class="big">?</div>'}<b>${n ? SPECIES[id].label : '???'}</b><small>${n ? `treated ${n}` : ''}</small></div>`;
            }
            body.innerHTML = h + '</div>';
        } else if (tab === 'evidence') {
            let h = '<h3>Evidence against the Gilded Company</h3>';
            for (const id of EVIDENCE_IDS) {
                const k = G.evidence.includes(id);
                h += `<div class="ev ${k ? '' : 'unk'}"><div class="big">${k ? EVIDENCE[id].icon : '❔'}</div><div><b>${k ? EVIDENCE[id].label : 'Not yet found'}</b><p style="margin:2px 0 0;font-size:13px">${k ? esc(EVIDENCE[id].desc) : ''}</p></div></div>`;
            }
            h += '<h3>Relics</h3>';
            for (const [id, R] of Object.entries(RELICS)) {
                const k = G.relics.includes(id);
                h += `<div class="ev ${k ? '' : 'unk'}"><div class="big">${k ? R.icon : '❔'}</div><div><b>${k ? R.label : `Hidden somewhere in ${R.where}`}</b><p style="margin:2px 0 0;font-size:13px">${k ? esc(R.desc) : ''}</p></div></div>`;
            }
            const ups = UPGRADE_IDS.filter((u) => G.upgrades[u]);
            if (ups.length) { h += '<h3>Clinic upgrades</h3>'; for (const u of ups) h += `<div class="ev"><div class="big">${UPGRADES[u].icon}</div><div><b>${UPGRADES[u].label}</b><p style="margin:2px 0 0;font-size:13px">${esc(UPGRADES[u].desc)}</p></div></div>`; }
            body.innerHTML = h;
        } else {
            const A = ACTS[G.act];
            let h = `<h3>${esc(A.title)}</h3>`;
            const story = [
                'Opening night at the Lantern Clinic. Somebody is stringing thornwire across the forest roads.',
                'Golden arrows, a gilded crest: the Gilded Company, glory-hunters from Aurelune. Now the crypt\'s dead cannot rest.',
                'A magister\'s hex scroll, signed C. H. And now the dragon\'s mountain is burning.',
                'A lance engraved A. G. The Gloam Fever pours out of Gloamspire, and the Overlord has gone quiet.',
                'Grimwald is himself again. The Company is exposed and mopping the clinic floors. The lanterns are lit.',
            ];
            h += `<p>${esc(story[G.act])}</p>`;
            h += `<p><b>Senses:</b> ${SENSE_ORDER.filter((s) => G.senses.includes(s)).map((s) => `${SENSES[s].icon} ${SENSES[s].name}`).join(' · ')}</p>`;
            h += '<h3>Calls</h3>';
            for (const [qid, Q] of Object.entries(QUESTS)) {
                const st = G.quests[qid].state;
                h += `<p>${Q.icon} <b>${esc(Q.label)}</b> — ${st === 'done' ? 'all healed' : st === 'open' ? 'waiting for you' : 'not yet'}</p>`;
            }
            h += `<p class="dim">Day ${G.day} · ${G.stats.healed} patients healed · ${G.stats.stars} stars</p>`;
            body.innerHTML = h;
        }
    }

    // ------------------------------------------------------------------ shop
    openShop(G) { this.G = G; this.renderShop(G); this.openScreen('shop'); }
    renderShop(G) {
        $('shop-gold').textContent = `You have 🌙 ${G.gold} moonpetals.`;
        const max = itemMax(G);
        let h = '<div class="shop-h">Remedies</div>';
        for (const k of ITEM_IDS) {
            const I = ITEMS[k];
            h += `<div class="shop-row"><div class="big">${I.icon}</div><div class="sd"><b>${I.label} <small class="dim">(${G.items[k]} / ${max})</small></b>${esc(I.desc)}</div><button class="btn ${G.gold >= I.price && G.items[k] < max ? 'primary' : ''}" data-buy="${k}" ${G.gold >= I.price && G.items[k] < max ? '' : 'disabled'}>🌙 ${I.price}</button></div>`;
        }
        h += '<div class="shop-h">Clinic upgrades</div>';
        for (const k of UPGRADE_IDS) {
            const U = UPGRADES[k];
            const own = G.upgrades[k];
            h += `<div class="shop-row"><div class="big">${U.icon}</div><div class="sd"><b>${U.label}</b>${esc(U.desc)}</div><button class="btn ${!own && G.gold >= U.price ? 'primary' : ''}" data-buy="${k}" ${own || G.gold < U.price ? 'disabled' : ''}>${own ? 'Owned' : `🌙 ${U.price}`}</button></div>`;
        }
        $('shop-body').innerHTML = h;
        for (const b of $('shop-body').querySelectorAll('[data-buy]')) b.addEventListener('click', () => {
            if (this.onAct({ type: 'buy', item: b.dataset.buy })) { this.audio.coin(); this.renderShop(this.G); this.focusFirst('shop'); }
        });
    }

    // ------------------------------------------------------------------ world map
    openMap(G) {
        this.G = G;
        const pts = { clinic: [180, 250], bramble: [80, 120], crypt: [300, 300], forge: [440, 110], citadel: [560, 230] };
        const st = (q) => G.quests[q].state;
        const callNow = ACTS[G.act]?.quest;
        let svg = `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="pv" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#f3e2b8"/><stop offset="1" stop-color="#c9a970"/></radialGradient>
<filter id="rough"><feTurbulence baseFrequency="0.04" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="6"/></filter></defs>
<rect width="640" height="360" fill="url(#pv)"/>
<g opacity="0.35" fill="#6a8a4a">${[...Array(26).keys()].map((i) => `<path d="M${30 + (i * 53) % 600},${40 + (i * 97) % 300} l8,-18 l8,18 z"/>`).join('')}</g>
<path d="M0,330 C120,300 200,350 320,320 C440,290 520,340 640,310 L640,360 L0,360 Z" fill="#9ab8c8" opacity="0.6"/>
<g fill="none" stroke="#6a4a2a" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round" filter="url(#rough)">
<path d="M180,250 C130,200 110,160 80,120"/><path d="M180,250 C230,290 260,300 300,300"/><path d="M180,250 C280,200 360,130 440,110"/><path d="M180,250 C330,240 460,240 560,230"/></g>
<g font-family="Cinzel, Georgia, serif" font-size="15" text-anchor="middle" fill="#3a2410">`;
        const icon = { clinic: '⚕', bramble: '🌲', crypt: '⚰️', forge: '🌋', citadel: '🏰' };
        for (const [id, [x, y]] of Object.entries(pts)) {
            const lock = id !== 'clinic' && st(id) === 'locked';
            const call = id === callNow && st(id) === 'open';
            svg += `<g opacity="${lock ? 0.35 : 1}"><circle cx="${x}" cy="${y}" r="24" fill="${call ? '#ffd88a' : '#f8ecd0'}" stroke="#6a4a2a" stroke-width="3"/>${call ? `<circle cx="${x}" cy="${y}" r="30" fill="none" stroke="#d9a84e" stroke-width="2"><animate attributeName="r" values="26;36;26" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}<text x="${x}" y="${y + 7}" font-size="20">${icon[id]}</text><text x="${x}" y="${y + 44}">${id === 'clinic' ? 'Lantern Clinic' : QUESTS[id].label.replace('The ', '')}</text>${!lock && id !== 'clinic' && st(id) === 'done' ? `<text x="${x + 22}" y="${y - 16}" font-size="16" fill="#3a8a2a">✓</text>` : ''}</g>`;
        }
        svg += '</g></svg>';
        $('map-art').innerHTML = svg;
        let list = '';
        for (const [id, Q] of Object.entries(QUESTS)) {
            const s = st(id);
            const lock = s === 'locked';
            list += `<button class="place ${lock ? 'locked' : ''} ${id === callNow && s === 'open' ? 'call' : ''}" data-go="${id}" ${lock ? 'disabled' : ''}><b>${Q.icon} ${esc(Q.label)}</b><small>${lock ? 'No call from here yet' : s === 'done' ? 'Everyone here is healed. Visit again.' : esc(Q.blurb)}</small></button>`;
        }
        $('map-list').innerHTML = list;
        for (const b of $('map-list').querySelectorAll('[data-go]')) b.addEventListener('click', () => {
            this.audio.ui('open');
            this.closeScreen('worldmap');
            this.onAct({ type: 'travel', to: b.dataset.go });
        });
        this.openScreen('worldmap');
    }

    // ------------------------------------------------------------------ ending
    openEnding() {
        this.endIdx = 0;
        this.showEnding();
        this.openScreen('ending');
    }
    showEnding() {
        const p = ENDING[this.endIdx];
        const art = ['🏮', '🏹📜🔱📒', '⚖️', '🧹', '🏮🏮🏮', '⚕️'];
        $('end-art').textContent = art[this.endIdx] || '✦';
        $('end-title').textContent = p.title;
        $('end-text').textContent = p.text;
        $('end-next').textContent = this.endIdx === ENDING.length - 1 ? 'Back to the clinic' : 'Continue';
    }
    nextEnding() {
        this.audio.ui('click');
        if (this.endIdx < ENDING.length - 1) { this.endIdx++; this.showEnding(); return; }
        this.closeScreen('ending');
        this.onAct({ type: 'endingDone' });
    }
}
