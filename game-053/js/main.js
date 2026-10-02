// Boot: the realm login (save slots + character creation), wiring the
// header and drawers, the tick loop and debug hooks.
import { R, hashStr, fmt } from './rng.js';
import { colorize, esc } from './colors.js';
import { UI, h, $ } from './engine/ui.js';
import { Game } from './engine/game.js';
import * as S from './engine/state.js';
import * as W from './engine/world.js';
import { PAGES } from './pages/index.js';
import { RACES, SPECIALTIES, PRONOUNS, titleFor } from './data/classes.js';
import { Audio } from './audio.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const prefs = S.loadPrefs();
const ui = new UI();
const audio = new Audio(prefs);
let scene = null;
let game = null;

function applyPrefs() {
    document.documentElement.style.setProperty('--ts', prefs.textSize);
    document.body.classList.toggle('no-motion', !prefs.motion);
    audio.apply(prefs);
    scene?.setQuality(prefs.quality, prefs.motion);
    $('#btn-sound').textContent = prefs.sound || prefs.music ? '🔊' : '🔇';
}

async function boot() {
    try {
        const mod = await import('./scene/scene.js');
        scene = await mod.createScene($('#bg'), { quality: prefs.quality, motion: prefs.motion, seed: params.get('seed') });
    } catch (e) {
        console.warn('3D scene unavailable, continuing without it:', e?.message || e);
        document.body.classList.add('no-3d');
        scene = null;
    }
    game = new Game({ ui, scene, audio, prefs, pages: PAGES, onLogout: (msg) => logout(msg) });
    game.applyPrefs = applyPrefs;
    game.exportSave = () => exportSave(game.p, game.w);
    applyPrefs();
    wire();
    showTitle();
    setInterval(() => { try { game.tick(); } catch (e) { console.error(e); } }, 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
    window.addEventListener('pagehide', () => game.save());
    $('#loading').classList.add('gone');
    setTimeout(() => $('#loading').remove(), 800);
    if (DEBUG) installDebug();
    window.__ready = true;
}

// ------------------------------------------------------------ header & drawers
function wire() {
    $('#btn-mail').onclick = () => { audio.sfx('click'); if (game.p) game.goto('mail'); };
    $('#mb-mail').onclick = $('#btn-mail').onclick;
    $('#btn-save').onclick = () => { if (game.save()) ui.toast('Game saved.', '💾'); else ui.toast('`$Could not save (storage full or blocked).', '⚠'); };
    $('#btn-sound').onclick = () => { const on = !(prefs.sound || prefs.music); prefs.sound = on; prefs.music = on; S.savePrefs(prefs); applyPrefs(); };
    $('#btn-menu').onclick = () => { audio.sfx('click'); if (game.p && !game.p.fight) game.goto('prefs'); };
    $('#mb-vitals').onclick = () => ui.openDrawer('vitals');
    $('#mb-online').onclick = () => ui.openDrawer('online');
    $('#scrim').onclick = () => ui.closeDrawers();
    for (const b of document.querySelectorAll('.side-tabs [data-tab]')) b.onclick = () => { $('#side').dataset.tab = b.dataset.tab; };
    document.querySelector('.side-close').onclick = () => ui.closeDrawers();
    // first gesture unlocks audio
    const unlock = () => { audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    $('#import-file').addEventListener('change', onImport);
    window.addEventListener('resize', () => scene?.layout());
    new ResizeObserver(() => scene?.layout()).observe($('#scenewin'));
}

// ------------------------------------------------------------ title / login
function logout(msg) {
    game.save();
    game.p = null; game.w = null;
    $('#app').classList.add('hidden');
    showTitle(msg);
}

function showTitle(msg) {
    scene?.setView('title');
    audio.setArea('title');
    $('#app').classList.add('hidden');
    $('#title-screen').classList.remove('hidden');
    const body = $('#title-body');
    body.replaceChildren();
    const online = 18 + (Math.floor(Date.now() / 600000) % 17);
    $('#realm-status').innerHTML = `Realm of Hollowmere · <span class="on">●</span> ${online} warriors online`;
    if (msg) body.append(h('p', { class: 'title-msg', html: colorize(msg) }));
    body.append(h('h2', {}, 'Choose your warrior'));
    const slots = S.slotSummaries();
    const list = h('div', { class: 'slots' });
    for (const s of slots) {
        if (s.empty) {
            list.append(h('button', { type: 'button', class: 'slot empty', onclick: () => { audio.sfx('click'); createWizard(s.slot); } },
                h('span', { class: 'slot-plus' }, '+'), h('span', {}, 'Create a new warrior')));
            continue;
        }
        const p = s.p;
        const card = h('div', { class: 'slot' },
            h('div', { class: 'slot-main' },
                h('div', { class: 'slot-name', html: colorize(S.coloredName(p)) }),
                h('div', { class: 'slot-meta' }, `Level ${p.level} ${RACES[p.race]?.name || ''} · ${SPECIALTIES[p.spec]?.name || ''} · ${p.dk} Wyrm kill${p.dk === 1 ? '' : 's'}`),
                h('div', { class: 'slot-meta dim' }, `Day ${p.day} · ${p.alive ? 'alive' : 'dead'} · last played ${ago(p.lastPlayed)}`)),
            h('div', { class: 'slot-btns' },
                h('button', { type: 'button', class: 'btn primary', onclick: () => enter(s.slot) }, 'Enter realm'),
                h('button', { type: 'button', class: 'btn small', onclick: () => exportSave(s.p, s.w) }, 'Export'),
                h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
                    if (await ui.confirm('Delete warrior?', `Permanently delete \`%${p.name}\`0 and their whole realm? This cannot be undone. (Export first if you want a backup.)`, 'Delete forever')) { S.deleteSlot(s.slot); showTitle(); }
                } }, 'Delete')));
        list.append(card);
    }
    body.append(list);
    body.append(h('div', { class: 'title-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => $('#import-file').click() }, 'Import save file…'),
        h('button', { type: 'button', class: 'btn', onclick: () => howTo() }, 'How to play')));
}

function ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 90) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
}

function enter(slot) {
    const d = S.loadSlot(slot);
    if (!d) { ui.toast('`$That save could not be read.', '⚠'); return; }
    audio.unlock(); audio.sfx('click');
    $('#title-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    d.player.slot = slot;
    game.start(d.player, d.world);
    scene?.layout();
}

function howTo() {
    ui.modal({ title: 'How to play', wide: true, body: h('div', { class: 'howto', html: colorize(
        '<p>You are a nobody from the edge of the Gloamwood. Every day you get a handful of `^forest fights`0: spend them hunting creatures for gold and experience.</p>' +
        '<p>When your experience is high enough, beat your `^master`0 at the Proving Yard to gain a level. Buy better weapons and armour, heal at Mother Nettle\'s, and keep your gold in the bank — `$you lose what you carry when you die`0.</p>' +
        '<p>At `^level 15`0 you can seek out the `@Jade Wyrm`0. Slay it, and you start again at level 1 — stronger, with a new title and a permanent gift.</p>' +
        '<p>Hollowmere is full of other warriors. They chat in the square, show up in the Herald, rank in the Hall of Heroes, and might attack you if you sleep in the fields. `7(They\'re simulated — the whole realm lives in your browser.)`0</p>' +
        '<p>Every action has a `^hotkey`0 (the underlined letter). On phones, everything is a button.</p>') }) });
}

// ------------------------------------------------------------ character creation
function createWizard(slot) {
    const st = { name: '', sex: 'n', race: 'human', spec: 'thief', pacing: 'adventurer' };
    const body = $('#title-body');
    const step = (n) => {
        body.replaceChildren();
        const back = h('button', { type: 'button', class: 'btn', onclick: () => (n === 1 ? showTitle() : step(n - 1)) }, n === 1 ? 'Cancel' : 'Back');
        const steps = h('div', { class: 'steps' }, [1, 2, 3, 4].map((i) => h('span', { class: i === n ? 'on' : i < n ? 'done' : '' }, ['Name', 'Race', 'Specialty', 'Begin'][i - 1])));
        body.append(steps);
        if (n === 1) {
            body.append(h('h2', {}, 'Who are you?'));
            const inp = h('input', { type: 'text', maxlength: 20, value: st.name, placeholder: 'Your name', 'aria-label': 'Your name', autocomplete: 'off', class: 'big-input' });
            const err = h('p', { class: 'err' });
            body.append(inp, err);
            body.append(h('h3', {}, 'Pronouns'));
            const pr = h('div', { class: 'cards three' });
            for (const [k, v] of Object.entries(PRONOUNS)) pr.append(h('button', { type: 'button', class: 'card' + (st.sex === k ? ' sel' : ''), onclick: () => { st.sex = k; st.name = inp.value; step(1); } },
                h('b', {}, v.label), h('small', {}, `Titles: ${titleFor(0, k)}, ${titleFor(6, k)}, ${titleFor(10, k)}…`)));
            body.append(pr);
            const next = () => {
                const v = inp.value.trim().replace(/\s+/g, ' ');
                if (!/^[A-Za-z][A-Za-z' -]{1,19}$/.test(v)) { err.textContent = 'Names are 2–20 letters (spaces, hyphens and apostrophes are fine).'; inp.focus(); return; }
                st.name = v; step(2);
            };
            inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
            body.append(h('div', { class: 'title-actions' }, back, h('button', { type: 'button', class: 'btn primary', onclick: next }, 'Next')));
            setTimeout(() => inp.focus(), 50);
        } else if (n === 2) {
            body.append(h('h2', {}, 'Where do you come from?'));
            const cards = h('div', { class: 'cards' });
            for (const [k, r] of Object.entries(RACES)) cards.append(h('button', { type: 'button', class: 'card' + (st.race === k ? ' sel' : ''), onclick: () => { st.race = k; audio.sfx('click'); step(2); } },
                h('span', { class: 'ci' }, r.icon), h('b', {}, r.name), h('small', { html: colorize(r.blurb) })));
            body.append(cards);
            body.append(h('div', { class: 'title-actions' }, back, h('button', { type: 'button', class: 'btn primary', onclick: () => step(3) }, 'Next')));
        } else if (n === 3) {
            body.append(h('h2', {}, 'What did you learn as a child?'));
            const cards = h('div', { class: 'cards three' });
            for (const [k, sp] of Object.entries(SPECIALTIES)) cards.append(h('button', { type: 'button', class: 'card' + (st.spec === k ? ' sel' : ''), onclick: () => { st.spec = k; audio.sfx('click'); step(3); } },
                h('span', { class: 'ci' }, sp.icon), h('b', {}, sp.name), h('small', { html: colorize(sp.blurb) }),
                h('small', { class: 'skills' }, sp.skills.map((s) => s.name).join(' · '))));
            body.append(cards);
            body.append(h('div', { class: 'title-actions' }, back, h('button', { type: 'button', class: 'btn primary', onclick: () => step(4) }, 'Next')));
        } else {
            const r = RACES[st.race], sp = SPECIALTIES[st.spec];
            body.append(h('h2', {}, 'Your legend begins'));
            body.append(h('div', { class: 'summary', html: colorize(`\`%\`b${titleFor(0, st.sex)} ${esc(st.name)}\`b\`0<br>${r.icon} ${r.name} · ${sp.icon} ${sp.name} · ${PRONOUNS[st.sex].label}`) }));
            body.append(h('p', { class: 'dim', html: colorize(`${r.arrive} ${sp.child}`) }));
            body.append(h('h3', {}, 'Day pacing'));
            const pc = h('div', { class: 'cards three' },
                h('button', { type: 'button', class: 'card' + (st.pacing === 'adventurer' ? ' sel' : ''), onclick: () => { st.pacing = 'adventurer'; step(4); } }, h('b', {}, 'Adventurer'), h('small', {}, 'Sleep whenever you like to begin a new day. Recommended.')),
                h('button', { type: 'button', class: 'card' + (st.pacing === 'classic' ? ' sel' : ''), onclick: () => { st.pacing = 'classic'; step(4); } }, h('b', {}, 'Classic'), h('small', {}, 'A new day dawns every 6 real hours, like the original web game.')));
            body.append(pc);
            body.append(h('div', { class: 'title-actions' }, back, h('button', { type: 'button', class: 'btn primary big', onclick: () => begin(slot, st) }, 'Enter Hollowmere')));
        }
    };
    step(1);
}

function begin(slot, st) {
    const p = S.newPlayer({ ...st, slot });
    p.pacing = st.pacing;
    const seed = params.get('seed') ? hashStr(params.get('seed')) : (hashStr(st.name) ^ Date.now()) >>> 0;
    const w = W.createWorld(seed);
    S.saveSlot(slot, p, w);
    audio.unlock(); audio.sfx('newday');
    $('#title-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    game.start(p, w, { fresh: true });
    scene?.layout();
}

// ------------------------------------------------------------ export / import
function exportSave(p, w) {
    const blob = new Blob([S.exportData(p, w)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jade-wyrm-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-day${p.day}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    ui.toast('Save file downloaded.', '📜');
}

async function onImport(e) {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
        const d = S.parseImport(await file.text());
        const slots = S.slotSummaries();
        const free = slots.find((s) => s.empty);
        let slot = free ? free.slot : null;
        if (slot == null) {
            const pick = await ui.modal({ title: 'All slots are full', body: 'Choose a warrior to replace with the imported save:', buttons: [...slots.map((s) => ({ label: `Replace ${s.p.name}`, value: s.slot })), { label: 'Cancel', value: null }] });
            if (pick == null) return;
            slot = pick;
        }
        d.player.slot = slot;
        S.saveSlot(slot, d.player, d.world);
        showTitle(`\`@Imported \`%${esc(d.player.name)}\`@ (level ${d.player.level}, day ${d.player.day}).`);
    } catch (err) {
        ui.modal({ title: 'Import failed', body: esc(err.message || 'Could not read that file.') });
    }
}

// ------------------------------------------------------------ debug
function installDebug() {
    window.__jw = {
        game, ui, scene, audio, S, W, R, PAGES,
        get p() { return game.p; }, get w() { return game.w; },
        quickStart(opts = {}) { begin(opts.slot ?? 0, { name: opts.name || 'Tester', sex: opts.sex || 'n', race: opts.race || 'human', spec: opts.spec || 'thief', pacing: opts.pacing || 'adventurer' }); },
        enter, showTitle, logout,
    };
}

boot();
