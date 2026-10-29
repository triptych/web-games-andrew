// The DOM layer: screens, the camp (journey, summon, heroes), the battle HUD, toasts and settings.
// Reads the sim; never changes it. Commands go back to main.js through the callbacks.

import { VERSION, SUMMON, CALLS, PARTY } from './config.js';
import { COLORS, SHAPES, OATHS, HERO, HEROES, RARITY, ENEMIES, STAGES, REGIONS, ABILITY_TEXT } from './sim/data.js';
import { heroStats, partySummary, xpToLevel } from './sim/game.js';

const $ = (id) => document.getElementById(id);
const CLASS_ICON = { knight: '⚔️', cleric: '✚', ranger: '🏹', rogue: '🗡️', monk: '👊', bard: '🎻', druid: '🌿', mage: '🔮', paladin: '🛡️', warlock: '📕' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const stars = (n) => '★'.repeat(n);

/** What a token is and what it wants, in one line. */
export function describeToken(t) {
    if (!t) return '';
    if (t.rb) return '<b>Rubble</b> — breaks when a match is made beside it.';
    const O = OATHS[t.o];
    const ice = t.fz ? ' <b>Frozen</b>: can’t be moved; a match beside it thaws it.' : '';
    if (t.h) {
        const h = HERO[t.h];
        const wake = t.o === 'vigil' ? ` (${t.wake} more)` : '';
        return `<b>${esc(h.name)}</b> ${stars(h.r)} · ${COLORS[h.c].name} ${SHAPES[h.s].name} · <b>${O.icon} ${O.name}</b>: ${O.text}${wake}${ice}`;
    }
    if (t.o === 'wild') return `<b>${O.icon} Fool stone</b>: ${O.text}${ice}`;
    return `${COLORS[t.c].name} ${SHAPES[t.s].name} · <b>${O.icon} ${O.name}</b>: ${O.text}${ice}`;
}

export class UI {
    constructor({ audio, settings, view, onSettings, onDeleteSave, cmd }) {
        this.audio = audio;
        this.settings = settings;
        this.view = view;
        this.cmd = cmd;                    // (name, arg) → main.js
        this.stack = [];
        this.tab = 'journey';
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
        for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => { audio.ui('click'); this.setTab(t.dataset.tab); });
        $('camp').querySelector('.sheet-foot').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-act]');
            if (!b) return;
            audio.ui('click');
            if (b.dataset.act === 'title') cmd('title'); else this.openScreen(b.dataset.act);
        });

        const sfx = $('set-sfx'), music = $('set-music'), quick = $('set-quick'), calm = $('set-calm'), hints = $('set-hints');
        sfx.value = settings.sfx; music.value = settings.music; quick.checked = settings.quick; calm.checked = settings.calm; hints.checked = settings.hints;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, quick: quick.checked, calm: calm.checked, hints: hints.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, quick, calm, hints]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        $('howto-oaths').innerHTML = '<div class="oathlist">' + Object.entries(OATHS).map(([, o]) =>
            `<div class="rule"><span class="ic">${o.icon}</span><span><b>${o.name}</b> — ${o.text}</span></div>`).join('') + '</div>';

        // delegated clicks inside the camp panes
        $('tab-journey').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-stage]');
            if (b && !b.disabled) { audio.ui('click'); cmd('brief', +b.dataset.stage); }
        });
        $('tab-summon').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-summon]');
            if (b && !b.disabled) cmd('summon', +b.dataset.summon);
        });
        $('tab-heroes').addEventListener('click', (e) => {
            const b = e.target.closest('[data-hero]');
            if (b) { audio.ui('click'); cmd('hero', b.dataset.hero); }
        });
        $('brief-party').addEventListener('click', (e) => {
            const b = e.target.closest('[data-hero]');
            if (b) { audio.ui('click'); cmd('hero', b.dataset.hero); }
        });
        $('brief-edit').addEventListener('click', () => { audio.ui('click'); this.closeScreen('brief'); this.setTab('heroes'); });
        $('brief-go').addEventListener('click', () => cmd('fight', this.briefStage));
        $('hero-party').addEventListener('click', () => cmd('toggleParty', this.heroId));
        $('result-camp').addEventListener('click', () => cmd('camp'));
        $('result-retry').addEventListener('click', () => cmd('retry'));
        $('result-next').addEventListener('click', () => cmd('next'));
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // screens opened later stack on top of the ones below, whatever their page order
        this.stack.forEach((s, k) => { $(s).style.zIndex = 50 + k; });
        this.focusFirst(id);
        // ../lib/a11y.js moves focus into each screen it sees open; when two open in one go (the camp
        // and a brief) it would land on the lower one. Focus the top one again after it has run.
        queueMicrotask(() => { if (this.top() === id) this.focusFirst(id); });
        this.on?.('screens');
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        this.on?.('screens');
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) {
        return [...$(id).querySelectorAll('button, select, input, [tabindex="0"]')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length && !b.closest('[hidden]'));
    }
    focusFirst(id) {
        const list = this.buttons(id);
        (list.find((b) => b.classList.contains('primary')) || list[0])?.focus({ preventScroll: true });
    }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        const el = list[(i + dir + list.length) % list.length];
        el.focus({ preventScroll: true });
        el.scrollIntoView?.({ block: 'nearest' });
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2900);
    }

    // ------------------------------------------------------------------ portraits
    portraitHtml(id, cls = '') {
        const h = HERO[id];
        const url = this.view.portrait(id);
        const inner = url ? `<img alt="" src="${url}">` : CLASS_ICON[h.cls];
        return `<span class="portrait ${cls}" data-portrait="${id}" style="--c:${COLORS[h.c].css};--rc:${RARITY[h.r].css}">${inner}</span>`;
    }
    /** A portrait finished rendering: swap it into every placeholder. */
    portraitReady(id, url) {
        for (const el of document.querySelectorAll(`[data-portrait="${id}"]`)) el.innerHTML = `<img alt="" src="${url}">`;
    }

    // ------------------------------------------------------------------ camp
    setTab(tab) {
        this.tab = tab;
        for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.dataset.tab === tab);
        for (const k of ['journey', 'summon', 'heroes']) $('tab-' + k).hidden = k !== tab;
        this.renderCamp(this.G);
    }

    renderCamp(G) {
        if (!G) return;
        this.G = G;
        $('crystals').textContent = G.crystals;
        if (this.tab === 'journey') this.renderJourney(G);
        else if (this.tab === 'summon') this.renderSummon(G);
        else this.renderHeroes(G);
    }

    renderJourney(G) {
        let html = '';
        REGIONS.forEach((r, ri) => {
            const stages = STAGES.map((s, i) => ({ s, i })).filter(({ s }) => s.region === ri);
            if (stages[0].i > G.progress) {
                html += `<div class="region locked"><div class="region-head" style="background:linear-gradient(90deg, ${COLORS[r.c].css}22, transparent)">${esc(r.name)} <small>locked</small></div></div>`;
                return;
            }
            html += `<div class="region"><div class="region-head" style="background:linear-gradient(90deg, ${COLORS[r.c].css}33, transparent)">${esc(r.name)} <small>${stages.filter(({ i }) => G.cleared[i]).length}/${stages.length}</small></div><p>${esc(r.blurb)}</p>`;
            for (const { s, i } of stages) {
                const open = i <= G.progress, done = G.cleared[i];
                const foes = [...new Set(s.waves)].map((id) => ENEMIES[id].name).join(', ');
                html += `<button class="stage ${i === G.progress && !done ? 'next' : ''} ${s.boss ? 'boss' : ''}" data-stage="${i}" ${open ? '' : 'disabled'}>
                    <span class="num">${i + 1}</span>
                    <span class="nm">${esc(s.name)}<small>${open ? esc(foes) : '???'}</small></span>
                    <span class="mark">${done ? '✓' : s.boss ? '☠ Boss' : ''}</span></button>`;
            }
            html += '</div>';
        });
        if (G.done) html = `<div class="rule"><b>The Oathbreaker has fallen.</b> The old vows hold again. Every stage stays open for more heroes and crystals.</div>` + html;
        $('tab-journey').innerHTML = html;
    }

    renderSummon(G) {
        const n = G.calls.length;
        const can1 = G.crystals >= SUMMON.cost1 && n + 1 <= CALLS.max;
        const can5 = G.crystals >= SUMMON.cost5 && n + 5 <= CALLS.max;
        const queue = G.calls.map((id) => this.portraitHtml(id)).join('') || '<span class="dim">Nobody is waiting.</span>';
        $('tab-summon').innerHTML = `
            <div class="banner-art"><h3>The Calling Stone</h3><p>Speak an oath into the stone and a hero answers. They don’t join you yet: they appear on your next battle board, and you bind them by fulfilling their oath there.</p></div>
            <div class="summon-btns">
                <button class="btn primary" data-summon="1" ${can1 ? '' : 'disabled'}>Call ×1<small>💎 ${SUMMON.cost1}</small></button>
                <button class="btn primary" data-summon="5" ${can5 ? '' : 'disabled'}>Call ×5<small>💎 ${SUMMON.cost5}</small></button>
            </div>
            <div class="rates">★5 Legend ${Math.round(SUMMON.rates[5] * 100)}% · ★4 Epic ${Math.round(SUMMON.rates[4] * 100)}% · ★3 Rare ${Math.round((1 - SUMMON.rates[5] - SUMMON.rates[4]) * 100)}%.<br>A Legend is certain within ${SUMMON.pity} calls (${SUMMON.pity - G.pity} to go). Earn crystals by winning battles; first wins pay more.</div>
            <h3>Waiting to be called (${n}/${CALLS.max})</h3>
            <div class="queue">${queue}</div>
            <p class="dim" style="font-size:13px">The first of them arrives with the board; the rest follow every few turns, two heroes on the board at most. Heroes you don’t bind come back here.</p>`;
    }

    renderHeroes(G) {
        const slots = [];
        for (let k = 0; k < PARTY.size; k++) {
            const id = G.party[k];
            slots.push(id ? `<button class="slot card inparty" data-hero="${id}">${this.portraitHtml(id)}<span class="nm">${esc(HERO[id].name)}</span></button>` : '<div class="slot">empty</div>');
        }
        const sum = partySummary(G);
        const owned = HEROES.filter((h) => G.roster[h.id]);
        const unknown = HEROES.length - owned.length;
        const cards = owned.map((h) => {
            const e = G.roster[h.id];
            return `<button class="card ${G.party.includes(h.id) ? 'inparty' : ''}" data-hero="${h.id}">${this.portraitHtml(h.id)}<span class="nm">${esc(h.name)}</span><span class="sub"><span class="stars">${stars(h.r)}</span> Lv ${e.lv}${e.rank ? ` · +${e.rank}` : ''}</span><span class="sub oath-ic">${OATHS[h.oath].icon} ${OATHS[h.oath].name}</span></button>`;
        }).join('');
        $('tab-heroes').innerHTML = `
            <h3 style="margin-top:0">Party · ${sum.hp} HP</h3>
            <div class="party-slots">${slots.join('')}</div>
            <p class="dim" style="font-size:13px;margin:0 0 8px">Tap a hero to read their oath and to add or remove them. Each stone you clear hits as hard as your party’s heroes of its colour.</p>
            <div class="roster">${cards}</div>
            ${unknown ? `<p class="dim" style="font-size:13px">${unknown} more heroes are out there, waiting to be called or met on the board.</p>` : ''}`;
    }

    showHero(G, id) {
        this.heroId = id;
        const h = HERO[id], e = G.roster[id];
        $('hero-portrait').outerHTML = `<div class="portrait big" id="hero-portrait" data-portrait="${id}" style="--c:${COLORS[h.c].css};--rc:${RARITY[h.r].css}">${this.view.portrait(id) ? `<img alt="" src="${this.view.portrait(id)}">` : CLASS_ICON[h.cls]}</div>`;
        $('hero-name').textContent = h.name;
        $('hero-title').textContent = `${h.title} · ${h.cls[0].toUpperCase() + h.cls.slice(1)} · ${COLORS[h.c].name} ${SHAPES[h.s].name}`;
        $('hero-stars').textContent = `${stars(h.r)} ${RARITY[h.r].name}`;
        const s = heroStats(G, id);
        $('hero-stats').textContent = e ? `Level ${e.lv} (${e.xp}/${xpToLevel(e.lv)} XP) · rank +${e.rank} · ${s.hp} HP · power ${s.atk}` : 'Not yet bound';
        const O = OATHS[h.oath];
        $('hero-oath').innerHTML = `<b>${O.icon} Oath of ${O.name}.</b> ${O.text}${h.oath === 'vigil' ? ` (${h.wake} matches.)` : ''}`;
        $('hero-arrive').innerHTML = `<b>On arrival:</b> ${esc(h.arrive.text)}`;
        $('hero-skill').innerHTML = `<b>Skill · ${esc(h.skill.name)}</b> (${h.skill.cost} charge): ${esc(h.skill.text)} Charged by clearing ${COLORS[h.c].name} stones.`;
        const inParty = G.party.includes(id);
        const btn = $('hero-party');
        btn.hidden = !e;
        btn.textContent = inParty ? 'Remove from Party' : G.party.length >= PARTY.size ? 'Party is full' : 'Add to Party';
        btn.disabled = (!inParty && G.party.length >= PARTY.size) || (inParty && G.party.length <= 1);
        this.openScreen('hero');
    }

    showBrief(G, stage) {
        this.briefStage = stage;
        const s = STAGES[stage], r = REGIONS[s.region];
        $('brief-name').textContent = s.name + (s.boss ? ' ☠' : '');
        $('brief-region').textContent = `${r.name} · stage ${stage + 1}${G.cleared[stage] ? ` · won ${G.cleared[stage]}×` : ''}`;
        $('brief-foes').innerHTML = s.waves.map((id, k) => {
            const e = ENEMIES[id];
            const acts = [...new Set(e.pattern.map((p) => p.split(':')[0]))].map((k2) => ABILITY_TEXT[k2]).join(', ');
            return `<div class="foe-card"><span class="elem" style="color:${COLORS[e.c].css}"></span><div><b>${k + 1}. ${esc(e.name)}</b> <span class="dim">${COLORS[e.c].name}</span><small>Every ${e.cd} turns it ${esc(acts)}.</small></div></div>`;
        }).join('') + `<p class="dim" style="font-size:13px;margin:4px 0 0">${esc(r.blurb)}</p>`;
        $('brief-party').innerHTML = G.party.map((id) => `<button class="card" data-hero="${id}">${this.portraitHtml(id)}<span class="nm">${esc(HERO[id].name)}</span></button>`).join('');
        $('brief-calls').textContent = G.calls.length ? `${G.calls.length} called hero${G.calls.length > 1 ? 'es' : ''} will come to this board, starting with ${HERO[G.calls[0]].name}.` : 'No heroes are waiting in the calling. Summon at camp to call some.';
        this.openScreen('brief');
    }

    showReveal(got) {
        $('reveal-cards').innerHTML = got.map((id, k) => {
            const h = HERO[id];
            return `<div class="rcard r${h.r}" style="--rc:${RARITY[h.r].css};animation-delay:${0.25 + k * 0.28}s">${this.portraitHtml(id)}<div class="nm">${esc(h.name)}</div><div class="st">${stars(h.r)} ${OATHS[h.oath].icon} ${OATHS[h.oath].name}</div></div>`;
        }).join('');
        this.openScreen('reveal');
    }

    showResult(G) {
        const B = G.B, R = B.reward, s = STAGES[B.stage];
        const t = $('result-title');
        t.textContent = R.final ? 'The Oaths Hold' : R.win ? 'Victory' : B.fled ? 'You Withdrew' : 'Defeated';
        t.className = R.win ? 'win' : 'loss';
        $('result-text').textContent = R.final
            ? 'The Oathbreaker’s crown splits and every broken vow knits itself whole. Your heroes kneel, then laugh, then demand dinner. The Calling Stone hums on: there are always more oaths to keep.'
            : R.win ? `${s.name} is clear.` : 'Your party falls back to camp to lick its wounds. Heroes you bound are still yours.';
        $('result-heroes').innerHTML = R.recruited.map((id) => this.portraitHtml(id)).join('');
        const li = [`💎 ${R.crystals} crystals${R.first ? ' (first win bonus)' : ''}${R.swift ? ` (${R.swift} for a swift win)` : ''}`, `+${R.xp} XP to the party`];
        for (const l of R.levels) li.push(`${HERO[l.id].name} reached level ${l.lv}`);
        if (R.recruited.length) li.push(`Bound: ${[...new Set(R.recruited)].map((id) => HERO[id].name).join(', ')}`);
        li.push(`Best cascade ×${B.best} · ${B.turn} turns`);
        $('result-list').innerHTML = li.map((x) => `<li>${esc(x)}</li>`).join('');
        $('result-retry').hidden = R.win;
        $('result-next').hidden = !R.win || B.stage + 1 >= STAGES.length || B.stage + 1 > G.progress;
        this.openScreen('result');
    }

    // ------------------------------------------------------------------ battle HUD
    showHud(on) { $('hud').hidden = !on; }

    battleOpen(G) {
        this.G = G;
        this.renderSkills(G);
        this.partyHp(G.B.hp, G.B.maxHp, G.B.shield);
        this.info(null);
        this.calling(G);
    }

    setEnemy(e, wave, waves) {
        const def = ENEMIES[e.id];
        $('foe-name').textContent = def.name;
        $('foe-elem').style.color = COLORS[def.c].css;
        $('foe-wave').textContent = waves > 1 ? `${wave + 1}/${waves}` : '';
        this.foeMax = e.maxHp;
        this.enemyHp(e.hp);
        this.enemyCd(e.cd, e);
    }
    enemyHp(hp) {
        const max = this.foeMax || 1;
        $('foe-bar').querySelector('i').style.width = `${Math.max(0, (hp / max) * 100)}%`;
        $('foe-hp').textContent = `${Math.max(0, hp)} / ${max}`;
    }
    enemyCd(cd, e) {
        const el = $('foe-cd');
        el.textContent = `⚔ ${cd <= 1 ? 'next turn' : `in ${cd}`}`;
        el.classList.toggle('soon', cd <= 1);
        if (e) {
            const def = ENEMIES[e.id];
            const [k, n] = def.pattern[e.pi % def.pattern.length].split(':');
            $('foe-next').textContent = k === 'strike' ? `hits ${Math.round(e.atk * Math.pow(1.25, e.rage))}` : `${ABILITY_TEXT[k]}${n && k !== 'heal' ? ` (${n})` : ''}`;
        }
    }
    partyHp(hp, max, shield = 0) {
        const bar = $('party-bar');
        bar.querySelector('i').style.width = `${Math.max(0, (hp / max) * 100)}%`;
        bar.querySelector('s').style.width = `${Math.min(100, (shield / max) * 100)}%`;
        $('party-hp').textContent = `${Math.max(0, hp)} / ${max}${shield ? ` · 🛡 ${shield}` : ''}`;
    }

    renderSkills(G) {
        const B = G.B;
        const el = $('skills');
        if (!this.skillEls || this.skillKey !== B.party.map((p) => p.id).join()) {
            this.skillKey = B.party.map((p) => p.id).join();
            el.innerHTML = '';
            this.skillEls = [];
            for (let k = 0; k < PARTY.size; k++) {
                const p = B.party[k];
                const b = document.createElement('button');
                b.className = 'skill' + (p ? '' : ' empty');
                if (p) {
                    const h = HERO[p.id];
                    b.innerHTML = `<span class="ring"></span>${this.portraitHtml(p.id)}<span class="nm">${esc(h.skill.name)}</span>`;
                    b.setAttribute('aria-label', `${h.name}: ${h.skill.name}. ${h.skill.text}`);
                    b.title = `${h.name} · ${h.skill.name}: ${h.skill.text} (key ${k + 1})`;
                    this.onSkillButton?.(b, k);
                } else b.innerHTML = '<span class="nm">—</span>';
                el.appendChild(b);
                this.skillEls.push(b);
            }
        }
        this.updateCharges(G);
    }
    updateCharges(G) {
        const B = G.B;
        if (!B || !this.skillEls) return;
        B.party.forEach((p, k) => {
            const b = this.skillEls[k];
            if (!b) return;
            const h = HERO[p.id], f = Math.min(1, p.charge / h.skill.cost);
            b.classList.toggle('ready', f >= 1);
            const ring = b.querySelector('.ring');
            ring.style.background = COLORS[h.c].css;
            ring.style.height = `${f * 100}%`;
        });
    }

    info(html) {
        $('info-text').innerHTML = html || 'Swap two neighbouring tokens to make a line. Tap a token to read its oath.';
    }

    calling(G) {
        const B = G.B, el = $('calling');
        if (!B) { el.hidden = true; return; }
        const next = B.pending[0]?.id || (G.calls.length ? G.calls[0] : null);
        const was = el.hidden;
        if (!next) { el.hidden = true; if (!was) this.on?.('pads'); return; }
        el.hidden = false;
        if (was) this.on?.('pads');
        el.textContent = B.pending.length ? `${HERO[next].name} is arriving…` : `Called: ${HERO[next].name} in ${Math.max(1, B.callIn)} turn${B.callIn > 1 ? 's' : ''}`;
    }

    banner(text, kind = '', sub = '') {
        const el = $('banner');
        el.className = '';
        void el.offsetWidth;
        el.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
        el.className = 'show ' + kind;
    }
    combo(n) {
        if (n < 2) return;
        const el = $('combo');
        el.className = '';
        void el.offsetWidth;
        el.textContent = `Cascade ×${n}`;
        el.className = 'show';
    }
    /** Floating text over the party bar. */
    partyFloat(text, cls) {
        const r = $('party-bar').getBoundingClientRect();
        this.view.floats.pop(r.left + r.width / 2 + (Math.random() - 0.5) * 60, r.top - 10, text, cls);
    }

    /** Bottom-of-screen space the board must stay clear of. */
    pads() {
        const top = Math.max($('foe').getBoundingClientRect().bottom, $('calling').hidden ? 0 : $('calling').getBoundingClientRect().bottom) + 8;
        const b = $('bottom').getBoundingClientRect();
        // on a landscape phone the party sits in a column on the right
        if (b.left > innerWidth * 0.45) return { top: Math.max(56, top), bottom: 8, left: 0, right: innerWidth - b.left + 6 };
        return { top: Math.max(60, top), bottom: Math.max(80, innerHeight - b.top + 6), left: 0, right: 0 };
    }
}
