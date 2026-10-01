/**
 * screens.js — the comm-scene player and every modal panel: rewards, choices,
 * Signal events, depot, repair bay, salvage, settings, how-to-play, pause.
 */

import { $, el, show, hide, toast, countUp } from './dom.js';
import { SCENES, CAST, sceneText } from '../sim/story.js';
import { SYMBOLS } from '../sim/symbols.js';
import { BOOSTERS } from '../sim/boosters.js';
import { MODS, RARITIES, STATS, modStat } from '../sim/mods.js';
import { fmt } from '../sim/format.js';
import { iconURL, drawPortrait } from '../view/art.js';
import { sound } from '../audio.js';

// ------------------------------------------------------------------ comm scenes

const story = { id: null, i: 0, typed: 0, full: '', who: null, t: 0, done: null, timer: null, callsign: '' };

export function playScene(id, callsign, onDone) {
    const sc = SCENES[id];
    if (!sc) { onDone(); return; }
    story.id = id; story.i = 0; story.done = onDone; story.callsign = callsign;
    $('#story-kicker').textContent = sc.kicker;
    $('#story-title').textContent = sc.title;
    show('#scr-story');
    showLine();
}

function showLine() {
    const sc = SCENES[story.id];
    const [who, text] = sc.lines[story.i];
    const cast = CAST[who];
    story.who = who;
    story.full = sceneText(text, story.callsign);
    story.typed = 0;
    $('#story-who').innerHTML = `<span style="color:${cast.color}">${cast.name}</span>${cast.role ? `<small>${cast.role}</small>` : ''}`;
    $('#story-line').textContent = '';
    $('#story-count').textContent = `${story.i + 1} / ${sc.lines.length}`;
    $('#story-line').style.fontFamily = who === 'det' || who === 'null' ? 'ui-monospace, monospace' : '';
    $('#story-line').style.color = who === 'det' || who === 'null' ? '#ff9aa8' : '';
    clearInterval(story.timer);
    story.timer = setInterval(() => {
        story.typed = Math.min(story.full.length, story.typed + 2);
        $('#story-line').textContent = story.full.slice(0, story.typed);
        if (story.typed % 4 === 0) sound.type();
        if (story.typed >= story.full.length) clearInterval(story.timer);
    }, 22);
}

export function storyNext() {
    if (!story.id) return;
    if (story.typed < story.full.length) {
        story.typed = story.full.length;
        $('#story-line').textContent = story.full;
        clearInterval(story.timer);
        return;
    }
    sound.click();
    const sc = SCENES[story.id];
    story.i++;
    if (story.i >= sc.lines.length) endScene();
    else showLine();
}

export function storySkip() {
    if (!story.id) return;
    endScene();
}

function endScene() {
    clearInterval(story.timer);
    hide('#scr-story');
    const cb = story.done;
    story.id = null;
    story.done = null;
    if (cb) cb();
}

export function storyActive() { return !!story.id; }
export function storyScene() { return story.id ? SCENES[story.id] : null; }

/** Animate the portrait canvas (called every frame while a scene is up). */
export function drawStoryPortrait(t) {
    if (!story.id) return;
    const c = $('#portrait');
    const ctx = c.getContext('2d');
    const talking = story.typed < story.full.length ? 1 : 0;
    drawPortrait(ctx, story.who, c.width, c.height, t, talking);
}

// ------------------------------------------------------------------ generic panel

export function openPanel({ title, sub = '', body = null, foot = [], wide = false, cls = '' }) {
    $('#panel-title').innerHTML = title;
    $('#panel-sub').innerHTML = sub;
    const b = $('#panel-body');
    b.innerHTML = '';
    if (body) b.append(body);
    const f = $('#panel-foot');
    f.innerHTML = '';
    for (const x of foot) f.append(x);
    const p = $('#panel');
    p.className = `panel ${wide ? 'wide' : ''} ${cls}`;
    p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
    show('#scr-panel');
    sound.open();
}
export function closePanel() { hide('#scr-panel'); }
export const panelOpen = () => !$('#scr-panel').classList.contains('hidden');

export function btn(label, onclick, cls = 'menu-btn', attrs = {}) {
    return el('button', { class: cls, onclick: (e) => { sound.click(); onclick(e); }, ...attrs }, label);
}

// ------------------------------------------------------------------ cards

export function modCard(m, { equipped = false, actions = [] } = {}) {
    const d = MODS[m.id];
    const R = RARITIES[m.rar];
    return el('div', { class: `mod ${equipped ? 'eq' : ''}`, style: { borderColor: R.color + '88' } },
        el('div', { class: 'h' },
            el('img', { src: iconURL(d.icon, R.color, 60), alt: '' }),
            el('div', {},
                el('div', { class: 'name' }, d.name, el('span', { class: 'lv', style: { color: 'var(--cyan)', marginLeft: '6px', fontSize: '12px' } }, `Lv ${m.lv}/${R.maxLv}`)),
                el('div', { class: 'rar', style: { color: R.color } }, R.name))),
        el('div', { class: 'desc' }, d.desc(m.lv)),
        el('div', { class: 'bonus' }, `+${modStat(m)}% ${STATS[m.stat].name}`),
        actions.length ? el('div', { class: 'acts' }, ...actions) : null);
}

export function choiceCard(ch, onPick) {
    let icon, color, title, desc;
    if (ch.type === 'mod') {
        const d = MODS[ch.mod.id], R = RARITIES[ch.mod.rar];
        icon = d.icon; color = R.color; title = d.name;
        desc = `<span style="color:${R.color};font-weight:800;font-size:11px;letter-spacing:.1em">${R.name.toUpperCase()} MODULE</span><br>${d.desc(1)}<br><span style="color:var(--green)">+${modStat(ch.mod)}% ${STATS[ch.mod.stat].name}</span>`;
    } else if (ch.type === 'booster') {
        const d = BOOSTERS[ch.id];
        icon = d.icon; color = d.color; title = `${ch.n}× ${d.name}`; desc = d.desc;
    } else if (ch.type === 'scrap') {
        icon = 'scrap'; color = '#d6a46a'; title = `${fmt(ch.n)} Scrap`; desc = 'Bolt it onto the frame back at the carrier.';
    } else {
        icon = 'core'; color = '#ff4dff'; title = `${ch.n} Probability Core${ch.n > 1 ? 's' : ''}`; desc = 'Needed for the big machine upgrades: reels, rows, reactors.';
    }
    return el('button', { class: 'choice', onclick: () => { sound.upgrade(); onPick(ch); }, style: { borderColor: color + '77' } },
        el('div', { class: 'h' }, el('img', { src: iconURL(icon, color, 60), alt: '' }), el('b', {}, title)),
        el('div', { class: 'desc', html: desc, style: { fontSize: '12px', color: '#cfe0ff' } }));
}

// ------------------------------------------------------------------ rewards

/**
 * out: applyVictory summary. onDone(choice|null).
 */
export function showRewards(out, { title = 'Victory', sub = '' } = {}, onDone) {
    const body = el('div', {});
    const scrapV = el('div', { class: 'v', style: { color: 'var(--gold)' } }, '0');
    const xpV = el('div', { class: 'v', style: { color: 'var(--cyan)' } }, '0');
    const row = el('div', { class: 'rewards' },
        el('div', { class: 'rw-big' }, scrapV, el('div', { class: 'k' }, 'Scrap')),
        el('div', { class: 'rw-big' }, xpV, el('div', { class: 'k' }, 'Pilot XP')));
    if (out.cores) row.append(el('div', { class: 'rw-big' }, el('div', { class: 'v', style: { color: 'var(--mag)' } }, `+${out.cores}`), el('div', { class: 'k' }, 'Cores')));
    body.append(row);
    countUp(scrapV, 0, out.scrap, 900, (v) => `+${fmt(v)}`);
    countUp(xpV, 0, out.xp, 900, (v) => `+${fmt(v)}`);
    setTimeout(() => sound.coins(8), 150);
    for (const lv of out.levels) {
        body.append(el('div', { class: 'lvup' }, `PILOT LEVEL ${lv}! +1 skill point`));
        setTimeout(() => sound.levelUp(), 400);
    }
    if (out.drops?.length) body.append(el('p', { class: 'dim', style: { textAlign: 'center' } }, `Recovered: ${out.drops.map((id) => BOOSTERS[id].name).join(', ')}`));
    for (const q of out.quests ?? []) body.append(el('p', { style: { textAlign: 'center', color: 'var(--mag)', fontWeight: 800 } }, '✦ Contract complete — claim it at the carrier'));
    let picked = !out.choices;
    const cont = btn('Continue', () => { closePanel(); onDone(null); }, 'menu-btn primary');
    if (out.choices) {
        body.append(el('div', { class: 'sec-h', style: { marginTop: '16px' } }, 'Salvage — choose one'));
        const grid = el('div', { class: 'choices' });
        for (const ch of out.choices) grid.append(choiceCard(ch, (c) => { closePanel(); onDone(c); }));
        body.append(grid);
        cont.textContent = 'Skip';
    }
    openPanel({ title, sub, body, foot: [cont] });
    if (!picked) cont.classList.remove('primary');
}

export function showChoices(title, sub, choices, onDone, skipLabel = 'Skip') {
    const grid = el('div', { class: 'choices' });
    for (const ch of choices) grid.append(choiceCard(ch, (c) => { closePanel(); onDone(c); }));
    openPanel({ title, sub, body: grid, foot: [btn(skipLabel, () => { closePanel(); onDone(null); })] });
}

// ------------------------------------------------------------------ settings & how to play

export function showSettings(settings, apply, extra = []) {
    const body = el('div', {});
    const range = (label, key) => {
        const i = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings[key], oninput: () => { settings[key] = Number(i.value); apply(); } });
        return el('div', { class: 'set-row' }, el('span', {}, label), i);
    };
    const seg = (label, key, opts) => {
        const box = el('div', { class: 'seg' });
        for (const [v, t] of opts) box.append(el('button', { class: settings[key] === v ? 'on' : '', onclick: () => { settings[key] = v; apply(); [...box.children].forEach((b) => b.classList.toggle('on', b.textContent === t)); sound.click(); } }, t));
        return el('div', { class: 'set-row' }, el('span', {}, label), box);
    };
    body.append(range('Music', 'music'), range('Sound effects', 'sfx'),
        seg('Graphics', 'quality', [['auto', 'Auto'], [2, 'High'], [1, 'Med'], [0, 'Low']]),
        seg('Battle speed', 'speed', [[1, '1×'], [1.6, '1.6×'], [2.4, '2.4×']]),
        seg('Screen shake & flashes', 'calm', [[false, 'Full'], [true, 'Reduced']]));
    for (const x of extra) body.append(x);
    return body;
}

export function howToBody() {
    const syms = el('div', { class: 'syms' });
    for (const id of ['blade', 'cannon', 'missile', 'arc', 'shield', 'repair', 'energy', 'scrap', 'wild', 'core', 'glitch']) {
        const s = SYMBOLS[id];
        syms.append(el('div', {}, el('img', { src: iconURL(s.glyph, s.color, 60), alt: '' }), el('span', { html: `<b style="color:${s.color}">${s.name}</b> — ${s.desc}` })));
    }
    return el('div', { class: 'howto' },
        el('h3', {}, 'Every symbol fires'),
        el('p', {}, 'Press SPIN. When the reels land, every symbol on them does its job: attacks hit, shields raise, repairs patch. Symbols in no line still fire at base power.'),
        el('h3', {}, 'Lines multiply'),
        el('p', {}, 'Three or more of a kind from the left along a payline fire far harder (3 → ×1.5 each, 4 → ×2.5, 5 → ×4). Overclock wilds stand in for anything. Every extra line in the same spin is a link in the chain, and every link multiplies.'),
        el('h3', {}, 'Cheat fate with energy ⚡'),
        el('p', {}, 'After the reels land, tap a reel: nudge it up or down, respin it, or hold it for the next spin. Jammed reels can be purged. Dashed traces preview the lines you are about to hit. Then ENGAGE.'),
        el('h3', {}, 'Cores'),
        el('p', {}, '3 Cores anywhere start Overdrive: bonus spins at ×2 with the enemy frozen. 5 Cores hit the Jackpot.'),
        el('h3', {}, 'Your frame is the machine'),
        el('p', {}, 'Back on the carrier, upgrades change the slot machine itself: more reels (up to 5), a fourth row, more paylines, new weapon symbols, a bigger reactor, more wilds and cores. Modules bend the rules (cascades, expanding wilds, mirror lines…). Skill points shape your pilot. The Refinery makes scrap while you are away.'),
        el('h3', {}, 'Symbols'), syms,
        el('h3', {}, 'Keys'),
        el('p', { html: '<kbd>Space</kbd> spin / engage · <kbd>1</kbd>–<kbd>5</kbd> pick a reel · <kbd>↑</kbd><kbd>↓</kbd> nudge · <kbd>R</kbd> respin · <kbd>H</kbd> hold · <kbd>P</kbd> purge · <kbd>T</kbd> next target · <kbd>A</kbd> auto · <kbd>S</kbd> speed · <kbd>Esc</kbd> menu' }));
}

export { toast };
