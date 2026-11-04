// Rest in Paws: the pet shelter screen. A gallery of six pets to adopt, and a 128×128 Canvas 2D nursery in the crypt,
// painted with the same pixel painter as every other sprite, where the pet at home is fed, brushed, bathed, played
// with and dressed up.
//
// It reads the sim and never changes it: adopting, each bit of care and each change of outfit go out through send()
// as commands, and the sim (pets.js) decides what they're worth. The walking, eating, pouncing and the burrs in the
// fur live here.

import { Px } from './view/pixel.js';
import { PET_GEOM } from './view/art.js';
import { PETS, PET, FOODS, FOOD, ACCS, NEEDS, NEED_NAME, bondLevel, bondNext, content, petPerkText, MAX_LEVEL, PET_TUNE } from './sim/pets.js';

const N = 128;                 // the canvas, in nursery pixels
const S = 3;                   // a pet sprite pixel, in nursery pixels
const FY = 108;                // the floor line the pets stand on
const BOWL = 22, BED = 106;    // where the food bowl and the bed are
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rnd = (a, b) => a + Math.random() * (b - a);

const TABS = [{ id: 'feed', icon: '🍖', name: 'Feed' }, { id: 'groom', icon: '🪮', name: 'Groom' }, { id: 'play', icon: '🧶', name: 'Play' }, { id: 'dress', icon: '🎀', name: 'Dress up' }];
const GROOM = [
    { id: 'brush', icon: '🪮', name: 'Brush', all: 'Brush all over', help: 'Brush out the burrs and cobwebs.' },
    { id: 'sponge', icon: '🧽', name: 'Sponge', all: 'Scrub all over', help: 'Scrub the mud into suds…' },
    { id: 'rinse', icon: '🚿', name: 'Rinse', all: 'Rinse all over', help: '…and rinse the suds away.' },
];
const TOYS = [{ id: 'ball', icon: '🎾', name: 'Ball' }, { id: 'yarn', icon: '🧶', name: 'Yarn' }, { id: 'feather', icon: '🪶', name: 'Feather' }, { id: 'cuddle', icon: '🤲', name: 'Cuddle' }];
const NEED_ICON = { food: '🍖', clean: '🫧', fun: '🧶' };
const VOICE = { cat: 'Mrrp!', dog: 'Arf!', bat: 'Eep!', bunny: '*boop*', toad: 'Croak.', owl: 'Hoo!' };
const LOW = { food: 'Hungry…', clean: 'Itchy…', fun: 'Bored…' };

// ---------------------------------------------------------------------------------------------------- little sprites
function messSprite(kind) {
    const P = new Px(9, 9);
    if (kind === 'burr') {
        for (let a = 0; a < 8; a++) P.mline(4, 4, 4 + Math.round(Math.cos(a * 0.785) * 4), 4 + Math.round(Math.sin(a * 0.785) * 4), 1);
        P.fill('#8a6a2a');
        P.mell(4.5, 4.5, 2.4, 2.4).paint('#b08a3a', { hi: 1.2 });
    } else if (kind === 'mud') {
        P.mell(4.5, 5, 4, 3).mell(3, 3.5, 2, 1.8).paint('#6a4424', { soft: true });
        P.mp(3, 4).mp(6, 5).fill('#8a5a34');
    } else if (kind === 'web') {
        for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8], [4, 0], [0, 4]]) P.mline(4, 4, x, y, 1);
        for (let a = 0; a < 8; a++) P.mp(4 + Math.round(Math.cos(a * 0.785) * 2.6), 4 + Math.round(Math.sin(a * 0.785) * 2.6));
        P.fill('#e4def0');
        return P;
    } else {
        for (const [x, y, r] of [[3, 5, 2.4], [6, 4, 2.2], [4.5, 2.5, 1.8]]) P.mell(x, y, r, r);
        P.paint('#f4f8ff', { soft: true });
        P.mp(2, 4).mp(5, 3).fill('#ffffff');
        P.outline('#8ab0e0', 0.4);
        return P;
    }
    P.outline('#1a1024', 0.6);
    return P;
}
function foodSprite(id) {
    const P = new Px(12, 10);
    if (id === 'fish') { P.mell(5, 5, 4, 2.6).mpoly([[8, 5], [11, 2], [11, 8]]).paint('#7aa8d8', { hi: 1.2 }); P.mp(3, 4).fill('#1a1020'); }
    else if (id === 'bone') { P.mrect(3, 4, 6, 2).mell(2.5, 3.5, 1.6, 1.6).mell(2.5, 6, 1.6, 1.6).mell(9.5, 3.5, 1.6, 1.6).mell(9.5, 6, 1.6, 1.6).paint('#f2e4c4'); }
    else if (id === 'fig') { P.mell(4, 6, 2.8, 2.8).mell(8, 6, 2.8, 2.8).paint('#8a3a8a', { hi: 1.3 }); P.mp(4, 3).mp(8, 3).fill('#3a7a3a'); }
    else if (id === 'carrot') { P.mpoly([[2, 4], [10, 3], [10, 7], [2, 6]]).paint('#ff8a2a'); P.mpoly([[10, 5], [12, 1], [12, 8]]).paint('#4cc06a', { noline: true }); }
    else if (id === 'beetle') { P.mline(2, 3, 10, 8, 1).mline(10, 3, 2, 8, 1).fill('#2a1838'); P.mell(6, 5.5, 3.4, 3).paint('#5a2a8a', { hi: 1.5 }); }
    else { P.mell(6, 6, 4, 3.4).mell(3.5, 3, 1.4, 1.4).mell(8.5, 3, 1.4, 1.4).paint('#d8a060'); P.mp(5, 6).mp(7, 6).fill('#5a3010'); P.mp(6, 7).fill('#ff7aa8'); }
    P.outline('#1a1024', 0.7);
    return P;
}
function toySprite(id) {
    const P = new Px(10, 10);
    if (id === 'ball') { P.mell(5, 5, 4, 4).paint('#ff6fa5', { hi: 1.3 }); P.mline(2, 3, 8, 7, 1).fill('#fff3f8'); }
    else if (id === 'yarn') { P.mell(5, 5, 4, 4).paint('#9a6ad8'); P.mline(2, 4, 8, 2).mline(2, 7, 8, 5).mline(3, 9, 9, 7).fill('#c8a8ff'); }
    else { P.mline(1, 9, 8, 1, 1).fill('#e8dcc8'); P.mpoly([[3, 7], [8, 0], [9, 3], [5, 8]]).paint('#ff9cc0', { soft: true }); P.mp(6, 3).fill('#ffffff'); }
    P.outline('#1a1024', 0.6);
    return P;
}

// ---------------------------------------------------------------------------------------------------- the view
export class PetView {
    constructor({ audio, send, sprites, onClose }) {
        this.audio = audio;
        this.send = send;
        this.sprites = sprites;
        this.onClose = onClose;
        this.$ = (id) => document.getElementById(id);
        this.canvas = this.$('pets-canvas');
        this.canvas.width = N; this.canvas.height = N;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.bg = this.paintBackground();
        this.messImg = Object.fromEntries(['burr', 'mud', 'web', 'suds'].map((k) => [k, messSprite(k).toCanvas()]));
        this.foodImg = Object.fromEntries(FOODS.map((f) => [f.id, foodSprite(f.id).toCanvas()]));
        this.toyImg = Object.fromEntries(['ball', 'yarn', 'feather'].map((k) => [k, toySprite(k).toCanvas()]));
        this.mode = 'pick';
        this.sel = null;
        this.tab = 'feed';
        this.tool = 'brush';
        this.toy = 'ball';
        this.parts = [];
        this.mess = [];
        this.pet = null;           // the pet in the nursery: where it is and what it's doing
        this.down = null;
        this.sfxT = 0;
        this.uiT = 0;
        this.sig = '';
        this.buildDom();
        const c = this.canvas;
        c.addEventListener('pointerdown', (e) => this.pdown(e));
        c.addEventListener('pointermove', (e) => this.pmove(e));
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) c.addEventListener(ev, () => { this.down = null; });
    }

    // ------------------------------------------------------------------ the sheet's controls
    buildDom() {
        const $ = this.$;
        $('pets-list').addEventListener('click', (e) => {
            const b = e.target.closest('[data-pet]');
            if (!b) return;
            this.audio.ui('click');
            this.select(b.dataset.pet);
        });
        $('pets-detail').addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            const name = $('pets-name')?.value;
            if (b.id === 'pets-adopt') {
                this.send({ t: 'petAdopt', id: this.sel, name }, (ok) => { if (ok) { this.audio.pet?.('adopt', this.sel); this.showCare(true); } else this.audio.ui('no'); });
            } else if (b.id === 'pets-rename') {
                this.send({ t: 'petName', name }, (ok) => { this.audio.ui(ok ? 'click' : 'no'); this.renderPick(true); });
            } else if (b.id === 'pets-visit') { this.audio.ui('click'); this.showCare(); }
        });
        $('pets-tabs').innerHTML = TABS.map((t) => `<button role="tab" data-tab="${t.id}" aria-selected="false"><span aria-hidden="true">${t.icon}</span><b>${t.name}</b></button>`).join('');
        $('pets-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { this.audio.ui('click'); this.setTab(b.dataset.tab); } });
        $('pets-tools').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.toolButton(b); });
        $('pets-shelter').addEventListener('click', () => { this.audio.ui('click'); this.showPick(); });
    }

    open(G) {
        this.G = G;
        if (G.yard.pets.active) this.showCare(true); else this.showPick();
    }

    // ------------------------------------------------------------------ the shelter
    showPick() {
        this.mode = 'pick';
        this.$('pets-pick').hidden = false;
        this.$('pets-care').hidden = true;
        this.$('pets-shelter').hidden = true;
        const P = this.G.yard.pets;
        this.select(this.sel || P.active || PETS[0].id, true);
        this.renderPick(true);
        this.$('pets-list').querySelector(`[data-pet="${this.sel}"]`)?.focus({ preventScroll: true });
        this.status();
    }
    hearts(n) { return '♥'.repeat(n) + '♡'.repeat(MAX_LEVEL - n); }
    renderPick(force = false) {
        const P = this.G.yard.pets;
        const sig = `${P.active}|${PETS.map((p) => bondLevel(P.xp[p.id])).join()}|${this.sel}|${P.name}`;
        if (!force && sig === this.sig) return;
        this.sig = sig;
        this.$('pets-list').innerHTML = PETS.map((p) => {
            const lv = P.xp[p.id] !== undefined ? bondLevel(P.xp[p.id]) : 0;
            return `<button class="salon-client pet-card${p.id === this.sel ? ' sel' : ''}" data-pet="${p.id}" aria-pressed="${p.id === this.sel}">
                <img alt="" src="${this.sprites.icon('pet', p.id, 3)}"><b>${esc(P.active === p.id ? P.name : p.name)}</b><small>${esc(p.kind)}</small>
                ${P.active === p.id ? '<span class="pet-home">🏠 Home</span>' : ''}${lv ? `<span class="salon-best">${'♥'.repeat(lv)}</span>` : ''}</button>`;
        }).join('');
        const d = PET[this.sel], home = P.active === d.id, lv = bondLevel(P.xp[d.id]);
        const name = home ? P.name : d.name;
        this.$('pets-detail').innerHTML = `
            <p class="pet-line"><b>${esc(d.kind)}</b> · <i>“${esc(d.line)}”</i></p>
            <p class="pet-perk">Loves <b>${FOOD[d.fav].icon} ${esc(FOOD[d.fav].name.toLowerCase())}</b>. At home: <b>${esc(PET[d.id].perk(Math.round(Math.abs(d.fx.per) * lv * 1000) / 10))}</b> <span class="dim">(bond ${this.hearts(lv)}, more as your bond grows; half when they're unhappy)</span></p>
            <div class="pet-adopt">
                <label>Name <input id="pets-name" maxlength="16" autocomplete="off" spellcheck="false" value="${esc(name)}"></label>
                ${home ? '<button class="btn" id="pets-rename">Rename</button><button class="btn primary" id="pets-visit">Go to ' + esc(P.name) + ' →</button>'
                    : `<button class="btn primary" id="pets-adopt">${P.active ? `Swap: bring ${esc(d.name)} home` : `Adopt ${esc(d.name)} 🏠`}</button>`}
            </div>
            ${P.active && !home ? `<p class="dim pet-note">${esc(P.name)} will go back to the shelter and keep your bond, and you can swap back any time.</p>` : ''}`;
    }
    select(id, quiet = false) {
        if (!PET[id]) return;
        this.sel = id;
        if (!quiet) this.renderPick(true);
        if (!quiet) this.$('pets-list').querySelector(`[data-pet="${id}"]`)?.focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------ the nursery
    showCare(fresh = false) {
        const P = this.G.yard.pets;
        if (!P.active) { this.showPick(); return; }
        this.mode = 'care';
        this.$('pets-pick').hidden = true;
        this.$('pets-care').hidden = false;
        this.$('pets-shelter').hidden = false;
        if (fresh || !this.pet || this.pet.id !== P.active) {
            this.pet = { id: P.active, x: 64, y: 0, tx: 64, face: 1, state: 'idle', t: 0, happyT: 0, blinkT: 2, frameT: 0, frame: 0, jump: 0, wanderT: 2, food: null, shake: 0 };
            this.parts.length = 0;
            this.toyAt = null;
            this.makeMess();
            const low = NEEDS.filter((k) => P.need[k] < 0.4).sort((a, b) => P.need[a] - P.need[b])[0];
            this.say(low ? LOW[low] : VOICE[P.active]);
        }
        this.$('pets-who-img').src = this.sprites.icon('pet', P.active, 2);
        this.setTab(this.tab);
        this.status();
        this.updateNeeds(true);
        this.$('pets-tabs').querySelector('.on')?.focus({ preventScroll: true });
    }
    setTab(tab) {
        this.tab = tab;
        for (const b of this.$('pets-tabs').children) { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.classList.toggle('on', on); }
        if (tab === 'groom' && this.pet) { this.pet.tx = 64; this.pet.state = 'walk'; this.toyAt = null; }
        this.drawTools();
    }
    drawTools() {
        const P = this.G.yard.pets;
        const btn = (attrs, icon, name, on) => `<button ${attrs} class="tool${on ? ' on' : ''}" aria-pressed="${!!on}"><span aria-hidden="true">${icon}</span><b>${name}</b></button>`;
        let h = '';
        if (this.tab === 'feed') {
            h += `<div class="tool-row">${FOODS.map((f) => btn(`data-food="${f.id}" title="${esc(f.name)}"`, f.icon, f.short, false)).join('')}</div>`;
            h += `<p class="pet-help">Tap a treat to fill the bowl. ${esc(P.name)} loves ${FOOD[PET[P.active].fav].icon} best.</p>`;
        } else if (this.tab === 'groom') {
            const t = GROOM.find((x) => x.id === this.tool) || GROOM[0];
            h += `<div class="tool-row">${GROOM.map((x) => btn(`data-tool="${x.id}"`, x.icon, x.name, x.id === this.tool)).join('')}</div>`;
            h += `<div class="tool-row"><button data-all class="tool wide"><span aria-hidden="true">${t.icon}</span><b>${t.all}</b></button></div>`;
            h += `<p class="pet-help">${esc(t.help)} Drag over ${esc(P.name)}.</p>`;
        } else if (this.tab === 'play') {
            h += `<div class="tool-row">${TOYS.map((x) => btn(`data-toy="${x.id}"`, x.icon, x.name, x.id === this.toy)).join('')}</div>`;
            if (this.toy !== 'cuddle') h += `<div class="tool-row"><button data-toss class="tool wide"><span aria-hidden="true">${TOYS.find((x) => x.id === this.toy).icon}</span><b>Toss it!</b></button></div>`;
            h += `<p class="pet-help">${this.toy === 'cuddle' ? `Stroke ${esc(P.name)} for a cuddle.` : `Tap the floor to toss the ${this.toy}, and watch ${esc(P.name)} pounce.`}</p>`;
        } else {
            h += `<div class="tool-row">${btn('data-acc=""', '🚫', 'None', !P.acc)}${ACCS.map((a) => btn(`data-acc="${a.id}"`, a.icon, a.name, P.acc === a.id)).join('')}</div>`;
            h += `<p class="pet-help">Whatever ${esc(P.name)} wears, they wear in the castle too.</p>`;
        }
        this.$('pets-tools').innerHTML = h;
        const brush = this.tab === 'groom' || (this.tab === 'play');
        this.canvas.style.cursor = brush ? 'crosshair' : 'default';
    }
    toolButton(b) {
        const d = b.dataset;
        if (!this.pet) return;
        if (d.food) this.feed(d.food);
        else if (d.tool) { this.tool = d.tool; this.audio.ui('click'); this.drawTools(); }
        else if ('all' in d) this.groomAll();
        else if (d.toy) { this.toy = d.toy; this.audio.ui('click'); this.drawTools(); }
        else if ('toss' in d) this.toss(rnd(30, 98), rnd(84, 112));
        else if ('acc' in d) {
            const acc = d.acc || null;
            this.send({ t: 'petDress', acc }, (ok) => { if (ok) { this.sfx('pick'); this.sparkle(); this.pet.happyT = 1; this.drawTools(); this.$('pets-tools').querySelector(`[data-acc="${acc || ''}"]`)?.focus({ preventScroll: true }); } });
            return;
        }
        const again = this.$('pets-tools').querySelector(`[data-${Object.keys(d)[0]}${Object.values(d)[0] !== '' ? `="${Object.values(d)[0]}"` : ''}]`);
        again?.focus({ preventScroll: true });
    }

    status() {
        const P = this.G?.yard.pets;
        if (!P) return;
        let t;
        if (this.mode === 'care' && P.active) t = `🐾 ${P.name} · ${this.hearts(bondLevel(P.xp[P.active]))}`;
        else t = P.active ? `🏠 ${P.name} is at home` : 'Choose a friend';
        const el = this.$('pets-status');
        if (el.textContent !== t) el.textContent = t;
    }
    /** The needs bars, the bond and what the pet is doing for the castle. */
    updateNeeds(force = false) {
        const P = this.G.yard.pets;
        if (!P.active) return;
        const lv = bondLevel(P.xp[P.active]), next = bondNext(P.xp[P.active]);
        const sig = `${P.active}|${P.name}|${NEEDS.map((k) => Math.round(P.need[k] * 100)).join()}|${Math.floor(P.xp[P.active] || 0)}|${content(P)}`;
        if (!force && sig === this.needSig) return;
        this.needSig = sig;
        this.$('pets-who').textContent = `${P.name} the ${PET[P.active].kind}`;
        this.$('pets-bond').textContent = `Bond ${this.hearts(lv)}${next !== null ? ` · ${Math.floor(P.xp[P.active] || 0)}/${next}` : ' · best of friends'}`;
        this.$('pets-bars').innerHTML = NEEDS.map((k) => {
            const v = P.need[k];
            return `<div class="need${v < 0.25 ? ' low' : ''}" title="${NEED_NAME[k]}: ${Math.round(v * 100)}%"><span aria-hidden="true">${NEED_ICON[k]}</span><b>${NEED_NAME[k]}</b><i class="bar"><i style="width:${(v * 100).toFixed(0)}%"></i></i></div>`;
        }).join('');
        this.$('pets-perk').innerHTML = `${content(P) ? '✨' : '😿'} ${esc(petPerkText(P))}${content(P) ? '' : ` <span class="dim">(halved until ${esc(P.name)} is happier)</span>`}`;
    }
    say(text) {
        const el = this.$('pets-say');
        el.textContent = text;
        el.hidden = false;
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
        clearTimeout(this.sayT);
        this.sayT = setTimeout(() => { el.hidden = true; }, 1600);
    }

    // ------------------------------------------------------------------ feeding
    feed(food) {
        const pet = this.pet;
        if (pet.state === 'eat' || pet.food) { this.audio.ui('no'); return; }
        this.send({ t: 'petCare', act: 'feed', food }, (ok) => {
            if (!ok) { this.say('Too full!'); pet.shake = 0.6; this.audio.ui('no'); return; }
            pet.food = food;
            pet.fav = food === PET[pet.id].fav;
            pet.tx = BOWL + 20; pet.state = 'walk'; pet.then = 'eat';
            this.sfx('drop');
            for (let i = 0; i < 6; i++) this.parts.push({ x: BOWL + rnd(-4, 4), y: FY - 2, vx: rnd(-12, 12), vy: rnd(-20, -8), g: 60, life: 0.5, t: 0, col: '#ffffff', k: 'spark' });
        });
    }

    // ------------------------------------------------------------------ grooming
    /** Burrs, cobwebs and mud, as many as the pet is grubby. Each sits at a spot on the body, in the sprite's own pixels. */
    makeMess() {
        const P = this.G.yard.pets, g = PET_GEOM[P.active];
        this.clean0 = P.need.clean;
        const n = Math.round((1 - P.need.clean) * 14);
        const kinds = ['burr', 'mud', 'web', 'mud', 'burr'];
        this.mess = [];
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.85;
            this.mess.push({ kind: kinds[i % kinds.length], u: g.body[0] + Math.cos(a) * r * g.body[2], v: g.body[1] + Math.sin(a) * r * g.body[3], ph: Math.random() * 6 });
        }
        this.mess0 = this.mess.length;
        this.gone = 0;
    }
    /** Where a spot on the pet's sprite is in the nursery right now. */
    onPet(u, v) {
        const b = this.box;
        if (!b) return [0, 0];
        const x = b.flip ? b.x + (b.w - u) * S : b.x + u * S;
        return [x, b.y + v * S];
    }
    groomAt(x, y) {
        const tool = this.tool;
        let any = false;
        for (let i = this.mess.length - 1; i >= 0; i--) {
            const m = this.mess[i], [mx, my] = this.onPet(m.u, m.v);
            if (Math.hypot(mx - x, my - y) > (tool === 'rinse' ? 9 : 7)) continue;
            if (tool === 'brush' && (m.kind === 'burr' || m.kind === 'web')) {
                this.mess.splice(i, 1); this.gone++; any = true;
                this.parts.push({ x: mx, y: my, vx: rnd(-20, 20), vy: -12, g: 120, life: 1, t: 0, img: this.messImg[m.kind], k: 'img' });
                this.sfx('brush');
            } else if (tool === 'sponge' && m.kind === 'mud') {
                m.kind = 'suds'; any = true; this.sfx('squeak');
            } else if (tool === 'rinse' && m.kind === 'suds') {
                this.mess.splice(i, 1); this.gone++; any = true;
            }
        }
        if (tool === 'rinse') { for (let k = 0; k < 2; k++) this.parts.push({ x: x + rnd(-5, 5), y, vx: 0, vy: rnd(30, 60), life: 0.6, t: 0, col: '#9ad0ff', k: 'drop' }); this.sfx('water'); }
        if (tool === 'brush' && this.inPet(x, y)) {
            if (Math.random() < 0.2) this.parts.push({ x, y, vx: rnd(-10, 10), vy: rnd(-20, -5), g: 30, life: 0.8, t: 0, col: '#f4eefa', k: 'fluff' });
            if (!this.mess.length && Math.random() < 0.06) { this.heart(x, y - 4); this.sfx('purr'); }
        }
        if (any) this.reportClean();
    }
    groomAll() {
        const tool = this.tool;
        const before = this.mess.length;
        for (const m of [...this.mess]) { const [x, y] = this.onPet(m.u, m.v); this.groomAt(x, y); }
        if (tool === 'rinse') for (let k = 0; k < 30; k++) this.parts.push({ x: this.box.x + rnd(0, this.box.w * S), y: this.box.y + rnd(-10, 10), vx: 0, vy: rnd(40, 70), life: 0.9, t: 0, col: '#9ad0ff', k: 'drop' });
        if (tool === 'brush') for (let k = 0; k < 10; k++) this.parts.push({ x: this.box.x + rnd(0, this.box.w * S), y: this.box.y + rnd(10, this.box.h * S), vx: rnd(-10, 10), vy: rnd(-20, -5), g: 30, life: 0.8, t: 0, col: '#f4eefa', k: 'fluff' });
        if (before === this.mess.length) this.say(this.mess.length ? { brush: 'No burrs left!', sponge: 'No mud left!', rinse: 'Scrub it first!' }[tool] : 'Already spotless!');
    }
    reportClean() {
        const done = this.mess0 ? this.gone / this.mess0 : 1;
        const v = this.mess.length ? this.clean0 + (1 - this.clean0) * done : 1;
        this.send({ t: 'petCare', act: 'groom', v });
        if (!this.mess.length) {
            this.say('Squeaky clean!');
            this.pet.happyT = 1.6; this.pet.shake = 0.8;
            this.sparkle();
            this.sfx('yay');
        }
    }
    inPet(x, y) {
        const b = this.box;
        if (!b || x < b.x || y < b.y || x >= b.x + b.w * S || y >= b.y + b.h * S) return false;
        const sx = b.flip ? b.w - 1 - Math.floor((x - b.x) / S) : Math.floor((x - b.x) / S);
        const sy = Math.floor((y - b.y) / S);
        return !!b.e.px.d[(sy * b.w + sx) * 4 + 3];
    }

    // ------------------------------------------------------------------ playing
    toss(x, y) {
        const pet = this.pet;
        if (pet.state === 'eat') return;
        y = Math.max(84, Math.min(FY + 4, y));
        x = Math.max(12, Math.min(N - 12, x));
        this.toyAt = { kind: this.toy, x, y, h: 40, vh: 0, rest: false };
        pet.tx = x; pet.state = 'walk'; pet.then = 'pounce';
        this.sfx('toss');
    }
    catchToy() {
        const pet = this.pet;
        this.toyAt = null;
        this.send({ t: 'petCare', act: 'play' }, (ok) => {
            if (!ok) return;
            pet.happyT = 1.2;
            for (let i = 0; i < 4; i++) this.heart(pet.x + rnd(-10, 10), FY - 40 + rnd(-6, 6));
            this.sfx('catch');
            if (Math.random() < 0.35) this.say(VOICE[pet.id]);
        });
    }

    // ------------------------------------------------------------------ pointer
    at(e) { const r = this.canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * N, ((e.clientY - r.top) / r.height) * N]; }
    pdown(e) {
        e.preventDefault();
        if (this.mode !== 'care' || !this.pet) return;
        this.canvas.setPointerCapture?.(e.pointerId);
        const [x, y] = this.at(e);
        if (this.tab === 'groom' || (this.tab === 'play' && this.toy === 'cuddle')) { this.down = { x, y }; this.stroke(x, y); }
        else if (this.tab === 'play') this.toss(x, y);
        else if (this.inPet(x, y)) { this.heart(x, y - 4); this.sfx('voice'); this.pet.happyT = 0.8; }
    }
    pmove(e) {
        const [x, y] = this.at(e);
        this.pointer = [x, y];
        if (!this.down) return;
        const d = this.down, n = Math.max(1, Math.ceil(Math.hypot(x - d.x, y - d.y) / 2));
        for (let i = 1; i <= n; i++) this.stroke(d.x + (x - d.x) * i / n, d.y + (y - d.y) * i / n);
        this.down = { x, y };
    }
    stroke(x, y) {
        if (this.tab === 'groom') { this.groomAt(x, y); return; }
        // a cuddle: hearts, a purr, and now and then it counts as a pat
        if (!this.inPet(x, y)) return;
        this.pet.happyT = Math.max(this.pet.happyT, 0.4);
        if (Math.random() < 0.08) { this.heart(x, y - 3); this.sfx('purr'); }
        this.cuddled = (this.cuddled || 0) + 1;
        if (this.cuddled > 30) { this.cuddled = 0; this.send({ t: 'petCare', act: 'pat' }, (ok) => { if (ok) { this.say(VOICE[this.pet.id]); this.sfx('voice'); } }); }
    }

    // ------------------------------------------------------------------ effects
    heart(x, y) { this.parts.push({ x, y, vx: rnd(-6, 6), vy: rnd(-26, -16), life: 1.1, t: 0, col: ['#ff4f86', '#ff8fc2', '#ffb3d1'][(Math.random() * 3) | 0], k: 'heart' }); }
    sparkle() { const b = this.box; if (!b) return; for (let i = 0; i < 16; i++) this.parts.push({ x: b.x + rnd(0, b.w * S), y: b.y + rnd(0, b.h * S), vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.6, t: 0, col: ['#ffffff', '#ffd36b', '#ff9cc0'][i % 3], k: 'spark' }); }
    sfx(kind) {
        const now = performance.now();
        if (!['pick', 'yay', 'catch', 'voice'].includes(kind) && now - this.sfxT < 80) return;
        this.sfxT = now;
        this.audio.pet?.(kind, this.pet?.id);
    }

    paintBackground() {
        const P = new Px(N, N);
        // a crypt made cosy: stone blocks, a moonlit window, a plank floor and a rug
        for (let y = 0; y < 92; y++) for (let x = 0; x < N; x++) {
            const row = (y / 8) | 0, off = row % 2 ? 8 : 0;
            const mortar = y % 8 === 7 || (x + off) % 16 === 15;
            P.set(x, y, mortar ? '#2a2038' : ((x + off) >> 4) % 3 === row % 3 ? '#3e3254' : '#3a2e4e');
        }
        P.mrect(84, 14, 30, 44).mell(99, 14, 15, 12).paint('#6a4a3a', { hi: 1.2 });               // the window frame
        P.mrect(87, 17, 24, 38).mell(99, 17, 12, 10).fill('#1c1844');
        for (let y = 8; y < 55; y++) for (let x = 87; x < 111; x++) if (P.get(x, y) && P.get(x, y)[0] === 0x1c && y > 30) P.set(x, y, '#241e52');
        P.mell(104, 24, 5, 5).paint('#fff3c0', { soft: true }); P.mell(106, 23, 4, 4).fill('#1c1844');   // a crescent moon
        for (const [x, y] of [[91, 22], [96, 35], [108, 42], [92, 48], [102, 32]]) P.mp(x, y).fill('#fff6d0');
        P.mrect(98, 8, 2, 47).mrect(87, 34, 24, 2).fill('#5a3a2a');
        P.mrect(82, 56, 34, 4).paint('#7a5a4a');                                                 // the sill, with a candle
        P.mrect(88, 49, 3, 7).paint('#fff3d6'); P.mell(89.5, 47, 1.3, 2).paint('#ffcf4a', { soft: true });
        // a garland of paper bats along the top
        P.mline(0, 4, 64, 10, 1).mline(64, 10, 80, 6, 1).fill('#c9a24a');
        for (let i = 0; i < 6; i++) { const x = 6 + i * 12, y = 5 + i * 1; P.mpoly([[x, y + 1], [x - 4, y], [x - 3, y + 3], [x, y + 4], [x + 3, y + 3], [x + 4, y]]).paint(i % 2 ? '#ff8fc2' : '#b48cff', { soft: true }); }
        // a framed portrait of the Overlord with a puppy
        P.mrect(18, 22, 26, 30).paint('#d4a03a', { hi: 1.3 }); P.mrect(21, 25, 20, 24).fill('#4a2a5a');
        P.mell(28, 34, 4, 4).paint('#f1dcf6'); P.mrect(24, 28, 9, 3).paint('#2b2140');
        P.mpoly([[25, 29], [23, 25], [27, 28]]).mpoly([[31, 29], [33, 25], [29, 28]]).paint('#4b3a66');
        P.mrect(24, 38, 9, 11).paint('#2c2440'); P.mell(36, 43, 3.6, 3).paint('#8a5634'); P.mell(36, 40, 2.4, 2.2).paint('#8a5634');
        P.mp(27, 34).mp(29, 34).fill('#ff2d55');
        // the floor
        for (let y = 92; y < N; y++) for (let x = 0; x < N; x++) {
            const line = y % 6 === 0 || (x + ((y / 6) | 0) * 23) % 37 === 0;
            P.set(x, y, line ? '#3a2418' : y < 96 ? '#4a3020' : '#5a3a28');
        }
        P.mrect(0, 90, N, 3).fill('#2a1a14');
        P.mell(66, 112, 46, 11).paint('#a83a6a', { soft: true });                                 // the rug
        P.mell(66, 112, 40, 8).msub((q) => q.mell(66, 112, 37, 6.5)).fill('#ffc3de');
        // the pet bed, by the window
        P.mell(BED, 104, 18, 7).paint('#6a3a9a', { lo: 1.2 });
        P.mell(BED, 103, 14, 4.5).paint('#c8a0ff', { soft: true });
        P.mp(BED - 4, 102).mp(BED + 5, 103).fill('#ffffff');
        // the food bowl, with a heart on it
        P.mell(BOWL, 110, 11, 4).mrect(BOWL - 10, 106, 21, 4).paint('#d8dde8', { hi: 1.2 });
        P.mell(BOWL, 106, 9, 2).fill('#5a5a70');
        P.mrect(BOWL - 1, 109, 3, 1).mp(BOWL, 110).fill('#ff4f86');
        // a cobweb in the corner, naturally
        for (const [x, y] of [[0, 18], [18, 0], [12, 12], [4, 16], [16, 4]]) P.mline(0, 0, x, y, 1);
        for (let r = 5; r < 18; r += 5) for (let a = 0; a <= 8; a++) P.mp(Math.cos(a * 0.196) * r, Math.sin(a * 0.196) * r);
        P.fill('#7a6a9a');
        return P.toCanvas();
    }

    // ------------------------------------------------------------------ the frame
    frame(dt, G) {
        this.G = G;
        this.uiT -= dt;
        if (this.uiT <= 0) { this.uiT = 0.25; this.status(); if (this.mode === 'care') this.updateNeeds(); else this.renderPick(); }
        if (this.mode !== 'care' || !this.pet) return;
        const P = G.yard.pets;
        if (P.active !== this.pet.id) { this.showCare(true); return; }
        const pet = this.pet, time = performance.now() / 1000;
        pet.t += dt;
        const fly = pet.id === 'bat';
        // ----- what the pet is doing
        if (pet.state === 'walk') {
            const d = pet.tx - pet.x, sp = (fly ? 80 : 62) * dt;
            if (Math.abs(d) > 0.5) pet.face = d < 0 ? -1 : 1;
            pet.x += Math.sign(d) * Math.min(Math.abs(d), sp);
            if (Math.abs(pet.tx - pet.x) < 0.6) {
                pet.state = pet.then || 'idle'; pet.then = null; pet.t = 0;
                if (pet.state === 'eat') pet.face = -1;
                if (pet.state === 'pounce') { if (this.toyAt) pet.face = this.toyAt.x < pet.x ? -1 : 1; this.sfx('toss'); }
            }
        } else if (pet.state === 'eat') {
            if (Math.random() < dt * 8) { this.parts.push({ x: BOWL + rnd(-5, 5), y: FY - 4, vx: rnd(-15, 15), vy: rnd(-25, -10), g: 80, life: 0.6, t: 0, col: '#d8a060', k: 'crumb' }); this.sfx('munch'); }
            if (pet.t > 1.6) {
                pet.state = 'idle'; pet.t = 0; pet.food = null; pet.happyT = 1.4;
                for (let i = 0; i < (pet.fav ? 7 : 3); i++) this.heart(pet.x + rnd(-12, 12), FY - 36 + rnd(-8, 8));
                this.say(pet.fav ? 'Yum! My favourite!' : 'Nom.');
                this.sfx(pet.fav ? 'yay' : 'pick');
            }
        } else if (pet.state === 'pounce') {
            pet.jump = Math.sin(Math.min(1, pet.t / 0.45) * Math.PI) * 18;
            if (pet.t >= 0.45) { pet.jump = 0; pet.state = 'idle'; pet.t = 0; if (this.toyAt) this.catchToy(); }
        } else if (pet.state === 'idle' && this.tab !== 'groom' && !this.toyAt && !pet.food) {
            // a wander now and then
            pet.wanderT -= dt;
            if (pet.wanderT <= 0) { pet.wanderT = rnd(3, 6); pet.tx = rnd(44, 88); pet.state = 'walk'; }
        }
        // the toy falls and bounces
        const toy = this.toyAt;
        if (toy && !toy.rest) {
            toy.vh -= 220 * dt; toy.h += toy.vh * dt;
            if (toy.h <= 0) { toy.h = 0; if (Math.abs(toy.vh) > 40) { toy.vh = -toy.vh * 0.4; this.sfx('bounce'); } else toy.rest = true; }
        }
        pet.happyT = Math.max(0, pet.happyT - dt);
        pet.shake = Math.max(0, pet.shake - dt);
        pet.blinkT -= dt;
        if (pet.blinkT < -0.14) pet.blinkT = rnd(2, 5);
        pet.frameT += dt;
        const flapRate = fly ? 0.12 : 0.22;
        if (pet.frameT > flapRate) { pet.frameT = 0; pet.frame ^= 1; }
        // ----- which picture: happy after care, sad when neglected, blinking now and then
        const mood = pet.happyT > 0 || pet.state === 'eat' ? 'happy' : pet.blinkT < 0 ? 'blink' : content(P) ? 'idle' : 'sad';
        const frame = fly || (pet.id === 'dog' && (pet.happyT > 0 || pet.state === 'walk')) ? pet.frame : 0;
        const e = this.sprites.pet(pet.id, { mood, acc: P.acc, frame });
        const walking = pet.state === 'walk';
        const bob = fly ? Math.sin(time * 5) * 2 + 14 : walking ? Math.abs(Math.sin(pet.t * 14)) * 2 : pet.state === 'eat' ? (Math.sin(pet.t * 18) > 0 ? 1 : 0) : 0;
        const shake = pet.shake > 0 ? Math.round(Math.sin(time * 50) * 1.5) : 0;
        const feet = Math.round(e.h * (1 - e.pad));
        this.box = { x: Math.round(pet.x - (e.w * S) / 2) + shake, y: Math.round(FY - feet * S - bob - pet.jump), w: e.w, h: e.h, flip: pet.face < 0, e };

        // ----- paint
        const x = this.ctx;
        x.clearRect(0, 0, N, N);
        x.drawImage(this.bg, 0, 0);
        if (pet.food) { const f = this.foodImg[pet.food]; x.drawImage(f, BOWL - 6, 101 - (pet.state === 'eat' ? Math.min(3, pet.t * 2) : 0)); }
        // a soft shadow under the pet
        x.fillStyle = 'rgba(20,8,30,0.35)';
        const sw = Math.round(e.w * S * (fly ? 0.4 : 0.6));
        x.beginPath(); x.ellipse(Math.round(pet.x), FY + 1, sw / 2, 3, 0, 0, Math.PI * 2); x.fill();
        const b = this.box;
        x.save();
        if (b.flip) { x.translate(b.x + b.w * S, b.y); x.scale(-1, 1); x.drawImage(e.canvas, 0, 0, b.w * S, b.h * S); }
        else x.drawImage(e.canvas, b.x, b.y, b.w * S, b.h * S);
        x.restore();
        // burrs, mud and suds ride along on the fur
        for (const m of this.mess) {
            const [mx, my] = this.onPet(m.u, m.v), img = this.messImg[m.kind];
            const w = m.kind === 'suds' ? Math.sin(time * 4 + m.ph) * 0.6 : 0;
            x.drawImage(img, Math.round(mx - img.width / 2), Math.round(my - img.height / 2 + w));
        }
        if (toy) {
            const img = this.toyImg[toy.kind];
            x.fillStyle = 'rgba(20,8,30,0.3)'; x.fillRect(Math.round(toy.x - 3), Math.round(toy.y), 7, 1);
            x.drawImage(img, Math.round(toy.x - img.width / 2), Math.round(toy.y - img.height - toy.h + 1));
        }
        // particles: hearts, crumbs, fluff, water, sparkles
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.t += dt;
            if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
            p.vy += (p.g || 0) * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            x.globalAlpha = Math.min(1, (1 - p.t / p.life) * 1.5);
            const X = Math.round(p.x), Y = Math.round(p.y);
            if (p.k === 'img') x.drawImage(p.img, X - (p.img.width >> 1), Y);
            else if (p.k === 'heart') { x.fillStyle = p.col; x.fillRect(X - 2, Y - 1, 2, 2); x.fillRect(X + 1, Y - 1, 2, 2); x.fillRect(X - 2, Y, 5, 1); x.fillRect(X - 1, Y + 1, 3, 1); x.fillRect(X, Y + 2, 1, 1); }
            else if (p.k === 'spark') { x.fillStyle = p.col; x.fillRect(X, Y - 1, 1, 3); x.fillRect(X - 1, Y, 3, 1); }
            else { x.fillStyle = p.col; x.fillRect(X, Y, p.k === 'fluff' ? 2 : 1, 2); }
        }
        x.globalAlpha = 1;
        // the brush under the pointer
        if (this.pointer && this.tab === 'groom') {
            x.strokeStyle = this.tool === 'rinse' ? '#9ad0ff' : 'rgba(255,255,255,0.7)';
            x.lineWidth = 1;
            x.beginPath(); x.arc(Math.round(this.pointer[0]) + 0.5, Math.round(this.pointer[1]) + 0.5, this.tool === 'rinse' ? 9 : 7, 0, Math.PI * 2); x.stroke();
        }
    }
}

export { PET_TUNE };
