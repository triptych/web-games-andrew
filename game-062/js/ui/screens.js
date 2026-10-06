// Full-screen moments: the title menu, the hero creator (with a live 3D preview in town),
// loading a saved fruit, the death screen and the victory screen.

import { $, esc, FRUIT_EMOJI } from './dom.js';
import { CLASSES } from '../sim/data/classes.js';
import { FRUITS, EYES, MOUTHS, HATS } from '../sim/hero.js';
import { DIFFICULTIES } from '../config.js';
import { DEATH_LINES, floorName } from '../sim/data/story.js';
import { listSlots, deleteHero } from '../save.js';
import { fmtTime } from './panels.js';

const NAME_A = ['Sir', 'Lady', 'Captain', 'Professor', 'Little', 'Big', 'Grand', 'Baron', 'Squire', 'Doctor', 'Auntie', 'Mister'];
const NAME_B = ['Squeezealot', 'Pip', 'Juicy', 'Peelington', 'Zesty', 'Crunchworth', 'Pulpwick', 'Seedsworth', 'Rindle', 'McStem', 'Bumblepip', 'Fuzzbottom', 'Sweetcheeks', 'Tangerine', 'Squish'];
export const randomName = () => `${NAME_A[Math.floor(Math.random() * NAME_A.length)]} ${NAME_B[Math.floor(Math.random() * NAME_B.length)]}`;
const EYE_N = { round: 'Round', happy: 'Happy', sleepy: 'Sleepy', fierce: 'Fierce', starry: 'Starry', goggle: 'Goggly' };
const MOUTH_N = { smile: 'Smile', grin: 'Grin', o: 'Ooh', smirk: 'Smirk', teeth: 'Buck teeth', tongue: 'Cheeky' };
const HAT_N = { none: 'None', helm: 'Helm', wizard: 'Wizard', feather: 'Feathered cap', crown: 'Crown', bandana: 'Bandana', propeller: 'Propeller', chef: 'Chef', pirate: 'Pirate', flower: 'Flower', viking: 'Viking', tophat: 'Top hat' };

export class Screens {
    constructor(app) {
        this.app = app;
        this.el = $('screen');
        this.title = $('title');
        this.el.addEventListener('click', (e) => this.onClick(e));
        this.el.addEventListener('input', (e) => { if (e.target.id === 'cr-name') this.opts.name = e.target.value.slice(0, 22); });
        $('title-menu').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) this.onTitle(b.dataset.act); });
        this.opts = null;
    }

    hideAll() { this.title.classList.add('hidden'); this.el.classList.add('hidden'); this.el.className = 'screen hidden'; this.el.innerHTML = ''; }

    showTitle() {
        this.hideAll();
        this.title.classList.remove('hidden');
        const slots = listSlots();
        $('title-menu').innerHTML = `${slots.length ? `<button class="btn" data-act="continue">Continue · ${esc(slots[0].name)} (L${slots[0].level})</button>` : ''}
            <button class="btn${slots.length ? ' alt' : ''}" data-act="new">New Fruit</button>
            ${slots.length > 1 ? '<button class="btn alt" data-act="load">Load a Fruit</button>' : ''}
            <button class="btn alt" data-act="help">How to Play</button>
            <button class="btn alt" data-act="settings">Settings</button>`;
    }
    onTitle(a) {
        const app = this.app;
        app.audio.init(); app.audio.sfx('click');
        if (a === 'continue') app.loadSlot(listSlots()[0].id);
        if (a === 'new') this.showCreator();
        if (a === 'load') this.showLoad();
        if (a === 'help') this.showText('How to Play', HELP_HTML(app.input.isTouch));
        if (a === 'settings') { app.panels.open('settings'); }
    }

    showText(title, html) {
        this.title.classList.add('hidden');
        this.el.className = 'screen';
        this.el.innerHTML = `<div class="screen-panel"><h1>${esc(title)}</h1>${html}<div style="text-align:center;margin-top:14px"><button class="btn" data-act="back">Back</button></div></div>`;
    }

    showLoad() {
        this.title.classList.add('hidden');
        this.el.className = 'screen';
        const slots = listSlots();
        const rows = slots.map((s) => `<div class="row"><div class="tt">${FRUIT_EMOJI[s.fruit] || '🍎'} ${esc(s.name)}<small>Level ${s.level} ${CLASSES[s.cls]?.name || ''} · ${DIFFICULTIES[s.difficulty || 0].name} · ${esc(floorName(s.floor || 0))}${s.won ? ' · 🏆' : ''}</small></div><div><button class="btn small" data-act="loadslot" data-id="${s.id}">Play</button><button class="btn small alt" data-act="delslot" data-id="${s.id}">Delete</button></div></div>`).join('');
        this.el.innerHTML = `<div class="screen-panel slots-list"><h1>Your Fruit</h1>${rows || '<p>No saved fruit yet.</p>'}<div style="text-align:center;margin-top:14px"><button class="btn alt" data-act="back">Back</button></div></div>`;
    }

    // ------------------------------------------------------------------ creator
    showCreator() {
        const app = this.app;
        this.title.classList.add('hidden');
        this.opts = this.opts || { name: randomName(), cls: 'knight', look: { fruit: 'watermelon', tint: 0, eyes: 'round', mouth: 'smile', hat: 'helm' } };
        this.el.className = 'screen creator';
        this.renderCreator();
        app.previewHero(this.opts);
    }
    renderCreator() {
        const o = this.opts, L = o.look;
        const c = CLASSES[o.cls];
        const chips = (list, key, names) => list.map((v) => `<button class="chip${L[key] === v ? ' on' : ''}" data-act="look" data-k="${key}" data-v="${v}">${names[v]}</button>`).join('');
        this.el.innerHTML = `<div class="creator-panel">
            <h1>Grow a Hero</h1>
            <div class="lbl">Name</div>
            <div class="namebox"><input id="cr-name" maxlength="22" value="${esc(o.name)}" aria-label="Name"><button class="btn small alt" data-act="rname" title="Random name">🎲</button></div>
            <div class="lbl">Class</div>
            <div class="classes">${Object.values(CLASSES).map((k) => `<button class="cls${o.cls === k.id ? ' on' : ''}" data-act="cls" data-v="${k.id}"><span class="ic">${k.icon}</span>${k.name}</button>`).join('')}</div>
            <div class="blurb">${esc(c.blurb)}</div>
            <div class="lbl">Fruit</div>
            <div class="chips">${FRUITS.map((f) => `<button class="chip fruit${L.fruit === f ? ' on' : ''}" data-act="look" data-k="fruit" data-v="${f}" title="${f}">${FRUIT_EMOJI[f]}</button>`).join('')}</div>
            <div class="lbl">Ripeness (colour)</div>
            <div class="chips">${[0, 0.06, 0.12, -0.06, -0.12, 0.33, 0.5, -0.33].map((t) => `<button class="chip${Math.abs(L.tint - t) < 0.001 ? ' on' : ''}" data-act="tint" data-v="${t}">${{ 0: 'Classic', 0.06: 'Sunny', 0.12: 'Zingy', '-0.06': 'Rosy', '-0.12': 'Plummy', 0.33: 'Minty', 0.5: 'Berry', '-0.33': 'Weird' }[t]}</button>`).join('')}</div>
            <div class="lbl">Eyes</div><div class="chips">${chips(EYES, 'eyes', EYE_N)}</div>
            <div class="lbl">Mouth</div><div class="chips">${chips(MOUTHS, 'mouth', MOUTH_N)}</div>
            <div class="lbl">Hat</div><div class="chips">${chips(HATS, 'hat', HAT_N)}</div>
            <div class="creator-actions">
                <button class="btn" data-act="start">Into Tristrawberry!</button>
                <button class="btn alt" data-act="random">🎲 Surprise me</button>
                <button class="btn alt" data-act="back">Back</button>
            </div></div>`;
    }

    onClick(e) {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const app = this.app, o = this.opts;
        app.audio.sfx('click');
        switch (b.dataset.act) {
            case 'back': this.opts = null; app.toTitle(); return;
            case 'loadslot': app.loadSlot(b.dataset.id); return;
            case 'delslot': if (confirm('Delete this fruit forever? It will be composted.')) { deleteHero(b.dataset.id); this.showLoad(); } return;
            case 'rname': o.name = randomName(); break;
            case 'cls': { const prev = CLASSES[o.cls]; o.cls = b.dataset.v; const c = CLASSES[o.cls]; if (o.look.fruit === prev.defaultFruit) o.look.fruit = c.defaultFruit; if (o.look.hat === prev.defaultHat) o.look.hat = c.defaultHat; break; }
            case 'look': o.look[b.dataset.k] = b.dataset.v; break;
            case 'tint': o.look.tint = parseFloat(b.dataset.v); break;
            case 'random': {
                const pick = (a) => a[Math.floor(Math.random() * a.length)];
                o.cls = pick(Object.keys(CLASSES)); o.name = randomName();
                o.look = { fruit: pick(FRUITS), tint: pick([0, 0, 0.06, -0.06, 0.12, 0.33]), eyes: pick(EYES), mouth: pick(MOUTHS), hat: pick(HATS) };
                break;
            }
            case 'start': app.startNew({ name: (o.name || '').trim() || randomName(), cls: o.cls, look: { ...o.look } }); this.opts = null; return;
        }
        this.renderCreator();
        app.previewHero(o);
    }

    // ------------------------------------------------------------------ death & victory
    showDeath(by) {
        this.el.className = 'screen';
        const line = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];
        this.el.innerHTML = `<div class="death"><h1>${line}</h1><p>Done in by ${esc(by)}. You'll wake up in Tristrawberry and lose a tenth of your sugar.</p><button class="btn" data-act2="respawn">Respawn in town</button></div>`;
        this.el.querySelector('[data-act2]').addEventListener('click', () => { this.hideAll(); this.app.respawn(); });
    }

    showVictory() {
        const app = this.app, h = app.game.hero;
        this.el.className = 'screen';
        const next = h.difficulty < DIFFICULTIES.length - 1 ? DIFFICULTIES[h.difficulty + 1].name : null;
        this.el.innerHTML = `<div class="screen-panel" style="text-align:center"><h1>The Orchard Is Saved!</h1>
            <p>Durian the Diabolical bursts in a cloud of the worst smell ever recorded, and then… it clears. Somewhere far above, Tristrawberry's trees blossom all at once. Deckard Cane faints with joy, then wakes up and tells everyone about it for three hours.</p>
            <p><b>${esc(h.name)}</b>, the ${esc(CLASSES[h.cls].name)}, is now officially Fruit of the Year.</p>
            <div class="end-stats"><div><b>${h.level}</b>Level</div><div><b>${h.stats.kills}</b>Squashed</div><div><b>${h.stats.deaths}</b>Times pulped</div><div><b>${h.stats.legendaries}</b>Golden finds</div><div><b>${fmtTime(h.stats.time)}</b>Play time</div></div>
            <p>${next ? `Talk to Deckard Cane in town to try <b>${next}</b> difficulty: everything is riper, angrier and drops better loot.` : 'You have beaten every difficulty. You are the ripest fruit there ever was.'}</p>
            <button class="btn" data-act2="keep">Keep playing</button></div>`;
        this.el.querySelector('[data-act2]').addEventListener('click', () => { this.hideAll(); this.app.resume(); });
    }
}

export const HELP_HTML = (touch) => `
    <p><b>Rotten to the Core</b> is a click-and-squash dungeon crawl. Something rotten has crawled up from under the town of Tristrawberry. Go down, squash it, take its stuff.</p>
    ${touch ? '<p><b>Move</b> with the stick, <b>tap</b> monsters, loot and townsfolk. <b>⚔️</b> attacks the nearest enemy; the round buttons are your skills.</p>'
        : '<p><b>Click</b> to walk and to attack. <b>Right-click</b> and <b>1–4</b> use skills at the cursor. <b>WASD</b> works too. <b>Q</b>/<b>E</b> drink potions, <b>R</b> bakes a Portal Pie home. <b>C I K J</b> open your character, backpack, skills and quests. <b>Tab</b> is the map.</p>'}
    <p>Every level is generated fresh: break crates for loot, avoid the soda kegs (or don't), drink from Smoothie Shrines, and watch the floor for red circles — that's where something big is about to land.</p>
    <p>Three acts: the Root Cellar, the Jam Catacombs and the Rotten Core, each ending in a boss. Loot comes Common, <span style="color:var(--r-magic)">Juicy</span>, <span style="color:var(--r-rare)">Ripe</span> and <span style="color:var(--r-legendary)">Golden</span>.</p>`;
